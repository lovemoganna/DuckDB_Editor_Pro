/**
 * academyCurriculum.ts - DuckDB 数据实战学堂统一课程注册中心
 * 
 * 职责：
 * 1. 统一整合【SQL 实战基石】、【14 课故事化本体实战】、【OPLA 工业级工坊】与【官方讲义/用户自定义教程】；
 * 2. 统一划分「初级入门 (Beginner)」、「中级进阶 (Intermediate)」、「高级专家 (Advanced)」三阶货架；
 * 3. 标准化所有课程元数据结构，提供统一的查询、过滤、进度关联与推荐能力。
 */

import { ONTOLOGY_LESSONS_DATA } from '../../../hooks/useOntologyLessons';
import { PRESET_MODELING_CASES } from './mockCaseData';
import { tutorials as builtinDocs } from '../../../data/tutorials';
import { ALL_TRACKS, ALL_INDUSTRIAL_LESSONS, InputTablePreview, TrackId, type TrackMeta } from './industrialCurriculum';

export { ALL_TRACKS, ALL_INDUSTRIAL_LESSONS };
export type { InputTablePreview, TrackId, TrackMeta };

export type CourseDifficulty = 'Beginner' | 'Intermediate' | 'Advanced';
export type CourseCategoryType = 'sql' | 'lesson' | 'case' | 'doc' | 'custom';
export type RoadmapStageId = 'foundations' | 'cleaning' | 'analytics' | 'complex' | 'ontology';

export interface CourseStep {
  id: string;
  title: string;
  explanation?: string;
  description?: string;
  sql: string;
}

export interface CourseAntiPattern {
  badSql: string;
  problem: string;
}

export interface CourseBestPractice {
  goodSql: string;
  reason: string;
}

export interface ProductionTemplate {
  title: string;
  description: string;
  templateSql: string;
  ddlSql?: string;
}

export interface CourseChallenge {
  question: string;
  hint?: string;
  starterSql?: string;
  targetColumn?: string;
  targetMinRows?: number;
  keywords?: string[];
  expectedDescription?: string;
}

export interface AcademyCourseItem {
  id: string;
  title: string;
  difficulty: CourseDifficulty;
  categoryType: CourseCategoryType;
  categoryLabel: string;
  summary: string;
  whyItMatters?: string;
  tags: string[];
  estimatedMinutes: number;
  initialSql: string;
  explanation?: string;
  prerequisites?: string[];
  refId?: string; // 关联底层 lessonId / caseId / tutorialId
  isCustom?: boolean;
  content?: string;
  createdAt?: string;
  roadmapStage?: RoadmapStageId;
  steps?: CourseStep[];
  challenge?: CourseChallenge;
  trackId?: string;
  trackTitle?: string;
  subtitle?: string;
  businessScenario?: string;
  antiPattern?: string | CourseAntiPattern;
  bestPractice?: string | CourseBestPractice;
  inputTables?: InputTablePreview[];
  productionTemplate?: ProductionTemplate;
}

export interface RoadmapStageMeta {
  id: RoadmapStageId;
  title: string;
  subtitle: string;
  order: number;
  badgeBg: string;
  badgeText: string;
  iconName: string;
}

export const ROADMAP_STAGES: RoadmapStageMeta[] = [
  {
    id: 'foundations',
    title: '第一阶段 · 启航基石',
    subtitle: '掌握基础检索、过滤条件、聚合分组与内存测试数据生成',
    order: 1,
    badgeBg: 'bg-emerald-500/10',
    badgeText: 'text-emerald-400',
    iconName: 'Terminal',
  },
  {
    id: 'cleaning',
    title: '第二阶段 · 数据清洗与规范',
    subtitle: '攻克文本正则提取、NULL值安全兜底、空值转化与异常清洗',
    order: 2,
    badgeBg: 'bg-cyan-500/10',
    badgeText: 'text-cyan-400',
    iconName: 'Sparkles',
  },
  {
    id: 'analytics',
    title: '第三阶段 · 高级分析与窗口',
    subtitle: '熟练掌握 QUALIFY 排名过滤、滑动窗口度量与时序分析',
    order: 3,
    badgeBg: 'bg-amber-500/10',
    badgeText: 'text-amber-400',
    iconName: 'TrendingUp',
  },
  {
    id: 'complex',
    title: '第四阶段 · 复合结构与透视',
    subtitle: '驾驭 STRUCT/LIST 嵌套结构、动态 PIVOT 报表与模糊对齐算法',
    order: 4,
    badgeBg: 'bg-purple-500/10',
    badgeText: 'text-purple-400',
    iconName: 'Layers',
  },
  {
    id: 'ontology',
    title: '第五阶段 · 本体建模与工业实战',
    subtitle: '业务对象解构、OPLA 认知建模、跨表关系图谱与行业闭环',
    order: 5,
    badgeBg: 'bg-rose-500/10',
    badgeText: 'text-rose-400',
    iconName: 'Compass',
  },
];

