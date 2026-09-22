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
 * Compute pairwise interaction affinity between ObjectTypes based on semantic links.
 */
export function computeTypeAffinityMatrix(
  nodes: GraphNode[],
  links: GraphLink[]
): Map<string, number> {
  const nodeMap = new Map<string, GraphNode>(nodes.map(n => [n.id, n]));
  const typeAffinity = new Map<string, number>();

  links.forEach(l => {
    if (l._isTypeInstLink) return;
    const sId = typeof l.source === 'object' ? (l.source as any).id : String(l.source);
    const tId = typeof l.target === 'object' ? (l.target as any).id : String(l.target);
    const sNode = nodeMap.get(sId);
    const tNode = nodeMap.get(tId);
    if (!sNode || !tNode) return;
    const st = sNode._typeId;
    const tt = tNode._typeId;
    if (st !== undefined && tt !== undefined && st !== tt) {
      const key = st < tt ? `${st}|${tt}` : `${tt}|${st}`;
      typeAffinity.set(key, (typeAffinity.get(key) || 0) + (Number(l.weight) || 1));
    }
  });
  return typeAffinity;
}

/**
 * Greedy circular Hamiltonian traversal to order type hubs so heavily interacting types
 * are positioned side-by-side along the circular orbit.
 */
export function orderTypeHubsCirculary(
  hubs: GraphNode[],
  typeAffinity: Map<string, number>
): GraphNode[] {
  if (hubs.length <= 1) return [...hubs];
  if (typeAffinity.size === 0) {
    return [...hubs].sort((a, b) => (a._typeId ?? 0) - (b._typeId ?? 0) || a.id.localeCompare(b.id));
  }
  if (hubs.length <= 3) {
    return [...hubs].sort((a, b) => (a._typeId ?? 0) - (b._typeId ?? 0) || a.id.localeCompare(b.id));
  }
  const remaining = new Set(hubs);
  let bestStart = hubs[0];
  let maxWeight = -1;
  hubs.forEach(h => {
    let totalW = 0;
    hubs.forEach(other => {
      if (h === other) return;
      const key = (h._typeId ?? 0) < (other._typeId ?? 0) ? `${h._typeId}|${other._typeId}` : `${other._typeId}|${h._typeId}`;
      totalW += typeAffinity.get(key) || 0;
    });
    if (totalW > maxWeight) {
      maxWeight = totalW;
      bestStart = h;
    }
  });

  const orderedHubs: GraphNode[] = [bestStart];
  remaining.delete(bestStart);

  while (remaining.size > 0) {
    const current = orderedHubs[orderedHubs.length - 1];
    let bestNext: GraphNode | null = null;
    let bestW = -1;
    remaining.forEach(cand => {
      const key = (current._typeId ?? 0) < (cand._typeId ?? 0) ? `${current._typeId}|${cand._typeId}` : `${cand._typeId}|${current._typeId}`;
      const w = typeAffinity.get(key) || 0;
      if (w > bestW) {
        bestW = w;
        bestNext = cand;
      }
    });
    const chosen = bestNext || remaining.values().next().value!;
    orderedHubs.push(chosen);
    remaining.delete(chosen);
  }
  return orderedHubs;
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

  const semanticLinks = (links || []).filter(l => !l._isTypeInstLink);
  const typeAffinity = computeTypeAffinityMatrix(nodes, semanticLinks);
  const typeHubs = orderTypeHubsCirculary(
    nodes.filter(n => n.group === 'typeHub'),
    typeAffinity
  );
  const instances = nodes.filter(n => n.group === 'instance');
  const actions = nodes.filter(n => n.group === 'action');
  const typeCount = Math.max(typeHubs.length, 1);

  // Keep the hub orbit compact enough for the graph to remain legible on a
  // small viewport, while giving multiple categories a clear direction.
  const hubRadius = typeCount === 1 ? 0 : Math.min(160, Math.max(100, Math.min(W, H) * 0.20));
  const sectorSize = (Math.PI * 2) / typeCount;
  const hubAngle = (index: number) => -Math.PI / 2 + index * sectorSize;

  const hubAngles = new Map<number, number>();
  typeHubs.forEach((hub, index) => {
    const angle = hubAngle(index);
    hub.x = cx + Math.cos(angle) * hubRadius;
    hub.y = cy + Math.sin(angle) * hubRadius;
    hub.fx = hub.x;
    hub.fy = hub.y;
    if (hub._typeId !== undefined) {
      hubAngles.set(hub._typeId, angle);
    }
  });

  const instancesByType = new Map<number, GraphNode[]>();
  instances.forEach(node => {
    const list = instancesByType.get(node._typeId || 0) || [];
    list.push(node);
    instancesByType.set(node._typeId || 0, list);
  });

  // Calculate target external orientation for each instance
  const nodeTargetAngle = new Map<string, number>();
  if (semanticLinks.length > 0) {
    const nodeMap = new Map<string, GraphNode>(nodes.map(n => [n.id, n]));
    const nodeVec = new Map<string, { dx: number; dy: number; count: number }>();
    instances.forEach(n => nodeVec.set(n.id, { dx: 0, dy: 0, count: 0 }));

    semanticLinks.forEach(l => {
      const sId = typeof l.source === 'object' ? (l.source as any).id : String(l.source);
      const tId = typeof l.target === 'object' ? (l.target as any).id : String(l.target);
      const sNode = nodeMap.get(sId);
      const tNode = nodeMap.get(tId);
      if (!sNode || !tNode || sNode._typeId === tNode._typeId) return;

      const sAngle = hubAngles.get(sNode._typeId ?? -1) ?? 0;
      const tAngle = hubAngles.get(tNode._typeId ?? -1) ?? 0;
      const sV = nodeVec.get(sId);
      if (sV) { sV.dx += Math.cos(tAngle); sV.dy += Math.sin(tAngle); sV.count++; }
      const tV = nodeVec.get(tId);
      if (tV) { tV.dx += Math.cos(sAngle); tV.dy += Math.sin(sAngle); tV.count++; }
    });

    nodeVec.forEach((v, id) => {
      if (v.count > 0) nodeTargetAngle.set(id, Math.atan2(v.dy, v.dx));
    });
  }

  // The available angular width is split into rows when a type has many entities.
  typeHubs.forEach((hub, typeIndex) => {
    const list = instancesByType.get(hub._typeId || 0) || [];
    const centerAngle = hubAngle(typeIndex);
    const sectorStart = centerAngle - sectorSize * 0.38;
    const span = Math.max(sectorSize * 0.62, Math.PI / 3);

    // Sort list by external target angle relative to centerAngle, or by ID
    list.sort((a, b) => {
      const angleA = nodeTargetAngle.get(a.id);
      const angleB = nodeTargetAngle.get(b.id);
      if (angleA != null && angleB != null) {
        let diffA = angleA - centerAngle;
        while (diffA > Math.PI) diffA -= Math.PI * 2;
        while (diffA < -Math.PI) diffA += Math.PI * 2;

        let diffB = angleB - centerAngle;
        while (diffB > Math.PI) diffB -= Math.PI * 2;
        while (diffB < -Math.PI) diffB += Math.PI * 2;

        return diffA - diffB || a.id.localeCompare(b.id);
      }
      if (angleA != null) return -1;
      if (angleB != null) return 1;
      return a.id.localeCompare(b.id);
    });

    const minLeafGap = 85;
    const maxPerRing = Math.max(2, Math.floor((span * 240) / minLeafGap));
    list.forEach((node, index) => {
      const ring = Math.floor(index / maxPerRing);
      const inRing = index % maxPerRing;
      const ringSize = Math.min(maxPerRing, list.length - ring * maxPerRing);
      const t = ringSize <= 1 ? 0.5 : inRing / (ringSize - 1);
      const angle = sectorStart + t * span;
      const radius = Math.max(260, Math.min(W, H) * 0.40) + ring * 100;
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

  // Partially initialized ontology instances fallback
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
/**
 * computeClusteredPositions — Type-Centroid Radial Cluster Layout
 */
export function computeClusteredPositions(
  nodes: GraphNode[],
  typeHubNodes: GraphNode[],
  svgW: number,
  svgH: number
): void {
  applyCommunityCentricBarycentricLayout(nodes, [], svgW, svgH);
}

/**
 * applyTopologicalFlowLayout — 拓扑语义层级流式布局 (Topological Layered Flow Layout)
 *
 * 核心设计目标：
 * 1. 优先减少无意义的边交叉，而非单纯调整线条样式；
 * 2. 保持存在关系的节点合理接近，避免无意义的长距离连线；
 * 3. 根据节点层级、关系类型和拓扑结构组织节点位置；
 * 4. 为不同方向或不同关系的边建立稳定、可预测的路由规则；
 * 5. 保持相似的拓扑结构具有相似的视觉布局。
 */
export function applyTopologicalFlowLayout(
  nodes: GraphNode[],
  links: GraphLink[],
  svgW: number,
  svgH: number,
  options: {
    direction?: 'LR' | 'TB';
    rankSep?: number;
    nodeSep?: number;
  } = {}
): void {
  if (nodes.length === 0) return;
  const cx = svgW / 2;
  const cy = svgH / 2;

  const hubs = nodes.filter(n => n.group === 'typeHub');
  const instances = nodes.filter(n => n.group === 'instance');
  const actions = nodes.filter(n => n.group === 'action');
  const other = nodes.filter(n => n.group !== 'typeHub' && n.group !== 'instance' && n.group !== 'action');

  // If there are no instances, fallback to all non-typeHub nodes
  const primaryNodes = instances.length > 0 ? instances : nodes.filter(n => n.group !== 'typeHub' && n.group !== 'action');
  const nodeMap = new Map<string, GraphNode>(nodes.map(n => [n.id, n]));

  // Build semantic directed adjacency graph (ignoring type-instance star links)
  const outgoing = new Map<string, Set<string>>();
  const incoming = new Map<string, Set<string>>();
  primaryNodes.forEach(n => {
    outgoing.set(n.id, new Set());
    incoming.set(n.id, new Set());
  });

  const semanticLinks = links.filter(l => !l._isTypeInstLink);
  semanticLinks.forEach(l => {
    const sId = typeof l.source === 'object' ? (l.source as any).id : String(l.source);
    const tId = typeof l.target === 'object' ? (l.target as any).id : String(l.target);
    if (outgoing.has(sId) && incoming.has(tId) && sId !== tId) {
      outgoing.get(sId)!.add(tId);
      incoming.get(tId)!.add(sId);
    }
  });

  // Cycle breaking via DFS (identifying feedback back-edges)
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const backEdges = new Set<string>(); // key: `${src}|${tgt}`

  function detectBackEdges(u: string) {
    visited.add(u);
    inStack.add(u);
    for (const v of outgoing.get(u) || []) {
      if (!visited.has(v)) {
        detectBackEdges(v);
      } else if (inStack.has(v)) {
        backEdges.add(`${u}|${v}`);
      }
    }
    inStack.delete(u);
  }

  primaryNodes.forEach(n => {
    if (!visited.has(n.id)) detectBackEdges(n.id);
  });

  // Longest Path Rank Assignment in the DAG
  const ranks = new Map<string, number>();
  const dagInDegree = new Map<string, number>();
  primaryNodes.forEach(n => {
    let deg = 0;
    for (const p of incoming.get(n.id) || []) {
      if (!backEdges.has(`${p}|${n.id}`)) deg++;
    }
    dagInDegree.set(n.id, deg);
  });

  // Roots: nodes with dagInDegree === 0
  let queue: string[] = primaryNodes.filter(n => (dagInDegree.get(n.id) || 0) === 0).map(n => n.id);
  if (queue.length === 0 && primaryNodes.length > 0) {
    // Pure cycle fallback: select node with highest outDegree - inDegree
    const sorted = [...primaryNodes].sort((a, b) => {
      const netA = (outgoing.get(a.id)?.size || 0) - (incoming.get(a.id)?.size || 0);
      const netB = (outgoing.get(b.id)?.size || 0) - (incoming.get(b.id)?.size || 0);
      return netB - netA || a.id.localeCompare(b.id);
    });
    queue = [sorted[0].id];
  }

  queue.forEach(id => ranks.set(id, 0));

  let cursor = 0;
  while (cursor < queue.length) {
    const u = queue[cursor++];
    const rU = ranks.get(u) || 0;
    for (const v of outgoing.get(u) || []) {
      if (backEdges.has(`${u}|${v}`)) continue;
      const nextR = rU + 1;
      if (!ranks.has(v) || ranks.get(v)! < nextR) {
        ranks.set(v, nextR);
        queue.push(v);
      }
    }
  }

  // Handle any disconnected components
  primaryNodes.forEach(n => {
    if (!ranks.has(n.id)) ranks.set(n.id, 0);
  });

  // Type cohesion balancing:
  // Calculate average rank per ObjectType to preserve conceptual cluster alignment
  const typeRankSum = new Map<number, { sum: number; count: number }>();
  primaryNodes.forEach(n => {
    const tid = n._typeId ?? 0;
    const current = typeRankSum.get(tid) || { sum: 0, count: 0 };
    current.sum += ranks.get(n.id) || 0;
    current.count += 1;
    typeRankSum.set(tid, current);
  });

  const sortedTypes = Array.from(typeRankSum.entries()).sort((a, b) => {
    const avgA = a[1].sum / a[1].count;
    const avgB = b[1].sum / b[1].count;
    return avgA - avgB || a[0] - b[0];
  });

  const typeToLayer = new Map<number, number>();
  sortedTypes.forEach(([tid], idx) => {
    typeToLayer.set(tid, idx);
  });

  primaryNodes.forEach(n => {
    // True DAG topological rank based on longest-path dependency flow
    // Guarantees all forward relations flow left-to-right without vertical intra-column slicing
    n._topologicalRank = ranks.get(n.id) || 0;
  });

  // Normalize ranks to 0..K-1
  const allRanks = Array.from(new Set(primaryNodes.map(n => n._topologicalRank as number))).sort((a, b) => a - b);
  const rankMap = new Map(allRanks.map((r, i) => [r, i]));
  primaryNodes.forEach(n => {
    n._topologicalRank = rankMap.get(n._topologicalRank as number) || 0;
  });

  const K = Math.max(allRanks.length, 1);
  const layers: GraphNode[][] = Array.from({ length: K }, () => []);
  primaryNodes.forEach(n => {
    layers[n._topologicalRank as number].push(n);
  });

  // Initial order within layer 0: sort by degree and id
  layers[0].sort((a, b) => (outgoing.get(b.id)?.size || 0) - (outgoing.get(a.id)?.size || 0) || a.id.localeCompare(b.id));

  // Bi-directional Barycentric Crossing Minimization with Adjacent Transposition (8 sweeps)
  for (let sweep = 0; sweep < 8; sweep++) {
    const isForward = sweep % 2 === 0;
    if (isForward) {
      for (let layerIdx = 1; layerIdx < K; layerIdx++) {
        const prevLayer = layers[layerIdx - 1];
        const prevPosMap = new Map(prevLayer.map((node, idx) => [node.id, idx]));

        layers[layerIdx].sort((a, b) => {
          const predsA = Array.from(incoming.get(a.id) || []).filter(id => prevPosMap.has(id));
          const predsB = Array.from(incoming.get(b.id) || []).filter(id => prevPosMap.has(id));

          const bcA = predsA.length > 0
            ? predsA.reduce((sum, id) => sum + prevPosMap.get(id)!, 0) / predsA.length
            : layers[layerIdx].indexOf(a);
          const bcB = predsB.length > 0
            ? predsB.reduce((sum, id) => sum + prevPosMap.get(id)!, 0) / predsB.length
            : layers[layerIdx].indexOf(b);

          return bcA - bcB || (a._typeId ?? 0) - (b._typeId ?? 0) || a.id.localeCompare(b.id);
        });

        // Adjacent swap heuristic: swap adjacent nodes if it strictly reduces crossing count
        const cur = layers[layerIdx];
        for (let p = 0; p < cur.length - 1; p++) {
          const u = cur[p];
          const v = cur[p + 1];
          const uPreds = Array.from(incoming.get(u.id) || []).map(id => prevPosMap.get(id)).filter((x): x is number => x !== undefined);
          const vPreds = Array.from(incoming.get(v.id) || []).map(id => prevPosMap.get(id)).filter((x): x is number => x !== undefined);
          let crossBefore = 0, crossAfter = 0;
          uPreds.forEach(pu => {
            vPreds.forEach(pv => {
              if (pu > pv) crossBefore++;
              if (pv > pu) crossAfter++;
            });
          });
          if (crossAfter < crossBefore) {
            cur[p] = v;
            cur[p + 1] = u;
          }
        }
      }
    } else {
      for (let layerIdx = K - 2; layerIdx >= 0; layerIdx--) {
        const nextLayer = layers[layerIdx + 1];
        const nextPosMap = new Map(nextLayer.map((node, idx) => [node.id, idx]));

        layers[layerIdx].sort((a, b) => {
          const succsA = Array.from(outgoing.get(a.id) || []).filter(id => nextPosMap.has(id));
          const succsB = Array.from(outgoing.get(b.id) || []).filter(id => nextPosMap.has(id));

          const bcA = succsA.length > 0
            ? succsA.reduce((sum, id) => sum + nextPosMap.get(id)!, 0) / succsA.length
            : layers[layerIdx].indexOf(a);
          const bcB = succsB.length > 0
            ? succsB.reduce((sum, id) => sum + nextPosMap.get(id)!, 0) / succsB.length
            : layers[layerIdx].indexOf(b);

          return bcA - bcB || (a._typeId ?? 0) - (b._typeId ?? 0) || a.id.localeCompare(b.id);
        });

        const cur = layers[layerIdx];
        for (let p = 0; p < cur.length - 1; p++) {
          const u = cur[p];
          const v = cur[p + 1];
          const uSuccs = Array.from(outgoing.get(u.id) || []).map(id => nextPosMap.get(id)).filter((x): x is number => x !== undefined);
          const vSuccs = Array.from(outgoing.get(v.id) || []).map(id => nextPosMap.get(id)).filter((x): x is number => x !== undefined);
          let crossBefore = 0, crossAfter = 0;
          uSuccs.forEach(su => {
            vSuccs.forEach(sv => {
              if (su > sv) crossBefore++;
              if (sv > su) crossAfter++;
            });
          });
          if (crossAfter < crossBefore) {
            cur[p] = v;
            cur[p + 1] = u;
          }
        }
      }
    }
  }

  // Coordinate Placement: LR (default) or TB (Top-to-Bottom)
  const isTB = options.direction === 'TB';

  // Calculate maximum span of connections (for channel width expansion)
  let maxEdgeSpan = 1;
  semanticLinks.forEach(l => {
    const sId = typeof l.source === 'object' ? (l.source as any).id : String(l.source);
    const tId = typeof l.target === 'object' ? (l.target as any).id : String(l.target);
    const sRank = nodeMap.get(sId)?._topologicalRank as number | undefined;
    const tRank = nodeMap.get(tId)?._topologicalRank as number | undefined;
    if (sRank !== undefined && tRank !== undefined) {
      maxEdgeSpan = Math.max(maxEdgeSpan, Math.abs(tRank - sRank));
    }
  });

  // Channel bonus dynamically creates highway gaps for multi-hop edges
  const channelExpansion = Math.min(80, (maxEdgeSpan - 1) * 18);

  if (isTB) {
    // TB: Layers progress vertically (top to bottom), nodes in each layer spread horizontally
    // Generous row separation (rankSep) guarantees multi-hop edges never intersect intermediate row nodes
    const baseRowSpacing = Math.max(220, Math.min(320, (svgH - 120) / Math.max(K - 1, 1)));
    const rowSpacing = (options.rankSep ?? baseRowSpacing) + channelExpansion;
    const totalHeight = (K - 1) * rowSpacing;
    const startY = cy - totalHeight / 2;

    const maxLayerLen = Math.max(...layers.map(l => l.length), 1);
    const defaultColSpacing = options.nodeSep ?? Math.max(160, Math.min(260, (svgW - 120) / maxLayerLen));

    layers.forEach((layerNodes, layerIdx) => {
      const rowY = startY + layerIdx * rowSpacing;
      const layerLen = layerNodes.length;
      // Ensure local nodes have plenty of breathing room to avoid hairball clustering
      const colSpacing = options.nodeSep ?? Math.max(140, Math.min(defaultColSpacing, (svgW - 160) / Math.max(layerLen, 1)));
      const rowWidth = (layerLen - 1) * colSpacing;
      const startX = cx - rowWidth / 2;

      layerNodes.forEach((node, nodeIdx) => {
        node.x = startX + nodeIdx * colSpacing;
        node.y = rowY;
        node.fx = node.x;
        node.fy = node.y;
        node._topologicalRank = layerIdx;
        node._topologicalIndex = nodeIdx;
        node._layerCount = K;
      });

      // Place TypeHub for this layer cleanly to the left, well outside instance bounds
      const colTypeIds = Array.from(new Set(layerNodes.map(n => n._typeId).filter(Boolean)));
      colTypeIds.forEach((tId, tIdx) => {
        const hub = hubs.find(h => h._typeId === tId);
        if (hub) {
          hub.x = startX - 110 - tIdx * 50;
          hub.y = rowY;
          hub.fx = hub.x;
          hub.fy = hub.y;
          hub._topologicalRank = layerIdx;
        }
      });
    });
  } else {
    // LR: Layers progress horizontally (left to right), nodes in each layer spread vertically
    // Generous column spacing (rankSep) guarantees channel routing corridors for long-span relations
    const baseColSpacing = Math.max(380, Math.min(520, (svgW - 120) / Math.max(K - 1, 1)));
    const colSpacing = (options.rankSep ?? baseColSpacing) + channelExpansion;
    const totalWidth = (K - 1) * colSpacing;
    const startX = cx - totalWidth / 2;

    const maxLayerLen = Math.max(...layers.map(l => l.length), 1);
    const defaultRowSpacing = options.nodeSep ?? Math.max(160, Math.min(260, (svgH - 120) / maxLayerLen));

    layers.forEach((layerNodes, layerIdx) => {
      const colX = startX + layerIdx * colSpacing;
      const layerLen = layerNodes.length;
      // Stagger or space vertical nodes generously so horizontal relations have unobstructed lanes
      const rowSpacing = options.nodeSep ?? Math.max(140, defaultRowSpacing);
      const colHeight = (layerLen - 1) * rowSpacing;
      const startY = cy - colHeight / 2;

      layerNodes.forEach((node, nodeIdx) => {
        node.x = colX;
        node.y = startY + nodeIdx * rowSpacing;
        node.fx = node.x;
        node.fy = node.y;
        node._topologicalRank = layerIdx;
        node._topologicalIndex = nodeIdx;
        node._layerCount = K;
      });
    });
  }

  // ── TypeHub Placement: Dedicated Top Header Tier ──
  const allInstY = primaryNodes.map(i => i.y ?? cy);
  const globalMinInstY = allInstY.length > 0 ? Math.min(...allInstY) : cy;
  const allInstX = primaryNodes.map(i => i.x ?? cx);
  const globalMinInstX = allInstX.length > 0 ? Math.min(...allInstX) : cx;

  const hubPositions: Array<{ hub: GraphNode; targetX: number; targetY: number }> = [];
  hubs.forEach((hub, idx) => {
    const typeInsts = primaryNodes.filter(i => i._typeId === hub._typeId);
    let targetX = cx;
    let targetY = cy;
    if (typeInsts.length > 0) {
      const avgX = typeInsts.reduce((sum, i) => sum + (i.x ?? cx), 0) / typeInsts.length;
      const avgY = typeInsts.reduce((sum, i) => sum + (i.y ?? cy), 0) / typeInsts.length;
      if (isTB) {
        targetX = globalMinInstX - 110;
        targetY = avgY;
      } else {
        targetX = avgX;
        targetY = globalMinInstY - 110;
      }
    } else {
      if (isTB) {
        targetX = globalMinInstX - 110;
        targetY = cy + (idx - hubs.length / 2) * 120;
      } else {
        targetX = cx + (idx - hubs.length / 2) * 160;
        targetY = globalMinInstY - 110;
      }
    }
    hubPositions.push({ hub, targetX, targetY });
  });

  if (!isTB && hubPositions.length > 1) {
    hubPositions.sort((a, b) => a.targetX - b.targetX);
    const minHubSpacing = 160;
    for (let i = 1; i < hubPositions.length; i++) {
      const prev = hubPositions[i - 1];
      const curr = hubPositions[i];
      if (curr.targetX - prev.targetX < minHubSpacing) {
        curr.targetX = prev.targetX + minHubSpacing;
      }
    }
  }

  hubPositions.forEach(({ hub, targetX, targetY }) => {
    hub.x = targetX;
    hub.y = targetY;
    hub.fx = hub.x;
    hub.fy = hub.y;
  });

  // Action nodes: compact outward satellite fan beside their owning instance
  const instanceMap = new Map<number, GraphNode>();
  primaryNodes.forEach(n => {
    if (n._objId !== undefined) instanceMap.set(n._objId, n);
  });

  const actionsByOwner = new Map<number, GraphNode[]>();
  actions.forEach(act => {
    const ownerId = act._objId ?? -1;
    const list = actionsByOwner.get(ownerId) || [];
    list.push(act);
    actionsByOwner.set(ownerId, list);
  });

  actionsByOwner.forEach((actList, ownerId) => {
    const owner = instanceMap.get(ownerId);
    actList.sort((a, b) => a.id.localeCompare(b.id));
    const actCount = actList.length;

    if (owner && owner.x != null && owner.y != null) {
      if (isTB) {
        const actSpacing = 26;
        const actStartX = owner.x - ((actCount - 1) * actSpacing) / 2;
        actList.forEach((act, actIdx) => {
          act.x = actStartX + actIdx * actSpacing;
          act.y = owner.y! + 36;
          act.fx = act.x;
          act.fy = act.y;
          act._topologicalRank = (owner._topologicalRank || 0) + 0.5;
        });
      } else {
        const actSpacing = 22;
        const actStartX = owner.x - ((actCount - 1) * actSpacing) / 2;
        actList.forEach((act, actIdx) => {
          act.x = actStartX + actIdx * actSpacing;
          act.y = owner.y! + 32;
          act.fx = act.x;
          act.fy = act.y;
          act._topologicalRank = (owner._topologicalRank || 0) + 0.5;
        });
      }
    } else {
      actList.forEach((act, idx) => {
        act.x = cx + 260;
        act.y = cy + (idx - actCount / 2) * 28;
        act.fx = act.x;
        act.fy = act.y;
      });
    }
  });

  // Unplaced hubs and other nodes fallback
  hubs.filter(h => h.fx == null).forEach((hub, i) => {
    hub.x = cx - 200 + (i % Math.max(K, 1)) * 140;
    hub.y = cy - 240;
    hub.fx = hub.x;
    hub.fy = hub.y;
  });

  other.filter(n => n.fx == null).forEach((node, idx) => {
    node.x = cx + (idx - other.length / 2) * 80;
    node.y = cy + 260;
    node.fx = node.x;
    node.fy = node.y;
  });
}

/**
 * applyCommunityCentricBarycentricLayout — Global Community-Centric Barycentric Projection
 *
 * Designed specifically for 100+ nodes, many-to-many semantic ontology graphs:
 * 1. Macro Cluster Arrangement: Builds a type-to-type affinity interaction matrix from links.
 *    Orders clusters around the macro perimeter so strongly communicating types are adjacent,
 *    minimizing long-distance cross-canvas edges.
 * 2. Directional Polar Ordering: Nodes inside each cluster calculate their external connection
 *    barycenter vector (target cluster direction). Nodes communicating with cluster B are positioned
 *    on the boundary facing cluster B. This mathematically ELIMINATES pass-through cross edges!
 * 3. High-degree and isolated nodes: Isolated nodes stay quietly near inner/back rings.
 * 4. Deterministic: All positions are frozen (fx = x, fy = y) for rock-solid stability.
 */
export function applyCommunityCentricBarycentricLayout(
  nodes: GraphNode[],
  links: GraphLink[],
  svgW: number,
  svgH: number
): void {
  const cx = svgW / 2;
  const cy = svgH / 2;
  const hubs = nodes.filter(n => n.group === 'typeHub').sort((a, b) => (a._typeId ?? 0) - (b._typeId ?? 0));
  const instances = nodes.filter(n => n.group === 'instance');
  const actions = nodes.filter(n => n.group === 'action');
  const typeCount = Math.max(hubs.length, 1);

  // Group instances by type
  const instancesByType = new Map<number, GraphNode[]>();
  instances.forEach(n => {
    const tid = n._typeId ?? 0;
    const list = instancesByType.get(tid) || [];
    list.push(n);
    instancesByType.set(tid, list);
  });

  // 1. Build Type-to-Type Affinity Interaction Matrix from real semantic links (excluding typeInst links)
  const nodeMap = new Map<string, GraphNode>(nodes.map(n => [n.id, n]));
  const typeAffinity = new Map<string, number>(); // key: `${min(t1,t2)}|${max(t1,t2)}`

  links.forEach(l => {
    if (l._isTypeInstLink) return;
    const sId = typeof l.source === 'object' ? (l.source as any).id : String(l.source);
    const tId = typeof l.target === 'object' ? (l.target as any).id : String(l.target);
    const sNode = nodeMap.get(sId);
    const tNode = nodeMap.get(tId);
    if (!sNode || !tNode) return;
    const st = sNode._typeId;
    const tt = tNode._typeId;
    if (st !== undefined && tt !== undefined && st !== tt) {
      const key = st < tt ? `${st}|${tt}` : `${tt}|${st}`;
      typeAffinity.set(key, (typeAffinity.get(key) || 0) + (Number(l.weight) || 1));
    }
  });

  // 2. Greedy Circular Spectral Ordering for Type Hubs
  // Order types so types with highest mutual edge weights are placed side-by-side
  let orderedHubs: GraphNode[] = [];
  if (hubs.length <= 3) {
    orderedHubs = [...hubs];
  } else {
    const remaining = new Set(hubs);
    // Start with the hub that has the highest total external interaction
    let bestStart = hubs[0];
    let maxWeight = -1;
    hubs.forEach(h => {
      let totalW = 0;
      hubs.forEach(other => {
        if (h === other) return;
        const key = (h._typeId ?? 0) < (other._typeId ?? 0) ? `${h._typeId}|${other._typeId}` : `${other._typeId}|${h._typeId}`;
        totalW += typeAffinity.get(key) || 0;
      });
      if (totalW > maxWeight) {
        maxWeight = totalW;
        bestStart = h;
      }
    });

    orderedHubs.push(bestStart);
    remaining.delete(bestStart);

    while (remaining.size > 0) {
      const current = orderedHubs[orderedHubs.length - 1];
      let bestNext: GraphNode | null = null;
      let bestW = -1;
      remaining.forEach(cand => {
        const key = (current._typeId ?? 0) < (cand._typeId ?? 0) ? `${current._typeId}|${cand._typeId}` : `${cand._typeId}|${current._typeId}`;
        const w = typeAffinity.get(key) || 0;
        if (w > bestW) {
          bestW = w;
          bestNext = cand;
        }
      });
      const chosen = bestNext || remaining.values().next().value!;
      orderedHubs.push(chosen);
      remaining.delete(chosen);
    }
  }

  // Calculate macro cluster centers on an elliptical orbit
  const orbitRadiusX = Math.max(220, svgW * (typeCount <= 3 ? 0.34 : 0.42));
  const orbitRadiusY = Math.max(180, svgH * (typeCount <= 3 ? 0.32 : 0.40));
  const hubCenters = new Map<number, { x: number; y: number; angle: number }>();

  orderedHubs.forEach((hub, i) => {
    const angle = (i / typeCount) * Math.PI * 2 - Math.PI / 2;
    const hx = cx + Math.cos(angle) * orbitRadiusX;
    const hy = cy + Math.sin(angle) * orbitRadiusY;
    hub.x = hx;
    hub.y = hy;
    hub.fx = hx;
    hub.fy = hy;
    if (hub._typeId !== undefined) {
      hubCenters.set(hub._typeId, { x: hx, y: hy, angle });
    }
  });

  // 3. Directional Polar Ordering inside each cluster
  // For each node, compute target vector sum of external connected nodes
  const nodeExternalVec = new Map<string, { dx: number; dy: number; count: number }>();
  instances.forEach(inst => {
    nodeExternalVec.set(inst.id, { dx: 0, dy: 0, count: 0 });
  });

  links.forEach(l => {
    if (l._isTypeInstLink) return;
    const sId = typeof l.source === 'object' ? (l.source as any).id : String(l.source);
    const tId = typeof l.target === 'object' ? (l.target as any).id : String(l.target);
    const sNode = nodeMap.get(sId);
    const tNode = nodeMap.get(tId);
    if (!sNode || !tNode) return;
    if (sNode.group === 'instance' && tNode.group === 'instance' && sNode._typeId !== tNode._typeId) {
      const sCenter = hubCenters.get(sNode._typeId ?? -1) || { x: cx, y: cy };
      const tCenter = hubCenters.get(tNode._typeId ?? -1) || { x: cx, y: cy };
      const dirX = tCenter.x - sCenter.x;
      const dirY = tCenter.y - sCenter.y;
      const dist = Math.hypot(dirX, dirY) || 1;
      const sVec = nodeExternalVec.get(sId);
      if (sVec) {
        sVec.dx += dirX / dist;
        sVec.dy += dirY / dist;
        sVec.count += 1;
      }
      const tVec = nodeExternalVec.get(tId);
      if (tVec) {
        tVec.dx -= dirX / dist;
        tVec.dy -= dirY / dist;
        tVec.count += 1;
      }
    }
  });

  // Distribute instances inside each cluster based on their preferred external orientation
  instancesByType.forEach((instList, tid) => {
    const hubCenter = hubCenters.get(tid) || { x: cx, y: cy, angle: 0 };
    const hx = hubCenter.x;
    const hy = hubCenter.y;
    const count = instList.length;

    // Separate into connected (have external vector) and internal/isolated nodes
    const orientedNodes: { node: GraphNode; angle: number; priority: number }[] = [];
    const internalNodes: GraphNode[] = [];

    instList.forEach(inst => {
      const vec = nodeExternalVec.get(inst.id);
      if (vec && vec.count > 0) {
        const targetAngle = Math.atan2(vec.dy, vec.dx);
        orientedNodes.push({ node: inst, angle: targetAngle, priority: vec.count });
      } else {
        internalNodes.push(inst);
      }
    });

    // Sort oriented nodes by their target angle so connections exit cleanly like fan cables
    orientedNodes.sort((a, b) => a.angle - b.angle);

    // Dynamic cluster layout geometry:
    // Oriented nodes form outer perimeter facing their target clusters with ample breathing room
    const maxOrientedPerRing = 8;
    const orientedCount = orientedNodes.length;
    orientedNodes.forEach((item, idx) => {
      const ring = Math.floor(idx / maxOrientedPerRing);
      const r = 75 + ring * 55;
      // Compute angular spacing needed for >= 48px arc distance between adjacent nodes facing similar targets
      const minAngularStep = Math.min(0.65, 48 / r);
      const offset = orientedCount <= 1 ? 0 : (idx - (orientedCount - 1) / 2) * minAngularStep;
      const adjustedAngle = item.angle + offset;
      const nx = hx + Math.cos(adjustedAngle) * r;
      const ny = hy + Math.sin(adjustedAngle) * r;
      item.node.x = nx;
      item.node.y = ny;
      item.node.fx = nx;
      item.node.fy = ny;
    });

    // Place internal & isolated nodes around inner cluster core with safe spacing
    const internalCount = internalNodes.length;
    internalNodes.forEach((inst, idx) => {
      const ring = Math.floor(idx / 5);
      const r = 45 + ring * 42;
      const countInRing = Math.min(5, Math.max(1, internalCount - ring * 5));
      const step = (Math.PI * 2) / countInRing;
      const angle = hubCenter.angle + Math.PI + (idx % 5) * step;
      const nx = hx + Math.cos(angle) * r;
      const ny = hy + Math.sin(angle) * r;
      inst.x = nx;
      inst.y = ny;
      inst.fx = nx;
      inst.fy = ny;
    });

    // Local clearance relaxation within cluster: ensure minimum distance >= 36px
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < instList.length; i++) {
        for (let j = i + 1; j < instList.length; j++) {
          const a = instList[i];
          const b = instList[j];
          if (a.x == null || a.y == null || b.x == null || b.y == null) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 1;
          if (dist < 36) {
            const push = (36 - dist) / 2;
            const ux = dx / dist;
            const uy = dy / dist;
            a.x -= ux * push;
            a.y -= uy * push;
            b.x += ux * push;
            b.y += uy * push;
            a.fx = a.x; a.fy = a.y;
            b.fx = b.x; b.fy = b.y;
          }
        }
      }
    }
  });

  // 4. Action nodes: compact outward satellite fan around their owning instance
  const instanceMap = new Map<number, GraphNode>();
  instances.forEach(n => {
    if (n._objId !== undefined) instanceMap.set(n._objId, n);
  });

  actions.forEach((act, k) => {
    const owner = act._objId !== undefined ? instanceMap.get(act._objId) : undefined;
    if (owner && owner.x != null && owner.y != null) {
      // Outward angle pointing away from cluster center
      const hubCenter = hubCenters.get(owner._typeId ?? -1) || { x: cx, y: cy };
      const outwardAngle = Math.atan2(owner.y - hubCenter.y, owner.x - hubCenter.x);
      const spreadAngle = outwardAngle + ((k % 3) - 1) * 0.35;
      act.x = owner.x + Math.cos(spreadAngle) * 32;
      act.y = owner.y + Math.sin(spreadAngle) * 32;
      act.fx = act.x;
      act.fy = act.y;
    } else {
      const angle = (k / Math.max(actions.length, 1)) * Math.PI * 2;
      act.x = cx + Math.cos(angle) * (orbitRadiusX * 1.25);
      act.y = cy + Math.sin(angle) * (orbitRadiusY * 1.25);
      act.fx = act.x;
      act.fy = act.y;
    }
  });

  // 5. Unassigned nodes fallback
  nodes.filter(n => n.x == null || isNaN(n.x)).forEach((node, idx) => {
    const angle = (idx / 12) * Math.PI * 2;
    node.x = cx + Math.cos(angle) * (orbitRadiusX * 1.3);
    node.y = cy + Math.sin(angle) * (orbitRadiusY * 1.3);
    node.fx = node.x;
    node.fy = node.y;
  });
}

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

  const baseR = Math.max(200, Math.min(380, Math.min(svgW, svgH) * 0.32));
  const innerR = baseR * 0.45;
  const ring1R = baseR * 0.85;
  const ring2R = baseR * 1.40;

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

      node.x = cx + r * Math.cos(midAngle + angleOffset);
      node.y = cy + r * Math.sin(midAngle + angleOffset);
    });
  });

  // ── TypeHub nodes: spacious outer ring grouped by type order ──────────────────
  const typeHubRadius = Math.max(260, baseR * 1.45);
  typeHubNodes.forEach((node, i) => {
    const angle = (i / Math.max(typeHubNodes.length, 1)) * 2 * Math.PI - Math.PI / 2;
    node.x = cx + typeHubRadius * Math.cos(angle);
    node.y = cy + typeHubRadius * Math.sin(angle);
  });

  // ── Action nodes: cluster near the object they own ──────────────────────
  actionNodes.forEach((node, i) => {
    const ownerId = node._objId!;
    const owner = instanceNodes.find(n => n._objId === ownerId);
    if (owner && owner.x !== undefined && owner.y !== undefined && !isNaN(owner.x!)) {
      const angle = (i / Math.max(actionNodes.length, 1)) * 2 * Math.PI;
      const r = 36;
      node.x = owner.x + r * Math.cos(angle);
      node.y = owner.y + r * Math.sin(angle);
    } else {
      node.x = cx + 50 * Math.cos((i / Math.max(actionNodes.length, 1)) * 2 * Math.PI);
      node.y = cy + 50 * Math.sin((i / Math.max(actionNodes.length, 1)) * 2 * Math.PI);
    }
  });

  // ── linkType nodes: tiny ring at center ─────────────────────────────────
  linkTypeNodes.forEach((node, i) => {
    node.x = cx + 24 * Math.cos((i / Math.max(linkTypeNodes.length, 1)) * 2 * Math.PI);
    node.y = cy + 24 * Math.sin((i / Math.max(linkTypeNodes.length, 1)) * 2 * Math.PI);
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
    nodesep: 160,
    edgesep: 65,
    ranksep: 180,
    marginx: 60,
    marginy: 60
  });
  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach(n => {
    const labelLen = String(n.label || n.description || n.id).length;
    const labelWidth = Math.max(90, Math.min(180, labelLen * 8.5 + 36));
    const isHub = n.group === 'typeHub';
    const width = isHub ? Math.max(labelWidth, 120) : Math.max(labelWidth, 90);
    const height = isHub ? 52 : 44;
    g.setNode(n.id, { width, height });
  });

  // Filter out type-instance membership edges so Dagre solves real domain DAG hierarchy without star-mesh cross clutter
  const semanticLinks = links.filter(l => !l._isTypeInstLink);
  const linksToUse = semanticLinks.length > 0 ? semanticLinks : links;

  linksToUse.forEach(l => {
    const sId = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
    const tId = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
    if (sId && tId && sId !== tId) {
      g.setEdge(sId, tId);
    }
  });

  dagreLayout(g);

  // Position typeHub nodes gracefully directly above their cluster of instances
  const instanceNodes = nodes.filter(n => n.group === 'instance');
  const typeHubNodes = nodes.filter(n => n.group === 'typeHub');
  typeHubNodes.forEach(hub => {
    const owned = instanceNodes.filter(n => n._typeId === hub._typeId);
    if (owned.length > 0) {
      const avgX = owned.reduce((sum, n) => sum + (g.node(n.id)?.x || 0), 0) / owned.length;
      const minY = Math.min(...owned.map(n => g.node(n.id)?.y || 0));
      g.setNode(hub.id, { x: avgX, y: minY - 75 });
    }
  });

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
  const scale = Math.min(Math.max(scaleX, scaleY, 0.85), 1.25);

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
 * Inner ring: TypeHubs (ordered via circular affinity)
 * Middle ring: Instances (clustered into type sectors; oriented barycentrically so inter-type edges avoid crossing through the center)
 * Outer ring: Actions (radiating outward from owning instance away from circle center)
 */
