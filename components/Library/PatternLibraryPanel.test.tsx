// @vitest-environment jsdom

import React from 'react';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PatternLibraryPanel } from './PatternLibraryPanel';
import { ConfirmDialogProvider } from '../ui/ConfirmDialog';

// Mock useOntologyStore
const mockMergeOntologyTemplate = vi.fn().mockResolvedValue(undefined);
vi.mock('../../hooks/useOntologyStore', async () => {
  const actual = await vi.importActual('../../hooks/useOntologyStore');
  return {
    ...actual,
    useOntologyStore: () => ({
      mergeOntologyTemplate: mockMergeOntologyTemplate,
      refresh: vi.fn(),
    }),
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

const mockState: any = {
  objects: [{ id: 1 }, { id: 2 }],
  links: [{ id: 1 }],
  objectTypes: [{ id: 1 }],
  linkTypes: [{ id: 1 }],
  activeTemplateId: 'ontology-lv1',
};

const renderComponent = (props: any = {}) => {
  const defaultProps = {
    state: mockState,
    activeTemplateId: 'ontology-lv1',
    switchTemplate: vi.fn().mockResolvedValue(undefined),
    onTablesReady: vi.fn(),
    ...props,
  };
  const result = render(
    <ConfirmDialogProvider>
      <PatternLibraryPanel {...defaultProps} />
    </ConfirmDialogProvider>
  );
  return { ...result, props: defaultProps };
};

describe('PatternLibraryPanel MECE Component', () => {
  it('renders all 14 lesson cards and header elements by default', () => {
    renderComponent();

    expect(screen.getByText('本体建模实战路线')).toBeInTheDocument();
    expect(screen.getByText('14 课')).toBeInTheDocument();
    expect(screen.getByText('掌握进度:')).toBeInTheDocument();

    expect(screen.getByText('0001')).toBeInTheDocument();
    expect(screen.getByText('0014')).toBeInTheDocument();

    expect(screen.getByText('画布实体')).toBeInTheDocument();
    expect(screen.getByText('关系连线')).toBeInTheDocument();
  });

  it('filters lessons by stage tabs correctly', () => {
    renderComponent();

    const phase1Btn = screen.getByRole('button', { name: /识别与边界 \(3\)/i });
    fireEvent.click(phase1Btn);

    expect(screen.getByText('0001')).toBeInTheDocument();
    expect(screen.getByText('0002')).toBeInTheDocument();
    expect(screen.getByText('0003')).toBeInTheDocument();
    expect(screen.queryByText('0004')).not.toBeInTheDocument();

    const phase2Btn = screen.getByRole('button', { name: /拓扑与变迁 \(4\)/i });
    fireEvent.click(phase2Btn);

    expect(screen.getByText('0004')).toBeInTheDocument();
    expect(screen.queryByText('0001')).not.toBeInTheDocument();
  });

  it('filters lessons by search query and supports clear button', () => {
    renderComponent();

    const searchInput = screen.getByPlaceholderText(/搜索课号、标题、核心节点或案例故事/i);
    fireEvent.change(searchInput, { target: { value: '茄子' } });

    expect(screen.getByText('0001')).toBeInTheDocument();
    expect(screen.queryByText('0002')).not.toBeInTheDocument();

    const clearBtn = screen.getByRole('button', { name: '×' });
    fireEvent.click(clearBtn);

    expect(screen.getByText('0001')).toBeInTheDocument();
    expect(screen.getByText('0002')).toBeInTheDocument();
  });

  it('handles loading a lesson and triggers switchTemplate and onTablesReady', async () => {
    const { props } = renderComponent();

    const card1 = screen.getByTestId('lesson-card-lesson-0001');
    const loadBtn = card1.querySelector('button[title*="载入本课模型"]');
    expect(loadBtn).toBeTruthy();

    fireEvent.click(loadBtn!);

    await waitFor(() => {
      expect(props.switchTemplate).toHaveBeenCalledWith('lesson-0001');
      expect(props.onTablesReady).toHaveBeenCalled();
    });
  });

  it('shows reload button and active badge when template is already active', () => {
    renderComponent({ activeTemplateId: 'lesson-0001' });

    const card1 = screen.getByTestId('lesson-card-lesson-0001');
    const resetBtn = card1.querySelector('button[title*="点击可重置回原始状态"]');
    expect(resetBtn).toBeTruthy();
    expect(resetBtn?.textContent).toContain('重置');
  });

  it('expands card details on header click without triggering load', () => {
    const { props } = renderComponent();

    const card1 = screen.getByTestId('lesson-card-lesson-0001');
    const header = card1.firstElementChild!;
    
    fireEvent.click(header);

    expect(screen.getByText(/① 原文案例材料故事/i)).toBeInTheDocument();
    expect(screen.getByText(/中午，妈妈在家做了一道茄子/i)).toBeInTheDocument();
    expect(screen.getByText(/② 核心心智训练动作/i)).toBeInTheDocument();
    expect(screen.getByText(/③ 图谱视觉看点/i)).toBeInTheDocument();
    expect(screen.getByText(/④ 核心实体与概念/i)).toBeInTheDocument();

    expect(props.switchTemplate).not.toHaveBeenCalled();
  });

  it('supports incremental merge into current graph', async () => {
    renderComponent();

    const card1 = screen.getByTestId('lesson-card-lesson-0001');
    fireEvent.click(card1.firstElementChild!);

    const mergeBtn = screen.getByRole('button', { name: /追加合并/i });
    fireEvent.click(mergeBtn);

    await waitFor(() => {
      expect(mockMergeOntologyTemplate).toHaveBeenCalledWith('lesson-0001', 'overwrite');
    });
  });

  it('tracks learning completion status with localStorage persistence', () => {
    renderComponent();

    const card1 = screen.getByTestId('lesson-card-lesson-0001');
    const toggleBtn = card1.querySelector('button[title="标记为已掌握"]');
    expect(toggleBtn).toBeTruthy();

    fireEvent.click(toggleBtn!);

    expect(localStorage.getItem('duckdb_ontology_completed_lessons')).toContain('lesson-0001');

    const completedTab = screen.getByRole('button', { name: /已掌握 \(1\)/i });
    fireEvent.click(completedTab);
    // Only lesson 1 should be visible
    expect(screen.getByText('0001')).toBeInTheDocument();
    expect(screen.queryByText('0002')).not.toBeInTheDocument();
  });

  it('has all 14 lesson seeds properly registered in ONTOLOGY_SEEDS', async () => {
    const { ONTOLOGY_SEEDS } = await vi.importActual<any>('../../hooks/useOntologyStore');
    for (let i = 1; i <= 14; i++) {
      const id = `lesson-${String(i).padStart(4, '0')}`;
      expect(ONTOLOGY_SEEDS[id]).toBeDefined();
      expect(ONTOLOGY_SEEDS[id].objectTypes.length).toBeGreaterThan(0);
      expect(ONTOLOGY_SEEDS[id].objects.length).toBeGreaterThan(0);
      expect(ONTOLOGY_SEEDS[id].links.length).toBeGreaterThan(0);
    }
  });
});
