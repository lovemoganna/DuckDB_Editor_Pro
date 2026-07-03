/**
 * graphClusteringService — Graph clustering algorithms for D3GraphView.
 *
 * Provides 4 clustering functions:
 *   detectCommunities  — Louvain-inspired community detection
 *   clusterByType     — Group by node type (typeHub / instance / action)
 *   clusterByProperty — Group by arbitrary node property key
 *   findConnectedComponents — BFS connected components
 *
 * All return Cluster[] for D3GraphView hull/boundary rendering.
 */

export interface Cluster {
  id: string;
  label: string;
  nodeIds: string[];
  color: string;
}

const TYPE_COLORS_WARM = [
  '#c77dff', '#ff6b9d', '#ffa040', '#ffe066', '#7dd87d',
  '#ff6b9d', '#c77dff', '#ffa040', '#ffe066',
];

function nodeId(n: any): string {
  return typeof n === 'object' ? n.id : String(n);
}

function getSourceId(link: any): string {
  return typeof link.source === 'object' ? link.source.id : String(link.source);
}
function getTargetId(link: any): string {
  return typeof link.target === 'object' ? link.target.id : String(link.target);
}

// ── Connected Components (BFS) ─────────────────────────────────────────────────

export function findConnectedComponents(
  nodes: any[],
  links: any[],
): Cluster[] {
  const adj = new Map<string, string[]>();
  nodes.forEach(n => adj.set(n.id, []));
  links.forEach(l => {
    const s = getSourceId(l);
    const t = getTargetId(l);
    if (adj.has(s)) adj.get(s)!.push(t);
    if (adj.has(t)) adj.get(t)!.push(s);
  });

  const visited = new Set<string>();
  const components: Cluster[] = [];
  let compIdx = 0;

  nodes.forEach(start => {
    if (visited.has(start.id)) return;
    const queue = [start.id];
    visited.add(start.id);
    const ids: string[] = [];

    while (queue.length > 0) {
      const cur = queue.shift()!;
      ids.push(cur);
      for (const nb of (adj.get(cur) || [])) {
        if (!visited.has(nb)) {
          visited.add(nb);
          queue.push(nb);
        }
      }
    }

    components.push({
      id: `cc-${compIdx++}`,
      label: `CC ${compIdx}`,
      nodeIds: ids,
      color: TYPE_COLORS_WARM[compIdx % TYPE_COLORS_WARM.length],
    });
  });

  return components;
}

// ── Community Detection (Louvain-inspired greedy) ──────────────────────────────

/**
 * Simplified Louvain:
 * 1. Start each node in its own community.
 * 2. Iteratively merge: for each node, try moving it into the community
 *    of each neighbor that gives the highest modularity gain.
 * 3. Stop when no improvement is possible.
 *
 * Modularity gain is approximated by edge weight sum × neighbor overlap.
 */
