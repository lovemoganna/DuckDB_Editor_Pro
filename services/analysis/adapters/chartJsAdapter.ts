/**
 * Chart Spec → Chart.js / KPI / Table adapter.
 * Sole bridge from engine ChartSpec to renderable bundles.
 * Components must not invent datasets, formats, or Chart.js constructors.
 */

import type { ChartConfig } from '../../../types';
import type { ChartSpec, ChartTypeId } from '../types';
import { axisTitleWithUnit, formatValueBySpec, inferChartUnit } from '../../../utils/chartFormat';
import { CHART_THEME } from '../../../utils/chartTheme';
import {
  getChartOptions,
  withBrushHandler,
} from '../../../utils/chartUtils';
import { chartSpecToChartConfig } from '../chartRegistry';
import { toNumber } from '../chartDisplay';

export type ChartJsCtor = 'bar' | 'line' | 'pie' | 'doughnut' | 'scatter';

export type AdaptedChartBundle =
  | {
      kind: 'empty';
      message: string;
    }
  | {
      kind: 'kpi';
      title: string;
      cards: NonNullable<ChartSpec['kpiCards']>;
      compare: NonNullable<ChartSpec['kpiCompare']>;
      format: ChartSpec['format'];
    }
  | {
      kind: 'table';
      columns: string[];
      measureKeys: string[];
      rows: Record<string, unknown>[];
      format: ChartSpec['format'];
      formatByKey: ChartSpec['formatByKey'];
      brushField?: string;
    }
  | {
      kind: 'canvas';
      chartJsType: ChartJsCtor;
      data: { labels: unknown[]; datasets: unknown[] };
      options: ReturnType<typeof getChartOptions>;
      brushLabels: string[];
      brushField?: string;
      semanticType: ChartTypeId;
    };

/** Map semantic ChartSpec type → Chart.js constructor. */
export function resolveChartJsCtor(chartType: ChartTypeId): ChartJsCtor | null {
  switch (chartType) {
    case 'bar':
    case 'funnel':
    case 'waterfall':
    case 'histogram':
    case 'combo':
      return 'bar';
    case 'line':
    case 'area':
      return 'line';
    case 'pie':
      return 'pie';
    case 'doughnut':
      return 'doughnut';
    case 'scatter':
      return 'scatter';
    default:
      return null;
  }
}

function configForCanvas(spec: ChartSpec): ChartConfig {
  const cfg = chartSpecToChartConfig(spec);
  // Chart.js options still key off a small set of types for scales/plugins
  const ctor = resolveChartJsCtor(spec.chartType);
  if (ctor === 'bar') {
    cfg.type = spec.chartType === 'combo' ? 'bar' : 'bar';
    if (spec.chartType === 'funnel') cfg.horizontal = true;
    if (spec.chartType === 'histogram') {
      const percent = spec.histogramValueMode === 'percent';
      cfg.showValues = true;
      cfg.labelMode = 'auto';
      cfg.xAxisLabel = spec.format?.unit
        ? `${spec.yKeys[0] || '数值'} (${spec.format.unit}) 区间`
        : `${spec.yKeys[0] || '数值'} 区间`;
      cfg.yAxisLabel = percent ? '占比' : '频数';
      cfg.unit = percent ? '%' : '个';
      cfg.format = { unit: cfg.unit, percent, decimals: percent ? 1 : 0, compact: false, thousandSeparator: true };
      cfg.formatByKey = Object.fromEntries(spec.yKeys.map(key => [key, cfg.format!]));
    }
  } else if (ctor === 'line') {
    cfg.type = spec.chartType === 'area' ? 'area' : 'line';
  } else if (ctor === 'pie' || ctor === 'doughnut' || ctor === 'scatter') {
    cfg.type = ctor;
  }
  return cfg;
}

