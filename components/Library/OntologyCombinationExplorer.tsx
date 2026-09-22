import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, BarChart3, CheckCircle2, ChevronDown, ChevronRight,
  Filter, Play, Search, XCircle, BookOpen, Tag, Plus, Layers, Database,
} from 'lucide-react';
import { useSqlEditorStore } from '../../hooks/store/useSqlEditorStore';
import { useAppStore } from '../../hooks/store/useAppStore';
import { Tab } from '../../types';
import { toastService } from '../../services/toastService';

import {
  compileRule,
  renderRuleLisp,
  validateRule,
  type InferenceReport,
  type RuleDefinition,
  type SituationCandidate,
  type EvaluationTrace,
} from '../../services/ontology/ontologyInferenceEngine';
import { ontologyInferenceModule } from '../../services/ontology/ontologyInferenceModule';
import {
  createOntologySnapshot,
  type OntologyProjectionSource,
  type OntologyReasoningCatalog,
} from '../../services/ontology/ontologyReasoningModule';
import {
  createOntologySituationModel,
  exploreOntologySituations,
} from '../../services/ontology/ontologySituationExplorer';

export interface OntologyCombinationExplorerProps {
  source: OntologyProjectionSource;
  catalog: OntologyReasoningCatalog;
  rules?: RuleDefinition[];
}

const STATUS_META = {
  ESTABLISHED: { label: '已成立', className: 'text-monokai-accent bg-emerald-500/10 border border-monokai-border-subtle', icon: CheckCircle2 },
  POSSIBLE: { label: '可能出现', className: 'text-monokai-fg-muted bg-monokai-surface border border-monokai-border-subtle', icon: Filter },
  EXCLUDED: { label: '已排除', className: 'text-rose-400 bg-rose-500/10 border border-monokai-border-subtle', icon: XCircle },
} as const;

const TRUTH_STYLE: Record<string, string> = {
  TRUE: 'text-monokai-accent bg-emerald-500/10 border border-monokai-border-subtle',
  FALSE: 'text-rose-400 bg-rose-500/10 border border-monokai-border-subtle',
  UNKNOWN: 'text-amber-400 bg-amber-500/10 border border-monokai-border-subtle',
};

const displayValue = (value: unknown): string =>
  typeof value === 'string' ? value : JSON.stringify(value);

export function generateCandidateSql(candidate: SituationCandidate, objectTypeName = 'objects', isView = false): string {
  const whereClauses = candidate.states.map(s => {
    const val = typeof s.value === 'string' ? `'${s.value}'` : JSON.stringify(s.value);
    return `json_extract_string(properties, '$.${s.featureName}') = ${val}`;
  });
  const whereStr = whereClauses.length > 0 ? whereClauses.join('\n  AND ') : '1 = 1';
  const viewName = `v_situation_${candidate.rank}_${Date.now().toString(36).slice(-4)}`;

  if (isView) {
    return `-- [DuckDB 衍生视图] 情形 #${candidate.rank} (优先级: ${candidate.ranking.score.toFixed(2)}, 覆盖样本: ${candidate.count})
CREATE OR REPLACE VIEW ${viewName} AS
SELECT 
  id,
  name,
  properties
FROM ${objectTypeName}
WHERE ${whereStr};

-- 验证视图数据
SELECT * FROM ${viewName} LIMIT 50;`;
  }

  return `-- [DuckDB 下推推演] 情形 #${candidate.rank} 样本验证 (覆盖 ${candidate.count} 个实体)
SELECT 
  id,
  name,
  properties
FROM ${objectTypeName}
WHERE ${whereStr};`;
}

const TraceNode: React.FC<{ trace: EvaluationTrace; depth?: number }> = ({ trace, depth = 0 }) => {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = trace.children && trace.children.length > 0;
  const style = TRUTH_STYLE[trace.value] ?? 'text-monokai-comment';

  return (
    <div className="mt-1" style={{ paddingLeft: depth > 0 ? 16 : 0 }}>
      <div className="flex items-start gap-1.5 text-[10px]">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded(current => !current)}
            className="mt-0.5 shrink-0 text-monokai-comment hover:text-monokai-fg"
            aria-label={expanded ? '折叠' : '展开'}
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="mt-0.5 inline-block h-3 w-3 shrink-0" />
        )}
        <span className={`rounded px-1.5 py-0.5 font-mono ${style}`}>{trace.value}</span>
        <span className="text-monokai-fg-muted">{trace.label}</span>
        {trace.reason && (
          <span className="text-monokai-yellow">— {trace.reason}</span>
        )}
        {trace.actual !== undefined && (
          <span className="text-monokai-comment">实际={displayValue(trace.actual)}</span>
        )}
        {trace.expected !== undefined && (
          <span className="text-monokai-comment">期望={displayValue(trace.expected)}</span>
        )}
      </div>
      {expanded && hasChildren && trace.children!.map((child, index) => (
        <TraceNode key={child.nodeId ?? index} trace={child} depth={depth + 1} />
      ))}
    </div>
  );
};

