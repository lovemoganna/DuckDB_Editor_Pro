import React from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  LayoutGrid,
  Sparkles,
  Search,
  Plus,
  Compass,
  MapPin,
} from 'lucide-react';
import { OntologyLayoutMode } from './OntologyLayout';

export interface CanvasToolbarProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onResetZoom: () => void;
  layoutMode: OntologyLayoutMode;
  onLayoutChange: (mode: OntologyLayoutMode) => void;
  onAutoLayout: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  showMinimap: boolean;
  onToggleMinimap: () => void;
  onAddNode: () => void;
  onAddRelation: () => void;
}

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  zoom,
  onZoomIn,
  onZoomOut,
  onFitView,
  onResetZoom,
  layoutMode,
  onLayoutChange,
  onAutoLayout,
  searchQuery,
  onSearchChange,
  showMinimap,
  onToggleMinimap,
  onAddNode,
  onAddRelation,
}) => {
  return (
    <div className="absolute top-4 left-4 right-4 z-20 pointer-events-none flex items-center justify-between gap-3">
      {/* ── Search & Filter Bar ── */}
      <div className="pointer-events-auto flex items-center gap-2 bg-slate-900/85 backdrop-blur-md border border-slate-700/60 rounded-xl px-3 py-1.5 shadow-xl text-slate-200">
        <Search className="w-4 h-4 text-cyan-400 shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="搜索实体节点或关系..."
          className="bg-transparent border-none text-xs text-slate-200 focus:outline-none w-48 placeholder-slate-500"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="text-xs text-slate-400 hover:text-slate-200 px-1"
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Central Quick Actions & Layout Picker ── */}
      <div className="pointer-events-auto flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-md border border-slate-700/60 rounded-xl p-1.5 shadow-xl text-slate-200">
        <button
          onClick={onAddNode}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white transition-all shadow-sm active:scale-95"
          title="创建新实体"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>实体</span>
        </button>

        <button
          onClick={onAddRelation}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 transition-all active:scale-95"
          title="创建新关系"
        >
          <Compass className="w-3.5 h-3.5" />
          <span>关系</span>
        </button>

        <div className="h-4 w-px bg-slate-700 mx-1" />

        {/* Layout selector dropdown/buttons */}
        <div className="flex items-center gap-1 bg-slate-950/50 p-1 rounded-lg border border-slate-800">
          {(['force', 'hierarchical', 'circular', 'grid'] as OntologyLayoutMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => onLayoutChange(mode)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                layoutMode === mode
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {mode === 'force' && '力导向'}
              {mode === 'hierarchical' && '层级'}
              {mode === 'circular' && '环形'}
              {mode === 'grid' && '网格'}
            </button>
          ))}
        </div>

        <button
          onClick={onAutoLayout}
          className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 rounded-lg transition-all"
          title="重新自动布局"
        >
          <Sparkles className="w-4 h-4" />
        </button>
      </div>

      {/* ── Zoom Controls & Minimap Toggle ── */}
      <div className="pointer-events-auto flex items-center gap-1 bg-slate-900/85 backdrop-blur-md border border-slate-700/60 rounded-xl p-1.5 shadow-xl text-slate-200">
        <button
          onClick={onZoomOut}
          className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-all"
          title="缩小"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <span className="text-[11px] font-mono px-2 text-slate-300 min-w-[42px] text-center">
          {Math.round(zoom * 100)}%
        </span>

        <button
          onClick={onZoomIn}
          className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-all"
          title="放大"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <button
          onClick={onFitView}
          className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-all"
          title="适应屏幕"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        <button
          onClick={onResetZoom}
          className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-all"
          title="重置 100%"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-slate-700 mx-0.5" />

        <button
          onClick={onToggleMinimap}
          className={`p-1.5 rounded-lg transition-all ${
            showMinimap
              ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
          }`}
          title="小地图切换"
        >
          <MapPin className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
