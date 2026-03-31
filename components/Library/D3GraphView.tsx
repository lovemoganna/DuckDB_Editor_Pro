/**
 * D3GraphView — Optimized Knowledge Graph Visualization
 *
 * Visual Optimizations Applied:
 * 1. Node hierarchy: TypeHub (warm, r=28) >> Instance (cool, r=11) >> Action (r=6)
 *    Size ratio 2.5x between parent and child nodes
 * 2. Color differentiation: warm palette for TypeHub, cool palette for Instance
 * 3. Link visibility: bright amber lines (≥65% lightness, ≥85% opacity)
 *    Per-level thickness: type-instance=1.5px, instance-instance=2.5px, action=1px
 * 4. Semantic icons: hexagon for TypeHub (type system), box for Instance (data entity)
 * 5. Interactions: scale+glow on hover, pulse on selected, color shift on highlight
 * 6. Labels: truncated at 14 chars + full-label tooltip
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { RefreshCw } from 'lucide-react';
import { duckDBService } from '../../services/duckdbService';
import { encodeCSV, downloadExcel } from '../../utils/exportUtils';

// ==================== Types ====================

interface LifeObjectType { id: number; name: string; description: string }
interface LifeObject { id: number; object_type_id: number; name: string; properties: string }
interface LifeLinkType { id: number; name: string; description: string }
interface LifeLink { id: number; link_type_id: number; source_object_id: number; target_object_id: number; weight: number }
interface LifeAction { id: number; object_id: number; name: string; description: string; status: string; execute_at: string }

interface GraphNode {
  id: string; label: string; group: string; color: string;
  size: number; description: string; x?: number; y?: number;
  fx?: number | null; fy?: number | null;
  _typeId?: number; _objId?: number;
  _propsCount?: number;   // number of key-value pairs in properties
  _propsRaw?: string;     // raw properties string for display
  _instanceCount?: number; // count of instances belonging to this typeHub
}

interface GraphLink {
  source: string | GraphNode; target: string | GraphNode;
  color: string; weight: number;
  _linkTypeId?: number; _linkTypeName?: string;
}

// D3 graph data (shared between D3 and React state)
interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  typeMap: Record<number, LifeObjectType>;
  linkTypeMap: Record<number, LifeLinkType>;
  typeNames: string[];  // ordered type names for legend
}

// ==================== SVG Icon Paths (Line-style, consistent) ====================

/** Hexagon — semantically represents a TYPE / CATEGORY node */
const ICON_HEXAGON = `M 8.66,-5 L 0,-10 L -8.66,-5 L -8.66,5 L 0,10 L 8.66,5 Z`;

/** Box — represents a concrete DATA ENTITY / INSTANCE */
const ICON_BOX = `M -7,-4 L 0,-8 L 7,-4 L 7,4 L 0,8 L -7,4 Z`;

/** Lightning bolt — represents an ACTION node */
const ICON_BOLT = `M 2,-9 L -5,1 L -1,1 L -2,9 L 5,-1 L 1,-1 Z`;

/** Type palette: WARM colors for TypeHub (parent), COOL colors for Instance (child) */
const TYPE_COLORS_WARM = [
  '#FF6B35', '#F7C59F', '#E63946', '#F4A261', '#D62828',
  '#FF9F1C', '#E76F51', '#BC4749', '#A8DADC',
];
const TYPE_COLORS_COOL = [
  '#4CC9F0', '#4361EE', '#3A86FF', '#06D6A0', '#00B4D8',
  '#48CAE4', '#90E0EF', '#0096C7', '#023E8A',
];

/** Legacy fallback */
const TYPE_COLORS = TYPE_COLORS_WARM;

// ==================== Data Loading ====================

async function loadOntologyGraphData(): Promise<GraphData | null> {
  try {
    // Check if ontology tables exist first
    const tables = await duckDBService.getTables();
    if (!tables.includes('life_object')) return null;

    const [objectTypes, objects, linkTypes, rawLinks, actions] = await Promise.all([
      duckDBService.getOntologyObjectTypes() as Promise<LifeObjectType[]>,
      duckDBService.getOntologyObjects() as Promise<LifeObject[]>,
      duckDBService.getOntologyLinkTypes() as Promise<LifeLinkType[]>,
      duckDBService.getOntologyLinks() as Promise<LifeLink[]>,
      duckDBService.getOntologyActions() as Promise<LifeAction[]>,
    ]);

    if (objects.length === 0) return null;

    const typeMap: Record<number, LifeObjectType> = {};
    objectTypes.forEach(t => { typeMap[t.id] = t; });
    const linkTypeMap: Record<number, LifeLinkType> = {};
    linkTypes.forEach(lt => { linkTypeMap[lt.id] = lt; });

    // Parse properties JSON for a life_object record
    const parseProps = (raw: string): { count: number; raw: string } => {
      if (!raw) return { count: 0, raw: '' };
      try {
        const parsed = JSON.parse(raw);
        const keys = Object.keys(parsed);
        return { count: keys.length, raw: JSON.stringify(parsed, null, 2) };
      } catch {
        return { count: 0, raw: raw };
      }
    };

    // Pre-compute instance count per type (needed for TypeHub node creation)
    const objectsByType: Record<number, LifeObject[]> = {};
    objects.forEach(o => {
      if (!objectsByType[o.object_type_id]) objectsByType[o.object_type_id] = [];
      objectsByType[o.object_type_id].push(o);
    });

    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    // === TYPE HUB nodes (warm palette, large radius = parent dominance) ===
    // Only include types that have at least one instance — no floating orphan hubs
    objectTypes.forEach((type) => {
      const instList = objectsByType[type.id] || [];
      if (instList.length === 0) return; // skip orphan types
      // Use type.id (1-based) for color index so it stays consistent with MECE panel
      const color = TYPE_COLORS_WARM[(type.id - 1) % TYPE_COLORS_WARM.length];
      nodes.push({
        id: `type::${type.id}`,
        label: type.name,
        group: 'typeHub',
        color,
        size: 28, // 2.5x instance (11) — clearly dominant parent
        description: type.description || '',
        _typeId: type.id,
        _instanceCount: instList.length,
      });
    });

    // === INSTANCE nodes (cool palette, smaller radius = child) ===
    objects.forEach((obj) => {
      const type = typeMap[obj.object_type_id];
      const color = type ? TYPE_COLORS_COOL[(obj.object_type_id - 1) % TYPE_COLORS_COOL.length] : '#888';
      const { count: propCount, raw: propRaw } = parseProps(obj.properties || '');
      nodes.push({
        id: `obj::${obj.id}`,
        label: obj.name,
        group: 'instance',
        color,
        size: 11, // 2.5x smaller than TypeHub
        description: obj.properties || '',
        _objId: obj.id,
        _propsCount: propCount,
        _propsRaw: propRaw,
      });

      // Instance → TypeHub connection (brighter gray than before)
      if (type) {
        links.push({
          source: `obj::${obj.id}`,
          target: `type::${obj.object_type_id}`,
          color: 'rgba(255,255,255,0.45)',
          weight: 0.15,
        });
      }
    });

    // === LINK TYPE nodes (only if actually used in rawLinks) ===
    const usedLinkTypeIds = new Set(rawLinks.map(l => l.link_type_id));
    linkTypes.forEach(lt => {
      if (!usedLinkTypeIds.has(lt.id)) return; // skip orphan link types
      nodes.push({
        id: `linktype::${lt.id}`,
        label: lt.name,
        group: 'linkType',
        color: '#FFD166', // amber, matching instance-instance links
        size: 7,
        description: lt.description || '',
      });
    });

    // === LINKS between instances (bright amber — high visibility on dark bg) ===
    rawLinks.forEach(link => {
      links.push({
        source: `obj::${link.source_object_id}`,
        target: `obj::${link.target_object_id}`,
        color: '#FFD166', // bright amber, lightness ~70%
        weight: link.weight || 0.5,
        _linkTypeId: link.link_type_id,
        _linkTypeName: linkTypeMap[link.link_type_id]?.name,
      });
    });

    // === ACTION nodes (small circles, attached to their parent instance) ===
    actions.forEach(act => {
      const statusColor = act.status === 'done' ? '#4CAF50' : '#FF9800';
      nodes.push({
        id: `action::${act.id}`,
        label: act.name,
        group: 'action',
        color: statusColor,
        size: 6,
        description: act.description || '',
      });
      links.push({
        source: `obj::${act.object_id}`,
        target: `action::${act.id}`,
        color: '#FF9CF7', // bright lavender, lightness ~80%
        weight: 0.2,
      });
    });

    const typeNames = objectTypes.map(t => t.name);
    return { nodes, links, typeMap, linkTypeMap, typeNames };
  } catch {
    return null;
  }
}

