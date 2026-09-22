import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity,
  BarChart3,
  Database,
  FlaskConical,
  Layers,
  Play,
  RefreshCw,
  Sparkles,
  Terminal,
  TrendingUp,
  Zap,
  BookOpen,
  ChevronDown,
  UploadCloud,
  LayoutDashboard,
  Table2,
} from 'lucide-react';
import { useAppStore } from '../../hooks/store/useAppStore';
import { useSqlEditorStore } from '../../hooks/store/useSqlEditorStore';
import { Tab, ColumnInfo } from '../../types';
import type { DuckDBRuntimeInfo } from '../../services/duckdbService';
import { duckDBService } from '../../services/duckdbService';
import { seedDemoWorkbenchData } from '../Workbench/seedWorkbenchData';
import { toastService } from '../../services/toastService';
import { PageHeader, SegmentedTabs, ActionButton } from '../ui/Workbench';

// Subviews
import { AnalysisProfiler } from './AnalysisProfiler';
import { AnalysisPivotWorkbench } from './AnalysisPivotWorkbench';
import { AnalysisTimeSeries } from './AnalysisTimeSeries';
import { AnalysisRecipeCenter } from './AnalysisRecipeCenter';
import { VisualSqlDashboard } from '../SqlTemplates/VisualSqlDashboard';

export type AnalysisHubSubView = 'profiler' | 'pivot' | 'timeseries' | 'recipes' | 'templates';

const SUBVIEW_STORAGE_KEY = 'analysis_hub_active_subview_v2';

const ANALYSIS_VIEWS = [
  { value: 'profiler' as const, label: '数据体检', icon: Activity },
  { value: 'pivot' as const, label: '透视聚合', icon: BarChart3 },
  { value: 'timeseries' as const, label: '时序分析', icon: TrendingUp },
  { value: 'recipes' as const, label: '场景配方', icon: Zap },
  { value: 'templates' as const, label: 'SQL 模板', icon: BookOpen },
];

interface AnalysisHubPanelProps {
  initialSql?: string;
  onInsertSql?: (sql: string, executeDirectly?: boolean) => void;
  runtimeInfo?: DuckDBRuntimeInfo;
  onNavigateToDashboard?: () => void;
}

