/**
 * D3GraphView.toolbar.tsx - 图谱工具栏组件 (Monokai 主题优化版)
 * 
 * 职责：
 * 1. 布局选择下拉
 * 2. 搜索框
 * 3. 操作按钮
 * 
 * @design Monokai 主题一致性 - 所有组件使用统一的 monokai-* CSS 变量
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Search, RefreshCw, Download, Upload, HelpCircle, Trash2, 
  Sparkles, ChevronDown, ZoomIn, ZoomOut, Maximize2, LayoutGrid,
  GitBranch, Network, CircleDot, Hexagon, Star, X, ChevronRight
} from 'lucide-react';
import type { D3LayoutMode } from './D3GraphView.types';

// ==================== 类型定义 ====================

/** 布局模式元数据 */
interface LayoutModeMeta {
  mode: D3LayoutMode;
  label: string;
  category: 'hierarchical' | 'network' | 'radial' | 'grid';
  icon: React.ReactNode;
  recommended?: boolean;
}

// ==================== 布局注册表 ====================

/** 布局模式注册表 */
const LAYOUT_REGISTRY: LayoutModeMeta[] = [
  // 层级结构
  { mode: 'topologicalFlow', label: '拓扑语义层级流', category: 'hierarchical', icon: <GitBranch className="w-4 h-4" /> },
  { mode: 'dagre', label: 'Dagre 分层', category: 'hierarchical', icon: <LayoutGrid className="w-4 h-4" /> },
  { mode: 'verticalTree', label: '纵向层级树', category: 'hierarchical', icon: <GitBranch className="w-4 h-4" /> },
  { mode: 'horizontalTree', label: '横向层级树', category: 'hierarchical', icon: <GitBranch className="w-4 h-4" />, recommended: true },
  // 网状结构
  { mode: 'force', label: '有机力导向', category: 'network', icon: <LayoutGrid className="w-4 h-4" /> },
  { mode: 'clusteredForce', label: '社区重心极坐标', category: 'network', icon: <Hexagon className="w-4 h-4" /> },
  { mode: 'groupedCircular', label: '分组环形', category: 'network', icon: <Network className="w-4 h-4" /> },
  // 辐射结构
  { mode: 'concentric', label: '同心圆径向', category: 'radial', icon: <CircleDot className="w-4 h-4" /> },
  { mode: 'starburst', label: '星系辐射', category: 'radial', icon: <Star className="w-4 h-4" /> },
  { mode: 'dandelion', label: '蒲公英径向', category: 'radial', icon: <Hexagon className="w-4 h-4" /> },
  { mode: 'spoke', label: '辐射骨架', category: 'radial', icon: <LayoutGrid className="w-4 h-4" /> },
  // 网格结构
  { mode: 'grid', label: '网格排列', category: 'grid', icon: <LayoutGrid className="w-4 h-4" /> },
];

// 分类颜色映射
const CATEGORY_COLORS: Record<string, string> = {
  hierarchical: '#66d9ef', // 青色 - 层级
  network: '#a6e22e',     // 绿色 - 网状
  radial: '#fd971f',      // 橙色 - 辐射
  grid: '#ae81ff',        // 紫色 - 网格
};

// ==================== 样式常量 ====================

const TOOLBAR_BASE = 'flex items-center gap-2 px-3 py-2';
const TOOLBAR_SURFACE = 'bg-gradient-to-b from-monokai-surface/95 via-monokai-surface/90 to-monokai-sidebar/90 backdrop-blur-sm';
const TOOLBAR_BORDER = 'border-b border-monokai-border/60';

