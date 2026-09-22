import React, { useState, useRef, useCallback } from 'react';
import {
  ChevronUp,
  ChevronDown,
  X,
  Layers,
  Link2,
  ShieldCheck,
  Brain,
  Database,
  GitCommit,
  Table as TableIcon,
  Route,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Play,
  FileCheck,
  GripHorizontal,
} from 'lucide-react';
import { useOntologyWorkspaceStore } from '../../hooks/useOntologyWorkspaceStore';

export const OntologyDetailDrawer: React.FC = () => {
  const {
    isDrawerOpen,
    drawerHeight,
    selectedDrawerTab,
    context,
    nodes,
    edges,
    mappings,
    validationIssues,
    reasoningReport,
    draftChanges,
    dataPreviewTable,
    dataPreviewRows,
    dataPreviewLoading,
    dataPreviewError,
    setSelectedDrawerTab,
    toggleDrawer,
    setDrawerHeight,
    openPropertyEditModal,
    runValidation,
    runReasoning,
    findPaths,
  } = useOntologyWorkspaceStore();

  const [testingMappingId, setTestingMappingId] = useState<string | null>(null);
  const isDraggingRef = useRef(false);

  const currentEntityId = context.focusEntityId || 'Product';
  const node = nodes.find((n) => n.id === currentEntityId || n.name === currentEntityId) || nodes[0];
  if (!node) return null;

  // Outgoing and incoming relations for current entity
  const outgoing = edges.filter((e) => e.source === node.id || e.source === node.name);
  const incoming = edges.filter((e) => e.target === node.id || e.target === node.name);
  const dataPreviewColumns = dataPreviewRows.length > 0 ? Object.keys(dataPreviewRows[0]) : [];
  const drawerPaths = context.sourceEntityId && context.targetEntityId ? findPaths(context.sourceEntityId, context.targetEntityId, { maxDepth: context.depth || 4, includeInferred: context.assertedInferredFilter !== 'asserted', assertedOnly: context.assertedInferredFilter === 'asserted', mode: 'shortest' }) : [];
  const drawerPath = drawerPaths[0];

  const tabs = [
    { id: 'relations', label: `Relations (${outgoing.length + incoming.length})`, icon: Link2 },
    { id: 'usage', label: 'Usage (12)', icon: Layers },
    { id: 'validation', label: `Validation (${validationIssues.length})`, icon: ShieldCheck },
    { id: 'reasoning', label: 'Reasoning', icon: Brain },
    { id: 'mappings', label: `Mappings (${mappings.length})`, icon: Database },
    { id: 'changes', label: `Changes (${draftChanges.length})`, icon: GitCommit },
    { id: 'dataPreview', label: 'Data Preview', icon: TableIcon },
    { id: 'pathExplorer', label: 'Path Explorer', icon: Route },
  ] as const;

  // Drawer Resizing Mouse Handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const windowHeight = window.innerHeight;
      const newHeight = windowHeight - moveEvent.clientY;
      setDrawerHeight(newHeight);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [setDrawerHeight]);

  const handleTestMapping = (id: string) => {
    setTestingMappingId(id);
    setTimeout(() => {
      setTestingMappingId(null);
    }, 600);
  };

  return (
    <div
      className={`relative border-t border-monokai-border bg-monokai-bg font-sans text-xs select-none transition-all duration-150 flex flex-col ${
        isDrawerOpen ? '' : 'h-8 overflow-hidden'
      }`}
      style={{ height: isDrawerOpen ? `${drawerHeight}px` : '32px' }}
    >
      {/* Top Drag Resizing Handle */}
      {isDrawerOpen && (
        <div
          onMouseDown={handleMouseDown}
          className="absolute -top-1.5 left-0 right-0 h-3 cursor-row-resize flex items-center justify-center hover:bg-monokai-cyan/30 transition-colors z-40 group"
          title="Drag to resize Drawer"
        >
          <GripHorizontal className="h-3 w-6 text-monokai-comment group-hover:text-monokai-cyan" />
        </div>
      )}

      {/* Drawer Header & Tabs Bar */}
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-monokai-border bg-monokai-surface px-3">
        {/* Left tabs */}
        <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar">
          <span className="text-[10px] font-mono uppercase tracking-wider text-monokai-comment mr-2">Detail Drawer</span>
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = selectedDrawerTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setSelectedDrawerTab(t.id);
                  if (!isDrawerOpen) toggleDrawer();
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  active && isDrawerOpen
                    ? 'bg-monokai-hover text-monokai-cyan font-semibold border border-monokai-border'
                    : 'text-monokai-comment hover:text-monokai-fg-muted hover:bg-monokai-elevated'
                }`}
              >
                <Icon className={`h-3 w-3 ${active ? 'text-monokai-cyan' : 'text-monokai-comment'}`} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right drawer controls */}
        <div className="flex items-center gap-1.5 shrink-0 text-monokai-comment">
          <button
            onClick={toggleDrawer}
            className="p-1 rounded hover:bg-monokai-hover hover:text-monokai-fg-muted transition-colors"
            title={isDrawerOpen ? '收起抽屉' : '展开抽屉'}
          >
            {isDrawerOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Drawer Body */}
      {isDrawerOpen && (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
          {/* TAB 1: RELATIONS */}
          {selectedDrawerTab === 'relations' && (
            <div className="grid grid-cols-2 gap-4 h-full">
              {/* Outgoing */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-monokai-fg">
                  <span className="text-monokai-cyan">Outgoing Relations ({outgoing.length})</span>
                  <span className="text-[10px] text-monokai-comment">From {node.label}</span>
                </div>
                <div className="rounded border border-monokai-hover bg-monokai-elevated overflow-hidden">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-monokai-surface text-monokai-comment text-[10px] border-b border-monokai-hover">
                      <tr>
                        <th className="py-1 px-2.5">Relation</th>
                        <th className="py-1 px-2.5">Target</th>
                        <th className="py-1 px-2.5">Type</th>
                        <th className="py-1 px-2.5">Cardinality</th>
                        <th className="py-1 px-2.5">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--monokai-hover)]/60 font-mono">
                      {outgoing.map((e) => (
                        <tr
                          key={e.id}
                          onClick={() => openPropertyEditModal(e.relationName)}
                          className="hover:bg-monokai-hover cursor-pointer text-monokai-fg-muted"
                        >
                          <td className="py-1 px-2.5 text-monokai-cyan">{e.relationName}</td>
                          <td className="py-1 px-2.5 text-white">{e.target}</td>
                          <td className="py-1 px-2.5 text-monokai-comment text-[10px]">{e.type}</td>
                          <td className="py-1 px-2.5 text-monokai-comment text-[10px]">{e.cardinality || '1..1'}</td>
                          <td className="py-1 px-2.5 text-monokai-accent text-[10px]">
                            {e.inferred ? 'Inferred' : 'Asserted'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* If in LOCAL mode and target selected, show Path Explorer (Product -> Supplier); otherwise show Incoming */}
              {context.activeMode === 'local' ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-monokai-fg">
                    <span className="text-monokai-cyan">Path Explorer ({node.label} &rarr; {context.selectedEntityIds[1] || context.targetEntityId || 'Supplier'})</span>
                    <span className="text-[10px] text-monokai-accent font-mono">Shortest Path</span>
                  </div>
                  <div className="p-3 rounded border border-monokai-hover bg-monokai-elevated space-y-2 font-mono text-[11px]">
                    <div className="flex items-start gap-2.5">
                      <div className="flex flex-col items-center">
                        <span className="h-4 w-4 rounded-full bg-monokai-cyan text-white flex items-center justify-center text-[9px] font-bold">1</span>
                        <div className="h-6 w-0.5 bg-monokai-border" />
                      </div>
                      <div>
                        <div className="font-semibold text-white">{node.label}</div>
                        <div className="text-[9.5px] text-monokai-comment">{node.abstractionLevel} Domain Concepts</div>
                        <div className="text-[10px] text-monokai-cyan my-1 pl-1 border-l-2 border-monokai-cyan">
                          suppliedBy (object property Asserted)
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <div className="flex flex-col items-center">
                        <span className="h-4 w-4 rounded-full bg-monokai-accent text-white flex items-center justify-center text-[9px] font-bold">2</span>
                      </div>
                      <div>
                        <div className="font-semibold text-white">{context.selectedEntityIds[1] || context.targetEntityId || 'Supplier'}</div>
                        <div className="text-[9.5px] text-monokai-comment">L1 Domain Concepts</div>
                      </div>
                    </div>
                    <div className="pt-1 border-t border-monokai-hover flex items-center justify-between text-[10px] text-monokai-comment">
                      <span>Alternative Paths (1)</span>
                      <button
                        onClick={() => setSelectedDrawerTab('pathExplorer')}
                        className="text-monokai-cyan hover:underline cursor-pointer"
                      >
                        View in PATH &rarr;
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Incoming */
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-monokai-fg">
                    <span className="text-monokai-accent">Incoming Relations ({incoming.length})</span>
                    <span className="text-[10px] text-monokai-comment">To {node.label}</span>
                  </div>
                  <div className="rounded border border-monokai-hover bg-monokai-elevated overflow-hidden">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-monokai-surface text-monokai-comment text-[10px] border-b border-monokai-hover">
                        <tr>
                          <th className="py-1 px-2.5">Relation</th>
                          <th className="py-1 px-2.5">Source</th>
                          <th className="py-1 px-2.5">Type</th>
                          <th className="py-1 px-2.5">Cardinality</th>
                          <th className="py-1 px-2.5">Source</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--monokai-hover)]/60 font-mono">
                        {incoming.map((e) => (
                          <tr key={e.id} className="hover:bg-monokai-hover cursor-pointer text-monokai-fg-muted">
                            <td className="py-1 px-2.5 text-monokai-accent">{e.relationName}</td>
                            <td className="py-1 px-2.5 text-white">{e.source}</td>
                            <td className="py-1 px-2.5 text-monokai-comment text-[10px]">{e.type}</td>
                            <td className="py-1 px-2.5 text-monokai-comment text-[10px]">{e.cardinality || '1..*'}</td>
                            <td className="py-1 px-2.5 text-monokai-accent text-[10px]">
                              {e.inferred ? 'Inferred' : 'Asserted'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: USAGE */}
          {selectedDrawerTab === 'usage' && (
            <div className="space-y-2">
              <div className="text-[11px] text-monokai-comment">
                Active References across Schema, Queries, and Rules for <span className="text-white font-mono">{node.label}</span>:
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 rounded border border-monokai-hover bg-monokai-elevated">
                  <div className="text-sm font-bold text-monokai-cyan">12 Axioms</div>
                  <div className="text-[10px] text-monokai-comment mt-1">Direct OWL domain & range definitions</div>
                </div>
                <div className="p-3 rounded border border-monokai-hover bg-monokai-elevated">
                  <div className="text-sm font-bold text-monokai-accent">3 Object Properties</div>
                  <div className="text-[10px] text-monokai-comment mt-1">suppliedBy, belongsToCategory, soldAt</div>
                </div>
                <div className="p-3 rounded border border-monokai-hover bg-monokai-elevated">
                  <div className="text-sm font-bold text-monokai-orange">2 Rules</div>
                  <div className="text-[10px] text-monokai-comment mt-1">OrderSupplierTransitivityRule</div>
                </div>
                <div className="p-3 rounded border border-monokai-hover bg-monokai-elevated">
                  <div className="text-sm font-bold text-monokai-purple">1 Physical Mapping</div>
                  <div className="text-[10px] text-monokai-comment mt-1">main.products &rarr; Product</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: VALIDATION */}
          {selectedDrawerTab === 'validation' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-monokai-fg font-semibold text-[11px]">SHACL Validation Report</span>
                  <span className="px-1.5 py-0.5 rounded bg-monokai-yellow/20 text-monokai-yellow font-mono text-[10px]">
                    2 Warnings
                  </span>
                </div>
                <button
                  onClick={runValidation}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-monokai-accent hover:bg-monokai-accent text-white text-[11px] font-medium"
                >
                  <Play className="h-3 w-3" />
                  <span>Run Validation</span>
                </button>
              </div>

              <div className="rounded border border-monokai-hover bg-monokai-elevated overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-monokai-surface text-monokai-comment text-[10px] border-b border-monokai-hover">
                    <tr>
                      <th className="py-1.5 px-3">Severity</th>
                      <th className="py-1.5 px-3">Focus Node</th>
                      <th className="py-1.5 px-3">Path</th>
                      <th className="py-1.5 px-3">Expected</th>
                      <th className="py-1.5 px-3">Actual</th>
                      <th className="py-1.5 px-3">Constraint</th>
                      <th className="py-1.5 px-3">Message</th>
                      <th className="py-1.5 px-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--monokai-hover)]/60 font-mono">
                    {validationIssues.map((v) => (
                      <tr key={v.id} className="hover:bg-monokai-hover text-monokai-fg-muted">
                        <td className="py-1.5 px-3">
                          <span className="flex items-center gap-1 text-monokai-yellow">
                            <AlertTriangle className="h-3 w-3" /> Warning
                          </span>
                        </td>
                        <td className="py-1.5 px-3 text-white font-medium">{v.focusNode}</td>
                        <td className="py-1.5 px-3 text-monokai-cyan">{v.resultPath}</td>
                        <td className="py-1.5 px-3 text-monokai-comment">{v.expectedValue}</td>
                        <td className="py-1.5 px-3 text-monokai-orange">{v.actualValue}</td>
                        <td className="py-1.5 px-3 text-monokai-comment text-[10px]">{v.constraint}</td>
                        <td className="py-1.5 px-3 text-monokai-comment truncate max-w-[240px] font-sans">{v.message}</td>
                        <td className="py-1.5 px-3">
                          <button
                            onClick={() => setSelectedDrawerTab('mappings')}
                            className="text-monokai-cyan hover:underline flex items-center gap-0.5 text-[10.5px]"
                          >
                            <span>Open Mapping</span>
                            <ArrowRight className="h-2.5 w-2.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: REASONING */}
          {selectedDrawerTab === 'reasoning' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-monokai-accent" />
                    <span className="font-semibold text-white text-[11px]">Reasoning Engine: Current</span>
                  </div>
                  <span className="text-monokai-comment font-mono text-[10.5px]">
                    Duration: {reasoningReport.duration} · Total Inferred: {reasoningReport.totalInferredAxioms}
                  </span>
                </div>
                <button
                  onClick={runReasoning}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-monokai-cyan hover:bg-monokai-cyan text-white text-[11px] font-medium"
                >
                  <Brain className="h-3 w-3" />
                  <span>Run Reasoner</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {reasoningReport.inferredAxioms.map((inf) => (
                  <div key={inf.id} className="p-2.5 rounded border border-monokai-hover bg-monokai-elevated space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-monokai-cyan font-semibold">
                        {inf.subject} &rarr; {inf.predicate} &rarr; {inf.object}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-monokai-accent/20 text-monokai-accent">
                        Confidence {(inf.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="text-[10.5px] text-monokai-comment">
                      Rule: <span className="font-mono text-monokai-fg-muted">{inf.ruleName}</span>
                    </div>
                    <div className="text-[10.5px] text-monokai-comment bg-monokai-bg p-1.5 rounded font-mono">
                      Premises: {inf.premises.join(' AND ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: MAPPINGS */}
          {selectedDrawerTab === 'mappings' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white text-[11px]">DuckDB &rarr; Ontology Mappings</span>
                  <span className="text-monokai-comment text-[10.5px]">5 Tables Mapped</span>
                </div>
                <button
                  onClick={() => handleTestMapping('all')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-monokai-hover hover:bg-monokai-border text-monokai-fg-muted text-[11px]"
                >
                  <FileCheck className="h-3 w-3 text-monokai-accent" />
                  <span>{testingMappingId === 'all' ? 'Verifying...' : 'Test All Mappings'}</span>
                </button>
              </div>

              <div className="rounded border border-monokai-hover bg-monokai-elevated overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-monokai-surface text-monokai-comment text-[10px] border-b border-monokai-hover">
                    <tr>
                      <th className="py-1.5 px-3">Physical Table</th>
                      <th className="py-1.5 px-3">Target Ontology Class</th>
                      <th className="py-1.5 px-3">Fields Mapped</th>
                      <th className="py-1.5 px-3">Sample Rows</th>
                      <th className="py-1.5 px-3">Valid Rate</th>
                      <th className="py-1.5 px-3">Schema Drift</th>
                      <th className="py-1.5 px-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--monokai-hover)]/60 font-mono">
                    {mappings.map((m) => (
                      <tr key={m.id} className="hover:bg-monokai-hover text-monokai-fg-muted">
                        <td className="py-1.5 px-3 text-monokai-cyan font-medium">{m.sourceTable}</td>
                        <td className="py-1.5 px-3 text-white">{m.targetClass}</td>
                        <td className="py-1.5 px-3 text-monokai-comment">{m.fields.length} columns</td>
                        <td className="py-1.5 px-3 text-monokai-comment">{(m.sampleRowsCount / 1000000).toFixed(1)}M</td>
                        <td className="py-1.5 px-3 text-monokai-accent">{(m.validRate * 100).toFixed(1)}%</td>
                        <td className="py-1.5 px-3">
                          <span className="text-monokai-accent text-[10px] flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Up to date
                          </span>
                        </td>
                        <td className="py-1.5 px-3">
                          <button
                            onClick={() => setSelectedDrawerTab('dataPreview')}
                            className="text-monokai-cyan hover:underline mr-2"
                          >
                            Preview Data
                          </button>
                          <button
                            onClick={() => handleTestMapping(m.id)}
                            className="text-monokai-accent hover:underline"
                          >
                            {testingMappingId === m.id ? 'Testing...' : 'Test'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: CHANGES */}
          {selectedDrawerTab === 'changes' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white text-[11px]">Unpublished Draft Changes (5)</span>
                <span className="text-[10px] text-monokai-yellow">Model is modified in workspace</span>
              </div>
              <div className="space-y-1.5">
                {draftChanges.map((c) => (
                  <div key={c.id} className="p-2 rounded border border-monokai-hover bg-monokai-elevated flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                          c.type === 'added'
                            ? 'bg-monokai-accent/20 text-monokai-accent'
                            : c.type === 'modified'
                            ? 'bg-monokai-yellow/20 text-monokai-yellow'
                            : 'bg-monokai-pink/20 text-monokai-pink'
                        }`}
                      >
                        {c.type === 'added' ? '+ ADD' : c.type === 'modified' ? '~ MOD' : '- DEL'}
                      </span>
                      <span className="font-mono text-white font-medium">{c.entityName}</span>
                      <span className="text-monokai-comment text-[10.5px]">({c.entityType})</span>
                      <span className="text-monokai-comment text-[11px]">— {c.description}</span>
                    </div>
                    <span className="text-[10px] font-mono text-monokai-comment">{c.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 7: DATA PREVIEW */}
          {selectedDrawerTab === 'dataPreview' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white text-[11px]">DuckDB Live Table Data</span>
                  <span className="font-mono text-monokai-cyan text-[11px]">{dataPreviewTable || 'main.products'}</span>
                </div>
                <span className="text-[10px] text-monokai-comment">Showing top 50 sample records</span>
              </div>

              <div className="rounded border border-monokai-hover bg-monokai-elevated overflow-x-auto max-h-[140px] custom-scrollbar">
                {dataPreviewLoading && <div className="p-4 text-center text-monokai-cyan">Querying DuckDB…</div>}
                {dataPreviewError && <div role="alert" className="p-4 text-center text-monokai-pink">{dataPreviewError}</div>}
                {!dataPreviewLoading && !dataPreviewError && dataPreviewRows.length === 0 && <div className="p-4 text-center text-monokai-comment">No rows returned.</div>}
                {dataPreviewRows.length > 0 && (
                <table className="w-full text-left text-[10.5px] font-mono">
                  <thead className="bg-monokai-surface text-monokai-comment border-b border-monokai-hover sticky top-0">
                    <tr>
                      {dataPreviewColumns.map((column) => <th key={column} className="py-1 px-2.5">{column}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--monokai-hover)]/60">
                    {dataPreviewRows.map((r: any, idx: number) => (
                      <tr key={idx} className="hover:bg-monokai-hover text-monokai-fg-muted">
                        {dataPreviewColumns.map((column) => <td key={column} className="max-w-[220px] truncate py-1 px-2.5 text-monokai-fg-muted">{String(r[column] ?? '')}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
                )}
              </div>
            </div>
          )}

          {/* TAB 8: PATH EXPLORER */}
          {selectedDrawerTab === 'pathExplorer' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white text-[11px]">
                  Path Details ({context.sourceEntityId || node.label} &rarr; {context.targetEntityId || '—'}): {drawerPath ? `Length ${drawerPath.length} hop${drawerPath.length === 1 ? '' : 's'}` : 'No matching path'}
                </span>
                {drawerPath && <span className="text-[10px] font-mono text-monokai-accent">Shortest · {drawerPath.confidence} Confidence</span>}
              </div>
              {drawerPath?.steps.map((step, index) => <div key={`${step.from}-${step.relation}-${step.to}`} className="p-3 rounded border border-monokai-hover bg-monokai-elevated space-y-1.5 font-mono text-[11px]"><div className="flex items-center gap-2"><span className="px-2 py-0.5 rounded bg-monokai-purple/20 text-monokai-purple">Step {index + 1}</span><span className="text-white">{step.from}</span><span className="text-monokai-cyan">—[{step.relation}]→</span><span className="text-white">{step.to}</span></div><div className="text-[10.5px] text-monokai-comment pl-8">Evidence: {step.asserted ? 'Asserted' : 'Inferred'} in {step.source} · {step.type}</div></div>)}
              {!drawerPath && <div className="rounded border border-dashed border-monokai-border p-4 text-center text-monokai-comment">No path satisfies the active Analysis Context.</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
