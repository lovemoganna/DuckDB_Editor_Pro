import { Position } from "reactflow";
import type {
  Boundary,
  DimensionState,
  FlowData,
  FlowEdgeKind,
  FlowObject,
  Operator,
  Relation,
  RelationState,
} from "./logicalRelationFlowTypes";
import { LOGICAL_FLOW_CONTRACT_VERSION } from "./logicalRelationFlowTypes";
import {
  identifier,
  matchingParen,
  sourceSpan,
  splitSqlScript,
  SqlStructureError,
  topLevelIndices,
  type SqlToken,
} from "./sqlStructure";
import type { DataFlowEdge, DataFlowNode } from "./workflowTypes";
import { hashSql } from "./sqlHash";
export { hashSql } from "./sqlHash";
export const LOGICAL_FLOW_PARSER_VERSION = "logical-relation-flow/2.0.0";
export const LOGICAL_FLOW_CAPABILITIES = {
  query: [
    "SELECT",
    "FROM",
    "VALUES",
    "WHERE",
    "GROUP BY",
    "HAVING",
    "WINDOW",
    "QUALIFY",
    "JOIN",
    "USING SAMPLE",
    "DISTINCT",
    "DISTINCT ON",
    "ORDER BY",
    "LIMIT",
    "OFFSET",
    "WITH",
    "WITH RECURSIVE",
    "UNION",
    "INTERSECT",
    "EXCEPT",
    "PIVOT",
    "UNPIVOT",
  ],
  objects: ["TABLE", "VIEW", "MACRO", "SEQUENCE", "SCHEMA", "INDEX", "TYPE"],
  connection: [
    "PREPARE",
    "EXECUTE",
    "DEALLOCATE",
    "ATTACH",
    "DETACH",
    "USE",
    "SET",
    "RESET",
  ],
  lifecycle: [
    "CREATE",
    "DROP",
    "BEGIN",
    "START",
    "COMMIT",
    "ROLLBACK",
    "ABORT",
  ],
} as const;
const aggregates = new Set([
  "COUNT",
  "SUM",
  "AVG",
  "MIN",
  "MAX",
  "MEDIAN",
  "MODE",
  "FIRST",
  "LAST",
  "LIST",
  "ARRAY_AGG",
  "STRING_AGG",
  "PRODUCT",
  "STDDEV",
  "STDDEV_POP",
  "STDDEV_SAMP",
  "VAR_POP",
  "VAR_SAMP",
  "VARIANCE",
  "BOOL_AND",
  "BOOL_OR",
  "BIT_AND",
  "BIT_OR",
  "BIT_XOR",
  "ARG_MIN",
  "ARG_MAX",
  "QUANTILE",
  "QUANTILE_CONT",
  "QUANTILE_DISC",
  "APPROX_COUNT_DISTINCT",
  "ANY_VALUE",
  "CORR",
  "COVAR_POP",
  "COVAR_SAMP",
]);
const dimensions = [
  "rows",
  "columns",
  "grain",
  "order",
  "shape",
  "uniqueness",
] as const;
const state = () =>
  Object.fromEntries(
    dimensions.map((d) => [
      d,
      { before: "unknown", after: "unknown", change: "preserve" },
    ]),
  ) as unknown as RelationState;
interface Cte {
  relationId?: string;
  pending: string[];
  recursive: boolean;
}
interface Scope {
  boundaryId: string;
  names: Map<string, Cte>;
}
export interface FlowParseContext {
  catalogs?: string[];
  catalog?: string;
  schema?: string;
  objects?: Array<{
    name: string;
    objectType: string;
    catalog: string;
    schema: string;
    temporary?: boolean;
  }>;
  aggregateFunctions?: string[];
}

