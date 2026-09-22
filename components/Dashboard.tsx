import React, { useEffect, useState } from 'react';
import { UploadCloud, Loader2 } from 'lucide-react';
import { Tab } from '../types';
import { type DuckDBRuntimeInfo } from '../services/duckdbService';
import { useDashboardWorkflow } from '../hooks/useDashboardWorkflow';
import { DashboardHero } from './Dashboard/DashboardHero';
import { DashboardKpiRow } from './Dashboard/DashboardKpiRow';
import { DashboardChartsRow } from './Dashboard/DashboardChartsRow';
import { DashboardRecentTables } from './Dashboard/DashboardRecentTables';
import { DashboardRecentQueries } from './Dashboard/DashboardRecentQueries';
import { DashboardQuickActions } from './Dashboard/DashboardQuickActions';
import { QuickTablePeekDrawer } from './Dashboard/QuickTablePeekDrawer';

export interface DashboardProps {
  tables: string[];
  onNavigate: (tab: Tab) => void;
  runtimeInfo?: DuckDBRuntimeInfo;
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
    displayQueries,
    growthTrendData,
    latencyTrendData,
    dbMetrics,
    peekTableName,
    handleOpenPeek,
    handleClosePeek,
    tableSearchTerm,
    setTableSearchTerm,
    querySearchTerm,
    setQuerySearchTerm,
    queryStatusFilter,
    setQueryStatusFilter,
    isRefreshing,
    lastRefreshedTime,
    handleRefresh,
    handleClearQueries,
    handleOpenBlankSql,
    growthMetric,
    setGrowthMetric,
    growthLimit,
    setGrowthLimit,
    latencyFilter,
    setLatencyFilter,
    tableTypeFilter,
    setTableTypeFilter,
    importState,
    handleImportFile,
    handleLoadDemo,
    handleDropTable,
    handleShrinkMemory,
    handleSelectTable: workflowSelectTable,
    handleSelectTableWithFilter: workflowSelectTableWithFilter,
    handleSelectTableStructure: workflowSelectTableStructure,
    handleSelectTableAnalysis: workflowSelectTableAnalysis,
    handleSelectTableMetrics: workflowSelectTableMetrics,
    handleSelectTableDataFlow: workflowSelectTableDataFlow,
    handleSelectQuery: workflowSelectQuery,
    handleQuickQuery,
    handleInspectIssue,
    setShowCreateModal,
    setShowImportModal,
    setShowSettingsModal,
    setShowExportModal,
  } = useDashboardWorkflow(tables, onNavigate, runtimeInfo, {
    onSelectTable,
    onSelectTableStructure,
    onSelectTableAnalysis,
    onSelectTableMetrics,
    onSelectTableDataFlow,
    onSelectQuery,
  });

  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Keyboard shortcut: Ctrl+Enter / Cmd+Enter to open SQL editor
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
    if (!isDraggingOver) {
      setIsDraggingOver(true);
    }
  };

  const handleGlobalDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only cancel if leaving the outer container
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingOver(false);
  };

  const handleGlobalDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleImportFile(file);
    }
  };

  return (
    <div
      onDragOver={handleGlobalDragOver}
      onDragLeave={handleGlobalDragLeave}
      onDrop={handleGlobalDrop}
      className="relative flex flex-col flex-1 h-full w-full overflow-y-auto bg-monokai-bg text-monokai-fg px-3.5 sm:px-5 lg:px-6 py-3 select-text custom-scrollbar space-y-3 sm:space-y-3.5 font-sans"
    >
      {/* Global Drag-and-Drop Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 bg-monokai-bg/90 backdrop-blur-xs border-2 border-dashed border-monokai-accent m-3 rounded-2xl flex flex-col items-center justify-center pointer-events-none animate-in fade-in duration-150 select-none">
          <div className="w-14 h-14 rounded-2xl bg-monokai-accent/10 border border-monokai-accent/30 flex items-center justify-center text-monokai-accent mb-2.5 shadow-[0_0_30px_rgba(166,226,46,0.3)]">
            <UploadCloud className="w-7 h-7 animate-bounce" />
          </div>
          <h3 className="text-sm sm:text-base font-bold text-monokai-fg tracking-wide">释放文件以即时解析导入</h3>
          <p className="text-[11px] text-monokai-comment mt-1 font-mono">
            支持 .csv, .xlsx, .xls, .parquet, .json, .arrow, .sqlite, .db, .tsv
          </p>
        </div>
      )}

      {/* Real-time Import / Dataset Ingestion Progress Notification */}
      {importState.status === 'importing' && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-monokai-surface border border-monokai-accent/40 shadow-lg text-xs font-mono animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <Loader2 className="w-4 h-4 text-monokai-accent animate-spin shrink-0" />
            <span className="text-monokai-fg">
              正在挂载并解析数据资产：
              <span className="text-monokai-accent font-bold ml-1">{importState.filename || '数据表'}</span>
            </span>
          </div>
          <span className="text-monokai-comment text-[11px]">WASM 内核流式处理中…</span>
        </div>
      )}

      {/* 1. Top Hero Section */}
      <DashboardHero
        onNavigate={onNavigate}
        onOpenImport={() => setShowImportModal(true)}
        onOpenCreate={() => setShowCreateModal(true)}
        onOpenSettings={() => setShowSettingsModal(true)}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        lastRefreshedTime={lastRefreshedTime}
        metrics={dbMetrics}
        runtimeInfo={runtimeInfo}
      />

      {/* 2. Key Metrics Row (6 Cards with Drilldown) */}
      <DashboardKpiRow
        metrics={dbMetrics}
        onNavigate={onNavigate}
        onShrinkMemory={handleShrinkMemory}
        onOpenSettings={() => setShowSettingsModal(true)}
      />

      {/* 3. Analytics Charts Row (3 Panels) */}
      <DashboardChartsRow
        growthData={growthTrendData}
        latencyData={latencyTrendData}
        metrics={dbMetrics}
        onNavigate={onNavigate}
        onInspectIssue={handleInspectIssue}
        onSelectTable={workflowSelectTable}
        onSelectTableStructure={workflowSelectTableStructure}
        onSelectTableWithFilter={workflowSelectTableWithFilter}
        growthMetric={growthMetric}
        onGrowthMetricChange={setGrowthMetric}
        growthLimit={growthLimit}
        onGrowthLimitChange={setGrowthLimit}
        latencyFilter={latencyFilter}
        onLatencyFilterChange={setLatencyFilter}
        tableTypeFilter={tableTypeFilter}
        onTableTypeFilterChange={setTableTypeFilter}
        onSelectTableAnalysis={workflowSelectTableAnalysis}
        onSelectTableMetrics={workflowSelectTableMetrics}
        onQuickQuery={handleQuickQuery}
      />

      {/* 4. Bottom Data Management Row (3 Panels) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 w-full min-h-[320px] pb-10">
        {/* Recent Tables with Search, Peek, Copy, Drop */}
        <DashboardRecentTables
          tables={displayTables}
          onSelectTable={workflowSelectTable}
          onNavigate={onNavigate}
          onSelectTableStructure={workflowSelectTableStructure}
          onSelectTableAnalysis={workflowSelectTableAnalysis}
          onSelectTableMetrics={workflowSelectTableMetrics}
          onSelectTableDataFlow={workflowSelectTableDataFlow}
          onQuickQuery={handleQuickQuery}
          onPeekTable={handleOpenPeek}
          searchTerm={tableSearchTerm}
          onSearchChange={setTableSearchTerm}
          typeFilter={tableTypeFilter}
          onTypeFilterChange={setTableTypeFilter}
          onDropTable={handleDropTable}
        />

        {/* Recent Queries with Search, Status Filter, Copy SQL, Clear */}
        <DashboardRecentQueries
          queries={displayQueries}
          onSelectQuery={workflowSelectQuery}
          onExecuteQueryDirectly={(sql) => workflowSelectQuery(sql, true)}
          onNavigate={onNavigate}
          searchTerm={querySearchTerm}
          onSearchChange={setQuerySearchTerm}
          statusFilter={queryStatusFilter}
          onStatusFilterChange={setQueryStatusFilter}
          latencyFilter={latencyFilter}
          onLatencyFilterChange={setLatencyFilter}
          onClearQueries={handleClearQueries}
        />

        {/* Quick Actions Matrix with Export and Scratchpad */}
        <DashboardQuickActions
          onImportFile={handleImportFile}
          onOpenImportModal={() => setShowImportModal(true)}
          onOpenCreateModal={() => setShowCreateModal(true)}
          onOpenBlankSql={handleOpenBlankSql}
          onOpenExportModal={() => setShowExportModal(true)}
          onLoadDemo={handleLoadDemo}
          onOpenSettings={() => setShowSettingsModal(true)}
          onNavigate={onNavigate}
        />
      </div>

      {/* 5. Quick Table Peek Drawer (Zero-jump table inspection) */}
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
