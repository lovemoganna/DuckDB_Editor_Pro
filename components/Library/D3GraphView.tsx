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
import { RefreshCw, Sparkles, Loader2, HelpCircle, Trash2, AlertTriangle } from 'lucide-react';
import { duckDBService } from '../../services/duckdbService';
import { ontologyAiService } from '../../services/ontologyAiService';
import { encodeCSV, downloadExcel } from '../../utils/exportUtils';
import { ontologyActions, useOntologyStore } from '../../hooks/useOntologyStore';
import { CanvasHelpPanel } from '../skills/CanvasHelpPanel';
import { ToastNotification } from '../ui/ToastNotification';
import {
  aggregateParallelEdges,
  buildGraphDataFromState,
  computeEdgeGroupOffsets,
} from './D3GraphView/D3GraphView.data';
import { getSourceNode, getTargetNode } from './D3GraphView/D3GraphView.helpers';
import { computeInitialPositions, applyDagreLayout, applyConcentricLayout, applyStarburstLayout, applyDandelionLayout, applySpokeLayout, applyGridLayout, applyGroupedCircularLayout, applyVerticalTreeLayout, applyHorizontalTreeLayout } from './D3GraphView/D3GraphView.layout';
import { LINKTYPE_COLORS, LINKTYPE_DASH } from './D3GraphView/D3GraphView.types';
import {
  ScopeMode,
  buildReadableSubgraph,
  getNodeDegreeMap,
  pickDefaultFocusNode,
} from './D3GraphView/D3GraphView.focus';
import {
  ICON_HEXAGON,
  ICON_BOX,
  ICON_BOLT,
  TYPE_COLORS_WARM,
  TYPE_COLORS_COOL,
  TYPE_COLORS,
} from './D3GraphView/D3GraphView.visuals';
import type {
  LifeObjectType,
  LifeObject,
  LifeLinkType,
  LifeLink,
  LifeAction,
  GraphNode,
  GraphLink,
  GraphData,
} from './D3GraphView/D3GraphView.types';

// ==================== Initial Layout ====================

