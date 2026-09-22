/**
 * CanvasContextMenu - 实体画布上下文菜单 (MECE v4.1 优化版)
 * 
 * MECE设计目标：
 * 1. 节点菜单：编辑、复制、删除、锁定、创建连线、批量操作
 * 2. 连线菜单：编辑、删除、反转、高亮路径、属性设置
 * 3. 画布菜单：新建、粘贴、选择、视图控制、布局、快捷操作
 * 4. 批量操作：全选、反选、批量删除
 * 
 * v4.1 优化内容：
 * - 添加节点导航功能（上一个/下一个）
 * - 添加批量选择同类型/相邻节点
 * - 优化菜单项分组结构
 * - 添加状态指示器
 * - 添加节点信息预览
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  // 节点操作
  Edit3, Trash2, Copy, Clipboard, Layers,
  // 连线操作
  Link, Link2Off, ArrowLeftRight,
  // 画布操作
  PlusCircle, Focus, Grid3X3, Search, ZoomIn, ZoomOut,
  // 布局操作
  Sparkles, LayoutGrid, LayoutList, GitBranch, CircleDot, Network,
  // 视图操作
  Maximize2, RotateCcw, Settings,
  // 状态操作
  Lock, Unlock,
  // 选择操作
  CheckSquare, Square, CopyPlus, Trash,
  // 导航
  ArrowLeft, ArrowRight, ArrowUp, ArrowDown,
  // 辅助
  ChevronRight, ChevronUp, ChevronDown, ArrowUpDown, X, Database, Check,
  Eye, EyeOff,
  type LucideIcon,
} from 'lucide-react';

// ============================================================
// Types & Interfaces
// ============================================================

/** 菜单类型 */
export type ContextMenuType = 'node' | 'edge' | 'canvas';

/** 上下文菜单状态 */
export interface ContextMenuState {
  x: number;
  y: number;
  type: ContextMenuType;
  targetId?: string;
  targetData?: any;
}

/** 画布上下文菜单属性 */
export interface CanvasContextMenuProps {
  /** 菜单状态 */
  menu: ContextMenuState | null;
  /** 关闭回调 */
  onClose: () => void;
  
  // ── 节点操作 ──────────────────────────────────────
  /** 编辑节点 */
  onEditNode?: (nodeId: string) => void;
  /** 删除节点 */
  onDeleteNode?: (nodeId: string) => void;
  /** 复制节点 */
  onCopyNode?: (nodeId: string) => void;
  /** 复制并新建 */
  onDuplicateNode?: (nodeId: string) => void;
  /** 创建连线 */
  onAddEdgeFromNode?: (nodeId: string) => void;
  /** 聚焦节点 */
  onFocusNode?: (nodeId: string) => void;
  /** 锁定节点 */
  onLockNode?: (nodeId: string) => void;
  /** 解锁节点 */
  onUnlockNode?: (nodeId: string) => void;
  /** 展开/折叠节点 */
  onToggleExpand?: (nodeId: string) => void;
  /** 导航到上一个节点 */
  onNavigatePrev?: (nodeId: string) => void;
  /** 导航到下一个节点 */
  onNavigateNext?: (nodeId: string) => void;
  
  // ── 连线操作 ──────────────────────────────────────
  /** 编辑连线 */
  onEditEdge?: (edgeId: string) => void;
  /** 删除连线 */
  onDeleteEdge?: (edgeId: string) => void;
  /** 反转连线方向 */
  onReverseEdge?: (edgeId: string) => void;
  /** 高亮路径 */
  onHighlightPath?: (edgeId: string) => void;
  /** 选择连线关联的节点 */
  onSelectConnectedNodes?: (edgeId: string) => void;
  
