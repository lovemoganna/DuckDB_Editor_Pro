/**
 * Chart display derivations — engine-side only.
 * Charts consume ChartSpec; never recompute % / totals / compare baselines / bins in UI.
 */

import type {
  AnalysisSpec,
  ChartSpec,
  ChartTypeId,
  MissingValuePolicy,
  StackMode,
  ValueFormatSpec,
} from './types';
import { chartNumber, formatValueBySpec, formatPercentValue, inferChartUnit, isIdentifierColumn } from '../../utils/chartFormat';

export function resolveStackMode(visual: AnalysisSpec['visual']): StackMode {
  if (visual.stackMode) return visual.stackMode;
  if (visual.stacked) return 'stack';
  return 'none';
}

export function resolveMissingValue(visual: AnalysisSpec['visual']): MissingValuePolicy {
  return visual.missingValue || 'break';
}

export function buildFormatSpec(
  unitHint: string | undefined,
  visual: AnalysisSpec['visual'],
  yKey?: string,
): ValueFormatSpec {
  const perKey = yKey && visual.formatByKey?.[yKey];
  const base = visual.format || {};
  const unit =
    perKey?.unit ??
    base.unit ??
    unitHint ??
    (yKey ? inferChartUnit(yKey) : undefined) ??
    inferChartUnit(visual.title || '');
  const percent =
    perKey?.percent ??
    base.percent ??
    (unit === '%' || resolveStackMode(visual) === 'percent');
  return {
    compact: true,
    compactThreshold: 10000,
    thousandSeparator: true,
    decimals: percent ? 1 : 2,
    ...base,
    ...perKey,
    unit: percent ? '%' : unit,
    percent,
  };
}

export function toNumber(v: unknown): number | null {
  return chartNumber(v);
}

/** Normalize DuckDB date/time values for categorical axes and linked filters. */
export function chartDimensionValue(value: unknown, column: string): string {
  if (value == null) return '—';
  if (/date|time|_(?:at|on)(?:_|$)|period|日期|时间/i.test(column)) {
    const displayDate = (date: Date) => {
      const iso = date.toISOString();
      return /(?:^|_)(?:day|week|month|quarter|year)(?:_|$)/i.test(column) || iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso;
    };
    const numeric = typeof value === 'number' || typeof value === 'bigint'
      ? Number(value)
      : typeof value === 'string' && /^-?\d{12,14}$/.test(value) ? Number(value) : null;
    if (numeric !== null && Number.isFinite(numeric) && Math.abs(numeric) >= 1e11 && Math.abs(numeric) < 1e15) {
      const date = new Date(numeric);
      if (!Number.isNaN(date.getTime())) return displayDate(date);
    }
    if (value instanceof Date && !Number.isNaN(value.getTime())) return displayDate(value);
  }
  return String(value);
}

/** Detect empty / all-null measure columns for clear empty states. */
export function detectEmptyState(
  rows: Record<string, unknown>[],
  yKeys: string[],
): Pick<ChartSpec, 'emptyState' | 'emptyMessage'> {
  if (!rows.length) {
    return { emptyState: 'empty', emptyMessage: '当前筛选无数据' };
  }
  if (!yKeys.length) return { emptyState: 'ok' };
  const allNull = yKeys.every((k) => rows.every((r) => toNumber(r[k]) === null));
  if (allNull) {
    return { emptyState: 'all_null', emptyMessage: '指标值全部为空，无法绘图' };
  }
  return { emptyState: 'ok' };
}

export function scanSignedDomain(
  rows: Record<string, unknown>[],
  yKeys: string[],
): { hasNegative: boolean; includeZero: boolean } {
  let hasNegative = false;
  let hasPositive = false;
  for (const r of rows) {
    for (const k of yKeys) {
      const n = toNumber(r[k]);
      if (n === null) continue;
      if (n < 0) hasNegative = true;
      if (n > 0) hasPositive = true;
    }
  }
  return { hasNegative, includeZero: hasNegative || hasPositive };
}

/**
 * Sort rows by time-like xKey ascending (real chronology, not string order).
 */
