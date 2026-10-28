/**
 * components/ExecutionPlan/model/planParser.ts
 *
 * Unified Adapter from DuckDB raw output to ExecutionPlanGraph.
 *
 * Supported inputs:
 * 1. DuckDB ANALYZE Profiling JSON (object with latency, cpu_time, children tree)
 * 2. DuckDB Physical Plan JSON (array or single root with name, extra_info, children)
 * 3. Raw rows array from DuckDB query execution
 * 4. Fallback text parser (for legacy ASCII/plain-text compatibility)
 */

import {
  ExecutionPlanGraph,
  ExecutionNode,
  ExecutionEdge,
  OperatorMetrics,
} from './types';
import { lookupOperator } from './operatorRegistry';
import { computeDiagnostics } from './diagnostics';
import { deriveSqlMapping } from './sqlMapper';

let nodeIdCounter = 0;
function generateNodeId(prefix = 'node'): string {
  return `${prefix}_${Date.now()}_${++nodeIdCounter}`;
}

/**
 * Extracts and cleans numeric values safely.
 */
function toNum(val: any): number | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  const n = typeof val === 'number' ? val : parseFloat(String(val));
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Resolves JSON payload from various input types.
 */
export function extractJsonPayload(input: any): any | null {
  if (!input) return null;

  // Already an object or array (not a string)
  if (typeof input === 'object' && !(input instanceof String)) {
    // If it's an array of DuckDB query result rows
    if (Array.isArray(input) && input.length > 0 && ('explain_value' in input[0] || 'explore_value' in input[0])) {
      for (const row of input) {
        const val = row.explain_value ?? row.explore_value ?? Object.values(row)[1] ?? Object.values(row)[0];
        if (typeof val === 'string') {
          const trimmed = val.trim();
          if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
              return JSON.parse(trimmed);
            } catch {
              // try next
            }
          }
        }
      }
    }
    return input;
  }

  // String input
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return null;
      }
    }
  }

  return null;
}

/**
 * Parses raw DuckDB input (JSON object, JSON array, rows, or text) into ExecutionPlanGraph.
 */
export function buildExecutionModel(
  rawInput: any,
  options?: {
    rawText?: string;
    fullSql?: string;
  }
): ExecutionPlanGraph {
  const json = extractJsonPayload(rawInput);
  const rawTextStr = options?.rawText ?? (typeof rawInput === 'string' ? rawInput : undefined);

  if (json) {
    if (Array.isArray(json)) {
      // Physical plan JSON array
      return parsePhysicalPlanJson(json, rawTextStr, options?.fullSql);
    } else if (typeof json === 'object') {
      // Analyze profiling JSON or single root
      if ('children' in json && Array.isArray(json.children)) {
        return parseAnalyzedProfilingJson(json, rawTextStr, options?.fullSql);
      } else if ('name' in json || 'operator_name' in json) {
        return parsePhysicalPlanJson([json], rawTextStr, options?.fullSql);
      }
    }
  }

  // Fallback to text parsing if rawText is provided
  if (rawTextStr && rawTextStr.trim()) {
    return parseTextPlanFallback(rawTextStr, options?.fullSql);
  }

  // Empty graph
  return {
    rootNodeId: '',
    nodes: new Map(),
    edges: [],
    isAnalyzed: false,
    rawJson: json,
    rawText: rawTextStr,
    error: '无执行计划数据',
  };
}

/**
 * Parses DuckDB `EXPLAIN (ANALYZE, FORMAT JSON)` Profiling JSON.
 */
