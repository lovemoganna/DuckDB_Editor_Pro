import { describe, expect, it, vi } from 'vitest';
import {
  DatabaseCatalog,
  MEMORY_DATABASE_NAME,
  sanitizeDatabaseAlias,
  quoteIdent,
} from './databaseCatalog';

describe('databaseCatalog helpers', () => {
  it('sanitizes aliases and rejects reserved names', () => {
    expect(sanitizeDatabaseAlias('Sales Analytics')).toBe('Sales_Analytics');
    expect(() => sanitizeDatabaseAlias('memory')).toThrow(/保留/);
    expect(() => sanitizeDatabaseAlias('')).toThrow(/空/);
  });

  it('quotes identifiers safely', () => {
    expect(quoteIdent('a"b')).toBe('"a""b"');
  });
});

describe('DatabaseCatalog', () => {
  it('lists databases from duckdb_databases() and marks current', async () => {
    const execute = vi.fn(async (sql: string) => {
      if (sql.includes('current_database()')) {
        return [{ db: 'analytics' }];
      }
      if (sql.includes('duckdb_databases()')) {
        return [
          { database_name: 'memory', path: ':memory:', type: 'memory', readonly: false, internal: false },
          { database_name: 'analytics', path: 'opfs://analytics.duckdb', type: 'duckdb', readonly: false, internal: false },
          { database_name: 'duckdb_manager_workspace', path: 'opfs://duckdb_manager_workspace.duckdb', type: 'duckdb', readonly: false, internal: false },
        ];
      }
      return [];
    });

    const catalog = new DatabaseCatalog(execute, { supportsPersistentFiles: true });
    const dbs = await catalog.listDatabases();
    expect(dbs.map((d) => d.name)).toEqual(['memory', 'analytics', 'duckdb_manager_workspace']);
    expect(dbs.find((d) => d.name === 'duckdb_manager_workspace')?.isPrimary).toBe(true);
    expect(dbs.find((d) => d.name === 'analytics')?.isCurrent).toBe(true);
    expect(dbs.find((d) => d.name === 'analytics')?.persistent).toBe(true);
  });

  it('creates a persistent database via ATTACH and USE', async () => {
    const calls: string[] = [];
    let current = 'memory';
    const attached = new Set(['memory']);

    const execute = vi.fn(async (sql: string) => {
      calls.push(sql);
      if (sql.includes('current_database()')) return [{ db: current }];
      if (sql.includes('current_schema()')) return [{ sch: 'main' }];
      if (sql.includes('duckdb_databases()')) {
        return [...attached].map((name) => ({
          database_name: name,
          path: name === 'memory' ? ':memory:' : `opfs://${name}.duckdb`,
          type: name === 'memory' ? 'memory' : 'duckdb',
          readonly: false,
          internal: false,
        }));
      }
      if (sql.startsWith('ATTACH')) {
        attached.add('retail');
        return [];
      }
      if (sql.startsWith('USE')) {
        current = 'retail';
        return [];
      }
      return [];
    });

    const ensurePersistentFile = vi.fn(async () => 'opfs://retail.duckdb');
    const catalog = new DatabaseCatalog(execute, {
      supportsPersistentFiles: true,
      ensurePersistentFile,
    });

    const created = await catalog.createDatabase('retail');
    expect(ensurePersistentFile).toHaveBeenCalledWith('retail');
    expect(calls.some((c) => c.includes('ATTACH') && c.includes('opfs://retail.duckdb'))).toBe(true);
    expect(calls.some((c) => c.includes('USE "retail"'))).toBe(true);
    expect(created.name).toBe('retail');
    expect(created.isCurrent).toBe(true);
  });

  it('switches back to memory before detach and releases the file handle', async () => {
    let current = 'retail';
    const attached = new Set(['memory', 'retail']);
    const execute = vi.fn(async (sql: string) => {
      if (sql.includes('current_database()')) return [{ db: current }];
      if (sql.includes('current_schema()')) return [{ sch: 'main' }];
      if (sql.includes('duckdb_databases()')) {
        return [...attached].map((name) => ({
          database_name: name,
          path: name === 'memory' ? ':memory:' : `opfs://${name}.duckdb`,
          readonly: false,
          internal: false,
        }));
      }
      if (sql.startsWith('USE')) {
        current = MEMORY_DATABASE_NAME;
        return [];
      }
      if (sql.includes('DETACH')) {
        attached.delete('retail');
        return [];
      }
      return [];
    });
    const releasePersistentFile = vi.fn(async () => undefined);

    const catalog = new DatabaseCatalog(execute, {
      supportsPersistentFiles: true,
      releasePersistentFile,
    });

    await catalog.detachDatabase('retail');
    expect(current).toBe('memory');
    expect(releasePersistentFile).toHaveBeenCalledWith('retail');
    expect(attached.has('retail')).toBe(false);
  });

  it('refuses to detach memory', async () => {
    const catalog = new DatabaseCatalog(async () => [], { supportsPersistentFiles: false });
    await expect(catalog.detachDatabase('memory')).rejects.toThrow(/memory/);
  });
});
