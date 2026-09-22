/**
 * useGraphViewState.ts - D3GraphView UI 状态管理 Hook
 * 
 * 设计目标：
 * 1. 集中管理所有 UI 状态，减少主组件的 useState 数量
 * 2. 提供类型安全的 API
 * 3. 支持状态分组，便于维护
 * 
 * 使用方式：
 * ```tsx
 * const {
 *   // Selection
 *   selectedNode, setSelectedNode,
 *   hoveredNode, setHoveredNode,
 *   // Search
 *   searchTerm, setSearchTerm,
 *   // Layout
 *   layoutMode, setLayoutMode,
 *   // ...
 * } = useGraphViewState();
 * ```
 */

import { useState, useCallback, useMemo } from 'react';
import type { GraphNode, GraphLink, LayoutMode } from '../D3GraphView.types';
import type { ScopeMode } from '../D3GraphView.focus';

// ============================================================
// 类型定义
// ============================================================

/** 节点选择状态 */
export interface SelectionState {
  selectedNode: GraphNode | null;
  setSelectedNode: (node: GraphNode | null) => void;
  hoveredNode: GraphNode | null;
  setHoveredNode: (node: GraphNode | null) => void;
  selectedNodeIds: Set<string>;
  setSelectedNodeIds: (ids: Set<string>) => void;
}

/** 搜索状态 */
export interface SearchState {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  searchIndex: number;
  setSearchIndex: (index: number) => void;
  infoContent: string;
  setInfoContent: (content: string) => void;
}

/** 布局状态 */
export interface LayoutState {
  layoutMode: LayoutMode;
  setLayoutMode: (mode: LayoutMode) => void;
  focusedNodeId: string | null;
  setFocusedNodeId: (id: string | null) => void;
  scopeMode: ScopeMode;
  setScopeMode: (mode: ScopeMode) => void;
  isLayoutLocked: boolean;
  setIsLayoutLocked: (locked: boolean) => void;
}

/** 物理参数状态 (Force Layout) */
export interface PhysicsState {
  chargeStrength: number;
  setChargeStrength: (value: number) => void;
  linkDistance: number;
  setLinkDistance: (value: number) => void;
  collisionRadius: number;
  setCollisionRadius: (value: number) => void;
  velocityDecay: number;
  setVelocityDecay: (value: number) => void;
  gravityStrength: number;
  setGravityStrength: (value: number) => void;
  linkStrength: number;
  setLinkStrength: (value: number) => void;
}

/** 过滤状态 */
export interface FilterState {
  weightThreshold: number;
  setWeightThreshold: (value: number) => void;
  showWeakLinks: boolean;
  setShowWeakLinks: (show: boolean) => void;
  activeRelationTypes: Set<number>;
  setActiveRelationTypes: (types: Set<number>) => void;
}

/** 工具栏/UI 可见性状态 */
export interface UIVisibilityState {
  showControls: boolean;
  setShowControls: (show: boolean) => void;
  showLegend: boolean;
  setShowLegend: (show: boolean) => void;
  showInfo: boolean;
  setShowInfo: (show: boolean) => void;
  showHelp: boolean;
  setShowHelp: (show: boolean) => void;
  layoutStatsExpanded: boolean;
  setLayoutStatsExpanded: (expanded: boolean) => void;
}

/** AI 填充状态 */
export interface AIFillState {
  isAiFilling: boolean;
  setIsAiFilling: (filling: boolean) => void;
  showAIFillInput: boolean;
  setShowAIFillInput: (show: boolean) => void;
  aiFillTopic: string;
  setAiFillTopic: (topic: string) => void;
  showScanModal: boolean;
  setShowScanModal: (show: boolean) => void;
}

/** 交互模式状态 */
export interface InteractionModeState {
  clickToFocus: boolean;
  setClickToFocus: (focus: boolean) => void;
  isFixedDrag: boolean;
  setIsFixedDrag: (fixed: boolean) => void;
  isLassoMode: boolean;
  setIsLassoMode: (lasso: boolean) => void;
}

/** 路径追踪状态 */
export interface PathTracerState {
  showPageRank: boolean;
  setShowPageRank: (show: boolean) => void;
  pathTracerSource: string | null;
  setPathTracerSource: (id: string | null) => void;
  pathTracerTarget: string | null;
  setPathTracerTarget: (id: string | null) => void;
  showTopologyReportModal: boolean;
  setShowTopologyReportModal: (show: boolean) => void;
}

/** 时间线/播放状态 */
export interface TimelineState {
  timelineStep: number;
  setTimelineStep: (step: number) => void;
  isPlayingTimeline: boolean;
  setIsPlayingTimeline: (playing: boolean) => void;
}

/** Toast 状态 */
export interface ToastState {
  toast: { message: string; type: 'success' | 'error' } | null;
  setToast: (toast: { message: string; type: 'success' | 'error' } | null) => void;
}

/** 上下文菜单状态 */
export interface ContextMenuState {
  contextMenu: { x: number; y: number; node: GraphNode } | null;
  setContextMenu: (menu: { x: number; y: number; node: GraphNode } | null) => void;
}

