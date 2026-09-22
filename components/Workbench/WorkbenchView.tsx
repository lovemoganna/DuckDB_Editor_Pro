import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DataExplorerPanel } from './DataExplorerPanel';
import { SqlWorkspacePanel, SqlQueryTab } from './SqlWorkspacePanel';
import { InspectorPanel, TableProfileData } from './InspectorPanel';
import { AiAssistantPanel } from './AiAssistantPanel';
import { WorkbenchStatusBar } from './WorkbenchStatusBar';
import { WorkbenchFeedbackModal } from './WorkbenchFeedbackModal';
import { RuntimeCenterModal } from './RuntimeCenterModal';
import { CommandPaletteModal } from './CommandPaletteModal';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { WorkspaceRecoveryModal } from './WorkspaceRecoveryModal';
import { duckDBService, type DuckDBRuntimeInfo } from '../../services/duckdbService';
import { queryExecutionService } from '../../services/workbench/queryExecutionService';
import { querySnapshotManager } from '../../services/workbench/querySnapshotManager';
import { columnProfiler } from '../../services/workbench/columnProfiler';
import { transformationEngine } from '../../services/workbench/transformationEngine';
import type { QueryResult, ColumnInfo, ObjectRef } from '../../types';
import type { ColumnAiProfile } from '../../types/ai';
import { aiService } from '../../services/aiService';
import { exportCsv, exportJson, downloadBlob } from '../../utils/sqlExporter';
import {
  PanelLeft,
  PanelLeftOpen,
  PanelLeftClose,
  PanelRight,
  ChevronUp,
  ChevronDown,
  History,
  AlertCircle,
  Database,
  Activity,
  X,
  Upload,
  Sparkles,
  FolderPlus,
} from 'lucide-react';
import { toastService } from '../../services/toastService';
import { useAppStore } from '../../hooks/store/useAppStore';
import { useWorkflowStore } from '../../services/dataflow/workflowStore';

interface WorkbenchViewProps {
  tables: string[];
  currentTable: string | null;
  runtimeInfo: DuckDBRuntimeInfo;
  onRefreshTables: () => Promise<void>;
  onSelectTable: (name: string) => void;
  onOpenFile: () => void;
  onAttachDatabase: () => void;
  onAddDataSource: () => void;
  schema?: ColumnInfo[];
  profileData?: any;
  initialDataFlowActive?: boolean;
  onNavigateToDataFlow?: () => void;
}

