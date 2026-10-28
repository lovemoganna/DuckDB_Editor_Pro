import { splitSqlScript } from './sqlStructure';
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
  SqlExecutionStage,
  SqlParadigmMeta,
  BugTraceInfo,
  SqlPitfallPreset,
  SchemaEvolution,
} from './workflowTypes';

export interface ParsedCte {
  name: string;
  query: string;
  sourceTables: string[];
  startLine?: number;
  endLine?: number;
}

/**
 * 获取 SQL 逻辑执行阶段的标准运行套路与避坑元数据
 */
export function getSqlParadigm(stage: SqlExecutionStage): SqlParadigmMeta {
  switch (stage) {
    case 'from':
      return {
        stage: 'from',
        stageName: 'FROM · 数据源装载',
        executionOrder: 1,
        roleDesc: '底层物理表与数据文件寻址扫描',
        mentalModel: '【逻辑第 1 步】SQL 引擎最先寻址并打开数据源表。确定原始数据行数基数，决定后续所有步骤的输入规模。DuckDB 会在此处进行列式投影与过滤下推优化。',
        pitfallWarning: '【避坑指南】杜绝 SELECT * 引发宽表全量扫描；若数据表不存在将在此阶段直接抛出 Catalog Error。',
      };
    case 'join':
      return {
        stage: 'join',
        stageName: 'JOIN · 多表行级关联',
        executionOrder: 2,
        roleDesc: '基于 ON 条件进行多表笛卡尔积或哈希关联',
        mentalModel: '【逻辑第 2 步】根据关联键匹配左右两表。LEFT JOIN 保留左表全量行；INNER JOIN 仅保留双边匹配行。DuckDB 会基于小表在内存中建立哈希表以探测大表。',
        pitfallWarning: '【高频 Bug】务必指定明确唯一的关联键，防止 1:N 导致行数剧增的笛卡尔积爆炸；关联键含 NULL 将无法通过等值关联匹配！',
      };
    case 'where':
      return {
        stage: 'where',
        stageName: 'WHERE · 行级条件初筛',
        executionOrder: 3,
        roleDesc: '在数据聚合前尽早剔除无关数据行',
        mentalModel: '【核心套路】逐行评估布尔过滤断言，尽早淘汰无效行，最大程度降低后续 GROUP BY 维度的内存占用与哈希基数。',
        pitfallWarning: '【最常见 Bug】SELECT 中定义的别名在此处绝对不可用！因为执行顺序中 WHERE 发生于 SELECT 之前。NULL 比较须用 IS NULL 而非 = NULL。',
      };
    case 'groupby':
      return {
        stage: 'groupby',
        stageName: 'GROUP BY · 维度分组聚合',
        executionOrder: 4,
        roleDesc: '按维度键分桶折叠，计算指标汇总值',
        mentalModel: '【逻辑第 4 步】将细粒度的行按照分组键折叠为粗粒度指标行。输出行数收敛为分组去重基数，并在内部累加 SUM/COUNT/AVG 等聚合函数。',
        pitfallWarning: '【高频报错】SELECT 中除了聚合函数包裹的指标，所有普通列都必须显式列入 GROUP BY 列表！高基数字段分组易导致内存暴涨。',
      };
    case 'having':
      return {
        stage: 'having',
        stageName: 'HAVING · 聚合指标后验过滤',
        executionOrder: 5,
        roleDesc: '针对分组聚合后的指标值进行二次条件筛选',
        mentalModel: '【逻辑第 5 步】在 GROUP BY 汇总计算完成后，对聚合出的统计值（如 SUM(amt) > 1000）执行过滤断言。',
        pitfallWarning: '【避坑指南】普通行级过滤绝不要写在 HAVING 中！应前移至 WHERE，否则会浪费算力去聚合那些注定被过滤的行。',
      };
    case 'select':
      return {
        stage: 'select',
        stageName: 'SELECT · 字段计算投影与开窗',
        executionOrder: 6,
        roleDesc: '字段提取、标量计算、类型转换与窗口函数',
        mentalModel: '【逻辑第 6 步】对前面过滤与聚合后保留的最终行，执行标量数学运算、字符串拼接、CAST 类型转换及 OVER() 窗口排名。列别名在此阶段正式生效。',
        pitfallWarning: '【高频崩溃】警惕类型转换报错 (Conversion Error) 与除以零 (Zero Division)；同层 SELECT 别名不能在同层并列计算中直接引用。',
      };
    case 'orderby':
      return {
        stage: 'orderby',
        stageName: 'ORDER BY · 结果全序排布',
        executionOrder: 7,
        roleDesc: '根据指定列对最终结果集进行全序重排',
        mentalModel: '【逻辑第 7 步】在完成所有计算与投影后对最终数据进行全量或局部 Top-N 排序。',
        pitfallWarning: '【避坑指南】海量数据 ORDER BY 若无 LIMIT 会触发全量内存排序，耗尽资源；建议结合 LIMIT 使用以利用 DuckDB Top-N 堆优化。',
      };
    case 'limit':
      return {
        stage: 'limit',
        stageName: 'LIMIT · 分页截断与最终产出',
        executionOrder: 8,
        roleDesc: '分页截取指定行数并返回给客户端',
        mentalModel: '【最终步】引擎执行的最后一步，截断指定数量行返回结果集。',
        pitfallWarning: '【避坑指南】LIMIT 需配合明确的 ORDER BY 才能保证多次查询返回顺序的一致性。',
      };
    case 'cte':
    default:
      return {
        stage: 'cte',
        stageName: 'CTE · 公用表表达式物化步骤',
        executionOrder: 2,
        roleDesc: '模块化中间数据集物化与传递',
        mentalModel: '【模块化套路】将复杂多层嵌套查询拆解为可读、可复用的链式中间结果集，帮助逐步调试与验证业务逻辑。',
        pitfallWarning: '【避坑指南】检查 CTE 间是否产生循环引用；DuckDB 会自动内联或物化 CTE。',
      };
  }
}