// -------------------------------------------------------------
// 1. SQL 实战高频基石课程 (即学即练)
// -------------------------------------------------------------
export const SQL_RECIPE_COURSES: AcademyCourseItem[] = [
  // --- 初级入门 ---
  {
    id: 'sql_basics_01',
    title: '基础 SELECT 检索与多维条件过滤',
    difficulty: 'Beginner',
    categoryType: 'sql',
    categoryLabel: 'SQL 基石',
    summary: '检索特定列并使用 WHERE 条件进行精准筛选与行数限制。',
    whyItMatters: '90% 的数据工程任务都从精准检索开始，熟练掌握 WHERE 条件能够快速完成数据切片。',
    tags: ['SELECT', 'WHERE', 'LIMIT', '基础查询'],
    estimatedMinutes: 5,
    roadmapStage: 'foundations',
    initialSql: `SELECT 
  range AS id,
  'Item_' || range AS name,
  (range * 17) % 100 AS score,
  CASE WHEN range % 2 = 0 THEN 'Active' ELSE 'Inactive' END AS status
FROM range(20)
WHERE (range * 17) % 100 > 30
ORDER BY score DESC
LIMIT 5;`,
    explanation: 'DuckDB 支持快速内存生成数据与标准 ANSI SQL 过滤。使用 WHERE 过滤行，ORDER BY 排序，LIMIT 截取目标条目。',
    steps: [
      {
        id: 'step_1',
        title: 'Step 1: 生成基础内存数据并观察原始行',
        explanation: '使用 range(10) 生成 10 行连续数字，观察 DuckDB 极速的内存序列生成能力。',
        sql: `SELECT range AS id, 'Item_' || range AS name FROM range(10);`
      },
      {
        id: 'step_2',
        title: 'Step 2: 注入业务字段与条件过滤',
        explanation: '加入 status 状态与 score 评分计算字段，并使用 WHERE 条件过滤出活跃条目。',
        sql: `SELECT 
  range AS id,
  'Item_' || range AS name,
  (range * 17) % 100 AS score,
  CASE WHEN range % 2 = 0 THEN 'Active' ELSE 'Inactive' END AS status
FROM range(20)
WHERE (range * 17) % 100 > 30;`
      },
      {
        id: 'step_3',
        title: 'Step 3: 结合排序与 LIMIT Top-N 截取',
        explanation: '对结果按 score 降序排列，并只截取前 5 条高分数据。',
        sql: `SELECT 
  range AS id,
  'Item_' || range AS name,
  (range * 17) % 100 AS score,
  CASE WHEN range % 2 = 0 THEN 'Active' ELSE 'Inactive' END AS status
FROM range(20)
WHERE (range * 17) % 100 > 30
ORDER BY score DESC
LIMIT 5;`
      }
    ],
    challenge: {
      question: '动手挑战：修改 SQL，只检索 status 为 Active 且 score 大于 50 的前 3 条记录，按 score 降序排列。',
      hint: '在 WHERE 子句中增加 AND 条件：status = \'Active\' AND score > 50',
      starterSql: `SELECT 
  range AS id,
  'Item_' || range AS name,
  (range * 17) % 100 AS score,
  CASE WHEN range % 2 = 0 THEN 'Active' ELSE 'Inactive' END AS status
FROM range(30)
WHERE status = 'Active' AND score > 50
ORDER BY score DESC
LIMIT 3;`,
      targetColumn: 'score',
      targetMinRows: 1,
      keywords: ['WHERE', 'ORDER BY', 'LIMIT'],
      expectedDescription: '返回至多 3 条 Active 状态且得分 > 50 的记录'
    }
  },
  {
    id: 'sql_aggr_01',
    title: '聚合计算与分组指标统计 (GROUP BY & HAVING)',
    difficulty: 'Beginner',
    categoryType: 'sql',
    categoryLabel: 'SQL 基石',
    summary: '汇总明细数据以发现业务趋势，按类别统计总数、均值与区间分布。',
    whyItMatters: '原始明细数据繁杂散乱，聚合分析能将海量明细快速提炼为可量化指标看板。',
    tags: ['GROUP BY', 'COUNT', 'AVG', '聚合统计'],
    estimatedMinutes: 6,
    roadmapStage: 'foundations',
    initialSql: `WITH raw_orders AS (
  SELECT 
    range AS order_id,
    'Region_' || ((range % 4) + 1) AS region,
    round(random() * 500 + 50, 2) AS amount
  FROM range(100)
)
SELECT 
  region,
  COUNT(*) AS total_orders,
  round(AVG(amount), 2) AS avg_amount,
  round(SUM(amount), 2) AS total_sales
FROM raw_orders
GROUP BY region
HAVING COUNT(*) > 10
ORDER BY total_sales DESC;`,
    explanation: '使用 GROUP BY 将记录归拢到不同维度，利用 COUNT/AVG/SUM 计算度量，并通过 HAVING 过滤聚合后的指标。',
    steps: [
      {
        id: 'step_1',
        title: 'Step 1: 构造模拟订单明细并统计全局总额',
        explanation: '先不分组，计算所有订单的总数与平均金额。',
        sql: `WITH raw_orders AS (
  SELECT range AS order_id, round(random() * 500 + 50, 2) AS amount FROM range(100)
)
SELECT COUNT(*) AS total_orders, round(AVG(amount), 2) AS avg_amount, round(SUM(amount), 2) AS grand_total FROM raw_orders;`
      },
      {
        id: 'step_2',
        title: 'Step 2: 按大区维度分组统计 (GROUP BY)',
        explanation: '加入 region 维度，观察不同地区的订单表现差异。',
        sql: `WITH raw_orders AS (
  SELECT range AS order_id, 'Region_' || ((range % 4) + 1) AS region, round(random() * 500 + 50, 2) AS amount FROM range(100)
)
SELECT region, COUNT(*) AS total_orders, round(SUM(amount), 2) AS total_sales FROM raw_orders GROUP BY region ORDER BY total_sales DESC;`
      },
      {
        id: 'step_3',
        title: 'Step 3: 使用 HAVING 过滤聚合后的高阶指标',
        explanation: 'HAVING 专门针对聚合结果进行过滤（例如筛选订单数超过 10 笔的成熟大区）。',
        sql: `WITH raw_orders AS (
  SELECT range AS order_id, 'Region_' || ((range % 4) + 1) AS region, round(random() * 500 + 50, 2) AS amount FROM range(100)
)
SELECT region, COUNT(*) AS total_orders, round(AVG(amount), 2) AS avg_amount, round(SUM(amount), 2) AS total_sales
FROM raw_orders
GROUP BY region
HAVING COUNT(*) > 10
ORDER BY total_sales DESC;`
      }
    ],
    challenge: {
      question: '动手挑战：统计各 region 中最高订单金额 (MAX) 与最低金额 (MIN)，并按 region 升序排列。',
      hint: '在 SELECT 中使用 MAX(amount) AS max_amount, MIN(amount) AS min_amount',
      starterSql: `WITH raw_orders AS (
  SELECT range AS order_id, 'Region_' || ((range % 4) + 1) AS region, round(random() * 500 + 50, 2) AS amount FROM range(100)
)
SELECT region, COUNT(*) AS total_orders, round(MAX(amount), 2) AS max_amount, round(MIN(amount), 2) AS min_amount
FROM raw_orders
GROUP BY region
ORDER BY region ASC;`,
      targetColumn: 'max_amount',
      targetMinRows: 4,
      keywords: ['GROUP BY', 'MAX', 'MIN'],
      expectedDescription: '按 region 聚合输出包含 max_amount 和 min_amount 指标的结果集'
    }
  },
  {
    id: 'sql_gen_01',
    title: '极速内存模拟数据生成 (Range & Random)',
    difficulty: 'Beginner',
    categoryType: 'sql',
    categoryLabel: 'SQL 基石',
    summary: '利用 RANGE 与 RANDOM 函数在浏览器内存中极速生成数千条测试数据集。',
    whyItMatters: '在缺乏真实数据源或验证新逻辑时，合成数据能够迅速验证查询性能与业务公式。',
    tags: ['RANGE', 'RANDOM', '数据构造'],
    estimatedMinutes: 4,
    roadmapStage: 'foundations',
    initialSql: `SELECT 
  range AS user_id, 
  'User_' || (range % 10) AS dept, 
  round(random() * 100, 2) AS performance_score,
  CURRENT_DATE - INTERVAL (range % 30) DAY AS record_date
FROM range(50)
ORDER BY performance_score DESC
LIMIT 10;`,
    explanation: 'DuckDB 内置强大的表函数 range()，配合内置的随机与日期计算函数，可在毫秒级合成分析样本。',
    steps: [
      {
        id: 'step_1',
        title: 'Step 1: 生成 100 行自增数字序列',
        explanation: '执行 SELECT * FROM range(100); 体验毫秒生成能力。',
        sql: `SELECT range AS num FROM range(100);`
      },
      {
        id: 'step_2',
        title: 'Step 2: 结合随机数与日期偏移模拟时序流水',
        explanation: '用 CURRENT_DATE - INTERVAL 构建过去 30 天内分布的业务时间戳。',
        sql: `SELECT 
  range AS user_id, 
  'Dept_' || (range % 5) AS dept, 
  round(random() * 100, 2) AS performance_score,
  CURRENT_DATE - INTERVAL (range % 30) DAY AS record_date
FROM range(50);`
      }
    ],
    challenge: {
      question: '动手挑战：使用 range(200) 生成 200 条数据，增加一个随机金额字段 price（10 到 500 之间），并计算总金额。',
      hint: 'round(random() * 490 + 10, 2) AS price',
      starterSql: `WITH synthetic AS (
  SELECT range AS id, round(random() * 490 + 10, 2) AS price FROM range(200)
)
SELECT COUNT(*) AS total_rows, round(SUM(price), 2) AS total_val, round(AVG(price), 2) AS avg_price FROM synthetic;`,
      targetColumn: 'total_rows',
      targetMinRows: 1,
      keywords: ['range', 'random', 'SUM'],
      expectedDescription: '输出包含 total_rows 和 total_val 的合成度量'
    }
  },

  // --- 中级进阶 ---
  {
    id: 'sql_clean_01',
    title: '正则表达式文本清洗与字段提取 (RegEx)',
    difficulty: 'Intermediate',
    categoryType: 'sql',
    categoryLabel: 'SQL 基石',
    summary: '利用正则表达式在复杂非结构化日志中精准提取目标子串并标准化格式。',
    whyItMatters: '真实业务数据中充斥不规则文本与脏数据，正则提取是进入数据湖仓的必备洗练工具。',
    tags: ['RegEx', 'regexp_extract', '文本清洗'],
    estimatedMinutes: 8,
    roadmapStage: 'cleaning',
    initialSql: `WITH sample_logs AS (
  SELECT '2026-09-18 10:20:30 [INFO] User(1042): login succeeded from 192.168.1.5' AS raw_text
  UNION ALL
  SELECT '2026-09-18 10:21:05 [WARN] User(2088): timeout retry #3 from 10.0.0.12'
  UNION ALL
  SELECT '2026-09-18 10:22:18 [ERROR] System: database connection refused'
)
SELECT 
  raw_text,
  regexp_extract(raw_text, '\\[([A-Z]+)\\]', 1) AS log_level,
  regexp_extract(raw_text, 'User\\((\\d+)\\)', 1) AS user_id,
  regexp_extract(raw_text, 'from (\\d+\\.\\d+\\.\\d+\\.\\d+)', 1) AS ip_address
FROM sample_logs;`,
    explanation: 'DuckDB 的 regexp_extract(string, pattern, group_index) 支持 PCRE 语法，直接按正则分组抓取字段。',
    steps: [
      {
        id: 'step_1',
        title: 'Step 1: 抽取日志等级与中括号标记',
        explanation: '使用 regexp_extract 提取形如 [INFO] / [WARN] 的状态标签。',
        sql: `SELECT '2026-09-18 [WARN] Test message' AS log, regexp_extract('2026-09-18 [WARN] Test message', '\\[([A-Z]+)\\]', 1) AS level;`
      },
      {
        id: 'step_2',
        title: 'Step 2: 抽取用户 ID 与 IP 地址',
        explanation: '通过正则分组匹配数字与 IP 地址，快速将文本日志规整为结构化宽表。',
        sql: `WITH sample_logs AS (
  SELECT '2026-09-18 10:20:30 [INFO] User(1042): login succeeded from 192.168.1.5' AS raw_text
)
SELECT 
  regexp_extract(raw_text, 'User\\((\\d+)\\)', 1) AS user_id,
  regexp_extract(raw_text, 'from (\\d+\\.\\d+\\.\\d+\\.\\d+)', 1) AS ip_address
FROM sample_logs;`
      }
    ],
    challenge: {
      question: '动手挑战：在 sample_logs 中提取发生日期时间（前 19 位字符或通过正则提取日期部分）。',
      hint: '可以使用 regexp_extract(raw_text, \'^(\\\\d{4}-\\\\d{2}-\\\\d{2} \\\\d{2}:\\\\d{2}:\\\\d{2})\', 1) AS log_timestamp',
      starterSql: `WITH sample_logs AS (
  SELECT '2026-09-18 10:20:30 [INFO] User(1042): login succeeded from 192.168.1.5' AS raw_text
)
SELECT 
  regexp_extract(raw_text, '^(\\d{4}-\\d{2}-\\d{2})', 1) AS log_date,
  regexp_extract(raw_text, '\\[([A-Z]+)\\]', 1) AS log_level
FROM sample_logs;`,
      targetColumn: 'log_date',
      targetMinRows: 1,
      keywords: ['regexp_extract'],
      expectedDescription: '成功抽取 log_date 日期字段'
    }
  },
  {
    id: 'sql_clean_02',
    title: '缺失值与空值安全兜底处理 (COALESCE & NULLIF)',
    difficulty: 'Intermediate',
    categoryType: 'sql',
    categoryLabel: 'SQL 基石',
    summary: '优雅处理 NULL 缺失值，提供安全保底默认值以避免计算异常与下游崩坏。',
    whyItMatters: '未处理的 NULL 值会导致下游聚合失真与空指针风险，安全保底是生产级 SQL 的基本素养。',
    tags: ['COALESCE', 'NULLIF', '容错计算'],
    estimatedMinutes: 6,
    roadmapStage: 'cleaning',
    initialSql: `WITH inventory AS (
  SELECT 101 AS sku_id, 'Apples' AS item, 50 AS in_stock, NULL::INTEGER AS reserved
  UNION ALL
  SELECT 102, 'Bananas', NULL, 15
  UNION ALL
  SELECT 103, 'Cherries', 0, 0
)
SELECT 
  sku_id,
  item,
  COALESCE(in_stock, 0) AS safe_stock,
  COALESCE(reserved, 0) AS safe_reserved,
  COALESCE(in_stock, 0) - COALESCE(reserved, 0) AS available_units,
  NULLIF(COALESCE(in_stock, 0), 0) AS non_zero_stock
FROM inventory;`,
    explanation: 'COALESCE 返回第一个非空参数；NULLIF(a, b) 在两个参数相等时返回 NULL，常用于防止除以零等边界问题。',
    steps: [
      {
        id: 'step_1',
        title: 'Step 1: 识别 NULL 带来的计算失效',
        explanation: '观察 NULL 与任何数字运算都得到 NULL 的破坏性效应。',
        sql: `SELECT 50 - NULL AS broken_calc, 50 - COALESCE(NULL, 0) AS safe_calc;`
      },
      {
        id: 'step_2',
        title: 'Step 2: 使用 NULLIF 防止除零错误',
        explanation: '当分母为 0 时返回 NULL 而不是抛出 Division by zero 异常。',
        sql: `SELECT 100.0 / NULLIF(0, 0) AS safe_divide_zero;`
      }
    ],
    challenge: {
      question: '动手挑战：为库存明细增加一个 status 字段，如果 safe_stock > 0 则显示 In Stock，否则显示 Out of Stock。',
      hint: '使用 CASE WHEN COALESCE(in_stock, 0) > 0 THEN \'In Stock\' ELSE \'Out of Stock\' END AS status',
      starterSql: `WITH inventory AS (
  SELECT 101 AS sku_id, 'Apples' AS item, 50 AS in_stock
  UNION ALL SELECT 102, 'Bananas', NULL
)
SELECT 
  sku_id, item, COALESCE(in_stock, 0) AS safe_stock,
  CASE WHEN COALESCE(in_stock, 0) > 0 THEN 'In Stock' ELSE 'Out of Stock' END AS status
FROM inventory;`,
      targetColumn: 'status',
      targetMinRows: 2,
      keywords: ['COALESCE', 'CASE', 'WHEN'],
      expectedDescription: '安全兜底并给出库存 status'
    }
  },
  {
    id: 'sql_qualify_01',
    title: 'QUALIFY 子句高阶排名过滤 (Top-N 终结者)',
    difficulty: 'Intermediate',
    categoryType: 'sql',
    categoryLabel: 'SQL 基石',
    summary: 'DuckDB 特色 QUALIFY 语法直接对窗口函数结果进行过滤，告别多层嵌套子查询。',
    whyItMatters: '无需冗长的嵌套子查询，一行 QUALIFY rank = 1 即可完成分组取最新的经典业务诉求。',
    tags: ['QUALIFY', 'ROW_NUMBER', '窗口函数'],
    estimatedMinutes: 8,
    roadmapStage: 'analytics',
    initialSql: `WITH transactions AS (
  SELECT 
    range AS tx_id,
    'Client_' || ((range % 3) + 1) AS client_id,
    round(random() * 1000 + 100, 2) AS tx_amount,
    CURRENT_TIMESTAMP - INTERVAL (range * 3) HOUR AS tx_time
  FROM range(15)
)
SELECT 
  client_id,
  tx_id,
  tx_amount,
  tx_time,
  ROW_NUMBER() OVER (PARTITION BY client_id ORDER BY tx_time DESC) AS recency_rank
FROM transactions
QUALIFY recency_rank = 1
ORDER BY client_id;`,
    explanation: '在 DuckDB 中，QUALIFY 允许在 SELECT/WHERE 之后直接对窗口函数进行过滤，极致精简代码。',
    steps: [
      {
        id: 'step_1',
        title: 'Step 1: 理解 ROW_NUMBER() 分区排序',
        explanation: '为每个客户的分组流水按时间从新到旧赋予序号 1, 2, 3...',
        sql: `WITH transactions AS (
  SELECT range AS tx_id, 'Client_' || ((range % 2) + 1) AS client_id, CURRENT_TIMESTAMP - INTERVAL (range * 3) HOUR AS tx_time FROM range(6)
)
SELECT client_id, tx_id, tx_time, ROW_NUMBER() OVER (PARTITION BY client_id ORDER BY tx_time DESC) AS rnk FROM transactions;`
      },
      {
        id: 'step_2',
        title: 'Step 2: 启用 QUALIFY 直接过滤序号',
        explanation: '省去外部套一层子查询的烦琐，直接在最后追加 QUALIFY rnk <= 2。',
        sql: `WITH transactions AS (
  SELECT range AS tx_id, 'Client_' || ((range % 2) + 1) AS client_id, CURRENT_TIMESTAMP - INTERVAL (range * 3) HOUR AS tx_time FROM range(6)
)
SELECT client_id, tx_id, tx_time, ROW_NUMBER() OVER (PARTITION BY client_id ORDER BY tx_time DESC) AS rnk FROM transactions QUALIFY rnk = 1;`
      }
    ],
    challenge: {
      question: '动手挑战：取每个 client_id 交易金额最高 (ORDER BY tx_amount DESC) 的前 2 笔记录。',
      hint: '修改窗口函数为 OVER (PARTITION BY client_id ORDER BY tx_amount DESC) 并 QUALIFY <= 2',
      starterSql: `WITH transactions AS (
  SELECT range AS tx_id, 'Client_' || ((range % 3) + 1) AS client_id, round(random() * 1000 + 100, 2) AS tx_amount FROM range(15)
)
SELECT client_id, tx_id, tx_amount, ROW_NUMBER() OVER (PARTITION BY client_id ORDER BY tx_amount DESC) AS top_rank
FROM transactions
QUALIFY top_rank <= 2
ORDER BY client_id, top_rank;`,
      targetColumn: 'top_rank',
      targetMinRows: 4,
      keywords: ['QUALIFY', 'ROW_NUMBER', 'PARTITION BY'],
      expectedDescription: '使用 QUALIFY 返回各客户交易额最高的前 2 笔记录'
    }
  },

  // --- 高级专家 ---
  {
    id: 'sql_fuzzy_01',
    title: '字符串相似度算法与模糊实体对齐 (Jaro-Winkler & Levenshtein)',
    difficulty: 'Advanced',
    categoryType: 'sql',
    categoryLabel: 'SQL 基石',
    summary: '使用 Jaro-Winkler 与 Levenshtein 算法跨系统匹配拼写相似的实体名称。',
    whyItMatters: '客户名称或物料编码录入存在人工错别字时，模糊对齐算法是主数据清洗与实体融合的核心武器。',
    tags: ['Jaro-Winkler', 'Levenshtein', '主数据对齐'],
    estimatedMinutes: 10,
    roadmapStage: 'complex',
    initialSql: `WITH target_names AS (
  SELECT 'Alphabet Inc.' AS official_name
),
incoming_records AS (
  SELECT 'Alphabet Inc' AS raw_name
  UNION ALL SELECT 'Alphabet Incorporated'
  UNION ALL SELECT 'Alfa Bet Inc'
  UNION ALL SELECT 'Microsoft Corp'
)
SELECT 
  i.raw_name,
  t.official_name,
  round(jaro_winkler_similarity(i.raw_name, t.official_name), 3) AS similarity_score,
  levenshtein(i.raw_name, t.official_name) AS edit_distance,
  CASE 
    WHEN jaro_winkler_similarity(i.raw_name, t.official_name) > 0.85 THEN '匹配成功'
    ELSE '差异过大'
  END AS match_result
FROM incoming_records i
CROSS JOIN target_names t
ORDER BY similarity_score DESC;`,
    explanation: 'DuckDB 原生提供各种字符串距离算法函数，能高吞吐进行实体名称评分与模糊排重。',
    steps: [
      {
        id: 'step_1',
        title: 'Step 1: 比较两个字符串的编辑距离与 Jaro-Winkler 分数',
        explanation: '观察算法对拼写变体与完全不相干文本的分值差异。',
        sql: `SELECT jaro_winkler_similarity('Apple', 'Appel') AS score_typo, jaro_winkler_similarity('Apple', 'Banana') AS score_diff;`
      }
    ],
    challenge: {
      question: '动手挑战：尝试测试字符串 \'DuckDB Lab\' 与 \'Duck Database\' 的相似度分值。',
      hint: 'SELECT jaro_winkler_similarity(\'DuckDB Lab\', \'Duck Database\') AS test_sim;',
      starterSql: `SELECT round(jaro_winkler_similarity('DuckDB Lab', 'Duck Database'), 3) AS test_sim;`,
      targetColumn: 'test_sim',
      targetMinRows: 1,
      keywords: ['jaro_winkler_similarity'],
      expectedDescription: '输出两个字符串的相似度分值'
    }
  },
  {
    id: 'sql_struct_01',
    title: '现代层级复杂类型 (STRUCT & LIST & UNNEST)',
    difficulty: 'Advanced',
    categoryType: 'sql',
    categoryLabel: 'SQL 基石',
    summary: '原生操作嵌套结构体与数组列表，无需 JOIN 即可将层级关系与多值标签紧凑打包与平铺。',
    whyItMatters: '现代数据格式（JSON / Parquet / 物联网时序）多为层级结构，Structs 保持了天然的高效紧凑性。',
    tags: ['STRUCT', 'LIST', 'UNNEST', '复合数据'],
    estimatedMinutes: 10,
    roadmapStage: 'complex',
    initialSql: `WITH nested_entities AS (
  SELECT 
    1001 AS entity_id,
    {'street': '科技大道88号', 'city': '杭州', 'zip': 310000} AS location,
    ['VIP', '供应链核心', '信用等级A'] AS tags
  UNION ALL
  SELECT 
    1002,
    {'street': '金融街1号', 'city': '上海', 'zip': 200000},
    ['新注册', '待核验']
)
SELECT 
  entity_id,
  location.city AS city,
  location.street AS street,
  UNNEST(tags) AS single_tag
FROM nested_entities;`,
    explanation: '点号 . 可以直接深入提取 STRUCT 内部成员，UNNEST 则能将 LIST 展开为关系行。',
    steps: [
      {
        id: 'step_1',
        title: 'Step 1: 构建 STRUCT 结构体并访问字段',
        explanation: '使用 {\'field\': value} 构造结构体，使用 dot 语法提取成员。',
        sql: `SELECT {'name': 'Alice', 'role': 'Admin'}.name AS user_name;`
      },
      {
        id: 'step_2',
        title: 'Step 2: 使用 UNNEST 将列表展开为多行',
        explanation: 'LIST 中的多个元素通过 UNNEST 直接展开为平铺数据行。',
        sql: `SELECT UNNEST(['Alpha', 'Beta', 'Gamma']) AS item_name;`
      }
    ],
    challenge: {
      question: '动手挑战：创建一个包含 3 个数字的 LIST [10, 20, 30]，并用 UNNEST 展开后求它们的 SUM。',
      hint: 'WITH t AS (SELECT UNNEST([10, 20, 30]) AS val) SELECT SUM(val) AS total FROM t;',
      starterSql: `WITH t AS (
  SELECT UNNEST([10, 20, 30]) AS val
)
SELECT SUM(val) AS total_sum FROM t;`,
      targetColumn: 'total_sum',
      targetMinRows: 1,
      keywords: ['UNNEST', 'SUM'],
      expectedDescription: 'UNNEST 展开列表并求得聚合和 60'
    }
  },
  {
    id: 'sql_pivot_01',
    title: '动态透视矩阵转换 (PIVOT 报表计算)',
    difficulty: 'Advanced',
    categoryType: 'sql',
    categoryLabel: 'SQL 基石',
    summary: '使用 PIVOT 关键字快速将多行状态指标转换为列维度，一键生成多维透视矩阵大盘。',
    whyItMatters: '摆脱冗长且脆弱的 CASE WHEN 条件聚类，PIVOT 极大简化了报表与高维透视逻辑。',
    tags: ['PIVOT', '交叉透视', '报表生成'],
    estimatedMinutes: 8,
    roadmapStage: 'complex',
    initialSql: `WITH quarterly_sales AS (
  SELECT '产品A' AS product, 'Q1' AS quarter, 120 AS revenue
  UNION ALL SELECT '产品A', 'Q2', 150
  UNION ALL SELECT '产品A', 'Q3', 180
  UNION ALL SELECT '产品A', 'Q4', 210
  UNION ALL SELECT '产品B', 'Q1', 90
  UNION ALL SELECT '产品B', 'Q2', 110
  UNION ALL SELECT '产品B', 'Q3', 130
  UNION ALL SELECT '产品B', 'Q4', 160
)
PIVOT quarterly_sales
ON quarter IN ('Q1', 'Q2', 'Q3', 'Q4')
USING SUM(revenue)
GROUP BY product;`,
    explanation: 'PIVOT 将行值展开为列，USING 指定聚合度量，GROUP BY 确定行维度标识。',
    steps: [
      {
        id: 'step_1',
        title: 'Step 1: 观察长表数据结构',
        explanation: '产品与季度分布在不同的明细行中。',
        sql: `SELECT 'Product_1' AS p, 'Q1' AS q, 100 AS v UNION ALL SELECT 'Product_1', 'Q2', 200;`
      },
      {
        id: 'step_2',
        title: 'Step 2: 执行 PIVOT 转换为宽表',
        explanation: 'ON 列名 IN (目标列) 实现行转列。',
        sql: `WITH raw AS (
  SELECT 'Product_1' AS p, 'Q1' AS q, 100 AS v UNION ALL SELECT 'Product_1', 'Q2', 200
)
PIVOT raw ON q IN ('Q1', 'Q2') USING SUM(v) GROUP BY p;`
      }
    ],
    challenge: {
      question: '动手挑战：尝试对长表中的数值同时使用 AVG(revenue) 进行透视计算。',
      hint: 'USING AVG(revenue)',
      starterSql: `WITH quarterly_sales AS (
  SELECT 'A' AS product, 'Q1' AS quarter, 100 AS revenue
  UNION ALL SELECT 'A', 'Q2', 200
)
PIVOT quarterly_sales
ON quarter IN ('Q1', 'Q2')
USING AVG(revenue)
GROUP BY product;`,
      targetColumn: 'product',
      targetMinRows: 1,
      keywords: ['PIVOT', 'USING', 'GROUP BY'],
      expectedDescription: '透视生成宽表报表'
    }
  }
];

