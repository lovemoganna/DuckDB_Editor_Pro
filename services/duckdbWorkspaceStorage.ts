import { closeDatabaseOnVersionChange } from './indexedDBLifecycle';

const DB_NAME = 'duckdb_workspace_cache';
const DB_VERSION = 1;
const STORE_NAME = 'workspace_cache';
const SNAPSHOT_KEY = 'latest_snapshot';

export interface DuckDBTableSnapshot {
  name: string;
  ddl: string;
  rows: Record<string, any>[];
}

export interface DuckDBViewSnapshot {
  name: string;
  sql: string;
}

export interface DuckDBMacroSnapshot {
  name: string;
  sql: string;
}

export interface DuckDBWorkspaceSnapshot {
  version: 1;
  updatedAt: number;
  tables: DuckDBTableSnapshot[];
  views: DuckDBViewSnapshot[];
  macros: DuckDBMacroSnapshot[];
  canvasEdges?: any[];
  canvasNodes?: any[];
}

export interface WorkspaceCacheInfo {
  hasCache: boolean;
  updatedAt?: number;
  tableCount: number;
  rowCount: number;
  viewCount: number;
  sizeBytes?: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not available in current environment'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(closeDatabaseOnVersionChange(request.result));

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Save full workspace snapshot to IndexedDB
 */
export async function saveWorkspaceSnapshot(snapshot: DuckDBWorkspaceSnapshot): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const request = store.put(snapshot, SNAPSHOT_KEY);
      request.onsuccess = () => {
        db.close();
        resolve();
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    console.warn('[duckdbWorkspaceStorage] Failed to save workspace snapshot:', error);
  }
}

/**
 * Load workspace snapshot from IndexedDB
 */
export async function loadWorkspaceSnapshot(): Promise<DuckDBWorkspaceSnapshot | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      const request = store.get(SNAPSHOT_KEY);
      request.onsuccess = () => {
        db.close();
        const result = request.result;
        if (result && typeof result === 'object' && Array.isArray(result.tables)) {
          resolve(result as DuckDBWorkspaceSnapshot);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    console.warn('[duckdbWorkspaceStorage] Failed to load workspace snapshot:', error);
    return null;
  }
}

/**
 * Clear workspace cache from IndexedDB
 */
export async function clearWorkspaceSnapshot(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const request = store.delete(SNAPSHOT_KEY);
      request.onsuccess = () => {
        db.close();
        resolve();
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    console.warn('[duckdbWorkspaceStorage] Failed to clear workspace snapshot:', error);
  }
}

/**
 * Get summary metadata of cached workspace in IndexedDB
 */
export async function getWorkspaceCacheInfo(): Promise<WorkspaceCacheInfo> {
  const snapshot = await loadWorkspaceSnapshot();
  if (!snapshot || !snapshot.tables) {
    return {
      hasCache: false,
      tableCount: 0,
      rowCount: 0,
      viewCount: 0,
    };
  }

  let totalRows = 0;
  for (const t of snapshot.tables) {
    totalRows += Array.isArray(t.rows) ? t.rows.length : 0;
  }

  let estimatedSize = 0;
  try {
    estimatedSize = JSON.stringify(snapshot).length;
  } catch {
    // fallback
  }

  return {
    hasCache: snapshot.tables.length > 0 || (snapshot.views?.length ?? 0) > 0,
    updatedAt: snapshot.updatedAt,
    tableCount: snapshot.tables.length,
    rowCount: totalRows,
    viewCount: snapshot.views?.length ?? 0,
    sizeBytes: estimatedSize,
  };
}
