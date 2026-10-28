import { expandChartExport } from '../../utils/chartExport';
import { chartContent, widgetSpace } from '../../utils/dashboardLayout';
import { analyzeChart } from '../../hooks/store/useAnalysisWorkspace';
import React, { useState } from 'react';
import type { MetricChart, ChartConfig } from '../../types';
import { ChartRenderer } from '../charts/ChartRenderer';
import { widgetRowsToChartSpec } from '../../services/analysis/adapters/dashboardWidgetAdapter';
import {
  Terminal,
  Pin,
  Download,
  Copy,
  Check,
  GitBranch,
  Table,
  Layers,
  Trash2,
  Edit,
  ExternalLink,
  Sparkles,
  AlertTriangle,
  Loader2,
  Maximize2,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { Chart as ChartJS } from 'chart.js';
import { toastService } from '../../services/toastService';
import { extractTablesFromSql } from '../../services/queryVizHint';

export interface VisualizationCardProps {
  chart: MetricChart;
  data?: any[];
  onOpenInSql?: (sql: string) => void;
  onNavigateToMetrics?: (metricId: string) => void;
  onNavigateToData?: (tableName: string) => void;
  onShowLineage?: (chart: MetricChart) => void;
  onPinToDashboard?: (chart: MetricChart) => void;
  onEdit?: (chart: MetricChart) => void;
  onDelete?: (chartId: string) => void;
  isPinned?: boolean;
  loading?: boolean;
  error?: string;
  pinning?: boolean;
  onInspect?: () => void;
  instanceId?: string;
}

export const VisualizationCard: React.FC<VisualizationCardProps> = ({
  chart,
  data = [],
  onOpenInSql,
  onNavigateToMetrics,
  onNavigateToData,
  onShowLineage,
  onPinToDashboard,
  onEdit,
  onDelete,
  isPinned = false,
  loading = false,
  error,
  pinning = false,
  onInspect,
  instanceId,
}) => {
  const [copiedSql, setCopiedSql] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const containerId = instanceId || `viz-card-${chart.id}`;

  const handleCopySql = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!chart.sql) return;
    try {
      await navigator.clipboard.writeText(chart.sql);
      setCopiedSql(true);
      toastService.success('查询 SQL 已复制到剪贴板');
      setTimeout(() => setCopiedSql(false), 1500);
    } catch {
      toastService.error('复制失败');
    }
  };

  const handleDownloadImage = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const element = document.getElementById(containerId);
    if (!element) return;
    try {
      setIsExporting(true);
      // Flush the loading-button render, then capture final chart geometry rather than an animation frame.
      await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
      element.querySelectorAll('canvas').forEach(canvas=>{
        const chart=ChartJS.getChart(canvas);
        if(chart){chart.stop();chart.update('none');}
      });
      const canvas = await html2canvas(element, {
        onclone: document => {
          expandChartExport(document, element);
          const clone=document.getElementById(containerId);
          if (!clone) return;
          clone.querySelectorAll<HTMLElement>('[data-export-ignore]').forEach(node=>{node.style.display='none';});
          clone.querySelectorAll<HTMLElement>('*').forEach(node=>{node.style.boxShadow='none';});
          const title=clone.querySelector('h3');
          if(title)title.style.color=getComputedStyle(element).color;
          clone.style.minHeight='0';
        },
        backgroundColor: getComputedStyle(element).backgroundColor,
        scale: 2,
      });
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${(chart.chartConfig?.title || chart.metricName || 'chart').replace(/[\s<>:"/\\|?*]+/g, '_')}.png`;
      link.href = url;
      link.click();
      toastService.success('图表图片导出成功');
    } catch (err) {
      console.error('Download chart failed:', err);
      toastService.error('导出失败，请重试');
    } finally {
      setIsExporting(false);
    }
  };

  const fallbackConfig: ChartConfig = {
    id: chart.id,
    title: chart.metricName || '图表',
    type: 'bar',
    xKey: data && data.length > 0 ? Object.keys(data[0])[0] || '' : '',
    yKeys: data && data.length > 0 && Object.keys(data[0]).length > 1 ? [Object.keys(data[0])[1]] : [],
  };
  const config = chart.chartConfig || fallbackConfig;
  const chartSpec = widgetRowsToChartSpec(data, config);

  const chartTypeLabel = chart.chartConfig?.type?.toUpperCase() || 'BAR';
  const sourceTable = chart.sourceTable || (chart.sql ? extractTablesFromSql(chart.sql)[0] : undefined);

  return (
    <div
      id={containerId}
      className="visualization-surface viz-gallery-card group relative flex flex-col rounded-xl border border-monokai-border bg-monokai-sidebar p-4 shadow-sm transition-colors hover:border-monokai-border-strong"
    >
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div className="mb-2.5 flex flex-wrap items-start justify-between gap-2.5 border-b border-monokai-border/70 pb-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="break-words font-sans text-xs font-bold text-monokai-fg transition-colors group-hover:text-monokai-accent" title={chart.chartConfig?.title || chart.metricName}>
              {chart.chartConfig?.title || chart.metricName || '未命名图表'}
            </h3>
            <span className="shrink-0 rounded border border-monokai-border bg-monokai-surface px-1.5 py-0.5 font-mono text-2xs font-semibold text-monokai-fg-muted">
              {chartTypeLabel}
            </span>
          </div>

          {/* Context Links: Metric, Source Table & Associated Analysis */}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-2xs text-monokai-comment">
            {sourceTable && (
              <button
                type="button"
                onClick={() => onNavigateToData && onNavigateToData(sourceTable)}
                disabled={!onNavigateToData}
                className="inline-flex items-center gap-1 font-mono text-monokai-comment hover:text-monokai-fg hover:underline cursor-pointer transition-colors"
                title={onNavigateToData ? `查看关联数据表 ${sourceTable}` : `数据表 ${sourceTable} 当前不可用`}
              >
                <Table size={11} aria-hidden="true" />
                <span>{sourceTable}</span>
              </button>
            )}

            {chart.metricId && onNavigateToMetrics && (
              <>
                {sourceTable && <span className="text-monokai-border/80">·</span>}
                <button
                  type="button"
                  onClick={() => onNavigateToMetrics && onNavigateToMetrics(chart.metricId || '')}
                  className="inline-flex items-center gap-1 font-mono text-monokai-cyan hover:underline cursor-pointer font-medium transition-colors"
                  title="前往指标中心查看关联定义"
                >
                  <Layers size={11} aria-hidden="true" />
                  <span>{chart.metricName}</span>
                </button>
              </>
            )}

            <span className="text-monokai-border/80">·</span>
            <button
              type="button"
              onClick={() => analyzeChart(chart)}
              className="inline-flex items-center gap-1 font-sans text-monokai-cyan hover:text-monokai-fg hover:underline cursor-pointer transition-colors"
              title="载入至分析工作台进行深入探索与多维下钻"
            >
              <Sparkles size={11} aria-hidden="true" />
              <span>关联分析</span>
            </button>
          </div>
        </div>

        {/* Top Right Quick Actions */}
        <div data-export-ignore className="flex flex-wrap shrink-0 items-center gap-1 transition-opacity">
          {onShowLineage && chart.metricName && (
            <button
              type="button"
              onClick={() => onShowLineage(chart)}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-transparent text-monokai-comment hover:border-monokai-border hover:bg-monokai-surface hover:text-monokai-cyan transition-colors cursor-pointer"
              title="查看该指标的物理表与字段血缘依赖拓扑"
              aria-label="查看血缘"
            >
              <GitBranch size={13} aria-hidden="true" />
            </button>
          )}

          {onPinToDashboard && (
            <button
              type="button"
              onClick={() => onPinToDashboard(chart)}
              className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors cursor-pointer ${
                isPinned
                  ? 'text-monokai-yellow bg-monokai-yellow/15 border-monokai-yellow/30 hover:bg-monokai-yellow/25'
                  : 'text-monokai-comment border-transparent hover:border-monokai-border hover:bg-monokai-surface hover:text-monokai-fg'
              }`}
              title={isPinned ? '从首页仪表盘取消固定' : '固定到首页仪表盘'}
              aria-label={isPinned ? '取消固定到仪表盘' : '固定到仪表盘'}
              aria-pressed={isPinned}
              aria-busy={pinning}
              disabled={pinning || (!isPinned && (loading || Boolean(error)))}
            >
              <Pin size={13} className={isPinned ? 'fill-current' : ''} aria-hidden="true" />
            </button>
          )}

          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(chart)}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-transparent text-monokai-comment hover:border-monokai-border hover:bg-monokai-surface hover:text-monokai-fg transition-colors cursor-pointer"
              title="编辑图表配置"
              aria-label="编辑图表"
            >
              <Edit size={13} aria-hidden="true" />
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(chart.id)}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-transparent text-monokai-comment hover:border-monokai-pink/40 hover:bg-monokai-pink/15 hover:text-monokai-pink transition-colors cursor-pointer"
              title="删除此图表"
              aria-label="删除图表"
            >
              <Trash2 size={13} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* ── Chart Canvas Area ──────────────────────────────────────────────── */}
      <div style={{ height: widgetSpace(chartContent(config.type, data.length, (config.yKeys || []).length), 480).height }} className="relative min-w-0 w-full rounded-md bg-monokai-bg/60 p-2.5 shadow-inner">
        {loading ? <div role="status" className="flex h-full items-center justify-center gap-2 text-xs text-monokai-comment"><Loader2 className="h-4 w-4 animate-spin" />正在查询实时数据…</div> : error ? (
          <div role="alert" className="flex h-full flex-col justify-center gap-2 p-3 text-xs text-monokai-pink">
            <span className="flex items-center gap-2"><AlertTriangle size={14} />查询失败</span>
            <p className="break-words font-mono">{error}</p>
            {onOpenInSql && <button className="text-left text-monokai-accent underline" onClick={() => onOpenInSql(chart.sql)}>在 SQL 工作台检查查询</button>}
          </div>
        ) : data && data.length > 0 ? (
          <ChartRenderer chartSpec={chartSpec} hideTitle heightClass="h-full" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center p-4">
            <span className="text-2xs text-monokai-comment/80">查询成功，当前结果为空</span>
            {chart.sql && onOpenInSql && (
              <button
                type="button"
                onClick={() => onOpenInSql(chart.sql)}
                className="mt-2 text-2xs text-monokai-accent hover:underline cursor-pointer font-mono"
              >
                在 SQL 中运行实时查询 →
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom Collaboration Footer ────────────────────────────────────── */}
      <div data-export-ignore className="mt-3 flex flex-wrap gap-2 items-center justify-between border-t border-monokai-border/60 pt-2.5 text-xs text-monokai-comment">
        {/* Left: Open in SQL editor */}
        <div className="flex items-center gap-2">
          {onOpenInSql && chart.sql && (
            <button
              type="button"
              onClick={() => onOpenInSql(chart.sql)}
              className="inline-flex items-center gap-1.5 rounded-md bg-monokai-surface px-2.5 py-1 text-2xs font-semibold text-monokai-fg transition-all hover:border-monokai-border-strong hover:bg-monokai-elevated border border-monokai-border cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent active:scale-[0.98]"
              title="在 SQL 工作台中直接打开并执行该图表底层查询"
            >
              <Terminal size={12} className="text-monokai-accent" aria-hidden="true" />
              <span>在 SQL 工作台运行</span>
            </button>
          )}

          <button
            type="button"
            disabled={!chart.sql}
            onClick={handleCopySql}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-transparent text-monokai-comment hover:border-monokai-border hover:text-monokai-fg hover:bg-monokai-surface transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="复制查询 SQL"
            aria-label="复制 SQL"
          >
            {copiedSql ? <Check size={12} className="text-monokai-green" /> : <Copy size={12} />}
          </button>
        </div>

        {/* Right: Export Image */}
        <div className="flex items-center gap-1.5">
          {onInspect && <button type="button" onClick={onInspect} aria-label={`专注查看 ${chart.chartConfig?.title || chart.metricName || '图表'}`} className="viz-inspect-button"><Maximize2 size={13} aria-hidden="true" />专注查看</button>}
          <button
            type="button"
            onClick={handleDownloadImage}
            disabled={isExporting || loading || Boolean(error) || !data?.length}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-2xs text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/60 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="下载图表高清 PNG 图片"
          >
            <Download size={12} aria-hidden="true" />
            <span>{isExporting ? '导出中...' : '下载图片'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
