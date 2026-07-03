/**
 * explainParser.ts — Parse and annotate DuckDB EXPLAIN (ANALYZE) output.
 *
 * Loop 6 of SqlEditor Pro refactor.
 *
 * DuckDB's EXPLAIN ANALYZE output is a tree of annotated nodes.
 * Each node looks like:
 *
 *   ┌─────────────────────────────────────┐
 *   │          Hash Join                   │
 *   │         EC: 1.00 (100.00%)           │
 *   │        Cost: 5820.46                 │
 *   │      Elements: 50000 rn, 2000 r        │
 *   └─────────────────────────────────────┘
 *   ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
 *     Estimated Cardinalities: 50000, 2000
 *   └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
 *
 * We parse these into structured `ExplainNode` objects with:
 *   - id, name, type, timing, estimatedCost, actualCardinalities
 *
 * The enhanced SqlEditorExplainView renders this as a formatted tree
 * with color-coded cost / timing annotations.
 */

/** A single parsed node from an EXPLAIN tree. */
export interface ExplainNode {
  /** Unique ID for React keys. */
  id: string;
  /** Display name, e.g. "Hash Join", "Seq Scan", "Aggregate". */
  name: string;
  /** Lowercase node type for styling. */
  type: ExplainNodeType;
  /** Human-readable annotation lines (everything under the box). */
  annotations: string[];
  /** Estimated cumulative cost (EC field). */
  estimatedCost?: number;
  /** Estimated cost as fraction of total (0–1). */
  costFraction?: number;
  /** Estimated cardinalities: [inputEst, outputEst]. */
  estimatedCardinalities?: [number, number];
  /** Child nodes. */
  children: ExplainNode[];
  /** Raw box lines for fallback rendering. */
  rawLines: string[];
}

/** All node types we recognize and style. */
export type ExplainNodeType =
  | 'scan'
  | 'join'
  | 'aggregate'
  | 'sort'
  | 'projection'
  | 'filter'
  | 'result'
  | 'materialize'
  | 'insert'
  | 'update'
  | 'delete'
  | 'copy'
  | 'union'
  | 'set'
  | 'window'
  | 'subquery'
  | 'cte'
  | 'pragma'
  | 'other';

const NODE_TYPE_KEYWORDS: Record<string, ExplainNodeType> = {
  // Scans
  seq_scan: 'scan', seqscan: 'scan',
  chunk_scan: 'scan', tablesample: 'scan',
  index_scan: 'scan', indexscan: 'scan',
  bitwise_index_scan: 'scan',
  bookmark_lookup: 'scan',
  column_data_scan: 'scan',
  // Joins
  hash_join: 'join', merge_join: 'join', nested_loop: 'join',
  iejoin: 'join', cross_product: 'join',
  // Aggregation
  aggregate: 'aggregate', hash_group_by: 'aggregate',
  perfect_hash_group_by: 'aggregate', window: 'window',
  streaming_window: 'window',
  // Sort
  top_n: 'sort', order_by: 'sort', sort: 'sort',
  // Projection
  projection: 'projection', simple_projection: 'projection',
  // Filter
  filter: 'filter', chunk_filter: 'filter',
  // Result
  result_collector: 'result', result: 'result', base_table: 'result',
  // Materialize
  materialize: 'materialize', order_by_simplified: 'materialize',
  // Write
  insert: 'insert', update: 'update', delete: 'delete',
  // Export
  copy_from_file: 'copy', copy_to_file: 'copy', export: 'copy',
  // Set ops
  union: 'union', setop: 'set', except: 'set', intersect: 'set',
  // Other
  subquery: 'subquery', cte_scan: 'cte', recursive_cte: 'cte',
  pragma: 'pragma', explain: 'other',
};

function classifyNode(name: string): ExplainNodeType {
  const lower = name.toLowerCase().replace(/\s+/g, '_');
  for (const [keyword, type] of Object.entries(NODE_TYPE_KEYWORDS)) {
    if (lower.includes(keyword)) return type;
  }
  return 'other';
}

function parseEcLine(line: string): { ec: number; fraction: number } | null {
  // EC: 1234.56 (100.00%)
  const m = line.match(/EC:\s*([\d.]+)\s*\(([\d.]+)%\)/);
  if (!m) return null;
  return { ec: parseFloat(m[1]), fraction: parseFloat(m[2]) / 100 };
}

function parseCostLine(line: string): number | null {
  // Cost: 5820.46
  const m = line.match(/Cost:\s*([\d.]+)/);
  return m ? parseFloat(m[1]) : null;
}

function parseCardinalities(line: string): [number, number] | null {
  // Estimated Cardinalities: 50000, 2000
  const m = line.match(/Estimated Cardinalities:\s*([\d,]+),\s*([\d,]+)/);
  if (!m) return null;
  return [parseInt(m[1].replace(/,/g, '')), parseInt(m[2].replace(/,/g, ''))];
}

function parseTiming(line: string): number | null {
  // Actual time: 0.00..0.50  (rows 50000)
  // Cumulative time: 0.00..0.50
  const m = line.match(/(?:Actual|Cumulative) time:\s*[\d.]+\.\.([\d.]+)/);
  return m ? parseFloat(m[1]) : null;
}

