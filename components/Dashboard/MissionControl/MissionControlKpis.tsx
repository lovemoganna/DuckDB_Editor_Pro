import React, { useState } from 'react';
import {
  Database,
  FileText,
  Zap,
  Clock,
  Cpu,
  Layers,
  RotateCcw,
} from 'lucide-react';
import { Tab, QueryHistoryItem } from '../../../types';
import { type DashboardDbMetrics, type TableItemDetail } from '../../../hooks/useDashboardWorkflow';
import { duckDBService } from '../../../services/duckdbService';
import { toastService } from '../../../services/toastService';
import {
  KpiPortalTooltip,
  type KpiTooltipData,
  TableDistributionMiniChart,
  TableRowVolumeMiniChart,
  QueryTimelineSparkline,
  LatencyTrendSparkline,
  WasmWorkerTelemetryMiniChart,
  MemoryGaugeMiniChart,
} from '../KpiDynamicMiniCharts';
import { KpiWatermark } from './DashboardSvgIllustrations';

interface MissionControlKpisProps {
  metrics: DashboardDbMetrics;
  tables?: TableItemDetail[];
  allHistoryItems?: QueryHistoryItem[];
  onNavigate?: (tab: Tab) => void;
  onShrinkMemory?: () => void;
  onOpenSettings?: () => void;
}