function parseAnalyzedProfilingJson(
  rootObj: any,
  rawText?: string,
  fullSql?: string
): ExecutionPlanGraph {
  const nodes = new Map<string, ExecutionNode>();
  const edges: ExecutionEdge[] = [];

  const queryLatencySeconds = toNum(rootObj.latency);
  const queryCpuTimeSeconds = toNum(rootObj.cpu_time);
  const systemPeakMemoryBytes = toNum(rootObj.system_peak_buffer_memory);

  // Traverse tree
  function traverse(rawNode: any, parentId?: string): string {
    const rawName = String(
      rawNode.operator_name || rawNode.name || rawNode.operator_type || 'UNKNOWN'
    ).trim();

    const { entry, isUnknown } = lookupOperator(rawName);
    const id = generateNodeId('op');

    // Extract metrics strictly without fabricating 0s
    const timingSec = toNum(rawNode.operator_timing);
    const timingMs = timingSec !== undefined ? timingSec * 1000 : undefined;
    const actualRows = toNum(rawNode.operator_cardinality);
    const rowsScanned = toNum(rawNode.operator_rows_scanned);
    const cpuTime = toNum(rawNode.cpu_time);
    const cumulativeRows = toNum(rawNode.cumulative_cardinality);
    const cumulativeScanned = toNum(rawNode.cumulative_rows_scanned);
    const resultSetSize = toNum(rawNode.result_set_size);

    const extra = (rawNode.extra_info && typeof rawNode.extra_info === 'object')
      ? { ...rawNode.extra_info }
      : {};

    const estimatedRows = toNum(extra['Estimated Cardinality']);

    const metrics: OperatorMetrics = {
      actualRows,
      rowsScanned,
      timingSeconds: timingSec,
      timingMs,
      estimatedRows,
      cpuTimeSeconds: cpuTime,
      cumulativeRows,
      cumulativeScanned,
      resultSetSizeBytes: resultSetSize,
    };

    const node: ExecutionNode = {
      id,
      name: rawName,
      operatorType: String(rawNode.operator_type || rawName),
      category: entry.category,
      isUnknownOperator: isUnknown,
      chineseName: entry.chineseName,
      summary: entry.summary,
      description: entry.description,
      metrics,
      extraInfo: extra,
      diagnostics: [],
      childrenIds: [],
      parentIds: parentId ? [parentId] : [],
    };

    nodes.set(id, node);

    // Recursively process children
    const rawChildren: any[] = Array.isArray(rawNode.children) ? rawNode.children : [];
    for (const childRaw of rawChildren) {
      const childId = traverse(childRaw, id);
      node.childrenIds.push(childId);

      // Data flows from child (source) up to current node (target)
      const childNode = nodes.get(childId);
      const flowRows = childNode?.metrics.actualRows ?? childNode?.metrics.estimatedRows;
      const relWidth = computeRelativeWidth(flowRows);

      edges.push({
        id: `edge_${childId}_to_${id}`,
        source: childId,
        target: id,
        rows: flowRows,
        isExplosion: Boolean(
          typeof actualRows === 'number' &&
          typeof childNode?.metrics.actualRows === 'number' &&
          childNode.metrics.actualRows > 0 &&
          actualRows > childNode.metrics.actualRows * 2
        ),
        relativeWidth: relWidth,
      });
    }

    return id;
  }

  // DuckDB ANALYZE root object contains `children`
  let rootNodeId = '';
  const topChildren: any[] = Array.isArray(rootObj.children) ? rootObj.children : [];

  if (topChildren.length === 1 && topChildren[0].operator_name === 'EXPLAIN_ANALYZE') {
    // If the only child is the EXPLAIN_ANALYZE envelope, process its inner query root
    const innerChildren: any[] = Array.isArray(topChildren[0].children) ? topChildren[0].children : [];
    if (innerChildren.length === 1) {
      rootNodeId = traverse(innerChildren[0]);
    } else {
      rootNodeId = traverse(topChildren[0]);
    }
  } else if (topChildren.length > 0) {
    rootNodeId = traverse(topChildren[0]);
  } else {
    // Single node root object itself
    rootNodeId = traverse(rootObj);
  }

  // Calculate total operator timing (sum of timing across all operators)
  let totalOpTiming = 0;
  for (const node of nodes.values()) {
    if (typeof node.metrics.timingSeconds === 'number') {
      totalOpTiming += node.metrics.timingSeconds;
    }
  }

  // Second pass: compute timing percentage, diagnostics, and SQL mapping
  for (const node of nodes.values()) {
    if (totalOpTiming > 0 && typeof node.metrics.timingSeconds === 'number') {
      node.metrics.timingPercentage = (node.metrics.timingSeconds / totalOpTiming) * 100;
    }
    const childNodes = node.childrenIds.map(cid => nodes.get(cid)!).filter(Boolean);
    node.diagnostics = computeDiagnostics(node, childNodes, totalOpTiming);
    const sqlMap = deriveSqlMapping(node, fullSql);
    node.sqlHint = sqlMap.sqlSnippet;
  }

  return {
    queryLatencySeconds,
    queryCpuTimeSeconds,
    systemPeakMemoryBytes,
    totalOperatorTimingSeconds: totalOpTiming > 0 ? totalOpTiming : undefined,
    rootNodeId,
    nodes,
    edges,
    isAnalyzed: true,
    rawJson: rootObj,
    rawText,
  };
}

