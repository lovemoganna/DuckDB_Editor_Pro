export const LOGICAL_FLOW_CONTRACT_VERSION = "2.0" as const;

export type FlowStatus = "complete" | "partial" | "parse_error";
export type FlowNodeKind =
  "relation" | "operator" | "boundary" | "object" | "unknown";
export type RelationRole =
  "source" | "intermediate" | "output" | "result" | "reference";
export type RelationSourceKind =
  | "table"
  | "view"
  | "temp_table"
  | "values"
  | "table_function"
  | "table_macro"
  | "cte_reference"
  | "subquery_result"
  | "statement_object"
  | "unknown";
export type DimensionName =
  "rows" | "columns" | "grain" | "order" | "shape" | "uniqueness";
export type DimensionChange =
  | "preserve"
  | "add"
  | "remove"
  | "filter"
  | "reshape"
  | "reorder"
  | "collapse"
  | "expand"
  | "deduplicate"
  | "unknown";

export interface SourceSpan {
  start: number;
  end: number;
  startLine: number;
  endLine: number;
}
export interface DimensionState {
  before: string | "unknown" | null;
  after: string | "unknown" | null;
  change: DimensionChange;
  evidence?: string;
}
export interface RelationState {
  rows: DimensionState;
  columns: DimensionState;
  grain: DimensionState;
  order: DimensionState;
  shape: DimensionState;
  uniqueness: DimensionState;
}
export interface Relation {
  id: string;
  role: RelationRole;
  sourceKind: RelationSourceKind;
  name?: string;
  alias?: string;
  objectId?: string;
  bindingState?: "defined" | "unresolved";
  state?: RelationState;
}
export type OperatorType =
  | "relation_source"
  | "filter"
  | "sample"
  | "projection"
  | "aggregate"
  | "window"
  | "object_operation"
  | "join"
  | "set_operation"
  | "reshape"
  | "output_modifier"
  | "result"
  | "unknown";
export interface Effect {
  id: string;
  operatorId: string;
  dimension: DimensionName;
  before: string | "unknown" | null;
  after: string | "unknown" | null;
  change: DimensionChange;
  evidence?: string;
}
export interface Operator {
  id?: string;
  type: OperatorType;
  subtype?: string;
  expression?: string;
  inputRelationIds: string[];
  outputRelationIds: string[];
  effectIds: string[];
  boundaryId: string;
  details: Record<string, unknown>;
}
export type BoundaryKind =
  | "statement"
  | "query"
  | "cte"
  | "subquery"
  | "recursive_cte"
  | "connection"
  | "catalog";
export interface Boundary {
  id: string;
  kind: BoundaryKind;
  name?: string;
  parentBoundaryId?: string;
  materialization?: "materialized" | "not_materialized" | "unspecified";
  recursive?: boolean;
  sourceSpan: { start: number; end: number };
}
export interface FlowNode {
  id: string;
  kind: FlowNodeKind;
  statementId: string;
  queryId?: string;
  boundaryId?: string;
  sourceSpan: SourceSpan;
  label: string;
  relation?: Relation;
  operator?: Operator;
  boundary?: Boundary;
  unknown?: { reason: string; sqlSnippet: string };
  object?: FlowObject;
}
export interface FlowObject {
  id: string;
  name: string;
  objectType: string;
  scope: "connection" | "catalog";
  catalog: string;
  schema: string;
  version: number;
  definedBy: string;
  state: "defined" | "released" | "unresolved";
  runtimeState?:
    "pending" | "defined" | "released" | "rolled_back" | "not_applied";
  definitionSql?: string;
  temporary: boolean;
}
export type FlowEdgeKind =
  | "relation_flow"
  | "reference"
  | "object_dependency"
  | "boundary_contains"
  | "recursive_back";
export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  kind: FlowEdgeKind;
  relationId?: string;
  operatorId?: string;
  effectIds?: string[];
  label?: string;
  inputRole?: string;
}
export interface FlowDiagnostic {
  code: string;
  message: string;
  severity: "error" | "warning" | "info";
  sourceSpan?: SourceSpan;
}
export interface StatementFlow {
  id: string;
  sourceSpan: SourceSpan;
  boundaryId: string;
  kind: string;
}
export interface FlowData {
  contractVersion: typeof LOGICAL_FLOW_CONTRACT_VERSION;
  source: {
    sql: string;
    sourceHash: string;
    parserVersion: string;
    generatedAt: string;
  };
  status: FlowStatus;
  statements: StatementFlow[];
  effects: Effect[];
  relations: Relation[];
  operators: Operator[];
  boundaries: Boundary[];
  objects: FlowObject[];
  nodes: FlowNode[];
  edges: FlowEdge[];
  diagnostics: FlowDiagnostic[];
}
