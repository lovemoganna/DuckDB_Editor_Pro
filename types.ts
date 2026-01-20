export interface TableInfo {
  name: string;
}

export interface ColumnInfo {
  name: string;
  type: string;
  notnull: boolean;
  dflt_value: any;
  pk: boolean;
}

export interface QueryResult {
  columns: string[];
  rows: any[];
  executionTime: number;
  error?: string;
  isExplain?: boolean;
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
  installable: boolean; // In WASM, usually means 'try LOAD'
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
}

export interface ChartConfig {
    type: 'bar' | 'line' | 'pie' | 'doughnut' | 'scatter';
    xKey: string;
    yKeys: string[];
    yRightKeys?: string[]; // Keys for the secondary Y-axis (usually Line type)
    stacked?: boolean; 
    horizontal?: boolean;
}

export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  createdAt: number;
  pinned?: boolean; // If true, shows on Dashboard
  widgetType?: 'value' | 'table' | 'chart'; // How to render on Dashboard
  chartConfig?: ChartConfig; // Configuration if widgetType is 'chart'
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
  top_k?: TopKEntry[]; // New field for categorical analysis
}

export interface ImportOptions {
    header: boolean;
    delimiter: string;
    quote: string;
    dateFormat: string;
}

export enum Tab {
  DASHBOARD = 'dashboard',
  DATA = 'data',
  STRUCTURE = 'structure',
  SQL = 'sql',
  HISTORY = 'history',
  AUDIT = 'audit',
  EXTENSIONS = 'extensions',
  TUTORIALS = 'tutorials'
}