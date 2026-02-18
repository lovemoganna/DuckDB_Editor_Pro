// Database service for managing analysis history (from schema generator)
import { SavedAnalysis, SavedQuery } from '../types';

class DBService {
  private dbName = 'DuckDBSchemaGenerator';
  private version = 3; // Upgraded to support dashboards

  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

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
    const db = await this.openDB();
    const transaction = db.transaction(['snippets'], 'readwrite');
    const store = transaction.objectStore('snippets');
    await new Promise<void>((resolve, reject) => {
      const request = store.put(query);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    db.close();
  }

  async getQueries(): Promise<SavedQuery[]> {
    const db = await this.openDB();
    const transaction = db.transaction(['snippets'], 'readonly');
    const store = transaction.objectStore('snippets');
    return new Promise<SavedQuery[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        resolve(request.result.sort((a: any, b: any) => b.createdAt - a.createdAt));
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteQuery(id: string): Promise<void> {
    const db = await this.openDB();
    const transaction = db.transaction(['snippets'], 'readwrite');
    const store = transaction.objectStore('snippets');
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    db.close();
  }

  // --- Dashboard Operations (v3) ---

  async saveDashboard(dashboard: any): Promise<void> {
    const db = await this.openDB();
    const transaction = db.transaction(['dashboards'], 'readwrite');
    const store = transaction.objectStore('dashboards');
    await new Promise<void>((resolve, reject) => {
      const request = store.put(dashboard);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    db.close();
  }

  async getDashboards(): Promise<any[]> {
    const db = await this.openDB();
    const transaction = db.transaction(['dashboards'], 'readonly');
    const store = transaction.objectStore('dashboards');
    return new Promise<any[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        resolve(request.result.sort((a: any, b: any) => b.updatedAt - a.updatedAt));
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteDashboard(id: string): Promise<void> {
    const db = await this.openDB();
    const transaction = db.transaction(['dashboards'], 'readwrite');
    const store = transaction.objectStore('dashboards');
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    db.close();
  }
}

export const dbService = new DBService();
