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

  it('opens narrow navigation without changing the desktop collapse preference', async () => {
    const previous = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', {configurable:true,writable:true,value:vi.fn(() => ({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()}))});
    localStorage.setItem('duckdb_knowledge_hub_sidebar_collapsed', 'false');
    const view = render(<KnowledgeHubApp />);
    try {
      const expand = await screen.findByRole('button', {name:'展开知识文献库侧边栏'});
      expect(screen.queryByText('知识文献库')).toBeNull();
      fireEvent.click(expand);
      expect(await screen.findByText('知识文献库')).toBeInTheDocument();
      fireEvent.keyDown(window, {ctrlKey:true,key:'b'});
      expect(screen.queryByText('知识文献库')).toBeNull();
      expect(localStorage.getItem('duckdb_knowledge_hub_sidebar_collapsed')).toBe('false');
    } finally {view.unmount(); window.matchMedia = previous;}
  });

  it('renders two-column layout with seed assets loaded in topic tree', async () => {
    render(<KnowledgeHubApp />);

    // 验证左栏 Org-Museum 知识库标题
    expect(screen.getByText('知识文献库')).toBeInTheDocument();

    // 验证加载了预置资产并呈现于专题下
    await waitFor(() => {
      expect(screen.getAllByText('Ontology').length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Lesson 1 · DuckDB SQL 入门/).length).toBeGreaterThan(0);
    });

    // 点击该资产，验证右栏工作台呈现详情
    const lessonItems = screen.getAllByText(/Lesson 1 · DuckDB SQL 入门/);
    fireEvent.click(lessonItems[0]);

    await waitFor(() => {
      expect(screen.getAllByText(/哲学概念本体/i).length).toBeGreaterThan(0);
    });
  });

  it('searches and filters documents in topic tree by query string', async () => {
    render(<KnowledgeHubApp />);

    await waitFor(() => {
      expect(screen.getAllByText(/Lesson 1 · DuckDB SQL 入门/)[0]).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/筛选标题或标签/);
    fireEvent.change(searchInput, { target: { value: '供应链' } });

    await waitFor(() => {
      expect(screen.getAllByText(/电商供应链本体建模/)[0]).toBeInTheDocument();
      expect(screen.queryAllByText(/Lesson 1 · DuckDB SQL 入门/).length).toBe(0);
    });
  });

  it('selects an asset and updates right detail panel', async () => {
    render(<KnowledgeHubApp />);

    await waitFor(() => {
      expect(screen.getAllByText(/电商供应链本体建模/).length).toBeGreaterThan(0);
    });

    // 点击电商供应链条目
    const cards = screen.getAllByText(/电商供应链本体建模/);
    fireEvent.click(cards[0]);

    await waitFor(() => {
      // 验证右侧详情面板渲染了该资产独有的内容
      expect(screen.getAllByText(/供应链最小闭环/).length).toBeGreaterThan(0);
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
