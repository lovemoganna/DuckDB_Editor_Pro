import { layoutLogicalFlow, type LogicalFlowLayoutMode } from './logicalFlowLayout';
import { cancelStatementExecution, subscribeStatementExecution, type StatementExecutionEvent } from './sqlScriptExecution';
import { hashSql } from './sqlHash';
import { stripSqlHeader } from '../sqlScript';
/**
 * DataFlow Workflow Store (Zustand)
 *
 * 核心状态与逻辑：
 * 1. 响应式节点与连线维护 (React Flow 协议)
 * 2. 深度绑定 DuckDB 工作台真实 SQL 操作与全库血缘
 * 3. 动态解析工作台 SQL（CTE、JOIN、GROUP BY、CREATE VIEW 等）生成真实 DAG
 * 4. 真实 DuckDB 执行调度与全链路实时采样（行数、列数、结构、预览）
 * 5. 严格的下行脏状态 (dirty/blocked) 自动传播
 * 6. 支持多模式切换：当前 SQL 流图 (sql)、全库血缘 (catalog)、自由编排 (custom)
 */

import { create } from 'zustand';
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from 'reactflow';
import type {
  DataFlowNode,
  DataFlowEdge,
  WorkflowRunLog,
  WorkflowNodeType,
  WorkflowNodeStatus,
  PipelineStepperState,
  SqlPitfallPreset,
} from './workflowTypes';
import { WorkflowExecutor } from './workflowExecutor';
import { duckDBService } from '../duckdbService';
import { toastService } from '../toastService';
import {
  parseCatalogToWorkflow,
  compileWorkflowToFullSql,
  calculateDagLayout,
  updateSqlCteDefinition,
  locateBugInWorkflow,
  detectLogicalAnomalies,
  parseSqlToExecutionSteps,
  SQL_PITFALL_PRESETS,
} from './sqlToWorkflowParser';
import {
  getNodeViewName,
  compileNodeSql,
  resolveNodeInputs,
  sortWorkflowTopologically,
} from './workflowCompiler';
import {
  buildRealExecutionWorkflow,
  traceUpstreamLineage,
  locateAndDecorateErrorNode,
} from './sqlExecutionPlanParser';
import {
  dispatchDataflowTraceFault,
  dispatchFocusSqlEditor,
} from './dataflowEvents';
import { logicalFlowToCanvas, parseLogicalRelationFlow } from './logicalRelationFlowParser';
import type { FlowData } from './logicalRelationFlowTypes';

const STORAGE_KEY = 'duckdb_workflow_state_v3';

/** Monotonic token so stale async EXPLAIN/syncFromSql completions cannot overwrite newer SQL. */
let sqlSyncGeneration = 0;
let sqlLayoutGeneration = 0;

export type WorkflowSyncStatus = 'idle' | 'syncing' | 'error' | 'ready';

/**
 * 拓扑无环性检测：检测如果添加一条从 source 到 target 的有向边，是否会导致图中产生闭环 (Cycle)
 */
export function wouldCreateCycle(source: string, target: string, edges: DataFlowEdge[]): boolean {
  if (source === target) return true;
  const visited = new Set<string>();
  const queue = [target];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr === source) return true;
    if (visited.has(curr)) continue;
    visited.add(curr);
    for (const e of edges) {
      if (e.source === curr && !visited.has(e.target)) {
        queue.push(e.target);
      }
    }
  }
  return false;
}

let logSequence = 0;
const generateWorkflowLogId = () =>
  `log_${Date.now()}_${++logSequence}_${Math.random().toString(36).substring(2, 7)}`;

function applyObjectRuntime(flow:FlowData,event:StatementExecutionEvent):FlowData {
  const changed=flow.objects.filter(o=>o.definedBy===event.statementId);
  const same=(a:FlowData['objects'][number],b:FlowData['objects'][number])=>a.catalog===b.catalog&&a.schema===b.schema&&a.name===b.name;
  return {...flow,objects:flow.objects.map(object=>{
    if(object.definedBy===event.statementId)return {...object,runtimeState:event.rolledBack?'rolled_back':event.status==='queued'||event.status==='running'?'pending':event.status==='success'?object.state==='released'?'released':'defined':'not_applied'};
    const release=changed.find(o=>o.state==='released'&&o.version===object.version&&same(o,object));
    if(release&&event.status==='success')return {...object,runtimeState:event.rolledBack?'defined':'released'};
    return object;
  })};
}

export type DataFlowMode = 'sql' | 'catalog' | 'custom';

interface WorkflowState {
  nodes: DataFlowNode[];
  edges: DataFlowEdge[];
  selectedNodeId: string | null;
  runLogs: WorkflowRunLog[];
  availableTables: string[];
  isExecuting: boolean;
  autoScrollLogs: boolean;
  bottomDrawerTab: 'logs' | 'node_history' | 'query_history' | 'preview';
  inspectorTab: 'config' | 'preview' | 'records';
  isBottomDrawerOpen: boolean;
  viewport: { x: number; y: number; zoom: number };
  canvasWidth: number;
  sqlLayoutMode: LogicalFlowLayoutMode;
  lastSavedAt: string | null;

  // ── SQL 工作台双向实时打通状态 ──
  dataFlowMode: DataFlowMode;
  activeSql: string;
  activeTabTitle: string;
  activeSqlRange: { startLine: number; endLine: number; cteName?: string } | null;
  liveSyncWithSql: boolean;
  /** SQL → 流图同步生命周期，供画布空/错/加载态展示 */
  syncStatus: WorkflowSyncStatus;
  lastSyncError: string | null;
  logicalFlowData: FlowData | null;
  bindingVersion: number;
  activeDocumentId: string;
  activeRunId: string | null;
  executionSqlRange: import('./logicalRelationFlowTypes').SourceSpan | null;
  applyExecutionEvent: (event: StatementExecutionEvent) => void;

  // React Flow Handlers
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;

  // Actions
  selectNode: (nodeId: string | null) => void;
  /** 选中异常节点、写入 sqlRange，并派发相机/Inspector/SQL 聚焦事件 */
  focusFaultyNode: (nodeId?: string | null) => string | null;
  updateNodeData: (nodeId: string, patch: Partial<DataFlowNode['data']>) => void;
  updateNodeConfig: (nodeId: string, configPatch: any) => void;
  addNode: (type: WorkflowNodeType, position?: { x: number; y: number }) => void;
  addSourceNodeForTable: (tableName: string, position?: { x: number; y: number }) => Promise<void>;
  deleteNode: (nodeId: string) => void;
  deleteEdge: (edgeId: string) => void;
  refreshAvailableTables: () => Promise<void>;
  resetDatabaseContext: () => void;
  autoLayout: () => Promise<void>;
  setSqlLayoutMode: (mode: LogicalFlowLayoutMode) => Promise<void>;

  // ── 双向联动操作 ──
  setDataFlowMode: (mode: DataFlowMode, focusTableName?: string) => Promise<void>;
  setLiveSyncWithSql: (enabled: boolean) => void;
  syncFromSql: (sql: string, tabTitle?: string, isManual?: boolean, documentId?: string) => Promise<void>;
  syncFromCatalog: (focusTableName?: string) => Promise<void>;
  syncExecutionResult: (tabTitle: string, result: any, executedSql?: string) => Promise<void>;
  syncCursorLine: (lineNumber: number) => void;
  compileWorkflowToSql: () => string;

  // Execution
  runNode: (nodeId: string) => Promise<void>;
  runSingleCte: (nodeId: string) => Promise<void>;
  runAll: () => Promise<void>;
  cancelSqlRun:()=>void;

  // UI state setters
  setAutoScrollLogs: (val: boolean) => void;
  setBottomDrawerTab: (tab: 'logs' | 'node_history' | 'query_history' | 'preview') => void;
  setInspectorTab: (tab: 'config' | 'preview' | 'records') => void;
  setIsBottomDrawerOpen: (open: boolean) => void;
  toggleBottomDrawer: () => void;
  setViewport: (vp: { x: number; y: number; zoom: number }) => void;
  clearLogs: () => void;
  traceBugNode: () => string | null;
  toggleNodeExpanded: (nodeId: string) => void;