const BTN_BASE = 'inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all duration-150';
const BTN_DEFAULT = 'bg-monokai-bg/60 text-monokai-fg-muted border border-monokai-border/50 hover:bg-monokai-elevated hover:text-monokai-fg hover:border-monokai-border/70';
const BTN_PRIMARY = 'bg-monokai-cyan/12 text-monokai-cyan border border-monokai-cyan/35 hover:bg-monokai-cyan/20 hover:border-monokai-cyan/55';
const BTN_WARN = 'bg-monokai-yellow/10 text-monokai-yellow border border-monokai-yellow/30 hover:bg-monokai-yellow/18 hover:border-monokai-yellow/50';
const BTN_AI = 'bg-monokai-accent/10 text-monokai-accent border border-monokai-accent/30 hover:bg-monokai-accent/18 hover:border-monokai-accent/50';
const BTN_ICON = 'p-1.5 rounded-md text-monokai-comment hover:text-monokai-fg hover:bg-monokai-bg/60 transition-colors';
const BTN_DISABLED = 'opacity-50 cursor-not-allowed pointer-events-none';

const DIVIDER = 'w-px h-5 bg-monokai-border/50';

const DROPDOWN_PANEL = 'absolute top-full left-0 mt-1 w-64 bg-monokai-surface/98 backdrop-blur-md border border-monokai-border/60 rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-50 max-h-80 overflow-y-auto';
const DROPDOWN_ITEM = 'w-full flex items-center gap-2.5 px-3 py-2 text-[12px] hover:bg-monokai-bg/60 transition-colors';

const INPUT_BASE = 'w-full pl-8 pr-3 py-1.5 text-[11px] bg-monokai-bg/60 border border-monokai-border/50 rounded-md text-monokai-fg placeholder-monokai-comment/50 focus:outline-none focus:border-monokai-cyan/50 focus:bg-monokai-bg/80 transition-colors';

const BADGE_RECOMMENDED = 'text-[8px] px-1 py-px rounded bg-monokai-accent/20 text-monokai-accent border border-monokai-accent/30 font-semibold flex items-center gap-0.5 ml-auto';
const BADGE_ACTIVE = 'ml-auto text-[10px] text-monokai-cyan font-semibold';

export interface GraphToolbarProps {
  // Layout
  layoutMode: D3LayoutMode;
  onLayoutModeChange: (mode: D3LayoutMode) => void;
  
  // Search
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  searchIndex: number;
  onSearchIndexChange: (index: number) => void;
  matchCount?: number;
  
  // Actions
  onRefresh: () => void;
  onExport: () => void;
  onImport: () => void;
  onHelp: () => void;
  onClear: () => void;
  onAIFill: () => void;
  
  // Zoom
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitAll: () => void;
  zoomLevel?: number;
  
  // UI State
  isLoading?: boolean;
  disabled?: boolean;
}

/**
 * GraphToolbar - 图谱工具栏 (Monokai 主题版)
 * 
 * 提供图谱的布局选择、搜索、缩放和操作按钮。
 * 使用统一的 Monokai 主题色彩系统。
 */
