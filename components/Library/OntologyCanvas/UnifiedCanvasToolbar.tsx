/**
 * UnifiedCanvasToolbar - 统一画布工具栏 (MECE v4.3 优化版)
 * 
 * 设计原则：
 * 1. MECE互斥且穷尽：将功能分为7个互斥分组
 * 2. 层次清晰：按使用频率和重要性分层
 * 3. 交互一致：统一的视觉语言和交互模式
 * 4. 响应式设计：自适应不同屏幕尺寸
 * 
 * MECE功能分组 v4.3：
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ L1 状态区 (View Status) - 实时显示画布统计信息               │
 * │   - 节点数量、连线数量、当前缩放比例、布局模式               │
 * │   - 批量选择指示器（醒目显示已选数量）                        │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ L2 搜索区 (Search) - 模糊搜索+历史+类型筛选                 │
 * │   - SearchEnhancement集成，支持快速访问                       │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ L3 核心操作区 (Core Operations) - 高频操作                   │
 * │   - 新建实体/关系、撤销/重做、布局预设                      │
 * │   - 布局预设快捷访问按钮                                      │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ L4 视图控制区 (View Controls) - 画布导航                     │
 * │   - 缩放、适应视图、网格、小地图                            │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ L5 状态控制区 (State Controls) - 模式切换                   │
 * │   - 聚焦模式、锁定、只读模式                               │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ L6 批量操作区 (Batch Operations) - 批量选择快速操作          │
 * │   - 全选/反选/清空快捷按钮                                  │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ L7 高级操作区 (Advanced Actions) - 低频操作                  │
 * │   - 导入、导出、DDL、CTE、快捷键                           │
 * └─────────────────────────────────────────────────────────────────┘
 * 
 * v4.3 优化内容：
 * - 添加预设导出功能（导出为JSON文件）
 * - 添加预设导入功能（从JSON文件导入预设）
 * - 添加预设管理面板（查看/删除/重置预设）
 * - 增强布局预设列表显示
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  // L1 状态显示
  Circle, GitBranch, Network, LayoutGrid, LayoutList, CircleDot,
  // 视图控制
  ZoomIn, ZoomOut, Maximize2, RotateCcw, Grid3X3, MapPin,
  // 选择工具
  MousePointer2, Hand, Square, Search, X,
  // 编辑操作
  Plus, Link2, Copy, Clipboard, Trash2, Edit3,
  // 布局
  Sparkles, LayoutList as LayoutIcon, GitBranch as TreeIcon, CircleDot as ForceIcon, Network as RadialIcon, 
  Layers,
  // 连线样式
  Waypoints, Spline, Minus,
  // 数据交互
  Download, Code, Database, GitMerge, Wand2, Save, Upload, Trash2 as DeleteIcon, RefreshCw, FolderOpen,
  // 系统操作
  Settings2, Keyboard, ChevronDown, ChevronUp, Loader2, Check,
  // 状态
  Eye, EyeOff, Lock, Unlock, Eye as FocusIcon,
  // 统计
  Hash, Link2 as LinkIcon, CheckSquare,
  // 辅助
  type LucideIcon,
} from 'lucide-react';
import type { OntologyLayoutMode } from './OntologyLayout';
import type { LayoutPreset } from './hooks/useLayoutPresets';
import { toastService } from '../../../services/toastService';

// ============================================================
// Types & Interfaces
// ============================================================

/** 工具模式 */
export type ToolMode = 'select' | 'pan' | 'box-select';

/** 工具栏属性 */
export interface UnifiedCanvasToolbarProps {
  // L1 状态显示
  nodeCount?: number;
  edgeCount?: number;
  zoom: number;
  layoutMode?: OntologyLayoutMode;
  
  // L2 搜索
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filteredObjects: Array<{ id: number; name: string; object_type_id: number }>;
  objectTypes: Array<{ id: number; name: string }>;
  handleSearchFocus: (id: number) => void;
  
  // L3 缩放控制
  setZoom: (z: number | ((prev: number) => number)) => void;
  handleFitView: () => void;
  handleResetZoom: () => void;
  
  // L4 历史
  handleUndo: () => void;
  handleRedo: () => void;
  undoDisabled: boolean;
  redoDisabled: boolean;
  
  // L5 聚焦与锁定
  isFocusMode: boolean;
  setIsFocusMode: React.Dispatch<React.SetStateAction<boolean>>;
  handleLockAll: () => void;
  handleUnlockAll: () => void;
  
  // L6 布局
  handleAutoAlign: (mode?: OntologyLayoutMode) => void;
  setLayoutMode: (mode: OntologyLayoutMode) => void;
  nodesep: number;
  ranksep: number;
  edgeRoutingMode: 'straight' | 'orthogonal' | 'bezier';
  setEdgeRoutingMode: (mode: 'straight' | 'orthogonal' | 'bezier') => void;
  setNodesep: (v: number) => void;
  setRanksep: (v: number) => void;
  
