import { describe, it, expect } from "vitest";
import {
  parseLogicalRelationFlow,
  logicalFlowToCanvas,
} from "./logicalRelationFlowParser";
import { splitSqlScript, utf8OffsetToUtf16 } from "./sqlStructure";
import { layoutLogicalFlow } from "./logicalFlowLayout";
import glossary from "./fixtures/glossaryFlowCases.json";
import attachment from "./fixtures/attachmentFlowCases.json";
import shortcuts from "./fixtures/shortcutFlowCases.json";

describe("logical flow governance", () => {
  it("keeps standard Reshape and source Sample attached to the correct JOIN input", () => {
    const flow = parseLogicalRelationFlow(
      "SELECT * FROM a JOIN b PIVOT (sum(value) FOR kind IN ('x')) p ON a.id=p.id",
    );
    expect(flow.diagnostics).toEqual([]);
    const join = flow.operators.find((o) => o.type === "join")!;
    expect(
      flow.operators.find((o) =>
        o.outputRelationIds.includes(join.inputRelationIds[1]),
      )?.type,
    ).toBe("reshape");
    const sample = parseLogicalRelationFlow(
      "SELECT * FROM t TABLESAMPLE reservoir(5 ROWS)",
    );
    expect(sample.operators.filter((o) => o.type === "sample")).toHaveLength(1);
  });
  it.each(shortcuts.cases)("maps shortcut $name", ({ sql }) =>
    expect(parseLogicalRelationFlow(sql).diagnostics).toEqual([]),
  );
  it("keeps a simple chain horizontal and disconnected Statements in source order", async () => {
    const simple = await layoutLogicalFlow(
      parseLogicalRelationFlow("SELECT * FROM t WHERE i > 0 LIMIT 5"),
    );
    const leaves = simple.nodes.filter((n) => n.type !== "logicalBoundary");
    expect(new Set(leaves.map((n) => n.position.y)).size).toBe(1);
    expect(
      leaves.every(
        (n, i) => i === 0 || n.position.x > leaves[i - 1].position.x,
      ),
    ).toBe(true);
    const flow = parseLogicalRelationFlow("SELECT 1; SELECT 2; SELECT 3");
    const graph = await layoutLogicalFlow(flow);
    const statements = flow.statements.map((s) =>
      graph.nodes.find((n) => n.id === s.boundaryId)!,
    );
    expect(
      statements.every(
        (n, i) => i === 0 || n.position.y > statements[i - 1].position.y,
      ),
      JSON.stringify(statements.map((n) => n.position)),
    ).toBe(true);
  });
  it.each(attachment.cases)("maps $name without diagnostics", ({ sql }) => {
    expect(parseLogicalRelationFlow(sql).diagnostics).toEqual([]);
  });
  it("defers definition evaluation until a VIEW or PREPARE is used", () => {
    const flow = parseLogicalRelationFlow(
      "CREATE VIEW v AS SELECT sum(i) FROM t; PREPARE q AS SELECT * FROM v; EXECUTE q;",
    );
    expect(
      flow.nodes.filter(
        (n) => n.statementId === "statement_0_0" && n.kind === "relation",
      ),
    ).toHaveLength(0);
    expect(
      flow.nodes.filter(
        (n) => n.statementId === "statement_1_0" && n.kind === "relation",
      ),
    ).toHaveLength(0);
    expect(
      flow.nodes.some(
        (n) =>
          n.statementId === "statement_2_0" && n.operator?.type === "aggregate",
      ),
    ).toBe(true);
  });
  it("binds nested expression queries to their consuming operation", () => {
    const flow = parseLogicalRelationFlow(
      "SELECT (SELECT max(i) FROM b) AS m FROM a WHERE EXISTS (SELECT * FROM c)",
    );
    const targets = flow.edges
      .filter((e) => e.kind === "reference")
      .map((e) => flow.nodes.find((n) => n.id === e.to)?.operator?.type);
    expect(targets).toContain("filter");
    expect(targets).toContain("projection");
    expect(
      flow.nodes.filter(
        (n) =>
          n.operator?.type === "aggregate" &&
          flow.boundaries.find((b) => b.id === n.boundaryId)?.kind === "query",
      ),
    ).toHaveLength(0);
  });
  it("keeps only the user-visible Statement output eligible for real metrics", () => {
    const flow = parseLogicalRelationFlow("SELECT * FROM (SELECT * FROM t) x");
    expect(
      logicalFlowToCanvas(flow).nodes.filter(
        (n) => n.data.acceptsStatementOutput,
      ),
    ).toHaveLength(1);
  });
  it("marks unconfirmed external bindings without inventing measured state", () => {
    const flow = parseLogicalRelationFlow("SELECT * FROM unknown_table");
    expect(flow.objects[0].state).toBe("unresolved");
    expect(flow.relations[0].state?.rows.after).toBe("unknown");
  });
  it.each(glossary.cases.flatMap(c => [440, 1000].map(viewportWidth => ({...c, viewportWidth, name: `${c.name} (${viewportWidth}px)`}))))(
    "lays out $name without leaf overlap or unrelated node crossings",
    async ({ sql, viewportWidth }) => {
      const graph = await layoutLogicalFlow(parseLogicalRelationFlow(sql), new Map(), viewportWidth);
      const absolute = (
        id: string,
      ): { x: number; y: number; width: number; height: number } => {
        const node = graph.nodes.find((n) => n.id === id)!;
        const parent = node.parentNode
          ? absolute(node.parentNode)
          : { x: 0, y: 0 };
        return {
          x: node.position.x + parent.x,
          y: node.position.y + parent.y,
          width: node.width || Number(node.style?.width) || 0,
          height: node.height || Number(node.style?.height) || 0,
        };
      };
      const leaves = graph.nodes.filter((n) => n.type !== "logicalBoundary");
      for (let i = 0; i < leaves.length; i++)
        for (let j = i + 1; j < leaves.length; j++) {
          const a = absolute(leaves[i].id),
            b = absolute(leaves[j].id);
          expect(
            a.x + a.width <= b.x ||
              b.x + b.width <= a.x ||
              a.y + a.height <= b.y ||
              b.y + b.height <= a.y,
            `${leaves[i].data.title} overlaps ${leaves[j].data.title}`,
          ).toBe(true);
        }
      for (const edge of graph.edges) {
        const route = edge.data?.routePoints!;
        for (let i = 1; i < route.length; i++) {
          const a = route[i - 1],
            b = route[i];
          expect(a.x === b.x || a.y === b.y, "nonorthogonal route").toBe(true);
          for (const node of leaves.filter(
            (n) => n.id !== edge.source && n.id !== edge.target,
          )) {
            const box = absolute(node.id),
              inX = a.x > box.x + 0.01 && a.x < box.x + box.width - 0.01,
              inY = a.y > box.y + 0.01 && a.y < box.y + box.height - 0.01;
            const crosses =
              a.x === b.x
                ? inX &&
                  Math.max(a.y, b.y) > box.y + 0.01 &&
                  Math.min(a.y, b.y) < box.y + box.height - 0.01
                : inY &&
                  Math.max(a.x, b.x) > box.x + 0.01 &&
                  Math.min(a.x, b.x) < box.x + box.width - 0.01;
            expect(crosses, `${edge.id} crosses ${node.data.title}`).toBe(
              false,
            );
          }
        }
      }
    },
  );
  it.each(glossary.cases)("maps $name with valid references", ({ sql }) => {
    const flow = parseLogicalRelationFlow(sql);
    expect(flow.diagnostics).toEqual([]);
    const relations = new Set(flow.relations.map((r) => r.id)),
      nodes = new Set(flow.nodes.map((n) => n.id));
    expect(nodes.size).toBe(flow.nodes.length);
    for (const op of flow.operators)
      for (const id of [...op.inputRelationIds, ...op.outputRelationIds])
        expect(relations.has(id)).toBe(true);
    for (const edge of flow.edges) {
      expect(nodes.has(edge.from)).toBe(true);
      expect(nodes.has(edge.to)).toBe(true);
    }
    expect(
      flow.nodes.some((n) => /(?:GROUP BY|PIVOT|SELECT) result/.test(n.label)),
    ).toBe(false);
  });
  it("does not complicate a passthrough SELECT", () => {
    const flow = parseLogicalRelationFlow("SELECT * FROM inventory");
    expect(logicalFlowToCanvas(flow).nodes.map((n) => n.data.title)).toEqual([
      "inventory",
      "Result",
    ]);
    expect(flow.operators).toHaveLength(1);
  });
  it("joins exactly two current inputs rather than every previous relation", () => {
    const flow = parseLogicalRelationFlow(
      "SELECT * FROM a LEFT JOIN b USING(id) JOIN c USING(id) WHERE a.id > 1",
    );
    const joins = flow.operators.filter((o) => o.type === "join");
    expect(joins.map((o) => o.inputRelationIds.length)).toEqual([2, 2]);
    const filter = flow.operators.find((o) => o.type === "filter")!;
    expect(filter.inputRelationIds).toEqual(joins[1].outputRelationIds);
  });
  it("orders aggregation and window phases, including global aggregates", () => {
    expect(
      parseLogicalRelationFlow("SELECT sum(x) FROM a").operators.some(
        (o) => o.type === "aggregate",
      ),
    ).toBe(true);
    const flow = parseLogicalRelationFlow(
      "SELECT x, sum(x) OVER w AS s FROM a WINDOW w AS (ORDER BY x) QUALIFY s > 2 ORDER BY x",
    );
    expect(flow.operators.map((o) => o.type)).toEqual([
      "window",
      "filter",
      "projection",
      "output_modifier",
      "result",
    ]);
    expect(flow.operators.some((o) => o.type === "aggregate")).toBe(false);
  });
  it("reuses a CTE definition and gives actual recursive terms feedback edges", () => {
    const reused = parseLogicalRelationFlow(
      "WITH q AS (SELECT * FROM a) SELECT * FROM q x JOIN q y ON x.id=y.id",
    );
    expect(reused.nodes.filter((n) => n.label === "a")).toHaveLength(1);
    expect(reused.edges.filter((e) => e.kind === "reference")).toHaveLength(2);
    const recursive = parseLogicalRelationFlow(
      "WITH RECURSIVE t(n) AS (VALUES (1) UNION ALL SELECT n+1 FROM t WHERE n<3) SELECT * FROM t",
    );
    const back = recursive.edges.filter((e) => e.kind === "recursive_back");
    expect(back).toHaveLength(1);
    expect(back[0].from).not.toBe(back[0].to);
  });
  it("retains set precedence and all/name modifiers", () => {
    const flow = parseLogicalRelationFlow(
      "SELECT 1 AS a UNION ALL BY NAME SELECT 2 AS b INTERSECT SELECT 3 AS b",
    );
    expect(
      flow.operators
        .filter((o) => o.type === "set_operation")
        .map((o) => o.subtype),
    ).toEqual(["INTERSECT", "UNION"]);
    expect(
      flow.operators.find((o) => o.subtype === "UNION")?.details,
    ).toMatchObject({ modifier: "ALL", byName: true });
  });
  it("keeps object definitions out of relation flow and binds subsequent usage", () => {
    const flow = parseLogicalRelationFlow(
      "CREATE TEMP MACRO tax(x) AS x * 1.1; SELECT tax(10); CREATE TYPE mood AS ENUM ('ok'); CREATE TABLE t(m mood);",
    );
    expect(flow.objects.map((o) => o.objectType)).toEqual([
      "MACRO",
      "TYPE",
      "TABLE",
    ]);
    expect(
      flow.edges.filter((e) => e.kind === "object_dependency").length,
    ).toBeGreaterThan(3);
    expect(
      flow.nodes.filter(
        (n) =>
          n.kind === "relation" &&
          n.relation?.sourceKind === "statement_object",
      ),
    ).toHaveLength(0);
  });
  it("retains lossless positions across comments, dollar strings and Unicode", () => {
    const sql = `-- comment ;\nSELECT '流程; JOIN', $$x;y$$; /* outer /* ; */ end */ SELECT "表" FROM "表";`;
    const parts = splitSqlScript(sql);
    expect(parts).toHaveLength(2);
    for (const part of parts)
      expect(sql.slice(part.sourceSpan.start, part.sourceSpan.end)).toBe(
        part.sql,
      );
    expect(utf8OffsetToUtf16("中😀a", 7)).toBe(3);
    expect(
      parseLogicalRelationFlow(sql).nodes.some(
        (n) => n.operator?.type === "join",
      ),
    ).toBe(false);
  });
  it.each([
    "SELECT",
    "SELECT * FROM (",
    "SELECT * FROM t WHERE",
    "SELECT 'broken",
  ])("diagnoses incomplete SQL: %s", (sql) => {
    expect(parseLogicalRelationFlow(sql).status).toBe("parse_error");
  });
  it("lays out deterministic compound groups and obstacle-free simple chains", async () => {
    const flow = parseLogicalRelationFlow(
      "SELECT x FROM a WHERE x>1 ORDER BY x LIMIT 3",
    );
    const first = await layoutLogicalFlow(flow),
      second = await layoutLogicalFlow(flow);
    expect(first).toEqual(second);
    const leaves = first.nodes.filter((n) => n.type !== "logicalBoundary");
    expect(leaves.every((n) => Number.isFinite(n.position.x))).toBe(true);
    for (let i = 1; i < leaves.length; i++)
      expect(leaves[i].data.flowDirection === 'DOWN' ? leaves[i].position.y : leaves[i].position.x).toBeGreaterThan(leaves[i - 1].data.flowDirection === 'DOWN' ? leaves[i - 1].position.y : leaves[i - 1].position.x);
    expect(
      first.edges.every((e) => (e.data?.routePoints?.length || 0) >= 2),
    ).toBe(true);
  });
  it("lays out recursive feedback without hiding it", async () => {
    const flow = parseLogicalRelationFlow(
      "WITH RECURSIVE t(n) AS (VALUES (1) UNION ALL SELECT n+1 FROM t WHERE n<3) SELECT * FROM t",
    );
    const result = await layoutLogicalFlow(flow);
    expect(
      result.edges.filter((e) => e.data?.flowKind === "recursive_back"),
    ).toHaveLength(1);
    expect(
      result.edges.every((e) => (e.data?.routePoints?.length || 0) > 1),
    ).toBe(true);
  });
});
