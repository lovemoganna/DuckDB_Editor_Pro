/**
 * Dashboard widget adapter: ChartConfig + query rows → ChartSpec via analysis Registry.
 * Home / Dashboard widgets must not invent encoding or recompute %.
 */

import type { ChartConfig, ChartType } from '../../../types';
import type { AnalysisSpec, ChartSpec, ChartTypeId } from '../types';
import { createEmptySpec, emptyFilters } from '../types';
import { mapResultToChartSpec, chartSpecToChartConfig } from '../chartRegistry';
import { sanitizeAlias } from '../sqlUtils';

function toChartTypeId(type: ChartType): ChartTypeId {
  if (type === 'counter' || type === 'kpi') return 'kpi';
  if (type === 'pivot' || type === 'table') return 'table';
  return type as ChartTypeId;
}

function inferColumns(rows: Record<string, unknown>[], config: ChartConfig): string[] {
  if (rows.length > 0) return Object.keys(rows[0]);
  const cols = [config.xKey, ...(config.yKeys || []), ...(config.yRightKeys || []), config.groupBy]
    .filter(Boolean) as string[];
  return [...new Set(cols)];
}

/**
 * Build AnalysisSpec + ChartSpec from a dashboard widget's ChartConfig and result rows.
 */
export function widgetRowsToChartSpec(
  rows: Record<string, unknown>[],
  config: ChartConfig,
  opts?: { table?: string; title?: string },
): ChartSpec {
  const columns = inferColumns(rows, config);
  const chartType = toChartTypeId(config.type);
  const xKey = config.xKey || columns[0] || '';
  let yKeys = (config.yKeys || []).filter(Boolean);
  if (yKeys.length === 0) {
    yKeys = columns.filter((c) => c !== xKey).slice(0, 3);
  }
  if (yKeys.length === 0 && columns[0]) {
    yKeys = [columns[0]];
  }
  const formatByKey = { ...config.formatByKey };
  if (chartType === 'table') {
    // A unit on one measure must never turn order counts or identifiers into percentages.
    for (const column of columns) {
      if (!formatByKey[column] && !yKeys.includes(column)) {
        const numeric = rows.some(row => typeof row[column] === 'number' || typeof row[column] === 'bigint' || row[column] instanceof Uint8Array);
        formatByKey[column] = numeric ? {
          unit: '', percent: false, compact: false, thousandSeparator: true,
          decimals: /^(orders|completed|records|counts?|confirmations)$/i.test(column) ? 0 : 8,
        } : { unit: '', percent: false };
      }
    }
  }

  const showValuesDefault =
    config.showValues ??
    (['bar', 'pie', 'doughnut', 'histogram', 'funnel', 'waterfall'].includes(config.type) ||
      chartType === 'bar' ||
      chartType === 'pie' ||
      chartType === 'doughnut');

  const spec: AnalysisSpec = createEmptySpec({
    id: `widget_${config.id || 'chart'}`,
    dataset: { table: opts?.table || '_dashboard_widget' },
    dimensions: xKey
      ? [{ id: 'd0', column: xKey, alias: sanitizeAlias(xKey) }]
      : [{ id: 'd0', column: columns[0] || 'x', alias: columns[0] || 'x' }],
    metrics: yKeys.map((y, i) => ({
      id: `m${i}`,
      column: y,
      agg: 'sum' as const,
      alias: sanitizeAlias(y),
      unitHint: config.unit || config.format?.unit,
    })),
    fields: columns.map((c) => ({ column: c })),
    linkage: { listen: [], emit: [], brushField: config.brushField || xKey },
    calcs: [],
    filters: emptyFilters(),
    visual: {
      chartType,
      title: opts?.title || config.title,
      encoding: {
        x: xKey || undefined,
        y: yKeys,
        yRight: config.yRightKeys,
        series: config.groupBy,
        color: config.colorKey || config.groupBy,
        label: config.labelKey,
        size: config.sizeKey,
      },
      stacked: config.stacked,
      stackMode: config.stackMode || (config.stacked ? 'stack' : 'none'),
      horizontal: config.horizontal,
      showValues: showValuesDefault,
      showLegend: config.showLegend,
      legendPosition: config.legendPosition,
      legendAlign: config.legendAlign,
      labelMode: config.labelMode,
      xAxisLabel: config.xAxisLabel,
      yAxisLabel: config.yAxisLabel,
      yRightAxisLabel: config.yRightAxisLabel,
      missingValue: config.missingValue || 'break',
      aggregation: config.aggregation,
      categorySort: config.categorySort,
      valueMode: config.valueMode,
      colors: config.colors,
      showTrendLine: config.showTrendLine,
      pivot: config.type === 'pivot' ? { rowKey: config.rowKey || xKey, colKey: config.colKey || '', valKey: config.valKey || yKeys[0], aggregation: config.aggFunc || 'sum' } : undefined,
      highlightOutliers: config.highlightOutliers,
      topN: config.topN,
      format: config.format || {
        unit: config.unit,
        compact: true,
        thousandSeparator: true,
      },
      formatByKey: formatByKey as AnalysisSpec['visual']['formatByKey'],
      unitRight: config.unitRight,
      binCount: config.binCount,
      binWidth: config.binWidth,
      waterfallRoleKey: config.waterfallRoleKey,
      kpiBaselineKey: config.kpiBaselineKey,
      kpiTarget: config.kpiTarget,
    },
  });

  const dimAliases = spec.dimensions.map((d) => d.alias || d.column);
  const metricAliases = spec.metrics.map((m) => m.alias);
  const compiled = {
    roles: Object.fromEntries([
      ...dimAliases.map((a) => [a, 'dimension' as const]),
      ...metricAliases.map((a) => [a, 'metric' as const]),
    ]),
    dimAliases,
    metricAliases,
    calcAliases: [] as string[],
  };

  // Align row keys to aliases when physical === alias
  const normalizedRows = rows.map((r) => {
    const out: Record<string, unknown> = { ...r };
    for (const d of spec.dimensions) {
      if (d.alias && d.alias !== d.column && out[d.alias] === undefined && out[d.column] !== undefined) {
        out[d.alias] = out[d.column];
      }
    }
    for (const m of spec.metrics) {
      if (m.alias !== m.column && m.column && out[m.alias] === undefined && out[m.column] !== undefined) {
        out[m.alias] = out[m.column];
      }
    }
    return out;
  });

  return mapResultToChartSpec(normalizedRows, columns, spec, compiled);
}

