import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OntologyReasoningCatalog } from '../../services/ontology/ontologyReasoningModule';
import { OntologyCombinationExplorer } from './OntologyCombinationExplorer';

const inferenceMocks = vi.hoisted(() => ({
  initialize: vi.fn(),
  loadWorkspace: vi.fn(),
}));

vi.mock('../../services/ontology/ontologyInferenceModule', () => ({
  ontologyInferenceModule: inferenceMocks,
}));

const source = {
  activeTemplateId: 'ui-native-test',
  objectTypes: [{ id: 1, name: '订单' }, { id: 2, name: '支付事件' }],
  objects: [
    { id: 10, object_type_id: 1, name: '订单 A', properties: { status: 'pending' } },
    { id: 20, object_type_id: 2, name: '支付 A', properties: { result: 'success' } },
  ],
  linkTypes: [{ id: 7, name: '支付驱动订单' }],
  links: [{ id: 70, link_type_id: 7, source_object_id: 20, target_object_id: 10 }],
  actions: [],
};

const catalog: OntologyReasoningCatalog = {
  propertyDefinitions: [{
    id: 'property.order.status',
    logicalId: 'property.order.status',
    version: 1,
    objectTypeId: 1,
    key: 'status',
    name: '订单状态',
    valueType: 'string',
    nullable: false,
    status: 'active',
  }],
  rules: [],
  actionDefinitions: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  inferenceMocks.initialize.mockResolvedValue(undefined);
  inferenceMocks.loadWorkspace.mockResolvedValue({ features: [], rules: [], outcomes: [] });
});

afterEach(cleanup);

describe('OntologyCombinationExplorer', () => {
  it('shows real features and labels unvalidated combinations as possible with missing evidence', async () => {
    render(<OntologyCombinationExplorer source={source} catalog={catalog} />);

    expect(screen.getByText('订单状态')).toBeTruthy();
    expect(screen.getByText(/接收关系：支付驱动订单/)).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: /接收关系：支付驱动订单/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /发出关系：支付驱动订单/ }));
    fireEvent.click(screen.getByRole('button', { name: '生成并验证组合' }));

    await waitFor(() => expect(screen.getAllByText('可能出现').length).toBeGreaterThan(0));
    expect(screen.getAllByText(/逻辑候选，尚无真实对象状态支持/).length).toBeGreaterThan(0);
    expect(screen.getByText('缺失证据')).toBeTruthy();
    expect(screen.queryByText(/风险模板/)).toBeNull();
  });
});