// ==================== Component ====================

const D3GraphView: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const collapsedRef = useRef<Set<string>>(new Set());
  const searchHighlightedRef = useRef<string[]>([]);
  const graphDataRef = useRef<GraphData | null>(null);

  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [d3Ready, setD3Ready] = useState(false);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [infoContent, setInfoContent] = useState('');
  const [searchIndex, setSearchIndex] = useState(-1);
  const [showControls, setShowControls] = useState(true);
  const [showInfo, setShowInfo] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [showScanModal, setShowScanModal] = useState(false);

  const refreshGraph = useCallback(async () => {
    setLoading(true);
    setD3Ready(false);
    const data = await loadOntologyGraphData();
    setGraphData(data);
    graphDataRef.current = data;
    setLoading(false);
  }, []);

  // Load data on mount
  useEffect(() => {
    refreshGraph();
  }, [refreshGraph]);

  // ==================== D3 Rendering ====================
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const W = container.clientWidth;
    const H = container.clientHeight;
    const svg = d3.select(svgRef.current).attr('width', W).attr('height', H);

    svg.selectAll('*').remove();

    // Scoped CSS
    const styleId = 'nv-styles-' + Date.now();
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = `
      .nv-link-instance { stroke: #FFD166 !important; stroke-width: 2.5px !important; opacity: 0.88 !important; fill: none !important; }
      .nv-link-typeinst  { stroke: rgba(255,255,255,0.45) !important; stroke-width: 1.5px !important; opacity: 0.7 !important; fill: none !important; stroke-dasharray: 5 3; }
      .nv-link-action    { stroke: #FF9CF7 !important; stroke-width: 1px !important; opacity: 0.75 !important; fill: none !important; }
      .nv-node { cursor: move; }
      .nv-node:hover { filter: drop-shadow(0 0 10px currentColor); }
      .nv-typehub:hover { filter: drop-shadow(0 0 16px #FF9F1C) !important; }
      .nv-instance:hover { filter: drop-shadow(0 0 10px #4CC9F0) !important; }
      .nv-node-label {
        font-size: 10px; font-weight: bold; fill: white;
        text-anchor: start; pointer-events: none;
        text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 0 3px rgba(0,0,0,0.9);
        stroke: #000; stroke-width: 0.5px; paint-order: stroke fill;
      }
      .nv-typehub-label { font-size: 12px !important; font-weight: 800 !important; }
      .nv-linktype-label {
        font-size: 8px !important; fill: #FFD166 !important; font-style: italic;
        text-anchor: middle; pointer-events: none;
        text-shadow: 0 0 3px #000, -1px -1px 0 #000;
      }
      .nv-highlight-node { filter: drop-shadow(0 0 16px #FFD166) !important; }
      .nv-dim { opacity: 0.12 !important; }
      .nv-dim-label { opacity: 0.1 !important; }
      .nv-label-selected { fill: #FFD166 !important; font-size: 14px !important; font-weight: bold !important; }
      .nv-label-match { fill: #4CC9F0 !important; }
      .nv-hidden { display: none !important; }
      .nv-svg { overflow: visible; }
      .nv-selected-pulse { animation: nv-pulse-ring 1.5s ease-out infinite; }
      @keyframes nv-pulse-ring {
        0%   { filter: drop-shadow(0 0 6px #FFD166); }
        50%  { filter: drop-shadow(0 0 18px #FFD166); }
        100% { filter: drop-shadow(0 0 6px #FFD166); }
      }
      .nv-icon-typehub { fill: rgba(255,255,255,0.22); stroke: rgba(255,255,255,0.6); stroke-width: 1px; pointer-events: none; }
      .nv-icon-instance { fill: none; stroke: rgba(255,255,255,0.5); stroke-width: 1px; pointer-events: none; }
      .nv-icon-action   { fill: rgba(255,255,255,0.3); stroke: rgba(255,255,255,0.7); stroke-width: 0.8px; pointer-events: none; }
    `;
    document.head.appendChild(styleEl);

    const g = svg.append('g').attr('class', 'nv-graph');

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 20])
      .on('zoom', e => { g.attr('transform', e.transform); });
    svg.call(zoom).on('dblclick.zoom', null);
    zoomRef.current = zoom;
    svg.attr('style', 'display:block;cursor:grab;');
    svg.on('wheel', (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
    }, { passive: false });

    // Fit All
    (window as any).__d3FitAll = () => {
      const ns = graphDataRef.current?.nodes || [];
      if (ns.length === 0) return;
      const xs = ns.map(n => n.x || 0);
      const ys = ns.map(n => n.y || 0);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const bw = maxX - minX || 1, bh = maxY - minY || 1;
      const scale = Math.min(0.85 * W / bw, 0.85 * H / bh, 4);
      const tx = W / 2 - (minX + maxX) / 2 * scale;
      const ty = H / 2 - (minY + maxY) / 2 * scale;
      svg.transition().duration(600)
        .call(zoom.transform as any, d3.zoomIdentity.translate(tx, ty).scale(scale));
    };

    if (!graphDataRef.current || graphDataRef.current.nodes.length === 0) {
      setD3Ready(true);
      setTimeout(() => (window as any).__d3FitAll?.(), 200);
      return () => {
        const el = document.getElementById(styleId);
        if (el) el.remove();
        delete (window as any).__d3FitAll;
      };
    }

    const data = graphDataRef.current;
    const nodes = data.nodes;
    const links = data.links;

    // Force Simulation
    const sim = d3.forceSimulation<GraphNode, GraphLink>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(links).id(d => d.id).distance(d => {
        const s = d as any;
        if (s._linkTypeId !== undefined) return 120;
        if (s.source?.group === 'typeHub' || s.target?.group === 'typeHub') return 180;
        return 80;
      }).strength(0.4))
      .force('charge', d3.forceManyBody().strength(-250))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide<GraphNode>().radius(d => (d.size || 10) + 8))
      .force('x', d3.forceX(W / 2).strength(0.05))
      .force('y', d3.forceY(H / 2).strength(0.05));
    simulationRef.current = sim;

    // Links
    const linkGroup = g.append('g').attr('class', 'nv-links');
    const defs = g.append('defs');
    const mkArrow = (id: string, color: string) =>
      defs.append('marker')
        .attr('id', id).attr('markerWidth', 10).attr('markerHeight', 7)
        .attr('refX', 9).attr('refY', 3.5).attr('orient', 'auto')
        .append('polygon')
        .attr('points', '0 0, 10 3.5, 0 7')
        .attr('fill', color);
    mkArrow('arrow-amber', '#FFD166');
    mkArrow('arrow-gray', 'rgba(255,255,255,0.55)');
    mkArrow('arrow-lavender', '#FF9CF7');

    const linkEls = linkGroup.selectAll<SVGLineElement, GraphLink>('line')
      .data(links)
      .enter().append('line')
      .attr('class', (d: GraphLink) => {
        if (d._linkTypeId !== undefined) return 'nv-link-instance';
        const src = d.source as GraphNode;
        const tgt = d.target as GraphNode;
        if (src?.group === 'typeHub' || tgt?.group === 'typeHub') return 'nv-link-typeinst';
        return 'nv-link-action';
      })
      .style('stroke', (d: GraphLink) => d.color)
      .style('opacity', (d: GraphLink) => {
        if (d._linkTypeId !== undefined) return 0.88;
        if ((d.source as GraphNode)?.group === 'typeHub' || (d.target as GraphNode)?.group === 'typeHub') return 0.7;
        return 0.75;
      })
      .attr('marker-end', (d: GraphLink) => {
        if (d._linkTypeId !== undefined) return 'url(#arrow-amber)';
        if ((d.source as GraphNode)?.group === 'typeHub' || (d.target as GraphNode)?.group === 'typeHub') return 'url(#arrow-gray)';
        return 'url(#arrow-lavender)';
      });

    let enforceInterval = setInterval(() => {
      d3.selectAll<SVGLineElement, GraphLink>('.nv-link-instance')
        .style('stroke', '#FFD166').style('opacity', '0.88');
    }, 1500);

    const nodeContainer = g.append('g').attr('class', 'nv-nodes');
    const typeHubNodes = nodes.filter(d => d.group === 'typeHub');
    const instanceNodes = nodes.filter(d => d.group === 'instance');
    const actionNodes = nodes.filter(d => d.group === 'action');

    // Drag — STICKY
    const dragstarted = (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
      if (!event.active) sim.alphaTarget(0.3).restart();
      d.fx = d.x; d.fy = d.y;
    };
    const dragged = (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
      d.fx = event.x; d.fy = event.y;
    };
    const dragended = (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, _d: GraphNode) => {
      if (!event.active) sim.alphaTarget(0);
    };

    // Type Hub nodes
    const typeHubG = nodeContainer.selectAll<SVGGElement, GraphNode>('.nv-typehub')
      .data(typeHubNodes)
      .enter().append('g')
      .attr('class', 'nv-typehub nv-node')
      .style('cursor', 'default')
      .call(d3.drag<SVGGElement, GraphNode>().on('start', dragstarted).on('drag', dragged).on('end', dragended));
    typeHubG.append('circle').attr('r', (d: GraphNode) => (d.size || 28) + 6)
      .style('fill', 'none').style('stroke', (d: GraphNode) => d.color)
      .style('stroke-width', 1.5).style('opacity', 0.35).style('pointer-events', 'none');
    typeHubG.append('circle').attr('r', (d: GraphNode) => d.size || 28)
      .style('fill', (d: GraphNode) => d.color)
      .style('stroke', 'rgba(255,255,255,0.6)').style('stroke-width', 2)
      .style('opacity', 0.92).style('pointer-events', 'all');
    typeHubG.append('path').attr('d', ICON_HEXAGON).attr('class', 'nv-icon-typehub')
      .attr('transform', 'scale(1.6) translate(0, 1)');

    // Instance nodes
    const instanceG = nodeContainer.selectAll<SVGGElement, GraphNode>('.nv-instance')
      .data(instanceNodes)
      .enter().append('g')
      .attr('class', 'nv-instance nv-node')
      .style('cursor', 'pointer')
      .call(d3.drag<SVGGElement, GraphNode>().on('start', dragstarted).on('drag', dragged).on('end', dragended));
    instanceG.append('circle').attr('r', (d: GraphNode) => d.size || 11)
      .style('fill', (d: GraphNode) => d.color)
      .style('stroke', 'rgba(255,255,255,0.55)').style('stroke-width', 1.5)
      .style('opacity', 0.9).style('pointer-events', 'all');
    instanceG.append('path').attr('d', ICON_BOX).attr('class', 'nv-icon-instance')
      .attr('transform', 'scale(1.0) translate(0, 1)');

    // Property-count badge
    instanceG.each(function(d: GraphNode) {
      const count = d._propsCount || 0;
      if (count === 0) return;
      const gInst = d3.select(this);
      const r = d.size || 11;
      const badgeR = Math.max(5, Math.min(8, 3 + count * 1.2));

      gInst.append('circle')
        .attr('cx', r * 0.65)
        .attr('cy', r * 0.65)
        .attr('r', badgeR)
        .attr('fill', '#FF6B35')
        .attr('stroke', 'rgba(0,0,0,0.5)')
        .attr('stroke-width', 1)
        .style('pointer-events', 'none');

      gInst.append('text')
        .attr('x', r * 0.65)
        .attr('y', r * 0.65 + 1)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .style('font-size', `${Math.max(5, badgeR - 1)}px`)
        .style('font-weight', 'bold')
        .style('fill', 'white')
        .style('pointer-events', 'none')
        .style('font-family', 'Arial, sans-serif')
        .text(count);

      if (d._propsRaw) {
        try {
          const parsed = JSON.parse(d._propsRaw);
          const keys = Object.keys(parsed).slice(0, 5);
          const tip = keys.map(k => `${k}: ${JSON.stringify(parsed[k])}`).join('\n');
          gInst.append('title').text(`属性 (${count}):\n${tip}${Object.keys(parsed).length > 5 ? '\n...' : ''}`);
        } catch { /* non-JSON, skip */ }
      }
    });

    // Action nodes
    const actionG = nodeContainer.selectAll<SVGGElement, GraphNode>('.nv-action')
      .data(actionNodes)
      .enter().append('g')
      .attr('class', 'nv-action nv-node')
      .style('cursor', 'pointer')
      .call(d3.drag<SVGGElement, GraphNode>().on('start', dragstarted).on('drag', dragged).on('end', dragended));
    actionG.append('circle').attr('r', (d: GraphNode) => d.size || 6)
      .style('fill', (d: GraphNode) => d.color)
      .style('stroke', 'rgba(255,255,255,0.6)').style('stroke-width', 1)
      .style('pointer-events', 'all');
    actionG.append('path').attr('d', ICON_BOLT).attr('class', 'nv-icon-action')
      .attr('transform', 'scale(0.55) translate(0, 1)');

    // Labels (typeHub shows description as label; instance/action show name; linkType excluded)
    const LABEL_MAX = 14;
    const labelGroup = g.append('g').attr('class', 'nv-labels');
    const labelEls = labelGroup.selectAll<SVGTextElement, GraphNode>('text')
      .data(nodes.filter(d => d.group !== 'linkType'))
      .enter().append('text')
      .attr('class', (d: GraphNode) => d.group === 'typeHub' ? 'nv-node-label nv-typehub-label' : 'nv-node-label')
      .text((d: GraphNode) => {
        // typeHub: show description as VALUE label; instance/action: show name
        if (d.group === 'typeHub') {
          const label = d.description || d.label;
          return label.length > LABEL_MAX ? label.slice(0, LABEL_MAX) + '…' : label;
        }
        return d.label.length > LABEL_MAX ? d.label.slice(0, LABEL_MAX) + '…' : d.label;
      })
      .style('font-size', (d: GraphNode) => d.group === 'typeHub' ? '12px' : '10px')
      .style('fill', 'white').style('font-weight', 'bold');
    // typeHub tooltip shows name (KEY); others show label
    labelEls.each(function(d: GraphNode) {
      const tooltip = d.group === 'typeHub'
        ? `类型: ${d.label}${d.description ? '\n描述: ' + d.description : ''}`
        : d.label;
      d3.select(this).append('title').text(tooltip);
    });

    // Link type labels on edges: show description (VALUE), tooltip shows name + weight (KEY)
    const linkLabelGroup = g.append('g').attr('class', 'nv-link-labels');
    const linkLabelEls = linkLabelGroup.selectAll<SVGTextElement, GraphLink>('text')
      .data(links.filter(l => l._linkTypeId !== undefined))
      .enter().append('text').attr('class', 'nv-linktype-label')
      .text((d: GraphLink) => {
        // Show description on edge label; fall back to name
        const lt = data.linkTypeMap[d._linkTypeId as number];
        const label = lt?.description || d._linkTypeName || '';
        return label.length > 12 ? label.slice(0, 12) + '…' : label;
      })
      .each(function(d: GraphLink) {
        const lt = data.linkTypeMap[d._linkTypeId as number];
        const name = lt?.name || d._linkTypeName || '';
        d3.select(this).append('title')
          .text(`关系: ${name}\n强度: ${Number(d.weight).toFixed(2)}`);
      });

    // TICK
    sim.on('tick', () => {
      linkEls
        .attr('x1', (d: GraphLink) => (d.source as GraphNode).x || 0)
        .attr('y1', (d: GraphLink) => (d.source as GraphNode).y || 0)
        .attr('x2', (d: GraphLink) => {
          const src = d.source as GraphNode, tgt = d.target as GraphNode;
          const dx = (tgt.x || 0) - (src.x || 0);
          const dy = (tgt.y || 0) - (src.y || 0);
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          return (tgt.x || 0) - (dx / dist) * ((tgt.size || 10) + 2);
        })
        .attr('y2', (d: GraphLink) => {
          const src = d.source as GraphNode, tgt = d.target as GraphNode;
          const dx = (tgt.x || 0) - (src.x || 0);
          const dy = (tgt.y || 0) - (src.y || 0);
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          return (tgt.y || 0) - (dy / dist) * ((tgt.size || 10) + 2);
        });
      typeHubG.attr('transform', (d: GraphNode) => `translate(${d.x || 0},${d.y || 0})`);
      instanceG.attr('transform', (d: GraphNode) => `translate(${d.x || 0},${d.y || 0})`);
      actionG.attr('transform', (d: GraphNode) => `translate(${d.x || 0},${d.y || 0})`);
      labelEls
        .attr('x', (d: GraphNode) => (d.x || 0) + (d.size || 10) + 5)
        .attr('y', (d: GraphNode) => (d.y || 0) + 4);
      linkLabelEls
        .attr('x', (d: GraphLink) => (((d.source as GraphNode).x || 0) + ((d.target as GraphNode).x || 0)) / 2)
        .attr('y', (d: GraphLink) => (((d.source as GraphNode).y || 0) + ((d.target as GraphNode).y || 0)) / 2 - 4);
    });

    // Event handlers
    const allNodeGroups = nodeContainer.selectAll<SVGGElement, GraphNode>('g.nv-node');
    allNodeGroups.on('click', (event: MouseEvent, d: GraphNode) => {
      event.stopPropagation();
      setSelectedNode(d);
      highlightSelectedNode(d.id, nodes, linkEls, labelEls, allNodeGroups);
      showNodeInfo(d, data);
      (window as any).__currentNodeId = d.id;
    });
    allNodeGroups.on('dblclick', (event: MouseEvent, d: GraphNode) => {
      event.stopPropagation();
      d.fx = null; d.fy = null;
      if (!zoomRef.current) return;
      const scale = 2.0;
      svg.transition().duration(500)
        .call(zoom.transform as any, d3.zoomIdentity.translate(W / 2 - (d.x || 0) * scale, H / 2 - (d.y || 0) * scale).scale(scale));
    });
    allNodeGroups.on('contextmenu', (event: MouseEvent, d: GraphNode) => {
      event.preventDefault();
      toggleNodeCollapse(d.id, nodes, links, allNodeGroups, labelEls, linkEls, collapsedRef.current);
    });
    svg.on('click', () => {
      setSelectedNode(null);
      (window as any).__currentNodeId = null;
      resetHighlights(nodes, linkEls, labelEls, allNodeGroups);
    });

    setTimeout(() => (window as any).__d3FitAll?.(), 600);
    setD3Ready(true);

    // ResizeObserver
    const ro = new ResizeObserver(() => {
      if (!containerRef.current || !simulationRef.current) return;
      const w = containerRef.current.clientWidth, h = containerRef.current.clientHeight;
      svg.attr('width', w).attr('height', h);
      simulationRef.current.force('center', d3.forceCenter(w / 2, h / 2));
      simulationRef.current.alpha(0.1).restart();
    });
    ro.observe(containerRef.current);

    return () => {
      clearInterval(enforceInterval);
      ro.disconnect();
      simulationRef.current?.stop();
      const el = document.getElementById(styleId);
      if (el) el.remove();
      delete (window as any).__d3FitAll;
      delete (window as any).__currentNodeId;
    };
  }, [graphData]);

  // ==================== Helpers ====================

  function toggleNodeCollapse(
    nodeId: string, nodes: GraphNode[], links: GraphLink[],
    allNodeGroups: d3.Selection<SVGGElement, GraphNode, SVGGElement, unknown>,
    labelEls: d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown>,
    linkEls: d3.Selection<SVGLineElement, GraphLink, SVGGElement, unknown>,
    collapsed: Set<string>
  ) {
    const getConnNodes = (id: string) => {
      const conn: string[] = [];
      links.forEach(l => {
        const s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
        const t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
        if (s === id) conn.push(t);
        if (t === id) conn.push(s);
      });
      return conn;
    };

    if (collapsed.has(nodeId)) {
      collapsed.delete(nodeId);
      const toShow = new Set<string>();
      const queue = getConnNodes(nodeId);
      while (queue.length) {
        const cur = queue.shift()!;
        if (toShow.has(cur) || cur === nodeId) continue;
        toShow.add(cur);
        getConnNodes(cur).forEach(n => { if (!collapsed.has(n)) queue.push(n); });
      }
      toShow.forEach(id => {
        allNodeGroups.filter((d: GraphNode) => d.id === id).style('display', null);
        labelEls.filter((d: GraphNode) => d.id === id).style('display', null);
        linkEls.filter((l: GraphLink) => {
          const s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
          const t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
          return s === id || t === id;
        }).style('display', null);
      });
    } else {
      collapsed.add(nodeId);
      const toHide = new Set<string>();
      const queue = getConnNodes(nodeId);
      while (queue.length) {
        const cur = queue.shift()!;
        if (toHide.has(cur) || cur === nodeId) continue;
        toHide.add(cur);
        getConnNodes(cur).forEach(n => { if (!collapsed.has(n)) queue.push(n); });
      }
      toHide.forEach(id => {
        allNodeGroups.filter((d: GraphNode) => d.id === id).style('display', 'none');
        labelEls.filter((d: GraphNode) => d.id === id).style('display', 'none');
        linkEls.filter((l: GraphLink) => {
          const s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
          const t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
          return s === id || t === id;
        }).style('display', 'none');
      });
    }
  }

  function highlightSelectedNode(
    nodeId: string, nodes: GraphNode[],
    linkEls: d3.Selection<SVGLineElement, GraphLink, SVGGElement, unknown>,
    labelEls: d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown>,
    allNodeGroups: d3.Selection<SVGGElement, GraphNode, SVGGElement, unknown>
  ) {
    d3.selectAll<SVGLineElement, GraphLink>('.nv-link-instance').style('stroke', '#FFD166').style('opacity', 0.88);
    d3.selectAll<SVGTextElement, GraphNode>('.nv-node-label').style('fill', 'white').style('font-size', null).style('font-weight', null);

    allNodeGroups.classed('nv-highlight-node', (d: GraphNode) => d.id === nodeId);
    allNodeGroups.classed('nv-selected-pulse', (d: GraphNode) => d.id === nodeId);
    labelEls.classed('nv-label-selected', (d: GraphNode) => d.id === nodeId);

    linkEls
      .style('opacity', (l: GraphLink) => {
        const s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
        const t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
        return s === nodeId || t === nodeId ? 1 : 0.3;
      })
      .style('stroke', (l: GraphLink) => {
        const s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
        const t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
        return s === nodeId || t === nodeId ? '#FFD166' : l.color;
      });
  }

  function resetHighlights(
    nodes: GraphNode[],
    linkEls: d3.Selection<SVGLineElement, GraphLink, SVGGElement, unknown>,
    labelEls: d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown>,
    allNodeGroups: d3.Selection<SVGGElement, GraphNode, SVGGElement, unknown>
  ) {
    d3.selectAll<SVGLineElement, GraphLink>('.nv-link-instance').style('opacity', 0.88).style('stroke', '#FFD166');
    d3.selectAll<SVGLineElement, GraphLink>('.nv-link-typeinst').style('opacity', 0.7).style('stroke', 'rgba(255,255,255,0.45)');
    d3.selectAll<SVGLineElement, GraphLink>('.nv-link-action').style('opacity', 0.75).style('stroke', '#FF9CF7');
    labelEls.style('fill', 'white').style('font-size', null).style('font-weight', null).classed('nv-label-selected', false);
    allNodeGroups.classed('nv-highlight-node', false).classed('nv-selected-pulse', false);
    setInfoContent('');
  }

  function showNodeInfo(d: GraphNode, data: GraphData) {
    const groupLabels: Record<string, string> = {
      typeHub: '类型 (Type)', instance: '实例 (Instance)',
      linkType: '关系类型', action: '行动 (Action)',
    };
    const grp = groupLabels[d.group] || d.group;

    // Get connected nodes
    const connLinks = data.links.filter(l => {
      const s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
      const t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
      return s === d.id || t === d.id;
    });

    let html = `<strong style="color:#FFD700;font-size:12px">${d.label}</strong><br>`;
    html += `<span style="color:#aaa;font-size:10px">类型: ${grp}</span><br>`;
    html += `<span style="color:#888;font-size:10px">连接数: ${connLinks.length}</span>`;

    // For typeHub, show instance count specific to this type (not global total)
    if (d.group === 'typeHub' && d._instanceCount !== undefined) {
      html += `<br><span style="color:#888;font-size:10px">实例数: ${d._instanceCount}</span>`;
    }
    // For typeHub, show name and description (label is now description)
    if (d.group === 'typeHub') {
      html += `<br><span style="color:#aaa;font-size:10px">类型名: </span><span style="color:#eee;font-size:10px">${d.label}</span>`;
      if (d.description) {
        html += `<br><span style="color:#aaa;font-size:10px">描述: </span><span style="color:#ddd;font-size:10px">${d.description.slice(0, 80)}</span>`;
      }
    }

    // For instance nodes, parse and display properties as key-value table
    if (d.group === 'instance' && d._propsRaw) {
      let parsed: Record<string, any> = {};
      try { parsed = JSON.parse(d._propsRaw); } catch { /* non-JSON raw string */ }

      const keys = Object.keys(parsed);
      if (keys.length > 0) {
        html += `<br><span style="color:#4CC9F0;font-size:10px;font-weight:bold;margin-top:4px;display:block">属性 (${keys.length})</span>`;
        html += `<div style="max-height:140px;overflow-y:auto;margin-top:3px;background:rgba(0,0,0,0.35);border-radius:4px;padding:4px 6px">`;
        keys.forEach(k => {
          const v = parsed[k];
          const vStr = typeof v === 'object' ? JSON.stringify(v) : String(v);
          const shortVal = vStr.length > 40 ? vStr.slice(0, 40) + '…' : vStr;
          html += `<div style="font-size:9.5px;line-height:1.6">`;
          html += `<span style="color:#F4A261;font-weight:bold">${k}</span>`;
          html += `<span style="color:#ccc">: </span>`;
          html += `<span style="color:#eee">${shortVal}</span>`;
          html += `</div>`;
        });
        html += `</div>`;
      }
    } else if (d.description && d.group === 'instance' && !d._propsRaw) {
      // Fallback: plain description text
      html += `<br><span style="color:#666;font-size:10px">${d.description.slice(0, 80)}</span>`;
    }

    setInfoContent(html);
  }

  // ==================== Search ====================
  useEffect(() => {
    // Wait for D3 to finish initial render before applying search highlights
    if (!svgRef.current || !d3Ready) return;
    const isActive = searchTerm.trim().length > 0;
    const terms = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
    if (!graphDataRef.current) return;

    const nodes = graphDataRef.current.nodes;
    const matched = nodes.filter(n =>
      terms.some(t =>
        n.label.toLowerCase().includes(t) ||
        (n.group || '').toLowerCase().includes(t) ||
        (n.description || '').toLowerCase().includes(t)
      )
    ).map(n => n.id);
    searchHighlightedRef.current = matched;
    setSearchIndex(-1);

    d3.selectAll<SVGGElement, GraphNode>('g.nv-node')
      .classed('nv-dim', (d: GraphNode) => isActive && !matched.includes(d.id));
    d3.selectAll<SVGTextElement, GraphNode>('.nv-node-label')
      .classed('nv-dim-label', (d: GraphNode) => isActive && !matched.includes(d.id))
      .classed('nv-label-match', (d: GraphNode) => matched.includes(d.id) && isActive)
      .style('fill', (d: GraphNode) => matched.includes(d.id) && isActive ? '#00BFFF' : 'white');
    d3.selectAll<SVGLineElement, GraphLink>('.nv-link-instance')
      .style('opacity', (l: GraphLink) => {
        if (!isActive) return 0.88;
        const s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
        const t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
        return matched.includes(s) || matched.includes(t) ? 1 : 0.05;
      });
  }, [searchTerm, d3Ready]);

  const navigateSearch = (dir: 1 | -1) => {
    const results = searchHighlightedRef.current;
    if (!results.length || !svgRef.current || !zoomRef.current) return;
    let idx = searchIndex + dir;
    if (idx < 0) idx = results.length - 1;
    if (idx >= results.length) idx = 0;
    setSearchIndex(idx);
    const nodeId = results[idx];
    const node = simulationRef.current?.nodes().find(n => n.id === nodeId);
    if (!node || node.x == null) return;
    const W = containerRef.current?.clientWidth ?? 800;
    const H = containerRef.current?.clientHeight ?? 600;
    const scale = 1.5;
    const tx = W / 2 - (node.x || 0) * scale;
    const ty = H / 2 - (node.y || 0) * scale;
    d3.select(svgRef.current).transition().duration(500)
      .call(zoomRef.current!.transform as any, d3.zoomIdentity.translate(tx, ty).scale(scale));
    d3.selectAll<SVGTextElement, GraphNode>('.nv-node-label')
      .classed('nv-label-selected', (d: GraphNode) => d.id === nodeId);
  };

  // Keyboard shortcuts: Alt+C/I/L/S, Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') { if (e.key === 'Escape') setSearchTerm(''); return; }
      if (e.altKey) {
        if (e.key === 'c' || e.key === 'C') { e.preventDefault(); setShowControls(v => !v); }
        if (e.key === 'i' || e.key === 'I') { e.preventDefault(); setShowInfo(v => !v); }
        if (e.key === 'l' || e.key === 'L') { e.preventDefault(); setShowLegend(v => !v); }
        if (e.key === 's' || e.key === 'S') { e.preventDefault(); (document.getElementById('nv-search-input') as HTMLInputElement)?.focus(); }
      }
      if (e.key === 'Escape') setSearchTerm('');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // CSV export
  const downloadCSV = () => {
    const gd = graphDataRef.current;
    if (!gd) return;
    const rows = [
      ['id', 'label', 'group', 'color', 'size', 'description'],
      ...gd.nodes.map(n => [n.id, n.label, n.group, n.color, n.size, n.description]),
      [],
      ['source', 'target', 'color', 'weight', 'link_type'],
      ...gd.links.map(l => [
        typeof l.source === 'object' ? (l.source as GraphNode).id : l.source,
        typeof l.target === 'object' ? (l.target as GraphNode).id : l.target,
        l.color, l.weight, l._linkTypeName || '',
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = encodeCSV(csv);
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `ontology_graph_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(a.href);
  };

  // Excel export
  const downloadExcelFile = () => {
    const gd = graphDataRef.current;
    if (!gd) return;
    downloadExcel([
      {
        name: 'Nodes',
        headers: ['id', 'label', 'group', 'color', 'size', 'description'],
        rows: gd.nodes.map(n => [n.id, n.label, n.group, n.color, n.size, n.description]),
      },
      {
        name: 'Edges',
        headers: ['source', 'target', 'color', 'weight', 'link_type'],
        rows: gd.links.map(l => [
          typeof l.source === 'object' ? (l.source as GraphNode).id : l.source,
          typeof l.target === 'object' ? (l.target as GraphNode).id : l.target,
          l.color, l.weight, l._linkTypeName || '',
        ]),
      },
    ], `ontology_graph_${Date.now()}.xlsx`);
  };

  const fitAll = () => { (window as any).__d3FitAll?.(); };
  const zoomIn = () => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1.4);
  };
  const zoomOut = () => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1 / 1.4);
  };

  const stats = graphData ? { nodes: graphData.nodes.length, links: graphData.links.length } : { nodes: 0, links: 0 };

  // ==================== Styles ====================
  const panelBase: React.CSSProperties = {
    background: 'rgba(0,0,0,0.88)', border: '1px solid #3949ab', borderRadius: 5,
    fontSize: 12, fontFamily: 'Arial,sans-serif', color: 'white',
  };
  const btnStyle: React.CSSProperties = {
    background: '#1a237e', color: 'white', border: '1px solid #3949ab',
    padding: '3px 8px', borderRadius: 3, cursor: 'pointer', fontSize: 11,
  };
  const panelBtnStyle: React.CSSProperties = { ...btnStyle };

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: '100%',
        background: 'radial-gradient(circle at center, #1a237e 0%, #0d1421 50%, #000 100%)',
        position: 'relative', overflow: 'hidden',
      }}
    >
      <svg ref={svgRef} style={{ width: '100%', height: '100%', display: 'block' }} />

      {/* ==================== EMPTY / UNINITIALIZED STATE ==================== */}
      {!loading && !graphData && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 20, zIndex: 100,
          pointerEvents: 'none',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
            <div style={{ fontSize: 18, color: '#FFD700', fontWeight: 'bold', marginBottom: 8 }}>
              本体论尚未初始化
            </div>
            <div style={{ fontSize: 13, color: '#aaa', maxWidth: 400, lineHeight: 1.7, marginBottom: 20 }}>
              请先在左侧 <strong style={{ color: '#4CAF50' }}>MECE 面板</strong>的「基础层」创建类型和实例，<br />
              或执行「一键初始化」导入种子数据，图谱将自动更新。
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', pointerEvents: 'all' }}>
              <button onClick={refreshGraph} style={{ ...btnStyle, padding: '6px 16px', fontSize: 12 }}>
                <RefreshCw className="inline w-3.5 h-3.5 mr-1" style={{ verticalAlign: 'middle' }} />
                刷新图谱
              </button>
              <button onClick={downloadCSV} style={{ ...btnStyle, padding: '6px 16px', fontSize: 12, borderColor: '#4CAF50' }}>
                导出 CSV
              </button>
              <button onClick={downloadExcelFile} style={{ ...btnStyle, padding: '6px 16px', fontSize: 12, borderColor: '#1A237E', background: 'rgb(26, 35, 126)' }}>
                导出 Excel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== LEFT: Controls ==================== */}
      {showControls && graphData && (
        <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 1000, ...panelBase, padding: 10, minWidth: 280 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong style={{ fontSize: 13 }}>控制面板</strong>
            <button onClick={() => setShowControls(false)} style={panelBtnStyle}>隐藏</button>
          </div>
          <div style={{ fontSize: 11, color: '#ccc', lineHeight: 1.7 }}>
            <div>• 拖动节点 → 移动并钉住位置</div>
            <div>• 滚轮 / 双指 → 缩放视图</div>
            <div>• 双击节点 → 释放固定 + 聚焦</div>
            <div>• 右键节点 → 折叠 / 展开</div>
            <div style={{ marginTop: 8, color: '#888', fontSize: 10 }}>
              <strong>快捷键:</strong> Alt+C/I/L/S | Escape
            </div>
          </div>
          <div style={{ display: 'flex', gap: 5, marginTop: 10, flexWrap: 'wrap' }}>
            <button onClick={fitAll} style={{ ...btnStyle, flex: 1, borderColor: '#4CAF50', color: '#4CAF50' }}>Fit All</button>
            <button onClick={zoomIn} style={{ ...btnStyle, flex: 1 }}>放大</button>
            <button onClick={zoomOut} style={{ ...btnStyle, flex: 1 }}>缩小</button>
          </div>
          <div style={{ display: 'flex', gap: 5, marginTop: 5 }}>
            <button onClick={refreshGraph} style={{ ...btnStyle, flex: 1 }}>
              <RefreshCw className="inline w-3.5 h-3.5 mr-1" style={{ verticalAlign: 'middle' }} />
              刷新数据
            </button>
          </div>
          {/* Search */}
          <div style={{ marginTop: 10, borderTop: '1px solid #333', paddingTop: 8 }}>
            <strong style={{ fontSize: 11 }}>搜索拓扑图</strong>
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 5 }}>
              <input
                id="nv-search-input"
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') navigateSearch(1);
                  else if (e.key === 'Escape') setSearchTerm('');
                }}
                placeholder="对象名、类型..."
                style={{
                  flex: 1, padding: '4px 8px', border: '1px solid #3949ab', borderRadius: 4,
                  background: '#1a237e', color: 'white', fontSize: 11, outline: 'none',
                }}
              />
              {searchTerm && <button onClick={() => setSearchTerm('')} style={{ ...btnStyle, marginLeft: 4 }}>✕</button>}
            </div>
            {searchHighlightedRef.current.length > 0 && (
              <div style={{ marginTop: 4, display: 'flex', gap: 4 }}>
                <button onClick={() => navigateSearch(-1)} style={{ ...btnStyle, flex: 1 }}>◀ 上一个</button>
                <button onClick={() => navigateSearch(1)} style={{ ...btnStyle, flex: 1 }}>下一个 ▶</button>
              </div>
            )}
            {searchHighlightedRef.current.length > 0 && (
              <div style={{ marginTop: 3, fontSize: 10, color: '#00BFFF' }}>
                找到 {searchHighlightedRef.current.length} 条结果
              </div>
            )}
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 5, flexDirection: 'column' }}>
            <button onClick={() => setShowScanModal(true)} style={{ ...btnStyle, borderColor: '#FFD166', width: '100%', textAlign: 'center' }}>
              查看原始数据
            </button>
            <button onClick={downloadCSV} style={{ ...btnStyle, borderColor: '#4CAF50', width: '100%', textAlign: 'center' }}>
              下载 CSV
            </button>
            <button onClick={downloadExcelFile} style={{ ...btnStyle, borderColor: '#1A237E', width: '100%', textAlign: 'center', background: 'rgb(26, 35, 126)' }}>
              下载 Excel
            </button>
          </div>
        </div>
      )}

      {!showControls && (
        <button onClick={() => setShowControls(true)} style={{ position: 'absolute', top: 10, left: 10, zIndex: 1000, ...panelBtnStyle }}>
          控制面板
        </button>
      )}

      {/* ==================== RIGHT: Stats + Info ==================== */}
      {showInfo && graphData && (
        <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000, ...panelBase, padding: 10, minWidth: 250 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong style={{ fontSize: 13 }}>扫描统计</strong>
            <button onClick={() => setShowInfo(false)} style={panelBtnStyle}>隐藏</button>
          </div>
          <div style={{ fontSize: 11 }}>
            <div style={{ marginBottom: 4 }}>
              <span style={{ color: '#888' }}>节点总数: </span>
              <span style={{ color: '#00BFFF', fontWeight: 'bold' }}>{stats.nodes}</span>
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ color: '#888' }}>连接总数: </span>
              <span style={{ color: '#FFD166', fontWeight: 'bold' }}>{stats.links}</span>
            </div>
            <div style={{ borderTop: '1px solid #333', paddingTop: 8 }}>
              <div dangerouslySetInnerHTML={{ __html: infoContent || '<span style="color:#555;font-size:10px">单击节点查看详情</span>' }} />
            </div>
          </div>
        </div>
      )}

      {!showInfo && (
        <button onClick={() => setShowInfo(true)} style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000, ...panelBtnStyle }}>
          信息面板
        </button>
      )}

      {/* ==================== BOTTOM-LEFT: Legend ==================== */}
      {showLegend && graphData && (
        <div style={{ position: 'absolute', bottom: 10, left: 10, zIndex: 1000, ...panelBase, padding: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong style={{ fontSize: 13 }}>图例</strong>
            <button onClick={() => setShowLegend(false)} style={panelBtnStyle}>隐藏</button>
          </div>
          {[
            { color: TYPE_COLORS_WARM[0], r: 8, label: '类型 (TypeHub, 暖色系)' },
            { color: TYPE_COLORS_COOL[0], r: 5, label: '实例 (Instance, 冷色系)' },
            { color: '#FF6B35', r: 3, label: '已完成行动' },
            { color: '#FF9800', r: 3, label: '待执行行动' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', margin: '2px 0' }}>
              <svg width="16" height="16" viewBox="-10 -10 20 20" style={{ marginRight: 5 }}>
                <circle cx="0" cy="0" r={item.r} fill={item.color} stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
              </svg>
              <span style={{ fontSize: 11, color: '#ccc' }}>{item.label}</span>
            </div>
          ))}
          {/* Property badge legend */}
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 5 }}>
            <svg width="18" height="18" style={{ marginRight: 5 }}>
              <circle cx="5" cy="5" r="5" fill={TYPE_COLORS_COOL[0]} stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />
              <circle cx="10" cy="10" r="4" fill="#FF6B35" stroke="rgba(0,0,0,0.5)" strokeWidth="1" />
              <text x="10" y="11" textAnchor="middle" dominantBaseline="middle" fontSize="5" fontWeight="bold" fill="white" fontFamily="Arial">3</text>
            </svg>
            <span style={{ fontSize: 11, color: '#ccc' }}>属性数量徽标 (右下角)</span>
          </div>
          <div style={{ borderTop: '1px solid #333', paddingTop: 6, marginTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 4 }}>
              <svg width="36" height="10" style={{ marginRight: 5 }}>
                <defs>
                  <marker id="leg-arrow-amber" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                    <polygon points="0 0, 6 2, 0 4" fill="#FFD166" />
                  </marker>
                  <marker id="leg-arrow-gray" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                    <polygon points="0 0, 6 2, 0 4" fill="rgba(255,255,255,0.55)" />
                  </marker>
                  <marker id="leg-arrow-lavender" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                    <polygon points="0 0, 6 2, 0 4" fill="#FF9CF7" />
                  </marker>
                </defs>
                <line x1="0" y1="5" x2="26" y2="5" stroke="#FFD166" strokeWidth="2.5" markerEnd="url(#leg-arrow-amber)" />
              </svg>
              <span style={{ fontSize: 11, color: '#ccc' }}>关系连线</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 4 }}>
              <svg width="36" height="10" style={{ marginRight: 5 }}>
                <line x1="0" y1="5" x2="26" y2="5" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#leg-arrow-gray)" />
              </svg>
              <span style={{ fontSize: 11, color: '#ccc' }}>类型归属 (虚线)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 4 }}>
              <svg width="36" height="10" style={{ marginRight: 5 }}>
                <line x1="0" y1="5" x2="26" y2="5" stroke="#FF9CF7" strokeWidth="1" markerEnd="url(#leg-arrow-lavender)" />
              </svg>
              <span style={{ fontSize: 11, color: '#ccc' }}>行动连线</span>
            </div>
          </div>
        </div>
      )}

      {!showLegend && (
        <button onClick={() => setShowLegend(true)} style={{ position: 'absolute', bottom: 10, left: 10, zIndex: 1000, ...panelBtnStyle }}>
          图例
        </button>
      )}

      {/* ==================== TOP-CENTER: Compact Search ==================== */}
      {graphData && (
        <div style={{
          position: 'absolute', top: 10,
          left: showControls ? 300 : 180, zIndex: 1000,
          background: 'rgba(0,0,0,0.85)', border: '1px solid #3949ab', borderRadius: 5,
          padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8,
          transition: 'left 0.3s',
        }}>
          <span style={{ fontSize: 11, color: '#888' }}>🔎</span>
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') navigateSearch(1);
              else if (e.key === 'Escape') setSearchTerm('');
            }}
            placeholder="搜索... (Alt+S)"
            style={{ background: 'transparent', color: 'white', border: 'none', outline: 'none', fontSize: 12, width: 200 }}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 12, padding: 0 }}>✕</button>
          )}
          {searchHighlightedRef.current.length > 0 && (
            <span style={{ fontSize: 10, color: '#00BFFF', whiteSpace: 'nowrap' }}>{searchHighlightedRef.current.length}条</span>
          )}
        </div>
      )}

      {/* ==================== Scan Data Modal ==================== */}
      {showScanModal && graphData && (
        <div
          style={{ position: 'absolute', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowScanModal(false)}
        >
          <div
            style={{ background: '#1a237e', border: '1px solid #3949ab', borderRadius: 8, padding: 20, maxWidth: '80vw', maxHeight: '80vh', overflow: 'auto', color: 'white', fontFamily: 'monospace', fontSize: 11 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <strong style={{ fontSize: 14 }}>本体图谱原始数据</strong>
              <button onClick={() => setShowScanModal(false)} style={panelBtnStyle}>关闭</button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <strong>类型 ({graphData.typeNames.length})</strong>
              <pre style={{ background: '#0d1421', padding: 8, borderRadius: 4, maxHeight: 200, overflow: 'auto', fontSize: 10 }}>
                {JSON.stringify(graphData.typeNames.map((n, i) => ({ id: i + 1, name: n })), null, 2)}
              </pre>
            </div>
            <div style={{ marginBottom: 12 }}>
              <strong>节点 ({graphData.nodes.length})</strong>
              <pre style={{ background: '#0d1421', padding: 8, borderRadius: 4, maxHeight: 300, overflow: 'auto', fontSize: 10 }}>
                {JSON.stringify(graphData.nodes, null, 2)}
              </pre>
            </div>
            <div>
              <strong>连线 ({graphData.links.length})</strong>
              <pre style={{ background: '#0d1421', padding: 8, borderRadius: 4, maxHeight: 300, overflow: 'auto', fontSize: 10 }}>
                {JSON.stringify(graphData.links.map(l => ({
                  source: typeof l.source === 'object' ? (l.source as GraphNode).id : l.source,
                  target: typeof l.target === 'object' ? (l.target as GraphNode).id : l.target,
                  color: l.color, weight: l.weight, linkType: l._linkTypeName,
                })), null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* ==================== Loading ==================== */}
      {loading && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}>
          <div style={{ background: '#1a237e', border: '1px solid #3949ab', borderRadius: 8, padding: '16px 32px', textAlign: 'center' }}>
            <div style={{ color: '#ccc', marginBottom: 8, fontSize: 13 }}>加载本体论图谱...</div>
            <div style={{ width: 160, height: 4, background: '#333', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#00BFFF', width: '60%', animation: 'nv-pulse 1s ease-in-out infinite alternate' }} />
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes nv-pulse { from { width: 20%; } to { width: 80%; } }`}</style>
    </div>
  );
};

export default D3GraphView;
