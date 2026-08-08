import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  GitBranch,
  Link2,
  Play,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  ontologyReasoningModule,
  type OntologyActionSelection,
  type OntologyAssumption,
  type OntologyProjectionSource,
  type OntologyReasoningCatalog,
  type OntologySimulationBranch,
  type OntologySimulationReport,
  type OntologySimulationScenario,
} from '../../services/ontology/ontologyReasoningModule';

export interface OntologySimulationLabProps {
  activeTemplateId?: string;
  ontologyState: OntologyProjectionSource;
  onClose: () => void;
}

const EMPTY_CATALOG: OntologyReasoningCatalog = {
  propertyDefinitions: [],
  rules: [],
  actionDefinitions: [],
};

const displayValue = (value: unknown): string => {
  if (value === undefined) return '未设置';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
};

const parseInputValue = (value: string): unknown => {
  const trimmed = value.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (trimmed && Number.isFinite(Number(trimmed))) return Number(trimmed);
  if ((trimmed.startsWith('[') && trimmed.endsWith(']'))
    || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
    try { return JSON.parse(trimmed); } catch { return value; }
  }
  return value;
};

const SectionHeader: React.FC<{
  step: number;
  title: string;
  subtitle: string;
}> = ({ step, title, subtitle }) => (
  <div className="mb-4 flex items-start gap-3">
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-monokai-cyan/15 text-xs font-black text-monokai-cyan">
      {step}
    </span>
    <div>
      <h2 className="text-sm font-black text-monokai-fg">{step}. {title}</h2>
      <p className="mt-1 text-xs leading-5 text-monokai-comment">{subtitle}</p>
    </div>
  </div>
);

