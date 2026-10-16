/**
 * Chart type registry — only path from Result + Spec → ChartSpec.
 * Components must not invent chart encoding or recompute metrics outside the registry.
 */

import type { ChartConfig, ChartType } from '../../types';
import type {
  AnalysisSpec,
  ChartSpec,
  ChartTypeId,
  ColumnRoleMap,
  CompiledAnalysis,
} from './types';
import { formatValueBySpec, inferChartUnit } from '../../utils/chartFormat';
import {
  buildFormatSpec,
  aggregateChartValues,
  buildKpiCards,
  buildKpiCompare,
  computeHistogramBins,
  computePivotTable,
  computeCartesianSeries,
  computeScatterPoints,
  analyzeScatterPoints,
  computeSliceLabels,
  computeWaterfallSeries,
  orderCategoryRows,
  defaultLabelMode,
  defaultShowValues,
  detectEmptyState,
  resolveMissingValue,
  resolveStackMode,
  scanSignedDomain,
  sortRowsByTimeAxis,
  toNumber,
  summarizeTimeSeries,
} from './chartDisplay';

export type EncodingChannel = 'x' | 'y' | 'series' | 'size' | 'color';

export interface ChartTypeDefinition {
  id: ChartTypeId;
  label: string;
  requiredEncodings: EncodingChannel[];
  supports: { multiMetric: boolean; timeAxis: boolean; stacked: boolean };
  mapResult: (
    rows: Record<string, unknown>[],
    columns: string[],
    spec: AnalysisSpec,
    compiled: Pick<CompiledAnalysis, 'roles' | 'dimAliases' | 'metricAliases' | 'calcAliases'>,
  ) => ChartSpec;
  suitability?: (roles: ColumnRoleMap, rowCount: number) => number;
}

function pickX(spec: AnalysisSpec, dimAliases: string[], columns: string[]): string {
  return spec.visual.encoding?.x || dimAliases[0] || columns[0] || '';
}

function pickY(
  spec: AnalysisSpec,
  metricAliases: string[],
  calcAliases: string[],
  columns: string[],
  dimAliases: string[],
): string[] {
  if (spec.visual.encoding?.y?.length) return spec.visual.encoding.y;
  const metrics = [...metricAliases, ...calcAliases];
  if (metrics.length) return metrics;
  return columns.filter((c) => !dimAliases.includes(c));
}

function isTimeDimension(spec: AnalysisSpec, xKey: string): boolean {
  return spec.dimensions.some(
    (d) => (d.alias || d.column) === xKey && (!!d.dateTrunc || /date|time|period|month|year|_(?:at|on)(?:_|$)|月|日|年/i.test(d.column)),
  );
}

function baseChart(
  id: ChartTypeId,
  label: string,
  supports: ChartTypeDefinition['supports'],
  required: EncodingChannel[] = ['x', 'y'],
): Omit<ChartTypeDefinition, 'mapResult'> {
  return { id, label, requiredEncodings: required, supports };
}

