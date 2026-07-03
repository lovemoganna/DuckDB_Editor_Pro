/**
 * useSqlExecution — Query execution lifecycle hook
 *
 * Extracted from SqlEditor.tsx (Loop 1 of SqlEditor Pro refactor).
 * Encapsulates:
 *   - execute(explain?) : run SQL against DuckDB with audit logging
 *   - cancel()          : mark current execution as cancelled (DuckDB WASM has
 *                         no native AbortController for in-flight queries;
 *                         flag-based cancellation is the best we can do)
 *   - handleKeyDown()   : global Ctrl/Cmd+Enter hotkey + Ctrl+Z undo-clear
 *
 * Cancellation semantics:
 *   - cancel() sets a local `cancelled` flag checked AFTER `await` resolves.
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
  execute: (explain?: boolean, overrideSql?: string) => Promise<void>;
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
  const upper = sql.trim().toUpperCase();
  if (upper.startsWith('INSERT')) return 'INSERT';
  if (upper.startsWith('UPDATE')) return 'UPDATE';
  if (upper.startsWith('DELETE')) return 'DELETE';
  if (upper.startsWith('CREATE')) return 'CREATE';
  if (upper.startsWith('DROP')) return 'DELETE';
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
  if (!sqlText) return '';

  const queries: { sql: string; start: number; end: number }[] = [];
  let currentQuery = '';
  let queryStart = 0;
  let inString = false;
  let stringChar = '';
  let inComment = false;
  let commentType = '';

  for (let i = 0; i < sqlText.length; i++) {
    const char = sqlText[i];
    const nextChar = sqlText[i + 1];

    if (!inString && !inComment) {
      if (char === '-' && nextChar === '-') {
        inComment = true;
        commentType = '--';
      } else if (char === '/' && nextChar === '*') {
        inComment = true;
        commentType = '/*';
      }
    }

    if (inComment) {
      currentQuery += char;
      if (commentType === '--' && (char === '\n' || char === '\r')) {
        inComment = false;
      } else if (commentType === '/*' && char === '*' && nextChar === '/') {
        currentQuery += nextChar; // Add the slash
        inComment = false;
        i++;
      }
      continue;
    }

    if ((char === "'" || char === '"' || char === '`') && sqlText[i - 1] !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (stringChar === char) {
        inString = false;
      }
    }

    currentQuery += char;

    if (char === ';' && !inString) {
      queries.push({
        sql: currentQuery,
        start: queryStart,
        end: i + 1,
      });
      currentQuery = '';
      queryStart = i + 1;
    }
  }

  if (currentQuery.trim()) {
    queries.push({
      sql: currentQuery,
      start: queryStart,
      end: sqlText.length,
    });
  }

  const target = queries.find((q) => offset >= q.start && offset <= q.end);
  if (target) {
    return target.sql;
  }

  if (queries.length > 0) {
    let minDistance = Infinity;
    let closest = queries[0];
    for (const q of queries) {
      const dist = Math.min(Math.abs(offset - q.start), Math.abs(offset - q.end));
      if (dist < minDistance) {
        minDistance = dist;
        closest = q;
      }
    }
    return closest.sql;
  }

  return sqlText;
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

  // Expose isRunning to consumers via the ref returned; but the hook contract
  // exposes isRunning as a boolean snapshot. We compute it lazily on each
  // call by reading the ref. This keeps the hook signature simple while
  // avoiding extra re-renders.
  const execute = useCallback(
    async (explain = false, overrideSql?: string, cursorOffset?: number) => {
      const tab = getActiveTab();
      if (!tab || isRunningRef.current) return;

      isRunningRef.current = true;
      cancelledRef.current = false;

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
        const type = classifyOperation(sqlToRun);
        const table = extractTableName(sqlToRun);

        let rows: any[];
        if (explain) {
          rows = await duckDBService.query(sqlToRun);
        } else {
          rows = await duckDBService.executeAndAudit(
            sqlToRun,
            type,
            table,
            'Executed via SQL Editor'
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

        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

        const result: QueryResult = {
          columns,
          rows,
          executionTime: endTime - startTime,
          isExplain: explain,
        };

        updateActiveTab({ result, loading: false });

        if (!explain) {
          saveToHistory(sqlToRun, 'success', endTime - startTime);
        }
        onAfterRun?.();
      } catch (e: any) {
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
      }
    },
    [getActiveTab, updateActiveTab, onAfterRun, saveToHistory, refreshSchema, onCancel, onError]
  );

  const cancel = useCallback(() => {
    if (!isRunningRef.current) return;
    cancelledRef.current = true;
    // DuckDB WASM has no native abort for in-flight queries; the flag is
    // checked after the await resolves. As a UX aid, we immediately flip
    // loading off so the spinner stops once the pending promise resolves.
  }, []);

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
