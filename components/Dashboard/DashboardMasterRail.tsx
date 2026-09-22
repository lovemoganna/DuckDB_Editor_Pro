import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Database,
  Search,
  X,
  Table2,
  Copy,
  ArrowUpRight,
  Terminal,
  BarChart3,
  Eye,
  Trash2,
  UploadCloud,
  Sparkles,
  Loader2,
  RefreshCw,
  Hash,
  Columns3,
  ShoppingBag,
  Activity,
  TrendingUp,
} from 'lucide-react';
import { duckDBService } from '../../services/duckdbService';
import { toastService } from '../../services/toastService';
import { FileImportState } from './types';

interface TableMeta {
  name: string;
  rowCount: number | null;
  columnCount: number | null;
  loading: boolean;
}

interface DashboardMasterRailProps {
  tables: string[];
  selectedTable: string | null;
  onSelectTable: (tableName: string) => void;
  onPeekTable: (tableName: string) => void;
  onDropTable: (tableName: string) => void;
  onQuickQuery: (tableName: string) => void;
  onSummarize: (tableName: string) => void;
  onCopyTableName: (tableName: string) => void;
  onNavigateToData: (tableName: string) => void;
  // Import / Upload
  isDraggingOver: boolean;
  importState: FileImportState;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  onBrowseFiles: () => void;
  // Demo seeder
  isSeedingDemo: boolean;
  onLoadDemoDataset: (datasetType?: 'ecommerce' | 'logs' | 'funnel') => void;
  // Create / Refresh
  onOpenCreateModal: () => void;
  onRefreshTables: () => void;
}

