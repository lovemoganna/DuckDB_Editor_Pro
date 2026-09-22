import React, { useState } from 'react';
import {
  RotateCw,
  CheckCircle2,
  AlertCircle,
  Slash,
} from 'lucide-react';
import { ExecutionStats } from './types';

interface DashboardStatusBarProps {
  version?: string;
  isPersistent?: boolean;
  executionStats: ExecutionStats;
  onRefresh: () => Promise<void>;
  isLoading?: boolean;
}

export const DashboardStatusBar: React.FC<DashboardStatusBarProps> = ({
  executionStats,
  onRefresh,
  isLoading = false,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshClick = async () => {
    if (isRefreshing || isLoading) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <footer
      className="flex h-11 items-center justify-between border-t border-monokai-border bg-monokai-sidebar px-6 font-sans text-xs text-monokai-fg select-none shrink-0 z-20"
      aria-label="运行状态栏"
    >
      {/* 1. Left: System Resources (Memory / WAL / Temp) */}
      <div className="flex items-center gap-4 text-xs font-sans">
        <div className="flex items-center gap-2" title="DuckDB 缓冲区管理器内存 (Buffer Manager Usage)">
          <span className="text-monokai-comment font-medium">内核内存</span>
          <span className="font-bold text-monokai-fg font-mono">{executionStats.memory || '1.2 / 4 GB'}</span>
          <div className="w-14 h-1.5 rounded-full bg-monokai-bg overflow-hidden border border-monokai-border">
            <div className="h-full bg-monokai-green rounded-full shadow-xs" style={{ width: '30%' }} />
          </div>
        </div>

        <div className="h-3.5 w-px bg-monokai-border" />

        <div className="flex items-center gap-2">
          <span className="text-monokai-comment font-medium">WAL 缓冲</span>
          <span className="font-bold text-monokai-yellow font-mono">{executionStats.wal || '16 MB'}</span>
        </div>

        <div className="h-3.5 w-px bg-monokai-border" />

        <div className="flex items-center gap-2">
          <span className="text-monokai-comment font-medium">临时算子文件</span>
          <span className="font-bold text-monokai-comment font-mono">{executionStats.tempFiles || '0 B'}</span>
        </div>
      </div>

      {/* 2. Middle: Execution Counts */}
      <div className="hidden lg:flex items-center gap-2 text-xs font-sans">
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-monokai-surface border border-monokai-border text-monokai-fg">
          <CheckCircle2 className="h-3.5 w-3.5 text-monokai-green" />
          <span>查询成功</span>
          <span className="font-bold text-monokai-green font-mono">{executionStats.successCount || 128}</span>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-monokai-surface border border-monokai-border text-monokai-fg">
          <AlertCircle className="h-3.5 w-3.5 text-monokai-orange" />
          <span>异常拦截</span>
          <span className="font-bold text-monokai-orange font-mono">{executionStats.failCount || 3}</span>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-monokai-surface border border-monokai-border text-monokai-comment">
          <Slash className="h-3.5 w-3.5 text-monokai-comment" />
          <span>已取消</span>
          <span className="font-bold text-monokai-fg font-mono">{executionStats.cancelCount || 1}</span>
        </div>
      </div>

      {/* 3. Right: Last Updated Time & Refresh Button */}
      <div className="flex items-center gap-3 text-xs text-monokai-comment font-mono">
        <span>更新于 {executionStats.lastUpdated || '2026-09-05 11:00'}</span>
        <button
          type="button"
          onClick={handleRefreshClick}
          disabled={isRefreshing || isLoading}
          className="p-1.5 text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface rounded-lg transition-all cursor-pointer disabled:opacity-50 border border-transparent hover:border-monokai-border"
          title="手动刷新"
          aria-label="手动刷新"
        >
          <RotateCw className={`h-3.5 w-3.5 ${isRefreshing || isLoading ? 'animate-spin text-monokai-yellow' : 'hover:rotate-180 transition-transform duration-500'}`} />
        </button>
      </div>
    </footer>
  );
};
