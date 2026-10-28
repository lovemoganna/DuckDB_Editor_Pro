/**
 * services/workbench/queryExecutionService.ts
 *
 * Backend Query Execution Layer for DuckDB Workbench (BRD index10.md Section 3.1, 3.2, 3.5).
 * Responsibilities:
 * - Maintain ExecutionTasks with statuses ('running', 'success', 'failed', 'cancelled').
 * - Prevent concurrent duplicate executions on the same tab.
 * - Cancel execution with CancellationToken / abort signals.
 * - Parse DuckDB syntax error lines and columns for precise editor highlighting.
 * - Create immutable QuerySnapshots upon success and register with QuerySnapshotManager.
 */

import { duckDBService } from '../duckdbService';
import type { ExecutionTask, QuerySnapshot } from './types';
import { querySnapshotManager } from './querySnapshotManager';
import { useSqlEditorStore } from '../../hooks/store/useSqlEditorStore';
import { useAppStore } from '../../hooks/store/useAppStore';
import { useWorkflowStore } from '../dataflow/workflowStore';
import {splitSqlScript} from '../dataflow/sqlStructure';
import type { ScriptExecutionContext } from '../dataflow/sqlScriptExecution';

export class QueryExecutionService {
  private activeTasks: Map<string, ExecutionTask> = new Map();

  /**
   * Check if a tab is currently executing a query
   */
  isTabRunning(tabId: string): boolean {
    const task = this.activeTasks.get(tabId);
    return task?.status === 'running';
  }

  /**
   * Cancel query execution for a tab
   */
  cancelTabExecution(tabId: string): boolean {
    const task = this.activeTasks.get(tabId);
    if (task && task.status === 'running') {
      if (task.cancellationToken) {
        task.cancellationToken.abort();
      }
      return true;
    }
    return false;
  }

  /**
   * Execute SQL query with task tracking, metadata parsing, and snapshot creation
   */
  async executeQuery(
    tabId: string,
    sql: string,
    tabTitle: string,
    options?: { explain?: boolean; isProfile?: boolean; executionContext?: ScriptExecutionContext }
  ): Promise<{ snapshot?: QuerySnapshot; task: ExecutionTask }> {
    if (!sql.trim()) {
      throw new Error('Query cannot be empty');
    }

    // Prevent concurrent duplicate executions
    if (this.isTabRunning(tabId)) {
      this.cancelTabExecution(tabId);
    }

    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const cancelToken = new AbortController();
    const startTime = performance.now();
    const runtime = duckDBService.getRuntimeInfo();
    const databaseName = runtime.currentDatabase;
    const contextRevision = runtime.databaseContextRevision;
    const sessionContextChange=splitSqlScript(sql).some(s=>['USE','DETACH'].includes(s.tokens[0]?.upper));
    const sameContext = () => {
      const current = duckDBService.getRuntimeInfo();
      return (sessionContextChange||current.currentDatabase === databaseName) && current.databaseContextRevision === contextRevision;
    };

    const task: ExecutionTask = {
      taskId,
      tabId,
      sql,
      status: 'running',
      startTime,
      cancellationToken: cancelToken,
    };
    this.activeTasks.set(tabId, task);

    let finalSql = sql;
    if (options?.isProfile) {
      finalSql = `EXPLAIN ANALYZE ${sql}`;
    } else if (options?.explain) {
      finalSql = `EXPLAIN ${sql}`;
    }

    const limitMatch = sql.match(/\bLIMIT\s+(\d+)\b/i);
    const limitClause = limitMatch ? parseInt(limitMatch[1], 10) : undefined;

    try {
      const context = options?.executionContext || { tabId, documentSql: sql, baseOffset: 0 };
      let bindingVersion=useWorkflowStore.getState().bindingVersion;
      if (!options?.explain && !options?.isProfile){const sync=useWorkflowStore.getState().syncFromSql(context.documentSql, tabTitle, false, tabId);bindingVersion=useWorkflowStore.getState().bindingVersion;await sync;}
      const execRes = await duckDBService.queryWithMetadata(finalSql, options?.explain || options?.isProfile ? undefined : { ...context, bindingVersion, signal: cancelToken.signal });
      const duration = performance.now() - startTime;

      if (execRes.error) {
        throw new Error(execRes.error);
      }

      if (task.status === 'cancelled' || cancelToken.signal.aborted || !sameContext()) {
        task.status = 'cancelled';
        task.duration = duration;
        return { task };
      }

      const snapshotId = `snap_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const nowTimeStr = new Date().toLocaleTimeString('zh-CN', { hour12: false });

      const snapshot: QuerySnapshot = {
        snapshotId,
        executionId: taskId,
        tabId,
        title: tabTitle,
        sql,
        columns: execRes.columns,
        columnTypes: execRes.columnTypes,
        columnTypeMap: execRes.columnTypeMap,
        rows: execRes.rows,
        totalRowCount: execRes.rows.length,
        executionTime: duration,
        executedAt: nowTimeStr,
        limitClause,
        arrowTable: execRes.arrowTable,
        isStale: false,
        isExplain: Boolean(options?.explain || options?.isProfile),
      };

      querySnapshotManager.registerSnapshot(snapshot);

      if (!options?.explain && !options?.isProfile) {
        try {
          useSqlEditorStore.getState().addHistory({
            id: snapshotId,
            sql,
            databaseName,
            timestamp: Date.now(),
            status: 'success',
            executionTime: duration,
            affectedRows: execRes.rows?.length,
          });
          useAppStore.getState().bumpDashboardRefresh();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('duckdb-sql-history-updated'));
          }
        } catch (historyErr) {
          console.warn('[QueryExecutionService] Failed to record query history', historyErr);
        }
      }

      task.status = 'success';
      task.duration = duration;
      task.snapshotId = snapshotId;
      if(this.activeTasks.get(tabId)?.taskId===task.taskId)this.activeTasks.set(tabId, task);

      return { snapshot, task };
    } catch (err: any) {
      const duration = performance.now() - startTime;
      const errorMsg = err.message || String(err);
      if (cancelToken.signal.aborted) { task.status = 'cancelled'; task.duration = duration; return { task }; }

      // Parse DuckDB error line and column if available
      const lineMatch = errorMsg.match(/LINE\s+(\d+)/i);
      const colMatch = errorMsg.match(/COLUMN\s+(\d+)/i);

      if (!options?.explain && !options?.isProfile && !cancelToken.signal.aborted && sameContext()) {
        try {
          useSqlEditorStore.getState().addHistory({
            id: taskId,
            sql,
            databaseName,
            timestamp: Date.now(),
            status: 'error',
            executionTime: duration,
            error: errorMsg,
          });
        } catch (historyErr) {
          console.warn('[QueryExecutionService] Failed to record query error history', historyErr);
        }
      }

      task.status = 'failed';
      task.duration = duration;
      task.error = errorMsg;
      task.errorLine = lineMatch ? parseInt(lineMatch[1], 10) : undefined;
      task.errorColumn = colMatch ? parseInt(colMatch[1], 10) : undefined;
      if(this.activeTasks.get(tabId)?.taskId===task.taskId)this.activeTasks.set(tabId, task);

      return { task };
    }
  }
}

export const queryExecutionService = new QueryExecutionService();
