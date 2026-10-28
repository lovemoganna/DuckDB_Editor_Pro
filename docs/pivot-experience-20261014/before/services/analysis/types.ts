/**
 * Unified Analysis Spec — single contract for Dataset → SQL → Result → Chart.
 * UI and AI mutate Spec only; compilers produce SQL / ChartSpec.
 */

import type { FieldRole, MetricAgg } from '../../types/analyticalCatalog';
import type { ChartConfig, ChartType } from '../../types';

export type AnalysisAgg = MetricAgg; // sum | avg | count | count_distinct | min | max

export type DateTruncGrain = 'day' | 'week' | 'month' | 'quarter' | 'year';

export type FilterOp =
  | '='
  | '!='
  | '>'
  | '>='
  | '<'
  | '<='
  | 'contains'
  | 'in'
  | 'not_null'
  | 'is_null';

export type ChartTypeId =
  | ChartType
  | 'table'
  | 'kpi'
  | 'funnel'
  | 'waterfall'
  | 'histogram'
  | 'combo';

export type ColumnRole = 'dimension' | 'metric' | 'calc' | 'other';

/** How missing / null measure points are rendered on line/area (engine decides, chart only applies). */
export type MissingValuePolicy = 'break' | 'zero' | 'forward_fill';

/** Stack mode for bar/area — percent stack Y is always 0–100. */
export type StackMode = 'none' | 'stack' | 'percent';

/** Unified value formatting — Tooltip / Label / Axis share one Spec. */
export interface ValueFormatSpec {
  unit?: string;
  /** Compact 12.4K / 1.2M when |v| >= compactThreshold */
  compact?: boolean;
  compactThreshold?: number;
  decimals?: number;
  percent?: boolean;
  thousandSeparator?: boolean;
  prefix?: string;
  suffix?: string;
}

export interface DatasetRef {
  /** Optional analysis context (database / schema / project id) */
  contextId?: string;
  /** Physical table or view name (single-table datasets) */
  table: string;
}

export interface FieldRef {
  column: string;
  physicalType?: string;
  role?: FieldRole;
  unitHint?: string;
  defaultAgg?: AnalysisAgg;
}

export interface DimBinding {
  id: string;
  column: string;
  dateTrunc?: DateTruncGrain;
  /** Dynamic dimension slot — resolved before compile */
  dynamic?: boolean;
  alias?: string;
}

export interface MetricBinding {
  id: string;
  /** Physical column; omit for COUNT(*) */
  column?: string;
  agg: AnalysisAgg;
  alias: string;
  /** Reference a CalcDef id instead of raw agg */
  calcId?: string;
  unitHint?: string;
}

export type CalcKind =
  | 'expr'
  | 'ratio'
  | 'yoy'
  | 'mom'
  | 'cumulative'
  | 'rank'
  | 'moving'
  | 'lod_fixed'
  | 'lod_include'
  | 'lod_exclude';

export interface CalcDef {
  id: string;
  kind: CalcKind;
  alias: string;
  /** For expr: validated scalar expression referencing columns */
  expression?: string;
  /** Source metric id or alias for window / ratio / period calcs */
  sourceMetricId?: string;
  /** Denominator metric id for ratio; omit = grand total of source */
  denominatorMetricId?: string;
  /** Rank: 'rank' | 'dense_rank' | 'row_number' */
  rankFn?: 'rank' | 'dense_rank' | 'row_number';
  rankOrder?: 'asc' | 'desc';
  partitionBy?: string[];
  /** Moving window size (periods) */
  windowSize?: number;
  movingAgg?: 'avg' | 'sum';
  /** LOD dimension columns */
  lodDimensions?: string[];
  /** Measure column + agg for LOD */
  lodColumn?: string;
  lodAgg?: AnalysisAgg;
}

export interface FilterClause {
  id?: string;
  column: string;
  op: FilterOp;
  value?: string | number | Array<string | number>;
}

export interface CascadeFilter {
  parentColumn: string;
  childColumn: string;
  parentValue?: string | number;
}

export interface SortClause {
  by: string;
  order: 'asc' | 'desc';
}

export interface TopNConfig {
  n: number;
  by: string;
  othersBucket?: boolean;
}

export interface EncodingHint {
  x?: string;
  y?: string[];
  /** Right Y axis series (combo / dual-axis) */
  yRight?: string[];
  series?: string;
  color?: string;
  size?: string;
  label?: string;
}