/** Lasso 选择状态 */
export interface LassoState {
  lassoBox: { x: number; y: number; width: number; height: number } | null;
  setLassoBox: (box: { x: number; y: number; width: number; height: number } | null) => void;
}

/** 折叠节点状态 */
export interface CollapseState {
  collapsedNodes: Set<string>;
  setCollapsedNodes: (nodes: Set<string>) => void;
}

/** 完整状态类型 */
export interface GraphViewState {
  // Selection
  selectedNode: GraphNode | null;
  setSelectedNode: (node: GraphNode | null) => void;
  hoveredNode: GraphNode | null;
  setHoveredNode: (node: GraphNode | null) => void;
  selectedNodeIds: Set<string>;
  setSelectedNodeIds: (ids: Set<string>) => void;
  
  // Search
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  searchIndex: number;
  setSearchIndex: (index: number) => void;
  infoContent: string;
  setInfoContent: (content: string) => void;
  
  // Layout
  layoutMode: LayoutMode;
  setLayoutMode: (mode: LayoutMode) => void;
  focusedNodeId: string | null;
  setFocusedNodeId: (id: string | null) => void;
  scopeMode: ScopeMode;
  setScopeMode: (mode: ScopeMode) => void;
  isLayoutLocked: boolean;
  setIsLayoutLocked: (locked: boolean) => void;
  
  // Physics
  chargeStrength: number;
  setChargeStrength: (value: number) => void;
  linkDistance: number;
  setLinkDistance: (value: number) => void;
  collisionRadius: number;
  setCollisionRadius: (value: number) => void;
  velocityDecay: number;
  setVelocityDecay: (value: number) => void;
  gravityStrength: number;
  setGravityStrength: (value: number) => void;
  linkStrength: number;
  setLinkStrength: (value: number) => void;
  
  // Filter
  weightThreshold: number;
  setWeightThreshold: (value: number) => void;
  showWeakLinks: boolean;
  setShowWeakLinks: (show: boolean) => void;
  activeRelationTypes: Set<number>;
  setActiveRelationTypes: (types: Set<number>) => void;
  
  // UI Visibility
  showControls: boolean;
  setShowControls: (show: boolean) => void;
  showLegend: boolean;
  setShowLegend: (show: boolean) => void;
  showInfo: boolean;
  setShowInfo: (show: boolean) => void;
  showHelp: boolean;
  setShowHelp: (show: boolean) => void;
  layoutStatsExpanded: boolean;
  setLayoutStatsExpanded: (expanded: boolean) => void;
  
  // AI Fill
  isAiFilling: boolean;
  setIsAiFilling: (filling: boolean) => void;
  showAIFillInput: boolean;
  setShowAIFillInput: (show: boolean) => void;
  aiFillTopic: string;
  setAiFillTopic: (topic: string) => void;
  showScanModal: boolean;
  setShowScanModal: (show: boolean) => void;
  
  // Interaction Mode
  clickToFocus: boolean;
  setClickToFocus: (focus: boolean) => void;
  isFixedDrag: boolean;
  setIsFixedDrag: (fixed: boolean) => void;
  isLassoMode: boolean;
  setIsLassoMode: (lasso: boolean) => void;
  
  // Path Tracer
  showPageRank: boolean;
  setShowPageRank: (show: boolean) => void;
  pathTracerSource: string | null;
  setPathTracerSource: (id: string | null) => void;
  pathTracerTarget: string | null;
  setPathTracerTarget: (id: string | null) => void;
  showTopologyReportModal: boolean;
  setShowTopologyReportModal: (show: boolean) => void;
  
  // Timeline
  timelineStep: number;
  setTimelineStep: (step: number) => void;
  isPlayingTimeline: boolean;
  setIsPlayingTimeline: (playing: boolean) => void;
  
  // Toast
  toast: { message: string; type: 'success' | 'error' } | null;
  setToast: (toast: { message: string; type: 'success' | 'error' } | null) => void;
  
  // Context Menu
  contextMenu: { x: number; y: number; node: GraphNode } | null;
  setContextMenu: (menu: { x: number; y: number; node: GraphNode } | null) => void;
  
  // Lasso
  lassoBox: { x: number; y: number; width: number; height: number } | null;
  setLassoBox: (box: { x: number; y: number; width: number; height: number } | null) => void;
  
  // Collapse
  collapsedNodes: Set<string>;
  setCollapsedNodes: (nodes: Set<string>) => void;
  
  // Actions
  resetAllState: () => void;
}

// ============================================================
// Hook 实现
// ============================================================

/**
 * D3GraphView UI 状态管理 Hook
 * 
 * 将原本分散在组件中的 ~40 个 useState 集中管理，
 * 提供清晰的 API 和类型安全。
 */
