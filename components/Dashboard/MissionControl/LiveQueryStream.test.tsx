// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LiveQueryStream } from './LiveQueryStream';
import { Tab } from '../../../types';
import { useAppStore } from '../../../hooks/store/useAppStore';

describe('LiveQueryStream Component', () => {
  beforeEach(() => {
    useAppStore.setState({ pendingAiPanel: null, pendingSql: '' });
  });

  const mockQueries = [
    {
      id: 'q-1',
      sql: 'SELECT * FROM users;',
      timestamp: '14:20',
      duration: '12.5 ms',
      status: 'success' as const,
    },
    {
      id: 'q-2',
      sql: 'SELECT error_col FROM invalid_tbl;',
      timestamp: '14:22',
      duration: '2.1 ms',
      status: 'error' as const,
    },
    {
      id: 'q-3',
      sql: 'SELECT count(*) FROM orders;',
      timestamp: '14:25',
      duration: '45 ms',
      status: 'success' as const,
    },
  ];

  it('renders query stream with items, time, and status pills', () => {
    const onSelect = vi.fn();
    const onNavigate = vi.fn();
    render(
      <LiveQueryStream
        queries={mockQueries}
        onSelectQuery={onSelect}
        onNavigate={onNavigate}
      />
    );

    expect(screen.getByText('最近查询')).toBeInTheDocument();
    expect(screen.getByText('SELECT * FROM users;')).toBeInTheDocument();
    expect(screen.getByText('12.5 ms')).toBeInTheDocument();
    expect(screen.getAllByText('成功').length).toBeGreaterThan(0);
    expect(screen.getAllByText('失败').length).toBeGreaterThan(0);
  });

  it('filters queries by status when clicking status pills', () => {
    render(
      <LiveQueryStream
        queries={mockQueries}
        onSelectQuery={vi.fn()}
        onNavigate={vi.fn()}
      />
    );

    // Click '失败' filter
    const failBtn = screen.getByRole('button', { name: '失败' });
    fireEvent.click(failBtn);

    expect(screen.getByText('SELECT error_col FROM invalid_tbl;')).toBeInTheDocument();
    expect(screen.queryByText('SELECT * FROM users;')).not.toBeInTheDocument();

    // Click '全部' filter
    const allBtn = screen.getByRole('button', { name: '全部' });
    fireEvent.click(allBtn);
    expect(screen.getByText('SELECT * FROM users;')).toBeInTheDocument();
  });

  it('filters queries by search term', () => {
    render(
      <LiveQueryStream
        queries={mockQueries}
        onSelectQuery={vi.fn()}
        onNavigate={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText('过滤 SQL 语句...');
    fireEvent.change(searchInput, { target: { value: 'orders' } });

    expect(screen.getByText('SELECT count(*) FROM orders;')).toBeInTheDocument();
    expect(screen.queryByText('SELECT * FROM users;')).not.toBeInTheDocument();
  });

  it('opens more actions menu and triggers explain actions', () => {
    const onSelect = vi.fn();
    const onNavigate = vi.fn();
    render(
      <LiveQueryStream
        queries={mockQueries}
        onSelectQuery={onSelect}
        onNavigate={onNavigate}
      />
    );

    const moreButtons = screen.getAllByTitle('更多操作');
    expect(moreButtons.length).toBeGreaterThan(0);
    fireEvent.click(moreButtons[0]);

    expect(screen.getAllByText('AI 解释').length).toBeGreaterThan(0);
    expect(screen.getByText('执行计划分析')).toBeInTheDocument();

    fireEvent.click(screen.getAllByText('AI 解释')[0]);
    expect(onSelect).toHaveBeenCalledWith('SELECT * FROM users;');
    expect(onNavigate).toHaveBeenCalledWith(Tab.SQL);
    expect(useAppStore.getState().pendingAiPanel).toBe('explain');
  });

  it('exposes primary AI explain button on each row without opening more menu', () => {
    const onSelect = vi.fn();
    const onNavigate = vi.fn();
    render(
      <LiveQueryStream
        queries={mockQueries}
        onSelectQuery={onSelect}
        onNavigate={onNavigate}
      />
    );

    const explainButtons = screen.getAllByTitle(/AI 解释：与 SQL 编辑器/);
    expect(explainButtons.length).toBe(mockQueries.length);
    fireEvent.click(explainButtons[1]);
    expect(onSelect).toHaveBeenCalledWith('SELECT error_col FROM invalid_tbl;');
    expect(onNavigate).toHaveBeenCalledWith(Tab.SQL);
    expect(useAppStore.getState().pendingAiPanel).toBe('explain');
  });

  it('expands query detail in place on row click instead of navigating away', () => {
    const onSelect = vi.fn();
    const onNavigate = vi.fn();
    render(
      <LiveQueryStream
        queries={mockQueries}
        onSelectQuery={onSelect}
        onNavigate={onNavigate}
      />
    );

    fireEvent.click(screen.getByText('SELECT * FROM users;'));
    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.getByText('完整执行语句')).toBeInTheDocument();
  });

  it('navigates to HISTORY when clicking 全部历史', () => {
    const onNavigate = vi.fn();
    render(
      <LiveQueryStream
        queries={mockQueries}
        onSelectQuery={vi.fn()}
        onNavigate={onNavigate}
      />
    );

    fireEvent.click(screen.getByText('全部历史'));
    expect(onNavigate).toHaveBeenCalledWith(Tab.HISTORY);
  });

  it('triggers EXPLAIN ANALYZE from more menu', () => {
    const onSelect = vi.fn();
    const onNavigate = vi.fn();
    render(
      <LiveQueryStream
        queries={mockQueries}
        onSelectQuery={onSelect}
        onNavigate={onNavigate}
      />
    );

    fireEvent.click(screen.getAllByTitle('更多操作')[0]);
    fireEvent.click(screen.getByText('执行计划分析'));
    expect(onSelect).toHaveBeenCalledWith(expect.stringContaining('EXPLAIN ANALYZE'));
    expect(onNavigate).toHaveBeenCalledWith(Tab.SQL);
  });
});
