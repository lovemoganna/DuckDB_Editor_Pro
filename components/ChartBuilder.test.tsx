// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({packages: vi.fn(), compile: vi.fn(), query: vi.fn()}));
vi.mock('../services/metricAnalyzer', () => ({metricAnalyzer: {loadMetricPackages: mocks.packages, generateValidationSql: mocks.compile}}));
vi.mock('../services/analysis/readQuery', () => ({executeAnalysisQuery: mocks.query}));
vi.mock('./charts/ChartRenderer', () => ({ChartRenderer: () => <div>预览</div>}));
import { ChartBuilder } from './ChartBuilder';
afterEach(() => {cleanup(); vi.clearAllMocks();});

describe('chart builder workflow', () => {
  it('compiles the selected metric against its own source and selects a real numeric measure', async () => {
    const metric = {id: 'm', name: '金额', sourceTable: 'finance.payments', formula: 'SUM(amount)'};
    mocks.packages.mockReturnValue([{id: 'p', name: '业务', sourceTables: ['sales.orders','finance.payments'], metrics: [metric]}]);
    mocks.compile.mockResolvedValue('SELECT channel, status, amount FROM finance.payments');
    mocks.query.mockResolvedValue([{channel: 'wire', status: 'completed', amount: 120}]);
    const save = vi.fn();
    render(<ChartBuilder columns={['manual','value']} data={[{manual:'a',value:4}]} onSave={save} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('图表标题'), {target: {value: '手动草稿'}});
    fireEvent.click(screen.getByText('从指标创建'));
    fireEvent.change(screen.getByLabelText('选择指标包'), {target: {value: 'p'}});
    fireEvent.change(screen.getByLabelText('选择指标'), {target: {value: 'm'}});
    await waitFor(() => expect(mocks.compile).toHaveBeenCalledWith(metric, 'finance.payments'));
    await waitFor(() => expect(screen.getByTitle('保存并加入看板')).not.toBeDisabled());
    fireEvent.click(screen.getByTitle('保存并加入看板'));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({type: 'kpi', yKeys: ['amount']}), {sql: 'SELECT channel, status, amount FROM finance.payments', sourceTable: 'finance.payments'});
    fireEvent.click(screen.getByText('手动创建'));
    expect(screen.getByLabelText('图表标题')).toHaveValue('手动草稿');
  });

  it('renders display settings as keyboard accessible native checkboxes and blocks invalid numeric bindings', async () => {
    mocks.packages.mockReturnValue([]);
    render(<ChartBuilder columns={['label','amount']} data={[{label:'north',amount:12}]} onSave={vi.fn()} onCancel={vi.fn()} />);
    const legend = screen.getByRole('checkbox', {name: '显示图例'});
    expect(legend).toHaveProperty('type', 'checkbox');
    fireEvent.click(legend);
    expect(legend).not.toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', {name: '左轴字段 label', exact:true}));
    await waitFor(() => expect(screen.getByTitle('保存并加入看板')).toBeDisabled());
  });
});