// -------------------------------------------------------------
// 2. 14 课故事化本体认知课程适配 (转换统一格式)
// -------------------------------------------------------------
function mapDifficulty(diff: 'foundation' | 'intermediate' | 'advanced'): CourseDifficulty {
  if (diff === 'foundation') return 'Beginner';
  if (diff === 'intermediate') return 'Intermediate';
  return 'Advanced';
}

export const ONTOLOGY_LESSONS_COURSES: AcademyCourseItem[] = ONTOLOGY_LESSONS_DATA.map(lesson => {
  const diff = mapDifficulty(lesson.difficulty);
  const sampleSql = `-- 第 ${lesson.number} 课：${lesson.title}
-- 核心概念：${lesson.coreConcept || '本体建模实体与关系验证'}
SELECT 
  ${lesson.number} AS lesson_number,
  '${lesson.title.replace(/'/g, "''")}' AS lesson_title,
  '${lesson.stage}' AS ontology_stage,
  '${lesson.difficulty}' AS original_tier,
  '运行此脚本以验证本课底层实体定义' AS execution_status;`;

  return {
    id: `ontology_${lesson.id}`,
    title: `第 ${lesson.number} 课：${lesson.title}`,
    difficulty: diff,
    categoryType: 'lesson',
    categoryLabel: '14课本体实战',
    summary: lesson.description || lesson.coreConcept || '通过真实业务故事探究本体论建模，避开直觉陷阱。',
    whyItMatters: lesson.caseBackground || '理解业务现实证据，建立高确定性的实体与关系模型。',
    tags: ['本体论', 'OPLA', lesson.stage, lesson.difficulty],
    estimatedMinutes: parseInt(lesson.estimatedTime, 10) || 15,
    roadmapStage: 'ontology',
    initialSql: sampleSql,
    refId: lesson.id,
  };
});

