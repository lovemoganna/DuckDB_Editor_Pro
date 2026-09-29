import React, { useState } from 'react';
import { Database, FileText, Zap, Clock, Users, Cpu, ArrowUpRight, type LucideIcon } from 'lucide-react';
import { Tab, QueryHistoryItem } from '../../types';
import { type DashboardDbMetrics, type TableItemDetail } from '../../hooks/useDashboardWorkflow';
import { duckDBService } from '../../services/duckdbService';
import { toastService } from '../../services/toastService';
import {
  KpiPortalTooltip,
  type KpiTooltipData,
  TableDistributionMiniChart,
  TableRowVolumeMiniChart,
  QueryTimelineSparkline,
  LatencyTrendSparkline,
  WasmWorkerTelemetryMiniChart,
  MemoryGaugeMiniChart,
} from './KpiDynamicMiniCharts';

interface DashboardKpiRowProps {
  metrics: DashboardDbMetrics;
  tables?: TableItemDetail[];
  allHistoryItems?: QueryHistoryItem[];
  onNavigate?: (tab: Tab) => void;
  onShrinkMemory?: () => void;
  onOpenSettings?: () => void;
}

interface KpiCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  badge?: string;
  badgeTone?: 'neutral' | 'ok' | 'warn' | 'danger';
  title?: string;
  onActivate?: () => void;
  footer?: React.ReactNode;
  chartNode?: React.ReactNode;
  iconSpinning?: boolean;
  accentColor?: string;
}

const badgeClass = (tone: NonNullable<KpiCardProps['badgeTone']>) => {
  switch (tone) {
    case 'ok':
      return 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30';
    case 'warn':
      return 'text-amber-400 bg-amber-500/15 border-amber-500/30';
    case 'danger':
      return 'text-rose-400 bg-rose-500/15 border-rose-500/30';
    default:
      return 'text-slate-400 bg-white/10 border-white/15';
  }
};

const KpiCard: React.FC<KpiCardProps> = ({
  icon: Icon,
  label,
  value,
  hint,
  badge,
  badgeTone = 'neutral',
  title,
  onActivate,
  footer,
  chartNode,
  iconSpinning = false,
  accentColor = 'cyan',
}) => {
  const interactive = Boolean(onActivate);
  const cardClassName = `group relative flex flex-col justify-between rounded-xl border border-white/10 bg-gradient-to-b from-[#111728] via-[#0d1220] to-[#090d18] p-3.5 sm:p-4 shadow-md shadow-black/25 transition-all overflow-hidden ${
    interactive
      ? 'hover:border-cyan-500/40 hover:shadow-cyan-500/10 cursor-pointer text-left'
      : ''
  }`;

  const content = (
    <>
      {/* Subtle micro-grid accent */}
      <div className="pointer-events-none absolute right-0 top-0 h-16 w-20 opacity-10 bg-[radial-gradient(#06b6d4_1px,transparent_1px)] [background-size:8px_8px]" />

      {/* Top Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Icon className={`h-3.5 w-3.5 ${iconSpinning ? 'animate-spin' : ''}`} />
          </span>
          <span className="truncate text-xs font-semibold uppercase tracking-wider text-slate-300">
            {label}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {badge && (
            <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] border ${badgeClass(badgeTone)}`}>
              {badge}
            </span>
          )}
          {interactive && (
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-500 opacity-0 transition-opacity group-hover:opacity-100 group-hover:text-cyan-400" />
          )}
        </div>
      </div>

      {/* Middle Value & Mini Chart */}
      <div className="mt-2.5 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-sm truncate">
            {value}
          </div>
          {footer ? (
            footer
          ) : (
            <div className="mt-1 font-mono text-[11px] text-slate-400 truncate">{hint}</div>
          )}
        </div>

        {/* Dynamic Interactive Real Chart */}
        {chartNode && <div className="shrink-0">{chartNode}</div>}
      </div>
    </>
  );

  if (!interactive) {
    return (
      <div title={title} className={cardClassName}>
        {content}
      </div>
    );
  }

  return (
    <button type="button" title={title} onClick={onActivate} className={cardClassName}>
      {content}
    </button>
  );
};