function enrichCommon(
  chartType: ChartTypeId,
  rowsIn: Record<string, unknown>[],
  columns: string[],
  spec: AnalysisSpec,
  compiled: Pick<CompiledAnalysis, 'roles' | 'dimAliases' | 'metricAliases' | 'calcAliases'>,
): ChartSpec {
  const xKey = pickX(spec, compiled.dimAliases, columns);
  let yKeys = pickY(
    spec,
    compiled.metricAliases,
    compiled.calcAliases,
    columns,
    compiled.dimAliases,
  );
  const percentCalcs = spec.calcs.filter(calc => ['ratio', 'yoy', 'mom'].includes(calc.kind)).map(calc => calc.alias);
  const yRightKeys = spec.visual.encoding?.yRight ?? (['line', 'area', 'combo'].includes(chartType) ? percentCalcs : []);
  yKeys = yKeys.filter(key => !yRightKeys.includes(key));
  const stackMode = resolveStackMode(spec.visual);
  const normalizeValues = spec.visual.valueMode === 'percent' && ['bar','line','area','combo'].includes(chartType);
  const countValues = spec.visual.aggregation === 'count';
  const percentageLeft = normalizeValues || stackMode === 'percent';
  const format = countValues && !percentageLeft ? { unit: '个', decimals: 0, percent: false, compact: false }
    : buildFormatSpec(spec.metrics[0]?.unitHint, normalizeValues ? { ...spec.visual, format: { ...spec.visual.format, unit: '%', percent: true } } : spec.visual, yKeys[0]);
  const timeish = isTimeDimension(spec, xKey);
  const ordered = timeish ? rowsIn : orderCategoryRows(
    rowsIn, xKey, yKeys[0], spec.visual.categorySort, spec.visual.topN, spec.visual.aggregation,
  );
  const { rows, timeSorted } = sortRowsByTimeAxis(ordered, xKey, timeish);
  const empty = detectEmptyState(rows, chartType === 'table' || countValues ? [] : [...yKeys, ...yRightKeys]);
  const signed = scanSignedDomain(rows, [...yKeys, ...yRightKeys]);
  const cartesian = computeCartesianSeries(rows, xKey, yKeys, yRightKeys, spec.visual.encoding?.series,
    stackMode, resolveMissingValue(spec.visual), spec.visual.aggregation, spec.visual.encoding?.label);
  if (normalizeValues && stackMode !== 'percent') {
    for (const series of cartesian.series) {
      const total = series.values.reduce<number>((n, v) => n + Math.abs(v ?? 0), 0);
      series.values = series.values.map(v => v == null || total === 0 ? null : v / total * 100);
    }
  }
  const showValues = spec.visual.showValues ?? defaultShowValues(chartType);
  const leftUnits = new Set(yKeys.map(key => buildFormatSpec(spec.metrics.find(metric => metric.alias === key || metric.column === key)?.unitHint, spec.visual, key).unit || ''));
  const rightUnits = new Set(yRightKeys.map(key => spec.visual.formatByKey?.[key]?.unit ?? spec.visual.unitRight ?? inferChartUnit(key) ?? ''));
  const incompatibleUnits = ['bar', 'line', 'area', 'combo'].includes(chartType) && !countValues && ((!percentageLeft && leftUnits.size > 1) || rightUnits.size > 1);

  return {
    id: `${spec.id}_${chartType}`,
    title: spec.visual.title || `${spec.dataset.table} 分析`,
    chartType,
    xKey,
    yKeys: yKeys.length ? yKeys : [columns[1] || ''],
    cartesian,
    colors: spec.visual.colors,
    yRightKeys: yRightKeys.length ? yRightKeys : undefined,
    seriesKey: spec.visual.encoding?.series,
    colorKey: spec.visual.encoding?.color,
    labelKey: spec.visual.encoding?.label,
    showTrendLine: spec.visual.showTrendLine,
    highlightOutliers: spec.visual.highlightOutliers,
    sizeKey: spec.visual.encoding?.size,
    unit: format.unit,
    unitRight: countValues ? '个' : spec.visual.unitRight || (yRightKeys.some(key => percentCalcs.includes(key)) ? '%' : yRightKeys[0] ? inferChartUnit(yRightKeys[0]) : undefined),
    stacked: stackMode === 'stack' || stackMode === 'percent',
    stackMode,
    horizontal: spec.visual.horizontal,
    showLegend: spec.visual.showLegend ?? true,
    legendPosition: spec.visual.legendPosition || 'bottom',
    legendAlign: spec.visual.legendAlign || 'center',
    showValues,
    labelMode: spec.visual.labelMode || (showValues ? 'auto' : 'never'),
    missingValue: resolveMissingValue(spec.visual),
    format,
    formatByKey: Object.fromEntries([...new Set([...columns, ...yKeys, ...yRightKeys])].map(key => {
      const metric = spec.metrics.find(m => m.alias === key || m.column === key);
      const isRight = yRightKeys.includes(key);
      const hint = percentCalcs.includes(key) ? '%' : isRight ? spec.visual.unitRight : metric?.unitHint;
      const percentage = hint === '%' || normalizeValues || stackMode === 'percent' && !isRight;
      const fmt = buildFormatSpec(hint, { ...spec.visual, format: isRight ? { ...spec.visual.format, unit: hint ?? inferChartUnit(key) ?? '', percent: hint === '%' } : percentage ? { ...spec.visual.format, unit: '%', percent: true } : spec.visual.format }, key);
      if (!yKeys.includes(key) && !isRight) return [key, { ...spec.visual.formatByKey?.[key], unit: spec.visual.formatByKey?.[key]?.unit ?? inferChartUnit(key) ?? '', percent: spec.visual.formatByKey?.[key]?.percent ?? inferChartUnit(key) === '%' }];
      if (countValues && !percentage) return [key, { ...format, unit: '个', decimals: 0, percent: false }];
      // Percent transforms change the meaning of these values. Saved absolute
      // units cannot override the computed series contract; right axes stay raw.
      return [key, percentage ? { ...fmt, unit: '%', percent: true } : fmt];
    })),
    xAxisLabel: spec.visual.xAxisLabel || xKey,
    yAxisLabel: spec.visual.yAxisLabel || yKeys[0],
    yRightAxisLabel: spec.visual.yRightAxisLabel || yRightKeys[0],
    includeZero: signed.includeZero,
    hasNegative: signed.hasNegative,
    rows,
    columns,
    brushField: spec.linkage?.brushField || xKey,
    tooltipDims: compiled.dimAliases,
    timeSorted,
    timeSummary: timeish ? summarizeTimeSeries(cartesian.series[0]?.values || []) : undefined,
    ...empty,
    ...(incompatibleUnits ? { emptyState: 'error' as const, emptyMessage: '同一坐标轴包含不同单位；请将不同量纲绑定到左右轴，或分别展示' } : {}),
    ...(stackMode === 'percent' && cartesian.series.some(series => series.axis === 'y' && series.values.some(value => value != null && value < 0)) ? { emptyState: 'error' as const, emptyMessage: '百分比堆叠要求非负指标；请选择普通堆叠以保留正负值' } : {}),
  };
}

