/** Lossless SQL coordinates use UTF-16, the same unit as CodeMirror. */
import type { SourceSpan } from "./logicalRelationFlowTypes";

export interface SqlToken {
  text: string;
  upper: string;
  start: number;
  end: number;
  kind: "word" | "quoted" | "string" | "symbol" | "number";
}
export interface SqlStatement {
  id: string;
  sql: string;
  sourceSpan: SourceSpan;
  tokens: SqlToken[];
}
export class SqlStructureError extends Error {
  constructor(
    message: string,
    public offset: number,
  ) {
    super(message);
  }
}
export function sourceSpan(
  sql: string,
  start: number,
  end: number,
): SourceSpan {
  return {
    start,
    end,
    startLine: sql.slice(0, start).split("\n").length,
    endLine: sql.slice(0, Math.max(start, end - 1)).split("\n").length,
  };
}
export function utf8OffsetToUtf16(sql: string, byteOffset: number): number {
  let bytes = 0,
    chars = 0;
  for (const char of sql) {
    const size = new TextEncoder().encode(char).length;
    if (bytes + size > byteOffset) break;
    bytes += size;
    chars += char.length;
  }
  return chars;
}
export function tokenizeSql(sql: string): SqlToken[] {
  const tokens: SqlToken[] = [];
  let i = 0;
  while (i < sql.length) {
    if (/\s/.test(sql[i])) {
      i++;
      continue;
    }
    if (sql.slice(i, i + 2) === "--") {
      while (i < sql.length && sql[i] !== "\n") i++;
      continue;
    }
    if (sql.slice(i, i + 2) === "/*") {
      const start = i;
      i += 2;
      let depth = 1;
      while (i < sql.length && depth) {
        if (sql.slice(i, i + 2) === "/*") {
          depth++;
          i += 2;
        } else if (sql.slice(i, i + 2) === "*/") {
          depth--;
          i += 2;
        } else i++;
      }
      if (depth) throw new SqlStructureError("未结束的块注释", start);
      continue;
    }
    const start = i;
    let kind: SqlToken["kind"] = "symbol";
    const dollar = sql.slice(i).match(/^\$(?:[A-Za-z_][\w]*)?\$/)?.[0];
    if (dollar) {
      i += dollar.length;
      const end = sql.indexOf(dollar, i);
      if (end < 0) throw new SqlStructureError("未结束的 dollar 字符串", start);
      i = end + dollar.length;
      kind = "string";
    } else if (sql[i] === "'" || sql[i] === '"') {
      const quote = sql[i++];
      kind = quote === "'" ? "string" : "quoted";
      let closed = false;
      const escape =
        quote === "'" &&
        /[eE]/.test(sql[start - 1] || "") &&
        !/[\w]/.test(sql[start - 2] || "");
      while (i < sql.length) {
        if (escape && sql[i] === "\\") {
          i += 2;
          continue;
        }
        if (sql[i] === quote) {
          i++;
          if (sql[i] === quote) {
            i++;
            continue;
          }
          closed = true;
          break;
        }
        i++;
      }
      if (!closed) throw new SqlStructureError("未结束的字符串或标识符", start);
    } else if (/[\p{L}_]/u.test(String.fromCodePoint(sql.codePointAt(i)!))) {
      kind = "word";
      i += String.fromCodePoint(sql.codePointAt(i)!).length;
      while (
        i < sql.length &&
        /[\p{L}\p{N}_$]/u.test(String.fromCodePoint(sql.codePointAt(i)!))
      )
        i += String.fromCodePoint(sql.codePointAt(i)!).length;
    } else if (/\d/.test(sql[i])) {
      kind = "number";
      i++;
      while (i < sql.length && /[\d.]/.test(sql[i])) i++;
    } else {
      i++;
    }
    const text = sql.slice(start, i);
    tokens.push({
      text,
      upper: kind === "word" ? text.toUpperCase() : text,
      start,
      end: i,
      kind,
    });
  }
  return tokens;
}
export function matchingParen(tokens: SqlToken[], index: number): number {
  let depth = 0;
  for (let i = index; i < tokens.length; i++) {
    if (tokens[i].text === "(") depth++;
    if (tokens[i].text === ")" && --depth === 0) return i;
  }
  throw new SqlStructureError("未闭合的括号", tokens[index]?.start || 0);
}
export function topLevelIndices(tokens: SqlToken[]): number[] {
  const indices: number[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].text === ")")
      throw new SqlStructureError("多余的右括号", tokens[i].start);
    indices.push(i);
    if (tokens[i].text === "(") i = matchingParen(tokens, i);
  }
  return indices;
}
export function splitSqlScript(sql: string): SqlStatement[] {
  const tokens = tokenizeSql(sql);
  const statements: SqlStatement[] = [];
  let begin = 0;
  const push = (end: number) => {
    const body = tokens.slice(begin, end);
    begin = end + 1;
    if (!body.length) return;
    const start = body[0].start,
      finish = body[body.length - 1].end;
    statements.push({
      id: `statement_${statements.length}_0`,
      // Keep trailing comments in executable SQL. A caller wrapping a query
      // must still see its line-comment boundary and can add a newline.
      sql: sql.slice(start, tokens[end]?.start ?? sql.length).trimEnd(),
      sourceSpan: sourceSpan(sql, start, finish),
      tokens: body,
    });
  };
  // Semicolons inside quoted tokens are never separators. Validate parentheses per statement.
  tokens.forEach((token, index) => {
    if (token.text === ";") push(index);
  });
  push(tokens.length);
  statements.forEach((statement) => topLevelIndices(statement.tokens));
  return statements;
}
export function identifier(token: SqlToken): string {
  return token.kind === "quoted"
    ? token.text.slice(1, -1).replace(/""/g, '"')
    : token.text;
}
