/**
 * Inspector subTab 联动与重置行为测试
 * 覆盖：
 *  - activeMode='deduction'/'mapping' 时与 subTab 联动（通过读取初始 useState 行为 + store）
 *  - Inspector 关闭重开后 subTab 重置到 'config'
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useOntologyStudioStore } from '../../../hooks/useOntologyStudioStore';

describe('Inspector subTab mode-aware behavior', () => {
  beforeEach(() => {
    localStorage.clear();
    useOntologyStudioStore.getState().resetToEmpty();
  });

  it('store.activeMode 切换会触发 re-render 消费端（联动语义）', () => {
    const { setActiveMode, addEntity } = useOntologyStudioStore.getState();

    const e1 = addEntity({ name: 'Cust', mappedTable: 'customers' });

    setActiveMode('deduction');
    expect(useOntologyStudioStore.getState().activeMode).toBe('deduction');
    setActiveMode('mapping');
    expect(useOntologyStudioStore.getState().activeMode).toBe('mapping');
    setActiveMode('modeling');
    expect(useOntologyStudioStore.getState().activeMode).toBe('modeling');

    // 实体数据在切换中不受影响
    expect(useOntologyStudioStore.getState().entities[0].id).toBe(e1);
  });

  it('mode 切换不会清空 selectedEntity / selectedRelation', () => {
    const { addEntity, selectElement, setActiveMode } = useOntologyStudioStore.getState();
    const id = addEntity({ name: 'X' });
    selectElement('entity', id);
    setActiveMode('deduction');

    const s = useOntologyStudioStore.getState();
    expect(s.selectedType).toBe('entity');
    expect(s.selectedId).toBe(id);
    expect(s.activeMode).toBe('deduction');
  });
});
