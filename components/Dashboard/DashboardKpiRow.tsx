import React from 'react';
import { Database, FileText, Zap, Clock, Users, Cpu, ArrowUpRight } from 'lucide-react';
import { Tab } from '../../types';
import { type DashboardDbMetrics } from '../../hooks/useDashboardWorkflow';
import { duckDBService } from '../../services/duckdbService';
import { toastService } from '../../services/toastService';

interface DashboardKpiRowProps {
  metrics: DashboardDbMetrics;
  onNavigate?: (tab: Tab) => void;
  onShrinkMemory?: () => void;
  onOpenSettings?: () => void;
}

export const DashboardKpiRow: React.FC<DashboardKpiRowProps> = ({
  metrics,
  onNavigate,
  onShrinkMemory,
  onOpenSettings,
}) => {
  const [isShrinking, setIsShrinking] = React.useState(false);

  const handleShrink = async (e: React.MouseEvent) => {
    e.stopPropagation();
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
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3 w-full">
      {/* 1. 数据库大小 */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onNavigate && onNavigate(Tab.DATA)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onNavigate && onNavigate(Tab.DATA);
          }
        }}
        title="点击前往数据网格查看表资产概览"
        className="group relative flex items-start gap-2.5 p-2.5 sm:p-3 rounded-xl bg-monokai-surface hover:bg-monokai-surface/90 border border-monokai-border hover:border-monokai-border-strong shadow-xs hover:shadow-md transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent"
      >
        <div className="w-8 h-8 rounded-lg bg-monokai-accent/10 border border-monokai-accent/30 flex items-center justify-center text-monokai-accent shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
          <Database className="w-3.5 h-3.5" />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-meta text-monokai-comment font-normal">数据库大小</span>
            <ArrowUpRight className="w-3 h-3 text-monokai-comment opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="flex items-baseline gap-1.5 my-0.5">
            <span className="text-base sm:text-lg font-bold tracking-tight text-monokai-fg font-mono">
              {metrics.dataSize || '0 B'}
            </span>
            <span className="text-2xs font-semibold text-monokai-accent font-mono">
              {metrics.rawSizeBytes > 0 ? '实测' : '就绪'}
            </span>
          </div>
          <span className="text-2xs text-monokai-comment truncate">
            共 {metrics.databaseCount} 个库 · {metrics.tableCount} 张表
          </span>
        </div>
      </div>

      {/* 2. 总行数 */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onNavigate && onNavigate(Tab.DATA)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onNavigate && onNavigate(Tab.DATA);
          }
        }}
        title="点击在数据浏览中查看各表详细行数"
        className="group relative flex items-start gap-2.5 p-2.5 sm:p-3 rounded-xl bg-monokai-surface hover:bg-monokai-surface/90 border border-monokai-border hover:border-monokai-border-strong shadow-xs hover:shadow-md transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent"
      >
        <div className="w-8 h-8 rounded-lg bg-monokai-cyan/10 border border-monokai-cyan/30 flex items-center justify-center text-monokai-cyan shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
          <FileText className="w-3.5 h-3.5" />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-meta text-monokai-comment font-normal">总行数</span>
            <ArrowUpRight className="w-3 h-3 text-monokai-comment opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="flex items-baseline gap-1.5 my-0.5">
            <span className="text-base sm:text-lg font-bold tracking-tight text-monokai-fg font-mono">
              {metrics.formattedTotalRows || '0'}
            </span>
            <span className="text-2xs font-semibold text-monokai-cyan font-mono">
              {metrics.totalRows > 0 ? '实测' : '暂无'}
            </span>
          </div>
          <span className="text-2xs text-monokai-comment truncate">
            {metrics.viewCount > 0 ? `含 ${metrics.viewCount} 个视图` : '物理表汇总'}
          </span>
        </div>
      </div>

      {/* 3. 查询次数 */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onNavigate && onNavigate(Tab.SQL)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onNavigate && onNavigate(Tab.SQL);
          }
        }}
        title="点击前往 SQL 工作台运行或查看历史"
        className="group relative flex items-start gap-2.5 p-2.5 sm:p-3 rounded-xl bg-monokai-surface hover:bg-monokai-surface/90 border border-monokai-border hover:border-monokai-border-strong shadow-xs hover:shadow-md transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent"
      >
        <div className="w-8 h-8 rounded-lg bg-monokai-yellow/10 border border-monokai-yellow/30 flex items-center justify-center text-monokai-yellow shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
          <Zap className="w-3.5 h-3.5 fill-current" />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-meta text-monokai-comment font-normal">查询次数</span>
            <ArrowUpRight className="w-3 h-3 text-monokai-comment opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="flex items-baseline gap-1.5 my-0.5">
            <span className="text-base sm:text-lg font-bold tracking-tight text-monokai-fg font-mono">
              {metrics.totalQueries.toLocaleString()}
            </span>
            <span className={`text-2xs font-semibold font-mono ${metrics.errorCount > 0 ? 'text-monokai-pink' : 'text-monokai-accent'}`}>
              {metrics.totalQueries > 0 ? `${metrics.successRatePct}% 成功` : '0 次'}
            </span>
          </div>
          <span className="text-2xs text-monokai-comment truncate">
            {metrics.errorCount > 0 ? `${metrics.errorCount} 次报错记录` : '工作台实际执行'}
          </span>
        </div>
      </div>

      {/* 4. 平均查询时间 */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onNavigate && onNavigate(Tab.SQL)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onNavigate && onNavigate(Tab.SQL);
          }
        }}
        title="点击查看 SQL 查询执行耗时与优化"
        className="group relative flex items-start gap-2.5 p-2.5 sm:p-3 rounded-xl bg-monokai-surface hover:bg-monokai-surface/90 border border-monokai-border hover:border-monokai-border-strong shadow-xs hover:shadow-md transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent"
      >
        <div className="w-8 h-8 rounded-lg bg-monokai-orange/10 border border-monokai-orange/30 flex items-center justify-center text-monokai-orange shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
          <Clock className="w-3.5 h-3.5" />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-meta text-monokai-comment font-normal">平均查询时间</span>
            <ArrowUpRight className="w-3 h-3 text-monokai-comment opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="flex items-baseline gap-1.5 my-0.5">
            <span className="text-base sm:text-lg font-bold tracking-tight text-monokai-fg font-mono">
              {metrics.formattedAvgLatency}
            </span>
            <span className="text-2xs font-semibold text-monokai-orange font-mono">
              {metrics.avgLatencyMs > 0 && metrics.avgLatencyMs < 100 ? '极速' : metrics.avgLatencyMs >= 100 ? '正常' : '—'}
            </span>
          </div>
          <span className="text-2xs text-monokai-comment truncate">
            {metrics.totalQueries > 0 ? '基于本地执行耗时' : '暂无执行历史'}
          </span>
        </div>
      </div>

      {/* 5. 活跃会话 */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpenSettings && onOpenSettings()}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenSettings && onOpenSettings();
          }
        }}
        title="本地内嵌 DuckDB WASM 会话 (点击查看系统与持久化配置)"
        className="group relative flex items-start gap-2.5 p-2.5 sm:p-3 rounded-xl bg-monokai-surface hover:bg-monokai-surface/90 border border-monokai-border hover:border-monokai-border-strong shadow-xs hover:shadow-md transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent"
      >
        <div className="w-8 h-8 rounded-lg bg-monokai-amethyst/10 border border-monokai-amethyst/30 flex items-center justify-center text-monokai-amethyst shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
          <Users className="w-3.5 h-3.5" />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-meta text-monokai-comment font-normal">活跃会话</span>
            <ArrowUpRight className="w-3 h-3 text-monokai-comment opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="flex items-baseline gap-1.5 my-0.5">
            <span className="text-base sm:text-lg font-bold tracking-tight text-monokai-fg font-mono">
              {metrics.activeSessions}
            </span>
            <span className="text-2xs font-semibold text-monokai-amethyst font-mono">
              单进程
            </span>
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-2xs text-monokai-comment">当前连接</span>
            <span className="text-2xs font-mono text-monokai-accent bg-monokai-accent/10 px-1 py-0.2 rounded border border-monokai-accent/20">
              WASM Worker
            </span>
          </div>
        </div>
      </div>

      {/* 6. 内存使用 */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleShrink}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleShrink(e as any);
          }
        }}
        title="点击手动触发内存回收 (PRAGMA shrink_memory)"
        className="group relative flex items-start gap-2.5 p-2.5 sm:p-3 rounded-xl bg-monokai-surface hover:bg-monokai-surface/90 border border-monokai-border hover:border-monokai-border-strong shadow-xs hover:shadow-md transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent"
      >
        <div className="w-8 h-8 rounded-lg bg-monokai-accent/10 border border-monokai-accent/30 flex items-center justify-center text-monokai-accent shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
          <Cpu className={`w-3.5 h-3.5 ${isShrinking ? 'animate-spin' : ''}`} />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-meta text-monokai-comment font-normal">内存使用</span>
            <span className="text-2xs text-monokai-accent font-mono flex items-center gap-0.5 px-1 rounded bg-monokai-accent/10 border border-monokai-accent/20">
              <Zap className="w-2.5 h-2.5" />
              {isShrinking ? '回收中' : '可释放'}
            </span>
          </div>
          <div className="flex items-baseline gap-1 my-0.5">
            <span className="text-base sm:text-lg font-bold tracking-tight text-monokai-fg font-mono">
              {metrics.memoryUsageFormatted || `${metrics.memoryUsedGb} GB`}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <div className="flex-1 h-1.5 bg-monokai-border-subtle rounded-full overflow-hidden">
              <div
                className="h-full bg-monokai-accent rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(166,226,46,0.6)]"
                style={{ width: `${Math.max(metrics.rawSizeBytes > 0 || (metrics.memoryUsageFormatted && metrics.memoryUsageFormatted !== '0 B') ? 4 : 0, Math.min(100, metrics.memoryPercentage))}%` }}
              />
            </div>
            <span className="text-2xs font-mono text-monokai-comment font-medium">
              {metrics.memoryPercentageDisplay || `${metrics.memoryPercentage}%`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
