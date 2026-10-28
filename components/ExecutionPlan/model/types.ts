/**
 * components/ExecutionPlan/model/types.ts
 *
 * Unified Execution Plan Domain Model for DuckDB Editor Pro (Execution Canvas & Query X-Ray).
 * Adheres strictly to the Execution Model abstraction layer:
 * DuckDB Raw Output -> Execution Model -> Auto Layout -> Graph Renderer
 */

export type LensType = 'explain' | 'data' | 'cost';

export type OperatorCategory =
  | 'scan'
  | 'filter'
  | 'join'
  | 'aggregate'
  | 'sort'
  | 'window'
  | 'projection'
  | 'result'
  | 'other';

export type MetricSource =
  | 'duckdb_fact'          // Direct ground-truth metric from DuckDB engine output
  | 'registry_knowledge'   // Knowledge base explanation from Operator Registry
  | 'editor_pro_derived';  // Phenomenon-based diagnostic computed by Editor Pro

export interface OperatorMetrics {
  /** Actual output rows produced by operator (DuckDB Fact) */
  actualRows?: number;
  /** Actual rows scanned from storage/table scan (DuckDB Fact) */
  rowsScanned?: number;
  /** Operator execution duration in seconds (DuckDB Fact) */
  timingSeconds?: number;
  /** Operator execution duration in milliseconds (DuckDB Fact helper) */
  timingMs?: number;
  /** Optimizer estimated row count from extra_info (DuckDB Fact) */
  estimatedRows?: number;
  /** Cumulative cardinality at this node (DuckDB Fact) */
  cumulativeRows?: number;
  /** Cumulative scanned rows up to this node (DuckDB Fact) */
  cumulativeScanned?: number;
  /** CPU time spent in seconds (DuckDB Fact) */
  cpuTimeSeconds?: number;
  /** Size of intermediate result set in bytes (DuckDB Fact) */
  resultSetSizeBytes?: number;
  /** Percentage of total operator timing (Editor Pro Derived, strictly for relative hotspot highlighting) */
  timingPercentage?: number;
}

export type DiagnosticType =
  | 'high_scan_ratio'
  | 'cardinality_mismatch'
  | 'data_explosion'
  | 'timing_hotspot';

export interface DiagnosticSignal {
  type: DiagnosticType;
  severity: 'warning' | 'critical' | 'info';
  title: string;
  /** Objective description of observed phenomenon only; never assumes unproven root cause */
  phenomenon: string;
  source: 'editor_pro_derived';
}

export interface ExecutionNode {
  id: string;
  /** DuckDB raw operator opcode (e.g. "HASH_GROUP_BY", "SEQ_SCAN ") */
  name: string;
  /** Normalized operator type */
  operatorType: string;
  /** High-level category for coloring & semantics */
  category: OperatorCategory;
  /** True if the operator is not registered in the operator registry */
  isUnknownOperator: boolean;
  /** Human-readable Chinese title (e.g. "哈希分组聚合") */
  chineseName: string;
  /** Human-readable concise summary of operation */
  summary: string;
  /** Detailed registry description or fallback explanation */
  description?: string;
  /** Metrics (all values optional, strictly undefined when missing) */
  metrics: OperatorMetrics;
  /** Raw metadata extracted from DuckDB (Projections, Filters, Groups, etc.) */
  extraInfo: Record<string, any>;
  /** Observed diagnostic signals */
  diagnostics: DiagnosticSignal[];
  /** Child node IDs (in DuckDB physical tree: upstream inputs) */
  childrenIds: string[];
  /** Parent node IDs (in DuckDB physical tree: downstream consumers) */
  parentIds: string[];
  /** Editor Pro derived SQL mapping snippet */
  sqlHint?: string;
}

export interface ExecutionEdge {
  id: string;
  /** Upstream data source node ID */
  source: string;
  /** Downstream consumer node ID */
  target: string;
  /** Data volume flowing across edge (actual output rows of source, if available) */
  rows?: number;
  /** Whether data volume expanded across this link */
  isExplosion?: boolean;
  /** Proportional line width in Data lens (1px ~ 8px) */
  relativeWidth: number;
}

export interface ExecutionPlanGraph {
  /** Query-level latency in seconds (DuckDB Fact) */
  queryLatencySeconds?: number;
  /** Query-level CPU time in seconds (DuckDB Fact) */
  queryCpuTimeSeconds?: number;
  /** Peak buffer memory in bytes (DuckDB Fact) */
  systemPeakMemoryBytes?: number;
  /** Sum of operator timings across all nodes (Editor Pro Derived, strictly for percentage base) */
  totalOperatorTimingSeconds?: number;
  /** Root operator node ID */
  rootNodeId: string;
  /** All nodes mapped by unique ID */
  nodes: Map<string, ExecutionNode>;
  /** Ordered list of edges representing data flow */
  edges: ExecutionEdge[];
  /** Whether the plan was generated with ANALYZE (real execution metrics present) */
  isAnalyzed: boolean;
  /** Raw JSON structure for Evidence / auditing */
  rawJson?: any;
  /** Raw text EXPLAIN output for Evidence / auditing */
  rawText?: string;
  /** Error message if parsing was partially degraded */
  error?: string;
}

export type LayoutDirection = 'BT' | 'TB' | 'LR' | 'RL'; // BT = Bottom-Up, TB = Top-Down, LR = Left-to-Right (Horizontal), RL = Right-to-Left

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutEdge {
  id: string;
  source: string;
  target: string;
  points: { x: number; y: number }[];
  relativeWidth: number;
  rows?: number;
}

export interface LayoutResult {
  nodes: Map<string, LayoutNode>;
  edges: LayoutEdge[];
  width: number;
  height: number;
  direction: LayoutDirection;
}
