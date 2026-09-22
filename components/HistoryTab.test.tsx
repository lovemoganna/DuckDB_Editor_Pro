// @vitest-environment jsdom

import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialogProvider } from './ui/ConfirmDialog';
import { HistoryTab } from './HistoryTab';
import { QueryHistoryItem, Tab } from '../types';
import { useSqlEditorStore } from '../hooks/store/useSqlEditorStore';
import { useAppStore } from '../hooks/store/useAppStore';

const mockHistory: QueryHistoryItem[] = [
  {
    id: 'query-1',
    sql: 'SELECT * FROM users WHERE status = \'active\'',
    timestamp: Date.now() - 60000,
    status: 'success',
    executionTime: 45,
    isStarred: false,
    affectedRows: 12,
  },
  {
    id: 'query-2',
    sql: 'SELECT department, count(*) FROM employees GROUP BY department',
    timestamp: Date.now() - 3600000,
    status: 'success',
    executionTime: 1250,
    isStarred: true,
    affectedRows: 5,
  },
  {
    id: 'query-3',
    sql: 'SELECT * FROM non_existent_table',
    timestamp: Date.now() - 7200000,
    status: 'error',
    executionTime: 12,
    error: 'Table non_existent_table does not exist',
    isStarred: false,
  },
];

vi.mock('../services/toastService', () => ({
  toastService: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

const renderHistoryTab = () =>
  render(
    <ConfirmDialogProvider>
      <HistoryTab />
    </ConfirmDialogProvider>
  );

beforeEach(() => {
  localStorage.setItem('duckdb_sql_history', JSON.stringify(mockHistory));
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

describe('HistoryTab workbench', () => {
  it('renders standard header, execution metrics strip and history items', async () => {
    renderHistoryTab();

    expect(screen.getByText(/分析洞察 • 查询历史/i)).toBeInTheDocument();
    expect(screen.getByText('执行指标分析 (Execution Metrics)')).toBeInTheDocument();
    expect(screen.getByText('总执行次数')).toBeInTheDocument();
    expect(screen.getByText('平均执行耗时')).toBeInTheDocument();

    // Check query snippets rendered
    expect(screen.getByText(/users/i)).toBeInTheDocument();
    expect(screen.getByText(/employees/i)).toBeInTheDocument();
  });

  it('filters history items by status (success, error, starred)', async () => {
    renderHistoryTab();

    // Filter by Error
    const errorTab = screen.getByRole('tab', { name: /异常报错/ });
    fireEvent.click(errorTab);

    expect(screen.getAllByText(/non_existent_table/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/employees/i)).not.toBeInTheDocument();

    // Filter by Starred
    const starredTab = screen.getByRole('tab', { name: /已收藏/ });
    fireEvent.click(starredTab);

    expect(screen.getByText(/employees/i)).toBeInTheDocument();
    expect(screen.queryByText(/non_existent_table/i)).not.toBeInTheDocument();
  });

  it('filters history items by latency pills (<100ms, >=1s)', async () => {
    renderHistoryTab();

    // Fast queries (<100ms)
    const fastFilter = screen.getByTitle('耗时小于 100ms 的极速查询');
    fireEvent.click(fastFilter);

    expect(screen.getByText(/users/i)).toBeInTheDocument();
    expect(screen.queryByText(/employees/i)).not.toBeInTheDocument();

    // Slow queries (>=1s)
    const slowFilter = screen.getByTitle('耗时大于 1s 的慢查询');
    fireEvent.click(slowFilter);

    expect(screen.getByText(/employees/i)).toBeInTheDocument();
    expect(screen.queryByText(/users/i)).not.toBeInTheDocument();
  });

  it('toggles between card view and compact table view', async () => {
    renderHistoryTab();

    // Switch to Table View
    const tableBtn = screen.getByTitle('紧凑表格视图 (Data Table View)');
    fireEvent.click(tableBtn);

    expect(screen.getByText('SQL 查询语句')).toBeInTheDocument();
    expect(screen.getByText('耗时')).toBeInTheDocument();
    expect(screen.getByText('执行时间')).toBeInTheDocument();

    // Switch back to Card View
    const cardBtn = screen.getByTitle('卡片流视图 (Card Flow View)');
    fireEvent.click(cardBtn);

    expect(screen.queryByText('SQL 查询语句')).not.toBeInTheDocument();
  });

  it('opens HistoryDetailDrawer when clicking a query item', async () => {
    renderHistoryTab();

    const detailButtons = screen.getAllByTitle('查看详情分析');
    fireEvent.click(detailButtons[0]);

    expect(screen.getByText('SQL 执行深度分析')).toBeInTheDocument();
    expect(screen.getByText('SQL 查询语句')).toBeInTheDocument();
    expect(screen.getByText(/已格式化/)).toBeInTheDocument();
  });

  it('supports searching SQL keywords dynamically', async () => {
    renderHistoryTab();

    const searchInput = screen.getByPlaceholderText('搜索 SQL 语句、报错关键字或 ID...');
    fireEvent.change(searchInput, { target: { value: 'department' } });

    expect(screen.getByText(/employees/i)).toBeInTheDocument();
    expect(screen.queryByText(/users/i)).not.toBeInTheDocument();
  });

  it('supports 载入运行 and dispatches duckdb_execute_sql event to run in SQL editor', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    renderHistoryTab();

    const runButtons = screen.getAllByTitle('在 SQL 编辑器中载入并运行');
    fireEvent.click(runButtons[0]);

    expect(useAppStore.getState().activeTab).toBe(Tab.SQL);
    expect(useAppStore.getState().pendingSql).toBe(mockHistory[0].sql);

    // Wait for the timeout dispatch
    await vi.waitFor(() => {
      const matchingCall = dispatchSpy.mock.calls.find(call => {
        const event = call[0] as CustomEvent;
        return event.type === 'duckdb_execute_sql' && event.detail?.autoRun === true;
      });
      expect(matchingCall).toBeDefined();
    });
  });

  it('supports 载入编辑器 in detail drawer and dispatches without auto-running', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    renderHistoryTab();

    const detailButtons = screen.getAllByTitle('查看详情分析');
    fireEvent.click(detailButtons[0]);

    const loadOnlyBtn = screen.getByTitle('载入 SQL 编辑器但暂不执行');
    fireEvent.click(loadOnlyBtn);

    expect(useAppStore.getState().activeTab).toBe(Tab.SQL);

    await vi.waitFor(() => {
      const matchingCall = dispatchSpy.mock.calls.find(call => {
        const event = call[0] as CustomEvent;
        return event.type === 'duckdb_execute_sql' && event.detail?.autoRun === false;
      });
      expect(matchingCall).toBeDefined();
    });
  });

  it('reactively updates list when a new query is executed/added to store', async () => {
    renderHistoryTab();

    expect(screen.queryByText(/SELECT 999 AS reactive_test/i)).not.toBeInTheDocument();

    act(() => {
      useSqlEditorStore.getState().addHistory({
        id: 'query-live-new',
        sql: 'SELECT 999 AS reactive_test;',
        timestamp: Date.now(),
        status: 'success',
        executionTime: 20,
      });
    });

    expect(await screen.findByText(/reactive_test/i)).toBeInTheDocument();
  });
});
