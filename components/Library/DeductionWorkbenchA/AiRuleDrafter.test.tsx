// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiRuleDrafter } from './AiRuleDrafter';
import type { FeatureDefinition } from '../../../services/ontology/ontologyInferenceEngine';

afterEach(cleanup);

const mockFeatures: FeatureDefinition[] = [
  {
    id: 'feat_amount',
    name: '交易金额',
    sourceColumn: 'amount',
    valueType: 'number',
    expression: 'amount',
  },
  {
    id: 'feat_is_fraud',
    name: '是否异常',
    sourceColumn: 'is_fraud',
    valueType: 'boolean',
    expression: 'is_fraud',
  },
];

describe('AiRuleDrafter', () => {
  it('renders input and generate button', () => {
    render(<AiRuleDrafter features={mockFeatures} onRuleGenerated={vi.fn()} />);
    expect(screen.getByPlaceholderText(/用中文描述想要推演的特征组合逻辑/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /生成规则 AST/i })).toBeInTheDocument();
  });

  it('generates AST rule with parsed numerical threshold and comparison operator', async () => {
    const handleRuleGenerated = vi.fn();
    render(<AiRuleDrafter features={mockFeatures} onRuleGenerated={handleRuleGenerated} />);

    const input = screen.getByRole('textbox', { name: 'AI 规则描述' });
    fireEvent.change(input, { target: { value: '交易金额大于等于5000' } });

    const btn = screen.getByRole('button', { name: /生成规则 AST/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(handleRuleGenerated).toHaveBeenCalledTimes(1);
    });

    const [ruleName, rootAst] = handleRuleGenerated.mock.calls[0];
    expect(ruleName).toContain('AI起草');
    expect(rootAst).toBeDefined();
    expect(rootAst.kind === 'condition' || rootAst.kind === 'and').toBe(true);
    if (rootAst.kind === 'condition') {
      expect(rootAst.featureId).toBe('feat_amount');
      expect(rootAst.operator).toBe('gte');
      expect(rootAst.value).toBe(5000);
    }
  });

  it('handles preset prompts click', () => {
    render(<AiRuleDrafter features={mockFeatures} onRuleGenerated={vi.fn()} />);
    const presetBtn = screen.getByRole('button', { name: /推演数值大于 10000 且状态异常的复合情形/i });
    fireEvent.click(presetBtn);

    const input = screen.getByRole('textbox', { name: 'AI 规则描述' }) as HTMLInputElement;
    expect(input.value).toBe('推演数值大于 10000 且状态异常的复合情形');
  });
});
