// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MetricCard } from './MetricCard';
import { MetricTemplateModal, METRIC_TEMPLATES } from './MetricTemplateModal';
import { MetricDefinition } from '../types';

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
});
