import React, { useEffect, useCallback, useState } from 'react';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { duckDBService } from './services/duckdbService';
import { Tab, Notification, ColumnInfo, ColumnStats, MetricChart } from './types';
import { SqlEditor } from './components/SqlEditor';
import { Extensions } from './components/Extensions';
import { Dashboard } from './components/Dashboard';
import { LearnApp } from './components/Learn';
import { AICooldownBanner } from './components/AICooldownBanner';
import { MetricManager } from './components/MetricManager';
import { SkillPanel } from './components/skills/SkillPanel';
import { LibraryApp, OntologyApp } from './components/Library';
import { AnalysisHubPanel } from './components/AnalysisHub/AnalysisHubPanel';
import { ExportModal } from './components/ExportModal';
import { CreateTableModal } from './components/CreateTableModal';
import { DuplicateTableModal } from './components/DuplicateTableModal';
import { ImportWizard } from './components/ImportWizard';
import { RowDetailPanel } from './components/RowDetailPanel';
import { CommandPalette } from './components/CommandPalette';
import { SettingsModal } from './components/SettingsModal';
import { DataTab } from './components/DataTab';
import { StructureTab } from './components/StructureTab';
import { AuditTab } from './components/AuditTab';
import { useAppStore } from './hooks/store/useAppStore';

