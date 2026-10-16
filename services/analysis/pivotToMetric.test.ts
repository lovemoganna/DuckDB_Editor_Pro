import { describe, it, expect, beforeEach } from 'vitest';
import {
  extractMetricFromPivot,
  compilePivotFiltersToSql,
  saveMetricFromPivot
} from './pivotToMetric';
import type { PivotDefinition } from './pivotExperience';

describe('pivotToMetric', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('compiles pivot filters to SQL where conditions correctly', () => {
    const filters: PivotDefinition['filters'] = [
      { column: 'status', op: '=', value: 'COMPLETED' },
      { column: 'amount', op: '>=', value: '100' },
      { column: 'notes', op: 'contains', value: 'vip' },
      { column: 'deleted_at', op: 'is_null', value: '' },
    ];
    const sql = compilePivotFiltersToSql(filters);
    expect(sql).toContain('"status" = \'COMPLETED\'');
    expect(sql).toContain('"amount" >= 100');
    expect(sql).toContain('"notes" LIKE \'%vip%\'');
    expect(sql).toContain('"deleted_at" IS NULL');
  });

  it('extracts metric from single-table pivot with time dimension and additive measure', () => {
    const def: PivotDefinition = {
      title: '月度销售分析',
      source: {
        id: 'table:sales',
        name: 'orders',
        table: 'orders',
        catalog: 'memory',
        schema: 'main',
        kind: 'table',
        version: 1,
        sql: 'SELECT * FROM orders',
        fields: [
          { name: 'order_date', type: 'TIMESTAMP' },
          { name: 'region', type: 'VARCHAR' },
          { name: 'amount', type: 'DECIMAL' },
        ],
      },
      rows: [
        { column: 'order_date', dateTrunc: 'month' },
        { column: 'region' },
      ],
      metrics: [
        { column: 'amount', agg: 'sum', alias: '销售额求和' },
      ],
      filters: [
        { column: 'amount', op: '>', value: '0' },
      ],
    };

    const result = extractMetricFromPivot(def);
    expect(result.metric.name).toContain('销售额求和');
    expect(result.metric.calculation?.aggregation).toBe('SUM');
    expect(result.metric.calculation?.field).toBe('amount');
    expect(result.metric.calculation?.grain).toBe('month');
    expect(result.metric.calculation?.timeField).toBe('order_date');
    expect(result.metric.calculation?.groupBy).toEqual(['region']);
    expect(result.metric.governance?.additivity).toBe('additive');
    expect(result.generatedSql).toContain('date_trunc(\'month\', "order_date") AS period');
    expect(result.generatedSql).toContain('SUM("amount") AS "销售额求和"');
    expect(result.generatedSql).toContain('WHERE "amount" > 0');
  });

  it('marks non-additive metrics like AVG and handles double-table join', () => {
    const def: PivotDefinition = {
      title: '客户客单价透视',
      source: {
        id: 'table:joined',
        name: 'orders_customers',
        table: 'orders',
        catalog: 'memory',
        schema: 'main',
        kind: 'table',
        version: 1,
        sql: 'SELECT * FROM orders',
        fields: [],
      },
      joinConfig: {
        enabled: true,
        primaryTable: 'orders',
        secondaryTable: 'customers',
        primaryKey: 'customer_id',
        secondaryKey: 'id',
        joinType: 'LEFT',
      },
      rows: [{ column: 'customer_level' }],
      metrics: [{ column: 'amount', agg: 'avg', alias: '平均客单价' }],
      filters: [],
    };

    const result = extractMetricFromPivot(def);
    expect(result.metric.calculation?.aggregation).toBe('AVG');
    expect(result.metric.governance?.additivity).toBe('non_additive');
    expect(result.generatedSql).toContain('LEFT JOIN "customers" s ON p."customer_id" = s."id"');
    expect(result.metric.dependencies).toEqual(['orders', 'customers']);
  });

  it('saves extracted metric into a new and then existing metric package', () => {
    const def: PivotDefinition = {
      title: '订单量透视',
      source: {
        id: 'table:orders',
        name: 'orders',
        table: 'orders',
        catalog: 'memory',
        schema: 'main',
        kind: 'table',
        version: 1,
        sql: 'SELECT * FROM orders',
        fields: [],
      },
      rows: [{ column: 'region' }],
      metrics: [{ agg: 'count', alias: '总订单数' }],
      filters: [],
    };

    const { metric } = extractMetricFromPivot(def);
    const saveRes = saveMetricFromPivot(metric, undefined, '销售运营包');
    expect(saveRes.packageId).toBeDefined();

    // 再次存入同一个包
    const metric2 = { ...metric, id: 'metric_2', name: '次级订单数' };
    const saveRes2 = saveMetricFromPivot(metric2, saveRes.packageId);
    expect(saveRes2.packageId).toBe(saveRes.packageId);

    const savedPackages = JSON.parse(localStorage.getItem('duckdb_metric_packages') || '[]');
    expect(savedPackages.length).toBe(1);
    expect(savedPackages[0].metrics.length).toBe(2);
  });
});
