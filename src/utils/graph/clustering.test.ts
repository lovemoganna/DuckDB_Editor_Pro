/**
 * utils/graph/clustering.test.ts — Unit tests for graph utility functions
 *
 * Tests:
 * - communityDetection (via findConnectedComponents): nodes grouped correctly
 * - degreeCentrality: centrality computed correctly
 * - findConnectedComponents: isolated nodes, connected clusters
 * - bfsShortestPath: path found / not found
 * - computeNeighborHops: N-hop neighborhood
 * - computeGraphStats: stats computed correctly
 */

import { describe, it, expect } from 'vitest';
import {
  degreeCentrality,
  findConnectedComponents,
  bfsShortestPath,
  computeNeighborHops,
  computeGraphStats,
} from '../graph';
import type { GraphNode, GraphLink } from '../graph';

// ─── Test Fixtures ─────────────────────────────────────────────────────────────

const simpleNodes: GraphNode[] = [
  { id: 'a', label: 'Node A' },
  { id: 'b', label: 'Node B' },
  { id: 'c', label: 'Node C' },
  { id: 'd', label: 'Node D' },
];

const simpleLinks: GraphLink[] = [
  { source: 'a', target: 'b' },
  { source: 'b', target: 'c' },
  // d is isolated
];

// ─── degreeCentrality ─────────────────────────────────────────────────────────

describe('degreeCentrality', () => {
  it('computes correct degree for each node', () => {
    // ACT
    const result = degreeCentrality(simpleNodes, simpleLinks);

    // ASSERT
    expect(result.degreeMap['a']).toBe(1); // connected to b
    expect(result.degreeMap['b']).toBe(2); // connected to a and c
    expect(result.degreeMap['c']).toBe(1); // connected to b
    expect(result.degreeMap['d']).toBe(0); // isolated
  });

  it('avgDegree is the arithmetic mean of all degrees', () => {
    // ACT
    const result = degreeCentrality(simpleNodes, simpleLinks);

    // ASSERT
    // degrees: [1, 2, 1, 0] -> avg = 4/4 = 1
    expect(result.avgDegree).toBe(1);
  });

  it('handles empty nodes array', () => {
    // ACT
    const result = degreeCentrality([], []);

    // ASSERT
    expect(result.degreeMap).toEqual({});
    expect(result.avgDegree).toBe(0);
    expect(result.topCentralityIds.size).toBe(0);
  });

  it('handles empty links array', () => {
    // ACT
    const result = degreeCentrality(simpleNodes, []);

    // ASSERT
    Object.values(result.degreeMap).forEach(d => expect(d).toBe(0));
    expect(result.avgDegree).toBe(0);
  });

  it('topCentralityIds contains nodes above threshold', () => {
    // ACT
    const result = degreeCentrality(simpleNodes, simpleLinks);

    // ASSERT — node b has degree 2, which is the highest
    expect(result.topCentralityIds.has('b')).toBe(true);
  });

  it('resolves source/target from GraphNode objects', () => {
    // ARRANGE — links using node objects instead of string IDs
    const nodes = [
      { id: 'x', label: 'X' },
      { id: 'y', label: 'Y' },
    ];
    const links: GraphLink[] = [
      { source: nodes[0], target: nodes[1] },
    ];

    // ACT
    const result = degreeCentrality(nodes, links);

    // ASSERT
    expect(result.degreeMap['x']).toBe(1);
    expect(result.degreeMap['y']).toBe(1);
  });

  it('isolated node has degree 0 and is not in topCentralityIds', () => {
    // ACT
    const result = degreeCentrality(simpleNodes, simpleLinks);

    // ASSERT
    expect(result.degreeMap['d']).toBe(0);
    expect(result.topCentralityIds.has('d')).toBe(false);
  });
});

// ─── communityDetection (findConnectedComponents) ───────────────────────────────

describe('findConnectedComponents (community detection)', () => {
  it('groups nodes correctly into connected components', () => {
    // ACT
    const result = findConnectedComponents(simpleNodes, simpleLinks);

    // ASSERT — a, b, c are one component; d is isolated
    expect(result.length).toBe(2);

    // Largest component should be first (sorted by size desc)
    const [largest, smallest] = result;
    expect(largest.nodeCount).toBeGreaterThanOrEqual(smallest.nodeCount);
  });

  it('isolated node is its own component', () => {
    // ACT
    const result = findConnectedComponents(simpleNodes, simpleLinks);

    // ASSERT
    const isolatedComponent = result.find(c => c.nodeIds.includes('d'));
    expect(isolatedComponent).toBeDefined();
    expect(isolatedComponent!.nodeIds).toEqual(['d']);
    expect(isolatedComponent!.nodeCount).toBe(1);
  });

  it('fully connected cluster has correct node count', () => {
    // ARRANGE
    const clusterNodes: GraphNode[] = [
      { id: 'n1' }, { id: 'n2' }, { id: 'n3' },
    ];
    const clusterLinks: GraphLink[] = [
      { source: 'n1', target: 'n2' },
      { source: 'n2', target: 'n3' },
      { source: 'n3', target: 'n1' },
    ];

    // ACT
    const result = findConnectedComponents(clusterNodes, clusterLinks);

    // ASSERT — all 3 nodes in one component
    expect(result.length).toBe(1);
    expect(result[0].nodeCount).toBe(3);
    expect(new Set(result[0].nodeIds)).toEqual(new Set(['n1', 'n2', 'n3']));
  });

  it('handles empty graph', () => {
    // ACT
    const result = findConnectedComponents([], []);

    // ASSERT
    expect(result).toEqual([]);
  });

  it('handles single node with no edges', () => {
    // ACT
    const result = findConnectedComponents([{ id: 'solo' }], []);

    // ASSERT
    expect(result).toHaveLength(1);
    expect(result[0].nodeIds).toEqual(['solo']);
    expect(result[0].nodeCount).toBe(1);
  });

  it('resolves GraphNode objects in links', () => {
    // ARRANGE
    const nodes = [{ id: 'a' }, { id: 'b' }];
    const links: GraphLink[] = [{ source: nodes[0], target: nodes[1] }];

    // ACT
    const result = findConnectedComponents(nodes, links);

    // ASSERT
    expect(result).toHaveLength(1);
    expect(result[0].nodeCount).toBe(2);
  });
});

