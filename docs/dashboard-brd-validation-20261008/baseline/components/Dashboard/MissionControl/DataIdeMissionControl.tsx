import React, { useEffect, useState } from 'react';
import { Tab, QueryHistoryItem, Dashboard } from '../../../types';
import { type DuckDBRuntimeInfo } from '../../../services/duckdbService';
import {
  type TableItemDetail,
  type RecentQueryDisplayItem,
  type DashboardDbMetrics,
  type RecentImportItem,
} from '../../../hooks/useDashboardWorkflow';
import {
  HomeHeader,
  HomeInsightStrip,
  HomeBoardCanvas,
  HomeAssetRail,
  HomeDataFoundation,
  type BoardBrushFilter,
} from '../Home';
import { useCopilotStore } from '../../../hooks/store/useCopilotStore';
import { useSqlEditorStore } from '../../../hooks/store/useSqlEditorStore';
import { useAppStore } from '../../../hooks/store/useAppStore';
import { useAnalyticalCatalog } from '../../../hooks/useAnalyticalCatalog';
import { toastService } from '../../../services/toastService';
import { SqlWorkspaceInput } from '../Home/SqlWorkspaceInput';

export interface DataIdeMissionControlProps {
  dataLoading?: boolean;
  tables: TableItemDetail[];
  queries: RecentQueryDisplayItem[];
  allHistoryItems?: QueryHistoryItem[];
  recentImports?: RecentImportItem[];
  growthData?: unknown[];
  latencyData?: unknown[];
  metrics: DashboardDbMetrics;
  runtimeInfo?: DuckDBRuntimeInfo;
  homeDashboard?: Dashboard | null;
  homeBoardLoading?: boolean;
  homeBoardError?: string;
  dashboardRefreshTrigger?: number;
  tableUsageFrequency?: Array<{ name: string; count: number }>;
  onHomeDashboardChange?: (dashboard: Dashboard) => void;
  onRefreshHomeDashboard?: () => void;
  onNavigate: (tab: Tab) => void;
  onSelectTable?: (tableName: string) => void;
  onSelectTableStructure?: (tableName: string, focusTab?: 'profile' | 'add' | 'ddl') => void;
  onSelectTableAnalysis?: (tableName: string) => void;
  onSelectTableMetrics?: (tableName: string) => void;
  onSelectTableDataFlow?: (tableName: string) => void;
  onPeekTable?: (tableName: string) => void;
  onQuickQuery?: (tableName: string) => void;
  onSelectQuery?: (sql: string, executeDirectly?: boolean) => void;
  onOpenImport: () => void;
  onOpenCreate: () => void;
  onOpenSettings: () => void;
  onOpenExport?: () => void;
  onRefresh: () => void;
  analysisContexts?: Array<{ id: string; label: string; kind: 'schema' | 'database' | 'project'; isCurrent: boolean }>;
  onSwitchAnalysisContext?: (target: { id: string; kind: 'schema' | 'database' | 'project' }) => void;
  isRefreshing?: boolean;
  onShrinkMemory?: () => void;
}

/**
 * Analysis Home — Dune-inspired entry:
 * assets → SQL → results → charts → board → drill-down.
 */
