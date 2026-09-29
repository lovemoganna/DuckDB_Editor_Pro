/**
 * D3GraphView.focus — Focus mode / scope / readable subgraph helpers.
 *
 * Extracted from D3GraphView.tsx so the main component stays focused on
 * rendering and D3 force-simulation concerns.
 *
 * All helpers are pure functions over `GraphData` and an optional focus node.
 */

import type { GraphData, GraphNode } from './D3GraphView.types';

export type ScopeMode = '1-hop' | '2-hop' | '3-hop' | 'all' | 'focus' | 'two-hop' | 'detail';

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
    if (link._isTypeInstLink || link._isPropLink) return;
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
 *  - scopeMode='1-hop' | 'focus'     → 1 hop (Level 1 TypeHub in overview; 1-hop neighbors if focused)
 *  - scopeMode='2-hop' | 'two-hop'   → 2 hops (Level 1 + Level 2 in overview; 2-hop neighbors if focused) [DEFAULT]
 *  - scopeMode='3-hop'               → 3 hops (Level 1 + Level 2 + Level 3 in overview; 3-hop neighbors if focused)
 *  - scopeMode='all'                 → return everything, with weak-link and relation-type filters
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
  collapsedNodes: Set<string> = new Set()
): GraphData {
  // Compute hidden nodes due to collapse/folding
  const hiddenNodeIds = new Set<string>();
  const collapsedList = Array.from(collapsedNodes);
  if (collapsedList.length > 0) {
    const queue = [...collapsedList];
    const visited = new Set<string>(collapsedList);
    while (queue.length > 0) {
      const parentId = queue.shift()!;
      data.links.forEach(link => {
        const source = getLinkNodeId(link.source);
        const target = getLinkNodeId(link.target);
        
        // 1. TypeHub -> Instance (source is obj/instance, target is typeHub)
        if (target === parentId && link._isTypeInstLink) {
          if (!visited.has(source)) {
            hiddenNodeIds.add(source);
            visited.add(source);
            queue.push(source);
          }
        }
        // 2. Instance -> Action (source is obj/instance, target is action)
        if (source === parentId && target.startsWith('action::')) {
          if (!visited.has(target)) {
            hiddenNodeIds.add(target);
            visited.add(target);
            queue.push(target);
          }
        }
        // 3. Instance -> Property (source is obj/instance, target is prop)
        if (source === parentId && target.startsWith('prop::')) {
          if (!visited.has(target)) {
            hiddenNodeIds.add(target);
            visited.add(target);
            queue.push(target);
          }
        }
      });
    }
  }

  // Pre-filter original data by removing hidden collapsed nodes
  const filteredData = {
    ...data,
    nodes: data.nodes.filter(n => !hiddenNodeIds.has(n.id)),
    links: data.links.filter(l => {
      const s = getLinkNodeId(l.source);
      const t = getLinkNodeId(l.target);
      return !hiddenNodeIds.has(s) && !hiddenNodeIds.has(t);
    })
  };

  // ── Global Overview Mode (No specific node focused) ────────────────────────
  if (!focusNodeId || hiddenNodeIds.has(focusNodeId)) {
    let allowedNodes = filteredData.nodes;

    if (scopeMode === '1-hop' || scopeMode === 'focus') {
      // 1跳：仅展示一级领域实体类型 (TypeHub)
      allowedNodes = filteredData.nodes.filter(n => n.group === 'typeHub');
    } else if (scopeMode === '2-hop' || scopeMode === 'two-hop') {
      // 2跳 (默认)：展示一级领域实体类型 + 二级业务数据实例
      allowedNodes = filteredData.nodes.filter(n => n.group === 'typeHub' || n.group === 'instance');
    } else if (scopeMode === '3-hop') {
      // 3跳：展示一级类型 + 二级实例 + 三级属性与行为
      allowedNodes = filteredData.nodes.filter(n => 
        n.group === 'typeHub' || n.group === 'instance' || n.group === 'property' || n.group === 'action'
      );
    }
    // scopeMode === 'all': keep all allowedNodes

    const allowedNodeIdSet = new Set(allowedNodes.map(n => n.id));

    const visibleLinks = filteredData.links.filter(link => {
      const s = getLinkNodeId(link.source);
      const t = getLinkNodeId(link.target);
      if (!allowedNodeIdSet.has(s) || !allowedNodeIdSet.has(t)) return false;

      // Weak link and relation filtering only applies to semantic relations with _linkTypeId
      if (link._linkTypeId !== undefined) {
        if (!showWeakLinks && link.weight < weightThreshold) return false;
        if (activeRelationTypes.size > 0 && !activeRelationTypes.has(link._linkTypeId)) return false;
      }
      return true;
    });

    return {
      ...filteredData,
      nodes: allowedNodes.map(n => ({
        ...n,
        _focusLevel: n.group === 'typeHub' ? 0 : n.group === 'instance' ? 1 : 2,
      })),
      links: visibleLinks,
    };
  }

  // ── Focused Node Neighborhood Mode (BFS Traversal from Focus Node) ──────────
  const maxHops =
    scopeMode === '1-hop' || scopeMode === 'focus' ? 1 :
    scopeMode === '2-hop' || scopeMode === 'two-hop' ? 2 :
    scopeMode === '3-hop' ? 3 :
    scopeMode === 'detail' ? 0 : 999; // 'all' allows unlimited traversal

  if (maxHops >= 999) {
    const visibleLinks = filteredData.links.filter(link => {
      if (link._linkTypeId !== undefined) {
        if (!showWeakLinks && link.weight < weightThreshold) return false;
        if (activeRelationTypes.size > 0 && !activeRelationTypes.has(link._linkTypeId)) return false;
      }
      return true;
    });
    return {
      ...filteredData,
      nodes: filteredData.nodes.map(n => ({
        ...n,
        _focusLevel: n.id === focusNodeId ? 0 : n.group === 'typeHub' ? 1 : 2,
      })),
      links: visibleLinks,
    };
  }

  // Build bidirectional adjacency list for BFS
  const adj = new Map<string, Set<string>>();
  filteredData.nodes.forEach(n => adj.set(n.id, new Set()));

  filteredData.links.forEach(link => {
    // Only traverse valid links
    if (link._linkTypeId !== undefined) {
      if (!showWeakLinks && link.weight < weightThreshold) return;
      if (activeRelationTypes.size > 0 && !activeRelationTypes.has(link._linkTypeId)) return;
    }
    const s = getLinkNodeId(link.source);
    const t = getLinkNodeId(link.target);
    if (adj.has(s) && adj.has(t)) {
      adj.get(s)!.add(t);
      adj.get(t)!.add(s);
    }
  });

  // BFS to calculate hop distance from focusNodeId
  const distances = new Map<string, number>();
  distances.set(focusNodeId, 0);
  const queue: string[] = [focusNodeId];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const currDist = distances.get(curr)!;
    if (currDist >= maxHops) continue;

    const neighbors = adj.get(curr) || new Set();
    neighbors.forEach(nextId => {
      if (!distances.has(nextId)) {
        distances.set(nextId, currDist + 1);
        queue.push(nextId);
      }
    });
  }

  const visibleNodeIds = new Set(distances.keys());

  const focusLinks = filteredData.links.filter(link => {
    const s = getLinkNodeId(link.source);
    const t = getLinkNodeId(link.target);
    return visibleNodeIds.has(s) && visibleNodeIds.has(t);
  });

  return {
    ...filteredData,
    nodes: filteredData.nodes
      .filter(node => visibleNodeIds.has(node.id))
      .map(node => ({
        ...node,
        _focusLevel: distances.get(node.id) ?? 3,
      })),
    links: focusLinks,
  };
}

