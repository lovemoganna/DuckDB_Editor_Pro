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
  HomeBoardCanvas,
  type BoardBrushFilter,
} from '../Home';
import { useCopilotStore } from '../../../hooks/store/useCopilotStore';
import { useAppStore } from '../../../hooks/store/useAppStore';
import { useAnalysisWorkspace } from '../../../hooks/store/useAnalysisWorkspace';
import { useDataInspection } from '../../../hooks/store/useDataInspection';
import { toastService } from '../../../services/toastService';
import { WorkspaceWelcome } from '../Home/WorkspaceWelcome';

export interface DataIdeMissionControlProps {
  dataLoading?: boolean;
  dataError?: string;
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
  dataError = '',
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
  const setContext = useCopilotStore((s) => s.setContext);

  const handleGenerateChart = () => {
    const candidate =
      queries.find((q) => q.status === 'success' && (q.vizHint === 'strong' || q.vizHint === 'weak')) ||
      queries.find((q) => q.status === 'success');
    if (!candidate) {
      useAppStore.getState().clearPending();
      useAppStore.getState().setPendingNewQuery(true);
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
    useAppStore.getState().clearPending();
    useAppStore.getState().setPendingNewQuery(true);
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

  const contextMismatch = Boolean(
    (metrics.databaseName && metrics.databaseName !== currentDatabase) ||
    (homeDashboard?.databaseName && homeDashboard.databaseName !== currentDatabase),
  );
  const loading = dataLoading || homeBoardLoading || contextMismatch;
  const unavailable = tables.filter(table => table.metadataStatus === 'unavailable');
  const inspectionReports = useDataInspection(state => state.reports);
  const checked = Object.values(inspectionReports).filter(report => report.catalog === metrics.databaseName && report.schema === metrics.schemaName && tables.some(table => table.name === report.table));
  const inspectionProblem = checked.find(report => ['issues', 'failed', 'unavailable'].includes(report.status));
  // Refreshing metadata must not unmount the last available analysis workspace.
  const hasData = tables.some(table => table.rowCount > 0) || unavailable.length > 0 || Boolean(homeDashboard?.items.length);
  return (
    <div className="analysis-home flex flex-col w-full gap-3 font-sans text-xs pb-4">
      <HomeHeader
        metrics={contextMismatch ? {...metrics,databaseName:currentDatabase,formattedTotalRows:'未知'} : metrics}
        tables={contextMismatch ? [] : tables}
        runtimeInfo={runtimeInfo}
        analysisContexts={analysisContexts}
        onSwitchAnalysisContext={onSwitchAnalysisContext}
        onNavigate={onNavigate}
        onOpenImport={hasData && !contextMismatch ? onOpenImport : undefined}
        onGenerateChart={handleGenerateChart}
        onContinueAnalysis={handleContinueAnalysis}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
      />


      {homeBoardError && <div role="alert" className="text-monokai-pink">分析读取失败：{homeBoardError}<button className="ml-2 underline" onClick={onRefresh}>重试</button></div>}
      {dataError && <div role="alert" className="text-monokai-pink">数据集元数据读取失败：{dataError}<button className="ml-2 underline" onClick={onRefresh}>重试读取元数据</button></div>}
      {(loading || isRefreshing) && (
        <div className={`workspace-load-state ${hasData && !contextMismatch ? 'workspace-load-state-refresh' : ''}`}>
          <p role="status" className="text-monokai-fg-muted">
            {hasData && !contextMismatch ? '正在更新分析，当前视图保持可用…' : contextMismatch ? '正在切换数据源，加载分析…' : '正在加载分析工作台…'}
          </p>
          {(!hasData || contextMismatch) && <div className="workspace-load-placeholder" aria-hidden="true">
            <div /><div /><div />
          </div>}
        </div>
      )}
      {!loading && !hasData && !dataError && !homeBoardError && <WorkspaceWelcome
        hasTables={tables.length > 0} onImport={onOpenImport} onNewQuery={handleNewQuery}
        onManageDatabases={() => window.dispatchEvent(new CustomEvent('open-project-manager-modal'))}
      />}
      {hasData && !contextMismatch && <>

      <HomeBoardCanvas
        key={currentDatabase}
        dashboard={homeDashboard} loading={homeBoardLoading} refreshTrigger={dashboardRefreshTrigger}
        brushFilter={brushFilter} onBrushFilterChange={changeBrushFilter}
        onDashboardChange={(d) => onHomeDashboardChange?.(d)} onNavigate={onNavigate}
        onGenerateChart={handleGenerateChart} onNewQuery={handleNewQuery}
        onSelectTable={onSelectTable} onSelectTableStructure={onSelectTableStructure} onSelectTableDataFlow={onSelectTableDataFlow}
      />

      <nav aria-label="数据状态与详情" className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-monokai-border pt-2 text-monokai-comment">
        {checked.length > 0 && <span className={inspectionProblem ? 'text-monokai-pink' : undefined}>
          最近检查：{checked.length} / {tables.length} 个数据集 · {inspectionProblem ? inspectionProblem.status === 'issues' ? '发现规则失败' : '检查未完成' : '已检查范围未发现规则失败'}
        </span>}
        <button className="text-monokai-cyan" onClick={() => onNavigate(Tab.DATA)}>管理数据</button>
        <button className="text-monokai-cyan" onClick={() => onNavigate(Tab.STRUCTURE)}>查看 Schema</button>
        <button className="text-monokai-cyan" onClick={() => { useAnalysisWorkspace.getState().requestInspection(); const table = inspectionProblem?.table || tables[0]?.name; if (onSelectTableAnalysis && table) onSelectTableAnalysis(table); else onNavigate(Tab.ANALYSIS_HUB); }}>{inspectionProblem ? '处理检查问题' : '查看数据检查'}</button>
      </nav>
      {!!unavailable.length && <div role="alert" className="text-monokai-pink">{unavailable.length} 个数据集的元数据未完整获取，无法获取的统计标为未知。<button className="ml-2 underline" onClick={onRefresh}>重新读取元数据</button>
        <details><summary>查看失败原因</summary>{unavailable.map(table => <p key={table.name}>{table.name}：{table.metadataError}</p>)}</details>
      </div>}
      </>}
      {!hasData && metrics.errorCount > 0 && <button className="text-monokai-pink" onClick={() => onNavigate(Tab.HISTORY)}>查看失败查询（{metrics.errorCount}）</button>}
    </div>
  );
};
