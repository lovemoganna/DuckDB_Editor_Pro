import './metricUi.css';
import React, { useState, useEffect, useRef } from 'react';
import { MetricDefinition } from '../types';
import { Edit3, Check, Calculator, FileText, Layers } from 'lucide-react';
import { ActionButton, FormSelect, FormInput, FormTextarea, ModalShell } from './ui/Workbench';
import { duckDBService } from '../services/duckdbService';
import { metricAnalyzer } from '../services/metricAnalyzer';
import { compileMetricSql, METRIC_AGGREGATIONS, METRIC_GRAINS, metricCalculationFields } from '../services/metricSql';
import { AGGREGATION_LABELS, metricReadiness } from '../data/metricSystem';
import type { MetricMeasure, MetricGovernance } from '../types/metric';
import { metricDraftIssues } from '../services/metricAuthoring';
import { activeAnalysisDatabase } from '../services/metricAssetStorage';

interface MetricEditModalProps {
  isOpen: boolean;
  metric: MetricDefinition | null;
  onClose: () => void;
  onSave: (metric: MetricDefinition) => void | Promise<void>;
  tables?: string[];
  creating?: boolean;
}

export const MetricEditModal: React.FC<MetricEditModalProps> = ({
  isOpen,
  metric,
  onClose,
  onSave,
  tables = [],
  creating = false,
}) => {
  const [formData, setFormData] = useState<MetricDefinition | null>(null);
  const [columns, setColumns] = useState<{name: string; type: string}[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState<{key: string; metric: MetricDefinition} | null>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    requestRef.current++;
    setBusy(false);
    if (metric && isOpen) {
      setFormData({ ...metric });
      setError(''); setVerified(null);
    }
    return () => { requestRef.current++; };
  }, [metric, isOpen]);

  useEffect(() => {
    let cancelled = false;
    setColumns([]);
    if (formData?.sourceTable) void duckDBService.getTableSchema(formData.sourceTable).then(schema => {
      if (!cancelled) setColumns(schema);
    }).catch(err => { if (!cancelled) setError(String(err)); });
    return () => { cancelled = true; };
  }, [formData?.sourceTable]);

  if (!isOpen || !formData) return null;

  const key = JSON.stringify(formData);
  const canSave = verified?.key === key && verified.metric.validationDatabase === activeAnalysisDatabase();
  const calculation = formData.calculation;
  const setCalculation = (updates: Partial<NonNullable<MetricDefinition['calculation']>>) => {
    const defaults: Partial<NonNullable<MetricDefinition['calculation']>> = updates.aggregation === 'RATIO'
      ? { numerator: { aggregation: 'COUNT' }, denominator: { aggregation: 'COUNT' }, scale: 1 }
      : updates.aggregation === 'QUANTILE' ? { quantile: 0.95 } : {};
    const next = { aggregation: 'COUNT' as const, ...calculation, ...defaults, ...updates };
    setFormData({ ...formData, calculation: next,
      governance: { ...formData.governance, reviewStatus: 'draft' },
      unit: next.transform === 'previous_growth' || next.transform === 'year_growth' ? '%' : next.aggregation === 'RATIO' ? next.scale === 100 ? '%' : '比例' : updates.aggregation || (updates.transform === 'none' && ['previous_growth', 'year_growth'].includes(calculation?.transform || '')) ? '' : formData.unit });
  };
  const setGovernance = (updates: Partial<MetricGovernance>) => setFormData({ ...formData, governance: { ...formData.governance, ...updates } });
  const numericColumns = columns.filter(col => /INT|DECIMAL|DOUBLE|FLOAT|REAL|NUMERIC/i.test(col.type));
  const measureEditor = (part: 'numerator' | 'denominator', label: string) => {
    const measure = calculation?.[part] || { aggregation: 'COUNT' };
    const update = (patch: Partial<MetricMeasure>) => setCalculation({ [part]: { ...measure, ...patch } });
    return <fieldset className="rounded border border-monokai-border p-3 space-y-2"><legend>{label}</legend>
      <label className="block text-xs">聚合<FormSelect aria-label={`${label}聚合`} value={measure.aggregation} onChange={e => update({ aggregation: e.target.value as MetricMeasure['aggregation'], field: undefined })} >
        {['COUNT', 'COUNT DISTINCT', 'SUM'].map(value => <option key={value}>{value}</option>)}</FormSelect></label>
      <label className="block text-xs">字段<FormSelect aria-label={`${label}字段`} value={measure.field || ''} onChange={e => update({ field: e.target.value || undefined })} >
        <option value="">全部记录（仅 COUNT）</option>{(measure.aggregation === 'SUM' ? numericColumns : columns).map(col => <option key={col.name}>{col.name}</option>)}</FormSelect></label>
      <label className="block text-xs">子集条件<FormInput aria-label={`${label}条件`} value={measure.filter || ''} onChange={e => update({ filter: e.target.value })} placeholder="留空表示共同总体；填写 DuckDB 布尔表达式" /></label>
    </fieldset>;
  };
  const handleValidate = async () => {
    const request = ++requestRef.current;
    setBusy(true); setError(''); setVerified(null);
    try {
      if (!formData.name.trim()) throw new Error('请填写指标名称');
      if (formData.governance?.reviewStatus === 'reviewed' && metricReadiness(formData).length) throw new Error(`业务复核前请补齐：${metricReadiness(formData).join('；')}`);
      const candidate = { ...formData, dependencies: calculation ? metricCalculationFields(formData) : formData.dependencies, formula: calculation ? compileMetricSql(formData) : formData.formula, sqlValidation: undefined };
      const result = await metricAnalyzer.validateMetric(candidate, candidate.sourceTable || (tables.length === 1 ? tables[0] : ''));
      if (request !== requestRef.current) return;
      if (!result.isValid) throw new Error(result.error);
      setVerified({ key, metric: { ...candidate, sqlValidation: result.sql, isValid: true,
        lastValidated: Date.now(), validationDatabase: result.database, validationResult: result.result?.slice(0, 20), validationError: undefined } });
    } catch (err) { if (request === requestRef.current) setError((err as Error).message); }
    finally { if (request === requestRef.current) setBusy(false); }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || !verified) return;
    setBusy(true);
    try { await onSave(verified.metric); onClose(); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <ModalShell
      className="metric-surface"
      open={isOpen}
      onClose={onClose}
      title={creating ? '手动建立指标' : '编辑指标语义定义'}
      description="调整指标的计算公式、业务场景与元数据定义"
      icon={Edit3}
      badge={formData.name}
      size="md"
      footer={
        <>
          <ActionButton variant="secondary" size="sm" onClick={onClose} type="button">
            取消
          </ActionButton>
          <ActionButton
            variant="secondary" size="sm" onClick={handleValidate} disabled={busy} loading={busy} type="button"
          >验证计算</ActionButton>
          <ActionButton
            variant="success"
            size="sm"
            icon={Check}
            type="submit"
            form="metric-edit-form"
            disabled={busy || !canSave}
          >
            保存指标定义
          </ActionButton>
        </>
      }
    >
      <form id="metric-edit-form" onSubmit={handleSubmit} className="space-y-4" aria-busy={busy}>
        <fieldset disabled={busy} className="min-w-0 space-y-4">
        {/* Top row: Name & Category & Unit */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-1">
            <label className="block text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1">
              指标标识 (Name) *
            </label>
            <FormInput
              aria-label="指标名称"
              fontVariant="mono"
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1">
              业务分类 (Category)
            </label>
            <FormInput
              aria-label="业务分类"
              value={formData.category || ''}
              onChange={e => setFormData({ ...formData, category: e.target.value })}
              placeholder="例如: 营收类, 流量类"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1">
              计量单位 (Unit)
            </label>
            <FormInput
              aria-label="计量单位"
              fontVariant="mono"
              value={formData.unit || ''}
              onChange={e => setFormData({ ...formData, unit: e.target.value })}
              placeholder="元, %, 个, 人"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1">
              定义方式
            </label>
            <FormSelect
              aria-label="定义方式"
              value={calculation ? 'builder' : 'sql'}
              onChange={e => {
                if (e.target.value === 'builder') setFormData({ ...formData, calculation: { aggregation: 'COUNT' } });
                else {
                  try {
                    setFormData({ ...formData, formula: calculation ? compileMetricSql(formData) : formData.formula, calculation: undefined });
                  } catch {
                    setFormData({ ...formData, calculation: undefined });
                    setError('字段配置尚未完整，请直接填写只读 SQL 查询后验证。');
                  }
                }
              }}
            >
              <option value="builder">字段与聚合</option>
              <option value="sql">SQL 公式 / 多表查询</option>
            </FormSelect>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1">
              来源表
            </label>
            <FormSelect
              aria-label="来源表"
              value={formData.sourceTable || ''}
              onChange={e => setFormData({ ...formData, sourceTable: e.target.value, governance: { ...formData.governance, reviewStatus: 'draft' }, dependencies: [], calculation: calculation ? { aggregation: 'COUNT' } : undefined })}
            >
              <option value="">请选择；完整多表 SQL 须明确每张表</option>
              {[...new Set([...tables, ...(formData.sourceTable ? [formData.sourceTable] : [])])].map(table => <option key={table}>{table}</option>)}
            </FormSelect>
          </div>
        </div>
        {calculation && <div className="space-y-3 p-3 rounded-lg border border-monokai-border bg-monokai-sidebar/40">
          <div>
            <label className="block text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1">
              聚合方式
            </label>
            <FormSelect aria-label="聚合方式" value={calculation.aggregation} onChange={e => setCalculation({ aggregation: e.target.value as typeof calculation.aggregation })} >
              {METRIC_AGGREGATIONS.map(value => <option key={value} value={value}>{AGGREGATION_LABELS[value]} · {value}</option>)}
            </FormSelect>
          </div>
          {calculation.aggregation !== 'RATIO' && <div>
            <label className="block text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1">
              计算字段
            </label>
            <FormSelect aria-label="计算字段" value={calculation.field || ''} onChange={e => setCalculation({ field: e.target.value || undefined })} >
              <option value="">全部记录（仅 COUNT）</option>{(['COUNT', 'COUNT DISTINCT'].includes(calculation.aggregation) ? columns : numericColumns).map(col => <option key={col.name} value={col.name}>{col.name} ({col.type})</option>)}
            </FormSelect>
          </div>}
          {calculation.aggregation === 'RATIO' && <><div className="grid grid-cols-1 md:grid-cols-2 gap-3">{measureEditor('numerator', '分子')}{measureEditor('denominator', '分母')}</div>
            <div>
              <label className="block text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1">
                输出倍率
              </label>
              <FormSelect aria-label="输出倍率" value={calculation.scale || 1} onChange={e => setCalculation({ scale: Number(e.target.value) as 1 | 100 })} >
                <option value={1}>比例 · 0–1</option>
                <option value={100}>百分数 · 0–100</option>
              </FormSelect>
            </div>
            <p className="text-xs text-monokai-comment">分子、分母共享总体过滤和分组；状态比率不等于有序事件漏斗。零分母返回 NULL。</p></>}
          {calculation.aggregation === 'WEIGHTED_AVG' && <div>
            <label className="block text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1">
              权重字段
            </label>
            <FormSelect aria-label="权重字段" value={calculation.weightField || ''} onChange={e => setCalculation({ weightField: e.target.value })} >
              <option value="">请选择权重</option>{numericColumns.map(col => <option key={col.name}>{col.name}</option>)}
            </FormSelect>
          </div>}
          {calculation.aggregation === 'QUANTILE' && <div>
            <label className="block text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1">
              分位点（0–1）
            </label>
            <FormInput type="number" min={0} max={1} step={0.01} aria-label="分位点" value={calculation.quantile ?? 0.95} onChange={e => setCalculation({ quantile: e.target.value === '' ? undefined : Number(e.target.value) })} />
          </div>}
          <div>
            <label className="block text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1">
              过滤条件（WHERE 表达式）
            </label>
            <FormInput aria-label="过滤条件" value={calculation.filter || ''} onChange={e => setCalculation({ filter: e.target.value })} placeholder="例如: amount > 0 AND status = 'completed'" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1">
              分组维度（可多选）
            </label>
            <FormSelect className="h-auto min-h-24" multiple aria-label="分组维度" value={calculation.groupBy || []} onChange={e => setCalculation({ groupBy: Array.from(e.target.selectedOptions, (option: HTMLOptionElement) => option.value) })} >
              {columns.map(col => <option key={col.name}>{col.name}</option>)}
            </FormSelect>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1">
                时间字段
              </label>
              <FormSelect aria-label="时间字段" value={calculation.timeField || ''} onChange={e => setCalculation({ timeField: e.target.value || undefined })} >
                <option value="">无</option>{columns.filter(col => /DATE|TIME/i.test(col.type)).map(col => <option key={col.name}>{col.name}</option>)}
              </FormSelect>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1">
                统计粒度
              </label>
              <FormSelect aria-label="统计粒度" value={calculation.grain || ''} onChange={e => setCalculation({ grain: e.target.value as typeof calculation.grain || undefined })} >
                <option value="">总体 / 分组</option>{METRIC_GRAINS.map(grain => <option key={grain}>{grain}</option>)}
              </FormSelect>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1">
              分析变换
            </label>
            <FormSelect aria-label="分析变换" value={calculation.transform || 'none'} onChange={e => setCalculation({ transform: e.target.value as typeof calculation.transform })} >
              <option value="none">原始聚合</option><option value="cumulative">累计求和</option><option value="rolling">日历滚动求和</option><option value="previous_growth">环比增长率（%）</option><option value="year_growth">同比增长率（%）</option>
            </FormSelect>
          </div>
          {calculation.transform === 'rolling' && <div>
            <label className="block text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1">
              窗口期数（含当前期）
            </label>
            <FormInput aria-label="窗口期数" type="number" min={1} max={10000} value={calculation.windowPeriods ?? 7} onChange={e => setCalculation({ windowPeriods: Number(e.target.value) })} />
          </div>}
          {calculation.transform && calculation.transform !== 'none' && <p className="text-xs text-monokai-comment">累计从过滤起点开始；滚动按日历区间。缺失期间不自动补零，缺失或零基期的增长率为 NULL。增长率输出单位请填写 %。</p>}
        </div>}

        {/* Formula box */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider flex items-center gap-1.5">
              <Calculator size={13} className="text-monokai-green" />
              DuckDB 计算公式 (SQL Formula) *
            </label>
            <span className="text-[10px] text-monokai-comment font-mono">聚合表达式或 CTE 结构</span>
          </div>
          <FormTextarea
            aria-label="计算公式"
            required
            readOnly={!!calculation}
            fontVariant="mono"
            rows={3}
            value={calculation ? (() => { try { return compileMetricSql(formData); } catch { return ''; } })() : formData.formula}
            onChange={e => setFormData({ ...formData, formula: e.target.value, governance: { ...formData.governance, reviewStatus: 'draft' } })}
            className="text-monokai-green"
            placeholder="例如: SUM(order_amount) 或 COUNT(DISTINCT user_id)"
          />
        </div>

        {/* Definition */}
        <div>
          <label className="block text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <FileText size={13} className="text-monokai-cyan" />
            指标定义与业务口径
          </label>
          <FormTextarea
            aria-label="业务口径"
            rows={2}
            value={formData.definition || ''}
            onChange={e => setFormData({ ...formData, definition: e.target.value, governance: { ...formData.governance, reviewStatus: 'draft' } })}
            placeholder="清晰描述该指标所表达的具体业务逻辑与统计边界"
          />
        </div>
        <details className="rounded-lg border border-monokai-border bg-monokai-sidebar/30 p-3" open>
          <summary className="cursor-pointer text-xs font-semibold text-monokai-fg hover:text-monokai-accent transition-colors">口径契约与审核</summary>
          <p className="text-xs text-monokai-comment my-2">SQL 执行通过与业务审核分别记录；时区为口径登记，需在数据或 SQL 中完成转换。</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {([['owner', '负责人'], ['entity', '统计主体'], ['sourceGrain', '来源事实粒度'], ['timezone', '业务时区'], ['freshness', '更新频率 / 延迟'], ['exclusions', '排除与空值规则']] as const).map(([field, label]) => (
              <div key={field}>
                <label className="block text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1">{label}</label>
                <FormInput aria-label={label} value={formData.governance?.[field] || ''} onChange={e => setGovernance({ [field]: e.target.value })} />
              </div>
            ))}
            <div>
              <label className="block text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1">指标用途</label>
              <FormSelect aria-label="指标用途" value={formData.governance?.role || ''} onChange={e => setGovernance({ role: e.target.value as MetricGovernance['role'] })}>
                <option value="">未登记</option>
                <option value="outcome">结果</option>
                <option value="driver">驱动</option>
                <option value="guardrail">护栏</option>
                <option value="diagnostic">诊断</option>
              </FormSelect>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1">基础度量可加性</label>
              <FormSelect aria-label="可加性" value={formData.governance?.additivity || ''} onChange={e => setGovernance({ additivity: e.target.value as MetricGovernance['additivity'] })}>
                <option value="">未登记</option>
                <option value="additive">完全可加</option>
                <option value="semi_additive">半可加（如余额）</option>
                <option value="non_additive">不可加（如比率 / 去重）</option>
              </FormSelect>
            </div>
            <div className="md:col-span-2">
              <label className="block text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1">审核状态</label>
              <FormSelect aria-label="审核状态" value={formData.governance?.reviewStatus || 'draft'} onChange={e => setGovernance({ reviewStatus: e.target.value as MetricGovernance['reviewStatus'] })}>
                <option value="draft">草稿</option>
                <option value="reviewed">已业务复核</option>
                <option value="deprecated">已废弃</option>
              </FormSelect>
            </div>
          </div>
          <p className="text-xs text-monokai-yellow mt-2.5">{metricReadiness(formData).length ? `待完善：${metricReadiness(formData).join('；')}` : '口径登记完整，请与明细或独立来源对账。'}</p>
        </details>
        {metricDraftIssues(formData).length > 0 && <p role="status" className="text-xs text-monokai-yellow">候选待补齐：{metricDraftIssues(formData).join('、')}；技术验证与业务审核分别确认。</p>}
        {error && <div role="alert" className="rounded-md border border-monokai-pink/20 bg-monokai-pink/10 p-2.5 text-monokai-pink text-xs whitespace-pre-wrap">{error}</div>}
        {canSave && <div role="status" className="p-2.5 rounded-lg border border-monokai-green/20 bg-monokai-green/10 text-xs text-monokai-green">
          <p className="font-semibold">已在 {verified.metric.validationDatabase} 执行。请核对业务口径和结果后保存：</p>
          <pre className="overflow-auto max-h-40 mt-1.5 border border-monokai-green/20 rounded bg-monokai-bg/80 p-2">{JSON.stringify(verified.metric.validationResult, (_, value) => typeof value === 'bigint' ? String(value) : value, 2)}</pre>
        </div>}


        {/* 2-col: Scenario & Characteristics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1">
              应用场景 (Scenario)
            </label>
            <FormInput
              aria-label="应用场景"
              value={formData.scenario || ''}
              onChange={e => setFormData({ ...formData, scenario: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1">
              指标特征 (Characteristics)
            </label>
            <FormInput
              aria-label="指标特征"
              value={formData.characteristics || ''}
              onChange={e => setFormData({ ...formData, characteristics: e.target.value })}
            />
          </div>
        </div>

        {/* 2-col: Value & Example */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1">
              业务价值 (Value)
            </label>
            <FormInput
              aria-label="业务价值"
              value={formData.value || ''}
              onChange={e => setFormData({ ...formData, value: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1">
              典型案例数值 (Example)
            </label>
            <FormInput
              aria-label="典型案例"
              value={formData.example || ''}
              onChange={e => setFormData({ ...formData, example: e.target.value })}
            />
          </div>
        </div>

        {/* Dependencies */}
        <div>
          <label className="block text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Layers size={13} className="text-monokai-yellow" />
            依赖字段列表 (Dependencies, 逗号分隔)
          </label>
          <FormInput
            aria-label="依赖字段列表"
            fontVariant="mono"
            value={formData.dependencies?.join(', ') || ''}
            onChange={e => {
              const deps = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
              setFormData({ ...formData, dependencies: deps });
            }}
            placeholder="例如: created_at, order_amount, user_id"
          />
        </div>
        </fieldset>
      </form>
    </ModalShell>
  );
};

export default MetricEditModal;
