// ============================================
// Chart & Visualization Types
// ============================================

export type { ChartType, ChartConfig } from '../types';
import type { ChartConfig } from '../types';

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
  referencedTables?: string[];
  referencedSchemas?: string[];
  lastResultMeta?: { rowCount?: number; columns?: string[]; ranAt?: number };
  vizHint?: 'strong' | 'weak' | 'none';
}

export interface DashboardItem {
  i: string;
  savedQueryId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  items: DashboardItem[];
  createdAt: number;
  updatedAt: number;
  tags?: string[];
  theme?: string;
  template?: string;
  /** When true (default), widget x/y/w/h are frozen — window resize must not rewrite layout. */
  layoutLocked?: boolean;
}
