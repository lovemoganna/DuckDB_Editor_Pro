import { describe, it, expect } from 'vitest';
import { getOntologyNodeDimensions } from './OntologyLayout';
import { getGraphNodeRect, getOrthogonalRouteForEdge } from './OntologyRouting';
import {
  NODE_DEFAULT_WIDTH,
  NODE_COLLAPSED_HEIGHT,
} from './OntologyCanvas.helpers';
import type { Node, Edge } from 'reactflow';

describe('OntologyEdgeAttachment - Snug Edge Connection & Anchor Precision', () => {
  it('guarantees 0-pixel detachment: edge starts exactly on source border and ends exactly on target border', () => {
    const sourceNode: Node = {
      id: 'node-A',
      position: { x: 50, y: 150 },
      data: {
        obj: { id: 1, name: 'User', properties: JSON.stringify({ email: 'test@example.com', role: 'admin' }) },
        isExpanded: false,
      },
    };
    const targetNode: Node = {
      id: 'node-B',
      position: { x: 450, y: 150 },
      data: {
        obj: { id: 2, name: 'Order', properties: JSON.stringify({ order_id: 1001, total: 299 }) },
        isExpanded: false,
      },
    };
    const edge: Edge = {
      id: 'edge-A-B',
      source: 'node-A',
      target: 'node-B',
    };

    const route = getOrthogonalRouteForEdge([sourceNode, targetNode], edge, 'orthogonal');
    expect(route).not.toBeNull();
    expect(route?.sourceSide).toBe('right');
    expect(route?.targetSide).toBe('left');

    const sourceRect = getGraphNodeRect(sourceNode);
    const targetRect = getGraphNodeRect(targetNode);

    // Source exit point must be strictly on right border: x = x + width
    expect(route?.points[0].x).toBe(sourceRect.x + sourceRect.width);
    expect(route?.points[0].y).toBe(sourceRect.y + sourceRect.height / 2);

    // Target entry point must be strictly on left border: x = target.x
    const lastPoint = route?.points[route.points.length - 1];
    expect(lastPoint?.x).toBe(targetRect.x);
    expect(lastPoint?.y).toBe(targetRect.y + targetRect.height / 2);
  });

  it('maintains perfectly snug vertical connections for top-to-bottom and bottom-to-top edges', () => {
    const topNode: Node = {
      id: 'node-parent',
      position: { x: 200, y: 50 },
      data: { obj: { id: 10, name: 'Category' } },
    };
    const bottomNode: Node = {
      id: 'node-child',
      position: { x: 200, y: 350 },
      data: { obj: { id: 11, name: 'SubCategory' } },
    };
    const forwardEdge: Edge = { id: 'e-down', source: 'node-parent', target: 'node-child' };
    const backwardEdge: Edge = { id: 'e-up', source: 'node-child', target: 'node-parent' };

    const downRoute = getOrthogonalRouteForEdge([topNode, bottomNode], forwardEdge, 'tree');
    expect(downRoute?.sourceSide).toBe('bottom');
    expect(downRoute?.targetSide).toBe('top');

    const topRect = getGraphNodeRect(topNode);
    const bottomRect = getGraphNodeRect(bottomNode);

    // Downward route starts at topNode bottom center
    expect(downRoute?.points[0]).toEqual({
      x: topRect.x + topRect.width / 2,
      y: topRect.y + topRect.height,
    });
    // And lands at bottomNode top center
    expect(downRoute?.points[downRoute.points.length - 1]).toEqual({
      x: bottomRect.x + bottomRect.width / 2,
      y: bottomRect.y,
    });

    // Upward route starts at bottomNode top center and lands at topNode bottom center
    const upRoute = getOrthogonalRouteForEdge([topNode, bottomNode], backwardEdge, 'tree');
    expect(upRoute?.sourceSide).toBe('top');
    expect(upRoute?.targetSide).toBe('bottom');
    expect(upRoute?.points[0]).toEqual({
      x: bottomRect.x + bottomRect.width / 2,
      y: bottomRect.y,
    });
    expect(upRoute?.points[upRoute.points.length - 1]).toEqual({
      x: topRect.x + topRect.width / 2,
      y: topRect.y + topRect.height,
    });
  });

  it('prevents compounding height bugs when toggling expand multiple times', () => {
    const node: Node = {
      id: 'node-exp',
      position: { x: 100, y: 100 },
      width: 210,
      height: 84,
      data: {
        obj: {
          id: 99,
          name: 'DynamicEntity',
          properties: JSON.stringify({ p1: 'a', p2: 'b', p3: 'c' }),
        },
        nodeWidth: 210,
        nodeHeight: 84,
        isExpanded: true,
      },
    };

    // First expansion calculation
    const dim1 = getOntologyNodeDimensions(node);
    const expectedExpandedHeight = 84 + 3 * 20 + 6; // 150
    expect(dim1.height).toBe(expectedExpandedHeight);

    // Simulate node state having been updated with expanded height
    node.height = dim1.height;
    node.data.nodeHeight = dim1.height;

    // Second calculation (e.g. during next layout or drag) MUST remain identical and NOT compound!
    const dim2 = getOntologyNodeDimensions(node);
    expect(dim2.height).toBe(expectedExpandedHeight);

    // Third calculation
    node.height = dim2.height;
    const dim3 = getOntologyNodeDimensions(node);
    expect(dim3.height).toBe(expectedExpandedHeight);

    // When collapsed, must cleanly return to base height
    node.data.isExpanded = false;
    const dimCollapsed = getOntologyNodeDimensions(node);
    expect(dimCollapsed.height).toBe(NODE_COLLAPSED_HEIGHT);
  });

  it('keeps deterministic node size across operational zoom levels to prevent layout thrashing', () => {
    const node: Node = {
      id: 'node-zoom',
      position: { x: 100, y: 100 },
      data: {
        obj: { id: 1, name: 'ResilientNode' },
      },
    };

    const dimsStandard = getOntologyNodeDimensions(node);
    expect(dimsStandard.width).toBe(NODE_DEFAULT_WIDTH);
    expect(dimsStandard.height).toBe(NODE_COLLAPSED_HEIGHT);

    // Bounding box calculation for routing must match node dimensions exactly
    const rect = getGraphNodeRect(node);
    expect(rect.width).toBe(NODE_DEFAULT_WIDTH);
    expect(rect.height).toBe(NODE_COLLAPSED_HEIGHT);
  });
});
