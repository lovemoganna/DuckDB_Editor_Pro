import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import D3GraphView, { recommendRenderEngine } from '../D3GraphView';

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

describe('D3GraphView — Render Engine Modes (MECE Architecture)', () => {
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

  const mockOntologyState = {
    activeTemplateId: 'test-template',
    initState: 'ready',
    objectTypes: [
      { id: 1, name: 'User', description: 'User account' },
      { id: 2, name: 'Role', description: 'User roles' },
    ],
    objects: [
      { id: 101, object_type_id: 1, name: 'Alice', properties: '{"tier":"vip"}' },
      { id: 102, object_type_id: 1, name: 'Bob', properties: '{"tier":"free"}' },
      { id: 201, object_type_id: 2, name: 'Admin', properties: '{}' },
    ],
    linkTypes: [
      { id: 1, name: 'ASSIGNED_TO', description: 'Role assignment' },
    ],
    links: [
      { id: 1, link_type_id: 1, source_object_id: 101, target_object_id: 201, weight: 0.9 },
    ],
    actions: [],
  };

  it('correctly recommends render engines based on node counts (MECE thresholds)', () => {
    // <= 500 nodes: SVG recommended
    expect(recommendRenderEngine(10, 5)).toBe('svg');
    expect(recommendRenderEngine(499, 200)).toBe('svg');

    // 500 - 3000 nodes: Canvas 2D recommended
    expect(recommendRenderEngine(500, 500)).toBe('canvas');
    expect(recommendRenderEngine(2999, 2000)).toBe('canvas');

    // >= 3000 nodes or high density: WebGL recommended
    expect(recommendRenderEngine(3000, 3000)).toBe('webgl');
    expect(recommendRenderEngine(1500, 3500)).toBe('webgl');
  });

  it('renders the "渲染模式切换" button instead of old "力导向图谱" tab', async () => {
    const view = render(<D3GraphView ontologyState={mockOntologyState} isActive />);

    // Should find the render mode switcher button
    const switcherBtn = await waitFor(() => {
      const btn = screen.getByRole('button', { name: /渲染模式切换/i });
      expect(btn).toBeInTheDocument();
      return btn;
    });

    // Label should reflect SVG D3 by default for small graphs
    expect(switcherBtn.textContent).toContain('SVG D3');
    expect(switcherBtn.textContent).toContain('≤500节点');
  });

  it('opens the MECE 3-mode dropdown menu and allows switching between SVG, Canvas, and WebGL', async () => {
    render(<D3GraphView ontologyState={mockOntologyState} isActive />);

    const switcherBtn = await waitFor(() => screen.getByRole('button', { name: /渲染模式切换/i }));
    fireEvent.click(switcherBtn);

    // Verify all 3 modes exist in the menu
    const menu = screen.getByRole('menu');
    expect(menu).toBeInTheDocument();
    expect(menu.textContent).toContain('SVG D3');
    expect(menu.textContent).toContain('Canvas 2D');
    expect(menu.textContent).toContain('WebGL Pixi');

    // Click Canvas 2D
    const canvasOption = screen.getByRole('menuitemradio', { name: /Canvas 2D/i });
    fireEvent.click(canvasOption);

    // After switching, the button should reflect Canvas 2D mode
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /渲染模式切换/i }).textContent).toContain('Canvas 2D');
    });

    // Open again and click WebGL
    fireEvent.click(screen.getByRole('button', { name: /渲染模式切换/i }));
    const webglOption = screen.getByRole('menuitemradio', { name: /WebGL Pixi/i });
    fireEvent.click(webglOption);

    // After switching, the button should reflect WebGL Pixi mode
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /渲染模式切换/i }).textContent).toContain('WebGL Pixi');
    });
  });

  it('preserves canvas and svg elements in DOM across render engine switches', async () => {
    const { container } = render(<D3GraphView ontologyState={mockOntologyState} isActive />);

    await waitFor(() => {
      const svg = container.querySelector('svg');
      const canvas = container.querySelector('canvas');
      expect(svg).toBeInTheDocument();
      expect(canvas).toBeInTheDocument();
    });

    // Switch to Canvas 2D
    const switcherBtn = screen.getByRole('button', { name: /渲染模式切换/i });
    fireEvent.click(switcherBtn);
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Canvas 2D/i }));

    await waitFor(() => {
      const canvas = container.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
      expect(canvas?.style.display).toBe('block');
    });
  });
});
