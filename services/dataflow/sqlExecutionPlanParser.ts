/**
 * sqlExecutionPlanParser.ts — 真实 DuckDB 执行计划解析器与可视化调试工作流构建引擎
 *
 * 核心设计定位：
 * 1. 优先读取 DuckDB `EXPLAIN` / `EXPLAIN ANALYZE` 真实物理执行计划，杜绝手工模拟；
 * 2. 将底层算子树准确逆转为顺向数据流 DAG：
 *    SCAN (数据源读取) → FILTER (谓词下推初筛) → JOIN (多表关联) → AGGREGATE (维度聚合) → SORT (排序切片) → RESULT (结果产出)；
 * 3. 连线明确表示真实数据流向与上下游关系；
 * 4. 节点呈现高信噪比上下文：操作类型、输入表、过滤/关联条件、输入/输出行数、物理耗时与占比、异常状态；
 * 5. 执行异常时自动高亮最可能出现问题的节点（Catalog Error 锁定源表、Binder Error 锁定列谓词、Conversion/Runtime Error 锁定转换算子）；
 * 6. 支持从最终结果节点一键反向追溯至底层原始数据源（Lineage Traceback）。
 */

import dagre from 'dagre';
import type {
  DataFlowNode,
  DataFlowEdge,
  WorkflowNodeType,
  DataFlowNodeData,
  BugTraceInfo,
  SqlExecutionStage,
  SqlParadigmMeta,
} from './workflowTypes';
import { getSqlParadigm } from './sqlToWorkflowParser';

// ============================================================
// 1. 结构化物理算子定义
// ============================================================

export type OperatorCategory =
  | 'scan'
  | 'filter'
  | 'join'
  | 'aggregate'
  | 'sort'
  | 'projection'
  | 'result'
  | 'window'
  | 'other';

export interface RawParsedOperator {
  id: string;
  name: string;
  category: OperatorCategory;
  depth: number;
  tableName?: string;
  filterConditions: string[];
  joinCondition?: string;
  joinType?: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' | 'CROSS';
  projections: string[];
  groupByKeys: string[];
  estimatedCost?: number;
  costPercent: number;
  actualTimeMs?: number;
  estimatedRows?: number;
  outputRows?: number;
  inputRows?: number;
  isBottleneck?: boolean;
  rawLines: string[];
  children: RawParsedOperator[];
}

// 算子类别映射字典
const OPERATOR_CATEGORY_MAP: Record<string, OperatorCategory> = {
  // Scans
  seq_scan: 'scan',
  seqscan: 'scan',
  column_data_scan: 'scan',
  chunk_scan: 'scan',
  index_scan: 'scan',
  tablesample: 'scan',
  parquet_scan: 'scan',
  csv_scan: 'scan',
  table_scan: 'scan',
  delim_scan: 'scan',
  // Filter
  filter: 'filter',
  chunk_filter: 'filter',
  // Joins
  hash_join: 'join',
  merge_join: 'join',
  nested_loop: 'join',
  iejoin: 'join',
  cross_product: 'join',
  piecewise_merge_join: 'join',
  blockwise_nl_join: 'join',
  delim_join: 'join',
  positional_join: 'join',
  asof_join: 'join',
  // Aggregation
  aggregate: 'aggregate',
  hash_group_by: 'aggregate',
  perfect_hash_group_by: 'aggregate',
  ungrouped_aggregate: 'aggregate',
  distinct: 'aggregate',
  hash_distinct: 'aggregate',
  // Sort & Limit
  order_by: 'sort',
  top_n: 'sort',
  sort: 'sort',
  limit: 'sort',
  streaming_limit: 'sort',
  // Window
  window: 'window',
  streaming_window: 'window',
  // Projections & Expressions
  projection: 'projection',
  simple_projection: 'projection',
  expression_executor: 'projection',
  // Result
  result_collector: 'result',
  result: 'result',
  root: 'result',
};

export function classifyOperator(name: string): OperatorCategory {
  const norm = name.toLowerCase().replace(/[\s-]+/g, '_');
  for (const [key, cat] of Object.entries(OPERATOR_CATEGORY_MAP)) {
    if (norm.includes(key)) return cat;
  }
  return 'other';
}

// ============================================================
// 2. DuckDB EXPLAIN / EXPLAIN ANALYZE 文本解析器
// ============================================================

/**
 * 从 DuckDB 的方框字符或缩进格式中解析出算子树
 */
export function parseDuckDbExplainPlan(planText: string): RawParsedOperator[] {
  if (!planText || !planText.trim()) return [];

  // 若文本中包含 physical_plan 标记，截取 physical_plan 之后的内容
  let cleanPlan = planText;
  const physIdx = cleanPlan.search(/physical_plan/i);
  if (physIdx !== -1) {
    cleanPlan = cleanPlan.substring(physIdx);
  }

  const lines = cleanPlan.split(/\r?\n/);
  const operators: RawParsedOperator[] = [];
  let opIdCounter = 1;

  // 判断是否为 DuckDB Unicode 边框格式 (┌, │, └ 等)
  const isBoxDrawingFormat = lines.some(l => /[┌─╔╠║│└╚]/.test(l));

  if (isBoxDrawingFormat) {
    parseBoxDrawingPlan(lines, operators, () => `op_${opIdCounter++}`);
  } else {
    parseIndentedTextPlan(lines, operators, () => `op_${opIdCounter++}`);
  }

  // 计算全局耗时分布与瓶颈算子
  annotateCostDistribution(operators);

  return operators;
}

/**
 * 解析带有方框字符的 DuckDB 执行计划
 */
