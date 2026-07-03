/**
 * D3GraphView — Data Layer
 *
 * Extracted from D3GraphView.tsx.
 * Contains data-loading and graph-building functions:
 *   - buildGraphDataFromState: build from store state
 *   - loadDynamicGraphData: load from DuckDB
 *   - collapseCommunityNodes: community folding logic
 */

import { duckDBService } from '../../../services/duckdbService';
import type { GraphNode, GraphLink, GraphData, LifeObjectType, LifeLinkType, LifeLink } from './D3GraphView.types';
import { TYPE_COLORS_WARM, TYPE_COLORS_INSTANCE, LINKTYPE_COLORS } from './D3GraphView.types';
import { detectCommunities } from '../../../services/graphClusteringService';
import { computeInitialPositions } from './D3GraphView.layout';

// ── Property Parsing ────────────────────────────────────────────────────────

export function parseProps(raw: any): { count: number; raw: string } {
  if (!raw) return { count: 0, raw: '' };
  
  let jsonStr = '';
  if (raw instanceof Uint8Array) {
    try { jsonStr = new TextDecoder().decode(raw); } catch { jsonStr = String(raw); }
  } else if (typeof raw === 'object') {
    return { count: Object.keys(raw).length, raw: JSON.stringify(raw, null, 2) };
  } else {
    jsonStr = String(raw);
  }

  try {
    const parsed = JSON.parse(jsonStr);
    return { count: Object.keys(parsed).length, raw: JSON.stringify(parsed, null, 2) };
  } catch {
    return { count: 0, raw: jsonStr };
  }
}

// ── Build from Store State ─────────────────────────────────────────────────

/**
 * Build graph data from store state (avoids DuckDB query lag / empty results after inserts).
 * This is the primary data source after schema import completes.
 */
