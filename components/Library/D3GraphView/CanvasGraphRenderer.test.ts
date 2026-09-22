import { describe, expect, it, vi } from 'vitest';
import { CanvasGraphRenderer } from './CanvasGraphRenderer';
import type { GraphNode, GraphLink } from './D3GraphView.types';

describe('CanvasGraphRenderer', () => {
  const createMockCanvas = () => {
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
      clearRect: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      setTransform: vi.fn(),
      setLineDash: vi.fn(),
      quadraticCurveTo: vi.fn(),
      roundRect: vi.fn(),
      measureText: vi.fn(() => ({ width: 40 })),
      fillText: vi.fn(),
      strokeText: vi.fn(),
    };

    const canvas = {
      getContext: vi.fn(() => ctx),
      width: 800,
      height: 600,
      style: {},
    } as unknown as HTMLCanvasElement;

    return { canvas, ctx };
  };

  const sampleNodes: GraphNode[] = [
    { id: 'hub-1', label: 'User', group: 'typeHub', x: 100, y: 100, color: '#3b82f6', size: 24 },
    { id: 'inst-1', label: 'Alice', group: 'instance', x: 300, y: 100, color: '#10b981', size: 14 },
    { id: 'act-1', label: 'Login', group: 'action', x: 300, y: 200, color: '#f59e0b', size: 10 },
  ];

  const sampleLinks: GraphLink[] = [
    { id: 'link-1', source: sampleNodes[0], target: sampleNodes[1], color: '#64748b', weight: 0.8 },
    { id: 'link-2', source: sampleNodes[1], target: sampleNodes[2], color: '#f59e0b', weight: 0.5, _isActionLink: true },
  ];

  it('initializes and executes render() without throwing', () => {
    const { canvas, ctx } = createMockCanvas();
    const renderer = new CanvasGraphRenderer(canvas);

    renderer.render({
      nodes: sampleNodes,
      links: sampleLinks,
      transform: { k: 1, x: 0, y: 0 },
      selectedNodeId: null,
      hoveredNodeId: null,
      focusedNodeId: null,
    });

    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.clearRect).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('performs accurate spatial hit-testing for nodes', () => {
    const { canvas } = createMockCanvas();
    const renderer = new CanvasGraphRenderer(canvas);
    const transform = { k: 1, x: 50, y: 50 };

    // Node 'hub-1' is at world (100, 100), so screen pos is (150, 150)
    const hit = renderer.hitTest(150, 150, sampleNodes, transform);
    expect(hit).toBeDefined();
    expect(hit?.id).toBe('hub-1');

    // Far away should return null
    const miss = renderer.hitTest(900, 900, sampleNodes, transform);
    expect(miss).toBeNull();
  });

  it('performs spatial hit-testing for links', () => {
    const { canvas } = createMockCanvas();
    const renderer = new CanvasGraphRenderer(canvas);
    const transform = { k: 1, x: 0, y: 0 };

    // link-1 connects (100, 100) to (300, 100). Midpoint is (200, 100).
    const hit = renderer.hitTestLink(200, 101, sampleLinks, transform);
    expect(hit).toBeDefined();
    expect(hit?.id).toBe('link-1');

    // Off the line should return null
    const miss = renderer.hitTestLink(200, 150, sampleLinks, transform);
    expect(miss).toBeNull();
  });

  it('scales and resizes properly with devicePixelRatio', () => {
    const { canvas } = createMockCanvas();
    const renderer = new CanvasGraphRenderer(canvas);

    renderer.resize(1200, 800);
    expect(canvas.style.width).toBe('1200px');
    expect(canvas.style.height).toBe('800px');
  });
});
