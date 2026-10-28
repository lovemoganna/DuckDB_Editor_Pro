/**
 * explainPlanModel.ts — parse DuckDB EXPLAIN text into human-readable step nodes.
 * UI stays dumb; all plan interpretation lives here.
 */
import {
  parseDuckDbExplainPlan,
  type RawParsedOperator,
  type OperatorCategory,
} from '../../services/dataflow/sqlExecutionPlanParser';

export type StepCategory =
  | 'scan'
  | 'join'
  | 'aggregate'
  | 'projection'
  | 'filter'
  | 'order'
  | 'limit'
  | 'other';

export interface PlanStep {
  id: string;
  /** Engine opcode for search / AI / raw */
  name: string;
  humanTitle: string;
  /** One short fact line — prefer conditions/tables over jargon */
  humanSummary: string;
  rawLine: string;
  rawLines?: string[];
  category: StepCategory;
  depth: number;
  costPercent?: number;
  isBottleneck?: boolean;
  hasRealCost: boolean;
  actualTimeMs?: number;
  tableName?: string;
  joinCondition?: string;
  pushdownFilters?: string[];
  projectionColumns?: string[];
  inputRows?: number;
  outputRows?: number;
  children: PlanStep[];
}

const ERROR_PREFIXES = [
  '执行计划解析异常',
  'Error explaining query',
  '刷新执行计划失败',
];

export function isErrorPlanText(text: string): boolean {
  const t = text.trim();
  return ERROR_PREFIXES.some(p => t.startsWith(p));
}

export function extractPlanError(planText: string): string | null {
  if (!planText || !isErrorPlanText(planText)) return null;
  return (
    planText.replace(/^(执行计划解析异常:\s*|Error explaining query:\s*)/i, '').trim() || planText
  );
}

function isAttributeOnlyName(name: string): boolean {
  return /^(EC:|Cost:|Elements:|Estimated\s+Cardinalities|Actual\s+time|Cumulative\s+time|Filters?:|Condition:|Projections?:|Join\s+Type)/i.test(
    name.trim()
  );
}

function mapCategory(cat: OperatorCategory): StepCategory {
  if (cat === 'sort') return 'order';
  if (cat === 'result' || cat === 'window') return 'other';
  return cat;
}

function mergeAttributeSiblings(nodes: RawParsedOperator[]): RawParsedOperator[] {
  const out: RawParsedOperator[] = [];
  for (const n of nodes) {
    const cleanedChildren = mergeAttributeSiblings(n.children);
    if (isAttributeOnlyName(n.name) && out.length > 0) {
      const prev = out[out.length - 1];
      prev.rawLines.push(...n.rawLines);
      if (n.costPercent > 0) prev.costPercent = n.costPercent;
      if (n.estimatedCost != null) prev.estimatedCost = n.estimatedCost;
      if (n.actualTimeMs != null) prev.actualTimeMs = n.actualTimeMs;
      if (n.outputRows != null) prev.outputRows = n.outputRows;
      if (n.inputRows != null) prev.inputRows = n.inputRows;
      if (n.estimatedRows != null) prev.estimatedRows = n.estimatedRows;
      if (n.filterConditions.length) {
        prev.filterConditions = [...new Set([...prev.filterConditions, ...n.filterConditions])];
      }
      if (n.joinCondition) prev.joinCondition = n.joinCondition;
      if (n.joinType) prev.joinType = n.joinType;
      if (n.tableName) prev.tableName = n.tableName;
      if (n.isBottleneck) prev.isBottleneck = true;
      prev.children = [...prev.children, ...cleanedChildren];
      continue;
    }
    out.push({ ...n, children: cleanedChildren });
  }
  return out;
}