/**
 * Parses DuckDB `EXPLAIN (FORMAT JSON)` Physical Plan JSON.
 */
function parsePhysicalPlanJson(
  planArray: any[],
  rawText?: string,
  fullSql?: string
): ExecutionPlanGraph {
  const nodes = new Map<string, ExecutionNode>();
  const edges: ExecutionEdge[] = [];

  function traverse(rawNode: any, parentId?: string): string {
    const rawName = String(
      rawNode.name || rawNode.operator_name || rawNode.operator_type || 'UNKNOWN'
    ).trim();

    const { entry, isUnknown } = lookupOperator(rawName);
    const id = generateNodeId('op');

    const extra = (rawNode.extra_info && typeof rawNode.extra_info === 'object')
      ? { ...rawNode.extra_info }
      : {};

    const estimatedRows = toNum(extra['Estimated Cardinality']);

    const metrics: OperatorMetrics = {
      estimatedRows,
      // In physical plan without analyze, actualRows, rowsScanned, and timing are strictly undefined
    };

    const node: ExecutionNode = {
      id,
      name: rawName,
      operatorType: rawName,
      category: entry.category,
      isUnknownOperator: isUnknown,
      chineseName: entry.chineseName,
      summary: entry.summary,
      description: entry.description,
      metrics,
      extraInfo: extra,
      diagnostics: [],
      childrenIds: [],
      parentIds: parentId ? [parentId] : [],
    };

    nodes.set(id, node);

    const rawChildren: any[] = Array.isArray(rawNode.children) ? rawNode.children : [];
    for (const childRaw of rawChildren) {
      const childId = traverse(childRaw, id);
      node.childrenIds.push(childId);

      const childNode = nodes.get(childId);
      const flowRows = childNode?.metrics.estimatedRows;
      const relWidth = computeRelativeWidth(flowRows);

      edges.push({
        id: `edge_${childId}_to_${id}`,
        source: childId,
        target: id,
        rows: flowRows,
        relativeWidth: relWidth,
      });
    }

    return id;
  }

  const rootNodeId = planArray.length > 0 ? traverse(planArray[0]) : '';

  // SQL mapping pass
  for (const node of nodes.values()) {
    const sqlMap = deriveSqlMapping(node, fullSql);
    node.sqlHint = sqlMap.sqlSnippet;
  }

  return {
    rootNodeId,
    nodes,
    edges,
    isAnalyzed: false,
    rawJson: planArray,
    rawText,
  };
}

/**
 * Fallback parser for text/ASCII box plans (maintains backwards compatibility for tests & audits).
 */
