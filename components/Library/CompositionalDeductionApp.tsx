import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Boxes, CheckCircle2, GitBranch, Link2, Play,
  Plus, RotateCcw, ShieldCheck, Trash2, X,
} from 'lucide-react';
import { useOntologyStore } from '../../hooks/useOntologyStore';
import {
  ontologyReasoningModule,
  type OntologyActionSelection,
  type OntologyAssumption,
  type OntologyProjectionSource,
  type OntologyReasoningCatalog,
  type OntologySimulationReport,
  type OntologySimulationScenario,
} from '../../services/ontology/ontologyReasoningModule';

interface CompositionalDeductionAppProps {
  isOpen?: boolean;
  isActive?: boolean;
  onClose?: () => void;
}

const EMPTY_CATALOG: OntologyReasoningCatalog = {
  propertyDefinitions: [], rules: [], actionDefinitions: [],
};

const parseValue = (raw: string): unknown => {
  const value = raw.trim();
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (value !== '' && Number.isFinite(Number(value))) return Number(value);
  try {
    if (value.startsWith('[') || value.startsWith('{')) return JSON.parse(value);
  } catch { /* Keep the explicit string value. */ }
  return raw;
};

const CompositionalDeductionContent: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { state, activeTemplateId } = useOntologyStore();
  const source = useMemo<OntologyProjectionSource>(() => ({
    ...state,
    activeTemplateId: state.activeTemplateId ?? activeTemplateId,
  }), [activeTemplateId, state]);
  const [catalog, setCatalog] = useState<OntologyReasoningCatalog>(EMPTY_CATALOG);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<OntologySimulationReport | null>(null);
  const [assumptions, setAssumptions] = useState<OntologyAssumption[]>([]);
  const [actions, setActions] = useState<OntologyActionSelection[]>([]);
  const [focusObjectId, setFocusObjectId] = useState<number | null>(source.objects?.[0]?.id ?? null);
  const [objectId, setObjectId] = useState<number | null>(source.objects?.[0]?.id ?? null);
  const [propertyId, setPropertyId] = useState('');
  const [assumptionValue, setAssumptionValue] = useState('');
  const [relationSourceId, setRelationSourceId] = useState<number | null>(source.objects?.[0]?.id ?? null);
  const [relationTargetId, setRelationTargetId] = useState<number | null>(source.objects?.[1]?.id ?? source.objects?.[0]?.id ?? null);
  const [relationTypeId, setRelationTypeId] = useState<number | null>(source.linkTypes?.[0]?.id ?? null);
  const [relationKind, setRelationKind] = useState<'add_relation' | 'remove_relation'>('add_relation');
  const [goalEnabled, setGoalEnabled] = useState(false);
  const [goalValue, setGoalValue] = useState('');
  const previousSnapshotId = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      setLoading(true);
      setError('');
      try {
        await ontologyReasoningModule.initialize();
        const loaded = await ontologyReasoningModule.loadCatalog();
        const snapshot = ontologyReasoningModule.createSnapshot(source, loaded);
        if (!alive) return;
        if (previousSnapshotId.current && previousSnapshotId.current !== snapshot.snapshotId) {
          setAssumptions([]);
          setActions([]);
          setReport(null);
          setFocusObjectId(source.objects?.[0]?.id ?? null);
          setObjectId(source.objects?.[0]?.id ?? null);
          setRelationSourceId(source.objects?.[0]?.id ?? null);
          setRelationTargetId(source.objects?.[1]?.id ?? source.objects?.[0]?.id ?? null);
          setRelationTypeId(source.linkTypes?.[0]?.id ?? null);
        }
        previousSnapshotId.current = snapshot.snapshotId;
        setCatalog(loaded);
      } catch (caught) {
        if (alive) setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [source]);

  const activeProperties = useMemo(() => {
    const object = source.objects?.find(item => item.id === objectId);
    return catalog.propertyDefinitions.filter(definition =>
      definition.status === 'active' && definition.objectTypeId === object?.object_type_id,
    );
  }, [catalog.propertyDefinitions, objectId, source.objects]);

  useEffect(() => {
    if (!activeProperties.some(definition => definition.id === propertyId)) {
      setPropertyId(activeProperties[0]?.id ?? '');
    }
  }, [activeProperties, propertyId]);

  const addPropertyAssumption = () => {
    if (objectId === null || !propertyId) return;
    setAssumptions(current => [...current, {
      kind: 'set_property', objectId, propertyId, value: parseValue(assumptionValue),
    }]);
    setAssumptionValue('');
  };

  const addRelationAssumption = () => {
    if (relationSourceId === null || relationTargetId === null || relationTypeId === null) return;
    setAssumptions(current => [...current, {
      kind: relationKind, sourceObjectId: relationSourceId, linkTypeId: relationTypeId,
      targetObjectId: relationTargetId,
    }]);
  };

  const toggleAction = (actionDefinitionId: string) => {
    const definition = catalog.actionDefinitions.find(item => item.id === actionDefinitionId);
    if (!definition) return;
    setActions(current => current.some(item => item.actionDefinitionId === actionDefinitionId)
      ? current.filter(item => item.actionDefinitionId !== actionDefinitionId)
      : [...current, {
          actionDefinitionId,
          order: current.length + 1,
          bindings: Object.fromEntries(definition.variables.map(variable => [
            variable.name,
            source.objects?.find(object => object.object_type_id === variable.objectTypeId)?.id ?? -1,
          ])),
        }]);
  };

  const createScenario = (): OntologySimulationScenario => ({
    assumptions,
    actions,
    focusObjectIds: focusObjectId === null ? undefined : [focusObjectId],
    goal: goalEnabled && objectId !== null && propertyId
      ? {
          condition: { kind: 'property', variable: 'target', propertyId, operator: 'eq', value: parseValue(goalValue) },
          bindings: { target: objectId },
        }
      : undefined,
  });

  const run = async () => {
    setRunning(true);
    setError('');
    try {
      const snapshot = ontologyReasoningModule.createSnapshot(source, catalog);
      const scenario = createScenario();
      const next = ontologyReasoningModule.simulate(snapshot, scenario, {
        maxRuleIterations: 20, maxBranches: 200, maxCounterfactualDistance: 3,
      });
      setReport(next);
      await ontologyReasoningModule.saveRun(snapshot, scenario, next);
    } catch (caught) {
      setReport(null);
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setRunning(false);
    }
  };

  const replay = async () => {
    if (!report) return;
    setRunning(true);
    setError('');
    try {
      setReport(await ontologyReasoningModule.replayRun(report.runId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setRunning(false);
    }
  };

  const objectName = (id: number) => source.objects?.find(object => object.id === id)?.name ?? `#${id}`;
  const propertyName = (id: string) => catalog.propertyDefinitions.find(item => item.id === id)?.name ?? id;
  const activeRules = catalog.rules.filter(rule => rule.status === 'active');
  const activeActions = catalog.actionDefinitions.filter(action => action.status === 'active');

  return (
    <section aria-label="Ontology 原生组合推演" className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#0c0d12] text-monokai-fg">
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#141622] px-6 py-4">
        <div className="flex items-center gap-3">
          <GitBranch className="h-6 w-6 text-monokai-cyan" />
          <div>
            <h1 className="text-lg font-black">组合推演 <span className="text-[10px] text-monokai-green">Ontology 原生 · 只读</span></h1>
            <p className="mt-1 text-xs text-monokai-comment">Ontology 描述世界，组合推演探索这个世界可能变成什么。</p>
          </div>
        </div>
        {onClose && <button type="button" aria-label="关闭组合推演" onClick={onClose}><X className="h-4 w-4" /></button>}
      </header>

      <main className="min-h-0 flex-1 overflow-auto p-5">
        {error && <div role="alert" className="mb-4 rounded-xl bg-monokai-pink/10 p-3 text-xs text-monokai-pink">{error}</div>}
        {loading ? <div className="p-10 text-center text-sm text-monokai-comment">正在创建一致的 Ontology 快照…</div> : (
          <div className="grid gap-5 xl:grid-cols-[0.8fr_1fr_1.4fr]">
            <section className="rounded-2xl border border-white/10 bg-[#12141e] p-4">
              <h2 className="text-sm font-black">1. 选择世界</h2>
              <p className="mt-1 text-xs text-monokai-comment">所有输入均来自当前 useOntologyStore 快照。</p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                {([['对象', source.objects?.length ?? 0], ['关系', source.links?.length ?? 0], ['规则', activeRules.length], ['动作', activeActions.length]] as const).map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-black/20 p-3"><div className="text-monokai-comment">{label}</div><strong>{value}</strong></div>
                ))}
              </div>
              <label className="mt-4 block text-xs">聚焦对象
                <select aria-label="聚焦对象" value={focusObjectId ?? ''} onChange={event => setFocusObjectId(event.target.value ? Number(event.target.value) : null)} className="mt-1 w-full rounded-lg bg-black/30 p-2">
                  <option value="">全部对象</option>
                  {(source.objects ?? []).map(object => <option key={object.id} value={object.id}>{object.name ?? object.id}</option>)}
                </select>
              </label>
              <div className="mt-4 space-y-2 text-xs">
                {(source.objects ?? []).slice(0, 12).map(object => <div key={object.id} className="flex gap-2 rounded-lg border border-white/[0.06] p-2"><Boxes className="h-3.5 w-3.5 text-monokai-cyan" />{object.name} (#{object.id})</div>)}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#12141e] p-4">
              <h2 className="text-sm font-black">2. 设置场景</h2>
              <p className="mt-1 text-xs text-monokai-comment">添加事实/关系假设并排列结构化动作，不写回 Ontology。</p>
              <div className="mt-4 grid gap-2">
                <select aria-label="假设对象" value={objectId ?? ''} onChange={event => setObjectId(event.target.value ? Number(event.target.value) : null)} className="rounded-lg bg-black/30 p-2 text-xs">
                  {(source.objects ?? []).map(object => <option key={object.id} value={object.id}>{object.name ?? object.id}</option>)}
                </select>
                <select aria-label="假设属性" value={propertyId} onChange={event => setPropertyId(event.target.value)} className="rounded-lg bg-black/30 p-2 text-xs">
                  {activeProperties.map(property => <option key={property.id} value={property.id}>{property.name}</option>)}
                </select>
                <input aria-label="假设值" value={assumptionValue} onChange={event => setAssumptionValue(event.target.value)} placeholder="值，例如 paid / true / 100" className="rounded-lg bg-black/30 p-2 text-xs" />
                <button type="button" onClick={addPropertyAssumption} disabled={!propertyId} className="rounded-lg bg-monokai-cyan/15 p-2 text-xs text-monokai-cyan"><Plus className="mr-1 inline h-3.5 w-3.5" />添加属性假设</button>
              </div>
              {(source.linkTypes?.length ?? 0) > 0 && <div className="mt-4 grid gap-2 border-t border-white/10 pt-4">
                <select aria-label="关系操作" value={relationKind} onChange={event => setRelationKind(event.target.value as typeof relationKind)} className="rounded-lg bg-black/30 p-2 text-xs"><option value="add_relation">关系存在</option><option value="remove_relation">关系不存在</option></select>
                <select aria-label="关系源对象" value={relationSourceId ?? ''} onChange={event => setRelationSourceId(Number(event.target.value))} className="rounded-lg bg-black/30 p-2 text-xs">{(source.objects ?? []).map(object => <option key={object.id} value={object.id}>{object.name}</option>)}</select>
                <select aria-label="关系类型" value={relationTypeId ?? ''} onChange={event => setRelationTypeId(Number(event.target.value))} className="rounded-lg bg-black/30 p-2 text-xs">{(source.linkTypes ?? []).map(type => <option key={type.id} value={type.id}>{type.name}</option>)}</select>
                <select aria-label="关系目标对象" value={relationTargetId ?? ''} onChange={event => setRelationTargetId(Number(event.target.value))} className="rounded-lg bg-black/30 p-2 text-xs">{(source.objects ?? []).map(object => <option key={object.id} value={object.id}>{object.name}</option>)}</select>
                <button type="button" onClick={addRelationAssumption} className="rounded-lg bg-monokai-cyan/15 p-2 text-xs text-monokai-cyan"><Link2 className="mr-1 inline h-3.5 w-3.5" />添加关系假设</button>
              </div>}
              <div className="mt-3 space-y-1 text-[10px]">
                {assumptions.map((assumption, index) => <div key={`${assumption.kind}:${index}`} className="flex justify-between rounded bg-black/20 p-2"><span>{JSON.stringify(assumption)}</span><button aria-label={`删除假设 ${index + 1}`} onClick={() => setAssumptions(current => current.filter((_, i) => i !== index))}><Trash2 className="h-3 w-3" /></button></div>)}
              </div>
              {activeActions.length > 0 && <fieldset className="mt-4 border-t border-white/10 pt-4 text-xs"><legend className="font-bold">动作与顺序</legend>{activeActions.map(action => { const selected = actions.find(item => item.actionDefinitionId === action.id); return <label key={action.id} className="mt-2 flex items-center gap-2"><input type="checkbox" checked={Boolean(selected)} onChange={() => toggleAction(action.id)} />{action.name}{selected && <input aria-label={`${action.name} 顺序`} type="number" min={1} value={selected.order} onChange={event => setActions(current => current.map(item => item.actionDefinitionId === action.id ? {...item, order: Number(event.target.value)} : item))} className="ml-auto w-14 bg-black/30 p-1" />}</label>; })}</fieldset>}
              <label className="mt-4 flex items-center gap-2 text-xs"><input type="checkbox" checked={goalEnabled} onChange={event => setGoalEnabled(event.target.checked)} />指定当前对象/属性的目标值</label>
              {goalEnabled && <input aria-label="目标值" value={goalValue} onChange={event => setGoalValue(event.target.value)} className="mt-2 w-full rounded-lg bg-black/30 p-2 text-xs" />}
              <button type="button" aria-label="开始推演" onClick={() => void run()} disabled={running} className="mt-5 w-full rounded-xl bg-monokai-cyan p-3 text-sm font-black text-black">{running ? <RotateCcw className="mr-1 inline h-4 w-4 animate-spin" /> : <Play className="mr-1 inline h-4 w-4" />}开始推演</button>
              <p className="mt-2 text-[10px] text-monokai-green"><ShieldCheck className="mr-1 inline h-3.5 w-3.5" />隔离快照，只读运行</p>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#12141e] p-4">
              <h2 className="text-sm font-black">3. 解释结果</h2>
              {!report && <div className="mt-4 rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-monokai-comment">等待基于真实 Ontology 的推演</div>}
              {activeRules.length === 0 && <div className="mt-4 rounded-xl bg-monokai-yellow/10 p-3 text-xs text-monokai-yellow">没有结构化规则：系统只能回答当前已存在的事实，不会从名称或描述猜测变化。</div>}
              {report && <div className="mt-4 space-y-4 text-xs">
                <div className="grid grid-cols-3 gap-2 text-center"><div className="rounded bg-black/20 p-2">已有事实<br/><strong>{report.existingProperties.length + report.existingRelations.length}</strong></div><div className="rounded bg-black/20 p-2">世界分支<br/><strong>{report.branches.length}</strong></div><div className="rounded bg-black/20 p-2">缺失条件<br/><strong>{report.missingConditions.length}</strong></div></div>
                <button type="button" onClick={() => void replay()} className="rounded border border-white/10 px-3 py-2 text-monokai-cyan">按原始快照重放</button>
                {report.modelIssues.map(issue => <div key={issue} className="rounded bg-monokai-pink/10 p-2 text-monokai-pink"><AlertTriangle className="mr-1 inline h-3.5 w-3.5" />{issue}</div>)}
                {report.truncated && <div className="rounded bg-monokai-yellow/10 p-2 text-monokai-yellow">达到 20 轮或 200 分支安全上限，结果已明确截断。</div>}
                {report.branches.map(branch => <article key={branch.id} className="rounded-xl border border-white/10 p-3"><h3 className="font-bold">可能世界 {branch.id}</h3><div className="mt-2 text-monokai-comment">{branch.path.length === 0 ? '仅包含当前 Ontology 已有事实。' : `${branch.path.length} 步证明路径`}</div>{branch.path.map((step, index) => <div key={`${index}:${step.label}`} className="mt-2 rounded bg-black/20 p-2"><strong>{index + 1}. {step.label}</strong><div>绑定：{Object.entries(step.binding).map(([name,id]) => `${name}=${objectName(id)}`).join(' · ') || '全局'}</div>{step.evidence.map(evidence => <div key={evidence}>依据：{evidence}</div>)}{step.changes.map(change => <div key={change} className="text-monokai-green">{change}</div>)}</div>)}</article>)}
                {report.missingConditions.length > 0 && <div><h3 className="font-bold text-monokai-yellow">还缺什么条件</h3>{report.missingConditions.slice(0, 12).map((item,index) => <div key={`${item.ruleId}:${index}`} className="mt-1">{item.ruleName}：{item.description} · {item.truth}</div>)}</div>}
                {report.counterfactuals.length > 0 && <div><h3 className="font-bold text-monokai-amethyst">改变条件会得到什么</h3>{report.counterfactuals.map(item => <div key={`${item.ruleId}:${item.description}`} className="mt-1">距离 {item.distance}：{item.description}</div>)}</div>}
                {report.goalResults.length > 0 && <div><h3 className="font-bold text-monokai-cyan">目标结论</h3>{report.goalResults.map(item => <div key={item.branchId}>{item.branchId} · {item.truth}</div>)}</div>}
              </div>}
              <div className="mt-4 text-[10px] text-monokai-comment"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-monokai-green" />UNKNOWN 不等于 FALSE · 属性 {propertyName(propertyId)}</div>
            </section>
          </div>
        )}
      </main>
    </section>
  );
};

export const CompositionalDeductionApp: React.FC<CompositionalDeductionAppProps> = ({ isOpen = true, onClose }) => {
  if (!isOpen) return null;
  return <CompositionalDeductionContent onClose={onClose} />;
};

export default CompositionalDeductionApp;