export function sortRowsByTimeAxis(
  rows: Record<string, unknown>[],
  xKey: string,
  isTimeDim: boolean,
): { rows: Record<string, unknown>[]; timeSorted: boolean } {
  if (!isTimeDim || !xKey || rows.length < 2) {
    return { rows, timeSorted: false };
  }
  const sorted = [...rows].sort((a, b) => {
    const ta = Date.parse(String(a[xKey]));
    const tb = Date.parse(String(b[xKey]));
    if (Number.isFinite(ta) && Number.isFinite(tb)) return ta - tb;
    const na = Number(a[xKey]);
    const nb = Number(b[xKey]);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return String(a[xKey]).localeCompare(String(b[xKey]), 'zh-CN');
  });
  return { rows: sorted, timeSorted: true };
}

export function orderCategoryRows(
  rows: Record<string, unknown>[],
  xKey: string,
  valueKey: string,
  sort: 'none' | 'label_asc' | 'label_desc' | 'value_asc' | 'value_desc' = 'none',
  topN?: number,
  aggregation: 'none' | 'count' | 'sum' | 'avg' | 'min' | 'max' = 'none',
): Record<string, unknown>[] {
  if (!rows.length || !xKey || (sort === 'none' && !topN)) return rows;
  const buckets = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const key = String(row[xKey] ?? '—');
    const bucket = buckets.get(key);
    if (bucket) bucket.push(row); else buckets.set(key, [row]);
  }
  const scores = new Map([...buckets].map(([key, bucket]) => [key, aggregateChartValues(bucket, valueKey, aggregation === 'none' ? 'sum' : aggregation)]));
  const keys = [...scores.keys()];
  if (sort.startsWith('value') || (topN && sort === 'none')) {
    const direction = sort === 'value_asc' ? 1 : -1;
    keys.sort((a, b) => {
      const av = scores.get(a), bv = scores.get(b);
      if (av == null) return bv == null ? a.localeCompare(b, 'zh-CN') : 1;
      if (bv == null) return -1;
      return direction * (av - bv) || a.localeCompare(b, 'zh-CN');
    });
  } else if (sort.startsWith('label')) {
    keys.sort((a, b) => (sort === 'label_desc' ? -1 : 1) * a.localeCompare(b, 'zh-CN'));
  }
  const selected = new Set(keys.slice(0, topN && topN > 0 ? Math.floor(topN) : undefined));
  const rank = new Map(keys.map((key, i) => [key, i]));
  return rows.filter((row) => selected.has(String(row[xKey] ?? '—')))
    .sort((a, b) => (rank.get(String(a[xKey] ?? '—')) || 0) - (rank.get(String(b[xKey] ?? '—')) || 0));
}

/** Display count means COUNT(*); pivot count retains its explicit COUNT(field) contract. */
export function aggregateChartValues(
  rows: Record<string, unknown>[], key: string, aggregation: 'count' | 'sum' | 'avg' | 'min' | 'max',
): number | null {
  if (aggregation === 'count') return rows.length;
  const values = rows.map(row => toNumber(row[key])).filter((value): value is number => value !== null);
  if (!values.length) return null;
  if (aggregation === 'min') return values.reduce((a, b) => Math.min(a, b), Infinity);
  if (aggregation === 'max') return values.reduce((a, b) => Math.max(a, b), -Infinity);
  const sum = values.reduce((a, b) => a + b, 0);
  return aggregation === 'avg' ? sum / values.length : sum;
}

/**
 * Apply missing-value policy to a series array (for Chart.js datasets).
 */
export function applyMissingValuePolicy(
  values: Array<number | null>,
  policy: MissingValuePolicy,
): Array<number | null> {
  if (policy === 'zero') {
    return values.map((v) => (v === null ? 0 : v));
  }
  if (policy === 'forward_fill') {
    let last: number | null = null;
    return values.map((v) => {
      if (v === null) return last;
      last = v;
      return v;
    });
  }
  return values;
}