  // L7 布局预设
  layoutPresets?: LayoutPreset[];
  activePresetId?: string | null;
  onApplyPreset?: (id: string) => void;
  onSavePreset?: (name: string) => void;
  onDeletePreset?: (id: string) => void;
  onExportPresets?: () => void;
  onImportPresets?: (presets: LayoutPreset[]) => void;
  onResetPresets?: () => void;
  
  // L8 数据操作
  onExport: (format: 'png' | 'jpeg' | 'svg') => void;
  onGenerateDDL?: () => void;
  onCompileCTE?: () => void;
  onImportTable?: () => void;
  onReverseInferSchema?: () => void;
  
  // L9 工具模式
  toolMode?: ToolMode;
  onToolModeChange?: (mode: ToolMode) => void;
  
  // L10 画布状态
  showGrid?: boolean;
  onToggleGrid?: () => void;
  showMiniMap?: boolean;
  onToggleMiniMap?: () => void;
  isReadOnly?: boolean;
  onToggleReadOnly?: () => void;
  
  // L11 批量选择
  selectedNodeCount?: number;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  onSelectInverse?: () => void;
  onOpenBatchWorkbench?: () => void;
  
  // L12 快捷键
  onShowShortcuts?: () => void;
  
  // L13 新建操作
  onNewNode?: () => void;
  onNewLink?: () => void;
  
  // L14 只读禁用
  isOperationDisabled?: boolean;
  
  // L15 布局预设快速访问
  recentPresets?: LayoutPreset[];
}

// ============================================================
// Constants
// ============================================================

/** 工具模式定义 */
const TOOL_MODES: Array<{ id: ToolMode; icon: LucideIcon; label: string; shortcut: string }> = [
  { id: 'select', icon: MousePointer2, label: '选择', shortcut: 'V' },
  { id: 'pan', icon: Hand, label: '平移', shortcut: 'H' },
  { id: 'box-select', icon: Square, label: '框选', shortcut: 'B' },
];

/** 布局图标映射 */
const LAYOUT_ICONS: Record<OntologyLayoutMode, { icon: LucideIcon; label: string; color: string }> = {
  hierarchical: { icon: LayoutList, label: '层级', color: '#66d9ef' },
  tree: { icon: GitBranch, label: '树形', color: '#a6e22e' },
  force: { icon: CircleDot, label: '力导向', color: '#f92672' },
  radial: { icon: Network, label: '放射', color: '#fd971f' },
  circular: { icon: LayoutGrid, label: '环形', color: '#ae81ff' },
  orthogonal: { icon: Waypoints, label: '正交', color: '#66d9ef' },
};

/** 连线路由模式 */
const EDGE_ROUTING_MODES: Array<{
  id: 'straight' | 'orthogonal' | 'bezier';
  icon: LucideIcon;
  label: string;
  color: string;
}> = [
  { id: 'straight', icon: Minus, label: '直线', color: '#a1a1aa' },
  { id: 'orthogonal', icon: Waypoints, label: '正交', color: '#66d9ef' },
  { id: 'bezier', icon: Spline, label: '曲线', color: '#a6e22e' },
];

// ============================================================
// Sub-Components
// ============================================================

/** 分隔线 */
const Divider: React.FC<{ vertical?: boolean }> = ({ vertical = true }) => (
  <div className={vertical ? 'h-5 w-px bg-monokai-border mx-1' : 'h-px w-full bg-monokai-border my-2'} />
);

/** 统计徽章组件 */
const StatBadge: React.FC<{
  icon: LucideIcon;
  value: number;
  label: string;
  color: string;
}> = ({ icon: Icon, value, label, color }) => (
  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-monokai-bg/50 border border-monokai-border/50">
    <Icon className="w-3.5 h-3.5" style={{ color }} />
    <span className="text-[10px] font-mono font-medium text-monokai-fg">{value}</span>
    <span className="text-[9px] text-monokai-comment hidden sm:inline">{label}</span>
  </div>
);

/** 工具按钮 */
interface ToolButtonProps {
  icon: LucideIcon;
  label?: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md';
  onClick: () => void;
  title?: string;
  style?: React.CSSProperties;
}

const ToolButton: React.FC<ToolButtonProps> = ({
  icon: Icon,
  label,
  shortcut,
  active = false,
  disabled = false,
  loading = false,
  variant = 'default',
  size = 'md',
  onClick,
  title,
  style,
}) => {
  const sizeClasses = size === 'sm' ? 'p-1.5' : 'p-2';
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  
  const variantClasses = {
    default: active
      ? 'bg-monokai-cyan/20 text-monokai-cyan border border-monokai-cyan/30'
      : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/60 border border-transparent',
    primary: 'bg-monokai-blue text-monokai-bg font-medium hover:bg-monokai-blue/90 border border-transparent',
    success: 'bg-monokai-green text-monokai-bg font-medium hover:bg-monokai-green/90 border border-transparent',
    warning: 'bg-monokai-warning/20 text-monokai-warning border border-monokai-warning/30 hover:bg-monokai-warning/30',
    danger: 'bg-monokai-danger/20 text-monokai-danger border border-monokai-danger/30 hover:bg-monokai-danger/30',
  };
  
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={style}
      title={title || (shortcut ? `${label || ''} (${shortcut})` : label)}
      className={`
        relative flex items-center gap-1.5 ${sizeClasses} rounded-lg border text-xs font-medium
        transition-all duration-150 cursor-pointer select-none
        disabled:opacity-40 disabled:cursor-not-allowed
        active:scale-95
        ${variantClasses[variant]}
      `}
    >
      {loading ? (
        <Loader2 className={`${iconSize} animate-spin`} />
      ) : (
        <Icon className={iconSize} />
      )}
      {label && <span className={size === 'sm' ? 'hidden' : ''}>{label}</span>}
      {shortcut && !active && size !== 'sm' && (
        <span className="text-[9px] font-mono opacity-60">{shortcut}</span>
      )}
    </button>
  );
};

