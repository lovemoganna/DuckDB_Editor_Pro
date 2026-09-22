import React, { useState, useMemo } from 'react';
import { Search, X, ChevronLeft, ChevronRight, Zap, FileText, ArrowUp, ArrowDown, Download, Copy, Check, ChevronDown, FileJson, Table, FileSpreadsheet } from 'lucide-react';
import type { QueryResult } from '../../types';
import { VirtualTable } from '../VirtualTable';
import { exportCsv, exportJson, exportMarkdown, exportExcel, copyAsTsv, copyAsMarkdown, copyAsHtml, downloadBlob } from '../../utils/sqlExporter';
import { toastService } from '../../services/toastService';
import { formatCellValue } from '../../utils/typeFormatter';

export interface SqlEditorResultTableProps {
  result: QueryResult;
  filterTerm: string;
  page: number;
  pageSize?: number;
  onFilterTermChange: (v: string) => void;
  onPageChange: (v: number) => void;
  onOpenExplain?: () => void;
  onExportParquet?: () => void | Promise<void>;
  onExportHtml?: () => void;
  viewSwitcher?: React.ReactNode;
}

export const SqlEditorResultTable: React.FC<SqlEditorResultTableProps> = ({
  result,
  filterTerm,
  page,
  pageSize = 50,
  onFilterTermChange,
  onPageChange,
  onOpenExplain,
  onExportParquet,
  onExportHtml,
  viewSwitcher,
}) => {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  const handleExport = (format: 'csv' | 'json' | 'markdown' | 'excel') => {
    try {
      const activeResult: QueryResult = { ...result, rows: sortedRows };
      let blob: Blob;
      let ext: string = format;
      if (format === 'csv') blob = exportCsv(activeResult);
      else if (format === 'json') blob = exportJson(activeResult);
      else if (format === 'markdown') {
        blob = new Blob([exportMarkdown(activeResult)], { type: 'text/markdown;charset=utf-8' });
        ext = 'md';
      } else {
        blob = exportExcel(activeResult);
        ext = 'xlsx';
      }
      downloadBlob(blob, `query_result_${Date.now()}.${ext}`);
      toastService.success('导出成功', `数据已成功导出为 ${format.toUpperCase()}`);
    } catch (e: any) {
      toastService.error('导出失败', e.message || String(e));
    }
    setShowExportMenu(false);
  };

  const handleCopy = (format: 'tsv' | 'markdown' | 'html') => {
    const activeResult: QueryResult = { ...result, rows: sortedRows };
    let text = '';
    if (format === 'tsv') text = copyAsTsv(activeResult);
    else if (format === 'markdown') text = copyAsMarkdown(activeResult);
    else text = copyAsHtml(activeResult);

    navigator.clipboard.writeText(text);
    setCopiedFormat(format);
    toastService.success('已复制到剪贴板', `已复制 ${activeResult.rows.length} 行 (${format.toUpperCase()})`);
    setTimeout(() => setCopiedFormat(null), 2000);
    setShowExportMenu(false);
  };

  const handleSort = (col: string) => {
    if (sortCol === col) {
      if (sortDir === 'asc') setSortDir('desc');
      else { setSortCol(null); setSortDir('asc'); }
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

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

  const sortedRows = useMemo(() => {
    if (!sortCol) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const valA = a[sortCol];
      const valB = b[sortCol];
      if (valA === valB) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDir === 'asc' ? valA - valB : valB - valA;
      }
      return sortDir === 'asc'
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [filteredRows, sortCol, sortDir]);

  // Use virtual table for large datasets to maintain high performance
  const useVirtual = sortedRows.length > 100;

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const paginatedRows = sortedRows.slice(safePage * pageSize, (safePage + 1) * pageSize);

  if (!result.columns || result.columns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 bg-monokai-bg text-center">
        <div className="w-12 h-12 rounded-2xl bg-monokai-green/10 border border-monokai-border flex items-center justify-center text-monokai-green mb-3 shadow-lg">
          <Zap className="w-6 h-6 " />
        </div>
        <h4 className="text-sm font-bold text-monokai-fg mb-1">语句执行成功</h4>
        <p className="text-xs text-monokai-comment max-w-sm mb-3">该 SQL 语句未返回表格行数据（例如 DDL/DML 操作或空集）。</p>
        <div className="flex items-center gap-3 text-[11px] font-mono text-monokai-comment bg-monokai-sidebar/60 px-3 py-1.5 rounded-lg border border-monokai-border/80">
          <span>耗时: <strong className="text-monokai-yellow">{result.executionTime ? `${result.executionTime.toFixed(1)}ms` : '即时'}</strong></span>
          <span>•</span>
          <span>影响行数: <strong className="text-monokai-green">{result.rows?.length || 0}</strong></span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-monokai-bg">
      {/* Unified Result Bar */}
      <div className="sticky top-0 z-10 bg-monokai-sidebar/95 backdrop-blur-md border-b border-monokai-border/70 px-3 h-10 flex items-center justify-between gap-2.5 shadow-xs shrink-0 select-none">
        <div className="flex items-center gap-2 min-w-0">
          {viewSwitcher}
          <div className="flex items-center gap-1.5 bg-monokai-bg/90 border border-monokai-border/60 rounded-lg px-2.5 py-1 focus-within:border-monokai-accent focus-within:ring-1 focus-within:ring-monokai-accent/30 transition-all">
            <Search size={12} className="text-monokai-comment shrink-0" />
            <input
              className="bg-transparent border-none outline-none text-xs text-monokai-fg placeholder:text-monokai-comment/50 w-28 focus:w-48 transition-all font-mono"
              placeholder="筛选结果..."
              value={filterTerm}
              onChange={(e) => { onFilterTermChange(e.target.value); onPageChange(0); }}
            />
            {filterTerm && (
              <button onClick={() => onFilterTermChange('')} className="text-monokai-comment hover:text-monokai-pink cursor-pointer p-0.5" title="清空筛选">
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* EXPORT & COPY DROPDOWN */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-monokai-fg bg-monokai-surface hover:bg-monokai-surface/80 border border-monokai-border/50 rounded-lg transition-all cursor-pointer active:scale-95 shadow-xs"
              title="导出或复制查询结果"
            >
              <Download size={13} className="text-monokai-green" />
              <span>导出 / 复制</span>
              <ChevronDown size={11} className={`text-monokai-comment transition-transform duration-200 ${showExportMenu ? 'rotate-180' : ''}`} />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-1.5 w-56 bg-monokai-sidebar/95 backdrop-blur-xl border border-monokai-border rounded-xl shadow-2xl z-50 p-2 text-xs animate-in fade-in slide-in-from-top-1 duration-150 flex flex-col gap-1.5">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-monokai-comment border-b border-monokai-border/50 font-mono flex items-center gap-1.5">
                  <Download size={11} className="text-monokai-green" />
                  <span>文件导出 (File Export)</span>
                </div>
                <div className="flex flex-col gap-0.5 bg-monokai-surface/40 rounded-lg p-1 border border-monokai-border/40">
                  <button onClick={() => handleExport('csv')} className="w-full text-left px-2 py-1.5 hover:bg-monokai-surface rounded-md text-monokai-fg flex items-center gap-2 cursor-pointer transition-colors font-medium">
                    <FileSpreadsheet size={12} className="text-monokai-green" /> CSV (.csv)
                  </button>
                  <button onClick={() => handleExport('json')} className="w-full text-left px-2 py-1.5 hover:bg-monokai-surface rounded-md text-monokai-fg flex items-center gap-2 cursor-pointer transition-colors font-medium">
                    <FileJson size={12} className="text-monokai-yellow" /> JSON (.json)
                  </button>
                  <button onClick={() => handleExport('markdown')} className="w-full text-left px-2 py-1.5 hover:bg-monokai-surface rounded-md text-monokai-fg flex items-center gap-2 cursor-pointer transition-colors font-medium">
                    <FileText size={12} className="text-monokai-cyan" /> Markdown (.md)
                  </button>
                  <button onClick={() => handleExport('excel')} className="w-full text-left px-2 py-1.5 hover:bg-monokai-surface rounded-md text-monokai-fg flex items-center gap-2 cursor-pointer transition-colors font-medium">
                    <Table size={12} className="text-monokai-green" /> Excel (.xlsx)
                  </button>
                  {onExportParquet && (
                    <button onClick={() => { setShowExportMenu(false); void onExportParquet(); }} className="w-full text-left px-2 py-1.5 hover:bg-monokai-surface rounded-md text-monokai-orange flex items-center gap-2 cursor-pointer transition-colors font-medium">
                      <Table size={12} /> Parquet (.parquet)
                    </button>
                  )}
                  {onExportHtml && (
                    <button onClick={() => { setShowExportMenu(false); onExportHtml(); }} className="w-full text-left px-2 py-1.5 hover:bg-monokai-surface rounded-md text-monokai-amethyst flex items-center gap-2 cursor-pointer transition-colors font-medium">
                      <FileText size={12} /> HTML Report (.html)
                    </button>
                  )}
                </div>

                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-monokai-comment border-b border-monokai-border/50 font-mono flex items-center gap-1.5 mt-0.5">
                  <Copy size={11} className="text-monokai-yellow" />
                  <span>剪贴板复制 (Clipboard Copy)</span>
                </div>
                <div className="flex flex-col gap-0.5 bg-monokai-surface/40 rounded-lg p-1 border border-monokai-border/40">
                  <button onClick={() => handleCopy('tsv')} className="w-full text-left px-2 py-1.5 hover:bg-monokai-surface rounded-md text-monokai-fg flex items-center justify-between cursor-pointer transition-colors font-medium">
                    <span className="flex items-center gap-2"><Copy size={12} className="text-monokai-orange" /> Copy TSV (Excel)</span>
                    {copiedFormat === 'tsv' && <Check size={12} className="text-monokai-green" />}
                  </button>
                  <button onClick={() => handleCopy('markdown')} className="w-full text-left px-2 py-1.5 hover:bg-monokai-surface rounded-md text-monokai-fg flex items-center justify-between cursor-pointer transition-colors font-medium">
                    <span className="flex items-center gap-2"><FileText size={12} className="text-monokai-cyan" /> Copy Markdown</span>
                    {copiedFormat === 'markdown' && <Check size={12} className="text-monokai-green" />}
                  </button>
                  <button onClick={() => handleCopy('html')} className="w-full text-left px-2 py-1.5 hover:bg-monokai-surface rounded-md text-monokai-fg flex items-center justify-between cursor-pointer transition-colors font-medium">
                    <span className="flex items-center gap-2"><Copy size={12} className="text-monokai-green" /> Copy HTML</span>
                    {copiedFormat === 'html' && <Check size={12} className="text-monokai-green" />}
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {useVirtual && (
            <span className="flex items-center gap-1 text-[10px] bg-monokai-green/10 text-monokai-green px-2 py-0.5 rounded-md font-mono border border-monokai-border">
              <Zap size={10} /> 虚拟滚动
            </span>
          )}

          {result.executionTime && result.executionTime > 1200 && (
            <div className="flex items-center gap-1.5 text-[10px] bg-monokai-orange/15 text-monokai-orange px-2 py-0.5 rounded-md font-mono border border-monokai-border shadow-xs">
              <Zap size={10} className="text-monokai-orange" />
              <span>慢查询 ({(result.executionTime / 1000).toFixed(2)}s)</span>
              {onOpenExplain && (
                <button
                  onClick={onOpenExplain}
                  className="underline hover:text-white font-bold cursor-pointer flex items-center gap-0.5 bg-monokai-orange/20 px-1.5 py-0.5 rounded hover:bg-monokai-orange/40 transition-colors"
                  title="查看 EXPLAIN 执行计划分析查询瓶颈"
                >
                  <FileText size={10} /> EXPLAIN
                </button>
              )}
            </div>
          )}

          {/* ROW COUNT & TIME PILL */}
          <div className="flex items-center gap-2 text-[11px] font-mono text-monokai-comment bg-monokai-surface/80 border border-monokai-border/60 px-2.5 py-0.5 rounded-md">
            <span className="text-monokai-fg font-medium tabular-nums">{filteredRows.length.toLocaleString()} 行</span>
            <span className="text-monokai-border/80">•</span>
            <span className="text-monokai-yellow font-bold tabular-nums">{result.executionTime ? `${result.executionTime.toFixed(1)}ms` : '0ms'}</span>
          </div>
        </div>
      </div>

      {/* Table view */}
      <div className="flex-1 min-h-0 relative">
        {useVirtual ? (
          <VirtualTable
            columns={result.columns}
            columnTypes={result.columnTypes}
            columnTypeMap={result.columnTypeMap}
            rows={sortedRows}
            arrowTable={result.arrowTable}
            height="100%"
            sortCol={sortCol}
            sortDir={sortDir}
            onSort={handleSort}
          />
        ) : (
          <div className="overflow-auto h-full w-full custom-scrollbar">
            <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
              <thead className="bg-[#242422] sticky top-0 z-10 shadow-[0_4px_12px_rgba(0,0,0,0.45)] border-b-2 border-monokai-border">
                <tr>
                  {result.columns.map((c, colIdx) => {
                    const colType = result.columnTypeMap?.[c] || result.columnTypes?.[colIdx];
                    return (
                      <th
                        key={c}
                        onClick={() => handleSort(c)}
                        className="px-3 py-2.5 font-mono text-xs text-monokai-fg border-r border-monokai-border select-none hover:bg-monokai-elevated transition-colors cursor-pointer"
                        title={`点击按 ${c} 排序 (类型: ${colType || 'UNKNOWN'})`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex flex-col min-w-0 leading-tight">
                            <span className="font-semibold text-monokai-fg">{c}</span>
                            {colType && (
                              <span className="text-[10px] text-monokai-comment font-normal uppercase mt-0.5">
                                {colType}
                              </span>
                            )}
                          </div>
                          {sortCol === c && (
                            sortDir === 'asc'
                              ? <ArrowUp size={11} className="text-monokai-yellow shrink-0" />
                              : <ArrowDown size={11} className="text-monokai-yellow shrink-0" />
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="font-mono text-xs">
                {paginatedRows.map((r, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-monokai-border-subtle hover:bg-monokai-surface/60 even:bg-monokai-surface/20 transition-colors"
                  >
                    {result.columns.map((c, colIdx) => {
                      const colType = result.columnTypeMap?.[c] || result.columnTypes?.[colIdx];
                      const rawVal = r[c];
                      const isNull = rawVal === null || rawVal === undefined;
                      const formattedDisplay = formatCellValue(rawVal, colType);
                      const rawStr = isNull ? '' : (typeof rawVal === 'bigint' ? rawVal.toString() : String(rawVal));

                      return (
                        <td
                          key={c}
                          onClick={() => {
                            if (!isNull) {
                              navigator.clipboard.writeText(rawStr);
                              toastService.info(`已复制原始值: "${rawStr.slice(0, 30)}${rawStr.length > 30 ? '...' : ''}"`);
                            }
                          }}
                          className="px-3 py-2 text-monokai-fg border-r border-monokai-border-subtle last:border-r-0 max-w-[300px] truncate cursor-pointer hover:bg-monokai-surface active:bg-monokai-elevated transition-colors"
                          title={isNull ? 'NULL' : `${formattedDisplay}\n(原始值: ${rawStr}，点击复制)`}
                        >
                          {isNull ? (
                            <span className="text-monokai-comment italic font-sans text-[11px]">NULL</span>
                          ) : (
                            formattedDisplay
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {paginatedRows.length === 0 && (
                  <tr>
                    <td colSpan={Math.max(1, result.columns.length)} className="p-8 text-center text-monokai-comment">
                      {filterTerm ? '未检索到匹配结果。' : '暂无数据行。'}
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
        <div className="bg-monokai-sidebar border-t border-monokai-border px-3 py-1.5 flex items-center justify-center gap-2 shadow-xs shrink-0 select-none">
          <button
            onClick={() => onPageChange(Math.max(0, safePage - 1))}
            disabled={safePage === 0}
            className="text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface rounded-lg p-1 disabled:opacity-30 cursor-pointer transition-colors"
            title="上一页"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-[10px] font-mono text-monokai-fg-muted bg-monokai-surface px-2 py-0.5 rounded-md border border-monokai-border">
            第 {safePage + 1} / {totalPages} 页
          </span>
          <button
            onClick={() => onPageChange(Math.min(totalPages - 1, safePage + 1))}
            disabled={safePage === totalPages - 1}
            className="text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface rounded-lg p-1 disabled:opacity-30 cursor-pointer transition-colors"
            title="下一页"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

export default SqlEditorResultTable;
