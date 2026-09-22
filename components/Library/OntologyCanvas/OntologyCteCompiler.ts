import { Edge, Node } from 'reactflow';

export interface CompilerOptions {
  viewName?: string;
  includeComments?: boolean;
  indentSpaces?: number;
}

export interface CompilationResult {
  sql: string;
  topologicalOrder: string[];
  hasCycle: boolean;
  cteCount: number;
  errors: string[];
  warnings: string[];
}

/**
 * Sanitizes an identifier to make it safe for SQL view & CTE names.
 */
export const sanitizeSqlIdentifier = (name: string): string => {
  if (!name) return 'cte_node';
  const clean = name.trim().replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
  return /^[0-9]/.test(clean) ? `node_${clean}` : clean;
};

/**
 * Performs Topological Sorting (Kahn's Algorithm) on the node graph
 * to establish strict execution dependency order for DuckDB CTEs.
 */
export const sortNodesTopologically = (
  nodes: Node[],
  edges: Edge[]
): { order: string[]; hasCycle: boolean } => {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  nodes.forEach((n) => {
    inDegree.set(n.id, 0);
    adjacency.set(n.id, []);
  });

  edges.forEach((e) => {
    if (nodeMap.has(e.source) && nodeMap.has(e.target) && e.source !== e.target) {
      adjacency.get(e.source)!.push(e.target);
      inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
    }
  });

  // Zero in-degree roots (independent base tables/foundation layer)
  const queue: string[] = nodes
    .filter((n) => (inDegree.get(n.id) || 0) === 0)
    .map((n) => n.id);

  const order: string[] = [];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    order.push(currentId);

    const neighbors = adjacency.get(currentId) || [];
    for (const neighborId of neighbors) {
      const nextDegree = (inDegree.get(neighborId) || 0) - 1;
      inDegree.set(neighborId, nextDegree);
      if (nextDegree === 0) {
        queue.push(neighborId);
      }
    }
  }

  const hasCycle = order.length !== nodes.length;

  // Append remaining unvisited nodes if cycle exists
  if (hasCycle) {
    nodes.forEach((n) => {
      if (!order.includes(n.id)) {
        order.push(n.id);
      }
    });
  }

  return { order, hasCycle };
};

/**
 * Compiles a ReactFlow Ontology Canvas graph into a production-grade DuckDB SQL CTE Pipeline.
 */
export const compileOntologyToCTE = (
  nodes: Node[],
  edges: Edge[],
  options: CompilerOptions = {}
): CompilationResult => {
  const {
    viewName = 'v_ontology_pipeline',
    includeComments = true,
    indentSpaces = 2,
  } = options;

  const errors: string[] = [];
  const warnings: string[] = [];

  if (nodes.length === 0) {
    return {
      sql: '-- No nodes present in Ontology Canvas',
      topologicalOrder: [],
      hasCycle: false,
      cteCount: 0,
      errors: ['Canvas is empty'],
      warnings: [],
    };
  }

  const { order, hasCycle } = sortNodesTopologically(nodes, edges);
  if (hasCycle) {
    errors.push('Cannot compile a cyclic ontology graph');
    warnings.push('Break the cycle or model it explicitly with a supported recursive CTE before compiling.');
    return {
      sql: '-- Compilation blocked: cyclic ontology graph',
      topologicalOrder: order,
      hasCycle: true,
      cteCount: 0,
      errors,
      warnings,
    };
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const indent = ' '.repeat(indentSpaces);
  const cteBlocks: string[] = [];

  // Track CTE names to avoid duplicate SQL aliases
  const idToCteAlias = new Map<string, string>();
  const usedAliases = new Set<string>();

  order.forEach((id) => {
    const node = nodeMap.get(id);
    if (!node) return;

    const rawLabel = node.data?.label || node.data?.name || id;
    let cteAlias = sanitizeSqlIdentifier(rawLabel);
    if (usedAliases.has(cteAlias)) {
      cteAlias = `${cteAlias}_${id.slice(0, 4)}`;
    }
    usedAliases.add(cteAlias);
    idToCteAlias.set(id, cteAlias);
  });

  order.forEach((id) => {
    const node = nodeMap.get(id)!;
    const cteAlias = idToCteAlias.get(id)!;
    const layer = node.data?.layer || 'Foundation';
    const sourceTable = node.data?.tableName || node.data?.sourceTable || cteAlias;
    const columns: string[] = node.data?.columns || node.data?.attributes || ['*'];
    const filterCondition = node.data?.filterCondition || node.data?.whereClause;

    // Incoming relationships (Parent CTE dependencies)
    const incomingEdges = edges.filter((e) => e.target === id && idToCteAlias.has(e.source));

    let body = '';

    if (includeComments) {
      body += `${indent}-- Layer: [${layer}] | Entity: ${node.data?.label || id}\n`;
    }

    if (incomingEdges.length === 0) {
      // Base Node (Foundation Layer) -> SELECT columns FROM sourceTable
      const colList = Array.isArray(columns) && columns.length > 0 ? columns.join(', ') : '*';
      body += `${indent}SELECT ${colList}\n${indent}FROM ${sourceTable}`;
      if (filterCondition) {
        body += `\n${indent}WHERE ${filterCondition}`;
      }
    } else {
      // Derived / Relational Node -> JOIN incoming CTEs
      const primaryParentEdge = incomingEdges[0];
      const primaryParentAlias = idToCteAlias.get(primaryParentEdge.source)!;

      const colList = Array.isArray(columns) && columns.length > 0 
        ? columns.map((col) => (col.includes('.') ? col : `${cteAlias}.${col}`)).join(', ') 
        : `${cteAlias}.*`;

      body += `${indent}SELECT ${colList}\n`;
      body += `${indent}FROM ${primaryParentAlias} AS ${cteAlias}\n`;

      // Process additional join parents
      incomingEdges.slice(1).forEach((edge) => {
        const parentAlias = idToCteAlias.get(edge.source)!;
        const joinType = edge.data?.joinType || 'LEFT';
        const joinCondition = edge.data?.joinCondition || edge.label || `${cteAlias}.id = ${parentAlias}.id`;
        body += `${indent}${joinType} JOIN ${parentAlias} ON ${joinCondition}\n`;
      });

      if (filterCondition) {
        body += `${indent}WHERE ${filterCondition}`;
      }
    }

    cteBlocks.push(`${cteAlias} AS (\n${body}\n)`);
  });

  const lastCteAlias = idToCteAlias.get(order[order.length - 1])!;
  const sqlHeader = `-- DuckDB Ontology Dynamic CTE Compilation Pipeline\n-- Generated: ${new Date().toISOString()}\n\n`;
  const viewPrefix = `CREATE OR REPLACE VIEW ${sanitizeSqlIdentifier(viewName)} AS\nWITH `;
  const fullCteClause = cteBlocks.join(',\n\n');
  const finalSelect = `\n\nSELECT * FROM ${lastCteAlias};`;

  const sql = `${sqlHeader}${viewPrefix}${fullCteClause}${finalSelect}`;

  return {
    sql,
    topologicalOrder: order.map((id) => idToCteAlias.get(id)!),
    hasCycle,
    cteCount: cteBlocks.length,
    errors,
    warnings,
  };
};