/** 下拉菜单包装器 */
interface DropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'left' | 'right';
  width?: string;
}

const Dropdown: React.FC<DropdownProps> = ({ trigger, children, align = 'right', width = 'w-48' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  return (
    <div ref={ref} className="relative">
      <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>
      {isOpen && (
        <div
          className={`absolute top-full ${align === 'right' ? 'right-0' : 'left-0'} mt-1.5 ${width} 
            bg-monokai-surface border border-monokai-border rounded-lg shadow-xl overflow-hidden z-50
            animate-in fade-in slide-in-from-top-2 duration-150`}
          onClick={() => setIsOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
};

/** 布局预设按钮 */
const LayoutPresetButton: React.FC<{
  preset: LayoutPreset;
  isActive: boolean;
  onClick: () => void;
}> = ({ preset, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`
      w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors rounded-lg mx-1 my-0.5
      ${isActive
        ? 'bg-monokai-accent/15 text-monokai-accent'
        : 'text-monokai-fg hover:bg-monokai-elevated'
      }
    `}
  >
    {isActive && <Check className="w-3 h-3" />}
    <span className="flex-1 text-left">{preset.name}</span>
    {preset.builtIn && (
      <span className="text-[8px] text-monokai-comment bg-monokai-bg px-1 py-0.5 rounded">内置</span>
    )}
  </button>
);

// ============================================================
// Main Component
// ============================================================

export const UnifiedCanvasToolbar: React.FC<UnifiedCanvasToolbarProps> = ({
  // L1 状态显示
  nodeCount = 0,
  edgeCount = 0,
  zoom,
  layoutMode = 'orthogonal',
  
  // L2 搜索
  searchQuery,
  setSearchQuery,
  filteredObjects,
  objectTypes,
  handleSearchFocus,
  
  // L3 缩放控制
  setZoom,
  handleFitView,
  handleResetZoom,
  
  // L4 历史
  handleUndo,
  handleRedo,
  undoDisabled,
  redoDisabled,
  
  // L5 聚焦与锁定
  isFocusMode,
  setIsFocusMode,
  handleLockAll,
  handleUnlockAll,
  
  // L6 布局
  handleAutoAlign,
  setLayoutMode,
  nodesep,
  ranksep,
  edgeRoutingMode,
  setEdgeRoutingMode,
  setNodesep,
  setRanksep,
  
  // L7 布局预设
  layoutPresets = [],
  activePresetId,
  onApplyPreset,
  onSavePreset,
  onDeletePreset,
  onExportPresets,
  onImportPresets,
  onResetPresets,
  
  // L8 数据操作
  onExport,
  onGenerateDDL,
  onCompileCTE,
  onImportTable,
  onReverseInferSchema,
  
  // L9 工具模式
  toolMode = 'select',
  onToolModeChange,
  
  // L10 画布状态
  showGrid = true,
  onToggleGrid,
  showMiniMap = true,
  onToggleMiniMap,
  isReadOnly = false,
  onToggleReadOnly,
  
  // L11 批量选择
  selectedNodeCount = 0,
  onSelectAll,
  onClearSelection,
  onSelectInverse,
  onOpenBatchWorkbench,
  
  // L12 快捷键
  onShowShortcuts,
  
  // L13 新建操作
  onNewNode,
  onNewLink,
  
  // L14 只读禁用
  isOperationDisabled = false,
  
  // L15 布局预设快速访问
  recentPresets = [],
}) => {
  // 窗口尺寸检测
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1400);
  
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // 响应式断点
  const isLargeScreen = windowWidth >= 1400;
  const isMediumScreen = windowWidth >= 1024 && windowWidth < 1400;
  const isSmallScreen = windowWidth < 1024;
  const isCompactMode = windowWidth < 768;
  
  // 菜单状态
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showLayoutDropdown, setShowLayoutDropdown] = useState(false);
  const [showToolDropdown, setShowToolDropdown] = useState(false);
  
  // Refs
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  
  // 关闭菜单
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) {
        setShowActionsMenu(false);
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  
  // 获取当前工具
  const currentTool = useMemo(() =>
    TOOL_MODES.find(t => t.id === toolMode) || TOOL_MODES[0],
    [toolMode]
  );
  
  // 获取当前布局配置
  const currentLayout = LAYOUT_ICONS[layoutMode] || LAYOUT_ICONS.hierarchical;
  const CurrentLayoutIcon = currentLayout.icon;
  
  // 获取当前连线样式
  const currentEdgeStyle = useMemo(() =>
    EDGE_ROUTING_MODES.find(m => m.id === edgeRoutingMode) || EDGE_ROUTING_MODES[0],
    [edgeRoutingMode]
  );
  
  // 循环切换连线样式
  const cycleEdgeRouting = useCallback(() => {
    const modes: Array<'straight' | 'orthogonal' | 'bezier'> = ['straight', 'orthogonal', 'bezier'];
    const currentIndex = modes.indexOf(edgeRoutingMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setEdgeRoutingMode(modes[nextIndex]);
  }, [edgeRoutingMode, setEdgeRoutingMode]);
  
  // 循环切换布局
  const cycleLayoutMode = useCallback(() => {
    const modes: OntologyLayoutMode[] = ['orthogonal', 'hierarchical', 'tree', 'force', 'radial', 'circular'];
    const currentIndex = modes.indexOf(layoutMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    const nextMode = modes[nextIndex];
    setLayoutMode(nextMode);
    handleAutoAlign(nextMode);
  }, [layoutMode, setLayoutMode, handleAutoAlign]);
  
  // 保存预设回调
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);
  const [presetName, setPresetName] = useState('');
  
  const handleSavePresetConfirm = () => {
    if (presetName.trim() && onSavePreset) {
      onSavePreset(presetName.trim());
      setPresetName('');
      setShowSavePresetModal(false);
    }
  };
  
  return (
    <div className="absolute top-3 left-3 right-3 z-20 pointer-events-none flex items-center justify-between gap-3">
      
      {/* ═══════════════════════════════════════════════════════════════════════════
          L1 状态区 + L2 搜索区 (左侧)
          ═══════════════════════════════════════════════════════════════════════════ */}
      <div className="pointer-events-auto flex items-center gap-2">
        
        {/* L1 状态区：统计信息 */}
        <div className="flex items-center gap-1 bg-monokai-sidebar/95 backdrop-blur-md border border-monokai-border rounded-xl px-2 py-1 shadow-lg">
          <StatBadge icon={Circle} value={nodeCount} label="节点" color="#66d9ef" />
          <Divider />
          <StatBadge icon={LinkIcon} value={edgeCount} label="连线" color="#a6e22e" />
          <Divider />
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-monokai-bg/50 border border-monokai-border/50">
            <CurrentLayoutIcon className="w-3.5 h-3.5" style={{ color: currentLayout.color }} />
            <span className="text-[10px] font-mono text-monokai-fg">{currentLayout.label}</span>
          </div>
        </div>
        
        {/* L2 搜索框 */}
        <div className="relative group">
          <div className={`
            flex items-center gap-2 bg-monokai-sidebar/95 backdrop-blur-md border rounded-xl px-3 py-1.5
            transition-all duration-200 shadow-lg
            ${searchQuery ? 'border-monokai-accent ring-1 ring-monokai-accent/30' : 'border-monokai-border'}
          `}>
            <Search className="w-4 h-4 text-monokai-comment shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索实体..."
              className="bg-transparent border-none text-xs text-monokai-fg placeholder-monokai-comment/60 
                focus:outline-none w-40 font-mono"
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="text-monokai-comment hover:text-monokai-fg transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            ) : (
              <kbd className="text-[9px] font-mono text-monokai-comment/50 bg-monokai-bg px-1 py-0.5 rounded border border-monokai-border">
                /
              </kbd>
            )}
          </div>
          
          {/* 搜索结果下拉 */}
          {searchQuery && filteredObjects.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-monokai-surface border border-monokai-border 
              rounded-lg shadow-xl overflow-hidden max-h-56 overflow-y-auto custom-scrollbar z-50">
              {filteredObjects.slice(0, 8).map((obj) => {
                const typeName = objectTypes.find(t => t.id === obj.object_type_id)?.name || '实体';
                return (
                  <button
                    key={obj.id}
                    onClick={() => {
                      handleSearchFocus(obj.id);
                      setSearchQuery('');
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-monokai-elevated flex items-center justify-between transition-colors"
                  >
                    <span className="font-medium text-monokai-fg truncate">{obj.name}</span>
                    <span className="text-[10px] text-monokai-cyan font-mono ml-2 shrink-0 bg-monokai-bg px-1.5 py-0.5 rounded">
                      {typeName}
                    </span>
                  </button>
                );
              })}
              {filteredObjects.length > 8 && (
                <div className="px-3 py-2 text-[10px] text-monokai-comment text-center border-t border-monokai-border">
                  还有 {filteredObjects.length - 8} 个结果...
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* 工具选择器 */}
        {onToolModeChange && (
          <Dropdown
            trigger={
              <button
                className={`
                  flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium
                  transition-all duration-150
                  ${showToolDropdown
                    ? 'bg-monokai-surface border-monokai-accent text-monokai-accent'
                    : 'bg-monokai-sidebar/95 border-monokai-border text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface'
                  }
                `}
              >
                <currentTool.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{currentTool.label}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showToolDropdown ? 'rotate-180' : ''}`} />
              </button>
            }
            align="left"
            width="w-44"
          >
            {TOOL_MODES.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.id}
                  onClick={() => {
                    onToolModeChange(tool.id);
                    setShowToolDropdown(false);
                  }}
                  className={`
                    w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors
                    ${toolMode === tool.id
                      ? 'bg-monokai-accent/15 text-monokai-accent'
                      : 'text-monokai-fg hover:bg-monokai-elevated'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span className="flex-1 text-left">{tool.label}</span>
                  <kbd className="text-[9px] font-mono text-monokai-comment bg-monokai-bg px-1.5 py-0.5 rounded border border-monokai-border">
                    {tool.shortcut}
                  </kbd>
                </button>
              );
            })}
          </Dropdown>
        )}
        
        {/* 批量选择指示器 - v4.1 醒目增强版 */}
        {selectedNodeCount > 0 && (
          <>
            <Divider />
            <div className="flex items-center gap-1.5 px-3 py-2 
              bg-monokai-surface/95 border border-monokai-accent/40 rounded-xl 
              shadow-lg backdrop-blur-md transition-all duration-200
              hover:border-monokai-accent/60 hover:shadow-xl
              animate-pulse-subtle">
              {/* 选中数量 - 更醒目的设计 */}
              <div className="flex items-center justify-center min-w-[32px] h-7 px-2 rounded-lg 
                bg-gradient-to-br from-monokai-accent to-monokai-accent/80 
                text-monokai-bg font-bold text-sm shadow-lg">
                {selectedNodeCount}
              </div>
              <span className="text-xs text-monokai-accent font-semibold mr-1">已选</span>
              
              {/* 快速操作按钮 */}
              <div className="flex items-center gap-0.5">
                <button
                  onClick={onSelectAll}
                  className="p-1.5 rounded-md text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/80 transition-all duration-150"
                  title="全选 (Ctrl+A)"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                </button>
                {onSelectInverse && (
                  <button
                    onClick={onSelectInverse}
                    className="p-1.5 rounded-md text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/80 transition-all duration-150"
                    title="反选"
                  >
                    <Square className="w-3.5 h-3.5" />
                  </button>
                )}
                {onClearSelection && (
                  <button
                    onClick={onClearSelection}
                    className="p-1.5 rounded-md text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/80 transition-all duration-150"
                    title="清空选择 (Esc)"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              
              {/* 批量工作台快捷入口 - v4.1增强 */}
              {onOpenBatchWorkbench && (
                <>
                  <div className="w-px h-4 bg-monokai-accent/30 mx-0.5" />
                  <button
                    onClick={onOpenBatchWorkbench}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg 
                      bg-monokai-accent/20 border border-monokai-accent/30 
                      text-monokai-accent hover:bg-monokai-accent/30 hover:border-monokai-accent/50 
                      transition-all duration-150 text-xs font-medium shadow-md"
                    title="打开批量工作台 (Ctrl+B)"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    {!isCompactMode && <span>批量编辑</span>}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
      
      {/* ═══════════════════════════════════════════════════════════════════════════
          L3 核心操作区 + L4 视图控制区 (中间)
          ═══════════════════════════════════════════════════════════════════════════ */}
      <div className="pointer-events-auto flex items-center gap-1.5 bg-monokai-sidebar/95 backdrop-blur-md 
        border border-monokai-border rounded-xl px-2 py-1.5 shadow-lg">
        
        {/* 新建实体 */}
        <ToolButton
          icon={Plus}
          label="实体"
          variant="primary"
          onClick={() => onNewNode?.()}
          disabled={isOperationDisabled || isReadOnly}
        />

        {/* 新建关系 */}
        <ToolButton
          icon={Link2}
          label="关系"
          onClick={() => onNewLink?.()}
          disabled={isOperationDisabled || isReadOnly}
        />

        <Divider />

        {/* 撤销/重做 */}
        <ToolButton
          icon={RotateCcw}
          label="撤销"
          shortcut="Ctrl+Z"
          onClick={handleUndo}
          disabled={undoDisabled || isReadOnly}
        />
        <ToolButton
          icon={RotateCcw}
          label="重做"
          shortcut="Ctrl+Y"
          onClick={handleRedo}
          disabled={redoDisabled || isReadOnly}
          style={{ transform: 'scaleX(-1)' } as React.CSSProperties}
        />

        <Divider />

        {/* 布局预设下拉 - 增强版 v4.0 */}
        <Dropdown
          trigger={
            <button
              className={`
                flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs font-medium
                transition-all duration-150
                ${showLayoutDropdown
                  ? 'bg-monokai-surface border-monokai-yellow/40 text-monokai-yellow'
                  : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface border-transparent'
                }
              `}
            >
              <CurrentLayoutIcon className="w-3.5 h-3.5" style={{ color: currentLayout.color }} />
              {!isSmallScreen && <span className="hidden lg:inline">{currentLayout.label}</span>}
              <ChevronDown className={`w-3 h-3 transition-transform ${showLayoutDropdown ? 'rotate-180' : ''}`} />
            </button>
          }
          align="left"
          width="w-56"
        >
          {/* 布局模式选择 */}
          <div className="px-2 py-1 text-[9px] font-semibold text-monokai-comment uppercase tracking-wider">
            布局模式
          </div>
          {(Object.entries(LAYOUT_ICONS) as [OntologyLayoutMode, { icon: LucideIcon; label: string; color: string }][]).map(([mode, config]) => {
            const Icon = config.icon;
            return (
              <button
                key={mode}
                onClick={() => {
                  setLayoutMode(mode);
                  handleAutoAlign(mode);
                  setShowLayoutDropdown(false);
                }}
                className={`
                  w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors rounded-lg mx-1 my-0.5
                  ${layoutMode === mode
                    ? 'bg-monokai-accent/15 text-monokai-accent'
                    : 'text-monokai-fg hover:bg-monokai-elevated'
                  }
                `}
              >
                <Icon className="w-4 h-4" style={{ color: config.color }} />
                <span className="flex-1 text-left">{config.label}</span>
                {layoutMode === mode && <Check className="w-3 h-3" />}
              </button>
            );
          })}
          
          {/* 最近使用的预设 - v4.0新增 */}
          {recentPresets.length > 0 && (
            <>
              <div className="h-px bg-monokai-border my-1" />
              <div className="px-2 py-1 text-[9px] font-semibold text-monokai-comment uppercase tracking-wider">
                最近使用
              </div>
              {recentPresets.slice(0, 3).map((preset) => (
                <LayoutPresetButton
                  key={preset.id}
                  preset={preset}
                  isActive={activePresetId === preset.id}
                  onClick={() => {
                    onApplyPreset?.(preset.id);
                    setShowLayoutDropdown(false);
                  }}
                />
              ))}
            </>
          )}
          
          {/* 全部布局预设 */}
          {layoutPresets.length > 0 && (
            <>
              <div className="h-px bg-monokai-border my-1" />
              <div className="px-2 py-1 text-[9px] font-semibold text-monokai-comment uppercase tracking-wider">
                全部预设 ({layoutPresets.length})
              </div>
              {layoutPresets.slice(0, 5).map((preset) => (
                <LayoutPresetButton
                  key={preset.id}
                  preset={preset}
                  isActive={activePresetId === preset.id}
                  onClick={() => {
                    onApplyPreset?.(preset.id);
                    setShowLayoutDropdown(false);
                  }}
                />
              ))}
            </>
          )}
          
          {/* v4.3: 预设管理操作 */}
          <div className="h-px bg-monokai-border my-1" />
          <div className="px-3 py-1 space-y-1">
            {/* 导入预设 */}
            <button
              onClick={() => {
                // 触发隐藏的文件输入
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.onchange = async (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (!file) return;
                  try {
                    const text = await file.text();
                    const data = JSON.parse(text);
                    // 兼容单预设和多预设数组格式
                    if (data.presets && Array.isArray(data.presets)) {
                      onImportPresets?.(data.presets);
                      toastService.success(`成功导入 ${data.presets.length} 个布局预设`);
                    } else if (data.id && data.config) {
                      onImportPresets?.([data]);
                      toastService.success('成功导入 1 个布局预设');
                    } else {
                      toastService.error('导入失败：文件中未包含有效布局预设格式');
                    }
                  } catch (err) {
                    console.error('Failed to import presets:', err);
                    toastService.error('导入失败：无效的文件格式');
                  }
                };
                input.click();
                setShowLayoutDropdown(false);
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-[10px] text-monokai-fg 
                bg-monokai-bg hover:bg-monokai-surface rounded-lg transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-monokai-green" />
              <span>导入预设</span>
            </button>
            
            {/* 导出预设 */}
            <button
              onClick={() => {
                onExportPresets?.();
                setShowLayoutDropdown(false);
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-[10px] text-monokai-fg 
                bg-monokai-bg hover:bg-monokai-surface rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-monokai-blue" />
              <span>导出全部预设</span>
            </button>
            
            {/* 重置预设 */}
            {onResetPresets && (
              <button
                onClick={() => {
                  if (confirm('确定要重置所有自定义预设吗？内置预设不会被删除。')) {
                    onResetPresets?.();
                  }
                  setShowLayoutDropdown(false);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-[10px] text-monokai-orange 
                  bg-monokai-bg hover:bg-monokai-surface rounded-lg transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>重置预设</span>
              </button>
            )}
          </div>
        </Dropdown>
        
        {/* 自动布局按钮 */}
        <ToolButton
          icon={Sparkles}
          label="重排"
          onClick={() => handleAutoAlign(layoutMode)}
          disabled={isOperationDisabled}
        />

        <Divider />

        {/* 连线风格 */}
        <button
          onClick={cycleEdgeRouting}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-transparent text-xs font-medium transition-all duration-150"
          style={{ color: currentEdgeStyle.color }}
          title={`连线风格: ${currentEdgeStyle.label} (点击切换)`}
        >
          <currentEdgeStyle.icon className="w-3.5 h-3.5" />
        </button>
      </div>
      
      {/* ═══════════════════════════════════════════════════════════════════════════
          L4 视图控制 + L5 状态控制 + L6 高级操作 (右侧)
          ═══════════════════════════════════════════════════════════════════════════ */}
      <div className="pointer-events-auto flex items-center gap-2">
        
        {/* L4 视图控制组 - 响应式优化 v4.0 */}
        <div className="flex items-center gap-1 bg-monokai-sidebar/95 backdrop-blur-md 
          border border-monokai-border rounded-xl px-2 py-1.5 shadow-lg">
          
          {/* 缩放控制 */}
          <ToolButton
            icon={ZoomOut}
            size="sm"
            onClick={() => setZoom(Math.max(0.1, zoom - 0.15))}
          />
          <div className="w-14 text-center">
            <span className="text-xs font-mono text-monokai-comment cursor-pointer hover:text-monokai-fg transition-colors"
              onClick={handleResetZoom}
              title="点击重置缩放"
            >
              {Math.round(zoom * 100)}%
            </span>
          </div>
          <ToolButton
            icon={ZoomIn}
            size="sm"
            onClick={() => setZoom(Math.min(4.0, zoom + 0.15))}
          />
          
          {!isSmallScreen && <Divider />}
          
          {/* 适应屏幕 */}
          <ToolButton
            icon={Maximize2}
            size="sm"
            onClick={handleFitView}
            title="适应视图 (1)"
          />
          
          {/* 重置缩放 - 小屏幕隐藏 */}
          {!isSmallScreen && (
            <ToolButton
              icon={RotateCcw}
              size="sm"
              onClick={handleResetZoom}
              title="重置缩放 (0)"
            />
          )}

          {!isSmallScreen && <Divider />}

          {/* 网格 - 小屏幕改为图标模式 */}
          {onToggleGrid && (
            <ToolButton
              icon={Grid3X3}
              active={showGrid}
              size="sm"
              onClick={onToggleGrid}
              title="切换网格 (G)"
            />
          )}

          {/* 小地图 */}
          {onToggleMiniMap && (
            <ToolButton
              icon={MapPin}
              active={showMiniMap}
              size="sm"
              onClick={onToggleMiniMap}
              title="切换小地图 (M)"
            />
          )}
        </div>

        {/* L5 状态切换组 - 紧凑模式优化 v4.0 */}
        <div className="flex items-center gap-1 bg-monokai-sidebar/95 backdrop-blur-md 
          border border-monokai-border rounded-xl px-2 py-1.5 shadow-lg">
          
          {/* 聚焦模式 - 小屏幕隐藏文字 */}
          <ToolButton
            icon={FocusIcon}
            active={isFocusMode}
            onClick={() => setIsFocusMode(v => !v)}
            size="sm"
            title="聚焦模式"
          />
          {!isSmallScreen && (
            <span className="text-[10px] text-monokai-comment mr-1">聚焦</span>
          )}
          
          {/* 锁定 */}
          <ToolButton
            icon={Lock}
            onClick={handleLockAll}
            size="sm"
            title="锁定所有节点"
            disabled={isOperationDisabled || isReadOnly}
          />
          
          {/* 解锁 */}
          <ToolButton
            icon={Unlock}
            onClick={handleUnlockAll}
            size="sm"
            title="解锁所有节点"
            disabled={isOperationDisabled || isReadOnly}
          />

          {!isSmallScreen && <Divider />}

          {/* 只读模式 */}
          {onToggleReadOnly && (
            <ToolButton
              icon={isReadOnly ? EyeOff : Eye}
              active={isReadOnly}
              variant={isReadOnly ? 'warning' : 'default'}
              onClick={onToggleReadOnly}
              size="sm"
              title={isReadOnly ? '退出只读模式' : '进入只读模式 (Ctrl+Shift+R)'}
            />
          )}
          
          {/* 快捷键帮助 - 小屏幕隐藏文字 */}
          {onShowShortcuts && (
            <ToolButton
              icon={Keyboard}
              size="sm"
              onClick={onShowShortcuts}
              title="快捷键帮助 (?)"
            />
          )}
          {!isSmallScreen && onShowShortcuts && (
            <span className="text-[10px] text-monokai-comment ml-1">帮助</span>
          )}
        </div>

        {/* L6 高级操作菜单 - 紧凑模式优化 v4.0 */}
        <div ref={actionsMenuRef} className="relative">
          <button
            onClick={() => setShowActionsMenu(v => !v)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium
              transition-all duration-150 shadow-lg backdrop-blur-md
              ${showActionsMenu
                ? 'bg-monokai-surface border-monokai-accent text-monokai-fg'
                : 'bg-monokai-sidebar/95 border-monokai-border text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface'
              }
            `}
          >
            <Settings2 className="w-4 h-4" />
            {!isCompactMode && <span>操作</span>}
            <ChevronDown className={`w-3 h-3 transition-transform ${showActionsMenu ? 'rotate-180' : ''}`} />
          </button>

          {showActionsMenu && (
            <div className="absolute top-full right-0 mt-1.5 w-64 bg-monokai-surface border border-monokai-border 
              rounded-lg shadow-xl overflow-hidden z-50 p-1 animate-in fade-in slide-in-from-top-2 duration-150">
              
              {/* DDL 生成 */}
              {onGenerateDDL && (
                <button
                  onClick={() => { onGenerateDDL(); setShowActionsMenu(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-monokai-fg 
                    hover:bg-monokai-elevated rounded-md transition-colors"
                >
                  <Code className="w-4 h-4 text-monokai-cyan shrink-0" />
                  <div className="text-left">
                    <div className="font-medium">生成 SQL DDL</div>
                    <div className="text-[10px] text-monokai-comment">将实体转为建表语句</div>
                  </div>
                </button>
              )}

              {/* 编译 CTE */}
              {onCompileCTE && (
                <button
                  onClick={() => { onCompileCTE(); setShowActionsMenu(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-monokai-fg 
                    hover:bg-monokai-elevated rounded-md transition-colors"
                >
                  <GitMerge className="w-4 h-4 text-monokai-green shrink-0" />
                  <div className="text-left">
                    <div className="font-medium">编译 CTE</div>
                    <div className="text-[10px] text-monokai-comment">生成 DuckDB CTE 视图</div>
                  </div>
                </button>
              )}

              <div className="h-px bg-monokai-border my-1" />

              {/* 导入物理表 */}
              {onImportTable && (
                <button
                  onClick={() => { onImportTable(); setShowActionsMenu(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-monokai-fg 
                    hover:bg-monokai-elevated rounded-md transition-colors"
                >
                  <Database className="w-4 h-4 text-monokai-orange shrink-0" />
                  <div className="text-left">
                    <div className="font-medium">导入物理表</div>
                    <div className="text-[10px] text-monokai-comment">从 DuckDB 导入单张表</div>
                  </div>
                </button>
              )}

              {/* 反向工程 */}
              {onReverseInferSchema && (
                <button
                  onClick={() => { onReverseInferSchema(); setShowActionsMenu(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-monokai-fg 
                    hover:bg-monokai-elevated rounded-md transition-colors"
                >
                  <Wand2 className="w-4 h-4 text-monokai-yellow shrink-0" />
                  <div className="text-left">
                    <div className="font-medium">反向工程</div>
                    <div className="text-[10px] text-monokai-comment">批量扫描数据库还原</div>
                  </div>
                </button>
              )}

              <div className="h-px bg-monokai-border my-1" />

              {/* 导出子菜单 */}
              <div ref={exportMenuRef} className="relative">
                <button
                  onClick={() => setShowExportMenu(v => !v)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-monokai-fg 
                    hover:bg-monokai-elevated rounded-md transition-colors"
                >
                  <Download className="w-4 h-4 text-monokai-comment shrink-0" />
                  <div className="flex-1 text-left">
                    <div className="font-medium">导出图像</div>
                    <div className="text-[10px] text-monokai-comment">PNG / JPEG / SVG</div>
                  </div>
                  <ChevronDown className={`w-3 h-3 text-monokai-comment transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
                </button>

                {showExportMenu && (
                  <div className="absolute left-full top-0 ml-1 w-40 bg-monokai-sidebar border border-monokai-border 
                    rounded-lg shadow-xl overflow-hidden">
                    {(['png', 'jpeg', 'svg'] as const).map(fmt => (
                      <button
                        key={fmt}
                        onClick={() => { onExport(fmt); setShowActionsMenu(false); setShowExportMenu(false); }}
                        className="w-full text-left px-3 py-2 text-xs text-monokai-fg hover:bg-monokai-elevated transition-colors"
                      >
                        <span className="font-mono text-[10px] text-monokai-cyan font-bold uppercase mr-2">{fmt}</span>
                        {fmt === 'png' ? '高清位图' : fmt === 'jpeg' ? '压缩位图' : '矢量图'}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="h-px bg-monokai-border my-1" />

              {/* 保存当前布局 */}
              <button
                onClick={() => { setShowSavePresetModal(true); setShowActionsMenu(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-monokai-fg 
                  hover:bg-monokai-elevated rounded-md transition-colors"
              >
                <Save className="w-4 h-4 text-monokai-pink shrink-0" />
                <div className="text-left">
                  <div className="font-medium">保存当前布局</div>
                  <div className="text-[10px] text-monokai-comment">保存为新预设</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* 保存预设模态框 */}
      {showSavePresetModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
          <div className="bg-monokai-surface border border-monokai-border rounded-xl p-4 w-80 shadow-2xl">
            <h3 className="text-sm font-semibold text-monokai-fg mb-3">保存布局预设</h3>
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="输入预设名称..."
              className="w-full px-3 py-2 bg-monokai-bg border border-monokai-border rounded-lg text-xs text-monokai-fg 
                focus:outline-none focus:border-monokai-accent mb-3"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSavePresetModal(false)}
                className="px-3 py-1.5 text-xs text-monokai-comment hover:text-monokai-fg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSavePresetConfirm}
                disabled={!presetName.trim()}
                className="px-3 py-1.5 text-xs bg-monokai-accent text-monokai-bg rounded-lg hover:brightness-110 
                  transition-all disabled:opacity-50"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnifiedCanvasToolbar;
