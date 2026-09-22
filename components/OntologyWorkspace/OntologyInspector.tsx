import React, { useState } from 'react';
import {
  Compass,
  Grid,
  Route,
  Target,
  ChevronRight,
  Sparkles,
  ExternalLink,
  Layers,
  Edit2,
  Info,
  Clock,
  BookOpen,
  CheckCircle,
  AlertCircle,
  Database,
  ArrowRight,
  FileCode,
  Download,
  Plus,
  Scale,
  Trash2,
} from 'lucide-react';
import { useOntologyWorkspaceStore } from '../../hooks/useOntologyWorkspaceStore';
import { VersionLifecycleController } from '../../services/ontology/ontologyWorkspaceBackend';

export const OntologyInspector: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'details' | 'usage' | 'axioms' | 'history'>('details');

  const {
    nodes,
    edges,
    mappings,
    context,
    setFocusEntity,
    setActiveMode,
    selectRelation,
    openPropertyEditModal,
  } = useOntologyWorkspaceStore();

  const currentEntityId = context.focusEntityId || context.selectedEntityIds[0] || 'Product';
  const node = nodes.find((n) => n.id === currentEntityId || n.name === currentEntityId) || nodes[0];
  if (!node) return null;

  const activeRelation = context.selectedRelationId
    ? edges.find((e) => e.id === context.selectedRelationId)
    : null;

  const isCompareMode = context.activeMode === 'compare' || context.selectedEntityIds.length >= 2;
  const isDataSource = node.type === 'data_source' || node.name.startsWith('main.');
  const isClass = node.type === 'class';

  // Derived object properties
  const nodeObjectProperties = node.objectProperties || edges.filter((edge) => edge.source === node.name && edge.type === 'object_property').map((edge) => ({ name: edge.relationName, targetClassId: edge.target, targetClassName: edge.target, cardinality: edge.cardinality, asserted: edge.asserted }));

  const nodeDataProperties = node.dataProperties || [];

  const handleExport = (format: 'owl' | 'ttl' | 'jsonld') => {
    const content = VersionLifecycleController.exportOntology(format, nodes, edges);
    const mime = format === 'jsonld' ? 'application/ld+json' : format === 'ttl' ? 'text/turtle' : 'application/rdf+xml';
    const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `ontology-workspace.${format}`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <aside
      aria-label="本体检视器"
      className="flex h-full w-[290px] min-w-[290px] max-w-[290px] 2xl:w-[330px] 2xl:min-w-[330px] 2xl:max-w-[330px] flex-col border-l border-monokai-border bg-monokai-bg font-sans text-xs select-none text-monokai-comment"
    >
      {/* Header with Entity Tag & ID */}
      <div className="flex h-10 items-center justify-between border-b border-monokai-border px-3 bg-monokai-surface">
        <div className="flex items-center gap-2 truncate">
          <span className="font-bold text-sm text-monokai-fg tracking-tight">
            {activeRelation ? activeRelation.relationName : node.label}
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
              activeRelation
                ? 'bg-monokai-cyan/20 text-monokai-cyan'
                : isDataSource
                ? 'bg-monokai-elevated text-monokai-cyan'
                : 'bg-monokai-purple/20 text-monokai-purple'
            }`}
          >
            {activeRelation
              ? 'Relation'
              : isDataSource
              ? 'Data Source'
              : isClass
              ? 'Class'
              : 'Individual'}
          </span>
        </div>
        <span className="text-[10.5px] font-mono text-monokai-comment">ID: {activeRelation?.id || node.id}</span>
      </div>

      {/* Sub Tabs: Details | Usage | Axioms | History */}
      <div className="flex items-center border-b border-monokai-border px-2 bg-monokai-bg">
        {(['details', 'usage', 'axioms', 'history'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 text-[11px] font-medium capitalize transition-colors border-b-2 ${
              activeTab === tab
                ? 'border-monokai-cyan text-monokai-cyan font-semibold'
                : 'border-transparent text-monokai-comment hover:text-monokai-fg-muted'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4">
        {/* CONTEXT 1: RELATION INSPECTOR */}
        {activeRelation ? (
          <div className="space-y-4">
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-[10.5px] font-bold uppercase tracking-wider text-monokai-comment">
                  Relation Inspector
                </h4>
                <button
                  onClick={() => selectRelation(null)}
                  className="text-[10px] text-monokai-cyan hover:underline"
                >
                  Clear Selection
                </button>
              </div>
              <div className="space-y-1.5 rounded-lg border border-monokai-hover bg-monokai-elevated p-2.5 text-[11px]">
                <div className="flex justify-between font-mono">
                  <span className="text-monokai-comment">Relation</span>
                  <span className="font-semibold text-monokai-cyan">{activeRelation.relationName}</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-monokai-comment">Domain</span>
                  <span className="text-white">{activeRelation.source}</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-monokai-comment">Range</span>
                  <span className="text-white">{activeRelation.target}</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-monokai-comment">Type</span>
                  <span className="text-monokai-purple">{activeRelation.type}</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-monokai-comment">Cardinality</span>
                  <span className="text-white">{activeRelation.cardinality || '0..*'}</span>
                </div>
                <div className="flex justify-between font-mono pt-1 border-t border-monokai-hover/60">
                  <span className="text-monokai-comment">Status</span>
                  <span className="text-monokai-accent">
                    {activeRelation.inferred ? 'Inferred Rule' : 'Asserted Axiom'}
                  </span>
                </div>
              </div>
            </section>

            <button
              onClick={() => openPropertyEditModal(activeRelation.relationName)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-monokai-cyan hover:bg-monokai-cyan text-white text-xs font-semibold shadow transition-colors"
            >
              <Edit2 className="h-3.5 w-3.5" />
              <span>Edit Property Axioms</span>
            </button>
          </div>
        ) : isDataSource ? (
          /* CONTEXT 2: DATA SOURCE INSPECTOR */
          <div className="space-y-4">
            <section className="space-y-2">
              <h4 className="text-[10.5px] font-bold uppercase tracking-wider text-monokai-comment">
                Physical Table Inspector
              </h4>
              <div className="space-y-1.5 rounded-lg border border-monokai-hover bg-monokai-elevated p-2.5 text-[11px] font-mono">
                <div className="flex justify-between">
                  <span className="text-monokai-comment">Table</span>
                  <span className="font-semibold text-monokai-cyan">{node.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-monokai-comment">Rows</span>
                  <span className="text-white">{node.instanceCountLabel || '2.35M rows'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-monokai-comment">Catalog</span>
                  <span className="text-monokai-accent">DuckDB main</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-monokai-comment">Target Class</span>
                  <span className="text-monokai-purple">Product</span>
                </div>
              </div>
            </section>
          </div>
        ) : (
          /* CONTEXT 3: ENTITY INSPECTOR */
          <>
            {activeTab === 'details' && (
              <>
                {/* 1. Basic Information */}
                <section className="space-y-2">
                  <h4 className="text-[10.5px] font-bold uppercase tracking-wider text-monokai-comment">
                    Basic Information
                  </h4>
                  <div className="space-y-1.5 rounded-lg border border-monokai-hover bg-monokai-elevated p-2.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-monokai-comment">Label</span>
                      <span className="font-medium text-monokai-fg">{node.label}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-monokai-comment">IRI</span>
                      <span className="font-mono text-monokai-cyan">{node.iri}</span>
                    </div>
                    <div className="flex flex-col gap-0.5 pt-1 border-t border-monokai-hover/60">
                      <span className="text-monokai-comment">Description</span>
                      <span className="text-monokai-comment leading-relaxed">{node.description}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-monokai-hover/60">
                      <span className="text-monokai-comment">Abstraction Level</span>
                      <span className="font-mono text-monokai-purple">{node.abstractionLevel} Domain Concepts</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-monokai-comment">Domain</span>
                      <span className="font-medium text-monokai-fg">{node.domain}</span>
                    </div>
                  </div>
                </section>

                {/* 2. Hierarchy */}
                {isClass && (
                  <section className="space-y-2">
                    <h4 className="text-[10.5px] font-bold uppercase tracking-wider text-monokai-comment">
                      Hierarchy
                    </h4>
                    <div className="space-y-1.5 rounded-lg border border-monokai-hover bg-monokai-elevated p-2.5 text-[11px]">
                      <div
                        onClick={() => node.parentClassId && setFocusEntity(node.parentClassId)}
                        className="flex items-center justify-between hover:text-monokai-cyan cursor-pointer transition-colors"
                      >
                        <span className="text-monokai-comment">SubClass Of</span>
                        <div className="flex items-center gap-1 font-mono text-monokai-fg-muted">
                          <span>{node.parentClassName || 'BusinessEntity'}</span>
                          <ChevronRight className="h-3 w-3 text-monokai-comment" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-monokai-hover/60">
                        <span className="text-monokai-comment">SuperClass Of</span>
                        <span className="font-mono text-monokai-fg-muted">
                          {node.subClassIds?.length || 0} classes &gt;
                        </span>
                      </div>
                    </div>
                  </section>
                )}

                {/* 3. Object Properties */}
                {isClass && (
                  <section className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10.5px] font-bold uppercase tracking-wider text-monokai-comment">
                        Object Properties ({nodeObjectProperties.length})
                      </h4>
                      <button
                        onClick={() => openPropertyEditModal('suppliedBy')}
                        className="text-[10px] text-monokai-cyan hover:underline flex items-center gap-0.5"
                      >
                        <Edit2 className="h-2.5 w-2.5" />
                        <span>Edit</span>
                      </button>
                    </div>
                    <div className="space-y-1 rounded-lg border border-monokai-hover bg-monokai-elevated p-2 text-[11px]">
                      {nodeObjectProperties.map((prop) => (
                        <div
                          key={prop.name}
                          onClick={() => openPropertyEditModal(prop.name)}
                          className="group flex items-center justify-between py-1 px-1.5 rounded hover:bg-monokai-hover transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5 text-monokai-cyan font-mono">
                            <span className="h-1.5 w-1.5 rounded-full bg-monokai-cyan" />
                            <span>{prop.name}</span>
                          </div>
                          <div className="flex items-center gap-1 text-monokai-comment font-mono text-[10.5px]">
                            <span>&rarr;</span>
                            <span className="text-monokai-fg group-hover:text-monokai-cyan underline">
                              {prop.targetClassName}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 4. Data Properties */}
                {isClass && (
                  <section className="space-y-2">
                    <h4 className="text-[10.5px] font-bold uppercase tracking-wider text-monokai-comment">
                      Data Properties ({nodeDataProperties.length})
                    </h4>
                    <div className="space-y-1 rounded-lg border border-monokai-hover bg-monokai-elevated p-2 text-[11px]">
                      {nodeDataProperties.map((prop) => (
                        <div
                          key={prop.name}
                          className="flex items-center justify-between py-0.5 px-1.5 font-mono text-[10.5px]"
                        >
                          <span className="text-monokai-fg-muted">{prop.name}</span>
                          <span className="text-monokai-purple">{prop.type}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 5. Quick Actions */}
                <section className="space-y-2 pt-1">
                  <h4 className="text-[10.5px] font-bold uppercase tracking-wider text-monokai-comment">
                    Actions &amp; Projections
                  </h4>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => {
                        setFocusEntity(node.name);
                        setActiveMode('local');
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-monokai-hover hover:bg-monokai-border text-monokai-fg-muted hover:text-white font-medium text-[11px] transition-colors"
                    >
                      <Compass className="h-3.5 w-3.5 text-monokai-cyan" />
                      <span>Explore Local</span>
                    </button>
                    <button
                      onClick={() => {
                        setFocusEntity(node.name);
                        setActiveMode('matrix');
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-monokai-hover hover:bg-monokai-border text-monokai-fg-muted hover:text-white font-medium text-[11px] transition-colors"
                    >
                      <Grid className="h-3.5 w-3.5 text-monokai-accent" />
                      <span>Show in Matrix</span>
                    </button>
                    <button
                      onClick={() => {
                        setFocusEntity(node.name);
                        setActiveMode('path');
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-monokai-hover hover:bg-monokai-border text-monokai-fg-muted hover:text-white font-medium text-[11px] transition-colors"
                    >
                      <Route className="h-3.5 w-3.5 text-monokai-orange" />
                      <span>Trace Paths</span>
                    </button>
                    <button
                      onClick={() => {
                        openPropertyEditModal('suppliedBy');
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-monokai-hover hover:bg-monokai-border text-monokai-fg-muted hover:text-white font-medium text-[11px] transition-colors"
                    >
                      <Edit2 className="h-3.5 w-3.5 text-monokai-purple" />
                      <span>Edit Model</span>
                    </button>
                  </div>

                  {/* Export Options */}
                  <div className="pt-2 border-t border-monokai-hover space-y-1.5">
                    <h5 className="text-[10px] font-mono text-monokai-comment">Export Formats</h5>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleExport('owl')}
                        className="px-2 py-1 rounded bg-monokai-elevated border border-monokai-border hover:border-monokai-cyan text-monokai-fg-muted text-[10.5px] font-mono"
                      >
                        OWL/XML
                      </button>
                      <button
                        onClick={() => handleExport('ttl')}
                        className="px-2 py-1 rounded bg-monokai-elevated border border-monokai-border hover:border-monokai-cyan text-monokai-fg-muted text-[10.5px] font-mono"
                      >
                        Turtle
                      </button>
                      <button
                        onClick={() => handleExport('jsonld')}
                        className="px-2 py-1 rounded bg-monokai-elevated border border-monokai-border hover:border-monokai-cyan text-monokai-fg-muted text-[10.5px] font-mono"
                      >
                        JSON-LD
                      </button>
                    </div>
                  </div>
                </section>
              </>
            )}

            {activeTab === 'usage' && (
              <div className="space-y-3">
                <div className="text-[11px] text-monokai-comment">
                  References and dependent axioms for <strong className="text-white">{node.label}</strong>:
                </div>
                <div className="space-y-1.5">
                  <div className="p-2 rounded bg-monokai-elevated border border-monokai-hover">
                    <div className="text-monokai-cyan font-semibold">12 Axioms</div>
                    <div className="text-[10.5px] text-monokai-comment mt-0.5">
                      Referenced in SubClassOf, ObjectPropertyDomain
                    </div>
                  </div>
                  <div className="p-2 rounded bg-monokai-elevated border border-monokai-hover">
                    <div className="text-monokai-accent font-semibold">3 Object Properties</div>
                    <div className="text-[10.5px] text-monokai-comment mt-0.5">
                      belongsToCategory, suppliedBy, soldAt
                    </div>
                  </div>
                  <div className="p-2 rounded bg-monokai-elevated border border-monokai-hover">
                    <div className="text-monokai-orange font-semibold">2 Rules</div>
                    <div className="text-[10.5px] text-monokai-comment mt-0.5">
                      OrderSupplierTransitivityRule
                    </div>
                  </div>
                  <div className="p-2 rounded bg-monokai-elevated border border-monokai-hover">
                    <div className="text-monokai-purple font-semibold">1 DuckDB Mapping</div>
                    <div className="text-[10.5px] text-monokai-comment mt-0.5">
                      main.products &rarr; Product
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'axioms' && (
              <div className="space-y-2">
                <h4 className="text-[10.5px] font-bold uppercase tracking-wider text-monokai-comment">
                  OWL/RDFS Axioms
                </h4>
                <div className="space-y-1 font-mono text-[10.5px]">
                  <div className="p-2 rounded bg-monokai-elevated border border-monokai-hover text-monokai-fg-muted">
                    SubClassOf(ex:Product, ex:BusinessEntity)
                  </div>
                  <div className="p-2 rounded bg-monokai-elevated border border-monokai-hover text-monokai-fg-muted">
                    ObjectPropertyDomain(ex:suppliedBy, ex:Product)
                  </div>
                  <div className="p-2 rounded bg-monokai-elevated border border-monokai-hover text-monokai-fg-muted">
                    ObjectPropertyRange(ex:suppliedBy, ex:Supplier)
                  </div>
                  <div className="p-2 rounded bg-monokai-elevated border border-monokai-hover text-monokai-fg-muted">
                    DataPropertyRange(ex:price, xsd:decimal)
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-2">
                <h4 className="text-[10.5px] font-bold uppercase tracking-wider text-monokai-comment">
                  Revision History
                </h4>
                <div className="space-y-2 text-[11px]">
                  <div className="p-2 rounded bg-monokai-elevated border border-monokai-hover">
                    <div className="flex justify-between font-mono text-monokai-cyan">
                      <span>v0.9 (Current)</span>
                      <span className="text-monokai-comment">19:45</span>
                    </div>
                    <div className="text-monokai-fg-muted mt-1">Range modified: Supplier &rarr; Supplier OR Store</div>
                  </div>
                  <div className="p-2 rounded bg-monokai-elevated border border-monokai-hover">
                    <div className="flex justify-between font-mono text-monokai-comment">
                      <span>v0.8</span>
                      <span className="text-monokai-comment">18:20</span>
                    </div>
                    <div className="text-monokai-fg-muted mt-1">Initial release of core retail ontology</div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
};
