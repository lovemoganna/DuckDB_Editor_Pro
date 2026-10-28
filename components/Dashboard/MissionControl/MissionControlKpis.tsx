import React, { useState } from 'react';
import { Tab, QueryHistoryItem } from '../../../types';
import { type DashboardDbMetrics, type TableItemDetail } from '../../../hooks/useDashboardWorkflow';
import { duckDBService } from '../../../services/duckdbService';
import { toastService } from '../../../services/toastService';
import { DB, dbBadgeClass, type DbBadgeTone } from '../dashboardUi';

interface MissionControlKpisProps {
  metrics: DashboardDbMetrics;
  tables?: TableItemDetail[];
  allHistoryItems?: QueryHistoryItem[];
  onNavigate?: (tab: Tab) => void;
  onShrinkMemory?: () => void;
  onOpenSettings?: () => void;
}

interface MetricCellProps {
  label: string;
  value: string;
  hint?: string;
  badge?: string;
  badgeTone?: DbBadgeTone;
  title?: string;
  onClick?: () => void;
}

const MetricCell: React.FC<MetricCellProps> = ({
  label,
  value,
  hint,
  badge,
  badgeTone = 'neutral',
  title,
  onClick,
}) => {
  const interactive = Boolean(onClick);
  const className = `group flex min-w-0 flex-1 flex-col gap-0.5 px-1 py-1.5 text-left transition-colors sm:px-2.5 ${
    interactive
      ? `hover:bg-monokai-elevated/50 cursor-pointer rounded-md ${DB.focus}`
      : ''
  }`;

  const body = (
    <>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="truncate text-2xs font-mono uppercase tracking-wide text-monokai-comment">
          {label}
        </span>
        {badge ? <span className={`shrink-0 ${dbBadgeClass(badgeTone)}`}>{badge}</span> : null}
      </div>
      <div className="font-mono text-xl font-semibold tracking-tight text-monokai-fg tabular-nums truncate">
        {value}
      </div>
      {hint ? <div className={`${DB.metaMono} truncate`}>{hint}</div> : null}
    </>
  );

  if (!interactive) {
    return (
      <div title={title} className={className}>
        {body}
      </div>
    );
  }

  return (
    <button type="button" title={title} onClick={onClick} className={className}>
      {body}
    </button>
  );
};

/**
 * Compact workspace metrics — IDE status density, not a KPI marketing row.
 */
export const MissionControlKpis: React.FC<MissionControlKpisProps> = ({
  metrics,
  tables = [],
  onNavigate,
  onShrinkMemory,
}) => {
  const [isShrinking, setIsShrinking] = useState(false);

  const handleShrink = async () => {
    setIsShrinking(true);
    try {
      if (onShrinkMemory) await onShrinkMemory();
      else {
        await duckDBService.query('PRAGMA shrink_memory;');
        toastService.success('已触发本地内存释放');
      }
    } catch {
      toastService.info('内存状态健康，无需回收');
    } finally {
      setTimeout(() => setIsShrinking(false), 600);
    }
  };

  const missingPkCount = metrics.qualityIssues?.missingPkCount || 0;
  const errorCount = metrics.errorCount || 0;
  const memoryPct = metrics.memoryPercentage || 0;
  const tableCount = tables.filter((t) => t.type !== 'view').length;
  const viewCount = tables.filter((t) => t.type === 'view').length;

  return (
    <div
      className="flex flex-col sm:flex-row sm:items-stretch divide-y sm:divide-y-0 sm:divide-x divide-monokai-border/60 border-y border-monokai-border/70 select-text"
      data-testid="studio-metric-strip"
    >
      <MetricCell
        label="表"
        value={String(metrics.tableCount)}
        hint={`${tableCount} 表 · ${viewCount} 视图`}
        badge={missingPkCount > 0 ? `${missingPkCount} PK` : undefined}
        badgeTone={missingPkCount > 0 ? 'warn' : 'neutral'}
        title="前往数据网格"
        onClick={() => onNavigate?.(Tab.DATA)}
      />
      <MetricCell
        label="行数"
        value={metrics.formattedTotalRows || '0'}
        hint={metrics.dataSize || '0 B'}
        title="查看各表行数"
        onClick={() => onNavigate?.(Tab.DATA)}
      />
      <MetricCell
        label="查询"
        value={String(metrics.totalQueries)}
        hint={
          metrics.totalQueries > 0
            ? `${metrics.successRatePct}% 成功 · 均 ${metrics.formattedAvgLatency || '—'}`
            : '暂无记录'
        }
        badge={errorCount > 0 ? `${errorCount} 失败` : undefined}
        badgeTone={errorCount > 0 ? 'danger' : 'neutral'}
        title="前往 SQL 工作台"
        onClick={() => onNavigate?.(Tab.SQL)}
      />
      <MetricCell
        label="内存"
        value={metrics.memoryUsageFormatted || '0 MiB'}
        hint={isShrinking ? '正在回收…' : `占用 ${metrics.memoryPercentageDisplay || `${memoryPct}%`} · 点击回收`}
        badge={memoryPct >= 75 ? '偏高' : undefined}
        badgeTone={memoryPct >= 75 ? 'danger' : 'neutral'}
        title="点击执行 PRAGMA shrink_memory 释放内存"
        onClick={() => void handleShrink()}
      />
    </div>
  );
};
