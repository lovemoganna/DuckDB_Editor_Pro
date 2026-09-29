import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RightDetailWorkbench } from './RightDetailWorkbench';
import { NoteAsset, CodeAsset } from '../types';
import { SEED_KNOWLEDGE_ASSETS } from '../data/seedAssets';
import { 
  synthesizeBaselineOntology, 
  synthesizeOntologyFromExecution,
  synthesizeOntologyFromSingleBlock,
  convertSynthesizedOntologyToStoreState 
} from '../../../services/ontology/ontologySynthesisEngine';

describe('Ontology Synthesis Engine for Knowledge Assets', () => {
  const mockNote: NoteAsset = {
    id: 'note-parquet-test',
    type: 'note',
    topic: 'best_practice',
    title: 'Parquet 列存投影与水塘抽样实战',
    summary: '测试 Parquet 文件投影下推与行组裁剪',
    content: '## 介绍\n```sql\nSELECT order_id, customer_id, pay_amount FROM read_parquet("orders.parquet") LIMIT 10;\n```',
    tags: ['Parquet', 'DuckDB'],
    isFavorite: false,
    createdAt: '2026-03-24T00:00:00.000Z',
    updatedAt: '2026-03-24T00:00:00.000Z',
  };

  it('generates baseline prospective ontology with storeState for a tutorial', () => {
    const baseline = synthesizeBaselineOntology(mockNote);
    expect(baseline).toBeDefined();
    expect(baseline.primaryConcept).toBeDefined();
    expect(baseline.storeState).toBeDefined();
    // 约束 1: 顶层节点直接由领域概念 Object Type 构成
    expect(baseline.storeState?.objectTypes.length).toBeGreaterThan(0);
    // 约束 3: 未执行代码前，绝不凭空捏造假实例
    expect(baseline.storeState?.objects.length).toBe(0);
    expect(baseline.storeState?.links.length).toBeGreaterThan(0);

    // Primary concept should be pending execution
    expect(baseline.primaryConcept.status).toBe('pending_execution');
  });

  it('synthesizes verified ontology with execution metrics upon code execution', () => {
    const mockReport = {
      total: 1,
      successCount: 1,
      failedCount: 0,
      totalDurationMs: 42,
      results: [
        {
          index: 1,
          sql: 'SELECT order_id, customer_id, pay_amount FROM read_parquet("orders.parquet") LIMIT 10;',
          durationMs: 42,
          success: true,
          rows: [{ order_id: 1, customer_id: 101, pay_amount: 99.5 }],
          columns: ['order_id', 'customer_id', 'pay_amount'],
          rowCount: 1,
        },
      ],
      synthesizedAt: new Date().toISOString(),
    };

    const synthesized = synthesizeOntologyFromExecution(mockNote, mockReport);
    expect(synthesized.primaryConcept.status).toBe('verified_active');
    expect(synthesized.executionMetrics.executedStatements).toBe(1);
    expect(synthesized.storeState).toBeDefined();

    const objects = synthesized.storeState!.objects;
    // 约束 2 & 4: 实例级图谱生成 Order 实例与 Customer 实例，表结构与本体语义分离，绝不直接将 orders.parquet 命名为节点
    const orderObj = objects.find(o => o.name.includes('Order'));
    expect(orderObj).toBeDefined();
    expect(orderObj?.properties).toContain('order_id');
    expect(objects.some(o => o.name.includes('orders.parquet'))).toBe(false);
  });

  it('incrementally updates ontology when a single SQL block is executed', () => {
    const baseline = synthesizeBaselineOntology(mockNote);
    const singleResult = {
      index: 1,
      sql: 'SELECT order_id, customer_id, pay_amount FROM orders.parquet LIMIT 1;',
      durationMs: 15,
      success: true,
      rows: [{ order_id: 1, customer_id: 101, pay_amount: 99.5 }],
      columns: ['order_id', 'customer_id', 'pay_amount'],
      rowCount: 1,
    };

    const updated = synthesizeOntologyFromSingleBlock(mockNote, baseline, singleResult);
    expect(updated.executionMetrics.executedStatements).toBe(1);
    expect(updated.executionMetrics.totalRowsProcessed).toBe(1);
    expect(updated.storeState?.objects.length).toBeGreaterThan(0);
  });
});