function extractOperatorName(rawName: string): string {
  const cleaned = rawName.replace(/\s+/g, ' ').trim();
  const token = cleaned.split(/[\s(\[]/)[0]?.toUpperCase().replace(/[^A-Z0-9_]/g, '') ?? '';
  if (token && token.length >= 2 && !/^(ON|AND|OR|AS)$/.test(token)) return token;
  const readable = cleaned.match(/^([A-Za-z][A-Za-z0-9_\s]+?)(?:\s+(?:on|ON)\s+|\s*[\[(]|$)/);
  if (readable?.[1]) {
    return readable[1].trim().replace(/\s+/g, '_').toUpperCase().replace(/[^A-Z0-9_]/g, '');
  }
  return cleaned.slice(0, 48);
}

function inferTableName(rawName: string, category: StepCategory, existing?: string): string | undefined {
  if (existing) return existing;
  if (category !== 'scan') return undefined;
  const onMatch = rawName.match(/\bon\s+([a-zA-Z0-9_".-]+)/i);
  if (onMatch) return onMatch[1].replace(/["']/g, '');
  const parts = rawName.trim().split(/\s+/);
  if (parts.length >= 2 && /SCAN/i.test(parts[0])) {
    const last = parts[parts.length - 1].replace(/["'`[\],]/g, '');
    if (last && !/^(ON|SCAN|SEQ_SCAN|TABLE_SCAN)$/i.test(last)) return last;
  }
  return undefined;
}

function inferJoinType(rawName: string, existing?: string): string | undefined {
  if (existing) return existing;
  return rawName.match(/\b(INNER|LEFT|RIGHT|FULL|CROSS|SEMI|ANTI)\b/i)?.[1]?.toUpperCase();
}

function joinTypeLabel(jt?: string): string {
  switch ((jt || '').toUpperCase()) {
    case 'INNER': return '内连接';
    case 'LEFT': return '左连接';
    case 'RIGHT': return '右连接';
    case 'FULL': return '全连接';
    case 'CROSS': return '交叉连接';
    case 'SEMI': return '半连接';
    case 'ANTI': return '反连接';
    default: return '连接';
  }
}

function truncatePlain(text: string, max = 64): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function formatRowCount(n?: number): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  return n.toLocaleString('zh-CN');
}

function techTitleHint(techName: string, category: StepCategory): string {
  const n = techName.toUpperCase();
  if (n.includes('SEQ_SCAN') || n === 'TABLE_SCAN') return '全表读取';
  if (n.includes('INDEX_SCAN')) return '索引读取';
  if (n.includes('PARQUET')) return '读取 Parquet';
  if (n.includes('CSV')) return '读取 CSV';
  if (n.includes('HASH_JOIN')) return '哈希连接';
  if (n.includes('FILTER')) return '行过滤';
  if (n.includes('HASH_GROUP') || n.includes('AGGREGATE') || n.includes('GROUP_BY')) return '分组汇总';
  if (n.includes('PROJECTION')) return '整理输出列';
  if (n.includes('ORDER') || n.includes('SORT') || n.includes('TOP_N')) return '排序';
  if (n.includes('LIMIT')) return '截取前几行';
  switch (category) {
    case 'scan': return '读取数据';
    case 'join': return '表连接';
    case 'filter': return '过滤';
    case 'aggregate': return '汇总';
    case 'projection': return '整理列';
    case 'order': return '排序';
    case 'limit': return '截取行数';
    default: return '处理步骤';
  }
}

function buildHumanCopy(input: {
  techName: string;
  category: StepCategory;
  tableName?: string;
  joinCondition?: string;
  joinType?: string;
  pushdownFilters?: string[];
  projectionColumns?: string[];
  inputRows?: number;
  outputRows?: number;
}): { humanTitle: string; humanSummary: string } {
  const {
    techName,
    category,
    tableName,
    joinCondition,
    joinType,
    pushdownFilters,
    projectionColumns,
    outputRows,
  } = input;
  const filterText = pushdownFilters?.length ? pushdownFilters.join(' 且 ') : null;
  const cols = projectionColumns?.length
    ? projectionColumns.slice(0, 4).join('、') + (projectionColumns.length > 4 ? '…' : '')
    : null;
  const outRows = formatRowCount(outputRows);

  switch (category) {
    case 'scan':
      return {
        humanTitle: tableName ? `读取「${tableName}」` : techTitleHint(techName, category),
        humanSummary: [
          /INDEX_SCAN/i.test(techName) ? '索引扫描' : '顺序扫描',
          filterText ? `过滤 ${truncatePlain(filterText, 40)}` : null,
          outRows ? `${outRows} 行` : null,
        ]
          .filter(Boolean)
          .join(' · '),
      };
    case 'join':
      return {
        humanTitle: `${joinTypeLabel(joinType)}两路数据`,
        humanSummary: joinCondition
          ? truncatePlain(joinCondition, 56)
          : '合并上下两路中间结果',
      };
    case 'filter':
      return {
        humanTitle: '过滤行',
        humanSummary: filterText ? truncatePlain(filterText, 56) : '按条件丢弃部分行',
      };
    case 'aggregate':
      return {
        humanTitle: '分组汇总',
        humanSummary: cols || '计算合计 / 计数等',
      };
    case 'projection':
      return {
        humanTitle: '整理要输出的列',
        humanSummary: cols || '选择或计算返回字段',
      };
    case 'order':
      return { humanTitle: '排序', humanSummary: outRows ? `约 ${outRows} 行` : '调整行顺序' };
    case 'limit':
      return { humanTitle: '截取前几行', humanSummary: outRows ? `保留约 ${outRows} 行` : '限制返回行数' };
    default:
      return {
        humanTitle: techTitleHint(techName, category),
        humanSummary: tableName ? `「${tableName}」` : filterText ? truncatePlain(filterText, 56) : '',
      };
  }
}

function toUiNode(raw: RawParsedOperator, depth: number): PlanStep {
  const hasRealCost =
    (raw.costPercent != null && raw.costPercent > 0) ||
    raw.actualTimeMs != null ||
    raw.estimatedCost != null;
  const category = mapCategory(raw.category);
  const techName = extractOperatorName(raw.name);
  const tableName = inferTableName(raw.name, category, raw.tableName);
  const joinType = inferJoinType(raw.name, raw.joinType);
  const pushdownFilters = raw.filterConditions.length ? raw.filterConditions : undefined;
  const projectionColumns = raw.projections.length ? raw.projections : undefined;
  const { humanTitle, humanSummary } = buildHumanCopy({
    techName,
    category,
    tableName,
    joinCondition: raw.joinCondition,
    joinType,
    pushdownFilters,
    projectionColumns,
    inputRows: raw.inputRows,
    outputRows: raw.outputRows,
  });

  return {
    id: raw.id,
    name: techName,
    humanTitle,
    humanSummary,
    rawLine: raw.rawLines.join(' · ') || raw.name,
    rawLines: raw.rawLines?.length ? raw.rawLines : [raw.rawLines.join(' · ') || raw.name],
    category,
    depth,
    costPercent: hasRealCost && raw.costPercent > 0 ? Math.min(100, Math.round(raw.costPercent)) : undefined,
    hasRealCost,
    isBottleneck: Boolean(raw.isBottleneck && hasRealCost),
    actualTimeMs: raw.actualTimeMs,
    tableName,
    joinCondition: raw.joinCondition,
    pushdownFilters,
    projectionColumns,
    inputRows: raw.inputRows,
    outputRows: raw.outputRows,
    children: raw.children.map(c => toUiNode(c, depth + 1)),
  };
}

export function parsePlanSteps(planText: string): PlanStep[] {
  if (!planText || !planText.trim() || planText.trim() === 'physical_plan') return [];
  if (isErrorPlanText(planText)) return [];
  return mergeAttributeSiblings(parseDuckDbExplainPlan(planText))
    .filter(r => !isAttributeOnlyName(r.name))
    .map(r => toUiNode(r, 0));
}

export function flattenSteps(nodes: PlanStep[]): PlanStep[] {
  const out: PlanStep[] = [];
  const walk = (list: PlanStep[]) => {
    for (const n of list) {
      out.push(n);
      walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

export function collectTables(nodes: PlanStep[]): string[] {
  const set = new Set<string>();
  for (const n of flattenSteps(nodes)) {
    if (n.tableName) set.add(n.tableName);
  }
  return [...set];
}

export function findBottleneck(nodes: PlanStep[]): PlanStep | null {
  const marked = flattenSteps(nodes).filter(n => n.isBottleneck);
  if (marked.length === 0) return null;
  return marked.reduce((a, b) => ((a.costPercent ?? 0) >= (b.costPercent ?? 0) ? a : b));
}

export function normalizeExplainSql(sql?: string): string {
  let s = (sql || '').trim().replace(/;+\s*$/g, '').trim();
  while (/^EXPLAIN\s+/i.test(s)) {
    s = s.replace(/^EXPLAIN\s+(?:ANALYZE\s+)?/i, '').trim();
  }
  return s;
}

export function categoryLabel(cat: StepCategory): string {
  switch (cat) {
    case 'scan': return '读表';
    case 'join': return '连接';
    case 'aggregate': return '汇总';
    case 'projection': return '选列';
    case 'filter': return '过滤';
    case 'order': return '排序';
    case 'limit': return '截取';
    default: return '其他';
  }
}

export const DUCKDB_OPERATOR_EXPLANATIONS: Record<string, { title: string; desc: string }> = {
  SEQ_SCAN: {
    title: '全表顺序扫描',
    desc: '从底层存储逐块读取整张表的所有数据。若表很大且耗时高，建议检查 WHERE 条件是否支持索引或谓词下推。',
  },
  TABLE_SCAN: {
    title: '物理表扫描',
    desc: '从物理数据表顺序读取数据块。',
  },
  INDEX_SCAN: {
    title: 'ART 索引快速扫描',
    desc: '利用 DuckDB 的自适应基数树（ART）索引快速检索目标行，大幅减少数据扫描量。',
  },
  PARQUET_SCAN: {
    title: 'Parquet 列式读取',
    desc: '直接从 Parquet 文件中按列式读取，利用元数据跳过无关数据页（Zone Map 剪裁），并仅读取涉及的列。',
  },
  CSV_SCAN: {
    title: 'CSV 文件多线程扫描',
    desc: '对 CSV 文本进行多线程切分并解析转换为二进制向量。',
  },
  COLUMN_DATA_SCAN: {
    title: '列内存扫描',
    desc: '扫描 DuckDB 内存中的中间列数据块。',
  },
  CHUNK_SCAN: {
    title: '数据块扫描',
    desc: '扫描内存中的临时数据块（DataChunk）。',
  },
  DELIM_SCAN: {
    title: '去重中间结果扫描',
    desc: '在关联子查询（Correlated Subquery）解关联时，用于读取去重后的参数集。',
  },
  FILTER: {
    title: '谓词行过滤',
    desc: '计算 WHERE 或 HAVING 过滤表达式，不符合条件的行将被立即丢弃，减少后续计算量。',
  },
  HASH_JOIN: {
    title: '哈希连接',
    desc: '以右侧分支数据在内存构建哈希表（Build），再流式遍历左侧分支（Probe）进行匹配。等值关联（ON a.id = b.id）的标准高效算法。',
  },
  MERGE_JOIN: {
    title: '归并连接',
    desc: '要求两路输入已按关联键排好序，双指针线性归并匹配，适合大排序数据集。',
  },
  BLOCKWISE_NL_JOIN: {
    title: '分块嵌套循环连接',
    desc: '当关联条件不是简单的等值或不等式时，采用双重分块循环比对，计算量较大。',
  },
  NESTED_LOOP: {
    title: '嵌套循环连接',
    desc: '逐行进行双层循环比对，常用于笛卡尔积或复杂不等式连接。',
  },
  CROSS_PRODUCT: {
    title: '笛卡尔交叉积',
    desc: '两表无关联条件直接做全组合乘积（M × N 行），数据量易膨胀。',
  },
  IEJOIN: {
    title: '不等式连接 (Inequality Join)',
    desc: '专用于带有两组不等式范围条件（如 A.time < B.time AND A.val > B.val）的高性能连接算法。',
  },
  ASOF_JOIN: {
    title: '时序 ASOF 连接',
    desc: '用于时序或金融数据，在时间戳最接近的记录之间建立对齐连接。',
  },
  DELIM_JOIN: {
    title: '解关联连接',
    desc: '优化器将复杂的相关子查询改写为去重驱动的独立连接。',
  },
  HASH_GROUP_BY: {
    title: '哈希分组聚合',
    desc: '根据 GROUP BY 字段将行哈希分流到不同的桶中，并计算聚合函数（SUM、COUNT、AVG 等）。',
  },
  PERFECT_HASH_GROUP_BY: {
    title: '完美哈希分组聚合',
    desc: '当分组键范围较小且密集（如连续小整数或枚举）时，直接用数组寻址替代哈希运算，性能极高。',
  },
  UNGROUPED_AGGREGATE: {
    title: '全局无分组聚合',
    desc: '整张表计算单个合计值（如无 GROUP BY 的 COUNT(*) 或 SUM(x)）。',
  },
  HASH_DISTINCT: {
    title: '哈希去重',
    desc: '使用哈希表识别并过滤重复记录（DISTINCT）。',
  },
  ORDER_BY: {
    title: '全局排序',
    desc: '按 ORDER BY 指定的列对所有数据进行排序。当内存不足时可能会触发磁盘溢出（External Sort）。',
  },
  TOP_N: {
    title: 'Top-N 堆排序',
    desc: '配合 LIMIT 执行的优化排序，仅在内存中维护前 N 个极值，不需要对全量数据做完整排序。',
  },
  LIMIT: {
    title: '截取行数',
    desc: '获取指定数量的行后立即停止向上游拉取数据（Early Out）。',
  },
  STREAMING_LIMIT: {
    title: '流式截取行数',
    desc: '流式透传并在达到行数上限后快速终止执行。',
  },
  PROJECTION: {
    title: '字段表达式计算与投影',
    desc: '计算 SELECT 后面的列、重命名别名、函数表达式或数据类型转换。',
  },
  RESULT_COLLECTOR: {
    title: '查询结果收集器',
    desc: '物理流水线的最顶层，将引擎内部处理好的向量结果汇总成最终数据表格输出给前端。',
  },
  WINDOW: {
    title: '窗口函数计算',
    desc: '执行 OVER (PARTITION BY ... ORDER BY ...) 窗口分析计算。',
  },
  STREAMING_WINDOW: {
    title: '流式窗口函数',
    desc: '内存友好的流式窗口分析计算。',
  },
};

export function getOperatorExplanation(name: string): { title: string; desc: string } | null {
  const norm = name.toUpperCase().replace(/[\s-]+/g, '_');
  for (const [key, val] of Object.entries(DUCKDB_OPERATOR_EXPLANATIONS)) {
    if (norm.includes(key)) return val;
  }
  return null;
}

