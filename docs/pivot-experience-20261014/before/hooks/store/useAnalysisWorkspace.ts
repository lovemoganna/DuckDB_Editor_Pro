import { duckDBService } from '../../services/duckdbService';
import { loadVisualizationAssets } from '../../services/visualizationAssets';
import { create } from 'zustand';
import { Tab, type ChartConfig, type MetricDefinition, type MetricChart } from '../../types';
import { useAppStore } from './useAppStore';
import { useDataViewStore } from './useDataViewStore';
import { activeAnalysisDatabase } from '../../services/metricAssetStorage';
import { metricSource } from '../../services/metricSql';
import { metricAnalyzer } from '../../services/metricAnalyzer';
import { extractTablesFromSql } from '../../services/queryVizHint';
import { dbService } from '../../services/dbService';
import type { AnalysisRecord } from '../../services/analysisObjects';

/** Shared provenance, not a second copy of an editable metric definition. */
export interface AnalysisWorkspaceContext {
  databaseName: string;
  schemaName?: string;
  title: string;
  metricId?: string;
  chartId?: string;
  analysisId?: string;
  sql?: string;
  chartConfig?: ChartConfig;
  sourceTables: string[];
}
export const useAnalysisWorkspace = create<{
  context: AnalysisWorkspaceContext | null;
  setContext: (context: AnalysisWorkspaceContext | null) => void;
  visualizationMetricId: string | null;
  setVisualizationMetricId: (id: string | null) => void;
  inspectionRequested: boolean;
  requestInspection: () => void;
  clearInspectionRequest: () => void;
}>((set) => ({ context: null, setContext: context => set({ context }), visualizationMetricId: null,
  setVisualizationMetricId: visualizationMetricId => set({visualizationMetricId}),
  inspectionRequested: false,
  requestInspection: () => set({ context: null, inspectionRequested: true }),
  clearInspectionRequest: () => set({ inspectionRequested: false }) }));

export function openAnalysis(context: AnalysisWorkspaceContext): void {
  useAnalysisWorkspace.getState().setContext(context);
  const table = context.sourceTables[0]?.split('.').pop();
  if (table) useAppStore.getState().setCurrentTable(table);
  useAppStore.getState().setActiveTab(Tab.ANALYSIS_HUB);
}
export function analyzeMetric(metric: MetricDefinition, sourceTable?: string): void {
  openAnalysis({ databaseName: activeAnalysisDatabase(), title: metric.name, metricId: metric.id,
    sourceTables: extractTablesFromSql(metric.sqlValidation || metric.formula).length
      ? extractTablesFromSql(metric.sqlValidation || metric.formula) : sourceTable ? [sourceTable] : [] });
}
export function analyzeChart(chart: MetricChart): void {
  openAnalysis({ databaseName: chart.databaseName || activeAnalysisDatabase(), title: chart.metricName,
    metricId: chart.metricId, chartId: chart.id, sql: chart.metricId ? undefined : chart.sql,
    chartConfig: chart.chartConfig, sourceTables: extractTablesFromSql(chart.sql) });
}
/** Follow the physical source, including its catalog and schema, before opening the grid. */
export async function navigateToAnalysisSource(source: string): Promise<void> {
  const parts = source.split('.');
  const table = parts.pop()!;
  let scope = await duckDBService.getCurrentCatalogAndSchema();
  const schema = parts.pop() || scope.schema;
  const catalog = parts.pop() || scope.catalog;
  if (catalog !== scope.catalog) scope = await duckDBService.switchAnalysisContext({kind:'database',id:catalog});
  if (schema !== scope.schema) await duckDBService.switchAnalysisContext({kind:'schema',id:schema});
  const tables = await duckDBService.getTables();
  if (!tables.includes(table)) throw new Error(`来源表 ${source} 已不存在`);
  const app = useAppStore.getState();
  app.setCurrentDatabase(catalog); app.setTables(tables); app.setCurrentTable(table);
  const grid = useDataViewStore.getState();
  grid.setSortConfig([]); grid.setFilterQuery(''); grid.setDataViewMode('grid'); grid.setHiddenColumns(new Set());
  await Promise.all([grid.fetchTableData(table, 0, grid.pagination.limit, [], ''), grid.fetchProfileData(table)]);
  app.setActiveTab(Tab.DATA);
}
export async function resolveAnalysisContext(context: AnalysisWorkspaceContext) {
  if (context.databaseName !== activeAnalysisDatabase()) throw new Error('分析所属数据库已切换，请重新选择指标或图表');
  if (context.analysisId) {
    const records = await dbService.getDomainSetting<AnalysisRecord[]>('linked-analyses', context.databaseName) || [];
    const record = records.find(record => record.id === context.analysisId);
    if (!record) throw new Error('关联分析已删除，请重新选择分析');
    context = { ...record, analysisId: record.id };
  }
  const scope = await duckDBService.getCurrentCatalogAndSchema();
  if (context.schemaName && context.schemaName !== scope.schema) throw new Error('分析所属 Schema 已切换，请回到原始数据范围');
  let sql = context.sql;
  let title = context.title;
  let chartConfig = context.chartConfig;
  if (context.chartId) {
    const chart = (await loadVisualizationAssets()).find(chart => chart.id === context.chartId);
    if (!chart) throw new Error('关联图表已删除，请重新选择');
    sql = chart.sql; chartConfig = chart.chartConfig; title = chart.metricName;
  }
  if (context.metricId) {
    const pkg = metricAnalyzer.loadMetricPackages().find(p => p.metrics.some(m => m.id === context.metricId));
    const metric = pkg?.metrics.find(m => m.id === context.metricId);
    if (!metric || !pkg) throw new Error('关联指标已删除，请返回指标中心重新选择');
    title = metric.name;
    const validation = await metricAnalyzer.validateMetric(metric, metricSource(metric, pkg.sourceTables));
    if (!validation.isValid) throw new Error(validation.error || '指标验证失败');
    sql = validation.sql;
    if (!context.chartId) chartConfig = context.analysisId && context.chartConfig ? context.chartConfig : metric.presentation || context.chartConfig;
  }
  if (!sql) throw new Error('分析缺少查询定义');
  return { ...context, schemaName: scope.schema, title, sql, chartConfig, sourceTables: extractTablesFromSql(sql) };
}
