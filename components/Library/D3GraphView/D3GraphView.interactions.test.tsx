import React from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import D3GraphView from '../D3GraphView';

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
  it('keeps every node title visible by default', async () => {
    const view = await renderReadyGraph();
    const svg = view.container.querySelector('svg[role="img"]')!;
    const graph = view.container.querySelector<SVGGElement>('.nv-graph')!;
    fireEvent.wheel(svg, { deltaY: 2000, clientX: 500, clientY: 350 });
    await waitFor(() => {
      const scale = Number(graph.getAttribute('transform')?.match(/scale\(([^)]+)\)/)?.[1] || 1);
      expect(scale).toBeLessThan(0.15);
    });
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

    const labels = Array.from(view.container.querySelectorAll<SVGTextElement>('.nv-node-label'));

    expect(labels.map(label => label.firstChild?.textContent)).toEqual(
      expect.arrayContaining(['Type A', 'Type B', 'Alpha', 'Beta', 'Gamma']),
    );
    expect(labels.every(label => label.style.display !== 'none')).toBe(true);
  });

  it('clears selection, focus, search dimming, and stale highlight callbacks after a blank double click', async () => {
    const view = await renderReadyGraph();
    const svg = view.container.querySelector('svg[role="img"]')!;
    const alphaNode = view.container.querySelector<SVGGElement>('.nv-instance')!;

    fireEvent.click(alphaNode);
    await waitFor(() => {
      expect(view.container.querySelectorAll('.nv-highlight-node')).toHaveLength(1);
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
      expect((window as any).__currentNodeId).toBeNull();
      expect((window as any).__focusedNodeId).toBeNull();
    });
  });
});
