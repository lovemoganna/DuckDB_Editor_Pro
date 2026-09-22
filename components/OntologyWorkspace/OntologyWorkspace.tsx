import React, { useEffect, useState } from 'react';
import {
  Network,
  Compass,
  Grid,
  Route,
  Scale,
  GitCompare,
  Filter,
  Layers,
  Search,
  Plus,
  X,
  CheckCircle2,
  HardDrive,
  Cpu,
  Sparkles,
  Database,
} from 'lucide-react';
import { useOntologyWorkspaceStore } from '../../hooks/useOntologyWorkspaceStore';
import { OntologyExplorer } from './OntologyExplorer';
import { OntologyInspector } from './OntologyInspector';
import { OntologyDetailDrawer } from './OntologyDetailDrawer';
import { OntologyStatusPipeline } from './OntologyStatusPipeline';
import { OntologyChangePreviewModal } from './OntologyChangePreviewModal';
import { OntologyMapCanvas } from './OntologyMapCanvas';
import { OntologyLocalCanvas } from './OntologyLocalCanvas';
import { OntologyMatrixView } from './OntologyMatrixView';
import { OntologyPathView } from './OntologyPathView';
import { OntologyCompareView } from './OntologyCompareView';
import { OntologyDiffView } from './OntologyDiffView';
import { WorkspaceViewMode } from '../../types/ontologyWorkspace';
import { useAppStore } from '../../hooks/store/useAppStore';
import { Tab } from '../../types';

