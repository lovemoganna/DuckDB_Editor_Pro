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
 * 6. Labels: truncated at 18 chars + full-label tooltip
 * 7. Semantic clustering: Person/Goal instances placed near their linked Aspect
 * 8. Compact layout: tighter default physics + robust Fit All with padding & min zoom
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { RefreshCw, Sparkles, Loader2, HelpCircle } from 'lucide-react';
import { duckDBService } from '../../services/duckdbService';
import { ontologyAiService } from '../../services/ontologyAiService';
import { encodeCSV, downloadExcel } from '../../utils/exportUtils';
import { useOntologyStore } from '../../hooks/useOntologyStore';
import { CanvasHelpPanel } from '../skills/CanvasHelpPanel';

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
  _hasInstances?: boolean; // whether this typeHub has any instances
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

// ==================== Initial Layout ====================

/**
 * Compute initial node positions using SEMANTIC clustering.
 *
 * Core idea: objects that are related via life_link should be placed
 * near each other, not scattered by TypeHub. This makes the graph
 * immediately readable as a mind-map rather than a scattered node-cloud.
 *
 * Layout rules:
 *  - Aspect instances (心态/工作/家庭/身体) → center cluster (r 0-80)
 *  - Person instances (父母/配偶/同事/老友) → near their linked Aspect
 *  - Goal instances (副业变现/读书/跑步/日语) → near their linked Aspect
 *  - TypeHub labels → small rings around their cluster center
 *  - Actions → tight cluster near their owning object
 *  - linkType nodes → tiny ring at center
 */
function computeInitialPositions(
  nodes: GraphNode[],
  typeHubNodes: GraphNode[],
  svgW: number,
  svgH: number,
  rawLinks?: any[]   // passed from loadDynamicGraphData for semantic mapping
): void {
  const cx = svgW / 2;
  const cy = svgH / 2;

  // ---- Build typeHub lookup ----
  const typeHubById: Record<string, GraphNode> = {};
  typeHubNodes.forEach(n => { typeHubById[n.id] = n; });

  // ---- Identify which instances are Aspects (typeId === 1) ----
  const instanceNodes = nodes.filter(n => n.group === 'instance');
  const aspectInstances = instanceNodes.filter(n => n._typeId === 1);
  const nonAspectInstances = instanceNodes.filter(n => n._typeId !== 1);

  // ---- Build link weight map: objectId → strongest linked aspect objectId ----
  // For each non-Aspect instance, find the Aspect instance it links to with highest weight
  const linkToAspect: Record<string, number> = {}; // non-aspect objectId → aspect objectId
  const linkStrength: Record<string, number> = {};  // non-aspect objectId → weight

  if (rawLinks) {
    rawLinks.forEach((link: any) => {
      const srcId = link.source_object_id;
      const tgtId = link.target_object_id;
      const weight = Number(link.weight) || 0.5;

      // Check both directions: src is non-aspect linking to aspect, or vice versa
      const srcNode = instanceNodes.find(n => n._objId === srcId);
      const tgtNode = instanceNodes.find(n => n._objId === tgtId);
      const srcIsAspect = srcNode?._typeId === 1;
      const tgtIsAspect = tgtNode?._typeId === 1;

      if (srcIsAspect && !tgtIsAspect) {
        const key = String(tgtId);
        if (!linkStrength[key] || weight > linkStrength[key]) {
          linkToAspect[key] = srcId;
          linkStrength[key] = weight;
        }
      } else if (!srcIsAspect && tgtIsAspect) {
        const key = String(srcId);
        if (!linkStrength[key] || weight > linkStrength[key]) {
          linkToAspect[key] = tgtId;
          linkStrength[key] = weight;
        }
      }
    });
  }

  // ---- Place Aspect instances in a compact center cluster ----
  // Assign them to 4 quadrants around center
  const quadrantAngles: Record<number, number> = {
    1: -Math.PI / 4,   // 心态 → top-right
    2: Math.PI / 4,    // 工作 → bottom-right
    3: 3 * Math.PI / 4, // 家庭 → bottom-left
    4: -3 * Math.PI / 4, // 身体 → top-left
  };
  const aspectClusterRadius = 70;

  aspectInstances.forEach((node, i) => {
    const objId = node._objId ?? i + 1;
    const baseAngle = quadrantAngles[objId] ?? (i / Math.max(aspectInstances.length, 1)) * 2 * Math.PI - Math.PI / 2;
    const r = aspectClusterRadius + (i % 2) * 20; // slight stagger
    node.x = cx + r * Math.cos(baseAngle);
    node.y = cy + r * Math.sin(baseAngle);
  });

  // ---- Place TypeHub labels compactly around the center ----
  const typeHubRadius = 130;
  typeHubNodes.forEach((node, i) => {
    const angle = (i / Math.max(typeHubNodes.length, 1)) * 2 * Math.PI - Math.PI / 2;
    node.x = cx + typeHubRadius * Math.cos(angle);
    node.y = cy + typeHubRadius * Math.sin(angle);
  });

  // ---- Place non-Aspect instances near their strongest-linked Aspect ----
  nonAspectInstances.forEach((node, i) => {
    const objId = node._objId ?? 0;
    const linkedAspectId = linkToAspect[String(objId)];
    let baseX = cx;
    let baseY = cy;
    let baseAngle = 0;

    if (linkedAspectId) {
      const anchorNode = aspectInstances.find(n => n._objId === linkedAspectId);
      if (anchorNode && anchorNode.x !== undefined && anchorNode.y !== undefined) {
        baseX = anchorNode.x;
        baseY = anchorNode.y;
        // Direction from center toward this node's quadrant
        baseAngle = Math.atan2(baseY - cy, baseX - cx);
      }
    } else {
      // No link found → spread around the Aspect cluster edge
      baseAngle = (i / Math.max(nonAspectInstances.length, 1)) * 2 * Math.PI;
    }

    // Place on a ring just outside the Aspect cluster (r 130-200)
    const orbitRadius = 150 + (i % 3) * 25;
    const angleOffset = (i % 2 === 0 ? 1 : -1) * (Math.PI / 8); // ±22.5° stagger
    node.x = baseX + orbitRadius * Math.cos(baseAngle + angleOffset);
    node.y = baseY + orbitRadius * Math.sin(baseAngle + angleOffset);
  });

  // ---- Action nodes: scatter near center ----
  const actionNodes = nodes.filter(n => n.group === 'action');
  actionNodes.forEach((node, i) => {
    const angle = (i / Math.max(actionNodes.length, 1)) * 2 * Math.PI;
    node.x = cx + 50 * Math.cos(angle);
    node.y = cy + 50 * Math.sin(angle);
  });

  // ---- linkType nodes: tiny ring at center ----
  const linkTypeNodes = nodes.filter(n => n.group === 'linkType');
  linkTypeNodes.forEach((node, i) => {
    const angle = (i / Math.max(linkTypeNodes.length, 1)) * 2 * Math.PI;
    node.x = cx + 25 * Math.cos(angle);
    node.y = cy + 25 * Math.sin(angle);
  });
}