function mapCartesian(
  chartType: ChartTypeId,
  rows: Record<string, unknown>[],
  columns: string[],
  spec: AnalysisSpec,
  compiled: Pick<CompiledAnalysis, 'roles' | 'dimAliases' | 'metricAliases' | 'calcAliases'>,
): ChartSpec {
  return enrichCommon(chartType, rows, columns, spec, compiled);
}

function mapPieLike(
  chartType: 'pie' | 'doughnut',
  rows: Record<string, unknown>[],
  columns: string[],
  spec: AnalysisSpec,
  compiled: Pick<CompiledAnalysis, 'roles' | 'dimAliases' | 'metricAliases' | 'calcAliases'>,
): ChartSpec {
  const base = enrichCommon(chartType, rows, columns, spec, compiled);
  const yKey = base.yKeys[0];
  if (!base.rows?.length || !yKey) return base;
  const prepared = (base.cartesian?.labels || []).map((label, i) => ({
    [base.xKey]: label,
    [yKey]: base.cartesian?.series[0]?.values[i] ?? null,
  }));
  const { sliceLabels, centerTotal } = computeSliceLabels(
    prepared,
    base.xKey,
    yKey,
    base.format || {},
  );
  return {
    ...base,
    showValues: base.showValues,
    labelMode: base.showValues === false ? 'never' : base.labelMode,
    ...(sliceLabels.some(slice => slice.value < 0) ? { emptyState: 'error' as const, emptyMessage: '饼图和圆环图不支持负值；请选择柱状图展示正负变化' } : centerTotal === 0 ? { emptyState: 'empty' as const, emptyMessage: '当前筛选的总量为 0，无法计算占比' } : {}),
    sliceLabels,
    centerTotal,
    centerLabel: base.unit ? `合计 (${base.unit})` : '合计',
  };
}

const barDef: ChartTypeDefinition = {
  ...baseChart('bar', '柱状图', { multiMetric: true, timeAxis: true, stacked: true }),
  mapResult: (rows, cols, spec, compiled) => mapCartesian('bar', rows, cols, spec, compiled),
  suitability: (_r, n) => (n <= 50 ? 80 : 40),
};

const lineDef: ChartTypeDefinition = {
  ...baseChart('line', '折线图', { multiMetric: true, timeAxis: true, stacked: false }),
  mapResult: (rows, cols, spec, compiled) => mapCartesian('line', rows, cols, spec, compiled),
  suitability: (_r, n) => (n >= 3 ? 85 : 50),
};

const areaDef: ChartTypeDefinition = {
  ...baseChart('area', '面积图', { multiMetric: true, timeAxis: true, stacked: true }),
  mapResult: (rows, cols, spec, compiled) => mapCartesian('area', rows, cols, spec, compiled),
};

const doughnutDef: ChartTypeDefinition = {
  ...baseChart('doughnut', '环形图', { multiMetric: false, timeAxis: false, stacked: false }),
  mapResult: (rows, cols, spec, compiled) => mapPieLike('doughnut', rows, cols, spec, compiled),
  suitability: (_r, n) => (n <= 12 ? 75 : 20),
};

const pieDef: ChartTypeDefinition = {
  ...baseChart('pie', '饼图', { multiMetric: false, timeAxis: false, stacked: false }),
  mapResult: (rows, cols, spec, compiled) => mapPieLike('pie', rows, cols, spec, compiled),
};

