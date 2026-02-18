import React, { useEffect, useState, useCallback, useRef } from 'react';
import { duckDBService } from './services/duckdbService';
import { aiService } from './services/aiService';
import { getTypeIcon } from './utils';
import { Tab, Notification, ColumnInfo, ColumnStats, ImportOptions, MetricChart, ChartConfig } from './types';
import { SqlEditor } from './components/SqlEditor';
import { Extensions } from './components/Extensions';
import { Dashboard } from './components/Dashboard';
import { LearnApp } from './components/Learn';
import { SchemaGenerator } from './components/SchemaGenerator';
import { AICooldownBanner } from './components/AICooldownBanner';
import { MetricManager } from './components/MetricManager';


// --- Ontology Icons Helper ---


interface CommandItem {
    id: string;
    label: string;
    icon: string;
    action: () => void;
    group: 'Navigation' | 'Action' | 'Table';
}

const App: React.FC = () => {
    const [isReady, setIsReady] = useState(false);
    const [initError, setInitError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>(Tab.DASHBOARD);
    const [tables, setTables] = useState<string[]>([]);
    const [currentTable, setCurrentTable] = useState<string | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);

    // Sidebar State
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    // Data View State
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
    const [expandedRowIdx, setExpandedRowIdx] = useState<number | null>(null); // For detailed row view
    const [showColMenu, setShowColMenu] = useState(false); // Column visibility menu

    // Edit State
    const [editingCell, setEditingCell] = useState<{ rowIdx: number, col: string, val: any } | null>(null);

    // Structure View State
    const [newColName, setNewColName] = useState('');
    const [newColType, setNewColType] = useState('VARCHAR');
    const [selectedColStats, setSelectedColStats] = useState<{ col: string, stats: ColumnStats } | null>(null);
    const [renameTableName, setRenameTableName] = useState('');
    const [isRenaming, setIsRenaming] = useState(false);
    const [editColumnMode, setEditColumnMode] = useState<{ colName: string, newName: string, newType: string } | null>(null);
    const [structureViewMode, setStructureViewMode] = useState<'list' | 'graph'>('list');
    const [fullSchemaTree, setFullSchemaTree] = useState<Record<string, ColumnInfo[]>>({});

    // Modal State: Create Table
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newTableName, setNewTableName] = useState('');

    // Modal State: Duplicate Table
    const [showDuplicateModal, setShowDuplicateModal] = useState(false);
    const [duplicateTargetName, setDuplicateTargetName] = useState('');

    // Modal State: Import Wizard
    const [showImportModal, setShowImportModal] = useState(false);
    const [importMode, setImportMode] = useState<'local' | 'url' | 'paste'>('local');
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importUrl, setImportUrl] = useState('');
    const [importText, setImportText] = useState('');
    const [importTableName, setImportTableName] = useState('');
    const [importOptions, setImportOptions] = useState<ImportOptions>({
        header: true,
        delimiter: ',',
        quote: '"',
        dateFormat: '%Y-%m-%d'
    });

    // Modal State: Settings
    const [showSettingsModal, setShowSettingsModal] = useState(false);

    // AI Configuration State
    const [aiProvider, setAiProvider] = useState<string>(localStorage.getItem('duckdb_ai_provider') || 'google');
    const [aiApiKey, setAiApiKey] = useState(localStorage.getItem('duckdb_ai_api_key') || '');
    const [aiBaseUrl, setAiBaseUrl] = useState(localStorage.getItem('duckdb_ai_base_url') || '');
    const [aiModel, setAiModel] = useState(localStorage.getItem('duckdb_ai_model') || (aiProvider === 'google' ? 'gemini-2.0-flash-exp' : 'llama-3.3-70b-versatile'));

    // Model List State
    const [availableModels, setAvailableModels] = useState<{ id: string; name: string }[]>([]);
    const [loadingModels, setLoadingModels] = useState(false);

    // Zen Mode for SQL Editor
    const [isZenMode, setIsZenMode] = useState(false);

    // Sync API key state with localStorage
    useEffect(() => {
        const handleStorageChange = () => {
            setAiApiKey(localStorage.getItem('duckdb_ai_api_key') || '');
            setAiProvider(localStorage.getItem('duckdb_ai_provider') || 'google');
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);


    // Command Palette State
    const [showCommandPalette, setShowCommandPalette] = useState(false);
    const [commandQuery, setCommandQuery] = useState('');
    const [selectedCommandIdx, setSelectedCommandIdx] = useState(0);
    const commandInputRef = useRef<HTMLInputElement>(null);

    // Cross-Tab Communication
    const [pendingSql, setPendingSql] = useState<string>('');
    const [pendingChartConfig, setPendingChartConfig] = useState<ChartConfig | null>(null);

    // Audit Logs
    const [auditLogs, setAuditLogs] = useState<any[]>([]);

    // Helpers
    const addNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        const id = Date.now().toString();
        setNotifications(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 3000);
    };

    // Handle chart generated from Metrics - sync to SQL Editor
    const handleChartGenerated = useCallback((chart: MetricChart) => {
        // Set the SQL and chart config to pending
        setPendingSql(chart.sql);
        setPendingChartConfig(chart.chartConfig);

        // Switch to SQL tab and notify
        setActiveTab(Tab.SQL);
        addNotification(`图表已生成并同步到 SQL 编辑器: ${chart.metricName}`, 'success');
    }, []);

    // Handle pending state consumed - clear after SQL execution
    const handlePendingConsumed = useCallback(() => {
        setPendingSql('');
        setPendingChartConfig(null);
    }, []);

    const refreshTables = useCallback(async () => {
        try {
            const t = await duckDBService.getTables();
            setTables(t);
        } catch (e) { console.error(e); }
    }, []);

    const refreshAudit = useCallback(async () => {
        try {
            const logs = await duckDBService.query("SELECT * FROM memory._sys_audit_log ORDER BY log_time DESC LIMIT 100");
            setAuditLogs(logs);
        } catch (e) { console.error(e); }
    }, []);

    useEffect(() => {
        duckDBService.init()
            .then(async () => {
                setIsReady(true);
                await refreshTables();
            })
            .catch((e) => setInitError(e.message));
    }, [refreshTables]);

    // Load Full Schema for ER Diagram
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

    // Command Palette Listener
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setShowCommandPalette(prev => !prev);
                setCommandQuery('');
                setSelectedCommandIdx(0);
            }
            if (showCommandPalette && e.key === 'Escape') {
                setShowCommandPalette(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showCommandPalette]);

    // Focus input when palette opens
    useEffect(() => {
        if (showCommandPalette && commandInputRef.current) {
            commandInputRef.current.focus();
        }
    }, [showCommandPalette]);

    const fetchTableData = async (tableName: string, offset: number, limit: number, currentSort = sortConfig, currentFilter = filterQuery) => {
        setLoadingData(true);
        try {
            const whereClause = currentFilter.trim() ? `WHERE ${currentFilter}` : '';
            const countQuery = `SELECT COUNT(*) as c FROM "${tableName}" ${whereClause}`;
            let total = 0;
            try {
                const countRes = await duckDBService.query(countQuery);
                total = Number(countRes[0].c);
            } catch (e) {
                throw new Error(`Invalid Filter: ${e.message}`);
            }

            const schemaInfo = await duckDBService.getTableSchema(tableName);
            setSchema(schemaInfo);
            const colNames = schemaInfo.map((c: any) => c.name);
            setTableColumns(colNames);

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
        }
        finally { setLoadingData(false); }
    };

    const fetchProfileData = async (tableName: string) => {
        setLoadingData(true);
        try {
            const profile = await duckDBService.query(`SUMMARIZE SELECT * FROM "${tableName}"`);
            setProfileData(profile);
        } catch (e: any) {
            addNotification(`Profiling failed: ${e.message}`, 'error');
        } finally {
            setLoadingData(false);
        }
    };

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
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ASC') {
            direction = 'DESC';
        }
        const newSort = { key, direction };
        setSortConfig(newSort);
        if (currentTable) {
            fetchTableData(currentTable, 0, pagination.limit, newSort);
        }
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
                const link = document.createElement("a");
                link.href = url;
                link.download = filename;
                link.click();
                addNotification(`Exported ${filename}`, 'success');
                return;
            }
            let content = '', mimeType = '';
            if (format === 'csv') {
                const headers = tableColumns.filter(c => !hiddenColumns.has(c)).join(',');
                const rows = tableData.map(row =>
                    tableColumns.filter(c => !hiddenColumns.has(c)).map(col => {
                        const val = row[col];
                        // Serialize BigInt safely
                        const safeVal = typeof val === 'bigint' ? val.toString() : val;
                        return safeVal === null ? '' : `"${String(safeVal).replace(/"/g, '""')}"`;
                    }).join(',')
                ).join('\n');
                content = `${headers}\n${rows}`;
                mimeType = 'text/csv;charset=utf-8;';
            } else {
                // Handle BigInt during stringify
                content = JSON.stringify(tableData, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2);
                mimeType = 'application/json';
            }
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            link.click();
            addNotification(`Exported ${filename}`, 'success');
        } catch (e: any) {
            addNotification(`Export failed: ${e.message}`, 'error');
        }
    };

    const handleCreateDemo = async () => {
        try {
            await duckDBService.executeAndAudit(
                "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name VARCHAR, age INTEGER, email VARCHAR); INSERT INTO users VALUES (1, 'Alice', 30, 'alice@example.com'), (2, 'Bob', 25, 'bob@test.com'), (3, 'Charlie', 35, 'charlie@corp.com');",
                'CREATE', 'users', 'Created demo table'
            );
            addNotification('Demo table "users" created', 'success');
            await refreshTables();
        } catch (e: any) {
            addNotification(e.message, 'error');
        }
    };

    const handleCreateTable = async () => {
        if (!newTableName) return;
        try {
            await duckDBService.createTable(newTableName, [{ name: 'id', type: 'INTEGER', pk: true }]);
            addNotification(`Table "${newTableName}" created`, 'success');
            await refreshTables();
            setShowCreateModal(false);
            setNewTableName('');
            handleTableSelect(newTableName);
        } catch (e: any) {
            addNotification(e.message, 'error');
        }
    };

    const handleDuplicateTable = async () => {
        if (!currentTable || !duplicateTargetName) return;
        try {
            const sql = `CREATE TABLE "${duplicateTargetName}" AS SELECT * FROM "${currentTable}"`;
            await duckDBService.executeAndAudit(sql, 'CREATE', duplicateTargetName, `Duplicated from ${currentTable}`);
            addNotification(`Table "${duplicateTargetName}" duplicated successfully`, 'success');
            await refreshTables();
            setShowDuplicateModal(false);
            setDuplicateTargetName('');
            handleTableSelect(duplicateTargetName);
        } catch (e: any) {
            addNotification(e.message, 'error');
        }
    };

    const handleRenameTable = async () => {
        if (!currentTable || !renameTableName) return;
        try {
            await duckDBService.renameTable(currentTable, renameTableName);
            addNotification(`Renamed ${currentTable} to ${renameTableName}`, 'success');
            await refreshTables();
            handleTableSelect(renameTableName);
        } catch (e: any) {
            addNotification(e.message, 'error');
        }
    };

    const handleDropTable = async () => {
        if (!currentTable) return;
        if (!confirm(`Are you SURE you want to drop table "${currentTable}"? This cannot be undone.`)) return;
        try {
            await duckDBService.dropTable(currentTable);
            addNotification(`Table "${currentTable}" dropped`, 'success');
            setCurrentTable(null);
            await refreshTables();
            setActiveTab(Tab.DASHBOARD);
        } catch (e: any) {
            addNotification(e.message, 'error');
        }
    };

    const openImportWizard = () => {
        setImportMode('local');
        setImportFile(null);
        setImportUrl('');
        setImportText('');
        setImportTableName('');
        setShowImportModal(true);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImportFile(file);
            if (!importTableName) {
                const name = file.name.split('.')[0].replace(/[^a-zA-Z0-9_]/g, '_');
                setImportTableName(name);
            }
        }
    };

    const applyPreset = (name: string, url: string) => {
        setImportMode('url');
        setImportUrl(url);
        setImportTableName(name);
    };

    const executeImport = async () => {
        try {
            if (importMode === 'local') {
                if (!importFile) return;
                await duckDBService.importFile(importFile, importTableName, importOptions);
                addNotification(`Imported ${importFile.name} as ${importTableName}`, 'success');
            } else if (importMode === 'paste') {
                if (!importText) return;
                await duckDBService.importText(importText, importTableName);
                addNotification(`Imported from clipboard as ${importTableName}`, 'success');
            } else {
                // URL Import
                if (!importUrl) return;
                // Simple check for parquet vs csv based on extension
                const isParquet = importUrl.endsWith('.parquet');
                const sql = isParquet
                    ? `CREATE TABLE "${importTableName}" AS SELECT * FROM read_parquet('${importUrl}')`
                    : `CREATE TABLE "${importTableName}" AS SELECT * FROM read_csv_auto('${importUrl}')`;

                await duckDBService.executeAndAudit(sql, 'IMPORT', importTableName, `Imported from URL: ${importUrl}`);
                addNotification(`Imported from URL as ${importTableName}`, 'success');
            }

            await refreshTables();
            setShowImportModal(false);
            setImportFile(null);
            setImportUrl('');
            setImportText('');
        } catch (e: any) {
            const msg = e.message.includes("HTTP")
                ? `CORS Error: The server hosting the file must allow cross-origin requests. (${e.message})`
                : `Import failed: ${e.message}`;
            addNotification(msg, 'error');
        }
    };

    // --- Column Visibility Helpers ---
    const toggleColumnVisibility = (col: string) => {
        const newSet = new Set(hiddenColumns);
        if (newSet.has(col)) newSet.delete(col);
        else newSet.add(col);
        setHiddenColumns(newSet);
    };

    // --- Workspace Backup/Restore ---
    const handleExportWorkspace = () => {
        const backup = {
            history: localStorage.getItem('duckdb_sql_history'),
            saved: localStorage.getItem('duckdb_saved_queries'),
            timestamp: Date.now()
        };
        const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `duckdb_workspace_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        addNotification('Workspace configuration exported', 'success');
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
            } catch (err) {
                addNotification('Invalid workspace file', 'error');
            }
        };
        reader.readAsText(file);
    };

    const handleDbExport = async () => {
        try {
            const blob = await duckDBService.exportDatabase();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'duckdb_backup.json';
            a.click();
            addNotification('Database exported successfully', 'success');
        } catch (e: any) {
            addNotification(e.message, 'error');
        }
    };

    const handleInsertRow = async () => {
        if (!currentTable) return;
        try {
            await duckDBService.insertRow(currentTable, {});
            addNotification('Row inserted', 'success');
            const countRes = await duckDBService.query(`SELECT COUNT(*) as c FROM "${currentTable}"`);
            const total = Number(countRes[0].c);
            const lastPageOffset = Math.floor(Math.max(0, total - 1) / pagination.limit) * pagination.limit;
            if (lastPageOffset !== pagination.offset) {
                fetchTableData(currentTable, lastPageOffset, pagination.limit);
            } else {
                fetchTableData(currentTable, pagination.offset, pagination.limit);
            }
        } catch (e: any) {
            addNotification(`Insert failed: ${e.message}`, 'error');
        }
    };

    const handleCellEdit = (rowIdx: number, col: string, val: any) => {
        const pkCol = schema.find(c => c.pk);
        if (!pkCol) {
            addNotification("Cannot edit tables without a Primary Key", 'info');
            return;
        }
        setEditingCell({ rowIdx, col, val });
    };

    const saveCellEdit = async () => {
        if (!editingCell || !currentTable) return;
        const { rowIdx, col, val } = editingCell;
        const row = tableData[rowIdx];
        const pkCol = schema.find(c => c.pk);
        if (!pkCol) return;
        if (row[col] === val) {
            setEditingCell(null);
            return;
        }
        try {
            await duckDBService.updateRow(currentTable, pkCol.name, row[pkCol.name], col, val);
            addNotification('Value updated', 'success');
            setEditingCell(null);
            fetchTableData(currentTable, pagination.offset, pagination.limit);
        } catch (e: any) {
            addNotification(`Update failed: ${e.message}`, 'error');
        }
    };

    const handleSelectRow = (pkVal: any, selected: boolean) => {
        const newSet = new Set(selectedRows);
        if (selected) newSet.add(pkVal);
        else newSet.delete(pkVal);
        setSelectedRows(newSet);
    };

    const handleSelectAll = (selected: boolean) => {
        if (!currentTable) return;
        const pkCol = schema.find(c => c.pk);
        if (!pkCol) return;
        if (selected) {
            const newSet = new Set();
            tableData.forEach(r => newSet.add(r[pkCol.name]));
            setSelectedRows(newSet);
        } else {
            setSelectedRows(new Set());
        }
    };

    const handleBulkDelete = async () => {
        if (!currentTable || selectedRows.size === 0) return;
        if (!confirm(`Are you sure you want to delete ${selectedRows.size} rows?`)) return;
        const pkCol = schema.find(c => c.pk);
        if (!pkCol) return;
        try {
            await duckDBService.deleteRows(currentTable, pkCol.name, Array.from(selectedRows));
            addNotification(`Deleted ${selectedRows.size} rows`, 'success');
            setSelectedRows(new Set());
            fetchTableData(currentTable, pagination.offset, pagination.limit);
        } catch (e: any) {
            addNotification(`Bulk delete failed: ${e.message}`, 'error');
        }
    };

    const handleAddColumn = async () => {
        if (!currentTable || !newColName) return;
        try {
            await duckDBService.addColumn(currentTable, newColName, newColType);
            addNotification(`Column ${newColName} added`, 'success');
            setNewColName('');
            const s = await duckDBService.getTableSchema(currentTable);
            setSchema(s);
            const colNames = s.map((c: any) => c.name);
            setTableColumns(colNames);
        } catch (e: any) {
            addNotification(`Failed to add column: ${e.message}`, 'error');
        }
    };

    const handleDropColumn = async (colName: string) => {
        if (!currentTable) return;
        if (!confirm(`Drop column "${colName}"? This is irreversible.`)) return;
        try {
            await duckDBService.dropColumn(currentTable, colName);
            addNotification(`Column ${colName} dropped`, 'success');
            const s = await duckDBService.getTableSchema(currentTable);
            setSchema(s);
            const colNames = s.map((c: any) => c.name);
            setTableColumns(colNames);
        } catch (e: any) {
            addNotification(`Failed to drop column: ${e.message}`, 'error');
        }
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
            const colNames = s.map((c: any) => c.name);
            setTableColumns(colNames);
        } catch (e: any) {
            addNotification(`Failed to update column: ${e.message}`, 'error');
        }
    };

    const showColumnStats = async (col: string) => {
        if (!currentTable) return;
        try {
            const stats = await duckDBService.getColumnStats(currentTable, col);
            setSelectedColStats({ col, stats });
        } catch (e: any) {
            addNotification(`Failed to get stats: ${e.message}`, 'error');
        }
    };

    // Copy Schema to Clipboard
    const handleCopySchema = () => {
        if (!currentTable || schema.length === 0) return;
        const ddl = `CREATE TABLE ${currentTable} (\n  ${schema.map(c => `${c.name} ${c.type}${c.pk ? ' PRIMARY KEY' : ''}`).join(',\n  ')}\n);`;
        navigator.clipboard.writeText(ddl);
        addNotification('Schema copied to clipboard', 'success');
    };

    // --- Command Palette Logic ---
    const commands: CommandItem[] = [
        { id: 'nav-dash', label: 'Go to Dashboard', icon: '🏠', group: 'Navigation', action: () => setActiveTab(Tab.DASHBOARD) },
        { id: 'nav-data', label: 'Go to Data Browser', icon: '📊', group: 'Navigation', action: () => setActiveTab(Tab.DATA) },
        { id: 'nav-sql', label: 'Go to SQL Editor', icon: '📝', group: 'Navigation', action: () => setActiveTab(Tab.SQL) },
        { id: 'nav-struct', label: 'Go to Schema/Structure', icon: '📐', group: 'Navigation', action: () => setActiveTab(Tab.STRUCTURE) },
        { id: 'nav-schema-gen', label: 'Go to AI Schema Generator', icon: '🤖', group: 'Navigation', action: () => setActiveTab(Tab.SCHEMA_GENERATOR) },
        { id: 'nav-learn', label: 'Go to Tutorials', icon: '🎓', group: 'Navigation', action: () => setActiveTab(Tab.TUTORIALS) },
        { id: 'act-import', label: 'Import Data', icon: '📥', group: 'Action', action: openImportWizard },
        { id: 'act-create', label: 'Create New Table', icon: '✨', group: 'Action', action: () => setShowCreateModal(true) },
        { id: 'act-export-db', label: 'Export Database JSON', icon: '📤', group: 'Action', action: handleDbExport },
        { id: 'act-settings', label: 'Open Settings', icon: '⚙️', group: 'Action', action: () => setShowSettingsModal(true) },
        ...tables.map(t => ({ id: `tbl-${t}`, label: `Select Table: ${t}`, icon: '📂', group: 'Table' as const, action: () => handleTableSelect(t) }))
    ];

    const filteredCommands = commands.filter(c => c.label.toLowerCase().includes(commandQuery.toLowerCase()));

    const handleCommandExec = (cmd: CommandItem) => {
        cmd.action();
        setShowCommandPalette(false);
    };

    const handleCommandKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedCommandIdx(prev => Math.min(prev + 1, filteredCommands.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedCommandIdx(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredCommands[selectedCommandIdx]) {
                handleCommandExec(filteredCommands[selectedCommandIdx]);
            }
        }
    };

    if (initError) return <div className="h-screen flex items-center justify-center bg-monokai-bg text-monokai-pink font-mono p-4 text-center"><div><h1 className="text-2xl mb-2">Initialize Error</h1>{initError}</div></div>;
    if (!isReady) return <div className="h-screen flex items-center justify-center bg-monokai-bg text-monokai-blue font-mono animate-pulse"><span className="text-4xl mr-4">🦆</span> Initializing DuckDB WASM...</div>;

    const pkColumn = schema.find(c => c.pk);
    const expandedRow = expandedRowIdx !== null ? tableData[expandedRowIdx] : null;
    const visibleColumns = tableColumns.filter(c => !hiddenColumns.has(c));

    // --- ER Diagram Renderer (Simple SVG) ---
    const renderSchemaGraph = () => {
        const tableNames = Object.keys(fullSchemaTree);
        if (tableNames.length === 0) return <div className="text-monokai-comment p-8">No tables to visualize.</div>;

        // Simple grid layout
        const NODE_WIDTH = 220;
        const NODE_HEIGHT_BASE = 40;
        const ROW_HEIGHT = 20;
        const MARGIN_X = 50;
        const MARGIN_Y = 50;

        const cols = 3;
        const nodes: any[] = [];
        const edges: any[] = [];

        // Calculate Nodes
        tableNames.forEach((t, i) => {
            const colIdx = i % cols;
            const rowIdx = Math.floor(i / cols);
            const x = MARGIN_X + colIdx * (NODE_WIDTH + 100);
            const y = MARGIN_Y + rowIdx * 300;

            nodes.push({
                name: t,
                x,
                y,
                columns: fullSchemaTree[t]
            });
        });

        // Calculate Edges (Simple Name-based Inference)
        nodes.forEach(source => {
            source.columns.forEach((col: ColumnInfo) => {
                if (col.name.endsWith('_id')) {
                    const targetName = col.name.replace(/_id$/, '') + 's'; // Infer plural 'users' from 'user_id'
                    const targetNode = nodes.find(n => n.name === targetName || n.name === col.name.replace(/_id$/, ''));

                    if (targetNode) {
                        edges.push({
                            source,
                            target: targetNode,
                            col: col.name
                        });
                    }
                }
            });
        });

        return (
            <div className="overflow-auto h-full bg-[#1e1f1c] relative p-10 rounded border border-monokai-accent/30 shadow-inner">
                <svg width="100%" height="1500" className="absolute top-0 left-0 pointer-events-none">
                    <defs>
                        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" fill="#66d9ef" />
                        </marker>
                    </defs>
                    {edges.map((e, i) => {
                        const sx = e.source.x + NODE_WIDTH;
                        const sy = e.source.y + NODE_HEIGHT_BASE;
                        const tx = e.target.x;
                        const ty = e.target.y + NODE_HEIGHT_BASE;
                        // Bezier curve
                        const d = `M ${sx} ${sy} C ${sx + 50} ${sy}, ${tx - 50} ${ty}, ${tx} ${ty}`;
                        return (
                            <g key={i}>
                                <path d={d} stroke="#66d9ef" strokeWidth="2" fill="none" markerEnd="url(#arrowhead)" opacity="0.6" />
                                <text x={(sx + tx) / 2} y={(sy + ty) / 2} fill="#66d9ef" fontSize="10" textAnchor="middle" dy="-5">{e.col}</text>
                            </g>
                        );
                    })}
                </svg>

                {nodes.map(node => (
                    <div
                        key={node.name}
                        className="absolute bg-monokai-bg border border-monokai-accent rounded shadow-xl hover:border-monokai-blue transition-colors flex flex-col w-[220px]"
                        style={{ left: node.x, top: node.y }}
                    >
                        <div className="bg-monokai-accent/50 p-2 font-bold text-monokai-yellow text-center border-b border-monokai-accent flex justify-between items-center">
                            <span>{node.name}</span>
                            <span className="text-[9px] text-monokai-comment">Table</span>
                        </div>
                        <div className="p-2 space-y-1">
                            {node.columns.map((c: ColumnInfo) => (
                                <div key={c.name} className="flex justify-between text-xs font-mono">
                                    <span className={c.pk ? 'text-monokai-pink font-bold' : 'text-monokai-fg'}>
                                        {c.pk && '🔑 '}{c.name}
                                    </span>
                                    <span className="text-monokai-comment text-[10px]">{c.type}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="flex h-screen overflow-hidden text-monokai-fg flex-col">
            {/* Command Palette Modal */}
            {showCommandPalette && (
                <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[20vh]" onClick={() => setShowCommandPalette(false)}>
                    <div className="bg-monokai-sidebar border border-monokai-accent rounded-lg shadow-2xl w-full max-w-xl flex flex-col overflow-hidden animate-[slideIn_0.1s_ease-out]" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-monokai-accent flex items-center gap-3">
                            <span className="text-monokai-comment text-xl">🔍</span>
                            <input
                                ref={commandInputRef}
                                className="bg-transparent outline-none text-lg text-white w-full placeholder-monokai-comment"
                                placeholder="Type a command or search..."
                                value={commandQuery}
                                onChange={e => { setCommandQuery(e.target.value); setSelectedCommandIdx(0); }}
                                onKeyDown={handleCommandKeyDown}
                            />
                            <span className="text-xs text-monokai-comment bg-monokai-bg px-2 py-1 rounded border border-monokai-accent">ESC</span>
                        </div>
                        <div className="max-h-[300px] overflow-y-auto p-2">
                            {filteredCommands.length === 0 && <div className="p-4 text-center text-monokai-comment">No matching commands</div>}
                            {filteredCommands.map((cmd, idx) => (
                                <div
                                    key={cmd.id}
                                    className={`flex items-center gap-3 p-3 rounded cursor-pointer transition-colors ${idx === selectedCommandIdx ? 'bg-monokai-blue text-monokai-bg font-bold' : 'text-monokai-fg hover:bg-monokai-accent'}`}
                                    onClick={() => handleCommandExec(cmd)}
                                    onMouseEnter={() => setSelectedCommandIdx(idx)}
                                >
                                    <span className="text-lg">{cmd.icon}</span>
                                    <div className="flex-1">{cmd.label}</div>
                                    <span className={`text-[10px] uppercase tracking-wider opacity-50 ${idx === selectedCommandIdx ? 'text-monokai-bg' : 'text-monokai-comment'}`}>{cmd.group}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Create Table Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-md animate-[fadeIn_0.2s]">
                    <div className="bg-monokai-sidebar border border-monokai-accent p-6 rounded shadow-2xl w-full max-w-md animate-[slideIn_0.2s_ease-out]">
                        <h2 className="text-xl font-bold mb-4 text-monokai-green">Create New Table</h2>
                        <input type="text" value={newTableName} onChange={(e) => setNewTableName(e.target.value)} placeholder="Table Name" className="w-full bg-monokai-bg border border-monokai-accent p-2 rounded mb-4 text-white focus:border-monokai-green outline-none" />
                        <div className="text-xs text-monokai-comment mb-6">Creates a table with a default <code>id INTEGER PRIMARY KEY</code> column.</div>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 rounded text-sm hover:bg-monokai-accent">Cancel</button>
                            <button onClick={handleCreateTable} className="px-4 py-2 bg-monokai-green text-monokai-bg font-bold rounded text-sm hover:opacity-90">Create</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Duplicate Table Modal */}
            {showDuplicateModal && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-md animate-[fadeIn_0.2s]">
                    <div className="bg-monokai-sidebar border border-monokai-accent p-6 rounded shadow-2xl w-full max-w-md animate-[slideIn_0.2s_ease-out]">
                        <h2 className="text-xl font-bold mb-4 text-monokai-blue">Duplicate Table</h2>
                        <p className="text-sm text-monokai-comment mb-2">Source: <span className="text-monokai-fg font-mono">{currentTable}</span></p>
                        <input type="text" value={duplicateTargetName} onChange={(e) => setDuplicateTargetName(e.target.value)} placeholder="New Table Name" className="w-full bg-monokai-bg border border-monokai-accent p-2 rounded mb-6 text-white focus:border-monokai-blue outline-none" />
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowDuplicateModal(false)} className="px-4 py-2 rounded text-sm hover:bg-monokai-accent">Cancel</button>
                            <button onClick={handleDuplicateTable} className="px-4 py-2 bg-monokai-blue text-monokai-bg font-bold rounded text-sm hover:opacity-90">Duplicate</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Row Detail Modal */}
            {expandedRow && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-md animate-[fadeIn_0.2s]" onClick={() => setExpandedRowIdx(null)}>
                    <div className="bg-monokai-sidebar border border-monokai-accent p-6 rounded shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col relative animate-[slideIn_0.2s_ease-out]" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4 border-b border-monokai-accent pb-2">
                            <h2 className="text-xl font-bold text-monokai-blue font-mono">Row Details</h2>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-monokai-comment font-mono mr-2">Row {expandedRowIdx! + 1}</span>
                                <button
                                    onClick={() => setExpandedRowIdx(Math.max(0, expandedRowIdx! - 1))}
                                    disabled={expandedRowIdx === 0}
                                    className="px-2 py-1 bg-monokai-accent rounded hover:bg-monokai-comment disabled:opacity-30 text-xs"
                                >
                                    ◀
                                </button>
                                <button
                                    onClick={() => setExpandedRowIdx(Math.min(tableData.length - 1, expandedRowIdx! + 1))}
                                    disabled={expandedRowIdx === tableData.length - 1}
                                    className="px-2 py-1 bg-monokai-accent rounded hover:bg-monokai-comment disabled:opacity-30 text-xs"
                                >
                                    ▶
                                </button>
                                <button onClick={() => setExpandedRowIdx(null)} className="ml-4 text-monokai-pink hover:text-white text-lg font-bold">✕</button>
                            </div>
                        </div>
                        <div className="overflow-auto flex-1 font-mono text-sm">
                            <table className="w-full">
                                <tbody>
                                    {Object.entries(expandedRow).map(([key, val]) => (
                                        <tr key={key} className="border-b border-monokai-accent/30 hover:bg-monokai-accent/20">
                                            <td className="p-3 text-monokai-comment w-1/3 align-top font-bold select-none">{key}</td>
                                            <td className="p-3 text-monokai-fg break-all whitespace-pre-wrap selection:bg-monokai-pink selection:text-white">
                                                {typeof val === 'object' && val !== null ? JSON.stringify(val, null, 2) : String(val)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}


            {/* Settings Modal */}
            {showSettingsModal && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-md animate-[fadeIn_0.2s]" onClick={() => setShowSettingsModal(false)}>
                    <div className="bg-monokai-sidebar border border-monokai-accent p-6 rounded shadow-2xl w-full max-w-lg animate-[slideIn_0.2s_ease-out] flex flex-col max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold mb-4 text-monokai-yellow flex items-center gap-2"><span>⚙️</span> Workspace Settings</h2>

                        <div className="space-y-6">
                            {/* AI Configuration Section */}
                            <div className="bg-monokai-bg p-4 rounded border border-monokai-accent">
                                <h3 className="text-sm font-bold text-monokai-fg mb-2">🤖 AI Configuration</h3>
                                <p className="text-xs text-monokai-comment mb-4">Configure your AI provider for SQL generation and schema analysis.</p>

                                <div className="space-y-4">
                                    {/* 1. Provider Selection */}
                                    <div>
                                        <label className="block text-xs font-medium text-monokai-comment mb-1">AI Provider</label>
                                        <select
                                            value={aiProvider}
                                            onChange={(e) => {
                                                const newProvider = e.target.value;
                                                setAiProvider(newProvider);
                                                localStorage.setItem('duckdb_ai_provider', newProvider);

                                                // Set defaults if switching
                                                let defaultModel = '';
                                                let defaultBaseUrl = '';

                                                if (newProvider === 'groq') {
                                                    defaultModel = 'llama-3.3-70b-versatile';
                                                    defaultBaseUrl = 'https://api.groq.com/openai/v1';
                                                } else if (newProvider === 'google') {
                                                    defaultModel = 'gemini-2.0-flash-exp';
                                                }

                                                if (defaultModel) {
                                                    setAiModel(defaultModel);
                                                    localStorage.setItem('duckdb_ai_model', defaultModel);
                                                }
                                                if (defaultBaseUrl) {
                                                    setAiBaseUrl(defaultBaseUrl);
                                                    localStorage.setItem('duckdb_ai_base_url', defaultBaseUrl);
                                                }
                                            }}
                                            className="w-full px-3 py-2 bg-monokai-sidebar border border-monokai-accent rounded text-sm text-monokai-fg focus:outline-none focus:ring-1 focus:ring-monokai-blue"
                                        >
                                            <option value="google">Google Gemini (Default)</option>
                                            <option value="groq">Groq (Fastest)</option>
                                            <option value="openai">OpenAI / Compatible</option>
                                        </select>
                                    </div>

                                    {/* 2. API Key */}
                                    <div>
                                        <label className="block text-xs font-medium text-monokai-comment mb-1">API Key</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="password"
                                                value={aiApiKey}
                                                onChange={(e) => setAiApiKey(e.target.value)}
                                                placeholder={`Enter your ${aiProvider} API key...`}
                                                className="flex-1 px-3 py-2 bg-monokai-sidebar border border-monokai-accent rounded text-sm text-monokai-fg placeholder-monokai-comment focus:outline-none focus:ring-1 focus:ring-monokai-blue"
                                            />
                                            <button
                                                onClick={() => {
                                                    localStorage.setItem('duckdb_ai_api_key', aiApiKey);
                                                    addNotification('API key saved!', 'success');
                                                }}
                                                className="px-3 py-2 bg-monokai-blue hover:bg-monokai-blue/80 transition-colors text-white font-bold rounded text-sm"
                                            >
                                                Save
                                            </button>
                                        </div>
                                    </div>

                                    {/* 3. Base URL (Conditional) */}
                                    <div>
                                        <label className="block text-xs font-medium text-monokai-comment mb-1">
                                            Base URL {aiProvider === 'google' ? '(Optional)' : '(Required for Custom/Groq)'}
                                        </label>
                                        <input
                                            type="text"
                                            value={aiBaseUrl}
                                            onChange={(e) => {
                                                setAiBaseUrl(e.target.value);
                                                localStorage.setItem('duckdb_ai_base_url', e.target.value);
                                            }}
                                            placeholder={aiProvider === 'groq' ? 'https://api.groq.com/openai/v1' : 'https://api.openai.com/v1'}
                                            className="w-full px-3 py-2 bg-monokai-sidebar border border-monokai-accent rounded text-sm text-monokai-fg placeholder-monokai-comment focus:outline-none focus:ring-1 focus:ring-monokai-blue"
                                        />
                                    </div>

                                    {/* 4. Model Selection */}
                                    <div>
                                        <label className="block text-xs font-medium text-monokai-comment mb-1">AI Model</label>
                                        <div className="flex gap-2">
                                            <select
                                                value={aiModel}
                                                onChange={(e) => {
                                                    setAiModel(e.target.value);
                                                    localStorage.setItem('duckdb_ai_model', e.target.value);
                                                }}
                                                disabled={loadingModels}
                                                className="flex-1 px-3 py-2 bg-monokai-sidebar border border-monokai-accent rounded text-sm text-monokai-fg appearance-none focus:outline-none focus:ring-1 focus:ring-monokai-blue disabled:opacity-50"
                                            >
                                                {availableModels.length === 0 && (
                                                    <option value={aiModel}>{aiModel || 'Click Refresh to load models...'}</option>
                                                )}
                                                {availableModels.map(m => (
                                                    <option key={m.id} value={m.id}>{m.name}</option>
                                                ))}
                                            </select>
                                            <button
                                                onClick={async () => {
                                                    if (!aiApiKey.trim()) {
                                                        addNotification('Please save your API key first.', 'error');
                                                        return;
                                                    }
                                                    // Save key to localStorage immediately so aiService can use it
                                                    localStorage.setItem('duckdb_ai_api_key', aiApiKey);
                                                    localStorage.setItem('duckdb_ai_provider', aiProvider);
                                                    if (aiBaseUrl) {
                                                        localStorage.setItem('duckdb_ai_base_url', aiBaseUrl);
                                                    }

                                                    setLoadingModels(true);
                                                    try {
                                                        const models = await aiService.fetchAvailableModels();
                                                        setAvailableModels(models);
                                                        if (models.length > 0 && !models.find(m => m.id === aiModel)) {
                                                            setAiModel(models[0].id);
                                                            localStorage.setItem('duckdb_ai_model', models[0].id);
                                                        }
                                                        addNotification(`Loaded ${models.length} models`, 'success');
                                                    } catch (err: any) {
                                                        addNotification(`Failed to fetch models: ${err.message}`, 'error');
                                                    } finally {
                                                        setLoadingModels(false);
                                                    }
                                                }}
                                                disabled={loadingModels || !aiApiKey.trim()}
                                                className="px-3 py-2 bg-monokai-green hover:bg-monokai-green/80 transition-colors text-monokai-bg font-bold rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {loadingModels ? '⏳' : '🔄'}
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-monokai-comment mt-1">
                                            {availableModels.length > 0
                                                ? `✓ ${availableModels.length} models available`
                                                : 'Click 🔄 to fetch available models from your provider.'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Backup & Restore Section */}
                            <div className="bg-monokai-bg p-4 rounded border border-monokai-accent">
                                <h3 className="text-sm font-bold text-monokai-fg mb-2">Backup Workspace</h3>
                                <p className="text-xs text-monokai-comment mb-3">Export your query history and saved queries to a JSON file.</p>
                                <button onClick={handleExportWorkspace} className="w-full py-2 bg-monokai-accent hover:bg-monokai-blue hover:text-monokai-bg transition-colors text-monokai-blue font-bold rounded text-sm">
                                    📤 Download Backup
                                </button>
                            </div>

                            <div className="bg-monokai-bg p-4 rounded border border-monokai-accent">
                                <h3 className="text-sm font-bold text-monokai-fg mb-2">Restore Workspace</h3>
                                <p className="text-xs text-monokai-comment mb-3">Restore settings from a backup file. <strong className="text-monokai-pink">Warning: Overwrites history.</strong></p>
                                <label className="block w-full py-2 bg-monokai-accent hover:bg-monokai-orange hover:text-monokai-bg transition-colors text-monokai-orange font-bold rounded text-sm text-center cursor-pointer">
                                    📥 Upload Backup File
                                    <input type="file" accept=".json" onChange={handleImportWorkspace} className="hidden" />
                                </label>
                            </div>
                        </div>

                        <div className="flex justify-end mt-6">
                            <button onClick={() => setShowSettingsModal(false)} className="px-4 py-2 rounded text-sm bg-monokai-accent hover:text-white">Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Import Wizard Modal */}
            {showImportModal && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-md animate-[fadeIn_0.2s]">
                    <div className="bg-monokai-sidebar border border-monokai-accent p-6 rounded shadow-2xl w-full max-w-lg animate-[slideIn_0.2s_ease-out] flex flex-col max-h-[90vh]">
                        <h2 className="text-xl font-bold mb-4 text-monokai-orange flex items-center gap-2"><span>📥</span> Import Wizard</h2>

                        <div className="flex mb-4 border-b border-monokai-accent shrink-0">
                            <button
                                className={`flex-1 py-2 text-sm font-bold transition-colors ${importMode === 'local' ? 'text-monokai-orange border-b-2 border-monokai-orange bg-monokai-accent/20' : 'text-monokai-comment hover:text-white'}`}
                                onClick={() => setImportMode('local')}
                            >
                                Local File
                            </button>
                            <button
                                className={`flex-1 py-2 text-sm font-bold transition-colors ${importMode === 'url' ? 'text-monokai-blue border-b-2 border-monokai-blue bg-monokai-accent/20' : 'text-monokai-comment hover:text-white'}`}
                                onClick={() => setImportMode('url')}
                            >
                                From URL
                            </button>
                            <button
                                className={`flex-1 py-2 text-sm font-bold transition-colors ${importMode === 'paste' ? 'text-monokai-green border-b-2 border-monokai-green bg-monokai-accent/20' : 'text-monokai-comment hover:text-white'}`}
                                onClick={() => setImportMode('paste')}
                            >
                                Paste Text
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1">
                            <div className="mb-4">
                                <label className="block text-xs text-monokai-comment mb-1">Target Table Name</label>
                                <input value={importTableName} onChange={(e) => setImportTableName(e.target.value)} className="w-full bg-monokai-bg border border-monokai-accent p-2 rounded text-white focus:border-monokai-orange outline-none" placeholder="e.g., my_table" />
                            </div>

                            {importMode === 'url' && (
                                <div className="mb-4">
                                    {!importUrl && (
                                        <div className="mb-4">
                                            <label className="block text-xs text-monokai-comment mb-2">Quick Presets (Public Data)</label>
                                            <div className="flex gap-2 flex-wrap">
                                                <button onClick={() => applyPreset('titanic', 'https://raw.githubusercontent.com/datasciencedojo/datasets/master/titanic.csv')} className="px-2 py-1 text-xs bg-monokai-accent rounded hover:bg-monokai-blue hover:text-monokai-bg transition-colors">🚢 Titanic</button>
                                                <button onClick={() => applyPreset('iris', 'https://raw.githubusercontent.com/mwaskom/seaborn-data/master/iris.csv')} className="px-2 py-1 text-xs bg-monokai-accent rounded hover:bg-monokai-green hover:text-monokai-bg transition-colors">🌸 Iris</button>
                                                <button onClick={() => applyPreset('tips', 'https://raw.githubusercontent.com/mwaskom/seaborn-data/master/tips.csv')} className="px-2 py-1 text-xs bg-monokai-accent rounded hover:bg-monokai-yellow hover:text-monokai-bg transition-colors">💰 Tips</button>
                                            </div>
                                        </div>
                                    )}
                                    <label className="block text-xs text-monokai-comment mb-1">File URL (CSV/Parquet)</label>
                                    <input
                                        value={importUrl}
                                        onChange={(e) => setImportUrl(e.target.value)}
                                        placeholder="https://raw.githubusercontent.com/..."
                                        className="w-full bg-monokai-bg border border-monokai-accent p-2 rounded text-white focus:border-monokai-blue outline-none"
                                    />
                                    <div className="text-[10px] text-monokai-comment mt-1">Note: Server must support CORS (Cross-Origin Resource Sharing).</div>
                                </div>
                            )}

                            {importMode === 'local' && (
                                <div className="mb-4">
                                    <label className="block w-full py-8 px-4 border-2 border-dashed border-monokai-accent rounded text-center cursor-pointer hover:border-monokai-orange hover:bg-monokai-accent/20 transition-all">
                                        <div className="text-2xl mb-2">📄</div>
                                        <div className="text-sm font-bold text-monokai-fg">{importFile ? importFile.name : 'Click to select a file'}</div>
                                        <div className="text-xs text-monokai-comment mt-1">Supports CSV, JSON, Parquet</div>
                                        <input type="file" className="hidden" onChange={handleFileSelect} accept=".csv,.json,.parquet,.txt" />
                                    </label>
                                </div>
                            )}

                            {importMode === 'paste' && (
                                <div className="mb-4 h-48">
                                    <label className="block text-xs text-monokai-comment mb-1">Paste CSV/TSV Data</label>
                                    <textarea
                                        value={importText}
                                        onChange={(e) => setImportText(e.target.value)}
                                        className="w-full h-full bg-monokai-bg border border-monokai-accent p-2 rounded text-xs font-mono text-white outline-none resize-none focus:border-monokai-green"
                                        placeholder={`id,name,value\n1,Alice,100\n2,Bob,200`}
                                    />
                                </div>
                            )}

                            {((importMode === 'local' && (importFile?.name.endsWith('.csv') || importFile?.name.endsWith('.txt'))) || importMode === 'paste') ? (
                                <div className="grid grid-cols-2 gap-4 mb-2 p-4 bg-monokai-bg border border-monokai-accent rounded">
                                    <div className="col-span-2 text-xs font-bold text-monokai-blue uppercase tracking-wider mb-2">CSV Options (Auto-detected if empty)</div>
                                    <label className="flex items-center gap-2 cursor-pointer col-span-2">
                                        <input type="checkbox" checked={importOptions.header} onChange={e => setImportOptions({ ...importOptions, header: e.target.checked })} />
                                        <span className="text-sm">File has Header</span>
                                    </label>
                                </div>
                            ) : null}
                        </div>

                        <div className="flex justify-end gap-3 mt-4 shrink-0 pt-4 border-t border-monokai-accent">
                            <button onClick={() => { setShowImportModal(false); setImportFile(null); }} className="px-4 py-2 rounded text-sm hover:bg-monokai-accent">Cancel</button>
                            <button onClick={executeImport} className="px-4 py-2 bg-monokai-orange text-monokai-bg font-bold rounded text-sm hover:opacity-90">Import Data</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast Notifications */}
            <div className="fixed bottom-10 right-4 z-50 flex flex-col gap-2 pointer-events-none">
                {notifications.map(n => (
                    <div key={n.id} className={`pointer-events-auto px-4 py-3 rounded shadow-lg border-l-4 text-sm font-bold flex items-center gap-2 animate-[slideIn_0.3s_ease-out]
                    ${n.type === 'success' ? 'bg-monokai-sidebar border-monokai-green text-monokai-green' :
                            n.type === 'error' ? 'bg-monokai-sidebar border-monokai-pink text-monokai-pink' :
                                'bg-monokai-sidebar border-monokai-blue text-monokai-blue'}`}>
                        <span>{n.type === 'success' ? '✓' : n.type === 'error' ? '✕' : 'ℹ'}</span>{n.message}
                    </div>
                ))}
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <div className={`flex-shrink-0 bg-monokai-sidebar border-r border-monokai-accent flex flex-col transition-all duration-300 ${isSidebarCollapsed ? 'w-14' : 'w-64'}`}>
                    <div className={`p-4 border-b border-monokai-accent flex items-center gap-2 cursor-pointer hover:bg-monokai-accent/20 ${isSidebarCollapsed ? 'justify-center' : ''}`} onClick={() => setActiveTab(Tab.DASHBOARD)} title="Dashboard">
                        <span className="text-2xl">🦆</span>{!isSidebarCollapsed && <span className="font-bold text-monokai-fg truncate">DuckDB Pro</span>}
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                        {!isSidebarCollapsed && (
                            <>
                                <div className="mb-6 px-2">
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="text-xs uppercase text-monokai-comment font-bold tracking-wider">Tables</h3>
                                        <button onClick={() => setShowCreateModal(true)} className="text-monokai-green hover:text-white text-lg leading-none" title="Create Table">+</button>
                                    </div>
                                    <ul className="space-y-1">
                                        {tables.map(t => (
                                            <li key={t}>
                                                <button onClick={() => handleTableSelect(t)} className={`w-full text-left px-3 py-1.5 rounded text-sm font-mono truncate transition-colors ${currentTable === t && activeTab !== Tab.DASHBOARD ? 'bg-monokai-pink text-white' : 'text-monokai-fg hover:bg-monokai-accent'}`}>{t}</button>
                                            </li>
                                        ))}
                                        {tables.length === 0 && <li className="text-sm text-monokai-comment italic">No tables</li>}
                                    </ul>
                                    <button onClick={handleCreateDemo} className="mt-4 text-xs text-monokai-blue hover:underline">Load Demo Data</button>
                                </div>
                                <div className="mb-6 px-2">
                                    <h3 className="text-xs uppercase text-monokai-comment font-bold mb-2 tracking-wider">Data I/O</h3>
                                    <button onClick={openImportWizard} className="block w-full text-center py-2 px-4 border border-dashed border-monokai-comment rounded text-sm text-monokai-comment cursor-pointer hover:border-monokai-blue hover:text-monokai-blue transition-colors bg-transparent">Import Data</button>
                                    <button onClick={handleDbExport} className="w-full mt-2 text-center py-1 text-sm text-monokai-orange hover:text-white transition-colors">Export DB</button>
                                </div>
                            </>
                        )}
                        {isSidebarCollapsed && (
                            <div className="flex flex-col gap-4 items-center mt-2">
                                <button onClick={() => setShowCreateModal(true)} className="text-monokai-green text-xl" title="Create Table">+</button>
                                <button onClick={openImportWizard} className="text-monokai-blue text-xl" title="Import Data">📥</button>
                                <button onClick={handleDbExport} className="text-monokai-orange text-xl" title="Export DB">📤</button>
                            </div>
                        )}
                    </div>
                    <div className="p-2 border-t border-monokai-accent flex flex-col gap-2 justify-center">
                        {!isSidebarCollapsed && (
                            <button onClick={() => setShowSettingsModal(true)} className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-monokai-comment hover:text-white hover:bg-monokai-accent rounded transition-colors w-full">
                                <span>⚙️</span> Settings & Backup
                            </button>
                        )}
                        {isSidebarCollapsed && (
                            <button onClick={() => setShowSettingsModal(true)} className="text-lg hover:text-white text-monokai-comment" title="Settings">⚙️</button>
                        )}
                        <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="text-monokai-comment hover:text-white text-center w-full" title={isSidebarCollapsed ? "Expand" : "Collapse"}>{isSidebarCollapsed ? '»' : '«'}</button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col min-w-0 bg-monokai-bg">
                    <div className="h-14 border-b border-monokai-accent flex items-center px-4 gap-2 bg-monokai-bg shrink-0 overflow-x-auto">
                        {[
                            { id: Tab.DASHBOARD, label: 'Dashboard', icon: '🏠' },
                            { id: Tab.DATA, label: 'Data', icon: '📊' },
                            { id: Tab.STRUCTURE, label: 'Schema', icon: '📐' },
                            { id: Tab.SQL, label: 'SQL', icon: '📝' },
                            { id: Tab.SCHEMA_GENERATOR, label: 'AI Schema', icon: '🤖' },
                            { id: Tab.METRICS, label: 'Metrics', icon: '📈' },
                            { id: Tab.AUDIT, label: 'Logs', icon: '📜' },
                            { id: Tab.EXTENSIONS, label: 'Plugins', icon: '🧩' },
                            { id: Tab.TUTORIALS, label: 'Learn', icon: '🎓' },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    setActiveTab(tab.id);
                                    if (tab.id === Tab.AUDIT) refreshAudit();
                                    if (tab.id === Tab.DATA && currentTable) fetchTableData(currentTable, pagination.offset, pagination.limit);
                                }}
                                className={`h-full border-b-2 px-4 flex items-center gap-2 text-sm font-bold transition-all ${activeTab === tab.id ? 'border-monokai-pink text-monokai-pink' : 'border-transparent text-monokai-comment hover:text-monokai-fg'}`}
                            >
                                <span>{tab.icon}</span> {(!isSidebarCollapsed || activeTab === tab.id) && tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-hidden p-0 relative flex flex-col">
                        <div className={activeTab === Tab.DASHBOARD ? 'block h-full' : 'hidden'}><Dashboard tables={tables} onNavigate={setActiveTab} /></div>

                        {/* DATA TAB */}
                        <div className={activeTab === Tab.DATA ? 'block h-full' : 'hidden'}>
                            {currentTable ? (
                                <div className="h-full flex flex-col">
                                    <div className="p-2 bg-monokai-sidebar border-b border-monokai-accent shrink-0 flex flex-col gap-2">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-4">
                                                <h2 className="text-lg font-mono text-monokai-yellow font-bold px-2">{currentTable}</h2>
                                                <div className="flex bg-monokai-bg rounded overflow-hidden border border-monokai-accent">
                                                    <button onClick={() => setDataViewMode('grid')} className={`px-3 py-1 text-xs font-bold ${dataViewMode === 'grid' ? 'bg-monokai-accent text-white' : 'text-monokai-comment hover:text-white'}`}>Grid</button>
                                                    <button onClick={() => { setDataViewMode('profile'); if (currentTable) fetchProfileData(currentTable); }} className={`px-3 py-1 text-xs font-bold ${dataViewMode === 'profile' ? 'bg-monokai-accent text-monokai-orange' : 'text-monokai-comment hover:text-monokai-orange'}`}>Profile</button>
                                                </div>
                                                {selectedRows.size > 0 && dataViewMode === 'grid' && (
                                                    <button onClick={handleBulkDelete} className="text-xs bg-monokai-pink text-white px-3 py-1 rounded font-bold animate-pulse">Delete {selectedRows.size} Selected</button>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="relative">
                                                    <button onClick={() => setShowColMenu(!showColMenu)} className="text-xs bg-monokai-accent hover:text-white px-3 py-1 rounded border border-transparent hover:border-monokai-comment transition-colors">
                                                        👁️ Columns
                                                    </button>
                                                    {showColMenu && (
                                                        <div className="absolute right-0 top-full mt-1 bg-monokai-sidebar border border-monokai-accent p-2 rounded shadow-xl z-30 max-h-60 overflow-y-auto min-w-[150px]">
                                                            {tableColumns.map(col => (
                                                                <label key={col} className="flex items-center gap-2 p-1 hover:bg-monokai-accent/50 cursor-pointer text-xs">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={!hiddenColumns.has(col)}
                                                                        onChange={() => toggleColumnVisibility(col)}
                                                                    />
                                                                    <span className={hiddenColumns.has(col) ? 'opacity-50' : 'text-white'}>{col}</span>
                                                                </label>
                                                            ))}
                                                            <div className="border-t border-monokai-accent mt-2 pt-2 flex justify-center">
                                                                <button onClick={() => setHiddenColumns(new Set())} className="text-[10px] text-monokai-blue hover:underline">Reset All</button>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {showColMenu && <div className="fixed inset-0 z-20" onClick={() => setShowColMenu(false)} />}
                                                </div>
                                                <div className="flex gap-1 mr-4">
                                                    <button onClick={() => downloadData('csv')} className="text-xs bg-monokai-accent hover:bg-monokai-comment px-2 py-1 rounded">CSV</button>
                                                    <button onClick={() => downloadData('json')} className="text-xs bg-monokai-accent hover:bg-monokai-comment px-2 py-1 rounded">JSON</button>
                                                    <button onClick={() => downloadData('parquet')} className="text-xs bg-monokai-accent hover:bg-monokai-comment px-2 py-1 rounded text-monokai-orange">Parquet</button>
                                                </div>
                                                {pkColumn && <button onClick={handleInsertRow} className="text-xs bg-monokai-green text-monokai-bg px-3 py-1 rounded font-bold hover:opacity-90">+ Insert Row</button>}
                                            </div>
                                        </div>
                                        {dataViewMode === 'grid' && (
                                            <div className="flex gap-2 items-center">
                                                <span className="text-xs font-bold text-monokai-blue">WHERE</span>
                                                <input className="flex-1 bg-monokai-bg border border-monokai-accent text-xs p-1.5 rounded text-white font-mono outline-none focus:border-monokai-blue" placeholder="id > 5 AND status = 'active'..." value={filterQuery} onChange={(e) => setFilterQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleApplyFilter()} />
                                                <button onClick={handleApplyFilter} className="px-3 py-1 bg-monokai-accent hover:bg-monokai-comment text-xs rounded">Apply Filter</button>
                                                {filterQuery && <button onClick={() => { setFilterQuery(''); setTimeout(() => fetchTableData(currentTable!, 0, pagination.limit, sortConfig, ''), 0); }} className="text-monokai-comment hover:text-white">✕</button>}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 overflow-auto bg-monokai-bg">
                                        {loadingData ? (
                                            <div className="h-full flex items-center justify-center text-monokai-comment flex-col gap-2">
                                                <div className="w-8 h-8 border-2 border-monokai-blue border-t-transparent rounded-full animate-spin"></div>
                                                <div className="animate-pulse">Loading data...</div>
                                            </div>
                                        ) : dataViewMode === 'profile' ? (
                                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {profileData.map((col: any) => {
                                                    const nullPct = parseFloat(col.null_percentage) || 0;
                                                    const validPct = 100 - nullPct;
                                                    return (
                                                        <div key={col.column_name} className="bg-monokai-sidebar border border-monokai-accent rounded-lg p-5 shadow-lg hover:border-monokai-blue transition-all group flex flex-col">
                                                            <div className="flex justify-between items-start mb-3">
                                                                <h3 className="text-lg font-mono font-bold text-monokai-fg truncate max-w-[70%]" title={col.column_name}>{col.column_name}</h3>
                                                                <span className="text-[10px] font-mono bg-monokai-accent px-2 py-0.5 rounded text-monokai-blue uppercase tracking-wider flex items-center gap-1">
                                                                    {getTypeIcon(col.column_type)} {col.column_type}
                                                                </span>
                                                            </div>

                                                            <div className="space-y-3 mb-4 flex-1">
                                                                {/* Distribution Bar */}
                                                                <div>
                                                                    <div className="flex justify-between text-[10px] text-monokai-comment mb-1">
                                                                        <span>Valid</span>
                                                                        <span>Nulls</span>
                                                                    </div>
                                                                    <div className="w-full h-2 bg-monokai-bg rounded-full overflow-hidden flex">
                                                                        <div className="bg-monokai-green h-full" style={{ width: `${validPct}%` }} title={`Valid: ${validPct.toFixed(1)}%`}></div>
                                                                        <div className="bg-monokai-orange h-full" style={{ width: `${nullPct}%` }} title={`Nulls: ${nullPct.toFixed(1)}%`}></div>
                                                                    </div>
                                                                </div>

                                                                <div className="grid grid-cols-2 gap-4 text-xs">
                                                                    <div>
                                                                        <div className="text-monokai-comment text-[10px] uppercase">Unique</div>
                                                                        <div className="font-mono text-monokai-purple">{col.approx_unique}</div>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <div className="text-monokai-comment text-[10px] uppercase">Nulls</div>
                                                                        <div className="font-mono text-monokai-orange">{nullPct.toFixed(1)}%</div>
                                                                    </div>
                                                                </div>

                                                                {col.min !== null && (
                                                                    <div className="bg-monokai-bg p-2 rounded text-[10px] font-mono border border-monokai-accent/50">
                                                                        <div className="flex justify-between mb-1">
                                                                            <span className="text-monokai-comment">Min</span>
                                                                            <span className="text-monokai-fg truncate max-w-[100px]" title={String(col.min)}>{String(col.min)}</span>
                                                                        </div>
                                                                        <div className="flex justify-between">
                                                                            <span className="text-monokai-comment">Max</span>
                                                                            <span className="text-monokai-fg truncate max-w-[100px]" title={String(col.max)}>{String(col.max)}</span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                                {profileData.length === 0 && <div className="col-span-full text-center text-monokai-comment py-10">No profile data available.</div>}
                                            </div>
                                        ) : (
                                            <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
                                                <thead className="bg-monokai-accent sticky top-0 z-10 shadow-sm">
                                                    <tr>
                                                        <th className="p-2 w-10 border-b border-monokai-comment bg-monokai-accent text-center left-0 sticky z-20">
                                                            {pkColumn && <input type="checkbox" className="cursor-pointer" onChange={(e) => handleSelectAll(e.target.checked)} checked={tableData.length > 0 && tableData.every(r => selectedRows.has(r[pkColumn.name]))} />}
                                                        </th>
                                                        <th className="p-2 w-10 border-b border-monokai-comment bg-monokai-accent z-10"></th>
                                                        {visibleColumns.map((col, idx) => {
                                                            const colInfo = schema.find(s => s.name === col);
                                                            const isSticky = idx === 0 && pkColumn?.name === col;
                                                            return <th key={col} className={`p-3 font-mono text-monokai-blue font-bold border-b border-monokai-comment border-r border-monokai-comment/30 cursor-pointer hover:bg-monokai-comment/20 select-none group ${isSticky ? 'sticky left-20 z-20 bg-monokai-accent shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]' : ''}`} onClick={() => handleSort(col)}>
                                                                <div className="flex items-center gap-2"><span>{col}</span>{colInfo && <span className="text-[10px] text-monokai-comment px-1 rounded bg-monokai-bg border border-monokai-accent/50 flex items-center gap-1" title={colInfo.type}>{getTypeIcon(colInfo.type)}</span>}{sortConfig?.key === col && <span className="text-[10px] text-monokai-pink">{sortConfig.direction === 'ASC' ? '▲' : '▼'}</span>}</div>
                                                            </th>
                                                        })}
                                                    </tr>
                                                </thead>
                                                <tbody className="font-mono">
                                                    {tableData.map((row, rowIdx) => {
                                                        const pkVal = pkColumn ? row[pkColumn.name] : null;
                                                        const isSelected = pkVal !== null && selectedRows.has(pkVal);
                                                        return <tr key={rowIdx} className={`border-b border-monokai-accent/50 group odd:bg-monokai-bg even:bg-monokai-sidebar hover:bg-monokai-accent/40 ${isSelected ? 'bg-monokai-accent/60' : ''}`}>
                                                            <td className="p-1 text-center border-r border-monokai-accent/30 sticky left-0 z-10 bg-inherit">
                                                                {pkColumn && <input type="checkbox" checked={isSelected} onChange={(e) => handleSelectRow(pkVal, e.target.checked)} className="cursor-pointer" />}
                                                            </td>
                                                            <td className="p-1 text-center border-r border-monokai-accent/30">
                                                                <button onClick={() => setExpandedRowIdx(rowIdx)} className="text-xs text-monokai-comment hover:text-monokai-blue opacity-50 hover:opacity-100 transition-opacity">👁️</button>
                                                            </td>
                                                            {visibleColumns.map((col, idx) => {
                                                                const isEditing = editingCell?.rowIdx === rowIdx && editingCell?.col === col;
                                                                const cellValue = row[col];
                                                                const colInfo = schema.find(s => s.name === col);
                                                                const isNum = colInfo?.type.includes('INT') || colInfo?.type.includes('FLOAT') || colInfo?.type.includes('DOUBLE');
                                                                const isNull = cellValue === null;
                                                                const isSticky = idx === 0 && pkColumn?.name === col;
                                                                // Helper for object display
                                                                const displayVal = (typeof cellValue === 'object' && cellValue !== null) ? (Array.isArray(cellValue) ? '[List]' : '{Struct}') : String(cellValue);

                                                                return <td key={`${rowIdx}-${col}`} className={`p-3 border-r border-monokai-accent/30 text-monokai-fg cursor-text min-w-[100px] max-w-[300px] truncate ${isNull ? 'italic text-monokai-comment/50' : 'opacity-90'} ${isSticky ? 'sticky left-20 z-10 bg-inherit shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]' : ''}`} onDoubleClick={() => handleCellEdit(rowIdx, col, cellValue)} title={String(cellValue)}>
                                                                    {isEditing ? <input autoFocus type={isNum ? 'number' : 'text'} value={editingCell.val} onChange={(e) => setEditingCell({ ...editingCell, val: isNum ? e.target.valueAsNumber : e.target.value })} onBlur={saveCellEdit} onKeyDown={(e) => { if (e.key === 'Enter') saveCellEdit(); if (e.key === 'Escape') setEditingCell(null); }} className="w-full bg-monokai-bg border border-monokai-blue px-1 py-0.5 outline-none text-white" /> : (isNull ? 'NULL' : displayVal)}
                                                                </td>
                                                            })}
                                                        </tr>
                                                    })}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                    {dataViewMode === 'grid' && (
                                        <div className="p-2 border-t border-monokai-accent bg-monokai-sidebar flex justify-between items-center text-xs text-monokai-comment">
                                            <span>{pagination.total} records found</span>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => handlePageChange(pagination.offset - pagination.limit)} disabled={pagination.offset === 0} className="px-2 py-1 bg-monokai-accent rounded disabled:opacity-30 hover:bg-monokai-comment transition-colors text-white">◀ Prev</button>
                                                <span className="font-mono min-w-[80px] text-center">{pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total)}</span>
                                                <button onClick={() => handlePageChange(pagination.offset + pagination.limit)} disabled={pagination.offset + pagination.limit >= pagination.total} className="px-2 py-1 bg-monokai-accent rounded disabled:opacity-30 hover:bg-monokai-comment transition-colors text-white">Next ▶</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="h-full flex items-center justify-center text-monokai-comment flex-col bg-monokai-bg">
                                    <div className="text-center opacity-50"><div className="text-6xl mb-4">👈</div><p>Select a table to browse data</p></div>
                                </div>
                            )}
                        </div>

                        {/* STRUCTURE TAB */}
                        <div className={activeTab === Tab.STRUCTURE ? 'block h-full' : 'hidden'}>
                            {activeTab === Tab.STRUCTURE && tables.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-monokai-comment flex-col">
                                    <div className="text-4xl mb-4">📐</div>
                                    <div>No tables found. Import or create a table to view schema.</div>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col bg-monokai-bg relative">
                                    {/* Header / Controls */}
                                    <div className="p-4 border-b border-monokai-accent flex justify-between items-center shrink-0 z-10 bg-monokai-bg/80 backdrop-blur-sm">
                                        <div className="flex items-center gap-4">
                                            <h2 className="text-xl font-bold text-monokai-fg flex gap-2 items-center">
                                                <span className="text-monokai-purple">📐</span> Schema Architecture
                                            </h2>
                                            <div className="flex bg-monokai-sidebar rounded p-0.5 border border-monokai-accent">
                                                <button onClick={() => setStructureViewMode('list')} className={`px-3 py-1 text-xs font-bold rounded transition-colors ${structureViewMode === 'list' ? 'bg-monokai-accent text-white' : 'text-monokai-comment hover:text-white'}`}>List View</button>
                                                <button onClick={() => setStructureViewMode('graph')} className={`px-3 py-1 text-xs font-bold rounded transition-colors ${structureViewMode === 'graph' ? 'bg-monokai-accent text-monokai-blue' : 'text-monokai-comment hover:text-monokai-blue'}`}>ER Diagram</button>
                                            </div>
                                        </div>
                                        {currentTable && structureViewMode === 'list' && (
                                            <div className="flex gap-2">
                                                <button onClick={() => { setDuplicateTargetName(`${currentTable}_copy`); setShowDuplicateModal(true); }} className="text-xs bg-monokai-blue/10 text-monokai-blue hover:bg-monokai-blue hover:text-monokai-bg px-3 py-1.5 rounded font-bold transition-colors border border-monokai-blue">Duplicate Table</button>
                                                <button onClick={handleDropTable} className="text-xs bg-monokai-pink/10 text-monokai-pink hover:bg-monokai-pink hover:text-white px-3 py-1.5 rounded font-bold transition-colors border border-monokai-pink">Drop Table</button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 overflow-hidden relative">
                                        {structureViewMode === 'graph' ? (
                                            renderSchemaGraph()
                                        ) : (
                                            // LIST VIEW (Existing Logic)
                                            currentTable ? (
                                                <div className="h-full p-6 overflow-auto">
                                                    <div className="flex items-center gap-2 mb-6">
                                                        {isRenaming ? (
                                                            <input autoFocus className="bg-monokai-bg border border-monokai-blue text-monokai-fg text-2xl font-bold px-2 py-1 rounded outline-none" value={renameTableName} onChange={e => setRenameTableName(e.target.value)} onBlur={() => setIsRenaming(false)} onKeyDown={e => { if (e.key === 'Enter') handleRenameTable(); if (e.key === 'Escape') setIsRenaming(false); }} />
                                                        ) : (
                                                            <span className="text-2xl font-bold text-monokai-fg cursor-pointer hover:underline decoration-dashed decoration-monokai-comment" onClick={() => { setRenameTableName(currentTable); setIsRenaming(true); }} title="Click to Rename">{currentTable}</span>
                                                        )}
                                                    </div>

                                                    <div className="flex gap-6 items-start flex-col xl:flex-row">
                                                        <div className="bg-monokai-sidebar border border-monokai-accent rounded flex-1 w-full flex flex-col shadow-lg">
                                                            <table className="w-full text-left">
                                                                <thead className="bg-monokai-accent/50 text-xs uppercase tracking-wider">
                                                                    <tr>
                                                                        <th className="p-3 text-monokai-blue font-mono">Column</th><th className="p-3 text-monokai-orange font-mono">Type</th><th className="p-3 text-monokai-pink font-mono">Constraints</th><th className="p-3 text-monokai-green font-mono text-right">Action</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="text-sm">
                                                                    {schema.map(col => {
                                                                        const isEditing = editColumnMode?.colName === col.name;
                                                                        return <tr key={col.name} className="border-b border-monokai-accent/50 hover:bg-monokai-accent/20 transition-colors">
                                                                            <td className="p-3 font-mono font-bold text-monokai-fg">{isEditing ? <input value={editColumnMode.newName} onChange={e => setEditColumnMode({ ...editColumnMode, newName: e.target.value })} className="bg-monokai-bg border border-monokai-blue px-2 py-1 rounded w-full outline-none text-white" /> : col.name}</td>
                                                                            <td className="p-3 font-mono text-monokai-comment">
                                                                                {isEditing ?
                                                                                    <select value={editColumnMode.newType} onChange={e => setEditColumnMode({ ...editColumnMode, newType: e.target.value })} className="bg-monokai-bg border border-monokai-blue px-2 py-1 rounded w-full outline-none text-white">{['VARCHAR', 'INTEGER', 'BOOLEAN', 'FLOAT', 'DOUBLE', 'DATE', 'TIMESTAMP', 'JSON', 'BLOB'].map(t => <option key={t} value={t}>{t}</option>)}</select>
                                                                                    : <span className="flex items-center gap-2 px-2 py-1 bg-monokai-bg rounded w-fit border border-monokai-accent/30">{getTypeIcon(col.type)} {col.type}</span>
                                                                                }
                                                                            </td>
                                                                            <td className="p-3 font-mono text-xs">{col.pk ? <span className="bg-monokai-pink/20 text-monokai-pink border border-monokai-pink px-2 py-0.5 rounded mr-2 font-bold">PK</span> : null}{col.notnull ? <span className="bg-monokai-yellow/20 text-monokai-yellow border border-monokai-yellow px-2 py-0.5 rounded font-bold">NOT NULL</span> : null}</td>
                                                                            <td className="p-3 text-right flex justify-end gap-2">
                                                                                {isEditing ? <><button onClick={handleSaveColumnEdit} className="text-xs bg-monokai-green text-monokai-bg px-2 py-1 rounded font-bold">Save</button><button onClick={() => setEditColumnMode(null)} className="text-xs bg-monokai-accent text-white px-2 py-1 rounded">Cancel</button></> : <><button onClick={() => setEditColumnMode({ colName: col.name, newName: col.name, newType: col.type })} className="text-xs bg-monokai-accent hover:bg-monokai-comment px-2 py-1 rounded text-monokai-fg transition-colors">Edit</button><button onClick={() => showColumnStats(col.name)} className="text-xs bg-monokai-accent hover:bg-monokai-comment px-2 py-1 rounded text-monokai-blue transition-colors">Stats</button><button onClick={() => handleDropColumn(col.name)} className="text-xs bg-monokai-accent hover:bg-monokai-pink hover:text-white px-2 py-1 rounded text-monokai-pink transition-colors" title="Drop Column">✕</button></>}
                                                                            </td>
                                                                        </tr>
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                            {selectedColStats && (
                                                                <div className="p-4 bg-monokai-bg border-t border-monokai-accent animate-[slideIn_0.2s_ease-out]">
                                                                    <div className="flex justify-between items-center mb-2"><h4 className="font-bold text-monokai-yellow">Stats: {selectedColStats.col}</h4><button onClick={() => setSelectedColStats(null)} className="text-monokai-comment hover:text-white">✕</button></div>
                                                                    <div className="grid grid-cols-5 gap-4 text-center mb-4">
                                                                        <div className="bg-monokai-sidebar p-2 rounded border border-monokai-accent"><div className="text-xs text-monokai-comment">Total</div><div className="font-mono text-lg">{selectedColStats.stats.total_count}</div></div>
                                                                        <div className="bg-monokai-sidebar p-2 rounded border border-monokai-accent"><div className="text-xs text-monokai-comment">Nulls</div><div className="font-mono text-lg text-monokai-orange">{selectedColStats.stats.null_count}</div></div>
                                                                        <div className="bg-monokai-sidebar p-2 rounded border border-monokai-accent"><div className="text-xs text-monokai-comment">Unique (Est)</div><div className="font-mono text-lg text-monokai-blue">{selectedColStats.stats.distinct_count}</div></div>
                                                                        <div className="bg-monokai-sidebar p-2 rounded border border-monokai-accent"><div className="text-xs text-monokai-comment">Min</div><div className="font-mono text-sm truncate py-1" title={String(selectedColStats.stats.min)}>{String(selectedColStats.stats.min)}</div></div>
                                                                        <div className="bg-monokai-sidebar p-2 rounded border border-monokai-accent"><div className="text-xs text-monokai-comment">Max</div><div className="font-mono text-sm truncate py-1" title={String(selectedColStats.stats.max)}>{String(selectedColStats.stats.max)}</div></div>
                                                                    </div>
                                                                    {selectedColStats.stats.top_k && selectedColStats.stats.top_k.length > 0 && (
                                                                        <div className="bg-monokai-sidebar p-3 rounded border border-monokai-accent"><h5 className="text-xs uppercase font-bold text-monokai-comment mb-2">Top 5 Values</h5><div className="space-y-1">{selectedColStats.stats.top_k.map((k, idx) => (<div key={idx} className="flex items-center gap-2 text-xs"><div className="w-24 truncate text-right font-mono" title={String(k.value)}>{String(k.value)}</div><div className="flex-1 h-2 bg-monokai-bg rounded-full overflow-hidden"><div className="h-full bg-monokai-green" style={{ width: `${(k.count / selectedColStats.stats.total_count) * 100}%` }}></div></div><div className="w-10 text-right text-monokai-comment">{k.count}</div></div>))}</div></div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="bg-monokai-sidebar p-5 border border-monokai-accent rounded w-full xl:w-80 shrink-0 shadow-lg">
                                                            <h3 className="text-monokai-green font-bold mb-4 uppercase text-sm">Add New Column</h3>
                                                            <div className="space-y-4">
                                                                <div><label className="block text-xs text-monokai-comment mb-1">Column Name</label><input value={newColName} onChange={e => setNewColName(e.target.value)} className="w-full bg-monokai-bg border border-monokai-accent p-2 rounded text-sm text-white focus:border-monokai-green outline-none" placeholder="e.g., status" /></div>
                                                                <div><label className="block text-xs text-monokai-comment mb-1">Type</label><select value={newColType} onChange={e => setNewColType(e.target.value)} className="w-full bg-monokai-bg border border-monokai-accent p-2 rounded text-sm text-white outline-none">{['VARCHAR', 'INTEGER', 'BOOLEAN', 'FLOAT', 'DOUBLE', 'DATE', 'TIMESTAMP', 'JSON'].map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                                                                <button onClick={handleAddColumn} className="w-full bg-monokai-green text-monokai-bg font-bold py-2 rounded hover:opacity-90 transition-opacity">Add Column</button>
                                                            </div>

                                                            <div className="mt-8 pt-6 border-t border-monokai-accent">
                                                                <h3 className="text-monokai-comment font-bold uppercase text-sm mb-2">DDL Preview</h3>
                                                                <div className="relative group">
                                                                    <pre className="font-mono text-[10px] text-monokai-green overflow-x-auto p-2 bg-monokai-bg rounded border border-monokai-accent/50 max-h-40">{`CREATE TABLE ${currentTable} (\n  ${schema.map(c => `${c.name} ${c.type}${c.pk ? ' PRIMARY KEY' : ''}`).join(',\n  ')}\n);`}</pre>
                                                                    <button onClick={handleCopySchema} className="absolute top-1 right-1 text-[10px] bg-monokai-accent hover:bg-white hover:text-monokai-bg text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">Copy</button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="h-full flex items-center justify-center text-monokai-comment flex-col">
                                                    <div className="text-4xl mb-4 opacity-50">👈</div>
                                                    <p>Select a table from the sidebar to view structure.</p>
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* SQL TAB */}
                        <div className={activeTab === Tab.SQL ? 'block h-full' : 'hidden'}>
                            <div className="h-full p-4 bg-monokai-bg">
                                <SqlEditor
                                    onRun={() => { refreshTables(); refreshAudit(); }}
                                    initialCode={pendingSql}
                                    pendingChartConfig={pendingChartConfig}
                                    isZenMode={isZenMode}
                                    onToggleZen={() => setIsZenMode(!isZenMode)}
                                    onPendingConsumed={handlePendingConsumed}
                                />
                            </div>
                        </div>

                        {/* TUTORIALS TAB */}
                        <div className={activeTab === Tab.TUTORIALS ? 'block h-full' : 'hidden'}>
                            <LearnApp
                                onTryCode={(code) => { setPendingSql(code); setActiveTab(Tab.SQL); }}
                                onOpenTable={(tableName) => {
                                    handleTableSelect(tableName);
                                    setActiveTab(Tab.DATA);
                                }}
                            />
                        </div>

                        {/* SCHEMA GENERATOR TAB */}
                        <div className={activeTab === Tab.SCHEMA_GENERATOR ? 'block h-full' : 'hidden'}>
                            <SchemaGenerator
                                onExecuteSql={(sql) => {
                                    setPendingSql(sql);
                                    setActiveTab(Tab.SQL);
                                }}
                                onRefresh={() => {
                                    refreshTables();
                                    refreshAudit();
                                }}
                            />
                        </div>

                        {/* METRICS TAB */}
                        <div className={activeTab === Tab.METRICS ? 'block h-full' : 'hidden'}>
                            <MetricManager
                                tables={tables}
                                onExecuteSql={(sql) => {
                                    setPendingSql(sql);
                                    setActiveTab(Tab.SQL);
                                }}
                                onChartGenerated={handleChartGenerated}
                            />
                        </div>

                        {/* AUDIT TAB */}
                        <div className={activeTab === Tab.AUDIT ? 'block h-full' : 'hidden'}>
                            <div className="h-full flex flex-col bg-monokai-bg">
                                <div className="p-4 border-b border-monokai-accent shrink-0"><h2 className="text-xl font-bold text-monokai-orange">System Audit Log</h2><p className="text-sm text-monokai-comment">Persistent tracking of all data modification operations.</p></div>
                                <div className="flex-1 overflow-auto">
                                    <table className="w-full text-left text-sm whitespace-nowrap">
                                        <thead className="bg-monokai-accent sticky top-0"><tr><th className="p-3 font-mono text-monokai-blue">Time</th><th className="p-3 font-mono text-monokai-pink">Type</th><th className="p-3 font-mono text-monokai-yellow">Table</th><th className="p-3 font-mono text-monokai-fg w-full">Details</th><th className="p-3 font-mono text-monokai-green text-right">Rows</th></tr></thead>
                                        <tbody className="font-mono">{auditLogs.map((log) => (<tr key={log.id} className="border-b border-monokai-accent hover:bg-monokai-sidebar"><td className="p-3 text-monokai-comment">{new Date(log.log_time).toLocaleString()}</td><td className="p-3 font-bold">{log.operation_type}</td><td className="p-3">{log.target_table || '-'}</td><td className="p-3 opacity-90 truncate max-w-xl" title={log.details}>{log.details}</td><td className="p-3 text-right">{log.affected_rows}</td></tr>))}</tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* EXTENSIONS TAB */}
                        <div className={activeTab === Tab.EXTENSIONS ? 'block h-full' : 'hidden'}>
                            <div className="bg-monokai-bg h-full"><Extensions onTryExtension={(sql) => { setPendingSql(sql); setActiveTab(Tab.SQL); }} /></div>
                        </div>
                    </div>
                </div>
            </div>


            <AICooldownBanner />
        </div>
    );
};

export default App;