import React, { useMemo } from 'react';
import {
  Play,
  Upload,
  PlusSquare,
  Table,
  Database,
  HardDrive,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { Tab } from '../../types';
import { type DashboardDbMetrics } from '../../hooks/useDashboardWorkflow';
import { DB } from './dashboardUi';

interface DashboardHeroProps {
  onNavigate: (tab: Tab) => void;
  onOpenImport: () => void;
  onOpenCreate: () => void;
  onOpenSettings?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  lastRefreshedTime?: string;
  metrics?: DashboardDbMetrics;
  runtimeInfo?: { version?: string; persistent?: boolean; ready?: boolean };
}

export const DashboardHero: React.FC<DashboardHeroProps> = ({
  onNavigate,
  onOpenImport,
  onOpenCreate,
  onOpenSettings,
  onRefresh,
  isRefreshing = false,
  lastRefreshedTime,
  metrics,
  runtimeInfo,
}) => {
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return '早上好';
    if (hour >= 12 && hour < 18) return '下午好';
    return '晚上好';
  }, []);

  const engineVersion = runtimeInfo?.version ? `v${runtimeInfo.version}` : 'v1.33.1';
  const dbName =
    metrics?.isPersistent && metrics?.databaseName === 'memory'
      ? 'main'
      : metrics?.databaseName || 'main';

  return (
    <div className={`relative w-full overflow-hidden shrink-0 ${DB.shell} p-3.5`}>
      <div className="relative z-10 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 max-w-3xl flex-col gap-2.5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={DB.iconBox}>
                <Database className="h-3.5 w-3.5 text-monokai-accent" />
              </span>
              <h1 className="text-sm font-semibold tracking-tight text-monokai-fg">
                {greeting}，欢迎使用{' '}
                <span className="text-monokai-accent">DuckDB Studio</span>
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2 pl-9">
              <p className={DB.meta}>本地高性能分析数据库 · 简单、快速、开放</p>
              <span className="hidden text-monokai-border sm:inline" aria-hidden>
                |
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={DB.chip} title="当前连接数据库">
                  <HardDrive className="h-3 w-3 text-monokai-comment" />
                  <span>库: {dbName}</span>
                </span>
                <button
                  type="button"
                  onClick={onOpenSettings}
                  title="点击查看或配置持久化模式"
                  className={`${DB.chip} hover:border-monokai-border-strong hover:text-monokai-fg ${DB.focus}`}
                >
                  <span
                    className={
                      metrics?.isPersistent ? DB.statusDotOk : DB.statusDotWarn
                    }
                  />
                  <span>{metrics?.modeLabel || '内存数据库'}</span>
                </button>
                <span className={DB.chip}>
                  <CheckCircle2 className="h-3 w-3 text-monokai-accent" />
                  <span>DuckDB {engineVersion} 就绪</span>
                </span>
              </div>
            </div>
          </div>

          {/* Primary path: SQL + core data ops. Module nav lives in QuickActions. */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onNavigate(Tab.SQL)}
              className={`${DB.btnPrimary} ${DB.focus}`}
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>打开 SQL 编辑器</span>
            </button>

            <button
              type="button"
              onClick={onOpenImport}
              className={`${DB.btnSecondary} ${DB.focus}`}
            >
              <Upload className="h-3.5 w-3.5 text-monokai-comment" />
              <span>导入数据</span>
            </button>

            <button
              type="button"
              onClick={onOpenCreate}
              className={`${DB.btnSecondary} ${DB.focus}`}
            >
              <PlusSquare className="h-3.5 w-3.5 text-monokai-comment" />
              <span>新建数据集</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate(Tab.DATA)}
              className={`${DB.btnSecondary} ${DB.focus}`}
            >
              <Table className="h-3.5 w-3.5 text-monokai-comment" />
              <span>浏览数据</span>
            </button>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 border-t border-monokai-border pt-2 lg:border-t-0 lg:pt-0">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className={`${DB.btnSecondary} ${DB.focus} text-monokai-fg-muted hover:text-monokai-fg`}
              title="手动刷新仪表盘数据统计"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-monokai-accent' : ''}`}
              />
              <span>{isRefreshing ? '刷新中…' : '刷新'}</span>
            </button>
          )}
          {lastRefreshedTime && (
            <span className={DB.sectionMeta}>同步于 {lastRefreshedTime}</span>
          )}
        </div>
      </div>
    </div>
  );
};
