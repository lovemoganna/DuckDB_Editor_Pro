// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VisualizationCard } from './VisualizationCard';
import { VisualizationWorkbench, matchesVisualizationTable } from './VisualizationWorkbench';
import { MetricChart } from '../../types';
import { metricAnalyzer } from '../../services/metricAnalyzer';
import { duckDBService } from '../../services/duckdbService';
import { loadVisualizationAssets } from '../../services/visualizationAssets';
import { loadHomePinnedChartIds, pinChartToHome, unpinChartFromHome } from '../../services/homeDashboardService';
vi.mock('../charts/ChartRenderer', () => ({ ChartRenderer: () => <div data-testid="chart-canvas" /> }));
vi.mock('../../services/visualizationAssets', () => ({ loadVisualizationAssets: vi.fn(), updateVisualizationAsset: vi.fn(), deleteVisualizationAsset: vi.fn() }));
vi.mock('../../services/homeDashboardService', () => ({ loadHomePinnedChartIds: vi.fn(), pinChartToHome: vi.fn(), unpinChartFromHome: vi.fn() }));

afterEach(cleanup);

const mockChart: MetricChart = {
  id: 'chart-test-1',
  metricName: '电商核心GMV分析',
  metricId: 'metric-gmv-123',
  metricPackageId: 'pkg-ecommerce',
  sql: 'SELECT region, SUM(amount) AS gmv FROM demo_sales GROUP BY region;',
  chartConfig: {
    id: 'cfg-1',
    title: '各区域GMV对比',
    type: 'bar',
    xKey: 'region',
    yKeys: ['gmv'],
  },
  createdAt: Date.now(),
};

const mockData = [
  { region: 'East', gmv: 50000 },
  { region: 'West', gmv: 32000 },
];

describe('VisualizationCard', () => {
  it('renders chart title, type label, and handles collaborative actions', async () => {
    const onOpenInSql = vi.fn();
    const onNavigateToMetrics = vi.fn();
    const onNavigateToData = vi.fn();
    const onShowLineage = vi.fn();
    const onPinToDashboard = vi.fn();
    const onDelete = vi.fn();

    render(
      <VisualizationCard
        chart={mockChart}
        data={mockData}
        onOpenInSql={onOpenInSql}
        onNavigateToMetrics={onNavigateToMetrics}
        onNavigateToData={onNavigateToData}
        onShowLineage={onShowLineage}
        onPinToDashboard={onPinToDashboard}
        onDelete={onDelete}
        isPinned={false}
      />
    );

    // Title and tags
    expect(screen.getByText('各区域GMV对比')).toBeTruthy();
    expect(screen.getByText('BAR')).toBeTruthy();
    expect(screen.getByText('demo_sales')).toBeTruthy();
    expect(screen.getByText('电商核心GMV分析')).toBeTruthy();

    // Navigate to SQL
    const sqlBtn = screen.getByTitle('在 SQL 工作台中直接打开并执行该图表底层查询');
    fireEvent.click(sqlBtn);
    expect(onOpenInSql).toHaveBeenCalledWith(mockChart.sql);

    // Navigate to metrics
    const metricBadge = screen.getByTitle('前往指标中心查看关联定义');
    fireEvent.click(metricBadge);
    expect(onNavigateToMetrics).toHaveBeenCalledWith('metric-gmv-123');

    // Navigate to table data
    const tableBadge = screen.getByTitle('查看关联数据表 demo_sales');
    fireEvent.click(tableBadge);
    expect(onNavigateToData).toHaveBeenCalledWith('demo_sales');

    // Show lineage
    const lineageBtn = screen.getByTitle('查看该指标的物理表与字段血缘依赖拓扑');
    fireEvent.click(lineageBtn);
    expect(onShowLineage).toHaveBeenCalledWith(mockChart);

    // Pin to dashboard
    const pinBtn = screen.getByTitle('固定到首页仪表盘');
    fireEvent.click(pinBtn);
    expect(onPinToDashboard).toHaveBeenCalledWith(mockChart);
  });
});

