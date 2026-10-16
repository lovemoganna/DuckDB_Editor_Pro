/**
 * Workbench form configs → AnalysisSpec.
 * Pivot / TimeSeries UI builds these lightweight configs, then compiles via the kernel.
 */

import type { AnalysisAgg, AnalysisSpec, CalcDef, ChartTypeId, DateTruncGrain, FilterOp } from '../types';
import { createEmptySpec, emptyFilters } from '../types';

export interface PivotDimension {
  column: string;
  dateTrunc?: DateTruncGrain;
}

export interface PivotMetric {
  column?: string;
  agg: AnalysisAgg;
  alias: string;
  decimals?: number;
}

export interface PivotFilter {
  column: string;
  op: FilterOp;
  value: string;
}

export interface PivotQueryConfig {
  tableName: string;
  rowDimensions: PivotDimension[];
  metrics: PivotMetric[];
  filters?: PivotFilter[];
  sortMetric?: string;
  sortOrder?: 'asc' | 'desc';
  limit: number;
}

export interface TimeSeriesConfig {
  tableName: string;
  timeColumn: string;
  granularity: DateTruncGrain;
  valueColumn: string;
  aggFunc: Exclude<AnalysisAgg, 'count_distinct'>;
  windowMode: 'raw' | 'mom' | 'moving_avg' | 'cumulative';
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Workbench UI form → AnalysisSpec (same kernel, no second engine). */
export function pivotConfigToSpec(
  config: PivotQueryConfig,
  options?: { chartType?: ChartTypeId; title?: string },
): AnalysisSpec {
  const dimensions = config.rowDimensions.map((d, i) => ({
    id: `dim_${i}`,
    column: d.column,
    dateTrunc: d.dateTrunc,
    alias: d.dateTrunc ? `${d.column}_${d.dateTrunc}` : d.column,
  }));

  const metrics = config.metrics.map((m, i) => ({
    id: `m_${i}`,
    column: m.column,
    agg: m.agg,
    alias: m.alias,
  }));

  const globalFilters = (config.filters || []).map((f, i) => ({
    id: `gf_${i}`,
    column: f.column,
    op: f.op,
    value: f.value,
  }));

  const sort =
    config.sortMetric
      ? [{ by: config.sortMetric, order: (config.sortOrder || 'desc') as 'asc' | 'desc' }]
      : metrics[0]
        ? [{ by: metrics[0].alias, order: 'desc' as const }]
        : [];

  return createEmptySpec({
    id: uid('pivot'),
    dataset: { table: config.tableName },
    fields: [],
    dimensions,
    metrics,
    calcs: [],
    filters: {
      ...emptyFilters(),
      global: globalFilters,
    },
    sort,
    topN:
      config.limit > 0
        ? { n: config.limit, by: config.sortMetric || metrics[0]?.alias || '' }
        : undefined,
    visual: {
      chartType: options?.chartType || 'bar',
      title: options?.title || `${config.tableName} 多维聚合`,
    },
  });
}

export function timeSeriesConfigToSpec(
  config: TimeSeriesConfig,
  options?: { chartType?: ChartTypeId; title?: string },
): AnalysisSpec {
  const valueAlias =
    config.aggFunc === 'count' ? '记录数' : `${config.aggFunc}_${config.valueColumn}`;

  const calcs: CalcDef[] = [];
  if (config.windowMode === 'mom') {
    calcs.push({
      id: 'mom',
      kind: 'mom',
      alias: '环比%',
      sourceMetricId: valueAlias,
    });
  } else if (config.windowMode === 'moving_avg') {
    calcs.push({
      id: 'ma',
      kind: 'moving',
      alias: '移动平均',
      sourceMetricId: valueAlias,
      windowSize: 7,
      movingAgg: 'avg',
    });
  } else if (config.windowMode === 'cumulative') {
    calcs.push({
      id: 'cum',
      kind: 'cumulative',
      alias: '累计',
      sourceMetricId: valueAlias,
    });
  }

  return createEmptySpec({
    id: uid('ts'),
    dataset: { table: config.tableName },
    fields: [],
    dimensions: [
      {
        id: 'time',
        column: config.timeColumn,
        dateTrunc: config.granularity,
        alias: `${config.timeColumn}_${config.granularity}`,
      },
    ],
    metrics: [
      {
        id: 'm0',
        column: config.valueColumn,
        agg: config.aggFunc === 'count' ? 'count' : config.aggFunc,
        alias: valueAlias,
      },
    ],
    calcs,
    filters: {
      ...emptyFilters(),
      global: [
        {
          id: 'time_not_null',
          column: config.timeColumn,
          op: 'not_null',
        },
      ],
    },
    sort: [
      {
        by: `${config.timeColumn}_${config.granularity}`,
        order: 'asc',
      },
    ],
    visual: {
      chartType: options?.chartType || 'line',
      title:
        options?.title ||
        `${config.tableName} 时序走势 (${config.windowMode.toUpperCase()})`,
    },
  });
}
