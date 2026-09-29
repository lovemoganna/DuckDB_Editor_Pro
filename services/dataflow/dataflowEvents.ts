/**
 * DataFlow ↔ SQL 工作台双向联动事件
 */

export const DATAFLOW_TRACE_FAULT_EVENT = 'dataflow_trace_fault';
export const FOCUS_SQL_EDITOR_EVENT = 'focus_sql_editor';
export const DATAFLOW_CENTER_NODE_EVENT = 'dataflow_center_node';

export type DataflowTraceFaultDetail = {
  nodeId?: string | null;
  /** 打开右侧诊断 Inspector（分屏异常路径默认 true） */
  openInspector?: boolean;
  /** 同时聚焦并高亮 SQL 编辑器对应行 */
  focusSql?: boolean;
  /** 仅平滑居中相机，不强制开 Inspector */
  centerOnly?: boolean;
};

export type FocusSqlEditorDetail = {
  sqlRange?: { startLine: number; endLine: number; cteName?: string } | null;
  replaceSql?: string;
};

export type DataflowCenterNodeDetail = {
  nodeId: string;
  /** 选中并保持 Inspector 打开（默认 true） */
  openInspector?: boolean;
  zoom?: number;
};

export function dispatchDataflowTraceFault(detail: DataflowTraceFaultDetail = {}): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(DATAFLOW_TRACE_FAULT_EVENT, { detail }));
}

export function dispatchFocusSqlEditor(detail: FocusSqlEditorDetail = {}): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(FOCUS_SQL_EDITOR_EVENT, { detail }));
}

export function dispatchDataflowCenterNode(detail: DataflowCenterNodeDetail): void {
  if (typeof window === 'undefined' || !detail?.nodeId) return;
  window.dispatchEvent(new CustomEvent(DATAFLOW_CENTER_NODE_EVENT, { detail }));
}
