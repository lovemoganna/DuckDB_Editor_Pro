/**
 * OntologyLayoutPanel.tsx — 本体图谱实体画布排版微调控制中心
 *
 * 风格统一对标：知识图谱拓扑布局控制面板 (TopologyLayoutPanel)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * MECE 四象限架构体系 (Mutually Exclusive, Collectively Exhaustive)
 * ═══════════════════════════════════════════════════════════════════════════════
 * Tab 1: 布局模式 (Layout Modes)      — 6种算法互斥切换/动效几何预览/场景化极速预设/方向指引
 * Tab 2: 间距微调 (Spacing & Lanes)    — 层次间距/同层间距/并行通道/3种连线形态（直线/正交/贝塞尔）
 * Tab 3: 视图交互 (View & Canvas)      — 聚焦模式/网格吸附/点阵背景/小地图/流动动效/只读模式/批量锁定
 * Tab 4: 拓扑诊断 (Diagnostics & Stats)— 实体与关系规模/图密度/孤立节点检测/排版质量评分/一键重排
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Sliders, LayoutGrid, GitBranch, Network, CircleDot, Hexagon,
  Sparkles, RotateCcw, Undo2, Redo2, Keyboard, X,
  Maximize2, ZoomIn, ZoomOut, Lock, Unlock, Eye, EyeOff,
  Spline, Minus, Waypoints, Activity, Layers, HelpCircle,
  Check, RefreshCw, Zap, ShieldCheck, AlertCircle, Info, ChevronRight
} from 'lucide-react';
import {
  ONTOLOGY_LAYOUTS,
  type OntologyLayoutMode
} from './OntologyLayout';

// ==================== 样式常量 (与知识图谱控制面板严格一致) ====================

const SURFACE =
  'bg-[#1e1f1c]/95 border border-monokai-border/80 rounded-xl shadow-[0_16px_48px_-12px_rgba(0,0,0,0.85)] backdrop-blur-xl text-monokai-fg font-sans';
const GROUP_CARD =
  'rounded-lg border border-monokai-border/60 bg-monokai-bg/50 p-2.5 flex flex-col gap-2';
const SECTION_LABEL =
  'text-[10px] font-bold uppercase tracking-[0.12em] text-monokai-comment flex items-center gap-1.5';
const TAB_BTN_ACTIVE =
  'flex-1 py-1.5 px-1 rounded-md text-[11px] font-semibold bg-monokai-cyan/15 text-monokai-cyan border border-monokai-cyan/40 shadow-sm transition-all flex items-center justify-center gap-1';
const TAB_BTN_INACTIVE =
  'flex-1 py-1.5 px-1 rounded-md text-[11px] font-medium text-monokai-comment hover:text-monokai-fg hover:bg-monokai-bg/40 border border-transparent transition-all flex items-center justify-center gap-1';
const BTN_PRIMARY =
  'inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold bg-monokai-cyan/15 text-monokai-cyan border border-monokai-cyan/40 hover:bg-monokai-cyan/25 hover:border-monokai-cyan/60 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
const BTN_SECONDARY =
  'inline-flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-monokai-bg/70 text-monokai-fg-muted border border-monokai-border/70 hover:bg-monokai-elevated hover:text-monokai-fg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
const BTN_DANGER =
  'inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-monokai-pink/12 text-monokai-pink border border-monokai-pink/35 hover:bg-monokai-pink/22 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

// ==================== 接口定义 ====================

export type OntologyPanelTab = 'layout' | 'spacing' | 'canvas' | 'diagnostics';

export interface OntologyLayoutPanelProps {
  /** 面板是否开启展开 */
  isOpen: boolean;
  /** 开关切换回调 */
  onToggle: () => void;
  /** 关闭面板回调 */
  onClose: () => void;

  /** 当前布局模式 */
  layoutMode: OntologyLayoutMode;
  /** 布局模式变更 */
  onLayoutModeChange: (mode: OntologyLayoutMode) => void;

  /** 同层节点间距 */
  nodesep: number;
  /** 同层节点间距变更 */
  onNodesepChange: (nodesep: number) => void;

  /** 层级纵深间距 */
  ranksep: number;
  /** 层级纵深间距变更 */
  onRanksepChange: (ranksep: number) => void;

  /** 并行线车道间距 */
  parallelOffset: number;
  /** 并行线车道间距变更 */
  onParallelOffsetChange: (offset: number) => void;

  /** 连线路由风格 */
  edgeRoutingMode: 'straight' | 'orthogonal' | 'bezier';
  /** 连线路由风格变更 */
  onEdgeRoutingModeChange: (mode: 'straight' | 'orthogonal' | 'bezier') => void;

  /** 聚焦模式 */
  isFocusMode: boolean;
  /** 聚焦模式变更 */
  onFocusModeChange: (focus: boolean) => void;

  /** 网格吸附 */
  snapToGrid: boolean;
  /** 网格吸附变更 */
  onSnapToGridChange: (snap: boolean) => void;

  /** 背景点阵网格 */
  showGrid: boolean;
  /** 背景点阵网格变更 */
  onShowGridChange: (show: boolean) => void;

  /** 鹰眼小地图 */
  showMiniMap: boolean;
  /** 鹰眼小地图变更 */
  onShowMiniMapChange: (show: boolean) => void;

  /** 连线流向动画 */
  animateEdges: boolean;
  /** 连线流向动画变更 */
  onAnimateEdgesChange: (animate: boolean) => void;

  /** 双击新建实体节点 */
  enableDbClickCreate: boolean;
  /** 双击新建实体节点变更 */
  onEnableDbClickCreateChange: (enable: boolean) => void;

  /** 只读画布模式 */
  isReadOnly: boolean;
  /** 只读画布模式变更 */
  onIsReadOnlyChange: (readOnly: boolean) => void;

  /** 是否默认展开实体属性 */
  isDefaultExpanded?: boolean;
  /** 切换全局展开/折叠属性 */
  onToggleExpandAll?: (expand: boolean) => void;

  /** 执行自动对齐布局 */
  onAutoAlign: (customNodesep?: number, customRanksep?: number, customMode?: OntologyLayoutMode) => void;

  /** 强制重置全局布局 */
  onForceResetLayout: () => void;

  /** 适应全图 */
  onFitView?: () => void;

  /** 复位视角 (100% 居中) */
  onResetZoom?: () => void;

  /** 恢复所有默认参数 */
  onResetDefaults: () => void;

  /** 全部锁定实体节点 */
  onLockAll?: () => void;

  /** 解除全部实体锁定 */
  onUnlockAll?: () => void;

  /** 已锁定的实体数量 */
  lockedCount?: number;

  /** 撤销操作 */
  onUndo?: () => void;
  /** 重做操作 */
  onRedo?: () => void;
  /** 是否可撤销 */
  canUndo?: boolean;
  /** 是否可重做 */
  canRedo?: boolean;

  /** 画布实体数量 */
  nodeCount: number;
  /** 画布关系数量 */
  edgeCount: number;

  /** 节点列表用于拓扑诊断 */
  nodes?: any[];
  /** 连线列表用于拓扑诊断 */
  edges?: any[];

  /** 默认选中的 Tab */
  defaultTab?: OntologyPanelTab;
}

