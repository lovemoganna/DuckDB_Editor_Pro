// ============================================
// Chart & Visualization Types
// ============================================

export type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'doughnut' | 'scatter' | 'counter';

export interface ChartConfig {
  id: string;
  title: string;
  type: ChartType;
  xKey: string;
  yKeys: string[];
  yRightKeys?: string[];
  groupBy?: string;
  aggregation?: 'none' | 'count' | 'sum' | 'avg' | 'min' | 'max';
  stacked?: boolean;
  horizontal?: boolean;
  showLegend?: boolean;
  showValues?: boolean;
  yAxisLabel?: string;
  colors?: string[];
  metricId?: string;
  metricPackageId?: string;
  metricName?: string;
  source?: 'metric' | 'manual';
  drillDownConfig?: {
    enabled: boolean;
    drillDownSql?: string;
    drillDownColumn?: string;
  };
}

// ============================================
// SQL Editor Tab
// ============================================

import type { QueryResult } from './db';

export interface SqlTab {
  id: string;
  title: string;
  code: string;
  result?: QueryResult;
  history: string[];
  historyIndex: number;
  loading: boolean;
  viewMode: 'table' | 'chart' | 'explain';
  chartConfig: ChartConfig;
  charts?: ChartConfig[];
  page: number;
  filterTerm: string;
}

export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  desc?: string;
  pinned?: boolean;
  folder?: string;
  createdAt: number;
  charts?: ChartConfig[];
  widgetType?: 'value' | 'table' | 'chart';
  metricChartId?: string;
}
