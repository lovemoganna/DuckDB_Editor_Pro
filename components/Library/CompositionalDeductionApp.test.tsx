import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompositionalDeductionApp } from './CompositionalDeductionApp';
import type { DeductionRequest, SemanticReconstruction } from '../../services/deduction/deductionTypes';

const engine = vi.hoisted(() => ({
  reconstructSemantics: vi.fn(),
  cancelSemanticReconstruction: vi.fn(() => true),
}));

vi.mock('../../services/deduction/semanticReconstructionEngine', () => engine);

const resultFor = (request: DeductionRequest): SemanticReconstruction => ({
  version: 1,
  input: request.input,
  features: [
    { id: 'F1', kind: 'entity', statement: '对象是客户', classification: 'fact', certainty: 'confirmed', entity: '客户', evidence: [{ quote: '客户', start: 0, end: 2 }] },
    { id: 'F2', kind: 'condition', statement: '年龄大于等于18岁', classification: 'fact', certainty: 'confirmed', attribute: '年龄', value: '18岁', evidence: [{ quote: '年龄大于等于18岁', start: 3, end: 12 }] },
  ],
  relations: [{
    id: 'R1', fromFeatureIds: ['F1'], toFeatureIds: ['F2'], type: 'condition', operator: 'AND',
    statement: '客户需满足年龄条件', certainty: 'confirmed', evidence: [{ quote: '客户年龄大于等于18岁', start: 0, end: 12 }],
  }],
  contexts: [],
  structure: {
    id: 'N1', type: 'operator', label: 'AND', operator: 'AND', children: [
      { id: 'N2', type: 'feature', label: '对象是客户', featureId: 'F1', children: [] },
      { id: 'N3', type: 'feature', label: '年龄大于等于18岁', featureId: 'F2', children: [] },
    ],
  },
  coreMeaning: { text: '表达客户需满足年龄条件。', supportingFeatureIds: ['F1', 'F2'], supportingRelationIds: ['R1'] },
  ...(request.externalMappingRequested ? {
    externalMappings: [{
      id: 'M1', targetKind: 'feature', targetId: 'F2', sourceId: 'S1', correspondingObject: '申请人年龄',
      correspondingContent: '年龄须满18岁', matchLevel: '直接对应',
      basis: { quote: '年龄须满18岁', start: 0, end: 7, sourceId: 'S1' }, validationNote: '对象和条件一致',
    }],
  } : {}),
  punchline: { text: '对象与条件通过明确约束组合。', supportingFeatureIds: ['F1', 'F2'], supportingRelationIds: ['R1'] },
  validation: { status: 'valid', issues: [] },
});

