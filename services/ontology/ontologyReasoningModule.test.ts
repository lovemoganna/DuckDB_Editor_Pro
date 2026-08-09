import { describe, expect, it, vi } from 'vitest';
import {
  createOntologyReasoningModule,
  createOntologySnapshot,
  discoverPropertyDefinitions,
  simulateOntology,
  validateOntologySnapshot,
  type OntologyActionDefinition,
  type OntologyPropertyDefinition,
  type OntologyRuleDefinition,
} from './ontologyReasoningModule';
import ecommerceSeed from '../../data/ontology/seed-ecommerce.json';
import healthSeed from '../../data/ontology/seed-health-tracker.json';

const properties: OntologyPropertyDefinition[] = [
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
  {
    id: 'property.payment.result',
    logicalId: 'property.payment.result',
    version: 1,
    objectTypeId: 2,
    key: 'result',
    name: '支付结果',
    valueType: 'string',
    nullable: true,
    status: 'active',
  },
];

const paidRule: OntologyRuleDefinition = {
  id: 'rule.order.paid.v1',
  logicalId: 'rule.order.paid',
  version: 1,
  name: '支付成功后订单已支付',
  status: 'active',
  priority: 0,
  variables: [
    { name: 'payment', objectTypeId: 2 },
    { name: 'order', objectTypeId: 1 },
  ],
  when: {
    kind: 'and',
    children: [
      {
        kind: 'relation',
        sourceVariable: 'payment',
        linkTypeId: 1,
        targetVariable: 'order',
        operator: 'exists',
      },
      {
        kind: 'property',
        variable: 'payment',
        propertyId: 'property.payment.result',
        operator: 'eq',
        value: 'success',
      },
    ],
  },
  effects: [{
    kind: 'set_property',
    variable: 'order',
    propertyId: 'property.order.status',
    value: 'paid',
  }],
};

const ontologyState = {
  activeTemplateId: 'lesson-0006',
  objectTypes: [
    { id: 1, name: '订单', description: '' },
    { id: 2, name: '支付事件', description: '' },
  ],
  objects: [
    { id: 10, object_type_id: 1, name: 'ORD-10', properties: '{"status":"pending"}', annotations: '' },
    { id: 20, object_type_id: 2, name: 'PAY-20', properties: '{"result":"success"}', annotations: '' },
  ],
  linkTypes: [{ id: 1, name: '驱动', description: '' }],
  links: [{ id: 100, link_type_id: 1, source_object_id: 20, target_object_id: 10, weight: 1 }],
  actions: [],
};

