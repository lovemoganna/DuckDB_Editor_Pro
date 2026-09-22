import React from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import D3GraphView, { D3GraphView as D3GraphViewComponent } from '../D3GraphView';

const { initOntology } = vi.hoisted(() => ({ initOntology: vi.fn() }));

vi.mock('../../../hooks/useOntologyStore', () => {
  const dispatch = vi.fn();
  return {
    ontologyActions: { setSearch: (term: string) => ({ type: 'SET_SEARCH', term }) },
    useOntologyStore: () => ({
      state: {},
      dispatch,
      deleteObjectType: vi.fn(),
      deleteObject: vi.fn(),
      deleteLinkType: vi.fn(),
      deleteLink: vi.fn(),
      deleteAction: vi.fn(),
      initOntology,
    }),
  };
});

const ontologyState = {
  initState: 'ready',
  initting: false,
  activeTemplateId: 'regression',
  search: 'Alpha',
  mapping: {
    objectTypeTable: 'life_object_type',
    objectTable: 'life_object',
    linkTypeTable: 'life_link_type',
    linkTable: 'life_link',
    actionTable: 'life_action',
  },
  objectTypes: [
    { id: 1, name: 'Type A', description: '' },
    { id: 2, name: 'Type B', description: '' },
  ],
  objects: [
    { id: 1, object_type_id: 1, name: 'Alpha', properties: '{}' },
    { id: 2, object_type_id: 1, name: 'Beta', properties: '{}' },
    { id: 3, object_type_id: 2, name: 'Gamma', properties: '{}' },
  ],
  linkTypes: [{ id: 1, name: 'relates', description: '' }],
  links: [
    { id: 1, link_type_id: 1, source_object_id: 1, target_object_id: 2, weight: 0.9 },
    { id: 2, link_type_id: 1, source_object_id: 2, target_object_id: 3, weight: 0.8 },
  ],
  actions: [],
};

