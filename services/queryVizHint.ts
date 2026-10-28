import type { VizHint } from '../types';

/**
 * Lightweight table reference extraction for lineage / frequency.
 * Avoids pulling the full SQL→workflow parser into the home shell.
 */
export function extractTablesFromSql(sql: string): string[] {
  if (!sql?.trim()) return [];
  const tables = new Set<string>();
  // Mask literals before comments so strings containing FROM / -- are not lineage.
  const cleaned = sql.replace(/'(?:''|[^'])*'/g, ' ')
    .replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
  const identifier = '(?:"(?:""|[^"])+"|`[^`]+`|[a-zA-Z_][\\w]*)';
  const qualified = `${identifier}(?:\\s*\\.\\s*${identifier})*`;
  const unquote = (raw: string) => raw.split(/\s*\.\s*/).map(part =>
    part.startsWith('"') ? part.slice(1, -1).replace(/""/g, '"') : part.replace(/^`|`$/g, '')).join('.');
  const ctes = new Set(Array.from(cleaned.matchAll(new RegExp(`(?:\\bWITH(?:\\s+RECURSIVE)?|,)\\s*(${identifier})(?:\\s*\\([^)]*\\))?\\s+AS\\s*\\(`, 'gi')),
    m => unquote(m[1]).toLowerCase()));
  const re = new RegExp(`\\b(?:FROM|JOIN|INTO|UPDATE|TABLE)\\s+(${qualified})`, 'gi');
  for (const match of cleaned.matchAll(re)) {
    const raw = unquote(match[1]);
    const lower = raw.toLowerCase();
    if (ctes.has(lower) || /^(select|values|lateral)$/.test(lower)
      || /^(information_schema|pg_catalog)\./.test(lower)
      || /^\s*\(/.test(cleaned.slice((match.index || 0) + match[0].length))) continue;
    tables.add(raw.replace(/^main\./i, ''));
  }

  return Array.from(tables);
}

export function extractSchemasFromSql(sql: string): string[] {
  const tables = extractTablesFromSql(sql);
  const schemas = new Set<string>();
  for (const t of tables) {
    if (t.includes('.')) {
      schemas.add(t.split('.').slice(-2)[0]);
    } else {
      schemas.add('main');
    }
  }
  return Array.from(schemas);
}

export interface VizHintInput {
  status?: 'success' | 'error';
  rowCount?: number | null;
  columns?: string[] | null;
  sampleRow?: Record<string, unknown> | null;
  hasChart?: boolean;
}

/**
 * Heuristic visualization value from real query results — never invents data.
 */
export function computeVizHint(input: VizHintInput): VizHint {
  if (input.status === 'error') return 'none';
  if (input.hasChart) return 'strong';

  const rows = input.rowCount ?? 0;
  if (rows <= 0) return 'none';

  const cols =
    input.columns && input.columns.length > 0
      ? input.columns
      : input.sampleRow
        ? Object.keys(input.sampleRow)
        : [];

  if (cols.length === 0) {
    return rows > 0 ? 'weak' : 'none';
  }

  let numericCols = 0;
  let categoricalCols = 0;
  if (input.sampleRow) {
    for (const c of cols) {
      const v = input.sampleRow[c];
      if (typeof v === 'number' && Number.isFinite(v)) numericCols += 1;
      else if (v != null && String(v).length > 0) categoricalCols += 1;
    }
  } else {
    // Column-name heuristics when we only have names
    for (const c of cols) {
      const n = c.toLowerCase();
      if (/(count|sum|avg|total|amount|qty|quantity|score|rate|pct|percent|value|num)/.test(n)) {
        numericCols += 1;
      } else {
        categoricalCols += 1;
      }
    }
  }

  if (cols.length === 1 && rows === 1) return 'strong'; // KPI-like
  if (numericCols >= 1 && categoricalCols >= 1 && rows >= 2 && rows <= 500) return 'strong';
  if (numericCols >= 1 && rows >= 2 && rows <= 1000) return 'weak';
  if (cols.length >= 2 && rows >= 2 && rows <= 200) return 'weak';
  return 'none';
}

export function vizHintLabel(hint: VizHint): string {
  switch (hint) {
    case 'strong':
      return '适合可视化';
    case 'weak':
      return '可尝试成图';
    default:
      return '暂无图表价值';
  }
}
