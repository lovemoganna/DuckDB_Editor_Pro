import { dbService } from './dbService';
import { metricAnalyzer } from './metricAnalyzer';
import { activeAnalysisDatabase } from './metricAssetStorage';
import { syncLinkedChart, unpinChartFromHome } from './homeDashboardService';
import { extractTablesFromSql } from './queryVizHint';
import type { MetricChart, ChartConfig } from '../types';

function assertCatalog(catalog: string): void {
  if (activeAnalysisDatabase() !== catalog) throw new Error('数据库已切换，请刷新后重试');
}

export async function loadVisualizationAssets(): Promise<MetricChart[]> {
  const catalog = activeAnalysisDatabase();
  const stored = metricAnalyzer.loadMetricCharts();
  const ids = new Set(stored.map((chart) => chart.id));
  const queries = await dbService.getQueries(catalog);
  assertCatalog(catalog);
  return [...stored, ...queries.flatMap((query) => {
    if (query.metricChartId && ids.has(query.metricChartId)) return [];
    return (query.charts || []).map((config) => ({
      id: `saved:${query.id}:${config.id}`, savedQueryId: query.id, databaseName: catalog,
      metricName: config.metricName || config.title || query.name,
      metricId: config.metricId, metricPackageId: config.metricPackageId,
      sourceTable: extractTablesFromSql(query.sql)[0],
      chartConfig: config, sql: query.sql, createdAt: query.createdAt,
    }));
  })];
}

export async function updateVisualizationAsset(chart: MetricChart, config: ChartConfig): Promise<void> {
  const catalog = chart.databaseName || activeAnalysisDatabase();
  assertCatalog(catalog);
  if (chart.savedQueryId) {
    const queries = await dbService.getQueries(chart.databaseName);
    const query = queries.find((item) => item.id === chart.savedQueryId);
    assertCatalog(catalog);
    if (!query || !query.charts?.some(item => item.id === chart.chartConfig.id)) throw new Error('原始图表已删除，请刷新列表');
    await dbService.saveQuery({ ...query, charts: (query.charts || []).map((item) =>
      item.id === chart.chartConfig.id ? config : item),
    });
    window.dispatchEvent(new CustomEvent('duckdb-home-dashboard-updated'));
  } else {
    const updated = metricAnalyzer.updateMetricChart(chart.id, { chartConfig: config });
    if (!updated) throw new Error('原始图表已删除，请刷新列表');
    await syncLinkedChart(updated);
  }
  window.dispatchEvent(new CustomEvent('duckdb-metric-charts-updated'));
}

export async function deleteVisualizationAsset(chart: MetricChart): Promise<void> {
  const catalog = chart.databaseName || activeAnalysisDatabase();
  assertCatalog(catalog);
  if (chart.savedQueryId) {
    const query = (await dbService.getQueries(chart.databaseName)).find((item) => item.id === chart.savedQueryId);
    assertCatalog(catalog);
    if (query) {
      const charts = (query.charts || []).filter((item) => item.id !== chart.chartConfig.id);
      if (charts.length === 0) await unpinChartFromHome(chart);
      assertCatalog(catalog);
      await dbService.saveQuery({ ...query, charts, widgetType: charts.length ? 'chart' : 'table' });
    }
  } else {
    await unpinChartFromHome(chart);
    assertCatalog(catalog);
    metricAnalyzer.deleteMetricChart(chart.id);
    // Keep the user's saved SQL while detaching its removed visualization.
    for (const query of await dbService.getQueries(chart.databaseName)) {
      assertCatalog(catalog);
      if (query.metricChartId === chart.id) {
        await dbService.saveQuery({ ...query, metricChartId: undefined, charts: [], widgetType: 'table' });
      }
    }
  }
  // Object references contain no user SQL. Remove them rather than leaving a
  // dangling home/history entry after the original chart is gone.
  for (const query of await dbService.getQueries(catalog)) {
    assertCatalog(catalog);
    if (query.analysisRef?.kind === 'chart' && query.analysisRef.id === chart.id && !query.sql?.trim()) {
      await dbService.deleteQuery(query.id, catalog);
    }
  }
  window.dispatchEvent(new CustomEvent('duckdb-metric-charts-updated'));
}