/** Prepare category and series values once, after filtering and ordering. */
export function computeCartesianSeries(
  rows: Record<string, unknown>[],
  xKey: string,
  yKeys: string[],
  rightKeys: string[],
  groupKey: string | undefined,
  stackMode: StackMode,
  missing: MissingValuePolicy,
  aggregation: 'none' | 'count' | 'sum' | 'avg' | 'min' | 'max' = 'none',
  labelKey?: string,
): NonNullable<ChartSpec['cartesian']> {
  const rowLabels = rows.map((r, i) => xKey ? chartDimensionValue(r[xKey], xKey) : String(i + 1));
  const uniqueLabels = [...new Set(rowLabels)];
  const groups = groupKey ? [...new Set(rows.map((r) => String(r[groupKey] ?? '—')))] : [];
  const buckets = new Map<string, Record<string, unknown>[]>();
  rows.forEach((row, i) => {
    const key = JSON.stringify([rowLabels[i], groupKey ? String(row[groupKey] ?? '—') : null]);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(row); else buckets.set(key, [row]);
  });
  // An unaggregated chart must retain every record, including repeated categories.
  // For grouped series, align the nth record in each group on the same category slot.
  const slots = aggregation === 'none' && !groupKey
    ? rowLabels.map((label, rowIndex) => ({ label, rowIndex, occurrence: 0 }))
    : uniqueLabels.flatMap((label) => {
        const count = aggregation === 'none'
          ? groups.reduce((maximum, group) => Math.max(maximum, buckets.get(JSON.stringify([label, group]))?.length ?? 0), 0)
          : 1;
        return Array.from({ length: count }, (_, occurrence) => ({ label, rowIndex: -1, occurrence }));
      });
  const labels = slots.map((slot) => slot.label);
  const labelMap = new Map<string, string>();
  if (labelKey) rows.forEach((row, index) => { if (!labelMap.has(rowLabels[index])) labelMap.set(rowLabels[index], String(row[labelKey] ?? rowLabels[index])); });
  const displayLabels = labelKey ? slots.map(slot => slot.rowIndex >= 0 ? String(rows[slot.rowIndex][labelKey] ?? slot.label) : labelMap.get(slot.label) || slot.label) : undefined;
  const seriesDefs = groupKey && yKeys.length
    ? [
        ...yKeys.flatMap((measure) => groups.map((group) => ({
          key: yKeys.length === 1 ? group : `${measure} · ${group}`, measure, group, axis: 'y' as const,
        }))),
        ...rightKeys.flatMap((measure) => groups.map((group) => ({
          key: `${measure} · ${group}`, measure, group, axis: 'y1' as const,
        }))),
      ]
    : [
        ...yKeys.map((key) => ({ key, measure: key, group: undefined, axis: 'y' as const })),
        ...rightKeys.map((key) => ({ key, measure: key, group: undefined, axis: 'y1' as const })),
      ];
  const series = seriesDefs.map(({ key, measure, group, axis }) => {
    const raw = slots.map(({ label, rowIndex: sourceIndex, occurrence }, i) => {
      if (sourceIndex >= 0) return toNumber(rows[sourceIndex][measure]);
      const matches = buckets.get(JSON.stringify([label, group ?? null])) || [];
      if (!matches.length) return null;
      if (aggregation === 'none') return toNumber(matches[occurrence]?.[measure]);
      return aggregateChartValues(matches, measure, aggregation);
    });
    return { key, measure, axis, values: applyMissingValuePolicy(raw, missing) };
  });
  if (stackMode === 'percent') {
    labels.forEach((_, i) => {
      const total = series.filter((s) => s.axis === 'y').reduce((n, s) => n + Math.abs(s.values[i] ?? 0), 0);
      for (const s of series) {
        if (s.axis === 'y') s.values[i] = s.values[i] === null || total === 0 ? null : s.values[i]! / total * 100;
      }
    });
  }
  return { labels, displayLabels, series };
}

export function filterSortTableRows<T extends Record<string, unknown>>(
  rows: T[],
  options: { filter?: string; brush?: { column: string; value: string | number; values?: string[]; range?: { from: number; to: number; includeTo: boolean } } | null; sortColumn?: string | null; sortDirection?: 'ASC' | 'DESC'; numericColumns?: string[] },
): T[] {
  const query = options.filter?.trim().toLocaleLowerCase() || '';
  const brush = options.brush && rows.some((row) => Object.prototype.hasOwnProperty.call(row, options.brush!.column))
    ? options.brush
    : null;
  const filtered = rows.filter((row) =>
    (!brush || (brush.range
      ? (() => {
          const value = toNumber(row[brush.column]);
          const range = brush.range!;
          return value !== null && value >= range.from &&
            (value < range.to || (range.includeTo && value <= range.to));
        })()
      : brush.values ? brush.values.includes(chartDimensionValue(row[brush.column], brush.column))
      : chartDimensionValue(row[brush.column], brush.column) === chartDimensionValue(brush.value, brush.column))) &&
    (!query || Object.values(row).some((value) => String(value ?? '').toLocaleLowerCase().includes(query))));
  if (!options.sortColumn) return filtered;
  const column = options.sortColumn;
  const direction = options.sortDirection === 'DESC' ? -1 : 1;
  return [...filtered].sort((a, b) => {
    const av = a[column];
    const bv = b[column];
    if (av == null) return bv == null ? 0 : 1;
    if (bv == null) return -1;
    if (!isIdentifierColumn(column) && options.numericColumns?.includes(column)) {
      const an = toNumber(av), bn = toNumber(bv);
      if (an == null) return bn == null ? 0 : 1;
      if (bn == null) return -1;
      return direction * (an - bn);
    }
    if (typeof av === 'number' && typeof bv === 'number') return direction * (av - bv);
    return direction * String(av).localeCompare(String(bv), 'zh-CN', { numeric: true });
  });
}

