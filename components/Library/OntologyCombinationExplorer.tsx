import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Filter, Play, XCircle } from 'lucide-react';
import {
  compileRule,
  renderRuleLisp,
  validateRule,
  type InferenceReport,
  type RuleDefinition,
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
}

const statusMeta = {
  ESTABLISHED: { label: '已成立', className: 'text-monokai-green bg-monokai-green/10', icon: CheckCircle2 },
  POSSIBLE: { label: '可能出现', className: 'text-monokai-cyan bg-monokai-cyan/10', icon: Filter },
  EXCLUDED: { label: '已排除', className: 'text-monokai-pink bg-monokai-pink/10', icon: XCircle },
} as const;

const displayValue = (value: unknown): string =>
  typeof value === 'string' ? value : JSON.stringify(value);

export const OntologyCombinationExplorer: React.FC<OntologyCombinationExplorerProps> = ({
  source,
  catalog,
}) => {
  const snapshot = useMemo(() => createOntologySnapshot(source, catalog), [catalog, source]);
  const [objectTypeId, setObjectTypeId] = useState(snapshot.objectTypes[0]?.id ?? 0);
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<string[]>([]);
  const [rules, setRules] = useState<RuleDefinition[]>([]);
  const [featureReliability, setFeatureReliability] = useState<Record<string, number>>({});
  const [manualWeights, setManualWeights] = useState<Record<string, number>>({});
  const [report, setReport] = useState<InferenceReport | null>(null);
  const [error, setError] = useState('');
  const model = useMemo(
    () => createOntologySituationModel(snapshot, { objectTypeId }),
    [objectTypeId, snapshot],
  );
  const executableRules = useMemo(() => rules.filter(rule =>
    rule.status === 'active' && validateRule(rule, model.features, rules).valid,
  ), [model.features, rules]);

  useEffect(() => {
    let alive = true;
    void ontologyInferenceModule.initialize()
      .then(() => ontologyInferenceModule.loadWorkspace())
      .then(workspace => { if (alive) setRules(workspace.rules); })
      .catch(caught => { if (alive) setError(caught instanceof Error ? caught.message : String(caught)); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const propertyIds = model.features
      .filter(feature => feature.source.kind === 'ontology_property')
      .slice(0, 4)
      .map(feature => feature.id);
    const relationId = model.features.find(feature =>
      feature.source.kind === 'ontology_relation'
      && model.rows.some(row => row[feature.id] === true),
    )?.id ?? model.features.find(feature => feature.source.kind === 'ontology_relation')?.id;
    setSelectedFeatureIds([...propertyIds, ...(relationId ? [relationId] : [])]);
    setReport(null);
  }, [model]);

  const run = () => {
    setError('');
    try {
      setReport(exploreOntologySituations(snapshot, {
        objectTypeId,
        selectedFeatureIds,
        rules: executableRules,
        selectedRuleIds: executableRules.map(rule => rule.id),
        topK: 30,
        beamWidth: 200,
        ranking: { featureReliability, manualWeights },
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  return (
    <section aria-label="Ontology 特征组合探索" className="mb-5 rounded-2xl border border-monokai-cyan/20 bg-[#12141e] p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-black text-monokai-fg">特征组合探索</h2>
          <p className="mt-1 text-xs leading-5 text-monokai-comment">
            从当前快照自动读取属性与有向关系，主动排列候选情形；规则只负责验证、排除和解释。
          </p>
        </div>
        <div className="rounded-lg bg-black/20 px-3 py-2 text-[11px] text-monokai-comment">
          快照 {snapshot.snapshotId.slice(0, 12)} · 对象 {model.rows.length} · 可选特征 {model.features.length}
        </div>
      </div>

      {error && <div role="alert" className="mt-3 rounded-lg bg-monokai-pink/10 p-3 text-xs text-monokai-pink">{error}</div>}

      <div className="mt-4 grid gap-4 xl:grid-cols-[220px_minmax(300px,0.9fr)_minmax(420px,1.4fr)]">
        <div>
          <label className="text-xs font-bold text-monokai-fg">
            对象类型
            <select
              aria-label="组合推演对象类型"
              value={objectTypeId}
              onChange={event => setObjectTypeId(Number(event.target.value))}
              className="mt-2 w-full rounded-lg border border-white/10 bg-[#0c0d12] px-3 py-2 text-xs"
            >
              {snapshot.objectTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
            </select>
          </label>
          <div className="mt-4 rounded-xl border border-white/[0.07] p-3 text-[11px] leading-5 text-monokai-comment">
            <div>真实对象：{model.rows.length}</div>
            <div>可执行约束：{executableRules.length}</div>
            <div>未定义规则时仍会列出逻辑组合，但不会把它们误报为已成立。</div>
          </div>
          <button
            type="button"
            onClick={run}
            disabled={selectedFeatureIds.length === 0}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-monokai-cyan px-3 py-2.5 text-xs font-black text-black disabled:opacity-40"
          >
            <Play className="h-3.5 w-3.5" /> 生成并验证组合
          </button>
        </div>

        <fieldset>
          <legend className="text-xs font-bold text-monokai-fg">选择可组合特征</legend>
          <div className="mt-2 max-h-64 space-y-2 overflow-auto pr-1">
            {model.features.map(feature => (
              <label key={feature.id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-white/[0.07] p-2 text-xs">
                <input
                  type="checkbox"
                  checked={selectedFeatureIds.includes(feature.id)}
                  onChange={() => setSelectedFeatureIds(current => current.includes(feature.id)
                    ? current.filter(id => id !== feature.id)
                    : [...current, feature.id])}
                />
                <span>
                  <span className="block font-bold text-monokai-fg">{feature.name}</span>
                  <span className="text-[10px] text-monokai-comment">
                    {feature.source.kind === 'ontology_property' ? '真实属性' : '真实有向关系'} · {feature.valueType}
                  </span>
                  {selectedFeatureIds.includes(feature.id) && (
                    <span className="mt-1 grid grid-cols-2 gap-1 text-[9px] text-monokai-comment">
                      <span>可靠度<input aria-label={`${feature.name} 可靠度`} type="number" min="0" max="1" step="0.1" value={featureReliability[feature.id] ?? 1} onChange={event => setFeatureReliability(current => ({ ...current, [feature.id]: Number(event.target.value) }))} className="ml-1 w-12 rounded bg-black/30 px-1" /></span>
                      <span>权重<input aria-label={`${feature.name} 人工权重`} type="number" min="-1" max="1" step="0.1" value={manualWeights[feature.id] ?? 0} onChange={event => setManualWeights(current => ({ ...current, [feature.id]: Number(event.target.value) }))} className="ml-1 w-12 rounded bg-black/30 px-1" /></span>
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          {!report ? (
            <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-monokai-comment">
              选择特征后生成候选；结果会区分已成立、可能出现与已排除。
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
                <div className="rounded-lg bg-monokai-green/10 p-2 text-monokai-green">已成立<br /><strong>{report.establishedCandidates.length}</strong></div>
                <div className="rounded-lg bg-monokai-cyan/10 p-2 text-monokai-cyan">可能<br /><strong>{report.possibleCandidates.length}</strong></div>
                <div className="rounded-lg bg-monokai-pink/10 p-2 text-monokai-pink">排除<br /><strong>{report.excludedCandidates.length}</strong></div>
                <div className="rounded-lg bg-monokai-yellow/10 p-2 text-monokai-yellow">未知对象<br /><strong>{report.unknownPopulation}</strong></div>
              </div>
              {report.truncated && (
                <div className="mt-3 flex gap-2 rounded-lg bg-monokai-yellow/10 p-2 text-[11px] text-monokai-yellow">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> 候选超过探索上限，当前展示为有界结果。
                </div>
              )}
              <div className="mt-3 max-h-[34rem] space-y-2 overflow-auto pr-1">
                {report.rankedCandidates.map(candidate => {
                  const meta = statusMeta[candidate.status];
                  const Icon = meta.icon;
                  return (
                    <article key={candidate.id} className="rounded-xl border border-white/[0.08] bg-black/15 p-3 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`flex items-center gap-1 rounded-full px-2 py-1 text-[10px] ${meta.className}`}><Icon className="h-3 w-3" />{meta.label}</span>
                        <strong className="text-monokai-fg">优先分 {candidate.ranking.score.toFixed(2)}</strong>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {candidate.states.map(state => <span key={state.featureId} className="rounded bg-white/5 px-2 py-1">{state.featureName} = {displayValue(state.value)}</span>)}
                      </div>
                      <div className="mt-2 space-y-1 text-[10px] text-monokai-comment">
                        {candidate.ranking.reasons.map(reason => <div key={reason}>· {reason}</div>)}
                        <div className="font-mono">
                          覆盖 {candidate.ranking.evidenceCoverage.toFixed(2)} · 可靠 {candidate.ranking.reliability.toFixed(2)} · 满足 {candidate.ranking.conditionSatisfaction.toFixed(2)} · 冲突 -{candidate.ranking.conflictPenalty.toFixed(2)} · 未知 -{candidate.ranking.unknownPenalty.toFixed(2)} · 历史 {candidate.ranking.historicalValidation.toFixed(2)} · 人工 {candidate.ranking.manualWeight.toFixed(2)}
                        </div>
                      </div>
                      {candidate.ruleResults.some(result => result.trace.value === 'UNKNOWN') && (
                        <div className="mt-2 text-[10px] text-monokai-yellow">仍缺条件：{candidate.ruleResults.filter(result => result.trace.value === 'UNKNOWN').map(result => result.ruleName).join('、')}</div>
                      )}
                    </article>
                  );
                })}
              </div>
              {report.unknownReasons.length > 0 && (
                <details className="mt-3 rounded-lg border border-white/10 p-2 text-xs">
                  <summary className="cursor-pointer font-bold text-monokai-yellow">缺失证据</summary>
                  {report.unknownReasons.map(reason => <div key={reason.featureId} className="mt-1 text-[11px] text-monokai-comment">{reason.featureName}：{reason.count} 个对象 · {reason.reason}</div>)}
                </details>
              )}
            </>
          )}
        </div>
      </div>

      {executableRules.length > 0 && (
        <details className="mt-4 rounded-xl border border-white/[0.08] p-3 text-xs">
          <summary className="cursor-pointer font-bold text-monokai-amethyst">同一 AST 的规则、中文 Lisp 与 SQL</summary>
          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            {executableRules.map(rule => {
              const compiled = compileRule(rule, model.features, rules);
              return <div key={rule.id} className="rounded-lg bg-black/20 p-3"><strong>{rule.name} · v{rule.version}</strong><pre className="mt-2 overflow-auto whitespace-pre-wrap text-[10px] text-monokai-comment">{renderRuleLisp(rule, model.features)}{`\n\nSQL: ${compiled.predicateSql}`}</pre></div>;
            })}
          </div>
        </details>
      )}
    </section>
  );
};

export default OntologyCombinationExplorer;