export interface VisualConfig {
  chartType: ChartTypeId;
  title?: string;
  encoding?: EncodingHint;
  stacked?: boolean;
  /** Prefer stackMode; stacked=true maps to 'stack' */
  stackMode?: StackMode;
  horizontal?: boolean;
  showValues?: boolean;
  showLegend?: boolean;
  legendPosition?: 'top' | 'bottom' | 'left' | 'right';
  legendAlign?: 'start' | 'center' | 'end';
  labelMode?: 'auto' | 'always' | 'never';
  xAxisLabel?: string;
  yAxisLabel?: string;
  yRightAxisLabel?: string;
  missingValue?: MissingValuePolicy;
  format?: ValueFormatSpec;
  formatByKey?: Record<string, ValueFormatSpec>;
  unitRight?: string;
  kpiCompareKeys?: string[];
  binCount?: number;
  binWidth?: number;
  waterfallRoleKey?: string;
  kpiBaselineKey?: string;
  kpiTarget?: number;
  showTrendLine?: boolean;
  highlightOutliers?: boolean;
  pivot?: { rowKey: string; colKey: string; valKey: string; aggregation: 'sum' | 'count' | 'avg' | 'min' | 'max' };
  /** Aggregation for duplicate categories in an already fetched result. */
  aggregation?: 'none' | 'count' | 'sum' | 'avg' | 'min' | 'max';
  valueMode?: 'absolute' | 'percent';
  colors?: string[];
  categorySort?: 'none' | 'label_asc' | 'label_desc' | 'value_asc' | 'value_desc';
  topN?: number;
}

export interface LinkageConfig {
  listen: string[];
  emit: string[];
  brushField?: string;
}

export interface DrillConfig {
  path: string[];
  currentLevel: number;
}

export interface AnalysisFilters {
  global: FilterClause[];
  cascade: CascadeFilter[];
  interactive: FilterClause[];
}

export interface AnalysisSpec {
  id: string;
  version: 1;
  dataset: DatasetRef;
  fields: FieldRef[];
  dimensions: DimBinding[];
  metrics: MetricBinding[];
  calcs: CalcDef[];
  filters: AnalysisFilters;
  sort: SortClause[];
  topN?: TopNConfig;
  visual: VisualConfig;
  linkage?: LinkageConfig;
  drill?: DrillConfig;
}

/** AI emits this subset; normalize → AnalysisSpec */
export interface AnalysisIntent {
  table: string;
  dimensions?: Array<{ column: string; dateTrunc?: DateTruncGrain; alias?: string }>;
  metrics?: Array<{
    column?: string;
    agg?: AnalysisAgg;
    alias?: string;
    calcId?: string;
  }>;
  calcs?: CalcDef[];
  filters?: FilterClause[];
  sort?: SortClause[];
  topN?: TopNConfig;
  chartType?: ChartTypeId;
  title?: string;
  contextId?: string;
}

export interface ColumnRoleMap {
  [alias: string]: ColumnRole;
}

/** Structured LOD FIXED join — replaces fragile `__LOD_JOIN__:` string protocol */
export interface LodJoinMeta {
  cteName: string;
  alias: string;
  /** Dimension aliases on the aggregated grain to join on */
  joinKeys: string[];
}

export interface CompiledAnalysis {
  sql: string;
  roles: ColumnRoleMap;
  dimAliases: string[];
  metricAliases: string[];
  calcAliases: string[];
}

/** Brush / cascade / drill event for multi-chart linkage (Spec-only, no UI board). */
export type LinkageEvent =
  | { type: 'brush'; field: string; values: Array<string | number> }
  | { type: 'cascade'; parentColumn: string; childColumn: string; parentValue?: string | number }
  | { type: 'drill'; dimValue: string | number }
  | { type: 'global_filter'; clause: FilterClause }
  | { type: 'clear_brush' };