async function loadDynamicGraphData(mapping: any, storeState?: any): Promise<GraphData | null> {
  try {
    const objectFields = mapping.objectFields || {};
    const objIdCol = objectFields.id || 'id';
    const objNameCol = objectFields.name || 'name';
    const objTypeCol = objectFields.object_type_id || 'object_type_id';
    const objPropsCol = objectFields.properties || 'properties';
    const objAnnoCol = objectFields.annotations || 'annotations';

    const linkFields = mapping.linkFields || {};
    const linkIdCol = linkFields.id || 'id';
    const linkTypeCol = linkFields.link_type_id || 'link_type_id';
    const linkSrcCol = linkFields.source_object_id || 'source_object_id';
    const linkTgtCol = linkFields.target_object_id || 'target_object_id';
    const linkWeightCol = linkFields.weight || 'weight';

    const [objectTypes, objects, linkTypes, rawLinks, actions] = await Promise.all([
      duckDBService.query(`SELECT * FROM ${mapping.objectTypeTable} ORDER BY id`),
      duckDBService.query(`SELECT 
        "${objIdCol}" as id, 
        "${objTypeCol}" as object_type_id, 
        "${objNameCol}" as name, 
        "${objPropsCol}" as properties, 
        "${objAnnoCol}" as annotations 
        FROM ${mapping.objectTable} ORDER BY id`),
      duckDBService.query(`SELECT * FROM ${mapping.linkTypeTable} ORDER BY id`),
      duckDBService.query(`SELECT 
        "${linkIdCol}" as id, 
        "${linkTypeCol}" as link_type_id, 
        "${linkSrcCol}" as source_object_id, 
        "${linkTgtCol}" as target_object_id, 
        "${linkWeightCol}" as weight 
        FROM ${mapping.linkTable} ORDER BY id`),
      duckDBService.query(`SELECT * FROM ${mapping.actionTable} ORDER BY id`),
    ]);

    console.log('[D3GraphView] Tables loaded:', {
      types: objectTypes.length, objects: objects.length,
      linkTypes: linkTypes.length, rawLinks: rawLinks.length, actions: actions.length,
    });

    if (objects.length === 0) {
      // DuckDB returned empty — try store state as fallback
      if (storeState) {
        const storeData = buildGraphDataFromState(storeState, mapping);
        if (storeData) {
          console.log('[D3GraphView] DuckDB empty, using store state fallback:', storeData.nodes.length, 'nodes');
          return storeData;
        }
      }
      return { nodes: [], links: [], typeMap: {}, linkTypeMap: {}, typeNames: [] };
    }

    const typeMap: Record<number, any> = {};
    objectTypes.forEach((t: any) => {
      const tId = Number(t.id);
      typeMap[tId] = { ...t, id: tId };
    });
    const linkTypeMap: Record<number, any> = {};
    linkTypes.forEach((lt: any) => {
      const ltId = Number(lt.id);
      linkTypeMap[ltId] = { ...lt, id: ltId };
    });

    const parseProps = (raw: any): { count: number; raw: string } => {
      if (!raw) return { count: 0, raw: '' };
      
      let jsonStr = '';
      if (raw instanceof Uint8Array) {
        try { jsonStr = new TextDecoder().decode(raw); } 
        catch { jsonStr = String(raw); }
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
    };

    const objectsByType: Record<number, any[]> = {};
    objects.forEach((o: any) => {
      const typeId = Number(o.object_type_id);
      if (!objectsByType[typeId]) objectsByType[typeId] = [];
      objectsByType[typeId].push(o);
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
      const typeId = Number(type.id);
      const instList = objectsByType[typeId] || [];
      const hasInstances = instList.length > 0;
      const color = TYPE_COLORS_WARM[(typeId - 1) % TYPE_COLORS_WARM.length];
      const layoutPos = layoutNodes[`__type__${type.name}`];
      nodes.push({
        id: `type::${typeId}`, label: type.name, group: 'typeHub', color, size: hasInstances ? 28 : 18,
        description: type.description || '', _typeId: typeId, _instanceCount: instList.length,
        x: layoutPos?.x, y: layoutPos?.y,
        // Mark empty typeHubs so the renderer can style them differently
        _hasInstances: hasInstances,
      });
    });

    objects.forEach((obj: any) => {
      const objId = Number(obj.id);
      const typeId = Number(obj.object_type_id);
      const type = typeMap[typeId];
      const color = type ? TYPE_COLORS_COOL[(typeId - 1) % TYPE_COLORS_COOL.length] : '#888';
      const { count: propCount, raw: propRaw } = parseProps(obj.properties);
      const layoutPos = layoutNodes[obj.name];
      nodes.push({
        id: `obj::${objId}`, label: obj.name, group: 'instance', color, size: 11,
        description: propRaw, _objId: objId, _typeId: typeId,
        _propsCount: propCount, _propsRaw: propRaw,
        x: layoutPos?.x, y: layoutPos?.y,
      });

      if (type) {
        links.push({ source: `obj::${objId}`, target: `type::${typeId}`, color: 'rgba(255,255,255,0.45)', weight: 0.15, _isTypeInstLink: true });
      }
    });

    rawLinks.forEach((link: any) => {
      const linkTypeId = Number(link.link_type_id);
      const srcId = Number(link.source_object_id);
      const tgtId = Number(link.target_object_id);
      const ltColor = LINKTYPE_COLORS[(linkTypeId - 1) % LINKTYPE_COLORS.length];
      links.push({
        source: `obj::${srcId}`, target: `obj::${tgtId}`,
        color: ltColor, weight: Number(link.weight) || 0.5,
        _linkTypeId: linkTypeId, _linkTypeName: linkTypeMap[linkTypeId]?.name,
      });
    });

    actions.forEach((act: any) => {
      const actId = Number(act.id);
      const objId = Number(act.object_id);
      const statusColor = act.status === 'done' ? '#4CAF50' : '#FF9800';
      nodes.push({
        id: `action::${actId}`,
        label: act.name,
        group: 'action',
        color: statusColor,
        size: 6,
        description: act.description || '',
        _objId: objId,
      });
      links.push({ source: `obj::${objId}`, target: `action::${actId}`, color: '#FF9CF7', weight: 0.2 });
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

const D3GraphView: React.FC<{ onRefreshRef?: (fn: () => void) => void; ontologyState?: any; isActive?: boolean; onInspect?: (mode: any, target: any) => void }> = ({ onRefreshRef, ontologyState, isActive, onInspect }) => {
  const store = useOntologyStore();
  const state = ontologyState ?? store.state;
  const mapping = state.mapping;
  
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const collapsedRef = useRef<Set<string>>(new Set());
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [layoutMode, setLayoutMode] = useState<'force' | 'dagre' | 'concentric' | 'starburst' | 'dandelion' | 'spoke' | 'grid' | 'groupedCircular' | 'verticalTree' | 'horizontalTree'>('verticalTree');
  const searchHighlightedRef = useRef<string[]>([]);
  const graphDataRef = useRef<GraphData | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const rawLinksRef = useRef<any[]>([]);
  const currentTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  // Stable refs for D3 selections used by keyboard handler
  const linkElsRef = useRef<d3.Selection<SVGPathElement, GraphLink, SVGGElement, unknown> | null>(null);
  const labelElsRef = useRef<d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null>(null);
  const allNodeGroupsRef = useRef<d3.Selection<SVGGElement, GraphNode, SVGGElement, unknown> | null>(null);

  // Stable ref to latest state — avoids adding `state` object to useCallback deps
  // which would cause refreshGraph identity to change on every parent re-render
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // Debounce timer to coalesce rapid refreshGraph calls during seed switching
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blankCanvasResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const [isPanelHovered, setIsPanelHovered] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [isAiFilling, setIsAiFilling] = useState(false);
  const [showAIFillInput, setShowAIFillInput] = useState(false);
  const [aiFillTopic, setAiFillTopic] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: GraphNode } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [scopeMode, setScopeMode] = useState<ScopeMode>('all');
  const [clickToFocus, setClickToFocus] = useState(true);
  const [showWeakLinks, setShowWeakLinks] = useState(false);
  const [activeRelationTypes, setActiveRelationTypes] = useState<Set<number>>(new Set());
  const [fullGraphData, setFullGraphData] = useState<GraphData | null>(null);

  // 1. D3 Physics Controls State — tuned for compact semantic layout
  const [chargeStrength, setChargeStrength] = useState(-240);
  const [linkDistance, setLinkDistance] = useState(100);
  const [collisionRadius, setCollisionRadius] = useState(20);
  const [velocityDecay, setVelocityDecay] = useState(0.4);
  const [gravityStrength, setGravityStrength] = useState(0.2);
  const [linkStrength, setLinkStrength] = useState(0.5);

  // 2. Progressive Exploration (Focus Mode) State
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

  // 3. Link Weight Filter — hides weak relations (weight < threshold) by default
  const [weightThreshold, setWeightThreshold] = useState(0.65);

  // Synchronize local searchTerm with global ontology search state (e.g. Wiki selections)
  useEffect(() => {
    if (state?.search !== undefined) {
      setSearchTerm(state.search);
    }
  }, [state?.search]);

  // 4. Hover Tooltip State — rich card shown on node hover
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const hoveredNodeIdRef = useRef<string | null>(null);

  const activeHighlightIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeHighlightIdRef.current = selectedNode?.id || (scopeMode !== 'all' ? focusedNodeId : null);
  }, [selectedNode, focusedNodeId, scopeMode]);

  const clickToFocusRef = useRef(clickToFocus);
  useEffect(() => { clickToFocusRef.current = clickToFocus; }, [clickToFocus]);

  const applyHighlightStyles = useCallback((activeId: string | null) => {
    if (!svgRef.current || !graphDataRef.current) return;
    const svg = d3.select(svgRef.current);
    
    // Reset all selection classes first
    svg.selectAll('.nv-node')
       .classed('nv-highlight-node', false)
       .classed('nv-selected-pulse', false)
       .classed('nv-connected-node', false);
    svg.selectAll('.nv-node-label')
       .classed('nv-label-selected', false)
       .classed('nv-connected-label', false);

    if (!activeId) {
      svg.selectAll('.nv-node, .nv-link-instance, .nv-link-typeinst, .nv-link-action, .nv-node-label, .nv-linktype-label')
         .classed('nv-dim', false)
         .classed('nv-dim-label', false)
         .classed('nv-connected-node', false)
         .classed('nv-connected-label', false);
      svg.selectAll('.nv-link-instance, .nv-link-typeinst, .nv-link-action')
         .style('stroke', (l: any) => l.color)
         .style('stroke-width', (l: any) => {
           const w = Math.max(0.3, Math.min(1.0, l.weight ?? 0.5));
           return `${(1 + (w - 0.3) * 2.0).toFixed(2)}px`;
         })
         .style('opacity', (l: any) => {
           if (!showWeakLinks && l._linkTypeId !== undefined && l.weight < weightThreshold) return '0';
           const w = Math.max(0.3, Math.min(1.0, l.weight ?? 0.5));
           return (0.45 + (w - 0.3) * 0.79).toFixed(2);
         })
         .attr('marker-end', (l: any) => {
           if (l._linkTypeId !== undefined) return `url(#arrow-linktype-${l._linkTypeId})`;
           const nodesMap = new Map(nodesRef.current.map(n => [n.id, n]));
           const src = getSourceNode(l as any, nodesMap as any);
           const tgt = getTargetNode(l as any, nodesMap as any);
           if (src?.group === 'typeHub' || tgt?.group === 'typeHub') return null;
           return 'url(#arrow-amethyst)';
         });
      svg.selectAll('.nv-linktype-label')
         .style('opacity', scopeMode === 'all' ? '0' : '0.82');
      return;
    }

    const connectedIds = new Set<string>();
    connectedIds.add(activeId);
    
    graphDataRef.current.links.forEach(l => {
      const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
      const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
      if (sId === activeId) connectedIds.add(tId);
      if (tId === activeId) connectedIds.add(sId);
    });

    // 1. Nodes highlighting & dimming
    svg.selectAll('.nv-node')
       .classed('nv-dim', (d: any) => !connectedIds.has(d.id))
       .classed('nv-highlight-node', (d: any) => d.id === activeId)
       .classed('nv-connected-node', (d: any) => d.id !== activeId && connectedIds.has(d.id))
       .classed('nv-selected-pulse', (d: any) => d.id === activeId);
       
    svg.selectAll('.nv-node-label')
       .classed('nv-dim-label', (d: any) => !connectedIds.has(d.id))
       .classed('nv-connected-label', (d: any) => d.id !== activeId && connectedIds.has(d.id))
       .classed('nv-label-selected', (d: any) => d.id === activeId);
    
    // 2. Links highlighting & dimming
    const nodesMap = new Map(nodesRef.current.map(n => [n.id, n]));
    svg.selectAll('.nv-link-instance, .nv-link-typeinst, .nv-link-action')
      .classed('nv-dim', (l: any) => {
        const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
        const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
        return sId !== activeId && tId !== activeId;
      })
      .style('stroke', (l: any) => {
        const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
        const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
        if (sId === activeId || tId === activeId) return '#66d9ef';
        return l.color;
      })
      .style('stroke-width', (l: any) => {
        const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
        const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
        if (sId === activeId || tId === activeId) return '3px';
        const w = Math.max(0.3, Math.min(1.0, l.weight ?? 0.5));
        return `${(1 + (w - 0.3) * 2.0).toFixed(2)}px`;
      })
      .style('opacity', (l: any) => {
        const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
        const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
        if (sId === activeId || tId === activeId) return '1.0';
        return '0.08';
      })
      .attr('marker-end', (l: any) => {
        const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
        const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
        if (sId === activeId || tId === activeId) {
          return 'url(#arrow-highlight)';
        }
        if (l._linkTypeId !== undefined) return `url(#arrow-linktype-${l._linkTypeId})`;
        const src = getSourceNode(l as any, nodesMap as any);
        const tgt = getTargetNode(l as any, nodesMap as any);
        if (src?.group === 'typeHub' || tgt?.group === 'typeHub') return null;
        return 'url(#arrow-amethyst)';
      });
      
    svg.selectAll('.nv-linktype-label')
      .classed('nv-dim-label', (l: any) => {
        const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
        const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
        return sId !== activeId && tId !== activeId;
      })
      .style('opacity', (l: any) => {
        const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
        const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
        return sId === activeId || tId === activeId ? '1.0' : '0.0';
      });
  }, [scopeMode, showWeakLinks, weightThreshold]);

  const applyHighlightStylesRef = useRef(applyHighlightStyles);
  useEffect(() => {
    applyHighlightStylesRef.current = applyHighlightStyles;
  }, [applyHighlightStyles]);

  const resetBlankCanvasState = useCallback(() => {
    setSelectedNode(null);
    setFocusedNodeId(null);
    setHoveredNode(null);
    setContextMenu(null);
    setScopeMode('all');
    setCollapsedNodes(new Set());
    setSearchTerm('');
    store.dispatch?.(ontologyActions.setSearch(''));

    hoveredNodeIdRef.current = null;
    activeHighlightIdRef.current = null;
    searchHighlightedRef.current = [];
    (window as any).__currentNodeId = null;
    (window as any).__focusedNodeId = null;
    applyHighlightStylesRef.current(null);

    if (blankCanvasResetTimerRef.current) {
      clearTimeout(blankCanvasResetTimerRef.current);
    }
    blankCanvasResetTimerRef.current = setTimeout(() => {
      blankCanvasResetTimerRef.current = null;
      (window as any).__d3FitAll?.();
    }, 50);
  }, [store.dispatch]);

  useEffect(() => () => {
    if (blankCanvasResetTimerRef.current) {
      clearTimeout(blankCanvasResetTimerRef.current);
      blankCanvasResetTimerRef.current = null;
    }
  }, []);

  const refreshGraph = useCallback(async () => {
    // Read latest state from ref — keeps this callback identity stable
    const currentState = stateRef.current;
    const currentMapping = currentState.mapping;
    if (currentState.initting) {
      setLoading(true);
      return;
    }
    if (currentState.initState !== 'ready' || isActive === false) {
      setLoading(false);
      return;
    }
    console.log('[D3GraphView] refreshGraph called');
    setLoading(true);
    setD3Ready(false);
    try {
      const hasLoadedState =
        (currentState.objectTypes?.length ?? 0) > 0 ||
        (currentState.objects?.length ?? 0) > 0 ||
        (currentState.linkTypes?.length ?? 0) > 0 ||
        (currentState.links?.length ?? 0) > 0 ||
        (currentState.actions?.length ?? 0) > 0;
      const layoutDims = containerRef.current
        ? { svgW: containerRef.current.clientWidth, svgH: containerRef.current.clientHeight }
        : undefined;
      const data = hasLoadedState
        ? (buildGraphDataFromState(currentState, currentMapping, undefined, layoutDims) as GraphData | null)
        : await loadDynamicGraphData(currentMapping, currentState);
      if (!data) {
        console.log('[D3GraphView] loadDynamicGraphData returned null');
        setLoading(false);
        return;
      }
      // Also store rawLinks so the D3 useEffect can pass them to computeInitialPositions
      if (data._rawLinks) {
        rawLinksRef.current = data._rawLinks;
      } else {
        try {
          const rawLinks = await duckDBService.query(`SELECT * FROM ${currentMapping.linkTable} ORDER BY id`);
          rawLinksRef.current = rawLinks || [];
        } catch {
          rawLinksRef.current = [];
        }
      }
      setFullGraphData(data);
      setFocusedNodeId(prev => {
        const exists = prev && data.nodes.some(n => n.id === prev);
        return exists ? prev : null;
      });
    } catch (err) {
      console.error('[D3GraphView] Error in refreshGraph:', err);
    } finally {
      setLoading(false);
    }
  }, [isActive]);

  useEffect(() => {
    if (!fullGraphData) {
      setGraphData(null);
      graphDataRef.current = null;
      return;
    }
    const next = buildReadableSubgraph(
      fullGraphData,
      focusedNodeId,
      scopeMode,
      weightThreshold,
      showWeakLinks,
      activeRelationTypes,
      collapsedNodes,
    );
    setGraphData(next);
    graphDataRef.current = next;
  }, [fullGraphData, focusedNodeId, scopeMode, weightThreshold, showWeakLinks, activeRelationTypes, collapsedNodes]);

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
      setToast({ message: 'AI 图谱生成失败，请检查 AI 配置', type: 'error' });
    } finally {
      setIsAiFilling(false);
    }
  }, [aiFillTopic]);

  function mapColor(color: string): string {
    const map: Record<string, string> = {
      amethyst: '#ae81ff', blue: '#4CC9F0', green: '#4ade80',
      orange: '#fb923c', yellow: '#fbbf24', cyan: '#67e8f9', red: '#f87171',
    };
    return map[color] || '#94a3b8';
  }

  // ── Quick Clear: Delete all ontology data ──
  const handleQuickClear = useCallback(async () => {
    setShowClearConfirm(false);
    try {
      await duckDBService.query('DELETE FROM life_link');
      await duckDBService.query('DELETE FROM life_action');
      await duckDBService.query('DELETE FROM life_object');
      await duckDBService.query('DELETE FROM life_object_type');
      await duckDBService.query('DELETE FROM life_link_type');
      setGraphData(null);
      graphDataRef.current = null;
      setSelectedNode(null);
      setFocusedNodeId(null);
      setSearchTerm('');
      setInfoContent('');
    } catch (err) {
      console.error('[D3GraphView] Quick clear failed:', err);
      setToast({ message: '清空数据失败: ' + (err instanceof Error ? err.message : String(err)), type: 'error' });
    }
  }, []);

  const handleContextMenuDelete = useCallback(async (node: GraphNode) => {
    const parts = node.id.split('::');
    const prefix = parts[0];
    const idVal = Number(parts[1]);
    if (isNaN(idVal)) return;

    try {
      if (prefix === 'type') {
        await store.deleteObjectType(idVal);
        setToast({ message: `成功删除类型 "${node.label}"`, type: 'success' });
      } else if (prefix === 'obj') {
        await store.deleteObject(idVal);
        setToast({ message: `成功删除实例 "${node.label}"`, type: 'success' });
      } else if (prefix === 'action') {
        await store.deleteAction(idVal);
        setToast({ message: `成功删除行动 "${node.label}"`, type: 'success' });
      }
      setContextMenu(null);
      if (selectedNode?.id === node.id) setSelectedNode(null);
      if (focusedNodeId === node.id) setFocusedNodeId(null);
      await refreshGraph();
    } catch (err) {
      console.error('删除节点失败:', err);
      setToast({ message: '删除失败: ' + (err instanceof Error ? err.message : String(err)), type: 'error' });
    }
  }, [store, selectedNode, focusedNodeId, refreshGraph]);

  // Load data when DuckDB tables are ready — debounced to prevent cascading
  // re-renders during seed switching (SET_INITTING→SET_DATA→SET_ACTIVE_TAB)
  useEffect(() => {
    if (state.initState === 'ready' && !state.initting) {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        refreshGraph();
      }, 80);
    }
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [state.initState, state.initting, state.activeTemplateId, refreshGraph]);

  // Trigger refresh when tab becomes active (container is visible and has dimensions)
  useEffect(() => {
    if (isActive) {
      refreshGraph();
    }
  }, [isActive, refreshGraph]);

  // ==================== D3 Rendering ====================
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const W = container.clientWidth;
    const H = container.clientHeight;
    const svg = d3.select(svgRef.current).attr('width', W).attr('height', H);

    svg.selectAll('*').remove();

    // Scoped CSS — ui-ux-pro-max: restrained visual noise
    const styleId = 'nv-styles-' + Date.now();
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = `
      /* Link styles: subtle, no overwhelming animations */
      .nv-links path { fill: none; stroke-linecap: round; stroke-linejoin: round; }
      /* Weight-mapped thickness: 1px–4px across weight range, opacity 0.5–1.0 */
      .nv-link-instance { }
      .nv-link-typeinst  { stroke-width: 1px; opacity: 0.42; stroke-dasharray: 5 4; }
      .nv-link-action    { stroke-width: 1.6px; opacity: 0.78; stroke-dasharray: 3 3; }

      /* Node: clean, no persistent glow */
      .nv-node { cursor: move; }
      /* Hover: SVG-safe hover highlight using stroke instead of group drop-shadow to avoid browser rendering bugs */
      .nv-node:hover circle {
        stroke: #66d9ef !important;
        stroke-width: 2.5px !important;
        stroke-opacity: 1.0 !important;
      }
      .nv-typehub:hover circle {
        stroke: #66d9ef !important;
        stroke-width: 3.5px !important;
      }
      .nv-action:hover circle {
        stroke: #66d9ef !important;
        stroke-width: 2.0px !important;
      }

      /* Labels */
      .nv-node-label {
        font-size: 10px; font-weight: bold; fill: white;
        text-anchor: start; pointer-events: none;
        text-shadow: 0 0 3px rgba(0,0,0,0.9);
        stroke: #000; stroke-width: 0.5px; paint-order: stroke fill;
      }
      .nv-typehub-label { font-size: 12px !important; font-weight: 800 !important; }
      .nv-linktype-label {
        font-size: 7px !important; font-style: normal;
        font-weight: 600; letter-spacing: 0.3px;
        text-anchor: middle; pointer-events: none;
        text-shadow: 0 0 3px #000;
      }

      /* Search/select: highlight without heavy glow (SVG-safe) */
      .nv-highlight-node circle {
        stroke: #FFD166 !important;
        stroke-width: 3px !important;
        stroke-opacity: 1.0 !important;
      }
      .nv-dim { opacity: 0.28 !important; transition: opacity 0.25s ease !important; }
      .nv-dim-label { opacity: 0.22 !important; transition: opacity 0.25s ease !important; }
      .nv-node, .nv-links path, .nv-node-label, .nv-linktype-label {
        transition: opacity 0.25s ease, stroke-width 0.25s ease, stroke 0.25s ease, filter 0.25s ease;
      }
      .nv-is-dragging .nv-dim { opacity: 0.65 !important; }
      .nv-is-dragging .nv-dim-label { opacity: 0.5 !important; }
      .nv-label-selected { fill: #FFD166 !important; font-size: 13px !important; font-weight: bold !important; }
      .nv-label-match { fill: #4CC9F0 !important; }
      .nv-hidden { display: none !important; }
      .nv-svg { overflow: visible; }

      /* Connected nodes style */
      .nv-connected-node circle { stroke: #66d9ef !important; stroke-width: 2.5px !important; opacity: 1.0 !important; }
      .nv-connected-label { fill: #66d9ef !important; font-size: 11px !important; font-weight: bold !important; opacity: 1.0 !important; }

      /* Selected node: gentle pulse on the stroke (no group drop-shadow to avoid Chromium layout bugs) */
      .nv-selected-pulse circle {
        animation: nv-pulse-stroke 2s infinite ease-in-out;
      }
      @keyframes nv-pulse-stroke {
        0%   { stroke-width: 1.5px; stroke-opacity: 0.6; }
        50%  { stroke-width: 4.5px; stroke-opacity: 1.0; stroke: #FFD166; }
        100% { stroke-width: 1.5px; stroke-opacity: 0.6; }
      }

      /* Hub node: subtle warm pulse to indicate the graph's focal point */
      .nv-hub-node { animation: nv-hub-pulse 3s ease-in-out infinite; }
      @keyframes nv-hub-pulse {
        0%   { opacity: 0.78; }
        50%  { opacity: 1; }
        100% { opacity: 0.78; }
      }

      /* Icons */
      .nv-icon-typehub { fill: rgba(255,255,255,0.18); stroke: rgba(255,255,255,0.5); stroke-width: 1px; pointer-events: none; }
      .nv-icon-instance { fill: none; stroke: rgba(255,255,255,0.85); stroke-width: 1.2px; pointer-events: none; }
      .nv-icon-action   { fill: rgba(255,255,255,0.25); stroke: rgba(255,255,255,0.6); stroke-width: 0.8px; pointer-events: none; }
      .nv-icon-linktype { fill: none; stroke: rgba(0,0,0,0.55); stroke-width: 1.2px; pointer-events: none; }

      /* Collapsed nodes style: dashed yellow/orange stroke */
      .nv-node-collapsed circle {
        stroke: #FFD166 !important;
        stroke-width: 3.5px !important;
        stroke-dasharray: 4 2.5 !important;
        opacity: 0.95 !important;
      }
      .nv-node-collapsed:hover circle {
        stroke: #FFD166 !important;
        stroke-width: 4.5px !important;
      }
    `;
    document.head.appendChild(styleEl);

    const g = svg.append('g').attr('class', 'nv-graph');
    const getNodeLabelBaseFontSize = (node: GraphNode) =>
      node._focusLevel === 0 ? 15 : node.group === 'typeHub' ? 12 : node._focusLevel === 1 ? 11 : 9;
    let updateNodeLabelsForZoom: (zoomScale: number) => void = () => {};

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 20])
      .on('zoom', e => {
        g.attr('transform', e.transform);
        currentTransformRef.current = e.transform;
        updateNodeLabelsForZoom(e.transform.k);
      });
    svg.call(zoom).on('dblclick.zoom', null);
    zoomRef.current = zoom;
    svg.attr('style', 'display:block;cursor:grab;');
    svg.on('wheel', (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
    }, { passive: false });

    // Fit All — zoom to show all nodes with padding and minimum zoom
    // Guards against:
    //  a) Empty graph (bail silently)
    //  b) All nodes at origin (0,0) — wait for force simulation to spread them
    //  c) Single node — center it without zoom
    let fitAllRetryCount = 0;
    (window as any).__d3FitAll = () => {
      const ns = graphDataRef.current?.nodes || [];
      if (ns.length === 0) return;

      // Filter to nodes with valid, non-zero positions (force sim has settled)
      const valid = ns.filter(n => n.x != null && !isNaN(n.x!) && n.x !== 0);
      if (valid.length === 0) {
        // Nodes haven't spread yet — force sim still running; retry after settling window
        if (fitAllRetryCount < 10) {
          fitAllRetryCount++;
          setTimeout(() => { (window as any).__d3FitAll?.(); }, 600);
        }
        return;
      }

      // Compute degree centrality to find the hub (most-connected instance node)
      const degreeMap: Record<string, number> = {};
      ns.forEach(n => { degreeMap[n.id] = 0; });
      graphDataRef.current?.links.forEach((l: GraphLink) => {
        const s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
        const t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
        if (degreeMap[s] !== undefined) degreeMap[s]++;
        if (degreeMap[t] !== undefined) degreeMap[t]++;
      });

      // Hub = highest-degree instance (not typeHub, not action)
      let hubNode = valid.find(n => n.group === 'instance') || valid[0];
      valid.forEach(n => {
        if (n.group === 'instance' && (degreeMap[n.id] || 0) > (degreeMap[hubNode.id] || 0)) {
          hubNode = n;
        }
      });

      // Store hub node id for CSS glow ring
      (window as any).__hubNodeId = hubNode?.id || null;

      const xs = valid.map(n => n.x!);
      const ys = valid.map(n => n.y!);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const bw = maxX - minX || 1, bh = maxY - minY || 1;

      // Single node or all at same point → no zoom, just center
      if (bw < 2 && bh < 2) {
        const scale = Math.min(W / 400, H / 300, 2);
        const tx = W / 2 - (ns[0].x || 0) * scale;
        const ty = H / 2 - (ns[0].y || 0) * scale;
        svg.transition().duration(600)
          .call(zoom.transform as any, d3.zoomIdentity.translate(tx, ty).scale(scale));
        return;
      }

      // When graph is small (≤15 nodes), center on hub directly.
      // When large, show full graph in view with hub emphasized visually.
      const scale = Math.min(0.85 * W / (bw * 1.4), 0.85 * H / (bh * 1.4), 5);
      let tx: number, ty: number;
      if (valid.length <= 15 && hubNode.x !== undefined) {
        tx = W / 2 - hubNode.x * scale;
        ty = H / 2 - hubNode.y * scale;
      } else {
        tx = W / 2 - ((minX + maxX) / 2) * scale;
        ty = H / 2 - ((minY + maxY) / 2) * scale;
      }

      svg.transition().duration(800)
        .call(zoom.transform as any, d3.zoomIdentity.translate(tx, ty).scale(Math.max(0.3, scale)));
    };

    (window as any).__d3FocusNode = (nodeId: number, nodeGroup?: string) => {
      const ns = simulationRef.current?.nodes() || [];
      const node = ns.find(n => n.id === nodeId && (!nodeGroup || n.group === nodeGroup));
      if (!node || node.x == null || isNaN(node.x) || node.y == null || isNaN(node.y)) return;

      const W = containerRef.current?.clientWidth ?? 800;
      const H = containerRef.current?.clientHeight ?? 600;
      const scale = 1.8;
      const tx = W / 2 - node.x * scale;
      const ty = H / 2 - node.y * scale;

      svg.transition().duration(600)
        .call(zoom.transform as any, d3.zoomIdentity.translate(tx, ty).scale(scale));

      setSelectedNode(node);
      showNodeInfo(node, graphDataRef.current || { nodes: ns, links: [] });
      (window as any).__currentNodeId = node.id;

      // Pulse visual effect on node circle
      const match = d3.selectAll<SVGGElement, GraphNode>('.nv-node')
        .filter((d: GraphNode) => d.id === nodeId && (!nodeGroup || d.group === nodeGroup));

      if (!match.empty()) {
        match.select('circle')
          .transition()
          .duration(150)
          .attr('r', (d: GraphNode) => getVisualRadius(d) * 1.8)
          .transition()
          .duration(300)
          .attr('r', (d: GraphNode) => getVisualRadius(d));
      }
    };

    if (!graphDataRef.current) {
      setD3Ready(true);
      return () => {
        const el = document.getElementById(styleId);
        if (el) el.remove();
        delete (window as any).__d3FitAll;
        delete (window as any).__d3FocusNode;
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
    const nodeMap = new Map<string, GraphNode>(nodes.map(n => [n.id, n]));
    const endpointLinks = links.filter(link => getSourceNode(link as any, nodeMap as any) && getTargetNode(link as any, nodeMap as any));
    const { aggregatedLinks } = aggregateParallelEdges(
      endpointLinks as any,
      nodeMap as any,
      (link: GraphLink) => getSourceNode(link as any, nodeMap as any) as any,
      (link: GraphLink) => getTargetNode(link as any, nodeMap as any) as any,
    );
    const edgeGroupOffsets = computeEdgeGroupOffsets(
      aggregatedLinks as any,
      (link: GraphLink) => getSourceNode(link as any, nodeMap as any) as any,
      (link: GraphLink) => getTargetNode(link as any, nodeMap as any) as any,
    );
    const renderLinks = aggregatedLinks.map((link: GraphLink) => {
      const sourceNode = getSourceNode(link as any, nodeMap as any) as GraphNode | undefined;
      const targetNode = getTargetNode(link as any, nodeMap as any) as GraphNode | undefined;
      const sourceId = sourceNode?.id || '';
      const targetId = targetNode?.id || '';
      const directedOffset = edgeGroupOffsets.get(`${sourceId}|${targetId}`);
      const fallbackOffset = link._linkTypeId !== undefined ? 30 : link._isTypeInstLink ? 0 : 18;
      return { ...link, _groupOffset: directedOffset ?? fallbackOffset };
    });
    nodesRef.current = nodes;

    const typeHubNodes = nodes.filter(n => n.group === 'typeHub');
    if (layoutMode === 'dagre') {
      applyDagreLayout(nodes, renderLinks, W, H);
      nodes.forEach(n => {
        n.fx = n.x;
        n.fy = n.y;
      });
    } else if (layoutMode === 'verticalTree') {
      applyVerticalTreeLayout(nodes, W, H);
      nodes.forEach(n => {
        n.fx = n.x;
        n.fy = n.y;
      });
    } else if (layoutMode === 'horizontalTree') {
      applyHorizontalTreeLayout(nodes, W, H);
      nodes.forEach(n => {
        n.fx = n.x;
        n.fy = n.y;
      });
    } else if (layoutMode === 'concentric') {
      applyConcentricLayout(nodes, W, H);
      nodes.forEach(n => {
        n.fx = n.x;
        n.fy = n.y;
      });
    } else if (layoutMode === 'starburst') {
      applyStarburstLayout(nodes, renderLinks, W, H);
      nodes.forEach(n => {
        n.fx = n.x;
        n.fy = n.y;
      });
    } else if (layoutMode === 'dandelion') {
      applyDandelionLayout(nodes, renderLinks, W, H);
      nodes.forEach(n => {
        n.fx = n.x;
        n.fy = n.y;
      });
    } else if (layoutMode === 'spoke') {
      applySpokeLayout(nodes, renderLinks, W, H, focusedNodeId);
      nodes.forEach(n => {
        n.fx = n.x;
        n.fy = n.y;
      });
    } else if (layoutMode === 'grid') {
      applyGridLayout(nodes, W, H);
      nodes.forEach(n => {
        n.fx = n.x;
        n.fy = n.y;
      });
    } else if (layoutMode === 'groupedCircular') {
      applyGroupedCircularLayout(nodes, W, H);
      nodes.forEach(n => {
        n.fx = n.x;
        n.fy = n.y;
      });
    } else {
      nodes.forEach(n => {
        n.fx = null;
        n.fy = null;
      });
      computeInitialPositions(nodes, typeHubNodes, W, H, rawLinksRef.current);
    }

    // Compute degree centrality to identify the hub node (used by fitAll and rendering)
    const degreeMap: Record<string, number> = {};
    nodes.forEach(n => { degreeMap[n.id] = 0; });
    links.forEach((l: GraphLink) => {
      const s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
      const t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
      if (degreeMap[s] !== undefined) degreeMap[s]++;
      if (degreeMap[t] !== undefined) degreeMap[t]++;
    });
    nodes.forEach(n => { (n as any)._degree = degreeMap[n.id] || 0; });
    let hubNodeId = '';
    let hubDegree = -1;
    nodes.forEach(n => {
      if (n.group === 'instance' && (degreeMap[n.id] || 0) > hubDegree) {
        hubDegree = degreeMap[n.id];
        hubNodeId = n.id;
      }
    });
    (window as any).__hubNodeId = hubNodeId;

    // Force Simulation
    const nodeCount = nodes.length;
    const decay = nodeCount > 200 ? 0.12 : nodeCount > 150 ? 0.09 : nodeCount > 80 ? 0.06 : 0.04;
    const sim = d3.forceSimulation<GraphNode, GraphLink>(nodes)
      .velocityDecay(velocityDecay)
      .alpha(0.8)
      .alphaDecay(decay)
      .force('link', d3.forceLink<GraphNode, GraphLink>(renderLinks).id(d => d.id).distance(d => {
        const src = getSourceNode(d as any, nodeMap as any);
        const tgt = getTargetNode(d as any, nodeMap as any);
        if (src?.group === 'action' || tgt?.group === 'action') return 40;
        if (d._linkTypeId !== undefined) return linkDistance * 1.15;
        if (src?.group === 'typeHub' || tgt?.group === 'typeHub') return linkDistance * 1.2;
        return linkDistance;
      }).strength(d => {
        const src = getSourceNode(d as any, nodeMap as any);
        const tgt = getTargetNode(d as any, nodeMap as any);
        if (src?.group === 'action' || tgt?.group === 'action') return 1.0;
        return linkStrength;
      }))
      .force('charge', d3.forceManyBody().strength(chargeStrength))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide<GraphNode>().radius(d => {
        if (d.group === 'action') return (d.size || 6) + collisionRadius;
        return (d.size || 10) + collisionRadius;
      }))
      .force('x', d3.forceX(W / 2).strength(gravityStrength))
      .force('y', d3.forceY(H / 2).strength(gravityStrength));
    simulationRef.current = sim;

    // Links
    const linkGroup = g.append('g').attr('class', 'nv-links');
    const defs = svg.append('defs');
    const mkArrow = (id: string, color: string, opacity = 1) =>
      defs.append('marker')
        .attr('id', id).attr('markerWidth', 6).attr('markerHeight', 4)
        .attr('refX', 5).attr('refY', 2).attr('orient', 'auto')
        .append('polygon')
        .attr('points', '0 0, 6 2, 0 4')
        .attr('fill', color)
        .attr('opacity', opacity);
    mkArrow('arrow-amethyst', '#FF9CF7');
    mkArrow('arrow-highlight', '#66d9ef');
    Array.from(new Map(
      renderLinks
        .filter(link => link._linkTypeId !== undefined)
        .map(link => [link._linkTypeId, link.color] as const)
    )).forEach(([linkTypeId, color]) => mkArrow(`arrow-linktype-${linkTypeId}`, color));

    const getVisualRadius = (node?: GraphNode) => {
      if (!node) return 10;
      const level = node._focusLevel ?? 1;
      const multiplier = level === 0 ? 1.85 : level === 1 ? 1.15 : level === 2 ? 0.92 : 0.82;
      if (node.group === 'typeHub') return (node.size || 28) * (level === 0 ? 1.25 : 1);
      if (node.group === 'action') return Math.max(7, (node.size || 10) * multiplier);
      return Math.max(8, (node.size || 11) * multiplier);
    };

    const getNodeIconPath = (d: GraphNode) => {
      if (d.group === 'typeHub') return ICON_HEXAGON;
      if (d.group === 'action') return ICON_BOLT;
      const typeName = (d._typeName || '').toLowerCase();
      const label = (d.label || '').toLowerCase();
      
      if (typeName.includes('host') || typeName.includes('主机') || label.includes('host') || label.includes('192.168.')) {
        return 'M -6,-4 H 6 V 2 H -6 Z M -8,4 H 8 M -2,2 L -4,4 H 4 L 2,2';
      }
      if (typeName.includes('server') || typeName.includes('服务器') || typeName.includes('dns') || typeName.includes('web')) {
        return 'M -6,-5 H 6 V -2 H -6 Z M -6,-1 H 6 V 2 H -6 Z M -6,3 H 6 V 6 H -6 Z M -3,-3.5 H -2 M -3,0.5 H -2 M -3,4.5 H -2';
      }
      if (typeName.includes('db') || typeName.includes('database') || typeName.includes('数据库') || typeName.includes('duckdb')) {
        return 'M -6,-3 C -6,-5 6,-5 6,-3 C 6,-1 -6,-1 -6,-3 M -6,-3 V 3 C -6,5 6,5 6,3 V -3';
      }
      if (typeName.includes('port') || typeName.includes('端口') || typeName.includes('service') || typeName.includes('服务')) {
        return 'M -3,-6 H 3 V -2 H -3 Z M -4,-2 H 4 V 3 C 4,5 -4,5 -4,3 Z M 0,4 V 8';
      }
      if (typeName.includes('network') || typeName.includes('网络') || typeName.includes('subnet') || typeName.includes('网段')) {
        return 'M -6,2 A 3,3 0 0 1 -3,-2 A 4,4 0 0 1 3,-2 A 3,3 0 0 1 6,2 Z';
      }
      if (typeName.includes('share') || typeName.includes('共享') || typeName.includes('folder') || typeName.includes('文件夹')) {
        return 'M -7,-5 H -2 L 0,-3 H 7 V 5 H -7 Z';
      }
      return ICON_BOX;
    };

    const getNodeFill = (d: GraphNode) => {
      const typeName = (d._typeName || '').toLowerCase();
      const label = (d.label || '').toLowerCase();
      
      if (d.group === 'typeHub') return d.color || '#ae81ff';
      if (d.group === 'action') return '#3b82f6';
      
      // Host / Device
      if (typeName.includes('host') || typeName.includes('主机') || label.includes('host') || label.includes('192.168.')) {
        return '#ffffff';
      }
      // Port / Service
      if (typeName.includes('port') || typeName.includes('端口') || typeName.includes('service') || typeName.includes('服务')) {
        const isRisky = label.includes('21') || label.includes('22') || label.includes('445') || label.includes('3389') || label.includes('danger') || label.includes('risk') || label.includes('ftp') || label.includes('smb');
        return isRisky ? '#ef4444' : '#3b82f6';
      }
      // Share / Folder
      if (typeName.includes('share') || typeName.includes('共享') || typeName.includes('folder')) {
        return '#f97316';
      }
      return d.color || '#a070d0';
    };

    const getNodeStroke = (d: GraphNode) => {
      if (scopeMode !== 'all' && d.id === focusedNodeId) return '#FFD166';
      const fill = getNodeFill(d);
      if (fill === '#ffffff') return 'rgba(255,255,255,0.7)';
      return d3.rgb(fill).brighter(0.4).toString();
    };

    const getNodeRadius = (node?: GraphNode) => {
      if (!node) return 10;
      return getVisualRadius(node) + (node.group === 'typeHub' ? 7 : 4);
    };

    const getTrimmedCurve = (link: GraphLink) => {
      const src = getSourceNode(link as any, nodeMap as any) as GraphNode | undefined;
      const tgt = getTargetNode(link as any, nodeMap as any) as GraphNode | undefined;
      if (!src || !tgt) return { path: '', labelX: 0, labelY: 0 };
      const sx0 = src.x || 0, sy0 = src.y || 0;
      const tx0 = tgt.x || 0, ty0 = tgt.y || 0;
      const dx = tx0 - sx0, dy = ty0 - sy0;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const srcPad = getNodeRadius(src);
      const tgtPad = getNodeRadius(tgt) + (link._isTypeInstLink ? 0 : 4);
      const sx = sx0 + (dx / dist) * srcPad;
      const sy = sy0 + (dy / dist) * srcPad;
      const tx = tx0 - (dx / dist) * tgtPad;
      const ty = ty0 - (dy / dist) * tgtPad;
      const offset = link._groupOffset || 0;
      if (!offset) {
        return { path: `M${sx},${sy} L${tx},${ty}`, labelX: (sx + tx) / 2, labelY: (sy + ty) / 2 - 5 };
      }
      const mx = (sx + tx) / 2;
      const my = (sy + ty) / 2;
      const nx = -dy / dist * offset;
      const ny = dx / dist * offset;
      return {
        path: `M${sx},${sy} Q${mx + nx},${my + ny} ${tx},${ty}`,
        labelX: mx + nx * 0.58,
        labelY: my + ny * 0.58 - 5,
      };
    };

    const linkEls = linkGroup.selectAll<SVGPathElement, GraphLink>('path')
      .data(renderLinks)
      .enter()
      .append('path');

    linkEls
      .attr('class', (d: GraphLink) => {
        if (d._linkTypeId !== undefined) return 'nv-link-instance';
        const src = getSourceNode(d as any, nodeMap as any);
        const tgt = getTargetNode(d as any, nodeMap as any);
        if (src?.group === 'typeHub' || tgt?.group === 'typeHub') return 'nv-link-typeinst';
        return 'nv-link-action';
      })
      .style('fill', 'none')
      .style('stroke', (d: GraphLink) => {
        if (d._isTypeInstLink) return 'rgba(255,255,255,0.15)';
        return 'rgba(255, 209, 102, 0.45)';
      })
      .style('stroke-dasharray', (d: GraphLink) => {
        if (d._linkTypeId === undefined) return null;
        return LINKTYPE_DASH[(d._linkTypeId - 1) % LINKTYPE_DASH.length];
      })
      .style('stroke-width', (d: GraphLink) => {
        // Weight-mapped thickness: 1px (weight=0.3) → 2.4px (weight=1.0)
        const w = Math.max(0.3, Math.min(1.0, d.weight ?? 0.5));
        return `${(1 + (w - 0.3) * 2.0).toFixed(2)}px`;
      })
      .style('opacity', (d: GraphLink) => {
        // Weight-mapped opacity: 0.45 (weight=0.3) → 1.0 (weight=1.0)
        // Hidden entirely when below threshold
        if (!showWeakLinks && d._linkTypeId !== undefined && d.weight < weightThreshold) return '0';
        const w = Math.max(0.3, Math.min(1.0, d.weight ?? 0.5));
        return (0.45 + (w - 0.3) * 0.79).toFixed(2);
      })
      .style('display', (d: GraphLink) => {
        // Hide links below weight threshold entirely (removes them from layout calculations)
        if (!showWeakLinks && d._linkTypeId !== undefined && d.weight < weightThreshold) return 'none';
        return null;
      })
      .attr('marker-end', (d: GraphLink) => {
        if (d._linkTypeId !== undefined) return `url(#arrow-linktype-${d._linkTypeId})`;
        const src = getSourceNode(d as any, nodeMap as any);
        const tgt = getTargetNode(d as any, nodeMap as any);
        if (src?.group === 'typeHub' || tgt?.group === 'typeHub') return null;
        return 'url(#arrow-amethyst)';
      })
      .attr('d', (d: GraphLink) => getTrimmedCurve(d).path)
      .each(function(d: GraphLink) {
        const src = getSourceNode(d as any, nodeMap as any) as GraphNode | undefined;
        const tgt = getTargetNode(d as any, nodeMap as any) as GraphNode | undefined;
        const rel = d._linkTypeName || 'membership';
        const lt = d._linkTypeId !== undefined ? data.linkTypeMap[d._linkTypeId] : null;
        d3.select(this).append('title')
          .text(`${src?.label || '?'} -> ${rel} -> ${tgt?.label || '?'}\n权重: ${Number(d.weight || 0).toFixed(2)}${lt?.description ? `\n描述: ${lt.description}` : ''}`);
      });

    linkElsRef.current = linkEls;

    // Removed 1.5s setInterval style enforcement

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

    // requestAnimationFrame (rAF) throttling to match monitor refresh rate (VSync)
    let rafId: number | null = null;

    const nodeContainer = g.append('g').attr('class', 'nv-nodes');
    const instanceNodes = nodes.filter(d => d.group === 'instance');
    const actionNodes = nodes.filter(d => d.group === 'action');

    // Drag — STICKY; stopPropagation prevents SVG zoom from stealing events
    const dragstarted = (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
      event.sourceEvent.stopPropagation();
      if (!event.active) sim.alphaTarget(0.3).restart();
      d.fx = d.x; d.fy = d.y;
      svg.classed('nv-is-dragging', true);
    };
    const dragged = (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
      event.sourceEvent.stopPropagation();
      d.fx = event.x; d.fy = event.y;
    };
    const dragended = (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, _d: GraphNode) => {
      event.sourceEvent.stopPropagation();
      if (!event.active) sim.alphaTarget(0);
      svg.classed('nv-is-dragging', false);
    };

    // Type Hub nodes
    const typeHubG = nodeContainer.selectAll<SVGGElement, GraphNode>('.nv-typehub')
      .data(typeHubNodes)
      .enter().append('g')
      .attr('class', (d: GraphNode) => `nv-typehub nv-node${collapsedNodes.has(d.id) ? ' nv-node-collapsed' : ''}`)
      .style('cursor', 'move')
      .call(d3.drag<SVGGElement, GraphNode>().on('start', dragstarted).on('drag', dragged).on('end', dragended));
    typeHubG.append('circle').attr('r', (d: GraphNode) => getVisualRadius(d) + 6)
      .style('fill', 'none').style('stroke', (d: GraphNode) => d.color)
      .style('stroke-width', 1.5)
      .style('opacity', (d: GraphNode) => d._hasInstances !== false ? 0.35 : 0.15)
      .style('pointer-events', 'none');
    typeHubG.append('circle').attr('r', (d: GraphNode) => getVisualRadius(d))
      .style('fill', (d: GraphNode) => getNodeFill(d))
      .style('stroke', (d: GraphNode) => getNodeStroke(d)).style('stroke-width', 2)
      .style('opacity', 0.9)
      .style('pointer-events', 'all');
    typeHubG.append('path').attr('d', ICON_HEXAGON).attr('class', 'nv-icon-typehub')
      .attr('transform', 'scale(1.6) translate(0, 1)')
      .style('opacity', (d: GraphNode) => d._hasInstances !== false ? 1 : 0.5);

    // Instance nodes
    const instanceG = nodeContainer.selectAll<SVGGElement, GraphNode>('.nv-instance')
      .data(instanceNodes)
      .enter().append('g')
      .attr('class', (d: GraphNode) =>
        `nv-instance nv-node${d.id === hubNodeId ? ' nv-hub-node' : ''}${scopeMode !== 'all' && d.id === focusedNodeId ? ' nv-focus-node' : ''}${collapsedNodes.has(d.id) ? ' nv-node-collapsed' : ''}`
      )
      .style('cursor', 'pointer')
      .call(d3.drag<SVGGElement, GraphNode>().on('start', dragstarted).on('drag', dragged).on('end', dragended));
    instanceG.append('circle').attr('r', (d: GraphNode) => getVisualRadius(d))
      .style('fill', (d: GraphNode) => getNodeFill(d))
      .style('stroke', (d: GraphNode) => getNodeStroke(d))
      .style('stroke-width', (d: GraphNode) => scopeMode !== 'all' && d.id === focusedNodeId ? 3 : 1.5)
      .style('opacity', 0.95)
      .style('pointer-events', 'all');
    instanceG.append('path').attr('d', getNodeIconPath).attr('class', 'nv-icon-instance')
      .attr('transform', 'scale(0.9) translate(0, 0)')
      .style('stroke', (d: GraphNode) => {
        const fill = getNodeFill(d);
        return fill === '#ffffff' ? '#0c0d12' : 'rgba(255,255,255,0.85)';
      });

    // Property-count badge
    instanceG.each(function(d: GraphNode) {
      const count = d._propsCount || 0;
      if (count === 0) return;
      const gInst = d3.select(this);
      const r = getVisualRadius(d);
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
    actionG.append('circle').attr('r', (d: GraphNode) => getVisualRadius(d))
      .style('fill', (d: GraphNode) => d.color)
      .style('stroke', 'rgba(255,255,255,0.6)').style('stroke-width', 1)
      .style('pointer-events', 'all');
    actionG.append('path').attr('d', ICON_BOLT).attr('class', 'nv-icon-action')
      .attr('transform', 'scale(0.55) translate(0, 1)');

    // Labels (typeHub shows description as label; other nodes show name)
    const LABEL_MAX = 18;
    const labelGroup = g.append('g').attr('class', 'nv-labels');
    const labelEls = labelGroup.selectAll<SVGTextElement, GraphNode>('text')
      .data(nodes)
      .enter().append('text')
      .attr('class', (d: GraphNode) => d.group === 'typeHub'
        ? 'nv-node-label nv-typehub-label'
        : 'nv-node-label')
      .text((d: GraphNode) => {
        // Always show name (label) on the node; description is for tooltip/hover only
        const title = String(d.label || d.description || d.id);
        return title.length > LABEL_MAX ? title.slice(0, LABEL_MAX) + '…' : title;
      })
      .style('font-size', (d: GraphNode) => `${getNodeLabelBaseFontSize(d)}px`)
      .style('fill', 'white').style('font-weight', 'bold');
    // typeHub tooltip shows name (KEY); others show label
    labelEls.each(function(d: GraphNode) {
      const tooltip = d.group === 'typeHub'
        ? `类型: ${d.label}${d.description ? '\n描述: ' + d.description : ''}`
        : d.label;
      d3.select(this).append('title').text(tooltip);
    });
    labelElsRef.current = labelEls;
    updateNodeLabelsForZoom = (zoomScale: number) => {
      const safeScale = Math.max(0.05, zoomScale || 1);
      labelEls
        .style('display', null)
        .style('font-size', (d: GraphNode) => `${getNodeLabelBaseFontSize(d) / safeScale}px`)
        .style('stroke-width', `${0.5 / safeScale}px`)
        .attr('x', (d: GraphNode) => (d.x || 0) + getVisualRadius(d) + 7 / safeScale)
        .attr('y', (d: GraphNode) => (d.y || 0) + 4 / safeScale);
    };
    updateNodeLabelsForZoom(currentTransformRef.current.k);

    // Link type labels on edges: show description (VALUE), tooltip shows name + weight (KEY)
    const linkLabelGroup = g.append('g').attr('class', 'nv-link-labels');
    const linkLabelEls = linkLabelGroup.selectAll<SVGTextElement, GraphLink>('text')
      .data(renderLinks.filter(l => l._linkTypeId !== undefined))
      .enter().append('text').attr('class', 'nv-linktype-label')
      .style('fill', (d: GraphLink) => d.color)
      .style('opacity', () => scopeMode === 'all' ? 0 : 0.82)
      .style('paint-order', 'stroke')
      .style('stroke', 'rgba(13,12,10,0.85)')
      .style('stroke-width', 3)
      .text((d: GraphLink) => {
        // Show name (keyword) on edge label; max 8 chars so it never dominates visually
        const lt = data.linkTypeMap[d._linkTypeId as number];
        const label = lt?.name || d._linkTypeName || '';
        if (label.length >= 1) {
          return label.length > 8 ? label.slice(0, 8) + '…' : label;
        }
        return '—';
      })
      .each(function(d: GraphLink) {
        const lt = data.linkTypeMap[d._linkTypeId as number];
        const name = lt?.name || d._linkTypeName || '';
        d3.select(this).append('title')
          .text(`关系: ${name}\n强度: ${Number(d.weight).toFixed(2)}`);
      });

    // TICK — throttled using requestAnimationFrame to match layout updates with VSync
    const tickThrottled = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;

        // Radial fan constraint for actions
        const parentToChildren: Record<string, GraphNode[]> = {};
        nodes.forEach(n => {
          if (n.group === 'action' && n._objId) {
            const parentKey = `obj::${n._objId}`;
            if (!parentToChildren[parentKey]) parentToChildren[parentKey] = [];
            parentToChildren[parentKey].push(n);
          }
        });
        Object.entries(parentToChildren).forEach(([parentKey, children]) => {
          const parent = nodes.find(p => p.id === parentKey);
          if (!parent || parent.x == null || parent.y == null) return;
          const count = children.length;
          const dist = 48;
          children.sort((a, b) => a.id.localeCompare(b.id)).forEach((child, idx) => {
            const angle = (idx * 2 * Math.PI) / count;
            child.x = parent.x! + dist * Math.cos(angle);
            child.y = parent.y! + dist * Math.sin(angle);
            child.vx = 0;
            child.vy = 0;
          });
        });

        const visibleNodes = getVisibleNodes(nodes, currentTransformRef.current, W, H);
        const visibleNodeIds = new Set(visibleNodes.map(n => n.id));

        // LOD zoom thresholds
        const k = currentTransformRef.current.k;
        const hideLabels = k < 0.15;
        const hideActions = k < 0.15;

        linkEls
          .style('display', (d: GraphLink) => {
            const sId = typeof d.source === 'object' ? (d.source as GraphNode).id : d.source;
            const tId = typeof d.target === 'object' ? (d.target as GraphNode).id : d.target;
            return (visibleNodeIds.has(String(sId)) || visibleNodeIds.has(String(tId))) ? null : 'none';
          })
          .attr('d', (d: GraphLink) => getTrimmedCurve(d).path);
        typeHubG.attr('transform', (d: GraphNode) => `translate(${d.x || 0},${d.y || 0})`);
        instanceG.attr('transform', (d: GraphNode) => `translate(${d.x || 0},${d.y || 0})`);
        actionG
          .style('display', (d: GraphNode) => hideActions ? 'none' : null)
          .attr('transform', (d: GraphNode) => `translate(${d.x || 0},${d.y || 0})`);
        updateNodeLabelsForZoom(k);
        linkLabelEls
          .style('display', () => hideLabels ? 'none' : null)
          .attr('x', (d: GraphLink) => getTrimmedCurve(d).labelX)
          .attr('y', (d: GraphLink) => getTrimmedCurve(d).labelY);
      });
    };

    // Attach simulation event handlers
    sim.on('tick.throttled', tickThrottled);
    sim.on('end.throttled', () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      
      // Radial fan constraint for actions
      const parentToChildren: Record<string, GraphNode[]> = {};
      nodes.forEach(n => {
        if (n.group === 'action' && n._objId) {
          const parentKey = `obj::${n._objId}`;
          if (!parentToChildren[parentKey]) parentToChildren[parentKey] = [];
          parentToChildren[parentKey].push(n);
        }
      });
      Object.entries(parentToChildren).forEach(([parentKey, children]) => {
        const parent = nodes.find(p => p.id === parentKey);
        if (!parent || parent.x == null || parent.y == null) return;
        const count = children.length;
        const dist = 48;
        children.sort((a, b) => a.id.localeCompare(b.id)).forEach((child, idx) => {
          const angle = (idx * 2 * Math.PI) / count;
          child.x = parent.x! + dist * Math.cos(angle);
          child.y = parent.y! + dist * Math.sin(angle);
          child.vx = 0;
          child.vy = 0;
        });
      });

      // Perform one final sync tick to guarantee drawing positions match settled sim coordinates
      const visibleNodes = getVisibleNodes(nodes, currentTransformRef.current, W, H);
      const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
      const k = currentTransformRef.current.k;
      const hideLabels = k < 0.15;
      const hideActions = k < 0.15;

      linkEls
        .style('display', (d: GraphLink) => {
          const sId = typeof d.source === 'object' ? (d.source as GraphNode).id : d.source;
          const tId = typeof d.target === 'object' ? (d.target as GraphNode).id : d.target;
          return (visibleNodeIds.has(String(sId)) || visibleNodeIds.has(String(tId))) ? null : 'none';
        })
        .attr('d', (d: GraphLink) => getTrimmedCurve(d).path);
      typeHubG.attr('transform', (d: GraphNode) => `translate(${d.x || 0},${d.y || 0})`);
      instanceG.attr('transform', (d: GraphNode) => `translate(${d.x || 0},${d.y || 0})`);
      actionG
        .style('display', (d: GraphNode) => hideActions ? 'none' : null)
        .attr('transform', (d: GraphNode) => `translate(${d.x || 0},${d.y || 0})`);
      updateNodeLabelsForZoom(k);
      linkLabelEls
        .style('display', () => hideLabels ? 'none' : null)
        .attr('x', (d: GraphLink) => getTrimmedCurve(d).labelX)
        .attr('y', (d: GraphLink) => getTrimmedCurve(d).labelY);
    });

    // Trigger fit-all AFTER simulation settles — not at a fixed timeout.
    // The sim's 'end' event fires when alpha reaches near-zero.
    sim.on('end', () => {
      (window as any).__d3FitAll?.();
    });

    // Event handlers
    const allNodeGroups = nodeContainer.selectAll<SVGGElement, GraphNode>('g.nv-node');
    allNodeGroupsRef.current = allNodeGroups;
    allNodeGroups.on('mouseover', (event: MouseEvent, d: GraphNode) => {
      // Highlight hovered node and its immediate connections
      d3.selectAll<SVGPathElement, GraphLink>('.nv-link-instance')
        .style('opacity', (l: GraphLink) => {
          if (!showWeakLinks && l.weight !== undefined && l.weight < weightThreshold) return '0';
          const s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
          const t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
          if (s === d.id || t === d.id) return 1;
          return 0.2;
        });
      // Show edge labels only for links connected to the hovered node
      d3.selectAll<SVGTextElement, GraphLink>('.nv-linktype-label')
        .style('opacity', (l: GraphLink) => {
          const s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
          const t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
          return s === d.id || t === d.id ? 1 : 0;
        });
      // Position tooltip relative to the SVG container
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (svgRect) {
        setTooltipPos({ x: event.clientX - svgRect.left, y: event.clientY - svgRect.top });
      }
      setHoveredNode(d);
      hoveredNodeIdRef.current = d.id;
    });
    allNodeGroups.on('mousemove', (event: MouseEvent) => {
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (svgRect) {
        setTooltipPos({ x: event.clientX - svgRect.left, y: event.clientY - svgRect.top });
      }
    });
    allNodeGroups.on('mouseout', () => {
      setHoveredNode(null);
      hoveredNodeIdRef.current = null;
      // Restore selections if any, otherwise reset to default
      applyHighlightStylesRef.current(activeHighlightIdRef.current);
    });
    allNodeGroups.on('click', (event: MouseEvent, d: GraphNode) => {
      event.stopPropagation();
      setSelectedNode(d);
      showNodeInfo(d, data);
      (window as any).__currentNodeId = d.id;
      if (d.group === 'instance' || d.group === 'typeHub') {
        toggleNodeCollapse(d.id);
      } else if (clickToFocusRef.current) {
        setFocusedNodeId(d.id);
        setScopeMode('focus');
      }
    });
    allNodeGroups.on('dblclick', (event: MouseEvent, d: GraphNode) => {
      event.stopPropagation();
      setFocusedNodeId(d.id);
      d.fx = null; d.fy = null;
      if (!zoomRef.current) return;
      const scale = 2.0;
      svg.transition().duration(500)
        .call(zoom.transform as any, d3.zoomIdentity.translate(W / 2 - (d.x || 0) * scale, H / 2 - (d.y || 0) * scale).scale(scale));
      
      if (onInspect) {
        if (d.group === 'instance') {
          const rawObj = state.objects.find((o: any) => o.id === d.id);
          if (rawObj) onInspect('object', rawObj);
        } else if (d.group === 'typeHub') {
          const rawType = state.objectTypes.find((ot: any) => ot.id === d.id);
          if (rawType) onInspect('objectType', rawType);
        } else if (d.group === 'linkType') {
          const rawLinkType = (state.linkTypes || []).find((lt: any) => lt.id === d.id);
          if (rawLinkType) onInspect('linkType', rawLinkType);
        } else if (d.group === 'action') {
          const rawAction = state.actions.find((a: any) => a.id === d.id);
          if (rawAction) onInspect('action', rawAction);
        }
      }
    });
    allNodeGroups.on('contextmenu', (event: MouseEvent, d: GraphNode) => {
      event.preventDefault();
      event.stopPropagation();
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setContextMenu({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          node: d,
        });
      }
    });
    const resetIfBlankCanvas = (event: MouseEvent) => {
      const target = event.target as HTMLElement | SVGElement;
      if (target.closest('.nv-node')) return;
      resetBlankCanvasState();
    };
    svg.on('click.reset', resetIfBlankCanvas);
    svg.on('dblclick.reset', (event: MouseEvent) => {
      const target = event.target as HTMLElement | SVGElement;
      if (target.closest('.nv-node')) return;
      event.preventDefault();
      resetBlankCanvasState();
    });

    setD3Ready(true);

    // Highlight existing selection on mount/update
    const activeHighlightId = selectedNode?.id || (scopeMode !== 'all' ? focusedNodeId : null);
    applyHighlightStyles(activeHighlightId);

    // P1-Fix: Fallback fitAll — ensures labels/edges are visible even if the
    // simulation's onEnd callback never fires (e.g. simulation killed before cooling down).
    // Triggers after mount so the SVG and __d3FitAll are guaranteed to exist.
    const fitAllTimer = setTimeout(() => { (window as any).__d3FitAll?.(); }, 200);

    // ResizeObserver
    const ro = new ResizeObserver(() => {
      if (!containerRef.current || !simulationRef.current) return;
      const w = containerRef.current.clientWidth, h = containerRef.current.clientHeight;
      svg.attr('width', w).attr('height', h);
      simulationRef.current.force('center', d3.forceCenter(w / 2, h / 2));
      simulationRef.current.alpha(0.1).restart();
      (window as any).__d3FitAll?.();
    });
    ro.observe(containerRef.current);

    return () => {
      clearTimeout(fitAllTimer);
      ro.disconnect();
      simulationRef.current?.stop();
      if (rafId !== null) cancelAnimationFrame(rafId);
      const el = document.getElementById(styleId);
      if (el) el.remove();
      delete (window as any).__d3FitAll;
      delete (window as any).__d3FocusNode;
      delete (window as any).__currentNodeId;
      delete (window as any).__hubNodeId;
    };
  }, [graphData, state.objectTypes.length, state.objects.length, state.initState, layoutMode, resetBlankCanvasState]);

  // Dynamic Simulation Physics Updates
  useEffect(() => {
    if (!simulationRef.current) return;
    const sim = simulationRef.current;
    
    // Update velocity decay
    sim.velocityDecay(velocityDecay);

    // Update forces
    const chargeForce = sim.force('charge') as d3.ForceManyBody<GraphNode> | undefined;
    if (chargeForce) chargeForce.strength(chargeStrength);

    const collisionForce = sim.force('collision') as d3.ForceCollide<GraphNode> | undefined;
    if (collisionForce) collisionForce.radius(d => (d.size || 10) + collisionRadius);

    const linkForce = sim.force('link') as d3.ForceLink<GraphNode, GraphLink> | undefined;
    if (linkForce) {
      linkForce.strength(linkStrength);
      linkForce.distance(d => {
        const s = d as any;
        if (s._linkTypeId !== undefined) return linkDistance * 1.15;
        if (s.source?.group === 'typeHub' || s.target?.group === 'typeHub') return linkDistance * 1.2;
        return linkDistance;
      });
    }

    const xForce = sim.force('x') as d3.ForceX<GraphNode> | undefined;
    if (xForce) xForce.strength(gravityStrength);

    const yForce = sim.force('y') as d3.ForceY<GraphNode> | undefined;
    if (yForce) yForce.strength(gravityStrength);

    sim.alpha(0.3).restart();
  }, [chargeStrength, linkDistance, collisionRadius, velocityDecay, gravityStrength, linkStrength]);

  // Moved applyHighlightStyles up

  // Highlight Mode Visual Updates (Selection & Focus)
  useEffect(() => {
    const activeHighlightId = selectedNode?.id || (scopeMode !== 'all' ? focusedNodeId : null);
    (window as any).__currentNodeId = selectedNode?.id || null;
    (window as any).__focusedNodeId = focusedNodeId;
    applyHighlightStyles(activeHighlightId);
  }, [focusedNodeId, selectedNode, scopeMode, graphData, applyHighlightStyles]);

  // Weight Threshold Filter — update link display when threshold changes
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll<SVGPathElement, GraphLink>('.nv-link-instance')
      .style('display', (d: GraphLink) => !showWeakLinks && d.weight < weightThreshold ? 'none' : null)
      .style('opacity', (d: GraphLink) => {
        if (!showWeakLinks && d.weight < weightThreshold) return '0';
        const w = Math.max(0.3, Math.min(1.0, d.weight ?? 0.5));
        return (0.45 + (w - 0.3) * 0.79).toFixed(2);
      });
  }, [weightThreshold, showWeakLinks]);

  // ==================== Helpers ====================

  function toggleNodeCollapse(
    nodeId: string, _nodes?: GraphNode[], _links?: GraphLink[],
    _allNodeGroups?: any, _labelEls?: any, _linkEls?: any,
    _collapsed?: Set<string>
  ) {
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      collapsedRef.current = next;
      return next;
    });
  }

  // Redundant helper functions highlightedSelectedNode and resetHighlights removed

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
    if (!svgRef.current) return;
    if (!graphData || graphData.nodes.length === 0) return;
    const svg = d3.select(svgRef.current);
    const isActive = searchTerm.trim().length > 0;
    const terms = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
    const nodes = graphData.nodes;
    const matched = nodes.filter(n =>
      terms.some(t =>
        n.label.toLowerCase().includes(t) ||
        (n.group || '').toLowerCase().includes(t) ||
        (n.description || '').toLowerCase().includes(t)
      )
    ).map(n => n.id);
    searchHighlightedRef.current = matched;
    setSearchIndex(-1);

    svg.selectAll<SVGGElement, GraphNode>('g.nv-node')
      .classed('nv-dim', (d: GraphNode) => isActive && !matched.includes(d.id));
    svg.selectAll<SVGGElement, GraphNode>('g.nv-node circle')
      .classed('nv-pulse-glow', (d: GraphNode) => matched.includes(d.id) && isActive);
    svg.selectAll<SVGTextElement, GraphNode>('.nv-node-label')
      .classed('nv-dim-label', (d: GraphNode) => isActive && !matched.includes(d.id))
      .classed('nv-label-match', (d: GraphNode) => matched.includes(d.id) && isActive)
      .style('fill', (d: GraphNode) => matched.includes(d.id) && isActive ? '#00BFFF' : 'white');
    svg.selectAll<SVGPathElement, GraphLink>('.nv-link-instance')
      .style('opacity', (l: GraphLink) => {
        if (!isActive) {
          const w = Math.max(0.3, Math.min(1.0, l.weight ?? 0.5));
          return (0.45 + (w - 0.3) * 0.79).toFixed(2);
        }
        const s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
        const t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
        return matched.includes(s) || matched.includes(t) ? 1 : 0.08;
      });

    // Auto-center and fit matched nodes in the viewport
    if (isActive && matched.length > 0 && zoomRef.current && svgRef.current) {
      const simulationNodes = simulationRef.current?.nodes() || [];
      const matchedSimNodes = simulationNodes.filter(n => matched.includes(n.id) && n.x != null && !isNaN(n.x) && n.y != null && !isNaN(n.y));
      if (matchedSimNodes.length > 0) {
        const xs = matchedSimNodes.map(n => n.x!);
        const ys = matchedSimNodes.map(n => n.y!);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        const bw = maxX - minX || 1, bh = maxY - minY || 1;
        const W = containerRef.current?.clientWidth ?? 800;
        const H = containerRef.current?.clientHeight ?? 600;
        
        let tx, ty, scale;
        if (matchedSimNodes.length === 1) {
          scale = 1.3;
          tx = W / 2 - matchedSimNodes[0].x! * scale;
          ty = H / 2 - matchedSimNodes[0].y! * scale;
        } else {
          scale = Math.min(W / (bw + 120), H / (bh + 120), 1.3);
          if (scale < 0.2) scale = 0.2;
          const cx = (minX + maxX) / 2;
          const cy = (minY + maxY) / 2;
          tx = W / 2 - cx * scale;
          ty = H / 2 - cy * scale;
        }
        d3.select(svgRef.current).transition().duration(600)
          .call(zoomRef.current!.transform as any, d3.zoomIdentity.translate(tx, ty).scale(scale));
      }
    }
  }, [searchTerm, graphData]);

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
      computeInitialPositions(data.nodes, typeHubNodes, W, H, rawLinksRef.current);
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

  const toggleRelationType = (id: number) => {
    setActiveRelationTypes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const stats = graphData ? { nodes: graphData.nodes.length, links: graphData.links.length } : { nodes: 0, links: 0 };
  const fullStats = fullGraphData ? { nodes: fullGraphData.nodes.length, links: fullGraphData.links.length } : stats;
  const focusNode = fullGraphData?.nodes.find(n => n.id === focusedNodeId) || graphData?.nodes.find(n => n.id === focusedNodeId) || null;
  const relationLegendItems = fullGraphData
    ? Object.values(fullGraphData.linkTypeMap).map((lt) => {
        const sample = fullGraphData.links.find(l => l._linkTypeId === lt.id);
        return {
          id: lt.id,
          name: lt.name || `LinkType ${lt.id}`,
          description: lt.description || '',
          color: sample?.color || LINKTYPE_COLORS[(lt.id - 1) % LINKTYPE_COLORS.length],
          count: fullGraphData.links.filter(l => l._linkTypeId === lt.id).length,
          visibleCount: graphData?.links.filter(l => l._linkTypeId === lt.id).length || 0,
        };
      })
    : [];

  // ==================== Styles ====================
  // Monokai-inspired palette for D3 overlay panels
  const panelBase: React.CSSProperties = {
    background: 'rgba(18, 19, 26, 0.78)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    fontSize: 12,
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: '#e2e8f0',
    textAlign: 'center',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.45)',
  };
  const controlPanelBase: React.CSSProperties = {
    ...panelBase,
    textAlign: 'left',
  };
  const btnStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.04)',
    color: '#f8f8f2',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    padding: '5px 12px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: 11,
    textAlign: 'center',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  };
  const panelBtnStyle: React.CSSProperties = { ...btnStyle };

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: '100%',
        background: 'radial-gradient(circle at center, #131b31 0%, #060913 100%)',
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
          }
        }}
      />

      {graphData && fullGraphData && (
        <div
          onMouseEnter={() => setIsPanelHovered(true)}
          onMouseLeave={() => setIsPanelHovered(false)}
          style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            ...panelBase,
            padding: isPanelHovered ? '8px 10px' : '4px 12px',
            width: isPanelHovered ? 'min(760px, calc(100% - 220px))' : 'auto',
            minWidth: 0,
            boxShadow: '0 10px 28px rgba(0,0,0,0.35)',
            borderRadius: isPanelHovered ? '8px' : '20px',
            transition: 'all 0.2s ease-in-out',
            opacity: isPanelHovered ? 1 : 0.85,
            border: isPanelHovered ? panelBase.border : '1.5px dashed rgba(255, 209, 102, 0.4)',
            cursor: 'pointer',
          }}
        >
          {!isPanelHovered ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#FFD166', whiteSpace: 'nowrap' }}>
              <span style={{
                display: 'inline-block',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#FFD166',
                boxShadow: '0 0 6px #FFD166',
              }} />
              核心节点与关系筛选面板 (悬浮展开)
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 150, flex: '1 1 170px' }}>
              <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2 }}>核心节点</div>
              <select
                value={focusedNodeId || ''}
                onChange={e => { setFocusedNodeId(e.target.value || null); setScopeMode('focus'); }}
                style={{
                  width: '100%', background: 'rgba(13,12,10,0.92)', color: '#f8f8f2',
                  border: '1px solid rgba(245,239,224,0.16)', borderRadius: 6,
                  padding: '4px 8px', fontSize: 11, outline: 'none',
                }}
              >
                {fullGraphData.nodes.filter(n => n.group === 'instance').map(node => (
                  <option key={node.id} value={node.id}>{node.label}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {[
                { id: 'focus' as ScopeMode, label: '一跳' },
                { id: 'two-hop' as ScopeMode, label: '二跳' },
                { id: 'all' as ScopeMode, label: '全图' },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === 'all') {
                      setFocusedNodeId(null);
                    } else if (!focusedNodeId && fullGraphData) {
                      setFocusedNodeId(pickDefaultFocusNode(fullGraphData));
                    }
                    setScopeMode(item.id);
                  }}
                  style={{
                    ...btnStyle,
                    borderColor: scopeMode === item.id ? '#FFD166' : 'rgba(245,239,224,0.12)',
                    color: scopeMode === item.id ? '#FFD166' : '#f8f8f2',
                    background: scopeMode === item.id ? 'rgba(255,209,102,0.12)' : btnStyle.background,
                  }}
                >
                  {item.label}
                </button>
              ))}
              <button
                onClick={() => setShowWeakLinks(v => !v)}
                style={{
                  ...btnStyle,
                  borderColor: showWeakLinks ? '#50fa7b' : 'rgba(245,239,224,0.12)',
                  color: showWeakLinks ? '#50fa7b' : '#f8f8f2',
                }}
              >
                {showWeakLinks ? '含弱关系' : '强关系'}
              </button>
            </div>
            <div style={{ color: '#cbd5e1', fontSize: 11, whiteSpace: 'nowrap', marginLeft: 'auto' }}>
              {stats.nodes}/{fullStats.nodes} 节点 · {stats.links}/{fullStats.links} 边
            </div>
          </div>
          {relationLegendItems.length > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 7 }}>
              {relationLegendItems.map(item => {
                const active = activeRelationTypes.size === 0 || activeRelationTypes.has(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleRelationType(item.id)}
                    title={item.description}
                    style={{
                      ...btnStyle,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '3px 7px',
                      opacity: active ? 1 : 0.42,
                      borderColor: active ? item.color : 'rgba(245,239,224,0.12)',
                    }}
                  >
                    <span style={{ width: 14, height: 2, background: item.color, display: 'inline-block' }} />
                    <span>{item.name}</span>
                    <span style={{ color: '#9ca3af' }}>{item.visibleCount}/{item.count}</span>
                  </button>
                );
              })}
              {activeRelationTypes.size > 0 && (
                <button onClick={() => setActiveRelationTypes(new Set())} style={{ ...btnStyle, color: '#9ca3af' }}>
                  全部类型
                </button>
              )}
            </div>
          )}
            </>
          )}
        </div>
      )}

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
                    padding: '6px 12px', borderRadius: 8, border: '1px solid #ae81ff',
                    background: 'rgba(0,0,0,0.4)', color: '#fff', fontSize: 12, width: 260,
                    outline: 'none',
                  }}
                />
                <button onClick={handleAIFill} disabled={isAiFilling} style={{ ...btnStyle, padding: '6px 14px', borderColor: '#ae81ff', color: '#ae81ff' }}>
                  {isAiFilling ? <Loader2 className="inline w-3.5 h-3.5 animate-spin" style={{ verticalAlign: 'middle' }} /> : <Sparkles className="inline w-3.5 h-3.5" style={{ verticalAlign: 'middle' }} />}
                </button>
                <button onClick={() => setShowAIFillInput(false)} style={{ ...btnStyle, padding: '6px 10px' }}>✕</button>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', pointerEvents: 'all' }}>
              <button onClick={handleAIFill} disabled={isAiFilling} style={{ ...btnStyle, padding: '6px 16px', fontSize: 12, borderColor: '#ae81ff', color: '#ae81ff' }}>
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
        <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 1000, ...controlPanelBase, padding: 12, width: 360, minWidth: 360, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 8, borderBottom: '1px solid rgba(245,239,224,0.12)', paddingBottom: 8, width: '100%' }}>
            <strong style={{ fontSize: 13, textAlign: 'left' }}>图谱控制面板</strong>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setShowHelp(!showHelp)} title="使用指南" style={{ ...panelBtnStyle, padding: '3px 8px', borderColor: showHelp ? 'rgba(99,102,241,0.5)' : undefined, color: showHelp ? '#a5b4fc' : undefined, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <HelpCircle className="inline w-3.5 h-3.5 mr-1" style={{ verticalAlign: 'middle' }} />
                使用指南
              </button>
              <button onClick={() => setShowControls(false)} style={{ ...panelBtnStyle, color: '#f92672', textAlign: 'center', justifyContent: 'center' }}>隐藏</button>
            </div>
          </div>
          {showHelp && (
            <div style={{ fontSize: 11, color: '#ccc', lineHeight: 1.7, textAlign: 'left', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: 4, marginBottom: 8, width: '100%' }}>
              <div>• 拖动节点 → 移动并钉住位置</div>
              <div>• 滚轮 / 双指 → 缩放视图</div>
              <div>• 双击节点 → 释放固定 + 聚焦</div>
              <div>• 右键节点 → 折叠 / 展开</div>
              <div style={{ marginTop: 6, color: '#888', fontSize: 10, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 4 }}>
                <strong>快捷键:</strong> Alt+C/I/L/S | Escape
              </div>
            </div>
          )}
          {/* AI Fill Topic Input (when controls panel is open) */}
          {showAIFillInput && (
            <div style={{ marginTop: 8, display: 'flex', gap: 6, width: '100%', justifyContent: 'flex-start' }}>
              <input
                autoFocus
                value={aiFillTopic}
                onChange={e => setAiFillTopic(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAIFill(); if (e.key === 'Escape') setShowAIFillInput(false); }}
                placeholder="输入图谱主题，回车确认"
                style={{
                  flex: 1, padding: '5px 10px', borderRadius: 6,
                  border: '1px solid #ae81ff', background: 'rgba(0,0,0,0.4)',
                  color: '#fff', fontSize: 11, outline: 'none', textAlign: 'left'
                }}
              />
              <button onClick={handleAIFill} disabled={isAiFilling} style={{ ...btnStyle, padding: '5px 10px', borderColor: '#ae81ff', color: '#ae81ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isAiFilling ? <Loader2 className="inline w-3 h-3 animate-spin" style={{ verticalAlign: 'middle' }} /> : <Sparkles className="inline w-3 h-3" style={{ verticalAlign: 'middle' }} />}
              </button>
              <button onClick={() => setShowAIFillInput(false)} style={{ ...btnStyle, padding: '5px 8px' }}>✕</button>
            </div>
          )}

          <div style={{ display: 'flex', gap: 5, marginTop: 10, flexWrap: 'wrap', width: '100%', justifyContent: 'flex-start' }}>
            <button onClick={fitAll} style={{ ...btnStyle, flex: 1, borderColor: '#4CAF50', color: '#4CAF50', textAlign: 'center', justifyContent: 'center' }}>Fit All</button>
            <button onClick={resetLayout} style={{ ...btnStyle, flex: 1, borderColor: '#F9A825', color: '#F9A825', textAlign: 'center', justifyContent: 'center' }}>重置布局</button>
            <button onClick={zoomIn} style={{ ...btnStyle, flex: 1, textAlign: 'center', justifyContent: 'center' }}>放大</button>
            <button onClick={zoomOut} style={{ ...btnStyle, flex: 1, textAlign: 'center', justifyContent: 'center' }}>缩小</button>
          </div>
          <div style={{ display: 'flex', gap: 5, marginTop: 5, width: '100%', justifyContent: 'flex-start' }}>
            <button onClick={() => { setShowAIFillInput(true); }} style={{ ...btnStyle, flex: 1, borderColor: '#ae81ff', color: '#ae81ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles className="inline w-3.5 h-3.5 mr-1" style={{ verticalAlign: 'middle' }} />
              AI 图谱生成
            </button>
            <button onClick={refreshGraph} style={{ ...btnStyle, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RefreshCw className="inline w-3.5 h-3.5 mr-1" style={{ verticalAlign: 'middle' }} />
              刷新数据
            </button>
            {focusedNodeId && (
              <button onClick={() => { setFocusedNodeId(null); setScopeMode('all'); }} style={{ ...btnStyle, flex: 1, background: '#E76F51', borderColor: '#E76F51', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                ✕ 退出降噪聚焦
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 5, marginTop: 5, width: '100%', justifyContent: 'flex-start' }}>
            <button
              onClick={() => {
                const nextVal = !clickToFocus;
                setClickToFocus(nextVal);
                if (!nextVal) {
                  setScopeMode('all');
                  setFocusedNodeId(null);
                } else if (selectedNode) {
                  setFocusedNodeId(selectedNode.id);
                  setScopeMode('focus');
                }
              }}
              style={{
                ...btnStyle,
                width: '100%',
                borderColor: clickToFocus ? '#FFD166' : 'rgba(245,239,224,0.15)',
                color: clickToFocus ? '#FFD166' : '#888',
                background: clickToFocus ? 'rgba(255,209,102,0.08)' : btnStyle.background,
                fontSize: 10,
                padding: '5px 8px',
                textAlign: 'left',
                justifyContent: 'flex-start',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              🎯 点击节点自动降噪聚焦: {clickToFocus ? '已开启' : '已关闭'}
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 5, width: '100%', alignItems: 'stretch' }}>
            <span style={{ fontSize: 10, color: '#888', marginBottom: 2 }}>📐 选择拓扑布局</span>
            <select
              value={layoutMode}
              onChange={e => setLayoutMode(e.target.value as any)}
              style={{
                width: '100%',
                padding: '6px 8px',
                borderRadius: '6px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                background: 'rgba(39, 40, 34, 0.88)',
                color: '#66d9ef',
                fontSize: 11,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="verticalTree">纵向层级树状 (Vertical Tree)</option>
              <option value="horizontalTree">横向层级树状 (Horizontal Tree)</option>
              <option value="dandelion">蒲公英径向 (Dandelion)</option>
              <option value="dagre">层级分层 (Dagre)</option>
              <option value="spoke">辐射骨架 (Spoke)</option>
              <option value="concentric">同心圆径向 (Radial)</option>
              <option value="starburst">星系辐射 (Starburst)</option>
              <option value="grid">网格排列 (Grid)</option>
              <option value="groupedCircular">分组环形 (Grouped Circular)</option>
              <option value="force">有机力导向 (Force)</option>
            </select>
          </div>

          {/* Quick Clear */}
          {showClearConfirm ? (
            <div style={{ marginTop: 8, padding: 8, border: '1px solid #ef4444', borderRadius: 6, background: 'rgba(239,68,68,0.08)', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
              <div style={{ fontSize: 11, color: '#f87171', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-start', textAlign: 'left' }}>
                <AlertTriangle className="inline w-3.5 h-3.5" />
                确认清空所有本体论数据？
              </div>
              <div style={{ display: 'flex', gap: 5, width: '100%', justifyContent: 'flex-start' }}>
                <button onClick={handleQuickClear} style={{ ...btnStyle, flex: 1, background: '#ef4444', borderColor: '#ef4444', color: '#fff', fontSize: 10, padding: '5px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 className="inline w-3 h-3 mr-1" />
                  确认清空
                </button>
                <button onClick={() => setShowClearConfirm(false)} style={{ ...btnStyle, flex: 1, fontSize: 10, padding: '5px 8px', textAlign: 'center', justifyContent: 'center' }}>
                  取消
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowClearConfirm(true)} style={{ ...btnStyle, marginTop: 5, width: '100%', borderColor: '#ef4444', color: '#f87171', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Trash2 className="inline w-3 h-3 mr-1" />
              快捷清空
            </button>
          )}
          
          {/* Physics Engine Controls */}
          <div style={{ marginTop: 10, borderTop: '1px solid #333', paddingTop: 8, width: '100%', textAlign: 'left' }}>
            <strong style={{ fontSize: 11, display: 'block', textAlign: 'left', marginBottom: 6 }}>物理力场调节</strong>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, width: '100%', alignItems: 'stretch' }}>
              <label style={{ display: 'flex', alignItems: 'center', fontSize: 10, gap: 8, width: '100%', justifyContent: 'flex-start' }}>
                <span style={{ width: 60, color: '#888', textAlign: 'left' }}>向心力</span>
                <input type="range" min="20" max="300" value={linkDistance} onChange={e => setLinkDistance(Number(e.target.value))} style={{ flex: 1, accentColor: '#FFD166', height: 4 }} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', fontSize: 10, gap: 8, width: '100%', justifyContent: 'flex-start' }}>
                <span style={{ width: 60, color: '#888', textAlign: 'left' }}>排斥力</span>
                <input type="range" min="-1000" max="-10" value={chargeStrength} onChange={e => setChargeStrength(Number(e.target.value))} style={{ flex: 1, accentColor: '#4CC9F0', height: 4 }} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', fontSize: 10, gap: 8, width: '100%', justifyContent: 'flex-start' }}>
                <span style={{ width: 60, color: '#888', textAlign: 'left' }}>防拥挤</span>
                <input type="range" min="0" max="50" value={collisionRadius} onChange={e => setCollisionRadius(Number(e.target.value))} style={{ flex: 1, accentColor: '#FF9CF7', height: 4 }} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', fontSize: 10, gap: 8, width: '100%', justifyContent: 'flex-start' }}>
                <span style={{ width: 60, color: '#888', textAlign: 'left' }}>引力阻尼</span>
                <input type="range" min="0.1" max="0.9" step="0.05" value={velocityDecay} onChange={e => setVelocityDecay(Number(e.target.value))} style={{ flex: 1, accentColor: '#A6E22E', height: 4 }} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', fontSize: 10, gap: 8, width: '100%', justifyContent: 'flex-start' }}>
                <span style={{ width: 60, color: '#888', textAlign: 'left' }}>重力收拢</span>
                <input type="range" min="0.0" max="0.5" step="0.05" value={gravityStrength} onChange={e => setGravityStrength(Number(e.target.value))} style={{ flex: 1, accentColor: '#AE81FF', height: 4 }} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', fontSize: 10, gap: 8, width: '100%', justifyContent: 'flex-start' }}>
                <span style={{ width: 60, color: '#888', textAlign: 'left' }}>连接刚度</span>
                <input type="range" min="0.05" max="1.0" step="0.05" value={linkStrength} onChange={e => setLinkStrength(Number(e.target.value))} style={{ flex: 1, accentColor: '#F92672', height: 4 }} />
              </label>
              <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
                <button onClick={() => { setLinkDistance(150); setChargeStrength(-180); setCollisionRadius(14); setVelocityDecay(0.4); setGravityStrength(0.15); setLinkStrength(0.4); }} style={{ ...btnStyle, fontSize: 9, padding: '2px 6px', opacity: 0.8, textAlign: 'center', justifyContent: 'center' }}>复位力场</button>
              </div>
            </div>
          </div>

          {/* Link Weight Filter */}
          <div style={{ marginTop: 10, borderTop: '1px solid #333', paddingTop: 8, width: '100%', textAlign: 'left' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, marginBottom: 6 }}>
              <strong style={{ fontSize: 11, textAlign: 'left' }}>关系强度过滤</strong>
              <span style={{ fontSize: 10, color: '#FFD166', textAlign: 'left' }}>
                {weightThreshold === 0 ? '显示全部' : `隐藏 weight < ${weightThreshold}`}
              </span>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', fontSize: 10, gap: 8, width: '100%', justifyContent: 'flex-start' }}>
              <span style={{ width: 60, color: '#888', textAlign: 'left' }}>过滤阈值</span>
              <input
                type="range" min="0" max="0.9" step="0.05"
                value={weightThreshold}
                onChange={e => setWeightThreshold(Number(e.target.value))}
                style={{ flex: 1, accentColor: '#FFD166', height: 4 }}
              />
              <span style={{ width: 24, color: '#ccc', fontSize: 10, textAlign: 'left' }}>{weightThreshold.toFixed(1)}</span>
            </label>
            <div style={{ display: 'flex', gap: 4, marginTop: 6, width: '100%', justifyContent: 'flex-start' }}>
              <button
                onClick={() => setWeightThreshold(0)}
                style={{ ...btnStyle, flex: 1, fontSize: 9, padding: '3px 6px', borderColor: weightThreshold === 0 ? '#FFD166' : undefined, color: weightThreshold === 0 ? '#FFD166' : undefined, textAlign: 'center', justifyContent: 'center' }}
              >全部</button>
              <button
                onClick={() => setWeightThreshold(0.5)}
                style={{ ...btnStyle, flex: 1, fontSize: 9, padding: '3px 6px', borderColor: weightThreshold === 0.5 ? '#FFD166' : undefined, color: weightThreshold === 0.5 ? '#FFD166' : undefined, textAlign: 'center', justifyContent: 'center' }}
              >强关系 (0.5)</button>
              <button
                onClick={() => setWeightThreshold(0.7)}
                style={{ ...btnStyle, flex: 1, fontSize: 9, padding: '3px 6px', borderColor: weightThreshold === 0.7 ? '#FFD166' : undefined, color: weightThreshold === 0.7 ? '#FFD166' : undefined, textAlign: 'center', justifyContent: 'center' }}
              >核心 (0.7)</button>
            </div>
          </div>

          {/* Search */}
          <div style={{ marginTop: 10, borderTop: '1px solid #333', paddingTop: 8, width: '100%', textAlign: 'left' }}>
            <strong style={{ fontSize: 11, display: 'block', textAlign: 'left', marginBottom: 6 }}>搜索拓扑图</strong>
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 5, width: '100%', justifyContent: 'flex-start' }}>
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
                  textAlign: 'left'
                }}
              />
              {searchTerm && <button onClick={() => setSearchTerm('')} style={{ ...btnStyle, marginLeft: 4 }}>✕</button>}
            </div>
            {searchHighlightedRef.current.length > 0 && (
              <div style={{ marginTop: 4, display: 'flex', gap: 4, width: '100%', justifyContent: 'flex-start' }}>
                <button onClick={() => navigateSearch(-1)} style={{ ...btnStyle, flex: 1, textAlign: 'center', justifyContent: 'center' }}>◀ 上一个</button>
                <button onClick={() => navigateSearch(1)} style={{ ...btnStyle, flex: 1, textAlign: 'center', justifyContent: 'center' }}>下一个 ▶</button>
              </div>
            )}
            {searchHighlightedRef.current.length > 0 && (
              <div style={{ marginTop: 3, fontSize: 10, color: '#00BFFF', textAlign: 'left' }}>
                找到 {searchHighlightedRef.current.length} 条结果
              </div>
            )}
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 5, flexDirection: 'column', width: '100%', alignItems: 'stretch' }}>
            <button onClick={() => setShowScanModal(true)} style={{ ...btnStyle, borderColor: '#FFD166', width: '100%', textAlign: 'center', justifyContent: 'center' }}>
              查看原始数据
            </button>
            <button onClick={downloadCSV} style={{ ...btnStyle, borderColor: '#4CAF50', width: '100%', textAlign: 'center', justifyContent: 'center' }}>
              下载 CSV
            </button>
            <button onClick={downloadExcelFile} style={{ ...btnStyle, borderColor: 'rgba(166,226,46,0.4)', width: '100%', textAlign: 'center', color: '#50fa7b', background: 'rgba(39,40,34,0.88)', justifyContent: 'center' }}>
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
            {relationLegendItems.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', marginTop: 4 }} title={item.description}>
                <svg width="36" height="10" style={{ marginRight: 5 }}>
                  <defs>
                    <marker id={`leg-arrow-linktype-${item.id}`} markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                      <polygon points="0 0, 6 2, 0 4" fill={item.color} />
                    </marker>
                  </defs>
                  <line
                    x1="0" y1="5" x2="26" y2="5"
                    stroke={item.color} strokeWidth="2.5"
                    strokeDasharray={LINKTYPE_DASH[(item.id - 1) % LINKTYPE_DASH.length]}
                    markerEnd={`url(#leg-arrow-linktype-${item.id})`}
                  />
                </svg>
                <span style={{ fontSize: 11, color: '#ccc' }}>{item.name} ({item.count})</span>
              </div>
            ))}
            {false && <div style={{ display: 'flex', alignItems: 'center', marginTop: 4 }}>
              <svg width="36" height="10" style={{ marginRight: 5 }}>
                <defs>
                  <marker id="leg-arrow-amber" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                    <polygon points="0 0, 6 2, 0 4" fill="#FFD166" />
                  </marker>
                  <marker id="leg-arrow-gray" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                    <polygon points="0 0, 6 2, 0 4" fill="rgba(255,255,255,0.55)" />
                  </marker>
                  <marker id="leg-arrow-amethyst" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                    <polygon points="0 0, 6 2, 0 4" fill="#FF9CF7" />
                  </marker>
                </defs>
                <line x1="0" y1="5" x2="26" y2="5" stroke="#FFD166" strokeWidth="2.5" markerEnd="url(#leg-arrow-amber)" />
              </svg>
              <span style={{ fontSize: 11, color: '#ccc' }}>关系连线</span>
            </div>}
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 4 }}>
              <svg width="36" height="10" style={{ marginRight: 5 }}>
                <line x1="0" y1="5" x2="26" y2="5" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" strokeDasharray="5 3" />
              </svg>
              <span style={{ fontSize: 11, color: '#ccc' }}>类型归属 (虚线)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 4 }}>
              <svg width="36" height="10" style={{ marginRight: 5 }}>
                <defs>
                  <marker id="leg-arrow-amethyst" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                    <polygon points="0 0, 6 2, 0 4" fill="#FF9CF7" />
                  </marker>
                </defs>
                <line x1="0" y1="5" x2="26" y2="5" stroke="#FF9CF7" strokeWidth="1" markerEnd="url(#leg-arrow-amethyst)" />
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
          position: 'absolute', right: 10, bottom: 10, zIndex: 1000,
          background: 'rgba(39,40,34,0.88)', border: '1px solid rgba(245,239,224,0.15)', borderRadius: 6,
          padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8,
          maxWidth: 'min(280px, calc(100% - 20px))',
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
            placeholder="搜索节点... (Alt+S)"
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

      <style>{`
        @keyframes nv-pulse { from { width: 20%; } to { width: 80%; } }
        
        .nv-dim {
          opacity: 0.12 !important;
          transition: opacity 0.4s ease-in-out;
        }
        .nv-dim-label {
          opacity: 0.12 !important;
          transition: opacity 0.4s ease-in-out;
        }
        .nv-node circle, .nv-node-label, .nv-link-instance {
          transition: opacity 0.3s ease, stroke-width 0.3s ease, stroke 0.3s ease;
        }
        
        @keyframes nv-glowing-pulse {
          0% {
            stroke: #00BFFF;
            stroke-width: 2px;
            filter: drop-shadow(0 0 2px rgba(0, 191, 255, 0.6));
          }
          50% {
            stroke: #66d9ef;
            stroke-width: 4px;
            filter: drop-shadow(0 0 8px rgba(102, 217, 239, 0.95));
          }
          100% {
            stroke: #00BFFF;
            stroke-width: 2px;
            filter: drop-shadow(0 0 2px rgba(0, 191, 255, 0.6));
          }
        }
        .nv-pulse-glow {
          animation: nv-glowing-pulse 1.6s infinite alternate ease-in-out !important;
        }

        /* Automatic button/input hover effects for all panels inside the D3 container */
        div[style*="position: absolute"] button,
        div[style*="position: 'absolute'"] button {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        div[style*="position: absolute"] button:hover:not(:disabled),
        div[style*="position: 'absolute'"] button:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.08) !important;
          border-color: rgba(255, 255, 255, 0.25) !important;
          transform: translateY(-1px);
        }
        div[style*="position: absolute"] button:active:not(:disabled),
        div[style*="position: 'absolute'"] button:active:not(:disabled) {
          transform: translateY(0);
        }
        div[style*="position: absolute"] input,
        div[style*="position: absolute"] select {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        div[style*="position: absolute"] input:focus,
        div[style*="position: absolute"] select:focus {
          border-color: rgba(255, 255, 255, 0.3) !important;
          box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.05);
        }

        .nv-context-menu {
          position: absolute;
          z-index: 2100;
          background: rgba(18, 19, 26, 0.95);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 4px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
          min-width: 140px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .nv-context-menu-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          font-size: 11px;
          color: #e2e8f0;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.15s ease;
          background: transparent;
          border: none;
          text-align: left;
          width: 100%;
        }
        .nv-context-menu-item:hover {
          background: rgba(255, 255, 255, 0.06);
          color: #ffffff;
        }
        .nv-context-menu-item.danger {
          color: #f87171;
        }
        .nv-context-menu-item.danger:hover {
          background: rgba(239, 68, 68, 0.15);
          color: #fca5a5;
        }
      `}</style>

      {showHelp && (
        <CanvasHelpPanel
          config={{ type: 'graph' }}
          onClose={() => setShowHelp(false)}
        />
      )}

      {/* ==================== Hover Tooltip Card ==================== */}
      {hoveredNode && graphData && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(tooltipPos.x + 14, (containerRef.current?.clientWidth ?? 800) - 260),
            top: Math.min(tooltipPos.y - 8, (containerRef.current?.clientHeight ?? 600) - 320),
            zIndex: 1500,
            minWidth: 220,
            maxWidth: 260,
            background: 'rgba(13,12,10,0.96)',
            border: `1.5px solid ${hoveredNode.color || 'rgba(245,239,224,0.2)'}`,
            borderRadius: 10,
            padding: '10px 12px',
            pointerEvents: 'none',
            boxShadow: `0 4px 20px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)`,
            backdropFilter: 'blur(8px)',
          }}
        >
          {(() => {
            const d = hoveredNode;
            const connLinks = graphData.links.filter(l => {
              const s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
              const t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
              return s === d.id || t === d.id;
            });
            const nodeMap = new Map(graphData.nodes.map(n => [n.id, n]));
            const getNodeLabel = (id: string) => nodeMap.get(id)?.label || id;

            // Collect connected nodes grouped by link type
            const connMap: Record<string, { label: string; weight: number }[]> = {};
            connLinks.forEach(l => {
              const s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
              const t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
              const otherId = s === d.id ? t : s;
              const otherNode = nodeMap.get(otherId);
              if (!otherNode) return;
              const relName = l._linkTypeName || graphData.linkTypeMap[l._linkTypeId ?? -1]?.name || '关联';
              if (!connMap[relName]) connMap[relName] = [];
              if (!connMap[relName].find(c => c.label === otherNode.label)) {
                connMap[relName].push({ label: otherNode.label, weight: Number(l.weight) || 0.5 });
              }
            });

            return (
              <>
                {/* Header: label + type */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: d.color, flexShrink: 0,
                    boxShadow: `0 0 6px ${d.color}80`,
                  }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#f8f8f2', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.label}
                  </span>
                </div>

                {/* Type badge */}
                <div style={{ marginBottom: 8 }}>
                  {d.group === 'typeHub' && (
                    <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: `${d.color}30`, color: d.color, border: `1px solid ${d.color}50`, fontWeight: 600 }}>
                      类型 {d._instanceCount !== undefined ? `· ${d._instanceCount} 个实例` : ''}
                    </span>
                  )}
                  {d.group === 'instance' && (
                    <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: `${d.color}30`, color: d.color, border: `1px solid ${d.color}50`, fontWeight: 600 }}>
                      实例
                    </span>
                  )}
                  {d.group === 'action' && (
                    <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: `${d.color}30`, color: d.color, border: `1px solid ${d.color}50`, fontWeight: 600 }}>
                      行动
                    </span>
                  )}
                </div>

                {/* TypeHub: show description */}
                {d.group === 'typeHub' && d.description && (
                  <div style={{ fontSize: 10, color: '#888', marginBottom: 6, lineHeight: 1.5 }}>
                    {d.description.slice(0, 60)}{d.description.length > 60 ? '…' : ''}
                  </div>
                )}

                {/* Instance: show top properties */}
                {d.group === 'instance' && d._propsRaw && (() => {
                  let parsed: Record<string, any> = {};
                  try { parsed = JSON.parse(d._propsRaw); } catch { /* non-JSON */ }
                  const keys = Object.keys(parsed).filter(k => !k.startsWith('_')).slice(0, 4);
                  if (keys.length === 0) return null;
                  return (
                    <div style={{ marginBottom: 8 }}>
                      {keys.map(k => {
                        const v = parsed[k];
                        const vStr = typeof v === 'object' ? JSON.stringify(v).slice(0, 20) : String(v);
                        return (
                          <div key={k} style={{ display: 'flex', gap: 4, fontSize: 10, lineHeight: 1.7 }}>
                            <span style={{ color: '#ae81ff', flexShrink: 0 }}>{k}:</span>
                            <span style={{ color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vStr}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Connected relations summary */}
                {Object.keys(connMap).length > 0 && (
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6 }}>
                    <div style={{ fontSize: 9, color: '#555', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      关联 {connLinks.length} 个节点
                    </div>
                    {Object.entries(connMap).slice(0, 4).map(([rel, nodes]) => (
                      <div key={rel} style={{ marginBottom: 3 }}>
                        <div style={{ fontSize: 9, color: '#666', marginBottom: 1 }}>{rel}</div>
                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                          {nodes.slice(0, 3).map(n => (
                            <span key={n.label} style={{
                              fontSize: 9, padding: '1px 5px', borderRadius: 3,
                              background: 'rgba(255,255,255,0.06)', color: '#aaa',
                              maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {n.label}
                            </span>
                          ))}
                          {nodes.length > 3 && (
                            <span style={{ fontSize: 9, color: '#555' }}>+{nodes.length - 3}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Footer hint */}
                <div style={{ marginTop: 6, fontSize: 9, color: '#444', textAlign: 'center' }}>
                  单击查看详情 · 右键折叠/展开
                </div>
              </>
            );
          })()}
        </div>
      )}

      {contextMenu && (
        <div
          className="nv-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={e => e.stopPropagation()}
        >
          <button
            className="nv-context-menu-item"
            onClick={() => {
              setSelectedNode(contextMenu.node);
              showNodeInfo(contextMenu.node, graphDataRef.current);
              setFocusedNodeId(contextMenu.node.id);
              setScopeMode('focus');
              setContextMenu(null);
            }}
          >
            🎯 聚焦与查看详情
          </button>
          <button
            className="nv-context-menu-item"
            onClick={() => {
              toggleNodeCollapse(contextMenu.node.id, nodesRef.current, graphDataRef.current?.links || [], allNodeGroupsRef.current as any, labelElsRef.current as any, linkElsRef.current as any, collapsedRef.current);
              setContextMenu(null);
            }}
          >
            🔄 折叠 / 展开关系
          </button>
          <button
            className="nv-context-menu-item danger"
            onClick={() => {
              if (confirm(`确定要删除此节点 "${contextMenu.node.label}" 吗？该操作同时会删除相关的连线与数据。`)) {
                handleContextMenuDelete(contextMenu.node);
              } else {
                setContextMenu(null);
              }
            }}
          >
            🗑️ 删除该节点
          </button>
        </div>
      )}

      {toast && (
        <ToastNotification
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default D3GraphView;