describe('RightDetailWorkbench Split-View and Graph Integration', () => {
  const noteAsset = SEED_KNOWLEDGE_ASSETS.find(a => a.type === 'note') as NoteAsset;

  it('renders split layout with tutorial on left and real-time ontology graph on right', async () => {
    const { container } = render(
      <RightDetailWorkbench
        asset={noteAsset}
        onToggleFavorite={vi.fn()}
        onEditAsset={vi.fn()}
        onDeleteAsset={vi.fn()}
      />
    );

    // Left tutorial title
    expect(screen.getAllByText(noteAsset.title).length).toBeGreaterThanOrEqual(1);

    // Right graph header
    expect(screen.getByText('本体图谱实时渲染')).toBeInTheDocument();

    // Draggable divider handle
    const resizer = container.querySelector('[title="拖拽调整教程与本体图谱宽度"]');
    expect(resizer).toBeInTheDocument();
  });

  it('toggles graph visibility when clicking the ontology graph button', async () => {
    render(
      <RightDetailWorkbench
        asset={noteAsset}
        onToggleFavorite={vi.fn()}
        onEditAsset={vi.fn()}
        onDeleteAsset={vi.fn()}
      />
    );

    const toggleBtn = screen.getByTitle(/收起右侧本体图谱/);
    expect(toggleBtn).toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(screen.queryByText('本体图谱实时渲染')).not.toBeInTheDocument();

    // Click again to expand
    const expandBtn = screen.getByTitle(/展开右侧本体图谱/);
    fireEvent.click(expandBtn);
    expect(screen.getByText('本体图谱实时渲染')).toBeInTheDocument();
  });

  it('renders hop count regulator with 2-hop active by default and allows switching hops', async () => {
    render(
      <RightDetailWorkbench
        asset={noteAsset}
        onToggleFavorite={vi.fn()}
        onEditAsset={vi.fn()}
        onDeleteAsset={vi.fn()}
      />
    );

    // Verify regulator label
    expect(screen.getByText('跳数')).toBeInTheDocument();

    // Verify all 4 hop options are present
    const hop1Btn = screen.getByRole('button', { name: '1跳' });
    const hop2Btn = screen.getByRole('button', { name: '2跳' });
    const hop3Btn = screen.getByRole('button', { name: '3跳' });
    const hopAllBtn = screen.getByRole('button', { name: '全图' });

    expect(hop1Btn).toBeInTheDocument();
    expect(hop2Btn).toBeInTheDocument();
    expect(hop3Btn).toBeInTheDocument();
    expect(hopAllBtn).toBeInTheDocument();

    // Default 2-hop button should have active highlight class
    expect(hop2Btn.className).toContain('bg-monokai-cyan');
    expect(hop1Btn.className).not.toContain('bg-monokai-cyan');

    // Switch to 3-hop
    fireEvent.click(hop3Btn);
    expect(hop3Btn.className).toContain('bg-monokai-cyan');
    expect(hop2Btn.className).not.toContain('bg-monokai-cyan');

    // Switch to 1-hop
    fireEvent.click(hop1Btn);
    expect(hop1Btn.className).toContain('bg-monokai-cyan');
    expect(hop3Btn.className).not.toContain('bg-monokai-cyan');

    // Switch to All
    fireEvent.click(hopAllBtn);
    expect(hopAllBtn.className).toContain('bg-monokai-cyan');
    expect(hop1Btn.className).not.toContain('bg-monokai-cyan');
  });
});