const EvidenceBar: React.FC<{ value: number; max: number }> = ({ value, max }) => {
  const percent = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full rounded-full bg-monokai-surface">
      <div
        className="h-full rounded-full bg-monokai-accent transition-all duration-300"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
};

export const PRESET_TAGS = [
  { id: 'tag_key', label: '⭐ 重点衍生', color: 'amber' },
  { id: 'tag_freq', label: '📌 高频组合', color: 'sky' },
  { id: 'tag_evidence', label: '🔍 待验证', color: 'orange' },
  { id: 'tag_established', label: '✅ 逻辑成立', color: 'emerald' },
  { id: 'tag_missing', label: '⚠️ 条件缺失', color: 'rose' },
  { id: 'tag_custom', label: '📁 观察分组', color: 'indigo' },
];

export function generateCombinationExplanation(candidate: SituationCandidate): {
  featuresCombined: string;
  whyTogether: string;
  situationExpressed: string;
} {
  const featureNames = candidate.states.map(s => s.featureName);
  const stateDetails = candidate.states
    .map(s => `【${s.featureName} = ${displayValue(s.value)}】`)
    .join('、');

  // 1. 组合了哪些特征
  const featuresCombined = `特征组合包含 Ontology 拓扑中的 ${candidate.states.length} 项原生条件：${stateDetails}。`;

  // 2. 它们为什么被放在一起
  const activeRules = candidate.ruleResults.filter(r => r.trace.value === 'TRUE');
  let whyTogether = `这些条件来自同一 Ontology 对象状态（当前匹配覆盖对象：${candidate.count} 个）。`;
  if (activeRules.length > 0) {
    whyTogether += ` 同时被规则《${activeRules.map(r => r.ruleName).join('》、《')}》的前置条件映射绑定归一。`;
  } else if (candidate.status === 'POSSIBLE') {
    whyTogether += ` 属于 Ontology 结构导出的潜在逻辑分支，当前尚待事实数据进一步关联补充。`;
  } else if (candidate.status === 'EXCLUDED') {
    whyTogether += ` 因规则或拓扑冲突判定为互斥矛盾组合。`;
  } else {
    whyTogether += ` 当前没有结构化规则，因此这里只陈述已记录事实，不扩展新的可能世界。`;
  }

  // 3. 这个组合表达了什么情形
  let situationExpressed = `该组合表达了实体在【${featureNames.join(' + ')}】视角下的特定共性模式分支，推理评分 ${candidate.ranking.score.toFixed(2)}，由 ${candidate.count} 个真实对象状态支持。`;
  if (candidate.status === 'ESTABLISHED') {
    situationExpressed += ` 属于逻辑全通的真实成立情形。`;
  } else if (candidate.status === 'POSSIBLE') {
    situationExpressed += ` 属于可继续向下探索的潜在衍生分支。`;
  } else {
    situationExpressed += ` 属于可直接排除的无效否定组合。`;
  }

  return { featuresCombined, whyTogether, situationExpressed };
}

