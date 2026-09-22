// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { duckDBService } from './duckdbService';
import { recentImportsService } from './recentImportsService';
import { useSqlEditorStore } from '../hooks/store/useSqlEditorStore';

describe('DuckDB Studio End-to-End Workflow Validation', () => {
  let executedSql: string[] = [];
  const mockTableData: Record<string, { schema: any[]; rows: any[] }> = {};

  const toDuckResult = (rows: any[]) => {
    const arr = rows.map(r => ({
      ...r,
      toJSON: () => r,
    }));
    (arr as any).toArray = () => arr;
    (arr as any).schema = {
      fields: Object.keys(rows[0] || {}).map(name => ({
        name,
        type: { toString: () => 'VARCHAR' },
      })),
    };
    return arr;
  };

  beforeEach(async () => {
    localStorage.clear();
    executedSql = [];
    for (const key of Object.keys(mockTableData)) {
      delete mockTableData[key];
    }

    const mockQuery = vi.fn(async (sql: string) => {
      executedSql.push(sql);

      if (sql.includes('readiness_check')) {
        return toDuckResult([{ readiness_check: 42 }]);
      }
      if (sql.includes('version()')) {
        return toDuckResult([{ v: '1.32.0' }]);
      }
      if (sql.includes('CREATE TABLE')) {
        const match = sql.match(/CREATE TABLE ["']?([^"'\s;]+)["']?/i);
        const name = match ? match[1].replace(/["']/g, '') : 'store_inventory';
        mockTableData[name] = {
          schema: [
            { name: 'id', type: 'INTEGER', pk: true },
            { name: 'product_name', type: 'VARCHAR', pk: false },
            { name: 'price', type: 'DOUBLE', pk: false },
            { name: 'category', type: 'VARCHAR', pk: false },
          ],
          rows: [
            { id: 1, product_name: 'DuckDB Book', price: 39.99, category: 'Education' },
            { id: 2, product_name: 'WASM Sticker', price: 4.5, category: 'Swag' },
            { id: 3, product_name: 'Coffee Mug', price: 12.0, category: 'Home' },
          ],
        };
        return toDuckResult([]);
      }
      if (sql.includes('DROP TABLE')) {
        const match = sql.match(/DROP TABLE (?:IF EXISTS )?["']?([^"'\s;]+)["']?/i);
        const name = match ? match[1].replace(/["']/g, '') : '';
        if (name && mockTableData[name]) {
          delete mockTableData[name];
        }
        return toDuckResult([]);
      }
      if (sql.includes('information_schema.tables') || sql.includes('SHOW TABLES')) {
        const tableNames = Object.keys(mockTableData);
        return toDuckResult(tableNames.map(name => ({ table_name: name, name })));
      }
      if (sql.includes('PRAGMA table_info')) {
        const match = sql.match(/PRAGMA table_info\('([^']+)'\)/);
        const tableName = match ? match[1] : '';
        const table = mockTableData[tableName];
        return toDuckResult(table ? table.schema : []);
      }
      if (sql.includes('SELECT * FROM') || sql.includes('LIMIT')) {
        const match = sql.match(/FROM ["']?([^"'\s;]+)["']?/i);
        const tableName = match ? match[1].replace(/["']/g, '') : '';
        const table = mockTableData[tableName];
        return toDuckResult(table ? table.rows : []);
      }
      if (sql.includes('GROUP BY category')) {
        return toDuckResult([
          { category: 'Education', cnt: 1, avg_price: 39.99 },
          { category: 'Swag', cnt: 1, avg_price: 4.5 },
          { category: 'Home', cnt: 1, avg_price: 12.0 },
        ]);
      }

      return toDuckResult([]);
    });

    Object.assign(duckDBService as any, {
      db: {
        registerFileHandle: vi.fn(),
        dropFile: vi.fn(),
        copyFileToBuffer: vi.fn(async () => new Uint8Array([1, 2, 3])),
      },
      conn: {
        query: mockQuery,
      },
      readConn: {
        query: mockQuery,
      },
      isInitialized: true,
      query: mockQuery,
    });
  });

  it('runs complete path: import CSV -> create table -> inspect schema -> preview -> SQL query -> verify history & imports sync', async () => {
    // 1. Prepare sample CSV File
    const csvContent =
      'id,product_name,price,category\n1,DuckDB Book,39.99,Education\n2,WASM Sticker,4.50,Swag\n3,Coffee Mug,12.00,Home';
    const csvFile = new File([csvContent], 'store_inventory.csv', { type: 'text/csv' });

    // 2. Import file into DuckDB
    await duckDBService.importFile(csvFile, 'store_inventory');

    // 3. Verify table exists in DuckDB
    const tables = await duckDBService.getTables();
    expect(tables).toContain('store_inventory');

    // 4. Record recent import
    recentImportsService.addImport({
      name: 'store_inventory.csv',
      size: '110 B',
      sizeBytes: 110,
      importedAt: '2026-09-05 18:00:00',
      status: 'success',
      tableName: 'store_inventory',
      rowCount: 3,
    });

    const recentImports = recentImportsService.getImports();
    expect(recentImports[0].name).toBe('store_inventory.csv');
    expect(recentImports[0].tableName).toBe('store_inventory');

    // 5. Query Schema of the imported table
    const schema = await duckDBService.getTableSchema('store_inventory');
    expect(schema.length).toBe(4);
    const colNames = schema.map(c => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('product_name');
    expect(colNames).toContain('price');
    expect(colNames).toContain('category');

    // 6. Preview Data (LIMIT 10)
    const previewData = await duckDBService.query('SELECT * FROM store_inventory LIMIT 10');
    expect(previewData.length).toBe(3);
    expect(previewData[0].product_name).toBe('DuckDB Book');

    // 7. Execute SQL analysis
    const sql =
      'SELECT category, COUNT(*) as cnt, AVG(price) as avg_price FROM store_inventory GROUP BY category ORDER BY cnt DESC';
    const startTime = Date.now();
    const queryResult = await duckDBService.query(sql);
    const executionTime = Date.now() - startTime;

    expect(queryResult.length).toBeGreaterThanOrEqual(1);

    // 8. Log into SQL history
    const historyItem = {
      id: 'test-query-1',
      sql,
      timestamp: new Date().toISOString(),
      duration: `${executionTime}ms`,
      executionTime,
      status: 'success' as const,
      rowsCount: queryResult.length,
    };
    useSqlEditorStore.getState().addHistory(historyItem);

    // 9. Verify history persistence and retrieval
    const history = useSqlEditorStore.getState().history;
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].sql).toBe(sql);

    // 10. Clean up: Drop table in DuckDB
    await duckDBService.dropTable('store_inventory');
    const tablesAfterDrop = await duckDBService.getTables();
    expect(tablesAfterDrop).not.toContain('store_inventory');
  });
});
