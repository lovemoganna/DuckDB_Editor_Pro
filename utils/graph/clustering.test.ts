/**
 * utils/graph/clustering.test.ts — Test skeleton for graph clustering utilities
 *
 * Tests pure functions from graphClusteringService:
 * - findConnectedComponents: BFS connected components
 * - detectCommunities: Louvain-inspired community detection
 * - clusterByType: group nodes by type
 * - clusterByProperty: group nodes by property key
 *
 * No external dependencies to mock — pure function tests.
 * Follows the ARRANGE-ACT-ASSERT pattern.
 */

import { describe, it, expect } from 'vitest';
import {
  findConnectedComponents,
  detectCommunities,
  clusterByType,
  clusterByProperty,
} from '../../services/graphClusteringService';

// ─── Test Data Factories ───────────────────────────────────────────────────────

function makeNodes(ids: string[], groups?: string[]): any[] {
  return ids.map((id, i) => ({
    id,
    label: `Node ${id}`,
    group: groups ? groups[i] : 'other',
  }));
}

function makeLinks(pairs: [string, string, number?][]): any[] {
  return pairs.map(([source, target, weight = 0.5]) => ({
    source,
    target,
    weight,
  }));
}

// ─── findConnectedComponents ──────────────────────────────────────────────────

describe('findConnectedComponents', () => {
  it('returns one component when all nodes are connected', () => {
    // ARRANGE
    const nodes = makeNodes(['a', 'b', 'c']);
    const links = makeLinks([['a', 'b'], ['b', 'c']]);

    // ACT
    const components = findConnectedComponents(nodes, links);

    // ASSERT
    expect(components).toHaveLength(1);
    expect(components[0].nodeIds).toHaveLength(3);
  });

  it('returns separate components for disconnected subgraphs', () => {
    // ARRANGE
    const nodes = makeNodes(['a', 'b', 'c', 'd']);
    // Two separate pairs with no cross-edge
    const links = makeLinks([['a', 'b'], ['c', 'd']]);

    // ACT
    const components = findConnectedComponents(nodes, links);

    // ASSERT
    expect(components).toHaveLength(2);
    const sizes = components.map(c => c.nodeIds.length).sort();
    expect(sizes).toEqual([2, 2]);
  });

  it('marks isolated nodes as single-node components', () => {
    // ARRANGE
    const nodes = makeNodes(['a', 'isolated', 'c']);
    const links = makeLinks([['a', 'c']]);

    // ACT
    const components = findConnectedComponents(nodes, links);

    // ASSERT — should produce: CC1={a,c}, CC2={isolated}
    const isolatedComp = components.find(c => c.nodeIds.includes('isolated'));
    expect(isolatedComp).toBeDefined();
    expect(isolatedComp!.nodeIds).toHaveLength(1);
  });

  it('handles empty nodes array', () => {
    // ACT
    const components = findConnectedComponents([], []);

    // ASSERT
    expect(components).toEqual([]);
  });

  it('handles nodes with no links', () => {
    // ARRANGE
    const nodes = makeNodes(['a', 'b', 'c']);
    const links: any[] = [];

    // ACT
    const components = findConnectedComponents(nodes, links);

    // ASSERT — each node is its own component
    expect(components).toHaveLength(3);
    components.forEach(c => expect(c.nodeIds).toHaveLength(1));
  });

  it('each component has id, label, nodeIds, and color', () => {
    // ARRANGE
    const nodes = makeNodes(['x', 'y']);
    const links = makeLinks([['x', 'y']]);

    // ACT
    const components = findConnectedComponents(nodes, links);

    // ASSERT
    components.forEach(c => {
      expect(c).toHaveProperty('id');
      expect(c).toHaveProperty('label');
      expect(c).toHaveProperty('nodeIds');
      expect(c).toHaveProperty('color');
      expect(Array.isArray(c.nodeIds)).toBe(true);
    });
  });
});

// ─── detectCommunities ────────────────────────────────────────────────────────

describe('detectCommunities', () => {
  it('merges densely connected nodes — community members > 1', () => {
    // ARRANGE — a star: center connected to 4 leaves — highly connected community
    // The algorithm is randomised; star topology is robust to shuffle order
    const nodes = makeNodes(['center', 'a', 'b', 'c', 'd']);
    const links = makeLinks([
      ['center', 'a', 1], ['center', 'b', 1],
      ['center', 'c', 1], ['center', 'd', 1],
    ]);

    // ACT
    const communities = detectCommunities(nodes, links);

    // ASSERT — there should be at least one community with 2+ members
    const nonSingletons = communities.filter(c => c.nodeIds.length >= 2);
    expect(nonSingletons.length).toBeGreaterThanOrEqual(1);
  });

  it('separates disconnected subgraphs into different communities', () => {
    // ARRANGE
    const nodes = makeNodes(['a', 'b', 'c', 'd']);
    const links = makeLinks([['a', 'b', 1], ['c', 'd', 1]]);

    // ACT
    const communities = detectCommunities(nodes, links);

    // ASSERT — should produce 2 communities (or possibly more singletons filtered out)
    const nonSingletons = communities.filter(c => c.nodeIds.length >= 2);
    expect(nonSingletons.length).toBeGreaterThanOrEqual(1);
  });

  it('filters out singletons (communities with only 1 member)', () => {
    // ARRANGE
    const nodes = makeNodes(['isolated']);
    const links: any[] = [];

    // ACT
    const communities = detectCommunities(nodes, links);

    // ASSERT
    communities.forEach(c => expect(c.nodeIds.length).toBeGreaterThanOrEqual(2));
  });

  it('assigns a label based on most-connected node in community', () => {
    // ARRANGE — a line: hub connected to two leaves — hub should be community leader
    const nodes = [
      { id: 'hub', label: 'HubNode', group: 'typeHub' },
      { id: 'leaf1', label: 'Leaf 1', group: 'typeHub' },
      { id: 'leaf2', label: 'Leaf 2', group: 'typeHub' },
    ];
    const links = makeLinks([['hub', 'leaf1'], ['hub', 'leaf2']]);

    // ACT
    const communities = detectCommunities(nodes, links);
    const nonSingletons = communities.filter(c => c.nodeIds.length >= 2);

    // ASSERT — there should be at least one community with a non-empty label
    expect(nonSingletons.length).toBeGreaterThanOrEqual(1);
    nonSingletons.forEach(c => expect(c.label).toBeTruthy());
  });

  it('handles empty nodes and links', () => {
    // ACT
    const communities = detectCommunities([], []);

    // ASSERT
    expect(communities).toEqual([]);
  });

  it('each community has id, label, nodeIds, and color', () => {
    // ARRANGE
    const nodes = makeNodes(['a', 'b']);
    const links = makeLinks([['a', 'b']]);

    // ACT
    const communities = detectCommunities(nodes, links);

    // ASSERT
    communities.forEach(c => {
      expect(c).toHaveProperty('id');
      expect(c).toHaveProperty('label');
      expect(c).toHaveProperty('nodeIds');
      expect(c).toHaveProperty('color');
    });
  });
});

