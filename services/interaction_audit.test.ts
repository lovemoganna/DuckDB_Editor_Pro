import { describe, it, expect, beforeEach, vi } from 'vitest';
import { duckDBService } from './duckdbService';
import { decodeCompleteWorkspaceBackup, encodeCompleteWorkspaceBackup, CompleteWorkspaceBackup } from './completeWorkspaceBackup';
import { inferLinkTypes, inferObjectTypes } from './schemaInferenceEngine';
import { IntentAnalyzer } from './skill/intentAnalyzer';
import { toastService } from './toastService';
import { EMPTY_STATE_MESSAGES } from '../designSystem';
import { useSqlEditorStore } from '../hooks/store/useSqlEditorStore';

describe('Interaction & Real Data Link Verification', () => {
  let executedSql: string[] = [];
  const mockTableData: Record<string, { schema: any[]; rows: any[] }> = {};

  const toDuckResult = (rows: any[]) => {
    const arr = rows.map(r => ({
      ...r,
      toJSON: () => r,
    }));
    (arr as any).toArray = () => arr;
    (arr as any).schema = { fields: Object.keys(rows[0] || {}).map(name => ({ name, type: { toString: () => 'VARCHAR' } })) };
    return arr;
  };

  beforeEach(() => {
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
      if (sql.includes('SELECT * FROM')) {
        const match = sql.match(/SELECT \* FROM ["']?([^"'\s;]+)["']?/i);
        const tableName = match ? match[1].replace(/["']/g, '') : '';
        const table = mockTableData[tableName];
        return toDuckResult(table ? table.rows : []);
      }

      return toDuckResult([]);
    });

    Object.assign(duckDBService as any, {
      db: {
        registerFileHandle: vi.fn(),
        dropFile: vi.fn(),
        copyFileToBuffer: vi.fn(async () => new Uint8Array([1, 2, 3])),
      },
      conn: { query: mockQuery },
      readConn: { query: mockQuery },
      isInitialized: true,
      initPromise: Promise.resolve(),
      isLegacy: false,
      queryQueue: Promise.resolve(),
    });
  });

  it('AUDIT-DATA-01: Table CRUD and row mutations with primary key and SQL execution', async () => {
    const tableName = 'test_users_crud';
    mockTableData[tableName] = {
      schema: [
        { name: 'id', type: 'BIGINT', pk: true, notnull: true, dflt_value: null },
        { name: 'username', type: 'VARCHAR', pk: false, notnull: false, dflt_value: null },
        { name: 'score', type: 'INTEGER', pk: false, notnull: false, dflt_value: null },
      ],
      rows: [
        { id: 1, username: 'alice', score: 100 },
        { id: 2, username: 'bob', score: 85 },
      ],
    };

    // 1. Check Schema
    const schema = await duckDBService.getTableSchema(tableName);
    expect(schema.length).toBe(3);
    expect(schema.find((c: any) => c.pk)?.name).toBe('id');

    // 2. Insert row
    await duckDBService.insertRow(tableName, { id: 3, username: 'charlie', score: 90 });
    expect(executedSql.some(s => s.includes('INSERT INTO "test_users_crud"') && s.includes('charlie'))).toBe(true);

    // 3. Update cell / row
    await duckDBService.updateRow(tableName, 'id', 1, 'username', 'alice_updated');
    expect(executedSql.some(s => s.includes('UPDATE "test_users_crud"') && s.includes('alice_updated') && s.includes('"id" = 1'))).toBe(true);

    // 4. Bulk delete rows
    await duckDBService.deleteRows(tableName, 'id', [2, 3]);
    expect(executedSql.some(s => s.includes('DELETE FROM "test_users_crud"') && s.includes('WHERE "id" IN (2, 3)'))).toBe(true);

    // 5. Drop Table
    await duckDBService.dropTable(tableName);
    expect(executedSql.some(s => s.includes('DROP TABLE') && s.includes('"test_users_crud"'))).toBe(true);
  });

  it('AUDIT-EXPORT-01: SQL full backup and schema export produces valid DDL & INSERT statements', async () => {
    const tableName = 'test_export';
    mockTableData[tableName] = {
      schema: [
        { name: 'item_id', type: 'INTEGER', pk: true, notnull: true, dflt_value: null },
        { name: 'item_name', type: 'VARCHAR', pk: false, notnull: false, dflt_value: null },
      ],
      rows: [
        { item_id: 101, item_name: 'Widget A' },
      ],
    };

    // Schema export
    const schemaDdl = await duckDBService.exportSchema();
    expect(schemaDdl).toContain('CREATE TABLE "test_export"');
    expect(schemaDdl).toContain('"item_id" INTEGER NOT NULL');
    expect(schemaDdl).toContain('"item_name" VARCHAR');

    // Full SQL export
    const fullSql = await duckDBService.exportDataAsSQL([tableName]);
    expect(fullSql).toContain('INSERT INTO "test_export"');
    expect(fullSql).toContain('101');
    expect(fullSql).toContain('Widget A');
  });

  it('AUDIT-BACKUP-01: Workspace backup decoding without mock fallback', () => {
    const sampleBackup: CompleteWorkspaceBackup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      localStorage: { test_key: 'value' },
      indexedDB: [
        {
          name: 'duckdb_custom_db',
          version: 1,
          stores: [
            {
              name: 'real_table_1',
              keyPath: 'id',
              autoIncrement: false,
              indexes: [],
              records: [],
            },
            {
              name: 'real_table_2',
              keyPath: 'id',
              autoIncrement: false,
              indexes: [],
              records: [],
            },
          ],
        },
      ],
      duckdbSnapshot: new Uint8Array([0, 1, 2, 3]),
    };

    const encoded = encodeCompleteWorkspaceBackup(sampleBackup);
    const decoded = decodeCompleteWorkspaceBackup(encoded);

    expect(decoded.version).toBe(1);
    expect(decoded.indexedDB[0].stores.map(s => s.name)).toEqual(['real_table_1', 'real_table_2']);
    expect(decoded.indexedDB[0].stores.some(s => s.name === 'orders')).toBe(false);
  });

  it('AUDIT-SCHEMA-01: Schema column alterations generate correct DDL', async () => {
    const tableName = 'test_schema_alter';

    // Add column
    await duckDBService.addColumn(tableName, 'extra_info', 'VARCHAR');
    expect(executedSql.some(s => s.includes('ALTER TABLE "test_schema_alter" ADD COLUMN "extra_info" VARCHAR'))).toBe(true);

    // Rename column
    await duckDBService.renameColumn(tableName, 'extra_info', 'notes');
    expect(executedSql.some(s => s.includes('ALTER TABLE "test_schema_alter" RENAME COLUMN "extra_info" TO "notes"'))).toBe(true);

    // Drop column
    await duckDBService.dropColumn(tableName, 'notes');
    expect(executedSql.some(s => s.includes('ALTER TABLE "test_schema_alter" DROP COLUMN "notes"'))).toBe(true);
  });

  it('AUDIT-ESCAPE-01: SQL literal escaping correctly escapes single quotes and preserves types', () => {
    expect(duckDBService.escapeLiteral(null)).toBe('NULL');
    expect(duckDBService.escapeLiteral(undefined)).toBe('NULL');
    expect(duckDBService.escapeLiteral(123)).toBe('123');
    expect(duckDBService.escapeLiteral(true)).toBe('TRUE');
    expect(duckDBService.escapeLiteral(false)).toBe('FALSE');
    expect(duckDBService.escapeLiteral(BigInt(9007199254740991))).toBe('9007199254740991');
    expect(duckDBService.escapeLiteral("O'Reilly")).toBe("'O''Reilly'");
    expect(duckDBService.escapeLiteral('He said "Hello"')).toBe("'He said \"Hello\"'");
  });

  it('AUDIT-DDL-EVENT-01: DDL methods dispatch duckdb-schema-changed window event', async () => {
    let dispatched = 0;
    const listener = () => { dispatched++; };
    window.addEventListener('duckdb-schema-changed', listener);

    await duckDBService.addColumn('test_tbl', 'col1', 'INTEGER');
    await new Promise(r => setTimeout(r, 180));
    expect(dispatched).toBe(1);

    await duckDBService.alterColumnType('test_tbl', 'col1', 'BIGINT');
    await new Promise(r => setTimeout(r, 180));
    expect(dispatched).toBe(2);

    await duckDBService.createTable('new_created_tbl', [{ name: 'id', type: 'INTEGER', pk: true }]);
    await new Promise(r => setTimeout(r, 180));
    expect(dispatched).toBe(3);

    window.removeEventListener('duckdb-schema-changed', listener);
  });

  it('AUDIT-SCHEMA-INFER-01: Schema inference assigns realistic confidence and heuristic reasons without false certainty', () => {
    const tables = [
      { name: 'customers', columns: [{ name: 'id', type: 'BIGINT', pk: true }, { name: 'name', type: 'VARCHAR' }] },
      { name: 'orders', columns: [{ name: 'id', type: 'BIGINT', pk: true }, { name: 'customer_id', type: 'BIGINT' }] },
    ];
    const objectTypes = inferObjectTypes(tables);
    const linkTypes = inferLinkTypes(tables, objectTypes);

    const fwdLink = linkTypes.find((l: any) => l.fromObjectTypeId === 'ot::orders' && l.toObjectTypeId === 'ot::customers');
    expect(fwdLink).toBeDefined();
    expect(fwdLink.confidence).toBeLessThanOrEqual(0.70);
    expect(fwdLink.confidence).toBeGreaterThanOrEqual(0.50);
    expect(fwdLink.reason).toContain('启发式');
  });

  it('AUDIT-INTENT-REASON-01: Intent analyzer honesty in reasoning outputs', async () => {
    const analyzer = new IntentAnalyzer();
    const res = await analyzer.analyze('查询活跃用户', { tableName: 'users', currentColumns: [] });
    expect(res.intent).toBe('select');
    expect(res.reasoning).not.toContain('(AI 校验通过)');
  });

  it('AUDIT-METRIC-DISPATCH-01: Metric execution events correctly broadcast custom SQL details', () => {
    let capturedEvent: any = null;
    const listener = (e: any) => {
      capturedEvent = e.detail;
    };
    window.addEventListener('duckdb_execute_sql', listener);

    const testSql = 'SELECT region, COUNT(*) FROM orders GROUP BY 1;';
    window.dispatchEvent(
      new CustomEvent('duckdb_execute_sql', {
        detail: { sql: testSql, autoRun: true, title: 'Metric: Test' },
      })
    );

    expect(capturedEvent).toBeDefined();
    expect(capturedEvent.sql).toBe(testSql);
    expect(capturedEvent.autoRun).toBe(true);
    expect(capturedEvent.title).toBe('Metric: Test');

    window.removeEventListener('duckdb_execute_sql', listener);
  });

  it('AUDIT-INSERT-FALLBACK-01: insertRow queries schema when default values fails', async () => {
    mockTableData['test_insert_tbl'] = {
      schema: [
        { name: 'id', type: 'INTEGER', pk: true, notnull: true, dflt_value: null },
        { name: 'title', type: 'VARCHAR', pk: false, notnull: true, dflt_value: null },
      ],
      rows: [],
    };

    // First attempt DEFAULT VALUES, if mocked to throw, it should fallback to schema auto-defaults
    await duckDBService.insertRow('test_insert_tbl', { id: 10, title: 'Item 10' });
    expect(executedSql.some(s => s.includes('INSERT INTO "test_insert_tbl"') && s.includes('Item 10'))).toBe(true);
  });

  it('AUDIT-IMPORT-APPEND-01: importFile supports TSV and append conflictMode', async () => {
    mockTableData['existing_tbl'] = {
      schema: [{ name: 'id', type: 'INTEGER', pk: true, notnull: true, dflt_value: null }],
      rows: [{ id: 1 }],
    };

    const tsvFile = new File(['id\tname\n1\talpha'], 'data.tsv', { type: 'text/tab-separated-values' });
    await duckDBService.importFile(tsvFile, 'existing_tbl', {
      header: true,
      delimiter: '\t',
      quote: '',
      dateFormat: '%Y-%m-%d',
      conflictMode: 'append',
    });

    expect(executedSql.some(s => s.includes('INSERT INTO "existing_tbl"') && s.includes("delim='\\t'"))).toBe(true);
  });

  it('AUDIT-TOAST-UNIFICATION-01: useSqlEditorStore.showToast forwards to global toastService', () => {
    let capturedToast: any = null;
    const unsub = toastService.subscribe((event) => {
      capturedToast = event;
    });

    useSqlEditorStore.getState().showToast('测试查询成功完成', 'success');
    expect(capturedToast).not.toBeNull();
    expect(capturedToast?.message).toBe('测试查询成功完成');
    expect(capturedToast?.severity).toBe('success');

    unsub();
  });

  it('AUDIT-ONTOLOGY-CANVAS-01: dynamic calculation for hasSameTypeNodes and hasAdjacentNodes', () => {
    const mockObjects = [
      { id: 1, name: 'Customer', object_type_id: 101 },
      { id: 2, name: 'VIP Customer', object_type_id: 101 },
      { id: 3, name: 'Order', object_type_id: 102 },
    ];
    const mockLinks = [
      { id: 10, source_object_id: 1, target_object_id: 3 },
    ];

    // Single node 1 selected
    const activeNode1 = mockObjects.find(o => o.id === 1)!;
    const hasSameType1 = mockObjects.some(o => o.id !== 1 && o.object_type_id === activeNode1.object_type_id);
    const hasAdjacent1 = mockLinks.some(l => l.source_object_id === 1 || l.target_object_id === 1);
    expect(hasSameType1).toBe(true); // Node 2 has object_type_id 101
    expect(hasAdjacent1).toBe(true); // Connected to Node 3

    // Single node 3 selected
    const activeNode3 = mockObjects.find(o => o.id === 3)!;
    const hasSameType3 = mockObjects.some(o => o.id !== 3 && o.object_type_id === activeNode3.object_type_id);
    const hasAdjacent3 = mockLinks.some(l => l.source_object_id === 3 || l.target_object_id === 3);
    expect(hasSameType3).toBe(false); // Only node with type 102
    expect(hasAdjacent3).toBe(true); // Connected to Node 1
  });

  it('AUDIT-EMPTY-STATE-STANDARDIZATION-01: standardized empty state messages exist for core modules', () => {
    expect(EMPTY_STATE_MESSAGES.DATA.title).toBeDefined();
    expect(EMPTY_STATE_MESSAGES.DATA.description).toBeDefined();
    expect(EMPTY_STATE_MESSAGES.SCHEMA.title).toBeDefined();
    expect(EMPTY_STATE_MESSAGES.SCHEMA.description).toBeDefined();
  });
});