export const OntologyWorkspace: React.FC = () => {
  const {
    nodes,
    context,
    statePipeline,
    setActiveMode,
    setDomainFilter,
    setRelationTypeFilter,
    setAssertedInferredFilter,
    setDataSourceFilter,
    setShowInstancesMode,
    setDepth,
    setFocusEntity,
    navigateBack,
    navigateForward,
    navigateEsc,
    initializeWorkspace,
    workspaceStatus,
    workspaceError,
    currentVersion,
  } = useOntologyWorkspaceStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

  useEffect(() => {
    void initializeWorkspace();
  }, [initializeWorkspace]);

  // Keyboard shortcut listener: Esc, Alt+Left, Alt+Right
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'Escape') {
        navigateEsc();
      } else if (e.key === 'ArrowLeft' && e.altKey) {
        navigateBack();
      } else if (e.key === 'ArrowRight' && e.altKey) {
        navigateForward();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigateBack, navigateForward, navigateEsc]);

  const { setActiveTab: setAppActiveTab, setShowSettingsModal } = useAppStore();

  const viewModes: { id: WorkspaceViewMode; label: string; icon: React.ElementType }[] = [
    { id: 'map', label: 'MAP (Global)', icon: Network },
    { id: 'local', label: 'LOCAL (Neighborhood)', icon: Compass },
    { id: 'matrix', label: 'MATRIX (Same-level)', icon: Grid },
    { id: 'path', label: 'PATH (Trace)', icon: Route },
    { id: 'compare', label: 'COMPARE', icon: Scale },
    { id: 'diff', label: 'DIFF', icon: GitCompare },
  ];

  const filteredSearchResults = searchQuery.trim()
    ? nodes.filter(
        (n) =>
          n.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          n.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          n.domain.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const handleSelectSearchResult = (nodeName: string) => {
    setFocusEntity(nodeName);
    setSearchQuery('');
    setShowSearchResults(false);
  };

  const focusEntity = nodes.find((n) => n.id === context.focusEntityId || n.name === context.focusEntityId) || nodes[0];
  const targetEntity = context.selectedEntityIds[1] || context.targetEntityId || 'Supplier';

  return (
    <div className="ontology-workspace relative flex h-full min-h-0 w-full flex-col bg-monokai-bg font-sans text-xs text-monokai-comment select-none overflow-hidden">
      {/* 1. Workspace Tabs & Breadcrumb Bar under Global Top Bar */}
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-monokai-border bg-monokai-bg px-2 z-20">
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-2 px-3 py-1 bg-monokai-elevated text-white font-mono text-[11px] rounded-t border-t-2 border-monokai-cyan border-x border-monokai-hover">
            <span>ontology_map {currentVersion}</span>
            {statePipeline.modelStatus === 'modified' && (
              <span className="h-2 w-2 rounded-full bg-monokai-orange" title="Modified Draft" />
            )}
          </div>
          <div
            onClick={() => setActiveMode('local')}
            className="flex items-center gap-2 px-3 py-1 text-monokai-comment hover:text-white font-mono text-[11px] cursor-pointer"
          >
            <span>product_local</span>
            <X className="h-3 w-3 hover:text-red-400" />
          </div>
          <button className="p-1 text-monokai-comment hover:text-white rounded hover:bg-monokai-elevated" title="New Tab">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Dynamic Breadcrumb Path matching Image 3 */}
        <div className="flex items-center gap-2 text-[10.5px] font-mono text-monokai-comment pr-2">
          <span className="text-monokai-accent flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-monokai-accent" />
            DuckDB v1.0.0 Connected
          </span>
          <span>|</span>
          <span className="text-monokai-fg-muted">main</span>
          <span>|</span>
          <span className="text-monokai-cyan">ontology_map {currentVersion}</span>
          <span>&gt;</span>
          <span>Ontology</span>
          <span>&gt;</span>
          <span>{context.domainFilter === 'All' ? 'Commerce' : context.domainFilter}</span>
          <span>&gt;</span>
          <span className="text-monokai-cyan">L1 &rarr; L1</span>
          <span>&gt;</span>
          <span className="text-white font-semibold">{focusEntity?.label || 'Product'}</span>
          {targetEntity && (
            <>
              <span>&gt;</span>
              <span className="text-monokai-accent font-semibold">{targetEntity}</span>
            </>
          )}
        </div>
      </div>

      {workspaceError && (
        <div role="alert" className="absolute right-4 top-20 z-[70] max-w-md rounded border border-monokai-pink/50 bg-monokai-surface px-3 py-2 text-[11px] text-monokai-pink shadow-xl">
          {workspaceError}
        </div>
      )}

      {/* 3. Main Workspace Tri-Pane Layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Explorer */}
        <OntologyExplorer />

        {/* Center Workspace Area */}
        <main className="flex flex-1 flex-col min-w-0 overflow-hidden bg-monokai-bg">
          {/* Level 1 Navigation Tabs & Filter Bar */}
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-monokai-border bg-monokai-bg px-3">
            {/* View Modes Tabs */}
            <div className="flex items-center gap-1">
              {viewModes.map((m) => {
                const Icon = m.icon;
                const active = context.activeMode === m.id;
                return (
                  <button
                    key={m.id}
                    aria-pressed={active}
                    onClick={() => setActiveMode(m.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all cursor-pointer ${
                      active
                        ? 'bg-monokai-accent/15 text-monokai-accent border border-monokai-accent/30 shadow-xs font-semibold'
                        : 'text-monokai-fg-muted hover:text-monokai-fg hover:bg-monokai-surface/80 border border-transparent'
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${active ? 'text-monokai-accent' : 'text-monokai-comment'}`} />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Global Filters */}
            <div className="flex items-center gap-2">
              {/* Domain Filter */}
              <div className="flex items-center gap-1">
                <span className="text-monokai-comment text-[10.5px]">Domains:</span>
                <select
                  value={context.domainFilter}
                  onChange={(e) => setDomainFilter(e.target.value)}
                  className="bg-monokai-elevated border border-monokai-border rounded px-2 py-0.5 text-xs text-white outline-none font-mono"
                >
                  <option value="All">All</option>
                  <option value="Commerce">Commerce</option>
                  <option value="Customer">Customer</option>
                  <option value="Fulfillment">Fulfillment</option>
                  <option value="Risk">Risk</option>
                  <option value="Finance">Finance</option>
                </select>
              </div>

              {/* Relation Types */}
              <div className="flex items-center gap-1">
                <span className="text-monokai-comment text-[10.5px]">Relation Types:</span>
                <select
                  value={context.relationTypeFilter}
                  onChange={(e) => setRelationTypeFilter(e.target.value)}
                  className="bg-monokai-elevated border border-monokai-border rounded px-2 py-0.5 text-xs text-white outline-none font-mono"
                >
                  <option value="All">All</option>
                  <option value="subClassOf">subClassOf</option>
                  <option value="object_property">Object Properties</option>
                  <option value="mappedTo">mappedTo</option>
                  <option value="inferred">inferred</option>
                </select>
              </div>

              {/* Asserted & Inferred Toggle */}
              <button
                onClick={() =>
                  setAssertedInferredFilter(
                    context.assertedInferredFilter === 'all'
                      ? 'asserted'
                      : context.assertedInferredFilter === 'asserted'
                      ? 'inferred'
                      : 'all'
                  )
                }
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-monokai-elevated hover:bg-monokai-hover border border-monokai-border text-[11px] text-monokai-fg-muted"
              >
                <span>Asserted &amp; Inferred</span>
              </button>

              {/* Data Sources */}
              <div className="flex items-center gap-1">
                <span className="text-monokai-comment text-[10.5px]">Data Sources:</span>
                <select aria-label="Data source filter" value={context.dataSourceFilter} onChange={(event) => setDataSourceFilter(event.target.value)} className="text-white px-2 py-0.5 rounded bg-monokai-elevated border border-monokai-border text-xs font-mono">
                  <option value="All">All</option><option value="DuckDB">DuckDB</option><option value="External">External</option>
                </select>
              </div>

              {/* Show Instances */}
              <div className="flex items-center gap-1">
                <span className="text-monokai-comment text-[10.5px]">Show Instances:</span>
                <select aria-label="Instance display mode" value={context.showInstancesMode} onChange={(event) => setShowInstancesMode(event.target.value as typeof context.showInstancesMode)} className="text-white px-2 py-0.5 rounded bg-monokai-elevated border border-monokai-border text-xs font-mono">
                  <option value="aggregated">Aggregated</option><option value="sample">Sample</option><option value="hidden">Hidden</option>
                </select>
              </div>
            </div>
          </div>

          {/* Active Canvas Body */}
          <div className="flex flex-1 min-h-0 relative overflow-hidden">
            {context.activeMode === 'map' && <OntologyMapCanvas />}
            {context.activeMode === 'local' && <OntologyLocalCanvas />}
            {context.activeMode === 'matrix' && <OntologyMatrixView />}
            {context.activeMode === 'path' && <OntologyPathView />}
            {context.activeMode === 'compare' && <OntologyCompareView />}
            {context.activeMode === 'diff' && <OntologyDiffView />}
          </div>

          {/* Bottom Detail Drawer */}
          <OntologyDetailDrawer />

          {/* State Pipeline Bar */}
          <OntologyStatusPipeline />
        </main>

        {/* Right Inspector */}
        <OntologyInspector />
      </div>

      {/* 4. Bottom Global Status Bar with Full Interaction Tips */}
      <footer className="flex h-8 shrink-0 items-center justify-between border-t border-monokai-border bg-monokai-bg px-4 font-mono text-[11px] text-monokai-comment">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-monokai-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-monokai-accent" />
            DuckDB v1.0.0 Connected
          </span>
          <span>&middot;</span>
          <span className="text-monokai-fg-muted">main</span>
          <span>&middot;</span>
          <span className="text-monokai-cyan">ontology_map {currentVersion}</span>
        </div>

        {/* Interactive Keyboard Shortcuts Guide matching Image 3 footer */}
        <div className="hidden 2xl:flex items-center gap-2 text-monokai-comment text-[10.5px]">
          <span className="text-white font-semibold">交互提示:</span>
          <span>● 单击: 选择</span>
          <span>&middot;</span>
          <span>双击: 进入邻域</span>
          <span>&middot;</span>
          <span>Shift+单击: 多选/比较</span>
          <span>&middot;</span>
          <span>单击边: 追踪关系</span>
          <span>&middot;</span>
          <span>Esc: 返回上一步</span>
          <span>&middot;</span>
          <span>&larr;/&rarr;: 浏览历史</span>
          <span>&middot;</span>
          <span className="text-monokai-cyan">所有视图共享同一 Analysis Context</span>
        </div>

        <div className="flex items-center gap-3">
          <span>Memory: 312 MB / 4.1 GB (7%)</span>
          <span>&middot;</span>
          <span className="text-monokai-accent">Auto-saved</span>
        </div>
      </footer>

      {/* 5. Property Edit & Change Preview Modal */}
      <OntologyChangePreviewModal />
    </div>
  );
};