// ==================== 布局元数据配置 ====================

interface LayoutDetailMeta {
  id: OntologyLayoutMode;
  label: string;
  subLabel: string;
  description: string;
  tag: string;
  color: string;
  icon: React.ReactNode;
}

const LAYOUT_DETAILS: Record<OntologyLayoutMode, LayoutDetailMeta> = {
  orthogonal: {
    id: 'orthogonal',
    label: '正交网格',
    subLabel: 'Orthogonal',
    description: '对齐网格坐标与正交折线路由，企业级规整严谨',
    tag: '推荐',
    color: '#66d9ef', // monokai-cyan
    icon: <LayoutGrid className="w-3.5 h-3.5 text-monokai-cyan" />,
  },
  hierarchical: {
    id: 'hierarchical',
    label: '层级分层',
    subLabel: 'Hierarchical',
    description: '从左到右依赖递进分层，清晰呈现模型上下游脉络',
    tag: '依赖分析',
    color: '#ae81ff', // monokai-purple
    icon: <GitBranch className="w-3.5 h-3.5 text-monokai-purple" />,
  },
  tree: {
    id: 'tree',
    label: '垂直树形',
    subLabel: 'Vertical Tree',
    description: '从上至下紧凑树状辐射，利于实体继承与分类派生',
    tag: '分类体系',
    color: '#a6e22e', // monokai-green
    icon: <Network className="w-3.5 h-3.5 text-monokai-green" />,
  },
  radial: {
    id: 'radial',
    label: '核心放射',
    subLabel: 'Radial Orbit',
    description: '核心根实体向外逐层同心圆扩散，聚焦枢纽实体',
    tag: '中心辐射',
    color: '#fd971f', // monokai-orange
    icon: <CircleDot className="w-3.5 h-3.5 text-monokai-orange" />,
  },
  circular: {
    id: 'circular',
    label: '环形闭环',
    subLabel: 'Circular Ring',
    description: '圆周均衡对称排布，适合闭环流转与对等实体网',
    tag: '对称闭环',
    color: '#e6db74', // monokai-yellow
    icon: <Hexagon className="w-3.5 h-3.5 text-monokai-yellow" />,
  },
  force: {
    id: 'force',
    label: '弹性力导',
    subLabel: 'Force Cluster',
    description: '根据关联紧密程度自然弹力聚类，展示密集关联群',
    tag: '聚类感知',
    color: '#f92672', // monokai-pink
    icon: <Sparkles className="w-3.5 h-3.5 text-monokai-pink" />,
  },
};

// ==================== 几何示意微缩图 ====================

