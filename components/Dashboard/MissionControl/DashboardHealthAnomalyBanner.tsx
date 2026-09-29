import React from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  XCircle,
  Clock,
  Key,
  ChevronRight,
  HardDrive,
} from 'lucide-react';
import { Tab } from '../../../types';
import { type DashboardDbMetrics, type TableItemDetail } from '../../../hooks/useDashboardWorkflow';

export interface DashboardHealthAnomalyBannerProps {
  metrics: DashboardDbMetrics;
  tables?: TableItemDetail[];
  onNavigate?: (tab: Tab) => void;
  onFilterSlowQueries?: () => void;
  onFilterErrorQueries?: () => void;
  onSelectTableStructure?: (tableName: string) => void;
  onShrinkMemory?: () => void;
}

export const DashboardHealthAnomalyBanner: React.FC<DashboardHealthAnomalyBannerProps> = ({
  metrics,
  tables = [],
  onNavigate,
  onFilterSlowQueries,
  onFilterErrorQueries,
  onSelectTableStructure,
  onShrinkMemory,
}) => {
  const errorCount = metrics.errorCount || 0;
  const slowCount = metrics.latencyDistribution?.slowCount || 0;
  const missingPkCount = metrics.qualityIssues?.missingPkCount || 0;
  const missingPkTables = metrics.qualityIssues?.missingPkTables || [];
  const memoryPct = metrics.memoryPercentage || 0;
  const isMemoryHigh = memoryPct >= 75;

  const totalAnomalies =
    (errorCount > 0 ? 1 : 0) +
    (slowCount > 0 ? 1 : 0) +
    (missingPkCount > 0 ? 1 : 0) +
    (isMemoryHigh ? 1 : 0);

  const isAllHealthy = totalAnomalies === 0;

  if (isAllHealthy) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-monokai-border/80 bg-monokai-elevated/30 px-3 py-1.5 text-xs select-text">
        <div className="flex items-center gap-2 text-monokai-fg-muted font-mono">
          <ShieldCheck className="h-3.5 w-3.5 text-monokai-accent shrink-0" />
          <span className="font-sans text-monokai-accent font-medium">系统健康</span>
          <span className="hidden sm:inline text-monokai-border">·</span>
          <span className="hidden sm:inline">
            {metrics.totalQueries} 次查询 · {tables.length} 表 · 内存 {metrics.memoryUsageFormatted || '正常'}
          </span>
        </div>
        <span className="font-mono text-[10px] text-monokai-comment">无待处理异常</span>
      </div>
    );
  }

  // When anomalies exist: show prominent actionable triage strip
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-monokai-yellow/40 bg-monokai-yellow/10 px-4 py-2.5 shadow-xs text-xs select-text animate-in fade-in duration-200">
      <div className="flex items-center gap-2.5">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-monokai-yellow/20 text-monokai-yellow border border-monokai-yellow/40">
          <AlertTriangle className="h-3.5 w-3.5" />
        </span>
        <span className="font-bold text-monokai-yellow tracking-wide flex items-center gap-1.5 font-sans">
          <span className="h-1.5 w-1.5 rounded-full bg-monokai-yellow animate-pulse" />
          待关注预警 ({totalAnomalies} 项)
        </span>
        <span className="text-monokai-border font-mono hidden sm:inline-block">|</span>
        
        {/* Actionable Anomaly Badges */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
          {errorCount > 0 && (
            <button
              type="button"
              onClick={onFilterErrorQueries || (() => onNavigate?.(Tab.SQL))}
              className="flex items-center gap-1 rounded border border-monokai-pink/50 bg-monokai-pink/15 hover:bg-monokai-pink/25 text-monokai-pink px-2 py-0.5 transition-colors cursor-pointer"
              title="点击查看失败查询详情"
            >
              <XCircle className="h-3 w-3 text-monokai-pink" />
              <span>{errorCount} 条查询报错</span>
              <ChevronRight className="h-2.5 w-2.5 opacity-60" />
            </button>
          )}

          {slowCount > 0 && (
            <button
              type="button"
              onClick={onFilterSlowQueries || (() => onNavigate?.(Tab.SQL))}
              className="flex items-center gap-1 rounded border border-monokai-yellow/50 bg-monokai-yellow/15 hover:bg-monokai-yellow/25 text-monokai-yellow px-2 py-0.5 transition-colors cursor-pointer"
              title="点击在编辑器中排查慢查询"
            >
              <Clock className="h-3 w-3 text-monokai-yellow" />
              <span>{slowCount} 条慢查询 (&gt;200ms)</span>
              <ChevronRight className="h-2.5 w-2.5 opacity-60" />
            </button>
          )}

          {missingPkCount > 0 && (
            <button
              type="button"
              onClick={() => {
                if (missingPkTables[0] && onSelectTableStructure) {
                  onSelectTableStructure(missingPkTables[0]);
                } else {
                  onNavigate?.(Tab.STRUCTURE);
                }
              }}
              className="flex items-center gap-1 rounded border border-monokai-orange/50 bg-monokai-orange/15 hover:bg-monokai-orange/25 text-monokai-orange px-2 py-0.5 transition-colors cursor-pointer"
              title="点击前往表结构视图为表设置主键"
            >
              <Key className="h-3 w-3 text-monokai-orange" />
              <span>{missingPkCount} 个表未设主键</span>
              <ChevronRight className="h-2.5 w-2.5 opacity-60" />
            </button>
          )}

          {isMemoryHigh && (
            <button
              type="button"
              onClick={onShrinkMemory}
              className="flex items-center gap-1 rounded border border-monokai-pink/50 bg-monokai-pink/15 hover:bg-monokai-pink/25 text-monokai-pink px-2 py-0.5 transition-colors cursor-pointer"
              title="内存占用超过 75%，点击执行 PRAGMA shrink_memory 回收"
            >
              <HardDrive className="h-3 w-3 text-monokai-pink" />
              <span>内存占用偏高 ({memoryPct}%)</span>
              <span className="underline ml-0.5 font-sans">立即回收</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 font-mono text-[11px] text-monokai-yellow ml-auto">
        <span className="rounded bg-monokai-elevated border border-monokai-yellow/40 px-2 py-0.5 font-bold">
          需调优
        </span>
      </div>
    </div>
  );
};