const scatterDef: ChartTypeDefinition = {
  ...baseChart('scatter', '散点图', { multiMetric: true, timeAxis: false, stacked: false }, [
    'x',
    'y',
  ]),
  mapResult: (rows, cols, spec, compiled) => {
    const base = enrichCommon('scatter', rows, cols, spec, compiled);
    const colorValues = base.colorKey ? (base.rows || []).map(row=>row[base.colorKey!]).filter(value=>value!=null) : [];
    const numericColor = colorValues.length>0 && colorValues.every(value=>toNumber(value)!=null);
    const scatterSeries = base.yKeys.map((key) => ({
      key,
      points: computeScatterPoints(base.rows || [], base.xKey, key, base.sizeKey),
    })).flatMap(series => {
      if (!base.colorKey || numericColor) return [series];
      const groups = new Map<string, typeof series.points>();
      for (const point of series.points) {
        const group = String(point.raw?.[base.colorKey] ?? '—');
        const points = groups.get(group) || [];
        points.push(point); groups.set(group, points);
      }
      return [...groups].map(([group, points]) => ({ key: series.key, label: `${series.key} · ${group}`, points }));
    });
    const numericColors = numericColor ? scatterSeries.flatMap(series=>series.points.map(point=>toNumber(point.raw?.[base.colorKey!]))).filter((value):value is number=>value!=null) : [];
    const colorScale = numericColors.length ? {field:base.colorKey!,min:numericColors.reduce((min,value)=>Math.min(min,value),Infinity),max:numericColors.reduce((max,value)=>Math.max(max,value),-Infinity)} : undefined;
    const analyzed = scatterSeries.flatMap(series => {
      const colored = colorScale ? series.points.map(point=>{const value=toNumber(point.raw?.[colorScale.field]);return {...point,colorRatio:value==null?undefined:colorScale.max>colorScale.min?(value-colorScale.min)/(colorScale.max-colorScale.min):.5};}) : series.points;
      const analysis = analyzeScatterPoints(colored);
      return [ { ...series, points: spec.visual.highlightOutliers ? analysis.points : colored },
        ...(spec.visual.showTrendLine && analysis.trend.length ? [{ ...series, label: `${'label' in series ? series.label : series.key} · 趋势线`, trend: true, points: analysis.trend }] : []) ];
    });
    const points = analyzed[0]?.points || [];
    return {
      ...base,
      showValues: false,
      labelMode: 'never',
      tooltipDims: cols,
      scatterPoints: points,
      scatterSeries: analyzed,
      colorScale,
      emptyState: scatterSeries.some((s) => s.points.length) ? 'ok' : 'empty',
    };
  },
};

const tableDef: ChartTypeDefinition = {
  ...baseChart('table', '数据表', { multiMetric: true, timeAxis: true, stacked: false }, []),
  mapResult: (rows, columns, spec, compiled) => ({
    ...enrichCommon('table', rows, columns, spec, compiled),
    pivotTable: spec.visual.pivot && { ...spec.visual.pivot, ...computePivotTable(rows, spec.visual.pivot.rowKey, spec.visual.pivot.colKey, spec.visual.pivot.valKey, spec.visual.pivot.aggregation, spec.pivotLayout?.rowAliases || (spec.visual.pivot.rowKey ? [spec.visual.pivot.rowKey] : [])) },
    ...(spec.visual.pivot?.aggregation === 'count' ? { format: { unit:'个',decimals:0,percent:false },formatByKey:{[spec.visual.pivot.valKey]:{unit:'个',decimals:0,percent:false}} } : {}),
    chartType: 'table',
    showLegend: false,
    showValues: false,
  }),
};

const kpiDef: ChartTypeDefinition = {
  ...baseChart('kpi', '指标卡', { multiMetric: false, timeAxis: false, stacked: false }, ['y']),
  mapResult: (rows, columns, spec, compiled) => {
    const base = enrichCommon('kpi', rows, columns, spec, compiled);
    const yKey = base.yKeys[0] || columns[0] || '';
    const aggregation = spec.visual.aggregation;
    const first = aggregation && aggregation !== 'none' && base.rows?.length
      ? Object.fromEntries([...base.yKeys, ...(spec.visual.kpiBaselineKey ? [spec.visual.kpiBaselineKey] : [])].map(key => [key, aggregateChartValues(base.rows!, key, aggregation)]))
      : base.rows?.[0];
    const kpiValue = first ? toNumber(first[yKey]) : null;
    const cardKeys = base.yKeys;
    return {
      ...base,
      chartType: 'kpi',
      showLegend: false,
      kpiValue,
      kpiLabel: yKey,
      kpiUnit: base.format?.unit || base.unit,
      kpiCompare: buildKpiCompare(first, spec, base.formatByKey?.[yKey] || base.format || {}),
      kpiCards: buildKpiCards(first, cardKeys.length ? cardKeys : [yKey], base.format || {}, base.formatByKey),
    };
  },
  suitability: (_r, n) => (n <= 1 ? 95 : 10),
};

