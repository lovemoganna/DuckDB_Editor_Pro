import { describe, expect, it } from 'vitest';
import { aggregateCrossBranchLinks, applyDandelionLayout, applyRelationshipAnalysisLayout, applySpokeLayout } from './D3GraphView.layout';
import type { GraphLink, GraphNode } from './D3GraphView.types';

const node = (id: string, group: string, extra: Partial<GraphNode> = {}): GraphNode => ({
  id,
  label: id,
  group,
  color: '#fff',
  size: group === 'typeHub' ? 28 : group === 'action' ? 10 : 11,
  description: '',
  ...extra,
});

const link = (source: string, target: string, extra: Partial<GraphLink> = {}): GraphLink => ({
  source,
  target,
  color: '#5ab0d0',
  weight: 0.8,
  ...extra,
});

const distance = (a: GraphNode, b: GraphNode) => Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0));

describe('ontology layout algorithms', () => {
  it('builds a stable center-rooted spoke tree with explicit parent metadata', () => {
    const nodes = [
      node('root', 'instance', { _objId: 1 }),
      node('branch-a', 'instance', { _objId: 2 }),
      node('branch-b', 'instance', { _objId: 3 }),
      node('leaf-a', 'instance', { _objId: 4 }),
      node('action-a', 'action', { _objId: 2 }),
    ];
    const result = applySpokeLayout(nodes, [link('root', 'branch-a'), link('root', 'branch-b'), link('branch-a', 'leaf-a')], 1000, 700, 'root');
    expect(result.rootId).toBe('root');
    expect(result.branchCount).toBe(2);
    expect(result.placements.get('root')).toMatchObject({ depth: 0, parentId: null });
    expect(result.placements.get('branch-a')).toMatchObject({ depth: 1, parentId: 'root' });
    expect(result.placements.get('action-a')).toMatchObject({ parentId: 'branch-a' });
    expect(nodes.every(n => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true);
  });

  it('collapses cross-branch relations into deterministic bundles', () => {
    const a = node('a', 'instance', { _branchIndex: 0 });
    const b = node('b', 'instance', { _branchIndex: 1 });
    const c = node('c', 'instance', { _branchIndex: 1 });
    const links = [link('a', 'b', { source: a, target: b, _linkTypeId: 2 }), link('a', 'c', { source: a, target: c, _linkTypeId: 2 })];
    const bundled = aggregateCrossBranchLinks(links);
    expect(bundled).toHaveLength(1);
    expect(bundled[0]._isRelationBundle).toBe(true);
    expect(bundled[0]._bundleCount).toBe(2);
  });

  it('places hierarchy nodes deterministically by type sector and action owner', () => {
    const build = () => {
      const nodes = [
        node('type::1', 'typeHub', { _typeId: 1 }),
        node('type::2', 'typeHub', { _typeId: 2 }),
        node('obj::1', 'instance', { _typeId: 1, _objId: 1 }),
        node('obj::2', 'instance', { _typeId: 1, _objId: 2 }),
        node('obj::3', 'instance', { _typeId: 2, _objId: 3 }),
        node('action::1', 'action', { _objId: 1 }),
      ];
      applyDandelionLayout(nodes, [link('obj::1', 'action::1')], 1000, 700);
      return nodes;
    };

    const first = build();
    const second = build();
    expect(first.map(n => [n.id, n.x, n.y])).toEqual(second.map(n => [n.id, n.x, n.y]));
    expect(first.every(n => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true);
    expect(distance(first[2], first[5])).toBeGreaterThan(35);
    expect(first[0].fx).toBe(first[0].x);
  });

  it('keeps high-degree analysis focus at the centre and separates outer orbits', () => {
    const nodes = [
      node('obj::1', 'instance', { _objId: 1 }),
      node('obj::2', 'instance', { _objId: 2 }),
      node('obj::3', 'instance', { _objId: 3 }),
      node('obj::4', 'instance', { _objId: 4 }),
      node('type::1', 'typeHub', { _typeId: 1 }),
      node('action::1', 'action', { _objId: 1 }),
    ];
    const links = [
      link('obj::1', 'obj::2'),
      link('obj::1', 'obj::3'),
      link('obj::2', 'obj::4'),
      link('obj::1', 'action::1'),
    ];

    const focus = applyRelationshipAnalysisLayout(nodes, links, 1200, 800, null);
    expect(focus).toBe('obj::1');
    expect(nodes.find(n => n.id === 'obj::1')).toMatchObject({ x: 600, y: 400, _focusLevel: 0 });
    expect(nodes.find(n => n.id === 'obj::2')?._focusLevel).toBe(1);
    expect(nodes.find(n => n.id === 'obj::4')?._focusLevel).toBe(2);
    expect(nodes.every(n => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true);
  });

  it('distributes large outer layers across multiple orbits instead of stacking them', () => {
    const nodes = Array.from({ length: 140 }, (_, index) => node(`obj::${index + 1}`, 'instance', { _objId: index + 1 }));
    const links = nodes.slice(1).map(n => link('obj::1', n.id));
    applyRelationshipAnalysisLayout(nodes, links, 1400, 900, 'obj::1');
    const radii = new Set(nodes.slice(1).map(n => Math.round(Math.hypot((n.x || 0) - 700, (n.y || 0) - 450) / 20)));
    expect(radii.size).toBeGreaterThan(2);
  });
});
