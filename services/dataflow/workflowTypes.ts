/**
 * DataFlow Workflow Domain Models & Type Definitions
 *
 * 遵循统一状态机与真实 DuckDB 执行模型：
 * - 节点状态流转：idle -> configured -> dirty -> queued -> running -> success / error / blocked
 * - 纯数据依赖连线 (Edge)
 * - 生产级日志与执行追踪
 */

import type { Node, Edge } from 'reactflow';

export type WorkflowNodeStatus =
  | 'idle'
  | 'configured'
  | 'dirty'
  | 'queued'
  | 'running'
  | 'success'
  | 'error'
  | 'blocked'
  | 'cancelled';

export type WorkflowNodeType =
  | 'source'
  | 'schema'
  | 'sql_transform'
  | 'join'
  | 'aggregate'
  | 'result'
  | 'export';

export type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';

export interface JoinCondition {
  id: string;
  leftColumn: string;
  rightColumn: string;
}

export type AggregationFunction =
  | 'SUM'
  | 'COUNT'
  | 'COUNT(DISTINCT)'
  | 'AVG'
  | 'MIN'
  | 'MAX';

export interface AggregationField {
  id: string;
  alias: string;
  func: AggregationFunction;
  column: string;
}

export interface SourceNodeConfig {
  fileName: string;
  fileType: 'parquet' | 'csv' | 'json' | 'table';
  fileSize: string;
  filePath: string;
  tableName?: string;
}

export interface SchemaNodeConfig {
  checkType: 'inspect' | 'strict';
}

export interface SqlTransformNodeConfig {
  sql: string;
  description?: string;
}

export interface JoinNodeConfig {
  joinType: JoinType;
  conditions: JoinCondition[];
}

export interface AggregateNodeConfig {
  nodeName: string;
  description?: string;
  groupBy: string[];
  aggregations: AggregationField[];
  filter?: string;
  rawSql?: string;
}

export interface ResultNodeConfig {
  limit: number;
  sql?: string;
}

export interface ExportNodeConfig {
  format: 'parquet' | 'csv' | 'json';
  filePath: string;
}

export type WorkflowNodeConfig =
  | { type: 'source'; config: SourceNodeConfig }
  | { type: 'schema'; config: SchemaNodeConfig }
  | { type: 'sql_transform'; config: SqlTransformNodeConfig }
  | { type: 'join'; config: JoinNodeConfig }
  | { type: 'aggregate'; config: AggregateNodeConfig }
  | { type: 'result'; config: ResultNodeConfig }
  | { type: 'export'; config: ExportNodeConfig };

export interface ColumnSchema {
  name: string;
  type: string;
  nullable?: boolean;
}

export interface NodeExecutionResult {
  status: WorkflowNodeStatus;
  executionTimeSec: number;
  rowCount: number;
  columnCount: number;
  columns: ColumnSchema[];
  rows: any[];
  outputRelation: string; // DuckDB View or Table Name
  errorMessage?: string;
  compiledSql?: string;
}

export interface DataFlowNodeData {
  id: string;
  type: WorkflowNodeType;
  title: string;
  subtitle?: string;
  status: WorkflowNodeStatus;
  executionTimeSec?: number;
  rowCount?: number;
  columnCount?: number;
  filePath?: string;
  fileSize?: string;
  format?: string;
  config: any;
  executionResult?: NodeExecutionResult;
  sqlRange?: {
    startLine: number;
    endLine: number;
    cteName?: string;
  };
  predicate?: string;
  joinSummary?: string;
  groupBySummary?: string;
  inputRowCount?: number;
  filterRatio?: number;
  sqlSnippet?: string;
  isRealDuckDB?: boolean;
  highlightState?: 'ancestor' | 'descendant' | 'dimmed' | 'none';
}

export interface DataFlowEdgeData {
  sourceHandle?: string;
  targetHandle?: string;
  /** Join 左右语义（视觉锚点仍统一为左中，不改变 Handle 几何） */
  joinSide?: 'left' | 'right';
  label?: string;
  condition?: string;
  joinType?: string;
  rowCount?: number;
  columnCount?: number;
  filterRatio?: number;
  relationType?: 'data' | 'schema' | 'join' | 'filter' | 'aggregate';
  highlightState?: 'ancestor' | 'descendant' | 'dimmed' | 'none';
}

export type DataFlowNode = Node<DataFlowNodeData>;
export type DataFlowEdge = Edge<DataFlowEdgeData>;

export interface WorkflowRunLog {
  id: string;
  timestamp: string;
  runId: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  status: 'success' | 'error' | 'running';
  rows: number;
  duration: string;
  message: string;
  error?: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  version: number;
  nodes: DataFlowNode[];
  edges: DataFlowEdge[];
  viewport: { x: number; y: number; zoom: number };
  updatedAt: string;
}
