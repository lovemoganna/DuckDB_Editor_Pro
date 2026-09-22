import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  FlaskConical,
  Layers,
  RefreshCw,
  Sparkles,
  UploadCloud,
  LayoutDashboard,
  Table2,
  Activity,
  BarChart3,
  TrendingUp,
  Zap,
  BookOpen,
} from 'lucide-react';
import { useAppStore } from '../../hooks/store/useAppStore';
import { useSqlEditorStore } from '../../hooks/store/useSqlEditorStore';
import { Tab, ColumnInfo } from '../../types';
import type { DuckDBRuntimeInfo } from '../../services/duckdbService';
import { duckDBService } from '../../services/duckdbService';
import { seedDemoWorkbenchData } from '../Workbench/seedWorkbenchData';
import { toastService } from '../../services/toastService';
import { PageHeader, SegmentedTabs, ActionButton } from '../ui/Workbench';
import { AH, AnalysisLoadingState } from './analysisUi';

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
  onNavigateToDashboard,
}) => {
  const tables = useAppStore(s => s.tables);
  const currentTable = useAppStore(s => s.currentTable);
  const setCurrentTable = useAppStore(s => s.setCurrentTable);
  const setTables = useAppStore(s => s.setTables);
  const setActiveTab = useAppStore(s => s.setActiveTab);
  const setShowImportModal = useAppStore(s => s.setShowImportModal);

  const [activeSubView, setActiveSubView] = useState<AnalysisHubSubView>(() => {
    try {
      const stored = localStorage.getItem(SUBVIEW_STORAGE_KEY) as AnalysisHubSubView;
      if (stored && ANALYSIS_VIEWS.some(v => v.value === stored)) {
        return stored;
      }
    } catch {
      /* ignore */
    }
    return 'profiler';
  });

  const [selectedTable, setSelectedTable] = useState<string>(currentTable || tables[0] || '');
  const [schema, setSchema] = useState<ColumnInfo[]>([]);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [isSeedingDemo, setIsSeedingDemo] = useState(false);

  const [targetDimension, setTargetDimension] = useState<string | undefined>(undefined);
  const [targetTimeColumn, setTargetTimeColumn] = useState<string | undefined>(undefined);

  const handleSetSubView = (view: AnalysisHubSubView) => {
    setActiveSubView(view);
    try {
      localStorage.setItem(SUBVIEW_STORAGE_KEY, view);
    } catch {
      /* ignore */
    }
  };

  // If opened with SQL payload, land on templates for apply/edit continuity
  useEffect(() => {
    if (initialSql && initialSql.trim()) {
      handleSetSubView('templates');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (currentTable && tables.includes(currentTable)) {
      setSelectedTable(currentTable);
    } else if (tables.length > 0 && (!selectedTable || !tables.includes(selectedTable))) {
      setSelectedTable(tables[0]);
    }
  }, [currentTable, tables, selectedTable]);

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
      toastService.success('数据表列表已刷新');
    } catch (err) {
      console.error(err);
      toastService.error('刷新表列表失败');
    }
  };

  const handleSeedDemoData = async () => {
    setIsSeedingDemo(true);
    try {
      await seedDemoWorkbenchData();
      const tList = await duckDBService.getTables();
      setTables(tList);
      if (tList.length > 0) {
        setSelectedTable(tList[0]);
        setCurrentTable(tList[0]);
        await loadSchema(tList[0]);
      }
      toastService.success('已载入电商分析示例数据集 (orders / customers / products)');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toastService.error(`载入示例数据集失败: ${msg}`);
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

  const handleNavigateToPivot = (column: string) => {
    setTargetDimension(column);
    handleSetSubView('pivot');
  };

  const handleNavigateToTimeSeries = (column: string) => {
    setTargetTimeColumn(column);
    handleSetSubView('timeseries');
  };

  // One-shot seeds: keep for the destination mount, then clear so table switches don't re-apply
  useEffect(() => {
    if (activeSubView === 'pivot' && targetDimension) {
      const id = window.setTimeout(() => setTargetDimension(undefined), 0);
      return () => window.clearTimeout(id);
    }
    if (activeSubView === 'timeseries' && targetTimeColumn) {
      const id = window.setTimeout(() => setTargetTimeColumn(undefined), 0);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [activeSubView, targetDimension, targetTimeColumn]);

  const needsTable = activeSubView !== 'templates';
  const showEmptyState = tables.length === 0 && needsTable;
  const showSchemaLoading = !showEmptyState && needsTable && loadingSchema && schema.length === 0 && Boolean(selectedTable);

  return (
    <div className={AH.root}>
      <PageHeader
        title="分析中心"
        description="多维透视 · 时序走势 · 业务配方 · SQL 模板 · DuckDB 本地内核"
        icon={FlaskConical}
        tone="accent"
        actions={
          <div className="flex items-center gap-2">
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

            {tables.length > 0 && (
              <div className="flex items-center gap-1.5 h-8 rounded-md border border-monokai-border bg-monokai-surface px-2 text-meta shadow-xs">
                <Database className="h-3.5 w-3.5 text-monokai-comment" aria-hidden="true" />
                <span className="text-2xs text-monokai-comment font-mono hidden sm:inline">分析表</span>
                <select
                  value={selectedTable}
                  onChange={e => handleTableChange(e.target.value)}
                  className="rounded-md border border-transparent bg-transparent font-mono font-semibold text-monokai-fg hover:border-monokai-border/60 focus:border-monokai-accent focus:outline-none cursor-pointer text-meta max-w-[140px]"
                  aria-label="选择分析表"
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
                  className={AH.iconBtn}
                >
                  <RefreshCw className={`h-3 w-3 ${loadingSchema ? 'animate-spin' : ''}`} aria-hidden="true" />
                </button>
              </div>
            )}

            {selectedTable && (
              <div className="hidden xl:flex items-center gap-1.5 border-l border-monokai-border/70 pl-2">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentTable(selectedTable);
                    setActiveTab(Tab.DATA);
                  }}
                  className={`${AH.btnGhost} text-monokai-cyan`}
                  title="在数据网格中浏览当前表"
                >
                  <Table2 className="h-3 w-3" aria-hidden="true" />
                  <span>数据网格</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentTable(selectedTable);
                    setActiveTab(Tab.STRUCTURE);
                  }}
                  className={`${AH.btnGhost} text-monokai-yellow`}
                  title="查看当前表结构及约束"
                >
                  <Layers className="h-3 w-3" aria-hidden="true" />
                  <span>表结构</span>
                </button>
              </div>
            )}

            <SegmentedTabs
              aria-label="分析工具模式"
              value={activeSubView}
              items={ANALYSIS_VIEWS}
              size="sm"
              tone="accent"
              onChange={handleSetSubView}
            />
          </div>
        }
      />

      <div className="flex-1 overflow-hidden relative">
        {showEmptyState ? (
          <div className="flex h-full flex-col items-center justify-center p-4 text-center text-monokai-fg">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md border border-monokai-border bg-monokai-surface text-monokai-comment">
              <FlaskConical className="h-5 w-5" aria-hidden="true" />
            </div>
            <h3 className="text-meta font-bold tracking-tight text-monokai-fg">暂无数据表可分析</h3>
            <p className="mt-1.5 max-w-md text-2xs text-monokai-comment leading-relaxed">
              载入示例电商数据集，或导入 CSV / Parquet，即可使用体检、透视、时序与业务配方。
            </p>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={handleSeedDemoData}
                disabled={isSeedingDemo}
                className={AH.btnSuccess}
              >
                {isSeedingDemo ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>载入示例数据集</span>
              </button>
              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className={AH.btnGhost}
              >
                <UploadCloud className="h-3.5 w-3.5 text-monokai-comment" aria-hidden="true" />
                <span>导入 CSV / Parquet</span>
              </button>
              <button
                type="button"
                onClick={() => handleSetSubView('templates')}
                className={AH.btnGhost}
              >
                <BookOpen className="h-3.5 w-3.5 text-monokai-comment" aria-hidden="true" />
                <span>先浏览 SQL 模板</span>
              </button>
            </div>
          </div>
        ) : showSchemaLoading ? (
          <AnalysisLoadingState message={`正在读取表结构 [${selectedTable}]…`} />
        ) : (
          <>
            {activeSubView === 'profiler' && (
              <AnalysisProfiler
                currentTable={selectedTable}
                schema={schema}
                onNavigateToPivot={handleNavigateToPivot}
                onNavigateToTimeSeries={handleNavigateToTimeSeries}
                onInsertSql={handleExecuteSql}
              />
            )}
            {activeSubView === 'pivot' && (
              <AnalysisPivotWorkbench
                currentTable={selectedTable}
                schema={schema}
                initialDimension={targetDimension}
                onInsertSql={handleExecuteSql}
              />
            )}
            {activeSubView === 'timeseries' && (
              <AnalysisTimeSeries
                currentTable={selectedTable}
                schema={schema}
                initialTimeColumn={targetTimeColumn}
                onInsertSql={handleExecuteSql}
              />
            )}
            {activeSubView === 'recipes' && (
              <AnalysisRecipeCenter
                currentTable={selectedTable}
                schema={schema}
                onInsertSql={handleExecuteSql}
              />
            )}
            {activeSubView === 'templates' && (
              <VisualSqlDashboard
                onInsertSql={handleExecuteSql}
                currentTable={selectedTable || undefined}
                columnNames={schema.map(c => c.name)}
                initialSql={initialSql}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AnalysisHubPanel;
