// Database service for managing analysis history (from schema generator)
import { SavedAnalysis, SavedQuery, type Dashboard } from '../types';
import { closeDatabaseOnVersionChange } from './indexedDBLifecycle';
import { duckDBService } from './duckdbService';
import { quoteIdent, quoteLiteral } from './databaseCatalog';

class DBService {
  private dbName = 'DuckDBSchemaGenerator';
  private version = 3; // Upgraded to support dashboards
  private readonly metadataSchema = '__studio';
  private metadataReady = new Map<string, Promise<string>>();
  private dashboardWrites = new Map<string, Promise<unknown>>();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('duckdb-database-changed', () => this.metadataReady.clear());
    }
  }

  private async catalog(databaseName?: string): Promise<string> {
    if (databaseName) return databaseName;
    return (await duckDBService.getCurrentCatalogAndSchema()).catalog;
  }

  private metadataTable(catalog: string): string {
    return `${quoteIdent(catalog)}.${quoteIdent(this.metadataSchema)}.${quoteIdent('objects')}`;
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

  private async putObject(kind: 'query' | 'dashboard', item: { id: string; databaseName?: string }): Promise<void> {
    const catalog = await this.catalog(item.databaseName);
    const table = await this.ensureMetadata(catalog);
    const payload = JSON.stringify({ ...item, databaseName: catalog });
    await duckDBService.query(`INSERT OR REPLACE INTO ${table} VALUES (${quoteLiteral(kind)}, ${quoteLiteral(item.id)}, ${quoteLiteral(payload)}, ${Date.now()})`);
  }

  private async objects<T>(kind: 'query' | 'dashboard', databaseName?: string): Promise<T[]> {
    const catalog = await this.catalog(databaseName);
    const table = await this.ensureMetadata(catalog);
    const rows = await duckDBService.query(`SELECT payload FROM ${table} WHERE kind = ${quoteLiteral(kind)} ORDER BY updated_at DESC`);
    return rows.map((row) => JSON.parse(String(row.payload)) as T);
  }

  private async deleteObject(kind: 'query' | 'dashboard', id: string, databaseName?: string): Promise<void> {
    const catalog = await this.catalog(databaseName);
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
    const catalog = await this.catalog(dashboard.databaseName);
    await this.queueDashboardWrite(catalog, dashboard.id, () => this.putObject('dashboard', { ...dashboard, databaseName: catalog }));
  }

  /** Apply a user edit to the latest persisted view, never to a stale render snapshot. */
  async updateDashboard(id: string, catalog: string, edit: (current: Dashboard) => Dashboard): Promise<Dashboard> {
    return this.queueDashboardWrite(catalog, id, async () => {
      const current = (await this.getDashboards(catalog)).find(board => board.id === id);
      if (!current) throw new Error('此工作台视图已不存在，请重新选择');
      const next = edit(current);
      if (next.id !== id || next.databaseName !== catalog) throw new Error('工作台身份已改变，请重新打开视图');
      const updated = { ...next, updatedAt: Date.now() };
      await this.putObject('dashboard', updated);
      return updated;
    });
  }

  async getDashboards(databaseName?: string): Promise<any[]> {
    const { normalizeDashboard } = await import('./workbench/dashboardFormat');
    return (await this.objects<any>('dashboard', databaseName)).map(normalizeDashboard);
  }

  async deleteDashboard(id: string, databaseName?: string): Promise<void> {
    await this.deleteObject('dashboard', id, databaseName);
  }

  async saveDomainSetting<T>(key: string, value: T, databaseName?: string): Promise<void> {
    const catalog = await this.catalog(databaseName);
    const table = await this.ensureMetadata(catalog);
    await duckDBService.query(`INSERT OR REPLACE INTO ${table} VALUES ('setting', ${quoteLiteral(key)}, ${quoteLiteral(JSON.stringify(value))}, ${Date.now()})`);
  }

  async getDomainSetting<T>(key: string, databaseName?: string): Promise<T | null> {
    const catalog = await this.catalog(databaseName);
    const table = await this.ensureMetadata(catalog);
    const rows = await duckDBService.query(`SELECT payload FROM ${table} WHERE kind = 'setting' AND id = ${quoteLiteral(key)}`);
    return rows.length ? JSON.parse(String(rows[0].payload)) as T : null;
  }
}

export const dbService = new DBService();
