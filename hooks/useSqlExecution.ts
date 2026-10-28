import { splitSqlScript } from '../services/dataflow/sqlStructure';
import { useWorkflowStore } from '../services/dataflow/workflowStore';
/**
 * useSqlExecution — Query execution lifecycle hook
 *
 * Extracted from SqlEditor.tsx (Loop 1 of SqlEditor Pro refactor).
 * Encapsulates:
 *   - execute(explain?) : run SQL against DuckDB with audit logging
 *   - cancel()          : cancel the active DuckDB worker query and suppress
 *                         any stale UI result
 *   - handleKeyDown()   : global Ctrl/Cmd+Enter hotkey + Ctrl+Z undo-clear
 *   - handleKeyDown()   : global Ctrl/Cmd+Enter hotkey + Ctrl+Z undo-clear
 *
 * Cancellation semantics:
 *   - cancel() calls DuckDB WASM's connection-level cancellation and sets a
 *     local `cancelled` flag checked after the pending promise settles.
 *   - The active Tab is only mutated if the cancellation did not happen.
 *   - This prevents stale UI updates from slow queries.
 *
 * Dependencies (injected by the caller):
 *   - getActiveTab() → SqlTab | undefined
 *   - updateActiveTab(updates) → update the active Tab in the parent store
 *   - onAfterRun() → side effects after a successful run (e.g. parent
 *     refresh, audit log flush)
 *   - saveToHistory(sql, status, durationMs) → persist to history slice
 *   - refreshSchema() → after DDL operations
 */

import { useCallback, useEffect, useRef } from 'react';
import { duckDBService } from '../services/duckdbService';
import type { SqlTab, QueryResult } from '../types';
import { useAppStore } from './store/useAppStore';
import { requireAnalysisQuery } from '../services/analysis/readQueryGuard';

export interface UseSqlExecutionDeps {
  /** Return the active Tab (used to read code, write result). */
  getActiveTab: () => SqlTab | undefined;
  /** Apply partial updates to the active Tab. */
  updateActiveTab: (updates: Partial<SqlTab>) => void;
  /** Notify parent that a run finished (e.g. global refresh). */
  onAfterRun?: () => void;
  /** Persist to history slice (slice may no-op if disabled). */
  saveToHistory: (sql: string, status: 'success' | 'error', durationMs: number) => void;
  /** After DDL (CREATE/DROP/ALTER) re-fetch schema. */
  refreshSchema?: () => void;
  /** Optional: callback when cancel() succeeds — used to surface toast. */
  onCancel?: () => void;
  /** Optional: callback on error — used by error UI to copy message. */
  onError?: (message: string) => void;
}

export interface UseSqlExecutionReturn {
  /** Run the active Tab's SQL. Pass `explain=true` to wrap with EXPLAIN. */
  execute: (explain?: boolean, overrideSql?: string, cursorOffset?: number, selectionOffset?: number) => Promise<void>;
  /** Mark current execution as cancelled. No-op if not running. */
  cancel: () => void;
  /** Whether an execution is currently in-flight. */
  isRunning: boolean;
  /**
   * Bind this to the editor wrapper's onKeyDown for Ctrl/Cmd+Enter.
   * Also handles Ctrl+Z undo-clear (caller supplies lastClearedContent +
   * onUndoClear).
   */
  handleKeyDown: (
    e: React.KeyboardEvent,
    options?: { lastClearedContent?: unknown; onUndoClear?: () => void }
  ) => void;
}

/**
 * Determine a coarse operation type from SQL prefix for audit logging.
 * Mirrors the original logic in SqlEditor.tsx (lines 423-432).
 */
