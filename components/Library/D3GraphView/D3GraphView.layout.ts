/**
 * D3GraphView — Layout Algorithms
 *
 * Extracted from D3GraphView.tsx.
 * Contains all initial layout algorithms:
 *   - computeInitialPositions: connected-component clustering layout
 *   - applyDagreLayout: hierarchical DAG layout
 *   - computeVisibleLabelIds: collision-aware label visibility
 */

import { graphlib, layout as dagreLayout } from 'dagre';
import { quadtree } from 'd3';
import type { GraphNode, GraphLink, LifeLink } from './D3GraphView.types';

export type OntologyLayoutMode = 'spoke' | 'analysis';

export interface LayoutPlacement {
  x: number;
  y: number;
  depth: number;
  branchIndex: number;
  branchAngle: number;
  parentId: string | null;
  labelAnchor: 'start' | 'end' | 'middle';
}

export interface LayoutResult {
  placements: Map<string, LayoutPlacement>;
  rootId: string | null;
  branchCount: number;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

export interface RelationBundle {
  id: string;
  sourceBranch: number;
  targetBranch: number;
  relationTypeIds: number[];
  links: GraphLink[];
  count: number;
}

const linkNodeId = (value: string | GraphNode) => typeof value === 'object' ? value.id : value;

/** Collapse semantic links that would otherwise cut across two visual branches. */
export function aggregateCrossBranchLinks(links: GraphLink[], nodeMap?: Map<string, GraphNode>): GraphLink[] {
  const bundles = new Map<string, RelationBundle>();
  const keep: GraphLink[] = [];
  links.forEach(link => {
    const source = (typeof link.source === 'object' ? link.source : nodeMap?.get(link.source)) as GraphNode | null | undefined;
    const target = (typeof link.target === 'object' ? link.target : nodeMap?.get(link.target)) as GraphNode | null | undefined;
    if (typeof source !== 'object' || typeof target !== 'object' ||
        source.group !== 'instance' || target.group !== 'instance' ||
        source._branchIndex == null || target._branchIndex == null ||
        source._branchIndex === target._branchIndex) {
      keep.push(link);
      return;
    }
    const branchA = Math.min(source._branchIndex, target._branchIndex);
    const branchB = Math.max(source._branchIndex, target._branchIndex);
    const typeId = link._linkTypeId ?? 0;
    const key = `${branchA}|${branchB}|${typeId}`;
    const bundle = bundles.get(key) || {
      id: `bundle:${key}`,
      sourceBranch: branchA,
      targetBranch: branchB,
      relationTypeIds: typeId ? [typeId] : [],
      links: [],
      count: 0,
    };
    bundle.links.push(link);
    bundle.count += 1;
    bundles.set(key, bundle);
  });
  bundles.forEach(bundle => {
    const first = bundle.links[0];
    keep.push({
      ...first,
      _isRelationBundle: true,
      _bundleId: bundle.id,
      _bundleCount: bundle.count,
      _relations: bundle.links.map(link => link._linkTypeName || 'relation'),
      _mergedIndices: bundle.links.map((_, index) => index),
      color: 'rgba(255, 210, 92, 0.48)',
      weight: Math.max(...bundle.links.map(link => link.weight || 0.4)),
    });
  });
  return keep;
}

const place = (
  placements: Map<string, LayoutPlacement>,
  node: GraphNode,
  x: number,
  y: number,
  depth: number,
  branchIndex: number,
  branchAngle: number,
  parentId: string | null,
) => {
  const anchor: LayoutPlacement['labelAnchor'] = Math.abs(x) < 46 ? 'middle' : x < 0 ? 'end' : 'start';
  node.x = x;
  node.y = y;
  node.fx = x;
  node.fy = y;
  node._focusLevel = depth;
  node._branchIndex = branchIndex;
  node._branchAngle = branchAngle;
  node._parentId = parentId;
  placements.set(node.id, { x, y, depth, branchIndex, branchAngle, parentId, labelAnchor: anchor });
};

/** Stable center-rooted tree layout used by the default ontology view. */
export function applySpokeLayout(
  nodes: GraphNode[],
  links: GraphLink[],
  W: number,
  H: number,
  focusedNodeId?: string | null,
): LayoutResult {
  const instances = nodes.filter(node => node.group === 'instance').sort((a, b) => a.id.localeCompare(b.id));
  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const adjacency = new Map<string, Set<string>>(instances.map(node => [node.id, new Set()]));
  links.forEach(link => {
    const source = nodeById.get(linkNodeId(link.source));
    const target = nodeById.get(linkNodeId(link.target));
    if (source?.group !== 'instance' || target?.group !== 'instance') return;
    adjacency.get(source.id)?.add(target.id);
    adjacency.get(target.id)?.add(source.id);
  });
  const degree = (id: string) => adjacency.get(id)?.size || 0;
  const root = nodeById.get(focusedNodeId || '')?.group === 'instance'
    ? nodeById.get(focusedNodeId!)!
    : instances.slice().sort((a, b) => degree(b.id) - degree(a.id) || a.id.localeCompare(b.id))[0] || null;
  const placements = new Map<string, LayoutPlacement>();
  if (!root) return { placements, rootId: null, branchCount: 0, bounds: { minX: 0, minY: 0, maxX: W, maxY: H } };

  const cx = W / 2;
  const cy = H / 2;
  const visited = new Set<string>([root.id]);
  const parentById = new Map<string, string | null>([[root.id, null]]);
  const depthById = new Map<string, number>([[root.id, 0]]);
  const childrenById = new Map<string, string[]>();
  const queue = [root.id];
  while (queue.length) {
    const current = queue.shift()!;
    const depth = depthById.get(current) || 0;
    if (depth >= 3) continue;
    const children = [...(adjacency.get(current) || [])]
      .filter(id => !visited.has(id))
      .sort((a, b) => degree(b) - degree(a) || a.localeCompare(b));
    childrenById.set(current, children);
    children.forEach(child => {
      visited.add(child);
      parentById.set(child, current);
      depthById.set(child, depth + 1);
      queue.push(child);
    });
  }

  place(placements, root, cx, cy, 0, 0, -Math.PI / 2, null);
  const branches = childrenById.get(root.id) || [];
  const branchCount = Math.max(branches.length, 1);
  const baseAngle = -Math.PI / 2;
  const branchStep = (Math.PI * 2) / branchCount;
  const branchDistance = Math.max(148, Math.min(W, H) * 0.24);
  branches.forEach((branchId, branchIndex) => {
    const angle = baseAngle + branchIndex * branchStep;
    const branchRoot = nodeById.get(branchId);
    if (!branchRoot) return;
    const branchRing = Math.floor(branchIndex / 18);
    const branchRadius = branchDistance + branchRing * 54;
    place(placements, branchRoot, cx + Math.cos(angle) * branchRadius, cy + Math.sin(angle) * branchRadius, 1, branchIndex, angle, root.id);
    const walk = (parentId: string, depth: number) => {
      const parent = nodeById.get(parentId);
      if (!parent || depth >= 3) return;
      const children = childrenById.get(parentId) || [];
      const spread = Math.min(0.82, Math.max(0.28, (children.length - 1) * 0.18));
      const radius = branchDistance + (depth - 1) * Math.max(118, Math.min(W, H) * 0.17);
      children.forEach((childId, index) => {
        const child = nodeById.get(childId);
        if (!child) return;
        const childAngle = angle + (children.length === 1 ? 0 : -spread / 2 + index * (spread / (children.length - 1)));
        place(placements, child, cx + Math.cos(angle) * radius + Math.cos(childAngle + Math.PI / 2) * (index - (children.length - 1) / 2) * 75, cy + Math.sin(angle) * radius + Math.sin(childAngle + Math.PI / 2) * (index - (children.length - 1) / 2) * 75, depth, branchIndex, childAngle, parentId);
        walk(childId, depth + 1);
      });
    };
    walk(branchId, 2);
  });

  // Disconnected entities become quiet satellite clusters around the outside.
  const disconnected = instances.filter(node => !visited.has(node.id));
  const satelliteRadius = Math.max(branchDistance * 2.15, Math.min(W, H) * 0.42);
  disconnected.forEach((node, index) => {
    const angle = baseAngle + ((index + 0.5) / Math.max(disconnected.length, 1)) * Math.PI * 2;
    const ring = Math.floor(index / 10);
    place(placements, node, cx + Math.cos(angle) * (satelliteRadius + ring * 54), cy + Math.sin(angle) * (satelliteRadius + ring * 54), 3, branchCount + index, angle, null);
  });

  const actionsByOwner = new Map<number, GraphNode[]>();
  nodes.filter(node => node.group === 'action').forEach(action => {
    const list = actionsByOwner.get(action._objId || 0) || [];
    list.push(action);
    actionsByOwner.set(action._objId || 0, list);
  });
  actionsByOwner.forEach((actions, ownerId) => {
    const owner = instances.find(node => node._objId === ownerId);
    if (!owner || owner.x == null || owner.y == null) return;
    const ownerPlacement = placements.get(owner.id)!;
    const spread = Math.min(0.75, Math.max(0.24, (actions.length - 1) * 0.18));
    actions.sort((a, b) => a.id.localeCompare(b.id)).forEach((action, index) => {
      const angle = ownerPlacement.branchAngle + (actions.length === 1 ? 0 : -spread / 2 + index * spread / (actions.length - 1));
      const distance = 48 + Math.floor(index / 6) * 24;
      place(placements, action, owner.x! + Math.cos(angle) * distance, owner.y! + Math.sin(angle) * distance, ownerPlacement.depth + 1, ownerPlacement.branchIndex, angle, owner.id);
    });
  });

  nodes.filter(node => node.group === 'typeHub').forEach((hub, index) => {
    const member = instances.find(node => node._typeId === hub._typeId && placements.has(node.id));
    const angle = member ? placements.get(member.id)!.branchAngle : baseAngle + index * branchStep;
    const x = member?.x != null ? member.x - Math.cos(angle) * 34 : cx + Math.cos(angle) * 86;
    const y = member?.y != null ? member.y - Math.sin(angle) * 34 : cy + Math.sin(angle) * 86;
    place(placements, hub, x, y, member ? placements.get(member.id)!.depth : 1, member ? placements.get(member.id)!.branchIndex : index, angle, member?.id || null);
  });
  nodes.filter(node => node.group === 'linkType').forEach((node, index) => {
    place(placements, node, cx + Math.cos(baseAngle + index * 0.35) * 70, cy + Math.sin(baseAngle + index * 0.35) * 70, 1, index, baseAngle, null);
  });

  const points = [...placements.values()];
  return {
    placements,
    rootId: root.id,
    branchCount,
    bounds: {
      minX: Math.min(...points.map(point => point.x)), minY: Math.min(...points.map(point => point.y)),
      maxX: Math.max(...points.map(point => point.x)), maxY: Math.max(...points.map(point => point.y)),
    },
  };
}

/**
 * A deterministic, hierarchy-first layout for the ontology view.
 *
 * The graph is divided into type sectors. Each type hub is the flower centre,
 * its instances are fanned out on one or more outward rings, and actions sit
 * just beyond their owning instance. Unlike a force simulation, this gives the
 * same data the same visual grammar on every refresh and keeps labels/nodes
 * from collapsing into a hairball.
 */
export function applyDandelionLayout(nodes: GraphNode[], links: GraphLink[], W: number, H: number): void {
  const cx = W / 2;
  const cy = H / 2;
  const typeHubs = nodes.filter(n => n.group === 'typeHub').sort((a, b) => a.id.localeCompare(b.id));
  const instances = nodes.filter(n => n.group === 'instance');
  const actions = nodes.filter(n => n.group === 'action');
  const typeCount = Math.max(typeHubs.length, 1);

  // Keep the hub orbit compact enough for the graph to remain legible on a
  // small viewport, while giving multiple categories a clear direction.
  const hubRadius = typeCount === 1 ? 0 : Math.min(128, Math.max(84, Math.min(W, H) * 0.16));
  const sectorSize = (Math.PI * 2) / typeCount;
  const hubAngle = (index: number) => -Math.PI / 2 + index * sectorSize;

  typeHubs.forEach((hub, index) => {
    const angle = hubAngle(index);
    hub.x = cx + Math.cos(angle) * hubRadius;
    hub.y = cy + Math.sin(angle) * hubRadius;
    hub.fx = hub.x;
    hub.fy = hub.y;
  });

  const instancesByType = new Map<number, GraphNode[]>();
  instances.forEach(node => {
    const list = instancesByType.get(node._typeId || 0) || [];
    list.push(node);
    instancesByType.set(node._typeId || 0, list);
  });

  // The available angular width is split into rows when a type has many
  // entities. This avoids relying on collision physics as the only safeguard.
  typeHubs.forEach((hub, typeIndex) => {
    const list = (instancesByType.get(hub._typeId || 0) || []).sort((a, b) => a.id.localeCompare(b.id));
    const sectorStart = hubAngle(typeIndex) - sectorSize * 0.38;
    const span = Math.max(sectorSize * 0.62, Math.PI / 3);
    const minLeafGap = 65;
    const maxPerRing = Math.max(2, Math.floor((span * 210) / minLeafGap));
    list.forEach((node, index) => {
      const ring = Math.floor(index / maxPerRing);
      const inRing = index % maxPerRing;
      const ringSize = Math.min(maxPerRing, list.length - ring * maxPerRing);
      const t = ringSize <= 1 ? 0.5 : inRing / (ringSize - 1);
      const angle = sectorStart + t * span;
      const radius = Math.max(184, Math.min(W, H) * 0.31) + ring * 75;
      node.x = cx + Math.cos(angle) * radius;
      node.y = cy + Math.sin(angle) * radius;
      node.fx = node.x;
      node.fy = node.y;
    });

    // Use the type hub's actual angle as a visual anchor for its children.
    if (list.length === 0 && hubRadius > 0) {
      hub.x = cx + Math.cos(hubAngle(typeIndex)) * hubRadius;
      hub.y = cy + Math.sin(hubAngle(typeIndex)) * hubRadius;
    }
  });

  // A partially initialized ontology may contain objects before its type rows
  // are available. Keep those objects visible instead of leaving them at the
  // SVG origin where they would overlap.
  const positionedInstances = new Set(
    typeHubs.flatMap(hub => instancesByType.get(hub._typeId || 0) || [])
  );
  instances.filter(node => !positionedInstances.has(node)).forEach((node, index, list) => {
    const angle = -Math.PI / 2 + (index / Math.max(list.length, 1)) * Math.PI * 2;
    const radius = Math.max(184, Math.min(W, H) * 0.31);
    node.x = cx + Math.cos(angle) * radius;
    node.y = cy + Math.sin(angle) * radius;
    node.fx = node.x;
    node.fy = node.y;
  });

  // Actions become small outward petals around the owning instance.
  const actionsByOwner = new Map<number, GraphNode[]>();
  actions.forEach(node => {
    const list = actionsByOwner.get(node._objId || 0) || [];
    list.push(node);
    actionsByOwner.set(node._objId || 0, list);
  });
  actionsByOwner.forEach((list, ownerId) => {
    const owner = instances.find(n => n._objId === ownerId);
    if (!owner || owner.x == null || owner.y == null) return;
    const outward = Math.atan2(owner.y - cy, owner.x - cx);
    const span = Math.min(Math.PI * 0.72, Math.max(Math.PI / 5, (list.length - 1) * 0.24));
    list.sort((a, b) => a.id.localeCompare(b.id)).forEach((node, index) => {
      const t = list.length <= 1 ? 0.5 : index / (list.length - 1);
      const angle = outward - span / 2 + t * span;
      const radius = 52 + Math.floor(index / 5) * 24;
      node.x = owner.x! + Math.cos(angle) * radius;
      node.y = owner.y! + Math.sin(angle) * radius;
      node.fx = node.x;
      node.fy = node.y;
    });
  });

  // Link types are metadata nodes in this view; keep them on a quiet inner
  // orbit so they never compete with the entity hierarchy.
  nodes.filter(n => n.group === 'linkType').forEach((node, index, list) => {
    const angle = -Math.PI / 2 + (index / Math.max(list.length, 1)) * Math.PI * 2;
    node.x = cx + Math.cos(angle) * 34;
    node.y = cy + Math.sin(angle) * 34;
    node.fx = node.x;
    node.fy = node.y;
  });

  // Keep the relationship parameter in the function signature intentional:
  // it documents that this is a topology layout and leaves room for routing
  // strategies to use semantic edges without changing the public API.
  void links;
}

/**
 * Relationship-reading layout. The selected entity is the stable centre,
 * direct neighbours occupy the first orbit, and second-hop neighbours occupy
 * the next orbit. Non-entity metadata stays close to its owning entity so the
 * relation graph remains complete without turning into a hairball.
 */
export function applyRelationshipAnalysisLayout(
  nodes: GraphNode[],
  links: GraphLink[],
  W: number,
  H: number,
  focusedNodeId?: string | null,
): string | null {
  return applySpokeLayout(nodes, links, W, H, focusedNodeId).rootId;
}

// ── Initial Positions: Connected-Component Clustering ─────────────────────────

/**
 * Compute initial node positions using CONNECTED-COMPONENT clustering.
 *
 * Algorithm:
 * 1. Build a graph of instance nodes and their links
 * 2. Find all connected components (clusters of related objects)
 * 3. Assign each component a sector (pie slice) around the center
 * 4. Within each component, place nodes in a radial layout
 *    - Heaviest-linked node at center of sector
 *    - Connected nodes in an inner ring
 *    - Peripheral nodes in an outer ring
 * 5. TypeHub nodes go on a wide outer ring, grouped by type
 * 6. Actions cluster near their owning object
 * 7. linkType nodes: tiny ring at center
 *
 * This eliminates the "hairball" problem — nodes that are connected
 * appear near each other; nodes that are unrelated are separated.
 */
export function computeInitialPositions(
  nodes: GraphNode[],
  typeHubNodes: GraphNode[],
  svgW: number,
  svgH: number,
  rawLinks?: LifeLink[]
): void {
  const cx = svgW / 2;
  const cy = svgH / 2;
  const instanceNodes = nodes.filter(n => n.group === 'instance');
  const actionNodes = nodes.filter(n => n.group === 'action');
  const linkTypeNodes = nodes.filter(n => n.group === 'linkType');

  // ── Build adjacency map ──────────────────────────────────────────────────
  const adj: Record<number, { neighbor: number; weight: number }[]> = {};
  // Guard: only process nodes that have _objId, otherwise adj[undefined] pollutes the map
  instanceNodes.filter(n => n._objId !== undefined).forEach(n => { adj[n._objId!] = []; });

  if (rawLinks) {
    for (const link of rawLinks) {
      const srcId = Number(link.source_object_id);
      const tgtId = Number(link.target_object_id);
      const w = Number(link.weight) || 0.5;
      if (adj[srcId] && adj[tgtId]) {
        adj[srcId].push({ neighbor: tgtId, weight: w });
        adj[tgtId].push({ neighbor: srcId, weight: w });
      }
    }
  }

  // ── Find connected components via BFS ────────────────────────────────────
  const visited = new Set<number>();
  const components: { nodes: GraphNode[]; degree: number }[] = [];

  instanceNodes.filter(n => n._objId !== undefined).forEach(instNode => {
    const id = instNode._objId!;
    if (visited.has(id)) return;
    const compNodes: GraphNode[] = [];
    let totalDegree = 0;
    const queue = [id];
    visited.add(id);
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const node = instanceNodes.find(n => n._objId === cur)!;
      if (node) {
        compNodes.push(node);
        totalDegree += (adj[cur] || []).length;
      }
      for (const { neighbor } of (adj[cur] || [])) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    compNodes.sort((a, b) => {
      const degA = adj[a._objId!]?.length ?? 0;
      const degB = adj[b._objId!]?.length ?? 0;
      return degB - degA || a.label.localeCompare(b.label);
    });
    components.push({ nodes: compNodes, degree: totalDegree });
  });

  components.sort((a, b) => b.degree - a.degree);

  // ── Assign sectors (pie slices) to each component ───────────────────────
  const N = components.length || 1;
  const sectorAngle = (2 * Math.PI) / N;
  const sectorGap = 0.08;
  const effectiveAngle = sectorAngle - sectorGap;
  const sectorMidAngles: number[] = [];
  for (let i = 0; i < N; i++) {
    sectorMidAngles.push(i * sectorAngle + sectorAngle / 2 - Math.PI / 2);
  }

  const innerR = 70;
  const ring1R = 140;
  const ring2R = 210;

  components.forEach((comp, ci) => {
    const midAngle = sectorMidAngles[ci];
    const total = comp.nodes.length;

    comp.nodes.forEach((node, ni) => {
      const neighbors = adj[node._objId!] || [];
      const hasConnections = neighbors.length > 0;

      let r: number;
      if (ni === 0) {
        r = innerR;
      } else if (hasConnections) {
        r = innerR + (ring1R - innerR) * Math.min((neighbors.length) / 4, 1);
      } else {
        r = ring1R + (ring2R - innerR) * Math.min((ni) / Math.max(total - 1, 1), 1);
      }

      const ringTotal = total - 1;
      const ringIndex = hasConnections ? ni - 1 : ni;
      const posInRing = ringTotal > 0 ? ringIndex / Math.max(ringTotal, 1) : 0;
      const angleSpread = effectiveAngle * 0.85;
      const angleOffset = (posInRing - 0.5) * angleSpread;

      if (node.x === undefined || node.y === undefined || isNaN(node.x) || isNaN(node.y)) {
        if (node._communityId !== undefined) {
          const communityNodes = instanceNodes.filter(n => n._communityId === node._communityId);
          const repNode = communityNodes.find(n => n.x !== undefined && n.y !== undefined && !isNaN(n.x!));
          if (repNode && repNode.x !== undefined && repNode.y !== undefined) {
            node.x = repNode.x + (Math.random() - 0.5) * 35;
            node.y = repNode.y + (Math.random() - 0.5) * 35;
            return;
          }
        }
        node.x = cx + r * Math.cos(midAngle + angleOffset);
        node.y = cy + r * Math.sin(midAngle + angleOffset);
      }
    });
  });

  // ── TypeHub nodes: wide outer ring grouped by type order ──────────────────
  const typeHubRadius = 310;
  typeHubNodes.forEach((node, i) => {
    if (node.x === undefined || node.y === undefined || isNaN(node.x) || isNaN(node.y)) {
      const angle = (i / Math.max(typeHubNodes.length, 1)) * 2 * Math.PI - Math.PI / 2;
      node.x = cx + typeHubRadius * Math.cos(angle);
      node.y = cy + typeHubRadius * Math.sin(angle);
    }
  });

  // ── Action nodes: cluster near the object they own ──────────────────────
  actionNodes.forEach((node, i) => {
    if (node.x === undefined || node.y === undefined || isNaN(node.x) || isNaN(node.y)) {
      const ownerId = node._objId!;
      const owner = instanceNodes.find(n => n._objId === ownerId);
      if (owner && owner.x !== undefined && owner.y !== undefined && !isNaN(owner.x!)) {
        const angle = (i / Math.max(actionNodes.length, 1)) * 2 * Math.PI;
        const r = 45;
        node.x = owner.x + r * Math.cos(angle);
        node.y = owner.y + r * Math.sin(angle);
      } else {
        node.x = cx + 55 * Math.cos((i / Math.max(actionNodes.length, 1)) * 2 * Math.PI);
        node.y = cy + 55 * Math.sin((i / Math.max(actionNodes.length, 1)) * 2 * Math.PI);
      }
    }
  });

  // ── linkType nodes: tiny ring at center ─────────────────────────────────
  linkTypeNodes.forEach((node, i) => {
    if (node.x === undefined || node.y === undefined || isNaN(node.x) || isNaN(node.y)) {
      node.x = cx + 28 * Math.cos((i / Math.max(linkTypeNodes.length, 1)) * 2 * Math.PI);
      node.y = cy + 28 * Math.sin((i / Math.max(linkTypeNodes.length, 1)) * 2 * Math.PI);
    }
  });
}

/**
 * Compute optimal hierarchical layout using the Dagre library.
 * Assigns each node a position (x, y) and pins them (fx, fy).
 */
export function applyDagreLayout(nodes: GraphNode[], links: GraphLink[], W: number, H: number): void {
  const g = new graphlib.Graph();
  g.setGraph({
    rankdir: 'TB',
    nodesep: 55,
    edgesep: 25,
    ranksep: 75,
    marginx: 50,
    marginy: 50
  });
  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach(n => {
    const size = n.size || 12;
    g.setNode(n.id, { width: size * 2.5, height: size * 2.5 });
  });

  links.forEach(l => {
    const sId = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
    const tId = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
    g.setEdge(sId, tId);
  });

  dagreLayout(g);

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  nodes.forEach(n => {
    const dn = g.node(n.id);
    if (dn) {
      if (dn.x < minX) minX = dn.x;
      if (dn.x > maxX) maxX = dn.x;
      if (dn.y < minY) minY = dn.y;
      if (dn.y > maxY) maxY = dn.y;
    }
  });

  const dagreW = maxX - minX || 1;
  const dagreH = maxY - minY || 1;

  const padding = 60;
  const scaleX = (W - padding * 2) / dagreW;
  const scaleY = (H - padding * 2) / dagreH;
  const scale = Math.min(scaleX, scaleY, 1.25);

  const cx = W / 2;
  const cy = H / 2;
  const dagreCx = minX + dagreW / 2;
  const dagreCy = minY + dagreH / 2;

  nodes.forEach(n => {
    const dn = g.node(n.id);
    if (dn) {
      n.x = cx + (dn.x - dagreCx) * scale;
      n.y = cy + (dn.y - dagreCy) * scale;
      // Preserve user-pinned nodes (from force-layout drag); dagre only pins nodes the user hasn't pinned
      if (!(n as any)._userPinned) {
        n.fx = n.x;
        n.fy = n.y;
      }
    }
  });
}

export function computeVisibleLabelIds(
  nodes: GraphNode[],
  topCentrality: Set<string>,
  zoom: number,
  labelMode: string,
  hoveredNodeId: string | null,
): Set<string> {
  const visible = new Set<string>();
  if (labelMode === 'all') {
    return new Set(nodes.filter(n => n.group !== 'linkType').map(n => n.id));
  }
  if (labelMode === 'top') {
    return new Set([...topCentrality]);
  }
  if (labelMode === 'hover') {
    if (!hoveredNodeId) return new Set();
    const hovered = nodes.find(n => n.id === hoveredNodeId);
    if (!hovered) return new Set();
    return new Set([hoveredNodeId]);
  }

  if (zoom < 0.25) {
    // At extremely low zoom, show only top-centrality typeHubs
    const lowZoomCandidates = nodes.filter(n => {
      if (n.group === 'linkType') return false;
      if (topCentrality.has(n.id) && n.group === 'typeHub') return true;
      return false;
    });
    return new Set(lowZoomCandidates.map(n => n.id));
  }

  let candidates = nodes.filter(n => {
    if (n.group === 'linkType') return false;
    if (topCentrality.has(n.id)) return true;
    if (zoom < 0.45) {
      // Hide action labels at lower zoom levels, but show type hubs and high-degree instances
      return n.group === 'typeHub' || (n.group === 'instance' && ((n as any)._degree || 0) >= 2);
    }
    if (zoom < 0.75) {
      // Hide actions, show all type hubs and instances
      return n.group !== 'action';
    }
    return true;
  });

  candidates.sort((a, b) => {
    const getGroupWeight = (group?: string) => {
      if (group === 'typeHub') return 4;
      if (group === 'action') return 3;
      if (group === 'instance') return 2;
      return 1;
    };
    const gwA = getGroupWeight(a.group);
    const gwB = getGroupWeight(b.group);
    if (gwA !== gwB) return gwB - gwA;
    // P5: 5-level sort key — ensures typeHub nodes with many instances are shown first
    const degA = (a as any)._degree || 0;
    const degB = (b as any)._degree || 0;
    if (degA !== degB) return degB - degA;
    const instA = (a as any)._instanceCount || 0;
    const instB = (b as any)._instanceCount || 0;
    if (instA !== instB) return instB - instA;
    return (a.label?.length || 0) - (b.label?.length || 0);
  });

  const LABEL_W = Math.max(60, 90 * Math.min(1, zoom));
  const LABEL_H = Math.max(12, 16 * Math.min(1, zoom));
  const PADDING = 4;
  const maxLabels = zoom > 4.0 ? 120 : 60;

  const placedQuadtree = quadtree<{ x: number; y: number }>()
    .x(d => d.x).y(d => d.y)
    .addAll([]);

  for (const node of candidates) {
    const x = (node.x || 0) + (node.size || 10) + 5;
    const y = (node.y || 0) + 4;
    const queryingW = LABEL_W * (node.label?.length || 5) / 5;
    const queryingH = LABEL_H;

    const conflicting = placedQuadtree.visit((qn, qx0, qy0, qx1, qy1) => {
      if (!qn.length) {
        const pt = (qn as d3.QuadtreeLeaf<{ x: number; y: number }>).data;
        const dx = Math.abs(pt.x - x);
        const dy = Math.abs(pt.y - y);
        return dx < queryingW + PADDING && dy < queryingH + PADDING;
      }
      return qx0 > x + queryingW + PADDING || qx1 < x - queryingW - PADDING
          || qy0 > y + queryingH + PADDING || qy1 < y - queryingH - PADDING;
    });
    if (!conflicting) {
      visible.add(node.id);
      placedQuadtree.add({ x, y });
    }
    if (visible.size >= maxLabels) break;
  }

  return visible;
}

/**
 * Compute concentric ring layout.
 * TypeHubs in inner circle, Instances in middle circle, Actions in outer circle.
 */
export function applyConcentricLayout(nodes: GraphNode[], W: number, H: number): void {
  const cx = W / 2;
  const cy = H / 2;
  
  const typeHubs = nodes.filter(n => n.group === 'typeHub');
  const instances = nodes.filter(n => n.group === 'instance');
  const actions = nodes.filter(n => n.group === 'action');
  const other = nodes.filter(n => n.group !== 'typeHub' && n.group !== 'instance' && n.group !== 'action');

  // Inner ring: TypeHubs
  typeHubs.sort((a, b) => a.id.localeCompare(b.id)).forEach((node, i) => {
    const angle = (i / Math.max(typeHubs.length, 1)) * 2 * Math.PI - Math.PI / 2;
    const r = 90;
    node.x = cx + r * Math.cos(angle);
    node.y = cy + r * Math.sin(angle);
    node.fx = node.x;
    node.fy = node.y;
  });

  // Middle ring: Instances (grouped by type)
  instances.sort((a, b) => {
    const typeA = a._typeId || 0;
    const typeB = b._typeId || 0;
    return typeA - typeB || a.id.localeCompare(b.id);
  }).forEach((node, i) => {
    const angle = (i / Math.max(instances.length, 1)) * 2 * Math.PI - Math.PI / 2;
    const r = 200 + (i % 2) * 65;
    node.x = cx + r * Math.cos(angle);
    node.y = cy + r * Math.sin(angle);
    node.fx = node.x;
    node.fy = node.y;
  });

  // Outer ring: Actions, or clustered around their instances
  actions.forEach((node) => {
    const parentId = `obj::${node._objId}`;
    const parent = instances.find(n => n.id === parentId);
    if (parent && parent.x !== undefined && parent.y !== undefined) {
      const dx = parent.x - cx;
      const dy = parent.y - cy;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const r_offset = 55;
      node.x = parent.x + (dx / len) * r_offset;
      node.y = parent.y + (dy / len) * r_offset;
    } else {
      node.x = cx + 290 * Math.cos(Math.random() * 2 * Math.PI);
      node.y = cy + 290 * Math.sin(Math.random() * 2 * Math.PI);
    }
    node.fx = node.x;
    node.fy = node.y;
  });

  other.forEach((node, i) => {
    const angle = (i / Math.max(other.length, 1)) * 2 * Math.PI;
    const r = 320;
    node.x = cx + r * Math.cos(angle);
    node.y = cy + r * Math.sin(angle);
    node.fx = node.x;
    node.fy = node.y;
  });
}

/**
 * Compute Starburst layout.
 * Center node at (W/2, H/2). Primary neighbors in a circle.
 * Leaf nodes (like actions) fan out radially away from the center.
 */
export function applyStarburstLayout(nodes: GraphNode[], links: GraphLink[], W: number, H: number): void {
  const cx = W / 2;
  const cy = H / 2;

  if (nodes.length === 0) return;

  // 1. Calculate degree centrality to find the absolute center node
  const degreeMap: Record<string, number> = {};
  nodes.forEach(n => { degreeMap[n.id] = 0; });
  links.forEach(l => {
    const s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
    const t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
    if (degreeMap[s] !== undefined) degreeMap[s]++;
    if (degreeMap[t] !== undefined) degreeMap[t]++;
  });

  // Pick highest degree node as core center
  let centerNode = nodes[0];
  nodes.forEach(n => {
    if (degreeMap[n.id] > degreeMap[centerNode.id]) {
      centerNode = n;
    }
  });

  // Center node goes to center
  centerNode.x = cx;
  centerNode.y = cy;
  centerNode.fx = cx;
  centerNode.fy = cy;

  // 2. Identify neighbors of the center node (parents)
  const parentIds = new Set<string>();
  links.forEach(l => {
    const s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
    const t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
    if (s === centerNode.id) { parentIds.add(t); }
    if (t === centerNode.id) { parentIds.add(s); }
  });

  const parents = nodes.filter(n => parentIds.has(n.id) && n.id !== centerNode.id);
  const placedIds = new Set<string>([centerNode.id]);

  // Distribute parents in a circle
  const R1 = 180;
  parents.sort((a, b) => degreeMap[b.id] - degreeMap[a.id]).forEach((parent, i) => {
    const angle = (i / Math.max(parents.length, 1)) * 2 * Math.PI - Math.PI / 2;
    parent.x = cx + R1 * Math.cos(angle);
    parent.y = cy + R1 * Math.sin(angle);
    parent.fx = parent.x;
    parent.fy = parent.y;
    placedIds.add(parent.id);
    
    // 3. Find children of this parent (nodes connected to it, but not placed yet)
    const childNodes: GraphNode[] = [];
    links.forEach(l => {
      const s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
      const t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
      if (s === parent.id && !placedIds.has(t)) {
        const node = nodes.find(n => n.id === t);
        if (node) childNodes.push(node);
      }
      if (t === parent.id && !placedIds.has(s)) {
        const node = nodes.find(n => n.id === s);
        if (node) childNodes.push(node);
      }
    });

    // Distribute children in an arc fanning away
    const R2 = 60;
    const M = childNodes.length;
    if (M > 0) {
      const spread = Math.min(Math.PI / 3, (M * 12 * Math.PI) / 180);
      childNodes.sort((a, b) => a.id.localeCompare(b.id)).forEach((child, j) => {
        let childAngle = angle;
        if (M > 1) {
          childAngle = angle + (j - (M - 1) / 2) * (2 * spread / (M - 1));
        }
        child.x = parent.x! + R2 * Math.cos(childAngle);
        child.y = parent.y! + R2 * Math.sin(childAngle);
        child.fx = child.x;
        child.fy = child.y;
        placedIds.add(child.id);
      });
    }
  });

  // 4. Distribute any remaining nodes in an outer ring
  const remaining = nodes.filter(n => !placedIds.has(n.id));
  if (remaining.length > 0) {
    const R3 = 280;
    remaining.forEach((node, i) => {
      const angle = (i / remaining.length) * 2 * Math.PI;
      node.x = cx + R3 * Math.cos(angle);
      node.y = cy + R3 * Math.sin(angle);
      node.fx = node.x;
      node.fy = node.y;
    });
  }
}

/**
 * 二维网格排列 (Grid Layout)
 * 按照类型排序，分列分布，实例和行动紧密排列
 */
export function applyGridLayout(nodes: GraphNode[], W: number, H: number): void {
  const padding = 80;
  const availW = W - padding * 2;
  const availH = H - padding * 2;

  const typeHubs = nodes.filter(n => n.group === 'typeHub').sort((a, b) => a.id.localeCompare(b.id));
  const instances = nodes.filter(n => n.group === 'instance');
  const actions = nodes.filter(n => n.group === 'action');

  const typeCount = Math.max(typeHubs.length, 1);
  const colWidth = typeCount > 1 ? availW / (typeCount - 1) : availW;

  typeHubs.forEach((hub, colIdx) => {
    const colX = padding + colIdx * colWidth;
    hub.x = colX;
    hub.y = padding;
    hub.fx = hub.x;
    hub.fy = hub.y;

    const colInstances = instances
      .filter(n => n._typeId === hub._typeId)
      .sort((a, b) => a.id.localeCompare(b.id));

    if (colInstances.length === 0) return;
    const rowStep = colInstances.length > 1 ? availH / (colInstances.length - 1) : availH;

    colInstances.forEach((inst, rowIdx) => {
      inst.x = colX;
      inst.y = padding + rowIdx * rowStep + 40;
      inst.fx = inst.x;
      inst.fy = inst.y;

      const instActions = actions
        .filter(n => n._objId === inst._objId)
        .sort((a, b) => a.id.localeCompare(b.id));
      
      instActions.forEach((act, actIdx) => {
        act.x = inst.x! + 45 + actIdx * 25;
        act.y = inst.y!;
        act.fx = act.x;
        act.fy = act.y;
      });
    });
  });

  const handledIds = new Set(nodes.filter(n => n.fx !== undefined).map(n => n.id));
  const unhandled = nodes.filter(n => !handledIds.has(n.id));
  if (unhandled.length > 0) {
    const cols = Math.ceil(Math.sqrt(unhandled.length));
    const rows = Math.ceil(unhandled.length / cols);
    const stepX = cols > 1 ? availW / (cols - 1) : availW;
    const stepY = rows > 1 ? availH / (rows - 1) : availH;

    unhandled.forEach((node, idx) => {
      const c = idx % cols;
      const r = Math.floor(idx / cols);
      node.x = padding + c * stepX;
      node.y = padding + r * stepY + 120;
      node.fx = node.x;
      node.fy = node.y;
    });
  }
}

/**
 * 分组环形排列 (Grouped Circular Layout)
 * 不同类型的节点各自在独立的圆环上围绕其中心进行排列
 */
export function applyGroupedCircularLayout(nodes: GraphNode[], W: number, H: number): void {
  const cx = W / 2;
  const cy = H / 2;

  const typeHubs = nodes.filter(n => n.group === 'typeHub').sort((a, b) => a.id.localeCompare(b.id));
  const instances = nodes.filter(n => n.group === 'instance');
  const actions = nodes.filter(n => n.group === 'action');

  const typeCount = Math.max(typeHubs.length, 1);
  const layoutRadius = Math.min(W, H) * 0.28;

  typeHubs.forEach((hub, typeIdx) => {
    const typeAngle = (typeIdx / typeCount) * Math.PI * 2 - Math.PI / 2;
    const hubX = cx + Math.cos(typeAngle) * layoutRadius;
    const hubY = cy + Math.sin(typeAngle) * layoutRadius;

    hub.x = hubX;
    hub.y = hubY;
    hub.fx = hub.x;
    hub.fy = hub.y;

    const typeInstances = instances
      .filter(n => n._typeId === hub._typeId)
      .sort((a, b) => a.id.localeCompare(b.id));

    const instCount = typeInstances.length;
    if (instCount === 0) return;

    const instRadius = 55 + Math.floor(instCount / 10) * 15;
    typeInstances.forEach((inst, instIdx) => {
      const instAngle = typeAngle - Math.PI / 3 + (instIdx / Math.max(instCount - 1, 1)) * (Math.PI * 2 / 3);
      const finalAngle = instCount === 1 ? typeAngle : instAngle;
      inst.x = hubX + Math.cos(finalAngle) * instRadius;
      inst.y = hubY + Math.sin(finalAngle) * instRadius;
      inst.fx = inst.x;
      inst.fy = inst.y;

      const instActions = actions
        .filter(n => n._objId === inst._objId)
        .sort((a, b) => a.id.localeCompare(b.id));

      const actCount = instActions.length;
      if (actCount === 0) return;
      const actRadius = 30;
      instActions.forEach((act, actIdx) => {
        const actAngle = finalAngle - Math.PI / 4 + (actIdx / Math.max(actCount - 1, 1)) * (Math.PI / 2);
        const finalActAngle = actCount === 1 ? finalAngle : actAngle;
        act.x = inst.x! + Math.cos(finalActAngle) * actRadius;
        act.y = inst.y! + Math.sin(finalActAngle) * actRadius;
        act.fx = act.x;
        act.fy = act.y;
      });
    });
  });

  const handledIds = new Set(nodes.filter(n => n.fx !== undefined).map(n => n.id));
  const unhandled = nodes.filter(n => !handledIds.has(n.id));
  if (unhandled.length > 0) {
    unhandled.forEach((node, idx) => {
      const angle = (idx / unhandled.length) * Math.PI * 2;
      node.x = cx + Math.cos(angle) * (layoutRadius * 1.4);
      node.y = cy + Math.sin(angle) * (layoutRadius * 1.4);
      node.fx = node.x;
      node.fy = node.y;
    });
  }
}

/**
 * 纵向树状层级排列 (Vertical Tree Layout)
 * 顶部为类型集 (TypeHub)，中部为实例 (Instance)，底部为相关的行动/属性 (Action)
 */
export function applyVerticalTreeLayout(nodes: GraphNode[], W: number, H: number): void {
  const padding = 80;
  const availW = W - padding * 2;
  const availH = H - padding * 2;

  const typeHubs = nodes.filter(n => n.group === 'typeHub').sort((a, b) => a.id.localeCompare(b.id));
  const instances = nodes.filter(n => n.group === 'instance');
  const actions = nodes.filter(n => n.group === 'action');

  const typeCount = Math.max(typeHubs.length, 1);
  const colWidth = typeCount > 1 ? availW / (typeCount - 1) : availW;

  // Level Y coordinates
  const yType = padding + 40;
  const yInstBase = padding + 180;

  typeHubs.forEach((hub, colIdx) => {
    const colX = padding + colIdx * colWidth;
    hub.x = colX;
    hub.y = yType;
    hub.fx = hub.x;
    hub.fy = hub.y;

    const colInstances = instances
      .filter(n => n._typeId === hub._typeId)
      .sort((a, b) => a.id.localeCompare(b.id));

    const instCount = colInstances.length;
    if (instCount === 0) return;

    // Use a clean grid layout for instances under each TypeHub
    // Minimum horizontal space needed is 180px per node column to fit labels
    const maxCols = Math.max(1, Math.floor(colWidth / 180));
    const actualCols = Math.min(maxCols, instCount);
    
    colInstances.forEach((inst, instIdx) => {
      const gridCol = instIdx % actualCols;
      const gridRow = Math.floor(instIdx / actualCols);

      // Center the grid under the TypeHub
      const gridWidth = (actualCols - 1) * 180;
      const startX = colX - gridWidth / 2;
      
      inst.x = startX + gridCol * 180;
      inst.y = yInstBase + gridRow * 110; // Vertical spacing of 110px leaves plenty of room
      inst.fx = inst.x;
      inst.fy = inst.y;

      const instActions = actions
        .filter(n => n._objId === inst._objId)
        .sort((a, b) => a.id.localeCompare(b.id));

      const actCount = instActions.length;
      if (actCount === 0) return;

      // Arrange actions in a small horizontal row below their instance node
      const actSpacing = 55;
      const actWidth = (actCount - 1) * actSpacing;
      const actStartY = inst.y! + 55; // 55px below the instance node

      instActions.forEach((act, actIdx) => {
        act.x = inst.x! - actWidth / 2 + actIdx * actSpacing;
        act.y = actStartY;
        act.fx = act.x;
        act.fy = act.y;
      });
    });
  });

  const handledIds = new Set(nodes.filter(n => n.fx !== undefined).map(n => n.id));
  const unhandled = nodes.filter(n => !handledIds.has(n.id));
  if (unhandled.length > 0) {
    unhandled.forEach((node, idx) => {
      const step = availW / Math.max(unhandled.length - 1, 1);
      node.x = padding + idx * step;
      node.y = H - padding;
      node.fx = node.x;
      node.fy = node.y;
    });
  }
}

/**
 * 横向树状层级排列 (Horizontal Tree Layout)
 * 左侧为类型集 (TypeHub)，中部为实例 (Instance)，右侧为相关的行动/属性 (Action)
 */
export function applyHorizontalTreeLayout(nodes: GraphNode[], W: number, H: number): void {
  const padding = 80;
  const availW = W - padding * 2;
  const availH = H - padding * 2;

  const typeHubs = nodes.filter(n => n.group === 'typeHub').sort((a, b) => a.id.localeCompare(b.id));
  const instances = nodes.filter(n => n.group === 'instance');
  const actions = nodes.filter(n => n.group === 'action');

  const typeCount = Math.max(typeHubs.length, 1);
  const rowHeight = typeCount > 1 ? availH / (typeCount - 1) : availH;

  // Level X coordinates
  const xType = padding + 40;
  const xInstBase = padding + 220; // Increase X space to give labels plenty of room on the right
  const xActBase = padding + 480;

  typeHubs.forEach((hub, rowIdx) => {
    const rowY = padding + rowIdx * rowHeight;
    hub.x = xType;
    hub.y = rowY;
    hub.fx = hub.x;
    hub.fy = hub.y;

    const colInstances = instances
      .filter(n => n._typeId === hub._typeId)
      .sort((a, b) => a.id.localeCompare(b.id));

    const instCount = colInstances.length;
    if (instCount === 0) return;

    // Grid layout for instances: growing vertically and column wrapping horizontally if needed
    const maxRows = Math.max(1, Math.floor(rowHeight / 65));
    const actualRows = Math.min(maxRows, instCount);
    
    colInstances.forEach((inst, instIdx) => {
      const gridRow = instIdx % actualRows;
      const gridCol = Math.floor(instIdx / actualRows);

      const gridHeight = (actualRows - 1) * 65;
      const startY = rowY - gridHeight / 2;

      inst.x = xInstBase + gridCol * 180; // Columns spaced by 180px horizontally to prevent overlapping labels
      inst.y = startY + gridRow * 65; // Rows spaced by 65px vertically to prevent circle overlapping
      inst.fx = inst.x;
      inst.fy = inst.y;

      const instActions = actions
        .filter(n => n._objId === inst._objId)
        .sort((a, b) => a.id.localeCompare(b.id));

      const actCount = instActions.length;
      if (actCount === 0) return;

      // Arrange actions in a small vertical column to the right of the instance node
      const actSpacing = 45;
      const actHeight = (actCount - 1) * actSpacing;
      const actStartX = inst.x! + 80; // 80px to the right of the instance

      instActions.forEach((act, actIdx) => {
        act.x = actStartX;
        act.y = inst.y! - actHeight / 2 + actIdx * actSpacing;
        act.fx = act.x;
        act.fy = act.y;
      });
    });
  });

  const handledIds = new Set(nodes.filter(n => n.fx !== undefined).map(n => n.id));
  const unhandled = nodes.filter(n => !handledIds.has(n.id));
  if (unhandled.length > 0) {
    unhandled.forEach((node, idx) => {
      const step = availH / Math.max(unhandled.length - 1, 1);
      node.x = W - padding;
      node.y = padding + idx * step;
      node.fx = node.x;
      node.fy = node.y;
    });
  }
}