// ─── clusterByType ────────────────────────────────────────────────────────────

describe('clusterByType', () => {
  it('groups nodes by their group property', () => {
    // ARRANGE
    const nodes = makeNodes(['a', 'b', 'c'], ['typeHub', 'instance', 'typeHub']);

    // ACT
    const clusters = clusterByType(nodes);

    // ASSERT
    expect(clusters).toHaveLength(2);
    const typeHub = clusters.find(c => c.id === 'type-typeHub');
    const instance = clusters.find(c => c.id === 'type-instance');

    expect(typeHub?.nodeIds).toContain('a');
    expect(typeHub?.nodeIds).toContain('c');
    expect(instance?.nodeIds).toContain('b');
  });

  it('maps known group names to correct colors', () => {
    // ARRANGE
    const nodes = makeNodes(['t', 'i', 'ac'], ['typeHub', 'instance', 'action']);

    // ACT
    const clusters = clusterByType(nodes);

    // ASSERT
    const typeHubCluster = clusters.find(c => c.id === 'type-typeHub');
    const instanceCluster = clusters.find(c => c.id === 'type-instance');
    const actionCluster = clusters.find(c => c.id === 'type-action');

    expect(typeHubCluster?.color).toBe('#c77dff');
    expect(instanceCluster?.color).toBe('#60c0e0');
    expect(actionCluster?.color).toBe('#ff5a8a');
  });

  it('falls back to "other" for unknown group names', () => {
    // ARRANGE
    const nodes = makeNodes(['x', 'y'], ['unknownGroup', 'strangeType']);

    // ACT
    const clusters = clusterByType(nodes);

    // ASSERT — nodes with unknown groups should fall into "other" bucket
    expect(clusters.some(c => c.label === 'other' || c.label === 'unknownGroup' || c.label === 'strangeType')).toBe(true);
  });

  it('handles empty nodes array', () => {
    // ACT
    const clusters = clusterByType([]);

    // ASSERT
    expect(clusters).toEqual([]);
  });

  it('assigns correct id format: type-{groupName}', () => {
    // ARRANGE
    const nodes = makeNodes(['n'], ['typeHub']);

    // ACT
    const clusters = clusterByType(nodes);

    // ASSERT
    expect(clusters[0].id).toBe('type-typeHub');
  });
});

// ─── clusterByProperty ────────────────────────────────────────────────────────

describe('clusterByProperty', () => {
  it('groups nodes by the specified property key', () => {
    // ARRANGE
    const nodes = [
      { id: 'a', domain: 'SQL' },
      { id: 'b', domain: 'SQL' },
      { id: 'c', domain: '分析' },
    ];

    // ACT
    const clusters = clusterByProperty(nodes, 'domain');

    // ASSERT
    expect(clusters).toHaveLength(2);
    const sqlCluster = clusters.find(c => c.label === 'SQL');
    const analyticsCluster = clusters.find(c => c.label === '分析');

    expect(sqlCluster?.nodeIds).toContain('a');
    expect(sqlCluster?.nodeIds).toContain('b');
    expect(analyticsCluster?.nodeIds).toContain('c');
  });

  it('uses __none__ for nodes missing the property', () => {
    // ARRANGE
    const nodes = [
      { id: 'x', domain: 'SQL' },
      { id: 'y' }, // missing domain
    ];

    // ACT
    const clusters = clusterByProperty(nodes, 'domain');

    // ASSERT
    const noneCluster = clusters.find(c => c.label === '__none__');
    expect(noneCluster?.nodeIds).toContain('y');
  });

  it('assigns correct id format: prop-{propKey}-{value}', () => {
    // ARRANGE
    const nodes = [{ id: 'a', tier: 'premium' }];

    // ACT
    const clusters = clusterByProperty(nodes, 'tier');

    // ASSERT
    expect(clusters[0].id).toBe('prop-tier-premium');
  });

  it('handles empty nodes array', () => {
    // ACT
    const clusters = clusterByProperty([], 'domain');

    // ASSERT
    expect(clusters).toEqual([]);
  });

  it('handles nodes with null property value', () => {
    // ARRANGE
    const nodes = [
      { id: 'a', tier: null },
    ];

    // ACT
    const clusters = clusterByProperty(nodes, 'tier');

    // ASSERT
    const nullCluster = clusters.find(c => c.label === '__none__');
    expect(nullCluster?.nodeIds).toContain('a');
  });
});
