import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompositionalDeductionApp } from './CompositionalDeductionApp';

const store = vi.hoisted(() => ({
  state: {
    activeTemplateId: 'ontology-real',
    objectTypes: [{ id: 1, name: '订单' }],
    objects: [
      { id: 10, object_type_id: 1, name: '订单 A', properties: { status: 'pending' } },
      { id: 11, object_type_id: 1, name: '订单 B', properties: { status: 'paid' } },
    ],
    linkTypes: [{ id: 3, name: '后续订单' }],
    links: [{ id: 30, link_type_id: 3, source_object_id: 10, target_object_id: 11 }], actions: [],
  },
  activeTemplateId: 'ontology-real',
}));

vi.mock('../../hooks/useOntologyStore', () => ({ useOntologyStore: () => store }));

const reasoning = vi.hoisted(() => ({
  initialize: vi.fn(), loadCatalog: vi.fn(), createSnapshot: vi.fn(),
  simulate: vi.fn(), saveRun: vi.fn(), replayRun: vi.fn(),
}));

vi.mock('../../services/ontology/ontologyReasoningModule', () => ({ ontologyReasoningModule: reasoning }));

const catalog = {
  propertyDefinitions: [{
    id: 'property.order.status', logicalId: 'property.order.status', version: 1,
    objectTypeId: 1, key: 'status', name: '订单状态', valueType: 'string',
    nullable: false, status: 'active',
  }],
  rules: [], actionDefinitions: [{
    id: 'action.ship', logicalId: 'action.ship', version: 1, name: '发货', status: 'active',
    variables: [{ name: 'order', objectTypeId: 1 }], effects: [],
  }],
};

const report = {
  runId: 'run-1', generatedAt: '2026-08-12T00:00:00Z', snapshotId: 'snapshot-1',
  modelIssues: [], existingProperties: [{ objectId: 10, propertyId: 'property.order.status', value: 'pending', origin: 'ontology' }],
  existingRelations: [{ sourceObjectId: 10, linkTypeId: 3, targetObjectId: 11, origin: 'ontology' }],
  branches: [{
    id: 'branch-1',
    properties: [{ objectId: 10, propertyId: 'property.order.status', value: 'shipped', origin: 'derived', sourceId: 'rule.ship' }],
    relations: [{ sourceObjectId: 10, linkTypeId: 3, targetObjectId: 11, origin: 'derived', sourceId: 'rule.ship' }],
    conclusions: ['ready|10'], path: [], proofs: [{
      target: 'conclusion:ready|10',
      steps: [{ kind: 'rule', label: '可发货', ruleId: 'rule.ship', ruleVersion: 1, binding: { order: 10 }, evidence: ['object:10'], changes: ['派生结论 ready|10'] }],
    }],
  }],
  conflicts: [], missingConditions: [], counterfactuals: [], goalResults: [], truncated: false,
  limits: { maxRuleIterations: 20, maxBranches: 200, maxCounterfactualDistance: 3 },
};