export function computePivotTable(
  rows: Record<string, unknown>[], rowKey: string, colKey: string, valueKey: string,
  aggregation: 'sum' | 'count' | 'avg' | 'min' | 'max' = 'sum',
  rowKeys?: string[],
) {
  const sourceTotals = rows.some(row => Object.hasOwn(row, `__pivot_all_${valueKey}`));
  const isMultiRow = Boolean(rowKeys && rowKeys.length > 1);
  const dims = isMultiRow ? rowKeys! : [rowKey];

  const keyOf = (row: Record<string, unknown>) => {
    if (!isMultiRow) {
      const value = row[rowKey];
      return sourceTotals ? JSON.stringify(value == null ? null : String(value)) : String(value ?? '—');
    }
    return JSON.stringify(dims.map(d => row[d] == null ? null : String(row[d])));
  };

  const rowValues = [...new Set(rows.map(row => keyOf(row)))];
  const colValues = colKey ? [...new Set(rows.map(row => sourceTotals ? JSON.stringify(row[colKey] == null ? null : String(row[colKey])) : String(row[colKey] ?? '—')))] : ['汇总'];
  type Cell = { sum: number; count: number; min: number; max: number };
  const cells = new Map<string, Cell>(), rowCells = new Map<string, Cell>(), colCells = new Map<string, Cell>();
  const grand: Cell = { sum: 0, count: 0, min: Infinity, max: -Infinity };
  const bump = (cell: Cell, value: number) => {
    cell.sum += value; cell.count++; cell.min = Math.min(cell.min, value); cell.max = Math.max(cell.max, value);
  };
  const bumpMap = (map: Map<string, Cell>, key: string, value: number) => {
    let cell = map.get(key);
    if (!cell) { cell = { sum: 0, count: 0, min: Infinity, max: -Infinity }; map.set(key, cell); }
    bump(cell, value);
  };
  const result = (cell?: Cell): number | null => !cell?.count ? null
    : aggregation === 'count' ? cell.count : aggregation === 'avg' ? cell.sum / cell.count
    : aggregation === 'min' ? cell.min : aggregation === 'max' ? cell.max : cell.sum;
  for (const row of rows) {
    if(sourceTotals)continue;
    const r = keyOf(row), c = colKey ? (sourceTotals ? JSON.stringify(row[colKey] == null ? null : String(row[colKey])) : String(row[colKey] ?? '—')) : '汇总';
    const value = aggregation === 'count' ? (row[valueKey] == null ? null : 1) : toNumber(row[valueKey]);
    if (value == null) continue;
    bumpMap(cells, JSON.stringify([r, c]), value); bumpMap(rowCells, r, value); bumpMap(colCells, c, value); bump(grand, value);
  }
  const matrix: Record<string, Record<string, number|string>> = Object.create(null);
  const rowTotals: Record<string, number|string> = Object.create(null), colTotals: Record<string, number|string> = Object.create(null);
  for (const r of rowValues) {
    matrix[r] = Object.create(null);
    const value = result(rowCells.get(r)); if (value != null) rowTotals[r] = value;
  }
  for (const [key, cell] of cells) { const [r,c] = JSON.parse(key) as [string,string]; const value = result(cell); if (value != null) matrix[r][c] = value; }
  for (const c of colValues) { const value = result(colCells.get(c)); if (value != null) colTotals[c] = value; }
  let grandTotal:number|string|null = result(grand) ?? 0, grandCount = grand.count;
  const rowLabels: Record<string,string> = Object.create(null), colLabels: Record<string,string> = Object.create(null);
  const rowBindings: Record<string,unknown> = Object.create(null), colBindings: Record<string,unknown> = Object.create(null);
  const rowLevels: Record<string, number> = Object.create(null);
  const rowParents: Record<string, string> = Object.create(null);
  const subtotals: Record<string, Record<string, number|string>> = Object.create(null);
  const rowSubtotals: Record<string, number|string> = Object.create(null);

  if (sourceTotals) for (const row of rows) {
    const r = keyOf(row);
    const c = colKey ? JSON.stringify(row[colKey] == null ? null : String(row[colKey])) : '汇总';
    if (!isMultiRow) {
      rowLabels[r] = row[rowKey] == null ? '（空值）' : String(row[rowKey]);
      rowBindings[r] = row[rowKey];
    } else {
      const parsedParts = dims.map(d => row[d] == null ? '（空值）' : String(row[d]));
      rowLabels[r] = parsedParts.join('  ›  ');
      rowBindings[r] = Object.fromEntries(dims.map(d => [d, row[d]]));
      rowLevels[r] = dims.length - 1;
      rowParents[r] = String(row[dims[0]] ?? '（空值）');
    }
    colLabels[c] = !colKey ? '汇总' : row[colKey] == null ? '（空值）' : String(row[colKey]);
    colBindings[c] = colKey ? row[colKey] : undefined;
    const exact=(value:unknown):number|string|null=>{
      if(value==null)return null;
      if(typeof value==='number')return Number.isFinite(value)?value:null;
      const raw=String(value),text=/^-?\d+\.\d+$/.test(raw)?raw.replace(/0+$/,'').replace(/\.$/,''):raw,n=Number(text);
      return Number.isFinite(n) && String(n)===text ? n : text;
    };
    const cell=exact(row[valueKey]);if(cell!=null)matrix[r][c]=cell;
    const rowTotal = exact(row[`__pivot_row_${valueKey}`]), colTotal = exact(row[`__pivot_col_${valueKey}`]);
    if (rowTotal != null) rowTotals[r] = rowTotal; else delete rowTotals[r];
    if (colTotal != null) colTotals[c] = colTotal; else delete colTotals[c];
    grandTotal = exact(row[`__pivot_all_${valueKey}`]);
    grandCount = toNumber(row.__pivot_count) ?? 0;
  }

  if (isMultiRow && sourceTotals) {
    const parentGroups = new Map<string, { cells: Map<string, number[]>; totals: number[] }>();
    for (const r of rowValues) {
      const parent = rowParents[r];
      if (!parent) continue;
      let group = parentGroups.get(parent);
      if (!group) {
        group = { cells: new Map(), totals: [] };
        parentGroups.set(parent, group);
      }
      for (const c of colValues) {
        const val = matrix[r]?.[c];
        if (typeof val === 'number') {
          const list = group.cells.get(c) || [];
          list.push(val);
          group.cells.set(c, list);
        }
      }
      const rTot = rowTotals[r];
      if (typeof rTot === 'number') {
        group.totals.push(rTot);
      }
    }
    for (const [parent, group] of parentGroups) {
      subtotals[parent] = Object.create(null);
      for (const [c, list] of group.cells) {
        if (list.length) {
          subtotals[parent][c] = aggregation === 'avg' ? (list.reduce((a, b) => a + b, 0) / list.length)
            : aggregation === 'min' ? Math.min(...list)
            : aggregation === 'max' ? Math.max(...list)
            : list.reduce((a, b) => a + b, 0);
          if (colLabels[c]) subtotals[parent][colLabels[c]] = subtotals[parent][c];
        }
      }
      if (group.totals.length) {
        rowSubtotals[parent] = aggregation === 'avg' ? (group.totals.reduce((a, b) => a + b, 0) / group.totals.length)
          : aggregation === 'min' ? Math.min(...group.totals)
          : aggregation === 'max' ? Math.max(...group.totals)
          : group.totals.reduce((a, b) => a + b, 0);
      }
    }
  }

  return { rowValues, colValues, matrix, rowTotals, colTotals, grandTotal, grandCount,
    rowKeys: dims,
    ...(isMultiRow ? { subtotals, rowSubtotals, rowLevels, rowParents } : {}),
    ...(sourceTotals ? {totalsScope: 'source' as const, rowLabels,colLabels,rowBindings,colBindings} : {}) };
}

