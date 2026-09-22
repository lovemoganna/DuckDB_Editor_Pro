import { describe, expect, it } from 'vitest';
import {
  applyTopologicalFlowLayout,
  aggregateCrossBranchLinks,
  computeClusteredPositions,
  applyCommunityCentricBarycentricLayout,
  applyDandelionLayout,
  applyRelationshipAnalysisLayout,
  applySpokeLayout,
  applyVerticalTreeLayout,
  applyHorizontalTreeLayout,
  applyConcentricLayout,
  applyStarburstLayout,
  applyGridLayout,
  applyGroupedCircularLayout,
  applyDagreLayout,
  computeInitialPositions,
} from '../../../services/graphLayoutService';
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

  it('arranges vertical tree layout compactly and centered around W / 2', () => {
    const nodes = [
      node('type::1', 'typeHub', { _typeId: 1 }),
      node('type::2', 'typeHub', { _typeId: 2 }),
      node('obj::1', 'instance', { _typeId: 1, _objId: 1 }),
      node('obj::2', 'instance', { _typeId: 1, _objId: 2 }),
      node('obj::3', 'instance', { _typeId: 2, _objId: 3 }),
      node('obj::4', 'instance', { _typeId: 2, _objId: 4 }),
      node('action::1', 'action', { _objId: 1 }),
    ];
    const W = 1400;
    const H = 800;
    applyVerticalTreeLayout(nodes, W, H);

    const hub1 = nodes.find(n => n.id === 'type::1')!;
    const hub2 = nodes.find(n => n.id === 'type::2')!;
    expect(hub1).toBeDefined();
    expect(hub2).toBeDefined();

    // The two hubs must be horizontally centered around W / 2 (700)
    const midX = (hub1.x! + hub2.x!) / 2;
    expect(midX).toBeCloseTo(700, 1);

    // Hub distance must be compact (between 180 and 260px), NOT 1400px!
    const hubDistance = Math.abs(hub2.x! - hub1.x!);
    expect(hubDistance).toBeLessThanOrEqual(260);
    expect(hubDistance).toBeGreaterThanOrEqual(180);

    // All nodes must have positive coordinates strictly within viewport bounds
    nodes.forEach(n => {
      expect(n.x).toBeGreaterThan(0);
      expect(n.x).toBeLessThan(W);
      expect(n.y).toBeGreaterThan(0);
      expect(n.y).toBeLessThan(H);
      expect(n.fx).toBe(n.x);
      expect(n.fy).toBe(n.y);
    });
  });

  it('arranges horizontal tree layout compactly and centered around H / 2', () => {
    const nodes = [
      node('type::1', 'typeHub', { _typeId: 1 }),
      node('type::2', 'typeHub', { _typeId: 2 }),
      node('obj::1', 'instance', { _typeId: 1, _objId: 1 }),
      node('obj::2', 'instance', { _typeId: 2, _objId: 2 }),
      node('action::1', 'action', { _objId: 1 }),
    ];
    const W = 1200;
    const H = 700;
    applyHorizontalTreeLayout(nodes, W, H);

    const hub1 = nodes.find(n => n.id === 'type::1')!;
    const hub2 = nodes.find(n => n.id === 'type::2')!;
    expect(hub1).toBeDefined();
    expect(hub2).toBeDefined();

    // The two hubs must be vertically centered around H / 2 (350)
    const midY = (hub1.y! + hub2.y!) / 2;
    expect(midY).toBeCloseTo(350, 1);

    // Vertical distance between hubs must be compact
    const hubDistance = Math.abs(hub2.y! - hub1.y!);
    expect(hubDistance).toBeLessThanOrEqual(200);

    nodes.forEach(n => {
      expect(n.x).toBeGreaterThan(0);
      expect(n.x).toBeLessThan(W);
      expect(n.y).toBeGreaterThan(0);
      expect(n.y).toBeLessThan(H);
    });
  });
  it('positions type hubs and instances in coherent clusters with computeClusteredPositions', () => {
    const hubA = node('hub-a', 'typeHub', { _typeId: 1 });
    const hubB = node('hub-b', 'typeHub', { _typeId: 2 });
    const instA1 = node('inst-a1', 'instance', { _typeId: 1 });
    const instA2 = node('inst-a2', 'instance', { _typeId: 1 });
    const instB1 = node('inst-b1', 'instance', { _typeId: 2 });
    const nodes = [hubA, hubB, instA1, instA2, instB1];

    computeClusteredPositions(nodes, [hubA, hubB], 1000, 800);

    // All nodes should have valid numbers
    expect(nodes.every(n => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true);

    // Instances of type 1 should be closer to hubA than hubB
    const distA1ToHubA = Math.hypot(instA1.x! - hubA.x!, instA1.y! - hubA.y!);
    const distA1ToHubB = Math.hypot(instA1.x! - hubB.x!, instA1.y! - hubB.y!);
    expect(distA1ToHubA).toBeLessThan(distA1ToHubB);
  });

  it('orientates nodes towards communicating external clusters with applyCommunityCentricBarycentricLayout', () => {
    const hubA = node('hub-1', 'typeHub', { _typeId: 1 });
    const hubB = node('hub-2', 'typeHub', { _typeId: 2 });
    const instA1 = node('inst-a1', 'instance', { _typeId: 1 });
    const instA2 = node('inst-a2', 'instance', { _typeId: 1 });
    const instB1 = node('inst-b1', 'instance', { _typeId: 2 });
    const actionA = node('act-1', 'action', { _objId: 1 });
    instA1._objId = 1;

    const links = [
      link('inst-a1', 'inst-b1', { source: instA1, target: instB1, weight: 1.0 }),
    ];

    const nodes = [hubA, hubB, instA1, instA2, instB1, actionA];
    applyCommunityCentricBarycentricLayout(nodes, links, 1000, 800);

    // All positions should be completely frozen (fx and fy equal x and y)
    expect(nodes.every(n => n.fx === n.x && n.fy === n.y)).toBe(true);

    // instA1 connects to instB1 (which is in hubB's cluster), so instA1 should be oriented closer to hubB than the isolated instA2
    const distA1ToHubB = Math.hypot(instA1.x! - hubB.x!, instA1.y! - hubB.y!);
    const distA2ToHubB = Math.hypot(instA2.x! - hubB.x!, instA2.y! - hubB.y!);
    expect(distA1ToHubB).toBeLessThan(distA2ToHubB);

    // Action node should be placed adjacent to its owner instA1
    const distActToOwner = Math.hypot(actionA.x! - instA1.x!, actionA.y! - instA1.y!);
    expect(distActToOwner).toBeLessThanOrEqual(45);
  });

  it('assigns clear topological ranks and minimizes crossings with applyTopologicalFlowLayout', () => {
    // 3 Layers: Campaign (L0) -> Product (L1) -> Metric (L2)
    const hubCampaign = node('hub-camp', 'typeHub', { _typeId: 1 });
    const hubProduct = node('hub-prod', 'typeHub', { _typeId: 2 });
    const hubMetric = node('hub-metric', 'typeHub', { _typeId: 3 });

    const campA = node('camp-a', 'instance', { _typeId: 1, _objId: 1 });
    const campB = node('camp-b', 'instance', { _typeId: 1, _objId: 2 });

    const prodA = node('prod-a', 'instance', { _typeId: 2, _objId: 3 });
    const prodB = node('prod-b', 'instance', { _typeId: 2, _objId: 4 });

    const metricA = node('metric-a', 'instance', { _typeId: 3, _objId: 5 });
    const metricB = node('metric-b', 'instance', { _typeId: 3, _objId: 6 });

    const actionCampA = node('act-camp-a', 'action', { _objId: 1 });

    // Straight parallel flows: campA -> prodA -> metricA; campB -> prodB -> metricB
    const links = [
      link('camp-a', 'prod-a'),
      link('camp-b', 'prod-b'),
      link('prod-a', 'metric-a'),
      link('prod-b', 'metric-b'),
    ];

    const nodes = [hubCampaign, hubProduct, hubMetric, campA, campB, prodA, prodB, metricA, metricB, actionCampA];
    applyTopologicalFlowLayout(nodes, links, 1000, 700);

    // 1. Valid coordinates and frozen positions
    expect(nodes.every(n => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true);
    expect(nodes.every(n => n.fx === n.x && n.fy === n.y)).toBe(true);

    // 2. Strict Left-to-Right topological rank ordering: Campaign < Product < Metric
    expect(campA.x).toBeLessThan(prodA.x!);
    expect(prodA.x).toBeLessThan(metricA.x!);
    expect(campB.x).toBeLessThan(prodB.x!);
    expect(prodB.x).toBeLessThan(metricB.x!);

    // 3. Same layer alignment: campA and campB share column X
    expect(campA.x).toBe(campB.x);
    expect(prodA.x).toBe(prodB.x);
    expect(metricA.x).toBe(metricB.x);

    // 4. Barycentric alignment: since campA -> prodA -> metricA, their vertical ordering is consistent (no line crossing)
    const campAY = campA.y!;
    const campBY = campB.y!;
    const prodAY = prodA.y!;
    const prodBY = prodB.y!;
    const metricAY = metricA.y!;
    const metricBY = metricB.y!;

    if (campAY < campBY) {
      expect(prodAY).toBeLessThan(prodBY);
      expect(metricAY).toBeLessThan(metricBY);
    } else {
      expect(prodAY).toBeGreaterThan(prodBY);
      expect(metricAY).toBeGreaterThan(metricBY);
    }

    // 5. TypeHub is placed above its respective column
    expect(hubCampaign.y).toBeLessThan(Math.min(campA.y!, campB.y!));
    expect(hubProduct.y).toBeLessThan(Math.min(prodA.y!, prodB.y!));
    expect(hubMetric.y).toBeLessThan(Math.min(metricA.y!, metricB.y!));

    // 6. Action is neatly placed adjacent to its owning instance campA
    const distActToOwner = Math.hypot(actionCampA.x! - campA.x!, actionCampA.y! - campA.y!);
    expect(distActToOwner).toBeLessThanOrEqual(50);
    // Action node is placed below owner in safe sector (y > campA.y) to prevent horizontal edge clashing
    expect(actionCampA.y).toBeGreaterThan(campA.y!);

    // 7. Column corridor separation is generous (>= 260px) and vertical row spacing is at least 115px
    expect(prodA.x! - campA.x!).toBeGreaterThanOrEqual(260);
    expect(Math.abs(campBY - campAY)).toBeGreaterThanOrEqual(115);
  });

  it('arranges directed vertical tree top-to-bottom with applyVerticalTreeLayout when links are present', () => {
    const parent = node('p1', 'instance', { _typeId: 1, _objId: 1 });
    const child = node('c1', 'instance', { _typeId: 2, _objId: 2 });
    const action = node('act1', 'action', { _objId: 2 });
    const links = [link('p1', 'c1')];
    const nodes = [parent, child, action];

    applyVerticalTreeLayout(nodes, 1000, 800, links);

    // 1. All coordinates are finite and frozen
    expect(nodes.every(n => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true);
    expect(nodes.every(n => n.fx === n.x && n.fy === n.y)).toBe(true);

    // 2. Top-to-Bottom flow: parent Y must be strictly less than child Y
    expect(parent.y!).toBeLessThan(child.y!);

    // 3. Action is positioned beneath child
    expect(action.y!).toBeGreaterThan(child.y!);
    expect(Math.abs(action.x! - child.x!)).toBeLessThanOrEqual(30);
  });

  it('arranges directed horizontal tree left-to-right with applyHorizontalTreeLayout when links are present', () => {
    const parent = node('p1', 'instance', { _typeId: 1, _objId: 1 });
    const child = node('c1', 'instance', { _typeId: 2, _objId: 2 });
    const links = [link('p1', 'c1')];
    const nodes = [parent, child];

    applyHorizontalTreeLayout(nodes, 1000, 800, links);

    // Left-to-Right flow: parent X must be strictly less than child X
    expect(parent.x!).toBeLessThan(child.x!);
  });

  it('clusters concentric rings into inner hubs, middle instances, and outward actions with applyConcentricLayout', () => {
    const hubA = node('hub-1', 'typeHub', { _typeId: 1 });
    const hubB = node('hub-2', 'typeHub', { _typeId: 2 });
    const instA = node('inst-a', 'instance', { _typeId: 1, _objId: 1 });
    const instB = node('inst-b', 'instance', { _typeId: 2, _objId: 2 });
    const actA = node('act-a', 'action', { _objId: 1 });
    const links = [link('inst-a', 'inst-b')];
    const nodes = [hubA, hubB, instA, instB, actA];

    const cx = 600;
    const cy = 400;
    applyConcentricLayout(nodes, 1200, 800, links);

    // 1. All coordinates valid and frozen
    expect(nodes.every(n => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true);
    expect(nodes.every(n => n.fx === n.x && n.fy === n.y)).toBe(true);

    // 2. Radii bands: Hubs < Instances < Actions
    const hubRadius = Math.hypot(hubA.x! - cx, hubA.y! - cy);
    const instRadius = Math.hypot(instA.x! - cx, instA.y! - cy);
    const actRadius = Math.hypot(actA.x! - cx, actA.y! - cy);

    expect(hubRadius).toBeLessThan(instRadius);
    expect(instRadius).toBeLessThan(actRadius);

    // 3. Action is adjacent to its owner instA
    const distActToOwner = Math.hypot(actA.x! - instA.x!, actA.y! - instA.y!);
    expect(distActToOwner).toBeLessThanOrEqual(60);
  });

  it('places core at center and fans children outward with applyStarburstLayout', () => {
    const core = node('core', 'instance', { _objId: 1 });
    const leaf1 = node('leaf1', 'instance', { _objId: 2 });
    const leaf2 = node('leaf2', 'instance', { _objId: 3 });
    const subLeaf = node('sub1', 'instance', { _objId: 4 });
    const links = [
      link('core', 'leaf1'),
      link('core', 'leaf2'),
      link('leaf1', 'sub1'),
    ];
    const nodes = [core, leaf1, leaf2, subLeaf];

    const cx = 500;
    const cy = 350;
    applyStarburstLayout(nodes, links, 1000, 700);

    // Core node placed at center
    expect(core.x).toBe(cx);
    expect(core.y).toBe(cy);

    // leaf1 and leaf2 placed around center
    const rLeaf1 = Math.hypot(leaf1.x! - cx, leaf1.y! - cy);
    const rLeaf2 = Math.hypot(leaf2.x! - cx, leaf2.y! - cy);
    expect(rLeaf1).toBeGreaterThan(100);
    expect(rLeaf2).toBeGreaterThan(100);

    // subLeaf is placed further out than leaf1
    const rSubLeaf = Math.hypot(subLeaf.x! - cx, subLeaf.y! - cy);
    expect(rSubLeaf).toBeGreaterThan(rLeaf1);
  });

  it('guarantees generous layer and node spacing in applyTopologicalFlowLayout', () => {
    const nodes = [
      node('src1', 'instance', { _typeId: 1, _objId: 1 }),
      node('src2', 'instance', { _typeId: 1, _objId: 2 }),
      node('mid1', 'instance', { _typeId: 2, _objId: 3 }),
      node('mid2', 'instance', { _typeId: 2, _objId: 4 }),
      node('dst1', 'instance', { _typeId: 3, _objId: 5 }),
    ];
    const links = [
      link('src1', 'mid1'),
      link('src2', 'mid2'),
      link('mid1', 'dst1'),
      link('mid2', 'dst1'),
    ];

    // Test LR
    applyTopologicalFlowLayout(nodes, links, 1200, 800, { direction: 'LR' });
    expect(nodes.every(n => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true);

    // Layer X coordinates must be monotonically increasing from src to dst with >= 200px gap
    expect(nodes[2].x! - nodes[0].x!).toBeGreaterThanOrEqual(250);
    expect(nodes[4].x! - nodes[2].x!).toBeGreaterThanOrEqual(250);

    // Sibling nodes in the same layer must have vertical spacing >= 100px
    expect(Math.abs(nodes[1].y! - nodes[0].y!)).toBeGreaterThanOrEqual(100);
    expect(Math.abs(nodes[3].y! - nodes[2].y!)).toBeGreaterThanOrEqual(100);

    // Test TB
    applyTopologicalFlowLayout(nodes, links, 1200, 800, { direction: 'TB' });
    expect(nodes[2].y! - nodes[0].y!).toBeGreaterThanOrEqual(140);
    expect(nodes[4].y! - nodes[2].y!).toBeGreaterThanOrEqual(140);
    expect(Math.abs(nodes[1].x! - nodes[0].x!)).toBeGreaterThanOrEqual(90);
  });

  it('enforces row and column separation in applyGridLayout', () => {
    const hub1 = node('hub1', 'typeHub', { _typeId: 1 });
    const hub2 = node('hub2', 'typeHub', { _typeId: 2 });
    const inst1 = node('inst1', 'instance', { _typeId: 1, _objId: 1 });
    const inst2 = node('inst2', 'instance', { _typeId: 1, _objId: 2 });
    const inst3 = node('inst3', 'instance', { _typeId: 2, _objId: 3 });
    const nodes = [hub1, hub2, inst1, inst2, inst3];

    applyGridLayout(nodes, 1000, 700);
    expect(nodes.every(n => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true);

    // Sibling row step in same column must be >= 80px
    expect(Math.abs(inst2.y! - inst1.y!)).toBeGreaterThanOrEqual(80);
    // Column spacing between types must be >= 180px
    expect(Math.abs(inst3.x! - inst1.x!)).toBeGreaterThanOrEqual(180);
  });

  it('ensures instances have ample radial distance in applyCommunityCentricBarycentricLayout', () => {
    const hub1 = node('hub1', 'typeHub', { _typeId: 1 });
    const hub2 = node('hub2', 'typeHub', { _typeId: 2 });
    const insts1 = Array.from({ length: 6 }, (_, i) => node(`inst1_${i}`, 'instance', { _typeId: 1, _objId: i + 1 }));
    const insts2 = Array.from({ length: 6 }, (_, i) => node(`inst2_${i}`, 'instance', { _typeId: 2, _objId: i + 10 }));
    const nodes = [hub1, hub2, ...insts1, ...insts2];
    const links = [link('inst1_0', 'inst2_0'), link('inst1_1', 'inst2_1')];

    applyCommunityCentricBarycentricLayout(nodes, links, 1200, 900);
    expect(nodes.every(n => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true);

    // Check that instances around hub1 do not collide (minimum pairwise distance >= 30px)
    for (let i = 0; i < insts1.length; i++) {
      for (let j = i + 1; j < insts1.length; j++) {
        const d = Math.hypot(insts1[i].x! - insts1[j].x!, insts1[i].y! - insts1[j].y!);
        expect(d).toBeGreaterThanOrEqual(30);
      }
    }
  });

  it('proves dagre layout respects full label bounding width and avoids column collision', () => {
    const n1 = node('very_long_named_entity_alpha', 'instance', { _typeId: 1, label: 'very_long_named_entity_alpha' });
    const n2 = node('very_long_named_entity_beta', 'instance', { _typeId: 1, label: 'very_long_named_entity_beta' });
    const n3 = node('very_long_named_entity_gamma', 'instance', { _typeId: 2, label: 'very_long_named_entity_gamma' });
    const nodes = [n1, n2, n3];
    const links = [link(n1.id, n3.id), link(n2.id, n3.id)];

    applyDagreLayout(nodes, links, 1400, 900);

    expect(nodes.every(n => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true);
    // n1 and n2 are parallel inputs to n3; their horizontal distance must be generous (> 100px)
    expect(Math.abs(n1.x! - n2.x!)).toBeGreaterThanOrEqual(100);
    // n3 is a downstream dependency, so its Y coordinate must be below n1 and n2
    expect(n3.y!).toBeGreaterThan(n1.y!);
    expect(n3.y!).toBeGreaterThan(n2.y!);
  });

  it('proves topological flow layout preserves clear highway lanes between layers', () => {
    // 4 Layers with a skip-layer edge: L0 -> L1 -> L2 -> L3 and L0 -> L2 (skips L1)
    const l0 = node('l0', 'instance', { _typeId: 1 });
    const l1_a = node('l1_a', 'instance', { _typeId: 2 });
    const l1_b = node('l1_b', 'instance', { _typeId: 2 });
    const l2 = node('l2', 'instance', { _typeId: 3 });
    const l3 = node('l3', 'instance', { _typeId: 4 });

    const nodes = [l0, l1_a, l1_b, l2, l3];
    const links = [
      link('l0', 'l1_a'),
      link('l0', 'l1_b'),
      link('l1_a', 'l2'),
      link('l1_b', 'l2'),
      link('l2', 'l3'),
      link('l0', 'l2'), // skip-connection
    ];

    applyTopologicalFlowLayout(nodes, links, 1600, 900, { direction: 'LR' });

    // Strict monotonic progression of layer X coordinates
    expect(l0.x!).toBeLessThan(l1_a.x!);
    expect(l1_a.x!).toBeLessThan(l2.x!);
    expect(l2.x!).toBeLessThan(l3.x!);

    // Generous highway corridor separation between columns (>= 280px)
    expect(l1_a.x! - l0.x!).toBeGreaterThanOrEqual(280);
    expect(l2.x! - l1_a.x!).toBeGreaterThanOrEqual(280);

    // Intermediate nodes l1_a and l1_b have open vertical channel between them (>= 120px)
    expect(Math.abs(l1_b.y! - l1_a.y!)).toBeGreaterThanOrEqual(120);
  });

  it('proves grouped circular layout separates distinct clusters with ample spacing', () => {
    const hub1 = node('hub1', 'typeHub', { _typeId: 1 });
    const hub2 = node('hub2', 'typeHub', { _typeId: 2 });
    const i1 = node('i1', 'instance', { _typeId: 1, _objId: 1 });
    const i2 = node('i2', 'instance', { _typeId: 2, _objId: 2 });
    const nodes = [hub1, hub2, i1, i2];

    applyGroupedCircularLayout(nodes, 1200, 800);

    expect(nodes.every(n => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true);
    // Cluster hubs are separated on macro circle (> 200px)
    const hubDist = Math.hypot(hub1.x! - hub2.x!, hub1.y! - hub2.y!);
    expect(hubDist).toBeGreaterThanOrEqual(200);
  });

  it('proves computeInitialPositions spreads connected components with generous radii', () => {
    const hub = node('hub', 'typeHub', { _typeId: 1 });
    const i1 = node('i1', 'instance', { _typeId: 1, _objId: 1 });
    const i2 = node('i2', 'instance', { _typeId: 1, _objId: 2 });
    const i3 = node('i3', 'instance', { _typeId: 1, _objId: 3 });
    const nodes = [hub, i1, i2, i3];
    const typeHubs = [hub];

    computeInitialPositions(nodes, typeHubs, 1200, 800);

    expect(nodes.every(n => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true);
    // Instances should not collapse to canvas center (600, 400)
    for (const inst of [i1, i2, i3]) {
      const distToCenter = Math.hypot(inst.x! - 600, inst.y! - 400);
      expect(distToCenter).toBeGreaterThanOrEqual(100);
    }
  });

  it('proves applyConcentricLayout staggers dense instances into multi-track orbital corridors', () => {
    const hub1 = node('hub1', 'typeHub', { _typeId: 1 });
    // 7 instances in type 1: will trigger track 0, track 1, and track 2
    const instances = Array.from({ length: 7 }, (_, i) =>
      node(`inst_${i}`, 'instance', { _typeId: 1, _objId: i + 1 })
    );
    const nodes = [hub1, ...instances];

    applyConcentricLayout(nodes, 1400, 900);

    expect(nodes.every(n => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true);
    // Inner hub is clamped near center
    const hubDist = Math.hypot(hub1.x! - 700, hub1.y! - 450);
    expect(hubDist).toBeLessThanOrEqual(150);

    // Instances are distributed with minimum distance >= 200px from center
    for (const inst of instances) {
      const d = Math.hypot(inst.x! - 700, inst.y! - 450);
      expect(d).toBeGreaterThanOrEqual(200);
    }

    // Nodes in different tracks have distinct radial distances (>= 50px delta)
    const radii = instances.map(inst => Math.hypot(inst.x! - 700, inst.y! - 450));
    const minRadius = Math.min(...radii);
    const maxRadius = Math.max(...radii);
    expect(maxRadius - minRadius).toBeGreaterThanOrEqual(50);
  });

  describe('Tutorial lessons horizontalTree layout verification (Lessons 0001-0014)', () => {
    const fs = require('fs');
    const path = require('path');

    for (let i = 1; i <= 14; i++) {
      const lessonId = `lesson-${String(i).padStart(4, '0')}`;
      const seedFile = path.resolve(__dirname, `../../../data/ontology/seed-${lessonId}.json`);

      it(`correctly stratifies and lays out ${lessonId} with applyHorizontalTreeLayout`, () => {
        const raw = JSON.parse(fs.readFileSync(seedFile, 'utf-8'));
        const { objectTypes, objects, links } = raw;

        const graphNodes: GraphNode[] = [
          ...objectTypes.map((ot: any) => ({
            id: `hub_${ot.id}`,
            label: ot.name,
            group: 'typeHub' as const,
            _typeId: ot.id,
            _typeName: ot.name,
          })),
          ...objects.map((obj: any) => ({
            id: `inst_${obj.id}`,
            label: obj.name,
            group: 'instance' as const,
            _typeId: obj.type_id,
            _objId: obj.id,
          })),
        ];

        const graphLinks: GraphLink[] = links.map((l: any, idx: number) => ({
          id: `link_${idx}`,
          source: `inst_${l.source_id}`,
          target: `inst_${l.target_id}`,
          name: l.name,
        }));

        applyHorizontalTreeLayout(graphNodes, 1600, 900, graphLinks);

        // 1. All nodes receive finite, valid coordinates
        expect(graphNodes.every(n => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true);

        // 2. Nodes are distinct (no two instances overlap exactly at the same point)
        const instances = graphNodes.filter(n => n.group === 'instance');
        for (let a = 0; a < instances.length; a++) {
          for (let b = a + 1; b < instances.length; b++) {
            const dist = Math.hypot(instances[a].x! - instances[b].x!, instances[a].y! - instances[b].y!);
            expect(dist).toBeGreaterThanOrEqual(30);
          }
        }

        // 3. For directed links in the DAG, target x is >= source x
        for (const l of graphLinks) {
          const srcNode = graphNodes.find(n => n.id === l.source);
          const tgtNode = graphNodes.find(n => n.id === l.target);
          if (srcNode && tgtNode) {
            expect(tgtNode.x!).toBeGreaterThanOrEqual(srcNode.x!);
          }
        }
      });
    }
  });
});



