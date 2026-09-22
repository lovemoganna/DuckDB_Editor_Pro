import React, { useEffect, useCallback, useState } from 'react';
import { AlertTriangle, X, ChevronRight } from 'lucide-react';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { duckDBService, type DuckDBRuntimeInfo } from './services/duckdbService';
import { Tab, Notification, ColumnInfo, ColumnStats, MetricChart } from './types';
import { AICooldownBanner } from './components/AICooldownBanner';
import { CommandPalette } from './components/CommandPalette';
import { DataTab } from './components/DataTab';
import { StructureTab } from './components/StructureTab';
import { AuditTab } from './components/AuditTab';
import HistoryTab from './components/HistoryTab';
import { ActiveFeatureHost } from './components/layout/ActiveFeatureHost';
import { AppTopBar } from './components/layout/AppTopBar';
import { WorkbenchLoadingState } from './components/ui';
import { GlobalModalProvider } from './components/layout/GlobalModalProvider';
import { useAppStore } from './hooks/store/useAppStore';
import { getWorkspaceFeature, resolveWorkspaceTab } from './services/workspaceNavigation';
import { aiConfigStore } from './services/aiConfigStore';
import { loadSchemaTree } from './services/schemaTreeLoader';
import {
  collectCompleteWorkspaceBackup,
  decodeCompleteWorkspaceBackup,
  encodeCompleteWorkspaceBackup,
  restoreCompleteWorkspace,
  restoreBrowserWorkspaceState,
} from './services/completeWorkspaceBackup';

import { useDataViewStore } from './hooks/store/useDataViewStore';
import { useSchemaViewStore } from './hooks/store/useSchemaViewStore';
import { ConfirmDialogProvider, useConfirmDialog } from './components/ui/ConfirmDialog';
import { KeyboardShortcutsModal } from './components/ui/KeyboardShortcutsModal';
import { ToastPortal, useToastManager } from './components/ui/ToastNotification';
import { DragonLogo } from './components/ui/DragonLogo';


const SqlEditor = React.lazy(() =>
  import('./components/SqlEditor').then(module => ({ default: module.SqlEditor })),
);
const Extensions = React.lazy(() =>
  import('./components/Extensions').then(module => ({ default: module.Extensions })),
);
import { Dashboard } from './components/Dashboard';
import { StudioBottomBar } from './components/Dashboard/StudioBottomBar';
import { WorkbenchView } from './components/Workbench';
import { seedDemoWorkbenchData } from './components/Workbench/seedWorkbenchData';
const KnowledgeHubApp = React.lazy(() =>
  import('./components/KnowledgeHub').then(module => ({ default: module.KnowledgeHubApp })),
);
const MetricManager = React.lazy(() =>
  import('./components/MetricManager').then(module => ({ default: module.MetricManager })),
);
const SkillPanel = React.lazy(() =>
  import('./components/skills/SkillPanel').then(module => ({ default: module.SkillPanel })),
);
const AiCapabilityLibraryApp = React.lazy(() =>
  import('./components/AiCapabilityLibrary/AiCapabilityLibraryApp').then(module => ({
    default: module.AiCapabilityLibraryApp,
  })),
);
const LibraryApp = React.lazy(() =>
  import('./components/Library').then(module => ({ default: module.LibraryApp })),
);
const OntologyApp = React.lazy(() =>
  import('./components/Library').then(module => ({ default: module.OntologyApp })),
);
const CompositionalDeductionApp = React.lazy(() =>
  import('./components/Library').then(module => ({ default: module.CompositionalDeductionApp })),
);
const AnalysisHubPanel = React.lazy(() =>
  import('./components/AnalysisHub').then(module => ({ default: module.AnalysisHubPanel })),
);
const DataFlowCanvas = React.lazy(() =>
  import('./components/DataFlow/DataFlowCanvas').then(module => ({ default: module.DataFlowCanvas })),
);

