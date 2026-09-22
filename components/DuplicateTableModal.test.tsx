// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DuplicateTableModal } from './DuplicateTableModal';

afterEach(cleanup);

describe('DuplicateTableModal UI/UX enhancements', () => {
  it('renders source table, clone mode options, and live SQL preview', () => {
    render(
      <DuplicateTableModal
        isOpen={true}
        onClose={vi.fn()}
        sourceTable="customer_orders"
        onTableCreated={vi.fn()}
        onRefreshTables={vi.fn()}
      />
    );

    expect(screen.getByText('克隆复制数据表 (Duplicate Table)')).toBeTruthy();
    expect(screen.getByText('customer_orders')).toBeTruthy();
    expect(screen.getByText(/包含数据 \(Schema \+ Data\)/i)).toBeTruthy();
    expect(screen.getByText(/仅表结构 \(Schema Only\)/i)).toBeTruthy();

    // Default SQL preview
    expect(screen.getByText(/CREATE TABLE "customer_orders_copy" AS SELECT \* FROM "customer_orders";/i)).toBeTruthy();

    // Switch to Schema only
    const schemaOnlyText = screen.getByText(/仅表结构 \(Schema Only\)/i);
    fireEvent.click(schemaOnlyText);

    expect(screen.getByText(/WHERE 1=0;/i)).toBeTruthy();
  });
});
