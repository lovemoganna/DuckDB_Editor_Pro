import React from 'react';
import {
  Database,
  Search,
  X,
  Table2,
  Copy,
  ArrowUpRight,
  Terminal,
  BarChart3,
  Zap,
  Activity,
  UploadCloud,
  Layers,
  Eye,
  Trash2,
} from 'lucide-react';
import { EmptyStateCockpit } from './EmptyStateCockpit';
import { FileImportState } from './types';

interface DataAssetCockpitProps {
  tables: string[];
  filteredTables: string[];
  tableSearch: string;
  setTableSearch: (s: string) => void;
  catalogViewMode: 'cards' | 'matrix';
  setCatalogViewMode: (mode: 'cards' | 'matrix') => void;
  handleSelectTable: (tableName: string) => void;
  handleQuickQueryTable: (tableName: string, event?: React.MouseEvent) => void;
  handleSummarizeTable: (tableName: string, event?: React.MouseEvent) => void;
  handleGroupByTable: (tableName: string, event?: React.MouseEvent) => void;
  handleCopyTable: (tableName: string, event?: React.MouseEvent) => void;
  selectedTable?: string | null;
  onSelectTableForInspector?: (tableName: string) => void;
  onPeekTable?: (tableName: string) => void;
  onDropTable?: (tableName: string) => void;
  onOpenCreateModal: () => void;
  onBrowseFiles: () => void;
  isDraggingOver: boolean;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  importState: FileImportState;
  isSeedingDemo: boolean;
  onLoadDemoDataset: (datasetType?: 'ecommerce' | 'logs' | 'funnel') => void;
}