function parseTextPlanFallback(
  text: string,
  fullSql?: string
): ExecutionPlanGraph {
  const nodes = new Map<string, ExecutionNode>();
  const edges: ExecutionEdge[] = [];

  const lines = text.split('\n');
  const extractedOpLines: { raw: string; name: string; extra: Record<string, any>; timingMs?: number; costPct?: number }[] = [];

  let currentOp: { raw: string; name: string; extra: Record<string, any>; timingMs?: number; costPct?: number } | null = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/[┌┐└┘├┤─│┬┴┼]/g, ' ').trim();
    if (!line) continue;
    if (line.toLowerCase().includes('physical plan')) continue;

    // Check if line specifies an operator name in uppercase
    const opMatch = line.match(/^([A-Z_]{3,}(?:_[A-Z0-9]+)*)(?:\s+(.*))?$/);
    if (opMatch && !line.startsWith('EC:') && !line.startsWith('ACTUAL') && !line.startsWith('FILTERS')) {
      if (currentOp) extractedOpLines.push(currentOp);
      const opName = opMatch[1];
      const remainder = opMatch[2] || '';
      const extra: Record<string, any> = {};
      if (remainder) {
        extra['Detail'] = remainder;
      }
      currentOp = { raw: line, name: opName, extra };
      continue;
    }

    if (currentOp) {
      if (line.includes('EC:')) {
        const ecMatch = line.match(/EC:\s*([\d.]+)(?:\s*\(([\d.]+)%\))?/i);
        if (ecMatch) {
          currentOp.extra['Estimated Cardinality'] = ecMatch[1];
          if (ecMatch[2]) currentOp.costPct = parseFloat(ecMatch[2]);
        }
      } else if (line.toLowerCase().includes('actual time:')) {
        const tMatch = line.match(/actual\s+time:\s*([\d.]+)\s*ms/i);
        if (tMatch) currentOp.timingMs = parseFloat(tMatch[1]);
      } else if (line.toLowerCase().startsWith('filters:')) {
        currentOp.extra['Filters'] = line.replace(/filters:\s*/i, '').trim();
      } else if (line.toLowerCase().startsWith('condition:')) {
        currentOp.extra['Conditions'] = line.replace(/condition:\s*/i, '').trim();
      } else {
        currentOp.extra['Annotation_' + Object.keys(currentOp.extra).length] = line;
      }
    }
  }

  if (currentOp) extractedOpLines.push(currentOp);

  if (extractedOpLines.length === 0) {
    return {
      rootNodeId: '',
      nodes,
      edges,
      isAnalyzed: false,
      rawText: text,
      error: '未能拆成步骤树，已显示原始文本',
    };
  }

  // Construct chain/tree from extracted op lines
  let prevId: string | null = null;
  let rootNodeId = '';

  for (let i = 0; i < extractedOpLines.length; i++) {
    const item = extractedOpLines[i];
    const { entry, isUnknown } = lookupOperator(item.name);
    const id = generateNodeId('fallback_op');
    if (i === 0) rootNodeId = id;

    const estimatedRows = toNum(item.extra['Estimated Cardinality']);
    const timingSec = item.timingMs !== undefined ? item.timingMs / 1000 : undefined;

    const node: ExecutionNode = {
      id,
      name: item.name,
      operatorType: item.name,
      category: entry.category,
      isUnknownOperator: isUnknown,
      chineseName: entry.chineseName,
      summary: entry.summary,
      description: entry.description,
      metrics: {
        estimatedRows,
        timingMs: item.timingMs,
        timingSeconds: timingSec,
        timingPercentage: item.costPct,
      },
      extraInfo: item.extra,
      diagnostics: [],
      childrenIds: [],
      parentIds: prevId ? [prevId] : [],
    };

    nodes.set(id, node);

    if (prevId) {
      const parentNode = nodes.get(prevId);
      if (parentNode) {
        parentNode.childrenIds.push(id);
        edges.push({
          id: `edge_${id}_to_${prevId}`,
          source: id,
          target: prevId,
          rows: estimatedRows,
          relativeWidth: computeRelativeWidth(estimatedRows),
        });
      }
    }

    prevId = id;
  }

  for (const node of nodes.values()) {
    const sqlMap = deriveSqlMapping(node, fullSql);
    node.sqlHint = sqlMap.sqlSnippet;
  }

  return {
    rootNodeId,
    nodes,
    edges,
    isAnalyzed: extractedOpLines.some(o => o.timingMs !== undefined),
    rawText: text,
  };
}

/**
 * Calculates a proportional edge width between 1px and 8px based on row counts.
 */
function computeRelativeWidth(rows?: number): number {
  if (rows === undefined || rows === null || rows <= 0) return 2;
  // Logarithmic scale: 1 row -> 2px, 10 -> 3px, 100 -> 4px, 1000 -> 5px, 1M -> 8px
  return Math.min(8, Math.max(1.5, Math.round(1.5 + Math.log10(Math.max(1, rows)) * 1.1)));
}