// -------------------------------------------------------------
// 3. OPLA 工业级大案工坊 (转换为高级/中级/入门大案)
// -------------------------------------------------------------
function mapCaseDifficulty(diff: string): CourseDifficulty {
  if (diff === '入门') return 'Beginner';
  if (diff === '进阶') return 'Intermediate';
  return 'Advanced';
}

export const OPLA_CASE_COURSES: AcademyCourseItem[] = PRESET_MODELING_CASES.map(c => {
  return {
    id: `case_${c.id}`,
    title: `工坊实战：${c.title}`,
    difficulty: mapCaseDifficulty(c.difficulty),
    categoryType: 'case',
    categoryLabel: 'OPLA 工业工坊',
    summary: c.summary,
    whyItMatters: c.businessBackground,
    tags: ['工业案例', c.industry, 'OPLA建模', c.difficulty],
    estimatedMinutes: 20,
    roadmapStage: 'ontology',
    initialSql: c.sampleDuckDbSql || `-- 案例：${c.title}\nSELECT '${c.id}' AS case_id, '${c.industry}' AS industry;`,
    refId: c.id,
  };
});

// -------------------------------------------------------------
// 4. 官方权威技术讲义 (从 tutorials.publish.json 导入)
// -------------------------------------------------------------
function mapDocDifficulty(diff: string): CourseDifficulty {
  if (diff === 'Beginner') return 'Beginner';
  if (diff === 'Intermediate') return 'Intermediate';
  return 'Advanced';
}

