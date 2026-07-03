import React, { useMemo } from 'react';
import { Search, X, ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import type { QueryResult } from '../../types';
import { VirtualTable } from '../VirtualTable';

export interface SqlEditorResultTableProps {
  result: QueryResult;
  filterTerm: string;
  page: number;
  pageSize?: number;
  onFilterTermChange: (v: string) => void;
  onPageChange: (v: number) => void;
}

export const SqlEditorResultTable: React.FC<SqlEditorResultTableProps> = ({
  result,
  filterTerm,
  page,
  pageSize = 50,
  onFilterTermChange,
  onPageChange,
}) => {
  const filteredRows = useMemo(() => {
    if (!filterTerm.trim()) return result.rows;
    const lower = filterTerm.toLowerCase();
    return result.rows.filter(row =>
      result.columns.some(col => {
        const val = row[col];
        return val != null && String(val).toLowerCase().includes(lower);
      })
    );
  }, [result.rows, result.columns, filterTerm]);

  // Use virtual table for large datasets to maintain high performance
  const useVirtual = filteredRows.length > 100;

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const paginatedRows = filteredRows.slice(safePage * pageSize, (safePage + 1) * pageSize);

  return (
    <div className="flex flex-col h-full w-full bg-monokai-bg">
      {/* Filter bar */}
      <div className="sticky top-0 z-10 bg-monokai-surface border-b border-monokai-accent/50 px-3 py-1.5 flex items-center gap-2 shadow-md shrink-0">
        <Search size={12} className="text-monokai-comment shrink-0" />
        <input
          className="bg-transparent border-none outline-none text-xs text-monokai-fg placeholder-monokai-comment/50 w-32 focus:w-48 transition-all"
          placeholder="Filter results..."
          value={filterTerm}
          onChange={(e) => { onFilterTermChange(e.target.value); onPageChange(0); }}
        />
        {filterTerm && (
          <button onClick={() => onFilterTermChange('')} className="text-monokai-pink hover:text-monokai-fg">
            <X size={12} />
          </button>
        )}
        
        {useVirtual && (
          <span className="flex items-center gap-1 text-[10px] bg-monokai-green/10 border border-monokai-green/30 text-monokai-green px-1.5 py-0.5 rounded font-mono">
            <Zap size={10} /> Virtualized
          </span>
        )}

        <div className="ml-auto text-[10px] text-monokai-comment">
          {filteredRows.length === result.rows.length
            ? `${result.rows.length} rows`
            : `${filteredRows.length} / ${result.rows.length} rows`}
        </div>
      </div>

      {/* Table Area */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {useVirtual ? (
          <VirtualTable columns={result.columns} rows={filteredRows} height="100%" />
        ) : (
          <div className="overflow-auto h-full w-full custom-scrollbar">
            <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
              <thead className="bg-monokai-surface sticky top-0 z-10 shadow-md">
                <tr>
                  {result.columns.map(c => (
                    <th
                      key={c}
                      className="p-2 font-mono text-xs text-monokai-blue border-b border-r border-monokai-accent/50 last:border-r-0 select-none hover:bg-monokai-accent/20 transition-colors"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="font-mono text-xs">
                {paginatedRows.map((r, i) => (
                  <tr key={i} className="border-b border-monokai-accent/20 hover:bg-monokai-accent/30 transition-colors even:bg-white/5">
                    {result.columns.map(c => (
                      <td
                        key={c}
                        className="p-2 text-monokai-fg border-r border-monokai-accent/20 last:border-r-0 max-w-[300px] truncate"
                        title={String(r[c] ?? '')}
                      >
                        {r[c] === null
                          ? <span className="text-monokai-comment italic">NULL</span>
                          : String(r[c])}
                      </td>
                    ))}
                  </tr>
                ))}
                {paginatedRows.length === 0 && (
                  <tr>
                    <td colSpan={result.columns.length} className="p-8 text-center text-monokai-comment">
                      {filterTerm ? 'No results match your filter.' : 'No data.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!useVirtual && totalPages > 1 && (
        <div className="bg-monokai-surface border-t border-monokai-accent/50 px-3 py-1.5 flex items-center justify-center gap-2 shadow-md shrink-0">
          <button
            onClick={() => onPageChange(Math.max(0, safePage - 1))}
            disabled={safePage === 0}
            className="text-monokai-comment hover:text-monokai-fg disabled:opacity-30 px-2 py-0.5"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-[10px] font-mono text-monokai-fg">
            {safePage + 1} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(Math.min(totalPages - 1, safePage + 1))}
            disabled={safePage === totalPages - 1}
            className="text-monokai-comment hover:text-monokai-fg disabled:opacity-30 px-2 py-0.5"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

export default SqlEditorResultTable;
