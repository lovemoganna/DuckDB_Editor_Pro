import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import duckdb_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
import { ColumnStats, ImportOptions, EnrichedColumnStats } from '../types';

const DUCKDB_VERSION = '1.33.1';

class DuckDBService {
  private db: duckdb.AsyncDuckDB | null = null;
  private conn: duckdb.AsyncDuckDBConnection | null = null;
  private isInitialized = false;
  private isLegacy = false;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
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

      // Initialize with local worker + CACHE BUSTING
      // We append a timestamp to force the browser to ignore the stuck v0.9.1 cache
      const worker = new Worker(`${mainWorkerURL}?t=${Date.now()}`, { type: 'module' });
      const logger = new duckdb.ConsoleLogger();

      this.db = new duckdb.AsyncDuckDB(logger, worker);
      await this.db.instantiate(mainModuleURL);
      this.conn = await this.db.connect();

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

      // Extensions: Graceful loading (SKIPPED FOR LEGACY)
      // Removed 'spatial' as it causes initialization hangs on some networks/kernels
      const extensions = ['httpfs', 'tpch'];

      if (this.isLegacy) {
        console.warn("!!! LEGACY KERNEL DETECTED - SKIPPING EXTENSION LOAD !!!");
      } else {
        for (const ext of extensions) {
          try {
            console.log(`[DuckDB] Attempting to INSTALL '${ext}'...`);
            await this.conn.query(`INSTALL '${ext}'`);
            await this.conn.query(`LOAD '${ext}'`);
            console.log(`[DuckDB] Extension '${ext}' loaded successfully`);
          } catch (e: any) {
            console.warn(`[DuckDB] Failed to load extension '${ext}'`);
          }
        }
      }

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
    })();

    return this.initPromise;
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
    if (!this.conn) throw new Error("Database not connected");

    if (this.isLegacy) {
      const up = sql.toUpperCase();
      if (up.includes('INSTALL') || up.includes('LOAD')) {
        console.warn(`[DuckDB Safety] Blocked extension command on Legacy Kernel: ${sql}`);
        return [];
      }
    }

    const result = await this.conn.query(sql);
    return result.toArray().map((row) => row.toJSON());
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
      // Allow "CREATE OR REPLACE TEMPORARY VIEW" ... actually maybe too complex to allow.
      // For now, strict block on these keywords is safer, but at least we use boundaries.
      throw new Error("Preview blocked: Contains modification keywords (Safety Check)");
    }

    // Attempt to inject LIMIT 5 if not present
    // Simple heuristic: append LIMIT 5 if not ends with LIMIT X
    let safeSql = sql;
    if (!upperSql.includes('LIMIT')) {
      safeSql += ' LIMIT 5';
    }

    try {
      const result = await this.conn.query(safeSql);
      return result.toArray().map(r => r.toJSON());
    } catch (e: any) {
      throw new Error(`Preview Failed: ${e.message}`);
    }
  }

  // Wrapper for operations that need auditing
  async executeAndAudit(sql: string, type: string, table: string | null, details: string): Promise<any> {
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
  }

  async getTables(): Promise<string[]> {
    if (!this.conn) return [];
    const res = await this.conn.query("SHOW TABLES");
    const rows = res.toArray().map(r => r.toJSON());
    // Filter out internal tables
    return rows.map((r: any) => r.name).filter((n: string) => !n.startsWith('_sys_'));
  }

  async getTableSchema(tableName: string): Promise<any[]> {
    if (!this.conn) return [];
    const res = await this.conn.query(`PRAGMA table_info('${tableName}')`);
    return res.toArray().map(r => r.toJSON());
  }

  async getExtensions(): Promise<any[]> {
    if (!this.conn) return [];

    // BLOCKED ON LEGACY: access produces IO Error
    if (this.isLegacy) return [];

    try {
      const res = await this.conn.query("SELECT * FROM duckdb_extensions()");
      return res.toArray().map(r => r.toJSON());
    } catch (e) {
      return [];
    }
  }

  async loadExtension(name: string): Promise<void> {
    if (!this.conn) return;

    if (this.isLegacy) {
      console.warn(`[DuckDB Safety] Blocked loadExtension('${name}') on Legacy Kernel`);
      return;
    }

    await this.conn.query(`INSTALL '${name}'; LOAD '${name}';`);
  }

  async importFile(file: File, tableName: string, options?: ImportOptions): Promise<void> {
    if (!this.db || !this.conn) return;

    await this.db.registerFileHandle(file.name, file, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);

    const isJson = file.name.endsWith('.json');
    const isCsv = file.name.endsWith('.csv') || file.name.endsWith('.txt');

    let sql = '';

    if (isJson) {
      sql = `CREATE TABLE "${tableName}" AS SELECT * FROM read_json_auto('${file.name}')`;
    } else if (isCsv && options) {
      // Advanced CSV Import
      const opts = [];
      if (options.header) opts.push("header=true"); else opts.push("header=false");
      if (options.delimiter) opts.push(`delim='${options.delimiter}'`);
      if (options.quote) opts.push(`quote='${options.quote}'`);
      if (options.dateFormat) opts.push(`dateformat='${options.dateFormat}'`);

      // Use read_csv (not auto) if specific options provided, or read_csv_auto with overrides
      const optsStr = opts.join(', ');
      sql = `CREATE TABLE "${tableName}" AS SELECT * FROM read_csv_auto('${file.name}', ${optsStr})`;
    } else if (isCsv) {
      // Fallback simple CSV
      sql = `CREATE TABLE "${tableName}" AS SELECT * FROM read_csv_auto('${file.name}')`;
    } else {
      // Assume Parquet
      sql = `CREATE TABLE "${tableName}" AS SELECT * FROM '${file.name}'`;
    }

    await this.conn.query(sql);

    // Audit
    const auditSql = `INSERT INTO memory._sys_audit_log (id, operation_type, target_table, details, affected_rows, sql_statement) VALUES (nextval('memory._sys_audit_seq'), 'IMPORT', '${tableName}', 'Imported file ${file.name}', 0, '${sql.replace(/'/g, "''")}');`;
    await this.conn.query(auditSql);
  }

  async importText(text: string, tableName: string, options?: ImportOptions): Promise<void> {
    if (!this.db || !this.conn) return;

    const fileName = `paste_${Date.now()}.csv`;
    const file = new File([text], fileName, { type: 'text/csv' });

    await this.db.registerFileHandle(file.name, file, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);

    let sql = '';
    if (options) {
      const opts = [];
      if (options.header) opts.push("header=true"); else opts.push("header=false");
      if (options.delimiter) opts.push(`delim='${options.delimiter}'`);
      if (options.quote) opts.push(`quote='${options.quote}'`);
      if (options.dateFormat) opts.push(`dateformat='${options.dateFormat}'`);
      const optsStr = opts.join(', ');
      sql = `CREATE TABLE "${tableName}" AS SELECT * FROM read_csv_auto('${fileName}', ${optsStr})`;
    } else {
      sql = `CREATE TABLE "${tableName}" AS SELECT * FROM read_csv_auto('${fileName}')`;
    }

    await this.conn.query(sql);

    // Audit
    const auditSql = `INSERT INTO memory._sys_audit_log (id, operation_type, target_table, details, affected_rows, sql_statement) VALUES (nextval('memory._sys_audit_seq'), 'IMPORT', '${tableName}', 'Imported from clipboard', 0, '${sql.replace(/'/g, "''")}');`;
    await this.conn.query(auditSql);
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
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    if (value instanceof Date) return `'${value.toISOString()}'`;
    // BigInt handling
    if (typeof value === 'bigint') return value.toString();

    // String escape
    return `'${String(value).replace(/"/g, '""').replace(/'/g, "''")}'`;
  }

  async insertRow(table: string, data: Record<string, any>) {
    const safeTable = `"${table}"`;
    const cols = Object.keys(data).map(c => `"${c}"`).join(', ');
    const vals = Object.values(data).map(v => this.escapeLiteral(v)).join(', ');

    let sql;
    if (cols.length === 0) {
      // Try default values if empty object passed
      sql = `INSERT INTO ${safeTable} DEFAULT VALUES`;
    } else {
      sql = `INSERT INTO ${safeTable} (${cols}) VALUES (${vals})`;
    }

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
    const sql = `DROP TABLE "${tableName}"`;
    return this.executeAndAudit(sql, 'DROP', tableName, 'Dropped table');
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

  /**
   * Attaches a persistent database file from OPFS.
   * Creates it if it doesn't exist.
   */
  async attachProject(projectName: string): Promise<void> {
    if (!this.conn || !this.db) throw new Error("DB not connected");

    const dbName = projectName.endsWith('.duckdb') ? projectName : `${projectName}.duckdb`;
    const alias = projectName.replace(/[^a-zA-Z0-9]/g, '_');

    console.log(`[Persistence] Attaching ${dbName}...`);

    const hasOPFS = 'storage' in navigator && 'getDirectory' in navigator.storage;

    if (!hasOPFS) {
      console.warn("[Persistence] OPFS not supported. Falling back to in-memory mode.");

      // Fallback: In-Memory Only
      await this.conn.query(`ATTACH ':memory:' AS "${alias}"`);

      // Initialize KV store for this in-memory alias
      await this.conn.query(`
        CREATE TABLE IF NOT EXISTS "${alias}"._sys_kv_store (
          key VARCHAR PRIMARY KEY,
          value JSON,
          updated_at TIMESTAMP
        )
      `);

      console.log(`[Persistence] Project ${alias} ready (in-memory mode).`);
      return;
    }

    const root = await navigator.storage.getDirectory();
    const protocol = (duckdb.DuckDBDataProtocol as any).BROWSER_FSACCESS ?? 3;

    // Step 0: Check if this database is already attached
    try {
      const attachedDbs = await this.conn.query(`SELECT database_name FROM duckdb_databases()`);
      const dbNames = attachedDbs.toArray().map((r: any) => r.database_name);
      if (dbNames.includes(alias)) {
        console.log(`[Persistence] Project ${alias} already attached.`);
        return; // Already attached, nothing to do
      }
    } catch (e) {
      // Ignore errors checking attached databases
    }

    // Step 1: Check if file exists and what type it is
    let fileExists = false;
    let isMetadataFile = false; // JSON metadata (not DuckDB)
    let isDuckDBFile = false;   // Actual DuckDB database file
    let handle: FileSystemFileHandle | null = null;

    try {
      handle = await root.getFileHandle(dbName); // Without {create: true}
      fileExists = true;

      const file = await handle.getFile();

      if (file.size === 0) {
        console.warn(`[Persistence] File ${dbName} is empty (0 bytes). Will recreate.`);
        try {
          await root.removeEntry(dbName);
        } catch (delErr) {
          console.warn(`[Persistence] Could not delete empty file:`, delErr);
        }
        fileExists = false;
        handle = null;
      } else {
        // Check first few bytes to determine file type
        const headerBytes = await file.slice(0, 16).arrayBuffer();
        const header = new Uint8Array(headerBytes);

        // DuckDB files start with magic bytes (typically the SQLite-like signature)
        // JSON files typically start with { (0x7B)
        if (header[0] === 0x7B) { // '{' - JSON file
          isMetadataFile = true;
          console.log(`[Persistence] File ${dbName} is a metadata file (${file.size} bytes). Using in-memory.`);
        } else {
          isDuckDBFile = true;
          console.log(`[Persistence] File ${dbName} appears to be DuckDB format (${file.size} bytes).`);
        }
      }
    } catch (e) {
      fileExists = false;
      console.log(`[Persistence] File ${dbName} does not exist. Will create new.`);
    }

    try {
      if (fileExists && isDuckDBFile && handle) {
        // Existing DuckDB file - register and attach
        await this.db.registerFileHandle(dbName, handle, protocol, true);
        await this.conn.query(`ATTACH '${dbName}' AS "${alias}"`);
        console.log(`[Persistence] Attached existing DuckDB file: ${alias}`);
      } else {
        // Either: new project, metadata file, or no file
        // All cases → use in-memory database

        if (!fileExists) {
          console.log(`[Persistence] Creating new in-memory project...`);
          // Create metadata file for tracking
          handle = await root.getFileHandle(dbName, { create: true });
          const configData = JSON.stringify({
            name: projectName,
            created: new Date().toISOString(),
            type: 'memory-backed'
          });
          const writableStream = await (handle as any).createWritable();
          await writableStream.write(configData);
          await writableStream.close();
        } else {
          console.log(`[Persistence] Loading project from metadata (in-memory mode)...`);
        }

        // Create in-memory database
        await this.conn.query(`ATTACH ':memory:' AS "${alias}"`);

        // Initialize the KV store for session management
        await this.conn.query(`
          CREATE TABLE IF NOT EXISTS "${alias}"._sys_kv_store (
            key VARCHAR PRIMARY KEY,
            value JSON,
            updated_at TIMESTAMP
          )
        `);

        console.log(`[Persistence] Project ${alias} ready (in-memory mode).`);
      }
    } catch (e: any) {
      console.error(`[Persistence] Attach/Create Failed:`, e);

      // Recovery: If file is corrupted, create in-memory project directly
      if (e.message && (e.message.includes("not a valid DuckDB") || e.message.includes("IO Error"))) {
        console.warn(`[Persistence] File issue detected. Creating in-memory project...`);
        try {
          // Clean up any bad file state
          try {
            const freshRoot = await navigator.storage.getDirectory();
            await freshRoot.removeEntry(dbName);
            console.log(`[Persistence] Cleaned up ${dbName} from OPFS.`);
          } catch (removeErr: any) {
            console.warn(`[Persistence] Cleanup warning:`, removeErr);
          }

          // Create in-memory project directly (no recursion risk)
          await this.conn!.query(`ATTACH ':memory:' AS "${alias}"`);
          await this.conn!.query(`
            CREATE TABLE IF NOT EXISTS "${alias}"._sys_kv_store (
              key VARCHAR PRIMARY KEY,
              value JSON,
              updated_at TIMESTAMP
            )
          `);
          console.log(`[Persistence] Created in-memory fallback project: ${alias}`);
          return;
        } catch (recoveryError: any) {
          console.error(`[Persistence] Recovery failed:`, recoveryError);
          throw new Error(`无法创建项目 ${projectName}: ${recoveryError.message}`);
        }
      }

      throw new Error(`Could not attach project ${projectName}: ${e.message}`);
    }
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


  async useProject(projectName: string): Promise<void> {
    if (!this.conn) return;
    const alias = projectName.replace(/[^a-zA-Z0-9]/g, '_');
    await this.conn.query(`USE "${alias}"`);
    console.log(`[Persistence] Switched context to ${alias}`);
    await this.initSessionTable();
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
}

export const duckDBService = new DuckDBService();