export function summarizeTableRows(rows: Record<string, unknown>[], columns: string[], measureKeys:string[]=[]): Record<string, number> {
  const totals: Record<string, number> = {};
  const unitColumns = columns.filter(column => /^(unit|currency|asset|quote_currency)$/i.test(column));
  const mixedUnits = unitColumns.some(column => new Set(rows.map(row => row[column]).filter(value => value != null)).size > 1);
  for (const column of columns) {
    if (isIdentifierColumn(column)) continue;
    if (/rate|ratio|percent|pct|price|(?:^|_)(?:level|grade|tier|code|year)(?:_|$)/i.test(column)) continue;
    if (mixedUnits && !/^(records|counts?|orders|completed|failed|total_orders)$/i.test(column)) continue;
    if (!rows.some((row) => (measureKeys.includes(column) || typeof row[column] === 'number' || typeof row[column] === 'bigint' || row[column] instanceof Uint8Array) && chartNumber(row[column]) !== null)) continue;
    totals[column] = rows.reduce((sum, row) => sum + (toNumber(row[column]) || 0), 0);
  }
  return totals;
}

/** Pie/doughnut/funnel slice labels + percents from filtered result rows. */
export function computeSliceLabels(
  rows: Record<string, unknown>[],
  xKey: string,
  yKey: string,
  format: ValueFormatSpec,
): {
  sliceLabels: NonNullable<ChartSpec['sliceLabels']>;
  centerTotal: number;
} {
  const parts = rows.map((r) => {
    const key = String(r[xKey] ?? '');
    const value = toNumber(r[yKey]) ?? 0;
    return { key, value };
  });
  const total = parts.reduce((s, p) => s + Math.abs(p.value), 0);
  const sliceLabels = parts.map((p) => {
    const percent = total > 0 ? (Math.abs(p.value) / total) * 100 : 0;
    const valueFmt = formatValueBySpec(p.value, { ...format, percent: false });
    const pctFmt = formatPercentValue(percent);
    return {
      key: p.key,
      value: p.value,
      percent,
      label: `${valueFmt}, ${pctFmt}`,
    };
  });
  return { sliceLabels, centerTotal: total };
}