export function detectCommunities(
  nodes: any[],
  links: any[],
): Cluster[] {
  const nodeIds = nodes.map(n => n.id);
  const nodeMap = new Map(nodeIds.map((id, i) => [id, i]));

  // Edge weight sum for normalization
  const totalWeight = links.reduce((s, l) => s + (Number(l.weight) || 0.5), 0) || 1;

  // Build adjacency with weights
  const adj = new Map<string, { nb: string; w: number }[]>();
  nodeIds.forEach(id => adj.set(id, []));
  links.forEach(l => {
    const s = getSourceId(l);
    const t = getTargetId(l);
    const w = Number(l.weight) || 0.5;
    adj.get(s)!.push({ nb: t, w });
    adj.get(t)!.push({ nb: s, w });
  });

  // Each node starts in its own community
  const community = new Map<string, number>();
  nodeIds.forEach((id, i) => community.set(id, i));
  let communityCount = nodeIds.length;

  // Track community members
  const commMembers = new Map<number, Set<string>>();
  nodeIds.forEach((id, i) => commMembers.set(i, new Set([id])));

  // Precompute sum of incident edge weights per node
  const nodeIncident = new Map<string, number>();
  nodeIds.forEach(id => {
    const total = (adj.get(id) || []).reduce((s, e) => s + e.w, 0) || 0.001;
    nodeIncident.set(id, total);
  });

  // Iterative merging — up to 5 passes for performance
  for (let pass = 0; pass < 5; pass++) {
    let improved = false;

    // Shuffle for unbiased order
    const shuffled = [...nodeIds];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    for (const nodeId of shuffled) {
      const currentComm = community.get(nodeId)!;
      const neighbors = adj.get(nodeId) || [];
      if (neighbors.length === 0) continue;

      const nodeW = nodeIncident.get(nodeId) || 0.001;

      // Count edges to each neighboring community
      const commEdgeSum = new Map<number, number>();
      neighbors.forEach(({ nb, w }) => {
        const c = community.get(nb);
        if (c === undefined) return;
        commEdgeSum.set(c, (commEdgeSum.get(c) || 0) + w);
      });

      // Current community internal edges
      const currentCommW = commEdgeSum.get(currentComm) || 0;

      // Best community to move to
      let bestComm = currentComm;
      let bestGain = 0;

      commEdgeSum.forEach((edgeW, c) => {
        if (c === currentComm) return;
        // Modularity gain approximation:
        // gain ∝ (edges_to_community / total_edges) - (node_incident / total_edges)²
        const gain = (edgeW / totalWeight) - Math.pow(nodeW / totalWeight, 2);
        if (gain > bestGain) {
          bestGain = gain;
          bestComm = c;
        }
      });

      if (bestComm !== currentComm && bestGain > 0) {
        // Move node to best community
        commMembers.get(currentComm)?.delete(nodeId);
        community.set(nodeId, bestComm);
        if (!commMembers.has(bestComm)) commMembers.set(bestComm, new Set());
        commMembers.get(bestComm)!.add(nodeId);
        improved = true;
      }
    }

    if (!improved) break;
  }

  // Build community id → node list map
  const commMap = new Map<number, string[]>();
  community.forEach((c, id) => {
    if (!commMap.has(c)) commMap.set(c, []);
    commMap.get(c)!.push(id);
  });

  // Filter singletons (communities with < 2 members)
  const clusters: Cluster[] = [];
  let idx = 0;
  commMap.forEach((ids, _c) => {
    if (ids.length < 2) return;
    // Use most-connected node's label as cluster label
    let hubId = ids[0];
    let maxDeg = -1;
    ids.forEach(id => {
      const deg = (adj.get(id) || []).length;
      if (deg > maxDeg) { maxDeg = deg; hubId = id; }
    });
    const hubNode = nodes.find(n => n.id === hubId);
    clusters.push({
      id: `comm-${idx++}`,
      label: hubNode?.label || `社区 ${idx}`,
      nodeIds: ids,
      color: TYPE_COLORS_WARM[idx % TYPE_COLORS_WARM.length],
    });
  });

  return clusters;
}

// ── Cluster by Type ──────────────────────────────────────────────────────────

export function clusterByType(nodes: any[]): Cluster[] {
  const groups = new Map<string, string[]>();
  nodes.forEach(n => {
    const g = n.group || 'other';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(n.id);
  });

  const typeColors: Record<string, string> = {
    typeHub: '#c77dff',
    instance: '#60c0e0',
    action: '#ff5a8a',
    linkType: '#ffe066',
    other: '#9b8fff',
  };

  return Array.from(groups.entries()).map(([group, ids], i) => ({
    id: `type-${group}`,
    label: group,
    nodeIds: ids,
    color: typeColors[group] || TYPE_COLORS_WARM[i % TYPE_COLORS_WARM.length],
  }));
}

// ── Cluster by Property ──────────────────────────────────────────────────────

export function clusterByProperty(nodes: any[], propKey: string): Cluster[] {
  const groups = new Map<string, string[]>();
  nodes.forEach(n => {
    const val = n[propKey] ?? '__none__';
    const key = String(val);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(n.id);
  });

  const entries = Array.from(groups.entries());
  return entries.map(([key, ids], i) => ({
    id: `prop-${propKey}-${key}`,
    label: key,
    nodeIds: ids,
    color: TYPE_COLORS_WARM[i % TYPE_COLORS_WARM.length],
  }));
}
