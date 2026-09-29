import React, { useState } from 'react';
import { Tab, QueryHistoryItem } from '../../../types';
import { type DuckDBRuntimeInfo } from '../../../services/duckdbService';
import {
  type TableItemDetail,
  type RecentQueryDisplayItem,
  type DashboardDbMetrics,
  type RecentImportItem,
  type GrowthTrendItem,
  type LatencyTrendItem,
} from '../../../hooks/useDashboardWorkflow';
import { MissionControlTopStrip } from './MissionControlTopStrip';
import { MissionControlKpis } from './MissionControlKpis';
import { DataAssetTopologyView } from './DataAssetTopologyView';
import { LiveQueryStream } from './LiveQueryStream';
import { ActionLaunchpad } from './ActionLaunchpad';
import { PerformanceTrendStrip } from './PerformanceTrendStrip';
import { useCopilotStore } from '../../../hooks/store/useCopilotStore';
import { CyberGridBackground, DataPipelineStreamIllustration } from './DashboardSvgIllustrations';

export interface DataIdeMissionControlProps {
  tables: TableItemDetail[];
  queries: RecentQueryDisplayItem[];
  allHistoryItems?: QueryHistoryItem[];
  recentImports?: RecentImportItem[];
  growthData?: GrowthTrendItem[];
  latencyData?: LatencyTrendItem[];
  metrics: DashboardDbMetrics;
  runtimeInfo?: DuckDBRuntimeInfo;
  onNavigate: (tab: Tab) => void;
  onSelectTable?: (tableName: string) => void;
  onSelectTableStructure?: (tableName: string, focusTab?: 'profile' | 'add' | 'ddl') => void;
  onSelectTableAnalysis?: (tableName: string) => void;
  onSelectTableMetrics?: (tableName: string) => void;
  onPeekTable?: (tableName: string) => void;
  onQuickQuery?: (tableName: string) => void;
  onSelectQuery?: (sql: string, executeDirectly?: boolean) => void;
  onOpenImport: () => void;
  onOpenCreate: () => void;
  onOpenSettings: () => void;
  onOpenExport?: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
  onShrinkMemory?: () => void;
  onToggleLayoutMode?: () => void;
}

