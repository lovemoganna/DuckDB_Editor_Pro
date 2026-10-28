import { dbService } from './dbService';
import { mutateDomainSetting } from './domainSettingMutation';
import { metricAnalyzer } from './metricAnalyzer';
import { metricSource } from './metricSql';
import { loadVisualizationAssets, updateVisualizationAsset } from './visualizationAssets';
import { extractTablesFromSql } from './queryVizHint';
import type { SavedQuery, ChartConfig } from '../types';
import type { AnalysisWorkspaceContext } from '../hooks/store/useAnalysisWorkspace';
import { activeAnalysisDatabase, dismissAutomaticObject } from './metricAssetStorage';

export type AnalysisRecord = AnalysisWorkspaceContext & { id: string; savedAt: number; note: string };
export type AnalysisObject = { id: string; kind: 'metric' | 'chart' | 'analysis'; name: string; sql: string; chartConfig?: ChartConfig; note?: string; unavailableReason?: string };

export async function deleteAnalysisRecord(id: string, database: string): Promise<void> {
  if (activeAnalysisDatabase() !== database) throw new Error('数据库已切换，请重新选择分析');
  await mutateDomainSetting<AnalysisRecord[]>('linked-analyses',database,records=>(records || []).filter(record=>record.id!==id));
  dismissAutomaticObject('analysis', id);
  window.dispatchEvent(new CustomEvent('duckdb-analysis-objects-updated'));
  window.dispatchEvent(new CustomEvent('duckdb-home-dashboard-updated'));
}

export async function listAnalysisObjects(database: string): Promise<AnalysisObject[]> {
  const definitions = metricAnalyzer.loadMetricPackages().flatMap(pkg => pkg.metrics);
  const metricReason = (id?: string) => {
    if (!id) return undefined;
    const metric = definitions.find(item => item.id === id);
    return !metric ? '关联指标已删除' : metric.isValid === false ? metric.validationError || '关联指标验证失败，请修复来源或定义' : undefined;
  };
  const metrics: AnalysisObject[] = metricAnalyzer.loadMetricPackages().flatMap(pkg => pkg.metrics.map(metric => ({
    id: metric.id, kind: 'metric' as const, name: metric.name, sql: metric.sqlValidation || '', chartConfig: metric.presentation,
    unavailableReason: metricReason(metric.id),
  })));
  const charts: AnalysisObject[] = (await loadVisualizationAssets()).map(chart => ({
    id: chart.id, kind: 'chart', name: chart.chartConfig.title || chart.metricName, sql: chart.sql, chartConfig: chart.chartConfig, unavailableReason: metricReason(chart.metricId),
  }));
  const analyses: AnalysisObject[] = (await dbService.getDomainSetting<AnalysisRecord[]>('linked-analyses', database) || []).map(record => ({
    id: record.id, kind: 'analysis', name: record.title, sql: record.sql || '', chartConfig: record.chartConfig, note: record.note, unavailableReason: metricReason(record.metricId),
  }));
  return [...metrics, ...charts, ...analyses];
}

