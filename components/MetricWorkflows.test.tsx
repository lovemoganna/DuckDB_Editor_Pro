import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../services/duckdbService', () => ({ duckDBService: { getTableSchema: vi.fn(async () => [{ name: 'date', type: 'DATE' }, { name: 'amount', type: 'DOUBLE' }]) } }));
vi.mock('../services/metricAnalyzer', () => ({ metricAnalyzer: { validateMetric: vi.fn() } }));
import { MetricDataSourceModal } from './MetricDataSourceModal';
import { MetricEditModal } from './MetricEditModal';
import { metricAnalyzer } from '../services/metricAnalyzer';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('metric workflow boundaries', () => {
  it('quotes source identifiers and paths and keeps copy failure recoverable', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('permission denied')) } });
    render(<MetricDataSourceModal isOpen onClose={vi.fn()} />);
    expect((screen.getByRole('button', { name: '复制 SQL' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('数据源别名'), { target: { value: '订单 "清单"' } });
    fireEvent.change(screen.getByLabelText('文件路径或网络 URL'), { target: { value: "https://host/O'Brien.csv" } });
    expect(screen.getByLabelText('SQL 挂载命令预览').textContent).toContain('"订单 ""清单"""');
    expect(screen.getByLabelText('SQL 挂载命令预览').textContent).toContain("O''Brien.csv");
    fireEvent.click(screen.getByRole('button', { name: '复制 SQL' }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
  it('discards validation from a closed editor instead of unlocking a new metric', async () => {
    let finish!: (value: unknown) => void;
    vi.mocked(metricAnalyzer.validateMetric).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const metric = { id: 'first', name: 'first', formula: 'SELECT 1', scenario: '', characteristics: '', value: '', definition: '', example: '', dependencies: [], createdAt: 1 };
    const props = { isOpen: true, metric, onClose: vi.fn(), onSave: vi.fn() };
    const view = render(<MetricEditModal {...props} />);
    fireEvent.click(screen.getByRole('button', { name: '验证计算' }));
    expect((screen.getByLabelText('指标名称') as HTMLInputElement).matches(':disabled')).toBe(true);
    view.rerender(<MetricEditModal {...props} isOpen={false} />);
    view.rerender(<MetricEditModal {...props} metric={{ ...metric, id: 'second', name: 'second' }} />);
    await act(async () => finish({ isValid: true, database: 'memory', sql: 'SELECT 1', result: [{ value: 1 }] }));
    expect((screen.getByLabelText('指标名称') as HTMLInputElement).value).toBe('second');
    expect((screen.getByRole('button', { name: '保存指标定义' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText(/请核对业务口径和结果后保存/)).toBeNull();
  });
});