function buildWaterfallData(spec: ChartSpec) {
  const wf = spec.waterfall;
  if (!wf) return null;
  const colors = wf.kinds.map((k) => {
    if (k === 'increase') return CHART_THEME.series[1];
    if (k === 'decrease') return CHART_THEME.series[0];
    return CHART_THEME.series[2];
  });
  return {
    labels: wf.labels,
    datasets: [
      {
        label: spec.yKeys[0] || '变动',
        data: wf.deltas.map((delta, i) => {
          if (wf.kinds[i] === 'total') return [0, delta];
          return wf.kinds[i] === 'decrease'
            ? [wf.bases[i] + delta, wf.bases[i]]
            : [wf.bases[i], wf.bases[i] + delta];
        }),
        backgroundColor: colors,
        borderColor: colors.map((c) => String(c).replace('0.8', '1')),
        borderWidth: 1,
        datalabels: { formatter: (_: unknown, ctx: { dataIndex: number }) =>
          formatValueBySpec(wf.kinds[ctx.dataIndex] === 'decrease' ? -wf.deltas[ctx.dataIndex] : wf.deltas[ctx.dataIndex], spec.format) },
      },
    ],
  };
}

function buildHistogramData(spec: ChartSpec) {
  const bins = spec.histogramBins;
  if (!bins?.length) return null;
  return {
    labels: bins.map((b) => b.label),
    datasets: [
      {
        label: spec.histogramValueMode === 'percent' ? '占比 (%)' : '频次',
        data: bins.map((b) => spec.histogramValueMode === 'percent' ? b.percent : b.count),
        backgroundColor: CHART_THEME.series[2],
        borderColor: String(CHART_THEME.series[2]).replace('0.8', '1'),
        borderWidth: 1,
        // stash percents for tooltip via sliceLabels-compatible map
      },
    ],
  };
}

function buildScatterData(spec: ChartSpec) {
  const series = spec.scatterSeries?.length ? spec.scatterSeries : [{ key: spec.yKeys[0] || 'Y', points: spec.scatterPoints || [] }];
  if (!series.some((s) => s.points.length)) return null;
  const units = [...new Set(series.map((s) => spec.formatByKey?.[s.key]?.unit || inferChartUnit(s.key) || spec.format?.unit || ''))];
  return {
    labels: [],
    datasets: series.map((s, i) => ({
      label: axisTitleWithUnit('label' in s ? s.label || s.key : s.key, spec.formatByKey?.[s.key]?.unit || inferChartUnit(s.key) || spec.format?.unit || ''),
      data: s.points.map((p) => ({ x: p.x, y: p.y, ...(p.r != null ? { r: p.r } : {}) })),
      yAxisID: units.indexOf(spec.formatByKey?.[s.key]?.unit || inferChartUnit(s.key) || spec.format?.unit || '') === 0
        ? 'y' : `y${units.indexOf(spec.formatByKey?.[s.key]?.unit || inferChartUnit(s.key) || spec.format?.unit || '')}`,
      backgroundColor: s.points.map(point => {const palette=spec.colors?.length?spec.colors:CHART_THEME.series;return palette[point.colorRatio!=null?Math.round(point.colorRatio*(palette.length-1)):i%palette.length];}),
      borderColor: String((spec.colors?.length ? spec.colors : CHART_THEME.series)[i % (spec.colors?.length || CHART_THEME.series.length)]).replace('0.8', '1'),
      showLine: 'trend' in s && !!s.trend,
      borderWidth: 'trend' in s && s.trend ? 2 : 1,
      borderDash: 'trend' in s && s.trend ? [5, 3] : undefined,
      pointRadius: (context: { dataIndex?: number; raw?: { r?: number } }) => 'trend' in s && s.trend ? 0 : context.raw?.r ?? 4,
      pointBorderColor: s.points.map(p => p.outlier ? CHART_THEME.series[0] : 'transparent'),
      pointBorderWidth: s.points.map(p => p.outlier ? 3 : 0),
    })),
  };
}