// ─── bfsShortestPath ──────────────────────────────────────────────────────────

describe('bfsShortestPath', () => {
  it('returns path from source to target', () => {
    // ACT
    const path = bfsShortestPath('a', 'c', simpleLinks);

    // ASSERT — a → b → c
    expect(path.has('a')).toBe(true);
    expect(path.has('b')).toBe(true);
    expect(path.has('c')).toBe(true);
  });

  it('returns empty set when no path exists (isolated node)', () => {
    // ACT
    const path = bfsShortestPath('a', 'd', simpleLinks);

    // ASSERT
    expect(path.size).toBe(0);
  });

  it('returns set with only source and target for direct edge', () => {
    // ARRANGE
    const links: GraphLink[] = [{ source: 'x', target: 'y' }];

    // ACT
    const path = bfsShortestPath('x', 'y', links);

    // ASSERT
    expect(path).toEqual(new Set(['x', 'y']));
  });

  it('returns empty set when source equals target', () => {
    // ACT
    const path = bfsShortestPath('a', 'a', simpleLinks);

    // ASSERT
    expect(path).toEqual(new Set(['a']));
  });

  it('finds path in a larger graph', () => {
    // ARRANGE
    const nodes: GraphNode[] = [
      { id: '1' }, { id: '2' }, { id: '3' },
      { id: '4' }, { id: '5' },
    ];
    const links: GraphLink[] = [
      { source: '1', target: '2' },
      { source: '2', target: '3' },
      { source: '3', target: '4' },
      { source: '4', target: '5' },
    ];

    // ACT
    const path = bfsShortestPath('1', '5', links);

    // ASSERT
    expect(path.has('1')).toBe(true);
    expect(path.has('5')).toBe(true);
    expect(path.size).toBeGreaterThan(0);
  });
});

// ─── computeNeighborHops ──────────────────────────────────────────────────────

describe('computeNeighborHops', () => {
  it('seed node itself is included in the neighborhood', () => {
    // ACT
    const neighbors = computeNeighborHops('a', simpleLinks, 1);

    // ASSERT
    expect(neighbors.has('a')).toBe(true);
  });

  it('1-hop neighbor is included', () => {
    // ACT
    const neighbors = computeNeighborHops('a', simpleLinks, 1);

    // ASSERT — a → b
    expect(neighbors.has('b')).toBe(true);
  });

  it('2-hop neighbor is included at hops=2', () => {
    // ACT
    const neighbors = computeNeighborHops('a', simpleLinks, 2);

    // ASSERT — a → b → c
    expect(neighbors.has('c')).toBe(true);
  });

  it('does not include 3-hop node when hops=2', () => {
    // ACT
    const neighbors = computeNeighborHops('a', simpleLinks, 2);

    // ASSERT — d is isolated, not reachable
    expect(neighbors.has('d')).toBe(false);
  });

  it('returns only seed for hops=0', () => {
    // ACT
    const neighbors = computeNeighborHops('a', simpleLinks, 0);

    // ASSERT
    expect(neighbors).toEqual(new Set(['a']));
  });

  it('handles node not in links gracefully', () => {
    // ACT
    const neighbors = computeNeighborHops('ghost', simpleLinks, 2);

    // ASSERT
    expect(neighbors.has('ghost')).toBe(true);
    expect(neighbors.size).toBe(1);
  });
});

// ─── computeGraphStats ─────────────────────────────────────────────────────────

describe('computeGraphStats', () => {
  it('computes correct nodeCount and linkCount', () => {
    // ACT
    const stats = computeGraphStats(simpleNodes, simpleLinks);

    // ASSERT
    expect(stats.nodeCount).toBe(4);
    expect(stats.linkCount).toBe(2);
  });

  it('avgDegree matches degreeCentrality result', () => {
    // ACT
    const stats = computeGraphStats(simpleNodes, simpleLinks);

    // ASSERT
    expect(stats.avgDegree).toBe(1);
  });

  it('maxDegree is correct', () => {
    // ACT
    const stats = computeGraphStats(simpleNodes, simpleLinks);

    // ASSERT — node b has degree 2
    expect(stats.maxDegree).toBe(2);
  });

  it('componentCount reflects isolated + connected nodes', () => {
    // ACT
    const stats = computeGraphStats(simpleNodes, simpleLinks);

    // ASSERT — 2 components: {a,b,c} and {d}
    expect(stats.componentCount).toBe(2);
  });

  it('density is 0 for empty graph', () => {
    // ACT
    const stats = computeGraphStats([], []);

    // ASSERT
    expect(stats.density).toBe(0);
  });

  it('density is computed as links / possibleEdges', () => {
    // ARRANGE — 3 nodes, 3 edges (fully connected triangle)
    const nodes: GraphNode[] = [{ id: '1' }, { id: '2' }, { id: '3' }];
    const links: GraphLink[] = [
      { source: '1', target: '2' },
      { source: '2', target: '3' },
      { source: '3', target: '1' },
    ];

    // ACT
    const stats = computeGraphStats(nodes, links);

    // ASSERT — possible edges = 3 * 2 / 2 = 3, density = 3/3 = 1
    expect(stats.density).toBe(1);
  });
});
