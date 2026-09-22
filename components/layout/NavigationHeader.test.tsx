// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Tab } from '../../types';
import { NavigationHeader } from './NavigationHeader';

afterEach(cleanup);

describe('NavigationHeader', () => {
  it('renders the global product rail and routes each section to its first workspace', () => {
    const setActiveTab = vi.fn();
    render(
      <NavigationHeader
        activeTab={Tab.DASHBOARD}
        currentTable={null}
        setActiveTab={setActiveTab}
        fetchTableData={vi.fn()}
        refreshAudit={vi.fn()}
        runtimeInfo={{
          version: 'v1.4.3',
          storageMode: 'opfs',
          persistent: true,
          ready: true,
        }}
      />,
    );

    const groupNav = screen.getByLabelText('工作区主分类');
    expect(within(groupNav).getByRole('button', { name: '数据工程' })).toBeTruthy();
    expect(within(groupNav).getByRole('button', { name: 'AI 认知' })).toBeTruthy();
    expect(screen.queryByText('4')).toBeNull();
    fireEvent.click(within(groupNav).getByRole('button', { name: 'AI 认知' }));
    expect(setActiveTab).toHaveBeenCalledWith(Tab.AI_CAPABILITIES);
    expect(screen.getByLabelText('DuckDB 运行状态').textContent).toContain('v1.4.3');
    expect(screen.getByLabelText('DuckDB 运行状态').textContent).toContain('OPFS');
  });
});
