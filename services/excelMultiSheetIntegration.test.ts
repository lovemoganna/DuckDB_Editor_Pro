// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { workbookIO } from './workbookIO';
import { dataImportService } from './dataImportService';
import { duckDBService } from './duckdbService';
import { allocateExcelTableNames } from './importTableNames';

describe('Excel Multi-Sheet Comprehensive Integration Pipeline', () => {
  it('parses and imports all sheets while handling empty, header-only, and distinct schema sheets', async () => {
    // 1. Create a multi-sheet workbook buffer
    const buffer = await workbookIO.createWorkbookBuffer([
      {
        name: 'Customers',
        headers: ['cust_id', 'cust_name', 'level'],
        rows: [
          [1, 'Alice Corp', 'Gold'],
          [2, 'Bob Tech', 'Silver'],
          [3, 'Charlie Ltd', 'Bronze'],
        ],
      },
      {
        name: 'Orders',
        headers: ['order_id', 'cust_id', 'amount', 'currency'],
        rows: [
          ['ORD-001', 1, 999.5, 'USD'],
          ['ORD-002', 2, 120.0, 'EUR'],
        ],
      },
      {
        name: 'Inventory_Template',
        headers: ['sku', 'stock_count', 'warehouse'],
        rows: [],
      },
      {
        name: 'Empty_Logs',
        headers: [],
        rows: [],
      },
    ]);

    const file = new File([buffer], 'multi_department_report.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    // 2. Test workbookIO.readAllSheets
    const parsedSheets = await workbookIO.readAllSheets(file);
    expect(parsedSheets).toHaveLength(4);

    const sheetCustomers = parsedSheets.find(s => s.name === 'Customers');
    expect(sheetCustomers).toBeDefined();
    expect(sheetCustomers?.rowCount).toBe(3);
    expect(sheetCustomers?.columnCount).toBe(3);
    expect(sheetCustomers?.isEmpty).toBe(false);

    const sheetOrders = parsedSheets.find(s => s.name === 'Orders');
    expect(sheetOrders).toBeDefined();
    expect(sheetOrders?.rowCount).toBe(2);
    expect(sheetOrders?.columnCount).toBe(4);
    expect(sheetOrders?.isEmpty).toBe(false);

    const sheetTemplate = parsedSheets.find(s => s.name === 'Inventory_Template');
    expect(sheetTemplate).toBeDefined();
    expect(sheetTemplate?.rowCount).toBe(0);
    expect(sheetTemplate?.columnCount).toBe(3);
    expect(sheetTemplate?.isEmpty).toBe(false);

    const sheetEmpty = parsedSheets.find(s => s.name === 'Empty_Logs');
    expect(sheetEmpty).toBeDefined();
    expect(sheetEmpty?.isEmpty).toBe(true);

    // Workbook parsing registers virtual files; the browser engine is outside this fixture.
    vi.spyOn(duckDBService, 'registerFileText').mockResolvedValue(undefined);
    vi.spyOn(duckDBService, 'query').mockResolvedValue([]);
    // 3. Test dataImportService.sniffSource
    const sniffResult = await dataImportService.sniffSource(
      'local',
      file,
      '',
      '',
      {
        format: 'Excel',
        delimiter: ',',
        quote: '"',
        header: true,
        encoding: 'UTF-8',
      }
    );

    expect(sniffResult.format).toBe('Excel');
    expect(sniffResult.sheets).toBeDefined();
    expect(sniffResult.sheets?.length).toBe(4);

    const customersMeta = sniffResult.sheets?.find(s => s.name === 'Customers');
    expect(customersMeta?.selected).toBe(true);
    expect(customersMeta?.targetTableName).toBe('Customers');

    const ordersMeta = sniffResult.sheets?.find(s => s.name === 'Orders');
    expect(ordersMeta?.selected).toBe(true);
    expect(ordersMeta?.targetTableName).toBe('Orders');

    const emptyMeta = sniffResult.sheets?.find(s => s.name === 'Empty_Logs');
    expect(emptyMeta?.selected).toBe(false);
    expect(emptyMeta?.isEmpty).toBe(true);

    // 4. Mock DuckDB execution responses for verification in virtual test env
    const createdTablesSet = new Set<string>();
    vi.spyOn(duckDBService, 'getTableList').mockImplementation(async () => Array.from(createdTablesSet));
    vi.spyOn(duckDBService, 'getTables').mockImplementation(async () => Array.from(createdTablesSet));
    vi.spyOn(duckDBService, 'query').mockImplementation(async (sql: string) => {
      if (sql.includes('CREATE TABLE')) {
        const match = sql.match(/CREATE TABLE ".*?"\."(.*?)"/);
        if (match) createdTablesSet.add(match[1]);
      }
      if (sql.includes('count(*) as row_count') || sql.includes('count(*) as cnt')) {
        if (sql.includes('dept_customers')) return [{ row_count: 3, cnt: 3 }];
        if (sql.includes('dept_orders')) return [{ row_count: 2, cnt: 2 }];
        return [{ row_count: 0, cnt: 0 }];
      }
      return [];
    });
    vi.spyOn(duckDBService, 'executeTransaction').mockImplementation(async statements => {
      if (!Array.isArray(statements)) throw new Error('Expected SQL transaction statements');
      for (const sql of statements) await duckDBService.query(sql);
    });

    const batchRes = await dataImportService.executeBatchImport(
      'main',
      [
        {
          sheetName: 'Customers',
          tableName: 'dept_customers',
          rawSqlSource: customersMeta!.rawSqlSource,
          columns: customersMeta!.columns,
        },
        {
          sheetName: 'Orders',
          tableName: 'dept_orders',
          rawSqlSource: ordersMeta!.rawSqlSource,
          columns: ordersMeta!.columns,
        },
      ],
      'replace'
    );

    expect(batchRes.results).toHaveLength(2);
    expect(batchRes.totalRows).toBe(5);
    expect(batchRes.createdTables).toEqual(['dept_customers', 'dept_orders']);

    // 5. Verify tables exist in duckDBService
    const tables = await duckDBService.getTables();
    expect(tables).toContain('dept_customers');
    expect(tables).toContain('dept_orders');

    const custRows = await duckDBService.query('SELECT count(*) as cnt FROM dept_customers');
    expect(Number(custRows[0].cnt)).toBe(3);

    const orderRows = await duckDBService.query('SELECT count(*) as cnt FROM dept_orders');
    expect(Number(orderRows[0].cnt)).toBe(2);
  });

  it('allocates clean Excel table names without prepending workbook prefix', () => {
    // 1. Multi-sheet workbook uses sheet names directly without file prefix
    const multiNames = allocateExcelTableNames(
      [{ name: 'Customers' }, { name: 'Orders' }, { name: 'Products' }],
      'company_2026_annual_report.xlsx'
    );
    expect(multiNames).toEqual(['Customers', 'Orders', 'Products']);

    // 2. Collision resolution in multi-sheet workbook
    const collisionNames = allocateExcelTableNames(
      [{ name: 'Orders' }, { name: 'orders' }, { name: 'orders_2' }],
      'store.xlsx'
    );
    expect(collisionNames).toEqual(['Orders', 'orders_3', 'orders_2']);

    // 3. Single-sheet with generic default sheet name uses clean file name without _imported
    const singleGenericNames = allocateExcelTableNames(
      [{ name: 'Sheet1' }],
      'sales_data_2026.xlsx'
    );
    expect(singleGenericNames).toEqual(['sales_data_2026']);

    const singleChineseGenericNames = allocateExcelTableNames(
      [{ name: '工作表1' }],
      '客户清单.xlsx'
    );
    expect(singleChineseGenericNames).toEqual(['客户清单']);

    // 4. Single-sheet with custom sheet name uses custom sheet name without file prefix
    const singleCustomNames = allocateExcelTableNames(
      [{ name: 'vip_users' }],
      'raw_export_2026.xlsx'
    );
    expect(singleCustomNames).toEqual(['vip_users']);

    // 5. Sheet names starting with numbers are sanitized to valid SQL identifiers
    const numericNames = allocateExcelTableNames(
      [{ name: '2025' }, { name: '2026' }],
      'financials.xlsx'
    );
    expect(numericNames).toEqual(['_2025', '_2026']);
  });

  it('sniffs single-sheet Excel workbook and assigns clean targetTableName without file prefix or _imported', async () => {
    const singleBuffer = await workbookIO.createWorkbookBuffer([
      {
        name: 'Sheet1',
        headers: ['id', 'name'],
        rows: [[1, 'Item 1']],
      },
    ]);

    const singleFile = new File([singleBuffer], 'inventory_list.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    vi.spyOn(duckDBService, 'registerFileText').mockResolvedValue(undefined);
    vi.spyOn(duckDBService, 'query').mockImplementation(async (sql: string) => {
      if (sql.includes('DESCRIBE')) {
        return [{ column_name: 'id', column_type: 'BIGINT', null: 'NO' }];
      }
      if (sql.includes('LIMIT 100')) {
        return [{ id: 1, name: 'Item 1' }];
      }
      return [];
    });

    const result = await dataImportService.sniffSource(
      'local',
      singleFile,
      '',
      '',
      { format: 'Excel', delimiter: ',', quote: '"', header: true, encoding: 'UTF-8' }
    );

    expect(result.sheets).toHaveLength(1);
    expect(result.sheets![0].targetTableName).toBe('inventory_list');
    expect(result.sheets![0].targetTableName).not.toContain('imported');
    expect(result.sheets![0].targetTableName).not.toContain('Sheet1');
  });
});

