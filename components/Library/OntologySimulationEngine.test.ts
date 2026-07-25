import { describe, expect, it } from 'vitest';
import lesson0002 from '../../data/ontology/seed-lesson-0002.json';
import lesson0004 from '../../data/ontology/seed-lesson-0004.json';
import lesson0006 from '../../data/ontology/seed-lesson-0006.json';
import lesson0013 from '../../data/ontology/seed-lesson-0013.json';
import {
  buildScenarioComparison,
  createDefaultScenario,
  deriveSimulationRules,
  runOntologySimulation,
} from './OntologySimulationEngine';

describe('ontology simulation engine', () => {
  it('combines a tutorial event, property, relation, rule, action and time into an explainable state timeline', () => {
    const rules = deriveSimulationRules(lesson0006);
    const scenario = {
      ...createDefaultScenario('scenario-a', lesson0006),
      sourceObjectId: 2,
      targetObjectId: 1,
      propertyKey: 'gateway',
      propertyOperator: 'equals' as const,
      propertyValue: 'WeChatPay',
      linkTypeId: 1,
      actionId: 1,
      selectedRuleIds: rules.map(rule => rule.id),
      timeOffsetHours: 6,
    };

    const result = runOntologySimulation(lesson0006, scenario);

    expect(result.status).toBe('possible');
    expect(result.exclusions).toEqual([]);
    expect(result.timeline.map(step => step.title)).toEqual([
      '读取初始状态',
      '验证关系路径',
      '评估规则',
      '执行动作',
    ]);
    expect(result.triggeredRules.map(rule => rule.title)).toContain('状态机设计');
    expect(result.stateChanges).toContainEqual(
      expect.objectContaining({
        objectId: 1,
        property: 'status',
        before: 'Paid',
        after: 'Fulfilling',
      }),
    );
    expect(result.finalOutcome.summary).toContain('触发自动履约发货');
    expect(result.finalOutcome.summary).toContain('status：Paid → Fulfilling');
    expect(result.finalOutcome.evidenceLevel).toBe('direct');
  });

  it('automatically excludes a relation used in a direction not supported by the tutorial topology', () => {
    const scenario = {
      ...createDefaultScenario('scenario-invalid-relation', lesson0006),
      sourceObjectId: 1,
      targetObjectId: 2,
      linkTypeId: 1,
      actionId: null,
    };

    const result = runOntologySimulation(lesson0006, scenario);

    expect(result.status).toBe('excluded');
    expect(result.exclusions).toContainEqual(
      expect.objectContaining({ code: 'relation_direction_mismatch' }),
    );
    expect(result.timeline).toEqual([]);
  });

  it('allows discovery of an unseen relation when the tutorial already proves the same source and target type pairing', () => {
    const data = {
      objects: [
        { id: 1, object_type_id: 1, name: '供应商-A', properties: '{}' },
        { id: 2, object_type_id: 1, name: '供应商-B', properties: '{}' },
        { id: 3, object_type_id: 2, name: '采购流程', properties: '{}' },
      ],
      objectTypes: [
        { id: 1, name: '供应商' },
        { id: 2, name: '流程' },
      ],
      linkTypes: [{ id: 1, name: '参与流程' }],
      links: [{
        id: 1,
        link_type_id: 1,
        source_object_id: 1,
        target_object_id: 3,
        weight: 0.8,
      }],
      actions: [],
      introspections: [],
      insights: [],
    };
    const scenario = {
      ...createDefaultScenario('scenario-type-compatible', data),
      sourceObjectId: 2,
      targetObjectId: 3,
      propertyKey: null,
      linkTypeId: 1,
      actionId: null,
    };

    const result = runOntologySimulation(data, scenario);

    expect(result.status).toBe('possible');
    expect(result.exclusions).toEqual([]);
    expect(result.finalOutcome.summary).toContain('供应商-B');
  });

  it('automatically excludes an attribute condition that the source object does not satisfy', () => {
    const scenario = {
      ...createDefaultScenario('scenario-invalid-property', lesson0006),
      sourceObjectId: 2,
      targetObjectId: 1,
      propertyKey: 'gateway',
      propertyOperator: 'equals' as const,
      propertyValue: 'Alipay',
      linkTypeId: 1,
      actionId: null,
    };

    const result = runOntologySimulation(lesson0006, scenario);

    expect(result.status).toBe('excluded');
    expect(result.exclusions).toContainEqual(
      expect.objectContaining({ code: 'property_condition_failed' }),
    );
  });

  it('keeps t+0 as observation-only and does not execute the selected action', () => {
    const scenario = {
      ...createDefaultScenario('scenario-now', lesson0006),
      sourceObjectId: 2,
      targetObjectId: 1,
      linkTypeId: 1,
      actionId: 1,
      timeOffsetHours: 0,
    };

    const result = runOntologySimulation(lesson0006, scenario);

    expect(result.status).toBe('possible');
    expect(result.timeline.map(step => step.title)).toEqual([
      '读取初始状态',
      '验证关系路径',
      '评估规则',
      '等待时间条件',
    ]);
    expect(result.stateChanges).toEqual([]);
    expect(result.finalOutcome.summary).toContain('t+0h 只观察');
  });

  it('derives a non-status property change from the tutorial action text', () => {
    const scenario = {
      ...createDefaultScenario('lesson-2-effect', lesson0002),
      targetObjectId: 2,
      linkTypeId: 2,
      actionId: 1,
    };
    const result = runOntologySimulation(lesson0002, scenario);

    expect(result.stateChanges).toEqual([
      expect.objectContaining({
        objectId: 2,
        objectName: '包裹B',
        property: '保管人',
        after: '小林',
      }),
    ]);
  });

  it('attributes a described state change to the affected object rather than the action owner', () => {
    const scenario = createDefaultScenario('lesson-4-effect', lesson0004);
    const result = runOntologySimulation(lesson0004, scenario);

    expect(result.stateChanges).toEqual([
      expect.objectContaining({
        objectId: 3,
        objectName: '年度采购框架协议.pdf',
        property: 'status',
        after: 'Legal_Binding',
      }),
    ]);
  });

  it('surfaces competing evidence as a rule conflict and applies the tutorial action outcome', () => {
    const rules = deriveSimulationRules(lesson0013);
    const scenario = {
      ...createDefaultScenario('scenario-conflict', lesson0013),
      sourceObjectId: 1,
      targetObjectId: 2,
      propertyKey: 'status',
      propertyOperator: 'equals' as const,
      propertyValue: 'Under_Audit',
      linkTypeId: 1,
      actionId: 1,
      selectedRuleIds: rules.map(rule => rule.id),
      timeOffsetHours: 24,
    };

    const result = runOntologySimulation(lesson0013, scenario);

    expect(result.status).toBe('conflicted');
    expect(result.conflicts).toContainEqual(
      expect.objectContaining({
        code: 'competing_evidence',
        kind: 'evidence',
        relatedObjectNames: expect.arrayContaining([
          '自报财报:净利润增长20%',
          '法院公告:存在被执行案款￥1,500万',
        ]),
      }),
    );
    expect(result.stateChanges).toContainEqual(
      expect.objectContaining({
        objectId: 1,
        property: 'status',
        before: 'Under_Audit',
        after: 'Blacklisted',
      }),
    );
    expect(result.finalOutcome.evidenceLevel).toBe('contested');
    expect(result.conflicts[0].relatedRuleIds).toEqual(
      expect.arrayContaining(rules.map(rule => rule.id)),
    );
  });

  it('keeps evidence conflicts visible when no tutorial rule is selected', () => {
    const scenario = {
      ...createDefaultScenario('scenario-no-rules', lesson0013),
      sourceObjectId: 1,
      targetObjectId: 2,
      linkTypeId: 1,
      actionId: 1,
      selectedRuleIds: [],
      timeOffsetHours: 24,
    };

    const result = runOntologySimulation(lesson0013, scenario);

    expect(result.triggeredRules).toEqual([]);
    expect(result.conflicts).toContainEqual(
      expect.objectContaining({ code: 'competing_evidence', kind: 'evidence' }),
    );
    expect(result.conflicts.every(conflict => conflict.kind === 'evidence')).toBe(true);
    expect(result.status).toBe('conflicted');
  });

  it('detects mutually exclusive effects from selected rules', () => {
    const data = {
      ...lesson0006,
      insights: [
        { id: 101, object_id: 1, tag: '放行规则', insight: '命中后 status 必须为 Approved' },
        { id: 102, object_id: 1, tag: '拒绝规则', insight: '命中后 status 必须为 Rejected' },
      ],
      introspections: [],
    };
    const rules = deriveSimulationRules(data);
    const scenario = {
      ...createDefaultScenario('rule-conflict', data),
      sourceObjectId: 2,
      targetObjectId: 1,
      propertyKey: 'gateway',
      propertyValue: 'WeChatPay',
      linkTypeId: 1,
      actionId: null,
      selectedRuleIds: rules.map(rule => rule.id),
    };

    const result = runOntologySimulation(data, scenario);

    expect(result.status).toBe('conflicted');
    expect(result.conflicts).toContainEqual(
      expect.objectContaining({
        code: 'rule_effect_mismatch',
        kind: 'rule',
        relatedRuleIds: expect.arrayContaining(rules.map(rule => rule.id)),
      }),
    );
  });

  it('does not treat same-named properties on different objects as a rule conflict', () => {
    const data = {
      ...lesson0006,
      insights: [
        { id: 201, object_id: 1, tag: '订单规则', insight: '命中后 status 必须为 Approved' },
        { id: 202, object_id: 2, tag: '事件规则', insight: '命中后 status 必须为 Rejected' },
      ],
      introspections: [],
    };
    const rules = deriveSimulationRules(data);
    const scenario = {
      ...createDefaultScenario('cross-object-rules', data),
      sourceObjectId: 2,
      targetObjectId: 1,
      propertyKey: 'gateway',
      propertyValue: 'WeChatPay',
      linkTypeId: 1,
      actionId: null,
      selectedRuleIds: rules.map(rule => rule.id),
    };

    const result = runOntologySimulation(data, scenario);

    expect(result.conflicts.filter(conflict => conflict.kind === 'rule')).toEqual([]);
    expect(result.status).toBe('possible');
  });

  it('builds a comparison summary across possible, conflicted and excluded scenarios', () => {
    const possible = runOntologySimulation(lesson0006, {
      ...createDefaultScenario('possible', lesson0006),
      sourceObjectId: 2,
      targetObjectId: 1,
      linkTypeId: 1,
      actionId: 1,
      timeOffsetHours: 6,
    });
    const conflicted = runOntologySimulation(lesson0013, {
      ...createDefaultScenario('conflicted', lesson0013),
      sourceObjectId: 1,
      targetObjectId: 2,
      linkTypeId: 1,
      actionId: 1,
      timeOffsetHours: 24,
    });
    const excluded = runOntologySimulation(lesson0006, {
      ...createDefaultScenario('excluded', lesson0006),
      sourceObjectId: 1,
      targetObjectId: 2,
      linkTypeId: 1,
      actionId: null,
    });

    expect(buildScenarioComparison([possible, conflicted, excluded])).toEqual({
      possible: 1,
      conflicted: 1,
      excluded: 1,
      totalTriggeredRules: possible.triggeredRules.length + conflicted.triggeredRules.length,
      totalStateChanges: possible.stateChanges.length + conflicted.stateChanges.length,
    });
  });
});