export function buildGraphDataFromState(state: any, mapping: any, selectedTables?: string[], layoutDims?: { svgW?: number; svgH?: number }): GraphData | null {
  const { objectTypes, objects, linkTypes, links, actions } = state;
  if (!objectTypes || !objects) return null;

  // Filter objects by selected data tables
  const filteredObjects = selectedTables && selectedTables.length > 0
    ? objects.filter((o: any) => {
        const props = typeof o.properties === 'string'
          ? (() => { try { return JSON.parse(o.properties); } catch { return {}; } })()
          : (typeof o.properties === 'object' ? o.properties : {});
        const sourceTable = (props as any)._sourceTable;
        // Nodes without _sourceTable are manually created — always include them
        return sourceTable === undefined || selectedTables.includes(sourceTable);
      })
    : objects;

  const filteredObjectIds = new Set(filteredObjects.map((o: any) => o.id));

  const filteredLinks = links
    ? links.filter((l: any) =>
        filteredObjectIds.has(Number(l.source_object_id)) && filteredObjectIds.has(Number(l.target_object_id))
      )
    : [];

  const typeMap: Record<number, LifeObjectType> = {};
  objectTypes.forEach((t: any) => { typeMap[t.id] = t; });
  const linkTypeMap: Record<number, LifeLinkType> = {};
  linkTypes.forEach((lt: any) => { linkTypeMap[lt.id] = lt; });

  const objectsByType: Record<number, any[]> = {};
  filteredObjects.forEach((o: any) => {
    if (!objectsByType[o.object_type_id]) objectsByType[o.object_type_id] = [];
    objectsByType[o.object_type_id].push(o);
  });

  const nodes: GraphNode[] = [];
  const graphLinks: GraphLink[] = [];

  objectTypes.forEach((type: any) => {
    const instList = objectsByType[type.id] || [];
    const hasInstances = instList.length > 0;
    const color = TYPE_COLORS_WARM[(type.id - 1) % TYPE_COLORS_WARM.length];
    nodes.push({
      id: `type::${type.id}`, label: type.name, group: 'typeHub', color, size: hasInstances ? 28 : 18,
      description: type.description || '', _typeId: type.id, _instanceCount: instList.length,
      _hasInstances: hasInstances,
    });
  });

  filteredObjects.forEach((obj: any) => {
    const type = typeMap[obj.object_type_id];
    const idx = (obj.object_type_id - 1) % TYPE_COLORS_WARM.length;
    const typeColor = type ? TYPE_COLORS_WARM[idx] : '#c77dff';
    const instanceColor = type ? TYPE_COLORS_INSTANCE[idx] : '#a070d0';
    const { count: propCount, raw: propRaw } = parseProps(obj.properties);
    nodes.push({
      id: `obj::${obj.id}`, label: obj.name, group: 'instance', color: instanceColor, size: 11,
      description: propRaw, _objId: obj.id, _typeId: obj.object_type_id,
      _typeColor: typeColor, _instanceColor: instanceColor,
      _propsCount: propCount, _propsRaw: propRaw,
    });

    if (type) {
      graphLinks.push({ source: `obj::${obj.id}`, target: `type::${obj.object_type_id}`, color: typeColor, weight: 0.15, _isTypeInstLink: true });
    }
  });

  filteredLinks.forEach((link: any) => {
    const ltColor = LINKTYPE_COLORS[(link.link_type_id - 1) % LINKTYPE_COLORS.length];
    graphLinks.push({
      source: `obj::${link.source_object_id}`, target: `obj::${link.target_object_id}`,
      color: ltColor, weight: Number(link.weight) || 0.5,
      _linkTypeId: link.link_type_id, _linkTypeName: linkTypeMap[link.link_type_id]?.name,
    });
  });

  (actions || []).forEach((act: any) => {
    if (!filteredObjectIds.has(Number(act.object_id))) return;
    const statusColor = act.status === 'done' ? '#50fa7b' : '#ff5a8a';
    nodes.push({
      id: `action::${act.id}`, label: act.name, group: 'action', color: statusColor, size: 10,
      description: act.description || '', _objId: Number(act.object_id),
    });
    graphLinks.push({ source: `obj::${act.object_id}`, target: `action::${act.id}`, color: '#ff5a8a', weight: 0.2 });
  });

  const typeNames = objectTypes.map((t: any) => t.name);

  const typeHubNodes = nodes.filter(n => n.group === 'typeHub');
  const svgW = layoutDims?.svgW ?? 800;
  const svgH = layoutDims?.svgH ?? 600;
  computeInitialPositions(nodes, typeHubNodes, svgW, svgH, filteredLinks);

  return { nodes, links: graphLinks, typeMap, linkTypeMap, typeNames, _rawLinks: filteredLinks };
}

// ── Load from DuckDB ────────────────────────────────────────────────────────

