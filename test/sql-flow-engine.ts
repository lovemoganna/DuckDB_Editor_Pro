import * as duckdb from "@duckdb/duckdb-wasm";
import wasm from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url";
import workerUrl from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";
import {
  executeSqlScript,
  type StatementExecutionEvent,
} from "../services/dataflow/sqlScriptExecution";
import { parseLogicalRelationFlow } from "../services/dataflow/logicalRelationFlowParser";
import { layoutLogicalFlow } from "../services/dataflow/logicalFlowLayout";
import glossary from "../services/dataflow/fixtures/glossaryFlowCases.json";
import attachment from "../services/dataflow/fixtures/attachmentFlowCases.json";

const output = document.querySelector<HTMLPreElement>("#results")!;
document.querySelector<HTMLButtonElement>("#run")!.onclick = async () => {
  output.textContent = "Running\n";
  let passed = 0,
    failed = 0;
  const check = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      passed++;
      output.textContent += `PASS ${name}\n`;
    } catch (error) {
      failed++;
      output.textContent += `FAIL ${name}: ${String(error)}\n`;
    }
  };
  const assert = (value: unknown, message: string) => {
    if (!value) throw new Error(message);
  };
  const db = new duckdb.AsyncDuckDB(
    new duckdb.VoidLogger(),
    new Worker(workerUrl),
  );
  await db.instantiate(wasm);
  await db.open({ path: ":memory:" });
  const conn = await db.connect();
  let open = false;
  const events: StatementExecutionEvent[] = [],
    calls: string[] = [];
  const script = async (sql: string, signal?: AbortSignal) =>
    executeSqlScript(
      sql,
      {
        execute: async (statement) => {
          calls.push(statement);
          const arrow = await conn.query(statement);
          return {
            rows: arrow.toArray().map((r) => r.toJSON()),
            columns: arrow.schema.fields.map((f) => f.name),
          };
        },
        transactionOpen: () => open,
        setTransactionOpen: (v) => {
          open = v;
        },
      },
      { tabId: "engine", documentSql: sql, baseOffset: 0, signal },
      (e) => events.push(e),
    );
  try {
    await check(
      "same connection temp table + sequential statement events",
      async () => {
        events.length = 0;
        const result = await script(
          "CREATE TEMP TABLE t AS SELECT * FROM (VALUES (1,'Alice'),(2,'Bob')) v(id,name); SELECT * FROM t ORDER BY id",
        );
        assert(result?.rows.length === 2, "temp table result");
        assert(
          events
            .filter((e) => e.status === "running")
            .map((e) => e.statementId)
            .join(",") === "statement_0_0,statement_1_0",
          "statement order",
        );
      },
    );
    await check("PREPARE / EXECUTE / DEALLOCATE lifecycle", async () => {
      const result = await script(
        "PREPARE q AS SELECT * FROM t WHERE id >= $1; EXECUTE q(2)",
      );
      assert(result?.rows.length === 1, "prepared result");
      await script("DEALLOCATE q");
      let failed = false;
      try {
        await script("EXECUTE q(1)");
      } catch {
        failed = true;
      }
      assert(failed, "deallocated prepare must fail");
    });
    await check("VIEW and TABLE MACRO definitions evaluate on reference", async () => {
      const result = await script("CREATE VIEW flow_view AS SELECT * FROM t; CREATE MACRO flow_macro() AS TABLE SELECT * FROM flow_view; SELECT * FROM flow_macro() ORDER BY id");
      assert(result?.rows.length === 2, "definition reference output");
      await script("DROP MACRO flow_macro; DROP VIEW flow_view");
    });
    await check("ATTACH / USE / DETACH retain the same connection", async () => {
      const original = String((await conn.query("SELECT current_database() AS name")).toArray()[0].name);
      await script("ATTACH ':memory:' AS flow_catalog; USE flow_catalog; CREATE TABLE attached_probe AS SELECT 42 AS value");
      const result = await script("SELECT value FROM attached_probe");
      assert(Number(result?.rows[0].value) === 42, "USE scope");
      await script(`USE "${original.replaceAll('"', '""')}"; DETACH flow_catalog`);
      assert((await conn.query("SELECT database_name FROM duckdb_databases() WHERE database_name='flow_catalog'")).numRows === 0, "DETACH lifecycle");
    });
    await check("batch rollback + failure stops subsequent SQL", async () => {
      events.length = 0;
      try {
        await script(
          "CREATE TABLE rollback_probe(i INT); SELECT * FROM missing_probe; CREATE TABLE forbidden_probe(i INT)",
        );
      } catch {}
      const tables = await conn.query(
        "SELECT table_name FROM information_schema.tables WHERE table_name IN ('rollback_probe','forbidden_probe')",
      );
      assert(tables.numRows === 0, "rollback/stop");
      assert(
        events.some((e) => e.rolledBack),
        "rollback event",
      );
      assert(
        events.some((e) => e.status === "skipped"),
        "skipped event",
      );
    });
    await check(
      "explicit transaction executes original SQL and reports rollback",
      async () => {
        events.length = 0;
        calls.length = 0;
        await script("BEGIN; CREATE TABLE explicit_probe(i INT); ROLLBACK");
        assert(
          calls.join(";") ===
            "BEGIN;CREATE TABLE explicit_probe(i INT);ROLLBACK",
          "no nested wrapper",
        );
        assert(
          events.some((e) => e.rolledBack),
          "explicit rollback event",
        );
      },
    );
    await check("existing transaction is not wrapped", async () => {
      await script("BEGIN");
      calls.length = 0;
      await script("SELECT 1; SELECT 2");
      assert(calls.join(";") === "SELECT 1;SELECT 2", "nested transaction");
      await script("ROLLBACK");
    });
    await check(
      "cancel waits current engine response and stops next statement",
      async () => {
        const controller = new AbortController();
        events.length = 0;
        const unsubscribe = (
          await import("../services/dataflow/sqlScriptExecution")
        ).subscribeStatementExecution((e) => {
          if (e.tabId === "engine" && e.status === "running")
            controller.abort();
        });
        try {
          await script(
            "SELECT sum(i) FROM range(100000) r(i); CREATE TABLE cancelled_probe(i INT)",
            controller.signal,
          );
        } catch {
        } finally {
          unsubscribe();
        }
        assert(
          events.filter((e) => e.status === "running").length === 1,
          "next statement started",
        );
        assert(events.at(-1)?.status === "cancelled", "cancel acknowledgement");
      },
    );
    await check("side effects are executed once", async () => {
      await script("CREATE SEQUENCE one_time START 1");
      const result = await script("SELECT nextval('one_time') AS id");
      assert(Number(result?.rows[0].id) === 1, "first value");
      const next = await script("SELECT nextval('one_time') AS id");
      assert(Number(next?.rows[0].id) === 2, "replayed sequence");
    });
    await check("real CSV + Parquet sources + verifiable sample", async () => {
      await db.registerFileText("flow.csv", "id,name\n1,Alice\n2,Bob\n");
      const csv = await conn.query(
        "SELECT * FROM read_csv('flow.csv', header=true)",
      );
      assert(csv.numRows === 2, "csv");
      await conn.query(
        "COPY (SELECT * FROM t) TO 'flow.parquet' (FORMAT PARQUET)",
      );
      const parquet = await conn.query(
        "SELECT * FROM read_parquet('flow.parquet') USING SAMPLE 100 PERCENT (bernoulli)",
      );
      assert(parquet.numRows === 2, "parquet/sample");
    });
    await check("SELECT JSON cross-validation without evaluation", async () => {
      const result = await conn.query(
        "SELECT json_serialize_sql('SELECT sum(id) FROM t WHERE id > 0') AS ast",
      );
      assert(
        !JSON.parse(String(result.toArray()[0].ast)).error,
        "SELECT serializer",
      );
    });
    await check(
      "Glossary + attachment structure and deterministic compound layout",
      async () => {
        for (const c of [...glossary.cases, ...attachment.cases]) {
          const flow = parseLogicalRelationFlow(c.sql);
          assert(
            flow.status === "complete",
            `${c.name}: ${flow.diagnostics.map((d) => d.message).join(";")}`,
          );
          const graph = await layoutLogicalFlow(flow);
          assert(
            graph.edges.length ===
              flow.edges.filter((e) => e.kind !== "boundary_contains").length,
            `${c.name}: missing edges`,
          );
          assert(
            graph.edges.every((e) => e.data?.routePoints?.length),
            `${c.name}: missing route`,
          );
        }
      },
    );
  } finally {
    await conn.close();
    await db.terminate();
    output.textContent += `TOTAL ${passed} passed, ${failed} failed\n`;
  }
};
