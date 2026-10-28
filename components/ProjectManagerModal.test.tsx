import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ProjectManagerModal } from './ProjectManagerModal';
import { duckDBService } from '../services/duckdbService';
import { useAppStore } from '../hooks/store/useAppStore';

vi.mock('../services/duckdbService', () => ({
  duckDBService: {
    listDatabases: vi.fn(),
    listDetachedDatabaseFiles: vi.fn(),
    getDatabaseTableCounts: vi.fn(),
    getDatabaseSchemas: vi.fn(),
    createDatabase: vi.fn(),
    useDatabase: vi.fn(),
    attachDatabase: vi.fn(),
    detachDatabase: vi.fn(),
    dropDatabase: vi.fn(),
    deleteDetachedDatabaseFile: vi.fn(),
  },
}));

vi.mock('./ui/ConfirmDialog', () => ({
  useConfirmDialog: () => ({
    confirm: vi.fn().mockResolvedValue(true),
  }),
}));

describe('ProjectManagerModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.getState().setCurrentDatabase('memory');
    vi.mocked(duckDBService.listDatabases).mockResolvedValue([
      {
        name: 'memory',
        path: null,
        type: 'memory',
        readonly: false,
        internal: false,
        isCurrent: true,
        persistent: false,
      },
      {
        name: 'sales_db',
        path: 'opfs://sales_db.duckdb',
        type: 'duckdb',
        readonly: false,
        internal: false,
        isCurrent: false,
        persistent: true,
      },
    ]);
    vi.mocked(duckDBService.listDetachedDatabaseFiles).mockResolvedValue(['archive_2023']);
    vi.mocked(duckDBService.getDatabaseTableCounts).mockResolvedValue({
      memory: 2,
      sales_db: 5,
    });
    vi.mocked(duckDBService.getDatabaseSchemas).mockResolvedValue({
      memory: ['main'],
      sales_db: ['main', 'analytics'],
    });
  });

  it('renders complete database list, metadata, and detached files', async () => {
    render(
      <ProjectManagerModal
        isOpen={true}
        onClose={vi.fn()}
        onProjectSelected={vi.fn()}
        currentProject="memory"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('已挂载数据库 (2)')).toBeInTheDocument();
      expect(screen.getByText('sales_db')).toBeInTheDocument();
      expect(screen.getByText('5 个数据表')).toBeInTheDocument();
      expect(screen.getByText('2 个数据表')).toBeInTheDocument();
      expect(screen.getByText('archive_2023.duckdb')).toBeInTheDocument();
      expect(screen.getByText('未挂载的数据库文件 (1)')).toBeInTheDocument();
      expect(screen.getByText('analytics')).toBeInTheDocument();
    });
  });

  it('supports deleting an attached database with confirmation and switching back to memory if active', async () => {
    const onProjectSelected = vi.fn();
    useAppStore.getState().setCurrentDatabase('sales_db');

    render(
      <ProjectManagerModal
        isOpen={true}
        onClose={vi.fn()}
        onProjectSelected={onProjectSelected}
        currentProject="sales_db"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('sales_db')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByTitle('删除数据库');
    expect(deleteBtn).toBeInTheDocument();

    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(duckDBService.dropDatabase).toHaveBeenCalledWith('sales_db');
      expect(onProjectSelected).toHaveBeenCalledWith('memory');
    });
  });

  it('supports deleting a detached OPFS database file', async () => {
    render(
      <ProjectManagerModal
        isOpen={true}
        onClose={vi.fn()}
        onProjectSelected={vi.fn()}
        currentProject="memory"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('archive_2023.duckdb')).toBeInTheDocument();
    });

    const deleteDetachedBtn = screen.getByTitle('删除文件');
    expect(deleteDetachedBtn).toBeInTheDocument();

    fireEvent.click(deleteDetachedBtn);

    await waitFor(() => {
      expect(duckDBService.deleteDetachedDatabaseFile).toHaveBeenCalledWith('archive_2023');
    });
  });
});
