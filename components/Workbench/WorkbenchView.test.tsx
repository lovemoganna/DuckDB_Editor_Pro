// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkbenchView } from './WorkbenchView';
import { useAppStore } from '../../hooks/store/useAppStore';

// Mock chartjs to avoid canvas errors in jsdom
vi.mock('react-chartjs-2', () => ({
  Bar: () => <div data-testid="mock-bar-chart" />,
  Line: () => <div data-testid="mock-line-chart" />,
  Scatter: () => <div data-testid="mock-scatter-chart" />,
}));

beforeEach(() => {
  useAppStore.getState().clearPending();
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
});

afterEach(cleanup);

describe('WorkbenchView BRD v1.0 & Ultimate Mockup Architecture', () => {
  const defaultProps = {
    tables: ['orders', 'customers', 'products', 'regions', 'v_sales_summary'],
    currentTable: 'orders',
    runtimeInfo: {
      version: '1.29.0',
      storageMode: 'opfs' as const,
      persistent: true,
      ready: true,
    },
    onRefreshTables: vi.fn().mockResolvedValue(undefined),
    onSelectTable: vi.fn(),
    onOpenFile: vi.fn(),
    onAttachDatabase: vi.fn(),
    onAddDataSource: vi.fn(),
  };

  it('consumes the home new-query intent once after workspace restoration', async () => {
    useAppStore.getState().setPendingNewQuery(true);
    const view = render(<WorkbenchView {...defaultProps}/>);
    await waitFor(() => expect(useAppStore.getState().pendingNewQuery).toBe(false));
    expect(screen.getAllByText('查询 2').length).toBeGreaterThan(0);
    view.rerender(<WorkbenchView {...defaultProps}/>);
    expect(screen.queryByText('查询 3')).toBeNull();
    expect(screen.getByText(/等待执行查询/)).toBeTruthy();
  });

  it('renders unified 4-core-area workbench matching final blueprint and AI Assistant', () => {
    render(<WorkbenchView {...defaultProps} />);

    // 1. Data Explorer — desktop viewport keeps left rail open
    expect(screen.getByText('数据资源浏览')).toBeTruthy();
    expect(screen.getByRole('button', { name: '隐藏左侧边栏' })).toBeTruthy();
    expect(screen.getAllByText('memory').length).toBeGreaterThan(0);
    expect(screen.getAllByText('main').length).toBeGreaterThan(0);
    expect(screen.getAllByText('orders').length).toBeGreaterThan(0);
    expect(screen.getAllByText('customers').length).toBeGreaterThan(0);
    expect(screen.getByText('打开文件')).toBeTruthy();
    expect(screen.getByText('附加数据库')).toBeTruthy();
    expect(screen.getAllByText(/添加数据源/).length).toBeGreaterThan(0);

    // 2. SQL Workspace & MECE Action Toolbar
    expect(screen.getAllByText('query_1.sql').length).toBeGreaterThan(0);
    expect(screen.getByText('运行')).toBeTruthy();
    expect(screen.getByRole('button', { name: '停止' })).toBeTruthy();
    expect(screen.getByText('格式化')).toBeTruthy();
    expect(screen.getByText('流程图')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'AI 解释' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'AI 分析' })).toBeTruthy();
    // 运行选中 / 执行计划 live under Run menu (no duplicate primary buttons)
    fireEvent.click(screen.getByRole('button', { name: '更多执行选项' }));
    expect(screen.getByText('运行选中')).toBeTruthy();
    expect(screen.getAllByText('执行计划').length).toBeGreaterThan(0);

    // 3. Result Section & Subtabs
    expect(screen.getByText('数据')).toBeTruthy();
    expect(screen.getAllByText('图表').length).toBeGreaterThan(0);
    expect(screen.getAllByText('筛选').length).toBeGreaterThan(0);
    expect(screen.getByText('分组')).toBeTruthy();
    expect(screen.getByText('透视')).toBeTruthy();
    expect(screen.getByText(/等待执行查询/)).toBeTruthy();

    // 4. Column Inspector — default rail is collapsed; expand then verify
    fireEvent.click(screen.getByRole('button', { name: '展开列画像' }));
    expect(screen.getByText('数据探查')).toBeTruthy();
    expect(screen.getByText('暂无活动列统计')).toBeTruthy();

    // 5. Status Bar
    expect(screen.getByText('db')).toBeTruthy();
    expect(screen.getByText(/memory\.main/)).toBeTruthy();
    expect(screen.getAllByText('就绪').length).toBeGreaterThan(0);
  });

  it('starts with compact side rails on phone-sized viewports', () => {
    const previousWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    render(<WorkbenchView {...defaultProps} />);

    expect(screen.queryByText('数据资源浏览')).toBeNull();
    expect(screen.queryByText('数据探查')).toBeNull();
    expect(screen.getByRole('button', { name: '展示左侧边栏' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '展开列画像' })).toBeTruthy();

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: previousWidth });
  });
  it('closes the compact right panel with Escape and restores trigger focus', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    render(<WorkbenchView {...defaultProps} />);

    const trigger = screen.getByRole('button', { name: '展开列画像' });
    fireEvent.click(trigger);
    expect(screen.getByText('数据探查')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByText('数据探查')).toBeNull());
    await waitFor(() => expect(screen.getByRole('button', { name: '展开列画像' })).toHaveFocus());
  });
  it('supports opening Runtime Center modal when clicking status bar indicator', () => {
    render(<WorkbenchView {...defaultProps} />);

    const readyBtn = screen.getByTitle('查看 DuckDB WASM 引擎与扩展运行时状态');
    fireEvent.click(readyBtn);

    expect(screen.getByText('运行时状态中心')).toBeTruthy();
    expect(screen.getByText('DuckDB-Wasm 1.29.0')).toBeTruthy();
    expect(screen.getByText('立即 Checkpoint')).toBeTruthy();
  });

  it('supports switching to AI 解释 and AI 分析 from toolbar', () => {
    render(<WorkbenchView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'AI 解释' }));

    expect(screen.getByText('AI 助手')).toBeTruthy();
    expect(screen.getAllByText('一句话解释').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'AI 分析' }));

    // Analyze subtab is active; content may be empty-state or config prompt
    expect(screen.getByTestId('ai-tab-analyze')).toBeTruthy();
    expect(
      screen.getByText(/等待 AI 生成分析|配置 AI 服务|逻辑风险|性能关注|结论|分析依据/)
    ).toBeTruthy();
  });

  it('supports opening Linear Feedback & Issue Tracking modal from status bar', () => {
    render(<WorkbenchView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: '反馈' }));

    expect(screen.getByText('Linear 反馈追踪与 Issue 闭环中心')).toBeTruthy();
    expect(screen.getByText('CORE-101')).toBeTruthy();
    expect(screen.getAllByText(/JetBrains Mono/).length).toBeGreaterThan(0);
  });

  it('renders clean divider status bar without redundant font or engine label noise', () => {
    render(<WorkbenchView {...defaultProps} />);

    expect(screen.queryByText('DuckDB SQL')).toBeNull();
    expect(screen.queryByText('字体:')).toBeNull();
    expect(screen.queryByText('字号:')).toBeNull();
    expect(screen.getByText('最大化结果')).toBeTruthy();
    expect(screen.getByText('最大化代码')).toBeTruthy();
  });
});