const CandidateCard: React.FC<{
  candidate: SituationCandidate;
  sourceObjectNames: string[];
  maxCount: number;
  isExpanded: boolean;
  onToggle: () => void;
  tags: string[];
  onAddTag: (candidateId: string, tag: string) => void;
  onRemoveTag: (candidateId: string, tag: string) => void;
}> = ({ candidate, sourceObjectNames, maxCount, isExpanded, onToggle, tags, onAddTag, onRemoveTag }) => {
  const meta = STATUS_META[candidate.status];
  const Icon = meta.icon;
  const explanation = useMemo(() => generateCombinationExplanation(candidate), [candidate]);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [customTagInput, setCustomTagInput] = useState('');

  const handleAddCustom = () => {
    if (customTagInput.trim()) {
      onAddTag(candidate.id, customTagInput.trim());
      setCustomTagInput('');
      setTagPickerOpen(false);
    }
  };

  return (
    <article className="rounded-xl border border-monokai-border bg-monokai-sidebar/70 p-3 text-xs transition-all duration-150 hover:border-monokai-border-strong">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 text-left"
        aria-label={`${isExpanded ? '折叠' : '展开'}候选情形 ${candidate.rank}`}
      >
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium ${meta.className}`}>
            <Icon className="h-3 w-3" />{meta.label}
          </span>
          <strong className="text-monokai-fg font-semibold">#{candidate.rank} · 优先分 {candidate.ranking.score.toFixed(2)}</strong>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-monokai-comment">
          <span>覆盖 {candidate.count} 个对象</span>
          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </div>
      </button>

      <div className="mt-2">
        <EvidenceBar value={candidate.count} max={maxCount} />
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {candidate.states.map(state => (
          <span key={state.featureId} className="rounded bg-monokai-surface border border-monokai-border px-2 py-0.5 text-[11px] text-monokai-fg-muted">
            {state.featureName} = <span className="font-mono text-monokai-fg-muted">{displayValue(state.value)}</span>
          </span>
        ))}
      </div>

      {/* 组合自然语言解读说明 (直接回答3个核心问题) */}
      <div className="mt-2.5 space-y-1.5 rounded-lg border border-monokai-border bg-monokai-bg/70 p-2.5 text-xs">
        <div className="flex items-center gap-1.5 font-semibold text-monokai-cyan text-[11px]">
          <BookOpen className="h-3.5 w-3.5" /> 特征组合自然语言解释说明
        </div>
        <div className="text-[11px] leading-relaxed text-monokai-fg-muted">
          <span className="font-semibold text-monokai-cyan">1. 组合特征：</span>{explanation.featuresCombined}
        </div>
        <div className="text-[11px] leading-relaxed text-monokai-fg-muted">
          <span className="font-semibold text-monokai-yellow">2. 聚合原因：</span>{explanation.whyTogether}
        </div>
        <div className="text-[11px] leading-relaxed text-monokai-fg-muted">
          <span className="font-semibold text-monokai-accent">3. 情形表达：</span>{explanation.situationExpressed}
        </div>
      </div>

      {/* 标签管理与衍生探索操作栏 */}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-white/[0.06]">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-monokai-comment font-medium mr-1 flex items-center gap-1">
            <Tag className="h-3 w-3 text-monokai-yellow" /> 标签:
          </span>
          {tags.map(t => (
            <span key={t} className="inline-flex items-center gap-1 rounded bg-monokai-surface px-2 py-0.5 text-[10px] text-monokai-yellow font-medium border border-monokai-border-strong">
              {t}
              <button type="button" onClick={() => onRemoveTag(candidate.id, t)} className="hover:text-monokai-pink text-monokai-comment">×</button>
            </span>
          ))}
          <div className="relative inline-block">
            <button
              type="button"
              onClick={() => setTagPickerOpen(prev => !prev)}
              className="rounded border border-dashed border-monokai-border-strong bg-monokai-sidebar/60 px-2 py-0.5 text-[10px] text-monokai-comment hover:border-monokai-info hover:text-monokai-info transition-colors"
            >
              + 打标签
            </button>
            {tagPickerOpen && (
              <div className="absolute left-0 top-full z-20 mt-1 flex w-44 flex-col gap-1 rounded-lg border border-monokai-border-strong bg-monokai-sidebar p-2 shadow-xl">
                <div className="text-[9px] font-bold text-monokai-comment mb-0.5">选择预置组合标签:</div>
                {PRESET_TAGS.map(pt => (
                  <button
                    key={pt.id}
                    type="button"
                    onClick={() => {
                      onAddTag(candidate.id, pt.label);
                      setTagPickerOpen(false);
                    }}
                    className="rounded px-2 py-1 text-left text-[10px] hover:bg-monokai-surface text-monokai-fg-muted transition-colors"
                  >
                    {pt.label}
                  </button>
                ))}
                <div className="my-1 h-px bg-monokai-surface" />
                <div className="text-[9px] font-bold text-monokai-comment mb-0.5">自定义标签:</div>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    placeholder="标签名称..."
                    value={customTagInput}
                    onChange={e => setCustomTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddCustom(); }}
                    className="w-full rounded bg-monokai-bg px-1.5 py-0.5 text-[10px] text-monokai-fg-muted border border-monokai-border-strong outline-none focus:border-monokai-info"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustom}
                    className="shrink-0 rounded bg-monokai-accent/20 px-1.5 py-0.5 text-[10px] font-bold text-monokai-cyan hover:bg-monokai-accent/30"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action: Push to DuckDB SQL / Create View */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            title="将该情形的下推条件带入 SQL 编辑器执行验证"
            onClick={() => {
              const sql = generateCandidateSql(candidate, 'objects', false);
              useSqlEditorStore.getState().updateActiveTab({ code: sql });
              useAppStore.getState().setActiveTab(Tab.SQL);
              toastService.success('已带入 SQL 编辑器', `情形 #${candidate.rank} 下推验证查询`);
            }}
            className="flex items-center gap-1 rounded bg-monokai-surface border border-monokai-border px-2 py-0.5 text-[10px] font-medium text-monokai-fg-muted hover:text-monokai-accent hover:border-monokai-accent transition-colors cursor-pointer"
          >
            <Play className="h-3 w-3" /> SQL 验证
          </button>
          <button
            type="button"
            title="在 DuckDB 中为该情形创建持久化/临时视图"
            onClick={() => {
              const sql = generateCandidateSql(candidate, 'objects', true);
              useSqlEditorStore.getState().updateActiveTab({ code: sql });
              useAppStore.getState().setActiveTab(Tab.SQL);
              toastService.success('已生成视图创建脚本', `视图 v_situation_${candidate.rank}`);
            }}
            className="flex items-center gap-1 rounded bg-monokai-surface border border-monokai-border px-2 py-0.5 text-[10px] font-medium text-monokai-fg-muted hover:bg-monokai-hover hover:text-white transition-colors cursor-pointer"
          >
            <Layers className="h-3 w-3" /> 建视图
          </button>
        </div>
      </div>

      {candidate.ranking.reasons.length > 0 && (
        <div className="mt-2 space-y-0.5 text-[10px] text-monokai-comment">
          {candidate.ranking.reasons.map(reason => (
            <div key={reason}>· {reason}</div>
          ))}
        </div>
      )}

      {isExpanded && (
        <div className="mt-3 space-y-3 border-t border-monokai-border pt-3">
          {sourceObjectNames.length > 0 && (
            <div className="rounded-lg border border-monokai-border-subtle bg-emerald-500/5 p-2 text-[10px]">
              <div className="mb-1 font-semibold text-monokai-accent">真实依据对象</div>
              <div className="text-monokai-fg-muted">{sourceObjectNames.join('、')}</div>
            </div>
          )}
          {/* Ranking breakdown */}
          <div className="grid grid-cols-4 gap-1.5 text-[10px]">
            {([
              ['覆盖', candidate.ranking.evidenceCoverage, 'text-monokai-fg-muted bg-monokai-surface border border-monokai-border-subtle'],
              ['可靠', candidate.ranking.reliability, 'text-monokai-accent bg-emerald-500/10 border border-monokai-border-subtle'],
              ['满足', candidate.ranking.conditionSatisfaction, 'text-monokai-accent bg-emerald-500/10 border border-monokai-border-subtle'],
              ['冲突', -candidate.ranking.conflictPenalty, 'text-rose-400 bg-rose-500/10 border border-monokai-border-subtle'],
              ['未知', -candidate.ranking.unknownPenalty, 'text-amber-400 bg-amber-500/10 border border-monokai-border-subtle'],
              ['历史', candidate.ranking.historicalValidation, 'text-monokai-comment bg-monokai-surface/60 border border-monokai-border-subtle'],
              ['人工', candidate.ranking.manualWeight, 'text-monokai-fg-muted bg-monokai-surface border border-monokai-border-subtle'],
            ] as [string, number, string][]).map(([label, value, style]) => (
              <div key={label} className={`rounded-lg border p-1.5 text-center ${style}`}>
                <div className="opacity-90">{label}</div>
                <div className="font-mono font-bold text-monokai-fg">{value.toFixed(2)}</div>
              </div>
            ))}
          </div>

          {/* Rule evaluation traces */}
          {candidate.ruleResults.length > 0 && (
            <div className="rounded-lg border border-monokai-border bg-monokai-bg/80 p-2">
              <div className="mb-1.5 text-[10px] font-semibold text-monokai-accent">规则评估路径</div>
              {candidate.ruleResults.map(result => (
                <div key={result.ruleId} className="mb-2 last:mb-0">
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className={`rounded px-1.5 py-0.5 font-mono ${TRUTH_STYLE[result.trace.value]}`}>
                      {result.trace.value}
                    </span>
                    <span className="font-semibold text-monokai-fg-muted">{result.ruleName}</span>
                    <span className="text-monokai-comment">
                      T={result.trueCount} F={result.falseCount} U={result.unknownCount}
                    </span>
                  </div>
                  <TraceNode trace={result.trace} />
                </div>
              ))}
            </div>
          )}

          {candidate.missingConditions.length > 0 && (
            <div className="rounded-lg border border-monokai-border-subtle bg-amber-500/10 p-2 text-[10px] text-amber-300">
              <div className="mb-1 flex items-center gap-1.5 font-semibold text-amber-300">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                仍缺具体条件
              </div>
              {candidate.missingConditions.map(condition => (
                <div key={`${condition.ruleId}:${condition.nodeId}`} className="ml-4 mt-1 text-monokai-fg-muted">
                  {condition.label} · {condition.reason}
                  {condition.expected !== undefined && ` · 期望 ${displayValue(condition.expected)}`}
                </div>
              ))}
            </div>
          )}

          {candidate.counterfactuals.length > 0 && (
            <div className="rounded-lg border border-monokai-border-subtle bg-monokai-surface/60 p-2 text-[10px]">
              <div className="mb-1 font-semibold text-monokai-accent">改变条件会得到什么</div>
              {candidate.counterfactuals.map(suggestion => (
                <div key={suggestion.targetCandidateId} className="mt-1 text-monokai-fg-muted">
                  改变 {suggestion.editDistance} 项 → {STATUS_META[suggestion.targetStatus].label}：
                  {suggestion.changes.map(change =>
                    `${change.featureName} ${displayValue(change.from)} → ${displayValue(change.to)}`,
                  ).join('；')}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
};


export const OntologyCombinationExplorer: React.FC<OntologyCombinationExplorerProps> = ({
  source,
  catalog,
  rules: propRules,
}) => {
  const snapshot = useMemo(() => createOntologySnapshot(source, catalog), [catalog, source]);

  const objectTypes = snapshot.objectTypes;


  const [objectTypeId, setObjectTypeId] = useState<number>(() => objectTypes[0]?.id ?? 0);

  // Sync objectTypeId if current ID is not in objectTypes list
  useEffect(() => {
    if (!objectTypes.some(t => t.id === objectTypeId) && objectTypes.length > 0) {
      setObjectTypeId(objectTypes[0].id);
    }
  }, [objectTypes, objectTypeId]);

  const [selectedFeatureIds, setSelectedFeatureIds] = useState<string[]>([]);
  const [rules, setRules] = useState<RuleDefinition[]>(propRules ?? []);
  const [featureReliability, setFeatureReliability] = useState<Record<string, number>>({});
  const [manualWeights, setManualWeights] = useState<Record<string, number>>({});
  const [report, setReport] = useState<InferenceReport | null>(null);
  const [error, setError] = useState('');
  const [expandedCandidateId, setExpandedCandidateId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'ESTABLISHED' | 'POSSIBLE' | 'EXCLUDED'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Combination quantity & tag collection state
  const [topKLimit, setTopKLimit] = useState<number>(30);
  const [candidateTags, setCandidateTags] = useState<Record<string, string[]>>({});
  const [tagFilter, setTagFilter] = useState<string>('all');

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

  // Sync rules from props when provided
  useEffect(() => {
    if (propRules) {
      setRules(propRules);
    }
  }, [propRules]);

  const model = useMemo(
    () => createOntologySituationModel(snapshot, { objectTypeId }),
    [objectTypeId, snapshot],
  );
  const executableRules = useMemo(() => rules.filter(rule =>
    rule.status === 'active' && validateRule(rule, model.features, rules).valid,
  ), [model.features, rules]);

  useEffect(() => {
    if (propRules) return; // Skip DB load if props rules provided
    let alive = true;
    void ontologyInferenceModule.initialize()
      .then(() => ontologyInferenceModule.loadWorkspace())
      .then(workspace => { if (alive) setRules(workspace.rules); })
      .catch(caught => { if (alive) setError(caught instanceof Error ? caught.message : String(caught)); });
    return () => { alive = false; };
  }, [propRules]);

  useEffect(() => {
    const rankedFeatures = [...model.features].sort((left, right) => {
      const leftCoverage = model.rows.filter(row => row[left.id] !== undefined && row[left.id] !== null).length;
      const rightCoverage = model.rows.filter(row => row[right.id] !== undefined && row[right.id] !== null).length;
      return rightCoverage - leftCoverage
        || Number(left.source.kind === 'ontology_relation') - Number(right.source.kind === 'ontology_relation')
        || left.id.localeCompare(right.id);
    });
    let compatibleRows = model.rows;
    const initialFeatureIds: string[] = [];
    for (const feature of rankedFeatures) {
      const coveredRows = compatibleRows.filter(row =>
        row[feature.id] !== undefined && row[feature.id] !== null,
      );
      if (coveredRows.length === 0) continue;
      initialFeatureIds.push(feature.id);
      compatibleRows = coveredRows;
      if (initialFeatureIds.length >= 4) break;
    }

    setSelectedFeatureIds(initialFeatureIds);
    setExpandedCandidateId(null);

    // Auto-run initial deduction so the screen is immediately populated with candidate situations!
    if (snapshot && initialFeatureIds.length > 0) {
      try {
        setReport(exploreOntologySituations(snapshot, {
          objectTypeId,
          selectedFeatureIds: initialFeatureIds,
          rules: executableRules,
          selectedRuleIds: executableRules.map(rule => rule.id),
          topK: topKLimit,
          beamWidth: 200,
          ranking: { featureReliability, manualWeights },
        }));
      } catch (err) {
        // Fallback silently if initial deduction cannot run
      }
    }
  }, [model, executableRules, snapshot, objectTypeId, featureReliability, manualWeights, topKLimit]);

  const run = () => {
    setError('');
    setExpandedCandidateId(null);
    try {
      setReport(exploreOntologySituations(snapshot, {
        objectTypeId,
        selectedFeatureIds,
        rules: executableRules,
        selectedRuleIds: executableRules.map(rule => rule.id),
        topK: topKLimit,
        beamWidth: 200,
        ranking: { featureReliability, manualWeights },
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const filteredCandidates = useMemo(() => {
    if (!report) return [];
    let candidates = report.rankedCandidates;
    if (statusFilter !== 'all') {
      candidates = candidates.filter(candidate => candidate.status === statusFilter);
    }
    if (tagFilter !== 'all') {
      if (tagFilter === 'tagged_only') {
        candidates = candidates.filter(c => (candidateTags[c.id] || []).length > 0);
      } else if (tagFilter === 'untagged_only') {
        candidates = candidates.filter(c => (candidateTags[c.id] || []).length === 0);
      } else {
        candidates = candidates.filter(c => (candidateTags[c.id] || []).includes(tagFilter));
      }
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      candidates = candidates.filter(candidate =>
        candidate.states.some(state =>
          state.featureName.toLowerCase().includes(query)
          || displayValue(state.value).toLowerCase().includes(query),
        ) || candidate.ranking.reasons.some(r => r.toLowerCase().includes(query)),
      );
    }
    return candidates;
  }, [candidateTags, report, searchQuery, statusFilter, tagFilter]);


  const maxCount = useMemo(
    () => Math.max(1, ...(report?.rankedCandidates.map(candidate => candidate.count) ?? [1])),
    [report],
  );

  if (objectTypes.length === 0) {
    return (
      <section aria-label="特征组合推演" className="flex h-full items-center justify-center rounded-xl border border-dashed border-monokai-border p-8 text-sm text-monokai-comment">
        当前 Ontology 没有对象类型，无法建立推演世界。
      </section>
    );
  }

  return (
    <section aria-label="特征组合推演" className="flex h-full min-h-0 flex-col overflow-hidden text-monokai-fg">
      {error && <div role="alert" className="mb-3 rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-monokai-pink">{error}</div>}

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[240px_minmax(280px,0.9fr)_minmax(440px,1.4fr)]">
        {/* Column 1: Object type & controls */}
        <div className="flex flex-col gap-4 overflow-auto">
          <label className="text-xs font-semibold text-monokai-fg-muted">
            对象类型
            <select
              aria-label="推演对象类型"
              value={objectTypeId}
              onChange={event => setObjectTypeId(Number(event.target.value))}
              className="mt-2 w-full rounded-lg border border-monokai-border bg-monokai-sidebar px-3 py-2 text-xs text-monokai-fg-muted outline-none focus:border-monokai-info"
            >
              {objectTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
            </select>
          </label>

          <label className="text-xs font-semibold text-monokai-fg-muted">
            组合生成数量 (Top-K)
            <select
              aria-label="组合生成数量"
              value={topKLimit}
              onChange={event => setTopKLimit(Number(event.target.value))}
              className="mt-2 w-full rounded-lg border border-monokai-border bg-monokai-sidebar px-3 py-2 text-xs text-monokai-fg-muted outline-none focus:border-monokai-info"
            >
              {[10, 20, 30, 50, 100].map(k => (
                <option key={k} value={k}>生成前 {k} 条情形组合</option>
              ))}
            </select>
          </label>

          <div className="rounded-xl border border-monokai-border bg-monokai-sidebar/50 p-3 text-[11px] leading-5 text-monokai-comment space-y-1">
            <div className="flex justify-between"><span>真实对象：</span><span className="font-mono text-monokai-fg-muted">{model.rows.length}</span></div>
            <div className="flex justify-between"><span>可执行约束：</span><span className="font-mono text-monokai-fg-muted">{executableRules.length}</span></div>
            <div className="flex justify-between"><span>已生成组合：</span><span className="font-mono text-monokai-fg-muted">{report?.rankedCandidates.length ?? 0} 条</span></div>
            <div className="text-[10px] text-monokai-comment pt-1 border-t border-monokai-border/80">未定义结构化规则时只展示当前事实；补充可执行规则后才能探索变化。</div>
          </div>

          <button
            type="button"
            onClick={run}
            disabled={selectedFeatureIds.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-monokai-accent px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition-all duration-150 hover:bg-monokai-accent disabled:opacity-40"
          >
            <Play className="h-3.5 w-3.5" /> 生成并验证组合
          </button>
        </div>

        {/* Column 2: Feature selection */}
        <fieldset className="flex flex-col overflow-hidden">
          <legend className="mb-2 text-xs font-semibold text-monokai-fg-muted">选择可组合特征</legend>
          <div className="flex-1 space-y-2 overflow-auto pr-1">
            {model.features.map(feature => (
              <label key={feature.id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-monokai-border bg-monokai-sidebar/40 p-2 text-xs transition-all duration-150 hover:border-monokai-border-strong hover:bg-monokai-sidebar/70">
                <input
                  type="checkbox"
                  checked={selectedFeatureIds.includes(feature.id)}
                  onChange={() => setSelectedFeatureIds(current => current.includes(feature.id)
                    ? current.filter(id => id !== feature.id)
                    : [...current, feature.id])}
                  className="mt-0.5 rounded border-monokai-border-strong bg-monokai-surface text-monokai-cyan focus:ring-monokai-accent/70"
                />
                <span className="flex-1">
                  <span className="block font-medium text-monokai-fg-muted">{feature.name}</span>
                  <span className="text-[10px] text-monokai-comment">
                    {feature.source.kind === 'ontology_property' ? '真实属性' : '真实有向关系'} · {feature.valueType}
                  </span>
                  {selectedFeatureIds.includes(feature.id) && (
                    <span className="mt-1 grid grid-cols-2 gap-1 text-[9px] text-monokai-comment">
                      <span>可靠度<input aria-label={`${feature.name} 可靠度`} type="number" min="0" max="1" step="0.1" value={featureReliability[feature.id] ?? 1} onChange={event => setFeatureReliability(current => ({ ...current, [feature.id]: Number(event.target.value) }))} className="ml-1 w-12 rounded bg-monokai-surface border border-monokai-border-strong px-1 text-monokai-fg-muted" /></span>
                      <span>权重<input aria-label={`${feature.name} 人工权重`} type="number" min="-1" max="1" step="0.1" value={manualWeights[feature.id] ?? 0} onChange={event => setManualWeights(current => ({ ...current, [feature.id]: Number(event.target.value) }))} className="ml-1 w-12 rounded bg-monokai-surface border border-monokai-border-strong px-1 text-monokai-fg-muted" /></span>
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Column 3: Results */}
        <div className="flex flex-col overflow-hidden">
          {!report ? (
            <div className="flex min-h-48 flex-1 items-center justify-center rounded-xl border border-dashed border-monokai-border p-6 text-center text-xs text-monokai-comment">
              <div>
                <BarChart3 className="mx-auto mb-3 h-8 w-8 text-monokai-comment" />
                <p className="text-monokai-fg-muted">选择特征后生成候选情形</p>
                <p className="mt-1 text-[10px] text-monokai-comment">结果会区分已成立、可能出现与已排除</p>
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {/* Summary stats */}
              <div className="mb-3 grid shrink-0 grid-cols-4 gap-2 text-center text-[11px]">
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2 text-monokai-accent">已成立<br /><strong className="text-sm font-semibold">{report.establishedCandidates.length}</strong></div>
                <div className="rounded-lg bg-monokai-accent/10 border border-monokai-cyan/40 p-2 text-monokai-cyan">可能<br /><strong className="text-sm font-semibold">{report.possibleCandidates.length}</strong></div>
                <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2 text-monokai-pink">排除<br /><strong className="text-sm font-semibold">{report.excludedCandidates.length}</strong></div>
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2 text-monokai-yellow">未知对象<br /><strong className="text-sm font-semibold">{report.unknownPopulation}</strong></div>
              </div>

              {report.truncated && (
                <div className="mb-3 flex shrink-0 gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-2 text-[11px] text-monokai-yellow">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-monokai-yellow" /> 候选超过探索上限，当前展示为有界结果。
                </div>
              )}

              {/* Filter bar: Status, Probability, Tag Collection and Candidate Search */}
              <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-monokai-border bg-monokai-sidebar/70 p-2">
                <div className="flex items-center gap-1">
                  <span className="mr-1 text-[10px] font-medium text-monokai-comment">状态:</span>
                  {(['all', 'ESTABLISHED', 'POSSIBLE', 'EXCLUDED'] as const).map(status => {
                    const labels = { all: '全部', ESTABLISHED: '已成立', POSSIBLE: '可能', EXCLUDED: '排除' };
                    const isActive = statusFilter === status;
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setStatusFilter(status)}
                        className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
                          isActive
                            ? 'border border-monokai-cyan/40 bg-monokai-accent/20 text-monokai-cyan'
                            : 'border border-transparent bg-monokai-surface text-monokai-comment hover:bg-monokai-elevated hover:text-monokai-fg-muted'
                        }`}
                      >
                        {labels[status]}
                      </button>
                    );
                  })}
                </div>

                <div className="mx-1 h-4 w-px bg-monokai-border" />

                {/* 标签集合筛选 */}
                <div className="flex items-center gap-1">
                  <span className="mr-1 text-[10px] font-medium text-monokai-comment">标签:</span>
                  <select
                    aria-label="标签集合筛选"
                    value={tagFilter}
                    onChange={e => setTagFilter(e.target.value)}
                    className="rounded-md border border-monokai-border-strong bg-monokai-bg px-2 py-1 text-[10px] text-monokai-fg-muted outline-none focus:border-monokai-info"
                  >
                    <option value="all">全部标签</option>
                    <option value="tagged_only">已标记集合</option>
                    <option value="untagged_only">未标记集合</option>
                    {PRESET_TAGS.map(pt => (
                      <option key={pt.id} value={pt.label}>{pt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="relative ml-auto flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-monokai-comment" />
                    <input
                      type="text"
                      placeholder="搜索候选情形..."
                      value={searchQuery}
                      onChange={event => setSearchQuery(event.target.value)}
                      className="w-36 rounded-md border border-monokai-border-strong bg-monokai-bg py-1 pl-7 pr-2 text-[10px] text-monokai-fg-muted outline-none focus:border-monokai-info placeholder-zinc-500"
                      aria-label="搜索候选情形"
                    />
                  </div>
                  <span className="whitespace-nowrap text-[10px] text-monokai-comment font-mono">
                    ({filteredCandidates.length} / {report.rankedCandidates.length})
                  </span>
                </div>
              </div>

              {/* Candidate list */}
              <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
                {filteredCandidates.length === 0 ? (
                  <div className="rounded-lg border border-monokai-border bg-monokai-sidebar/40 p-4 text-center text-xs text-monokai-comment">
                    没有匹配的候选情形
                  </div>
                ) : filteredCandidates.map(candidate => (
                  <CandidateCard
                    key={candidate.id}
                    candidate={candidate}
                    sourceObjectNames={candidate.sourceObjectIds.map(objectId => {
                      const object = snapshot.objects.find(item => item.id === objectId);
                      return object ? `${object.name} (#${object.id})` : `#${objectId}`;
                    })}
                    maxCount={maxCount}
                    isExpanded={expandedCandidateId === candidate.id}
                    onToggle={() => setExpandedCandidateId(
                      current => current === candidate.id ? null : candidate.id,
                    )}
                    tags={candidateTags[candidate.id] || []}
                    onAddTag={handleAddTag}
                    onRemoveTag={handleRemoveTag}
                  />

                ))}
              </div>


              {/* Unknown reasons */}
              {report.unknownReasons.length > 0 && (
                <details className="mt-3 shrink-0 rounded-lg border border-monokai-border bg-monokai-sidebar/40 p-2 text-xs">
                  <summary className="cursor-pointer font-semibold text-monokai-yellow"><span>缺失证据</span> ({report.unknownReasons.length})</summary>
                  {report.unknownReasons.map(reason => (
                    <div key={reason.featureId} className="mt-1 text-[11px] text-monokai-comment">
                      {reason.featureName}：{reason.count} 个对象 · {reason.reason}
                    </div>
                  ))}
                </details>
              )}

            </div>
          )}
        </div>
      </div>

      {/* Rule-Situation cross matrix */}
      {report && executableRules.length > 1 && report.rankedCandidates.length > 0 && (
        <details className="mt-4 shrink-0 rounded-xl border border-monokai-border bg-monokai-sidebar/40 p-3 text-xs">
          <summary className="cursor-pointer font-semibold text-indigo-400">规则 × 情形 交叉矩阵</summary>
          <div className="mt-3 overflow-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-monokai-border">
                  <th className="p-1.5 text-left text-monokai-comment">情形</th>
                  {executableRules.map(rule => (
                    <th key={rule.id} className="p-1.5 text-center text-monokai-fg-muted">{rule.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rankedCandidates.slice(0, 20).map(candidate => (
                  <tr key={candidate.id} className="border-t border-monokai-border/60">
                    <td className="p-1.5 text-monokai-comment">
                      #{candidate.rank} {candidate.states.map(state => `${state.featureName}=${displayValue(state.value)}`).join(' ')}
                    </td>
                    {executableRules.map(rule => {
                      const result = candidate.ruleResults.find(item => item.ruleId === rule.id);
                      const truthValue = result?.trace.value ?? 'UNKNOWN';
                      return (
                        <td key={rule.id} className="p-1.5 text-center">
                          <span className={`inline-block rounded px-1.5 py-0.5 font-mono ${TRUTH_STYLE[truthValue]}`}>
                            {truthValue === 'TRUE' ? '✓' : truthValue === 'FALSE' ? '✗' : '?'}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* AST / Lisp / SQL unified view */}
      {executableRules.length > 0 && (
        <details className="mt-4 shrink-0 rounded-xl border border-monokai-border bg-monokai-sidebar/40 p-3 text-xs">
          <summary className="cursor-pointer font-semibold text-indigo-400">同一 AST 的规则、中文 Lisp 与 SQL</summary>
          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            {executableRules.map(rule => {
              const compiled = compileRule(rule, model.features, rules);
              return <div key={rule.id} className="rounded-lg bg-monokai-bg border border-monokai-border p-3"><strong className="text-monokai-fg-muted">{rule.name} · v{rule.version}</strong><pre className="mt-2 overflow-auto whitespace-pre-wrap text-[10px] text-monokai-comment">{renderRuleLisp(rule, model.features)}{`\n\nSQL: ${compiled.predicateSql}`}</pre></div>;
            })}
          </div>
        </details>
      )}
    </section>
  );
};

export default OntologyCombinationExplorer;
