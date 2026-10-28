import type { ChartConfig } from '../../types';

export interface DatasetField { name: string; type: string }
export interface DatasetDefinition {
  id: string;
  name: string;
  catalog: string;
  schema: string;
  table?: string;
  sql: string;
  fields: DatasetField[];
  version: number;
  kind: 'table' | 'query';
  error?: string;
  uniqueKeys?: {sql:string;key:string}[];
}
export type FilterOperator = 'eq' | 'ne' | 'gte' | 'lt' | 'lte' | 'contains' | 'isNull' | 'notNull' | 'in';
export interface AnalysisFilter {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string;
  values?: string[];
  /** Explicit bindings: dataset identity -> physical/output field. */
  bindings: Record<string, string>;
}
export interface DashboardContext {
  filters: AnalysisFilter[];
  refreshSeconds: number;
}
export interface WidgetSettings {
  /** Field edits belong to this placement, just like chart presentation overrides. */
  querySpec?: WidgetQuerySpec;
  title?: string;
  datasetId?: string;
  sourceCatalog?: string;
  chartConfig?: ChartConfig;
  filters?: AnalysisFilter[];
  linked?: boolean;
}
export interface WidgetQuerySpec {
  datasetId: string;
  dimensions: string[];
  measure?: string;
  aggregation: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'DETAIL';
  timeGrain?: 'day' | 'week' | 'month' | 'year';
}
export interface CompiledAnalysis {
  sql: string;
  params: (string | number | boolean | null)[];
  notices: string[];
  datasetIds: string[];
}
