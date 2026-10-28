/**
 * components/ExecutionPlan/index.ts
 *
 * Public API for the unified DuckDB Execution Plan module.
 */

export { ExecutionPlanView, type ExecutionPlanViewProps } from './views/ExecutionPlanView';
export { ExecutionCanvas, type ExecutionCanvasProps } from './canvas/ExecutionCanvas';
export { NodeDetailDrawer, type NodeDetailDrawerProps } from './views/NodeDetailDrawer';
export { EvidencePanel, type EvidencePanelProps } from './views/EvidencePanel';
export { buildExecutionModel } from './model/planParser';
export { lookupOperator, OPERATOR_REGISTRY, getCategoryTheme } from './model/operatorRegistry';
export { computeGraphLayout } from './layout/planLayout';
export { computeDiagnostics } from './model/diagnostics';
export { formatExecutionGraphAsTextOutline } from './model/formatPlanText';
export * from './model/types';
