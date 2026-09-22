import React, { useState } from 'react';
import { MetricDefinition } from '../types';
import {
  Trash2, Copy, Check, Tag, Lightbulb, Star, BookOpen,
  Calculator, FileText, Link, ChevronDown, ChevronUp,
  Play, Wrench, AlertCircle, CheckCircle, BarChart2, GitBranch,
  Edit3, MoreHorizontal, Sparkles, Terminal
} from 'lucide-react';
import { IconButton } from './ui/Workbench';
import { toastService } from '../services/toastService';

interface MetricCardProps {
  metric: MetricDefinition;
  onEdit: (metric: MetricDefinition) => void;
  onDelete: (id: string) => void;
  onValidate?: (metric: MetricDefinition) => void;
  onFix?: (metric: MetricDefinition) => void;
  onGenerateChart?: (metric: MetricDefinition) => void;
  onShowLineage?: (metric: MetricDefinition) => void;
  onExecuteInEditor?: (metric: MetricDefinition) => void;
  sourceTable?: string;
  hasChart?: boolean;
  onToggleFavorite?: (id: string) => void;
  isFavorite?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  metric,
  onEdit,
  onDelete,
  onValidate,
  onFix,
  onGenerateChart,
  onShowLineage,
  onExecuteInEditor,
  sourceTable: _sourceTable,
  hasChart = false,
  onToggleFavorite,
  isFavorite = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isGeneratingChart, setIsGeneratingChart] = useState(false);

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
    if (!onGenerateChart) return;
    setIsGeneratingChart(true);
    try {
      await onGenerateChart(metric);
    } finally {
      setIsGeneratingChart(false);
    }
  };

  return (
    <div className="group bg-monokai-sidebar rounded-md border border-monokai-border p-4 transition-all duration-150 shadow-xs hover:border-monokai-border-strong flex flex-col justify-between">
      <div>
        {/* Top Card Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-sm text-monokai-fg group-hover:text-monokai-accent transition-colors truncate">
                {metric.name}
              </span>
              {metric.category && (
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-monokai-surface text-monokai-fg-muted border border-monokai-border">
                  {metric.category}
                </span>
              )}
              {metric.version && metric.version > 1 && (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-monokai-surface text-monokai-comment">
                  v{metric.version}
                </span>
              )}
            </div>

            {/* Badges row */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {metric.unit && (
                <span className="text-[11px] text-monokai-comment">
                  单位: <strong className="text-monokai-fg font-mono">{metric.unit}</strong>
                </span>
              )}
              {metric.isValid === true && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 bg-emerald-500/10 text-emerald-400 rounded text-[10px] font-medium">
                  <CheckCircle size={10} /> 已验证
                </span>
              )}
              {metric.isValid === false && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 bg-rose-500/10 text-rose-400 rounded text-[10px] font-medium">
                  <AlertCircle size={10} /> 验证失败
                </span>
              )}
              {hasChart && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 bg-white/[0.06] text-monokai-fg-muted rounded text-[10px] font-medium">
                  <BarChart2 size={10} /> 已生成图表
                </span>
              )}
            </div>
          </div>

          {/* Quick Actions Row */}
          <div className="flex items-center gap-1 shrink-0">
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
                icon={Play}
                size="sm"
                tone="success"
                disabled={isValidating}
                onClick={handleValidate}
              />
            )}

            {/* AI Fix button (when invalid) */}
            {onFix && metric.isValid === false && (
              <IconButton
                label="AI 自动修复公式"
                icon={Wrench}
                size="sm"
                tone="warning"
                disabled={isValidating}
                onClick={handleFix}
              />
            )}

            {/* Generate Chart */}
            {onGenerateChart && (
              <IconButton
                label={hasChart ? "已生成图表" : "生成图表"}
                icon={BarChart2}
                size="sm"
                tone={hasChart ? "primary" : "neutral"}
                disabled={isGeneratingChart}
                onClick={handleGenerateChart}
              />
            )}

            {/* Favorite toggle */}
            {onToggleFavorite && (
              <button
                type="button"
                aria-label={isFavorite ? "取消收藏" : "收藏指标"}
                title={isFavorite ? "取消收藏" : "收藏指标"}
                onClick={() => onToggleFavorite(metric.id)}
                className={`h-8 w-8 inline-flex items-center justify-center rounded-md cursor-pointer transition-all duration-150 active:scale-95 ${
                  isFavorite
                    ? 'text-monokai-yellow bg-monokai-surface border border-monokai-border'
                    : 'text-monokai-comment hover:text-monokai-yellow hover:bg-monokai-surface border border-transparent'
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
            />
          </div>
        </div>

        {/* Formula Preview Box */}
        <div className="mb-3 bg-monokai-bg rounded-md border border-monokai-border p-2.5 flex items-start justify-between gap-2 group/formula shadow-inner">
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-mono uppercase text-monokai-comment block mb-0.5">计算公式 (SQL)</span>
            <code className="text-xs font-mono text-monokai-accent break-all leading-relaxed">
              {metric.formula}
            </code>
          </div>
          <button
            type="button"
            onClick={handleCopySql}
            className="p-1 rounded text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface opacity-0 group-hover/formula:opacity-100 transition-opacity cursor-pointer shrink-0"
            title="复制公式"
          >
            {copiedSql ? <Check size={12} className="text-monokai-green" /> : <Copy size={12} />}
          </button>
        </div>

        {/* Primary Meta Fields */}
        <div className="space-y-1.5 text-xs">
          {metric.scenario && (
            <div className="flex items-start gap-2 text-monokai-fg">
              <span className="text-[11px] text-monokai-comment shrink-0 mt-0.5">场景:</span>
              <span className="text-xs leading-relaxed">{metric.scenario}</span>
            </div>
          )}
          {metric.definition && (
            <div className="flex items-start gap-2 text-monokai-comment">
              <span className="text-[11px] text-monokai-comment shrink-0 mt-0.5">口径:</span>
              <span className="text-xs text-monokai-fg-muted leading-relaxed line-clamp-2">{metric.definition}</span>
            </div>
          )}
        </div>

        {/* Expanded Deep Details */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-monokai-border/40 space-y-2 text-xs animate-in fade-in duration-150">
            {metric.characteristics && (
              <div className="flex items-start gap-2">
                <span className="text-[11px] text-monokai-comment shrink-0">特点:</span>
                <span className="text-xs text-monokai-fg">{metric.characteristics}</span>
              </div>
            )}
            {metric.value && (
              <div className="flex items-start gap-2">
                <span className="text-[11px] text-monokai-comment shrink-0">价值:</span>
                <span className="text-xs text-monokai-fg">{metric.value}</span>
              </div>
            )}
            {metric.example && (
              <div className="flex items-start gap-2">
                <span className="text-[11px] text-monokai-comment shrink-0">案例:</span>
                <span className="text-xs text-monokai-fg font-mono">{metric.example}</span>
              </div>
            )}
            {metric.dependencies && metric.dependencies.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-[11px] text-monokai-comment shrink-0 mt-0.5">依赖字段:</span>
                <div className="flex flex-wrap gap-1">
                  {metric.dependencies.map((dep, idx) => (
                    <span
                      key={idx}
                      className="px-1.5 py-0.5 bg-monokai-surface rounded text-[10px] font-mono text-monokai-fg-muted border border-monokai-border"
                    >
                      {dep}
                    </span>
                  ))}
                </div>
              </div>
            )}

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
            {metric.validationError && (
              <div className="mt-2 p-2.5 bg-monokai-surface border border-monokai-border rounded-md text-xs text-monokai-pink flex items-start gap-2">
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

      {/* Expand/Collapse Trigger */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full mt-3 pt-2 border-t border-monokai-border/40 flex items-center justify-center gap-1.5 text-xs text-monokai-comment hover:text-monokai-fg transition-colors cursor-pointer"
      >
        {expanded ? (
          <>收起详细参数 <ChevronUp size={13} /></>
        ) : (
          <>展开完整参数与血缘 <ChevronDown size={13} /></>
        )}
      </button>
    </div>
  );
};

export default MetricCard;