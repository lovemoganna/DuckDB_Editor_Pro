import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MetricPackage, MetricDefinition } from '../types';

const state = vi.hoisted(() => ({ packages: [] as MetricPackage[], validate: vi.fn(), generateChart: vi.fn() }));
vi.mock('../services/metricAnalyzer', () => ({ metricAnalyzer: {
  loadMetricPackages: () => state.packages,
  saveAllPackages: (packages: MetricPackage[]) => { state.packages = packages; },
  getChartsByPackage: () => [],
  validateMetric: (...args: unknown[]) => state.validate(...args),
  generateChart: (...args: unknown[]) => state.generateChart(...args),
  updateMetricPackage: (id: string, changes: Partial<MetricPackage>) => {
    state.packages = state.packages.map(pkg => pkg.id === id ? { ...pkg, ...changes } : pkg);
    window.dispatchEvent(new Event('duckdb-metrics-updated'));
    return state.packages.find(pkg => pkg.id === id);
  },
} }));
vi.mock('../services/aiService', () => ({ aiService: {} }));
vi.mock('../services/metricAssetStorage', () => ({ activeAnalysisDatabase: () => 'memory' }));
vi.mock('../services/analyticalCatalogService', () => ({ buildAnalyticalCatalog: vi.fn() }));
vi.mock('./MetricChartListModal', () => ({ MetricChartListModal: () => null }));
vi.mock('./MetricTemplateModal', () => ({ MetricTemplateModal: ({ isOpen, onSelectTemplate }: any) => isOpen ? <button onClick={() => onSelectTemplate({ name: 'draft_count', formula: '', dependencies: [], calculation: { aggregation: 'COUNT' }, sourceTable: 'orders' })}>选择计算草稿</button> : null }));
vi.mock('./MetricDataSourceModal', () => ({ MetricDataSourceModal: () => null }));
vi.mock('./MetricEditModal', () => ({ MetricEditModal: ({ isOpen, metric, onClose }: any) => isOpen ? <div role="dialog"><span>{metric.name}</span><span>{metric.sourceTable}</span><button onClick={onClose}>取消草稿</button></div> : null }));
vi.mock('./MetricCreatePackageModal', () => ({ MetricCreatePackageModal: () => null }));
vi.mock('./ui/LineageGraphView', () => ({ LineageGraphView: () => null }));
import { MetricManager } from './MetricManager';

const metric = (id: string, category: string): MetricDefinition => ({ id, name: id, category,
  formula: 'COUNT(*)', sourceTable: 'orders', scenario: '', characteristics: '', value: '',
  definition: '', example: '', dependencies: [], createdAt: 1 });