export async function loadDynamicGraphData(mapping: any, selectedTables?: string[]): Promise<GraphData | null> {
  try {
    const [objectTypes, objects, linkTypes, rawLinks, actions] = await Promise.all([
      duckDBService.query(`SELECT * FROM ${mapping.objectTypeTable} ORDER BY id`),
      duckDBService.query(`SELECT * FROM ${mapping.objectTable} ORDER BY id`),
      duckDBService.query(`SELECT * FROM ${mapping.linkTypeTable} ORDER BY id`),
      duckDBService.query(`SELECT * FROM ${mapping.linkTable} ORDER BY id`),
      duckDBService.query(`SELECT * FROM ${mapping.actionTable} ORDER BY id`),
    ]);

    if (objects.length === 0) {
      return { nodes: [], links: [], typeMap: {}, linkTypeMap: {}, typeNames: [], _rawLinks: rawLinks };
    }

    // Filter objects by selected data tables
    const filteredObjects = selectedTables && selectedTables.length > 0
      ? objects.filter((o: any) => {
          const props = typeof o.properties === 'string'
            ? (() => { try { return JSON.parse(o.properties); } catch { return {}; } })()
            : (typeof o.properties === 'object' ? o.properties : {});
          const sourceTable = (props as any)._sourceTable;
          // Nodes without _sourceTable are manually created — always include them
          return sourceTable === undefined || selectedTables.includes(sourceTable);
        })
      : objects;

    const filteredObjectIds = new Set(filteredObjects.map((o: any) => o.id));

    const filteredLinks = rawLinks.filter((l: any) =>
      filteredObjectIds.has(Number(l.source_object_id)) && filteredObjectIds.has(Number(l.target_object_id))
    );

    const typeMap: Record<number, any> = {};
    objectTypes.forEach((t: any) => { typeMap[t.id] = t; });
    const linkTypeMap: Record<number, any> = {};
    linkTypes.forEach((lt: any) => { linkTypeMap[lt.id] = lt; });

    const objectsByType: Record<number, any[]> = {};
    filteredObjects.forEach((o: any) => {
      if (!objectsByType[o.object_type_id]) objectsByType[o.object_type_id] = [];
      objectsByType[o.object_type_id].push(o);
    });

    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    objectTypes.forEach((type: any) => {
      const instList = objectsByType[type.id] || [];
      const hasInstances = instList.length > 0;
      const color = TYPE_COLORS_WARM[(type.id - 1) % TYPE_COLORS_WARM.length];
      nodes.push({
        id: `type::${type.id}`, label: type.name, group: 'typeHub', color, size: hasInstances ? 28 : 18,
        description: type.description || '', _typeId: type.id, _instanceCount: instList.length,
        _hasInstances: hasInstances,
      });
    });

    filteredObjects.forEach((obj: any) => {
      const type = typeMap[obj.object_type_id];
      const idx = (obj.object_type_id - 1) % TYPE_COLORS_WARM.length;
      const typeColor = type ? TYPE_COLORS_WARM[idx] : '#c77dff';
      const instanceColor = type ? TYPE_COLORS_INSTANCE[idx] : '#a070d0';
      const { count: propCount, raw: propRaw } = parseProps(obj.properties);
      nodes.push({
        id: `obj::${obj.id}`, label: obj.name, group: 'instance', color: instanceColor, size: 11,
        description: propRaw, _objId: obj.id, _typeId: obj.object_type_id,
        _typeColor: typeColor, _instanceColor: instanceColor,
        _propsCount: propCount, _propsRaw: propRaw,
      });

      if (type) {
        links.push({ source: `obj::${obj.id}`, target: `type::${obj.object_type_id}`, color: typeColor, weight: 0.15, _isTypeInstLink: true });
      }
    });

    filteredLinks.forEach((link: any) => {
      const ltColor = LINKTYPE_COLORS[(link.link_type_id - 1) % LINKTYPE_COLORS.length];
      links.push({
        source: `obj::${link.source_object_id}`, target: `obj::${link.target_object_id}`,
        color: ltColor, weight: Number(link.weight) || 0.5,
        _linkTypeId: link.link_type_id, _linkTypeName: linkTypeMap[link.link_type_id]?.name,
      });
    });

    actions.forEach((act: any) => {
      if (!filteredObjectIds.has(Number(act.object_id))) return;
      const statusColor = act.status === 'done' ? '#50fa7b' : '#ff5a8a';
      nodes.push({
        id: `action::${act.id}`, label: act.name, group: 'action', color: statusColor, size: 10,
        description: act.description || '', _objId: Number(act.object_id),
      });
      links.push({ source: `obj::${act.object_id}`, target: `action::${act.id}`, color: '#ff5a8a', weight: 0.2 });
    });

    const typeNames = objectTypes.map((t: any) => t.name);

    const typeHubNodes = nodes.filter(n => n.group === 'typeHub');
    computeInitialPositions(nodes, typeHubNodes, 800, 600, filteredLinks);

    return { nodes, links, typeMap, linkTypeMap, typeNames, _rawLinks: filteredLinks };
  } catch (err) {
    console.error('[D3GraphView] Dynamic load failed:', err);
    return null;
  }
}

// ── Community Collapse ──────────────────────────────────────────────────────

export interface CollapsedGraph {
  nodes: GraphNode[];
  links: GraphLink[];
  repMap: Map<string, string>;
  hiddenNodeIds: Set<string>;
}

