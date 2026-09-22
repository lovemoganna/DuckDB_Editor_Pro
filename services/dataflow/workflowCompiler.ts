/**
 * Workflow Compiler
 *
 * 核心职责：
 * 1. 拓扑排序 (Kahn's Algorithm) 与环路检测
 * 2. 依赖解析（确定上游输入 Relation）
 * 3. 严格的 SQL 生成器：根据节点配置状态生成可直接在 DuckDB 执行的准确 SQL
 * 4. 保证 SQL Preview 与实际执行 SQL 的系统事实绝对一致
 */

import type {
  DataFlowNode,
  DataFlowEdge,
  SourceNodeConfig,
  SqlTransformNodeConfig,
  JoinNodeConfig,
  AggregateNodeConfig,
  ResultNodeConfig,
  ExportNodeConfig,
} from './workflowTypes';

export interface TopologicalSortResult {
  order: string[];
  hasCycle: boolean;
  unvisited: string[];
}

/**
 * 使用 Kahn 算法进行 DAG 拓扑排序
 */
export function sortWorkflowTopologically(
  nodes: DataFlowNode[],
  edges: DataFlowEdge[]
): TopologicalSortResult {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  nodes.forEach(n => {
    inDegree.set(n.id, 0);
    adjacency.set(n.id, []);
  });

  edges.forEach(e => {
    if (nodeMap.has(e.source) && nodeMap.has(e.target) && e.source !== e.target) {
      adjacency.get(e.source)!.push(e.target);
      inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
    }
  });

  const queue: string[] = nodes
    .filter(n => (inDegree.get(n.id) || 0) === 0)
    .map(n => n.id);

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
  const unvisited = nodes.map(n => n.id).filter(id => !order.includes(id));

  return { order, hasCycle, unvisited };
}

/**
 * 获取节点对应的临时 DuckDB View 名称
 */
export function getNodeViewName(nodeId: string): string {
  const safeId = nodeId.replace(/[^a-zA-Z0-9_]/g, '_');
  return `_df_view_${safeId}`;
}

export interface NodeInputs {
  primary?: string; // 上游输出 View / Table
  left?: string;
  right?: string;
  all: string[];
}

/**
 * 解析节点的上游输入依赖
 */
export function resolveNodeInputs(
  nodeId: string,
  edges: DataFlowEdge[],
  nodes: DataFlowNode[]
): NodeInputs {
  const incomingEdges = edges.filter(e => e.target === nodeId);
  const inputs: NodeInputs = { all: [] };

  for (const edge of incomingEdges) {
    const sourceNode = nodes.find(n => n.id === edge.source);
    if (!sourceNode) continue;
    const viewName = getNodeViewName(sourceNode.id);
    inputs.all.push(viewName);

    if (
      edge.targetHandle === 'left' ||
      edge.targetHandle === 'left-in' ||
      edge.data?.joinSide === 'left'
    ) {
      inputs.left = viewName;
    } else if (
      edge.targetHandle === 'right' ||
      edge.targetHandle === 'right-in' ||
      edge.data?.joinSide === 'right'
    ) {
      inputs.right = viewName;
    } else if (!inputs.primary) {
      inputs.primary = viewName;
    }
  }

  // Fallback if handles weren't strictly named
  if (!inputs.primary && inputs.all.length > 0) {
    inputs.primary = inputs.all[0];
  }
  if (!inputs.left && inputs.all.length > 0) {
    inputs.left = inputs.all[0];
  }
  if (!inputs.right && inputs.all.length > 1) {
    inputs.right = inputs.all[1];
  }

  return inputs;
}

/**
 * 核心 SQL 编译器：为指定节点生成标准可执行 SQL
 */