export const DataIdeMissionControl: React.FC<DataIdeMissionControlProps> = ({
  tables = [],
  queries = [],
  allHistoryItems = [],
  recentImports = [],
  growthData = [],
  latencyData = [],
  metrics,
  runtimeInfo,
  onNavigate,
  onSelectTable,
  onSelectTableStructure,
  onSelectTableAnalysis,
  onSelectTableMetrics,
  onPeekTable,
  onQuickQuery,
  onSelectQuery,
  onOpenImport,
  onOpenCreate,
  onOpenSettings,
  onOpenExport,
  onRefresh,
  isRefreshing = false,
  onShrinkMemory,
  onToggleLayoutMode,
}) => {
  const [streamStatusFilter, setStreamStatusFilter] = useState<'all' | 'success' | 'error' | 'slow'>('all');
  const [highlightedQueryId, setHighlightedQueryId] = useState<string | null>(null);

  const handleSelectQueryPoint = (id: string, _sql: string) => {
    setHighlightedQueryId(id);
    const target = queries.find((q) => q.id === id);
    if (target) {
      if (target.status === 'error' && streamStatusFilter === 'success') {
        setStreamStatusFilter('all');
      } else if (target.status === 'success' && streamStatusFilter === 'error') {
        setStreamStatusFilter('all');
      }
    }
  };

  const handleFilterErrorQueries = () => {
    setStreamStatusFilter('error');
    const firstError = queries.find((q) => q.status === 'error');
    if (firstError) {
      setHighlightedQueryId(firstError.id);
    }
  };

  const handleFilterSlowQueries = () => {
    setStreamStatusFilter('slow');
    const firstSlow = queries.find((q) => {
      const ms = q.executionTime ?? (parseFloat(q.duration) || 0);
      return ms >= 200;
    });
    if (firstSlow) {
      setHighlightedQueryId(firstSlow.id);
    }
  };

  return (
    <div className="relative flex flex-col w-full space-y-3.5 font-sans pb-10">
      {/* 全局微网格与柔和氛围光晕底图 */}
      <CyberGridBackground />

      <div className="relative z-10 flex flex-col w-full space-y-3.5">
        {/* 1. 一体化沉浸式 Modern Cyber Hero 展台 */}
        <MissionControlTopStrip
          metrics={metrics}
          tables={tables}
          runtimeInfo={runtimeInfo}
          onNavigate={onNavigate}
          onSelectQuery={onSelectQuery}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
          onOpenAiChat={() => useCopilotStore.getState().setIsOpen(true)}
          onFilterErrorQueries={handleFilterErrorQueries}
          onFilterSlowQueries={handleFilterSlowQueries}
          onSelectTableStructure={onSelectTableStructure}
          onShrinkMemory={onShrinkMemory}
          onOpenImport={onOpenImport}
          onToggleLayoutMode={onToggleLayoutMode}
        />

        {/* 2. 六大核心 KPI 态势卡片 (内置半透明矢量浮雕水印与动态微图) */}
        <MissionControlKpis
          metrics={metrics}
          tables={tables}
          allHistoryItems={allHistoryItems}
          onNavigate={onNavigate}
          onShrinkMemory={onShrinkMemory}
          onOpenSettings={onOpenSettings}
        />

        {/* 2.5 数据流导管与计算架构脉络图示 (SVG 渲染美化链路：数据源接入 → DuckDB 向量执行 → OLAP 洞察) */}
        <div className="hidden lg:flex items-center justify-between rounded-xl border border-monokai-border bg-gradient-to-r from-monokai-surface/90 via-monokai-surface/60 to-monokai-surface/90 px-4 py-2 backdrop-blur-xs shadow-xs">
          <div className="flex items-center gap-2.5 text-xs font-mono text-monokai-fg-muted shrink-0">
            <span className="flex h-2 w-2 rounded-full bg-monokai-accent animate-pulse" />
            <span className="font-bold text-monokai-fg">数据流水线态势</span>
            <span className="rounded bg-monokai-elevated px-1.5 py-0.5 text-[10px] text-monokai-cyan border border-monokai-border">
              零网络开销 · 内存即席执行
            </span>
          </div>
          <div className="flex-1 max-w-[480px] h-8 mx-4">
            <DataPipelineStreamIllustration className="w-full h-full" />
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono text-monokai-comment shrink-0">
            <span className="text-monokai-accent font-semibold">DuckDB WASM 列式计算</span>
            <span className="text-monokai-border">|</span>
            <span className="text-monokai-yellow">向量化流水线</span>
          </div>
        </div>

        {/* 3. 主作业区分栏：数据资产 (5 Cols) + 查询脉搏 (4 Cols) + 行动发射台 (3 Cols) */}
        <div className="grid w-full grid-cols-1 gap-3.5 xl:grid-cols-12 items-stretch">
          {/* 数据资产核心视图 */}
          <div className="flex flex-col xl:col-span-5 h-full min-h-[530px]">
            <DataAssetTopologyView
              tables={tables}
              metrics={metrics}
              recentImports={recentImports}
              onSelectTable={onSelectTable}
              onSelectTableStructure={onSelectTableStructure}
              onSelectTableAnalysis={onSelectTableAnalysis}
              onSelectTableMetrics={onSelectTableMetrics}
              onPeekTable={onPeekTable}
              onQuickQuery={onQuickQuery}
              onNavigate={onNavigate}
              onOpenCreate={onOpenCreate}
              onOpenImport={onOpenImport}
            />
          </div>

          {/* 实时查询流水线 */}
          <div className="flex flex-col xl:col-span-4 h-full min-h-[530px]">
            <LiveQueryStream
              queries={queries}
              controlledFilter={streamStatusFilter}
              onFilterChange={setStreamStatusFilter}
              highlightedQueryId={highlightedQueryId}
              onSelectQuery={(sql) => onSelectQuery?.(sql)}
              onExecuteQueryDirectly={(sql) => onSelectQuery?.(sql, true)}
              onNavigate={onNavigate}
            />
          </div>

          {/* 智能行动发射台 */}
          <div className="flex flex-col xl:col-span-3 h-full min-h-[530px]">
            <ActionLaunchpad
              tables={tables}
              onNavigate={onNavigate}
              onOpenImport={onOpenImport}
              onOpenCreate={onOpenCreate}
              onOpenExport={onOpenExport}
              onOpenAiChat={() => useCopilotStore.getState().setIsOpen(true)}
              onSelectQuery={onSelectQuery}
              lastFailedSql={queries.find((q) => q.status === 'error')?.sql}
              metrics={metrics}
              onRefresh={onRefresh}
              isRefreshing={isRefreshing}
            />
          </div>
        </div>

        {/* 4. 底层性能与吞吐遥测条 */}
        <PerformanceTrendStrip
          metrics={metrics}
          allHistoryItems={allHistoryItems}
          recentImports={recentImports}
          growthData={growthData}
          latencyData={latencyData}
          onSelectQueryPoint={handleSelectQueryPoint}
        />
      </div>
    </div>
  );
};