export const GraphToolbar: React.FC<GraphToolbarProps> = ({
  layoutMode,
  onLayoutModeChange,
  searchTerm,
  onSearchTermChange,
  searchIndex,
  onSearchIndexChange,
  matchCount = 0,
  onRefresh,
  onExport,
  onImport,
  onHelp,
  onClear,
  onAIFill,
  onZoomIn,
  onZoomOut,
  onFitAll,
  zoomLevel = 1,
  isLoading = false,
  disabled = false,
}) => {
  const [showLayoutDropdown, setShowLayoutDropdown] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const layoutDropdownRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // 获取当前布局元数据
  const currentLayoutMeta = LAYOUT_REGISTRY.find(l => l.mode === layoutMode) || LAYOUT_REGISTRY[0];
  const currentCategoryColor = CATEGORY_COLORS[currentLayoutMeta.category];
  
  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (layoutDropdownRef.current && !layoutDropdownRef.current.contains(event.target as Node)) {
        setShowLayoutDropdown(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // 搜索处理
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchTermChange(e.target.value);
    onSearchIndexChange(-1);
  }, [onSearchTermChange, onSearchIndexChange]);
  
  // 搜索导航
  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (matchCount > 0) {
        const nextIndex = (searchIndex + 1) % matchCount;
        onSearchIndexChange(nextIndex);
      }
    }
    if (e.key === 'Escape') {
      onSearchTermChange('');
      searchInputRef.current?.blur();
    }
  }, [searchIndex, matchCount, onSearchIndexChange, onSearchTermChange]);
  
  // 布局选择
  const handleLayoutSelect = useCallback((mode: D3LayoutMode) => {
    onLayoutModeChange(mode);
    setShowLayoutDropdown(false);
  }, [onLayoutModeChange]);
  
  // 快捷键搜索
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  return (
    <div className={`${TOOLBAR_BASE} ${TOOLBAR_SURFACE} ${TOOLBAR_BORDER} graph-toolbar`}>
      {/* 布局选择器 */}
      <div className="relative" ref={layoutDropdownRef}>
        <button
          onClick={() => setShowLayoutDropdown(!showLayoutDropdown)}
          disabled={disabled || isLoading}
          className={`${BTN_BASE} ${BTN_DEFAULT} ${(disabled || isLoading) ? BTN_DISABLED : ''}`}
        >
          <span style={{ color: currentCategoryColor }}>{currentLayoutMeta.icon}</span>
          <span className="hidden sm:inline text-[12px]">{currentLayoutMeta.label}</span>
          {currentLayoutMeta.recommended && (
            <span className="hidden sm:inline text-[8px] px-1 py-px rounded bg-monokai-accent/20 text-monokai-accent border border-monokai-accent/30 font-semibold">
              推荐
            </span>
          )}
          <ChevronDown className="w-3 h-3 ml-1" />
        </button>
        
        {/* 布局下拉菜单 */}
        {showLayoutDropdown && (
          <div className={DROPDOWN_PANEL}>
            {/* 分类分组 */}
            {(['hierarchical', 'network', 'radial', 'grid'] as const).map(category => {
              const items = LAYOUT_REGISTRY.filter(l => l.category === category);
              if (items.length === 0) return null;
              
              return (
                <div key={category} className="p-1.5">
                  <div className="flex items-center gap-1.5 px-2 py-1 text-[9px] font-bold uppercase tracking-wider" style={{ color: CATEGORY_COLORS[category] }}>
                    {category === 'hierarchical' && <GitBranch className="w-3 h-3" />}
                    {category === 'network' && <Network className="w-3 h-3" />}
                    {category === 'radial' && <CircleDot className="w-3 h-3" />}
                    {category === 'grid' && <LayoutGrid className="w-3 h-3" />}
                    <span>{category === 'hierarchical' ? '层级结构' : category === 'network' ? '网状结构' : category === 'radial' ? '辐射结构' : '网格结构'}</span>
                  </div>
                  {items.map(layout => (
                    <button
                      key={layout.mode}
                      onClick={() => handleLayoutSelect(layout.mode)}
                      className={`${DROPDOWN_ITEM} ${layout.mode === layoutMode ? 'bg-monokai-cyan/10 text-monokai-fg' : 'text-monokai-fg-muted'}`}
                    >
                      <span style={{ color: CATEGORY_COLORS[layout.category] }}>{layout.icon}</span>
                      <span className="flex-1">{layout.label}</span>
                      {layout.recommended && (
                        <span className={BADGE_RECOMMENDED}>
                          <Sparkles className="w-2.5 h-2.5" />推荐
                        </span>
                      )}
                      {layout.mode === layoutMode && (
                        <span className={BADGE_ACTIVE}>✓</span>
                      )}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* 分隔线 */}
      <div className={DIVIDER} />
      
      {/* 搜索框 */}
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-monokai-comment/60" />
        <input
          ref={searchInputRef}
          type="text"
          value={searchTerm}
          onChange={handleSearchChange}
          onKeyDown={handleSearchKeyDown}
          placeholder="搜索节点 (Ctrl+F)"
          disabled={disabled}
          className={INPUT_BASE}
        />
        {searchTerm && matchCount > 0 && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-monokai-comment font-mono">
            {searchIndex + 1}/{matchCount}
          </span>
        )}
        {searchTerm && matchCount === 0 && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-monokai-pink">
            无结果
          </span>
        )}
      </div>
      
      {/* 分隔线 */}
      <div className={DIVIDER} />
      
      {/* 缩放控制 */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={onZoomIn}
          disabled={disabled || isLoading}
          className={`${BTN_ICON} ${(disabled || isLoading) ? 'opacity-50 pointer-events-none' : ''}`}
          title="放大 (+)"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <span className="text-[10px] text-monokai-comment font-mono min-w-[44px] text-center">
          {Math.round(zoomLevel * 100)}%
        </span>
        <button
          onClick={onZoomOut}
          disabled={disabled || isLoading}
          className={`${BTN_ICON} ${(disabled || isLoading) ? 'opacity-50 pointer-events-none' : ''}`}
          title="缩小 (-)"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={onFitAll}
          disabled={disabled || isLoading}
          className={`${BTN_ICON} ${(disabled || isLoading) ? 'opacity-50 pointer-events-none' : ''}`}
          title="适应全部 (0)"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
      
      {/* 分隔线 */}
      <div className={DIVIDER} />
      
      {/* 操作按钮 */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={onRefresh}
          disabled={disabled || isLoading}
          className={`${BTN_ICON} ${(disabled || isLoading) ? 'opacity-50 pointer-events-none' : ''}`}
          title="刷新 (R)"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
        
        {/* 更多菜单 */}
        <div className="relative" ref={moreMenuRef}>
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            disabled={disabled}
            className={`${BTN_ICON} ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
            title="更多操作"
          >
            <Sparkles className="w-4 h-4" />
          </button>
          
          {showMoreMenu && (
            <div className="absolute top-full right-0 mt-1 w-52 bg-monokai-surface/98 backdrop-blur-md border border-monokai-border/60 rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-50 overflow-hidden">
              <div className="p-1">
                <button
                  onClick={() => { onAIFill(); setShowMoreMenu(false); }}
                  disabled={disabled}
                  className={`${DROPDOWN_ITEM} ${BTN_AI} ${disabled ? 'opacity-50' : ''}`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>AI 生成</span>
                  <ChevronRight className="w-3 h-3 ml-auto opacity-50" />
                </button>
                <button
                  onClick={() => { onExport(); setShowMoreMenu(false); }}
                  disabled={disabled}
                  className={`${DROPDOWN_ITEM} text-monokai-fg-muted hover:bg-monokai-bg/60 hover:text-monokai-fg ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <Download className="w-4 h-4" />
                  <span>导出图谱</span>
                </button>
                <button
                  onClick={() => { onImport(); setShowMoreMenu(false); }}
                  disabled={disabled}
                  className={`${DROPDOWN_ITEM} text-monokai-fg-muted hover:bg-monokai-bg/60 hover:text-monokai-fg ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <Upload className="w-4 h-4" />
                  <span>导入数据</span>
                </button>
              </div>
              
              <div className="border-t border-monokai-border/40 mx-2" />
              
              <div className="p-1">
                <button
                  onClick={() => { onClear(); setShowMoreMenu(false); }}
                  disabled={disabled}
                  className={`${DROPDOWN_ITEM} text-monokai-pink/80 hover:bg-monokai-pink/10 hover:text-monokai-pink ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <Trash2 className="w-4 h-4" />
                  <span>清空数据</span>
                </button>
                <button
                  onClick={() => { onHelp(); setShowMoreMenu(false); }}
                  disabled={disabled}
                  className={`${DROPDOWN_ITEM} text-monokai-fg-muted hover:bg-monokai-bg/60 hover:text-monokai-fg ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <HelpCircle className="w-4 h-4" />
                  <span>帮助 (? )</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GraphToolbar;