export const AnalysisHubPanel: React.FC<AnalysisHubPanelProps> = ({
  initialSql,
  onInsertSql,
  runtimeInfo,
  onNavigateToDashboard,
}) => {
  // Global Store
  const tables = useAppStore(s => s.tables);
  const currentTable = useAppStore(s => s.currentTable);
  const setCurrentTable = useAppStore(s => s.setCurrentTable);
  const setTables = useAppStore(s => s.setTables);
  const setActiveTab = useAppStore(s => s.setActiveTab);
  const setShowImportModal = useAppStore(s => s.setShowImportModal);

  // Subview State
  const [activeSubView, setActiveSubView] = useState<AnalysisHubSubView>(() => {
    try {
      const stored = localStorage.getItem(SUBVIEW_STORAGE_KEY) as AnalysisHubSubView;
      if (stored && ['profiler', 'pivot', 'timeseries', 'recipes', 'templates'].includes(stored)) {
        return stored;
      }
    } catch {}
    return 'profiler';
  });

  // Table Schema State
  const [selectedTable, setSelectedTable] = useState<string>(currentTable || tables[0] || '');
  const [schema, setSchema] = useState<ColumnInfo[]>([]);
  const [loadingSchema, setLoadingSchema] = useState<boolean>(false);
  const [isSeedingDemo, setIsSeedingDemo] = useState<boolean>(false);

  // Inter-view carryover parameters
  const [targetDimension, setTargetDimension] = useState<string | undefined>(undefined);
  const [targetTimeColumn, setTargetTimeColumn] = useState<string | undefined>(undefined);

  // Keep selected table synced
  useEffect(() => {
    if (currentTable && tables.includes(currentTable)) {
      setSelectedTable(currentTable);
    } else if (tables.length > 0 && (!selectedTable || !tables.includes(selectedTable))) {
      setSelectedTable(tables[0]);
    }
  }, [currentTable, tables]);

  // Load Schema on table change
  const loadSchema = useCallback(async (tableName: string) => {
    if (!tableName) {
      setSchema([]);
      return;
    }
    setLoadingSchema(true);
    try {
      const s = await duckDBService.getTableSchema(tableName);
      setSchema(s || []);
    } catch (err) {
      console.warn(`[AnalysisHub] Failed to load schema for ${tableName}:`, err);
      setSchema([]);
    } finally {
      setLoadingSchema(false);
    }
  }, []);

  useEffect(() => {
    if (selectedTable) {
      void loadSchema(selectedTable);
    }
  }, [selectedTable, loadSchema]);

  const handleSetSubView = (view: AnalysisHubSubView) => {
    setActiveSubView(view);
    try {
      localStorage.setItem(SUBVIEW_STORAGE_KEY, view);
    } catch {}
  };

  const handleTableChange = (newTableName: string) => {
    setSelectedTable(newTableName);
    setCurrentTable(newTableName);
  };

  const handleRefreshTables = async () => {
    try {
      const tList = await duckDBService.getTables();
      setTables(tList);
      if (tList.length > 0 && (!selectedTable || !tList.includes(selectedTable))) {
        setSelectedTable(tList[0]);
        setCurrentTable(tList[0]);
      }
      if (selectedTable) {
        await loadSchema(selectedTable);
      }
      toastService.success('数据表列表已刷新！');
    } catch (err) {
      console.error(err);
    }
  };

  const handleSeedDemoData = async () => {
    setIsSeedingDemo(true);
    try {
      await seedDemoWorkbenchData();
      const tList = await duckDBService.getTables();
      if (tList.length > 0) {
        setSelectedTable(tList[0]);
        setCurrentTable(tList[0]);
        await loadSchema(tList[0]);
      }
      toastService.success('🚀 已成功载入全真电商分析数据集 (orders/customers/products)！');
    } catch (err: any) {
      toastService.error(`载入示例数据集失败: ${err?.message || String(err)}`);
    } finally {
      setIsSeedingDemo(false);
    }
  };

  const handleExecuteSql = (sql: string, executeDirectly = false) => {
    if (onInsertSql) {
      onInsertSql(sql, executeDirectly);
      return;
    }
    useSqlEditorStore.getState().updateActiveTab({ code: sql });
    setActiveTab(Tab.SQL);
  };

  // Profile jumps to Pivot
  const handleNavigateToPivot = (column: string) => {
    setTargetDimension(column);
    handleSetSubView('pivot');
  };

  // Profile jumps to TimeSeries
  const handleNavigateToTimeSeries = (column: string) => {
    setTargetTimeColumn(column);
    handleSetSubView('timeseries');
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-monokai-bg font-sans">
      {/* Top Universal Page Header */}
      <PageHeader
        title="分析中心 (Analysis Hub)"
        description="开箱即用的多维透视、时序走势与业务建模工作台 • 毫秒级 DuckDB 本地内核直出"
        icon={FlaskConical}
        actions={
          <div className="flex items-center gap-3">
            {onNavigateToDashboard && (
              <ActionButton
                variant="ghost"
                size="sm"
                icon={LayoutDashboard}
                onClick={onNavigateToDashboard}
                title="返回首页仪表盘"
              >
                仪表盘
              </ActionButton>
            )}

            {/* Table Context Selector */}
            {tables.length > 0 && (
              <div className="flex items-center gap-1.5 h-8 rounded-md border border-monokai-border bg-monokai-surface px-2.5 text-xs">
                <Database className="h-3.5 w-3.5 text-monokai-comment" />
                <span className="text-[10px] text-monokai-comment font-mono">当前分析表:</span>
                <select
                  value={selectedTable}
                  onChange={e => handleTableChange(e.target.value)}
                  className="rounded border border-transparent bg-transparent font-mono font-bold text-monokai-fg hover:border-monokai-border/60 focus:border-monokai-accent focus:outline-none cursor-pointer text-xs"
                >
                  {tables.map(t => (
                    <option key={t} value={t} className="bg-monokai-surface text-monokai-fg">
                      {t}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  title="刷新数据表结构"
                  onClick={handleRefreshTables}
                  className="p-1 rounded text-monokai-comment hover:text-monokai-fg hover:bg-monokai-bg transition-colors"
                >
                  <RefreshCw className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Cross-Module Quick Links */}
            {selectedTable && (
              <div className="hidden 2xl:flex items-center gap-1.5 border-l border-monokai-border/70 pl-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentTable(selectedTable);
                    setActiveTab(Tab.DATA);
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border text-[11px] text-monokai-cyan cursor-pointer transition-colors"
                  title="在数据网格中浏览当前表"
                >
                  <Table2 size={11} />
                  <span>数据网格 ↗</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentTable(selectedTable);
                    setActiveTab(Tab.STRUCTURE);
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border text-[11px] text-monokai-yellow cursor-pointer transition-colors"
                  title="查看当前表结构及约束"
                >
                  <Layers size={11} />
                  <span>结构设计 ↗</span>
                </button>
              </div>
            )}

            {/* Subview Navigation Tabs */}
            <SegmentedTabs
              aria-label="分析工具模式"
              value={activeSubView}
              items={ANALYSIS_VIEWS}
              size="md"
              onChange={handleSetSubView}
            />
          </div>
        }
      />

      {/* Main Workspace Body */}
      <div className="flex-1 overflow-hidden relative">
        {/* Zero-State Empty State when no tables in DuckDB */}
        {tables.length === 0 && activeSubView !== 'templates' ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center text-monokai-fg">
            <div className="relative mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-md border border-monokai-border bg-monokai-surface text-monokai-comment">
                <FlaskConical className="h-6 w-6 text-monokai-comment" />
              </div>
            </div>

            <h3 className="text-base font-bold tracking-tight text-monokai-fg">
              当前 DuckDB 数据库中暂无数据表
            </h3>
            <p className="mt-1.5 max-w-md text-xs text-monokai-comment leading-relaxed">
              分析中心已准备就绪。您可以 1 秒载入包含 orders、customers、products 的全真多维电商数据集，即可立即体验即时体检、多维透视、时序走势与业务配方四大工作台。
            </p>

            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={handleSeedDemoData}
                disabled={isSeedingDemo}
                className="flex items-center gap-2 h-8 rounded-md bg-monokai-green px-4 font-semibold text-xs text-monokai-bg hover:bg-monokai-green/90 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSeedingDemo ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 fill-current" />
                )}
                <span>1秒载入全真电商分析数据集</span>
              </button>

              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-1.5 h-8 rounded-md border border-monokai-border bg-monokai-elevated px-3.5 font-medium text-xs text-monokai-fg hover:bg-monokai-hover hover:border-monokai-border-strong transition-colors cursor-pointer"
              >
                <UploadCloud className="h-4 w-4 text-monokai-comment" />
                <span>导入外部 CSV / Parquet</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* View 1: 即时数据体检 */}
            {activeSubView === 'profiler' && (
              <AnalysisProfiler
                currentTable={selectedTable}
                schema={schema}
                onNavigateToPivot={handleNavigateToPivot}
                onNavigateToTimeSeries={handleNavigateToTimeSeries}
                onInsertSql={handleExecuteSql}
              />
            )}

            {/* View 2: 交互透视聚合 */}
            {activeSubView === 'pivot' && (
              <AnalysisPivotWorkbench
                currentTable={selectedTable}
                schema={schema}
                initialDimension={targetDimension}
                onInsertSql={handleExecuteSql}
              />
            )}

            {/* View 3: 时序走势分析 */}
            {activeSubView === 'timeseries' && (
              <AnalysisTimeSeries
                currentTable={selectedTable}
                schema={schema}
                initialTimeColumn={targetTimeColumn}
                onInsertSql={handleExecuteSql}
              />
            )}

            {/* View 4: 业务分析配方 */}
            {activeSubView === 'recipes' && (
              <AnalysisRecipeCenter
                currentTable={selectedTable}
                schema={schema}
                onInsertSql={handleExecuteSql}
              />
            )}

            {/* View 5: SQL 模板与资产库 */}
            {activeSubView === 'templates' && (
              <VisualSqlDashboard onInsertSql={handleExecuteSql} />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AnalysisHubPanel;