/** Equal-width histogram bins from a numeric measure column (recomputed on filtered rows). */
export function computeHistogramBins(
  rows: Record<string, unknown>[],
  valueKey: string,
  binCount?: number,
  format?: ValueFormatSpec,
  binWidth?: number,
): NonNullable<ChartSpec['histogramBins']> {
  const values = rows
    .map((r) => toNumber(r[valueKey]))
    .filter((n): n is number => n !== null);
  if (!values.length) return [];

  const min = values.reduce((a, b) => Math.min(a, b), Infinity);
  const max = values.reduce((a, b) => Math.max(a, b), -Infinity);
  const automatic = Math.ceil(Math.log2(values.length) + 1);
  const bins = binWidth != null ? Math.max(1, Math.ceil((max - min) / binWidth))
    : Math.max(1, Math.min(200, Math.floor(binCount != null && Number.isFinite(binCount) ? binCount : automatic)));
  if (!Number.isFinite(bins) || bins > 200 || binWidth != null && (!Number.isFinite(binWidth) || binWidth <= 0)) return [];
  if (min === max) {
    return [
      {
        label: formatValueBySpec(min, format),
        count: values.length,
        percent: 100,
        from: min,
        to: max,
      },
    ];
  }

  const width = binWidth ?? (max - min) / bins;
  const scale = Math.max(Math.abs(min),Math.abs(max));
  const decimals = Math.max(1, Math.min(10, Math.ceil(-Math.log10(width)) + 1));
  const counts = Array.from({ length: bins }, () => 0);
  for (const v of values) {
    let idx = binWidth != null ? Math.floor((v - min) / binWidth) : Math.floor((v/scale-min/scale)/(max/scale-min/scale)*bins);
    if (idx >= bins) idx = bins - 1;
    if (idx < 0) idx = 0;
    counts[idx] += 1;
  }
  const total = values.length;
  return counts.map((count, i) => {
    const from = binWidth != null ? min + i * binWidth : min*(1-i/bins)+max*(i/bins);
    const to = binWidth != null ? min + (i + 1) * binWidth : i === bins - 1 ? max : min*(1-(i+1)/bins)+max*((i+1)/bins);
    const fromTxt = formatValueBySpec(from, { ...format, compact: false, decimals });
    const toTxt = formatValueBySpec(to, { ...format, compact: false, decimals });
    const percent = total > 0 ? (count / total) * 100 : 0;
    return {
      label: `${fromTxt}–${toTxt}`,
      count,
      percent,
      from,
      to,
    };
  });
}

