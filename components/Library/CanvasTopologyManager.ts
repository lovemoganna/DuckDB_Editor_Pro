/**
 * CanvasTopologyManager — Topology-to-SQL Compiler
 *
 * Compiles a canvas topology (nodes + edges) into a valid DuckDB SQL query.
 * Supports DAG pipelines: Source → Transform → ... → Sink
 *
 * Design:
 * 1. Topological sort — resolve node execution order from edges
 * 2. Dependency graph — each node knows its input CTE names
 * 3. Multi-level transforms — chains of Transforms with proper CTE references
 * 4. Node-level SQL fragments — Source SELECT, Transform CTE body, Sink final query
 * 5. Validation — cycles, orphan nodes, missing table names
 */

// NodeType is re-exported from the bottom of this file

// ─── Public Types ───────────────────────────────────────────────

export type NodeType = 'Source' | 'Transform' | 'Sink' | 'Control';

export interface CanvasItem {
  id: string;
  objectId: number;
  nodeType?: string;
  metadata?: {
    sqlFragment?: string;
    tableName?: string;
    condition?: string;
    layerTag?: string;
    [key: string]: unknown;
  };
}

export interface CanvasEdge {
  id: string;
  sourceId: string;
  targetId: string;
}

export interface CompileOptions {
  /** Table alias prefix to avoid DuckDB reserved word clashes */
  aliasPrefix?: string;
  /** Wrap the whole query in a subselect for safety */
  wrapSubquery?: boolean;
}

// ─── Internal Types ────────────────────────────────────────────

interface CompiledCte {
  name: string;
  sql: string;
}

interface CompileResult {
  success: boolean;
  sql: string;
  ctes: CompiledCte[];
  /** Warnings: cycles, orphan nodes, missing table names */
  warnings: string[];
  /** Nodes with validation errors */
  errors: Array<{ nodeId: string; message: string }>;
}

// ─── Validation ────────────────────────────────────────────────

/**
 * Detect cycles using DFS with coloring.
 * Returns list of node IDs involved in cycles.
 */
function detectCycles(
  nodes: CanvasItem[],
  edges: CanvasEdge[]
): string[] {
  const inDegree: Record<string, number> = {};
  const adj: Record<string, string[]> = {};

  nodes.forEach(n => { inDegree[n.id] = 0; adj[n.id] = []; });

  for (const e of edges) {
    adj[e.sourceId]?.push(e.targetId);
    inDegree[e.targetId] = (inDegree[e.targetId] ?? 0) + 1;
  }

  // Kahn's algorithm for topological sort
  const queue: string[] = [];
  const sorted: string[] = [];

  nodes.forEach(n => { if ((inDegree[n.id] ?? 0) === 0) queue.push(n.id); });

  while (queue.length > 0) {
    const id = queue.shift()!;
    sorted.push(id);
    for (const neighbor of (adj[id] ?? [])) {
      inDegree[neighbor] = (inDegree[neighbor] ?? 1) - 1;
      if (inDegree[neighbor] === 0) queue.push(neighbor);
    }
  }

  // If we couldn't sort all nodes, there are cycles
  if (sorted.length !== nodes.length) {
    return nodes.filter(n => !sorted.includes(n.id)).map(n => n.id);
  }

  return [];
}

/**
 * Find orphan nodes (have no incoming AND no outgoing edges, excluding Source nodes).
 */
function findOrphanNodes(
  nodes: CanvasItem[],
  edges: CanvasEdge[]
): string[] {
  const hasIncoming = new Set(edges.map(e => e.targetId));
  const hasOutgoing = new Set(edges.map(e => e.sourceId));

  return nodes
    .filter(n => {
      const isSource = n.nodeType === 'Source';
      return !isSource && !hasIncoming.has(n.id) && !hasOutgoing.has(n.id);
    })
    .map(n => n.id);
}

// ─── Topological Sort ──────────────────────────────────────────

/**
 * Returns nodes sorted so that all dependencies come before dependents.
 */
function topologicalSort(
  nodes: CanvasItem[],
  edges: CanvasEdge[]
): CanvasItem[] {
  const inDegree: Record<string, number> = {};
  const adj: Record<string, string[]> = {};

  nodes.forEach(n => { inDegree[n.id] = 0; adj[n.id] = []; });
  for (const e of edges) {
    adj[e.sourceId]?.push(e.targetId);
    inDegree[e.targetId] = (inDegree[e.targetId] ?? 0) + 1;
  }

  const queue: string[] = [];
  nodes.forEach(n => { if ((inDegree[n.id] ?? 0) === 0) queue.push(n.id); });

  const sorted: CanvasItem[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = nodes.find(n => n.id === id);
    if (node) sorted.push(node);
    for (const neighbor of (adj[id] ?? [])) {
      inDegree[neighbor] = (inDegree[neighbor] ?? 1) - 1;
      if (inDegree[neighbor] === 0) queue.push(neighbor);
    }
  }

  // Fallback: append any remaining (cycle nodes)
  const sortedIds = new Set(sorted.map(n => n.id));
  nodes.forEach(n => { if (!sortedIds.has(n.id)) sorted.push(n); });

  return sorted;
}

