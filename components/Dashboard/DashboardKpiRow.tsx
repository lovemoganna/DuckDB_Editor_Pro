import React from 'react';
import { Database, FileText, Zap, Clock, Users, Cpu, ArrowUpRight, type LucideIcon } from 'lucide-react';
import { Tab } from '../../types';
import { type DashboardDbMetrics } from '../../hooks/useDashboardWorkflow';
import { duckDBService } from '../../services/duckdbService';
import { toastService } from '../../services/toastService';
import { DB } from './dashboardUi';

interface DashboardKpiRowProps {
  metrics: DashboardDbMetrics;
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
  iconSpinning?: boolean;
}

const badgeClass = (tone: NonNullable<KpiCardProps['badgeTone']>) => {
  switch (tone) {
    case 'ok':
      return 'text-monokai-accent';
    case 'warn':
      return 'text-monokai-yellow';
    case 'danger':
      return 'text-monokai-pink';
    default:
      return 'text-monokai-comment';
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
  iconSpinning = false,
}) => {
  const interactive = Boolean(onActivate);
  const className = `${DB.kpi} ${interactive ? DB.kpiInteractive : ''} ${DB.focus}`;

  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={DB.iconBox}>
            <Icon className={`h-3.5 w-3.5 ${iconSpinning ? 'animate-spin' : ''}`} />
          </span>
          <span className="truncate text-2xs text-monokai-comment">{label}</span>
        </div>
        {interactive && (
          <ArrowUpRight className="h-3 w-3 shrink-0 text-monokai-comment opacity-0 transition-opacity group-hover:opacity-100" />
        )}
      </div>

      <div className="flex min-w-0 items-baseline gap-1.5">
        <span className={`${DB.value} truncate`}>{value}</span>
        {badge ? (
          <span className={`shrink-0 font-mono text-2xs ${badgeClass(badgeTone)}`}>{badge}</span>
        ) : null}
      </div>

      {footer ?? <span className="truncate text-2xs text-monokai-comment">{hint}</span>}
    </>
  );

  if (!interactive) {
    return (
      <div title={title} className={className}>
        {content}
      </div>
    );
  }

  return (
    <button type="button" title={title} onClick={onActivate} className={`${className} text-left`}>
      {content}
    </button>
  );
};

export const DashboardKpiRow: React.FC<DashboardKpiRowProps> = ({
  metrics,
  onNavigate,
  onShrinkMemory,
  onOpenSettings,
}) => {
  const [isShrinking, setIsShrinking] = React.useState(false);

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
    <div className="grid w-full grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-6 sm:gap-3">
      <KpiCard
        icon={Database}
        label="数据库大小"
        value={metrics.dataSize || '0 B'}
        hint={`共 ${metrics.databaseCount} 个库 · ${metrics.tableCount} 张表`}
        title="点击前往数据网格查看表资产概览"
        onActivate={onNavigate ? () => onNavigate(Tab.DATA) : undefined}
      />

      <KpiCard
        icon={FileText}
        label="总行数"
        value={metrics.formattedTotalRows || '0'}
        hint={metrics.viewCount > 0 ? `含 ${metrics.viewCount} 个视图` : '物理表汇总'}
        title="点击在数据浏览中查看各表详细行数"
        onActivate={onNavigate ? () => onNavigate(Tab.DATA) : undefined}
      />

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
      />

      <KpiCard
        icon={Clock}
        label="平均查询时间"
        value={metrics.formattedAvgLatency}
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
      />

      <KpiCard
        icon={Users}
        label="活跃会话"
        value={String(metrics.activeSessions)}
        hint="当前连接 · WASM Worker"
        title="本地内嵌 DuckDB WASM 会话 (点击查看系统与持久化配置)"
        onActivate={onOpenSettings}
      />

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
        footer={
          <div className="flex items-center gap-1.5">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-monokai-border-subtle">
              <div
                className="h-full rounded-full bg-monokai-accent/80 transition-all duration-500"
                style={{
                  width: `${Math.max(
                    metrics.rawSizeBytes > 0 ||
                      (metrics.memoryUsageFormatted && metrics.memoryUsageFormatted !== '0 B')
                      ? 4
                      : 0,
                    Math.min(100, metrics.memoryPercentage),
                  )}%`,
                }}
              />
            </div>
            <span className="shrink-0 font-mono text-2xs text-monokai-comment">
              {metrics.memoryPercentageDisplay || `${metrics.memoryPercentage}%`}
            </span>
          </div>
        }
      />
    </div>
  );
};
