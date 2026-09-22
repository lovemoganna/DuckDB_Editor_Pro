// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UnifiedTimelineFeed } from './UnifiedTimelineFeed';
import { Tab } from '../../types';

const mockGetAuditLogs = vi.fn();
const mockQuery = vi.fn();

vi.mock('../../services/duckdbService', () => ({
  duckDBService: {
    getAuditLogs: (...args: any[]) => mockGetAuditLogs(...args),
    query: (...args: any[]) => mockQuery(...args),
  },
}));

vi.mock('../../services/toastService', () => ({
  toastService: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

describe('UnifiedTimelineFeed', () => {
  const onNavigate = vi.fn();
  const setPendingSql = vi.fn();
  const setCurrentTable = vi.fn();
  const onLoadDemoDataset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders honest empty state when no history or audit logs exist', async () => {
    mockGetAuditLogs.mockResolvedValue([]);

    render(
      <UnifiedTimelineFeed
        onNavigate={onNavigate}
        setPendingSql={setPendingSql}
        setCurrentTable={setCurrentTable}
        onLoadDemoDataset={onLoadDemoDataset}
        isSeedingDemo={false}
      />
    );

    expect(await screen.findByText('当前工作区暂无历史操作足迹')).toBeInTheDocument();
    expect(screen.getByText(/DuckDB 拒绝虚构 Mock 数据/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /执行一次查询/ })).toBeInTheDocument();
  });

  it('merges real SQL history and audit logs and renders actionable cards', async () => {
    localStorage.setItem(
      'duckdb_sql_history',
      JSON.stringify([
        {
          id: 'hist-1',
          sql: 'SELECT * FROM users WHERE active = true;',
          status: 'success',
          timestamp: Date.now() - 10000,
          executionTime: 8.5,
          rowCount: 42,
        },
      ])
    );

    mockGetAuditLogs.mockResolvedValue([
      {
        id: 1,
        operation_type: 'IMPORT',
        target_table: 'customers',
        details: 'Imported file customers.parquet',
        affected_rows: 500,
        sql_statement: "CREATE TABLE customers AS SELECT * FROM 'customers.parquet'",
        log_time: new Date().toISOString(),
      },
    ]);

    mockQuery.mockResolvedValue([{ count: 42 }]);

    render(
      <UnifiedTimelineFeed
        onNavigate={onNavigate}
        setPendingSql={setPendingSql}
        setCurrentTable={setCurrentTable}
        onLoadDemoDataset={onLoadDemoDataset}
        isSeedingDemo={false}
      />
    );

    expect(await screen.findByText('执行 SQL 查询')).toBeInTheDocument();
    expect(screen.getByText('数据导入入库: customers')).toBeInTheDocument();
    expect(screen.getByText(/SELECT \* FROM users WHERE active = true;/)).toBeInTheDocument();

    // Re-run SQL
    const rerunButtons = screen.getAllByRole('button', { name: /重跑/ });
    fireEvent.click(rerunButtons[0]);

    await waitFor(() => {
      expect(mockQuery).toHaveBeenCalled();
    });

    // Open in Editor
    const editorButtons = screen.getAllByRole('button', { name: /编辑器/ });
    fireEvent.click(editorButtons[0]);
    expect(setPendingSql).toHaveBeenCalled();
    expect(onNavigate).toHaveBeenCalledWith(Tab.SQL);
  });
});
