import React, { useState, useMemo } from 'react';
import { Search, X, LayoutGrid, List, Terminal, Eye, Download, Trash2, Table2 } from 'lucide-react';
import { TableAssetCard } from './TableAssetCard';
import { useTableMetaMap, TableMeta } from '../../hooks/useTableMeta';

interface TableAssetGridProps {
  tables: string[];
  onPeekTable: (name: string) => void;
  onNavigateToData: (name: string) => void;
  onNavigateToSql: (name: string) => void;
  onExportTable: (name: string) => void;
  onDropTable: (name: string) => void;
}

type SortOption = 'name_asc' | 'rows_desc' | 'cols_desc' | 'size_desc' | 'null_desc';

export const TableAssetGrid: React.FC<TableAssetGridProps> = ({
  tables,
  onPeekTable,
  onNavigateToData,
  onNavigateToSql,
  onExportTable,
  onDropTable,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('name_asc');
  const [layoutMode, setLayoutMode] = useState<'cards' | 'matrix'>('cards');

  const { metaMap, loading } = useTableMetaMap(tables);

  const parseSize = (sizeStr: string | null): number => {
    if (!sizeStr) return 0;
    const val = parseFloat(sizeStr);
    if (isNaN(val)) return 0;
    if (sizeStr.includes('GB')) return val * 1024 * 1024 * 1024;
    if (sizeStr.includes('MB')) return val * 1024 * 1024;
    if (sizeStr.includes('KB')) return val * 1024;
    return val;
  };

  const filteredAndSortedTables = useMemo(() => {
    let result = tables;
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => t.toLowerCase().includes(q));
    }

    return result.sort((a, b) => {
      const metaA = metaMap.get(a);
      const metaB = metaMap.get(b);
      
      switch (sortOption) {
        case 'name_asc':
          return a.localeCompare(b);
        case 'rows_desc':
          return (metaB?.rowCount || 0) - (metaA?.rowCount || 0);
        case 'cols_desc':
          return (metaB?.columnCount || 0) - (metaA?.columnCount || 0);
        case 'size_desc':
          return parseSize(metaB?.sizeEstimate || null) - parseSize(metaA?.sizeEstimate || null);
        case 'null_desc':
          return (metaB?.nullRate || 0) - (metaA?.nullRate || 0);
        default:
          return a.localeCompare(b);
      }
    });
  }, [tables, searchQuery, sortOption, metaMap]);

  return (
    <div className="flex flex-col h-full w-full">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-2 mb-3 shrink-0">
        <div className="flex items-center gap-3">
          {/* 为搜索框与清除按钮补充 aria-label 与语义化按钮 */}
          <div className="relative flex items-center border border-monokai-border bg-monokai-surface/60 rounded-lg px-2.5 h-8 w-56 focus-within:border-monokai-border-strong focus-within:ring-1 focus-within:ring-monokai-border-strong transition-all">
            <Search className="w-3.5 h-3.5 text-monokai-comment shrink-0" />
            <input
              type="text"
              placeholder="搜索表..."
              aria-label="搜索数据表"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-xs text-monokai-fg w-full ml-2 h-full placeholder:text-monokai-comment font-sans"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="清除搜索关键字"
                onClick={() => setSearchQuery('')}
                className="flex items-center justify-center p-0.5 rounded text-monokai-comment hover:text-monokai-fg hover:bg-monokai-elevated focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-border-strong shrink-0 cursor-pointer transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center">
            {/* 为排序下拉框补充 aria-label 与 focus-visible */}
            <select
              aria-label="数据表排序方式"
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="bg-monokai-surface border border-monokai-border rounded-lg text-xs text-monokai-fg h-8 px-2.5 outline-none focus:border-monokai-border-strong focus-visible:ring-1 focus-visible:ring-monokai-border-strong cursor-pointer transition-all"
            >
              <option value="name_asc">表名 A-Z</option>
              <option value="rows_desc">行数 ↓</option>
              <option value="cols_desc">列数 ↓</option>
              <option value="size_desc">体量 ↓</option>
              <option value="null_desc">NULL率 ↓</option>
            </select>
          </div>
        </div>

        {/* 为视图切换按钮添加 aria-label 与 focus-visible */}
        <div className="flex items-center bg-monokai-surface rounded-lg border border-monokai-border p-0.5" role="group" aria-label="数据表呈现视图模式">
          <button
            type="button"
            className={`p-1.5 rounded-md transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-border-strong ${layoutMode === 'cards' ? 'bg-monokai-elevated text-monokai-fg shadow-xs font-semibold' : 'text-monokai-comment hover:text-monokai-fg'}`}
            onClick={() => setLayoutMode('cards')}
            title="卡片视图"
            aria-label="卡片视图"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            className={`p-1.5 rounded-md transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-border-strong ${layoutMode === 'matrix' ? 'bg-monokai-elevated text-monokai-fg shadow-xs font-semibold' : 'text-monokai-comment hover:text-monokai-fg'}`}
            onClick={() => setLayoutMode('matrix')}
            title="列表视图"
            aria-label="列表视图"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="overflow-auto custom-scrollbar flex-1 px-1 relative">
        {filteredAndSortedTables.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-monokai-comment select-none">
            <Search className="w-8 h-8 mb-3 opacity-40 text-monokai-comment" />
            <p className="text-sm mb-4 font-mono">未匹配到 "{searchQuery}"</p>
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="text-xs px-3.5 py-1.5 border border-monokai-border bg-monokai-surface rounded-lg hover:border-monokai-border-strong hover:text-monokai-fg transition-colors cursor-pointer shadow-xs"
              >
                清空筛选
              </button>
            )}
          </div>
        ) : (
          <>
            {layoutMode === 'cards' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3.5 pb-6">
                {filteredAndSortedTables.map(tableName => {
                  const meta = metaMap.get(tableName) || { 
                    name: tableName, 
                    rowCount: null, columnCount: null, columns: [], sizeEstimate: null, 
                    nullRate: null, highNullColumns: [], typeDistribution: {}, foreignKeys: [], loading: true 
                  };
                  return (
                    <TableAssetCard
                      key={tableName}
                      meta={meta}
                      onPeekTable={onPeekTable}
                      onNavigateToData={onNavigateToData}
                      onNavigateToSql={onNavigateToSql}
                      onExportTable={onExportTable}
                      onDropTable={onDropTable}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="w-full border border-monokai-border rounded-xl overflow-hidden bg-monokai-surface/40 shadow-md shadow-black/20">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-monokai-surface/90 text-monokai-fg-muted font-sans border-b border-monokai-border">
                    <tr>
                      <th className="py-2.5 px-3.5 font-medium">表名</th>
                      <th className="py-2.5 px-3.5 font-medium">行数</th>
                      <th className="py-2.5 px-3.5 font-medium">列数</th>
                      <th className="py-2.5 px-3.5 font-medium">体量</th>
                      <th className="py-2.5 px-3.5 font-medium">NULL 率</th>
                      <th className="py-2.5 px-3.5 font-medium text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSortedTables.map((tableName, i) => {
                      const meta = metaMap.get(tableName);
                      const isLast = i === filteredAndSortedTables.length - 1;
                      return (
                        <tr key={tableName} className={`hover:bg-monokai-elevated/40 transition-colors group ${isLast ? '' : 'border-b border-monokai-border/40'}`}>
                          <td className="py-2.5 px-3.5">
                            <button
                              type="button"
                              onClick={() => onNavigateToData(tableName)}
                              className="flex items-center gap-2 cursor-pointer group-hover:text-monokai-fg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-border-strong text-left rounded-md transition-colors"
                              aria-label={`浏览数据表 ${tableName}`}
                              title={`浏览数据表 ${tableName}`}
                            >
                              <Table2 className="w-3.5 h-3.5 text-monokai-comment group-hover:text-monokai-fg transition-colors" />
                              <span className="font-mono font-medium text-monokai-fg group-hover:text-monokai-fg transition-colors">{tableName}</span>
                            </button>
                          </td>
                          <td className="py-2.5 px-3.5 font-mono text-monokai-comment">
                            {meta?.loading ? <div className="animate-pulse bg-monokai-surface h-3 w-16 rounded"></div> : (meta?.rowCount?.toLocaleString() ?? '--')}
                          </td>
                          <td className="py-2.5 px-3.5 font-mono text-monokai-comment">
                            {meta?.loading ? <div className="animate-pulse bg-monokai-surface h-3 w-8 rounded"></div> : (meta?.columnCount ?? '--')}
                          </td>
                          <td className="py-2.5 px-3.5 font-mono text-monokai-comment">
                            {meta?.loading ? <div className="animate-pulse bg-monokai-surface h-3 w-12 rounded"></div> : (meta?.sizeEstimate ?? '--')}
                          </td>
                          <td className="py-2.5 px-3.5 font-mono text-monokai-comment">
                            {meta?.loading ? (
                              <div className="animate-pulse bg-monokai-surface h-3 w-12 rounded"></div>
                            ) : meta?.nullRate !== null && meta?.nullRate !== undefined ? (
                              <span className={meta.nullRate > 0.1 ? 'text-monokai-yellow font-semibold' : ''}>{(meta.nullRate * 100).toFixed(1)}%</span>
                            ) : '--'}
                          </td>
                          <td className="py-2.5 px-3.5">
                            <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() => onNavigateToSql(tableName)}
                                className="p-1 text-monokai-comment hover:text-monokai-fg hover:bg-monokai-elevated focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-border-strong rounded-md cursor-pointer transition-colors"
                                title="SQL 查询"
                                aria-label={`SQL 查询表 ${tableName}`}
                              >
                                <Terminal className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onPeekTable(tableName)}
                                className="p-1 text-monokai-comment hover:text-monokai-fg hover:bg-monokai-elevated focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-border-strong rounded-md cursor-pointer transition-colors"
                                title="预览数据"
                                aria-label={`预览数据表 ${tableName}`}
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onExportTable(tableName)}
                                className="p-1 text-monokai-comment hover:text-monokai-fg hover:bg-monokai-elevated focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-border-strong rounded-md cursor-pointer transition-colors"
                                title="导出"
                                aria-label={`导出数据表 ${tableName}`}
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDropTable(tableName)}
                                className="p-1 text-monokai-comment hover:text-monokai-pink hover:bg-monokai-pink/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-border-strong rounded-md cursor-pointer transition-colors"
                                title="删除"
                                aria-label={`删除数据表 ${tableName}`}
                              >
                                <Trash2 className="w-3.5 h-3.5 text-monokai-pink" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
