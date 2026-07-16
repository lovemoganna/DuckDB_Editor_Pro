/**
 * D3GraphView — Pure Helpers
 *
 * Extracted from D3GraphView.tsx.
 * Contains pure (stateless) helper functions used throughout the component:
 *   - Path and edge routing utilities
 *   - BFS shortest path
 *   - Node highlight / dim helpers
 *   - Node info HTML generation
 *   - Edge filter mask computation
 *   - Viewport culling
 */

import type { GraphNode, GraphLink } from './D3GraphView.types';

// ── Graph Navigation ────────────────────────────────────────────────────────

/**
 * BFS shortest path between two nodes.
 * Returns Set of node IDs on the path (including source and target).
 */
export function findShortestPath(sourceId: string, targetId: string, links: GraphLink[]): Set<string> {
  const visited = new Set<string>([sourceId]);
  const queue: { id: string; path: string[] }[] = [{ id: sourceId, path: [sourceId] }];
  while (queue.length > 0) {
    const { id, path } = queue.shift()!;
    if (id === targetId) return new Set(path);
    links.forEach(l => {
      const src = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
      const tgt = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
      let nextId: string | null = null;
      if (src === id && !visited.has(tgt)) { nextId = tgt; }
      if (tgt === id && !visited.has(src)) { nextId = src; }
      if (nextId) {
        visited.add(nextId);
        queue.push({ id: nextId, path: [...path, nextId] });
      }
    });
  }
  return new Set<string>();
}

// ── Node Helpers ────────────────────────────────────────────────────────────

export function getSourceNode(l: GraphLink, nodeMap: Map<string, GraphNode>): GraphNode | undefined {
  if (typeof l.source === 'object') return l.source as GraphNode;
  return nodeMap.get(l.source);
}

export function getTargetNode(l: GraphLink, nodeMap: Map<string, GraphNode>): GraphNode | undefined {
  if (typeof l.target === 'object') return l.target as GraphNode;
  return nodeMap.get(l.target);
}

// ── Edge Routing ─────────────────────────────────────────────────────────────

/**
 * Build SVG path d attribute from link data + optional curvature.
 */
export function linkPathD(d: GraphLink, getSrc: () => { x?: number; y?: number } | undefined, getTgt: () => { x?: number; y?: number } | undefined, curveOffset = 0): string {
  const s = getSrc();
  const t = getTgt();
  if (!s || !t) return '';
  const sx = s.x || 0, sy = s.y || 0;
  const tx = t.x || 0, ty = t.y || 0;
  if (curveOffset === 0) {
    return `M${sx},${sy} L${tx},${ty}`;
  }
  const mx = (sx + tx) / 2, my = (sy + ty) / 2;
  const dx = tx - sx, dy = ty - sy;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len * curveOffset;
  const ny = dx / len * curveOffset;
  return `M${sx},${sy} Q${mx + nx},${my + ny} ${tx},${ty}`;
}

/**
 * Get perpendicular offset for edge routing based on type and grouped offset.
 */
export function getCurveOffset(
  d: GraphLink,
  getSrc: () => GraphNode | undefined,
  getTgt: () => GraphNode | undefined,
  edgeGroupOffsets: Map<string, number>
): number {
  const s = getSrc();
  const t = getTgt();
  if (!s || !t) return 0;
  const isInst = (n: any) => n.group === 'instance';
  const sId = s.id, tId = t.id;
  const key = `${sId}|${tId}`;
  const groupOffset = edgeGroupOffsets.get(key);
  if (groupOffset !== undefined && groupOffset !== 0) return groupOffset;
  if (isInst(s) && isInst(t)) return 30;
  if ((isInst(s) && t.group === 'typeHub') || (s.group === 'typeHub' && isInst(t))) return 30;
  return 0;
}

// ── Label Transform ──────────────────────────────────────────────────────────

export function getLabelTransform(d: GraphLink, getSrc: () => { x?: number; y?: number } | undefined, getTgt: () => { x?: number; y?: number } | undefined): string {
  const src = getSrc(), tgt = getTgt();
  if (!src || !tgt) return '';
  const sx = src.x || 0, sy = src.y || 0;
  const tx = tgt.x || 0, ty = tgt.y || 0;
  const mx = (sx + tx) / 2;
  const my = (sy + ty) / 2;
  const dx = tx - sx, dy = ty - sy;
  let angle = Math.atan2(dy, dx) * 180 / Math.PI;
  if (angle > 90 || angle < -90) angle += 180;
  return `translate(${mx}, ${my}) rotate(${angle}) translate(0, -6)`;
}