export const MissionControlKpis: React.FC<MissionControlKpisProps> = ({
  metrics,
  tables = [],
  allHistoryItems = [],
  onNavigate,
  onShrinkMemory,
  onOpenSettings,
}) => {
  const [isShrinking, setIsShrinking] = useState(false);
  const [tooltip, setTooltip] = useState<KpiTooltipData | null>(null);

  const handleShrink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsShrinking(true);
    try {
      if (onShrinkMemory) {
        await onShrinkMemory();
      } else {
        await duckDBService.query('PRAGMA shrink_memory;');
        toastService.success('已触发本地内存释放 (PRAGMA shrink_memory)');
      }
    } catch {
      toastService.info('内存状态健康，无需回收');
    } finally {
      setTimeout(() => setIsShrinking(false), 600);
    }
  };

  const missingPkCount = metrics.qualityIssues?.missingPkCount || 0;
  const slowCount = metrics.latencyDistribution?.slowCount || 0;
  const errorCount = metrics.errorCount || 0;
  const memoryPct = metrics.memoryPercentage || 0;

  return (
    <>
      {/* Floating portal tooltip */}
      <KpiPortalTooltip tooltip={tooltip} />

      <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6 select-text">
        {/* 1. 数据表 (Tables) */}
        <div
          onClick={() => onNavigate?.(Tab.DATA)}
          className="group relative flex flex-col justify-between rounded-xl border border-monokai-border bg-gradient-to-b from-monokai-surface to-monokai-surface/90 p-3 sm:p-3.5 shadow-sm hover:border-monokai-cyan/60 hover:shadow-[0_0_18px_rgba(102,217,239,0.12)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden backdrop-blur-xs"
        >
          {/* Subtle Cyber SVG Watermark */}
          <KpiWatermark type="tables" className="text-monokai-cyan" />

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-monokai-cyan/15 text-monokai-cyan border border-monokai-cyan/30 shadow-xs">
                <Database className="h-3.5 w-3.5" />
              </span>
              <span className="text-xs font-semibold text-monokai-fg tracking-wide font-sans">数据表</span>
            </div>
            <span
              className={`rounded px-1.5 py-0.2 font-mono text-[10px] border ${
                missingPkCount > 0
                  ? 'border-monokai-yellow/40 bg-monokai-yellow/10 text-monokai-yellow'
                  : 'border-monokai-accent/30 bg-monokai-accent/10 text-monokai-accent'
              }`}
            >
              {missingPkCount > 0 ? `${missingPkCount} 待设PK` : '100% 健全'}
            </span>
          </div>

          <div className="relative z-10 mt-3 flex items-end justify-between">
            <div>
              <div className="font-mono text-2xl font-bold tracking-tight text-monokai-fg">
                {metrics.tableCount}
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-monokai-comment flex items-center gap-1">
                <span>{tables.filter((t) => t.type !== 'view').length} 表 · {tables.filter((t) => t.type === 'view').length} 视图</span>
              </div>
            </div>

            {/* Dynamic Real Table Distribution Mini-Chart with Hover Tooltip */}
            <TableDistributionMiniChart tables={tables} onTooltip={setTooltip} />
          </div>
        </div>

        {/* 2. 总行数 (Total Rows) */}
        <div
          onClick={() => onNavigate?.(Tab.DATA)}
          className="group relative flex flex-col justify-between rounded-xl border border-monokai-border bg-gradient-to-b from-monokai-surface to-monokai-surface/90 p-3 sm:p-3.5 shadow-sm hover:border-monokai-accent/60 hover:shadow-[0_0_18px_rgba(166,226,46,0.12)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden backdrop-blur-xs"
        >
          {/* Subtle Cyber SVG Watermark */}
          <KpiWatermark type="rows" className="text-monokai-accent" />

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-monokai-accent/15 text-monokai-accent border border-monokai-accent/30 shadow-xs">
                <FileText className="h-3.5 w-3.5" />
              </span>
              <span className="text-xs font-semibold text-monokai-fg tracking-wide font-sans">总行数</span>
            </div>
            <span className="rounded border border-monokai-cyan/30 bg-monokai-cyan/10 px-1.5 py-0.2 font-mono text-[10px] text-monokai-cyan">
              {metrics.dataSize || '0 B'}
            </span>
          </div>

          <div className="relative z-10 mt-3 flex items-end justify-between">
            <div>
              <div className="font-mono text-2xl font-bold tracking-tight text-monokai-fg">
                {metrics.formattedTotalRows || '0'}
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-monokai-comment flex items-center gap-1">
                <span className="truncate max-w-[110px]" title={tables[0]?.name ? `主表: ${tables[0].name}` : '数据表'}>
                  {tables[0]?.name ? `主表: ${tables[0].name}` : '暂无数据'}
                </span>
              </div>
            </div>

            {/* Dynamic Real Table Volume Mini-Chart with Hover Tooltip */}
            <TableRowVolumeMiniChart
              tables={tables}
              totalRows={metrics.totalRows}
              onTooltip={setTooltip}
            />
          </div>
        </div>

        {/* 3. 查询次数 (Queries Count) */}
        <div
          onClick={() => onNavigate?.(Tab.SQL)}
          className="group relative flex flex-col justify-between rounded-xl border border-monokai-border bg-gradient-to-b from-monokai-surface to-monokai-surface/90 p-3 sm:p-3.5 shadow-sm hover:border-monokai-yellow/60 hover:shadow-[0_0_18px_rgba(230,219,116,0.12)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden backdrop-blur-xs"
        >
          {/* Subtle Cyber SVG Watermark */}
          <KpiWatermark type="queries" className="text-monokai-yellow" />

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-monokai-yellow/15 text-monokai-yellow border border-monokai-yellow/30 shadow-xs">
                <Zap className="h-3.5 w-3.5" />
              </span>
              <span className="text-xs font-semibold text-monokai-fg tracking-wide font-sans">查询次数</span>
            </div>
            <span
              className={`rounded px-1.5 py-0.2 font-mono text-[10px] border ${
                errorCount > 0
                  ? 'border-monokai-pink/50 bg-monokai-pink/15 text-monokai-pink'
                  : 'border-monokai-accent/30 bg-monokai-accent/10 text-monokai-accent'
              }`}
            >
              {errorCount > 0 ? `${errorCount} 失败` : '0 报错'}
            </span>
          </div>

          <div className="relative z-10 mt-3 flex items-end justify-between">
            <div>
              <div className="font-mono text-2xl font-bold tracking-tight text-monokai-fg">
                {metrics.totalQueries}
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-monokai-yellow flex items-center gap-1">
                <span>{metrics.totalQueries > 0 ? `成功率 ${metrics.successRatePct}%` : '暂无记录'}</span>
              </div>
            </div>

            {/* Dynamic Real Query Timeline Sparkline with Hover Tooltip */}
            <QueryTimelineSparkline
              historyItems={allHistoryItems}
              totalQueries={metrics.totalQueries}
              successRatePct={metrics.successRatePct}
              onTooltip={setTooltip}
            />
          </div>
        </div>

        {/* 4. 平均查询时间 (Avg Latency) */}
        <div
          onClick={() => onNavigate?.(Tab.SQL)}
          className="group relative flex flex-col justify-between rounded-xl border border-monokai-border bg-gradient-to-b from-monokai-surface to-monokai-surface/90 p-3 sm:p-3.5 shadow-sm hover:border-monokai-cyan/60 hover:shadow-[0_0_18px_rgba(102,217,239,0.12)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden backdrop-blur-xs"
        >
          {/* Subtle Cyber SVG Watermark */}
          <KpiWatermark type="latency" className="text-monokai-cyan" />

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-monokai-cyan/15 text-monokai-cyan border border-monokai-cyan/30 shadow-xs">
                <Clock className="h-3.5 w-3.5" />
              </span>
              <span className="text-xs font-semibold text-monokai-fg tracking-wide font-sans">平均查询时间</span>
            </div>
            <span
              className={`rounded px-1.5 py-0.2 font-mono text-[10px] border ${
                slowCount > 0
                  ? 'border-monokai-yellow/40 bg-monokai-yellow/10 text-monokai-yellow'
                  : 'border-monokai-cyan/30 bg-monokai-cyan/10 text-monokai-cyan'
              }`}
            >
              {slowCount > 0 ? `${slowCount} 慢查询` : '极速响应'}
            </span>
          </div>

          <div className="relative z-10 mt-3 flex items-end justify-between">
            <div>
              <div className="font-mono text-2xl font-bold tracking-tight text-monokai-fg">
                {metrics.formattedAvgLatency || '—'}
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-monokai-comment flex items-center gap-0.5">
                <span>
                  {allHistoryItems.length === 0
                    ? '—'
                    : metrics.avgLatencyMs < 50
                      ? '引擎响应 < 50ms'
                      : metrics.avgLatencyMs < 200
                        ? '标准响应 < 200ms'
                        : '负载偏高'}
                </span>
              </div>
            </div>

            {/* Dynamic Real Latency Trend Sparkline with Hover Tooltip */}
            <LatencyTrendSparkline
              historyItems={allHistoryItems}
              avgLatencyMs={metrics.avgLatencyMs}
              onTooltip={setTooltip}
            />
          </div>
        </div>

        {/* 5. 活跃会话 (Active Sessions) */}
        <div
          onClick={onOpenSettings}
          className="group relative flex flex-col justify-between rounded-xl border border-monokai-border bg-gradient-to-b from-monokai-surface to-monokai-surface/90 p-3 sm:p-3.5 shadow-sm hover:border-monokai-purple/60 hover:shadow-[0_0_18px_rgba(174,129,255,0.12)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden backdrop-blur-xs"
        >
          {/* Subtle Cyber SVG Watermark */}
          <KpiWatermark type="engine" className="text-monokai-purple" />

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-monokai-purple/15 text-monokai-purple border border-monokai-purple/30 shadow-xs">
                <Cpu className="h-3.5 w-3.5" />
              </span>
              <span className="text-xs font-semibold text-monokai-fg tracking-wide font-sans">活跃会话</span>
            </div>
            <span className="rounded border border-monokai-purple/30 bg-monokai-purple/10 px-1.5 py-0.2 font-mono text-[10px] text-monokai-purple">
              WASM
            </span>
          </div>

          <div className="relative z-10 mt-3 flex items-end justify-between">
            <div>
              <div className="font-mono text-2xl font-bold tracking-tight text-monokai-fg">
                {metrics.activeSessions || 1}
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-monokai-purple flex items-center gap-1">
                <span>独立 Web Worker</span>
              </div>
            </div>

            {/* Dynamic WASM Telemetry Subsystem Channels with Hover Tooltip */}
            <WasmWorkerTelemetryMiniChart
              activeSessions={metrics.activeSessions}
              onTooltip={setTooltip}
            />
          </div>
        </div>

        {/* 6. 内存使用 (Memory Usage) */}
        <div
          onClick={handleShrink}
          className={`group relative flex flex-col justify-between rounded-xl border bg-gradient-to-b from-monokai-surface to-monokai-surface/90 p-3 sm:p-3.5 shadow-sm hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden backdrop-blur-xs ${
            memoryPct >= 75
              ? 'border-monokai-pink/50 hover:border-monokai-pink hover:shadow-[0_0_18px_rgba(249,38,114,0.2)]'
              : 'border-monokai-border hover:border-monokai-accent/60 hover:shadow-[0_0_18px_rgba(166,226,46,0.12)]'
          }`}
          title="点击执行 PRAGMA shrink_memory 释放内存"
        >
          {/* Subtle Cyber SVG Watermark */}
          <KpiWatermark type="memory" className={memoryPct >= 75 ? 'text-monokai-pink' : 'text-monokai-accent'} />

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-lg border shadow-xs ${
                  memoryPct >= 75
                    ? 'bg-monokai-pink/15 text-monokai-pink border-monokai-pink/30'
                    : 'bg-monokai-accent/15 text-monokai-accent border-monokai-accent/30'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
              </span>
              <span className="text-xs font-semibold text-monokai-fg tracking-wide font-sans">内存使用</span>
            </div>
            <span
              className={`rounded px-1.5 py-0.2 font-mono text-[10px] border ${
                memoryPct >= 75
                  ? 'border-monokai-pink/50 bg-monokai-pink/15 text-monokai-pink animate-pulse'
                  : 'border-monokai-accent/30 bg-monokai-accent/10 text-monokai-accent'
              }`}
            >
              {metrics.memoryPercentageDisplay || `${memoryPct}%`}
            </span>
          </div>

          <div className="relative z-10 mt-3 flex items-end justify-between">
            <div>
              <div className="font-mono text-2xl font-bold tracking-tight text-monokai-fg">
                {metrics.memoryUsageFormatted || '0 MiB'}
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-monokai-comment flex items-center gap-1 group-hover:text-monokai-accent transition-colors">
                <RotateCcw className={`h-3 w-3 ${isShrinking ? 'animate-spin text-monokai-accent' : ''}`} />
                <span>{isShrinking ? '正在回收…' : '点击立即回收'}</span>
              </div>
            </div>

            {/* Dynamic Real Memory Gauge Mini-Chart with Hover Tooltip */}
            <MemoryGaugeMiniChart
              memoryTotalGb={metrics.memoryTotalGb}
              memoryPercentage={metrics.memoryPercentage}
              memoryUsageFormatted={metrics.memoryUsageFormatted}
              memoryPercentageDisplay={metrics.memoryPercentageDisplay}
              isShrinking={isShrinking}
              onTooltip={setTooltip}
            />
          </div>
        </div>
      </div>
    </>
  );
};
