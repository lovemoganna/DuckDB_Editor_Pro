import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useOntologyStudioStore } from '../../../hooks/useOntologyStudioStore';

describe('useOntologyStudioStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useOntologyStudioStore.getState().resetToEmpty();
  });

  it('initializes in empty state after reset', () => {
    const state = useOntologyStudioStore.getState();
    expect(state.entities).toEqual([]);
    expect(state.relations).toEqual([]);
    expect(state.selectedId).toBeNull();
  });

  it('can add, update, and delete an entity', () => {
    const { addEntity, updateEntity, deleteEntity } = useOntologyStudioStore.getState();

    const id = addEntity({
      name: 'TestCustomer',
      label: '测试客户',
      mappedTable: 'test_customers',
    });

    let state = useOntologyStudioStore.getState();
    expect(state.entities.length).toBe(1);
    expect(state.entities[0].name).toBe('TestCustomer');
    expect(state.entities[0].label).toBe('测试客户');

    updateEntity(id, { description: '更新后的描述' });
    state = useOntologyStudioStore.getState();
    expect(state.entities[0].description).toBe('更新后的描述');

    deleteEntity(id);
    state = useOntologyStudioStore.getState();
    expect(state.entities.length).toBe(0);
  });

  it('can add and delete relations and cascades when entity deleted', () => {
    const { addEntity, addRelation, deleteEntity } = useOntologyStudioStore.getState();

    const e1 = addEntity({ name: 'User' });
    const e2 = addEntity({ name: 'Post' });

    const relId = addRelation({
      sourceEntityId: e1,
      targetEntityId: e2,
      name: 'creates',
      label: '创建',
      cardinality: '1:N',
      joinType: 'LEFT',
      sourceField: 'id',
      targetField: 'user_id',
    });

    let state = useOntologyStudioStore.getState();
    expect(state.relations.length).toBe(1);
    expect(state.relations[0].sourceEntityId).toBe(e1);

    // Deleting e1 should cascade-remove the relation
    deleteEntity(e1);
    state = useOntologyStudioStore.getState();
    expect(state.entities.length).toBe(1);
    expect(state.relations.length).toBe(0);
  });

  it('compiles entity relations graph to valid CTE SQL', () => {
    const { addEntity, addRelation, compileToSql } = useOntologyStudioStore.getState();

    const e1 = addEntity({
      name: 'Department',
      mappedTable: 'depts',
      properties: [{ name: 'dept_id', type: 'INT', isPrimaryKey: true }],
    });
    const e2 = addEntity({
      name: 'Employee',
      mappedTable: 'emps',
      properties: [
        { name: 'emp_id', type: 'INT', isPrimaryKey: true },
        { name: 'dept_id', type: 'INT', isForeignKey: true },
      ],
    });

    addRelation({
      sourceEntityId: e1,
      targetEntityId: e2,
      name: 'has_employees',
      label: '包含员工',
      cardinality: '1:N',
      joinType: 'INNER',
      sourceField: 'dept_id',
      targetField: 'dept_id',
    });

    const sql = compileToSql();
    expect(sql).toContain('WITH cte_department AS');
    expect(sql).toContain('cte_employee AS');
    expect(sql).toContain('emps.dept_id = depts.dept_id');
  });

  it('can load sample commerce model and find multi-hop deduction paths', () => {
    const { loadSampleCommerceModel, findMultiHopPaths, setActiveDeductionPath } =
      useOntologyStudioStore.getState();
    loadSampleCommerceModel();

    const state = useOntologyStudioStore.getState();
    expect(state.entities.length).toBe(4);
    expect(state.relations.length).toBe(3);

    const cust = state.entities.find((e) => e.name === 'Customer')!;
    const prod = state.entities.find((e) => e.name === 'Product')!;
    expect(cust).toBeDefined();
    expect(prod).toBeDefined();

    // Find paths from Customer to Product (3 hops: Customer -> Order -> OrderItem -> Product)
    const paths = findMultiHopPaths(cust.id, prod.id, 4);
    expect(paths.length).toBeGreaterThan(0);
    expect(paths[0].nodes).toContain(cust.id);
    expect(paths[0].nodes).toContain(prod.id);
    expect(paths[0].description).toContain('客户');
    expect(paths[0].description).toContain('商品');

    setActiveDeductionPath(paths[0]);
    expect(useOntologyStudioStore.getState().activeDeductionPath?.id).toBe(paths[0].id);
  });

  it('supports mode switching and deduction rules management', () => {
    const { setActiveMode, addDeductionRule, deleteDeductionRule } =
      useOntologyStudioStore.getState();

    setActiveMode('deduction');
    expect(useOntologyStudioStore.getState().activeMode).toBe('deduction');

    const ruleId = addDeductionRule({
      name: '自定义推演规则',
      description: '测试规则说明',
      sourceEntityId: 'e1',
      targetEntityId: 'e2',
      condition: 'Order.amount > 1000',
      inferredFact: '大宗交易客群',
      confidence: 0.9,
    });

    let state = useOntologyStudioStore.getState();
    expect(state.deductionRules.some((r) => r.id === ruleId)).toBe(true);

    deleteDeductionRule(ruleId);
    state = useOntologyStudioStore.getState();
    expect(state.deductionRules.some((r) => r.id === ruleId)).toBe(false);
  });

  it('manages relation cardinality visibility (session-only)', () => {
    const {
      addEntity,
      addRelation,
      toggleCardinalityVisibility,
      isCardinalityVisible,
      setAllCardinalitiesVisible,
      getVisibleRelations,
      resetToEmpty,
    } = useOntologyStudioStore.getState();

    resetToEmpty();

    const e1 = addEntity({ name: 'A' });
    const e2 = addEntity({ name: 'B' });
    const e3 = addEntity({ name: 'C' });

    addRelation({
      sourceEntityId: e1,
      targetEntityId: e2,
      name: 'one_to_many',
      label: '一对多',
      cardinality: '1:N',
      joinType: 'LEFT',
      sourceField: 'id',
      targetField: 'aid',
    });

    addRelation({
      sourceEntityId: e1,
      targetEntityId: e3,
      name: 'many_to_one',
      label: '多对一',
      cardinality: 'N:1',
      joinType: 'INNER',
      sourceField: 'id',
      targetField: 'aid',
    });

    expect(getVisibleRelations().length).toBe(2);

    // Hide 1:N
    toggleCardinalityVisibility('1:N');
    expect(isCardinalityVisible('1:N')).toBe(false);
    expect(isCardinalityVisible('N:1')).toBe(true);
    expect(getVisibleRelations().length).toBe(1);
    expect(getVisibleRelations()[0].cardinality).toBe('N:1');

    // Hide N:1 as well
    toggleCardinalityVisibility('N:1');
    expect(getVisibleRelations().length).toBe(0);

    // Restore all
    setAllCardinalitiesVisible();
    expect(useOntologyStudioStore.getState().hiddenCardinalities).toEqual([]);
    expect(getVisibleRelations().length).toBe(2);

    // Toggle back shows hidden again
    toggleCardinalityVisibility('1:N');
    expect(isCardinalityVisible('1:N')).toBe(false);
    toggleCardinalityVisibility('1:N');
    expect(isCardinalityVisible('1:N')).toBe(true);
  });
});