function buildCartesianData(spec: ChartSpec) {
  const prepared = spec.cartesian;
  if (!prepared) return { labels: [], datasets: [] };
  const isArc = spec.chartType === 'pie' || spec.chartType === 'doughnut';
  return {
    labels: prepared.displayLabels || prepared.labels,
    datasets: prepared.series.filter((s) => !isArc || s.axis === 'y').slice(0, isArc ? 1 : undefined).map((s, i) => {
      const palette = spec.colors?.length ? spec.colors : CHART_THEME.series;
      const color = palette[i % palette.length];
      return {
        label: spec.yRightKeys?.length ? axisTitleWithUnit(`${s.key} (${s.axis === 'y1' ? '右轴' : '左轴'})`, spec.formatByKey?.[s.measure]?.unit || '') : s.key,
        metricKey: s.measure,
        data: s.values,
        displayValues: spec.chartType === 'funnel' ? spec.sliceLabels?.map(slice => slice.label) : spec.chartType === 'histogram' ? spec.histogramBins?.map(bin => `${formatValueBySpec(bin.count, {unit:'个',decimals:0})}\n${formatValueBySpec(bin.percent,{percent:true,decimals:1})}`) : undefined,
        type: s.axis === 'y1' && spec.chartType === 'combo' ? 'line' as const : undefined,
        yAxisID: s.axis,
        backgroundColor: isArc ? prepared.labels.map((_, index) => palette[index % palette.length]) : color,
        borderColor: isArc ? CHART_THEME.bg : String(color).replace('0.8', '1'),
        borderWidth: s.axis === 'y1' ? 2 : 1,
        fill: spec.chartType === 'area',
        tension: 0.35,
        spanGaps: spec.missingValue !== 'break',
      };
    }),
  };
}

function enrichHistogramOptions(
  options: ReturnType<typeof getChartOptions>,
  spec: ChartSpec,
): ReturnType<typeof getChartOptions> {
  const bins = spec.histogramBins || [];
  if (spec.histogramValueMode === 'percent') {
    const axis = spec.horizontal ? 'x' : 'y';
    options.scales = { ...options.scales, [axis]: { ...options.scales?.[axis], min: 0, max: 100 } } as typeof options.scales;
  }
  const binMap = new Map(bins.map((b) => [b.label, b]));
  const prev = options.plugins.tooltip.callbacks.label;
  options.plugins.tooltip.callbacks.label = (ctx: {
    label?: string;
    raw?: unknown;
    dataset?: { label?: string };
  }) => {
    const bin = binMap.get(String(ctx.label || ''));
    if (bin) {
      return `${ctx.label}: ${formatValueBySpec(bin.count, { unit: '个', decimals: 0 })} (${formatValueBySpec(bin.percent, { percent: true, decimals: 1 })})`;
    }
    return typeof prev === 'function' ? (prev as (c: typeof ctx) => string)(ctx) : String(ctx.raw);
  };
  // Surface bin percent as pie-like labels via datalabels formatter override
  if (options.plugins.datalabels && typeof options.plugins.datalabels === 'object') {
    const dl = options.plugins.datalabels as {
      formatter?: (v: unknown, ctx: { dataIndex?: number; chart?: { data?: { labels?: unknown[] } } }) => string;
      display?: unknown;
    };
    dl.formatter = (_v, ctx) => {
      const label = String(ctx.chart?.data?.labels?.[ctx.dataIndex ?? 0] ?? '');
      const bin = binMap.get(label);
      if (!bin) return '';
      return `${formatValueBySpec(bin.count, { unit: '个', decimals: 0 })}\n${formatValueBySpec(bin.percent, { percent: true, decimals: 1 })}`;
    };
  }
  return options;
}

