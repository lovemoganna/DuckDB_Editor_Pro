import { describe, it, expect } from 'vitest';
import { analyticalCatalogRules } from './analyticalCatalogService';
import type { TableAnalyticalSummary } from '../types/analyticalCatalog';

describe('analyticalCatalogRules (no mock business data)', () => {
  it('classifies TIMESTAMP columns as time', () => {
    const r = analyticalCatalogRules.mapRole('order_date', 'DATE', 365, 1000, false);
    expect(r.role).toBe('time');
    expect(r.confidence).toBeGreaterThan(50);
    expect(analyticalCatalogRules.mapRole('effective_date', 'DATE', 1, 8, true).role).toBe('time');
  });

  it('classifies amount-like numerics as measure', () => {
    const r = analyticalCatalogRules.mapRole('amount', 'DOUBLE', 800, 1000, false);
    expect(r.role).toBe('measure');
  });

  it('classifies id columns as identifier', () => {
    expect(analyticalCatalogRules.mapRole('uid', 'BIGINT', 10, 25, false).role).toBe('identifier');
    expect(analyticalCatalogRules.mapRole('customer_id', 'INTEGER', 1000, 1000, false).role).toBe(
      'identifier',
    );
    expect(analyticalCatalogRules.mapRole('id', 'INTEGER', 1000, 1000, true).role).toBe(
      'identifier',
    );
  });

  it('classifies low-cardinality status as category', () => {
    const r = analyticalCatalogRules.mapRole('status', 'VARCHAR', 4, 1000, false);
    expect(r.role).toBe('category');
  });

  it('scores time columns with business date names higher', () => {
    expect(analyticalCatalogRules.scoreTimeColumn('order_date', 'DATE')).toBeGreaterThan(
      analyticalCatalogRules.scoreTimeColumn('misc_col', 'VARCHAR'),
    );
  });

  it('proposes COUNT(*) and measure metrics from real column roles', () => {
    const table: TableAnalyticalSummary = {
      tableName: 'orders',
      rowCount: 100,
      columnCount: 4,
      fields: [],
      measures: [
        {
          tableName: 'orders',
          columnName: 'amount',
          physicalType: 'DOUBLE',
          role: 'measure',
          confidence: 90,
          nullRate: 0,
          distinctCount: 80,
          cardinalityRate: 80,
          suggestedAggs: ['sum', 'avg'],
        },
      ],
      timeDimensions: [
        {
          tableName: 'orders',
          columnName: 'order_date',
          physicalType: 'DATE',
          role: 'time',
          confidence: 90,
          nullRate: 0,
          distinctCount: 30,
          cardinalityRate: 30,
        },
      ],
      categoryDimensions: [
        {
          tableName: 'orders',
          columnName: 'region',
          physicalType: 'VARCHAR',
          role: 'category',
          confidence: 85,
          nullRate: 0,
          distinctCount: 5,
          cardinalityRate: 5,
        },
      ],
      identifiers: [],
      readiness: {
        hasMeasure: true,
        hasTime: true,
        hasCategory: true,
        hasComparison: true,
        hasDrillTarget: false,
        hasLinkageKey: false,
        score: 70,
        missing: [],
      },
    };

    const metrics = analyticalCatalogRules.buildCoreMetrics([table]);
    expect(metrics.some((m) => m.aggregation === 'count' && m.measureColumn == null)).toBe(true);
    expect(metrics.find((m) => m.aggregation === 'count' && m.measureColumn == null)?.sql).toContain('AS metric_value');
    expect(metrics.some((m) => m.measureColumn === 'amount' && m.timeDimension === 'order_date')).toBe(
      true,
    );
    expect(metrics.every((m) => m.sql.includes('"orders"') || m.sql.includes('orders'))).toBe(true);

    // Monetary inputs retain exact decimals in storage; chart output must be numeric
    // and every currency must remain a separate group even when status ranks higher.
    const currency = { ...table.categoryDimensions[0], columnName: 'currency' };
    table.fields = [currency];
    table.categoryDimensions.unshift({ ...currency, columnName: 'status' });
    table.categoryDimensions.push(currency);
    table.measures[0].physicalType = 'DECIMAL(18,2)';
    const monetary = analyticalCatalogRules.buildCoreMetrics([table]).find(m => m.measureColumn === 'amount')!;
    expect(monetary.sql).toContain('CAST(SUM("amount") AS DOUBLE) AS metric_value');
    expect(monetary.sql).toContain('GROUP BY "order_date", "currency"');
    expect(monetary.categoryDimensions[0]).toBe('currency');
    expect(monetary.name).toContain('按 currency');
  });

  it('marks missing time/category in readiness', () => {
    const base = {
      tableName: 't',
      rowCount: 10,
      columnCount: 1,
      fields: [],
      measures: [],
      timeDimensions: [],
      categoryDimensions: [],
      identifiers: [],
    };
    const r = analyticalCatalogRules.readinessForTable(base, [], []);
    expect(r.hasTime).toBe(false);
    expect(r.hasCategory).toBe(false);
    expect(r.missing.some((m) => m.includes('时间'))).toBe(true);
  });
});
