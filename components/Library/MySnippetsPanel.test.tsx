// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MySnippetsPanel } from './MySnippetsPanel';
import { duckDBService } from '../../services/duckdbService';

afterEach(cleanup);

const mockSnippets = [
  {
    id: 'snip-1',
    title: '用户总数统计',
    sql: 'SELECT COUNT(*) FROM users;',
    description: '查询用户总数',
    tags: ['用户', '统计'],
    favorite: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

describe('MySnippetsPanel', () => {
  it('renders snippets list and filter controls', () => {
    render(
      <MySnippetsPanel
        snippets={mockSnippets}
        selectedFilter="all"
        onFilterChange={vi.fn()}
        onCopy={vi.fn()}
        onInsert={vi.fn()}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onToggleFavorite={vi.fn()}
        onImportSnippets={vi.fn()}
      />
    );

    expect(screen.getByText('用户总数统计')).toBeInTheDocument();
    expect(screen.getByText('SELECT COUNT(*) FROM users;')).toBeInTheDocument();
  });

  it('triggers schema-aware AI snippet recommendations upon clicking AI fill', async () => {
    vi.spyOn(duckDBService, 'getTables').mockResolvedValue(['sales_data']);
    vi.spyOn(duckDBService, 'getTableSchema').mockResolvedValue([
      { name: 'order_id', type: 'INTEGER' },
      { name: 'amount', type: 'DECIMAL' },
    ]);

    render(
      <MySnippetsPanel
        snippets={mockSnippets}
        selectedFilter="all"
        onFilterChange={vi.fn()}
        onCopy={vi.fn()}
        onInsert={vi.fn()}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onToggleFavorite={vi.fn()}
        onImportSnippets={vi.fn()}
      />
    );

    const addBtn = screen.getByRole('button', { name: /添加片段/i });
    fireEvent.click(addBtn);

    const aiFillBtn = screen.getByRole('button', { name: /AI 填充/i });
    fireEvent.click(aiFillBtn);

    await waitFor(() => {
      expect(screen.getByText(/AI 智能推荐/i)).toBeInTheDocument();
      expect(screen.getByText(/探索分析: sales_data/i)).toBeInTheDocument();
    });
  });
});
