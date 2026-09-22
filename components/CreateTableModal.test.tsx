// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CreateTableModal } from './CreateTableModal';

afterEach(cleanup);

describe('CreateTableModal UI/UX enhancements', () => {
  it('renders interactive column schema editor and live DDL preview', () => {
    render(
      <CreateTableModal
        isOpen={true}
        onClose={vi.fn()}
        onTableCreated={vi.fn()}
        onRefreshTables={vi.fn()}
      />
    );

    // Header & Description
    expect(screen.getByText('新建数据表 (Create Table)')).toBeTruthy();
    expect(screen.getByText(/字段与类型定义/i)).toBeTruthy();

    // Table name input
    const input = screen.getByPlaceholderText(/例如：customer_orders/i);
    expect(input).toBeTruthy();
    fireEvent.change(input, { target: { value: 'analytics_events' } });

    // Live DDL preview contains table name
    expect(screen.getByText(/CREATE TABLE "analytics_events"/i)).toBeTruthy();

    // Add Column Button
    const addColBtn = screen.getByText('添加字段');
    fireEvent.click(addColBtn);

    // Columns count updated
    expect(screen.getByText(/(4 列)/i)).toBeTruthy();

    // Copy code button in DDL preview
    const copyBtns = screen.getAllByText('复制代码');
    expect(copyBtns.length).toBeGreaterThanOrEqual(1);

    // Mock navigator.clipboard
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    fireEvent.click(copyBtns[0]);
    expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE "analytics_events"'));
  });
});

