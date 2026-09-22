/**
 * services/workbench/types.ts
 *
 * Core Backend Interaction State Types defined by BRD index10.md Section 3:
 * - EditDocument: Active editor state per tab
 * - ExecutionTask: Task life-cycle (running, success, error, cancelled)
 * - QuerySnapshot: Immutable query execution result
 * - TransformationRule: In-memory & SQL-based filters, aggregations, and sorts
 * - ColumnProfileSnapshot: Bound snapshot-column metadata & statistics
 * - AiArtifactSnapshot: Bound query snapshot explanation & analysis evidence
 */

export type TaskStatus = 'idle' | 'running' | 'success' | 'failed' | 'cancelled';

export interface ExecutionTask {
  taskId: string;
  tabId: string;
  sql: string;
  status: TaskStatus;
  startTime: number;
  duration?: number;
  error?: string;
  errorLine?: number;
  errorColumn?: number;
  cancellationToken?: AbortController;
  snapshotId?: string;
}

export interface FilterRule {
  column: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'ILIKE' | 'IS NULL' | 'IS NOT NULL';
  value: any;
}

export interface MetricRule {
  column: string;
  aggregator: 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX' | 'COUNT_DISTINCT';
  alias: string;
}

export interface SortRule {
  column: string;
  direction: 'ASC' | 'DESC';
}

export interface PivotRule {
  rowField: string;
  colField: string;
  valField: string;
  aggregator: 'SUM' | 'AVG' | 'COUNT';
}

export interface TransformationConfig {
  filters?: FilterRule[];
  sorts?: SortRule[];
  groupBy?: string[];
  metrics?: MetricRule[];
  pivot?: PivotRule;
}

export interface QuerySnapshot {
  snapshotId: string;
  executionId: string;
  tabId: string;
  title: string;
  sql: string;
  columns: string[];
  columnTypes: string[];
  columnTypeMap: Record<string, string>;
  rows: any[];
  totalRowCount: number;
  executionTime: number;
  executedAt: string;
  limitClause?: number;
  parentSnapshotId?: string;
  transformation?: TransformationConfig;
  arrowTable?: any;
  isStale?: boolean;
  isExplain?: boolean;
}

export interface TopValueEntry {
  value: string;
  count: number;
  pct: string;
}

export interface ColumnProfileSnapshot {
  snapshotId: string;
  columnName: string;
  columnType: string;
  isNumeric: boolean;
  isDate: boolean;
  min: string;
  max: string;
  avg: string;
  median: string;
  sum: string;
  nullCount: number;
  nullPct: string;
  distinctCount: number;
  distinctPct: string;
  histogramBars: number[];
  histogramTicks: string[];
  topValues: TopValueEntry[];
  memorySize: string;
  columnRatio: string;
  isExact: boolean;
  sampleRows: number;
  totalRows: number;
  calculatedAt: number;
}

export interface AiEvidenceItem {
  field: string;
  metric: string;
  value: any;
  isAnomaly?: boolean;
}

export interface AiArtifactSnapshot {
  artifactId: string;
  snapshotId: string;
  tabId: string;
  mode: 'explain' | 'analyze';
  sql: string;
  summary: string;
  findings: string[];
  evidence: AiEvidenceItem[];
  suggestedSql?: string;
  createdAt: string;
}