function enrichScatterOptions(
  options: ReturnType<typeof getChartOptions>,
  spec: ChartSpec,
): ReturnType<typeof getChartOptions> {
  const series = spec.scatterSeries?.length ? spec.scatterSeries : [{ key: spec.yKeys[0] || 'Y', points: spec.scatterPoints || [] }];
  const dims = spec.columns || spec.tooltipDims || [];
  options.plugins.tooltip.callbacks.label = (ctx: {
    raw?: unknown;
    dataIndex?: number;
    datasetIndex?: number;
    dataset?: { label?: string };
  }) => {
    const item = series[ctx.datasetIndex ?? 0] || series[0];
    const key = item?.key || spec.yKeys[0] || 'Y';
    const pt = item?.points[ctx.dataIndex ?? 0];
    if (!pt) return String(ctx.raw ?? '');
    const lines: string[] = [
      `${spec.xKey}: ${formatValueBySpec(pt.x, spec.formatByKey?.[spec.xKey])}`,
      `${key}: ${formatValueBySpec(pt.y, spec.formatByKey?.[key] || spec.format)}`,
    ];
    if (pt.outlier) lines.push('异常点：趋势残差超出四分位距范围');
    if (pt.raw && dims.length) {
      for (const d of dims) {
        if (d === spec.xKey || d === key) continue;
        const v = pt.raw[d];
        if (v == null) { lines.push(`${d}: —`); continue; }
        lines.push(
          `${d}: ${typeof v === 'number' ? formatValueBySpec(v, spec.formatByKey?.[d] || { unit: inferChartUnit(d) }) : String(v)}`,
        );
      }
    }
    return lines.join(' · ');
  };
  // Scatter uses linear scales on both axes
  if (options.scales && 'x' in options.scales) {
    const xScale = (options.scales as { x: { type?: string; ticks?: { callback?: unknown }; title?: { display?: boolean; text?: string } } }).x;
    xScale.type = 'linear';
    xScale.ticks = {
      ...xScale.ticks,
      callback: (value: number) => formatValueBySpec(value, spec.formatByKey?.[spec.xKey] || { unit: inferChartUnit(spec.xKey) }),
    };
    xScale.title = {
      display: true,
      text: axisTitleWithUnit(spec.xAxisLabel || spec.xKey, spec.formatByKey?.[spec.xKey]?.unit || inferChartUnit(spec.xKey) || ''),
    };
    const units = [...new Set(series.map((s) => spec.formatByKey?.[s.key]?.unit || inferChartUnit(s.key) || spec.format?.unit || ''))];
    const scales = options.scales as unknown as Record<string, unknown>;
    units.slice(1).forEach((unit, index) => {
      const key = `y${index + 1}`;
      scales[key] = {
        type: 'linear', position: 'right', display: true, offset: index > 0,
        grid: { drawOnChartArea: false },
        ticks: { callback: (value: number) => formatValueBySpec(value, { unit }) },
        title: { display: true, text: axisTitleWithUnit(series.find((s) =>
          (spec.formatByKey?.[s.key]?.unit || inferChartUnit(s.key) || spec.format?.unit || '') === unit)?.key, unit) },
      };
    });
  }
  return options;
}

function enrichWaterfallOptions(
  options: ReturnType<typeof getChartOptions>,
  spec: ChartSpec,
): ReturnType<typeof getChartOptions> {
  options.scales = {
    ...options.scales,
    x: {
      ...(options.scales as { x: object }).x,
      stacked: true,
    },
    y: {
      ...(options.scales as { y: object }).y,
      stacked: true,
      beginAtZero: true,
    },
  } as typeof options.scales;
  options.plugins.tooltip.callbacks.label = (ctx: { dataIndex?: number; raw?: unknown }) => {
    const index = ctx.dataIndex ?? 0;
    const delta = spec.waterfall?.deltas[index] ?? 0;
    const signed = spec.waterfall?.kinds[index] === 'decrease' ? -delta : delta;
    const wf = spec.waterfall;
    const current = wf?.kinds[index] === 'decrease' ? wf.bases[index] : (wf?.bases[index] ?? 0) + delta;
    const role = wf?.roles?.[index];
    const roleLabel = role === 'start' ? '起点' : role === 'end' ? '终点' : role === 'total' ? '总量' : '变化量';
    return `${roleLabel} · ${spec.yKeys[0] || '变动'}: ${formatValueBySpec(signed, spec.format)} · 当前值 / 累计值: ${formatValueBySpec(current, spec.format)}`;
  };
  return options;
}

/**
 * Adapt a ChartSpec into a renderable bundle.
 * Optional brush handler is attached for canvas charts.
 */
