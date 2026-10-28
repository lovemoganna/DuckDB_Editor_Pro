import { create } from 'zustand';
import { duckDBService } from './duckdbService';
import { dbService } from './dbService';
import { mutateDomainSetting } from './domainSettingMutation';
import { buildAnalyticalCatalog } from './analyticalCatalogService';
import { metricAnalyzer } from './metricAnalyzer';
import { metricSource } from './metricSql';
import { activeAnalysisDatabase, automaticDismissals, restoreAutomaticDismissals, type AutomaticDismissal } from './metricAssetStorage';
import { quoteIdent } from './databaseCatalog';
import { extractTablesFromSql } from './queryVizHint';
import type { AnalyticalCatalog } from '../types/analyticalCatalog';
import type { MetricDefinition, MetricPackage, ChartConfig } from '../types';
import type { AnalysisRecord } from './analysisObjects';
import { ensureExecutiveMetrics } from './executiveMetrics';

export const useDatabaseAnalysis = create<{
  database: string; schema: string; model: AnalyticalCatalog | null; loading: boolean; error: string | null; revision: number;
}>(() => ({ database: '', schema: '', model: null, loading: false, error: null, revision: 0 }));

const flights = new Map<string, Promise<AnalyticalCatalog>>();
let generation = 0;
const hydrated = new Set<string>();

/** Descriptive facts only. A physical field type is not a business definition. */
export function proposeDatabaseMetrics(model: AnalyticalCatalog, database: string, schema: string): MetricDefinition[] {
  const out: MetricDefinition[] = [];
  for (const table of model.tables) {
    if (!Number.isFinite(table.rowCount) || table.rowCount <= 0) continue;
    const source = `${quoteIdent(database)}.${quoteIdent(schema)}.${quoteIdent(table.tableName)}`;
    const add = (key: string, label: string, sql: string, config: Partial<ChartConfig>, fields: string[] = []) => {
      const id = `discovered:${database}:${schema}:${table.tableName}:${key}`;
      out.push({ id, name: `${table.tableName} · ${label}`, scenario: '当前数据库探索', characteristics: '基于实际字段自动发现',
        value: '仅用于数据规模与分布诊断；业务问题、决策用途和资格总体仍需确认', definition: `${table.tableName} 的${label}；统计原始记录，不代表有效业务事件或主体数`, formula: sql, example: '核对来源明细与查询结果，不推断业务价值',
        sourceTable: `${database}.${schema}.${table.tableName}`, dependencies: fields, unit: '行',
        governance: {role: 'diagnostic', reviewStatus: 'draft'}, sqlValidation: sql, createdAt: Date.now(), category: '自动发现',
        presentation: { id: `chart:${id}`, title: `${table.tableName} · ${label}`, type: 'table', xKey: '', yKeys: [], ...config } });
    };
    add('count', '记录数', `SELECT COUNT(*) AS records FROM ${source}`, { type: 'counter', xKey: '', yKeys: ['records'] });
    const category = table.categoryDimensions.filter(field => field.distinctCount != null && field.distinctCount > 1 && field.distinctCount < table.rowCount)
      .sort((a, b) => (a.distinctCount || 0) - (b.distinctCount || 0))[0];
    if (category) add(`category:${category.columnName}`, `${category.columnName} 分布`,
      `SELECT ${quoteIdent(category.columnName)} AS dimension, COUNT(*) AS records FROM ${source} GROUP BY 1 ORDER BY 2 DESC LIMIT 30`,
      { type: 'bar', xKey: 'dimension', yKeys: ['records'] }, [category.columnName]);
    const time = table.timeDimensions.find(field => /DATE|TIMESTAMP/i.test(field.physicalType)
      && field.min != null && field.max != null && String(field.min).slice(0, 7) !== String(field.max).slice(0, 7));
    if (time) add(`trend:${time.columnName}`, `${time.columnName} · 按月记录分布`,
      `SELECT strftime(date_trunc('month', ${quoteIdent(time.columnName)}), '%Y-%m') AS period, COUNT(*) AS records FROM ${source} WHERE ${quoteIdent(time.columnName)} IS NOT NULL GROUP BY 1 ORDER BY 1`,
      { type: 'line', xKey: 'period', yKeys: ['records'] }, [time.columnName]);
    // Numeric aggregates require a user-confirmed definition and unit.
  }
  return out;
}