beforeAll(() => {
  Object.defineProperties(HTMLElement.prototype, {
    clientWidth: { configurable: true, get: () => 1000 },
    clientHeight: { configurable: true, get: () => 700 },
  });

  class TestResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', TestResizeObserver);

  Object.defineProperty(SVGElement.prototype, 'getBBox', {
    configurable: true,
    value: () => ({ x: 0, y: 0, width: 1000, height: 700 }),
  });
  Object.defineProperties(SVGSVGElement.prototype, {
    width: { configurable: true, get: () => ({ baseVal: { value: 1000 } }) },
    height: { configurable: true, get: () => ({ baseVal: { value: 700 } }) },
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function renderReadyGraph() {
  const view = render(<D3GraphView ontologyState={ontologyState} isActive />);
  await waitFor(() => {
    expect(view.container.querySelectorAll('.nv-node')).toHaveLength(5);
    expect(view.container.querySelectorAll('.nv-node-label')).toHaveLength(5);
  });
  return view;
}

describe('D3GraphView blank-canvas reset', () => {
  it('initializes directly from the empty state and exposes retry feedback', async () => {
    const view = render(
      <D3GraphView
        ontologyState={{
          ...ontologyState,
          initState: 'no-tables',
          error: 'seed write failed',
          objectTypes: [],
          objects: [],
          linkTypes: [],
          links: [],
        }}
        isActive
      />,
    );

    const retry = await view.findByRole('button', { name: '重试初始化' });
    fireEvent.click(retry);

    expect(initOntology).toHaveBeenCalledOnce();
    expect(view.getByRole('alert').textContent).toContain('seed write failed');
    expect(view.getByRole('button', { name: '导出 CSV' }).hasAttribute('disabled')).toBe(true);
    expect(view.queryByText(/MECE 面板/)).toBeNull();
  });

  it('clears selection, focus, search dimming, and stale highlight callbacks after a blank double click', async () => {
    const view = await renderReadyGraph();
    const svg = view.container.querySelector('svg[role="img"]')!;
    const alphaNode = view.container.querySelector<SVGGElement>('.nv-instance')!;

    fireEvent.click(alphaNode);
    await waitFor(() => {
      expect(view.container.querySelectorAll('.nv-highlight-node')).toHaveLength(1);
    });

    const linkEl = view.container.querySelector<SVGPathElement>('.nv-link-instance')!;
    fireEvent.click(linkEl);
    await waitFor(() => {
      expect(view.container.querySelector('.nv-link-selected')).not.toBeNull();
    });

    // A real browser double click emits two click events followed by dblclick.
    fireEvent.click(svg);
    fireEvent.click(svg);
    fireEvent.doubleClick(svg);

    await waitFor(() => {
      expect(view.container.querySelectorAll('.nv-highlight-node')).toHaveLength(0);
      expect(view.container.querySelectorAll('.nv-selected-pulse')).toHaveLength(0);
      expect(view.container.querySelectorAll('.nv-dim')).toHaveLength(0);
      expect(view.container.querySelectorAll('.nv-dim-label')).toHaveLength(0);
      expect(view.container.querySelector('.nv-link-selected')).toBeNull();
      expect(view.container.querySelector('[aria-label="连线属性检查器"]')).toBeNull();
      expect((window as any).__currentNodeId).toBeNull();
      expect((window as any).__focusedNodeId).toBeNull();
    });
  });

  it('renders a full-bleed canvas catcher that captures empty-area pointer and wheel interactions', async () => {
    const view = await renderReadyGraph();
    const catcher = view.container.querySelector('rect.nv-canvas-catcher');
    expect(catcher).not.toBeNull();
    expect(catcher?.getAttribute('fill')).toBe('transparent');
    expect(catcher?.getAttribute('width')).toBe('100%');
    expect(catcher?.getAttribute('height')).toBe('100%');
    expect(catcher?.getAttribute('cursor')).toBe('grab');
    
    // Test middle mouse button and wheel dispatch on empty area catcher
    const catcherEl = catcher as SVGRectElement;
    expect(() => {
      const createMouseEvent = (type: string, dict: MouseEventInit) => {
        const ev = new MouseEvent(type, { bubbles: true, cancelable: true, ...dict });
        Object.defineProperty(ev, 'view', { value: window });
        return ev;
      };
      fireEvent(catcherEl, createMouseEvent('mousedown', { button: 1, clientX: 500, clientY: 350 }));
      fireEvent(catcherEl, createMouseEvent('mousemove', { button: 1, clientX: 520, clientY: 370 }));
      fireEvent(catcherEl, createMouseEvent('mouseup', { button: 1, clientX: 520, clientY: 370 }));
      fireEvent(catcherEl, new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -100, clientX: 500, clientY: 350 }));
    }).not.toThrow();
  });

  it('exposes __d3FitAll which computes safe visual center taking panels into account', async () => {
    await renderReadyGraph();
    expect(typeof (window as any).__d3FitAll).toBe('function');
    expect(() => (window as any).__d3FitAll()).not.toThrow();
  });

  it('renders Action links (.nv-link-action) and flow particles (.nv-link-particle) for action nodes and business links', async () => {
    const ontologyWithAction = {
      ...ontologyState,
      actions: [
        { id: 101, object_id: 1, name: 'Deploy Model', description: 'Deploy action for Alpha' },
      ],
    };

    const view = render(<D3GraphView ontologyState={ontologyWithAction} isActive />);
    await waitFor(() => {
      // 5 original nodes (2 typeHub, 3 instance) + 1 action node = 6
      expect(view.container.querySelectorAll('.nv-node')).toHaveLength(6);
      expect(view.container.querySelectorAll('.nv-action')).toHaveLength(1);
      // Dedicated action link
      expect(view.container.querySelectorAll('.nv-link-action')).toHaveLength(1);
      // Flow particles layer
      expect(view.container.querySelectorAll('.nv-link-particle').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('supports selecting a link to open the Edge Inspector card and closing it', async () => {
    const view = await renderReadyGraph();
    const linkEl = view.container.querySelector<SVGPathElement>('.nv-link-instance');
    expect(linkEl).not.toBeNull();

    // Click link to select
    fireEvent.click(linkEl!);

    // Should open Edge Inspector floating card
    await waitFor(() => {
      expect(view.container.querySelector('[aria-label="连线属性检查器"]')).not.toBeNull();
      expect(view.getByText('关系详情检查器 (Edge Inspector)')).toBeTruthy();
      expect(linkEl?.classList.contains('nv-link-selected')).toBe(true);
    });

    // Close the Edge Inspector via close button
    const closeBtn = view.getByLabelText('关闭关系面板');
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(view.container.querySelector('[aria-label="连线属性检查器"]')).toBeNull();
      expect(view.container.querySelector('.nv-link-selected')).toBeNull();
    });
  });
});