// ==================== Data Loading ====================

async function loadDynamicGraphData(mapping: any): Promise<GraphData | null> {
  try {
    const [objectTypes, objects, linkTypes, rawLinks, actions] = await Promise.all([
      duckDBService.query(`SELECT * FROM ${mapping.objectTypeTable} ORDER BY id`),
      duckDBService.query(`SELECT * FROM ${mapping.objectTable} ORDER BY id`),
      duckDBService.query(`SELECT * FROM ${mapping.linkTypeTable} ORDER BY id`),
      duckDBService.query(`SELECT * FROM ${mapping.linkTable} ORDER BY id`),
      duckDBService.query(`SELECT * FROM ${mapping.actionTable} ORDER BY id`),
    ]);

    if (objects.length === 0) {
      return { nodes: [], links: [], typeMap: {}, linkTypeMap: {}, typeNames: [] };
    }

    const typeMap: Record<number, any> = {};
    objectTypes.forEach((t: any) => { typeMap[t.id] = t; });
    const linkTypeMap: Record<number, any> = {};
    linkTypes.forEach((lt: any) => { linkTypeMap[lt.id] = lt; });

    const parseProps = (raw: any): { count: number; raw: string } => {
      if (!raw) return { count: 0, raw: '' };
      if (typeof raw === 'object') return { count: Object.keys(raw).length, raw: JSON.stringify(raw, null, 2) };
      try {
        const parsed = JSON.parse(raw);
        return { count: Object.keys(parsed).length, raw: JSON.stringify(parsed, null, 2) };
      } catch {
        return { count: 0, raw: String(raw) };
      }
    };

    const objectsByType: Record<number, any[]> = {};
    objects.forEach((o: any) => {
      if (!objectsByType[o.object_type_id]) objectsByType[o.object_type_id] = [];
      objectsByType[o.object_type_id].push(o);
    });

    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    // Pre-defined layout from AI Modeling Wizard
    const layoutData = (window as any).__ontologyGraphLayout;
    const layoutNodes: Record<string, { x: number; y: number }> = {};
    if (layoutData?.nodes) {
      layoutData.nodes.forEach((n: any) => { layoutNodes[n.id] = { x: n.x || 400, y: n.y || 300 }; });
    }

    objectTypes.forEach((type: any) => {
      const instList = objectsByType[type.id] || [];
      const hasInstances = instList.length > 0;
      const color = TYPE_COLORS_WARM[(type.id - 1) % TYPE_COLORS_WARM.length];
      const layoutPos = layoutNodes[`__type__${type.name}`];
      nodes.push({
        id: `type::${type.id}`, label: type.name, group: 'typeHub', color, size: hasInstances ? 28 : 18,
        description: type.description || '', _typeId: type.id, _instanceCount: instList.length,
        x: layoutPos?.x, y: layoutPos?.y,
        // Mark empty typeHubs so the renderer can style them differently
        _hasInstances: hasInstances,
      });
    });

    objects.forEach((obj: any) => {
      const type = typeMap[obj.object_type_id];
      const color = type ? TYPE_COLORS_COOL[(obj.object_type_id - 1) % TYPE_COLORS_COOL.length] : '#888';
      const { count: propCount, raw: propRaw } = parseProps(obj.properties);
      const layoutPos = layoutNodes[obj.name];
      nodes.push({
        id: `obj::${obj.id}`, label: obj.name, group: 'instance', color, size: 11,
        description: String(obj.properties || ''), _objId: obj.id, _typeId: obj.object_type_id,
        _propsCount: propCount, _propsRaw: propRaw,
        x: layoutPos?.x, y: layoutPos?.y,
      });

      if (type) {
        links.push({ source: `obj::${obj.id}`, target: `type::${obj.object_type_id}`, color: 'rgba(255,255,255,0.45)', weight: 0.15 });
      }
    });

    const usedLinkTypeIds = new Set(rawLinks.map((l: any) => l.link_type_id));
    linkTypes.forEach((lt: any) => {
      if (!usedLinkTypeIds.has(lt.id)) return;
      nodes.push({ id: `linktype::${lt.id}`, label: lt.name, group: 'linkType', color: '#FFD166', size: 7, description: lt.description || '' });
    });

    rawLinks.forEach((link: any) => {
      links.push({
        source: `obj::${link.source_object_id}`, target: `obj::${link.target_object_id}`,
        color: '#FFD166', weight: Number(link.weight) || 0.5,
        _linkTypeId: link.link_type_id, _linkTypeName: linkTypeMap[link.link_type_id]?.name,
      });
    });

    actions.forEach((act: any) => {
      const statusColor = act.status === 'done' ? '#4CAF50' : '#FF9800';
      nodes.push({ id: `action::${act.id}`, label: act.name, group: 'action', color: statusColor, size: 6, description: act.description || '' });
      links.push({ source: `obj::${act.object_id}`, target: `action::${act.id}`, color: '#FF9CF7', weight: 0.2 });
    });

    const typeNames = objectTypes.map((t: any) => t.name);

    // Give every node a radial starting position so the force simulation
    // spreads the full dataset across the canvas immediately on render.
    // NOTE: actual positions are computed in the D3 useEffect using containerRef dimensions.
    const typeHubNodes = nodes.filter(n => n.group === 'typeHub');
    // Use a moderate default; real positions computed with actual W/H in the component useEffect
    computeInitialPositions(nodes, typeHubNodes, 800, 600, rawLinks);

    return { nodes, links, typeMap, linkTypeMap, typeNames };
  } catch (err) {
    console.error('[D3GraphView] Dynamic load failed:', err);
    return null;
  }
}

