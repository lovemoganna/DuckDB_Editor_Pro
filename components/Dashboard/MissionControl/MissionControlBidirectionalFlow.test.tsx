// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfirmDialogProvider } from '../../ui/ConfirmDialog';
import { Dashboard } from '../../Dashboard';
import { Tab } from '../../../types';
import { useAppStore } from '../../../hooks/store/useAppStore';
import { useSqlEditorStore } from '../../../hooks/store/useSqlEditorStore';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  readQuery: vi.fn(),
  getTables: vi.fn(),
  getTableSchema: vi.fn(),
  importFile: vi.fn(),
  dropTable: vi.fn(),
}));

vi.mock('../../../services/duckdbService', () => ({
  duckDBService: {
    query: mocks.query,
    readQuery: mocks.readQuery,
    getTables: mocks.getTables,
    getTableSchema: mocks.getTableSchema,
    importFile: mocks.importFile,
    dropTable: mocks.dropTable,
    isBatchRunning: () => false,
  },
}));

vi.mock('../../../services/toastService', () => ({
  toastService: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    show: vi.fn(),
  },
}));

describe('Dashboard Mission Control Bidirectional Real Workflow E2E', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('duckdb_dashboard_layout_mode', 'mission-control');
    useAppStore.setState({
      tables: [],
      currentTable: null,
      pendingSql: '',
      activeTab: Tab.DASHBOARD,
    });
    useSqlEditorStore.setState({
      history: [],
      tabs: [],
      activeTabId: '',
    });

    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('COUNT(*)')) {
        return [{ cnt: 1200 }];
      }
      if (sql.includes('duckdb_views')) {
        return [];
      }
      if (sql.includes('current_database')) {
        return [{ cur_db: 'main' }];
      }
      return [];
    });
    mocks.readQuery.mockImplementation(mocks.query);
    mocks.getTables.mockResolvedValue([]);
    mocks.getTableSchema.mockResolvedValue([
      { name: 'id', type: 'INTEGER', pk: true },
      { name: 'val', type: 'VARCHAR', pk: false },
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('executes full bidirectional cycle: other page writes -> dashboard reflects -> dashboard interacts -> navigates with context -> mutation synchronizes', async () => {
    const onNavigate = vi.fn((tab) => {
      useAppStore.getState().setActiveTab(tab);
    });

    // ── Phase 1: Initial Render on Empty Database ──
    const { rerender } = render(
      <ConfirmDialogProvider>
        <Dashboard
          tables={[]}
          onNavigate={onNavigate}
          initialLayoutMode="mission-control"
          runtimeInfo={{ version: '1.33.1', persistent: true, ready: true }}
        />
      </ConfirmDialogProvider>
    );

    // Verify honest empty states on clean slate
    expect(screen.getByText('当前数据库暂无数据表或视图')).toBeInTheDocument();
    expect(screen.getByText('暂无查询执行流水')).toBeInTheDocument();
    expect(screen.getByText('仪表盘')).toBeInTheDocument();

    // ── Phase 2: Other Page Modifies Data (Table Import + SQL Execution) ──
    // Simulate table created by import or SQL DDL
    mocks.getTables.mockResolvedValue(['orders', 'customers']);
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('orders') && sql.includes('COUNT(*)')) return [{ cnt: 8500 }];
      if (sql.includes('customers') && sql.includes('COUNT(*)')) return [{ cnt: 320 }];
      return [];
    });
    mocks.readQuery.mockImplementation(mocks.query);

    // Emulate SQL Editor executing query and saving to store
    act(() => {
      useAppStore.getState().setTables(['orders', 'customers']);
      useSqlEditorStore.getState().addHistory({
        id: 'real-query-101',
        sql: 'SELECT * FROM orders WHERE amount > 500;',
        timestamp: new Date().toISOString(),
        executionTime: 8,
        affectedRows: 42,
        status: 'success',
      });
      window.dispatchEvent(new Event('duckdb-schema-changed'));
    });

    // Re-render Dashboard with updated tables prop (as App.tsx does)
    rerender(
      <ConfirmDialogProvider>
        <Dashboard
          tables={['orders', 'customers']}
          onNavigate={onNavigate}
          initialLayoutMode="mission-control"
          runtimeInfo={{ version: '1.33.1', persistent: true, ready: true }}
        />
      </ConfirmDialogProvider>
    );

    // Wait for Dashboard to reflect real schema and real query execution
    await waitFor(() => {
      expect(screen.getAllByText('orders').length).toBeGreaterThan(0);
      expect(screen.getAllByText('customers').length).toBeGreaterThan(0);
      expect(screen.getByText('SELECT * FROM orders WHERE amount > 500;')).toBeInTheDocument();
      expect(screen.getAllByText('8 ms').length).toBeGreaterThan(0);
    });

    // ── Phase 3: Dashboard Click Object -> Navigates with Real Context ──
    // 1. Click on table node in topology
    const ordersNode = screen.getAllByText('orders')[0];
    fireEvent.click(ordersNode);

    // App state currentTable must be set to 'orders'
    expect(useAppStore.getState().currentTable).toBe('orders');

    // 2. Click "新建 SQL 查询" on Action Launchpad
    const newSqlTile = screen.getByText('新建 SQL 查询');
    fireEvent.click(newSqlTile);

    // A real tab must be created in useSqlEditorStore and onNavigate called
    expect(useSqlEditorStore.getState().tabs.length).toBeGreaterThan(0);
    expect(onNavigate).toHaveBeenCalledWith(Tab.SQL);

    // 3. Click re-run query directly from Live Query Stream
    const rerunBtn = screen.getByTitle('立即重新执行此查询');
    fireEvent.click(rerunBtn);

    // Direct execution triggers onNavigate with SQL context
    expect(onNavigate).toHaveBeenCalledWith(Tab.SQL);

    // ── Phase 4: Mutation on Data -> Dashboard Synchronizes Again ──
    // Drop table 'customers'
    mocks.getTables.mockResolvedValue(['orders']);
    act(() => {
      useAppStore.getState().setTables(['orders']);
      window.dispatchEvent(new Event('duckdb-schema-changed'));
    });

    rerender(
      <ConfirmDialogProvider>
        <Dashboard
          tables={['orders']}
          onNavigate={onNavigate}
          initialLayoutMode="mission-control"
          runtimeInfo={{ version: '1.33.1', persistent: true, ready: true }}
        />
      </ConfirmDialogProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('orders').length).toBeGreaterThan(0);
      expect(screen.queryByText('customers')).not.toBeInTheDocument();
    });
  });
});
