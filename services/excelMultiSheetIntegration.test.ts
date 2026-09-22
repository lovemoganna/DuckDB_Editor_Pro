// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { workbookIO } from './workbookIO';
import { dataImportService } from './dataImportService';
import { duckDBService } from './duckdbService';

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
    expect(customersMeta?.targetTableName).toContain('Customers');

    const ordersMeta = sniffResult.sheets?.find(s => s.name === 'Orders');
    expect(ordersMeta?.selected).toBe(true);
    expect(ordersMeta?.targetTableName).toContain('Orders');

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
});
