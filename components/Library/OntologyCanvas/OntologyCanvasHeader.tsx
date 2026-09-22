/**
 * OntologyCanvasHeader - 实体画布头部工具栏
 * 
 * 提供画布顶部工具栏功能：
 * - 搜索框和下拉建议
 * - 撤销/重做
 * - 聚焦模式
 * - 锁定/解锁
 * - 自动布局
 * - 导入/导出/DDL生成
 * - 视图控制
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Search, Undo2, Redo2, Focus, Lock, Unlock, 
  Sparkles, Download, Upload, Code, Database, 
  ZoomIn, ZoomOut, Maximize2, Grid3X3, Map, Eye, EyeOff,
  ChevronDown, X, MousePointer2, ZoomIn as ZoomInIcon, ZoomOut as ZoomOutIcon,
  ChevronRight,
} from 'lucide-react';
import type { OntologyLayoutMode } from './OntologyLayout';

// ============================================================
// Types
// ============================================================

/** 工具栏属性 */
export interface OntologyCanvasHeaderProps {
  // 搜索
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filteredObjects: Array<{ id: number; name: string; object_type_id: number }>;
  objectTypes: Array<{ id: number; name: string }>;
  handleSearchFocus: (id: number) => void;
  
  // 缩放
  zoom: number;
  setZoom: (z: number | ((prev: number) => number)) => void;
  handleFitView: () => void;
  handleResetZoom: () => void;
  
  // 历史
  handleUndo: () => void;
  handleRedo: () => void;
  undoDisabled?: boolean;
  redoDisabled?: boolean;
  
  // 模式
  isFocusMode: boolean;
  setIsFocusMode: (v: boolean) => void;
  handleLockAll: () => void;
  handleUnlockAll: () => void;
  
  // 布局
  handleAutoAlign: () => void;
  
  // 导出
  onExport: (format: 'png' | 'jpeg' | 'svg') => void;
  onGenerateDDL: () => void;
  onImportTable: () => void;
  onCompileCTE: () => void;
  onReverseInferSchema: () => void;
  onSavePreset: () => void;
  onShowShortcuts: () => void;
  
  // 视图
  edgeRoutingMode: 'straight' | 'orthogonal' | 'bezier';
  setEdgeRoutingMode: (mode: 'straight' | 'orthogonal' | 'bezier') => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  showMiniMap: boolean;
  onToggleMiniMap: () => void;
  isReadOnly: boolean;
  onToggleReadOnly: () => void;
}

// ============================================================
// Component
// ============================================================

