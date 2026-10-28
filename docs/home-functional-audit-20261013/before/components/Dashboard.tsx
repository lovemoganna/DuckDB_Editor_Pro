import React, { useEffect, useState } from 'react';
import { UploadCloud, Loader2 } from 'lucide-react';
import { Tab } from '../types';
import { type DuckDBRuntimeInfo } from '../services/duckdbService';
import { useDashboardWorkflow } from '../hooks/useDashboardWorkflow';
import { QuickTablePeekDrawer } from './Dashboard/QuickTablePeekDrawer';
import { DataIdeMissionControl } from './Dashboard/MissionControl/DataIdeMissionControl';

export interface DashboardProps {
  tables: string[];
  onNavigate: (tab: Tab) => void;
  runtimeInfo?: DuckDBRuntimeInfo;
  /** @deprecated Studio Home is the only layout; kept for call-site compatibility. */
  initialLayoutMode?: 'mission-control' | 'classic';
  onSelectTable?: (tableName: string, filter?: string) => void | Promise<void>;
  onSelectTableStructure?: (tableName: string, focusTab?: 'profile' | 'add' | 'ddl') => void | Promise<void>;
  onSelectTableAnalysis?: (tableName: string) => void;
  onSelectTableMetrics?: (tableName: string) => void;
  onSelectTableDataFlow?: (tableName: string) => void;
  onSelectQuery?: (sql: string, executeDirectly?: boolean) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  tables,
  onNavigate,
  runtimeInfo,
  onSelectTable,
  onSelectTableStructure,
  onSelectTableAnalysis,
  onSelectTableMetrics,
  onSelectTableDataFlow,
  onSelectQuery,
}) => {
  const {
    displayTables,
    loadingDetails,
    displayQueries,
    allHistoryItems,
    recentImports,
    growthTrendData,
    latencyTrendData,
    dbMetrics,
    peekTableName,
    handleOpenPeek,
    handleClosePeek,
    isRefreshing,
    handleRefresh,
    handleSwitchAnalysisContext,
    analysisContexts,
    handleImportFile,
    handleShrinkMemory,
    handleSelectTable: workflowSelectTable,
    handleSelectTableWithFilter: workflowSelectTableWithFilter,
    handleSelectTableStructure: workflowSelectTableStructure,
    handleSelectTableAnalysis: workflowSelectTableAnalysis,
    handleSelectTableMetrics: workflowSelectTableMetrics,
    handleSelectTableDataFlow: workflowSelectTableDataFlow,
    handleSelectQuery: workflowSelectQuery,
    handleQuickQuery,
    importState,
    setShowCreateModal,
    setShowImportModal,
    setShowSettingsModal,
    setShowExportModal,
    homeDashboard,
    setHomeDashboard,
    homeBoardLoading,
    homeBoardError,
    dashboardRefreshTrigger,
    tableUsageFrequency,
    refreshHomeDashboard,
  } = useDashboardWorkflow(tables, onNavigate, runtimeInfo, {
    onSelectTable,
    onSelectTableStructure,
    onSelectTableAnalysis,
    onSelectTableMetrics,
    onSelectTableDataFlow,
    onSelectQuery,
  });

  const [isDraggingOver, setIsDraggingOver] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        onNavigate(Tab.SQL);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNavigate]);

  const handleGlobalDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingOver) setIsDraggingOver(true);
  };

  const handleGlobalDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingOver(false);
  };

  const handleGlobalDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleImportFile(file);
  };

  return (
    <div
      onDragOver={handleGlobalDragOver}
      onDragLeave={handleGlobalDragLeave}
      onDrop={handleGlobalDrop}
      className="relative flex flex-col flex-1 h-full w-full overflow-y-auto bg-monokai-bg text-monokai-fg px-3 sm:px-4 lg:px-5 py-3 select-text custom-scrollbar space-y-3 font-sans text-xs"
    >
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 m-3 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-monokai-accent bg-monokai-bg/90 backdrop-blur-xs pointer-events-none animate-in fade-in duration-150 select-none">
          <div className="mb-2.5 flex h-12 w-12 items-center justify-center rounded-xl border border-monokai-border bg-monokai-elevated text-monokai-accent">
            <UploadCloud className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold tracking-wide text-monokai-fg">释放文件以即时解析导入</h3>
          <p className="mt-1 font-mono text-xs text-monokai-comment">
            支持 .csv, .xlsx, .xls, .parquet, .json, .arrow, .sqlite, .db, .tsv
          </p>
        </div>
      )}

      {importState.status === 'importing' && (
        <div className="flex items-center justify-between rounded-xl border border-monokai-border bg-monokai-surface px-4 py-2.5 text-xs font-mono shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-monokai-accent" />
            <span className="text-monokai-fg">
              正在挂载并解析：
              <span className="ml-1 font-semibold text-monokai-accent">{importState.filename || '数据表'}</span>
            </span>
          </div>
          <span className="text-xs text-monokai-comment">WASM 流式处理中…</span>
        </div>
      )}

      <DataIdeMissionControl
        tables={displayTables}
        dataLoading={loadingDetails}
        queries={displayQueries}
        allHistoryItems={allHistoryItems}
        recentImports={recentImports}
        growthData={growthTrendData}
        latencyData={latencyTrendData}
        metrics={dbMetrics}
        runtimeInfo={runtimeInfo}
        homeDashboard={homeDashboard}
        homeBoardLoading={homeBoardLoading}
        homeBoardError={homeBoardError}
        dashboardRefreshTrigger={dashboardRefreshTrigger}
        tableUsageFrequency={tableUsageFrequency}
        onHomeDashboardChange={setHomeDashboard}
        onRefreshHomeDashboard={refreshHomeDashboard}
        onNavigate={onNavigate}
        onSelectTable={workflowSelectTable}
        onSelectTableStructure={workflowSelectTableStructure}
        onSelectTableAnalysis={workflowSelectTableAnalysis}
        onSelectTableMetrics={workflowSelectTableMetrics}
        onSelectTableDataFlow={workflowSelectTableDataFlow}
        onPeekTable={handleOpenPeek}
        onQuickQuery={handleQuickQuery}
        onSelectQuery={workflowSelectQuery}
        onOpenImport={() => setShowImportModal(true)}
        onOpenCreate={() => setShowCreateModal(true)}
        onOpenSettings={() => setShowSettingsModal(true)}
        onOpenExport={() => setShowExportModal(true)}
        onRefresh={handleRefresh}
        onSwitchAnalysisContext={handleSwitchAnalysisContext}
        analysisContexts={analysisContexts}
        isRefreshing={isRefreshing}
        onShrinkMemory={handleShrinkMemory}
      />

      {peekTableName && (
        <QuickTablePeekDrawer
          tableName={peekTableName}
          onClose={handleClosePeek}
          onNavigateToData={workflowSelectTable}
          onNavigateToDataWithFilter={workflowSelectTableWithFilter}
          onNavigateToStructure={workflowSelectTableStructure}
          onNavigateToAnalysis={workflowSelectTableAnalysis}
          onNavigateToMetrics={workflowSelectTableMetrics}
          onNavigateToDataFlow={workflowSelectTableDataFlow}
          onNavigateToSql={workflowSelectQuery}
        />
      )}
    </div>
  );
};