// ── Viewport Culling ─────────────────────────────────────────────────────────

export function getVisibleNodes(
  nodes: GraphNode[],
  transform: { k: number; x: number; y: number; invert: (pt: [number, number]) => [number, number] },
  W: number,
  H: number,
  buffer = 500
): GraphNode[] {
  const [x0, y0] = transform.invert([0, 0]);
  const [x1, y1] = transform.invert([W, H]);
  return nodes.filter(n => {
    const nx = n.x || 0, ny = n.y || 0;
    return nx >= x0 - buffer && nx <= x1 + buffer
        && ny >= y0 - buffer && ny <= y1 + buffer;
  });
}

// ── Edge Filtering ────────────────────────────────────────────────────────────

export interface FilterOptions {
  filterLinkTypes: Set<number>;
  filterWeightMin: number;
  filterWeightMax: number;
  filterDirection: 'all' | 'in' | 'out';
  filterNodeKeyword: string;
  focusedNodeId: string | null;
  filterWeightPercentile: number;
  filterNodeImportance: 'all' | 'hub' | 'peripheral';
}

export function getFilteredLinkMask(links: GraphLink[], nodes: GraphNode[], opts: FilterOptions): Set<number> {
  const hidden = new Set<number>();
  const keyword = opts.filterNodeKeyword.toLowerCase().trim();
  const nodeMap = new Map<string, GraphNode>(nodes.map(n => [n.id, n]));

  const degreeMap = new Map<string, number>();
  nodes.forEach(n => degreeMap.set(n.id, 0));
  links.forEach(l => {
    const s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
    const t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
    degreeMap.set(s, (degreeMap.get(s) || 0) + 1);
    degreeMap.set(t, (degreeMap.get(t) || 0) + 1);
  });
  const avgDegree = nodes.length > 0
    ? [...degreeMap.values()].reduce((a, b) => a + b, 0) / nodes.length
    : 0;
  const hubThreshold = avgDegree * 2;

  const allWeights = links.map(l => Number(l.weight) || 0.5).sort((a, b) => a - b);
  const percentileIdx = Math.floor(allWeights.length * (opts.filterWeightPercentile / 100));
  const weightThreshold = allWeights[Math.max(0, percentileIdx - 1)] ?? 0;

  links.forEach((l, idx) => {
    if (opts.filterLinkTypes.size > 0 && l._linkTypeId !== undefined && !opts.filterLinkTypes.has(l._linkTypeId)) {
      hidden.add(idx); return;
    }
    const w = Number(l.weight) || 0.5;
    if (w < opts.filterWeightMin || w > opts.filterWeightMax) { hidden.add(idx); return; }
    if (opts.filterWeightPercentile < 100 && w < weightThreshold) { hidden.add(idx); return; }
    if (opts.filterDirection !== 'all') {
      const src = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
      const tgt = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
      if (opts.filterDirection === 'out' && opts.focusedNodeId && src !== opts.focusedNodeId) hidden.add(idx);
      if (opts.filterDirection === 'in' && opts.focusedNodeId && tgt !== opts.focusedNodeId) hidden.add(idx);
    }
    if (keyword) {
      const src = typeof l.source === 'object' ? (l.source as GraphNode) : nodeMap.get(l.source);
      const tgt = typeof l.target === 'object' ? (l.target as GraphNode) : nodeMap.get(l.target);
      const srcMatch = src?.label?.toLowerCase().includes(keyword) || false;
      const tgtMatch = tgt?.label?.toLowerCase().includes(keyword) || false;
      if (!srcMatch && !tgtMatch) { hidden.add(idx); return; }
    }
    if (opts.filterNodeImportance === 'hub') {
      const srcDeg = degreeMap.get(typeof l.source === 'object' ? (l.source as GraphNode).id : l.source) || 0;
      const tgtDeg = degreeMap.get(typeof l.target === 'object' ? (l.target as GraphNode).id : l.target) || 0;
      if (srcDeg < hubThreshold && tgtDeg < hubThreshold) { hidden.add(idx); return; }
    } else if (opts.filterNodeImportance === 'peripheral') {
      const srcDeg = degreeMap.get(typeof l.source === 'object' ? (l.source as GraphNode).id : l.source) || 0;
      const tgtDeg = degreeMap.get(typeof l.target === 'object' ? (l.target as GraphNode).id : l.target) || 0;
      if (srcDeg >= hubThreshold || tgtDeg >= hubThreshold) { hidden.add(idx); return; }
    }
  });
  return hidden;
}

// ── Degree Centrality ─────────────────────────────────────────────────────────