export async function persistAnalysisDefinitions(database = activeAnalysisDatabase()): Promise<void> {
  if (activeAnalysisDatabase() !== database) return;
  const packages = metricAnalyzer.loadMetricPackages(), charts = metricAnalyzer.loadMetricCharts();
  await dbService.saveDomainSetting('analysis-definitions-v1', { packages, charts, dismissals: automaticDismissals() }, database);
}

async function hydrate(database: string): Promise<void> {
  if (hydrated.has(database)) return;
  const saved = await dbService.getDomainSetting<{ packages: MetricPackage[]; charts: ReturnType<typeof metricAnalyzer.loadMetricCharts>; dismissals?: AutomaticDismissal[] }>('analysis-definitions-v1', database);
  if (activeAnalysisDatabase() !== database) return;
  if (saved) {
    const markers = [...automaticDismissals(), ...(saved.dismissals || [])];
    const dismissals = markers.filter((item, index) => markers.findIndex(marker => marker.kind === item.kind && marker.id === item.id) === index);
    restoreAutomaticDismissals(dismissals);
    const local = metricAnalyzer.loadMetricPackages();
    // A reload during the autosave debounce must retain the newer local edit.
    const packages = saved.packages.map(pkg => {
      const latest = local.find(item => item.id === pkg.id);
      return latest && latest.updatedAt >= pkg.updatedAt ? latest : pkg;
    });
    metricAnalyzer.saveAllPackages([...packages, ...local.filter(pkg => !saved.packages.some(item => item.id === pkg.id))]
      .filter(pkg => !dismissals.some(item => item.kind === 'package' && item.id === pkg.id)));
    const localCharts = metricAnalyzer.loadMetricCharts();
    for (const chart of saved.charts) {
      if (dismissals.some(item => item.kind === 'chart' && item.id === chart.id)) { metricAnalyzer.deleteMetricChart(chart.id); continue; }
      const latest = localCharts.find(item => item.id === chart.id);
      metricAnalyzer.saveMetricChart(latest && (latest.updatedAt || latest.createdAt) >= (chart.updatedAt || chart.createdAt) ? latest : chart);
    }
  }
  hydrated.add(database);
}