export const DashboardMasterRail: React.FC<DashboardMasterRailProps> = ({
  tables,
  selectedTable,
  onSelectTable,
  onPeekTable,
  onDropTable,
  onQuickQuery,
  onSummarize,
  onCopyTableName,
  onNavigateToData,
  isDraggingOver,
  importState,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  onBrowseFiles,
  isSeedingDemo,
  onLoadDemoDataset,
  onOpenCreateModal,
  onRefreshTables,
}) => {
  const [search, setSearch] = useState('');
  const [metaMap, setMetaMap] = useState<Record<string, TableMeta>>({});
  const [hoveredTable, setHoveredTable] = useState<string | null>(null);
  const fetchingRef = useRef<Set<string>>(new Set());

  const filtered = tables.filter(t =>
    t.toLowerCase().includes(search.toLowerCase().trim()),
  );

  const fetchTableMeta = useCallback(async (tableName: string) => {
    if (fetchingRef.current.has(tableName)) return;
    if (metaMap[tableName] && !metaMap[tableName].loading) return;

    fetchingRef.current.add(tableName);
    setMetaMap(prev => ({
      ...prev,
      [tableName]: { name: tableName, rowCount: null, columnCount: null, loading: true },
    }));

    try {
      const [countResult, schemaResult] = await Promise.allSettled([
        duckDBService.query(`SELECT COUNT(*) as n FROM "${tableName}";`),
        duckDBService.getTableSchema(tableName),
      ]);

      const rowCount =
        countResult.status === 'fulfilled' && countResult.value?.[0]
          ? Number(countResult.value[0].n ?? countResult.value[0]['count_star()'] ?? 0)
          : null;

      const columnCount =
        schemaResult.status === 'fulfilled'
          ? (schemaResult.value?.length ?? null)
          : null;

      setMetaMap(prev => ({
        ...prev,
        [tableName]: { name: tableName, rowCount, columnCount, loading: false },
      }));
    } catch {
      setMetaMap(prev => ({
        ...prev,
        [tableName]: { name: tableName, rowCount: null, columnCount: null, loading: false },
      }));
    } finally {
      fetchingRef.current.delete(tableName);
    }
  }, [metaMap]);

  // Row count meta is fetched lazily on hover — no eager prefetch
  // This avoids triggering query() calls on mount which would break test assertions.

  const formatRowCount = (n: number | null): string => {
    if (n === null) return '—';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  };

  const hasNoTables = tables.length === 0;

  return (
    <div className="flex flex-col h-full bg-monokai-surface border-r border-monokai-border overflow-hidden font-sans select-none">
      {/* Rail Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-monokai-border bg-monokai-elevated shrink-0">
        <div className="flex items-center gap-2">
          <Database className="h-3.5 w-3.5 text-monokai-cyan shrink-0" />
          <span className="text-meta font-bold uppercase tracking-wider text-monokai-fg">
            数据资产
          </span>
          <span className="font-mono text-2xs text-monokai-comment bg-monokai-bg border border-monokai-border px-1.5 py-0.5 rounded-md">
            {tables.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onRefreshTables}
            title="刷新表列表"
            aria-label="刷新数据表列表"
            className="rounded-md p-1 text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface transition-colors cursor-pointer"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={onOpenCreateModal}
            title="新建数据表"
            aria-label="新建数据表"
            className="rounded-md px-1.5 py-0.5 text-meta font-mono text-monokai-cyan hover:bg-monokai-cyan/10 transition-colors cursor-pointer"
          >
            + 新建
          </button>
        </div>
      </div>

      {/* Search */}
      {tables.length > 0 && (
        <div className="px-3 py-2 shrink-0 border-b border-monokai-border/40">
          <div className="flex items-center gap-1.5 rounded-md bg-monokai-bg px-2 h-7 focus-within:ring-1 focus-within:ring-monokai-accent transition-colors">
            <Search className="h-3 w-3 shrink-0 text-monokai-comment" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="过滤数据表…"
              aria-label="过滤数据表"
              className="h-full min-w-0 flex-1 border-0 bg-transparent text-xs text-monokai-fg outline-none placeholder:text-monokai-comment font-sans"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-monokai-comment hover:text-monokai-fg cursor-pointer p-0.5"
                aria-label="清除过滤"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Table List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {hasNoTables ? (
          /* Empty State: Dropzone + Demo Seeder */
          <div className="p-3 space-y-3">
            {/* Dropzone */}
            <div
              role="button"
              tabIndex={0}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={onBrowseFiles}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onBrowseFiles();
                }
              }}
              className={`flex min-h-[100px] flex-col items-center justify-center rounded-lg p-4 text-center cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent ${
                isDraggingOver
                  ? 'bg-monokai-elevated text-monokai-green ring-1 ring-monokai-border-strong'
                  : 'bg-monokai-bg/60 hover:bg-monokai-elevated text-monokai-comment shadow-xs'
              }`}
            >
              {importState.status === 'importing' ? (
                <div className="flex flex-col items-center gap-1.5">
                  <Loader2 className="h-5 w-5 text-monokai-cyan animate-spin" />
                  <span className="text-2xs font-mono text-monokai-fg">
                    解析 {importState.filename}…
                  </span>
                </div>
              ) : (
                <>
                  <UploadCloud className="h-5 w-5 mb-1.5" />
                  <span className="text-meta font-bold text-monokai-fg">
                    {isDraggingOver ? '释放文件以立即导入' : '拖入数据文件 或 点击选择'}
                  </span>
                  <span className="text-2xs text-monokai-comment mt-1 font-mono">
                    CSV · Parquet · JSON · Arrow
                  </span>
                </>
              )}
              {importState.status === 'error' && (
                <p className="mt-2 text-2xs text-monokai-pink font-mono">
                  {importState.message}
                </p>
              )}
            </div>


            {/* Demo Seeder — always expanded in empty state */}
            <div className="mt-0">
              <div className="flex items-center gap-1.5 mb-2 px-0.5">
                <Sparkles className="h-3 w-3 text-monokai-orange" />
                <span className="text-2xs font-bold text-monokai-fg">开箱即用场景数据集</span>
              </div>
              <div className="space-y-1.5">
                {/* Ecommerce */}
                <button
                  type="button"
                  onClick={() => onLoadDemoDataset('ecommerce')}
                  disabled={isSeedingDemo}
                  className="flex w-full items-center gap-2 rounded-lg bg-monokai-green/10 px-2.5 py-2 text-left text-meta hover:bg-monokai-green/15 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <ShoppingBag className="h-3.5 w-3.5 shrink-0 text-monokai-green" />
                  <div>
                    <div className="font-bold text-monokai-fg">电商全链路 (6 表)</div>
                    <div className="text-monokai-comment font-mono text-2xs">
                      orders · customers · products · 4,000+ 行
                    </div>
                  </div>
                </button>
                {/* Logs */}
                <button
                  type="button"
                  onClick={() => onLoadDemoDataset('logs')}
                  disabled={isSeedingDemo}
                  aria-label="装载日志时序数据集"
                  className="flex w-full items-center gap-2 rounded-lg bg-monokai-cyan/10 px-2.5 py-2 text-left text-meta hover:bg-monokai-cyan/15 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Activity className="h-3.5 w-3.5 shrink-0 text-monokai-cyan" />
                  <div>
                    <div className="font-bold text-monokai-fg">API 访问时序日志</div>
                    <div className="text-monokai-comment font-mono text-2xs">
                      web_access_logs · 5,000 条
                    </div>
                  </div>
                </button>
                {/* Funnel */}
                <button
                  type="button"
                  onClick={() => onLoadDemoDataset('funnel')}
                  disabled={isSeedingDemo}
                  className="flex w-full items-center gap-2 rounded-lg bg-monokai-yellow/10 px-2.5 py-2 text-left text-meta hover:bg-monokai-yellow/15 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <TrendingUp className="h-3.5 w-3.5 shrink-0 text-monokai-yellow" />
                  <div>
                    <div className="font-bold text-monokai-fg">用户转化留存漏斗</div>
                    <div className="text-monokai-comment font-mono text-2xs">
                      user_events · 2,500 条
                    </div>
                  </div>
                </button>
                {isSeedingDemo && (
                  <div className="flex items-center gap-1.5 px-2 py-1.5 text-meta text-monokai-cyan font-mono">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    正在装载数据集…
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-xs text-monokai-comment font-mono gap-1.5">
            <Search className="h-4 w-4" />
            <span>无结果："{search}"</span>
            <button
              type="button"
              onClick={() => setSearch('')}
              className="text-monokai-cyan hover:underline cursor-pointer mt-1"
            >
              清空筛选
            </button>
          </div>
        ) : (
          <div className="py-1">
            {filtered.map(tableName => {
              const isSelected = selectedTable === tableName;
              const meta = metaMap[tableName];

              return (
                <div
                  key={tableName}
                  onMouseEnter={() => {
                    setHoveredTable(tableName);
                    if (!meta) void fetchTableMeta(tableName);
                  }}
                  onMouseLeave={() => setHoveredTable(null)}
                  className={`group relative flex flex-col px-3 py-2 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-monokai-elevated border-l-2 border-l-monokai-cyan'
                      : 'hover:bg-monokai-elevated/60 border-l-2 border-l-transparent'
                  }`}
                  onClick={() => onSelectTable(tableName)}
                >
                  {/* Table Name Row */}
                  <div className="flex items-center justify-between gap-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Table2
                        className={`h-3 w-3 shrink-0 ${isSelected ? 'text-monokai-cyan' : 'text-monokai-comment group-hover:text-monokai-cyan'}`}
                      />
                      <span
                        className={`font-mono text-meta truncate ${
                          isSelected ? 'text-monokai-cyan font-bold' : 'text-monokai-fg'
                        }`}
                        title={tableName}
                      >
                        {tableName}
                      </span>
                    </div>

                    {/* Quick Peek button — always visible on selected, hover on others */}
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        onPeekTable(tableName);
                      }}
                      aria-label={`速览 ${tableName}`}
                      title="就地速览数据"
                      className={`shrink-0 flex items-center gap-0.5 font-mono text-2xs px-1.5 py-0.5 rounded-md transition-all cursor-pointer ${
                        isSelected
                          ? 'opacity-100 text-monokai-cyan bg-monokai-cyan/15'
                          : 'opacity-0 group-hover:opacity-100 text-monokai-comment hover:text-monokai-cyan'
                      }`}
                    >
                      <Eye className="h-3 w-3" />
                      <span>速览</span>
                    </button>
                  </div>

                  {/* Meta Row: row count + column count */}
                  <div className="flex items-center gap-2 mt-0.5 ml-4.5 pl-1">
                    {meta?.loading ? (
                      <Loader2 className="h-2.5 w-2.5 text-monokai-comment animate-spin" />
                    ) : (
                      <>
                        <span className="flex items-center gap-0.5 font-mono text-2xs text-monokai-comment">
                          <Hash className="h-2.5 w-2.5" />
                          {formatRowCount(meta?.rowCount ?? null)} 行
                        </span>
                        {meta?.columnCount !== null && meta?.columnCount !== undefined && (
                          <span className="flex items-center gap-0.5 font-mono text-2xs text-monokai-comment">
                            <Columns3 className="h-2.5 w-2.5" />
                            {meta.columnCount} 字段
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  {/* Hover Quick Action Bar */}
                  {(isSelected || hoveredTable === tableName) && (
                    <div
                      className="flex items-center gap-1 mt-1.5 ml-4.5 pl-1"
                      onClick={e => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => onQuickQuery(tableName)}
                        title="即席 SELECT 查询"
                        className="flex items-center gap-0.5 font-mono text-2xs text-monokai-comment hover:text-monokai-cyan transition-colors cursor-pointer"
                      >
                        <Terminal className="h-2.5 w-2.5" />
                        <span>查询</span>
                      </button>
                      <span className="text-monokai-border">·</span>
                      <button
                        type="button"
                        onClick={() => onSummarize(tableName)}
                        title="SUMMARIZE 数据画像"
                        className="flex items-center gap-0.5 font-mono text-2xs text-monokai-comment hover:text-monokai-green transition-colors cursor-pointer"
                      >
                        <BarChart3 className="h-2.5 w-2.5" />
                        <span>画像</span>
                      </button>
                      <span className="text-monokai-border">·</span>
                      <button
                        type="button"
                        onClick={() => onNavigateToData(tableName)}
                        title="完整数据网格视图"
                        className="flex items-center gap-0.5 font-mono text-2xs text-monokai-comment hover:text-monokai-orange transition-colors cursor-pointer"
                      >
                        <ArrowUpRight className="h-2.5 w-2.5" />
                        <span>数据</span>
                      </button>
                      <span className="text-monokai-border">·</span>
                      <button
                        type="button"
                        onClick={() => onCopyTableName(tableName)}
                        title="复制表名"
                        className="flex items-center gap-0.5 font-mono text-2xs text-monokai-comment hover:text-monokai-fg transition-colors cursor-pointer"
                      >
                        <Copy className="h-2.5 w-2.5" />
                      </button>
                      <span className="text-monokai-border">·</span>
                      <button
                        type="button"
                        onClick={() => onDropTable(tableName)}
                        title={`删除表 ${tableName}`}
                        aria-label={`删除表 ${tableName}`}
                        className="flex items-center gap-0.5 font-mono text-2xs text-monokai-comment hover:text-monokai-pink transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Import Dock (when tables exist) */}
      {tables.length > 0 && (
        <div
          role="button"
          tabIndex={0}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={onBrowseFiles}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onBrowseFiles();
            }
          }}
          className={`flex items-center justify-between shrink-0 px-3 py-2 border-t border-monokai-border text-meta font-mono transition-colors cursor-pointer ${
            isDraggingOver
              ? 'bg-monokai-elevated text-monokai-fg font-semibold'
              : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-elevated/50'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <UploadCloud className="h-3.5 w-3.5 text-monokai-comment shrink-0" />
            {isDraggingOver ? '释放文件立即导入…' : '拖入文件或点击导入'}
          </span>
          {importState.status === 'importing' && (
            <Loader2 className="h-3 w-3 animate-spin text-monokai-fg shrink-0" />
          )}
        </div>
      )}
    </div>
  );
};
