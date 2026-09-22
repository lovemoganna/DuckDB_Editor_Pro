/**
 * SQL to Workflow Parser & DAG Generator
 *
 * 核心功能：
 * 1. 深度解析 SQL 工作台编写的任意 SQL（含 CTE、JOIN、GROUP BY、CREATE VIEW/TABLE 等）
 * 2. 自动构建对应的 React Flow DAG 节点（DataFlowNode）与依赖连线（DataFlowEdge）
 * 3. 提取全库血缘（DuckDB 真实 Table 与 View 关联关系）
 * 4. 自动计算层级拓扑布局（Level-based Hierarchical Layout），杜绝节点重叠
 * 5. 将工作流逆向编译为标准完整 SQL 查询（反哺 SQL 工作台）
 */

import type {
  DataFlowNode,
  DataFlowEdge,
  WorkflowNodeType,
  SourceNodeConfig,
  SqlTransformNodeConfig,
  JoinNodeConfig,
  AggregateNodeConfig,
  ResultNodeConfig,
} from './workflowTypes';

export interface ParsedCte {
  name: string;
  query: string;
  sourceTables: string[];
  startLine?: number;
  endLine?: number;
}

/**
 * 规范化标识符（移除双引号、反引号及首尾空格）
 */
export function cleanIdentifier(name: string): string {
  return name.trim().replace(/^["`]|["`]$/g, '');
}

/**
 * 格式化产出节点的友好展示名称（剔除 .sql / _dag.sql 等内部文件后缀）
 */
export function formatResultNodeTitle(tabTitle?: string): string {
  if (!tabTitle) return '查询输出';
  const cleaned = tabTitle.replace(/(\.sql|_dag|\.parquet|\.csv)+$/gi, '').trim();
  return cleaned || '查询输出';
}

/**
 * 剥离 SQL 语句开头的注释与空白字符（支持 -- 单行注释和 /* 多行注释）
 */
export function stripLeadingComments(sql: string): string {
  let s = sql.trim();
  let changed = true;
  while (changed && s.length > 0) {
    changed = false;
    s = s.trim();
    if (s.startsWith('--')) {
      const newlineIdx = s.indexOf('\n');
      s = newlineIdx !== -1 ? s.slice(newlineIdx + 1) : '';
      changed = true;
    } else if (s.startsWith('/*')) {
      const endCommentIdx = s.indexOf('*/');
      s = endCommentIdx !== -1 ? s.slice(endCommentIdx + 2) : '';
      changed = true;
    }
  }
  return s.trim();
}

/**
 * 按分号拆分多条 SQL 语句（正确跳过字符串、单行注释、多行注释中的分号）
 */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const nextChar = i + 1 < sql.length ? sql[i + 1] : '';

    if (inLineComment) {
      current += char;
      if (char === '\n') {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      current += char;
      if (char === '*' && nextChar === '/') {
        current += '/';
        i++;
        inBlockComment = false;
      }
      continue;
    }

    if (inSingleQuote) {
      current += char;
      if (char === "'") {
        if (nextChar === "'") {
          current += "'";
          i++; // Escaped quote
        } else {
          inSingleQuote = false;
        }
      }
      continue;
    }

    if (inDoubleQuote) {
      current += char;
      if (char === '"') {
        if (nextChar === '"') {
          current += '"';
          i++;
        } else {
          inDoubleQuote = false;
        }
      }
      continue;
    }

    // Check for comment starts
    if (char === '-' && nextChar === '-') {
      inLineComment = true;
      current += '--';
      i++;
      continue;
    }
    if (char === '/' && nextChar === '*') {
      inBlockComment = true;
      current += '/*';
      i++;
      continue;
    }

    if (char === "'") {
      inSingleQuote = true;
      current += char;
      continue;
    }

    if (char === '"') {
      inDoubleQuote = true;
      current += char;
      continue;
    }

    if (char === ';') {
      const trimmed = current.trim();
      if (trimmed) {
        statements.push(trimmed);
      }
      current = '';
      continue;
    }

    current += char;
  }

  const finalTrimmed = current.trim();
  if (finalTrimmed) {
    statements.push(finalTrimmed);
  }

  return statements;
}

/**
 * 括号匹配提取 CTE 定义
 * 格式形如：WITH [RECURSIVE] cte1 AS (...), cte2 AS (...) SELECT ...
 * 严格处理注释 (-- and /* *\/) 与字符串字面量中的括号与引号
 */
export function extractCteDefinitions(sql: string): {
  ctes: ParsedCte[];
  mainQuery: string;
} {
  const stripped = stripLeadingComments(sql);
  const withMatch = stripped.match(/^\s*WITH\s+(?:RECURSIVE\s+)?/i);
  if (!withMatch) {
    return { ctes: [], mainQuery: sql.trim() };
  }

  let index = withMatch[0].length;
  const trimmed = stripped;
  const ctes: ParsedCte[] = [];
  const offsetInOriginal = Math.max(0, sql.indexOf(trimmed));

  while (index < trimmed.length) {
    // 匹配 CTE 名字与 AS (
    const remainder = trimmed.slice(index);
    const cteHeadMatch = remainder.match(/^\s*(?:"([^"]+)"|([a-zA-Z_][\w$]*))\s*(?:\([^)]*\))?\s*AS\s*\(/i);
    if (!cteHeadMatch) {
      // 没有更多 CTE 了，剩下的就是主查询
      break;
    }

    const cteName = cleanIdentifier(cteHeadMatch[1] || cteHeadMatch[2]);
    const cteHeadStart = index + (remainder.length - remainder.trimStart().length);
    index += cteHeadMatch[0].length; // 指向开括号后的内容

    // 健壮的状态机括号匹配寻找该 CTE 的闭合右括号
    let parenDepth = 1;
    const queryStart = index;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inLineComment = false;
    let inBlockComment = false;

    while (index < trimmed.length && parenDepth > 0) {
      const c = trimmed[index];
      const next = index + 1 < trimmed.length ? trimmed[index + 1] : '';

      if (inLineComment) {
        if (c === '\n') {
          inLineComment = false;
        }
        index++;
        continue;
      }

      if (inBlockComment) {
        if (c === '*' && next === '/') {
          inBlockComment = false;
          index += 2;
          continue;
        }
        index++;
        continue;
      }

      if (inSingleQuote) {
        if (c === "'") {
          if (next === "'") {
            // 转义单引号 ''
            index += 2;
            continue;
          }
          inSingleQuote = false;
        }
        index++;
        continue;
      }

      if (inDoubleQuote) {
        if (c === '"') {
          if (next === '"') {
            index += 2;
            continue;
          }
          inDoubleQuote = false;
        }
        index++;
        continue;
      }

      // 检查注释开始
      if (c === '-' && next === '-') {
        inLineComment = true;
        index += 2;
        continue;
      }
      if (c === '/' && next === '*') {
        inBlockComment = true;
        index += 2;
        continue;
      }

      // 检查引号开始
      if (c === "'") {
        inSingleQuote = true;
        index++;
        continue;
      }
      if (c === '"') {
        inDoubleQuote = true;
        index++;
        continue;
      }

      if (c === '(') {
        parenDepth++;
      } else if (c === ')') {
        parenDepth--;
      }

      index++;
    }

    const cteQuery = trimmed.slice(queryStart, index - 1).trim();
    const sourceTables = extractTableReferences(cteQuery);

    const startLine = sql.slice(0, offsetInOriginal + cteHeadStart).split('\n').length;
    const endLine = sql.slice(0, offsetInOriginal + index).split('\n').length;

    ctes.push({
      name: cteName,
      query: cteQuery,
      sourceTables,
      startLine,
      endLine,
    });

    // 跳过空白字符并检查下一个字符是否为逗号
    const afterQuery = trimmed.slice(index);
    const commaMatch = afterQuery.match(/^\s*,/);
    if (commaMatch) {
      index += commaMatch[0].length;
    } else {
      // 结束 CTE 列表，进入主查询
      break;
    }
  }

  const mainQuery = trimmed.slice(index).trim();
  return { ctes, mainQuery };
}

/**
 * 双向 AST / CTE 精准回写引擎：
 * 将指定 CTE 或主查询的 SQL 逻辑更新并写回原始完整 SQL 中，保留其余 CTE 及周围格式排版
 */
export function updateSqlCteDefinition(
  originalSql: string,
  targetName: string,
  newQuery: string
): string {
  const cleanTarget = cleanIdentifier(targetName).toLowerCase();
  const cleanNewQuery = newQuery.trim().replace(/;\s*$/, '');
  const stripped = stripLeadingComments(originalSql);
  const withMatch = stripped.match(/^\s*WITH\s+(?:RECURSIVE\s+)?/i);

  // 若原始 SQL 不是 WITH 查询，且目标为主查询或唯一节点，直接替换整句
  if (!withMatch) {
    return cleanNewQuery ? `${cleanNewQuery};` : originalSql;
  }

  const offsetInOriginal = Math.max(0, originalSql.indexOf(stripped));
  let index = withMatch[0].length;
  const trimmed = stripped;

  while (index < trimmed.length) {
    const remainder = trimmed.slice(index);
    // 跳过 CTE 名称前的行注释或块注释
    const commentSkip = remainder.replace(/^(\s*(--[^\n]*\n|\/\*[\s\S]*?\*\/)\s*)+/, '');
    const commentSkipLen = remainder.length - commentSkip.length;
    const cteHeadMatch = commentSkip.match(/^\s*(?:"([^"]+)"|([a-zA-Z_][\w$]*))\s*(?:\([^)]*\))?\s*AS\s*\(/i);
    if (!cteHeadMatch) {
      break;
    }

    const cteName = cleanIdentifier(cteHeadMatch[1] || cteHeadMatch[2]);
    index += commentSkipLen + cteHeadMatch[0].length; // 跳过注释 + CTE 头，指向开括号后

    let parenDepth = 1;
    const queryStart = index;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inLineComment = false;
    let inBlockComment = false;

    while (index < trimmed.length && parenDepth > 0) {
      const c = trimmed[index];
      const next = index + 1 < trimmed.length ? trimmed[index + 1] : '';

      if (inLineComment) {
        if (c === '\n') inLineComment = false;
        index++;
        continue;
      }
      if (inBlockComment) {
        if (c === '*' && next === '/') {
          inBlockComment = false;
          index += 2;
          continue;
        }
        index++;
        continue;
      }
      if (inSingleQuote) {
        if (c === "'") {
          if (next === "'") { index += 2; continue; }
          inSingleQuote = false;
        }
        index++;
        continue;
      }
      if (inDoubleQuote) {
        if (c === '"') {
          if (next === '"') { index += 2; continue; }
          inDoubleQuote = false;
        }
        index++;
        continue;
      }
      if (c === '-' && next === '-') {
        inLineComment = true;
        index += 2;
        continue;
      }
      if (c === '/' && next === '*') {
        inBlockComment = true;
        index += 2;
        continue;
      }
      if (c === "'") { inSingleQuote = true; index++; continue; }
      if (c === '"') { inDoubleQuote = true; index++; continue; }

      if (c === '(') parenDepth++;
      else if (c === ')') parenDepth--;

      index++;
    }

    const queryEnd = index - 1;

    if (cteName.toLowerCase() === cleanTarget) {
      const formatted = '\n    ' + cleanNewQuery.replace(/\n/g, '\n    ') + '\n  ';
      const before = originalSql.slice(0, offsetInOriginal + queryStart);
      const after = originalSql.slice(offsetInOriginal + queryEnd);
      return before + formatted + after;
    }

    const afterQuery = trimmed.slice(index);
    const commaMatch = afterQuery.match(/^\s*,/);
    if (commaMatch) {
      index += commaMatch[0].length;
    } else {
      break;
    }
  }

  // 如果目标是主查询
  if (
    cleanTarget === 'main_query' ||
    cleanTarget === 'node_final_result' ||
    cleanTarget === 'final_result' ||
    cleanTarget.includes('query')
  ) {
    const before = originalSql.slice(0, offsetInOriginal + index);
    return before.trimEnd() + '\n' + cleanNewQuery + ';';
  }

  return originalSql;
}


/**
 * 将子句按未在括号内的逗号拆分（例如 FROM t1, t2, read_csv(...)）
 */
function splitByTopLevelCommas(clause: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let inQuote = false;

  for (let i = 0; i < clause.length; i++) {
    const ch = clause[i];
    if (ch === "'" || ch === '"') {
      inQuote = !inQuote;
      current += ch;
    } else if (!inQuote && ch === '(') {
      depth++;
      current += ch;
    } else if (!inQuote && ch === ')') {
      depth = Math.max(0, depth - 1);
      current += ch;
    } else if (!inQuote && depth === 0 && ch === ',') {
      const trimmed = current.trim();
      if (trimmed) parts.push(trimmed);
      current = '';
    } else {
      current += ch;
    }
  }

  const finalTrimmed = current.trim();
  if (finalTrimmed) parts.push(finalTrimmed);
  return parts;
}

const SQL_RESERVED_TABLE_EXCLUDES = new Set([
  'select', 'values', 'unnest', 'generate_series', 'lateral',
  'where', 'group', 'order', 'having', 'limit', 'join', 'as',
  'left', 'right', 'inner', 'outer', 'cross', 'full', 'on',
  'using', 'distinct', 'union', 'except', 'intersect', 'all'
]);

/**
 * 解析单条表引用或 DuckDB 表函数调用
 */
function extractSingleTableRef(item: string): string | null {
  const trimmed = item.trim();
  if (!trimmed) return null;

  // 1. DuckDB 文件读取表函数：read_parquet, read_csv, read_json 等
  const funcMatch = trimmed.match(/^(?:read_parquet|read_csv|read_csv_auto|read_json|read_json_auto|delta_scan)\s*\(\s*(\[[^\]]+\]|'[^']+'|"[^"]+")[^)]*\)/i);
  if (funcMatch) {
    const rawArg = funcMatch[1].trim();
    const firstArg = rawArg.replace(/^[\[\('"\]]+|[\]\'"\)]+$/g, '').split(',')[0].trim().replace(/^['"]|['"]$/g, '');
    return firstArg || null;
  }

  // 2. 移除尾部 alias，如 table AS t 或 table t
  const withoutAlias = trimmed.split(/\s+AS\s+|\s+/i)[0].trim();
  if (!withoutAlias) return null;

  // 移除 schema 前缀: db.schema.table -> table
  const parts = withoutAlias.split('.');
  const rawTbl = cleanIdentifier(parts[parts.length - 1]);

  if (!rawTbl || /^\d+$/.test(rawTbl)) return null;
  if (SQL_RESERVED_TABLE_EXCLUDES.has(rawTbl.toLowerCase())) return null;

  return rawTbl;
}

/**
 * 从 SQL 语句中提取引用的物理表名或 CTE 名
 */
export function extractTableReferences(sql: string, knownCtes: Set<string> = new Set()): string[] {
  const tables = new Set<string>();

  // 1. 匹配 FROM table1, table2...
  const fromPattern = /\bFROM\s+([\s\S]+?(?=\b(?:WHERE|GROUP|ORDER|HAVING|LIMIT|UNION|WINDOW|JOIN|INNER|LEFT|RIGHT|FULL|CROSS)\b|;|$))/gi;
  for (const fromMatch of sql.matchAll(fromPattern)) {
    const clause = fromMatch[1].trim();
    const parts = splitByTopLevelCommas(clause);
    for (const part of parts) {
      const parsed = extractSingleTableRef(part);
      if (parsed) tables.add(parsed);
    }
  }

  // 2. 匹配各种 JOIN 后的表
  const joinPattern = /\b(?:INNER|LEFT|RIGHT|FULL|CROSS)?\s*JOIN\s+([^\s;(),]+(?:\([^)]*\))?)/gi;
  for (const joinMatch of sql.matchAll(joinPattern)) {
    const raw = joinMatch[1];
    const parsed = extractSingleTableRef(raw);
    if (parsed) tables.add(parsed);
  }

  // 3. 匹配 INTO / UPDATE
  const dmlPattern = /\b(?:INTO|UPDATE)\s+([^\s;(),]+)/gi;
  for (const m of sql.matchAll(dmlPattern)) {
    const parsed = extractSingleTableRef(m[1]);
    if (parsed) tables.add(parsed);
  }

  // 4. 单独检索 DuckDB 文件读取表函数
  const funcPattern = /\b(read_parquet|read_csv|read_csv_auto|read_json|read_json_auto|delta_scan)\s*\(\s*(\[[^\]]+\]|'[^']+'|"[^"]+")[^)]*\)/gi;
  for (const fm of sql.matchAll(funcPattern)) {
    const arg = fm[2].trim();
    const cleanArg = arg.replace(/^[\[\('"\]]+|[\]\'"\)]+$/g, '').split(',')[0].trim().replace(/^['"]|['"]$/g, '');
    if (cleanArg) {
      tables.add(cleanArg);
    }
  }

  return Array.from(tables).filter(t => !knownCtes.has(t.toLowerCase()));
}

/**
 * 深度判断 SQL 片段对应的节点类型与核心配置
 */
export function detectNodeTypeAndConfig(sql: string, defaultTitle: string): {
  type: WorkflowNodeType;
  title: string;
  subtitle: string;
  config: any;
  predicate?: string;
  joinSummary?: string;
  groupBySummary?: string;
  sqlSnippet?: string;
} {
  const upper = sql.toUpperCase();

  // 提取通用 SQL 片段（前 3 行简短非空代码）
  const sqlSnippet = sql
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(' ');

  // 提取 WHERE 过滤条件
  const whereMatch = sql.match(/\bWHERE\s+([\s\S]+?)(?:\b(?:GROUP\s+BY|HAVING|ORDER\s+BY|LIMIT|WINDOW)\b|$)/i);
  const predicate = whereMatch ? whereMatch[1].replace(/\s+/g, ' ').trim() : undefined;

  // 1. 聚合检测: 含 GROUP BY 或 SUM/COUNT/AVG 等聚合函数
  if (upper.includes('GROUP BY') || /\b(?:SUM|COUNT|AVG|MIN|MAX)\s*\(/i.test(sql)) {
    // 提取 GROUP BY 字段
    const groupMatch = sql.match(/GROUP\s+BY\s+([^;\n]+)/i);
    const groupByCols: string[] = [];
    if (groupMatch && groupMatch[1]) {
      groupMatch[1].split(',').forEach(col => {
        const cleaned = cleanIdentifier(col.trim().split(/\s+/)[0]);
        if (cleaned && !['asc', 'desc', 'having', 'order', 'limit'].includes(cleaned.toLowerCase())) {
          groupByCols.push(cleaned);
        }
      });
    }

    // 提取聚合指标
    const aggregations: any[] = [];
    const aggMatches = sql.matchAll(/\b(SUM|COUNT|AVG|MIN|MAX)\s*\(\s*(?:DISTINCT\s+)?([^)]+)\)\s*(?:AS\s+["`]?([a-zA-Z_][\w$]*)["`]?)?/gi);
    for (const m of aggMatches) {
      const func = m[1].toUpperCase();
      const col = cleanIdentifier(m[2]);
      const alias = m[3] ? cleanIdentifier(m[3]) : `${func.toLowerCase()}_${col.replace(/[^a-zA-Z0-9_]/g, '_')}`;
      aggregations.push({
        id: `agg_${Math.random().toString(36).substring(2, 7)}`,
        func,
        column: col === '*' ? '*' : col,
        alias,
      });
    }

    const groupBySummary = groupByCols.length > 0 ? `GROUP BY ${groupByCols.join(', ')}` : undefined;

    return {
      type: 'aggregate',
      title: defaultTitle,
      subtitle: groupByCols.length > 0 ? `按 ${groupByCols.slice(0, 3).join(', ')} 聚合` : '指标聚合汇总',
      predicate,
      groupBySummary,
      sqlSnippet,
      config: {
        nodeName: defaultTitle,
        groupBy: groupByCols,
        aggregations: aggregations.length > 0 ? aggregations : [
          { id: 'a1', alias: 'count_all', func: 'COUNT', column: '*' }
        ],
        filter: predicate || '',
        sql,
        rawSql: sql,
      } as AggregateNodeConfig,
    };
  }

  // 2. 表连接检测: 含 JOIN
  if (/\b(?:INNER|LEFT|RIGHT|FULL|CROSS)?\s*JOIN\b/i.test(sql)) {
    const joinMatch = sql.match(/\b(INNER|LEFT|RIGHT|FULL)?\s*JOIN\s+(?:["`]?([\w$]+)["`]?)\s+(?:AS\s+[\w$]+\s+)?ON\s+([\s\S]+?)(?:\b(?:WHERE|GROUP|ORDER|LIMIT)\b|$)/i);
    const joinType = (joinMatch?.[1]?.toUpperCase() || 'INNER') as 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
    const onClause = joinMatch?.[3]?.trim() || '';

    const conditions = onClause.split(/\s+AND\s+/i).map((cond, idx) => {
      const parts = cond.split('=').map(s => s.trim());
      return {
        id: `c_${idx + 1}`,
        leftColumn: cleanIdentifier(parts[0] || ''),
        rightColumn: cleanIdentifier(parts[1] || ''),
      };
    });

    const joinSummary = conditions.length > 0
      ? `${joinType} JOIN ON ${conditions.map(c => `${c.leftColumn}=${c.rightColumn}`).join(' AND ')}`
      : `${joinType} JOIN`;

    return {
      type: 'join',
      title: defaultTitle,
      subtitle: `${joinType} JOIN 表连接`,
      predicate,
      joinSummary,
      sqlSnippet,
      config: {
        joinType,
        conditions: conditions.length > 0 ? conditions : [
          { id: 'c_1', leftColumn: 'id', rightColumn: 'id' }
        ],
        sql,
        rawSql: sql,
      } as JoinNodeConfig,
    };
  }

  // 3. 通用 SQL Transform
  return {
    type: 'sql_transform',
    title: defaultTitle,
    subtitle: defaultTitle.startsWith('v_') ? 'DuckDB 派生视图' : 'SQL 转换流水线',
    predicate,
    sqlSnippet,
    config: {
      sql,
      rawSql: sql,
      description: `执行 ${defaultTitle}`,
    } as SqlTransformNodeConfig,
  };
}

/**
 * 计算自动拓扑分层布局 (Level-based Layout)
 * 使得源节点在左边，中间转换在中间，最终结果在最右侧，各层节点垂直居中且不重叠
 */
export function calculateDagLayout(
  nodes: DataFlowNode[],
  edges: DataFlowEdge[],
  existingNodes?: DataFlowNode[]
): DataFlowNode[] {
  if (nodes.length === 0) return [];

  // 坐标继承字典（防打字闪烁跳动）
  const existingPosById = new Map<string, { x: number; y: number }>();
  const existingPosByTitle = new Map<string, { x: number; y: number }>();
  if (existingNodes && existingNodes.length > 0) {
    existingNodes.forEach(en => {
      if (en.position && (en.position.x !== 0 || en.position.y !== 0)) {
        existingPosById.set(en.id, en.position);
        if (en.data?.title) {
          existingPosByTitle.set(en.data.title, en.position);
        }
      }
    });
  }

  // 构建邻接表与入度表
  const inDegree = new Map<string, number>();
  const childrenMap = new Map<string, string[]>();

  nodes.forEach(n => {
    inDegree.set(n.id, 0);
    childrenMap.set(n.id, []);
  });

  edges.forEach(e => {
    if (inDegree.has(e.target)) {
      inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
    }
    if (childrenMap.has(e.source)) {
      childrenMap.get(e.source)!.push(e.target);
    }
  });

  // 计算每个节点的最长路径深度（Rank/Level）
  const levelMap = new Map<string, number>();

  // 初始入度为 0 的节点放在 Level 0
  const queue: string[] = nodes
    .filter(n => (inDegree.get(n.id) || 0) === 0)
    .map(n => n.id);

  queue.forEach(id => levelMap.set(id, 0));

  // BFS / 拓扑序推导最长路径
  const visitedCount = new Map<string, number>();
  const workQueue = [...queue];

  while (workQueue.length > 0) {
    const currId = workQueue.shift()!;
    const currLevel = levelMap.get(currId) || 0;
    const children = childrenMap.get(currId) || [];

    for (const childId of children) {
      const nextLevel = Math.max(levelMap.get(childId) || 0, currLevel + 1);
      levelMap.set(childId, nextLevel);

      const count = (visitedCount.get(childId) || 0) + 1;
      visitedCount.set(childId, count);

      if (count <= 10) { // 避免环路死循环
        workQueue.push(childId);
      }
    }
  }

  // 将节点按 level 分组
  const nodesByLevel = new Map<number, DataFlowNode[]>();
  nodes.forEach(node => {
    const lvl = levelMap.get(node.id) || 0;
    const list = nodesByLevel.get(lvl) || [];
    list.push(node);
    nodesByLevel.set(lvl, list);
  });

  // 节点宽 208；层间距留足标签与折线缓冲，避免短边被徽章遮挡
  const LEVEL_SPACING_X = 340;
  const NODE_SPACING_Y = 110;
  const START_X = 48;
  const START_Y = 64;

  // 重新赋值 position，优先复用未改动节点的原有坐标 (Reconciliation)
  return nodes.map(node => {
    if (existingPosById.has(node.id)) {
      return { ...node, position: existingPosById.get(node.id)! };
    }
    if (node.data?.title && existingPosByTitle.has(node.data.title)) {
      return { ...node, position: existingPosByTitle.get(node.data.title)! };
    }

    const lvl = levelMap.get(node.id) || 0;
    const sameLevelNodes = nodesByLevel.get(lvl) || [node];
    const indexInLevel = sameLevelNodes.findIndex(n => n.id === node.id);

    const x = START_X + lvl * LEVEL_SPACING_X;
    const y = START_Y + indexInLevel * NODE_SPACING_Y;

    return {
      ...node,
      position: { x, y },
    };
  });
}

/**
 * 核心解析器：将 SQL 工作台语句解析为动态 DataFlow 画布节点与连线
 */
export function parseSqlToWorkflow(
  sql: string,
  options?: { tabTitle?: string; existingNodes?: DataFlowNode[] }
): { nodes: DataFlowNode[]; edges: DataFlowEdge[] } {
  const cleanSql = sql.trim();
  if (!cleanSql) {
    return { nodes: [], edges: [] };
  }

  const statements = splitSqlStatements(cleanSql);
  const firstStripped = statements.length > 0 ? stripLeadingComments(statements[0]) : '';

  // ── 情况 1: 单条语句且包含 WITH CTE ──
  if (statements.length === 1 && /^\s*WITH\b/i.test(firstStripped)) {
    const { ctes, mainQuery } = extractCteDefinitions(statements[0]);
    if (ctes.length > 0) {
      return buildWorkflowFromCtes(ctes, mainQuery, options?.tabTitle, options?.existingNodes);
    }
  }

  // ── 情况 2: 多条 DDL / DML 语句 (如 CREATE TABLE / VIEW 等) ──
  if (statements.length > 1) {
    return buildWorkflowFromMultiStatements(statements, options?.tabTitle, options?.existingNodes);
  }

  // ── 情况 3: CREATE TABLE AS / CREATE VIEW AS 单条语句 ──
  const ctasMatch = firstStripped.match(/^\s*CREATE\s+(?:OR\s+REPLACE\s+)?(?:TEMP\s+|TEMPORARY\s+)?(TABLE|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"([^"]+)"|([a-zA-Z_][\w$]*))\s+AS\s+([\s\S]+)$/i);
  if (ctasMatch) {
    const objType = ctasMatch[1].toUpperCase();
    const objName = cleanIdentifier(ctasMatch[2] || ctasMatch[3]);
    const innerSql = ctasMatch[4].trim();

    // 递归解析内层 query（若有 CTE）
    const innerRes = parseSqlToWorkflow(innerSql, { tabTitle: objName, existingNodes: options?.existingNodes });
    // 将最后的输出节点命名为创建的表/视图
    if (innerRes.nodes.length > 0) {
      const lastNode = innerRes.nodes[innerRes.nodes.length - 1];
      lastNode.data.title = objName;
      lastNode.data.subtitle = objType === 'VIEW' ? `DuckDB 视图 · ${objName}` : `DuckDB 表 · ${objName}`;
      return innerRes;
    }
  }

  // ── 情况 4: 普通单条 SELECT 查询 ──
  return buildWorkflowFromSingleSelect(cleanSql, options?.tabTitle, options?.existingNodes);
}

/**
 * 基于 CTE 列表与主查询构建 DAG
 */
function buildWorkflowFromCtes(
  ctes: ParsedCte[],
  mainQuery: string,
  tabTitle?: string,
  existingNodes?: DataFlowNode[]
): { nodes: DataFlowNode[]; edges: DataFlowEdge[] } {
  const nodes: DataFlowNode[] = [];
  const edges: DataFlowEdge[] = [];
  const cteNames = new Set(ctes.map(c => c.name));
  const addedPhysicalTables = new Set<string>();

  // 1. 查找所有 CTE 和主查询中引用的真实底层物理表
  const allPhysicalTables: string[] = [];
  ctes.forEach(cte => {
    cte.sourceTables.forEach(t => {
      if (!cteNames.has(t) && !addedPhysicalTables.has(t)) {
        addedPhysicalTables.add(t);
        allPhysicalTables.push(t);
      }
    });
  });

  const mainQueryTables = extractTableReferences(mainQuery);
  mainQueryTables.forEach(t => {
    if (!cteNames.has(t) && !addedPhysicalTables.has(t)) {
      addedPhysicalTables.add(t);
      allPhysicalTables.push(t);
    }
  });

  // 2. 为每个物理表生成 Source 节点
  allPhysicalTables.forEach(tableName => {
    const isFile = tableName.endsWith('.parquet') || tableName.endsWith('.csv') || tableName.endsWith('.json');
    const sourceNode: DataFlowNode = {
      id: `node_src_${tableName.replace(/[^a-zA-Z0-9_]/g, '_')}`,
      type: 'dataFlowNode',
      position: { x: 0, y: 0 },
      data: {
        id: `node_src_${tableName.replace(/[^a-zA-Z0-9_]/g, '_')}`,
        type: 'source',
        title: tableName,
        subtitle: isFile ? '文件数据源' : 'DuckDB 物理表',
        format: isFile ? (tableName.split('.').pop()?.toUpperCase() || 'File') : 'Table',
        status: 'configured',
        config: {
          tableName: isFile ? undefined : tableName,
          filePath: isFile ? tableName : undefined,
          fileType: isFile ? (tableName.split('.').pop() as any) : 'table',
        } as SourceNodeConfig,
      },
    };
    nodes.push(sourceNode);
  });

  // 3. 为每个 CTE 创建相应处理节点
  ctes.forEach(cte => {
    const { type, title, subtitle, config, predicate, joinSummary, groupBySummary, sqlSnippet } = detectNodeTypeAndConfig(cte.query, cte.name);
    const cteNode: DataFlowNode = {
      id: `node_cte_${cte.name}`,
      type: 'dataFlowNode',
      position: { x: 0, y: 0 },
      data: {
        id: `node_cte_${cte.name}`,
        type,
        title,
        subtitle: `CTE: ${subtitle}`,
        status: 'configured',
        config,
        predicate,
        joinSummary,
        groupBySummary,
        sqlSnippet,
        sqlRange: {
          startLine: cte.startLine || 1,
          endLine: cte.endLine || 1,
          cteName: cte.name,
        },
      },
    };
    nodes.push(cteNode);

    // 建立上游连线
    cte.sourceTables.forEach(upstreamName => {
      let sourceId = '';
      if (cteNames.has(upstreamName)) {
        sourceId = `node_cte_${upstreamName}`;
      } else if (addedPhysicalTables.has(upstreamName)) {
        sourceId = `node_src_${upstreamName.replace(/[^a-zA-Z0-9_]/g, '_')}`;
      }

      if (sourceId) {
        const isJoin = type === 'join';
        const existingCount = edges.filter(e => e.target === cteNode.id).length;
        const joinSide = isJoin ? (existingCount === 0 ? 'left' as const : 'right' as const) : undefined;
        const targetHandle = isJoin ? joinSide! : 'input';

        let label = '';
        let condition = '';
        if (isJoin) {
          const joinCfg = config as JoinNodeConfig;
          label = `${joinCfg?.joinType || 'INNER'} JOIN (${joinSide === 'left' ? '左' : '右'})`;
          if (joinCfg?.conditions && joinCfg.conditions.length > 0) {
            condition = joinCfg.conditions.map(c => `${c.leftColumn}=${c.rightColumn}`).join(', ');
          }
        } else if (type === 'aggregate') {
          label = 'GROUP BY';
        } else {
          label = '数据流';
        }

        edges.push({
          id: `edge_${sourceId}_${cteNode.id}`,
          source: sourceId,
          sourceHandle: 'output',
          target: cteNode.id,
          targetHandle,
          type: 'dataFlowEdge',
          data: {
            sourceHandle: 'output',
            targetHandle,
            joinSide,
            label,
            condition,
            relationType: isJoin ? 'join' : type === 'aggregate' ? 'aggregate' : 'data',
          },
        });
      }
    });
  });

  // 4. 为主查询创建最终 Result 输出节点
  const finalTitle = formatResultNodeTitle(tabTitle);
  const finalInfo = detectNodeTypeAndConfig(mainQuery, finalTitle);
  const resultNode: DataFlowNode = {
    id: 'node_final_result',
    type: 'dataFlowNode',
    position: { x: 0, y: 0 },
    data: {
      id: 'node_final_result',
      type: 'result',
      title: finalTitle,
      subtitle: mainQueryTables.length > 0 ? `汇总 ${mainQueryTables.join(', ')}` : '最终执行结果',
      status: 'configured',
      predicate: finalInfo.predicate,
      joinSummary: finalInfo.joinSummary,
      groupBySummary: finalInfo.groupBySummary,
      sqlSnippet: finalInfo.sqlSnippet,
      config: {
        limit: 1000,
        sql: mainQuery,
      } as ResultNodeConfig,
      sqlRange: {
        startLine: ctes.length > 0 ? (ctes[ctes.length - 1].endLine || 1) + 1 : 1,
        endLine: ctes.length > 0 ? (ctes[ctes.length - 1].endLine || 1) + mainQuery.split('\n').length : mainQuery.split('\n').length,
        cteName: 'main_query',
      },
    },
  };
  nodes.push(resultNode);

  // 连线主查询与上游 CTE 或物理表
  mainQueryTables.forEach(upstreamName => {
    let sourceId = '';
    if (cteNames.has(upstreamName)) {
      sourceId = `node_cte_${upstreamName}`;
    } else if (addedPhysicalTables.has(upstreamName)) {
      sourceId = `node_src_${upstreamName.replace(/[^a-zA-Z0-9_]/g, '_')}`;
    }

    if (sourceId) {
      edges.push({
        id: `edge_${sourceId}_node_final_result`,
        source: sourceId,
        sourceHandle: 'output',
        target: 'node_final_result',
        targetHandle: 'input',
        type: 'dataFlowEdge',
        data: {
          sourceHandle: 'output',
          targetHandle: 'input',
          label: '最终输出',
          relationType: 'data',
        },
      });
    }
  });

  // 如果主查询没有明确来源，但存在 CTE，连接最后一个 CTE 到主查询
  if (edges.filter(e => e.target === 'node_final_result').length === 0 && ctes.length > 0) {
    const lastCte = ctes[ctes.length - 1];
    edges.push({
      id: `edge_node_cte_${lastCte.name}_node_final_result`,
      source: `node_cte_${lastCte.name}`,
      sourceHandle: 'output',
      target: 'node_final_result',
      targetHandle: 'input',
      type: 'dataFlowEdge',
      data: {
        sourceHandle: 'output',
        targetHandle: 'input',
        label: '最终输出',
        relationType: 'data',
      },
    });
  }

  const laidOutNodes = calculateDagLayout(nodes, edges, existingNodes);
  return { nodes: laidOutNodes, edges };
}

/**
 * 单条 SELECT 语句生成数据流
 */
function buildWorkflowFromSingleSelect(
  sql: string,
  tabTitle?: string,
  existingNodes?: DataFlowNode[]
): { nodes: DataFlowNode[]; edges: DataFlowEdge[] } {
  const nodes: DataFlowNode[] = [];
  const edges: DataFlowEdge[] = [];
  const referencedTables = extractTableReferences(sql);

  // 1. 如果没有表引用 (如 SELECT 1+1, version())
  if (referencedTables.length === 0) {
    const semInfo = detectNodeTypeAndConfig(sql, tabTitle || '计算表达式');
    const calcNode: DataFlowNode = {
      id: 'node_calc_result',
      type: 'dataFlowNode',
      position: { x: 100, y: 150 },
      data: {
        id: 'node_calc_result',
        type: 'sql_transform',
        title: tabTitle || '计算表达式',
        subtitle: '即席 DuckDB 执行',
        status: 'configured',
        predicate: semInfo.predicate,
        joinSummary: semInfo.joinSummary,
        groupBySummary: semInfo.groupBySummary,
        sqlSnippet: semInfo.sqlSnippet,
        config: { sql } as SqlTransformNodeConfig,
      },
    };
    return { nodes: [calcNode], edges: [] };
  }

  // 2. 创建源节点
  const sourceNodes: DataFlowNode[] = referencedTables.map((tbl, idx) => {
    const isFile = tbl.endsWith('.parquet') || tbl.endsWith('.csv') || tbl.endsWith('.json');
    return {
      id: `node_src_${idx}_${tbl.replace(/[^a-zA-Z0-9_]/g, '_')}`,
      type: 'dataFlowNode',
      position: { x: 0, y: 0 },
      data: {
        id: `node_src_${idx}_${tbl.replace(/[^a-zA-Z0-9_]/g, '_')}`,
        type: 'source',
        title: tbl,
        subtitle: isFile ? '文件源' : 'DuckDB 物理表',
        format: isFile ? (tbl.split('.').pop()?.toUpperCase() || 'File') : 'Table',
        status: 'configured',
        config: {
          tableName: isFile ? undefined : tbl,
          filePath: isFile ? tbl : undefined,
          fileType: isFile ? (tbl.split('.').pop() as any) : 'table',
        } as SourceNodeConfig,
      },
    };
  });
  nodes.push(...sourceNodes);

  // 3. 分析中间处理逻辑 (Join, Aggregate, Transform)
  const isJoin = /\b(?:INNER|LEFT|RIGHT|FULL|CROSS)?\s*JOIN\b/i.test(sql);
  const isAgg = /GROUP\s+BY/i.test(sql) || /\b(?:SUM|COUNT|AVG|MIN|MAX)\s*\(/i.test(sql);

  let currentTargetId = '';

  if (isJoin && sourceNodes.length >= 2) {
    const joinInfo = detectNodeTypeAndConfig(sql, '多表连接');
    const joinNode: DataFlowNode = {
      id: 'node_join_step',
      type: 'dataFlowNode',
      position: { x: 0, y: 0 },
      data: {
        id: 'node_join_step',
        type: 'join',
        title: '表连接',
        subtitle: `${(joinInfo.config as JoinNodeConfig).joinType} 关联`,
        status: 'configured',
        predicate: joinInfo.predicate,
        joinSummary: joinInfo.joinSummary,
        groupBySummary: joinInfo.groupBySummary,
        sqlSnippet: joinInfo.sqlSnippet,
        config: joinInfo.config,
      },
    };
    nodes.push(joinNode);

    // 连接前两张源表
    const joinCfg = joinInfo.config as JoinNodeConfig;
    const condStr = joinCfg?.conditions?.map(c => `${c.leftColumn}=${c.rightColumn}`).join(', ') || '';
    edges.push({
      id: `edge_${sourceNodes[0].id}_node_join_step`,
      source: sourceNodes[0].id,
      sourceHandle: 'output',
      target: 'node_join_step',
      targetHandle: 'left',
      type: 'dataFlowEdge',
      data: {
        sourceHandle: 'output',
        targetHandle: 'left',
        joinSide: 'left',
        label: `${joinCfg?.joinType || 'INNER'} JOIN (左)`,
        condition: condStr,
        relationType: 'join',
      },
    });
    edges.push({
      id: `edge_${sourceNodes[1].id}_node_join_step`,
      source: sourceNodes[1].id,
      sourceHandle: 'output',
      target: 'node_join_step',
      targetHandle: 'right',
      type: 'dataFlowEdge',
      data: {
        sourceHandle: 'output',
        targetHandle: 'right',
        joinSide: 'right',
        label: `${joinCfg?.joinType || 'INNER'} JOIN (右)`,
        condition: condStr,
        relationType: 'join',
      },
    });

    currentTargetId = 'node_join_step';
  } else {
    currentTargetId = sourceNodes[0].id;
  }

  // 聚合算子
  if (isAgg) {
    const aggInfo = detectNodeTypeAndConfig(sql, '聚合汇总');
    const aggNode: DataFlowNode = {
      id: 'node_agg_step',
      type: 'dataFlowNode',
      position: { x: 0, y: 0 },
      data: {
        id: 'node_agg_step',
        type: 'aggregate',
        title: '聚合统计',
        subtitle: aggInfo.subtitle,
        status: 'configured',
        predicate: aggInfo.predicate,
        joinSummary: aggInfo.joinSummary,
        groupBySummary: aggInfo.groupBySummary,
        sqlSnippet: aggInfo.sqlSnippet,
        config: aggInfo.config,
      },
    };
    nodes.push(aggNode);

    edges.push({
      id: `edge_${currentTargetId}_node_agg_step`,
      source: currentTargetId,
      sourceHandle: 'output',
      target: 'node_agg_step',
      targetHandle: 'input',
      type: 'dataFlowEdge',
      data: {
        sourceHandle: 'output',
        targetHandle: 'input',
        label: 'GROUP BY 聚合',
        relationType: 'aggregate',
      },
    });

    currentTargetId = 'node_agg_step';
  }

  // 最终结果节点
  const finalTitle = formatResultNodeTitle(tabTitle);
  const finalInfo = detectNodeTypeAndConfig(sql, finalTitle);
  const resultNode: DataFlowNode = {
    id: 'node_final_result',
    type: 'dataFlowNode',
    position: { x: 0, y: 0 },
    data: {
      id: 'node_final_result',
      type: 'result',
      title: finalTitle,
      subtitle: '最终数据集',
      status: 'configured',
      predicate: finalInfo.predicate,
      joinSummary: finalInfo.joinSummary,
      groupBySummary: finalInfo.groupBySummary,
      sqlSnippet: finalInfo.sqlSnippet,
      config: { limit: 1000, sql } as ResultNodeConfig,
    },
  };
  nodes.push(resultNode);

  edges.push({
    id: `edge_${currentTargetId}_node_final_result`,
    source: currentTargetId,
    sourceHandle: 'output',
    target: 'node_final_result',
    targetHandle: 'input',
    type: 'dataFlowEdge',
    data: {
      sourceHandle: 'output',
      targetHandle: 'input',
      label: '最终输出',
      relationType: 'data',
    },
  });

  const laidOutNodes = calculateDagLayout(nodes, edges, existingNodes);
  return { nodes: laidOutNodes, edges };
}

/**
 * 多段 SQL 语句解析 (DDL/DML Pipeline)
 */
function buildWorkflowFromMultiStatements(
  statements: string[],
  tabTitle?: string,
  existingNodes?: DataFlowNode[]
): { nodes: DataFlowNode[]; edges: DataFlowEdge[] } {
  const nodes: DataFlowNode[] = [];
  const edges: DataFlowEdge[] = [];
  const targetToNodeId = new Map<string, string>();

  statements.forEach((stmt, idx) => {
    const cleanStmt = stmt.trim();
    if (!cleanStmt) return;

    // 检测 CREATE TABLE / VIEW AS
    const match = cleanStmt.match(/^\s*CREATE\s+(?:OR\s+REPLACE\s+)?(?:TEMP\s+|TEMPORARY\s+)?(TABLE|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"([^"]+)"|([a-zA-Z_][\w$]*))\s+AS\s+([\s\S]+)$/i);
    if (match) {
      const type = match[1].toUpperCase();
      const targetName = cleanIdentifier(match[2] || match[3]);
      const bodySql = match[4].trim();

      const { type: nodeType, subtitle, config, predicate, joinSummary, groupBySummary, sqlSnippet } = detectNodeTypeAndConfig(bodySql, targetName);
      const nodeId = `node_stmt_${idx}_${targetName}`;

      const node: DataFlowNode = {
        id: nodeId,
        type: 'dataFlowNode',
        position: { x: 0, y: 0 },
        data: {
          id: nodeId,
          type: nodeType,
          title: targetName,
          subtitle: type === 'VIEW' ? `视图 (${subtitle})` : `数据表 (${subtitle})`,
          status: 'configured',
          predicate,
          joinSummary,
          groupBySummary,
          sqlSnippet,
          config,
        },
      };
      nodes.push(node);
      targetToNodeId.set(targetName.toLowerCase(), nodeId);

      // 提取其依赖的表
      const deps = extractTableReferences(bodySql);
      deps.forEach(dep => {
        const depLower = dep.toLowerCase();
        let depNodeId = targetToNodeId.get(depLower);
        if (!depNodeId) {
          // 创建未声明的外部物理表作为源节点
          depNodeId = `node_src_${dep.replace(/[^a-zA-Z0-9_]/g, '_')}`;
          if (!nodes.some(n => n.id === depNodeId)) {
            nodes.unshift({
              id: depNodeId,
              type: 'dataFlowNode',
              position: { x: 0, y: 0 },
              data: {
                id: depNodeId,
                type: 'source',
                title: dep,
                subtitle: 'DuckDB 物理表',
                format: 'Table',
                status: 'configured',
                config: { tableName: dep } as SourceNodeConfig,
              },
            });
          }
        }

        edges.push({
          id: `edge_${depNodeId}_${nodeId}`,
          source: depNodeId,
          sourceHandle: 'output',
          target: nodeId,
          targetHandle: 'input',
          type: 'dataFlowEdge',
          data: {
            sourceHandle: 'output',
            targetHandle: 'input',
            label: '表依赖',
            relationType: 'data',
          },
        });
      });
    } else {
      // 普通查询语句
      const nodeId = `node_stmt_${idx}`;
      const { type: nodeType, subtitle, config, predicate, joinSummary, groupBySummary, sqlSnippet } = detectNodeTypeAndConfig(cleanStmt, `语句 ${idx + 1}`);
      const node: DataFlowNode = {
        id: nodeId,
        type: 'dataFlowNode',
        position: { x: 0, y: 0 },
        data: {
          id: nodeId,
          type: nodeType === 'source' ? 'sql_transform' : nodeType,
          title: `步骤 ${idx + 1}`,
          subtitle,
          status: 'configured',
          predicate,
          joinSummary,
          groupBySummary,
          sqlSnippet,
          config,
        },
      };
      nodes.push(node);

      const deps = extractTableReferences(cleanStmt);
      deps.forEach(dep => {
        const depLower = dep.toLowerCase();
        const depNodeId = targetToNodeId.get(depLower);
        if (depNodeId) {
          edges.push({
            id: `edge_${depNodeId}_${nodeId}`,
            source: depNodeId,
            sourceHandle: 'output',
            target: nodeId,
            targetHandle: 'input',
            type: 'dataFlowEdge',
            data: {
              sourceHandle: 'output',
              targetHandle: 'input',
              label: '数据流',
              relationType: 'data',
            },
          });
        }
      });
    }
  });

  const laidOutNodes = calculateDagLayout(nodes, edges, existingNodes);
  return { nodes: laidOutNodes, edges };
}

/**
 * 从 DuckDB Catalog (真实 Tables 与 Views) 构建全库血缘 DAG
 */
export function parseCatalogToWorkflow(
  catalogItems: { name: string; isView: boolean; sql?: string }[]
): { nodes: DataFlowNode[]; edges: DataFlowEdge[] } {
  const nodes: DataFlowNode[] = [];
  const edges: DataFlowEdge[] = [];
  const nodeMap = new Map<string, string>();

  // 1. 创建所有表与视图节点
  catalogItems.forEach(item => {
    const nodeId = `node_cat_${item.name.replace(/[^a-zA-Z0-9_]/g, '_')}`;
    nodeMap.set(item.name.toLowerCase(), nodeId);

    if (item.isView && item.sql) {
      const { type, subtitle, config } = detectNodeTypeAndConfig(item.sql, item.name);
      nodes.push({
        id: nodeId,
        type: 'dataFlowNode',
        position: { x: 0, y: 0 },
        data: {
          id: nodeId,
          type,
          title: item.name,
          subtitle: `视图 · ${subtitle}`,
          format: 'View',
          status: 'configured',
          config,
        },
      });
    } else {
      nodes.push({
        id: nodeId,
        type: 'dataFlowNode',
        position: { x: 0, y: 0 },
        data: {
          id: nodeId,
          type: 'source',
          title: item.name,
          subtitle: 'DuckDB 物理表',
          format: 'Table',
          status: 'configured',
          config: { tableName: item.name } as SourceNodeConfig,
        },
      });
    }
  });

  // 2. 遍历视图建立血缘连线
  catalogItems.forEach(item => {
    if (item.isView && item.sql) {
      const targetNodeId = nodeMap.get(item.name.toLowerCase())!;
      const deps = extractTableReferences(item.sql);

      deps.forEach(depName => {
        const sourceNodeId = nodeMap.get(depName.toLowerCase());
        if (sourceNodeId && sourceNodeId !== targetNodeId) {
          edges.push({
            id: `edge_${sourceNodeId}_${targetNodeId}`,
            source: sourceNodeId,
            sourceHandle: 'output',
            target: targetNodeId,
            targetHandle: 'input',
            type: 'dataFlowEdge',
            data: {
              sourceHandle: 'output',
              targetHandle: 'input',
              label: '视图血缘',
              relationType: 'data',
            },
          });
        }
      });
    }
  });

  const laidOutNodes = calculateDagLayout(nodes, edges);
  return { nodes: laidOutNodes, edges };
}

/**
 * 将整幅画布的 DAG 逆向编译为一条标准的完整 SQL（带 CTE 流水线）
 */
export function compileWorkflowToFullSql(
  nodes: DataFlowNode[],
  edges: DataFlowEdge[]
): string {
  if (nodes.length === 0) return '-- 画布为空';

  // 仅有 1 个节点时
  if (nodes.length === 1) {
    const n = nodes[0];
    if (n.data.type === 'source' && n.data.config?.tableName) {
      return `SELECT * FROM "${n.data.config.tableName}";`;
    }
    if (n.data.config?.sql) {
      return n.data.config.sql.endsWith(';') ? n.data.config.sql : `${n.data.config.sql};`;
    }
  }

  // 依赖拓扑排序
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  nodes.forEach(n => {
    inDegree.set(n.id, 0);
    adjacency.set(n.id, []);
  });

  edges.forEach(e => {
    if (inDegree.has(e.target)) {
      inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
    }
    if (adjacency.has(e.source)) {
      adjacency.get(e.source)!.push(e.target);
    }
  });

  const queue = nodes.filter(n => (inDegree.get(n.id) || 0) === 0).map(n => n.id);
  const orderedIds: string[] = [];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    orderedIds.push(curr);
    const neighbors = adjacency.get(curr) || [];
    for (const nb of neighbors) {
      const nextDeg = (inDegree.get(nb) || 0) - 1;
      inDegree.set(nb, nextDeg);
      if (nextDeg === 0) {
        queue.push(nb);
      }
    }
  }

  // 如果有未访问的节点（存在孤立点或环），补齐
  nodes.forEach(n => {
    if (!orderedIds.includes(n.id)) {
      orderedIds.push(n.id);
    }
  });

  // 生成 CTE 块
  const ctes: { name: string; sql: string }[] = [];
  const nodeAliasMap = new Map<string, string>();

  orderedIds.forEach((nodeId, idx) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const cleanTitle = node.data.title.trim().replace(/^["`]|["`]$/g, '');
    let safeName = cleanTitle.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    if (!safeName || /^\d+$/.test(safeName)) {
      safeName = `step_${idx + 1}`;
    }
    const cteName = node.data.type === 'result' ? 'final_result' : safeName;
    nodeAliasMap.set(nodeId, cteName);

    // 找到此节点的直接输入上游
    const inEdges = edges.filter(e => e.target === nodeId);
    const upstreamAliases = inEdges.map(e => nodeAliasMap.get(e.source)).filter(Boolean) as string[];

    let nodeSql = '';
    if (node.data.type === 'source') {
      if (node.data.config?.tableName) {
        nodeSql = `SELECT * FROM "${node.data.config.tableName}"`;
      } else if (node.data.config?.filePath) {
        nodeSql = `SELECT * FROM read_parquet('${node.data.config.filePath}')`;
      } else {
        nodeSql = `SELECT 1 AS placeholder`;
      }
    } else if (node.data.config?.rawSql || node.data.config?.sql) {
      let raw = (node.data.config.rawSql || node.data.config.sql).trim().replace(/;\s*$/, '');
      if (upstreamAliases.length > 0 && raw.includes('{{input}}')) {
        raw = raw.replace(/\{\{input\}\}/g, upstreamAliases[0]);
      }
      nodeSql = raw;
    } else if (node.data.type === 'aggregate') {
      const aggCfg = node.data.config as AggregateNodeConfig;
      const upstream = upstreamAliases[0] || 'input_table';
      const groupBy = aggCfg.groupBy || [];
      const aggregations = aggCfg.aggregations || [];

      const selectCols = [
        ...groupBy.map(c => `"${c}"`),
        ...aggregations.map(a => `${a.func}(${a.column === '*' ? '*' : `"${a.column}"`}) AS "${a.alias}"`),
      ];
      if (selectCols.length === 0) selectCols.push('*');

      nodeSql = `SELECT\n  ${selectCols.join(',\n  ')}\nFROM ${upstream}`;
      if (aggCfg.filter) {
        nodeSql += `\nWHERE ${aggCfg.filter}`;
      }
      if (groupBy.length > 0) {
        nodeSql += `\nGROUP BY ${groupBy.map(c => `"${c}"`).join(', ')}`;
      }
    } else if (node.data.type === 'join') {
      const joinCfg = node.data.config as JoinNodeConfig;
      const leftEdge = inEdges.find(
        e => e.targetHandle === 'left' || e.targetHandle === 'left-in' || e.data?.joinSide === 'left'
      );
      const rightEdge = inEdges.find(
        e => e.targetHandle === 'right' || e.targetHandle === 'right-in' || e.data?.joinSide === 'right'
      );
      const left = (leftEdge && nodeAliasMap.get(leftEdge.source)) || upstreamAliases[0] || 'left_table';
      const right = (rightEdge && nodeAliasMap.get(rightEdge.source)) || (upstreamAliases[1] !== left ? upstreamAliases[1] : undefined) || 'right_table';
      const onClause = (joinCfg.conditions || [])
        .filter(c => c.leftColumn && c.rightColumn)
        .map(c => `l."${c.leftColumn}" = r."${c.rightColumn}"`)
        .join(' AND ') || '1 = 1';

      nodeSql = `SELECT l.*, r.* FROM ${left} l\n${joinCfg.joinType || 'INNER'} JOIN ${right} r ON ${onClause}`;
    } else {
      const upstream = upstreamAliases[0] || 'previous_step';
      nodeSql = `SELECT * FROM ${upstream}`;
    }

    ctes.push({ name: cteName, sql: nodeSql });
  });

  if (ctes.length === 1) {
    return `${ctes[0].sql};`;
  }

  const cteBlocks = ctes.slice(0, -1).map(c => `  ${c.name} AS (\n    ${c.sql.replace(/\n/g, '\n    ')}\n  )`);
  const finalCte = ctes[ctes.length - 1];

  return `WITH\n${cteBlocks.join(',\n\n')}\n${finalCte.sql};`;
}

