/**
 * components/ExecutionPlan/model/operatorRegistry.ts
 *
 * Unified DuckDB Operator Registry.
 * Maintains canonical physical operator definitions, friendly Chinese descriptions,
 * categories, and fallback mechanisms for unknown operators.
 */

import { OperatorCategory } from './types';

export interface OperatorRegistryEntry {
  name: string;
  displayName: string;
  chineseName: string;
  category: OperatorCategory;
  summary: string;
  description: string;
}

export const OPERATOR_REGISTRY: Record<string, OperatorRegistryEntry> = {
  // ── Scans ──────────────────────────────────────────────────────────
  SEQ_SCAN: {
    name: 'SEQ_SCAN',
    displayName: 'Sequential Scan',
    chineseName: '顺序表扫描',
    category: 'scan',
    summary: '全表按行/向量块顺序读取数据',
    description: '从目标物理表或内存表中按块读取所有行。若配合谓词下推，未命中的向量块可在存储层被快速跳过。',
  },
  INDEX_SCAN: {
    name: 'INDEX_SCAN',
    displayName: 'Index Scan',
    chineseName: '索引扫描',
    category: 'scan',
    summary: '利用 ART 索引快速定位数据',
    description: '通过自适应基数树 (ART) 索引快速点查或范围扫描目标记录，避免扫描整表。',
  },
  TABLE_SCAN: {
    name: 'TABLE_SCAN',
    displayName: 'Table Scan',
    chineseName: '表扫描',
    category: 'scan',
    summary: '物理数据表读取',
    description: '从数据库物理表中读取向量数据。',
  },
  PARQUET_SCAN: {
    name: 'PARQUET_SCAN',
    displayName: 'Parquet Scan',
    chineseName: 'Parquet 文件读取',
    category: 'scan',
    summary: '解析列式 Parquet 文件',
    description: '高效列式按需加载 Parquet 文件，利用 Row Group 统计信息实现元数据跳块过滤。',
  },
  CSV_SCAN: {
    name: 'CSV_SCAN',
    displayName: 'CSV Scan',
    chineseName: 'CSV 文件解析',
    category: 'scan',
    summary: '多线程并行解析 CSV 文本文件',
    description: '并行分块读取并解析 CSV 数据流，将纯文本行转为 DuckDB 内存向量。',
  },
  DUMMY_SCAN: {
    name: 'DUMMY_SCAN',
    displayName: 'Dummy Scan',
    chineseName: '虚拟占位扫描',
    category: 'scan',
    summary: '生成单行虚表（如 SELECT 1+1）',
    description: '为不依赖物理表的常量或计算表达式提供单一虚拟数据入口。',
  },
  COLUMN_DATA_SCAN: {
    name: 'COLUMN_DATA_SCAN',
    displayName: 'Column Data Scan',
    chineseName: '内存列数据读取',
    category: 'scan',
    summary: '读取前置算子缓存的中间列向量',
    description: '从 DuckDB 内部的 ColumnDataCollection 缓冲中按块读取中间结果。',
  },
  CHUNK_SCAN: {
    name: 'CHUNK_SCAN',
    displayName: 'Chunk Scan',
    chineseName: '数据块扫描',
    category: 'scan',
    summary: '读取中间 DataChunk 向量集合',
    description: '扫描已存在于内存执行上下文中的向量块。',
  },
  DELIM_SCAN: {
    name: 'DELIM_SCAN',
    displayName: 'Delim Scan',
    chineseName: '子查询去重扫描',
    category: 'scan',
    summary: '扫描相关子查询物化后的去重暂存表',
    description: '在相关子查询解关联 (Decorrelation) 时读取外层物化的唯一键集合。',
  },
  POSITIONAL_SCAN: {
    name: 'POSITIONAL_SCAN',
    displayName: 'Positional Scan',
    chineseName: '位置索引扫描',
    category: 'scan',
    summary: '按行偏移或内部行号定位读取',
    description: '通过内部 rowid 或位置偏移快速抽取特定行。',
  },

  // ── Joins ──────────────────────────────────────────────────────────
  HASH_JOIN: {
    name: 'HASH_JOIN',
    displayName: 'Hash Join',
    chineseName: '哈希关联',
    category: 'join',
    summary: '构建哈希表完成多表等值关联',
    description: '对右侧（Build 端）数据构建高效哈希索引，随后用左侧（Probe 端）数据流水线探测，支持 INNER、LEFT、RIGHT 等多种关联模式。',
  },
  INDEX_JOIN: {
    name: 'INDEX_JOIN',
    displayName: 'Index Join',
    chineseName: '索引驱动关联',
    category: 'join',
    summary: '利用目标表的物理索引直接对齐关联',
    description: '不需要在内存中重建哈希表，直接利用右表的已有索引进行点查对齐。',
  },
  PIECEWISE_MERGE_JOIN: {
    name: 'PIECEWISE_MERGE_JOIN',
    displayName: 'Piecewise Merge Join',
    chineseName: '分段归并关联',
    category: 'join',
    summary: '适用于范围不等式条件的归并关联',
    description: '处理带有非等值不等式（如 BETWEEN 或 <）的复杂连接条件。',
  },
  BLOCKWISE_NL_JOIN: {
    name: 'BLOCKWISE_NL_JOIN',
    displayName: 'Blockwise NL Join',
    chineseName: '块式嵌套循环关联',
    category: 'join',
    summary: '按块双层循环匹配复杂非等值连接',
    description: '当无合适等值键或索引时，将数据按块载入内存进行笛卡尔式全条件匹配。',
  },
  NESTED_LOOP_JOIN: {
    name: 'NESTED_LOOP_JOIN',
    displayName: 'Nested Loop Join',
    chineseName: '嵌套循环关联',
    category: 'join',
    summary: '逐行比对关联条件',
    description: '最通用的连接算子，但当两端行数较大时容易成为性能瓶颈。',
  },
  IE_JOIN: {
    name: 'IE_JOIN',
    displayName: 'IE Join',
    chineseName: '不等式排序索引关联',
    category: 'join',
    summary: '双不等式优化连接 (Inequality Join)',
    description: '基于论文优化实现的双不等式连接，在时间区间或重叠度检测查询中大幅优于暴力嵌套循环。',
  },
  ASOF_JOIN: {
    name: 'ASOF_JOIN',
    displayName: 'As-Of Join',
    chineseName: '时间序列对齐关联',
    category: 'join',
    summary: '时序或版本最新值近似对齐 (As-Of)',
    description: '专为高频金融或时序数据设计，在特定时间截面上关联最靠近该时刻的前驱记录。',
  },
  CROSS_PRODUCT: {
    name: 'CROSS_PRODUCT',
    displayName: 'Cross Product',
    chineseName: '笛卡尔积连接',
    category: 'join',
    summary: '两表无关联条件的全量交叉组合',
    description: '两端数据量乘积输出，容易导致行数急剧膨胀，需警惕意外的全外乘积。',
  },
  DELIM_JOIN: {
    name: 'DELIM_JOIN',
    displayName: 'Delimited Join',
    chineseName: '解关联去重连接',
    category: 'join',
    summary: '相关子查询解关联优化连接',
    description: 'DuckDB 用于消除相关子查询重复运算的专用连接算子。',
  },

  // ── Aggregations ───────────────────────────────────────────────────
  HASH_GROUP_BY: {
    name: 'HASH_GROUP_BY',
    displayName: 'Hash Group By',
    chineseName: '哈希分组聚合',
    category: 'aggregate',
    summary: '基于哈希表的多键聚合计算',
    description: '对 GROUP BY 分组键计算哈希分布，多线程并行更新每个组别的聚合状态累加器（SUM、COUNT、AVG 等）。',
  },
  PERFECT_HASH_GROUP_BY: {
    name: 'PERFECT_HASH_GROUP_BY',
    displayName: 'Perfect Hash Group By',
    chineseName: '完美哈希密集聚合',
    category: 'aggregate',
    summary: '密集紧凑整型键零碰撞极速聚合',
    description: '当分组键为小范围紧凑整数时，DuckDB 采用直接数组寻址（完美哈希），性能远高于常规哈希表。',
  },
  UNGROUPED_AGGREGATE: {
    name: 'UNGROUPED_AGGREGATE',
    displayName: 'Ungrouped Aggregate',
    chineseName: '无分组全局聚合',
    category: 'aggregate',
    summary: '全量单组汇总（如单值 COUNT(*)）',
    description: '查询中未声明 GROUP BY，仅计算全表单一度量结果。',
  },
  STREAMING_AGGREGATE: {
    name: 'STREAMING_AGGREGATE',
    displayName: 'Streaming Aggregate',
    chineseName: '流式有序聚合',
    category: 'aggregate',
    summary: '对已排序的输入流边读边聚',
    description: '输入已按分组键排好序，只需保存当前组状态，内存消耗极低。',
  },
  DISTINCT: {
    name: 'DISTINCT',
    displayName: 'Distinct',
    chineseName: '行去重',
    category: 'aggregate',
    summary: '剔除结果集中完全重复的行',
    description: '利用哈希表筛选唯一值组合。',
  },
  HASH_DISTINCT: {
    name: 'HASH_DISTINCT',
    displayName: 'Hash Distinct',
    chineseName: '哈希去重',
    category: 'aggregate',
    summary: '多列哈希行去重',
    description: '基于哈希碰撞检测过滤重复行。',
  },

  // ── Filter & Projections ───────────────────────────────────────────
  FILTER: {
    name: 'FILTER',
    displayName: 'Filter',
    chineseName: '行谓词过滤',
    category: 'filter',
    summary: '按 WHERE / HAVING 条件初筛行',
    description: '利用向量化布尔掩码计算，快速剔除不符合过滤条件的行。',
  },
  CHUNK_FILTER: {
    name: 'CHUNK_FILTER',
    displayName: 'Chunk Filter',
    chineseName: '块级初筛',
    category: 'filter',
    summary: '向量块级别快速布尔初筛',
    description: '在批次块内部计算布尔向量，筛选匹配项。',
  },
  PROJECTION: {
    name: 'PROJECTION',
    displayName: 'Projection',
    chineseName: '列投影计算',
    category: 'projection',
    summary: '计算目标列表达式或裁剪列',
    description: '执行 SELECT 列表中的标量运算、类型转换、别名重命名与多列组合。',
  },
  EXPRESSION_EXECUTOR: {
    name: 'EXPRESSION_EXECUTOR',
    displayName: 'Expression Executor',
    chineseName: '表达式批量求值',
    category: 'projection',
    summary: '批量向量化表达式计算',
    description: '对复杂函数表达式进行批量 SIMD 向量化计算。',
  },

  // ── Sort & Limits ──────────────────────────────────────────────────
  ORDER_BY: {
    name: 'ORDER_BY',
    displayName: 'Order By',
    chineseName: '全局结果排序',
    category: 'sort',
    summary: '按排序列对全量数据排序',
    description: '采用并行多路归并排序或基数排序对行进行全局升降序整理。数据量超过内存限制时会启用磁盘外部排序。',
  },
  TOP_N: {
    name: 'TOP_N',
    displayName: 'Top-N Heap Sort',
    chineseName: 'Top-N 堆排切片',
    category: 'sort',
    summary: '维护最小/最大堆快速取出前 N 行',
    description: 'ORDER BY 配合 LIMIT 的极度优化版本。仅在内存维护一个大小为 N 的优先队列，无需对全部行进行全局排序。',
  },
  LIMIT: {
    name: 'LIMIT',
    displayName: 'Limit',
    chineseName: '行数截断 (Limit)',
    category: 'sort',
    summary: '达到指定条数后立即中断上游',
    description: '对上游传递的数据流进行计数截断，达到上限后触发短路 (Short-circuit)，避免多余计算。',
  },
  STREAMING_LIMIT: {
    name: 'STREAMING_LIMIT',
    displayName: 'Streaming Limit',
    chineseName: '流式行数截断',
    category: 'sort',
    summary: '流式流水线行数限制与短路',
    description: '在流式管道中控制行数上限，达到时立刻通知各阶段停止生产。',
  },

  // ── Window & Result ────────────────────────────────────────────────
  WINDOW: {
    name: 'WINDOW',
    displayName: 'Window Function',
    chineseName: '窗口函数运算',
    category: 'window',
    summary: '执行 OVER (PARTITION BY ... ORDER BY ...)',
    description: '计算 ROW_NUMBER、RANK、LEAD、LAG 或移动平均窗口度量。',
  },
  STREAMING_WINDOW: {
    name: 'STREAMING_WINDOW',
    displayName: 'Streaming Window',
    chineseName: '流式窗口运算',
    category: 'window',
    summary: '对有序分区的轻量窗口流计算',
    description: '在无需全局物化的情况下递增计算窗口聚合指标。',
  },
  RESULT_COLLECTOR: {
    name: 'RESULT_COLLECTOR',
    displayName: 'Result Collector',
    chineseName: '最终结果收集器',
    category: 'result',
    summary: '组装最终 Arrow 向量并返回给客户端',
    description: '物理执行计划顶层算子，将各线程返回的物理块拼接并转为客户端需要的输出格式。',
  },
  EXPLAIN_ANALYZE: {
    name: 'EXPLAIN_ANALYZE',
    displayName: 'Explain Analyze Root',
    chineseName: '执行计划分析根节点',
    category: 'result',
    summary: '收集并呈现全链路性能指标',
    description: '包裹整个查询，负责埋点搜集所有算子的 Timing、Cardinality 与 Profiling 数据。',
  },
  EMPTY_RESULT: {
    name: 'EMPTY_RESULT',
    displayName: 'Empty Result',
    chineseName: '空结果短路',
    category: 'result',
    summary: '优化器直接判定结果为空并立即返回',
    description: '例如 WHERE 1=0 或空表连接，在编译期判定后直接返回零行，避免物理计算。',
  },
};

