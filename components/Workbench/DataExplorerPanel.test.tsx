// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataExplorerPanel } from './DataExplorerPanel';
import { duckDBService } from '../../services/duckdbService';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('DataExplorerPanel One-Click Clear & Deletion', () => {
  beforeEach(() => {
    localStorage.setItem('duckdb_recent_queries_v1', JSON.stringify(['revenue_q4.sql']));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(duckDBService, 'getBaseTables').mockResolvedValue(['users', 'orders']);
    vi.spyOn(duckDBService, 'getViews').mockResolvedValue(['v_active_users']);
    vi.spyOn(duckDBService, 'getMacros').mockResolvedValue(['m_test_macro']);
    vi.spyOn(duckDBService, 'getRegisteredFiles').mockReturnValue([
      { name: 'sample.parquet', size: '120 KB', type: 'parquet', lastModified: Date.now() },
    ]);
    vi.spyOn(duckDBService, 'clearAllData').mockResolvedValue({
      droppedTables: 2,
      droppedViews: 1,
      droppedMacros: 1,
      droppedFiles: 1,
    });
    vi.spyOn(duckDBService, 'clearMacros').mockResolvedValue(1);
    vi.spyOn(duckDBService, 'dropTable').mockResolvedValue(undefined);
    vi.spyOn(duckDBService, 'dropView').mockResolvedValue(undefined);
    vi.spyOn(duckDBService, 'dropMacro').mockResolvedValue(undefined);
    vi.spyOn(duckDBService, 'dropRegisteredFile').mockResolvedValue(undefined);
  });

  it('renders all 5 asset sections with clear buttons', async () => {
    render(<DataExplorerPanel onRefreshTables={vi.fn()} tables={['users', 'orders']} />);

    await waitFor(() => {
      expect(screen.getByText(/表 \(/i)).toBeInTheDocument();
      expect(screen.getByText(/视图 \(/i)).toBeInTheDocument();
      expect(screen.getByText(/宏 \(Macros\) \(/i)).toBeInTheDocument();
      expect(screen.getByText(/文件与远程源/i)).toBeInTheDocument();
      expect(screen.getByText(/最近打开/i)).toBeInTheDocument();
    });

    expect(screen.getByTitle('一键清空所有数据表')).toBeInTheDocument();
    expect(screen.getByTitle('一键清空所有视图')).toBeInTheDocument();
    expect(screen.getByTitle('一键清空所有宏')).toBeInTheDocument();
    expect(screen.getByTitle('一键清空文件与远程源')).toBeInTheDocument();
    expect(screen.getByTitle('一键清空最近打开记录')).toBeInTheDocument();
  });

  it('clears all tables when clicking table clear button', async () => {
    const onRefreshTables = vi.fn();
    render(<DataExplorerPanel onRefreshTables={onRefreshTables} tables={['users', 'orders']} />);

    const clearTablesBtn = await screen.findByTitle('一键清空所有数据表');
    fireEvent.click(clearTablesBtn);

    const confirmBtn = await screen.findByText('确认清空数据表');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(duckDBService.clearAllData).toHaveBeenCalledWith(
        expect.objectContaining({ tables: true, views: false, files: false })
      );
      expect(onRefreshTables).toHaveBeenCalled();
    });
  });

  it('clears all views when clicking view clear button', async () => {
    const onRefreshTables = vi.fn();
    render(<DataExplorerPanel onRefreshTables={onRefreshTables} tables={['users', 'orders', 'v_active_users']} />);

    const clearViewsBtn = await screen.findByTitle('一键清空所有视图');
    fireEvent.click(clearViewsBtn);

    const confirmBtn = await screen.findByText('确认清空视图');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(duckDBService.clearAllData).toHaveBeenCalledWith(
        expect.objectContaining({ tables: false, views: true, files: false })
      );
      expect(onRefreshTables).toHaveBeenCalled();
    });
  });

  it('deletes a single view cleanly when clicking delete button on view item', async () => {
    const onRefreshTables = vi.fn();
    const onDeleteView = vi.fn().mockResolvedValue(undefined);
    render(
      <DataExplorerPanel
        onRefreshTables={onRefreshTables}
        onDeleteView={onDeleteView}
        tables={['users', 'orders']}
      />
    );

    const deleteBtn = await screen.findByTitle('删除视图 v_active_users');
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(onDeleteView).toHaveBeenCalledWith('v_active_users');
    });
  });

  it('clears all macros when clicking macro clear button', async () => {
    const onRefreshTables = vi.fn();
    render(<DataExplorerPanel onRefreshTables={onRefreshTables} tables={['users', 'orders']} />);

    const clearMacrosBtn = await screen.findByTitle('一键清空所有宏');
    fireEvent.click(clearMacrosBtn);

    const confirmBtn = await screen.findByText('确认清空宏');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(duckDBService.clearMacros).toHaveBeenCalled();
      expect(onRefreshTables).toHaveBeenCalled();
    });
  });

  it('clears all files & remote sources when clicking file clear button', async () => {
    const onRefreshTables = vi.fn();
    render(<DataExplorerPanel onRefreshTables={onRefreshTables} tables={['users', 'orders']} />);

    const clearFilesBtn = await screen.findByTitle('一键清空文件与远程源');
    fireEvent.click(clearFilesBtn);

    const confirmBtn = await screen.findByText('确认清空');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(duckDBService.clearAllData).toHaveBeenCalledWith(
        expect.objectContaining({ tables: false, views: false, files: true })
      );
      expect(onRefreshTables).toHaveBeenCalled();
    });
  });

  it('clears recent items when clicking recent clear button', async () => {
    render(<DataExplorerPanel onRefreshTables={vi.fn()} tables={['users', 'orders']} />);

    const clearRecentBtn = await screen.findByTitle('一键清空最近打开记录');
    fireEvent.click(clearRecentBtn);

    await waitFor(() => {
      expect(screen.queryByText('revenue_q4.sql')).not.toBeInTheDocument();
    });
  });

  it('renders collapse toggle button and triggers onClosePanel when clicked', async () => {
    const onClosePanel = vi.fn();
    render(<DataExplorerPanel onRefreshTables={vi.fn()} tables={['users']} onClosePanel={onClosePanel} />);

    const toggleBtn = await screen.findByRole('button', { name: '隐藏左侧边栏' });
    expect(toggleBtn).toBeInTheDocument();
    fireEvent.click(toggleBtn);
    expect(onClosePanel).toHaveBeenCalledTimes(1);
  });
});
