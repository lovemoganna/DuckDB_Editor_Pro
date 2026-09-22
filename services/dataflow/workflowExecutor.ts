/**
 * Workflow Executor
 *
 * 核心职责：
 * 1. 节点执行引擎：调用真实 DuckDB Adapter 执行 SQL 并维护内存视图
 * 2. 上下游依赖调度：自动解析并依拓扑序执行未就绪的上游节点
 * 3. 结果采集：真实获取 rowCount, columnCount, columns schema, preview rows, duration
 * 4. 真实 Parquet 导出：调用 duckDBService.exportParquet 生成二进制并触发下载
 * 5. 结构化日志写入：严格记录执行耗时、行数、异常信息
 */

import { duckDBService } from '../duckdbService';
import {
  compileNodeSql,
  getNodeViewName,
  resolveNodeInputs,
  sortWorkflowTopologically,
} from './workflowCompiler';
import type {
  DataFlowNode,
  DataFlowEdge,
  NodeExecutionResult,
  WorkflowRunLog,
  ExportNodeConfig,
} from './workflowTypes';

export interface ExecuteOptions {
  runUpstreamIfDirty?: boolean;
  onLog?: (log: WorkflowRunLog) => void;
  onNodeStateChange?: (nodeId: string, patch: Partial<DataFlowNode['data']>) => void;
}

