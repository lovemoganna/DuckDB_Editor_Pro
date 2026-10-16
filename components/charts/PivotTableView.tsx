import React, { useState, useMemo, useRef } from 'react';
import type { ChartSpec } from '../../services/analysis/types';
import { formatValueBySpec } from '../../utils/chartFormat';
import { comparePivotValues, downloadPivotCsv, pivotMatrixRows } from '../../services/analysis/pivotView';
import { filterPivotSpec } from '../../services/analysis/pivotFilter';
import { Flame, ArrowUpDown, Eye, EyeOff, Download } from 'lucide-react';

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

  // 极佳热力色阶计算：提取当前矩阵的纯数字极值
  const { minVal, maxVal } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const r of visibleRows) {
      const rowData = pivot.matrix[r] || {};
      for (const c of columns) {
        const v = rowData[c];
        if (typeof v === 'number' && Number.isFinite(v)) {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
    }
    return { minVal: min === Infinity ? 0 : min, maxVal: max === -Infinity ? 1 : max };
  }, [visibleRows, columns, pivot.matrix]);

  const getHeatmapStyle = (value: unknown): React.CSSProperties | undefined => {
    if (!heatmap || typeof value !== 'number' || !Number.isFinite(value) || maxVal <= minVal) {
      return undefined;
    }
    const ratio = Math.max(0, Math.min(1, (value - minVal) / (maxVal - minVal)));
    // Monokai 草绿色微渐变透明度（0.04 ~ 0.28），优雅不刺眼
    const alpha = (0.04 + ratio * 0.24).toFixed(3);
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

  return (
    <div className="pivot-grid flex flex-col min-h-0 h-full text-sm text-monokai-fg select-none">
      {/* 顶级设计感透视控制栏 */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 shrink-0 border-b border-monokai-border bg-monokai-surface/60 backdrop-blur-md shadow-xs">
        <div className="relative flex-1 min-w-[160px] max-w-[240px]">
          <input
            aria-label="筛选透视维度"
            value={filter}
            placeholder="查找已加载维度…"
            title="只查找已加载组合；不改变来源筛选与来源总计"
            className="w-full rounded-md bg-monokai-bg/80 border border-monokai-border px-2.5 py-1 text-2xs text-monokai-fg placeholder:text-monokai-comment focus:border-monokai-accent focus:ring-1 focus:ring-monokai-accent/30 outline-none transition-all"
            onChange={event => {
              setFilter(event.target.value);
              setRowPage(0);
              setColPage(0);
            }}
          />
        </div>

        <button
          type="button"
          onClick={() => setShowColumns(!showColumns)}
          className={`inline-flex items-center gap-1 rounded-md border border-monokai-border px-2.5 py-1 text-2xs transition-all cursor-pointer ${
            showColumns
              ? 'bg-monokai-surface text-monokai-fg hover:border-monokai-border-strong'
              : 'bg-monokai-bg/60 text-monokai-comment'
          }`}
        >
          {showColumns ? <Eye size={12} className="text-monokai-green" /> : <EyeOff size={12} />}
          {showColumns ? '隐藏列' : '显示列'}
        </button>

        <button
          type="button"
          onClick={() => {
            setSort('dimension');
            setDirection(sort === 'dimension' && direction === 'ASC' ? 'DESC' : 'ASC');
            setRowPage(0);
          }}
          className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-2xs transition-all cursor-pointer ${
            sort === 'dimension'
              ? 'border-monokai-accent/50 bg-monokai-accent/10 text-monokai-fg font-medium'
              : 'border-monokai-border bg-monokai-surface text-monokai-comment hover:text-monokai-fg'
          }`}
        >
          <ArrowUpDown size={11} className={sort === 'dimension' ? 'text-monokai-accent' : ''} />
          维度排序 {sort === 'dimension' ? (direction === 'ASC' ? '↑' : '↓') : ''}
        </button>

        <button
          type="button"
          onClick={() => {
            setSort('total');
            setDirection(sort === 'total' && direction === 'DESC' ? 'ASC' : 'DESC');
            setRowPage(0);
          }}
          className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-2xs transition-all cursor-pointer ${
            sort === 'total'
              ? 'border-monokai-orange/50 bg-monokai-orange/10 text-monokai-orange font-medium'
              : 'border-monokai-border bg-monokai-surface text-monokai-comment hover:text-monokai-fg'
          }`}
        >
          <ArrowUpDown size={11} className={sort === 'total' ? 'text-monokai-orange' : ''} />
          行汇总排序 {sort === 'total' ? (direction === 'ASC' ? '↑' : '↓') : ''}
        </button>

        {/* 智能热力图色阶切换 */}
        <button
          type="button"
          onClick={() => setHeatmap(!heatmap)}
          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-2xs transition-all cursor-pointer ${
            heatmap
              ? 'border-monokai-yellow/50 bg-monokai-yellow/15 text-monokai-yellow font-semibold shadow-[0_0_10px_rgba(230,219,116,0.2)]'
              : 'border-monokai-border bg-monokai-surface text-monokai-comment hover:text-monokai-fg'
          }`}
          title="根据交叉单元格数值自动渲染平滑热力色阶，秒级洞察数据极值与业务趋势"
        >
          <Flame size={12} className={heatmap ? 'text-monokai-yellow animate-pulse' : 'text-monokai-comment'} />
          热力色阶 {heatmap ? '开' : '关'}
        </button>

        <button
          type="button"
          disabled={disabled}
          className="inline-flex items-center gap-1 rounded-md border border-monokai-border px-2.5 py-1 text-2xs text-monokai-comment hover:text-monokai-fg hover:border-monokai-border-strong transition-colors cursor-pointer disabled:opacity-40"
          title="导出当前查找和排序下全部已加载行列，包含页外数据和标明范围的总计"
          onClick={() => downloadPivotCsv(pivotMatrixRows(pivot, rows), '透视交叉表.csv')}
        >
          <Download size={12} />
          导出 CSV
        </button>

        <span className="ml-auto text-2xs font-mono text-monokai-comment/80 tracking-tight hidden sm:inline">
          {rows.length} 行 × {pivot.colValues.length} 列 · {pivot.valKey}
        </span>
      </div>

      {/* 沉浸式数据矩阵展示区 */}
      <div className="flex-1 min-h-0 overflow-auto custom-scrollbar" onMouseLeave={() => setHoveredCell(null)}>
        <table
          ref={tableRef}
          aria-label="透视结果矩阵"
          onKeyDown={nav}
          className="border-collapse w-full text-right whitespace-nowrap tabular-nums text-sm font-sans"
        >
          <thead className="sticky top-0 z-20 bg-monokai-surface/95 backdrop-blur-md shadow-xs">
            <tr className="border-b border-monokai-border/80">
              <th className="sticky left-0 z-30 bg-monokai-surface/95 backdrop-blur-md px-3 py-2 text-left text-monokai-fg-muted font-medium tracking-tight">
                {pivot.rowKeys && pivot.rowKeys.length > 1 ? pivot.rowKeys.join(' / ') : pivot.rowKey}
              </th>
              {columns.map(column => {
                const isColHovered = hoveredCell?.col === column;
                return (
                  <th
                    key={column}
                    className={`px-3 py-2 text-monokai-fg-muted font-medium transition-colors ${
                      isColHovered ? 'text-monokai-cyan bg-monokai-cyan/10 font-bold' : ''
                    }`}
                  >
                    {pivot.colLabels?.[column] ?? column}
                  </th>
                );
              })}
              <th
                title={pivot.totalsScope ? '该行在全部符合条件来源中的汇总，含未展示列' : undefined}
                className="sticky right-0 z-30 bg-monokai-surface/95 backdrop-blur-md px-3 py-2 text-monokai-fg font-semibold shadow-[-4px_0_12px_rgba(0,0,0,0.15)]"
              >
                {pivot.totalsScope ? '来源行汇总' : '小计'}
              </th>
            </tr>
          </thead>
          <tbody>
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
                    className={`border-b border-monokai-border/30 transition-colors ${
                      isRowHovered ? 'bg-monokai-accent/[0.05]' : 'hover:bg-monokai-surface/40'
                    }`}
                  >
                    {/* 左侧固定行标签 */}
                    <td
                      className={`sticky left-0 z-10 px-3 py-1.5 text-left transition-colors ${
                        isRowHovered
                          ? 'bg-monokai-surface text-monokai-fg font-medium'
                          : 'bg-monokai-bg text-monokai-fg'
                      }`}
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
                        className="min-h-8 min-w-8 px-1 text-left inline-flex items-center gap-1.5 hover:text-monokai-accent cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-monokai-accent transition-colors"
                      >
                        <span className="font-mono text-monokai-comment text-xs font-bold w-3.5 inline-block text-center">
                          {collapsed.has(row) ? '＋' : '−'}
                        </span>
                        {parts.length > 1 ? (
                          <span className="tracking-tight">
                            <span className="text-monokai-comment text-xs font-normal">
                              {parts.slice(0, -1).join(' / ')} ›{' '}
                            </span>
                            <span className="font-medium text-monokai-fg">{parts[parts.length - 1]}</span>
                          </span>
                        ) : (
                          <span className="tracking-tight">{label}</span>
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
                          className={`px-3 py-1.5 font-mono text-xs transition-all relative ${
                            isTargetHovered
                              ? 'ring-1 ring-monokai-cyan/70 bg-monokai-cyan/15 text-monokai-fg font-bold shadow-[0_0_10px_rgba(102,217,239,0.25)] z-10'
                              : isCrosshairCol
                              ? 'bg-monokai-accent/[0.04]'
                              : ''
                          }`}
                        >
                          {collapsed.has(row) ? (
                            <span className="text-monokai-comment/60">—</span>
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
                              className="min-h-8 min-w-8 w-full h-full px-1 text-right hover:text-monokai-cyan cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-monokai-accent disabled:cursor-default"
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

                    {/* 右侧固定行汇总 */}
                    <td
                      className={`sticky right-0 z-10 px-3 py-1.5 font-mono font-semibold text-xs transition-colors shadow-[-4px_0_12px_rgba(0,0,0,0.12)] ${
                        isRowHovered
                          ? 'bg-monokai-surface text-monokai-fg'
                          : 'bg-monokai-bg text-monokai-fg'
                      }`}
                    >
                      {fmt(pivot.rowTotals[row])}
                    </td>
                  </tr>

                  {/* 父级层级小计行 (Subtotal with subtle gradient) */}
                  {isGroupEnd && parentKey && (
                    <tr className="bg-gradient-to-r from-monokai-surface/90 via-monokai-surface/60 to-monokai-surface/90 border-b border-monokai-border text-xs font-semibold text-monokai-orange/90">
                      <td className="sticky left-0 z-10 bg-monokai-surface/95 px-3 py-2 text-left italic tracking-tight">
                        小计（{parentKey}）
                      </td>
                      {columns.map(column => (
                        <td key={column} className="px-3 py-2 font-mono">
                          {fmt(pivot.subtotals![parentKey]?.[column])}
                        </td>
                      ))}
                      <td className="sticky right-0 z-10 bg-monokai-surface/95 px-3 py-2 font-mono font-bold text-monokai-fg shadow-[-4px_0_12px_rgba(0,0,0,0.12)]">
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
          <tfoot className="sticky bottom-0 z-20 bg-monokai-surface/95 backdrop-blur-md border-t-2 border-monokai-border shadow-[0_-4px_12px_rgba(0,0,0,0.2)]">
            <tr>
              <th
                title={pivot.totalsScope ? '全部符合条件的来源，不受查找或分页影响' : '当前查找数据'}
                className="sticky left-0 z-30 bg-monokai-surface/95 px-3 py-2.5 text-left text-monokai-fg font-bold tracking-tight"
              >
                {pivot.totalsScope ? '来源总计' : '查找总计'}
              </th>
              {columns.map(column => (
                <td key={column} className="px-3 py-2.5 font-mono font-bold text-monokai-fg">
                  {fmt(pivot.colTotals[column])}
                </td>
              ))}
              <td className="sticky right-0 z-30 bg-monokai-surface/95 px-3 py-2.5 font-mono font-bold text-monokai-green shadow-[-4px_0_12px_rgba(0,0,0,0.15)] text-sm">
                {pivot.grandCount ? fmt(pivot.grandTotal) : '—'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 分页控制栏 */}
      {(rows.length > 50 || (showColumns && pivot.colValues.length > 20)) && (
        <div className="flex flex-wrap items-center justify-center gap-2 px-3 py-2 border-t border-monokai-border bg-monokai-surface/30 backdrop-blur-sm text-2xs text-monokai-comment">
          <button
            disabled={page === 0}
            onClick={() => setRowPage(page - 1)}
            className="rounded px-2.5 py-1 border border-monokai-border bg-monokai-surface hover:text-monokai-fg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            上一组行
          </button>
          <span className="font-mono">
            {page + 1} / {Math.max(1, Math.ceil(rows.length / 50))}
          </span>
          <button
            disabled={(page + 1) * 50 >= rows.length}
            onClick={() => setRowPage(page + 1)}
            className="rounded px-2.5 py-1 border border-monokai-border bg-monokai-surface hover:text-monokai-fg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            下一组行
          </button>
          {showColumns && pivot.colValues.length > 20 && (
            <>
              <span className="text-monokai-border">·</span>
              <button
                disabled={columnPage === 0}
                onClick={() => setColPage(columnPage - 1)}
                className="rounded px-2.5 py-1 border border-monokai-border bg-monokai-surface hover:text-monokai-fg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                上一组列
              </button>
              <span className="font-mono">
                列 {columnPage * 20 + 1}–{Math.min((columnPage + 1) * 20, pivot.colValues.length)}
              </span>
              <button
                disabled={(columnPage + 1) * 20 >= pivot.colValues.length}
                onClick={() => setColPage(columnPage + 1)}
                className="rounded px-2.5 py-1 border border-monokai-border bg-monokai-surface hover:text-monokai-fg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
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