  // ── 单步仿真推演步进器与避坑演练 ──
  stepperState: PipelineStepperState;
  startStepping: () => void;
  stopStepping: () => void;
  stepNext: () => void;
  stepPrev: () => void;
  setStepIndex: (index: number) => void;
  togglePlayStepping: () => void;
  loadPitfallPreset: (presetId: string) => { buggySql: string; preset: SqlPitfallPreset } | null;

  // ── 结果反向溯源 (Lineage Traceback) ──
  isReverseTracing: boolean;
  traceReverseLineage: (targetNodeId?: string) => void;
  clearLineageTrace: () => void;

  // Persistence
  saveWorkflow: () => void;
  loadWorkflow: (initialSql?: string, tabTitle?: string) => Promise<void>;
  resetToDefaultDemo: () => Promise<void>;
}

/**
 * 递归标记所有下游节点为 dirty
 */
function markDownstreamDirty(
  startNodeId: string,
  nodes: DataFlowNode[],
  edges: DataFlowEdge[]
): DataFlowNode[] {
  const dirtySet = new Set<string>([startNodeId]);
  const queue = [startNodeId];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const outgoing = edges.filter(e => e.source === curr);
    for (const edge of outgoing) {
      if (!dirtySet.has(edge.target)) {
        dirtySet.add(edge.target);
        queue.push(edge.target);
      }
    }
  }

  if (dirtySet.size === 0) return nodes;

  return nodes.map(node => {
    if (dirtySet.has(node.id)) {
      return {
        ...node,
        data: {
          ...node.data,
          status: 'dirty' as WorkflowNodeStatus,
        },
      };
    }
    return node;
  });
}

/**
 * 遍历节点列表并从真实 DuckDB 实例中拉取真实行数、字段与采样数据
 */
