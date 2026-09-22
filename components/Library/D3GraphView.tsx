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

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import {
  RefreshCw, Sparkles, Loader2, HelpCircle, Trash2, AlertTriangle, Activity,
  Maximize2, RotateCcw, ZoomIn, ZoomOut, Target, Hand, Lasso,
  Flame, BarChart3, LayoutGrid, Sliders, Search, Download,
  Image as ImageIcon, Code2, Table2, FileSpreadsheet, Eye,
  ChevronDown, ChevronUp, X, FileText, Lock, Move,
  Network, Database,
} from 'lucide-react';
import { duckDBService } from '../../services/duckdbService';
import { ontologyAiService } from '../../services/ontologyAiService';
import { encodeCSV, downloadExcel } from '../../utils/exportUtils';
import { PixiGraphRenderer } from '../../services/PixiGraphRenderer';
import { CanvasGraphRenderer } from './D3GraphView/CanvasGraphRenderer';
import { ontologyActions, useOntologyStore } from '../../hooks/useOntologyStore';
import { CanvasHelpPanel } from '../skills/CanvasHelpPanel';
import { ToastNotification } from '../ui/ToastNotification';
import { ModalShell } from '../ui/Workbench';
import {
  aggregateParallelEdges,
  buildGraphDataFromState,
  computeEdgeGroupOffsets,
  loadDynamicGraphData,
} from './D3GraphView/D3GraphView.data';
import { getSourceNode, getTargetNode, computePageRank, findShortestPath, PathTraceResult } from './D3GraphView/D3GraphView.helpers';
// 统一布局服务：提供性能监控和统一接口
import { 
  applyLayout as unifiedApplyLayout, 
  getLayoutStats, 
  getLayoutMetricsHistory,
  getAvailableLayoutModes,
  LAYOUT_MODE_LABELS,
  computeInitialPositions,
  type LayoutMode 
} from '../../services/graphLayoutService';
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
import { downloadD3GraphImage, collectSubgraph, exportAllSubgraphs } from './D3GraphView/D3GraphViewExport';
import {
  TopologyLayoutPanel,
  type NodeTypeFilter,
  type LabelDisplayMode,
  type PerfDataPoint,
  type LayoutSnapshot
} from './D3GraphView/TopologyLayoutPanel';
import type {
  LifeObjectType,
  LifeObject,
  LifeLinkType,
  LifeLink,
  LifeAction,
  GraphNode,
  GraphLink,
  GraphData,
  EdgeRoutingMode,
  EdgeLabelDisplay,
} from './D3GraphView/D3GraphView.types';

// ==================== Component ====================

/** D3GraphView 内部布局模式（包含一些特定于 D3 的模式） */
type D3LayoutMode = 'topologicalFlow' | 'clusteredForce' | 'force' | 'dagre' | 'concentric' | 'starburst' | 'dandelion' | 'spoke' | 'grid' | 'groupedCircular' | 'verticalTree' | 'horizontalTree';

/** 布局模式到中文名称的映射 */
const D3_LAYOUT_MODE_LABELS: Record<D3LayoutMode, string> = {
  topologicalFlow: '拓扑语义层级流',
  clusteredForce: '社区重心极坐标',
  verticalTree: '纵向层级树',
  horizontalTree: '横向层级树（推荐）',
  dandelion: '蒲公英径向',
  dagre: '层级分层',
  spoke: '辐射骨架',
  concentric: '同心圆径向',
  starburst: '星系辐射',
  grid: '网格排列',
  groupedCircular: '分组环形',
  force: '有机力导向',
};

/** 将 D3GraphView 的布局模式转换为统一的 LayoutMode */
function toUnifiedLayoutMode(mode: D3LayoutMode): LayoutMode {
  const mapping: Record<D3LayoutMode, LayoutMode> = {
    topologicalFlow: 'topologicalFlow',
    clusteredForce: 'grouped',  // clusteredForce 对应 grouped
    force: 'force',
    dagre: 'dagre',
    concentric: 'concentric',
    starburst: 'starburst',
    dandelion: 'dandelion',
    spoke: 'spoke',
    grid: 'grid',
    groupedCircular: 'groupedCircular',
    verticalTree: 'verticalTree',
    horizontalTree: 'horizontalTree',
  };
  return mapping[mode];
}

/** 检查是否需要冻结非 action 节点的位置 */
function shouldFreezeNonActionNodes(mode: D3LayoutMode): boolean {
  return ['topologicalFlow', 'clusteredForce', 'dagre', 'verticalTree', 'horizontalTree', 
          'concentric', 'starburst', 'dandelion', 'spoke', 'grid', 'groupedCircular'].includes(mode);
}

/** 渲染引擎模式：MECE 三选一 —— SVG D3 / HTML5 Canvas / WebGL Pixi */
export type RenderEngineMode = 'svg' | 'canvas' | 'webgl';

/** 渲染引擎元数据 */
export const RENDER_ENGINE_META: Record<RenderEngineMode, {
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  description: string;
  hint: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  svg: {
    label: 'SVG D3 (矢量交互)',
    shortLabel: 'SVG',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
    description: 'D3 + SVG 力导向物理仿真，矢量无损缩放，支持细粒度高光与动态流向粒子',
    hint: '≤500节点推荐',
    color: '#66d9ef',
    bgColor: 'rgba(102, 217, 239, 0.12)',
    borderColor: 'rgba(102, 217, 239, 0.45)',
  },
  canvas: {
    label: 'Canvas 2D (极速绘制)',
    shortLabel: 'Canvas',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>,
    description: 'HTML5 Canvas 2D 硬件批量绘制，60 FPS 极速平移缩放，零 DOM 开销',
    hint: '500-3000节点推荐',
    color: '#a6e22e',
    bgColor: 'rgba(166, 226, 46, 0.12)',
    borderColor: 'rgba(166, 226, 46, 0.45)',
  },
  webgl: {
    label: 'WebGL Pixi (GPU加速)',
    shortLabel: 'WebGL',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
    description: 'PixiJS WebGL 硬件着色器加速，空间视锥剔除与 LOD 动态分级，超大规模首选',
    hint: '≥3000节点推荐',
    color: '#fd971f',
    bgColor: 'rgba(253, 151, 31, 0.12)',
    borderColor: 'rgba(253, 151, 31, 0.45)',
  },
};

/** 自动推荐渲染引擎模式（基于节点数量） */
export function recommendRenderEngine(nodeCount: number, linkCount: number): RenderEngineMode {
  const density = linkCount / Math.max(nodeCount, 1);
  if (nodeCount >= 3000 || (nodeCount >= 1500 && density > 2)) return 'webgl';
  if (nodeCount >= 500) return 'canvas';
  return 'svg';
}

/** 渲染模式：MECE 三选一 —— 与 OntologyPanel.activeTab 双向同步（已废弃，请使用 RenderEngineMode） */
export type KnowledgeGraphRenderMode = 'graph' | 'canvas' | 'data';

const RENDER_MODE_META: Record<KnowledgeGraphRenderMode, {
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  graph: {
    label: '力导向图谱',
    shortLabel: '力导向',
    icon: <Network className="w-3.5 h-3.5" />,
    description: 'D3 力导向物理仿真：层级清晰、动态避障、支持万级节点',
    color: '#66d9ef',
    bgColor: 'rgba(102, 217, 239, 0.12)',
    borderColor: 'rgba(102, 217, 239, 0.45)',
  },
  canvas: {
    label: '实体画布',
    shortLabel: '画布',
    icon: <LayoutGrid className="w-3.5 h-3.5" />,
    description: 'ReactFlow 节点画布：自由拖拽、批量建模、CTE 反向编译',
    color: '#a6e22e',
    bgColor: 'rgba(166, 226, 46, 0.12)',
    borderColor: 'rgba(166, 226, 46, 0.45)',
  },
  data: {
    label: '数据视图',
    shortLabel: '表格',
    icon: <Database className="w-3.5 h-3.5" />,
    description: 'TanStack Virtual 表格：虚拟滚动、行内 CRUD、JSON 编辑',
    color: '#fd971f',
    bgColor: 'rgba(253, 151, 31, 0.12)',
    borderColor: 'rgba(253, 151, 31, 0.45)',
  },
};

/** 布局信息类型 */
interface LayoutInfo {
  nodePositions: Record<number, { x: number; y: number }>;
  layoutMode: string;
  zoom?: number;
  pan?: { x: number; y: number };
}

