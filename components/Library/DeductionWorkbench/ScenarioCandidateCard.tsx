import React, { useMemo, useState } from 'react';
import {
  AlertTriangle, BookOpen, CheckCircle2, ChevronDown, ChevronRight,
  Filter, Plus, ShieldCheck, Sparkles, Tag, XCircle,
} from 'lucide-react';
import type { SituationCandidate } from '../../../services/ontology/ontologyInferenceEngine';
import { generateCombinationExplanation, PRESET_TAGS } from '../OntologyCombinationExplorer';

export interface ScenarioCandidateCardProps {
  candidate: SituationCandidate;
  sourceObjectNames: string[];
  maxCount: number;
  isExpanded: boolean;
  isTopCandidate?: boolean;
  medal?: 'gold' | 'silver' | 'bronze';
  tags: string[];
  onToggle: () => void;
  onAddTag: (candidateId: string, tag: string) => void;
  onRemoveTag: (candidateId: string, tag: string) => void;
}

const STATUS_META = {
  ESTABLISHED: { label: '已成立', className: 'text-monokai-green bg-monokai-green/10 border-monokai-green/30', icon: CheckCircle2 },
  POSSIBLE: { label: '可能出现', className: 'text-monokai-cyan bg-monokai-cyan/10 border-monokai-cyan/30', icon: Filter },
  EXCLUDED: { label: '已排除', className: 'text-monokai-pink bg-monokai-pink/10 border-monokai-pink/30', icon: XCircle },
} as const;

const MEDAL_STYLES = {
  gold: { label: '🥇 优先推荐 (Top 1)', border: 'border-monokai-warning/50 bg-monokai-warning/[0.06]', text: 'text-monokai-warning' },
  silver: { label: '🥈 高优先级 (Top 2)', border: 'border-monokai-fg-muted/50 bg-monokai-fg-muted/[0.06]', text: 'text-monokai-fg-muted' },
  bronze: { label: '🥉 建议关注 (Top 3)', border: 'border-monokai-orange/50 bg-monokai-orange/[0.06]', text: 'text-monokai-orange' },
};

const displayValue = (val: unknown): string =>
  typeof val === 'string' ? val : JSON.stringify(val);

