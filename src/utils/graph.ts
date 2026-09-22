/**
 * utils/graph.ts — Standalone graph utility functions
 *
 * Re-extracted from D3GraphView.helpers.ts for use in any module that needs
 * general-purpose graph algorithms without depending on D3GraphView.
 *
 * If you need D3-specific helpers (path finding, label transforms), those live in
 * components/Library/D3GraphView/D3GraphView.helpers.ts instead.
 */

export interface GraphNode {
  id: string;
  label?: string;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
}

function nodeId(n: string | GraphNode): string {
  return typeof n === 'object' ? n.id : n;
}

// ── degreeCentrality ───────────────────────────────────────────────────────────

export interface DegreeCentralityResult {
  degreeMap: Record<string, number>;
  avgDegree: number;
  topCentralityIds: Set<string>;
}

export function degreeCentrality(
  nodes: GraphNode[],
  links: GraphLink[],
  threshold = 0.8,
): DegreeCentralityResult {
  const degreeMap: Record<string, number> = {};
  nodes.forEach(n => { degreeMap[n.id] = 0; });

  links.forEach(l => {
    const s = nodeId(l.source);
    const t = nodeId(l.target);
    if (s in degreeMap) degreeMap[s]++;
    if (t in degreeMap) degreeMap[t]++;
  });

  const degrees = Object.values(degreeMap);
  const avgDegree = degrees.length > 0
    ? degrees.reduce((a, b) => a + b, 0) / degrees.length
    : 0;

  const maxDegree = Math.max(0, ...degrees);
  const topCentralityIds = new Set<string>();
  if (maxDegree > 0) {
    const cutoff = threshold * maxDegree;
    Object.entries(degreeMap).forEach(([id, d]) => {
      if (d >= cutoff) topCentralityIds.add(id);
    });
  }

  return { degreeMap, avgDegree, topCentralityIds };
}

// ── findConnectedComponents ─────────────────────────────────────────────────────

export interface Component {
  nodeIds: string[];
  nodeCount: number;
}

export function findConnectedComponents(
  nodes: GraphNode[],
  links: GraphLink[],
): Component[] {
  const adj = new Map<string, string[]>();
  nodes.forEach(n => adj.set(n.id, []));

  links.forEach(l => {
    const s = nodeId(l.source);
    const t = nodeId(l.target);
    if (adj.has(s)) adj.get(s)!.push(t);
    if (adj.has(t)) adj.get(t)!.push(s);
  });

  const visited = new Set<string>();
  const components: Component[] = [];

  for (const node of nodes) {
    if (visited.has(node.id)) continue;
    const queue = [node.id];
    const component: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      component.push(current);
      const neighbors = adj.get(current) ?? [];
      for (const n of neighbors) {
        if (!visited.has(n)) queue.push(n);
      }
    }
    components.push({ nodeIds: component, nodeCount: component.length });
  }

  return components.sort((a, b) => b.nodeCount - a.nodeCount);
}

// ── bfsShortestPath ──────────────────────────────────────────────────────────

export function bfsShortestPath(
  startId: string,
  endId: string,
  links: GraphLink[],
): Set<string> {
  if (startId === endId) return new Set([startId]);

  const adj = new Map<string, string[]>();
  links.forEach(l => {
    const s = nodeId(l.source);
    const t = nodeId(l.target);
    if (!adj.has(s)) adj.set(s, []);
    if (!adj.has(t)) adj.set(t, []);
    adj.get(s)!.push(t);
    adj.get(t)!.push(s);
  });

  const visited = new Set<string>();
  const queue: string[] = [startId];
  visited.add(startId);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === endId) {
      visited.add(endId);
      return visited;
    }
    const neighbors = adj.get(current) ?? [];
    for (const n of neighbors) {
      if (!visited.has(n)) {
        visited.add(n);
        queue.push(n);
      }
    }
  }

  return new Set();
}

// ── computeNeighborHops ────────────────────────────────────────────────────────

export function computeNeighborHops(
  seedId: string,
  links: GraphLink[],
  hops: number,
): Set<string> {
  const adj = new Map<string, string[]>();
  links.forEach(l => {
    const s = nodeId(l.source);
    const t = nodeId(l.target);
    if (!adj.has(s)) adj.set(s, []);
    if (!adj.has(t)) adj.set(t, []);
    adj.get(s)!.push(t);
    adj.get(t)!.push(s);
  });

  const visited = new Set<string>([seedId]);
  let frontier = new Set<string>([seedId]);

  for (let i = 0; i < hops; i++) {
    const nextFrontier = new Set<string>();
    for (const current of frontier) {
      const neighbors = adj.get(current) ?? [];
      for (const n of neighbors) {
        if (!visited.has(n)) {
          visited.add(n);
          nextFrontier.add(n);
        }
      }
    }
    frontier = nextFrontier;
    if (frontier.size === 0) break;
  }

  return visited;
}

// ── computeGraphStats ──────────────────────────────────────────────────────────

export interface GraphStats {
  nodeCount: number;
  linkCount: number;
  avgDegree: number;
  maxDegree: number;
  componentCount: number;
  density: number;
}

export function computeGraphStats(
  nodes: GraphNode[],
  links: GraphLink[],
): GraphStats {
  const { degreeMap, avgDegree } = degreeCentrality(nodes, links);
  const components = findConnectedComponents(nodes, links);
  const degrees = Object.values(degreeMap);
  const maxDegree = degrees.length > 0 ? Math.max(...degrees) : 0;
  const n = nodes.length;
  const possibleEdges = n > 1 ? (n * (n - 1)) / 2 : 0;
  const density = possibleEdges > 0 ? links.length / possibleEdges : 0;

  return {
    nodeCount: n,
    linkCount: links.length,
    avgDegree,
    maxDegree,
    componentCount: components.length,
    density,
  };
}