const counterDef: ChartTypeDefinition = {
  ...baseChart('counter', '计数器', { multiMetric: false, timeAxis: false, stacked: false }, ['y']),
  mapResult: (rows, cols, spec, compiled) => {
    const k = kpiDef.mapResult(rows, cols, spec, compiled);
    return { ...k, chartType: 'counter' };
  },
};

/** Funnel / waterfall / histogram / combo — Spec carries semantics; UI maps to bar/table where needed. */
const funnelDef: ChartTypeDefinition = {
  ...baseChart('funnel', '漏斗图', { multiMetric: false, timeAxis: false, stacked: false }),
  mapResult: (rows, cols, spec, compiled) => {
    const base = enrichCommon('funnel', rows, cols, spec, compiled);
    if (!base.rows?.length || !base.yKeys[0]) return base;
    if (base.hasNegative) return {...base,emptyState:'error' as const,emptyMessage:'漏斗阶段数量不能为负数；请选择柱状图展示正负变化'};
    const prepared = (base.cartesian?.labels || []).map((label, i) => ({
      [base.xKey]: label,
      [base.yKeys[0]]: base.cartesian?.series[0]?.values[i] ?? null,
    }));
    const { sliceLabels: shares } = computeSliceLabels(prepared, base.xKey, base.yKeys[0], base.format || {});
    const first = toNumber(prepared[0]?.[base.yKeys[0]]);
    const sliceLabels = shares.map((slice,index) => {
      const value = toNumber(prepared[index]?.[base.yKeys[0]]);
      const percent = first != null && first > 0 && value != null ? value/first*100 : 0;
      return {...slice,percent,label:`${formatValueBySpec(value,base.format)}, 较首阶段 ${first != null&&first>0&&value!=null?formatValueBySpec(percent,{percent:true,decimals:1}):'—'}`};
    });
    // Adjacent conversion rates (engine)
    const withConv = sliceLabels.map((s, i, arr) => {
      if (i === 0) return { ...s, label: `${s.key}\n${s.label}` };
      const prev = arr[i - 1].value;
      const current = toNumber(prepared[i]?.[base.yKeys[0]]);
      const conv = prev && current != null ? (current / prev) * 100 : null;
      const convTxt = conv === null ? '\n相邻转化 —' : `\n相邻转化 ${formatValueBySpec(conv, { unit: '%', percent: true, decimals: 1 })}`;
      return { ...s, label: `${s.key}\n${s.label}${convTxt}` };
    });
    return { ...base, sliceLabels: withConv, showValues: true, horizontal: true };
  },
};

const waterfallDef: ChartTypeDefinition = {
  ...baseChart('waterfall', '瀑布图', { multiMetric: true, timeAxis: false, stacked: false }),
  mapResult: (rows, cols, spec, compiled) => {
    const base = enrichCommon('waterfall', rows, cols, spec, compiled);
    const yKey = base.yKeys[0];
    const roleKey = spec.visual.waterfallRoleKey;
    if (roleKey && base.rows?.some(row => !['start', 'change', 'end', 'total'].includes(String(row[roleKey])))) {
      return { ...base, emptyState: 'error', emptyMessage: `瀑布节点角色字段 ${roleKey} 仅支持 start / change / end / total` };
    }
    if (roleKey && spec.visual.aggregation && spec.visual.aggregation !== 'none') {
      return { ...base, emptyState: 'error', emptyMessage: '显式瀑布节点角色需要保留全部记录，不能合并不同节点' };
    }
    if (base.missingValue === 'break' && base.rows?.some(row=>toNumber(row[yKey])==null)) return {...base,emptyState:'error' as const,emptyMessage:'瀑布节点包含空值或异常值，无法计算累计变化；请明确选择缺失值填充策略'};
    const prepared = base.cartesian?.labels.map((label,index)=>({[base.xKey]:label,[yKey]:base.cartesian?.series[0]?.values[index], ...(roleKey ? { [roleKey]: base.rows?.[index]?.[roleKey] } : {})}));
    const waterfall =
      base.rows?.length && yKey
        ? computeWaterfallSeries(prepared || base.rows, base.xKey, yKey, roleKey)
        : undefined;
    return {
      ...base,
      showValues: true,
      includeZero: true,
      labelMode: 'auto',
      waterfall,
    };
  },
};

