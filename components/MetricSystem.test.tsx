import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
vi.mock('../services/duckdbService', () => ({ duckDBService: { getTableSchema: vi.fn(async () => [
  { name: 'customer', type: 'VARCHAR' }, { name: 'occurred_at', type: 'TIMESTAMP' }, { name: 'kind', type: 'VARCHAR' },
  { name: 'amount', type: 'DOUBLE' },
]) } }));
vi.mock('../services/metricAnalyzer', () => ({ metricAnalyzer: { validateMetric: vi.fn() } }));
import { MetricTemplateModal } from './MetricTemplateModal';
import { MetricRecipeBuilder } from './MetricRecipeBuilder';
import { MetricEditModal } from './MetricEditModal';
import { METRIC_TEMPLATES } from '../data/metricSystem';
import { metricAnalyzer } from '../services/metricAnalyzer';
afterEach(cleanup);
describe('professional metric authoring', () => {
  it('initializes the visible quantile and ratio defaults when changing calculation type', async () => {
    render(<MetricEditModal isOpen metric={{ ...METRIC_TEMPLATES[0], id: 'm', createdAt: 1, sourceTable: 'live_events' }} onClose={vi.fn()} onSave={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('聚合方式'), { target: { value: 'QUANTILE' } });
    await waitFor(() => expect(screen.getByRole('option', { name: 'amount (DOUBLE)' })).toBeTruthy());
    fireEvent.change(screen.getByLabelText('计算字段'), { target: { value: 'amount' } });
    expect((screen.getByLabelText('计算公式') as HTMLTextAreaElement).value).toContain('quantile_cont("amount", 0.95)');
    fireEvent.change(screen.getByLabelText('聚合方式'), { target: { value: 'RATIO' } });
    expect((screen.getByLabelText('计算公式') as HTMLTextAreaElement).value).toContain('(COUNT(*)) * 1.0 / NULLIF((COUNT(*)), 0)');
  });
  it('provides orthogonal knowledge and business indexes with source references', () => {
    render(<MetricTemplateModal isOpen onClose={vi.fn()} onSelectTemplate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '专业方法与口径' }));
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(9);
    expect(screen.getByRole('link', { name: 'Kimball 可加性与比率重聚合' }).getAttribute('href')).toContain('kimballgroup.com');
    fireEvent.click(screen.getByRole('button', { name: '业务口径索引' }));
    expect(screen.getAllByRole('article')).toHaveLength(24);
  });
  it('binds actual schema roles and creates a draft with no synthetic result', async () => {
    const configure = vi.fn();
    render(<MetricRecipeBuilder tables={['live_events']} onConfigure={configure} />);
    fireEvent.change(screen.getByLabelText('方法来源表'), { target: { value: 'live_events' } });
    await waitFor(() => expect(screen.getAllByRole('option', { name: 'occurred_at (TIMESTAMP)' }).length).toBeGreaterThan(0));
    for (const [label, value] of [['主体标识', 'customer'], ['业务时间', 'occurred_at'], ['事件名称', 'kind'], ['起始事件取值', 'signup'], ['完成事件取值', 'visit'], ['观察截止日期', '2025-01-05']]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: '生成 SQL 并核对口径' }));
    expect(configure).toHaveBeenCalledWith(expect.objectContaining({ sourceTable: 'live_events', governance: expect.objectContaining({ reviewStatus: 'draft' }) }));
    expect(configure.mock.calls[0][0].formula).toContain('"occurred_at"');
    expect(configure.mock.calls[0][0].validationResult).toBeUndefined();
  });
  it('keeps missing bindings visible and never creates an incomplete recipe', () => {
    const configure = vi.fn();
    render(<MetricRecipeBuilder tables={[]} onConfigure={configure} />);
    fireEvent.click(screen.getByRole('button', { name: '生成 SQL 并核对口径' }));
    expect(screen.getByRole('alert').textContent).toContain('真实来源表');
    expect(configure).not.toHaveBeenCalled();
  });
  it('allows SQL authoring without requiring a source for an incomplete field builder', () => {
    render(<MetricEditModal isOpen metric={{ ...METRIC_TEMPLATES[0], id: 'm', createdAt: 1 }} onClose={vi.fn()} onSave={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('定义方式'), { target: { value: 'sql' } });
    expect((screen.getByLabelText('定义方式') as HTMLSelectElement).value).toBe('sql');
    expect((screen.getByLabelText('计算公式') as HTMLTextAreaElement).readOnly).toBe(false);
  });
  it('preserves generated SQL when switching from the field builder to SQL', async () => {
    render(<MetricEditModal isOpen metric={{ ...METRIC_TEMPLATES[0], id: 'm', createdAt: 1, sourceTable: 'live_events' }} onClose={vi.fn()} onSave={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('定义方式'), { target: { value: 'sql' } });
    expect((screen.getByLabelText('计算公式') as HTMLTextAreaElement).value).toContain('COUNT(*) AS value FROM "live_events"');
  });
  it('does not allow an incomplete contract to be labelled business reviewed', () => {
    render(<MetricEditModal isOpen metric={{ ...METRIC_TEMPLATES[0], id: 'm', createdAt: 1, sourceTable: 'live_events', governance: { reviewStatus: 'reviewed' } }} onClose={vi.fn()} onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '验证计算' }));
    expect(screen.getByRole('alert').textContent).toContain('业务复核前请补齐');
    expect(metricAnalyzer.validateMetric).not.toHaveBeenCalled();
  });
});