export function applyConcentricLayout(nodes: GraphNode[], W: number, H: number, links?: GraphLink[]): void {
  const cx = W / 2;
  const cy = H / 2;

  const typeHubs = nodes.filter(n => n.group === 'typeHub');
  const instances = nodes.filter(n => n.group === 'instance');
  const actions = nodes.filter(n => n.group === 'action');
  const other = nodes.filter(n => n.group !== 'typeHub' && n.group !== 'instance' && n.group !== 'action');

  const semanticLinks = (links || []).filter(l => !l._isTypeInstLink);
  const typeAffinity = computeTypeAffinityMatrix(nodes, semanticLinks);
  const orderedHubs = orderTypeHubsCirculary(typeHubs, typeAffinity);
  const typeCount = Math.max(orderedHubs.length, 1);

  // 1. Inner ring: TypeHubs placed on inner circle (single hub stays at exact center <= 150px)
  const innerR = typeCount === 1 ? 0 : Math.max(100, Math.min(150, Math.min(W, H) * 0.20));
  const hubAngles = new Map<number, number>();

  orderedHubs.forEach((hub, i) => {
    const angle = (i / typeCount) * Math.PI * 2 - Math.PI / 2;
    hub.x = cx + innerR * Math.cos(angle);
    hub.y = cy + innerR * Math.sin(angle);
    hub.fx = hub.x;
    hub.fy = hub.y;
    if (hub._typeId !== undefined) {
      hubAngles.set(hub._typeId, angle);
    }
  });

  // 2. Middle ring: Instances clustered by type sector with barycentric angular ordering
  const instancesByType = new Map<number, GraphNode[]>();
  instances.forEach(n => {
    const tid = n._typeId ?? 0;
    const list = instancesByType.get(tid) || [];
    list.push(n);
    instancesByType.set(tid, list);
  });

  // Calculate target external direction for each instance
  const nodeTargetAngle = new Map<string, number>();
  if (semanticLinks.length > 0) {
    const nodeMap = new Map<string, GraphNode>(nodes.map(n => [n.id, n]));
    const nodeVec = new Map<string, { dx: number; dy: number; count: number }>();
    instances.forEach(n => nodeVec.set(n.id, { dx: 0, dy: 0, count: 0 }));

    semanticLinks.forEach(l => {
      const sId = typeof l.source === 'object' ? (l.source as any).id : String(l.source);
      const tId = typeof l.target === 'object' ? (l.target as any).id : String(l.target);
      const sNode = nodeMap.get(sId);
      const tNode = nodeMap.get(tId);
      if (!sNode || !tNode || sNode._typeId === tNode._typeId) return;

      const sAngle = hubAngles.get(sNode._typeId ?? -1) ?? 0;
      const tAngle = hubAngles.get(tNode._typeId ?? -1) ?? 0;

      const sV = nodeVec.get(sId);
      if (sV) { sV.dx += Math.cos(tAngle); sV.dy += Math.sin(tAngle); sV.count++; }
      const tV = nodeVec.get(tId);
      if (tV) { tV.dx += Math.cos(sAngle); tV.dy += Math.sin(sAngle); tV.count++; }
    });

    nodeVec.forEach((v, id) => {
      if (v.count > 0) {
        nodeTargetAngle.set(id, Math.atan2(v.dy, v.dx));
      }
    });
  }

  const baseMiddleR = Math.max(320, Math.min(450, Math.min(W, H) * 0.44));
  const sectorSpan = (Math.PI * 2) / typeCount;

  orderedHubs.forEach(hub => {
    const tid = hub._typeId ?? 0;
    const list = instancesByType.get(tid) || [];
    if (list.length === 0) return;

    const centerAngle = hubAngles.get(tid) ?? -Math.PI / 2;
    const arcHalfSpan = Math.min(sectorSpan * 0.44, Math.PI / 2);

    // Sort instances in this sector:
    // If they have external target angle, sort relative to centerAngle so nodes facing adjacent sectors sit at boundaries
    list.sort((a, b) => {
      const angleA = nodeTargetAngle.get(a.id);
      const angleB = nodeTargetAngle.get(b.id);
      if (angleA != null && angleB != null) {
        let diffA = angleA - centerAngle;
        while (diffA > Math.PI) diffA -= Math.PI * 2;
        while (diffA < -Math.PI) diffA += Math.PI * 2;

        let diffB = angleB - centerAngle;
        while (diffB > Math.PI) diffB -= Math.PI * 2;
        while (diffB < -Math.PI) diffB += Math.PI * 2;

        return diffA - diffB || a.id.localeCompare(b.id);
      }
      if (angleA != null) return -1;
      if (angleB != null) return 1;
      return a.id.localeCompare(b.id);
    });

    const m = list.length;
    list.forEach((node, idx) => {
      const t = m <= 1 ? 0 : (idx / (m - 1)) * 2 - 1; // -1 .. 1
      const instAngle = centerAngle + t * arcHalfSpan;
      // Stagger radius into concentric orbital tracks (multi-band corridors)
      const trackIndex = Math.floor(idx / 3);
      const rOffset = trackIndex * 90 + (nodeTargetAngle.has(node.id) ? 36 : 0);
      const r = baseMiddleR + rOffset;

      node.x = cx + r * Math.cos(instAngle);
      node.y = cy + r * Math.sin(instAngle);
      node.fx = node.x;
      node.fy = node.y;
    });
  });

  // Handle any instances whose type was not in orderedHubs
  const positionedInsts = new Set(instances.filter(n => n.fx !== undefined));
  instances.filter(n => !positionedInsts.has(n)).forEach((node, i, arr) => {
    const angle = (i / Math.max(arr.length, 1)) * Math.PI * 2 - Math.PI / 2;
    node.x = cx + baseMiddleR * Math.cos(angle);
    node.y = cy + baseMiddleR * Math.sin(angle);
    node.fx = node.x;
    node.fy = node.y;
  });

  // 3. Outer ring: Actions fanning radially outward away from canvas center
  const instanceMap = new Map<number, GraphNode>();
  instances.forEach(n => {
    if (n._objId !== undefined) instanceMap.set(n._objId, n);
  });

  const actionsByOwner = new Map<number, GraphNode[]>();
  actions.forEach(act => {
    const ownerId = act._objId ?? -1;
    const list = actionsByOwner.get(ownerId) || [];
    list.push(act);
    actionsByOwner.set(ownerId, list);
  });

  actionsByOwner.forEach((actList, ownerId) => {
    const parent = instanceMap.get(ownerId);
    actList.sort((a, b) => a.id.localeCompare(b.id));
    const actCount = actList.length;

    if (parent && parent.x != null && parent.y != null) {
      const dx = parent.x - cx;
      const dy = parent.y - cy;
      const len = Math.hypot(dx, dy) || 1;
      const nx = dx / len;
      const ny = dy / len;
      const tx = -ny; // Tangent vector
      const ty = nx;

      actList.forEach((act, actIdx) => {
        const offsetR = 48 + Math.floor(actIdx / 3) * 22;
        const offsetT = (actIdx % 3 - (Math.min(actCount, 3) - 1) / 2) * 26;
        act.x = parent.x! + nx * offsetR + tx * offsetT;
        act.y = parent.y! + ny * offsetR + ty * offsetT;
        act.fx = act.x;
        act.fy = act.y;
      });
    } else {
      actList.forEach((act, idx) => {
        const angle = (idx / Math.max(actCount, 1)) * 2 * Math.PI;
        act.x = cx + (baseMiddleR + 140) * Math.cos(angle);
        act.y = cy + (baseMiddleR + 140) * Math.sin(angle);
        act.fx = act.x;
        act.fy = act.y;
      });
    }
  });

  other.forEach((node, i) => {
    const angle = (i / Math.max(other.length, 1)) * 2 * Math.PI;
    const r = baseMiddleR + 160;
    node.x = cx + r * Math.cos(angle);
    node.y = cy + r * Math.sin(angle);
    node.fx = node.x;
    node.fy = node.y;
  });
}