const histogramDef: ChartTypeDefinition = {
  ...baseChart('histogram', '直方图', { multiMetric: false, timeAxis: false, stacked: false }),
  mapResult: (rows, cols, spec, compiled) => {
    const base = enrichCommon('histogram', rows, cols, spec, compiled);
    // Prefer raw measure column for binning; fall back to first yKey
    const valueKey = base.yKeys[0] || cols[0] || '';
    const binCount = spec.visual.binCount;
    const histogramValueMode = spec.visual.valueMode || 'absolute';
    if (spec.visual.binWidth != null && (!Number.isFinite(spec.visual.binWidth) || spec.visual.binWidth <= 0)) {
      return { ...base, emptyState: 'error', emptyMessage: '分箱宽度必须为正的有限数值' };
    }
    // If rows already look like pre-binned recipe output (区间范围 + 样本频次), keep as bar rows
    const looksPreBinned =
      !!base.xKey &&
      /区间|bin|bucket|range/i.test(base.xKey) &&
      base.rows?.some((r) => toNumber(r[base.yKeys[0]]) !== null);

    if (looksPreBinned && base.rows?.length) {
      if (base.rows.some(row=>{const value=toNumber(row[base.yKeys[0]]);return value==null||value<0||!Number.isInteger(value);})) return {...base,emptyState:'error' as const,emptyMessage:'直方图频数必须为非负整数'};
      const total = base.rows.reduce((s, r) => s + Math.abs(toNumber(r[base.yKeys[0]]) || 0), 0);
      const histogramBins = base.rows.map((r) => {
        const count = toNumber(r[base.yKeys[0]]) || 0;
        return {
          label: String(r[base.xKey] ?? ''),
          count,
          percent: total > 0 ? (count / total) * 100 : 0,
          from: Number(String(r[base.xKey] ?? '').split(/\s*(?:~|–)\s*/)[0]),
          to: Number(String(r[base.xKey] ?? '').split(/\s*(?:~|–)\s*/)[1]),
        };
      });
      return { ...base, showValues: true, chartType: 'histogram', histogramBins, histogramValueMode };
    }

    const histogramBins = computeHistogramBins(base.rows || [], valueKey, binCount, base.format, spec.visual.binWidth);
    if (base.emptyState === 'ok' && !histogramBins.length && spec.visual.binWidth != null) {
      return { ...base, emptyState: 'error', emptyMessage: '分箱宽度产生超过 200 个区间或超出数值范围，请增大分箱宽度' };
    }
    // Materialize bin rows so adapters can treat as bar-like when needed
    const binRows = histogramBins.map((b) => ({
      [base.xKey || '区间']: b.label,
      [base.yKeys[0] || '频次']: b.count,
      占比: b.percent,
    }));
    return {
      ...base,
      chartType: 'histogram',
      showValues: true,
      labelMode: 'auto',
      xKey: base.xKey || '区间',
      yKeys: [base.yKeys[0] || '频次'],
      rows: binRows.length ? binRows : base.rows,
      histogramBins,
      histogramValueMode,
      brushField: valueKey,
      emptyState: histogramBins.length ? 'ok' : base.emptyState,
    };
  },
};

const comboDef: ChartTypeDefinition = {
  ...baseChart('combo', '组合图', { multiMetric: true, timeAxis: true, stacked: false }),
  mapResult: (rows, cols, spec, compiled) => {
    const base = enrichCommon('combo', rows, cols, spec, compiled);
    const yRight = spec.visual.encoding?.yRight || base.yRightKeys || [];
    return {
      ...base,
      chartType: 'combo',
      yRightKeys: yRight,
      unitRight: base.unitRight,
      yRightAxisLabel: spec.visual.yRightAxisLabel || yRight[0],
    };
  },
};

const REGISTRY = new Map<ChartTypeId, ChartTypeDefinition>([
  ['bar', barDef],
  ['line', lineDef],
  ['area', areaDef],
  ['doughnut', doughnutDef],
  ['pie', pieDef],
  ['scatter', scatterDef],
  ['table', tableDef],
  ['kpi', kpiDef],
  ['counter', counterDef],
  ['funnel', funnelDef],
  ['waterfall', waterfallDef],
  ['histogram', histogramDef],
  ['combo', comboDef],
]);

export function registerChartType(def: ChartTypeDefinition): void {
  REGISTRY.set(def.id, def);
}