describe('VisualizationWorkbench', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.mocked(loadVisualizationAssets).mockResolvedValue([]);
    vi.mocked(loadHomePinnedChartIds).mockResolvedValue(new Set());
  });

  it('uses the same filtered assets and query results in list mode, and remembers the presentation', async () => {
    vi.mocked(loadVisualizationAssets).mockResolvedValue([mockChart]);
    vi.spyOn(duckDBService,'query').mockResolvedValue(mockData);
    render(<VisualizationWorkbench/>);
    await screen.findByText('各区域GMV对比');
    fireEvent.click(screen.getByRole('button',{name:'列表',exact:true}));
    expect(screen.getByRole('list',{name:'图表资产列表'})).toBeTruthy();
    await screen.findByLabelText('各区域GMV对比：2 行结果');
    expect(screen.queryByTestId('chart-canvas')).toBeNull();
    expect(localStorage.getItem('duckdb-viz-presentation')).toBe('list');
    fireEvent.change(screen.getByPlaceholderText('搜索图表名称、指标或 SQL...'),{target:{value:'absent'}});
    expect(screen.getByText('未找到匹配的图表')).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'重置所有筛选'}));
    expect(screen.getByRole('button',{name:'查看图表 各区域GMV对比'})).toBeTruthy();
  });

  it('opens a focused inspection with a separate export container and restores keyboard focus', async () => {
    vi.mocked(loadVisualizationAssets).mockResolvedValue([mockChart]);
    vi.spyOn(duckDBService,'query').mockResolvedValue(mockData);
    render(<VisualizationWorkbench/>);
    const trigger=await screen.findByRole('button',{name:'专注查看 各区域GMV对比'});
    trigger.focus(); fireEvent.click(trigger);
    const dialog=screen.getByRole('dialog',{name:'专注查看'});
    expect(within(dialog).getByText('各区域GMV对比')).toBeTruthy();
    expect(document.querySelectorAll('#viz-card-chart-test-1')).toHaveLength(1);
    expect(dialog.querySelector('#viz-inspector-chart-test-1')).toBeTruthy();
    fireEvent.keyDown(document,{key:'Escape'});
    expect(screen.queryByRole('dialog',{name:'专注查看'})).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes inspection immediately when switching database and never retains the prior asset', async () => {
    vi.mocked(loadVisualizationAssets).mockResolvedValueOnce([mockChart]).mockResolvedValue([]);
    vi.spyOn(duckDBService,'query').mockResolvedValue(mockData);
    localStorage.setItem('duckdb-viz-presentation','list');
    render(<VisualizationWorkbench/>);
    fireEvent.click(await screen.findByRole('button',{name:'查看图表 各区域GMV对比'}));
    expect(screen.getByRole('dialog',{name:'专注查看'})).toBeTruthy();
    fireEvent(window,new Event('duckdb-database-changed'));
    expect(screen.queryByRole('dialog',{name:'专注查看'})).toBeNull();
    expect(await screen.findByText('暂无可视化图表资产')).toBeTruthy();
    expect(screen.queryByText('各区域GMV对比')).toBeNull();
  });

  it('announces a failed query in the list instead of implying it returned zero rows', async () => {
    vi.mocked(loadVisualizationAssets).mockResolvedValue([mockChart]);
    vi.spyOn(duckDBService,'query').mockRejectedValue(new Error('source unavailable'));
    localStorage.setItem('duckdb-viz-presentation','list');
    render(<VisualizationWorkbench/>);
    expect(await screen.findByLabelText('各区域GMV对比：查询失败')).toHaveTextContent('查询失败');
    expect(screen.queryByLabelText('各区域GMV对比：0 行结果')).toBeNull();
  });

  it('renders an honest empty state without demo insertion controls', async () => {
    render(<VisualizationWorkbench tables={[]} />);
    expect(await screen.findByText('暂无可视化图表资产')).toBeTruthy();
    expect(screen.queryByText('载入精选演示图表')).toBeNull();
    expect(screen.queryByText('载入精选图表')).toBeNull();
  });

  it('matches qualified tables without conflating schemas', () => {
    expect(matchesVisualizationTable('"sales"."orders"', 'sales.orders')).toBe(true);
    expect(matchesVisualizationTable('archive.orders', 'sales.orders')).toBe(false);
    expect(matchesVisualizationTable('orders', 'sales.orders')).toBe(true);
  });

  it('distinguishes asset loading failures from an empty asset library and retries', async () => {
    vi.mocked(loadVisualizationAssets).mockRejectedValueOnce(new Error('metadata unavailable')).mockResolvedValue([]);
    render(<VisualizationWorkbench />);
    expect(await screen.findByText('可视化资产加载失败')).toBeTruthy();
    expect(screen.queryByText('暂无可视化图表资产')).toBeNull();
    fireEvent.click(screen.getByText('重试加载'));
    expect(await screen.findByText('暂无可视化图表资产')).toBeTruthy();
  });

  it('exposes every registered type and filters legacy counter assets as KPI', async () => {
    vi.mocked(loadVisualizationAssets).mockResolvedValue([{...mockChart, chartConfig: {...mockChart.chartConfig, type: 'counter'}}]);
    vi.spyOn(duckDBService, 'query').mockResolvedValue(mockData);
    render(<VisualizationWorkbench />);
    await screen.findByText('各区域GMV对比');
    const select = screen.getByLabelText('图表类型筛选');
    expect(select.querySelector('option[value="combo"]')).toBeTruthy();
    expect(select.querySelector('option[value="histogram"]')).toBeTruthy();
    fireEvent.change(select, {target: {value: 'kpi'}});
    expect(screen.getByText('各区域GMV对比')).toBeTruthy();
  });

  it('discards an older asset request after switching database', async () => {
    let resolve!: (charts: MetricChart[]) => void;
    vi.mocked(loadVisualizationAssets).mockReturnValueOnce(new Promise(done => {resolve = done;})).mockResolvedValue([]);
    render(<VisualizationWorkbench />);
    fireEvent(window, new Event('duckdb-database-changed'));
    await screen.findByText('暂无可视化图表资产');
    resolve([mockChart]);
    await waitFor(() => expect(screen.queryByText('各区域GMV对比')).toBeNull());
  });

  it('shows the database query error instead of presenting it as an empty result', async () => {
    vi.mocked(loadVisualizationAssets).mockResolvedValue([mockChart]);
    vi.spyOn(duckDBService, 'query').mockRejectedValue(new Error('Table demo_sales does not exist'));
    render(<VisualizationWorkbench tables={[]} />);
    expect(await screen.findByText('Table demo_sales does not exist')).toBeTruthy();
    expect(screen.queryByText('查询成功，当前结果为空')).toBeNull();
    expect(screen.getByLabelText('固定到仪表盘')).toBeDisabled();
  });

  it('derives pinned state from the actual home board and really unpins it', async () => {
    vi.mocked(loadVisualizationAssets).mockResolvedValue([mockChart]);
    vi.mocked(loadHomePinnedChartIds).mockResolvedValue(new Set([mockChart.id]));
    vi.spyOn(duckDBService, 'query').mockResolvedValue(mockData);
    render(<VisualizationWorkbench tables={[]} />);
    fireEvent.click(await screen.findByLabelText('取消固定到仪表盘'));
    await waitFor(() => expect(unpinChartFromHome).toHaveBeenCalledWith(mockChart));
    expect(pinChartToHome).not.toHaveBeenCalled();
  });

  it('renders chart cards when charts exist and supports search filtering', async () => {
    vi.mocked(loadVisualizationAssets).mockResolvedValue([mockChart]);
    vi.spyOn(duckDBService, 'query').mockResolvedValue(mockData as any);

    render(
      <VisualizationWorkbench
        tables={['demo_sales']}
        currentTable="demo_sales"
      />
    );

    // Verify chart card is rendered
    expect(await screen.findByText('各区域GMV对比')).toBeTruthy();

    // Filter by search query that doesn't match
    const searchInput = screen.getByPlaceholderText('搜索图表名称、指标或 SQL...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent_keyword' } });

    // Empty state for no match
    expect(screen.getByText('未找到匹配的图表')).toBeTruthy();

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByText('各区域GMV对比')).toBeTruthy();
  });
});
