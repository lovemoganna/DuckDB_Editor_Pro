import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { closeDatabaseOnVersionChange } from './indexedDBLifecycle';

function openDatabase(factory: IDBFactory, name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('records');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deleteDatabase(factory: IDBFactory, name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = factory.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('delete was blocked'));
  });
}

describe('IndexedDB connection lifecycle', () => {
  it('releases an app connection when an exact restore requests deletion', async () => {
    const factory = new IDBFactory();
    const database = await openDatabase(factory, 'duckdb_library');
    closeDatabaseOnVersionChange(database);

    await expect(deleteDatabase(factory, 'duckdb_library')).resolves.toBeUndefined();
    await expect(factory.databases()).resolves.toEqual([]);
  });
});
