import React, { useState } from 'react';
import {
  Sparkles, Search, X, Maximize2, RefreshCw, ZoomOut, ZoomIn,
  RotateCcw, RotateCw, Zap, Lock, Unlock, GitCommit, Download,
  Database, Table2
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
  handleAutoAlign: () => void;
  onExport: (format: 'png' | 'jpeg' | 'svg') => void;
  onGenerateDDL?: () => void;
  onImportTable?: () => void;
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
  onExport,
  onGenerateDDL,
  onImportTable,
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);

  return (
    <div className="absolute top-4 left-4 right-4 z-10 flex flex-wrap gap-3 items-center justify-end pointer-events-none">
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
        <div className="bg-zinc-950/80 backdrop-blur-md border border-zinc-800 px-2.5 py-1.5 rounded-[2px] flex items-center gap-1.5 shadow-lg relative">
          <button onClick={handleFitView} title="自适应视口" className="p-1.5 rounded-[2px] hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleResetZoom} title="重置缩放" className="p-1.5 rounded-[2px] hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setZoom(z => Math.max(0.1, z - 0.15))} title="缩小" className="p-1.5 rounded-[2px] hover:bg-slate-850 text-slate-400 hover:text-slate-100 transition-colors">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setZoom(z => Math.min(4.0, z + 0.15))} title="放大" className="p-1.5 rounded-[2px] hover:bg-slate-855 text-slate-400 hover:text-slate-100 transition-colors">
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

          {/* SQL DDL Generator Button */}
          {onGenerateDDL && (
            <button
              onClick={onGenerateDDL}
              title="生成 SQL DDL 语句并插入编辑器"
              className="p-1.5 rounded-[2px] hover:bg-slate-800 text-slate-400 hover:text-monokai-cyan transition-colors flex items-center gap-1"
            >
              <Table2 className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold">生成 DDL</span>
            </button>
          )}

          {/* Import DB Table Button */}
          {onImportTable && (
            <button
              onClick={onImportTable}
              title="从 DuckDB 中导入真实物理表为实体节点"
              className="p-1.5 rounded-[2px] hover:bg-slate-800 text-slate-400 hover:text-monokai-green transition-colors flex items-center gap-1"
            >
              <Database className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold">导入物理表</span>
            </button>
          )}
          <div className="w-px h-4 bg-slate-800 mx-1" />
          
          {/* Export Button Dropdown */}
          <div className="relative flex items-center">
            <button 
              onClick={() => setShowExportMenu(!showExportMenu)} 
              title="按完整图边界导出（不受当前缩放影响）"
              data-testid="ontology-export-menu"
              className={`p-1.5 rounded-[2px] hover:bg-slate-800 transition-colors flex items-center gap-1 ${showExportMenu ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-100'}`}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold">导出</span>
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-2 w-32 bg-zinc-950 border border-zinc-800 rounded-[2px] shadow-2xl overflow-hidden z-50 flex flex-col">
                <button
                  onClick={() => { onExport('png'); setShowExportMenu(false); }}
                  data-testid="ontology-export-png"
                  className="w-full text-left px-3 py-2 text-[11px] font-medium text-slate-300 hover:bg-[#1a1c27] hover:text-white transition-colors"
                >
                  高清 PNG（3×）
                </button>
                <button
                  onClick={() => { onExport('jpeg'); setShowExportMenu(false); }}
                  className="w-full text-left px-3 py-2 text-[11px] font-medium text-slate-300 hover:bg-[#1a1c27] hover:text-white transition-colors"
                >
                  导出为 JPEG
                </button>
                <button
                  onClick={() => { onExport('svg'); setShowExportMenu(false); }}
                  data-testid="ontology-export-svg"
                  className="w-full text-left px-3 py-2 text-[11px] font-medium text-slate-300 hover:bg-[#1a1c27] hover:text-white transition-colors"
                >
                  导出为 SVG
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
