import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { KnowledgeHubApp } from './KnowledgeHubApp';
import { resetKnowledgeAssetsToSeeds } from './services/knowledgeAssetStorage';

describe('KnowledgeHubApp', () => {
  beforeEach(async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as any);
    await resetKnowledgeAssetsToSeeds();
    vi.clearAllMocks();
  });

  it('renders two-column layout with seed assets loaded in topic tree', async () => {
    render(<KnowledgeHubApp />);

    // 验证左栏 Org-Museum 知识库标题
    expect(screen.getByText('知识文献库')).toBeInTheDocument();

    // 验证加载了预置资产并呈现于专题下
    await waitFor(() => {
      expect(screen.getAllByText('SQL').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Parquet 极速元数据与数据分布抽样').length).toBeGreaterThan(0);
    });

    // 点击该 SQL 资产，验证右栏工作台呈现代码资产详情与执行/发送按钮
    const parquetItems = screen.getAllByText('Parquet 极速元数据与数据分布抽样');
    fireEvent.click(parquetItems[0]);

    await waitFor(() => {
      expect(screen.getByText('SQL 执行定义')).toBeInTheDocument();
      expect(screen.getAllByText('执行 SQL').length).toBeGreaterThan(0);
      expect(screen.getAllByText('发送到 SQL 编辑器').length).toBeGreaterThan(0);
    });
  });

  it('searches and filters documents in topic tree by query string', async () => {
    render(<KnowledgeHubApp />);

    await waitFor(() => {
      expect(screen.getAllByText('Parquet 极速元数据与数据分布抽样')[0]).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/筛选标题或标签/);
    fireEvent.change(searchInput, { target: { value: '时区' } });

    await waitFor(() => {
      expect(screen.getAllByText(/DuckDB 时间戳时区解析陷阱/)[0]).toBeInTheDocument();
      expect(screen.queryAllByText('Parquet 极速元数据与数据分布抽样').length).toBe(0);
    });
  });

  it('selects an asset and updates right detail panel', async () => {
    render(<KnowledgeHubApp />);

    await waitFor(() => {
      expect(screen.getAllByText(/DuckDB 原生 PIVOT 动态透视/).length).toBeGreaterThan(0);
    });

    // 点击 PIVOT 条目
    const pivotCards = screen.getAllByText(/DuckDB 原生 PIVOT 动态透视/);
    fireEvent.click(pivotCards[0]);

    await waitFor(() => {
      // 验证右侧详情面板渲染了该资产独有的 SQL 代码
      expect(screen.getByText(/ON channel IN/)).toBeInTheDocument();
    });
  });

  it('toggles sidebar collapse and expand when clicking collapse button', async () => {
    localStorage.clear();
    render(<KnowledgeHubApp />);

    // 初始状态下侧边栏存在
    await waitFor(() => {
      expect(screen.getByText('知识文献库')).toBeInTheDocument();
    });

    const collapseBtn = screen.getByTitle('折叠隐藏侧边栏');
    expect(collapseBtn).toBeInTheDocument();

    // 点击折叠侧边栏
    fireEvent.click(collapseBtn);

    // 侧边栏消失，出现展开侧边栏按钮
    await waitFor(() => {
      expect(screen.queryByText('知识文献库')).not.toBeInTheDocument();
      expect(screen.getByTitle(/展开知识文献库侧边栏/)).toBeInTheDocument();
    });

    // 点击展开侧边栏
    const expandBtn = screen.getByTitle(/展开知识文献库侧边栏/);
    fireEvent.click(expandBtn);

    // 侧边栏重新显示
    await waitFor(() => {
      expect(screen.getByText('知识文献库')).toBeInTheDocument();
    });
  });
});
