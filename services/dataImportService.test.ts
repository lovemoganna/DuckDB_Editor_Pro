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

  it('detectFormatFromName correctly identifies remote URLs including Google Sheets and queries', () => {
    // Google Sheets export link (as reported by user)
    expect(
      detectFormatFromName(
        'https://docs.google.com/spreadsheets/d/1YRLbfW3qCs2PjSjt87-gqWevgkNRGdRqB-21ngGDWSs/export?format=xlsx'
      )
    ).toBe('Excel');

    // Google Sheets browser edit link
    expect(
      detectFormatFromName(
        'https://docs.google.com/spreadsheets/d/1YRLbfW3qCs2PjSjt87-gqWevgkNRGdRqB-21ngGDWSs/edit#gid=0'
      )
    ).toBe('Excel');

    // Remote file with auth tokens
    expect(detectFormatFromName('https://example.com/data.xlsx?token=abc')).toBe('Excel');
    expect(detectFormatFromName('https://example.com/data.XLSX?auth=1')).toBe('Excel');
    expect(detectFormatFromName('export?format=xlsx')).toBe('Excel');

    // Other formats via query params or URLs
    expect(detectFormatFromName('https://example.com/api/export?format=csv')).toBe('CSV');
    expect(detectFormatFromName('https://example.com/api/export?format=tsv')).toBe('TSV');
    expect(detectFormatFromName('https://example.com/api/export?format=parquet')).toBe('Parquet');
    expect(detectFormatFromName('https://example.com/api/export?format=json')).toBe('JSON');
  });

  it('normalizeRemoteUrl normalizes Google Sheets links into export links', async () => {
    const { normalizeRemoteUrl } = await import('./dataImportService');

    // Google Sheets edit link
    expect(
      normalizeRemoteUrl(
        'https://docs.google.com/spreadsheets/d/1YRLbfW3qCs2PjSjt87-gqWevgkNRGdRqB-21ngGDWSs/edit#gid=0'
      )
    ).toBe(
      'https://docs.google.com/spreadsheets/d/1YRLbfW3qCs2PjSjt87-gqWevgkNRGdRqB-21ngGDWSs/export?format=xlsx'
    );

    // Google Sheets link with CSV format specified
    expect(
      normalizeRemoteUrl(
        'https://docs.google.com/spreadsheets/d/1YRLbfW3qCs2PjSjt87-gqWevgkNRGdRqB-21ngGDWSs/edit',
        'CSV'
      )
    ).toBe(
      'https://docs.google.com/spreadsheets/d/1YRLbfW3qCs2PjSjt87-gqWevgkNRGdRqB-21ngGDWSs/export?format=csv'
    );

    // Existing export link is preserved
    const exportUrl =
      'https://docs.google.com/spreadsheets/d/1YRLbfW3qCs2PjSjt87-gqWevgkNRGdRqB-21ngGDWSs/export?format=xlsx';
    expect(normalizeRemoteUrl(exportUrl)).toBe(exportUrl);
  });

  it('parseFilenameFromContentDisposition correctly parses attachment filenames', async () => {
    const { parseFilenameFromContentDisposition } = await import('./dataImportService');

    expect(
      parseFilenameFromContentDisposition(
        'attachment; filename="exchange_funds_flow_dataset.xlsx"; filename*=UTF-8\'\'exchange_funds_flow_dataset.xlsx'
      )
    ).toBe('exchange_funds_flow_dataset.xlsx');

    expect(
      parseFilenameFromContentDisposition('attachment; filename="orders_2026.xlsx"')
    ).toBe('orders_2026.xlsx');

    expect(
      parseFilenameFromContentDisposition("attachment; filename*=UTF-8''%E8%B4%A2%E5%8A%A1%E6%8A%A5%E8%A1%A8.xlsx")
    ).toBe('财务报表.xlsx');

    expect(parseFilenameFromContentDisposition(null)).toBeNull();
  });

  it('sniffSource successfully downloads and parses remote Excel URLs with multiple sheets', async () => {
    const { workbookIO } = await import('./workbookIO');

    // Create a real Excel buffer with 2 sheets
    const excelBuffer = await workbookIO.createWorkbookBuffer([
      {
        name: 'users',
        headers: ['user_id', 'username', 'balance'],
        rows: [
          [1, 'Alice', 100],
          [2, 'Bob', 250.5],
        ],
      },
      {
        name: 'transactions',
        headers: ['tx_id', 'amount', 'currency'],
        rows: [
          ['tx_001', 50.0, 'USD'],
          ['tx_002', 120.0, 'EUR'],
        ],
      },
    ]);

    // Mock fetch
    const mockHeaders = new Headers();
    mockHeaders.set(
      'content-disposition',
      'attachment; filename="exchange_funds_flow_dataset.xlsx"'
    );
    mockHeaders.set(
      'content-type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    const mockResponse = {
      ok: true,
      status: 200,
      headers: mockHeaders,
      blob: async () => new Blob([excelBuffer]),
      arrayBuffer: async () => excelBuffer,
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as any);

    // Mock duckDBService query for describe and preview
    vi.spyOn(duckDBService, 'registerFileText').mockResolvedValue(undefined);
    vi.spyOn(duckDBService, 'query').mockImplementation(async (sql: string) => {
      if (sql.includes('DESCRIBE')) {
        return [
          { column_name: 'col_a', column_type: 'VARCHAR', null: 'NO' },
          { column_name: 'col_b', column_type: 'DOUBLE', null: 'YES' },
        ];
      }
      if (sql.includes('LIMIT 100')) {
        return [{ col_a: 'test_val', col_b: 42 }];
      }
      if (sql.includes('count(*)')) {
        return [{ cnt: 2 }];
      }
      return [];
    });

    const targetUrl =
      'https://docs.google.com/spreadsheets/d/1YRLbfW3qCs2PjSjt87-gqWevgkNRGdRqB-21ngGDWSs/export?format=xlsx';

    const result = await dataImportService.sniffSource('url', null, targetUrl, '', {
      format: 'Excel',
      delimiter: ',',
      quote: '"',
      header: true,
      encoding: 'UTF-8',
    });

    expect(result.format).toBe('Excel');
    expect(result.fileName).toBe('exchange_funds_flow_dataset.xlsx');
    expect(result.sheets).toHaveLength(2);
    expect(result.sheets![0].name).toBe('users');
    expect(result.sheets![1].name).toBe('transactions');
    expect(result.sheets![0].targetTableName).toBe('exchange_funds_flow_dataset_users');
    expect(result.sheets![1].targetTableName).toBe('exchange_funds_flow_dataset_transactions');
    expect(result.columns).toHaveLength(2);
    expect(result.previewRows).toHaveLength(1);

    fetchSpy.mockRestore();
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