/** Enriched ChartConfig for getChartOptions — merges Spec display fields with user config. */
export function enrichWidgetChartConfig(
  rows: Record<string, unknown>[],
  config: ChartConfig,
  opts?: { table?: string; title?: string },
): { chartSpec: ChartSpec; chartConfig: ChartConfig } {
  const chartSpec = widgetRowsToChartSpec(rows, config, opts);
  const fromSpec = chartSpecToChartConfig(chartSpec);
  const chartConfig: ChartConfig = {
    ...fromSpec,
    ...config,
    // Spec-driven display wins for computed fields
    showValues: chartSpec.showValues ?? config.showValues,
    labelMode: chartSpec.labelMode || config.labelMode || (chartSpec.showValues ? 'auto' : 'never'),
    legendPosition: config.legendPosition || chartSpec.legendPosition || 'bottom',
    legendAlign: config.legendAlign || chartSpec.legendAlign || 'center',
    stackMode: config.stackMode || chartSpec.stackMode,
    missingValue: config.missingValue || chartSpec.missingValue || 'break',
    includeZero: chartSpec.includeZero,
    hasNegative: chartSpec.hasNegative,
    format: config.format || chartSpec.format,
    formatByKey: config.formatByKey || chartSpec.formatByKey,
    sliceLabels: chartSpec.sliceLabels,
    centerTotal: chartSpec.centerTotal,
    centerLabel: chartSpec.centerLabel,
    unit: config.unit || chartSpec.unit,
    unitRight: config.unitRight || chartSpec.unitRight,
    yRightKeys: config.yRightKeys || chartSpec.yRightKeys,
    yRightAxisLabel: config.yRightAxisLabel || chartSpec.yRightAxisLabel,
    brushField: chartSpec.brushField || config.xKey,
    tooltipDims: chartSpec.tooltipDims,
    emptyState: chartSpec.emptyState,
    histogramBins: chartSpec.histogramBins,
    waterfall: chartSpec.waterfall,
    scatterPoints: chartSpec.scatterPoints,
    kpiCards: chartSpec.kpiCards,
    kpiValue: chartSpec.kpiValue,
    kpiLabel: chartSpec.kpiLabel,
    kpiUnit: chartSpec.kpiUnit,
    kpiCompare: chartSpec.kpiCompare,
    xAxisLabel: config.xAxisLabel || chartSpec.xAxisLabel,
    yAxisLabel: config.yAxisLabel || chartSpec.yAxisLabel,
  };
  return { chartSpec, chartConfig };
}
