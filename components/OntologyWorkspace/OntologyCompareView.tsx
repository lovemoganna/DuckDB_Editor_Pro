import React from 'react';
import {
  Scale,
  X,
  Layers,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { useOntologyWorkspaceStore } from '../../hooks/useOntologyWorkspaceStore';
import { compareOntologyEntities } from '../../services/ontology/ontologyWorkspaceModel';

export const OntologyCompareView: React.FC = () => {
  const {
    nodes,
    edges,
    context,
    navigateEsc,
  } = useOntologyWorkspaceStore();

  const entityAName = context.selectedEntityIds[0] || 'Product';
  const entityBName = context.selectedEntityIds[1] || 'Supplier';

  const comparison = compareOntologyEntities(nodes, edges, entityAName, entityBName);
  const nodeA = comparison?.nodeA || nodes.find((node) => node.id === entityAName) || nodes[0];
  const nodeB = comparison?.nodeB || nodes.find((node) => node.id === entityBName) || nodes[1] || nodes[0];

  const handleClearCompare = () => {
    navigateEsc();
  };

  const formatMetric = (value: string | number) => typeof value === 'number' ? value.toLocaleString() : value;
  const diffMetric = (a: string | number, b: string | number) => typeof a === 'number' && typeof b === 'number' ? (a === b ? '=' : `${a - b > 0 ? '+' : ''}${a - b}`) : a === b ? '=' : '≠';
  const metricEntries = comparison ? [
    ['SuperClass', comparison.metrics.superClass], ['SubClasses', comparison.metrics.subClasses],
    ['Instances (approx.)', comparison.metrics.instances], ['Object Properties', comparison.metrics.objectProperties],
    ['Data Properties', comparison.metrics.dataProperties], ['Mappings (Grounding)', comparison.metrics.mappings],
  ] as const : [];
  const comparisonRows = metricEntries.map(([label, values]) => ({ label, a: formatMetric(values.a), b: formatMetric(values.b), diff: diffMetric(values.a, values.b) }));
  const sharedFeatures = comparison ? [...comparison.shared.objectProperties, ...comparison.shared.dataProperties] : [];
  const uniqueToA = comparison ? [...comparison.onlyA.objectProperties, ...comparison.onlyA.dataProperties] : [];
  const uniqueToB = comparison ? [...comparison.onlyB.objectProperties, ...comparison.onlyB.dataProperties] : [];
  const relationLabel = comparison?.relationsBetween.map((edge) => edge.relationName).join(', ') || 'No direct relation';

  return (
    <div className="flex-1 overflow-hidden bg-monokai-bg flex flex-col font-sans select-none">
      {/* 1. TOP COMPARE CONTROLS BAR */}
      <div className="flex h-11 items-center justify-between border-b border-monokai-border bg-monokai-bg px-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-monokai-cyan" />
            <span className="font-bold text-white text-xs">Compare Mode</span>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-monokai-comment">Comparing:</span>
            <span className="text-monokai-cyan font-semibold">{nodeA.label}</span>
            <span className="text-monokai-comment">vs</span>
            <span className="text-monokai-accent font-semibold">{nodeB.label}</span>
          </div>
        </div>

        <button
          onClick={handleClearCompare}
          className="flex items-center gap-1 px-3 py-1 rounded bg-monokai-hover hover:bg-monokai-border text-monokai-fg-muted text-xs font-medium transition-colors"
        >
          <RotateCcw className="h-3 w-3" />
          <span>Clear</span>
        </button>
      </div>

      {/* 2. MAIN COMPARE SPLIT */}
      <div className="flex-1 grid grid-cols-3 divide-x divide-[var(--monokai-border)] overflow-hidden">
        {/* LEFT 2 COLUMNS: Comparison Cards & Table */}
        <div className="col-span-2 overflow-y-auto custom-scrollbar p-6 space-y-6">
          {/* Top 2 Entity Hero Cards */}
          <div className="grid grid-cols-2 gap-4">
            {/* Entity A */}
            <div className="p-4 rounded-xl border-2 border-monokai-cyan bg-monokai-elevated flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full bg-monokai-purple" />
                <div>
                  <div className="font-bold text-sm text-white font-mono">{nodeA.label}</div>
                  <div className="text-[10px] text-monokai-cyan font-mono mt-0.5">
                    {nodeA.abstractionLevel} Domain Concepts / {nodeA.domain}
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-mono text-monokai-comment bg-monokai-bg px-2 py-0.5 rounded border border-monokai-border">
                {nodeA.id}
              </span>
            </div>

            {/* Entity B */}
            <div className="p-4 rounded-xl border-2 border-monokai-accent bg-monokai-elevated flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full bg-monokai-accent" />
                <div>
                  <div className="font-bold text-sm text-white font-mono">{nodeB.label}</div>
                  <div className="text-[10px] text-monokai-accent font-mono mt-0.5">
                    {nodeB.abstractionLevel} Domain Concepts / {nodeB.domain}
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-mono text-monokai-comment bg-monokai-bg px-2 py-0.5 rounded border border-monokai-border">
                {nodeB.id}
              </span>
            </div>
          </div>

          {/* Comparison Matrix Table */}
          <div className="rounded-xl border border-monokai-hover bg-monokai-surface overflow-hidden shadow-lg">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-monokai-elevated text-monokai-comment border-b border-monokai-hover">
                <tr>
                  <th className="py-2.5 px-4">属性 / 特性</th>
                  <th className="py-2.5 px-4 text-monokai-cyan font-semibold">{nodeA.label}</th>
                  <th className="py-2.5 px-4 text-monokai-accent font-semibold">{nodeB.label}</th>
                  <th className="py-2.5 px-4 text-center">差异 (Diff)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--monokai-hover)]/60 text-monokai-fg-muted">
                {comparisonRows.map((r, idx) => (
                  <tr key={idx} className="hover:bg-monokai-hover">
                    <td className="py-2 px-4 font-medium text-white">{r.label}</td>
                    <td className="py-2 px-4 text-monokai-cyan">{r.a}</td>
                    <td className="py-2 px-4 text-monokai-cyan">{r.b}</td>
                    <td className="py-2 px-4 text-center text-monokai-comment font-bold">{r.diff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Shared vs Unique Breakdown */}
          <div className="grid grid-cols-3 gap-3">
            {/* Shared */}
            <div className="p-3.5 rounded-lg border border-monokai-hover bg-monokai-elevated space-y-2">
              <div className="text-[11px] font-bold text-monokai-fg flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-monokai-cyan" />
                <span>Shared ({sharedFeatures.length})</span>
              </div>
              <div className="space-y-1 text-[11px] font-mono text-monokai-comment">
                {sharedFeatures.map((f) => (
                  <div key={f} className="truncate">&bull; {f}</div>
                ))}
              </div>
            </div>

            {/* Unique to A */}
            <div className="p-3.5 rounded-lg border border-monokai-hover bg-monokai-elevated space-y-2">
              <div className="text-[11px] font-bold text-monokai-cyan flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-monokai-cyan" />
                <span>Only in {nodeA.label} ({uniqueToA.length})</span>
              </div>
              <div className="space-y-1 text-[11px] font-mono text-monokai-fg-muted">
                {uniqueToA.map((f) => (
                  <div key={f} className="truncate">&bull; {f}</div>
                ))}
              </div>
            </div>

            {/* Unique to B */}
            <div className="p-3.5 rounded-lg border border-monokai-hover bg-monokai-elevated space-y-2">
              <div className="text-[11px] font-bold text-monokai-accent flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-monokai-accent" />
                <span>Only in {nodeB.label} ({uniqueToB.length})</span>
              </div>
              <div className="space-y-1 text-[11px] font-mono text-monokai-fg-muted">
                {uniqueToB.map((f) => (
                  <div key={f} className="truncate">&bull; {f}</div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Structural Comparison Diagram */}
        <div className="p-6 flex flex-col justify-between bg-monokai-bg overflow-y-auto custom-scrollbar">
          <div className="space-y-5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-monokai-comment border-b border-monokai-hover pb-2">
              结构拓扑对比图
            </div>

            {/* Visual Hierarchy Diagram */}
            <div className="p-6 rounded-xl border border-monokai-hover bg-monokai-elevated flex flex-col items-center gap-6 shadow-xl">
              {/* Parent Class */}
              <div className="px-4 py-2 rounded-lg bg-monokai-elevated border border-monokai-border text-white font-semibold text-xs shadow">
                BusinessEntity (L0)
              </div>

              {/* Fork to A and B */}
              <div className="flex items-center gap-10 relative w-full justify-center">
                {/* Node A */}
                <div className="flex flex-col items-center px-4 py-2.5 rounded-lg bg-monokai-elevated border-2 border-monokai-cyan text-white font-semibold text-xs shadow-lg">
                  <span>{nodeA.label}</span>
                  <span className="text-[9px] text-monokai-cyan">L1 Domain</span>
                </div>

                {/* Cross Relation Line */}
                <div className="flex flex-col items-center">
                  <span className="text-[9.5px] font-mono text-monokai-cyan bg-monokai-surface px-1.5 py-0.5 rounded border border-monokai-border">
                    {relationLabel}
                  </span>
                  <span className="text-monokai-cyan">&mdash;&rarr;</span>
                </div>

                {/* Node B */}
                <div className="flex flex-col items-center px-4 py-2.5 rounded-lg bg-monokai-elevated border-2 border-monokai-accent text-white font-semibold text-xs shadow-lg">
                  <span>{nodeB.label}</span>
                  <span className="text-[9px] text-monokai-accent">L1 Domain</span>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-monokai-comment leading-relaxed p-3 rounded-lg bg-monokai-elevated border border-monokai-hover">
              <strong className="text-white">分析结论：</strong> {nodeA.label} 与 {nodeB.label} 共享 {sharedFeatures.length} 个已声明属性；{nodeA.label} 独有 {uniqueToA.length} 个，{nodeB.label} 独有 {uniqueToB.length} 个。两者之间{comparison?.relationsBetween.length ? `存在 ${comparison.relationsBetween.length} 条直接关系` : '不存在直接关系'}。
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