export const OFFICIAL_DOC_COURSES: AcademyCourseItem[] = builtinDocs.map(doc => {
  return {
    id: `doc_${doc.id}`,
    title: `讲义：${doc.title}`,
    difficulty: mapDocDifficulty(doc.difficulty),
    categoryType: 'doc',
    categoryLabel: '官方讲义',
    summary: doc.description,
    whyItMatters: '官方系统性技术读本，包含全面的技术细节与原理解析。',
    tags: ['技术讲义', doc.category, ...(doc.tags || [])],
    estimatedMinutes: parseInt(String(doc.estimatedTime || 12), 10) || 12,
    roadmapStage: doc.difficulty === 'Beginner' ? 'foundations' : (doc.difficulty === 'Intermediate' ? 'cleaning' : 'complex'),
    initialSql: `-- 官方讲义实战演练：${doc.title}
SELECT 
  '${doc.id}' AS doc_id,
  '${doc.category}' AS category,
  '阅读左侧讲义后，可在此直接尝试运行示例 SQL' AS guide;`,
    refId: doc.id,
  };
});

export const INDUSTRIAL_COURSE_ITEMS: AcademyCourseItem[] = ALL_INDUSTRIAL_LESSONS.map(l => ({
  id: l.id,
  title: l.title,
  difficulty: l.difficulty,
  categoryType: l.trackId === 'enterprise_opla' ? 'case' : 'sql',
  categoryLabel: l.trackTitle,
  summary: l.subtitle,
  whyItMatters: l.whyItMatters,
  tags: l.tags,
  estimatedMinutes: l.estimatedMinutes,
  initialSql: l.initialSql,
  explanation: l.businessScenario,
  roadmapStage: l.trackId === 'modern_sql' ? 'foundations' : l.trackId === 'data_lake' ? 'cleaning' : l.trackId === 'high_perf' ? 'analytics' : 'ontology',
  steps: l.steps.map(s => ({
    id: s.id,
    title: s.title,
    explanation: s.explanation,
    sql: s.sql,
  })),
  challenge: {
    question: l.challenge.title + '：' + l.challenge.description,
    hint: l.challenge.hint,
    starterSql: l.challenge.starterSql,
    targetColumn: l.challenge.targetColumns[0],
    targetMinRows: l.challenge.targetMinRows,
    keywords: l.challenge.requiredKeywords,
    expectedDescription: l.challenge.expectedExplanation,
  },
  trackId: l.trackId,
  trackTitle: l.trackTitle,
  subtitle: l.subtitle,
  businessScenario: l.businessScenario,
  antiPattern: l.antiPattern,
  bestPractice: l.bestPractice,
  inputTables: l.inputTables,
  productionTemplate: l.productionTemplate,
}));

