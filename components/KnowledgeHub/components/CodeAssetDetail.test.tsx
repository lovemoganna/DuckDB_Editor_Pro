import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CodeAssetDetail } from './CodeAssetDetail';
import { CodeAsset } from '../types';
import { duckDBService } from '../../../services/duckdbService';

vi.mock('../../../services/duckdbService', () => ({
  duckDBService: {
    query: vi.fn(),
  },
}));

describe('CodeAssetDetail', () => {
  const mockAsset: CodeAsset = {
    id: 'test-code-1',
    type: 'code',
    title: '参数化测试模版',
    category: 'template',
    description: '测试动态参数占位符与执行',
    sql: 'SELECT * FROM {{table_name}} WHERE count >= {{min_count}};',
    params: [
      { name: 'table_name', label: '目标表名', defaultValue: 'default_orders', description: '数据表' },
      { name: 'min_count', label: '最小阈值', defaultValue: '10' },
    ],
    tags: ['Test', 'Dynamic'],
    createdAt: '2026-03-21T00:00:00Z',
    updatedAt: '2026-03-21T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title, description and parameter inputs', () => {
    render(<CodeAssetDetail asset={mockAsset} />);

    expect(screen.getByText('参数化测试模版')).toBeInTheDocument();
    expect(screen.getByText('测试动态参数占位符与执行')).toBeInTheDocument();
    expect(screen.getByText('目标表名')).toBeInTheDocument();
    expect(screen.getByText('最小阈值')).toBeInTheDocument();
  });

  it('interpolates default parameter values into compiled SQL and sends to editor', () => {
    const onTryCode = vi.fn();
    render(<CodeAssetDetail asset={mockAsset} onTryCode={onTryCode} />);

    // Check default compiled SQL displayed
    expect(screen.getByText(/SELECT \* FROM default_orders WHERE count >= 10;/)).toBeInTheDocument();

    // Click "发送到 SQL 编辑器"
    const insertBtn = screen.getByText('发送到 SQL 编辑器');
    fireEvent.click(insertBtn);

    expect(onTryCode).toHaveBeenCalledWith('SELECT * FROM default_orders WHERE count >= 10;');
  });

  it('updates compiled SQL when parameter input is modified', () => {
    const onTryCode = vi.fn();
    render(<CodeAssetDetail asset={mockAsset} onTryCode={onTryCode} />);

    const inputs = screen.getAllByRole('textbox');
    // Modify table_name
    fireEvent.change(inputs[0], { target: { value: 'custom_sales' } });

    expect(screen.getByText(/SELECT \* FROM custom_sales WHERE count >= 10;/)).toBeInTheDocument();

    const insertBtn = screen.getByText('发送到 SQL 编辑器');
    fireEvent.click(insertBtn);

    expect(onTryCode).toHaveBeenCalledWith('SELECT * FROM custom_sales WHERE count >= 10;');
  });

  it('runs query inline via duckDBService and displays results', async () => {
    (duckDBService.query as any).mockResolvedValueOnce([
      { id: 1, name: 'Alpha' },
      { id: 2, name: 'Beta' },
    ]);

    render(<CodeAssetDetail asset={mockAsset} />);

    const runBtn = screen.getByText('执行 SQL');
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(duckDBService.query).toHaveBeenCalledWith('SELECT * FROM default_orders WHERE count >= 10;');
      expect(screen.getByText('Alpha')).toBeInTheDocument();
      expect(screen.getByText('Beta')).toBeInTheDocument();
      expect(screen.getByText('2 行数据返回')).toBeInTheDocument();
    });
  });

  it('displays error message gracefully when query fails', async () => {
    (duckDBService.query as any).mockRejectedValueOnce(new Error('Table default_orders does not exist'));

    render(<CodeAssetDetail asset={mockAsset} />);

    const runBtn = screen.getByText('执行 SQL');
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(screen.getByText(/Table default_orders does not exist/)).toBeInTheDocument();
    });
  });

  it('executes multi-statement SQL sequentially and displays final result set', async () => {
    const multiStmtAsset: CodeAsset = {
      ...mockAsset,
      id: 'multi-stmt-test',
      sql: 'CREATE TEMP TABLE t1 AS SELECT 1; SELECT 42 AS answer;',
      params: [],
    };

    (duckDBService.query as any)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ answer: 42 }]);

    render(<CodeAssetDetail asset={multiStmtAsset} />);

    const runBtn = screen.getByText('执行 SQL');
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    expect(duckDBService.query).toHaveBeenCalledTimes(2);
    expect(duckDBService.query).toHaveBeenNthCalledWith(1, 'CREATE TEMP TABLE t1 AS SELECT 1;');
    expect(duckDBService.query).toHaveBeenNthCalledWith(2, 'SELECT 42 AS answer;');
  });
});
