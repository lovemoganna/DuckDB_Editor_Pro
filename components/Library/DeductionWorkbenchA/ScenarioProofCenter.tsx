import React, { useMemo, useState } from 'react';
import {
  AlertTriangle, BarChart3, BookOpen, Code, Database, Eye,
  Filter, Play, Search, ShieldCheck, Sparkles, X,
} from 'lucide-react';
import type {
  InferenceReport,
  RuleDefinition,
  FeatureDefinition,
} from '../../../services/ontology/ontologyInferenceEngine';
import { compileRule, renderRuleLisp } from '../../../services/ontology/ontologyInferenceEngine';
import { ScenarioCandidateCard } from '../DeductionWorkbench/ScenarioCandidateCard';

export interface ScenarioProofCenterProps {
  report: InferenceReport | null;
  activeRule: RuleDefinition | null;
  allRules: RuleDefinition[];
  features: FeatureDefinition[];
  objectNamesById: Record<number, string>;
  selectedFeatureIds: string[];
  topKLimit: number;
  onTopKChange: (topK: number) => void;
  onRunDeduction: () => void;
}

export const ScenarioProofCenter: React.FC<ScenarioProofCenterProps> = ({
  report,
  activeRule,
  allRules,
  features,
  objectNamesById,
  selectedFeatureIds,
  topKLimit,
  onTopKChange,
  onRunDeduction,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'ESTABLISHED' | 'POSSIBLE' | 'EXCLUDED'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCandidateId, setExpandedCandidateId] = useState<string | null>(null);
  const [candidateTags, setCandidateTags] = useState<Record<string, string[]>>({});
  const [astDrawerOpen, setAstDrawerOpen] = useState(false);
  const [astTab, setAstTab] = useState<'lisp' | 'sql' | 'explanation'>('lisp');

  const handleAddTag = (candidateId: string, tag: string) => {
    setCandidateTags(prev => {
      const list = prev[candidateId] || [];
      if (list.includes(tag)) return prev;
      return { ...prev, [candidateId]: [...list, tag] };
    });
  };

  const handleRemoveTag = (candidateId: string, tag: string) => {
    setCandidateTags(prev => {
      const list = prev[candidateId] || [];
      return { ...prev, [candidateId]: list.filter(t => t !== tag) };
    });
  };

  const filteredCandidates = useMemo(() => {
    if (!report) return [];
    let candidates = report.rankedCandidates;
    if (statusFilter !== 'all') {
      candidates = candidates.filter(c => c.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      candidates = candidates.filter(c =>
        c.states.some(s => s.featureName.toLowerCase().includes(q) || String(s.value).toLowerCase().includes(q)),
      );
    }
    return candidates;
  }, [report, searchQuery, statusFilter]);

  const maxCount = useMemo(
    () => Math.max(1, ...(report?.rankedCandidates.map(c => c.count) ?? [1])),
    [report],
  );

  const compiled = activeRule ? compileRule(activeRule, features, allRules) : null;
  const lispCode = activeRule ? renderRuleLisp(activeRule, features) : '';

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[#12141e] p-3.5 text-xs">
      {/* Header Bar */}
      <div className="mb-3 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 font-black text-monokai-fg text-sm">
            <Sparkles className="h-4 w-4 text-monokai-yellow" />
            推演情形挖掘中心 (Top-N 挖掘)
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAstDrawerOpen(prev => !prev)}
              className="flex items-center gap-1 rounded-lg border border-monokai-cyan/30 bg-monokai-cyan/10 px-2.5 py-1 text-[11px] font-bold text-monokai-cyan hover:bg-monokai-cyan/20"
            >
              <Code className="h-3.5 w-3.5" /> AST / SQL
            </button>
            <select
              aria-label="Top-K 数量"
              value={topKLimit}
              onChange={e => onTopKChange(Number(e.target.value))}
              className="rounded-lg border border-white/10 bg-[#0c0d12] px-2 py-1 text-[10px] text-monokai-fg"
            >
              {[10, 20, 30, 50, 100].map(k => (
                <option key={k} value={k}>前 {k} 条情形</option>
              ))}
            </select>
            <button
              type="button"
              onClick={onRunDeduction}
              disabled={selectedFeatureIds.length === 0}
              className="flex items-center gap-1 rounded-lg bg-monokai-cyan px-3 py-1 text-[11px] font-black text-black transition-all hover:brightness-110 disabled:opacity-40"
            >
              <Play className="h-3.5 w-3.5" /> 开始推演
            </button>
          </div>
        </div>

        {/* Stats summary row */}
        {report && (
          <div className="mt-2.5 grid grid-cols-4 gap-2 text-center text-[10px]">
            <div className="rounded-lg bg-monokai-green/10 p-2 text-monokai-green">
              已成立<br /><strong>{report.establishedCandidates.length}</strong>
            </div>
            <div className="rounded-lg bg-monokai-cyan/10 p-2 text-monokai-cyan">
              可能出现<br /><strong>{report.possibleCandidates.length}</strong>
            </div>
            <div className="rounded-lg bg-monokai-pink/10 p-2 text-monokai-pink">
              已排除<br /><strong>{report.excludedCandidates.length}</strong>
            </div>
            <div className="rounded-lg bg-monokai-yellow/10 p-2 text-monokai-yellow">
              缺失条件<br /><strong>{report.unknownPopulation}</strong>
            </div>
          </div>
        )}

        {/* Filter bar */}
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            {(['all', 'ESTABLISHED', 'POSSIBLE', 'EXCLUDED'] as const).map(status => {
              const labels = { all: '全部', ESTABLISHED: '已成立', POSSIBLE: '可能', EXCLUDED: '排除' };
              const isActive = statusFilter === status;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-lg px-2 py-0.5 text-[10px] font-bold transition-all ${
                    isActive
                      ? 'border border-monokai-cyan/30 bg-monokai-cyan/20 text-monokai-cyan'
                      : 'border border-transparent bg-white/5 text-monokai-comment hover:bg-white/10'
                  }`}
                >
                  {labels[status]}
                </button>
              );
            })}
          </div>

          <div className="relative w-36">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-monokai-comment" />
            <input
              type="text"
              placeholder="搜索候选情形..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#0c0d12] py-1 pl-7 pr-2 text-[10px] text-monokai-fg outline-none focus:border-monokai-accent"
              aria-label="搜索推演情形"
            />
          </div>
        </div>
      </div>

      {/* Main scenario cards list */}
      <div className="flex-1 space-y-2 overflow-auto pr-1">
        {!report ? (
          <div className="flex h-56 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 p-6 text-center text-monokai-comment">
            <BarChart3 className="mb-2 h-10 w-10 text-monokai-cyan/30" />
            <p className="font-bold text-monokai-fg">准备就绪，一键挖掘交叉情形</p>
            <p className="mt-1 text-[10px]">结合当前本体实体数据与 AST 规则推演最可能发生的情况</p>
          </div>
        ) : filteredCandidates.length === 0 ? (
          <div className="rounded-lg bg-black/20 p-4 text-center text-monokai-comment">
            没有符合筛选条件的候选情形
          </div>
        ) : (
          filteredCandidates.map((candidate, idx) => {
            const medal = idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : undefined;
            const names = candidate.sourceObjectIds.map(id => objectNamesById[id] ?? `#${id}`);

            return (
              <ScenarioCandidateCard
                key={candidate.id}
                candidate={candidate}
                sourceObjectNames={names}
                maxCount={maxCount}
                isExpanded={expandedCandidateId === candidate.id}
                isTopCandidate={idx < 3}
                medal={medal}
                tags={candidateTags[candidate.id] || []}
                onToggle={() => setExpandedCandidateId(prev => prev === candidate.id ? null : candidate.id)}
                onAddTag={handleAddTag}
                onRemoveTag={handleRemoveTag}
              />
            );
          })
        )}
      </div>

      {/* Slide-out Drawer for AST / SQL Source Code */}
      {astDrawerOpen && (
        <div className="absolute inset-y-0 right-0 z-30 flex w-96 flex-col border-l border-white/10 bg-[#141622] p-3.5 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="font-bold text-monokai-cyan flex items-center gap-1.5">
              <Code className="h-4 w-4" /> 统一 AST 源码抽屉
            </div>
            <button
              type="button"
              onClick={() => setAstDrawerOpen(false)}
              className="text-monokai-comment hover:text-monokai-fg"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-2 flex items-center gap-1">
            {[
              { id: 'lisp', label: '中文 Lisp' },
              { id: 'sql', label: 'DuckDB SQL' },
              { id: 'explanation', label: '自然语言解释' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setAstTab(tab.id as typeof astTab)}
                className={`rounded px-2 py-1 text-[10px] font-bold ${
                  astTab === tab.id
                    ? 'bg-monokai-cyan/20 text-monokai-cyan'
                    : 'bg-white/5 text-monokai-comment'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex-1 overflow-auto font-mono text-xs">
            {astTab === 'lisp' && (
              <pre className="whitespace-pre-wrap rounded bg-black/40 p-2.5 text-monokai-cyan">
                {lispCode}
              </pre>
            )}
            {astTab === 'sql' && compiled && (
              <pre className="whitespace-pre-wrap rounded bg-black/40 p-2.5 text-monokai-green">
                {compiled.predicateSql}
              </pre>
            )}
            {astTab === 'explanation' && compiled && (
              <div className="rounded bg-black/40 p-2.5 text-monokai-fg leading-relaxed">
                {compiled.explanation}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
