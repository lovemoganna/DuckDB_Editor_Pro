import { describe, it, expect } from 'vitest';
import { getOntologyNodeDimensions } from './OntologyLayout';
import { getGraphNodeRect, getEdgeHandleSides, sideToHandleId, getOrthogonalRouteForEdge } from './OntologyRouting';
import { NODE_DEFAULT_WIDTH, NODE_COLLAPSED_HEIGHT, NODE_COMPACT_WIDTH, NODE_COMPACT_HEIGHT, ZOOM_THRESHOLDS } from './OntologyCanvas.helpers';
import type { Node, Edge } from 'reactflow';

describe('OntologyCanvas - Node Dimensions & Content Hierarchy Policy', () => {
  it('computes standard node dimensions with predictable width and height for normal zoom (>=0.35)', () => {
    const node: Node = {
      id: '1',
      position: { x: 100, y: 100 },
      data: {
        obj: { id: 1, name: 'Customer', properties: JSON.stringify({ ltv: 1000, level: 'VIP' }) },
        isExpanded: false,
        isCompact: false,
      },
    };

    const dims = getOntologyNodeDimensions(node);
    expect(dims.width).toBe(NODE_DEFAULT_WIDTH); // 210
    expect(dims.height).toBe(NODE_COLLAPSED_HEIGHT); // 84

    const rect = getGraphNodeRect(node);
    expect(rect.width).toBe(NODE_DEFAULT_WIDTH);
    expect(rect.height).toBe(NODE_COLLAPSED_HEIGHT);
  });

  it('computes compact node dimensions in bird\'s-eye view (zoom < 0.35)', () => {
    const node: Node = {
      id: '2',
      position: { x: 200, y: 200 },
      data: {
        obj: { id: 2, name: 'Product', properties: JSON.stringify({ price: 99 }) },
        isExpanded: false,
        isCompact: true,
      },
    };

    const dims = getOntologyNodeDimensions(node);
    expect(dims.width).toBe(NODE_COMPACT_WIDTH); // 170
    expect(dims.height).toBe(NODE_COMPACT_HEIGHT); // 48

    const rect = getGraphNodeRect(node);
    expect(rect.width).toBe(NODE_COMPACT_WIDTH);
    expect(rect.height).toBe(NODE_COMPACT_HEIGHT);
  });

  it('computes deterministic expanded height based on properties count without overflow collapse', () => {
    const node: Node = {
      id: '3',
      position: { x: 300, y: 300 },
      data: {
        obj: { 
          id: 3, 
          name: 'Order', 
          properties: JSON.stringify({
            amount: 500,
            status: 'paid',
            coupon: 'SAVE10',
            date: '2026-09-14',
            channel: 'App'
          }) 
        },
        isExpanded: true,
        isCompact: false,
      },
    };

    const dims = getOntologyNodeDimensions(node);
    expect(dims.width).toBe(NODE_DEFAULT_WIDTH);
    // baseHeight (84) + Math.min(Math.max(5, 1), 5) * 20 + 6 = 84 + 100 + 6 = 190
    expect(dims.height).toBe(190);
  });
});

describe('OntologyCanvas - Handle Symmetry and Route Endpoint Alignment', () => {
  it('generates symmetric matching handle IDs for all 4 faces', () => {
    expect(sideToHandleId('left', 'source')).toBe('left-source');
    expect(sideToHandleId('left', 'target')).toBe('left-target');
    expect(sideToHandleId('right', 'source')).toBe('right-source');
    expect(sideToHandleId('right', 'target')).toBe('right-target');
    expect(sideToHandleId('top', 'source')).toBe('top-source');
    expect(sideToHandleId('top', 'target')).toBe('top-target');
    expect(sideToHandleId('bottom', 'source')).toBe('bottom-source');
    expect(sideToHandleId('bottom', 'target')).toBe('bottom-target');
  });

  it('picks right->left handles for standard left-to-right hierarchical flow', () => {
    const sourceNode: Node = {
      id: '1',
      position: { x: 100, y: 100 },
      data: { obj: { id: 1, name: 'A' } },
    };
    const targetNode: Node = {
      id: '2',
      position: { x: 500, y: 100 },
      data: { obj: { id: 2, name: 'B' } },
    };
    const edge: Edge = {
      id: 'e1',
      source: '1',
      target: '2',
    };

    const route = getOrthogonalRouteForEdge([sourceNode, targetNode], edge, 'hierarchical');
    expect(route).not.toBeNull();
    expect(route?.sourceSide).toBe('right');
    expect(route?.targetSide).toBe('left');

    // Source exit point is on right edge center: x = 100 + 210 = 310, y = 100 + 84/2 = 142
    expect(route?.points[0]).toEqual({ x: 310, y: 142 });
    // Target entry point is on left edge center: x = 500, y = 100 + 84/2 = 142
    expect(route?.points[route.points.length - 1]).toEqual({ x: 500, y: 142 });
  });

  it('picks bottom->top handles for top-to-bottom tree flow', () => {
    const sourceNode: Node = {
      id: '1',
      position: { x: 200, y: 100 },
      data: { obj: { id: 1, name: 'Parent' } },
    };
    const targetNode: Node = {
      id: '2',
      position: { x: 200, y: 400 },
      data: { obj: { id: 2, name: 'Child' } },
    };
    const edge: Edge = {
      id: 'e2',
      source: '1',
      target: '2',
    };

    const route = getOrthogonalRouteForEdge([sourceNode, targetNode], edge, 'tree');
    expect(route).not.toBeNull();
    expect(route?.sourceSide).toBe('bottom');
    expect(route?.targetSide).toBe('top');

    // Source exit point: x = 200 + 210/2 = 305, y = 100 + 84 = 184
    expect(route?.points[0]).toEqual({ x: 305, y: 184 });
    // Target entry point: x = 200 + 210/2 = 305, y = 400
    expect(route?.points[route.points.length - 1]).toEqual({ x: 305, y: 400 });
  });
});
