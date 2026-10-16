import { describe, it, expect, beforeEach, vi } from 'vitest';

const state = vi.hoisted(() => ({
  catalog: 'memory',
  schema: 'main',
  records: [] as any[],
  queryHandler: null as any,
}));

vi.mock('../duckdbService', () => ({
  duckDBService: {
    getCurrentCatalogAndSchema: async () => ({ catalog: state.catalog, schema: state.schema }),
    readQuery: async (sql: string) => {
      if (state.queryHandler) return state.queryHandler(sql);
      return [];
    },
  },
}));

vi.mock('../dbService', () => ({
  dbService: {
    getDomainSetting: async () => state.records,
    saveDomainSetting: async (_key: string, records: any[]) => {
      state.records = structuredClone(records);
    },
  },
}));

import {
  defaultPivot,
  pivotToSpec,
  pivotQueryKey,
  getPivotRowDimensions,
  buildJoinedSource,
  listPivotRecords,
  deletePivotRecord,
  savePivotRecord,
  compiledPivotSql,
  type PivotDefinition,
} from './pivotExperience';
import { computePivotTable } from './chartDisplay';

describe('Pivot Enhanced Features (P0 & P1)', () => {
  const mockSource = {
    id: 'table:orders',
    name: 'orders',
    catalog: 'memory',
    schema: 'main',
    table: 'orders',
    kind: 'table' as const,
    version: 1,
    sql: 'SELECT * FROM orders',
    fields: [
      { name: 'country', type: 'VARCHAR' },
      { name: 'channel', type: 'VARCHAR' },
      { name: 'year', type: 'INTEGER' },
      { name: 'amount', type: 'DECIMAL(18,2)' },
    ],
  };

  beforeEach(() => {
    state.catalog = 'memory';
    state.schema = 'main';
    state.records = [];
    state.queryHandler = null;
  });

  describe('P0: Multi-row dimensions & subtotals', () => {
    it('supports multiple row dimensions in PivotDefinition and compiles layout', () => {
      const def: PivotDefinition = {
        ...defaultPivot(mockSource),
        rows: [
          { column: 'country' },
          { column: 'channel' },
        ],
        column: { column: 'year' },
        metrics: [{ column: 'amount', agg: 'sum', alias: '总金额' }],
      };

      const rowDims = getPivotRowDimensions(def);
      expect(rowDims).toHaveLength(2);
      expect(rowDims[0].column).toBe('country');
      expect(rowDims[1].column).toBe('channel');

      const spec = pivotToSpec(def);
      expect(spec.pivotLayout?.rowAliases).toEqual(['country', 'channel']);
      expect(spec.pivotLayout?.columnAlias).toBe('year');
      expect(spec.dimensions).toHaveLength(3);
    });

    it('computes multi-level composite rows and parent subtotals in computePivotTable', () => {
      const sampleRows = [
        { country: 'US', channel: 'wire', year: 2024, amount: 100, __pivot_all_amount: '350', __pivot_row_amount: '100', __pivot_col_amount: '150', __pivot_count: 3 },
        { country: 'US', channel: 'ach', year: 2024, amount: 50, __pivot_all_amount: '350', __pivot_row_amount: '50', __pivot_col_amount: '150', __pivot_count: 3 },
        { country: 'CN', channel: 'wire', year: 2024, amount: 200, __pivot_all_amount: '350', __pivot_row_amount: '200', __pivot_col_amount: '150', __pivot_count: 3 },
      ];

      const result = computePivotTable(
        sampleRows,
        'country',
        'year',
        'amount',
        'sum',
        ['country', 'channel'],
      );

      expect(result.rowValues).toHaveLength(3);
      expect(result.rowLabels).toBeDefined();

      // Check composite label
      const firstKey = result.rowValues[0];
      expect(result.rowLabels![firstKey]).toBe('US  ›  wire');

      // Check rowBindings includes both dimensions
      expect(result.rowBindings![firstKey]).toEqual({ country: 'US', channel: 'wire' });

      // Check subtotals for US parent group
      expect(result.subtotals).toBeDefined();
      expect(result.subtotals!['US']).toBeDefined();
      expect(result.subtotals!['US']['2024']).toBe(150); // 100 + 50
      expect(result.rowSubtotals!['US']).toBe(150);

      // Check subtotals for CN parent group
      expect(result.subtotals!['CN']['2024']).toBe(200);
      expect(result.rowSubtotals!['CN']).toBe(200);

      // Grand total from DuckDB
      expect(result.grandTotal).toBe(350);
    });

    it('handles nullDisplay option without altering calculation logic', () => {
      const def: PivotDefinition = {
        ...defaultPivot(mockSource),
        nullDisplay: 'zero',
      };
      const queryKey = pivotQueryKey(def);
      expect(queryKey).toContain('"nullDisplay":"zero"');
    });
  });

  describe('P1: Dual-table join & fan-out risk check', () => {
    it('generates fully qualified SELECT expressions and detects fan-out risk', async () => {
      state.queryHandler = async (sql: string) => {
        if (sql.includes('DESCRIBE "memory"."main"."users"')) {
          return [{ column_name: 'uid', column_type: 'VARCHAR' }, { column_name: 'name', column_type: 'VARCHAR' }];
        }
        if (sql.includes('DESCRIBE "memory"."main"."transactions"')) {
          return [{ column_name: 'uid', column_type: 'VARCHAR' }, { column_name: 'amount', column_type: 'DOUBLE' }];
        }
        if (sql.includes('COUNT(*) AS total_count')) {
          // Simulate 1:N relationship (25 rows vs 10 distinct users) -> Fan-out risk!
          return [{ total_count: 25, distinct_count: 10 }];
        }
        return [];
      };

      const { source, fanOutRisk } = await buildJoinedSource(
        'users',
        'transactions',
        'LEFT',
        'uid',
        'uid'
      );

      expect(fanOutRisk).toBe(true);
      expect(source.sql).toContain('LEFT JOIN "memory"."main"."transactions" AS t2 ON t1."uid" = t2."uid"');
      expect(source.fields).toEqual([
        { name: 'users.uid', type: 'VARCHAR' },
        { name: 'users.name', type: 'VARCHAR' },
        { name: 'transactions.uid', type: 'VARCHAR' },
        { name: 'transactions.amount', type: 'DOUBLE' },
      ]);
    });
  });

  describe('P1: Pivot configurations management', () => {
    it('lists and deletes saved pivot records using scoped store', async () => {
      const def = defaultPivot(mockSource);
      state.records = [
        { id: 'pivot_1', title: 'Pivot 1', pivot: def, savedAt: 1000 },
        { id: 'analysis_2', title: 'Non-pivot Analysis', savedAt: 2000 },
      ];

      const list = await listPivotRecords();
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe('pivot_1');

      await deletePivotRecord('pivot_1');
      const listAfter = await listPivotRecords();
      expect(listAfter).toHaveLength(0);
    });
  });
});