/**
 * Waterfall floating-bar series: transparent base + visible delta.
 * Labels matching total/合计 are absolute total bars.
 */
export function computeWaterfallSeries(
  rows: Record<string, unknown>[],
  xKey: string,
  yKey: string,
  roleKey?: string,
): NonNullable<ChartSpec['waterfall']> {
  const labels: string[] = [];
  const bases: number[] = [];
  const deltas: number[] = [];
  const kinds: Array<'increase' | 'decrease' | 'total'> = [];
  const roles: Array<'start' | 'change' | 'end' | 'total'> = [];
  let running = 0;

  for (const r of rows) {
    const label = String(r[xKey] ?? '');
    const v = toNumber(r[yKey]) ?? 0;
    const role = roleKey ? r[roleKey] as typeof roles[number] : undefined;
    const isTotal = role ? role !== 'change' : /^(?:total|sum|start|end|begin|initial|final)$|合计|总计|小计|起点|终点|期初|期末/i.test(label.trim());
    roles.push(role || (isTotal ? 'total' : 'change'));
    labels.push(label);
    if (isTotal) {
      bases.push(0);
      deltas.push(v);
      kinds.push('total');
      running = v;
    } else {
      const base = v >= 0 ? running : running + v;
      bases.push(base);
      deltas.push(Math.abs(v));
      kinds.push(v >= 0 ? 'increase' : 'decrease');
      running += v;
    }
  }

  return { labels, bases, deltas, kinds, roles };
}

/** Scatter points from numeric x/y (+ optional size), with raw row for tooltip. */
export function computeScatterPoints(
  rows: Record<string, unknown>[],
  xKey: string,
  yKey: string,
  sizeKey?: string,
): NonNullable<ChartSpec['scatterPoints']> {
  const out: NonNullable<ChartSpec['scatterPoints']> = [];
  for (const r of rows) {
    const x = toNumber(r[xKey]);
    const y = toNumber(r[yKey]);
    if (x === null || y === null) continue;
    const size = sizeKey ? toNumber(r[sizeKey]) : null;
    out.push({
      x,
      y,
      r: size === null ? undefined : Math.max(3, Math.min(18, Math.abs(size))),
      label: String(r[xKey] ?? ''),
      raw: r,
    });
  }
  if (sizeKey) {
    const sizes = out.map(point => toNumber(point.raw?.[sizeKey])).filter((value):value is number=>value!=null&&value>=0);
    const min = sizes.reduce((min,value)=>Math.min(min,value),Infinity), max = sizes.reduce((max,value)=>Math.max(max,value),-Infinity);
    out.forEach(point => { const value=toNumber(point.raw?.[sizeKey]); point.r=value==null||value<0?4:max>min?3+15*Math.sqrt((value-min)/(max-min)):8; });
  }
  return out;
}

/** KPI compare entries from yoy/mom calc columns — hide when baseline missing. */
export function analyzeScatterPoints(points: NonNullable<ChartSpec['scatterPoints']>) {
  if (points.length < 2) return { points, trend: [] as typeof points };
  const meanX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  const varianceX = points.reduce((sum, p) => sum + (p.x - meanX) ** 2, 0);
  if (!varianceX) return { points, trend: [] as typeof points };
  const slope = points.reduce((sum, p) => sum + (p.x - meanX) * (p.y - meanY), 0) / varianceX;
  const predict = (x: number) => meanY + slope * (x - meanX);
  const residuals = points.map(p => p.y - predict(p.x)).sort((a, b) => a - b);
  const quantile = (fraction: number) => {
    const index = (residuals.length - 1) * fraction, low = Math.floor(index);
    return residuals[low] + (residuals[Math.ceil(index)] - residuals[low]) * (index - low);
  };
  const q1 = quantile(.25), q3 = quantile(.75), iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr, upper = q3 + 1.5 * iqr;
  const epsilon = points.reduce((max, p) => Math.max(max, Math.abs(p.y)), 1) * 1e-10;
  const flagged = points.map(p => ({ ...p, outlier: points.length >= 4 && (p.y - predict(p.x) < lower - epsilon || p.y - predict(p.x) > upper + epsilon) }));
  const min = points.reduce((n, p) => Math.min(n, p.x), Infinity), max = points.reduce((n, p) => Math.max(n, p.x), -Infinity);
  return { points: flagged, trend: [{ x: min, y: predict(min) }, { x: max, y: predict(max) }] };
}

