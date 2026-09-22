import React, { useState } from 'react';
import {
  Route,
  ArrowRight,
  Search,
  CheckCircle2,
  Brain,
  Layers,
  Sparkles,
  Info,
  ExternalLink,
  Settings,
} from 'lucide-react';
import { useOntologyWorkspaceStore } from '../../hooks/useOntologyWorkspaceStore';
import { FoundPath } from '../../types/ontologyWorkspace';

export const OntologyPathView: React.FC = () => {
  const {
    nodes,
    edges,
    context,
    setPathEndpoints,
    findPaths,
    setSelectedDrawerTab,
  } = useOntologyWorkspaceStore();

  const [sourceEntity, setSourceEntity] = useState(context.sourceEntityId || 'Product');
  const [targetEntity, setTargetEntity] = useState(context.targetEntityId || 'Supplier');
  const [selectedPathIndex, setSelectedPathIndex] = useState(0);
  const [includeInferred, setIncludeInferred] = useState(true);
  const [maxDepth, setMaxDepth] = useState(4);
  const [pathMode, setPathMode] = useState<'shortest' | 'all'>('shortest');
  const [submittedQuery, setSubmittedQuery] = useState<{ source: string; target: string } | null>(() => ({
    source: context.sourceEntityId || 'Product',
    target: context.targetEntityId || 'Supplier',
  }));

  const availableEntities = Array.from(new Set(nodes.map((node) => node.id)));

  const paths = submittedQuery
    ? findPaths(submittedQuery.source, submittedQuery.target, {
        maxDepth,
        mode: pathMode,
        assertedOnly: context.assertedInferredFilter === 'asserted',
        includeInferred: includeInferred && context.assertedInferredFilter !== 'asserted',
        relationTypes: context.relationTypeFilter === 'All' ? undefined : [context.relationTypeFilter],
      })
    : [];
  const activePath = paths[selectedPathIndex] || paths[0];

  const handleFindPaths = () => {
    setPathEndpoints(sourceEntity, targetEntity);
    setSubmittedQuery({ source: sourceEntity, target: targetEntity });
    setSelectedPathIndex(0);
    setSelectedDrawerTab('pathExplorer');
  };

  return (
    <div className="flex-1 overflow-hidden bg-monokai-bg flex flex-col font-sans select-none">
      {/* 1. TOP PATH CONTROLS BAR */}
      <div className="flex h-11 items-center justify-between border-b border-monokai-border bg-monokai-bg px-4 text-xs">
        <div className="flex items-center gap-3">
          {/* Source Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-monokai-comment">Source:</span>
            <select
              value={sourceEntity}
              onChange={(e) => setSourceEntity(e.target.value)}
              className="bg-monokai-elevated border border-monokai-border rounded px-2.5 py-1 text-xs text-white font-mono outline-none"
            >
              {availableEntities.map((e) => (
                <option key={e} value={e}>
                  {e} (C-{e === 'Product' ? '0003' : e === 'Supplier' ? '0004' : '0005'})
                </option>
              ))}
            </select>
          </div>

          <span className="text-monokai-cyan">&rarr;</span>

          {/* Target Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-monokai-comment">Target:</span>
            <select
              value={targetEntity}
              onChange={(e) => setTargetEntity(e.target.value)}
              className="bg-monokai-elevated border border-monokai-border rounded px-2.5 py-1 text-xs text-white font-mono outline-none"
            >
              {availableEntities.map((e) => (
                <option key={e} value={e}>
                  {e} {e.startsWith('main.') ? '(Table)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Max Depth */}
          <div className="flex items-center gap-1.5 ml-2 text-monokai-comment">
            <span>Max Depth:</span>
            <select aria-label="Maximum path depth" value={maxDepth} onChange={(event) => setMaxDepth(Number(event.target.value))} className="font-mono text-white px-2 py-0.5 rounded bg-monokai-elevated border border-monokai-border">
              {[1, 2, 3, 4, 5, 6].map((depth) => <option key={depth} value={depth}>{depth}</option>)}
            </select>
          </div>

          <select aria-label="Path search mode" value={pathMode} onChange={(event) => setPathMode(event.target.value as 'shortest' | 'all')} className="font-mono text-white px-2 py-0.5 rounded bg-monokai-elevated border border-monokai-border">
            <option value="shortest">Shortest</option>
            <option value="all">All paths</option>
          </select>

          {/* Include Inferred */}
          <label className="flex items-center gap-1.5 text-monokai-fg-muted cursor-pointer ml-2">
            <input
              type="checkbox"
              checked={includeInferred}
              onChange={(e) => setIncludeInferred(e.target.checked)}
              className="rounded border-monokai-border bg-monokai-elevated text-monokai-cyan"
            />
            <span>Include Inferred</span>
          </label>

          {/* Search Button */}
          <button
            onClick={handleFindPaths}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-monokai-cyan hover:bg-monokai-cyan text-white font-medium text-xs shadow transition-colors ml-2"
          >
            <Search className="h-3 w-3" />
            <span>Find Paths</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10.5px] font-mono text-monokai-accent bg-monokai-accent/15 px-2.5 py-0.5 rounded border border-monokai-accent/30">
            {submittedQuery ? `Found ${paths.length} ${pathMode === 'shortest' ? 'Shortest ' : ''}Path(s)` : 'Ready to search'}
          </span>
        </div>
      </div>

      {/* 2. PATH VIEW MAIN SPLIT */}
      <div className="flex-1 grid grid-cols-4 divide-x divide-[var(--monokai-border)] overflow-hidden">
        {/* LEFT COLUMN: Found Paths List */}
        <div className="p-3 space-y-3 bg-monokai-bg overflow-y-auto custom-scrollbar">
          <div className="text-[11px] font-bold uppercase tracking-wider text-monokai-comment px-1">
            Paths ({paths.length})
          </div>

          <div className="space-y-2">
            {paths.map((p, idx) => (
              <div
                key={p.id}
                onClick={() => setSelectedPathIndex(idx)}
                className={`p-3 rounded-lg border transition-all cursor-pointer ${
                  selectedPathIndex === idx
                    ? 'border-monokai-cyan bg-monokai-elevated shadow-lg ring-1 ring-monokai-cyan/40'
                    : 'border-monokai-hover bg-monokai-elevated hover:bg-monokai-hover'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-white">
                    Path {idx + 1} {p.isShortest ? '(最短)' : ''}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-mono text-monokai-comment">长度: {p.length}</span>
                    <Settings className="h-2.5 w-2.5 text-monokai-comment" />
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-1.5 text-[11px] font-mono text-monokai-cyan">
                  <span>{sourceEntity}</span>
                  <span>&rarr;</span>
                  <span>{targetEntity}</span>
                </div>
                <div className="text-[10px] text-monokai-comment font-mono mt-1">
                  via {p.steps[0]?.relation || 'direct'} ({p.hasInferred ? 'Inferred' : 'Asserted'})
                </div>
              </div>
            ))}
            {submittedQuery && paths.length === 0 && (
              <div className="rounded-lg border border-dashed border-monokai-border bg-monokai-surface p-4 text-center text-[11px] text-monokai-comment">
                No path satisfies the current depth and evidence filters.
              </div>
            )}
          </div>
        </div>

        {/* CENTER 3 COLUMNS: Interactive Path Flow Canvas */}
        <div className="col-span-3 p-8 flex flex-col items-center justify-center relative overflow-y-auto custom-scrollbar">
          {!activePath ? (
            <div className="max-w-md rounded-xl border border-dashed border-monokai-border bg-monokai-surface p-8 text-center">
              <Route className="mx-auto h-8 w-8 text-monokai-cyan" />
              <h3 className="mt-3 text-sm font-semibold text-white">Choose two entities and find a path</h3>
              <p className="mt-1 text-[11px] text-monokai-comment">Results are computed from the current asserted and inferred ontology graph. Missing paths are never fabricated.</p>
            </div>
          ) : <div className="w-full max-w-[720px] space-y-6">
            {/* Header Description */}
            <div className="flex items-center justify-between border-b border-monokai-hover pb-3">
              <div>
                <h3 className="font-bold text-sm text-white font-mono">
                  PATH DETAILS: {activePath.title}
                </h3>
                <p className="text-xs text-monokai-comment mt-0.5 font-mono">
                  {activePath.isShortest ? 'Shortest' : 'Alternative'} Path ({activePath.length} hop{activePath.length === 1 ? '' : 's'}) from {submittedQuery?.source} to {submittedQuery?.target}
                </p>
              </div>
              <span className="text-xs font-mono text-monokai-accent px-2.5 py-1 rounded bg-monokai-accent/15 border border-monokai-accent/30">
                Confidence: {activePath.confidence}
              </span>
            </div>

            {/* Path Nodes Sequence Canvas */}
            <div className="relative flex items-center justify-center gap-6 py-10 px-6 rounded-xl border border-monokai-hover bg-monokai-surface/90 shadow-2xl">
              {activePath.steps.map((step, idx) => (
                <React.Fragment key={idx}>
                  {/* Step 1 Node */}
                  <div className="flex flex-col items-center px-5 py-3 rounded-xl bg-monokai-elevated border-2 border-monokai-cyan text-white font-semibold text-xs shadow-xl">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-monokai-purple" />
                      <span className="font-mono text-sm">{step.from}</span>
                    </div>
                    <span className="text-[10px] font-mono text-monokai-cyan mt-0.5">
                      L1 Domain Concepts
                    </span>
                  </div>

                  {/* Relation Connector */}
                  <div className="flex flex-col items-center px-3">
                    <span className="text-[11px] font-mono text-monokai-cyan font-semibold bg-monokai-elevated px-2.5 py-0.5 rounded border border-monokai-border">
                      {step.relation} ({step.inferred ? 'Inferred' : 'Asserted'})
                    </span>
                    <span className="text-monokai-cyan font-bold text-lg mt-0.5">&mdash;&mdash;&rarr;</span>
                  </div>

                  {/* Step 2 Node */}
                  {idx === activePath.steps.length - 1 && (
                    <div className="flex flex-col items-center px-5 py-3 rounded-xl bg-monokai-elevated border-2 border-monokai-accent text-white font-semibold text-xs shadow-xl">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-monokai-accent" />
                        <span className="font-mono text-sm">{step.to}</span>
                      </div>
                      <span className="text-[10px] font-mono text-monokai-accent mt-0.5">
                        {step.to.startsWith('main.') ? 'Grounding Table' : 'L1 Domain Concepts'}
                      </span>
                    </div>
                  )}
                </React.Fragment>
              ))}

              {/* Callout Badge */}
              <div className="absolute -bottom-4 bg-monokai-accent text-white px-3 py-1 rounded-md text-[10.5px] font-semibold shadow-lg">
                {activePath.isShortest ? '最短路径' : '候选路径'}: {submittedQuery?.source} &rarr; {submittedQuery?.target}
              </div>
            </div>

            {/* Step Breakdown Explanation */}
            <div className="space-y-2 pt-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-monokai-comment">
                Provenance &amp; Axiom Evidence
              </div>
              {activePath.steps.map((step, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg border border-monokai-hover bg-monokai-elevated space-y-1.5 font-mono text-xs"
                >
                  <div className="flex justify-between">
                    <span className="text-monokai-cyan font-semibold">
                      Step {idx + 1}: {step.from} &rarr; {step.relation} &rarr; {step.to}
                    </span>
                    <span className="text-monokai-accent text-[10.5px]">
                      {step.inferred ? 'Inferred Rule' : 'Asserted Axiom'}
                    </span>
                  </div>
                  <div className="text-[10.5px] text-monokai-comment">
                    Source: {step.source} · Confidence: {step.confidence}
                  </div>
                  {step.explain && (
                    <div className="text-[10.5px] text-monokai-orange bg-monokai-bg p-2 rounded mt-1 border border-monokai-border">
                      Explain: {step.explain.rule} (Premises: {step.explain.premises.join(', ')})
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>}
        </div>
      </div>
    </div>
  );
};
