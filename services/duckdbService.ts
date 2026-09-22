import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import duckdb_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
import { ColumnStats, ImportOptions, EnrichedColumnStats, ObjectRef, QueryResult } from '../types';
import { ONTOLOGY_CREATE_STATEMENTS, ONTOLOGY_SEED_STATEMENTS } from '../components/Library/ontologyDataModel';
import { workbookIO } from './workbookIO';
import {
  saveWorkspaceSnapshot,
  loadWorkspaceSnapshot,
  clearWorkspaceSnapshot,
  type DuckDBTableSnapshot,
  type DuckDBViewSnapshot,
  type DuckDBWorkspaceSnapshot,
} from './duckdbWorkspaceStorage';
import { arrowTypeToDuckDBType } from '../utils/typeFormatter';

export interface DuckDBRuntimeInfo {
  ready?: boolean;
  persistent: boolean;
  isLegacy?: boolean;
  version?: string;
  persistenceError?: string | null;
  storageMode?: 'indexeddb' | 'opfs' | 'memory';
  dbSize?: string;
  memoryUsage?: string;
}

const DUCKDB_VERSION = '1.33.1';

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    
    if (char === "'" && !inDoubleQuote) {
      if (sql[i - 1] !== '\\') {
        inSingleQuote = !inSingleQuote;
      }
    } else if (char === '"' && !inSingleQuote) {
      if (sql[i - 1] !== '\\') {
        inDoubleQuote = !inDoubleQuote;
      }
    }
    
    if (char === ';' && !inSingleQuote && !inDoubleQuote) {
      if (current.trim()) {
        statements.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }
  }
  
  if (current.trim()) {
    statements.push(current.trim());
  }
  return statements;
}

class DuckDBService {
  private db: duckdb.AsyncDuckDB | null = null;
  private conn: duckdb.AsyncDuckDBConnection | null = null;
  private readConn: duckdb.AsyncDuckDBConnection | null = null;
  private isInitialized = false;
  private isLegacy = false;
  private isPersistent = false;
  private storageMode: 'indexeddb' | 'opfs' | 'memory' = 'indexeddb';
  private persistenceError: string | null = null;
  private initPromise: Promise<void> | null = null;
  private schemaChangeTimeout: any = null;
  private cacheSaveTimeout: any = null;
  private isRestoringFromCache = false;
  private queryQueue: Promise<any> = Promise.resolve();
  private inTransaction = false;
  private registeredFiles = new Map<string, any>();

  getRuntimeInfo = (): DuckDBRuntimeInfo => {
    return {
      ready: this.isInitialized,
      persistent: this.isPersistent,
      storageMode: this.storageMode,
      isLegacy: this.isLegacy,
      version: DUCKDB_VERSION,
      persistenceError: this.persistenceError,
    };
  };

  getEngineVersion(): string {
    return DUCKDB_VERSION;
  }

  private cleanDuckDBResult(result: any): any[] {
    if (!result) return [];
    return result.toArray().map((row: any) => {
      const raw = typeof row.toJSON === 'function' ? row.toJSON() : row;
      const clean: any = {};
      for (const k of Object.keys(raw)) {
        const val = raw[k];
        if (val === null || val === undefined) {
          clean[k] = null;
        } else if (typeof val === 'bigint') {
          clean[k] = Number(val);
        } else {
          clean[k] = val;
        }
      }
      return clean;
    });
  }

