// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuditTab, type AuditLog } from './AuditTab';
import { useAppStore } from '../hooks/store/useAppStore';
import { useSqlEditorStore } from '../hooks/store/useSqlEditorStore';
import { Tab } from '../types';

afterEach(cleanup);

const mockAuditLogs: AuditLog[] = [
  {
    id: 1,
    log_time: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    operation_type: 'CREATE_TABLE',
    target_table: 'users',
    details: 'CREATE TABLE users (id INTEGER PRIMARY KEY, name VARCHAR, email VARCHAR);',
    affected_rows: 0,
  },
  {
    id: 2,
    log_time: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    operation_type: 'INSERT',
    target_table: 'users',
    details: "INSERT INTO users VALUES (1, 'Alice', 'alice@example.com'), (2, 'Bob', 'bob@example.com');",
    affected_rows: 2,
  },
  {
    id: 3,
    log_time: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    operation_type: 'UPDATE',
    target_table: 'orders',
    details: "UPDATE orders SET status = 'completed' WHERE amount > 100;",
    affected_rows: 5,
  },
  {
    id: 4,
    log_time: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    operation_type: 'DROP_TABLE',
    target_table: 'temp_log',
    details: 'DROP TABLE temp_log;',
    affected_rows: 0,
  },
];

describe('AuditTab Component', () => {
  it('renders page header, KPI cards and correct calculation stats', () => {
    render(<AuditTab auditLogs={mockAuditLogs} />);

    // Header
    expect(screen.getByText('系统审计日志 (Audit Log)')).toBeTruthy();
    expect(screen.getByText('4 条记录')).toBeTruthy();

    // KPI Cards
    expect(screen.getByText('操作总计 (Total)')).toBeTruthy();
    expect(screen.getByText('DDL 结构演进')).toBeTruthy();
    expect(screen.getByText('DML 数据变更')).toBeTruthy();
    expect(screen.getByText('累计受影响行')).toBeTruthy();
    expect(screen.getByText('涉及数据表')).toBeTruthy();

    // Total affected rows: 0 + 2 + 5 + 0 = 7
    expect(screen.getByText('7')).toBeTruthy();
    // 3 unique tables: users, orders, temp_log
    expect(screen.getByText('3 个表')).toBeTruthy();
  });

  it('filters logs when switching category segmented tabs', () => {
    render(<AuditTab auditLogs={mockAuditLogs} />);

    // Initially all 4 logs visible
    expect(screen.getByText('CREATE TABLE users (id INTEGER PRIMARY KEY, name VARCHAR, email VARCHAR);')).toBeTruthy();
    expect(screen.getByText("UPDATE orders SET status = 'completed' WHERE amount > 100;")).toBeTruthy();

    // Click DDL tab
    const ddlTab = screen.getByRole('tab', { name: /DDL 架构/ });
    fireEvent.click(ddlTab);

    // Only DDL (CREATE, DROP) should match
    expect(screen.getByText('CREATE TABLE users (id INTEGER PRIMARY KEY, name VARCHAR, email VARCHAR);')).toBeTruthy();
    expect(screen.getByText('DROP TABLE temp_log;')).toBeTruthy();
    expect(screen.queryByText("UPDATE orders SET status = 'completed' WHERE amount > 100;")).toBeNull();

    // Click DML tab
    const dmlTab = screen.getByRole('tab', { name: /DML 变更/ });
    fireEvent.click(dmlTab);
    expect(screen.getByText("UPDATE orders SET status = 'completed' WHERE amount > 100;")).toBeTruthy();
    expect(screen.queryByText('DROP TABLE temp_log;')).toBeNull();
  });

  it('filters logs by search input and target table', () => {
    render(<AuditTab auditLogs={mockAuditLogs} />);

    const searchInput = screen.getByPlaceholderText('搜索 SQL 语句、表名、操作类型...');
    fireEvent.change(searchInput, { target: { value: 'Alice' } });

    // Only INSERT with Alice should be visible
    expect(screen.getByText(/INSERT INTO users VALUES/)).toBeTruthy();
    expect(screen.queryByText(/UPDATE orders/)).toBeNull();

    // Reset search
    const clearButton = screen.getByRole('button', { name: '清空搜索' });
    fireEvent.click(clearButton);

    expect(screen.getByText(/UPDATE orders/)).toBeTruthy();
  });

  it('expands detail row to inspect full SQL and triggers replay in SQL editor', () => {
    render(<AuditTab auditLogs={mockAuditLogs} />);

    const row = screen.getByText('CREATE TABLE users (id INTEGER PRIMARY KEY, name VARCHAR, email VARCHAR);');
    fireEvent.click(row);

    // Detail drawer should show
    expect(screen.getByText('SQL STATEMENT PREVIEW')).toBeTruthy();
    expect(screen.getByText('在 SQL 编辑器中执行')).toBeTruthy();

    // Click replay button
    const replayButton = screen.getByText('在 SQL 编辑器中执行');
    fireEvent.click(replayButton);

    expect(useAppStore.getState().activeTab).toBe(Tab.SQL);
  });

  it('shows empty state when filter yields no matches and allows reset', () => {
    render(<AuditTab auditLogs={mockAuditLogs} />);

    const searchInput = screen.getByPlaceholderText('搜索 SQL 语句、表名、操作类型...');
    fireEvent.change(searchInput, { target: { value: 'non_existent_symbol_xyz' } });

    expect(screen.getByText('未找到符合条件的审计记录')).toBeTruthy();
    expect(screen.getByText('重置所有筛选')).toBeTruthy();

    fireEvent.click(screen.getByText('重置所有筛选'));
    expect(screen.getByText('CREATE TABLE users (id INTEGER PRIMARY KEY, name VARCHAR, email VARCHAR);')).toBeTruthy();
  });
});