export function getChartType(id: ChartTypeId): ChartTypeDefinition {
  const def = REGISTRY.get(id);
  if (!def) {
    throw new Error(`未注册的图表类型: ${id}。请通过 chartRegistry.registerChartType 注册。`);
  }
  return def;
}

export function listChartTypes(): ChartTypeDefinition[] {
  return Array.from(REGISTRY.values());
}

export function mapResultToChartSpec(
  rows: Record<string, unknown>[],
  columns: string[],
  spec: AnalysisSpec,
  compiled: Pick<CompiledAnalysis, 'roles' | 'dimAliases' | 'metricAliases' | 'calcAliases'>,
): ChartSpec {
  const typeId = spec.visual.chartType || 'bar';
  const def = REGISTRY.get(typeId);
  const error = (message:string):ChartSpec => ({id:`${spec.id}_${typeId}`,title:spec.visual.title || spec.dataset.table,
    chartType:typeId,xKey:spec.visual.encoding?.x || '',yKeys:spec.visual.encoding?.y || [],emptyState:'error',emptyMessage:message});
  if (!def) return error(`不支持的图表类型: ${typeId}`);
  if (['kpi', 'counter'].includes(typeId) && spec.visual.kpiTarget != null && !Number.isFinite(spec.visual.kpiTarget)) return error('指标目标必须为有限数值');
  // Validate explicit result bindings once, before any renderer can reinterpret
  // a missing field or a text axis as a successful empty chart.
  if (rows.length) {
    const encoding = spec.visual.encoding || {};
    const bound = [def.requiredEncodings.includes('x') ? encoding.x : undefined,...(encoding.y || []),...(encoding.yRight || []),encoding.series,encoding.color,encoding.size,encoding.label,
      spec.visual.pivot?.rowKey,spec.visual.pivot?.colKey,spec.visual.pivot?.valKey,
      typeId === 'waterfall' ? spec.visual.waterfallRoleKey : undefined,
      ['kpi', 'counter'].includes(typeId) ? spec.visual.kpiBaselineKey : undefined].filter((key):key is string=>!!key);
    const missing = bound.filter(key=>!columns.includes(key));
    if (missing.length) return error(`绑定字段不存在: ${[...new Set(missing)].join('、')}`);
    if (typeId !== 'table' && (spec.visual.aggregation !== 'count' || typeId === 'scatter')) {
      const measures = pickY(spec, compiled.metricAliases, compiled.calcAliases, columns, compiled.dimAliases);
      const numeric = [typeId === 'scatter' ? encoding.x || pickX(spec, compiled.dimAliases, columns) : undefined,
        ...measures,...(encoding.yRight || []),typeId === 'scatter' ? encoding.size : undefined,
        ['kpi', 'counter'].includes(typeId) ? spec.visual.kpiBaselineKey : undefined].filter((key):key is string=>!!key);
      const invalid = numeric.filter(key=>rows.some(row=>row[key]!=null && toNumber(row[key])===null));
      if (invalid.length) return error(`${typeId === 'scatter' ? '散点' : '指标'}数值绑定需要有限数值: ${[...new Set(invalid)].join('、')}`);
    }
  }
  return def.mapResult(rows, columns, spec, compiled);
}

/** Bridge ChartSpec → ChartConfig — preserves semantic type; Chart Adapter maps to Chart.js ctor. */
export function chartSpecToChartConfig(chart: ChartSpec): ChartConfig {
  const type = chart.chartType as ChartType;

  return {
    id: chart.id,
    title: chart.title,
    type: chart.pivotTable ? 'pivot' : type,
    ...(chart.pivotTable ? {rowKey: chart.pivotTable.rowKey, colKey: chart.pivotTable.colKey, valKey: chart.pivotTable.valKey, aggFunc: chart.pivotTable.aggregation} : {}),
    xKey: chart.xKey,
    yKeys: chart.yKeys.length ? chart.yKeys : [''],
    yRightKeys: chart.yRightKeys,
    groupBy: chart.seriesKey,
    colors: chart.colors,
    colorKey: chart.colorKey,
    labelKey: chart.labelKey,
    showTrendLine: chart.showTrendLine,
    highlightOutliers: chart.highlightOutliers,
    sizeKey: chart.sizeKey,
    stacked: chart.stacked || chart.stackMode === 'stack' || chart.stackMode === 'percent',
    horizontal: chart.horizontal,
    showLegend: chart.showLegend ?? true,
    showValues: chart.showValues ?? false,
    unit: chart.unit,
    xAxisLabel: chart.xAxisLabel,
    yAxisLabel: chart.yAxisLabel,
    legendPosition: chart.legendPosition || 'bottom',
    legendAlign: chart.legendAlign || 'center',
    stackMode: chart.stackMode,
    missingValue: chart.missingValue,
    labelMode: chart.labelMode,
    includeZero: chart.includeZero,
    hasNegative: chart.hasNegative,
    format: chart.format,
    formatByKey: chart.formatByKey,
    unitRight: chart.unitRight,
    yRightAxisLabel: chart.yRightAxisLabel,
    sliceLabels: chart.sliceLabels,
    arcLabelWindow: chart.arcLabelWindow,
    centerTotal: chart.centerTotal,
    centerLabel: chart.centerLabel,
    brushField: chart.brushField,
    tooltipDims: chart.tooltipDims,
    emptyState: chart.emptyState,
    semanticType: type,
    histogramBins: chart.histogramBins,
    histogramValueMode: chart.histogramValueMode,
    waterfall: chart.waterfall,
    scatterPoints: chart.scatterPoints,
    kpiCards: chart.kpiCards,
    kpiValue: chart.kpiValue,
    kpiLabel: chart.kpiLabel,
    kpiUnit: chart.kpiUnit,
    kpiCompare: chart.kpiCompare,
  };
}