export const OntologyCanvasHeader: React.FC<OntologyCanvasHeaderProps> = ({
  searchQuery,
  setSearchQuery,
  filteredObjects,
  objectTypes,
  handleSearchFocus,
  zoom,
  setZoom,
  handleFitView,
  handleResetZoom,
  handleUndo,
  handleRedo,
  undoDisabled = false,
  redoDisabled = false,
  isFocusMode,
  setIsFocusMode,
  handleLockAll,
  handleUnlockAll,
  handleAutoAlign,
  onExport,
  onGenerateDDL,
  onImportTable,
  onCompileCTE,
  onReverseInferSchema,
  onSavePreset,
  onShowShortcuts,
  edgeRoutingMode,
  setEdgeRoutingMode,
  showGrid,
  onToggleGrid,
  showMiniMap,
  onToggleMiniMap,
  isReadOnly,
  onToggleReadOnly,
}) => {
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showAdvancedMenu, setShowAdvancedMenu] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const advancedMenuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
      if (advancedMenuRef.current && !advancedMenuRef.current.contains(e.target as Node)) {
        setShowAdvancedMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(4.0, typeof prev === 'number' ? prev + 0.15 : 1.15));
  }, [setZoom]);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(0.1, typeof prev === 'number' ? prev - 0.15 : 0.85));
  }, [setZoom]);

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-monokai-surface border-b border-monokai-border text-xs">
      {/* 搜索框 */}
      <div ref={searchRef} className="relative flex-1 max-w-xs">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-monokai-comment" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearchDropdown(e.target.value.length > 0);
            }}
            onFocus={() => searchQuery && setShowSearchDropdown(true)}
            placeholder="搜索实体..."
            className="w-full pl-8 pr-8 py-1.5 bg-monokai-bg border border-monokai-border rounded-md text-monokai-fg placeholder:text-monokai-comment/50 text-[11px] focus:outline-none focus:border-monokai-accent/50 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setShowSearchDropdown(false);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-monokai-comment hover:text-monokai-fg"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* 搜索下拉建议 */}
        {showSearchDropdown && filteredObjects.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-monokai-sidebar border border-monokai-border rounded-md shadow-xl z-50 max-h-48 overflow-y-auto">
            {filteredObjects.slice(0, 10).map((obj) => {
              const type = objectTypes.find((t) => t.id === obj.object_type_id);
              return (
                <button
                  key={obj.id}
                  onClick={() => {
                    handleSearchFocus(obj.id);
                    setShowSearchDropdown(false);
                    setSearchQuery('');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-monokai-surface text-left transition-colors"
                >
                  <Database className="w-3.5 h-3.5 text-monokai-cyan shrink-0" />
                  <span className="flex-1 truncate text-monokai-fg">{obj.name}</span>
                  {type && (
                    <span className="text-[10px] text-monokai-comment bg-monokai-bg px-1.5 py-0.5 rounded">
                      {type.name}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 分隔线 */}
      <div className="w-px h-6 bg-monokai-border" />

      {/* 撤销/重做 */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleUndo}
          disabled={undoDisabled}
          title="撤销 (Ctrl+Z)"
          className="p-1.5 rounded hover:bg-monokai-bg text-monokai-comment hover:text-monokai-fg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          onClick={handleRedo}
          disabled={redoDisabled}
          title="重做 (Ctrl+Y)"
          className="p-1.5 rounded hover:bg-monokai-bg text-monokai-comment hover:text-monokai-fg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Redo2 className="w-4 h-4" />
        </button>
      </div>

      {/* 分隔线 */}
      <div className="w-px h-6 bg-monokai-border" />

      {/* 聚焦模式 */}
      <button
        onClick={() => setIsFocusMode(!isFocusMode)}
        title={isFocusMode ? '退出聚焦模式' : '进入聚焦模式'}
        className={`p-1.5 rounded transition-colors ${
          isFocusMode 
            ? 'bg-monokai-accent/20 text-monokai-accent' 
            : 'hover:bg-monokai-bg text-monokai-comment hover:text-monokai-fg'
        }`}
      >
        <Focus className="w-4 h-4" />
      </button>

      {/* 锁定 */}
      <button
        onClick={isFocusMode ? handleUnlockAll : handleLockAll}
        title={isFocusMode ? '解锁所有节点' : '锁定所有节点'}
        className="p-1.5 rounded hover:bg-monokai-bg text-monokai-comment hover:text-monokai-fg transition-colors"
      >
        {isFocusMode ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
      </button>

      {/* 自动布局 */}
      <button
        onClick={handleAutoAlign}
        title="自动布局"
        className="p-1.5 rounded hover:bg-monokai-bg text-monokai-comment hover:text-monokai-fg transition-colors"
      >
        <Sparkles className="w-4 h-4" />
      </button>

      {/* 分隔线 */}
      <div className="w-px h-6 bg-monokai-border" />

      {/* 缩放控制 */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleZoomOut}
          title="缩小"
          className="p-1.5 rounded hover:bg-monokai-bg text-monokai-comment hover:text-monokai-fg transition-colors"
        >
          <ZoomOutIcon className="w-4 h-4" />
        </button>
        <span className="w-12 text-center text-monokai-comment text-[10px] font-mono">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={handleZoomIn}
          title="放大"
          className="p-1.5 rounded hover:bg-monokai-bg text-monokai-comment hover:text-monokai-fg transition-colors"
        >
          <ZoomInIcon className="w-4 h-4" />
        </button>
        <button
          onClick={handleFitView}
          title="适应视图"
          className="p-1.5 rounded hover:bg-monokai-bg text-monokai-comment hover:text-monokai-fg transition-colors"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* 分隔线 */}
      <div className="w-px h-6 bg-monokai-border" />

      {/* 视图切换 */}
      <button
        onClick={onToggleGrid}
        title={showGrid ? '隐藏网格' : '显示网格'}
        className={`p-1.5 rounded transition-colors ${
          showGrid 
            ? 'bg-monokai-accent/20 text-monokai-accent' 
            : 'hover:bg-monokai-bg text-monokai-comment hover:text-monokai-fg'
        }`}
      >
        <Grid3X3 className="w-4 h-4" />
      </button>

      <button
        onClick={onToggleMiniMap}
        title={showMiniMap ? '隐藏小地图' : '显示小地图'}
        className={`p-1.5 rounded transition-colors ${
          showMiniMap 
            ? 'bg-monokai-accent/20 text-monokai-accent' 
            : 'hover:bg-monokai-bg text-monokai-comment hover:text-monokai-fg'
        }`}
      >
        <Map className="w-4 h-4" />
      </button>

      {/* 只读模式 */}
      <button
        onClick={onToggleReadOnly}
        title={isReadOnly ? '退出只读模式' : '进入只读模式'}
        className={`p-1.5 rounded transition-colors ${
          isReadOnly 
            ? 'bg-monokai-warning/20 text-monokai-warning' 
            : 'hover:bg-monokai-bg text-monokai-comment hover:text-monokai-fg'
        }`}
      >
        {isReadOnly ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>

      {/* 分隔线 */}
      <div className="w-px h-6 bg-monokai-border" />

      {/* 导出菜单 */}
      <div ref={exportMenuRef} className="relative">
        <button
          onClick={() => setShowExportMenu(!showExportMenu)}
          className="flex items-center gap-1 px-2 py-1.5 rounded hover:bg-monokai-bg text-monokai-comment hover:text-monokai-fg transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>导出</span>
          <ChevronRight className={`w-3 h-3 transition-transform ${showExportMenu ? 'rotate-90' : ''}`} />
        </button>

        {showExportMenu && (
          <div className="absolute top-full right-0 mt-1 w-40 bg-monokai-sidebar border border-monokai-border rounded-md shadow-xl z-50">
            <button
              onClick={() => { onExport('png'); setShowExportMenu(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-monokai-surface text-left transition-colors"
            >
              <span>导出 PNG</span>
            </button>
            <button
              onClick={() => { onExport('jpeg'); setShowExportMenu(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-monokai-surface text-left transition-colors"
            >
              <span>导出 JPEG</span>
            </button>
            <button
              onClick={() => { onExport('svg'); setShowExportMenu(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-monokai-surface text-left transition-colors"
            >
              <span>导出 SVG</span>
            </button>
            <div className="h-px bg-monokai-border mx-2" />
            <button
              onClick={() => { onGenerateDDL(); setShowExportMenu(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-monokai-surface text-left transition-colors"
            >
              <Code className="w-4 h-4" />
              <span>生成 DDL</span>
            </button>
            <button
              onClick={() => { onCompileCTE(); setShowExportMenu(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-monokai-surface text-left transition-colors"
            >
              <Database className="w-4 h-4" />
              <span>编译 CTE</span>
            </button>
          </div>
        )}
      </div>

      {/* 高级操作 */}
      <div ref={advancedMenuRef} className="relative">
        <button
          onClick={() => setShowAdvancedMenu(!showAdvancedMenu)}
          className="flex items-center gap-1 px-2 py-1.5 rounded hover:bg-monokai-bg text-monokai-comment hover:text-monokai-fg transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          <span>高级</span>
          <ChevronRight className={`w-3 h-3 transition-transform ${showAdvancedMenu ? 'rotate-90' : ''}`} />
        </button>

        {showAdvancedMenu && (
          <div className="absolute top-full right-0 mt-1 w-44 bg-monokai-sidebar border border-monokai-border rounded-md shadow-xl z-50">
            <button
              onClick={() => { onImportTable(); setShowAdvancedMenu(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-monokai-surface text-left transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span>导入表</span>
            </button>
            <button
              onClick={() => { onReverseInferSchema(); setShowAdvancedMenu(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-monokai-surface text-left transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              <span>反向工程</span>
            </button>
            <div className="h-px bg-monokai-border mx-2" />
            <button
              onClick={() => { onSavePreset(); setShowAdvancedMenu(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-monokai-surface text-left transition-colors"
            >
              <span>保存预设</span>
            </button>
            <button
              onClick={() => { onShowShortcuts(); setShowAdvancedMenu(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-monokai-surface text-left transition-colors"
            >
              <span>快捷键</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OntologyCanvasHeader;
