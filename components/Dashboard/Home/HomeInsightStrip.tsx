import React from 'react';
import { AlertTriangle, XCircle, Clock, Key, ChevronRight, HardDrive } from 'lucide-react';
import { Tab } from '../../../types';
import { type DashboardDbMetrics, type TableItemDetail } from '../../../hooks/useDashboardWorkflow';

export interface HomeInsightStripProps {
  metrics: DashboardDbMetrics;
  tables?: TableItemDetail[];
  onNavigate?: (tab: Tab) => void;
  onFilterSlowQueries?: () => void;
  onFilterErrorQueries?: () => void;
  onSelectTableStructure?: (tableName: string) => void;
  onShrinkMemory?: () => void;
}

/** Actionable anomaly strip — hidden when healthy. */
export const HomeInsightStrip: React.FC<HomeInsightStripProps> = ({
  metrics,
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

  if (totalAnomalies === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-monokai-yellow/35 bg-monokai-yellow/8 px-4 py-2.5 text-xs select-text">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-monokai-yellow/20 text-monokai-yellow border border-monokai-yellow/40">
          <AlertTriangle className="h-3.5 w-3.5" />
        </span>
        <span className="font-semibold text-monokai-yellow tracking-wide font-sans">
          发现 {totalAnomalies} 项异常
        </span>

        <div className="flex flex-wrap items-center gap-2 font-mono text-meta">
          {errorCount > 0 && (
            <button
              type="button"
              onClick={onFilterErrorQueries || (() => onNavigate?.(Tab.SQL))}
              className="flex items-center gap-1 rounded border border-monokai-pink/45 bg-monokai-pink/12 hover:bg-monokai-pink/22 text-monokai-pink px-2 py-0.5 transition-colors cursor-pointer"
            >
              <XCircle className="h-3 w-3" />
              <span>{errorCount} 条查询失败</span>
              <ChevronRight className="h-2.5 w-2.5 opacity-60" />
            </button>
          )}

          {slowCount > 0 && (
            <button
              type="button"
              onClick={onFilterSlowQueries || (() => onNavigate?.(Tab.HISTORY))}
              className="flex items-center gap-1 rounded border border-monokai-orange/45 bg-monokai-orange/12 hover:bg-monokai-orange/22 text-monokai-orange px-2 py-0.5 transition-colors cursor-pointer"
            >
              <Clock className="h-3 w-3" />
              <span>{slowCount} 条慢查询</span>
              <ChevronRight className="h-2.5 w-2.5 opacity-60" />
            </button>
          )}

          {missingPkCount > 0 && (
            <button
              type="button"
              onClick={() => {
                const t = missingPkTables[0];
                if (t && onSelectTableStructure) onSelectTableStructure(t);
                else onNavigate?.(Tab.STRUCTURE);
              }}
              className="flex items-center gap-1 rounded border border-monokai-cyan/40 bg-monokai-cyan/10 hover:bg-monokai-cyan/20 text-monokai-cyan px-2 py-0.5 transition-colors cursor-pointer"
            >
              <Key className="h-3 w-3" />
              <span>{missingPkCount} 表缺主键</span>
              <ChevronRight className="h-2.5 w-2.5 opacity-60" />
            </button>
          )}

          {isMemoryHigh && (
            <button
              type="button"
              onClick={onShrinkMemory}
              className="flex items-center gap-1 rounded border border-monokai-border bg-monokai-elevated hover:bg-monokai-hover text-monokai-fg-muted px-2 py-0.5 transition-colors cursor-pointer"
            >
              <HardDrive className="h-3 w-3" />
              <span>内存 {Math.round(memoryPct)}%</span>
              <ChevronRight className="h-2.5 w-2.5 opacity-60" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