export async function refreshDatabaseAnalysis(): Promise<AnalyticalCatalog> {
  const scope = await duckDBService.getCurrentCatalogAndSchema();
  const key = `${scope.catalog}.${scope.schema}`;
  const running = flights.get(key); if (running) return running;
  const request = ++generation;
  const current = () => request === generation && activeAnalysisDatabase() === scope.catalog;
  useDatabaseAnalysis.setState({ database: scope.catalog, schema: scope.schema, model: null, loading: true, error: null });
  const operation = (async () => {
    await hydrate(scope.catalog);
    const tables = await duckDBService.getTables();
    const model = await buildAnalyticalCatalog(tables);
    if (!current()) return model;
    const currentTableNames = new Set(model.tables.map(table => table.tableName.toLowerCase()));
    const id = `discovered:${key}`;
    const old = metricAnalyzer.getMetricPackage(id);
    const dismissals = automaticDismissals();
    const candidates = dismissals.some(item => item.kind === 'package' && item.id === id) ? []
      : proposeDatabaseMetrics(model, scope.catalog, scope.schema).filter(metric => !old?.dismissedMetricIds?.includes(metric.id));
    // A removed dependency remains visible with an invalid reason if the user edited it.
    // Unedited automatically discovered metrics belonging to dropped tables are cleaned up.
    const isMetricTableAvailable = (metric: MetricDefinition) => {
      if (metric.history?.length) return true;
      const prefix = `discovered:${scope.catalog}:${scope.schema}:`;
      if (metric.id.startsWith(prefix)) {
        const targetTable = metric.id.slice(prefix.length).split(':')[0];
        if (targetTable && !currentTableNames.has(targetTable.toLowerCase())) return false;
      }
      const sources = metric.sourceTable ? [metric.sourceTable] : extractTablesFromSql(metric.formula);
      if (sources.length) {
        const depTable = sources[0]?.split('.').pop()?.replace(/"/g, '');
        if (depTable && !currentTableNames.has(depTable.toLowerCase())) return false;
      }
      return true;
    };
    const validOldMetrics = (old?.metrics || []).filter(isMetricTableAvailable);

    const metrics = [...validOldMetrics.map((metric): MetricDefinition => {
      const candidate = candidates.find(candidate => candidate.id === metric.id);
      const oldAutomaticTrend = metric.sqlValidation?.startsWith("SELECT CAST(date_trunc('month',") && metric.sqlValidation.includes('AS DATE) AS period') && !metric.history?.length;
      if (!candidate || metric.history?.length || (metric.formula !== candidate.formula && !oldAutomaticTrend)) return metric;
      return { ...metric, sourceTable: metric.sourceTable || candidate.sourceTable, dependencies: candidate.dependencies,
        unit: metric.unit || candidate.unit, governance: {role: 'diagnostic', reviewStatus: 'draft', ...metric.governance},
        ...(oldAutomaticTrend ? {sqlValidation: candidate.sqlValidation, formula: candidate.formula} : {}),
        ...(metric.definition === metric.formula || oldAutomaticTrend ? {definition: candidate.definition} : {}),
      };
    }), ...candidates.filter(metric => !validOldMetrics.some(item => item.id === metric.id))];
    if (metrics.length) {
      metricAnalyzer.saveMetricPackage({ id, databaseName: scope.catalog, name: `${scope.schema} · 自动发现`,
        description: '实际数据库结构自动生成；支持修改定义，重新发现不会覆盖修改。不同单位分组展示。',
        sourceTables: model.tables.map(table => table.tableName), metrics, dismissedMetricIds: old?.dismissedMetricIds,
        createdAt: old?.createdAt || Date.now(), updatedAt: Date.now() });
    } else if (old) {
      metricAnalyzer.deleteMetricPackage(id);
    }
    const currentMetricsById = new Set(metrics.map(m => m.id));
    for (const chart of metricAnalyzer.loadMetricCharts()) {
      if (chart.databaseName === scope.catalog && chart.id.startsWith(`chart:discovered:${scope.catalog}:${scope.schema}:`)) {
        const chartTable = chart.id.slice(`chart:discovered:${scope.catalog}:${scope.schema}:`.length).split(':')[0];
        if (chartTable && !currentTableNames.has(chartTable.toLowerCase()) && (!chart.metricId || !currentMetricsById.has(chart.metricId))) {
          metricAnalyzer.deleteMetricChart(chart.id);
        }
      }
    }
    const executive = await ensureExecutiveMetrics();
    for (const pkg of metricAnalyzer.loadMetricPackages()) {
      const validated: MetricDefinition[] = [];
      for (const metric of pkg.metrics) {
        if (!current()) return model;
        try {
          const validation = await metricAnalyzer.validateMetric(metric, metricSource(metric, pkg.sourceTables));
          if (!validation.isValid) throw new Error(validation.error || '指标验证失败');
          validated.push({ ...metric, sqlValidation: validation.sql, validationDatabase: validation.database,
            validationResult: validation.result?.slice(0, 20), isValid: true, validationError: undefined, lastValidated: Date.now() });
        } catch (error) {
          validated.push({ ...metric, isValid: false, validationError: `数据库结构或查询定义已失效：${(error as Error).message}`, lastValidated: Date.now() });
        }
      }
      metricAnalyzer.saveMetricPackage({ ...pkg, metrics: validated });
    }
    let records = await dbService.getDomainSetting<AnalysisRecord[]>('linked-analyses', scope.catalog) || [];
    const initialRecords=new Map(records.map(record=>[record.id,JSON.stringify(record)]));
    records = records.filter(record => {
      if (record.databaseName === scope.catalog && record.id.startsWith(`analysis:discovered:${scope.catalog}:${scope.schema}:`)) {
        const recordTable = record.id.slice(`analysis:discovered:${scope.catalog}:${scope.schema}:`.length).split(':')[0];
        if (recordTable && !currentTableNames.has(recordTable.toLowerCase()) && (!record.metricId || !currentMetricsById.has(record.metricId))) {
          return false;
        }
      }
      return true;
    });
    const charts = metricAnalyzer.loadMetricCharts();
    for (const metric of [...metrics, ...(executive?.metrics || [])]) {
      if (!current()) return model;
      const chartId = `chart:${metric.id}`;
      if (!charts.some(chart => chart.id === chartId) && !dismissals.some(item => item.kind === 'chart' && item.id === chartId)) metricAnalyzer.saveMetricChart({ id: chartId, databaseName: scope.catalog,
        metricId: metric.id, metricPackageId: metric.id.startsWith('executive:') ? executive!.id : id, metricName: metric.name, sql: metric.sqlValidation!,
        sourceTable: metric.dependencies[0], chartConfig: metric.presentation!, createdAt: Date.now() });
      const existingChart = charts.find(chart => chart.id === chartId);
      if (metric.id.startsWith('executive:') && existingChart && !existingChart.chartConfig.format) {
        metricAnalyzer.updateMetricChart(chartId, {chartConfig:{...existingChart.chartConfig,
          format:{...metric.presentation?.format,unit:existingChart.chartConfig.unit}}});
      }
      const analysisId = `analysis:${metric.id}`;
      const table = model.tables.find(table => metric.id.startsWith(`discovered:${scope.catalog}:${scope.schema}:${table.tableName}:`));
      const note = table ? `数据概况：${table.rowCount} 条记录，${table.columnCount} 个字段。统计口径：${metric.definition}。字段含义、单位与业务用途需确认。` : `指标口径：${metric.definition}。结果实时计算。`;
      const record = records.find(record => record.id === analysisId);
      if (record && (record.note.startsWith('数据概况：') || record.note.startsWith('自动发现的探索起点'))) record.note = note;
      if (!record && !dismissals.some(item => item.kind === 'analysis' && item.id === analysisId)) records.push({ id: analysisId, databaseName: scope.catalog, schemaName: scope.schema,
        title: metric.name, metricId: metric.id, chartId, sourceTables: metric.dependencies, savedAt: Date.now(),
        note });
    }
    if (!current()) return model;
    // The model's metric index references the same definitions as the metric module.
    model.coreMetrics = metricAnalyzer.loadMetricPackages().flatMap(pkg => pkg.metrics
      .filter(metric => {
        if (metric.category === '自动发现') return false;
        const table = (extractTablesFromSql(metric.sqlValidation || metric.formula)[0]?.split('.').pop() || pkg.sourceTables[0])?.toLowerCase();
        return Boolean(table && currentTableNames.has(table));
      })
      .map(metric => ({
      id: metric.id, name: metric.name, tableName: extractTablesFromSql(metric.sqlValidation || metric.formula)[0]?.split('.').pop() || pkg.sourceTables[0],
      measureColumn: metric.presentation?.yKeys[0] || null, aggregation: /\bSUM\s*\(/i.test(metric.formula) ? 'sum' as const : /\bAVG\s*\(/i.test(metric.formula) ? 'avg' as const : 'count' as const,
      measureExpr: metric.formula, categoryDimensions: metric.presentation?.xKey ? [metric.presentation.xKey] : [],
      sql: metric.sqlValidation || metric.formula, rationale: metric.definition,
    })));
    const removed=new Set([...initialRecords.keys()].filter(id=>!records.some(record=>record.id===id)));
    const updates=records.filter(record=>initialRecords.get(record.id)!==JSON.stringify(record));
    await mutateDomainSetting<AnalysisRecord[]>('linked-analyses',scope.catalog,latest=>[
      ...(latest || []).filter(record=>!removed.has(record.id) && !updates.some(update=>update.id===record.id)),...updates,
    ]);
    await dbService.saveDomainSetting('data-model-v1', { database: scope.catalog, schema: scope.schema, model }, scope.catalog);
    await persistAnalysisDefinitions(scope.catalog);
    if (current()) useDatabaseAnalysis.setState(state => ({ model, loading: false, revision: state.revision + 1 }));
    window.dispatchEvent(new CustomEvent('duckdb-analysis-objects-updated'));
    return model;
  })().catch(error => {
    if (current()) useDatabaseAnalysis.setState({ loading: false, error: String(error.message || error) });
    throw error;
  }).finally(() => flights.delete(key));
  flights.set(key, operation);
  return operation;
}