function classifyOperation(sql: string): string {
  // Strip single-line comments
  let cleanSql = sql.replace(/--.*$/gm, '');
  // Strip multi-line comments
  cleanSql = cleanSql.replace(/\/\*[\s\S]*?\*\//g, '');

  const upper = cleanSql.trim().toUpperCase();
  if (upper.startsWith('INSERT')) return 'INSERT';
  if (upper.startsWith('UPDATE')) return 'UPDATE';
  if (upper.startsWith('DELETE')) return 'DELETE';
  if (upper.startsWith('CREATE')) return 'CREATE';
  if (upper.startsWith('DROP')) return 'DROP';
  if (upper.startsWith('ALTER')) return 'ALTER';
  if (upper.startsWith('PIVOT')) return 'QUERY';
  return 'QUERY';
}

/** Extract the target table name from common DML/DDL prefixes. */
function extractTableName(sql: string): string | null {
  const m = sql.match(/(?:FROM|INTO|UPDATE|TABLE)\s+"?([a-zA-Z0-9_]+)"?/i);
  return m ? m[1] : null;
}

/** Get the SQL query containing the given character offset, accounting for semicolons, comments, and strings. */
export function getSqlAtOffset(sqlText: string, offset: number): string {
  const statements = splitSqlScript(sqlText);
  const target = statements.find(s => offset >= s.sourceSpan.start && offset <= s.sourceSpan.end) || statements.reduce<(typeof statements)[number] | undefined>((best, s) => !best || Math.min(Math.abs(offset-s.sourceSpan.start),Math.abs(offset-s.sourceSpan.end)) < Math.min(Math.abs(offset-best.sourceSpan.start),Math.abs(offset-best.sourceSpan.end)) ? s : best, undefined);
  return target?.sql || sqlText;
}

export function useSqlExecution(deps: UseSqlExecutionDeps): UseSqlExecutionReturn {
  const {
    getActiveTab,
    updateActiveTab,
    onAfterRun,
    saveToHistory,
    refreshSchema,
    onCancel,
    onError,
  } = deps;

  const isRunningRef = useRef(false);
  const cancelledRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // Expose isRunning to consumers via the ref returned; but the hook contract
  // exposes isRunning as a boolean snapshot. We compute it lazily on each
  // call by reading the ref. This keeps the hook signature simple while
  // avoiding extra re-renders.
  const execute = useCallback(
    async (explain = false, overrideSql?: string, cursorOffset?: number, selectionOffset?: number) => {
      const tab = getActiveTab();
      if (!tab || isRunningRef.current) return;

      isRunningRef.current = true;
      cancelledRef.current = false;
      abortRef.current = new AbortController();

      updateActiveTab({
        loading: true,
        viewMode: explain ? 'explain' : 'table',
        page: 0,
        filterTerm: '',
      });

      const startTime = performance.now();
      let sqlToRun = overrideSql || tab.code;

      if (!overrideSql && typeof cursorOffset === 'number') {
        const queryAtCursor = getSqlAtOffset(tab.code, cursorOffset);
        if (queryAtCursor.trim()) {
          sqlToRun = queryAtCursor;
        }
      }

      if (explain && !sqlToRun.toUpperCase().startsWith('EXPLAIN')) {
        sqlToRun = `EXPLAIN ${sqlToRun}`;
      }

      try {
        const statements = splitSqlScript(tab.code);
        const selected = !overrideSql && typeof cursorOffset === 'number' ? statements.find(s => s.sql === sqlToRun && cursorOffset >= s.sourceSpan.start && cursorOffset <= s.sourceSpan.end) : undefined;
        const baseOffset = selectionOffset ?? selected?.sourceSpan.start ?? 0;
        if (!explain) await useWorkflowStore.getState().syncFromSql(tab.code, tab.title, false, tab.id);
        const context = { bindingVersion:useWorkflowStore.getState().bindingVersion, tabId: tab.id, documentSql: tab.code, baseOffset, signal: abortRef.current!.signal };
        const type = classifyOperation(sqlToRun);
        const executionScope = await duckDBService.getCurrentCatalogAndSchema();
        const table = extractTableName(sqlToRun);

        let executionResult: {
          rows: any[];
          columns: string[];
          columnTypes: string[];
          columnTypeMap: Record<string, string>;
          arrowTable?: any;
        };

        if (explain) {
          executionResult = await duckDBService.queryWithMetadata(sqlToRun);
        } else {
          executionResult = await duckDBService.executeAndAuditWithMetadata(
            sqlToRun,
            type,
            table,
            'Executed via SQL Editor',
            context
          );
        }

        if (cancelledRef.current) {
          // Reset loading but skip result write so the user sees "cancelled"
          // and can decide whether to retry.
          updateActiveTab({ loading: false });
          onCancel?.();
          return;
        }

        const endTime = performance.now();

        if (type === 'CREATE' || type === 'DROP' || type === 'ALTER') {
          refreshSchema?.();
        }

        const result: QueryResult = {
          executedSql: sqlToRun,
          databaseName: executionScope.catalog,
          schemaName: executionScope.schema,
          columns: executionResult.columns,
          columnTypes: executionResult.columnTypes,
          columnTypeMap: executionResult.columnTypeMap,
          rows: executionResult.rows,
          arrowTable: executionResult.arrowTable,
          executionTime: endTime - startTime,
          isExplain: explain,
        };

        if(getActiveTab()?.id===tab.id&&getActiveTab()?.code===tab.code) {
          updateActiveTab({ result, loading: false });
          if(!explain && useAppStore.getState().currentDatabase===executionScope.catalog) {
            // Only the statement actually executed becomes the shared dataset.
            // Mutations and multi-statement scripts are never replayed by a graph refresh.
            try {
              const sql=requireAnalysisQuery(sqlToRun);
              useAppStore.getState().setActiveDataset({id:`sql:${tab.id}`,name:`查询：${tab.title}`,catalog:executionScope.catalog,schema:executionScope.schema,
                kind:'query',version:1,sql,fields:result.columns.map((name,index)=>({name,type:result.columnTypes?.[index] || result.columnTypeMap?.[name] || 'VARCHAR'}))});
            }catch { /* Keep the current dataset after non-analysis operations. */ }
          }
        }

        if (!explain) {
          saveToHistory(sqlToRun, 'success', endTime - startTime);
        }
        onAfterRun?.();
      } catch (e: any) {
        if(getActiveTab()?.id!==tab.id)return;
        if (cancelledRef.current) {
          updateActiveTab({ loading: false });
          onCancel?.();
          return;
        }
        updateActiveTab({
          result: { columns: [], rows: [], executionTime: 0, error: e.message },
          loading: false,
        });
        if (!explain) saveToHistory(sqlToRun, 'error', 0);
        onError?.(e?.message ?? String(e));
      } finally {
        isRunningRef.current = false;
        cancelledRef.current = false;
        abortRef.current = null;
      }
    },
    [getActiveTab, updateActiveTab, onAfterRun, saveToHistory, refreshSchema, onCancel, onError]
  );

  const cancel = useCallback(() => {
    if (!isRunningRef.current) return;
    cancelledRef.current = true;
    abortRef.current?.abort();
    void duckDBService.cancelActiveQuery().catch(error => {
      console.warn('[SQL Execution] DuckDB cancellation failed', error);
    });
  }, [updateActiveTab]);

  const handleKeyDown = useCallback(
    (
      e: React.KeyboardEvent,
      options?: { lastClearedContent?: unknown; onUndoClear?: () => void }
    ) => {
      // Ctrl/Cmd + Enter → execute
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        execute();
        return;
      }
      // Ctrl/Cmd + . → cancel running query
      if ((e.ctrlKey || e.metaKey) && e.key === '.' && isRunningRef.current) {
        e.preventDefault();
        cancel();
        return;
      }
      // Ctrl/Cmd + Z → undo clear
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key === 'z' &&
        options?.lastClearedContent &&
        options.onUndoClear
      ) {
        e.preventDefault();
        options.onUndoClear();
      }
    },
    [execute, cancel]
  );

  // Cleanup: if the component unmounts mid-flight, mark as cancelled so the
  // post-await block doesn't try to setState on an unmounted component.
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  return {
    execute,
    cancel,
    // Read the ref at call time; consumers that need reactivity should
    // observe `tab.loading` from the active tab instead.
    get isRunning() {
      return isRunningRef.current;
    },
    handleKeyDown,
  } as UseSqlExecutionReturn;
}

export default useSqlExecution;