export function buildKpiCompare(
  row: Record<string, unknown> | undefined,
  spec: AnalysisSpec,
  format: ValueFormatSpec,
): NonNullable<ChartSpec['kpiCompare']> {
  if (!row) return [];
  const out: NonNullable<ChartSpec['kpiCompare']> = [];
  const valueKey = spec.visual.encoding?.y?.[0] || spec.metrics[0]?.alias;
  const current = toNumber(row[valueKey]);
  const baselineKey = spec.visual.kpiBaselineKey;
  const baseline = baselineKey ? toNumber(row[baselineKey]) : null;
  if (current !== null && baseline !== null && baseline !== 0) {
    const change = (current - baseline) / Math.abs(baseline) * 100;
    if (Number.isFinite(change)) out.push({ key: 'baseline', label: baselineKey!, baseline: `较基准 ${baselineKey} (${formatValueBySpec(baseline, format)})`,
      value: change, formatted: formatPercentValue(change) });
  }
  if (current !== null && spec.visual.kpiTarget != null && Number.isFinite(spec.visual.kpiTarget)) {
    const delta = current - spec.visual.kpiTarget;
    if (Number.isFinite(delta)) out.push({ key: 'target', label: '目标差值', baseline: `较目标 (${formatValueBySpec(spec.visual.kpiTarget, format)})`,
      value: delta, formatted: formatValueBySpec(delta, format) });
  }
  const compareKeys =
    spec.visual.kpiCompareKeys ||
    (spec.calcs || [])
      .filter((c) => c.kind === 'yoy' || c.kind === 'mom')
      .map((c) => c.alias);

  for (const key of compareKeys) {
    const calc = (spec.calcs || []).find((c) => c.alias === key || c.id === key);
    const raw = toNumber(row[key]);
    if (raw === null) continue;
    const baseline =
      calc?.kind === 'yoy' ? '同比上年同期' : calc?.kind === 'mom' ? '环比上一周期' : `较基准 (${key})`;
    out.push({
      key,
      label: key,
      baseline,
      value: raw,
      formatted: formatValueBySpec(raw, {
        ...format,
        percent: true,
        unit: '%',
        decimals: 1,
      }),
    });
  }
  return out;
}

/**
 * Multi-metric KPI cards from first row — engine formats each measure.
 */
export function buildKpiCards(
  row: Record<string, unknown> | undefined,
  keys: string[],
  format: ValueFormatSpec,
  formatByKey?: Record<string, ValueFormatSpec>,
): NonNullable<ChartSpec['kpiCards']> {
  if (!row || !keys.length) return [];
  return keys.map((key) => {
    const fmt = { ...format, ...(formatByKey?.[key] || {}) };
    const value = toNumber(row[key]);
    return {
      key,
      label: key,
      value,
      formatted: formatValueBySpec(value, fmt),
      unit: fmt.unit,
    };
  });
}

export function defaultShowValues(chartType: ChartTypeId): boolean {
  return ['bar', 'pie', 'doughnut', 'funnel', 'waterfall', 'histogram', 'combo'].includes(chartType);
}

export function defaultLabelMode(chartType: ChartTypeId): ChartSpec['labelMode'] {
  if (chartType === 'line' || chartType === 'area' || chartType === 'scatter') return 'auto';
  if (defaultShowValues(chartType)) return 'auto';
  return 'never';
}

/** Summaries retain temporal endpoints: a missing latest period is never an older value. */
export function summarizeTimeSeries(values: Array<number | null>) {
  const valid = values.filter((value): value is number => value != null && Number.isFinite(value));
  const latestVal = values.at(-1) ?? null, first = values[0] ?? null;
  return { latestVal, avgVal: valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null,
    maxVal: valid.length ? valid.reduce((a, b) => Math.max(a, b), -Infinity) : null,
    totalGrowthPct: first != null && first !== 0 && latestVal != null && values.length > 1
      ? (latestVal - first) / Math.abs(first) * 100 : null };
}
