import React, { useState, useMemo, useRef } from 'react';
import type { ChartSpec } from '../../services/analysis/types';
import { formatValueBySpec } from '../../utils/chartFormat';
import { comparePivotValues, downloadPivotCsv, pivotMatrixRows } from '../../services/analysis/pivotView';
import { filterPivotSpec } from '../../services/analysis/pivotFilter';
import { Flame, ArrowUpDown, Eye, EyeOff, Download, Search, X } from 'lucide-react';

export function PivotTableView({
  spec,
  onBrush,
  onCell,
  disabled = false,
}: {
  spec: ChartSpec;
  onBrush?: (field: string, value: string | number) => void;
  onCell?: (row: unknown, column: unknown) => void;
  disabled?: boolean;
}) {
  const tableRef = useRef<HTMLTableElement>(null);
  const [active, setActive] = useState('0:0');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showColumns, setShowColumns] = useState(true);
  const [rowPage, setRowPage] = useState(0);
  const [colPage, setColPage] = useState(0);
  const [filter, setFilter] = useState('');
  const [heatmap, setHeatmap] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<{ row: unknown; col: string } | null>(null);

  const pivot = useMemo(() => filterPivotSpec(spec, filter).pivotTable!, [spec, filter]);
  const [sort, setSort] = useState<'dimension' | 'total'>('dimension');
  const [direction, setDirection] = useState<'ASC' | 'DESC'>('ASC');

  const rows = useMemo(
    () =>
      [...pivot.rowValues].sort(
        (a, b) =>
          (direction === 'DESC' ? -1 : 1) *
          (sort === 'total'
            ? comparePivotValues(pivot.rowTotals[a], pivot.rowTotals[b])
            : String(pivot.rowLabels?.[a] ?? a).localeCompare(String(pivot.rowLabels?.[b] ?? b), 'zh-CN', {
                numeric: true,
              }))
      ),
    [pivot, sort, direction]
  );

  const page = Math.min(rowPage, Math.max(0, Math.ceil(rows.length / 50) - 1));
  const columnPage = Math.min(colPage, Math.max(0, Math.ceil(pivot.colValues.length / 20) - 1));
  const visibleRows = rows.slice(page * 50, page * 50 + 50);
  const columns = showColumns ? pivot.colValues.slice(columnPage * 20, columnPage * 20 + 20) : [];
  const format = spec.formatByKey?.[pivot.valKey] || spec.format;
  const nullText = pivot.nullDisplay === 'zero' ? '0' : pivot.nullDisplay === 'empty' ? '（空）' : '—';
  const fmt = (value: number | string | null | undefined) =>
    value == null ? nullText : formatValueBySpec(value, format);
  const focusKey =
    Number(active.split(':')[0]) < visibleRows.length && Number(active.split(':')[1]) <= columns.length
      ? active
      : '0:0';

  // Heatmap values calculation
  const { minVal, maxVal } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const r of visibleRows) {
      const rowData = pivot.matrix[r] || {};
      for (const c of columns) {
        const raw = rowData[c];
        const v = raw == null || raw === '' ? NaN : Number(raw);
        if (typeof v === 'number' && Number.isFinite(v)) {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
    }
    return { minVal: min === Infinity ? 0 : min, maxVal: max === -Infinity ? 1 : max };
  }, [visibleRows, columns, pivot.matrix]);

  const getHeatmapStyle = (value: unknown): React.CSSProperties | undefined => {
    const numeric = value == null || value === '' ? NaN : Number(value);
    if (!heatmap || !Number.isFinite(numeric) || maxVal <= minVal) {
      return undefined;
    }
    const ratio = Math.max(0, Math.min(1, (numeric - minVal) / (maxVal - minVal)));
    // Monokai 草绿细腻渐变透明度（0.05 ~ 0.25），与斑马纹完美契合
    const alpha = (0.05 + ratio * 0.20).toFixed(3);
    return { backgroundColor: `rgba(166, 226, 46, ${alpha})` };
  };

  const nav = (event: React.KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (!target.dataset.grid) return;
    let [r, c] = target.dataset.grid.split(':').map(Number);
    const oldR = r,
      oldC = c;
    if (event.key === 'ArrowRight') c++;
    else if (event.key === 'ArrowLeft') c--;
    else if (event.key === 'ArrowDown') r++;
    else if (event.key === 'ArrowUp') r--;
    else if (event.key === 'Home') {
      c = 0;
      if (event.ctrlKey) r = 0;
    } else if (event.key === 'End') {
      c = columns.length;
      if (event.ctrlKey) r = visibleRows.length - 1;
    } else return;
    event.preventDefault();
    r = Math.max(0, Math.min(visibleRows.length - 1, r));
    c = Math.max(0, Math.min(columns.length, c));
    let next = tableRef.current?.querySelector<HTMLButtonElement>(`[data-grid="${r}:${c}"]`);
    while (next?.disabled && (c !== oldC || r !== oldR)) {
      if (c !== oldC) c += c > oldC ? 1 : -1;
      else r += r > oldR ? 1 : -1;
      if (c < 0 || c > columns.length || r < 0 || r >= visibleRows.length) break;
      next = tableRef.current?.querySelector(`[data-grid="${r}:${c}"]`);
    }
    if (next && !next.disabled) {
      setActive(next.dataset.grid!);
      next.focus();
    }
  };

  const rowDimensionName = pivot.rowKeys && pivot.rowKeys.length > 1 ? pivot.rowKeys.join(' / ') : (pivot.rowKey || '行维度');

  return (
    <div className="pivot-grid result-data-grid flex flex-col min-h-0 h-full w-full text-xs text-monokai-fg select-text bg-monokai-bg font-sans">
      {/* 沉浸式轻量辅助控制栏（对齐【数据】板块的工具栏风格） */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 shrink-0 border-b border-monokai-border/60 bg-gradient-to-b from-monokai-surface/90 via-monokai-surface/75 to-monokai-surface/60 backdrop-blur-md select-none text-2xs">
        <div className="flex items-center gap-2 flex-wrap">
          {/* 查找维度输入框 */}
          <div className="relative flex items-center w-48 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-2 text-monokai-comment/70 pointer-events-none" />
            <input
              aria-label="筛选透视维度"
              value={filter}
              placeholder="快速过滤已加载维度…"
              title="只查找已加载组合；不改变来源筛选与来源总计"
              className="w-full bg-monokai-bg/70 border border-monokai-border/80 rounded-md pl-7 pr-6 py-1 text-2xs text-monokai-fg placeholder:text-monokai-comment/65 focus:outline-none focus:border-monokai-cyan/60 focus:bg-monokai-bg focus:ring-1 focus:ring-monokai-cyan/25 font-sans transition-all"
              onChange={event => {
                setFilter(event.target.value);
                setRowPage(0);
                setColPage(0);
              }}
            />
            {filter && (
              <button
                type="button"
                onClick={() => setFilter('')}
                className="absolute right-1.5 p-0.5 text-monokai-comment hover:text-monokai-fg cursor-pointer rounded"
                title="清空筛选"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="h-4 w-px bg-monokai-border/60 shrink-0" />

          {/* 显隐列 */}
          <button
            type="button"
            onClick={() => setShowColumns(!showColumns)}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 transition-all cursor-pointer ${
              showColumns
                ? 'bg-monokai-surface/80 border-monokai-border/80 text-monokai-fg hover:border-monokai-cyan/40'
                : 'bg-monokai-bg/60 border-monokai-border/50 text-monokai-comment hover:text-monokai-fg'
            }`}
          >
            {showColumns ? <Eye size={12} className="text-monokai-green" /> : <EyeOff size={12} />}
            <span>{showColumns ? '隐藏列' : '显示列'}</span>
          </button>

          {/* 维度排序 */}
          <button
            type="button"
            onClick={() => {
              setSort('dimension');
              setDirection(sort === 'dimension' && direction === 'ASC' ? 'DESC' : 'ASC');
              setRowPage(0);
            }}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 transition-all cursor-pointer ${
              sort === 'dimension'
                ? 'border-monokai-cyan/45 bg-monokai-cyan/12 text-monokai-cyan font-semibold shadow-xs'
                : 'border-monokai-border/70 bg-monokai-bg/60 text-monokai-comment hover:text-monokai-fg'
            }`}
          >
            <ArrowUpDown size={11} className={sort === 'dimension' ? 'text-monokai-cyan' : ''} />
            <span>维度排序 {sort === 'dimension' ? (direction === 'ASC' ? '↑' : '↓') : ''}</span>
          </button>

          {/* 行汇总排序 */}
          <button
            type="button"
            onClick={() => {
              setSort('total');
              setDirection(sort === 'total' && direction === 'DESC' ? 'ASC' : 'DESC');
              setRowPage(0);
            }}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 transition-all cursor-pointer ${
              sort === 'total'
                ? 'border-monokai-yellow/45 bg-monokai-yellow/12 text-monokai-yellow font-semibold shadow-xs'
                : 'border-monokai-border/70 bg-monokai-bg/60 text-monokai-comment hover:text-monokai-fg'
            }`}
          >
            <ArrowUpDown size={11} className={sort === 'total' ? 'text-monokai-yellow' : ''} />
            <span>行汇总排序 {sort === 'total' ? (direction === 'ASC' ? '↑' : '↓') : ''}</span>
          </button>

          {/* 热力图色阶切换 */}
          <button
            type="button"
            aria-pressed={heatmap}
            onClick={() => setHeatmap(!heatmap)}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 transition-all cursor-pointer ${
              heatmap
                ? 'border-monokai-green/50 bg-monokai-green/15 text-monokai-green font-semibold shadow-xs'
                : 'border-monokai-border/70 bg-monokai-bg/60 text-monokai-comment hover:text-monokai-fg'
            }`}
            title="根据交叉单元格数值渲染热力色阶，直观对比数据大小"
          >
            <Flame size={12} className={heatmap ? 'text-monokai-green' : 'text-monokai-comment'} />
            <span>热力色阶 {heatmap ? '开' : '关'}</span>
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={disabled}
            className="inline-flex items-center gap-1 rounded-md border border-monokai-border/70 bg-monokai-bg/60 px-2 py-1 text-monokai-comment hover:text-monokai-fg hover:border-monokai-border transition-colors cursor-pointer disabled:opacity-40"
            title="导出当前查找和排序下全部已加载行列为 CSV"
            onClick={() => downloadPivotCsv(pivotMatrixRows(pivot, rows), '透视交叉表.csv')}
          >
            <Download size={12} />
            <span>导出 CSV</span>
          </button>

          <span className="text-2xs font-mono text-monokai-comment/80 tabular-nums hidden md:inline">
            {rows.length} 行 × {pivot.colValues.length} 列
          </span>
        </div>
      </div>

      {/* 数据矩阵展示区：完全撑满、原生统一滚动 */}
      <div className="flex-1 min-h-0 overflow-auto custom-scrollbar" onMouseLeave={() => setHoveredCell(null)}>
        <table
          ref={tableRef}
          aria-label="透视结果矩阵"
          onKeyDown={nav}
          className="border-collapse w-full select-text text-center font-sans text-xs"
        >
          {/* Sticky Header: 严格对齐【数据】板块的双层专业表头 */}
          <thead className="sticky top-0 z-20 select-none bg-monokai-surface/98 backdrop-blur-md">
            <tr className="h-11 border-b border-monokai-border/40">
              {/* 首列：行维度表头（吸顶 + 吸左） */}
              <th
                className="sticky left-0 z-30 min-w-[160px] max-w-[240px] px-3 py-1.5 border-r border-monokai-border/40 bg-monokai-surface/98 backdrop-blur-md text-left font-sans shadow-[1px_0_0_0_rgba(0,0,0,0.4)]"
              >
                <div className="flex flex-col items-start justify-center gap-0.5 leading-tight">
                  <span className="font-semibold text-meta tracking-tight text-monokai-fg truncate max-w-full" title={rowDimensionName}>
                    {rowDimensionName}
                  </span>
                  <span className="inline-flex items-center px-1.5 py-[1px] rounded border text-3xs font-mono tracking-wider uppercase bg-monokai-cyan/15 border-monokai-cyan/35 text-monokai-cyan">
                    行维度 · ROW
                  </span>
                </div>
              </th>

              {/* 交叉列头（列维度键） */}
              {columns.map(column => {
                const isColHovered = hoveredCell?.col === column;
                const colLabel = String(pivot.colLabels?.[column] ?? column);
                return (
                  <th
                    key={column}
                    className={`min-w-[120px] px-3 py-1.5 border-r border-monokai-border/25 text-center font-sans transition-colors duration-150 group/th cursor-pointer ${
                      isColHovered ? 'bg-monokai-cyan/10 text-monokai-cyan font-bold' : ''
                    }`}
                  >
                    <div className="flex flex-col items-center justify-center gap-0.5 min-w-0 w-full leading-tight">
                      <span
                        className={`font-medium text-meta tracking-tight transition-colors truncate max-w-full ${
                          isColHovered ? 'text-monokai-cyan font-semibold' : 'text-monokai-fg-muted/80 group-hover/th:text-monokai-fg'
                        }`}
                        title={colLabel}
                      >
                        {colLabel}
                      </span>
                      <span className="inline-flex items-center px-1.5 py-[1px] rounded border text-3xs font-mono tracking-wider uppercase bg-monokai-purple/15 border-monokai-purple/35 text-monokai-purple">
                        列维度 · COL
                      </span>
                    </div>
                  </th>
                );
              })}

              {/* 右侧小计表头（吸顶 + 吸右） */}
              <th
                title={pivot.totalsScope ? '该行在全部符合条件来源中的汇总，含未展示列' : undefined}
                className="sticky right-0 z-30 min-w-[120px] px-3 py-1.5 border-l border-monokai-border/40 bg-monokai-surface/98 backdrop-blur-md text-center font-sans shadow-[-1px_0_0_0_rgba(0,0,0,0.4)]"
              >
                <div className="flex flex-col items-center justify-center gap-0.5 min-w-0 w-full leading-tight">
                  <span className="font-semibold text-meta tracking-tight text-monokai-yellow truncate max-w-full">
                    {pivot.totalsScope ? '来源行汇总' : '小计'}
                  </span>
                  <span className="inline-flex items-center px-1.5 py-[1px] rounded border text-3xs font-mono tracking-wider uppercase bg-monokai-yellow/15 border-monokai-yellow/35 text-monokai-yellow">
                    行汇总 · TOTAL
                  </span>
                </div>
              </th>
            </tr>
          </thead>

          {/* 表格主体：对齐【数据】板块的交替斑马纹、细线边框与渐变高亮 */}
          <tbody className="divide-y divide-monokai-border/35 bg-monokai-bg text-monokai-fg font-sans text-xs">
            {visibleRows.map((row, rowIndex) => {
              const label = pivot.rowLabels?.[row] ?? row;
              const parts = String(label).split('  ›  ');
              const parentKey = pivot.rowParents?.[row];
              const nextParentKey =
                rowIndex < visibleRows.length - 1 ? pivot.rowParents?.[visibleRows[rowIndex + 1]] : undefined;
              const isGroupEnd = Boolean(parentKey && parentKey !== nextParentKey && pivot.subtotals?.[parentKey]);
              const isRowHovered = hoveredCell?.row === row;

              return (
                <React.Fragment key={row}>
                  <tr
                    className="group hover:bg-gradient-to-r hover:from-monokai-elevated/55 hover:via-monokai-elevated/40 hover:to-monokai-elevated/25 even:bg-monokai-surface/12 transition-colors duration-100"
                  >
                    {/* 左侧固定行头单元格（吸左） */}
                    <td
                      className="sticky left-0 z-10 px-3 py-2 text-left border-r border-monokai-border/60 bg-monokai-bg/95 group-hover:bg-monokai-elevated shadow-[1px_0_0_0_rgba(0,0,0,0.4)] font-sans font-medium transition-colors backdrop-blur-xs"
                    >
                      <button
                        type="button"
                        data-grid={`${rowIndex}:0`}
                        tabIndex={focusKey === `${rowIndex}:0` ? 0 : -1}
                        onFocus={() => setActive(`${rowIndex}:0`)}
                        aria-pressed={collapsed.has(row)}
                        aria-label={`${collapsed.has(row) ? '显示' : '隐藏'}行值 ${label}`}
                        onClick={() =>
                          setCollapsed(previous => {
                            const next = new Set(previous);
                            next.has(row) ? next.delete(row) : next.add(row);
                            return next;
                          })
                        }
                        className="inline-flex items-center gap-1.5 text-left text-monokai-fg hover:text-monokai-cyan cursor-pointer transition-colors max-w-full"
                      >
                        <span className="font-mono text-monokai-comment text-2xs font-bold w-3.5 h-3.5 rounded bg-monokai-surface/80 border border-monokai-border/70 inline-flex items-center justify-center shrink-0">
                          {collapsed.has(row) ? '＋' : '−'}
                        </span>
                        {parts.length > 1 ? (
                          <span className="tracking-tight truncate">
                            <span className="text-monokai-comment/80 font-normal">
                              {parts.slice(0, -1).join(' / ')} ›{' '}
                            </span>
                            <span className="font-medium text-monokai-fg">{parts[parts.length - 1]}</span>
                          </span>
                        ) : (
                          <span className="tracking-tight truncate font-medium">{String(label)}</span>
                        )}
                      </button>
                    </td>

                    {/* 交叉单元格群 */}
                    {columns.map((column, colIndex) => {
                      const val = pivot.matrix[row]?.[column];
                      const isTargetHovered = hoveredCell?.row === row && hoveredCell?.col === column;
                      const isCrosshairCol = hoveredCell?.col === column;
                      const customStyle = getHeatmapStyle(val);

                      return (
                        <td
                          key={column}
                          style={customStyle}
                          onMouseEnter={() => setHoveredCell({ row, col: column })}
                          className={`px-3 py-2 border-r border-monokai-border/35 text-center font-sans tabular-nums overflow-hidden whitespace-nowrap transition-colors duration-100 ${
                            isTargetHovered
                              ? 'bg-monokai-cyan/15 text-monokai-fg font-bold shadow-[inset_0_0_0_1px_rgba(102,217,239,0.5)]'
                              : isCrosshairCol
                              ? 'bg-monokai-accent/[0.04]'
                              : ''
                          }`}
                        >
                          {collapsed.has(row) ? (
                            <span className="text-monokai-comment/50 italic">—</span>
                          ) : (
                            <button
                              type="button"
                              data-grid={`${rowIndex}:${colIndex + 1}`}
                              tabIndex={focusKey === `${rowIndex}:${colIndex + 1}` ? 0 : -1}
                              onFocus={() => setActive(`${rowIndex}:${colIndex + 1}`)}
                              disabled={
                                disabled ||
                                !Object.hasOwn(pivot.matrix[row] || {}, column) ||
                                (!onCell && !onBrush)
                              }
                              title={
                                onCell
                                  ? 'Enter 查看对应明细；方向键移动'
                                  : onBrush
                                  ? '点击联动筛选'
                                  : '汇总值'
                              }
                              aria-label={
                                onCell
                                  ? `查看明细 ${label} / ${pivot.colLabels?.[column] ?? column}`
                                  : undefined
                              }
                              className="w-full text-center hover:text-monokai-cyan cursor-pointer focus-visible:outline focus-visible:outline-1 focus-visible:outline-monokai-cyan disabled:cursor-default"
                              onClick={() => {
                                const value = pivot.rowBindings ? pivot.rowBindings[row] : row;
                                if (onCell)
                                  onCell(value, pivot.colBindings ? pivot.colBindings[column] : column);
                                else if (value != null) onBrush?.(pivot.rowKey, String(value));
                              }}
                            >
                              {fmt(val)}
                            </button>
                          )}
                        </td>
                      );
                    })}

                    {/* 右侧固定行汇总（吸右） */}
                    <td
                      className="sticky right-0 z-10 px-3 py-2 border-l border-monokai-border/60 bg-monokai-bg/95 group-hover:bg-monokai-elevated text-center font-sans font-bold text-xs tabular-nums text-monokai-yellow/90 backdrop-blur-xs shadow-[-1px_0_0_0_rgba(0,0,0,0.4)] transition-colors"
                    >
                      {fmt(pivot.rowTotals[row])}
                    </td>
                  </tr>

                  {/* 父级层级小计行 */}
                  {isGroupEnd && parentKey && (
                    <tr className="bg-monokai-surface/60 border-b border-monokai-border text-xs font-semibold text-monokai-orange/90">
                      <td className="sticky left-0 z-10 bg-monokai-surface/95 px-3 py-2 text-left italic border-r border-monokai-border/60">
                        小计（{parentKey}）
                      </td>
                      {columns.map(column => (
                        <td key={column} className="px-3 py-2 border-r border-monokai-border/35 text-center font-sans tabular-nums">
                          {fmt(pivot.subtotals![parentKey]?.[column])}
                        </td>
                      ))}
                      <td className="sticky right-0 z-10 bg-monokai-surface/95 px-3 py-2 border-l border-monokai-border/60 text-center font-sans font-bold text-monokai-fg shadow-[-1px_0_0_0_rgba(0,0,0,0.4)]">
                        {fmt(pivot.rowSubtotals?.[parentKey])}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {!visibleRows.length && (
              <tr>
                <td className="p-8 text-center text-monokai-comment" colSpan={columns.length + 2}>
                  当前筛选无匹配数据
                </td>
              </tr>
            )}
          </tbody>

          {/* 底部列汇总行（吸底，对齐【数据】板块专业底栏） */}
          <tfoot className="sticky bottom-0 z-20 bg-monokai-surface/98 backdrop-blur-md border-t-2 border-monokai-border-strong text-center font-sans font-bold text-xs shadow-[0_-2px_8px_rgba(0,0,0,0.3)]">
            <tr className="h-10">
              <th
                title={pivot.totalsScope ? '全部符合条件的来源，不受查找或分页影响' : '当前查找数据'}
                className="sticky left-0 z-30 bg-monokai-surface/98 px-3 py-2 text-left text-monokai-fg font-bold tracking-tight border-r border-monokai-border/40 shadow-[1px_0_0_0_rgba(0,0,0,0.4)]"
              >
                {pivot.totalsScope ? '来源总计' : '列汇总'}
              </th>
              {columns.map(column => (
                <td key={column} className="px-3 py-2 font-sans font-bold text-monokai-fg border-r border-monokai-border/25 tabular-nums">
                  {fmt(pivot.colTotals[column])}
                </td>
              ))}
              <td className="sticky right-0 z-30 bg-monokai-surface/98 px-3 py-2 font-sans font-bold text-monokai-green border-l border-monokai-border/40 shadow-[-1px_0_0_0_rgba(0,0,0,0.4)] tabular-nums">
                {pivot.grandCount ? fmt(pivot.grandTotal) : '—'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 底部轻量分页栏 */}
      {(rows.length > 50 || (showColumns && pivot.colValues.length > 20)) && (
        <div className="flex flex-wrap items-center justify-center gap-2 px-3 py-1.5 border-t border-monokai-border/60 bg-monokai-surface/40 backdrop-blur-sm text-2xs text-monokai-comment shrink-0">
          <button
            disabled={page === 0}
            onClick={() => setRowPage(page - 1)}
            className="rounded px-2.5 py-1 border border-monokai-border/70 bg-monokai-surface hover:text-monokai-fg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            上一组行
          </button>
          <span className="font-mono text-meta">
            {page + 1} / {Math.max(1, Math.ceil(rows.length / 50))}
          </span>
          <button
            disabled={(page + 1) * 50 >= rows.length}
            onClick={() => setRowPage(page + 1)}
            className="rounded px-2.5 py-1 border border-monokai-border/70 bg-monokai-surface hover:text-monokai-fg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            下一组行
          </button>
          {showColumns && pivot.colValues.length > 20 && (
            <>
              <span className="text-monokai-border">·</span>
              <button
                disabled={columnPage === 0}
                onClick={() => setColPage(columnPage - 1)}
                className="rounded px-2.5 py-1 border border-monokai-border/70 bg-monokai-surface hover:text-monokai-fg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                上一组列
              </button>
              <span className="font-mono text-meta">
                列 {columnPage * 20 + 1}–{Math.min((columnPage + 1) * 20, pivot.colValues.length)}
              </span>
              <button
                disabled={(columnPage + 1) * 20 >= pivot.colValues.length}
                onClick={() => setColPage(columnPage + 1)}
                className="rounded px-2.5 py-1 border border-monokai-border/70 bg-monokai-surface hover:text-monokai-fg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                下一组列
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
