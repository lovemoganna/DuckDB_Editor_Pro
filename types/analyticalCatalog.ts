/**
 * Analytical field catalog types — DuckDB-derived semantic foundation.
 * Used before chart UX: ensure metrics / dims / drill / linkage fields exist.
 */

export type FieldRole =
  | 'measure'
  | 'time'
  | 'category'
  | 'comparison'
  | 'identifier'
  | 'attribute'
  | 'boolean';

export type MetricAgg = 'sum' | 'avg' | 'count' | 'count_distinct' | 'min' | 'max' | 'median';

export interface AnalyticalField {
  tableName: string;
  columnName: string;
  physicalType: string;
  role: FieldRole;
  /** 0–100 confidence from heuristics + cardinality */
  confidence: number;
  nullRate: number | null;
  distinctCount: number | null;
  cardinalityRate: number | null;
  min?: string | number | null;
  max?: string | number | null;
  sampleValues?: string[];
  suggestedAggs?: MetricAgg[];
}

export interface CoreMetricProposal {
  id: string;
  name: string;
  tableName: string;
  measureColumn: string | null;
  aggregation: MetricAgg;
  /** SQL fragment ready to embed, e.g. SUM("amount") */
  measureExpr: string;
  timeDimension?: string;
  categoryDimensions: string[];
  comparisonDimension?: string;
  unitHint?: string;
  sql: string;
  /** Why this metric was proposed from real columns */
  rationale: string;
}

export interface TimeDimensionRef {
  tableName: string;
  columnName: string;
  physicalType: string;
  min?: string | number | null;
  max?: string | number | null;
  /** Preferred default grain */
  suggestedGrain: 'day' | 'week' | 'month' | 'quarter' | 'year';
  score: number;
}

export interface CategoryDimensionRef {
  tableName: string;
  columnName: string;
  distinctCount: number | null;
  sampleValues: string[];
  /** Suitable as chart series / brush linkage */
  linkable: boolean;
  score: number;
}

export interface ComparisonDimensionRef {
  tableName: string;
  columnName: string;
  kind: 'category_split' | 'time_period';
  distinctCount: number | null;
  sampleValues: string[];
  score: number;
}

export type HierarchyDomain = 'geographic' | 'product' | 'temporal' | 'entity' | 'relational';

export interface DrillPathRef {
  provenance?: 'foreign_key' | 'inferred' | 'hierarchy';
  id: string;
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  /** Suggested detail SQL template with {{value}} */
  detailSqlTemplate: string;
  label: string;
  hierarchyType?: HierarchyDomain;
}

export type LinkageRole = 'primary_filter' | 'drill_bridge' | 'cross_highlight' | 'secondary_filter';

export interface LinkageFieldRef {
  columnName: string;
  tables: string[];
  role: FieldRole;
  recommendedRole?: LinkageRole;
  /** Can drive BoardBrushFilter / {{param}} */
  usableAsParam: boolean;
  filterOperator?: '=' | 'IN' | 'LIKE' | 'BETWEEN';
}

export interface TableAnalyticalSummary {
  tableName: string;
  rowCount: number;
  columnCount: number;
  fields: AnalyticalField[];
  measures: AnalyticalField[];
  timeDimensions: AnalyticalField[];
  categoryDimensions: AnalyticalField[];
  identifiers: AnalyticalField[];
  readiness: TableDataReadiness;
}

export interface TableDataReadiness {
  hasMeasure: boolean;
  hasTime: boolean;
  hasCategory: boolean;
  hasComparison: boolean;
  hasDrillTarget: boolean;
  hasLinkageKey: boolean;
  /** 0–100 */
  score: number;
  missing: string[];
  tier?: 'complete' | 'partial' | 'minimal' | 'empty';
  checklist?: string[];
}

export interface AnalyticalCatalog {
  builtAt: number;
  tableCount: number;
  tables: TableAnalyticalSummary[];
  coreMetrics: CoreMetricProposal[];
  timeDimensions: TimeDimensionRef[];
  categoryDimensions: CategoryDimensionRef[];
  comparisonDimensions: ComparisonDimensionRef[];
  drillPaths: DrillPathRef[];
  linkageFields: LinkageFieldRef[];
  /** Workspace-level gaps to fill before expanding charts */
  workspaceGaps: string[];
  overallReadinessScore: number;
}
