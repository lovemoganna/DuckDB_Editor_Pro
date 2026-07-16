/**
 * SandboxResults — 实验台结果预览 (升级版)
 *
 * 功能升级：
 * - 增加分页、本地排序、列级快速搜索。
 * - 增加 Grid（表格）与 Profile（画像）双模式切换。
 * - 增加 CSV / JSON 导出功能。
 * - 复杂 JSON/对象类型智能单元格展开预览。
 * - 样式与配色完全融入原系统的 Monokai 主题风格。
 */

import React, { useState, useMemo } from 'react';
import {
  Table,
  AlertCircle,
  Loader2,
  Database,
  Download,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  BarChart4,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';
import { useAbstractionSandbox } from '../../hooks/useAbstractionSandbox';

export const SandboxResults: React.FC = () => {
  const { sandboxResult, sandboxError, isExecuting } = useAbstractionSandbox();

  // 本地过滤、分页与排序状态
  const [viewMode, setViewMode] = useState<'grid' | 'profile'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ colIdx: number; direction: 'ASC' | 'DESC' } | null>(null);
  const [selectedCellDetail, setSelectedCellDetail] = useState<{ columnName: string; val: any } | null>(null);

  // 获取原始数据结构
  const resultData = useMemo(() => {
    if (!sandboxResult) return null;
    const data = sandboxResult as Record<string, unknown>;
    if (data.columns && data.rows) {
      return {
        columns: data.columns as string[],
        rows: data.rows as any[][],
        executionTime: data.executionTime as number | undefined,
      };
    }
    return null;
  }, [sandboxResult]);

  // 1. 本地过滤逻辑
  const filteredRows = useMemo(() => {
    if (!resultData) return [];
    if (!searchQuery.trim()) return resultData.rows;

    const lowerQuery = searchQuery.toLowerCase();
    return resultData.rows.filter(row =>
      row.some(cell => {
        if (cell === null || cell === undefined) return false;
        return String(cell).toLowerCase().includes(lowerQuery);
      })
    );
  }, [resultData, searchQuery]);

  // 2. 本地排序逻辑
  const sortedRows = useMemo(() => {
    if (!sortConfig || !filteredRows.length) return filteredRows;

    const { colIdx, direction } = sortConfig;
    const sorted = [...filteredRows].sort((a, b) => {
      const valA = a[colIdx];
      const valB = b[colIdx];

      if (valA === null || valA === undefined) return direction === 'ASC' ? -1 : 1;
      if (valB === null || valB === undefined) return direction === 'ASC' ? 1 : -1;

      // 数值类型比较
      const numA = Number(valA);
      const numB = Number(valB);
      if (!isNaN(numA) && !isNaN(numB)) {
        return direction === 'ASC' ? numA - numB : numB - numA;
      }

      // 默认字符串比较
      const strA = String(valA);
      const strB = String(valB);
      return direction === 'ASC'
        ? strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' })
        : strB.localeCompare(strA, undefined, { numeric: true, sensitivity: 'base' });
    });

    return sorted;
  }, [filteredRows, sortConfig]);

  // 3. 分页逻辑
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, currentPage, pageSize]);

  // 4. 数据画像 Profile 统计逻辑
  const profileStats = useMemo(() => {
    if (!resultData || !resultData.rows.length) return [];
    const { columns, rows } = resultData;
    const totalRows = rows.length;

    return columns.map((colName, colIdx) => {
      let nullCount = 0;
      const uniqueValues = new Set<any>();
      let numericMin = Infinity;
      let numericMax = -Infinity;
      let isNumericColumn = true;
      let sampleType = 'UNKNOWN';

      rows.forEach(row => {
        const val = row[colIdx];
        if (val === null || val === undefined) {
          nullCount++;
        } else {
          uniqueValues.add(val);
          // 检测是否为数字
          const num = Number(val);
          if (isNaN(num)) {
            isNumericColumn = false;
          } else {
            if (num < numericMin) numericMin = num;
            if (num > numericMax) numericMax = num;
          }
          if (sampleType === 'UNKNOWN') {
            sampleType = typeof val;
          }
        }
      });

      const nullPercentage = (nullCount / totalRows) * 100;
      const validPercentage = 100 - nullPercentage;
      const uniqueCount = uniqueValues.size;

      return {
        columnName: colName,
        columnIdx: colIdx,
        sampleType: isNumericColumn && totalRows > nullCount ? 'NUMBER' : sampleType.toUpperCase(),
        nullPercentage,
        validPercentage,
        uniqueCount,
        min: numericMin !== Infinity ? numericMin : null,
        max: numericMax !== -Infinity ? numericMax : null,
      };
    });
  }, [resultData]);

  // 排序触发器
  const handleSort = (colIdx: number) => {
    setSortConfig(prev => {
      if (prev?.colIdx === colIdx) {
        if (prev.direction === 'ASC') {
          return { colIdx, direction: 'DESC' };
        }
        return null;
      }
      return { colIdx, direction: 'ASC' };
    });
    setCurrentPage(1);
  };

  // 本地导出逻辑
  const handleExport = (format: 'csv' | 'json') => {
    if (!resultData || !resultData.rows.length) return;
    const { columns, rows } = resultData;
    const filename = `sandbox_export_${Date.now()}.${format}`;
    let content = '';
    let mimeType = '';

    if (format === 'csv') {
      const headers = columns.join(',');
      const csvRows = rows.map(row =>
        row.map(cell => {
          if (cell === null || cell === undefined) return '';
          return `"${String(cell).replace(/"/g, '""')}"`;
        }).join(',')
      ).join('\n');
      content = `${headers}\n${csvRows}`;
      mimeType = 'text/csv;charset=utf-8;';
    } else {
      // 阵列转对象数组
      const objects = rows.map(row => {
        const obj: Record<string, any> = {};
        columns.forEach((col, idx) => {
          obj[col] = row[idx];
        });
        return obj;
      });
      content = JSON.stringify(objects, null, 2);
      mimeType = 'application/json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
  };

  // 渲染分页器
  const totalPages = Math.ceil(sortedRows.length / pageSize);

  if (sandboxError) {
    return (
      <div className="h-full flex items-center justify-center bg-monokai-bg">
        <div className="text-center max-w-md px-6">
          <div className="w-14 h-14 rounded-2xl bg-monokai-pink/10 border border-monokai-pink/30 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-monokai-pink" />
          </div>
          <h3 className="text-sm font-semibold text-monokai-pink mb-2">执行失败</h3>
          <p className="text-xs text-monokai-fg-muted leading-relaxed">{sandboxError}</p>
        </div>
      </div>
    );
  }

  if (isExecuting) {
    return (
      <div className="h-full flex items-center justify-center bg-monokai-bg">
        <div className="text-center">
          <Loader2 className="w-8 h-8 mx-auto mb-3 text-monokai-amethyst animate-spin" />
          <p className="text-sm text-monokai-fg-muted">执行中...</p>
        </div>
      </div>
    );
  }

  if (!resultData) {
    return (
      <div className="h-full flex items-center justify-center bg-monokai-bg">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-monokai-surface border border-monokai-border flex items-center justify-center mx-auto mb-4">
            <Table className="w-7 h-7 text-monokai-fg-muted/40" />
          </div>
          <p className="text-sm text-monokai-fg-muted mb-1">暂无执行结果</p>
          <p className="text-xs text-monokai-fg-muted/60">在编辑器输入 SQL 后按 Ctrl+Enter 执行</p>
        </div>
      </div>
    );
  }

  const { columns } = resultData;

  return (
    <div className="h-full flex flex-col bg-monokai-bg font-sans select-none">
      {/* 增强型工具栏 */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-4 py-2.5 bg-monokai-surface border-b border-monokai-border">
        {/* 左侧：模式切换 & 行数 */}
        <div className="flex items-center gap-3">
          <div className="flex bg-monokai-bg rounded-lg p-0.5 border border-monokai-border">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 flex items-center gap-1.5 text-xs font-semibold rounded-md transition-colors ${
                viewMode === 'grid'
                  ? 'bg-monokai-amethyst/20 text-monokai-amethyst'
                  : 'text-monokai-fg-muted hover:text-monokai-fg'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              表格
            </button>
            <button
              onClick={() => setViewMode('profile')}
              className={`px-3 py-1 flex items-center gap-1.5 text-xs font-semibold rounded-md transition-colors ${
                viewMode === 'profile'
                  ? 'bg-monokai-amethyst/20 text-monokai-amethyst'
                  : 'text-monokai-fg-muted hover:text-monokai-fg'
              }`}
            >
              <BarChart4 className="w-3.5 h-3.5" />
              画像
            </button>
          </div>
          <span className="text-[11px] font-mono text-monokai-fg-muted bg-monokai-bg border border-monokai-border px-2 py-1 rounded">
            {sortedRows.length !== resultData.rows.length
              ? `${sortedRows.length} / ${resultData.rows.length}`
              : resultData.rows.length}{' '}
            行 × {columns.length} 列
          </span>
        </div>

        {/* 右侧：过滤与导出 */}
        <div className="flex items-center gap-2">
          {/* 本地过滤 */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-monokai-fg-muted" />
            <input
              type="text"
              placeholder="本地快速过滤..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-8 pr-3 py-1.5 w-44 sm:w-56 text-xs bg-monokai-bg border border-monokai-border rounded-lg text-monokai-fg placeholder-monokai-fg-muted/40 focus:outline-none focus:border-monokai-amethyst transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-monokai-surface text-monokai-fg-muted"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="w-px h-5 bg-monokai-border" />

          {/* 导出按钮 */}
          <div className="flex items-center bg-monokai-bg rounded-lg border border-monokai-border overflow-hidden">
            <button
              onClick={() => handleExport('csv')}
              className="px-2.5 py-1.5 text-xs text-monokai-fg-muted hover:text-monokai-amethyst flex items-center gap-1 transition-colors"
              title="导出为 CSV"
            >
              <Download className="w-3 h-3" />
              CSV
            </button>
            <div className="w-px h-3.5 bg-monokai-border" />
            <button
              onClick={() => handleExport('json')}
              className="px-2.5 py-1.5 text-xs text-monokai-fg-muted hover:text-monokai-amethyst flex items-center gap-1 transition-colors"
              title="导出为 JSON"
            >
              JSON
            </button>
          </div>
        </div>
      </div>

      {/* 数据内容渲染区 */}
      <div className="flex-1 overflow-auto">
        {viewMode === 'grid' ? (
          /* Grid 模式 */
          <div className="min-w-full inline-block align-middle">
            <table className="w-full text-xs font-sans border-collapse">
              <thead className="sticky top-0 bg-monokai-surface z-10 shadow-[0_1px_0_0_rgba(255,255,255,0.05)]">
                <tr>
                  {columns.map((col, idx) => {
                    const isSorted = sortConfig?.colIdx === idx;
                    return (
                      <th
                        key={idx}
                        onClick={() => handleSort(idx)}
                        className="px-4 py-2.5 text-left text-xs font-semibold text-monokai-amethyst bg-monokai-surface border-b border-monokai-border cursor-pointer hover:bg-monokai-bg hover:text-monokai-yellow transition-all select-none"
                      >
                        <div className="flex items-center gap-1">
                          <span>{col}</span>
                          {isSorted ? (
                            sortConfig.direction === 'ASC' ? (
                              <ArrowUp className="w-3.5 h-3.5 text-monokai-yellow" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-monokai-yellow" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-monokai-fg-muted/30 group-hover:text-monokai-fg-muted/60" />
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-monokai-border/30">
                {paginatedRows.length > 0 ? (
                  paginatedRows.map((row, rowIdx) => (
                    <tr
                      key={rowIdx}
                      className="hover:bg-monokai-surface/40 border-b border-monokai-border/50 transition-colors"
                    >
                      {row.map((cell, cellIdx) => {
                        const isNull = cell === null || cell === undefined;
                        const isObject = !isNull && typeof cell === 'object';
                        const displayStr = isNull
                          ? 'NULL'
                          : isObject
                          ? JSON.stringify(cell)
                          : String(cell);

                        return (
                          <td
                            key={cellIdx}
                            className={`px-4 py-2 text-monokai-fg font-mono max-w-sm truncate ${
                              isNull ? 'text-monokai-fg-muted/40 italic' : ''
                            }`}
                            title={!isObject ? displayStr : undefined}
                          >
                            {isObject ? (
                              <button
                                onClick={() =>
                                  setSelectedCellDetail({
                                    columnName: columns[cellIdx],
                                    val: cell,
                                  })
                                }
                                className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-monokai-amethyst/15 text-monokai-amethyst border border-monokai-amethyst/30 hover:bg-monokai-amethyst/20 transition-all font-sans"
                              >
                                <Maximize2 className="w-2.5 h-2.5" />
                                结构化数据
                              </button>
                            ) : (
                              displayStr
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="px-4 py-8 text-center text-monokai-fg-muted/60 italic bg-monokai-bg"
                    >
                      没有匹配的数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Profile 模式 */
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 bg-monokai-bg">
            {profileStats.map((stat, idx) => {
              return (
                <div
                  key={idx}
                  className="bg-monokai-surface border border-monokai-border rounded-xl p-4 flex flex-col justify-between hover:border-monokai-amethyst/50 transition-all hover:shadow-[0_0_15px_rgba(174,129,255,0.05)] group"
                >
                  <div className="mb-3">
                    <div className="flex justify-between items-start gap-2 mb-1.5">
                      <h4 className="text-sm font-semibold font-mono text-monokai-fg truncate max-w-[70%]" title={stat.columnName}>
                        {stat.columnName}
                      </h4>
                      <span className="px-1.5 py-0.5 text-[9px] font-mono bg-monokai-bg border border-monokai-border rounded text-monokai-orange font-medium">
                        {stat.sampleType}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-monokai-bg rounded-full overflow-hidden flex">
                      <div
                        className="bg-monokai-green h-full"
                        style={{ width: `${stat.validPercentage}%` }}
                        title={`非空: ${stat.validPercentage.toFixed(1)}%`}
                      />
                      <div
                        className="bg-monokai-pink h-full"
                        style={{ width: `${stat.nullPercentage}%` }}
                        title={`空值: ${stat.nullPercentage.toFixed(1)}%`}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 text-[11px] font-mono">
                    <div className="flex justify-between text-monokai-fg-muted">
                      <span>唯一值估算:</span>
                      <span className="text-monokai-amethyst font-semibold">{stat.uniqueCount}</span>
                    </div>
                    <div className="flex justify-between text-monokai-fg-muted">
                      <span>有效行比例:</span>
                      <span className="text-monokai-green">{stat.validPercentage.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between text-monokai-fg-muted">
                      <span>空值行比例:</span>
                      <span className="text-monokai-pink">{stat.nullPercentage.toFixed(1)}%</span>
                    </div>

                    {stat.sampleType === 'NUMBER' && stat.min !== null && (
                      <div className="mt-2.5 pt-2 border-t border-monokai-border/40 space-y-1 bg-monokai-bg/30 p-1.5 rounded">
                        <div className="flex justify-between text-monokai-fg-muted">
                          <span>最小值 (Min):</span>
                          <span className="text-monokai-yellow">{stat.min}</span>
                        </div>
                        <div className="flex justify-between text-monokai-fg-muted">
                          <span>最大值 (Max):</span>
                          <span className="text-monokai-yellow">{stat.max}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Grid 模式下的分页底栏 */}
      {viewMode === 'grid' && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 bg-monokai-surface border-t border-monokai-border select-none">
          <span className="text-xs text-monokai-fg-muted">
            显示第 {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, sortedRows.length)} 行，共 {sortedRows.length} 行
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded bg-monokai-bg border border-monokai-border text-monokai-fg hover:bg-monokai-surface disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold text-monokai-fg px-2">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded bg-monokai-bg border border-monokai-border text-monokai-fg hover:bg-monokai-surface disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 结构化明细抽屉/弹窗 */}
      {selectedCellDetail && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"
            onClick={() => setSelectedCellDetail(null)}
          />
          <div className="relative bg-monokai-surface border border-monokai-border rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-[scaleIn_0.2s_ease-out]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-monokai-border bg-monokai-surface">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-monokai-amethyst" />
                <h3 className="text-sm font-semibold text-monokai-fg">
                  单元格明细: <span className="font-mono font-bold text-monokai-yellow">{selectedCellDetail.columnName}</span>
                </h3>
              </div>
              <button
                onClick={() => setSelectedCellDetail(null)}
                className="p-1 rounded-md hover:bg-monokai-bg text-monokai-fg-muted hover:text-monokai-fg transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 max-h-96 overflow-y-auto bg-monokai-bg">
              <pre className="text-xs text-monokai-fg font-mono whitespace-pre-wrap leading-relaxed">
                {JSON.stringify(selectedCellDetail.val, null, 2)}
              </pre>
            </div>
            <div className="flex items-center justify-end px-5 py-3 border-t border-monokai-border bg-monokai-surface">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(selectedCellDetail.val, null, 2));
                  setSelectedCellDetail(null);
                }}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-monokai-amethyst text-white hover:bg-monokai-amethyst/80 transition-all"
              >
                复制数据
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SandboxResults;
