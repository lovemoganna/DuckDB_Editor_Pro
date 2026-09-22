// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommandPalette } from './CommandPalette';

afterEach(cleanup);

describe('CommandPalette integration with CommandRegistry', () => {
  it('opens on custom event and renders registered commands and tables', () => {
    render(
      <CommandPalette
        isOpen={true}
        tables={['orders', 'customers', 'products']}
        currentTable="orders"
        onSelectTable={vi.fn()}
        onSetActiveTab={vi.fn()}
        onOpenCreateTable={vi.fn()}
        onOpenImportWizard={vi.fn()}
        onOpenExport={vi.fn()}
        onOpenSettings={vi.fn()}
      />
    );

    // Search input
    expect(screen.getByPlaceholderText(/搜索命令、数据表、AI 技能或导航/i)).toBeTruthy();

    // Category pills
    expect(screen.getByText('全部')).toBeTruthy();
    expect(screen.getByText('系统命令')).toBeTruthy();
    expect(screen.getByText('数据表')).toBeTruthy();

    // Tables are listed
    expect(screen.getByText('orders')).toBeTruthy();
    expect(screen.getByText('customers')).toBeTruthy();
    expect(screen.getByText('products')).toBeTruthy();

    // Filter by query
    const input = screen.getByPlaceholderText(/搜索命令、数据表、AI 技能或导航/i);
    fireEvent.change(input, { target: { value: 'customers' } });

    expect(screen.getByText('customers')).toBeTruthy();
    expect(screen.queryByText('orders')).toBeNull();
  });

  it('allows searching and navigating to all AI Cognition tabs', () => {
    const onSetActiveTab = vi.fn();
    render(
      <CommandPalette
        isOpen={true}
        tables={[]}
        currentTable={null}
        onSelectTable={vi.fn()}
        onSetActiveTab={onSetActiveTab}
        onOpenCreateTable={vi.fn()}
        onOpenImportWizard={vi.fn()}
        onOpenExport={vi.fn()}
        onOpenSettings={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText(/搜索命令、数据表、AI 技能或导航/i);

    // Search for AI 能力库
    fireEvent.change(input, { target: { value: '能力库' } });
    const capItem = screen.getByText('AI 能力库 (ai_capabilities)');
    expect(capItem).toBeTruthy();
    fireEvent.click(capItem);
    expect(onSetActiveTab).toHaveBeenCalledWith('ai_capabilities');

    // Search for 组合推演
    fireEvent.change(input, { target: { value: '推演' } });
    const deductionItem = screen.getByText('组合推演 (compositional_deduction)');
    expect(deductionItem).toBeTruthy();
    fireEvent.click(deductionItem);
    expect(onSetActiveTab).toHaveBeenCalledWith('compositional_deduction');

    // Search for 本体图谱
    fireEvent.change(input, { target: { value: '本体图谱' } });
    const ontologyItem = screen.getByText('本体图谱 (ontology)');
    expect(ontologyItem).toBeTruthy();
    fireEvent.click(ontologyItem);
    expect(onSetActiveTab).toHaveBeenCalledWith('ontology');
  });
});
