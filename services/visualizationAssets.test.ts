import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ getQueries: vi.fn(), saveQuery: vi.fn(), charts: vi.fn(), update: vi.fn(),
  remove: vi.fn(), unpin: vi.fn(), sync: vi.fn(), deleteQuery: vi.fn() }));
vi.mock('./dbService', () => ({ dbService: { getQueries: mocks.getQueries, saveQuery: mocks.saveQuery, deleteQuery: mocks.deleteQuery } }));
vi.mock('./metricAnalyzer', () => ({ metricAnalyzer: { loadMetricCharts: mocks.charts, updateMetricChart: mocks.update, deleteMetricChart: mocks.remove } }));
vi.mock('./metricAssetStorage', () => ({ activeAnalysisDatabase: () => 'memory' }));
vi.mock('./homeDashboardService', () => ({ syncLinkedChart: mocks.sync, unpinChartFromHome: mocks.unpin }));
import { loadVisualizationAssets, updateVisualizationAsset, deleteVisualizationAsset } from './visualizationAssets';
const config = { id: 'cfg', type: 'bar' as const, title: 'revenue', xKey: 'region', yKeys: ['total'] };
const chart = { id: 'c', metricName: 'revenue', sql: 'SELECT region, amount AS total FROM sales', chartConfig: config, createdAt: 1 };

describe('shared visualization assets', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.charts.mockReturnValue([chart]);
    mocks.getQueries.mockResolvedValue([]); mocks.unpin.mockResolvedValue(undefined);
  });
  it('reuses home and SQL charts while deduplicating linked metric copies', async () => {
    mocks.getQueries.mockResolvedValue([
      { id: 'linked', metricChartId: 'c', sql: chart.sql, charts: [config], createdAt: 1 },
      { id: 'sql', name: 'saved SQL', sql: chart.sql, charts: [config], createdAt: 1 },
    ]);
    const assets = await loadVisualizationAssets();
    expect(assets.map(item => item.id)).toEqual(['c', 'saved:sql:cfg']);
    expect(assets[1].savedQueryId).toBe('sql');
  });
  it('updates the original SQL asset without creating a separate metric copy', async () => {
    const source = { id: 'sql', sql: chart.sql, charts: [config] };
    mocks.getQueries.mockResolvedValue([source]);
    await updateVisualizationAsset({ ...chart, savedQueryId: 'sql' }, { ...config, title: 'edited' });
    expect(mocks.saveQuery).toHaveBeenCalledWith({ ...source, charts: [{ ...config, title: 'edited' }] });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.deleteQuery).not.toHaveBeenCalled();
  });
  it('removes deleted charts from home but preserves the saved SQL', async () => {
    mocks.getQueries.mockResolvedValue([{ id: 'linked', metricChartId: 'c', sql: chart.sql, charts: [config] }]);
    await deleteVisualizationAsset(chart);
    expect(mocks.unpin).toHaveBeenCalledWith(chart);
    expect(mocks.remove).toHaveBeenCalledWith('c');
    expect(mocks.saveQuery).toHaveBeenCalledWith(expect.objectContaining({ sql: chart.sql, charts: [], metricChartId: undefined }));
  });

  it('rejects mutations of another database before touching storage', async () => {
    await expect(updateVisualizationAsset({...chart, databaseName: 'other'}, config)).rejects.toThrow('数据库已切换');
    await expect(deleteVisualizationAsset({...chart, databaseName: 'other'})).rejects.toThrow('数据库已切换');
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.unpin).not.toHaveBeenCalled();
  });

  it('reports a removed original chart instead of claiming an update succeeded', async () => {
    mocks.update.mockReturnValue(null);
    await expect(updateVisualizationAsset(chart, config)).rejects.toThrow('原始图表已删除');
    mocks.getQueries.mockResolvedValue([{id: 'sql', charts: []}]);
    await expect(updateVisualizationAsset({...chart, savedQueryId: 'sql'}, config)).rejects.toThrow('原始图表已删除');
    expect(mocks.saveQuery).not.toHaveBeenCalled();
  });

  it('deletes generated object references while retaining actual saved SQL', async () => {
    mocks.getQueries.mockResolvedValue([
      {id:'analysis-ref:chart:c', sql:'', analysisRef:{kind:'chart',id:'c'}},
      {id:'user-query', sql:chart.sql, metricChartId:'c', charts:[config]},
    ]);
    await deleteVisualizationAsset(chart);
    expect(mocks.deleteQuery).toHaveBeenCalledWith('analysis-ref:chart:c', 'memory');
    expect(mocks.deleteQuery).toHaveBeenCalledTimes(1);
    expect(mocks.saveQuery).toHaveBeenCalledWith(expect.objectContaining({id:'user-query', sql:chart.sql, charts:[]}));
  });
});
