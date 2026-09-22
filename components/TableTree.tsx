import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Database,
  Hash,
  Type,
  Calendar,
  ToggleLeft,
  List,
  Box,
  FileText,
  Key,
  Search,
  X,
  Layers,
  CornerDownRight,
  Copy,
  Terminal,
  Trash2,
} from 'lucide-react';
import { useSqlEditorStore } from '../hooks/store/useSqlEditorStore';
import { ColumnInfo } from '../types';
import { toastService } from '../services/toastService';
import { duckDBService } from '../services/duckdbService';
import { useConfirmDialog } from './ui/ConfirmDialog';

interface TableTreeProps {
  tables: string[];
  onInsert: (text: string) => void;
}

const getColumnMeta = (type: string): { icon: React.ReactNode; color: string; label: string } => {
  const t = type.toUpperCase();
  if (/INT|FLOAT|DOUBLE|DECIMAL|HUGEINT|BIGINT|SMALLINT|TINYINT|UBIGINT|UINTEGER|USMALLINT|UTINYINT/.test(t)) {
    return { icon: <Hash size={9} />, color: 'text-monokai-blue bg-monokai-blue/10 border-monokai-blue/30', label: 'NUM' };
  }
  if (/CHAR|VARCHAR|TEXT|STRING/.test(t)) {
    return { icon: <Type size={9} />, color: 'text-monokai-green bg-monokai-green/10 border-monokai-green/30', label: 'TXT' };
  }
  if (/DATE|TIME|TIMESTAMP|INTERVAL/.test(t)) {
    return { icon: <Calendar size={9} />, color: 'text-monokai-yellow bg-monokai-yellow/10 border-monokai-yellow/30', label: 'DAT' };
  }
  if (/BOOL|BOOLEAN/.test(t)) {
    return { icon: <ToggleLeft size={9} />, color: 'text-monokai-amethyst bg-monokai-amethyst/10 border-monokai-amethyst/30', label: 'BOOL' };
  }
  if (/LIST|ARRAY/.test(t)) {
    return { icon: <List size={9} />, color: 'text-monokai-blue bg-monokai-blue/10 border-monokai-blue/30', label: 'LIST' };
  }
  if (/STRUCT|MAP/.test(t)) {
    return { icon: <Box size={9} />, color: 'text-monokai-pink bg-monokai-pink/10 border-monokai-pink/30', label: 'OBJ' };
  }
  if (/JSON/.test(t)) {
    return { icon: <FileText size={9} />, color: 'text-monokai-orange bg-monokai-orange/10 border-monokai-orange/30', label: 'JSON' };
  }
  if (/BLOB|BYTEA|VARBINARY/.test(t)) {
    return { icon: <FileText size={9} />, color: 'text-monokai-orange bg-monokai-orange/10 border-monokai-orange/30', label: 'BIN' };
  }
  return { icon: <FileText size={9} />, color: 'text-monokai-comment bg-monokai-comment/10 border-monokai-comment/30', label: type.slice(0, 4).toUpperCase() };
};

