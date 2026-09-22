// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClearWorkspaceModal } from './ClearWorkspaceModal';
import { duckDBService } from '../services/duckdbService';

afterEach(cleanup);

describe('ClearWorkspaceModal', () => {
  it('renders correctly and performs clear on confirmation', async () => {
    vi.spyOn(duckDBService, 'getBaseTables').mockResolvedValue(['t1', 't2']);
    vi.spyOn(duckDBService, 'getViews').mockResolvedValue(['v1']);
    vi.spyOn(duckDBService, 'getMacros').mockResolvedValue(['m1', 'm2']);
    vi.spyOn(duckDBService, 'getRegisteredFiles').mockReturnValue([{ name: 'f1.parquet', size: '10KB', type: 'parquet', lastModified: Date.now() }]);
    const clearSpy = vi.spyOn(duckDBService, 'clearAllData').mockResolvedValue({
      droppedTables: 2,
      droppedViews: 1,
      droppedMacros: 2,
      droppedFiles: 1,
    });

    const onRefreshTables = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const onNotify = vi.fn();

    render(
      <ClearWorkspaceModal
        isOpen={true}
        onClose={onClose}
        onRefreshTables={onRefreshTables}
        onNotify={onNotify}
      />
    );

    // Verify Title & Warning
    expect(screen.getByText('清空工作区资源 (Clear Workspace)')).toBeTruthy();
    expect(screen.getByText(/警告：此操作不可撤销/)).toBeTruthy();

    // Verify checklist items
    expect(screen.getByText('数据表 (TABLES)')).toBeTruthy();
    expect(screen.getByText('分析视图 (VIEWS)')).toBeTruthy();
    expect(screen.getByText('宏与自定义函数 (MACROS)')).toBeTruthy();
    expect(screen.getByText('挂载文件 (FILES)')).toBeTruthy();

    await screen.findByText(/2 个表/);
    await screen.findByText(/1 个视图/);
    await screen.findByText(/2 个宏/);

    // Click confirm
    const confirmBtn = screen.getByText('确认彻底清空');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(clearSpy).toHaveBeenCalledWith({
        tables: true,
        views: true,
        macros: true,
        files: true,
      });
      expect(onRefreshTables).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });
});