export function useGraphViewState(): GraphViewState {
  // ========== Selection ==========
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());

  // ========== Search ==========
  const [searchTerm, setSearchTerm] = useState('');
  const [searchIndex, setSearchIndex] = useState(-1);
  const [infoContent, setInfoContent] = useState('');

  // ========== Layout ==========
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('horizontalTree');
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [scopeMode, setScopeMode] = useState<ScopeMode>('all');
  const [isLayoutLocked, setIsLayoutLocked] = useState(false);

  // ========== Physics ==========
  const [chargeStrength, setChargeStrength] = useState(-160);
  const [linkDistance, setLinkDistance] = useState(75);
  const [collisionRadius, setCollisionRadius] = useState(14);
  const [velocityDecay, setVelocityDecay] = useState(0.42);
  const [gravityStrength, setGravityStrength] = useState(0.25);
  const [linkStrength, setLinkStrength] = useState(0.6);

  // ========== Filter ==========
  const [weightThreshold, setWeightThreshold] = useState(0.65);
  const [showWeakLinks, setShowWeakLinks] = useState(false);
  const [activeRelationTypes, setActiveRelationTypes] = useState<Set<number>>(new Set());

  // ========== UI Visibility ==========
  const [showControls, setShowControls] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [layoutStatsExpanded, setLayoutStatsExpanded] = useState(false);

  // ========== AI Fill ==========
  const [isAiFilling, setIsAiFilling] = useState(false);
  const [showAIFillInput, setShowAIFillInput] = useState(false);
  const [aiFillTopic, setAiFillTopic] = useState('');
  const [showScanModal, setShowScanModal] = useState(false);

  // ========== Interaction Mode ==========
  const [clickToFocus, setClickToFocus] = useState(true);
  const [isFixedDrag, setIsFixedDrag] = useState(false);
  const [isLassoMode, setIsLassoMode] = useState(false);

  // ========== Path Tracer ==========
  const [showPageRank, setShowPageRank] = useState(false);
  const [pathTracerSource, setPathTracerSource] = useState<string | null>(null);
  const [pathTracerTarget, setPathTracerTarget] = useState<string | null>(null);
  const [showTopologyReportModal, setShowTopologyReportModal] = useState(false);

  // ========== Timeline ==========
  const [timelineStep, setTimelineStep] = useState(100);
  const [isPlayingTimeline, setIsPlayingTimeline] = useState(false);

  // ========== Toast ==========
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // ========== Context Menu ==========
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: GraphNode } | null>(null);

  // ========== Lasso ==========
  const [lassoBox, setLassoBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // ========== Collapse ==========
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

  // ========== Actions ==========
  const resetAllState = useCallback(() => {
    setSelectedNode(null);
    setHoveredNode(null);
    setSelectedNodeIds(new Set());
    setSearchTerm('');
    setSearchIndex(-1);
    setInfoContent('');
    setFocusedNodeId(null);
    setScopeMode('all');
    setCollapsedNodes(new Set());
    setPathTracerSource(null);
    setPathTracerTarget(null);
    setToast(null);
    setContextMenu(null);
  }, []);

  return {
    // Selection
    selectedNode, setSelectedNode,
    hoveredNode, setHoveredNode,
    selectedNodeIds, setSelectedNodeIds,
    
    // Search
    searchTerm, setSearchTerm,
    searchIndex, setSearchIndex,
    infoContent, setInfoContent,
    
    // Layout
    layoutMode, setLayoutMode,
    focusedNodeId, setFocusedNodeId,
    scopeMode, setScopeMode,
    isLayoutLocked, setIsLayoutLocked,
    
    // Physics
    chargeStrength, setChargeStrength,
    linkDistance, setLinkDistance,
    collisionRadius, setCollisionRadius,
    velocityDecay, setVelocityDecay,
    gravityStrength, setGravityStrength,
    linkStrength, setLinkStrength,
    
    // Filter
    weightThreshold, setWeightThreshold,
    showWeakLinks, setShowWeakLinks,
    activeRelationTypes, setActiveRelationTypes,
    
    // UI Visibility
    showControls, setShowControls,
    showLegend, setShowLegend,
    showInfo, setShowInfo,
    showHelp, setShowHelp,
    layoutStatsExpanded, setLayoutStatsExpanded,
    
    // AI Fill
    isAiFilling, setIsAiFilling,
    showAIFillInput, setShowAIFillInput,
    aiFillTopic, setAiFillTopic,
    showScanModal, setShowScanModal,
    
    // Interaction Mode
    clickToFocus, setClickToFocus,
    isFixedDrag, setIsFixedDrag,
    isLassoMode, setIsLassoMode,
    
    // Path Tracer
    showPageRank, setShowPageRank,
    pathTracerSource, setPathTracerSource,
    pathTracerTarget, setPathTracerTarget,
    showTopologyReportModal, setShowTopologyReportModal,
    
    // Timeline
    timelineStep, setTimelineStep,
    isPlayingTimeline, setIsPlayingTimeline,
    
    // Toast
    toast, setToast,
    
    // Context Menu
    contextMenu, setContextMenu,
    
    // Lasso
    lassoBox, setLassoBox,
    
    // Collapse
    collapsedNodes, setCollapsedNodes,
    
    // Actions
    resetAllState,
  };
}
