// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MetricCard } from './MetricCard';
import { MetricTemplateModal, METRIC_TEMPLATES } from './MetricTemplateModal';
import { MetricEditModal } from './MetricEditModal';
import { MetricDataSourceModal } from './MetricDataSourceModal';
import { MetricCreatePackageModal } from './MetricCreatePackageModal';
import { MetricDefinition } from '../types';
import { metricAnalyzer } from '../services/metricAnalyzer';

afterEach(cleanup);

const mockMetric: MetricDefinition = {
  id: 'metric_test_1',
  name: 'test_gmv',
  scenario: '电商销售额统计',
  characteristics: '累加型',
  value: '衡量业务规模',
  definition: '订单实付金额总和',
  formula: 'SUM(order_amount)',
  example: '单日 GMV 为 100 万元',
  dependencies: ['order_amount'],
  unit: '元',
  category: '营收类',
  isValid: true,
  createdAt: Date.now(),
};

describe('MetricCard and MetricTemplateModal UI', () => {
  it('keeps technically valid diagnostics separate from business value and shows missing draft fields', () => {
    render(<MetricCard metric={{...mockMetric,name:'记录数',formula:'COUNT(*)',sourceTable:'payments',scenario:'',value:'',governance:{role:'diagnostic',reviewStatus:'draft'}}} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('基础诊断候选')).toBeTruthy();
    expect(screen.getByText(/候选草稿待补齐/).textContent).toContain('决策价值');
    expect(screen.queryByText('业务用途已复核')).toBeNull();
  });
  it('creates an unbound package without inventing a data table', () => {
    const onCreatePackage = vi.fn();
    render(<MetricCreatePackageModal isOpen onClose={vi.fn()} onCreatePackage={onCreatePackage} availableTables={[]} />);
    fireEvent.change(screen.getByPlaceholderText(/例如: 电商零售核心指标包/), { target: { value: '独立 SQL 指标包' } });
    fireEvent.click(screen.getByRole('button', { name: '创建指标包' }));
    expect(onCreatePackage).toHaveBeenCalledWith(expect.objectContaining({ sourceTables: [] }));
  });
  it('shows zero as a verified result without requiring expansion', () => {
    render(<MetricCard metric={{ ...mockMetric, validationResult: [{ value: 0 }], lastValidated: 1000 }} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('最近验证结果')).toBeTruthy();
    expect(screen.getByText('0')).toBeTruthy();
  });
  it('shows a failure immediately and hides previously cached values', () => {
    render(<MetricCard metric={{ ...mockMetric, isValid: false, validationResult: [{ value: 999 }], validationError: '字段已删除' }} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByRole('alert').textContent).toContain('字段已删除');
    expect(screen.queryByText('999')).toBeNull();
  });
  it('distinguishes a NULL aggregate from an empty query result', () => {
    const view = render(<MetricCard metric={{ ...mockMetric, validationResult: [{ value: null }] }} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('NULL')).toBeTruthy();
    view.rerender(<MetricCard metric={{ ...mockMetric, validationResult: [] }} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('查询未返回数据')).toBeTruthy();
  });
  it('renders metric card with proper badges and triggers actions', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const onValidate = vi.fn();
    const onToggleFavorite = vi.fn();

    render(
      <MetricCard
        metric={mockMetric}
        onEdit={onEdit}
        onDelete={onDelete}
        onValidate={onValidate}
        onToggleFavorite={onToggleFavorite}
        isFavorite={false}
        hasChart={true}
      />
    );

    // Verify name, category, and validation status
    expect(screen.getByText('test_gmv')).toBeTruthy();
    expect(screen.getByText('营收类')).toBeTruthy();
    expect(screen.getByText('已验证')).toBeTruthy();
    expect(screen.getByText('已生成图表')).toBeTruthy();

    // Verify formula code display
    expect(screen.getByText('SUM(order_amount)')).toBeTruthy();

    // Click edit button
    const editBtn = screen.getByRole('button', { name: '编辑指标定义' });
    fireEvent.click(editBtn);
    expect(onEdit).toHaveBeenCalledWith(mockMetric);

    // Click delete button
    const deleteBtn = screen.getByRole('button', { name: '删除指标' });
    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith('metric_test_1');
  });

  it('triggers onExecuteInEditor when Run in Editor button is clicked', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const onExecuteInEditor = vi.fn();

    render(
      <MetricCard
        metric={mockMetric}
        onEdit={onEdit}
        onDelete={onDelete}
        onExecuteInEditor={onExecuteInEditor}
      />
    );

    const runBtn = screen.getByRole('button', { name: '在 SQL 编辑器中运行' });
    fireEvent.click(runBtn);
    expect(onExecuteInEditor).toHaveBeenCalledWith(mockMetric);
  });

  it('renders template modal and allows template selection', () => {
    const onClose = vi.fn();
    const onSelectTemplate = vi.fn();

    render(
      <MetricTemplateModal
        isOpen={true}
        onClose={onClose}
        onSelectTemplate={onSelectTemplate}
      />
    );

    // Verify title and template count
    expect(screen.getByText('标准语义指标模板库')).toBeTruthy();
    expect(screen.getByText('total_count')).toBeTruthy();

    // Click first template card
    const firstCard = screen.getByText('total_count').closest('.group');
    expect(firstCard).toBeTruthy();
    if (firstCard) {
      fireEvent.click(firstCard);
      expect(onSelectTemplate).toHaveBeenCalled();
    }
  });

  it('requires current execution before saving and invalidates it when fields change', async () => {
    const onClose = vi.fn();
    const onSave = vi.fn();

    render(
      <MetricEditModal
        isOpen={true}
        metric={mockMetric}
        onClose={onClose}
        onSave={onSave}
      />
    );

    expect(screen.getByText('编辑指标语义定义')).toBeTruthy();
    expect(screen.getByDisplayValue('test_gmv')).toBeTruthy();

    const saveBtn = screen.getByRole('button', { name: '保存指标定义' });
    fireEvent.click(saveBtn);
    expect(onSave).not.toHaveBeenCalled();
    const validation = vi.spyOn(metricAnalyzer, 'validateMetric').mockResolvedValue({isValid:true,result:[{value:42}],sql:'SELECT SUM(order_amount) AS value FROM orders',database:'memory'});
    fireEvent.click(screen.getByRole('button', {name:'验证计算'}));
    await waitFor(() => expect((saveBtn as HTMLButtonElement).disabled).toBe(false));
    fireEvent.change(screen.getByLabelText('计算公式'), {target:{value:'SUM(missing)'}});
    expect((saveBtn as HTMLButtonElement).disabled).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
    validation.mockRestore();
  });

  it('triggers onShowLineage when lineage button in expanded area is clicked', () => {
    const onShowLineage = vi.fn();

    render(
      <MetricCard
        metric={mockMetric}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onShowLineage={onShowLineage}
      />
    );

    // Expand the card
    const expandBtn = screen.getByRole('button', { name: /展开完整参数/i });
    fireEvent.click(expandBtn);

    // Find and click the lineage button
    const lineageBtn = screen.getByRole('button', { name: /查看血缘/i });
    expect(lineageBtn).toBeTruthy();
    fireEvent.click(lineageBtn);

    expect(onShowLineage).toHaveBeenCalledWith(mockMetric);
  });

  it('renders MetricDataSourceModal and dispatches sql event on run in editor', () => {
    const onClose = vi.fn();
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    render(
      <MetricDataSourceModal
        isOpen={true}
        onClose={onClose}
      />
    );

    expect(screen.getByText('连接外部数据源')).toBeTruthy();
    expect(screen.getByText('CSV / TSV 文件')).toBeTruthy();

    const nameInput = screen.getByPlaceholderText('例如: raw_orders, user_events');
    const pathInput = screen.getByPlaceholderText('https://example.com/data.parquet 或 ./data.csv');

    fireEvent.change(nameInput, { target: { value: 'test_orders' } });
    fireEvent.change(pathInput, { target: { value: 'https://example.com/orders.csv' } });

    const runBtn = screen.getByRole('button', { name: '在 SQL 编辑器中运行' });
    fireEvent.click(runBtn);

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'duckdb_execute_sql',
      })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('renders MetricCreatePackageModal, enforces validation, and creates package with starter templates', () => {
    const onClose = vi.fn();
    const onCreatePackage = vi.fn();

    render(
      <MetricCreatePackageModal
        isOpen={true}
        onClose={onClose}
        onCreatePackage={onCreatePackage}
        availableTables={['orders', 'customers']}
        existingPackageNames={['已有指标包']}
      />
    );

    expect(screen.getByText('手动新建指标包')).toBeTruthy();
    expect(screen.getByText('orders')).toBeTruthy();
    expect(screen.getByText('customers')).toBeTruthy();

    const submitBtn = screen.getByRole('button', { name: '创建指标包' });

    // 1. Submit empty name -> error
    fireEvent.click(submitBtn);
    expect(screen.getByText('请输入指标包名称')).toBeTruthy();
    expect(onCreatePackage).not.toHaveBeenCalled();

    // 2. Submit duplicate name -> error
    const nameInput = screen.getByPlaceholderText(/例如: 电商零售核心指标包/);
    fireEvent.change(nameInput, { target: { value: '已有指标包' } });
    fireEvent.click(submitBtn);
    expect(screen.getByText(/已存在同名指标包/)).toBeTruthy();
    expect(onCreatePackage).not.toHaveBeenCalled();

    // 3. Valid submission with starter templates
    fireEvent.change(nameInput, { target: { value: '财务核心指标包' } });
    const templateCheckbox = screen.getByRole('checkbox');
    fireEvent.click(templateCheckbox);

    fireEvent.click(submitBtn);

    expect(onCreatePackage).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '财务核心指标包',
        sourceTables: expect.arrayContaining(['orders']),
        metrics: expect.arrayContaining([
          expect.objectContaining({ name: 'total_count' }),
        ]),
      })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps the metric catalog empty instead of creating stock business data', async () => {
    const { metricAnalyzer } = await import('../services/metricAnalyzer');
    localStorage.removeItem('duckdb_metric_packages');
    localStorage.removeItem('duckdb_metric_charts');
    expect(metricAnalyzer.loadMetricPackages()).toEqual([]);
    expect(metricAnalyzer.loadMetricCharts()).toEqual([]);
    expect(localStorage.getItem('duckdb_metric_packages')).toBeNull();
  });
});
