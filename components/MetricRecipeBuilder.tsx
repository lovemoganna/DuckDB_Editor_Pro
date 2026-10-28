import './metricUi.css';
import React, { useEffect, useState } from 'react';
import type { MetricDefinition } from '../types';
import { duckDBService } from '../services/duckdbService';
import { buildMetricRecipe, METRIC_RECIPES, type MetricRecipeId } from '../services/metricRecipes';
import { ActionButton, FormSelect, FormInput } from './ui/Workbench';
import { AlertCircle, ArrowRight, Loader2, Sparkles } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  entity: '主体标识',
  time: '业务时间',
  event: '事件名称',
  value: '数值',
  tie: '唯一排序键',
  dimension: '分组维度',
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  entity: '主体去重标识 (Entity)',
  time: '业务发生时间 (Time)',
  event: '行为事件名称 (Event)',
  value: '聚合度量数值 (Value)',
  tie: '同时间唯一排序列 (Tie-breaker)',
  dimension: '分析切片维度 (Dimension)',
};

export function MetricRecipeBuilder({
  tables,
  onConfigure,
  initialRecipeId = 'retention',
}: {
  tables: string[];
  onConfigure: (metric: Omit<MetricDefinition, 'id' | 'createdAt'>) => void;
  initialRecipeId?: MetricRecipeId;
}) {
  const [id, setId] = useState<MetricRecipeId>(initialRecipeId);
  const [source, setSource] = useState('');
  const [columns, setColumns] = useState<{ name: string; type: string }[]>([]);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [startEvent, setStartEvent] = useState('');
  const [endEvent, setEndEvent] = useState('');
  const [days, setDays] = useState(1);
  const [cutoff, setCutoff] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialRecipeId) setId(initialRecipeId);
  }, [initialRecipeId]);

  useEffect(() => {
    let cancelled = false;
    setColumns([]);
    setFields({});
    setError('');
    setLoading(Boolean(source));

    if (source) {
      void duckDBService
        .getTableSchema(source)
        .then(rows => {
          if (!cancelled) setColumns(rows);
        })
        .catch(err => {
          if (!cancelled) setError(String(err));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [source]);

  useEffect(() => {
    if (source && !tables.includes(source)) setSource('');
  }, [tables, source]);

  const recipe = METRIC_RECIPES.find(r => r.id === id) || METRIC_RECIPES[0];

  const handleGenerate = () => {
    try {
      setError('');
      const metric = buildMetricRecipe(id, { source, fields, startEvent, endEvent, days, cutoff });
      onConfigure(metric);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="metric-surface p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <div>
          <label className="block text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1">
            分析方法 (Recipe)
          </label>
          <FormSelect
            aria-label="分析方法"
            value={id}
            onChange={e => {
              setId(e.target.value as MetricRecipeId);
              setError('');
            }}
          >
            {METRIC_RECIPES.map(item => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </FormSelect>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1">
            真实来源表 (Source Table)
          </label>
          <FormSelect
            aria-label="方法来源表"
            value={source}
            onChange={e => setSource(e.target.value)}
          >
            <option value="">请选择来源表...</option>
            {tables.map(table => (
              <option key={table} value={table}>
                {table}
              </option>
            ))}
          </FormSelect>
        </div>
      </div>

      <div className="rounded-md border border-monokai-border bg-monokai-sidebar/50 p-3 text-xs text-monokai-fg-muted leading-relaxed">
        <span className="font-semibold text-monokai-accent mr-1">口径说明:</span>
        {recipe.note} 时间字段应先统一为业务时区。生成后在指标编辑器中核对 SQL 并执行验证。
      </div>

      {!tables.length && (
        <div className="flex items-center gap-2 rounded-md border border-monokai-yellow/30 bg-monokai-yellow/10 p-2.5 text-xs text-monokai-yellow">
          <AlertCircle size={14} className="shrink-0" />
          <span>当前指标包暂无可用来源表，请先为指标包关联数据源表。</span>
        </div>
      )}

      {/* Field Mapping Section */}
      <div className="rounded-md border border-monokai-border bg-monokai-sidebar/30 p-3.5 space-y-3">
        <div className="text-[11px] font-semibold text-monokai-fg uppercase tracking-wider flex items-center justify-between">
          <span>字段映射 (Field Mapping)</span>
          {loading && (
            <span role="status" className="flex items-center gap-1.5 text-2xs text-monokai-comment font-normal normal-case">
              <Loader2 size={11} className="animate-spin text-monokai-accent" />
              正在读取表结构...
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {recipe.fields.map(role => (
            <div key={role}>
              <label className="block text-[11px] font-medium text-monokai-fg-muted mb-1">
                {ROLE_LABELS[role] || role}
              </label>
              <FormSelect
                aria-label={ROLE_LABELS[role] || role}
                value={fields[role] || ''}
                onChange={e => setFields({ ...fields, [role]: e.target.value })}
              >
                <option value="">请选择字段...</option>
                {columns
                  .filter(col =>
                    role === 'time'
                      ? /DATE|TIME/i.test(col.type)
                      : role === 'value'
                      ? /INT|DECIMAL|DOUBLE|FLOAT|REAL|NUMERIC/i.test(col.type)
                      : true
                  )
                  .map(col => (
                    <option key={col.name} value={col.name}>
                      {col.name} ({col.type})
                    </option>
                  ))}
              </FormSelect>
            </div>
          ))}
        </div>
      </div>

      {/* Conditional Parameters for retention / funnel */}
      {(id === 'retention' || id === 'funnel') && (
        <div className="rounded-md border border-monokai-border bg-monokai-sidebar/30 p-3.5 space-y-3">
          <div className="text-[11px] font-semibold text-monokai-fg uppercase tracking-wider">
            分析参数 (Parameters)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-monokai-fg-muted mb-1">
                起始事件取值 (Start Event)
              </label>
              <FormInput
                aria-label="起始事件取值"
                placeholder="例如: signup 或 visit"
                value={startEvent}
                onChange={e => setStartEvent(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-monokai-fg-muted mb-1">
                回访 / 完成事件取值 (End Event)
              </label>
              <FormInput
                aria-label="完成事件取值"
                placeholder="例如: purchase 或 active"
                value={endEvent}
                onChange={e => setEndEvent(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-monokai-fg-muted mb-1">
                观察天数 (Window Days)
              </label>
              <FormInput
                aria-label="观察天数"
                type="number"
                min={1}
                max={3650}
                value={days}
                onChange={e => setDays(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-monokai-fg-muted mb-1">
                观察截止日期 (Cutoff Date)
              </label>
              <FormInput
                aria-label="观察截止日期"
                type="date"
                value={cutoff}
                onChange={e => setCutoff(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {source && !loading && !columns.length && !error && (
        <div role="status" className="flex items-center gap-2 rounded-md border border-monokai-yellow/30 bg-monokai-yellow/10 p-2.5 text-xs text-monokai-yellow">
          <AlertCircle size={14} className="shrink-0" />
          <span>所选表未读取到有效字段，请检查数据库连接或更换表。</span>
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-monokai-pink/40 bg-monokai-pink/10 p-3 text-xs text-monokai-pink">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span className="font-mono">{error}</span>
        </div>
      )}

      <div className="flex justify-end pt-1">
        <ActionButton
          variant="primary"
          size="sm"
          disabled={loading}
          onClick={handleGenerate}
        >
          <Sparkles size={13} className="mr-1 text-monokai-yellow" />
          生成 SQL 并核对口径
        </ActionButton>
      </div>
    </div>
  );
}