/**
 * Normalizes an operator name for robust registry matching.
 */
export function normalizeOperatorName(name: string): string {
  return String(name || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]/g, '');
}

/**
 * Look up operator metadata with graceful fallback for unknown DuckDB operators.
 * Never throws, never drops the operator, and retains the raw name.
 */
export function lookupOperator(rawName: string): {
  entry: OperatorRegistryEntry;
  isUnknown: boolean;
} {
  const norm = normalizeOperatorName(rawName);

  // Exact match
  if (OPERATOR_REGISTRY[norm]) {
    return { entry: OPERATOR_REGISTRY[norm], isUnknown: false };
  }

  // Common variations (e.g. SEQ_SCAN_ORDERS -> SEQ_SCAN)
  for (const [key, val] of Object.entries(OPERATOR_REGISTRY)) {
    if (norm.startsWith(key) || norm.includes(key)) {
      return { entry: val, isUnknown: false };
    }
  }

  // Heuristic categorization for unknown operator
  let inferredCategory: OperatorCategory = 'other';
  let inferredChinese = '自定义或未收录算子';

  if (norm.includes('SCAN')) {
    inferredCategory = 'scan';
    inferredChinese = '数据读取算子';
  } else if (norm.includes('JOIN')) {
    inferredCategory = 'join';
    inferredChinese = '多表关联算子';
  } else if (norm.includes('AGG') || norm.includes('GROUP') || norm.includes('DISTINCT')) {
    inferredCategory = 'aggregate';
    inferredChinese = '分组聚合算子';
  } else if (norm.includes('FILTER')) {
    inferredCategory = 'filter';
    inferredChinese = '条件过滤算子';
  } else if (norm.includes('SORT') || norm.includes('ORDER') || norm.includes('LIMIT')) {
    inferredCategory = 'sort';
    inferredChinese = '排序截断算子';
  } else if (norm.includes('WINDOW')) {
    inferredCategory = 'window';
    inferredChinese = '窗口运算算子';
  } else if (norm.includes('PROJ')) {
    inferredCategory = 'projection';
    inferredChinese = '计算投影算子';
  }

  const fallbackEntry: OperatorRegistryEntry = {
    name: rawName.trim(),
    displayName: rawName.trim(),
    chineseName: inferredChinese,
    category: inferredCategory,
    summary: `DuckDB 物理算子: ${rawName.trim()}`,
    description: `此算子暂未在 DuckDB Editor Pro 预设字典中收录，但仍正常参与执行计划拓扑与性能分析。`,
  };

  return { entry: fallbackEntry, isUnknown: true };
}