export const DataAssetCockpit: React.FC<DataAssetCockpitProps> = ({
  tables,
  filteredTables,
  tableSearch,
  setTableSearch,
  catalogViewMode,
  setCatalogViewMode,
  handleSelectTable,
  handleQuickQueryTable,
  handleSummarizeTable,
  handleGroupByTable,
  handleCopyTable,
  selectedTable,
  onSelectTableForInspector,
  onPeekTable,
  onDropTable,
  onOpenCreateModal,
  onBrowseFiles,
  isDraggingOver,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  importState,
  isSeedingDemo,
  onLoadDemoDataset,
}) => {
  return (
    <div className="flex flex-col rounded-md border border-monokai-border bg-monokai-surface overflow-hidden font-sans">
      {/* Catalog Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-3 border-b border-monokai-border bg-monokai-elevated">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-monokai-cyan" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-monokai-fg">
            数据资产全景透视
          </h2>
          <span className="rounded-md bg-monokai-bg border border-monokai-border px-1.5 py-0.2 font-mono text-2xs text-monokai-comment">
            共 {tables.length} 个表资产
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Filter */}
          <div className="flex items-center gap-1.5 rounded-md border border-monokai-border bg-monokai-bg px-2 h-7 focus-within:border-monokai-border-strong transition-colors w-44">
            <Search className="h-3 w-3 shrink-0 text-monokai-comment" />
            <input
              value={tableSearch}
              onChange={e => setTableSearch(e.target.value)}
              placeholder="过滤数据表…"
              className="h-full min-w-0 flex-1 border-0 bg-transparent text-xs text-monokai-fg outline-none placeholder:text-monokai-comment font-sans"
            />
            {tableSearch && (
              <button
                type="button"
                onClick={() => setTableSearch('')}
                className="text-monokai-comment hover:text-monokai-fg cursor-pointer p-0.5"
                aria-label="清除过滤"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-md border border-monokai-border bg-monokai-bg p-0.5">
            <button
              type="button"
              onClick={() => setCatalogViewMode('cards')}
              className={`px-2 py-1 text-meta font-mono rounded-md transition-colors cursor-pointer ${
                catalogViewMode === 'cards'
                  ? 'bg-monokai-surface text-monokai-cyan font-bold'
                  : 'text-monokai-comment hover:text-monokai-fg'
              }`}
              title="卡片透视模式"
            >
              卡片
            </button>
            <button
              type="button"
              onClick={() => setCatalogViewMode('matrix')}
              className={`px-2 py-1 text-meta font-mono rounded-md transition-colors cursor-pointer ${
                catalogViewMode === 'matrix'
                  ? 'bg-monokai-surface text-monokai-cyan font-bold'
                  : 'text-monokai-comment hover:text-monokai-fg'
              }`}
              title="紧凑矩阵模式"
            >
              矩阵
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenCreateModal}
            className="text-xs font-mono text-monokai-comment hover:text-monokai-cyan transition-colors cursor-pointer ml-1"
            title="新建空白表定义"
          >
            + 新建表
          </button>
        </div>
      </div>

      {/* Catalog Content */}
      <div className="p-4">
        {tables.length === 0 ? (
          /* EMPTY STATE: PROFESSIONAL DROPZONE & DEMO SEED */
          <EmptyStateCockpit
            isDraggingOver={isDraggingOver}
            importState={importState}
            isSeedingDemo={isSeedingDemo}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onBrowseFiles={onBrowseFiles}
            onLoadDemoDataset={onLoadDemoDataset}
          />
        ) : filteredTables.length === 0 ? (
          <div className="flex h-36 flex-col items-center justify-center text-xs text-monokai-comment font-mono">
            <Search className="h-5 w-5 mb-1.5 text-monokai-comment" />
            <span>未匹配到名称包含 “{tableSearch}” 的数据表</span>
            <button
              type="button"
              onClick={() => setTableSearch('')}
              className="ide-btn ide-btn-secondary mt-2"
            >
              清空搜索
            </button>
          </div>
        ) : catalogViewMode === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredTables.map(tableName => {
              const isSelected = selectedTable === tableName;

              return (
                <div
                  key={tableName}
                  onClick={() => onSelectTableForInspector?.(tableName)}
                  className={`group flex flex-col justify-between rounded-md border p-3.5 transition-all select-none cursor-pointer ${
                    isSelected
                      ? 'border-monokai-border-strong bg-monokai-elevated shadow-xs'
                      : 'border-monokai-border bg-monokai-bg hover:border-monokai-border-strong hover:bg-monokai-elevated/30'
                  }`}
                >
                  <div>
                    {/* Card Title Bar */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${isSelected ? 'border-monokai-border bg-monokai-surface text-monokai-fg' : 'border-monokai-border bg-monokai-surface text-monokai-comment group-hover:text-monokai-fg'}`}>
                          <Table2 className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <h3
                            className={`font-mono text-xs font-bold truncate transition-colors ${isSelected ? 'text-monokai-fg' : 'text-monokai-fg group-hover:text-monokai-fg'}`}
                            title={`选定 ${tableName}`}
                          >
                            {tableName}
                          </h3>
                          <span className="font-mono text-2xs text-monokai-comment">
                            {isSelected ? '当前检视中' : 'DuckDB 原生表'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      {onPeekTable && (
                        <button
                          type="button"
                          onClick={() => onPeekTable(tableName)}
                          title="就地速览数据与字段画像"
                          aria-label={`速览 ${tableName}`}
                          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-meta font-mono text-monokai-fg bg-monokai-surface border border-monokai-border hover:border-monokai-border-strong hover:bg-monokai-elevated transition-all cursor-pointer"
                        >
                          <Eye className="h-3 w-3 text-monokai-comment" />
                          <span>速览</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={e => handleCopyTable(tableName, e)}
                        title="复制表名"
                        aria-label={`复制 ${tableName}`}
                        className="rounded-md p-1 text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface transition-colors cursor-pointer"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      {onDropTable && (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            onDropTable(tableName);
                          }}
                          title={`删除表 ${tableName}`}
                          aria-label={`删除表 ${tableName}`}
                          className="rounded-md p-1 text-monokai-comment hover:text-monokai-pink hover:bg-monokai-surface transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleSelectTable(tableName)}
                        title="查看完整数据"
                        aria-label={`查看 ${tableName} 数据`}
                        className="rounded-md p-1 text-monokai-comment hover:text-monokai-cyan hover:bg-monokai-surface transition-colors cursor-pointer"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Instant Action Toolbar for Table */}
                <div className="mt-3 grid grid-cols-3 gap-1.5 border-t border-monokai-border/50 pt-2.5 font-mono text-meta">
                  <button
                    type="button"
                    onClick={e => handleQuickQueryTable(tableName, e)}
                    className="flex items-center justify-center gap-1 rounded-md border border-monokai-border/80 bg-monokai-surface py-1 text-monokai-fg hover:border-monokai-border-strong hover:bg-monokai-elevated transition-colors cursor-pointer"
                    title="载入 SELECT * FROM 表 LIMIT 100"
                  >
                    <Terminal className="h-3 w-3 text-monokai-comment" />
                    <span>即席查询</span>
                  </button>

                  <button
                    type="button"
                    onClick={e => handleSummarizeTable(tableName, e)}
                    className="flex items-center justify-center gap-1 rounded-md border border-monokai-border/80 bg-monokai-surface py-1 text-monokai-fg hover:border-monokai-border-strong hover:bg-monokai-elevated transition-colors cursor-pointer"
                    title="运行 SUMMARIZE 探查统计分布"
                  >
                    <BarChart3 className="h-3 w-3 text-monokai-comment" />
                    <span>画像探查</span>
                  </button>

                  <button
                    type="button"
                    onClick={e => handleGroupByTable(tableName, e)}
                    className="flex items-center justify-center gap-1 rounded-md border border-monokai-border/80 bg-monokai-surface py-1 text-monokai-fg hover:border-monokai-border-strong hover:bg-monokai-elevated transition-colors cursor-pointer"
                    title="生成聚合分析模板"
                  >
                    <Zap className="h-3 w-3 text-monokai-comment" />
                    <span>聚合模板</span>
                  </button>
                </div>
              </div>
            );
          })}
          </div>
        ) : (
          /* MATRIX VIEW: Ultra-compact monospace list */
          <div className="divide-y divide-monokai-border/50 border border-monokai-border rounded-md overflow-hidden">
            {filteredTables.map(tableName => {
              const isSelected = selectedTable === tableName;
              return (
                <div
                  key={tableName}
                  className={`group flex h-9 items-center justify-between px-3 text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-monokai-elevated border-l-2 border-l-monokai-cyan text-monokai-cyan font-bold'
                      : 'hover:bg-monokai-elevated text-monokai-fg'
                  }`}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (onSelectTableForInspector) {
                        onSelectTableForInspector(tableName);
                      } else {
                        handleSelectTable(tableName);
                      }
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSelectTable(tableName);
                    }}
                    className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
                  >
                    <Table2 className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-monokai-cyan' : 'text-monokai-comment group-hover:text-monokai-cyan'}`} />
                    <span className="font-mono truncate">
                      {tableName}
                    </span>
                  </div>

                <div className="flex items-center gap-2 shrink-0">
                  {onPeekTable && (
                    <button
                      type="button"
                      onClick={() => onPeekTable(tableName)}
                      aria-label={`速览 ${tableName}`}
                      className="flex items-center gap-1 font-mono text-meta text-monokai-yellow hover:underline cursor-pointer"
                    >
                      <Eye className="h-3 w-3" /> 速览
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={e => handleQuickQueryTable(tableName, e)}
                    aria-label={`查询 ${tableName}`}
                    className="flex items-center gap-1 font-mono text-meta text-monokai-cyan hover:underline cursor-pointer"
                  >
                    <Terminal className="h-3 w-3" /> SELECT
                  </button>
                  <button
                    type="button"
                    onClick={e => handleSummarizeTable(tableName, e)}
                    className="flex items-center gap-1 font-mono text-meta text-monokai-green hover:underline cursor-pointer"
                  >
                    <Activity className="h-3 w-3" /> SUMMARIZE
                  </button>
                  <button
                    type="button"
                    onClick={e => handleCopyTable(tableName, e)}
                    title="复制表名"
                    aria-label={`复制 ${tableName}`}
                    className="rounded p-1 text-monokai-comment hover:text-monokai-fg cursor-pointer"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                  {onDropTable && (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        onDropTable(tableName);
                      }}
                      title={`删除表 ${tableName}`}
                      aria-label={`删除表 ${tableName}`}
                      className="rounded p-1 text-monokai-comment hover:text-monokai-pink cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        )}
      </div>

      {/* Bottom Ingestion Dock (When tables exist) */}
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
          className={`flex items-center justify-between px-4 py-2.5 border-t border-monokai-border bg-monokai-bg/70 text-xs font-mono transition-colors cursor-pointer ${
            isDraggingOver
              ? 'bg-monokai-elevated text-monokai-fg font-semibold'
              : 'hover:bg-monokai-elevated text-monokai-comment hover:text-monokai-fg'
          }`}
        >
          <div className="flex items-center gap-2">
            <UploadCloud className="h-4 w-4 text-monokai-comment" />
            <span>
              {isDraggingOver
                ? '释放文件立即导入…'
                : '拖入新文件挂载数据表 (CSV / Parquet / JSON)'}
            </span>
          </div>
          <span className="text-2xs text-monokai-comment group-hover:text-monokai-fg">
            浏览文件 →
          </span>
        </div>
      )}
    </div>
  );
};