export function compileNodeSql(
  node: DataFlowNode,
  inputs: NodeInputs
): { sql: string; error?: string } {
  const config = node.data.config;

  switch (node.data.type) {
    case 'source': {
      const src = config as SourceNodeConfig;
      if (src.tableName) {
        return { sql: `SELECT * FROM "${src.tableName}"` };
      }
      if (src.filePath) {
        if (src.fileType === 'parquet' || src.filePath.endsWith('.parquet')) {
          return { sql: `SELECT * FROM read_parquet('${src.filePath}')` };
        }
        if (src.fileType === 'csv' || src.filePath.endsWith('.csv')) {
          return { sql: `SELECT * FROM read_csv_auto('${src.filePath}')` };
        }
        if (src.fileType === 'json' || src.filePath.endsWith('.json')) {
          return { sql: `SELECT * FROM read_json_auto('${src.filePath}')` };
        }
      }
      return {
        sql: `SELECT * FROM (VALUES ('No source specified')) AS t(info)`,
        error: '未指定数据源文件或表',
      };
    }

    case 'schema': {
      const upstream = inputs.primary;
      if (!upstream) {
        return { sql: '', error: '缺少上游数据输入' };
      }
      return { sql: `SELECT * FROM "${upstream}"` };
    }

    case 'sql_transform': {
      const upstream = inputs.primary;
      const sqlCfg = config as SqlTransformNodeConfig;
      let rawSql = (sqlCfg?.sql || '').trim();

      if (!upstream) {
        // If there's no upstream but rawSql is provided and valid (e.g. self-contained SELECT), use it!
        if (rawSql && /SELECT\b/i.test(rawSql)) {
          return { sql: rawSql };
        }
        return { sql: '', error: '缺少上游数据输入' };
      }

      if (!rawSql) {
        return { sql: `SELECT * FROM "${upstream}"` };
      }

      // 支持宏模板变量 {{input}} 与多输入 {{input1}}, {{input2}}...
      if (rawSql.includes('{{input}}')) {
        rawSql = rawSql.replace(/\{\{input\}\}/g, `"${upstream}"`);
      }
      if (inputs.all && inputs.all.length > 0) {
        inputs.all.forEach((inp, idx) => {
          rawSql = rawSql.replace(new RegExp(`\\{\\{input${idx + 1}\\}\\}`, 'g'), `"${inp}"`);
        });
      } else if (!/FROM\s+/i.test(rawSql)) {
        rawSql = `SELECT ${rawSql} FROM "${upstream}"`;
      }
      return { sql: rawSql };
    }

    case 'join': {
      const joinCfg = config as JoinNodeConfig;
      const leftRel = inputs.left;
      const rightRel = inputs.right;

      if (!leftRel || !rightRel) {
        return { sql: '', error: '表连接需要左右两个上游数据输入' };
      }

      const joinType = joinCfg.joinType || 'INNER';
      const conditions = joinCfg.conditions || [];

      let onClause = '';
      if (conditions.length > 0) {
        onClause = conditions
          .filter(c => c.leftColumn && c.rightColumn)
          .map(c => `l."${c.leftColumn}" = r."${c.rightColumn}"`)
          .join(' AND ');
      }

      if (!onClause) {
        onClause = '1 = 1';
      }

      // 仅排除右表中已在连接键中且左右同名的字段，杜绝写死特定业务字段名
      const rightJoinKeys = conditions
        .filter(c => c.leftColumn === c.rightColumn && c.rightColumn)
        .map(c => c.rightColumn);
      const uniqueExcluded = Array.from(new Set(rightJoinKeys));
      const excludeClause = uniqueExcluded.length > 0
        ? `EXCLUDE (${uniqueExcluded.map(c => `"${c}"`).join(', ')})`
        : '';

      const sql = [
        `SELECT`,
        `  l.*,`,
        excludeClause ? `  r.* ${excludeClause}` : `  r.*`,
        `FROM "${leftRel}" AS l`,
        `${joinType} JOIN "${rightRel}" AS r`,
        `  ON ${onClause}`,
      ].filter(Boolean).join('\n');

      return { sql };
    }

    case 'aggregate': {
      const aggCfg = config as AggregateNodeConfig;
      const upstream = inputs.primary;

      // 若节点带有原始 SQL 且未通过可视化界面修改配置，优先保留原始查询逻辑（如窗口函数、CASE表达式等）
      if (aggCfg.rawSql && aggCfg.rawSql.trim()) {
        let rawSql = aggCfg.rawSql.trim();
        if (upstream && rawSql.includes('{{input}}')) {
          rawSql = rawSql.replace(/\{\{input\}\}/g, `"${upstream}"`);
        }
        return { sql: rawSql };
      }

      if (!upstream) {
        return { sql: '', error: '聚合节点需要上游数据输入' };
      }

      const groupBy = aggCfg.groupBy || [];
      const aggregations = aggCfg.aggregations || [];
      const filter = (aggCfg.filter || '').trim();

      const selectParts: string[] = [];

      // Group By columns
      for (const col of groupBy) {
        selectParts.push(`  "${col}"`);
      }

      // Aggregations
      for (const agg of aggregations) {
        if (!agg.column || !agg.alias) continue;
        const colRef = agg.column === '*' ? '*' : `"${agg.column}"`;
        let expr = '';
        if (agg.func === 'COUNT(DISTINCT)') {
          expr = `COUNT(DISTINCT ${colRef})`;
        } else {
          expr = `${agg.func}(${colRef})`;
        }
        selectParts.push(`  ${expr} AS "${agg.alias}"`);
      }

      if (selectParts.length === 0) {
        selectParts.push('  *');
      }

      const lines: string[] = [
        `SELECT`,
        selectParts.join(',\n'),
        `FROM "${upstream}"`,
      ];

      if (filter) {
        lines.push(`WHERE ${filter}`);
      }

      if (groupBy.length > 0) {
        lines.push(`GROUP BY ${groupBy.map(c => `"${c}"`).join(', ')}`);
      }

      return { sql: lines.join('\n') };
    }

    case 'result': {
      const upstream = inputs.primary;
      const resCfg = config as ResultNodeConfig;
      const limit = resCfg.limit || 1000;

      // 如果有主查询完整 SQL，优先运行主查询
      if (resCfg.sql && resCfg.sql.trim() && /SELECT\b/i.test(resCfg.sql)) {
        let raw = resCfg.sql.trim();
        if (upstream && raw.includes('{{input}}')) {
          raw = raw.replace(/\{\{input\}\}/g, `"${upstream}"`);
        }
        if (!/LIMIT\s+\d+/i.test(raw)) {
          raw = `${raw} LIMIT ${limit}`;
        }
        return { sql: raw };
      }

      if (!upstream) {
        return { sql: '', error: '结果表需要上游数据输入' };
      }
      return { sql: `SELECT * FROM "${upstream}" LIMIT ${limit}` };
    }

    case 'export': {
      const upstream = inputs.primary;
      if (!upstream) {
        return { sql: '', error: '导出节点需要上游数据输入' };
      }
      return { sql: `SELECT * FROM "${upstream}"` };
    }

    default:
      return { sql: '', error: '未知节点类型' };
  }
}