function parseBoxDrawingPlan(
  lines: string[],
  rootList: RawParsedOperator[],
  genId: () => string
) {
  let idx = 0;
  const stack: { node: RawParsedOperator; indent: number }[] = [];

  while (idx < lines.length) {
    const rawLine = lines[idx];
    const trimmed = rawLine.trim();

    if (!trimmed || /^[└─═┘╝\s]+$/.test(trimmed)) {
      idx++;
      continue;
    }

    // 寻找方框顶边界 ┌─────┐ 或 ╔═════╗
    if (/^[┌─╔]/.test(trimmed)) {
      const topIndent = rawLine.search(/\S/);
      const boxLines: string[] = [];
      let boxEnd = idx + 1;

      // 收集盒子内部行直到 └─────┘
      while (boxEnd < lines.length) {
        const bl = lines[boxEnd].trim();
        if (/^[└─╚]/.test(bl)) {
          break;
        }
        if (/^[┌╔]/.test(bl)) {
          // 遇到下一个新盒子顶部，终止当前盒子
          break;
        }
        boxLines.push(lines[boxEnd]);
        boxEnd++;
      }

      // 判断是否为虚线注解框 (如 ┌ ─ ─ ─ ─ ─ ─ ─ ┐) 或纯属性框
      const isDashedBox = /^[┌╔]\s*[─-]\s*[─-]/.test(trimmed);
      const cleanedBoxLines = boxLines
        .map(l => l.replace(/^[│║\s]+/, '').replace(/[│║\s]+$/, '').trim())
        .filter(Boolean);
      const hasAnyOperatorKeyword = cleanedBoxLines.some(l => classifyOperator(l) !== 'other');
      const isAnnotationBox = (isDashedBox || !hasAnyOperatorKeyword) &&
        cleanedBoxLines.length > 0 &&
        cleanedBoxLines.every(c => /^(?:Condition|Filters?|Projections?|Build|Probe|EC|Cost|Actual|Estimated):/i.test(c));

      if (isAnnotationBox && stack.length > 0) {
        // 作为上一个算子的附加属性合并
        const lastOp = stack[stack.length - 1].node;
        for (const line of cleanedBoxLines) {
          lastOp.rawLines.push(line);
          parseLineAttributes(line, lastOp);
        }
        idx = boxEnd + 1;
        continue;
      }

      const operator = extractOperatorFromBoxLines(boxLines, genId());
      if (operator) {
        operator.depth = Math.floor(topIndent / 4);

        // 维护父子层级关系：查找最近的缩进更小的祖先
        while (stack.length > 0 && stack[stack.length - 1].indent >= topIndent) {
          stack.pop();
        }

        if (stack.length > 0) {
          stack[stack.length - 1].node.children.push(operator);
        } else {
          rootList.push(operator);
        }

        stack.push({ node: operator, indent: topIndent });
      }

      idx = boxEnd + 1;
      continue;
    }

    // 处理无框的描述行或注释行
    if (stack.length > 0 && trimmed.startsWith('│')) {
      const cleaned = trimmed.replace(/^[│\s]+/, '').replace(/[│\s]+$/, '');
      if (cleaned) {
        stack[stack.length - 1].node.rawLines.push(cleaned);
        parseLineAttributes(cleaned, stack[stack.length - 1].node);
      }
    }

    idx++;
  }
}

/**
 * 从方框内容行中提取算子核心属性
 */
