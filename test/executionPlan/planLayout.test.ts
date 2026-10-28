import { describe, expect, it } from 'vitest';
import { computeGraphLayout } from '../../components/ExecutionPlan/layout/planLayout';
import { ExecutionPlanGraph, ExecutionNode, ExecutionEdge } from '../../components/ExecutionPlan/model/types';

describe('Auto Layout Engine (Dagre)', () => {
  it('computes valid coordinates for nodes and routes edges', () => {
    const nodes = new Map<string, ExecutionNode>();
    nodes.set('root', {
      id: 'root',
      name: 'PROJECTION',
      operatorType: 'PROJECTION',
      category: 'projection',
      isUnknownOperator: false,
      chineseName: '列投影',
      summary: '',
      metrics: {},
      extraInfo: {},
      diagnostics: [],
      childrenIds: ['child'],
      parentIds: [],
    });
    nodes.set('child', {
      id: 'child',
      name: 'SEQ_SCAN',
      operatorType: 'SEQ_SCAN',
      category: 'scan',
      isUnknownOperator: false,
      chineseName: '顺序扫描',
      summary: '',
      metrics: {},
      extraInfo: {},
      diagnostics: [],
      childrenIds: [],
      parentIds: ['root'],
    });

    const edges: ExecutionEdge[] = [
      {
        id: 'e1',
        source: 'child',
        target: 'root',
        relativeWidth: 2,
      },
    ];

    const graph: ExecutionPlanGraph = {
      rootNodeId: 'root',
      nodes,
      edges,
      isAnalyzed: false,
    };

    const layout = computeGraphLayout(graph, 'BT');
    expect(layout.nodes.size).toBe(2);
    expect(layout.edges.length).toBe(1);

    const rootLayout = layout.nodes.get('root')!;
    const childLayout = layout.nodes.get('child')!;

    expect(Number.isFinite(rootLayout.x)).toBe(true);
    expect(Number.isFinite(rootLayout.y)).toBe(true);
    expect(Number.isFinite(childLayout.x)).toBe(true);
    expect(Number.isFinite(childLayout.y)).toBe(true);

    // In Bottom-to-Top (BT), source child is below target root (so child.y > root.y)
    expect(childLayout.y).toBeGreaterThan(rootLayout.y);

    // Edge has points connecting child and root
    const edgeLayout = layout.edges[0];
    expect(edgeLayout.points.length).toBeGreaterThanOrEqual(2);
  });

  it('handles empty graphs safely', () => {
    const emptyGraph: ExecutionPlanGraph = {
      rootNodeId: '',
      nodes: new Map(),
      edges: [],
      isAnalyzed: false,
    };

    const layout = computeGraphLayout(emptyGraph);
    expect(layout.nodes.size).toBe(0);
    expect(layout.edges.length).toBe(0);
    expect(layout.width).toBe(0);
    expect(layout.height).toBe(0);
  });

  it('computes valid horizontal layout (LR) with data flowing from left to right', () => {
    const nodes = new Map<string, any>();
    nodes.set('root', {
      id: 'root',
      name: 'PROJECTION',
      childrenIds: ['child'],
      parentIds: [],
    });
    nodes.set('child', {
      id: 'child',
      name: 'SEQ_SCAN',
      childrenIds: [],
      parentIds: ['root'],
    });

    const edges = [
      {
        id: 'e1',
        source: 'child',
        target: 'root',
        relativeWidth: 2,
      },
    ];

    const graph: any = {
      rootNodeId: 'root',
      nodes,
      edges,
      isAnalyzed: false,
    };

    const layout = computeGraphLayout(graph, 'LR');
    expect(layout.direction).toBe('LR');
    expect(layout.nodes.size).toBe(2);

    const rootLayout = layout.nodes.get('root')!;
    const childLayout = layout.nodes.get('child')!;

    // In Left-to-Right (LR), source child is to the left of target root (child.x < root.x)
    expect(childLayout.x).toBeLessThan(rootLayout.x);
  });
});