export const ScenarioCandidateCard: React.FC<ScenarioCandidateCardProps> = ({
  candidate,
  sourceObjectNames,
  maxCount,
  isExpanded,
  isTopCandidate,
  medal,
  tags,
  onToggle,
  onAddTag,
  onRemoveTag,
}) => {
  const meta = STATUS_META[candidate.status];
  const Icon = meta.icon;
  const explanation = useMemo(() => generateCombinationExplanation(candidate), [candidate]);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [customTagInput, setCustomTagInput] = useState('');

  const medalStyle = medal ? MEDAL_STYLES[medal] : null;

  const handleAddCustom = () => {
    if (customTagInput.trim()) {
      onAddTag(candidate.id, customTagInput.trim());
      setCustomTagInput('');
      setTagPickerOpen(false);
    }
  };

  return (
    <article
      className={`rounded-xl border p-3 text-xs transition-all duration-200 ${
        medalStyle ? medalStyle.border : 'border-white/[0.08] bg-black/15 hover:border-white/20'
      }`}
    >
      {/* Medal Banner for Top-3 */}
      {medalStyle && (
        <div className={`mb-2 flex items-center justify-between font-bold ${medalStyle.text} text-[11px]`}>
          <span className="flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5" /> {medalStyle.label}
          </span>
          <span className="text-[10px] opacity-80">综合评分 {candidate.ranking.score.toFixed(2)}</span>
        </div>
      )}

      {/* Main card header toggle */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 text-left outline-none"
        aria-label={`${isExpanded ? '折叠' : '展开'}候选情形 #${candidate.rank}`}
      >
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${meta.className}`}>
            <Icon className="h-3 w-3" />{meta.label}
          </span>
          <strong className="text-monokai-fg">#{candidate.rank} · 优先分 {candidate.ranking.score.toFixed(2)}</strong>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-monokai-comment">
          <span>覆盖 {candidate.count} 个实体</span>
          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </div>
      </button>

      {/* Coverage Progress Bar */}
      <div className="mt-2.5 h-1.5 w-full rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-monokai-cyan/60 to-monokai-cyan transition-all duration-500"
          style={{ width: `${maxCount > 0 ? (candidate.count / maxCount) * 100 : 0}%` }}
        />
      </div>

      {/* Combined State Pills */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {candidate.states.map(s => (
          <span key={s.featureId} className="rounded bg-white/5 px-2 py-0.5 text-[10px]">
            <span className="text-monokai-comment">{s.featureName} = </span>
            <strong className="text-monokai-fg">{displayValue(s.value)}</strong>
          </span>
        ))}
      </div>

      {/* Natural Language Explanation Box */}
      <div className="mt-2.5 space-y-1.5 rounded-lg border border-monokai-cyan/20 bg-monokai-cyan/[0.04] p-2.5 text-xs text-monokai-fg">
        <div className="flex items-center gap-1.5 font-bold text-monokai-cyan text-[11px]">
          <BookOpen className="h-3.5 w-3.5" /> 特征交叉推演原理解释
        </div>
        <div className="text-[11px] leading-relaxed text-monokai-fg/90">
          <span className="font-bold text-monokai-cyan">1. 组合特征：</span>{explanation.featuresCombined}
        </div>
        <div className="text-[11px] leading-relaxed text-monokai-fg/90">
          <span className="font-bold text-monokai-yellow">2. 聚合原因：</span>{explanation.whyTogether}
        </div>
        <div className="text-[11px] leading-relaxed text-monokai-fg/90">
          <span className="font-bold text-monokai-green">3. 情形表达：</span>{explanation.situationExpressed}
        </div>
      </div>

      {/* Tags & Actions */}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1.5 pt-1.5 border-t border-white/[0.05]">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-monokai-comment font-bold mr-1 flex items-center gap-1">
            <Tag className="h-3 w-3 text-monokai-yellow" /> 标记:
          </span>
          {tags.map(t => (
            <span key={t} className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 text-[10px] text-monokai-yellow font-bold">
              {t}
              <button type="button" onClick={() => onRemoveTag(candidate.id, t)} className="hover:text-monokai-pink">×</button>
            </span>
          ))}

          {/* Add Tag Dropdown */}
          <div className="relative inline-block">
            <button
              type="button"
              onClick={() => setTagPickerOpen(prev => !prev)}
              className="rounded border border-dashed border-white/20 px-2 py-0.5 text-[10px] text-monokai-comment hover:border-monokai-accent/70 hover:text-monokai-accent transition-colors cursor-pointer"
            >
              + 打标签
            </button>
            {tagPickerOpen && (
              <div className="absolute left-0 top-full z-20 mt-1 flex w-44 flex-col gap-1 rounded-lg border border-monokai-border bg-monokai-surface p-2 shadow-xl">
                <div className="text-[9px] font-bold text-monokai-comment mb-0.5">选择预置组合标签:</div>
                {PRESET_TAGS.map(pt => (
                  <button
                    key={pt.id}
                    type="button"
                    onClick={() => {
                      onAddTag(candidate.id, pt.label);
                      setTagPickerOpen(false);
                    }}
                    className="rounded px-2 py-1 text-left text-[10px] hover:bg-monokai-elevated text-monokai-fg transition-colors cursor-pointer"
                  >
                    {pt.label}
                  </button>
                ))}
                <div className="my-1 h-px bg-monokai-border/60" />
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    placeholder="自定义标签..."
                    value={customTagInput}
                    onChange={e => setCustomTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddCustom(); }}
                    className="w-full rounded bg-monokai-bg px-1.5 py-0.5 text-[10px] text-monokai-fg border border-monokai-border outline-none focus:border-monokai-accent transition-colors"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustom}
                    className="shrink-0 rounded bg-monokai-accent px-1.5 py-0.5 text-[10px] font-bold text-monokai-bg hover:bg-monokai-accent-hover transition-colors cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Drilldown */}
      {isExpanded && (
        <div className="mt-3 space-y-3 border-t border-white/[0.06] pt-3">
          {/* Source Objects */}
          {sourceObjectNames.length > 0 && (
            <div className="rounded-lg border border-monokai-green/20 bg-monokai-green/5 p-2 text-[10px]">
              <div className="mb-1 font-bold text-monokai-green">真实支撑实体依据 ({sourceObjectNames.length} 个)</div>
              <div className="text-monokai-fg max-h-16 overflow-auto">{sourceObjectNames.join('、')}</div>
            </div>
          )}

          {/* Missing conditions if any */}
          {candidate.missingConditions.length > 0 && (
            <div className="rounded-lg bg-monokai-yellow/10 p-2 text-[10px] text-monokai-yellow">
              <div className="mb-1 flex items-center gap-1 font-bold">
                <AlertTriangle className="h-3.5 w-3.5" /> 尚缺关键条件
              </div>
              {candidate.missingConditions.map((mc, idx) => (
                <div key={idx} className="ml-4">· {mc.label}: {mc.reason}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
};