  // ── 画布操作 ──────────────────────────────────────
  /** 在指定位置创建节点 */
  onCreateNodeAtPos?: (x: number, y: number) => void;
  /** 在指定位置创建连线（需要源节点ID） */
  onCreateLinkAtPos?: (x: number, y: number, sourceNodeId?: string) => void;
  /** 自动布局 */
  onAutoLayout?: () => void;
  /** 适应视图 */
  onFitView?: () => void;
  /** 全选 */
  onSelectAll?: () => void;
  /** 反选 */
  onSelectInverse?: () => void;
  /** 复制选中 */
  onCopySelected?: () => void;
  /** 剪切选中 */
  onCutSelected?: () => void;
  /** 粘贴 */
  onPaste?: () => void;
  /** 删除选中 */
  onDeleteSelected?: () => void;
  
  // ── 缩放操作 ──────────────────────────────────────
  /** 放大 */
  onZoomIn?: () => void;
  /** 缩小 */
  onZoomOut?: () => void;
  /** 重置缩放 */
  onResetZoom?: () => void;
  
  // ── 批量操作 ──────────────────────────────────────
  /** 批量选择同类型节点 */
  onSelectSameType?: (nodeId: string) => void;
  /** 批量选择相邻节点 */
  onSelectAdjacent?: (nodeId: string) => void;
  
  // ── 状态检查 ──────────────────────────────────────
  /** 是否有复制数据 */
  hasClipboardData?: boolean;
  /** 是否只读模式 */
  isReadOnly?: boolean;
  /** 选中的节点数量 */
  selectedNodeCount?: number;
  /** 选中的连线数量 */
  selectedEdgeCount?: number;
  /** 是否存在其他同类型节点（用于批量选择） */
  hasSameTypeNodes?: boolean;
  /** 是否存在相邻节点（用于批量选择） */
  hasAdjacentNodes?: boolean;
  /** 当前节点索引（用于导航） */
  currentNodeIndex?: number;
  /** 节点总数（用于导航） */
  totalNodeCount?: number;
}

// ============================================================
// Constants
// ============================================================

/** 快捷键定义 */
const SHORTCUTS: Record<string, string> = {
  Enter: '确认',
  Escape: '关闭',
  Del: '删除',
  Delete: '删除',
  'Ctrl+C': '复制',
  'Ctrl+V': '粘贴',
  'Ctrl+X': '剪切',
  'Ctrl+A': '全选',
  'Ctrl+D': '复制并新建',
  F: '聚焦',
  R: '反转',
  L: '锁定',
  N: '新建',
  '+': '放大',
  '-': '缩小',
  '0': '重置',
  '1': '适应视图',
};

// ============================================================
// Sub-Components
// ============================================================

/** 菜单项属性 */
interface MenuItemProps {
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  active?: boolean;
  description?: string;
  onClick: () => void;
}

