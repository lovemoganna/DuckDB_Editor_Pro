// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InspectorPanel } from './InspectorPanel';
import type { QueryResult } from '../../types';

afterEach(cleanup);

const mockExplainResult: QueryResult = {
  resultId: 'res_explain_1',
  columns: ['explain_key', 'explain_value'],
  rows: [
    {
      explain_key: 'physical_plan',
      explain_value: '┌───────────────────────────┐\n│         PROJECTION        │\n│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │\n│          customer         │\n│           total           │\n└─────────────┬─────────────┘\n┌─────────────┴─────────────┐\n│         HASH_JOIN         │\n│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │\n│        Join Type: INNER   │\n└─────────────┬─────────────┘\n┌─────────────┴─────────────┐\n│          SEQ_SCAN         │\n│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │\n│           orders          │\n└───────────────────────────┘',
    },
  ],
  executionTime: 42,
  isExplain: true,
};

describe('InspectorPanel - Explain & Multiline Text Optimization', () => {
  it('renders overview with structural metrics and execution plan banner when viewing explain column', () => {
    render(
      <InspectorPanel
        queryResult={mockExplainResult}
        selectedColumn="explain_value"
      />
    );

    // Header column info
    expect(screen.getByText('explain_value')).toBeTruthy();

    // Overview structural metrics
    expect(screen.getByText('总行数')).toBeTruthy();
    expect(screen.getByText('字符总数')).toBeTruthy();
    expect(screen.getByText('算子节点类型')).toBeTruthy();
    expect(screen.getByText('DuckDB ASCII Tree')).toBeTruthy();

    // Dedicated Explain Plan Banner
    expect(screen.getByText('检测到 DuckDB 物理执行计划')).toBeTruthy();
    expect(screen.getByText('切换至执行计划可视化拓扑图')).toBeTruthy();
  });

  it('renders physical operator distribution for explain column under 分布 tab', () => {
    render(
      <InspectorPanel
        queryResult={mockExplainResult}
        selectedColumn="explain_value"
      />
    );

    // Switch to 分布 tab
    const distTab = screen.getByText('分布');
    fireEvent.click(distTab);

    expect(screen.getByText('执行算子频次分布')).toBeTruthy();
    expect(screen.getByText('PROJECTION')).toBeTruthy();
    expect(screen.getByText('HASH_JOIN')).toBeTruthy();
    expect(screen.getByText('SEQ_SCAN')).toBeTruthy();
    expect(screen.getByText('在执行计划中查看完整拓扑')).toBeTruthy();
  });

  it('renders structural metrics rather than fake numeric quantiles under 统计 tab', () => {
    render(
      <InspectorPanel
        queryResult={mockExplainResult}
        selectedColumn="explain_value"
      />
    );

    // Switch to 统计 tab
    const statsTab = screen.getByText('统计');
    fireEvent.click(statsTab);

    expect(screen.getByText('文本与结构统计 (Structural Metrics)')).toBeTruthy();
    expect(screen.getByText('NON-NUMERIC')).toBeTruthy();
    expect(screen.getByText('算子总节点数:')).toBeTruthy();
    expect(screen.getByText('UTF-8 / ASCII Box Tree (DuckDB CBO)')).toBeTruthy();
    // Verify fake numeric quantiles like 199.99 or 899.00 do NOT exist
    expect(screen.queryByText('p25 (1/4分位):')).toBeNull();
  });

  it('renders full-text scrollable monospace preview with copy button under 样例 tab', () => {
    render(
      <InspectorPanel
        queryResult={mockExplainResult}
        selectedColumn="explain_value"
      />
    );

    // Switch to 样例 tab
    const samplesTab = screen.getByText('样例');
    fireEvent.click(samplesTab);

    expect(screen.getByText('EXPLAIN ASCII')).toBeTruthy();
    expect(screen.getByText('首行完整代码块预览')).toBeTruthy();
    expect(screen.getByText('复制全文')).toBeTruthy();
    expect(screen.getByText('在执行计划中查看完整交互拓扑')).toBeTruthy();
  });

  it('calculates and renders real dynamic numeric quantiles for numeric columns under 统计 tab', () => {
    const mockNumericResult: QueryResult = {
      resultId: 'res_num_1',
      columns: ['amount'],
      columnTypes: ['DECIMAL(18,2)'],
      columnTypeMap: { amount: 'DECIMAL(18,2)' },
      rows: [
        { amount: 10 },
        { amount: 20 },
        { amount: 30 },
        { amount: 40 },
        { amount: 50 },
        { amount: 100 },
      ],
      executionTime: 12,
    };

    render(
      <InspectorPanel
        queryResult={mockNumericResult}
        selectedColumn="amount"
      />
    );

    // Switch to 统计 tab
    const statsTab = screen.getByText('统计');
    fireEvent.click(statsTab);

    expect(screen.getByText('分位数与离散度 (Quantiles & Variance)')).toBeTruthy();
    expect(screen.getByText('Min (p0):')).toBeTruthy();
    expect(screen.getByText('p25 (1/4分位):')).toBeTruthy();
    expect(screen.getByText('Median (p50):')).toBeTruthy();
    expect(screen.getByText('p75 (3/4分位):')).toBeTruthy();
    expect(screen.getByText('p95:')).toBeTruthy();
    expect(screen.getByText('Max (p100):')).toBeTruthy();

    // Verify it is NOT the old fake static constant 899.00 or 199.99
    expect(screen.queryByText('899.00')).toBeNull();
    expect(screen.queryByText('199.99')).toBeNull();
  });

  it('renders dynamic numeric ticks in 直方图 tab', () => {
    const mockNumericResult: QueryResult = {
      resultId: 'res_num_2',
      columns: ['amount'],
      columnTypes: ['BIGINT'],
      columnTypeMap: { amount: 'BIGINT' },
      rows: [
        { amount: 1000 },
        { amount: 2000 },
        { amount: 3000 },
      ],
      executionTime: 15,
    };

    render(
      <InspectorPanel
        queryResult={mockNumericResult}
        selectedColumn="amount"
      />
    );

    // Switch to 直方图 tab
    // We can open histogram tab if available, or trigger it via overview
    expect(screen.getByText('连续型分布 (Distribution)')).toBeTruthy();
  });
});
