import { KnowledgeAsset } from '../types';

export const SEED_KNOWLEDGE_ASSETS: KnowledgeAsset[] = [
  // ==================== 1. 代码资产 (Code Assets) ====================
  {
    id: 'code-parquet-inspect',
    type: 'code',
    title: 'Parquet 极速元数据与数据分布抽样',
    category: 'template',
    description: '利用 DuckDB 极速读取 Parquet 元数据信息，并基于 Reservoir Sampling 抽取固定比例样本进行快速剖析。',
    sql: `-- 1. 自动在 DuckDB WASM 虚拟文件系统中准备一份样本 Parquet 文件（确保开箱即跑）
COPY (
    SELECT 
        i AS order_id, 
        1000 + (i % 80) AS customer_id,
        ROUND(15.0 + (random() * 285.0), 2) AS pay_amount,
        CASE (i % 3) 
            WHEN 0 THEN 'COMPLETED' 
            WHEN 1 THEN 'PENDING' 
            ELSE 'REFUNDED' 
        END AS order_status,
        CURRENT_DATE - (i % 30) AS order_date
    FROM range(1, 1001) t(i)
) TO '{{file_path}}' (FORMAT PARQUET);

-- 2. 极速读取该 Parquet 的列结构、数据类型与空值率元数据
SELECT 
    column_name, 
    column_type, 
    null_percentage
FROM parquet_schema('{{file_path}}')
LIMIT 50;

-- 3. 基于 Reservoir Sampling (伯努利水塘抽样) 进行分布探测
SELECT * 
FROM read_parquet('{{file_path}}')
USING SAMPLE {{sample_percentage}} PERCENT (bernoulli)
LIMIT 100;`,
    params: [
      { name: 'file_path', label: 'Parquet 文件路径或URL', defaultValue: 'orders_sample.parquet', description: '虚拟文件系统或远程 Parquet 文件路径' },
      { name: 'sample_percentage', label: '抽样百分比 (%)', defaultValue: '10', description: '按行伯努利采样比例' },
    ],
    tags: ['DuckDB', 'Parquet', '数据探索', '抽样分析'],
    isFavorite: true,
    createdAt: '2026-03-01T08:00:00.000Z',
    updatedAt: '2026-03-21T18:00:00.000Z',
  },
  {
    id: 'code-retention-cohort',
    type: 'code',
    title: '用户留存队列分析 (Cohort Retention Model)',
    category: 'template',
    description: '标准 Cohort 留存模型：按首访自然周聚合首购用户，并计算次周、第3周到第8周的留存率与留存人数矩阵。',
    sql: `-- 确保存在样本行为日志表（若不存在则自动准备，确保开箱即跑）
CREATE TEMP TABLE IF NOT EXISTS {{event_table}} AS 
SELECT 
    1000 + (i % 60) AS user_id,
    TIMESTAMP '2026-01-01 00:00:00' + INTERVAL (CAST(random() * 60 AS INT)) DAY + INTERVAL (CAST(random() * 86400 AS INT)) SECOND AS event_time,
    'page_view' AS event_name
FROM range(1, 1001) t(i);

-- 标准 Cohort 留存模型计算
WITH first_activity AS (
    SELECT 
        user_id,
        date_trunc('week', MIN(event_time)) AS cohort_week
    FROM {{event_table}}
    GROUP BY user_id
),
activity_weeks AS (
    SELECT 
        f.cohort_week,
        date_diff('week', f.cohort_week, date_trunc('week', a.event_time)) AS week_number,
        COUNT(DISTINCT a.user_id) AS active_users
    FROM {{event_table}} a
    JOIN first_activity f ON a.user_id = f.user_id
    WHERE a.event_time >= '{{start_date}}'
    GROUP BY 1, 2
)
SELECT 
    cohort_week,
    MAX(CASE WHEN week_number = 0 THEN active_users END) AS cohort_size,
    ROUND(MAX(CASE WHEN week_number = 1 THEN active_users END) * 100.0 / NULLIF(MAX(CASE WHEN week_number = 0 THEN active_users END), 0), 2) AS w1_retention_pct,
    ROUND(MAX(CASE WHEN week_number = 2 THEN active_users END) * 100.0 / NULLIF(MAX(CASE WHEN week_number = 0 THEN active_users END), 0), 2) AS w2_retention_pct,
    ROUND(MAX(CASE WHEN week_number = 3 THEN active_users END) * 100.0 / NULLIF(MAX(CASE WHEN week_number = 0 THEN active_users END), 0), 2) AS w3_retention_pct
FROM activity_weeks
GROUP BY cohort_week
ORDER BY cohort_week DESC;`,
    params: [
      { name: 'event_table', label: '事件日志表名', defaultValue: 'user_events', description: '包含 user_id 和 event_time 的行为日志表' },
      { name: 'start_date', label: '起始分析日期', defaultValue: '2026-01-01', description: '留存分析观察窗口下限' },
    ],
    tags: ['留存分析', 'Cohort', '窗口函数', '用户增长'],
    isFavorite: true,
    createdAt: '2026-03-05T09:15:00.000Z',
    updatedAt: '2026-03-21T14:00:00.000Z',
  },
  {
    id: 'code-duckdb-pivot',
    type: 'code',
    title: 'DuckDB 原生 PIVOT 动态透视与多维度汇总',
    category: 'snippet',
    description: '利用 DuckDB 极简的 PIVOT 语法替代繁琐的 CASE WHEN 聚合，实现一键行列转置与矩阵报表生成。',
    sql: `-- 确保存在样本销售事实表（若不存在则自动准备，确保开箱即跑）
CREATE TEMP TABLE IF NOT EXISTS {{sales_table}} AS 
SELECT 
    i AS order_id,
    CASE (i % 4)
        WHEN 0 THEN 'Online'
        WHEN 1 THEN 'Offline'
        WHEN 2 THEN 'Store'
        ELSE 'Affiliate'
    END AS channel,
    CASE (i % 4)
        WHEN 0 THEN 'North'
        WHEN 1 THEN 'South'
        WHEN 2 THEN 'East'
        ELSE 'West'
    END AS region,
    ROUND(20.0 + (random() * 480.0), 2) AS revenue,
    DATE '2026-01-01' + INTERVAL (i % 90) DAY AS order_date
FROM range(1, 201) t(i);

-- DuckDB 原生 PIVOT 动态透视与多维度汇总
PIVOT {{sales_table}}
ON channel IN ('Online', 'Offline', 'Store', 'Affiliate')
USING sum(revenue) AS total_rev, count(order_id) AS total_orders
GROUP BY date_trunc('month', order_date) AS month, region
ORDER BY month DESC, region;`,
    params: [
      { name: 'sales_table', label: '销售事实表名', defaultValue: 'fact_sales', description: '待透视的目标销售明细数据表' },
    ],
    tags: ['DuckDB', 'PIVOT', '透视表', '报表'],
    isFavorite: false,
    createdAt: '2026-03-10T11:00:00.000Z',
    updatedAt: '2026-03-21T14:00:00.000Z',
  },

  // ==================== 2. 业务口径 (Metric Assets) ====================
  {
    id: 'metric-gmv-net',
    type: 'metric',
    name: 'GMV (净成交交易总额)',
    businessMeaning: '统计在统计周期内用户成功下单并完成支付的总金额，剔除在T+1内立即发生的拒付与全部无理由退款，是衡量核心主营交易规模的北极星指标。',
    calculationFormula: 'SUM(支付流水总金额) - SUM(全额退款金额) - SUM(商户补贴金)',
    sqlExpression: `SELECT 
    date_trunc('day', pay_time) AS stat_date,
    category_id,
    ROUND(SUM(pay_amount - coalesce(refund_amount, 0) - coalesce(merchant_subsidy, 0)), 2) AS net_gmv
FROM fact_order_payments
WHERE pay_status = 'SUCCESS'
  AND pay_time >= CURRENT_DATE - INTERVAL 30 DAYS
GROUP BY 1, 2;`,
    sourceTables: ['fact_order_payments', 'dim_product_category'],
    dimensions: ['stat_date (日期)', 'category_id (商品品类)', 'channel (渠道)'],
    owner: '交易分析中台 / 商业智能组',
    tags: ['GMV', '交易口径', '核心指标', '电商'],
    isFavorite: true,
    createdAt: '2026-02-18T10:00:00.000Z',
    updatedAt: '2026-03-12T16:00:00.000Z',
  },
  {
    id: 'metric-retention-d7',
    type: 'metric',
    name: '7日活跃留存率 (Day 7 Retention Rate)',
    businessMeaning: '目标新增/注册用户在激活第 7 天（即发生初始行为后的第 168~192 小时窗口内）再次产生至少一次有效业务事件的用户占比。衡量新客粘性与初阶流失拐点。',
    calculationFormula: '(第7天仍活跃的用户数 / 初始基准新增用户总数) * 100%',
    sqlExpression: `SELECT 
    reg.signup_date,
    COUNT(DISTINCT reg.user_id) AS base_new_users,
    COUNT(DISTINCT act.user_id) AS retained_d7_users,
    ROUND(COUNT(DISTINCT act.user_id) * 100.0 / NULLIF(COUNT(DISTINCT reg.user_id), 0), 2) AS d7_retention_rate_pct
FROM dim_user_registered reg
LEFT JOIN fact_user_activity act 
    ON reg.user_id = act.user_id 
   AND act.action_date = reg.signup_date + INTERVAL 7 DAYS
GROUP BY reg.signup_date
ORDER BY reg.signup_date DESC;`,
    sourceTables: ['dim_user_registered', 'fact_user_activity'],
    dimensions: ['signup_date (注册日期)', 'channel (注册渠道)', 'client_os (终端平台)'],
    owner: '增长与用户运营团队',
    tags: ['留存', '用户增长', '粘性指标', '产品北极星'],
    isFavorite: true,
    createdAt: '2026-02-25T14:30:00.000Z',
    updatedAt: '2026-03-18T09:00:00.000Z',
  },
  {
    id: 'metric-arpu',
    type: 'metric',
    name: 'ARPU (每活跃用户平均收入)',
    businessMeaning: '选定周期内总营运收入与当期去重活跃用户总数 (MAU 或 DAU) 的比值，反映产品生态内单客活跃价值。',
    calculationFormula: '期间总净收入 / 期间去重活跃用户数(Active Users)',
    sqlExpression: `WITH active_pool AS (
    SELECT user_id FROM fact_app_launches WHERE event_date >= '2026-03-01' GROUP BY user_id
),
revenue_pool AS (
    SELECT user_id, SUM(net_amount) AS user_rev FROM fact_billing WHERE billing_date >= '2026-03-01' GROUP BY user_id
)
SELECT 
    COUNT(a.user_id) AS active_users_count,
    ROUND(COALESCE(SUM(r.user_rev), 0), 2) AS total_revenue,
    ROUND(COALESCE(SUM(r.user_rev), 0) / NULLIF(COUNT(a.user_id), 0), 2) AS arpu
FROM active_pool a
LEFT JOIN revenue_pool r ON a.user_id = r.user_id;`,
    sourceTables: ['fact_app_launches', 'fact_billing'],
    dimensions: ['billing_period (计费周期)', 'user_tier (用户等级)'],
    owner: '财务商业化团队',
    tags: ['商业化', 'ARPU', '财务口径', '价值评估'],
    isFavorite: false,
    createdAt: '2026-03-02T16:00:00.000Z',
    updatedAt: '2026-03-14T11:20:00.000Z',
  },

  // ==================== 3. 知识笔记 (Note Assets) ====================
  {
    id: 'note-duckdb-wasm-limits',
    type: 'note',
    topic: 'pitfall',
    title: 'DuckDB WASM 浏览器端内存上限与大文件读取避坑指南',
    summary: '浏览器 32-bit WebAssembly 最大内存寻址通常限制在 2GB~4GB。处理巨型 CSV/Parquet 文件时避免直接全量拉取，需采用分批列投影与过滤策略。',
    content: `## 现象与痛点
在 Web 端的 DuckDB WASM 环境下直接执行如 \`SELECT * FROM read_csv('huge_file.csv')\` 时，若文件解压体积超过 2GB，浏览器会抛出致命的 \`Out of Memory (OOM)\` 或 \`WebAssembly.Memory.grow failed\` 异常。

---

## 避坑法则 (Best Practices)

### 1. 严格使用「列投影 (Projection Pushdown)」
不要使用 \`SELECT *\`，只提取分析所需的特定列，DuckDB 对 Parquet 和 CSV 均具备列式推断裁剪能力：
\`\`\`sql
-- 推荐：只投影必要列
SELECT order_id, user_id, amount 
FROM 'orders.parquet'
WHERE status = 'PAID';
\`\`\`

### 2. 善用「谓词下推 (Filter Pushdown)」与分区裁剪
利用 Parquet 文件内自带的 Column Statistics (Min/Max)，在扫描层即过滤掉无关行块：
\`\`\`sql
SELECT count(*) 
FROM 'orders.parquet' 
WHERE order_date >= '2026-03-01';
\`\`\`

### 3. 本地分块转存与临时表
若需要反复关联分析大表，建议创建内存临时表，并在不再使用时显式清理：
\`\`\`sql
CREATE TEMP TABLE t_summary AS 
SELECT user_id, sum(pay_amount) AS total 
FROM 'raw_log.parquet' 
GROUP BY user_id;

-- 分析完成后释放资源
DROP TABLE IF EXISTS t_summary;
\`\`\`
`,
    tags: ['DuckDB', 'WASM', '性能优化', '避坑指南', '内存管理'],
    references: ['https://duckdb.org/docs/api/wasm/overview', 'DuckDB WebAssembly Memory Management Guide'],
    isFavorite: true,
    createdAt: '2026-03-01T12:00:00.000Z',
    updatedAt: '2026-03-19T17:45:00.000Z',
  },
  {
    id: 'note-duckdb-tz-pitfalls',
    type: 'note',
    topic: 'pitfall',
    title: 'DuckDB 时间戳时区解析陷阱：TIMESTAMP 与 TIMESTAMPTZ 的本质区别',
    summary: 'DuckDB 中普通 TIMESTAMP 是无时区挂载的挂钟时间 (Wall Clock)，而 TIMESTAMPTZ 内部统一以 UTC 微秒存储。在跨时区汇总时混用会导致计算漂移。',
    content: `## 陷阱描述
很多开发者将带时区偏移的 ISO8601 字符串（如 \`2026-03-21T08:00:00+08:00\`）直接强制转换（\`::TIMESTAMP\`）：
\`\`\`sql
-- 错误示范：强制丢弃了 +08:00 偏移信息
SELECT '2026-03-21T08:00:00+08:00'::TIMESTAMP;
-- 结果变成了无时区的 2026-03-21 08:00:00
\`\`\`

若此时服务器默认时区为 UTC，直接使用 \`date_trunc('day', ...)\` 会产生整整 8 小时的业务归属偏移！

---

## 正确做法

### 1. 解析时保留时区类型
\`\`\`sql
-- 正确：转换为 TIMESTAMPTZ
SELECT '2026-03-21T08:00:00+08:00'::TIMESTAMPTZ;
\`\`\`

### 2. 统计时统一转换为业务目标时区
例如统一按 \`Asia/Shanghai\` 进行按日聚合截断：
\`\`\`sql
SELECT 
    date_trunc('day', event_time AT TIME ZONE 'Asia/Shanghai') AS stat_day,
    count(*) 
FROM logs 
GROUP BY 1;
\`\`\`
`,
    tags: ['DuckDB', '时区陷阱', 'Timestamp', '避坑指南'],
    references: ['https://duckdb.org/docs/sql/data_types/timestamp'],
    isFavorite: false,
    createdAt: '2026-03-08T15:00:00.000Z',
    updatedAt: '2026-03-16T18:20:00.000Z',
  },
  {
    id: 'note-duckdb-pivot-tips',
    type: 'note',
    topic: 'best_practice',
    title: 'DuckDB 高效数据探索：动态 PIVOT 与 UNPIVOT 技巧总结',
    summary: '相比传统 SQL，DuckDB 支持在 PIVOT 中动态省略列枚举，直接根据数据内容自动生成行转列列头，极大简化探索性数据分析。',
    content: `## 为什么 DuckDB 的 PIVOT 体验领先？
传统 PostgreSQL 或 MySQL 做透视表需要繁琐的手写数十个 \`MAX(CASE WHEN ... THEN ... END)\`。

DuckDB 原生提供 \`PIVOT\` 语法：
\`\`\`sql
PIVOT cities ON year USING sum(population);
\`\`\`

### 亮点一：动态推断转置列
如果不指定 \`IN (...)\`，DuckDB 会自动预先执行一次去重扫描，根据数据中实际存在的值自动决定展开的列！
\`\`\`sql
PIVOT sales 
ON product_category 
USING sum(amount) 
GROUP BY region;
\`\`\`

### 亮点二：UNPIVOT 宽表转长表
针对从 Excel 导入的宽表，一键转为标准结构：
\`\`\`sql
UNPIVOT monthly_sales
ON q1, q2, q3, q4
INTO
    NAME quarter
    VALUE revenue;
\`\`\`
`,
    tags: ['DuckDB', 'PIVOT', '最佳实践', '数据重塑'],
    references: ['https://duckdb.org/docs/sql/statements/pivot'],
    isFavorite: true,
    createdAt: '2026-03-12T10:00:00.000Z',
    updatedAt: '2026-03-18T12:00:00.000Z',
  },
];