export const DataIdeMissionControl: React.FC<DataIdeMissionControlProps> = ({
  dataLoading = false,
  tables = [],
  queries = [],
  metrics,
  runtimeInfo,
  homeDashboard = null,
  homeBoardLoading = false,
  homeBoardError = '',
  dashboardRefreshTrigger = 0,
  tableUsageFrequency = [],
  recentImports = [],
  onHomeDashboardChange,
  onRefreshHomeDashboard,
  onNavigate,
  onSelectTable,
  onSelectTableStructure,
  onSelectTableAnalysis,
  onSelectTableMetrics,
  onPeekTable,
  onQuickQuery,
  onSelectQuery,
  onSelectTableDataFlow,
  onOpenImport,
  onRefresh,
  analysisContexts = [],
  onSwitchAnalysisContext,
  isRefreshing = false,
  onShrinkMemory,
}) => {
  const [brushFilter, setBrushFilter] = useState<BoardBrushFilter | null>(null);
  const currentDatabase = useAppStore((s) => s.currentDatabase);

  useEffect(() => {
    setBrushFilter(null);
  }, [currentDatabase, homeDashboard?.id]);

  const changeBrushFilter = (next: BoardBrushFilter | null) => {
    setBrushFilter(next);
  };

  const setPendingChartConfig = useAppStore((s) => s.setPendingChartConfig);
  const setPendingSql = useAppStore((s) => s.setPendingSql);
  const createSqlTab = useSqlEditorStore((s) => s.createTab);
  const setContext = useCopilotStore((s) => s.setContext);

  const tableNames = tables.map((t) => t.name);
  const { catalog } = useAnalyticalCatalog(tableNames);

  const handleGenerateChart = () => {
    const candidate =
      queries.find((q) => q.status === 'success' && (q.vizHint === 'strong' || q.vizHint === 'weak')) ||
      queries.find((q) => q.status === 'success');
    if (!candidate) {
      createSqlTab();
      onNavigate(Tab.SQL);
      toastService.info('请先执行一条查询，再生成图表');
      return;
    }
    setPendingSql(candidate.sql);
    setPendingChartConfig({
      id: `chart-${Date.now()}`,
      title: '未命名图表',
      type: 'bar',
      xKey: '',
      yKeys: [],
      source: 'manual',
    });
    onNavigate(Tab.SQL);
    toastService.info('已载入查询并打开结果图表视图，配置后可「加入看板」');
  };

  const handleContinueAnalysis = () => {
    const hot = tableUsageFrequency[0]?.name || tables[0]?.name;
    if (hot && onSelectTableAnalysis) onSelectTableAnalysis(hot);
    else onNavigate(Tab.ANALYSIS_HUB);
  };

  const handleNewQuery = () => {
    createSqlTab();
    onNavigate(Tab.SQL);
  };

  // Inject Copilot context from home board + recent SQL + hot tables
  useEffect(() => {
    const hotTables = tableUsageFrequency.slice(0, 3).map((t) => t.name);
    const seed = hotTables[0] || tables[0]?.name || null;

    setContext({
      table: seed,
      tables: hotTables.length > 0 ? hotTables : seed ? [seed] : [],
      tab: Tab.DASHBOARD,
      pin: false,
    });
  }, [homeDashboard?.id, homeDashboard?.items.length, queries[0]?.id, tables, tableUsageFrequency, setContext]);

  const loading = dataLoading || homeBoardLoading;
  const hasData = !loading && (tables.some(table => table.rowCount > 0) || Boolean(homeDashboard?.items.length && (!homeDashboard.databaseName || homeDashboard.databaseName === currentDatabase)));
  return (
    <div className="flex flex-col w-full gap-3 font-sans text-xs pb-4">
      <HomeHeader
        metrics={metrics}
        tables={tables}
        runtimeInfo={runtimeInfo}
        analysisContexts={analysisContexts}
        onSwitchAnalysisContext={onSwitchAnalysisContext}
        onNavigate={onNavigate}
        onOpenImport={hasData ? onOpenImport : undefined}
        onGenerateChart={handleGenerateChart}
        onContinueAnalysis={handleContinueAnalysis}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
      />


      {homeBoardError && <div role="alert" className="text-monokai-pink">分析读取失败：{homeBoardError}<button className="ml-2 underline" onClick={onRefresh}>重试</button></div>}
      {loading && <p role="status" className="py-4 text-monokai-comment">加载分析…</p>}
      {!loading && !hasData && <section className="py-8 flex flex-col items-center gap-3">
        <p>{tables.length ? '数据集暂无记录' : '导入数据开始分析'}</p>
        <button type="button" onClick={onOpenImport} className="rounded border border-monokai-accent px-3 py-2 text-monokai-accent">导入数据</button>
      </section>}
      {hasData && <>

      <HomeBoardCanvas
        dashboard={homeDashboard} loading={homeBoardLoading} refreshTrigger={dashboardRefreshTrigger}
        brushFilter={brushFilter} onBrushFilterChange={changeBrushFilter}
        onDashboardChange={(d) => onHomeDashboardChange?.(d)} onNavigate={onNavigate}
        onGenerateChart={handleGenerateChart} onNewQuery={handleNewQuery}
        onSelectTable={onSelectTable} onSelectTableStructure={onSelectTableStructure} onSelectTableDataFlow={onSelectTableDataFlow}
      />

      <details className="text-monokai-comment border-t border-monokai-border pt-2">
        <summary className="cursor-pointer">数据来源与检查</summary>
        <div className="mt-3 space-y-3">
          <SqlWorkspaceInput/>
          <HomeInsightStrip metrics={metrics} tables={tables} onNavigate={onNavigate}
            onFilterSlowQueries={() => onNavigate(Tab.HISTORY)} onFilterErrorQueries={() => onNavigate(Tab.HISTORY)}
            onSelectTableStructure={onSelectTableStructure} onShrinkMemory={onShrinkMemory}/>
          <HomeDataFoundation catalog={catalog} onNavigate={onNavigate} onSelectQuery={onSelectQuery} onSelectTableMetrics={onSelectTableMetrics}/>
          <HomeAssetRail tables={tables} onSelectTable={onSelectTable} onSelectTableStructure={onSelectTableStructure}
            onSelectTableAnalysis={onSelectTableAnalysis} onSelectTableMetrics={onSelectTableMetrics}
            onPeekTable={onPeekTable} onQuickQuery={onQuickQuery} onNavigate={onNavigate}/>
          <button className="text-monokai-cyan" onClick={() => onNavigate(Tab.HISTORY)}>查看查询历史{metrics.errorCount ? ` · ${metrics.errorCount} 条失败` : ''}</button>
        </div>
      </details>
      </>}
      {!hasData && metrics.errorCount > 0 && <button className="text-monokai-pink" onClick={() => onNavigate(Tab.HISTORY)}>查看失败查询（{metrics.errorCount}）</button>}
    </div>
  );
};