export function collapseCommunityNodes(
  nodes: GraphNode[],
  links: GraphLink[],
  expandedCommunityIds: Set<string>
): CollapsedGraph {
  const instNodes = nodes.filter(n => n.group === 'instance');
  const instLinks = links.filter(l => {
    const s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
    const t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
    const sNode = nodes.find(n => n.id === s);
    const tNode = nodes.find(n => n.id === t);
    return sNode?.group === 'instance' && tNode?.group === 'instance';
  });

  const clusters = detectCommunities(instNodes, instLinks);

  const repMap = new Map<string, string>();
  const hiddenNodeIds = new Set<string>();
  const superLabels = new Map<string, string>();

  clusters.forEach((cluster) => {
    if (cluster.nodeIds.length < 3) return;

    let repId = cluster.nodeIds[0];
    let maxDeg = -1;
    cluster.nodeIds.forEach(id => {
      const node = nodes.find(n => n.id === id);
      const deg = node ? ((node as any)._degree || 0) : 0;
      if (deg > maxDeg) { maxDeg = deg; repId = id; }
    });

    cluster.nodeIds.forEach(id => {
      const node = nodes.find(n => n.id === id);
      if (node) { (node as any)._communityId = cluster.id; }
    });

    if (expandedCommunityIds.has(String(cluster.id))) {
      const repNode = nodes.find(n => n.id === repId);
      if (repNode) { superLabels.set(repId, `${repNode.label} (社区已展开)`); }
      return;
    }

    cluster.nodeIds.forEach(id => {
      if (id !== repId) { repMap.set(id, repId); hiddenNodeIds.add(id); }
    });

    const repNode = nodes.find(n => n.id === repId);
    if (repNode) { superLabels.set(repId, `${repNode.label} (+${cluster.nodeIds.length - 1} 社区)`); }
  });

  const collapsedNodes = nodes
    .filter(n => !hiddenNodeIds.has(n.id))
    .map(n => {
      if (superLabels.has(n.id)) {
        return { ...n, label: superLabels.get(n.id)!, size: n.size * 1.5 };
      }
      return n;
    });

  const linkKeyMap = new Map<string, GraphLink>();
  links.forEach(l => {
    let s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
    let t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;

    if (repMap.has(s)) s = repMap.get(s)!;
    if (repMap.has(t)) t = repMap.get(t)!;

    if (s === t) return;

    const key = s < t ? `${s}->${t}` : `${t}->${s}`;
    const existing = linkKeyMap.get(key);
    const relName = l._linkTypeName || '关联';
    if (existing) {
      existing.weight = (existing.weight || 1) + (l.weight || 1);
      (existing as any)._count = ((existing as any)._count || 1) + 1;
      if (!(existing as any)._relations) { (existing as any)._relations = []; }
      if (!(existing as any)._relations.includes(relName)) { (existing as any)._relations.push(relName); }
    } else {
      linkKeyMap.set(key, {
        ...l, source: s, target: t,
        weight: l.weight || 1,
        _count: 1,
        _relations: [relName]
      });
    }
  });

  const collapsedLinks = Array.from(linkKeyMap.values());
  return { nodes: collapsedNodes, links: collapsedLinks, repMap, hiddenNodeIds };
}

// ── Edge Aggregation ─────────────────────────────────────────────────────

export interface AggregatedEdge {
  link: GraphLink;
  sourceId: string;
  targetId: string;
}