const App: React.FC = () => {
  const {
    activeTab, setActiveTab,
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

  // ── Data View State (Data Tab 私有) ──
  const [dataViewMode, setDataViewMode] = useState<'grid' | 'profile'>('grid');
  const [tableData, setTableData] = useState<any[]>([]);
  const [tableColumns, setTableColumns] = useState<string[]>([]);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [loadingData, setLoadingData] = useState(false);
  const [pagination, setPagination] = useState({ limit: 50, offset: 0, total: 0 });
  const [schema, setSchema] = useState<ColumnInfo[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'ASC' | 'DESC' } | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<any>>(new Set());
  const [profileData, setProfileData] = useState<any[]>([]);
  const [expandedRowIdx, setExpandedRowIdx] = useState<number | null>(null);
  const [showColMenu, setShowColMenu] = useState(false);
  const [editingCell, setEditingCell] = useState<{ rowIdx: number, col: string, val: any } | null>(null);

  // ── Structure View State (Schema Tab 私有) ──
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState('VARCHAR');
  const [selectedColStats, setSelectedColStats] = useState<{ col: string, stats: ColumnStats } | null>(null);
  const [renameTableName, setRenameTableName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [editColumnMode, setEditColumnMode] = useState<{ colName: string, newName: string, newType: string } | null>(null);
  const [structureViewMode, setStructureViewMode] = useState<'list' | 'graph'>('list');
  const [fullSchemaTree, setFullSchemaTree] = useState<Record<string, ColumnInfo[]>>({});

  // ── UI State ──
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  const [availableModels, setAvailableModels] = useState<{ id: string; name: string }[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  // ── Init & Refresh ─────────────────────────────────────────────
  const refreshTables = useCallback(async () => {
    try {
      const t = await duckDBService.getTables();
      setTables(t);
    } catch (e) { console.error(e); }
  }, [setTables]);

  const refreshAudit = useCallback(async () => {
    try {
      const logs = await duckDBService.query("SELECT * FROM memory._sys_audit_log ORDER BY log_time DESC LIMIT 100");
      setAuditLogs(logs);
    } catch (e) { console.error(e); }
  }, [setAuditLogs]);

  useEffect(() => {
    duckDBService.init()
      .then(async () => {
        setIsReady(true);
        await refreshTables();
      })
      .catch((e) => setInitError(e.message));
  }, [refreshTables]);

  // Load full schema for ER Diagram
  useEffect(() => {
    const loadSchema = async () => {
      if (activeTab === Tab.STRUCTURE && tables.length > 0) {
        const tree: Record<string, ColumnInfo[]> = {};
        for (const t of tables) {
          tree[t] = await duckDBService.getTableSchema(t);
        }
        setFullSchemaTree(tree);
      }
    };
    loadSchema();
  }, [activeTab, tables]);

  // Sync API key from other tabs / localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      useAppStore.setState({
        aiApiKey: localStorage.getItem('duckdb_ai_api_key') || '',
        aiProvider: localStorage.getItem('duckdb_ai_provider') || 'google',
      });
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // ── Data Fetching ─────────────────────────────────────────────
  const fetchTableData = async (tableName: string, offset: number, limit: number, currentSort = sortConfig, currentFilter = filterQuery) => {
    setLoadingData(true);
    try {
      const whereClause = currentFilter.trim() ? `WHERE ${currentFilter}` : '';
      const countQuery = `SELECT COUNT(*) as c FROM "${tableName}" ${whereClause}`;
      let total = 0;
      try {
        const countRes = await duckDBService.query(countQuery);
        total = Number(countRes[0].c);
      } catch (e: any) { throw new Error(`Invalid Filter: ${e.message}`); }

      const schemaInfo = await duckDBService.getTableSchema(tableName);
      setSchema(schemaInfo);
      setTableColumns(schemaInfo.map((c: any) => c.name));

      let query = `SELECT * FROM "${tableName}" ${whereClause}`;
      if (currentSort) {
        query += ` ORDER BY "${currentSort.key}" ${currentSort.direction}`;
      } else {
        const pk = schemaInfo.find((c: any) => c.pk);
        if (pk) query += ` ORDER BY "${pk.name}" ASC`;
      }
      query += ` LIMIT ${limit} OFFSET ${offset}`;

      const data = await duckDBService.query(query);
      setTableData(data);
      setPagination({ limit, offset, total });
      setSelectedRows(new Set());
    } catch (e: any) {
      addNotification(`Data Load Error: ${e.message}`, 'error');
      setTableData([]);
    } finally { setLoadingData(false); }
  };

  const fetchProfileData = async (tableName: string) => {
    setLoadingData(true);
    try {
      const profile = await duckDBService.query(`SUMMARIZE SELECT * FROM "${tableName}"`);
      setProfileData(profile);
    } catch (e: any) { addNotification(`Profiling failed: ${e.message}`, 'error'); }
    finally { setLoadingData(false); }
  };

  // ── Data Operations ────────────────────────────────────────────
  const handleTableSelect = async (name: string) => {
    setCurrentTable(name);
    setActiveTab(Tab.DATA);
    setPagination(prev => ({ ...prev, offset: 0 }));
    setSortConfig(null);
    setFilterQuery('');
    setIsRenaming(false);
    setDataViewMode('grid');
    setHiddenColumns(new Set());
    await fetchTableData(name, 0, pagination.limit, null, '');
    setSelectedColStats(null);
  };

  const handlePageChange = (newOffset: number) => {
    if (newOffset < 0 || (pagination.total > 0 && newOffset >= pagination.total)) return;
    if (currentTable) fetchTableData(currentTable, newOffset, pagination.limit);
  };

  const handleSort = (key: string) => {
    let direction: 'ASC' | 'DESC' = 'ASC';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ASC') direction = 'DESC';
    const newSort = { key, direction };
    setSortConfig(newSort);
    if (currentTable) fetchTableData(currentTable, 0, pagination.limit, newSort);
  };

  const handleApplyFilter = () => {
    if (currentTable) fetchTableData(currentTable, 0, pagination.limit);
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
      await duckDBService.executeAndAudit(
        "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name VARCHAR, age INTEGER, email VARCHAR); INSERT INTO users VALUES (1, 'Alice', 30, 'alice@example.com'), (2, 'Bob', 25, 'bob@test.com'), (3, 'Charlie', 35, 'charlie@corp.com');",
        'CREATE', 'users', 'Created demo table'
      );
      addNotification('Demo table "users" created', 'success');
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
    if (!confirm(`Drop table "${currentTable}"? This cannot be undone.`)) return;
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
      const countRes = await duckDBService.query(`SELECT COUNT(*) as c FROM "${currentTable}"`);
      const total = Number(countRes[0].c);
      const lastPageOffset = Math.floor(Math.max(0, total - 1) / pagination.limit) * pagination.limit;
      if (lastPageOffset !== pagination.offset) fetchTableData(currentTable, lastPageOffset, pagination.limit);
      else fetchTableData(currentTable, pagination.offset, pagination.limit);
    } catch (e: any) { addNotification(`Insert failed: ${e.message}`, 'error'); }
  };

  const handleCellEdit = (rowIdx: number, col: string, val: any) => {
    const pkCol = schema.find(c => c.pk);
    if (!pkCol) { addNotification("Cannot edit tables without a Primary Key", 'info'); return; }
    setEditingCell({ rowIdx, col, val });
  };

  const saveCellEdit = async () => {
    if (!editingCell || !currentTable) return;
    const { rowIdx, col, val } = editingCell;
    const row = tableData[rowIdx];
    const pkCol = schema.find(c => c.pk);
    if (!pkCol) return;
    if (row[col] === val) { setEditingCell(null); return; }
    try {
      await duckDBService.updateRow(currentTable, pkCol.name, row[pkCol.name], col, val);
      addNotification('Value updated', 'success');
      setEditingCell(null);
      fetchTableData(currentTable, pagination.offset, pagination.limit);
    } catch (e: any) { addNotification(`Update failed: ${e.message}`, 'error'); }
  };

  const handleSelectRow = (pkVal: any, selected: boolean) => {
    const newSet = new Set(selectedRows);
    if (selected) newSet.add(pkVal); else newSet.delete(pkVal);
    setSelectedRows(newSet);
  };

  const handleSelectAll = (selected: boolean) => {
    if (!currentTable) return;
    const pkCol = schema.find(c => c.pk);
    if (!pkCol) return;
    if (selected) {
      const newSet = new Set<any>();
      tableData.forEach(r => newSet.add(r[pkCol.name]));
      setSelectedRows(newSet);
    } else { setSelectedRows(new Set()); }
  };

  const handleBulkDelete = async () => {
    if (!currentTable || selectedRows.size === 0) return;
    if (!confirm(`Delete ${selectedRows.size} rows?`)) return;
    const pkCol = schema.find(c => c.pk);
    if (!pkCol) return;
    try {
      await duckDBService.deleteRows(currentTable, pkCol.name, Array.from(selectedRows));
      addNotification(`Deleted ${selectedRows.size} rows`, 'success');
      setSelectedRows(new Set());
      fetchTableData(currentTable, pagination.offset, pagination.limit);
    } catch (e: any) { addNotification(`Bulk delete failed: ${e.message}`, 'error'); }
  };

  const handleAddColumn = async () => {
    if (!currentTable) { addNotification('Please select a table first', 'error'); return; }
    if (!newColName) { addNotification('Please enter a column name', 'error'); return; }
    try {
      await duckDBService.addColumn(currentTable, newColName, newColType);
      addNotification(`Column ${newColName} added`, 'success');
      setNewColName('');
      const s = await duckDBService.getTableSchema(currentTable);
      setSchema(s);
      setTableColumns(s.map((c: any) => c.name));
    } catch (e: any) { addNotification(`Failed to add column: ${e.message}`, 'error'); }
  };

  const handleDropColumn = async (colName: string) => {
    if (!currentTable) return;
    if (!confirm(`Drop column "${colName}"?`)) return;
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
    const ddl = `CREATE TABLE ${currentTable} (\n  ${schema.map(c => `${c.name} ${c.type}${c.pk ? ' PRIMARY KEY' : ''}`).join(',\n  ')}\n);`;
    navigator.clipboard.writeText(ddl);
    addNotification('Schema copied to clipboard', 'success');
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
  const setAiProvider = (v: string) => useAppStore.setState({ aiProvider: v });
  const setAiApiKey = (v: string) => useAppStore.setState({ aiApiKey: v });
  const setAiBaseUrl = (v: string) => useAppStore.setState({ aiBaseUrl: v });
  const setAiModel = (v: string) => useAppStore.setState({ aiModel: v });

  // ── Workspace Backup/Restore ─────────────────────────────────────
  const handleExportWorkspace = () => {
    const backup = {
      history: localStorage.getItem('duckdb_sql_history'),
      saved: localStorage.getItem('duckdb_saved_queries'),
      timestamp: Date.now()
    };
    const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `duckdb_workspace_${new Date().toISOString().split('T')[0]}.json`; a.click();
    addNotification('Workspace exported', 'success');
  };

  const handleImportWorkspace = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const backup = JSON.parse(ev.target?.result as string);
        if (backup.history) localStorage.setItem('duckdb_sql_history', backup.history);
        if (backup.saved) localStorage.setItem('duckdb_saved_queries', backup.saved);
        addNotification('Workspace restored! Refreshing...', 'success');
        setTimeout(() => window.location.reload(), 1500);
      } catch { addNotification('Invalid workspace file', 'error'); }
    };
    reader.readAsText(file);
  };

  // ── Derived ─────────────────────────────────────────────────────
  if (initError) return <div className="h-screen flex items-center justify-center bg-monokai-bg text-monokai-pink font-mono p-4 text-center"><div><h1 className="text-2xl mb-2">Initialize Error</h1>{initError}</div></div>;
  if (!isReady) return <div className="h-screen flex items-center justify-center bg-monokai-bg text-monokai-blue font-mono animate-pulse"><span className="text-4xl mr-4">🦆</span> Initializing DuckDB WASM...</div>;
  const pkColumn = schema.find(c => c.pk);

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden text-monokai-fg flex-col">
      {/* Command Palette */}
      <CommandPalette
        tables={tables}
        currentTable={currentTable}
        onSelectTable={handleTableSelect}
        onSetActiveTab={(tab) => setActiveTab(Tab[tab as keyof typeof Tab])}
        onOpenCreateTable={() => setShowCreateModal(true)}
        onOpenImportWizard={() => setShowImportModal(true)}
        onOpenExport={() => setShowExportModal(true)}
        onOpenSettings={() => setShowSettingsModal(true)}
        onAction={(prompt) => { setPendingSql(prompt); setActiveTab(Tab.AI_SKILLS); }}
      />

      {/* Modals */}
      <CreateTableModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} onTableCreated={handleTableSelect} onRefreshTables={refreshTables} onNotify={addNotification} />
      <DuplicateTableModal isOpen={showDuplicateModal} onClose={() => setShowDuplicateModal(false)} sourceTable={currentTable} onTableCreated={handleTableSelect} onRefreshTables={refreshTables} onNotify={addNotification} />
      <RowDetailPanel isOpen={expandedRowIdx !== null} expandedRowIdx={expandedRowIdx} tableData={tableData} onClose={() => setExpandedRowIdx(null)} onNavigatePrev={() => setExpandedRowIdx(Math.max(0, (expandedRowIdx ?? 0) - 1))} onNavigateNext={() => setExpandedRowIdx(Math.min(tableData.length - 1, (expandedRowIdx ?? 0) + 1))} />
      <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} aiProvider={aiProvider} aiApiKey={aiApiKey} aiBaseUrl={aiBaseUrl} aiModel={aiModel} availableModels={availableModels} loadingModels={loadingModels} onSetAiProvider={setAiProvider} onSetAiApiKey={setAiApiKey} onSetAiBaseUrl={setAiBaseUrl} onSetAiModel={setAiModel} onSetAvailableModels={setAvailableModels} onSetLoadingModels={setLoadingModels} onNotify={addNotification} onExportWorkspace={handleExportWorkspace} onImportWorkspace={handleImportWorkspace} />
      <ImportWizard isOpen={showImportModal} onClose={() => setShowImportModal(false)} onImportComplete={() => {}} onRefreshTables={refreshTables} onNotify={addNotification} />
      <ExportModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} />

      {/* Toast Notifications */}
      <div className="fixed bottom-10 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {notifications.map(n => (
          <div key={n.id} className={`pointer-events-auto px-4 py-3 rounded shadow-lg border-l-4 text-sm font-bold flex items-center gap-2 animate-[slideIn_0.3s_ease-out]
            ${n.type === 'success' ? 'bg-monokai-sidebar border-monokai-green text-monokai-green' : n.type === 'error' ? 'bg-monokai-sidebar border-monokai-pink text-monokai-pink' : 'bg-monokai-sidebar border-monokai-blue text-monokai-blue'}`}>
            <span>{n.type === 'success' ? '✓' : n.type === 'error' ? '✕' : 'ℹ'}</span>{n.message}
          </div>
        ))}
      </div>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className={`flex-shrink-0 bg-monokai-sidebar border-r border-monokai-accent flex flex-col transition-all duration-300 ${isSidebarCollapsed ? 'w-14' : 'w-64'}`}>
          <div className={`p-3 border-b border-monokai-accent/50 bg-gradient-to-r from-monokai-bg to-monokai-sidebar flex items-center gap-3 cursor-pointer hover:from-monokai-accent/20 hover:to-monokai-accent/10 transition-all ${isSidebarCollapsed ? 'justify-center' : ''}`} onClick={() => setActiveTab(Tab.DASHBOARD)} title="Dashboard">
            <span className="text-2xl">🦆</span>
            {!isSidebarCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-monokai-green truncate">DuckDB Pro</span>
                <span className="text-[9px] text-monokai-comment bg-monokai-bg/60 px-1.5 py-0.5 rounded w-fit">WASM Edition</span>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-3 bg-monokai-bg">
            {!isSidebarCollapsed && (
              <>
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xs uppercase text-monokai-yellow font-bold tracking-wider flex items-center gap-2"><span>📋</span> Tables</h3>
                    <button onClick={() => setShowCreateModal(true)} className="text-monokai-green hover:text-white w-6 h-6 flex items-center justify-center rounded-full hover:bg-monokai-green/20 transition-all text-lg" title="Create Table">+</button>
                  </div>
                  <div className="bg-monokai-surface/50 rounded-lg border border-monokai-accent/30 p-2 min-h-[80px]">
                    {tables.length > 0 ? (
                      <ul className="space-y-0.5">
                        {tables.map(t => (
                          <li key={t}>
                            <button onClick={() => handleTableSelect(t)} className={`w-full text-left px-2 py-1.5 rounded text-sm font-mono truncate transition-all ${currentTable === t && activeTab !== Tab.DASHBOARD ? 'bg-monokai-pink text-white shadow-sm' : 'text-monokai-fg hover:bg-monokai-accent/60 hover:pl-3'}`}>▸ {t}</button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-xs text-monokai-comment italic mb-3">No tables yet</p>
                        <button onClick={handleCreateDemo} className="text-xs text-monokai-blue hover:text-white underline decoration-dotted underline-offset-2">Load Demo Data</button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mb-6">
                  <h3 className="text-xs uppercase text-monokai-cyan font-bold mb-3 tracking-wider flex items-center gap-2"><span>⚡</span> Data I/O</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setShowImportModal(true)} className="flex flex-col items-center justify-center gap-1 py-3 px-2 border border-dashed border-monokai-blue/40 rounded-lg text-xs text-monokai-blue hover:bg-monokai-blue/15 hover:border-monokai-blue transition-all"><span className="text-xl">📥</span> Import</button>
                    <button onClick={() => setShowExportModal(true)} className="flex flex-col items-center justify-center gap-1 py-3 px-2 border border-dashed border-monokai-orange/40 rounded-lg text-xs text-monokai-orange hover:bg-monokai-orange/15 hover:border-monokai-orange transition-all"><span className="text-xl">📤</span> Export</button>
                  </div>
                </div>
                <div className="mb-4">
                  <div className="bg-gradient-to-br from-monokai-bg to-monokai-sidebar/50 rounded-lg p-3 border border-monokai-accent/30">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-monokai-comment uppercase tracking-wider">Database</span>
                      <span className="text-[10px] font-bold text-monokai-green flex items-center gap-1">● Ready</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-monokai-comment">Total Tables</span>
                      <span className="text-sm font-bold text-monokai-fg">{tables.length}</span>
                    </div>
                  </div>
                </div>
              </>
            )}
            {isSidebarCollapsed && (
              <div className="flex flex-col gap-3 items-center mt-2">
                <button onClick={() => setShowCreateModal(true)} className="text-monokai-green text-xl hover:scale-110 transition-transform" title="Create Table">+</button>
                <button onClick={() => setShowImportModal(true)} className="text-monokai-blue text-xl hover:scale-110 transition-transform" title="Import Data">📥</button>
                <button onClick={() => setShowExportModal(true)} className="text-monokai-orange text-xl hover:scale-110 transition-transform" title="Export DB">📤</button>
              </div>
            )}
          </div>
          <div className="p-2 border-t border-monokai-accent bg-monokai-bg flex flex-col gap-2 justify-center">
            {!isSidebarCollapsed && (
              <button onClick={() => setShowSettingsModal(true)} className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-monokai-comment hover:text-white hover:bg-monokai-accent rounded transition-colors w-full"><span>⚙️</span> Settings & Backup</button>
            )}
            {isSidebarCollapsed && (
              <button onClick={() => setShowSettingsModal(true)} className="text-lg hover:text-white text-monokai-comment" title="Settings">⚙️</button>
            )}
            <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="text-monokai-comment hover:text-white text-center w-full">{isSidebarCollapsed ? '»' : '«'}</button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-monokai-bg">
          {/* Top Nav */}
          <div className="h-14 border-b border-monokai-accent/50 flex items-center px-4 gap-3 bg-monokai-sidebar shrink-0 overflow-x-auto">
            <div className="flex items-center gap-1">
              {[
                { id: Tab.DASHBOARD, label: 'Dashboard', icon: '🏠' },
                { id: Tab.DATA, label: 'Data', icon: '📊' },
                { id: Tab.STRUCTURE, label: 'Schema', icon: '📐' },
                { id: Tab.SQL, label: 'SQL', icon: '📝' },
              ].map(tab => (
                <button key={tab.id} onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === Tab.DATA && currentTable) fetchTableData(currentTable, pagination.offset, pagination.limit);
                }} className={`h-9 px-3 flex items-center gap-2 text-sm font-medium transition-all rounded-md relative ${activeTab === tab.id ? 'bg-monokai-bg text-monokai-fg' : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-bg/30'}`}>
                  <span>{tab.icon}</span> {tab.label}
                  {activeTab === tab.id && <div className="absolute bottom-0 left-1 right-1 h-0.5 bg-monokai-green rounded-full" />}
                </button>
              ))}
            </div>
            <div className="w-px h-8 bg-monokai-accent/30 shrink-0" />
            <div className="flex items-center gap-1">
              {[
                { id: Tab.ANALYSIS_HUB, label: 'Analysis Hub', icon: '🤖' },
                { id: Tab.METRICS, label: 'Metrics', icon: '📈' },
                { id: Tab.AUDIT, label: 'Logs', icon: '📜' },
              ].map(tab => (
                <button key={tab.id} onClick={() => { setActiveTab(tab.id); if (tab.id === Tab.AUDIT) refreshAudit(); }} className={`h-9 px-3 flex items-center gap-2 text-sm font-medium transition-all rounded-md relative ${activeTab === tab.id ? 'bg-monokai-bg text-monokai-fg' : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-bg/30'}`}>
                  <span>{tab.icon}</span> {tab.label}
                  {activeTab === tab.id && <div className="absolute bottom-0 left-1 right-1 h-0.5 bg-monokai-purple rounded-full" />}
                </button>
              ))}
            </div>
            <div className="w-px h-8 bg-monokai-accent/30 shrink-0" />
            <div className="flex items-center gap-1">
              {[
                { id: Tab.EXTENSIONS, label: 'Plugins', icon: '🧩' },
                { id: Tab.TUTORIALS, label: 'Learn', icon: '🎓' },
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`h-9 px-3 flex items-center gap-2 text-sm font-medium transition-all rounded-md relative ${activeTab === tab.id ? 'bg-monokai-bg text-monokai-fg' : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-bg/30'}`}>
                  <span>{tab.icon}</span> {tab.label}
                  {activeTab === tab.id && <div className="absolute bottom-0 left-1 right-1 h-0.5 bg-monokai-blue rounded-full" />}
                </button>
              ))}
              <button onClick={() => setActiveTab(Tab.AI_SKILLS)} className={`h-9 px-3 flex items-center gap-2 text-sm font-medium transition-all rounded-md relative font-sans ${activeTab === Tab.AI_SKILLS ? 'bg-monokai-bg text-monokai-fg' : 'text-monokai-purple hover:text-monokai-fg hover:bg-monokai-purple/20'}`}><span>⚡</span> AI Skills</button>
              <button onClick={() => setActiveTab(Tab.LIBRARY)} className={`h-9 px-3 flex items-center gap-2 text-sm font-medium transition-all rounded-md relative font-sans ${activeTab === Tab.LIBRARY ? 'bg-monokai-bg text-monokai-fg' : 'text-monokai-blue hover:text-monokai-fg hover:bg-monokai-blue/20'}`}><span>📚</span> Library</button>
              <button onClick={() => setActiveTab(Tab.ONTOLOGY)} className={`h-9 px-3 flex items-center gap-2 text-sm font-medium transition-all rounded-md relative ${activeTab === Tab.ONTOLOGY ? 'bg-monokai-bg text-monokai-fg' : 'text-monokai-purple hover:text-monokai-fg hover:bg-monokai-purple/20'}`}><span>🕸️</span> Ontology</button>
            </div>
            <div className="flex-1" />
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden p-0 relative flex flex-col">
            <ErrorBoundary section="Dashboard"><div className={activeTab === Tab.DASHBOARD ? 'block h-full' : 'hidden'}><Dashboard tables={tables} onNavigate={setActiveTab} /></div></ErrorBoundary>
            <ErrorBoundary section="Data Tab"><div className={activeTab === Tab.DATA ? 'block h-full' : 'hidden'}>
              <DataTab currentTable={currentTable} tableData={tableData} tableColumns={tableColumns} schema={schema} hiddenColumns={hiddenColumns} loadingData={loadingData} pagination={pagination} sortConfig={sortConfig} filterQuery={filterQuery} selectedRows={selectedRows} dataViewMode={dataViewMode} profileData={profileData} editingCell={editingCell} showColMenu={showColMenu} pkColumn={pkColumn} expandedRowIdx={expandedRowIdx} onToggleColumnVisibility={(col) => { const ns = new Set(hiddenColumns); hiddenColumns.has(col) ? ns.delete(col) : ns.add(col); setHiddenColumns(ns); }} onSetShowColMenu={setShowColMenu} onSetHiddenColumns={setHiddenColumns} onSetDataViewMode={setDataViewMode} onFetchProfileData={fetchProfileData} onFetchTableData={fetchTableData} onSetFilterQuery={setFilterQuery} onSetEditingCell={setEditingCell} onSaveCellEdit={saveCellEdit} onHandleSelectRow={handleSelectRow} onHandleSelectAll={handleSelectAll} onHandleBulkDelete={handleBulkDelete} onHandlePageChange={handlePageChange} onHandleSort={handleSort} onHandleApplyFilter={handleApplyFilter} onDownloadData={downloadData} onHandleInsertRow={handleInsertRow} onSetExpandedRowIdx={setExpandedRowIdx} onAddNotification={addNotification} />
            </div></ErrorBoundary>
            <ErrorBoundary section="Schema Tab"><div className={activeTab === Tab.STRUCTURE ? 'block h-full' : 'hidden'}>
              <StructureTab tables={tables} currentTable={currentTable} schema={schema} fullSchemaTree={fullSchemaTree} structureViewMode={structureViewMode} editColumnMode={editColumnMode} newColName={newColName} newColType={newColType} selectedColStats={selectedColStats} isRenaming={isRenaming} renameTableName={renameTableName} onSetStructureViewMode={setStructureViewMode} onSetEditColumnMode={setEditColumnMode} onSetNewColName={setNewColName} onSetNewColType={setNewColType} onSetSelectedColStats={setSelectedColStats} onSetIsRenaming={setIsRenaming} onSetRenameTableName={setRenameTableName} onHandleRenameTable={handleRenameTable} onHandleAddColumn={handleAddColumn} onHandleDropColumn={handleDropColumn} onHandleSaveColumnEdit={handleSaveColumnEdit} onShowColumnStats={showColumnStats} onHandleCopySchema={handleCopySchema} onHandleDuplicateTable={() => currentTable && setShowDuplicateModal(true)} onHandleDropTable={handleDropTable} onAddNotification={addNotification} />
            </div></ErrorBoundary>
            <ErrorBoundary section="SQL Editor"><div className={activeTab === Tab.SQL ? 'block h-full' : 'hidden'}>
              <div className="h-full p-4 bg-monokai-bg">
                <SqlEditor onRun={() => { refreshTables(); refreshAudit(); }} initialCode={pendingSql} pendingChartConfig={pendingChartConfig} isZenMode={isZenMode} onToggleZen={() => setIsZenMode(!isZenMode)} onPendingConsumed={handlePendingConsumed} />
              </div>
            </div></ErrorBoundary>
            <ErrorBoundary section="Tutorials"><div className={activeTab === Tab.TUTORIALS ? 'block h-full' : 'hidden'}>
              <LearnApp onTryCode={(code) => { setPendingSql(code); setActiveTab(Tab.SQL); }} onOpenTable={(tableName) => { handleTableSelect(tableName); setActiveTab(Tab.DATA); }} />
            </div></ErrorBoundary>
            <ErrorBoundary section="Analysis Hub"><div className={activeTab === Tab.ANALYSIS_HUB ? 'block h-full' : 'hidden'}>
              <AnalysisHubPanel onInsertSql={(sql) => { setPendingSql(sql); setActiveTab(Tab.SQL); }} />
            </div></ErrorBoundary>
            <ErrorBoundary section="Metrics"><div className={activeTab === Tab.METRICS ? 'block h-full' : 'hidden'}>
              <MetricManager tables={tables} onExecuteSql={(sql) => { setPendingSql(sql); setActiveTab(Tab.SQL); }} onChartGenerated={handleChartGenerated} />
            </div></ErrorBoundary>
            <ErrorBoundary section="Audit Log"><div className={activeTab === Tab.AUDIT ? 'block h-full' : 'hidden'}>
              <AuditTab auditLogs={auditLogs} />
            </div></ErrorBoundary>
            <ErrorBoundary section="Extensions"><div className={activeTab === Tab.EXTENSIONS ? 'block h-full' : 'hidden'}>
              <div className="bg-monokai-bg h-full"><Extensions onTryExtension={(sql) => { setPendingSql(sql); setActiveTab(Tab.SQL); }} /></div>
            </div></ErrorBoundary>
            <ErrorBoundary section="AI Skills"><div className={activeTab === Tab.AI_SKILLS ? 'block h-full' : 'hidden'}>
              <div className="bg-monokai-bg h-full">
                <SkillPanel isOpen={true} onClose={() => setActiveTab(Tab.DASHBOARD)} onExecuteSql={(sql) => { setPendingSql(sql); setActiveTab(Tab.SQL); }} currentTable={currentTable || undefined} currentColumns={schema.map(col => ({ name: col.name, type: col.type }))} />
              </div>
            </div></ErrorBoundary>
            <ErrorBoundary section="Library"><div className={activeTab === Tab.LIBRARY ? 'block h-full' : 'hidden'}>
              <div className="bg-monokai-bg h-full">
                <LibraryApp isOpen={true} onClose={() => setActiveTab(Tab.DASHBOARD)} onInsertToEditor={(sql) => { setPendingSql(sql); setActiveTab(Tab.SQL); }} />
              </div>
            </div></ErrorBoundary>
            <ErrorBoundary section="Ontology"><div className={activeTab === Tab.ONTOLOGY ? 'flex flex-1 w-full h-full overflow-hidden' : 'hidden'}>
              <OntologyApp isOpen={true} onClose={() => setActiveTab(Tab.DASHBOARD)} onInsertToEditor={(sql) => { setPendingSql(sql); setActiveTab(Tab.SQL); }} onTablesReady={() => refreshTables()} />
            </div></ErrorBoundary>
          </div>
        </div>
      </div>
      <AICooldownBanner />
    </div>
  );
};

export default App;
