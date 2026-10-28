import { splitSqlScript, sourceSpan, type SqlStatement } from "./sqlStructure";
import type { SourceSpan } from "./logicalRelationFlowTypes";
import { hashSql } from "./sqlHash";

export interface ScriptExecutionContext {
  bindingVersion?: number;
  tabId: string;
  documentSql: string;
  baseOffset: number;
  connectionId?: string;
  signal?: AbortSignal;
}
export type StatementExecutionStatus =
  "queued" | "running" | "success" | "failed" | "cancelled" | "skipped";
export interface StatementExecutionEvent {
  bindingVersion?: number;
  runId: string;
  tabId: string;
  documentVersion: string;
  connectionId: string;
  statementId: string;
  sourceSpan: SourceSpan;
  status: StatementExecutionStatus;
  durationMs?: number;
  result?: unknown;
  error?: string;
  rolledBack?: boolean;
  terminal?: boolean;
}
const listeners = new Set<(event: StatementExecutionEvent) => void>();
const activeRuns = new Map<string, AbortController>();
export function cancelStatementExecution(runId: string) {
  const run = activeRuns.get(runId);
  run?.abort();
  return !!run;
}
export function subscribeStatementExecution(
  listener: (event: StatementExecutionEvent) => void,
) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export interface ScriptAdapter<T> {
  execute(sql: string): Promise<T>;
  transactionOpen(): boolean;
  setTransactionOpen(open: boolean): void;
}
export class ScriptExecutionError extends Error {
  constructor(
    message: string,
    public statement?: SqlStatement,
    public cancelled = false,
  ) {
    super(message);
  }
}
let runSequence = 0;
/** Called while the adapter's connection queue is held for the entire script. */
export async function executeSqlScript<T>(
  sql: string,
  adapter: ScriptAdapter<T>,
  context?: ScriptExecutionContext,
  onEvent?: (event: StatementExecutionEvent) => void,
): Promise<T | undefined> {
  const statements = splitSqlScript(sql),
    documentSql = context?.documentSql ?? sql,
    base = context?.baseOffset ?? 0;
  const fullStatements = splitSqlScript(documentSql),
    runId = `sql-run-${Date.now()}-${++runSequence}`;
  const version = hashSql(documentSql),
    connectionId = context?.connectionId || "writer";
  const cancellation = new AbortController();
  activeRuns.set(runId, cancellation);
  const cancelled = () =>
    cancellation.signal.aborted || context?.signal?.aborted;
  const mapped = statements.map((s) => {
    const start = s.sourceSpan.start + base,
      end = s.sourceSpan.end + base;
    const original = fullStatements.find(
      (f) => f.sourceSpan.start <= start && f.sourceSpan.end >= end,
    );
    return {
      ...s,
      id: original?.id || s.id,
      sourceSpan: sourceSpan(documentSql, start, end),
    };
  });
  const emit = (
    s: SqlStatement,
    status: StatementExecutionStatus,
    extra: Partial<StatementExecutionEvent> = {},
  ) => {
    const event: StatementExecutionEvent = {
      bindingVersion: context?.bindingVersion,
      runId,
      tabId: context?.tabId || "",
      documentVersion: version,
      connectionId,
      statementId: s.id,
      sourceSpan: s.sourceSpan,
      status,
      ...extra,
    };
    onEvent?.(event);
    for (const listener of listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error("SQL execution observer failed", error);
      }
    }
  };
  mapped.forEach((s) => emit(s, "queued"));
  const explicit = mapped.some((s) =>
    ["BEGIN", "START", "COMMIT", "ROLLBACK", "ABORT"].includes(
      s.tokens[0].upper,
    ),
  );
  const wrap = mapped.length > 1 && !adapter.transactionOpen() && !explicit;
  const completed: SqlStatement[] = [];
  let transactionSteps: SqlStatement[] = [];
  let index = 0,
    result: T | undefined,
    ownedTransaction = false;
  try {
    if (cancelled())
      throw new ScriptExecutionError("执行已取消", undefined, true);
    if (wrap) {
      await adapter.execute("BEGIN TRANSACTION");
      adapter.setTransactionOpen(true);
      ownedTransaction = true;
    }
    for (; index < mapped.length; index++) {
      const statement = mapped[index];
      if (cancelled())
        throw new ScriptExecutionError("执行已取消", statement, true);
      emit(statement, "running");
      const started = performance.now();
      try {
        result = await adapter.execute(statement.sql);
        const head = statement.tokens[0].upper;
        if (["BEGIN", "START"].includes(head)) adapter.setTransactionOpen(true);
        if (["COMMIT", "ROLLBACK", "ABORT"].includes(head))
          adapter.setTransactionOpen(false);
        if (["ROLLBACK", "ABORT"].includes(head)) {
          transactionSteps.forEach((s) =>
            emit(s, "success", { rolledBack: true }),
          );
          transactionSteps = [];
        } else if (head === "COMMIT") transactionSteps = [];
        else if (adapter.transactionOpen()) transactionSteps.push(statement);
        completed.push(statement);
        if (cancelled())
          throw new ScriptExecutionError(
            "当前语句已结束，执行已取消",
            statement,
            true,
          );
        emit(statement, "success", {
          durationMs: performance.now() - started,
          result,
        });
      } catch (error) {
        const e = error as Error;
        emit(
          statement,
          e instanceof ScriptExecutionError && e.cancelled
            ? "cancelled"
            : "failed",
          { error: e.message, durationMs: performance.now() - started },
        );
        throw error instanceof ScriptExecutionError
          ? error
          : new ScriptExecutionError(e.message, statement);
      }
    }
    if (ownedTransaction) {
      await adapter.execute("COMMIT");
      adapter.setTransactionOpen(false);
      ownedTransaction = false;
    }
    if (mapped.length) emit(mapped.at(-1)!, "success", { terminal: true });
    return result;
  } catch (error) {
    const e = error as Error;
    let rolledBack = false;
    if (ownedTransaction) {
      try {
        await adapter.execute("ROLLBACK");
        adapter.setTransactionOpen(false);
        rolledBack = true;
      } catch (rollbackError) {
        e.message += `; 回滚失败: ${(rollbackError as Error).message}`;
      }
    }
    if (rolledBack)
      completed.forEach((s) => emit(s, "success", { rolledBack: true }));
    mapped
      .slice(index + (e instanceof ScriptExecutionError && e.statement ? 1 : 0))
      .forEach((s) => emit(s, "skipped"));
    if (mapped.length)
      emit(
        mapped[Math.min(index, mapped.length - 1)],
        e instanceof ScriptExecutionError && e.cancelled
          ? "cancelled"
          : "failed",
        { terminal: true, error: e.message, rolledBack },
      );
    throw error;
  } finally {
    activeRuns.delete(runId);
  }
}
