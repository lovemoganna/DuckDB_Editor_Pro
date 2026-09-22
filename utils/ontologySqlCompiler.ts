/**
 * ontologySqlCompiler.ts — 本体画布拓扑 SQL 编译器
 * 
 * 功能：
 * 1. 接收画布节点 (Nodes/Items) 与边 (Edges/Links)
 * 2. 使用 Kahn 拓扑排序算法计算依赖次序
 * 3. 自动生成标准 DuckDB CTE (Common Table Expression) 执行流水线 SQL
 */

export interface SqlCompilerNode {
  id: string;
  name: string;
  sourceTable?: string;
  customSql?: string;
  selectFields?: string[];
  layer?: string;
}

export interface SqlCompilerEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  joinType?: 'LEFT' | 'INNER' | 'RIGHT' | 'FULL';
  onCondition?: string;
}

export interface CompileResult {
  sql: string;
  executionOrder: string[];
  hasCycle: boolean;
}

export function compileOntologyGraphToSql(
  nodes: SqlCompilerNode[],
  edges: SqlCompilerEdge[]
): CompileResult {
  if (!nodes || nodes.length === 0) {
    return {
      sql: '-- Canvas graph is empty',
      executionOrder: [],
      hasCycle: false,
    };
  }

  const nodeMap = new Map<string, SqlCompilerNode>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  // 1. 构建入度 (in-degree) 与邻接表
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, SqlCompilerEdge[]>();

  nodes.forEach((n) => {
    inDegree.set(n.id, 0);
    adjList.set(n.id, []);
  });

  edges.forEach((edge) => {
    if (inDegree.has(edge.targetNodeId) && adjList.has(edge.sourceNodeId)) {
      inDegree.set(edge.targetNodeId, (inDegree.get(edge.targetNodeId) || 0) + 1);
      adjList.get(edge.sourceNodeId)!.push(edge);
    }
  });

  // 2. Kahn's Algorithm 拓扑排序
  const queue: string[] = [];
  inDegree.forEach((deg, nodeId) => {
    if (deg === 0) {
      queue.push(nodeId);
    }
  });

  const executionOrder: string[] = [];
  while (queue.length > 0) {
    const currId = queue.shift()!;
    executionOrder.push(currId);

    const outgoingEdges = adjList.get(currId) || [];
    for (const edge of outgoingEdges) {
      const nextId = edge.targetNodeId;
      const newDeg = (inDegree.get(nextId) || 0) - 1;
      inDegree.set(nextId, newDeg);
      if (newDeg === 0) {
        queue.push(nextId);
      }
    }
  }

  const hasCycle = executionOrder.length < nodes.length;
  // 若存在环，则追加剩余节点
  if (hasCycle) {
    nodes.forEach((n) => {
      if (!executionOrder.includes(n.id)) {
        executionOrder.push(n.id);
      }
    });
  }

  // 3. 构建 CTE
  const ctes: string[] = [];
  const incomingEdgeMap = new Map<string, SqlCompilerEdge[]>();
  edges.forEach((e) => {
    if (!incomingEdgeMap.has(e.targetNodeId)) {
      incomingEdgeMap.set(e.targetNodeId, []);
    }
    incomingEdgeMap.get(e.targetNodeId)!.push(e);
  });

  const sanitizeName = (s: string) => s.toLowerCase().replace(/[^a-z0-9_]/g, '_');

  executionOrder.forEach((nodeId) => {
    const node = nodeMap.get(nodeId);
    if (!node) return;

    const cteName = `cte_${sanitizeName(node.name || node.id)}`;
    const fields = node.selectFields && node.selectFields.length > 0 
      ? node.selectFields.join(', ') 
      : '*';

    let cteBody = '';
    if (node.customSql) {
      cteBody = node.customSql.trim();
    } else {
      const fromTable = node.sourceTable || 'duckdb_tables';
      const inEdges = incomingEdgeMap.get(nodeId) || [];

      if (inEdges.length === 0) {
        cteBody = `SELECT ${fields} FROM ${fromTable}`;
      } else {
        const joins = inEdges.map((e) => {
          const srcNode = nodeMap.get(e.sourceNodeId);
          const srcCteName = srcNode ? `cte_${sanitizeName(srcNode.name || srcNode.id)}` : 'source_cte';
          const joinType = e.joinType || 'LEFT';
          const onCond = e.onCondition || '1=1';
          return `${joinType} JOIN ${srcCteName} ON ${onCond}`;
        }).join('\n  ');

        cteBody = `SELECT ${fields}\n  FROM ${fromTable}\n  ${joins}`;
      }
    }

    ctes.push(`${cteName} AS (\n  ${cteBody}\n)`);
  });

  const lastNodeId = executionOrder[executionOrder.length - 1];
  const lastNode = nodeMap.get(lastNodeId);
  const finalCteName = lastNode ? `cte_${sanitizeName(lastNode.name || lastNode.id)}` : 'cte_final';

  let sql = '-- Generated DuckDB Ontology Pipeline SQL\n';
  if (hasCycle) {
    sql += '-- WARNING: Cyclic dependency detected in graph; topological ordering best-effort fallback\n';
  }
  sql += `WITH ${ctes.join(',\n')}\nSELECT * FROM ${finalCteName};`;

  return {
    sql,
    executionOrder,
    hasCycle,
  };
}
