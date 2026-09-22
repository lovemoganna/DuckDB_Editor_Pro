// @vitest-environment jsdom

import React from 'react';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MultiHopDeductionExplorer } from './MultiHopDeductionExplorer';

const mockState: any = {
  objects: [
    { id: 1, name: '用户A', object_type_id: 1 },
    { id: 2, name: '订单B', object_type_id: 2 },
    { id: 3, name: '商品C', object_type_id: 3 },
  ],
  links: [
    { id: 10, source_object_id: 1, target_object_id: 2, link_type_id: 101 },
    { id: 20, source_object_id: 2, target_object_id: 3, link_type_id: 102 },
  ],
  objectTypes: [
    { id: 1, name: '用户' },
    { id: 2, name: '订单' },
    { id: 3, name: '商品' },
  ],
  linkTypes: [
    { id: 101, name: '创建了' },
    { id: 102, name: '包含' },
  ],
};

vi.mock('../../hooks/useOntologyStore', () => ({
  useOntologyStore: () => ({
    state: mockState,
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('MultiHopDeductionExplorer Component', () => {
  it('renders title, selectors and swap button', () => {
    render(<MultiHopDeductionExplorer />);

    expect(screen.getByText('多跳拓扑推演探查器')).toBeInTheDocument();
    expect(screen.getByText(/对调方向/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('搜索起点实体...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('搜索目标实体...')).toBeInTheDocument();
  });

  it('swaps source and target when swap button is clicked', () => {
    render(<MultiHopDeductionExplorer />);

    const sourceSelect = screen.getByDisplayValue('-- 请选择起点实体 --');
    fireEvent.change(sourceSelect, { target: { value: '1' } });

    const targetSelect = screen.getByDisplayValue('-- 请选择目标实体 --');
    fireEvent.change(targetSelect, { target: { value: '3' } });

    // Click swap button
    const swapBtn = screen.getByRole('button', { name: /对调方向/i });
    fireEvent.click(swapBtn);

    expect(screen.getByText('ID: 3')).toBeInTheDocument();
    expect(screen.getByText('ID: 1')).toBeInTheDocument();
  });

  it('discovers 2-hop path between 用户A and 商品C and shows flow steps', () => {
    render(<MultiHopDeductionExplorer />);

    const sourceSelect = screen.getByDisplayValue('-- 请选择起点实体 --');
    fireEvent.change(sourceSelect, { target: { value: '1' } });

    const targetSelect = screen.getByDisplayValue('-- 请选择目标实体 --');
    fireEvent.change(targetSelect, { target: { value: '3' } });

    expect(screen.getByText(/链路 #1 · 2 跳/i)).toBeInTheDocument();
    expect(screen.getByText('用户A')).toBeInTheDocument();
    expect(screen.getByText('订单B')).toBeInTheDocument();
    expect(screen.getByText('商品C')).toBeInTheDocument();
  });

  it('toggles inline SQL CTE preview when SQL button is clicked', () => {
    render(<MultiHopDeductionExplorer />);

    const sourceSelect = screen.getByDisplayValue('-- 请选择起点实体 --');
    fireEvent.change(sourceSelect, { target: { value: '1' } });

    const targetSelect = screen.getByDisplayValue('-- 请选择目标实体 --');
    fireEvent.change(targetSelect, { target: { value: '3' } });

    const sqlBtn = screen.getByRole('button', { name: /SQL/i });
    fireEvent.click(sqlBtn);

    expect(screen.getByText(/DuckDB 递归推演 CTE 语句:/i)).toBeInTheDocument();

    // Click again to fold
    const closeBtn = screen.getByRole('button', { name: /收起/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByText(/DuckDB 递归推演 CTE 语句:/i)).not.toBeInTheDocument();
  });
});
