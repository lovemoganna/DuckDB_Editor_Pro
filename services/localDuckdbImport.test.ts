// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { allocateImportTableNames } from './importTableNames';
import { dataImportService } from './dataImportService';
import { duckDBService } from './duckdbService';

afterEach(() => vi.restoreAllMocks());

const options = { format: 'DuckDB' as const, delimiter: ',', quote: '"', header: true, encoding: 'UTF-8' };
function databaseFile() {
  const bytes = new Uint8Array(32);
  bytes.set([68, 85, 67, 75], 8);
  return { name: '2026.backup.DUCKDB', size: 32, arrayBuffer: async () => bytes.buffer } as File;
}

describe('local DuckDB database import regressions', () => {
  it('keeps an in-flight preview catalog mounted until its reads finish when another preview starts', async () => {
    vi.spyOn(duckDBService, 'registerFileBuffer').mockResolvedValue();
    vi.spyOn(duckDBService, 'dropFile').mockResolvedValue();
    await dataImportService.cleanupVirtualFiles();
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let reading = false;
    let held = false;
    const query = vi.spyOn(duckDBService, 'query').mockImplementation(async sql => {
      if (sql.includes('information_schema.tables')) {
        if (!held) { held = true; reading = true; await gate; reading = false; }
        return [{ table_schema: 'main', table_name: 'orders' }];
      }
      if (sql.startsWith('DETACH') && reading) throw new Error('preview detached during metadata read');
      if (sql.startsWith('DESCRIBE')) return [{ column_name: 'id', column_type: 'INTEGER', null: 'NO' }];
      if (sql.includes('count(*)')) return [{ cnt: 1 }];
      return [];
    });
    const first = dataImportService.sniffSource('local', databaseFile(), '', '', options);
    await vi.waitFor(() => expect(reading).toBe(true));
    const second = dataImportService.sniffSource('local', databaseFile(), '', '', options);
    try {
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(query.mock.calls.filter(([sql]) => sql.startsWith('DETACH'))).toHaveLength(0);
    } finally { release(); await Promise.all([first, second]); await dataImportService.cleanupVirtualFiles(); }
  });

  it('allocates distinct names for schemas, case and sanitized-name collisions', () => {
    const names = allocateImportTableNames('2026.backup', [
      { schema: 'main', name: 'orders' }, { schema: 'sales', name: 'orders' },
      { name: 'ORDERS' }, { name: 'orders_sales' }, { name: 'a-b' }, { name: 'a b' },
    ]);
    expect(new Set(names.map(name => name.toLowerCase())).size).toBe(6);
    expect(names.every(name => /^[a-zA-Z_]/.test(name))).toBe(true);
    expect(names[3]).toBe('_2026_backup_orders_sales');
  });

  it('parses same-named tables in different schemas, empty tables and quoted identifiers', async () => {
    vi.spyOn(duckDBService, 'registerFileBuffer').mockResolvedValue();
    vi.spyOn(duckDBService, 'dropFile').mockResolvedValue();
    const query = vi.spyOn(duckDBService, 'query').mockImplementation(async sql => {
      if (sql.includes('information_schema.tables')) return [
        { table_schema: 'main', table_name: 'orders' },
        { table_schema: 'sales', table_name: 'orders' },
        { table_schema: 'main', table_name: 'quoted"table' },
      ];
      if (sql.startsWith('DESCRIBE')) return [{ column_name: 'id', column_type: 'INTEGER', null: 'YES' }];
      if (sql.includes('count(*)')) return [{ cnt: 0 }];
      return [];
    });
    const metadata = await dataImportService.sniffSource('local', databaseFile(), '', '', options);
    expect(metadata.format).toBe('DuckDB');
    expect(metadata.sheets?.map(table => table.name)).toEqual(['main.orders', 'sales.orders', 'quoted"table']);
    expect(new Set(metadata.sheets?.map(table => table.targetTableName)).size).toBe(3);
    expect(metadata.sheets?.every(table => table.selected && table.isEmpty && table.columns.length === 1)).toBe(true);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('"quoted""table"'));
    await dataImportService.cleanupVirtualFiles();
  });

  it('rejects invalid database bytes before registering or attaching', async () => {
    const register = vi.spyOn(duckDBService, 'registerFileBuffer');
    const file = { ...databaseFile(), arrayBuffer: async () => new ArrayBuffer(32) } as File;
    await expect(dataImportService.sniffSource('local', file, '', '', options)).rejects.toThrow('不是有效');
    expect(register).not.toHaveBeenCalled();
  });

  it('cleans up when attachment fails and propagates the engine error', async () => {
    vi.spyOn(duckDBService, 'registerFileBuffer').mockResolvedValue();
    const drop = vi.spyOn(duckDBService, 'dropFile').mockResolvedValue();
    vi.spyOn(duckDBService, 'query').mockRejectedValue(new Error('unsupported database version'));
    await expect(dataImportService.sniffSource('local', databaseFile(), '', '', options)).rejects.toThrow('unsupported database version');
    expect(drop).toHaveBeenCalledWith(expect.stringMatching(/\.duckdb$/));
  });

  it('scopes conflict checks to the active catalog and compares names ignoring case', async () => {
    const query = vi.spyOn(duckDBService, 'query').mockResolvedValue([]);
    expect((await dataImportService.validateTarget('main', 'Orders', 'fail', [])).valid).toBe(true);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('table_catalog = current_database()'));
    expect(query).toHaveBeenCalledWith(expect.stringContaining("lower(table_name) = lower('Orders')"));
  });

  it('blocks append with unmapped columns even when column counts match', async () => {
    vi.spyOn(duckDBService, 'query').mockResolvedValue([{ table_name: 'orders', cnt: 1 }]);
    vi.spyOn(duckDBService, 'getTableColumnDefinitions').mockResolvedValue([{ name: 'old', type: 'INTEGER' }]);
    const result = await dataImportService.validateTarget('main', 'orders', 'append', [
      { index: 1, sourceName: 'new', targetName: 'new', inferredType: 'INTEGER', nullable: true, sampleValue: '' },
    ]);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('列结构不兼容');
  });

  it('does not treat catalog-query failures as permission to create or overwrite', async () => {
    vi.spyOn(duckDBService, 'query').mockRejectedValue(new Error('database unavailable'));
    expect((await dataImportService.validateTarget('main', 'orders', 'replace', [])).valid).toBe(false);
  });

  it('checks later batch targets before any write', async () => {
    vi.spyOn(dataImportService, 'validateTarget').mockResolvedValueOnce({ valid: true, tableExists: false })
      .mockResolvedValueOnce({ valid: false, tableExists: true, error: 'orders already exists' });
    const execute = vi.spyOn(dataImportService, 'executeImport');
    await expect(dataImportService.executeBatchImport('main', [
      { sheetName: 'a', tableName: 'a', rawSqlSource: 'a', columns: [] },
      { sheetName: 'b', tableName: 'orders', rawSqlSource: 'b', columns: [] },
    ], 'fail')).rejects.toThrow('already exists');
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects case-only duplicate destinations before any write', async () => {
    const execute = vi.spyOn(dataImportService, 'executeImport');
    await expect(dataImportService.executeBatchImport('main', [
      { sheetName: 'a', tableName: 'Orders', rawSqlSource: 'a', columns: [] },
      { sheetName: 'b', tableName: 'orders', rawSqlSource: 'b', columns: [] },
    ], 'replace')).rejects.toThrow('目标表名重复');
    expect(execute).not.toHaveBeenCalled();
  });

  it('replaces a case-only existing table in one transaction and preserves write failures', async () => {
    vi.spyOn(duckDBService, 'getTableList').mockResolvedValue(['Orders']);
    const transaction = vi.spyOn(duckDBService, 'executeTransaction').mockRejectedValue(new Error('cast failed'));
    const query = vi.spyOn(duckDBService, 'query');
    await expect(dataImportService.executeImport('source', 'main', 'orders', 'replace', [])).rejects.toThrow('cast failed');
    expect(transaction).toHaveBeenCalledWith([
      'DROP TABLE "main"."orders";', expect.stringContaining('CREATE TABLE "main"."orders"'),
    ]);
    expect(query).not.toHaveBeenCalled();
  });
});
