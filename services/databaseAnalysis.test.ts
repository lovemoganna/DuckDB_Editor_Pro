import { beforeEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  settings: new Map<string, unknown>(),
  tables: ['users','fiat_transactions','crypto_transactions','exchange_rates'],
}));
vi.mock('./duckdbService', () => ({ duckDBService: {
  getRuntimeInfo: () => ({ready:true,currentDatabase:'baseline'}),
  getCurrentCatalogAndSchema: async () => ({catalog:'baseline',schema:'main'}),
  getTables: async () => mocks.tables,
  getTableSchema: async (table: string) => mocks.read(`SELECT name,type,CAST(pk AS INTEGER) AS pk FROM pragma_table_info('${table}')`),
  readQuery: mocks.read,
  query: mocks.read,
} }));
vi.mock('./dbService', () => ({dbService: {
  getDomainSetting: async (key: string) => mocks.settings.get(key) || null,
  saveDomainSetting: async (key: string, value: unknown) => {mocks.settings.set(key, structuredClone(value));},
  getQueries: async () => [],
}}));
import { proposeDatabaseMetrics, refreshDatabaseAnalysis, useDatabaseAnalysis } from './databaseAnalysis';
import { metricAnalyzer } from './metricAnalyzer';
import { executiveMetricPackage } from './executiveMetrics';
import { resolveAnalysisObject, deleteAnalysisRecord } from './analysisObjects';

