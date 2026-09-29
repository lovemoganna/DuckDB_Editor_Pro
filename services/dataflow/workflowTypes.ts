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
  tableName?: string;
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
  /** SQL 执行时序与套路元数据 */
  stepIndex?: number;
  sqlStage?: SqlExecutionStage;
  paradigm?: SqlParadigmMeta;
  bugInfo?: BugTraceInfo;
  isExpanded?: boolean;
  clauseSnippet?: string;
  outputRowCount?: number;
  hasAnomaly?: boolean;
  /** 单步推演与仿真执行状态 */
  isStepActive?: boolean;
  isStepCompleted?: boolean;
  /** 阶段字段演变（输入列 vs 产出列，展示别名诞生与字段注销过程） */
  schemaEvolution?: SchemaEvolution;
}

export interface SchemaEvolution {
  inputColumns: string[];
  outputColumns: string[];
  newColumns?: string[];
  droppedColumns?: string[];
}

export type SqlExecutionStage =
  | 'from'
  | 'join'
  | 'where'
  | 'groupby'
  | 'having'
  | 'select'
  | 'orderby'
  | 'limit'
  | 'cte';

export interface SqlParadigmMeta {
  stage: SqlExecutionStage;
  stageName: string;
  executionOrder: number;
  roleDesc: string;
  mentalModel: string;
  pitfallWarning: string;
}

export interface BugTraceInfo {
  hasBug: boolean;
  isRootCause?: boolean;
  severity: 'error' | 'warning' | 'info';
  title: string;
  detail: string;
  suggestion: string;
  culpritClause?: string;
  culpritToken?: string;
  errorLine?: number;
  /** 一键修复替换 SQL */
  fixedSql?: string;
}

export interface PipelineStepperState {
  isActive: boolean;
  currentStepIndex: number;
  totalSteps: number;
  isPlaying: boolean;
  activeNodeId: string | null;
  playbackSpeedMs: number;
}

export interface SqlPitfallPreset {
  id: string;
  name: string;
  category: 'binder_error' | 'groupby_violation' | 'join_degradation' | 'cartesian_blowup' | 'perfect_pipeline';
  summary: string;
  bugDescription: string;
  pitfallRationale: string;
  buggySql: string;
  fixedSql: string;
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
  /** 是否为错误溯源链路 */
  isErrorPath?: boolean;
  /** 单步仿真推进边（显示粒子流动光斑） */
  isStepActive?: boolean;
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