export function adaptChartSpec(
  spec: ChartSpec,
  opts?: {
    onBrush?: (field: string, value: string | number) => void;
    hideTitle?: boolean;
  },
): AdaptedChartBundle {
  if (spec.emptyState === 'empty' || spec.emptyState === 'all_null' || spec.emptyState === 'error') {
    return {
      kind: 'empty',
      message: spec.emptyMessage || '暂无可视化数据',
    };
  }

  if (spec.chartType === 'kpi' || spec.chartType === 'counter') {
    const cards =
      spec.kpiCards?.length
        ? spec.kpiCards
        : [
            {
              key: spec.kpiLabel || 'value',
              label: spec.kpiLabel || spec.title,
              value: typeof spec.kpiValue === 'number' ? spec.kpiValue : toNumber(spec.kpiValue),
              formatted: formatValueBySpec(spec.kpiValue, {
                ...spec.format,
                unit: spec.kpiUnit || spec.format?.unit,
              }),
              unit: spec.kpiUnit || spec.format?.unit,
            },
          ];
    return {
      kind: 'kpi',
      title: spec.title,
      cards,
      compare: spec.kpiCompare || [],
      format: spec.format,
    };
  }

  if (spec.chartType === 'table') {
    return {
      kind: 'table',
      columns: spec.columns || [],
      measureKeys: spec.yKeys,
      rows: spec.rows || [],
      format: spec.format,
      formatByKey: spec.formatByKey,
      brushField: spec.brushField || spec.xKey,
    };
  }

  const ctor = resolveChartJsCtor(spec.chartType);
  if (!ctor) {
    return { kind: 'empty', message: `不支持的图表类型: ${spec.chartType}` };
  }

  const cfg = configForCanvas(spec);
  let data: { labels: unknown[]; datasets: unknown[] };

  if (spec.chartType === 'waterfall' && spec.waterfall) {
    data = buildWaterfallData(spec) || buildCartesianData(spec);
  } else if (spec.chartType === 'histogram' && spec.histogramBins?.length) {
    data = buildHistogramData(spec) || buildCartesianData(spec);
  } else if (spec.chartType === 'scatter' && spec.scatterSeries?.some((s) => s.points.length)) {
    data = buildScatterData(spec) || buildCartesianData(spec);
  } else {
    data = buildCartesianData(spec);
  }

  let options = getChartOptions(cfg);
  if (opts?.hideTitle && options.plugins?.title) {
    options.plugins.title.display = false;
  }

  if (spec.chartType === 'histogram') options = enrichHistogramOptions(options, spec);
  if (spec.chartType === 'scatter') options = enrichScatterOptions(options, spec);
  if (spec.chartType === 'waterfall') options = enrichWaterfallOptions(options, spec);

  // Funnel: use engine sliceLabels as bar end labels when present
  if (spec.chartType === 'funnel' && spec.sliceLabels?.length) {
    const map = new Map(spec.sliceLabels.map((s) => [s.key, s]));
    if (options.plugins.datalabels && typeof options.plugins.datalabels === 'object') {
      const dl = options.plugins.datalabels as {
        formatter?: (v: unknown, ctx: { chart?: { data?: { labels?: unknown[] } }; dataIndex?: number }) => string;
      };
      dl.formatter = (v, ctx) => {
        const label = String(ctx.chart?.data?.labels?.[ctx.dataIndex ?? 0] ?? '');
        const slice = map.get(label);
        return slice?.label || formatValueBySpec(v, spec.format);
      };
    }
    options.plugins.tooltip.callbacks.label = (ctx:{dataIndex?:number}) => spec.sliceLabels?.[ctx.dataIndex??0]?.label || '';
  }

  const brushLabels = (['histogram', 'waterfall'].includes(spec.chartType) ? data.labels : spec.cartesian?.labels || data.labels || []).map(String);
  if (opts?.onBrush) {
    const field = spec.brushField || spec.xKey;
    if (spec.chartType === 'scatter') {
      options.onClick = (_evt: unknown, elements: Array<{ index: number; datasetIndex?: number }>) => {
        const hit = elements[0];
        const series = spec.scatterSeries?.[hit?.datasetIndex ?? 0];
        const point = series?.points[hit?.index ?? -1];
        if (point) {
          const value = point.raw?.[field] ?? (field === spec.xKey ? point.x : undefined);
          if (typeof value === 'string' || typeof value === 'number') opts.onBrush?.(field, value);
        }
      };
    } else {
      options = withBrushHandler(options, brushLabels, (v) => opts.onBrush?.(field, v));
    }
  }

  return {
    kind: 'canvas',
    chartJsType: ctor,
    data,
    options,
    brushLabels,
    brushField: spec.brushField || spec.xKey,
    semanticType: spec.chartType,
  };
}