export const DashboardKpiRow: React.FC<DashboardKpiRowProps> = ({
  metrics,
  tables = [],
  allHistoryItems = [],
  onNavigate,
  onShrinkMemory,
  onOpenSettings,
}) => {
  const [isShrinking, setIsShrinking] = React.useState(false);
  const [tooltip, setTooltip] = useState<KpiTooltipData | null>(null);

  const handleShrink = async () => {
    setIsShrinking(true);
    try {
      if (onShrinkMemory) {
        await onShrinkMemory();
      } else {
        await duckDBService.query('PRAGMA shrink_memory;');
        toastService.success('已触发内存收缩释放 (PRAGMA shrink_memory)');
      }
    } catch {
      toastService.info('当前数据库运行正常，无需立即回收');
    } finally {
      setTimeout(() => setIsShrinking(false), 800);
    }
  };

  return (
    <>
      <KpiPortalTooltip tooltip={tooltip} />

      <div className="grid w-full grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-6 sm:gap-3 select-text">
        {/* 1. 数据库大小 / 表资产 */}
        <KpiCard
          icon={Database}
          label="数据库大小"
          value={metrics.dataSize || '0 B'}
          hint={`共 ${metrics.databaseCount} 个库 · ${metrics.tableCount} 张表`}
          title="点击前往数据网格查看表资产概览"
          onActivate={onNavigate ? () => onNavigate(Tab.DATA) : undefined}
          chartNode={<TableDistributionMiniChart tables={tables} onTooltip={setTooltip} />}
        />

        {/* 2. 总行数 */}
        <KpiCard
          icon={FileText}
          label="总行数"
          value={metrics.formattedTotalRows || '0'}
          hint={metrics.viewCount > 0 ? `含 ${metrics.viewCount} 个视图` : '物理表汇总'}
          title="点击在数据浏览中查看各表详细行数"
          onActivate={onNavigate ? () => onNavigate(Tab.DATA) : undefined}
          chartNode={
            <TableRowVolumeMiniChart
              tables={tables}
              totalRows={metrics.totalRows}
              onTooltip={setTooltip}
            />
          }
        />

        {/* 3. 查询次数 */}
        <KpiCard
          icon={Zap}
          label="查询次数"
          value={metrics.totalQueries.toLocaleString()}
          badge={
            metrics.errorCount > 0
              ? `${metrics.errorCount} 报错`
              : metrics.totalQueries > 0
                ? `${metrics.successRatePct}% 成功`
                : undefined
          }
          badgeTone={metrics.errorCount > 0 ? 'danger' : 'ok'}
          hint={metrics.totalQueries > 0 ? '工作台实际执行' : '暂无执行历史'}
          title="点击前往 SQL 工作台运行或查看历史"
          onActivate={onNavigate ? () => onNavigate(Tab.SQL) : undefined}
          chartNode={
            <QueryTimelineSparkline
              historyItems={allHistoryItems}
              totalQueries={metrics.totalQueries}
              successRatePct={metrics.successRatePct}
              onTooltip={setTooltip}
            />
          }
        />

        {/* 4. 平均查询时间 */}
        <KpiCard
          icon={Clock}
          label="平均查询时间"
          value={metrics.formattedAvgLatency || '—'}
          badge={
            metrics.avgLatencyMs > 0 && metrics.avgLatencyMs < 100
              ? '极速'
              : metrics.avgLatencyMs >= 500
                ? '偏慢'
                : undefined
          }
          badgeTone={
            metrics.avgLatencyMs > 0 && metrics.avgLatencyMs < 100
              ? 'ok'
              : metrics.avgLatencyMs >= 500
                ? 'warn'
                : 'neutral'
          }
          hint={metrics.totalQueries > 0 ? '基于本地执行耗时' : '暂无执行历史'}
          title="点击查看 SQL 查询执行耗时与优化"
          onActivate={onNavigate ? () => onNavigate(Tab.SQL) : undefined}
          chartNode={
            <LatencyTrendSparkline
              historyItems={allHistoryItems}
              avgLatencyMs={metrics.avgLatencyMs}
              onTooltip={setTooltip}
            />
          }
        />

        {/* 5. 活跃会话 */}
        <KpiCard
          icon={Users}
          label="活跃会话"
          value={String(metrics.activeSessions)}
          hint="当前连接 · WASM Worker"
          title="本地内嵌 DuckDB WASM 会话 (点击查看系统与持久化配置)"
          onActivate={onOpenSettings}
          chartNode={
            <WasmWorkerTelemetryMiniChart
              activeSessions={metrics.activeSessions}
              onTooltip={setTooltip}
            />
          }
        />

        {/* 6. 内存使用 */}
        <KpiCard
          icon={Cpu}
          label="内存使用"
          value={metrics.memoryUsageFormatted || `${metrics.memoryUsedGb} GB`}
          badge={isShrinking ? '回收中' : undefined}
          badgeTone="ok"
          hint=""
          title="点击手动触发内存回收 (PRAGMA shrink_memory)"
          onActivate={handleShrink}
          iconSpinning={isShrinking}
          chartNode={
            <MemoryGaugeMiniChart
              memoryPercentage={metrics.memoryPercentage}
              memoryUsageFormatted={metrics.memoryUsageFormatted}
              memoryPercentageDisplay={metrics.memoryPercentageDisplay}
              memoryTotalGb={metrics.memoryTotalGb}
              isShrinking={isShrinking}
              onTooltip={setTooltip}
            />
          }
          footer={
            <div className="flex items-center gap-1.5 mt-1">
              <span className="font-mono text-2xs text-slate-400">
                {metrics.memoryPercentageDisplay || `${metrics.memoryPercentage}%`}
              </span>
            </div>
          }
        />
      </div>
    </>
  );
};

