import React, { useMemo } from 'react';
import { RotateCcw, Play, Sparkles, FileSpreadsheet } from 'lucide-react';
import { Tab } from '../../../types';
import { type DashboardDbMetrics, type TableItemDetail } from '../../../hooks/useDashboardWorkflow';
import { useSqlEditorStore } from '../../../hooks/store/useSqlEditorStore';
import { useCopilotStore } from '../../../hooks/store/useCopilotStore';
import { DB } from '../dashboardUi';

export interface MissionControlTopStripProps {
  metrics?: DashboardDbMetrics;
  tables?: TableItemDetail[];
  runtimeInfo?: { version?: string; persistent?: boolean; ready?: boolean };
  onNavigate: (tab: Tab) => void;
  onSelectQuery?: (sql: string, executeDirectly?: boolean) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onOpenAiChat?: () => void;
  onFilterErrorQueries?: () => void;
  onFilterSlowQueries?: () => void;
  onSelectTableStructure?: (tableName: string, focusTab?: 'profile' | 'add' | 'ddl') => void;
  onShrinkMemory?: () => void;
  onOpenImport?: () => void;
}

export const MissionControlTopStrip: React.FC<MissionControlTopStripProps> = ({
  metrics,
  tables = [],
  runtimeInfo,
  onNavigate,
  onRefresh,
  isRefreshing = false,
  onOpenAiChat,
  onOpenImport,
}) => {
  const sqlTabs = useSqlEditorStore((s) => s.tabs);
  const activeTabId = useSqlEditorStore((s) => s.activeTabId);
  const createSqlTab = useSqlEditorStore((s) => s.createTab);

  const activeSqlTab = useMemo(() => {
    return sqlTabs.find((t) => t.id === activeTabId) || sqlTabs[0] || null;
  }, [sqlTabs, activeTabId]);

  const engineVersion = runtimeInfo?.version ? `v${runtimeInfo.version}` : 'v1.33.1';
  const isPersistent = Boolean(runtimeInfo?.persistent ?? metrics?.isPersistent);
  const dbName =
    metrics?.databaseName && metrics.databaseName !== 'memory' ? metrics.databaseName : 'duckdb_managed';

  const handleResumeWork = () => {
    if (activeSqlTab?.code?.trim()) {
      onNavigate(Tab.SQL);
      return;
    }
    createSqlTab();
    onNavigate(Tab.SQL);
  };

  const hasResume = Boolean(activeSqlTab?.code?.trim());
  const primaryCtaLabel = hasResume ? '继续编辑' : '新建查询';
  const primaryCtaTitle = hasResume
    ? `回到 SQL 工作台继续编辑「${activeSqlTab?.title || '未命名'}」`
    : '新建空白 SQL 工作表';

  const handleToggleCopilot = () => {
    if (onOpenAiChat) onOpenAiChat();
    else useCopilotStore.getState().setIsOpen(true);
  };

  const contextLine = hasResume
    ? `继续「${activeSqlTab?.title || '未命名'}」`
    : tables.length > 0
      ? `${tables.length} 张表 · ${isPersistent ? 'OPFS' : '内存'} · DuckDB ${engineVersion}`
      : `空工作区 · DuckDB ${engineVersion} · 拖入文件或新建查询`;

  return (
    <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between select-text">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h1 className="text-lg font-semibold tracking-tight text-monokai-fg font-sans">工作台</h1>
          <span className="font-mono text-2xs text-monokai-comment">/</span>
          <span className="font-mono text-xs text-monokai-fg-muted truncate" title={dbName}>
            {dbName}
          </span>
        </div>
        <p className="text-meta text-monokai-comment font-sans truncate">{contextLine}</p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
        <button type="button" onClick={handleResumeWork} title={primaryCtaTitle} className={DB.btnPrimary}>
          <Play className="h-3 w-3 fill-current" />
          <span>{primaryCtaLabel}</span>
        </button>

        {onOpenImport && (
          <button type="button" onClick={onOpenImport} className={DB.btnSecondary}>
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>导入</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleToggleCopilot}
          className={DB.btnSecondary}
          title="切换 Copilot (Ctrl+I)"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">助手</span>
        </button>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className={DB.btnIcon}
          title="刷新工作区状态"
          aria-label="刷新"
        >
          <RotateCcw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-monokai-accent' : ''}`} />
        </button>
      </div>
    </header>
  );
};
