import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ charts: [] as any[], query: vi.fn(), remove: vi.fn(), metric: {} as any }));
vi.mock('../services/metricAnalyzer', () => ({ metricAnalyzer: { getChartsByPackage: () => state.charts,
  loadMetricPackages: () => [{ id: 'pkg', metrics: [state.metric] }], convertToSavedQuery: vi.fn() } }));
vi.mock('../services/metricAssetStorage', () => ({ activeAnalysisDatabase: () => 'memory' }));
vi.mock('../services/duckdbService', () => ({ duckDBService: { getTableSchema: async () => [{ name: 'occurred_at', type: 'TIMESTAMP' }] } }));
vi.mock('../services/analysis/readQuery', async () => ({ ...(await vi.importActual('../services/analysis/readQueryGuard')), executeAnalysisQuery: (...args: unknown[]) => state.query(...args) }));
vi.mock('../services/visualizationAssets', () => ({ deleteVisualizationAsset: (...args: unknown[]) => state.remove(...args) }));
import { MetricChartListModal } from './MetricChartListModal';
beforeEach(() => {
  state.metric = { id: 'm1', name: 'amount', formula: 'SELECT 99', calculation: { aggregation: 'SUM', field: 'amount', filter: 'valid = true', groupBy: ['region'] } };
  state.charts = [1, 2].map(n => ({ id: `c${n}`, metricId: `m${n}`, metricPackageId: 'pkg', metricName: `metric${n}`, sourceTable: 'orders', sql: `SELECT ${n} AS value`, chartConfig: { type: 'counter', yKeys: ['value'] } }));
  state.query.mockReset().mockResolvedValue([{ value: 1 }]);
  state.remove.mockReset().mockImplementation(async chart => { state.charts = state.charts.filter(c => c.id !== chart.id); });
});
afterEach(cleanup);
describe('metric chart asset operations', () => {
  it('preserves calculation filters and grouping and sends a matching trend configuration', async () => {
    const open = vi.fn();
    render(<MetricChartListModal packageId="pkg" onClose={vi.fn()} onRefresh={vi.fn()} onOpenInSqlEditor={open} />);
    fireEvent.click(screen.getAllByRole('button', { name: '趋势' })[0]);
    await waitFor(() => expect(open).toHaveBeenCalled());
    expect(open.mock.calls[0][0].sql).toContain('WHERE (valid = true)');
    expect(open.mock.calls[0][0].sql).toContain('"region"');
    expect(open.mock.calls[0][0].chartConfig).toMatchObject({ type: 'line', xKey: 'period', yKeys: ['value'], groupBy: 'region' });
  });
  it('sends comparison columns together with their matching configuration', async () => {
    const open = vi.fn();
    render(<MetricChartListModal packageId="pkg" onClose={vi.fn()} onRefresh={vi.fn()} onOpenInSqlEditor={open} />);
    fireEvent.click(screen.getByRole('button', { name: '对比模式' }));
    for (const box of screen.getAllByRole('checkbox')) fireEvent.click(box);
    fireEvent.click(screen.getByRole('button', { name: '生成对比 SQL' }));
    await waitFor(() => expect(open).toHaveBeenCalled());
    expect(open.mock.calls[0][0].sql).toContain('UNION ALL');
    expect(open.mock.calls[0][0].chartConfig).toMatchObject({ type: 'bar', xKey: 'metric_name', yKeys: ['metric_value'] });
  });
  it('removes deleted charts from comparison selection', async () => {
    render(<MetricChartListModal packageId="pkg" onClose={vi.fn()} onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '对比模式' }));
    for (const box of screen.getAllByRole('checkbox')) fireEvent.click(box);
    fireEvent.click(screen.getAllByRole('button', { name: '删除图表' })[0]);
    fireEvent.click(screen.getByRole('button', { name: '是', exact: true }));
    await waitFor(() => expect(screen.queryByRole('button', { name: '生成对比 SQL' })).toBeNull());
    expect(screen.queryByText('metric1')).toBeNull();
  });
});
