import './metricUi.css';
import { analyzeMetric } from '../hooks/store/useAnalysisWorkspace';
import React, { useState } from 'react';
import { MetricDefinition } from '../types';
import {
  Trash2, Copy, Check, Tag, Lightbulb, Star, BookOpen,
  Calculator, FileText, Link, ChevronDown, ChevronUp,
  Play, Wrench, AlertCircle, CheckCircle, BarChart2, GitBranch,
  Edit3, MoreHorizontal, Sparkles, Terminal, Loader2
} from 'lucide-react';
import { ActionButton, IconButton } from './ui/Workbench';
import { toastService } from '../services/toastService';
import { metricReadiness, metricOutputAdditivity } from '../data/metricSystem';
import { metricDraftIssues } from '../services/metricAuthoring';

interface MetricCardProps {
  metric: MetricDefinition;
  onEdit: (metric: MetricDefinition) => void;
  onDelete: (id: string) => void;
  onValidate?: (metric: MetricDefinition) => void;
  onFix?: (metric: MetricDefinition) => void;
  onGenerateChart?: (metric: MetricDefinition) => void;
  onViewChart?: (metricId: string) => void;
  onShowLineage?: (metric: MetricDefinition) => void;
  onExecuteInEditor?: (metric: MetricDefinition) => void;
  sourceTable?: string;
  hasChart?: boolean;
  onToggleFavorite?: (id: string) => void;
  isFavorite?: boolean;
  busy?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  metric,
  onEdit,
  onDelete,
  onValidate,
  onFix,
  onGenerateChart,
  onViewChart,
  onShowLineage,
  onExecuteInEditor,
  sourceTable,
  hasChart = false,
  onToggleFavorite,
  isFavorite = false,
  busy = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isGeneratingChart, setIsGeneratingChart] = useState(false);
  const resultRows = metric.isValid === true ? metric.validationResult : undefined;
  const resultColumns = resultRows?.length ? Object.keys(resultRows[0]) : [];
  const scalarResult = resultRows?.length === 1 && resultColumns.length === 1;
  const formatResult = (value: unknown) => value === null || value === undefined ? 'NULL'
    : typeof value === 'number' ? value.toLocaleString('zh-CN', { maximumFractionDigits: 6 }) : String(value);

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(metric, null, 2));
      setCopied(true);
      toastService.success('指标 JSON 已复制', metric.name);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toastService.error('复制失败', '请检查剪贴板权限');
    }
  };

  const handleCopySql = async () => {
    const textToCopy = metric.sqlValidation || metric.formula;
    if (!textToCopy) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedSql(true);
      toastService.success('SQL 已复制到剪贴板', textToCopy);
      setTimeout(() => setCopiedSql(false), 2000);
    } catch {
      toastService.error('复制失败', '请检查剪贴板权限');
    }
  };

  const handleValidate = async () => {
    if (!onValidate) return;
    setIsValidating(true);
    try {
      await onValidate(metric);
    } finally {
      setIsValidating(false);
    }
  };

  const handleFix = async () => {
    if (!onFix) return;
    setIsValidating(true);
    try {
      await onFix(metric);
    } finally {
      setIsValidating(false);
    }
  };

  const handleGenerateChart = async () => {
    if (hasChart && onViewChart) { onViewChart(metric.id); return; }
    if (!onGenerateChart) return;
    setIsGeneratingChart(true);
    try {
      await onGenerateChart(metric);
    } finally {
      setIsGeneratingChart(false);
    }
  };

  return (
    <div className="metric-surface group min-w-0 bg-monokai-sidebar rounded-lg border border-monokai-border p-3.5 transition-all duration-150 shadow-xs hover:border-monokai-border-strong flex flex-col justify-between">
      <div>
        {/* Top Card Header */}
        <div className="metric-card-header flex flex-wrap items-start justify-between gap-2.5 mb-2.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span title={metric.name} className="font-bold text-xs text-monokai-fg group-hover:text-monokai-accent transition-colors break-words">
                {metric.name}
              </span>
              {metric.category && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-monokai-surface text-monokai-fg-muted border border-monokai-border">
                  {metric.category}
                </span>
              )}
              {metric.version && metric.version > 1 && (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-monokai-surface text-monokai-comment border border-monokai-border/60">
                  v{metric.version}
                </span>
              )}
            </div>

            {/* Badges row */}
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {metric.unit && (
                <span className="text-[11px] text-monokai-comment">
                  单位: <strong className="text-monokai-fg font-mono">{metric.unit}</strong>
                </span>
              )}
              {metric.isValid === true && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-monokai-green/15 text-monokai-green rounded text-[10px] font-semibold border border-monokai-green/25">
                  <CheckCircle size={10} /> 已验证
                </span>
              )}
              {metric.isValid === false && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-monokai-pink/15 text-monokai-pink rounded text-[10px] font-semibold border border-monokai-pink/25">
                  <AlertCircle size={10} /> 验证失败
                </span>
              )}
              {metric.isValid === undefined && <span className="text-[11px] text-monokai-comment">待验证</span>}
              {hasChart && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-monokai-accent/15 text-monokai-accent rounded text-[10px] font-semibold border border-monokai-accent/25">
                  <BarChart2 size={10} /> 已生成图表
                </span>
              )}
            </div>
          </div>

          {/* Quick Actions Row */}
          <div className="flex flex-wrap items-center gap-1">
            {/* Run in Editor */}
            {onExecuteInEditor && (
              <IconButton
                label="在 SQL 编辑器中运行"
                icon={Terminal}
                size="sm"
                tone="primary"
                onClick={() => onExecuteInEditor(metric)}
              />
            )}

            {/* Validate */}
            {onValidate && (
              <IconButton
                label="验证 SQL 计算"
                icon={isValidating ? Loader2 : Play}
                size="sm"
                tone="success"
                disabled={busy || isValidating || isGeneratingChart}
                onClick={handleValidate}
              />
            )}

            {/* AI Fix button (when invalid) */}
            {onFix && metric.isValid === false && (
              <IconButton
                label="修复字段并重新验证"
                icon={Wrench}
                size="sm"
                tone="warning"
                disabled={busy || isValidating || isGeneratingChart}
                onClick={handleFix}
              />
            )}

            {/* Generate Chart */}
            {onGenerateChart && (
              <IconButton
                label={hasChart ? "查看关联图表" : "生成图表"}
                icon={BarChart2}
                size="sm"
                tone={hasChart ? "primary" : "neutral"}
                disabled={busy || isGeneratingChart || isValidating}
                onClick={handleGenerateChart}
              />
            )}

            {/* Favorite toggle */}
            {onToggleFavorite && (
              <button
                type="button"
                aria-label={isFavorite ? "取消收藏" : "收藏指标"}
                aria-pressed={isFavorite}
                title={isFavorite ? "取消收藏" : "收藏指标"}
                onClick={() => onToggleFavorite(metric.id)}
                className={`h-8 w-8 inline-flex items-center justify-center rounded-lg cursor-pointer transition-colors duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monokai-accent/70 ${
                  isFavorite
                    ? 'text-monokai-yellow bg-monokai-yellow/15 border border-monokai-yellow/30'
                    : 'text-monokai-comment hover:text-monokai-yellow hover:bg-monokai-surface/80 border border-monokai-border/40 hover:border-monokai-border'
                }`}
              >
                <Star size={14} className={isFavorite ? 'fill-current' : ''} />
              </button>
            )}


            {/* Edit */}
            <IconButton
              label="编辑指标定义"
              icon={Edit3}
              size="sm"
              tone="neutral"
              onClick={() => onEdit(metric)}
              disabled={busy || isValidating || isGeneratingChart}
            />

            {/* Copy JSON */}
            <IconButton
              label="复制指标 JSON"
              icon={copied ? Check : Copy}
              size="sm"
              tone="neutral"
              onClick={handleCopyJson}
            />

            {/* Delete */}
            <IconButton
              label="删除指标"
              icon={Trash2}
              size="sm"
              tone="danger"
              onClick={() => onDelete(metric.id)}
              disabled={busy || isValidating || isGeneratingChart}
            />
          </div>
        </div>

        {resultRows && <div className="mb-2.5 p-2.5 rounded-lg bg-monokai-bg border border-monokai-border" aria-label="最近验证结果">
          <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-monokai-comment mb-1.5">
            <span className="font-medium text-monokai-fg-muted">最近验证结果</span>
            {metric.lastValidated && <time dateTime={new Date(metric.lastValidated).toISOString()}>{new Date(metric.lastValidated).toLocaleString('zh-CN')}</time>}
          </div>
          {scalarResult ? <div className="flex flex-wrap items-baseline gap-2">
            <strong className="text-xl font-semibold text-monokai-fg tabular-nums break-all">{formatResult(resultRows[0][resultColumns[0]])}</strong>
            {metric.unit && <span className="text-xs text-monokai-comment">{metric.unit}</span>}
          </div> : resultRows.length === 0 ? <p className="text-xs text-monokai-comment">查询未返回数据</p> : <>
            <div className="overflow-x-auto rounded border border-monokai-border/80"><table className="w-full text-xs text-left border-collapse"><thead><tr className="bg-monokai-surface/60">{resultColumns.slice(0, expanded ? undefined : 6).map(column => <th scope="col" className="p-1.5 font-medium text-monokai-comment border-b border-monokai-border" key={column}>{column}</th>)}</tr></thead>
              <tbody>{resultRows.slice(0, expanded ? 20 : 3).map((row, index) => <tr className="border-b border-monokai-border/50 last:border-b-0 hover:bg-monokai-surface/40" key={index}>{resultColumns.slice(0, expanded ? undefined : 6).map(column => <td key={column} className="p-1.5 text-monokai-fg max-w-[180px] truncate" title={formatResult(row[column])}>{formatResult(row[column])}</td>)}</tr>)}</tbody>
            </table></div>
            <p className="mt-1.5 text-[10px] text-monokai-comment">结果预览：{Math.min(resultRows.length, expanded ? 20 : 3)} 行 / {Math.min(resultColumns.length, expanded ? resultColumns.length : 6)} / {resultColumns.length} 列 · 完整结果可在 SQL 编辑器查看</p>
          </>}
        </div>}
        {metric.isValid === false && metric.validationError && <div role="alert" className="mb-2.5 p-2.5 text-xs text-monokai-pink bg-monokai-pink/10 border border-monokai-pink/20 rounded-md break-words">
          <span className="font-semibold">验证失败：</span>{metric.validationError}
        </div>}
        {/* Formula Preview Box */}
        {metricDraftIssues(metric).length > 0 && <div role="status" className="mb-2.5 rounded-md border border-monokai-yellow/30 bg-monokai-yellow/10 p-2.5 text-xs text-monokai-yellow">候选草稿待补齐：{metricDraftIssues(metric).join('、')}。可编辑补全，SQL 验证不代表业务价值已确认。</div>}
        <div className="mb-2.5 text-[11px] text-monokai-comment flex flex-wrap gap-2 items-center">
          <span>{metric.governance?.role === 'diagnostic' ? '基础诊断候选' : metric.governance?.reviewStatus === 'reviewed' && metricReadiness(metric).length === 0 ? '业务用途已复核' : '业务价值待确认'}</span>
          <span className="px-1.5 py-0.5 rounded bg-monokai-surface border border-monokai-border/70 text-monokai-fg-muted font-medium">{metric.governance?.reviewStatus === 'reviewed' ? '已业务复核' : metric.governance?.reviewStatus === 'deprecated' ? '已废弃' : '业务口径待审核'}</span>
          <span title={metricReadiness(metric).join('；')} className="hover:text-monokai-fg cursor-help">口径待完善 {metricReadiness(metric).length} 项</span>
          {metric.governance?.owner && <span>负责人：{metric.governance.owner}</span>}
          <span>{metricOutputAdditivity(metric)}</span>
        </div>
        <div className="mb-2.5 bg-monokai-bg rounded-md border border-monokai-border p-2 flex items-start justify-between gap-2 group/formula shadow-inner">
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-mono uppercase text-monokai-comment block mb-0.5">计算公式 (SQL)</span>
            <code className={`text-xs font-mono text-monokai-accent break-all leading-relaxed ${expanded ? 'whitespace-pre-wrap' : 'line-clamp-3'}`}>
              {metric.formula}
            </code>
          </div>
          <button
            type="button"
            onClick={handleCopySql}
            className="p-1 rounded text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface focus-visible:opacity-100 opacity-0 group-hover/formula:opacity-100 transition-opacity cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent"
            title="复制公式"
            aria-label="复制公式"
          >
            {copiedSql ? <Check size={12} className="text-monokai-green" /> : <Copy size={12} />}
          </button>
        </div>

        {/* Primary Meta Fields */}
        <div className="space-y-1.5 text-xs">
          {metric.scenario && (
            <div className="flex items-start gap-2 text-monokai-fg">
              <span className="text-[11px] text-monokai-comment shrink-0 mt-0.5 font-medium">场景:</span>
              <span className="text-xs leading-relaxed">{metric.scenario}</span>
            </div>
          )}
          {metric.definition && (
            <div className="flex items-start gap-2 text-monokai-comment">
              <span className="text-[11px] text-monokai-comment shrink-0 mt-0.5 font-medium">口径:</span>
              <span className="text-xs text-monokai-fg-muted leading-relaxed line-clamp-2">{metric.definition}</span>
            </div>
          )}
        </div>

        {/* Expanded Deep Details */}
        {expanded && (
          <div className="mt-2.5 pt-2.5 border-t border-monokai-border/40 space-y-2 text-xs animate-in fade-in duration-150">
            {metric.characteristics && (
              <div className="flex items-start gap-2">
                <span className="text-[11px] text-monokai-comment shrink-0 font-medium">特点:</span>
                <span className="text-xs text-monokai-fg">{metric.characteristics}</span>
              </div>
            )}
            {metric.value && (
              <div className="flex items-start gap-2">
                <span className="text-[11px] text-monokai-comment shrink-0 font-medium">价值:</span>
                <span className="text-xs text-monokai-fg">{metric.value}</span>
              </div>
            )}
            {metric.example && (
              <div className="flex items-start gap-2">
                <span className="text-[11px] text-monokai-comment shrink-0 font-medium">案例:</span>
                <span className="text-xs text-monokai-fg font-mono">{metric.example}</span>
              </div>
            )}
            {/* Dependencies & Lineage Tracing */}
            {metric.governance && <dl className="grid grid-cols-1 gap-1 text-monokai-comment">
              {([['entity', '主体'], ['sourceGrain', '事实粒度'], ['timezone', '业务时区'], ['freshness', '更新约定'], ['exclusions', '排除规则']] as const).map(([key, label]) => metric.governance?.[key] ? <div key={key}><dt className="inline font-medium">{label}：</dt><dd className="inline text-monokai-fg">{metric.governance[key]}</dd></div> : null)}
            </dl>}
            {!!metric.history?.length && <details className="rounded-md border border-monokai-border p-2.5">
              <summary className="cursor-pointer text-xs font-medium text-monokai-fg">口径变更记录（{metric.history.length}）</summary>
              <ol className="mt-2 space-y-2 text-[11px] text-monokai-comment">
                {[...metric.history].reverse().map((entry, index) => <li key={`${entry.version}-${entry.changedAt}-${index}`}>
                  <span className="font-mono text-monokai-fg">v{entry.version}</span> · <time dateTime={new Date(entry.changedAt).toISOString()}>{new Date(entry.changedAt).toLocaleString('zh-CN')}</time>
                  <div className="break-words">变更字段：{entry.changedFields.join('、')}</div>
                  <pre className="mt-1">{JSON.stringify(entry.previousValues, (_, value) => typeof value === 'bigint' ? String(value) : value, 2)}</pre>
                </li>)}
              </ol>
            </details>}
            {metric.dependencies && metric.dependencies.length > 0 ? (
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <span className="text-[11px] text-monokai-comment shrink-0 mt-0.5 font-medium">依赖字段:</span>
                  <div className="flex flex-wrap gap-1">
                    {metric.dependencies.map((dep, idx) => (
                      <span
                        key={idx}
                        title={dep}
                        className="px-1.5 py-0.5 bg-monokai-surface rounded text-[10px] font-mono text-monokai-fg-muted border border-monokai-border truncate max-w-[120px]"
                      >
                        {dep}
                      </span>
                    ))}
                  </div>
                </div>
                {onShowLineage && (
                  <button
                    type="button"
                    onClick={() => onShowLineage(metric)}
                    className="inline-flex items-center gap-1 text-[11px] text-monokai-cyan hover:underline shrink-0 cursor-pointer font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent rounded-xs"
                    title="查看指标依赖的物理表与字段血缘拓扑"
                  >
                    <GitBranch size={12} aria-hidden="true" />
                    <span>查看血缘</span>
                  </button>
                )}
              </div>
            ) : onShowLineage ? (
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-monokai-comment">依赖字段: <span className="italic text-monokai-comment/80">聚合计算 (无显式列依赖)</span></span>
                <button
                  type="button"
                  onClick={() => onShowLineage(metric)}
                  className="inline-flex items-center gap-1 text-[11px] text-monokai-cyan hover:underline shrink-0 cursor-pointer font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent rounded-xs"
                  title="查看指标依赖的物理表与字段血缘拓扑"
                >
                  <GitBranch size={12} aria-hidden="true" />
                  <span>查看血缘</span>
                </button>
              </div>
            ) : null}

            {/* SQL Execution Validation Output */}
            {metric.sqlValidation && (
              <div className="mt-2.5 p-2.5 bg-monokai-bg rounded-md border border-monokai-border shadow-inner">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono uppercase text-monokai-comment">执行验证语句</span>
                  <div className="flex items-center gap-2">
                    {onExecuteInEditor && (
                      <button
                        type="button"
                        onClick={() => onExecuteInEditor(metric)}
                        className="text-[10px] text-monokai-accent hover:underline cursor-pointer font-medium"
                      >
                        在编辑器中运行
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleCopySql}
                      className="text-[10px] text-monokai-fg-muted hover:text-monokai-fg cursor-pointer"
                    >
                      复制验证 SQL
                    </button>
                  </div>
                </div>
                <pre className="text-[11px] font-mono text-monokai-fg whitespace-pre-wrap leading-relaxed overflow-x-auto">
                  {metric.sqlValidation}
                </pre>
              </div>
            )}

            {/* Validation Error Banner */}
            {metric.validationError && metric.isValid !== false && (
              <div className="mt-2 p-2.5 bg-monokai-pink/10 border border-monokai-pink/20 rounded-md text-xs text-monokai-pink flex items-start gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="font-semibold text-[11px]">校验报错信息:</div>
                  <div className="font-mono text-[11px] break-all mt-0.5">{metric.validationError}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <ActionButton size="sm" variant="secondary" onClick={() => analyzeMetric(metric, sourceTable)}>进入指标分析 · 使用当前口径</ActionButton>
        <ActionButton size="sm" variant="ghost" onClick={() => void import('../services/homeDashboardService').then(({ addObjectToDashboard }) => addObjectToDashboard({ kind: 'metric', id: metric.id, name: metric.name })).then(() => toastService.success('指标已加入当前首页视图')).catch(err => toastService.error(String(err.message)))}>加入首页 · 引用当前指标</ActionButton>
      </div>
      {/* Expand/Collapse Trigger */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="w-full mt-2.5 pt-2 border-t border-monokai-border/40 flex items-center justify-center gap-1.5 text-xs text-monokai-comment hover:text-monokai-fg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent rounded-sm"
      >
        {expanded ? (
          <>收起详细参数 <ChevronUp size={13} /></>
        ) : (
          <>展开完整参数 <ChevronDown size={13} /></>
        )}
      </button>
    </div>

  );
};

export default MetricCard;
