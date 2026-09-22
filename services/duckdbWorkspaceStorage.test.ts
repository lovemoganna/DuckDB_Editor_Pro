import { describe, expect, it, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
  saveWorkspaceSnapshot,
  loadWorkspaceSnapshot,
  clearWorkspaceSnapshot,
  getWorkspaceCacheInfo,
  type DuckDBWorkspaceSnapshot,
} from './duckdbWorkspaceStorage';

describe('duckdbWorkspaceStorage', () => {
  beforeEach(() => {
    // Inject fresh fake-indexeddb for tests
    (globalThis as any).indexedDB = new IDBFactory();
  });

  it('saves and loads a workspace snapshot correctly', async () => {
    const mockSnapshot: DuckDBWorkspaceSnapshot = {
      version: 1,
      updatedAt: 1700000000000,
      tables: [
        {
          name: 'users',
          ddl: 'CREATE TABLE users (id INT, name VARCHAR);',
          rows: [
            { id: 1, name: 'Alice' },
            { id: 2, name: 'Bob' },
          ],
        },
      ],
      views: [
        {
          name: 'active_users',
          sql: 'SELECT * FROM users WHERE id > 0',
        },
      ],
      macros: [],
    };

    await saveWorkspaceSnapshot(mockSnapshot);

    const loaded = await loadWorkspaceSnapshot();
    expect(loaded).not.toBeNull();
    expect(loaded?.version).toBe(1);
    expect(loaded?.tables).toHaveLength(1);
    expect(loaded?.tables[0].name).toBe('users');
    expect(loaded?.tables[0].rows).toHaveLength(2);
    expect(loaded?.views).toHaveLength(1);
    expect(loaded?.views[0].name).toBe('active_users');
  });

  it('provides accurate cache info summary', async () => {
    const infoBefore = await getWorkspaceCacheInfo();
    expect(infoBefore.hasCache).toBe(false);
    expect(infoBefore.tableCount).toBe(0);

    const mockSnapshot: DuckDBWorkspaceSnapshot = {
      version: 1,
      updatedAt: 1700000000000,
      tables: [
        {
          name: 'orders',
          ddl: 'CREATE TABLE orders (id INT, amount DOUBLE);',
          rows: [{ id: 101, amount: 99.5 }],
        },
      ],
      views: [],
      macros: [],
    };

    await saveWorkspaceSnapshot(mockSnapshot);

    const infoAfter = await getWorkspaceCacheInfo();
    expect(infoAfter.hasCache).toBe(true);
    expect(infoAfter.tableCount).toBe(1);
    expect(infoAfter.rowCount).toBe(1);
    expect(infoAfter.updatedAt).toBe(1700000000000);
  });

  it('clears workspace snapshot cache completely', async () => {
    const mockSnapshot: DuckDBWorkspaceSnapshot = {
      version: 1,
      updatedAt: 1700000000000,
      tables: [
        {
          name: 'items',
          ddl: 'CREATE TABLE items (id INT);',
          rows: [{ id: 1 }],
        },
      ],
      views: [],
      macros: [],
    };

    await saveWorkspaceSnapshot(mockSnapshot);
    expect(await loadWorkspaceSnapshot()).not.toBeNull();

    await clearWorkspaceSnapshot();
    expect(await loadWorkspaceSnapshot()).toBeNull();

    const info = await getWorkspaceCacheInfo();
    expect(info.hasCache).toBe(false);
    expect(info.tableCount).toBe(0);
  });
});