/**
 * Compute Starburst layout.
 * Center node at (W/2, H/2). Primary neighbors in a circle with mutual adjacency sorting.
 * Leaf nodes (like actions) fan out radially away from the center.
 */
export function applyStarburstLayout(nodes: GraphNode[], links: GraphLink[], W: number, H: number): void {
  const cx = W / 2;
  const cy = H / 2;

  if (nodes.length === 0) return;

  const semanticLinks = links.filter(l => !l._isTypeInstLink);
  const linksToUse = semanticLinks.length > 0 ? semanticLinks : links;

  // 1. Calculate degree centrality to find the absolute center node
  const degreeMap: Record<string, number> = {};
  nodes.forEach(n => { degreeMap[n.id] = 0; });
  linksToUse.forEach(l => {
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

  centerNode.x = cx;
  centerNode.y = cy;
  centerNode.fx = cx;
  centerNode.fy = cy;

  // 2. Identify neighbors of the center node (parents)
  const parentIds = new Set<string>();
  const parentAdjacency = new Map<string, Set<string>>();

  linksToUse.forEach(l => {
    const s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
    const t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
    if (s === centerNode.id) { parentIds.add(t); }
    if (t === centerNode.id) { parentIds.add(s); }
  });

  const parents = nodes.filter(n => parentIds.has(n.id) && n.id !== centerNode.id);
  parents.forEach(p => parentAdjacency.set(p.id, new Set()));

  linksToUse.forEach(l => {
    const s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
    const t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
    if (parentAdjacency.has(s) && parentAdjacency.has(t) && s !== t) {
      parentAdjacency.get(s)!.add(t);
      parentAdjacency.get(t)!.add(s);
    }
  });

  // Sort parents along circle so connected parents are adjacent (Hamiltonian greedy chain)
  const orderedParents: GraphNode[] = [];
  if (parents.length > 0) {
    const remaining = new Set(parents);
    let current = [...parents].sort((a, b) => degreeMap[b.id] - degreeMap[a.id] || a.id.localeCompare(b.id))[0];
    orderedParents.push(current);
    remaining.delete(current);

    while (remaining.size > 0) {
      const neighbors = parentAdjacency.get(current.id) || new Set();
      let next: GraphNode | null = null;
      for (const cand of remaining) {
        if (neighbors.has(cand.id)) {
          next = cand;
          break;
        }
      }
      if (!next) {
        next = [...remaining].sort((a, b) => degreeMap[b.id] - degreeMap[a.id] || a.id.localeCompare(b.id))[0];
      }
      orderedParents.push(next);
      remaining.delete(next);
      current = next;
    }
  }

  const placedIds = new Set<string>([centerNode.id]);

  // Distribute parents in a circle
  const R1 = Math.max(180, Math.min(260, Math.min(W, H) * 0.30));
  orderedParents.forEach((parent, i) => {
    const angle = (i / Math.max(orderedParents.length, 1)) * 2 * Math.PI - Math.PI / 2;
    parent.x = cx + R1 * Math.cos(angle);
    parent.y = cy + R1 * Math.sin(angle);
    parent.fx = parent.x;
    parent.fy = parent.y;
    placedIds.add(parent.id);

    // 3. Find children of this parent (nodes connected to it, not placed yet)
    const childNodes: GraphNode[] = [];
    linksToUse.forEach(l => {
      const s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
      const t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
      if (s === parent.id && !placedIds.has(t)) {
        const node = nodes.find(n => n.id === t);
        if (node && !childNodes.some(c => c.id === node.id)) childNodes.push(node);
      }
      if (t === parent.id && !placedIds.has(s)) {
        const node = nodes.find(n => n.id === s);
        if (node && !childNodes.some(c => c.id === node.id)) childNodes.push(node);
      }
    });

    // Distribute children in an outward fan away from center
    const R2 = 88;
    const M = childNodes.length;
    if (M > 0) {
      const spread = Math.min(Math.PI * 0.45, Math.max(0.25, (M - 1) * 0.16));
      childNodes.sort((a, b) => a.id.localeCompare(b.id)).forEach((child, j) => {
        const t = M <= 1 ? 0 : (j / (M - 1)) * 2 - 1;
        const childAngle = angle + t * (spread / 2);
        const childRadius = R2 + (j % 2 === 0 ? 0 : 28);
        child.x = parent.x! + childRadius * Math.cos(childAngle);
        child.y = parent.y! + childRadius * Math.sin(childAngle);
        child.fx = child.x;
        child.fy = child.y;
        placedIds.add(child.id);
      });
    }
  });

  // 4. Distribute any remaining unplaced nodes in an outer ring
  const remaining = nodes.filter(n => !placedIds.has(n.id));
  if (remaining.length > 0) {
    const R3 = R1 + 160;
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
 * 按照类型拓扑流排序列，行内节点采用邻居重心排序消除交叉
 */
export function applyGridLayout(nodes: GraphNode[], W: number, H: number, links?: GraphLink[]): void {
  const cx = W / 2;
  const cy = H / 2;
  const padding = 60;
  const availW = Math.max(W - padding * 2, 200);

  const semanticLinks = (links || []).filter(l => !l._isTypeInstLink);
  const typeAffinity = computeTypeAffinityMatrix(nodes, semanticLinks);
  const typeHubs = orderTypeHubsCirculary(
    nodes.filter(n => n.group === 'typeHub'),
    typeAffinity
  );
  const instances = nodes.filter(n => n.group === 'instance');
  const actions = nodes.filter(n => n.group === 'action');

  const typeCount = Math.max(typeHubs.length, 1);
  const colSpacing = Math.min(300, Math.max(200, availW / typeCount));
  const totalColWidth = (typeCount - 1) * colSpacing;
  const startColX = cx - totalColWidth / 2;

  // Map to store row indices of placed instances for barycentric adjacent column sorting
  const placedRowIndex = new Map<string, number>();

  typeHubs.forEach((hub, colIdx) => {
    const colX = startColX + colIdx * colSpacing;
    hub.x = colX;
    hub.y = cy - 160;
    hub.fx = hub.x;
    hub.fy = hub.y;

    const colInstances = instances
      .filter(n => n._typeId === hub._typeId);

    if (colInstances.length === 0) return;

    // Barycentric sorting within this column based on placed neighbors in previous columns
    if (semanticLinks.length > 0 && placedRowIndex.size > 0) {
      colInstances.sort((a, b) => {
        const neighborsA = semanticLinks
          .filter(l => {
            const s = typeof l.source === 'object' ? (l.source as any).id : String(l.source);
            const t = typeof l.target === 'object' ? (l.target as any).id : String(l.target);
            return (s === a.id && placedRowIndex.has(t)) || (t === a.id && placedRowIndex.has(s));
          })
          .map(l => {
            const s = typeof l.source === 'object' ? (l.source as any).id : String(l.source);
            const t = typeof l.target === 'object' ? (l.target as any).id : String(l.target);
            return s === a.id ? placedRowIndex.get(t)! : placedRowIndex.get(s)!;
          });

        const neighborsB = semanticLinks
          .filter(l => {
            const s = typeof l.source === 'object' ? (l.source as any).id : String(l.source);
            const t = typeof l.target === 'object' ? (l.target as any).id : String(l.target);
            return (s === b.id && placedRowIndex.has(t)) || (t === b.id && placedRowIndex.has(s));
          })
          .map(l => {
            const s = typeof l.source === 'object' ? (l.source as any).id : String(l.source);
            const t = typeof l.target === 'object' ? (l.target as any).id : String(l.target);
            return s === b.id ? placedRowIndex.get(t)! : placedRowIndex.get(s)!;
          });

        const bcA = neighborsA.length > 0 ? neighborsA.reduce((s, r) => s + r, 0) / neighborsA.length : 0;
        const bcB = neighborsB.length > 0 ? neighborsB.reduce((s, r) => s + r, 0) / neighborsB.length : 0;
        return bcA - bcB || a.id.localeCompare(b.id);
      });
    } else {
      colInstances.sort((a, b) => a.id.localeCompare(b.id));
    }

    const rowStep = 105;
    colInstances.forEach((inst, rowIdx) => {
      inst.x = colX;
      inst.y = cy - 70 + rowIdx * rowStep;
      inst.fx = inst.x;
      inst.fy = inst.y;
      placedRowIndex.set(inst.id, rowIdx);

      const instActions = actions
        .filter(n => n._objId === inst._objId)
        .sort((a, b) => a.id.localeCompare(b.id));

      instActions.forEach((act, actIdx) => {
        act.x = inst.x! + 44 + actIdx * 26;
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
    const stepX = 80;
    const stepY = 60;
    const startX = cx - ((cols - 1) * stepX) / 2;
    unhandled.forEach((node, idx) => {
      const c = idx % cols;
      const r = Math.floor(idx / cols);
      node.x = startX + c * stepX;
      node.y = cy + 120 + r * stepY;
      node.fx = node.x;
      node.fy = node.y;
    });
  }
}

/**
 * 分组环形排列 (Grouped Circular Layout)
 * 不同类型的节点各自在独立的圆环上围绕其中心进行排列，强关联类型在环上相邻放置
 */
export function applyGroupedCircularLayout(nodes: GraphNode[], W: number, H: number, links?: GraphLink[]): void {
  const cx = W / 2;
  const cy = H / 2;

  const semanticLinks = (links || []).filter(l => !l._isTypeInstLink);
  const typeAffinity = computeTypeAffinityMatrix(nodes, semanticLinks);
  const typeHubs = orderTypeHubsCirculary(
    nodes.filter(n => n.group === 'typeHub'),
    typeAffinity
  );
  const instances = nodes.filter(n => n.group === 'instance');
  const actions = nodes.filter(n => n.group === 'action');

  const typeCount = Math.max(typeHubs.length, 1);
  const layoutRadius = Math.min(W, H) * (typeCount <= 3 ? 0.30 : 0.34);

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

    const instRadius = 65 + Math.floor(instCount / 8) * 18;
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
 * 顶部为输入/祖先实体与类型，中部为逐层派生的下游实体，底部为叶子与行动
 * 采用有向无环图分层 (DAG Stratification) 与双向重心法行内排序，彻底消除折线交叉
 */
export function applyVerticalTreeLayout(nodes: GraphNode[], W: number, H: number, links?: GraphLink[]): void {
  const semanticLinks = (links || []).filter(l => !l._isTypeInstLink);
  if (semanticLinks.length > 0) {
    applyTopologicalFlowLayout(nodes, semanticLinks, W, H, { direction: 'TB' });
    return;
  }

  // Fallback when no semantic links exist: column-wise by ObjectType
  const cx = W / 2;
  const cy = H / 2;

  const typeHubs = nodes.filter(n => n.group === 'typeHub').sort((a, b) => a.id.localeCompare(b.id));
  const instances = nodes.filter(n => n.group === 'instance');
  const actions = nodes.filter(n => n.group === 'action');

  const typeCount = Math.max(typeHubs.length, 1);
  const colSpacing = Math.min(260, Math.max(180, (W - 120) / Math.max(typeCount, 1)));
  const totalColWidth = (typeCount - 1) * colSpacing;
  const startColX = cx - totalColWidth / 2;

  // Vertical levels centered around cy
  const yType = cy - 130;
  const yInstBase = cy - 40;

  typeHubs.forEach((hub, colIdx) => {
    const colX = startColX + colIdx * colSpacing;
    hub.x = colX;
    hub.y = yType;
    hub.fx = hub.x;
    hub.fy = hub.y;

    const colInstances = instances
      .filter(n => n._typeId === hub._typeId)
      .sort((a, b) => a.id.localeCompare(b.id));

    const instCount = colInstances.length;
    if (instCount === 0) return;

    // Arrange instances in 1 column (up to 3) or 2 columns (4+)
    const actualCols = instCount <= 3 ? 1 : 2;
    const colGap = 125;
    const rowGap = 90;
    const startX = colX - ((actualCols - 1) * colGap) / 2;

    colInstances.forEach((inst, instIdx) => {
      const gridCol = instIdx % actualCols;
      const gridRow = Math.floor(instIdx / actualCols);

      inst.x = startX + gridCol * colGap;
      inst.y = yInstBase + gridRow * rowGap;
      inst.fx = inst.x;
      inst.fy = inst.y;

      const instActions = actions
        .filter(n => n._objId === inst._objId)
        .sort((a, b) => a.id.localeCompare(b.id));

      const actCount = instActions.length;
      if (actCount === 0) return;

      const actSpacing = 36;
      const actWidth = (actCount - 1) * actSpacing;
      const actStartY = inst.y! + 40;

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
    const step = 80;
    const startX = cx - ((unhandled.length - 1) * step) / 2;
    unhandled.forEach((node, idx) => {
      node.x = startX + idx * step;
      node.y = cy + 180;
      node.fx = node.x;
      node.fy = node.y;
    });
  }
}

/**
 * 横向树状层级排列 (Horizontal Tree Layout)
 * 左侧为输入/前驱实体，中部为逐级派生实体，右侧为叶子与行动
 * 采用有向无环图分层 (DAG Stratification) 与双向重心法列内排序
 */
export function applyHorizontalTreeLayout(nodes: GraphNode[], W: number, H: number, links?: GraphLink[]): void {
  const cx = W / 2;
  const cy = H / 2;

  const typeHubs = nodes.filter(n => n.group === 'typeHub').sort((a, b) => a.id.localeCompare(b.id));
  const instances = nodes.filter(n => n.group === 'instance');
  const actions = nodes.filter(n => n.group === 'action');

  // 1. 全局跨组拓扑排序：计算各实例节点的真实依赖层级，保证有向连线严格从左往右自然流动，根除倒流与交织
  const outgoing = new Map<string, Set<string>>();
  const incoming = new Map<string, Set<string>>();
  instances.forEach(n => {
    outgoing.set(n.id, new Set());
    incoming.set(n.id, new Set());
  });

  const semanticLinks = (links || []).filter(l => !l._isTypeInstLink && !l._isActionLink);
  semanticLinks.forEach(l => {
    const sId = typeof l.source === 'object' ? (l.source as any).id : String(l.source);
    const tId = typeof l.target === 'object' ? (l.target as any).id : String(l.target);
    if (outgoing.has(sId) && incoming.has(tId) && sId !== tId) {
      outgoing.get(sId)!.add(tId);
      incoming.get(tId)!.add(sId);
    }
  });

  // 环路检测与破环 (DFS)
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const backEdges = new Set<string>();

  function detectBackEdges(u: string) {
    visited.add(u);
    inStack.add(u);
    for (const v of outgoing.get(u) || []) {
      if (!visited.has(v)) {
        detectBackEdges(v);
      } else if (inStack.has(v)) {
        backEdges.add(`${u}|${v}`);
      }
    }
    inStack.delete(u);
  }
  instances.forEach(n => {
    if (!visited.has(n.id)) detectBackEdges(n.id);
  });

  const topoRank = new Map<string, number>();
  const inDegree = new Map<string, number>();
  instances.forEach(n => {
    let deg = 0;
    for (const p of incoming.get(n.id) || []) {
      if (!backEdges.has(`${p}|${n.id}`)) deg++;
    }
    inDegree.set(n.id, deg);
  });

  const queue: string[] = instances.filter(n => (inDegree.get(n.id) || 0) === 0).map(n => n.id);
  queue.forEach(id => topoRank.set(id, 0));

  let cursor = 0;
  while (cursor < queue.length) {
    const u = queue[cursor++];
    const rU = topoRank.get(u) || 0;
    for (const v of outgoing.get(u) || []) {
      if (backEdges.has(`${u}|${v}`)) continue;
      const nextR = rU + 1;
      if (!topoRank.has(v) || topoRank.get(v)! < nextR) {
        topoRank.set(v, nextR);
        queue.push(v);
      }
    }
  }
  instances.forEach(n => {
    if (!topoRank.has(n.id)) topoRank.set(n.id, 0);
  });

  // 压缩空秩列，确保层级紧凑连续
  const usedRanks = Array.from(new Set(topoRank.values())).sort((a, b) => a - b);
  const rankCompressMap = new Map(usedRanks.map((r, idx) => [r, idx]));
  instances.forEach(n => {
    topoRank.set(n.id, rankCompressMap.get(topoRank.get(n.id) || 0) || 0);
  });

  const maxRank = Math.max(...Array.from(topoRank.values()), 0);
  const hasSemanticLinks = semanticLinks.length > 0;

  const typeCount = Math.max(typeHubs.length, 1);
  const rowSpacing = Math.min(200, Math.max(140, (H - 140) / Math.max(typeCount, 1)));
  const totalRowHeight = (typeCount - 1) * rowSpacing;
  const startRowY = cy - totalRowHeight / 2;

  const colGap = 135;
  const totalCols = hasSemanticLinks ? Math.max(maxRank + 1, 3) : 3;
  const xType = cx - (totalCols * colGap + 180) / 2;
  const xInstBase = xType + 160;

  typeHubs.forEach((hub, rowIdx) => {
    const rowY = startRowY + rowIdx * rowSpacing;
    hub.x = xType;
    hub.y = rowY;
    hub.fx = hub.x;
    hub.fy = hub.y;

    let rowInstances = instances.filter(n => n._typeId === hub._typeId);
    const instCount = rowInstances.length;
    if (instCount === 0) return;

    if (hasSemanticLinks) {
      rowInstances.sort((a, b) => {
        const rDiff = (topoRank.get(a.id) || 0) - (topoRank.get(b.id) || 0);
        if (rDiff !== 0) return rDiff;
        const degDiff = (inDegree.get(a.id) || 0) - (inDegree.get(b.id) || 0);
        if (degDiff !== 0) return degDiff;
        return a.id.localeCompare(b.id);
      });

      const rankGroupCounts = new Map<number, number>();
      const rankSubIndex = new Map<string, number>();
      rowInstances.forEach(n => {
        const r = topoRank.get(n.id) || 0;
        const count = rankGroupCounts.get(r) || 0;
        rankSubIndex.set(n.id, count);
        rankGroupCounts.set(r, count + 1);
      });

      const maxNodesInSameRank = Math.max(...Array.from(rankGroupCounts.values()), 1);
      const actualRows = Math.min(2, Math.max(instCount > 3 ? 2 : 1, maxNodesInSameRank));
      const rowGap = 85;
      const startY = rowY - ((actualRows - 1) * rowGap) / 2;

      rowInstances.forEach(inst => {
        const r = topoRank.get(inst.id) || 0;
        const subIdx = rankSubIndex.get(inst.id) || 0;
        const gridRow = subIdx % actualRows;
        const gridCol = r;

        inst.x = xInstBase + gridCol * colGap;
        inst.y = startY + gridRow * rowGap;
        inst.fx = inst.x;
        inst.fy = inst.y;

        const instActions = actions
          .filter(n => n._objId === inst._objId)
          .sort((a, b) => a.id.localeCompare(b.id));

        const actCount = instActions.length;
        if (actCount === 0) return;

        const actSpacing = 28;
        const actStartX = inst.x! + 40;

        instActions.forEach((act, actIdx) => {
          act.x = actStartX;
          act.y = inst.y! - actSpacing * ((actCount - 1) / 2) + actIdx * actSpacing;
          act.fx = act.x;
          act.fy = act.y;
        });
      });
    } else {
      // 无跨节点语义关系时的经典基准排列（与基准上传图 100% 像素级对齐）
      rowInstances.sort((a, b) => a.id.localeCompare(b.id));
      const actualRows = instCount <= 3 ? 1 : 2;
      const rowGap = 85;
      const startY = rowY - ((actualRows - 1) * rowGap) / 2;

      rowInstances.forEach((inst, instIdx) => {
        const gridRow = instIdx % actualRows;
        const gridCol = Math.floor(instIdx / actualRows);

        inst.x = xInstBase + gridCol * colGap;
        inst.y = startY + gridRow * rowGap;
        inst.fx = inst.x;
        inst.fy = inst.y;

        const instActions = actions
          .filter(n => n._objId === inst._objId)
          .sort((a, b) => a.id.localeCompare(b.id));

        const actCount = instActions.length;
        if (actCount === 0) return;

        const actSpacing = 28;
        const actStartX = inst.x! + 40;

        instActions.forEach((act, actIdx) => {
          act.x = actStartX;
          act.y = inst.y! - actSpacing * ((actCount - 1) / 2) + actIdx * actSpacing;
          act.fx = act.x;
          act.fy = act.y;
        });
      });
    }
  });

  const handledIds = new Set(nodes.filter(n => n.fx !== undefined).map(n => n.id));
  const unhandled = nodes.filter(n => !handledIds.has(n.id));
  if (unhandled.length > 0) {
    const cols = Math.ceil(Math.sqrt(unhandled.length));
    const stepX = 80;
    const stepY = 60;
    const startX = cx + 180;
    unhandled.forEach((node, idx) => {
      const c = idx % cols;
      const r = Math.floor(idx / cols);
      node.x = startX + c * stepX;
      node.y = cy + (r - cols / 2) * stepY;
      node.fx = node.x;
      node.fy = node.y;
    });
  }
}