export interface CentralityResult {
  degreeMap: Record<string, number>;
  topCentralityIds: Set<string>;
  centralityThreshold: number;
}

export function computeDegreeCentrality(nodes: GraphNode[], links: GraphLink[]): CentralityResult {
  const degreeMap: Record<string, number> = {};
  nodes.forEach(n => { degreeMap[n.id] = 0; });
  links.forEach(l => {
    const s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
    const t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
    if (degreeMap[s] !== undefined) degreeMap[s]++;
    if (degreeMap[t] !== undefined) degreeMap[t]++;
  });
  nodes.forEach(n => { (n as any)._degree = degreeMap[n.id] || 0; });
  const sortedDegrees = Object.values(degreeMap).sort((a, b) => b - a);
  const topN = Math.max(1, Math.floor(sortedDegrees.length * 0.1));
  const centralityThreshold = sortedDegrees[topN - 1] ?? 0;
  const topCentralityIds = new Set(
    Object.entries(degreeMap).filter(([, d]) => d >= centralityThreshold).map(([id]) => id)
  );
  return { degreeMap, topCentralityIds, centralityThreshold };
}

// ── Neighborhood Computation ──────────────────────────────────────────────────

export function computeNeighborIds(seedId: string, links: GraphLink[], hops: number): Set<string> {
  const neighbors = new Set<string>([seedId]);
  let frontier = [seedId];
  for (let h = 0; h < hops; h++) {
    const next: string[] = [];
    frontier.forEach(id => {
      links.forEach(l => {
        const src = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
        const tgt = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
        if (src === id && !neighbors.has(tgt)) { neighbors.add(tgt); next.push(tgt); }
        if (tgt === id && !neighbors.has(src)) { neighbors.add(src); next.push(src); }
      });
    });
    frontier = next;
  }
  return neighbors;
}

// ── Node Info HTML ──────────────────────────────────────────────────────────

export function getBaseNodeInfoHtml(d: GraphNode, data: { nodes: GraphNode[]; links: GraphLink[]; typeMap: Record<number, any>; linkTypeMap: Record<number, any> }): string {
  const groupLabels: Record<string, string> = {
    typeHub: '类型 (Type)', instance: '实例 (Instance)',
    linkType: '关系类型', action: '行动 (Action)',
  };
  const grp = groupLabels[d.group] || d.group;

  const connLinks = data.links.filter(l => {
    const s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
    const t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
    return s === d.id || t === d.id;
  });

  let html = `<strong style="color:#7ee8fa;font-size:12px">${d.label}</strong><br>`;
  html += `<span style="color:#aaa;font-size:10px">类型: ${grp}</span><br>`;
  html += `<span style="color:#888;font-size:10px">连接数: ${connLinks.length}</span>`;

  if (d.group === 'typeHub' && d._instanceCount !== undefined) {
    html += `<br><span style="color:#888;font-size:10px">实例数: ${d._instanceCount}</span>`;
  }
  if (d.group === 'typeHub') {
    html += `<br><span style="color:#aaa;font-size:10px">类型名: </span><span style="color:#eee;font-size:10px">${d.label}</span>`;
    if (d.description) {
      html += `<br><span style="color:#aaa;font-size:10px">描述: </span><span style="color:#ddd;font-size:10px">${d.description.slice(0, 80)}</span>`;
    }
  }

  if (d.group === 'instance' && d._propsRaw) {
    let parsed: Record<string, any> = {};
    try { parsed = JSON.parse(d._propsRaw); } catch { /* non-JSON */ }
    const keys = Object.keys(parsed);
    if (keys.length > 0) {
      html += `<br><span style="color:#66d9ef;font-size:10px;font-weight:bold;margin-top:4px;display:block">属性 (${keys.length})</span>`;
      html += `<div style="max-height:140px;overflow-y:auto;margin-top:3px;background:rgba(0,0,0,0.35);border-radius:4px;padding:4px 6px">`;
      keys.forEach(k => {
        if (k.startsWith('_')) return;
        const v = parsed[k];
        const vStr = typeof v === 'object' ? JSON.stringify(v) : String(v);
        const shortVal = vStr.length > 40 ? vStr.slice(0, 40) + '…' : vStr;
        const escapedVal = vStr.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        html += `<div style="font-size:9.5px;line-height:1.6">`;
        html += `<span style="color:#ae81ff;font-weight:bold" title="${k}">${k}</span>`;
        html += `<span style="color:#ccc">: </span>`;
        html += `<span style="color:#eee" title="${escapedVal}">${shortVal}</span>`;
        html += `</div>`;
      });
      if (parsed._taxonomy) {
        html += `<div style="font-size:9.5px;line-height:1.6;margin-top:3px;border-top:1px dashed rgba(255,255,255,0.05);padding-top:3px">`;
        html += `<span style="color:#a6e22e;font-weight:bold">分类层级</span>`;
        html += `<span style="color:#ccc">: </span>`;
        html += `<span style="color:#ae81ff">${parsed._taxonomy}</span>`;
        html += `</div>`;
      }
      html += `</div>`;
    }
  } else if (d.description && d.group === 'instance' && !d._propsRaw) {
    html += `<br><span style="color:#666;font-size:10px">${d.description.slice(0, 80)}</span>`;
  }

  return html;
}

