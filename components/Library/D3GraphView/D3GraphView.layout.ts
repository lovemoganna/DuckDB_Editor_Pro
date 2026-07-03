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

/**
 * Compute which node labels should be visible to avoid text overlap.
 *
 * Strategy: greedy placement with importance sorting + quadtree-based collision
 * detection. Labels are sorted by importance (degree centrality), then placed
 * greedily — a label is shown only if it does not overlap any already-placed
 * label. Uses a d3 quadtree to make collision checks O(log n) instead of O(n).
 */
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

  if (zoom < 0.5) {
    // At very low zoom, show only top-centrality typeHubs so the graph
    // always has at least some readable structure — no instance/action labels.
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
    if (zoom < 0.5) return false;
    if (zoom < 1.0) return n.group === 'typeHub';
    if (zoom < 2.0) {
      return n.group === 'typeHub' || ((n as any)._degree || 0) >= 3;
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