// -------------------------------------------------------------
// 5. 聚合与辅助查询 API
// -------------------------------------------------------------

/** 获取全部内置课程 (按难度自然递进排序) */
export function getBuiltinAcademyCourses(): AcademyCourseItem[] {
  const all: AcademyCourseItem[] = [
    ...INDUSTRIAL_COURSE_ITEMS,
    ...SQL_RECIPE_COURSES.filter(c => !INDUSTRIAL_COURSE_ITEMS.some(ic => ic.id === c.id)),
    ...ONTOLOGY_LESSONS_COURSES,
    ...OPLA_CASE_COURSES,
    ...OFFICIAL_DOC_COURSES,
  ];

  // 排序规则：初级 -> 中级 -> 高级
  const orderMap: Record<CourseDifficulty, number> = {
    Beginner: 1,
    Intermediate: 2,
    Advanced: 3,
  };

  return all.sort((a, b) => {
    if (orderMap[a.difficulty] !== orderMap[b.difficulty]) {
      return orderMap[a.difficulty] - orderMap[b.difficulty];
    }
    return a.title.localeCompare(b.title, 'zh-CN');
  });
}

/** 动态融合用户自建教程 */
export function getAllAcademyCourses(customTutorials: any[] = []): AcademyCourseItem[] {
  const builtin = getBuiltinAcademyCourses();
  if (!customTutorials || customTutorials.length === 0) return builtin;

  const customCourses: AcademyCourseItem[] = customTutorials.map((t, idx) => ({
    id: `custom_${t.id || idx}`,
    title: t.title || '自定义实战教程',
    difficulty: (t.difficulty === 'Advanced' || t.difficulty === 'Expert') 
      ? 'Advanced' 
      : (t.difficulty === 'Intermediate' ? 'Intermediate' : 'Beginner'),
    categoryType: 'custom',
    categoryLabel: '自建课程',
    summary: t.description || '由用户在工作台中导入的 Markdown 课程。',
    tags: ['自建', ...(t.tags || [])],
    estimatedMinutes: t.estimatedTime || 10,
    initialSql: t.initialSql || `-- 用户自建教程 SQL\nSELECT 'Custom Tutorial' AS type;`,
    content: t.content || t.userContent || '',
    isCustom: true,
    refId: t.id,
    createdAt: t.createdAt,
  }));

  return [...builtin, ...customCourses];
}

