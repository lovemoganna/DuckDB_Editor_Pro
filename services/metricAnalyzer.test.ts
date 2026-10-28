import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MetricDefinition, MetricChart } from '../types';
const mocks = vi.hoisted(() => ({ database: 'memory', query: vi.fn(), schema: vi.fn(), sync: vi.fn(), pin: vi.fn(), ai: vi.fn() }));
vi.mock('./aiService', () => ({aiService:{robustCall:mocks.ai}}));
vi.mock('./duckdbService', () => ({ duckDBService: {
  getRuntimeInfo: () => ({ currentDatabase: mocks.database }), query: mocks.query, getTableSchema: mocks.schema,
} }));
vi.mock('./homeDashboardService', () => ({ syncLinkedChart: mocks.sync, pinChartToHome: mocks.pin }));
import { metricAnalyzer } from './metricAnalyzer';

const metric: MetricDefinition = { id: 'm', name: 'total', formula: 'SUM(amount)', scenario: 'sales',
  characteristics: '累加型', value: 'sum', definition: 'total amount', example: 'Run SQL', dependencies: ['amount'], createdAt: 1 };

describe('metric data correctness', () => {
  it('includes the user business question in full AI generation and retains a partial response', async () => {
    mocks.ai.mockResolvedValue([{name:'完成订单金额',formula:'SUM(amount)',sourceTable:'payments',unit:'USD'}]);
    const drafts=await metricAnalyzer.analyzeMetrics(['users','payments'],undefined,'只统计已完成 USD 订单，支持核对渠道结算差异');
    expect(mocks.ai.mock.calls[0][1]).toContain('只统计已完成 USD 订单，支持核对渠道结算差异');
    expect(drafts).toHaveLength(1);
    expect(drafts[0].sourceTable).toBe('payments');
  });
  it('retains incomplete AI candidates as editable drafts instead of dropping their formula', () => {
    const candidates = metricAnalyzer.validateMetrics([{name:'金额',formula:'SUM(amount)',sourceTable:'finance.payments',dependencies:['amount'],unit:'USD'}]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({formula:'SUM(amount)',sourceTable:'finance.payments',unit:'USD',governance:{reviewStatus:'draft'}});
  });
  it('preserves AI calculation parameters and governance without accepting AI business approval', () => {
    const calculation = {aggregation:'SUM' as const,field:'amount',groupBy:['direction'],timeField:'created_at',grain:'month' as const,filter:"status = 'completed'"};
    const [candidate] = metricAnalyzer.validateMetrics([{...metric,sourceTable:'payments',calculation,governance:{entity:'交易',sourceGrain:'一行一笔交易',reviewStatus:'reviewed'}}]);
    expect(candidate.calculation).toEqual(calculation);
    expect(candidate.governance).toMatchObject({entity:'交易',sourceGrain:'一行一笔交易',reviewStatus:'draft'});
  });
  it('collects qualified sources with separately quoted schema and table names', async () => {
    mocks.query.mockResolvedValue([{cnt:25}]);
    await metricAnalyzer.collectTableSchema(['finance.payments']);
    expect(mocks.query).toHaveBeenCalledWith('SELECT COUNT(*) as cnt FROM "finance"."payments"');
  });
  it('includes ratio and weight dependencies in schema validation', async () => {
    mocks.schema.mockResolvedValue([{ name: 'amount', type: 'DOUBLE' }]);
    await expect(metricAnalyzer.generateValidationSql({ ...metric, calculation: { aggregation: 'WEIGHTED_AVG', field: 'amount', weightField: 'missing_weight' } }, 'sales')).rejects.toThrow('missing_weight');
    await expect(metricAnalyzer.generateValidationSql({ ...metric, calculation: { aggregation: 'RATIO', numerator: { aggregation: 'SUM', field: 'amount' }, denominator: { aggregation: 'COUNT DISTINCT', field: 'missing_entity' } } }, 'sales')).rejects.toThrow('missing_entity');
  });
  beforeEach(() => {
    localStorage.clear(); vi.clearAllMocks(); mocks.database = 'memory';
    mocks.schema.mockResolvedValue([{ name: 'amount', type: 'DOUBLE' }]);
    mocks.query.mockResolvedValue([{ total: 42 }]); mocks.sync.mockResolvedValue(undefined);
  });
  it('does not insert a package into an empty catalog', () => {
    expect(metricAnalyzer.loadMetricPackages()).toEqual([]);
    expect(localStorage.getItem('duckdb_metric_packages')).toBeNull();
  });
  it('isolates metrics and charts when switching databases without overwriting either domain', () => {
    const pkg = metricAnalyzer.createMetricPackage('A', '', ['sales'], [metric]);
    metricAnalyzer.saveMetricPackage(pkg);
    const chart: MetricChart = { id: 'c', metricName: 'total', sql: 'SELECT 42 AS total',
      chartConfig: { id: 'cfg', type: 'counter', title: 'total', xKey: '', yKeys: ['total'] }, createdAt: 1 };
    metricAnalyzer.saveMetricChart(chart);
    mocks.database = 'domain_b';
    expect(metricAnalyzer.loadMetricPackages()).toEqual([]);
    expect(metricAnalyzer.loadMetricCharts()).toEqual([]);
    metricAnalyzer.saveMetricPackage(metricAnalyzer.createMetricPackage('B', '', ['sales'], [metric]));
    mocks.database = 'memory';
    expect(metricAnalyzer.loadMetricPackages().map(item => item.name)).toEqual(['A']);
    expect(metricAnalyzer.loadMetricCharts()).toHaveLength(1);
  });
  it('accepts COUNT(*) without column dependencies and quotes identifiers', async () => {
    const sql = await metricAnalyzer.generateValidationSql({ ...metric, name: '记录数', formula: 'COUNT(*)', dependencies: [] }, 'sales');
    expect(sql).toBe('SELECT COUNT(*) AS "记录数" FROM "sales"');
  });
  it('uses the metric source instead of the package fallback', async () => {
    const sql = await metricAnalyzer.generateValidationSql({ ...metric, sourceTable: 'fiat_transactions' }, 'users');
    expect(sql).toContain('FROM "fiat_transactions"');
  });
  it('validates the current formula rather than obsolete cached SQL', async () => {
    await metricAnalyzer.validateMetric({ ...metric, formula: 'SUM(missing)', sqlValidation: 'SELECT 42 AS total' }, 'sales');
    expect(mocks.query.mock.calls.some(([sql]) => sql.includes('SUM(missing)'))).toBe(true);
  });
  it('rejects a result without the configured numeric measure', async () => {
    mocks.query.mockResolvedValue([{ country_code: 'DE' }]);
    const result = await metricAnalyzer.validateMetric({ ...metric, sourceTable: 'sales', calculation: { aggregation: 'COUNT' } }, 'sales');
    expect(result.isValid).toBe(false);
  });
  it('plots a recipe rate rather than mixing cohort sizes into a percent axis', async () => {
    mocks.query.mockResolvedValue([{ period: 1735689600000, cohort_size: 10, retained_entities: 5, value: 50 }]);
    const chart = await metricAnalyzer.generateChart({ ...metric, formula: 'SELECT 1 AS value', unit: '%' }, 'p', 'sales');
    expect(chart.chartConfig).toMatchObject({ type: 'line', xKey: 'period', yKeys: ['value'], aggregation: 'none', unit: '%' });
  });
  it('preserves CTE/join SQL instead of replacing all FROM tables', async () => {
    const formula = 'WITH x AS (SELECT * FROM orders) SELECT SUM(amount) FROM x JOIN items USING(id)';
    expect(await metricAnalyzer.generateValidationSql({ ...metric, formula }, 'other')).toBe(formula);
  });
  it('does not save a fake chart when its SQL fails', async () => {
    mocks.query.mockRejectedValue(new Error('Missing table'));
    await expect(metricAnalyzer.generateChart(metric, 'p', 'sales')).rejects.toThrow('Missing table');
    expect(metricAnalyzer.loadMetricCharts()).toEqual([]);
  });
  it('regenerates a scalar chart in place and synchronizes the linked home query', async () => {
    const first = await metricAnalyzer.generateChart(metric, 'p', 'sales');
    const again = await metricAnalyzer.generateChart(metric, 'p', 'sales');
    expect(again.id).toBe(first.id);
    expect(again.chartConfig.type).toBe('counter');
    expect(metricAnalyzer.loadMetricCharts()).toHaveLength(1);
    expect(mocks.sync).toHaveBeenCalledWith(expect.objectContaining({ id: first.id }));
  });
  it('invalidates a previous verification and obsolete SQL when a formula changes', () => {
    const previous = { ...metric, isValid: true, lastValidated: 1, sqlValidation: 'SELECT SUM(amount) AS total FROM sales' };
    const pkg = metricAnalyzer.createMetricPackage('A', '', ['sales'], [previous]);
    metricAnalyzer.saveMetricPackage(pkg);
    const updated = metricAnalyzer.updateMetricPackage(pkg.id, { metrics: [{ ...previous, formula: 'AVG(amount)' }] });
    expect(updated?.metrics[0].isValid).toBeUndefined();
    expect(updated?.metrics[0].lastValidated).toBeUndefined();
    expect(updated?.metrics[0].sqlValidation).toBeUndefined();
  });
  it('plots the numeric result after date and category dimensions instead of the second column', async () => {
    mocks.query.mockResolvedValue([{ sold_at: 1788220800000, region: 'East', metric_value: 150 },
      { sold_at: 1788307200000, region: 'West', metric_value: 200 }]);
    const chart = await metricAnalyzer.generateChart(metric, 'p', 'sales');
    expect(chart.chartConfig).toMatchObject({ type: 'line', xKey: 'sold_at', yKeys: ['metric_value'], groupBy: 'region', aggregation: 'none' });
  });
  it('keeps numeric dimensions and timestamp periods out of a manually defined measure', async () => {
    mocks.schema.mockResolvedValue([{name:'amount',type:'DOUBLE'},{name:'created_at',type:'TIMESTAMP'},{name:'kyc_level',type:'INTEGER'}]);
    mocks.query.mockResolvedValue([{period:1735689600000,kyc_level:2,value:150}]);
    const chart = await metricAnalyzer.generateChart({ ...metric, sourceTable:'sales', calculation:{aggregation:'SUM',field:'amount',timeField:'created_at',grain:'month',groupBy:['kyc_level']} },'p','users');
    expect(chart.chartConfig).toMatchObject({type:'line',xKey:'period',yKeys:['value'],groupBy:'kyc_level'});
  });
  it('backs up malformed storage before recovering an empty catalog', () => {
    localStorage.setItem('duckdb_metric_packages', '{bad json');
    expect(metricAnalyzer.loadMetricPackages()).toEqual([]);
    expect(localStorage.getItem('duckdb_metric_packages_recovery')).toBe('{bad json');
  });
  it('updates a linked chart query when a changed formula cannot be regenerated', async () => {
    const pkg = metricAnalyzer.createMetricPackage('A', '', ['sales'], [metric]);
    metricAnalyzer.saveMetricPackage(pkg);
    const chart = await metricAnalyzer.generateChart(metric, pkg.id, 'sales');
    metricAnalyzer.updateMetricPackage(pkg.id, { metrics: [{ ...metric, formula: 'SUM(missing_column)' }] });
    const updated = metricAnalyzer.getChartByMetric(metric.id)!;
    expect(updated.id).toBe(chart.id);
    expect(updated.sql).toContain('SUM(missing_column)');
    expect(updated.sql).not.toContain('SUM(amount)');
    expect(mocks.sync).toHaveBeenLastCalledWith(expect.objectContaining({ id: chart.id, sql: updated.sql }));
  });
  it('keeps provenance and explains a removed metric instead of silently using an old query', async () => {
    const pkg = metricAnalyzer.createMetricPackage('A', '', ['sales'], [metric]);
    metricAnalyzer.saveMetricPackage(pkg);
    const chart = await metricAnalyzer.generateChart(metric, pkg.id, 'sales');
    metricAnalyzer.updateMetricPackage(pkg.id, { metrics: [] });
    const kept = metricAnalyzer.loadMetricCharts()[0];
    expect(kept.sql).toContain('关联指标已删除');
    expect(kept.metricId).toBe(chart.metricId);
    expect(kept.id).toBe(chart.id);
  });
  it('archives an untouched injected chart but preserves edited assets', () => {
    const stock = { id: 'chart_demo_order_count', sql: 'SELECT COUNT(order_id) AS order_count FROM orders;', createdAt: 1, updatedAt: 1 };
    localStorage.setItem('duckdb_metric_charts', JSON.stringify([stock, { ...stock, id: 'custom', updatedAt: 2 }]));
    expect(metricAnalyzer.loadMetricCharts().map(chart => chart.id)).toEqual(['custom']);
    expect(localStorage.getItem('duckdb_metric_charts_before_catalog_migration')).toContain('chart_demo_order_count');
  });
});