const BOX_TOP_RE = /^[\s]*[┌─]+[\s]*[┐]?/;
const BOX_BOTTOM_RE = /^[\s]*[└─]+[\s]*[┘]?/;
function extractBoxName(lines: string[], startIdx: number): { name: string; endIdx: number; rawLines: string[] } | null {
  // Strategy: find top border, find matching bottom border (same width),
  // extract name from first non-empty content line, return content lines as rawLines.
  let topIdx = -1;
  let topLine = '';
  for (let i = startIdx; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t && /^[┌─╔]/.test(t)) { topIdx = i; topLine = t; break; }
  }
  if (topIdx < 0) return null;

  // Find matching bottom border — same width as top, same first/last char
  const bottomChar = topLine[0] === '┌' ? '└' : topLine[0] === '╔' ? '╚' : '└';
  const width = topLine.length;
  let bottomIdx = -1;
  for (let i = topIdx + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.length === width && t.startsWith(bottomChar)) {
      bottomIdx = i;
      break;
    }
    // If we hit another top border before finding bottom, this isn't a valid box
    if (/^[┌─╔]/.test(t)) break;
  }
  if (bottomIdx < 0) return null;

  // Extract content lines (between top and bottom)
  const rawLines = lines.slice(topIdx, bottomIdx);

  // Find name: first non-empty, non-border line between top and bottom
  let name = '';
  for (let i = topIdx + 1; i < bottomIdx; i++) {
    const t = lines[i].trim();
    if (t && !/^[│├║╠╣┄─]+$/.test(t)) {
      // Strip any leading/trailing box-drawing characters
      name = t.replace(/^[│├║╠╣┄─\s]+/, '').replace(/[│├║╠╣┄─\s]+$/, '').trim();
      break;
    }
  }

  if (!name) return null;
  return { name, endIdx: bottomIdx, rawLines };
}

// parseAnnotation is kept for documentation — annotations are now extracted
// directly from box.rawLines in parseExplainOutput.
//
// function parseAnnotation(lines: string[], startIdx: number) { ... }

/**
 * Parse raw DuckDB EXPLAIN (ANALYZE) text into a tree of ExplainNode objects.
 */
export function parseExplainOutput(raw: string): ExplainNode[] {
  const lines = raw.split('\n');
  const result: ExplainNode[] = [];
  let idx = 0;
  let nodeId = 0;

  while (idx < lines.length) {
    const trimmed = lines[idx].trim();
    if (!trimmed) { idx++; continue; }
    if (BOX_BOTTOM_RE.test(trimmed)) { idx++; continue; }

    // Try to parse as a box node
    const box = extractBoxName(lines, idx);
    if (box) {
      // Extract structured fields from box raw content (everything after top border)
      let estimatedCost: number | undefined;
      let costFraction: number | undefined;
      let estimatedCardinalities: [number, number] | undefined;
      const remainingAnnotations: string[] = [];

      for (let bi = 1; bi < box.rawLines.length; bi++) {
        const raw = box.rawLines[bi];
        const stripped = raw.replace(/^[│├║╠╣╬└┘─\s]+/, '').replace(/[│├║╠╣╬└┘─\s]+$/, '').trim();
        if (!stripped) continue;
        const ec = parseEcLine(stripped);
        if (ec) { estimatedCost = ec.ec; costFraction = ec.fraction; continue; }
        const cards = parseCardinalities(stripped);
        if (cards) { estimatedCardinalities = cards; continue; }
        remainingAnnotations.push(stripped);
      }

      // Recurse for child nodes (lines indented ≥ 3 spaces after parent box)
      const children: ExplainNode[] = [];
      let childIdx = box.endIdx + 1;
      let lastChildEnd = box.endIdx;
      while (childIdx < lines.length) {
        const childLine = lines[childIdx];
        if (!childLine || !childLine.startsWith('    ')) break;
        const childBox = extractBoxName(lines, childIdx);
        if (!childBox) { childIdx++; continue; }
        lastChildEnd = Math.max(lastChildEnd, childBox.endIdx);
        let childEc: number | undefined;
        let childFrac: number | undefined;
        const childRemAnns: string[] = [];
        for (let bi = 1; bi < childBox.rawLines.length; bi++) {
          const stripped = childBox.rawLines[bi].replace(/^[│├║╠╣╬└┘─\s]+/, '').replace(/[│├║╠╣╬└┘─\s]+$/, '').trim();
          if (!stripped) continue;
          const ec = parseEcLine(stripped);
          if (ec) { childEc = ec.ec; childFrac = ec.fraction; continue; }
          childRemAnns.push(stripped);
        }
        children.push({
          id: `node-${nodeId++}`,
          name: childBox.name,
          type: classifyNode(childBox.name),
          annotations: childRemAnns,
          estimatedCost: childEc,
          costFraction: childFrac,
          rawLines: childBox.rawLines,
          children: [],
        });
        childIdx = childBox.endIdx + 1;
      }

      result.push({
        id: `node-${nodeId++}`,
        name: box.name,
        type: classifyNode(box.name),
        annotations: remainingAnnotations,
        estimatedCost,
        costFraction,
        estimatedCardinalities,
        rawLines: box.rawLines,
        children,
      });

      idx = lastChildEnd + 1;
      continue;
    }

    // Plain text line (no box)
    if (trimmed) {
      result.push({
        id: `node-${nodeId++}`,
        name: trimmed,
        type: 'other',
        annotations: [],
        rawLines: [lines[idx]],
        children: [],
      });
    }
    idx++;
  }

  return result;
}

/** Format a number as a compact string, e.g. 1234567 → "1.23M". */
export function formatCost(n: number | undefined): string {
  if (n === undefined) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toFixed(2);
}

/** Format a cardinality number compactly. */
export function formatCardinality(n: number | undefined): string {
  if (n === undefined) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

/** Compute a CSS color for a cost fraction (0 = cheap/green, 1 = expensive/red). */
export function costColor(fraction: number | undefined): string {
  if (fraction === undefined) return 'text-monokai-comment';
  if (fraction < 0.2) return 'text-monokai-green';
  if (fraction < 0.5) return 'text-monokai-yellow';
  if (fraction < 0.8) return 'text-monokai-orange';
  return 'text-monokai-pink';
}
