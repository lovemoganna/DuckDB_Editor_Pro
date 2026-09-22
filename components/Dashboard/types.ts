import { Dashboard as IDashboard } from '../../types';

export interface DataProbeColumn {
  name: string;
  type: string;
}

export interface DataProbeResult {
  name: string;
  sourceType: 'file' | 'table' | 'clipboard' | 'url';
  rowCount?: number | string;
  sizeBytes?: number;
  columns: DataProbeColumn[];
  previewRows: any[];
  virtualFileName?: string;
  selectSource: string;
  elapsedMs: number;
}

export interface TimelineActivityItem {
  id: string;
  type: 'query' | 'import' | 'ddl' | 'table' | 'system';
  title: string;
  timestamp: number;
  sql?: string;
  tableName?: string;
  durationMs?: number;
  rowCount?: number;
  status?: 'success' | 'error';
  details?: string;
}

export interface FileImportState {
  status: 'idle' | 'importing' | 'error';
  filename?: string;
  message?: string;
}

export interface AssetColumn {
  idx: number;
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
  pk: boolean;
}

export interface QualityIssue {
  id: string;
  type: 'null_anomaly' | 'missing_pk' | 'duplicate_risk' | 'type_drift' | 'custom';
  title: string;
  column?: string;
  affectedRows?: number;
  affectedRatio?: number;
  detectedAt: string;
  ruleDesc: string;
  filterSql?: string;
}

export interface AssetItem {
  id: string; // full identifier: schema.name
  schema: string;
  name: string;
  type: 'table' | 'view';
  rowCount: number | null;
  columnCount: number;
  sizeEstimate: string | null;
  status: 'normal' | 'attention' | 'pending_reanalyze' | 'unanalyzed' | 'analyzing' | 'error';
  lastAnalyzedAt: string | null;
  issues: QualityIssue[];
  columns: AssetColumn[];
  hasPrimaryKey: boolean;
  primaryKeys: string[];
  foreignKeys: { fromCol: string; toTable: string; toCol: string }[];
  nullRate: number | null;
  loading?: boolean;
}

export interface SchemaGroup {
  name: string;
  assets: AssetItem[];
  isExpanded: boolean;
}

export type FocusIssueCategory = 'all' | 'null_anomaly' | 'missing_pk' | 'duplicate_risk' | 'coverage';
export type FilterType = 'all' | 'table' | 'view' | 'attention' | 'unanalyzed';
export type SortKey = 'name' | 'size' | 'recent';
export type SortOrder = 'asc' | 'desc';

export interface ExecutionStats {
  memory: string;
  wal: string;
  tempFiles: string;
  successCount: number;
  failCount: number;
  cancelCount: number;
  lastUpdated: string;
}

export interface AssetSummaryStats {
  dbCount: number;
  schemaCount: number;
  tableCount: number;
  viewCount: number;
  totalEstimatedRows: number;
  dbSizeBytes: number;
  dbSizeFormatted: string;
  analyzedCount: number;
  totalAnalyzable: number;
  nullIssueCount: number;
  missingPkCount: number;
  duplicateRiskCount: number;
  attentionCount?: number;
  unanalyzedCount?: number;
}

export type DashboardMainViewMode = 'cockpit' | 'grid' | 'timeline' | 'catalog' | 'analytics' | 'scratchpad';

export interface PinnedQueryItem {
  id: string;
  name: string;
  sql: string;
  lastExecutedAt?: number;
}

export interface RecentActivityItem {
  id: string;
  title: string;
  timestamp: number;
  type: string;
  status?: string;
  sql?: string;
  durationMs?: number;
}