  private async runInQueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queryQueue.then(fn);
    this.queryQueue = next.then(() => {}).catch(() => {});
    return next;
  }

  private dispatchSchemaChanged() {
    if (this.schemaChangeTimeout) {
      clearTimeout(this.schemaChangeTimeout);
    }
    this.schemaChangeTimeout = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('duckdb-schema-changed'));
      this.schemaChangeTimeout = null;
    }, 100);
  }



  /** 确保 DuckDB 连接就绪后再返回，外部调用方无需自行 await init() */
  private async waitForInit(): Promise<void> {
    await this.init();
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) {
      try {
        await this.initPromise;
        return;
      } catch (err) {
        this.initPromise = null;
        throw err;
      }
    }

    const runInit = async () => {
      // --- FORCE REFRESH CHECK ---
      console.log("%c!!! DUCKDB SERVICE INITIATING (V5 - VITE BUNDLED) !!!", "background: green; color: white; font-size: 20px");

      // --- SERVICE WORKER KILL SWITCH ---
      if ('serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const registration of registrations) {
            console.warn(`[DuckDB] Unregistering Service Worker: ${registration.scope}`);
            await registration.unregister();
          }
        } catch (e) {
          console.warn("[DuckDB] SW Cleanup failed", e);
        }
      }

      // Use Vite-bundled assets (guaranteed to be v1.28.0 from package.json)
      const mainModuleURL = duckdb_wasm;
      const mainWorkerURL = duckdb_worker;

      console.log(`[DuckDB] Target Worker URL: ${mainWorkerURL}`);

      // Do not cache-bust the worker URL: module workers resolve relative imports
      // against their script URL, and a changing `?t=` query can stall instantiate().
      const worker = new Worker(mainWorkerURL, { type: 'module' });
      // Custom logger that silences "table does not exist" / "Catalog Error" noise.
      // DuckDB logs these at INFO level (not ERROR), so we filter by message content only.
      // duckdb.Logger is an interface, not a class — implement it directly.
      const logger: duckdb.Logger = {
        log(entry: duckdb.LogEntryVariant) {
          const msg = typeof entry.value === 'string' ? entry.value : '';
          if (/Table with name|Catalog Error|does not exist/i.test(msg)) return;
          console.log(`[DuckDB] [${duckdb.getLogLevelLabel(entry.level)}] ${msg}`);
        }
      };

      this.db = new duckdb.AsyncDuckDB(logger, worker);
      await withTimeout(this.db.instantiate(mainModuleURL), 60000, 'DuckDB WASM 内核加载超时');
      this.conn = await this.db.connect();
      try {
        this.readConn = await this.db.connect();
      } catch (e) {
        console.warn("[DuckDB] Read connection fallback to main connection", e);
        this.readConn = this.conn;
      }

      // --- VERSION CHECK ---
      let ver = "unknown";
      try {
        const verRes = await this.conn.query('SELECT version() as v');
        ver = verRes.toArray()[0].toJSON().v;
        console.log(`[DuckDB] Kernel Version: ${ver}`);
      } catch (e) {
        console.warn("[DuckDB] Version check failed", e);
      }

      // CRITICAL: Determine legacy status BEFORE any path operations
      this.isLegacy = ver.startsWith('v0.9') || ver.includes('0.9.1');
      if (this.isLegacy) {
        console.warn("!!! RUNNING LEGACY KERNEL v0.9.1 !!!");
        console.warn("Legacy Warning: System is fragile. Extensions and VFS disabled.");
      }

      // --- M4: Persistence Check ---
      if (typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated) {
        console.log("%c[DuckDB] High-Performance Mode: ON (COOP/COEP Active)", "color: green; font-weight: bold");
      } else {
        console.warn("[DuckDB] High-Performance Mode: OFF (Persistence may be limited)");
      }

      // --- UNIVERSAL VFS BOOTSTRAP (TRY/CATCH WRAPPED) ---
      // Whether v0.9 or v1.x, the worker seems to WANT a home directory.
      if (!this.isLegacy) {
        console.log("[DuckDB] Attempting VFS Bootstrap...");
        try {
          // Check if files exist first (if possible) or just try-catch
          try { await this.db.registerFileText('/home/.keep', ''); } catch (e) { }
          try { await this.db.registerFileText('/home/web_user/.keep', ''); } catch (e) { }
          console.log("[DuckDB] VFS paths touched");
        } catch (e) {
          console.warn("[DuckDB] VFS Bootstrap Failed (Safe to ignore):", e);
        }
      }

      // Try to SET the home directory (TRY/CATCH WRAPPED)
      if (!this.isLegacy) {
        try {
          await this.conn.query(`SET home_directory='/home/web_user'`);
          console.log("[DuckDB] SET home_directory success");
        } catch (e) {
          // SWALLOW ERROR ON LEGACY or FAIL
          console.warn("[DuckDB] SET home_directory skipped/failed:", e);
        }
      }

      // Do not INSTALL/LOAD extensions during boot. Remote extension downloads
      // (httpfs, tpch, spatial, …) can hang forever on restricted networks and
      // block the homepage. Load them on demand from the Extensions tab.

      // Initialize Audit Log Table (CRITICAL: Must run for BOTH versions)
      try {
        await this.conn.query(`
            CREATE TABLE IF NOT EXISTS memory._sys_audit_log (
              id INTEGER PRIMARY KEY,
              log_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              operation_type VARCHAR,
              target_table VARCHAR,
              details TEXT,
              affected_rows INTEGER,
              sql_statement TEXT
            );
            CREATE SEQUENCE IF NOT EXISTS memory._sys_audit_seq START 1;
          `);
        console.log("[DuckDB] System Tables Initialized");
      } catch (e) {
        console.error("[DuckDB] Failed to create system tables", e);
      }

      this.isInitialized = true;

      // Restore workspace cache from IndexedDB
      if (typeof indexedDB !== 'undefined') {
        try {
          this.isPersistent = true;
          this.storageMode = 'indexeddb';
          await withTimeout(
            this.restoreFromIndexedDBCache(),
            12000,
            'IndexedDB workspace restore timed out',
          );
        } catch (cacheErr: any) {
          this.isRestoringFromCache = false;
          console.warn('[DuckDB] Failed to restore from IndexedDB cache:', cacheErr);
          this.persistenceError = cacheErr?.message || String(cacheErr);
        }
      }
    };

    this.initPromise = runInit();
    try {
      await this.initPromise;
    } catch (err) {
      this.initPromise = null;
      throw err;
    }
  }

  /**
   * Restores tables, views, and macros from IndexedDB workspace cache
   */
  async restoreFromIndexedDBCache(): Promise<void> {
    const snapshot = await loadWorkspaceSnapshot();
    if (!snapshot) return;

    this.isRestoringFromCache = true;
    try {
      // 1. Restore tables
      if (Array.isArray(snapshot.tables)) {
        for (const table of snapshot.tables) {
          if (!table.name || !table.ddl) continue;
          try {
            await this.conn!.query(table.ddl);
            if (Array.isArray(table.rows) && table.rows.length > 0) {
              const tempFile = `restore_${table.name.replace(/[^a-zA-Z0-9_]/g, '_')}_${Date.now()}.json`;
              const jsonStr = JSON.stringify(table.rows);
              await this.db!.registerFileText(tempFile, jsonStr);
              try {
                await this.conn!.query(`INSERT INTO "${table.name.replace(/"/g, '""')}" SELECT * FROM read_json_auto('${tempFile}')`);
              } finally {
                try { await this.db!.dropFile(tempFile); } catch {}
              }
            }
          } catch (tErr) {
            console.warn(`[DuckDB] Error restoring table ${table.name}:`, tErr);
          }
        }
      }

      // 2. Restore views
      if (Array.isArray(snapshot.views)) {
        for (const v of snapshot.views) {
          if (!v.name || !v.sql) continue;
          try {
            await this.conn!.query(`CREATE OR REPLACE VIEW "${v.name.replace(/"/g, '""')}" AS ${v.sql}`);
          } catch (vErr) {
            console.warn(`[DuckDB] Error restoring view ${v.name}:`, vErr);
          }
        }
      }

      // 3. Restore macros
      if (Array.isArray(snapshot.macros)) {
        for (const m of snapshot.macros) {
          if (!m.sql) continue;
          try {
            await this.conn!.query(m.sql);
          } catch (mErr) {
            console.warn(`[DuckDB] Error restoring macro:`, mErr);
          }
        }
      }

      // 4. Restore canvas edges if present
      if (Array.isArray(snapshot.canvasEdges) && snapshot.canvasEdges.length > 0) {
        for (const edge of snapshot.canvasEdges) {
          try {
            await this.saveOntologyCanvasEdge(edge.id, edge.source_id || edge.source, edge.target_id || edge.target);
          } catch {}
        }
      }

      console.log('[DuckDB] Workspace restored successfully from IndexedDB cache');
      this.dispatchSchemaChanged();
    } finally {
      this.isRestoringFromCache = false;
    }
  }

  /**
   * Schedule debounced saving of workspace snapshot to IndexedDB
   */
  scheduleCacheSave(delayMs: number = 400): void {
    if (!this.isPersistent || this.isRestoringFromCache) return;
    if (this.cacheSaveTimeout) {
      clearTimeout(this.cacheSaveTimeout);
    }
    this.cacheSaveTimeout = setTimeout(() => {
      this.cacheSaveTimeout = null;
      void this.saveToIndexedDB();
    }, delayMs);
  }

  /**
   * Collects current database state and saves it into IndexedDB
   */
  async saveToIndexedDB(): Promise<void> {
    if (!this.conn || !this.isInitialized || this.isRestoringFromCache) return;

    try {
      const baseTables = await this.getBaseTables();
      const tableSnapshots: DuckDBTableSnapshot[] = [];

      for (const t of baseTables) {
        if (t.startsWith('_sys_')) continue;
        try {
          const def = await this.getTableOrViewDefinition(t);
          const rows = await this.query(`SELECT * FROM "${t.replace(/"/g, '""')}"`);
          tableSnapshots.push({
            name: t,
            ddl: def.ddl,
            rows: rows || [],
          });
        } catch (tErr) {
          console.warn(`[DuckDB] Failed to snapshot table ${t}:`, tErr);
        }
      }

      const views = await this.getViews();
      const viewSnapshots: DuckDBViewSnapshot[] = [];
      for (const v of views) {
        try {
          const def = await this.getTableOrViewDefinition(v);
          viewSnapshots.push({
            name: v,
            sql: def.sql || def.ddl,
          });
        } catch {}
      }

      let canvasEdges: any[] = [];
      if (baseTables.includes('life_canvas_edge')) {
        try {
          canvasEdges = await this.loadOntologyCanvasEdges();
        } catch {}
      }

      const snapshot: DuckDBWorkspaceSnapshot = {
        version: 1,
        updatedAt: Date.now(),
        tables: tableSnapshots,
        views: viewSnapshots,
        macros: [],
        canvasEdges,
      };

      await saveWorkspaceSnapshot(snapshot);
    } catch (e) {
      console.warn('[DuckDB] Failed to save workspace to IndexedDB cache:', e);
    }
  }

  /**
   * Clears IndexedDB cache and removes all workspace tables & views
   */
  async clearIndexedDBCache(): Promise<void> {
    if (this.cacheSaveTimeout) {
      clearTimeout(this.cacheSaveTimeout);
      this.cacheSaveTimeout = null;
    }
    await clearWorkspaceSnapshot();
    await this.clearAllData({ tables: true, views: true, macros: true, files: true });
    this.dispatchSchemaChanged();
  }

  /**
   * Completely tears down the DuckDB instance and reinitializes.
   * This clears all internal VFS cache and file handles.
   */
  async reset(): Promise<void> {
    console.log('[DuckDB] Resetting instance...');

    // Close connection first
    if (this.conn) {
      try {
        await this.conn.close();
      } catch (e) {
        console.warn('[DuckDB] Connection close warning:', e);
      }
      this.conn = null;
    }

    // Terminate the database (this kills the worker)
    if (this.db) {
      try {
        await this.db.terminate();
      } catch (e) {
        console.warn('[DuckDB] DB terminate warning:', e);
      }
      this.db = null;
    }

    // Reset state flags
    this.isInitialized = false;
    this.isLegacy = false;
    this.initPromise = null;

    console.log('[DuckDB] Instance reset complete. Re-initializing...');

    // Re-initialize fresh
    await this.init();
  }

  async query(sql: string): Promise<any[]> {
    return this.runInQueue(async () => {
      await this.waitForInit();
      if (!this.conn) throw new Error("Database not connected");

      if (this.isLegacy) {
        const up = sql.toUpperCase();
        if (up.includes('INSTALL') || up.includes('LOAD')) {
          console.warn(`[DuckDB Safety] Blocked extension command on Legacy Kernel: ${sql}`);
          return [];
        }
      }

      const statements = splitSqlStatements(sql);
      let lastResult: any[] = [];
      let schemaChanged = false;
      for (const stmt of statements) {
        if (!stmt.trim()) continue;
        const result = await this.conn.query(stmt);
        if (/^\s*(CREATE|DROP|ALTER|COPY|IMPORT|INSERT\s+INTO|UPDATE|DELETE)/i.test(stmt)) {
          schemaChanged = true;
        }
        try {
          lastResult = result.toArray().map((row) => {
            const raw = row.toJSON();
            const clean: any = {};
            for (const k of Object.keys(raw)) {
              const val = raw[k];
              if (val === null || val === undefined) {
                clean[k] = null;
              } else if (typeof val === 'bigint') {
                clean[k] = Number(val);
              } else if (typeof val === 'object' && !(val instanceof Date) && !(val instanceof Array)) {
                const cName = val.constructor?.name || '';
                if ('scale' in val || cName.includes('Decimal') || cName.includes('Numeric')) {
                  const strVal = typeof val.toString === 'function' ? val.toString() : '';
                  const numVal = Number(strVal);
                  if (!isNaN(numVal)) {
                    if (val.scale && !strVal.includes('.')) {
                      clean[k] = numVal / Math.pow(10, val.scale);
                    } else {
                      clean[k] = numVal;
                    }
                  } else {
                    clean[k] = val;
                  }
                } else {
                  clean[k] = val;
                }
              } else {
                clean[k] = val;
              }
            }
            return clean;
          });
        } catch (e) {
          // Drop/Create statements might not return rows
          lastResult = [];
        }
      }
      if (schemaChanged) {
        this.dispatchSchemaChanged();
        this.scheduleCacheSave();
      }
      return lastResult;
    });
  }

  /** Read-only query method using dedicated secondary connection without queue lock */
  async readQuery(sql: string): Promise<any[]> {
    await this.waitForInit();
    if (!this.readConn) return this.query(sql);

    try {
      const result = await this.readConn.query(sql);
      return result.toArray().map((row) => {
        const raw = row.toJSON();
        const clean: any = {};
        for (const k of Object.keys(raw)) {
          const val = raw[k];
          if (val === null || val === undefined) {
            clean[k] = null;
          } else if (typeof val === 'bigint') {
            clean[k] = Number(val);
          } else {
            clean[k] = val;
          }
        }
        return clean;
      });
    } catch (e) {
      // Fallback to main query queue if secondary connection encounters issue
      return this.query(sql);
    }
  }

  /**
   * Fetches schema metadata (tables and their columns) for autocomplete and editor hints.
   */
  async getSchemaContext(): Promise<Record<string, { name: string; type: string }[]>> {
    try {
      const rows = await this.readQuery(`
        SELECT table_name, column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = current_schema()
          AND table_name NOT LIKE '_sys_%'
        ORDER BY table_name, ordinal_position
      `);
      const schemaMap: Record<string, { name: string; type: string }[]> = {};
      for (const row of rows) {
        const t = String(row.table_name || '');
        const c = String(row.column_name || '');
        const dt = String(row.data_type || 'VARCHAR');
        if (t && c && !t.startsWith('_sys_')) {
          if (!schemaMap[t]) schemaMap[t] = [];
          schemaMap[t].push({ name: c, type: dt });
        }
      }
      return schemaMap;
    } catch (e) {
      console.warn("[DuckDB] Failed to fetch schema context:", e);
      return {};
    }
  }

  /** Execute a batch of SQL statements sequentially, returning results for each. */
  async batchQuery(statements: string[]): Promise<{ index: number; data?: any[]; error?: string; executionTime?: number }[]> {
    const results: { index: number; data?: any[]; error?: string; executionTime?: number }[] = [];
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if (!stmt) continue;
      const start = performance.now();
      try {
        const data = await this.query(stmt);
        results.push({ index: i, data, executionTime: performance.now() - start });
      } catch (e: any) {
        results.push({ index: i, error: e.message, executionTime: performance.now() - start });
      }
    }
    return results;
  }

  // --- Phase 3: Live Preview ---
  async previewSql(sql: string): Promise<any[]> {
    if (!this.conn) throw new Error("Database not connected");

    const upperSql = sql.trim().toUpperCase();
    if (!upperSql.startsWith('SELECT') && !upperSql.startsWith('WITH')) {
      // Only allow read-only preview for now
      throw new Error("Preview only supports SELECT statements");
    }

    // Improved Safety Check: Use Regex with word boundaries to avoid false positives (e.g., "RAINDROP")
    // Also checks for TRUNCATE which was missing
    const dangerousKeywords = /\b(DROP|DELETE|INSERT|UPDATE|CREATE|ALTER|TRUNCATE)\b/i;

    if (dangerousKeywords.test(sql)) {
      throw new Error("Preview blocked: Contains modification keywords (Safety Check)");
    }

    // Attempt to inject LIMIT 5 if not present
    let safeSql = sql;
    if (!upperSql.includes('LIMIT')) {
      safeSql += ' LIMIT 5';
    }

    return this.query(safeSql);
  }

  /** Phase 3: Explain / Profile Query Execution Plan */
  async explainQuery(sql: string, analyze: boolean = false): Promise<any[]> {
    return this.runInQueue(async () => {
      await this.waitForInit();
      if (!this.conn) throw new Error("Database not connected");
      const prefix = analyze ? 'EXPLAIN ANALYZE ' : 'EXPLAIN ';
      return await this.conn.query(prefix + sql).then(res => res.toArray().map(r => r.toJSON()));
    });
  }

  // Wrapper for operations that need auditing
  async executeAndAudit(sql: string, type: string, table: string | null, details: string): Promise<any> {
    return this.runInQueue(async () => {
      await this.waitForInit();
      if (!this.conn) throw new Error("Database not connected");

      if (this.isLegacy) {
        const up = sql.toUpperCase();
        if (up.includes('INSTALL') || up.includes('LOAD')) {
          console.warn(`[DuckDB Safety] Blocked extension command on Legacy Kernel (Audit): ${sql}`);
          return [];
        }
      }

      try {
        const result = await this.conn.query(sql);
        const isSchemaChange = type === 'IMPORT' || type === 'CREATE' || type === 'DROP' || type === 'ALTER' || /^\s*(CREATE|DROP|ALTER|COPY|IMPORT)/i.test(sql);
        if (isSchemaChange) {
          this.dispatchSchemaChanged();
        }
        let rows: any[] = [];
        try {
          rows = result.toArray().map(r => r.toJSON());
        } catch (e) {
          // Some statements like DROP don't return rows
        }

        // Attempt to infer affected rows if possible, otherwise 0 or result length
        const affected = rows.length;

        // Log asynchronously to avoid blocking UI significantly, but ensure it happens
        const cleanSql = sql.replace(/'/g, "''");
        const cleanDetails = details.replace(/'/g, "''");
        const cleanTable = table ? `'${table}'` : 'NULL';

        // SKIP AUDIT LOGGING ON LEGACY KERNEL (Avoids implicit IO/INSERT overhead)
        if (!this.isLegacy) {
          const auditSql = `
            INSERT INTO memory._sys_audit_log (id, operation_type, target_table, details, affected_rows, sql_statement)
            VALUES (nextval('memory._sys_audit_seq'), '${type}', ${cleanTable}, '${cleanDetails}', ${affected}, '${cleanSql}');
          `;
          await this.conn.query(auditSql);
        }

        return rows;
      } catch (err: any) {
        throw err;
      }
    });
  }

  async getAuditLogs(limit: number = 100): Promise<any[]> {
    await this.waitForInit();
    if (!this.conn) return [];
    try {
      return await this.query(`SELECT * FROM memory._sys_audit_log ORDER BY log_time DESC LIMIT ${limit}`);
    } catch {
      try {
        return await this.query(`SELECT * FROM _sys_audit_log ORDER BY log_time DESC LIMIT ${limit}`);
      } catch (e) {
        console.warn('[DuckDB] Failed to load audit logs:', e);
        return [];
      }
    }
  }

  async clearAuditLogs(): Promise<void> {
    await this.waitForInit();
    if (!this.conn) return;
    try {
      await this.query(`DELETE FROM memory._sys_audit_log`);
    } catch {
      try {
        await this.query(`DELETE FROM _sys_audit_log`);
      } catch {}
    }
  }

  async getTables(): Promise<string[]> {
    try {
      const rows = await this.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = current_schema()
      `);
      return rows
        .map((r: any) => String(r.table_name || r.name || Object.values(r)[0] || ''))
        .filter((n: string) => Boolean(n) && !n.startsWith('_sys_'));
    } catch {
      const rows = await this.query("SHOW TABLES");
      return rows
        .map((r: any) => String(r.name || r.table_name || Object.values(r)[0] || ''))
        .filter((n: string) => Boolean(n) && !n.startsWith('_sys_'));
    }
  }

  async listTables(): Promise<string[]> {
    return this.getTables();
  }

  async attachProject(projectName: string): Promise<void> {
    await this.waitForInit();
    if (!this.conn) throw new Error("DB not connected");
    const alias = projectName.replace(/[^a-zA-Z0-9]/g, '_');
    await this.query(`CREATE SCHEMA IF NOT EXISTS "${alias}"`);
    console.log(`[Persistence] Created/Attached project schema ${alias}`);
  }

  async useProject(projectName: string): Promise<void> {
    if (!this.conn) return;
    const alias = projectName.replace(/[^a-zA-Z0-9]/g, '_');
    let targetSchema = alias;
    try {
      const res = await this.query(`SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE '%${alias}%'`);
      if (res && res.length > 0) {
        targetSchema = res[0].schema_name || alias;
      }
    } catch {}

    await this.conn.query(`SET schema = '${targetSchema}'`);
    if (this.readConn && this.readConn !== this.conn) {
      try {
        await this.readConn.query(`SET schema = '${targetSchema}'`);
      } catch {}
    }
    console.log(`[Persistence] Switched context to ${targetSchema}`);
  }

  async ontologyInit(): Promise<void> {
    return this.runInQueue(async () => {
      await this.waitForInit();
      if (!this.conn) return;
      const combinedDdl = ONTOLOGY_CREATE_STATEMENTS.filter(s => s.trim()).join(';\n');
      try {
        await this.conn.query(combinedDdl);
      } catch (e: any) {
        console.error('[DuckDB] Combined ontology DDL failed, retrying sequentially', e);
        for (const stmt of ONTOLOGY_CREATE_STATEMENTS) {
          if (stmt.trim()) {
            try {
              await this.conn.query(stmt);
            } catch (err: any) {
              console.error(`[DuckDB] DDL execution failed for: "${stmt}"`, err);
            }
          }
        }
      }
    });
  }

  async getTableSchema(tableName: string): Promise<any[]> {
    return this.query(`PRAGMA table_info('${tableName}')`);
  }

  async getExtensions(): Promise<any[]> {
    if (this.isLegacy) return [];
    try {
      return await this.query("SELECT * FROM duckdb_extensions()");
    } catch (e) {
      return [];
    }
  }

  async loadExtension(name: string): Promise<void> {
    if (this.isLegacy) {
      console.warn(`[DuckDB Safety] Blocked loadExtension('${name}') on Legacy Kernel`);
      return;
    }
    await this.query(`INSTALL '${name}'; LOAD '${name}';`);
  }

  async registerFileHandle(name: string, file: File): Promise<void> {
    await this.waitForInit();
    if (!this.db) throw new Error("Database not connected");
    await this.db.registerFileHandle(name, file, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);
  }

  async registerFileText(name: string, text: string): Promise<void> {
    await this.waitForInit();
    if (!this.db) throw new Error("Database not connected");
    await this.db.registerFileText(name, text);
  }

  async dropFile(name: string): Promise<void> {
    if (this.db) {
      try {
        await this.db.dropFile(name);
      } catch {}
    }
  }

  async getAvailableSchemas(): Promise<string[]> {
    try {
      const res = await this.query(`
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name NOT IN ('information_schema', 'pg_catalog')
        ORDER BY (schema_name = 'main') DESC, schema_name ASC
      `);
      const schemas = res.map(r => String(r.schema_name || '')).filter(Boolean);
      return schemas.length > 0 ? schemas : ['main'];
    } catch {
      return ['main'];
    }
  }

  async getTableList(schema = 'main'): Promise<string[]> {
    try {
      const res = await this.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = '${schema.replace(/'/g, "''")}'
      `);
      return res.map(r => String(r.table_name || ''));
    } catch {
      return [];
    }
  }

  async getTableColumnDefinitions(schema: string, tableName: string): Promise<{ name: string; type: string }[]> {
    try {
      const res = await this.query(`
        SELECT column_name as name, data_type as type 
        FROM information_schema.columns 
        WHERE table_schema = '${schema.replace(/'/g, "''")}' AND table_name = '${tableName.replace(/'/g, "''")}'
        ORDER BY ordinal_position
      `);
      return res.map(r => ({ name: String(r.name), type: String(r.type) }));
    } catch {
      return [];
    }
  }

  async importFile(file: File, tableName: string, options?: ImportOptions): Promise<string[]> {
    return this.runInQueue(async () => {
      if (!this.db || !this.conn) return [];

      const lowerName = file.name.toLowerCase();
      const isSql = lowerName.endsWith('.sql');
      if (isSql) {
        const sqlContent = await file.text();
        const statements = splitSqlStatements(sqlContent);
        for (const stmt of statements) {
          if (stmt.trim()) {
            await this.conn.query(stmt);
          }
        }

        const cleanSql = sqlContent.substring(0, 1000).replace(/'/g, "''");
        const auditSql = `INSERT INTO memory._sys_audit_log (id, operation_type, target_table, details, affected_rows, sql_statement) VALUES (nextval('memory._sys_audit_seq'), 'IMPORT', '${tableName}', 'Executed SQL script ${file.name}', 0, '${cleanSql}');`;
        try {
          await this.conn.query(auditSql);
        } catch {}
        this.dispatchSchemaChanged();
        return [tableName];
      }

      let tableExists = false;
      try {
        const checkRes = await this.conn.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = '${tableName.replace(/'/g, "''")}'`);
        const rows = checkRes.toArray();
        tableExists = rows.length > 0;
      } catch {
        tableExists = false;
      }

      if (tableExists && options?.conflictMode === 'replace') {
        try {
          await this.conn.query(`DROP TABLE IF EXISTS "${tableName}"`);
        } catch {}
      }

      const isAppend = options?.conflictMode === 'append' && tableExists;

      // Handle Excel formats (.xlsx, .xls)
      const isExcel = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls');
      if (isExcel) {
        let sheets: any[] = [];
        try {
          sheets = await workbookIO.readAllSheets(file);
        } catch (err: any) {
          throw new Error(`无法解析 Excel 文件 (${file.name}): ${err?.message || '请先转换为 CSV 格式'}`);
        }
        const nonBlankSheets = sheets.filter(s => !s.isEmpty);
        if (nonBlankSheets.length === 0) {
          throw new Error(`Excel 文件 (${file.name}) 中未发现包含有效数据的工作表`);
        }

        const createdTables: string[] = [];
        for (let i = 0; i < nonBlankSheets.length; i++) {
          const sheet = nonBlankSheets[i];
          const cleanSheetName = sheet.name.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_').replace(/^_+/, '') || `sheet_${i + 1}`;
          const targetTable = nonBlankSheets.length === 1 ? tableName : `${tableName}_${cleanSheetName}`;

          const virtualFileName = `${targetTable}_excel_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}.csv`;
          const virtualFile = new File([sheet.csvText], virtualFileName, { type: 'text/csv' });
          await this.db.registerFileHandle(virtualFileName, virtualFile, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);

          const sql = isAppend
            ? `INSERT INTO "${targetTable}" SELECT * FROM read_csv_auto('${virtualFileName}')`
            : `CREATE TABLE IF NOT EXISTS "${targetTable}" AS SELECT * FROM read_csv_auto('${virtualFileName}')`;

          await this.conn.query(sql);
          createdTables.push(targetTable);
          const auditSql = `INSERT INTO memory._sys_audit_log (id, operation_type, target_table, details, affected_rows, sql_statement) VALUES (nextval('memory._sys_audit_seq'), 'IMPORT', '${targetTable}', 'Imported Excel sheet ${sheet.name} from ${file.name}', 0, '${sql.replace(/'/g, "''")}');`;
          try { await this.conn.query(auditSql); } catch {}
        }

        this.dispatchSchemaChanged();
        return createdTables;
      }

      await this.db.registerFileHandle(file.name, file, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);

      const isJson = lowerName.endsWith('.json') || lowerName.endsWith('.jsonl');
      const isTsv = lowerName.endsWith('.tsv') || lowerName.endsWith('.tab');
      const isCsv = lowerName.endsWith('.csv') || lowerName.endsWith('.txt');

      let selectSource = '';

      if (isJson) {
        selectSource = `read_json_auto('${file.name}')`;
      } else if (options && (isCsv || isTsv || options.delimiter)) {
        const opts: string[] = [];
        if (options.header !== undefined) opts.push(options.header ? "header=true" : "header=false");
        const delim = options.delimiter || (isTsv ? '\\t' : undefined);
        if (delim) opts.push(`delim='${delim === '\t' ? '\\t' : delim}'`);
        if (options.quote) opts.push(`quote='${options.quote}'`);
        if (options.dateFormat) opts.push(`dateformat='${options.dateFormat}'`);
        const optsStr = opts.length > 0 ? `, ${opts.join(', ')}` : '';
        selectSource = `read_csv_auto('${file.name}'${optsStr})`;
      } else if (isTsv) {
        selectSource = `read_csv_auto('${file.name}', delim='\\t', header=true)`;
      } else if (isCsv) {
        selectSource = `read_csv_auto('${file.name}')`;
      } else {
        // Default to Parquet
        selectSource = `'${file.name}'`;
      }

      const sql = isAppend
        ? `INSERT INTO "${tableName}" SELECT * FROM ${selectSource}`
        : `CREATE TABLE "${tableName}" AS SELECT * FROM ${selectSource}`;

      await this.conn.query(sql);

      // Audit
      const auditSql = `INSERT INTO memory._sys_audit_log (id, operation_type, target_table, details, affected_rows, sql_statement) VALUES (nextval('memory._sys_audit_seq'), 'IMPORT', '${tableName}', 'Imported file ${file.name}', 0, '${sql.replace(/'/g, "''")}');`;
      await this.conn.query(auditSql);

      this.dispatchSchemaChanged();
      return [tableName];
    });
  }

  async importText(text: string, tableName: string, options?: ImportOptions): Promise<void> {
    return this.runInQueue(async () => {
      if (!this.db || !this.conn) return;

      let tableExists = false;
      try {
        const checkRes = await this.conn.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = '${tableName.replace(/'/g, "''")}'`);
        const rows = checkRes.toArray();
        tableExists = rows.length > 0;
      } catch {
        tableExists = false;
      }

      if (tableExists && options?.conflictMode === 'replace') {
        try {
          await this.conn.query(`DROP TABLE IF EXISTS "${tableName}"`);
        } catch {}
      }

      const isAppend = options?.conflictMode === 'append' && tableExists;

      const fileName = `paste_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.csv`;
      const file = new File([text], fileName, { type: 'text/csv' });

      await this.db.registerFileHandle(file.name, file, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);

      let selectSource = '';
      if (options) {
        const opts: string[] = [];
        if (options.header !== undefined) opts.push(options.header ? "header=true" : "header=false");
        const delim = options.delimiter || (options.delimiter === '' ? '' : undefined);
        if (delim) opts.push(`delim='${delim === '\t' ? '\\t' : delim}'`);
        if (options.quote) opts.push(`quote='${options.quote}'`);
        if (options.dateFormat) opts.push(`dateformat='${options.dateFormat}'`);
        const optsStr = opts.length > 0 ? `, ${opts.join(', ')}` : '';
        selectSource = `read_csv_auto('${fileName}'${optsStr})`;
      } else {
        selectSource = `read_csv_auto('${fileName}')`;
      }

      const sql = isAppend
        ? `INSERT INTO "${tableName}" SELECT * FROM ${selectSource}`
        : `CREATE TABLE "${tableName}" AS SELECT * FROM ${selectSource}`;

      await this.conn.query(sql);

      // Audit
      const auditSql = `INSERT INTO memory._sys_audit_log (id, operation_type, target_table, details, affected_rows, sql_statement) VALUES (nextval('memory._sys_audit_seq'), 'IMPORT', '${tableName}', 'Imported from clipboard', 0, '${sql.replace(/'/g, "''")}');`;
      await this.conn.query(auditSql);

      this.dispatchSchemaChanged();
    });
  }

  async probeFile(file: File): Promise<{
    name: string;
    sizeBytes: number;
    selectSource: string;
    columns: { name: string; type: string }[];
    previewRows: any[];
    elapsedMs: number;
  }> {
    await this.waitForInit();
    if (!this.db || !this.conn) throw new Error('DuckDB 引擎未初始化');

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    let virtualFileName = file.name;
    let selectSource = '';

    if (isExcel) {
      const sheets = await workbookIO.readAllSheets(file);
      const activeSheet = sheets.find(s => !s.isEmpty) || sheets[0];
      if (!activeSheet || !activeSheet.csvText) {
        throw new Error('Excel 文件中未发现包含数据的工作表');
      }
      virtualFileName = `probe_excel_${Date.now()}.csv`;
      const virtualFile = new File([activeSheet.csvText], virtualFileName, { type: 'text/csv' });
      await this.db.registerFileHandle(virtualFileName, virtualFile, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);
      selectSource = `read_csv_auto('${virtualFileName}')`;
    } else {
      await this.db.registerFileHandle(file.name, file, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);
      if (file.name.endsWith('.json')) {
        selectSource = `read_json_auto('${file.name}')`;
      } else if (file.name.endsWith('.tsv') || file.name.endsWith('.tab')) {
        selectSource = `read_csv_auto('${file.name}', delim='\\t', header=true)`;
      } else if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
        selectSource = `read_csv_auto('${file.name}')`;
      } else {
        selectSource = `'${file.name}'`;
      }
    }

    const start = performance.now();
    const schemaRes = await this.query(`DESCRIBE SELECT * FROM ${selectSource};`);
    const columns = (schemaRes || []).map((r: any) => ({
      name: String(r.column_name || r.name || ''),
      type: String(r.column_type || r.type || 'UNKNOWN'),
    }));
    const previewRows = await this.query(`SELECT * FROM ${selectSource} LIMIT 5;`);
    const elapsedMs = +(performance.now() - start).toFixed(2);

    return {
      name: file.name,
      sizeBytes: file.size,
      selectSource,
      columns,
      previewRows: previewRows || [],
      elapsedMs,
    };
  }

  async probeTable(tableName: string): Promise<{
    name: string;
    rowCount: number;
    selectSource: string;
    columns: { name: string; type: string }[];
    previewRows: any[];
    elapsedMs: number;
  }> {
    await this.waitForInit();
    if (!this.conn) throw new Error('DuckDB 引擎未就绪');

    const start = performance.now();
    const cleanTable = tableName.replace(/"/g, '""');
    const schemaRes = await this.query(`DESCRIBE SELECT * FROM "${cleanTable}";`);
    const columns = (schemaRes || []).map((r: any) => ({
      name: String(r.column_name || r.name || ''),
      type: String(r.column_type || r.type || 'UNKNOWN'),
    }));
    const previewRows = await this.query(`SELECT * FROM "${cleanTable}" LIMIT 5;`);
    let rowCount = 0;
    try {
      const countRes = await this.query(`SELECT COUNT(*) as total_rows FROM "${cleanTable}";`);
      if (countRes && countRes.length > 0) {
        rowCount = Number(countRes[0].total_rows || 0);
      }
    } catch {}
    const elapsedMs = +(performance.now() - start).toFixed(2);

    return {
      name: tableName,
      rowCount,
      selectSource: `"${cleanTable}"`,
      columns,
      previewRows: previewRows || [],
      elapsedMs,
    };
  }

  async probeText(text: string): Promise<{
    name: string;
    sizeBytes: number;
    selectSource: string;
    columns: { name: string; type: string }[];
    previewRows: any[];
    elapsedMs: number;
  }> {
    await this.waitForInit();
    if (!this.db || !this.conn) throw new Error('DuckDB 引擎未初始化');

    const fileName = `clipboard_probe_${Date.now()}.csv`;
    const file = new File([text], fileName, { type: 'text/csv' });
    await this.db.registerFileHandle(fileName, file, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);

    const selectSource = `read_csv_auto('${fileName}')`;
    const start = performance.now();
    const schemaRes = await this.query(`DESCRIBE SELECT * FROM ${selectSource};`);
    const columns = (schemaRes || []).map((r: any) => ({
      name: String(r.column_name || r.name || ''),
      type: String(r.column_type || r.type || 'UNKNOWN'),
    }));
    const previewRows = await this.query(`SELECT * FROM ${selectSource} LIMIT 5;`);
    const elapsedMs = +(performance.now() - start).toFixed(2);

    return {
      name: '剪贴板数据',
      sizeBytes: new Blob([text]).size,
      selectSource,
      columns,
      previewRows: previewRows || [],
      elapsedMs,
    };
  }

  async exportDatabase(): Promise<Blob> {
    if (!this.conn) throw new Error("DB not ready");
    // Simplistic dump for WASM: Export all user tables as JSON
    const tables = await this.getTables();
    const dump: any = { tables: {} };

    for (const t of tables) {
      const data = await this.query(`SELECT * FROM "${t}"`);
      dump.tables[t] = data;
    }

    return new Blob([JSON.stringify(dump, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2)], { type: 'application/json' });
  }

  // Schema 导出 - 导出 DDL（CREATE TABLE/VIEW/SEQUENCE）
  async exportSchema(): Promise<string> {
    if (!this.conn) throw new Error("DB not ready");

    let ddl = `-- DuckDB Schema Export\n-- Generated: ${new Date().toISOString()}\n\n`;
    ddl += `-- ========================================\n`;
    ddl += `-- SCHEMA: duckdb_schema.sql\n`;
    ddl += `-- ========================================\n\n`;

    // 1. 导出 Tables
    const tables = await this.getTables();
    if (tables.length > 0) {
      ddl += `-- ----------------------------------------\n`;
      ddl += `-- TABLES\n`;
      ddl += `-- ----------------------------------------\n\n`;

      for (const tableName of tables) {
        const columns = await this.conn.query(`PRAGMA table_info('${tableName}')`);
        const cols = columns.toArray();

        ddl += `CREATE TABLE "${tableName}" (\n`;
        const colDefs: string[] = [];
        for (const col of cols) {
          const colName = col.name;
          let colType = col.type || 'VARCHAR';
          // DuckDB 类型映射
          colType = colType.replace(/^INTEGER$/i, 'INTEGER')
            .replace(/^BIGINT$/i, 'BIGINT')
            .replace(/^DOUBLE$/i, 'DOUBLE')
            .replace(/^BOOLEAN$/i, 'BOOLEAN')
            .replace(/^DATE$/i, 'DATE')
            .replace(/^TIMESTAMP$/i, 'TIMESTAMP')
            .replace(/^VARCHAR$/i, 'VARCHAR');

          let colDef = `  "${colName}" ${colType}`;
          if (col.notnull) colDef += ' NOT NULL';
          if (col.dflt_value !== null) {
            colDef += ` DEFAULT ${col.dflt_value}`;
          }
          colDefs.push(colDef);
        }
        ddl += colDefs.join(',\n');
        ddl += '\n);\n\n';
      }
    }

    // 2. 导出 Views
    try {
      const views = await this.conn.query("SELECT table_name FROM information_schema.views WHERE table_schema = 'main'");
      const viewRows = views.toArray();
      if (viewRows.length > 0) {
        ddl += `-- ----------------------------------------\n`;
        ddl += `-- VIEWS\n`;
        ddl += `-- ----------------------------------------\n\n`;

        for (const row of viewRows) {
          const viewName = row.table_name;
          try {
            const viewDef = await this.conn.query(`SELECT sql FROM sqlite_master WHERE type='view' AND name='${viewName}'`);
            const defRows = viewDef.toArray();
            if (defRows.length > 0 && defRows[0].sql) {
              ddl += `CREATE OR REPLACE VIEW "${viewName}" AS\n${defRows[0].sql};\n\n`;
            }
          } catch (e) {
            // Skip if cannot get view definition
          }
        }
      }
    } catch (e) {
      // Views may not be supported
    }

    // 3. 导出 Sequences
    try {
      const seqs = await this.conn.query("SELECT sequence_name FROM information_schema.sequences");
      const seqRows = seqs.toArray();
      if (seqRows.length > 0) {
        ddl += `-- ----------------------------------------\n`;
        ddl += `-- SEQUENCES\n`;
        ddl += `-- ----------------------------------------\n\n`;

        for (const row of seqRows) {
          const seqName = row.sequence_name;
          ddl += `CREATE SEQUENCE "${seqName}";\n`;
        }
        ddl += '\n';
      }
    } catch (e) {
      // Sequences may not be supported
    }

    return ddl;
  }

  // 数据导出为 SQL（INSERT 语句）
  async exportDataAsSQL(tables?: string[]): Promise<string> {
    if (!this.conn) throw new Error("DB not ready");

    let sql = `-- DuckDB Data Export (INSERT Statements)\n-- Generated: ${new Date().toISOString()}\n\n`;
    sql += `-- ========================================\n`;
    sql += `-- DATA: duckdb_data.sql\n`;
    sql += `-- ========================================\n\n`;

    const targetTables = tables || await this.getTables();

    for (const tableName of targetTables) {
      const data = await this.query(`SELECT * FROM "${tableName}"`);
      const rows = Array.isArray(data) ? data : [data];

      if (rows.length === 0) {
        sql += `-- Table "${tableName}" is empty\n\n`;
        continue;
      }

      sql += `-- ----------------------------------------\n`;
      sql += `-- TABLE: ${tableName} (${rows.length} rows)\n`;
      sql += `-- ----------------------------------------\n\n`;

      // 获取列名
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      if (columns.length === 0) continue;

      // 生成 INSERT 语句（每 100 行一条，提高性能）
      const batchSize = 100;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const values: string[] = [];

        for (const row of batch) {
          const vals = columns.map(col => this.escapeLiteral(row[col])).join(', ');
          values.push(`(${vals})`);
        }

        sql += `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES\n`;
        sql += values.join(',\n');
        sql += ';\n\n';
      }
    }

    return sql;
  }

  // 完整备份 - Schema + Data
  async exportFullBackup(format: 'sql' | 'json' = 'sql'): Promise<Blob> {
    if (!this.conn) throw new Error("DB not ready");

    if (format === 'sql') {
      const schema = await this.exportSchema();
      const data = await this.exportDataAsSQL();
      return new Blob([schema + '\n' + data], { type: 'text/plain;charset=utf-8' });
    } else {
      // JSON 格式
      const tables = await this.getTables();
      const dump: any = {
        metadata: {
          generated: new Date().toISOString(),
          type: 'full_backup',
          tables: tables.length
        },
        tables: {}
      };

      for (const t of tables) {
        const data = await this.query(`SELECT * FROM "${t}"`);
        dump.tables[t] = data;
      }

      return new Blob([JSON.stringify(dump, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2)], { type: 'application/json' });
    }
  }

  async exportParquet(query: string, filename: string): Promise<Blob> {
    if (!this.conn || !this.db) throw new Error("DB not ready");
    const tempPath = `temp_${Date.now()}.parquet`;

    // Execute COPY to virtual FS
    await this.conn.query(`COPY (${query}) TO '${tempPath}' (FORMAT PARQUET)`);

    // Read buffer from virtual FS
    const buffer = await this.db.copyFileToBuffer(tempPath);

    // Cleanup
    await this.conn.query(`DROP TABLE IF EXISTS "${tempPath}"`);

    return new Blob([buffer as any], { type: 'application/vnd.apache.parquet' });
  }

  // --- CRUD Helpers ---

  escapeLiteral(value: any): string {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'number') return Number.isFinite(value) ? value.toString() : 'NULL';
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    if (value instanceof Date) return `'${value.toISOString()}'`;
    // BigInt handling
    if (typeof value === 'bigint') return value.toString();

    // Standard SQL string escape: escape single quotes by doubling them
    return `'${String(value).replace(/'/g, "''")}'`;
  }

  async insertRow(table: string, data: Record<string, any>) {
    const safeTable = `"${table}"`;
    const colKeys = Object.keys(data);

    if (colKeys.length === 0) {
      try {
        const sql = `INSERT INTO ${safeTable} DEFAULT VALUES`;
        return await this.executeAndAudit(sql, 'INSERT', table, 'Inserted new row');
      } catch (err: any) {
        // If DEFAULT VALUES fails (e.g. NOT NULL column without default constraint), inspect schema
        try {
          const schema = await this.getTableSchema(table);
          const autoData: Record<string, any> = {};
          for (const col of schema) {
            const colName = col.name;
            const colType = (col.type || '').toUpperCase();
            const isPk = Boolean(col.pk);
            const notNull = Boolean(col.notnull);
            const hasDefault = col.dflt_value !== null && col.dflt_value !== undefined;

            if (hasDefault) continue;

            if (isPk && (colType.includes('INT') || colType.includes('BIGINT') || colType.includes('SERIAL'))) {
              try {
                const maxRes = await this.query(`SELECT COALESCE(MAX("${colName}"), 0) + 1 AS next_id FROM ${safeTable}`);
                autoData[colName] = maxRes[0]?.next_id ?? 1;
              } catch {
                autoData[colName] = 1;
              }
            } else if (notNull || isPk) {
              if (colType.includes('INT') || colType.includes('DOUBLE') || colType.includes('FLOAT') || colType.includes('NUMERIC') || colType.includes('DECIMAL')) {
                autoData[colName] = 0;
              } else if (colType.includes('BOOL')) {
                autoData[colName] = false;
              } else if (colType.includes('TIMESTAMP') || colType.includes('DATE')) {
                autoData[colName] = new Date().toISOString();
              } else {
                autoData[colName] = `new_${colName}`;
              }
            }
          }
          if (Object.keys(autoData).length > 0) {
            const cols = Object.keys(autoData).map(c => `"${c}"`).join(', ');
            const vals = Object.values(autoData).map(v => this.escapeLiteral(v)).join(', ');
            const fallbackSql = `INSERT INTO ${safeTable} (${cols}) VALUES (${vals})`;
            return await this.executeAndAudit(fallbackSql, 'INSERT', table, 'Inserted new row (auto-defaults)');
          }
        } catch {
          // fallback to throw original error
        }
        throw err;
      }
    }

    const cols = Object.keys(data).map(c => `"${c}"`).join(', ');
    const vals = Object.values(data).map(v => this.escapeLiteral(v)).join(', ');
    const sql = `INSERT INTO ${safeTable} (${cols}) VALUES (${vals})`;
    return this.executeAndAudit(sql, 'INSERT', table, 'Inserted new row');
  }

  async updateRow(table: string, pkCol: string, pkVal: any, col: string, newVal: any) {
    const safeTable = `"${table}"`;
    const safePkVal = this.escapeLiteral(pkVal);
    const safeNewVal = this.escapeLiteral(newVal);

    const sql = `UPDATE ${safeTable} SET "${col}" = ${safeNewVal} WHERE "${pkCol}" = ${safePkVal}`;
    return this.executeAndAudit(sql, 'UPDATE', table, `Updated ${col} for row ${pkCol}=${pkVal}`);
  }

  async deleteRow(table: string, pkCol: string, pkVal: any) {
    const safeTable = `"${table}"`;
    const safePkVal = this.escapeLiteral(pkVal);

    const sql = `DELETE FROM ${safeTable} WHERE "${pkCol}" = ${safePkVal}`;
    return this.executeAndAudit(sql, 'DELETE', table, `Deleted row ${pkCol}=${pkVal}`);
  }

  async deleteRows(table: string, pkCol: string, pkVals: any[]) {
    if (pkVals.length === 0) return;
    const safeTable = `"${table}"`;
    const safeVals = pkVals.map(v => this.escapeLiteral(v)).join(', ');
    const sql = `DELETE FROM ${safeTable} WHERE "${pkCol}" IN (${safeVals})`;
    return this.executeAndAudit(sql, 'DELETE', table, `Deleted ${pkVals.length} rows`);
  }

  async addColumn(table: string, colName: string, colType: string) {
    const safeTable = `"${table}"`;
    const sql = `ALTER TABLE ${safeTable} ADD COLUMN "${colName}" ${colType}`;
    return this.executeAndAudit(sql, 'ALTER', table, `Added column ${colName}`);
  }

  async dropColumn(table: string, colName: string) {
    const safeTable = `"${table}"`;
    const sql = `ALTER TABLE ${safeTable} DROP COLUMN "${colName}"`;
    return this.executeAndAudit(sql, 'ALTER', table, `Dropped column ${colName}`);
  }

  async renameColumn(table: string, oldName: string, newName: string) {
    const safeTable = `"${table}"`;
    const sql = `ALTER TABLE ${safeTable} RENAME COLUMN "${oldName}" TO "${newName}"`;
    return this.executeAndAudit(sql, 'ALTER', table, `Renamed column ${oldName} to ${newName}`);
  }

  async alterColumnType(table: string, colName: string, newType: string) {
    const safeTable = `"${table}"`;
    // DuckDB allows casting: ALTER TABLE t ALTER COLUMN c TYPE type
    const sql = `ALTER TABLE ${safeTable} ALTER COLUMN "${colName}" TYPE ${newType}`;
    return this.executeAndAudit(sql, 'ALTER', table, `Changed column ${colName} type to ${newType}`);
  }

  async renameTable(oldName: string, newName: string) {
    const sql = `ALTER TABLE "${oldName}" RENAME TO "${newName}"`;
    return this.executeAndAudit(sql, 'ALTER', oldName, `Renamed table to ${newName}`);
  }

  async dropTable(tableName: string) {
    const qualified = tableName.includes('.')
      ? tableName.split('.').map(p => `"${p.replace(/"/g, '""')}"`).join('.')
      : `"${tableName.replace(/"/g, '""')}"`;
    try {
      if (typeof this.getViews === 'function') {
        const views = await this.getViews().catch(() => []);
        if (Array.isArray(views) && (views.includes(tableName) || views.some(v => v.toLowerCase() === tableName.toLowerCase())) && typeof this.dropView === 'function') {
          return await this.dropView(tableName);
        }
      }
      const sql = `DROP TABLE ${qualified}`;
      return await this.executeAndAudit(sql, 'DROP', tableName, 'Dropped table');
    } catch (err: any) {
      if (err?.message && (/view/i.test(err.message) || /not a table/i.test(err.message)) && typeof this.dropView === 'function') {
        return await this.dropView(tableName);
      }
      throw err;
    }
  }

  async createTable(tableName: string, columns: { name: string, type: string, pk?: boolean }[]) {
    const colDefs = columns.map(c => `"${c.name}" ${c.type}${c.pk ? ' PRIMARY KEY' : ''}`).join(', ');
    const sql = `CREATE TABLE "${tableName}" (${colDefs})`;
    return this.executeAndAudit(sql, 'CREATE', tableName, 'Created new table');
  }

  async getColumnStats(table: string, col: string): Promise<ColumnStats> {
    if (!this.conn) throw new Error("DB not connected");

    const sql = `
        SELECT 
            MIN("${col}") as min_val,
            MAX("${col}") as max_val,
            COUNT(*) as total,
            COUNT("${col}") as non_null_count,
            approx_count_distinct("${col}") as distinct_count
        FROM "${table}"
      `;

    const res = await this.query(sql);
    const row = res[0];

    // Top K for categorical context
    let topK: any[] = [];
    try {
      const topKSql = `SELECT "${col}" as value, COUNT(*) as count FROM "${table}" GROUP BY "${col}" ORDER BY count DESC LIMIT 5`;
      topK = await this.query(topKSql);
    } catch (e) { /* ignore */ }

    return {
      min: row.min_val,
      max: row.max_val,
      total_count: Number(row.total),
      null_count: Number(row.total) - Number(row.non_null_count),
      distinct_count: Number(row.distinct_count),
      top_k: topK
    };
  }

  // --- Phase 1: Grounding Methods ---

  async createStagingTable(csvContent: string, originalFileName: string): Promise<string> {
    if (!this.conn || !this.db) throw new Error("DB not ready");

    // Sanitize filename for table use
    const safeName = originalFileName.split('.')[0].replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const stagingName = `stg_${safeName}_${Math.floor(Date.now() / 1000)}`;
    const tempFileName = `${stagingName}.csv`;

    // Register file in VFS
    await this.db.registerFileText(tempFileName, csvContent);

    // Create table (auto-detect)
    // read_csv_auto is robust for most formats
    const sql = `CREATE TABLE "${stagingName}" AS SELECT * FROM read_csv_auto('${tempFileName}')`;
    await this.executeAndAudit(sql, 'CREATE', stagingName, `Created staging table from ${originalFileName}`);

    // Cleanup VFS to save memory
    // await this.db.registerFileText(tempFileName, ''); // Clear content? Or keep for reference?
    // Keeping it might be useful, but let's rely on the table now.

    return stagingName;
  }



  async getEnrichedProfile(table: string): Promise<EnrichedColumnStats[]> {
    if (!this.conn) throw new Error("DB not connected");

    // 1. Get basic summary using SUMMARIZE
    const summary = await this.query(`SUMMARIZE "${table}"`);

    // 2. We need more for Deep Metrics (Skewness, Kurtosis, Gini)
    // We'll iterate by column to get specific advanced stats if needed
    const enrichedStats: EnrichedColumnStats[] = [];

    for (const row of summary) {
      const colName = row.column_name;
      const colType = String(row.column_type).toUpperCase();
      const isNumeric = colType.includes('INT') || colType.includes('DOUBLE') || colType.includes('FLOAT') || colType.includes('DECIMAL');

      let advanced: any = {};
      let histogram: any[] = [];

      if (isNumeric) {
        try {
          // 2.1 Advanced Distribution Metrics
          const advSql = `
            SELECT 
              skewness("${colName}") as skew,
              kurtosis("${colName}") as kurt,
              entropy("${colName}") as entropy,
              quantile_cont("${colName}", 0.01) as p01,
              quantile_cont("${colName}", 0.99) as p99
            FROM "${table}"
          `;
          const advRes = await this.query(advSql);
          advanced = advRes[0];

          // 2.2 Histogram (20 bins) for Bimodality Check
          const minVal = Number(row.min);
          const maxVal = Number(row.max);

          if (maxVal > minVal) {
            const bucketSize = (maxVal - minVal) / 20;
            const histSql = `
                SELECT 
                  floor(("${colName}" - ${minVal}) / ${bucketSize}) * ${bucketSize} + ${minVal} as bin_start,
                  COUNT(*) as count
                FROM "${table}"
                WHERE "${colName}" IS NOT NULL
                GROUP BY 1
                ORDER BY 1
             `;
            const histRes = await this.query(histSql);
            histogram = histRes.map(h => ({
              bin: Number(h.bin_start),
              count: Number(h.count)
            }));
          }
        } catch (e) { /* ignore if function not available or fail */ }
      }

      // Collect Top K for categorical context
      let topK: any[] = [];
      try {
        const topKSql = `SELECT "${colName}" as value, COUNT(*) as count FROM "${table}" GROUP BY 1 ORDER BY 2 DESC LIMIT 10`;
        topK = await this.query(topKSql);
      } catch (e) { }

      const safeVal = (v: any) => typeof v === 'bigint' ? v.toString() : v;
      const safeNum = (v: any) => typeof v === 'bigint' ? Number(v) : Number(v);

      enrichedStats.push({
        name: colName,
        type: colType,
        min: safeVal(row.min),
        max: safeVal(row.max),
        avg: safeNum(row.avg),
        std: safeNum(row.std),
        q25: safeNum(row.q25),
        q50: safeNum(row.q50),
        q75: safeNum(row.q75),
        total_count: safeNum(row.count),
        null_count: safeNum(row.count) * (safeNum(row.null_percentage) / 100),
        distinct_count: safeNum(row.approx_unique),
        skew: safeNum(advanced.skew),
        kurt: safeNum(advanced.kurt),
        entropy: safeNum(advanced.entropy),
        p01: safeNum(advanced.p01),
        p99: safeNum(advanced.p99),
        histogram: histogram,
        top_k: topK.map(t => ({ value: safeVal(t.value), count: safeNum(t.count) }))
      });
    }

    return enrichedStats;
  }

  async getMetricScorecardQuery(table: string, metricCol: string, timeCol?: string): Promise<any> {
    if (!this.conn) throw new Error("Database not connected");

    const baseSql = `
      SELECT 
        SUM(TRY_CAST("${metricCol}" AS DOUBLE)) as total,
        AVG(TRY_CAST("${metricCol}" AS DOUBLE)) as mean,
        MEDIAN(TRY_CAST("${metricCol}" AS DOUBLE)) as median,
        STDDEV(TRY_CAST("${metricCol}" AS DOUBLE)) as stddev,
        MIN(TRY_CAST("${metricCol}" AS DOUBLE)) as min,
        MAX(TRY_CAST("${metricCol}" AS DOUBLE)) as max
      FROM "${table}"
    `;
    const baseStats = await this.query(baseSql);
    const result: any = { stats: baseStats[0] };

    if (timeCol) {
      try {
        // Robust time handling: Support both Timestamp/Date strings and Epoch Integers
        // If it fails, strictly return empty list to avoid crashing
        const isNumericTime = await this.query(`SELECT typeof("${timeCol}") as t FROM "${table}" LIMIT 1`).then(r => r[0].t.includes('INT'));

        let timeExpr = `CAST("${timeCol}" AS TIMESTAMP)`;
        if (isNumericTime) {
          // Assume Epoch Seconds/Millis? Or just ignore? 
          // If 'age' (INT) is passed, converting to timestamp is wrong.
          // Safe fallback: Don't trend if it's integer unless we are sure.
          // But let's try epoch_ms for bigints just in case
          timeExpr = `epoch_ms("${timeCol}")`;
        }

        const trendSql = `
          SELECT 
            strftime('%Y-%m', ${timeExpr}) as month,
            SUM(TRY_CAST("${metricCol}" AS DOUBLE)) as total
          FROM "${table}"
          WHERE ${timeExpr} IS NOT NULL
          GROUP BY 1
          ORDER BY 1
        `;
        result.trend = await this.query(trendSql);
      } catch (e) {
        console.warn("Trend Calc Failed", e);
      }
    }

    return result;
  }

  async getCorrelationMatrix(table: string, numericCols: string[]): Promise<any> {
    if (!this.conn || numericCols.length < 2) return { columns: numericCols, matrix: [] };

    const matrix: number[][] = [];
    for (const colA of numericCols) {
      const row: number[] = [];
      for (const colB of numericCols) {
        if (colA === colB) {
          row.push(1);
          continue;
        }
        try {
          const sql = `SELECT corr("${colA}", "${colB}") as score FROM "${table}"`;
          const res = await this.query(sql);
          row.push(Number(res[0].score) || 0);
        } catch (e) {
          row.push(0);
        }
      }
      matrix.push(row);
    }
    return { columns: numericCols, matrix };
  }

  async getDriverAnalysis(table: string, metricCol: string, dimCol: string): Promise<any> {
    if (!this.conn) throw new Error("DB not connected");

    const sql = `
      WITH total AS (SELECT SUM("${metricCol}") as grand_total FROM "${table}"),
      grouped AS (
        SELECT 
          "${dimCol}" as value, 
          SUM("${metricCol}") as val_sum 
        FROM "${table}" 
        GROUP BY 1
      )
      SELECT 
        value, 
        val_sum / grand_total as contribution
      FROM grouped, total
      ORDER BY contribution DESC
      LIMIT 10
    `;

    const results = await this.query(sql);
    const avgContrib = 1 / Math.max(1, results.length);

    return {
      metric: metricCol,
      dimension: dimCol,
      drivers: results.map((r: any) => ({
        value: String(r.value),
        contribution: Number(r.contribution),
        impact: r.contribution > avgContrib * 1.5 ? 'positive' : r.contribution < avgContrib * 0.5 ? 'negative' : 'neutral'
      }))
    };
  }

  // --- M1: Issue-003 Hierarchy/FK Detection ---
  async detectHierarchies(table: string, columns: string[]): Promise<any[]> {
    if (!this.conn || columns.length < 2) return [];

    // O(N^2) checks, limit to small number of categorical cols
    // Only check columns with reasonable distinct count (<1000)
    const relationships: any[] = [];

    for (const child of columns) {
      for (const parent of columns) {
        if (child === parent) continue;

        try {
          const sql = `
               SELECT COUNT(*) as violations
               FROM (
                  SELECT "${child}", COUNT(DISTINCT "${parent}") as p_count
                  FROM "${table}"
                  GROUP BY 1
                  HAVING p_count > 1
               )
            `;
          const res = await this.query(sql);
          const violations = Number(res[0].violations);

          if (violations === 0) {
            const distinctSql = `
                  SELECT 
                    approx_count_distinct("${child}") as c_count, 
                    approx_count_distinct("${parent}") as p_count 
                  FROM "${table}"
               `;
            const counts = await this.query(distinctSql);
            const cCount = Number(counts[0].c_count);
            const pCount = Number(counts[0].p_count);

            if (cCount > pCount) {
              relationships.push({
                child,
                parent,
                type: 'hierarchy',
                confidence: 1.0
              });
            }
          }
        } catch (e) {
          // Ignore errors
        }
      }
    }
    return relationships;
  }

  // --- M4: Persistence (OPFS) ---

  /**
   * lists available persistent database files in OPFS.
   */
  async listProjects(): Promise<string[]> {
    if ('storage' in navigator && 'getDirectory' in navigator.storage) {
      try {
        const root = await navigator.storage.getDirectory();
        const projects: string[] = [];
        // @ts-ignore - iterate is valid in modern browsers
        for await (const [name, handle] of root.entries()) {
          if (name.endsWith('.duckdb')) {
            projects.push(name.replace('.duckdb', ''));
          }
        }
        return projects;
      } catch (e) {
        console.warn("[Persistence] OPFS List Failed", e);
        return [];
      }
    }
    return [];
  }

  async detachProject(projectName: string): Promise<void> {
    if (!this.conn) return;
    const alias = projectName.replace(/[^a-zA-Z0-9]/g, '_');
    try {
      await this.conn.query(`DETACH "${alias}"`);
    } catch (e) { /* ignore */ }
  }

  async deleteProject(projectName: string): Promise<void> {
    const dbName = projectName.endsWith('.duckdb') ? projectName : `${projectName}.duckdb`;
    const alias = projectName.replace(/[^a-zA-Z0-9]/g, '_');

    // Step 1: Detach from DuckDB first to release file handle
    if (this.conn) {
      try {
        await this.conn.query(`DETACH DATABASE IF EXISTS "${alias}"`);
        console.log(`[Persistence] Detached ${alias} from DuckDB.`);
      } catch (e) {
        // Database might not be attached, that's fine
        console.warn(`[Persistence] Detach warning (may be expected):`, e);
      }
    }

    // Step 2: Drop the file registration from DuckDB's VFS cache
    if (this.db) {
      try {
        await this.db.dropFile(dbName);
        console.log(`[Persistence] Dropped ${dbName} from VFS cache.`);
      } catch (e) {
        console.warn(`[Persistence] dropFile warning (may be expected):`, e);
      }
    }

    // Step 3: Delete from OPFS
    if ('storage' in navigator && 'getDirectory' in navigator.storage) {
      try {
        const root = await navigator.storage.getDirectory();
        await root.removeEntry(dbName);
        console.log(`[Persistence] Deleted ${dbName} from OPFS.`);
      } catch (e) {
        console.warn(`[Persistence] OPFS delete failed:`, e);
      }
    }
  }

  /**
   * Emergency cleanup: Clears ALL project files from OPFS.
   * Use this when corruption issues persist.
   */
  async clearAllProjects(): Promise<void> {
    console.warn('[Persistence] Clearing ALL projects from OPFS...');

    // First reset DuckDB to release all handles
    await this.reset();

    if ('storage' in navigator && 'getDirectory' in navigator.storage) {
      try {
        const root = await navigator.storage.getDirectory();
        const toDelete: string[] = [];

        // @ts-ignore
        for await (const [name] of root.entries()) {
          if (name.endsWith('.duckdb')) {
            toDelete.push(name);
          }
        }

        for (const name of toDelete) {
          try {
            await root.removeEntry(name);
            console.log(`[Persistence] Deleted ${name}`);
          } catch (e) {
            console.warn(`[Persistence] Failed to delete ${name}:`, e);
          }
        }

        console.log(`[Persistence] Cleared ${toDelete.length} project files.`);
      } catch (e) {
        console.error('[Persistence] clearAllProjects failed:', e);
      }
    }
  }

  // --- Epic-008: Session Management ---
  async initSessionTable() {
    if (!this.conn) return;
    try {
      await this.conn.query(`
        CREATE TABLE IF NOT EXISTS _sys_kv_store (
          key VARCHAR PRIMARY KEY,
          value JSON,
          updated_at TIMESTAMP
        )
      `);
      await this.initTraceTable();
    } catch (e) {
      console.warn("KV Init failed", e);
    }
  }

  async initTraceTable() {
    if (!this.conn) return;
    try {
      await this.conn.query(`
            CREATE TABLE IF NOT EXISTS ai_traces (
                id VARCHAR,
                timestamp TIMESTAMP,
                prompt VARCHAR,
                response VARCHAR,
                model VARCHAR,  
                quality_score DOUBLE,
                meta JSON
            )
        `);
    } catch (e) { console.warn("Trace Init Failed", e); }
  }

  async logAiTrace(trace: { prompt: string, response: string, model: string, meta?: any }) {
    if (!this.conn) return;
    try {
      // Escape single quotes (basic SQL injection prevention for internal logging)
      const safe = (s: string) => s.replace(/'/g, "''");
      const id = crypto.randomUUID();
      const metaJson = JSON.stringify(trace.meta || {}).replace(/'/g, "''");

      await this.conn.query(`
            INSERT INTO ai_traces (id, timestamp, prompt, response, model, quality_score, meta)
            VALUES (
                '${id}', 
                CURRENT_TIMESTAMP, 
                '${safe(trace.prompt)}', 
                '${safe(trace.response)}', 
                '${safe(trace.model)}',
                0.0,
                '${metaJson}'::JSON
            )
          `);
    } catch (e) {
      console.warn("Log Trace Failed", e);
    }
  }

  async saveSession(key: string, data: any) {
    if (!this.conn) return;
    try {
      const jsonVal = JSON.stringify(data, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      ).replace(/'/g, "''");
      const sql = `
        INSERT INTO _sys_kv_store (key, value, updated_at) 
        VALUES ('${key}', '${jsonVal}'::JSON, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE SET 
          value = EXCLUDED.value,
          updated_at = EXCLUDED.updated_at
      `;
      await this.conn.query(sql);
    } catch (e) {
      console.warn("Save Session Failed", e);
    }
  }

  async loadSession(key: string): Promise<any | null> {
    if (!this.conn) return null;
    try {
      const res = await this.conn.query(`SELECT value FROM _sys_kv_store WHERE key = '${key}'`);
      const rows = res.toArray().map(r => r.toJSON());
      if (rows.length > 0) {
        return typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  // --- Epic-010: Visual Join Builder ---
  async getAllTablesSchema(): Promise<{ table: string, columns: { name: string, type: string }[] }[]> {
    if (!this.conn) return [];
    const tables = await this.getTables();
    const schemas = [];
    for (const t of tables) {
      const cols = await this.conn.query(`PRAGMA table_info('${t}')`);
      schemas.push({
        table: t,
        columns: cols.toArray().map((c: any) => ({ name: c.name, type: c.type }))
      });
    }
    return schemas;
  }

  async inferRelationships(schemas: { table: string, columns: { name: string, type: string }[] }[]) {
    const relationships: { fromTable: string, fromCol: string, toTable: string, toCol: string }[] = [];
    const pkMap = new Map<string, string>();
    for (const s of schemas) {
      const idCol = s.columns.find(c => c.name.toLowerCase() === 'id' || c.name.toLowerCase() === `${s.table}_id`);
      if (idCol) pkMap.set(s.table, idCol.name);
    }

    for (const s of schemas) {
      for (const c of s.columns) {
        if (c.name.toLowerCase().endsWith('_id')) {
          const targetTable = c.name.substring(0, c.name.length - 3);
          if (pkMap.has(targetTable) && targetTable !== s.table) {
            relationships.push({ fromTable: s.table, fromCol: c.name, toTable: targetTable, toCol: pkMap.get(targetTable)! });
          }
          const targetTablePlural = targetTable + 's';
          if (pkMap.has(targetTablePlural) && targetTablePlural !== s.table) {
            relationships.push({ fromTable: s.table, fromCol: c.name, toTable: targetTablePlural, toCol: pkMap.get(targetTablePlural)! });
          }
        }
      }
    }
    return relationships;
  }

  // --- Epic-012: Export Data ---
  async exportTable(tableName: string, format: 'csv' | 'parquet' | 'json'): Promise<Uint8Array> {
    if (!this.conn || !this.db) throw new Error("DB not connected");
    const fileName = `export_${tableName}.${format}`;

    // DuckDB COPY statement
    // For CSV: COPY tbl TO 'file.csv' (HEADER, DELIMITER ',')
    // For Parquet: COPY tbl TO 'file.parquet' (FORMAT PARQUET)
    // For JSON: COPY tbl TO 'file.json' (FORMAT JSON) // Check version support, JSON supported in recent versions

    let sql = '';
    if (format === 'csv') {
      sql = `COPY "${tableName}" TO '${fileName}' (HEADER, DELIMITER ',')`;
    } else if (format === 'parquet') {
      sql = `COPY "${tableName}" TO '${fileName}' (FORMAT PARQUET)`;
    } else if (format === 'json') {
      // Use JSON extension if strictly needed or just simple select
      sql = `COPY (SELECT * FROM "${tableName}") TO '${fileName}'`;
      // DuckDB infers JSON from extension usually? Or strictly `(FORMAT JSON)`?
      // Newer duckdb: COPY ... (FORMAT JSON, ARRAY true)
      // Let's rely on extension inference first.
    }

    await this.conn.query(sql);

    const buffer = await this.db.copyFileToBuffer(fileName);
    await this.db.registerFileText(fileName, ''); // Cleanup?
    return buffer;
  }

  // ==================== Ontology Layer ====================

  async ontologySeed(): Promise<void> {
    return this.runInQueue(async () => {
      await this.waitForInit();
      if (!this.conn) return;
      for (const stmt of ONTOLOGY_SEED_STATEMENTS) {
        if (stmt.trim()) {
          try {
            await this.conn.query(stmt);
          } catch (e: any) {
            console.error(`[DuckDB] Seed execution failed for: "${stmt}"`, e);
            throw e;
          }
        }
      }
    });
  }

  // helper to normalize date objects/epoch from duckdb into YYYY-MM-DD string
  private _normalizeDate(val: any): string | null {
    if (!val) return null;
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) return val.slice(0, 10);
    if (typeof val === 'number') {
      const d = new Date(val);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    if (val instanceof Date && !isNaN(val.getTime())) return val.toISOString().slice(0, 10);
    return null;
  }

  async getOntologyObjects(): Promise<any[]> {
    return this.query('SELECT * FROM life_object ORDER BY id');
  }

  async getOntologyObjectTypes(): Promise<any[]> {
    return this.query('SELECT * FROM life_object_type ORDER BY id');
  }

  async getOntologyLinks(): Promise<any[]> {
    return this.query('SELECT * FROM life_link ORDER BY id');
  }

  async getOntologyLinkTypes(): Promise<any[]> {
    return this.query('SELECT * FROM life_link_type ORDER BY id');
  }

  async getOntologyActions(): Promise<any[]> {
    const rows = await this.query('SELECT * FROM life_action ORDER BY id');
    return rows.map(r => ({ ...r, execute_at: this._normalizeDate(r.execute_at) }));
  }

  async getOntologyIntrospections(): Promise<any[]> {
    const rows = await this.query('SELECT * FROM life_introspection ORDER BY id');
    return rows.map(r => ({ ...r, created_at: this._normalizeDate(r.created_at) }));
  }

  async getOntologyInsights(): Promise<any[]> {
    const rows = await this.query('SELECT * FROM life_insight ORDER BY id');
    return rows.map(r => ({ ...r, created_at: this._normalizeDate(r.created_at) }));
  }

  // Unified save for the generated AI draft
  async executeOntologyDraft(draftData: {
    objects: any[], links: any[], actions: any[], introspections: any[], insights: any[]
  }): Promise<void> {
    if (!this.conn) return;
    try {
      // Execute in sequence to maintain FK constraints
      for (const obj of draftData.objects || []) {
        await this.query(`INSERT INTO life_object (id, object_type_id, name, properties, annotations) VALUES (${obj.id}, ${obj.object_type_id || 1}, '${obj.name.replace(/'/g, "''")}', '${JSON.stringify(obj.properties || {}).replace(/'/g, "''")}', '${(obj.annotations || '').replace(/'/g, "''")}') ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, properties=EXCLUDED.properties, annotations=EXCLUDED.annotations, object_type_id=EXCLUDED.object_type_id`);
      }
      for (const link of draftData.links || []) {
        await this.query(`INSERT INTO life_link (id, link_type_id, source_object_id, target_object_id, weight) VALUES (${link.id}, ${link.link_type_id || 1}, ${link.source_object_id}, ${link.target_object_id}, ${link.weight || 1.0}) ON CONFLICT (id) DO UPDATE SET link_type_id=EXCLUDED.link_type_id, source_object_id=EXCLUDED.source_object_id, target_object_id=EXCLUDED.target_object_id, weight=EXCLUDED.weight`);
      }
      for (const action of draftData.actions || []) {
        await this.query(`INSERT INTO life_action (id, object_id, name, description, status) VALUES (${action.id}, ${action.object_id}, '${action.name.replace(/'/g, "''")}', '${(action.description || '').replace(/'/g, "''")}', '${action.status || 'pending'}') ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, status=EXCLUDED.status, object_id=EXCLUDED.object_id`);
      }
      for (const intro of draftData.introspections || []) {
        await this.query(`INSERT INTO life_introspection (id, object_id, question, answer) VALUES (${intro.id}, ${intro.object_id}, '${intro.question.replace(/'/g, "''")}', '${(intro.answer || '').replace(/'/g, "''")}') ON CONFLICT (id) DO UPDATE SET question=EXCLUDED.question, answer=EXCLUDED.answer, object_id=EXCLUDED.object_id`);
      }
      for (const insight of draftData.insights || []) {
        await this.query(`INSERT INTO life_insight (id, object_id, insight, tag) VALUES (${insight.id}, ${insight.object_id}, '${insight.insight.replace(/'/g, "''")}', '${(insight.tag || '').replace(/'/g, "''")}') ON CONFLICT (id) DO UPDATE SET insight=EXCLUDED.insight, tag=EXCLUDED.tag, object_id=EXCLUDED.object_id`);
      }
    } catch (err) {
      console.error('Execute ontology draft failed', err);
      throw err;
    }
  }

  // Common unified delete for Graph
  async deleteOntologyNodeTree(objectId: number): Promise<void> {
    if (!this.conn) return;
    try {
      await this.query(`DELETE FROM life_action WHERE object_id = ${objectId}`);
      await this.query(`DELETE FROM life_introspection WHERE object_id = ${objectId}`);
      await this.query(`DELETE FROM life_insight WHERE object_id = ${objectId}`);
      await this.query(`DELETE FROM life_link WHERE source_object_id = ${objectId} OR target_object_id = ${objectId}`);
      await this.query(`DELETE FROM life_canvas_state WHERE object_id = ${objectId}`);
      await this.query(`DELETE FROM life_object WHERE id = ${objectId}`);
    } catch (e) {
      console.error('Delete ontology node tree failed', e);
    }
  }

  async getOntologyCanvasState(): Promise<any[]> {
    try {
      const tables = await this.getTables();
      if (!tables.includes('life_canvas_state')) return [];
      return await this.query('SELECT * FROM life_canvas_state');
    } catch {
      return [];
    }
  }

  async saveOntologyCanvasState(id: string, spaceId: string | null, objectId: number | null, title: string, color: string, x: number, y: number, width: number, height: number, nodeType: string, metadata: any): Promise<void> {
    const spaceVal = spaceId ? `'${spaceId.replace(/'/g, "''")}'` : 'NULL';
    const objVal = (objectId != null && Number.isFinite(objectId) && !Number.isNaN(objectId)) ? objectId : 'NULL';
    const xVal = Number.isFinite(x) ? x : 0;
    const yVal = Number.isFinite(y) ? y : 0;
    const widthVal = Number.isFinite(width) ? width : 0;
    const heightVal = Number.isFinite(height) ? height : 0;
    const safeId = (id || '').replace(/'/g, "''");
    const safeTitle = (title || '').replace(/'/g, "''");
    const safeColor = (color || '').replace(/'/g, "''");
    const safeNodeType = (nodeType || 'object').replace(/'/g, "''");
    const metadataVal = metadata ? `'${JSON.stringify(metadata).replace(/'/g, "''")}'` : "'{}'";
    await this.query(`
      INSERT INTO life_canvas_state (id, space_id, object_id, title, color, x, y, width, height, node_type, metadata)
      VALUES ('${safeId}', ${spaceVal}, ${objVal}, '${safeTitle}', '${safeColor}', ${xVal}, ${yVal}, ${widthVal}, ${heightVal}, '${safeNodeType}', ${metadataVal})
      ON CONFLICT (id) DO UPDATE SET
        space_id = EXCLUDED.space_id,
        object_id = EXCLUDED.object_id,
        title = EXCLUDED.title,
        color = EXCLUDED.color,
        x = EXCLUDED.x,
        y = EXCLUDED.y,
        width = EXCLUDED.width,
        height = EXCLUDED.height,
        node_type = EXCLUDED.node_type,
        metadata = EXCLUDED.metadata
    `);
  }

  async deleteOntologyCanvasState(id: string): Promise<void> {
    await this.query(`DELETE FROM life_canvas_state WHERE id = '${id}'`);
  }

  // Real-time Update methods
  async updateOntologyObject(id: number, updates: { name?: string, properties?: any }): Promise<void> {
    let sets = [];
    if (updates.name) sets.push(`name = '${updates.name.replace(/'/g, "''")}'`);
    if (updates.properties) sets.push(`properties = '${JSON.stringify(updates.properties).replace(/'/g, "''")}'`);
    if (sets.length === 0) return;
    await this.query(`UPDATE life_object SET ${sets.join(', ')} WHERE id = ${id}`);
  }

  async updateOntologyAction(id: number, updates: { name?: string, description?: string, status?: string }): Promise<void> {
    let sets = [];
    if (updates.name) sets.push(`name = '${updates.name.replace(/'/g, "''")}'`);
    if (updates.description) sets.push(`description = '${updates.description.replace(/'/g, "''")}'`);
    if (updates.status) sets.push(`status = '${updates.status.replace(/'/g, "''")}'`);
    if (sets.length === 0) return;
    await this.query(`UPDATE life_action SET ${sets.join(', ')} WHERE id = ${id}`);
  }

  async updateOntologyInsight(id: number, updates: { insight?: string, tag?: string }): Promise<void> {
    let sets = [];
    if (updates.insight) sets.push(`insight = '${updates.insight.replace(/'/g, "''")}'`);
    if (updates.tag) sets.push(`tag = '${updates.tag.replace(/'/g, "''")}'`);
    if (sets.length === 0) return;
    await this.query(`UPDATE life_insight SET ${sets.join(', ')} WHERE id = ${id}`);
  }

  async updateOntologyIntrospection(id: number, updates: { question?: string, answer?: string }): Promise<void> {
    let sets = [];
    if (updates.question) sets.push(`question = '${updates.question.replace(/'/g, "''")}'`);
    if (updates.answer) sets.push(`answer = '${updates.answer.replace(/'/g, "''")}'`);
    if (sets.length === 0) return;
    await this.query(`UPDATE life_introspection SET ${sets.join(', ')} WHERE id = ${id}`);
  }

  async createOntologyObject(name: string, objectTypeId: number, properties: string = '{}'): Promise<void> {
    await this.query(`INSERT INTO life_object (name, object_type_id, properties) VALUES ('${name.replace(/'/g, "''")}', ${objectTypeId}, '${properties.replace(/'/g, "''")}')`);
  }

  async updateOntologyAnnotation(objectId: number, annotation: string): Promise<void> {
    await this.query(`UPDATE life_object SET annotations = '${annotation.replace(/'/g, "''")}' WHERE id = ${objectId}`);
  }

  async updateOntologyProperties(objectId: number, properties: string): Promise<void> {
    await this.query(`UPDATE life_object SET properties = '${properties.replace(/'/g, "''")}' WHERE id = ${objectId}`);
  }

  async updateOntologyLinkWeight(linkId: number, weight: number): Promise<void> {
    await this.query(`UPDATE life_link SET weight = ${weight} WHERE id = ${linkId}`);
  }

  async createOntologyLink(linkTypeId: number, sourceId: number, targetId: number, weight: number = 1.0): Promise<void> {
    await this.query(`INSERT INTO life_link (link_type_id, source_object_id, target_object_id, weight) VALUES (${linkTypeId}, ${sourceId}, ${targetId}, ${weight})`);
  }

  async deleteOntologyLink(linkId: number): Promise<void> {
    await this.query(`DELETE FROM life_link WHERE id = ${linkId}`);
  }

  // Introspection
  async addIntrospection(objectId: number, question: string, answer: string): Promise<void> {
    await this.query(`INSERT INTO life_introspection (object_id, question, answer) VALUES (${objectId}, '${question.replace(/'/g, "''")}', '${answer.replace(/'/g, "''")}')`);
  }

  async getIntrospections(objectId: number): Promise<any[]> {
    return this.query(`SELECT * FROM life_introspection WHERE object_id = ${objectId} ORDER BY created_at DESC`);
  }

  // Insights
  async addInsight(objectId: number, insight: string, tag: string): Promise<void> {
    await this.query(`INSERT INTO life_insight (object_id, insight, tag) VALUES (${objectId}, '${insight.replace(/'/g, "''")}', '${tag.replace(/'/g, "''")}')`);
  }

  async getInsights(): Promise<any[]> {
    return this.query('SELECT li.*, lo.name as object_name FROM life_insight li LEFT JOIN life_object lo ON li.object_id = lo.id ORDER BY li.created_at DESC');
  }

  async getInsightsByTag(tag: string): Promise<any[]> {
    return this.query(`SELECT * FROM life_insight WHERE tag = '${tag.replace(/'/g, "''")}' ORDER BY created_at DESC`);
  }

  async deleteInsight(id: number): Promise<void> {
    await this.query(`DELETE FROM life_insight WHERE id = ${id}`);
  }

  async loadOntologyTemplate(templateData: any): Promise<void> {
    return this.runInQueue(async () => {
      await this.waitForInit();
      if (!this.conn) return;
      try {
        const sqlParts: string[] = [];

        // 1. Table creation statements
        sqlParts.push(...ONTOLOGY_CREATE_STATEMENTS);

        // 2. Clear existing tables
        const tablesToClear = [
          'life_canvas_edge',
          'life_canvas_state',
          'life_action',
          'life_introspection',
          'life_insight',
          'life_link',
          'life_link_type',
          'life_object',
          'life_object_type'
        ];
        for (const t of tablesToClear) {
          sqlParts.push(`DELETE FROM ${t}`);
        }

        const esc = (val: any) => (val ? String(val).replace(/'/g, "''") : '');

        // 3. Insert new template data
        if (templateData.objectTypes && templateData.objectTypes.length > 0) {
          const values = templateData.objectTypes.map((ot: any) =>
            `(${ot.id}, '${esc(ot.name)}', '${esc(ot.description)}')`
          ).join(', ');
          sqlParts.push(`INSERT INTO life_object_type (id, name, description) VALUES ${values}`);
        }

        if (templateData.objects && templateData.objects.length > 0) {
          const values = templateData.objects.map((o: any) => {
            const propsStr = typeof o.properties === 'string' ? o.properties : JSON.stringify(o.properties || {});
            return `(${o.id}, ${o.object_type_id}, '${esc(o.name)}', '${esc(propsStr)}', '${esc(o.annotations)}')`;
          }).join(', ');
          sqlParts.push(`INSERT INTO life_object (id, object_type_id, name, properties, annotations) VALUES ${values}`);
        }

        if (templateData.linkTypes && templateData.linkTypes.length > 0) {
          const values = templateData.linkTypes.map((lt: any) =>
            `(${lt.id}, '${esc(lt.name)}', '${esc(lt.description)}')`
          ).join(', ');
          sqlParts.push(`INSERT INTO life_link_type (id, name, description) VALUES ${values}`);
        }

        if (templateData.links && templateData.links.length > 0) {
          const values = templateData.links.map((l: any) =>
            `(${l.id}, ${l.link_type_id}, ${l.source_object_id}, ${l.target_object_id}, ${l.weight ?? 1.0})`
          ).join(', ');
          sqlParts.push(`INSERT INTO life_link (id, link_type_id, source_object_id, target_object_id, weight) VALUES ${values}`);
        }

        if (templateData.actions && templateData.actions.length > 0) {
          const values = templateData.actions.map((a: any) => {
            const execAt = a.execute_at ? `'${a.execute_at}'` : 'NULL';
            return `(${a.id}, ${a.object_id}, '${esc(a.name)}', '${esc(a.description)}', '${esc(a.status || 'pending')}', ${execAt})`;
          }).join(', ');
          sqlParts.push(`INSERT INTO life_action (id, object_id, name, description, status, execute_at) VALUES ${values}`);
        }

        if (templateData.introspections && templateData.introspections.length > 0) {
          const values = templateData.introspections.map((intro: any) => {
            const crAt = intro.created_at ? `'${intro.created_at}'` : 'CURRENT_DATE';
            return `(${intro.id}, ${intro.object_id}, '${esc(intro.question)}', '${esc(intro.answer)}', ${crAt})`;
          }).join(', ');
          sqlParts.push(`INSERT INTO life_introspection (id, object_id, question, answer, created_at) VALUES ${values}`);
        }

        if (templateData.insights && templateData.insights.length > 0) {
          const values = templateData.insights.map((ins: any) => {
            const crAt = ins.created_at ? `'${ins.created_at}'` : 'CURRENT_DATE';
            return `(${ins.id}, ${ins.object_id}, '${esc(ins.insight)}', '${esc(ins.tag)}', ${crAt})`;
          }).join(', ');
          sqlParts.push(`INSERT INTO life_insight (id, object_id, insight, tag, created_at) VALUES ${values}`);
        }

        // Execute ALL statements sequentially
        console.log(`[DuckDB] loadOntologyTemplate: executing ${sqlParts.length} statements sequentially`);
        for (const stmt of sqlParts) {
          if (stmt.trim()) {
            await this.conn.query(stmt);
          }
        }
        this.dispatchSchemaChanged();
      } catch (err) {
        console.error('Load ontology template failed', err);
        throw err;
      }
    });
  }


  async getOntologyPatterns(): Promise<any[]> {
    if (!this.conn) return [];
    try {
      const rows = await this.query('SELECT * FROM _sys_ontology_pattern_library');
      return rows.map((r: any) => {
        const parseJson = (val: any) => {
          if (!val) return [];
          if (typeof val === 'string') {
            try { return JSON.parse(val); } catch { return []; }
          }
          return val;
        };
        return {
          ...r,
          seedIds: parseJson(r.seed_ids),
          coreNodes: parseJson(r.core_nodes),
          principles: parseJson(r.principles),
          bestPractices: parseJson(r.best_practices),
          antiPatterns: parseJson(r.anti_patterns),
        };
      });
    } catch (e) {
      console.warn('[DuckDB] Failed to query pattern library:', e);
      return [];
    }
  }

  async saveOntologyPattern(pattern: any): Promise<void> {
    if (!this.conn) return;
    const esc = (val: any) => this.escapeLiteral(val ?? '').slice(1, -1); // strip outer quotes
    const seedIdsJson = JSON.stringify(pattern.seedIds || pattern.seed_ids || []);
    const coreNodesJson = JSON.stringify(pattern.coreNodes || pattern.core_nodes || []);
    const principlesJson = JSON.stringify(pattern.principles || []);
    const bestPracticesJson = JSON.stringify(pattern.bestPractices || pattern.best_practices || []);
    const antiPatternsJson = JSON.stringify(pattern.antiPatterns || pattern.anti_patterns || []);

    await this.query(`
      INSERT INTO _sys_ontology_pattern_library (
        id, category_id, category_title, title, icon_name, brief, description, layer, seed_ids, core_nodes, principles, best_practices, anti_patterns, mermaid
      ) VALUES (
        '${esc(pattern.id)}',
        '${esc(pattern.categoryId || pattern.category_id)}',
        '${esc(pattern.categoryTitle || pattern.category_title)}',
        '${esc(pattern.title)}',
        '${esc(pattern.iconName || pattern.icon_name || 'BookOpen')}',
        '${esc(pattern.brief)}',
        '${esc(pattern.description)}',
        '${esc(pattern.layer)}',
        '${esc(seedIdsJson)}',
        '${esc(coreNodesJson)}',
        '${esc(principlesJson)}',
        '${esc(bestPracticesJson)}',
        '${esc(antiPatternsJson)}',
        '${esc(pattern.mermaid || '')}'
      )
      ON CONFLICT (id) DO UPDATE SET
        category_id = EXCLUDED.category_id,
        category_title = EXCLUDED.category_title,
        title = EXCLUDED.title,
        icon_name = EXCLUDED.icon_name,
        brief = EXCLUDED.brief,
        description = EXCLUDED.description,
        layer = EXCLUDED.layer,
        seed_ids = EXCLUDED.seed_ids,
        core_nodes = EXCLUDED.core_nodes,
        principles = EXCLUDED.principles,
        best_practices = EXCLUDED.best_practices,
        anti_patterns = EXCLUDED.anti_patterns,
        mermaid = EXCLUDED.mermaid
    `);
  }

  async deleteOntologyPattern(id: string): Promise<void> {
    await this.query(`DELETE FROM _sys_ontology_pattern_library WHERE id = ${this.escapeLiteral(id)}`);
  }

  async getDatabaseDiagnostics(): Promise<{ databaseSize: string; memoryUsage: string; memoryLimit: string }> {
    if (!this.conn) return { databaseSize: 'Unknown', memoryUsage: 'Unknown', memoryLimit: 'Unknown' };
    let databaseSize = 'Unknown';
    let memoryUsage = 'Unknown';
    let memoryLimit = 'Unknown';
    try {
      const sizeRes = await this.query('CALL pragma_database_size()');
      if (sizeRes && sizeRes.length > 0) {
        databaseSize = sizeRes[0].database_size || sizeRes[0].db_size || 'Unknown';
      }
    } catch (e) {}

    try {
      const memRes = await this.query('SELECT * FROM duckdb_memory()');
      if (memRes && memRes.length > 0) {
        let total = 0;
        for (const row of memRes) {
          total += Number(row.memory_usage ?? 0);
        }
        memoryUsage = `${(total / (1024 * 1024)).toFixed(2)} MB`;
      }
    } catch (e) {}

    try {
      const limitRes = await this.query("SELECT value FROM duckdb_settings() WHERE name = 'max_memory'");
      if (limitRes && limitRes.length > 0) {
        memoryLimit = limitRes[0].value || 'Unknown';
      }
    } catch (e) {}

    return { databaseSize, memoryUsage, memoryLimit };
  }

  async getTableColumns(tableName: string): Promise<string[]> {
    if (!tableName || !tableName.trim()) return [];
    try {
      const rows = await this.query(`DESCRIBE "${tableName.replace(/"/g, '""')}"`);
      return rows.map((r: any) => String(r.column_name || r.name || Object.values(r)[0])).filter(Boolean);
    } catch {
      return [];
    }
  }

  async queryWithParams(sql: string, params?: any[]): Promise<any[]> {
    return this.runInQueue(async () => {
      await this.waitForInit();
      if (!this.conn) throw new Error("Database not connected");
      if (!params || params.length === 0) {
        const res = await this.conn.query(sql);
        return this.cleanDuckDBResult(res);
      }
      try {
        const prepared = await this.conn.prepare(sql);
        const result = await prepared.query(...params);
        await prepared.close();
        return this.cleanDuckDBResult(result);
      } catch {
        let paramIdx = 0;
        const substitutedSql = sql.replace(/\?/g, () => {
          if (paramIdx >= params.length) return '?';
          const p = params[paramIdx++];
          if (p === null || p === undefined) return 'NULL';
          if (typeof p === 'number' || typeof p === 'boolean') return String(p);
          return `'${String(p).replace(/'/g, "''")}'`;
        });
        const result = await this.conn.query(substitutedSql);
        return this.cleanDuckDBResult(result);
      }
    });
  }

  async validateSqlAst(sql: string): Promise<{ isValid: boolean; valid: boolean; error?: string }> {
    try {
      await this.query(`EXPLAIN ${sql}`);
      return { isValid: true, valid: true };
    } catch (e: any) {
      return { isValid: false, valid: false, error: e.message };
    }
  }

  async cancelActiveQuery(): Promise<void> {
    // Cancellation stub
  }

  async executeTransaction<T = unknown>(statementsOrCallback: string[] | (() => Promise<T>)): Promise<T | void> {
    return this.runInQueue(async () => {
      await this.waitForInit();
      const isNested = this.inTransaction;
      if (!isNested) {
        this.inTransaction = true;
        try {
          if (this.conn) await this.conn.query('BEGIN TRANSACTION');
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (!/cannot start a transaction/i.test(msg)) {
            this.inTransaction = false;
            throw e;
          }
        }
      }

      try {
        let res: T | void;
        if (Array.isArray(statementsOrCallback)) {
          for (const stmt of statementsOrCallback) {
            if (!stmt.trim()) continue;
            if (this.conn) await this.conn.query(stmt);
          }
        } else {
          res = await statementsOrCallback();
        }

        if (!isNested && this.conn) {
          try {
            await this.conn.query('COMMIT');
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (!/no transaction is active/i.test(msg)) throw e;
          }
        }
        return res;
      } catch (e) {
        if (!isNested && this.conn) {
          try {
            await this.conn.query('ROLLBACK');
          } catch {}
        }
        throw e;
      } finally {
        if (!isNested) this.inTransaction = false;
      }
    });
  }

  async exportWorkspaceSnapshotArchive(): Promise<Uint8Array> {
    try {
      const baseTables = await this.getBaseTables();
      const tableSnapshots: DuckDBTableSnapshot[] = [];
      for (const t of baseTables) {
        if (t.startsWith('_sys_')) continue;
        const def = await this.getTableOrViewDefinition(t);
        const rows = await this.query(`SELECT * FROM "${t.replace(/"/g, '""')}"`);
        tableSnapshots.push({ name: t, ddl: def.ddl, rows: rows || [] });
      }
      const views = await this.getViews();
      const viewSnapshots: DuckDBViewSnapshot[] = [];
      for (const v of views) {
        const def = await this.getTableOrViewDefinition(v);
        viewSnapshots.push({ name: v, sql: def.sql || def.ddl });
      }
      const snapshot: DuckDBWorkspaceSnapshot = {
        version: 1,
        updatedAt: Date.now(),
        tables: tableSnapshots,
        views: viewSnapshots,
        macros: [],
      };
      return new TextEncoder().encode(JSON.stringify(snapshot));
    } catch {
      return new TextEncoder().encode(JSON.stringify({ version: 1, updatedAt: Date.now(), tables: [], views: [], macros: [] }));
    }
  }

  async installWorkspaceSnapshotArchive(data: Uint8Array | Blob): Promise<void> {
    try {
      const bytes = data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : data;
      const jsonStr = new TextDecoder().decode(bytes);
      const snapshot = JSON.parse(jsonStr) as DuckDBWorkspaceSnapshot;
      if (snapshot && Array.isArray(snapshot.tables)) {
        await saveWorkspaceSnapshot(snapshot);
        await this.clearAllData({ tables: true, views: true, macros: true, files: true });
        await this.restoreFromIndexedDBCache();
      }
    } catch (e) {
      console.warn('[DuckDB] Failed to install workspace snapshot archive:', e);
    }
  }

  async checkOPFSSupport(): Promise<{ supported: boolean; persistent: boolean }> {
    try {
      const supported = typeof navigator !== 'undefined' && 'storage' in navigator && 'getDirectory' in navigator.storage;
      let persistent = false;
      if (supported && navigator.storage && 'persisted' in navigator.storage) {
        persistent = await navigator.storage.persisted();
      }
      return { supported, persistent };
    } catch {
      return { supported: false, persistent: false };
    }
  }

  async queryArrowZeroCopy(sql: string): Promise<any> {
    await this.waitForInit();
    if (!this.conn) throw new Error('Database not initialized');
    return await this.conn.query(sql);
  }

  async getBaseTables(): Promise<string[]> {
    try {
      const rows = await this.query(`
        SELECT DISTINCT table_name 
        FROM information_schema.tables 
        WHERE (table_schema = current_schema() OR table_schema = 'main') 
          AND table_type = 'BASE TABLE'
          AND table_name NOT LIKE '_sys_%'
      `);
      return rows.map((r: any) => String(r.table_name || Object.values(r)[0]));
    } catch {
      try {
        const rows = await this.query(`
          SELECT DISTINCT table_name 
          FROM duckdb_tables() 
          WHERE (schema_name = current_schema() OR schema_name = 'main') 
            AND NOT internal 
            AND table_name NOT LIKE '_sys_%'
        `);
        return rows.map((r: any) => String(r.table_name || Object.values(r)[0]));
      } catch {
        const all = await this.getTables();
        const views = await this.getViews().catch(() => []);
        return all.filter(t => !views.includes(t));
      }
    }
  }

  async getViews(): Promise<string[]> {
    try {
      const res = await this.query(`
        SELECT DISTINCT view_name 
        FROM duckdb_views() 
        WHERE NOT internal 
          AND schema_name NOT IN ('information_schema', 'pg_catalog')
          AND view_name NOT LIKE '_sys_%'
      `);
      return res.map((r: any) => String(r.view_name || Object.values(r)[0])).filter(Boolean);
    } catch {}

    try {
      const res = await this.query(`
        SELECT DISTINCT table_name 
        FROM information_schema.views 
        WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
          AND table_name NOT LIKE '_sys_%'
      `);
      return res.map((r: any) => String(r.table_name || Object.values(r)[0])).filter(Boolean);
    } catch {
      return [];
    }
  }

  async getMacros(): Promise<string[]> {
    try {
      const res = await this.query(`
        SELECT DISTINCT function_name 
        FROM duckdb_functions() 
        WHERE (function_type = 'macro' OR function_type = 'table_macro' OR function_type ILIKE '%macro%') 
          AND (schema_name = current_schema() OR schema_name = 'main' OR schema_name = 'temp') 
          AND NOT internal 
          AND function_name NOT LIKE '_sys_%'
      `);
      return res.map((r: any) => String(r.function_name || Object.values(r)[0])).filter(Boolean);
    } catch {
      return [];
    }
  }

  getRegisteredFiles(): { name: string; size: string; type: string }[] {
    return Array.from(this.registeredFiles.values()).map(f => ({
      name: typeof f === 'string' ? f : f.name || String(f),
      size: typeof f === 'object' && f.size ? f.size : '0 KB',
      type: typeof f === 'object' && f.type ? f.type : 'file',
    }));
  }

  async registerUserFile(file: File): Promise<string> {
    await this.waitForInit();
    if (!this.db) throw new Error("DuckDB not initialized");
    await this.db.registerFileHandle(file.name, file, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);
    this.registeredFiles.set(file.name, {
      name: file.name,
      size: `${(file.size / 1024).toFixed(1)} KB`,
      type: file.type || file.name.split('.').pop() || 'file',
    });
    return file.name;
  }

  async dropView(viewName: string): Promise<void> {
    const qualified = viewName.includes('.')
      ? viewName.split('.').map(p => `"${p.replace(/"/g, '""')}"`).join('.')
      : `"${viewName.replace(/"/g, '""')}"`;
    try {
      await this.executeAndAudit(`DROP VIEW IF EXISTS ${qualified}`, 'DROP', viewName, 'Dropped view');
    } catch {
      await this.executeAndAudit(`DROP VIEW IF EXISTS ${qualified} CASCADE`, 'DROP', viewName, 'Dropped view cascade');
    }
    this.dispatchSchemaChanged();
  }

  async dropRegisteredFile(fileName: string): Promise<void> {
    this.registeredFiles.delete(fileName);
  }

  async dropMacro(macroName: string): Promise<void> {
    const escaped = macroName.replace(/"/g, '""');
    let dropped = false;

    // 1. Try standard DROP MACRO
    try {
      await this.executeAndAudit(`DROP MACRO IF EXISTS "${escaped}"`, 'DROP', macroName, 'Dropped macro');
      dropped = true;
    } catch {}

    // 2. Try DROP MACRO TABLE (for table macros)
    if (!dropped) {
      try {
        await this.executeAndAudit(`DROP MACRO TABLE IF EXISTS "${escaped}"`, 'DROP', macroName, 'Dropped table macro');
        dropped = true;
      } catch {}
    }

    // 3. Try DROP FUNCTION
    if (!dropped) {
      try {
        await this.executeAndAudit(`DROP FUNCTION IF EXISTS "${escaped}"`, 'DROP', macroName, 'Dropped function macro');
        dropped = true;
      } catch {}
    }

    // 4. Try explicitly qualified schema (temp / main)
    if (!dropped) {
      try {
        await this.executeAndAudit(`DROP MACRO IF EXISTS temp."${escaped}"`, 'DROP', macroName, 'Dropped temp macro');
        dropped = true;
      } catch {}
    }

    this.dispatchSchemaChanged();
  }

  async clearViews(): Promise<number> {
    const views = await this.getViews();
    let count = 0;
    for (const v of views) {
      try {
        await this.dropView(v);
        count++;
      } catch (e) {
        console.warn(`Failed to drop view ${v}`, e);
      }
    }
    this.dispatchSchemaChanged();
    return count;
  }

  async clearMacros(): Promise<number> {
    const macros = await this.getMacros();
    let count = 0;
    for (const m of macros) {
      try {
        await this.dropMacro(m);
        count++;
      } catch (e) {
        console.warn(`Failed to drop macro ${m}`, e);
      }
    }
    this.dispatchSchemaChanged();
    return count;
  }

  async clearAllData(options?: { tables?: boolean; views?: boolean; files?: boolean; macros?: boolean }): Promise<{ droppedTables: number; droppedViews: number; droppedFiles: number; droppedMacros: number }> {
    let droppedTables = 0;
    let droppedViews = 0;
    let droppedFiles = 0;
    let droppedMacros = 0;

    // Drop views first so dependent view objects do not block table drops
    if (options?.views !== false) {
      const views = await this.getViews();
      for (const v of views) {
        try {
          await this.dropView(v);
          droppedViews++;
        } catch {}
      }
    }

    // Drop macros
    if (options?.macros !== false) {
      const macros = await this.getMacros();
      for (const m of macros) {
        try {
          await this.dropMacro(m);
          droppedMacros++;
        } catch {}
      }
    }

    // Drop base tables
    if (options?.tables !== false) {
      const tables = await this.getBaseTables();
      for (const t of tables) {
        if (!t.startsWith('_sys_')) {
          try {
            await this.dropTable(t);
            droppedTables++;
          } catch {}
        }
      }
    }

    if (options?.files !== false) {
      droppedFiles = this.registeredFiles.size;
      this.registeredFiles.clear();
    }

    this.dispatchSchemaChanged();
    return { droppedTables, droppedViews, droppedFiles, droppedMacros };
  }

  async getColumnProfile(table: string, column: string, _sampleSize?: number): Promise<any> {
    return this.getColumnStats(table, column);
  }

  async getCurrentCatalogAndSchema(): Promise<{ catalog: string; schema: string }> {
    try {
      const res = await this.query('SELECT current_database() as db, current_schema() as sch');
      return {
        catalog: res[0]?.db || 'memory',
        schema: res[0]?.sch || 'main',
      };
    } catch {
      return { catalog: 'memory', schema: 'main' };
    }
  }

  async getTableOrViewDefinition(target: ObjectRef | string): Promise<{ rowCount: number; schema: any[]; ddl: string; sql?: string }> {
    const name = typeof target === 'string' ? target : target.objectName || '';
    try {
      const schema = await this.getTableSchema(name);
      let count = 0;
      try {
        const countRes = await this.query(`SELECT COUNT(*) as c FROM "${name.replace(/"/g, '""')}"`);
        count = Number(countRes[0]?.c || 0);
      } catch {}

      let ddl = '';
      try {
        const defRes = await this.query(`SELECT sql FROM duckdb_tables() WHERE table_name = '${name.replace(/'/g, "''")}' UNION ALL SELECT sql FROM duckdb_views() WHERE view_name = '${name.replace(/'/g, "''")}'`);
        ddl = defRes[0]?.sql || `CREATE TABLE "${name}" (\n  ${schema.map(c => `${c.name} ${c.type}`).join(',\n  ')}\n);`;
      } catch {
        ddl = `CREATE TABLE "${name}" (\n  ${schema.map(c => `${c.name} ${c.type}`).join(',\n  ')}\n);`;
      }

      return {
        rowCount: count,
        schema,
        ddl,
        sql: ddl,
      };
    } catch {
      return {
        rowCount: 0,
        schema: [],
        ddl: `CREATE TABLE "${name}" ();`,
        sql: `CREATE TABLE "${name}" ();`,
      };
    }
  }

  async getExplainPlan(sql: string, detail?: boolean): Promise<{ planText: string }> {
    try {
      const res = await this.query(detail ? `EXPLAIN ANALYZE ${sql}` : `EXPLAIN ${sql}`);
      const planText = res.map((r: any) => r.explain_value ?? r.explore_value ?? Object.values(r)[1] ?? Object.values(r)[0]).join('\n');
      return { planText };
    } catch (e: any) {
      return { planText: `Error explaining query: ${e.message}` };
    }
  }

  async queryWithMetadata(sql: string): Promise<QueryResult & { columnTypes: string[]; columnTypeMap: Record<string, string> }> {
    const startTime = performance.now();
    try {
      await this.waitForInit();
      if (!this.conn) throw new Error("Database not connected");
      const arrowTable = await this.conn.query(sql);
      const rows = this.cleanDuckDBResult(arrowTable);
      const executionTime = performance.now() - startTime;
      const fields = arrowTable.schema?.fields || [];
      const columns = fields.length > 0 ? fields.map((f: any) => f.name) : (rows.length > 0 ? Object.keys(rows[0]) : []);
      const columnTypes = fields.map((f: any) => arrowTypeToDuckDBType(f.type) || 'VARCHAR');
      const columnTypeMap: Record<string, string> = {};
      fields.forEach((f: any) => {
        columnTypeMap[f.name] = arrowTypeToDuckDBType(f.type) || 'VARCHAR';
      });

      return {
        columns,
        columnTypes,
        columnTypeMap,
        rows,
        executionTime,
        arrowTable,
        isExplain: /^\s*EXPLAIN\b/i.test(sql),
      };
    } catch (e: any) {
      const executionTime = performance.now() - startTime;
      return {
        columns: [],
        columnTypes: [],
        columnTypeMap: {},
        rows: [],
        executionTime,
        error: e.message || String(e),
      };
    }
  }

  async executeAndAuditWithMetadata(sql: string, operation: string, target: string, details?: string): Promise<QueryResult & { columnTypes: string[]; columnTypeMap: Record<string, string> }> {
    const startTime = performance.now();
    try {
      const rows = await this.executeAndAudit(sql, operation, target, details);
      const executionTime = performance.now() - startTime;
      const columns = rows && rows.length > 0 ? Object.keys(rows[0]) : [];
      const columnTypes = columns.map(() => 'VARCHAR');
      const columnTypeMap: Record<string, string> = {};
      columns.forEach(col => { columnTypeMap[col] = 'VARCHAR'; });

      return {
        columns,
        columnTypes,
        columnTypeMap,
        rows: rows || [],
        executionTime,
      };
    } catch (e: any) {
      const executionTime = performance.now() - startTime;
      return {
        columns: [],
        columnTypes: [],
        columnTypeMap: {},
        rows: [],
        executionTime,
        error: e.message || String(e),
      };
    }
  }

  async createView(viewName: string, sql: string): Promise<void> {
    await this.query(`CREATE VIEW "${viewName.replace(/"/g, '""')}" AS ${sql}`);
    this.dispatchSchemaChanged();
  }

  async saveOntologyCanvasEdge(id: string, sourceId: string, targetId: string): Promise<void> {
    await this.query(`
      CREATE TABLE IF NOT EXISTS life_canvas_edge (
        id VARCHAR PRIMARY KEY,
        source_id VARCHAR,
        target_id VARCHAR
      );
    `);
    const sql = `
      INSERT INTO life_canvas_edge (id, source_id, target_id)
      VALUES ('${id.replace(/'/g, "''")}', '${sourceId.replace(/'/g, "''")}', '${targetId.replace(/'/g, "''")}')
      ON CONFLICT (id) DO UPDATE SET
        source_id = EXCLUDED.source_id,
        target_id = EXCLUDED.target_id;
    `;
    await this.query(sql);
  }

  async loadOntologyCanvasState(): Promise<any[]> {
    return this.getOntologyCanvasState();
  }

  async loadOntologyCanvasEdges(): Promise<any[]> {
    try {
      const tables = await this.getTables();
      if (!tables.includes('life_canvas_edge')) {
        return [];
      }
      const res = await this.query('SELECT * FROM life_canvas_edge;');
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  }
}

export const duckDBService = new DuckDBService();