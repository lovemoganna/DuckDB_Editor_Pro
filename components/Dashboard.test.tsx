// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialogProvider } from './ui/ConfirmDialog';
import { Dashboard } from './Dashboard';
import { Tab } from '../types';
import { useAppStore } from '../hooks/store/useAppStore';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  getTables: vi.fn(),
  getTableSchema: vi.fn(),
  importFile: vi.fn(),
  dropTable: vi.fn(),
  seedDemoWorkbenchData: vi.fn(),
  getCurrentCatalogAndSchema: vi.fn().mockResolvedValue({ catalog: 'memory', schema: 'main' }),
  listAnalysisContexts: vi.fn().mockResolvedValue([
    { id: 'memory.main', label: 'memory / main', kind: 'database', isCurrent: true },
  ]),
  isBatchRunning: vi.fn().mockReturnValue(false),
  switchAnalysisContext: vi.fn().mockResolvedValue({ catalog: 'memory', schema: 'main' }),
}));

vi.mock('../services/duckdbService', () => ({
  duckDBService: {
    query: mocks.query,
    readQuery: mocks.query,
    getTables: mocks.getTables,
    getTableSchema: mocks.getTableSchema,
    importFile: mocks.importFile,
    dropTable: mocks.dropTable,
    getCurrentCatalogAndSchema: mocks.getCurrentCatalogAndSchema,
    listAnalysisContexts: mocks.listAnalysisContexts,
    isBatchRunning: mocks.isBatchRunning,
    switchAnalysisContext: mocks.switchAnalysisContext,
  },
}));

vi.mock('./Workbench/seedWorkbenchData', () => ({
  seedDemoWorkbenchData: mocks.seedDemoWorkbenchData,
}));

vi.mock('../services/toastService', () => ({
  toastService: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    show: vi.fn(),
  },
}));

const runtimeInfo = {
  ready: true,
  persistent: false,
  version: '1.33.1',
  persistenceError: null,
};

const renderDashboard = (
  tables: string[] = ['orders', 'customers'],
  onNavigate = vi.fn(),
  extraProps: Partial<React.ComponentProps<typeof Dashboard>> = {},
) =>
  render(
    <ConfirmDialogProvider>
      <Dashboard tables={tables} onNavigate={onNavigate} runtimeInfo={runtimeInfo} {...extraProps} />
    </ConfirmDialogProvider>,
  );

beforeEach(() => {
  mocks.query.mockImplementation(async (sql: string) => {
    if (sql.includes('COUNT(*)')) {
      return [{ cnt: 4892 }];
    }
    if (sql.includes('LIMIT 10')) {
      return [
        { id: 1, name: 'Alice', amount: 120 },
        { id: 2, name: 'Bob', amount: 340 },
      ];
    }
    return [];
  });
  mocks.getTables.mockResolvedValue(['orders', 'customers']);
  mocks.getTableSchema.mockResolvedValue([
    { name: 'id', type: 'INTEGER', pk: true },
    { name: 'name', type: 'VARCHAR', pk: false },
    { name: 'amount', type: 'DOUBLE', pk: false },
  ]);
  mocks.seedDemoWorkbenchData.mockResolvedValue(undefined);
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Dashboard Component Integration Tests', () => {
  it('renders Mission Control with context selector and top strip controls', async () => {
    const onNavigate = vi.fn();
    renderDashboard(['orders', 'customers'], onNavigate);

    // Analysis Context selector
    const contextBtn = screen.getByTitle('切换待分析数据库 / Schema');
    expect(contextBtn).toBeInTheDocument();
    expect(contextBtn).toHaveTextContent('memory / main');

    // Refresh action
    const refreshBtn = screen.getByRole('button', { name: /刷新数据/ });
    expect(refreshBtn).toBeInTheDocument();
  });

  it('handles Ctrl+Enter keyboard shortcut to navigate to SQL tab', async () => {
    const onNavigate = vi.fn();
    renderDashboard(['orders', 'customers'], onNavigate);

    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
    expect(onNavigate).toHaveBeenCalledWith(Tab.SQL);
  });

  it('handles Meta+Enter keyboard shortcut to navigate to SQL tab', async () => {
    const onNavigate = vi.fn();
    renderDashboard(['orders', 'customers'], onNavigate);

    fireEvent.keyDown(window, { key: 'Enter', metaKey: true });
    expect(onNavigate).toHaveBeenCalledWith(Tab.SQL);
  });

  it('triggers manual refresh when clicking refresh button', async () => {
    renderDashboard(['orders', 'customers']);

    const refreshBtn = screen.getByRole('button', { name: /刷新数据/ });
    expect(refreshBtn).toBeInTheDocument();
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(mocks.getTables).toHaveBeenCalled();
    });
  });

  it('renders drag and drop overlay on global drag over and hides on drag leave', async () => {
    const { container } = renderDashboard(['orders', 'customers']);
    const root = container.firstElementChild as HTMLElement;

    // Initially no drop overlay
    expect(screen.queryByText('释放文件以即时解析导入')).not.toBeInTheDocument();

    // Trigger dragOver
    fireEvent.dragOver(root, { dataTransfer: { files: [] } });
    expect(screen.getByText('释放文件以即时解析导入')).toBeInTheDocument();
    expect(screen.getByText(/支持 \.csv, \.xlsx/)).toBeInTheDocument();

    // Trigger dragLeave
    fireEvent.dragLeave(root, { relatedTarget: document.body });
    expect(screen.queryByText('释放文件以即时解析导入')).not.toBeInTheDocument();
  });

  it('handles file drop and triggers file import', async () => {
    mocks.importFile.mockResolvedValueOnce(undefined);
    const { container } = renderDashboard(['orders']);
    const root = container.firstElementChild as HTMLElement;

    const file = new File(['id,name\n1,Alpha'], 'test_data.csv', { type: 'text/csv' });
    fireEvent.drop(root, {
      dataTransfer: {
        files: [file],
      },
    });

    await waitFor(() => {
      expect(mocks.importFile).toHaveBeenCalled();
    });
  });

  it('renders correctly when there are 0 tables without throwing errors', async () => {
    mocks.getTables.mockResolvedValue([]);
    renderDashboard([]);

    // Scope button still renders
    const contextBtn = screen.getByTitle('切换待分析数据库 / Schema');
    expect(contextBtn).toBeInTheDocument();
  });

  it('navigates to SQL tab when clicking primary CTA (新建查询)', async () => {
    const onNavigate = vi.fn();
    renderDashboard(['orders'], onNavigate);

    const newQueryBtn = await screen.findByRole('button', { name: /新建查询/ });
    expect(newQueryBtn).toBeInTheDocument();
    fireEvent.click(newQueryBtn);

    expect(onNavigate).toHaveBeenCalledWith(Tab.SQL);
  });

  it('opens and closes context dropdown on trigger click', async () => {
    renderDashboard(['orders']);

    const contextBtn = await screen.findByTitle('切换待分析数据库 / Schema');
    expect(contextBtn).toBeInTheDocument();
    expect(contextBtn).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(contextBtn);
    expect(contextBtn).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(contextBtn);
    expect(contextBtn).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens import modal when clicking import button in top strip', async () => {
    useAppStore.getState().setShowImportModal(false);
    renderDashboard(['orders']);

    const importBtn = await screen.findByRole('button', { name: /导入/ });
    expect(importBtn).toBeInTheDocument();
    fireEvent.click(importBtn);

    expect(useAppStore.getState().showImportModal).toBe(true);
  });
});
