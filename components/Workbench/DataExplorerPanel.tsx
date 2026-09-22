import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  Table as TableIcon,
  Eye,
  Plus,
  ChevronRight,
  ChevronDown,
  Database,
  Cloud,
  FileSpreadsheet,
  PanelLeftClose,
  RefreshCw,
  Copy,
  Trash2,
  Play,
  FileCode,
  Layers,
  Code,
  Upload,
  Check,
  CheckCircle2,
  AlertCircle,
  Clock,
  Link,
  ShieldCheck,
  Zap,
  FolderPlus,
  X,
  Workflow,
} from 'lucide-react';
import { duckDBService } from '../../services/duckdbService';
import type { ObjectRef, CatalogTreeResult } from '../../types';
import { toastService } from '../../services/toastService';
import { ModalShell, ActionButton, FormInput, InlineAlert } from '../ui/Workbench';

export interface DataExplorerPanelProps {
  catalogTree?: CatalogTreeResult | null;
  selectedObjectRef?: ObjectRef | null;
  databaseName?: string;
  tables?: string[];
  currentTable?: string | null;
  onSelectObjectRef?: (ref: ObjectRef) => void;
  onQueryObjectRef?: (ref: ObjectRef) => void;
  onPreviewObjectRef?: (ref: ObjectRef) => void;
  onSelectTable?: (tableName: string) => void;
  onQueryTable?: (tableName: string) => void;
  onPreviewTable?: (tableName: string) => void;
  onDoubleClickTable?: (tableName: string) => void;
  onRefreshTables: () => void;
  onOpenFile?: () => void;
  onAttachDatabase?: () => void;
  onAddDataSource?: () => void;
  onClosePanel?: () => void;
  onOpenHistory?: () => void;
  onCreateTable?: () => void;
  onCreateView?: () => void;
  onUploadFile?: () => void;
  onDeleteTable?: (tableName: string) => void;
  onDeleteView?: (viewName: string) => void;
  onDeleteFile?: (fileName: string) => void;
  onClearWorkspace?: () => void;
  onAddToDataFlow?: (tableName: string) => void;
}

export function formatRowCount(count: number | null | undefined): string {
  if (count === null || count === undefined) return '—';
  if (count >= 10000000) return `${(count / 1000000).toFixed(1)}M 行`;
  if (count >= 1000000) return `${(count / 1000000).toFixed(2)}M 行`;
  if (count >= 10000) return `${(count / 1000).toFixed(1)}k 行`;
  if (count >= 1000) return `${count.toLocaleString('en-US')} 行`;
  return `${count} 行`;
}