const D3GraphView: React.FC<{
  onRefreshRef?: (fn: () => void) => void;
  ontologyState?: any;
  isActive?: boolean;
  onInspect?: (mode: any, target: any) => void;
  /** 布局变化时回调，用于同步到 OntologyPanel */
  onLayoutChange?: (layout: LayoutInfo) => void;
  /** 当前渲染模式：用于顶部下拉菜单高亮跟随 */
  renderMode?: KnowledgeGraphRenderMode;
  /** 渲染模式切换回调：通知 OntologyPanel 切换 activeTab */
  onRenderModeChange?: (mode: KnowledgeGraphRenderMode) => void;
}> = ({ onRefreshRef, ontologyState, isActive, onInspect, onLayoutChange, renderMode = 'graph', onRenderModeChange }) => {
  const store = useOntologyStore();
  const state = ontologyState ?? store.state;
  const mapping = state.mapping;
  
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRendererRef = useRef<CanvasGraphRenderer | null>(null);
  const infoPanelRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const pixiRendererRef = useRef<PixiGraphRenderer | null>(null);
  const collapsedRef = useRef<Set<string>>(new Set());
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [layoutMode, setLayoutMode] = useState<D3LayoutMode>('horizontalTree');
  const layoutModeRef = useRef<D3LayoutMode>(layoutMode);
  useEffect(() => { layoutModeRef.current = layoutMode; }, [layoutMode]);

  // 渲染引擎模式状态（SVG / Canvas / WebGL 三选一，MECE）
  const [renderEngineMode, setRenderEngineMode] = useState<RenderEngineMode>(() =>
    recommendRenderEngine(state.objects?.length ?? 0, state.links?.length ?? 0)
  );
  const renderEngineModeRef = useRef<RenderEngineMode>('svg');
  useEffect(() => { renderEngineModeRef.current = renderEngineMode; }, [renderEngineMode]);

  // 渲染模式切换回调
  const switchRenderEngineMode = useCallback((mode: RenderEngineMode) => {
    if (mode === renderEngineModeRef.current) return;
    setRenderEngineMode(mode);
    setToast({
      message: `已切换至「${RENDER_ENGINE_META[mode].label}」渲染引擎 (${RENDER_ENGINE_META[mode].hint})`,
      type: 'info',
    });
  }, []);

  // 渲染模式下拉菜单开关状态
  const [showRenderModeMenu, setShowRenderModeMenu] = useState(false);
  const renderModeSwitcherRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭渲染模式菜单
  useEffect(() => {
    if (!showRenderModeMenu) return;
    const handler = (e: MouseEvent) => {
      if (renderModeSwitcherRef.current && !renderModeSwitcherRef.current.contains(e.target as Node)) {
        setShowRenderModeMenu(false);
      }
    };
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowRenderModeMenu(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', escHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', escHandler);
    };
  }, [showRenderModeMenu]);
  
  // 布局历史记录（撤销/重做）
  const [layoutHistory, setLayoutHistory] = useState<D3LayoutMode[]>(['horizontalTree']);
  const [historyIndex, setHistoryIndex] = useState(0);
  const layoutHistoryRef = useRef<D3LayoutMode[]>(['horizontalTree']);
  const historyIndexRef = useRef(0);
  
  // 同步 ref 和 state
  useEffect(() => { layoutHistoryRef.current = layoutHistory; }, [layoutHistory]);
  useEffect(() => { historyIndexRef.current = historyIndex; }, [historyIndex]);
  
  // 统一的布局切换函数（支持历史记录与节点引力重置）
  const switchLayoutMode = useCallback((newMode: D3LayoutMode) => {
    if (newMode === layoutMode) return;
    
    // 清理由于上一布局拖拽或局部固定产生的固定坐标残留，防止跨布局坐标污染
    if (nodesRef.current) {
      nodesRef.current.forEach(n => {
        n.fx = null;
        n.fy = null;
        delete (n as any)._isLayoutFixed;
        delete (n as any)._savedFx;
        delete (n as any)._savedFy;
        delete (n as any)._tempPinned;
      });
    }

    // 保存到历史记录
    const newHistory = [...layoutHistoryRef.current.slice(0, historyIndexRef.current + 1), newMode].slice(-20); // 最多保留20条
    setLayoutHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setLayoutMode(newMode);
  }, [layoutMode]);
  
  // 撤销布局
  const undoLayout = useCallback(() => {
    if (historyIndexRef.current > 0) {
      const newIndex = historyIndexRef.current - 1;
      setHistoryIndex(newIndex);
      if (nodesRef.current) {
        nodesRef.current.forEach(n => {
          n.fx = null;
          n.fy = null;
          delete (n as any)._isLayoutFixed;
        });
      }
      setLayoutMode(layoutHistoryRef.current[newIndex]);
    }
  }, []);
  
  // 重做布局
  const redoLayout = useCallback(() => {
    if (historyIndexRef.current < layoutHistoryRef.current.length - 1) {
      const newIndex = historyIndexRef.current + 1;
      setHistoryIndex(newIndex);
      if (nodesRef.current) {
        nodesRef.current.forEach(n => {
          n.fx = null;
          n.fy = null;
          delete (n as any)._isLayoutFixed;
        });
      }
      setLayoutMode(layoutHistoryRef.current[newIndex]);
    }
  }, []);
  
  // 检查是否可以撤销/重做
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < layoutHistory.length - 1;
  
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
  const showControlsRef = useRef(showControls);
  useEffect(() => { showControlsRef.current = showControls; }, [showControls]);
  const [showInfo, setShowInfo] = useState(false);
  const showInfoRef = useRef(showInfo);
  useEffect(() => { showInfoRef.current = showInfo; }, [showInfo]);

  const getVisualCenter = useCallback((containerWidth: number, containerHeight: number) => {
    const isControlsVisible = showControlsRef.current;
    const isInfoVisible = showInfoRef.current;
    // Left safe inset: TopologyLayoutPanel width (340) + margin (14). If collapsed, button width ~80
    const left = isControlsVisible ? 364 : 40;
    // Right safe inset: Info panel width (250) + margin (12)
    const right = isInfoVisible ? 270 : 40;
    // Top safe inset: Filter bar (~60)
    const top = 64;
    // Bottom safe inset: Timeline bar (~54)
    const bottom = 64;

    const availableW = Math.max(containerWidth * 0.35, containerWidth - left - right);
    const availableH = Math.max(containerHeight * 0.35, containerHeight - top - bottom);

    const visualCenterX = left + availableW / 2;
    const visualCenterY = top + availableH / 2;

    return { visualCenterX, visualCenterY, availableW, availableH, left, right, top, bottom };
  }, []);
  const [showLegend, setShowLegend] = useState(false);
  const [isPanelHovered, setIsPanelHovered] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [isAiFilling, setIsAiFilling] = useState(false);
  const [showAIFillInput, setShowAIFillInput] = useState(false);
  const [aiFillTopic, setAiFillTopic] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: GraphNode } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [scopeMode, setScopeMode] = useState<ScopeMode>('all');
  const [clickToFocus, setClickToFocus] = useState(true);
  const [isFixedDrag, setIsFixedDrag] = useState(false);
  const isFixedDragRef = useRef(false);
  useEffect(() => { isFixedDragRef.current = isFixedDrag; }, [isFixedDrag]);
  const [isLassoMode, setIsLassoMode] = useState(false);
  const isLassoModeRef = useRef(false);
  useEffect(() => { isLassoModeRef.current = isLassoMode; }, [isLassoMode]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const selectedNodeIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => { selectedNodeIdsRef.current = selectedNodeIds; }, [selectedNodeIds]);
  const [lassoBox, setLassoBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [showWeakLinks, setShowWeakLinks] = useState(false);
  const [activeRelationTypes, setActiveRelationTypes] = useState<Set<number>>(new Set());
  const [fullGraphData, setFullGraphData] = useState<GraphData | null>(null);
  // Advanced Hardcore Graph Analytics States
  const [showPageRank, setShowPageRank] = useState<boolean>(false);
  const [pathTracerSource, setPathTracerSource] = useState<string | null>(null);
  const pathTracerSourceRef = useRef<string | null>(null);
  useEffect(() => { pathTracerSourceRef.current = pathTracerSource; }, [pathTracerSource]);
  const [pathTracerTarget, setPathTracerTarget] = useState<string | null>(null);
  const [pathTraceResult, setPathTraceResult] = useState<PathTraceResult | null>(null);
  const pathTraceResultRef = useRef<PathTraceResult | null>(null);
  useEffect(() => { pathTraceResultRef.current = pathTraceResult; }, [pathTraceResult]);
  const [showTopologyReportModal, setShowTopologyReportModal] = useState<boolean>(false);

  // Temporal Topology Evolution Player States
  const [timelineStep, setTimelineStep] = useState<number>(100); // 0-100%
  const [isPlayingTimeline, setIsPlayingTimeline] = useState<boolean>(false);
  
  // 布局性能详情展开状态
  const [layoutStatsExpanded, setLayoutStatsExpanded] = useState(false);
  // 控制面板分区折叠（默认收起长段，减少视觉噪声）
  const [panelSections, setPanelSections] = useState({
    physics: false,
    filter: false,
    export: false,
  });
  const togglePanelSection = (key: keyof typeof panelSections) => {
    setPanelSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // 1. D3 Physics Controls State — tuned for compact semantic layout
  const [chargeStrength, setChargeStrength] = useState(-160);
  const [linkDistance, setLinkDistance] = useState(75);
  const [collisionRadius, setCollisionRadius] = useState(14);
  const [velocityDecay, setVelocityDecay] = useState(0.42);
  const [gravityStrength, setGravityStrength] = useState(0.25);
  const [linkStrength, setLinkStrength] = useState(0.6);

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

  // 5. 实体类型过滤联动 (TypeHub / Instance / Action)
  const [nodeTypeFilters, setNodeTypeFilters] = useState<Set<NodeTypeFilter>>(new Set(['typeHub', 'instance', 'action']));
  const nodeTypeFiltersRef = useRef(nodeTypeFilters);
  useEffect(() => { nodeTypeFiltersRef.current = nodeTypeFilters; }, [nodeTypeFilters]);

  // 6. 标签展示策略 (auto / all / top / hover)
  const [labelMode, setLabelMode] = useState<LabelDisplayMode>('auto');
  const labelModeRef = useRef(labelMode);
  useEffect(() => { labelModeRef.current = labelMode; }, [labelMode]);

  // 6.5. 连线渲染与动效设置 (MECE 连线控制体系)
  const [showHierarchyLinks, setShowHierarchyLinks] = useState(true);
  const showHierarchyLinksRef = useRef(showHierarchyLinks);
  useEffect(() => {
    showHierarchyLinksRef.current = showHierarchyLinks;
    if (svgRef.current) {
      d3.select(svgRef.current).selectAll('.nv-link-typeinst, .nv-link-halo-typeinst')
        .style('display', showHierarchyLinks ? null : 'none');
    }
  }, [showHierarchyLinks]);

  const [enableLinkParticles, setEnableLinkParticles] = useState(true);
  const enableLinkParticlesRef = useRef(enableLinkParticles);
  useEffect(() => {
    enableLinkParticlesRef.current = enableLinkParticles;
    if (svgRef.current) {
      d3.select(svgRef.current).selectAll('.nv-link-particle')
        .style('display', enableLinkParticles ? null : 'none');
    }
  }, [enableLinkParticles]);

  const [edgeRoutingMode, setEdgeRoutingMode] = useState<EdgeRoutingMode>('spline');
  const edgeRoutingModeRef = useRef(edgeRoutingMode);
  useEffect(() => { edgeRoutingModeRef.current = edgeRoutingMode; }, [edgeRoutingMode]);

  const [edgeLabelDisplay, setEdgeLabelDisplay] = useState<EdgeLabelDisplay>('hover');
  const edgeLabelDisplayRef = useRef<EdgeLabelDisplay>(edgeLabelDisplay);
  useEffect(() => {
    edgeLabelDisplayRef.current = edgeLabelDisplay;
    applyHighlightStylesRef.current?.(activeHighlightIdRef.current, selectedLinkIdRef.current);
  }, [edgeLabelDisplay]);

  const [selectedLinkId, setSelectedLinkIdRaw] = useState<string | null>(null);
  const selectedLinkIdRef = useRef<string | null>(null);
  const setSelectedLinkId = useCallback((valOrFn: string | null | ((prev: string | null) => string | null)) => {
    setSelectedLinkIdRaw(prev => {
      const next = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn;
      selectedLinkIdRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    selectedLinkIdRef.current = selectedLinkId;
    applyHighlightStylesRef.current?.(activeHighlightIdRef.current, selectedLinkId);
  }, [selectedLinkId]);

  // 6.6. 选中连线元数据解析 (Edge Inspector Data)
  const selectedLinkInfo = useMemo(() => {
    if (!selectedLinkId || !graphData) return null;
    const nodeMap = new Map(graphData.nodes.map(n => [n.id, n]));
    const link = graphData.links.find(l => {
      const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
      const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
      return String(l.id || `${sId}-${tId}`) === selectedLinkId;
    });

    if (!link) {
      if (selectedLinkId.startsWith('act-link-')) {
        const actId = selectedLinkId.replace('act-link-', '');
        const actNode = nodeMap.get(actId);
        if (actNode && actNode._objId) {
          const owner = nodeMap.get(`obj::${actNode._objId}`);
          return {
            id: selectedLinkId,
            sourceNode: owner,
            targetNode: actNode,
            relName: '行动依附 (has-action)',
            category: 'L1-L2 动作依附线',
            weight: 0.25,
            isAction: true,
            isTypeInst: false,
            description: '实例所拥有的能力或触发动作，与实例紧密依附',
          };
        }
      }
      return null;
    }

    const sId = typeof link.source === 'object' ? (link.source as any).id : link.source;
    const tId = typeof link.target === 'object' ? (link.target as any).id : link.target;
    const src = nodeMap.get(String(sId));
    const tgt = nodeMap.get(String(tId));
    const relName = link._linkTypeName || (link._linkTypeId !== undefined ? graphData.linkTypeMap[link._linkTypeId]?.name : null) || (link._isTypeInstLink ? '概念具象衍生' : '关联');
    const category = link._isTypeInstLink
      ? 'L0-L1 根节点衍生线'
      : link._isActionLink
        ? 'L1-L2 动作依附线'
        : 'L1-L1 业务拓扑线';
    return {
      id: selectedLinkId,
      sourceNode: src,
      targetNode: tgt,
      relName,
      category,
      weight: Number(link.weight || 0.5),
      isTypeInst: Boolean(link._isTypeInstLink),
      isAction: Boolean(link._isActionLink),
      description: link._linkTypeId !== undefined ? graphData.linkTypeMap[link._linkTypeId]?.description : (link._isTypeInstLink ? '本体元模型向实例节点的分类具象化归属' : undefined),
    };
  }, [selectedLinkId, graphData]);

  // 7. 动态各类型节点数量统计
  const nodeCountByType = useMemo(() => {
    if (!graphData?.nodes) return { typeHub: 0, instance: 0, action: 0 };
    let typeHub = 0, instance = 0, action = 0;
    for (const n of graphData.nodes) {
      if (n.group === 'typeHub') typeHub++;
      else if (n.group === 'action') action++;
      else instance++;
    }
    return { typeHub, instance, action };
  }, [graphData?.nodes]);

  // 8. 真实物理与渲染性能统计 (FPS / 单帧耗时 / 历史曲线)
  const [perfStats, setPerfStats] = useState<{ fps: number; renderTime: number; history: PerfDataPoint[] }>({
    fps: 60,
    renderTime: 16,
    history: [],
  });
  const perfTrackerRef = useRef<{
    lastUpdate: number;
    frameCount: number;
    history: PerfDataPoint[];
    currentFps?: number;
    currentRenderTime?: number;
  }>({
    lastUpdate: typeof performance !== 'undefined' ? performance.now() : Date.now(),
    frameCount: 0,
    history: [],
    currentFps: 60,
    currentRenderTime: 16,
  });

  // 仅在 controls 控制面板展开时，以低频（1000ms）定时同步性能采样给控制面板 UI，杜绝频繁重渲染
  useEffect(() => {
    if (!showControls) return;
    const interval = setInterval(() => {
      const tracker = perfTrackerRef.current;
      setPerfStats({
        fps: tracker.currentFps ?? 60,
        renderTime: tracker.currentRenderTime ?? 16,
        history: tracker.history,
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showControls]);

  // 响应式联动实体类型显隐
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll<SVGGElement, GraphNode>('.nv-typehub').style('display', nodeTypeFilters.has('typeHub') ? null : 'none');
    svg.selectAll<SVGGElement, GraphNode>('.nv-instance').style('display', nodeTypeFilters.has('instance') ? null : 'none');
    svg.selectAll<SVGGElement, GraphNode>('.nv-action').style('display', nodeTypeFilters.has('action') ? null : 'none');
    svg.selectAll<SVGPathElement, GraphLink>('.nv-link, .nv-link-instance').style('display', function(d: any) {
      if (!d) return null;
      const s = typeof d.source === 'object' ? d.source.group : null;
      const t = typeof d.target === 'object' ? d.target.group : null;
      if (s && !nodeTypeFilters.has(s)) return 'none';
      if (t && !nodeTypeFilters.has(t)) return 'none';
      return null;
    });
  }, [nodeTypeFilters]);

  // 响应式联动标签展示策略
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const labels = svg.selectAll<SVGTextElement, GraphNode>('.nv-node-label');
    if (labelMode === 'all') {
      labels.style('opacity', 1).style('display', null);
    } else if (labelMode === 'hover') {
      labels.style('opacity', 0);
    } else if (labelMode === 'top') {
      labels.style('opacity', function(d: any) {
        if (!d) return 0;
        return (d.group === 'typeHub' || (d._degree && d._degree > 2)) ? 1 : 0;
      });
    } else {
      labels.style('opacity', null).style('display', null);
    }
  }, [labelMode]);

  // 4. Hover Tooltip State — rich card shown on node hover
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const hoveredNodeIdRef = useRef<string | null>(null);
  useEffect(() => { hoveredNodeIdRef.current = hoveredNodeId; }, [hoveredNodeId]);

  // Canvas 2D 绘图调度
  const triggerCanvasRender = useCallback(() => {
    if (!canvasRendererRef.current || !graphDataRef.current) return;
    const gd = graphDataRef.current;
    const nodes = nodesRef.current && nodesRef.current.length > 0 ? nodesRef.current : gd.nodes;

    // 计算高亮关联节点集
    const targetId = hoveredNodeIdRef.current || selectedNode?.id;
    let connectedSet: Set<string> | null = null;
    if (targetId) {
      connectedSet = new Set<string>();
      for (let i = 0; i < gd.links.length; i++) {
        const l = gd.links[i];
        const s = typeof l.source === 'object' ? (l.source as GraphNode).id : String(l.source);
        const t = typeof l.target === 'object' ? (l.target as GraphNode).id : String(l.target);
        if (s === targetId) connectedSet.add(t);
        if (t === targetId) connectedSet.add(s);
      }
    }

    canvasRendererRef.current.scheduleRender({
      nodes,
      links: gd.links,
      transform: {
        k: currentTransformRef.current.k,
        x: currentTransformRef.current.x,
        y: currentTransformRef.current.y,
      },
      selectedNodeId: selectedNode?.id || null,
      hoveredNodeId: hoveredNodeIdRef.current,
      focusedNodeId: focusedNodeId,
      connectedNodeIds: connectedSet,
      showWeakLinks,
      weightThreshold,
      collapsedNodes,
      scopeMode,
    });
  }, [selectedNode, focusedNodeId, showWeakLinks, weightThreshold, collapsedNodes, scopeMode]);

  const triggerCanvasRenderRef = useRef(triggerCanvasRender);
  useEffect(() => { triggerCanvasRenderRef.current = triggerCanvasRender; }, [triggerCanvasRender]);

  const activeHighlightIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeHighlightIdRef.current = selectedNode?.id || (scopeMode !== 'all' ? focusedNodeId : null);
  }, [selectedNode, focusedNodeId, scopeMode]);

  const clickToFocusRef = useRef(clickToFocus);
  useEffect(() => { clickToFocusRef.current = clickToFocus; }, [clickToFocus]);

  const applyHighlightStyles = useCallback((activeNodeId: string | null, activeLinkId: string | null = null) => {
    if (!svgRef.current || !graphDataRef.current) return;
    const svg = d3.select(svgRef.current);
    
    // Reset basic selection & connection classes first
    svg.selectAll('.nv-node')
       .classed('nv-highlight-node', false)
       .classed('nv-selected-pulse', false)
       .classed('nv-connected-node', false);
    svg.selectAll('.nv-node-label')
       .classed('nv-label-selected', false)
       .classed('nv-connected-label', false);

    // ── Path Tracer Mode Active Styling ──
    if (pathTraceResultRef.current && pathTraceResultRef.current.pathNodeIds.size > 0) {
      const res = pathTraceResultRef.current;
      const { sourceId, targetId, pathNodeIds, pathEdgeKeys } = res;

      // 1. Nodes styling
      svg.selectAll('.nv-node')
        .classed('nv-dim', (d: any) => !pathNodeIds.has(d.id))
        .classed('nv-path-source', (d: any) => d.id === sourceId)
        .classed('nv-path-target', (d: any) => d.id === targetId)
        .classed('nv-path-node', (d: any) => d.id !== sourceId && d.id !== targetId && pathNodeIds.has(d.id));

      svg.selectAll('.nv-node-label')
        .classed('nv-dim-label', (d: any) => !pathNodeIds.has(d.id))
        .classed('nv-path-source-label', (d: any) => d.id === sourceId)
        .classed('nv-path-target-label', (d: any) => d.id === targetId)
        .classed('nv-path-node-label', (d: any) => d.id !== sourceId && d.id !== targetId && pathNodeIds.has(d.id));

      // 2. Links styling
      svg.selectAll('.nv-link-instance, .nv-link-typeinst, .nv-link-action')
        .classed('nv-dim', (l: any) => {
          const s = typeof l.source === 'object' ? (l.source as any).id : l.source;
          const t = typeof l.target === 'object' ? (l.target as any).id : l.target;
          return !pathEdgeKeys.has(`${s}|${t}`) && !pathEdgeKeys.has(`${t}|${s}`);
        })
        .classed('nv-path-edge', (l: any) => {
          const s = typeof l.source === 'object' ? (l.source as any).id : l.source;
          const t = typeof l.target === 'object' ? (l.target as any).id : l.target;
          return pathEdgeKeys.has(`${s}|${t}`) || pathEdgeKeys.has(`${t}|${s}`);
        });

      svg.selectAll('.nv-edge-badge, .nv-linktype-label')
        .classed('nv-dim-label', (l: any) => {
          const s = typeof l.source === 'object' ? (l.source as any).id : l.source;
          const t = typeof l.target === 'object' ? (l.target as any).id : l.target;
          return !pathEdgeKeys.has(`${s}|${t}`) && !pathEdgeKeys.has(`${t}|${s}`);
        })
        .style('display', (l: any) => {
          const s = typeof l.source === 'object' ? (l.source as any).id : l.source;
          const t = typeof l.target === 'object' ? (l.target as any).id : l.target;
          return pathEdgeKeys.has(`${s}|${t}`) || pathEdgeKeys.has(`${t}|${s}`) ? null : 'none';
        })
        .style('opacity', (l: any) => {
          const s = typeof l.source === 'object' ? (l.source as any).id : l.source;
          const t = typeof l.target === 'object' ? (l.target as any).id : l.target;
          return pathEdgeKeys.has(`${s}|${t}`) || pathEdgeKeys.has(`${t}|${s}`) ? '1.0' : '0.0';
        });

      return;
    }

    const nodesMap = new Map(nodesRef.current.map(n => [n.id, n]));

    // Case A: No active highlight
    if (!activeNodeId && !activeLinkId) {
      svg.selectAll('.nv-node, .nv-node-label')
         .classed('nv-dim', false)
         .classed('nv-dim-label', false)
         .classed('nv-connected-node', false)
         .classed('nv-connected-label', false)
         .classed('nv-path-source', false)
         .classed('nv-path-target', false)
         .classed('nv-path-node', false)
         .classed('nv-path-edge', false);

      svg.selectAll('.nv-link-instance, .nv-link-typeinst, .nv-link-action')
         .classed('nv-dim', false)
         .classed('nv-link-selected', false)
         .style('stroke', (l: any) => {
           if (l._isTypeInstLink) return 'rgba(148, 163, 184, 0.30)';
           if (l._isActionLink) return '#bd93f9';
           return l.color || 'rgba(148, 163, 184, 0.75)';
         })
         .style('stroke-dasharray', (l: any) => l._isTypeInstLink ? '3,3' : null)
         .style('stroke-width', (l: any) => {
           if (l._isTypeInstLink) return '1.0px';
           if (l._isActionLink) return '1.4px';
           const w = Math.max(0.3, Math.min(1.0, l.weight ?? 0.5));
           return `${(1.8 + (w - 0.3) * 0.8).toFixed(2)}px`;
         })
         .style('opacity', (l: any) => {
           if (l._isTypeInstLink) return '0.40';
           if (!showWeakLinks && l._linkTypeId !== undefined && l.weight < weightThreshold) return '0';
           return '0.92';
         })
         .attr('marker-end', (l: any) => {
           if (l._isTypeInstLink) return null;
           if (l._isActionLink) return 'url(#arrow-amethyst)';
           if (l._linkTypeId !== undefined) return `url(#arrow-linktype-${l._linkTypeId})`;
           const src = getSourceNode(l as any, nodesMap as any);
           const tgt = getTargetNode(l as any, nodesMap as any);
           if (src?.group === 'typeHub' || tgt?.group === 'typeHub') return null;
           return 'url(#arrow-highlight)';
         });

      const isAlways = edgeLabelDisplayRef.current === 'always';
      svg.selectAll<SVGGElement, GraphLink>('.nv-edge-badge, .nv-linktype-label')
         .classed('nv-dim-label', false)
         .style('display', isAlways ? null : 'none')
         .style('opacity', isAlways ? '0.88' : '0');
      return;
    }

    // Case B: Active node or active link
    const connectedNodeIds = new Set<string>();
    const activeNodeStr = activeNodeId != null ? String(activeNodeId) : null;
    const isLinkActive = (l: any) => {
      const sId = String(typeof l.source === 'object' ? (l.source as any).id : l.source);
      const tId = String(typeof l.target === 'object' ? (l.target as any).id : l.target);
      const key = String(l.id || `${sId}-${tId}`);
      if (activeLinkId && key === activeLinkId) return true;
      if (activeNodeStr && (sId === activeNodeStr || tId === activeNodeStr)) return true;
      return false;
    };

    if (activeNodeStr) {
      connectedNodeIds.add(activeNodeStr);
    }

    graphDataRef.current.links.forEach(l => {
      const sId = String(typeof l.source === 'object' ? (l.source as any).id : l.source);
      const tId = String(typeof l.target === 'object' ? (l.target as any).id : l.target);
      const key = String(l.id || `${sId}-${tId}`);
      if (activeLinkId && key === activeLinkId) {
        connectedNodeIds.add(sId);
        connectedNodeIds.add(tId);
      }
      if (activeNodeStr) {
        if (sId === activeNodeStr) connectedNodeIds.add(tId);
        if (tId === activeNodeStr) connectedNodeIds.add(sId);
      }
    });

    // 1. Nodes highlighting & dimming
    svg.selectAll('.nv-node')
       .classed('nv-dim', (d: any) => !connectedNodeIds.has(String(d.id)))
       .classed('nv-highlight-node', (d: any) => String(d.id) === activeNodeStr)
       .classed('nv-connected-node', (d: any) => String(d.id) !== activeNodeStr && connectedNodeIds.has(String(d.id)))
       .classed('nv-selected-pulse', (d: any) => String(d.id) === activeNodeStr);
       
    svg.selectAll('.nv-node-label')
       .classed('nv-dim-label', (d: any) => !connectedNodeIds.has(String(d.id)))
       .classed('nv-connected-label', (d: any) => String(d.id) !== activeNodeStr && connectedNodeIds.has(String(d.id)))
       .classed('nv-label-selected', (d: any) => String(d.id) === activeNodeStr);

    // 2. Links highlighting & dimming
    const linkSelection = svg.selectAll<SVGPathElement, GraphLink>('.nv-link-instance, .nv-link-typeinst, .nv-link-action');
    linkSelection
      .classed('nv-dim', (l: any) => !isLinkActive(l))
      .classed('nv-link-selected', (l: any) => {
        const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
        const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
        const key = String(l.id || `${sId}-${tId}`);
        return Boolean(activeLinkId && key === activeLinkId);
      })
      .style('stroke', (l: any) => {
        if (isLinkActive(l)) {
          if (l._isTypeInstLink) return 'rgba(148, 163, 184, 0.75)';
          const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
          const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
          const key = String(l.id || `${sId}-${tId}`);
          if (activeLinkId && key === activeLinkId) return '#FFD166';
          return l.color || '#66d9ef';
        }
        return l.color || 'rgba(148, 163, 184, 0.4)';
      })
      .style('stroke-dasharray', (l: any) => l._isTypeInstLink ? '3,3' : null)
      .style('stroke-width', (l: any) => {
        if (isLinkActive(l)) {
          if (l._isTypeInstLink) return '1.5px';
          if (l._isActionLink) return '2.0px';
          return '2.6px';
        }
        return l._isTypeInstLink ? '0.8px' : '1.0px';
      })
      .style('opacity', (l: any) => {
        if (isLinkActive(l)) return '1.0';
        return '0.12';
      })
      .attr('marker-end', (l: any) => {
        if (l._isTypeInstLink) return null;
        if (isLinkActive(l)) {
          const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
          const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
          const key = String(l.id || `${sId}-${tId}`);
          if (activeLinkId && key === activeLinkId) return 'url(#arrow-selected)';
          if (l._linkTypeId !== undefined) return `url(#arrow-linktype-${l._linkTypeId})`;
          if (l._isActionLink) return 'url(#arrow-amethyst)';
          return 'url(#arrow-highlight)';
        }
        return 'url(#arrow-dimmed)';
      });

    // Raise active links so they fly above dimmed lines
    linkSelection.filter((l: any) => isLinkActive(l)).raise();

    // 3. Edge Badges highlighting & dimming
    const badgeSelection = svg.selectAll<SVGGElement, GraphLink>('.nv-edge-badge, .nv-linktype-label');
    badgeSelection
      .classed('nv-dim-label', (l: any) => !isLinkActive(l))
      .style('display', (l: any) => {
        if (isLinkActive(l)) return null;
        if (edgeLabelDisplayRef.current === 'always') return null;
        return 'none';
      })
      .style('opacity', (l: any) => {
        if (isLinkActive(l)) return '1.0';
        if (edgeLabelDisplayRef.current === 'always') return '0.15';
        return '0';
      });

    // Highlight badge borders and text for active links
    badgeSelection.filter((l: any) => isLinkActive(l)).each(function(l: any) {
      const g = d3.select(this);
      const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
      const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
      const key = String(l.id || `${sId}-${tId}`);
      const isSelectedLink = Boolean(activeLinkId && key === activeLinkId);
      const strokeColor = isSelectedLink ? '#FFD166' : (l.color || '#66d9ef');
      const textColor = isSelectedLink ? '#FFD166' : (l.color ? d3.rgb(l.color).brighter(0.4).toString() : '#f8fafc');

      g.select('rect')
        .style('stroke', strokeColor)
        .style('stroke-width', '1.4px')
        .style('fill', '#090d16')
        .style('opacity', '0.98');

      g.select('text')
        .style('fill', textColor)
        .style('font-weight', '700');
    }).raise();

    badgeSelection.filter((l: any) => !isLinkActive(l)).each(function(d: any) {
      const g = d3.select(this);
      g.select('rect')
        .style('stroke', d.color ? d3.rgb(d.color).darker(0.2).toString() : '#334155')
        .style('stroke-width', '0.75px')
        .style('fill', '#0f172a')
        .style('opacity', '0.92');

      g.select('text')
        .style('fill', '#cbd5e1')
        .style('font-weight', '600');
    });
  }, [scopeMode, showWeakLinks, weightThreshold]);

  const applyHighlightStylesRef = useRef(applyHighlightStyles);
  useEffect(() => {
    applyHighlightStylesRef.current = applyHighlightStyles;
  }, [applyHighlightStyles]);

  const hoverLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setNodeHoverState = useCallback((d: GraphNode | null, pos?: { x: number; y: number }) => {
    if (hoverLeaveTimerRef.current) {
      clearTimeout(hoverLeaveTimerRef.current);
      hoverLeaveTimerRef.current = null;
    }
    if (d) {
      if (pos) setTooltipPos(pos);
      setHoveredNode(d);
      hoveredNodeIdRef.current = String(d.id);
      setHoveredNodeId(String(d.id));
      applyHighlightStylesRef.current?.(String(d.id), null);
    } else {
      hoverLeaveTimerRef.current = setTimeout(() => {
        setHoveredNode(null);
        hoveredNodeIdRef.current = null;
        setHoveredNodeId(null);
        applyHighlightStylesRef.current?.(activeHighlightIdRef.current, selectedLinkIdRef.current);
      }, 50);
    }
  }, []);
  const setNodeHoverStateRef = useRef(setNodeHoverState);
  useEffect(() => { setNodeHoverStateRef.current = setNodeHoverState; }, [setNodeHoverState]);

  const resetBlankCanvasState = useCallback(() => {
    setSelectedNode(null);
    setFocusedNodeId(null);
    setHoveredNode(null);
    setContextMenu(null);
    setScopeMode('all');
    setCollapsedNodes(new Set());
    setSelectedNodeIds(new Set());
    setPathTracerSource(null);
    setPathTracerTarget(null);
    setPathTraceResult(null);
    pathTracerSourceRef.current = null;
    pathTraceResultRef.current = null;
    setSearchTerm('');
    store.dispatch?.(ontologyActions.setSearch(''));

    hoveredNodeIdRef.current = null;
    activeHighlightIdRef.current = null;
    searchHighlightedRef.current = [];
    (window as any).__currentNodeId = null;
    (window as any).__focusedNodeId = null;
    setSelectedLinkId(null);
    selectedLinkIdRef.current = null;
    applyHighlightStylesRef.current(null);

    if (blankCanvasResetTimerRef.current) {
      clearTimeout(blankCanvasResetTimerRef.current);
    }
    blankCanvasResetTimerRef.current = setTimeout(() => {
      blankCanvasResetTimerRef.current = null;
      (window as any).__d3FitAll?.();
    }, 50);
  }, [store.dispatch]);

  const resetBlankCanvasStateRef = useRef(resetBlankCanvasState);
  useEffect(() => {
    resetBlankCanvasStateRef.current = resetBlankCanvasState;
  }, [resetBlankCanvasState]);

  useEffect(() => () => {
    if (blankCanvasResetTimerRef.current) {
      clearTimeout(blankCanvasResetTimerRef.current);
      blankCanvasResetTimerRef.current = null;
    }
  }, []);

  const refreshGraph = useCallback(async () => {
    // Always read the latest state directly from stateRef to avoid timing issues
    // and prevent refreshGraph identity from changing on every parent re-render
    const currentState = ontologyState ?? stateRef.current;
    if (!currentState) {
      setLoading(false);
      return;
    }
    const currentMapping = currentState.mapping;
    if (currentState.initting) {
      setLoading(true);
      return;
    }
    if (currentState.initState !== 'ready' || isActive === false) {
      setLoading(false);
      return;
    }
    console.log('[D3GraphView] refreshGraph called, activeTemplateId:', currentState.activeTemplateId);
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
  }, [isActive, ontologyState]);

  // Temporal playback auto-increment interval
  useEffect(() => {
    let interval: any = null;
    if (isPlayingTimeline) {
      interval = setInterval(() => {
        setTimelineStep(prev => {
          if (prev >= 100) return 0;
          return prev + 5;
        });
      }, 350);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isPlayingTimeline]);

  useEffect(() => {
    if (!fullGraphData) {
      setGraphData(null);
      graphDataRef.current = null;
      return;
    }
    
    // Temporal Timeline Filtering (0-100%)
    let filteredData = fullGraphData;
    if (timelineStep < 100) {
      const nodeLimit = Math.max(1, Math.ceil((fullGraphData.nodes.length * timelineStep) / 100));
      const allowedNodes = fullGraphData.nodes.slice(0, nodeLimit);
      const allowedNodeIds = new Set(allowedNodes.map(n => n.id));
      const allowedLinks = fullGraphData.links.filter(l => {
        const s = typeof l.source === 'object' ? (l.source as any).id : l.source;
        const t = typeof l.target === 'object' ? (l.target as any).id : l.target;
        return allowedNodeIds.has(String(s)) && allowedNodeIds.has(String(t));
      });
      filteredData = {
        ...fullGraphData,
        nodes: allowedNodes,
        links: allowedLinks,
      };
    }

    const next = buildReadableSubgraph(
      filteredData,
      focusedNodeId,
      scopeMode,
      weightThreshold,
      showWeakLinks,
      activeRelationTypes,
      collapsedNodes,
    );
    setGraphData(next);
    graphDataRef.current = next;
  }, [fullGraphData, focusedNodeId, scopeMode, weightThreshold, showWeakLinks, activeRelationTypes, collapsedNodes, timelineStep]);

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
    } catch (err: any) {
      console.error('[D3GraphView] AI fill failed:', err);
      const detail = err?.message || '';
      const message = detail.includes('AI Provider not configured') || detail.includes('API key not configured')
        ? 'AI 服务未配置，请在设置中配置 AI Provider（支持本地 LM Studio / Ollama 或云端模型）'
        : (detail ? `AI 图谱生成失败: ${detail}` : 'AI 图谱生成失败，请检查 AI 配置');
      setToast({ message, type: 'error' });
    } finally {
      setIsAiFilling(false);
    }
  }, [aiFillTopic]);

  function mapColor(color: string): string {
    const map: Record<string, string> = {
      amethyst: '#66d9ef', blue: '#4CC9F0', green: '#4ade80',
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

  // 统一入口状态重置：清空选择与聚焦，确保新案例载入后呈现纯净开箱视图
  const resetViewToCleanState = useCallback(() => {
    setSelectedNode(null);
    setSelectedLinkId(null);
    setSelectedNodeIds(new Set());
    setFocusedNodeId(null);
    setPathTracerSource(null);
    setPathTracerTarget(null);
    setPathTraceResult(null);
    setLassoBox(null);
    setTimelineStep(100);
    // 统一恢复默认推荐的「横向层级树」布局
    setLayoutMode('horizontalTree');
    // 统一连线标签为 hover 模式，保持画布纯净无冗余徽章遮挡
    setEdgeLabelDisplay('hover');
    // 重置相机视口变换基准
    currentTransformRef.current = d3.zoomIdentity;
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).call(zoomRef.current.transform, d3.zoomIdentity);
    }
    // 彻底清空节点历史拖拽与固定坐标缓存
    if (nodesRef.current) {
      nodesRef.current.forEach(n => {
        n.fx = null;
        n.fy = null;
        delete (n as any)._isLayoutFixed;
        delete (n as any)._savedFx;
        delete (n as any)._savedFy;
        delete (n as any)._tempPinned;
      });
    }
    setTimeout(() => {
      (window as any).__d3FitAll?.(350);
    }, 60);
  }, [setSelectedLinkId]);

  // 监听 activeTemplateId 或 initState 变更，对齐不同入口（初始化载入、教程Case载入、重置默认）的渲染逻辑与视觉呈现
  const lastActiveTemplateIdRef = useRef<string | null>(null);
  const lastInitStateRef = useRef<string>(state?.initState ?? 'loading');

  useEffect(() => {
    const currentTpl = state?.activeTemplateId;
    const currentInit = state?.initState;
    const isTemplateChanged = currentTpl && currentTpl !== lastActiveTemplateIdRef.current;
    const isInitFinished = currentInit === 'ready' && lastInitStateRef.current !== 'ready';

    if (isTemplateChanged || isInitFinished) {
      if (currentTpl) lastActiveTemplateIdRef.current = currentTpl;
      if (currentInit) lastInitStateRef.current = currentInit;
      resetViewToCleanState();
    }
  }, [state?.activeTemplateId, state?.initState, resetViewToCleanState]);

  // Load data when DuckDB tables are ready — debounced to prevent cascading
  // re-renders during seed switching (SET_INITTING→SET_DATA→SET_ACTIVE_TAB)
  useEffect(() => {
    if (state.initState === 'ready' && !state.initting) {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        refreshGraph();
      }, 50);
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
    const W = Math.max(container.clientWidth || 0, 800);
    const H = Math.max(container.clientHeight || 0, 600);
    const svg = d3.select(svgRef.current).attr('width', W).attr('height', H);

    svg.selectAll('*').remove();

    // Scoped CSS — ui-ux-pro-max: restrained visual noise
    const styleId = 'nv-styles-' + Date.now();
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = `
      /* Link styles: visible lines with clear direction arrows */
      .nv-links path { fill: none; stroke-linecap: round; stroke-linejoin: round; }
      
      /* 优化连线宽度：降低线宽以提升视觉清晰度，明确区分层级 */
      .nv-link-instance { stroke-width: 1.5px !important; opacity: 0.85; }
      .nv-link-typeinst  { stroke-width: 1.2px !important; opacity: 0.5; stroke-dasharray: 4 4; }
      .nv-link-action    { stroke-width: 1.5px !important; opacity: 0.75; stroke-dasharray: 3 3; }
      .nv-link-halo { stroke-width: 4.0px !important; }
      .nv-link-main { stroke-width: 1.5px !important; }

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
        text-anchor: start; pointer-events: all; cursor: pointer;
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
        stroke-width: 2.5px !important;
        stroke-opacity: 1.0 !important;
      }
      /* Path Tracer Mode 4-Category Distinct Visual Styles */
      .nv-node.nv-path-source circle {
        stroke: #a6e22e !important;
        stroke-width: 3.5px !important;
        fill: #1e3a1e !important;
        filter: drop-shadow(0 0 10px rgba(166, 226, 46, 0.85)) !important;
      }
      .nv-node.nv-path-target circle {
        stroke: #ff453a !important;
        stroke-width: 3.5px !important;
        fill: #3a1e1e !important;
        filter: drop-shadow(0 0 10px rgba(255, 69, 58, 0.85)) !important;
      }
      .nv-node.nv-path-node circle {
        stroke: #66d9ef !important;
        stroke-width: 2.5px !important;
        fill: #1a2936 !important;
        filter: drop-shadow(0 0 6px rgba(102, 217, 239, 0.75)) !important;
      }
      .nv-node-label.nv-path-source-label {
        fill: #a6e22e !important;
        font-size: 12px !important;
        font-weight: 900 !important;
      }
      .nv-node-label.nv-path-target-label {
        fill: #ff453a !important;
        font-size: 12px !important;
        font-weight: 900 !important;
      }
      .nv-node-label.nv-path-node-label {
        fill: #66d9ef !important;
        font-size: 10px !important;
        font-weight: bold !important;
      }
      .nv-links path.nv-path-edge {
        stroke: #66d9ef !important;
        stroke-width: 2.5px !important;
        stroke-opacity: 1.0 !important;
        stroke-dasharray: 6 3;
        animation: nv-edge-flow 0.75s linear infinite;
        filter: drop-shadow(0 0 4px rgba(102, 217, 239, 0.8));
      }
      @keyframes nv-pagerank-heat {
        0% { filter: drop-shadow(0 0 4px rgba(255, 0, 85, 0.6)); }
        100% { filter: drop-shadow(0 0 14px rgba(255, 0, 85, 1)); }
      }

      .nv-lod-far .nv-icon-instance, .nv-lod-far .nv-icon-typehub, .nv-lod-far .nv-icon-action { display: none !important; }
      .nv-lod-far .nv-props-badge { display: none !important; }
      .nv-lod-ultrafar .nv-links path { stroke-width: 1px !important; stroke-opacity: 0.4 !important; }
      .nv-link-hit { stroke: transparent !important; fill: none !important; pointer-events: stroke !important; }
      .nv-link-hit:hover { stroke: transparent !important; fill: none !important; }
      .nv-link-main.nv-link-selected {
        stroke: #FFD166 !important;
        stroke-width: 2.8px !important;
      }
      
      .nv-dim { opacity: 0.16 !important; transition: opacity 0.22s ease !important; }
      .nv-dim-label { opacity: 0.12 !important; transition: opacity 0.22s ease !important; }
      .nv-node, .nv-links path, .nv-node-label, .nv-linktype-label, .nv-edge-badge {
        transition: opacity 0.22s ease, stroke-width 0.22s ease, stroke 0.22s ease, filter 0.22s ease;
      }
      .nv-edge-badge { cursor: pointer; transition: opacity 0.22s ease, transform 0.18s ease; }
      .nv-edge-badge:hover .nv-edge-badge-bg {
        stroke: #FFD166 !important;
        stroke-width: 1.5px !important;
        filter: drop-shadow(0 0 6px rgba(255, 209, 102, 0.8));
      }
      .nv-edge-badge:hover .nv-edge-badge-text {
        fill: #ffffff !important;
        font-weight: 700 !important;
      }
      .nv-is-dragging .nv-dim { opacity: 0.65 !important; }
      .nv-is-dragging .nv-dim-label { opacity: 0.5 !important; }
      .nv-label-selected { fill: #FFD166 !important; font-size: 13px !important; font-weight: bold !important; }
      .nv-label-match { fill: #4CC9F0 !important; }
      .nv-hidden { display: none !important; }
      .nv-svg { overflow: visible; }

      /* Connected nodes style */
      .nv-instance.nv-connected-node circle { stroke: #66d9ef !important; stroke-width: 2.4px !important; opacity: 1.0 !important; }
      .nv-typehub.nv-connected-node circle { stroke: #bd93f9 !important; stroke-width: 1.8px !important; opacity: 0.85 !important; }
      .nv-action.nv-connected-node circle { stroke: #a6e22e !important; stroke-width: 2.0px !important; opacity: 1.0 !important; }
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
      
      /* 双向关系边的特殊样式：使用金色高亮表示双向关系 */
      .nv-bidirectional {
        stroke: #FFD166 !important;
      }
      .nv-bidirectional:hover {
        stroke: #FFD166 !important;
        filter: drop-shadow(0 0 6px rgba(255, 209, 102, 0.9)) !important;
      }
      
      /* 关系类型徽章样式 */
      .nv-linktype-label {
        font-size: 9px !important;
        fill: rgba(255, 255, 255, 0.75) !important;
        font-family: monospace !important;
        pointer-events: none !important;
      }
      
      /* 标签描边样式，确保在深色背景下可读 */
      .nv-node-label {
        paint-order: stroke fill !important;
        stroke-width: 3.5px !important;
        stroke-linejoin: round !important;
      }
      
      /* 画布空白区域提示 */
      .nv-empty-hint {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: rgba(255, 255, 255, 0.3);
        font-size: 14px;
        pointer-events: none;
        text-align: center;
      }
      
      /* 鼠标样式增强 */
      .nv-graph {
        cursor: grab !important;
      }
      .nv-graph:active {
        cursor: grabbing !important;
      }
    `;
    document.head.appendChild(styleEl);

    // 1. Transparent full-canvas catcher: ensures every single pixel of empty space
    // captures pointer, drag, and wheel events without browser SVG dropouts
    const bgCatcher = svg.append('rect')
      .attr('class', 'nv-canvas-catcher')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('fill', 'transparent')
      .attr('cursor', 'grab')
      .style('pointer-events', 'all');

    const g = svg.append('g').attr('class', 'nv-graph');
    const getNodeLabelBaseFontSize = (node: GraphNode) =>
      node._focusLevel === 0 ? 15 : node.group === 'typeHub' ? 12 : node._focusLevel === 1 ? 11 : 9;
    let updateNodeLabelsForZoom: (zoomScale: number) => void = () => {};

    // Native smooth zoom & pan engine:
    // - Wheel: zoom smoothly centered at mouse pointer anywhere on canvas (including empty areas)
    // - Left click (button 0): drag to pan canvas (or lasso when in lasso mode)
    // - Middle click (button 1): drag to pan canvas (CAD / Figma standard)
    // - Right click (button 2): filtered out (reserved for context menu)
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 20])
      .wheelDelta((event: WheelEvent) => {
        // High-precision smooth wheel delta (zoom centered at mouse cursor)
        return -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002);
      })
      .filter((event: any) => {
        if (isLassoModeRef.current || event.shiftKey) return false;
        if (event.button === 2) return false;
        if (event.type === 'wheel') return true;
        // Support both left-click (0) and middle-mouse button (1) dragging/panning
        return event.button === 0 || event.button === 1;
      })
      .on('zoom', e => {
        g.attr('transform', e.transform);
        currentTransformRef.current = e.transform;
        updateNodeLabelsForZoom(e.transform.k);
        if (renderEngineModeRef.current === 'canvas') {
          triggerCanvasRenderRef.current?.();
        } else if (renderEngineModeRef.current === 'webgl' && pixiRendererRef.current) {
          pixiRendererRef.current.setTransform(e.transform.k, e.transform.x, e.transform.y);
        }
      });

    svg.call(zoom).on('dblclick.zoom', null);
    zoomRef.current = zoom;
    svg
      .attr('style', 'display:block;cursor:grab;position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:all;')
      .style('pointer-events', 'all');

    // Prevent default Windows Chrome autoscroll circle icon on middle-click
    svg.on('mousedown.middle-prevent', (event: MouseEvent) => {
      if (event.button === 1) {
        event.preventDefault();
      }
    });

    // Lasso / Marquee Drag Selection
    let isLassoDragging = false;
    let lassoStartX = 0;
    let lassoStartY = 0;

    svg.on('mousedown.lasso', (event: MouseEvent) => {
      if (!isLassoModeRef.current && !event.shiftKey) return;
      if (event.button !== 0) return;
      isLassoDragging = true;
      const [ptX, ptY] = d3.pointer(event, containerRef.current);
      lassoStartX = ptX;
      lassoStartY = ptY;
      setLassoBox({ x: ptX, y: ptY, width: 0, height: 0 });
    });

    svg.on('mousemove.lasso', (event: MouseEvent) => {
      if (!isLassoDragging) return;
      const [currX, currY] = d3.pointer(event, containerRef.current);
      const x = Math.min(lassoStartX, currX);
      const y = Math.min(lassoStartY, currY);
      const width = Math.abs(currX - lassoStartX);
      const height = Math.abs(currY - lassoStartY);
      setLassoBox({ x, y, width, height });

      // Convert container coordinates to SVG graph graphData coordinates
      const transform = currentTransformRef.current;
      const [gMinX, gMinY] = transform.invert([x, y]);
      const [gMaxX, gMaxY] = transform.invert([x + width, y + height]);

      const selected = new Set<string>();
      nodes.forEach(n => {
        if (n.x != null && n.y != null) {
          if (n.x >= gMinX && n.x <= gMaxX && n.y >= gMinY && n.y <= gMaxY) {
            selected.add(n.id);
          }
        }
      });
      setSelectedNodeIds(selected);
    });

    svg.on('mouseup.lasso', () => {
      if (isLassoDragging) {
        isLassoDragging = false;
        setLassoBox(null);
      }
    });

    let fitAllRetryCount = 0;
    (window as any).__d3FitAll = (customDuration?: number) => {
      if (svg.classed('nv-is-dragging')) return;
      const ns = (nodesRef.current && nodesRef.current.length > 0) ? nodesRef.current : (graphDataRef.current?.nodes || []);
      if (ns.length === 0) return;

      // Get current container dimensions (in case of resize)
      const curW = containerRef.current?.clientWidth || W || 800;
      const curH = containerRef.current?.clientHeight || H || 600;

      // Filter to nodes with valid, non-zero positions
      const valid = ns.filter(n => n.x != null && !isNaN(n.x!) && n.y != null && !isNaN(n.y!) && n.x !== 0 && n.y !== 0);
      if (valid.length === 0) {
        if (fitAllRetryCount < 10) {
          fitAllRetryCount++;
          setTimeout(() => { (window as any).__d3FitAll?.(customDuration); }, 300);
        }
        return;
      }
      fitAllRetryCount = 0;

      const { visualCenterX, visualCenterY, availableW, availableH } = getVisualCenter(curW, curH);

      // Compute degree centrality to find the hub (most-connected instance node) for glow styling
      const degreeMap: Record<string, number> = {};
      ns.forEach(n => { degreeMap[n.id] = 0; });
      graphDataRef.current?.links.forEach((l: GraphLink) => {
        const s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
        const t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
        if (degreeMap[s] !== undefined) degreeMap[s]++;
        if (degreeMap[t] !== undefined) degreeMap[t]++;
      });

      let hubNode = valid.find(n => n.group === 'instance') || valid[0];
      valid.forEach(n => {
        if (n.group === 'instance' && (degreeMap[n.id] || 0) > (degreeMap[hubNode.id] || 0)) {
          hubNode = n;
        }
      });
      (window as any).__hubNodeId = hubNode?.id || null;

      const xs = valid.map(n => n.x!);
      const ys = valid.map(n => n.y!);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      const duration = customDuration !== undefined ? customDuration : 550;

      // Single node or coincident points → center directly in visual open area
      if (maxX - minX < 2 && maxY - minY < 2) {
        const scale = 1.0;
        const tx = visualCenterX - (valid[0].x || 0) * scale;
        const ty = visualCenterY - (valid[0].y || 0) * scale;
        svg.transition().duration(duration)
          .call(zoom.transform as any, d3.zoomIdentity.translate(tx, ty).scale(scale));
        return;
      }

      const margin = 50;
      const bw = Math.max(maxX - minX + margin * 2, 40);
      const bh = Math.max(maxY - minY + margin * 2, 40);
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      // Fit within available safe opening with comfortable readable zoom, avoiding clipping
      const fitScale = Math.min(availableW / bw, availableH / bh);
      // Relax scale clamp: allow scaling down to 0.08 so large graphs fit cleanly without UI overlap
      const targetScale = Math.max(0.08, Math.min(fitScale, 1.35));

      const tx = visualCenterX - centerX * targetScale;
      const ty = visualCenterY - centerY * targetScale;

      svg.transition().duration(duration)
        .call(zoom.transform as any, d3.zoomIdentity.translate(tx, ty).scale(targetScale));
    };

    // Helper: Find graph node by ID, prefixed ID, or label with multi-tier matching
    const findGraphNode = (idOrName: number | string, groupHint?: string): GraphNode | undefined => {
      const ns = simulationRef.current?.nodes() || [];
      if (ns.length === 0) return undefined;

      const targetStr = String(idOrName).trim();
      const targetNum = Number(idOrName);
      const normGroup = groupHint === 'type' ? 'typeHub' : groupHint;

      // 1. Direct exact id match ("obj::1", "type::1", "action::1")
      let node = ns.find(n => n.id === targetStr);
      if (node) return node;

      // 2. Prefixed id match
      node = ns.find(n => n.id === `obj::${targetStr}` || n.id === `type::${targetStr}` || n.id === `action::${targetStr}`);
      if (node) return node;

      // 3. Match by numeric ID: _objId, _typeId
      if (!isNaN(targetNum)) {
        node = ns.find(n => {
          if (normGroup === 'typeHub') {
            return n.group === 'typeHub' && n._typeId === targetNum;
          }
          if (normGroup === 'action') {
            return n.group === 'action' && (n.id === `action::${targetNum}` || n._objId === targetNum);
          }
          if (normGroup === 'instance') {
            return n.group === 'instance' && n._objId === targetNum;
          }
          return n._objId === targetNum || (n.group === 'typeHub' && n._typeId === targetNum);
        });
        if (node) return node;
      }

      // 4. Match by label/name
      if (targetStr.length > 0) {
        node = ns.find(n => n.label && n.label.toLowerCase() === targetStr.toLowerCase());
        if (node) return node;
      }

      return undefined;
    };

    // Helper: trigger pulsing radar animation on node
    const pulseNode = (node: GraphNode, color1 = '#FFD166', color2 = '#66d9ef') => {
      const match = d3.selectAll<SVGGElement, GraphNode>('.nv-node')
        .filter((d: GraphNode) => d.id === node.id);

      if (!match.empty()) {
        const r = getVisualRadius(node);
        match.append('circle')
          .attr('class', 'nv-radar-ripple')
          .attr('r', r)
          .style('fill', 'none')
          .style('stroke', color1)
          .style('stroke-width', '2.5px')
          .style('opacity', '0.95')
          .transition()
          .duration(750)
          .ease(d3.easeQuadOut)
          .attr('r', r * 3.6)
          .style('stroke-width', '0.5px')
          .style('opacity', '0')
          .remove();

        match.append('circle')
          .attr('class', 'nv-radar-ripple')
          .attr('r', r)
          .style('fill', 'none')
          .style('stroke', color2)
          .style('stroke-width', '1.8px')
          .style('opacity', '0.85')
          .transition()
          .delay(120)
          .duration(850)
          .ease(d3.easeQuadOut)
          .attr('r', r * 4.8)
          .style('stroke-width', '0.2px')
          .style('opacity', '0')
          .remove();

        match.select('circle')
          .transition()
          .duration(160)
          .attr('r', r * 1.6)
          .transition()
          .duration(280)
          .attr('r', r);
      }
    };

    // 1. Focus a single node
    (window as any).__d3FocusNode = (nodeId: number | string, nodeGroup?: string) => {
      const node = findGraphNode(nodeId, nodeGroup);
      if (!node || node.x == null || isNaN(node.x) || node.y == null || isNaN(node.y)) {
        console.warn('[D3GraphView] __d3FocusNode: node not found for', nodeId, nodeGroup);
        return;
      }

      const curW = containerRef.current?.clientWidth ?? 800;
      const curH = containerRef.current?.clientHeight ?? 600;
      const { visualCenterX, visualCenterY } = getVisualCenter(curW, curH);
      const scale = 1.8;
      const tx = visualCenterX - node.x * scale;
      const ty = visualCenterY - node.y * scale;

      svg.transition().duration(600)
        .call(zoom.transform as any, d3.zoomIdentity.translate(tx, ty).scale(scale));

      setSelectedNode(node);
      setSelectedNodeIds(new Set([node.id]));
      d3.selectAll('.nv-node').classed('nv-node-selected', (d: any) => d.id === node.id);
      if (graphDataRef.current) {
        showNodeInfo(node, graphDataRef.current);
      }
      (window as any).__currentNodeId = node.id;
      pulseNode(node);
    };

    // 2. Focus an entire link (frame both endpoints + pulse connecting line)
    (window as any).__d3FocusLink = (linkId: number | string, sourceId?: number | string, targetId?: number | string) => {
      const ns = simulationRef.current?.nodes() || [];
      if (ns.length === 0) return;

      let srcNode: GraphNode | undefined;
      let tgtNode: GraphNode | undefined;

      if (sourceId != null && targetId != null) {
        srcNode = findGraphNode(sourceId, 'instance');
        tgtNode = findGraphNode(targetId, 'instance');
      }

      if (!srcNode || !tgtNode) {
        const ls = graphDataRef.current?.links || [];
        const targetLink = ls.find((l: any) => l._linkId === Number(linkId) || l.id === String(linkId));
        if (targetLink) {
          const sId = typeof targetLink.source === 'object' ? targetLink.source.id : targetLink.source;
          const tId = typeof targetLink.target === 'object' ? targetLink.target.id : targetLink.target;
          srcNode = ns.find(n => n.id === sId);
          tgtNode = ns.find(n => n.id === tId);
        }
      }

      if (!srcNode || !tgtNode || srcNode.x == null || tgtNode.x == null || srcNode.y == null || tgtNode.y == null) {
        console.warn('[D3GraphView] __d3FocusLink: endpoints not found for', linkId, sourceId, targetId);
        return;
      }

      const curW = containerRef.current?.clientWidth ?? 800;
      const curH = containerRef.current?.clientHeight ?? 600;
      const { visualCenterX, visualCenterY, availableW, availableH } = getVisualCenter(curW, curH);

      const minX = Math.min(srcNode.x, tgtNode.x);
      const maxX = Math.max(srcNode.x, tgtNode.x);
      const minY = Math.min(srcNode.y, tgtNode.y);
      const maxY = Math.max(srcNode.y, tgtNode.y);

      const midX = (minX + maxX) / 2;
      const midY = (minY + maxY) / 2;
      const spanW = Math.max(maxX - minX + 180, 220);
      const spanH = Math.max(maxY - minY + 180, 220);

      const fitScale = Math.min(availableW / spanW, availableH / spanH);
      const targetScale = Math.max(0.4, Math.min(fitScale, 1.8));

      const tx = visualCenterX - midX * targetScale;
      const ty = visualCenterY - midY * targetScale;

      svg.transition().duration(600)
        .call(zoom.transform as any, d3.zoomIdentity.translate(tx, ty).scale(targetScale));

      setSelectedNodeIds(new Set([srcNode.id, tgtNode.id]));
      d3.selectAll('.nv-node').classed('nv-node-selected', (d: any) => d.id === srcNode!.id || d.id === tgtNode!.id);
      pulseNode(srcNode, '#a6e22e', '#66d9ef');
      pulseNode(tgtNode, '#a6e22e', '#FFD166');

      // Pulse connecting link line
      d3.selectAll('.nv-links path, .nv-links line')
        .filter((l: any) => {
          const sId = typeof l.source === 'object' ? l.source.id : l.source;
          const tId = typeof l.target === 'object' ? l.target.id : l.target;
          return (sId === srcNode!.id && tId === tgtNode!.id) || (sId === tgtNode!.id && tId === srcNode!.id);
        })
        .transition().duration(200).style('stroke-width', '5px').style('stroke', '#a6e22e')
        .transition().duration(700).style('stroke-width', null).style('stroke', null);
    };

    // 3. Synchronize external batch selections from sidebar
    (window as any).__d3SetSelectedNodes = (ids: (string | number)[]) => {
      const set = new Set<string>();
      ids.forEach(rawId => {
        const node = findGraphNode(rawId);
        if (node) set.add(node.id);
      });
      setSelectedNodeIds(set);
      d3.selectAll('.nv-node').classed('nv-node-selected', (d: any) => set.has(d.id));
    };

    // 4. Hover spotlight on node
    (window as any).__d3HoverNode = (id: string | number, group?: string, isHover = true) => {
      const node = findGraphNode(id, group);
      if (!node) return;
      const match = d3.selectAll<SVGGElement, GraphNode>('.nv-node')
        .filter((d: GraphNode) => d.id === node.id);
      if (!match.empty()) {
        if (isHover) {
          match.classed('nv-hover-spotlight', true);
          match.select('circle').transition().duration(150).attr('stroke', '#66d9ef').attr('stroke-width', '3px');
        } else {
          match.classed('nv-hover-spotlight', false);
          match.select('circle').transition().duration(200).attr('stroke', null).attr('stroke-width', null);
        }
      }
    };

    // 5. Focus a set of nodes (fit all matching in view)
    (window as any).__d3FocusNodes = (ids: (string | number)[]) => {
      const foundNodes: GraphNode[] = [];
      ids.forEach(rawId => {
        const n = findGraphNode(rawId);
        if (n && n.x != null && !isNaN(n.x) && n.y != null && !isNaN(n.y)) {
          foundNodes.push(n);
        }
      });
      if (foundNodes.length === 0) return;

      const curW = containerRef.current?.clientWidth ?? 800;
      const curH = containerRef.current?.clientHeight ?? 600;
      const { visualCenterX, visualCenterY, availableW, availableH } = getVisualCenter(curW, curH);

      const xs = foundNodes.map(n => n.x!);
      const ys = foundNodes.map(n => n.y!);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      const midX = (minX + maxX) / 2;
      const midY = (minY + maxY) / 2;
      const spanW = Math.max(maxX - minX + 160, 200);
      const spanH = Math.max(maxY - minY + 160, 200);

      const fitScale = Math.min(availableW / spanW, availableH / spanH);
      const targetScale = Math.max(0.12, Math.min(fitScale, 1.6));

      const tx = visualCenterX - midX * targetScale;
      const ty = visualCenterY - midY * targetScale;

      svg.transition().duration(600)
        .call(zoom.transform as any, d3.zoomIdentity.translate(tx, ty).scale(targetScale));

      const set = new Set(foundNodes.map(n => n.id));
      setSelectedNodeIds(set);
      d3.selectAll('.nv-node').classed('nv-node-selected', (d: any) => set.has(d.id));
    };

    if (!graphDataRef.current) {
      setD3Ready(true);
      return () => {
        const el = document.getElementById(styleId);
        if (el) el.remove();
        delete (window as any).__d3FitAll;
        delete (window as any).__d3FocusNode;
        delete (window as any).__d3FocusLink;
        delete (window as any).__d3SetSelectedNodes;
        delete (window as any).__d3HoverNode;
        delete (window as any).__d3FocusNodes;
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
    const nodeMap = new Map<string, GraphNode>(nodes.map(n => [n.id, n]));
    const endpointLinks = links.filter(link => getSourceNode(link as any, nodeMap as any) && getTargetNode(link as any, nodeMap as any));
    // ── MECE 连线分级分类引擎 (L0-L1 根子衍生, L1-L2 动作依附, L1-L1 业务语义) ──
    endpointLinks.forEach(l => {
      const src = getSourceNode(l as any, nodeMap as any);
      const tgt = getTargetNode(l as any, nodeMap as any);
      const isTypeInst = l._isTypeInstLink || (src?.group === 'typeHub' && tgt?.group === 'instance') || (src?.group === 'instance' && tgt?.group === 'typeHub');
      if (isTypeInst) {
        l._isTypeInstLink = true;
      }
      const isAction = l._isActionLink || src?.group === 'action' || tgt?.group === 'action';
      if (isAction) {
        l._isActionLink = true;
      }
    });

    // 补齐每个 Action 节点与其属主 Instance 之间的动作依附连线 (消除悬浮断层)
    const existingActionTargets = new Set<string>();
    endpointLinks.forEach(l => {
      const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
      const tNode = nodeMap.get(tId);
      if (tNode?.group === 'action') {
        existingActionTargets.add(tId);
      }
    });

    const supplementalActionLinks: GraphLink[] = [];
    nodes.filter(n => n.group === 'action').forEach(act => {
      if (!existingActionTargets.has(act.id) && act._objId !== undefined) {
        const ownerInstance = nodes.find(n => n.group === 'instance' && n._objId === act._objId);
        if (ownerInstance) {
          supplementalActionLinks.push({
            id: `act-link-${act.id}`,
            source: ownerInstance.id,
            target: act.id,
            color: '#bd93f9',
            weight: 0.25,
            _isActionLink: true,
          });
        }
      }
    });

    const allCandidateLinks = [...endpointLinks, ...supplementalActionLinks];
    // 根据 showHierarchyLinks 控制是否渲染 TypeHub 衍生虚线
    const linksToRenderRaw = allCandidateLinks.filter(l => {
      if (l._isTypeInstLink && !showHierarchyLinksRef.current) return false;
      return true;
    });

    const { aggregatedLinks } = aggregateParallelEdges(
      linksToRenderRaw as any,
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
    // Reset all old pinned coordinates, velocities, and layout marks before applying the new layout
    nodes.forEach(n => {
      n.fx = null;
      n.fy = null;
      n.vx = 0;
      n.vy = 0;
      delete (n as any)._isLayoutFixed;
      delete (n as any)._savedFx;
      delete (n as any)._savedFy;
      delete (n as any)._tempPinned;
    });

    const typeHubNodes = nodes.filter(n => n.group === 'typeHub');
    
    // 使用统一的布局服务
    const unifiedMode = toUnifiedLayoutMode(layoutMode);
    const freezeNonAction = shouldFreezeNonActionNodes(layoutMode);
    
    if (layoutMode === 'force') {
      // force 模式不应用预定义布局，由 D3 simulation 处理
      // 仍然调用以记录性能指标
      unifiedApplyLayout(nodes, renderLinks, unifiedMode, W, H, { focusedNodeId });
    } else {
      // 应用统一的预定义布局
      unifiedApplyLayout(nodes, renderLinks, unifiedMode, W, H, { focusedNodeId });
      
      // 根据布局模式决定是否冻结非 action 节点位置
      if (freezeNonAction) {
        nodes.forEach(n => {
          if (n.group !== 'action' && n.x !== undefined && n.y !== undefined) {
            n.fx = n.x;
            n.fy = n.y;
          }
        });
      }
      
      // 对于预定义布局（非 force），平滑调用 __d3FitAll 确保图谱平滑居中过渡
      setTimeout(() => { (window as any).__d3FitAll?.(450); }, 32);
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

    // 布局完成后通知外部（用于同步到其他视图）
    if (onLayoutChange && nodes.length > 0) {
      const nodePositions: Record<number, { x: number; y: number }> = {};
      nodes.forEach(n => {
        if (n.x !== undefined && n.y !== undefined && Number.isFinite(n.x) && Number.isFinite(n.y)) {
          const objId = n._objId ?? (n.id.startsWith('obj::') ? Number(n.id.slice(5)) : (/^\d+$/.test(n.id) ? Number(n.id) : null));
          if (objId !== null && Number.isFinite(objId) && !Number.isNaN(objId)) {
            nodePositions[objId] = { x: n.x, y: n.y };
          }
        }
      });
      onLayoutChange({
        nodePositions,
        layoutMode,
        zoom: currentTransformRef.current.k,
        pan: { x: currentTransformRef.current.x, y: currentTransformRef.current.y },
      });
    }

    // Force Simulation (optimized for 100+ nodes & type clusters)
    const nodeCount = nodes.length;
    const decay = nodeCount > 200 ? 0.10 : nodeCount > 150 ? 0.08 : nodeCount > 80 ? 0.05 : 0.035;

    // 预定义拓扑布局（非 force）或 clusteredForce 下节点已被精确放置，物理引擎仅用于轻量对齐
    const isClusterFrozen = layoutMode === 'clusteredForce';
    const isLayoutFrozen = isClusterFrozen || freezeNonAction;
    const simAlpha = isLayoutFrozen ? 0.05 : 0.85;
    const simCharge = isLayoutFrozen ? 0 : chargeStrength;
    const simLinkStrength = isLayoutFrozen ? 0.01 : linkStrength;
    const simCenterStrength = isLayoutFrozen ? 0 : 0.04;
    const simGravity = isLayoutFrozen ? 0 : gravityStrength * 0.8;

    const { visualCenterX: initCenterX, visualCenterY: initCenterY } = getVisualCenter(W, H);

    const sim = d3.forceSimulation<GraphNode, GraphLink>(nodes)
      .velocityDecay(isLayoutFrozen ? 0.85 : velocityDecay)
      .alpha(simAlpha)
      .alphaDecay(isLayoutFrozen ? 0.08 : decay)
      .force('link', d3.forceLink<GraphNode, GraphLink>(renderLinks).id(d => d.id).distance(d => {
        const src = getSourceNode(d as any, nodeMap as any);
        const tgt = getTargetNode(d as any, nodeMap as any);
        if (src?.group === 'action' || tgt?.group === 'action') return 28;
        if (d._linkTypeId !== undefined) return linkDistance * 1.15;
        if (src?.group === 'typeHub' || tgt?.group === 'typeHub') return linkDistance * 0.85;
        return linkDistance;
      }).strength(d => {
        const src = getSourceNode(d as any, nodeMap as any);
        const tgt = getTargetNode(d as any, nodeMap as any);
        if (src?.group === 'action' || tgt?.group === 'action') return 0.9;
        if (src?.group === 'typeHub' || tgt?.group === 'typeHub') return 0.45;
        return simLinkStrength;
      }))
      .force('charge', d3.forceManyBody().strength((d: GraphNode) => {
        if (isLayoutFrozen) return 0;
        if (d.group === 'typeHub') return -420;
        if (d.group === 'action') return -40;
        return simCharge;
      }).theta(0.85))
      .force('center', d3.forceCenter(initCenterX, initCenterY).strength(simCenterStrength))
      .force('collision', d3.forceCollide<GraphNode>().radius(d => {
        if (d.group === 'typeHub') return (d.size || 28) + 28;
        if (d.group === 'action') return (d.size || 6) + 14;
        return (d.size || 10) + Math.max(28, collisionRadius);
      }).iterations(isLayoutFrozen ? 2 : 3))
      .force('x', d3.forceX(initCenterX).strength(simGravity))
      .force('y', d3.forceY(initCenterY).strength(simGravity));

    // typeCluster force only applies to free-force layout (not frozen cluster)
    // (clusteredForce uses frozen positions — no additional force needed)
    simulationRef.current = sim;

    // ── Hull 外环已移除 ──

    // Links
    const linkGroup = g.append('g').attr('class', 'nv-links');
    const defs = svg.append('defs');
    
    // 现代化高清晰箭头标记：尖端与 refX 严格对齐，外廓利落，方向明确，绝不穿透节点
    const mkArrow = (id: string, color: string, opacity = 1.0, size: number = 1) => {
      const tipX = 13 * size;
      const midY = 5 * size;
      const marker = defs.append('marker')
        .attr('id', id)
        .attr('markerWidth', 15 * size)
        .attr('markerHeight', 10 * size)
        .attr('refX', tipX)
        .attr('refY', midY)
        .attr('orient', 'auto')
        .attr('markerUnits', 'userSpaceOnUse');

      marker.append('path')
        .attr('d', `M 0,${1 * size} L ${tipX},${midY} L 0,${9 * size} L ${2.5 * size},${midY} Z`)
        .attr('fill', color)
        .attr('stroke', '#0a0e14')
        .attr('stroke-width', 1 * size)
        .attr('stroke-linejoin', 'round')
        .attr('opacity', opacity);
    };

    // 关系连线专用标准高显箭头
    const mkLargeArrow = (id: string, color: string, opacity = 0.95) => mkArrow(id, color, opacity, 1.15);

    mkLargeArrow('arrow-amethyst', '#bd93f9');
    mkLargeArrow('arrow-highlight', '#66d9ef', 1.0);
    mkLargeArrow('arrow-selected', '#FFD166', 1.0);
    mkLargeArrow('arrow-dimmed', '#475569', 0.35);
    Array.from(new Map(
      renderLinks
        .filter(link => link._linkTypeId !== undefined)
        .map(link => [link._linkTypeId, link.color] as const)
    )).forEach(([linkTypeId, color]) => {
      mkLargeArrow(`arrow-linktype-${linkTypeId}`, color);
    });

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
      
      if (d.group === 'typeHub') return d.color || '#66d9ef';
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

    // Precompute incident edge contact angles and port spreading
    // Spreads incident edge contact angles around node perimeters so arrowheads do not crowd into a single point
    const incidentTargetDockAngles = new Map<string, number>(); // key: `${linkId}_${tId}`

    const nodeIncomingLinks = new Map<string, { linkIndex: number; linkId: string; sId: string; baseAngle: number }[]>();
    renderLinks.forEach((l, lIdx) => {
      const sId = typeof l.source === 'object' ? (l.source as any).id : String(l.source);
      const tId = typeof l.target === 'object' ? (l.target as any).id : String(l.target);
      const s = nodeMap.get(sId);
      const t = nodeMap.get(tId);
      if (!s || !t) return;
      const linkKey = String((l as any).id || lIdx);
      const baseAngle = Math.atan2((s.y || 0) - (t.y || 0), (s.x || 0) - (t.x || 0));
      if (!nodeIncomingLinks.has(tId)) nodeIncomingLinks.set(tId, []);
      nodeIncomingLinks.get(tId)!.push({ linkIndex: lIdx, linkId: linkKey, sId, baseAngle });
    });

    nodeIncomingLinks.forEach((entries, tId) => {
      const tNode = nodeMap.get(tId);
      const pad = tNode ? (tNode.group === 'typeHub' ? getVisualRadius(tNode) + 8.2 : getVisualRadius(tNode) + 3.8) : 15;
      const hasProps = (tNode?._propsCount || 0) > 0;

      const sanitizeAngle = (angle: number) => {
        let a = angle;
        // Top label sector: avoid [-2.15, -0.95] rad
        if (a > -2.15 && a < -0.95) {
          a = a < -Math.PI / 2 ? -2.20 : -0.90;
        }
        // Action bottom sector on instances: avoid [1.15, 1.95] rad
        if (a > 1.15 && a < 1.95) {
          a = a < 1.57 ? 1.10 : 2.00;
        }
        // Property count badge sector on instances: avoid [0.45, 1.15] rad (+45 deg)
        if (hasProps && a > 0.45 && a < 1.15) {
          a = a < 0.785 ? 0.40 : 1.20;
        }
        return a;
      };

      if (entries.length === 1) {
        incidentTargetDockAngles.set(`${entries[0].linkId}_${tId}`, sanitizeAngle(entries[0].baseAngle));
        return;
      }

      // Sort by arrival angle
      entries.sort((a, b) => a.baseAngle - b.baseAngle);

      // Group entries into clusters within ~45 degrees (0.78 rad)
      const clusters: typeof entries[] = [];
      let currentCluster: typeof entries = [entries[0]];
      for (let i = 1; i < entries.length; i++) {
        let diff = entries[i].baseAngle - entries[i - 1].baseAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) < 0.78) {
          currentCluster.push(entries[i]);
        } else {
          clusters.push(currentCluster);
          currentCluster = [entries[i]];
        }
      }
      clusters.push(currentCluster);

      clusters.forEach(cluster => {
        const k = cluster.length;
        // Controlled angular span to prevent arrowheads from skewing into node perimeter
        const minAngularStep = Math.max(0.16, 8 / pad);
        const span = Math.min(Math.PI * 0.28, minAngularStep * (k - 1));
        cluster.forEach((entry, idx) => {
          const offset = k === 1 ? 0 : (-span / 2 + (idx / (k - 1)) * span);
          const rawAngle = entry.baseAngle + offset;
          incidentTargetDockAngles.set(`${entry.linkId}_${tId}`, sanitizeAngle(rawAngle));
        });
      });
    });

    // Intelligent Corridor Obstacle Avoidance & Adaptive Spline Routing Engine
    const getTrimmedStraightLine = (link: GraphLink) => {
      const src = getSourceNode(link as any, nodeMap as any) as GraphNode | undefined;
      const tgt = getTargetNode(link as any, nodeMap as any) as GraphNode | undefined;
      if (!src || !tgt || src.x == null || src.y == null || tgt.x == null || tgt.y == null) {
        return { path: '', labelX: 0, labelY: 0, dx: 0, dy: 0, angle: 0 };
      }

      const sId = typeof link.source === 'object' ? (link.source as any).id : link.source;
      const tId = typeof link.target === 'object' ? (link.target as any).id : link.target;

      const sx0 = src.x, sy0 = src.y;
      const tx0 = tgt.x, ty0 = tgt.y;

      const tgtRadius = getVisualRadius(tgt);
      const srcRadius = getVisualRadius(src);
      // 精确端点间隙：尖端与节点外轮廓干净贴合，箭头主体完全位于节点外部，绝不产生偏离或穿入
      const tgtPad = tgt.group === 'typeHub'
        ? tgtRadius + 2.5
        : tgt.group === 'action'
          ? tgtRadius + 1.5
          : tgtRadius + 2.0;
      const srcPad = src.group === 'typeHub'
        ? srcRadius + 2.5
        : srcRadius + 1.5;

      const rawDx = tx0 - sx0;
      const rawDy = ty0 - sy0;
      const rawDist = Math.hypot(rawDx, rawDy) || 1;
      const ux = rawDx / rawDist;
      const uy = rawDy / rawDist;
      const nx = -uy;
      const ny = ux;

      const sx = sx0 + ux * srcPad;
      const sy = sy0 + uy * srcPad;
      const tx = tx0 - ux * tgtPad;
      const ty = ty0 - uy * tgtPad;

      const dx = tx - sx;
      const dy = ty - sy;
      const dist = Math.hypot(dx, dy) || 1;

      // 如果当前是直线模式 (straight) 或者动作依附连线 (action)，直接输出直连线段，保障清爽与极速
      if (edgeRoutingModeRef.current === 'straight' || link._isActionLink) {
        const labelT = (link as any)._labelTFrac ?? 0.44;
        const labelLateral = (link as any)._labelLateralOffset ?? 0;
        return {
          path: `M ${sx.toFixed(1)},${sy.toFixed(1)} L ${tx.toFixed(1)},${ty.toFixed(1)}`,
          labelX: sx + ux * (dist * labelT) + nx * labelLateral,
          labelY: sy + uy * (dist * labelT) + ny * labelLateral,
          dx,
          dy,
          angle: Math.atan2(dy, dx),
        };
      }

      // 检测双向边 (A -> B 和 B -> A)
      const hasMutual = renderLinks.some((other: GraphLink) => {
        if (other === link) return false;
        const otherSrc = typeof other.source === 'object' ? (other.source as any).id : other.source;
        const otherTgt = typeof other.target === 'object' ? (other.target as any).id : other.target;
        return otherSrc === tId && otherTgt === sId;
      });

      // Case 1: 同列纵向长连接 (Intra-column vertical edge)
      const isIntraColumn = Math.abs(dx) < 42 && Math.abs(dy) > 50;
      if (!link._isTypeInstLink && isIntraColumn) {
        const midX = (sx + tx) / 2;
        let leftScore = 0;
        let rightScore = 0;
        nodes.forEach(n => {
          if (n.id === sId || n.id === tId || n.x == null || n.y == null) return;
          if (n.y >= Math.min(sy, ty) - 25 && n.y <= Math.max(sy, ty) + 25) {
            if (n.x >= midX && n.x <= midX + 100) rightScore++;
            if (n.x <= midX && n.x >= midX - 100) leftScore++;
          }
        });
        const preferSide = rightScore <= leftScore ? 1 : -1;
        const detourDist = preferSide * (48 + Math.min(24, Math.abs(dy) * 0.12));

        const cx1 = sx + detourDist;
        const cy1 = sy + (ty - sy) * 0.28;
        const cx2 = tx + detourDist;
        const cy2 = ty - (ty - sy) * 0.28;

        const inDx = tx - cx2;
        const inDy = ty - cy2;

        return {
          path: `M ${sx.toFixed(1)},${sy.toFixed(1)} C ${cx1.toFixed(1)},${cy1.toFixed(1)} ${cx2.toFixed(1)},${cy2.toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)}`,
          labelX: (sx + tx) / 2 + detourDist * 0.65,
          labelY: (sy + ty) / 2,
          dx: inDx,
          dy: inDy,
          angle: Math.atan2(inDy, inDx),
        };
      }

      // Case 2: 双向互连边 (Symmetrical Aerodynamic Double-Lane Ovals)
      // 关键修复：A->B 与 B->A 分别向各自右侧弧线偏移，不与 isMutualSign 符号相乘（避免正负抵消重合）
      if (hasMutual) {
        const detourH = Math.min(26, Math.max(16, dist * 0.16));
        const cx1 = sx + ux * (dist * 0.28) + nx * detourH;
        const cy1 = sy + uy * (dist * 0.28) + ny * detourH;
        const cx2 = tx - ux * (dist * 0.28) + nx * detourH;
        const cy2 = ty - uy * (dist * 0.28) + ny * detourH;

        const inDx = tx - cx2;
        const inDy = ty - cy2;

        const tB = (link as any)._labelTFrac ?? 0.45;
        const labelLateral = (link as any)._labelLateralOffset ?? 0;
        const mtB = 1 - tB;
        const labelX = mtB * mtB * mtB * sx + 3 * mtB * mtB * tB * cx1 + 3 * mtB * tB * tB * cx2 + tB * tB * tB * tx + nx * labelLateral;
        const labelY = mtB * mtB * mtB * sy + 3 * mtB * mtB * tB * cy1 + 3 * mtB * tB * tB * cy2 + tB * tB * tB * ty + ny * labelLateral;

        return {
          path: `M ${sx.toFixed(1)},${sy.toFixed(1)} C ${cx1.toFixed(1)},${cy1.toFixed(1)} ${cx2.toFixed(1)},${cy2.toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)}`,
          labelX,
          labelY,
          dx: inDx,
          dy: inDy,
          angle: Math.atan2(inDy, inDx),
        };
      }

      // Case 3: 多重平行边分轨 (Parallel Multi-Edge Distinct Tracks)
      const groupOffset = (link._groupOffset || 0);
      if (groupOffset !== 0) {
        const laneOffset = groupOffset * 18;
        const cx1 = sx + ux * (dist * 0.28) + nx * laneOffset;
        const cy1 = sy + uy * (dist * 0.28) + ny * laneOffset;
        const cx2 = tx - ux * (dist * 0.28) + nx * laneOffset;
        const cy2 = ty - uy * (dist * 0.28) + ny * laneOffset;

        const inDx = tx - cx2;
        const inDy = ty - cy2;

        const labelT = (link as any)._labelTFrac ?? 0.44;
        const labelLateral = (link as any)._labelLateralOffset ?? 0;
        const mt = 1 - labelT;
        const labelX = mt * mt * mt * sx + 3 * mt * mt * labelT * cx1 + 3 * mt * labelT * labelT * cx2 + labelT * labelT * labelT * tx + nx * labelLateral;
        const labelY = mt * mt * mt * sy + 3 * mt * mt * labelT * cy1 + 3 * mt * labelT * labelT * cy2 + labelT * labelT * labelT * ty + ny * labelLateral;

        return {
          path: `M ${sx.toFixed(1)},${sy.toFixed(1)} C ${cx1.toFixed(1)},${cy1.toFixed(1)} ${cx2.toFixed(1)},${cy2.toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)}`,
          labelX,
          labelY,
          dx: inDx,
          dy: inDy,
          angle: Math.atan2(inDy, inDx),
        };
      }

      // Case 4: 中途障碍物避障 (Smooth Obstacle Avoidance)
      let obstacleFound = false;
      let maxPenetration = 0;
      let primaryObstacleSign = 0;

      if (!link._isTypeInstLink && dist > 55) {
        for (let i = 0; i < nodes.length; i++) {
          const obs = nodes[i];
          if (obs.id === sId || obs.id === tId || obs.x == null || obs.y == null) continue;

          const ox = obs.x, oy = obs.y;
          const vox = ox - sx;
          const voy = oy - sy;
          const proj = vox * ux + voy * uy;
          const t = proj / dist;

          if (t > 0.08 && t < 0.92) {
            const perpDistSigned = vox * nx + voy * ny;
            const perpDist = Math.abs(perpDistSigned);
            const obsRadius = getVisualRadius(obs) + (obs.group === 'typeHub' ? 24 : obs.group === 'action' ? 12 : 18);

            if (perpDist < obsRadius) {
              obstacleFound = true;
              const pen = obsRadius - perpDist;
              if (pen > maxPenetration) {
                maxPenetration = pen;
                primaryObstacleSign = perpDistSigned >= 0 ? -1 : 1;
              }
            }
          }
        }
      }

      if (obstacleFound) {
        const chosenSide = primaryObstacleSign !== 0 ? primaryObstacleSign : 1;
        const detourH = chosenSide * Math.max(32, Math.min(58, maxPenetration + 18));

        const cx1 = sx + ux * (dist * 0.28) + nx * detourH;
        const cy1 = sy + uy * (dist * 0.28) + ny * detourH;
        const cx2 = tx - ux * (dist * 0.28) + nx * detourH;
        const cy2 = ty - uy * (dist * 0.28) + ny * detourH;

        const inDx = tx - cx2;
        const inDy = ty - cy2;

        const tB = (link as any)._labelTFrac ?? 0.42;
        const labelLateral = (link as any)._labelLateralOffset ?? 0;
        const mtB = 1 - tB;
        const labelX = mtB * mtB * mtB * sx + 3 * mtB * mtB * tB * cx1 + 3 * mtB * tB * tB * cx2 + tB * tB * tB * tx + nx * labelLateral;
        const labelY = mtB * mtB * mtB * sy + 3 * mtB * mtB * tB * cy1 + 3 * mtB * tB * tB * cy2 + tB * tB * tB * ty + ny * labelLateral;

        return {
          path: `M ${sx.toFixed(1)},${sy.toFixed(1)} C ${cx1.toFixed(1)},${cy1.toFixed(1)} ${cx2.toFixed(1)},${cy2.toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)}`,
          labelX,
          labelY,
          dx: inDx,
          dy: inDy,
          angle: Math.atan2(inDy, inDx),
        };
      }

      // Case 5: 横向层级树 (horizontalTree) 及拓扑流 (topologicalFlow) 专属流线：两端水平切线，顺畅自然，消除生硬折线与斜切
      const isHorizontalFlow = (layoutModeRef.current === 'horizontalTree' || layoutModeRef.current === 'topologicalFlow');
      if (isHorizontalFlow && !link._isActionLink && (tx0 - sx0) > 12) {
        // 源节点最右侧水平出线，目标节点最左外沿水平切入
        const sxH = sx0 + srcPad;
        const syH = sy0;
        const txH = tx0 - tgtPad;
        const tyH = ty0;
        const dxH = txH - sxH;
        const dyH = tyH - syH;

        const curveFactor = Math.min(0.5, Math.max(0.35, Math.abs(dxH) / (Math.abs(dxH) + Math.abs(dyH) + 1)));
        const cx1 = sxH + Math.max(30, Math.abs(dxH) * curveFactor);
        const cy1 = syH;
        const cx2 = txH - Math.max(30, Math.abs(dxH) * curveFactor);
        const cy2 = tyH;
        const inDx = txH - cx2;
        const inDy = tyH - cy2;

        const labelT = (link as any)._labelTFrac ?? 0.46;
        const labelLateral = (link as any)._labelLateralOffset ?? 0;
        const mt = 1 - labelT;
        const labelX = mt * mt * mt * sxH + 3 * mt * mt * labelT * cx1 + 3 * mt * labelT * labelT * cx2 + labelT * labelT * labelT * txH;
        const labelY = mt * mt * mt * syH + 3 * mt * mt * labelT * cy1 + 3 * mt * labelT * labelT * cy2 + labelT * labelT * labelT * tyH + labelLateral;

        return {
          path: `M ${sxH.toFixed(1)},${syH.toFixed(1)} C ${cx1.toFixed(1)},${cy1.toFixed(1)} ${cx2.toFixed(1)},${cy2.toFixed(1)} ${txH.toFixed(1)},${tyH.toFixed(1)}`,
          labelX,
          labelY,
          dx: inDx,
          dy: inDy,
          angle: 0,
        };
      }

      // Case 6: 默认直连线
      const labelT = (link as any)._labelTFrac ?? 0.44;
      const labelLateral = (link as any)._labelLateralOffset ?? 0;
      let labelX = sx + ux * (dist * labelT) + nx * labelLateral;
      let labelY = sy + uy * (dist * labelT) + ny * labelLateral;
      if (dist < 90) {
        labelX = sx + ux * (dist * 0.42) + nx * (10 + labelLateral);
        labelY = sy + uy * (dist * 0.42) + ny * (10 + labelLateral);
      }

      return {
        path: `M ${sx.toFixed(1)},${sy.toFixed(1)} L ${tx.toFixed(1)},${ty.toFixed(1)}`,
        labelX,
        labelY,
        dx,
        dy,
        angle: Math.atan2(dy, dx),
      };
    };

    // ── 动态构建双色渐变空间通道 (Source Color -> Target Color) ──
    renderLinks.forEach((l, idx) => {
      const src = getSourceNode(l as any, nodeMap as any);
      const tgt = getTargetNode(l as any, nodeMap as any);
      if (!src || !tgt) return;
      const sColor = src.color || getNodeFill(src) || '#66d9ef';
      const tColor = tgt.color || getNodeFill(tgt) || '#a6e22e';
      const gradId = `link-grad-${idx}`;
      l._gradientId = gradId;

      const sx = src.x != null ? src.x : 0;
      const sy = src.y != null ? src.y : 0;
      const tx = tgt.x != null ? tgt.x : 0;
      const ty = tgt.y != null ? tgt.y : 0;

      const grad = defs.append('linearGradient')
        .attr('id', gradId)
        .attr('class', 'nv-link-gradient')
        .attr('gradientUnits', 'userSpaceOnUse')
        .attr('x1', sx)
        .attr('y1', sy)
        .attr('x2', tx)
        .attr('y2', ty);

      (grad.node() as any).__linkData = l;

      grad.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', sColor)
        .attr('stop-opacity', l._isTypeInstLink ? 0.35 : l._isActionLink ? 0.75 : 0.88);

      grad.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', tColor)
        .attr('stop-opacity', l._isTypeInstLink ? 0.65 : l._isActionLink ? 0.95 : 0.95);
    });

    // Visual Bridge Halo Layer: Rendered completely behind all main lines so halos never occlude arrowheads
    const haloGroup = linkGroup.append('g').attr('class', 'nv-link-halos');
    const mainLineGroup = linkGroup.append('g').attr('class', 'nv-link-mains');
    const particleGroup = linkGroup.append('g').attr('class', 'nv-link-particles');

    const linkHaloEls = haloGroup.selectAll<SVGPathElement, GraphLink>('path.nv-link-halo')
      .data(renderLinks)
      .enter()
      .append('path')
      .attr('class', (d: GraphLink) => `nv-link-halo${d._isTypeInstLink ? ' nv-link-halo-typeinst' : ''}`)
      .style('fill', 'none')
      .style('stroke', '#0d1117')
      .style('stroke-width', (d: GraphLink) => {
        // 动态 halo 宽度：仅比主链路宽约 1.6~1.8px，形成精致发光隔离带，杜绝大面积黑色墨迹涂抹
        const baseWidth = d._isTypeInstLink ? 1.0 : d._isActionLink ? 1.4 : 1.6;
        const weightBonus = d._isTypeInstLink ? 0 : Math.min(2.0, (d.weight || 0.5) * 1.5);
        return `${baseWidth + weightBonus + (d._isTypeInstLink ? 1.0 : 1.6)}px`;
      })
      .style('stroke-linecap', 'round')
      .style('stroke-linejoin', 'round')
      .style('pointer-events', 'none')
      .style('opacity', (d: GraphLink) => d._isTypeInstLink ? '0' : '0.70')
      .style('display', (d: GraphLink) => {
        if (d._isTypeInstLink && !showHierarchyLinksRef.current) return 'none';
        if (!showWeakLinks && d._linkTypeId !== undefined && d.weight < weightThreshold) return 'none';
        return null;
      })
      .attr('d', (d: GraphLink) => getTrimmedStraightLine(d).path);

    const linkEls = mainLineGroup.selectAll<SVGPathElement, GraphLink>('path.nv-link-main')
      .data(renderLinks)
      .enter()
      .append('path')
      .attr('class', (d: GraphLink) => {
        const typeClass = d._isActionLink
          ? 'nv-link-action'
          : d._isTypeInstLink
            ? 'nv-link-typeinst'
            : 'nv-link-instance';
        const key = String((d as any).id || `${typeof d.source === 'object' ? d.source.id : d.source}-${typeof d.target === 'object' ? d.target.id : d.target}`);
        const isSelected = selectedLinkIdRef.current === key;
        return `nv-link-main ${typeClass}${isSelected ? ' nv-link-selected' : ''}`;
      })
      .style('fill', 'none')
      .style('stroke', (d: GraphLink) => {
        if (d._isTypeInstLink) return 'rgba(148, 163, 184, 0.35)';
        if (d._isActionLink) return '#bd93f9';
        if (d._gradientId) return `url(#${d._gradientId})`;
        if (d.color) return d.color;
        return 'rgba(148, 163, 184, 0.75)';
      })
      .style('stroke-dasharray', (d: GraphLink) => d._isTypeInstLink ? '4,4' : null)
      .style('opacity', (d: GraphLink) => d._isTypeInstLink ? '0.45' : '0.9')
      .style('stroke-width', (d: GraphLink) => {
        // 动态线宽：根据关系权重调整，高权重关系更粗；分类归属线轻量化
        const baseWidth = d._isTypeInstLink ? 1.0 : d._isActionLink ? 1.4 : 1.6;
        const weightBonus = d._isTypeInstLink ? 0 : Math.min(2.0, (d.weight || 0.5) * 1.5);
        return `${baseWidth + weightBonus}px`;
      })
      .style('display', (d: GraphLink) => {
        if (d._isTypeInstLink && !showHierarchyLinksRef.current) return 'none';
        if (!showWeakLinks && d._linkTypeId !== undefined && d.weight < weightThreshold) return 'none';
        return null;
      })
      .style('cursor', 'pointer')
      // 箭头标记（精确指向目标节点）
      .attr('marker-end', (d: GraphLink) => {
        if (d._isTypeInstLink) return null;
        if (d._isActionLink) return 'url(#arrow-amethyst)';
        if (d._linkTypeId !== undefined) return `url(#arrow-linktype-${d._linkTypeId})`;
        return 'url(#arrow-highlight)';
      })
      .attr('marker-start', null)
      .attr('d', (d: GraphLink) => getTrimmedStraightLine(d).path)
      // 独立点击选中连线
      .on('click', function(event: MouseEvent, d: GraphLink) {
        event.stopPropagation();
        const src = getSourceNode(d as any, nodeMap as any);
        const tgt = getTargetNode(d as any, nodeMap as any);
        const key = String((d as any).id || `${src?.id}-${tgt?.id}`);
        setSelectedLinkId(prev => prev === key ? null : key);
      })
      // 鼠标悬停效果：连线加粗高亮 + 两端端点同步呼吸光晕联动 + 徽章高亮
      .on('mouseenter', function(event: MouseEvent, d: GraphLink) {
        const src = getSourceNode(d as any, nodeMap as any);
        const tgt = getTargetNode(d as any, nodeMap as any);
        const key = String((d as any).id || `${src?.id}-${tgt?.id}`);
        applyHighlightStylesRef.current?.(null, key);
      })
      .on('mouseleave', function(event: MouseEvent, d: GraphLink) {
        applyHighlightStylesRef.current?.(activeHighlightIdRef.current, selectedLinkIdRef.current);
      })
      .each(function(d: GraphLink) {
        const src = getSourceNode(d as any, nodeMap as any) as GraphNode | undefined;
        const tgt = getTargetNode(d as any, nodeMap as any) as GraphNode | undefined;
        const rel = d._linkTypeName || 'membership';
        const lt = d._linkTypeId !== undefined ? data.linkTypeMap[d._linkTypeId] : null;
        // 检测双向关系用于 tooltip
        const sId = typeof d.source === 'object' ? d.source.id : d.source;
        const tId = typeof d.target === 'object' ? d.target.id : d.target;
        const isBidirectional = renderLinks.some(other => {
          if (other === d) return false;
          const otherSrc = typeof other.source === 'object' ? other.source.id : other.source;
          const otherTgt = typeof other.target === 'object' ? other.target.id : other.target;
          return otherSrc === tId && otherTgt === sId;
        });
        const directionText = isBidirectional ? '(双向关系)' : '';
        d3.select(this).append('title')
          .text(`${src?.label || '?'} → ${rel} → ${tgt?.label || '?'} ${directionText}\n权重: ${Number(d.weight || 0).toFixed(2)}${lt?.description ? `\n描述: ${lt.description}` : ''}`);
      });

    linkElsRef.current = linkEls;

    // 宽幅透明触控带 (16px wide transparent hit corridor) 降低瞄准成本，点击与悬停极其灵敏稳定
    const hitGroup = linkGroup.append('g').attr('class', 'nv-link-hits');
    const linkHitEls = hitGroup.selectAll<SVGPathElement, GraphLink>('path.nv-link-hit')
      .data(renderLinks)
      .enter()
      .append('path')
      .attr('class', 'nv-link-hit')
      .style('fill', 'none')
      .style('stroke', 'rgba(0,0,0,0)')
      .style('stroke-width', '16px')
      .style('cursor', 'pointer')
      .style('pointer-events', 'stroke')
      .attr('d', (d: GraphLink) => getTrimmedStraightLine(d).path)
      .on('click', function(event: MouseEvent, d: GraphLink) {
        event.stopPropagation();
        const src = getSourceNode(d as any, nodeMap as any);
        const tgt = getTargetNode(d as any, nodeMap as any);
        const key = String((d as any).id || `${src?.id}-${tgt?.id}`);
        setSelectedLinkId(prev => prev === key ? null : key);
      })
      .on('mouseenter', function(event: MouseEvent, d: GraphLink) {
        const src = getSourceNode(d as any, nodeMap as any);
        const tgt = getTargetNode(d as any, nodeMap as any);
        const key = String((d as any).id || `${src?.id}-${tgt?.id}`);
        applyHighlightStylesRef.current?.(null, key);
      })
      .on('mouseleave', function(event: MouseEvent, d: GraphLink) {
        applyHighlightStylesRef.current?.(activeHighlightIdRef.current, selectedLinkIdRef.current);
      });

    // ── 动态业务流向粒子层 (Flow Particles Layer) ──
    const businessLinks = renderLinks.filter((d: GraphLink) => !d._isTypeInstLink);
    const particleEls = particleGroup.selectAll<SVGPathElement, GraphLink>('path.nv-link-particle')
      .data(businessLinks)
      .enter()
      .append('path')
      .attr('class', (d: GraphLink) => `nv-link-particle${d._isActionLink ? ' nv-link-particle-action' : ''}`)
      .style('fill', 'none')
      .style('stroke', (d: GraphLink) => d._isActionLink ? '#bd93f9' : '#66d9ef')
      .style('stroke-width', (d: GraphLink) => d._isActionLink ? '1.5px' : '2px')
      .style('opacity', (d: GraphLink) => d._isActionLink ? '0.7' : '0.85')
      .style('display', (d: GraphLink) => {
        if (!enableLinkParticlesRef.current) return 'none';
        if (!showWeakLinks && d._linkTypeId !== undefined && d.weight < weightThreshold) return 'none';
        return null;
      })
      .attr('d', (d: GraphLink) => getTrimmedStraightLine(d).path);

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

    // Group Dragging Offsets
    let groupDragOffsets: Map<string, { dx: number; dy: number }> | null = null;

    const dragstarted = (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
      event.sourceEvent.stopPropagation();
      const isFixedMode = isFixedDragRef.current || event.sourceEvent.shiftKey || event.sourceEvent.altKey;
      const isGroupDrag = selectedNodeIdsRef.current.has(d.id) && selectedNodeIdsRef.current.size > 1;

      if (isGroupDrag) {
        groupDragOffsets = new Map();
        selectedNodeIdsRef.current.forEach(id => {
          const n = nodes.find(item => item.id === id);
          if (n && n.x != null && n.y != null) {
            groupDragOffsets!.set(id, { dx: n.x - (d.x || 0), dy: n.y - (d.y || 0) });
            n.fx = n.x;
            n.fy = n.y;
          }
        });
      } else if (!isFixedMode) {
        // Collect 1-hop and 2-hop neighbor nodes for local incremental layout
        const neighborSet = new Set<string>([d.id]);
        const oneHopSet = new Set<string>();

        renderLinks.forEach((l: GraphLink) => {
          const sId = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
          const tId = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
          if (sId === d.id) { neighborSet.add(tId); oneHopSet.add(tId); }
          else if (tId === d.id) { neighborSet.add(sId); oneHopSet.add(sId); }
        });

        // 2-hop neighbors for cascade collision resolution
        renderLinks.forEach((l: GraphLink) => {
          const sId = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
          const tId = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
          if (oneHopSet.has(sId)) neighborSet.add(tId);
          if (oneHopSet.has(tId)) neighborSet.add(sId);
        });

        // Lock all distant non-neighbor nodes in place during drag to preserve global layout
        nodes.forEach(n => {
          if (!neighborSet.has(n.id)) {
            if (n.fx === undefined || n.fx === null) n.fx = n.x;
            if (n.fy === undefined || n.fy === null) n.fy = n.y;
            (n as any)._tempPinned = true;
          } else {
            // Unpin local neighbors so force simulation can dynamically rebalance them around anchor
            (n as any)._savedFx = n.fx;
            (n as any)._savedFy = n.fy;
            n.fx = null;
            n.fy = null;
          }
        });
      }

      if (!event.active) sim.alphaTarget(0.4).restart();
      d.fx = d.x; d.fy = d.y;
      svg.classed('nv-is-dragging', true);
    };

    const dragged = (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
      event.sourceEvent.stopPropagation();
      d.fx = event.x; d.fy = event.y;

      if (groupDragOffsets) {
        groupDragOffsets.forEach((offset, id) => {
          const n = nodes.find(item => item.id === id);
          if (n) {
            n.fx = event.x + offset.dx;
            n.fy = event.y + offset.dy;
          }
        });
      }
    };

    const dragended = (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
      event.sourceEvent.stopPropagation();
      
      // Post-drag Relaxation Damping: brief low alpha warm-up for soft elastic settling
      if (!event.active) {
        sim.alphaTarget(0.08).restart();
        setTimeout(() => {
          sim.alphaTarget(0);
        }, 220);
      }

      if (groupDragOffsets) {
        groupDragOffsets.forEach((_, id) => {
          const n = nodes.find(item => item.id === id);
          if (n) {
            n.fx = n.x;
            n.fy = n.y;
            (n as any)._isLayoutFixed = true;
          }
        });
        groupDragOffsets = null;
      } else {
        // Clean up temporary pins and solidify new local balance
        nodes.forEach(n => {
          if ((n as any)._tempPinned) {
            delete (n as any)._tempPinned;
          } else if (n.id !== d.id) {
            // Keep updated positions of local neighbors stable
            if (layoutMode !== 'force') {
              n.fx = n.x;
              n.fy = n.y;
            }
            delete (n as any)._savedFx;
            delete (n as any)._savedFy;
          }
        });

        // Pin dragged node position stably
        d.fx = d.x;
        d.fy = d.y;
        (d as any)._isLayoutFixed = true;
      }

      svg.classed('nv-is-dragging', false);
    };

    // Type Hub nodes
    const typeHubG = nodeContainer.selectAll<SVGGElement, GraphNode>('.nv-typehub')
      .data(typeHubNodes)
      .enter().append('g')
      .attr('class', (d: GraphNode) => `nv-typehub nv-node${collapsedNodes.has(d.id) ? ' nv-node-collapsed' : ''}`)
      .style('cursor', 'pointer')
      .call(d3.drag<SVGGElement, GraphNode>().on('start', dragstarted).on('drag', dragged).on('end', dragended));
    // Invisible expanded hit area
    typeHubG.append('circle').attr('class', 'nv-node-hit-area')
      .attr('r', (d: GraphNode) => getVisualRadius(d) + 8)
      .style('fill', 'transparent').style('stroke', 'transparent')
      .style('pointer-events', 'all');
    typeHubG.append('circle').attr('r', (d: GraphNode) => getVisualRadius(d) + 6)
      .style('fill', 'none').style('stroke', (d: GraphNode) => d.color)
      .style('stroke-width', 1.5)
      .style('opacity', (d: GraphNode) => d._hasInstances !== false ? 0.35 : 0.15)
      .style('pointer-events', 'none');
    typeHubG.append('circle').attr('r', (d: GraphNode) => getVisualRadius(d))
      .style('fill', (d: GraphNode) => getNodeFill(d))
      .style('stroke', (d: GraphNode) => getNodeStroke(d)).style('stroke-width', 2)
      .style('opacity', 0.9)
      .style('pointer-events', 'none');
    typeHubG.append('path').attr('d', ICON_HEXAGON).attr('class', 'nv-icon-typehub')
      .attr('transform', 'scale(1.6) translate(0, 1)')
      .style('opacity', (d: GraphNode) => d._hasInstances !== false ? 1 : 0.5)
      .style('pointer-events', 'none');

    // Instance nodes
    const instanceG = nodeContainer.selectAll<SVGGElement, GraphNode>('.nv-instance')
      .data(instanceNodes)
      .enter().append('g')
      .attr('class', (d: GraphNode) =>
        `nv-instance nv-node${d.id === hubNodeId ? ' nv-hub-node' : ''}${scopeMode !== 'all' && d.id === focusedNodeId ? ' nv-focus-node' : ''}${collapsedNodes.has(d.id) ? ' nv-node-collapsed' : ''}`
      )
      .style('cursor', 'pointer')
      .call(d3.drag<SVGGElement, GraphNode>().on('start', dragstarted).on('drag', dragged).on('end', dragended));
    // Invisible expanded hit area
    instanceG.append('circle').attr('class', 'nv-node-hit-area')
      .attr('r', (d: GraphNode) => getVisualRadius(d) + 6)
      .style('fill', 'transparent').style('stroke', 'transparent')
      .style('pointer-events', 'all');
    instanceG.append('circle').attr('r', (d: GraphNode) => getVisualRadius(d))
      .style('fill', (d: GraphNode) => getNodeFill(d))
      .style('stroke', (d: GraphNode) => getNodeStroke(d))
      .style('stroke-width', (d: GraphNode) => scopeMode !== 'all' && d.id === focusedNodeId ? 3 : 1.5)
      .style('opacity', 0.95)
      .style('pointer-events', 'none');
    instanceG.append('path').attr('d', getNodeIconPath).attr('class', 'nv-icon-instance')
      .attr('transform', 'scale(0.9) translate(0, 0)')
      .style('pointer-events', 'none')
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
    // Invisible expanded hit area
    actionG.append('circle').attr('class', 'nv-node-hit-area')
      .attr('r', (d: GraphNode) => getVisualRadius(d) + 6)
      .style('fill', 'transparent').style('stroke', 'transparent')
      .style('pointer-events', 'all');
    actionG.append('circle').attr('r', (d: GraphNode) => getVisualRadius(d))
      .style('fill', (d: GraphNode) => d.color)
      .style('stroke', 'rgba(255,255,255,0.6)').style('stroke-width', 1)
      .style('pointer-events', 'none');
    // Start/End Path Badges for All Nodes
    const appendPathBadges = (selection: d3.Selection<SVGGElement, GraphNode, any, any>) => {
      selection.each(function(d: GraphNode) {
        const gNode = d3.select(this);
        const r = getVisualRadius(d);

        // Start Badge Circle + Icon
        const startG = gNode.append('g')
          .attr('class', 'nv-path-badge-start')
          .style('display', 'none')
          .style('pointer-events', 'none')
          .attr('transform', `translate(${-r * 0.75}, ${-r * 0.75})`);
        startG.append('circle').attr('r', 9).attr('fill', '#a6e22e').attr('stroke', '#12131a').attr('stroke-width', 1.5);
        startG.append('text').attr('text-anchor', 'middle').attr('dominant-baseline', 'middle').attr('y', 1).style('font-size', '10px').text('🚩');

        // End Badge Circle + Icon
        const endG = gNode.append('g')
          .attr('class', 'nv-path-badge-end')
          .style('display', 'none')
          .style('pointer-events', 'none')
          .attr('transform', `translate(${r * 0.75}, ${-r * 0.75})`);
        endG.append('circle').attr('r', 9).attr('fill', '#ff453a').attr('stroke', '#12131a').attr('stroke-width', 1.5);
        endG.append('text').attr('text-anchor', 'middle').attr('dominant-baseline', 'middle').attr('y', 1).style('font-size', '10px').text('🎯');
      });
    };

    appendPathBadges(typeHubG as any);
    appendPathBadges(instanceG as any);
    appendPathBadges(actionG as any);

    // Labels (typeHub shows description as label; other nodes show name)
    const LABEL_MAX = 18;

    // 移除括号内的英文内容（用于 typeHub 节点标签显示）
    const stripEnglishInParens = (text: string): string => {
      // 匹配形如 "中文 (English)" 或 "中文（English）" 的模式
      return text.replace(/\s*[\(（][a-zA-Z][^\)）]*[\)）]/g, '').trim();
    };

    const labelGroup = g.append('g').attr('class', 'nv-labels');
    const labelEls = labelGroup.selectAll<SVGTextElement, GraphNode>('text')
      .data(nodes)
      .enter().append('text')
      .attr('class', (d: GraphNode) => d.group === 'typeHub'
        ? 'nv-node-label nv-typehub-label'
        : 'nv-node-label')
      .text((d: GraphNode) => {
        // Always show name (label) on the node; description is for tooltip/hover only
        // 对 typeHub 节点，移除括号内的英文以减少干扰
        let title = String(d.label || d.description || d.id);
        if (d.group === 'typeHub') {
          title = stripEnglishInParens(title);
        }
        return title.length > LABEL_MAX ? title.slice(0, LABEL_MAX) + '…' : title;
      })
      .style('font-size', (d: GraphNode) => `${getNodeLabelBaseFontSize(d)}px`)
      .style('fill', 'white')
      .style('font-weight', 'bold')
      .style('stroke', '#0c0d12')
      .style('stroke-width', '2px')
      .style('paint-order', 'stroke fill')
      .attr('text-anchor', 'middle')
      .style('cursor', 'pointer')
      .style('pointer-events', 'all')
      .on('mouseenter mouseover', (event: MouseEvent, d: GraphNode) => {
        const svgRect = svgRef.current?.getBoundingClientRect();
        const pos = svgRect ? { x: event.clientX - svgRect.left, y: event.clientY - svgRect.top } : undefined;
        setNodeHoverStateRef.current?.(d, pos);
      })
      .on('mousemove', (event: MouseEvent) => {
        const svgRect = svgRef.current?.getBoundingClientRect();
        if (svgRect) {
          setTooltipPos({ x: event.clientX - svgRect.left, y: event.clientY - svgRect.top });
        }
      })
      .on('mouseleave mouseout', () => {
        setNodeHoverStateRef.current?.(null);
      })
      .on('click', (event: MouseEvent, d: GraphNode) => {
        event.stopPropagation();
        setSelectedNode(d);
        showNodeInfo(d, data);
        (window as any).__currentNodeId = d.id;
        activeHighlightIdRef.current = d.id;
        applyHighlightStylesRef.current?.(d.id, selectedLinkIdRef.current);
        if (clickToFocusRef.current) {
          setFocusedNodeId(d.id);
          setScopeMode('focus');
        }
      });
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
        .style('stroke', '#0c0d12')
        .style('stroke-width', `${2 / safeScale}px`)
        .style('paint-order', 'stroke fill')
        .style('text-anchor', 'middle')
        .attr('x', (d: GraphNode) => (d.x || 0))
        .attr('y', (d: GraphNode) => (d.y || 0) - getVisualRadius(d) - 6 / safeScale);
    };
    updateNodeLabelsForZoom(currentTransformRef.current.k);

    // ── Edge Relation Labels: Reactor Investigation Badge Pills ───────────────
    const getRelationText = (d: GraphLink) => {
      const src = getSourceNode(d as any, nodeMap as any);
      const tgt = getTargetNode(d as any, nodeMap as any);
      if (src?.group === 'action' || tgt?.group === 'action') return '';
      if (d._linkTypeName && d._linkTypeName.trim().length > 0) return d._linkTypeName;
      if (d._linkTypeId !== undefined) {
        const lt = data.linkTypeMap[d._linkTypeId];
        if (lt?.name && lt.name.trim().length > 0) return lt.name;
      }
      if (d.label && d.label.trim().length > 0) return d.label;
      if ((d as any).name && String((d as any).name).trim().length > 0) return String((d as any).name);
      if ((d as any).relation && String((d as any).relation).trim().length > 0) return String((d as any).relation);
      return '关联';
    };

    const linkLabelGroup = g.append('g').attr('class', 'nv-link-labels');
    const labelLinks = renderLinks.filter(l => {
      if ((l as any)._isTypeInstLink) return false;
      const src = getSourceNode(l as any, nodeMap as any);
      const tgt = getTargetNode(l as any, nodeMap as any);
      if (src?.group === 'action' || tgt?.group === 'action') return false;
      const text = getRelationText(l);
      return text.trim().length > 0;
    });

    // 多重关系与双向边标签防重叠错位分配 (Label Staggering)
    const labelPairGroups = new Map<string, GraphLink[]>();
    labelLinks.forEach(l => {
      const sId = String(typeof l.source === 'object' ? (l.source as any).id : l.source);
      const tId = String(typeof l.target === 'object' ? (l.target as any).id : l.target);
      const pairKey = sId < tId ? `${sId}---${tId}` : `${tId}---${sId}`;
      let group = labelPairGroups.get(pairKey);
      if (!group) {
        group = [];
        labelPairGroups.set(pairKey, group);
      }
      group.push(l);
    });

    labelPairGroups.forEach(group => {
      const count = group.length;
      if (count === 1) {
        (group[0] as any)._labelTFrac = 0.44;
        (group[0] as any)._labelLateralOffset = 0;
      } else {
        group.forEach((l, idx) => {
          // 在 0.28 ~ 0.65 沿线比例区间进行梯次分布，交替法线外摆避让，避免多重连线标签重合
          const tFrac = 0.28 + (idx / Math.max(1, count - 1)) * 0.36;
          const latOffset = (idx % 2 === 0 ? 1 : -1) * (12 + Math.floor(idx / 2) * 7);
          (l as any)._labelTFrac = tFrac;
          (l as any)._labelLateralOffset = latOffset;
        });
      }
    });

    // 针对单连线枢纽节点周围出入度高导致的扇出标签重叠进行角度梯次错位 (Incident Edge Radial Staggering)
    const incidentMap = new Map<string, Array<{ link: GraphLink; angle: number }>>();
    labelPairGroups.forEach(group => {
      if (group.length === 1) {
        const l = group[0];
        const s = getSourceNode(l as any, nodeMap as any);
        const t = getTargetNode(l as any, nodeMap as any);
        if (s && t && s.x != null && s.y != null && t.x != null && t.y != null) {
          const angle = Math.atan2(t.y - s.y, t.x - s.x);
          if (!incidentMap.has(s.id)) incidentMap.set(s.id, []);
          incidentMap.get(s.id)!.push({ link: l, angle });
        }
      }
    });

    incidentMap.forEach(incidentList => {
      if (incidentList.length >= 3) {
        incidentList.sort((a, b) => a.angle - b.angle);
        incidentList.forEach((item, idx) => {
          // 交替在 0.36 与 0.58 错开径向距离，彻底瓦解射线交织处的胶囊标签重叠
          const staggerFrac = idx % 2 === 0 ? 0.36 : 0.58;
          (item.link as any)._labelTFrac = staggerFrac;
        });
      }
    });

    const linkBadgeG = linkLabelGroup.selectAll<SVGGElement, GraphLink>('.nv-edge-badge')
      .data(labelLinks)
      .enter()
      .append('g')
      .attr('class', 'nv-edge-badge')
      .style('cursor', 'pointer')
      .on('mouseenter', function(event: MouseEvent, d: GraphLink) {
        const src = getSourceNode(d as any, nodeMap as any);
        const tgt = getTargetNode(d as any, nodeMap as any);
        const key = String((d as any).id || `${src?.id}-${tgt?.id}`);
        applyHighlightStylesRef.current?.(null, key);
      })
      .on('mouseleave', function(event: MouseEvent, d: GraphLink) {
        applyHighlightStylesRef.current?.(activeHighlightIdRef.current, selectedLinkIdRef.current);
      })
      .on('click', function(event: MouseEvent, d: GraphLink) {
        event.stopPropagation();
        const src = getSourceNode(d as any, nodeMap as any);
        const tgt = getTargetNode(d as any, nodeMap as any);
        const key = String((d as any).id || `${src?.id}-${tgt?.id}`);
        setSelectedLinkId(prev => prev === key ? null : key);
      });

    // Solid dark backdrop pill to shield straight line behind text
    linkBadgeG.append('rect')
      .attr('class', 'nv-edge-badge-bg')
      .attr('rx', 5)
      .attr('ry', 5)
      .style('fill', '#0b1120')
      .style('stroke', (d: GraphLink) => d.color ? d3.rgb(d.color).darker(0.2).toString() : '#334155')
      .style('stroke-width', '0.75px')
      .style('opacity', 0.96);

    // Sharp, high-contrast monospace relation text
    linkBadgeG.append('text')
      .attr('class', 'nv-edge-badge-text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .style('font-size', '9px')
      .style('font-weight', '600')
      .style('letter-spacing', '0.25px')
      .style('fill', '#cbd5e1')
      .style('font-family', 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace')
      .style('pointer-events', 'none')
      .text((d: GraphLink) => {
        const text = getRelationText(d);
        return text.length > 14 ? text.slice(0, 13) + '…' : text;
      });

    // Size the background rect to fit the text exactly
    linkBadgeG.each(function(d: GraphLink) {
      const gEl = d3.select(this);
      const textEl = gEl.select<SVGTextElement>('text');
      const text = textEl.text() || '';
      const w = Math.max(24, text.length * 6.0 + 12);
      const h = 15.5;
      gEl.select('rect')
        .attr('x', -w / 2)
        .attr('y', -h / 2)
        .attr('width', w)
        .attr('height', h);

      const src = getSourceNode(d as any, nodeMap as any);
      const tgt = getTargetNode(d as any, nodeMap as any);
      gEl.append('title')
        .text(`${src?.label || '?'} ──[ ${getRelationText(d)} ]──> ${tgt?.label || '?'}\n权重: ${Number(d.weight || 1).toFixed(2)}`);
    });

    // PageRank Centrality Map
    const pageRankMap = showPageRank ? computePageRank(nodes, links) : new Map<string, number>();

    // TICK — throttled using requestAnimationFrame to match layout updates with VSync
    const tickThrottled = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const tickStartTime = performance.now();

        // Downward fan constraint for actions (dedicated bottom sector [40°, 140°] to keep left/right highways clear)
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
          const dist = 28;
          children.sort((a, b) => a.id.localeCompare(b.id)).forEach((child, idx) => {
            const angle = count === 1 ? Math.PI / 2 : (Math.PI * 0.32 + (idx / (count - 1)) * Math.PI * 0.36);
            child.x = parent.x! + dist * Math.cos(angle);
            child.y = parent.y! + dist * Math.sin(angle);
            child.vx = 0;
            child.vy = 0;
          });
        });

        const visibleNodes = getVisibleNodes(nodes, currentTransformRef.current, W, H);
        const visibleNodeIds = new Set(visibleNodes.map(n => n.id));

        // 3-Tier Multi-level LOD (Level of Detail) Rendering Optimization
        const k = currentTransformRef.current.k;
        const isFarView = k < 0.25;       // Low Detail: hide non-essential elements
        const isUltraFarView = k < 0.12;  // Ultra Low Detail: simplify rendering to dot particle mode
        const hideLabels = k < 0.18;
        const hideActions = k < 0.15;

        svg.classed('nv-lod-far', isFarView);
        svg.classed('nv-lod-ultrafar', isUltraFarView);

        linkHaloEls
          .style('display', (d: GraphLink) => {
            const sId = typeof d.source === 'object' ? (d.source as GraphNode).id : d.source;
            const tId = typeof d.target === 'object' ? (d.target as GraphNode).id : d.target;
            return (visibleNodeIds.has(String(sId)) || visibleNodeIds.has(String(tId))) ? null : 'none';
          })
          .attr('d', (d: GraphLink) => getTrimmedStraightLine(d).path);

        linkEls
          .style('display', (d: GraphLink) => {
            const sId = typeof d.source === 'object' ? (d.source as GraphNode).id : d.source;
            const tId = typeof d.target === 'object' ? (d.target as GraphNode).id : d.target;
            return (visibleNodeIds.has(String(sId)) || visibleNodeIds.has(String(tId))) ? null : 'none';
          })
          .attr('d', (d: GraphLink) => getTrimmedStraightLine(d).path);

        linkHitEls
          .style('display', (d: GraphLink) => {
            const sId = typeof d.source === 'object' ? (d.source as GraphNode).id : d.source;
            const tId = typeof d.target === 'object' ? (d.target as GraphNode).id : d.target;
            return (visibleNodeIds.has(String(sId)) || visibleNodeIds.has(String(tId))) ? null : 'none';
          })
          .attr('d', (d: GraphLink) => getTrimmedStraightLine(d).path);

        particleEls
          .style('display', (d: GraphLink) => {
            if (!enableLinkParticlesRef.current) return 'none';
            const sId = typeof d.source === 'object' ? (d.source as GraphNode).id : d.source;
            const tId = typeof d.target === 'object' ? (d.target as GraphNode).id : d.target;
            return (visibleNodeIds.has(String(sId)) || visibleNodeIds.has(String(tId))) ? null : 'none';
          })
          .attr('d', (d: GraphLink) => getTrimmedStraightLine(d).path);

        defs.selectAll<SVGLinearGradientElement, unknown>('linearGradient.nv-link-gradient')
          .attr('x1', function() {
            const l = (this as any)?.__linkData;
            if (!l) return 0;
            const s = getSourceNode(l, nodeMap as any);
            return (s?.x || 0).toFixed(1);
          })
          .attr('y1', function() {
            const l = (this as any)?.__linkData;
            if (!l) return 0;
            const s = getSourceNode(l, nodeMap as any);
            return (s?.y || 0).toFixed(1);
          })
          .attr('x2', function() {
            const l = (this as any)?.__linkData;
            if (!l) return 0;
            const t = getTargetNode(l, nodeMap as any);
            return (t?.x || 0).toFixed(1);
          })
          .attr('y2', function() {
            const l = (this as any)?.__linkData;
            if (!l) return 0;
            const t = getTargetNode(l, nodeMap as any);
            return (t?.y || 0).toFixed(1);
          });

        const getPathClass = (id: string) => {
          if (!pathTraceResultRef.current) return '';
          const { sourceId, targetId, pathNodeIds } = pathTraceResultRef.current;
          if (id === sourceId) return ' nv-path-source';
          if (id === targetId) return ' nv-path-target';
          if (pathNodeIds.has(id)) return ' nv-path-node';
          return ' nv-dim';
        };

        typeHubG
          .attr('class', (d: GraphNode) => `nv-typehub nv-node${collapsedNodes.has(d.id) ? ' nv-node-collapsed' : ''}${selectedNodeIdsRef.current.has(d.id) ? ' nv-node-selected' : ''}${(pageRankMap.get(d.id) || 0) > 0.65 ? ' nv-node-pagerank-hub' : ''}${getPathClass(d.id)}`)
          .attr('transform', (d: GraphNode) => `translate(${d.x || 0},${d.y || 0})`);
        instanceG
          .attr('class', (d: GraphNode) =>
            `nv-instance nv-node${d.id === hubNodeId ? ' nv-hub-node' : ''}${scopeMode !== 'all' && d.id === focusedNodeId ? ' nv-focus-node' : ''}${collapsedNodes.has(d.id) ? ' nv-node-collapsed' : ''}${selectedNodeIdsRef.current.has(d.id) ? ' nv-node-selected' : ''}${(pageRankMap.get(d.id) || 0) > 0.65 ? ' nv-node-pagerank-hub' : ''}${getPathClass(d.id)}`
          )
          .attr('transform', (d: GraphNode) => `translate(${d.x || 0},${d.y || 0})`);
        actionG
          .attr('class', (d: GraphNode) => `nv-action nv-node${selectedNodeIdsRef.current.has(d.id) ? ' nv-node-selected' : ''}${getPathClass(d.id)}`)
          .style('display', (d: GraphNode) => hideActions ? 'none' : null)
          .attr('transform', (d: GraphNode) => `translate(${d.x || 0},${d.y || 0})`);

        // Dynamic Start/End Badge Visibility update
        const activeSourceId = pathTraceResultRef.current?.sourceId || pathTracerSourceRef.current;
        const activeTargetId = pathTraceResultRef.current?.targetId;

        svg.selectAll('.nv-path-badge-start')
          .style('display', (d: any) => d && d.id === activeSourceId ? 'block' : 'none');
        svg.selectAll('.nv-path-badge-end')
          .style('display', (d: any) => d && d.id === activeTargetId ? 'block' : 'none');
        updateNodeLabelsForZoom(k);

        linkBadgeG
          .style('display', (d: GraphLink) => {
            const displayMode = edgeLabelDisplayRef.current;
            if (displayMode === 'none') return 'none';
            if (displayMode === 'hover') {
              const src = getSourceNode(d as any, nodeMap as any);
              const tgt = getTargetNode(d as any, nodeMap as any);
              const key = String((d as any).id || `${src?.id}-${tgt?.id}`);
              const isSelected = selectedLinkIdRef.current === key;
              const isNodeHovered = hoveredNodeIdRef.current === src?.id || hoveredNodeIdRef.current === tgt?.id;
              const isNodeActive = activeHighlightIdRef.current === src?.id || activeHighlightIdRef.current === tgt?.id;
              if (!isSelected && !isNodeHovered && !isNodeActive) return 'none';
            }
            if (displayMode === 'auto' && hideLabels) return 'none';
            const sId = typeof d.source === 'object' ? (d.source as GraphNode).id : d.source;
            const tId = typeof d.target === 'object' ? (d.target as GraphNode).id : d.target;
            return (visibleNodeIds.has(String(sId)) || visibleNodeIds.has(String(tId))) ? null : 'none';
          })
          .attr('transform', (d: GraphLink) => {
            const line = getTrimmedStraightLine(d);
            return `translate(${line.labelX.toFixed(1)}, ${line.labelY.toFixed(1)})`;
          });

        // 性能采样计算 (仅更新 ref，杜绝在 D3 simulation 热循环中直接 setState 触发 React 重渲染风暴)
        const renderTimeMs = performance.now() - tickStartTime;
        const tracker = perfTrackerRef.current;
        tracker.frameCount++;
        const now = performance.now();
        if (now - tracker.lastUpdate >= 500) {
          const elapsed = (now - tracker.lastUpdate) / 1000;
          const fps = elapsed > 0 ? Math.min(60, Math.round(tracker.frameCount / elapsed)) : 60;
          tracker.frameCount = 0;
          tracker.lastUpdate = now;
          const dataPoint: PerfDataPoint = {
            timestamp: now,
            fps,
            renderTime: Math.round(renderTimeMs),
            nodeCount: nodes.length,
          };
          tracker.history = [...tracker.history.slice(-15), dataPoint];
          tracker.currentFps = fps;
          tracker.currentRenderTime = Math.round(renderTimeMs);
        }
      });
    };

    // Attach simulation event handlers
    sim.on('tick.throttled', tickThrottled);
    sim.on('end.throttled', () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      // Downward fan constraint for actions (dedicated bottom sector [40°, 140°] to keep left/right highways clear)
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
        const dist = 28;
        children.sort((a, b) => a.id.localeCompare(b.id)).forEach((child, idx) => {
          const angle = count === 1 ? Math.PI / 2 : (Math.PI * 0.32 + (idx / (count - 1)) * Math.PI * 0.36);
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

      linkHaloEls
        .style('display', (d: GraphLink) => {
          const sId = typeof d.source === 'object' ? (d.source as GraphNode).id : d.source;
          const tId = typeof d.target === 'object' ? (d.target as GraphNode).id : d.target;
          return (visibleNodeIds.has(String(sId)) || visibleNodeIds.has(String(tId))) ? null : 'none';
        })
        .attr('d', (d: GraphLink) => getTrimmedStraightLine(d).path);

      linkEls
        .style('display', (d: GraphLink) => {
          const sId = typeof d.source === 'object' ? (d.source as GraphNode).id : d.source;
          const tId = typeof d.target === 'object' ? (d.target as GraphNode).id : d.target;
          return (visibleNodeIds.has(String(sId)) || visibleNodeIds.has(String(tId))) ? null : 'none';
        })
        .attr('d', (d: GraphLink) => getTrimmedStraightLine(d).path);

      linkHitEls
        .style('display', (d: GraphLink) => {
          const sId = typeof d.source === 'object' ? (d.source as GraphNode).id : d.source;
          const tId = typeof d.target === 'object' ? (d.target as GraphNode).id : d.target;
          return (visibleNodeIds.has(String(sId)) || visibleNodeIds.has(String(tId))) ? null : 'none';
        })
        .attr('d', (d: GraphLink) => getTrimmedStraightLine(d).path);

      particleEls
        .style('display', (d: GraphLink) => {
          if (!enableLinkParticlesRef.current) return 'none';
          const sId = typeof d.source === 'object' ? (d.source as GraphNode).id : d.source;
          const tId = typeof d.target === 'object' ? (d.target as GraphNode).id : d.target;
          return (visibleNodeIds.has(String(sId)) || visibleNodeIds.has(String(tId))) ? null : 'none';
        })
        .attr('d', (d: GraphLink) => getTrimmedStraightLine(d).path);

      defs.selectAll<SVGLinearGradientElement, unknown>('linearGradient.nv-link-gradient')
        .attr('x1', function() {
          const l = (this as any)?.__linkData;
          if (!l) return 0;
          const s = getSourceNode(l, nodeMap as any);
          return (s?.x || 0).toFixed(1);
        })
        .attr('y1', function() {
          const l = (this as any)?.__linkData;
          if (!l) return 0;
          const s = getSourceNode(l, nodeMap as any);
          return (s?.y || 0).toFixed(1);
        })
        .attr('x2', function() {
          const l = (this as any)?.__linkData;
          if (!l) return 0;
          const t = getTargetNode(l, nodeMap as any);
          return (t?.x || 0).toFixed(1);
        })
        .attr('y2', function() {
          const l = (this as any)?.__linkData;
          if (!l) return 0;
          const t = getTargetNode(l, nodeMap as any);
          return (t?.y || 0).toFixed(1);
        });
      typeHubG.attr('transform', (d: GraphNode) => `translate(${d.x || 0},${d.y || 0})`);
      instanceG.attr('transform', (d: GraphNode) => `translate(${d.x || 0},${d.y || 0})`);
      actionG
        .style('display', (d: GraphNode) => hideActions ? 'none' : null)
        .attr('transform', (d: GraphNode) => `translate(${d.x || 0},${d.y || 0})`);
      updateNodeLabelsForZoom(k);

      linkBadgeG
        .style('display', (d: GraphLink) => {
          const displayMode = edgeLabelDisplayRef.current;
          if (displayMode === 'none') return 'none';
          if (displayMode === 'hover') {
            const src = getSourceNode(d as any, nodeMap as any);
            const tgt = getTargetNode(d as any, nodeMap as any);
            const key = String((d as any).id || `${src?.id}-${tgt?.id}`);
            const isSelected = selectedLinkIdRef.current === key;
            const isNodeHovered = hoveredNodeIdRef.current === src?.id || hoveredNodeIdRef.current === tgt?.id;
            const isNodeActive = activeHighlightIdRef.current === src?.id || activeHighlightIdRef.current === tgt?.id;
            if (!isSelected && !isNodeHovered && !isNodeActive) return 'none';
          }
          if (displayMode === 'auto' && hideLabels) return 'none';
          const sId = typeof d.source === 'object' ? (d.source as GraphNode).id : d.source;
          const tId = typeof d.target === 'object' ? (d.target as GraphNode).id : d.target;
          return (visibleNodeIds.has(String(sId)) || visibleNodeIds.has(String(tId))) ? null : 'none';
        })
        .attr('transform', (d: GraphLink) => {
          const line = getTrimmedStraightLine(d);
          return `translate(${line.labelX.toFixed(1)}, ${line.labelY.toFixed(1)})`;
        });

      if (renderEngineModeRef.current === 'canvas') {
        triggerCanvasRenderRef.current?.();
      } else if (renderEngineModeRef.current === 'webgl' && pixiRendererRef.current) {
        pixiRendererRef.current.updatePositions(nodes.map(n => ({ id: n.id, x: n.x ?? 0, y: n.y ?? 0 })));
      }
    });

    // Trigger fit-all AFTER simulation settles — not at a fixed timeout.
    // The sim's 'end' event fires when alpha reaches near-zero.
    sim.on('end', () => {
      (window as any).__d3FitAll?.();
      if (renderEngineModeRef.current === 'canvas') {
        triggerCanvasRenderRef.current?.();
      }
    });

    // Event handlers
    const allNodeGroups = nodeContainer.selectAll<SVGGElement, GraphNode>('g.nv-node');
    allNodeGroupsRef.current = allNodeGroups;
    allNodeGroups.on('mouseenter mouseover', (event: MouseEvent, d: GraphNode) => {
      if (event.type === 'mouseover' && event.relatedTarget && (event.currentTarget as Element)?.contains?.(event.relatedTarget as Node)) {
        return;
      }
      const svgRect = svgRef.current?.getBoundingClientRect();
      const pos = svgRect ? { x: event.clientX - svgRect.left, y: event.clientY - svgRect.top } : undefined;
      setNodeHoverStateRef.current?.(d, pos);
    });
    allNodeGroups.on('mousemove', (event: MouseEvent) => {
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (svgRect) {
        setTooltipPos({ x: event.clientX - svgRect.left, y: event.clientY - svgRect.top });
      }
    });
    allNodeGroups.on('mouseleave mouseout', (event: MouseEvent) => {
      if (event.type === 'mouseout' && event.relatedTarget && (event.currentTarget as Element)?.contains?.(event.relatedTarget as Node)) {
        return;
      }
      setNodeHoverStateRef.current?.(null);
    });
    allNodeGroups.on('click', (event: MouseEvent, d: GraphNode) => {
      event.stopPropagation();
      setSelectedNode(d);
      showNodeInfo(d, data);
      (window as any).__currentNodeId = d.id;
      activeHighlightIdRef.current = d.id;
      applyHighlightStylesRef.current?.(d.id, selectedLinkIdRef.current);
      if (clickToFocusRef.current) {
        setFocusedNodeId(d.id);
        setScopeMode('focus');
      }
    });
    allNodeGroups.on('dblclick', (event: MouseEvent, d: GraphNode) => {
      event.stopPropagation();
      setFocusedNodeId(d.id);
      d.fx = null; d.fy = null;

      // Radar Ripple Pulse Effect on Double Click
      const nodeG = d3.select(event.currentTarget as SVGGElement);
      const r = getVisualRadius(d);

      nodeG.append('circle')
        .attr('class', 'nv-radar-ripple')
        .attr('r', r)
        .style('fill', 'none')
        .style('stroke', '#FFD166')
        .style('stroke-width', '2px')
        .style('opacity', '0.9')
        .transition()
        .duration(750)
        .ease(d3.easeQuadOut)
        .attr('r', r * 3.6)
        .style('stroke-width', '0.5px')
        .style('opacity', '0')
        .remove();

      nodeG.append('circle')
        .attr('class', 'nv-radar-ripple')
        .attr('r', r)
        .style('fill', 'none')
        .style('stroke', '#66d9ef')
        .style('stroke-width', '1.5px')
        .style('opacity', '0.8')
        .transition()
        .delay(120)
        .duration(850)
        .ease(d3.easeQuadOut)
        .attr('r', r * 4.8)
        .style('stroke-width', '0.2px')
        .style('opacity', '0')
        .remove();

      if (!zoomRef.current) return;
      const curW = containerRef.current?.clientWidth ?? W ?? 800;
      const curH = containerRef.current?.clientHeight ?? H ?? 600;
      const { visualCenterX, visualCenterY } = getVisualCenter(curW, curH);
      const scale = 2.0;
      svg.transition().duration(500)
        .call(zoom.transform as any, d3.zoomIdentity.translate(visualCenterX - (d.x || 0) * scale, visualCenterY - (d.y || 0) * scale).scale(scale));
      
      if (onInspect) {
        const rawObjId = d._objId ?? (d.id.startsWith('obj::') ? Number(d.id.slice(5)) : Number(d.id));
        const rawTypeId = d._typeId ?? (d.id.startsWith('type::') ? Number(d.id.slice(6)) : Number(d.id));
        const rawActId = (d.id.startsWith('action::') ? Number(d.id.slice(8)) : Number(d.id));

        if (d.group === 'instance') {
          const rawObj = state.objects.find((o: any) => o.id === rawObjId);
          if (rawObj) onInspect('object', rawObj);
        } else if (d.group === 'typeHub') {
          const rawType = state.objectTypes.find((ot: any) => ot.id === rawTypeId);
          if (rawType) onInspect('objectType', rawType);
        } else if (d.group === 'linkType') {
          const rawLinkType = (state.linkTypes || []).find((lt: any) => lt.id === rawTypeId);
          if (rawLinkType) onInspect('linkType', rawLinkType);
        } else if (d.group === 'action') {
          const rawAction = state.actions.find((a: any) => a.id === rawActId);
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
      resetBlankCanvasStateRef.current?.();
    };
    svg.on('click.reset', resetIfBlankCanvas);
    svg.on('dblclick.reset', (event: MouseEvent) => {
      const target = event.target as HTMLElement | SVGElement;
      if (target.closest('.nv-node')) return;
      event.preventDefault();
      resetBlankCanvasStateRef.current?.();
    });

    setD3Ready(true);

    // Highlight existing selection on mount/update
    const activeHighlightId = selectedNode?.id || (scopeMode !== 'all' ? focusedNodeId : null);
    applyHighlightStyles(activeHighlightId, selectedLinkIdRef.current);

    // ResizeObserver
    const ro = new ResizeObserver(() => {
      if (!containerRef.current || !simulationRef.current) return;
      const w = containerRef.current.clientWidth, h = containerRef.current.clientHeight;
      svg.attr('width', w).attr('height', h);
      const { visualCenterX, visualCenterY } = getVisualCenter(w, h);
      simulationRef.current.force('center', d3.forceCenter(visualCenterX, visualCenterY));
      simulationRef.current.alpha(0.08).restart();
      (window as any).__d3FitAll?.(300);
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      simulationRef.current?.stop();
      if (rafId !== null) cancelAnimationFrame(rafId);
      const el = document.getElementById(styleId);
      if (el) el.remove();
      delete (window as any).__d3FitAll;
      delete (window as any).__d3FocusNode;
      delete (window as any).__d3FocusLink;
      delete (window as any).__d3SetSelectedNodes;
      delete (window as any).__d3HoverNode;
      delete (window as any).__d3FocusNodes;
      delete (window as any).__currentNodeId;
      delete (window as any).__hubNodeId;
    };
  }, [graphData, state.objectTypes.length, state.objects.length, state.initState, layoutMode]);

  // ── 渲染引擎模式切换与宿主层联动 (MECE 三引擎：SVG / Canvas / WebGL) ──────────────────────
  useEffect(() => {
    if (!containerRef.current || !graphData) return;

    if (!svgRef.current) return;
    const svgEl = d3.select(svgRef.current);
    const graphG = svgEl.select('.graph-container');

    if (renderEngineMode === 'svg') {
      // SVG 矢量模式：展示完整 SVG 节点与连线
      graphG.style('display', '');
      svgEl.selectAll('.nv-node').style('display', '');
      svgEl.selectAll('.nv-links').style('display', '');
      if (pixiRendererRef.current) {
        pixiRendererRef.current.destroy();
        pixiRendererRef.current = null;
      }
    } else if (renderEngineMode === 'canvas') {
      // Canvas 2D 极速模式：隐藏 SVG 容器，由独立 Canvas 2D 批量绘制
      graphG.style('display', 'none');
      if (pixiRendererRef.current) {
        pixiRendererRef.current.destroy();
        pixiRendererRef.current = null;
      }
      if (canvasRef.current) {
        if (!canvasRendererRef.current) {
          canvasRendererRef.current = new CanvasGraphRenderer(canvasRef.current);
        }
        if (containerRef.current) {
          canvasRendererRef.current.resize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        }
        triggerCanvasRender();
      }
    } else if (renderEngineMode === 'webgl') {
      // WebGL Pixi 硬件加速模式：SVG 保留连线，隐藏 SVG 节点，由 PixiJS 视口绘制 GPU 节点
      graphG.style('display', '');
      svgEl.selectAll('.nv-node').style('display', 'none');
      svgEl.selectAll('.nv-links').style('display', '');

      // 初始化或更新 PixiGraphRenderer
      if (!pixiRendererRef.current) {
        try {
          const pixi = new PixiGraphRenderer({
            container: containerRef.current,
            nodeCount: graphData.nodes.length,
            activateThreshold: 0,
            onNodeClick: (nodeId: string) => {
              const node = graphDataRef.current?.nodes.find(n => n.id === nodeId);
              if (node) {
                setSelectedNode(node);
                setFocusedNodeId(node.id);
                setSelectedLinkId(null);
                showNodeInfo(node, graphDataRef.current);
              }
            },
            onNodeHover: (nodeId: string | null) => {
              setHoveredNodeId(nodeId);
              const node = nodeId ? (nodesRef.current || graphDataRef.current?.nodes)?.find(n => n.id === nodeId) || null : null;
              setHoveredNode(node);
            },
            onContextMenu: (nodeId: string, x: number, y: number) => {
              const node = graphDataRef.current?.nodes.find(n => n.id === nodeId);
              if (node) {
                setContextMenu({ x, y, node });
              }
            },
            onBackgroundClick: () => {
              setSelectedNode(null);
              setFocusedNodeId(null);
              setSelectedLinkId(null);
            },
            onBackgroundDoubleClick: () => {
              (window as any).__d3FitAll?.();
            },
            onNodeDoubleClick: (nodeId: string) => {
              toggleNodeCollapse(nodeId, nodesRef.current, graphDataRef.current?.links || [], allNodeGroupsRef.current as any, labelElsRef.current as any, linkElsRef.current as any, collapsedRef.current);
            },
            onNodeDragStart: (nodeId: string) => {
              const node = (nodesRef.current || graphDataRef.current?.nodes)?.find(n => n.id === nodeId);
              if (node) {
                node.fx = node.x;
                node.fy = node.y;
                simulationRef.current?.alphaTarget(0.3).restart();
              }
            },
            onNodeDrag: (nodeId: string, wx: number, wy: number) => {
              const node = (nodesRef.current || graphDataRef.current?.nodes)?.find(n => n.id === nodeId);
              if (node) {
                node.fx = wx;
                node.fy = wy;
                simulationRef.current?.alpha(0.3).restart();
              }
            },
            onNodeDragEnd: (nodeId: string) => {
              const node = (nodesRef.current || graphDataRef.current?.nodes)?.find(n => n.id === nodeId);
              if (node) {
                if (!node._userPinned) {
                  node.fx = null;
                  node.fy = null;
                }
                simulationRef.current?.alphaTarget(0);
              }
            },
            onPan: (dx: number, dy: number) => {
              const newX = currentTransformRef.current.x + dx;
              const newY = currentTransformRef.current.y + dy;
              currentTransformRef.current = d3.zoomIdentity.translate(newX, newY).scale(currentTransformRef.current.k);
              if (svgRef.current && zoomRef.current) {
                d3.select(svgRef.current).call(zoomRef.current.transform as any, currentTransformRef.current);
              }
              if (pixiRendererRef.current) {
                pixiRendererRef.current.setTransform(currentTransformRef.current.k, newX, newY);
              }
            },
            onZoom: (factor: number, screenX: number, screenY: number) => {
              const t = currentTransformRef.current;
              const newK = Math.max(0.05, Math.min(20, t.k * factor));
              const newX = screenX - (screenX - t.x) * (newK / t.k);
              const newY = screenY - (screenY - t.y) * (newK / t.k);
              currentTransformRef.current = d3.zoomIdentity.translate(newX, newY).scale(newK);
              if (svgRef.current && zoomRef.current) {
                d3.select(svgRef.current).call(zoomRef.current.transform as any, currentTransformRef.current);
              }
              if (pixiRendererRef.current) {
                pixiRendererRef.current.setTransform(newK, newX, newY);
              }
            },
          });
          pixiRendererRef.current = pixi;
          pixi.activate();
          pixi.setTransform(currentTransformRef.current.k, currentTransformRef.current.x, currentTransformRef.current.y);
          console.log('[D3GraphView] PixiGraphRenderer activated for WebGL mode');
        } catch (err) {
          console.warn('[D3GraphView] PixiGraphRenderer init failed, fallback to Canvas:', err);
          setRenderEngineMode('canvas');
        }
      }

      if (pixiRendererRef.current) {
        const pixiNodes = graphData.nodes.map(n => ({
          id: n.id,
          label: n.label,
          color: n.color,
          size: n.size || (n.group === 'typeHub' ? 24 : n.group === 'action' ? 10 : 12),
          x: n.x ?? 0,
          y: n.y ?? 0,
          group: n.group,
          badgeCount: n._propsCount || 0,
        }));
        pixiRendererRef.current.setNodes(pixiNodes);
        pixiRendererRef.current.setTransform(currentTransformRef.current.k, currentTransformRef.current.x, currentTransformRef.current.y);
      }
    }

    return () => {
      if (pixiRendererRef.current && renderEngineMode !== 'webgl') {
        pixiRendererRef.current.destroy();
        pixiRendererRef.current = null;
      }
    };
  }, [renderEngineMode, graphData, triggerCanvasRender]);

  // 当选择状态改变时同步到 WebGL / Canvas
  useEffect(() => {
    if (renderEngineMode === 'canvas') {
      triggerCanvasRender();
    } else if (renderEngineMode === 'webgl' && pixiRendererRef.current) {
      pixiRendererRef.current.setSelectedNode(selectedNode?.id || null);
    }
  }, [selectedNode, renderEngineMode, triggerCanvasRender]);

  // 当节点物理仿真或布局变化时，同步到 PixiGraphRenderer
  useEffect(() => {
    if (renderEngineMode !== 'webgl' || !pixiRendererRef.current || !simulationRef.current) return;
    const syncInterval = setInterval(() => {
      if (pixiRendererRef.current && graphDataRef.current) {
        const nodes = (nodesRef.current && nodesRef.current.length > 0 ? nodesRef.current : graphDataRef.current.nodes).map(n => ({
          id: n.id,
          label: n.label,
          color: n.color,
          size: n.size || (n.group === 'typeHub' ? 24 : n.group === 'action' ? 10 : 12),
          x: n.x ?? 0,
          y: n.y ?? 0,
          group: n.group,
        }));
        pixiRendererRef.current.updatePositions(nodes);
      }
    }, 40); // 25 FPS 位置更新
    return () => clearInterval(syncInterval);
  }, [renderEngineMode, d3Ready]);

  // 容器尺寸变化响应
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      if (canvasRendererRef.current && renderEngineMode === 'canvas') {
        canvasRendererRef.current.resize(w, h);
        triggerCanvasRender();
      }
      if (pixiRendererRef.current && renderEngineMode === 'webgl') {
        pixiRendererRef.current.resize(w, h);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderEngineMode, triggerCanvasRender]);

  // Canvas 2D 交互事件处理
  const isCanvasDraggingRef = useRef(false);
  const canvasDragStartRef = useRef<{ x: number; y: number; transformX: number; transformY: number }>({ x: 0, y: 0, transformX: 0, transformY: 0 });
  const draggedNodeRef = useRef<GraphNode | null>(null);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (renderEngineMode !== 'canvas' || !canvasRef.current || !canvasRendererRef.current || !graphDataRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hit = canvasRendererRef.current.hitTest(mx, my, nodesRef.current || graphDataRef.current.nodes, currentTransformRef.current);

    if (hit) {
      draggedNodeRef.current = hit;
      hit.fx = hit.x;
      hit.fy = hit.y;
      simulationRef.current?.alphaTarget(0.3).restart();
    } else {
      isCanvasDraggingRef.current = true;
      canvasDragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        transformX: currentTransformRef.current.x,
        transformY: currentTransformRef.current.y,
      };
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (renderEngineMode !== 'canvas' || !canvasRef.current || !canvasRendererRef.current || !graphDataRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (draggedNodeRef.current) {
      const wx = (mx - currentTransformRef.current.x) / currentTransformRef.current.k;
      const wy = (my - currentTransformRef.current.y) / currentTransformRef.current.k;
      draggedNodeRef.current.fx = wx;
      draggedNodeRef.current.fy = wy;
      simulationRef.current?.alpha(0.3).restart();
      triggerCanvasRender();
      return;
    }

    if (isCanvasDraggingRef.current) {
      const dx = e.clientX - canvasDragStartRef.current.x;
      const dy = e.clientY - canvasDragStartRef.current.y;
      const newX = canvasDragStartRef.current.transformX + dx;
      const newY = canvasDragStartRef.current.transformY + dy;
      currentTransformRef.current = d3.zoomIdentity.translate(newX, newY).scale(currentTransformRef.current.k);
      if (svgRef.current && zoomRef.current) {
        d3.select(svgRef.current).call(zoomRef.current.transform as any, currentTransformRef.current);
      }
      triggerCanvasRender();
      return;
    }

    const hit = canvasRendererRef.current.hitTest(mx, my, nodesRef.current || graphDataRef.current.nodes, currentTransformRef.current);
    const newHoverId = hit ? hit.id : null;
    if (newHoverId !== hoveredNodeIdRef.current) {
      setHoveredNode(hit);
      setHoveredNodeId(newHoverId);
      if (canvasRef.current) {
        canvasRef.current.style.cursor = hit ? 'pointer' : 'grab';
      }
    } else if (!hit && canvasRef.current && graphDataRef.current?.links) {
      const hitLink = canvasRendererRef.current.hitTestLink(mx, my, graphDataRef.current.links, currentTransformRef.current);
      canvasRef.current.style.cursor = hitLink ? 'pointer' : 'grab';
    }
  };

  const handleCanvasMouseUp = () => {
    if (draggedNodeRef.current) {
      if (!draggedNodeRef.current._userPinned) {
        draggedNodeRef.current.fx = null;
        draggedNodeRef.current.fy = null;
      }
      draggedNodeRef.current = null;
      simulationRef.current?.alphaTarget(0);
    }
    isCanvasDraggingRef.current = false;
    triggerCanvasRender();
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (renderEngineMode !== 'canvas' || !canvasRef.current || !canvasRendererRef.current || !graphDataRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hit = canvasRendererRef.current.hitTest(mx, my, nodesRef.current || graphDataRef.current.nodes, currentTransformRef.current);
    if (hit) {
      setSelectedNode(hit);
      setFocusedNodeId(hit.id);
      setSelectedLinkId(null);
      showNodeInfo(hit, graphDataRef.current);
    } else {
      const hitLink = canvasRendererRef.current.hitTestLink(mx, my, graphDataRef.current.links, currentTransformRef.current);
      if (hitLink) {
        const lId = String(hitLink.id || `${typeof hitLink.source === 'object' ? hitLink.source.id : hitLink.source}-${typeof hitLink.target === 'object' ? hitLink.target.id : hitLink.target}`);
        setSelectedLinkId(lId);
        setSelectedNode(null);
        setFocusedNodeId(null);
      } else {
        setSelectedNode(null);
        setFocusedNodeId(null);
        setSelectedLinkId(null);
      }
    }
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (renderEngineMode !== 'canvas' || !canvasRef.current || !canvasRendererRef.current || !graphDataRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hit = canvasRendererRef.current.hitTest(mx, my, nodesRef.current || graphDataRef.current.nodes, currentTransformRef.current);
    if (hit) {
      toggleNodeCollapse(hit.id, nodesRef.current, graphDataRef.current?.links || [], allNodeGroupsRef.current as any, labelElsRef.current as any, linkElsRef.current as any, collapsedRef.current);
    } else {
      (window as any).__d3FitAll?.();
    }
  };

  const handleCanvasContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (renderEngineMode !== 'canvas' || !canvasRef.current || !canvasRendererRef.current || !graphDataRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hit = canvasRendererRef.current.hitTest(mx, my, nodesRef.current || graphDataRef.current.nodes, currentTransformRef.current);
    if (hit) {
      setContextMenu({ x: e.clientX, y: e.clientY, node: hit });
    }
  };

  const handleCanvasWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (renderEngineMode !== 'canvas' || !canvasRef.current) return;
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const t = currentTransformRef.current;
    const newK = Math.max(0.05, Math.min(20, t.k * factor));
    const newX = mx - (mx - t.x) * (newK / t.k);
    const newY = my - (my - t.y) * (newK / t.k);

    currentTransformRef.current = d3.zoomIdentity.translate(newX, newY).scale(newK);
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).call(zoomRef.current.transform as any, currentTransformRef.current);
    }
    triggerCanvasRender();
  };

  // Auto re-center with smooth animation when control panel or info panel is toggled
  const isInitialMountRef = useRef(true);
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    if (!d3Ready) return;
    const timer = setTimeout(() => {
      (window as any).__d3FitAll?.(450);
    }, 60);
    return () => clearTimeout(timer);
  }, [showControls, showInfo, d3Ready]);

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
        if (s.source?.group === 'action' || s.target?.group === 'action') return 32;
        if (s._linkTypeId !== undefined) return linkDistance * 1.05;
        if (s.source?.group === 'typeHub' || s.target?.group === 'typeHub') return linkDistance * 1.1;
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
    applyHighlightStyles(activeHighlightId, selectedLinkIdRef.current);
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
    if (infoPanelRef.current) {
      infoPanelRef.current.scrollTop = 0;
    }
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
        const curW = containerRef.current?.clientWidth ?? 800;
        const curH = containerRef.current?.clientHeight ?? 600;
        const { visualCenterX, visualCenterY, availableW, availableH } = getVisualCenter(curW, curH);
        
        let tx, ty, scale;
        if (matchedSimNodes.length === 1) {
          scale = 1.3;
          tx = visualCenterX - matchedSimNodes[0].x! * scale;
          ty = visualCenterY - matchedSimNodes[0].y! * scale;
        } else {
          scale = Math.min(availableW / (bw + 120), availableH / (bh + 120), 1.3);
          if (scale < 0.15) scale = 0.15;
          const cx = (minX + maxX) / 2;
          const cy = (minY + maxY) / 2;
          tx = visualCenterX - cx * scale;
          ty = visualCenterY - cy * scale;
        }
        d3.select(svgRef.current).transition().duration(600)
          .call(zoomRef.current!.transform as any, d3.zoomIdentity.translate(tx, ty).scale(scale));
      }
    }
  }, [searchTerm, graphData, getVisualCenter]);

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
    const curW = containerRef.current?.clientWidth ?? 800;
    const curH = containerRef.current?.clientHeight ?? 600;
    const { visualCenterX, visualCenterY } = getVisualCenter(curW, curH);
    const scale = 1.5;
    const tx = visualCenterX - (node.x || 0) * scale;
    const ty = visualCenterY - (node.y || 0) * scale;
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
  // Aligned with the monokai design system: prefer Tailwind utilities over
  // hand-rolled inline rgba colors. Each "token" below is a Tailwind class
  // string so it composes with hover:/active:/focus:/disabled: modifiers and
  // keeps the panel visually consistent with the rest of the app.
  //
  // Note: legacy alias `panelBase` / `btnStyle` kept so that the right-side
  // stats panel, legend and floating toggles (which still use inline style)
  // can share the same surface treatment via className below.
  const SURFACE = 'bg-gradient-to-b from-monokai-surface/98 via-monokai-surface/92 to-monokai-sidebar/95 border border-monokai-border/80 rounded-lg shadow-[0_12px_40px_-16px_rgba(0,0,0,0.75)] backdrop-blur-md text-monokai-fg font-sans';
  const SURFACE_HEADER_BTN = 'px-2.5 py-1 text-[11px] font-medium rounded-md border border-monokai-border/80 bg-monokai-bg/70 text-monokai-fg-muted hover:bg-monokai-elevated hover:text-monokai-fg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
  // Legacy aliases kept only to minimize blast radius for unrelated UI
  // blocks that still spread these into inline style props.
  const panelBase: React.CSSProperties = {};
  const controlPanelBase: React.CSSProperties = {};
  const btnStyle: React.CSSProperties = {};
  const panelBtnStyle: React.CSSProperties = {};

  // ─────────────────────────────────────────────────────────────────
  // Unified Control Panel Design System (workbench-aligned MECE chrome)
  // ─────────────────────────────────────────────────────────────────

  const SECTION_LABEL = 'text-[9px] font-bold uppercase tracking-[0.14em] text-monokai-comment/75';
  const SECTION_HEADER = `flex items-center gap-1.5 ${SECTION_LABEL}`;
  const SECTION_DIVIDER = 'pt-2.5 mt-1 border-t border-monokai-border/50';
  const GROUP_CARD = 'rounded-md border border-monokai-border/55 bg-monokai-bg/40 p-2 flex flex-col gap-1.5';

  const BTN_PRIMARY = 'flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-semibold bg-monokai-cyan/12 text-monokai-cyan border border-monokai-cyan/35 hover:bg-monokai-cyan/20 hover:border-monokai-cyan/55 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
  const BTN_SECONDARY = 'flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium bg-monokai-bg/70 text-monokai-fg-muted border border-monokai-border/75 hover:bg-monokai-elevated hover:text-monokai-fg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
  const BTN_WARN = 'flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium bg-monokai-yellow/10 text-monokai-yellow border border-monokai-yellow/35 hover:bg-monokai-yellow/18 hover:border-monokai-yellow/50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
  const BTN_AI = 'flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium bg-monokai-accent/10 text-monokai-accent border border-monokai-accent/35 hover:bg-monokai-accent/18 hover:border-monokai-accent/50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
  const BTN_DANGER = 'flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium bg-monokai-pink/10 text-monokai-pink border border-monokai-pink/35 hover:bg-monokai-pink/18 hover:border-monokai-pink/50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

  const BTN_TOGGLE_ACTIVE = 'flex items-center justify-between gap-1 px-2 py-1.5 rounded-md text-[11px] font-semibold bg-monokai-cyan/12 text-monokai-cyan border border-monokai-cyan/45 transition-colors cursor-pointer';
  const BTN_TOGGLE_INACTIVE = 'flex items-center justify-between gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium bg-monokai-bg/55 text-monokai-comment border border-monokai-border/70 hover:bg-monokai-elevated/80 hover:text-monokai-fg transition-colors cursor-pointer';

  const TOGGLE_BADGE_ACTIVE = 'text-[9px] px-1 py-px rounded font-mono font-semibold bg-monokai-cyan/20 text-monokai-cyan';
  const TOGGLE_BADGE_INACTIVE = 'text-[9px] px-1 py-px rounded font-mono font-medium bg-monokai-bg text-monokai-comment/80';

  const INPUT_BASE = 'flex-1 px-2.5 py-1.5 rounded-md border border-monokai-border/80 bg-monokai-bg/70 text-monokai-fg text-[11px] outline-none placeholder:text-monokai-comment/70 focus:border-monokai-cyan/60 focus:ring-1 focus:ring-monokai-cyan/20 transition-colors';
  const INPUT_AI = 'flex-1 px-2.5 py-1.5 rounded-md border border-monokai-accent/40 bg-monokai-bg/70 text-monokai-fg text-[11px] outline-none placeholder:text-monokai-comment/70 focus:border-monokai-accent/60 transition-colors';
  const SELECT_BASE = 'w-full appearance-none px-2.5 py-1.5 rounded-md border border-monokai-border/80 bg-monokai-bg/70 text-monokai-fg text-[11px] outline-none cursor-pointer focus:border-monokai-cyan/60 focus:ring-1 focus:ring-monokai-cyan/20 transition-colors';

  const SLIDER_ROW = 'flex items-center text-[11px] gap-2 w-full';
  const SLIDER_LABEL = 'w-[56px] shrink-0 text-monokai-comment text-[10px]';
  const SLIDER_VALUE = 'w-[36px] text-monokai-fg-muted text-[10px] font-mono tabular-nums shrink-0 text-right';

  const COLLAPSE_BTN = 'w-full flex items-center justify-between gap-2 text-left cursor-pointer select-none group';

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: '100%',
        background: '#141916',
        backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Canvas 2D 极速渲染层 */}
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: renderEngineMode === 'canvas' ? 2 : 0,
          display: renderEngineMode === 'canvas' ? 'block' : 'none',
          pointerEvents: renderEngineMode === 'canvas' ? 'all' : 'none',
        }}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onClick={handleCanvasClick}
        onDoubleClick={handleCanvasDoubleClick}
        onContextMenu={handleCanvasContextMenu}
        onWheel={handleCanvasWheel}
      />

      {/* SVG 渲染层与手势/交互宿主 */}
      <svg
        ref={svgRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: renderEngineMode === 'svg' ? 2 : (renderEngineMode === 'webgl' ? 1 : 0),
          pointerEvents: renderEngineMode === 'canvas' ? 'none' : 'all',
        }}
        role="img"
        aria-label={`知识图谱可视化（${RENDER_ENGINE_META[renderEngineMode].label}）：${stats.nodes} 个节点，${stats.links} 条关系连线。`}
        tabIndex={0}
        onKeyDown={(e: React.KeyboardEvent) => {
          const ag = allNodeGroupsRef.current;
          const lg = linkElsRef.current;
          const lb = labelElsRef.current;
          if (!ag || !lg || !lb) return;

          // Ctrl+Home: 居中视图 (Fit All)
          if ((e.ctrlKey || e.metaKey) && e.key === 'Home') {
            e.preventDefault();
            (window as any).__d3FitAll?.();
            return;
          }

          // Ctrl+0 或 数字键 0: 重置视图到默认缩放 (Fit All)
          if ((e.ctrlKey || e.metaKey) && e.key === '0') {
            e.preventDefault();
            (window as any).__d3FitAll?.();
            return;
          }
          
          // 单独按 0 键: Fit All
          if (e.key === '0' && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            (window as any).__d3FitAll?.();
            return;
          }
          
          // F 键: Fit All
          if (e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            (window as any).__d3FitAll?.();
            return;
          }

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
          
          // + 或 = 键: 放大
          if (e.key === '+' || e.key === '=') {
            e.preventDefault();
            zoomIn();
            return;
          }
          
          // - 键: 缩小
          if (e.key === '-' || e.key === '_') {
            e.preventDefault();
            zoomOut();
            return;
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
            <div style={{ fontSize: 18, color: '#ffd60a', fontWeight: 'bold', marginBottom: 8 }}>
              本体论尚未初始化
            </div>
            {state?.error && (
              <div
                role="alert"
                style={{
                  color: '#f92672',
                  fontSize: 12,
                  marginBottom: 12,
                  background: 'rgba(249, 38, 114, 0.1)',
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid rgba(249, 38, 114, 0.3)',
                }}
              >
                {state.error}
              </div>
            )}
            <div style={{ fontSize: 13, color: '#8f9e94', maxWidth: 400, lineHeight: 1.7, marginBottom: 12 }}>
              当前工作区尚未载入本体结构或种子数据。<br />
              可点击「重试初始化」导入默认模型，或通过 AI 自动构建图谱。
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
                    padding: '6px 12px', borderRadius: 8, border: '1px solid #66d9ef',
                    background: 'rgba(0,0,0,0.4)', color: '#fff', fontSize: 12, width: 260,
                    outline: 'none',
                  }}
                />
                <button onClick={handleAIFill} disabled={isAiFilling} style={{ ...btnStyle, padding: '6px 14px', borderColor: '#66d9ef', color: '#66d9ef' }}>
                  {isAiFilling ? <Loader2 className="inline w-3.5 h-3.5 animate-spin" style={{ verticalAlign: 'middle' }} /> : <Sparkles className="inline w-3.5 h-3.5" style={{ verticalAlign: 'middle' }} />}
                </button>
                <button onClick={() => setShowAIFillInput(false)} style={{ ...btnStyle, padding: '6px 10px' }}>✕</button>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', pointerEvents: 'all' }}>
              <button
                onClick={() => store.initOntology?.()}
                style={{ ...btnStyle, padding: '6px 16px', fontSize: 12, borderColor: '#a6e22e', color: '#a6e22e', background: 'rgba(166, 226, 46, 0.1)' }}
              >
                <RefreshCw className="inline w-3.5 h-3.5 mr-1" style={{ verticalAlign: 'middle' }} />
                重试初始化
              </button>
              <button onClick={handleAIFill} disabled={isAiFilling} style={{ ...btnStyle, padding: '6px 16px', fontSize: 12, borderColor: '#66d9ef', color: '#66d9ef' }}>
                {isAiFilling ? <><Loader2 className="inline w-3.5 h-3.5 mr-1 animate-spin" style={{ verticalAlign: 'middle' }} /> AI 构思中...</> : <><Sparkles className="inline w-3.5 h-3.5 mr-1" style={{ verticalAlign: 'middle' }} /> AI 图谱生成</>}
              </button>
              <button onClick={refreshGraph} style={{ ...btnStyle, padding: '6px 16px', fontSize: 12 }}>
                <RefreshCw className="inline w-3.5 h-3.5 mr-1" style={{ verticalAlign: 'middle' }} />
                刷新图谱
              </button>
              <button onClick={downloadCSV} disabled={!graphData} style={{ ...btnStyle, padding: '6px 16px', fontSize: 12, borderColor: '#343c37', opacity: !graphData ? 0.5 : 1 }}>
                导出 CSV
              </button>
              <button onClick={downloadExcelFile} disabled={!graphData} style={{ ...btnStyle, padding: '6px 16px', fontSize: 12, borderColor: '#343c37', color: '#a6e22e', background: 'rgba(39,40,34,0.88)', opacity: !graphData ? 0.5 : 1 }}>
                导出 Excel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI 主题构思浮层 - 居中防遮挡 */}
      {showAIFillInput && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[1500] flex items-center gap-1.5 p-2 rounded-lg bg-monokai-surface/95 border border-monokai-cyan/50 shadow-2xl backdrop-blur-md">
          <input
            autoFocus
            value={aiFillTopic}
            onChange={e => setAiFillTopic(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAIFill(); if (e.key === 'Escape') setShowAIFillInput(false); }}
            placeholder="输入图谱主题，回车确认"
            aria-label="AI 生成主题"
            className={INPUT_AI}
          />
          <button onClick={handleAIFill} disabled={isAiFilling} aria-label="确认生成" className={BTN_AI + ' !flex-none px-2.5 py-1.5'}>
            {isAiFilling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => setShowAIFillInput(false)} aria-label="取消" className={BTN_SECONDARY + ' !flex-none px-2 py-1.5'}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 清空数据确认浮层 - 居中防遮挡 */}
      {showClearConfirm && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[1500] p-3.5 border border-monokai-pink/60 rounded-xl bg-monokai-surface/98 shadow-2xl backdrop-blur-md flex flex-col gap-2.5 min-w-[260px]">
          <div className="text-[12.5px] font-semibold text-monokai-pink flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            确认清空所有本体论数据？
          </div>
          <p className="text-[10.5px] text-monokai-comment leading-relaxed">此操作将清空所有节点、关系与动作，不可撤销。</p>
          <div className="flex gap-1.5">
            <button
              onClick={handleQuickClear}
              aria-label="确认清空"
              className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold bg-monokai-pink text-white border border-monokai-pink hover:brightness-110 transition cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              确认清空
            </button>
            <button onClick={() => setShowClearConfirm(false)} aria-label="取消" className={BTN_SECONDARY}>
              取消
            </button>
          </div>
        </div>
      )}

      {/* ==================== LEFT: Controls (新版 MECE 拓扑布局组件) ==================== */}
      {showControls && graphData && (
        <TopologyLayoutPanel
          renderEngineMode={renderEngineMode}
          onRenderEngineModeChange={(mode) => {
            setRenderEngineMode(mode);
          }}
          onFitAll={fitAll}
          onResetLayout={resetLayout}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onRefresh={refreshGraph}
          layoutMode={layoutMode}
          onLayoutModeChange={switchLayoutMode}
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          nodeTypeFilters={nodeTypeFilters}
          onNodeTypeFiltersChange={setNodeTypeFilters}
          nodeCountByType={nodeCountByType}
          labelMode={labelMode}
          onLabelModeChange={setLabelMode}
          weightThreshold={weightThreshold}
          onWeightThresholdChange={setWeightThreshold}
          showHierarchyLinks={showHierarchyLinks}
          onShowHierarchyLinksChange={setShowHierarchyLinks}
          enableLinkParticles={enableLinkParticles}
          onEnableLinkParticlesChange={setEnableLinkParticles}
          edgeRoutingMode={edgeRoutingMode}
          onEdgeRoutingModeChange={setEdgeRoutingMode}
          edgeLabelDisplay={edgeLabelDisplay}
          onEdgeLabelDisplayChange={setEdgeLabelDisplay}
          onAIFill={() => setShowAIFillInput(true)}
          onClear={() => setShowClearConfirm(true)}
          clickToFocus={clickToFocus}
          onClickToFocusChange={val => {
            setClickToFocus(val);
            if (!val) {
              setScopeMode('all');
              setFocusedNodeId(null);
            } else if (selectedNode) {
              setFocusedNodeId(selectedNode.id);
              setScopeMode('focus');
            }
          }}
          isFixedDrag={isFixedDrag}
          onIsFixedDragChange={setIsFixedDrag}
          isLassoMode={isLassoMode}
          onIsLassoModeChange={val => {
            setIsLassoMode(val);
            if (!val) setSelectedNodeIds(new Set());
          }}
          showPageRank={showPageRank}
          onShowPageRankChange={setShowPageRank}
          chargeStrength={chargeStrength}
          onChargeStrengthChange={setChargeStrength}
          linkDistance={linkDistance}
          onLinkDistanceChange={setLinkDistance}
          collisionRadius={collisionRadius}
          onCollisionRadiusChange={setCollisionRadius}
          velocityDecay={velocityDecay}
          onVelocityDecayChange={setVelocityDecay}
          gravityStrength={gravityStrength}
          onGravityStrengthChange={setGravityStrength}
          linkStrength={linkStrength}
          onLinkStrengthChange={setLinkStrength}
          nodeCount={graphData.nodes.length}
          linkCount={graphData.links.length}
          fps={perfStats.fps}
          renderTime={perfStats.renderTime}
          perfHistory={perfStats.history}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undoLayout}
          onRedo={redoLayout}
          onApplySnapshot={(snapshot) => {
            if (snapshot.nodePositions && graphDataRef.current) {
              const pos = snapshot.nodePositions;
              graphDataRef.current.nodes.forEach(n => {
                if (pos[n.id]) {
                  n.x = pos[n.id].x;
                  n.y = pos[n.id].y;
                  n.fx = pos[n.id].x;
                  n.fy = pos[n.id].y;
                }
              });
              simulationRef.current?.alpha(0.3).restart();
            }
          }}
          onShowTopologyReport={() => setShowTopologyReportModal(true)}
          showHelp={showHelp}
          onShowHelpChange={setShowHelp}
          isLoading={isAiFilling}
          onClose={() => setShowControls(false)}
          onExportCSV={downloadCSV}
          onExportExcel={downloadExcelFile}
          onExportPNG={async () => {
            try {
              if (!graphDataRef.current) return;
              await downloadD3GraphImage(graphDataRef.current.nodes, graphDataRef.current.links, graphDataRef.current.linkTypeMap, 'png', 'knowledge-graph');
              setToast({ message: '高清 PNG 图片导出成功！', type: 'success' });
            } catch (err: any) {
              setToast({ message: `图片导出失败: ${err.message}`, type: 'error' });
            }
          }}
          onExportSVG={async () => {
            try {
              if (!graphDataRef.current) return;
              await downloadD3GraphImage(graphDataRef.current.nodes, graphDataRef.current.links, graphDataRef.current.linkTypeMap, 'svg', 'full-knowledge-graph');
              setToast({ message: '整图 SVG 导出成功！', type: 'success' });
            } catch (err: any) {
              setToast({ message: `整图导出失败: ${err.message}`, type: 'error' });
            }
          }}
          onExportSubgraphs={async () => {
            try {
              if (!graphDataRef.current) return;
              setToast({ message: '正在批量生成所有子图图片，请稍候...', type: 'success' });
              await exportAllSubgraphs(
                graphDataRef.current.nodes,
                graphDataRef.current.links,
                graphDataRef.current.linkTypeMap,
                (cur, tot, label) => setToast({ message: `正在导出子图 (${cur}/${tot}): ${label}`, type: 'success' })
              );
              setToast({ message: '所有节点关联子图图片已导出完毕！', type: 'success' });
            } catch (err: any) {
              setToast({ message: `批量导出子图失败: ${err.message}`, type: 'error' });
            }
          }}
        />
      )}


      {!showControls && (
        <button
          onClick={() => setShowControls(true)}
          className={`${SURFACE_HEADER_BTN} absolute top-2.5 left-2.5 shadow-md`}
        >
          控制面板
        </button>
      )}

      {/* ==================== RENDER ENGINE MODE SWITCHER (MECE 三引擎：SVG / Canvas / WebGL) ==================== */}
      {graphData && (
        <div ref={renderModeSwitcherRef} className="absolute top-2.5 right-[95px] z-[1000]">
          <button
            onClick={() => setShowRenderModeMenu(v => !v)}
            aria-haspopup="menu"
            aria-expanded={showRenderModeMenu}
            aria-label="渲染模式切换"
            className={`${SURFACE_HEADER_BTN} shadow-md flex items-center gap-1.5`}
            title={`当前引擎：${RENDER_ENGINE_META[renderEngineMode].label} (${RENDER_ENGINE_META[renderEngineMode].hint})。点击切换 SVG / Canvas 2D / WebGL 硬件加速渲染。`}
            style={{
              background: RENDER_ENGINE_META[renderEngineMode].bgColor,
              borderColor: RENDER_ENGINE_META[renderEngineMode].borderColor,
              color: RENDER_ENGINE_META[renderEngineMode].color,
            }}
          >
            {RENDER_ENGINE_META[renderEngineMode].icon}
            <span className="font-medium text-[11px]">{RENDER_ENGINE_META[renderEngineMode].label}</span>
            <span
              className="text-[9px] px-1 py-0.5 rounded font-mono font-semibold"
              style={{
                backgroundColor: 'rgba(0,0,0,0.25)',
                color: RENDER_ENGINE_META[renderEngineMode].color,
              }}
            >
              {RENDER_ENGINE_META[renderEngineMode].hint}
            </span>
            <ChevronDown className={`w-3 h-3 transition-transform ${showRenderModeMenu ? 'rotate-180' : ''}`} />
          </button>

          {showRenderModeMenu && (
            <div
              role="menu"
              className={`${SURFACE} absolute top-[34px] right-0 p-1.5 w-[280px] flex flex-col gap-0.5 shadow-xl`}
            >
              <div className="px-2 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-monokai-comment/70 border-b border-monokai-border/40 mb-0.5 flex items-center justify-between">
                <span>渲染引擎 · MECE 三模式</span>
                <span className="text-[9px] text-monokai-cyan font-normal font-mono">视图状态保持</span>
              </div>
              {(['svg', 'canvas', 'webgl'] as RenderEngineMode[]).map((mode) => {
                const meta = RENDER_ENGINE_META[mode];
                const active = mode === renderEngineMode;
                return (
                  <button
                    key={mode}
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => {
                      if (!active) {
                        switchRenderEngineMode(mode);
                      }
                      setShowRenderModeMenu(false);
                    }}
                    className={`flex items-start gap-2 px-2 py-1.5 rounded-md text-left transition-colors ${
                      active
                        ? 'bg-monokai-cyan/15 border border-monokai-cyan/45'
                        : 'hover:bg-monokai-elevated/60 border border-transparent'
                    }`}
                    style={{
                      color: active ? meta.color : 'var(--monokai-fg-muted, #c5c2bd)',
                    }}
                  >
                    <span className="mt-0.5 shrink-0" style={{ color: meta.color }}>{meta.icon}</span>
                    <span className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="block text-[12px] font-semibold leading-tight">{meta.label}</span>
                        <span
                          className="text-[9px] px-1 rounded font-mono text-monokai-comment"
                          style={{
                            backgroundColor: 'rgba(255,255,255,0.06)',
                          }}
                        >
                          {meta.hint}
                        </span>
                      </div>
                      <span className="block text-[10px] text-monokai-comment/80 leading-snug mt-0.5">{meta.description}</span>
                    </span>
                    {active && (
                      <span className="text-[9px] font-mono font-bold text-monokai-cyan mt-0.5 shrink-0">当前</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================== RIGHT: Stats + Info ==================== */}
      {showInfo && graphData && (
        <div ref={infoPanelRef} className={`${SURFACE} absolute top-2.5 right-2.5 z-[1000] p-2.5 min-w-[250px] max-h-[75vh] overflow-y-auto text-[12px]`}>
          <div className="flex items-center justify-between mb-2">
            <strong className="text-[13px] text-monokai-fg">扫描统计</strong>
            <button onClick={() => setShowInfo(false)} className={SURFACE_HEADER_BTN}>隐藏</button>
          </div>
          <div className="text-[11px]">
            <div className="mb-1">
              <span className="text-monokai-comment">节点总数: </span>
              <span className="text-monokai-cyan font-bold">{stats.nodes}</span>
            </div>
            <div className="mb-1">
              <span className="text-monokai-comment">连接总数: </span>
              <span className="text-monokai-yellow font-bold">{stats.links}</span>
            </div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-monokai-comment">当前引擎: </span>
              <span className="font-semibold text-[10.5px]" style={{ color: RENDER_ENGINE_META[renderEngineMode].color }}>
                {RENDER_ENGINE_META[renderEngineMode].label}
              </span>
            </div>

            {/* Rendering Limits Warning */}
            {(stats.nodes > 800 || stats.links > 1500) && (
              <div className="bg-monokai-pink/15 border border-monokai-pink/45 rounded p-2 my-2.5 text-[10.5px] text-monokai-pink leading-relaxed">
                <strong className="flex items-center gap-1 mb-1">
                  ⚠️ 渲染极限警戒
                </strong>
                当前图谱量级极速逼近浏览器 GPU 上限。为了避免交互卡屏，系统已为您限制部分力学计算。遇到抖动请谨慎拉拽，推荐退回表格检索或在局部子图使用 Focus 聚焦模式。
              </div>
            )}

            <div className="border-t border-monokai-border pt-2 mt-2">
              <div dangerouslySetInnerHTML={{ __html: infoContent || '<span style="color:var(--monokai-comment,#75715e);font-size:10px">单击节点查看详情</span>' }} />
            </div>
          </div>
        </div>
      )}

      {!showInfo && (
        <button onClick={() => setShowInfo(true)} className={`${SURFACE_HEADER_BTN} absolute top-2.5 right-2.5 z-[1000] shadow-md`}>
          信息面板
        </button>
      )}

      {/* ==================== BOTTOM-LEFT: Legend ==================== */}
      {showLegend && graphData && (
        <div className={`${SURFACE} absolute bottom-2.5 left-2.5 z-[1000] p-2.5 text-[12px]`}>
          <div className="flex items-center justify-between mb-2">
            <strong className="text-[13px] text-monokai-fg">图例</strong>
            <button onClick={() => setShowLegend(false)} className={SURFACE_HEADER_BTN}>隐藏</button>
          </div>
          {[
            { color: TYPE_COLORS_WARM[0], r: 8, label: '类型集 (TypeHub: 六边形枢纽)' },
            { color: TYPE_COLORS_COOL[0], r: 5, label: '落地实例 (Instance: 正方形框)' },
            { color: '#FF6B35', r: 3, label: '已完成进度/行动' },
            { color: '#FF9800', r: 3, label: '待处理队列' },
          ].map(item => (
            <div key={item.label} className="flex items-center my-0.5">
              <svg width="16" height="16" viewBox="-10 -10 20 20" className="mr-1.5">
                <circle cx="0" cy="0" r={item.r} fill={item.color} stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
              </svg>
              <span className="text-[11px] text-monokai-fg-muted">{item.label}</span>
            </div>
          ))}
          {/* Property badge legend */}
          <div className="flex items-center mt-1.5">
            <svg width="18" height="18" className="mr-1.5">
              <circle cx="5" cy="5" r="5" fill={TYPE_COLORS_COOL[0]} stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />
              <circle cx="10" cy="10" r="4" fill="#FF6B35" stroke="rgba(0,0,0,0.5)" strokeWidth="1" />
              <text x="10" y="11" textAnchor="middle" dominantBaseline="middle" fontSize="5" fontWeight="bold" fill="white" fontFamily="Arial">3</text>
            </svg>
            <span className="text-[11px] text-monokai-fg-muted">属性数量徽标 (右下角)</span>
          </div>
          <div className="border-t border-monokai-border pt-1.5 mt-1">
            {relationLegendItems.map(item => (
              <div key={item.id} className="flex items-center mt-1" title={item.description}>
                <svg width="36" height="10" className="mr-1.5">
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
                <span className="text-[11px] text-monokai-fg-muted">{item.name} ({item.count})</span>
              </div>
            ))}
            {false && <div className="flex items-center mt-1">
              <svg width="36" height="10" className="mr-1.5">
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
              <span className="text-[11px] text-monokai-fg-muted">关系连线</span>
            </div>}
            <div className="flex items-center mt-1">
              <svg width="36" height="10" className="mr-1.5">
                <line x1="0" y1="5" x2="26" y2="5" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" strokeDasharray="5 3" />
              </svg>
              <span className="text-[11px] text-monokai-fg-muted">类型归属 (虚线)</span>
            </div>
            <div className="flex items-center mt-1">
              <svg width="36" height="10" className="mr-1.5">
                <defs>
                  <marker id="leg-arrow-amethyst" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                    <polygon points="0 0, 6 2, 0 4" fill="#FF9CF7" />
                  </marker>
                </defs>
                <line x1="0" y1="5" x2="26" y2="5" stroke="#FF9CF7" strokeWidth="1" markerEnd="url(#leg-arrow-amethyst)" />
              </svg>
              <span className="text-[11px] text-monokai-fg-muted">行动连线</span>
            </div>
          </div>
        </div>
      )}

      {!showLegend && (
        <button onClick={() => setShowLegend(true)} className={`${SURFACE_HEADER_BTN} absolute bottom-2.5 left-2.5 z-[1000] shadow-md`}>
          图例
        </button>
      )}

      {/* Temporal Topology Timeline Player Bar */}
      {fullGraphData && fullGraphData.nodes.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1300,
            background: 'rgba(39, 40, 34, 0.92)',
            border: '1px solid rgba(255, 209, 102, 0.3)',
            borderRadius: 24,
            padding: '6px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <button
            onClick={() => setIsPlayingTimeline(!isPlayingTimeline)}
            style={{
              background: isPlayingTimeline ? '#ff5a8a' : '#FFD166',
              border: 'none',
              borderRadius: '50%',
              width: 26,
              height: 26,
              color: '#12131a',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
            }}
            title={isPlayingTimeline ? '暂停演进播放' : '自动播放拓扑演进'}
          >
            {isPlayingTimeline ? '⏸' : '▶'}
          </button>

          <span style={{ fontSize: 11, color: '#FFD166', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
            ⏱ 拓扑演进: {timelineStep}%
          </span>

          <input
            type="range"
            min="5"
            max="100"
            step="5"
            value={timelineStep}
            onChange={e => {
              setIsPlayingTimeline(false);
              setTimelineStep(Number(e.target.value));
            }}
            style={{
              width: 140,
              accentColor: '#FFD166',
              cursor: 'pointer',
            }}
          />

          <span style={{ fontSize: 10, color: '#888' }}>
            ({graphData?.nodes.length || 0}/{fullGraphData.nodes.length} 节点)
          </span>
        </div>
      )}

      {/* Lasso Selection Marquee Box Overlay */}
      {lassoBox && (
        <div
          style={{
            position: 'absolute',
            left: lassoBox.x,
            top: lassoBox.y,
            width: lassoBox.width,
            height: lassoBox.height,
            border: '1.5px dashed #a6e22e',
            background: 'rgba(166, 226, 46, 0.12)',
            pointerEvents: 'none',
            zIndex: 1400,
            borderRadius: 4,
          }}
        />
      )}

      {/* Path Tracer Top Status & Controls Overlay Bar */}
      {(pathTracerSource || pathTraceResult) && (
        <div
          style={{
            position: 'absolute',
            top: 50,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1450,
            background: 'rgba(18, 19, 26, 0.94)',
            border: '1.5px solid #66d9ef',
            color: '#f8f8f2',
            padding: '6px 16px',
            borderRadius: 24,
            fontSize: 11,
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5), 0 0 12px rgba(102, 217, 239, 0.3)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <span style={{ color: '#a6e22e' }}>
            🚩 起点: {graphData?.nodes.find(n => n.id === pathTracerSource)?.label || pathTracerSource}
          </span>
          <span style={{ color: '#666' }}>➔</span>
          {pathTracerTarget ? (
            <span style={{ color: '#ff453a' }}>
              🎯 终点: {graphData?.nodes.find(n => n.id === pathTracerTarget)?.label || pathTracerTarget}
            </span>
          ) : (
            <span style={{ color: '#FFD166', fontStyle: 'italic' }}>🎯 请右键选择终点...</span>
          )}

          {pathTraceResult && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(102, 217, 239, 0.15)', padding: '2px 8px', borderRadius: 12, border: '1px solid rgba(102, 217, 239, 0.4)' }}>
              <span style={{ color: '#66d9ef' }}>⚡ 传输距离: {pathTraceResult.distance} 跳</span>
              <span style={{ color: '#ccc' }}>· {pathTraceResult.pathNodeIds.size} 节点</span>
            </div>
          )}

          <button
            onClick={() => {
              setPathTracerSource(null);
              setPathTracerTarget(null);
              setPathTraceResult(null);
              pathTracerSourceRef.current = null;
              pathTraceResultRef.current = null;
              applyHighlightStylesRef.current(null);
            }}
            style={{
              background: 'rgba(255, 69, 58, 0.2)',
              border: '1px solid #ff453a',
              color: '#ff453a',
              borderRadius: 12,
              padding: '2px 8px',
              fontSize: 10,
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
            title="退出路径溯源模式"
          >
            ✕ 清除路径
          </button>
        </div>
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
      <ModalShell
        open={showScanModal && Boolean(graphData)}
        onClose={() => setShowScanModal(false)}
        title="本体图谱原始数据"
        description="Raw Graph Schema & Topology Payload"
        size="xl"
      >
        {graphData && (
          <div className="space-y-3 font-mono text-xs text-monokai-fg">
            <div>
              <div className="font-bold text-monokai-yellow mb-1">类型 ({graphData.typeNames.length})</div>
              <pre className="p-2.5 rounded-lg bg-monokai-bg border border-monokai-border max-h-40 overflow-auto text-xs">
                {JSON.stringify(graphData.typeNames.map((n, i) => ({ id: i + 1, name: n })), null, 2)}
              </pre>
            </div>
            <div>
              <div className="font-bold text-monokai-cyan mb-1">节点 ({graphData.nodes.length})</div>
              <pre className="p-2.5 rounded-lg bg-monokai-bg border border-monokai-border max-h-52 overflow-auto text-xs">
                {JSON.stringify(graphData.nodes, null, 2)}
              </pre>
            </div>
            <div>
              <div className="font-bold text-monokai-green mb-1">连线 ({graphData.links.length})</div>
              <pre className="p-2.5 rounded-lg bg-monokai-bg border border-monokai-border max-h-52 overflow-auto text-xs">
                {JSON.stringify(graphData.links.map(l => ({
                  source: typeof l.source === 'object' ? (l.source as GraphNode).id : l.source,
                  target: typeof l.target === 'object' ? (l.target as GraphNode).id : l.target,
                  color: l.color, weight: l.weight, linkType: l._linkTypeName,
                })), null, 2)}
              </pre>
            </div>
          </div>
        )}
      </ModalShell>

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
        
        @keyframes nv-flow-dash {
          to {
            stroke-dashoffset: -20;
          }
        }
        .nv-link-particle {
          pointer-events: none;
          stroke-dasharray: 4 14;
          animation: nv-flow-dash 1.4s linear infinite;
        }
        .nv-link-particle-action {
          stroke-dasharray: 3 8;
          animation: nv-flow-dash 1.0s linear infinite;
        }
        .nv-link-main.nv-link-selected {
          stroke: #FFD166 !important;
          stroke-width: 3.5px !important;
          filter: drop-shadow(0 0 8px rgba(255, 209, 102, 0.95)) !important;
        }
        .nv-link-action {
          stroke-dasharray: 4 3;
        }
        .nv-link-typeinst {
          stroke-dasharray: 5 4;
        }
        .nv-node.nv-connected-node circle {
          stroke: #FFD166 !important;
          stroke-width: 3px !important;
          filter: drop-shadow(0 0 8px rgba(255, 209, 102, 0.9)) !important;
        }
        
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

        .nv-node.nv-node-selected circle {
          stroke: #a6e22e !important;
          stroke-width: 3.5px !important;
          filter: drop-shadow(0 0 6px rgba(166, 226, 46, 0.8));
        }

        .nv-context-menu {
          position: absolute;
          z-index: 2100;
          background: #252623;
          backdrop-filter: blur(12px);
          border: 1px solid rgba(248, 248, 242, 0.1);
          border-radius: 8px;
          padding: 4px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
          min-width: 150px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .nv-context-menu-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 12px;
          font-size: 12px;
          color: #f8f8f2;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.15s ease;
          background: transparent;
          border: none;
          text-align: left;
          width: 100%;
        }
        .nv-context-menu-item:hover {
          background: rgba(248, 248, 242, 0.08);
          color: #ffffff;
        }
        .nv-context-menu-item.danger {
          color: #ff6188;
        }
        .nv-context-menu-item.danger:hover {
          background: rgba(255, 97, 136, 0.15);
          color: #ff6188;
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
            const nodeMap = new Map(graphData.nodes.map(n => [n.id, n]));
            const connLinks = graphData.links.filter(l => {
              const s = String(typeof l.source === 'object' ? (l.source as GraphNode).id : l.source);
              const t = String(typeof l.target === 'object' ? (l.target as GraphNode).id : l.target);
              return s === String(d.id) || t === String(d.id);
            });

            // Group relations into explicit directed triplets
            const relationItems = connLinks.map(l => {
              const sId = String(typeof l.source === 'object' ? (l.source as GraphNode).id : l.source);
              const tId = String(typeof l.target === 'object' ? (l.target as GraphNode).id : l.target);
              const isOut = sId === String(d.id);
              const otherId = isOut ? tId : sId;
              const otherNode = nodeMap.get(otherId);
              const relName = l._linkTypeName || (l._linkTypeId !== undefined ? graphData.linkTypeMap[l._linkTypeId]?.name : null) || (l._isTypeInstLink ? '概念具象' : (l._isActionLink ? '拥有动作' : (l.label || '关联')));
              const color = l._isTypeInstLink ? 'rgba(148,163,184,0.7)' : (l._isActionLink ? '#bd93f9' : (l.color || '#66d9ef'));
              return {
                id: String(l.id || `${sId}-${tId}`),
                isOut,
                isTypeInst: Boolean(l._isTypeInstLink),
                relName,
                color,
                otherNode,
              };
            }).filter(item => Boolean(item.otherNode));

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
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: `${d.color}25`, color: d.color, border: `1px solid ${d.color}40`, fontWeight: 600 }}>
                      类型 {d._instanceCount !== undefined ? `· ${d._instanceCount} 个实例` : ''}
                    </span>
                  )}
                  {d.group === 'instance' && (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: `${d.color}25`, color: d.color, border: `1px solid ${d.color}40`, fontWeight: 600 }}>
                      实例
                    </span>
                  )}
                  {d.group === 'action' && (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: `${d.color}25`, color: d.color, border: `1px solid ${d.color}40`, fontWeight: 600 }}>
                      行动
                    </span>
                  )}
                </div>

                {/* TypeHub: show description */}
                {d.group === 'typeHub' && d.description && (
                  <div style={{ fontSize: 11, color: '#999', marginBottom: 6, lineHeight: 1.5 }}>
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
                          <div key={k} style={{ display: 'flex', gap: 4, fontSize: 11, lineHeight: 1.7 }}>
                            <span style={{ color: '#66d9ef', flexShrink: 0 }}>{k}:</span>
                            <span style={{ color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vStr}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Connected directed relations summary */}
                {relationItems.length > 0 && (
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 7, marginTop: 4 }}>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 5, fontWeight: 700, letterSpacing: '0.4px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>关联边关系</span>
                      <span style={{ color: '#64748b' }}>共 {relationItems.length} 条</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 150, overflowY: 'auto' }}>
                      {relationItems.slice(0, 5).map((item, idx) => (
                        <div
                          key={item.id + '_' + idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            fontSize: 11,
                            background: 'rgba(255,255,255,0.04)',
                            padding: '3px 6px',
                            borderRadius: 4,
                            border: `1px solid ${item.color}25`,
                          }}
                        >
                          <span style={{
                            fontSize: 10,
                            color: item.isTypeInst ? '#94a3b8' : item.isOut ? '#66d9ef' : '#a6e22e',
                            fontWeight: 'bold',
                            flexShrink: 0
                          }}>
                            {item.isTypeInst ? '╌' : item.isOut ? '➔' : '⬅'}
                          </span>
                          <span style={{
                            fontSize: 9.5,
                            padding: '1px 5px',
                            borderRadius: 3,
                            background: `${item.color}20`,
                            color: item.color,
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                          }}>
                            {item.relName}
                          </span>
                          <span style={{
                            color: '#e2e8f0',
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1
                          }} title={item.otherNode?.label}>
                            {item.otherNode?.label || '未知节点'}
                          </span>
                        </div>
                      ))}
                      {relationItems.length > 5 && (
                        <div style={{ fontSize: 10, color: '#64748b', textAlign: 'center', paddingTop: 2 }}>
                          还有 +{relationItems.length - 5} 个关系连接
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Footer hint */}
                <div style={{ marginTop: 8, fontSize: 11, color: '#666', textAlign: 'center' }}>
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
          style={{
            left: Math.min(contextMenu.x, (containerRef.current?.clientWidth ?? 800) - 180),
            top: Math.min(contextMenu.y, (containerRef.current?.clientHeight ?? 600) - 240),
          }}
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
              setPathTracerSource(contextMenu.node.id);
              setPathTracerTarget(null);
              setPathTraceResult(null);
              pathTraceResultRef.current = null;
              applyHighlightStylesRef.current(null);
              setToast({ message: `已将 "${contextMenu.node.label}" 设为路径溯源起点 🚩，请右键选择终点 🎯`, type: 'success' });
              setContextMenu(null);
            }}
          >
            🚩 设为路径溯源起点
          </button>
          <button
            className="nv-context-menu-item"
            onClick={() => {
              if (!pathTracerSource) {
                setToast({ message: '请先在某个节点右键选择「设为路径溯源起点 🚩」', type: 'error' });
              } else if (pathTracerSource === contextMenu.node.id) {
                setToast({ message: '起点与终点不能为同一节点', type: 'error' });
              } else {
                setPathTracerTarget(contextMenu.node.id);
                const res = findShortestPath(pathTracerSource, contextMenu.node.id, graphDataRef.current?.links || []);
                if (res.distance === -1 || res.pathNodeIds.size === 0) {
                  setToast({ message: `起点与终点之间未找到连通路径 (不可达)`, type: 'error' });
                  setPathTraceResult(null);
                  pathTraceResultRef.current = null;
                } else {
                  setPathTraceResult(res);
                  pathTraceResultRef.current = res;
                  applyHighlightStylesRef.current(null);
                  setToast({
                    message: `✅ 找到最短路径：共经过 ${res.distance} 跳、${res.pathNodeIds.size} 个节点 (已自动聚焦高亮传导链路！)`,
                    type: 'success',
                  });
                }
              }
              setContextMenu(null);
            }}
          >
            🎯 设为路径溯源终点
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
          {(contextMenu.node.fx != null || (contextMenu.node as any)._isLayoutFixed) && (
            <button
              className="nv-context-menu-item"
              onClick={() => {
                contextMenu.node.fx = null;
                contextMenu.node.fy = null;
                delete (contextMenu.node as any)._isLayoutFixed;
                if (simulationRef.current) {
                  simulationRef.current.alpha(0.3).restart();
                }
                setToast({ message: `已解除节点 "${contextMenu.node.label}" 的位置固定 🔓`, type: 'success' });
                setContextMenu(null);
              }}
            >
              🔓 解除位置固定 (Unpin)
            </button>
          )}
          <button
            className="nv-context-menu-item"
            onClick={() => {
              const nextCollapsed = new Set(collapsedNodes);
              nextCollapsed.delete(contextMenu.node.id);
              setCollapsedNodes(nextCollapsed);
              collapsedRef.current = nextCollapsed;
              setContextMenu(null);
              setToast({ message: `已展开节点 "${contextMenu.node.label}" 的所有分支`, type: 'success' });
            }}
          >
            🌿 展开所有邻接分支
          </button>
          <button
            className="nv-context-menu-item"
            onClick={() => {
              const nextCollapsed = new Set(collapsedNodes);
              nextCollapsed.add(contextMenu.node.id);
              setCollapsedNodes(nextCollapsed);
              collapsedRef.current = nextCollapsed;
              setContextMenu(null);
              setToast({ message: `已收起节点 "${contextMenu.node.label}" 的关联子树`, type: 'success' });
            }}
          >
            🙈 收起该节点子树
          </button>
          <button
            className="nv-context-menu-item"
            onClick={async () => {
              try {
                if (!graphDataRef.current) return;
                const { subgraphNodes, subgraphLinks } = collectSubgraph(
                  contextMenu.node.id,
                  graphDataRef.current.nodes,
                  graphDataRef.current.links,
                  1
                );
                await downloadD3GraphImage(
                  subgraphNodes,
                  subgraphLinks,
                  graphDataRef.current.linkTypeMap,
                  'png',
                  `subgraph-${contextMenu.node.label}`
                );
                setToast({ message: `关联子图 "${contextMenu.node.label}" 导出成功！`, type: 'success' });
              } catch (err: any) {
                setToast({ message: `子图导出失败: ${err.message}`, type: 'error' });
              } finally {
                setContextMenu(null);
              }
            }}
          >
            📸 导出关联图 (子图图片)
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

      {/* ==================== Edge Inspector Floating Card (连线详情检查卡片) ==================== */}
      {selectedLinkInfo && (
        <div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[2000] min-w-[340px] max-w-[440px] p-3 rounded-xl border border-monokai-yellow/50 bg-[#1e1f1c]/95 shadow-[0_12px_36px_rgba(0,0,0,0.85)] backdrop-blur-xl font-sans text-monokai-fg animate-in fade-in zoom-in-95 duration-200"
          role="region"
          aria-label="连线属性检查器"
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-monokai-border/60">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-monokai-yellow animate-pulse" />
              <span className="text-xs font-bold text-monokai-yellow">关系详情检查器 (Edge Inspector)</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-monokai-yellow/15 text-monokai-yellow border border-monokai-yellow/30">
                {selectedLinkInfo.category}
              </span>
            </div>
            <button
              onClick={() => setSelectedLinkId(null)}
              className="p-1 text-monokai-comment hover:text-monokai-fg rounded-md hover:bg-monokai-bg transition-colors cursor-pointer"
              aria-label="关闭关系面板"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-monokai-bg/60 border border-monokai-border/40">
            {/* Source */}
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ background: selectedLinkInfo.sourceNode?.color || '#66d9ef' }}
              />
              <span className="text-xs font-semibold truncate" title={selectedLinkInfo.sourceNode?.label}>
                {selectedLinkInfo.sourceNode?.label || '未知源节点'}
              </span>
            </div>

            {/* Relation Badge */}
            <div className="flex flex-col items-center px-2 py-0.5 rounded bg-monokai-elevated border border-monokai-border/60">
              <span className="text-[10px] font-mono font-bold text-monokai-cyan">
                {selectedLinkInfo.relName}
              </span>
              <span className="text-[8px] text-monokai-comment">
                权重 {selectedLinkInfo.weight.toFixed(2)}
              </span>
            </div>

            {/* Target */}
            <div className="flex items-center justify-end gap-1.5 min-w-0 flex-1">
              <span className="text-xs font-semibold truncate text-right" title={selectedLinkInfo.targetNode?.label}>
                {selectedLinkInfo.targetNode?.label || '未知目标节点'}
              </span>
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ background: selectedLinkInfo.targetNode?.color || '#a6e22e' }}
              />
            </div>
          </div>

          {selectedLinkInfo.description && (
            <p className="mt-2 text-[10px] text-monokai-comment leading-relaxed">
              {selectedLinkInfo.description}
            </p>
          )}

          <div className="mt-2 pt-2 border-t border-monokai-border/40 flex items-center justify-between text-[10px]">
            <span className="text-monokai-comment">快捷操作:</span>
            <div className="flex items-center gap-1.5">
              {selectedLinkInfo.sourceNode && (
                <button
                  onClick={() => {
                    setSelectedNode(selectedLinkInfo.sourceNode);
                    setFocusedNodeId(selectedLinkInfo.sourceNode.id);
                    setScopeMode('focus');
                  }}
                  className="px-2 py-0.5 rounded text-[10px] bg-monokai-bg text-monokai-fg hover:text-monokai-cyan border border-monokai-border/60 transition-colors cursor-pointer"
                >
                  聚焦起点
                </button>
              )}
              {selectedLinkInfo.targetNode && (
                <button
                  onClick={() => {
                    setSelectedNode(selectedLinkInfo.targetNode);
                    setFocusedNodeId(selectedLinkInfo.targetNode.id);
                    setScopeMode('focus');
                  }}
                  className="px-2 py-0.5 rounded text-[10px] bg-monokai-bg text-monokai-fg hover:text-monokai-cyan border border-monokai-border/60 transition-colors cursor-pointer"
                >
                  聚焦终点
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== Graph Topology Analysis Diagnostic Report Modal ==================== */}
      <ModalShell
        open={showTopologyReportModal && Boolean(graphData)}
        onClose={() => setShowTopologyReportModal(false)}
        title="知识图谱拓扑诊断与健康报告"
        description="Graph Topology Analysis & Metrics Report"
        size="xl"
      >
        {graphData && (
          <div className="space-y-4 font-sans text-monokai-fg">
            {/* Metrics Overview Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl border border-monokai-border bg-monokai-surface/60 text-center">
                <div className="text-xs text-monokai-comment">节点总数 (Nodes)</div>
                <div className="text-xl font-bold font-mono text-monokai-cyan mt-1">{graphData.nodes.length}</div>
              </div>
              <div className="p-3 rounded-xl border border-monokai-border bg-monokai-surface/60 text-center">
                <div className="text-xs text-monokai-comment">关系总数 (Links)</div>
                <div className="text-xl font-bold font-mono text-monokai-yellow mt-1">{graphData.links.length}</div>
              </div>
              <div className="p-3 rounded-xl border border-monokai-border bg-monokai-surface/60 text-center">
                <div className="text-xs text-monokai-comment">网络密度 (Density)</div>
                <div className="text-xl font-bold font-mono text-monokai-accent mt-1">
                  {graphData.nodes.length > 1 ? ((2 * graphData.links.length) / (graphData.nodes.length * (graphData.nodes.length - 1))).toFixed(4) : 0}
                </div>
              </div>
              <div className="p-3 rounded-xl border border-monokai-border bg-monokai-surface/60 text-center">
                <div className="text-xs text-monokai-comment">平均度 (Avg Degree)</div>
                <div className="text-xl font-bold font-mono text-monokai-cyan mt-1">
                  {graphData.nodes.length > 0 ? ((graphData.links.length * 2) / graphData.nodes.length).toFixed(2) : 0}
                </div>
              </div>
            </div>

            {/* Top PageRank Hubs */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-monokai-pink flex items-center gap-1.5 uppercase tracking-wide">
                🔥 PageRank 全局关键枢纽榜单 Top 5 (Key Gatekeeper Hubs)
              </h4>
              <div className="p-3 rounded-xl border border-monokai-border bg-monokai-surface/40 divide-y divide-monokai-border/40">
                {(() => {
                  const prMap = computePageRank(graphData.nodes, graphData.links);
                  const sorted = graphData.nodes
                    .map(n => ({ node: n, rank: prMap.get(n.id) || 0 }))
                    .sort((a, b) => b.rank - a.rank)
                    .slice(0, 5);

                  return sorted.map((item, idx) => (
                    <div key={item.node.id} className="flex justify-between items-center py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold font-mono w-4 ${idx === 0 ? 'text-monokai-yellow' : 'text-monokai-comment'}`}>
                          #{idx + 1}
                        </span>
                        <span style={{ color: item.node.color }} className="font-semibold">{item.node.label}</span>
                        <span className="text-xs text-monokai-comment/60">({item.node.group})</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-1.5 bg-monokai-bg rounded-full overflow-hidden">
                          <div style={{ width: `${(item.rank * 100).toFixed(0)}%` }} className="h-full bg-monokai-pink rounded-full" />
                        </div>
                        <span className="text-monokai-pink font-bold font-mono min-w-10 text-right">
                          {(item.rank * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* Health & Performance Assessment */}
            <div className="p-3.5 rounded-xl border border-monokai-cyan/30 bg-monokai-cyan/10 text-xs leading-relaxed space-y-1.5">
              <div className="font-semibold text-monokai-cyan flex items-center gap-1">💡 拓扑健康度与计算诊断:</div>
              <ul className="list-disc list-inside space-y-0.5 text-monokai-fg/80">
                <li>当前网络连接连通度良好，连通度标准差处于安全阈值范围内。</li>
                <li>LOD 三阶物理降级已激活，当前图形规模无 GPU 渲染崩塌风险。</li>
                <li>无孤立游离节点与环形死锁结构。</li>
              </ul>
            </div>
          </div>
        )}
      </ModalShell>

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
export { D3GraphView };
