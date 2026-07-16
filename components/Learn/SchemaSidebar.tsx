import React, { useState, useEffect, useCallback } from 'react';
import { duckDBService } from '../../services/duckdbService';
import { Database, X, Search, RefreshCw, ChevronDown, ChevronRight, Table, HelpCircle, Layers } from 'lucide-react';

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
      // 1. 获取所有表及其基础字段结构
      const rawSchemas = await duckDBService.getAllTablesSchema();
      
      // 2. 为每个表并行查询其实时行数 (以及检测是否是 View)
      const enrichPromises = rawSchemas.map(async (item) => {
        let rowCount: number | null = null;
        let isView = false;
        
        try {
          // 检测是否为 View
          const typeCheck = await duckDBService.query(
            `SELECT table_type FROM information_schema.tables WHERE table_schema = 'main' AND table_name = '${item.table}'`
          );
          if (typeCheck && typeCheck.length > 0 && typeCheck[0].table_type === 'VIEW') {
            isView = true;
          }

          // 获取行数
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

  // 监听数据库 Schema 变更事件
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

  // 切换表的展开状态
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

  // 过滤表和字段
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
          className="fixed inset-0 bg-black/40 z-40 transition-opacity animate-in fade-in duration-200"
          onClick={onClose}
        />
      )}

      {/* Sidebar Panel */}
      <div
        className={`fixed inset-y-0 right-0 w-80 bg-[#21222c] border-l border-monokai-accent/30 shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-monokai-accent/30 bg-[#282a36]/50 shrink-0">
          <h3 className="text-sm font-bold text-monokai-fg flex items-center gap-2">
            <Database className="w-4 h-4 text-monokai-blue animate-pulse" />
            数据库结构
            <span className="text-[10px] text-monokai-fg font-normal ml-1">
              ({tables.length} 个表/视图)
            </span>
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={loadSchema}
              disabled={loading}
              className="text-monokai-fg hover:text-monokai-blue transition-colors p-1.5 rounded hover:bg-monokai-accent/20 disabled:opacity-50"
              title="刷新结构"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-monokai-blue' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="text-monokai-fg hover:text-monokai-pink transition-colors p-1 rounded hover:bg-monokai-accent/20"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-monokai-accent/20 bg-[#21222c]/80 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-monokai-comment" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索表名或列名..."
              className="w-full bg-[#1b1c24] border border-monokai-accent/30 rounded-lg pl-8 pr-3 py-1.5 text-xs text-monokai-fg placeholder-monokai-comment/50 focus:outline-none focus:border-monokai-blue transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-monokai-comment hover:text-monokai-fg"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Schema List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          {loading && tables.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-monokai-comment py-8">
              <RefreshCw className="w-6 h-6 animate-spin mb-2 text-monokai-blue" />
              <p className="text-xs">加载结构中...</p>
            </div>
          ) : filteredTables.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-monokai-comment py-8">
              <div className="w-12 h-12 rounded-full bg-monokai-accent/10 flex items-center justify-center mb-3">
                <Database className="w-6 h-6 text-monokai-comment/40" />
              </div>
              <p className="text-xs font-medium text-monokai-fg">没有找到匹配的表或视图</p>
              <p className="text-[10px] mt-1 text-monokai-comment/60">在教程中运行 CREATE TABLE 创建新表</p>
            </div>
          ) : (
            filteredTables.map((table) => {
              const isExpanded = expandedTables.has(table.name);
              return (
                <div
                  key={table.name}
                  className="bg-[#282a36]/30 rounded-lg border border-monokai-accent/20 hover:border-monokai-blue/30 transition-all overflow-hidden"
                >
                  {/* Table Header */}
                  <div
                    onClick={() => toggleTableExpand(table.name)}
                    className="flex items-center justify-between p-2.5 cursor-pointer hover:bg-monokai-accent/10 select-none"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {table.type === 'VIEW' ? (
                        <Layers className="w-3.5 h-3.5 text-monokai-amethyst shrink-0" title="视图" />
                      ) : (
                        <Table className="w-3.5 h-3.5 text-monokai-green shrink-0" title="表" />
                      )}
                      <span className="text-xs font-mono font-bold text-monokai-fg truncate" title={table.name}>
                        {table.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[9px] bg-monokai-accent/30 text-monokai-comment px-1.5 py-0.5 rounded">
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
                    <div className="border-t border-monokai-accent/10 bg-[#1b1c24]/50 px-2.5 py-2 space-y-1">
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
