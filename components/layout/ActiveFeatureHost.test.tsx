// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Tab } from '../../types';
import { ActiveFeatureHost } from './ActiveFeatureHost';

afterEach(cleanup);
beforeEach(() => {
  window.localStorage.clear();
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
});

describe('ActiveFeatureHost', () => {
  it('mounts only the active workspace feature', () => {
    const dashboardRenderer = vi.fn(() => <div>Dashboard content</div>);
    const dataRenderer = vi.fn(() => <div>Data content</div>);

    render(
      <ActiveFeatureHost
        activeTab={Tab.DATA}
        renderers={{
          [Tab.DASHBOARD]: dashboardRenderer,
          [Tab.DATA]: dataRenderer,
        }}
      />,
    );

    expect(dataRenderer).toHaveBeenCalledOnce();
    expect(dashboardRenderer).not.toHaveBeenCalled();
    expect(screen.getByText('Data content')).toBeTruthy();
    expect(screen.queryByText('Dashboard content')).toBeNull();
  });

  it('fails explicitly when a catalogued feature has no renderer', () => {
    render(<ActiveFeatureHost activeTab={Tab.HISTORY} renderers={{}} />);

    expect(screen.getByRole('alert').textContent).toContain('历史 is unavailable');
  });

  it('exposes real workspace context and sibling navigation in the inspector', () => {
    const onNavigate = vi.fn();
    render(
      <ActiveFeatureHost
        activeTab={Tab.DATA}
        onNavigate={onNavigate}
        context={{ currentTable: 'orders', tableCount: 3, runtimeLabel: 'OPFS', persistent: true }}
        renderers={{ [Tab.DATA]: () => <div>Data content</div> }}
      />,
    );

    expect(screen.getByText('orders')).toBeTruthy();
    expect(screen.getByText('3 张表')).toBeTruthy();
    expect(screen.getByText('OPFS')).toBeTruthy();
    fireEvent.click(screen.getByRole('complementary').querySelector('button')!);
    expect(onNavigate).toHaveBeenCalledWith(Tab.DASHBOARD);
  });

  it('renders all AI cognitive tabs full-bleed directly without extra shell wrapping', () => {
    const aiTabs = [
      Tab.ONTOLOGY,
      Tab.AI_SKILLS,
      Tab.AI_CAPABILITIES,
      Tab.COMPOSITIONAL_DEDUCTION,
    ];

    for (const tab of aiTabs) {
      const renderer = vi.fn(() => <div data-testid={`content-${tab}`}>AI Feature Content</div>);
      const { unmount } = render(
        <ActiveFeatureHost
          activeTab={tab}
          renderers={{ [tab]: renderer }}
        />,
      );

      expect(renderer).toHaveBeenCalledOnce();
      expect(screen.getByTestId(`content-${tab}`)).toBeTruthy();
      // Should NOT render WorkbenchShell complementary sidebar
      expect(screen.queryByRole('complementary')).toBeNull();
      unmount();
    }
  });

  it('renders knowledge hub tabs (Tab.LIBRARY, Tab.TUTORIALS) full-bleed without context sidebar', () => {
    const knowledgeTabs = [Tab.LIBRARY, Tab.TUTORIALS];

    for (const tab of knowledgeTabs) {
      const renderer = vi.fn(() => <div data-testid={`content-${tab}`}>Knowledge Hub Content</div>);
      const { unmount } = render(
        <ActiveFeatureHost
          activeTab={tab}
          renderers={{ [tab]: renderer }}
        />,
      );

      expect(renderer).toHaveBeenCalledOnce();
      expect(screen.getByTestId(`content-${tab}`)).toBeTruthy();
      // Should NOT render context sidebar / complementary panel
      expect(screen.queryByRole('complementary')).toBeNull();
      expect(screen.queryByText('上下文')).toBeNull();
      unmount();
    }
  });
});
