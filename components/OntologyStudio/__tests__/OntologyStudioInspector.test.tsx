import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OntologyStudioInspector } from '../OntologyStudioInspector';
import { useOntologyStudioStore } from '../../../hooks/useOntologyStudioStore';

afterEach(cleanup);

describe('OntologyStudioInspector', () => {
  beforeEach(() => {
    localStorage.clear();
    useOntologyStudioStore.getState().resetToEmpty();
  });

  it('renders global CTE preview without triggering setState in render warning or infinite re-renders', () => {
    const errorSpy = vi.spyOn(console, 'error');

    const { addEntity, addRelation } = useOntologyStudioStore.getState();
    const e1 = addEntity({
      name: 'Order',
      mappedTable: 'orders',
      properties: [{ name: 'order_id', type: 'INT', isPrimaryKey: true }],
    });
    const e2 = addEntity({
      name: 'Customer',
      mappedTable: 'customers',
      properties: [{ name: 'customer_id', type: 'INT', isPrimaryKey: true }],
    });
    addRelation({
      sourceEntityId: e1,
      targetEntityId: e2,
      name: 'placed_by',
      label: '下单客户',
      cardinality: 'N:1',
      joinType: 'INNER',
      sourceField: 'customer_id',
      targetField: 'customer_id',
    });

    // Deselect any selected relation/entity to inspect global model overview
    useOntologyStudioStore.getState().selectElement(null, null);

    render(
      <OntologyStudioInspector
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    // Verify CTE SQL section rendered
    expect(screen.getByText('编译为多表 CTE 分析 SQL')).toBeTruthy();
    expect(screen.getByText(/WITH cte_order AS/i)).toBeTruthy();

    // Verify React setState in render / maximum update depth warnings were NOT triggered
    for (const call of errorSpy.mock.calls) {
      const msg = call.join(' ');
      expect(msg).not.toContain('Cannot update a component');
      expect(msg).not.toContain('Maximum update depth exceeded');
    }

    errorSpy.mockRestore();
  });
});