const AppContent: React.FC = () => {
  const { toasts, removeToast, clearAllToasts } = useToastManager();
  const { confirm } = useConfirmDialog();
  const {
    activeTab, setActiveTab,
    isZenMode, toggleZenMode,
    tables, setTables,
    currentTable, setCurrentTable,
    pendingSql, setPendingSql,
    pendingChartConfig, setPendingChartConfig,
    showCreateModal, setShowCreateModal,
    showDuplicateModal, setShowDuplicateModal,
    showImportModal, setShowImportModal,
    showSettingsModal, setShowSettingsModal,
    showExportModal, setShowExportModal,
    aiProvider, aiApiKey, aiBaseUrl, aiModel,
    notifications,
    auditLogs, setAuditLogs,
    addNotification,
  } = useAppStore();

  // ── Init ──────────────────────────────────────────────────────
  const [isReady, setIsReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [runtimeInfo, setRuntimeInfo] = useState<DuckDBRuntimeInfo>(() => (
    typeof duckDBService?.getRuntimeInfo === 'function'
      ? duckDBService.getRuntimeInfo()
      : { persistent: false, isLegacy: false, ready: false, version: '1.33.1', persistenceError: null }
  ));

  const {
    dataViewMode, setDataViewMode,
    tableData, setTableData,
    tableColumns, setTableColumns,
    hiddenColumns, setHiddenColumns,
    loadingData, setLoadingData,
    pagination, setPagination,
    schema, setSchema,
    sortConfig, setSortConfig,
    filterQuery, setFilterQuery,
    selectedRows, setSelectedRows,
    profileData, setProfileData,
    expandedRowIdx, setExpandedRowIdx,
    showColMenu, setShowColMenu,
    editingCell, setEditingCell,
    fetchTableData, fetchProfileData,
    handlePageChange, handleSort,
    toggleColumnVisibility,
  } = useDataViewStore();

  const {
    newColName, setNewColName,
    newColType, setNewColType,
    selectedColStats, setSelectedColStats,
    renameTableName, setRenameTableName,
    isRenaming, setIsRenaming,
    editColumnMode, setEditColumnMode,
    structureViewMode, setStructureViewMode,
    fullSchemaTree, setFullSchemaTree,
  } = useSchemaViewStore();

  // ── UI State ──
  const [structureInspectorTab, setStructureInspectorTab] = useState<'profile' | 'add' | 'ddl'>('profile');
  const [isPersistenceBannerDismissed, setIsPersistenceBannerDismissed] = useState(false);
  const [showPersistenceDetails, setShowPersistenceDetails] = useState(false);
  const [availableModels, setAvailableModels] = useState<{ id: string; name: string }[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  // ── SQL 工作台状态与独立数据流大屏双向联动 ──
  const [dataflowTabs, setDataflowTabs] = useState<Array<{ id: string; title: string; sql: string }>>(() => {
    try {
      const saved = localStorage.getItem('workbench_layout_state');
      if (saved) {
        const snap = JSON.parse(saved);
        if (Array.isArray(snap.tabs) && snap.tabs.length > 0) {
          return snap.tabs;
        }
      }
    } catch {}
    return [{ id: 'tab-1', title: '查询 1', sql: 'SELECT * FROM demo_sales LIMIT 50;' }];
  });

  const [dataflowActiveTabId, setDataflowActiveTabId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('workbench_layout_state');
      if (saved) {
        const snap = JSON.parse(saved);
        if (snap.activeTabId) return snap.activeTabId;
      }
    } catch {}
    return 'tab-1';
  });

  useEffect(() => {
    const refreshDataflowTabs = () => {
      try {
        const saved = localStorage.getItem('workbench_layout_state');
        if (saved) {
          const snap = JSON.parse(saved);
          if (Array.isArray(snap.tabs) && snap.tabs.length > 0) {
            setDataflowTabs(snap.tabs);
            if (snap.activeTabId) setDataflowActiveTabId(snap.activeTabId);
          }
        }
      } catch {}
    };

    if (activeTab === Tab.DATAFLOW) {
      refreshDataflowTabs();
    }

    const handleTabSqlUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ tabTitle?: string; sql: string }>;
      if (customEvent.detail?.sql) {
        setDataflowTabs(prev =>
          prev.map(t => {
            if (t.id === dataflowActiveTabId || (customEvent.detail.tabTitle && t.title === customEvent.detail.tabTitle)) {
              return { ...t, sql: customEvent.detail.sql };
            }
            return t;
          })
        );
      }
    };

    window.addEventListener('workbench_tab_sql_updated', handleTabSqlUpdated);
    return () => window.removeEventListener('workbench_tab_sql_updated', handleTabSqlUpdated);
  }, [activeTab, dataflowActiveTabId]);

  // ── Init & Refresh ─────────────────────────────────────────────
  useEffect(() => {
    (window as any).__openImportWizard = () => setShowImportModal(true);
  }, [setShowImportModal]);

  const refreshTables = useCallback(async () => {
    try {
      const t = await duckDBService.getTables();
      setTables(t);
    } catch (e) { console.error(e); }
  }, [setTables]);

  const refreshAudit = useCallback(async () => {
    try {
      const logs = await duckDBService.getAuditLogs(100);
      setAuditLogs(logs);
    } catch (e) { console.error(e); }
  }, [setAuditLogs]);

  useEffect(() => {
    duckDBService.init()
      .then(async () => {
        if (typeof duckDBService?.getRuntimeInfo === 'function') {
          setRuntimeInfo(duckDBService.getRuntimeInfo());
        }
        setIsReady(true);
        await refreshTables();
      })
      .catch((e) => setInitError(e?.message || String(e) || 'DuckDB 工作区初始化失败'));
  }, [refreshTables]);

  useEffect(() => {
    const handleSchemaChange = () => {
      void refreshTables();
    };
    window.addEventListener('duckdb-schema-changed', handleSchemaChange);
    return () => window.removeEventListener('duckdb-schema-changed', handleSchemaChange);
  }, [refreshTables]);

  // Load full schema for ER Diagram
  useEffect(() => {
    let cancelled = false;

    const loadSchema = async () => {
      if (activeTab === Tab.STRUCTURE && tables.length > 0) {
        const { tree, errors } = await loadSchemaTree(
          tables,
          table => duckDBService.getTableSchema(table),
        );
        if (cancelled) return;
        setFullSchemaTree(tree);
        if (errors.length > 0) {
          console.warn('Some table schemas could not be loaded', errors);
        }
      }
    };
    loadSchema().catch(error => {
      if (!cancelled) console.error('Schema tree load failed', error);
    });

    return () => {
      cancelled = true;
    };
  }, [activeTab, tables, setFullSchemaTree]);

  // Sync non-secret AI preferences changed by another tab.
  useEffect(() => {
    const handleStorageChange = () => {
      const config = aiConfigStore.getConfig();
      useAppStore.setState({
        aiProvider: config.provider,
        aiBaseUrl: config.baseUrl,
        aiModel: config.model,
      });
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Safeguard: warn before refresh/close if running in ephemeral in-memory mode with data
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!runtimeInfo.persistent && tables.length > 0) {
        e.preventDefault();
        e.returnValue = '当前处于内存临时模式，刷新或离开将丢失未导出的数据与表结构，确定离开吗？';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [runtimeInfo.persistent, tables.length]);

  // ── Data Fetching ─────────────────────────────────────────────
  // (Delegated to useDataViewStore for unblocked readQuery execution)

  // ── Unified Cross-Module Navigation Dispatcher ─────────────────
  const handleNavigateWithContext = useCallback(async (options: {
    targetTab: Tab;
    tableName?: string;
    filter?: string;
    sql?: string;
    executeDirectly?: boolean;
    inspectorTab?: 'profile' | 'add' | 'ddl';
  }) => {
    const { targetTab, tableName, filter, sql, executeDirectly, inspectorTab } = options;
    if (tableName) {
      setCurrentTable(tableName);
    }
    if (sql !== undefined) {
      setPendingSql(sql);
    }

    if (targetTab === Tab.DATA && tableName) {
      const activeFilter = filter || '';
      setSortConfig([]);
      setFilterQuery(activeFilter);
      setIsRenaming(false);
      setDataViewMode('grid');
      setHiddenColumns(new Set());
      setActiveTab(Tab.DATA);
      try {
        await Promise.all([
          fetchTableData(tableName, 0, pagination.limit, [], activeFilter),
          fetchProfileData(tableName),
        ]);
      } catch (e: any) {
        addNotification(`Data Load Error: ${e.message}`, 'error');
      }
      setSelectedColStats(null);
      return;
    }

    if (targetTab === Tab.STRUCTURE && tableName) {
      setActiveTab(Tab.STRUCTURE);
      if (inspectorTab) {
        setStructureInspectorTab(inspectorTab);
      }
      if (inspectorTab === 'add') {
        setEditColumnMode(null);
      }
      try {
        const s = await duckDBService.getTableSchema(tableName);
        setSchema(s);
        setTableColumns(s.map((c: any) => c.name));
      } catch (e: any) {
        console.error('Failed to load table schema for structure tab', e);
      }
      return;
    }

    if (targetTab === Tab.SQL) {
      setActiveTab(Tab.SQL);
      if (executeDirectly && sql) {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('duckdb_execute_sql', { detail: { sql } }));
        }, 60);
      }
      return;
    }

    setActiveTab(targetTab);
  }, [
    setCurrentTable,
    setPendingSql,
    setSortConfig,
    setFilterQuery,
    setIsRenaming,
    setDataViewMode,
    setHiddenColumns,
    setActiveTab,
    fetchTableData,
    fetchProfileData,
    pagination.limit,
    addNotification,
    setSelectedColStats,
    setEditColumnMode,
    setSchema,
    setTableColumns,
  ]);

  // ── Data Operations ────────────────────────────────────────────
  const handleTableSelect = async (name: string, initialFilter: string = '') => {
    await handleNavigateWithContext({
      targetTab: Tab.DATA,
      tableName: name,
      filter: initialFilter,
    });
  };

  const onHandlePageChange = (newOffset: number) => {
    if (currentTable) handlePageChange(currentTable, newOffset);
  };

  const onHandleSort = (key: string, shiftKey?: boolean) => {
    if (currentTable) handleSort(currentTable, key, shiftKey);
  };

  const handleApplyFilter = () => {
    if (currentTable) fetchTableData(currentTable, 0, pagination.limit).catch(e => addNotification(`Filter Error: ${e.message}`, 'error'));
  };

  const downloadData = async (format: 'csv' | 'json' | 'parquet') => {
    if (!tableData.length || !currentTable) return;
    const filename = `${currentTable}_export_${Date.now()}.${format}`;
    try {
      if (format === 'parquet') {
        const blob = await duckDBService.exportParquet(`SELECT * FROM "${currentTable}"`, filename);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
        addNotification(`Exported ${filename}`, 'success');
        return;
      }
      let content = '', mimeType = '';
      if (format === 'csv') {
        const headers = tableColumns.filter(c => !hiddenColumns.has(c)).join(',');
        const rows = tableData.map(row =>
          tableColumns.filter(c => !hiddenColumns.has(c)).map(col => {
            const val = row[col];
            const safeVal = typeof val === 'bigint' ? val.toString() : val;
            return safeVal === null ? '' : `"${String(safeVal).replace(/"/g, '""')}"`;
          }).join(',')
        ).join('\n');
        content = `${headers}\n${rows}`;
        mimeType = 'text/csv;charset=utf-8;';
      } else {
        content = JSON.stringify(tableData, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2);
        mimeType = 'application/json';
      }
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
      addNotification(`Exported ${filename}`, 'success');
    } catch (e: any) { addNotification(`Export failed: ${e.message}`, 'error'); }
  };

  const handleCreateDemo = async () => {
    try {
      await seedDemoWorkbenchData();
      addNotification('已成功载入完整示例数据集', 'success');
      await refreshTables();
    } catch (e: any) { addNotification(e.message, 'error'); }
  };

  const handleRenameTable = async () => {
    if (!currentTable || !renameTableName) return;
    try {
      await duckDBService.renameTable(currentTable, renameTableName);
      addNotification(`Renamed ${currentTable} to ${renameTableName}`, 'success');
      await refreshTables();
      handleTableSelect(renameTableName);
    } catch (e: any) { addNotification(e.message, 'error'); }
  };

  const handleDropTable = async () => {
    if (!currentTable) return;
    const ok = await confirm(`确定要删除表 "${currentTable}" 吗？此操作无法撤销。`);
    if (!ok) return;
    try {
      await duckDBService.dropTable(currentTable);
      addNotification(`Table "${currentTable}" dropped`, 'success');
      setCurrentTable(null);
      await refreshTables();
      setActiveTab(Tab.DASHBOARD);
    } catch (e: any) { addNotification(e.message, 'error'); }
  };

  const handleInsertRow = async () => {
    if (!currentTable) return;
    try {
      await duckDBService.insertRow(currentTable, {});
      addNotification('Row inserted', 'success');
      window.dispatchEvent(new CustomEvent('duckdb-schema-changed'));
      const countRes = await duckDBService.query(`SELECT COUNT(*) as c FROM "${currentTable}"`);
      const total = Number(countRes[0].c);
      const lastPageOffset = Math.floor(Math.max(0, total - 1) / pagination.limit) * pagination.limit;
      if (lastPageOffset !== pagination.offset) fetchTableData(currentTable, lastPageOffset, pagination.limit);
      else fetchTableData(currentTable, pagination.offset, pagination.limit);
    } catch (e: any) { addNotification(`Insert failed: ${e.message}`, 'error'); }
  };

  const handleCellEdit = (rowIdx: number, col: string, val: any) => {
    const pkCol = schema.find(c => c.pk);
    if (!pkCol) { addNotification("当前表未定义主键约束 (Primary Key)，无法进行行级就地编辑", 'info'); return; }
    setEditingCell({ rowIdx, col, val });
  };

  const saveCellEdit = async () => {
    if (!editingCell || !currentTable) return;
    const { rowIdx, col, val } = editingCell;
    const row = tableData[rowIdx];
    const pkCol = schema.find(c => c.pk);
    if (!pkCol) {
      addNotification("当前表无主键约束，无法定位行并保存修改", 'error');
      setEditingCell(null);
      return;
    }
    if (row[col] === val) { setEditingCell(null); return; }
    try {
      await duckDBService.updateRow(currentTable, pkCol.name, row[pkCol.name], col, val);
      addNotification('数据单元格更新成功', 'success');
      setEditingCell(null);
      fetchTableData(currentTable, pagination.offset, pagination.limit);
      window.dispatchEvent(new CustomEvent('duckdb-schema-changed'));
    } catch (e: any) { addNotification(`更新失败: ${e.message}`, 'error'); }
  };

  const handleSelectRow = (pkVal: any, selected: boolean) => {
    const newSet = new Set(selectedRows);
    if (selected) newSet.add(pkVal); else newSet.delete(pkVal);
    setSelectedRows(newSet);
  };

  const handleSelectAll = (selected: boolean) => {
    if (!currentTable) return;
    const pkCol = schema.find(c => c.pk);
    if (!pkCol) {
      if (selected) {
        addNotification('无主键约束的表不支持批量行选择', 'info');
      }
      return;
    }
    if (selected) {
      const newSet = new Set<any>();
      tableData.forEach(r => newSet.add(r[pkCol.name]));
      setSelectedRows(newSet);
    } else { setSelectedRows(new Set()); }
  };

  const handleBulkDelete = async () => {
    if (!currentTable || selectedRows.size === 0) return;
    const pkCol = schema.find(c => c.pk);
    if (!pkCol) {
      addNotification('当前表无主键约束，无法执行安全的批量删除', 'error');
      return;
    }
    const ok = await confirm(`确定要删除选中的 ${selectedRows.size} 行数据吗？`);
    if (!ok) return;
    try {
      await duckDBService.deleteRows(currentTable, pkCol.name, Array.from(selectedRows));
      addNotification(`已成功删除 ${selectedRows.size} 行数据`, 'success');
      setSelectedRows(new Set());
      fetchTableData(currentTable, pagination.offset, pagination.limit);
      window.dispatchEvent(new CustomEvent('duckdb-schema-changed'));
    } catch (e: any) { addNotification(`批量删除失败: ${e.message}`, 'error'); }
  };

  const handleAddColumn = async (overrides?: { name?: string; type?: string }) => {
    if (!currentTable) { addNotification('请先选择一张数据表', 'error'); return; }
    const colName = (overrides?.name ?? newColName).trim();
    const colType = (overrides?.type ?? newColType).trim();
    if (!colName) { addNotification('请输入字段名称', 'error'); return; }
    if (!colType) { addNotification('请选择字段类型', 'error'); return; }
    try {
      await duckDBService.addColumn(currentTable, colName, colType);
      addNotification(`字段 ${colName} 已添加`, 'success');
      setNewColName('');
      setNewColType('VARCHAR');
      const s = await duckDBService.getTableSchema(currentTable);
      setSchema(s);
      setTableColumns(s.map((c: any) => c.name));
      window.dispatchEvent(new CustomEvent('duckdb-schema-changed'));
    } catch (e: any) { addNotification(`添加字段失败: ${e.message}`, 'error'); }
  };

  const handleDropColumn = async (colName: string) => {
    if (!currentTable) return;
    const ok = await confirm(`确定要删除列 "${colName}" 吗？该列数据将被移除。`);
    if (!ok) return;
    try {
      await duckDBService.dropColumn(currentTable, colName);
      addNotification(`Column ${colName} dropped`, 'success');
      const s = await duckDBService.getTableSchema(currentTable);
      setSchema(s);
      setTableColumns(s.map((c: any) => c.name));
    } catch (e: any) { addNotification(`Failed to drop column: ${e.message}`, 'error'); }
  };

  const handleSaveColumnEdit = async () => {
    if (!editColumnMode || !currentTable) return;
    try {
      if (editColumnMode.colName !== editColumnMode.newName) {
        await duckDBService.renameColumn(currentTable, editColumnMode.colName, editColumnMode.newName);
      }
      const targetCol = editColumnMode.colName !== editColumnMode.newName ? editColumnMode.newName : editColumnMode.colName;
      const currentSchemaCol = schema.find(c => c.name === editColumnMode.colName);
      if (currentSchemaCol && currentSchemaCol.type !== editColumnMode.newType) {
        await duckDBService.alterColumnType(currentTable, targetCol, editColumnMode.newType);
      }
      addNotification(`Column ${targetCol} updated`, 'success');
      setEditColumnMode(null);
      const s = await duckDBService.getTableSchema(currentTable);
      setSchema(s);
      setTableColumns(s.map((c: any) => c.name));
    } catch (e: any) { addNotification(`Failed to update column: ${e.message}`, 'error'); }
  };

  const showColumnStats = async (col: string) => {
    if (!currentTable) return;
    try {
      const stats = await duckDBService.getColumnStats(currentTable, col);
      setSelectedColStats({ col, stats });
    } catch (e: any) { addNotification(`Failed to get stats: ${e.message}`, 'error'); }
  };

  const handleCopySchema = () => {
    if (!currentTable || schema.length === 0) return;
    const ddl = `CREATE TABLE "${currentTable}" (\n  ${schema
      .map(c => {
        const pk = c.pk ? ' PRIMARY KEY' : '';
        const notnull = c.notnull && !c.pk ? ' NOT NULL' : '';
        const dflt = c.dflt_value !== null && c.dflt_value !== undefined ? ` DEFAULT ${c.dflt_value}` : '';
        return `"${c.name}" ${c.type}${pk}${notnull}${dflt}`;
      })
      .join(',\n  ')}\n);`;
    navigator.clipboard.writeText(ddl);
    addNotification('Schema DDL 已复制到剪贴板', 'success');
  };

  // ── Cross-Tab ──────────────────────────────────────────────────
  const handlePendingConsumed = useCallback(() => {
    setPendingSql('');
    setPendingChartConfig(null);
  }, [setPendingSql, setPendingChartConfig]);

  const handleChartGenerated = useCallback((chart: any) => {
    setPendingSql(chart.sql);
    setPendingChartConfig(chart.chartConfig);
    setActiveTab(Tab.SQL);
    addNotification(`图表已生成并同步到 SQL 编辑器: ${chart.metricName}`, 'success');
  }, [setActiveTab, setPendingSql, setPendingChartConfig, addNotification]);

  // ── AI Config setters (mirror to store) ────────────────────────
  const setAiProvider = (v: string) => useAppStore.getState().setAiConfig({ provider: v });
  const setAiApiKey = (v: string) => useAppStore.getState().setAiConfig({ apiKey: v });
  const setAiBaseUrl = (v: string) => useAppStore.getState().setAiConfig({ baseUrl: v });
  const setAiModel = (v: string) => useAppStore.getState().setAiConfig({ model: v });

  // ── Workspace Backup/Restore ─────────────────────────────────────
  const handleExportWorkspace = async () => {
    try {
      addNotification('正在创建完整工作区备份…', 'info');
      const duckdbSnapshot = await duckDBService.exportWorkspaceSnapshotArchive();
      const backup = await collectCompleteWorkspaceBackup(duckdbSnapshot);
      const encoded = encodeCompleteWorkspaceBackup(backup);
      const blob = new Blob([encoded], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `duckdb_workspace_${new Date().toISOString().split('T')[0]}.duckdb-workspace`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      addNotification(`完整工作区已导出（${(encoded.byteLength / 1024 / 1024).toFixed(2)} MB）`, 'success');
    } catch (error) {
      addNotification(`工作区导出失败：${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  };

  const handleImportWorkspace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const backup = decodeCompleteWorkspaceBackup(bytes);
      await restoreCompleteWorkspace(backup, {
        captureCurrentWorkspace: async () => {
          const currentDuckDB = await duckDBService.exportWorkspaceSnapshotArchive();
          return collectCompleteWorkspaceBackup(currentDuckDB);
        },
        restoreBrowserState: restoreBrowserWorkspaceState,
        installDuckDBSnapshot: snapshot =>
          duckDBService.installWorkspaceSnapshotArchive(snapshot),
      });
      addNotification('完整工作区已恢复，正在重新加载…', 'success');
      setTimeout(() => window.location.reload(), 800);
    } catch (error) {
      addNotification(`工作区恢复失败，现有数据未重新加载：${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      e.target.value = '';
    }
  };

  // ── Derived ─────────────────────────────────────────────────────
  if (initError) {
    return (
      <div className="flex h-screen w-screen select-none flex-col items-center justify-center bg-monokai-bg p-6 text-center font-sans text-monokai-fg">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-6 text-2xl text-red-400">
          ⚠️
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">DuckDB Engine Launch Failed</h1>
        <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">{initError}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2.5 rounded-xl bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30 font-medium text-sm transition-all cursor-pointer"
        >
          重新加载引擎
        </button>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-monokai-bg text-monokai-fg font-sans select-none overflow-hidden relative">
        {/* Subtle Ambient Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-monokai-green/5 rounded-full blur-3xl pointer-events-none" />

        {/* Dragon Brand Icon */}
        <div className="relative mb-6">
          <DragonLogo size="2xl" variant="glow" animated />
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-monokai-green border-2 border-monokai-bg flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
          </div>
        </div>

        {/* Title & Tagline */}
        <h1 className="text-xl font-mono font-bold tracking-tight text-monokai-fg mb-1 flex items-center gap-2">
          DuckDB Studio
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-monokai-green/15 text-monokai-green uppercase tracking-wider">
            PRO
          </span>
        </h1>
        <p className="text-xs text-monokai-comment font-mono mb-6 tracking-wide">High-Performance WASM Analytics Kernel</p>

        {/* Progress Bar & Status */}
        <div className="w-60 flex flex-col items-center gap-2">
          <div className="w-full h-1 bg-monokai-surface rounded-full overflow-hidden relative">
            <div className="h-full bg-gradient-to-r from-monokai-green to-monokai-yellow rounded-full animate-pulse w-3/4" />
          </div>
          <span className="text-[11px] text-monokai-comment font-mono tracking-wide">正在初始化 DuckDB 工作区…</span>
        </div>
      </div>
    );
  }

  const pkColumn = schema.find(c => c.pk);
  const activeFeature = getWorkspaceFeature(activeTab);

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden text-monokai-fg flex-col">
      {/* Command Palette (keyboard-only) */}
      <CommandPalette
        tables={tables}
        currentTable={currentTable}
        onSelectTable={handleTableSelect}
        onSetActiveTab={(tab) => {
          const target = resolveWorkspaceTab(tab);
          if (target) setActiveTab(target);
        }}
        onOpenCreateTable={() => setShowCreateModal(true)}
        onOpenImportWizard={() => setShowImportModal(true)}
        onOpenExport={() => setShowExportModal(true)}
        onOpenSettings={() => setShowSettingsModal(true)}
        onAction={(prompt) => { setPendingSql(prompt); setActiveTab(Tab.AI_SKILLS); }}
        onOntologyAction={() => {
          setActiveTab(Tab.ONTOLOGY);
        }}
      />

      {/* Keyboard Shortcuts Guide Cheat Sheet */}
      <KeyboardShortcutsModal />

      {/* Global Modals & Notifications Provider */}
      <GlobalModalProvider
        showCreateModal={showCreateModal}
        setShowCreateModal={setShowCreateModal}
        showDuplicateModal={showDuplicateModal}
        setShowDuplicateModal={setShowDuplicateModal}
        showSettingsModal={showSettingsModal}
        setShowSettingsModal={setShowSettingsModal}
        showImportModal={showImportModal}
        setShowImportModal={setShowImportModal}
        showExportModal={showExportModal}
        setShowExportModal={setShowExportModal}
        currentTable={currentTable}
        tableData={tableData}
        expandedRowIdx={expandedRowIdx}
        setExpandedRowIdx={setExpandedRowIdx}
        notifications={notifications}
        aiProvider={aiProvider}
        aiApiKey={aiApiKey}
        aiBaseUrl={aiBaseUrl}
        aiModel={aiModel}
        availableModels={availableModels}
        loadingModels={loadingModels}
        handleTableSelect={handleTableSelect}
        refreshTables={refreshTables}
        addNotification={addNotification}
        setAiProvider={setAiProvider}
        setAiApiKey={setAiApiKey}
        setAiBaseUrl={setAiBaseUrl}
        setAiModel={setAiModel}
        setAvailableModels={setAvailableModels}
        setLoadingModels={setLoadingModels}
        handleExportWorkspace={handleExportWorkspace}
        handleImportWorkspace={handleImportWorkspace}
      />

      {/* Global Top Bar Navigation (Always persistently rendered across all pages) */}
      <AppTopBar
        activeTab={activeTab}
        currentTable={currentTable}
        tables={tables}
        setActiveTab={setActiveTab}
        handleTableSelect={handleTableSelect}
        handleCreateDemo={handleCreateDemo}
        setShowCreateModal={setShowCreateModal}
        setShowImportModal={setShowImportModal}
        setShowExportModal={setShowExportModal}
        setShowSettingsModal={setShowSettingsModal}
        fetchTableData={fetchTableData}
        refreshAudit={refreshAudit}
        runtimeInfo={runtimeInfo}
        activeDatabase="duckdb_manager_workspace"
      />

      {/* Main Studio Body (Center Content Area) */}
      <main className="flex flex-1 flex-col min-h-0 min-w-0 overflow-hidden bg-monokai-bg">
          {!runtimeInfo.persistent && !isPersistenceBannerDismissed && activeTab !== Tab.DASHBOARD && activeTab !== Tab.SQL && activeTab !== Tab.ONTOLOGY && (
            <div
              role="alert"
              className="flex shrink-0 flex-col bg-monokai-warning/10 px-3.5 py-1.5 text-xs text-monokai-fg transition-all animate-in fade-in duration-200"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-monokai-warning/20 text-monokai-warning">
                    <AlertTriangle className="h-3.5 w-3.5" />
                  </span>
                  <span className="font-medium text-monokai-fg/90">
                    当前为内存临时模式，刷新页面将重置未导出的数据与表结构
                  </span>
                  {runtimeInfo.persistenceError && (
                    <button
                      type="button"
                      onClick={() => setShowPersistenceDetails(!showPersistenceDetails)}
                      className="ml-1 inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-mono text-monokai-warning hover:bg-monokai-warning/20 transition-colors"
                      title={showPersistenceDetails ? '收起技术详情' : '展开技术详情'}
                    >
                      <ChevronRight
                        className={`h-3 w-3 transition-transform duration-150 ${
                          showPersistenceDetails ? 'rotate-90' : ''
                        }`}
                      />
                      <span>{showPersistenceDetails ? '收起详情' : '技术原因'}</span>
                    </button>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSettingsModal(true)}
                    className="flex h-6.5 items-center gap-1 rounded-md bg-monokai-warning/20 px-2.5 text-xs font-semibold text-monokai-warning hover:bg-monokai-warning/30 transition-colors cursor-pointer"
                  >
                    立即备份
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPersistenceBannerDismissed(true)}
                    className="flex h-6.5 w-6.5 items-center justify-center rounded-md text-monokai-comment hover:bg-monokai-surface hover:text-monokai-fg transition-colors cursor-pointer"
                    title="忽略本次警告"
                    aria-label="忽略本次警告"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {showPersistenceDetails && runtimeInfo.persistenceError && (
                <div className="mt-2 rounded-md bg-monokai-bg/90 p-2 font-mono text-[11px] text-monokai-comment select-text break-all">
                  <span className="font-bold text-monokai-warning">底层排查信息：</span>
                  {runtimeInfo.persistenceError}
                </div>
              )}
            </div>
          )}

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden p-0 relative flex flex-col">
            <React.Suspense
              fallback={<WorkbenchLoadingState label={activeFeature.label} />}
            >
              <ActiveFeatureHost
                activeTab={activeTab}
                onNavigate={setActiveTab}
                context={{
                  currentTable,
                  tableCount: tables.length,
                  runtimeLabel: runtimeInfo.persistent ? 'OPFS' : 'MEM',
                  persistent: runtimeInfo.persistent,
                }}
                renderers={{
                [Tab.DASHBOARD]: () => (
                  <ErrorBoundary section="Dashboard">
                    <div className="w-full h-full flex flex-col overflow-hidden bg-monokai-bg">
                      <Dashboard
                        tables={tables}
                        onNavigate={setActiveTab}
                        runtimeInfo={runtimeInfo}
                        onSelectTable={(tableName, filter) => handleNavigateWithContext({ targetTab: Tab.DATA, tableName, filter })}
                        onSelectTableStructure={(tableName, focusTab) => handleNavigateWithContext({ targetTab: Tab.STRUCTURE, tableName, inspectorTab: focusTab })}
                        onSelectTableAnalysis={(tableName) => handleNavigateWithContext({ targetTab: Tab.ANALYSIS_HUB, tableName })}
                        onSelectTableMetrics={(tableName) => handleNavigateWithContext({ targetTab: Tab.METRICS, tableName })}
                        onSelectTableDataFlow={(tableName) => handleNavigateWithContext({ targetTab: Tab.DATAFLOW, tableName })}
                        onSelectQuery={(sql, executeDirectly) => handleNavigateWithContext({ targetTab: Tab.SQL, sql, executeDirectly })}
                      />
                    </div>
                  </ErrorBoundary>
                ),
                [Tab.DATA]: () => (
                  <ErrorBoundary section="Data Grid">
                    <div className="w-full h-full flex flex-col overflow-hidden bg-monokai-bg">
                      <DataTab 
                        currentTable={currentTable} 
                        tableData={tableData} 
                        tableColumns={tableColumns} 
                        schema={schema} 
                        hiddenColumns={hiddenColumns} 
                        loadingData={loadingData} 
                        pagination={pagination} 
                        sortConfig={sortConfig} 
                        filterQuery={filterQuery} 
                        selectedRows={selectedRows} 
                        dataViewMode={dataViewMode} 
                        profileData={profileData} 
                        editingCell={editingCell} 
                        showColMenu={showColMenu} 
                        pkColumn={pkColumn} 
                        expandedRowIdx={expandedRowIdx} 
                        onToggleColumnVisibility={toggleColumnVisibility} 
                        onSetShowColMenu={setShowColMenu} 
                        onSetHiddenColumns={setHiddenColumns} 
                        onSetDataViewMode={setDataViewMode} 
                        onFetchProfileData={fetchProfileData} 
                        onFetchTableData={fetchTableData} 
                        onSetFilterQuery={setFilterQuery} 
                        onSetEditingCell={setEditingCell} 
                        onSaveCellEdit={saveCellEdit} 
                        onHandleSelectRow={handleSelectRow} 
                        onHandleSelectAll={handleSelectAll} 
                        onHandleBulkDelete={handleBulkDelete} 
                        onHandlePageChange={onHandlePageChange} 
                        onHandleSort={onHandleSort} 
                        onHandleApplyFilter={handleApplyFilter} 
                        onDownloadData={downloadData} 
                        onHandleInsertRow={handleInsertRow} 
                        onShowCreateModal={() => setShowCreateModal(true)} 
                        onShowImportModal={() => setShowImportModal(true)}
                        onLoadDemo={handleCreateDemo}
                        onSetExpandedRowIdx={setExpandedRowIdx} 
                        onAddNotification={addNotification} 
                        onNavigateToDashboard={() => setActiveTab(Tab.DASHBOARD)}
                        tables={tables}
                        onSelectTable={handleTableSelect}
                        onNavigateToStructure={(tbl) => handleNavigateWithContext({ targetTab: Tab.STRUCTURE, tableName: tbl })}
                        onNavigateToAnalysis={(tbl) => handleNavigateWithContext({ targetTab: Tab.ANALYSIS_HUB, tableName: tbl })}
                        onNavigateToMetrics={(tbl) => handleNavigateWithContext({ targetTab: Tab.METRICS, tableName: tbl })}
                        onNavigateToSql={(sql) => handleNavigateWithContext({ targetTab: Tab.SQL, sql })}
                      />
                    </div>
                  </ErrorBoundary>
                ),
                [Tab.STRUCTURE]: () => (
                  <ErrorBoundary section="Schema Tab">
                    <div className="w-full h-full flex flex-col overflow-hidden bg-monokai-bg">
                      <StructureTab
                        tables={tables}
                        currentTable={currentTable}
                        schema={schema}
                        fullSchemaTree={fullSchemaTree}
                        structureViewMode={structureViewMode}
                        editColumnMode={editColumnMode}
                        newColName={newColName}
                        newColType={newColType}
                        selectedColStats={selectedColStats}
                        isRenaming={isRenaming}
                        renameTableName={renameTableName}
                        initialInspectorTab={structureInspectorTab}
                        onSetStructureViewMode={setStructureViewMode}
                        onSetEditColumnMode={setEditColumnMode}
                        onSetNewColName={setNewColName}
                        onSetNewColType={setNewColType}
                        onSetSelectedColStats={setSelectedColStats}
                        onSetIsRenaming={setIsRenaming}
                        onSetRenameTableName={setRenameTableName}
                        onHandleRenameTable={handleRenameTable}
                        onHandleAddColumn={handleAddColumn}
                        onHandleDropColumn={handleDropColumn}
                        onHandleSaveColumnEdit={handleSaveColumnEdit}
                        onShowColumnStats={showColumnStats}
                        onHandleCopySchema={handleCopySchema}
                        onHandleDuplicateTable={() => currentTable && setShowDuplicateModal(true)}
                        onHandleDropTable={handleDropTable}
                        onAddNotification={addNotification}
                        onSelectTable={handleTableSelect}
                        onLoadDemo={handleCreateDemo}
                        onShowCreateModal={() => setShowCreateModal(true)}
                        onShowImportModal={() => setShowImportModal(true)}
                        onNavigateToDashboard={() => setActiveTab(Tab.DASHBOARD)}
                        onNavigateToData={(tbl) => handleNavigateWithContext({ targetTab: Tab.DATA, tableName: tbl })}
                        onNavigateToAnalysis={(tbl) => handleNavigateWithContext({ targetTab: Tab.ANALYSIS_HUB, tableName: tbl })}
                        onNavigateToMetrics={(tbl) => handleNavigateWithContext({ targetTab: Tab.METRICS, tableName: tbl })}
                        onNavigateToSql={(sql) => handleNavigateWithContext({ targetTab: Tab.SQL, sql })}
                      />
                    </div>
                  </ErrorBoundary>
                ),
                [Tab.DATAFLOW]: () => {
                  const currTab = dataflowTabs.find(t => t.id === dataflowActiveTabId) || dataflowTabs[0];
                  return (
                    <ErrorBoundary section="DataFlow Standalone">
                      <div className="w-full h-full flex flex-col overflow-hidden bg-monokai-bg">
                        <DataFlowCanvas
                          standalone={true}
                          initialMode={currTab?.sql?.trim() ? 'sql' : 'catalog'}
                          activeSql={currTab?.sql || ''}
                          activeTabTitle={currTab?.title || 'SQL 查询'}
                          tabs={dataflowTabs}
                          activeTabId={dataflowActiveTabId}
                          onSelectTab={(tabId) => {
                            setDataflowActiveTabId(tabId);
                            try {
                              const saved = localStorage.getItem('workbench_layout_state');
                              if (saved) {
                                const snap = JSON.parse(saved);
                                snap.activeTabId = tabId;
                                localStorage.setItem('workbench_layout_state', JSON.stringify(snap));
                              }
                            } catch {}
                          }}
                          onSwitchToSqlEditor={() => setActiveTab(Tab.SQL)}
                          onOpenInSqlEditor={(sql, title) => {
                            handleNavigateWithContext({ targetTab: Tab.SQL, sql });
                          }}
                        />
                      </div>
                    </ErrorBoundary>
                  );
                },
                [Tab.SQL]: () => (
                  <ErrorBoundary section="Workbench">
                    <div className="w-full h-full flex flex-col overflow-hidden bg-monokai-bg">
                      <WorkbenchView
                        tables={tables}
                        currentTable={currentTable}
                        runtimeInfo={runtimeInfo}
                        onRefreshTables={refreshTables}
                        onSelectTable={handleTableSelect}
                        onOpenFile={() => setShowImportModal(true)}
                        onAttachDatabase={() => setShowImportModal(true)}
                        onAddDataSource={() => setShowImportModal(true)}
                        schema={schema}
                        profileData={profileData}
                        onNavigateToDataFlow={() => setActiveTab(Tab.DATAFLOW)}
                      />
                    </div>
                  </ErrorBoundary>
                ),
                [Tab.HISTORY]: () => (
                  <ErrorBoundary section="History">
                    <div className="w-full h-full flex flex-col overflow-hidden bg-monokai-bg">
                      <HistoryTab />
                    </div>
                  </ErrorBoundary>
                ),
                [Tab.TUTORIALS]: () => (
                  <ErrorBoundary section="KnowledgeHub">
                    <div className="w-full h-full flex flex-col overflow-hidden bg-monokai-bg">
                      <KnowledgeHubApp
                        onTryCode={(code) => { setPendingSql(code); setActiveTab(Tab.SQL); }}
                        onOpenTable={(tableName) => { handleTableSelect(tableName); setActiveTab(Tab.DATA); }}
                        onNavigateToMetrics={() => setActiveTab(Tab.METRICS)}
                      />
                    </div>
                  </ErrorBoundary>
                ),
                [Tab.ANALYSIS_HUB]: () => (
                  <ErrorBoundary section="Analysis Hub">
                    <div className="w-full h-full flex flex-col overflow-hidden bg-monokai-bg">
                      <AnalysisHubPanel
                        runtimeInfo={runtimeInfo}
                        onInsertSql={(sql, executeDirectly) => {
                          setPendingSql(sql);
                          setActiveTab(Tab.SQL);
                          if (executeDirectly) {
                            setTimeout(() => {
                              window.dispatchEvent(new CustomEvent('duckdb_execute_sql', { detail: { sql } }));
                            }, 50);
                          }
                        }}
                        onNavigateToDashboard={() => setActiveTab(Tab.DASHBOARD)}
                      />
                    </div>
                  </ErrorBoundary>
                ),
                [Tab.METRICS]: () => (
                  <ErrorBoundary section="Metrics">
                    <div className="w-full h-full flex flex-col overflow-hidden bg-monokai-bg">
                      <MetricManager
                        tables={tables}
                        currentTable={currentTable}
                        onExecuteSql={(sql) => { setPendingSql(sql); setActiveTab(Tab.SQL); }}
                        onChartGenerated={handleChartGenerated}
                        onNavigateToDashboard={() => setActiveTab(Tab.DASHBOARD)}
                      />
                    </div>
                  </ErrorBoundary>
                ),
                [Tab.AUDIT]: () => (
                  <ErrorBoundary section="Audit Log">
                    <div className="w-full h-full flex flex-col overflow-hidden bg-monokai-bg">
                      <AuditTab auditLogs={auditLogs} onRefresh={refreshAudit} />
                    </div>
                  </ErrorBoundary>
                ),
                [Tab.EXTENSIONS]: () => (
                  <ErrorBoundary section="Extensions">
                    <div className="w-full h-full flex flex-col overflow-hidden bg-monokai-bg">
                      <Extensions onTryExtension={(sql) => { setPendingSql(sql); setActiveTab(Tab.SQL); }} />
                    </div>
                  </ErrorBoundary>
                ),
                [Tab.AI_SKILLS]: () => (
                  <ErrorBoundary section="AI Skills">
                    <div className="w-full h-full flex flex-col overflow-hidden bg-monokai-bg">
                      <SkillPanel isOpen={true} onClose={() => setActiveTab(Tab.DASHBOARD)} onExecuteSql={(sql) => { setPendingSql(sql); setActiveTab(Tab.SQL); }} currentTable={currentTable || undefined} currentColumns={schema.map(col => ({ name: col.name, type: col.type }))} />
                    </div>
                  </ErrorBoundary>
                ),
                [Tab.LIBRARY]: () => (
                  <ErrorBoundary section="KnowledgeHub">
                    <div className="w-full h-full flex flex-col overflow-hidden bg-monokai-bg">
                      <KnowledgeHubApp
                        isOpen={true}
                        onClose={() => setActiveTab(Tab.DASHBOARD)}
                        onTryCode={(sql) => { setPendingSql(sql); setActiveTab(Tab.SQL); }}
                        onOpenTable={(tableName) => { handleTableSelect(tableName); setActiveTab(Tab.DATA); }}
                        onNavigateToMetrics={() => setActiveTab(Tab.METRICS)}
                      />
                    </div>
                  </ErrorBoundary>
                ),
                [Tab.AI_CAPABILITIES]: () => (
                  <ErrorBoundary section="AI Capabilities Library">
                    <div className="w-full h-full flex flex-col overflow-hidden bg-monokai-bg">
                      <AiCapabilityLibraryApp
                        isOpen={true}
                        onClose={() => setActiveTab(Tab.DASHBOARD)}
                        onExecuteCapabilityInEditor={(cap) => {
                          setActiveTab(Tab.SQL);
                          setTimeout(() => {
                            window.dispatchEvent(
                              new CustomEvent('duckdb_execute_capability', { detail: { capability: cap } })
                            );
                          }, 60);
                        }}
                      />
                    </div>
                  </ErrorBoundary>
                ),
                [Tab.ONTOLOGY]: () => (
                  <ErrorBoundary section="Ontology">
                    <div className="w-full h-full flex flex-col overflow-hidden bg-monokai-bg">
                      <OntologyApp isOpen={true} isActive={true} onClose={() => setActiveTab(Tab.DASHBOARD)} onInsertToEditor={(sql) => { setPendingSql(sql); setActiveTab(Tab.SQL); }} onTablesReady={() => refreshTables()} />
                    </div>
                  </ErrorBoundary>
                ),
                [Tab.COMPOSITIONAL_DEDUCTION]: () => (
                  <ErrorBoundary section="Compositional Deduction">
                    <div className="w-full h-full flex flex-col overflow-hidden bg-monokai-bg">
                      <CompositionalDeductionApp
                        isOpen={true}
                        isActive={true}
                        onClose={() => setActiveTab(Tab.DASHBOARD)}
                        onInsertToEditor={(sql) => {
                          setPendingSql(sql);
                          setActiveTab(Tab.SQL);
                        }}
                      />
                    </div>
                  </ErrorBoundary>
                ),
                }}
              />
            </React.Suspense>
        </div>
      </main>

      {/* Full-width Bottom Status Bar matching 00-reference.png */}
      <StudioBottomBar
        runtimeInfo={runtimeInfo}
        onRefresh={() => {
          void refreshTables();
          void refreshAudit();
        }}
      />

      <AICooldownBanner />
      <ToastPortal toasts={toasts} onRemove={removeToast} onClearAll={clearAllToasts} />
    </div>
  );
};

const App: React.FC = () => (
  <ConfirmDialogProvider>
    <AppContent />
  </ConfirmDialogProvider>
);

export default App;
