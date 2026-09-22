import React, { useState, useEffect, useCallback } from 'react';
import { duckDBService } from '../../services/duckdbService';
import { Database, X, Search, RefreshCw, ChevronDown, ChevronRight, Table, Layers } from 'lucide-react';

interface ColumnInfo {
  name: string;
  type: string;
}

interface TableSchema {
  name: string;
  type: string;
  rowCount: number | null;
  columns: ColumnInfo[];
}

interface SchemaSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SchemaSidebar: React.FC<SchemaSidebarProps> = ({ isOpen, onClose }) => {
  const [tables, setTables] = useState<TableSchema[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  // 加载 Schema 和行数信息
  const loadSchema = useCallback(async () => {
    setLoading(true);
    try {
      const rawSchemas = await duckDBService.getAllTablesSchema();
      
      const enrichPromises = rawSchemas.map(async (item) => {
        let rowCount: number | null = null;
        let isView = false;
        
        try {
          const typeCheck = await duckDBService.query(
            `SELECT table_type FROM information_schema.tables WHERE table_schema = 'main' AND table_name = '${item.table}'`
          );
          if (typeCheck && typeCheck.length > 0 && typeCheck[0].table_type === 'VIEW') {
            isView = true;
          }

          const countRes = await duckDBService.query(`SELECT COUNT(*) as cnt FROM "${item.table}"`);
          if (countRes && countRes.length > 0) {
            rowCount = Number(countRes[0].cnt);
          }
        } catch (e) {
          console.warn(`[SchemaSidebar] Failed to get row count or type for table: ${item.table}`, e);
        }

        return {
          name: item.table,
          type: isView ? 'VIEW' : 'TABLE',
          rowCount,
          columns: item.columns,
        };
      });

      const enriched = await Promise.all(enrichPromises);
      setTables(enriched);
    } catch (error) {
      console.error('[SchemaSidebar] 加载数据库结构失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadSchema();
    }
  }, [isOpen, loadSchema]);

  useEffect(() => {
    const handleSchemaChange = () => {
      if (isOpen) {
        loadSchema();
      }
    };

    window.addEventListener('duckdb-schema-changed', handleSchemaChange);
    return () => {
      window.removeEventListener('duckdb-schema-changed', handleSchemaChange);
    };
  }, [isOpen, loadSchema]);

  const toggleTableExpand = (tableName: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableName)) {
        next.delete(tableName);
      } else {
        next.add(tableName);
      }
      return next;
    });
  };

  const filteredTables = tables.filter((t) => {
    const matchesTable = t.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesColumn = t.columns.some((c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return matchesTable || matchesColumn;
  });

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity backdrop-blur-xs animate-in fade-in duration-200"
          onClick={onClose}
        />
      )}

      {/* Sidebar Panel */}
      <div
        data-learn-sidebar
        role="dialog"
        aria-modal="true"
        aria-label="教程辅助侧栏"
        className={`fixed inset-y-0 right-0 w-80 max-w-full bg-monokai-sidebar border-l border-monokai-border shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-monokai-border bg-monokai-sidebar shrink-0">
          <h3 className="text-sm font-bold text-monokai-fg flex items-center gap-2">
            <Database className="w-4 h-4 text-monokai-fg-muted" />
            <span>数据库结构</span>
            <span className="text-[10px] text-monokai-comment font-mono ml-1">
              ({tables.length} 个表/视图)
            </span>
          </h3>
          <div className="flex items-center gap-1.5">
            <button
              onClick={loadSchema}
              disabled={loading}
              className="text-monokai-comment hover:text-monokai-blue transition-colors p-1.5 rounded-md hover:bg-monokai-surface disabled:opacity-50"
              title="刷新结构"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-monokai-blue' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="text-monokai-comment hover:text-monokai-fg transition-colors p-1.5 rounded-md hover:bg-monokai-surface"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-monokai-border bg-monokai-surface/60 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-monokai-comment pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索表名或列名..."
              className="w-full bg-monokai-bg border border-monokai-border rounded-lg pl-8 pr-7 py-1.5 text-xs font-mono text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-accent transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-monokai-comment hover:text-monokai-fg cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Schema List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar bg-monokai-bg">
          {loading && tables.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-monokai-comment py-8">
              <RefreshCw className="w-6 h-6 animate-spin mb-2 text-monokai-accent" />
              <p className="text-xs font-mono">加载结构中...</p>
            </div>
          ) : filteredTables.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-monokai-comment py-8">
              <div className="w-12 h-12 rounded-full bg-monokai-surface flex items-center justify-center mb-3 border border-monokai-border">
                <Database className="w-6 h-6 text-monokai-comment/60" />
              </div>
              <p className="text-xs font-medium text-monokai-fg">没有找到匹配的表或视图</p>
            </div>
          ) : (
            filteredTables.map((table) => {
              const isExpanded = expandedTables.has(table.name);
              return (
                <div
                  key={table.name}
                  className="bg-monokai-surface rounded-lg border border-monokai-border hover:border-monokai-accent/60 transition-all overflow-hidden shadow-xs"
                >
                  <div
                    onClick={() => toggleTableExpand(table.name)}
                    className="flex items-center justify-between p-2.5 cursor-pointer hover:bg-monokai-bg/50 select-none transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {table.type === 'VIEW' ? (
                        <Layers className="w-3.5 h-3.5 text-monokai-amethyst shrink-0" aria-label="视图" />
                      ) : (
                        <Table className="w-3.5 h-3.5 text-monokai-green shrink-0" aria-label="表" />
                      )}
                      <span className="text-xs font-mono font-bold text-monokai-fg truncate group-hover:text-monokai-yellow" title={table.name}>
                        {table.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[9px] font-mono bg-monokai-bg text-monokai-comment border border-monokai-border/60 px-1.5 py-0.2 rounded">
                        {table.rowCount !== null ? `${table.rowCount} 行` : '?? 行'}
                      </span>
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-monokai-comment" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-monokai-comment" />
                      )}
                    </div>
                  </div>

                  {/* Columns Detail */}
                  {isExpanded && (
                    <div className="border-t border-monokai-border bg-monokai-bg/60 px-2.5 py-2 space-y-1">
                      {table.columns.map((col) => (
                        <div key={col.name} className="flex items-center justify-between text-[11px] font-mono py-0.5">
                          <span className="text-monokai-fg truncate pr-2" title={col.name}>
                            {col.name}
                          </span>
                          <span className="text-monokai-orange shrink-0 text-[10px]">
                            {col.type.toLowerCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};

export default SchemaSidebar;
