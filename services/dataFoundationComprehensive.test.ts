import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildAnalyticalCatalog,
  analyticalCatalogRules,
} from './analyticalCatalogService';
import {
  DEMO_TABLE_ROW_COUNTS,
  DEMO_COLUMN_TYPES,
} from '../components/Workbench/seedWorkbenchData';
import type { TableAnalyticalSummary } from '../types/analyticalCatalog';

const mocks = vi.hoisted(() => ({
  getTableSchema: vi.fn(),
  readQuery: vi.fn(),
  getTables: vi.fn(),
}));

vi.mock('./duckdbService', () => ({
  duckDBService: {
    getTableSchema: mocks.getTableSchema,
    readQuery: mocks.readQuery,
    getTables: mocks.getTables,
  },
}));

describe('Data Foundation & Analytical Catalog Comprehensive Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Schema & Data Structure Foundation', () => {
    it('provides multi-year continuous dates, 2000 orders, and 4000 items in demo specs', () => {
      expect(DEMO_TABLE_ROW_COUNTS['date_dim']).toBe(731); // 2 full years (2023-2024 leap year)
      expect(DEMO_TABLE_ROW_COUNTS['orders']).toBe(2000);
      expect(DEMO_TABLE_ROW_COUNTS['order_items']).toBe(4000);
      expect(DEMO_TABLE_ROW_COUNTS['customers']).toBe(500);
      expect(DEMO_TABLE_ROW_COUNTS['products']).toBe(100);
    });

    it('contains all essential metric and dimension columns in DEMO_COLUMN_TYPES', () => {
      const allCols = Object.keys(DEMO_COLUMN_TYPES);
      // Core metrics
      expect(allCols).toContain('net_amount');
      expect(allCols).toContain('profit');
      expect(allCols).toContain('gross_profit');
      expect(allCols).toContain('margin_rate');
      expect(allCols).toContain('discount_amount');
      expect(allCols).toContain('cost_amount');
      // Categorical & hierarchy dimensions
      expect(allCols).toContain('subcategory');
      expect(allCols).toContain('brand');
      expect(allCols).toContain('customer_segment');
      expect(allCols).toContain('loyalty_tier');
      expect(allCols).toContain('channel');
      expect(allCols).toContain('country');
      expect(allCols).toContain('city');
      // Temporal & comparison dimensions
      expect(allCols).toContain('order_date');
      expect(allCols).toContain('year_month');
      expect(allCols).toContain('fiscal_quarter');
      expect(allCols).toContain('is_weekend');
      expect(allCols).toContain('is_delayed');
    });
  });

  describe('2. Dimension, Hierarchy & Linkage Inference Rules', () => {
    it('infers correct grain for temporal columns', () => {
      expect(analyticalCatalogRules.inferSuggestedGrain('order_date')).toBe('day');
      expect(analyticalCatalogRules.inferSuggestedGrain('year_month')).toBe('month');
      expect(analyticalCatalogRules.inferSuggestedGrain('fiscal_quarter')).toBe('quarter');
      expect(analyticalCatalogRules.inferSuggestedGrain('fiscal_year')).toBe('year');
      expect(analyticalCatalogRules.inferSuggestedGrain('order_week')).toBe('week');
    });

    it('infers recommended linkage roles and filter operators', () => {
      expect(analyticalCatalogRules.inferLinkageRole('customer_id', 'identifier')).toBe('drill_bridge');
      expect(analyticalCatalogRules.inferLinkageRole('order_id', 'identifier')).toBe('drill_bridge');
      expect(analyticalCatalogRules.inferLinkageRole('region', 'category')).toBe('primary_filter');
      expect(analyticalCatalogRules.inferLinkageRole('channel', 'category')).toBe('primary_filter');
      expect(analyticalCatalogRules.inferLinkageRole('status', 'category')).toBe('primary_filter');
      expect(analyticalCatalogRules.inferLinkageRole('user_notes', 'attribute')).toBe('cross_highlight');
    });

    it('infers multi-tier hierarchical drill paths across 4 domains', () => {
      const makeTableSummary = (tableName: string, colNames: string[]): TableAnalyticalSummary => ({
        tableName,
        rowCount: 500,
        columnCount: colNames.length,
        fields: colNames.map((name) => ({
          tableName,
          columnName: name,
          physicalType: 'VARCHAR',
          role: 'category' as const,
          confidence: 0.9,
          nullRate: 0,
          distinctCount: 10,
          cardinalityRate: 0.1,
          min: null,
          max: null,
        })),
        measures: [],
        timeDimensions: [],
        categoryDimensions: [],
        identifiers: [],
        readiness: { score: 100, tier: 'complete' as const, checklist: [] },
      });

      const tables: TableAnalyticalSummary[] = [
        makeTableSummary('customers', ['country', 'region', 'city', 'customer_segment', 'loyalty_tier', 'customer_name']),
        makeTableSummary('products', ['category', 'subcategory', 'brand', 'product_name']),
        makeTableSummary('date_dim', ['order_year', 'fiscal_quarter', 'order_month', 'order_date']),
      ];

      const drillPaths = analyticalCatalogRules.inferHierarchicalDrillPaths(tables);

      expect(drillPaths.some((p) => p.hierarchyType === 'geographic' && p.fromColumn === 'region' && p.toColumn === 'country')).toBe(true);
      expect(drillPaths.some((p) => p.hierarchyType === 'geographic' && p.fromColumn === 'country' && p.toColumn === 'city')).toBe(true);
      expect(drillPaths.some((p) => p.hierarchyType === 'product' && p.fromColumn === 'category' && p.toColumn === 'subcategory')).toBe(true);
      expect(drillPaths.some((p) => p.hierarchyType === 'product' && p.fromColumn === 'subcategory' && p.toColumn === 'brand')).toBe(true);
      expect(drillPaths.some((p) => p.hierarchyType === 'temporal' && p.fromColumn === 'order_year' && p.toColumn === 'fiscal_quarter')).toBe(true);
      expect(drillPaths.some((p) => p.hierarchyType === 'entity' && p.fromColumn === 'customer_segment' && p.toColumn === 'loyalty_tier')).toBe(true);
    });
  });

  describe('3. End-to-End Analytical Catalog Assessment on Seeded Warehouse', () => {
    it('produces high readiness score with zero gaps when full dimensional schema is present', async () => {
      mocks.getTableSchema.mockImplementation(async (tableName: string) => {
        if (tableName === 'orders') {
          return [
            { name: 'order_id', type: 'INTEGER', pk: true },
            { name: 'customer_id', type: 'INTEGER' },
            { name: 'order_date', type: 'DATE' },
            { name: 'region', type: 'VARCHAR' },
            { name: 'channel', type: 'VARCHAR' },
            { name: 'customer_segment', type: 'VARCHAR' },
            { name: 'status', type: 'VARCHAR' },
            { name: 'total_amount', type: 'DECIMAL(12,2)' },
            { name: 'final_amount', type: 'DECIMAL(12,2)' },
            { name: 'gross_profit', type: 'DECIMAL(12,2)' },
          ];
        }
        if (tableName === 'order_items') {
          return [
            { name: 'item_id', type: 'INTEGER', pk: true },
            { name: 'order_id', type: 'INTEGER' },
            { name: 'product_id', type: 'INTEGER' },
            { name: 'quantity', type: 'INTEGER' },
            { name: 'unit_price', type: 'DECIMAL(10,2)' },
            { name: 'net_amount', type: 'DECIMAL(10,2)' },
            { name: 'cost_amount', type: 'DECIMAL(10,2)' },
            { name: 'profit', type: 'DECIMAL(10,2)' },
            { name: 'margin_rate', type: 'DECIMAL(6,4)' },
          ];
        }
        if (tableName === 'products') {
          return [
            { name: 'product_id', type: 'INTEGER', pk: true },
            { name: 'product_name', type: 'VARCHAR' },
            { name: 'category', type: 'VARCHAR' },
            { name: 'subcategory', type: 'VARCHAR' },
            { name: 'brand', type: 'VARCHAR' },
            { name: 'price_tier', type: 'VARCHAR' },
            { name: 'cost_price', type: 'DECIMAL(10,2)' },
            { name: 'unit_price', type: 'DECIMAL(10,2)' },
            { name: 'margin_rate', type: 'DECIMAL(6,4)' },
          ];
        }
        if (tableName === 'customers') {
          return [
            { name: 'customer_id', type: 'INTEGER', pk: true },
            { name: 'customer_name', type: 'VARCHAR' },
            { name: 'country', type: 'VARCHAR' },
            { name: 'region', type: 'VARCHAR' },
            { name: 'city', type: 'VARCHAR' },
            { name: 'customer_segment', type: 'VARCHAR' },
            { name: 'loyalty_tier', type: 'VARCHAR' },
            { name: 'channel', type: 'VARCHAR' },
          ];
        }
        if (tableName === 'date_dim') {
          return [
            { name: 'date_key', type: 'INTEGER', pk: true },
            { name: 'full_date', type: 'DATE' },
            { name: 'order_year', type: 'INTEGER' },
            { name: 'fiscal_quarter', type: 'VARCHAR' },
            { name: 'year_month', type: 'VARCHAR' },
            { name: 'is_weekend', type: 'BOOLEAN' },
          ];
        }
        if (tableName === 'v_monthly_kpi_summary') {
          return [
            { name: 'order_month', type: 'VARCHAR' },
            { name: 'order_count', type: 'BIGINT' },
            { name: 'net_revenue', type: 'DOUBLE' },
            { name: 'gross_profit', type: 'DOUBLE' },
            { name: 'gross_margin_rate', type: 'DOUBLE' },
            { name: 'prior_year_revenue', type: 'DOUBLE' },
            { name: 'yoy_growth_rate', type: 'DOUBLE' },
          ];
        }
        return [];
      });

      mocks.readQuery.mockImplementation(async (sql: string) => {
        if (sql.includes('COUNT(*)')) {
          return [{ c: 1000 }];
        }
        if (sql.includes('SUMMARIZE')) {
          return [];
        }
        if (sql.includes('duckdb_constraints')) {
          return [];
        }
        return [];
      });

      const tables = ['orders', 'order_items', 'products', 'customers', 'date_dim', 'v_monthly_kpi_summary'];
      const catalog = await buildAnalyticalCatalog(tables);

      expect(catalog.tableCount).toBe(6);
      expect(catalog.overallReadinessScore).toBeGreaterThanOrEqual(40);
      expect(catalog.workspaceGaps).toHaveLength(0);

      // Verify core metrics generated
      const metricIds = catalog.coreMetrics.map((m) => m.id);
      expect(metricIds.some((id) => id.includes('profit') || id.includes('gross_profit'))).toBe(true);
      expect(metricIds.some((id) => id.includes('net_amount') || id.includes('net_revenue'))).toBe(true);
      expect(metricIds.some((id) => id.includes('gross_margin_rate'))).toBe(true);

      // Verify temporal grains
      const dayGrains = catalog.timeDimensions.filter((t) => t.suggestedGrain === 'day');
      const monthGrains = catalog.timeDimensions.filter((t) => t.suggestedGrain === 'month');
      const quarterGrains = catalog.timeDimensions.filter((t) => t.suggestedGrain === 'quarter');
      expect(dayGrains.length).toBeGreaterThan(0);
      expect(monthGrains.length).toBeGreaterThan(0);
      expect(quarterGrains.length).toBeGreaterThan(0);

      // Verify drill paths
      expect(catalog.drillPaths.length).toBeGreaterThanOrEqual(4);
      expect(catalog.drillPaths.some((p) => p.hierarchyType === 'geographic')).toBe(true);
      expect(catalog.drillPaths.some((p) => p.hierarchyType === 'product')).toBe(true);
      expect(catalog.drillPaths.some((p) => p.hierarchyType === 'temporal')).toBe(true);
      expect(catalog.drillPaths.some((p) => p.hierarchyType === 'entity')).toBe(true);

      // Verify linkage fields
      expect(catalog.linkageFields.some((l) => l.columnName === 'region' && l.recommendedRole === 'primary_filter')).toBe(true);
      expect(catalog.linkageFields.some((l) => l.columnName === 'channel' && l.recommendedRole === 'primary_filter')).toBe(true);
      expect(catalog.linkageFields.some((l) => l.columnName === 'order_id' && l.recommendedRole === 'drill_bridge')).toBe(true);
    });
  });
});
