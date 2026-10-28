import { describe, it, expect } from "vitest";
import {
  executeSqlScript,
  type StatementExecutionEvent,
} from "./sqlScriptExecution";
import { useWorkflowStore } from "./workflowStore";
import { hashSql } from "./sqlHash";

describe("statement execution protocol", () => {
  it("rejects late queued events after refreshing the same SQL", async () => {
    const store = useWorkflowStore.getState(),
      sql = "SELECT 1";
    await store.syncFromSql(sql, "doc", false, "same");
    const bindingVersion = useWorkflowStore.getState().bindingVersion;
    await store.syncFromSql(sql, "doc", true, "same");
    store.applyExecutionEvent({
      bindingVersion,
      runId: "old",
      tabId: "same",
      documentVersion: hashSql(sql),
      connectionId: "writer",
      statementId: "statement_0_0",
      sourceSpan: { start: 0, end: 8, startLine: 1, endLine: 1 },
      status: "queued",
    });
    expect(useWorkflowStore.getState().activeRunId).toBeNull();
  });
  it("holds statement order, hides transaction management, and reports rollback", async () => {
    const calls: string[] = [],
      events: StatementExecutionEvent[] = [];
    let transaction = false;
    await expect(
      executeSqlScript(
        "CREATE TABLE x(i INT); SELECT * FROM missing; SELECT 3",
        {
          execute: async (sql) => {
            calls.push(sql);
            if (sql.includes("missing")) throw new Error("missing table");
            return { rows: [] };
          },
          transactionOpen: () => transaction,
          setTransactionOpen: (v) => {
            transaction = v;
          },
        },
        undefined,
        (e) => events.push(e),
      ),
    ).rejects.toThrow("missing table");
    expect(calls).toEqual([
      "BEGIN TRANSACTION",
      "CREATE TABLE x(i INT)",
      "SELECT * FROM missing",
      "ROLLBACK",
    ]);
    expect(
      events.filter((e) => e.status === "running").map((e) => e.statementId),
    ).toEqual(["statement_0_0", "statement_1_0"]);
    expect(
      events.some((e) => e.rolledBack && e.statementId === "statement_0_0"),
    ).toBe(true);
    expect(
      events.some(
        (e) => e.status === "skipped" && e.statementId === "statement_2_0",
      ),
    ).toBe(true);
    expect(transaction).toBe(false);
  });
  it("respects existing and explicit transactions", async () => {
    const calls: string[] = [];
    let open = false;
    await executeSqlScript("BEGIN; SELECT 1; COMMIT", {
      execute: async (sql) => {
        calls.push(sql);
      },
      transactionOpen: () => open,
      setTransactionOpen: (v) => {
        open = v;
      },
    });
    expect(calls).toEqual(["BEGIN", "SELECT 1", "COMMIT"]);
    open = true;
    calls.length = 0;
    await executeSqlScript("SELECT 1; SELECT 2", {
      execute: async (sql) => {
        calls.push(sql);
      },
      transactionOpen: () => open,
      setTransactionOpen: (v) => {
        open = v;
      },
    });
    expect(calls).toEqual(["SELECT 1", "SELECT 2"]);
    expect(open).toBe(true);
  });
  it("does not begin the next statement after cancellation", async () => {
    const abort = new AbortController(),
      calls: string[] = [];
    let transaction = false;
    await expect(
      executeSqlScript(
        "SELECT 1; SELECT 2",
        {
          execute: async (sql) => {
            calls.push(sql);
            if (sql === "SELECT 1") abort.abort();
          },
          transactionOpen: () => transaction,
          setTransactionOpen: (v) => {
            transaction = v;
          },
        },
        {
          tabId: "cancel",
          documentSql: "SELECT 1; SELECT 2",
          baseOffset: 0,
          signal: abort.signal,
        },
      ),
    ).rejects.toThrow("取消");
    expect(calls).toEqual(["BEGIN TRANSACTION", "SELECT 1", "ROLLBACK"]);
  });
  it("maps a selected duplicate statement to its exact source occurrence", async () => {
    const document = "-- 中文\nSELECT 1;\nSELECT 1;",
      baseOffset = document.lastIndexOf("SELECT");
    const events: StatementExecutionEvent[] = [];
    await executeSqlScript(
      "SELECT 1",
      {
        execute: async () => 1,
        transactionOpen: () => false,
        setTransactionOpen: () => {},
      },
      { tabId: "selection", documentSql: document, baseOffset },
      (e) => events.push(e),
    );
    const current = events.find((e) => e.status === "running")!;
    expect(current.statementId).toBe("statement_1_0");
    expect(current.sourceSpan.start).toBe(baseOffset);
    expect(current.sourceSpan.startLine).toBe(3);
  });
  it("clears previous metrics and rollback flags before rerunning the same Statement", async () => {
    const sql = "SELECT 1";
    const store = useWorkflowStore.getState();
    await store.syncFromSql(sql, "test", false, "rerun");
    const event: StatementExecutionEvent = { runId: "old", tabId: "rerun", documentVersion: hashSql(sql), connectionId: "writer", statementId: "statement_0_0", sourceSpan: { start: 0, end: 8, startLine: 1, endLine: 1 }, status: "success", result: { rows: [{ value: 1 }], columns: ["value"] }, durationMs: 5, terminal: true };
    store.applyExecutionEvent(event);
    expect(useWorkflowStore.getState().nodes.some(n => n.data.rowCount === 1)).toBe(true);
    store.applyExecutionEvent({ ...event, result: undefined, rolledBack: true });
    store.applyExecutionEvent({ ...event, runId: "new", result: undefined, rolledBack: undefined, status: "queued", terminal: false });
    for (const node of useWorkflowStore.getState().nodes.filter(n => n.data.statementId === event.statementId)) {
      expect(node.data.executionStatus).toBe("queued");
      expect(node.data.executionResult).toBeUndefined();
      expect(node.data.rowCount).toBeUndefined();
      expect(node.data.executionTimeSec).toBeUndefined();
      expect(node.data.rolledBack).toBe(false);
    }
  });
  it("changes node state and code location together and ignores stale documents", async () => {
    const sql = "SELECT 1; SELECT 2;";
    const store = useWorkflowStore.getState();
    await store.syncFromSql(sql, "test", false, "doc");
    const event: StatementExecutionEvent = {
      runId: "live",
      tabId: "doc",
      documentVersion: hashSql(sql),
      connectionId: "writer",
      statementId: "statement_1_0",
      sourceSpan: { start: 10, end: 18, startLine: 1, endLine: 1 },
      status: "running",
    };
    store.applyExecutionEvent(event);
    expect(useWorkflowStore.getState().executionSqlRange).toEqual(
      event.sourceSpan,
    );
    expect(
      useWorkflowStore
        .getState()
        .nodes.filter((n) => n.data.statementId === event.statementId)
        .every((n) => n.data.status === "running"),
    ).toBe(true);
    store.selectNode(null);
    expect(useWorkflowStore.getState().activeSqlRange).toEqual(
      event.sourceSpan,
    );
    await store.syncFromSql("SELECT 3", "changed", false, "other");
    store.applyExecutionEvent(event);
    expect(useWorkflowStore.getState().executionSqlRange).toBeNull();
    expect(
      useWorkflowStore.getState().nodes.every((n) => n.data.status === "idle"),
    ).toBe(true);
  });
});