const LayoutMiniPreview: React.FC<{ mode: OntologyLayoutMode; isActive: boolean }> = ({ mode, isActive }) => {
  const meta = LAYOUT_DETAILS[mode];
  const strokeColor = isActive ? meta.color : 'rgba(255,255,255,0.4)';
  const fillColor = isActive ? meta.color : 'rgba(255,255,255,0.2)';

  switch (mode) {
    case 'orthogonal':
      return (
        <svg viewBox="0 0 36 28" className="w-9 h-7 shrink-0">
          <rect x="3" y="4" width="9" height="7" rx="1.5" fill={fillColor} stroke={strokeColor} strokeWidth="1" />
          <rect x="24" y="4" width="9" height="7" rx="1.5" fill={fillColor} stroke={strokeColor} strokeWidth="1" />
          <rect x="24" y="17" width="9" height="7" rx="1.5" fill={fillColor} stroke={strokeColor} strokeWidth="1" />
          <path d="M 12 7.5 L 18 7.5 L 18 20.5 L 24 20.5" fill="none" stroke={strokeColor} strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M 12 7.5 L 24 7.5" fill="none" stroke={strokeColor} strokeWidth="1.2" />
        </svg>
      );
    case 'hierarchical':
      return (
        <svg viewBox="0 0 36 28" className="w-9 h-7 shrink-0">
          <circle cx="6" cy="14" r="3.5" fill={fillColor} stroke={strokeColor} strokeWidth="1" />
          <circle cx="18" cy="7" r="3.5" fill={fillColor} stroke={strokeColor} strokeWidth="1" />
          <circle cx="18" cy="21" r="3.5" fill={fillColor} stroke={strokeColor} strokeWidth="1" />
          <circle cx="30" cy="14" r="3.5" fill={fillColor} stroke={strokeColor} strokeWidth="1" />
          <line x1="9.5" y1="14" x2="14.5" y2="7" stroke={strokeColor} strokeWidth="1" />
          <line x1="9.5" y1="14" x2="14.5" y2="21" stroke={strokeColor} strokeWidth="1" />
          <line x1="21.5" y1="7" x2="26.5" y2="14" stroke={strokeColor} strokeWidth="1" />
          <line x1="21.5" y1="21" x2="26.5" y2="14" stroke={strokeColor} strokeWidth="1" />
        </svg>
      );
    case 'tree':
      return (
        <svg viewBox="0 0 36 28" className="w-9 h-7 shrink-0">
          <circle cx="18" cy="5" r="3.5" fill={fillColor} stroke={strokeColor} strokeWidth="1" />
          <circle cx="9" cy="16" r="3" fill={fillColor} stroke={strokeColor} strokeWidth="1" />
          <circle cx="27" cy="16" r="3" fill={fillColor} stroke={strokeColor} strokeWidth="1" />
          <circle cx="5" cy="24" r="2.5" fill={fillColor} stroke={strokeColor} strokeWidth="1" />
          <circle cx="13" cy="24" r="2.5" fill={fillColor} stroke={strokeColor} strokeWidth="1" />
          <path d="M 18 8.5 L 9 13" stroke={strokeColor} strokeWidth="1" />
          <path d="M 18 8.5 L 27 13" stroke={strokeColor} strokeWidth="1" />
          <path d="M 9 19 L 5 21.5" stroke={strokeColor} strokeWidth="1" />
          <path d="M 9 19 L 13 21.5" stroke={strokeColor} strokeWidth="1" />
        </svg>
      );
    case 'radial':
      return (
        <svg viewBox="0 0 36 28" className="w-9 h-7 shrink-0">
          <circle cx="18" cy="14" r="4" fill={fillColor} stroke={strokeColor} strokeWidth="1.2" />
          <circle cx="7" cy="14" r="2.5" fill={fillColor} stroke={strokeColor} strokeWidth="1" />
          <circle cx="29" cy="14" r="2.5" fill={fillColor} stroke={strokeColor} strokeWidth="1" />
          <circle cx="18" cy="4" r="2.5" fill={fillColor} stroke={strokeColor} strokeWidth="1" />
          <circle cx="18" cy="24" r="2.5" fill={fillColor} stroke={strokeColor} strokeWidth="1" />
          <line x1="18" y1="10" x2="18" y2="6.5" stroke={strokeColor} strokeWidth="1" strokeDasharray="1 1" />
          <line x1="18" y1="18" x2="18" y2="21.5" stroke={strokeColor} strokeWidth="1" strokeDasharray="1 1" />
          <line x1="14" y1="14" x2="9.5" y2="14" stroke={strokeColor} strokeWidth="1" strokeDasharray="1 1" />
          <line x1="22" y1="14" x2="26.5" y2="14" stroke={strokeColor} strokeWidth="1" strokeDasharray="1 1" />
        </svg>
      );
    case 'circular':
      return (
        <svg viewBox="0 0 36 28" className="w-9 h-7 shrink-0">
          <ellipse cx="18" cy="14" rx="14" ry="10" fill="none" stroke={strokeColor} strokeWidth="0.8" strokeDasharray="2 2" />
          <circle cx="18" cy="4" r="2.5" fill={fillColor} stroke={strokeColor} strokeWidth="1" />
          <circle cx="31" cy="10" r="2.5" fill={fillColor} stroke={strokeColor} strokeWidth="1" />
          <circle cx="28" cy="21" r="2.5" fill={fillColor} stroke={strokeColor} strokeWidth="1" />
          <circle cx="8" cy="21" r="2.5" fill={fillColor} stroke={strokeColor} strokeWidth="1" />
          <circle cx="5" cy="10" r="2.5" fill={fillColor} stroke={strokeColor} strokeWidth="1" />
        </svg>
      );
    case 'force':
      return (
        <svg viewBox="0 0 36 28" className="w-9 h-7 shrink-0">
          <circle cx="14" cy="12" r="3.5" fill={fillColor} stroke={strokeColor} strokeWidth="1" />
          <circle cx="23" cy="9" r="3" fill={fillColor} stroke={strokeColor} strokeWidth="1" />
          <circle cx="21" cy="19" r="3" fill={fillColor} stroke={strokeColor} strokeWidth="1" />
          <circle cx="8" cy="21" r="2.5" fill={fillColor} stroke={strokeColor} strokeWidth="1" />
          <line x1="14" y1="12" x2="23" y2="9" stroke={strokeColor} strokeWidth="1" />
          <line x1="14" y1="12" x2="21" y2="19" stroke={strokeColor} strokeWidth="1" />
          <line x1="23" y1="9" x2="21" y2="19" stroke={strokeColor} strokeWidth="1" />
          <line x1="14" y1="12" x2="8" y2="21" stroke={strokeColor} strokeWidth="1" />
        </svg>
      );
  }
};

// ==================== 主组件实现 ====================

