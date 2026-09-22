import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RulePreviewPanel } from './RulePreviewPanel';
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

const mockSubRule: RuleDefinition = {
  id: 'sub_rule_1',
  logicalId: 'l_sub_1',
  version: 1,
  name: '基础风险指标',
  description: '子规则风险指标',
  status: 'active',
  root: {
    kind: 'condition',
    nodeId: 'sub_c1',
    featureId: 'feat_fast',
    operator: 'is_true',
  },
};

const mockRule: RuleDefinition = {
  id: 'rule_main',
  logicalId: 'l_main',
  version: 1,
  name: '复合风控规则',
  description: '检测复合风险',
  status: 'active',
  root: {
    kind: 'and',
    nodeId: 'main_root',
    children: [
      {
        kind: 'condition',
        nodeId: 'main_c1',
        featureId: 'feat_amount',
        operator: 'gt',
        value: 50000,
      },
      {
        kind: 'ruleRef',
        nodeId: 'ref_1',
        ruleId: 'sub_rule_1',
      },
    ],
  },
};

afterEach(cleanup);

describe('RulePreviewPanel', () => {
  it('renders Auto-Fill and Clear sample data buttons and updates inputs', () => {
    render(
      <RulePreviewPanel
        rule={mockRule}
        features={mockFeatures}
        availableRules={[mockSubRule]}
      />,
    );

    const autoFillBtn = screen.getByRole('button', { name: '一键填入随机测试数据' });
    const clearBtn = screen.getByRole('button', { name: '清空测试数据' });

    expect(autoFillBtn).toBeTruthy();
    expect(clearBtn).toBeTruthy();

    const amountInput = screen.getByPlaceholderText(/输入 number 值/) as HTMLInputElement;
    expect(amountInput.value).toBe('');

    // Click Auto-Fill
    fireEvent.click(autoFillBtn);
    expect(amountInput.value).not.toBe('');

    // Click Clear
    fireEvent.click(clearBtn);
    expect(amountInput.value).toBe('');
  });

  it('renders expandable sub-rule AST trace breakdown in dry-run evaluation', () => {
    render(
      <RulePreviewPanel
        rule={mockRule}
        features={mockFeatures}
        availableRules={[mockSubRule]}
      />,
    );

    const autoFillBtn = screen.getByRole('button', { name: '一键填入随机测试数据' });
    fireEvent.click(autoFillBtn);

    // Expect sub-rule trace badge
    expect(screen.getByText('[子规则 AST 拆解]')).toBeTruthy();

    // Check expand/collapse buttons
    const expandAllBtn = screen.getByRole('button', { name: '全部展开' });
    const collapseAllBtn = screen.getByRole('button', { name: '全部折叠' });
    expect(expandAllBtn).toBeTruthy();
    expect(collapseAllBtn).toBeTruthy();

    fireEvent.click(collapseAllBtn);
    fireEvent.click(expandAllBtn);
  });
});