/** 按难度筛选课程 */
export function getCoursesByDifficulty(
  difficulty: CourseDifficulty,
  allCourses: AcademyCourseItem[] = getBuiltinAcademyCourses()
): AcademyCourseItem[] {
  return allCourses.filter(c => c.difficulty === difficulty);
}

/** 按 ID 获取单个课程 */
export function getCourseById(
  id: string,
  allCourses: AcademyCourseItem[] = getBuiltinAcademyCourses()
): AcademyCourseItem | undefined {
  return allCourses.find(c => c.id === id || c.refId === id);
}

/** 推荐下一课 */
export function getRecommendedNextCourse(
  currentId: string,
  completedIds: string[] = [],
  allCourses: AcademyCourseItem[] = getBuiltinAcademyCourses()
): AcademyCourseItem | undefined {
  const currentIndex = allCourses.findIndex(c => c.id === currentId);
  if (currentIndex >= 0 && currentIndex < allCourses.length - 1) {
    return allCourses[currentIndex + 1];
  }
  // 找第一个未完成的课程
  const uncompleted = allCourses.find(c => !completedIds.includes(c.id));
  return uncompleted || allCourses[0];
}

/** 按路线图阶段筛选课程 */
export function getCoursesByRoadmapStage(
  stageId: RoadmapStageId,
  allCourses: AcademyCourseItem[] = getBuiltinAcademyCourses()
): AcademyCourseItem[] {
  return allCourses.filter(c => c.roadmapStage === stageId);
}