export const OntologyLayoutPanel: React.FC<OntologyLayoutPanelProps> = ({
  isOpen,
  onToggle,
  onClose,
  layoutMode,
  onLayoutModeChange,
  nodesep,
  onNodesepChange,
  ranksep,
  onRanksepChange,
  parallelOffset,
  onParallelOffsetChange,
  edgeRoutingMode,
  onEdgeRoutingModeChange,
  isFocusMode,
  onFocusModeChange,
  snapToGrid,
  onSnapToGridChange,
  showGrid,
  onShowGridChange,
  showMiniMap,
  onShowMiniMapChange,
  animateEdges,
  onAnimateEdgesChange,
  enableDbClickCreate,
  onEnableDbClickCreateChange,
  isReadOnly,
  onIsReadOnlyChange,
  isDefaultExpanded = true,
  onToggleExpandAll,
  onAutoAlign,
  onForceResetLayout,
  onFitView,
  onResetZoom,
  onResetDefaults,
  onLockAll,
  onUnlockAll,
  lockedCount = 0,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  nodeCount,
  edgeCount,
  nodes = [],
  edges = [],
  defaultTab = 'layout',
}) => {
  const [activeTab, setActiveTab] = useState<OntologyPanelTab>(defaultTab);
  const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);

  // 计算当前布局元信息
  const currentMeta = useMemo(() => {
    return LAYOUT_DETAILS[layoutMode] || LAYOUT_DETAILS.orthogonal;
  }, [layoutMode]);

  // 拓扑诊断指标计算
  const diagnostics = useMemo(() => {
    const totalNodes = nodeCount || 0;
    const totalEdges = edgeCount || 0;
    const density = totalNodes > 1 ? Number(((2 * totalEdges) / (totalNodes * (totalNodes - 1)) * 100).toFixed(1)) : 0;

    // 孤立实体检测
    const connectedNodeIds = new Set<string>();
    edges.forEach((e: any) => {
      if (e.source) connectedNodeIds.add(String(e.source));
      if (e.target) connectedNodeIds.add(String(e.target));
      if (e.source_object_id) connectedNodeIds.add(String(e.source_object_id));
      if (e.target_object_id) connectedNodeIds.add(String(e.target_object_id));
    });

    const isolatedCount = nodes.length > 0
      ? nodes.filter((n: any) => !connectedNodeIds.has(String(n.id))).length
      : 0;

    // 计算排版健康分 (0-100)
    let score = 90;
    if (totalNodes > 0 && isolatedCount > 0) score -= Math.min(25, isolatedCount * 5);
    if (density > 50) score -= 10; // 过高密度容易重叠
    if (totalNodes > 30 && nodesep < 80) score -= 8;
    score = Math.max(20, Math.min(99, score));

    return {
      density,
      isolatedCount,
      score,
      isClean: isolatedCount === 0 && totalNodes > 0,
    };
  }, [nodeCount, edgeCount, nodes, edges, nodesep]);

  // 快捷场景预设应用
  const handleApplyPreset = useCallback((preset: 'standard' | 'compact' | 'spread' | 'tree') => {
    switch (preset) {
      case 'standard':
        onNodesepChange(100);
        onRanksepChange(200);
        onLayoutModeChange('orthogonal');
        onEdgeRoutingModeChange('orthogonal');
        onAutoAlign(100, 200, 'orthogonal');
        break;
      case 'compact':
        onNodesepChange(70);
        onRanksepChange(140);
        onLayoutModeChange('hierarchical');
        onEdgeRoutingModeChange('bezier');
        onAutoAlign(70, 140, 'hierarchical');
        break;
      case 'spread':
        onNodesepChange(120);
        onRanksepChange(220);
        onLayoutModeChange('radial');
        onEdgeRoutingModeChange('bezier');
        onAutoAlign(120, 220, 'radial');
        break;
      case 'tree':
        onNodesepChange(90);
        onRanksepChange(180);
        onLayoutModeChange('tree');
        onEdgeRoutingModeChange('orthogonal');
        onAutoAlign(90, 180, 'tree');
        break;
    }
  }, [onNodesepChange, onRanksepChange, onLayoutModeChange, onEdgeRoutingModeChange, onAutoAlign]);

  return (
    <div className="absolute left-3 top-3 z-30 flex flex-col items-start gap-2 select-none">
      {/* ═══ 1. 胶囊触发按钮 (关闭时保持清爽，开启时高亮) ═══ */}
      <button
        type="button"
        onClick={onToggle}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold shadow-xl backdrop-blur-md transition-all select-none group ${
          isOpen
            ? 'bg-monokai-surface border-monokai-cyan text-monokai-fg shadow-[0_0_15px_rgba(102,217,239,0.2)]'
            : 'bg-[#1e1f1c]/90 border-monokai-border text-monokai-comment hover:text-monokai-fg hover:border-monokai-cyan/60 hover:bg-monokai-surface/80'
        }`}
        title="调整画布排版设置与视觉交互"
        aria-label="排版微调"
        aria-expanded={isOpen}
      >
        <div className={`p-0.5 rounded transition-transform group-hover:rotate-45 duration-300 ${isOpen ? 'text-monokai-cyan' : 'text-monokai-comment group-hover:text-monokai-cyan'}`}>
          <Sliders className="w-3.5 h-3.5" />
        </div>
        <span>排版微调</span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded font-mono font-normal border transition-colors"
          style={{
            color: currentMeta.color,
            borderColor: `${currentMeta.color}40`,
            backgroundColor: `${currentMeta.color}15`,
          }}
        >
          {currentMeta.label}
        </span>
        <span className="text-[10px] text-monokai-comment/70 font-mono hidden sm:inline">
          {nodesep}/{ranksep}
        </span>
      </button>

      {/* ═══ 2. 展开后的控制面板实体 ═══ */}
      {isOpen && (
        <div
          className={`${SURFACE} flex flex-col w-[360px] max-h-[calc(100vh-100px)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 relative`}
          role="region"
          aria-label="本体图谱实体排版控制面板"
        >
          {/* 顶部彩色流光饰边 */}
          <span className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-monokai-cyan via-monokai-accent to-monokai-purple opacity-90" />

          {/* ── 顶部固定状态栏 ── */}
          <div className="shrink-0 flex items-center justify-between px-3.5 py-2.5 border-b border-monokai-border/60 bg-monokai-surface/40">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border"
                style={{
                  backgroundColor: `${currentMeta.color}18`,
                  borderColor: `${currentMeta.color}45`,
                  color: currentMeta.color,
                }}
              >
                {currentMeta.icon}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-[13px] text-monokai-fg leading-tight">实体排版微调</span>
                  <span
                    className="text-[9px] px-1.5 py-px rounded-full font-medium"
                    style={{
                      backgroundColor: `${currentMeta.color}20`,
                      color: currentMeta.color,
                      border: `1px solid ${currentMeta.color}40`,
                    }}
                  >
                    {currentMeta.tag}
                  </span>
                </div>
                <span className="block text-[10px] text-monokai-comment/80 truncate">
                  {nodeCount} 实体 · {edgeCount} 关系 · {currentMeta.label}
                </span>
              </div>
            </div>

            {/* 顶部右侧快捷按钮群 */}
            <div className="flex items-center gap-1 shrink-0">
              {/* 撤销 / 重做 */}
              {onUndo && (
                <button
                  type="button"
                  onClick={onUndo}
                  disabled={!canUndo}
                  title="撤销排版 (Ctrl+Z)"
                  aria-label="撤销"
                  className="p-1.5 rounded text-monokai-comment hover:bg-monokai-bg/60 hover:text-monokai-fg disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
              )}
              {onRedo && (
                <button
                  type="button"
                  onClick={onRedo}
                  disabled={!canRedo}
                  title="重做排版 (Ctrl+Y)"
                  aria-label="重做"
                  className="p-1.5 rounded text-monokai-comment hover:bg-monokai-bg/60 hover:text-monokai-fg disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
              )}

              {/* 快捷键速查 */}
              <button
                type="button"
                onClick={() => setShowShortcutsModal(!showShortcutsModal)}
                title="快捷键参考"
                aria-label="快捷键速查"
                className={`p-1.5 rounded transition-colors ${
                  showShortcutsModal ? 'text-monokai-cyan bg-monokai-cyan/15' : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-bg/60'
                }`}
              >
                <Keyboard className="w-3.5 h-3.5" />
              </button>

              {/* 恢复默认 */}
              <button
                type="button"
                onClick={onResetDefaults}
                title="恢复排版与交互默认参数"
                aria-label="恢复默认设置"
                className="p-1.5 rounded text-monokai-comment hover:text-amber-400 hover:bg-monokai-bg/60 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              {/* 关闭面板 */}
              <button
                type="button"
                onClick={onClose}
                title="收起控制面板"
                aria-label="收起控制面板"
                className="p-1.5 rounded text-monokai-comment hover:text-monokai-fg hover:bg-monokai-bg/60 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 快捷键抽屉 */}
          {showShortcutsModal && (
            <div className="shrink-0 p-3 bg-monokai-bg/95 border-b border-monokai-border/60 text-[10.5px] space-y-1.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-monokai-cyan font-semibold">
                <span className="flex items-center gap-1">
                  <Keyboard className="w-3.5 h-3.5" /> 画布排版快捷键
                </span>
                <button
                  type="button"
                  onClick={() => setShowShortcutsModal(false)}
                  className="text-monokai-comment hover:text-monokai-fg"
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1 text-monokai-fg-muted">
                <div className="flex justify-between items-center">
                  <span>适应全图</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-monokai-surface border border-monokai-border font-mono text-[9px]">0</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span>重置排版</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-monokai-surface border border-monokai-border font-mono text-[9px]">R</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span>聚焦高亮</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-monokai-surface border border-monokai-border font-mono text-[9px]">F</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span>撤销操作</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-monokai-surface border border-monokai-border font-mono text-[9px]">Ctrl+Z</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span>重做操作</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-monokai-surface border border-monokai-border font-mono text-[9px]">Ctrl+Y</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span>矩形框选</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-monokai-surface border border-monokai-border font-mono text-[9px]">Shift</kbd>
                </div>
              </div>
            </div>
          )}

          {/* ── 2. MECE 四象限 Tab 切换条 ── */}
          <div className="shrink-0 p-1.5 bg-monokai-bg/60 border-b border-monokai-border/40 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('layout')}
              className={activeTab === 'layout' ? TAB_BTN_ACTIVE : TAB_BTN_INACTIVE}
              aria-selected={activeTab === 'layout'}
            >
              <LayoutGrid className="w-3 h-3" />
              <span>布局算法</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('spacing')}
              className={activeTab === 'spacing' ? TAB_BTN_ACTIVE : TAB_BTN_INACTIVE}
              aria-selected={activeTab === 'spacing'}
            >
              <Sliders className="w-3 h-3" />
              <span>间距微调</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('canvas')}
              className={activeTab === 'canvas' ? TAB_BTN_ACTIVE : TAB_BTN_INACTIVE}
              aria-selected={activeTab === 'canvas'}
            >
              <Layers className="w-3 h-3" />
              <span>视图交互</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('diagnostics')}
              className={activeTab === 'diagnostics' ? TAB_BTN_ACTIVE : TAB_BTN_INACTIVE}
              aria-selected={activeTab === 'diagnostics'}
            >
              <Activity className="w-3 h-3" />
              <span>拓扑诊断</span>
            </button>
          </div>

          {/* ── 3. 主内容区域 (滚动区域) ── */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3.5 custom-scrollbar text-xs">
            {/* ══════════════ TAB 1: 布局算法 ══════════════ */}
            {activeTab === 'layout' && (
              <div className="space-y-3">
                {/* 场景化快速预设 */}
                <div className={GROUP_CARD}>
                  <div className="flex items-center justify-between">
                    <span className={SECTION_LABEL}>
                      <Zap className="w-3 h-3 text-monokai-accent" />
                      场景化极速预设
                    </span>
                    <span className="text-[9px] text-monokai-comment">一键自适应</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('standard')}
                      className={`${BTN_SECONDARY} justify-between text-left px-2 py-1.5`}
                    >
                      <div className="flex flex-col">
                        <span className="text-[11px] font-semibold text-monokai-fg">标准正交</span>
                        <span className="text-[9px] text-monokai-comment">100 / 200px 网格</span>
                      </div>
                      <ChevronRight className="w-3 h-3 text-monokai-cyan" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('compact')}
                      className={`${BTN_SECONDARY} justify-between text-left px-2 py-1.5`}
                    >
                      <div className="flex flex-col">
                        <span className="text-[11px] font-semibold text-monokai-fg">紧凑分层</span>
                        <span className="text-[9px] text-monokai-comment">70 / 140px 纵深</span>
                      </div>
                      <ChevronRight className="w-3 h-3 text-monokai-purple" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('spread')}
                      className={`${BTN_SECONDARY} justify-between text-left px-2 py-1.5`}
                    >
                      <div className="flex flex-col">
                        <span className="text-[11px] font-semibold text-monokai-fg">核心放射</span>
                        <span className="text-[9px] text-monokai-comment">120 / 220px 环形</span>
                      </div>
                      <ChevronRight className="w-3 h-3 text-monokai-orange" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('tree')}
                      className={`${BTN_SECONDARY} justify-between text-left px-2 py-1.5`}
                    >
                      <div className="flex flex-col">
                        <span className="text-[11px] font-semibold text-monokai-fg">纵深树形</span>
                        <span className="text-[9px] text-monokai-comment">90 / 180px 树状</span>
                      </div>
                      <ChevronRight className="w-3 h-3 text-monokai-green" />
                    </button>
                  </div>
                </div>

                {/* 6 大布局算法矩阵 */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className={SECTION_LABEL}>
                      <LayoutGrid className="w-3 h-3 text-monokai-cyan" />
                      本体拓扑布局引擎 (6 种)
                    </span>
                    <span className="text-[9px] text-monokai-comment font-mono">Dagre / Force</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {ONTOLOGY_LAYOUTS.map((layout) => {
                      const detail = LAYOUT_DETAILS[layout.id] || LAYOUT_DETAILS.orthogonal;
                      const isActive = layoutMode === layout.id;

                      return (
                        <button
                          key={layout.id}
                          type="button"
                          data-testid={`ontology-layout-${layout.id}`}
                          onClick={() => {
                            onLayoutModeChange(layout.id);
                            onAutoAlign(nodesep, ranksep, layout.id);
                          }}
                          className={`flex flex-col p-2 rounded-lg border text-left transition-all relative overflow-hidden group ${
                            isActive
                              ? 'bg-monokai-surface border-monokai-cyan text-monokai-fg shadow-[0_0_12px_rgba(102,217,239,0.18)]'
                              : 'bg-monokai-bg/60 border-monokai-border/80 text-monokai-comment hover:text-monokai-fg hover:border-monokai-border-strong hover:bg-monokai-surface/60'
                          }`}
                        >
                          {/* 激活角标 */}
                          {isActive && (
                            <span
                              className="absolute top-0 right-0 w-2 h-2 rounded-bl"
                              style={{ backgroundColor: detail.color }}
                            />
                          )}

                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                              <span style={{ color: detail.color }}>{detail.icon}</span>
                              <span className={`text-[11px] font-bold ${isActive ? 'text-monokai-fg' : 'text-monokai-fg-muted'}`}>
                                {layout.label}布局
                              </span>
                            </div>
                            <span
                              className="text-[8.5px] px-1 py-px rounded font-mono"
                              style={{
                                color: detail.color,
                                backgroundColor: `${detail.color}15`,
                                border: `1px solid ${detail.color}35`,
                              }}
                            >
                              {detail.tag}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mt-1">
                            <LayoutMiniPreview mode={layout.id} isActive={isActive} />
                            <span className="text-[9.5px] text-monokai-comment line-clamp-2 leading-relaxed">
                              {layout.description}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════ TAB 2: 间距微调 ══════════════ */}
            {activeTab === 'spacing' && (
              <div className="space-y-3">
                {/* 层级纵深间距 */}
                <div className={GROUP_CARD}>
                  <div className="flex items-center justify-between">
                    <span className={SECTION_LABEL}>
                      <GitBranch className="w-3 h-3 text-monokai-cyan" />
                      层级纵深间距 (Rank Separation)
                    </span>
                    <span className="text-monokai-cyan font-mono font-bold text-xs bg-monokai-cyan/10 px-1.5 py-0.5 rounded border border-monokai-cyan/30">
                      {ranksep}px
                    </span>
                  </div>

                  <input
                    type="range"
                    min="100"
                    max="500"
                    step="10"
                    value={ranksep}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      onRanksepChange(val);
                      onAutoAlign(nodesep, val, layoutMode);
                    }}
                    className="w-full h-1.5 bg-monokai-surface rounded-lg appearance-none cursor-pointer accent-monokai-cyan focus:outline-none"
                  />

                  {/* 快捷微调档位 */}
                  <div className="flex items-center justify-between pt-0.5">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const val = Math.max(100, ranksep - 20);
                          onRanksepChange(val);
                          onAutoAlign(nodesep, val, layoutMode);
                        }}
                        className="px-1.5 py-0.5 rounded bg-monokai-surface text-[10px] text-monokai-comment hover:text-monokai-fg border border-monokai-border"
                      >
                        -20
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const val = Math.min(500, ranksep + 20);
                          onRanksepChange(val);
                          onAutoAlign(nodesep, val, layoutMode);
                        }}
                        className="px-1.5 py-0.5 rounded bg-monokai-surface text-[10px] text-monokai-comment hover:text-monokai-fg border border-monokai-border"
                      >
                        +20
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      {[140, 200, 300].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => {
                            onRanksepChange(val);
                            onAutoAlign(nodesep, val, layoutMode);
                          }}
                          className={`px-1.5 py-0.5 rounded text-[9.5px] border ${
                            ranksep === val
                              ? 'bg-monokai-cyan/20 border-monokai-cyan text-monokai-cyan'
                              : 'bg-monokai-surface/60 border-monokai-border text-monokai-comment hover:text-monokai-fg'
                          }`}
                        >
                          {val}px
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 同层节点间距 */}
                <div className={GROUP_CARD}>
                  <div className="flex items-center justify-between">
                    <span className={SECTION_LABEL}>
                      <LayoutGrid className="w-3 h-3 text-monokai-green" />
                      同层节点间距 (Node Separation)
                    </span>
                    <span className="text-monokai-green font-mono font-bold text-xs bg-monokai-green/10 px-1.5 py-0.5 rounded border border-monokai-green/30">
                      {nodesep}px
                    </span>
                  </div>

                  <input
                    type="range"
                    min="50"
                    max="300"
                    step="10"
                    value={nodesep}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      onNodesepChange(val);
                      onAutoAlign(val, ranksep, layoutMode);
                    }}
                    className="w-full h-1.5 bg-monokai-surface rounded-lg appearance-none cursor-pointer accent-monokai-green focus:outline-none"
                  />

                  {/* 快捷微调档位 */}
                  <div className="flex items-center justify-between pt-0.5">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const val = Math.max(50, nodesep - 10);
                          onNodesepChange(val);
                          onAutoAlign(val, ranksep, layoutMode);
                        }}
                        className="px-1.5 py-0.5 rounded bg-monokai-surface text-[10px] text-monokai-comment hover:text-monokai-fg border border-monokai-border"
                      >
                        -10
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const val = Math.min(300, nodesep + 10);
                          onNodesepChange(val);
                          onAutoAlign(val, ranksep, layoutMode);
                        }}
                        className="px-1.5 py-0.5 rounded bg-monokai-surface text-[10px] text-monokai-comment hover:text-monokai-fg border border-monokai-border"
                      >
                        +10
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      {[70, 100, 160].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => {
                            onNodesepChange(val);
                            onAutoAlign(val, ranksep, layoutMode);
                          }}
                          className={`px-1.5 py-0.5 rounded text-[9.5px] border ${
                            nodesep === val
                              ? 'bg-monokai-green/20 border-monokai-green text-monokai-green'
                              : 'bg-monokai-surface/60 border-monokai-border text-monokai-comment hover:text-monokai-fg'
                          }`}
                        >
                          {val}px
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 并行线车道间距 */}
                <div className={GROUP_CARD}>
                  <div className="flex items-center justify-between">
                    <span className={SECTION_LABEL}>
                      <Waypoints className="w-3 h-3 text-monokai-orange" />
                      并行连线通道间距 (Lanes Offset)
                    </span>
                    <span className="text-monokai-orange font-mono font-bold text-xs bg-monokai-orange/10 px-1.5 py-0.5 rounded border border-monokai-orange/30">
                      {parallelOffset}px
                    </span>
                  </div>

                  <input
                    type="range"
                    min="15"
                    max="70"
                    step="5"
                    value={parallelOffset}
                    onChange={(e) => onParallelOffsetChange(Number(e.target.value))}
                    className="w-full h-1.5 bg-monokai-surface rounded-lg appearance-none cursor-pointer accent-monokai-orange focus:outline-none"
                  />
                  <div className="text-[9.5px] text-monokai-comment flex justify-between">
                    <span>15px 紧凑通道</span>
                    <span>自动避让重叠折线</span>
                    <span>70px 宽阔通道</span>
                  </div>
                </div>

                {/* 连线路由风格 */}
                <div className={GROUP_CARD}>
                  <span className={SECTION_LABEL}>
                    <Spline className="w-3 h-3 text-monokai-purple" />
                    连线路径风格 (Edge Routing Mode)
                  </span>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => onEdgeRoutingModeChange('straight')}
                      className={`py-2 px-2 rounded-lg border text-center transition-all flex flex-col items-center gap-1 ${
                        edgeRoutingMode === 'straight'
                          ? 'bg-monokai-surface border-monokai-cyan text-monokai-cyan font-bold shadow-sm'
                          : 'bg-monokai-bg/60 border-monokai-border text-monokai-comment hover:text-monokai-fg'
                      }`}
                    >
                      <Minus className="w-4 h-4" />
                      <span className="text-[11px]">极简直线</span>
                      <span className="text-[8.5px] font-normal opacity-70">无拐角直接连通</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onEdgeRoutingModeChange('orthogonal')}
                      className={`py-2 px-2 rounded-lg border text-center transition-all flex flex-col items-center gap-1 ${
                        edgeRoutingMode === 'orthogonal'
                          ? 'bg-monokai-surface border-monokai-green text-monokai-green font-bold shadow-sm'
                          : 'bg-monokai-bg/60 border-monokai-border text-monokai-comment hover:text-monokai-fg'
                      }`}
                    >
                      <Waypoints className="w-4 h-4" />
                      <span className="text-[11px]">圆角正交</span>
                      <span className="text-[8.5px] font-normal opacity-70">90度圆角折线</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onEdgeRoutingModeChange('bezier')}
                      className={`py-2 px-2 rounded-lg border text-center transition-all flex flex-col items-center gap-1 ${
                        edgeRoutingMode === 'bezier'
                          ? 'bg-monokai-surface border-monokai-yellow text-monokai-yellow font-bold shadow-sm'
                          : 'bg-monokai-bg/60 border-monokai-border text-monokai-comment hover:text-monokai-fg'
                      }`}
                    >
                      <Spline className="w-4 h-4" />
                      <span className="text-[11px]">平滑贝塞尔</span>
                      <span className="text-[8.5px] font-normal opacity-70">自然三次曲线</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════ TAB 3: 视图交互 ══════════════ */}
            {activeTab === 'canvas' && (
              <div className="space-y-3">
                {/* 辅助开关列表 */}
                <div className={GROUP_CARD}>
                  <span className={SECTION_LABEL}>
                    <Layers className="w-3 h-3 text-monokai-cyan" />
                    画布视觉与辅助开关
                  </span>

                  <div className="divide-y divide-monokai-border/40 space-y-2">
                    {/* 默认展开实体属性 */}
                    {onToggleExpandAll && (
                      <div className="flex items-center justify-between pt-1.5">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-monokai-fg">默认展开实体属性</span>
                          <span className="text-[9.5px] text-monokai-comment">全量呈现单个实体的字段与属性详情</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isDefaultExpanded}
                            onChange={(e) => onToggleExpandAll(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-monokai-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-monokai-comment after:border-monokai-border-strong after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-monokai-green peer-checked:after:bg-monokai-sidebar peer-checked:after:border-transparent" />
                        </label>
                      </div>
                    )}

                    {/* 聚焦模式 */}
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-monokai-fg">聚焦关联链路 (Focus)</span>
                        <span className="text-[9.5px] text-monokai-comment">仅高亮选中实体及其上下游依赖链路</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isFocusMode}
                          onChange={(e) => onFocusModeChange(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-monokai-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-monokai-comment after:border-monokai-border-strong after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-monokai-green peer-checked:after:bg-monokai-sidebar peer-checked:after:border-transparent" />
                      </label>
                    </div>

                    {/* 网格吸附对齐 */}
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-monokai-fg">网格自动吸附 (Snap to Grid)</span>
                        <span className="text-[9.5px] text-monokai-comment">实体拖拽时自动吸附对齐到网格参考点</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={snapToGrid}
                          onChange={(e) => onSnapToGridChange(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-monokai-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-monokai-comment after:border-monokai-border-strong after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-monokai-green peer-checked:after:bg-monokai-sidebar peer-checked:after:border-transparent" />
                      </label>
                    </div>

                    {/* 背景网格点阵 */}
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-monokai-fg">背景网格点阵</span>
                        <span className="text-[9.5px] text-monokai-comment">显示画布坐标参考点阵背景</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={showGrid}
                          onChange={(e) => onShowGridChange(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-monokai-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-monokai-comment after:border-monokai-border-strong after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-monokai-green peer-checked:after:bg-monokai-sidebar peer-checked:after:border-transparent" />
                      </label>
                    </div>

                    {/* 鹰眼小地图 */}
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-monokai-fg">鹰眼小地图 (MiniMap)</span>
                        <span className="text-[9.5px] text-monokai-comment">右下角显示全图缩略导航指示器</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={showMiniMap}
                          onChange={(e) => onShowMiniMapChange(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-monokai-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-monokai-comment after:border-monokai-border-strong after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-monokai-green peer-checked:after:bg-monokai-sidebar peer-checked:after:border-transparent" />
                      </label>
                    </div>

                    {/* 连线流动动画 */}
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-monokai-fg">连线粒子流向动画</span>
                        <span className="text-[9.5px] text-monokai-comment">动态光点流动提示实体数据/依赖流向</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={animateEdges}
                          onChange={(e) => onAnimateEdgesChange(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-monokai-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-monokai-comment after:border-monokai-border-strong after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-monokai-green peer-checked:after:bg-monokai-sidebar peer-checked:after:border-transparent" />
                      </label>
                    </div>

                    {/* 双击新建实体 */}
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-monokai-fg">双击新建实体节点</span>
                        <span className="text-[9.5px] text-monokai-comment">双击空白区域快速弹出实体建模抽屉</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={enableDbClickCreate}
                          onChange={(e) => onEnableDbClickCreateChange(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-monokai-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-monokai-comment after:border-monokai-border-strong after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-monokai-green peer-checked:after:bg-monokai-sidebar peer-checked:after:border-transparent" />
                      </label>
                    </div>

                    {/* 只读画布模式 */}
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-amber-400">只读画布模式</span>
                        <span className="text-[9.5px] text-monokai-comment">冻结实体拖拽移动与编辑修改</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isReadOnly}
                          onChange={(e) => onIsReadOnlyChange(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-monokai-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-monokai-comment after:border-monokai-border-strong after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-monokai-orange peer-checked:after:bg-monokai-sidebar peer-checked:after:border-transparent" />
                      </label>
                    </div>
                  </div>
                </div>

                {/* 实体锁定批量控制 */}
                <div className={GROUP_CARD}>
                  <div className="flex items-center justify-between">
                    <span className={SECTION_LABEL}>
                      <Lock className="w-3 h-3 text-monokai-yellow" />
                      实体锁定保护
                    </span>
                    <span className="text-[10px] text-monokai-comment">
                      已锁定 <span className="text-monokai-yellow font-bold font-mono">{lockedCount}</span> 个实体
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {onLockAll && (
                      <button
                        type="button"
                        onClick={onLockAll}
                        disabled={isReadOnly}
                        className={`${BTN_SECONDARY} py-1.5 justify-center`}
                      >
                        <Lock className="w-3 h-3 text-monokai-yellow" />
                        <span>全部锁定</span>
                      </button>
                    )}
                    {onUnlockAll && (
                      <button
                        type="button"
                        onClick={onUnlockAll}
                        disabled={isReadOnly || lockedCount === 0}
                        className={`${BTN_SECONDARY} py-1.5 justify-center`}
                      >
                        <Unlock className="w-3 h-3 text-monokai-comment" />
                        <span>解除锁定</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════ TAB 4: 拓扑诊断 ══════════════ */}
            {activeTab === 'diagnostics' && (
              <div className="space-y-3">
                {/* 核心指标卡片 */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-lg bg-monokai-bg/60 border border-monokai-border/80 flex flex-col gap-0.5">
                    <span className="text-[9.5px] text-monokai-comment">实体 / 关系规模</span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-sm font-bold text-monokai-fg font-mono">{nodeCount}</span>
                      <span className="text-[10px] text-monokai-comment">节点</span>
                      <span className="text-monokai-border">/</span>
                      <span className="text-sm font-bold text-monokai-cyan font-mono">{edgeCount}</span>
                      <span className="text-[10px] text-monokai-comment">连线</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-monokai-bg/60 border border-monokai-border/80 flex flex-col gap-0.5">
                    <span className="text-[9.5px] text-monokai-comment">网络密度 (Density)</span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-sm font-bold text-monokai-green font-mono">{diagnostics.density}%</span>
                      <span className="text-[10px] text-monokai-comment">
                        {diagnostics.density > 40 ? '高连通' : diagnostics.density > 15 ? '适中' : '稀疏'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 排版健康评估 */}
                <div className={GROUP_CARD}>
                  <div className="flex items-center justify-between">
                    <span className={SECTION_LABEL}>
                      <ShieldCheck className="w-3 h-3 text-monokai-accent" />
                      本体排版质量评分
                    </span>
                    <span className="text-monokai-accent font-mono font-bold text-xs bg-monokai-accent/10 px-1.5 py-0.5 rounded border border-monokai-accent/30">
                      {diagnostics.score} 分
                    </span>
                  </div>

                  <div className="w-full bg-monokai-surface rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${diagnostics.score}%`,
                        backgroundColor: diagnostics.score >= 80 ? '#a6e22e' : diagnostics.score >= 60 ? '#e6db74' : '#f92672',
                      }}
                    />
                  </div>

                  <div className="text-[10px] text-monokai-comment/90 space-y-1">
                    {diagnostics.isolatedCount > 0 ? (
                      <div className="flex items-center gap-1.5 text-amber-400">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>检测到 {diagnostics.isolatedCount} 个未建立关系的孤立实体</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-monokai-green">
                        <Check className="w-3.5 h-3.5 shrink-0" />
                        <span>所有实体均有效连接，网络拓扑结构完整</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-monokai-comment">
                      <Info className="w-3.5 h-3.5 shrink-0" />
                      <span>当前采用 {currentMeta.label}，间距 {nodesep}x{ranksep}px</span>
                    </div>
                  </div>
                </div>

                {/* 视图全局校准与重排 */}
                <div className={GROUP_CARD}>
                  <span className={SECTION_LABEL}>
                    <RefreshCw className="w-3 h-3 text-monokai-cyan" />
                    全局校准与重排
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    {onFitView && (
                      <button
                        type="button"
                        onClick={onFitView}
                        className={`${BTN_SECONDARY} py-1.5 justify-center`}
                        title="自适应缩放居中当前所有实体"
                      >
                        <Maximize2 className="w-3 h-3 text-monokai-cyan" />
                        <span>自适应居中</span>
                      </button>
                    )}
                    {onResetZoom && (
                      <button
                        type="button"
                        onClick={onResetZoom}
                        className={`${BTN_SECONDARY} py-1.5 justify-center`}
                        title="恢复 100% 原始视角"
                      >
                        <RotateCcw className="w-3 h-3 text-monokai-comment" />
                        <span>复位 100% 视角</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={isReadOnly}
                    onClick={onForceResetLayout}
                    className="w-full py-1.5 rounded bg-monokai-surface border border-monokai-border text-amber-400 hover:bg-amber-500/10 active:scale-98 disabled:opacity-30 disabled:pointer-events-none transition-all text-xs font-medium flex items-center justify-center gap-1.5 mt-1"
                    title="清除所有拖拽的偏移坐标，重新计算Dagre自动布局"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>重置全局网格排版</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── 4. 底部固定工具与状态栏 ── */}
          <div className="shrink-0 px-3 py-2 border-t border-monokai-border/60 bg-monokai-surface/50 flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-1.5 text-monokai-comment truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-monokai-green animate-pulse" />
              <span>实时自动排版就绪</span>
            </div>

            <div className="flex items-center gap-1.5">
              {onFitView && (
                <button
                  type="button"
                  onClick={onFitView}
                  className="px-2 py-1 rounded text-monokai-comment hover:text-monokai-fg hover:bg-monokai-bg/60 transition-colors"
                >
                  适应全图
                </button>
              )}
              <button
                type="button"
                disabled={isReadOnly}
                onClick={() => onAutoAlign(nodesep, ranksep, layoutMode)}
                className={BTN_PRIMARY}
              >
                <Zap className="w-3 h-3" />
                <span>立即重排</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