class Builder {
  flow: FlowData;
  serial = 0;
  statementId = "";
  statementBoundary = "";
  producers = new Map<string, string>();
  definitions = new Map<string, SqlToken[]>();
  evaluating = new Set<string>();
  bindings = new Map<string, FlowObject>();
  catalog: string;
  schema: string;
  catalogs = new Set<string>();
  versions = new Map<string, number>();
  searchPath: string[] = [];
  aggregateNames: Set<string>;
  constructor(
    public sql: string,
    context: FlowParseContext,
  ) {
    this.catalog = context.catalog || "current";
    this.schema = context.schema || "main";
    this.catalogs = new Set([this.catalog, ...(context.catalogs || [])]);
    this.aggregateNames = new Set([
      ...aggregates,
      ...(context.aggregateFunctions || []).map((n) => n.toUpperCase()),
    ]);
    this.flow = {
      contractVersion: LOGICAL_FLOW_CONTRACT_VERSION,
      source: {
        sql,
        sourceHash: hashSql(sql),
        parserVersion: LOGICAL_FLOW_PARSER_VERSION,
        generatedAt: new Date().toISOString(),
      },
      status: "complete",
      statements: [],
      effects: [],
      relations: [],
      operators: [],
      boundaries: [],
      objects: [],
      nodes: [],
      edges: [],
      diagnostics: [],
    };
    for (const item of context.objects || []) {
      const o: FlowObject = {
        ...item,
        id: this.id("external"),
        scope: item.temporary ? "connection" : "catalog",
        temporary: !!item.temporary,
        version: 0,
        state: "defined",
        definedBy: "external",
      };
      this.bindings.set(this.key(o.catalog, o.schema, o.name), o);
      this.flow.objects.push(o);
    }
  }
  id(kind: string) {
    return `${this.statementId || "script"}_${kind}_${this.serial++}`;
  }
  text(t: SqlToken[]) {
    const sorted = [...t].sort((a, b) => a.start - b.start);
    return sorted.length
      ? this.sql.slice(sorted[0].start, sorted.at(-1)!.end)
      : "";
  }
  span(t: SqlToken[]) {
    return sourceSpan(
      this.sql,
      t.length ? Math.min(...t.map((x) => x.start)) : 0,
      t.length ? Math.max(...t.map((x) => x.end)) : 0,
    );
  }
  key(c: string, s: string, n: string) {
    return `${c}.${s}.${n}`.toLowerCase();
  }
  boundary(
    kind: Boundary["kind"],
    t: SqlToken[],
    parent?: string,
    name?: string,
  ) {
    const id = this.id("boundary"),
      b: Boundary = {
        id,
        kind,
        name,
        parentBoundaryId: parent,
        sourceSpan: this.span(t),
      };
    this.flow.boundaries.push(b);
    this.flow.nodes.push({
      id,
      kind: "boundary",
      statementId: this.statementId,
      boundaryId: parent,
      sourceSpan: this.span(t),
      label: name || kind,
      boundary: b,
    });
    if (parent) this.edge(parent, id, "boundary_contains");
    return id;
  }
  edge(
    from: string,
    to: string,
    kind: FlowEdgeKind,
    relationId?: string,
    inputRole?: string,
  ) {
    if (
      this.flow.edges.some(
        (e) =>
          e.from === from &&
          e.to === to &&
          e.kind === kind &&
          e.inputRole === inputRole,
      )
    )
      return;
    this.flow.edges.push({
      id: this.id("edge"),
      from,
      to,
      kind,
      relationId,
      inputRole,
      label:
        kind === "recursive_back"
          ? "recursive reference"
          : kind === "object_dependency"
            ? "object dependency"
            : kind === "reference"
              ? "reference"
              : undefined,
    });
  }
  relation(
    producer: string,
    role: Relation["role"],
    sourceKind: Relation["sourceKind"],
    value = state(),
    name?: string,
  ) {
    const id = this.id("relation");
    this.flow.relations.push({ id, role, sourceKind, name, state: value });
    this.producers.set(id, producer);
    return id;
  }
  source(label: string, kind: Relation["sourceKind"], t: SqlToken[], s: Scope) {
    const id = this.id("source"),
      output = this.relation(id, "source", kind, state(), label);
    this.flow.nodes.push({
      id,
      kind: "relation",
      statementId: this.statementId,
      queryId: s.boundaryId,
      boundaryId: s.boundaryId,
      sourceSpan: this.span(t),
      label,
      relation: this.flow.relations.find((r) => r.id === output),
    });
    return output;
  }
  op(
    type: Operator["type"],
    label: string,
    inputs: string[],
    t: SqlToken[],
    s: Scope,
    details: Record<string, unknown> = {},
  ) {
    const id = this.id("operator"),
      value = state();
    const prior =
      inputs.length === 1
        ? this.flow.relations.find((r) => r.id === inputs[0])?.state
        : undefined;
    if (prior)
      for (const d of dimensions)
        value[d] = {
          before: prior[d].after,
          after: prior[d].after,
          change: "preserve",
        };
    const change = (
      d: keyof RelationState,
      v: DimensionState["change"],
      before = "unknown",
      after = "unknown",
    ) => {
      value[d] = { before, after, change: v, evidence: label };
    };
    if (type === "filter" || type === "sample") change("rows", "filter");
    if (type === "projection") change("columns", "reshape");
    if (type === "aggregate") {
      change("rows", "collapse");
      change(
        "grain",
        "collapse",
        "row-level",
        details.global ? "whole-relation" : "group-level",
      );
      change("columns", "reshape");
    }
    if (type === "window") change("columns", "add");
    if (type === "reshape") {
      change(
        "shape",
        "reshape",
        label === "PIVOT" ? "long" : "wide",
        label === "PIVOT" ? "wide" : "long",
      );
      change("columns", "reshape");
      change("rows", label === "PIVOT" ? "collapse" : "expand");
    }
    if (type === "join") {
      change(
        "rows",
        label.includes("SEMI") || label.includes("ANTI") ? "filter" : "unknown",
      );
      if (!label.includes("SEMI") && !label.includes("ANTI"))
        change("columns", "reshape");
    }
    if (type === "set_operation") {
      change("rows", "reshape");
      if (details.modifier !== "ALL") change("uniqueness", "deduplicate");
      if (details.byName) change("columns", "reshape");
    }
    if (type === "output_modifier") {
      if (label.startsWith("DISTINCT")) change("uniqueness", "deduplicate");
      else if (label === "ORDER BY") change("order", "reorder");
      else change("rows", "filter");
    }
    const output =
      type === "object_operation"
        ? this.id("operation_output")
        : this.relation(
            id,
            type === "result" ? "result" : "intermediate",
            "subquery_result",
            value,
          );
    if (type === "object_operation") this.producers.set(output, id);
    const effects = dimensions
      .filter((d) => value[d].change !== "preserve")
      .map((d) => ({
        id: this.id("effect"),
        operatorId: id,
        dimension: d,
        ...value[d],
      }));
    this.flow.effects.push(...effects);
    const operator: Operator = {
      id,
      type,
      subtype: label.replace(/ JOIN$/, ""),
      expression: this.text(t),
      inputRelationIds: inputs,
      outputRelationIds: type === "object_operation" ? [] : [output],
      effectIds: effects.map((e) => e.id),
      boundaryId: s.boundaryId,
      details,
    };
    this.flow.operators.push(operator);
    this.flow.nodes.push({
      id,
      kind: "operator",
      statementId: this.statementId,
      queryId: s.boundaryId,
      boundaryId: s.boundaryId,
      sourceSpan: this.span(t),
      label,
      operator,
    });
    inputs.forEach((input, index) => {
      const from = this.producers.get(input);
      if (from)
        this.edge(
          from,
          id,
          "relation_flow",
          input,
          inputs.length > 1 ? String(index) : undefined,
        );
    });
    return output;
  }
  diagnostic(t: SqlToken[], message: string) {
    this.flow.diagnostics.push({
      code: "FLOW_UNSUPPORTED",
      severity: "warning",
      message,
      sourceSpan: this.span(t),
    });
  }
  fail(t: SqlToken[], message: string): never {
    throw new SqlStructureError(message, t[0]?.start || 0);
  }
  name(t: SqlToken[], begin = 0) {
    let i = begin;
    const parts: string[] = [];
    while (t[i] && (t[i].kind === "word" || t[i].kind === "quoted")) {
      parts.push(identifier(t[i++]));
      if (t[i]?.text !== ".") break;
      i++;
    }
    if (!parts.length) this.fail(t.slice(begin), "缺少对象或 Relation 名称");
    return { name: parts.join("."), end: i };
  }
  resolve(name: string) {
    const p = name.split(".");
    if (p.length === 3) return this.bindings.get(this.key(p[0], p[1], p[2]));
    if (p.length === 2)
      return (
        this.bindings.get(this.key(this.catalog, p[0], p[1])) ||
        this.bindings.get(this.key(p[0], "main", p[1]))
      );
    return (
      this.bindings.get(this.key("temp", "main", name)) ||
      this.bindings.get(this.key(this.catalog, this.schema, name)) ||
      this.searchPath
        .map((path) => {
          const p = path.split(".");
          return this.bindings.get(
            this.key(p.length > 1 ? p[0] : this.catalog, p.at(-1)!, name),
          );
        })
        .find(Boolean)
    );
  }
  dependency(object: FlowObject, target: string) {
    if (!this.flow.nodes.some((n) => n.id === object.id))
      this.flow.nodes.push({
        id: object.id,
        kind: "object",
        statementId: this.statementId,
        boundaryId: this.statementBoundary,
        sourceSpan: this.span([]),
        label: object.name,
        object,
      });
    this.edge(object.id, target, "object_dependency");
  }
  expressionDependencies(t: SqlToken[], output: string, s?: Scope) {
    const target = this.producers.get(output)!;
    if (s)
      for (let i = 0; i < t.length; i++)
        if (
          t[i].text === "(" &&
          ["SELECT", "WITH", "FROM", "VALUES"].includes(t[i + 1]?.upper)
        ) {
          const end = matchingParen(t, i),
            nested = this.query(
              t.slice(i + 1, end),
              s.boundaryId,
              s.names,
              true,
              "subquery",
            );
          this.edge(this.producers.get(nested)!, target, "reference", nested);
          i = end;
        }
    for (let i = 0; i < t.length - 1; i++)
      if (t[i + 1].text === "(") {
        const object = this.resolve(identifier(t[i]));
        if (object) this.dependency(object, target);
        if (
          ["NEXTVAL", "CURRVAL"].includes(t[i].upper) &&
          t[i + 2]?.kind === "string"
        ) {
          const sequence = this.resolve(t[i + 2].text.slice(1, -1));
          if (sequence) this.dependency(sequence, target);
        }
      }
  }
  evaluateDefinition(object: FlowObject, target: string, s: Scope) {
    const definition = this.definitions.get(object.id);
    if (!definition || this.evaluating.has(object.id)) return;
    this.evaluating.add(object.id);
    try {
      const relation = this.query(
        definition,
        s.boundaryId,
        s.names,
        false,
        "subquery",
      );
      this.edge(
        this.producers.get(relation)!,
        this.producers.get(target)!,
        "reference",
        relation,
      );
    } finally {
      this.evaluating.delete(object.id);
    }
  }
  query(
    input: SqlToken[],
    parent: string,
    names = new Map<string, Cte>(),
    exposed = false,
    kind: Boundary["kind"] = "query",
  ): string {
    let t = input;
    while (t[0]?.text === "(" && matchingParen(t, 0) === t.length - 1)
      t = t.slice(1, -1);
    if (!t.length) this.fail(input, "缺少 Query");
    const s: Scope = {
      boundaryId: this.boundary(kind, t, parent),
      names: new Map(names),
    };
    if (t[0].upper === "WITH") {
      let i = 1;
      const recursive = t[i]?.upper === "RECURSIVE";
      if (recursive) i++;
      while (i < t.length) {
        const name = identifier(t[i++]);
        if (t[i]?.text === "(") i = matchingParen(t, i) + 1;
        if (t[i]?.upper !== "AS") this.fail(t.slice(i), "CTE 缺少 AS");
        i++;
        let materialization: Boundary["materialization"] = "unspecified";
        if (t[i]?.upper === "NOT") {
          materialization = "not_materialized";
          i++;
        }
        if (t[i]?.upper === "MATERIALIZED") {
          if (materialization === "unspecified")
            materialization = "materialized";
          i++;
        }
        if (t[i]?.text !== "(") this.fail(t.slice(i), "CTE 缺少 Query 定义");
        const end = matchingParen(t, i),
          entry: Cte = { pending: [], recursive };
        s.names.set(name.toLowerCase(), entry);
        const boundary = this.boundary(
          recursive ? "recursive_cte" : "cte",
          t.slice(i, end + 1),
          s.boundaryId,
          name,
        );
        Object.assign(
          this.flow.boundaries.find((b) => b.id === boundary)!,
          { materialization, recursive },
        );
        const output = this.query(t.slice(i + 1, end), boundary, s.names, true);
        if (!entry.pending.length) {
          const b = this.flow.boundaries.find((b) => b.id === boundary)!;
          b.kind = "cte";
          b.recursive = false;
        }
        entry.relationId = output;
        if (entry.pending.length) {
          const resultNode = this.flow.nodes.find(
            (n) => n.id === this.producers.get(output),
          )!;
          resultNode.label = "Accumulated output";
          const combined = resultNode.operator?.inputRelationIds[0];
          const union = this.flow.nodes.find(
            (n) => n.id === this.producers.get(combined || ""),
          );
          if (union?.operator?.type === "set_operation") {
            union.operator.details.recursiveAccumulation = true;
            union.operator.inputRelationIds.forEach((relation, index) => {
              const producer = this.flow.nodes.find(
                (n) => n.id === this.producers.get(relation),
              );
              const region = this.flow.boundaries.find(
                (b) => b.id === producer?.boundaryId,
              );
              if (region)
                region.name = index === 0 ? "anchor" : "recursive term";
            });
          }
        }
        entry.pending.forEach((ref) =>
          this.edge(this.producers.get(output)!, ref, "recursive_back", output),
        );
        i = end + 1;
        if (t[i]?.text !== ",") break;
        i++;
      }
      t = t.slice(i);
    }
    const top = topLevelIndices(t),
      sets = top.filter((i) =>
        ["UNION", "INTERSECT", "EXCEPT"].includes(t[i].upper),
      );
    if (sets.length) {
      const low = sets.filter((i) => t[i].upper !== "INTERSECT"),
        at = (low.length ? low : sets).at(-1)!;
      let right = at + 1,
        modifier = "DISTINCT",
        byName = false;
      if (["ALL", "DISTINCT"].includes(t[right]?.upper))
        modifier = t[right++].upper;
      if (t[right]?.upper === "BY" && t[right + 1]?.upper === "NAME") {
        byName = true;
        right += 2;
      }
      const tail =
        top.find(
          (i) => i > right && ["ORDER", "LIMIT", "OFFSET"].includes(t[i].upper),
        ) ?? t.length;
      const left = this.query(t.slice(0, at), s.boundaryId, s.names),
        r = this.query(t.slice(right, tail), s.boundaryId, s.names);
      let output = this.op(
        "set_operation",
        t[at].upper,
        [left, r],
        t.slice(at, right),
        s,
        { operation: t[at].upper, modifier, byName },
      );
      output = this.modifiers(t.slice(tail), output, s);
      return exposed ? this.op("result", "Result", [output], input, s) : output;
    }
    let output: string;
    if (t[0]?.upper === "VALUES")
      output = this.source("VALUES", "values", t, s);
    else if (["PIVOT", "UNPIVOT"].includes(t[0]?.upper)) {
      const config =
        top.find(
          (i) => i > 0 && ["ON", "USING", "INTO", "GROUP"].includes(t[i].upper),
        ) ?? t.length;
      output = this.from(t.slice(1, config), s);
      output = this.op("reshape", t[0].upper, [output], t, s, {
        configuration: this.text(t.slice(config)),
      });
    } else if (["SELECT", "FROM"].includes(t[0]?.upper))
      output = this.select(t, s);
    else this.fail(t, `尚未支持的 Query 结构: ${t[0]?.text}`);
    return exposed ? this.op("result", "Result", [output], input, s) : output;
  }
  atom(
    t: SqlToken[],
    index: number,
    s: Scope,
  ): { relationId: string; end: number } {
    const start = index;
    let output: string;
    if (t[index]?.upper === "LATERAL") index++;
    if (t[index]?.text === "(") {
      const end = matchingParen(t, index);
      output = this.query(
        t.slice(index + 1, end),
        s.boundaryId,
        s.names,
        true,
        "subquery",
      );
      index = end + 1;
    } else if (t[index]?.kind === "string") {
      output = this.source(t[index].text, "table_function", [t[index]], s);
      index++;
    } else {
      const parsed = this.name(t, index);
      index = parsed.end;
      const name = parsed.name;
      if (t[index]?.text === "(") {
        index = matchingParen(t, index) + 1;
        const object = this.resolve(name);
        output = this.source(
          this.text(t.slice(start, index)),
          object?.objectType === "TABLE MACRO"
            ? "table_macro"
            : "table_function",
          t.slice(start, index),
          s,
        );
        if (object) {
          this.dependency(object, this.producers.get(output)!);
          this.evaluateDefinition(object, output, s);
        }
      } else {
        const cte = s.names.get(name.toLowerCase()),
          object = this.resolve(name);
        output = this.source(
          name,
          cte
            ? "cte_reference"
            : object?.objectType === "VIEW"
              ? "view"
              : object?.temporary
                ? "temp_table"
                : "table",
          t.slice(start, index),
          s,
        );
        const producer = this.producers.get(output)!;
        if (cte) {
          if (cte.relationId)
            this.edge(
              this.producers.get(cte.relationId)!,
              producer,
              "reference",
              cte.relationId,
            );
          else if (cte.recursive) cte.pending.push(producer);
          else this.diagnostic(t.slice(start, index), "CTE 定义尚不可引用");
        } else if (object) {
          if (object.definedBy !== "external")
            this.dependency(object, producer);
          Object.assign(
            this.flow.relations.find((r) => r.id === output)!,
            { objectId: object.id, bindingState: "defined" },
          );
          this.evaluateDefinition(object, output, s);
        } else {
          const p = name.split(".");
          const unresolved: FlowObject = {
            id: this.id("unresolved"),
            name: p.at(-1)!,
            catalog: p.length === 3 ? p[0] : this.catalog,
            schema: p.length >= 2 ? p.at(-2)! : this.schema,
            objectType: "UNKNOWN",
            scope: "catalog",
            temporary: false,
            version: 0,
            definedBy: "external",
            state: "unresolved",
          };
          this.flow.objects.push(unresolved);
          Object.assign(
            this.flow.relations.find((r) => r.id === output)!,
            { objectId: unresolved.id, bindingState: "unresolved" },
          );
        }
      }
    }
    if (t[index]?.upper === "AS") index++;
    const reserved = new Set([
      "JOIN",
      "INNER",
      "LEFT",
      "RIGHT",
      "FULL",
      "OUTER",
      "SEMI",
      "ANTI",
      "ASOF",
      "CROSS",
      "NATURAL",
      "POSITIONAL",
      "ON",
      "USING",
      "WHERE",
      "GROUP",
      "ORDER",
      "LIMIT",
      "OFFSET",
      "SAMPLE",
      "TABLESAMPLE",
      "PIVOT",
      "UNPIVOT",
    ]);
    if (
      t[index] &&
      (t[index].kind === "quoted" ||
        (t[index].kind === "word" && !reserved.has(t[index].upper)))
    ) {
      const alias = identifier(t[index++]);
      this.flow.relations.find((r) => r.id === output)!.alias = alias;
      if (t[index]?.text === "(") index = matchingParen(t, index) + 1;
    }
    while (
      ["PIVOT", "UNPIVOT", "TABLESAMPLE", "SAMPLE"].includes(t[index]?.upper)
    ) {
      const begin = index,
        label = t[index++].upper;
      if (["PIVOT", "UNPIVOT"].includes(label)) {
        if (t[index]?.text !== "(")
          this.fail(t.slice(index), "Reshape 缺少括号配置");
        index = matchingParen(t, index) + 1;
        output = this.op("reshape", label, [output], t.slice(begin, index), s, {
          configuration: this.text(t.slice(begin + 1, index)),
        });
      } else {
        if (t[index]?.kind === "word" && t[index + 1]?.text === "(") index++;
        if (t[index]?.text === "(") index = matchingParen(t, index) + 1;
        else {
          if (!t[index]) this.fail(t.slice(begin), "Sample 缺少配置");
          index++;
          if (t[index]?.text === "%") index++;
        }
        output = this.op(
          "sample",
          "SAMPLE",
          [output],
          t.slice(begin, index),
          s,
        );
      }
      if (t[index]?.upper === "AS") index++;
      if (t[index] && t[index].kind === "word" && !reserved.has(t[index].upper))
        index++;
    }
    return { relationId: output, end: index };
  }
  from(t: SqlToken[], s: Scope): string {
    if (!t.length) this.fail(t, "FROM 缺少数据源");
    let atom = this.atom(t, 0, s),
      current = atom.relationId,
      i = atom.end;
    while (i < t.length) {
      const start = i;
      let subtype = "INNER";
      if (t[i].text === ",") {
        subtype = "CROSS";
        i++;
      } else {
        const words: string[] = [];
        while (
          i < t.length &&
          [
            "INNER",
            "LEFT",
            "RIGHT",
            "FULL",
            "OUTER",
            "SEMI",
            "ANTI",
            "ASOF",
            "CROSS",
            "NATURAL",
            "POSITIONAL",
          ].includes(t[i].upper)
        )
          words.push(t[i++].upper);
        if (t[i]?.upper !== "JOIN") {
          this.diagnostic(
            t.slice(i),
            `未解析的 FROM 配置: ${this.text(t.slice(i))}`,
          );
          break;
        }
        i++;
        subtype = words.filter((w) => w !== "OUTER").join(" ") || "INNER";
      }
      atom = this.atom(t, i, s);
      i = atom.end;
      const condition = i;
      if (["ON", "USING"].includes(t[i]?.upper)) {
        i++;
        while (i < t.length) {
          if (t[i].text === "(") {
            i = matchingParen(t, i) + 1;
            continue;
          }
          if (
            t[i].text === "," ||
            [
              "JOIN",
              "INNER",
              "LEFT",
              "RIGHT",
              "FULL",
              "SEMI",
              "ANTI",
              "ASOF",
              "CROSS",
              "NATURAL",
              "POSITIONAL",
            ].includes(t[i].upper)
          )
            break;
          i++;
        }
      }
      current = this.op(
        "join",
        `${subtype} JOIN`,
        [current, atom.relationId],
        t.slice(start, i),
        s,
        {
          condition: this.text(t.slice(condition, i)),
          leftRelationId: current,
          rightRelationId: atom.relationId,
        },
      );
      this.expressionDependencies(t.slice(condition, i), current, s);
    }
    return current;
  }
  select(t: SqlToken[], s: Scope): string {
    const top = topLevelIndices(t),
      clauses = top.filter(
        (i) =>
          [
            "SELECT",
            "FROM",
            "WHERE",
            "HAVING",
            "WINDOW",
            "QUALIFY",
            "LIMIT",
            "OFFSET",
          ].includes(t[i].upper) ||
          (["GROUP", "ORDER"].includes(t[i].upper) &&
            t[i + 1]?.upper === "BY") ||
          (t[i].upper === "USING" && t[i + 1]?.upper === "SAMPLE"),
      );
    const get = (word: string) => {
      const i = clauses.find((i) => t[i].upper === word);
      return i === undefined
        ? []
        : t.slice(i, clauses.find((j) => j > i) ?? t.length);
    };
    const body = (w: string) =>
      get(w).slice(["GROUP", "ORDER", "USING"].includes(w) ? 2 : 1);
    let projection = body("SELECT"),
      distinct: SqlToken[] = [];
    if (projection[0]?.upper === "DISTINCT") {
      let end = 1;
      if (projection[1]?.upper === "ON" && projection[2]?.text === "(")
        end = matchingParen(projection, 2) + 1;
      distinct = projection.slice(0, end);
      projection = projection.slice(end);
    } else if (projection[0]?.upper === "ALL") projection = projection.slice(1);
    if (get("SELECT").length && !projection.length)
      this.fail(get("SELECT"), "SELECT 缺少输出表达式");
    let current = get("FROM").length
      ? this.from(body("FROM"), s)
      : this.source("Single row", "values", projection, s);
    if (get("USING").length)
      current = this.op("sample", "SAMPLE", [current], get("USING"), s);
    const apply = (
      w: string,
      type: Operator["type"],
      label = w,
      details: Record<string, unknown> = {},
    ) => {
      if (get(w).length) {
        if (!body(w).length) this.fail(get(w), `${w} 缺少表达式`);
        current = this.op(type, label, [current], get(w), s, details);
        this.expressionDependencies(body(w), current, s);
      }
    };
    apply("WHERE", "filter", "WHERE", { phase: "row" });
    const expressions = [
      ...projection,
      ...body("HAVING"),
      ...body("QUALIFY"),
      ...body("ORDER"),
    ];
    let aggregate = false,
      window = false;
    for (let i = 0; i < expressions.length; i++) {
      if (
        expressions[i].text === "(" &&
        ["SELECT", "WITH", "FROM", "VALUES"].includes(expressions[i + 1]?.upper)
      ) {
        i = matchingParen(expressions, i);
        continue;
      }
      if (expressions[i].upper === "OVER") window = true;
      if (
        this.aggregateNames.has(expressions[i].upper) &&
        expressions[i + 1]?.text === "("
      ) {
        let after = matchingParen(expressions, i + 1) + 1;
        if (
          expressions[after]?.upper === "FILTER" &&
          expressions[after + 1]?.text === "("
        )
          after = matchingParen(expressions, after + 1) + 1;
        if (expressions[after]?.upper !== "OVER") aggregate = true;
      }
    }
    if (get("GROUP").length || aggregate)
      current = this.op(
        "aggregate",
        "GROUP BY",
        [current],
        [...get("GROUP"), ...projection],
        s,
        {
          groupBy: this.text(body("GROUP")),
          expressions: this.text(projection),
          global: !get("GROUP").length,
        },
      );
    apply("HAVING", "filter", "HAVING", { phase: "group" });
    if (window)
      current = this.op("window", "Window", [current], expressions, s, {
        expressions: this.text(projection),
        definitions: this.text(body("WINDOW")),
      });
    apply("QUALIFY", "filter", "QUALIFY", { phase: "window" });
    if (
      projection.length &&
      !(
        (projection.length === 1 && projection[0].text === "*") ||
        (projection.length === 3 &&
          projection[1].text === "." &&
          projection[2].text === "*")
      )
    ) {
      current = this.op("projection", "SELECT", [current], projection, s);
      this.expressionDependencies(projection, current, s);
    }
    if (distinct.length)
      current = this.op(
        "output_modifier",
        distinct[1]?.upper === "ON" ? "DISTINCT ON" : "DISTINCT",
        [current],
        distinct,
        s,
        { keys: this.text(distinct), selectionOrder: this.text(body("ORDER")) },
      );
    apply("ORDER", "output_modifier", "ORDER BY");
    if (get("LIMIT").length === 1 || get("OFFSET").length === 1)
      this.fail(t, "LIMIT/OFFSET 缺少表达式");
    if (get("LIMIT").length || get("OFFSET").length)
      current = this.op(
        "output_modifier",
        "LIMIT/OFFSET",
        [current],
        [...get("LIMIT"), ...get("OFFSET")],
        s,
      );
    return current;
  }
  modifiers(t: SqlToken[], current: string, s: Scope) {
    const indices = topLevelIndices(t).filter((i) =>
      ["ORDER", "LIMIT", "OFFSET"].includes(t[i].upper),
    );
    indices.forEach((i, j) => {
      current = this.op(
        "output_modifier",
        t[i].upper === "ORDER" ? "ORDER BY" : "LIMIT/OFFSET",
        [current],
        t.slice(i, indices[j + 1] ?? t.length),
        s,
      );
    });
    return current;
  }
  statement(t: SqlToken[]) {
    const head = t[0]?.upper,
      s: Scope = { boundaryId: this.statementBoundary, names: new Map() };
    if (
      ["SELECT", "WITH", "FROM", "VALUES", "PIVOT", "UNPIVOT"].includes(head)
    ) {
      this.query(t, this.statementBoundary, undefined, true);
      return;
    }
    if (head === "CREATE") {
      let i = 1;
      const replace = t[i]?.upper === "OR";
      if (replace) i += 2;
      const temporary = ["TEMP", "TEMPORARY"].includes(t[i]?.upper);
      if (temporary) i++;
      if (t[i]?.upper === "UNIQUE") i++;
      const type = t[i++]?.upper;
      if (!LOGICAL_FLOW_CAPABILITIES.objects.includes(type as never)) {
        this.diagnostic(t, `未支持的 CREATE 类型: ${type}`);
        return;
      }
      const ifNotExists = t[i]?.upper === "IF";
      if (ifNotExists) i += 3;
      const parsed = this.name(t, i);
      i = parsed.end;
      const p = parsed.name.split("."),
        name = p.at(-1)!,
        catalog = temporary ? "temp" : p.length > 2 ? p[0] : this.catalog,
        schema = temporary ? "main" : p.length > 1 ? p.at(-2)! : this.schema,
        key = this.key(catalog, schema, name),
        existing = this.bindings.get(key);
      if (ifNotExists && existing) {
        this.dependency(
          existing,
          this.producers.get(
            this.op(
              "object_operation",
              `CREATE ${type} IF NOT EXISTS`,
              [],
              t,
              s,
            ),
          )!,
        );
        return;
      }
      const as = topLevelIndices(t).find((j) => j >= i && t[j].upper === "AS");
      let definition = as === undefined ? [] : t.slice(as + 1);
      const tableMacro = type === "MACRO" && definition[0]?.upper === "TABLE";
      if (tableMacro) definition = definition.slice(1);
      const object: FlowObject = {
        id: this.id("object"),
        name,
        catalog,
        schema,
        temporary,
        scope: temporary ? "connection" : "catalog",
        objectType: tableMacro ? "TABLE MACRO" : type,
        version: (this.versions.get(key) || existing?.version || 0) + 1,
        definedBy: this.statementId,
        state: "defined",
        definitionSql: this.text(definition) || undefined,
      };
      const inputs: string[] = [];
      if (definition.length && type === "TABLE")
        inputs.push(this.query(definition, this.statementBoundary));
      else if (definition.length && (type === "VIEW" || tableMacro))
        this.definitions.set(object.id, definition);
      const output = this.op(
        "object_operation",
        `CREATE ${temporary ? "TEMP " : ""}${object.objectType}`,
        type === "TABLE" ? inputs : [],
        t,
        s,
        {
          action: "create",
          objectId: object.id,
          definitionOnly: type !== "TABLE",
          replace,
        },
      );
      const producer = this.producers.get(output)!;
      if (type !== "TABLE")
        inputs.forEach((input) =>
          this.edge(this.producers.get(input)!, producer, "reference", input),
        );
      this.flow.nodes.push({
        id: object.id,
        kind: "object",
        statementId: this.statementId,
        boundaryId: this.statementBoundary,
        sourceSpan: this.span(t),
        label: `${object.objectType} ${parsed.name}`,
        object,
      });
      this.edge(producer, object.id, "object_dependency");
      this.flow.objects.push(object);
      this.bindings.set(key, object);
      this.versions.set(key, object.version);
      if (type === "INDEX") {
        const on = t.findIndex((t) => t.upper === "ON");
        if (on >= 0) {
          const table = this.resolve(this.name(t, on + 1).name);
          if (table) this.dependency(table, producer);
        }
      }
      if (type === "TABLE")
        t.slice(i).forEach((token) => {
          const object = this.resolve(identifier(token));
          if (object?.objectType === "TYPE") this.dependency(object, producer);
        });
      return;
    }
    if (head === "PREPARE") {
      const name = identifier(t[1]),
        as = t.findIndex((t) => t.upper === "AS");
      if (as < 0) this.fail(t, "PREPARE 缺少 AS");
      const output = this.op("object_operation", "PREPARE", [], t, s, {
        definitionOnly: true,
      });
      const object: FlowObject = {
        id: this.id("prepared"),
        name,
        objectType: "PREPARED",
        catalog: this.catalog,
        schema: this.schema,
        temporary: true,
        scope: "connection",
        version: 1,
        state: "defined",
        definedBy: this.statementId,
        definitionSql: this.text(t.slice(as + 1)),
      };
      this.flow.objects.push(object);
      this.bindings.set(this.key(this.catalog, this.schema, name), object);
      this.flow.nodes.push({
        id: object.id,
        kind: "object",
        statementId: this.statementId,
        boundaryId: this.statementBoundary,
        sourceSpan: this.span(t),
        label: `PREPARE ${name}`,
        object,
      });
      this.definitions.set(object.id, t.slice(as + 1));
      this.edge(this.producers.get(output)!, object.id, "object_dependency");
      return;
    }
    if (head === "EXECUTE") {
      const object = this.resolve(this.name(t, 1).name),
        output = this.op("projection", "EXECUTE", [], t, s, {
          action: "execute",
        });
      if (object) {
        this.dependency(object, this.producers.get(output)!);
        this.evaluateDefinition(object, output, s);
      } else this.diagnostic(t, "未解析的 Prepared Statement 引用");
      this.op("result", "Result", [output], t, s);
      return;
    }
    if (["DROP", "DEALLOCATE", "DETACH"].includes(head)) {
      let i = head === "DROP" ? 2 : 1;
      if (["PREPARE", "DATABASE"].includes(t[i]?.upper)) i++;
      if (t[i]?.upper === "IF") i += 2;
      const name = this.name(t, i).name,
        object = this.resolve(name),
        output = this.op("object_operation", head, [], t, s, {
          action: "release",
          name,
        });
      if (object) {
        this.dependency(object, this.producers.get(output)!);
        this.bindings.delete(
          this.key(object.catalog, object.schema, object.name),
        );
        this.flow.objects.push({
          ...object,
          id: this.id("released"),
          state: "released",
          definedBy: this.statementId,
        });
      }
      if (head === "DETACH")
        for (const [key, o] of this.bindings)
          if (o.catalog.toLowerCase() === name.toLowerCase())
            this.bindings.delete(key);
      return;
    }
    if (head === "ATTACH") {
      const as = t.findIndex((t) => t.upper === "AS"),
        name = as >= 0 ? identifier(t[as + 1]) : "attached";
      this.catalogs.add(name);
      this.boundary("catalog", t, this.statementBoundary, name);
      this.op("object_operation", "ATTACH", [], t, s, {
        action: "attach",
        name,
      });
      return;
    }
    if (head === "USE") {
      const p = this.name(t, 1).name.split(".");
      if (p.length > 1) {
        this.catalog = p[0];
        this.schema = p[1];
      } else if (this.catalogs.has(p[0])) {
        this.catalog = p[0];
        this.schema = "main";
      } else this.schema = p[0];
      this.op("object_operation", "USE", [], t, s, {
        catalog: this.catalog,
        schema: this.schema,
      });
      return;
    }
    if (["SET", "RESET"].includes(head)) {
      if (t[1]?.upper === "SEARCH_PATH")
        this.searchPath = (
          t.find((t) => t.kind === "string")?.text.slice(1, -1) || ""
        )
          .split(",")
          .map((s) => s.trim());
      this.op("object_operation", head, [], t, s, {
        configuration: this.text(t.slice(1)),
      });
      return;
    }
    if (["BEGIN", "START", "COMMIT", "ROLLBACK", "ABORT"].includes(head)) {
      this.op("object_operation", head, [], t, s, { action: "transaction" });
      return;
    }
    this.diagnostic(t, `未支持的 Statement: ${head}`);
    this.flow.nodes.push({
      id: this.id("unknown"),
      kind: "unknown",
      statementId: this.statementId,
      boundaryId: this.statementBoundary,
      sourceSpan: this.span(t),
      label: head || "Unknown",
      unknown: { reason: "Unsupported statement", sqlSnippet: this.text(t) },
    });
  }
  build() {
    try {
      const statements = splitSqlScript(this.sql);
      const connection = statements.length
        ? this.boundary(
            "connection",
            statements.flatMap((s) => s.tokens),
            undefined,
            "Connection",
          )
        : undefined;
      for (const statement of statements) {
        this.statementId = statement.id;
        this.statementBoundary = this.boundary(
          "statement",
          statement.tokens,
          connection,
          `Statement ${this.flow.statements.length + 1}`,
        );
        this.flow.statements.push({
          id: statement.id,
          sourceSpan: statement.sourceSpan,
          boundaryId: this.statementBoundary,
          kind: statement.tokens[0].upper.toLowerCase(),
        });
        try {
          this.statement(statement.tokens);
        } catch (error) {
          const e = error as SqlStructureError;
          this.flow.diagnostics.push({
            code: "FLOW_PARSE_ERROR",
            severity: "error",
            message: e.message,
            sourceSpan: sourceSpan(
              this.sql,
              e.offset || statement.sourceSpan.start,
              statement.sourceSpan.end,
            ),
          });
        }
      }
    } catch (error) {
      const e = error as SqlStructureError;
      this.flow.diagnostics.push({
        code: "FLOW_PARSE_ERROR",
        severity: "error",
        message: e.message,
        sourceSpan: sourceSpan(this.sql, e.offset || 0, this.sql.length),
      });
    }
    this.flow.status = this.flow.diagnostics.some((d) => d.severity === "error")
      ? "parse_error"
      : this.flow.diagnostics.length
        ? "partial"
        : "complete";
    return this.flow;
  }
}
export function parseLogicalRelationFlow(
  sql: string,
  context: FlowParseContext = {},
): FlowData {
  return new Builder(sql, context).build();
}
export function isFlowDataCurrent(
  flow: FlowData | null | undefined,
  sql: string,
) {
  return Boolean(flow && flow.source.sourceHash === hashSql(sql));
}
/** Intermediate Relations live in FlowData, not as repeated canvas Result cards. */
export function logicalFlowToCanvas(flow: FlowData): {
  nodes: DataFlowNode[];
  edges: DataFlowEdge[];
} {
  const nodes: DataFlowNode[] = flow.nodes
    .filter((n) => n.kind !== "boundary")
    .map((n) => {
      const type =
        n.kind === "relation"
          ? "source"
          : n.kind === "object"
            ? "schema"
            : n.operator?.type === "result"
              ? "result"
              : n.operator?.type === "join"
                ? "join"
                : n.operator?.type === "aggregate"
                  ? "aggregate"
                  : "sql_transform";
      return {
        id: n.id,
        type: "dataFlowNode",
        position: { x: 0, y: 0 },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        data: {
          id: n.id,
          type,
          title: n.label,
          subtitle: n.object
            ? `${n.object.scope} · ${n.object.catalog}.${n.object.schema}`
            : (n.relation?.bindingState === "unresolved"
                ? "未解析依赖"
                : n.relation?.sourceKind) || n.operator?.type,
          status: "idle",
          tableName: n.relation?.name,
          config: n.object || n.relation || n.operator || {},
          statementId: n.statementId,
          boundaryId: n.boundaryId,
          sourceSpan: n.sourceSpan,
          logicalKind: n.kind,
          sqlRange: n.sourceSpan,
          clauseSnippet: flow.source.sql.slice(
            n.sourceSpan.start,
            n.sourceSpan.end,
          ),
          acceptsStatementOutput:
            n.operator?.type === "result" &&
            flow.boundaries.find((b) => b.id === n.boundaryId)
              ?.parentBoundaryId ===
              flow.statements.find((st) => st.id === n.statementId)?.boundaryId,
          isRealDuckDB: false,
        },
      } as DataFlowNode;
    });
  const edges: DataFlowEdge[] = flow.edges
    .filter((e) => e.kind !== "boundary_contains")
    .map(
      (e) =>
        ({
          id: e.id,
          source: e.from,
          target: e.to,
          type: "dataFlowEdge",
          sourceHandle: "output",
          targetHandle:
            nodes.find((n) => n.id === e.to)?.data.type === "join" && e.kind === 'relation_flow' && (e.inputRole === '0' || e.inputRole === '1')
              ? e.inputRole === "1"
                ? "right"
                : "left"
              : "input",
          data: {
            label: e.label,
            flowKind: e.kind,
            inputRole: e.inputRole,
            joinSide: nodes.find(n => n.id === e.to)?.data.type === 'join' && e.kind === 'relation_flow'
              ? e.inputRole === '1' ? 'right' : 'left' : undefined,
            relationType: e.kind === "relation_flow" ? "data" : "schema",
          },
        }) as DataFlowEdge,
    );
  return { nodes, edges };
}
