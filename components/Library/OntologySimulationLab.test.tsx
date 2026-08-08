import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  OntologyPropertyDefinition,
  OntologyRuleDefinition,
} from '../../services/ontology/ontologyReasoningModule';
import { OntologySimulationLab } from './OntologySimulationLab';

const propertyDefinitions: OntologyPropertyDefinition[] = [
  {
    id: 'property.order.status',
    logicalId: 'property.order.status',
    version: 1,
    objectTypeId: 1,
    key: 'status',
    name: '订单状态',
    valueType: 'string',
    nullable: false,
    status: 'active',
  },
];

const rules: OntologyRuleDefinition[] = [{
  id: 'rule.order.ready.v1',
  logicalId: 'rule.order.ready',
  version: 1,
  name: '订单待支付后可备货',
  status: 'active',
  priority: 0,
  variables: [{ name: 'order', objectTypeId: 1 }],
  when: {
    kind: 'property',
    variable: 'order',
    propertyId: 'property.order.status',
    operator: 'eq',
    value: 'pending',
  },
  effects: [{
    kind: 'assert_conclusion',
    predicate: 'ready_to_prepare',
    variables: ['order'],
  }],
}];

const reasoningMocks = vi.hoisted(() => ({
  initialize: vi.fn(),
  loadCatalog: vi.fn(),
  saveCatalog: vi.fn(),
  saveRun: vi.fn(),
  replayRun: vi.fn(),
}));

vi.mock('../../services/ontology/ontologyReasoningModule', async importOriginal => {
  const actual = await importOriginal<typeof import('../../services/ontology/ontologyReasoningModule')>();
  return {
    ...actual,
    ontologyReasoningModule: {
      ...reasoningMocks,
      createSnapshot: actual.createOntologySnapshot,
      validateModel: actual.validateOntologySnapshot,
      simulate: actual.simulateOntology,
    },
  };
});

const ontologyState = {
  activeTemplateId: 'lesson-0006',
  objectTypes: [{ id: 1, name: '订单', description: '' }],
  objects: [{
    id: 10,
    object_type_id: 1,
    name: 'ORD-10',
    properties: '{"status":"pending"}',
    annotations: '',
  }],
  linkTypes: [],
  links: [],
  actions: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  reasoningMocks.initialize.mockResolvedValue(undefined);
  reasoningMocks.loadCatalog.mockResolvedValue({
    propertyDefinitions,
    rules,
    actionDefinitions: [],
  });
  reasoningMocks.saveCatalog.mockResolvedValue(undefined);
  reasoningMocks.saveRun.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe('OntologySimulationLab', () => {
  it('shows one ontology-native three-part workbench using real ontology data', async () => {
    render(<OntologySimulationLab ontologyState={ontologyState} onClose={() => undefined} />);

    expect(await screen.findByRole('heading', { name: '组合推演' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '1. 选择世界' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '2. 设置场景' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '3. 解释结果' })).toBeTruthy();
    expect(screen.getAllByText('ORD-10').length).toBeGreaterThan(0);
    expect(screen.getByText('订单待支付后可备货')).toBeTruthy();
    expect(screen.queryByText('安装风控模板')).toBeNull();
    expect(screen.queryByText('特征目录')).toBeNull();
  });

  it('runs from the real snapshot and saves an immutable read-only report', async () => {
    render(<OntologySimulationLab ontologyState={ontologyState} onClose={() => undefined} />);
    const run = await screen.findByRole('button', { name: '开始推演' });
    fireEvent.click(run);

    expect(await screen.findByText('ready_to_prepare|10')).toBeTruthy();
    expect(screen.getByText(/规则路径/)).toBeTruthy();
    await waitFor(() => expect(reasoningMocks.saveRun).toHaveBeenCalledTimes(1));
    const savedReport = reasoningMocks.saveRun.mock.calls[0][2];
    reasoningMocks.replayRun.mockResolvedValue(savedReport);
    fireEvent.click(screen.getByRole('button', { name: '按原始快照重放' }));
    await waitFor(() => expect(reasoningMocks.replayRun).toHaveBeenCalledWith(savedReport.runId));
    expect(ontologyState.objects[0].properties).toBe('{"status":"pending"}');
  });

  it('explains that an ontology without structured rules can only show current facts', async () => {
    reasoningMocks.loadCatalog.mockResolvedValue({
      propertyDefinitions,
      rules: [],
      actionDefinitions: [],
    });
    render(<OntologySimulationLab ontologyState={ontologyState} onClose={() => undefined} />);

    expect(await screen.findByText(/当前 Ontology 还没有可执行的结构化规则/)).toBeTruthy();
    expect(screen.getByText(/只能回答“什么已经存在”/)).toBeTruthy();
  });

  it('adds a property assumption without writing it back to the ontology', async () => {
    render(<OntologySimulationLab ontologyState={ontologyState} onClose={() => undefined} />);
    await waitFor(() => expect(screen.getAllByText('ORD-10').length).toBeGreaterThan(0));
    fireEvent.change(screen.getByLabelText('假设值'), { target: { value: 'cancelled' } });
    fireEvent.click(screen.getByRole('button', { name: '添加属性假设' }));
    fireEvent.click(screen.getByRole('button', { name: '开始推演' }));

    expect(await screen.findByText('cancelled')).toBeTruthy();
    expect(ontologyState.objects[0].properties).toContain('pending');
  });
});
