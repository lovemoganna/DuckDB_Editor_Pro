import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NoteAssetDetail } from './NoteAssetDetail';
import { NoteAsset } from '../types';
import { duckDBService } from '../../../services/duckdbService';

vi.mock('../../../services/duckdbService', () => ({
  duckDBService: {
    query: vi.fn(),
  },
}));

describe('NoteAssetDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockNoteAsset: NoteAsset = {
    id: 'note-duckdb-tut',
    type: 'note',
    title: 'DuckDB 进阶建模指南',
    topic: 'best_practice',
    summary: '介绍 DuckDB 高级 SQL 技巧与建模规范',
    content: `
# 1. 概述
本文介绍基础与高阶查询。

\`\`\`sql
SELECT 100 AS base_metric;
\`\`\`

## 1.1 聚合统计
下面是第二段查询：

\`\`\`sql
SELECT 200 AS agg_metric;
\`\`\`
`,
    tags: ['DuckDB', 'SQL'],
    references: ['https://duckdb.org/docs/'],
    isFavorite: false,
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-02T00:00:00Z',
  };

  it('renders top Run All and Collapse All buttons', () => {
    render(<NoteAssetDetail asset={mockNoteAsset} />);

    // 顶部「一键全部运行 (2)」按钮
    expect(screen.getByText('一键全部运行 (2)')).toBeInTheDocument();

    // 默认状态下全部折叠，顶部显示「一键展开代码」
    expect(screen.getByText('一键展开代码')).toBeInTheDocument();

    // 验证各代码块默认显示「展开」
    const expandButtons = screen.getAllByText('展开');
    expect(expandButtons.length).toBeGreaterThanOrEqual(2);
  });

  it('toggles collapse state for all code blocks when clicking top toggle button', () => {
    render(<NoteAssetDetail asset={mockNoteAsset} />);

    const toggleBtn = screen.getByText('一键展开代码');
    fireEvent.click(toggleBtn);

    // 切换后顶部按钮变为「一键折叠全部代码块」
    expect(screen.getByText('一键折叠全部代码块')).toBeInTheDocument();

    // 再次点击折叠
    fireEvent.click(screen.getByText('一键折叠全部代码块'));
    expect(screen.getByText('一键展开代码')).toBeInTheDocument();
  });

  it('runs all SQL blocks when clicking Run All and displays summary banner', async () => {
    (duckDBService.query as any).mockResolvedValue([{ val: 1 }]);

    render(<NoteAssetDetail asset={mockNoteAsset} />);

    const runAllBtn = screen.getByText('一键全部运行 (2)');
    fireEvent.click(runAllBtn);

    await waitFor(() => {
      // 两个 SQL 片段均被调用
      expect(duckDBService.query).toHaveBeenCalledTimes(2);
      // 顶部出现汇总横幅
      expect(screen.getByText(/已全部运行 2 个 SQL 片段/)).toBeInTheDocument();
      expect(screen.getByText('2 成功')).toBeInTheDocument();
    });
  });
});
