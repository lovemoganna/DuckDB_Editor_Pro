// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dataImportService, detectFormatFromName, formatBytes } from './dataImportService';
import { duckDBService } from './duckdbService';

describe('dataImportService unit & logic tests', () => {
  it('detectFormatFromName correctly detects file extensions', () => {
    expect(detectFormatFromName('events.parquet')).toBe('Parquet');
    expect(detectFormatFromName('data.json')).toBe('JSON');
    expect(detectFormatFromName('data.jsonl')).toBe('JSON');
    expect(detectFormatFromName('report.tsv')).toBe('TSV');
    expect(detectFormatFromName('dataset.tab')).toBe('TSV');
    expect(detectFormatFromName('sheet.xlsx')).toBe('Excel');
    expect(detectFormatFromName('raw.csv')).toBe('CSV');
    expect(detectFormatFromName('unknown.txt')).toBe('CSV');
  });

  it('formatBytes formats bytes correctly', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1024 * 1024 * 12.4)).toBe('12.4 MB');
  });

  it('validateTarget validates SQL table names and conflict modes', async () => {
    // Mock duckDBService query for checking table existence
    vi.spyOn(duckDBService, 'query').mockImplementation(async (sql: string) => {
      if (sql.includes('information_schema.tables')) {
        // simulate existing_table exists
        if (sql.includes('existing_table')) {
          return [{ table_name: 'existing_table' }];
        }
        return [];
      }
      if (sql.includes('count(*) as cnt')) {
        return [{ cnt: 100 }];
      }
      return [];
    });

    vi.spyOn(duckDBService, 'getTableColumnDefinitions').mockResolvedValue([
      { name: 'id', type: 'BIGINT' },
      { name: 'name', type: 'VARCHAR' },
    ]);

    // Test empty table name
    const resEmpty = await dataImportService.validateTarget('main', '', 'replace', []);
    expect(resEmpty.valid).toBe(false);
    expect(resEmpty.error).toMatch(/表名不能为空/);

    // Test invalid identifier
    const resInvalid = await dataImportService.validateTarget('main', '123_invalid', 'replace', []);
    expect(resInvalid.valid).toBe(false);
    expect(resInvalid.error).toMatch(/不能以数字开头/);

    // Test new non-existing table
    const resNew = await dataImportService.validateTarget('main', 'new_table', 'fail', []);
    expect(resNew.valid).toBe(true);
    expect(resNew.tableExists).toBe(false);

    // Test existing table with 'fail' mode -> should fail
    const resFail = await dataImportService.validateTarget('main', 'existing_table', 'fail', []);
    expect(resFail.valid).toBe(false);
    expect(resFail.error).toMatch(/已存在/);

    // Test existing table with 'replace' mode -> valid with warning
    const resReplace = await dataImportService.validateTarget('main', 'existing_table', 'replace', []);
    expect(resReplace.valid).toBe(true);
    expect(resReplace.warning).toMatch(/将彻底覆盖删除旧表/);
  });

  it('detectFormatFromName handles uppercase extensions correctly', () => {
    expect(detectFormatFromName('DATA.XLSX')).toBe('Excel');
    expect(detectFormatFromName('REPORT.CSV')).toBe('CSV');
    expect(detectFormatFromName('DATA.PARQUET')).toBe('Parquet');
  });

  it('executeBatchImport imports multiple sheets and detects duplicates', async () => {
    vi.spyOn(dataImportService, 'executeImport').mockImplementation(async (rawSql, schema, tableName) => {
      return {
        schema,
        tableName,
        rowCount: 5,
        columnsCount: 2,
        verified: true,
        durationMs: 10,
        sampleRows: [],
      };
    });

    // Test duplicate target table names
    await expect(
      dataImportService.executeBatchImport(
        'main',
        [
          { sheetName: 'Sheet1', tableName: 'same_table', rawSqlSource: "read_csv_auto('v1.csv')", columns: [] },
          { sheetName: 'Sheet2', tableName: 'same_table', rawSqlSource: "read_csv_auto('v2.csv')", columns: [] },
        ],
        'replace'
      )
    ).rejects.toThrow(/目标表名重复/);

    // Test successful batch import
    const batchRes = await dataImportService.executeBatchImport(
      'main',
      [
        { sheetName: 'Customers', tableName: 'ecommerce_customers', rawSqlSource: "read_csv_auto('v1.csv')", columns: [] },
        { sheetName: 'Orders', tableName: 'ecommerce_orders', rawSqlSource: "read_csv_auto('v2.csv')", columns: [] },
      ],
      'replace'
    );

    expect(batchRes.results).toHaveLength(2);
    expect(batchRes.totalRows).toBe(10);
    expect(batchRes.createdTables).toEqual(['ecommerce_customers', 'ecommerce_orders']);
  });
});