// ==================== Component ====================

const D3GraphView: React.FC<{ onRefreshRef?: (fn: () => void) => void }> = ({ onRefreshRef }) => {
  const { state } = useOntologyStore();
  const mapping = state.mapping;
  
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const collapsedRef = useRef<Set<string>>(new Set());
  const searchHighlightedRef = useRef<string[]>([]);
  const graphDataRef = useRef<GraphData | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const currentTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  // Stable refs for D3 selections used by keyboard handler
  const linkElsRef = useRef<d3.Selection<SVGLineElement, GraphLink, SVGGElement, unknown> | null>(null);
  const labelElsRef = useRef<d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null>(null);
  const allNodeGroupsRef = useRef<d3.Selection<SVGGElement, GraphNode, SVGGElement, unknown> | null>(null);

  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [d3Ready, setD3Ready] = useState(false);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [infoContent, setInfoContent] = useState('');
  const [searchIndex, setSearchIndex] = useState(-1);
  const [showControls, setShowControls] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [isAiFilling, setIsAiFilling] = useState(false);
  const [showAIFillInput, setShowAIFillInput] = useState(false);
  const [aiFillTopic, setAiFillTopic] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  // 1. D3 Physics Controls State — tuned for compact semantic layout
  const [chargeStrength, setChargeStrength] = useState(-150);
  const [linkDistance, setLinkDistance] = useState(60);
  const [collisionRadius, setCollisionRadius] = useState(6);

  // 2. Progressive Exploration (Focus Mode) State
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

  const refreshGraph = useCallback(async () => {
    setLoading(true);
    setD3Ready(false);
    const data = await loadDynamicGraphData(mapping);
    setGraphData(data);
    graphDataRef.current = data;
    setLoading(false);
  }, [mapping]);

  // Expose refreshGraph via callback prop so parent can trigger graph reload after CRUD
  useEffect(() => {
    if (onRefreshRef) onRefreshRef(refreshGraph);
  }, [onRefreshRef, refreshGraph]);

  // ── AI Graph Fill ──
  const handleAIFill = useCallback(async () => {
    if (!aiFillTopic.trim()) {
      setShowAIFillInput(true);
      return;
    }
    setIsAiFilling(true);
    try {
      const plan = await ontologyAiService.generateGraphLayout(aiFillTopic.trim());

      // Build GraphNode[] from AI plan
      const aiNodes: GraphNode[] = (plan.nodes || []).map((n) => ({
        id: n.id || `ai-${Math.random().toString(36).slice(2)}`,
        label: n.label,
        group: n.type || 'object',
        color: mapColor(n.color || 'blue'),
        size: n.type === 'action' ? 6 : n.type === 'object' ? 11 : 28,
        description: '',
      }));

      // Build GraphLink[] from AI plan
      const aiLinks: GraphLink[] = (plan.edges || []).map((e, i) => ({
        source: e.source,
        target: e.target,
        color: '#FFD166',
        weight: e.weight ?? 0.5,
        _linkTypeName: e.label,
      }));

      // Merge with existing or create new graphData
      setGraphData(prev => {
        const existing = prev || {
          nodes: [], links: [], typeMap: {}, linkTypeMap: {}, typeNames: []
        };
        const mergedNodes = [...existing.nodes, ...aiNodes];
        const mergedLinks = [...existing.links, ...aiLinks];
        return { ...existing, nodes: mergedNodes, links: mergedLinks };
      });

      setAiFillTopic('');
      setShowAIFillInput(false);
    } catch (err) {
      console.error('[D3GraphView] AI fill failed:', err);
      alert('AI 图谱生成失败，请检查 AI 配置');
    } finally {
      setIsAiFilling(false);
    }
  }, [aiFillTopic]);

  function mapColor(color: string): string {
    const map: Record<string, string> = {
      purple: '#a78bfa', blue: '#4CC9F0', green: '#4ade80',
      orange: '#fb923c', yellow: '#fbbf24', cyan: '#67e8f9', red: '#f87171',
    };
    return map[color] || '#94a3b8';
  }

  // Load data when DuckDB tables are ready
  useEffect(() => {
    if (state.initState === 'ready') {
      refreshGraph();
    }
  }, [refreshGraph, state.initState]);

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
      .on('zoom', e => { g.attr('transform', e.transform); currentTransformRef.current = e.transform; });
    svg.call(zoom).on('dblclick.zoom', null);
    zoomRef.current = zoom;
    svg.attr('style', 'display:block;cursor:grab;');
    svg.on('wheel', (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
    }, { passive: false });

    // Fit All — zoom to show all nodes with padding and minimum zoom
    (window as any).__d3FitAll = () => {
      const ns = graphDataRef.current?.nodes || [];
      if (ns.length === 0) return;
      const xs = ns.map(n => n.x || 0);
      const ys = ns.map(n => n.y || 0);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const bw = maxX - minX || 1, bh = maxY - minY || 1;
      // Add 20% padding on each side
      const paddedW = bw * 1.4, paddedH = bh * 1.4;
      // Minimum scale: 0.35 so graph is never too small to see
      const rawScale = Math.min(0.85 * W / paddedW, 0.85 * H / paddedH);
      const scale = Math.max(0.35, Math.min(rawScale, 4));
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const tx = W / 2 - centerX * scale;
      const ty = H / 2 - centerY * scale;
      svg.transition().duration(800)
        .call(zoom.transform as any, d3.zoomIdentity.translate(tx, ty).scale(scale));
    };

    if (!graphDataRef.current) {
      setD3Ready(true);
      return () => {
        const el = document.getElementById(styleId);
        if (el) el.remove();
        delete (window as any).__d3FitAll;
      };
    }

    if (graphDataRef.current.nodes.length === 0) {
      setD3Ready(true);
      return () => {
        const el = document.getElementById(styleId);
        if (el) el.remove();
      };
    }

    const data = graphDataRef.current;
    const nodes = data.nodes;
    const links = data.links;
    nodesRef.current = nodes;

    // Re-compute initial positions with actual canvas dimensions
    const typeHubNodes = nodes.filter(n => n.group === 'typeHub');
    computeInitialPositions(nodes, typeHubNodes, W, H, undefined);

    // Force Simulation
    const sim = d3.forceSimulation<GraphNode, GraphLink>(nodes)
      .alpha(0.8)
      .alphaDecay(0.04)
      .force('link', d3.forceLink<GraphNode, GraphLink>(links).id(d => d.id).distance(d => {
        const s = d as any;
        if (s._linkTypeId !== undefined) return linkDistance * 1.5;
        if (s.source?.group === 'typeHub' || s.target?.group === 'typeHub') return linkDistance * 2.25;
        return linkDistance;
      }).strength(0.4))
      .force('charge', d3.forceManyBody().strength(chargeStrength))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide<GraphNode>().radius(d => (d.size || 10) + collisionRadius))
      .force('x', d3.forceX(W / 2).strength(0.15))
      .force('y', d3.forceY(H / 2).strength(0.15));
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
      .enter()
      .append('line');

    linkEls
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

    linkElsRef.current = linkEls;

    let enforceInterval = setInterval(() => {
      d3.selectAll<SVGLineElement, GraphLink>('.nv-link-instance')
        .style('stroke', '#FFD166').style('opacity', '0.88');
    }, 1500);

    // Viewport culling: skip rendering updates for nodes far outside visible area.
    // With many nodes, this reduces DOM operations significantly.
    const VISIBLE_BUFFER = 300; // px beyond viewport edge to pre-render
    const getVisibleNodes = (ns: GraphNode[], transform: d3.ZoomTransform, W: number, H: number) => {
      const [x0, y0] = transform.invert([0, 0]);
      const [x1, y1] = transform.invert([W, H]);
      return ns.filter(n => {
        const nx = n.x || 0, ny = n.y || 0;
        return nx >= x0 - VISIBLE_BUFFER && nx <= x1 + VISIBLE_BUFFER
            && ny >= y0 - VISIBLE_BUFFER && ny <= y1 + VISIBLE_BUFFER;
      });
    };

    // Throttle tick to ~30fps to avoid blocking the main thread with large graphs
    const TICK_THROTTLE_MS = 33;
    let lastTickTime = 0;
    let pendingTick = false;

    const nodeContainer = g.append('g').attr('class', 'nv-nodes');
    const instanceNodes = nodes.filter(d => d.group === 'instance');
    const actionNodes = nodes.filter(d => d.group === 'action');

    // Drag — STICKY; stopPropagation prevents SVG zoom from stealing events
    const dragstarted = (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
      event.sourceEvent.stopPropagation();
      if (!event.active) sim.alphaTarget(0.3).restart();
      d.fx = d.x; d.fy = d.y;
    };
    const dragged = (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
      event.sourceEvent.stopPropagation();
      d.fx = event.x; d.fy = event.y;
    };
    const dragended = (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, _d: GraphNode) => {
      event.sourceEvent.stopPropagation();
      if (!event.active) sim.alphaTarget(0);
    };

    // Type Hub nodes
    const typeHubG = nodeContainer.selectAll<SVGGElement, GraphNode>('.nv-typehub')
      .data(typeHubNodes)
      .enter().append('g')
      .attr('class', 'nv-typehub nv-node')
      .style('cursor', 'move')
      .call(d3.drag<SVGGElement, GraphNode>().on('start', dragstarted).on('drag', dragged).on('end', dragended));
    typeHubG.append('circle').attr('r', (d: GraphNode) => (d.size || 28) + 6)
      .style('fill', 'none').style('stroke', (d: GraphNode) => d.color)
      .style('stroke-width', 1.5)
      .style('opacity', (d: GraphNode) => d._hasInstances !== false ? 0.35 : 0.15)
      .style('pointer-events', 'none');
    typeHubG.append('circle').attr('r', (d: GraphNode) => d.size || 28)
      .style('fill', (d: GraphNode) => d.color)
      .style('stroke', 'rgba(255,255,255,0.6)').style('stroke-width', 2)
      .style('opacity', (d: GraphNode) => d._hasInstances !== false ? 0.92 : 0.45)
      .style('pointer-events', 'all');
    typeHubG.append('path').attr('d', ICON_HEXAGON).attr('class', 'nv-icon-typehub')
      .attr('transform', 'scale(1.6) translate(0, 1)')
      .style('opacity', (d: GraphNode) => d._hasInstances !== false ? 1 : 0.5);

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
    const LABEL_MAX = 18;
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
    labelElsRef.current = labelEls;

    // Link type labels on edges: show description (VALUE), tooltip shows name + weight (KEY)
    const linkLabelGroup = g.append('g').attr('class', 'nv-link-labels');
    const linkLabelEls = linkLabelGroup.selectAll<SVGTextElement, GraphLink>('text')
      .data(links.filter(l => l._linkTypeId !== undefined))
      .enter().append('text').attr('class', 'nv-linktype-label')
      .text((d: GraphLink) => {
        // Show description on edge label; fall back to name; never show empty
        const lt = data.linkTypeMap[d._linkTypeId as number];
        const label = lt?.description || d._linkTypeName || '';
        if (label.length >= 2) {
          return label.length > 12 ? label.slice(0, 12) + '…' : label;
        }
        // description is empty/1-char → show a visual placeholder so the edge is not blank
        return '—';
      })
      .each(function(d: GraphLink) {
        const lt = data.linkTypeMap[d._linkTypeId as number];
        const name = lt?.name || d._linkTypeName || '';
        d3.select(this).append('title')
          .text(`关系: ${name}\n强度: ${Number(d.weight).toFixed(2)}`);
      });

    // TICK — throttled to ~30fps to avoid frame drops on large graphs
    const tickThrottled = () => {
      const now = performance.now();
      if (now - lastTickTime < TICK_THROTTLE_MS) {
        pendingTick = true;
        return;
      }
      lastTickTime = now;
      pendingTick = false;

      const visibleNodes = getVisibleNodes(nodes, currentTransformRef.current, W, H);
      const visibleNodeIds = new Set(visibleNodes.map(n => n.id));

      linkEls
        .style('display', (d: GraphLink) => {
          const sId = typeof d.source === 'object' ? (d.source as GraphNode).id : d.source;
          const tId = typeof d.target === 'object' ? (d.target as GraphNode).id : d.target;
          return (visibleNodeIds.has(String(sId)) || visibleNodeIds.has(String(tId))) ? null : 'none';
        })
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
    };

    // Flush any pending tick when simulation pauses
    sim.on('tick.throttled', tickThrottled);
    sim.on('end.throttled', () => {
      if (pendingTick) {
        pendingTick = false;
        lastTickTime = 0;
        tickThrottled();
      }
    });

    // Trigger fit-all AFTER simulation settles — not at a fixed timeout.
    // The sim's 'end' event fires when alpha reaches near-zero.
    sim.on('end', () => {
      (window as any).__d3FitAll?.();
    });

    // Event handlers
    const allNodeGroups = nodeContainer.selectAll<SVGGElement, GraphNode>('g.nv-node');
    allNodeGroupsRef.current = allNodeGroups;
    allNodeGroups.on('click', (event: MouseEvent, d: GraphNode) => {
      event.stopPropagation();
      setSelectedNode(d);
      highlightSelectedNode(d.id, nodes, linkEls, labelEls, allNodeGroups);
      showNodeInfo(d, data);
      (window as any).__currentNodeId = d.id;
    });
    allNodeGroups.on('dblclick', (event: MouseEvent, d: GraphNode) => {
      event.stopPropagation();
      setFocusedNodeId(d.id);
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
      setFocusedNodeId(null);
      (window as any).__currentNodeId = null;
      resetHighlights(nodes, linkEls, labelEls, allNodeGroups);
    });

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

  // Dynamic Simulation Physics Updates
  useEffect(() => {
    if (!simulationRef.current) return;
    const sim = simulationRef.current;
    
    // Update forces
    const chargeForce = sim.force('charge') as d3.ForceManyBody<GraphNode> | undefined;
    if (chargeForce) chargeForce.strength(chargeStrength);

    const collisionForce = sim.force('collision') as d3.ForceCollide<GraphNode> | undefined;
    if (collisionForce) collisionForce.radius(d => (d.size || 10) + collisionRadius);

    const linkForce = sim.force('link') as d3.ForceLink<GraphNode, GraphLink> | undefined;
    if (linkForce) {
      linkForce.distance(d => {
        const s = d as any;
        if (s._linkTypeId !== undefined) return linkDistance * 1.5;
        if (s.source?.group === 'typeHub' || s.target?.group === 'typeHub') return linkDistance * 2.25;
        return linkDistance;
      });
    }

    sim.alpha(0.3).restart();
  }, [chargeStrength, linkDistance, collisionRadius]);

  // Focus Mode Visual Updates
  useEffect(() => {
    if (!svgRef.current || !graphData) return;
    const svg = d3.select(svgRef.current);
    
    if (!focusedNodeId) {
      svg.selectAll('.nv-node, .nv-link-instance, .nv-link-typeinst, .nv-link-action, .nv-node-label, .nv-linktype-label')
         .classed('nv-dim', false)
         .classed('nv-dim-label', false);
      return;
    }

    const connectedIds = new Set<string>();
    connectedIds.add(focusedNodeId);
    
    graphData.links.forEach(l => {
      const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
      const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
      if (sId === focusedNodeId) connectedIds.add(tId);
      if (tId === focusedNodeId) connectedIds.add(sId);
    });

    svg.selectAll('.nv-node').classed('nv-dim', (d: any) => !connectedIds.has(d.id));
    svg.selectAll('.nv-node-label').classed('nv-dim-label', (d: any) => !connectedIds.has(d.id));
    
    svg.selectAll('.nv-link-instance, .nv-link-typeinst, .nv-link-action').classed('nv-dim', (l: any) => {
      const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
      const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
      return sId !== focusedNodeId && tId !== focusedNodeId;
    });
    
    svg.selectAll('.nv-linktype-label').classed('nv-dim-label', (l: any) => {
      const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
      const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
      return sId !== focusedNodeId && tId !== focusedNodeId;
    });

  }, [focusedNodeId, graphData]);

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

  // Keyboard shortcuts: Alt+C/I/L/S, Escape, Arrow navigation, +/-
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
      // Zoom shortcuts (no modifier needed when graph is focused)
      if (e.key === '=' || e.key === '+') { e.preventDefault(); zoomIn(); }
      if (e.key === '-') { e.preventDefault(); zoomOut(); }
      if (e.key === '0') { e.preventDefault(); fitAll(); }
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
  const resetLayout = () => {
    if (!simulationRef.current || !containerRef.current) return;
    const sim = simulationRef.current;
    nodesRef.current.forEach(n => { n.fx = null; n.fy = null; });
    const data = graphDataRef.current;
    if (data) {
      const typeHubNodes = data.nodes.filter(n => n.group === 'typeHub');
      const W = containerRef.current.clientWidth;
      const H = containerRef.current.clientHeight;
      computeInitialPositions(data.nodes, typeHubNodes, W, H, undefined);
    }
    sim.alpha(1).restart();
    sim.on('end', () => { (window as any).__d3FitAll?.(); });
  };
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
  // Monokai-inspired palette for D3 overlay panels
  const panelBase: React.CSSProperties = {
    background: 'rgba(39,40,34,0.92)', border: '1px solid rgba(245,239,224,0.12)', borderRadius: 8,
    fontSize: 12, fontFamily: 'Arial,sans-serif', color: '#f8f8f2',
  };
  const btnStyle: React.CSSProperties = {
    background: 'rgba(39,40,34,0.88)', color: '#f8f8f2', border: '1px solid rgba(245,239,224,0.12)',
    padding: '3px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 11,
  };
  const panelBtnStyle: React.CSSProperties = { ...btnStyle };

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: '100%',
        background: 'radial-gradient(circle at center, #2d2a23 0%, #1e1b16 60%, #0f0e0b 100%)',
        position: 'relative', overflow: 'hidden',
      }}
    >
      <svg
        ref={svgRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
        role="img"
        aria-label={`知识图谱可视化：${stats.nodes} 个节点，${stats.links} 条关系连线。方向键浏览节点，+/- 缩放，0 重置视角。`}
        tabIndex={0}
        onKeyDown={(e: React.KeyboardEvent) => {
          const ag = allNodeGroupsRef.current;
          const lg = linkElsRef.current;
          const lb = labelElsRef.current;
          if (!ag || !lg || !lb) return;

          if (e.key.startsWith('Arrow')) {
            e.preventDefault();
            const activeId = document.activeElement?.getAttribute('data-node-id');
            const currentIdx = activeId
              ? nodesRef.current.findIndex(n => String(n.id) === activeId)
              : -1;
            const dirMap: Record<string, 1 | -1> = {
              ArrowUp: -1, ArrowDown: 1,
              ArrowLeft: -1, ArrowRight: 1,
            };
            const dir = dirMap[e.key] ?? 1;
            const nextIdx = (currentIdx + dir + nodesRef.current.length) % Math.max(1, nodesRef.current.length);
            const next = nodesRef.current[nextIdx];
            if (next) {
              ag.filter((d: GraphNode) => d.id === next.id).nodes().forEach(n => {
                (n as unknown as HTMLElement).focus();
                n.setAttribute('data-node-id', String(next.id));
              });
              setSelectedNode(next);
              highlightSelectedNode(next.id, nodesRef.current, lg, lb, ag);
              showNodeInfo(next, graphDataRef.current);
              setFocusedNodeId(next.id);
            }
            return;
          }
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const activeId = document.activeElement?.getAttribute('data-node-id');
            if (activeId) {
              const node = nodesRef.current.find(n => String(n.id) === activeId);
              if (node) {
                toggleNodeCollapse(node.id, nodesRef.current, graphDataRef.current?.links || [], ag, lb, lg, collapsedRef.current);
              }
            }
          }
          if (e.key === 'Escape') {
            setSelectedNode(null);
            setFocusedNodeId(null);
            resetHighlights(nodesRef.current, lg, lb, ag);
          }
        }}
      />

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
            <div style={{ fontSize: 13, color: '#aaa', maxWidth: 400, lineHeight: 1.7, marginBottom: 12 }}>
              请先在左侧 <strong style={{ color: '#4CAF50' }}>MECE 面板</strong>的「基础层」创建类型和实例，<br />
              或执行「一键初始化」导入种子数据，图谱将自动更新。
            </div>

            {/* AI Fill Topic Input */}
            {showAIFillInput && (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16, pointerEvents: 'all' }}>
                <input
                  autoFocus
                  value={aiFillTopic}
                  onChange={e => setAiFillTopic(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAIFill(); if (e.key === 'Escape') setShowAIFillInput(false); }}
                  placeholder="输入图谱主题，如：电商订单领域"
                  style={{
                    padding: '6px 12px', borderRadius: 8, border: '1px solid #a78bfa',
                    background: 'rgba(0,0,0,0.4)', color: '#fff', fontSize: 12, width: 260,
                    outline: 'none',
                  }}
                />
                <button onClick={handleAIFill} disabled={isAiFilling} style={{ ...btnStyle, padding: '6px 14px', borderColor: '#a78bfa', color: '#a78bfa' }}>
                  {isAiFilling ? <Loader2 className="inline w-3.5 h-3.5 animate-spin" style={{ verticalAlign: 'middle' }} /> : <Sparkles className="inline w-3.5 h-3.5" style={{ verticalAlign: 'middle' }} />}
                </button>
                <button onClick={() => setShowAIFillInput(false)} style={{ ...btnStyle, padding: '6px 10px' }}>✕</button>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', pointerEvents: 'all' }}>
              <button onClick={handleAIFill} disabled={isAiFilling} style={{ ...btnStyle, padding: '6px 16px', fontSize: 12, borderColor: '#a78bfa', color: '#a78bfa' }}>
                {isAiFilling ? <><Loader2 className="inline w-3.5 h-3.5 mr-1 animate-spin" style={{ verticalAlign: 'middle' }} /> AI 构思中...</> : <><Sparkles className="inline w-3.5 h-3.5 mr-1" style={{ verticalAlign: 'middle' }} /> AI 图谱生成</>}
              </button>
              <button onClick={refreshGraph} style={{ ...btnStyle, padding: '6px 16px', fontSize: 12 }}>
                <RefreshCw className="inline w-3.5 h-3.5 mr-1" style={{ verticalAlign: 'middle' }} />
                刷新图谱
              </button>
              <button onClick={downloadCSV} style={{ ...btnStyle, padding: '6px 16px', fontSize: 12, borderColor: '#4CAF50' }}>
                导出 CSV
              </button>
              <button onClick={downloadExcelFile} style={{ ...btnStyle, padding: '6px 16px', fontSize: 12, borderColor: 'rgba(166,226,46,0.4)', color: '#50fa7b', background: 'rgba(39,40,34,0.88)' }}>
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
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setShowHelp(!showHelp)} title="使用指南" style={{ ...panelBtnStyle, padding: '3px 8px', borderColor: showHelp ? 'rgba(99,102,241,0.5)' : undefined, color: showHelp ? '#a5b4fc' : undefined }}>
                <HelpCircle className="inline w-3.5 h-3.5" style={{ verticalAlign: 'middle' }} />
              </button>
              <button onClick={() => setShowControls(false)} style={panelBtnStyle}>隐藏</button>
            </div>
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
          {/* AI Fill Topic Input (when controls panel is open) */}
          {showAIFillInput && (
            <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
              <input
                autoFocus
                value={aiFillTopic}
                onChange={e => setAiFillTopic(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAIFill(); if (e.key === 'Escape') setShowAIFillInput(false); }}
                placeholder="输入图谱主题，回车确认"
                style={{
                  flex: 1, padding: '5px 10px', borderRadius: 6,
                  border: '1px solid #a78bfa', background: 'rgba(0,0,0,0.4)',
                  color: '#fff', fontSize: 11, outline: 'none',
                }}
              />
              <button onClick={handleAIFill} disabled={isAiFilling} style={{ ...btnStyle, padding: '5px 10px', borderColor: '#a78bfa', color: '#a78bfa' }}>
                {isAiFilling ? <Loader2 className="inline w-3 h-3 animate-spin" style={{ verticalAlign: 'middle' }} /> : <Sparkles className="inline w-3 h-3" style={{ verticalAlign: 'middle' }} />}
              </button>
              <button onClick={() => setShowAIFillInput(false)} style={{ ...btnStyle, padding: '5px 8px' }}>✕</button>
            </div>
          )}

          <div style={{ display: 'flex', gap: 5, marginTop: 10, flexWrap: 'wrap' }}>
            <button onClick={fitAll} style={{ ...btnStyle, flex: 1, borderColor: '#4CAF50', color: '#4CAF50' }}>Fit All</button>
            <button onClick={resetLayout} style={{ ...btnStyle, flex: 1, borderColor: '#F9A825', color: '#F9A825' }}>重置布局</button>
            <button onClick={zoomIn} style={{ ...btnStyle, flex: 1 }}>放大</button>
            <button onClick={zoomOut} style={{ ...btnStyle, flex: 1 }}>缩小</button>
          </div>
          <div style={{ display: 'flex', gap: 5, marginTop: 5 }}>
            <button onClick={() => { setShowAIFillInput(true); }} style={{ ...btnStyle, flex: 1, borderColor: '#a78bfa', color: '#a78bfa' }}>
              <Sparkles className="inline w-3.5 h-3.5 mr-1" style={{ verticalAlign: 'middle' }} />
              AI 图谱生成
            </button>
            <button onClick={refreshGraph} style={{ ...btnStyle, flex: 1 }}>
              <RefreshCw className="inline w-3.5 h-3.5 mr-1" style={{ verticalAlign: 'middle' }} />
              刷新数据
            </button>
            {focusedNodeId && (
              <button onClick={() => setFocusedNodeId(null)} style={{ ...btnStyle, flex: 1, background: '#E76F51', borderColor: '#E76F51' }}>
                ✕ 退出降噪聚焦
              </button>
            )}
          </div>
          
          {/* Physics Engine Controls */}
          <div style={{ marginTop: 10, borderTop: '1px solid #333', paddingTop: 8 }}>
            <strong style={{ fontSize: 11 }}>物理力场调节</strong>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', fontSize: 10, gap: 8 }}>
                <span style={{ width: 50, color: '#888' }}>向心力</span>
                <input type="range" min="20" max="300" value={linkDistance} onChange={e => setLinkDistance(Number(e.target.value))} style={{ flex: 1, accentColor: '#FFD166', height: 4 }} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', fontSize: 10, gap: 8 }}>
                <span style={{ width: 50, color: '#888' }}>排斥力</span>
                <input type="range" min="-1000" max="-10" value={chargeStrength} onChange={e => setChargeStrength(Number(e.target.value))} style={{ flex: 1, accentColor: '#4CC9F0', height: 4 }} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', fontSize: 10, gap: 8 }}>
                <span style={{ width: 50, color: '#888' }}>防拥挤</span>
                <input type="range" min="0" max="50" value={collisionRadius} onChange={e => setCollisionRadius(Number(e.target.value))} style={{ flex: 1, accentColor: '#FF9CF7', height: 4 }} />
              </label>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => { setLinkDistance(80); setChargeStrength(-250); setCollisionRadius(8); }} style={{ ...btnStyle, fontSize: 9, padding: '2px 6px', opacity: 0.8 }}>复位力场</button>
              </div>
            </div>
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
                  flex: 1, padding: '4px 8px', border: '1px solid rgba(245,239,224,0.15)', borderRadius: 6,
                  background: 'rgba(39,40,34,0.88)', color: '#f8f8f2', fontSize: 11, outline: 'none',
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
            <button onClick={downloadExcelFile} style={{ ...btnStyle, borderColor: 'rgba(166,226,46,0.4)', width: '100%', textAlign: 'center', color: '#50fa7b', background: 'rgba(39,40,34,0.88)' }}>
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
            
            {/* Rendering Limits Warning */}
            {(stats.nodes > 800 || stats.links > 1500) && (
              <div style={{ background: 'rgba(255, 69, 58, 0.15)', border: '1px solid rgba(255, 69, 58, 0.4)', borderRadius: 4, padding: '8px', margin: '10px 0', fontSize: 10.5, color: '#ff453a', lineHeight: 1.5 }}>
                <strong style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                  ⚠️ 渲染极限警戒
                </strong>
                当前图谱量级极速逼近浏览器 GPU 上限。为了避免交互卡屏，系统已为您限制部分力学计算。遇到抖动请谨慎拉拽，推荐退回表格检索或在局部子图使用 Focus 聚焦模式。
              </div>
            )}

            <div style={{ borderTop: '1px solid #333', paddingTop: 8, marginTop: 8 }}>
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
            { color: TYPE_COLORS_WARM[0], r: 8, label: '类型集 (TypeHub: 六边形枢纽)' },
            { color: TYPE_COLORS_COOL[0], r: 5, label: '落地实例 (Instance: 正方形框)' },
            { color: '#FF6B35', r: 3, label: '已完成进度/行动' },
            { color: '#FF9800', r: 3, label: '待处理队列' },
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
          background: 'rgba(39,40,34,0.88)', border: '1px solid rgba(245,239,224,0.15)', borderRadius: 6,
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
            style={{ background: 'rgba(39,40,34,0.97)', border: '1px solid rgba(245,239,224,0.15)', borderRadius: 8, padding: 20, maxWidth: '80vw', maxHeight: '80vh', overflow: 'auto', color: '#f8f8f2', fontFamily: 'monospace', fontSize: 11 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <strong style={{ fontSize: 14 }}>本体图谱原始数据</strong>
              <button onClick={() => setShowScanModal(false)} style={panelBtnStyle}>关闭</button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <strong>类型 ({graphData.typeNames.length})</strong>
              <pre style={{ background: 'rgba(13,13,11,0.95)', padding: 8, borderRadius: 4, maxHeight: 200, overflow: 'auto', fontSize: 10 }}>
                {JSON.stringify(graphData.typeNames.map((n, i) => ({ id: i + 1, name: n })), null, 2)}
              </pre>
            </div>
            <div style={{ marginBottom: 12 }}>
              <strong>节点 ({graphData.nodes.length})</strong>
              <pre style={{ background: 'rgba(13,13,11,0.95)', padding: 8, borderRadius: 4, maxHeight: 300, overflow: 'auto', fontSize: 10 }}>
                {JSON.stringify(graphData.nodes, null, 2)}
              </pre>
            </div>
            <div>
              <strong>连线 ({graphData.links.length})</strong>
              <pre style={{ background: 'rgba(13,13,11,0.95)', padding: 8, borderRadius: 4, maxHeight: 300, overflow: 'auto', fontSize: 10 }}>
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
          <div style={{ background: 'rgba(39,40,34,0.96)', border: '1px solid rgba(245,239,224,0.12)', borderRadius: 8, padding: '16px 32px', textAlign: 'center' }}>
            <div style={{ color: '#ccc', marginBottom: 8, fontSize: 13 }}>加载本体论图谱...</div>
            <div style={{ width: 160, height: 4, background: '#333', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#00BFFF', width: '60%', animation: 'nv-pulse 1s ease-in-out infinite alternate' }} />
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes nv-pulse { from { width: 20%; } to { width: 80%; } }`}</style>

      {showHelp && (
        <CanvasHelpPanel
          config={{ type: 'graph' }}
          onClose={() => setShowHelp(false)}
        />
      )}
    </div>
  );
};

export default D3GraphView;