export class WorkflowExecutor {
  /**
   * 执行单个指定节点
   */
  static async executeNode(
    nodeId: string,
    nodes: DataFlowNode[],
    edges: DataFlowEdge[],
    options: ExecuteOptions = {}
  ): Promise<NodeExecutionResult> {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    const runId = `run_${Date.now()}`;
    const startTime = performance.now();
    const viewName = getNodeViewName(nodeId);

    // 解析输入依赖
    const inputs = resolveNodeInputs(nodeId, edges, nodes);

    // 状态变更为 running
    options.onNodeStateChange?.(nodeId, { status: 'running' });

    // 编译 SQL
    const { sql, error: compileError } = compileNodeSql(node, inputs);

    if (compileError) {
      const durationSec = (performance.now() - startTime) / 1000;
      const result: NodeExecutionResult = {
        status: 'error',
        executionTimeSec: Number(durationSec.toFixed(2)),
        rowCount: 0,
        columnCount: 0,
        columns: [],
        rows: [],
        outputRelation: viewName,
        errorMessage: compileError,
        compiledSql: sql,
      };

      options.onNodeStateChange?.(nodeId, {
        status: 'error',
        executionResult: result,
      });

      options.onLog?.({
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        runId,
        nodeId: node.id,
        nodeName: node.data.title,
        nodeType: node.data.type,
        status: 'error',
        rows: 0,
        duration: `${durationSec.toFixed(2)}s`,
        message: compileError,
        error: compileError,
      });

      return result;
    }

    try {
      // 1. 在 DuckDB 中创建/替换该节点的独立临时视图
      const createViewSql = `CREATE OR REPLACE TEMP VIEW "${viewName}" AS ${sql}`;
      await duckDBService.query(createViewSql);

      // 若节点拥有用户/CTE 名称（如 clean_sales），同时建立同名临时视图，供下游节点与 SQL 工作台直接无缝查询
      const cleanTitle = node.data.title.trim().replace(/^["`]|["`]$/g, '');
      const safeTitle = cleanTitle.replace(/[^a-zA-Z0-9_]/g, '_');
      if (safeTitle && safeTitle !== viewName && !/^\d+$/.test(safeTitle)) {
        try {
          await duckDBService.query(`CREATE OR REPLACE TEMP VIEW "${safeTitle}" AS SELECT * FROM "${viewName}"`);
        } catch (e) {
          console.warn('[WorkflowExecutor] alias view create skipped:', safeTitle, e);
        }
      }

      // 2. 真实查询行数
      const countRes = await duckDBService.query(`SELECT COUNT(*) as cnt FROM "${viewName}"`);
      const rowCount = Number(countRes[0]?.cnt ?? 0);

      // 3. 真实查询字段结构
      const descRes = await duckDBService.query(`DESCRIBE SELECT * FROM "${viewName}" LIMIT 0`);
      const columns = descRes.map((r: any) => ({
        name: String(r.column_name || Object.values(r)[0]),
        type: String(r.column_type || Object.values(r)[1] || 'VARCHAR'),
        nullable: String(r.null || '').toLowerCase() === 'yes',
      }));

      // 4. 真实采样数据用于 Data Preview
      const sampleRows = await duckDBService.query(`SELECT * FROM "${viewName}" LIMIT 100`);

      // 5. 如果是 Export 节点，执行真实导出
      if (node.data.type === 'export') {
        const expConfig = node.data.config as ExportNodeConfig;
        const format = (expConfig.format || 'parquet').toLowerCase();
        let ext = 'parquet';
        let mimeType = 'application/vnd.apache.parquet';
        let copyOptions = '(FORMAT PARQUET)';

        if (format === 'csv') {
          ext = 'csv';
          mimeType = 'text/csv';
          copyOptions = '(FORMAT CSV, HEADER)';
        } else if (format === 'json') {
          ext = 'json';
          mimeType = 'application/json';
          copyOptions = '(FORMAT JSON, ARRAY true)';
        }

        const baseName = (node.data.title || 'export').replace(/\.[a-zA-Z0-9]+$/, '');
        const filename = expConfig.filePath || `${baseName}.${ext}`;

        let blob: Blob;
        if (format === 'parquet') {
          blob = await duckDBService.exportParquet(`SELECT * FROM "${viewName}"`, filename);
        } else {
          const tempPath = `temp_export_${Date.now()}.${ext}`;
          await duckDBService.query(`COPY (SELECT * FROM "${viewName}") TO '${tempPath}' ${copyOptions}`);
          const buffer = await (duckDBService as any).db.copyFileToBuffer(tempPath);
          blob = new Blob([buffer as any], { type: mimeType });
        }
        
        // 触发浏览器原生下载
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename.split('/').pop() || `export.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      const durationSec = (performance.now() - startTime) / 1000;
      const durationFormatted = durationSec < 0.1 ? '< 0.1s' : `${durationSec.toFixed(1)}s`;

      const result: NodeExecutionResult = {
        status: 'success',
        executionTimeSec: Number(durationSec.toFixed(2)),
        rowCount,
        columnCount: columns.length,
        columns,
        rows: sampleRows,
        outputRelation: viewName,
        compiledSql: sql,
      };

      options.onNodeStateChange?.(nodeId, {
        status: 'success',
        executionTimeSec: Number(durationSec.toFixed(2)),
        rowCount,
        columnCount: columns.length,
        executionResult: result,
      });

      options.onLog?.({
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        runId,
        nodeId: node.id,
        nodeName: node.data.title,
        nodeType: node.data.type,
        status: 'success',
        rows: rowCount,
        duration: durationFormatted,
        message: `${node.data.title} 执行完成`,
      });

      return result;
    } catch (err: any) {
      const durationSec = (performance.now() - startTime) / 1000;
      const errorMsg = err?.message || String(err);

      const result: NodeExecutionResult = {
        status: 'error',
        executionTimeSec: Number(durationSec.toFixed(2)),
        rowCount: 0,
        columnCount: 0,
        columns: [],
        rows: [],
        outputRelation: viewName,
        errorMessage: errorMsg,
        compiledSql: sql,
      };

      options.onNodeStateChange?.(nodeId, {
        status: 'error',
        executionResult: result,
      });

      options.onLog?.({
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        runId,
        nodeId: node.id,
        nodeName: node.data.title,
        nodeType: node.data.type,
        status: 'error',
        rows: 0,
        duration: `${durationSec.toFixed(2)}s`,
        message: `执行失败: ${errorMsg}`,
        error: errorMsg,
      });

      return result;
    }
  }

  /**
   * 自动调度上游未运行的依赖节点并执行目标节点
   */
  static async executeWithUpstream(
    targetNodeId: string,
    nodes: DataFlowNode[],
    edges: DataFlowEdge[],
    options: ExecuteOptions = {}
  ): Promise<NodeExecutionResult> {
    // 找出所有前置依赖祖先
    const ancestors = new Set<string>();
    const findAncestors = (currId: string) => {
      const inEdges = edges.filter(e => e.target === currId);
      for (const e of inEdges) {
        if (!ancestors.has(e.source)) {
          ancestors.add(e.source);
          findAncestors(e.source);
        }
      }
    };
    findAncestors(targetNodeId);

    // 拓扑排序全部节点
    const { order } = sortWorkflowTopologically(nodes, edges);

    // 仅筛选处于当前祖先链路中的节点，依拓扑序执行
    const queue = order.filter(id => ancestors.has(id));

    for (const upstreamId of queue) {
      const upstreamNode = nodes.find(n => n.id === upstreamId);
      if (!upstreamNode) continue;

      // 如果上游处于未就绪状态 (idle, dirty, configured, error)
      if (
        upstreamNode.data.status === 'idle' ||
        upstreamNode.data.status === 'dirty' ||
        upstreamNode.data.status === 'configured' ||
        upstreamNode.data.status === 'error'
      ) {
        const upRes = await this.executeNode(upstreamId, nodes, edges, options);
        if (upRes.status === 'error') {
          throw new Error(`上游依赖节点 "${upstreamNode.data.title}" 执行失败`);
        }
      }
    }

    // 执行目标节点
    return this.executeNode(targetNodeId, nodes, edges, options);
  }
}