function extractOperatorFromBoxLines(rawBoxLines: string[], id: string): RawParsedOperator | null {
  const contentLines = rawBoxLines
    .map(l => l.replace(/^[│║\s]+/, '').replace(/[│║\s]+$/, '').trim())
    .filter(Boolean);

  if (contentLines.length === 0) return null;

  const header = contentLines[0];
  const category = classifyOperator(header);

  const node: RawParsedOperator = {
    id,
    name: header,
    category,
    depth: 0,
    filterConditions: [],
    projections: [],
    groupByKeys: [],
    costPercent: 0,
    rawLines: [...contentLines],
    children: [],
  };

  // 逐行解析算子元数据
  for (const line of contentLines) {
    parseLineAttributes(line, node);
  }

  // 尝试从算子名称提取表名 (如 "SEQ_SCAN on orders" 或 "orders")
  if (!node.tableName && (category === 'scan' || header.toLowerCase().includes('scan'))) {
    const onMatch = header.match(/\bon\s+([a-zA-Z0-9_".-]+)/i);
    if (onMatch) {
      node.tableName = onMatch[1].replace(/["']/g, '');
    } else {
      const parts = header.split(/\s+/);
      const last = parts[parts.length - 1];
      if (last && !last.toUpperCase().includes('SCAN')) {
        node.tableName = last.replace(/["']/g, '');
      }
    }
  }

  return node;
}

/**
 * 解析单行注解属性（EC、耗时、条件、字段、表名等）
 */
function parseLineAttributes(line: string, node: RawParsedOperator) {
  // 1. EC: 1234.56 (85.20%)
  const ecMatch = line.match(/EC:\s*([\d.]+)(?:\s*\(([\d.]+)%\))?/i);
  if (ecMatch) {
    node.estimatedCost = parseFloat(ecMatch[1]);
    if (ecMatch[2]) {
      node.costPercent = parseFloat(ecMatch[2]);
    }
  }

  // 2. Actual time: 0.12ms 或 Cumulative time: 1.5ms
  const timeMatch = line.match(/(?:Actual|Cumulative)\s+time:\s*([\d.]+)\s*(ms|s|us)?/i);
  if (timeMatch) {
    let t = parseFloat(timeMatch[1]);
    const unit = (timeMatch[2] || 'ms').toLowerCase();
    if (unit === 's') t *= 1000;
    else if (unit === 'us') t /= 1000;
    node.actualTimeMs = t;
  }

  // 3. 预估与真实行数 Cardinalities / Rows / Elements: 50000 rows
  const cardMatch = line.match(/(?:Estimated\s+Cardinalities|Cardinalities):\s*([\d,]+)(?:,\s*([\d,]+))?/i);
  if (cardMatch) {
    const r1 = parseInt(cardMatch[1].replace(/,/g, ''), 10);
    const r2 = cardMatch[2] ? parseInt(cardMatch[2].replace(/,/g, ''), 10) : undefined;
    if (r2 !== undefined) {
      node.inputRows = r1;
      node.outputRows = r2;
    } else {
      node.outputRows = r1;
    }
  }

  const rowsMatch = line.match(/(?:Elements|Rows|Count):\s*([\d,]+)/i);
  if (rowsMatch && node.outputRows === undefined) {
    node.outputRows = parseInt(rowsMatch[1].replace(/,/g, ''), 10);
  }

  // 4. 下推过滤谓词 (Filters: ...)
  const filterMatch = line.match(/Filters?:\s*(.+)/i);
  if (filterMatch) {
    const f = filterMatch[1].trim();
    if (f && !node.filterConditions.includes(f)) {
      node.filterConditions.push(f);
    }
  }

  // 5. 连接条件与类型 (Join Condition / Hash Cond: ...)
  const joinMatch = line.match(/(?:Join\s+Condition|Hash\s+Cond|Condition):\s*(.+)/i);
  if (joinMatch) {
    node.joinCondition = joinMatch[1].trim();
  }

  // 6. 目标表 (Table / Source: ...)
  const tblMatch = line.match(/(?:Table|Source|Relation):\s*([a-zA-Z0-9_".-]+)/i);
  if (tblMatch) {
    node.tableName = tblMatch[1].replace(/["']/g, '');
  }

  // 7. 投影字段 (Projections: ...)
  const projMatch = line.match(/Projections?:\s*(.+)/i);
  if (projMatch) {
    node.projections = projMatch[1].split(',').map(s => s.trim()).filter(Boolean);
  }

  // 8. 分组键 (Groups / Group By: ...)
  const groupMatch = line.match(/(?:Groups?|Group\s+By):\s*(.+)/i);
  if (groupMatch) {
    node.groupByKeys = groupMatch[1].split(',').map(s => s.trim()).filter(Boolean);
  }
}

/**
 * 解析纯文本缩进树格式的 DuckDB 执行计划
 */
function parseIndentedTextPlan(
  lines: string[],
  rootList: RawParsedOperator[],
  genId: () => string
) {
  const stack: { node: RawParsedOperator; indent: number }[] = [];

  for (const rawLine of lines) {
    if (!rawLine.trim()) continue;

    const indent = rawLine.search(/\S|$/);
    const content = rawLine.trim();

    // 过滤树形连线符号
    const cleanContent = content.replace(/^[│├║╠╣╬└┘─┌┬─\s]+/, '').trim();
    if (!cleanContent) continue;

    const node: RawParsedOperator = {
      id: genId(),
      name: cleanContent,
      category: classifyOperator(cleanContent),
      depth: Math.floor(indent / 2),
      filterConditions: [],
      projections: [],
      groupByKeys: [],
      costPercent: 0,
      rawLines: [cleanContent],
      children: [],
    };

    parseLineAttributes(cleanContent, node);

    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    if (stack.length > 0) {
      stack[stack.length - 1].node.children.push(node);
    } else {
      rootList.push(node);
    }

    stack.push({ node, indent });
  }
}

/**
 * 标注各算子耗时占比与执行瓶颈
 */
function annotateCostDistribution(rootNodes: RawParsedOperator[]) {
  const allNodes: RawParsedOperator[] = [];
  function collect(node: RawParsedOperator) {
    allNodes.push(node);
    node.children.forEach(collect);
  }
  rootNodes.forEach(collect);

  if (allNodes.length === 0) return;

  const totalTime = allNodes.reduce((sum, n) => sum + (n.actualTimeMs || 0), 0);

  allNodes.forEach(n => {
    if (n.actualTimeMs && totalTime > 0) {
      n.costPercent = Math.min(100, Math.round((n.actualTimeMs / totalTime) * 100));
    }
    // 耗时占比超过 30% 或为 Join/Scan 消耗大户时标为瓶颈
    if (n.costPercent >= 30 || (n.category === 'join' && n.costPercent >= 20)) {
      n.isBottleneck = true;
    }
  });

  // 若无具体时间但有单一最大开销，高亮之
  if (!allNodes.some(n => n.isBottleneck)) {
    const maxCost = [...allNodes].sort((a, b) => (b.costPercent || 0) - (a.costPercent || 0))[0];
    if (maxCost && maxCost.costPercent > 20) {
      maxCost.isBottleneck = true;
    }
  }
}

// ============================================================
// 3. 构建顺向真实数据流 DAG (Forward Execution Workflow)
// ============================================================

export interface BuildExecutionWorkflowOptions {
  sql: string;
  planText?: string;
  queryResult?: any;
  executionError?: string | null;
  tabTitle?: string;
  direction?: 'LR' | 'TB';
}

export interface ExecutionWorkflowResult {
  nodes: DataFlowNode[];
  edges: DataFlowEdge[];
  faultyNodeId: string | null;
  totalOperators: number;
  totalExecutionTimeMs: number;
  traceableSourceIds: string[];
  resultNodeId: string | null;
}

/**
 * 清洗并规范化物理算子树：
 * 1. 消除 DuckDB 内部生成的冗余中间算子（PROJECTION、SIMPLE_PROJECTION、EXPRESSION_EXECUTOR 等无语义穿透节点）
 * 2. 避免无意义的单列投影成为独立卡片，将投影信息与耗时向上/向下折叠
 * 3. 合并相邻的 SORT (ORDER_BY / TOP_N) 与 LIMIT (STREAMING_LIMIT) 为单一易懂步骤
 * 4. 消除内部优化器伪算子 (DELIM_SCAN, EMPTY_RESULT, CHUNK_SCAN 内部空节点)
 * 5. 确保仅存在单一清晰的顶层 RESULT (最终物化结果) 节点，消除重复与无用 collectors
 */
export function pruneAndNormalizeOperatorTree(rootList: RawParsedOperator[]): RawParsedOperator[] {
  function cleanNode(op: RawParsedOperator, isRoot: boolean): RawParsedOperator[] {
    // 1. 递归清洗所有子节点
    const cleanedChildren: RawParsedOperator[] = [];
    for (const child of op.children) {
      cleanedChildren.push(...cleanNode(child, false));
    }
    op.children = cleanedChildren;

    const norm = op.name.toLowerCase().replace(/[\s-]+/g, '_');

    // 2. 过滤内部优化器伪算子 (如 EMPTY_RESULT, 或没有表名的 DELIM_SCAN)
    if (norm.includes('empty_result') || (norm.includes('delim_scan') && !op.tableName)) {
      return op.children;
    }

    // 3. 消除冗余 PROJECTION / SIMPLE_PROJECTION / EXPRESSION_EXECUTOR
    if (op.category === 'projection') {
      // 若有且仅有 1 个子算子，直接旁路穿透，将投影字段与耗时折叠给子算子
      if (op.children.length === 1) {
        const child = op.children[0];
        if (op.projections.length > 0) {
          child.projections = Array.from(new Set([...child.projections, ...op.projections]));
        }
        if (op.actualTimeMs) {
          child.actualTimeMs = Number(((child.actualTimeMs || 0) + op.actualTimeMs).toFixed(3));
        }
        if (op.rawLines.length > 0) {
          child.rawLines.push(...op.rawLines);
        }
        return [child];
      }
      // 若作为顶层根节点且有子节点，直接穿透
      if (isRoot && op.children.length > 0) {
        return op.children;
      }
      // 若为叶子且无表名（例如纯计算 SELECT 42），转为 scan 算子
      if (op.children.length === 0) {
        op.category = 'scan';
        op.name = 'SCAN (计算表达式)';
        return [op];
      }
    }

    // 4. 合并相邻的 SORT (ORDER_BY / TOP_N) 与 LIMIT (STREAMING_LIMIT)
    if (op.category === 'sort') {
      const isLimitOp = norm.includes('limit');
      if (isLimitOp && op.children.length === 1 && op.children[0].category === 'sort') {
        const sortChild = op.children[0];
        sortChild.name = 'SORT & LIMIT';
        if (op.actualTimeMs) {
          sortChild.actualTimeMs = Number(((sortChild.actualTimeMs || 0) + op.actualTimeMs).toFixed(3));
        }
        sortChild.rawLines.push(...op.rawLines);
        return [sortChild];
      }
    }

    // 5. 顶层 RESULT_COLLECTOR 规范化
    if (op.category === 'result' && isRoot) {
      op.name = 'RESULT';
    }

    return [op];
  }

  const result: RawParsedOperator[] = [];
  for (const root of rootList) {
    result.push(...cleanNode(root, true));
  }

  return result.length > 0 ? result : rootList;
}

/**
 * 核心方法：将真实 DuckDB 物理执行计划转换为数据流 DAG
 *
 * 数据库物理执行计划是自底向上的树（Parent 消费 Child 的数据）。
 * 在数据流中，真实物理流向是：
 * SCAN (底层表扫描) → FILTER (初筛) → JOIN (连接) → AGGREGATE (聚合) → SORT (排序) → RESULT (输出)
 */
export function buildRealExecutionWorkflow(
  options: BuildExecutionWorkflowOptions
): ExecutionWorkflowResult {
  const { sql, planText, queryResult, executionError, tabTitle, direction = 'LR' } = options;

  let rawOperators: RawParsedOperator[] = [];

  if (planText && planText.trim()) {
    rawOperators = parseDuckDbExplainPlan(planText);
  }

  // 若无 EXPLAIN 输出（例如语法解析失败），基于 SQL 进行确定性推演构建
  if (rawOperators.length === 0) {
    rawOperators = synthesizeOperatorsFromSql(sql, tabTitle);
  }

  // 关键：清洗并规范化算子树，消除所有 PROJECTION 穿透节点与冗余伪算子
  const cleanedOperators = pruneAndNormalizeOperatorTree(rawOperators);

  // 展平并分配自底向上时序与数据流连线
  const { nodes, edges, traceableSourceIds, resultNodeId } = convertOperatorsToDataFlow(
    cleanedOperators,
    sql,
    queryResult
  );

  // 诊断并定位异常节点
  let faultyNodeId: string | null = null;
  if (executionError) {
    faultyNodeId = locateAndDecorateErrorNode(nodes, edges, executionError, sql);
  }

  // 应用 Dagre 拓扑分层布局（确保无节点重叠，统一方向）
  applyDagreHierarchicalLayout(nodes, edges, direction);

  const totalTime = nodes.reduce((sum, n) => sum + (n.data.executionTimeSec ? n.data.executionTimeSec * 1000 : 0), 0);

  return {
    nodes,
    edges,
    faultyNodeId,
    totalOperators: nodes.length,
    totalExecutionTimeMs: Number(totalTime.toFixed(2)),
    traceableSourceIds,
    resultNodeId,
  };
}

/**
 * 将算子树转化为 React Flow 节点与顺向连线
 */
function convertOperatorsToDataFlow(
  rootOperators: RawParsedOperator[],
  originalSql: string,
  queryResult?: any
): {
  nodes: DataFlowNode[];
  edges: DataFlowEdge[];
  traceableSourceIds: string[];
  resultNodeId: string | null;
} {
  const nodes: DataFlowNode[] = [];
  const edges: DataFlowEdge[] = [];
  const traceableSourceIds: string[] = [];
  let resultNodeId: string | null = null;

  // 拓扑时序步骤计数器
  let stepIndex = 1;
  const operatorToNodeId = new Map<string, string>();

  // 递归遍历算子树
  function traverse(op: RawParsedOperator, parentOp?: RawParsedOperator) {
    // 递归处理子算子（子算子为上游数据来源）
    for (const child of op.children) {
      traverse(child, op);
    }

    const nodeId = `df_${op.id}`;
    operatorToNodeId.set(op.id, nodeId);

    const nodeType = mapCategoryToNodeType(op.category);
    const stage = mapCategoryToStage(op.category);
    const paradigm = getSqlParadigm(stage);

    const isSource = nodeType === 'source';
    const isResult = nodeType === 'result';

    if (isSource) {
      traceableSourceIds.push(nodeId);
    }
    if (isResult || (!resultNodeId && op.category === 'result')) {
      resultNodeId = nodeId;
    }

    // 格式化呈现标题与关键信息
    const { title, subtitle, predicate } = formatNodeDisplay(op);

    // 映射对应 SQL 代码片段
    const { snippet, range } = extractSqlClauseForOperator(op, originalSql);

    const outRows = op.outputRows !== undefined ? op.outputRows : (isResult && queryResult?.rows ? queryResult.rows.length : undefined);
    const inRows = op.inputRows;
    const filterRatio = inRows && outRows && inRows > outRows ? Math.round(((inRows - outRows) / inRows) * 100) : undefined;

    const nodeData: DataFlowNodeData = {
      id: nodeId,
      type: nodeType,
      title,
      subtitle,
      status: 'success',
      stepIndex: stepIndex++,
      sqlStage: stage,
      paradigm,
      executionTimeSec: op.actualTimeMs ? Number((op.actualTimeMs / 1000).toFixed(4)) : undefined,
      rowCount: outRows,
      inputRowCount: inRows,
      filterRatio,
      predicate,
      joinSummary: op.joinCondition,
      groupBySummary: op.groupByKeys.length > 0 ? op.groupByKeys.join(', ') : undefined,
      clauseSnippet: snippet,
      sqlSnippet: snippet,
      sqlRange: range,
      tableName: op.tableName,
      format: isSource ? (op.tableName?.endsWith('.parquet') ? 'PARQUET' : op.tableName?.endsWith('.csv') ? 'CSV' : 'TABLE') : undefined,
      isRealDuckDB: true,
      hasAnomaly: false,
      config: {
        operatorName: op.name,
        costPercent: op.costPercent,
        isBottleneck: op.isBottleneck,
        rawAnnotations: op.rawLines,
        projections: op.projections,
        filterConditions: op.filterConditions,
      },
    };

    nodes.push({
      id: nodeId,
      type: 'dataFlowNode',
      position: { x: 0, y: 0 },
      data: nodeData,
    });

    // 建立上游 (Child) → 下游 (Op) 的顺向连线
    for (let cIdx = 0; cIdx < op.children.length; cIdx++) {
      const child = op.children[cIdx];
      const sourceNodeId = operatorToNodeId.get(child.id);
      if (!sourceNodeId) continue;

      const edgeId = `edge_${sourceNodeId}_to_${nodeId}`;
      const isJoinTarget = nodeType === 'join';
      const joinSide = isJoinTarget ? (cIdx === 0 ? 'left' : 'right') : undefined;

      edges.push({
        id: edgeId,
        source: sourceNodeId,
        target: nodeId,
        sourceHandle: 'output',
        targetHandle: isJoinTarget ? (cIdx === 0 ? 'left' : 'right') : 'input',
        type: 'dataFlowEdge',
        animated: true,
        data: {
          relationType: isJoinTarget ? 'join' : (op.category === 'filter' ? 'filter' : 'data'),
          joinSide,
          rowCount: child.outputRows,
          label: isJoinTarget ? (cIdx === 0 ? '左表输入' : '右表探查') : undefined,
        },
      });
    }
  }

  // 逆向自底向上遍历每个根算子
  for (const root of rootOperators) {
    traverse(root);
  }

  // 若未产生显式 Result 节点，且最后有顶层产出算子，自动添加最终结果节点
  if (!resultNodeId && nodes.length > 0) {
    const lastNode = nodes[nodes.length - 1];
    const finalResultId = 'df_final_result';
    resultNodeId = finalResultId;

    const resultRows = queryResult?.rows ? queryResult.rows.length : (lastNode.data.rowCount ?? 0);

    nodes.push({
      id: finalResultId,
      type: 'dataFlowNode',
      position: { x: 0, y: 0 },
      data: {
        id: finalResultId,
        type: 'result',
        title: '最终查询结果',
        subtitle: 'RESULT COLLECTOR',
        status: 'success',
        stepIndex: stepIndex++,
        sqlStage: 'select',
        paradigm: getSqlParadigm('select'),
        rowCount: resultRows,
        columnCount: queryResult?.columns?.length,
        isRealDuckDB: true,
        clauseSnippet: 'SELECT ... [Result Set]',
        config: { limit: 100 },
      },
    });

    edges.push({
      id: `edge_${lastNode.id}_to_${finalResultId}`,
      source: lastNode.id,
      target: finalResultId,
      sourceHandle: 'output',
      targetHandle: 'input',
      type: 'dataFlowEdge',
      animated: true,
      data: {
        relationType: 'data',
        rowCount: resultRows,
      },
    });
  }

  return { nodes, edges, traceableSourceIds, resultNodeId };
}

// ============================================================
// 4. 辅助转换器与上下文格式化
// ============================================================

function mapCategoryToNodeType(category: OperatorCategory): WorkflowNodeType {
  switch (category) {
    case 'scan': return 'source';
    case 'filter': return 'schema';
    case 'join': return 'join';
    case 'aggregate': return 'aggregate';
    case 'result': return 'result';
    case 'sort':
    case 'projection':
    case 'window':
    default:
      return 'sql_transform';
  }
}

function mapCategoryToStage(category: OperatorCategory): SqlExecutionStage {
  switch (category) {
    case 'scan': return 'from';
    case 'filter': return 'where';
    case 'join': return 'join';
    case 'aggregate': return 'groupby';
    case 'sort': return 'orderby';
    case 'result':
    case 'projection':
    case 'window':
    default:
      return 'select';
  }
}

function formatNodeDisplay(op: RawParsedOperator): {
  title: string;
  subtitle: string;
  predicate?: string;
} {
  const normName = op.name.toUpperCase();
  let title = op.name;
  let subtitle = normName;
  let predicate: string | undefined;

  switch (op.category) {
    case 'scan':
      title = op.tableName ? `SCAN ${op.tableName}` : 'SCAN (表扫描)';
      subtitle = normName;
      if (op.filterConditions.length > 0) {
        predicate = `下推过滤: ${op.filterConditions.join(' AND ')}`;
      } else if (op.tableName) {
        predicate = `物理表: ${op.tableName}`;
      }
      break;

    case 'filter':
      title = 'FILTER (行级初筛)';
      subtitle = 'FILTER';
      predicate = op.filterConditions.length > 0 ? `where: ${op.filterConditions.join(' AND ')}` : undefined;
      break;

    case 'join':
      title = op.joinType ? `${op.joinType} JOIN` : 'JOIN (多表连接)';
      subtitle = normName;
      predicate = op.joinCondition ? `on: ${op.joinCondition}` : undefined;
      break;

    case 'aggregate':
      title = op.groupByKeys.length > 0 ? `AGGREGATE (${op.groupByKeys.join(', ')})` : 'AGGREGATE (汇总)';
      subtitle = normName;
      predicate = op.groupByKeys.length > 0 ? `group by: ${op.groupByKeys.join(', ')}` : 'scalar aggregate';
      break;

    case 'sort':
      if (normName.includes('LIMIT') && (normName.includes('SORT') || normName.includes('ORDER'))) {
        title = 'SORT & LIMIT (排序截断)';
      } else if (normName.includes('LIMIT')) {
        title = 'LIMIT (结果截断)';
      } else {
        title = 'SORT (结果排序)';
      }
      subtitle = normName;
      break;

    case 'window':
      title = 'WINDOW (开窗分析)';
      subtitle = normName;
      break;

    case 'projection':
      title = '计算表达式';
      subtitle = 'SCALAR EXPRESSION';
      if (op.projections.length > 0) {
        predicate = `产出: ${op.projections.slice(0, 3).join(', ')}${op.projections.length > 3 ? '...' : ''}`;
      }
      break;

    case 'result':
      title = '最终查询结果';
      subtitle = 'RESULT';
      break;

    default:
      title = op.name;
      subtitle = 'PHYSICAL OPERATOR';
      break;
  }

  return { title, subtitle, predicate };
}

/**
 * 从原始 SQL 中提取对应于算子的代码片段与起止行号
 */
function extractSqlClauseForOperator(
  op: RawParsedOperator,
  sql: string
): { snippet?: string; range?: { startLine: number; endLine: number } } {
  if (!sql || !sql.trim()) return {};

  const lines = sql.split(/\r?\n/);

  // 1. Scan / From 匹配表名
  if (op.category === 'scan' && op.tableName) {
    const tableRegex = new RegExp(`\\b(?:FROM|JOIN)\\s+["'\`]?${op.tableName}["'\`]?`, 'i');
    for (let i = 0; i < lines.length; i++) {
      if (tableRegex.test(lines[i])) {
        return { snippet: lines[i].trim(), range: { startLine: i + 1, endLine: i + 1 } };
      }
    }
  }

  // 2. Filter 匹配 WHERE 或 HAVING
  if (op.category === 'filter') {
    for (let i = 0; i < lines.length; i++) {
      if (/\b(?:WHERE|HAVING)\b/i.test(lines[i])) {
        return { snippet: lines[i].trim(), range: { startLine: i + 1, endLine: i + 1 } };
      }
    }
  }

  // 3. Join 匹配 JOIN ... ON
  if (op.category === 'join') {
    for (let i = 0; i < lines.length; i++) {
      if (/\bJOIN\b/i.test(lines[i])) {
        return { snippet: lines[i].trim(), range: { startLine: i + 1, endLine: i + 1 } };
      }
    }
  }

  // 4. Aggregate 匹配 GROUP BY
  if (op.category === 'aggregate') {
    for (let i = 0; i < lines.length; i++) {
      if (/\bGROUP\s+BY\b/i.test(lines[i])) {
        return { snippet: lines[i].trim(), range: { startLine: i + 1, endLine: i + 1 } };
      }
    }
  }

  // 5. Sort 匹配 ORDER BY / LIMIT
  if (op.category === 'sort') {
    for (let i = 0; i < lines.length; i++) {
      if (/\b(?:ORDER\s+BY|LIMIT)\b/i.test(lines[i])) {
        return { snippet: lines[i].trim(), range: { startLine: i + 1, endLine: i + 1 } };
      }
    }
  }

  // 6. Window 匹配 OVER (...) 开窗函数
  if (op.category === 'window') {
    for (let i = 0; i < lines.length; i++) {
      if (/\bOVER\s*\(/i.test(lines[i])) {
        return { snippet: lines[i].trim(), range: { startLine: i + 1, endLine: i + 1 } };
      }
    }
  }

  return {};
}

// ============================================================
// 5. 异常诊断与故障节点智能定位
// ============================================================

function findTokenLineInSql(token: string, sqlText: string): number | null {
  if (!token || !sqlText) return null;
  const lines = sqlText.split(/\r?\n/);
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(?:\\b|["'\`])${escaped}(?:\\b|["'\`])`, 'i');
  for (let i = 0; i < lines.length; i++) {
    if (regex.test(lines[i])) return i + 1;
  }
  return null;
}

/**
 * 当 SQL 执行失败时，根据报错信息在 DAG 节点中精准定位最可能出问题的节点
 */
export function locateAndDecorateErrorNode(
  nodes: DataFlowNode[],
  edges: DataFlowEdge[],
  errorMessage: string,
  sql: string
): string | null {
  if (!errorMessage || nodes.length === 0) return null;

  const errLower = errorMessage.toLowerCase();

  // 1. Catalog Error (表或视图不存在)
  const missingTableMatch =
    errorMessage.match(/Table with name ["']?([^"'\s]+)["']? does not exist/i) ||
    errorMessage.match(/Table ["']?([^"'\s]+)["']? (?:does not|doesn't) exist/i);

  if (missingTableMatch || /catalog error/i.test(errLower)) {
    const missingTable = missingTableMatch ? missingTableMatch[1] : null;
    let target = missingTable
      ? nodes.find(n => n.data.tableName?.toLowerCase() === missingTable.toLowerCase())
      : null;

    if (!target) {
      target = nodes.find(n => n.data.type === 'source');
    }

    if (target) {
      target.data.status = 'error';
      target.data.hasAnomaly = true;
      if (missingTable) {
        const line = findTokenLineInSql(missingTable, sql);
        if (line) {
          target.data.sqlRange = { startLine: line, endLine: line };
        }
      }
      target.data.bugInfo = {
        hasBug: true,
        isRootCause: true,
        severity: 'error',
        title: '数据源表缺失 · Catalog Error',
        detail: missingTable
          ? `数据表 "${missingTable}" 在当前数据库目录中不存在。`
          : errorMessage,
        suggestion: '请检查表名拼写，或先在左侧资源管理器中确认表已被创建或导入。',
        culpritToken: missingTable || undefined,
      };
      return target.id;
    }
  }

  // 2. Group By Violation (未聚合字段违规，优先于通用 Binder Error 捕获)
  if (/must appear in the group by clause/i.test(errLower) || /not in group by/i.test(errLower) || /cannot aggregate/i.test(errLower)) {
    const unaggregatedColMatch = errorMessage.match(/column ["']?([^"'\s]+)["']? must appear/i);
    const unaggregatedCol = unaggregatedColMatch ? unaggregatedColMatch[1] : undefined;
    let target = nodes.find(n => n.data.type === 'aggregate') || nodes.find(n => n.data.sqlStage === 'groupby') || nodes[0];
    if (target) {
      target.data.status = 'error';
      target.data.hasAnomaly = true;
      if (unaggregatedCol) {
        const line = findTokenLineInSql(unaggregatedCol, sql);
        if (line) target.data.sqlRange = { startLine: line, endLine: line };
      }
      target.data.bugInfo = {
        hasBug: true,
        isRootCause: true,
        severity: 'error',
        title: '非聚合列违规 · Group By Violation',
        detail: unaggregatedCol
          ? `字段 "${unaggregatedCol}" 未包含在 GROUP BY 子句中，亦未包裹在聚合函数 (如 SUM/MAX/MIN/FIRST) 内。`
          : errorMessage,
        suggestion: unaggregatedCol
          ? `将 "${unaggregatedCol}" 追加至 GROUP BY 列表中，或对其使用聚合函数包裹（如 ANY_VALUE(${unaggregatedCol})）。`
          : '请检查 SELECT 中的列是否均在 GROUP BY 中声明或包裹了聚合函数。',
        culpritToken: unaggregatedCol,
      };
      return target.id;
    }
  }

  // 2.1 Binder Error (字段未找到 / 列别名不可用)
  const missingColMatch =
    errorMessage.match(/Referenced column ["']?([^"'\s]+)["']? not found/i) ||
    errorMessage.match(/Column ["']?([^"'\s]+)["']? (?:not found|does not exist)/i);

  if (missingColMatch || /binder error/i.test(errLower)) {
    const missingCol = missingColMatch ? missingColMatch[1] : null;
    // 优先匹配 filter 或 transform 或 join 节点
    let target = nodes.find(n => {
      const pred = n.data.predicate || '';
      const snippet = n.data.clauseSnippet || '';
      return missingCol && (pred.includes(missingCol) || snippet.includes(missingCol));
    });

    if (!target) {
      target = nodes.find(n => n.data.type === 'schema' || n.data.type === 'sql_transform') || nodes[0];
    }

    if (target) {
      target.data.status = 'error';
      target.data.hasAnomaly = true;
      if (missingCol) {
        const line = findTokenLineInSql(missingCol, sql);
        if (line) {
          target.data.sqlRange = { startLine: line, endLine: line };
        }
      }
      target.data.bugInfo = {
        hasBug: true,
        isRootCause: true,
        severity: 'error',
        title: '字段未定义 · Binder Error',
        detail: missingCol
          ? `引用的列 "${missingCol}" 在上游数据中不存在。`
          : errorMessage,
        suggestion: '确认字段名称拼写，或检查是否在 WHERE 中错误引用了 SELECT 阶段的别名。',
        culpritToken: missingCol || undefined,
      };
      return target.id;
    }
  }

  // 2.3 Division by zero (除零错误)
  if (/division by zero/i.test(errLower)) {
    let target = nodes.find(n => n.data.type === 'sql_transform' || n.data.type === 'aggregate') || nodes[0];
    if (target) {
      target.data.status = 'error';
      target.data.hasAnomaly = true;
      target.data.bugInfo = {
        hasBug: true,
        isRootCause: true,
        severity: 'error',
        title: '除以零异常 · Division By Zero',
        detail: errorMessage,
        suggestion: '推荐使用 NULLIF(divisor, 0) 防御除零错误，例如: col_a / NULLIF(col_b, 0)。',
      };
      return target.id;
    }
  }

  // 3. Parser / Syntax Error (语法解析错误)
  const lineMatch = errorMessage.match(/LINE\s+(\d+)/i) || errorMessage.match(/line\s+(\d+)/i);
  if (lineMatch || /parser error|syntax error/i.test(errLower)) {
    const lineNum = lineMatch ? parseInt(lineMatch[1], 10) : 1;
    const target = nodes.find(n => n.data.sqlRange && n.data.sqlRange.startLine <= lineNum && n.data.sqlRange.endLine >= lineNum) || nodes[0];
    if (target) {
      target.data.status = 'error';
      target.data.hasAnomaly = true;
      target.data.sqlRange = { startLine: lineNum, endLine: lineNum };
      target.data.bugInfo = {
        hasBug: true,
        isRootCause: true,
        severity: 'error',
        title: 'SQL 语法解析异常 · Syntax Error',
        detail: errorMessage,
        suggestion: `第 ${lineNum} 行附近存在语法错误，请检查关键字拼写、标点符号或括号配对。`,
        culpritToken: lineMatch ? `Line ${lineNum}` : undefined,
      };
      return target.id;
    }
  }

  // 4. Conversion / Cast Error (类型转换错误)
  if (/conversion error|cast error|type mismatch/i.test(errLower)) {
    const target = nodes.find(n => n.data.type === 'sql_transform' || n.data.type === 'schema') || nodes[0];
    if (target) {
      target.data.status = 'error';
      target.data.hasAnomaly = true;
      target.data.bugInfo = {
        hasBug: true,
        isRootCause: true,
        severity: 'error',
        title: '类型转换异常 · Conversion Error',
        detail: errorMessage,
        suggestion: '推荐使用 TRY_CAST() 替换强制 CAST()，或在转换前加 WHERE 过滤脏数据。',
      };
      return target.id;
    }
  }

  // 5. 默认标记第一个算子或唯一源算子
  const fallbackTarget = nodes.find(n => n.data.type !== 'result') || nodes[0];
  if (fallbackTarget) {
    fallbackTarget.data.status = 'error';
    fallbackTarget.data.hasAnomaly = true;
    fallbackTarget.data.bugInfo = {
      hasBug: true,
      isRootCause: true,
      severity: 'error',
      title: '执行异常 · Execution Failure',
      detail: errorMessage,
      suggestion: '请点击节点查看对应 SQL 片段与上下文进行排查。',
    };
    return fallbackTarget.id;
  }

  return null;
}

// ============================================================
// 6. 反向追溯 (Reverse Lineage Traceback)
// ============================================================

/**
 * 从给定目标节点（默认最终结果）递归反向追溯至所有上游源节点
 * 返回所有沿途节点 ID 与连线 ID
 */
export function traceUpstreamLineage(
  nodes: DataFlowNode[],
  edges: DataFlowEdge[],
  targetNodeId: string
): {
  ancestorNodeIds: Set<string>;
  ancestorEdgeIds: Set<string>;
} {
  const ancestorNodeIds = new Set<string>();
  const ancestorEdgeIds = new Set<string>();

  const targetEdgesMap = new Map<string, DataFlowEdge[]>();
  edges.forEach(e => {
    const list = targetEdgesMap.get(e.target) || [];
    list.push(e);
    targetEdgesMap.set(e.target, list);
  });

  function walkUp(currentId: string) {
    ancestorNodeIds.add(currentId);
    const inEdges = targetEdgesMap.get(currentId) || [];
    for (const edge of inEdges) {
      ancestorEdgeIds.add(edge.id);
      if (!ancestorNodeIds.has(edge.source)) {
        walkUp(edge.source);
      }
    }
  }

  walkUp(targetNodeId);

  return { ancestorNodeIds, ancestorEdgeIds };
}

// ============================================================
// 7. Dagre 拓扑分层布局计算
// ============================================================

const NODE_WIDTH = 224;
const NODE_HEIGHT = 74;

function applyDagreHierarchicalLayout(
  nodes: DataFlowNode[],
  edges: DataFlowEdge[],
  direction: 'LR' | 'TB' = 'LR'
) {
  if (nodes.length === 0) return;

  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: direction,
    nodesep: 40,
    ranksep: 70,
    marginx: 40,
    marginy: 40,
  });
  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach(node => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach(edge => {
    g.setEdge(edge.source, edge.target);
  });

  try {
    dagre.layout(g);

    nodes.forEach(node => {
      const pos = g.node(node.id);
      if (pos) {
        node.position = {
          x: Math.round(pos.x - NODE_WIDTH / 2),
          y: Math.round(pos.y - NODE_HEIGHT / 2),
        };
      }
    });
  } catch (e) {
    // 降级使用网格线性排布
    nodes.forEach((node, idx) => {
      node.position = { x: idx * (NODE_WIDTH + 60) + 40, y: 120 };
    });
  }
}

// ============================================================
// 8. 降级：从 SQL 中推导物理步骤（当 EXPLAIN 失败时）
// ============================================================

function synthesizeOperatorsFromSql(sql: string, tabTitle?: string): RawParsedOperator[] {
  const operators: RawParsedOperator[] = [];
  const cleanSql = sql.trim();

  // 1. 提取所有引用的表名
  const tableMatches = cleanSql.matchAll(/\b(?:FROM|JOIN)\s+([a-zA-Z0-9_".-]+)/gi);
  const tables = new Set<string>();
  for (const m of tableMatches) {
    const tbl = m[1].replace(/["'`]/g, '');
    if (!['select', 'where', 'group', 'order'].includes(tbl.toLowerCase())) {
      tables.add(tbl);
    }
  }

  // 构造 Scan 算子
  const scanOps: RawParsedOperator[] = [];
  let counter = 1;

  if (tables.size > 0) {
    for (const tbl of tables) {
      scanOps.push({
        id: `synth_scan_${counter++}`,
        name: `SEQ_SCAN on ${tbl}`,
        category: 'scan',
        depth: 1,
        tableName: tbl,
        filterConditions: [],
        projections: [],
        groupByKeys: [],
        costPercent: 20,
        rawLines: [`Seq Scan on ${tbl}`],
        children: [],
      });
    }
  } else {
    scanOps.push({
      id: `synth_scan_${counter++}`,
      name: 'SCAN (即席表达式)',
      category: 'scan',
      depth: 1,
      filterConditions: [],
      projections: [],
      groupByKeys: [],
      costPercent: 10,
      rawLines: ['Constant Expression Scan'],
      children: [],
    });
  }

  let currentParent: RawParsedOperator = scanOps[0];

  // 2. 是否有 JOIN (多表构建二叉级联 Join 拓扑)
  if (scanOps.length >= 2) {
    let currentJoinParent: RawParsedOperator = scanOps[0];
    for (let i = 1; i < scanOps.length; i++) {
      const rightScan = scanOps[i];
      const joinOp: RawParsedOperator = {
        id: `synth_join_${counter++}`,
        name: i === 1 ? 'HASH_JOIN' : `HASH_JOIN (${rightScan.tableName || 'table'})`,
        category: 'join',
        depth: 2 + i,
        filterConditions: [],
        projections: [],
        groupByKeys: [],
        costPercent: Math.round(40 / (scanOps.length - 1)),
        rawLines: ['Hash Join'],
        children: [currentJoinParent, rightScan],
      };
      currentJoinParent = joinOp;
    }
    currentParent = currentJoinParent;
  }

  // 3. 是否有 WHERE
  const whereMatch = cleanSql.match(/\bWHERE\s+([\s\S]+?)(?:\bGROUP\s+BY|\bORDER\s+BY|\bLIMIT|$)/i);
  if (whereMatch) {
    const filterOp: RawParsedOperator = {
      id: `synth_filter_${counter++}`,
      name: 'FILTER',
      category: 'filter',
      depth: 3,
      filterConditions: [whereMatch[1].trim().slice(0, 100)],
      projections: [],
      groupByKeys: [],
      costPercent: 15,
      rawLines: [`Filter: ${whereMatch[1].trim().slice(0, 80)}`],
      children: [currentParent],
    };
    currentParent = filterOp;
  }

  // 4. 是否有 GROUP BY
  const groupMatch = cleanSql.match(/\bGROUP\s+BY\s+([\s\S]+?)(?:\bHAVING|\bORDER\s+BY|\bLIMIT|$)/i);
  if (groupMatch) {
    const aggOp: RawParsedOperator = {
      id: `synth_agg_${counter++}`,
      name: 'HASH_GROUP_BY',
      category: 'aggregate',
      depth: 4,
      filterConditions: [],
      projections: [],
      groupByKeys: groupMatch[1].split(',').map(s => s.trim()),
      costPercent: 25,
      rawLines: [`Hash Group By [${groupMatch[1].trim()}]`],
      children: [currentParent],
    };
    currentParent = aggOp;
  }

  // 4.5 是否有 WINDOW 函数 (OVER (...))
  if (/\bOVER\s*\(/i.test(cleanSql)) {
    const windowOp: RawParsedOperator = {
      id: `synth_window_${counter++}`,
      name: 'WINDOW (开窗分析)',
      category: 'window',
      depth: 4.5,
      filterConditions: [],
      projections: [],
      groupByKeys: [],
      costPercent: 15,
      rawLines: ['Window Analytic Function (OVER)'],
      children: [currentParent],
    };
    currentParent = windowOp;
  }

  // 5. 是否有 ORDER BY
  const orderMatch = cleanSql.match(/\bORDER\s+BY\s+([\s\S]+?)(?:\bLIMIT|$)/i);
  if (orderMatch) {
    const sortOp: RawParsedOperator = {
      id: `synth_sort_${counter++}`,
      name: 'ORDER_BY',
      category: 'sort',
      depth: 5,
      filterConditions: [],
      projections: [],
      groupByKeys: [],
      costPercent: 10,
      rawLines: [`Order By [${orderMatch[1].trim()}]`],
      children: [currentParent],
    };
    currentParent = sortOp;
  }

  // 6. 顶层 Result
  const resultOp: RawParsedOperator = {
    id: `synth_result_${counter++}`,
    name: 'RESULT_COLLECTOR',
    category: 'result',
    depth: 6,
    filterConditions: [],
    projections: [],
    groupByKeys: [],
    costPercent: 5,
    rawLines: ['Result Collector'],
    children: [currentParent],
  };

  operators.push(resultOp);
  return operators;
}