export interface ChartSpec {
  id: string;
  title: string;
  chartType: ChartTypeId;
  xKey: string;
  yKeys: string[];
  /** Prepared by the analysis engine; render adapters only assign visual styles. */
  cartesian?: {
    labels: string[];
    displayLabels?: string[];
    series: Array<{ key: string; measure: string; values: Array<number | null>; axis: 'y' | 'y1' }>;
  };
  arcLabelWindow?: { from:number; to:number };
  /** Dual-axis right series */
  pivotTable?: { rowKey: string; colKey: string; valKey: string; rowValues: string[]; colValues: string[];
    aggregation: 'sum'|'count'|'avg'|'min'|'max';
    matrix: Record<string, Record<string, number>>; rowTotals: Record<string, number>; colTotals: Record<string, number>; grandTotal: number; grandCount: number };
  yRightKeys?: string[];
  seriesKey?: string;
  colorKey?: string;
  labelKey?: string;
  colorScale?: { field:string; min:number; max:number };
  showTrendLine?: boolean;
  highlightOutliers?: boolean;
  colors?: string[];
  sizeKey?: string;
  unit?: string;
  unitRight?: string;
  stacked?: boolean;
  stackMode?: StackMode;
  horizontal?: boolean;
  showLegend?: boolean;
  /** Legend default: bottom + center */
  legendPosition?: 'top' | 'bottom' | 'left' | 'right';
  legendAlign?: 'start' | 'center' | 'end';
  showValues?: boolean;
  /** Label policy: auto = datalabels 'auto' (避让外置); always; never */
  labelMode?: 'auto' | 'always' | 'never';
  missingValue?: MissingValuePolicy;
  format?: ValueFormatSpec;
  formatByKey?: Record<string, ValueFormatSpec>;
  xAxisLabel?: string;
  yAxisLabel?: string;
  yRightAxisLabel?: string;
  /** True when Y domain should include 0 and distinguish signed values */
  includeZero?: boolean;
  hasNegative?: boolean;
  /** Engine-precomputed labels for pie/funnel: value + percent of filtered total */
  sliceLabels?: Array<{
    key: string;
    value: number;
    percent: number;
    label: string;
  }>;
  /** Pie/doughnut center KPI */
  centerTotal?: number | null;
  centerLabel?: string;
  /** Rows for table / kpi / funnel / waterfall renderers */
  rows?: Record<string, unknown>[];
  columns?: string[];
  /** KPI */
  kpiValue?: number | string | null;
  kpiLabel?: string;
  kpiUnit?: string;
  /** Compare deltas — only present when engine has valid baseline */
  kpiCompare?: Array<{
    key: string;
    label: string;
    /** Human baseline e.g. "较上月" / "同比上年" */
    baseline: string;
    value: number | null;
    formatted: string | null;
  }>;
  /** Empty / null / error display state — never reuse stale graphics */
  emptyState?: 'ok' | 'empty' | 'all_null' | 'error';
  emptyMessage?: string;
  /** Brush emit field for click→filter (usually xKey / first dim) */
  brushField?: string;
  /** Scatter / tooltip dimension columns to show on hover */
  tooltipDims?: string[];
  /** Time axis: rows already sorted by engine when true */
  timeSorted?: boolean;
  timeSummary?: { latestVal: number | null; avgVal: number | null; maxVal: number | null; totalGrowthPct: number | null };
  /** Histogram bins — engine recomputes on filtered rows */
  histogramBins?: Array<{
    label: string;
    count: number;
    percent: number;
    from: number;
    to: number;
  }>;
  histogramValueMode?: 'absolute' | 'percent';
  /** Waterfall floating-bar payloads (base + delta) */
  waterfall?: {
    labels: string[];
    bases: number[];
    deltas: number[];
    kinds: Array<'increase' | 'decrease' | 'total'>;
    roles?: Array<'start' | 'change' | 'end' | 'total'>;
  };
  /** Scatter points with optional size + raw row for tooltip */
  scatterPoints?: Array<{
    x: number;
    y: number;
    r?: number;
    outlier?: boolean;
    colorRatio?: number;
    label?: string;
    raw?: Record<string, unknown>;
  }>;
  scatterSeries?: Array<{
    key: string;
    label?: string;
    trend?: boolean;
    points: NonNullable<ChartSpec['scatterPoints']>;
  }>;
  /** Multi-KPI tiles from first-row measures */
  kpiCards?: Array<{
    key: string;
    label: string;
    value: number | null;
    formatted: string;
    unit?: string;
  }>;
}

export interface AnalysisResult {
  spec: AnalysisSpec;
  sql: string;
  columns: string[];
  rows: Record<string, unknown>[];
  roles: ColumnRoleMap;
  chart: ChartSpec;
  /** Compatible ChartConfig for existing renderers */
  chartConfig: ChartConfig;
  executionTimeMs: number;
}

export interface AnalysisFieldCatalogEntry {
  column: string;
  physicalType: string;
  role: FieldRole;
  semanticType: string;
  defaultAgg: AnalysisAgg;
  suggestedAggs: AnalysisAgg[];
  unitHint?: string;
  confidence: number;
  nullRate: number | null;
  distinctCount: number | null;
  sampleValues?: string[];
}

export interface AnalysisFieldCatalog {
  table: string;
  builtAt: number;
  rowCount: number;
  fields: AnalysisFieldCatalogEntry[];
  dimensions: AnalysisFieldCatalogEntry[];
  measures: AnalysisFieldCatalogEntry[];
  timeFields: AnalysisFieldCatalogEntry[];
}

export interface AnalysisContextItem {
  id: string;
  label: string;
  kind: 'schema' | 'database' | 'project';
  isCurrent: boolean;
}

export function emptyFilters(): AnalysisFilters {
  return { global: [], cascade: [], interactive: [] };
}

export function createEmptySpec(partial?: Partial<AnalysisSpec> & { dataset: DatasetRef }): AnalysisSpec {
  return {
    id: partial?.id ?? `spec_${Date.now()}`,
    version: 1,
    dataset: partial!.dataset,
    fields: partial?.fields ?? [],
    dimensions: partial?.dimensions ?? [],
    metrics: partial?.metrics ?? [],
    calcs: partial?.calcs ?? [],
    filters: partial?.filters ?? emptyFilters(),
    sort: partial?.sort ?? [],
    topN: partial?.topN,
    visual: partial?.visual ?? { chartType: 'bar' },
    linkage: partial?.linkage,
    drill: partial?.drill,
  };
}