export const TableTree: React.FC<TableTreeProps> = ({ tables, onInsert }) => {
  const { confirm } = useConfirmDialog();
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [views, setViews] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  // Subscribe to the global schemaTree store
  const schemaTree = useSqlEditorStore(s => s.schemaTree);

  useEffect(() => {
    let active = true;
    duckDBService.getViews().then(v => {
      if (active) setViews(new Set(v));
    }).catch(() => {});

    const handleSchemaChanged = () => {
      duckDBService.getViews().then(v => {
        if (active) setViews(new Set(v));
      }).catch(() => {});
    };

    window.addEventListener('duckdb-schema-changed', handleSchemaChanged);
    return () => {
      active = false;
      window.removeEventListener('duckdb-schema-changed', handleSchemaChanged);
    };
  }, [tables]);

  // Deep filtering for table names and column names
  const filteredTables = useMemo(() => {
    if (!searchQuery.trim()) return tables;
    const q = searchQuery.toLowerCase();
    return tables.filter(t => {
      const tableMatches = t.toLowerCase().includes(q);
      const cols = schemaTree[t] || [];
      const columnMatches = cols.some(col => col.name.toLowerCase().includes(q));
      return tableMatches || columnMatches;
    });
  }, [tables, searchQuery, schemaTree]);

  // Auto-expand tables containing columns that match the search query
  useEffect(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const autoExpand = new Set<string>();
      tables.forEach(t => {
        const cols = schemaTree[t] || [];
        const columnMatches = cols.some(col => col.name.toLowerCase().includes(q));
        if (columnMatches) {
          autoExpand.add(t);
        }
      });
      if (autoExpand.size > 0) {
        setExpandedTables(prev => {
          const next = new Set(prev);
          autoExpand.forEach(t => next.add(t));
          return next;
        });
      }
    }
  }, [searchQuery, tables, schemaTree]);

  const toggleExpand = (table: string) => {
    const newSet = new Set(expandedTables);
    if (newSet.has(table)) {
      newSet.delete(table);
    } else {
      newSet.add(table);
    }
    setExpandedTables(newSet);
  };

  const totalColumns = useMemo(() => {
    return Object.values(schemaTree).reduce((sum, cols) => sum + cols.length, 0);
  }, [schemaTree]);

  return (
    <div className="flex flex-col select-none h-full bg-monokai-bg">
      {/* Header with Search */}
      <div className="p-2 border-b border-monokai-border/80 bg-monokai-surface/40 space-y-1.5 shrink-0">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-1.5">
            <Layers size={11} className="text-monokai-yellow shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-monokai-comment font-mono">
              {tables.length} {tables.length === 1 ? 'Asset' : 'Assets'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {searchQuery && (
              <span className="text-[9px] font-mono bg-monokai-yellow/15 text-monokai-yellow border border-monokai-yellow/30 px-1.5 py-0.2 rounded-xs">
                {filteredTables.length} match{filteredTables.length !== 1 ? 'es' : ''}
              </span>
            )}
            {tables.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('open-clear-workspace-modal'));
                }}
                className="p-1 rounded text-monokai-comment hover:text-monokai-pink hover:bg-monokai-pink/10 transition-colors cursor-pointer"
                title="清空工作区资源 (数据表、视图、宏、文件)"
                aria-label="清空工作区资源"
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
        </div>
        <div className="relative">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-monokai-comment pointer-events-none" />
          <input
            ref={searchRef}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜索表与字段..."
            className="w-full bg-monokai-bg border border-monokai-border/80 rounded-md pl-6 pr-6 py-1 text-[11px] font-mono text-monokai-fg placeholder-monokai-comment/50 outline-none focus:border-monokai-yellow/60 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-monokai-comment hover:text-monokai-fg p-0.5"
              title="清空搜索"
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Table list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filteredTables.length === 0 && tables.length > 0 && (
          <div className="p-6 text-center">
            <Search size={20} className="mx-auto mb-2 text-monokai-comment/30" />
            <div className="text-[10px] text-monokai-comment/60 italic font-mono">未找到与 "{searchQuery}" 匹配的内容</div>
          </div>
        )}
        {filteredTables.length === 0 && tables.length === 0 && (
          <div className="p-8 text-center space-y-2">
            <Database size={24} className="mx-auto text-monokai-comment/20" />
            <div className="text-xs text-monokai-comment italic font-mono">
              暂无数据表<br />
              <span className="text-[10px] text-monokai-comment/60">可从侧边栏导入或创建表</span>
            </div>
          </div>
        )}
        {filteredTables.map(table => (
          <TableRow
            key={table}
            table={table}
            isView={views.has(table)}
            isExpanded={expandedTables.has(table)}
            isLoading={false}
            columns={schemaTree[table]}
            searchQuery={searchQuery}
            onToggle={() => toggleExpand(table)}
            onInsert={onInsert}
          />
        ))}
      </div>

      {/* Footer stats */}
      {totalColumns > 0 && (
        <div className="p-2 border-t border-monokai-border/60 bg-monokai-surface/40 flex items-center justify-between text-[9.5px] text-monokai-comment font-mono shrink-0">
          <span>
            {filteredTables.length} 对象 · {totalColumns} 字段
          </span>
          <span className="text-monokai-comment/60">点击展开字段</span>
        </div>
      )}
    </div>
  );
};

interface TableRowProps {
  table: string;
  isView?: boolean;
  isExpanded: boolean;
  isLoading: boolean;
  columns?: ColumnInfo[];
  searchQuery: string;
  onToggle: () => void;
  onInsert: (text: string) => void;
}