export const WorkbenchView: React.FC<WorkbenchViewProps> = ({
  tables,
  currentTable = '',
  runtimeInfo,
  onRefreshTables,
  onSelectTable,
  onOpenFile,
  onAttachDatabase,
  onAddDataSource,
  schema = [],
  initialDataFlowActive = false,
  onNavigateToDataFlow,
}) => {
  // DataFlow Canvas integration within SQL tab (split mode)
  const [isDataFlowActive, setIsDataFlowActive] = useState<boolean>(initialDataFlowActive);

  // Panel dimensions and collapse state — left sidebar sized so table names (e.g. life_introspection) stay readable
  const [leftWidth, setLeftWidth] = useState<number>(320);
  const [rightWidth, setRightWidth] = useState<number>(500);
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(true);
  const [isRightCollapsed, setIsRightCollapsed] = useState(true);

  // Dragging state
  const [isDraggingLeft, setIsDraggingLeft] = useState<boolean>(false);
  const [isDraggingRight, setIsDraggingRight] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const leftPanelTriggerRef = useRef<HTMLButtonElement>(null);
  const rightPanelTriggerRef = useRef<HTMLButtonElement>(null);
  const lastInjectedRef = useRef<{ sql: string; time: number } | null>(null);

  // Preserve the three-column desktop workflow while keeping the editor usable on narrow screens.
  useEffect(() => {
    const collapseForViewport = () => {
      if (window.innerWidth < 768) {
        setIsLeftCollapsed(true);
        setIsRightCollapsed(true);
      } else if (window.innerWidth < 1200) {
        setIsRightCollapsed(true);
      }
    };
    collapseForViewport();
    window.addEventListener('resize', collapseForViewport);
    return () => window.removeEventListener('resize', collapseForViewport);
  }, []);

  // Right panel mode: Column Inspector (default) or AI Assistant ('explain' | 'analyze')
  const [rightPanelMode, setRightPanelMode] = useState<'ai' | 'inspector'>('inspector');
  const [aiSubTab, setAiSubTab] = useState<'explain' | 'analyze'>('explain');

  // Global Store integration
  const pendingSql = useAppStore(s => s.pendingSql);
  const setPendingSql = useAppStore(s => s.setPendingSql);

  // Inspector Mode & Selection Sync
  const [selectedColumnName, setSelectedColumnName] = useState<string | null>(null);
  const [activeTableProfile, setActiveTableProfile] = useState<TableProfileData | null>(null);

  // T-06: AI Column Profile — 全局面板状态（跨 AiAssistantPanel + InspectorPanel 共享）
  const [columnAiProfiles, setColumnAiProfiles] = useState<Map<string, ColumnAiProfile>>(new Map());
  const [isProfilingColumn, setIsProfilingColumn] = useState<boolean>(false);
  const [columnProfileError, setColumnProfileError] = useState<string | null>(null);
  const profileDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileCallIdRef = useRef<number>(0);

  // Catalog & Schema context
  const [catalogContext, setCatalogContext] = useState<{ catalog: string; schema: string }>({
    catalog: 'duckdb_manager_workspace',
    schema: 'main',
  });

  // Workspace Recovery Dialog state (silent by default, manually summonable if needed)
  const [showRecoveryDialog, setShowRecoveryDialog] = useState<boolean>(false);

  // Runtime Center Modal state (已抽取为独立组件，状态移入 RuntimeCenterModal)
  const [showRuntimeCenterModal, setShowRuntimeCenterModal] = useState<boolean>(false);

  // Command Palette state (已抽取为独立组件，状态移入 CommandPaletteModal)
  const [showCommandPalette, setShowCommandPalette] = useState<boolean>(false);

  // Project Manager Modal state
  const [showProjectsModal, setShowProjectsModal] = useState<boolean>(false);

  // Linear Feedback & Issue Tracking Modal state
  const [showFeedbackModal, setShowFeedbackModal] = useState<boolean>(false);

  // Query Tabs state
  const [tabs, setTabs] = useState<SqlQueryTab[]>(() => {
    try {
      const snapJson = localStorage.getItem('workbench_workspace_snapshot');
      if (snapJson) {
        const snap = JSON.parse(snapJson);
        if (Array.isArray(snap.tabs) && snap.tabs.length > 0) {
          return snap.tabs;
        }
      }
    } catch {}
    return [
      {
        id: 'tab-1',
        title: 'query_1.sql',
        sql: `-- DuckDB Studio SQL 工作台\n-- 输入 SQL 并按 Ctrl+Enter 执行查询\nSELECT \n    'DuckDB WASM Ready' AS status,\n    version() AS engine_version,\n    current_timestamp AS connected_at;`,
        isDirty: false,
      },
    ];
  });
  const [activeTabId, setActiveTabId] = useState<string>(() => {
    try {
      const snapJson = localStorage.getItem('workbench_workspace_snapshot');
      if (snapJson) {
        const snap = JSON.parse(snapJson);
        if (snap.activeTabId && typeof snap.activeTabId === 'string') {
          return snap.activeTabId;
        }
      }
    } catch {}
    return 'tab-1';
  });

  // Execution state & Results
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [queryResults, setQueryResults] = useState<Record<string, QueryResult>>({});
  const [previousResults, setPreviousResults] = useState<Record<string, QueryResult>>({});

  const activeQueryResult = queryResults[activeTabId] || null;
  const activePreviousResult = previousResults[activeTabId] || null;

  const [selectedObjectRef, setSelectedObjectRef] = useState<ObjectRef | null>(null);

  // Sync catalog & schema from DuckDB session
  const updateCatalogContext = useCallback(async () => {
    try {
      const ctx = await duckDBService.getCurrentCatalogAndSchema();
      setCatalogContext(ctx);
    } catch (e) {
      console.warn('Failed to get catalog context', e);
    }
  }, []);

  // Modals for Shortcuts
  const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);

  // Global Shortcuts: Ctrl+K, ?, open-keyboard-shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsLeftCollapsed(prev => !prev);
      }
      if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setShowShortcutsModal(prev => !prev);
      }
      if (e.key === 'Escape' && window.innerWidth < 768) {
        if (!isRightCollapsed) {
          e.preventDefault();
          setIsRightCollapsed(true);
          setTimeout(() => rightPanelTriggerRef.current?.focus(), 0);
        } else if (!isLeftCollapsed) {
          e.preventDefault();
          setIsLeftCollapsed(true);
          setTimeout(() => leftPanelTriggerRef.current?.focus(), 0);
        }
      }
    };

    const handleOpenShortcuts = () => setShowShortcutsModal(true);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-keyboard-shortcuts', handleOpenShortcuts);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-keyboard-shortcuts', handleOpenShortcuts);
    };
  }, [isLeftCollapsed, isRightCollapsed]);

  // Auto-persist workspace snapshot (FR-13 Workspace Recovery)
  useEffect(() => {
    try {
      const snapshot = {
        tabs: tabs.map(t => ({ id: t.id, title: t.title, sql: t.sql, isDirty: t.isDirty })),
        activeTabId,
        leftWidth,
        rightWidth,
        selectedColumnName,
        currentTable,
        catalogContext,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem('workbench_workspace_snapshot', JSON.stringify(snapshot));
    } catch {}
  }, [tabs, activeTabId, leftWidth, rightWidth, selectedColumnName, currentTable, catalogContext]);

  // T-06: Auto-trigger AI column profile when selectedColumnName changes (debounce 500ms)
  useEffect(() => {
    if (!selectedColumnName) return;
    if (!activeQueryResult || activeQueryResult.rows.length === 0) return;

    // Clear previous debounce timer
    if (profileDebounceRef.current) {
      clearTimeout(profileDebounceRef.current);
    }

    // Skip if already have profile for this column (unless it was an error state)
    const existing = columnAiProfiles.get(selectedColumnName);
    if (existing && !columnProfileError) return;

    profileDebounceRef.current = setTimeout(() => {
      void profileCurrentColumn(selectedColumnName);
    }, 500);

    return () => {
      if (profileDebounceRef.current) {
        clearTimeout(profileDebounceRef.current);
      }
    };
  }, [selectedColumnName, activeQueryResult?.resultId]); // eslint-disable-line react-hooks/exhaustive-deps

  // T-06: profileCurrentColumn — 调用 DuckDB 统计 + AI 列画像，写入 columnAiProfiles Map
  const profileCurrentColumn = useCallback(async (colName: string) => {
    if (!aiService.isConfigured()) {
      return; // silent skip when AI not configured
    }
    if (!activeQueryResult || activeQueryResult.rows.length === 0) {
      return;
    }

    const callId = ++profileCallIdRef.current;
    setIsProfilingColumn(true);
    setColumnProfileError(null);

    try {
      const snapshot = columnProfiler.profileColumn(
        {
          snapshotId: `wb-${activeTabId}-${Date.now()}`,
          executionId: activeTabId,
          tabId: activeTabId,
          title: tabs.find(t => t.id === activeTabId)?.title || 'query',
          sql: tabs.find(t => t.id === activeTabId)?.sql || '',
          columns: activeQueryResult.columns,
          columnTypes: activeQueryResult.columns.map(c => (activeQueryResult.columnTypeMap?.[c] || 'VARCHAR')),
          columnTypeMap: activeQueryResult.columnTypeMap || {},
          rows: activeQueryResult.rows,
          totalRowCount: activeQueryResult.totalRows ?? activeQueryResult.rows.length,
          executionTime: activeQueryResult.executionTime ?? 0,
          executedAt: activeQueryResult.executedAt || new Date().toISOString(),
        },
        colName,
      );

      const profile = await aiService.profileColumn(colName, {
        columnType: snapshot.columnType || 'VARCHAR',
        isNumeric: snapshot.isNumeric,
        isDate: snapshot.isDate,
        totalRows: snapshot.totalRows,
        nullCount: snapshot.nullCount,
        nullPct: snapshot.nullPct,
        distinctCount: snapshot.distinctCount,
        distinctPct: snapshot.distinctPct,
        min: snapshot.min,
        max: snapshot.max,
        avg: snapshot.avg,
        median: snapshot.median,
        sum: snapshot.sum,
        topValues: (snapshot.topValues || []).slice(0, 8),
        sampleValues: (activeQueryResult.rows || []).slice(0, 5).map(r => r?.[colName]),
      });

      if (callId !== profileCallIdRef.current) return; // stale
      setColumnAiProfiles(prev => {
        const next = new Map(prev);
        next.set(colName, profile);
        return next;
      });
    } catch (e: any) {
      if (callId !== profileCallIdRef.current) return;
      setColumnProfileError(e?.message || 'AI 列画像生成失败');
      toastService.error(e?.message || 'AI 列画像生成失败');
    } finally {
      if (callId === profileCallIdRef.current) setIsProfilingColumn(false);
    }
  }, [activeTabId, tabs, activeQueryResult]); // eslint-disable-line react-hooks/exhaustive-deps

  // Execute SQL query via Backend QueryExecutionService
  const handleExecuteQuery = useCallback(async (sqlToRun: string, explain = false, isProfile = false, targetTabId?: string, customTitle?: string) => {
    if (!sqlToRun.trim()) return;
    const tabId = targetTabId || activeTabId;
    setIsRunning(true);
    const currentTabObj = tabs.find(t => t.id === tabId);
    const title = customTitle || currentTabObj?.title || '查询结果';

    try {
      const { snapshot, task } = await queryExecutionService.executeQuery(tabId, sqlToRun, title, { explain, isProfile });
      if (snapshot) {
        setQueryResults(prev => ({ ...prev, [tabId]: snapshot }));
        setPreviousResults(prev => ({ ...prev, [tabId]: snapshot }));
        setTabs(prev =>
          prev.map(t => (t.id === tabId ? { ...t, isDirty: false, result: snapshot } : t))
        );
        if (snapshot.columns.length > 0 && !snapshot.columns.includes(selectedColumnName)) {
          setSelectedColumnName(snapshot.columns[0]);
        }
        // Sync live query execution result to DataFlow Canvas with real DuckDB intermediate materialization
        useWorkflowStore.getState().syncExecutionResult(title, snapshot, sqlToRun);
      } else if (task.status === 'failed' && task.error) {
        const errorResult: QueryResult = {
          resultId: `err_${Date.now()}`,
          queryTitle: title,
          columns: [],
          rows: [],
          executionTime: task.duration || 0,
          error: task.error,
          executedAt: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
        };
        setQueryResults(prev => ({ ...prev, [tabId]: errorResult }));
        useWorkflowStore.getState().syncExecutionResult(title, errorResult, sqlToRun);
      }
    } catch (err: any) {
      const errorResult: QueryResult = {
        resultId: `err_${Date.now()}`,
        queryTitle: title,
        columns: [],
        rows: [],
        executionTime: 0,
        error: err.message || String(err),
        executedAt: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      };
      setQueryResults(prev => ({ ...prev, [tabId]: errorResult }));
      useWorkflowStore.getState().syncExecutionResult(title, errorResult, sqlToRun);
    } finally {
      setIsRunning(false);
    }
  }, [activeTabId, tabs, selectedColumnName, onRefreshTables]);

  const handleExecuteSelection = useCallback(async (selectedSql?: string) => {
    const active = tabs.find(t => t.id === activeTabId);
    if (!active) return;
    const sqlToRun = selectedSql && selectedSql.trim() ? selectedSql.trim() : active.sql;
    const title = selectedSql && selectedSql.trim() ? `[选中] ${active.title}` : active.title;
    await handleExecuteQuery(sqlToRun, false, false, activeTabId, title);
  }, [tabs, activeTabId, handleExecuteQuery]);

  const handleStopQuery = () => {
    queryExecutionService.cancelTabExecution(activeTabId);
    setIsRunning(false);
    toastService.info('已终止执行');
  };

  // T-06: 手动重跑当前选中列的 AI 列画像（InspectorPanel 触发）
  const handleRerunColumnProfile = useCallback(() => {
    if (!selectedColumnName) {
      toastService.warning('请先选中一列');
      return;
    }
    // 清除该列的旧画像，强制重跑
    setColumnAiProfiles(prev => {
      const next = new Map(prev);
      next.delete(selectedColumnName);
      return next;
    });
    setColumnProfileError(null);
    void profileCurrentColumn(selectedColumnName);
    toastService.info(`正在为列 "${selectedColumnName}" 重新生成 AI 解读…`);
  }, [selectedColumnName, profileCurrentColumn]);

  // Seed demo data on mount and execute initial live query
  useEffect(() => {
    let isMounted = true;
    const initializeWorkbench = async () => {
      try {
        await updateCatalogContext();
      } catch (e) {
        console.warn('Catalog context load failed', e);
      }
    };
    initializeWorkbench();
    return () => {
      isMounted = false;
    };
  }, [updateCatalogContext]);

  const handleUpdateTabSql = (tabId: string, sql: string) => {
    querySnapshotManager.markTabStale(tabId, true);
    setTabs(prev =>
      prev.map(t => (t.id === tabId ? { ...t, sql, isDirty: true } : t))
    );
  };

  const handleAddTab = useCallback((initialSql?: string, customTitle?: string, autoRun = false, explain = false) => {
    if (initialSql) {
      const trimmed = initialSql.trim();
      if (
        lastInjectedRef.current &&
        lastInjectedRef.current.sql === trimmed &&
        Date.now() - lastInjectedRef.current.time < 300
      ) {
        return;
      }
      lastInjectedRef.current = { sql: trimmed, time: Date.now() };
    }
    const newId = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newTab: SqlQueryTab = {
      id: newId,
      title: customTitle || `查询 ${tabs.length + 1}`,
      sql: initialSql || (tables[0] ? `SELECT * FROM ${tables[0]} LIMIT 100;` : `SELECT version(), current_timestamp;`),
      isDirty: false,
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
    if (autoRun && initialSql) {
      setTimeout(() => {
        void handleExecuteQuery(initialSql, explain, false, newId);
      }, 50);
    }
  }, [tabs.length, handleExecuteQuery]);

  // Sync and consume pendingSql from other tabs/navigation
  useEffect(() => {
    if (pendingSql && pendingSql.trim()) {
      const sqlToInject = pendingSql;
      setPendingSql('');
      handleAddTab(sqlToInject, '注入查询', true);
    }
  }, [pendingSql, setPendingSql, handleAddTab]);

  // Global cross-tab event listeners (duckdb_execute_sql, duckdb_execute_capability, duckdb-schema-changed, workbench_switch_ai_panel)
  useEffect(() => {
    const handleExecuteSqlEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ sql: string; autoRun?: boolean; title?: string; explain?: boolean }>;
      if (customEvent.detail?.sql) {
        handleAddTab(
          customEvent.detail.sql,
          customEvent.detail.title || '注入查询',
          customEvent.detail.autoRun !== false,
          customEvent.detail.explain || false
        );
      }
    };

    const handleExecuteCapabilityEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ capability: any }>;
      const cap = customEvent.detail?.capability;
      if (cap) {
        const rawContent = cap.sqlTemplate || cap.promptTemplate || cap.prompt || '';
        let sql = rawContent;
        const sqlMatch = rawContent.match(/```sql\s*([\s\S]*?)\s*```/i);
        if (sqlMatch && sqlMatch[1]) {
          sql = sqlMatch[1].trim();
        }
        if (!sql && cap.name) {
          sql = `-- AI 能力: ${cap.name}\n-- 用途: ${cap.purpose || cap.description || ''}`;
        }
        const isExecutable = !!cap.sqlTemplate || /^\s*(SELECT|WITH|CREATE|INSERT|UPDATE|DELETE|DESCRIBE|EXPLAIN)/i.test(sql);
        handleAddTab(sql, cap.name || 'AI 能力', isExecutable);
      }
    };

    const handleSchemaChange = () => {
      void onRefreshTables();
      void updateCatalogContext();
    };

    // Cross-component AI panel switch event from ResultSection → WorkbenchView → AiAssistantPanel
    const handleSwitchAiPanel = (e: Event) => {
      const customEvent = e as CustomEvent<{ tab: 'explain' | 'analyze' }>;
      setIsRightCollapsed(false);
      setRightPanelMode('ai');
      if (customEvent.detail?.tab) {
        setAiSubTab(customEvent.detail.tab);
      }
      toastService.info('已切换到 AI 智能助手');
    };

    // DataFlow 双向回写同步：当在数据流画布中修改算子时，实时更新 SQL 工作台对应标签页的 SQL 内容
    const handleTabSqlUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ tabTitle?: string; sql: string; cteName?: string }>;
      if (customEvent.detail?.sql) {
        setTabs(prev => prev.map(t => {
          if (t.id === activeTabId || (customEvent.detail.tabTitle && t.title === customEvent.detail.tabTitle)) {
            return { ...t, sql: customEvent.detail.sql, isDirty: true };
          }
          return t;
        }));
      }
    };

    window.addEventListener('duckdb_execute_sql', handleExecuteSqlEvent);
    window.addEventListener('duckdb_execute_capability', handleExecuteCapabilityEvent);
    window.addEventListener('duckdb-schema-changed', handleSchemaChange);
    window.addEventListener('workbench_switch_ai_panel', handleSwitchAiPanel);
    window.addEventListener('workbench_tab_sql_updated', handleTabSqlUpdated);

    return () => {
      window.removeEventListener('duckdb_execute_sql', handleExecuteSqlEvent);
      window.removeEventListener('duckdb_execute_capability', handleExecuteCapabilityEvent);
      window.removeEventListener('duckdb-schema-changed', handleSchemaChange);
      window.removeEventListener('workbench_switch_ai_panel', handleSwitchAiPanel);
      window.removeEventListener('workbench_tab_sql_updated', handleTabSqlUpdated);
    };
  }, [handleAddTab, onRefreshTables, updateCatalogContext]);

  const handleCloseTab = (tabId: string) => {
    if (tabs.length <= 1) return;
    const remaining = tabs.filter(t => t.id !== tabId);
    setTabs(remaining);
    if (activeTabId === tabId) {
      setActiveTabId(remaining[0].id);
    }
  };

  const handleRenameTab = (tabId: string, title: string) => {
    setTabs(prev =>
      prev.map(t => (t.id === tabId ? { ...t, title } : t))
    );
  };

  const handleSelectObjectRef = async (ref: ObjectRef) => {
    setSelectedObjectRef(ref);
    onSelectTable(ref.objectName);
    try {
      const def = await duckDBService.getTableOrViewDefinition(ref);
      let sampleData: any[] = [];
      try {
        sampleData = await duckDBService.query(
          `SELECT * FROM "${ref.databaseName}"."${ref.schemaName}"."${ref.objectName}" LIMIT 100;`
        );
      } catch {}

      setActiveTableProfile({
        tableName: ref.objectName,
        rowCount: def.rowCount,
        schema: def.schema,
        ddl: def.ddl,
        sql: def.sql,
        sampleRows: sampleData,
        objectRef: ref,
      });
      if (def.schema && def.schema.length > 0) {
        setSelectedColumnName(def.schema[0].name);
      }
    } catch (err) {
      console.warn('Failed to load object definition', err);
    }
  };

  const handlePreviewObjectRef = async (ref: ObjectRef) => {
    setIsRunning(true);
    const start = performance.now();
    const nowTimeStr = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    const querySql = `SELECT * FROM "${ref.databaseName}"."${ref.schemaName}"."${ref.objectName}" LIMIT 100;`;
    try {
      const execRes = await duckDBService.queryWithMetadata(querySql);
      const duration = performance.now() - start;

      const result: QueryResult = {
        resultId: `preview_${ref.objectName}_${Date.now()}`,
        queryTitle: ref.objectName,
        sourceType: 'table_preview',
        sourceName: ref.objectName,
        columns: execRes.columns,
        columnTypes: execRes.columnTypes,
        columnTypeMap: execRes.columnTypeMap,
        rows: execRes.rows,
        arrowTable: execRes.arrowTable,
        executionTime: duration,
        limitClause: 100,
        executedAt: nowTimeStr,
      };

      setQueryResults(prev => ({ ...prev, [activeTabId]: result }));
      setPreviousResults(prev => ({ ...prev, [activeTabId]: result }));
      if (execRes.columns.length > 0) {
        setSelectedColumnName(execRes.columns[0]);
      }
    } catch (err: any) {
      console.error('Preview failed', err);
    } finally {
      setIsRunning(false);
    }
  };

  const handleQueryObjectRef = (ref: ObjectRef) => {
    const sql = `SELECT * FROM "${ref.databaseName}"."${ref.schemaName}"."${ref.objectName}" LIMIT 100;`;
    handleUpdateTabSql(activeTabId, sql);
  };

  const handleSelectTable = async (tableName: string) => {
    const ref: ObjectRef = {
      connectionId: 'conn-local',
      databaseName: catalogContext.catalog,
      schemaName: catalogContext.schema,
      objectName: tableName,
      objectType: tableName.startsWith('v_') ? 'VIEW' : 'TABLE',
    };
    await handleSelectObjectRef(ref);
    // Decoupled: Clicking table updates inspector only, keeping activeTab results intact!
  };

  const handleDoubleClickTable = useCallback((tableName: string) => {
    const querySql = `SELECT * FROM "${catalogContext.catalog}"."${catalogContext.schema}"."${tableName}" LIMIT 100;`;
    handleAddTab(querySql, tableName, true);
    toastService.info(`已在新标签页打开数据表 ${tableName}`);
  }, [catalogContext, handleAddTab]);

  const handlePreviewTable = async (tableName: string) => {
    if (tableName.trim().toUpperCase().startsWith('SELECT')) {
      await handleExecuteQuery(tableName);
      return;
    }
    const ref: ObjectRef = {
      connectionId: 'conn-local',
      databaseName: catalogContext.catalog,
      schemaName: catalogContext.schema,
      objectName: tableName,
      objectType: tableName.startsWith('v_') ? 'VIEW' : 'TABLE',
    };
    await handlePreviewObjectRef(ref);
  };

  const handleQueryTable = (tableNameOrSql: string) => {
    if (tableNameOrSql.trim().toUpperCase().startsWith('SELECT') || tableNameOrSql.trim().toUpperCase().startsWith('WITH') || tableNameOrSql.trim().toUpperCase().startsWith('DESCRIBE')) {
      handleUpdateTabSql(activeTabId, tableNameOrSql);
      void handleExecuteQuery(tableNameOrSql);
      return;
    }
    const sql = `SELECT * FROM "${catalogContext.catalog}"."${catalogContext.schema}"."${tableNameOrSql}" LIMIT 100;`;
    handleUpdateTabSql(activeTabId, sql);
    void handleExecuteQuery(sql);
  };

  const handleExportCsv = () => {
    if (!activeQueryResult?.rows?.length) return;
    const blob = exportCsv(activeQueryResult);
    downloadBlob(blob, `duckdb_export_${Date.now()}.csv`);
  };

  const handleExportJson = () => {
    if (!activeQueryResult?.rows?.length) return;
    const blob = exportJson(activeQueryResult);
    downloadBlob(blob, `duckdb_export_${Date.now()}.json`);
  };

  const handleExportParquet = async () => {
    const active = tabs.find(t => t.id === activeTabId);
    if (!active?.sql) return;
    try {
      const blob = await duckDBService.exportParquet(active.sql, `duckdb_export_${Date.now()}.parquet`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `duckdb_export_${Date.now()}.parquet`;
      a.click();
      URL.revokeObjectURL(url);
      toastService.success('Parquet 文件已导出');
    } catch (e: any) {
      toastService.error(`导出失败: ${e.message}`);
    }
  };

  const handleCopyClipboard = () => {
    if (!activeQueryResult?.rows?.length) return;
    const text = JSON.stringify(activeQueryResult.rows, null, 2);
    navigator.clipboard.writeText(text);
    toastService.success('已复制结果数据到剪贴板');
  };

  // Mouse Drag Resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      if (isDraggingLeft) {
        const newW = Math.max(280, Math.min(480, e.clientX - rect.left));
        setLeftWidth(newW);
      } else if (isDraggingRight) {
        const newW = Math.max(240, Math.min(650, rect.right - e.clientX));
        setRightWidth(newW);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingLeft(false);
      setIsDraggingRight(false);
    };

    if (isDraggingLeft || isDraggingRight) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingLeft, isDraggingRight]);

  const handleApplyFilter = (columnName: string, op: string, value: any) => {
    const fallbackSql = tables[0] ? `SELECT * FROM ${tables[0]}` : 'SELECT 1';
    const baseSql = activeTabId ? tabs.find(t => t.id === activeTabId)?.sql || fallbackSql : fallbackSql;
    const newSql = transformationEngine.generateDerivedSql(baseSql, {
      filters: [{ column: columnName, operator: op as any, value }],
    });
    handleAddTab(newSql, `筛选 ${columnName}`, true);
  };

  const handleGroupByColumn = (columnName: string) => {
    const fallbackSql = tables[0] ? `SELECT * FROM ${tables[0]}` : 'SELECT 1';
    const baseSql = activeTabId ? tabs.find(t => t.id === activeTabId)?.sql || fallbackSql : fallbackSql;
    const newSql = transformationEngine.generateDerivedSql(baseSql, {
      groupBy: [columnName],
      metrics: [{ column: '*', aggregator: 'COUNT', alias: 'count' }],
    });
    handleAddTab(newSql, `分组 ${columnName}`, true);
  };

  const handleSortColumn = (columnName: string, direction: 'ASC' | 'DESC') => {
    const fallbackSql = tables[0] ? `SELECT * FROM ${tables[0]}` : 'SELECT 1';
    const baseSql = activeTabId ? tabs.find(t => t.id === activeTabId)?.sql || fallbackSql : fallbackSql;
    const newSql = transformationEngine.generateDerivedSql(baseSql, {
      sorts: [{ column: columnName, direction }],
    });
    handleUpdateTabSql(activeTabId, newSql);
    handleExecuteQuery(newSql);
  };

  const handleAddToSelect = (columnName: string) => {
    const active = tabs.find(t => t.id === activeTabId);
    if (!active?.sql) return;
    const currentSql = active.sql;
    let newSql = currentSql;
    if (/SELECT\s+/i.test(currentSql)) {
      newSql = currentSql.replace(/SELECT\s+/i, `SELECT\n    ${columnName},\n    `);
    } else {
      newSql = `SELECT ${columnName}, * FROM (${currentSql});`;
    }
    handleUpdateTabSql(activeTabId, newSql);
    toastService.success(`已添加 ${columnName} 到 SELECT`);
  };

  const handleRestoreWorkspace = () => {
    try {
      const snapJson = localStorage.getItem('workbench_workspace_snapshot');
      if (snapJson) {
        const snap = JSON.parse(snapJson);
        if (Array.isArray(snap.tabs) && snap.tabs.length > 0) {
          setTabs(snap.tabs);
        }
        if (snap.activeTabId) {
          setActiveTabId(snap.activeTabId);
        }
        if (typeof snap.leftWidth === 'number') setLeftWidth(Math.max(280, Math.min(480, snap.leftWidth)));
        if (typeof snap.rightWidth === 'number') setRightWidth(snap.rightWidth);
        if (snap.selectedColumnName) setSelectedColumnName(snap.selectedColumnName);
        if (snap.currentTable) onSelectTable(snap.currentTable);
      }
    } catch {}
    setShowRecoveryDialog(false);
    sessionStorage.setItem('workbench_recovery_dismissed', 'true');
    toastService.success('工作区现场已完全恢复');
  };

  const handleDismissRecovery = () => {
    setShowRecoveryDialog(false);
    sessionStorage.setItem('workbench_recovery_dismissed', 'true');
  };

  const handleDeleteView = useCallback(async (viewName: string) => {
    try {
      await duckDBService.dropView(viewName);
      toastService.success(`视图 "${viewName}" 已删除`);
      onRefreshTables?.();
      window.dispatchEvent(new CustomEvent('duckdb-schema-changed'));
    } catch (e: any) {
      toastService.error(`删除视图失败: ${e.message}`);
    }
  }, [onRefreshTables]);

  const handleDeleteTable = useCallback(async (tableName: string) => {
    try {
      await duckDBService.dropTable(tableName);
      toastService.success(`数据表 "${tableName}" 已删除`);
      onRefreshTables?.();
      window.dispatchEvent(new CustomEvent('duckdb-schema-changed'));
    } catch (e: any) {
      toastService.error(`删除数据表失败: ${e.message}`);
    }
  }, [onRefreshTables]);

  const handleAddToDataFlow = useCallback(async (tableName: string) => {
    try {
      await useWorkflowStore.getState().addSourceNodeForTable(tableName);
      setIsDataFlowActive(true);
      toastService.success(`已将表 "${tableName}" 添加至数据流画布`);
    } catch (err: any) {
      toastService.error(`添加至数据流失败: ${err?.message || String(err)}`);
    }
  }, []);

  return (
    <div className="sql-workbench flex h-full w-full flex-col bg-monokai-bg overflow-hidden select-none font-sans relative text-monokai-fg text-xs">
      {/* 3-Column Main Workspace Area */}
      <div ref={containerRef} className="sql-workbench-grid flex flex-1 min-h-0 w-full relative overflow-hidden">
        {/* Left Column: Data Explorer */}
        {!isLeftCollapsed ? (
          <div
            className="sql-workbench-left h-full shrink-0 flex relative"
            style={{ width: `${leftWidth}px` }}
          >
            <DataExplorerPanel
              tables={tables}
              databaseName={catalogContext.catalog}
              currentTable={currentTable || (tables.length > 0 ? tables[0] : '')}
              selectedObjectRef={selectedObjectRef}
              onSelectObjectRef={handleSelectObjectRef}
              onQueryObjectRef={handleQueryObjectRef}
              onPreviewObjectRef={handlePreviewObjectRef}
              onSelectTable={handleSelectTable}
              onQueryTable={handleQueryTable}
              onPreviewTable={handlePreviewTable}
              onDoubleClickTable={handleDoubleClickTable}
              onRefreshTables={onRefreshTables}
              onOpenFile={onOpenFile}
              onAttachDatabase={onAttachDatabase}
              onAddDataSource={onAddDataSource}
              onDeleteTable={handleDeleteTable}
              onDeleteView={handleDeleteView}
              onAddToDataFlow={handleAddToDataFlow}
              onCreateTable={() => window.dispatchEvent(new CustomEvent('open-create-table-modal'))}
              onCreateView={() => window.dispatchEvent(new CustomEvent('open-create-view-modal'))}
              onUploadFile={() => window.dispatchEvent(new CustomEvent('open-import-modal'))}
              onClearWorkspace={() => window.dispatchEvent(new CustomEvent('open-clear-workspace-modal'))}
              onClosePanel={() => setIsLeftCollapsed(true)}
            />
            {/* Left Resizer */}
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                setIsDraggingLeft(true);
              }}
              className="absolute right-0 top-0 bottom-0 w-1 bg-transparent hover:bg-monokai-border-strong cursor-col-resize max-lg:hidden z-20 transition-colors"
            />
          </div>
        ) : (
          <div className="h-full shrink-0 flex flex-col items-center py-2 px-1 border-r border-monokai-border bg-monokai-sidebar/95 select-none z-20 w-8.5">
            <button
              ref={leftPanelTriggerRef}
              onClick={() => setIsLeftCollapsed(false)}
              title="展示左侧边栏 (Ctrl+B)"
              aria-label="展示左侧边栏"
              className="flex items-center justify-center w-6.5 h-6.5 rounded hover:bg-monokai-elevated text-monokai-comment hover:text-monokai-yellow cursor-pointer transition-colors"
            >
              <PanelLeftOpen className="w-4 h-4 text-monokai-yellow" />
            </button>
            <button
              type="button"
              onClick={() => setIsLeftCollapsed(false)}
              title="点击展开数据源 (Ctrl+B)"
              className="mt-4 flex flex-col items-center gap-1.5 cursor-pointer text-monokai-comment hover:text-monokai-fg transition-colors"
            >
              <Database className="w-3.5 h-3.5 text-monokai-comment hover:text-monokai-yellow" />
              <span className="text-[10px] font-sans [writing-mode:vertical-lr] tracking-widest text-monokai-comment hover:text-monokai-yellow">数据源</span>
            </button>
          </div>
        )}

        {/* Center Column: SQL Workspace + Result Explorer */}
        <div className="flex flex-1 min-w-0 h-full flex-col overflow-hidden relative">
          <SqlWorkspacePanel
            tabs={tabs}
            activeTabId={activeTabId}
            catalogContext={catalogContext}
            isDataFlowActive={isDataFlowActive}
            onSelectDataFlow={() => setIsDataFlowActive(true)}
            onToggleDataFlow={(active) => setIsDataFlowActive(active)}
            onNavigateToDataFlow={onNavigateToDataFlow}
            onSelectTab={(tabId) => {
              setActiveTabId(tabId);
            }}
            onAddTab={(sql, title, autoRun) => {
              setIsDataFlowActive(false);
              handleAddTab(sql, title, autoRun);
            }}
            onCloseTab={handleCloseTab}
            onUpdateTabSql={handleUpdateTabSql}
            onRenameTab={handleRenameTab}
            onExecuteQuery={(sql, explain, profile) => handleExecuteQuery(sql, explain, profile)}
            onExecuteSelection={handleExecuteSelection}
            onStopQuery={handleStopQuery}
            isRunning={isRunning}
            activeQueryResult={activeQueryResult}
            previousResult={activePreviousResult}
            selectedColumn={selectedColumnName}
            onSelectColumn={(colName) => {
              setSelectedColumnName(colName);
              setRightPanelMode('inspector');
            }}
            onExportCsv={handleExportCsv}
            onExportParquet={handleExportParquet}
            onExportJson={handleExportJson}
            onCopyClipboard={handleCopyClipboard}
            onApplyAggregateToSql={(sql, title, autoRun) => handleAddTab(sql, title, autoRun)}
            aiMode={rightPanelMode === 'ai' ? aiSubTab : null}
            onTriggerAiExplain={() => {
              setIsRightCollapsed(false);
              setRightPanelMode('ai');
              setAiSubTab('explain');
            }}
            onTriggerAiAnalyze={() => {
              setIsRightCollapsed(false);
              setRightPanelMode('ai');
              setAiSubTab('analyze');
            }}
          />
        </div>

        {/* Right Column: AI Assistant or Column Inspector */}
        {!isRightCollapsed ? (
          <div
            className="sql-workbench-right h-full shrink-0 flex relative"
            style={{ width: `${rightWidth}px` }}
          >
            {/* Right Resizer */}
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                setIsDraggingRight(true);
              }}
              className="absolute left-0 top-0 bottom-0 w-1 bg-transparent hover:bg-monokai-border-strong cursor-col-resize max-lg:hidden z-20 transition-colors"
            />
            {rightPanelMode === 'ai' ? (
              <AiAssistantPanel
                activeTabTitle={tabs.find(t => t.id === activeTabId)?.title || 'query.sql'}
                activeSql={tabs.find(t => t.id === activeTabId)?.sql || ''}
                queryResult={activeQueryResult}
                activeTab={aiSubTab}
                onChangeActiveTab={setAiSubTab}
                onSwitchToInspector={() => {
                  setRightPanelMode('inspector');
                }}
                onApplySqlSuggestion={(newSql) => {
                  handleUpdateTabSql(activeTabId, newSql);
                  toastService.success('已应用 AI 建议 SQL');
                }}
                onLocateSqlLine={(line) => {
                  toastService.info(`已定位至 SQL 第 ${line} 行`);
                }}
                onRunDeepProfile={() => handleExecuteQuery(tabs.find(t => t.id === activeTabId)?.sql || '', false, true)}
                onClose={() => setIsRightCollapsed(true)}
                selectedColumnName={selectedColumnName}
                columnTypeMap={activeQueryResult?.columnTypeMap}
              />
            ) : (
              <InspectorPanel
                currentTable={currentTable || (tables.length > 0 ? tables[0] : '')}
                queryResult={activeQueryResult}
                tableProfile={activeTableProfile}
                selectedColumn={selectedColumnName}
                columnAiProfile={columnAiProfiles.get(selectedColumnName || '') ?? null}
                isProfilingColumn={isProfilingColumn}
                columnProfileError={columnProfileError}
                onSelectColumn={setSelectedColumnName}
                onRerunColumnProfile={handleRerunColumnProfile}
                onSwitchToAi={(tab) => {
                  setRightPanelMode('ai');
                  setAiSubTab(tab);
                }}
                onApplyFilter={handleApplyFilter}
                onGroupByColumn={handleGroupByColumn}
                onSortColumn={handleSortColumn}
                onAddToSelect={handleAddToSelect}
                onClosePanel={() => setIsRightCollapsed(true)}
              />
            )}
          </div>
        ) : (
          <div className="h-full shrink-0 flex flex-col items-center py-2 px-1 border-l border-monokai-border bg-monokai-sidebar/95 select-none z-20 w-8.5 gap-2">
            <button
              ref={rightPanelTriggerRef}
              onClick={() => {
                setIsRightCollapsed(false);
                setRightPanelMode('inspector');
              }}
              title="展开列画像与属性分析"
              aria-label="展开列画像"
              className="flex flex-col items-center justify-center w-6.5 py-2 rounded hover:bg-monokai-elevated text-monokai-comment hover:text-monokai-yellow cursor-pointer transition-colors"
            >
              <PanelRight className="w-3.5 h-3.5 text-monokai-comment hover:text-monokai-yellow" />
              <span className="text-[10px] mt-1 font-sans [writing-mode:vertical-lr] tracking-widest text-monokai-comment hover:text-monokai-yellow">列画像</span>
            </button>
            <button
              onClick={() => {
                setIsRightCollapsed(false);
                setRightPanelMode('ai');
              }}
              title="展开 AI 智能助手"
              aria-label="展开 AI 智能助手"
              className="flex flex-col items-center justify-center w-6.5 py-2 rounded hover:bg-monokai-elevated text-monokai-comment hover:text-monokai-yellow cursor-pointer transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-monokai-comment hover:text-monokai-yellow" />
              <span className="text-[10px] mt-1 font-sans [writing-mode:vertical-lr] tracking-widest text-monokai-comment hover:text-monokai-yellow">AI助手</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Status Bar */}
      <WorkbenchStatusBar
        runtimeInfo={runtimeInfo}
        activeDatabase={catalogContext.catalog}
        activeSchema={catalogContext.schema}
        onOpenRuntimeCenter={() => setShowRuntimeCenterModal(true)}
        onOpenFeedback={() => setShowFeedbackModal(true)}
      />

      {/* Linear Feedback & Issue Tracking Modal */}
      <WorkbenchFeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        runtimeInfo={runtimeInfo}
        currentTable={currentTable}
        activeSql={tabs.find(t => t.id === activeTabId)?.sql}
        lastError={activeQueryResult?.error}
      />

      {/* Workspace Recovery (Floating Card) - 已抽取为独立组件 */}
      <WorkspaceRecoveryModal
        open={showRecoveryDialog}
        onRestore={handleRestoreWorkspace}
        onDismiss={handleDismissRecovery}
        tabCount={tabs.length}
        activeDatabase={catalogContext?.catalog || 'memory'}
        activeSchema={catalogContext?.schema || 'main'}
        currentTable={currentTable || tables[0] || '无'}
      />

      {/* Runtime Center Modal - 已抽取为独立组件 */}
      <RuntimeCenterModal
        open={showRuntimeCenterModal}
        onClose={() => setShowRuntimeCenterModal(false)}
        runtimeInfo={runtimeInfo}
        activeDatabase={catalogContext?.catalog || 'memory'}
        activeSchema={catalogContext?.schema || 'main'}
      />

      {/* Command Palette Modal (Ctrl+K) - 已抽取为独立组件 */}
      <CommandPaletteModal
        open={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onRunQuery={() => handleExecuteQuery(tabs.find(t => t.id === activeTabId)?.sql || '')}
        onExplainQuery={() => handleExecuteQuery(tabs.find(t => t.id === activeTabId)?.sql || '', true, false)}
        onNewTab={() => handleAddTab()}
        onExportParquet={() => handleExportParquet()}
        hasActiveSql={Boolean(tabs.find(t => t.id === activeTabId)?.sql?.trim())}
      />

      {/* Keyboard Shortcuts Modal (?) - 已抽取为独立组件 */}
      <KeyboardShortcutsModal
        open={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />
    </div>
  );
};