const baseline = resolve('data/crud-lab/baseline.duckdb');
const nativeAvailable = existsSync(baseline);
describe.skipIf(!nativeAvailable)('real SQL database → shared analysis objects', () => {
  beforeEach(() => {
    localStorage.clear(); mocks.settings.clear();
    mocks.tables = ['users','fiat_transactions','crypto_transactions','exchange_rates'];
    mocks.read.mockImplementation((sql: string) => {
      const output = execFileSync('duckdb', [baseline,'-readonly','-json','-c',sql], {encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
      // Native EXPLAIN prints a plan even with -json; execution still verifies binding.
      if (/^EXPLAIN\b/i.test(sql)) return Promise.resolve([]);
      return Promise.resolve(output ? JSON.parse(output) : []);
    });
    // This fixture supplies an explicit known business definition, not field-name inference.
    metricAnalyzer.saveMetricPackage(executiveMetricPackage('baseline'));
  });
  it('discovers real fields, preserves currency boundaries, and persists reusable objects without requiring AI', {timeout:90_000}, async () => {
    const model = await refreshDatabaseAnalysis();
    expect(model.tables.map(table => table.rowCount)).toEqual([10,25,25,8]);
    expect(model.tables.reduce((count, table) => count+table.columnCount,0)).toBe(38);
    const proposals = proposeDatabaseMetrics(model,'baseline','main');
    expect(proposals.some(metric => /SUM\("uid"\)/.test(metric.formula))).toBe(false);
    expect(proposals.some(metric => /SUM\("kyc_level"\)/.test(metric.formula))).toBe(false);
    expect(proposals.some(metric => metric.id.includes(':sum:'))).toBe(false);
    const pkg = metricAnalyzer.loadMetricPackages().find(pkg=>pkg.id.startsWith('discovered:'))!;
    expect(pkg.metrics.filter(metric => !metric.isValid).map(metric => ({name:metric.name,error:metric.validationError}))).toEqual([]);
    const total = metricAnalyzer.loadMetricPackages().reduce((sum,pkg)=>sum+pkg.metrics.length,0);
    expect(metricAnalyzer.loadMetricCharts()).toHaveLength(total);
    expect(mocks.settings.get('linked-analyses')).toHaveLength(total);
    const funds = metricAnalyzer.loadMetricPackages().find(pkg=>pkg.id.startsWith('executive:'))!;
    expect(funds.metrics).toHaveLength(12);
    expect(useDatabaseAnalysis.getState().model?.coreMetrics.some(metric=>metric.id.endsWith(':usd-gmv'))).toBe(true);
    expect(mocks.settings.has('analysis-definitions-v1')).toBe(true);
    expect(useDatabaseAnalysis.getState().model).toBe(model);
    const analyses = mocks.settings.get('linked-analyses') as {id:string}[];
    await deleteAnalysisRecord(analyses[0].id, 'baseline');
    expect(mocks.settings.get('linked-analyses')).toHaveLength(total - 1);
    await expect(resolveAnalysisObject({id:'analysis-ref',databaseName:'baseline',name:'analysis',sql:'SELECT 999',createdAt:1,
      analysisRef:{kind:'analysis',id:analyses[0].id}})).rejects.toThrow('关联分析已删除');
    const removedChart = metricAnalyzer.loadMetricCharts()[0].id;
    metricAnalyzer.deleteMetricChart(removedChart);
    await refreshDatabaseAnalysis();
    expect(mocks.settings.get('linked-analyses')).toHaveLength(total - 1);
    expect(metricAnalyzer.loadMetricCharts().some(chart => chart.id === removedChart)).toBe(false);
    metricAnalyzer.deleteMetricPackage(pkg.id);
    metricAnalyzer.deleteMetricPackage(funds.id);
    await refreshDatabaseAnalysis();
    expect(metricAnalyzer.loadMetricPackages()).toHaveLength(0);
  });
  it('keeps object identity and user definitions on rediscovery, and surfaces a real missing column', {timeout:90_000}, async () => {
    await refreshDatabaseAnalysis();
    const pkg = metricAnalyzer.loadMetricPackages().find(pkg=>pkg.id.startsWith('discovered:'))!, metric = pkg.metrics[0];
    metricAnalyzer.updateMetricPackage(pkg.id,{metrics:pkg.metrics.map(item => item.id===metric.id
      ? {...item,name:'用户修改口径',formula:'SELECT SUM(missing_column) AS value FROM "baseline"."main"."users"',sqlValidation:'SELECT 999 AS value'} : item)});
    const chartsBefore = metricAnalyzer.loadMetricCharts().map(chart => chart.id);
    await refreshDatabaseAnalysis();
    const invalid = metricAnalyzer.getMetricPackage(pkg.id)!.metrics.find(item => item.id===metric.id)!;
    expect(invalid.name).toBe('用户修改口径');
    expect(invalid.isValid).toBe(false);
    expect(invalid.validationError).toContain('missing_column');
    expect(metricAnalyzer.loadMetricCharts().map(chart => chart.id)).toEqual(chartsBefore);
    const q = {id:'reference',databaseName:'baseline',name:'reference',sql:'SELECT 999',createdAt:1,analysisRef:{kind:'metric' as const,id:metric.id}};
    await expect(resolveAnalysisObject(q)).rejects.toThrow('missing_column');
    metricAnalyzer.updateMetricPackage(pkg.id,{metrics:metricAnalyzer.getMetricPackage(pkg.id)!.metrics.filter(item => item.id !== metric.id)});
    await refreshDatabaseAnalysis();
    expect(metricAnalyzer.getMetricPackage(pkg.id)!.metrics.some(item => item.id === metric.id)).toBe(false);
    await expect(resolveAnalysisObject(q)).rejects.toThrow('关联指标已删除');
  });
  it('restores a newer local edit and deletion when the database autosave has not finished', {timeout:90_000}, async () => {
    await refreshDatabaseAnalysis();
    const pkg = metricAnalyzer.loadMetricPackages().find(pkg=>pkg.id.startsWith('discovered:'))!, metric = pkg.metrics[0];
    metricAnalyzer.updateMetricPackage(pkg.id,{metrics:pkg.metrics.map(item => item.id === metric.id
      ? {...item,name:'重启保留口径',formula:'SELECT COUNT(*) AS records FROM users WHERE kyc_level >= 2'} : item)});
    vi.resetModules();
    const restarted = await import('./databaseAnalysis');
    await restarted.refreshDatabaseAnalysis();
    expect(metricAnalyzer.getMetricPackage(pkg.id)!.metrics[0].name).toBe('重启保留口径');
    expect(metricAnalyzer.getMetricPackage(pkg.id)!.metrics[0].formula).toContain('kyc_level >= 2');
    metricAnalyzer.deleteMetricPackage(pkg.id);
    const funds = metricAnalyzer.loadMetricPackages().find(pkg=>pkg.id.startsWith('executive:'));
    if (funds) metricAnalyzer.deleteMetricPackage(funds.id);
    vi.resetModules();
    await (await import('./databaseAnalysis')).refreshDatabaseAnalysis();
    expect(metricAnalyzer.loadMetricPackages()).toHaveLength(0);
  });
  it('cleans up automatically discovered metrics and charts when a table is dropped', {timeout:90_000}, async () => {
    await refreshDatabaseAnalysis();
    expect(metricAnalyzer.loadMetricCharts().some(chart => chart.id.includes('crypto_transactions'))).toBe(true);
    expect(useDatabaseAnalysis.getState().model?.coreMetrics.some(metric => metric.tableName === 'crypto_transactions')).toBe(true);

    // Simulate table being dropped
    mocks.tables = ['users','fiat_transactions','exchange_rates'];
    const model = await refreshDatabaseAnalysis();

    // Metrics, charts and analyses for crypto_transactions must be gone
    const pkg = metricAnalyzer.loadMetricPackages().find(p => p.id.startsWith('discovered:'));
    expect(pkg?.metrics.some(m => m.id.includes('crypto_transactions'))).toBe(false);
    expect(metricAnalyzer.loadMetricCharts().some(chart => chart.id.includes('crypto_transactions'))).toBe(false);
    expect(model.coreMetrics.some(metric => metric.tableName === 'crypto_transactions')).toBe(false);
    const analyses = (mocks.settings.get('linked-analyses') || []) as { id: string }[];
    expect(analyses.some(a => a.id.includes('crypto_transactions'))).toBe(false);
  });
});