const TableRow: React.FC<TableRowProps> = ({
  table,
  isView = false,
  isExpanded,
  isLoading,
  columns,
  searchQuery,
  onToggle,
  onInsert,
}) => {
  const { confirm } = useConfirmDialog();
  // Filter columns if search query matches column name
  const matchingColumns = useMemo(() => {
    if (!columns) return [];
    if (!searchQuery.trim()) return columns;
    const q = searchQuery.toLowerCase();
    return columns.filter(c => c.name.toLowerCase().includes(q));
  }, [columns, searchQuery]);

  // Show columns if either the table is expanded or if we are searching and there are matching columns
  const shouldShowColumns = isExpanded && columns && columns.length > 0;

  return (
    <div className="border-b border-monokai-border/20 last:border-b-0">
      {/* Table Header */}
      <div
        className={`group flex items-center gap-1.5 px-2 py-1.5 cursor-pointer transition-all duration-150 ${
          isExpanded ? 'bg-monokai-surface/60 border-l-2 border-monokai-yellow' : 'hover:bg-monokai-surface/40 border-l-2 border-transparent'
        }`}
        onClick={onToggle}
      >
        <span className="w-4 flex items-center justify-center shrink-0">
          {isLoading ? (
            <div className="w-2.5 h-2.5 border border-monokai-comment/30 border-t-monokai-yellow rounded-full animate-spin" />
          ) : isExpanded ? (
            <ChevronDown size={11} className="text-monokai-yellow" />
          ) : (
            <ChevronRight size={11} className="text-monokai-comment/60 group-hover:text-monokai-fg transition-colors" />
          )}
        </span>

        {isView ? (
          <Layers
            size={12}
            className={`shrink-0 transition-colors text-monokai-yellow`}
          />
        ) : (
          <Database
            size={12}
            className={`shrink-0 transition-colors ${
              isExpanded ? 'text-monokai-yellow' : 'text-monokai-comment group-hover:text-monokai-yellow'
            }`}
          />
        )}

        <span
          className={`flex-1 text-xs font-mono font-medium truncate transition-colors ${
            isExpanded ? 'text-monokai-yellow' : 'text-monokai-fg/90 group-hover:text-monokai-yellow'
          }`}
          title={table}
        >
          {searchQuery ? <HighlightMatch text={table} query={searchQuery} /> : table}
        </span>

        {isView && (
          <span className="text-[8.5px] font-mono px-1 py-0.2 bg-monokai-yellow/15 text-monokai-yellow border border-monokai-yellow/30 rounded-xs shrink-0">
            VIEW
          </span>
        )}

        {columns && (
          <span className="text-[9px] font-mono px-1.5 py-0.2 bg-monokai-surface border border-monokai-border/60 rounded-xs text-monokai-comment group-hover:text-monokai-fg shrink-0 tabular-nums">
            {columns.length}
          </span>
        )}

        {/* Hover action capsule */}
        <div className="shrink-0 opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
          <button
            className="flex items-center justify-center text-monokai-comment hover:text-monokai-fg bg-monokai-surface/80 hover:bg-monokai-surface border border-monokai-border/60 p-1 rounded-sm transition-all hover:scale-105 active:scale-95 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(table);
              toastService.success(`已复制${isView ? '视图名' : '表名'} "${table}"`);
            }}
            title={isView ? `复制视图名 "${table}"` : `复制表名 "${table}"`}
          >
            <Copy size={10} />
          </button>
          <button
            className="flex items-center justify-center text-monokai-comment hover:text-monokai-yellow bg-monokai-surface/80 hover:bg-monokai-surface border border-monokai-border/60 p-1 rounded-sm transition-all hover:scale-105 active:scale-95 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onInsert(`SELECT * FROM ${table} LIMIT 100;\n`);
              toastService.info(`已插入 SELECT * 查询: ${table}`);
            }}
            title={`生成 SELECT * 查询`}
          >
            <Terminal size={10} />
          </button>
          <button
            className="flex items-center justify-center text-monokai-comment hover:text-monokai-blue bg-monokai-surface/80 hover:bg-monokai-surface border border-monokai-border/60 p-1 rounded-sm transition-all hover:scale-105 active:scale-95 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onInsert(table);
              toastService.info(`已插入名称 "${table}"`);
            }}
            title={`插入名称 "${table}"`}
          >
            <CornerDownRight size={10} />
          </button>
          <button
            className="flex items-center justify-center text-monokai-comment hover:text-monokai-pink bg-monokai-surface/80 hover:bg-monokai-surface border border-monokai-border/60 p-1 rounded-sm transition-all hover:scale-105 active:scale-95 cursor-pointer"
            onClick={async (e) => {
              e.stopPropagation();
              const itemType = isView ? '视图' : '数据表';
              const ok = await confirm({
                title: `删除${itemType}`,
                message: `确定要删除${itemType} "${table}" 吗？此操作无法撤销。`,
                variant: 'danger',
              });
              if (!ok) return;
              try {
                if (isView) {
                  await duckDBService.dropView(table);
                } else {
                  await duckDBService.dropTable(table);
                }
                toastService.success(`${itemType} "${table}" 已删除`);
              } catch (err: any) {
                toastService.error(`删除${itemType}失败: ${err.message}`);
              }
            }}
            title={`删除${isView ? '视图' : '数据表'} "${table}"`}
          >
            <Trash2 size={10} />
          </button>
        </div>
      </div>

      {/* Columns list */}
      {shouldShowColumns && (
        <div className="bg-monokai-bg/60 border-t border-monokai-border/20 pb-0.5 relative pl-4">
          {/* Tree connector lines */}
          <div className="absolute left-[17px] top-0 bottom-3 w-[1px] bg-monokai-border/40" />

          {matchingColumns.map((col, idx) => {
            const meta = getColumnMeta(col.type);
            const isColMatch = searchQuery ? col.name.toLowerCase().includes(searchQuery.toLowerCase()) : false;

            return (
              <div
                key={col.name}
                className={`group flex items-center gap-1.5 py-1 pr-2 cursor-pointer hover:bg-monokai-surface/40 transition-colors relative pl-4 ${
                  isColMatch ? 'bg-monokai-yellow/5' : ''
                }`}
                onClick={() => {
                  onInsert(col.name);
                  toastService.info(`已插入字段 "${col.name}"`);
                }}
                title={`插入: ${col.name} (${col.type})`}
              >
                {/* Horizontal tree line connector */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3.5 h-[1px] bg-monokai-border/40" />

                <span className="w-3 flex items-center justify-center shrink-0 z-10">
                  {col.pk ? (
                    <Key size={10} className="text-monokai-yellow drop-shadow-[0_0_2px_rgba(230,219,116,0.4)]" />
                  ) : (
                    <span className="text-[8.5px] text-monokai-comment/50 font-mono select-none">{idx + 1}</span>
                  )}
                </span>

                <span
                  className={`flex-1 text-[11px] font-mono truncate pl-0.5 ${
                    col.pk ? 'text-monokai-yellow font-semibold' : isColMatch ? 'text-monokai-yellow font-medium' : 'text-monokai-fg/80 group-hover:text-monokai-fg'
                  }`}
                >
                  {searchQuery ? <HighlightMatch text={col.name} query={searchQuery} highlightClass="text-monokai-yellow bg-monokai-yellow/20 px-0.5 rounded-xs font-bold" /> : col.name}
                </span>

                {/* Color-coded semantic type tag */}
                <span
                  className={`flex items-center justify-center gap-0.5 text-[8.5px] font-bold font-mono px-1.5 py-0.2 rounded-xs shrink-0 w-11 text-center border transition-all ${meta.color}`}
                >
                  {meta.icon}
                  <span>{meta.label}</span>
                </span>

                <button
                  className="shrink-0 opacity-0 group-hover:opacity-100 text-monokai-comment hover:text-monokai-fg bg-monokai-surface border border-monokai-border/50 p-0.5 rounded-xs transition-all hover:scale-105 active:scale-95 cursor-pointer ml-0.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(col.name);
                    toastService.success(`已复制字段名 "${col.name}"`);
                  }}
                  title={`复制字段名 "${col.name}"`}
                >
                  <Copy size={10} />
                </button>
              </div>
            );
          })}

          {matchingColumns.length === 0 && columns && (
            <div className="py-2 pl-4 text-[10px] text-monokai-comment/50 italic font-mono">
              未找到匹配的字段
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const HighlightMatch: React.FC<{ text: string; query: string; highlightClass?: string }> = ({
  text,
  query,
  highlightClass = 'text-monokai-yellow bg-monokai-yellow/20 px-0.5 rounded-xs',
}) => {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className={highlightClass}>{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
};
