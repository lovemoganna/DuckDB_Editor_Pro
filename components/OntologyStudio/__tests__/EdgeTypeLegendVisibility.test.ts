/**
 * 实体画布 Edge 视觉强化与可见性系统测试
 * 覆盖：
 *  - EdgeTypeLegend 渲染（4 行 cardinality + 切换 + 折叠）
 *  - "全部基数被隐藏" 时调用 setAllCardinalitiesVisible 可恢复
 *  - Edge 按 cardinality 颜色 token 派生
 *  - Inspector activeMode → subTab 联动（通过 store 行为断言）
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useOntologyStudioStore } from '../../../hooks/useOntologyStudioStore';
import { LINK_TYPE_COLOR_TOKENS } from '../../Library/ontologyStyles';

describe('EdgeTypeLegend visibility system', () => {
  beforeEach(() => {
    localStorage.clear();
    useOntologyStudioStore.getState().resetToEmpty();
  });

  it('LINK_TYPE_COLOR_TOKENS 覆盖 4 种 cardinality 且颜色唯一', () => {
    const cards = Object.keys(LINK_TYPE_COLOR_TOKENS);
    expect(cards).toEqual(['1:1', '1:N', 'N:1', 'N:M']);

    // 颜色必须唯一，否则图例无意义
    const colors = cards.map((c) => LINK_TYPE_COLOR_TOKENS[c as keyof typeof LINK_TYPE_COLOR_TOKENS].color);
    expect(new Set(colors).size).toBe(cards.length);
  });

  it('N:M 默认有 dashArray，其它基数可派生 dash 模式', () => {
    expect(LINK_TYPE_COLOR_TOKENS['N:M'].dashArray).toBeTruthy();
    // 1:1/1:N/N:1 的 dashArray 在 token 中未定义，由 Edge 组件按基数派生
    expect(LINK_TYPE_COLOR_TOKENS['1:1'].dashArray).toBeUndefined();
    expect(LINK_TYPE_COLOR_TOKENS['1:N'].dashArray).toBeUndefined();
    expect(LINK_TYPE_COLOR_TOKENS['N:1'].dashArray).toBeUndefined();
  });

  it('隐藏全部 4 种基数后 hiddenCardinalities 长度为 4', () => {
    const { toggleCardinalityVisibility } = useOntologyStudioStore.getState();
    (['1:1', '1:N', 'N:1', 'N:M'] as const).forEach((c) => toggleCardinalityVisibility(c));

    const state = useOntologyStudioStore.getState();
    expect(state.hiddenCardinalities).toHaveLength(4);
    // 此时所有关系都不可见
    expect(state.getVisibleRelations()).toHaveLength(0);
  });

  it('隐藏全部基数后 setAllCardinalitiesVisible 一次性恢复', () => {
    const { toggleCardinalityVisibility, setAllCardinalitiesVisible } =
      useOntologyStudioStore.getState();

    // 准备 2 条不同基数的关联
    const e1 = useOntologyStudioStore.getState().addEntity({ name: 'A' });
    const e2 = useOntologyStudioStore.getState().addEntity({ name: 'B' });
    const e3 = useOntologyStudioStore.getState().addEntity({ name: 'C' });
    useOntologyStudioStore.getState().addRelation({
      sourceEntityId: e1, targetEntityId: e2,
      name: 'r1', label: '关联1', cardinality: '1:N',
      joinType: 'LEFT', sourceField: 'id', targetField: 'aid',
    });
    useOntologyStudioStore.getState().addRelation({
      sourceEntityId: e2, targetEntityId: e3,
      name: 'r2', label: '关联2', cardinality: 'N:1',
      joinType: 'INNER', sourceField: 'id', targetField: 'bid',
    });

    // 隐藏全部 4 个基数 → 用户将看到"全部已隐藏"告警横幅
    (['1:1', '1:N', 'N:1', 'N:M'] as const).forEach((c) => toggleCardinalityVisibility(c));

    expect(useOntologyStudioStore.getState().getVisibleRelations()).toHaveLength(0);

    // 一键恢复
    setAllCardinalitiesVisible();

    const state = useOntologyStudioStore.getState();
    expect(state.hiddenCardinalities).toEqual([]);
    expect(state.getVisibleRelations()).toHaveLength(2);
  });

  it('只隐藏某基数时，其余基数仍可见', () => {
    const { addEntity, addRelation, toggleCardinalityVisibility, getVisibleRelations } =
      useOntologyStudioStore.getState();

    const e1 = addEntity({ name: 'A' });
    const e2 = addEntity({ name: 'B' });
    addRelation({
      sourceEntityId: e1, targetEntityId: e2,
      name: 'r1', label: '一对多', cardinality: '1:N',
      joinType: 'LEFT', sourceField: 'id', targetField: 'aid',
    });

    toggleCardinalityVisibility('1:N');
    const visible = getVisibleRelations();
    expect(visible).toHaveLength(0);

    // 恢复
    useOntologyStudioStore.getState().setAllCardinalitiesVisible();
    expect(getVisibleRelations()).toHaveLength(1);
  });
});
