// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResultSection } from './ResultSection';
import { QueryResult } from '../../types';

// Mock chartjs
vi.mock('react-chartjs-2', () => ({
  Bar: () => <div data-testid="mock-bar-chart" />,
  Line: () => <div data-testid="mock-line-chart" />,
}));

afterEach(cleanup);

const mockResult: QueryResult = {
  resultId: 'res_test_1',
  columns: ['order_id', 'order_date', 'customer_id', 'region', 'category', 'amount', 'status'],
  rows: [
    { order_id: 8761234, order_date: '2024-12-31', customer_id: 98765, region: 'Europe', category: 'Home', amount: 124.50, status: 'completed' },
    { order_id: 8761233, order_date: '2024-12-31', customer_id: 23456, region: 'Asia Pacific', category: 'Clothing', amount: 89.90, status: 'completed' },
  ],
  executionTime: 520,
};

describe('ResultSection (BRD index8.md & Target Mockup Flow)', () => {
  it('renders Result Section with subtabs, status line, and toolbar', () => {
    render(
      <ResultSection
        result={mockResult}
        loading={false}
        activeTabSql="SELECT * FROM orders;"
        activeTabTitle="customer_analysis.sql"
      />
    );

    // Subtabs
    expect(screen.getAllByText('数据').length).toBeGreaterThan(0);
    expect(screen.getAllByText('图表').length).toBeGreaterThan(0);
    expect(screen.getAllByText('AI 分析').length).toBeGreaterThan(0);
    expect(screen.getAllByText('执行计划').length).toBeGreaterThan(0);

    // Status line
    expect(screen.getByText('执行成功')).toBeTruthy();
    expect(screen.getByTestId('metric-rows').textContent).toBe('2');
    expect(screen.getAllByText('导出').length).toBeGreaterThan(0);

    // Toolbar buttons
    expect(screen.getByText('筛选')).toBeTruthy();
    expect(screen.getByText('排序')).toBeTruthy();
    expect(screen.getByText('分组')).toBeTruthy();
    expect(screen.getByText('透视')).toBeTruthy();

    // Table headers
    expect(screen.getByText('order_id')).toBeTruthy();
    expect(screen.getByText('amount')).toBeTruthy();
    expect(screen.getByText('region')).toBeTruthy();
  });

  it('opens Filter Modal (结果分析 → 生成 SQL) and generates derived SQL', () => {
    const onApplyAggregateToSql = vi.fn();

    render(
      <ResultSection
        result={mockResult}
        loading={false}
        activeTabSql="SELECT * FROM orders;"
        activeTabTitle="customer_analysis.sql"
        onApplyAggregateToSql={onApplyAggregateToSql}
      />
    );

    // Open Filter modal
    fireEvent.click(screen.getByText('筛选'));

    expect(screen.getByText('条件筛选')).toBeTruthy();
    expect(screen.getByText('SQL 预览')).toBeTruthy();

    // Add a preset filter with a value
    fireEvent.click(screen.getByText('+ order_id'));
    const textboxes = screen.getAllByRole('textbox');
    fireEvent.change(textboxes[textboxes.length - 1], { target: { value: '8761234' } });

    // Apply Filter
    fireEvent.click(screen.getByText('应用筛选'));

    expect(onApplyAggregateToSql).toHaveBeenCalled();
    const [sql] = onApplyAggregateToSql.mock.calls[0];
    expect(sql).toContain('SELECT *');
    expect(sql).toContain('FROM (');
    expect(sql).toContain('WHERE');
  });

  it('opens Group & Aggregate Modal and generates grouped SQL', () => {
    const onApplyAggregateToSql = vi.fn();

    render(
      <ResultSection
        result={mockResult}
        loading={false}
        activeTabSql="SELECT * FROM orders;"
        activeTabTitle="customer_analysis.sql"
        onApplyAggregateToSql={onApplyAggregateToSql}
      />
    );

    // Open Group & Aggregate modal
    fireEvent.click(screen.getByText('分组'));

    expect(screen.getByText(/分组聚合操作/)).toBeTruthy();
    expect(screen.getByText(/Group By 分组维度/)).toBeTruthy();
    expect(screen.getByText(/聚合指标/)).toBeTruthy();

    // Apply
    fireEvent.click(screen.getByText('应用'));

    expect(onApplyAggregateToSql).toHaveBeenCalled();
    const [sql] = onApplyAggregateToSql.mock.calls[0];
    expect(sql).toContain('GROUP BY');
    expect(sql).toContain('SUM(amount)');
  });

  it('switches to Explain Analyze subtab and displays empty state when no explain plan exists', () => {
    render(
      <ResultSection
        result={mockResult}
        loading={false}
      />
    );

    // Switch to Explain tab
    fireEvent.click(screen.getByText('执行计划'));

    expect(screen.getByText('图形')).toBeTruthy();
    expect(screen.getByText('暂无物理执行计划')).toBeTruthy();
  });

  it('switches to Explain Analyze subtab and displays graphical plan tree when plan is available', () => {
    const explainResult: QueryResult = {
      resultId: 'res_explain_1',
      columns: ['explain_key', 'explain_value'],
      rows: [
        { explain_key: 'physical_plan', explain_value: 'PROJECTION [id, name]\nHASH_JOIN (INNER)\nSEQ_SCAN users' },
      ],
      executionTime: 15,
      isExplain: true,
    };

    render(
      <ResultSection
        result={explainResult}
        loading={false}
      />
    );

    fireEvent.click(screen.getByText('执行计划'));

    expect(screen.getByText('图形')).toBeTruthy();
    expect(screen.getAllByText('PROJECTION').length).toBeGreaterThan(0);
    expect(screen.getAllByText('HASH_JOIN').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/SEQ_SCAN/).length).toBeGreaterThan(0);
  });

  it('renders 0 rows without bulky empty state when query returns empty rows', () => {
    const emptyResult: QueryResult = {
      resultId: 'res_empty',
      columns: ['id', 'name'],
      rows: [],
      executionTime: 12,
    };

    render(
      <ResultSection
        result={emptyResult}
        loading={false}
        activeTabSql="SELECT * FROM users WHERE 1=0;"
      />
    );

    // Columns should still render in header
    expect(screen.getByText('id')).toBeTruthy();
    expect(screen.getByText('name')).toBeTruthy();

    // Metric row count
    expect(screen.getByTestId('metric-rows').textContent).toBe('0');
    expect(screen.getByTestId('metric-time').textContent).toBe('12');

    // Bulky empty state and shortcuts must NOT be rendered
    expect(screen.queryByText('查询结果集为空')).toBeNull();
    expect(screen.queryByText('0 行数据')).toBeNull();
    expect(screen.queryByText('打开命令面板')).toBeNull();
  });

  it('supports multi-page pagination and page size switching', () => {
    const manyRows = Array.from({ length: 150 }, (_, i) => ({
      order_id: i + 1,
      order_date: '2024-12-31',
      customer_id: 1000 + i,
      region: 'Europe',
      category: 'Electronics',
      amount: 100 + i,
      status: 'completed',
    }));

    const paginatedResult: QueryResult = {
      resultId: 'res_pages',
      columns: ['order_id', 'order_date', 'customer_id', 'region', 'category', 'amount', 'status'],
      rows: manyRows,
      executionTime: 45,
    };

    render(
      <ResultSection
        result={paginatedResult}
        loading={false}
      />
    );

    // Default pageSize is 100, so 150 items -> 2 pages
    expect(screen.getByText('第 1 页, 共 2 页')).toBeTruthy();
    expect(screen.getByText('1-100 / 150 行')).toBeTruthy();

    // Click Next page
    const nextBtn = screen.getByTitle('下一页');
    fireEvent.click(nextBtn);

    expect(screen.getByText('第 2 页, 共 2 页')).toBeTruthy();
    expect(screen.getByText('101-150 / 150 行')).toBeTruthy();

    // Switch pageSize to 50
    const pageSizeSelect = screen.getByDisplayValue('100 行');
    fireEvent.change(pageSizeSelect, { target: { value: '50' } });

    expect(screen.getByText('第 1 页, 共 3 页')).toBeTruthy();
    expect(screen.getByText('1-50 / 150 行')).toBeTruthy();
  });

  it('toggles true fullscreen view and handles Escape key', () => {
    render(
      <ResultSection
        result={mockResult}
        loading={false}
      />
    );

    const fullscreenBtn = screen.getByTitle('全屏浏览结果集');
    fireEvent.click(fullscreenBtn);

    expect(screen.getByTitle('退出全屏 (ESC)')).toBeTruthy();

    // Press Escape to exit
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByTitle('全屏浏览结果集')).toBeTruthy();
  });

  it('renders rich cells for JSON and multiline data with expand buttons', () => {
    const jsonAndMultilineResult: QueryResult = {
      resultId: 'res_rich_cells',
      columns: ['id', 'meta_json', 'log_text'],
      rows: [
        {
          id: 1,
          meta_json: '{"user_id": 987, "roles": ["admin", "editor"]}',
          log_text: 'Line 1: Worker initialized\nLine 2: Ready for tasks\nLine 3: Finished successfully',
        },
      ],
      executionTime: 20,
    };

    render(
      <ResultSection
        result={jsonAndMultilineResult}
        loading={false}
      />
    );

    // Badges
    expect(screen.getByText('[JSON]')).toBeTruthy();
    expect(screen.getByText('[多行文本]')).toBeTruthy();
    expect(screen.getByText('(3 行)')).toBeTruthy();

    // Click expand for JSON
    const expandButtons = screen.getAllByText('展开');
    expect(expandButtons.length).toBeGreaterThan(0);
    fireEvent.click(expandButtons[0]);

    // Expect formatted JSON or multiline block
    expect(screen.getByText('收起')).toBeTruthy();
  });

  it('renders content-aware column widths with colgroup and toggles layout mode', () => {
    render(
      <ResultSection
        result={mockResult}
        loading={false}
        activeTabSql="SELECT * FROM orders;"
        activeTabTitle="customer_analysis.sql"
      />
    );

    // Header has colgroup for sizing
    const table = screen.getByRole('table');
    expect(table).toBeTruthy();
    const colgroup = table.querySelector('colgroup');
    expect(colgroup).toBeTruthy();
    expect(colgroup?.querySelectorAll('col').length).toBe(mockResult.columns.length + 1);

    // Toggle button exists
    const toggleBtn = screen.getByTitle(/当前: 智能紧凑自适应/);
    expect(toggleBtn).toBeTruthy();
    expect(screen.getByText('紧凑自适应')).toBeTruthy();

    // Click toggle to switch to Fill mode
    fireEvent.click(toggleBtn);
    expect(screen.getByText('铺满全宽')).toBeTruthy();
  });
});


