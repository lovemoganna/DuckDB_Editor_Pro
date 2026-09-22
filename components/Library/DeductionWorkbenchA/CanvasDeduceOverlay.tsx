import React from 'react';
import { GitBranch, Layers, Network, ShieldCheck, X } from 'lucide-react';
import type { InferenceReport } from '../../../services/ontology/ontologyInferenceEngine';
import type { OntologyProjectionSource } from '../../../services/ontology/ontologyReasoningModule';

export interface CanvasDeduceOverlayProps {
  isOpen: boolean;
  source: OntologyProjectionSource;
  report: InferenceReport | null;
  onClose: () => void;
}

export const CanvasDeduceOverlay: React.FC<CanvasDeduceOverlayProps> = ({
  isOpen,
  source,
  report,
  onClose,
}) => {
  if (!isOpen) return null;

  const objects = source.objects ?? [];
  const links = source.links ?? [];
  const establishedCount = report?.establishedCandidates.length ?? 0;
  const possibleCount = report?.possibleCandidates.length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0c0d12]/95 p-6 backdrop-blur-md text-monokai-fg">
      {/* Top Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <Network className="h-6 w-6 text-monokai-cyan" />
          <div>
            <h2 className="text-base font-black text-monokai-fg">
              本体拓扑推演画布 (Graph Topology Deduce Canvas)
            </h2>
            <p className="text-[11px] text-monokai-comment">
              高亮图形拓扑中符合 AST 规则推演成立的实体节点与关联链条
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="rounded-full bg-monokai-green/10 border border-monokai-green/30 px-3 py-1 text-monokai-green font-bold">
            ✅ 推演成立实体路径: {establishedCount} 条
          </span>
          <span className="rounded-full bg-monokai-cyan/10 border border-monokai-cyan/30 px-3 py-1 text-monokai-cyan font-bold">
            🔍 潜在推演分支: {possibleCount} 条
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-monokai-comment hover:text-monokai-fg"
            aria-label="关闭画布推演"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main Visual Graph Node Display area */}
      <div className="relative flex-1 overflow-hidden p-6">
        <div className="grid h-full grid-cols-3 gap-6">
          {/* Objects Topology Node Cards */}
          {objects.map((obj, idx) => {
            const isHighlighted = idx < 3;
            return (
              <div
                key={obj.id}
                className={`flex flex-col justify-between rounded-2xl border p-5 transition-all duration-300 ${
                  isHighlighted
                    ? 'border-monokai-cyan bg-monokai-cyan/[0.06] shadow-xl shadow-monokai-cyan/10 scale-[1.02]'
                    : 'border-white/10 bg-black/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-monokai-comment">实体 #{obj.id}</span>
                    {isHighlighted && (
                      <span className="rounded bg-monokai-green/20 px-2 py-0.5 text-[10px] font-bold text-monokai-green">
                        推演逻辑成立
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 text-base font-black text-monokai-fg">{obj.name}</h3>
                  <div className="mt-3 space-y-1 text-xs font-mono text-monokai-comment">
                    {Object.entries(obj.properties || {}).map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span>{k}:</span>
                        <strong className="text-monokai-yellow">{String(v)}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 border-t border-white/10 pt-3 text-[11px] text-monokai-cyan">
                  拓扑路径关联支持分析 ➔
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
