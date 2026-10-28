// Database service for managing analysis history (from schema generator)
import { SavedAnalysis, SavedQuery, type Dashboard } from '../types';
import { closeDatabaseOnVersionChange } from './indexedDBLifecycle';
import { duckDBService } from './duckdbService';
import { quoteIdent, quoteLiteral } from './databaseCatalog';
import { reportDashboardIncident } from './dashboardDiagnostics';
import { readSidecar, writeSidecar } from './studioMetadataSidecar';

class DBService {
  private dbName = 'DuckDBSchemaGenerator';
  private version = 3; // Upgraded to support dashboards
  private readonly metadataSchema = '__studio';
  private metadataReady = new Map<string, Promise<string>>();
  private dashboardWrites = new Map<string, Promise<unknown>>();
  private dashboardReadIssues = new Map<string, Array<{ id: string; message: string }>>();
  private readonlyCatalogs = new Map<string, Promise<boolean>>();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('duckdb-database-changed', () => { this.metadataReady.clear(); this.readonlyCatalogs.clear(); });
    }
  }

  private async catalog(databaseName?: string): Promise<string> {
    if (databaseName) return databaseName;
    return (await duckDBService.getCurrentCatalogAndSchema()).catalog;
  }

  private metadataTable(catalog: string): string {
    return `${quoteIdent(catalog)}.${quoteIdent(this.metadataSchema)}.${quoteIdent('objects')}`;
  }

  isReadonlyConfiguration(catalog:string): Promise<boolean> {
    const existing=this.readonlyCatalogs.get(catalog);
    if(existing)return existing;
    const operation=duckDBService.readQuery(`SELECT CAST(readonly AS INTEGER) AS readonly_flag FROM duckdb_databases() WHERE database_name = ${quoteLiteral(catalog)}`)
      .then(rows=>Number(rows[0]?.readonly_flag) === 1)
      .catch(error=>{this.readonlyCatalogs.delete(catalog);throw error;});
    this.readonlyCatalogs.set(catalog,operation);
    return operation;
  }

  private async objectRecords(kind:string,catalog:string): Promise<Array<{id:string;payload:unknown;updated_at?:number}>> {
    if(!await this.isReadonlyConfiguration(catalog)) {
      const table=await this.ensureMetadata(catalog);
      return duckDBService.query(`SELECT id, payload, updated_at FROM ${table} WHERE kind = ${quoteLiteral(kind)} ORDER BY updated_at DESC`);
    }
    const exists=await duckDBService.readQuery(`SELECT table_name FROM duckdb_tables() WHERE database_name=${quoteLiteral(catalog)} AND schema_name='__studio' AND table_name='objects'`);
    const source:Array<{id:string;payload:unknown;updated_at?:number}>=exists.length ? await duckDBService.readQuery(`SELECT id, payload, updated_at FROM ${this.metadataTable(catalog)} WHERE kind = ${quoteLiteral(kind)}`) : [];
    const merged=new Map(source.map(row=>[row.id,row]));
    for(const record of await readSidecar(catalog,kind)) {
      if(record.deleted)merged.delete(record.id); else merged.set(record.id,record);
    }
    return [...merged.values()].sort((a,b)=>Number(b.updated_at || 0)-Number(a.updated_at || 0));
  }

  private async legacyRows(storeName: 'snippets' | 'dashboards'): Promise<any[]> {
    if (typeof indexedDB === 'undefined') return [];
    const db = await this.openDB();
    try {
      return await new Promise<any[]>((resolve, reject) => {
        const request = db.transaction([storeName], 'readonly').objectStore(storeName).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  }

  private ensureMetadata(catalog: string): Promise<string> {
    const existing = this.metadataReady.get(catalog);
    if (existing) return existing;
    const operation = this.initializeMetadata(catalog).catch((error) => {
      this.metadataReady.delete(catalog);
      throw error;
    });
    this.metadataReady.set(catalog, operation);
    return operation;
  }

  private async initializeMetadata(catalog: string): Promise<string> {
    const schema = `${quoteIdent(catalog)}.${quoteIdent(this.metadataSchema)}`;
    const table = this.metadataTable(catalog);
    await duckDBService.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
    await duckDBService.query(`CREATE TABLE IF NOT EXISTS ${table} (kind VARCHAR NOT NULL, id VARCHAR NOT NULL, payload VARCHAR NOT NULL, updated_at BIGINT NOT NULL, PRIMARY KEY (kind, id))`);
    const marker = await duckDBService.query(`SELECT id FROM ${table} WHERE kind = 'migration' AND id = 'indexeddb-v1'`);
    if (marker.length === 0) {
      for (const [kind, storeName] of [['query', 'snippets'], ['dashboard', 'dashboards']] as const) {
        const legacy = await this.legacyRows(storeName);
        for (const item of legacy) {
          // The former primary workspace was the persistent legacy file.
          if ((item.databaseName || 'duckdb_manager_workspace') !== catalog) continue;
          const existing = await duckDBService.query(`SELECT id FROM ${table} WHERE kind = ${quoteLiteral(kind)} AND id = ${quoteLiteral(item.id)}`);
          if (existing.length) continue;
          const payload = JSON.stringify({ ...item, databaseName: catalog });
          await duckDBService.query(`INSERT INTO ${table} VALUES (${quoteLiteral(kind)}, ${quoteLiteral(item.id)}, ${quoteLiteral(payload)}, ${Number(item.updatedAt || item.createdAt || Date.now())})`);
        }
      }
      await duckDBService.query(`INSERT INTO ${table} VALUES ('migration', 'indexeddb-v1', '{}', ${Date.now()})`);
    }
    return table;
  }

  private async putObject(kind: 'query' | 'dashboard' | 'dashboard-layout-backup', item: { id: string; databaseName?: string }): Promise<void> {
    const catalog = await this.catalog(item.databaseName);
    const payload = JSON.stringify({ ...item, databaseName: catalog });
    if(await this.isReadonlyConfiguration(catalog)) {
      await writeSidecar({catalog,kind,id:item.id,payload,updated_at:Date.now()});
      return;
    }
    const table = await this.ensureMetadata(catalog);
    await duckDBService.query(`INSERT OR REPLACE INTO ${table} VALUES (${quoteLiteral(kind)}, ${quoteLiteral(item.id)}, ${quoteLiteral(payload)}, ${Date.now()})`);
  }

  private async objects<T>(kind: 'query' | 'dashboard', databaseName?: string): Promise<T[]> {
    const catalog = await this.catalog(databaseName);
    const rows = await this.objectRecords(kind,catalog);
    return rows.map((row) => JSON.parse(String(row.payload)) as T);
  }

  private async deleteObject(kind: 'query' | 'dashboard', id: string, databaseName?: string): Promise<void> {
    const catalog = await this.catalog(databaseName);
    if(await this.isReadonlyConfiguration(catalog)) {
      await writeSidecar({catalog,kind,id,payload:'{}',updated_at:Date.now(),deleted:true});
      return;
    }
    const table = await this.ensureMetadata(catalog);
    await duckDBService.query(`DELETE FROM ${table} WHERE kind = ${quoteLiteral(kind)} AND id = ${quoteLiteral(id)}`);
  }

  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(closeDatabaseOnVersionChange(request.result));

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('analyses')) {
          const store = db.createObjectStore('analyses', { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Version 2: Add snippets store
        if (!db.objectStoreNames.contains('snippets')) {
          const store = db.createObjectStore('snippets', { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Version 3: Add dashboards store
        if (!db.objectStoreNames.contains('dashboards')) {
          const store = db.createObjectStore('dashboards', { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };
    });
  }

  // --- Analysis Operations ---

  async save(analysis: SavedAnalysis): Promise<void> {
    const db = await this.openDB();
    const transaction = db.transaction(['analyses'], 'readwrite');
    const store = transaction.objectStore('analyses');
    await new Promise<void>((resolve, reject) => {
      const request = store.put(analysis);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    db.close();
  }

  async getAll(): Promise<SavedAnalysis[]> {
    const db = await this.openDB();
    const transaction = db.transaction(['analyses'], 'readonly');
    const store = transaction.objectStore('analyses');
    return new Promise<SavedAnalysis[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        resolve(request.result.sort((a: SavedAnalysis, b: SavedAnalysis) => b.timestamp - a.timestamp));
      };
      request.onerror = () => reject(request.error);
    });
  }

  async get(id: string): Promise<SavedAnalysis | null> {
    const db = await this.openDB();
    const transaction = db.transaction(['analyses'], 'readonly');
    const store = transaction.objectStore('analyses');
    return new Promise<SavedAnalysis | null>((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(id: string): Promise<void> {
    const db = await this.openDB();
    const transaction = db.transaction(['analyses'], 'readwrite');
    const store = transaction.objectStore('analyses');
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    db.close();
  }

  // --- Snippet Operations (v2) ---

  async saveQuery(query: SavedQuery): Promise<void> {
    await this.putObject('query', query);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('duckdb-saved-queries-updated'));
  }

  async getQueries(databaseName?: string): Promise<SavedQuery[]> {
    return this.objects<SavedQuery>('query', databaseName);
  }

  async deleteQuery(id: string, databaseName?: string): Promise<void> {
    await this.deleteObject('query', id, databaseName);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('duckdb-saved-queries-updated'));
  }

  // --- Dashboard Operations (v3, scoped by DuckDB catalog) ---

  private queueDashboardWrite<T>(catalog: string, id: string, write: () => Promise<T>): Promise<T> {
    const key = JSON.stringify([catalog, id]);
    const previous = this.dashboardWrites.get(key) || Promise.resolve();
    const operation = previous.catch(() => undefined).then(write);
    this.dashboardWrites.set(key, operation);
    void operation.finally(() => {
      if (this.dashboardWrites.get(key) === operation) this.dashboardWrites.delete(key);
    }).catch(() => undefined);
    return operation;
  }

  async saveDashboard(dashboard: Dashboard): Promise<void> {
    const { normalizeDashboard } = await import('./workbench/dashboardFormat');
    normalizeDashboard(dashboard);
    const catalog = await this.catalog(dashboard.databaseName);
    await this.queueDashboardWrite(catalog, dashboard.id, () => this.putObject('dashboard', { ...dashboard, databaseName: catalog }));
  }

  /** Apply a user edit to the latest persisted view, never to a stale render snapshot. */
  async updateDashboard(id: string, catalog: string, edit: (current: Dashboard) => Dashboard): Promise<Dashboard> {
    return this.queueDashboardWrite(catalog, id, async () => {
      const current = (await this.readDashboards(catalog, id)).find(board => board.id === id);
      if (!current) throw new Error('此工作台视图已不存在，请重新选择');
      const next = edit(current);
      if (next.id !== id || next.databaseName !== catalog) throw new Error('工作台身份已改变，请重新打开视图');
      const { normalizeDashboard } = await import('./workbench/dashboardFormat');
      normalizeDashboard(next);
      const updated = { ...next, updatedAt: Date.now() };
      await this.putObject('dashboard', updated);
      return updated;
    });
  }

  getDashboardReadIssues(catalog: string) { return (this.dashboardReadIssues.get(catalog) || []).map(issue => ({...issue})); }

  async getDashboards(databaseName?: string): Promise<Dashboard[]> {
    return this.readDashboards(await this.catalog(databaseName));
  }

  private async repairStoredDashboard(catalog: string, id: string): Promise<Dashboard> {
    const { normalizeDashboard, layoutOverlaps, repairDashboardLayout } = await import('./workbench/dashboardFormat');
    // Re-read under the same lock as user edits: never repair an obsolete snapshot.
    const row = (await this.objectRecords('dashboard', catalog)).find(row => row.id === id);
    if (!row) throw new Error('视图已移除');
    const originalPayload = String(row.payload);
    const board = normalizeDashboard(JSON.parse(originalPayload));
    if (board.id !== id || (board.databaseName && board.databaseName !== catalog)) throw new Error('看板身份无效');
    if (!layoutOverlaps(board.items)) return board;
    const previous = (await this.objectRecords('dashboard-layout-backup', catalog)).find(row => row.id === id);
    const geometry = JSON.stringify(board.items.map(({i,x,y,w,h})=>({i,x,y,w,h})));
    if (previous && JSON.parse(String(previous.payload)).restoredGeometry === geometry) return board;
    const repaired = {...repairDashboardLayout(board), databaseName: catalog, updatedAt: Date.now()};
    await this.putObject('dashboard-layout-backup', {id, databaseName:catalog, originalPayload, repairedAt:Date.now()} as any);
    await this.putObject('dashboard', repaired);
    reportDashboardIncident({stage:'configuration',catalog,boardId:id,code:'layout-auto-repaired'});
    return repaired;
  }

  async getDashboardLayoutBackup(id: string, catalog: string): Promise<boolean> {
    return (await this.objectRecords('dashboard-layout-backup', catalog)).some(row => row.id === id);
  }

  async restoreDashboardLayout(id: string, catalog: string): Promise<Dashboard> {
    return this.queueDashboardWrite(catalog, id, async () => {
      const row = (await this.objectRecords('dashboard-layout-backup', catalog)).find(row => row.id === id);
      if (!row) throw new Error('没有可恢复的修复前备份');
      if (!(await this.objectRecords('dashboard',catalog)).some(row => row.id === id)) throw new Error('视图已移除');
      const backup = JSON.parse(String(row.payload));
      const { normalizeDashboard } = await import('./workbench/dashboardFormat');
      const original = normalizeDashboard(JSON.parse(backup.originalPayload));
      if (original.id !== id || (original.databaseName && original.databaseName !== catalog)) throw new Error('备份身份无效');
      const restored = {...original,databaseName:catalog,updatedAt:Date.now()};
      // Persist the exemption first. A failed restoration leaves the repaired board intact.
      await this.putObject('dashboard-layout-backup', {...backup, id, databaseName:catalog,
        restoredGeometry:JSON.stringify(restored.items.map(({i,x,y,w,h})=>({i,x,y,w,h})))});
      await this.putObject('dashboard',restored);
      return restored;
    });
  }

  private async readDashboards(catalog: string, lockedId?: string): Promise<Dashboard[]> {
    const { normalizeDashboard } = await import('./workbench/dashboardFormat');
    const { layoutOverlaps } = await import('./workbench/dashboardFormat');
    const rows = await this.objectRecords('dashboard',catalog);
    const boards: Dashboard[] = [], issues: Array<{id:string;message:string}> = [];
    for (const row of rows.filter(row => !lockedId || String(row.id) === lockedId)) {
      try {
        let board = normalizeDashboard(JSON.parse(String(row.payload)));
        if (board.id !== String(row.id)) throw new Error('看板记录身份无效');
        if (board.databaseName && board.databaseName !== catalog) throw new Error('看板数据库归属无效');
        if (layoutOverlaps(board.items)) board = lockedId === board.id
          ? await this.repairStoredDashboard(catalog, board.id)
          : await this.queueDashboardWrite(catalog, board.id, () => this.repairStoredDashboard(catalog, board.id));
        boards.push(board);
      } catch (error) {
        const id = String(row.id);
        issues.push({id, message:`视图 ${id} 的配置无法读取，原记录已保留：${String((error as Error).message)}`});
        reportDashboardIncident({stage:'configuration',catalog,boardId:id,code:'invalid-dashboard-record'});
      }
    }
    this.dashboardReadIssues.set(catalog, issues);
    return boards;
  }

  async deleteDashboard(id: string, databaseName?: string): Promise<void> {
    await this.deleteObject('dashboard', id, databaseName);
  }

  async saveDomainSetting<T>(key: string, value: T, databaseName?: string): Promise<void> {
    const catalog = await this.catalog(databaseName);
    if(await this.isReadonlyConfiguration(catalog)) {
      await writeSidecar({catalog,kind:'setting',id:key,payload:JSON.stringify(value),updated_at:Date.now()});
      return;
    }
    const table = await this.ensureMetadata(catalog);
    await duckDBService.query(`INSERT OR REPLACE INTO ${table} VALUES ('setting', ${quoteLiteral(key)}, ${quoteLiteral(JSON.stringify(value))}, ${Date.now()})`);
  }

  async getDomainSetting<T>(key: string, databaseName?: string): Promise<T | null> {
    const catalog = await this.catalog(databaseName);
    if(await this.isReadonlyConfiguration(catalog)) {
      const rows=await this.objectRecords('setting',catalog);
      const row=rows.find(row=>row.id===key);
      return row ? JSON.parse(String(row.payload)) as T : null;
    }
    const table = await this.ensureMetadata(catalog);
    const rows = await duckDBService.query(`SELECT payload FROM ${table} WHERE kind = 'setting' AND id = ${quoteLiteral(key)}`);
    return rows.length ? JSON.parse(String(rows[0].payload)) as T : null;
  }
}

export const dbService = new DBService();