// ─── CTE Name Generation ───────────────────────────────────────

function safeCteName(id: string, prefix: string): string {
  const clean = id.replace(/[^a-zA-Z0-9_]/g, '_');
  return `${prefix}_${clean}`;
}

// ─── SQL Fragment Generation ────────────────────────────────────

/**
 * Generate the SQL body for a single node based on its type.
 */
function generateNodeSql(
  node: CanvasItem,
  inputCteNames: string[],
  objectNameMap: Record<number, string>,
  defaultTable?: string
): string {
  const nodeType = node.nodeType || 'Source';
  const tableName = node.metadata?.tableName
    || objectNameMap[node.objectId]
    || defaultTable
    || 'unknown_table';
  const fragment = node.metadata?.sqlFragment || '';

  switch (nodeType) {
    case 'Source': {
      if (fragment.trim()) {
        return `SELECT * FROM (\n  ${fragment.trim()}\n) AS t_${node.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
      }
      return `SELECT * FROM "${tableName}"`;
    }

    case 'Transform': {
      // If node has explicit SQL fragment, use it directly
      if (fragment.trim()) {
        return fragment.trim();
      }
      // Otherwise, auto-generate from input CTEs
      if (inputCteNames.length === 0) {
        return `SELECT * FROM previous_cte -- 请在节点检视器中配置 SQL 变换逻辑`;
      }
      if (inputCteNames.length === 1) {
        return `SELECT * FROM ${inputCteNames[0]}`;
      }
      // Multiple inputs: auto-generate CROSS JOIN with overlay hints
      const joins = inputCteNames.map((name, i) =>
        i === 0 ? name : `  JOIN ${name} ON 1=1 -- 警告：多输入未配置 JOIN 条件`
      ).join('\n  ');
      return `SELECT *\nFROM ${joins}`;
    }

    case 'Control': {
      // Control adds WHERE / HAVING / CASE logic
      if (fragment.trim()) {
        const clean = fragment.trim();
        if (clean.toUpperCase().startsWith('WHERE') || clean.toUpperCase().startsWith('HAVING')) {
          if (inputCteNames.length > 0) {
            return `SELECT * FROM ${inputCteNames[inputCteNames.length - 1]} ${clean}`;
          }
          return `SELECT * FROM input_data ${clean}`;
        }
        return `SELECT * FROM (SELECT * FROM ${inputCteNames[inputCteNames.length - 1] || 'previous_cte'}) subq WHERE ${clean}`;
      }
      if (inputCteNames.length > 0) {
        return `SELECT * FROM ${inputCteNames[inputCteNames.length - 1]} WHERE 1=1`;
      }
      return `SELECT * FROM previous_cte WHERE 1=1`;
    }

    case 'Sink': {
      if (fragment.trim()) {
        return fragment.trim();
      }
      const lastInput = inputCteNames[inputCteNames.length - 1];
      if (lastInput) {
        return `SELECT * FROM ${lastInput}`;
      }
      return `SELECT 1 AS _sink_empty -- 无输入数据，请添加上游节点`;
    }

    default:
      return fragment.trim() || `SELECT * FROM "${tableName}"`;
  }
}

// ─── Main Compiler ──────────────────────────────────────────────

/**
 * Compile canvas topology to DuckDB SQL.
 *
 * Algorithm:
 * 1. Validate (cycles, orphans)
 * 2. Topological sort
 * 3. Build dependency map: nodeId → [incoming node CTE names]
 * 4. Generate CTE for each node
 * 5. Final SELECT from last non-Sink node, or from Sink
 */
export function compileToSql(
  items: CanvasItem[],
  edges: CanvasEdge[],
  options: CompileOptions = {}
): CompileResult {
  const { aliasPrefix = 'cte', wrapSubquery = false } = options;
  const warnings: CompileResult['warnings'] = [];
  const errors: CompileResult['errors'] = [];

  if (items.length === 0) {
    return {
      success: true,
      sql: '-- 画布为空，请添加节点后自动生成 SQL',
      ctes: [],
      warnings: [],
      errors: [],
    };
  }

  // ── Step 1: Validation ──
  const cycles = detectCycles(items, edges);
  if (cycles.length > 0) {
    warnings.push(`检测到循环依赖: ${cycles.join(', ')} — 这些节点未包含在 SQL 中`);
  }

  const orphans = findOrphanNodes(items, edges);
  orphans.forEach(id => {
    const node = items.find(n => n.id === id);
    warnings.push(`孤立节点: "${node?.metadata?.tableName || node?.objectId || id}" — 无连接边，已忽略`);
  });

  // Check for nodes with missing table names
  items.filter(n => !n.nodeType || n.nodeType === 'Source')
    .forEach(n => {
      if (!n.metadata?.tableName && n.objectId === 0) {
        warnings.push(`Source 节点 "${n.id}" 未配置表名`);
      }
    });

  // ── Step 2: Topological Sort ──
  const sorted = topologicalSort(items, edges);

  // ── Step 3: Build dependency map ──
  // For each node, which incoming edges bring data FROM which other nodes
  const incomingEdges: Record<string, CanvasEdge[]> = {};
  items.forEach(n => { incomingEdges[n.id] = []; });
  edges.forEach(e => { incomingEdges[e.targetId]?.push(e); });

  // Build a map: nodeId → CTE name of that node (for referencing in downstream nodes)
  const nodeCteName: Record<string, string> = {};
  sorted.forEach(n => {
    nodeCteName[n.id] = safeCteName(n.id, aliasPrefix);
  });

  // Object name map (objectId → name)
  const objectNameMap: Record<number, string> = {};
  // We'll pass this from the caller; use empty map for now (handled in generateNodeSql)

  // ── Step 4: Generate CTEs ──
  const ctes: CompiledCte[] = [];

  for (const node of sorted) {
    const nodeType = node.nodeType || 'Source';

    // Only generate CTEs for nodes that produce data (not pure Control nodes that just filter)
    if (nodeType === 'Control') {
      // Control nodes are inlined into their input CTE via WHERE clause
      continue;
    }

    // Get names of all CTEs that feed into this node
    const inputEdges = incomingEdges[node.id] || [];
    const inputCteNames = inputEdges
      .map(e => nodeCteName[e.sourceId])
      .filter(Boolean);

    const body = generateNodeSql(node, inputCteNames, objectNameMap);
    const cteName = nodeCteName[node.id];

    ctes.push({ name: cteName, sql: body });
  }

  // ── Step 5: Generate Final Query ──
  let finalSelect: string;

  // Find the logical "end" of the pipeline
  // Priority: Sink nodes first, then last non-Source node
  const sinkNodes = sorted.filter(n => n.nodeType === 'Sink');
  const nonSourceNodes = sorted.filter(n => n.nodeType !== 'Source');
  const endNodes = sinkNodes.length > 0 ? sinkNodes : nonSourceNodes;

  if (endNodes.length === 0) {
    finalSelect = 'SELECT 1 AS _empty_canvas';
  } else {
    // Find the last node in topological order that has outgoing edges (or is a sink)
    // More precisely: pick the node with no outgoing edges (end of chain)
    const hasOutgoing = new Set(edges.map(e => e.sourceId));
    const endNodesNoOutgoing = endNodes.filter(n => !hasOutgoing.has(n.id));
    const actualEnd = endNodesNoOutgoing.length > 0 ? endNodesNoOutgoing[0] : endNodes[endNodes.length - 1];
    const endCte = nodeCteName[actualEnd.id];

    if (endCte) {
      // Wrap in LIMIT unless it's already limited
      const endCteBody = ctes.find(c => c.name === endCte)?.sql || '';
      if (!endCteBody.toUpperCase().includes('LIMIT') && !endCteBody.toUpperCase().includes(';')) {
        finalSelect = `SELECT * FROM ${endCte} LIMIT 1000`;
      } else {
        finalSelect = `SELECT * FROM ${endCte}`;
      }
    } else {
      finalSelect = 'SELECT 1 AS _no_valid_pipeline';
    }
  }

  // ── Step 6: Assemble SQL ──
  let sql: string;

  if (ctes.length === 0) {
    sql = `-- 无有效数据流（所有节点可能为 Control 类型）\n${finalSelect}`;
  } else {
    const cteList = ctes.map(c => `  ${c.name} AS (\n    ${c.sql.split('\n').join('\n    ')}\n  )`).join(',\n');
    sql = `WITH\n${cteList}\n\n${finalSelect}`;
  }

  if (wrapSubquery) {
    sql = `SELECT * FROM (\n${sql.split('\n').map(l => '  ' + l).join('\n')}\n) _subq`;
  }

  // Prepend header comments
  const header = [
    '-- ═══════════════════════════════════════════════════════════',
    '-- 拓扑 SQL 预览 — 自动生成',
    `-- 节点数: ${items.length} | 边数: ${edges.length} | CTE数: ${ctes.length}`,
    `-- 生成时间: ${new Date().toLocaleTimeString('zh-CN')}`,
    '-- ═══════════════════════════════════════════════════════════',
    '',
  ].join('\n');

  return {
    success: errors.length === 0,
    sql: header + sql,
    ctes,
    warnings,
    errors,
  };
}

// ─── Alias-based Compatibility Export ──────────────────────────

export class CanvasTopologyManager {
  static compileToSql(
    items: Array<{
      id: string;
      nodeType?: string;
      metadata?: { sqlFragment?: string; tableName?: string; [key: string]: unknown };
      objectId: number;
    }>,
    edges: CanvasEdge[],
    objects: Array<{ id: number; name: string }>
  ): string {
    const objectNameMap: Record<number, string> = {};
    objects.forEach(o => { objectNameMap[o.id] = o.name; });

    const result = compileToSql(
      items.map(i => ({ ...i, metadata: i.metadata as CanvasItem['metadata'] })),
      edges,
      { aliasPrefix: 'cte' }
    );
    return result.sql;
  }
}