/**
 * 经典高频 SQL 避坑与运行套路预设场景库
 * 用于帮助用户直观体验 Bug 发生点位与逻辑时序机制
 */
export const SQL_PITFALL_PRESETS: SqlPitfallPreset[] = [
  {
    id: 'where_alias_violation',
    name: '别名在 WHERE 中提前使用 (Binder Error)',
    category: 'binder_error',
    summary: 'WHERE 过滤发生于 SELECT 之前，此时 final_price 别名尚未诞生',
    bugDescription: 'Binder Error: Referenced column "final_price" not found in table "products"',
    pitfallRationale: '【核心套路法则】：SQL 逻辑生命周期遵循严格时序：FROM(1) ➔ WHERE(2) ➔ GROUP BY(3) ➔ SELECT(4)。WHERE 评估每行布尔谓词时，SELECT 计算尚未开始，别名在此时不存在！',
    buggySql: `SELECT 
  product_id, 
  category, 
  price * (1 - discount_rate) AS final_price 
FROM products 
WHERE final_price > 100
ORDER BY final_price DESC;`,
    fixedSql: `SELECT 
  product_id, 
  category, 
  price * (1 - discount_rate) AS final_price 
FROM products 
WHERE price * (1 - discount_rate) > 100
ORDER BY final_price DESC;`,
  },
  {
    id: 'groupby_missing_column',
    name: 'GROUP BY 遗漏普通非聚合列 (语法规范越界)',
    category: 'groupby_violation',
    summary: '分组折叠后普通非聚合列无法确定唯一代表值',
    bugDescription: 'Binder Error: column "employee_name" must appear in the GROUP BY clause or be used in an aggregate function',
    pitfallRationale: '【核心套路法则】：GROUP BY 将细粒度行坍缩为按 department_id 分组的指标行。SELECT 列表中除分组键外，普通列必须通过 SUM/COUNT/AVG 等聚合函数收敛，或使用开窗函数保留原粒度。',
    buggySql: `SELECT 
  department_id, 
  employee_name, 
  AVG(salary) AS avg_salary 
FROM employees 
GROUP BY department_id;`,
    fixedSql: `SELECT 
  department_id, 
  employee_name, 
  AVG(salary) OVER(PARTITION BY department_id) AS avg_salary 
FROM employees;`,
  },
  {
    id: 'left_join_where_degradation',
    name: 'LEFT JOIN 被 WHERE 过滤导致左连接退化 (静默数据丢失)',
    category: 'join_degradation',
    summary: 'WHERE 过滤条件过滤掉了 NULL 行，使 LEFT JOIN 退化为 INNER JOIN',
    bugDescription: '⚠️ 潜在 Bug: 0 行截断或主表用户数骤降（未成单用户全被丢弃）',
    pitfallRationale: '【核心套路法则】：LEFT JOIN 保留左表全量行（右表未匹配填 NULL）。紧随其后的 WHERE 会评估每一行，NULL = "completed" 计算为 UNKNOWN/FALSE，导致左表未匹配用户全被丢弃！修复方式是将右表过滤移入 ON 子句。',
    buggySql: `SELECT 
  u.user_id, 
  u.user_name, 
  o.order_id, 
  o.order_status 
FROM users u 
LEFT JOIN orders o ON u.user_id = o.user_id 
WHERE o.order_status = 'completed';`,
    fixedSql: `SELECT 
  u.user_id, 
  u.user_name, 
  o.order_id, 
  o.order_status 
FROM users u 
LEFT JOIN orders o ON u.user_id = o.user_id AND o.order_status = 'completed';`,
  },
  {
    id: 'cartesian_blowup',
    name: '关联条件缺失导致笛卡尔积膨胀 (内存爆炸风险)',
    category: 'cartesian_blowup',
    summary: '缺少等值关联键，输出行数产生 N × M 阶乘级剧增',
    bugDescription: '⚠️ 潜在 Bug: 笛卡尔积膨胀（关联后行数激增数百倍）',
    pitfallRationale: '【核心套路法则】：JOIN 阶段如果没有指定等值关联键（或 1=1），引擎必须对两表做全量笛卡尔积，不仅消耗巨大 WASM 内存，还会破坏后续所有聚合统计基数。',
    buggySql: `SELECT 
  c.customer_name, 
  o.order_amount 
FROM customers c 
JOIN orders o ON 1 = 1 
WHERE c.city = 'Beijing';`,
    fixedSql: `SELECT 
  c.customer_name, 
  o.order_amount 
FROM customers c 
JOIN orders o ON c.customer_id = o.customer_id 
WHERE c.city = 'Beijing';`,
  },
  {
    id: 'enterprise_cte_pipeline',
    name: '工业级现代多层 CTE 流水线 (最佳架构范式)',
    category: 'perfect_pipeline',
    summary: '模块化分解：初筛 ➔ 维度聚合 ➔ 实体关联 ➔ 排序截断',
    bugDescription: '✅ 逻辑完美：各阶段职责单一，可读性与执行性能极佳',
    pitfallRationale: '【最佳实践范式】：先用 filtered_orders 在底层剔除无效单据，再通过 user_aggregates 计算指标并用 HAVING 二筛，最后主表关联呈现，避免大宽表全量聚合导致的算力浪费。',
    buggySql: `WITH filtered_orders AS (
  SELECT order_id, user_id, amount, status 
  FROM orders 
  WHERE status = 'completed' AND amount > 0
),
user_aggregates AS (
  SELECT 
    user_id, 
    COUNT(order_id) AS total_orders, 
    SUM(amount) AS total_spent 
  FROM filtered_orders 
  GROUP BY user_id 
  HAVING COUNT(order_id) >= 2
)
SELECT 
  u.user_name, 
  ua.total_orders, 
  ua.total_spent 
FROM user_aggregates ua 
JOIN users u ON ua.user_id = u.user_id 
ORDER BY ua.total_spent DESC 
LIMIT 20;`,
    fixedSql: `WITH filtered_orders AS (
  SELECT order_id, user_id, amount, status 
  FROM orders 
  WHERE status = 'completed' AND amount > 0
),
user_aggregates AS (
  SELECT 
    user_id, 
    COUNT(order_id) AS total_orders, 
    SUM(amount) AS total_spent 
  FROM filtered_orders 
  GROUP BY user_id 
  HAVING COUNT(order_id) >= 2
)
SELECT 
  u.user_name, 
  ua.total_orders, 
  ua.total_spent 
FROM user_aggregates ua 
JOIN users u ON ua.user_id = u.user_id 
ORDER BY ua.total_spent DESC 
LIMIT 20;`,
  },
];


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
export function splitSqlStatements(sql: string): string[] { return splitSqlScript(sql).map(statement => statement.sql); }

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
        stepIndex: 1,
        sqlStage: 'from',
        paradigm: getSqlParadigm('from'),
        clauseSnippet: `FROM "${tableName}"`,
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
  ctes.forEach((cte, idx) => {
    const { type, title, subtitle, config, predicate, joinSummary, groupBySummary, sqlSnippet } = detectNodeTypeAndConfig(cte.query, cte.name);
    const stage: SqlExecutionStage = type === 'aggregate' ? 'groupby' : type === 'join' ? 'join' : predicate ? 'where' : 'cte';
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
        stepIndex: idx + 2,
        sqlStage: stage,
        paradigm: getSqlParadigm(stage),
        clauseSnippet: cte.query.trim().slice(0, 160),
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

  // 4. 若主查询包含 JOIN，创建专职 Join 节点并连接至最终 Result
  const isMainJoin = finalInfo.type === 'join' && mainQueryTables.length >= 2;
  const targetForMainTables = isMainJoin ? 'node_main_join' : 'node_final_result';

  if (isMainJoin) {
    const joinNode: DataFlowNode = {
      id: 'node_main_join',
      type: 'dataFlowNode',
      position: { x: 0, y: 0 },
      data: {
        id: 'node_main_join',
        type: 'join',
        title: '表连接',
        subtitle: finalInfo.subtitle,
        status: 'configured',
        stepIndex: ctes.length + 2,
        sqlStage: 'join',
        paradigm: getSqlParadigm('join'),
        predicate: finalInfo.predicate,
        joinSummary: finalInfo.joinSummary,
        groupBySummary: finalInfo.groupBySummary,
        sqlSnippet: finalInfo.sqlSnippet,
        config: finalInfo.config,
        sqlRange: {
          startLine: ctes.length > 0 ? (ctes[ctes.length - 1].endLine || 1) + 1 : 1,
          endLine: ctes.length > 0 ? (ctes[ctes.length - 1].endLine || 1) + mainQuery.split('\n').length : mainQuery.split('\n').length,
          cteName: 'main_query_join',
        },
      },
    };
    nodes.push(joinNode);

    edges.push({
      id: 'edge_node_main_join_node_final_result',
      source: 'node_main_join',
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

  // 连线主查询（或 Join 节点）与上游 CTE 或物理表
  mainQueryTables.forEach((upstreamName, idx) => {
    let sourceId = '';
    if (cteNames.has(upstreamName)) {
      sourceId = `node_cte_${upstreamName}`;
    } else if (addedPhysicalTables.has(upstreamName)) {
      sourceId = `node_src_${upstreamName.replace(/[^a-zA-Z0-9_]/g, '_')}`;
    }

    if (sourceId) {
      const joinSide = isMainJoin ? (idx === 0 ? 'left' as const : 'right' as const) : undefined;
      const targetHandle = isMainJoin ? joinSide! : 'input';
      edges.push({
        id: `edge_${sourceId}_${targetForMainTables}`,
        source: sourceId,
        sourceHandle: 'output',
        target: targetForMainTables,
        targetHandle,
        type: 'dataFlowEdge',
        data: {
          sourceHandle: 'output',
          targetHandle,
          joinSide,
          label: isMainJoin ? (joinSide === 'left' ? '左表' : '右表') : '最终输出',
          relationType: isMainJoin ? 'join' : 'data',
        },
      });
    }
  });

  // 如果主查询没有明确来源，但存在 CTE，连接最后一个 CTE 到主查询
  if (edges.filter(e => e.target === targetForMainTables).length === 0 && ctes.length > 0) {
    const lastCte = ctes[ctes.length - 1];
    edges.push({
      id: `edge_node_cte_${lastCte.name}_${targetForMainTables}`,
      source: `node_cte_${lastCte.name}`,
      sourceHandle: 'output',
      target: targetForMainTables,
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
  const selectMatch = sql.match(/\bSELECT\s+([\s\S]+?)\s+\bFROM\b/i);
  const selectColNames: string[] = [];
  if (selectMatch) {
    const rawList = selectMatch[1].split(/,(?![^(]*\))/);
    for (const item of rawList) {
      const trimmed = item.trim();
      const asMatch = trimmed.match(/\s+(?:AS\s+)?([a-zA-Z_][\w$]*)$/i);
      const colName = asMatch ? asMatch[1] : trimmed.split('.').pop() || trimmed;
      if (colName && colName !== '*') selectColNames.push(cleanIdentifier(colName));
    }
  }

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
        stepIndex: 1,
        sqlStage: 'from',
        paradigm: getSqlParadigm('from'),
        clauseSnippet: `FROM "${tbl}"`,
        schemaEvolution: {
          inputColumns: ['磁盘物理/虚拟表数据文件'],
          outputColumns: ['物理全量字段集 (RAW)'],
        },
        config: {
          tableName: isFile ? undefined : tbl,
          filePath: isFile ? tbl : undefined,
          fileType: isFile ? (tbl.split('.').pop() as any) : 'table',
        } as SourceNodeConfig,
      },
    };
  });
  nodes.push(...sourceNodes);

  // 3. 分析中间处理逻辑 (Join, Where Filter, Aggregate, Having, Transform)
  const isJoin = /\b(?:INNER|LEFT|RIGHT|FULL|CROSS)?\s*JOIN\b/i.test(sql);
  const isAgg = /GROUP\s+BY/i.test(sql) || /\b(?:SUM|COUNT|AVG|MIN|MAX)\s*\(/i.test(sql);
  const havingMatch = sql.match(/\bHAVING\s+([\s\S]+?)(?:\b(?:ORDER\s+BY|LIMIT|WINDOW)\b|$)/i);
  const havingPredicate = havingMatch ? havingMatch[1].trim() : undefined;

  let currentTargetId = '';
  let currentStepIdx = 1;

  if (isJoin && sourceNodes.length >= 2) {
    currentStepIdx++;
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
        stepIndex: currentStepIdx,
        sqlStage: 'join',
        paradigm: getSqlParadigm('join'),
        clauseSnippet: joinInfo.joinSummary || `${(joinInfo.config as JoinNodeConfig).joinType} JOIN`,
        predicate: joinInfo.predicate,
        joinSummary: joinInfo.joinSummary,
        groupBySummary: joinInfo.groupBySummary,
        sqlSnippet: joinInfo.sqlSnippet,
        schemaEvolution: {
          inputColumns: ['左表字段集', '右表字段集'],
          outputColumns: ['多表横向拼接宽表字段集'],
          newColumns: ['右表关联字段'],
        },
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

  // 3.5 行级初筛 (WHERE 过滤算子 - SQL 经典逻辑执行第 3 步)
  const finalTitle = formatResultNodeTitle(tabTitle);
  const finalInfo = detectNodeTypeAndConfig(sql, finalTitle);

  if (finalInfo.predicate) {
    currentStepIdx++;
    const filterNode: DataFlowNode = {
      id: 'node_filter_step',
      type: 'dataFlowNode',
      position: { x: 0, y: 0 },
      data: {
        id: 'node_filter_step',
        type: 'sql_transform',
        title: 'WHERE 行级初筛',
        subtitle: `过滤: ${finalInfo.predicate.slice(0, 32)}${finalInfo.predicate.length > 32 ? '...' : ''}`,
        status: 'configured',
        stepIndex: currentStepIdx,
        sqlStage: 'where',
        paradigm: getSqlParadigm('where'),
        clauseSnippet: `WHERE ${finalInfo.predicate}`,
        predicate: finalInfo.predicate,
        schemaEvolution: {
          inputColumns: ['上游全部可用列'],
          outputColumns: ['行数初筛后留存列 (字段集不变)'],
          newColumns: [],
          droppedColumns: [],
        },
        config: {
          sql: `SELECT * FROM {{input}} WHERE ${finalInfo.predicate}`,
        } as SqlTransformNodeConfig,
      },
    };
    nodes.push(filterNode);

    edges.push({
      id: `edge_${currentTargetId}_node_filter_step`,
      source: currentTargetId,
      sourceHandle: 'output',
      target: 'node_filter_step',
      targetHandle: 'input',
      type: 'dataFlowEdge',
      data: {
        sourceHandle: 'output',
        targetHandle: 'input',
        label: '行级初筛过滤',
        relationType: 'filter',
      },
    });

    currentTargetId = 'node_filter_step';
  }

  // 4. 聚合算子 (GROUP BY - SQL 经典逻辑执行第 4 步)
  if (isAgg) {
    currentStepIdx++;
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
        stepIndex: currentStepIdx,
        sqlStage: 'groupby',
        paradigm: getSqlParadigm('groupby'),
        clauseSnippet: aggInfo.groupBySummary || 'GROUP BY 聚合',
        predicate: aggInfo.predicate,
        joinSummary: aggInfo.joinSummary,
        groupBySummary: aggInfo.groupBySummary,
        sqlSnippet: aggInfo.sqlSnippet,
        schemaEvolution: {
          inputColumns: ['初筛后的细粒度明细行'],
          outputColumns: [...(aggInfo.config?.groupBy || []), ...(aggInfo.config?.aggregations || []).map((a: any) => a.alias)],
          newColumns: (aggInfo.config?.aggregations || []).map((a: any) => a.alias),
          droppedColumns: ['未列入 GROUP BY 的普通列 (已折叠注销)'],
        },
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

  // 4.5 HAVING 过滤算子 (SQL 逻辑执行第 5 步)
  if (havingPredicate) {
    currentStepIdx++;
    const havingNode: DataFlowNode = {
      id: 'node_having_step',
      type: 'dataFlowNode',
      position: { x: 0, y: 0 },
      data: {
        id: 'node_having_step',
        type: 'sql_transform',
        title: 'HAVING 聚合后过滤',
        subtitle: `指标过滤: ${havingPredicate.slice(0, 28)}${havingPredicate.length > 28 ? '...' : ''}`,
        status: 'configured',
        stepIndex: currentStepIdx,
        sqlStage: 'having',
        paradigm: getSqlParadigm('having'),
        clauseSnippet: `HAVING ${havingPredicate}`,
        predicate: havingPredicate,
        schemaEvolution: {
          inputColumns: ['已计算的分组指标与维度'],
          outputColumns: ['指标合规分组 (组级二筛)'],
          newColumns: [],
          droppedColumns: [],
        },
        config: {
          sql: `SELECT * FROM {{input}} HAVING ${havingPredicate}`,
        } as SqlTransformNodeConfig,
      },
    };
    nodes.push(havingNode);

    edges.push({
      id: `edge_${currentTargetId}_node_having_step`,
      source: currentTargetId,
      sourceHandle: 'output',
      target: 'node_having_step',
      targetHandle: 'input',
      type: 'dataFlowEdge',
      data: {
        sourceHandle: 'output',
        targetHandle: 'input',
        label: 'HAVING 过滤',
        relationType: 'filter',
      },
    });

    currentTargetId = 'node_having_step';
  }

  // 5. 最终结果节点 (LIMIT / 输出 - SQL 最终执行步骤)
  currentStepIdx++;
  const limitMatch = sql.match(/\bLIMIT\s+(\d+)/i);
  const resultNode: DataFlowNode = {
    id: 'node_final_result',
    type: 'dataFlowNode',
    position: { x: 0, y: 0 },
    data: {
      id: 'node_final_result',
      type: 'result',
      title: finalTitle,
      subtitle: limitMatch ? `最终数据集 · LIMIT ${limitMatch[1]}` : '最终数据集',
      status: 'configured',
      stepIndex: currentStepIdx,
      sqlStage: 'limit',
      paradigm: getSqlParadigm('limit'),
      clauseSnippet: finalInfo.sqlSnippet || 'SELECT 结果输出',
      predicate: finalInfo.predicate,
      joinSummary: finalInfo.joinSummary,
      groupBySummary: finalInfo.groupBySummary,
      sqlSnippet: finalInfo.sqlSnippet,
      schemaEvolution: {
        inputColumns: ['前序各阶段交付数据列'],
        outputColumns: selectColNames.length > 0 ? selectColNames : ['最终计算投影列'],
        newColumns: selectColNames.filter(c => !referencedTables.includes(c)),
      },
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

/**
 * 还原 SQL 执行的每一步：将 SQL 查询拆解为标准逻辑执行流水线
 * 遵循严格时序：FROM -> JOIN -> WHERE -> GROUP BY -> HAVING -> SELECT -> LIMIT
 */
export function parseSqlToExecutionSteps(
  sql: string,
  options?: { tabTitle?: string; existingNodes?: DataFlowNode[] }
): { nodes: DataFlowNode[]; edges: DataFlowEdge[] } {
  return buildWorkflowFromSingleSelect(sql, options?.tabTitle, options?.existingNodes);
}

/**
 * 智能 Bug 溯源与点位定位器
 * 核心机制：
 * 1. 深度解析 DuckDB 运行时报错文本（Binder Error / Catalog Error / Parser Error / 算术除零 / 聚合规范等）
 * 2. 结合 SQL 逻辑执行套路与各步骤 AST 片段，将 Bug 精确锚定到具体执行步骤节点
 * 3. 沿有向无环图进行上游原因溯源（祖先高亮 + 错误光流连线）与下游阻断分析
 */
export function locateBugInWorkflow(
  errorMessage: string,
  sql: string,
  nodes: DataFlowNode[],
  edges: DataFlowEdge[]
): {
  nodes: DataFlowNode[];
  edges: DataFlowEdge[];
  bugNodeId: string | null;
  bugReport?: BugTraceInfo;
} {
  if (!errorMessage || nodes.length === 0) {
    return { nodes, edges, bugNodeId: null };
  }

  const errClean = errorMessage.trim();
  let culpritNode: DataFlowNode | undefined;
  let bugInfo: BugTraceInfo | undefined;

  // 1. 匹配 Binder Error: Referenced column "xxx" not found
  const colMatch =
    errClean.match(/Referenced column ["']?([^"'\s]+)["']? not found/i) ||
    errClean.match(/Column with name ["']?([^"'\s]+)["']? does not exist/i) ||
    errClean.match(/column ["']?([^"'\s]+)["']? does not exist/i);

  if (colMatch) {
    const colName = colMatch[1];
    // 检查是否将 SELECT 别名误用在 WHERE 中（经典 SQL 执行套路违背）
    const isSelectAliasInWhere = /WHERE\b/i.test(sql) && new RegExp(`AS\\s+["']?${colName}["']?\\b`, 'i').test(sql);
    const whereNode = nodes.find(n => n.data.sqlStage === 'where' || n.id.includes('filter'));

    if (isSelectAliasInWhere && whereNode) {
      culpritNode = whereNode;
      // 提取该别名对应的 SELECT 原始计算表达式并生成一键修复 SQL
      let fixedSql: string | undefined;
      const aliasDefMatch = sql.match(new RegExp(`([\\w\\s*+\\-\\.\\(\\)\\/]+?)\\s+AS\\s+["']?${colName}["']?`, 'i'));
      if (aliasDefMatch) {
        const rawExpr = aliasDefMatch[1].trim();
        fixedSql = sql.replace(new RegExp(`\\bWHERE\\b([\\s\\S]+?)\\b${colName}\\b`, 'i'), (m) => {
          return m.replace(new RegExp(`\\b${colName}\\b`, 'g'), rawExpr);
        });
      }

      bugInfo = {
        hasBug: true,
        isRootCause: true,
        severity: 'error',
        title: 'WHERE 阶段引用未就绪别名 (执行套路越界)',
        detail: `在 WHERE 谓词中引用了尚未生成的列别名 "${colName}"。`,
        suggestion: `【套路溯源】SQL 引擎执行顺序为 FROM(1) -> WHERE(2) -> GROUP BY(3) -> SELECT(4)。WHERE 初筛时，SELECT 阶段尚未开始，别名 "${colName}" 还未被物化！请将原表达式直接写在 WHERE 中，或使用 CTE/子查询封装。`,
        culpritToken: colName,
        culpritClause: whereNode.data.clauseSnippet || 'WHERE 子句',
        fixedSql,
      };
    } else {
      // 查找哪个节点最先引用了该列
      const candidate = nodes.find(n => {
        const text = `${n.data.clauseSnippet || ''} ${n.data.predicate || ''} ${n.data.groupBySummary || ''} ${n.data.joinSummary || ''}`;
        return new RegExp(`\\b${colName}\\b`, 'i').test(text);
      }) || nodes.find(n => n.data.sqlStage === 'where') || nodes.find(n => n.data.type === 'source');

      culpritNode = candidate || nodes[nodes.length - 1];
      bugInfo = {
        hasBug: true,
        isRootCause: true,
        severity: 'error',
        title: `列 "${colName}" 不存在 (Binder Error)`,
        detail: `无法在上下文数据表中找到列 "${colName}"。`,
        suggestion: `【排查指南】请检查字段拼写，或在上游数据源节点中确认该表实际包含的列名。若为多表关联，需注意是否需增加表别名前缀 (如 t.${colName})。`,
        culpritToken: colName,
      };
    }
  }

  // 2. 匹配 GROUP BY 缺失列错误
  if (!culpritNode && /must appear in the GROUP BY clause or be used in an aggregate function/i.test(errClean)) {
    const colGroupMatch = errClean.match(/column ["']?([^"'\s]+)["']? must appear in the GROUP BY/i);
    const missingCol = colGroupMatch ? colGroupMatch[1] : '';
    culpritNode =
      nodes.find(n => n.data.sqlStage === 'groupby' || n.data.type === 'aggregate') ||
      nodes.find(n => n.data.type === 'result') ||
      nodes[nodes.length - 1];

    let fixedSql: string | undefined;
    if (missingCol && /GROUP\s+BY\s+([^;\n]+)/i.test(sql)) {
      fixedSql = sql.replace(/GROUP\s+BY\s+([^;\n]+)/i, (_, grp) => `GROUP BY ${grp.trim()}, ${missingCol}`);
    }

    bugInfo = {
      hasBug: true,
      isRootCause: true,
      severity: 'error',
      title: '非聚合列未列入 GROUP BY (聚合语法规范)',
      detail: missingCol ? `列 "${missingCol}" 在 SELECT 中既非分组键，也未被聚合函数包裹。` : '存在未被聚合包裹的普通列未声明在 GROUP BY 中。',
      suggestion: `【套路溯源】GROUP BY 阶段将细粒度行折叠为指标行。除分组键外，所有字段必须使用 SUM()/COUNT()/AVG()/MAX()/MIN() 等聚合函数收敛，或显式追加至 GROUP BY 列表中。`,
      culpritToken: missingCol,
      fixedSql,
    };
  }

  // 3. 匹配 Catalog Error (表或文件不存在)
  if (!culpritNode) {
    const tableMatch =
      errClean.match(/Table with name ["']?([^"'\s]+)["']? does not exist/i) ||
      errClean.match(/table ["']?([^"'\s]+)["']? does not exist/i) ||
      errClean.match(/No files found that match the pattern ["']?([^"'\s]+)["']?/i);

    if (tableMatch) {
      const tblName = tableMatch[1];
      culpritNode =
        nodes.find(n => n.data.type === 'source' && (n.data.title.toLowerCase().includes(tblName.toLowerCase()) || tblName.toLowerCase().includes(n.data.title.toLowerCase()))) ||
        nodes.find(n => n.data.type === 'source') ||
        nodes[0];

      bugInfo = {
        hasBug: true,
        isRootCause: true,
        severity: 'error',
        title: `数据源未找到 (Catalog Error)`,
        detail: `DuckDB 无法在当前目录中定位到数据表或文件 "${tblName}"。`,
        suggestion: `【套路溯源】SQL 引擎在第 1 步 FROM 寻址装载时失败。请检查表名拼写，或先执行建表与文件导入语句。`,
        culpritToken: tblName,
      };
    }
  }

  // 4. 匹配语法错误 Parser Error
  if (!culpritNode && /syntax error/i.test(errClean)) {
    const syntaxMatch = errClean.match(/syntax error at or near ["']?([^"'\s\n]+)["']?/i);
    const syntaxToken = syntaxMatch ? syntaxMatch[1] : '';
    culpritNode =
      nodes.find(n => syntaxToken && (n.data.clauseSnippet || '').includes(syntaxToken)) ||
      nodes[nodes.length - 1];

    bugInfo = {
      hasBug: true,
      isRootCause: true,
      severity: 'error',
      title: 'SQL 语法解析错误 (Parser Error)',
      detail: syntaxToken ? `语法分析器在 "${syntaxToken}" 附近中断，无法正确解析。` : errClean,
      suggestion: `【排查指南】请检查关键字拼写、引号闭合、逗号及括号匹配。`,
      culpritToken: syntaxToken,
    };
  }

  // 5. 匹配类型转换异常
  if (!culpritNode && /Conversion Error|Could not convert/i.test(errClean)) {
    culpritNode =
      nodes.find(n => n.data.sqlStage === 'where' || n.data.sqlStage === 'select') ||
      nodes[nodes.length - 1];

    bugInfo = {
      hasBug: true,
      isRootCause: true,
      severity: 'error',
      title: '数据类型转换失败 (Conversion Error)',
      detail: errClean,
      suggestion: `【排查指南】字段中可能包含脏值或格式不符合预期的数据。建议在转换前使用 TRY_CAST() 增强容错，或在 WHERE 中过滤掉异常值。`,
    };
  }

  // 6. 匹配除以零异常
  if (!culpritNode && /divide by zero|division by zero/i.test(errClean)) {
    culpritNode = nodes.find(n => n.data.sqlStage === 'select') || nodes[nodes.length - 1];
    bugInfo = {
      hasBug: true,
      isRootCause: true,
      severity: 'error',
      title: '算术运算除以零崩溃',
      detail: '表达式计算中分母为 0，引发运行时异常。',
      suggestion: `【防崩套路】建议使用 NULLIF(分母, 0) 防范分母为 0 时崩溃，避免阻断整个查询流水线。`,
    };
  }

  // 默认兜底
  if (!culpritNode) {
    culpritNode = nodes.find(n => n.data.type === 'result') || nodes[nodes.length - 1];
    bugInfo = {
      hasBug: true,
      isRootCause: true,
      severity: 'error',
      title: 'SQL 执行报错',
      detail: errClean,
      suggestion: `请结合报错信息检查当前 SQL 语句的逻辑结构与参数配置。`,
    };
  }

  const bugId = culpritNode.id;

  // 溯源拓扑分析：找到所有指向 culpritNode 的上游节点（祖先溯源）
  const ancestorNodeIds = new Set<string>();
  const errorEdgeIds = new Set<string>();
  const queue = [bugId];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    edges.forEach(e => {
      if (e.target === curr) {
        errorEdgeIds.add(e.id);
        if (!ancestorNodeIds.has(e.source)) {
          ancestorNodeIds.add(e.source);
          queue.push(e.source);
        }
      }
    });
  }

  // 下游阻断拓扑分析：找到所有受 culpritNode 影响的下游节点
  const downstreamNodeIds = new Set<string>();
  const downQueue = [bugId];
  while (downQueue.length > 0) {
    const curr = downQueue.shift()!;
    edges.forEach(e => {
      if (e.source === curr) {
        if (!downstreamNodeIds.has(e.target)) {
          downstreamNodeIds.add(e.target);
          downQueue.push(e.target);
        }
      }
    });
  }

  // 更新节点状态
  const updatedNodes = nodes.map(n => {
    if (n.id === bugId) {
      return {
        ...n,
        data: {
          ...n.data,
          status: 'error' as const,
          bugInfo,
          highlightState: 'ancestor' as const,
          isExpanded: true, // 自动展开方便用户即刻诊断
        },
      };
    }
    if (ancestorNodeIds.has(n.id)) {
      return {
        ...n,
        data: {
          ...n.data,
          highlightState: 'ancestor' as const,
        },
      };
    }
    if (downstreamNodeIds.has(n.id)) {
      return {
        ...n,
        data: {
          ...n.data,
          status: 'blocked' as const,
          subtitle: '受上游 Step 报错阻断',
          highlightState: 'dimmed' as const,
        },
      };
    }
    return n;
  });

  // 更新连线高亮状态
  const updatedEdges = edges.map(e => {
    if (errorEdgeIds.has(e.id)) {
      return {
        ...e,
        data: {
          ...e.data,
          isErrorPath: true,
          highlightState: 'ancestor' as const,
        },
      };
    }
    return e;
  });

  return { nodes: updatedNodes, edges: updatedEdges, bugNodeId: bugId, bugReport: bugInfo };
}

/**
 * 逻辑异常与静默 Bug 嗅探器
 * 检测 0 行截断、笛卡尔积行数膨胀等逻辑隐患
 */
export function detectLogicalAnomalies(nodes: DataFlowNode[], edges: DataFlowEdge[]): DataFlowNode[] {
  return nodes.map(node => {
    const inCount = node.data.inputRowCount;
    const outCount = node.data.rowCount;

    // 1. 0 行截断异常 (Zero-row drop)
    if (inCount !== undefined && inCount > 0 && outCount === 0) {
      return {
        ...node,
        data: {
          ...node.data,
          hasAnomaly: true,
          bugInfo: {
            hasBug: false,
            severity: 'warning',
            title: '⚠️ 潜在 Bug: 0 行截断 (全部过滤)',
            detail: `上游流入 ${inCount.toLocaleString()} 行，但在本步骤过滤计算后行数直接变为 0。`,
            suggestion: '【套路排查】业务中最常见的静默 Bug！请重点检查 WHERE 过滤条件中的数值区间、日期格式匹配、字符串大小写、或 NULL 比较（避免使用 = NULL）。',
          },
        },
      };
    }

    // 2. 笛卡尔积行数剧增膨胀
    if (node.data.type === 'join' && inCount !== undefined && inCount > 0 && outCount !== undefined && outCount > inCount * 3) {
      return {
        ...node,
        data: {
          ...node.data,
          hasAnomaly: true,
          bugInfo: {
            hasBug: false,
            severity: 'warning',
            title: '⚠️ 潜在 Bug: 笛卡尔积膨胀',
            detail: `关联后行数激增至 ${outCount.toLocaleString()} 行 (膨胀率 ${(outCount / inCount * 100).toFixed(0)}%)。`,
            suggestion: '【套路排查】请检查 JOIN ON 条件是否缺失或关联键在右表中存在 1:N 重复，防止产生巨大笛卡尔积耗尽内存。',
          },
        },
      };
    }

    return node;
  });
}


