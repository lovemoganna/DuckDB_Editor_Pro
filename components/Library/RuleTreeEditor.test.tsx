import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RuleTreeEditor } from './RuleTreeEditor';
import type { FeatureDefinition, RuleDefinition } from '../../services/ontology/ontologyInferenceEngine';

const mockFeatures: FeatureDefinition[] = [
  {
    id: 'feat_amount',
    logicalId: 'l_amount',
    version: 1,
    name: '交易金额',
    description: '单笔交易金额',
    valueType: 'number',
    objectTypeId: 1,
    source: { kind: 'column', table: 'tx', column: 'amount' },
    nullSemantics: '默认 NULL',
    status: 'active',
  },
  {
    id: 'feat_fast',
    logicalId: 'l_fast',
    version: 1,
    name: '快进快出',
    description: '是否快进快出',
    valueType: 'boolean',
    objectTypeId: 1,
    source: { kind: 'column', table: 'tx', column: 'fast_in_out' },
    nullSemantics: '默认 NULL',
    status: 'active',
  },
];

const mockRule: RuleDefinition = {
  id: 'rule_1',
  logicalId: 'l_rule_1',
  version: 1,
  name: '高风险检测规则',
  description: '检测异常大额交易',
  status: 'draft',
  root: {
    kind: 'and',
    nodeId: 'root_node',
    children: [
      {
        kind: 'condition',
        nodeId: 'c1',
        featureId: 'feat_amount',
        operator: 'gt',
        value: 100000,
      },
    ],
  },
};

afterEach(cleanup);

describe('RuleTreeEditor', () => {
  it('renders rule editor header and Undo/Redo buttons', () => {
    const handleRuleChange = vi.fn();
    render(
      <RuleTreeEditor
        rule={mockRule}
        features={mockFeatures}
        availableRules={[]}
        validationReport={{ valid: true, errors: [], warnings: [], maxDepth: 1 }}
        onRuleChange={handleRuleChange}
      />,
    );

    expect(screen.getByDisplayValue('高风险检测规则')).toBeTruthy();
    const undoBtn = screen.getByRole('button', { name: '撤销' });
    const redoBtn = screen.getByRole('button', { name: '重做' });

    expect(undoBtn).toBeTruthy();
    expect(redoBtn).toBeTruthy();
    expect(undoBtn.hasAttribute('disabled')).toBe(true);
    expect(redoBtn.hasAttribute('disabled')).toBe(true);
  });

  it('enables Undo when node is modified and restores state on click', () => {
    let currentRule = { ...mockRule };
    const handleRuleChange = vi.fn(updated => {
      currentRule = updated;
    });

    const { rerender } = render(
      <RuleTreeEditor
        rule={currentRule}
        features={mockFeatures}
        availableRules={[]}
        validationReport={{ valid: true, errors: [], warnings: [], maxDepth: 1 }}
        onRuleChange={handleRuleChange}
      />,
    );

    const toggleBtn = screen.getByRole('button', { name: /Toggle Logic|切换为/ });
    fireEvent.click(toggleBtn);

    expect(handleRuleChange).toHaveBeenCalled();
    const nextRoot = handleRuleChange.mock.calls[0][0].root;
    expect(nextRoot.kind).toBe('or');

    rerender(
      <RuleTreeEditor
        rule={currentRule}
        features={mockFeatures}
        availableRules={[]}
        validationReport={{ valid: true, errors: [], warnings: [], maxDepth: 1 }}
        onRuleChange={handleRuleChange}
      />,
    );

    const undoBtn = screen.getByRole('button', { name: '撤销' });
    expect(undoBtn.hasAttribute('disabled')).toBe(false);

    fireEvent.click(undoBtn);
    expect(handleRuleChange.mock.calls[1][0].root.kind).toBe('and');
  });

  it('opens Chinese Lisp import modal and validates balanced parentheses', () => {
    const handleRuleChange = vi.fn();
    render(
      <RuleTreeEditor
        rule={mockRule}
        features={mockFeatures}
        availableRules={[]}
        validationReport={{ valid: true, errors: [], warnings: [], maxDepth: 1 }}
        onRuleChange={handleRuleChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /导入 Lisp/ }));

    expect(screen.getByText(/中文 Lisp 表达式导入与智能语法校验/)).toBeTruthy();

    const textarea = screen.getByRole('textbox', { name: 'Lisp Expression Input' });

    fireEvent.change(textarea, { target: { value: '(高风险检测规则 (AND (快进快出 是) (交易金额 大于 100000)' } });

    expect(screen.getByText(/括号未闭合/)).toBeTruthy();
    const autoCompleteBtn = screen.getByRole('button', { name: /一键补全括号/ });
    expect(autoCompleteBtn).toBeTruthy();

    fireEvent.click(autoCompleteBtn);

    expect((textarea as HTMLTextAreaElement).value).toBe('(高风险检测规则 (AND (快进快出 是) (交易金额 大于 100000)))');
    expect(screen.getByText(/括号与语法校验通过/)).toBeTruthy();

  });

});