describe('CompositionalDeductionApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reasoning.initialize.mockResolvedValue(undefined);
    reasoning.loadCatalog.mockResolvedValue(catalog);
    reasoning.createSnapshot.mockReturnValue({ snapshotId: 'snapshot-1', catalog });
    reasoning.simulate.mockReturnValue(report);
    reasoning.saveRun.mockResolvedValue(undefined);
    reasoning.replayRun.mockResolvedValue(report);
  });
  afterEach(cleanup);

  it('uses the native snapshot simulator and persists an immutable run', async () => {
    render(<CompositionalDeductionApp isOpen />);
    await screen.findByText('订单 A (#10)');
    fireEvent.click(screen.getByRole('button', { name: '开始推演' }));

    await waitFor(() => expect(reasoning.simulate).toHaveBeenCalled());
    expect(reasoning.simulate.mock.calls[0][2]).toEqual({
      maxRuleIterations: 20, maxBranches: 200, maxCounterfactualDistance: 3,
    });
    expect(reasoning.saveRun).toHaveBeenCalledWith(
      expect.objectContaining({ snapshotId: 'snapshot-1' }),
      expect.objectContaining({ assumptions: [], actions: [] }),
      report,
    );
    expect(screen.getByText(/系统只能回答当前已存在的事实/)).toBeTruthy();
    expect(screen.getByText(/订单 A · 订单状态 = pending/)).toBeTruthy();
    expect(screen.getAllByText(/订单 A -\[后续订单\]-> 订单 B/).length).toBeGreaterThan(0);
    expect(screen.getByText(/订单 A · 订单状态 = shipped/)).toBeTruthy();
    expect(screen.getAllByText(/ready\(订单 A\)/).length).toBeGreaterThan(0);
    expect(screen.getByText('逐结论证明')).toBeTruthy();
  });

  it('lets the user bind every action variable to a concrete real object', async () => {
    render(<CompositionalDeductionApp isOpen />);
    await screen.findByText('订单 A (#10)');
    fireEvent.click(screen.getByRole('checkbox', { name: /发货/ }));
    fireEvent.change(screen.getByRole('combobox', { name: '发货 · order 绑定对象' }), { target: { value: '11' } });
    fireEvent.click(screen.getByRole('button', { name: '开始推演' }));
    await waitFor(() => expect(reasoning.simulate).toHaveBeenCalled());
    expect(reasoning.simulate.mock.calls.at(-1)?.[1].actions[0].bindings).toEqual({ order: 11 });
  });

  it('supports relation and derived-conclusion goals with independent bindings', async () => {
    render(<CompositionalDeductionApp isOpen />);
    await screen.findByText('订单 A (#10)');
    fireEvent.click(screen.getByRole('checkbox', { name: '指定目标' }));
    fireEvent.change(screen.getByRole('combobox', { name: '目标类型' }), { target: { value: 'relation' } });
    fireEvent.change(screen.getByRole('combobox', { name: '目标关系源对象' }), { target: { value: '11' } });
    fireEvent.click(screen.getByRole('button', { name: '开始推演' }));
    await waitFor(() => expect(reasoning.simulate).toHaveBeenCalled());
    expect(reasoning.simulate.mock.calls.at(-1)?.[1].goal).toEqual({
      condition: { kind: 'relation', sourceVariable: 'source', linkTypeId: 3, targetVariable: 'target', operator: 'exists' },
      bindings: { source: 11, target: 11 },
    });

    fireEvent.change(screen.getByRole('combobox', { name: '目标类型' }), { target: { value: 'derived' } });
    fireEvent.change(screen.getByRole('textbox', { name: '目标结论名称' }), { target: { value: 'approved' } });
    fireEvent.click(screen.getByRole('checkbox', { name: '订单 A' }));
    fireEvent.click(screen.getByRole('button', { name: '开始推演' }));
    await waitFor(() => expect(reasoning.simulate).toHaveBeenCalledTimes(2));
    expect(reasoning.simulate.mock.calls.at(-1)?.[1].goal.condition.kind).toBe('derived');
    expect(reasoning.simulate.mock.calls.at(-1)?.[1].goal.condition.predicate).toBe('approved');
  });

  it('adds a real property assumption without mutating the ontology store', async () => {
    render(<CompositionalDeductionApp isOpen />);
    await screen.findByText('订单 A (#10)');
    fireEvent.change(screen.getByRole('textbox', { name: '假设值' }), { target: { value: 'paid' } });
    fireEvent.click(screen.getByRole('button', { name: /添加属性假设/ }));
    fireEvent.click(screen.getByRole('button', { name: '开始推演' }));

    await waitFor(() => expect(reasoning.simulate).toHaveBeenCalled());
    expect(reasoning.simulate.mock.calls.at(-1)?.[1].assumptions).toEqual([{
      kind: 'set_property', objectId: 10, propertyId: 'property.order.status', value: 'paid',
    }]);
    expect(store.state.objects[0].properties.status).toBe('pending');
  });

  it('replays a saved run from its original snapshot', async () => {
    render(<CompositionalDeductionApp isOpen />);
    await screen.findByText('订单 A (#10)');
    fireEvent.click(screen.getByRole('button', { name: '开始推演' }));
    const replayButton = await screen.findByRole('button', { name: '按原始快照重放' });
    fireEvent.click(replayButton);
    await waitFor(() => expect(reasoning.replayRun).toHaveBeenCalledWith('run-1'));
  });

  it('does not render while closed', () => {
    const { container } = render(<CompositionalDeductionApp isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });
});
