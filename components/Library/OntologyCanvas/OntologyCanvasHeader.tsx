import React from 'react';
import {
  Sparkles, Search, X, Maximize2, RefreshCw, ZoomOut, ZoomIn,
  RotateCcw, RotateCw, Zap, Lock, Unlock, GitCommit
} from 'lucide-react';

interface OntologyCanvasHeaderProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filteredObjects: any[];
  objectTypes: any[];
  handleSearchFocus: (id: number) => void;
  zoom: number;
  setZoom: (z: number | ((prev: number) => number)) => void;
  handleFitView: () => void;
  handleResetZoom: () => void;
  handleUndo: () => void;
  handleRedo: () => void;
  undoDisabled: boolean;
  redoDisabled: boolean;
  isFocusMode: boolean;
  setIsFocusMode: React.Dispatch<React.SetStateAction<boolean>>;
  handleLockAll: () => void;
  handleUnlockAll: () => void;
  handleAutoAlign: (type: 'LR' | 'TB' | 'circle' | 'grid') => void;
}

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
  undoDisabled,
  redoDisabled,
  isFocusMode,
  setIsFocusMode,
  handleLockAll,
  handleUnlockAll,
  handleAutoAlign,
}) => {
  const [showLayoutMenu, setShowLayoutMenu] = React.useState(false);

  return (
    <div className="absolute top-4 left-4 right-4 z-10 flex flex-wrap gap-3 items-center justify-between pointer-events-none">
      {/* Title Badge */}
      <div className="bg-zinc-950/80 backdrop-blur-md px-4 py-2.5 rounded-[2px] border border-zinc-800/80 flex items-center gap-3 shadow-2xl pointer-events-auto">
        <div className="w-8 h-8 rounded-[2px] bg-monokai-blue/10 flex items-center justify-center border border-monokai-blue/20">
          <Sparkles className="w-4 h-4 text-monokai-blue animate-pulse" />
        </div>
        <div>
          <h1 className="text-xs font-bold text-slate-100 flex items-center gap-1.5 leading-none">
            互动本体画布
          </h1>
          <p className="text-[10px] text-slate-500 mt-1">双击空白处建节点 | 拽锚点连线建关系</p>
        </div>
      </div>

      {/* Searching & Controls */}
      <div className="flex items-center gap-2 pointer-events-auto">
        {/* Quick Search */}
        <div className="relative group">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="搜索实体定位..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-zinc-950/85 backdrop-blur-md border border-zinc-800 focus:border-monokai-cyan/50 pl-9 pr-8 py-2 rounded-[2px] text-xs w-48 transition-all focus:outline-none placeholder-slate-600 focus:w-60 shadow-lg text-slate-200"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {/* Dropdown for search results */}
          {filteredObjects.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-950/90 backdrop-blur-md border border-slate-800 rounded-[2px] overflow-hidden shadow-2xl max-h-48 overflow-y-auto custom-scrollbar z-50">
              {filteredObjects.slice(0, 5).map((obj: any) => (
                <button
                  key={obj.id}
                  onClick={() => { handleSearchFocus(obj.id); setSearchQuery(''); }}
                  className="w-full text-left px-3.5 py-2 text-xs hover:bg-[#1a1c27] flex items-center justify-between text-slate-350 transition-colors"
                >
                  <span className="font-bold truncate">{obj.name}</span>
                  <span className="text-[9px] text-monokai-cyan font-mono">{objectTypes.find((t: any) => t.id === obj.object_type_id)?.name || '未知'}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action Toolbar */}
        <div className="bg-zinc-950/80 backdrop-blur-md border border-zinc-800 px-2.5 py-1.5 rounded-[2px] flex items-center gap-1.5 shadow-lg">
          <button onClick={handleFitView} title="自适应视口" className="p-1.5 rounded-[2px] hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleResetZoom} title="重置缩放" className="p-1.5 rounded-[2px] hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} title="缩小" className="p-1.5 rounded-[2px] hover:bg-slate-850 text-slate-400 hover:text-slate-100 transition-colors">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setZoom(z => Math.min(2.0, z + 0.1))} title="放大" className="p-1.5 rounded-[2px] hover:bg-slate-855 text-slate-400 hover:text-slate-100 transition-colors">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-slate-800 mx-1" />
          <button onClick={handleUndo} disabled={undoDisabled} title="撤销布局操作 (Ctrl+Z)" className="p-1.5 rounded-[2px] hover:bg-slate-800 text-slate-400 hover:text-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleRedo} disabled={redoDisabled} title="重做布局操作 (Ctrl+Y)" className="p-1.5 rounded-[2px] hover:bg-slate-800 text-slate-400 hover:text-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-slate-800 mx-1" />
          <button
            onClick={() => setIsFocusMode(prev => !prev)}
            title={isFocusMode ? "关闭聚焦模式" : "开启聚焦模式（仅显示选中节点及其上下游）"}
            className={`p-1.5 rounded-[2px] transition-colors flex items-center gap-1 text-[10px] font-bold ${
              isFocusMode
                ? 'bg-monokai-cyan/20 border border-monokai-cyan/45 text-monokai-cyan'
                : 'hover:bg-slate-850 text-slate-400 hover:text-slate-100'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{isFocusMode ? '已聚焦' : '聚焦'}</span>
          </button>
          <div className="w-px h-4 bg-slate-800 mx-1" />
          <button onClick={handleLockAll} title="锁定全部节点位置" className="p-1.5 rounded-[2px] hover:bg-slate-850 text-slate-400 hover:text-amber-500 transition-colors">
            <Lock className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleUnlockAll} title="解锁全部节点位置" className="p-1.5 rounded-[2px] hover:bg-slate-850 text-slate-400 hover:text-green-500 transition-colors">
            <Unlock className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-slate-800 mx-1" />
          
          <div
            className="relative"
            onMouseLeave={() => setShowLayoutMenu(false)}
          >
            <button
              onClick={() => setShowLayoutMenu(prev => !prev)}
              title="选择自动对齐排列算法"
              className="p-1.5 rounded-[2px] bg-monokai-blue/10 border border-monokai-blue/20 text-monokai-blue hover:bg-monokai-blue/20 transition-all text-xs font-semibold flex items-center gap-1 px-2.5"
            >
              <GitCommit className="w-3.5 h-3.5" />
              <span>自动排版</span>
              <ChevronDown className="w-3 h-3 text-monokai-blue" />
            </button>

            {showLayoutMenu && (
              <div className="absolute right-0 top-full mt-1.5 bg-zinc-950/95 backdrop-blur-md border border-zinc-800 rounded-[2px] overflow-hidden shadow-2xl z-50 py-1 w-36">
                <button
                  onClick={() => { handleAutoAlign('LR'); setShowLayoutMenu(false); }}
                  className="w-full text-left px-3.5 py-2 text-[10px] font-bold text-slate-350 hover:text-slate-100 hover:bg-[#1a1c27] flex items-center gap-2 transition-all border-b border-zinc-900"
                >
                  <GitCommit className="w-3 h-3 text-monokai-cyan" />
                  <span>层级流向 (左→右)</span>
                </button>
                <button
                  onClick={() => { handleAutoAlign('TB'); setShowLayoutMenu(false); }}
                  className="w-full text-left px-3.5 py-2 text-[10px] font-bold text-slate-350 hover:text-slate-100 hover:bg-[#1a1c27] flex items-center gap-2 transition-all border-b border-zinc-900"
                >
                  <GitCommit className="w-3 h-3 text-monokai-cyan rotate-90" />
                  <span>层级流向 (上→下)</span>
                </button>
                <button
                  onClick={() => { handleAutoAlign('circle'); setShowLayoutMenu(false); }}
                  className="w-full text-left px-3.5 py-2 text-[10px] font-bold text-slate-350 hover:text-slate-100 hover:bg-[#1a1c27] flex items-center gap-2 transition-all border-b border-zinc-900"
                >
                  <RefreshCw className="w-3 h-3 text-monokai-green animate-spin-slow" />
                  <span>环形聚类</span>
                </button>
                <button
                  onClick={() => { handleAutoAlign('grid'); setShowLayoutMenu(false); }}
                  className="w-full text-left px-3.5 py-2 text-[10px] font-bold text-slate-350 hover:text-slate-100 hover:bg-[#1a1c27] flex items-center gap-2 transition-all"
                >
                  <Maximize2 className="w-3 h-3 text-monokai-pink" />
                  <span>网格矩阵</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
