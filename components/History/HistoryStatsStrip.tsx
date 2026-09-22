import React from 'react';
import { QueryHistoryItem } from '../../types';
import { Activity, CheckCircle2, Clock, Star, Zap, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

interface HistoryStatsStripProps {
  history: QueryHistoryItem[];
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const HistoryStatsStrip: React.FC<HistoryStatsStripProps> = ({
  history,
  collapsed = false,
  onToggleCollapse,
}) => {
  if (history.length === 0) return null;

  const total = history.length;
  const successCount = history.filter((h) => h.status === 'success').length;
  const errorCount = total - successCount;
  const successRate = total > 0 ? ((successCount / total) * 100).toFixed(1) : '100.0';

  const latencies = history.map((h) => h.executionTime || 0);
  const avgLatency =
    latencies.length > 0
      ? (latencies.reduce((sum, val) => sum + val, 0) / latencies.length).toFixed(1)
      : '0.0';
  const slowQueriesCount = history.filter((h) => (h.executionTime || 0) >= 1000).length;
  const starredCount = history.filter((h) => h.isStarred).length;

  return (
    <div className="border-b border-monokai-border bg-monokai-sidebar px-4 py-2.5 font-sans transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-monokai-comment shrink-0" />
          <span className="text-xs font-semibold text-monokai-fg">执行指标分析 (Execution Metrics)</span>
          <span className="text-[11px] font-mono text-monokai-comment">
            (近 {total} 次执行记录)
          </span>
        </div>

        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex items-center gap-1 text-[11px] text-monokai-comment hover:text-monokai-fg transition-colors cursor-pointer px-2 py-0.5 rounded-md hover:bg-monokai-hover border border-transparent hover:border-monokai-border"
            title={collapsed ? '展开指标统计面板' : '收起指标统计面板'}
          >
            <span>{collapsed ? '展开指标' : '收起指标'}</span>
            {collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
          <div className="rounded-md border border-monokai-border bg-monokai-surface p-2.5 flex items-center justify-between shadow-xs">
            <div>
              <div className="text-[10.5px] text-monokai-comment font-medium">总执行次数</div>
              <div className="text-sm font-bold font-mono text-monokai-fg mt-0.5">{total}</div>
            </div>
            <div className="h-7 w-7 rounded-md bg-monokai-sidebar text-monokai-fg-muted flex items-center justify-center border border-monokai-border">
              <Clock size={14} />
            </div>
          </div>

          <div className="rounded-md border border-monokai-border bg-monokai-surface p-2.5 flex items-center justify-between shadow-xs">
            <div>
              <div className="text-[10.5px] text-monokai-comment font-medium">平均执行耗时</div>
              <div className="text-sm font-bold font-mono text-monokai-fg mt-0.5">
                {avgLatency} <span className="text-[10px] font-normal text-monokai-comment">ms</span>
              </div>
            </div>
            <div className="h-7 w-7 rounded-md bg-monokai-sidebar text-monokai-yellow flex items-center justify-center border border-monokai-border">
              <Zap size={14} />
            </div>
          </div>

          <div className="rounded-md border border-monokai-border bg-monokai-surface p-2.5 flex items-center justify-between shadow-xs">
            <div>
              <div className="text-[10.5px] text-monokai-comment font-medium">执行成功率</div>
              <div className="text-sm font-bold font-mono text-monokai-green mt-0.5">
                {successRate}%
              </div>
            </div>
            <div className="h-7 w-7 rounded-md bg-monokai-sidebar text-monokai-green flex items-center justify-center border border-monokai-border">
              <CheckCircle2 size={14} />
            </div>
          </div>

          <div className="rounded-md border border-monokai-border bg-monokai-surface p-2.5 flex items-center justify-between shadow-xs">
            <div>
              <div className="text-[10.5px] text-monokai-comment font-medium">慢查询 (≥1s)</div>
              <div className={`text-sm font-bold font-mono mt-0.5 ${slowQueriesCount > 0 ? 'text-monokai-pink font-semibold' : 'text-monokai-comment'}`}>
                {slowQueriesCount}
              </div>
            </div>
            <div className="h-7 w-7 rounded-md bg-monokai-sidebar text-monokai-pink flex items-center justify-center border border-monokai-border">
              <AlertTriangle size={14} />
            </div>
          </div>

          <div className="rounded-md border border-monokai-border bg-monokai-surface p-2.5 flex items-center justify-between shadow-xs">
            <div>
              <div className="text-[10.5px] text-monokai-comment font-medium">已收藏查询</div>
              <div className="text-sm font-bold font-mono text-monokai-fg mt-0.5">
                {starredCount}
              </div>
            </div>
            <div className="h-7 w-7 rounded-md bg-monokai-sidebar text-monokai-yellow flex items-center justify-center border border-monokai-border">
              <Star size={14} className={starredCount > 0 ? 'fill-monokai-yellow text-monokai-yellow' : ''} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
