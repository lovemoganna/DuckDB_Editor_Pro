/**
 * D3GraphView.focus — Focus mode / scope / readable subgraph helpers.
 *
 * Extracted from D3GraphView.tsx so the main component stays focused on
 * rendering and D3 force-simulation concerns.
 *
 * All helpers are pure functions over `GraphData` and an optional focus node.
 */

import type { GraphData, GraphNode } from './D3GraphView.types';

export type ScopeMode = 'focus' | 'two-hop' | 'all';

export const getLinkNodeId = (endpoint: string | GraphNode): string =>
  typeof endpoint === 'object' ? endpoint.id : String(endpoint);

/**
 * Build a degree map (weighted) for instance/action nodes.
 * Type-instance links are excluded to avoid biasing the metric.
 */
export function getNodeDegreeMap(data: GraphData): Record<string, number> {
  const degree: Record<string, number> = {};
  data.nodes.forEach(n => { degree[n.id] = 0; });
  data.links.forEach(link => {
    if (link._isTypeInstLink) return;
    const source = getLinkNodeId(link.source);
    const target = getLinkNodeId(link.target);
    if (degree[source] !== undefined) degree[source] += Math.max(0.25, Number(link.weight) || 0.5);
    if (degree[target] !== undefined) degree[target] += Math.max(0.25, Number(link.weight) || 0.5);
  });
  return degree;
}

/**
 * Pick the default focus node — the instance node with the highest weighted degree.
 */
export function pickDefaultFocusNode(data: GraphData): string | null {
  const degree = getNodeDegreeMap(data);
  const candidates = data.nodes.filter(n => n.group === 'instance');
  const best = candidates.sort((a, b) => (degree[b.id] || 0) - (degree[a.id] || 0))[0];
  return best?.id || candidates[0]?.id || null;
}

/**
 * Build a "readable" subgraph view:
 *  - scopeMode='all'        → return everything, with weak-link and relation-type filters
 *  - scopeMode='focus'      → focus node + first-hop neighbors
 *  - scopeMode='two-hop'    → focus node + first-hop + second-hop
 *
 * Each returned node carries `_focusLevel`:
 *  - 0 = focused node
 *  - 1 = first-hop
 *  - 2 = second-hop
 *  - 3 = hidden / background
 */
export function buildReadableSubgraph(
  data: GraphData,
  focusNodeId: string | null,
  scopeMode: ScopeMode,
  weightThreshold: number,
  showWeakLinks: boolean,
  activeRelationTypes: Set<number>,
): GraphData {
  if (scopeMode === 'all' || !focusNodeId) {
    const visibleLinks = data.links.filter(link => {
      if (link._linkTypeId !== undefined) {
        if (!showWeakLinks && link.weight < weightThreshold) return false;
        if (activeRelationTypes.size > 0 && !activeRelationTypes.has(link._linkTypeId)) return false;
      }
      return true;
    });
    const linkedNodeIds = new Set<string>();
    visibleLinks.forEach(link => {
      linkedNodeIds.add(getLinkNodeId(link.source));
      linkedNodeIds.add(getLinkNodeId(link.target));
    });
    return {
      ...data,
      nodes: data.nodes
        .filter(n => linkedNodeIds.has(n.id) || n.group === 'typeHub')
        .map(n => ({ ...n, _focusLevel: n.id === focusNodeId ? 0 : 1 })),
      links: visibleLinks,
    };
  }

  const semanticLinks = data.links.filter(link => {
    if (link._linkTypeId === undefined) return false;
    if (!showWeakLinks && link.weight < weightThreshold) return false;
    if (activeRelationTypes.size > 0 && !activeRelationTypes.has(link._linkTypeId)) return false;
    return true;
  });

  const visibleNodeIds = new Set<string>([focusNodeId]);
  const firstHop = new Set<string>();
  const secondHop = new Set<string>();

  semanticLinks.forEach(link => {
    const source = getLinkNodeId(link.source);
    const target = getLinkNodeId(link.target);
    if (source === focusNodeId) firstHop.add(target);
    if (target === focusNodeId) firstHop.add(source);
  });
  firstHop.forEach(id => visibleNodeIds.add(id));

  if (scopeMode === 'two-hop') {
    semanticLinks.forEach(link => {
      const source = getLinkNodeId(link.source);
      const target = getLinkNodeId(link.target);
      if (firstHop.has(source)) visibleNodeIds.add(target);
      if (firstHop.has(target)) visibleNodeIds.add(source);
      if (firstHop.has(source) && target !== focusNodeId) secondHop.add(target);
      if (firstHop.has(target) && source !== focusNodeId) secondHop.add(source);
    });
  }

  const focusLinks = data.links.filter(link => {
    const source = getLinkNodeId(link.source);
    const target = getLinkNodeId(link.target);
    if (link._linkTypeId !== undefined) {
      return visibleNodeIds.has(source) && visibleNodeIds.has(target);
    }
    if (link._isTypeInstLink) {
      return visibleNodeIds.has(source) || visibleNodeIds.has(target);
    }
    return visibleNodeIds.has(source) && visibleNodeIds.has(target);
  });

  focusLinks.forEach(link => {
    visibleNodeIds.add(getLinkNodeId(link.source));
    visibleNodeIds.add(getLinkNodeId(link.target));
  });

  return {
    ...data,
    nodes: data.nodes
      .filter(node => visibleNodeIds.has(node.id))
      .map(node => ({
        ...node,
        _focusLevel: node.id === focusNodeId ? 0 : firstHop.has(node.id) ? 1 : secondHop.has(node.id) ? 2 : 3,
      })),
    links: focusLinks,
  };
}