const BranchResult: React.FC<{
  branch: OntologySimulationBranch;
  report: OntologySimulationReport;
  ontologyState: OntologyProjectionSource;
  catalog: OntologyReasoningCatalog;
}> = ({ branch, report, ontologyState, catalog }) => {
  const objectName = (id: number) => ontologyState.objects?.find(object => object.id === id)?.name ?? `#${id}`;
  const propertyName = (id: string) => catalog.propertyDefinitions.find(property => property.id === id)?.name ?? id;
  const derivedProperties = branch.properties.filter(fact => fact.origin !== 'ontology');
  return (
    <article className="rounded-2xl border border-white/10 bg-[#151722] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-black text-monokai-fg">可能世界 {branch.id.replace('branch-', '')}</h3>
        <span className="rounded-full bg-monokai-green/10 px-2 py-1 text-[10px] text-monokai-green">
          {branch.path.length} 步可追溯路径
        </span>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div>
          <h4 className="text-xs font-bold text-monokai-cyan">可能出现</h4>
          <div className="mt-2 space-y-2">
            {derivedProperties.length === 0 && branch.conclusions.length === 0 ? (
              <p className="rounded-lg bg-black/20 p-3 text-xs text-monokai-comment">没有产生新的属性或派生结论。</p>
            ) : null}
            {derivedProperties.map(fact => (
              <div key={`${fact.objectId}:${fact.propertyId}`} className="rounded-lg border border-monokai-cyan/15 bg-monokai-cyan/5 p-3 text-xs">
                <strong>{objectName(fact.objectId)}</strong>
                <span className="mx-2 text-monokai-comment">{propertyName(fact.propertyId)}</span>
                <span className="text-monokai-cyan">{displayValue(fact.value)}</span>
              </div>
            ))}
            {branch.conclusions.map(conclusion => (
              <div key={conclusion} className="rounded-lg border border-monokai-amethyst/20 bg-monokai-amethyst/5 p-3 font-mono text-xs text-monokai-amethyst">
                {conclusion}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-xs font-bold text-monokai-yellow">为什么成立 · 规则路径</h4>
          <ol className="mt-2 space-y-2">
            {branch.path.length === 0 ? (
              <li className="rounded-lg bg-black/20 p-3 text-xs text-monokai-comment">仅包含 Ontology 中已有事实。</li>
            ) : branch.path.map((step, index) => (
              <li key={`${index}:${step.label}`} className="flex gap-2 rounded-lg bg-black/20 p-3 text-xs">
                <span className="text-monokai-comment">{index + 1}</span>
                <div>
                  <div className="font-bold text-monokai-fg">{step.label}</div>
                  <div className="mt-1 text-monokai-comment">
                    {Object.entries(step.binding).map(([name, id]) => `${name}=${objectName(id)}`).join(' · ') || '全局'}
                  </div>
                  {step.ruleVersion !== undefined && <div className="mt-1 font-mono text-[10px] text-monokai-amethyst">规则版本 v{step.ruleVersion}</div>}
                  {step.evidence.map(item => <div key={item} className="mt-1 font-mono text-[10px] text-monokai-comment">依据：{item}</div>)}
                  {step.changes.map(change => <div key={change} className="mt-1 text-monokai-green">{change}</div>)}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {report.conflicts.length > 0 && (
        <div className="mt-4 rounded-xl border border-monokai-yellow/25 bg-monokai-yellow/5 p-3 text-xs text-monokai-yellow">
          本次推演存在 {report.conflicts.length} 个规则冲突，系统已保留互斥结果分支及规则依据。
        </div>
      )}
    </article>
  );
};

export const OntologySimulationLab: React.FC<OntologySimulationLabProps> = ({
  activeTemplateId,
  ontologyState,
  onClose,
}) => {
  const source = useMemo(() => ({
    ...ontologyState,
    activeTemplateId: ontologyState.activeTemplateId ?? activeTemplateId,
  }), [activeTemplateId, ontologyState]);
  const [catalog, setCatalog] = useState<OntologyReasoningCatalog>(EMPTY_CATALOG);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<OntologySimulationReport | null>(null);
  const [assumptions, setAssumptions] = useState<OntologyAssumption[]>([]);
  const [actionSelections, setActionSelections] = useState<OntologyActionSelection[]>([]);
  const [focusObjectId, setFocusObjectId] = useState<number | null>(source.objects?.[0]?.id ?? null);
  const [assumptionObjectId, setAssumptionObjectId] = useState<number | null>(source.objects?.[0]?.id ?? null);
  const [assumptionPropertyId, setAssumptionPropertyId] = useState('');
  const [assumptionValue, setAssumptionValue] = useState('');
  const [relationSourceId, setRelationSourceId] = useState<number | null>(source.objects?.[0]?.id ?? null);
  const [relationTargetId, setRelationTargetId] = useState<number | null>(source.objects?.[1]?.id ?? source.objects?.[0]?.id ?? null);
  const [relationTypeId, setRelationTypeId] = useState<number | null>(source.linkTypes?.[0]?.id ?? null);
  const [relationOperation, setRelationOperation] = useState<'add_relation' | 'remove_relation'>('add_relation');
  const [targetMode, setTargetMode] = useState<'explore' | 'goal'>('explore');
  const [targetObjectId, setTargetObjectId] = useState<number | null>(source.objects?.[0]?.id ?? null);
  const [targetPropertyId, setTargetPropertyId] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [activeBranch, setActiveBranch] = useState(0);
  const loadedSnapshotId = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        await ontologyReasoningModule.initialize();
        const loaded = await ontologyReasoningModule.loadCatalog();
        if (!alive) return;
        const snapshot = ontologyReasoningModule.createSnapshot(source, loaded);
        if (loadedSnapshotId.current && loadedSnapshotId.current !== snapshot.snapshotId) {
          setAssumptions([]);
          setActionSelections([]);
          setReport(null);
          setActiveBranch(0);
          setFocusObjectId(source.objects?.[0]?.id ?? null);
          setAssumptionObjectId(source.objects?.[0]?.id ?? null);
          setTargetObjectId(source.objects?.[0]?.id ?? null);
          setRelationSourceId(source.objects?.[0]?.id ?? null);
          setRelationTargetId(source.objects?.[1]?.id ?? source.objects?.[0]?.id ?? null);
          setRelationTypeId(source.linkTypes?.[0]?.id ?? null);
          setRelationOperation('add_relation');
          setTargetMode('explore');
          setTargetValue('');
        }
        loadedSnapshotId.current = snapshot.snapshotId;
        setCatalog(snapshot.catalog);
      } catch (caught) {
        if (alive) setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    return () => { alive = false; };
  }, [source]);

  const availableProperties = useMemo(() => {
    const object = source.objects?.find(item => item.id === assumptionObjectId);
    return catalog.propertyDefinitions.filter(property =>
      property.objectTypeId === object?.object_type_id && property.status === 'active');
  }, [assumptionObjectId, catalog.propertyDefinitions, source.objects]);

  useEffect(() => {
    if (!availableProperties.some(property => property.id === assumptionPropertyId)) {
      setAssumptionPropertyId(availableProperties[0]?.id ?? '');
    }
  }, [assumptionPropertyId, availableProperties]);

  const availableTargetProperties = useMemo(() => {
    const object = source.objects?.find(item => item.id === targetObjectId);
    return catalog.propertyDefinitions.filter(property =>
      property.objectTypeId === object?.object_type_id && property.status === 'active');
  }, [catalog.propertyDefinitions, source.objects, targetObjectId]);

  useEffect(() => {
    if (!availableTargetProperties.some(property => property.id === targetPropertyId)) {
      setTargetPropertyId(availableTargetProperties[0]?.id ?? '');
    }
  }, [availableTargetProperties, targetPropertyId]);

  const addPropertyAssumption = () => {
    if (assumptionObjectId === null || !assumptionPropertyId) return;
    setAssumptions(current => [...current, {
      kind: 'set_property',
      objectId: assumptionObjectId,
      propertyId: assumptionPropertyId,
      value: parseInputValue(assumptionValue),
    }]);
    setAssumptionValue('');
  };

  const addRelationAssumption = () => {
    if (relationSourceId === null || relationTargetId === null || relationTypeId === null) return;
    setAssumptions(current => [...current, {
      kind: relationOperation,
      sourceObjectId: relationSourceId,
      linkTypeId: relationTypeId,
      targetObjectId: relationTargetId,
    }]);
  };

  const toggleAction = (actionId: string) => {
    const action = catalog.actionDefinitions.find(item => item.id === actionId);
    if (!action) return;
    setActionSelections(current => {
      if (current.some(item => item.actionDefinitionId === actionId)) {
        return current.filter(item => item.actionDefinitionId !== actionId);
      }
      const bindings = Object.fromEntries(action.variables.map(variable => [
        variable.name,
        source.objects?.find(object => object.object_type_id === variable.objectTypeId)?.id ?? -1,
      ]));
      return [...current, { actionDefinitionId: actionId, bindings, order: current.length + 1 }];
    });
  };

  const updateActionSelection = (
    actionDefinitionId: string,
    update: (selection: OntologyActionSelection) => OntologyActionSelection,
  ) => setActionSelections(current => current.map(selection =>
    selection.actionDefinitionId === actionDefinitionId ? update(selection) : selection));

  const runSimulation = async () => {
    setRunning(true);
    setError('');
    try {
      const snapshot = ontologyReasoningModule.createSnapshot(source, catalog);
      const scenario: OntologySimulationScenario = {
        assumptions,
        actions: actionSelections,
        focusObjectIds: focusObjectId === null ? undefined : [focusObjectId],
        goal: targetMode === 'goal' && targetObjectId !== null && targetPropertyId
          ? {
              condition: {
                kind: 'property',
                variable: 'target',
                propertyId: targetPropertyId,
                operator: 'eq',
                value: parseInputValue(targetValue),
              },
              bindings: { target: targetObjectId },
            }
          : undefined,
      };
      const next = ontologyReasoningModule.simulate(snapshot, scenario);
      setReport(next);
      setActiveBranch(0);
      await ontologyReasoningModule.saveRun(snapshot, scenario, next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setRunning(false);
    }
  };

  const replaySimulation = async () => {
    if (!report) return;
    setRunning(true);
    setError('');
    try {
      const replayed = await ontologyReasoningModule.replayRun(report.runId);
      setReport(replayed);
      setActiveBranch(0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setRunning(false);
    }
  };

  const selectedBranch = report?.branches[activeBranch] ?? report?.branches[0];
  const activeRules = catalog.rules.filter(rule => rule.status === 'active');
  const candidateProperties = catalog.propertyDefinitions.filter(property => property.status === 'candidate');
  const conflictedProperties = catalog.propertyDefinitions.filter(property => property.status === 'conflicted');
  const unmatchedRules = activeRules.filter(rule => rule.variables.some(variable =>
    !(source.objects ?? []).some(object => object.object_type_id === variable.objectTypeId)));

  return (
    <section aria-label="Ontology 原生组合推演" className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#0c0d12] text-monokai-fg">
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#141622] px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-monokai-cyan/25 bg-monokai-cyan/10 p-2.5 text-monokai-cyan">
            <GitBranch className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black">组合推演</h1>
              <span className="rounded-full bg-monokai-green/10 px-2 py-0.5 text-[10px] text-monokai-green">Ontology 原生 · 只读</span>
            </div>
            <p className="mt-1 text-xs text-monokai-comment">Ontology 描述世界，组合推演探索这个世界可能变成什么。</p>
          </div>
        </div>
        <button type="button" aria-label="关闭组合推演" onClick={onClose} className="rounded-lg p-2 text-monokai-comment hover:bg-white/10 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </header>

      <main className="min-h-0 flex-1 overflow-auto p-5">
        {error && <div role="alert" className="mb-4 rounded-xl border border-monokai-pink/30 bg-monokai-pink/10 p-3 text-xs text-monokai-pink">{error}</div>}
        {loading ? (
          <div className="flex h-48 items-center justify-center text-sm text-monokai-comment">正在读取当前 Ontology 快照…</div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[minmax(260px,0.8fr)_minmax(340px,1fr)_minmax(420px,1.4fr)]">
            <section className="rounded-2xl border border-white/10 bg-[#12141e] p-4">
              <SectionHeader step={1} title="选择世界" subtitle="直接读取当前 Ontology 对象、属性、关系和规则。" />
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  ['对象', source.objects?.length ?? 0],
                  ['关系', source.links?.length ?? 0],
                  ['激活属性', catalog.propertyDefinitions.filter(item => item.status === 'active').length],
                  ['可执行规则', activeRules.length],
                ].map(([label, count]) => (
                  <div key={String(label)} className="rounded-xl bg-black/20 p-3">
                    <div className="text-monokai-comment">{label}</div>
                    <div className="mt-1 text-lg font-black text-monokai-fg">{count}</div>
                  </div>
                ))}
              </div>

              <label className="mt-4 block text-xs text-monokai-comment">
                聚焦对象
                <select value={focusObjectId ?? ''} onChange={event => setFocusObjectId(event.target.value ? Number(event.target.value) : null)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0c0d12] px-3 py-2 text-monokai-fg">
                  <option value="">全部对象</option>
                  {(source.objects ?? []).map(object => <option key={object.id} value={object.id}>{object.name ?? `#${object.id}`}</option>)}
                </select>
              </label>

              <div className="mt-4 space-y-2">
                {(source.objects ?? []).slice(0, 12).map(object => (
                  <div key={object.id} className="flex items-center gap-2 rounded-lg border border-white/[0.06] p-2 text-xs">
                    <Boxes className="h-3.5 w-3.5 text-monokai-cyan" />
                    <span>{object.name ?? `#${object.id}`}</span>
                  </div>
                ))}
              </div>

              {candidateProperties.length > 0 && (
                <details className="mt-4 rounded-xl border border-monokai-yellow/20 bg-monokai-yellow/5 p-3">
                  <summary className="cursor-pointer text-xs font-bold text-monokai-yellow">从真实 JSON 发现 {candidateProperties.length} 个候选属性</summary>
                  <div className="mt-2 space-y-2">
                    {candidateProperties.map(property => (
                      <div key={property.id} className="text-xs">{property.name} · {property.valueType}</div>
                    ))}
                    <p className="pt-1 text-[11px] leading-5 text-monokai-comment">请在 Ontology 主模块确认稳定属性 ID；组合推演不会修改定义。</p>
                  </div>
                </details>
              )}
              {conflictedProperties.length > 0 && (
                <div className="mt-3 rounded-xl border border-monokai-pink/20 bg-monokai-pink/5 p-3 text-xs text-monokai-pink">
                  {conflictedProperties.length} 个属性存在类型冲突，确认前不能用于规则。
                </div>
              )}
              {activeRules.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="text-xs font-bold text-monokai-amethyst">Ontology 提供的规则</div>
                  {activeRules.map(rule => <div key={rule.id} className="rounded-lg bg-monokai-amethyst/5 p-2 text-xs">{rule.name}</div>)}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#12141e] p-4">
              <SectionHeader step={2} title="设置场景" subtitle="用假设覆盖事实，再选择结构化动作及顺序；不会写回 Ontology。" />

              <div className="rounded-xl border border-white/[0.08] bg-black/15 p-3">
                <div className="text-xs font-bold text-monokai-fg">属性假设</div>
                <div className="mt-3 grid gap-2">
                  <select aria-label="假设对象" value={assumptionObjectId ?? ''} onChange={event => setAssumptionObjectId(event.target.value ? Number(event.target.value) : null)} className="rounded-lg border border-white/10 bg-[#0c0d12] px-3 py-2 text-xs">
                    {(source.objects ?? []).map(object => <option key={object.id} value={object.id}>{object.name ?? object.id}</option>)}
                  </select>
                  <select aria-label="假设属性" value={assumptionPropertyId} onChange={event => setAssumptionPropertyId(event.target.value)} className="rounded-lg border border-white/10 bg-[#0c0d12] px-3 py-2 text-xs">
                    {availableProperties.map(property => <option key={property.id} value={property.id}>{property.name}</option>)}
                  </select>
                  <input aria-label="假设值" value={assumptionValue} onChange={event => setAssumptionValue(event.target.value)} placeholder="例如 paid、100、true" className="rounded-lg border border-white/10 bg-[#0c0d12] px-3 py-2 text-xs" />
                  <button type="button" aria-label="添加属性假设" onClick={addPropertyAssumption} disabled={!assumptionPropertyId} className="flex items-center justify-center gap-1 rounded-lg border border-monokai-cyan/25 bg-monokai-cyan/10 px-3 py-2 text-xs font-bold text-monokai-cyan disabled:opacity-40">
                    <Plus className="h-3.5 w-3.5" /> 添加属性假设
                  </button>
                </div>
              </div>

              {(source.linkTypes?.length ?? 0) > 0 && (source.objects?.length ?? 0) > 0 && (
                <div className="mt-3 rounded-xl border border-white/[0.08] bg-black/15 p-3">
                  <div className="text-xs font-bold text-monokai-fg">关系假设</div>
                  <div className="mt-3 grid gap-2">
                    <select aria-label="关系假设操作" value={relationOperation} onChange={event => setRelationOperation(event.target.value as 'add_relation' | 'remove_relation')} className="rounded-lg border border-white/10 bg-[#0c0d12] px-3 py-2 text-xs">
                      <option value="add_relation">假设关系存在</option>
                      <option value="remove_relation">假设关系不存在</option>
                    </select>
                    <select aria-label="关系源对象" value={relationSourceId ?? ''} onChange={event => setRelationSourceId(event.target.value ? Number(event.target.value) : null)} className="rounded-lg border border-white/10 bg-[#0c0d12] px-3 py-2 text-xs">
                      {(source.objects ?? []).map(object => <option key={object.id} value={object.id}>{object.name ?? object.id}</option>)}
                    </select>
                    <select aria-label="关系类型" value={relationTypeId ?? ''} onChange={event => setRelationTypeId(event.target.value ? Number(event.target.value) : null)} className="rounded-lg border border-white/10 bg-[#0c0d12] px-3 py-2 text-xs">
                      {(source.linkTypes ?? []).map(linkType => <option key={linkType.id} value={linkType.id}>{linkType.name}</option>)}
                    </select>
                    <select aria-label="关系目标对象" value={relationTargetId ?? ''} onChange={event => setRelationTargetId(event.target.value ? Number(event.target.value) : null)} className="rounded-lg border border-white/10 bg-[#0c0d12] px-3 py-2 text-xs">
                      {(source.objects ?? []).map(object => <option key={object.id} value={object.id}>{object.name ?? object.id}</option>)}
                    </select>
                    <button type="button" aria-label="添加关系假设" onClick={addRelationAssumption} className="flex items-center justify-center gap-1 rounded-lg border border-monokai-cyan/25 bg-monokai-cyan/10 px-3 py-2 text-xs font-bold text-monokai-cyan">
                      <Link2 className="h-3.5 w-3.5" /> 添加关系假设
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-3 space-y-2">
                {assumptions.map((assumption, index) => (
                  <div key={index} className="flex items-center justify-between gap-2 rounded-lg border border-monokai-cyan/15 bg-monokai-cyan/5 p-2 text-xs">
                    <span>{assumption.kind === 'add_relation' || assumption.kind === 'remove_relation'
                      ? `${assumption.sourceObjectId} -[${assumption.linkTypeId}]-&gt; ${assumption.targetObjectId} · ${assumption.kind === 'add_relation' ? '存在' : '不存在'}`
                      : assumption.kind === 'set_property'
                        ? `${assumption.objectId}.${assumption.propertyId} = ${displayValue(assumption.value)}`
                        : `${assumption.objectId}.${assumption.propertyId} 未设置`}</span>
                    <button type="button" aria-label={`删除假设 ${index + 1}`} onClick={() => setAssumptions(current => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>

              {catalog.actionDefinitions.filter(action => action.status === 'active').length > 0 && (
                <fieldset className="mt-4 space-y-2">
                  <legend className="text-xs font-bold text-monokai-fg">动作序列</legend>
                  {catalog.actionDefinitions.filter(action => action.status === 'active').map(action => {
                    const selection = actionSelections.find(item => item.actionDefinitionId === action.id);
                    return (
                      <div key={action.id} className="rounded-lg border border-white/[0.06] p-2 text-xs">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={Boolean(selection)} onChange={() => toggleAction(action.id)} />
                          {action.name}
                        </label>
                        {selection && (
                          <div className="mt-2 grid gap-2 pl-5">
                            <label className="flex items-center justify-between gap-2 text-monokai-comment">
                              顺序
                              <input aria-label={`${action.name} 顺序`} type="number" min={1} value={selection.order} onChange={event => updateActionSelection(action.id, current => ({ ...current, order: Number(event.target.value) || 1 }))} className="w-20 rounded border border-white/10 bg-[#0c0d12] px-2 py-1 text-monokai-fg" />
                            </label>
                            {action.variables.map(variable => (
                              <label key={variable.name} className="flex items-center justify-between gap-2 text-monokai-comment">
                                {variable.name}
                                <select aria-label={`${action.name} ${variable.name} 绑定`} value={selection.bindings[variable.name] ?? ''} onChange={event => updateActionSelection(action.id, current => ({ ...current, bindings: { ...current.bindings, [variable.name]: Number(event.target.value) } }))} className="max-w-40 rounded border border-white/10 bg-[#0c0d12] px-2 py-1 text-monokai-fg">
                                  {(source.objects ?? []).filter(object => object.object_type_id === variable.objectTypeId).map(object => <option key={object.id} value={object.id}>{object.name ?? object.id}</option>)}
                                </select>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </fieldset>
              )}

              <fieldset className="mt-4 rounded-xl border border-white/[0.08] p-3">
                <legend className="px-1 text-xs font-bold text-monokai-fg">目标问题</legend>
                <div className="flex gap-4 text-xs">
                  <label><input type="radio" checked={targetMode === 'explore'} onChange={() => setTargetMode('explore')} /> 探索全部可能</label>
                  <label><input type="radio" checked={targetMode === 'goal'} onChange={() => setTargetMode('goal')} /> 指定目标属性</label>
                </div>
                {targetMode === 'goal' && (
                  <div className="mt-3 grid gap-2">
                    <select aria-label="目标对象" value={targetObjectId ?? ''} onChange={event => setTargetObjectId(event.target.value ? Number(event.target.value) : null)} className="rounded-lg border border-white/10 bg-[#0c0d12] px-3 py-2 text-xs">
                      {(source.objects ?? []).map(object => <option key={object.id} value={object.id}>{object.name ?? object.id}</option>)}
                    </select>
                    <select aria-label="目标属性" value={targetPropertyId} onChange={event => setTargetPropertyId(event.target.value)} className="rounded-lg border border-white/10 bg-[#0c0d12] px-3 py-2 text-xs">
                      {availableTargetProperties.map(property => <option key={property.id} value={property.id}>{property.name}</option>)}
                    </select>
                    <input aria-label="目标值" value={targetValue} onChange={event => setTargetValue(event.target.value)} placeholder="期望值" className="rounded-lg border border-white/10 bg-[#0c0d12] px-3 py-2 text-xs" />
                  </div>
                )}
              </fieldset>

              <button type="button" aria-label="开始推演" onClick={() => void runSimulation()} disabled={running} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-monokai-cyan px-4 py-3 text-sm font-black text-[#0c0d12] disabled:opacity-50">
                {running ? <RotateCcw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {running ? '正在推演…' : '开始推演'}
              </button>
              <div className="mt-3 flex items-center gap-2 text-[11px] text-monokai-comment">
                <ShieldCheck className="h-3.5 w-3.5 text-monokai-green" /> 始终在隔离世界中运行，不修改真实对象和关系。
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#12141e] p-4">
              <SectionHeader step={3} title="解释结果" subtitle="查看已存在事实、可能结果、成立路径、缺失条件和反事实建议。" />

              {!report && (
                <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 p-6 text-center">
                  <Sparkles className="h-7 w-7 text-monokai-amethyst" />
                  <p className="mt-3 text-sm font-bold">等待推演</p>
                  <p className="mt-2 max-w-sm text-xs leading-5 text-monokai-comment">系统将仅使用当前 Ontology 快照和你选择的假设。</p>
                </div>
              )}

              {activeRules.length === 0 && (
                <div className="mb-4 rounded-xl border border-monokai-yellow/25 bg-monokai-yellow/5 p-4 text-xs leading-6 text-monokai-yellow">
                  <strong>当前 Ontology 还没有可执行的结构化规则。</strong>
                  <div>系统只能回答“什么已经存在”；不会从动作描述或说明文字中猜测规则。</div>
                </div>
              )}

              {report && (
                <>
                  {report.modelIssues.length > 0 && (
                    <div className="mb-4 rounded-xl border border-monokai-pink/25 bg-monokai-pink/5 p-3 text-xs text-monokai-pink">
                      <div className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" /> Ontology 暂不可完整推演</div>
                      {report.modelIssues.map(issue => <div key={issue} className="mt-1">{issue}</div>)}
                    </div>
                  )}
                  <div className="mb-4 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-black/20 p-2"><div className="text-monokai-comment">已有事实</div><strong>{report.existingProperties.length + report.existingRelations.length}</strong></div>
                    <div className="rounded-lg bg-black/20 p-2"><div className="text-monokai-comment">可能分支</div><strong>{report.branches.length}</strong></div>
                    <div className="rounded-lg bg-black/20 p-2"><div className="text-monokai-comment">缺失条件</div><strong>{report.missingConditions.length}</strong></div>
                  </div>
                  <button type="button" aria-label="按原始快照重放" onClick={() => void replaySimulation()} disabled={running} className="mb-4 rounded-lg border border-white/10 px-3 py-2 text-xs text-monokai-cyan disabled:opacity-50">
                    按原始快照重放
                  </button>
                  {unmatchedRules.length > 0 && (
                    <div className="mb-4 rounded-lg bg-monokai-yellow/10 p-3 text-xs text-monokai-yellow">无匹配对象：{unmatchedRules.map(rule => rule.name).join('、')}</div>
                  )}
                  {report.goalResults.length > 0 && (
                    <div className="mb-4 rounded-xl border border-monokai-cyan/20 bg-monokai-cyan/5 p-3 text-xs">
                      <div className="font-bold text-monokai-cyan">目标结论</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {report.goalResults.map(result => <span key={result.branchId} className="rounded bg-black/20 px-2 py-1">{result.branchId} · {result.truth}</span>)}
                      </div>
                      {report.goalResults.every(result => result.truth !== 'TRUE') && (
                        <div className="mt-2 text-monokai-yellow">目标当前不可达；UNKNOWN 表示仍缺事实，FALSE 表示存在相反事实。</div>
                      )}
                    </div>
                  )}
                  {report.truncated && <div className="mb-4 rounded-lg bg-monokai-yellow/10 p-3 text-xs text-monokai-yellow">分支或迭代达到安全上限，结果不是穷举。</div>}
                  {report.branches.length > 1 && (
                    <div className="mb-3 flex gap-2 overflow-x-auto">
                      {report.branches.map((branch, index) => (
                        <button key={branch.id} type="button" onClick={() => setActiveBranch(index)} className={index === activeBranch ? 'rounded-lg bg-monokai-cyan px-3 py-1.5 text-xs font-bold text-black' : 'rounded-lg bg-white/5 px-3 py-1.5 text-xs'}>
                          分支 {index + 1}
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedBranch && <BranchResult branch={selectedBranch} report={report} ontologyState={source} catalog={catalog} />}
                  {report.missingConditions.length > 0 && (
                    <details className="mt-4 rounded-xl border border-white/10 p-3" open>
                      <summary className="cursor-pointer text-xs font-bold text-monokai-yellow">还缺什么条件</summary>
                      <div className="mt-2 space-y-2">
                        {report.missingConditions.slice(0, 10).map((missing, index) => (
                          <div key={`${missing.ruleId}:${index}`} className="flex items-start gap-2 text-xs text-monokai-comment">
                            <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-monokai-yellow" />
                            <span>{missing.ruleName}：{missing.description} · {missing.truth}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                  {report.counterfactuals.length > 0 && (
                    <details className="mt-3 rounded-xl border border-white/10 p-3">
                      <summary className="cursor-pointer text-xs font-bold text-monokai-amethyst">改变哪个条件会得到不同结果</summary>
                      {report.counterfactuals.map(item => <div key={`${item.ruleId}:${item.description}`} className="mt-2 rounded-lg bg-monokai-amethyst/5 p-2 text-xs">{item.description}</div>)}
                    </details>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </main>

      <footer className="flex shrink-0 items-center justify-between border-t border-white/10 bg-[#141622] px-6 py-2.5 text-[10px] text-monokai-comment">
        <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-monokai-green" /> UNKNOWN 不会被当作 FALSE</span>
        <span className="flex items-center gap-1"><Link2 className="h-3.5 w-3.5 text-monokai-cyan" /> 所有结论都可回溯到对象、关系和规则版本</span>
      </footer>
    </section>
  );
};

export default OntologySimulationLab;