describe('CompositionalDeductionApp — 特征组合与语义还原器', () => {
  beforeEach(() => {
    localStorage.clear();
    engine.reconstructSemantics.mockReset();
    engine.reconstructSemantics.mockImplementation(async (request: DeductionRequest) => resultFor(request));
    engine.cancelSemanticReconstruction.mockClear();
  });

  afterEach(cleanup);

  it('preserves the public isOpen rendering contract', () => {
    const { container } = render(<CompositionalDeductionApp isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('uses text input as the primary experience and blocks an empty run', () => {
    render(<CompositionalDeductionApp isOpen />);
    expect(screen.getByRole('heading', { name: '特征组合与语义还原器' })).toBeTruthy();
    expect(screen.getByLabelText('原始输入')).toBeTruthy();
    expect(screen.getByRole('button', { name: '开始语义还原' }).hasAttribute('disabled')).toBe(true);
    expect(screen.queryByText('Ontology 特征选择')).toBeNull();
  });

  it('renders the fixed result sections in order and omits external mapping by default', async () => {
    render(<CompositionalDeductionApp isOpen />);
    fireEvent.change(screen.getByLabelText('原始输入'), { target: { value: '客户年龄大于等于18岁' } });
    fireEvent.click(screen.getByRole('button', { name: '开始语义还原' }));

    await screen.findByText('表达客户需满足年龄条件。');
    const headings = screen.getAllByRole('heading', { level: 2 }).map(node => node.textContent);
    expect(headings).toEqual(['1. 原始输入', '2. 特征', '3. 关系', '4. 结构', '5. 核心语义', '7. 一针见血解读']);
    expect(screen.queryByRole('heading', { name: '6. 外部映射' })).toBeNull();
    expect(screen.getAllByText('事实')).toHaveLength(2);
    expect(screen.getByText('原文证据：客户')).toBeTruthy();
  });

  it('requires named evidence and shows external mapping only when requested', async () => {
    render(<CompositionalDeductionApp isOpen />);
    fireEvent.change(screen.getByLabelText('原始输入'), { target: { value: '客户年龄大于等于18岁' } });
    fireEvent.click(screen.getByRole('checkbox', { name: '需要外部映射' }));
    expect(screen.getByRole('button', { name: '开始语义还原' }).hasAttribute('disabled')).toBe(true);

    fireEvent.change(screen.getByLabelText('依据名称 1'), { target: { value: '注册规则' } });
    fireEvent.change(screen.getByLabelText('依据内容 1'), { target: { value: '年龄须满18岁' } });
    fireEvent.click(screen.getByRole('button', { name: '开始语义还原' }));

    await screen.findByRole('heading', { name: '6. 外部映射' });
    expect(screen.getByText('直接对应')).toBeTruthy();
    expect(engine.reconstructSemantics).toHaveBeenCalledWith(expect.objectContaining({
      externalMappingRequested: true,
      sources: [expect.objectContaining({ title: '注册规则', content: '年龄须满18岁' })],
    }));
  });

  it('persists a successful run and restores it from recent history', async () => {
    render(<CompositionalDeductionApp isOpen />);
    fireEvent.change(screen.getByLabelText('原始输入'), { target: { value: '客户年龄大于等于18岁' } });
    fireEvent.click(screen.getByRole('button', { name: '开始语义还原' }));
    await screen.findByText('表达客户需满足年龄条件。');

    fireEvent.click(screen.getByRole('button', { name: '清空输入' }));
    expect((screen.getByLabelText('原始输入') as HTMLTextAreaElement).value).toBe('');
    fireEvent.click(screen.getByRole('button', { name: /恢复记录：客户年龄大于等于18岁/ }));
    await waitFor(() => expect((screen.getByLabelText('原始输入') as HTMLTextAreaElement).value).toBe('客户年龄大于等于18岁'));
    expect(screen.getByText('表达客户需满足年龄条件。')).toBeTruthy();
  });

  it('preserves input and exposes a clear error when AI reconstruction fails', async () => {
    engine.reconstructSemantics.mockRejectedValueOnce(new Error('AI API Key not configured'));
    render(<CompositionalDeductionApp isOpen />);
    fireEvent.change(screen.getByLabelText('原始输入'), { target: { value: '不可丢失的输入' } });
    fireEvent.click(screen.getByRole('button', { name: '开始语义还原' }));

    expect((await screen.findByRole('alert')).textContent).toContain('AI API Key not configured');
    expect((screen.getByLabelText('原始输入') as HTMLTextAreaElement).value).toBe('不可丢失的输入');
  });

  it('supports one-click insertion of DuckDB SQL query into editor', async () => {
    const onInsertToEditor = vi.fn();
    render(<CompositionalDeductionApp isOpen onInsertToEditor={onInsertToEditor} />);
    fireEvent.change(screen.getByLabelText('原始输入'), { target: { value: '客户年龄大于等于18岁' } });
    fireEvent.click(screen.getByRole('button', { name: '开始语义还原' }));

    await screen.findByText('表达客户需满足年龄条件。');
    const runSqlBtn = screen.getByRole('button', { name: '在编辑器中运行' });
    fireEvent.click(runSqlBtn);

    expect(onInsertToEditor).toHaveBeenCalledWith(expect.stringContaining('SELECT *'));
    expect(onInsertToEditor).toHaveBeenCalledWith(expect.stringContaining('年龄 = \'18岁\''));
  });
});