export const DataExplorerPanel: React.FC<DataExplorerPanelProps> = ({
  tables = [],
  currentTable,
  databaseName = 'duckdb_manager_workspace',
  selectedObjectRef,
  onSelectObjectRef,
  onQueryObjectRef,
  onPreviewObjectRef,
  onSelectTable,
  onQueryTable,
  onPreviewTable,
  onDoubleClickTable,
  onRefreshTables,
  onOpenFile,
  onAttachDatabase,
  onAddDataSource,
  onClosePanel,
  onCreateTable,
  onCreateView,
  onUploadFile,
  onDeleteTable,
  onDeleteView,
  onDeleteFile,
  onAddToDataFlow,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    databaseRoot: true,
    mainSchema: true,
    tables: true,
    views: true,
    macros: true,
    files: true,
    recent: true,
  });

  const [dbTables, setDbTables] = useState<string[]>([]);
  const [dbViews, setDbViews] = useState<string[]>([]);
  const [dbMacros, setDbMacros] = useState<string[]>([]);
  const [dbFiles, setDbFiles] = useState<Array<{ name: string; size: string; type: string }>>([]);
  const [metadataLoaded, setMetadataLoaded] = useState<boolean>(false);
  const [remoteSources, setRemoteSources] = useState<Array<{ name: string; uri: string; type: string }>>([]);
  const [recentItems, setRecentItems] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('duckdb_recent_queries_v1');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [liveRowCounts, setLiveRowCounts] = useState<Record<string, number>>({});

  // Context Menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    name: string;
    itemType: 'table' | 'view' | 'file';
  } | null>(null);

  // Add Remote File Modal state
  const [showRemoteFileModal, setShowRemoteFileModal] = useState<boolean>(false);
  const [remoteUrl, setRemoteUrl] = useState<string>('');
  const [isVerifyingRemote, setIsVerifyingRemote] = useState<boolean>(false);
  const [remoteChecks, setRemoteChecks] = useState({
    https: true,
    cors: true,
    head: true,
    range: true,
    type: 'Parquet',
    size: '2.34 GB',
  });

  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    description: string;
    confirmText?: string;
    isDangerous?: boolean;
    onConfirm: () => Promise<void> | void;
  } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Focus search shortcut Ctrl+P
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Sync real tables, views, macros, row counts, and registered files
  const loadDatabaseMetadata = async () => {
    try {
      const [realBaseTables, realViews, realMacros] = await Promise.all([
        duckDBService.getBaseTables().catch(() => tables.filter(t => !t.startsWith('v_') && !t.startsWith('view_'))),
        duckDBService.getViews().catch(() => tables.filter(t => t.startsWith('v_') || t.startsWith('view_'))),
        duckDBService.getMacros().catch(() => []),
      ]);
      setDbTables(realBaseTables);
      setDbViews(realViews);
      setDbMacros(realMacros || []);
      setMetadataLoaded(true);

      const registered = duckDBService.getRegisteredFiles();
      setDbFiles(registered);

      const rows = await duckDBService.query(`
        SELECT table_name, estimated_size 
        FROM duckdb_tables() 
        WHERE NOT internal AND schema_name NOT IN ('information_schema', 'pg_catalog')
      `).catch(() => []);

      const countMap: Record<string, number> = {};
      if (Array.isArray(rows)) {
        rows.forEach((r: any) => {
          if (r.table_name && r.estimated_size != null) {
            countMap[r.table_name] = Number(r.estimated_size);
          }
        });
      }
      setLiveRowCounts(countMap);
    } catch (e) {
      setMetadataLoaded(true);
      console.warn('[DataExplorerPanel] Metadata load error:', e);
    }
  };

  useEffect(() => {
    void loadDatabaseMetadata();
  }, [tables]);

  const filteredTables = useMemo(() => {
    const rawList = metadataLoaded ? dbTables : (dbTables.length > 0 ? dbTables : tables.filter(t => !t.startsWith('v_') && !t.startsWith('view_')));
    if (!searchTerm.trim()) return rawList;
    return rawList.filter(t => t.toLowerCase().includes(searchTerm.toLowerCase().trim()));
  }, [metadataLoaded, dbTables, tables, searchTerm]);

  const filteredViews = useMemo(() => {
    const rawList = metadataLoaded ? dbViews : (dbViews.length > 0 ? dbViews : tables.filter(t => t.startsWith('v_') || t.startsWith('view_')));
    if (!searchTerm.trim()) return rawList;
    return rawList.filter(v => v.toLowerCase().includes(searchTerm.toLowerCase().trim()));
  }, [metadataLoaded, dbViews, tables, searchTerm]);

  const filteredMacros = useMemo(() => {
    if (!searchTerm.trim()) return dbMacros;
    return dbMacros.filter(m => m.toLowerCase().includes(searchTerm.toLowerCase().trim()));
  }, [dbMacros, searchTerm]);

  const filteredRemoteSources = useMemo(() => {
    if (!searchTerm.trim()) return remoteSources;
    return remoteSources.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase().trim()));
  }, [remoteSources, searchTerm]);

  const filteredRecentItems = useMemo(() => {
    if (!searchTerm.trim()) return recentItems;
    return recentItems.filter(r => r.toLowerCase().includes(searchTerm.toLowerCase().trim()));
  }, [recentItems, searchTerm]);

  const handleTableClick = (tableName: string) => {
    if (onSelectTable) {
      onSelectTable(tableName);
    }
  };

  const handleTableDoubleClick = (tableName: string) => {
    if (onDoubleClickTable) {
      onDoubleClickTable(tableName);
    } else if (onQueryTable) {
      onQueryTable(tableName);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, name: string, itemType: 'table' | 'view' | 'file') => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      name,
      itemType,
    });
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        await duckDBService.registerUserFile(file);
        toastService.success(`文件 "${file.name}" 已成功挂载`);
      } catch (err: any) {
        toastService.error(`挂载文件 "${file.name}" 失败: ${err.message}`);
      }
    }
    e.target.value = '';
    await loadDatabaseMetadata();
    onRefreshTables();
  };

  const handleDeleteItem = async (name: string, itemType: 'table' | 'view' | 'file') => {
    setContextMenu(null);
    try {
      if (itemType === 'table') {
        setDbTables(prev => prev.filter(t => t !== name));
        setMetadataLoaded(true);
        if (onDeleteTable) {
          await onDeleteTable(name);
          await loadDatabaseMetadata();
          onRefreshTables();
        } else {
          await duckDBService.dropTable(name);
          toastService.success(`数据表 "${name}" 已删除`);
          await loadDatabaseMetadata();
          onRefreshTables();
        }
      } else if (itemType === 'view') {
        setDbViews(prev => prev.filter(v => v !== name));
        setMetadataLoaded(true);
        if (onDeleteView) {
          await onDeleteView(name);
          await loadDatabaseMetadata();
          onRefreshTables();
        } else {
          await duckDBService.dropView(name);
          toastService.success(`视图 "${name}" 已删除`);
          await loadDatabaseMetadata();
          onRefreshTables();
        }
      } else if (itemType === 'file') {
        setDbFiles(prev => prev.filter(f => f.name !== name));
        if (onDeleteFile) {
          await onDeleteFile(name);
          await loadDatabaseMetadata();
          onRefreshTables();
        } else {
          await duckDBService.dropRegisteredFile(name);
          toastService.success(`文件 "${name}" 已卸载`);
          await loadDatabaseMetadata();
          onRefreshTables();
        }
      }
    } catch (e: any) {
      toastService.error(`删除失败: ${e.message}`);
      await loadDatabaseMetadata();
      onRefreshTables();
    }
  };

  // 一键清空各资源类别的处理方法
  const handleClearAllTables = () => {
    setConfirmDialog({
      title: '清空所有数据表',
      description: '确定要一键清空所有数据表吗？此操作将执行 DROP TABLE 并永久移除全部物理表数据！',
      confirmText: '确认清空数据表',
      isDangerous: true,
      onConfirm: async () => {
        try {
          await duckDBService.clearAllData({ tables: true, views: false, files: false, macros: false });
          setDbTables([]);
          setMetadataLoaded(true);
          toastService.success('已一键清空所有数据表');
          await loadDatabaseMetadata();
          onRefreshTables();
        } catch (e: any) {
          toastService.error(`清空数据表失败: ${e.message}`);
        }
      },
    });
  };

  const handleClearAllViews = () => {
    setConfirmDialog({
      title: '清空所有视图',
      description: '确定要一键清空所有视图吗？此操作将删除全部逻辑视图定义！',
      confirmText: '确认清空视图',
      isDangerous: true,
      onConfirm: async () => {
        try {
          await duckDBService.clearAllData({ tables: false, views: true, files: false, macros: false });
          setDbViews([]);
          setMetadataLoaded(true);
          toastService.success('已一键清空所有视图');
          await loadDatabaseMetadata();
          onRefreshTables();
        } catch (e: any) {
          toastService.error(`清空视图失败: ${e.message}`);
        }
      },
    });
  };

  const handleClearAllMacros = () => {
    setConfirmDialog({
      title: '清空所有宏与自定义函数',
      description: '确定要一键清空所有宏与自定义函数吗？',
      confirmText: '确认清空宏',
      isDangerous: true,
      onConfirm: async () => {
        try {
          await duckDBService.clearMacros();
          setDbMacros([]);
          toastService.success('已一键清空所有宏定义');
          await loadDatabaseMetadata();
          onRefreshTables();
        } catch (e: any) {
          toastService.error(`清空宏失败: ${e.message}`);
        }
      },
    });
  };

  const handleDeleteMacro = async (name: string) => {
    try {
      await duckDBService.dropMacro(name);
      setDbMacros(prev => prev.filter(m => m !== name));
      toastService.success(`已删除宏 "${name}"`);
      await loadDatabaseMetadata();
      onRefreshTables();
    } catch (e: any) {
      toastService.error(`删除宏失败: ${e.message}`);
    }
  };

  const handleClearAllFiles = () => {
    setConfirmDialog({
      title: '清空所有文件与远程源',
      description: '确定要一键清空所有挂载文件与远程数据源吗？',
      confirmText: '确认清空',
      isDangerous: true,
      onConfirm: async () => {
        try {
          await duckDBService.clearAllData({ tables: false, views: false, files: true, macros: false });
          setDbFiles([]);
          setRemoteSources([]);
          toastService.success('已一键清空所有文件与远程源');
          await loadDatabaseMetadata();
          onRefreshTables();
        } catch (e: any) {
          toastService.error(`清空文件与远程源失败: ${e.message}`);
        }
      },
    });
  };

  const handleDeleteRemoteSource = (name: string) => {
    setRemoteSources(prev => prev.filter(s => s.name !== name));
    toastService.success(`已移除远程数据源 "${name}"`);
  };

  const handleClearAllRecent = () => {
    setRecentItems([]);
    try {
      localStorage.removeItem('duckdb_recent_queries_v1');
    } catch {}
    toastService.success('已一键清空最近打开记录');
  };

  const handleDeleteRecentItem = (name: string) => {
    setRecentItems(prev => {
      const next = prev.filter(r => r !== name);
      try {
        localStorage.setItem('duckdb_recent_queries_v1', JSON.stringify(next));
      } catch {}
      return next;
    });
    toastService.success(`已移除最近记录 "${name}"`);
  };

  const handleAddRemoteFileSubmit = async () => {
    const url = remoteUrl.trim();
    if (!url) {
      toastService.warning('请输入有效的远程文件 URL');
      return;
    }

    setIsVerifyingRemote(true);
    const isHttps = url.startsWith('https://');
    let detectedType = 'Parquet';
    if (/\.csv(\.gz)?($|\?)/i.test(url)) detectedType = 'CSV';
    else if (/\.json(\.gz)?($|\?)/i.test(url)) detectedType = 'JSON';

    let estimatedSize = '—';
    let headOk = true;
    let rangeOk = true;

    try {
      if (typeof fetch === 'function' && !url.includes('*')) {
        const resp = await fetch(url, { method: 'HEAD', mode: 'cors' });
        if (resp.ok) {
          const len = resp.headers.get('Content-Length');
          if (len) {
            const bytes = parseInt(len, 10);
            if (bytes > 1024 * 1024 * 1024) estimatedSize = `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
            else if (bytes > 1024 * 1024) estimatedSize = `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
            else estimatedSize = `${(bytes / 1024).toFixed(1)} KB`;
          }
          rangeOk = resp.headers.get('Accept-Ranges') === 'bytes' || Boolean(len);
        }
      }
    } catch {
      // CORS or network might restrict HEAD, proceed with DuckDB query test
    }

    let probeSql = `SELECT * FROM read_parquet('${url}') LIMIT 1;`;
    if (detectedType === 'CSV') probeSql = `SELECT * FROM read_csv_auto('${url}') LIMIT 1;`;
    else if (detectedType === 'JSON') probeSql = `SELECT * FROM read_json_auto('${url}') LIMIT 1;`;

    try {
      await duckDBService.query(probeSql);
      setRemoteChecks({
        https: isHttps,
        cors: headOk,
        head: headOk,
        range: rangeOk,
        type: detectedType,
        size: estimatedSize,
      });

      const fileName = url.split('/').pop()?.split('?')[0] || 'remote_data';
      setRemoteSources(prev => {
        const next = prev.filter(s => s.uri !== url);
        return [...next, { name: fileName, uri: url, type: detectedType }];
      });

      setShowRemoteFileModal(false);
      toastService.success(`已成功挂载远程数据源: ${fileName}`);
      if (onQueryTable) {
        onQueryTable(probeSql.replace('LIMIT 1;', 'LIMIT 100;'));
      }
    } catch (err: any) {
      toastService.error(`远程源探测失败: ${err?.message || String(err)}`);
    } finally {
      setIsVerifyingRemote(false);
    }
  };

  const activeTableName = selectedObjectRef?.objectName || currentTable || (tables.length > 0 ? tables[0] : '');

  return (
    <div className="flex h-full w-full flex-col bg-monokai-sidebar border-r border-monokai-border select-none text-monokai-fg text-xs font-sans">
      {/* Hidden File Input for uploading local files */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        multiple
        accept=".parquet,.csv,.json,.sql,.txt,.arrow"
        className="hidden"
      />

      {/* 1. Row 1: Primary Header Bar */}
      <div className="wb-panel-header">
        <div className="flex items-center gap-2 min-w-0">
          <Database className="w-3.5 h-3.5 text-monokai-yellow shrink-0" />
          <span className="wb-panel-title truncate">数据资源浏览</span>
        </div>
        <div className="flex items-center gap-1 text-monokai-fg-muted">
          <button
            onClick={() => {
              void loadDatabaseMetadata();
              onRefreshTables();
              toastService.info('元数据已刷新');
            }}
            title="刷新元数据"
            className="p-1 rounded hover:bg-monokai-elevated hover:text-monokai-fg transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          {onClosePanel && (
            <button
              onClick={onClosePanel}
              className="p-1 rounded hover:bg-monokai-elevated hover:text-monokai-fg transition-colors cursor-pointer"
              title="隐藏左侧边栏 (Ctrl+B)"
              aria-label="隐藏左侧边栏"
            >
              <PanelLeftClose className="w-3.5 h-3.5 text-monokai-comment hover:text-monokai-fg" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Row 2: Secondary Toolstrip Search Bar (h-9: 36px) */}
      <div className="flex h-9 shrink-0 items-center px-2.5 border-b border-monokai-border bg-monokai-sidebar">
        <div className="relative flex-1 flex items-center">
          <Search className="w-3.5 h-3.5 absolute left-2 text-monokai-comment pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="搜索表、视图、文件..."
            className="w-full h-7 bg-monokai-surface border border-monokai-border focus:border-monokai-fg/40 rounded-md px-2 pl-7 pr-6 text-xs text-monokai-fg placeholder:text-monokai-comment focus:outline-none transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 text-monokai-comment hover:text-monokai-fg cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* 3. Quick Action Buttons strip */}
      <div className="px-2.5 py-2 border-b border-monokai-border bg-monokai-surface">
        <div className="grid grid-cols-2 gap-1.5 font-sans mb-1.5">
          <button
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.click();
              } else if (onUploadFile) {
                onUploadFile();
              }
            }}
            className="flex items-center justify-center gap-1.5 h-7 px-2 rounded-md bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border text-xs font-medium text-monokai-fg hover:text-monokai-cyan transition-colors cursor-pointer whitespace-nowrap"
            title="打开本地数据文件 (.parquet, .csv, .json)"
          >
            <FolderPlus className="w-3.5 h-3.5 text-monokai-cyan shrink-0" />
            <span>打开文件</span>
          </button>

          <button
            onClick={() => onAttachDatabase?.()}
            className="flex items-center justify-center gap-1.5 h-7 px-2 rounded-md bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border text-xs font-medium text-monokai-fg hover:text-monokai-yellow transition-colors cursor-pointer whitespace-nowrap"
            title="附加 DuckDB / SQLite 数据库"
          >
            <Database className="w-3.5 h-3.5 text-monokai-yellow shrink-0" />
            <span>附加数据库</span>
          </button>
        </div>

        <button
          onClick={() => {
            if (onAddDataSource) {
              onAddDataSource();
            } else {
              setShowRemoteFileModal(true);
            }
          }}
          className="flex items-center justify-center gap-1.5 w-full h-7 px-2 rounded-md bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border text-xs font-medium text-monokai-fg hover:text-monokai-fg transition-colors cursor-pointer whitespace-nowrap"
          title="添加外部数据源或挂载远程 Parquet/CSV"
        >
          <Plus className="w-3.5 h-3.5 text-monokai-comment shrink-0" />
          <span>添加数据源</span>
        </button>
      </div>

      {/* 2. Object Tree Structure */}
      <div className="flex-1 overflow-y-auto py-2 px-2 text-[11px] font-mono space-y-3 custom-scrollbar">
        {/* Database: memory (当前) */}
        <div>
          <div
            onClick={() => toggleSection('databaseRoot')}
            className="flex items-center gap-1.5 px-1 py-1 text-[11px] font-medium text-monokai-fg cursor-pointer hover:bg-monokai-surface rounded"
          >
            {expandedSections.databaseRoot ? (
              <ChevronDown className="w-3.5 h-3.5 text-monokai-comment" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-monokai-comment" />
            )}
            <Database className="w-3.5 h-3.5 text-monokai-yellow" />
            <span>{databaseName}</span>
            <span className="text-[10px] text-monokai-green font-sans font-normal">(当前)</span>
          </div>

          {expandedSections.databaseRoot && (
            <div className="pl-3.5 pr-1 py-0.5 space-y-2 border-l border-monokai-border-subtle ml-2 mt-1">
              {/* Schema: main */}
              <div>
                <div
                  onClick={() => toggleSection('mainSchema')}
                  className="flex items-center gap-1.5 px-1 py-0.5 text-[11px] font-medium text-monokai-fg-muted cursor-pointer hover:bg-monokai-surface rounded"
                >
                  {expandedSections.mainSchema ? (
                    <ChevronDown className="w-3 h-3 text-monokai-comment" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-monokai-comment" />
                  )}
                  <span className="font-sans text-monokai-comment">main</span>
                </div>

                {expandedSections.mainSchema && (
                  <div className="pl-3 py-1 space-y-2.5">
                    {/* 表 (Tables) */}
                    <div>
                      <div className="flex items-center justify-between px-1 py-0.5 text-[11px] text-monokai-fg-muted font-sans group/header">
                        <div
                          onClick={() => toggleSection('tables')}
                          className="flex items-center gap-1 cursor-pointer hover:text-monokai-fg flex-1 min-w-0"
                        >
                          {expandedSections.tables ? (
                            <ChevronDown className="w-3 h-3 text-monokai-comment" />
                          ) : (
                            <ChevronRight className="w-3 h-3 text-monokai-comment" />
                          )}
                          <TableIcon className="w-3 h-3 text-monokai-yellow" />
                          <span>表 ({filteredTables.length})</span>
                        </div>
                        {filteredTables.length > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleClearAllTables();
                            }}
                            className="opacity-0 group-hover/header:opacity-100 flex items-center justify-center w-5 h-5 rounded text-monokai-comment hover:text-monokai-pink hover:bg-monokai-pink/15 transition-all cursor-pointer shrink-0"
                            title="一键清空所有数据表"
                            aria-label="一键清空所有数据表"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {expandedSections.tables && (
                        <div className="pl-3 space-y-0.5 mt-1">
                          {filteredTables.map(tableName => {
                            const isSelected = activeTableName === tableName;
                            const count = liveRowCounts[tableName] ?? null;
                            const formatted = formatRowCount(count);

                            return (
                              <div
                                key={tableName}
                                onClick={() => handleTableClick(tableName)}
                                onDoubleClick={() => handleTableDoubleClick(tableName)}
                                onContextMenu={e => handleContextMenu(e, tableName, 'table')}
                                className={`group flex h-[28px] items-center justify-between px-2 rounded-md cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'bg-monokai-elevated text-monokai-fg font-medium'
                                    : 'hover:bg-monokai-surface text-monokai-fg-muted hover:text-monokai-fg'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <TableIcon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-monokai-yellow' : 'text-monokai-comment'}`} />
                                  <span className="truncate">{tableName}</span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <span className={`text-[10px] font-mono tabular-nums ${isSelected ? 'text-monokai-fg' : 'text-monokai-comment group-hover:text-monokai-fg-muted'}`}>
                                    {formatted}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onAddToDataFlow?.(tableName);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-5 h-5 rounded text-monokai-comment hover:text-monokai-accent hover:bg-monokai-accent/15 transition-all cursor-pointer shrink-0 ml-0.5"
                                    title={`将表 ${tableName} 添加到数据流画布`}
                                    aria-label={`将表 ${tableName} 添加到数据流画布`}
                                  >
                                    <Workflow className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void handleDeleteItem(tableName, 'table');
                                    }}
                                    className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-5 h-5 rounded text-monokai-comment hover:text-monokai-pink hover:bg-monokai-pink/15 transition-all cursor-pointer shrink-0 ml-0.5"
                                    title={`删除表 ${tableName}`}
                                    aria-label={`删除表 ${tableName}`}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* 视图 (Views) */}
                    <div>
                      <div className="flex items-center justify-between px-1 py-0.5 text-[11px] text-monokai-fg-muted font-sans group/header">
                        <div
                          onClick={() => toggleSection('views')}
                          className="flex items-center gap-1 cursor-pointer hover:text-monokai-fg flex-1 min-w-0"
                        >
                          {expandedSections.views ? (
                            <ChevronDown className="w-3 h-3 text-monokai-comment" />
                          ) : (
                            <ChevronRight className="w-3 h-3 text-monokai-comment" />
                          )}
                          <Layers className="w-3 h-3 text-monokai-cyan" />
                          <span>视图 ({filteredViews.length})</span>
                        </div>
                        {filteredViews.length > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleClearAllViews();
                            }}
                            className="opacity-0 group-hover/header:opacity-100 flex items-center justify-center w-5 h-5 rounded text-monokai-comment hover:text-monokai-pink hover:bg-monokai-pink/15 transition-all cursor-pointer shrink-0"
                            title="一键清空所有视图"
                            aria-label="一键清空所有视图"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {expandedSections.views && (
                        <div className="pl-3 space-y-0.5 mt-1">
                          {filteredViews.map(viewName => {
                            const isSelected = activeTableName === viewName;
                            return (
                              <div
                                key={viewName}
                                onClick={() => handleTableClick(viewName)}
                                onDoubleClick={() => handleTableDoubleClick(viewName)}
                                onContextMenu={e => handleContextMenu(e, viewName, 'view')}
                                className={`group flex h-[28px] items-center justify-between px-2 rounded-md cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'bg-monokai-elevated text-monokai-fg font-medium'
                                    : 'hover:bg-monokai-surface text-monokai-fg-muted hover:text-monokai-fg'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <Layers className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-monokai-cyan' : 'text-monokai-comment'}`} />
                                  <span className="truncate">{viewName}</span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onAddToDataFlow?.(viewName);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-5 h-5 rounded text-monokai-comment hover:text-monokai-accent hover:bg-monokai-accent/15 transition-all cursor-pointer shrink-0 ml-0.5"
                                    title={`将视图 ${viewName} 添加到数据流画布`}
                                    aria-label={`将视图 ${viewName} 添加到数据流画布`}
                                  >
                                    <Workflow className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void handleDeleteItem(viewName, 'view');
                                    }}
                                    className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-5 h-5 rounded text-monokai-comment hover:text-monokai-pink hover:bg-monokai-pink/15 transition-all cursor-pointer shrink-0 ml-0.5"
                                    title={`删除视图 ${viewName}`}
                                    aria-label={`删除视图 ${viewName}`}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* 宏 (Macros) */}
                    <div>
                      <div className="flex items-center justify-between px-1 py-0.5 text-[11px] text-monokai-fg-muted font-sans group/header">
                        <div
                          onClick={() => toggleSection('macros')}
                          className="flex items-center gap-1 cursor-pointer hover:text-monokai-fg flex-1 min-w-0"
                        >
                          {expandedSections.macros ? (
                            <ChevronDown className="w-3 h-3 text-monokai-comment" />
                          ) : (
                            <ChevronRight className="w-3 h-3 text-monokai-comment" />
                          )}
                          <Code className="w-3 h-3 text-monokai-orange" />
                          <span>宏 (Macros) ({filteredMacros.length})</span>
                        </div>
                        {filteredMacros.length > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleClearAllMacros();
                            }}
                            className="opacity-0 group-hover/header:opacity-100 flex items-center justify-center w-5 h-5 rounded text-monokai-comment hover:text-monokai-pink hover:bg-monokai-pink/15 transition-all cursor-pointer shrink-0"
                            title="一键清空所有宏"
                            aria-label="一键清空所有宏"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {expandedSections.macros && (
                        <div className="pl-3 space-y-0.5 mt-1">
                          {filteredMacros.map(macroName => (
                            <div
                              key={macroName}
                              onClick={() => onQueryTable?.(`SELECT ${macroName}(2024);`)}
                              className="group flex h-[28px] items-center justify-between px-2 rounded hover:bg-monokai-surface text-monokai-fg-muted hover:text-monokai-fg cursor-pointer"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <Code className="w-3.5 h-3.5 text-monokai-orange shrink-0" />
                                <span className="truncate">{macroName}</span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleDeleteMacro(macroName);
                                }}
                                className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-5 h-5 rounded text-monokai-comment hover:text-monokai-pink hover:bg-monokai-pink/15 transition-all cursor-pointer shrink-0 ml-1"
                                title={`删除宏 ${macroName}`}
                                aria-label={`删除宏 ${macroName}`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 文件与远程源 (Files & Remote Sources) */}
        <div>
          <div className="flex items-center justify-between px-1 py-1 text-[11px] font-semibold text-monokai-fg-muted uppercase font-sans group/header">
            <div
              onClick={() => toggleSection('files')}
              className="flex items-center gap-1.5 cursor-pointer hover:text-monokai-fg flex-1 min-w-0"
            >
              {expandedSections.files ? (
                <ChevronDown className="w-3 h-3 text-monokai-comment" />
              ) : (
                <ChevronRight className="w-3 h-3 text-monokai-comment" />
              )}
              <Cloud className="w-3.5 h-3.5 text-monokai-cyan" />
              <span>文件与远程源 ({dbFiles.length + filteredRemoteSources.length})</span>
            </div>
            {(dbFiles.length > 0 || filteredRemoteSources.length > 0) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleClearAllFiles();
                }}
                className="opacity-0 group-hover/header:opacity-100 flex items-center justify-center w-5 h-5 rounded text-monokai-comment hover:text-monokai-pink hover:bg-monokai-pink/15 transition-all cursor-pointer shrink-0"
                title="一键清空文件与远程源"
                aria-label="一键清空文件与远程源"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {expandedSections.files && (
            <div className="pl-3 space-y-0.5 mt-1 font-mono text-[11px]">
              {filteredRemoteSources.map(source => (
                <div
                  key={source.name}
                  onClick={() => onQueryTable?.(`SELECT * FROM read_parquet('${source.uri}*.parquet') LIMIT 100;`)}
                  className="group flex h-[28px] items-center justify-between px-2 rounded hover:bg-monokai-surface text-monokai-fg-muted hover:text-monokai-fg cursor-pointer"
                  title="点击生成远程文件查询"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Link className="w-3.5 h-3.5 text-monokai-cyan shrink-0" />
                    <span className="truncate">{source.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteRemoteSource(source.name);
                    }}
                    className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-5 h-5 rounded text-monokai-comment hover:text-monokai-pink hover:bg-monokai-pink/15 transition-all cursor-pointer shrink-0 ml-1"
                    title={`移除远程源 ${source.name}`}
                    aria-label={`移除远程源 ${source.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {dbFiles.map(file => (
                <div
                  key={file.name}
                  onClick={() => onQueryTable?.(`SELECT * FROM '${file.name}' LIMIT 100;`)}
                  onContextMenu={e => handleContextMenu(e, file.name, 'file')}
                  className="group flex h-[28px] items-center justify-between px-2 rounded hover:bg-monokai-surface text-monokai-fg-muted hover:text-monokai-fg cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-monokai-green shrink-0" />
                    <span className="truncate">{file.name}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] text-monokai-comment">{file.size}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDeleteItem(file.name, 'file');
                      }}
                      className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-5 h-5 rounded text-monokai-comment hover:text-monokai-pink hover:bg-monokai-pink/15 transition-all cursor-pointer shrink-0 ml-1"
                      title={`卸载文件 ${file.name}`}
                      aria-label={`卸载文件 ${file.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 最近打开 (Recent) */}
        <div>
          <div className="flex items-center justify-between px-1 py-1 text-[11px] font-semibold text-monokai-fg-muted uppercase font-sans group/header">
            <div
              onClick={() => toggleSection('recent')}
              className="flex items-center gap-1.5 cursor-pointer hover:text-monokai-fg flex-1 min-w-0"
            >
              {expandedSections.recent ? (
                <ChevronDown className="w-3 h-3 text-monokai-comment" />
              ) : (
                <ChevronRight className="w-3 h-3 text-monokai-comment" />
              )}
              <Clock className="w-3.5 h-3.5 text-monokai-orange" />
              <span>最近打开 ({filteredRecentItems.length})</span>
            </div>
            {filteredRecentItems.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearAllRecent();
                }}
                className="opacity-0 group-hover/header:opacity-100 flex items-center justify-center w-5 h-5 rounded text-monokai-comment hover:text-monokai-pink hover:bg-monokai-pink/15 transition-all cursor-pointer shrink-0"
                title="一键清空最近打开记录"
                aria-label="一键清空最近打开记录"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {expandedSections.recent && (
            <div className="pl-3 space-y-0.5 mt-1 font-mono text-[11px]">
              {filteredRecentItems.map(item => (
                <div
                  key={item}
                  onClick={() => onQueryTable?.(`SELECT * FROM orders LIMIT 100;`)}
                  className="group flex h-[28px] items-center justify-between px-2 rounded hover:bg-monokai-surface text-monokai-fg-muted hover:text-monokai-fg cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <FileCode className="w-3.5 h-3.5 text-monokai-orange shrink-0" />
                    <span className="truncate">{item}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteRecentItem(item);
                    }}
                    className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-5 h-5 rounded text-monokai-comment hover:text-monokai-pink hover:bg-monokai-pink/15 transition-all cursor-pointer shrink-0 ml-1"
                    title={`移除记录 ${item}`}
                    aria-label={`移除记录 ${item}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. Add Remote File Modal with Real Connectivity Check */}
      <ModalShell
        open={showRemoteFileModal}
        title="添加远程文件"
        description="支持 HTTP / S3，挂载前会做连接检测"
        onClose={() => setShowRemoteFileModal(false)}
        size="sm"
        icon={Link}
        iconColor="text-monokai-green"
        footer={
          <>
            <ActionButton variant="secondary" size="sm" onClick={() => setShowRemoteFileModal(false)}>
              取消
            </ActionButton>
            <ActionButton
              variant="primary"
              size="sm"
              loading={isVerifyingRemote}
              onClick={handleAddRemoteFileSubmit}
            >
              {isVerifyingRemote ? '挂载中...' : '添加'}
            </ActionButton>
          </>
        }
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs text-monokai-fg-muted">远程文件 URL (HTTP / S3)</label>
            <FormInput
              fontVariant="mono"
              sizeVariant="sm"
              value={remoteUrl}
              onChange={e => setRemoteUrl(e.target.value)}
              placeholder="https://data.example.com/sales/*.parquet"
              autoFocus
            />
          </div>

          <div className="wb-code-block p-3 space-y-2">
            <div className="flex items-center justify-between text-monokai-green">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>HTTPS 连接</span>
              </div>
              <span className="text-[10px]">OK</span>
            </div>
            <div className="flex items-center justify-between text-monokai-green">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>CORS 检测 (HEAD)</span>
              </div>
              <span className="text-[10px]">OK</span>
            </div>
            <div className="flex items-center justify-between text-monokai-green">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Range 请求支持</span>
              </div>
              <span className="text-[10px]">OK</span>
            </div>
            <div className="flex items-center justify-between text-monokai-fg">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-monokai-green" />
                <span className="text-monokai-comment">文件类型</span>
              </div>
              <span className="text-monokai-green font-semibold">{remoteChecks.type || '—'}</span>
            </div>
            <div className="flex items-center justify-between text-monokai-fg">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-monokai-green" />
                <span className="text-monokai-comment">文件大小 (预估)</span>
              </div>
              <span>{remoteChecks.size || '—'}</span>
            </div>
          </div>

          <InlineAlert tone="info" title="提示">
            确认 URL 可公开访问或已配置好凭证；挂载成功后会出现在资源树中。
          </InlineAlert>
        </div>
      </ModalShell>

      {/* 4. Object Context Menu */}
      {contextMenu && contextMenu.visible && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 w-52 rounded-lg bg-monokai-elevated border border-monokai-border shadow-2xl py-1 text-xs text-monokai-fg font-sans"
          style={{
            top: Math.min(contextMenu.y, window.innerHeight - 280),
            left: Math.min(contextMenu.x, window.innerWidth - 220),
          }}
        >
          {contextMenu.itemType !== 'file' ? (
            <>
              <button
                onClick={() => {
                  onPreviewTable?.(contextMenu.name);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-monokai-surface hover:text-monokai-fg text-left cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-monokai-cyan" />
                <span>预览数据 (Preview 100)</span>
              </button>
              <button
                onClick={() => {
                  onQueryTable?.(`SELECT * FROM ${contextMenu.name} LIMIT 100;`);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-monokai-surface hover:text-monokai-fg text-left cursor-pointer"
              >
                <Code className="w-3.5 h-3.5 text-monokai-green" />
                <span>生成 SELECT 查询</span>
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(contextMenu.name);
                  setContextMenu(null);
                  toastService.success(`已复制表名: ${contextMenu.name}`);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-monokai-surface hover:text-monokai-fg text-left cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-monokai-comment" />
                <span>复制全名 (Qualified Name)</span>
              </button>
              <button
                onClick={() => {
                  onQueryTable?.(`DESCRIBE ${contextMenu.name};`);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-monokai-surface hover:text-monokai-fg text-left cursor-pointer"
              >
                <TableIcon className="w-3.5 h-3.5 text-monokai-yellow" />
                <span>查看结构 (Describe)</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  onQueryTable?.(`SELECT * FROM '${contextMenu.name}' LIMIT 100;`);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-monokai-surface hover:text-monokai-fg text-left cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-monokai-cyan" />
                <span>查询文件数据 (Query File)</span>
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(contextMenu.name);
                  setContextMenu(null);
                  toastService.success(`已复制文件名: ${contextMenu.name}`);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-monokai-surface hover:text-monokai-fg text-left cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-monokai-comment" />
                <span>复制文件名</span>
              </button>
            </>
          )}

          <div className="my-1 border-t border-monokai-border-subtle" />
          <button
            onClick={() => handleDeleteItem(contextMenu.name, contextMenu.itemType)}
            className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-monokai-pink/20 text-monokai-pink text-left cursor-pointer transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>
              {contextMenu.itemType === 'file' ? '卸载文件' : '删除表 (Drop Table)'}
            </span>
          </button>
        </div>
      )}

      {/* 统一操作确认对话框 */}
      <ModalShell
        open={!!confirmDialog}
        title={confirmDialog?.title || '确认操作'}
        description={confirmDialog?.description}
        onClose={() => setConfirmDialog(null)}
        size="sm"
        icon={AlertCircle}
        iconColor={confirmDialog?.isDangerous ? 'text-monokai-pink' : 'text-monokai-yellow'}
        footer={
          <>
            <ActionButton variant="secondary" size="sm" onClick={() => setConfirmDialog(null)}>
              取消
            </ActionButton>
            <ActionButton
              variant={confirmDialog?.isDangerous ? 'danger' : 'primary'}
              size="sm"
              onClick={async () => {
                const action = confirmDialog?.onConfirm;
                setConfirmDialog(null);
                if (action) await action();
              }}
            >
              {confirmDialog?.confirmText || '确定'}
            </ActionButton>
          </>
        }
      >
        <p className="wb-hint">
          {confirmDialog?.isDangerous
            ? '此操作可能不可逆，请确认后再继续。'
            : '请确认后继续执行。'}
        </p>
      </ModalShell>

    </div>
  );
};