/** Definitions remain in their original module. The home asset carries identity only. */
export async function resolveAnalysisObject(query: SavedQuery): Promise<SavedQuery> {
  if (!query.analysisRef && !query.metricChartId) return query;
  const ref = query.analysisRef || { kind: 'chart' as const, id: query.metricChartId! };
  let sql = '', name = query.name, config: ChartConfig | undefined, note: string | undefined;
  let datasetId=query.datasetId,querySpec=query.querySpec;
  if (ref.kind === 'metric') {
    const pkg = metricAnalyzer.loadMetricPackages().find(pkg => pkg.metrics.some(metric => metric.id === ref.id));
    const metric = pkg?.metrics.find(metric => metric.id === ref.id);
    if (!metric) throw new Error('关联指标已删除，请移除此组件或重新选择指标');
    const validation = await metricAnalyzer.validateMetric(metric, metricSource(metric, pkg!.sourceTables));
    if (!validation.isValid) throw new Error(validation.error || '指标验证失败');
    sql = validation.sql!; name = metric.name; config = metric.presentation;
    note = metric.category === '自动发现' ? `候选统计；字段含义、单位与业务用途需确认。\n${metric.definition}` : metric.definition;
  } else if (ref.kind === 'chart') {
    const chart = (await loadVisualizationAssets()).find(chart => chart.id === ref.id);
    if (!chart) throw new Error('关联可视化已删除，请重新选择可视化');
    if (chart.metricId && !metricAnalyzer.loadMetricPackages().some(pkg => pkg.metrics.some(metric => metric.id === chart.metricId))) {
      throw new Error('此可视化引用的指标已删除');
    }
    sql = chart.sql; name = chart.chartConfig.title || chart.metricName; config = chart.chartConfig;
    if(chart.savedQueryId) {
      const source=(await dbService.getQueries(query.databaseName)).find(saved=>saved.id===chart.savedQueryId);
      if(source?.sql===chart.sql){datasetId=source.datasetId;querySpec=source.querySpec;}
    }
    const metric = metricAnalyzer.loadMetricPackages().flatMap(pkg => pkg.metrics).find(metric => metric.id === chart.metricId);
    note = metric?.category === '自动发现' ? `候选统计；字段含义、单位与业务用途需确认。\n${metric.definition}` : metric?.definition;
  } else {
    const record = (await dbService.getDomainSetting<AnalysisRecord[]>('linked-analyses', query.databaseName) || []).find(record => record.id === ref.id);
    if (!record) throw new Error('关联分析已删除，请重新选择分析');
    const { resolveAnalysisContext } = await import('../hooks/store/useAnalysisWorkspace');
    const resolved = await resolveAnalysisContext({ ...record, analysisId: record.id });
    sql = resolved.sql || ''; config = resolved.chartConfig; name = record.title; note = record.note;
  }
  if (!sql) throw new Error('关联对象缺少可执行 SQL，请在来源模块完善定义');
  return { ...query, name, sql, datasetId, querySpec, charts: config ? [config] : undefined, desc: note,
    widgetType: config ? 'chart' : 'table', referencedTables: extractTablesFromSql(sql), referencedSchemas: [] };
}

export function objectReferenceQueryId(object: Pick<AnalysisObject, 'kind' | 'id'>): string {
  return `analysis-ref:${object.kind}:${object.id}`;
}

export async function saveObjectReference(object: Pick<AnalysisObject, 'kind' | 'id' | 'name'>, database: string): Promise<SavedQuery> {
  const id = objectReferenceQueryId(object);
  const existing = (await dbService.getQueries(database)).find(query => query.id === id);
  if (existing) return existing;
  const query: SavedQuery = { id, databaseName: database, name: object.name, sql: '', createdAt: Date.now(),
    analysisRef: { kind: object.kind, id: object.id }, widgetType: 'table' };
  await dbService.saveQuery(query);
  return query;
}

export async function updateObjectPresentation(query: SavedQuery, config: ChartConfig): Promise<void> {
  const ref = query.analysisRef;
  if (!ref) { await dbService.saveQuery({ ...query, charts: [config], widgetType: 'chart' }); return; }
  if (ref.kind === 'metric') {
    const pkg = metricAnalyzer.loadMetricPackages().find(pkg => pkg.metrics.some(metric => metric.id === ref.id));
    if (!pkg) throw new Error('关联指标已删除');
    metricAnalyzer.updateMetricPackage(pkg.id, { metrics: pkg.metrics.map(metric => metric.id === ref.id ? { ...metric, presentation: config } : metric) });
  } else if (ref.kind === 'chart') {
    const chart = (await loadVisualizationAssets()).find(chart => chart.id === ref.id);
    if (!chart) throw new Error('关联图表已删除');
    await updateVisualizationAsset(chart, config);
  } else {
    const records = await dbService.getDomainSetting<AnalysisRecord[]>('linked-analyses', query.databaseName) || [];
    const record = records.find(record => record.id === ref.id);
    if (!record) throw new Error('关联分析已删除');
    if (record.chartId) {
      const chart = (await loadVisualizationAssets()).find(chart => chart.id === record.chartId);
      if (!chart) throw new Error('分析引用的图表已删除');
      await updateVisualizationAsset(chart, config);
    } else await mutateDomainSetting<AnalysisRecord[]>('linked-analyses',query.databaseName,current=>{
      if(!current?.some(item=>item.id===ref.id))throw new Error('关联分析已删除');
      return current.map(item=>item.id===ref.id?{...item,chartConfig:config,savedAt:Math.max(Date.now(),item.savedAt+1)}:item);
    });
  }
  window.dispatchEvent(new CustomEvent('duckdb-home-dashboard-updated'));
}
