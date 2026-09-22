// ============================================
// Core Database Types
// ============================================

export interface TableInfo {
  name: string;
}

export interface ColumnInfo {
  name: string;
  type: string;
  notnull: boolean;
  dflt_value: any;
  pk: boolean;
  cid?: number;
}

export interface ObjectRef {
  connectionId: string;
  databaseOid?: string | number;
  databaseName: string;
  schemaOid?: string | number;
  schemaName: string;
  objectOid?: string | number;
  objectName: string;
  objectType: 'TABLE' | 'VIEW';
  estimatedRows?: number | null;
  columnCount?: number;
  sql?: string;
}

export interface CatalogDatabaseNode {
  databaseOid: string | number;
  databaseName: string;
  path?: string;
  readonly?: boolean;
  type?: string;
  schemas: CatalogSchemaNode[];
}

export interface CatalogSchemaNode {
  schemaOid?: string | number;
  schemaName: string;
  databaseName: string;
  tables: ObjectRef[];
  views: ObjectRef[];
}

export interface CatalogTreeResult {
  connectionId: string;
  currentCatalog: string;
  currentSchema: string;
  databases: CatalogDatabaseNode[];
}

export interface QueryResult {
  resultId?: string;
  queryTitle?: string;
  sourceType?: 'query' | 'table_preview' | 'table_sample';
  sourceName?: string;
  columns: string[];
  rows: any[];
  executionTime: number;
  error?: string;
  errorContext?: {
    catalog?: string;
    currentCatalog: string;
    currentSchema: string;
    availableCatalogs: string[];
    missingObject?: string;
    suggestion?: string;
  };
  isExplain?: boolean;
  limitClause?: number;
  executedAt?: string;
}

export interface AuditLogEntry {
  id: number;
  log_time: string;
  operation_type: string;
  target_table: string;
  details: string;
  affected_rows: number;
  sql_statement: string;
}

export interface ExtensionStatus {
  name: string;
  description: string;
  loaded: boolean;
  installable: boolean;
}

export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface QueryHistoryItem {
  id: string;
  sql: string;
  timestamp: number;
  status: 'success' | 'error';
  executionTime?: number;
}

export interface ImportOptions {
  header: boolean;
  delimiter: string;
  quote?: string;
  dateFormat?: string;
}

export interface TopKEntry {
  value: any;
  count: number;
}

export interface ColumnStats {
  min: any;
  max: any;
  null_count: number;
  distinct_count: number;
  total_count: number;
  top_k?: TopKEntry[];
  avg?: number;
  std?: number;
  skew?: number;
  kurt?: number;
  entropy?: number;
  q25?: number;
  q50?: number;
  q75?: number;
  p01?: number;
  p99?: number;
  histogram?: { bin: number, count: number }[];
}

export interface EnrichedColumnStats extends ColumnStats {
  name: string;
  type: string;
  avg: number;
  std: number;
  skew: number;
  kurt: number;
  entropy: number;
  p01: number;
  p99: number;
}

// ============================================
// App-level enumeration (shared across modules)
// ============================================

export enum Tab {
  DASHBOARD = 'dashboard',
  DATA = 'data',
  STRUCTURE = 'structure',
  SQL = 'sql',
  HISTORY = 'history',
  AUDIT = 'audit',
  EXTENSIONS = 'extensions',
  TUTORIALS = 'tutorials',
  ANALYSIS_HUB = 'analysis_hub',
  METRICS = 'metrics',
  AI_SKILLS = 'ai_skills',
  LIBRARY = 'library',
  AI_CAPABILITIES = 'ai_capabilities',
  ONTOLOGY = 'ontology',
  COMPOSITIONAL_DEDUCTION = 'compositional_deduction',
  DATAFLOW = 'dataflow',
}