describe('OntologyReasoningModule public seam', () => {
  it('derives a result from real object properties and a directed real relation', () => {
    const snapshot = createOntologySnapshot(ontologyState, {
      propertyDefinitions: properties,
      rules: [paidRule],
      actionDefinitions: [],
    });

    const report = simulateOntology(snapshot, { assumptions: [], actions: [] });

    expect(report.modelIssues).toEqual([]);
    expect(report.branches).toHaveLength(1);
    expect(report.branches[0].properties).toEqual(expect.arrayContaining([
      expect.objectContaining({
        objectId: 10,
        propertyId: 'property.order.status',
        value: 'paid',
        origin: 'derived',
      }),
    ]));
    expect(report.branches[0].path).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: paidRule.id, binding: { payment: 20, order: 10 } }),
    ]));
  });

  it('evaluates a concrete target conclusion in every resulting world', () => {
    const snapshot = createOntologySnapshot(ontologyState, {
      propertyDefinitions: properties,
      rules: [paidRule],
      actionDefinitions: [],
    });

    const report = simulateOntology(snapshot, {
      assumptions: [],
      actions: [],
      goal: {
        condition: {
          kind: 'property', variable: 'order', propertyId: 'property.order.status', operator: 'eq', value: 'paid',
        },
        bindings: { order: 10 },
      },
    });

    expect(report.goalResults).toEqual([{ branchId: 'branch-1', truth: 'TRUE' }]);
  });

  it('limits rule bindings to worlds that include the selected focus object', () => {
    const snapshot = createOntologySnapshot({
      ...ontologyState,
      objects: [...ontologyState.objects, { id: 11, object_type_id: 1, name: 'ORD-11', properties: '{"status":"pending"}', annotations: '' }],
    }, { propertyDefinitions: properties, rules: [paidRule], actionDefinitions: [] });

    const report = simulateOntology(snapshot, { assumptions: [], actions: [], focusObjectIds: [11] });

    expect(report.branches[0].properties).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ objectId: 10, value: 'paid' }),
    ]));
  });

  it('does not treat an unknown property as false and reports the missing condition', () => {
    const unknownState = {
      ...ontologyState,
      objects: ontologyState.objects.map(object => object.id === 20
        ? { ...object, properties: '{}' }
        : object),
    };
    const report = simulateOntology(createOntologySnapshot(unknownState, {
      propertyDefinitions: properties,
      rules: [paidRule],
      actionDefinitions: [],
    }), { assumptions: [], actions: [] });

    expect(report.branches[0].properties).toEqual(expect.arrayContaining([
      expect.objectContaining({ objectId: 10, value: 'pending', origin: 'ontology' }),
    ]));
    expect(report.branches[0].properties).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ objectId: 10, value: 'paid' }),
    ]));
    expect(report.missingConditions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        ruleId: paidRule.id,
        objectId: 20,
        propertyId: 'property.payment.result',
        expected: 'success',
        actual: undefined,
        truth: 'UNKNOWN',
      }),
    ]));
    expect(report.counterfactuals).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: paidRule.id, distance: 1 }),
    ]));
  });

  it('treats an unrecorded relation as UNKNOWN rather than FALSE', () => {
    const snapshot = createOntologySnapshot({ ...ontologyState, links: [] }, {
      propertyDefinitions: properties,
      rules: [paidRule],
      actionDefinitions: [],
    });

    const report = simulateOntology(snapshot, { assumptions: [], actions: [] });

    expect(report.missingConditions).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: paidRule.id, truth: 'UNKNOWN' }),
    ]));
  });

  it('applies ordered structured actions without mutating the ontology snapshot', () => {
    const reviewAction: OntologyActionDefinition = {
      id: 'action.review.v1',
      logicalId: 'action.review',
      version: 1,
      name: '复核支付',
      status: 'active',
      variables: [{ name: 'payment', objectTypeId: 2 }],
      precondition: {
        kind: 'property',
        variable: 'payment',
        propertyId: 'property.payment.result',
        operator: 'eq',
        value: 'pending',
      },
      effects: [{
        kind: 'set_property',
        variable: 'payment',
        propertyId: 'property.payment.result',
        value: 'success',
      }],
    };
    const source = {
      ...ontologyState,
      objects: ontologyState.objects.map(object => object.id === 20
        ? { ...object, properties: '{"result":"pending"}' }
        : object),
    };
    const snapshot = createOntologySnapshot(source, {
      propertyDefinitions: properties,
      rules: [paidRule],
      actionDefinitions: [reviewAction],
    });

    const report = simulateOntology(snapshot, {
      assumptions: [],
      actions: [{ actionDefinitionId: reviewAction.id, bindings: { payment: 20 }, order: 1 }],
    });

    expect(report.branches[0].properties).toEqual(expect.arrayContaining([
      expect.objectContaining({ objectId: 10, value: 'paid', origin: 'derived' }),
    ]));
    expect(snapshot.objects.find(object => object.id === 20)?.properties.result).toBe('pending');
  });

  it('allows a rule instance to fire again after a later action changes its result', () => {
    const resetAction: OntologyActionDefinition = {
      id: 'action.reset.v1', logicalId: 'action.reset', version: 1, name: '重置订单', status: 'active',
      variables: [{ name: 'order', objectTypeId: 1 }],
      effects: [{ kind: 'set_property', variable: 'order', propertyId: 'property.order.status', value: 'pending' }],
    };
    const snapshot = createOntologySnapshot(ontologyState, {
      propertyDefinitions: properties,
      rules: [paidRule],
      actionDefinitions: [resetAction],
    });

    const report = simulateOntology(snapshot, {
      assumptions: [],
      actions: [{ actionDefinitionId: resetAction.id, bindings: { order: 10 }, order: 1 }],
    });

    expect(report.branches[0].properties.find(fact => fact.objectId === 10 && fact.propertyId === 'property.order.status')?.value).toBe('paid');
    expect(report.branches[0].path.filter(step => step.ruleId === paidRule.id)).toHaveLength(2);
  });

  it('branches on equal-priority conflicting effects and keeps both explanations', () => {
    const blockedRule: OntologyRuleDefinition = {
      ...paidRule,
      id: 'rule.order.blocked.v1',
      logicalId: 'rule.order.blocked',
      name: '同级冲突规则',
      effects: [{
        kind: 'set_property',
        variable: 'order',
        propertyId: 'property.order.status',
        value: 'blocked',
      }],
    };
    const snapshot = createOntologySnapshot(ontologyState, {
      propertyDefinitions: properties,
      rules: [paidRule, blockedRule],
      actionDefinitions: [],
    });

    const report = simulateOntology(snapshot, { assumptions: [], actions: [] });

    expect(report.branches).toHaveLength(2);
    expect(report.branches.map(branch => branch.properties.find(fact =>
      fact.objectId === 10 && fact.propertyId === 'property.order.status')?.value).sort()).toEqual([
      'blocked',
      'paid',
    ]);
    expect(report.conflicts[0].ruleIds.sort()).toEqual([blockedRule.id, paidRule.id].sort());
  });

  it('handles an equal-priority set versus unset conflict without crashing', () => {
    const unsetRule: OntologyRuleDefinition = {
      ...paidRule,
      id: 'rule.order.unset.v1', logicalId: 'rule.order.unset', name: '撤销订单状态',
      effects: [{ kind: 'unset_property', variable: 'order', propertyId: 'property.order.status' }],
    };
    const snapshot = createOntologySnapshot(ontologyState, {
      propertyDefinitions: properties,
      rules: [paidRule, unsetRule],
      actionDefinitions: [],
    });

    expect(() => simulateOntology(snapshot, { assumptions: [], actions: [] })).not.toThrow();
  });

  it('discovers stable property candidates from real JSON and flags incompatible values', () => {
    const discovered = discoverPropertyDefinitions({
      ...ontologyState,
      objects: [
        ontologyState.objects[0],
        { ...ontologyState.objects[0], id: 11, properties: '{"status":42,"amount":99}' },
      ],
    });

    expect(discovered).toEqual(expect.arrayContaining([
      expect.objectContaining({ objectTypeId: 1, key: 'amount', valueType: 'number', status: 'candidate' }),
      expect.objectContaining({ objectTypeId: 1, key: 'status', status: 'conflicted' }),
    ]));
  });

  it('persists immutable run snapshots and replays the recorded world', async () => {
    const rows: Array<Record<string, unknown>> = [];
    const database = {
      executeTransaction: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue([]),
      queryWithParams: vi.fn().mockImplementation(async (sql: string, params: unknown[]) => {
        if (sql.includes('INSERT INTO _sys_ontology_reasoning_run')) {
          rows.push({
            run_id: params[0],
            snapshot_json: params[2],
            scenario_json: params[3],
            report_json: params[4],
          });
        }
        if (sql.includes('WHERE run_id = ?')) return rows.filter(row => row.run_id === params[0]);
        return [];
      }),
    };
    const module = createOntologyReasoningModule(database);
    const snapshot = module.createSnapshot(ontologyState, {
      propertyDefinitions: properties,
      rules: [paidRule],
      actionDefinitions: [],
    });
    const scenario = { assumptions: [], actions: [] };
    const report = module.simulate(snapshot, scenario);

    await module.saveRun(snapshot, scenario, report);
    const replayed = await module.replayRun(report.runId);

    expect(replayed.branches[0].properties).toEqual(report.branches[0].properties);
    expect(database.executeTransaction).toHaveBeenCalled();
  });

  it('does not overwrite an existing logical definition version with different content', async () => {
    const storedFingerprint = 'already-stored';
    const database = {
      executeTransaction: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue([]),
      queryWithParams: vi.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT fingerprint')) return [{ fingerprint: storedFingerprint }];
        return [];
      }),
    };
    const module = createOntologyReasoningModule(database);

    await expect(module.saveCatalog({
      propertyDefinitions: properties,
      rules: [],
      actionDefinitions: [],
    })).rejects.toThrow('不可覆盖');

    expect(database.queryWithParams).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE'),
      expect.anything(),
    );
  });

  it('runs the same generic engine against two structurally different real ontology seeds', () => {
    const ecommerceCatalog = {
      propertyDefinitions: [{
        id: 'property.ecommerce.product.price', logicalId: 'property.ecommerce.product.price', version: 1,
        objectTypeId: 1, key: 'price', name: '商品价格', valueType: 'number' as const,
        nullable: false, status: 'active' as const,
      }],
      rules: [{
        id: 'rule.ecommerce.channel-product.v1', logicalId: 'rule.ecommerce.channel-product', version: 1,
        name: '渠道关联有价格商品', status: 'active' as const, priority: 0,
        variables: [{ name: 'channel', objectTypeId: 3 }, { name: 'product', objectTypeId: 1 }],
        when: {
          kind: 'and' as const,
          children: [
            { kind: 'relation' as const, sourceVariable: 'channel', linkTypeId: 1, targetVariable: 'product', operator: 'exists' as const },
            { kind: 'property' as const, variable: 'product', propertyId: 'property.ecommerce.product.price', operator: 'gt' as const, value: 0 },
          ],
        },
        effects: [{ kind: 'assert_conclusion' as const, predicate: 'channel_product_observed', variables: ['product'] }],
      }],
      actionDefinitions: [],
    };
    const healthCatalog = {
      propertyDefinitions: [{
        id: 'property.health.metric.current', logicalId: 'property.health.metric.current', version: 1,
        objectTypeId: 1, key: 'current', name: '当前指标', valueType: 'number' as const,
        nullable: false, status: 'active' as const,
      }],
      rules: [{
        id: 'rule.health.habit-metric.v1', logicalId: 'rule.health.habit-metric', version: 1,
        name: '习惯关联已记录指标', status: 'active' as const, priority: 0,
        variables: [{ name: 'habit', objectTypeId: 2 }, { name: 'metric', objectTypeId: 1 }],
        when: {
          kind: 'and' as const,
          children: [
            { kind: 'relation' as const, sourceVariable: 'habit', linkTypeId: 1, targetVariable: 'metric', operator: 'exists' as const },
            { kind: 'property' as const, variable: 'metric', propertyId: 'property.health.metric.current', operator: 'gt' as const, value: 0 },
          ],
        },
        effects: [{ kind: 'assert_conclusion' as const, predicate: 'habit_metric_observed', variables: ['metric'] }],
      }],
      actionDefinitions: [],
    };

    const ecommerce = simulateOntology(createOntologySnapshot(ecommerceSeed, ecommerceCatalog), { assumptions: [], actions: [] });
    const health = simulateOntology(createOntologySnapshot(healthSeed, healthCatalog), { assumptions: [], actions: [] });

    expect(ecommerce.branches[0].conclusions).toContain('channel_product_observed|1');
    expect(health.branches[0].conclusions).toContain('habit_metric_observed|1');
  });

  it('rejects inactive property references and reports derived-rule cycles', () => {
    const inactiveProperties = properties.map(property => property.id === 'property.payment.result'
      ? { ...property, status: 'candidate' as const }
      : property);
    const cycleA: OntologyRuleDefinition = {
      ...paidRule,
      id: 'rule.cycle.a.v1',
      logicalId: 'rule.cycle.a',
      name: '循环 A',
      when: { kind: 'derived', predicate: 'cycle_b', variables: ['order'], operator: 'exists' },
      effects: [{ kind: 'assert_conclusion', predicate: 'cycle_a', variables: ['order'] }],
      variables: [{ name: 'order', objectTypeId: 1 }],
    };
    const cycleB: OntologyRuleDefinition = {
      ...cycleA,
      id: 'rule.cycle.b.v1',
      logicalId: 'rule.cycle.b',
      name: '循环 B',
      when: { kind: 'derived', predicate: 'cycle_a', variables: ['order'], operator: 'exists' },
      effects: [{ kind: 'assert_conclusion', predicate: 'cycle_b', variables: ['order'] }],
    };
    const snapshot = createOntologySnapshot(ontologyState, {
      propertyDefinitions: inactiveProperties,
      rules: [paidRule, cycleA, cycleB],
      actionDefinitions: [],
    });

    const issues = validateOntologySnapshot(snapshot);

    expect(issues.some(issue => issue.includes('property.payment.result'))).toBe(true);
    expect(issues.some(issue => issue.includes('循环'))).toBe(true);
  });

  it('marks a report truncated when the rule-closure iteration limit stops a changing world', () => {
    const snapshot = createOntologySnapshot(ontologyState, {
      propertyDefinitions: properties,
      rules: [paidRule],
      actionDefinitions: [],
    });

    const report = simulateOntology(snapshot, { assumptions: [], actions: [] }, { maxRuleIterations: 1 });

    expect(report.truncated).toBe(true);
  });
});