/**
 * Returns color tokens for category cards and badges.
 */
export function getCategoryTheme(category: OperatorCategory) {
  switch (category) {
    case 'scan':
      return {
        border: 'border-sky-500/50 hover:border-sky-400/90',
        badgeBg: 'bg-sky-500/15',
        badgeText: 'text-sky-300',
        lineColor: '#38bdf8',
        nodeBg: 'bg-gradient-to-b from-sky-950/40 via-monokai-surface/95 to-monokai-surface/90',
        accentColor: '#38bdf8',
        iconBg: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
        glowShadow: 'shadow-[0_4px_20px_rgba(56,189,248,0.08)]',
      };
    case 'filter':
      return {
        border: 'border-orange-500/50 hover:border-orange-400/90',
        badgeBg: 'bg-orange-500/15',
        badgeText: 'text-orange-300',
        lineColor: '#fb923c',
        nodeBg: 'bg-gradient-to-b from-orange-950/40 via-monokai-surface/95 to-monokai-surface/90',
        accentColor: '#fb923c',
        iconBg: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
        glowShadow: 'shadow-[0_4px_20px_rgba(251,146,60,0.08)]',
      };
    case 'join':
      return {
        border: 'border-amber-500/50 hover:border-amber-400/90',
        badgeBg: 'bg-amber-500/15',
        badgeText: 'text-amber-300',
        lineColor: '#fbbf24',
        nodeBg: 'bg-gradient-to-b from-amber-950/40 via-monokai-surface/95 to-monokai-surface/90',
        accentColor: '#fbbf24',
        iconBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        glowShadow: 'shadow-[0_4px_20px_rgba(251,191,36,0.08)]',
      };
    case 'aggregate':
      return {
        border: 'border-purple-500/50 hover:border-purple-400/90',
        badgeBg: 'bg-purple-500/15',
        badgeText: 'text-purple-300',
        lineColor: '#c084fc',
        nodeBg: 'bg-gradient-to-b from-purple-950/40 via-monokai-surface/95 to-monokai-surface/90',
        accentColor: '#c084fc',
        iconBg: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
        glowShadow: 'shadow-[0_4px_20px_rgba(192,132,252,0.08)]',
      };
    case 'sort':
      return {
        border: 'border-emerald-500/50 hover:border-emerald-400/90',
        badgeBg: 'bg-emerald-500/15',
        badgeText: 'text-emerald-300',
        lineColor: '#34d399',
        nodeBg: 'bg-gradient-to-b from-emerald-950/40 via-monokai-surface/95 to-monokai-surface/90',
        accentColor: '#34d399',
        iconBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        glowShadow: 'shadow-[0_4px_20px_rgba(52,211,153,0.08)]',
      };
    case 'window':
      return {
        border: 'border-indigo-500/50 hover:border-indigo-400/90',
        badgeBg: 'bg-indigo-500/15',
        badgeText: 'text-indigo-300',
        lineColor: '#818cf8',
        nodeBg: 'bg-gradient-to-b from-indigo-950/40 via-monokai-surface/95 to-monokai-surface/90',
        accentColor: '#818cf8',
        iconBg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
        glowShadow: 'shadow-[0_4px_20px_rgba(129,140,248,0.08)]',
      };
    case 'projection':
      return {
        border: 'border-cyan-500/50 hover:border-cyan-400/90',
        badgeBg: 'bg-cyan-500/15',
        badgeText: 'text-cyan-300',
        lineColor: '#22d3ee',
        nodeBg: 'bg-gradient-to-b from-cyan-950/40 via-monokai-surface/95 to-monokai-surface/90',
        accentColor: '#22d3ee',
        iconBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
        glowShadow: 'shadow-[0_4px_20px_rgba(34,211,238,0.08)]',
      };
    case 'result':
      return {
        border: 'border-rose-500/50 hover:border-rose-400/90',
        badgeBg: 'bg-rose-500/15',
        badgeText: 'text-rose-300',
        lineColor: '#f43f5e',
        nodeBg: 'bg-gradient-to-b from-rose-950/40 via-monokai-surface/95 to-monokai-surface/90',
        accentColor: '#f43f5e',
        iconBg: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
        glowShadow: 'shadow-[0_4px_20px_rgba(244,63,94,0.08)]',
      };
    case 'other':
    default:
      return {
        border: 'border-monokai-border hover:border-monokai-comment',
        badgeBg: 'bg-monokai-elevated/50',
        badgeText: 'text-monokai-comment',
        lineColor: '#75715e',
        nodeBg: 'bg-monokai-surface/95',
        accentColor: '#75715e',
        iconBg: 'bg-monokai-comment/20 text-monokai-comment border-monokai-border/40',
        glowShadow: 'shadow-md',
      };
  }
}