beforeEach(() => {
  localStorage.clear();
  state.validate.mockReset();
  state.generateChart.mockReset();
  state.packages = [
    { id: 'a', name: '订单指标', description: '', sourceTables: ['orders'], metrics: [metric('订单量', '交易'), metric('客户数', '客户')], createdAt: 1, updatedAt: 1 },
    { id: 'b', name: '库存指标', description: '', sourceTables: ['orders'], metrics: [metric('库存量', '库存')], createdAt: 1, updatedAt: 1 },
  ];
});
afterEach(cleanup);
describe('MetricManager workflow regressions', () => {
  it('keeps the explicit recipe source in a package with multiple tables', () => {
    state.packages[0].sourceTables = ['orders', 'customers'];
    render(<MetricManager tables={['orders', 'customers']} />);
    fireEvent.click(screen.getByText('订单指标'));
    fireEvent.click(screen.getByRole('button', { name: '添加模版指标' }));
    fireEvent.click(screen.getByRole('button', { name: '选择计算草稿' }));
    expect(screen.getByRole('dialog').textContent).toContain('orders');
  });
  it('round trips an exported empty package', async () => {
    render(<MetricManager tables={['orders']} />);
    const file = new File([JSON.stringify({ name: '空包备份', metrics: [], sourceTables: ['orders'] })], 'empty.json');
    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [file] } });
    await waitFor(() => expect(state.packages).toHaveLength(3));
    expect(state.packages[2].metrics).toEqual([]);
    expect(screen.getByText('该指标包暂无指标定义')).toBeTruthy();
  });
  it('imports calculation and contract without inheriting approval or inventing a formula', async () => {
    render(<MetricManager tables={['orders']} />);
    const imported = { name: '外部口径', sourceTables: ['orders'], metrics: [{ ...metric('imported', '交易'), formula: '',
      calculation: { aggregation: 'RATIO', numerator: { aggregation: 'COUNT' }, denominator: { aggregation: 'COUNT' }, scale: 100 },
      governance: { owner: 'Analyst', reviewStatus: 'reviewed' }, isValid: true, sqlValidation: 'SELECT 99' }] };
    const file = new File([JSON.stringify(imported)], 'metrics.json', { type: 'application/json' });
    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [file] } });
    await waitFor(() => expect(state.packages).toHaveLength(3));
    expect(state.packages[2].metrics[0]).toMatchObject({ formula: '', sourceTable: 'orders', calculation: imported.metrics[0].calculation, governance: { owner: 'Analyst', reviewStatus: 'draft' } });
    expect(state.packages[2].metrics[0].isValid).toBeUndefined();
    expect(state.packages[2].metrics[0].sqlValidation).toBeUndefined();
  });
  it('configures a template as an unsaved draft and cancels without modifying the package', () => {
    render(<MetricManager tables={['orders']} />);
    fireEvent.click(screen.getByText('订单指标'));
    fireEvent.click(screen.getByRole('button', { name: '添加模版指标' }));
    fireEvent.click(screen.getByRole('button', { name: '选择计算草稿' }));
    expect(screen.getByRole('dialog').textContent).toContain('draft_count');
    expect(screen.getByRole('dialog').textContent).toContain('orders');
    expect(state.packages[0].metrics).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '取消草稿' }));
    expect(state.packages[0].metrics).toHaveLength(2);
  });
  it('stays in metrics after generating a saved chart until the user chooses to open it', async () => {
    state.generateChart.mockResolvedValue({ chartConfig: { type: 'counter' } });
    const onChartGenerated = vi.fn();
    render(<MetricManager tables={['orders']} onChartGenerated={onChartGenerated} />);
    fireEvent.click(screen.getByText('订单指标'));
    fireEvent.click(screen.getAllByRole('button', { name: '生成图表', exact: true })[0]);
    await waitFor(() => expect(state.generateChart).toHaveBeenCalled());
    expect(onChartGenerated).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '返回指标包列表' })).toBeTruthy();
  });
  it('clears package-specific filters when opening another package', () => {
    render(<MetricManager tables={['orders']} />);
    fireEvent.click(screen.getByText('订单指标'));
    fireEvent.click(screen.getAllByRole('button', { name: '交易' })[0]);
    fireEvent.click(screen.getByRole('button', { name: '返回指标包列表' }));
    fireEvent.click(screen.getByText('库存指标'));
    expect(screen.getByText('库存量')).toBeTruthy();
  });
  it('preserves both results when two validations finish out of order', async () => {
    const pending: Array<(value: unknown) => void> = [];
    state.validate.mockImplementation(() => new Promise(resolve => pending.push(resolve)));
    render(<MetricManager tables={['orders']} />);
    fireEvent.click(screen.getByText('订单指标'));
    const buttons = screen.getAllByRole('button', { name: '验证 SQL 计算' });
    fireEvent.click(buttons[0]); fireEvent.click(buttons[1]);
    await act(async () => pending[1]({ isValid: true, sql: 'SELECT COUNT(*) FROM orders', database: 'memory', result: [{ value: 2 }] }));
    await act(async () => pending[0]({ isValid: true, sql: 'SELECT COUNT(*) FROM orders', database: 'memory', result: [{ value: 3 }] }));
    await waitFor(() => expect(state.packages[0].metrics.every(item => item.isValid)).toBe(true));
  });
  it('validates each multi-table metric with its own source, without defaulting unresolved metrics to the first table', async () => {
    state.packages=[{...state.packages[0],sourceTables:['users','payments'],metrics:[{...metric('金额','交易'),sourceTable:'payments'},{...metric('未绑定','交易'),sourceTable:undefined}]}];
    state.validate.mockResolvedValue({isValid:false,error:'未绑定来源'});
    render(<MetricManager tables={['users','payments']} />);
    fireEvent.click(screen.getByText('订单指标'));
    fireEvent.click(screen.getByRole('button',{name:'验证全部',exact:true}));
    await waitFor(()=>expect(state.validate).toHaveBeenCalledTimes(2));
    expect(state.validate.mock.calls.map(call=>call[1])).toEqual(['payments','']);
  });
  it('does not reopen a package when validation finishes after navigating back', async () => {
    let finish!: (value: unknown) => void;
    state.validate.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    render(<MetricManager tables={['orders']} />);
    fireEvent.click(screen.getByText('订单指标'));
    fireEvent.click(screen.getAllByRole('button', { name: '验证 SQL 计算' })[0]);
    fireEvent.click(screen.getByRole('button', { name: '返回指标包列表' }));
    await act(async () => finish({ isValid: true, database: 'memory', result: [{ value: 3 }] }));
    expect(screen.queryByRole('button', { name: '返回指标包列表' })).toBeNull();
  });
  it('keeps a changed definition when an old validation finishes', async () => {
    let finish!: (value: unknown) => void;
    state.validate.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    render(<MetricManager tables={['orders']} />);
    fireEvent.click(screen.getByText('订单指标'));
    fireEvent.click(screen.getAllByRole('button', { name: '验证 SQL 计算' })[0]);
    state.packages = state.packages.map(pkg => pkg.id === 'a' ? { ...pkg, metrics: pkg.metrics.map(item => item.id === '订单量' ? { ...item, formula: 'SUM(amount)' } : item) } : pkg);
    await act(async () => finish({ isValid: true, database: 'memory', result: [{ value: 3 }] }));
    expect(state.packages[0].metrics[0].formula).toBe('SUM(amount)');
    expect(state.packages[0].metrics[0].isValid).toBeUndefined();
  });
  it('allows returning from a linked metric without update events reopening it', () => {
    render(<MetricManager tables={['orders']} currentMetricId="订单量" />);
    expect(screen.getByText('订单量')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '返回指标包列表' }));
    act(() => { state.packages = [...state.packages]; window.dispatchEvent(new Event('duckdb-metrics-updated')); });
    expect(screen.queryByRole('button', { name: '返回指标包列表' })).toBeNull();
  });
  it('explains empty filtered results and restores all metrics', () => {
    render(<MetricManager tables={['orders']} />);
    fireEvent.click(screen.getByText('订单指标'));
    fireEvent.change(screen.getByPlaceholderText('搜索指标名称、公式、业务定义...'), { target: { value: '不存在' } });
    expect(screen.getByText('没有匹配的指标')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '清除筛选' }));
    expect(screen.getByText('订单量')).toBeTruthy();
    expect(screen.getByText('客户数')).toBeTruthy();
  });
});
