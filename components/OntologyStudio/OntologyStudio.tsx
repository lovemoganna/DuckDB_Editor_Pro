import React, { useState } from 'react';
import {
  Sidebar as SidebarIcon,
  SlidersHorizontal,
  Database,
  Layers,
  Sparkles,
  Play,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  BrainCircuit,
  Map,
  X,
} from 'lucide-react';
import { OntologyStudioSidebar } from './OntologyStudioSidebar';
import { OntologyStudioCanvas } from './OntologyStudioCanvas';
import { OntologyStudioInspector } from './OntologyStudioInspector';
import { useOntologyStudioStore } from '../../hooks/useOntologyStudioStore';
import { OntologyStudioMode } from '../../types/ontologyStudioTypes';

interface OntologyStudioProps {
  onClose?: () => void;
  onInsertToEditor?: (sql: string) => void;
  onTablesReady?: () => void;
}

export const OntologyStudio: React.FC<OntologyStudioProps> = ({
  onClose,
  onInsertToEditor,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);

  const {
    entities,
    relations,
    activeMode,
    setActiveMode,
    deductionRules,
  } = useOntologyStudioStore();

  return (
    <div className="ontology-studio relative flex h-full w-full flex-col bg-monokai-bg font-sans text-xs text-monokai-fg select-none overflow-hidden">
      {/* 1. TOP SUB-HEADER BAR */}
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-monokai-border bg-monokai-sidebar px-4 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen((v) => !v)}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
              isSidebarOpen
                ? 'bg-monokai-surface text-monokai-fg border border-monokai-border'
                : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/60'
            }`}
            title={isSidebarOpen ? '收起左侧数据栏' : '展开左侧数据栏'}
          >
            <SidebarIcon className="w-4 h-4" />
          </button>

          <div className="h-4 w-[1px] bg-monokai-border" />

          {/* Breadcrumb & Entity Counts */}
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-monokai-fg font-semibold flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-monokai-cyan" />
              <span>本体知识网络</span>
            </span>
            <span className="text-monokai-comment">/</span>
            <span className="text-monokai-fg-muted">
              {entities.length} 个实体
            </span>
            <span className="text-monokai-comment">•</span>
            <span className="text-monokai-fg-muted">
              {relations.length} 条关联
            </span>
          </div>

          <div className="h-4 w-[1px] bg-monokai-border hidden md:block" />

          {/* Mode Switcher Pills */}
          <div className="hidden md:flex items-center gap-1 p-0.5 rounded-md bg-monokai-bg border border-monokai-border">
            <button
              onClick={() => setActiveMode('modeling')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                activeMode === 'modeling'
                  ? 'bg-monokai-surface text-monokai-fg border border-monokai-border shadow-xs'
                  : 'text-monokai-comment hover:text-monokai-fg'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-monokai-accent" />
              <span>拓扑建模</span>
            </button>
            <button
              onClick={() => setActiveMode('deduction')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                activeMode === 'deduction'
                  ? 'bg-monokai-surface text-monokai-fg border border-monokai-border shadow-xs'
                  : 'text-monokai-comment hover:text-monokai-fg'
              }`}
            >
              <BrainCircuit className="w-3.5 h-3.5 text-monokai-accent" />
              <span>演绎推演 ({deductionRules.length})</span>
            </button>
            <button
              onClick={() => setActiveMode('mapping')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                activeMode === 'mapping'
                  ? 'bg-monokai-surface text-monokai-fg border border-monokai-border shadow-xs'
                  : 'text-monokai-comment hover:text-monokai-fg'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-monokai-accent" />
              <span>物理映射</span>
            </button>
          </div>
        </div>

        {/* Right Status / Inspector Controls */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md bg-monokai-bg border border-monokai-border text-xs font-mono text-monokai-accent">
            <span className="w-2 h-2 rounded-full bg-monokai-accent animate-pulse" />
            <span>DuckDB Kernel Connected</span>
          </div>

          <div className="h-4 w-[1px] bg-monokai-border" />

          <button
            onClick={() => setIsInspectorOpen((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer border ${
              isInspectorOpen
                ? 'bg-monokai-surface text-monokai-fg border-monokai-border'
                : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/60 border-transparent'
            }`}
            title={isInspectorOpen ? '收起右侧检视器' : '展开右侧检视器'}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-monokai-cyan" />
            <span>属性检视器</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/60 transition-colors cursor-pointer"
              title="关闭本体工作台"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* 2. MAIN TRI-PANE LAYOUT */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Sidebar */}
        {isSidebarOpen && <OntologyStudioSidebar />}

        {/* Center Canvas */}
        <main className="flex flex-1 flex-col min-w-0 overflow-hidden relative">
          <OntologyStudioCanvas onInsertToEditor={onInsertToEditor} />
        </main>

        {/* Right Inspector */}
        <OntologyStudioInspector
          isOpen={isInspectorOpen}
          onClose={() => setIsInspectorOpen(false)}
          onInsertToEditor={onInsertToEditor}
        />
      </div>
    </div>
  );
};

export default OntologyStudio;