export function getNodeRelationSummary(d: GraphNode, data: { nodes: GraphNode[]; links: GraphLink[] }): { outgoing: string[]; incoming: string[] } {
  const outgoingLinks: string[] = [];
  const incomingLinks: string[] = [];

  data.links.forEach(l => {
    const sId = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
    const tId = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
    const sNode = typeof l.source === 'object' ? (l.source as GraphNode) : data.nodes.find(n => n.id === sId);
    const tNode = typeof l.target === 'object' ? (l.target as GraphNode) : data.nodes.find(n => n.id === tId);
    const relLabel = l.label || ((l as any)._relations && (l as any)._relations.length > 0 ? (l as any)._relations.join(', ') : '关联');

    if (sId === d.id && tNode) {
      outgoingLinks.push(`<span style="color:#f92672">-[${relLabel}]→</span> <span style="color:#eee;font-weight:bold">${tNode.label}</span> <span style="color:#888;font-size:8.5px">(${tNode.id})</span>`);
    } else if (tId === d.id && sNode) {
      incomingLinks.push(`<span style="color:#a6e22e">←[${relLabel}]-</span> <span style="color:#eee;font-weight:bold">${sNode.label}</span> <span style="color:#888;font-size:8.5px">(${sNode.id})</span>`);
    }
  });

  return { outgoing: outgoingLinks, incoming: incomingLinks };
}

// ── Community Metrics ────────────────────────────────────────────────────────

export interface CommunityMetrics {
  internalLinksCount: number;
  externalLinksCount: number;
  externalTargets: Record<string, number>;
  groupCounts: Record<string, number>;
  memberCount: number;
}

export function computeCommunityMetrics(d: GraphNode, data: { nodes: GraphNode[]; links: GraphLink[]; typeMap: Record<number, any> }): CommunityMetrics | null {
  if (d._communityId === undefined) return null;
  const communityId = d._communityId;
  const commMembers = data.nodes.filter(n => (n as any)._communityId === communityId);
  const memberIds = new Set(commMembers.map(n => n.id));

  let internalLinksCount = 0;
  let externalLinksCount = 0;
  const externalTargets: Record<string, number> = {};
  const groupCounts: Record<string, number> = {};

  const groupLabels: Record<string, string> = {
    typeHub: '类型 (Type)', instance: '实例 (Instance)',
    linkType: '关系类型', action: '行动 (Action)',
  };

  commMembers.forEach(m => {
    const typeLabel = m.group === 'instance' && m._typeId !== undefined
      ? (data.typeMap[m._typeId]?.name || '未知类型')
      : (groupLabels[m.group] || m.group);
    groupCounts[typeLabel] = (groupCounts[typeLabel] || 0) + 1;
  });

  data.links.forEach(l => {
    const s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
    const t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
    const sIn = memberIds.has(s);
    const tIn = memberIds.has(t);
    if (sIn && tIn) {
      internalLinksCount++;
    } else if (sIn || tIn) {
      externalLinksCount++;
      const extId = sIn ? t : s;
      const extNode = data.nodes.find(n => n.id === extId);
      if (extNode) {
        const label = extNode.group === 'typeHub' ? `类型: ${extNode.label}` : extNode.label;
        externalTargets[label] = (externalTargets[label] || 0) + 1;
      }
    }
  });

  return { internalLinksCount, externalLinksCount, externalTargets, groupCounts, memberCount: commMembers.length };
}

// ── Collapsed TypeHub Label Text ────────────────────────────────────────────

export function getCollapsedTypeHubLabel(node: GraphNode, collapsed: boolean): string {
  const label = node.description || node.label;
  if (collapsed) {
    const count = node._instanceCount || 0;
    const displayLabel = `${label} (+${count})`;
    return displayLabel.length > 22 ? displayLabel.slice(0, 22) + '…' : displayLabel;
  }
  return label.length > 18 ? label.slice(0, 18) + '…' : label;
}
