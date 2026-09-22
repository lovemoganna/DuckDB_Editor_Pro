// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstantDataProbe } from './InstantDataProbe';
import { Tab } from '../../types';

const mockProbeFile = vi.fn();
const mockProbeTable = vi.fn();
const mockProbeText = vi.fn();
const mockQuery = vi.fn();

vi.mock('../../services/duckdbService', () => ({
  duckDBService: {
    probeFile: (...args: any[]) => mockProbeFile(...args),
    probeTable: (...args: any[]) => mockProbeTable(...args),
    probeText: (...args: any[]) => mockProbeText(...args),
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

describe('InstantDataProbe', () => {
  const onNavigate = vi.fn();
  const setPendingSql = vi.fn();
  const setCurrentTable = vi.fn();
  const onLoadDemoDataset = vi.fn();
  const onRefreshTables = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders default idle probe stage with dropzone and launchpad cards', () => {
    render(
      <InstantDataProbe
        tables={['orders', 'users']}
        onNavigate={onNavigate}
        setPendingSql={setPendingSql}
        setCurrentTable={setCurrentTable}
        onLoadDemoDataset={onLoadDemoDataset}
        isSeedingDemo={false}
        onRefreshTables={onRefreshTables}
      />
    );

    expect(screen.getByText('DuckDB 原生即席探查雷达')).toBeInTheDocument();
    expect(screen.getByText('拖入数据文件 或 点击选择')).toBeInTheDocument();
    expect(screen.getByText('新建空白 SQL 查询')).toBeInTheDocument();
    expect(screen.getByText('载入官方电商 6 表 Demo')).toBeInTheDocument();
  });

  it('navigates to SQL tab when clicking new query card', () => {
    render(
      <InstantDataProbe
        tables={[]}
        onNavigate={onNavigate}
        setPendingSql={setPendingSql}
        setCurrentTable={setCurrentTable}
        onLoadDemoDataset={onLoadDemoDataset}
        isSeedingDemo={false}
        onRefreshTables={onRefreshTables}
      />
    );

    fireEvent.click(screen.getByText('新建空白 SQL 查询'));
    expect(onNavigate).toHaveBeenCalledWith(Tab.SQL);
  });

  it('handles existing table probing and shows real schema and preview rows', async () => {
    mockProbeTable.mockResolvedValue({
      name: 'orders',
      rowCount: 100,
      selectSource: '"orders"',
      columns: [
        { name: 'order_id', type: 'INTEGER' },
        { name: 'amount', type: 'DECIMAL' },
      ],
      previewRows: [
        { order_id: 1, amount: 99.5 },
        { order_id: 2, amount: 150.0 },
      ],
      elapsedMs: 12.5,
    });

    render(
      <InstantDataProbe
        tables={['orders', 'users']}
        onNavigate={onNavigate}
        setPendingSql={setPendingSql}
        setCurrentTable={setCurrentTable}
        onLoadDemoDataset={onLoadDemoDataset}
        isSeedingDemo={false}
        onRefreshTables={onRefreshTables}
      />
    );

    fireEvent.click(screen.getByText(/库中已有表/));

    await waitFor(() => {
      expect(mockProbeTable).toHaveBeenCalledWith('orders');
    });

    expect(await screen.findByText(/总计：100 行/)).toBeInTheDocument();
    expect(screen.getAllByText('order_id')[0]).toBeInTheDocument();
    expect(screen.getByText('INTEGER')).toBeInTheDocument();

    // Click straight to SQL
    fireEvent.click(screen.getByText(/免导直通 SQL 查询 →/));
    expect(setPendingSql).toHaveBeenCalledWith('SELECT * FROM "orders" LIMIT 50;');
    expect(onNavigate).toHaveBeenCalledWith(Tab.SQL);
  });
});