async function enrichNodesWithDuckDB(
  nodes: DataFlowNode[],
  edges: DataFlowEdge[]
): Promise<DataFlowNode[]> {
  if (nodes.length === 0) return [];

  // 按拓扑序排序节点，确保上游临时视图在下游编译前已在 DuckDB 中建立就绪
  const { order } = sortWorkflowTopologically(nodes, edges);
  const nodeMap = new Map(nodes.map(n => [n.id, { ...n, data: { ...n.data } }]));
  const orderedNodes = order.map(id => nodeMap.get(id)).filter(Boolean) as DataFlowNode[];
  nodes.forEach(n => {
    if (!orderedNodes.some(on => on.id === n.id)) {
      orderedNodes.push(nodeMap.get(n.id)!);
    }
  });

  for (const node of orderedNodes) {
    try {
      if (node.data.type === 'source' && node.data.config?.tableName) {
        const tbl = node.data.config.tableName;
        const countRes = await duckDBService.query(`SELECT COUNT(*) as cnt FROM "${tbl}"`);
        const rowCount = Number(countRes[0]?.cnt ?? 0);
        const descRes = await duckDBService.query(`DESCRIBE "${tbl}"`);
        const columns = descRes.map((r: any) => ({
          name: String(r.column_name || Object.values(r)[0]),
          type: String(r.column_type || Object.values(r)[1] || 'VARCHAR'),
          nullable: String(r.null || '').toLowerCase() === 'yes',
        }));
        const previewRows = await duckDBService.query(`SELECT * FROM "${tbl}" LIMIT 50`);

        node.data.rowCount = rowCount;
        node.data.columnCount = columns.length;
        node.data.status = 'success';
        node.data.executionResult = {
          status: 'success',
          executionTimeSec: 0.02,
          rowCount,
          columnCount: columns.length,
          columns,
          rows: previewRows,
          outputRelation: tbl,
        };
      } else {
        // 对于中间算子与输出节点，依拓扑序在 DuckDB 建立视图并采集数据
        const viewName = getNodeViewName(node.id);
        const inputs = resolveNodeInputs(node.id, edges, orderedNodes);
        const { sql } = compileNodeSql(node, inputs);

        if (sql) {
          try {
            await duckDBService.query(`CREATE OR REPLACE TEMP VIEW "${viewName}" AS ${sql}`);

            // 同时建立以节点 title 为别名的临时视图（例如 CTE 名 clean_sales），供后续节点和 SQL 工作台直查
            const cleanTitle = node.data.title.trim().replace(/^["`]|["`]$/g, '');
            const safeTitle = cleanTitle.replace(/[^a-zA-Z0-9_]/g, '_');
            if (safeTitle && safeTitle !== viewName && !/^\d+$/.test(safeTitle)) {
              try {
                await duckDBService.query(`CREATE OR REPLACE TEMP VIEW "${safeTitle}" AS SELECT * FROM "${viewName}"`);
              } catch {}
            }

            const countRes = await duckDBService.query(`SELECT COUNT(*) as cnt FROM "${viewName}"`);
            const rowCount = Number(countRes[0]?.cnt ?? 0);
            const descRes = await duckDBService.query(`DESCRIBE SELECT * FROM "${viewName}" LIMIT 0`);
            const columns = descRes.map((r: any) => ({
              name: String(r.column_name || Object.values(r)[0]),
              type: String(r.column_type || Object.values(r)[1] || 'VARCHAR'),
              nullable: true,
            }));
            const previewRows = await duckDBService.query(`SELECT * FROM "${viewName}" LIMIT 50`);

            node.data.rowCount = rowCount;
            node.data.columnCount = columns.length;
            node.data.status = 'success';
            node.data.executionResult = {
              status: 'success',
              executionTimeSec: 0.03,
              rowCount,
              columnCount: columns.length,
              columns,
              rows: previewRows,
              outputRelation: viewName,
              compiledSql: sql,
            };
          } catch {
            // 依赖未就绪时保留 configured 状态
          }
        }
      }
    } catch (e) {
      console.warn('[enrichNodesWithDuckDB] node enrich skip:', node.id, e);
    }
  }

  // 计算每个节点的输入总行数与过滤比率
  orderedNodes.forEach(node => {
    const inEdges = edges.filter(e => e.target === node.id);
    if (inEdges.length > 0) {
      let totalInput = 0;
      let hasValidInput = false;
      inEdges.forEach(e => {
        const src = nodeMap.get(e.source);
        if (src?.data?.rowCount !== undefined) {
          totalInput += src.data.rowCount;
          hasValidInput = true;
        }
      });
      if (hasValidInput && totalInput > 0) {
        node.data.inputRowCount = totalInput;
        if (node.data.rowCount !== undefined) {
          const ratio = Math.round(((totalInput - node.data.rowCount) / totalInput) * 100);
          node.data.filterRatio = ratio;
        }
      }
    }
  });

  edges.forEach(edge => {
    const tgt = nodeMap.get(edge.target);
    if (tgt?.data?.filterRatio !== undefined) {
      edge.data = {
        ...edge.data,
        filterRatio: tgt.data.filterRatio,
      };
    }
  });

  return nodes.map(n => nodeMap.get(n.id) || n);
}

let stepperTimer: any = null;

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  runLogs: [],
  availableTables: [],
  isExecuting: false,
  autoScrollLogs: true,
  bottomDrawerTab: 'logs',
  inspectorTab: 'config',
  isBottomDrawerOpen: false,
  viewport: { x: 0, y: 0, zoom: 1 },
  canvasWidth: 1000,
  sqlLayoutMode: 'auto',
  lastSavedAt: null,

  // 单步推演仿真器状态
  stepperState: {
    isActive: false,
    currentStepIndex: 1,
    totalSteps: 1,
    isPlaying: false,
    activeNodeId: null,
    playbackSpeedMs: 1600,
  },

  dataFlowMode: 'sql',
  activeSql: '',
  activeTabTitle: 'SQL 查询',
  activeSqlRange: null,
  liveSyncWithSql: true,
  syncStatus: 'idle',
  lastSyncError: null,
  logicalFlowData: null,
  bindingVersion:0, activeDocumentId: '',
      activeRunId: null,
      executionSqlRange: null,
  isReverseTracing: false,

  onNodesChange: (changes: NodeChange[]) => {
    if(get().dataFlowMode==='sql')changes=changes.filter(c=>c.type==='dimensions'||c.type==='select');
    const removedNodeIds = changes
      .filter((c): c is NodeChange & { type: 'remove'; id: string } => c.type === 'remove')
      .map(c => c.id);

    let nextNodes = applyNodeChanges(changes, get().nodes) as DataFlowNode[];
    let nextEdges = get().edges;

    if (removedNodeIds.length > 0) {
      const removedSet = new Set(removedNodeIds);
      nextEdges = nextEdges.filter(e => !removedSet.has(e.source) && !removedSet.has(e.target));
      for (const removedId of removedNodeIds) {
        nextNodes = markDownstreamDirty(removedId, nextNodes, get().edges);
      }
    }

    set({
      nodes: nextNodes,
      edges: nextEdges,
      selectedNodeId: removedNodeIds.includes(get().selectedNodeId || '') ? null : get().selectedNodeId,
    });

    if (get().dataFlowMode === 'custom' && removedNodeIds.length > 0) {
      get().saveWorkflow();
    }
  },

  onEdgesChange: (changes: EdgeChange[]) => {
    if(get().dataFlowMode==='sql')changes=changes.filter(c=>c.type==='select');
    const nextEdges = applyEdgeChanges(changes, get().edges) as DataFlowEdge[];
    set({ edges: nextEdges });
    if (get().dataFlowMode === 'custom' && changes.some(c => c.type === 'remove')) {
      get().saveWorkflow();
    }
  },

  onConnect: (connection: Connection) => {
    if(get().dataFlowMode==='sql')return;
    const { nodes, edges } = get();
    if (!connection.source || !connection.target) return;
    if (connection.source === connection.target) return;

    // 智能识别是否反向拖拽 (例如从输入端口拉向上游输出端口)
    let srcNodeId = connection.source;
    let tgtNodeId = connection.target;
    let srcHandle = connection.sourceHandle || 'output';
    let tgtHandle = connection.targetHandle || 'input';

    const sourceNode = nodes.find(n => n.id === srcNodeId);
    const targetNode = nodes.find(n => n.id === tgtNodeId);
    if (!sourceNode || !targetNode) return;

    // 仅当用户明确从输入端口拉向输出端口时进行翻转
    const isReversed =
      (srcHandle === 'input' || srcHandle === 'left' || srcHandle === 'right') &&
      tgtHandle === 'output';

    if (isReversed) {
      const tmpNode = srcNodeId;
      srcNodeId = tgtNodeId;
      tgtNodeId = tmpNode;
      const tmpHandle = srcHandle;
      srcHandle = 'output';
      tgtHandle = tmpHandle;
    }

    const finalSrcNode = nodes.find(n => n.id === srcNodeId);
    const finalTgtNode = nodes.find(n => n.id === tgtNodeId);
    if (!finalSrcNode || !finalTgtNode) return;

    // 数据源节点 (source) 无输入端口，不能作为下游目标
    if (finalTgtNode.data?.type === 'source') {
      toastService.warning('数据源节点 (Source) 不能作为输入下游');
      return;
    }

    // 导出节点 (export) 无输出端口，不能作为上游来源
    if (finalSrcNode.data?.type === 'export') {
      toastService.warning('导出节点 (Export) 不能作为上游来源');
      return;
    }

    // 规范 sourceHandle 始终为 output
    srcHandle = 'output';

    // 视觉锚点统一：所有边 targetHandle = input（右中→左中）
    // Join 左右语义写入 joinSide，兼容历史 left/right 句柄
    let joinSide: 'left' | 'right' | undefined;
    if (finalTgtNode.data?.type === 'join') {
      if (tgtHandle === 'left' || tgtHandle === 'right') {
        joinSide = tgtHandle;
      } else {
        const hasLeft = edges.some(
          e => e.target === tgtNodeId && (e.targetHandle === 'left' || e.data?.joinSide === 'left')
        );
        const hasRight = edges.some(
          e => e.target === tgtNodeId && (e.targetHandle === 'right' || e.data?.joinSide === 'right')
        );
        joinSide = !hasLeft ? 'left' : !hasRight ? 'right' : 'left';
      }
      tgtHandle = joinSide; // 保留 left/right id，节点上将它们叠在左中
    } else {
      tgtHandle = 'input';
    }

    // 拦截重复连线
    const isDuplicate = edges.some(
      e => e.source === srcNodeId && e.target === tgtNodeId && e.targetHandle === tgtHandle
    );
    if (isDuplicate) {
      toastService.info('该依赖连线已存在');
      return;
    }

    // 拦截循环依赖 (Cycle)
    if (wouldCreateCycle(srcNodeId, tgtNodeId, edges)) {
      toastService.warning('检测到循环依赖 (Cycle)，DAG 不允许闭环连线');
      return;
    }

    let label = '数据流';
    let relationType: 'data' | 'join' | 'filter' | 'aggregate' | 'schema' = 'data';
    if (finalTgtNode.data?.type === 'join') {
      relationType = 'join';
      label = joinSide === 'left' ? 'INNER JOIN (左)' : 'INNER JOIN (右)';
    } else if (finalTgtNode.data?.type === 'aggregate') {
      relationType = 'aggregate';
      label = 'GROUP BY';
    } else if (finalTgtNode.data?.type === 'schema') {
      relationType = 'schema';
      label = '查看元数据';
    }

    const newEdge: DataFlowEdge = {
      id: `edge_${srcNodeId}_${tgtNodeId}_${tgtHandle}_${Date.now().toString(36)}`,
      type: 'dataFlowEdge',
      source: srcNodeId,
      target: tgtNodeId,
      sourceHandle: srcHandle,
      targetHandle: tgtHandle,
      data: {
        sourceHandle: srcHandle,
        targetHandle: tgtHandle,
        joinSide,
        label,
        relationType,
      },
    };
    const nextEdges = addEdge(newEdge, edges) as DataFlowEdge[];
    const updatedNodes = markDownstreamDirty(newEdge.target, nodes, nextEdges);

    set({
      edges: nextEdges,
      nodes: updatedNodes,
    });

    if (get().dataFlowMode === 'custom') {
      get().saveWorkflow();
    }
  },

  applyExecutionEvent: (event) => {
    const current = get();
    if(event.bindingVersion!==undefined&&event.bindingVersion!==current.bindingVersion)return;
    if (current.dataFlowMode !== 'sql' || event.documentVersion !== hashSql(current.activeSql) || event.tabId !== current.activeDocumentId) return;
    if (event.status !== 'queued' && current.activeRunId && event.runId !== current.activeRunId) return;
    const statuses = { queued: 'queued', running: 'running', success: 'success', failed: 'error', cancelled: 'cancelled', skipped: 'blocked' } as const;
    const running = event.status === 'running';
    const result = event.result as any;
    set({
      activeRunId: event.runId,
      logicalFlowData:current.logicalFlowData?applyObjectRuntime(current.logicalFlowData,event):null,
      isExecuting: !event.terminal,
      executionSqlRange: running || event.status === 'failed' ? event.sourceSpan : event.terminal ? null : current.executionSqlRange,
      activeSqlRange: running || event.status === 'failed' ? event.sourceSpan : event.terminal ? null : current.activeSqlRange,
      nodes: current.nodes.map(node => node.data.statementId !== event.statementId ? node : ({ ...node, data: { ...node.data, runId: event.runId, status: statuses[event.status], executionStatus: event.status, rolledBack: event.rolledBack ?? node.data.rolledBack,
        ...(event.status === 'queued' ? { executionResult: undefined, rowCount: undefined, columnCount: undefined, executionTimeSec: undefined, rolledBack: false, isStepActive: false, isStepCompleted: false, error: undefined } : {}),
        ...(result && node.data.acceptsStatementOutput ? { rowCount: result.rows?.length, columnCount: result.columns?.length, executionTimeSec: (event.durationMs || 0) / 1000, executionResult: { status: statuses[event.status], executionTimeSec: (event.durationMs || 0) / 1000, rowCount: result.rows?.length || 0, columnCount: result.columns?.length || 0, columns: (result.columns || []).map((name: string, i: number) => ({ name, type: result.columnTypes?.[i] || 'unknown' })), rows: result.rows || [], outputRelation: 'statement result' } } : {}),
        ...(event.rolledBack ? { executionResult: undefined, rowCount: undefined, columnCount: undefined } : {}),
      } })),
      edges: current.edges.map(edge => ({ ...edge, data: { ...edge.data, isStepActive: running && current.nodes.some(n => n.id === edge.target && n.data.statementId === event.statementId) } })),
    });
  },
  selectNode: (nodeId: string | null) => {
    const { nodes, edges } = get();
    const node = nodeId ? nodes.find(n => n.id === nodeId) : null;

    if (!nodeId) {
      // 清空高亮状态
      const clearedNodes = nodes.map(n => ({
        ...n,
        data: { ...n.data, highlightState: 'none' as const },
      }));
      const clearedEdges = edges.map(e => ({
        ...e,
        data: { ...e.data, highlightState: 'none' as const },
      }));
      set({
        selectedNodeId: null,
        activeSqlRange: get().executionSqlRange,
        nodes: clearedNodes,
        edges: clearedEdges,
      });
      return;
    }

    // 1. 递归查找所有上游来源祖先 (Ancestors)
    const ancestorNodeIds = new Set<string>();
    const ancestorEdgeIds = new Set<string>();
    const upQueue = [nodeId];

    while (upQueue.length > 0) {
      const curr = upQueue.shift()!;
      const inEdges = edges.filter(e => e.target === curr);
      for (const e of inEdges) {
        ancestorEdgeIds.add(e.id);
        if (!ancestorNodeIds.has(e.source) && e.source !== nodeId) {
          ancestorNodeIds.add(e.source);
          upQueue.push(e.source);
        }
      }
    }

    // 2. 递归查找所有下游去向后代 (Descendants)
    const descendantNodeIds = new Set<string>();
    const descendantEdgeIds = new Set<string>();
    const downQueue = [nodeId];

    while (downQueue.length > 0) {
      const curr = downQueue.shift()!;
      const outEdges = edges.filter(e => e.source === curr);
      for (const e of outEdges) {
        descendantEdgeIds.add(e.id);
        if (!descendantNodeIds.has(e.target) && e.target !== nodeId) {
          descendantNodeIds.add(e.target);
          downQueue.push(e.target);
        }
      }
    }

    const hasAnyLineage = ancestorNodeIds.size > 0 || descendantNodeIds.size > 0;

    const nextNodes = nodes.map(n => {
      let hl: 'ancestor' | 'descendant' | 'dimmed' | 'none' = 'none';
      if (n.id === nodeId) {
        hl = 'none';
      } else if (ancestorNodeIds.has(n.id)) {
        hl = 'ancestor';
      } else if (descendantNodeIds.has(n.id)) {
        hl = 'descendant';
      } else if (hasAnyLineage) {
        hl = 'dimmed';
      }
      return {
        ...n,
        data: { ...n.data, highlightState: hl },
      };
    });

    const nextEdges = edges.map(e => {
      let hl: 'ancestor' | 'descendant' | 'dimmed' | 'none' = 'none';
      if (ancestorEdgeIds.has(e.id)) {
        hl = 'ancestor';
      } else if (descendantEdgeIds.has(e.id)) {
        hl = 'descendant';
      } else if (hasAnyLineage) {
        hl = 'dimmed';
      }
      return {
        ...e,
        data: { ...e.data, highlightState: hl },
      };
    });

    set({
      selectedNodeId: nodeId,
      activeSqlRange: get().executionSqlRange || node?.data.sqlRange || null,
      nodes: nextNodes,
      edges: nextEdges,
    });
  },

  focusFaultyNode: (nodeId?: string | null) => {
    const { nodes } = get();
    const target =
      (nodeId ? nodes.find(n => n.id === nodeId) : undefined) ||
      nodes.find(n => n.data.bugInfo?.hasBug || n.data.status === 'error' || n.data.hasAnomaly);

    if (!target) return null;

    get().selectNode(target.id);
    set({
      activeSqlRange: target.data.sqlRange || null,
      inspectorTab: 'config',
    });

    dispatchDataflowTraceFault({
      nodeId: target.id,
      openInspector: true,
      focusSql: true,
    });

    if (target.data.sqlRange) {
      dispatchFocusSqlEditor({ sqlRange: target.data.sqlRange });
    }

    return target.id;
  },

  setSqlLayoutMode: async (mode) => {
    set({ sqlLayoutMode: mode });
    await get().autoLayout();
  },

  autoLayout: async () => {
    if (get().dataFlowMode === 'sql' && get().logicalFlowData) {
      const flow = get().logicalFlowData!, generation = sqlSyncGeneration, width = get().canvasWidth, mode = get().sqlLayoutMode;
      const layoutGeneration = ++sqlLayoutGeneration;
      const sizes=new Map(get().nodes.filter(n=>n.type!=='logicalBoundary').map(n=>[n.id,{width:n.width||224,height:n.height||74}]));
      try {
        const canvas = await layoutLogicalFlow(flow, sizes, width, mode);
        if (layoutGeneration === sqlLayoutGeneration && generation === sqlSyncGeneration && get().dataFlowMode === 'sql' && get().logicalFlowData?.source.sourceHash === flow.source.sourceHash && width === get().canvasWidth && mode === get().sqlLayoutMode) {
          const latest = get();
          set({
            nodes: canvas.nodes.map(n => { const old = latest.nodes.find(o => o.id === n.id); return { ...n, selected: old?.selected, data: { ...n.data, ...old?.data, flowDirection: n.data.flowDirection } }; }),
            edges: canvas.edges.map(e => { const old = latest.edges.find(o => o.id === e.id); return { ...e, selected: old?.selected, data: { ...old?.data, ...e.data } }; }),
          });
        }
      } catch (error) {
        if (layoutGeneration === sqlLayoutGeneration && generation === sqlSyncGeneration) toastService.error(`布局失败：${error instanceof Error ? error.message : String(error)}`);
      }
      return;
    }
    const { nodes, edges } = get();
    if (nodes.length === 0) return;
    const laidOut = calculateDagLayout(nodes, edges);
    set({ nodes: laidOut });
  },

  updateNodeData: (nodeId: string, patch: Partial<DataFlowNode['data']>) => {
    set({
      nodes: get().nodes.map(n => {
        if (n.id === nodeId) {
          return { ...n, data: { ...n.data, ...patch } };
        }
        return n;
      }),
    });
  },

  updateNodeConfig: (nodeId: string, configPatch: any) => {
    if(get().dataFlowMode==='sql')return;
    const { nodes, edges, dataFlowMode, activeSql, activeTabTitle } = get();
    const updatedNodes = nodes.map(n => {
      if (n.id === nodeId) {
        return {
          ...n,
          data: {
            ...n.data,
            status: 'dirty' as WorkflowNodeStatus,
            config: { ...n.data.config, ...configPatch },
          },
        };
      }
      return n;
    });

    const propagatedNodes = markDownstreamDirty(nodeId, updatedNodes, edges);
    set({ nodes: propagatedNodes });

    if (dataFlowMode === 'custom') {
      get().saveWorkflow();
      return;
    }

    // ── 双向 AST / CTE 实时回写 ──
    if (dataFlowMode === 'sql' && activeSql) {
      const targetNode = propagatedNodes.find(n => n.id === nodeId);
      if (targetNode) {
        const inputs = resolveNodeInputs(nodeId, edges, propagatedNodes);
        const { sql: compiledSql } = compileNodeSql(targetNode, inputs);
        if (compiledSql) {
          const targetCteName = targetNode.data.sqlRange?.cteName || (targetNode.data.type === 'result' ? 'main_query' : targetNode.data.title);
          const rewrittenSql = updateSqlCteDefinition(activeSql, targetCteName, compiledSql);
          if (rewrittenSql && rewrittenSql !== activeSql) {
            set({ activeSql: rewrittenSql });
            window.dispatchEvent(
              new CustomEvent('workbench_tab_sql_updated', {
                detail: {
                  tabTitle: activeTabTitle,
                  sql: rewrittenSql,
                  cteName: targetCteName,
                },
              })
            );
          }
        }
      }
    }
  },

  addNode: (type: WorkflowNodeType, position?: { x: number; y: number }) => {
    if(get().dataFlowMode==='sql')return;
    const { nodes, edges, selectedNodeId } = get();
    const id = `node_${type}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;
    const pos = position || (selectedNode
      ? { x: selectedNode.position.x + 310, y: selectedNode.position.y + (type === 'join' ? 40 : 0) }
      : { x: 350 + Math.random() * 40, y: 200 + Math.random() * 40 });

    const typeTitles: Record<WorkflowNodeType, { title: string; subtitle: string }> = {
      source: { title: '新数据源', subtitle: 'Parquet / CSV / Table' },
      schema: { title: '查看 Schema', subtitle: '结构检验' },
      sql_transform: { title: 'SQL 转换', subtitle: '自定义派生' },
      join: { title: '表连接', subtitle: '多表关联' },
      aggregate: { title: '聚合统计', subtitle: '汇总指标' },
      result: { title: '结果表', subtitle: '数据预览' },
      export: { title: '导出数据', subtitle: 'Parquet' },
    };

    const newNode: DataFlowNode = {
      id,
      type: 'dataFlowNode',
      position: pos,
      data: {
        id,
        type,
        title: typeTitles[type].title,
        subtitle: typeTitles[type].subtitle,
        status: 'configured',
        config: type === 'aggregate'
          ? {
              nodeName: typeTitles[type].title,
              groupBy: [],
              aggregations: [{ id: 'a1', alias: 'total_count', func: 'COUNT', column: '*' }],
              filter: '',
            }
          : type === 'join'
          ? { joinType: 'INNER', conditions: [] }
          : type === 'sql_transform'
          ? { sql: 'SELECT * FROM {{input}}' }
          : type === 'result'
          ? { limit: 100 }
          : type === 'export'
          ? { format: 'parquet', filePath: 'export/result.parquet' }
          : type === 'source'
          ? { fileName: '', fileType: 'table', fileSize: '', filePath: '', tableName: '' }
          : type === 'schema'
          ? { checkType: 'inspect' }
          : {},
      },
    };

    const nextEdges = [...edges];
    if (selectedNode && type !== 'source') {
      const isJoin = type === 'join';
      const edge: DataFlowEdge = {
        id: `edge_${selectedNode.id}_${id}`,
        source: selectedNode.id,
        sourceHandle: 'output',
        target: id,
        targetHandle: isJoin ? 'left' : 'input',
        type: 'dataFlowEdge',
        data: {
          sourceHandle: 'output',
          targetHandle: isJoin ? 'left' : 'input',
          joinSide: isJoin ? 'left' : undefined,
          label: isJoin ? 'INNER JOIN (左)' : type === 'aggregate' ? 'GROUP BY' : '数据流',
          relationType: isJoin ? 'join' : type === 'aggregate' ? 'aggregate' : 'data',
        },
      };
      nextEdges.push(edge);
    }

    set({
      nodes: [...nodes, newNode],
      edges: nextEdges,
      selectedNodeId: id,
    });
  },

  addSourceNodeForTable: async (tableName: string, position?: { x: number; y: number }) => {
    const { nodes } = get();
    const existing = nodes.find(n => n.data.type === 'source' && n.data.config?.tableName === tableName);
    if (existing) {
      set({ selectedNodeId: existing.id });
      return;
    }

    let rowCount = 0;
    let columnCount = 0;
    let columns: any[] = [];
    let sampleRows: any[] = [];
    try {
      const countRes = await duckDBService.query(`SELECT COUNT(*) as cnt FROM "${tableName}"`);
      rowCount = Number(countRes[0]?.cnt ?? 0);
      const descRes = await duckDBService.query(`DESCRIBE "${tableName}"`);
      columnCount = descRes.length;
      columns = descRes.map((r: any) => ({
        name: String(r.column_name || Object.values(r)[0]),
        type: String(r.column_type || Object.values(r)[1] || 'VARCHAR'),
        nullable: true,
      }));
      sampleRows = await duckDBService.query(`SELECT * FROM "${tableName}" LIMIT 50`);
    } catch {}

    const id = `node_source_${Date.now().toString(36)}`;
    const pos = position || {
      x: 50 + Math.random() * 40,
      y: 100 + Math.random() * 60,
    };

    const newNode: DataFlowNode = {
      id,
      type: 'dataFlowNode',
      position: pos,
      data: {
        id,
        type: 'source',
        title: tableName,
        subtitle: `DuckDB 物理表 · ${columnCount} 字段`,
        format: 'Table',
        status: 'success',
        rowCount,
        columnCount,
        executionTimeSec: 0.02,
        config: {
          tableName,
        },
        executionResult: {
          status: 'success',
          executionTimeSec: 0.02,
          rowCount,
          columnCount,
          columns,
          rows: sampleRows,
          outputRelation: tableName,
        },
      },
    };

    set({
      nodes: [...nodes, newNode],
      selectedNodeId: id,
    });
  },

  deleteNode: (nodeId: string) => {
    if(get().dataFlowMode==='sql')return;
    const { nodes, edges, selectedNodeId } = get();
    const nextNodes = nodes.filter(n => n.id !== nodeId);
    const nextEdges = edges.filter(e => e.source !== nodeId && e.target !== nodeId);
    const propagated = markDownstreamDirty(nodeId, nextNodes, edges);

    set({
      nodes: propagated,
      edges: nextEdges,
      selectedNodeId: selectedNodeId === nodeId ? null : selectedNodeId,
    });
  },

  deleteEdge: (edgeId: string) => {
    if(get().dataFlowMode==='sql')return;
    const { nodes, edges } = get();
    const targetEdge = edges.find(e => e.id === edgeId);
    const nextEdges = edges.filter(e => e.id !== edgeId);

    if (targetEdge) {
      const propagated = markDownstreamDirty(targetEdge.target, nodes, nextEdges);
      set({ edges: nextEdges, nodes: propagated });
    } else {
      set({ edges: nextEdges });
    }
  },

  refreshAvailableTables: async () => {
    const catalog = duckDBService.getRuntimeInfo().currentDatabase;
    try {
      const tbls = await duckDBService.getTables();
      if (duckDBService.getRuntimeInfo().currentDatabase !== catalog) return;
      const filtered = tbls.filter(t => !t.startsWith('_df_view_') && !t.startsWith('_sys_'));
      set({ availableTables: filtered });
    } catch (e) {
      console.error('[refreshAvailableTables] error:', e);
    }
  },

  resetDatabaseContext: () => {
    ++sqlSyncGeneration;
    if (stepperTimer) { clearInterval(stepperTimer); stepperTimer = null; }
    set((state) => ({
      nodes: [], edges: [], selectedNodeId: null, runLogs: [], availableTables: [],bindingVersion:sqlSyncGeneration,logicalFlowData:null,activeRunId:null,executionSqlRange:null,activeDocumentId:'',
      isExecuting: false, activeSql: '', activeTabTitle: '', activeSqlRange: null,
      syncStatus: 'idle', lastSyncError: null,
      stepperState: { ...state.stepperState, isActive: false, isPlaying: false, activeNodeId: null },
    }));
  },

  setDataFlowMode: async (mode: DataFlowMode, focusTableName?: string) => {
    ++sqlSyncGeneration; // Discard in-flight SQL work before changing the source of the graph.
    set({ dataFlowMode: mode, liveSyncWithSql: mode === 'sql' });
    if (mode === 'catalog') {
      await get().syncFromCatalog(focusTableName);
    } else if (mode === 'sql' && get().activeSql) {
      await get().syncFromSql(get().activeSql, get().activeTabTitle, true);
    }
  },

  setLiveSyncWithSql: (liveSyncWithSql: boolean) => {
    set({ liveSyncWithSql });
  },

  /**
   * 从 SQL 工作台的当前 SQL 语句实时解析并生成 DAG
   */
  syncFromSql: async (sql: string, tabTitle?: string, isManual: boolean = false, documentId?: string) => {
    const generation = ++sqlSyncGeneration;
    set({bindingVersion:generation});

    if (!stripSqlHeader(sql || '')) {
      if (generation !== sqlSyncGeneration) return;
      set({
        activeSql: '',
        logicalFlowData: null, activeRunId: null, executionSqlRange: null, isExecuting: false, activeDocumentId: documentId ?? get().activeDocumentId,
        activeTabTitle: tabTitle || get().activeTabTitle,
        nodes: [],
        edges: [],
        selectedNodeId: null,
        activeSqlRange: null,
        syncStatus: 'idle',
        lastSyncError: null,
        dataFlowMode: 'sql',
      });
      return;
    }

    const trimmedSql = sql;

    // 切换 Tab/查询时立即清空旧图；在同一 Tab 内编辑时双缓冲保留旧节点防白屏闪烁
    const currentTab = get().activeTabTitle;

    set({
      activeSql: trimmedSql,
      activeDocumentId: documentId ?? get().activeDocumentId,
      activeTabTitle: tabTitle || currentTab,
      syncStatus: 'syncing',
      lastSyncError: null,
      logicalFlowData: null,
      activeRunId: null,
      executionSqlRange: null,
      isExecuting: false,
      dataFlowMode: 'sql',
      liveSyncWithSql: true,
      // The current SQL is the only source of truth: invalidate the previous
      // graph immediately, including edits within the same tab.
      nodes: [],
      edges: [],
      selectedNodeId: null,
      activeSqlRange: null,
    });

    // Keep the invalidated state observable for the editor frame before
    // parsing the replacement SQL.
    await Promise.resolve();
    if (generation !== sqlSyncGeneration) return;

    try {
      const context=await duckDBService.getLogicalFlowContext().catch(()=>({}));
      if(generation!==sqlSyncGeneration)return;
      const flow = parseLogicalRelationFlow(trimmedSql,context);
      if (generation !== sqlSyncGeneration) return;
      let width = get().canvasWidth, mode = get().sqlLayoutMode;
      let canvas = await layoutLogicalFlow(flow, new Map(), width, mode);
      while (generation === sqlSyncGeneration && (width !== get().canvasWidth || mode !== get().sqlLayoutMode)) {
        width = get().canvasWidth; mode = get().sqlLayoutMode;
        canvas = await layoutLogicalFlow(flow, new Map(), width, mode);
      }
      if (generation !== sqlSyncGeneration) return;
      const realNodes = canvas.nodes;
      const realEdges = canvas.edges;
      const faultyNodeId = flow.status === 'parse_error' ? realNodes.find(node => node.data.bugInfo?.hasBug)?.id : undefined;

      if (generation !== sqlSyncGeneration) return;

      if (realNodes.length === 0) {
        set({
          nodes: [],
          edges: [],
          selectedNodeId: null,
          activeSqlRange: null,
          syncStatus: flow.status === 'parse_error' ? 'error' : 'ready',
          lastSyncError: flow.diagnostics[0]?.message || null,
          logicalFlowData: flow,
        });
        return;
      }

      const currentSelectedId = get().selectedNodeId;
      const targetSelectedId = faultyNodeId
        ? faultyNodeId
        : currentSelectedId && realNodes.some(n => n.id === currentSelectedId)
        ? currentSelectedId
        : realNodes[realNodes.length - 1].id;

      const faultyNode = faultyNodeId ? realNodes.find(n => n.id === faultyNodeId) : undefined;

      const newLog: WorkflowRunLog = {
        id: generateWorkflowLogId(),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        runId: `run_${Date.now().toString(36)}`,
        nodeId: targetSelectedId || 'global',
        nodeName: tabTitle || 'SQL 执行路径构建',
        nodeType: 'Logical Relation Flow',
        status: faultyNodeId ? 'error' : 'success',
        rows: realNodes[realNodes.length - 1]?.data.rowCount || 0,
        duration: '—',
        message: `已基于当前 SQL 生成 ${realNodes.length} 个逻辑节点与 ${realEdges.length} 条关系连线`,
      };

      set(state => ({
        dataFlowMode: 'sql',
        activeSql: trimmedSql,
      activeDocumentId: documentId ?? get().activeDocumentId,
        nodes: realNodes,
        edges: realEdges,
        selectedNodeId: targetSelectedId,
        activeSqlRange: faultyNode?.data.sqlRange || state.activeSqlRange,
        syncStatus: flow.status === 'parse_error' ? 'error' : 'ready',
        lastSyncError: flow.diagnostics.find(d => d.severity !== 'info')?.message || null,
        logicalFlowData: flow,
        runLogs: isManual || state.runLogs.length === 0
          ? [newLog, ...state.runLogs]
          : state.runLogs,
      }));

      if (faultyNodeId && isManual) {
        queueMicrotask(() => {
          if (generation === sqlSyncGeneration) {
            get().focusFaultyNode(faultyNodeId);
          }
        });
      }
    } catch (err: any) {
      if (generation !== sqlSyncGeneration) return;
      const message = err?.message || String(err);
      console.error('[syncFromSql] parse failed:', err);
      set({
        syncStatus: 'error',
        lastSyncError: message,
      });
    }
  },

  /**
   * 双向联动：根据 CodeMirror 编辑器当前光标行号，自动反向聚焦对应 CTE 节点
   */
  syncCursorLine: (lineNumber: number) => {
    if (get().executionSqlRange) return;
    const { nodes, selectedNodeId } = get();
    const matchedNode = nodes.find(n => {
      const range = n.data.sqlRange;
      if (!range) return false;
      return lineNumber >= range.startLine && lineNumber <= range.endLine;
    });
    if (matchedNode && matchedNode.id !== selectedNodeId) {
      get().selectNode(matchedNode.id);
      dispatchDataflowTraceFault({
        nodeId: matchedNode.id,
        openInspector: false,
        focusSql: false,
        centerOnly: true,
      });
    }
  },

  /**
   * 就地对单个 CTE 节点进行独立试跑并获取前 50 行数据样本
   */
  runSingleCte: async (nodeId: string) => {
    if (get().dataFlowMode === 'sql') { toastService.info('SQL 逻辑阶段不能独立执行；请执行完整 Statement'); return; }
    const { nodes, edges } = get();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    get().updateNodeData(nodeId, { status: 'running' });
    try {
      const inputs = resolveNodeInputs(nodeId, edges, nodes);
      const { sql } = compileNodeSql(node, inputs);
      if (!sql) throw new Error('无法生成该节点的执行 SQL');

      const viewName = getNodeViewName(nodeId);
      await duckDBService.query(`CREATE OR REPLACE TEMP VIEW "${viewName}" AS ${sql}`);
      const countRes = await duckDBService.query(`SELECT COUNT(*) as cnt FROM "${viewName}"`);
      const rowCount = Number(countRes[0]?.cnt ?? 0);
      const descRes = await duckDBService.query(`DESCRIBE SELECT * FROM "${viewName}" LIMIT 0`);
      const columns = descRes.map((r: any) => ({
        name: String(r.column_name || Object.values(r)[0]),
        type: String(r.column_type || Object.values(r)[1] || 'VARCHAR'),
        nullable: true,
      }));
      const previewRows = await duckDBService.query(`SELECT * FROM "${viewName}" LIMIT 50`);

      get().updateNodeData(nodeId, {
        rowCount,
        columnCount: columns.length,
        status: 'success',
        executionResult: {
          status: 'success',
          executionTimeSec: 0.02,
          rowCount,
          columnCount: columns.length,
          columns,
          rows: previewRows,
          outputRelation: viewName,
          compiledSql: sql,
        },
      });
      toastService.success(`已就地试跑「${node.data.title}」，获得 ${rowCount.toLocaleString()} 行样本`);
    } catch (err: any) {
      get().updateNodeData(nodeId, { status: 'error' });
      toastService.error(`试跑失败: ${err.message}`);
    }
  },

  /**
   * 从 DuckDB 数据库 Catalog (已存在 Tables 与 Views) 同步血缘图
   */
  syncFromCatalog: async (focusTableName?: string) => {
    try {
      const allTables = await duckDBService.getTables();
      const tables = allTables.filter(t => !t.startsWith('_df_view_') && !t.startsWith('_sys_'));
      if (tables.length === 0) return;

      // 查询所有 view 的定义 SQL
      let viewDefs: any[] = [];
      try {
        viewDefs = await duckDBService.query(`
          SELECT view_name, sql FROM duckdb_views() WHERE schema_name = 'main'
        `);
      } catch {}

      const viewMap = new Map<string, string>();
      viewDefs.forEach((r: any) => {
        if (r.view_name && r.sql) {
          viewMap.set(String(r.view_name).toLowerCase(), String(r.sql));
        }
      });

      const catalogItems = tables.map(t => {
        const isView = viewMap.has(t.toLowerCase()) || t.startsWith('v_');
        return {
          name: t,
          isView,
          sql: viewMap.get(t.toLowerCase()),
        };
      });

      const parsed = parseCatalogToWorkflow(catalogItems);
      const enrichedNodes = await enrichNodesWithDuckDB(parsed.nodes, parsed.edges);

      const targetNode = focusTableName
        ? enrichedNodes.find(n => n.data.title.toLowerCase() === focusTableName.toLowerCase())
        : null;

      const newLog: WorkflowRunLog = {
        id: generateWorkflowLogId(),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        runId: `run_${Date.now().toString(36)}`,
        nodeId: 'catalog',
        nodeName: 'DuckDB 全库血缘',
        nodeType: 'Catalog',
        status: 'success',
        rows: enrichedNodes.reduce((sum, n) => sum + (n.data.rowCount || 0), 0),
        duration: '0.05s',
        message: `已同步 DuckDB 实例中全部 ${enrichedNodes.length} 个表/视图血缘节点`,
      };

      set(state => ({
        nodes: enrichedNodes,
        edges: parsed.edges,
        selectedNodeId: targetNode ? targetNode.id : (enrichedNodes[0]?.id || null),
        runLogs: [newLog, ...state.runLogs],
      }));
    } catch (e) {
      console.error('[syncFromCatalog] error:', e);
    }
  },

  /**
   * 当 SQL 工作台运行查询完成后，实时同步真实结果给全链路对应节点
   */
  syncExecutionResult: async (tabTitle: string, result: any, executedSql?: string) => {
    if (!result) return;
    const currentSql = (executedSql || get().activeSql || '').trim();
    // Ignore stale result sync when the editor SQL has already moved on
    if (executedSql && get().activeSql.trim() && get().activeSql.trim() !== currentSql) {
      return;
    }
    const generationAtStart = sqlSyncGeneration;

    // SQL graphs are immutable projections. Execution events attach measured output only.
    if (get().dataFlowMode === 'sql') return;
  },

  /**
   * 结果反向溯源：从指定节点（默认最终结果）溯源至底层所有数据源
   */
  traceReverseLineage: (targetNodeId?: string) => {
    const { nodes, edges } = get();
    const resultNode = targetNodeId
      ? nodes.find(n => n.id === targetNodeId)
      : nodes.find(n => n.data.type === 'result') || nodes[nodes.length - 1];

    if (!resultNode) {
      toastService.warning('未找到可追溯的目标节点');
      return;
    }

    const { ancestorNodeIds, ancestorEdgeIds } = traceUpstreamLineage(nodes, edges, resultNode.id);

    const updatedNodes = nodes.map(n => ({
      ...n,
      data: {
        ...n.data,
        highlightState: ancestorNodeIds.has(n.id) ? ('ancestor' as const) : ('dimmed' as const),
      },
    }));

    const updatedEdges = edges.map(e => ({
      ...e,
      animated: ancestorEdgeIds.has(e.id),
      data: {
        ...e.data,
        highlightState: ancestorEdgeIds.has(e.id) ? ('ancestor' as const) : ('dimmed' as const),
      },
    }));

    set({
      nodes: updatedNodes,
      edges: updatedEdges,
      isReverseTracing: true,
      selectedNodeId: resultNode.id,
    });

    toastService.info(`已高亮从「${resultNode.data.title}」至底层数据源的完整反向追溯路径`);
  },

  /**
   * 清除反向溯源高亮模式
   */
  clearLineageTrace: () => {
    const { nodes, edges } = get();
    const updatedNodes = nodes.map(n => ({
      ...n,
      data: {
        ...n.data,
        highlightState: 'none' as const,
      },
    }));
    const updatedEdges = edges.map(e => ({
      ...e,
      data: {
        ...e.data,
        highlightState: 'none' as const,
      },
    }));
    set({
      nodes: updatedNodes,
      edges: updatedEdges,
      isReverseTracing: false,
    });
  },

  /**
   * 将当前画布编译为一条完整带 CTE 的 SQL 语句
   */
  compileWorkflowToSql: () => {
    const { nodes, edges } = get();
    return compileWorkflowToFullSql(nodes, edges);
  },

  runNode: async (nodeId: string) => {
    if (get().dataFlowMode === 'sql') { toastService.info('请在编辑器执行完整 Statement'); return; }
    const { nodes, edges, isExecuting } = get();
    if (isExecuting) return;

    set({ isExecuting: true });

    try {
      await WorkflowExecutor.executeWithUpstream(nodeId, nodes, edges, {
        onLog: log => {
          set(state => ({
            runLogs: [log, ...state.runLogs],
          }));
        },
        onNodeStateChange: (nId, patch) => {
          set(state => ({
            nodes: state.nodes.map(node =>
              node.id === nId ? { ...node, data: { ...node.data, ...patch } } : node
            ),
          }));
        },
      });

      // 执行成功后派发全局事件，通知 SQL 工作台与对象树自动发现新视图
      window.dispatchEvent(new CustomEvent('duckdb-schema-changed'));
      const ranNode = get().nodes.find(n => n.id === nodeId);
      if (ranNode?.data.status === 'success') {
        toastService.success(`节点「${ranNode.data.title}」执行成功`);
      } else if (ranNode?.data.status === 'error') {
        toastService.error(`节点「${ranNode.data.title}」执行失败，请在右侧检查配置或 SQL`);
      }
    } catch (err: any) {
      console.error('[runNode error]:', err);
      toastService.error(`执行出错: ${err?.message || String(err)}`);
    } finally {
      set({ isExecuting: false });
    }
  },

  cancelSqlRun:()=>{const runId=get().activeRunId;if(runId)cancelStatementExecution(runId);},
  runAll: async () => {
    if (get().dataFlowMode === 'sql') {
      const sql = get().activeSql;
      if (get().isExecuting || !sql.trim()) return;
      await get().syncFromSql(sql, get().activeTabTitle, false, get().activeDocumentId);
      const result = await duckDBService.queryWithMetadata(sql, { tabId: get().activeDocumentId, documentSql: sql, baseOffset: 0, bindingVersion:get().bindingVersion });
      if (result.error) toastService.error(result.error);
      return;
    }
    const { nodes, edges, isExecuting } = get();
    if (isExecuting || nodes.length === 0) return;

    set({ isExecuting: true });
    try {
      const { order, hasCycle } = sortWorkflowTopologically(nodes, edges);
      if (hasCycle) {
        toastService.error('流水线存在循环依赖 (Cycle)，无法依拓扑序执行');
        return;
      }

      // 按拓扑序执行节点（已处于 success 且非 dirty 的节点跳过重复计算）
      for (const nodeId of order) {
        const currNode = get().nodes.find(n => n.id === nodeId);
        if (!currNode) continue;

        if (currNode.data.status === 'success' && currNode.data.rowCount !== undefined) {
          continue;
        }

        const res = await WorkflowExecutor.executeNode(nodeId, get().nodes, get().edges, {
          onLog: log => {
            set(state => ({ runLogs: [log, ...state.runLogs] }));
          },
          onNodeStateChange: (nId, patch) => {
            set(state => ({
              nodes: state.nodes.map(node =>
                node.id === nId ? { ...node, data: { ...node.data, ...patch } } : node
              ),
            }));
          },
        });

        if (res.status === 'error') {
          toastService.error(`节点「${currNode.data.title}」执行失败，已中断后续流程`);
          break;
        }
      }

      window.dispatchEvent(new CustomEvent('duckdb-schema-changed'));
      toastService.success('全流程按拓扑依赖序执行完毕');
    } catch (err: any) {
      console.error('[runAll error]:', err);
      toastService.error(`执行异常: ${err?.message || String(err)}`);
    } finally {
      set({ isExecuting: false });
    }
  },

  setAutoScrollLogs: (autoScrollLogs: boolean) => set({ autoScrollLogs }),
  setBottomDrawerTab: bottomDrawerTab => set({ bottomDrawerTab }),
  setInspectorTab: inspectorTab => set({ inspectorTab }),
  setIsBottomDrawerOpen: isBottomDrawerOpen => set({ isBottomDrawerOpen }),
  toggleBottomDrawer: () => set(state => ({ isBottomDrawerOpen: !state.isBottomDrawerOpen })),
  setViewport: viewport => set({ viewport }),
  clearLogs: () => set({ runLogs: [] }),

  traceBugNode: () => {
    return get().focusFaultyNode(null);
  },

  toggleNodeExpanded: (nodeId: string) => {
    set(state => ({
      nodes: state.nodes.map(n =>
        n.id === nodeId ? { ...n, data: { ...n.data, isExpanded: !n.data.isExpanded } } : n
      ),
    }));
  },

  /** Never persist graph structure — Flow is always rebuilt from current SQL. */
  saveWorkflow: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      set({ lastSavedAt: new Date().toLocaleTimeString() });
    } catch (e) {
      console.error('[saveWorkflow error]:', e);
    }
  },

  loadWorkflow: async (initialSql?: string, tabTitle?: string) => {
    await get().refreshAvailableTables();

    // Sole source of truth: current SQL. Never resurrect localStorage mock/demo graphs.
    const sqlToLoad = initialSql !== undefined ? initialSql : get().activeSql;
    const titleToUse = tabTitle || get().activeTabTitle || 'SQL 查询';

    if (sqlToLoad && sqlToLoad.trim()) {
      await get().syncFromSql(sqlToLoad, titleToUse);
      return;
    }

    await get().syncFromSql('', titleToUse);
  },

  // ── 单步仿真推演步进器实现 ──
  startStepping: () => {
    if(get().dataFlowMode==='sql')return;
    const { nodes } = get();
    if (nodes.length === 0) return;
    const sorted = [...nodes].sort((a, b) => (a.data.stepIndex || 0) - (b.data.stepIndex || 0));
    const firstStep = sorted[0]?.data.stepIndex || 1;
    const maxStep = sorted[sorted.length - 1]?.data.stepIndex || sorted.length;
    get().setStepIndex(firstStep);
    set(state => ({
      stepperState: {
        ...state.stepperState,
        isActive: true,
        currentStepIndex: firstStep,
        totalSteps: maxStep,
        isPlaying: false,
      },
    }));
    toastService.info('已开启 SQL 执行单步推演仿真器');
  },

  stopStepping: () => {
    if (stepperTimer) {
      clearInterval(stepperTimer);
      stepperTimer = null;
    }
    const { nodes, edges } = get();
    const resetNodes = nodes.map(n => ({
      ...n,
      data: {
        ...n.data,
        isStepActive: false,
        isStepCompleted: false,
      },
    }));
    const resetEdges = edges.map(e => ({
      ...e,
      data: {
        ...e.data,
        isStepActive: false,
      },
    }));
    set(state => ({
      nodes: resetNodes,
      edges: resetEdges,
      stepperState: {
        ...state.stepperState,
        isActive: false,
        isPlaying: false,
      },
    }));
    toastService.info('已退出单步推演仿真器');
  },

  setStepIndex: (stepIndex: number) => {
    if(get().dataFlowMode==='sql')return;
    const { nodes, edges } = get();
    const sorted = [...nodes].sort((a, b) => (a.data.stepIndex || 0) - (b.data.stepIndex || 0));
    const maxStep = sorted[sorted.length - 1]?.data.stepIndex || sorted.length;
    const clampedStep = Math.max(1, Math.min(stepIndex, maxStep));
    const activeNode = sorted.find(n => n.data.stepIndex === clampedStep) || sorted[clampedStep - 1];

    const updatedNodes = nodes.map(n => {
      const idx = n.data.stepIndex || 0;
      const isActive = n.id === activeNode?.id || idx === clampedStep;
      const isCompleted = idx < clampedStep;
      return {
        ...n,
        data: {
          ...n.data,
          isStepActive: isActive,
          isStepCompleted: isCompleted,
          status: (isCompleted ? 'success' : isActive ? (n.data.bugInfo?.hasBug ? 'error' : 'running') : 'idle') as WorkflowNodeStatus,
        },
      };
    });

    const activeNodeId = activeNode?.id || null;
    const completedNodeIds = new Set(updatedNodes.filter(n => n.data.isStepCompleted).map(n => n.id));
    if (activeNodeId) completedNodeIds.add(activeNodeId);

    const updatedEdges = edges.map(e => ({
      ...e,
      data: {
        ...e.data,
        isStepActive: completedNodeIds.has(e.source) && (e.target === activeNodeId || completedNodeIds.has(e.target)),
      },
    }));

    set(state => ({
      nodes: updatedNodes,
      edges: updatedEdges,
      selectedNodeId: activeNodeId,
      stepperState: {
        ...state.stepperState,
        isActive: true,
        currentStepIndex: clampedStep,
        totalSteps: maxStep,
        activeNodeId,
      },
    }));

    if (activeNode) {
      if (activeNode.data.bugInfo?.hasBug) {
        toastService.error(`🚨 单步仿真触达 Bug 点位：「${activeNode.data.title}」: ${activeNode.data.bugInfo.title}`);
        if (stepperTimer) {
          clearInterval(stepperTimer);
          stepperTimer = null;
          set(state => ({ stepperState: { ...state.stepperState, isPlaying: false } }));
        }
      } else {
        toastService.info(`推演进度 STEP 0${clampedStep}: ${activeNode.data.title}`);
      }
    }
  },

  stepNext: () => {
    const { stepperState, setStepIndex } = get();
    if (stepperState.currentStepIndex < stepperState.totalSteps) {
      setStepIndex(stepperState.currentStepIndex + 1);
    } else {
      toastService.success('SQL 全流程单步推演已执行完毕');
    }
  },

  stepPrev: () => {
    const { stepperState, setStepIndex } = get();
    if (stepperState.currentStepIndex > 1) {
      setStepIndex(stepperState.currentStepIndex - 1);
    }
  },

  togglePlayStepping: () => {
    const { stepperState } = get();
    if (stepperState.isPlaying) {
      if (stepperTimer) {
        clearInterval(stepperTimer);
        stepperTimer = null;
      }
      set(state => ({ stepperState: { ...state.stepperState, isPlaying: false } }));
    } else {
      set(state => ({ stepperState: { ...state.stepperState, isPlaying: true } }));
      if (stepperTimer) clearInterval(stepperTimer);
      stepperTimer = setInterval(() => {
        const curr = get().stepperState;
        if (curr.currentStepIndex < curr.totalSteps) {
          get().stepNext();
        } else {
          if (stepperTimer) {
            clearInterval(stepperTimer);
            stepperTimer = null;
          }
          set(state => ({ stepperState: { ...state.stepperState, isPlaying: false } }));
          toastService.success('SQL 执行全流程自动演示完成');
        }
      }, stepperState.playbackSpeedMs || 1600);
    }
  },

  loadPitfallPreset: (presetId: string) => {
    const preset = SQL_PITFALL_PRESETS.find(p => p.id === presetId);
    if (!preset) return null;
    // Preset only injects SQL text; graph must still be derived via syncFromSql (no static nodes).
    void get().syncFromSql(preset.buggySql, preset.name, true);
    toastService.info(`已加载演练 SQL：「${preset.name}」，流程图已按该 SQL 重建`);
    return { buggySql: preset.buggySql, preset };
  },

  /** Rebuild from current SQL only — never inject hardcoded ecommerce demo nodes. */
  resetToDefaultDemo: async () => {
    localStorage.removeItem(STORAGE_KEY);
    await get().refreshAvailableTables();
    const sql = get().activeSql;
    if (sql.trim()) {
      await get().syncFromSql(sql, get().activeTabTitle || 'SQL 查询', true);
      toastService.success('已根据当前 SQL 重建流程图');
      return;
    }
    set({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      activeSqlRange: null,
      runLogs: [],
      dataFlowMode: 'sql',
      liveSyncWithSql: true,
      syncStatus: 'idle',
      lastSyncError: null,
    });
    toastService.info('编辑器无 SQL：流程图已清空，请输入查询后自动生成');
  },
}));

subscribeStatementExecution(event => useWorkflowStore.getState().applyExecutionEvent(event));