/** 菜单项组件 */
const MenuItem: React.FC<MenuItemProps> = ({
  icon: Icon,
  label,
  shortcut,
  danger = false,
  disabled = false,
  active = false,
  description,
  onClick,
}) => {
  const iconColor = danger 
    ? 'text-monokai-danger/70' 
    : active 
      ? 'text-monokai-accent' 
      : 'text-monokai-comment';
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left text-xs transition-all
        ${danger
          ? 'text-monokai-danger hover:bg-monokai-danger/10'
          : active
            ? 'text-monokai-accent bg-monokai-accent/10'
            : 'text-monokai-fg hover:bg-monokai-surface hover:text-monokai-accent'
        }
        ${disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}
      `}
    >
      <Icon className={`w-4 h-4 shrink-0 ${iconColor}`} />
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{label}</div>
        {description && (
          <div className="text-[10px] text-monokai-comment mt-0.5 truncate">{description}</div>
        )}
      </div>
      {shortcut && (
        <kbd className="text-[9px] font-mono text-monokai-comment bg-monokai-bg/60 px-1.5 py-0.5 rounded shrink-0">
          {shortcut}
        </kbd>
      )}
    </button>
  );
};

/** 分隔线 */
const MenuDivider: React.FC<{ label?: string }> = ({ label }) => (
  <div className="py-1">
    {label ? (
      <div className="px-3 py-1 text-[10px] font-semibold text-monokai-comment uppercase tracking-wider">
        {label}
      </div>
    ) : (
      <div className="h-px bg-monokai-border mx-2" />
    )}
  </div>
);

/** 子菜单属性 */
interface SubMenuItemProps {
  label: string;
  icon: LucideIcon;
  children: React.ReactNode;
}

/** 子菜单组件 */
const SubMenuItem: React.FC<SubMenuItemProps> = ({ label, icon: Icon, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setIsOpen(false), 150);
  };

  return (
    <div
      ref={menuRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left text-xs 
          text-monokai-fg hover:bg-monokai-surface hover:text-monokai-accent transition-all cursor-pointer"
      >
        <Icon className="w-4 h-4 shrink-0 text-monokai-comment" />
        <span className="flex-1">{label}</span>
        <ChevronRight className="w-3 h-3 text-monokai-comment" />
      </button>

      {isOpen && (
        <div 
          className="absolute left-full top-0 ml-1 min-w-[160px] 
            bg-monokai-sidebar/98 backdrop-blur-md border border-monokai-border rounded-lg shadow-2xl 
            p-1 z-[100] animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      )}
    </div>
  );
};

/** 布局选项 */
interface LayoutOptionProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick: () => void;
}

const LayoutOption: React.FC<LayoutOptionProps> = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`
      w-full flex items-center gap-2 px-3 py-1.5 rounded text-xs transition-all
      ${active 
        ? 'bg-monokai-accent/15 text-monokai-accent' 
        : 'text-monokai-fg hover:bg-monokai-surface'
      }
    `}
  >
    <Icon className="w-3.5 h-3.5" />
    <span className="flex-1">{label}</span>
    {active && <Check className="w-3 h-3 text-monokai-accent" />}
  </button>
);

// ============================================================
// Main Component
// ============================================================

export const CanvasContextMenu: React.FC<CanvasContextMenuProps> = ({
  menu,
  onClose,
  // Node actions
  onEditNode,
  onDeleteNode,
  onCopyNode,
  onDuplicateNode,
  onAddEdgeFromNode,
  onFocusNode,
  onLockNode,
  onUnlockNode,
  onToggleExpand,
  onNavigatePrev,
  onNavigateNext,
  // Edge actions
  onEditEdge,
  onDeleteEdge,
  onReverseEdge,
  onHighlightPath,
  onSelectConnectedNodes,
  // Canvas actions
  onCreateNodeAtPos,
  onCreateLinkAtPos,
  onAutoLayout,
  onFitView,
  onSelectAll,
  onSelectInverse,
  onCopySelected,
  onCutSelected,
  onPaste,
  onDeleteSelected,
  // Zoom actions
  onZoomIn,
  onZoomOut,
  onResetZoom,
  // Batch actions
  onSelectSameType,
  onSelectAdjacent,
  // State checks
  hasClipboardData = false,
  isReadOnly = false,
  selectedNodeCount = 0,
  selectedEdgeCount = 0,
  hasSameTypeNodes = false,
  hasAdjacentNodes = false,
  currentNodeIndex,
  totalNodeCount = 0,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // 菜单项点击处理
  const handleAction = useCallback((action?: () => void) => {
    if (action) action();
    onClose();
  }, [onClose]);

  if (!menu) return null;

  const { x, y, type, targetId, targetData } = menu;

  // 计算菜单位置（避免超出屏幕）
  const menuStyle = useMemo<React.CSSProperties>(() => {
    const baseStyle: React.CSSProperties = {
      left: `${x}px`,
      top: `${y}px`,
    };
    
    // 右边界检测
    if (x > window.innerWidth - 250) {
      baseStyle.left = `${x - 200}px`;
    }
    
    // 下边界检测
    if (y > window.innerHeight - 400) {
      baseStyle.top = `${y - 300}px`;
    }
    
    return baseStyle;
  }, [x, y]);

  const hasSelection = selectedNodeCount > 0 || selectedEdgeCount > 0;

  return (
    <div
      ref={containerRef}
      style={menuStyle}
      className="fixed z-[9999] min-w-[200px] max-w-[240px] 
        bg-monokai-sidebar/98 backdrop-blur-md border border-monokai-border 
        rounded-xl shadow-2xl p-1 text-monokai-fg text-xs
        animate-in fade-in zoom-in-95 duration-100"
      role="menu"
      aria-label="上下文菜单"
      onClick={(e) => e.stopPropagation()}
    >
      
      {/* ═══════════════════════════════════════════════════════════════════
          节点菜单 (v4.1 增强版)
          ═══════════════════════════════════════════════════════════════════ */}
      {type === 'node' && targetId && (
        <>
          {/* 节点信息预览 - v4.1新增 */}
          {targetData && (
            <div className="px-3 py-2 mb-1 bg-monokai-bg/60 rounded-lg border border-monokai-border/50">
              <div className="flex items-center gap-2 mb-1">
                <Database className="w-4 h-4 text-monokai-cyan shrink-0" />
                <span className="text-xs font-semibold text-monokai-fg truncate flex-1" title={targetData.name}>
                  {targetData.name}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-monokai-comment">
                <span className="bg-monokai-surface px-1.5 py-0.5 rounded">
                  ID: {targetId}
                </span>
                {targetData.object_type_id && (
                  <span className="bg-monokai-accent/20 text-monokai-accent px-1.5 py-0.5 rounded">
                    类型 #{targetData.object_type_id}
                  </span>
                )}
                {targetData.isLocked && (
                  <span className="bg-monokai-warning/20 text-monokai-warning px-1.5 py-0.5 rounded flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> 已锁定
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 核心操作 */}
          <MenuItem
            icon={Edit3}
            label="编辑实体信息"
            shortcut="Enter"
            onClick={() => handleAction(() => onEditNode?.(targetId))}
            disabled={isReadOnly}
            description="打开节点编辑对话框"
          />

          <MenuItem
            icon={Link}
            label="创建关联连线"
            shortcut="L"
            onClick={() => handleAction(() => onAddEdgeFromNode?.(targetId))}
            disabled={isReadOnly}
            description="从当前节点开始创建连线"
          />

          <MenuItem
            icon={Focus}
            label="聚焦至画布中央"
            shortcut="F"
            onClick={() => handleAction(() => onFocusNode?.(targetId))}
            description="将节点移动到视图中心"
          />

          {/* 节点导航 - v4.1增强 */}
          {(onNavigatePrev || onNavigateNext) && (
            <>
              <MenuDivider label="导航" />
              <div className="flex items-center gap-1 px-3 py-1.5">
                {onNavigatePrev && (
                  <button
                    onClick={() => handleAction(() => onNavigatePrev?.(targetId))}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md 
                      text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface transition-colors"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    <span className="text-[10px]">上一个</span>
                  </button>
                )}
                {onNavigateNext && (
                  <button
                    onClick={() => handleAction(() => onNavigateNext?.(targetId))}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md 
                      text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface transition-colors"
                  >
                    <span className="text-[10px]">下一个</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </>
          )}

          <MenuDivider label="复制" />

          {/* 复制操作 */}
          <MenuItem
            icon={Copy}
            label="复制节点"
            shortcut="Ctrl+C"
            onClick={() => handleAction(() => onCopyNode?.(targetId))}
            description="复制节点到剪贴板"
          />

          <MenuItem
            icon={Layers}
            label="复制并新建"
            shortcut="Ctrl+D"
            onClick={() => handleAction(() => onDuplicateNode?.(targetId))}
            disabled={isReadOnly}
            description="创建节点副本"
          />

          <MenuDivider label="展开" />

          {/* 展开/折叠 */}
          <MenuItem
            icon={targetData?.isExpanded ? EyeOff : Eye}
            label={targetData?.isExpanded ? '收起属性' : '展开属性'}
            shortcut="E"
            onClick={() => handleAction(() => onToggleExpand?.(targetId))}
            description={targetData?.isExpanded ? '隐藏详细属性' : '显示所有属性'}
          />

          {/* 锁定操作 */}
          {targetData?.isLocked ? (
            <MenuItem
              icon={Unlock}
              label="解锁节点位置"
              shortcut="K"
              onClick={() => handleAction(() => onUnlockNode?.(targetId))}
              description="允许拖拽移动节点"
            />
          ) : (
            <MenuItem
              icon={Lock}
              label="锁定节点位置"
              shortcut="K"
              onClick={() => handleAction(() => onLockNode?.(targetId))}
              disabled={isReadOnly}
              description="固定节点防止误操作"
            />
          )}

          {/* 批量选择 - v4.1新增 */}
          {(onSelectSameType || onSelectAdjacent) && (
            <>
              <MenuDivider label="批量选择" />
              {onSelectSameType && (
                <MenuItem
                  icon={CheckSquare}
                  label="选中同类型节点"
                  onClick={() => handleAction(() => onSelectSameType?.(targetId))}
                  disabled={!hasSameTypeNodes}
                  description={hasSameTypeNodes ? '选择所有相同类型的节点' : '没有同类型节点'}
                />
              )}
              {onSelectAdjacent && (
                <MenuItem
                  icon={Link}
                  label="选中相邻节点"
                  onClick={() => handleAction(() => onSelectAdjacent?.(targetId))}
                  disabled={!hasAdjacentNodes}
                  description={hasAdjacentNodes ? '选择所有直接关联的节点' : '没有相邻节点'}
                />
              )}
            </>
          )}

          <MenuDivider label="危险操作" />

          {/* 危险操作 */}
          <MenuItem
            icon={Trash2}
            label="删除此实体"
            shortcut="Del"
            danger
            onClick={() => handleAction(() => onDeleteNode?.(targetId))}
            disabled={isReadOnly}
            description="同时删除关联连线"
          />
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          连线菜单
          ═══════════════════════════════════════════════════════════════════ */}
      {type === 'edge' && targetId && (
        <>
          <MenuItem
            icon={Edit3}
            label="编辑关系属性"
            shortcut="Enter"
            onClick={() => handleAction(() => onEditEdge?.(targetId))}
            disabled={isReadOnly}
            description="修改连线的名称和权重"
          />

          <MenuItem
            icon={ArrowUpDown}
            label="反转连线方向"
            shortcut="R"
            onClick={() => handleAction(() => onReverseEdge?.(targetId))}
            disabled={isReadOnly}
            description="交换起点和终点"
          />

          <MenuItem
            icon={Eye}
            label="高亮关联路径"
            shortcut="P"
            onClick={() => handleAction(() => onHighlightPath?.(targetId))}
            description="显示上下游路径"
          />

          <MenuItem
            icon={Focus}
            label="选中关联节点"
            onClick={() => handleAction(() => onSelectConnectedNodes?.(targetId))}
            description="同时选中连线两端的实体"
          />

          <MenuDivider label="危险操作" />

          <MenuItem
            icon={Link2Off}
            label="解绑连线关系"
            shortcut="Del"
            danger
            onClick={() => handleAction(() => onDeleteEdge?.(targetId))}
            disabled={isReadOnly}
            description="永久删除此连线"
          />
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          画布菜单
          ═══════════════════════════════════════════════════════════════════ */}
      {type === 'canvas' && (
        <>
          {/* 创建操作 */}
          <MenuItem
            icon={PlusCircle}
            label="在此处新建实体"
            shortcut="N"
            onClick={() => handleAction(() => onCreateNodeAtPos?.(x, y))}
            disabled={isReadOnly}
            description="双击画布也可新建"
          />

          <MenuItem
            icon={Link}
            label="从此处创建连线"
            shortcut="Shift+L"
            onClick={() => handleAction(() => onCreateLinkAtPos?.(x, y))}
            disabled={isReadOnly}
            description="先选择源节点再创建"
          />

          <MenuDivider label="选择" />

          {/* 选择操作 */}
          <MenuItem
            icon={CheckSquare}
            label="全选所有节点"
            shortcut="Ctrl+A"
            onClick={() => handleAction(() => onSelectAll?.())}
            description="选中画布上所有节点"
          />

          <MenuItem
            icon={Square}
            label="反选"
            shortcut="Ctrl+I"
            onClick={() => handleAction(() => onSelectInverse?.())}
            disabled={!hasSelection}
            description="选择当前未选中的节点"
          />

          <MenuDivider label="编辑" />

          {/* 复制粘贴 */}
          <MenuItem
            icon={Copy}
            label="复制选中节点"
            shortcut="Ctrl+C"
            onClick={() => handleAction(() => onCopySelected?.())}
            disabled={!hasSelection}
            description={`已选 ${selectedNodeCount} 个节点`}
          />

          <MenuItem
            icon={Trash2}
            label="剪切选中节点"
            shortcut="Ctrl+X"
            onClick={() => handleAction(() => onCutSelected?.())}
            disabled={!hasSelection || isReadOnly}
            description="剪切实体到剪贴板"
          />

          <MenuItem
            icon={Clipboard}
            label="粘贴节点"
            shortcut="Ctrl+V"
            onClick={() => handleAction(() => onPaste?.())}
            disabled={!hasClipboardData || isReadOnly}
            description={hasClipboardData ? "从剪贴板粘贴" : "剪贴板为空"}
          />

          <MenuItem
            icon={Trash}
            label="删除选中"
            shortcut="Del"
            onClick={() => handleAction(() => onDeleteSelected?.())}
            disabled={!hasSelection || isReadOnly}
            danger
            description={`删除 ${selectedNodeCount} 个节点`}
          />

          <MenuDivider label="视图" />

          {/* 缩放子菜单 */}
          <SubMenuItem label="缩放" icon={Search}>
            <MenuItem
              icon={ZoomIn}
              label="放大"
              shortcut="+"
              onClick={() => handleAction(() => onZoomIn?.())}
            />
            <MenuItem
              icon={ZoomOut}
              label="缩小"
              shortcut="-"
              onClick={() => handleAction(() => onZoomOut?.())}
            />
            <MenuItem
              icon={RotateCcw}
              label="重置缩放"
              shortcut="0"
              onClick={() => handleAction(() => onResetZoom?.())}
            />
            <MenuDivider />
            <MenuItem
              icon={Maximize2}
              label="适应全部视图"
              shortcut="1"
              onClick={() => handleAction(() => onFitView?.())}
            />
          </SubMenuItem>

          {/* 布局子菜单 */}
          <SubMenuItem label="自动布局" icon={Sparkles}>
            <LayoutOption
              icon={LayoutList}
              label="层级布局"
              onClick={() => handleAction(() => onAutoLayout?.())}
            />
            <LayoutOption
              icon={GitBranch}
              label="树形布局"
              onClick={() => handleAction(() => onAutoLayout?.())}
            />
            <LayoutOption
              icon={CircleDot}
              label="力导向布局"
              onClick={() => handleAction(() => onAutoLayout?.())}
            />
            <LayoutOption
              icon={Network}
              label="放射布局"
              onClick={() => handleAction(() => onAutoLayout?.())}
            />
            <LayoutOption
              icon={LayoutGrid}
              label="环形布局"
              onClick={() => handleAction(() => onAutoLayout?.())}
            />
          </SubMenuItem>

          <MenuItem
            icon={Maximize2}
            label="适应全部视图"
            shortcut="1"
            onClick={() => handleAction(() => onFitView?.())}
          />
        </>
      )}

      {/* 底部快捷键提示 */}
      <div className="mt-1 pt-2 border-t border-monokai-border/50 px-3 py-1.5">
        <div className="flex items-center gap-2 text-[10px] text-monokai-comment">
          <span>按</span>
          <kbd className="font-mono px-1 py-0.5 bg-monokai-bg rounded border border-monokai-border">Esc</kbd>
          <span>关闭</span>
          <span className="mx-1">·</span>
          <span>右键点击区域打开菜单</span>
        </div>
      </div>
    </div>
  );
};

export default CanvasContextMenu;