export function aggregateParallelEdges(
  links: GraphLink[],
  nodeMap: Map<string, GraphNode>,
  getSourceNode: (l: GraphLink) => GraphNode | undefined,
  getTargetNode: (l: GraphLink) => GraphNode | undefined
): { aggregatedLinks: GraphLink[]; bidirKeys: Set<string>; mergedLinks: GraphLink[] } {
  // Detect true bidirectional edges. Multiple A->B relations are parallel,
  // not bidirectional, and must stay separate so LinkType semantics remain visible.
  const directionMap = new Map<string, Set<string>>();
  links.forEach((l) => {
    const s = getSourceNode(l)?.id || '';
    const t = getTargetNode(l)?.id || '';
    if (!s || !t) return;
    const key = s < t ? `${s}||${t}` : `${t}||${s}`;
    if (!directionMap.has(key)) directionMap.set(key, new Set());
    directionMap.get(key)!.add(`${s}->${t}`);
  });

  const mergedLinks: GraphLink[] = [];
  const bidirKeys = new Set<string>();
  directionMap.forEach((directions, key) => { if (directions.size > 1) bidirKeys.add(key); });

  const processed = new Set<number>();
  links.forEach((l, idx) => {
    if (processed.has(idx)) return;
    const s = getSourceNode(l)?.id || '';
    const t = getTargetNode(l)?.id || '';
    if (!s || !t) { mergedLinks.push({ ...l }); return; }
    const key = s < t ? `${s}||${t}` : `${t}||${s}`;
    if (bidirKeys.has(key)) {
      mergedLinks.push({ ...l, _bidirectional: true, _mergedIndices: [idx] });
      processed.add(idx);
    } else {
      mergedLinks.push({ ...l });
      processed.add(idx);
    }
  });

  // Edge aggregation: merge same-source-same-target-instance-instance links
  const edgeKeyMap = new Map<string, GraphLink>();
  mergedLinks.forEach(l => {
    const src = getSourceNode(l)?.id || '';
    const tgt = getTargetNode(l)?.id || '';
    if (!src || !tgt) return;
    const srcNode = nodeMap.get(src), tgtNode = nodeMap.get(tgt);
    if (srcNode?.group === 'typeHub' || tgtNode?.group === 'typeHub') {
      edgeKeyMap.set(`${src}||${tgt}`, l);
      return;
    }
    const key = `${src}||${tgt}||${l._linkTypeId || 0}`;
    const existing = edgeKeyMap.get(key);
    if (existing) {
      (existing as any)._edgeCount = ((existing as any)._edgeCount || 1) + 1;
      (existing as any)._edgeWeight = ((existing as any)._edgeWeight || 0) + (Number(l.weight) || 0.5);
    } else {
      edgeKeyMap.set(key, { ...l, _edgeCount: 1, _edgeWeight: Number(l.weight) || 0.5 });
    }
  });

  const aggregatedLinks = Array.from(edgeKeyMap.values());
  return { aggregatedLinks, bidirKeys, mergedLinks };
}

export function computeEdgeGroupOffsets(aggregatedLinks: GraphLink[], getSourceNode: (l: GraphLink) => GraphNode | undefined, getTargetNode: (l: GraphLink) => GraphNode | undefined): Map<string, number> {
  const edgeGroupOffsets = new Map<string, number>();
  const pairEdges = new Map<string, GraphLink[]>();
  aggregatedLinks.forEach(l => {
    const sId = getSourceNode(l)?.id || '';
    const tId = getTargetNode(l)?.id || '';
    const key = `${sId}|${tId}`;
    if (!pairEdges.has(key)) pairEdges.set(key, []);
    pairEdges.get(key)!.push(l);
  });
  const MAX_OFFSET = 50;
  pairEdges.forEach((edges, key) => {
    if (edges.length === 1) { edgeGroupOffsets.set(key, 0); return; }
    // Stable sort: order by linkTypeId then weight so offsets are deterministic
    edges.sort((a, b) => {
      const aT = a._linkTypeId ?? 0;
      const bT = b._linkTypeId ?? 0;
      if (aT !== bT) return aT - bT;
      return (a.weight ?? 0.5) - (b.weight ?? 0.5);
    });
    const step = (MAX_OFFSET * 2) / Math.max(edges.length - 1, 1);
    edges.forEach((edge, idx) => {
      const offset = -MAX_OFFSET + idx * step;
      edgeGroupOffsets.set(key, offset);
      (edge as any)._groupOffset = offset;
    });
  });
  return edgeGroupOffsets;
}