export function suggestChartType(
  roles: ColumnRoleMap,
  rowCount: number,
  preferred?: ChartTypeId,
): ChartTypeId {
  if (preferred && REGISTRY.has(preferred)) return preferred;
  let best: ChartTypeId = 'bar';
  let bestScore = -1;
  for (const def of REGISTRY.values()) {
    if (!def.suitability) continue;
    const s = def.suitability(roles, rowCount);
    if (s > bestScore) {
      bestScore = s;
      best = def.id;
    }
  }
  return best;
}

/** Recipe → ChartSpec encoding (UI must not invent encodings). */
export interface RecipeChartHint {
  recipeId: string;
  title?: string;
  chartType?: ChartTypeId;
  xKey?: string;
  yKeys?: string[];
}

const RECIPE_DEFAULTS: Record<string, { chartType: ChartTypeId; xKey: string; yKeys: string[] }> = {
  pareto: { chartType: 'bar', xKey: '实体标识', yKeys: ['贡献金额'] },
  rfm: { chartType: 'bar', xKey: 'RFM分层标签', yKeys: ['累计消费金额'] },
  iqr: { chartType: 'table', xKey: '', yKeys: [] },
  histogram: { chartType: 'histogram', xKey: '区间范围', yKeys: ['样本频次'] },
  cohort: { chartType: 'table', xKey: '初始群组月份', yKeys: ['活跃用户数'] },
};

export function mapRecipeResultToChartSpec(
  rows: Record<string, unknown>[],
  columns: string[],
  hint: RecipeChartHint,
): ChartSpec {
  const defaults = RECIPE_DEFAULTS[hint.recipeId] || {
    chartType: 'bar' as ChartTypeId,
    xKey: columns[0] || '',
    yKeys: columns.slice(1, 2),
  };
  const chartType = hint.chartType || defaults.chartType;
  const xKey = hint.xKey || defaults.xKey || columns[0] || '';
  const yKeys =
    hint.yKeys?.length
      ? hint.yKeys
      : defaults.yKeys.length
        ? defaults.yKeys
        : columns.filter((c) => c !== xKey).slice(0, 2);

  const fakeSpec = {
    id: `recipe_${hint.recipeId}`,
    version: 1 as const,
    dataset: { table: hint.recipeId },
    fields: [],
    dimensions: xKey ? [{ id: 'd0', column: xKey, alias: xKey }] : [],
    metrics: yKeys.map((y, i) => ({
      id: `m${i}`,
      column: y,
      agg: 'sum' as const,
      alias: y,
    })),
    calcs: [],
    filters: { global: [], cascade: [], interactive: [] },
    sort: [],
    visual: {
      chartType,
      title: hint.title || `${hint.recipeId} 分析`,
      encoding: { x: xKey || undefined, y: yKeys },
      showValues: true,
    },
  };

  const compiled = {
    roles: Object.fromEntries([
      ...(xKey ? [[xKey, 'dimension' as const]] : []),
      ...yKeys.map((y) => [y, 'metric' as const]),
    ]) as ColumnRoleMap,
    dimAliases: xKey ? [xKey] : [],
    metricAliases: yKeys,
    calcAliases: [] as string[],
  };

  return mapResultToChartSpec(rows, columns, fakeSpec as AnalysisSpec, compiled);
}
