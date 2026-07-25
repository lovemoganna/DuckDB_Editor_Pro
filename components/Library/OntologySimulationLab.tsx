import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Clock3,
  Columns3,
  Compass,
  Copy,
  GitBranch,
  Plus,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { ONTOLOGY_SEEDS } from '../../hooks/useOntologyStore';
import { DEFAULT_PATTERNS } from './defaultPatterns';
import {
  buildScenarioComparison,
  createDefaultScenario,
  deriveSimulationRules,
  OntologySimulationData,
  parseSimulationProperties,
  PropertyOperator,
  runOntologySimulation,
  SimulationResult,
  SimulationScenario,
} from './OntologySimulationEngine';

const MAX_SCENARIOS = 3;

const TUTORIAL_PRESETS = DEFAULT_PATTERNS.map(pattern => ({
  id: pattern.id,
  label: pattern.title,
  data: ONTOLOGY_SEEDS[pattern.seedIds[0]] as OntologySimulationData,
}));

export interface OntologySimulationLabProps {
  activeTemplateId: string;
  ontologyState: OntologySimulationData;
  onClose: () => void;
}

const displayValue = (value: unknown) => {
  if (value === undefined) return '未设置';
  if (value === null) return '空值';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const getStatusPresentation = (status: SimulationResult['status']) => {
  if (status === 'possible') {
    return {
      label: '组合成立',
      className: 'border-monokai-green/35 bg-monokai-green/10 text-monokai-green',
      dotClassName: 'bg-monokai-green',
    };
  }
  if (status === 'conflicted') {
    return {
      label: '存在冲突',
      className: 'border-monokai-yellow/35 bg-monokai-yellow/10 text-monokai-yellow',
      dotClassName: 'bg-monokai-yellow',
    };
  }
  return {
    label: '已自动排除',
    className: 'border-monokai-pink/35 bg-monokai-pink/10 text-monokai-pink',
    dotClassName: 'bg-monokai-pink',
  };
};

const getEvidencePresentation = (
  evidenceLevel: SimulationResult['finalOutcome']['evidenceLevel'],
) => {
  if (evidenceLevel === 'direct') {
    return { label: '现有事实', className: 'text-monokai-green' };
  }
  if (evidenceLevel === 'contested') {
    return { label: '需裁决', className: 'text-monokai-yellow' };
  }
  return { label: '待补证', className: 'text-monokai-comment' };
};

const normalizeOntologyState = (
  ontologyState: OntologySimulationData,
  activeTemplateId: string,
): OntologySimulationData => {
  const activeSeed = TUTORIAL_PRESETS.find(preset => preset.id === activeTemplateId)?.data;
  return {
    _meta: ontologyState._meta ?? activeSeed?._meta ?? {
      name: '当前本体',
      description: '当前建模工作区中的实时对象、关系、动作与规则',
    },
    objectTypes: ontologyState.objectTypes ?? [],
    objects: ontologyState.objects ?? [],
    linkTypes: ontologyState.linkTypes ?? [],
    links: ontologyState.links ?? [],
    actions: ontologyState.actions ?? [],
    introspections: ontologyState.introspections ?? [],
    insights: ontologyState.insights ?? [],
  };
};

const resolveSimulationSource = (
  sourceKey: string,
  currentData: OntologySimulationData,
): OntologySimulationData => (
  sourceKey === 'current'
    ? currentData
    : TUTORIAL_PRESETS.find(preset => preset.id === sourceKey)?.data ?? currentData
);

export const OntologySimulationLab: React.FC<OntologySimulationLabProps> = ({
  activeTemplateId,
  ontologyState,
  onClose,
}) => {
  const currentData = useMemo(
    () => normalizeOntologyState(ontologyState, activeTemplateId),
    [activeTemplateId, ontologyState],
  );
  const [sourceKey, setSourceKey] = useState('current');
  const activeData = useMemo(
    () => resolveSimulationSource(sourceKey, currentData),
    [currentData, sourceKey],
  );

  const scenarioCounter = useRef(1);
  const [scenarios, setScenarios] = useState<SimulationScenario[]>(() => [
    createDefaultScenario('scenario-1', currentData),
  ]);

  const results = useMemo(
    () => scenarios.map(scenario => runOntologySimulation(activeData, scenario)),
    [activeData, scenarios],
  );
  const comparison = useMemo(() => buildScenarioComparison(results), [results]);

  const createScenario = (source?: SimulationScenario) => {
    if (scenarios.length >= MAX_SCENARIOS) return;
    scenarioCounter.current += 1;
    const id = `scenario-${scenarioCounter.current}`;
    const next = source
      ? {
          ...source,
          id,
          name: `场景 ${scenarioCounter.current}`,
          selectedRuleIds: [...source.selectedRuleIds],
        }
      : createDefaultScenario(id, activeData);
    setScenarios(current => [...current, next]);
  };

  const updateScenario = (id: string, update: Partial<SimulationScenario>) => {
    setScenarios(current =>
      current.map(scenario => scenario.id === id ? { ...scenario, ...update } : scenario),
    );
  };

  const removeScenario = (id: string) => {
    setScenarios(current => current.length > 1
      ? current.filter(scenario => scenario.id !== id)
      : current,
    );
  };

  const changeSource = (nextSourceKey: string) => {
    const nextData = resolveSimulationSource(nextSourceKey, currentData);
    scenarioCounter.current = 1;
    setSourceKey(nextSourceKey);
    setScenarios([createDefaultScenario('scenario-1', nextData)]);
  };

  const background = activeData._meta?.case_background
    ?? activeData._meta?.description
    ?? `当前本体包含 ${activeData.objects.length} 个对象与 ${activeData.links.length} 条关系。`;

  return (
    <section
      aria-label="本体组合推演实验室"
      className="h-full min-w-0 flex flex-col overflow-hidden bg-[#101119] text-monokai-fg"
    >
      <header className="shrink-0 border-b border-monokai-accent/15 bg-[#171824]">
        <div className="flex items-start justify-between gap-4 px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 rounded-xl border border-monokai-cyan/30 bg-monokai-cyan/10 p-2 text-monokai-cyan">
              <Compass className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold tracking-wide text-monokai-fg">
                  本体组合推演实验室
                </h2>
                <span className="rounded-full border border-monokai-cyan/25 bg-monokai-cyan/10 px-2 py-0.5 text-[10px] font-bold text-monokai-cyan">
                  组合 · 推演 · 发现
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-monokai-comment">
                组合已有对象、属性、关系、规则、动作与时间；这里只推演，不会改写本体。
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="关闭推演实验室"
            onClick={onClose}
            className="rounded-lg p-2 text-monokai-comment transition-colors hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 px-5 py-3">
          <label className="flex min-w-0 items-center gap-2 text-xs text-monokai-comment">
            <BookOpen className="h-4 w-4 shrink-0 text-monokai-yellow" />
            <span className="shrink-0">材料来源</span>
            <select
              aria-label="推演材料来源"
              value={sourceKey}
              onChange={event => changeSource(event.target.value)}
              className="min-w-0 max-w-[340px] rounded-lg border border-monokai-accent/25 bg-[#0f1017] px-2.5 py-1.5 text-xs font-semibold text-monokai-fg outline-none focus:border-monokai-cyan"
            >
              <option value="current">当前本体</option>
              {TUTORIAL_PRESETS.map(preset => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            aria-label="添加对比场景"
            disabled={scenarios.length >= MAX_SCENARIOS}
            onClick={() => createScenario()}
            className="flex items-center gap-1.5 rounded-lg border border-monokai-amethyst/30 bg-monokai-amethyst/10 px-3 py-1.5 text-xs font-bold text-monokai-amethyst transition-colors hover:bg-monokai-amethyst/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            添加对比场景
          </button>
        </div>
      </header>

      <div className="shrink-0 border-b border-monokai-accent/10 bg-[#12131c] px-5 py-3">
        <div className="flex items-start gap-2.5 rounded-xl border border-monokai-yellow/20 bg-monokai-yellow/[0.06] px-3 py-2.5">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-monokai-yellow" />
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-monokai-yellow">
              {activeData._meta?.name ?? '当前推演材料'}
            </div>
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-monokai-fg/75">
              {background}
            </p>
          </div>
        </div>
      </div>

      {scenarios.length > 1 && (
        <ComparisonSummary
          scenarioCount={scenarios.length}
          comparison={comparison}
          results={results}
        />
      )}

      <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar">
        <div
          className="grid h-full min-w-max grid-flow-col gap-4 p-4"
          style={{ gridAutoColumns: scenarios.length === 1 ? 'minmax(480px, 1fr)' : '340px' }}
        >
          {scenarios.map((scenario, index) => (
            <ScenarioCard
              key={scenario.id}
              index={index}
              scenario={scenario}
              result={results[index]}
              data={activeData}
              canRemove={scenarios.length > 1}
              canCopy={scenarios.length < MAX_SCENARIOS}
              onChange={update => updateScenario(scenario.id, update)}
              onCopy={() => createScenario(scenario)}
              onRemove={() => removeScenario(scenario.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

interface ComparisonSummaryProps {
  scenarioCount: number;
  comparison: ReturnType<typeof buildScenarioComparison>;
  results: SimulationResult[];
}

const ComparisonSummary: React.FC<ComparisonSummaryProps> = ({
  scenarioCount,
  comparison,
  results,
}) => (
  <div className="shrink-0 border-b border-monokai-accent/10 bg-black/20 px-5 py-2.5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-xs font-bold text-monokai-fg">
        <Columns3 className="h-4 w-4 text-monokai-amethyst" />
        <span>{scenarioCount} 个场景并排比较</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[10px]">
        <span className="rounded-full bg-monokai-green/10 px-2 py-1 text-monokai-green">
          成立 {comparison.possible}
        </span>
        <span className="rounded-full bg-monokai-yellow/10 px-2 py-1 text-monokai-yellow">
          冲突 {comparison.conflicted}
        </span>
        <span className="rounded-full bg-monokai-pink/10 px-2 py-1 text-monokai-pink">
          排除 {comparison.excluded}
        </span>
        <span className="rounded-full bg-white/5 px-2 py-1 text-monokai-comment">
          状态变化 {comparison.totalStateChanges}
        </span>
      </div>
    </div>
    <div className="mt-2 flex gap-2 overflow-x-auto pb-0.5">
      {results.map(result => {
        const presentation = getStatusPresentation(result.status);
        const evidence = getEvidencePresentation(result.finalOutcome.evidenceLevel);
        return (
          <div
            key={result.scenarioId}
            className={`flex min-w-[180px] items-center justify-between gap-3 rounded-lg border px-2.5 py-1.5 ${presentation.className}`}
          >
            <span className="truncate text-[10px] font-bold">{result.scenarioName}</span>
            <span className={`shrink-0 text-[10px] ${evidence.className}`}>
              {evidence.label}
            </span>
          </div>
        );
      })}
    </div>
  </div>
);

interface ScenarioCardProps {
  index: number;
  scenario: SimulationScenario;
  result: SimulationResult;
  data: OntologySimulationData;
  canRemove: boolean;
  canCopy: boolean;
  onChange: (update: Partial<SimulationScenario>) => void;
  onCopy: () => void;
  onRemove: () => void;
}

const ScenarioCard: React.FC<ScenarioCardProps> = ({
  index,
  scenario,
  result,
  data,
  canRemove,
  canCopy,
  onChange,
  onCopy,
  onRemove,
}) => {
  const sourceObject = data.objects.find(object => object.id === scenario.sourceObjectId);
  const sourceProperties = Object.entries(parseSimulationProperties(sourceObject?.properties));
  const rules = deriveSimulationRules(data);
  const status = getStatusPresentation(result.status);

  const changeSourceObject = (sourceObjectId: number) => {
    const nextObject = data.objects.find(object => object.id === sourceObjectId);
    const [firstProperty] = Object.entries(parseSimulationProperties(nextObject?.properties));
    onChange({
      sourceObjectId,
      propertyKey: firstProperty?.[0] ?? null,
      propertyValue: firstProperty?.[1] ?? '',
    });
  };

  const toggleRule = (ruleId: string) => {
    const selectedRuleIds = scenario.selectedRuleIds.includes(ruleId)
      ? scenario.selectedRuleIds.filter(id => id !== ruleId)
      : [...scenario.selectedRuleIds, ruleId];
    onChange({ selectedRuleIds });
  };

  return (
    <article
      data-testid="simulation-scenario-card"
      className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-monokai-accent/20 bg-[#171824] shadow-xl"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-monokai-accent/15 px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-monokai-cyan/10 text-[10px] font-black text-monokai-cyan">
            {String.fromCharCode(65 + index)}
          </span>
          <input
            aria-label={`场景 ${index + 1} 名称`}
            value={scenario.name}
            onChange={event => onChange({ name: event.target.value })}
            className="min-w-0 flex-1 border-b border-transparent bg-transparent text-xs font-bold text-monokai-fg outline-none focus:border-monokai-cyan/40"
          />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label="复制场景"
            disabled={!canCopy}
            onClick={onCopy}
            className="rounded-md p-1.5 text-monokai-comment transition-colors hover:bg-white/5 hover:text-monokai-cyan disabled:opacity-30"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="删除场景"
            disabled={!canRemove}
            onClick={onRemove}
            className="rounded-md p-1.5 text-monokai-comment transition-colors hover:bg-monokai-pink/10 hover:text-monokai-pink disabled:opacity-30"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="space-y-4 p-4">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-monokai-comment">
                组合条件
              </h3>
              <span className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-bold ${status.className}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${status.dotClassName}`} />
                {status.label}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <SelectField
                label="对象"
                value={scenario.sourceObjectId ?? ''}
                onChange={value => changeSourceObject(Number(value))}
                accent="cyan"
              >
                <option value="">请选择</option>
                {data.objects.map(object => (
                  <option key={object.id} value={object.id}>{object.name}</option>
                ))}
              </SelectField>

              <SelectField
                label="关系"
                value={scenario.linkTypeId ?? ''}
                onChange={value => onChange({ linkTypeId: value ? Number(value) : null })}
                accent="amethyst"
              >
                <option value="">请选择</option>
                {data.linkTypes.map(type => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </SelectField>

              <SelectField
                label="属性"
                value={scenario.propertyKey ?? ''}
                onChange={value => {
                  const property = sourceProperties.find(([key]) => key === value);
                  onChange({
                    propertyKey: value || null,
                    propertyValue: property?.[1] ?? '',
                  });
                }}
                accent="yellow"
              >
                <option value="">不设属性条件</option>
                {sourceProperties.map(([key]) => (
                  <option key={key} value={key}>{key}</option>
                ))}
              </SelectField>

              <SelectField
                label="目标"
                value={scenario.targetObjectId ?? ''}
                onChange={value => onChange({ targetObjectId: value ? Number(value) : null })}
                accent="green"
              >
                <option value="">请选择</option>
                {data.objects.map(object => (
                  <option key={object.id} value={object.id}>{object.name}</option>
                ))}
              </SelectField>
            </div>

            {scenario.propertyKey && (
              <div className="mt-2 grid grid-cols-[88px_1fr] gap-2">
                <select
                  aria-label="属性运算符"
                  value={scenario.propertyOperator}
                  onChange={event => onChange({ propertyOperator: event.target.value as PropertyOperator })}
                  className="rounded-lg border border-monokai-accent/25 bg-[#101119] px-2 py-2 text-[11px] text-monokai-fg outline-none focus:border-monokai-yellow/60"
                >
                  <option value="equals">等于</option>
                  <option value="not_equals">不等于</option>
                </select>
                <input
                  aria-label="属性条件值"
                  value={displayValue(scenario.propertyValue)}
                  onChange={event => onChange({ propertyValue: event.target.value })}
                  className="min-w-0 rounded-lg border border-monokai-accent/25 bg-[#101119] px-2.5 py-2 text-[11px] text-monokai-fg outline-none focus:border-monokai-yellow/60"
                />
              </div>
            )}

            <div className="mt-2 grid grid-cols-[1fr_112px] gap-2">
              <SelectField
                label="动作"
                value={scenario.actionId ?? ''}
                onChange={value => onChange({ actionId: value ? Number(value) : null })}
                accent="pink"
              >
                <option value="">只观察，不执行动作</option>
                {(data.actions ?? []).map(action => (
                  <option key={action.id} value={action.id}>{action.name}</option>
                ))}
              </SelectField>
              <label className="block">
                <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-monokai-green">
                  时间
                </span>
                <div className="flex items-center rounded-lg border border-monokai-accent/25 bg-[#101119] px-2">
                  <Clock3 className="h-3 w-3 shrink-0 text-monokai-green" />
                  <input
                    aria-label="推演时间"
                    type="number"
                    min={0}
                    max={168}
                    value={scenario.timeOffsetHours}
                    onChange={event => onChange({
                      timeOffsetHours: Math.max(0, Math.min(168, Number(event.target.value) || 0)),
                    })}
                    className="min-w-0 flex-1 bg-transparent px-1 py-2 text-right text-[11px] text-monokai-fg outline-none"
                  />
                  <span className="text-[9px] text-monokai-comment">h</span>
                </div>
              </label>
            </div>

            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-wider text-monokai-yellow">
                  规则
                </span>
                <span className="text-[9px] text-monokai-comment">
                  可多选 · 来自教程洞察与反思
                </span>
              </div>
              {rules.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {rules.map(rule => {
                    const selected = scenario.selectedRuleIds.includes(rule.id);
                    return (
                      <button
                        type="button"
                        key={rule.id}
                        aria-pressed={selected}
                        title={rule.description}
                        onClick={() => toggleRule(rule.id)}
                        className={`flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-[9px] transition-colors ${
                          selected
                            ? 'border-monokai-yellow/40 bg-monokai-yellow/10 text-monokai-yellow'
                            : 'border-monokai-accent/20 bg-white/[0.02] text-monokai-comment hover:text-monokai-fg'
                        }`}
                      >
                        {selected && <Check className="h-2.5 w-2.5 shrink-0" />}
                        <span className="truncate">{rule.title}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-monokai-accent/20 px-2 py-1.5 text-[10px] text-monokai-comment">
                  当前材料没有洞察或反思规则。
                </p>
              )}
            </div>
          </section>

          <SimulationResultPanel result={result} />
        </div>
      </div>
    </article>
  );
};

interface SelectFieldProps {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  accent: 'cyan' | 'amethyst' | 'yellow' | 'green' | 'pink';
  children: React.ReactNode;
}

const accentClasses = {
  cyan: 'text-monokai-cyan focus:border-monokai-cyan/60',
  amethyst: 'text-monokai-amethyst focus:border-monokai-amethyst/60',
  yellow: 'text-monokai-yellow focus:border-monokai-yellow/60',
  green: 'text-monokai-green focus:border-monokai-green/60',
  pink: 'text-monokai-pink focus:border-monokai-pink/60',
};

const SelectField: React.FC<SelectFieldProps> = ({
  label,
  value,
  onChange,
  accent,
  children,
}) => (
  <label className="block min-w-0">
    <span className={`mb-1 block text-[9px] font-bold uppercase tracking-wider ${accentClasses[accent].split(' ')[0]}`}>
      {label}
    </span>
    <select
      aria-label={label}
      value={value}
      onChange={event => onChange(event.target.value)}
      className={`w-full min-w-0 rounded-lg border border-monokai-accent/25 bg-[#101119] px-2 py-2 text-[11px] text-monokai-fg outline-none ${accentClasses[accent]}`}
    >
      {children}
    </select>
  </label>
);

const SimulationResultPanel: React.FC<{ result: SimulationResult }> = ({ result }) => {
  const evidence = getEvidencePresentation(result.finalOutcome.evidenceLevel);
  const ruleConflictCount = result.conflicts.filter(conflict => conflict.kind === 'rule').length;
  const evidenceConflictCount = result.conflicts.filter(conflict => conflict.kind === 'evidence').length;

  if (result.status === 'excluded') {
    return (
      <section className="rounded-xl border border-monokai-pink/30 bg-monokai-pink/[0.06] p-3">
        <div className="flex items-center gap-2 text-xs font-bold text-monokai-pink">
          <ShieldAlert className="h-4 w-4" />
          组合在推演前被排除
        </div>
        <div className="mt-2 space-y-1.5">
          {result.exclusions.map(issue => (
            <div key={issue.code} className="rounded-lg bg-black/20 px-2.5 py-2">
              <div className="text-[10px] font-bold text-monokai-pink">{issue.title}</div>
              <p className="mt-0.5 text-[10px] leading-relaxed text-monokai-fg/70">{issue.detail}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div>
        <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-monokai-cyan">
          <GitBranch className="h-3.5 w-3.5" />
          状态如何一步步变化
        </h3>
        <div className="relative space-y-2 pl-5 before:absolute before:bottom-3 before:left-[7px] before:top-3 before:w-px before:bg-monokai-cyan/20">
          {result.timeline.map(step => (
            <div key={step.id} className="relative rounded-lg border border-monokai-accent/15 bg-[#101119] p-2.5">
              <span className="absolute -left-[18px] top-3 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-monokai-cyan/40 bg-[#171824] text-[7px] font-bold text-monokai-cyan">
                {step.index}
              </span>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-monokai-fg">{step.title}</span>
                <span className="text-[9px] font-mono text-monokai-comment">t+{step.atHours}h</span>
              </div>
              <p className="mt-0.5 text-[10px] leading-relaxed text-monokai-comment">
                {step.description}
              </p>
              {step.changes.map(change => (
                <div
                  key={`${change.objectId}-${change.property}`}
                  className="mt-2 flex flex-wrap items-center gap-1.5 rounded-md bg-monokai-cyan/[0.06] px-2 py-1.5 text-[9px]"
                >
                  <span className="font-semibold text-monokai-fg">{change.objectName}.{change.property}</span>
                  <span className="text-monokai-comment">{displayValue(change.before)}</span>
                  <ArrowRight className="h-2.5 w-2.5 text-monokai-cyan" />
                  <span className="font-bold text-monokai-cyan">{displayValue(change.after)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-monokai-yellow/20 bg-monokai-yellow/[0.04] p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-monokai-yellow">
            <Zap className="h-3.5 w-3.5" />
            触发规则 {result.triggeredRules.length}
          </div>
          <div className="mt-1.5 space-y-1">
            {result.triggeredRules.length > 0 ? result.triggeredRules.map(rule => (
              <div key={rule.id} title={rule.description} className="truncate text-[9px] text-monokai-fg/75">
                · {rule.title}
              </div>
            )) : (
              <div className="text-[9px] text-monokai-comment">没有规则被触发</div>
            )}
          </div>
        </div>

        <div className={`rounded-xl border p-2.5 ${
          result.conflicts.length > 0
            ? 'border-monokai-pink/25 bg-monokai-pink/[0.05]'
            : 'border-monokai-green/20 bg-monokai-green/[0.04]'
        }`}>
          <div className={`flex items-center gap-1.5 text-[10px] font-bold ${
            result.conflicts.length > 0 ? 'text-monokai-pink' : 'text-monokai-green'
          }`}>
            {result.conflicts.length > 0
              ? <AlertTriangle className="h-3.5 w-3.5" />
              : <CheckCircle2 className="h-3.5 w-3.5" />}
            推演冲突 {result.conflicts.length}
          </div>
          <div className="mt-1.5 space-y-1">
            <div className="text-[9px] text-monokai-comment">
              规则互斥 {ruleConflictCount} · 证据冲突 {evidenceConflictCount}
            </div>
            {result.conflicts.length > 0 ? result.conflicts.map(conflict => (
              <div key={conflict.code} title={conflict.detail} className="truncate text-[9px] text-monokai-fg/75">
                · {conflict.title}
              </div>
            )) : (
              <div className="text-[9px] text-monokai-comment">当前组合没有发现冲突</div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-monokai-amethyst/25 bg-gradient-to-r from-monokai-amethyst/[0.08] to-monokai-cyan/[0.06] p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[9px] font-bold uppercase tracking-wider text-monokai-amethyst">
              最终可能结果
            </div>
            <div className="mt-0.5 text-[11px] font-bold text-monokai-fg">
              {result.finalOutcome.title}
            </div>
            <p className="mt-0.5 text-[10px] leading-relaxed text-monokai-comment">
              {result.finalOutcome.summary}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[8px] uppercase text-monokai-comment">依据</div>
            <div className={`text-sm font-black ${evidence.className}`}>
              {evidence.label}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default OntologySimulationLab;
