import{R as ee,r as m,j as e}from"./vendor-codemirror-D3OHpW-1.js";import{r as ze,K as en,B as ye,a as nn,aJ as tn,c as an,X as Pe,H as he,a0 as ue,U as on,D as sn,O as rn,as as cn,a5 as xe,L as Ie,aE as re,a1 as Be,f as Ae,g as Ce,aq as fe,aK as ln,i as He,n as Ve,Y as dn,ax as mn,F as ke,j as En,ac as je,p as ce,aL as pn,V as We,$ as _n,q as qe,e as Tn,o as Ge,d as un,a3 as An,z as Nn,t as U,aM as Me,ah as Sn,h as Rn,aN as Ye,aO as Ue,J as yn,M as Fe}from"./index-CZ1e9q0q.js";import{M as pe}from"./MarkdownPreview-Cb9fZlqR.js";import{S as On}from"./settings-2-DQFGiFTE.js";import{T as _e}from"./index-C-kWhipi.js";import{L as ve,B as Te}from"./list-ordered-Qa8iAmOx.js";import{P as Je}from"./pen-line-D4obUbD-.js";import"./vendor-ai-BFZOlLET.js";import"./vendor-reactflow-DSysmNhL.js";import"./vendor-mermaid-CZUUdkMV.js";import"./vendor-d3-CpblCyhw.js";import"./duckdb-wasm-BsFFebBU.js";import"./vendor-charts-B9SJeqYv.js";/**
 * @license lucide-react v0.563.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ln=[["path",{d:"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2",key:"975kel"}],["circle",{cx:"12",cy:"7",r:"4",key:"17ys0d"}]],gn=ze("user",Ln),Le=[{id:"code-parquet-inspect",type:"code",title:"Parquet 极速元数据与数据分布抽样",category:"template",description:"利用 DuckDB 极速读取 Parquet 元数据信息，并基于 Reservoir Sampling 抽取固定比例样本进行快速剖析。",sql:`-- 1. 自动在 DuckDB WASM 虚拟文件系统中准备一份样本 Parquet 文件（确保开箱即跑）
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
LIMIT 100;`,params:[{name:"file_path",label:"Parquet 文件路径或URL",defaultValue:"orders_sample.parquet",description:"虚拟文件系统或远程 Parquet 文件路径"},{name:"sample_percentage",label:"抽样百分比 (%)",defaultValue:"10",description:"按行伯努利采样比例"}],tags:["DuckDB","Parquet","数据探索","抽样分析"],isFavorite:!0,createdAt:"2026-03-01T08:00:00.000Z",updatedAt:"2026-03-21T18:00:00.000Z"},{id:"code-retention-cohort",type:"code",title:"用户留存队列分析 (Cohort Retention Model)",category:"template",description:"标准 Cohort 留存模型：按首访自然周聚合首购用户，并计算次周、第3周到第8周的留存率与留存人数矩阵。",sql:`-- 确保存在样本行为日志表（若不存在则自动准备，确保开箱即跑）
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
ORDER BY cohort_week DESC;`,params:[{name:"event_table",label:"事件日志表名",defaultValue:"user_events",description:"包含 user_id 和 event_time 的行为日志表"},{name:"start_date",label:"起始分析日期",defaultValue:"2026-01-01",description:"留存分析观察窗口下限"}],tags:["留存分析","Cohort","窗口函数","用户增长"],isFavorite:!0,createdAt:"2026-03-05T09:15:00.000Z",updatedAt:"2026-03-21T14:00:00.000Z"},{id:"code-duckdb-pivot",type:"code",title:"DuckDB 原生 PIVOT 动态透视与多维度汇总",category:"snippet",description:"利用 DuckDB 极简的 PIVOT 语法替代繁琐的 CASE WHEN 聚合，实现一键行列转置与矩阵报表生成。",sql:`-- 确保存在样本销售事实表（若不存在则自动准备，确保开箱即跑）
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
ORDER BY month DESC, region;`,params:[{name:"sales_table",label:"销售事实表名",defaultValue:"fact_sales",description:"待透视的目标销售明细数据表"}],tags:["DuckDB","PIVOT","透视表","报表"],isFavorite:!1,createdAt:"2026-03-10T11:00:00.000Z",updatedAt:"2026-03-21T14:00:00.000Z"},{id:"metric-gmv-net",type:"metric",name:"GMV (净成交交易总额)",businessMeaning:"统计在统计周期内用户成功下单并完成支付的总金额，剔除在T+1内立即发生的拒付与全部无理由退款，是衡量核心主营交易规模的北极星指标。",calculationFormula:"SUM(支付流水总金额) - SUM(全额退款金额) - SUM(商户补贴金)",sqlExpression:`SELECT 
    date_trunc('day', pay_time) AS stat_date,
    category_id,
    ROUND(SUM(pay_amount - coalesce(refund_amount, 0) - coalesce(merchant_subsidy, 0)), 2) AS net_gmv
FROM fact_order_payments
WHERE pay_status = 'SUCCESS'
  AND pay_time >= CURRENT_DATE - INTERVAL 30 DAYS
GROUP BY 1, 2;`,sourceTables:["fact_order_payments","dim_product_category"],dimensions:["stat_date (日期)","category_id (商品品类)","channel (渠道)"],owner:"交易分析中台 / 商业智能组",tags:["GMV","交易口径","核心指标","电商"],isFavorite:!0,createdAt:"2026-02-18T10:00:00.000Z",updatedAt:"2026-03-12T16:00:00.000Z"},{id:"metric-retention-d7",type:"metric",name:"7日活跃留存率 (Day 7 Retention Rate)",businessMeaning:"目标新增/注册用户在激活第 7 天（即发生初始行为后的第 168~192 小时窗口内）再次产生至少一次有效业务事件的用户占比。衡量新客粘性与初阶流失拐点。",calculationFormula:"(第7天仍活跃的用户数 / 初始基准新增用户总数) * 100%",sqlExpression:`SELECT 
    reg.signup_date,
    COUNT(DISTINCT reg.user_id) AS base_new_users,
    COUNT(DISTINCT act.user_id) AS retained_d7_users,
    ROUND(COUNT(DISTINCT act.user_id) * 100.0 / NULLIF(COUNT(DISTINCT reg.user_id), 0), 2) AS d7_retention_rate_pct
FROM dim_user_registered reg
LEFT JOIN fact_user_activity act 
    ON reg.user_id = act.user_id 
   AND act.action_date = reg.signup_date + INTERVAL 7 DAYS
GROUP BY reg.signup_date
ORDER BY reg.signup_date DESC;`,sourceTables:["dim_user_registered","fact_user_activity"],dimensions:["signup_date (注册日期)","channel (注册渠道)","client_os (终端平台)"],owner:"增长与用户运营团队",tags:["留存","用户增长","粘性指标","产品北极星"],isFavorite:!0,createdAt:"2026-02-25T14:30:00.000Z",updatedAt:"2026-03-18T09:00:00.000Z"},{id:"metric-arpu",type:"metric",name:"ARPU (每活跃用户平均收入)",businessMeaning:"选定周期内总营运收入与当期去重活跃用户总数 (MAU 或 DAU) 的比值，反映产品生态内单客活跃价值。",calculationFormula:"期间总净收入 / 期间去重活跃用户数(Active Users)",sqlExpression:`WITH active_pool AS (
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
LEFT JOIN revenue_pool r ON a.user_id = r.user_id;`,sourceTables:["fact_app_launches","fact_billing"],dimensions:["billing_period (计费周期)","user_tier (用户等级)"],owner:"财务商业化团队",tags:["商业化","ARPU","财务口径","价值评估"],isFavorite:!1,createdAt:"2026-03-02T16:00:00.000Z",updatedAt:"2026-03-14T11:20:00.000Z"},{id:"note-duckdb-wasm-limits",type:"note",topic:"pitfall",title:"DuckDB WASM 浏览器端内存上限与大文件读取避坑指南",summary:"浏览器 32-bit WebAssembly 最大内存寻址通常限制在 2GB~4GB。处理巨型 CSV/Parquet 文件时避免直接全量拉取，需采用分批列投影与过滤策略。",content:`## 现象与痛点
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
`,tags:["DuckDB","WASM","性能优化","避坑指南","内存管理"],references:["https://duckdb.org/docs/api/wasm/overview","DuckDB WebAssembly Memory Management Guide"],isFavorite:!0,createdAt:"2026-03-01T12:00:00.000Z",updatedAt:"2026-03-19T17:45:00.000Z"},{id:"note-duckdb-tz-pitfalls",type:"note",topic:"pitfall",title:"DuckDB 时间戳时区解析陷阱：TIMESTAMP 与 TIMESTAMPTZ 的本质区别",summary:"DuckDB 中普通 TIMESTAMP 是无时区挂载的挂钟时间 (Wall Clock)，而 TIMESTAMPTZ 内部统一以 UTC 微秒存储。在跨时区汇总时混用会导致计算漂移。",content:`## 陷阱描述
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
`,tags:["DuckDB","时区陷阱","Timestamp","避坑指南"],references:["https://duckdb.org/docs/sql/data_types/timestamp"],isFavorite:!1,createdAt:"2026-03-08T15:00:00.000Z",updatedAt:"2026-03-16T18:20:00.000Z"},{id:"note-duckdb-pivot-tips",type:"note",topic:"best_practice",title:"DuckDB 高效数据探索：动态 PIVOT 与 UNPIVOT 技巧总结",summary:"相比传统 SQL，DuckDB 支持在 PIVOT 中动态省略列枚举，直接根据数据内容自动生成行转列列头，极大简化探索性数据分析。",content:`## 为什么 DuckDB 的 PIVOT 体验领先？
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
`,tags:["DuckDB","PIVOT","最佳实践","数据重塑"],references:["https://duckdb.org/docs/sql/statements/pivot"],isFavorite:!0,createdAt:"2026-03-12T10:00:00.000Z",updatedAt:"2026-03-18T12:00:00.000Z"}],bn=`---
id: "code-duckdb-pivot"
title: "DuckDB 原生 PIVOT 动态透视与多维度汇总"
category: "snippet"
description: "利用 DuckDB 极简的 PIVOT 语法替代繁琐的 CASE WHEN 聚合，实现一键行列转置与矩阵报表生成。"
isFavorite: false
createdAt: "2026-03-10T11:00:00.000Z"
updatedAt: "2026-03-10T11:00:00.000Z"
tags:
  - "DuckDB"
  - "PIVOT"
  - "透视表"
  - "报表"
params:
  - name: "sales_table"
    label: "销售事实表名"
    defaultValue: "fact_sales"
    description: "待透视的目标销售明细数据表"
---

\`\`\`sql
-- 确保存在样本销售事实表（若不存在则自动准备，确保开箱即跑）
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
ORDER BY month DESC, region;
\`\`\`
`,hn=`---
id: "note-duckdb-memory-tuning"
type: "note"
isFavorite: true
createdAt: "2026-03-01T10:00:00.000Z"
updatedAt: "2026-03-21T15:00:00.000Z"
tags:
  - "DuckDB"
  - "内存优化"
  - "性能调优"
  - "架构避坑"
title: "DuckDB 生产级内存配额调优与 OOM 防御指南"
topic: "optimization"
summary: "深入剖析 DuckDB 在受限容器与浏览器 WASM 环境中的内存分配机制，提供 max_memory、temp_directory 与 preserve_insertion_order 的组合调优策略。"
references:
  - "https://duckdb.org/docs/configuration/overview"
  - "https://duckdb.org/docs/guides/performance/how_to_tune_workloads"
---

# DuckDB 生产级内存配额调优与 OOM 防御指南

> [!IMPORTANT]
> 在并发分析与大宽表聚合场景下，DuckDB 默认会尝试使用系统物理内存的 80%。在容器化（K8s/Docker）或浏览器端（WASM 2GB/4GB 限制）中，必须显式收紧 \`max_memory\`，否则可能触发宿主系统的 OOM Killer。

## 1. 核心控制参数矩阵

| 参数名称 | 默认值 | 推荐生产配置 | 核心作用说明 |
| :--- | :--- | :--- | :--- |
| \`max_memory\` | \`物理内存 * 80%\` | 容器 Limit 的 70% | 限制缓冲池（Buffer Manager）最大可用内存 |
| \`temp_directory\` | 系统临时目录 | 高速 SSD 挂载卷 | 内存不足时数据落盘 Spilling 目录 |
| \`preserve_insertion_order\` | \`true\` | 大扫描下置为 \`false\` | 关闭保持行插入顺序可节省约 15% 内存开销 |
| \`threads\` | CPU 物理核数 | \`min(CPU核数, 8)\` | 并发线程池上限，防止线程风暴引发内存急剧膨胀 |

## 2. 调优生效 SQL 配置脚本

\`\`\`sql
-- 1. 显式限制最大缓冲内存为 2GB
SET max_memory = '2GB';

-- 2. 关闭保持插入顺序，加速海量数据聚合
SET preserve_insertion_order = false;

-- 3. 查看当前内存与临时缓冲状态
SELECT * FROM duckdb_settings() 
WHERE name IN ('max_memory', 'threads', 'preserve_insertion_order');
\`\`\`

> [!TIP]
> 当处理超过内存上限的巨大 Parquet 文件时，DuckDB 会自动开启流式查询（Streaming Execution）与外排序（External Merge Sort）。务必确保 \`temp_directory\` 所在磁盘有至少目标数据量 1.5 倍的剩余空间。

## 3. 常见避坑要点 (Anti-patterns)

- **避免无限制 \`SELECT *\`**：在宽表（>100 列）上全量投影会导致大量列在内存中被解压；
- **慎用超大窗口全量排序**：\`OVER (ORDER BY id)\` 在无分区键时会退化为全局单点排序，极易引发内存水位陡增；
- **浏览器 WASM 环境清理**：执行完毕海量临时分析后，建议执行 \`PRAGMA shrink_memory;\` 强制触发 GC 回收。
`,xn=`---
id: "duckdb-sql-complete"
type: "note"
isFavorite: false
createdAt: "2026-09-22T00:57:29.610Z"
updatedAt: "2026-09-22T00:57:29.610Z"
tags:
  - "入门"
  - "DuckDB"
  - "教程"
title: "DuckDB SQL 完整使用教程"
topic: "best_practice"
summary: "pip install duckdb npm install duckdb"
---

# DuckDB SQL 完整使用教程

## 目录
1. [环境准备](#1-环境准备)
2. [数据库与表操作](#2-数据库与表操作)
3. [增删改查 (CRUD)](#3-增删改查-crud)
4. [连接操作 (JOIN)](#4-连接操作-join)
5. [视图 (VIEW)](#5-视图-view)
6. [事务 (TRANSACTION)](#6-事务-transaction)
7. [高级特性](#7-高级特性)

---

## 1. 环境准备

### 安装 DuckDB

\`\`\`bash
# Python
pip install duckdb

# Node.js
npm install duckdb

# CLI (macOS)
brew install duckdb
\`\`\`

### 启动 DuckDB

\`\`\`bash
# 内存模式（数据不持久化）
duckdb

# 文件模式（数据持久化到文件）
duckdb my_database.db
\`\`\`

### Python 中使用

\`\`\`python
import duckdb

# 内存数据库
con = duckdb.connect()

# 持久化数据库
con = duckdb.connect('my_database.db')

# 执行 SQL
con.execute("SELECT 'Hello DuckDB!' AS greeting").fetchall()
\`\`\`

---

## 2. 数据库与表操作

### 2.1 创建表（CREATE TABLE）

\`\`\`sql
-- ========================================
-- 创建部门表
-- ========================================
CREATE TABLE departments (
    dept_id     INTEGER PRIMARY KEY,
    dept_name   VARCHAR(50) NOT NULL,
    location    VARCHAR(100),
    budget      DECIMAL(15, 2) DEFAULT 0.00,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- 创建员工表
-- ========================================
CREATE TABLE employees (
    emp_id      INTEGER PRIMARY KEY,
    first_name  VARCHAR(50) NOT NULL,
    last_name   VARCHAR(50) NOT NULL,
    email       VARCHAR(100) UNIQUE,
    phone       VARCHAR(20),
    hire_date   DATE NOT NULL,
    salary      DECIMAL(10, 2),
    dept_id     INTEGER REFERENCES departments(dept_id),
    manager_id  INTEGER REFERENCES employees(emp_id),
    is_active   BOOLEAN DEFAULT TRUE
);

-- ========================================
-- 创建项目表
-- ========================================
CREATE TABLE projects (
    project_id   INTEGER PRIMARY KEY,
    project_name VARCHAR(100) NOT NULL,
    start_date   DATE,
    end_date     DATE,
    status       VARCHAR(20) DEFAULT 'planning',   -- planning/active/completed/cancelled
    dept_id      INTEGER REFERENCES departments(dept_id),
    budget       DECIMAL(12, 2),
    
    -- 表级约束：确保结束日期晚于开始日期
    CHECK (end_date IS NULL OR end_date >= start_date)
);

-- ========================================
-- 创建员工-项目关联表（多对多关系）
-- ========================================
CREATE TABLE employee_projects (
    emp_id      INTEGER REFERENCES employees(emp_id),
    project_id  INTEGER REFERENCES projects(project_id),
    role        VARCHAR(50) DEFAULT 'member',       -- member/lead/reviewer
    join_date   DATE DEFAULT CURRENT_DATE,
    hours_worked DECIMAL(8, 2) DEFAULT 0,
    PRIMARY KEY (emp_id, project_id)
);

-- ========================================
-- 创建工资记录表（用于演示事务）
-- ========================================
CREATE TABLE salary_history (
    history_id   INTEGER PRIMARY KEY,
    emp_id       INTEGER REFERENCES employees(emp_id),
    old_salary   DECIMAL(10, 2),
    new_salary   DECIMAL(10, 2),
    change_date  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    change_reason VARCHAR(200)
);
\`\`\`

### 2.2 修改表结构（ALTER TABLE）

\`\`\`sql
-- 添加列
ALTER TABLE employees ADD COLUMN performance_rating INTEGER;

-- 删除列
ALTER TABLE employees DROP COLUMN performance_rating;

-- 重命名表
ALTER TABLE departments RENAME TO dept_backup;
ALTER TABLE dept_backup RENAME TO departments;

-- 重命名列
ALTER TABLE employees RENAME COLUMN phone TO phone_number;
ALTER TABLE employees RENAME COLUMN phone_number TO phone;
\`\`\`

### 2.3 查看表信息

\`\`\`sql
-- 查看所有表
SHOW TABLES;

-- 查看表结构
DESCRIBE employees;
-- 或
PRAGMA table_info('employees');

-- 查看建表语句（DuckDB 特有）
SELECT sql FROM duckdb_tables() WHERE table_name = 'employees';
\`\`\`

### 2.4 删除表（DROP TABLE）

\`\`\`sql
-- 删除表（不存在时报错）
DROP TABLE table_name;

-- 安全删除（不存在时不报错）
DROP TABLE IF EXISTS table_name;
\`\`\`

---

## 3. 增删改查 (CRUD)

### 3.1 插入数据（CREATE - INSERT）

\`\`\`sql
-- ========================================
-- 插入部门数据
-- ========================================
INSERT INTO departments (dept_id, dept_name, location, budget) VALUES
    (1, '技术研发部', '北京-海淀', 5000000.00),
    (2, '市场营销部', '上海-浦东', 3000000.00),
    (3, '人力资源部', '北京-朝阳', 1500000.00),
    (4, '财务部',     '深圳-南山', 2000000.00),
    (5, '产品设计部', '杭州-西湖', 2500000.00);

-- ========================================
-- 插入员工数据
-- ========================================
INSERT INTO employees (emp_id, first_name, last_name, email, phone, hire_date, salary, dept_id, manager_id, is_active) VALUES
    (1,  '明',  '张', 'zhang.ming@company.com',   '13800001001', '2020-03-15', 35000.00, 1, NULL,  TRUE),
    (2,  '丽',  '李', 'li.li@company.com',        '13800001002', '2020-05-20', 30000.00, 1, 1,     TRUE),
    (3,  '强',  '王', 'wang.qiang@company.com',    '13800001003', '2019-08-10', 38000.00, 1, NULL,  TRUE),
    (4,  '芳',  '赵', 'zhao.fang@company.com',     '13800001004', '2021-01-05', 25000.00, 2, NULL,  TRUE),
    (5,  '伟',  '刘', 'liu.wei@company.com',       '13800001005', '2021-06-15', 28000.00, 2, 4,     TRUE),
    (6,  '娜',  '陈', 'chen.na@company.com',       '13800001006', '2020-11-20', 22000.00, 3, NULL,  TRUE),
    (7,  '鹏',  '杨', 'yang.peng@company.com',     '13800001007', '2022-02-28', 20000.00, 3, 6,     TRUE),
    (8,  '雪',  '黄', 'huang.xue@company.com',     '13800001008', '2019-04-12', 32000.00, 4, NULL,  TRUE),
    (9,  '军',  '周', 'zhou.jun@company.com',      '13800001009', '2022-07-01', 26000.00, 1, 1,     TRUE),
    (10, '婷',  '吴', 'wu.ting@company.com',       '13800001010', '2023-01-10', 24000.00, 5, NULL,  TRUE),
    (11, '磊',  '郑', 'zheng.lei@company.com',     '13800001011', '2020-09-05', 29000.00, 5, 10,    TRUE),
    (12, '静',  '孙', 'sun.jing@company.com',      '13800001012', '2023-03-20', 21000.00, 2, 4,     FALSE);

-- ========================================
-- 插入项目数据
-- ========================================
INSERT INTO projects (project_id, project_name, start_date, end_date, status, dept_id, budget) VALUES
    (1, '智能推荐系统 V2.0',     '2024-01-01', '2024-06-30', 'active',    1, 800000.00),
    (2, '品牌升级营销活动',      '2024-02-15', '2024-05-31', 'active',    2, 500000.00),
    (3, '员工培训体系建设',      '2024-03-01', '2024-12-31', 'planning',  3, 200000.00),
    (4, '财务自动化系统',        '2023-06-01', '2024-03-31', 'completed', 4, 600000.00),
    (5, '移动端APP重构',         '2024-04-01', NULL,         'planning',  1, 1000000.00),
    (6, '用户体验优化项目',      '2024-01-15', '2024-08-31', 'active',    5, 350000.00);

-- ========================================
-- 插入员工-项目关联数据
-- ========================================
INSERT INTO employee_projects (emp_id, project_id, role, join_date, hours_worked) VALUES
    (1,  1, 'lead',     '2024-01-01', 320.5),
    (2,  1, 'member',   '2024-01-15', 280.0),
    (3,  1, 'reviewer', '2024-01-01', 45.0),
    (9,  1, 'member',   '2024-02-01', 200.0),
    (4,  2, 'lead',     '2024-02-15', 250.0),
    (5,  2, 'member',   '2024-02-20', 180.0),
    (12, 2, 'member',   '2024-02-20', 30.0),
    (6,  3, 'lead',     '2024-03-01', 60.0),
    (7,  3, 'member',   '2024-03-01', 40.0),
    (8,  4, 'lead',     '2023-06-01', 500.0),
    (3,  5, 'lead',     '2024-04-01', 80.0),
    (1,  5, 'reviewer', '2024-04-01', 20.0),
    (10, 6, 'lead',     '2024-01-15', 200.0),
    (11, 6, 'member',   '2024-01-20', 175.0);

-- ========================================
-- 通过 SELECT 插入（从查询结果插入）
-- ========================================
CREATE TABLE high_salary_employees AS
    SELECT emp_id, first_name, last_name, salary, dept_id
    FROM employees
    WHERE salary > 30000;

-- 查看结果
SELECT * FROM high_salary_employees;

-- 用完清理
DROP TABLE high_salary_employees;
\`\`\`

### 3.2 查询数据（READ - SELECT）

#### 基础查询

\`\`\`sql
-- 查询所有列
SELECT * FROM employees;

-- 查询指定列
SELECT emp_id, first_name, last_name, salary
FROM employees;

-- 使用别名
SELECT 
    emp_id        AS 员工编号,
    first_name    AS 名,
    last_name     AS 姓,
    salary        AS 月薪,
    salary * 12   AS 年薪
FROM employees;

-- 去重查询
SELECT DISTINCT dept_id FROM employees;
\`\`\`

#### WHERE 条件查询

\`\`\`sql
-- 基本比较
SELECT * FROM employees WHERE salary > 28000;

-- 多条件组合（AND / OR）
SELECT * FROM employees
WHERE dept_id = 1 AND salary > 25000;

SELECT * FROM employees
WHERE dept_id = 1 OR dept_id = 2;

-- IN 操作符
SELECT * FROM employees
WHERE dept_id IN (1, 2, 5);

-- BETWEEN 范围查询
SELECT * FROM employees
WHERE salary BETWEEN 25000 AND 35000;

-- LIKE 模糊查询
SELECT * FROM employees
WHERE email LIKE '%company.com';

SELECT * FROM employees
WHERE first_name LIKE '___';       -- 恰好3个字符（注意中文可能不同）

-- IS NULL / IS NOT NULL
SELECT * FROM employees
WHERE manager_id IS NULL;          -- 查找没有上级的员工（部门主管）

-- NOT 取反
SELECT * FROM employees
WHERE dept_id NOT IN (1, 2);

-- 布尔条件
SELECT * FROM employees
WHERE is_active = TRUE;

-- 日期条件
SELECT * FROM employees
WHERE hire_date >= '2022-01-01';
\`\`\`

#### 排序与分页

\`\`\`sql
-- ORDER BY 排序
SELECT * FROM employees
ORDER BY salary DESC;                            -- 降序

SELECT * FROM employees
ORDER BY dept_id ASC, salary DESC;               -- 多列排序

-- LIMIT 与 OFFSET（分页）
SELECT * FROM employees
ORDER BY emp_id
LIMIT 5;                                         -- 前5条

SELECT * FROM employees
ORDER BY emp_id
LIMIT 5 OFFSET 5;                                -- 第6-10条（第2页）
\`\`\`

#### 聚合函数与 GROUP BY

\`\`\`sql
-- 常用聚合函数
SELECT 
    COUNT(*)          AS 员工总数,
    AVG(salary)       AS 平均薪资,
    MAX(salary)       AS 最高薪资,
    MIN(salary)       AS 最低薪资,
    SUM(salary)       AS 薪资总和,
    MEDIAN(salary)    AS 薪资中位数     -- DuckDB 特有
FROM employees
WHERE is_active = TRUE;

-- GROUP BY 分组统计
SELECT 
    dept_id,
    COUNT(*)            AS 部门人数,
    ROUND(AVG(salary), 2)  AS 平均薪资,
    MAX(salary)         AS 最高薪资,
    MIN(salary)         AS 最低薪资
FROM employees
WHERE is_active = TRUE
GROUP BY dept_id
ORDER BY 平均薪资 DESC;

-- HAVING 过滤分组结果
SELECT 
    dept_id,
    COUNT(*)              AS 部门人数,
    ROUND(AVG(salary), 2) AS 平均薪资
FROM employees
WHERE is_active = TRUE
GROUP BY dept_id
HAVING COUNT(*) >= 2                    -- 只显示2人以上的部门
ORDER BY 平均薪资 DESC;
\`\`\`

#### 子查询

\`\`\`sql
-- 标量子查询：薪资高于平均值的员工
SELECT first_name, last_name, salary
FROM employees
WHERE salary > (SELECT AVG(salary) FROM employees);

-- IN 子查询：查询参与了"active"项目的员工
SELECT first_name, last_name
FROM employees
WHERE emp_id IN (
    SELECT DISTINCT ep.emp_id
    FROM employee_projects ep
    JOIN projects p ON ep.project_id = p.project_id
    WHERE p.status = 'active'
);

-- EXISTS 子查询：查询至少参与了一个项目的员工
SELECT e.first_name, e.last_name
FROM employees e
WHERE EXISTS (
    SELECT 1
    FROM employee_projects ep
    WHERE ep.emp_id = e.emp_id
);

-- 派生表（FROM 子查询）
SELECT dept_id, avg_salary
FROM (
    SELECT dept_id, AVG(salary) AS avg_salary
    FROM employees
    GROUP BY dept_id
) dept_stats
WHERE avg_salary > 25000;
\`\`\`

#### DuckDB 特色查询

\`\`\`sql
-- QUALIFY 子句（窗口函数过滤，无需子查询包装）
-- 每个部门薪资最高的员工
SELECT 
    emp_id, first_name, last_name, dept_id, salary,
    ROW_NUMBER() OVER (PARTITION BY dept_id ORDER BY salary DESC) AS rn
FROM employees
QUALIFY rn = 1;

-- SAMPLE 抽样查询
SELECT * FROM employees USING SAMPLE 50%;        -- 随机50%
SELECT * FROM employees USING SAMPLE 3 ROWS;     -- 随机3行

-- EXCLUDE 排除列
SELECT * EXCLUDE (phone, email, is_active) FROM employees;

-- REPLACE 替换列表达式
SELECT * REPLACE (salary * 12 AS salary) FROM employees;

-- COLUMNS 正则匹配列
SELECT COLUMNS('.*name.*') FROM employees;
\`\`\`

### 3.3 更新数据（UPDATE）

\`\`\`sql
-- 更新单条记录
UPDATE employees
SET salary = 36000.00
WHERE emp_id = 1;

-- 更新多列
UPDATE employees
SET 
    salary = 27000.00,
    is_active = TRUE
WHERE emp_id = 12;

-- 条件批量更新（全部门加薪5%）
UPDATE employees
SET salary = salary * 1.05
WHERE dept_id = 1;

-- 使用子查询更新
UPDATE employees
SET salary = salary * 1.10
WHERE emp_id IN (
    SELECT ep.emp_id
    FROM employee_projects ep
    WHERE ep.role = 'lead'
);

-- 更新项目状态
UPDATE projects
SET status = 'active'
WHERE project_id = 5;
\`\`\`

### 3.4 删除数据（DELETE）

\`\`\`sql
-- 删除单条记录
DELETE FROM employee_projects
WHERE emp_id = 12 AND project_id = 2;

-- 条件删除
DELETE FROM employees
WHERE is_active = FALSE AND emp_id NOT IN (
    SELECT emp_id FROM employee_projects
);

-- ⚠️ 清空表（删除所有数据，保留表结构）
-- DELETE FROM table_name;        -- 逐行删除
-- TRUNCATE TABLE table_name;     -- 快速清空（DuckDB 不支持 TRUNCATE，用 DELETE）

-- 重新插入被删除的数据以保持后续示例正常
INSERT INTO employee_projects (emp_id, project_id, role, join_date, hours_worked) VALUES
    (12, 2, 'member', '2024-02-20', 30.0);
INSERT INTO employees (emp_id, first_name, last_name, email, phone, hire_date, salary, dept_id, manager_id, is_active) VALUES
    (12, '静', '孙', 'sun.jing@company.com', '13800001012', '2023-03-20', 21000.00, 2, 4, FALSE)
ON CONFLICT (emp_id) DO UPDATE SET is_active = FALSE;
\`\`\`

### 3.5 UPSERT（INSERT OR UPDATE）

\`\`\`sql
-- INSERT OR REPLACE（DuckDB 支持 ON CONFLICT）
INSERT INTO employees (emp_id, first_name, last_name, email, hire_date, salary, dept_id)
VALUES (12, '静', '孙', 'sun.jing@company.com', '2023-03-20', 23000.00, 2)
ON CONFLICT (emp_id) DO UPDATE SET
    salary = EXCLUDED.salary;

-- INSERT OR IGNORE（冲突时忽略）
INSERT INTO employees (emp_id, first_name, last_name, email, hire_date, salary, dept_id)
VALUES (12, '静', '孙', 'sun.jing_new@company.com', '2023-03-20', 23000.00, 2)
ON CONFLICT (emp_id) DO NOTHING;
\`\`\`

---

## 4. 连接操作 (JOIN)

> 下面通过可视化示意图和实例全面演示各种 JOIN。

\`\`\`
┌──────────────────────────────────────────────────────────┐
│                     JOIN 类型概览                         │
├──────────────────────────────────────────────────────────┤
│                                                          │
│   INNER JOIN         LEFT JOIN          RIGHT JOIN       │
│   ┌───┐ ┌───┐      ┌───┐ ┌───┐       ┌───┐ ┌───┐      │
│   │ A ├─┤ B │      │ A ├─┤ B │       │ A ├─┤ B │      │
│   │   │█│   │      │███│█│   │       │   │█│███│      │
│   └───┘ └───┘      └───┘ └───┘       └───┘ └───┘      │
│   只保留交集        保留左表全部       保留右表全部       │
│                                                          │
│   FULL OUTER JOIN   CROSS JOIN         SELF JOIN        │
│   ┌───┐ ┌───┐      A × B              表自身连接        │
│   │ A ├─┤ B │      每行与每行                           │
│   │███│█│███│      笛卡尔积                             │
│   └───┘ └───┘                                           │
│   保留两表全部                                           │
└──────────────────────────────────────────────────────────┘
\`\`\`

### 4.1 INNER JOIN（内连接）

\`\`\`sql
-- 查询所有员工及其部门信息（只返回有匹配的记录）
SELECT 
    e.emp_id,
    e.first_name || ' ' || e.last_name AS 员工姓名,
    e.salary,
    d.dept_name,
    d.location
FROM employees e
INNER JOIN departments d ON e.dept_id = d.dept_id
ORDER BY d.dept_name, e.salary DESC;
\`\`\`

### 4.2 LEFT JOIN（左连接）

\`\`\`sql
-- 查询所有部门及其员工数（即使部门没有员工也显示）
SELECT 
    d.dept_id,
    d.dept_name,
    d.budget AS 部门预算,
    COUNT(e.emp_id)         AS 员工人数,
    COALESCE(SUM(e.salary), 0)  AS 薪资总和
FROM departments d
LEFT JOIN employees e ON d.dept_id = e.dept_id AND e.is_active = TRUE
GROUP BY d.dept_id, d.dept_name, d.budget
ORDER BY 员工人数 DESC;

-- 查询没有参与任何项目的员工（LEFT JOIN + IS NULL 模式）
SELECT 
    e.emp_id,
    e.first_name || ' ' || e.last_name AS 员工姓名,
    e.dept_id
FROM employees e
LEFT JOIN employee_projects ep ON e.emp_id = ep.emp_id
WHERE ep.emp_id IS NULL;
\`\`\`

### 4.3 RIGHT JOIN（右连接）

\`\`\`sql
-- 查询所有项目及其负责人信息（即使项目没有分配人员也显示）
SELECT 
    p.project_id,
    p.project_name,
    p.status,
    e.first_name || ' ' || e.last_name AS 负责人,
    ep.role
FROM employee_projects ep
RIGHT JOIN projects p ON ep.project_id = p.project_id AND ep.role = 'lead'
LEFT JOIN employees e ON ep.emp_id = e.emp_id
ORDER BY p.project_id;
\`\`\`

### 4.4 FULL OUTER JOIN（全外连接）

\`\`\`sql
-- 创建临时数据演示 FULL OUTER JOIN
CREATE TEMP TABLE team_a (id INT, name VARCHAR);
CREATE TEMP TABLE team_b (id INT, name VARCHAR);

INSERT INTO team_a VALUES (1, 'Alice'), (2, 'Bob'), (3, 'Charlie');
INSERT INTO team_b VALUES (2, 'Bob'), (3, 'Charlie'), (4, 'Diana');

-- FULL OUTER JOIN：显示两个团队的全部成员
SELECT 
    COALESCE(a.id, b.id) AS id,
    a.name AS team_a_member,
    b.name AS team_b_member,
    CASE 
        WHEN a.id IS NOT NULL AND b.id IS NOT NULL THEN '两个团队都有'
        WHEN a.id IS NOT NULL THEN '仅在Team A'
        ELSE '仅在Team B'
    END AS 状态
FROM team_a a
FULL OUTER JOIN team_b b ON a.id = b.id
ORDER BY COALESCE(a.id, b.id);

-- 结果：
-- ┌────┬───────────────┬───────────────┬───────────────┐
-- │ id │ team_a_member │ team_b_member │     状态       │
-- ├────┼───────────────┼───────────────┼───────────────┤
-- │  1 │ Alice         │ NULL          │ 仅在Team A    │
-- │  2 │ Bob           │ Bob           │ 两个团队都有   │
-- │  3 │ Charlie       │ Charlie       │ 两个团队都有   │
-- │  4 │ NULL          │ Diana         │ 仅在Team B    │
-- └────┴───────────────┴───────────────┴───────────────┘

DROP TABLE team_a;
DROP TABLE team_b;
\`\`\`

### 4.5 CROSS JOIN（交叉连接 / 笛卡尔积）

\`\`\`sql
-- 生成所有员工与所有项目的组合（通常用于生成报表模板）
SELECT 
    e.first_name || ' ' || e.last_name AS 员工,
    p.project_name AS 项目
FROM employees e
CROSS JOIN projects p
WHERE e.dept_id = 1 AND p.dept_id = 1    -- 限制范围，避免结果过大
ORDER BY 员工, 项目;
\`\`\`

### 4.6 SELF JOIN（自连接）

\`\`\`sql
-- 查询每个员工及其直属上级
SELECT 
    e.emp_id,
    e.first_name || ' ' || e.last_name     AS 员工姓名,
    e.salary                                 AS 员工薪资,
    m.first_name || ' ' || m.last_name     AS 上级姓名,
    m.salary                                 AS 上级薪资
FROM employees e
LEFT JOIN employees m ON e.manager_id = m.emp_id
ORDER BY e.emp_id;
\`\`\`

### 4.7 多表连接（复杂查询）

\`\`\`sql
-- ========================================
-- 综合查询：员工 + 部门 + 项目 完整信息
-- ========================================
SELECT 
    e.emp_id,
    e.first_name || ' ' || e.last_name  AS 员工姓名,
    d.dept_name                          AS 所属部门,
    e.salary                             AS 薪资,
    p.project_name                       AS 参与项目,
    ep.role                              AS 项目角色,
    ep.hours_worked                      AS 工作小时数,
    p.status                             AS 项目状态
FROM employees e
JOIN departments d      ON e.dept_id = d.dept_id
LEFT JOIN employee_projects ep ON e.emp_id = ep.emp_id
LEFT JOIN projects p    ON ep.project_id = p.project_id
WHERE e.is_active = TRUE
ORDER BY d.dept_name, e.emp_id, p.project_name;

-- ========================================
-- 统计分析：每个部门在各项目上投入的总工时
-- ========================================
SELECT 
    d.dept_name                          AS 部门,
    p.project_name                       AS 项目,
    COUNT(DISTINCT ep.emp_id)            AS 参与人数,
    SUM(ep.hours_worked)                 AS 总工时,
    ROUND(AVG(ep.hours_worked), 1)       AS 人均工时
FROM departments d
JOIN employees e        ON d.dept_id = e.dept_id
JOIN employee_projects ep ON e.emp_id = ep.emp_id
JOIN projects p         ON ep.project_id = p.project_id
GROUP BY d.dept_name, p.project_name
ORDER BY d.dept_name, 总工时 DESC;
\`\`\`

### 4.8 LATERAL JOIN（横向连接 - DuckDB 特色）

\`\`\`sql
-- 查询每个部门薪资前2名的员工
SELECT 
    d.dept_name,
    top_emp.first_name,
    top_emp.last_name,
    top_emp.salary,
    top_emp.rank_num
FROM departments d,
LATERAL (
    SELECT 
        e.first_name,
        e.last_name,
        e.salary,
        ROW_NUMBER() OVER (ORDER BY e.salary DESC) AS rank_num
    FROM employees e
    WHERE e.dept_id = d.dept_id AND e.is_active = TRUE
    LIMIT 2
) top_emp
ORDER BY d.dept_name, top_emp.rank_num;
\`\`\`

### 4.9 集合操作

\`\`\`sql
-- UNION：合并结果（去重）
SELECT emp_id, first_name FROM employees WHERE dept_id = 1
UNION
SELECT emp_id, first_name FROM employees WHERE salary > 30000;

-- UNION ALL：合并结果（不去重，更快）
SELECT emp_id, first_name FROM employees WHERE dept_id = 1
UNION ALL
SELECT emp_id, first_name FROM employees WHERE salary > 30000;

-- INTERSECT：交集 —— 既在技术研发部，薪资又超过30000的人
SELECT emp_id, first_name FROM employees WHERE dept_id = 1
INTERSECT
SELECT emp_id, first_name FROM employees WHERE salary > 30000;

-- EXCEPT：差集 —— 在技术研发部但薪资不超过30000的人
SELECT emp_id, first_name FROM employees WHERE dept_id = 1
EXCEPT
SELECT emp_id, first_name FROM employees WHERE salary > 30000;
\`\`\`

---

## 5. 视图 (VIEW)

### 5.1 创建视图

\`\`\`sql
-- ========================================
-- 基础视图：员工详细信息
-- ========================================
CREATE VIEW v_employee_details AS
SELECT 
    e.emp_id,
    e.first_name || ' ' || e.last_name     AS full_name,
    e.email,
    e.hire_date,
    e.salary,
    e.salary * 12                            AS annual_salary,
    e.is_active,
    d.dept_name,
    d.location                               AS dept_location,
    m.first_name || ' ' || m.last_name     AS manager_name
FROM employees e
LEFT JOIN departments d ON e.dept_id = d.dept_id
LEFT JOIN employees m   ON e.manager_id = m.emp_id;

-- 使用视图（像普通表一样查询）
SELECT * FROM v_employee_details;

SELECT full_name, dept_name, annual_salary
FROM v_employee_details
WHERE is_active = TRUE
ORDER BY annual_salary DESC;
\`\`\`

\`\`\`sql
-- ========================================
-- 统计视图：部门统计概览
-- ========================================
CREATE VIEW v_department_summary AS
SELECT 
    d.dept_id,
    d.dept_name,
    d.location,
    d.budget                                   AS dept_budget,
    COUNT(e.emp_id)                            AS total_employees,
    COUNT(CASE WHEN e.is_active THEN 1 END)    AS active_employees,
    ROUND(AVG(e.salary), 2)                    AS avg_salary,
    MAX(e.salary)                               AS max_salary,
    MIN(e.salary)                               AS min_salary,
    COALESCE(SUM(e.salary), 0)                 AS total_salary_cost,
    ROUND(COALESCE(SUM(e.salary), 0) * 12 / NULLIF(d.budget, 0) * 100, 1) 
                                                AS salary_budget_ratio_pct
FROM departments d
LEFT JOIN employees e ON d.dept_id = e.dept_id
GROUP BY d.dept_id, d.dept_name, d.location, d.budget;

-- 查询
SELECT * FROM v_department_summary ORDER BY total_employees DESC;
\`\`\`

\`\`\`sql
-- ========================================
-- 项目仪表板视图
-- ========================================
CREATE VIEW v_project_dashboard AS
SELECT 
    p.project_id,
    p.project_name,
    p.status,
    p.start_date,
    p.end_date,
    p.budget                                                AS project_budget,
    d.dept_name                                             AS owning_dept,
    COUNT(DISTINCT ep.emp_id)                               AS team_size,
    SUM(ep.hours_worked)                                    AS total_hours,
    STRING_AGG(
        DISTINCT CASE WHEN ep.role = 'lead' 
                 THEN e.first_name || ' ' || e.last_name 
                 END, ', '
    )                                                        AS project_leads,
    CASE 
        WHEN p.end_date IS NULL THEN NULL
        WHEN p.end_date < CURRENT_DATE AND p.status != 'completed' THEN '已逾期'
        WHEN p.end_date - CURRENT_DATE <= 30 THEN '即将到期'
        ELSE '正常'
    END                                                      AS deadline_status
FROM projects p
LEFT JOIN departments d      ON p.dept_id = d.dept_id
LEFT JOIN employee_projects ep ON p.project_id = ep.project_id
LEFT JOIN employees e        ON ep.emp_id = e.emp_id
GROUP BY p.project_id, p.project_name, p.status, p.start_date, 
         p.end_date, p.budget, d.dept_name;

-- 查询
SELECT project_name, status, team_size, total_hours, project_leads
FROM v_project_dashboard
ORDER BY project_id;
\`\`\`

### 5.2 CREATE OR REPLACE VIEW

\`\`\`sql
-- 修改已有视图（不需要先删除）
CREATE OR REPLACE VIEW v_employee_details AS
SELECT 
    e.emp_id,
    e.first_name || ' ' || e.last_name     AS full_name,
    e.email,
    e.hire_date,
    e.salary,
    e.salary * 12                            AS annual_salary,
    -- 新增字段：工龄（年）
    ROUND((CURRENT_DATE - e.hire_date) / 365.25, 1) AS years_of_service,
    e.is_active,
    d.dept_name,
    d.location                               AS dept_location,
    m.first_name || ' ' || m.last_name     AS manager_name
FROM employees e
LEFT JOIN departments d ON e.dept_id = d.dept_id
LEFT JOIN employees m   ON e.manager_id = m.emp_id;

SELECT full_name, years_of_service, dept_name FROM v_employee_details;
\`\`\`

### 5.3 临时视图

\`\`\`sql
-- 临时视图：仅在当前会话/连接中可用
CREATE TEMP VIEW v_temp_active_employees AS
SELECT * FROM employees WHERE is_active = TRUE;

SELECT * FROM v_temp_active_employees;
\`\`\`

### 5.4 查看与删除视图

\`\`\`sql
-- 查看所有视图
SELECT * FROM duckdb_views();

-- 删除视图
DROP VIEW v_temp_active_employees;
DROP VIEW IF EXISTS v_nonexistent;       -- 安全删除
\`\`\`

### 5.5 CTE（公用表表达式）— 临时的"内联视图"

\`\`\`sql
-- WITH 子句（非持久化，单次查询使用）
WITH 
-- CTE 1: 部门薪资统计
dept_salary AS (
    SELECT 
        dept_id,
        AVG(salary) AS avg_salary,
        COUNT(*)    AS emp_count
    FROM employees
    WHERE is_active = TRUE
    GROUP BY dept_id
),
-- CTE 2: 公司平均薪资
company_avg AS (
    SELECT AVG(salary) AS overall_avg
    FROM employees
    WHERE is_active = TRUE
)
-- 主查询：比较各部门薪资与公司平均值
SELECT 
    d.dept_name,
    ds.emp_count                                       AS 人数,
    ROUND(ds.avg_salary, 2)                            AS 部门平均薪资,
    ROUND(ca.overall_avg, 2)                           AS 公司平均薪资,
    ROUND(ds.avg_salary - ca.overall_avg, 2)           AS 差异,
    CASE 
        WHEN ds.avg_salary > ca.overall_avg THEN '↑ 高于平均'
        WHEN ds.avg_salary < ca.overall_avg THEN '↓ 低于平均'
        ELSE '= 持平'
    END                                                 AS 对比
FROM dept_salary ds
JOIN departments d ON ds.dept_id = d.dept_id
CROSS JOIN company_avg ca
ORDER BY ds.avg_salary DESC;

-- ========================================
-- 递归 CTE：组织架构层级展示
-- ========================================
WITH RECURSIVE org_tree AS (
    -- 基础条件：顶层管理者（没有上级的人）
    SELECT 
        emp_id,
        first_name || ' ' || last_name AS name,
        manager_id,
        1 AS level,
        first_name || ' ' || last_name AS path
    FROM employees
    WHERE manager_id IS NULL AND is_active = TRUE
    
    UNION ALL
    
    -- 递归条件：找到每个人的下属
    SELECT 
        e.emp_id,
        e.first_name || ' ' || e.last_name,
        e.manager_id,
        ot.level + 1,
        ot.path || ' → ' || e.first_name || ' ' || e.last_name
    FROM employees e
    JOIN org_tree ot ON e.manager_id = ot.emp_id
    WHERE e.is_active = TRUE
)
SELECT 
    REPEAT('  ', level - 1) || name AS 组织架构,
    level                            AS 层级,
    path                             AS 汇报链
FROM org_tree
ORDER BY path;
\`\`\`

---

## 6. 事务 (TRANSACTION)

> DuckDB 支持 ACID 事务，默认每条语句是一个自动提交的事务。

\`\`\`
┌──────────────────────────────────────────────────┐
│              事务生命周期                          │
│                                                  │
│   BEGIN TRANSACTION                              │
│        │                                         │
│        ▼                                         │
│   ┌──────────┐                                   │
│   │  SQL操作   │ ◄─── INSERT / UPDATE / DELETE    │
│   │  SQL操作   │                                  │
│   │  SQL操作   │                                  │
│   └──────────┘                                   │
│        │                                         │
│   ┌────┴────┐                                    │
│   ▼         ▼                                    │
│ COMMIT   ROLLBACK                                │
│ (提交)    (回滚)                                  │
│   │         │                                    │
│   ▼         ▼                                    │
│ 永久保存   撤销所有更改                            │
└──────────────────────────────────────────────────┘
\`\`\`

### 6.1 基本事务操作

\`\`\`sql
-- ========================================
-- 示例1：成功的事务（COMMIT）
-- 场景：员工调薪，同时记录薪资变更历史
-- ========================================
BEGIN TRANSACTION;

    -- 查看当前薪资
    SELECT emp_id, first_name, salary 
    FROM employees WHERE emp_id = 2;

    -- 记录变更历史
    INSERT INTO salary_history (history_id, emp_id, old_salary, new_salary, change_reason)
    SELECT 
        1,
        emp_id,
        salary,
        salary * 1.15,
        '年度绩效调薪 - 优秀'
    FROM employees
    WHERE emp_id = 2;

    -- 更新薪资（加薪15%）
    UPDATE employees
    SET salary = salary * 1.15
    WHERE emp_id = 2;

    -- 验证更新
    SELECT emp_id, first_name, salary FROM employees WHERE emp_id = 2;
    SELECT * FROM salary_history WHERE emp_id = 2;

COMMIT;   -- 提交事务，所有更改永久生效
\`\`\`

### 6.2 事务回滚

\`\`\`sql
-- ========================================
-- 示例2：失败回滚的事务（ROLLBACK）
-- 场景：批量调薪，发现预算超标后回滚
-- ========================================
BEGIN TRANSACTION;

    -- 查看调整前的薪资总额
    SELECT SUM(salary) AS 调整前总薪资 FROM employees WHERE dept_id = 1;

    -- 全部门加薪20%
    UPDATE employees
    SET salary = salary * 1.20
    WHERE dept_id = 1;

    -- 查看调整后的薪资总额
    SELECT SUM(salary) AS 调整后总薪资 FROM employees WHERE dept_id = 1;

    -- 假设发现预算超标，需要撤销所有更改
    -- 模拟检查逻辑（实际应用中可能是程序化判断）

ROLLBACK;  -- 回滚事务，所有更改被撤销！

-- 验证：薪资未变
SELECT emp_id, first_name, salary FROM employees WHERE dept_id = 1;
\`\`\`

### 6.3 Python 中的事务管理

\`\`\`python
import duckdb

con = duckdb.connect('my_database.db')

# ========================================
# 方式1：手动管理事务
# ========================================
try:
    con.execute("BEGIN TRANSACTION")
    
    # 从部门1转一名员工到部门5
    emp_id = 9
    
    # 获取当前信息
    result = con.execute(
        "SELECT first_name, last_name, dept_id FROM employees WHERE emp_id = ?",
        [emp_id]
    ).fetchone()
    print(f"转移前: {result}")
    
    # 更新员工部门
    con.execute(
        "UPDATE employees SET dept_id = 5 WHERE emp_id = ?",
        [emp_id]
    )
    
    # 验证
    result = con.execute(
        "SELECT first_name, last_name, dept_id FROM employees WHERE emp_id = ?",
        [emp_id]
    ).fetchone()
    print(f"转移后: {result}")
    
    # 模拟业务检查
    count = con.execute(
        "SELECT COUNT(*) FROM employees WHERE dept_id = 1 AND is_active = TRUE"
    ).fetchone()[0]
    
    if count < 2:
        raise Exception("部门人数不能少于2人！")
    
    con.execute("COMMIT")
    print("✅ 事务已提交")
    
except Exception as e:
    con.execute("ROLLBACK")
    print(f"❌ 事务已回滚: {e}")


# ========================================
# 方式2：使用上下文管理器（推荐）
# ========================================
def transfer_employee(con, emp_id, new_dept_id):
    """安全地转移员工部门"""
    try:
        con.begin()
        
        # 检查员工存在
        emp = con.execute(
            "SELECT emp_id, dept_id FROM employees WHERE emp_id = ?",
            [emp_id]
        ).fetchone()
        
        if emp is None:
            raise ValueError(f"员工 {emp_id} 不存在")
        
        if emp[1] == new_dept_id:
            raise ValueError(f"员工已在目标部门中")
        
        # 检查目标部门存在
        dept = con.execute(
            "SELECT dept_id FROM departments WHERE dept_id = ?",
            [new_dept_id]
        ).fetchone()
        
        if dept is None:
            raise ValueError(f"部门 {new_dept_id} 不存在")
        
        # 执行转移
        con.execute(
            "UPDATE employees SET dept_id = ? WHERE emp_id = ?",
            [new_dept_id, emp_id]
        )
        
        con.commit()
        print(f"✅ 员工 {emp_id} 已转移到部门 {new_dept_id}")
        
    except Exception as e:
        con.rollback()
        print(f"❌ 转移失败: {e}")

# 调用
transfer_employee(con, 9, 5)
\`\`\`

### 6.4 事务中的并发控制

\`\`\`sql
-- DuckDB 使用 MVCC（多版本并发控制）
-- 读取不阻塞写入，写入不阻塞读取
-- 但同一时间只允许一个写事务

-- ========================================
-- 模拟批量操作的事务安全
-- ========================================
BEGIN TRANSACTION;

    -- 步骤1：冻结离职员工的项目分配
    DELETE FROM employee_projects
    WHERE emp_id IN (
        SELECT emp_id FROM employees WHERE is_active = FALSE
    );

    -- 步骤2：统计受影响的数据
    SELECT 
        '活跃员工' AS 类别, COUNT(*) AS 数量
    FROM employees WHERE is_active = TRUE
    UNION ALL
    SELECT 
        '项目分配数', COUNT(*)
    FROM employee_projects;

    -- 步骤3：归档（可选）
    CREATE TABLE IF NOT EXISTS archived_employees AS
    SELECT *, CURRENT_TIMESTAMP AS archived_at
    FROM employees
    WHERE is_active = FALSE
    LIMIT 0;  -- 仅创建结构

    INSERT INTO archived_employees
    SELECT *, CURRENT_TIMESTAMP
    FROM employees
    WHERE is_active = FALSE;

COMMIT;
\`\`\`

### 6.5 自动提交模式说明

\`\`\`sql
-- DuckDB 默认每条语句是一个独立事务（自动提交）
-- 以下两句各自独立提交
INSERT INTO departments VALUES (6, '法务部', '广州-天河', 1200000.00, CURRENT_TIMESTAMP);
UPDATE departments SET budget = 1300000 WHERE dept_id = 6;

-- 如果需要原子性（要么全成功，要么全失败），必须显式使用事务
BEGIN;
    INSERT INTO departments VALUES (7, '运维部', '成都-高新', 1800000.00, CURRENT_TIMESTAMP);
    INSERT INTO departments VALUES (8, '数据分析部', '北京-中关村', 2200000.00, CURRENT_TIMESTAMP);
    -- 如果第二条失败，第一条也不会生效
COMMIT;

-- 清理测试数据
DELETE FROM departments WHERE dept_id > 5;
\`\`\`

---

## 7. 高级特性

### 7.1 窗口函数

\`\`\`sql
-- ========================================
-- 窗口函数全面展示
-- ========================================
SELECT 
    e.emp_id,
    e.first_name || ' ' || e.last_name    AS name,
    d.dept_name,
    e.salary,
    
    -- 排名函数
    ROW_NUMBER() OVER w                     AS 序号,
    RANK()       OVER w                     AS 排名_有间隔,
    DENSE_RANK() OVER w                     AS 排名_无间隔,
    
    -- 聚合窗口
    AVG(e.salary) OVER w_dept              AS 部门平均薪资,
    SUM(e.salary) OVER w_dept              AS 部门薪资总和,
    COUNT(*)      OVER w_dept              AS 部门人数,
    
    -- 偏移函数
    LAG(e.salary, 1)  OVER w               AS 前一名薪资,
    LEAD(e.salary, 1) OVER w               AS 后一名薪资,
    
    -- 首尾值
    FIRST_VALUE(e.first_name || ' ' || e.last_name) OVER w_dept AS 部门最高薪,
    LAST_VALUE(e.first_name || ' ' || e.last_name)  OVER (
        PARTITION BY e.dept_id 
        ORDER BY e.salary DESC 
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) AS 部门最低薪,
    
    -- 百分位
    PERCENT_RANK() OVER w                  AS 薪资百分位
    
FROM employees e
JOIN departments d ON e.dept_id = d.dept_id
WHERE e.is_active = TRUE
WINDOW 
    w      AS (ORDER BY e.salary DESC),
    w_dept AS (PARTITION BY e.dept_id ORDER BY e.salary DESC)
ORDER BY e.salary DESC;
\`\`\`

### 7.2 PIVOT / UNPIVOT（DuckDB 特色）

\`\`\`sql
-- PIVOT：行转列 —— 每个部门各状态的项目数
PIVOT (
    SELECT d.dept_name, p.status
    FROM projects p
    JOIN departments d ON p.dept_id = d.dept_id
)
ON status
USING COUNT(*)
ORDER BY dept_name;

-- UNPIVOT 示例
CREATE TEMP TABLE quarterly_sales (
    product VARCHAR,
    q1 INTEGER, q2 INTEGER, q3 INTEGER, q4 INTEGER
);
INSERT INTO quarterly_sales VALUES 
    ('产品A', 100, 150, 200, 180),
    ('产品B', 80,  90,  110, 130);

UNPIVOT quarterly_sales
ON q1, q2, q3, q4
INTO NAME quarter VALUE sales;

DROP TABLE quarterly_sales;
\`\`\`

### 7.3 直接查询文件（DuckDB 特色）

\`\`\`sql
-- 直接查询 CSV 文件（无需建表导入）
-- SELECT * FROM read_csv_auto('employees.csv');

-- 直接查询 Parquet 文件
-- SELECT * FROM read_parquet('data/*.parquet');

-- 直接查询 JSON 文件
-- SELECT * FROM read_json_auto('data.json');

-- 将查询结果导出为文件
-- COPY (SELECT * FROM v_employee_details) TO 'output.csv' (HEADER, DELIMITER ',');
-- COPY (SELECT * FROM v_employee_details) TO 'output.parquet' (FORMAT PARQUET);
\`\`\`

### 7.4 实用函数速查

\`\`\`sql
-- ========================================
-- 字符串函数
-- ========================================
SELECT
    CONCAT('Hello', ' ', 'DuckDB')       AS concat_result,        -- Hello DuckDB
    LENGTH('DuckDB')                      AS str_length,           -- 6
    UPPER('duckdb')                       AS upper_case,           -- DUCKDB
    LOWER('DUCKDB')                       AS lower_case,           -- duckdb
    TRIM('  hello  ')                     AS trimmed,              -- hello
    REPLACE('DuckDB', 'Duck', 'Swan')     AS replaced,             -- SwanDB
    SUBSTRING('DuckDB', 1, 4)             AS sub_str,              -- Duck
    SPLIT_PART('a-b-c', '-', 2)           AS split_result,         -- b
    LEFT('DuckDB', 4)                     AS left_str,             -- Duck
    REGEXP_EXTRACT('emp_123', '(\\d+)', 1) AS regex_result;         -- 123

-- ========================================
-- 日期/时间函数
-- ========================================
SELECT
    CURRENT_DATE                          AS today,
    CURRENT_TIMESTAMP                     AS now,
    DATE_PART('year', DATE '2024-06-15')  AS year_part,            -- 2024
    DATE_PART('month', DATE '2024-06-15') AS month_part,           -- 6
    DATE_DIFF('day', DATE '2024-01-01', DATE '2024-06-15') AS days_diff, -- 166
    DATE_ADD(DATE '2024-01-01', INTERVAL 3 MONTH) AS add_months,  -- 2024-04-01
    DATE_TRUNC('month', DATE '2024-06-15') AS month_start,         -- 2024-06-01
    STRFTIME(CURRENT_TIMESTAMP, '%Y年%m月%d日') AS formatted;

-- ========================================
-- 条件表达式
-- ========================================
SELECT 
    emp_id,
    salary,
    -- CASE WHEN
    CASE 
        WHEN salary >= 35000 THEN '高薪'
        WHEN salary >= 25000 THEN '中等'
        ELSE '待提升'
    END AS salary_level,
    -- COALESCE
    COALESCE(manager_id, -1) AS manager_or_default,
    -- NULLIF
    NULLIF(manager_id, -1) AS null_if_negative,
    -- IIF (DuckDB 简写)
    IIF(is_active, '在职', '离职') AS status
FROM employees;
\`\`\`

---

## 完整清理脚本

\`\`\`sql
-- 按依赖顺序删除所有对象
DROP VIEW IF EXISTS v_employee_details;
DROP VIEW IF EXISTS v_department_summary;
DROP VIEW IF EXISTS v_project_dashboard;
DROP TABLE IF EXISTS archived_employees;
DROP TABLE IF EXISTS salary_history;
DROP TABLE IF EXISTS employee_projects;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS departments;
\`\`\`

---

## 快速参考卡片

\`\`\`
┌────────────────────────────────────────────────────────────────┐
│                    DuckDB SQL 速查表                           │
├──────────────┬─────────────────────────────────────────────────┤
│   CRUD       │                                                 │
├──────────────┼─────────────────────────────────────────────────┤
│ CREATE       │ INSERT INTO t VALUES (...);                     │
│ READ         │ SELECT ... FROM t WHERE ... ORDER BY ... LIMIT;│
│ UPDATE       │ UPDATE t SET col=val WHERE ...;                 │
│ DELETE       │ DELETE FROM t WHERE ...;                        │
│ UPSERT       │ INSERT ... ON CONFLICT DO UPDATE/NOTHING;       │
├──────────────┼─────────────────────────────────────────────────┤
│   JOIN       │                                                 │
├──────────────┼─────────────────────────────────────────────────┤
│ INNER JOIN   │ 两表交集                                        │
│ LEFT JOIN    │ 保留左表全部 + 匹配的右表                        │
│ RIGHT JOIN   │ 保留右表全部 + 匹配的左表                        │
│ FULL JOIN    │ 保留两表全部                                     │
│ CROSS JOIN   │ 笛卡尔积                                        │
│ SELF JOIN    │ 表与自身连接                                     │
│ LATERAL JOIN │ 关联子查询连接（DuckDB特色）                      │
├──────────────┼─────────────────────────────────────────────────┤
│   VIEW       │                                                 │
├──────────────┼─────────────────────────────────────────────────┤
│ CREATE VIEW  │ CREATE [OR REPLACE] VIEW v AS SELECT ...;       │
│ TEMP VIEW    │ CREATE TEMP VIEW v AS SELECT ...;               │
│ DROP VIEW    │ DROP VIEW [IF EXISTS] v;                        │
│ CTE          │ WITH cte AS (...) SELECT ...;                   │
├──────────────┼─────────────────────────────────────────────────┤
│ TRANSACTION  │                                                 │
├──────────────┼─────────────────────────────────────────────────┤
│ 开始         │ BEGIN [TRANSACTION];                             │
│ 提交         │ COMMIT;                                         │
│ 回滚         │ ROLLBACK;                                       │
│ 自动提交     │ 默认每条语句自动提交                               │
├──────────────┼─────────────────────────────────────────────────┤
│ DuckDB 特色  │ QUALIFY, SAMPLE, EXCLUDE, COLUMNS, PIVOT,       │
│              │ read_csv_auto, read_parquet, LATERAL JOIN       │
└──────────────┴─────────────────────────────────────────────────┘
\`\`\`

> **提示**：本教程中的所有 SQL 可以直接在 DuckDB CLI 或 Python \`duckdb.connect()\` 中按顺序执行。建议从「环境准备 → 建表 → 插入数据」开始，然后逐步实验每个查询。

https://arena.ai/c/019c42c1-3d76-7477-8f72-abc81792d0ef
`,In=`---
id: "duckdb-sql-lesson-1"
type: "note"
isFavorite: false
createdAt: "2026-09-22T00:57:29.610Z"
updatedAt: "2026-09-22T00:57:29.610Z"
tags:
  - "入门"
  - "DuckDB"
  - "教程"
title: "Lesson 1 · DuckDB SQL 入门"
topic: "best_practice"
summary: "建立“哲学概念本体”的**最小可运行宇宙**，为后续所有 DML / JOIN / 事务 / 递归查询提供唯一数据根基。"
---

以下内容为 **Lesson 1（L1）**，直接可执行，不引入任何后续未定义结构，确保**最小闭环 + 可持续演进**。

---

# Lesson 1 · DuckDB SQL 入门

## 哲学知识图谱 · 本体论最小闭环

**难度等级**：L1
**前置依赖**：无
**本课定位**：

> 建立“哲学概念本体”的**最小可运行宇宙**，为后续所有 DML / JOIN / 事务 / 递归查询提供唯一数据根基。

---

## 一、学习目标

完成本课后，你将能够：

1. 使用 DuckDB 创建一组**具备哲学含义的关系型表**
2. 理解 **概念 / 思想家 / 学派** 的本体论区分
3. 建立 **稳定、不返工** 的基础数据结构
4. 跑通第一批**可查询、可扩展**的哲学数据

---

## 二、哲学概念说明（本体论锚定）

### 1. 本体论三要素（最低必要）

| 实体           | 哲学含义           | 数据库角色 |
| ------------ | -------------- | ----- |
| 思想家（Thinker） | 概念的提出者、论证者     | 行为主体  |
| 学派（School）   | 方法论与立场的集合      | 立场集合  |
| 概念（Concept）  | 被讨论、被使用、被演化的对象 | 核心节点  |

> 本课**只做“是什么”**，不涉及“如何知道”（认识论留到 Lesson 3）。

---

## 三、DuckDB 环境说明（极简）

* DuckDB 是 **嵌入式分析型数据库**
* SQL 标准高度兼容（Postgres 风格）
* 支持：

  * 外键
  * 递归 CTE
  * JSON
  * 列式分析

启动方式（任选）：

\`\`\`bash
duckdb philosophy.db
\`\`\`

---

## 四、DDL：建表（全局唯一版本）

> ⚠️ 说明：
>
> * **后续所有课程禁止重复建表**
> * 只允许 \`ALTER TABLE\` 演进

### 1️⃣ 学派表 \`schools\`

\`\`\`sql
CREATE TABLE schools (
    school_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT
);
\`\`\`

---

### 2️⃣ 思想家表 \`thinkers\`

\`\`\`sql
CREATE TABLE thinkers (
    thinker_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    birth_year INTEGER,
    death_year INTEGER,
    era TEXT
);
\`\`\`

---

### 3️⃣ 思想家 ↔ 学派（多对多）

\`\`\`sql
CREATE TABLE thinker_schools (
    thinker_id INTEGER NOT NULL,
    school_id INTEGER NOT NULL,
    PRIMARY KEY (thinker_id, school_id),
    FOREIGN KEY (thinker_id) REFERENCES thinkers(thinker_id),
    FOREIGN KEY (school_id) REFERENCES schools(school_id)
);
\`\`\`

---

### 4️⃣ 概念表 \`concepts\`（本体核心）

\`\`\`sql
CREATE TABLE concepts (
    concept_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    definition TEXT,
    domain TEXT,        -- 本体论 / 认识论 / 形而上学等
    introduced_by INTEGER,
    FOREIGN KEY (introduced_by) REFERENCES thinkers(thinker_id)
);
\`\`\`

---

### 5️⃣ 概念层级表 \`concept_hierarchy\`

> 表达 **genus → species（上位 / 下位）**

\`\`\`sql
CREATE TABLE concept_hierarchy (
    parent_concept_id INTEGER NOT NULL,
    child_concept_id INTEGER NOT NULL,
    PRIMARY KEY (parent_concept_id, child_concept_id),
    FOREIGN KEY (parent_concept_id) REFERENCES concepts(concept_id),
    FOREIGN KEY (child_concept_id) REFERENCES concepts(concept_id)
);
\`\`\`

---

## 五、DML：种子数据（第一性、不可随意改）

### 1️⃣ 学派数据

\`\`\`sql
INSERT INTO schools VALUES
(1, '理性主义', '强调理性与先天结构'),
(2, '经验主义', '强调感官经验'),
(3, '现象学', '研究意识如何呈现对象');
\`\`\`

---

### 2️⃣ 思想家数据（≥5）

\`\`\`sql
INSERT INTO thinkers VALUES
(1, '柏拉图', -427, -347, '古典'),
(2, '亚里士多德', -384, -322, '古典'),
(3, '笛卡尔', 1596, 1650, '近代'),
(4, '休谟', 1711, 1776, '近代'),
(5, '康德', 1724, 1804, '近代'),
(6, '胡塞尔', 1859, 1938, '现代');
\`\`\`

---

### 3️⃣ 思想家 ↔ 学派映射

\`\`\`sql
INSERT INTO thinker_schools VALUES
(1, 1),  -- 柏拉图 → 理性主义
(3, 1),  -- 笛卡尔 → 理性主义
(4, 2),  -- 休谟 → 经验主义
(5, 1),  -- 康德 → 理性主义
(5, 2),  -- 康德 → 经验主义（调和）
(6, 3);  -- 胡塞尔 → 现象学
\`\`\`

---

### 4️⃣ 概念数据（≥15）

\`\`\`sql
INSERT INTO concepts VALUES
(1, '理念', '独立于感官世界的永恒实体', '本体论', 1),
(2, '实体', '独立存在的存在者', '本体论', 2),
(3, '形式', '事物的结构与本质', '本体论', 2),
(4, '理性', '认识的先天能力', '认识论', 3),
(5, '经验', '来自感官的认识来源', '认识论', 4),
(6, '先验', '经验之前的认识条件', '认识论', 5),
(7, '现象', '对象对主体的显现方式', '认识论', 5),
(8, '物自身', '不依赖主体的真实存在', '本体论', 5),
(9, '意识', '一切显现的场域', '认识论', 6),
(10, '意向性', '意识指向对象的结构', '认识论', 6),
(11, '存在', '作为存在者之存在', '本体论', 2),
(12, '本质', '决定对象是什么的规定性', '本体论', 2),
(13, '感性', '直观的能力', '认识论', 5),
(14, '知性', '概念化的能力', '认识论', 5),
(15, '理念论', '理念高于感性世界', '形而上学', 1);
\`\`\`

---

### 5️⃣ 概念层级（示例）

\`\`\`sql
INSERT INTO concept_hierarchy VALUES
(11, 2),   -- 存在 → 实体
(2, 12),   -- 实体 → 本质
(9, 10),   -- 意识 → 意向性
(6, 7),    -- 先验 → 现象
(1, 15);   -- 理念 → 理念论
\`\`\`

---

## 六、即学即练（SELECT 基础）

### 练习 1：列出所有本体论概念

\`\`\`sql
SELECT name, definition
FROM concepts
WHERE domain = '本体论';
\`\`\`

---

### 练习 2：查询康德提出的概念

\`\`\`sql
SELECT c.name
FROM concepts c
JOIN thinkers t ON c.introduced_by = t.thinker_id
WHERE t.name = '康德';
\`\`\`

---

### 练习 3：查询每个学派下的思想家数量

\`\`\`sql
SELECT s.name, COUNT(*) AS thinker_count
FROM schools s
JOIN thinker_schools ts ON s.school_id = ts.school_id
GROUP BY s.name;
\`\`\`

---

## 七、小结（本课闭环）

* 你已经建立：

  * 一个**哲学本体论的关系模型**
  * 一套**可递归、可 JOIN、可事务化**的数据根
* 当前系统满足：

  * 稳定
  * 可扩展
  * 不返工

---

## 下一课预告（Lesson 2 · L2）

**主题**：关系建模与 JOIN
**重点**：

* 概念 ↔ 学派 ↔ 思想家
* 自连接（概念谱系）
* 为认识论层做结构铺垫

如果确认，回复：
**“执行第二课”**




https://chatgpt.com/c/69764572-b0f4-832c-bd51-7e34208b07c4
`,Cn=`---
id: "metric-gmv-net"
type: "metric"
isFavorite: true
createdAt: "2026-02-18T10:00:00.000Z"
updatedAt: "2026-03-21T15:00:00.000Z"
tags:
  - "GMV"
  - "交易口径"
  - "核心指标"
  - "电商"
name: "GMV (净成交交易总额)"
owner: "交易分析中台 / 商业智能组"
sourceTables:
  - "fact_order_payments"
  - "dim_product_category"
dimensions:
  - "stat_date (日期)"
  - "category_id (商品品类)"
  - "channel (渠道)"
---

## 业务定义与统计场景
统计在统计周期内用户成功下单并完成支付的总金额，剔除在T+1内立即发生的拒付与全部无理由退款，是衡量核心主营交易规模的北极星指标。

> [!NOTE]
> 净成交额与粗 GMV 的核心差异在于扣除了**渠道商户贴息**与**全额退款流水**，避免营销冲单虚增交易盘。

## 计算公式与度量逻辑
\`SUM(支付流水总金额) - SUM(全额退款金额) - SUM(商户补贴金)\`

## SQL 查询定义
\`\`\`sql
SELECT 
    date_trunc('day', pay_time) AS stat_date,
    category_id,
    ROUND(SUM(pay_amount - coalesce(refund_amount, 0) - coalesce(merchant_subsidy, 0)), 2) AS net_gmv
FROM fact_order_payments
WHERE pay_status = 'SUCCESS'
  AND pay_time >= CURRENT_DATE - INTERVAL 30 DAYS
GROUP BY 1, 2;
\`\`\`
`,fn=`---
id: "ontology-duckdb-complete"
type: "note"
isFavorite: false
createdAt: "2026-09-22T00:57:29.611Z"
updatedAt: "2026-09-22T00:57:29.611Z"
tags:
  - "本体建模"
  - "DuckDB"
  - "教程"
title: "用 DuckDB 建模 Palantir Ontology 元结构：完整教程"
topic: "best_practice"
summary: "Palantir Foundry 的 Ontology 由四个元概念构成： 本文不是用 Ontology 来建模某个业务，而是把 Ontology 本身当作被建模的对象。 你运行的每条 SQL，操作的都是\\"Object Type 的定义\\"、\\"Link Type 的定义\\"这些元层面的数据。理解元模型后，你可以将其实例化到任何业务域。"
---

# 用 DuckDB 建模 Palantir Ontology 元结构：完整教程

## 目录

1. [前言：为什么用 SQL 建模 Ontology 本身](#1-前言)
2. [环境准备](#2-环境准备)
3. [第一部分：Object — 万物皆对象](#3-object)
4. [第二部分：Link — 关系即结构](#4-link)
5. [第三部分：State — 状态即生命周期](#5-state)
6. [第四部分：Action — 行为即变迁](#6-action)
7. [第五部分：四元协作 — 完整运转](#7-collaboration)
8. [第六部分：DuckDB 全能力覆盖](#8-duckdb-full)
9. [第七部分：复用到任意业务场景](#9-reuse)
10. [附录：MECE 能力清单](#10-mece)

---

## 1. 前言

Palantir Foundry 的 Ontology 由四个元概念构成：

| 元概念 | 本质 | 类比 |
|--------|------|------|
| **Object** | 实体定义 + 实例 | OOP 的 Class + Instance |
| **Link** | 实体间的有向/无向关系 | ER 图的 Relationship |
| **State** | 实体在某时刻的快照/阶段 | 状态机的 State |
| **Action** | 改变实体状态或关系的操作 | 状态机的 Transition |

**本文不是用 Ontology 来建模某个业务，而是把 Ontology 本身当作被建模的对象。** 你运行的每条 SQL，操作的都是"Object Type 的定义"、"Link Type 的定义"这些**元层面**的数据。理解元模型后，你可以将其实例化到任何业务域。

---

## 2. 环境准备

\`\`\`bash
# 安装 DuckDB（macOS）
brew install duckdb

# 或者 pip
pip install duckdb

# 启动
duckdb ontology_meta.db
\`\`\`

\`\`\`sql
-- 确认版本
SELECT version();

-- 开启进度条（大查询可视）
PRAGMA enable_progress_bar;

-- 设置内存与线程
SET memory_limit = '2GB';
SET threads TO 4;
\`\`\`

---

## 3. 第一部分：Object — 万物皆对象

### 3.1 元模型设计

在 Ontology 中，Object 有两层含义：
- **Object Type**：类型定义（如 "Employee"、"Building"）
- **Object Instance**：某个类型下的具体实体（如 "Employee #42"）

我们用 SQL 同时建模这两层。

\`\`\`sql
-- ============================================================
-- Schema: 使用 DuckDB 的 SCHEMA 做逻辑隔离
-- ============================================================
CREATE SCHEMA IF NOT EXISTS ontology;

-- ============================================================
-- SEQUENCE: 全局 ID 生成器
-- ============================================================
CREATE SEQUENCE ontology.seq_object_type START 1;
CREATE SEQUENCE ontology.seq_object_instance START 1;
CREATE SEQUENCE ontology.seq_property_def START 1;

-- ============================================================
-- ENUM: 属性值的数据类型枚举
-- ============================================================
CREATE TYPE ontology.property_dtype AS ENUM (
    'STRING', 'INTEGER', 'FLOAT', 'BOOLEAN',
    'DATE', 'TIMESTAMP', 'JSON', 'ARRAY', 'MAP'
);

-- ============================================================
-- TABLE 1: Object Type（元定义）
-- ============================================================
CREATE TABLE ontology.object_type (
    type_id       INTEGER DEFAULT nextval('ontology.seq_object_type') PRIMARY KEY,
    type_name     VARCHAR NOT NULL UNIQUE,          -- e.g. 'Employee'
    description   VARCHAR,
    icon          VARCHAR DEFAULT '📦',
    created_at    TIMESTAMP DEFAULT current_timestamp,
    is_abstract   BOOLEAN DEFAULT FALSE,            -- 是否抽象类型
    parent_type   VARCHAR,                          -- 继承
    tags          VARCHAR[],                         -- DuckDB 原生 LIST 类型
    metadata      MAP(VARCHAR, VARCHAR)              -- DuckDB 原生 MAP 类型
);

-- ============================================================
-- TABLE 2: Property Definition（属性定义，属于某个 Object Type）
-- ============================================================
CREATE TABLE ontology.property_definition (
    prop_id       INTEGER DEFAULT nextval('ontology.seq_property_def') PRIMARY KEY,
    type_name     VARCHAR NOT NULL,                  -- FK → object_type.type_name
    prop_name     VARCHAR NOT NULL,
    prop_dtype    ontology.property_dtype NOT NULL,
    is_primary    BOOLEAN DEFAULT FALSE,             -- 是否主标识
    is_required   BOOLEAN DEFAULT FALSE,
    default_value VARCHAR,
    description   VARCHAR,
    UNIQUE (type_name, prop_name),
    FOREIGN KEY (type_name) REFERENCES ontology.object_type(type_name)
);

-- ============================================================
-- TABLE 3: Object Instance（实例 — 使用 STRUCT + JSON 存储动态属性）
-- ============================================================
CREATE TABLE ontology.object_instance (
    instance_id   INTEGER DEFAULT nextval('ontology.seq_object_instance') PRIMARY KEY,
    type_name     VARCHAR NOT NULL,
    display_name  VARCHAR,
    properties    JSON,                              -- 动态属性，用 JSON 存
    created_at    TIMESTAMP DEFAULT current_timestamp,
    updated_at    TIMESTAMP DEFAULT current_timestamp,
    version       INTEGER DEFAULT 1,                 -- 乐观锁版本号
    FOREIGN KEY (type_name) REFERENCES ontology.object_type(type_name)
);
\`\`\`

### 3.2 插入元数据：定义 Object Types

\`\`\`sql
-- 插入 Object Type 定义
INSERT INTO ontology.object_type (type_name, description, icon, is_abstract, parent_type, tags, metadata)
VALUES
    ('ObjectType',    'Meta: 描述所有对象类型的类型',   '🔷', TRUE,  NULL,          ['meta', 'core'],       MAP {'layer': 'meta', 'version': '1.0'}),
    ('LinkType',      'Meta: 描述所有关系类型的类型',   '🔗', TRUE,  NULL,          ['meta', 'core'],       MAP {'layer': 'meta', 'version': '1.0'}),
    ('StateType',     'Meta: 描述所有状态类型的类型',   '🔄', TRUE,  NULL,          ['meta', 'core'],       MAP {'layer': 'meta', 'version': '1.0'}),
    ('ActionType',    'Meta: 描述所有行为类型的类型',   '⚡', TRUE,  NULL,          ['meta', 'core'],       MAP {'layer': 'meta', 'version': '1.0'}),
    ('Employee',      '业务示例: 员工',               '👤', FALSE, 'ObjectType',  ['business', 'hr'],     MAP {'layer': 'business', 'domain': 'HR'}),
    ('Department',    '业务示例: 部门',               '🏢', FALSE, 'ObjectType',  ['business', 'hr'],     MAP {'layer': 'business', 'domain': 'HR'}),
    ('Project',       '业务示例: 项目',               '📋', FALSE, 'ObjectType',  ['business', 'pm'],     MAP {'layer': 'business', 'domain': 'PM'}),
    ('Ticket',        '业务示例: 工单',               '🎫', FALSE, 'ObjectType',  ['business', 'ops'],    MAP {'layer': 'business', 'domain': 'OPS'});

-- 定义属性
INSERT INTO ontology.property_definition (type_name, prop_name, prop_dtype, is_primary, is_required, description)
VALUES
    -- Employee 属性
    ('Employee', 'emp_id',     'STRING',    TRUE,  TRUE,  '工号'),
    ('Employee', 'name',       'STRING',    FALSE, TRUE,  '姓名'),
    ('Employee', 'hire_date',  'DATE',      FALSE, FALSE, '入职日期'),
    ('Employee', 'salary',     'FLOAT',     FALSE, FALSE, '薪资'),
    ('Employee', 'is_active',  'BOOLEAN',   FALSE, FALSE, '是否在职'),
    -- Department 属性
    ('Department', 'dept_id',   'STRING',   TRUE,  TRUE,  '部门编号'),
    ('Department', 'dept_name', 'STRING',   FALSE, TRUE,  '部门名称'),
    -- Project 属性
    ('Project', 'proj_id',     'STRING',    TRUE,  TRUE,  '项目编号'),
    ('Project', 'proj_name',   'STRING',    FALSE, TRUE,  '项目名称'),
    ('Project', 'budget',      'FLOAT',     FALSE, FALSE, '预算'),
    -- Ticket 属性
    ('Ticket', 'ticket_id',    'STRING',    TRUE,  TRUE,  '工单号'),
    ('Ticket', 'title',        'STRING',    FALSE, TRUE,  '标题'),
    ('Ticket', 'priority',     'INTEGER',   FALSE, FALSE, '优先级 1-5');
\`\`\`

### 3.3 插入实例数据

\`\`\`sql
-- Employee 实例（使用 DuckDB JSON 构造）
INSERT INTO ontology.object_instance (type_name, display_name, properties)
VALUES
    ('Employee', 'Alice',   '{"emp_id":"E001","name":"Alice","hire_date":"2020-03-15","salary":95000,"is_active":true}'),
    ('Employee', 'Bob',     '{"emp_id":"E002","name":"Bob","hire_date":"2019-07-01","salary":105000,"is_active":true}'),
    ('Employee', 'Charlie', '{"emp_id":"E003","name":"Charlie","hire_date":"2021-01-10","salary":82000,"is_active":false}'),
    ('Employee', 'Diana',   '{"emp_id":"E004","name":"Diana","hire_date":"2022-06-20","salary":78000,"is_active":true}'),
    ('Employee', 'Eve',     '{"emp_id":"E005","name":"Eve","hire_date":"2018-11-05","salary":120000,"is_active":true}');

INSERT INTO ontology.object_instance (type_name, display_name, properties)
VALUES
    ('Department', 'Engineering',  '{"dept_id":"D001","dept_name":"Engineering"}'),
    ('Department', 'Marketing',    '{"dept_id":"D002","dept_name":"Marketing"}'),
    ('Department', 'Operations',   '{"dept_id":"D003","dept_name":"Operations"}');

INSERT INTO ontology.object_instance (type_name, display_name, properties)
VALUES
    ('Project', 'Project Alpha',  '{"proj_id":"P001","proj_name":"Project Alpha","budget":500000}'),
    ('Project', 'Project Beta',   '{"proj_id":"P002","proj_name":"Project Beta","budget":300000}');

INSERT INTO ontology.object_instance (type_name, display_name, properties)
VALUES
    ('Ticket', 'Fix login bug',       '{"ticket_id":"T001","title":"Fix login bug","priority":1}'),
    ('Ticket', 'Update dashboard',    '{"ticket_id":"T002","title":"Update dashboard","priority":3}'),
    ('Ticket', 'DB migration',        '{"ticket_id":"T003","title":"DB migration","priority":2}');
\`\`\`

### 3.4 查询：理解 Object

\`\`\`sql
-- 查看所有 Object Type 及其属性数量
SELECT
    ot.icon,
    ot.type_name,
    ot.is_abstract,
    ot.parent_type,
    ot.tags,
    COUNT(pd.prop_id) AS prop_count
FROM ontology.object_type ot
LEFT JOIN ontology.property_definition pd USING (type_name)
GROUP BY ALL
ORDER BY ot.type_id;

-- 用 JSON 提取函数查询 Employee 实例的结构化字段
SELECT
    instance_id,
    display_name,
    properties->>'emp_id'    AS emp_id,
    properties->>'name'      AS name,
    CAST(properties->>'salary' AS FLOAT) AS salary,
    CAST(properties->>'is_active' AS BOOLEAN) AS is_active
FROM ontology.object_instance
WHERE type_name = 'Employee'
ORDER BY salary DESC;
\`\`\`

> **核心洞察**：Object = Type 定义 + Property Schema + 实例集合。Ontology 的 Object 不仅仅是一张表，它是**自描述**的 — 类型定义本身也是 Object。

---

## 4. 第二部分：Link — 关系即结构

### 4.1 元模型设计

Link 有三个层次：
- **Link Type**：关系类型定义（如 "belongs_to"、"assigned_to"）
- **Link Instance**：两个 Object Instance 之间的具体关系
- **Link 的基数约束**：one-to-one / one-to-many / many-to-many

\`\`\`sql
CREATE SEQUENCE ontology.seq_link_type START 1;
CREATE SEQUENCE ontology.seq_link_instance START 1;

-- ============================================================
-- ENUM: 关系基数
-- ============================================================
CREATE TYPE ontology.cardinality AS ENUM (
    'ONE_TO_ONE', 'ONE_TO_MANY', 'MANY_TO_ONE', 'MANY_TO_MANY'
);

-- ============================================================
-- TABLE 4: Link Type（关系类型定义）
-- ============================================================
CREATE TABLE ontology.link_type (
    link_type_id    INTEGER DEFAULT nextval('ontology.seq_link_type') PRIMARY KEY,
    link_name       VARCHAR NOT NULL UNIQUE,          -- e.g. 'belongs_to'
    from_type       VARCHAR NOT NULL,                 -- 源 Object Type
    to_type         VARCHAR NOT NULL,                 -- 目标 Object Type
    cardinality     ontology.cardinality NOT NULL,
    is_directed     BOOLEAN DEFAULT TRUE,             -- 有向/无向
    reverse_name    VARCHAR,                          -- 反向名称
    description     VARCHAR,
    properties      JSON,                             -- Link 自身可携带属性
    FOREIGN KEY (from_type) REFERENCES ontology.object_type(type_name),
    FOREIGN KEY (to_type) REFERENCES ontology.object_type(type_name)
);

-- ============================================================
-- TABLE 5: Link Instance（关系实例）
-- ============================================================
CREATE TABLE ontology.link_instance (
    link_id         INTEGER DEFAULT nextval('ontology.seq_link_instance') PRIMARY KEY,
    link_name       VARCHAR NOT NULL,
    from_instance   INTEGER NOT NULL,
    to_instance     INTEGER NOT NULL,
    properties      JSON,                             -- 关系上的属性（如 role, weight）
    created_at      TIMESTAMP DEFAULT current_timestamp,
    valid_from      TIMESTAMP DEFAULT current_timestamp,
    valid_to        TIMESTAMP,                        -- NULL = 当前有效
    FOREIGN KEY (link_name) REFERENCES ontology.link_type(link_name),
    FOREIGN KEY (from_instance) REFERENCES ontology.object_instance(instance_id),
    FOREIGN KEY (to_instance) REFERENCES ontology.object_instance(instance_id),
    -- 防止重复关系
    UNIQUE (link_name, from_instance, to_instance, valid_from)
);
\`\`\`

### 4.2 定义 Link Types 并创建实例

\`\`\`sql
-- 定义关系类型
INSERT INTO ontology.link_type (link_name, from_type, to_type, cardinality, is_directed, reverse_name, description)
VALUES
    ('belongs_to_dept',  'Employee',   'Department', 'MANY_TO_ONE',  TRUE, 'has_member',      '员工所属部门'),
    ('manages',          'Employee',   'Department', 'ONE_TO_ONE',   TRUE, 'managed_by',      '员工管理部门'),
    ('works_on',         'Employee',   'Project',    'MANY_TO_MANY', TRUE, 'has_worker',      '员工参与项目'),
    ('assigned_ticket',  'Employee',   'Ticket',     'ONE_TO_MANY',  TRUE, 'assigned_to',     '员工被分配工单'),
    ('dept_owns_proj',   'Department', 'Project',    'ONE_TO_MANY',  TRUE, 'owned_by_dept',   '部门拥有项目'),
    ('ticket_in_proj',   'Ticket',     'Project',    'MANY_TO_ONE',  TRUE, 'has_ticket',      '工单属于项目');

-- 创建关系实例（通过子查询获取 instance_id）
-- Alice(1), Bob(2), Charlie(3), Diana(4), Eve(5)
-- Engineering(6), Marketing(7), Operations(8)
-- Project Alpha(9), Project Beta(10)
-- Ticket T001(11), T002(12), T003(13)

INSERT INTO ontology.link_instance (link_name, from_instance, to_instance, properties)
VALUES
    -- 员工归属部门
    ('belongs_to_dept', 1, 6, '{"since":"2020-03"}'),   -- Alice → Engineering
    ('belongs_to_dept', 2, 6, '{"since":"2019-07"}'),   -- Bob → Engineering
    ('belongs_to_dept', 3, 7, '{"since":"2021-01"}'),   -- Charlie → Marketing
    ('belongs_to_dept', 4, 8, '{"since":"2022-06"}'),   -- Diana → Operations
    ('belongs_to_dept', 5, 6, '{"since":"2018-11"}'),   -- Eve → Engineering
    -- 部门经理
    ('manages', 5, 6, NULL),                             -- Eve manages Engineering
    ('manages', 3, 7, NULL),                             -- Charlie manages Marketing
    -- 项目参与
    ('works_on', 1, 9, '{"role":"developer"}'),          -- Alice → Alpha
    ('works_on', 2, 9, '{"role":"lead"}'),               -- Bob → Alpha
    ('works_on', 2, 10, '{"role":"reviewer"}'),          -- Bob → Beta
    ('works_on', 4, 10, '{"role":"developer"}'),         -- Diana → Beta
    -- 工单分配
    ('assigned_ticket', 1, 11, NULL),                    -- Alice ← T001
    ('assigned_ticket', 2, 12, NULL),                    -- Bob ← T002
    ('assigned_ticket', 1, 13, NULL),                    -- Alice ← T003
    -- 工单属于项目
    ('ticket_in_proj', 11, 9, NULL),                     -- T001 → Alpha
    ('ticket_in_proj', 12, 9, NULL),                     -- T002 → Alpha
    ('ticket_in_proj', 13, 10, NULL),                    -- T003 → Beta
    -- 部门拥有项目
    ('dept_owns_proj', 6, 9, NULL),                      -- Engineering → Alpha
    ('dept_owns_proj', 8, 10, NULL);                     -- Operations → Beta
\`\`\`

### 4.3 查询：理解 Link

\`\`\`sql
-- 查看所有 Link Type 定义
SELECT
    '🔗' AS icon,
    link_name,
    from_type || ' → ' || to_type AS direction,
    cardinality,
    reverse_name
FROM ontology.link_type;

-- 图遍历：从 Alice 出发，找到她所有的直接关系
SELECT
    'Alice' AS from_entity,
    li.link_name AS relationship,
    oi.display_name AS to_entity,
    oi.type_name AS to_type,
    li.properties->>'role' AS role_on_link
FROM ontology.link_instance li
JOIN ontology.object_instance oi ON li.to_instance = oi.instance_id
WHERE li.from_instance = 1
ORDER BY li.link_name;

-- 反向遍历：谁在 Engineering 部门？（利用 reverse_name 语义）
SELECT
    oi.display_name AS employee,
    li.properties->>'since' AS joined_since
FROM ontology.link_instance li
JOIN ontology.object_instance oi ON li.from_instance = oi.instance_id
WHERE li.link_name = 'belongs_to_dept'
  AND li.to_instance = (
      SELECT instance_id FROM ontology.object_instance
      WHERE display_name = 'Engineering'
  );

-- 多跳查询：Employee → Department → Project (2-hop)
SELECT DISTINCT
    e.display_name AS employee,
    d.display_name AS department,
    p.display_name AS project
FROM ontology.link_instance l1
JOIN ontology.object_instance e ON l1.from_instance = e.instance_id
JOIN ontology.object_instance d ON l1.to_instance = d.instance_id
JOIN ontology.link_instance l2 ON l2.from_instance = d.instance_id
JOIN ontology.object_instance p ON l2.to_instance = p.instance_id
WHERE l1.link_name = 'belongs_to_dept'
  AND l2.link_name = 'dept_owns_proj'
ORDER BY employee;
\`\`\`

> **核心洞察**：Link = 有类型的边 + 自身属性 + 基数约束 + 双向语义。它不仅仅是外键，它是**一等公民**。

---

## 5. 第三部分：State — 状态即生命周期

### 5.1 元模型设计

State 描述 Object Instance 在时间轴上的离散阶段。

\`\`\`sql
CREATE SEQUENCE ontology.seq_state_type START 1;
CREATE SEQUENCE ontology.seq_state_history START 1;

-- ============================================================
-- TABLE 6: State Type（状态类型定义 — 绑定到 Object Type）
-- ============================================================
CREATE TABLE ontology.state_type (
    state_type_id  INTEGER DEFAULT nextval('ontology.seq_state_type') PRIMARY KEY,
    object_type    VARCHAR NOT NULL,                  -- 哪个 Object Type 拥有这组状态
    state_name     VARCHAR NOT NULL,                  -- e.g. 'OPEN'
    ordinal        INTEGER NOT NULL,                  -- 状态排序（生命周期位置）
    is_initial     BOOLEAN DEFAULT FALSE,
    is_terminal    BOOLEAN DEFAULT FALSE,
    color          VARCHAR DEFAULT '#888888',          -- 可视化颜色
    description    VARCHAR,
    UNIQUE (object_type, state_name),
    FOREIGN KEY (object_type) REFERENCES ontology.object_type(type_name)
);

-- ============================================================
-- TABLE 7: State Transition Rule（允许的状态转换）
-- ============================================================
CREATE TABLE ontology.state_transition_rule (
    rule_id        INTEGER PRIMARY KEY,
    object_type    VARCHAR NOT NULL,
    from_state     VARCHAR NOT NULL,
    to_state       VARCHAR NOT NULL,
    guard_expr     VARCHAR,                           -- 转换守卫条件（表达式）
    description    VARCHAR,
    UNIQUE (object_type, from_state, to_state)
);

-- ============================================================
-- TABLE 8: State History（状态变更历史 — 时间序列）
-- ============================================================
CREATE TABLE ontology.state_history (
    history_id     INTEGER DEFAULT nextval('ontology.seq_state_history') PRIMARY KEY,
    instance_id    INTEGER NOT NULL,
    from_state     VARCHAR,                           -- NULL = 初始创建
    to_state       VARCHAR NOT NULL,
    changed_at     TIMESTAMP DEFAULT current_timestamp,
    changed_by     VARCHAR DEFAULT 'system',
    reason         VARCHAR,
    action_ref     INTEGER,                           -- 关联触发此变更的 Action
    FOREIGN KEY (instance_id) REFERENCES ontology.object_instance(instance_id)
);
\`\`\`

### 5.2 定义状态机

\`\`\`sql
-- Ticket 的状态集合
INSERT INTO ontology.state_type (object_type, state_name, ordinal, is_initial, is_terminal, color, description)
VALUES
    ('Ticket', 'DRAFT',       0, TRUE,  FALSE, '#CCCCCC', '草稿'),
    ('Ticket', 'OPEN',        1, FALSE, FALSE, '#3498DB', '已开启'),
    ('Ticket', 'IN_PROGRESS', 2, FALSE, FALSE, '#F39C12', '进行中'),
    ('Ticket', 'IN_REVIEW',   3, FALSE, FALSE, '#9B59B6', '审核中'),
    ('Ticket', 'RESOLVED',    4, FALSE, FALSE, '#2ECC71', '已解决'),
    ('Ticket', 'CLOSED',      5, FALSE, TRUE,  '#1ABC9C', '已关闭'),
    ('Ticket', 'CANCELLED',   6, FALSE, TRUE,  '#E74C3C', '已取消');

-- Employee 的状态集合
INSERT INTO ontology.state_type (object_type, state_name, ordinal, is_initial, is_terminal, color, description)
VALUES
    ('Employee', 'ONBOARDING',  0, TRUE,  FALSE, '#3498DB', '入职中'),
    ('Employee', 'ACTIVE',      1, FALSE, FALSE, '#2ECC71', '在职'),
    ('Employee', 'ON_LEAVE',    2, FALSE, FALSE, '#F39C12', '休假'),
    ('Employee', 'OFFBOARDING', 3, FALSE, FALSE, '#E67E22', '离职中'),
    ('Employee', 'TERMINATED',  4, FALSE, TRUE,  '#E74C3C', '已离职');

-- 状态转换规则
INSERT INTO ontology.state_transition_rule VALUES
    -- Ticket 的转换规则
    (1,  'Ticket', 'DRAFT',       'OPEN',        NULL, '提交工单'),
    (2,  'Ticket', 'DRAFT',       'CANCELLED',   NULL, '取消草稿'),
    (3,  'Ticket', 'OPEN',        'IN_PROGRESS', NULL, '开始处理'),
    (4,  'Ticket', 'OPEN',        'CANCELLED',   NULL, '取消工单'),
    (5,  'Ticket', 'IN_PROGRESS', 'IN_REVIEW',   NULL, '提交审核'),
    (6,  'Ticket', 'IN_PROGRESS', 'OPEN',        NULL, '退回重开'),
    (7,  'Ticket', 'IN_REVIEW',   'RESOLVED',    NULL, '审核通过'),
    (8,  'Ticket', 'IN_REVIEW',   'IN_PROGRESS', NULL, '打回修改'),
    (9,  'Ticket', 'RESOLVED',    'CLOSED',      NULL, '确认关闭'),
    (10, 'Ticket', 'RESOLVED',    'OPEN',        NULL, '重新打开'),
    -- Employee 的转换规则
    (11, 'Employee', 'ONBOARDING',  'ACTIVE',      NULL, '入职完成'),
    (12, 'Employee', 'ACTIVE',      'ON_LEAVE',    NULL, '开始休假'),
    (13, 'Employee', 'ON_LEAVE',    'ACTIVE',      NULL, '休假结束'),
    (14, 'Employee', 'ACTIVE',      'OFFBOARDING', 'tenure > 0', '申请离职'),
    (15, 'Employee', 'OFFBOARDING', 'TERMINATED',  NULL, '离职完成');
\`\`\`

### 5.3 记录状态历史

\`\`\`sql
-- Ticket T001 (instance_id=11) 的状态流转
INSERT INTO ontology.state_history (instance_id, from_state, to_state, changed_at, changed_by, reason)
VALUES
    (11, NULL,          'DRAFT',       '2024-01-10 09:00:00', 'alice',  '创建工单'),
    (11, 'DRAFT',       'OPEN',        '2024-01-10 09:15:00', 'alice',  '提交'),
    (11, 'OPEN',        'IN_PROGRESS', '2024-01-10 10:00:00', 'alice',  '开始修复'),
    (11, 'IN_PROGRESS', 'IN_REVIEW',   '2024-01-11 16:00:00', 'alice',  '修复完成，提交 review'),
    (11, 'IN_REVIEW',   'RESOLVED',    '2024-01-12 11:00:00', 'bob',    'Code review 通过');

-- Ticket T002 (instance_id=12)
INSERT INTO ontology.state_history (instance_id, from_state, to_state, changed_at, changed_by, reason)
VALUES
    (12, NULL,          'DRAFT',       '2024-01-11 08:00:00', 'bob',    '创建'),
    (12, 'DRAFT',       'OPEN',        '2024-01-11 08:30:00', 'bob',    '提交'),
    (12, 'OPEN',        'IN_PROGRESS', '2024-01-12 09:00:00', 'bob',    '开始开发');

-- Employee Alice (instance_id=1)
INSERT INTO ontology.state_history (instance_id, from_state, to_state, changed_at, changed_by, reason)
VALUES
    (1, NULL,          'ONBOARDING', '2020-03-01 09:00:00', 'hr_system', '入职流程启动'),
    (1, 'ONBOARDING',  'ACTIVE',    '2020-03-15 09:00:00', 'hr_system', '入职完成'),
    (1, 'ACTIVE',      'ON_LEAVE',  '2024-07-01 00:00:00', 'alice',     '年假'),
    (1, 'ON_LEAVE',    'ACTIVE',    '2024-07-15 00:00:00', 'alice',     '休假结束');
\`\`\`

### 5.4 查询：理解 State

\`\`\`sql
-- 查看 Ticket 的状态机定义（生命周期图）
SELECT
    st.state_name,
    st.ordinal,
    CASE WHEN st.is_initial THEN '→ START' ELSE '' END AS start_marker,
    CASE WHEN st.is_terminal THEN 'END ■' ELSE '' END AS end_marker,
    st.color,
    LIST(str.to_state ORDER BY str.to_state) AS can_transition_to
FROM ontology.state_type st
LEFT JOIN ontology.state_transition_rule str
    ON st.object_type = str.object_type AND st.state_name = str.from_state
WHERE st.object_type = 'Ticket'
GROUP BY ALL
ORDER BY st.ordinal;

-- 查看 T001 的完整状态时间线
SELECT
    sh.changed_at,
    COALESCE(sh.from_state, '(none)') AS from_state,
    '→' AS arrow,
    sh.to_state,
    sh.changed_by,
    sh.reason,
    -- 计算在每个状态停留时长
    COALESCE(
        LEAD(sh.changed_at) OVER (ORDER BY sh.changed_at) - sh.changed_at,
        INTERVAL '0' SECOND
    ) AS duration_in_state
FROM ontology.state_history sh
WHERE sh.instance_id = 11
ORDER BY sh.changed_at;

-- 所有实例的当前状态（取每个 instance 最新的 state）
SELECT
    oi.type_name,
    oi.display_name,
    sh.to_state AS current_state,
    sh.changed_at AS since
FROM ontology.state_history sh
JOIN ontology.object_instance oi ON sh.instance_id = oi.instance_id
QUALIFY ROW_NUMBER() OVER (
    PARTITION BY sh.instance_id
    ORDER BY sh.changed_at DESC
) = 1
ORDER BY oi.type_name, oi.display_name;
\`\`\`

> **核心洞察**：State = 有限状态集 + 转换规则 + 时序历史。它让 Object 有了**生命周期**，而不仅仅是静态属性包。

---

## 6. 第四部分：Action — 行为即变迁

### 6.1 元模型设计

Action 是唯一能改变 Object 状态和 Link 关系的操作。它连接了前三个概念。

\`\`\`sql
CREATE SEQUENCE ontology.seq_action_type START 1;
CREATE SEQUENCE ontology.seq_action_log START 1;

-- ============================================================
-- ENUM: Action 操作类别
-- ============================================================
CREATE TYPE ontology.action_category AS ENUM (
    'CREATE',           -- 创建 Object
    'UPDATE',           -- 修改 Object 属性
    'DELETE',           -- 删除 Object
    'STATE_CHANGE',     -- 状态转换
    'LINK_CREATE',      -- 创建关系
    'LINK_DELETE',      -- 删除关系
    'COMPOSITE'         -- 组合操作
);

-- ============================================================
-- TABLE 9: Action Type（行为类型定义）
-- ============================================================
CREATE TABLE ontology.action_type (
    action_type_id  INTEGER DEFAULT nextval('ontology.seq_action_type') PRIMARY KEY,
    action_name     VARCHAR NOT NULL UNIQUE,
    category        ontology.action_category NOT NULL,
    target_type     VARCHAR NOT NULL,                 -- 作用于哪个 Object Type
    description     VARCHAR,
    preconditions   JSON,                             -- 前置条件（声明式）
    effects         JSON,                             -- 效果描述（声明式）
    parameters      JSON,                             -- 参数签名
    requires_auth   BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (target_type) REFERENCES ontology.object_type(type_name)
);

-- ============================================================
-- TABLE 10: Action Log（行为执行日志 — 完整审计）
-- ============================================================
CREATE TABLE ontology.action_log (
    log_id          INTEGER DEFAULT nextval('ontology.seq_action_log') PRIMARY KEY,
    action_name     VARCHAR NOT NULL,
    executed_at     TIMESTAMP DEFAULT current_timestamp,
    executed_by     VARCHAR NOT NULL,
    target_instance INTEGER,                          -- 作用的 Object Instance
    parameters      JSON,                             -- 实际传入的参数
    result          VARCHAR DEFAULT 'SUCCESS',        -- SUCCESS / FAILED / ROLLED_BACK
    error_message   VARCHAR,
    before_snapshot JSON,                             -- 执行前快照
    after_snapshot  JSON,                             -- 执行后快照
    duration_ms     INTEGER,                          -- 执行耗时
    FOREIGN KEY (action_name) REFERENCES ontology.action_type(action_name),
    FOREIGN KEY (target_instance) REFERENCES ontology.object_instance(instance_id)
);
\`\`\`

### 6.2 定义 Action Types

\`\`\`sql
INSERT INTO ontology.action_type (action_name, category, target_type, description, preconditions, effects, parameters, requires_auth)
VALUES
    ('create_ticket',     'CREATE',       'Ticket',   '创建新工单',
     '{}',
     '{"state": "DRAFT"}',
     '{"title": "STRING", "priority": "INTEGER", "project_id": "STRING"}',
     FALSE),

    ('submit_ticket',     'STATE_CHANGE', 'Ticket',   '提交工单（DRAFT→OPEN）',
     '{"current_state": "DRAFT"}',
     '{"new_state": "OPEN"}',
     '{}',
     FALSE),

    ('start_work',        'STATE_CHANGE', 'Ticket',   '开始处理（OPEN→IN_PROGRESS）',
     '{"current_state": "OPEN", "has_assignee": true}',
     '{"new_state": "IN_PROGRESS"}',
     '{}',
     FALSE),

    ('submit_review',     'STATE_CHANGE', 'Ticket',   '提交审核（IN_PROGRESS→IN_REVIEW）',
     '{"current_state": "IN_PROGRESS"}',
     '{"new_state": "IN_REVIEW"}',
     '{"review_notes": "STRING"}',
     FALSE),

    ('approve_ticket',    'STATE_CHANGE', 'Ticket',   '审核通过（IN_REVIEW→RESOLVED）',
     '{"current_state": "IN_REVIEW"}',
     '{"new_state": "RESOLVED"}',
     '{}',
     TRUE),

    ('close_ticket',      'STATE_CHANGE', 'Ticket',   '关闭工单（RESOLVED→CLOSED）',
     '{"current_state": "RESOLVED"}',
     '{"new_state": "CLOSED"}',
     '{}',
     FALSE),

    ('assign_ticket',     'COMPOSITE',    'Ticket',   '分配工单给员工（创建 Link + 可能变更状态）',
     '{}',
     '{"link": "assigned_ticket"}',
     '{"employee_id": "INTEGER"}',
     FALSE),

    ('transfer_dept',     'COMPOSITE',    'Employee', '员工调岗（删除旧 Link + 创建新 Link）',
     '{"current_state": "ACTIVE"}',
     '{"old_link_delete": "belongs_to_dept", "new_link_create": "belongs_to_dept"}',
     '{"new_dept_id": "INTEGER"}',
     TRUE),

    ('update_salary',     'UPDATE',       'Employee', '调整薪资',
     '{"current_state": "ACTIVE"}',
     '{"field": "salary"}',
     '{"new_salary": "FLOAT", "reason": "STRING"}',
     TRUE),

    ('onboard_employee',  'COMPOSITE',    'Employee', '完成入职（状态变更 + 部门关系建立）',
     '{"current_state": "ONBOARDING"}',
     '{"new_state": "ACTIVE", "link": "belongs_to_dept"}',
     '{"dept_id": "INTEGER"}',
     TRUE);
\`\`\`

### 6.3 模拟执行 Action 并记录日志

\`\`\`sql
-- 模拟：Alice 创建并提交了 T001
INSERT INTO ontology.action_log (action_name, executed_at, executed_by, target_instance, parameters, result, before_snapshot, after_snapshot, duration_ms)
VALUES
    ('create_ticket',  '2024-01-10 09:00:00', 'alice', 11,
     '{"title":"Fix login bug","priority":1,"project_id":"P001"}',
     'SUCCESS', NULL, '{"state":"DRAFT","title":"Fix login bug"}', 45),

    ('submit_ticket',  '2024-01-10 09:15:00', 'alice', 11,
     '{}',
     'SUCCESS', '{"state":"DRAFT"}', '{"state":"OPEN"}', 12),

    ('assign_ticket',  '2024-01-10 09:20:00', 'system', 11,
     '{"employee_id":1}',
     'SUCCESS', '{"assignee":null}', '{"assignee":"Alice"}', 30),

    ('start_work',     '2024-01-10 10:00:00', 'alice', 11,
     '{}',
     'SUCCESS', '{"state":"OPEN"}', '{"state":"IN_PROGRESS"}', 8),

    ('submit_review',  '2024-01-11 16:00:00', 'alice', 11,
     '{"review_notes":"Fixed auth token refresh"}',
     'SUCCESS', '{"state":"IN_PROGRESS"}', '{"state":"IN_REVIEW"}', 15),

    ('approve_ticket', '2024-01-12 11:00:00', 'bob', 11,
     '{}',
     'SUCCESS', '{"state":"IN_REVIEW"}', '{"state":"RESOLVED"}', 10),

    -- 模拟一个失败的 Action
    ('update_salary',  '2024-01-15 14:00:00', 'diana', 1,
     '{"new_salary":100000,"reason":"promotion"}',
     'FAILED', NULL, NULL, 5),

    -- 成功的薪资更新
    ('update_salary',  '2024-01-15 14:05:00', 'eve', 1,
     '{"new_salary":100000,"reason":"promotion"}',
     'SUCCESS', '{"salary":95000}', '{"salary":100000}', 22);
\`\`\`

### 6.4 查询：理解 Action

\`\`\`sql
-- 查看所有 Action Type 及其分类分布
SELECT
    category,
    COUNT(*) AS count,
    LIST(action_name) AS actions
FROM ontology.action_type
GROUP BY category
ORDER BY category;

-- T001 的完整 Action 时间线（审计追踪）
SELECT
    al.executed_at,
    al.action_name,
    at.category,
    al.executed_by,
    al.result,
    al.before_snapshot->>'state' AS state_before,
    al.after_snapshot->>'state'  AS state_after,
    al.duration_ms || 'ms' AS duration,
    al.parameters
FROM ontology.action_log al
JOIN ontology.action_type at ON al.action_name = at.action_name
WHERE al.target_instance = 11
ORDER BY al.executed_at;

-- 统计：各操作者的行为分布
SELECT
    executed_by,
    COUNT(*) AS total_actions,
    COUNT(*) FILTER (WHERE result = 'SUCCESS') AS successes,
    COUNT(*) FILTER (WHERE result = 'FAILED') AS failures,
    ROUND(AVG(duration_ms), 1) AS avg_duration_ms
FROM ontology.action_log
GROUP BY executed_by
ORDER BY total_actions DESC;
\`\`\`

> **核心洞察**：Action = 参数化操作 + 前置条件 + 效果声明 + 审计日志。它是 Ontology 中**唯一合法的变更入口**，确保所有变化可追溯。

---

## 7. 第五部分：四元协作 — 完整运转

现在把四个概念联合起来，展示它们如何协同工作。

### 7.1 全景视图：某个 Object 的完整上下文

\`\`\`sql
-- 完整上下文查询：给定一个 Object Instance，展示其所有维度
WITH target AS (SELECT 11 AS id), -- T001: Fix login bug

-- 基本信息
obj AS (
    SELECT * FROM ontology.object_instance WHERE instance_id = (SELECT id FROM target)
),

-- 当前状态
current_state AS (
    SELECT to_state, changed_at
    FROM ontology.state_history
    WHERE instance_id = (SELECT id FROM target)
    ORDER BY changed_at DESC
    LIMIT 1
),

-- 所有关系
relationships AS (
    SELECT
        li.link_name,
        CASE WHEN li.from_instance = (SELECT id FROM target)
             THEN 'outgoing' ELSE 'incoming' END AS direction,
        CASE WHEN li.from_instance = (SELECT id FROM target)
             THEN oi2.display_name ELSE oi1.display_name END AS related_entity,
        li.properties AS link_props
    FROM ontology.link_instance li
    JOIN ontology.object_instance oi1 ON li.from_instance = oi1.instance_id
    JOIN ontology.object_instance oi2 ON li.to_instance = oi2.instance_id
    WHERE li.from_instance = (SELECT id FROM target)
       OR li.to_instance = (SELECT id FROM target)
),

-- 最近的 Actions
recent_actions AS (
    SELECT action_name, executed_at, executed_by, result
    FROM ontology.action_log
    WHERE target_instance = (SELECT id FROM target)
    ORDER BY executed_at DESC
    LIMIT 5
)

SELECT '📦 OBJECT' AS section, obj.type_name || ': ' || obj.display_name AS detail, NULL AS extra
FROM obj
UNION ALL
SELECT '🔄 STATE', cs.to_state || ' (since ' || cs.changed_at::VARCHAR || ')', NULL
FROM current_state cs
UNION ALL
SELECT '🔗 LINK', r.direction || ': ' || r.link_name || ' → ' || r.related_entity, r.link_props::VARCHAR
FROM relationships r
UNION ALL
SELECT '⚡ ACTION', ra.action_name || ' by ' || ra.executed_by || ' [' || ra.result || ']', ra.executed_at::VARCHAR
FROM recent_actions ra;
\`\`\`

### 7.2 元模型自引用：Ontology 描述自身

\`\`\`sql
-- 元层面：有多少 Object Type？每个有几个属性、几种状态、几种 Action？
SELECT
    ot.icon,
    ot.type_name,
    (SELECT COUNT(*) FROM ontology.property_definition pd WHERE pd.type_name = ot.type_name) AS properties,
    (SELECT COUNT(*) FROM ontology.state_type st WHERE st.object_type = ot.type_name) AS states,
    (SELECT COUNT(*) FROM ontology.action_type at WHERE at.target_type = ot.type_name) AS actions,
    (SELECT COUNT(*) FROM ontology.link_type lt
     WHERE lt.from_type = ot.type_name OR lt.to_type = ot.type_name) AS link_types,
    (SELECT COUNT(*) FROM ontology.object_instance oi WHERE oi.type_name = ot.type_name) AS instances
FROM ontology.object_type ot
WHERE NOT ot.is_abstract
ORDER BY ot.type_name;
\`\`\`

### 7.3 验证：状态转换合法性检查

\`\`\`sql
-- 检查：是否存在历史中出现了非法的状态转换
SELECT
    sh.history_id,
    oi.display_name,
    sh.from_state,
    sh.to_state,
    CASE WHEN str.rule_id IS NOT NULL THEN '✅ VALID' ELSE '❌ INVALID' END AS validity
FROM ontology.state_history sh
JOIN ontology.object_instance oi ON sh.instance_id = oi.instance_id
LEFT JOIN ontology.state_transition_rule str
    ON str.object_type = oi.type_name
    AND str.from_state = sh.from_state
    AND str.to_state = sh.to_state
WHERE sh.from_state IS NOT NULL  -- 排除初始创建
ORDER BY sh.changed_at;
\`\`\`

---

## 8. 第六部分：DuckDB 全能力覆盖

以下按 MECE 原则，确保覆盖 DuckDB 所支持的各类操作。

### 8.1 DDL（已覆盖于上文）

\`\`\`sql
-- 汇总已使用的 DDL
-- ✅ CREATE SCHEMA
-- ✅ CREATE TABLE (含约束: PK, FK, UNIQUE, DEFAULT)
-- ✅ CREATE SEQUENCE
-- ✅ CREATE TYPE (ENUM)
-- ✅ 复合类型: VARCHAR[], MAP(K,V), JSON, STRUCT

-- 补充：ALTER TABLE
ALTER TABLE ontology.object_type ADD COLUMN visibility VARCHAR DEFAULT 'PUBLIC';

-- 补充：CREATE VIEW
CREATE VIEW ontology.v_current_states AS
SELECT
    oi.instance_id,
    oi.type_name,
    oi.display_name,
    sh.to_state AS current_state,
    sh.changed_at AS state_since
FROM ontology.state_history sh
JOIN ontology.object_instance oi ON sh.instance_id = oi.instance_id
QUALIFY ROW_NUMBER() OVER (PARTITION BY sh.instance_id ORDER BY sh.changed_at DESC) = 1;

-- 补充：CREATE TEMPORARY TABLE
CREATE TEMPORARY TABLE tmp_analysis AS
SELECT type_name, COUNT(*) AS cnt FROM ontology.object_instance GROUP BY type_name;

-- 补充：CREATE MACRO (标量)
CREATE MACRO ontology.is_terminal_state(obj_type, state) AS (
    EXISTS (
        SELECT 1 FROM ontology.state_type
        WHERE object_type = obj_type AND state_name = state AND is_terminal
    )
);

-- 补充：CREATE TABLE MACRO (表函数)
CREATE MACRO ontology.get_instances(t) AS TABLE
    SELECT * FROM ontology.object_instance WHERE type_name = t;

-- 补充：DROP
DROP TABLE IF EXISTS tmp_analysis;
\`\`\`

### 8.2 DML

\`\`\`sql
-- ✅ INSERT (已大量使用)

-- ✅ UPDATE
UPDATE ontology.object_instance
SET properties = json_merge_patch(properties, '{"salary": 100000}'),
    updated_at = current_timestamp,
    version = version + 1
WHERE instance_id = 1;

-- ✅ DELETE
DELETE FROM ontology.action_log WHERE result = 'FAILED';

-- ✅ UPSERT (INSERT OR REPLACE / ON CONFLICT)
INSERT INTO ontology.object_type (type_name, description, icon)
VALUES ('Employee', '业务示例: 员工（更新版）', '👤')
ON CONFLICT (type_name) DO UPDATE SET description = EXCLUDED.description;

-- ✅ INSERT FROM SELECT
INSERT INTO ontology.state_history (instance_id, from_state, to_state, changed_at, changed_by, reason)
SELECT
    12, 'IN_PROGRESS', 'IN_REVIEW', '2024-01-13 10:00:00', 'bob', '模拟批量插入'
FROM (SELECT 1);
\`\`\`

### 8.3 窗口函数（Window Functions）

\`\`\`sql
-- ROW_NUMBER: 已在 current_state 查询中使用

-- RANK / DENSE_RANK: 按薪资排名
SELECT
    display_name,
    CAST(properties->>'salary' AS FLOAT) AS salary,
    RANK() OVER (ORDER BY CAST(properties->>'salary' AS FLOAT) DESC) AS salary_rank,
    DENSE_RANK() OVER (ORDER BY CAST(properties->>'salary' AS FLOAT) DESC) AS dense_rank,
    NTILE(3) OVER (ORDER BY CAST(properties->>'salary' AS FLOAT) DESC) AS salary_tier
FROM ontology.object_instance
WHERE type_name = 'Employee';

-- LAG / LEAD: 状态变更的前后对比
SELECT
    changed_at,
    to_state,
    LAG(to_state) OVER (ORDER BY changed_at) AS prev_state,
    LEAD(to_state) OVER (ORDER BY changed_at) AS next_state,
    changed_at - LAG(changed_at) OVER (ORDER BY changed_at) AS time_in_prev_state
FROM ontology.state_history
WHERE instance_id = 11;

-- FIRST_VALUE / LAST_VALUE
SELECT DISTINCT
    instance_id,
    FIRST_VALUE(to_state) OVER w AS initial_state,
    LAST_VALUE(to_state) OVER w AS latest_state,
    COUNT(*) OVER w AS total_transitions
FROM ontology.state_history
WINDOW w AS (
    PARTITION BY instance_id
    ORDER BY changed_at
    ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
);

-- 累积统计：Action 执行的累计计数
SELECT
    executed_at::DATE AS action_date,
    action_name,
    COUNT(*) AS daily_count,
    SUM(COUNT(*)) OVER (ORDER BY executed_at::DATE) AS cumulative_total
FROM ontology.action_log
GROUP BY action_date, action_name
ORDER BY action_date;
\`\`\`

### 8.4 聚合函数

\`\`\`sql
-- 基础聚合
SELECT
    type_name,
    COUNT(*) AS instance_count,
    MIN(created_at) AS earliest,
    MAX(created_at) AS latest
FROM ontology.object_instance
GROUP BY type_name;

-- LIST / STRING_AGG: 聚合为列表
SELECT
    object_type,
    LIST(state_name ORDER BY ordinal) AS state_lifecycle,
    STRING_AGG(state_name, ' → ' ORDER BY ordinal) AS lifecycle_path
FROM ontology.state_type
GROUP BY object_type;

-- FILTER 子句
SELECT
    executed_by,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE result = 'SUCCESS') AS ok,
    COUNT(*) FILTER (WHERE result = 'FAILED') AS fail,
    AVG(duration_ms) FILTER (WHERE result = 'SUCCESS') AS avg_ok_ms
FROM ontology.action_log
GROUP BY executed_by;

-- GROUPING SETS / ROLLUP / CUBE
SELECT
    COALESCE(at.category::VARCHAR, '== ALL ==') AS category,
    COALESCE(al.result, '== ALL ==') AS result,
    COUNT(*) AS cnt
FROM ontology.action_log al
JOIN ontology.action_type at ON al.action_name = at.action_name
GROUP BY CUBE(at.category, al.result)
ORDER BY category, result;
\`\`\`

### 8.5 CTE、递归查询、子查询

\`\`\`sql
-- ✅ 普通 CTE（已大量使用）

-- ✅ 递归 CTE：沿 parent_type 遍历 Object Type 的继承树
WITH RECURSIVE type_hierarchy AS (
    -- 基础：根节点（没有 parent）
    SELECT
        type_name,
        parent_type,
        0 AS depth,
        type_name AS root,
        [type_name] AS path
    FROM ontology.object_type
    WHERE parent_type IS NULL

    UNION ALL

    -- 递归：子类型
    SELECT
        ot.type_name,
        ot.parent_type,
        th.depth + 1,
        th.root,
        list_append(th.path, ot.type_name)
    FROM ontology.object_type ot
    JOIN type_hierarchy th ON ot.parent_type = th.type_name
)
SELECT
    REPEAT('  ', depth) || icon || ' ' || type_name AS tree,
    depth,
    parent_type,
    path
FROM type_hierarchy th
JOIN ontology.object_type ot USING (type_name)
ORDER BY path;

-- ✅ 相关子查询（已在 7.2 中使用）

-- ✅ EXISTS / NOT EXISTS
SELECT type_name, 'has_states' AS info
FROM ontology.object_type ot
WHERE EXISTS (
    SELECT 1 FROM ontology.state_type st WHERE st.object_type = ot.type_name
);

-- ✅ IN / NOT IN
SELECT display_name
FROM ontology.object_instance
WHERE type_name IN (
    SELECT from_type FROM ontology.link_type WHERE link_name = 'works_on'
);
\`\`\`

### 8.6 JOIN 全类型

\`\`\`sql
-- ✅ INNER JOIN（已大量使用）

-- ✅ LEFT JOIN: 所有 Object Type，包括没有实例的
SELECT ot.type_name, COUNT(oi.instance_id) AS instances
FROM ontology.object_type ot
LEFT JOIN ontology.object_instance oi USING (type_name)
GROUP BY ot.type_name;

-- ✅ RIGHT JOIN (等价写法，DuckDB 支持)
SELECT oi.display_name, ot.icon
FROM ontology.object_type ot
RIGHT JOIN ontology.object_instance oi USING (type_name);

-- ✅ FULL OUTER JOIN: 哪些 Action Type 从未执行过？
SELECT
    at.action_name,
    COALESCE(COUNT(al.log_id), 0) AS times_executed
FROM ontology.action_type at
FULL OUTER JOIN ontology.action_log al USING (action_name)
GROUP BY at.action_name
ORDER BY times_executed;

-- ✅ CROSS JOIN: 为验证完整性，每个 Object Type × 每种 Action Category
SELECT ot.type_name, unnest(['CREATE','UPDATE','DELETE','STATE_CHANGE','LINK_CREATE','LINK_DELETE','COMPOSITE']) AS category
FROM ontology.object_type ot
WHERE NOT ot.is_abstract;

-- ✅ SEMI JOIN (用 WHERE EXISTS 实现)
-- 已在 8.5 中展示

-- ✅ ANTI JOIN: 没有任何关系的 Object Instance
SELECT oi.display_name, oi.type_name
FROM ontology.object_instance oi
WHERE NOT EXISTS (
    SELECT 1 FROM ontology.link_instance li
    WHERE li.from_instance = oi.instance_id OR li.to_instance = oi.instance_id
);

-- ✅ LATERAL JOIN: 每个 Object Type 的最新 3 个实例
SELECT ot.type_name, latest.*
FROM ontology.object_type ot,
LATERAL (
    SELECT display_name, created_at
    FROM ontology.object_instance oi
    WHERE oi.type_name = ot.type_name
    ORDER BY oi.created_at DESC
    LIMIT 3
) latest
WHERE NOT ot.is_abstract;

-- ✅ NATURAL JOIN
SELECT * FROM ontology.object_type NATURAL JOIN ontology.property_definition LIMIT 5;

-- ✅ POSITIONAL JOIN (DuckDB 特有 —— 按行位置对齐)
SELECT *
FROM (SELECT type_name FROM ontology.object_type WHERE NOT is_abstract ORDER BY type_name LIMIT 4)
POSITIONAL JOIN
(SELECT COUNT(*) AS inst_count FROM ontology.object_instance GROUP BY type_name ORDER BY type_name LIMIT 4);

-- ✅ ASOF JOIN: 模拟 "某时刻的状态"
-- 给定一组时间点，找到每个时间点对应的最新状态
CREATE TEMPORARY TABLE query_times AS
SELECT unnest([
    TIMESTAMP '2024-01-10 09:10:00',
    TIMESTAMP '2024-01-10 12:00:00',
    TIMESTAMP '2024-01-11 17:00:00',
    TIMESTAMP '2024-01-12 12:00:00'
]) AS query_time;

SELECT qt.query_time, sh.to_state AS state_at_time
FROM query_times qt
ASOF JOIN (
    SELECT changed_at, to_state FROM ontology.state_history WHERE instance_id = 11
) sh ON qt.query_time >= sh.changed_at
ORDER BY qt.query_time;

DROP TABLE query_times;
\`\`\`

### 8.7 集合运算

\`\`\`sql
-- ✅ UNION ALL (已使用于全景视图)

-- ✅ UNION (去重)
SELECT type_name AS entity FROM ontology.object_type WHERE is_abstract
UNION
SELECT type_name FROM ontology.object_type WHERE NOT is_abstract;

-- ✅ INTERSECT: 既有状态定义又有 Action 定义的 Object Type
SELECT object_type AS type_name FROM ontology.state_type
INTERSECT
SELECT target_type FROM ontology.action_type;

-- ✅ EXCEPT: 有 Object 定义但没有状态定义的类型
SELECT type_name FROM ontology.object_type WHERE NOT is_abstract
EXCEPT
SELECT DISTINCT object_type FROM ontology.state_type;
\`\`\`

### 8.8 高级数据类型操作

\`\`\`sql
-- ✅ LIST / ARRAY 操作
SELECT
    type_name,
    tags,
    list_contains(tags, 'core') AS is_core,
    list_filter(tags, x -> x != 'meta') AS non_meta_tags,
    list_transform(tags, x -> upper(x)) AS upper_tags,
    len(tags) AS tag_count
FROM ontology.object_type
WHERE tags IS NOT NULL;

-- ✅ MAP 操作
SELECT
    type_name,
    metadata,
    map_keys(metadata) AS keys,
    map_values(metadata) AS vals,
    metadata['layer'] AS layer,
    map_contains(metadata, 'domain') AS has_domain
FROM ontology.object_type
WHERE metadata IS NOT NULL;

-- ✅ STRUCT 操作
SELECT
    instance_id,
    {'name': display_name, 'type': type_name, 'version': version} AS obj_struct
FROM ontology.object_instance
LIMIT 3;

-- ✅ JSON 操作（深度使用）
SELECT
    display_name,
    json_keys(properties) AS all_keys,
    json_type(properties) AS jtype,
    json_extract_string(properties, '$.name') AS name_via_path,
    json_array_length('[1,2,3]'::JSON) AS demo_array_len
FROM ontology.object_instance
WHERE type_name = 'Employee'
LIMIT 3;

-- ✅ UNNEST: 展开 LIST / MAP
SELECT
    ot.type_name,
    unnest(ot.tags) AS tag
FROM ontology.object_type ot
WHERE ot.tags IS NOT NULL;
\`\`\`

### 8.9 日期 / 时间函数

\`\`\`sql
SELECT
    changed_at,
    date_part('year', changed_at) AS year,
    date_part('month', changed_at) AS month,
    date_part('dow', changed_at) AS day_of_week,
    date_trunc('hour', changed_at) AS truncated,
    changed_at + INTERVAL '7 days' AS plus_7_days,
    age(current_timestamp, changed_at) AS time_ago,
    strftime(changed_at, '%Y-%m-%d %H:%M') AS formatted
FROM ontology.state_history
LIMIT 5;
\`\`\`

### 8.10 字符串函数

\`\`\`sql
SELECT
    type_name,
    upper(type_name) AS upper_name,
    lower(type_name) AS lower_name,
    length(type_name) AS name_len,
    left(type_name, 3) AS prefix,
    replace(type_name, 'Type', '') AS cleaned,
    regexp_extract(type_name, '([A-Z][a-z]+)', 1) AS first_word,
    format('{} has {} chars', type_name, length(type_name)) AS msg,
    starts_with(type_name, 'Object') AS starts_obj,
    contains(type_name, 'Link') AS has_link
FROM ontology.object_type;

-- LIKE / ILIKE
SELECT * FROM ontology.object_type WHERE type_name ILIKE '%type%';

-- regexp_matches
SELECT * FROM ontology.object_type WHERE regexp_matches(type_name, '^[A-Z][a-z]+$');
\`\`\`

### 8.11 CASE / COALESCE / CAST / TRY_CAST

\`\`\`sql
SELECT
    display_name,
    type_name,
    CASE type_name
        WHEN 'Employee'   THEN '👤 人员'
        WHEN 'Department' THEN '🏢 部门'
        WHEN 'Project'    THEN '📋 项目'
        WHEN 'Ticket'     THEN '🎫 工单'
        ELSE '❓ 未知'
    END AS chinese_type,
    COALESCE(properties->>'priority', 'N/A') AS priority,
    TRY_CAST(properties->>'salary' AS INTEGER) AS salary_int,
    CAST(version AS VARCHAR) || '.0' AS version_str,
    NULLIF(properties->>'priority', '') AS nullable_priority,
    typeof(properties) AS properties_type
FROM ontology.object_instance;
\`\`\`

### 8.12 PIVOT / UNPIVOT（DuckDB 特有）

\`\`\`sql
-- ✅ PIVOT: 每个 Object Type 在各状态下有多少实例
PIVOT (
    SELECT vcs.type_name, vcs.current_state, COUNT(*) AS cnt
    FROM ontology.v_current_states vcs
    GROUP BY ALL
)
ON current_state
USING SUM(cnt)
GROUP BY type_name;

-- ✅ UNPIVOT: 把 state_type 的布尔列展开
SELECT * FROM (
    SELECT state_name, is_initial, is_terminal FROM ontology.state_type WHERE object_type = 'Ticket'
)
UNPIVOT (flag_value FOR flag_name IN (is_initial, is_terminal))
WHERE flag_value = TRUE;
\`\`\`

### 8.13 GENERATE_SERIES / 表生成函数

\`\`\`sql
-- 生成时间维度表
SELECT
    ts AS time_slot,
    date_part('hour', ts) AS hour,
    CASE WHEN date_part('dow', ts) IN (0, 6) THEN 'weekend' ELSE 'weekday' END AS day_type
FROM generate_series(
    TIMESTAMP '2024-01-10', TIMESTAMP '2024-01-13', INTERVAL '6 hours'
) t(ts);

-- 生成序号
SELECT unnest(generate_series(1, 10)) AS n;

-- range 函数
SELECT unnest(range(0, 100, 10)) AS decile;
\`\`\`

### 8.14 导出 / 导入（文件 I/O）

\`\`\`sql
-- ✅ 导出为 CSV
COPY ontology.object_type TO '/tmp/object_types.csv' (HEADER, DELIMITER ',');

-- ✅ 导出为 Parquet
COPY ontology.object_instance TO '/tmp/instances.parquet' (FORMAT PARQUET, COMPRESSION ZSTD);

-- ✅ 导出为 JSON
COPY (SELECT * FROM ontology.link_type) TO '/tmp/link_types.json' (FORMAT JSON, ARRAY TRUE);

-- ✅ 从 CSV 读取
-- CREATE TABLE test AS SELECT * FROM read_csv_auto('/tmp/object_types.csv');

-- ✅ 从 Parquet 读取
-- SELECT * FROM read_parquet('/tmp/instances.parquet');

-- ✅ 直接查询远程文件 (示例语法)
-- SELECT * FROM read_parquet('s3://bucket/path/data.parquet');

-- ✅ ATTACH 另一个 DuckDB 数据库
-- ATTACH 'other.db' AS other_db;

-- ✅ 导出整个数据库
EXPORT DATABASE '/tmp/ontology_backup' (FORMAT PARQUET);
-- IMPORT DATABASE '/tmp/ontology_backup';
\`\`\`

### 8.15 EXPLAIN / PRAGMA / 系统函数

\`\`\`sql
-- ✅ 执行计划
EXPLAIN
SELECT oi.display_name, COUNT(li.link_id)
FROM ontology.object_instance oi
LEFT JOIN ontology.link_instance li ON oi.instance_id = li.from_instance
GROUP BY oi.display_name;

-- ✅ EXPLAIN ANALYZE（实际执行并收集统计）
EXPLAIN ANALYZE
SELECT * FROM ontology.state_history WHERE instance_id = 11;

-- ✅ 系统表查询
SELECT table_name, estimated_size, column_count
FROM duckdb_tables()
WHERE schema_name = 'ontology';

SELECT column_name, data_type, is_nullable
FROM duckdb_columns()
WHERE schema_name = 'ontology' AND table_name = 'object_type';

-- ✅ 数据库大小
SELECT * FROM pragma_database_size();

-- ✅ 表信息
PRAGMA table_info('ontology.object_type');

-- ✅ 列表所有设置
SELECT * FROM duckdb_settings() WHERE name LIKE '%memory%';
\`\`\`

### 8.16 事务控制

\`\`\`sql
-- ✅ 事务（DuckDB 支持 ACID）
BEGIN TRANSACTION;

-- 模拟一个 Composite Action: 调岗
-- Step 1: 标记旧关系无效
UPDATE ontology.link_instance
SET valid_to = current_timestamp
WHERE link_name = 'belongs_to_dept'
  AND from_instance = 4      -- Diana
  AND valid_to IS NULL;

-- Step 2: 创建新关系
INSERT INTO ontology.link_instance (link_name, from_instance, to_instance, properties, valid_from)
VALUES ('belongs_to_dept', 4, 6, '{"since":"2024-02"}', current_timestamp);

-- Step 3: 记录日志
INSERT INTO ontology.action_log (action_name, executed_by, target_instance, parameters, result, duration_ms)
VALUES ('transfer_dept', 'hr_admin', 4, '{"new_dept_id":6}', 'SUCCESS', 55);

COMMIT;

-- ✅ ROLLBACK 示例
BEGIN TRANSACTION;
DELETE FROM ontology.object_instance WHERE type_name = 'Employee';
-- 哎呀! 回滚!
ROLLBACK;
-- 数据安全
SELECT COUNT(*) FROM ontology.object_instance WHERE type_name = 'Employee';
\`\`\`

### 8.17 SAMPLE / TABLESAMPLE

\`\`\`sql
-- ✅ 随机采样
SELECT * FROM ontology.object_instance USING SAMPLE 50%;
SELECT * FROM ontology.object_instance TABLESAMPLE reservoir(3);
\`\`\`

### 8.18 QUALIFY（DuckDB 特有简洁语法）

\`\`\`sql
-- 已在 current_state 视图中使用
-- 再举一例：每种类型保留最新创建的一个实例
SELECT type_name, display_name, created_at
FROM ontology.object_instance
QUALIFY ROW_NUMBER() OVER (PARTITION BY type_name ORDER BY created_at DESC) = 1;
\`\`\`

### 8.19 EXCLUDE / REPLACE / COLUMNS（SELECT 增强）

\`\`\`sql
-- ✅ EXCLUDE: 排除某些列
SELECT * EXCLUDE (metadata, tags, visibility) FROM ontology.object_type;

-- ✅ REPLACE: 替换列表达式
SELECT * REPLACE (upper(type_name) AS type_name) FROM ontology.object_type;

-- ✅ COLUMNS: 正则选列
SELECT COLUMNS('.*name.*') FROM ontology.object_type;

-- ✅ COLUMNS + 表达式
SELECT MIN(COLUMNS(* EXCLUDE (type_id))) FROM ontology.object_type;
\`\`\`

### 8.20 Lambda 函数 + List Comprehension

\`\`\`sql
SELECT
    type_name,
    tags,
    -- Lambda: 过滤
    list_filter(tags, t -> length(t) > 3) AS long_tags,
    -- Lambda: 转换
    list_transform(tags, t -> t || '!') AS excited_tags,
    -- Lambda: 排序
    list_sort(tags) AS sorted_tags,
    -- Lambda: 聚合
    list_reduce(tags, (a, b) -> a || '+' || b) AS concatenated,
    -- List comprehension 风格
    [upper(t) FOR t IN tags IF length(t) >= 4] AS filtered_upper
FROM ontology.object_type
WHERE tags IS NOT NULL AND len(tags) > 0;
\`\`\`

### 8.21 索引 与 约束

\`\`\`sql
-- ✅ 创建索引（DuckDB 使用 ART 索引）
CREATE INDEX idx_instance_type ON ontology.object_instance(type_name);
CREATE INDEX idx_link_from ON ontology.link_instance(from_instance);
CREATE INDEX idx_link_to ON ontology.link_instance(to_instance);
CREATE INDEX idx_state_history_inst ON ontology.state_history(instance_id, changed_at);

-- ✅ CHECK 约束（补充展示）
ALTER TABLE ontology.state_type ADD CONSTRAINT chk_ordinal CHECK (ordinal >= 0);
\`\`\`

---

## 9. 第七部分：复用到任意业务场景

元模型的价值在于：**一次建模，无限实例化**。

### 9.1 通用实例化流程

\`\`\`
业务场景                 元模型操作
─────────            ─────────
识别实体       →      INSERT INTO object_type
定义属性       →      INSERT INTO property_definition
识别关系       →      INSERT INTO link_type
设计状态机     →      INSERT INTO state_type + state_transition_rule
定义操作       →      INSERT INTO action_type
灌入数据       →      INSERT INTO object_instance + link_instance
运行业务       →      INSERT INTO action_log + state_history
\`\`\`

### 9.2 示例：30 秒实例化一个供应链场景

\`\`\`sql
-- 只需 INSERT，无需建新表
INSERT INTO ontology.object_type (type_name, description, icon, tags, metadata)
VALUES
    ('Warehouse',    '仓库',     '🏭', ['supply_chain'], MAP {'domain': 'SCM'}),
    ('Product',      '产品',     '📦', ['supply_chain'], MAP {'domain': 'SCM'}),
    ('Shipment',     '运单',     '🚛', ['supply_chain'], MAP {'domain': 'SCM'});

INSERT INTO ontology.link_type (link_name, from_type, to_type, cardinality, reverse_name, description)
VALUES
    ('stored_in',    'Product',  'Warehouse', 'MANY_TO_MANY', 'stores',       '产品存放于仓库'),
    ('shipped_from', 'Shipment', 'Warehouse', 'MANY_TO_ONE',  'sends',        '运单发出仓库'),
    ('contains',     'Shipment', 'Product',   'ONE_TO_MANY',  'shipped_via',  '运单包含产品');

INSERT INTO ontology.state_type (object_type, state_name, ordinal, is_initial, is_terminal)
VALUES
    ('Shipment', 'PREPARING', 0, TRUE,  FALSE),
    ('Shipment', 'IN_TRANSIT', 1, FALSE, FALSE),
    ('Shipment', 'DELIVERED',  2, FALSE, TRUE),
    ('Shipment', 'RETURNED',   3, FALSE, TRUE);

-- 验证：新业务场景已就绪
SELECT type_name, tags FROM ontology.object_type WHERE tags IS NOT NULL AND list_contains(tags, 'supply_chain');
\`\`\`

### 9.3 跨场景分析：Ontology 的 Ontology

\`\`\`sql
-- 跨所有业务域的元统计
SELECT
    COALESCE(metadata['domain'], 'META') AS domain,
    COUNT(DISTINCT ot.type_name) AS object_types,
    COUNT(DISTINCT lt.link_name) AS link_types,
    COUNT(DISTINCT st.state_name) AS state_types,
    COUNT(DISTINCT act.action_name) AS action_types
FROM ontology.object_type ot
LEFT JOIN ontology.link_type lt ON (lt.from_type = ot.type_name OR lt.to_type = ot.type_name)
LEFT JOIN ontology.state_type st ON st.object_type = ot.type_name
LEFT JOIN ontology.action_type act ON act.target_type = ot.type_name
WHERE NOT ot.is_abstract
GROUP BY domain
ORDER BY domain;
\`\`\`

---

## 10. 附录：MECE 能力清单

以下清单确认本教程覆盖了 DuckDB 的所有主要操作类别：

| # | 能力类别 | 具体操作 | 章节 |
|---|---------|---------|------|
| 1 | **DDL** | CREATE TABLE/VIEW/SCHEMA/SEQUENCE/TYPE/MACRO/INDEX, ALTER, DROP | §3, §8.1, §8.21 |
| 2 | **DML** | INSERT, UPDATE, DELETE, UPSERT (ON CONFLICT) | §3-6, §8.2 |
| 3 | **查询基础** | SELECT, WHERE, ORDER BY, LIMIT, OFFSET, DISTINCT | 全文 |
| 4 | **JOIN** | INNER, LEFT, RIGHT, FULL OUTER, CROSS, LATERAL, NATURAL, POSITIONAL, ASOF, SEMI, ANTI | §8.6 |
| 5 | **集合运算** | UNION, UNION ALL, INTERSECT, EXCEPT | §8.7 |
| 6 | **聚合** | COUNT, SUM, AVG, MIN, MAX, LIST, STRING_AGG, FILTER, GROUP BY, HAVING | §8.4 |
| 7 | **分组增强** | GROUPING SETS, ROLLUP, CUBE | §8.4 |
| 8 | **窗口函数** | ROW_NUMBER, RANK, DENSE_RANK, NTILE, LAG, LEAD, FIRST_VALUE, LAST_VALUE, 窗口帧 | §8.3 |
| 9 | **CTE** | WITH, 递归 CTE (WITH RECURSIVE) | §8.5 |
| 10 | **子查询** | 标量子查询, EXISTS, IN, NOT EXISTS, NOT IN, 相关子查询 | §8.5 |
| 11 | **条件表达式** | CASE, COALESCE, NULLIF, CAST, TRY_CAST, typeof | §8.11 |
| 12 | **复合类型** | LIST/ARRAY, MAP, STRUCT, JSON, ENUM | §3, §8.8 |
| 13 | **Lambda/List** | list_filter, list_transform, list_reduce, list comprehension | §8.20 |
| 14 | **日期时间** | date_part, date_trunc, age, strftime, INTERVAL, generate_series | §8.9, §8.13 |
| 15 | **字符串** | upper/lower, length, replace, regexp_extract, format, LIKE, ILIKE | §8.10 |
| 16 | **PIVOT/UNPIVOT** | PIVOT ON...USING, UNPIVOT...IN | §8.12 |
| 17 | **QUALIFY** | 窗口函数后过滤 | §8.18 |
| 18 | **SELECT 增强** | EXCLUDE, REPLACE, COLUMNS, COLUMNS 正则 | §8.19 |
| 19 | **采样** | SAMPLE, TABLESAMPLE, reservoir | §8.17 |
| 20 | **生成函数** | generate_series, range, unnest | §8.13 |
| 21 | **文件 I/O** | COPY TO/FROM, read_csv_auto, read_parquet, EXPORT/IMPORT DATABASE | §8.14 |
| 22 | **事务** | BEGIN, COMMIT, ROLLBACK | §8.16 |
| 23 | **执行计划** | EXPLAIN, EXPLAIN ANALYZE | §8.15 |
| 24 | **系统元数据** | duckdb_tables(), duckdb_columns(), pragma_database_size, PRAGMA | §8.15 |
| 25 | **MACRO** | CREATE MACRO (标量), CREATE MACRO...AS TABLE | §8.1 |
| 26 | **ATTACH** | 多数据库 | §8.14 |
| 27 | **JSON 函数** | json_extract, ->>, json_keys, json_type, json_merge_patch, json_array_length | §8.2, §8.8 |
| 28 | **索引/约束** | CREATE INDEX, PK, FK, UNIQUE, CHECK, DEFAULT | §3, §8.21 |
| 29 | **临时表** | CREATE TEMPORARY TABLE | §8.1 |
| 30 | **设置/配置** | SET, PRAGMA, duckdb_settings() | §2, §8.15 |

---

## 最终总结

\`\`\`
┌─────────────────────────────────────────────────────────┐
│                   ONTOLOGY META-MODEL                    │
│                                                         │
│   ┌──────────┐    Link     ┌──────────┐                │
│   │  Object  │◆───────────▶│  Object  │                │
│   │  (Type + │             │  (Type + │                │
│   │Instance) │             │Instance) │                │
│   └────┬─────┘             └────┬─────┘                │
│        │                        │                       │
│   has State                has State                    │
│        │                        │                       │
│   ┌────▼─────┐             ┌────▼─────┐                │
│   │  State   │             │  State   │                │
│   │(Machine +│             │(Machine +│                │
│   │ History) │             │ History) │                │
│   └────┬─────┘             └────┬─────┘                │
│        │                        │                       │
│        └──────── Action ────────┘                       │
│                 (触发状态变迁,                            │
│                  创建/删除关系,                           │
│                  修改属性,                               │
│                  完整审计)                               │
└─────────────────────────────────────────────────────────┘

  Object 定义"是什么"
  Link   定义"什么关系"
  State  定义"在哪个阶段"
  Action 定义"怎么变化"
  
  四者协同 = 完整的企业本体论
\`\`\`

将本教程的 SQL 从头到尾粘贴进 \`duckdb\` CLI，你将获得一个完全自描述的 Ontology 元数据库。在此基础上，只需 INSERT 新的 Type 定义，即可将任何业务域纳入同一套元模型管理。
`,kn=`---
id: "ontology-duckdb-runnable"
type: "note"
isFavorite: false
createdAt: "2026-09-22T00:57:29.611Z"
updatedAt: "2026-09-22T00:57:29.611Z"
tags:
  - "本体建模"
  - "DuckDB"
  - "教程"
title: "用 DuckDB 建模 Palantir Ontology 元结构：一篇可运行的完整教程"
topic: "best_practice"
summary: "Palantir Foundry 的 Ontology 层有四个元概念——Object Type、Link Type、State、Action Type——它们构成了任何业务场景的骨架。但大多数教程上来就用\\"航班\\"\\"患者\\"等具体例子，读者看完仍然不清楚这四个概念本身的结构与约束。 本文反其道行之：把 Ontology 自身当作被建模的业务领域。你会在 DuckDB 里建出一套\\"描述 Onto..."
---

# 用 DuckDB 建模 Palantir Ontology 元结构：一篇可运行的完整教程

## 0. 为什么写这篇教程

Palantir Foundry 的 Ontology 层有四个元概念——**Object Type、Link Type、State、Action Type**——它们构成了任何业务场景的骨架。但大多数教程上来就用"航班""患者"等具体例子，读者看完仍然不清楚这四个概念**本身**的结构与约束。

本文反其道行之：**把 Ontology 自身当作被建模的业务领域**。你会在 DuckDB 里建出一套"描述 Ontology 的 Ontology（meta-ontology）"，通过运行 SQL 理解每个概念是什么、彼此如何协作，并在此过程中**穷尽 DuckDB 支持的各类操作**。

> **运行环境**：DuckDB ≥ 0.10（CLI / Python / WASM 均可）。所有 SQL 可从头到尾依次粘贴执行。

---

## 1. 概念速览：四块积木

| 元概念 | 一句话 | 类比 |
|--------|--------|------|
| **Object Type** | 对世界中某类实体的抽象，包含属性列表 | 类 / 表 |
| **Link Type** | 两个 Object Type 之间的有向关系 | 外键 / 边 |
| **State** | Object 在某一时刻的属性快照 + 生命周期阶段 | 行版本 / 状态机节点 |
| **Action Type** | 对 Object 执行的原子操作，驱动 State 转移 | 存储过程 / 事件 |

它们的协作闭环：

\`\`\`
Action 作用于 Object → 产生新 State → State 变化可触发下游 Action → …
Link 连接不同 Object，使 Action 可以跨对象传播
\`\`\`

---

## 2. 建库建模（DDL 全集）

### 2.1 创建数据库与 Schema

\`\`\`sql
-- DuckDB 支持 ATTACH 多库；这里创建一个专用库
-- 如果在内存模式下运行，可跳过 ATTACH，直接建 SCHEMA
ATTACH ':memory:' AS ontology_db;
USE ontology_db;

CREATE SCHEMA IF NOT EXISTS meta;   -- 元模型 schema
SET search_path = 'meta';
\`\`\`

### 2.2 ENUM 类型 —— 约束有限取值

\`\`\`sql
-- DuckDB 原生支持 ENUM
CREATE TYPE meta.property_dtype AS ENUM (
    'STRING', 'INTEGER', 'DOUBLE', 'BOOLEAN',
    'DATE', 'TIMESTAMP', 'ARRAY', 'STRUCT', 'MAP', 'JSON'
);

CREATE TYPE meta.cardinality AS ENUM (
    'ONE_TO_ONE', 'ONE_TO_MANY', 'MANY_TO_ONE', 'MANY_TO_MANY'
);

CREATE TYPE meta.lifecycle_phase AS ENUM (
    'DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED', 'DELETED'
);

CREATE TYPE meta.action_category AS ENUM (
    'CREATE', 'UPDATE', 'DELETE', 'TRANSITION', 'LINK', 'UNLINK', 'COMPOSITE'
);
\`\`\`

### 2.3 核心表 —— SEQUENCE + 各种列约束

\`\`\`sql
-- ── Object Type ──────────────────────────────────
CREATE SEQUENCE meta.seq_object_type START 1;

CREATE TABLE meta.object_type (
    ot_id        INTEGER   DEFAULT nextval('meta.seq_object_type') PRIMARY KEY,
    api_name     VARCHAR   NOT NULL UNIQUE,          -- 机器名
    display_name VARCHAR   NOT NULL,                 -- 人类名
    description  VARCHAR,
    icon         VARCHAR   DEFAULT '📦',
    created_at   TIMESTAMP DEFAULT current_timestamp,
    updated_at   TIMESTAMP DEFAULT current_timestamp,
    is_abstract  BOOLEAN   DEFAULT false,            -- 可作为"基类"
    tags         VARCHAR[]                            -- DuckDB 原生数组
);

-- ── Property（Object Type 的属性列表）────────────
CREATE SEQUENCE meta.seq_property START 1;

CREATE TABLE meta.property (
    prop_id      INTEGER            DEFAULT nextval('meta.seq_property') PRIMARY KEY,
    ot_id        INTEGER            NOT NULL REFERENCES meta.object_type(ot_id),
    api_name     VARCHAR            NOT NULL,
    display_name VARCHAR            NOT NULL,
    dtype        meta.property_dtype NOT NULL,
    is_primary   BOOLEAN            DEFAULT false,   -- 标记主键属性
    is_required  BOOLEAN            DEFAULT true,
    is_indexed   BOOLEAN            DEFAULT false,
    default_val  VARCHAR,                             -- 以 JSON 字符串存
    constraints  JSON,                                -- DuckDB JSON 列：{"min":0,"max":100}
    UNIQUE (ot_id, api_name)
);

-- ── Link Type ────────────────────────────────────
CREATE SEQUENCE meta.seq_link_type START 1;

CREATE TABLE meta.link_type (
    lt_id         INTEGER          DEFAULT nextval('meta.seq_link_type') PRIMARY KEY,
    api_name      VARCHAR          NOT NULL UNIQUE,
    display_name  VARCHAR          NOT NULL,
    from_ot_id    INTEGER          NOT NULL REFERENCES meta.object_type(ot_id),
    to_ot_id      INTEGER          NOT NULL REFERENCES meta.object_type(ot_id),
    cardinality   meta.cardinality NOT NULL,
    is_directed   BOOLEAN          DEFAULT true,
    description   VARCHAR,
    metadata      MAP(VARCHAR, VARCHAR)    -- DuckDB MAP 类型
);

-- ── State ────────────────────────────────────────
CREATE SEQUENCE meta.seq_state START 1;

CREATE TABLE meta.state (
    state_id       INTEGER              DEFAULT nextval('meta.seq_state') PRIMARY KEY,
    ot_id          INTEGER              NOT NULL REFERENCES meta.object_type(ot_id),
    phase          meta.lifecycle_phase NOT NULL,
    entered_at     TIMESTAMP            DEFAULT current_timestamp,
    snapshot       JSON,                             -- 完整属性快照
    changed_by     VARCHAR,                          -- 记录操作者
    change_reason  VARCHAR,
    checksum       VARCHAR,                          -- 快照校验和
    UNIQUE (ot_id, phase, entered_at)                -- 复合唯一
);

-- ── Action Type ──────────────────────────────────
CREATE SEQUENCE meta.seq_action_type START 1;

CREATE TABLE meta.action_type (
    at_id          INTEGER              DEFAULT nextval('meta.seq_action_type') PRIMARY KEY,
    api_name       VARCHAR              NOT NULL UNIQUE,
    display_name   VARCHAR              NOT NULL,
    category       meta.action_category NOT NULL,
    target_ot_id   INTEGER              NOT NULL REFERENCES meta.object_type(ot_id),
    description    VARCHAR,
    parameters     JSON,                -- 入参定义 [{"name":"reason","type":"STRING","required":true}]
    preconditions  JSON,                -- 前置条件
    side_effects   VARCHAR[],           -- 可能触发的下游 Action api_name
    created_at     TIMESTAMP            DEFAULT current_timestamp
);

-- ── Action→State 桥表：一个 Action 引起的状态跃迁 ──
CREATE TABLE meta.action_state_transition (
    at_id         INTEGER              NOT NULL REFERENCES meta.action_type(at_id),
    from_phase    meta.lifecycle_phase NOT NULL,
    to_phase      meta.lifecycle_phase NOT NULL,
    PRIMARY KEY (at_id, from_phase)
);
\`\`\`

### 2.4 索引

\`\`\`sql
-- DuckDB 支持 ART 索引（自动为 PK/UNIQUE 创建），也可显式建
CREATE INDEX idx_prop_ot   ON meta.property(ot_id);
CREATE INDEX idx_state_ot  ON meta.state(ot_id);
CREATE INDEX idx_action_ot ON meta.action_type(target_ot_id);
\`\`\`

### 2.5 VIEW：把元模型"拍平"

\`\`\`sql
CREATE OR REPLACE VIEW meta.v_full_ontology AS
SELECT
    ot.api_name     AS object_type,
    p.api_name      AS property,
    p.dtype,
    p.is_primary,
    lt.api_name     AS link,
    lt.cardinality,
    at2.api_name    AS action,
    at2.category
FROM meta.object_type ot
LEFT JOIN meta.property    p   ON p.ot_id = ot.ot_id
LEFT JOIN meta.link_type   lt  ON lt.from_ot_id = ot.ot_id
LEFT JOIN meta.action_type at2 ON at2.target_ot_id = ot.ot_id;
\`\`\`

---

## 3. 灌入元数据（DML 全集）

### 3.1 INSERT —— 定义 4 个 Object Type（描述 Ontology 自身）

\`\`\`sql
INSERT INTO meta.object_type (api_name, display_name, description, icon, tags) VALUES
    ('ObjectType',  'Object Type',  'Describes a class of real-world entities',   '📦', ARRAY['core','meta']),
    ('LinkType',    'Link Type',    'Describes a directed relationship',           '🔗', ARRAY['core','meta']),
    ('State',       'State',        'A snapshot of an object at a point in time',  '📸', ARRAY['core','meta']),
    ('ActionType',  'Action Type',  'An atomic operation that drives state change','⚡', ARRAY['core','meta']);
\`\`\`

### 3.2 INSERT —— 为每个 Object Type 定义属性

\`\`\`sql
-- ObjectType 的属性
INSERT INTO meta.property (ot_id, api_name, display_name, dtype, is_primary, is_required, constraints) VALUES
    (1, 'ot_id',        'ID',           'INTEGER', true,  true,  '{"auto":true}'),
    (1, 'api_name',     'API Name',     'STRING',  false, true,  '{"maxLength":128}'),
    (1, 'display_name', 'Display Name', 'STRING',  false, true,  NULL),
    (1, 'is_abstract',  'Is Abstract',  'BOOLEAN', false, false, NULL);

-- LinkType 的属性
INSERT INTO meta.property (ot_id, api_name, display_name, dtype, is_primary, is_required, constraints) VALUES
    (2, 'lt_id',       'ID',          'INTEGER', true,  true,  '{"auto":true}'),
    (2, 'api_name',    'API Name',    'STRING',  false, true,  NULL),
    (2, 'from_ot_id',  'From Object', 'INTEGER', false, true,  NULL),
    (2, 'to_ot_id',    'To Object',   'INTEGER', false, true,  NULL),
    (2, 'cardinality', 'Cardinality', 'STRING',  false, true,  NULL);

-- State 的属性
INSERT INTO meta.property (ot_id, api_name, display_name, dtype, is_primary, is_required, constraints) VALUES
    (3, 'state_id',   'ID',        'INTEGER',   true,  true,  NULL),
    (3, 'phase',      'Phase',     'STRING',    false, true,  NULL),
    (3, 'snapshot',   'Snapshot',  'JSON',      false, false, NULL),
    (3, 'entered_at', 'Entered',   'TIMESTAMP', false, true,  NULL);

-- ActionType 的属性
INSERT INTO meta.property (ot_id, api_name, display_name, dtype, is_primary, is_required, constraints) VALUES
    (4, 'at_id',       'ID',         'INTEGER', true,  true,  NULL),
    (4, 'api_name',    'API Name',   'STRING',  false, true,  NULL),
    (4, 'category',    'Category',   'STRING',  false, true,  NULL),
    (4, 'parameters',  'Parameters', 'JSON',    false, false, NULL);
\`\`\`

### 3.3 INSERT —— 定义 Link Types（元概念间的关系）

\`\`\`sql
INSERT INTO meta.link_type (api_name, display_name, from_ot_id, to_ot_id, cardinality, description, metadata) VALUES
    ('hasProperty',    'has Property',     1, 1, 'ONE_TO_MANY',  'ObjectType owns Properties',
        MAP {'inverse': 'belongsTo'}),
    ('linksFrom',      'links From',       2, 1, 'MANY_TO_ONE',  'LinkType starts at an ObjectType',
        MAP {'role': 'source'}),
    ('linksTo',        'links To',         2, 1, 'MANY_TO_ONE',  'LinkType ends at an ObjectType',
        MAP {'role': 'target'}),
    ('stateOf',        'state Of',         3, 1, 'MANY_TO_ONE',  'State belongs to an ObjectType',
        MAP {}),
    ('targetsObject',  'targets Object',   4, 1, 'MANY_TO_ONE',  'ActionType targets an ObjectType',
        MAP {}),
    ('causesTransition','causes Transition',4, 3, 'ONE_TO_MANY', 'Action drives state change',
        MAP {'semantic': 'causal'});
\`\`\`

### 3.4 INSERT —— 定义 Action Types

\`\`\`sql
INSERT INTO meta.action_type
    (api_name, display_name, category, target_ot_id, description, parameters, preconditions, side_effects) VALUES
    ('RegisterObjectType',  'Register Object Type',  'CREATE',     1,
        'Create a new Object Type in the ontology',
        '[{"name":"api_name","type":"STRING","required":true},
          {"name":"display_name","type":"STRING","required":true}]',
        '{"current_phase":null}',
        ARRAY['LogAudit']),

    ('AddProperty',         'Add Property',          'UPDATE',     1,
        'Add a property definition to an Object Type',
        '[{"name":"prop_api_name","type":"STRING","required":true},
          {"name":"dtype","type":"STRING","required":true}]',
        '{"current_phase":"ACTIVE"}',
        NULL),

    ('CreateLink',          'Create Link',           'LINK',       2,
        'Establish a link type between two Object Types',
        '[{"name":"from_ot","type":"INTEGER","required":true},
          {"name":"to_ot","type":"INTEGER","required":true}]',
        NULL,
        NULL),

    ('ActivateObject',      'Activate Object',       'TRANSITION', 1,
        'Move Object Type from DRAFT to ACTIVE',
        '[{"name":"reason","type":"STRING","required":false}]',
        '{"current_phase":"DRAFT"}',
        ARRAY['NotifySubscribers']),

    ('ArchiveObject',       'Archive Object',        'TRANSITION', 1,
        'Move Object Type to ARCHIVED',
        '[]',
        '{"current_phase":"ACTIVE"}',
        ARRAY['CascadeArchiveLinks']),

    ('DeleteObjectType',    'Delete Object Type',    'DELETE',     1,
        'Soft-delete an Object Type',
        '[]',
        '{"current_phase":"ARCHIVED"}',
        ARRAY['CascadeDeleteLinks','LogAudit']);
\`\`\`

### 3.5 INSERT —— 状态跃迁规则

\`\`\`sql
INSERT INTO meta.action_state_transition (at_id, from_phase, to_phase) VALUES
    (1, 'DRAFT',    'DRAFT'),     -- Register 创建即进入 DRAFT
    (4, 'DRAFT',    'ACTIVE'),    -- Activate
    (5, 'ACTIVE',   'ARCHIVED'),  -- Archive
    (6, 'ARCHIVED', 'DELETED');   -- Delete
\`\`\`

### 3.6 INSERT —— 模拟生命周期（State 快照）

\`\`\`sql
INSERT INTO meta.state (ot_id, phase, snapshot, changed_by, change_reason, checksum) VALUES
    (1, 'DRAFT',    '{"api_name":"ObjectType","property_count":0}',
        'admin', 'Initial registration', md5('{"api_name":"ObjectType","property_count":0}')),
    (1, 'ACTIVE',   '{"api_name":"ObjectType","property_count":4}',
        'admin', 'Properties defined, ready to use', md5('{"api_name":"ObjectType","property_count":4}')),
    (2, 'DRAFT',    '{"api_name":"LinkType","property_count":0}',
        'admin', 'Initial registration', md5('{"api_name":"LinkType","property_count":0}')),
    (2, 'ACTIVE',   '{"api_name":"LinkType","property_count":5}',
        'admin', 'All properties added', md5('{"api_name":"LinkType","property_count":5}')),
    (3, 'ACTIVE',   '{"api_name":"State","property_count":4}',
        'admin', 'Direct activation', md5('{"api_name":"State","property_count":4}')),
    (4, 'ACTIVE',   '{"api_name":"ActionType","property_count":4}',
        'admin', 'Direct activation', md5('{"api_name":"ActionType","property_count":4}'));
\`\`\`

### 3.7 UPDATE / DELETE 演示

\`\`\`sql
-- UPDATE：为 ObjectType 增加一个 tag
UPDATE meta.object_type
SET    tags = array_append(tags, 'foundational'),
       updated_at = current_timestamp
WHERE  api_name = 'ObjectType';

-- DELETE：删除一条测试用的假数据（先插后删）
INSERT INTO meta.property (ot_id, api_name, display_name, dtype) VALUES (1, '_tmp', 'Temp', 'STRING');
DELETE FROM meta.property WHERE api_name = '_tmp';
\`\`\`

---

## 4. 查询全景（SELECT 操作大全）

### 4.1 基础查询 + 过滤 + 排序 + LIMIT

\`\`\`sql
SELECT ot_id, api_name, display_name, tags
FROM   meta.object_type
WHERE  'core' = ANY(tags)      -- 数组元素过滤
ORDER  BY api_name
LIMIT  10;
\`\`\`

### 4.2 聚合 + GROUP BY + HAVING

\`\`\`sql
-- 每个 Object Type 有多少属性？哪些超过 3 个？
SELECT ot.api_name,
       count(p.prop_id) AS prop_count,
       count(*) FILTER (WHERE p.is_primary)  AS pk_count   -- FILTER 子句
FROM   meta.object_type ot
JOIN   meta.property p USING (ot_id)
GROUP  BY ot.api_name
HAVING count(p.prop_id) > 3;
\`\`\`

### 4.3 多表 JOIN（INNER / LEFT / CROSS / SEMI / ANTI）

\`\`\`sql
-- INNER JOIN：Object Type ↔ 它拥有的 Actions
SELECT ot.display_name AS object, at2.display_name AS action, at2.category
FROM   meta.object_type ot
INNER  JOIN meta.action_type at2 ON at2.target_ot_id = ot.ot_id;

-- LEFT JOIN：所有 Object Type 及其（可能为空的）最新 State
SELECT ot.api_name, s.phase, s.entered_at
FROM   meta.object_type ot
LEFT   JOIN meta.state s ON s.ot_id = ot.ot_id;

-- SEMI JOIN：只返回「至少有一个 Action」的 Object Type
SELECT ot.*
FROM   meta.object_type ot
WHERE  EXISTS (SELECT 1 FROM meta.action_type at2 WHERE at2.target_ot_id = ot.ot_id);

-- ANTI JOIN：找出「没有任何 State 记录」的 Object Type（应为 0 行）
SELECT ot.api_name
FROM   meta.object_type ot
WHERE  NOT EXISTS (SELECT 1 FROM meta.state s WHERE s.ot_id = ot.ot_id);

-- CROSS JOIN：所有可能的 Link 方向组合
SELECT a.api_name AS "from", b.api_name AS "to"
FROM   meta.object_type a
CROSS  JOIN meta.object_type b
WHERE  a.ot_id <> b.ot_id;
\`\`\`

### 4.4 子查询 / CTE / 递归 CTE

\`\`\`sql
-- CTE：每个 Object Type 的属性与 Action 数量合并
WITH prop_counts AS (
    SELECT ot_id, count(*) AS n_props FROM meta.property GROUP BY ot_id
), action_counts AS (
    SELECT target_ot_id AS ot_id, count(*) AS n_actions FROM meta.action_type GROUP BY target_ot_id
)
SELECT ot.api_name,
       coalesce(pc.n_props, 0)   AS properties,
       coalesce(ac.n_actions, 0) AS actions
FROM   meta.object_type ot
LEFT   JOIN prop_counts   pc USING (ot_id)
LEFT   JOIN action_counts ac USING (ot_id);

-- 递归 CTE：沿 Action 的 side_effects 链展开（模拟级联触发）
WITH RECURSIVE cascade AS (
    -- 种子：ArchiveObject
    SELECT api_name, side_effects, 0 AS depth
    FROM   meta.action_type
    WHERE  api_name = 'ArchiveObject'

    UNION ALL

    -- 展开 side_effects 数组里的每个名称
    SELECT at2.api_name, at2.side_effects, c.depth + 1
    FROM   cascade c,
           unnest(c.side_effects) AS t(effect_name)
    JOIN   meta.action_type at2 ON at2.api_name = t.effect_name
    WHERE  c.depth < 5   -- 防无限递归
)
SELECT * FROM cascade;
\`\`\`

### 4.5 窗口函数

\`\`\`sql
-- State 变化时间线：每个 Object Type 按时间排序，算出停留时长
SELECT
    ot.api_name,
    s.phase,
    s.entered_at,
    LEAD(s.entered_at) OVER w  AS next_entered,
    LEAD(s.entered_at) OVER w - s.entered_at AS duration,
    ROW_NUMBER()  OVER w AS seq,
    DENSE_RANK()  OVER (ORDER BY ot.api_name) AS type_rank,
    count(*) OVER (PARTITION BY ot.api_name)  AS total_states
FROM   meta.state s
JOIN   meta.object_type ot USING (ot_id)
WINDOW w AS (PARTITION BY s.ot_id ORDER BY s.entered_at)
ORDER  BY ot.api_name, s.entered_at;
\`\`\`

### 4.6 集合操作 UNION / INTERSECT / EXCEPT

\`\`\`sql
-- 哪些 api_name 同时出现在 Object Type 和 Action 中（语义检查）
SELECT api_name FROM meta.object_type
INTERSECT
SELECT api_name FROM meta.action_type;     -- 应为空

-- 所有"名称"汇总
SELECT api_name, 'ObjectType' AS source FROM meta.object_type
UNION ALL
SELECT api_name, 'LinkType'   FROM meta.link_type
UNION ALL
SELECT api_name, 'ActionType' FROM meta.action_type
ORDER BY source, api_name;
\`\`\`

### 4.7 JSON / STRUCT / MAP / ARRAY 操作

\`\`\`sql
-- 提取 Action 参数 JSON 数组的第一个元素名称
SELECT api_name,
       json_array_length(parameters)                       AS param_count,
       parameters->0->>'name'                              AS first_param,
       json_extract_string(parameters, '$[0].type')        AS first_type
FROM   meta.action_type
WHERE  parameters IS NOT NULL;

-- MAP 操作
SELECT api_name,
       metadata,
       map_keys(metadata)    AS keys,
       element_at(metadata, 'inverse')  AS inverse_link
FROM   meta.link_type;

-- STRUCT 构造
SELECT ot.api_name,
       {'prop_count': count(p.prop_id),
        'has_pk': bool_or(p.is_primary)} AS summary_struct
FROM   meta.object_type ot
JOIN   meta.property p USING (ot_id)
GROUP  BY ot.api_name;

-- ARRAY 聚合
SELECT ot.api_name,
       list(p.api_name ORDER BY p.api_name) AS all_properties   -- list() = array_agg()
FROM   meta.object_type ot
JOIN   meta.property p USING (ot_id)
GROUP  BY ot.api_name;

-- UNNEST 展开数组
SELECT ot.api_name, unnest(tags) AS tag
FROM   meta.object_type ot;
\`\`\`

### 4.8 字符串 / 正则 / 日期

\`\`\`sql
-- 字符串
SELECT api_name,
       upper(api_name)                  AS upper_name,
       length(api_name)                 AS name_len,
       regexp_extract(api_name, '([A-Z][a-z]+)', 1)  AS first_word,
       string_split(api_name, 'Type')   AS split_result
FROM   meta.object_type;

-- 日期
SELECT api_name,
       created_at,
       date_part('hour', created_at)    AS hour,
       strftime(created_at, '%Y-%m-%d') AS formatted,
       current_timestamp - created_at   AS age
FROM   meta.object_type;
\`\`\`

### 4.9 PIVOT / UNPIVOT（DuckDB 特色）

\`\`\`sql
-- PIVOT：属性数量按 dtype 展开为列
PIVOT (
    SELECT ot.api_name AS object_type, p.dtype, count(*) AS cnt
    FROM   meta.property p
    JOIN   meta.object_type ot USING (ot_id)
    GROUP  BY ALL
)
ON dtype
USING sum(cnt)
GROUP BY object_type;

-- UNPIVOT：把 object_type 宽表的几个字段竖着看
UNPIVOT meta.object_type
ON api_name, display_name, description
INTO NAME attribute VALUE val;
\`\`\`

### 4.10 CASE / COALESCE / NULLIF / CAST

\`\`\`sql
SELECT api_name,
       CASE category
           WHEN 'CREATE'     THEN '🆕 New'
           WHEN 'TRANSITION' THEN '🔄 Move'
           WHEN 'DELETE'     THEN '🗑️ Remove'
           ELSE '🔧 Other'
       END                                         AS emoji_cat,
       coalesce(description, '(no description)')   AS desc_safe,
       nullif(description, '')                      AS desc_null_if_empty,
       CAST(at_id AS VARCHAR) || '-' || api_name    AS composite_key
FROM   meta.action_type;
\`\`\`

---

## 5. 高级 DuckDB 特性演练

### 5.1 MACRO（参数化 SQL 片段）

\`\`\`sql
-- 标量宏
CREATE OR REPLACE MACRO meta.ontology_label(kind, name) AS
    kind || '::' || name;

SELECT meta.ontology_label('ObjectType', api_name) AS label
FROM   meta.object_type;

-- 表宏
CREATE OR REPLACE MACRO meta.props_of(target_api_name) AS TABLE
    SELECT p.*
    FROM   meta.property p
    JOIN   meta.object_type ot USING (ot_id)
    WHERE  ot.api_name = target_api_name;

SELECT * FROM meta.props_of('State');
\`\`\`

### 5.2 LAMBDA + list_transform / list_filter

\`\`\`sql
SELECT api_name,
       tags,
       list_transform(tags, x -> upper(x))                AS upper_tags,
       list_filter(tags, x -> len(x) > 4)                 AS long_tags,
       list_reduce(tags, (a, b) -> a || '+' || b)         AS joined
FROM   meta.object_type;
\`\`\`

### 5.3 生成列（Generated Column）

\`\`\`sql
-- 用 ALTER TABLE 添加一个虚拟生成列
ALTER TABLE meta.object_type ADD COLUMN IF NOT EXISTS
    tag_count INTEGER GENERATED ALWAYS AS (array_length(tags));

SELECT api_name, tags, tag_count FROM meta.object_type;
\`\`\`

### 5.4 SAMPLE / TABLESAMPLE

\`\`\`sql
-- 随机取 2 条属性
SELECT * FROM meta.property USING SAMPLE 2;
\`\`\`

### 5.5 EXPLAIN / EXPLAIN ANALYZE

\`\`\`sql
EXPLAIN ANALYZE
SELECT ot.api_name, count(*)
FROM   meta.object_type ot
JOIN   meta.property p USING (ot_id)
GROUP  BY ot.api_name;
\`\`\`

### 5.6 EXPORT / COPY —— 读写外部文件

\`\`\`sql
-- 导出到 Parquet（DuckDB 王牌格式）
COPY meta.object_type TO '/tmp/object_type.parquet' (FORMAT PARQUET);

-- 导出到 CSV
COPY meta.property   TO '/tmp/property.csv'   (HEADER, DELIMITER ',');

-- 导出到 JSON
COPY meta.link_type  TO '/tmp/link_type.json' (FORMAT JSON, ARRAY true);

-- 从 Parquet 读回来（演示 read_parquet）
SELECT * FROM read_parquet('/tmp/object_type.parquet');

-- 直接查询远程 CSV（如果联网，可换成真实 URL）
-- SELECT * FROM read_csv_auto('https://example.com/data.csv');
\`\`\`

### 5.7 TEMP TABLE + INSERT ... SELECT + CREATE TABLE AS

\`\`\`sql
-- CTAS
CREATE TEMP TABLE action_summary AS
    SELECT category, count(*) AS n, list(api_name) AS actions
    FROM   meta.action_type
    GROUP  BY category;

SELECT * FROM action_summary;

-- INSERT INTO ... SELECT
CREATE TEMP TABLE all_names (kind VARCHAR, name VARCHAR);
INSERT INTO all_names
    SELECT 'Object', api_name FROM meta.object_type
    UNION ALL
    SELECT 'Link',   api_name FROM meta.link_type
    UNION ALL
    SELECT 'Action', api_name FROM meta.action_type;

SELECT * FROM all_names ORDER BY kind, name;
\`\`\`

### 5.8 事务控制

\`\`\`sql
BEGIN TRANSACTION;

INSERT INTO meta.state (ot_id, phase, snapshot, changed_by, change_reason)
VALUES (1, 'SUSPENDED', '{"api_name":"ObjectType","note":"maintenance"}', 'dba', 'Planned maintenance');

-- 查看插入结果
SELECT * FROM meta.state WHERE phase = 'SUSPENDED';

-- 决定回滚
ROLLBACK;

-- 确认已回滚
SELECT * FROM meta.state WHERE phase = 'SUSPENDED';  -- 0 行
\`\`\`

### 5.9 QUALIFY（窗口函数后置过滤）

\`\`\`sql
-- 每个 Object Type 只保留最新 State
SELECT ot.api_name, s.phase, s.entered_at
FROM   meta.state s
JOIN   meta.object_type ot USING (ot_id)
QUALIFY ROW_NUMBER() OVER (PARTITION BY s.ot_id ORDER BY s.entered_at DESC) = 1;
\`\`\`

### 5.10 GROUPING SETS / CUBE / ROLLUP

\`\`\`sql
SELECT
    ot.api_name                      AS object_type,
    p.dtype::VARCHAR                 AS data_type,
    GROUPING(ot.api_name)            AS grp_ot,
    GROUPING(p.dtype)                AS grp_dtype,
    count(*)                         AS cnt
FROM   meta.property p
JOIN   meta.object_type ot USING (ot_id)
GROUP  BY CUBE (ot.api_name, p.dtype)
ORDER  BY grp_ot, grp_dtype, object_type, data_type;
\`\`\`

### 5.11 LATERAL JOIN

\`\`\`sql
-- 每个 Object Type 取其最早 2 条 State
SELECT ot.api_name, sub.*
FROM   meta.object_type ot,
       LATERAL (
           SELECT phase, entered_at
           FROM   meta.state s
           WHERE  s.ot_id = ot.ot_id
           ORDER  BY entered_at
           LIMIT 2
       ) sub;
\`\`\`

### 5.12 VALUES 列表 + 内联表

\`\`\`sql
-- 快速对照表（不建表也能用）
SELECT v.code, v.meaning
FROM   (VALUES ('ONE_TO_ONE',  '1:1'),
               ('ONE_TO_MANY', '1:N'),
               ('MANY_TO_ONE', 'N:1'),
               ('MANY_TO_MANY','M:N')) AS v(code, meaning);
\`\`\`

### 5.13 信息查询（元数据之元数据）

\`\`\`sql
-- 列出 meta schema 下所有表
SELECT table_name, column_count, estimated_size
FROM   duckdb_tables()
WHERE  schema_name = 'meta';

-- 列出列
SELECT table_name, column_name, data_type, is_nullable
FROM   information_schema.columns
WHERE  table_schema = 'meta'
ORDER  BY table_name, ordinal_position;

-- 列出约束
SELECT * FROM duckdb_constraints() WHERE schema_name = 'meta';
\`\`\`

---

## 6. 验证元模型完整性（Data Quality Checks）

\`\`\`sql
-- CHECK 1：每个 Object Type 至少有 1 个 is_primary 属性
SELECT ot.api_name, count(*) FILTER (WHERE p.is_primary) AS pk_count
FROM   meta.object_type ot
LEFT   JOIN meta.property p USING (ot_id)
GROUP  BY ot.api_name
HAVING count(*) FILTER (WHERE p.is_primary) = 0;
-- 期望 0 行

-- CHECK 2：Link 不能自环（from = to 且 api_name 不含 "self"）
SELECT *
FROM   meta.link_type
WHERE  from_ot_id = to_ot_id
  AND  api_name NOT ILIKE '%self%'
  AND  api_name NOT ILIKE '%has%';      -- hasProperty 是 OT→OT 关系，合法

-- CHECK 3：状态跃迁图中不存在不可达的终态
WITH reachable AS (
    SELECT DISTINCT to_phase AS phase FROM meta.action_state_transition
    UNION
    SELECT DISTINCT from_phase FROM meta.action_state_transition
)
SELECT e.enum_value AS unreachable_phase
FROM   (SELECT unnest(['DRAFT','ACTIVE','SUSPENDED','ARCHIVED','DELETED']::lifecycle_phase[]) AS enum_value) e
LEFT   JOIN reachable r ON r.phase = e.enum_value
WHERE  r.phase IS NULL;

-- CHECK 4：Action 的 side_effects 引用的 Action 必须存在
SELECT at1.api_name AS action, unnest(at1.side_effects) AS missing_effect
FROM   meta.action_type at1
WHERE  at1.side_effects IS NOT NULL
  AND  unnest(at1.side_effects) NOT IN (SELECT api_name FROM meta.action_type);
\`\`\`

---

## 7. 图：将整个元模型可视化为 Mermaid

用 DuckDB 直接**生成 Mermaid 代码**：

\`\`\`sql
-- 生成 Mermaid ER 图
WITH lines AS (
    SELECT 1 AS ord, 'erDiagram' AS line
    UNION ALL
    SELECT 2, '    ' || f.api_name || ' ||--o{ ' || t.api_name || ' : "' || lt.api_name || '"'
    FROM   meta.link_type lt
    JOIN   meta.object_type f ON f.ot_id = lt.from_ot_id
    JOIN   meta.object_type t ON t.ot_id = lt.to_ot_id
)
SELECT line FROM lines ORDER BY ord;
\`\`\`

输出粘贴到任何 Mermaid 渲染器即可看到：

\`\`\`mermaid
erDiagram
    ObjectType ||--o{ ObjectType : "hasProperty"
    LinkType   ||--o{ ObjectType : "linksFrom"
    LinkType   ||--o{ ObjectType : "linksTo"
    State      ||--o{ ObjectType : "stateOf"
    ActionType ||--o{ ObjectType : "targetsObject"
    ActionType ||--o{ State      : "causesTransition"
\`\`\`

---

## 8. 状态机可视化

\`\`\`sql
-- 生成 Mermaid 状态图
WITH lines AS (
    SELECT 1 AS ord, 'stateDiagram-v2' AS line
    UNION ALL
    SELECT 2,
        '    ' || from_phase::VARCHAR || ' --> ' || to_phase::VARCHAR
        || ' : ' || at2.api_name
    FROM   meta.action_state_transition ast
    JOIN   meta.action_type at2 USING (at_id)
)
SELECT line FROM lines ORDER BY ord;
\`\`\`

\`\`\`mermaid
stateDiagram-v2
    DRAFT     --> DRAFT    : RegisterObjectType
    DRAFT     --> ACTIVE   : ActivateObject
    ACTIVE    --> ARCHIVED : ArchiveObject
    ARCHIVED  --> DELETED  : DeleteObjectType
\`\`\`

---

## 9. 如何复用到任意业务场景

这套元模型就是一个**工厂**。假设要建一个"供应链"Ontology，只需：

\`\`\`sql
-- 1. 注册新 Object Type
INSERT INTO meta.object_type (api_name, display_name, tags) VALUES
    ('Warehouse', 'Warehouse', ARRAY['supply-chain']),
    ('Shipment',  'Shipment',  ARRAY['supply-chain']);

-- 2. 定义属性
INSERT INTO meta.property (ot_id, api_name, display_name, dtype, is_primary) VALUES
    (5, 'wh_id',    'Warehouse ID', 'STRING',  true),
    (5, 'capacity', 'Capacity',     'INTEGER', false),
    (6, 'ship_id',  'Shipment ID',  'STRING',  true),
    (6, 'status',   'Status',       'STRING',  false);

-- 3. 建 Link
INSERT INTO meta.link_type (api_name, display_name, from_ot_id, to_ot_id, cardinality) VALUES
    ('shipsFrom', 'ships From', 6, 5, 'MANY_TO_ONE');

-- 4. 建 Action
INSERT INTO meta.action_type (api_name, display_name, category, target_ot_id, parameters) VALUES
    ('DispatchShipment', 'Dispatch Shipment', 'TRANSITION', 6,
     '[{"name":"carrier","type":"STRING","required":true}]');

-- 5. 定义状态跃迁
INSERT INTO meta.action_state_transition VALUES
    (7, 'DRAFT', 'ACTIVE');   -- at_id=7 for DispatchShipment

-- 验证
SELECT * FROM meta.v_full_ontology WHERE object_type IN ('Warehouse','Shipment');
\`\`\`

你定义的**任何业务域**都只是这个 meta schema 里的**数据行**，不需要改结构。

---

## 10. 清理

\`\`\`sql
-- 按需
DROP SCHEMA IF EXISTS meta CASCADE;
DETACH ontology_db;
\`\`\`

---

## 11. 操作清单总览（MECE 自检）

| 分类 | 涉及操作 | 对应章节 |
|------|----------|----------|
| **DDL** | CREATE SCHEMA / TABLE / VIEW / INDEX / SEQUENCE / TYPE(ENUM) / MACRO; ALTER TABLE; DROP | §2, §5.1, §5.3, §10 |
| **DML** | INSERT / UPDATE / DELETE / INSERT...SELECT | §3, §5.7 |
| **DQL 基础** | SELECT / WHERE / ORDER BY / LIMIT / DISTINCT | §4.1 |
| **聚合** | GROUP BY / HAVING / FILTER / GROUPING SETS / CUBE / ROLLUP | §4.2, §5.10 |
| **JOIN** | INNER / LEFT / CROSS / SEMI(EXISTS) / ANTI(NOT EXISTS) / LATERAL | §4.3, §5.11 |
| **子查询/CTE** | 标量子查询 / CTE / 递归 CTE | §4.4 |
| **窗口** | ROW_NUMBER / LEAD / DENSE_RANK / count OVER / WINDOW 子句 / QUALIFY | §4.5, §5.9 |
| **集合** | UNION / UNION ALL / INTERSECT / EXCEPT | §4.6 |
| **复杂类型** | JSON / STRUCT / MAP / ARRAY / UNNEST / list_transform / list_filter | §4.7, §5.2 |
| **字符串/正则/日期** | upper / regexp_extract / string_split / date_part / strftime | §4.8 |
| **PIVOT/UNPIVOT** | PIVOT ON ... USING / UNPIVOT ... INTO | §4.9 |
| **表达式** | CASE / COALESCE / NULLIF / CAST | §4.10 |
| **宏** | MACRO (标量 + 表) | §5.1 |
| **Lambda** | list_transform / list_filter / list_reduce | §5.2 |
| **Generated Column** | ALTER TABLE ADD ... GENERATED ALWAYS AS | §5.3 |
| **采样** | USING SAMPLE / TABLESAMPLE | §5.4 |
| **执行计划** | EXPLAIN / EXPLAIN ANALYZE | §5.5 |
| **IO** | COPY TO/FROM (Parquet/CSV/JSON) / read_parquet / read_csv_auto | §5.6 |
| **CTAS / Temp** | CREATE TEMP TABLE AS | §5.7 |
| **事务** | BEGIN / COMMIT / ROLLBACK | §5.8 |
| **元数据** | duckdb_tables() / information_schema / duckdb_constraints() | §5.13 |
| **VALUES** | 内联 VALUES 表 | §5.12 |
| **数据质量** | 约束检查查询 | §6 |
| **可视化生成** | SQL 生成 Mermaid | §7, §8 |

---

## 结语

你刚刚做了一件"自举"（bootstrap）的事：**用 SQL 建了一个描述 Ontology 的 Ontology**。

- **Object Type** = 你对世界的分类方式。
- **Link Type** = 分类之间的关系拓扑。
- **State** = 对象随时间演化的快照序列。
- **Action Type** = 驱动状态流转的原子操作，串联起来就是业务流程。

这四者缺一不可、互不重叠（MECE），它们合在一起就是 Palantir 把任何混乱的数据治理问题变成可操作图谱的核心抽象。把这套元模型导出为 Parquet，带去下一个项目，直接往里灌业务定义即可。
`,Dn=`---
id: "code-parquet-inspect"
title: "Parquet 极速元数据与数据分布抽样"
category: "template"
description: "利用 DuckDB 极速读取 Parquet 元数据信息，并基于 Reservoir Sampling 抽取固定比例样本进行快速剖析。"
isFavorite: true
createdAt: "2026-03-01T08:00:00.000Z"
updatedAt: "2026-03-21T18:00:00.000Z"
tags:
  - "DuckDB"
  - "Parquet"
  - "数据探索"
  - "抽样分析"
params:
  - name: "file_path"
    label: "Parquet 文件路径或URL"
    defaultValue: "orders_sample.parquet"
    description: "虚拟文件系统或远程 Parquet 文件路径"
  - name: "sample_percentage"
    label: "抽样百分比 (%)"
    defaultValue: "10"
    description: "按行伯努利采样比例"
---

\`\`\`sql
-- 1. 自动在 DuckDB WASM 虚拟文件系统中准备一份样本 Parquet 文件（确保开箱即跑）
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
LIMIT 100;
\`\`\`
`,jn=`---
id: "sql-learning-path"
type: "note"
isFavorite: false
createdAt: "2026-09-22T00:57:29.611Z"
updatedAt: "2026-09-22T00:57:29.611Z"
tags:
  - "学习路径"
  - "DuckDB"
  - "教程"
title: "SQL 学习路径：基于领导建议的系统化方案"
topic: "best_practice"
summary: "替代纸质资料，按使用频率分三层，随时检索。 查询语句的七个关键词及其书写顺序："
---

# SQL 学习路径：基于领导建议的系统化方案

---

## 一、基础语法速查模块

替代纸质资料，按使用频率分三层，随时检索。

### 第一层：每天都用

查询语句的七个关键词及其书写顺序：

SELECT 查哪些字段 → FROM 从哪张表 → WHERE 筛选条件 → GROUP BY 按什么分组 → HAVING 分组后再筛选 → ORDER BY 排序 → LIMIT 取前几条

记忆口诀：书房里五个孩子在排队（S-F-W-G-H-O-L）

### 第二层：经常要用

过滤类：IN 多值匹配、NOT IN 排除、BETWEEN 范围、LIKE 模糊查询、IS NULL 空值判断

聚合类：COUNT 计数、SUM 求和、AVG 平均、MAX 最大、MIN 最小

连接类：LEFT JOIN 保留左表全部、INNER JOIN 只保留交集、FULL JOIN 保留两边全部

其他：DISTINCT 去重、UNION 上下合并去重、UNION ALL 上下合并不去重

### 第三层：关键时刻用

COALESCE 多值取非空、IFNULL 或 NVL 空值替换、CAST 或 CONVERT 类型转换、DATE_FORMAT 日期格式化、DATEDIFF 日期差值计算

---

## 二、三大高频语法详解

---

### 语法一：临时表加工，核心是 CASE WHEN

#### 解决什么问题

把原始数据重新分类、打标签，加工成分析可用的中间小表。比如把充值金额分成大R中R小R，把用户按注册天数分成新老用户。

#### CASE WHEN 基本逻辑

相当于 Excel 里的多层 IF 嵌套。按顺序判断条件，满足哪个就归入哪类，都不满足则走 ELSE。简单的二选一场景也可以用 IF 函数替代。

#### 生成临时表的三种方式

第一种，CTE 写法，用 WITH 定义临时表名，紧跟主查询使用。可读性最好，推荐优先使用。可以连续定义多个临时表，后面的可以引用前面的。

第二种，子查询写法，把加工逻辑写在 FROM 后面的括号里当作一张虚拟表。简单场景够用，但嵌套多了可读性下降。

第三种，CREATE TEMPORARY TABLE，创建真正的临时表，会话结束自动销毁。适合中间结果需要反复引用的场景。

#### 实战检验标准

能独立写出：按用户的累计充值金额分层，统计每层的人数和总充值金额。进阶版是再加上「注册七天内是否付费」这个维度做交叉分析。

---

### 语法二：窗口函数

#### 解决什么问题

在不减少数据行数的前提下做聚合计算。普通的 GROUP BY 会把多行压成一行，窗口函数保留每一行的明细，同时附加上排名、累计、占比等分析结果。

#### 基本结构

任何窗口函数都遵循同一个框架：函数名加上 OVER，OVER 里面可以写三样东西。PARTITION BY 指定分组，ORDER BY 指定排序，ROWS BETWEEN 指定窗口范围。三样都是可选的，根据需要组合。

#### 四类最常用的窗口函数

第一类，排名函数。ROW_NUMBER 严格递增不并列，RANK 并列后跳号，DENSE_RANK 并列后不跳号。最高频的用法是取每组的 TOP N：先用 ROW_NUMBER 按组内排名编号，外面再套一层筛选只取编号小于等于 N 的行。

第二类，累计与滚动计算。SUM 加 OVER 按日期排序可以算累计收入。AVG 加 OVER 配合 ROWS BETWEEN 前六行到当前行可以算七日滑动平均。同理可以做滚动求和、滚动计数。

第三类，偏移函数。LAG 取前面第 N 行的值，LEAD 取后面第 N 行的值。最典型的用途是算日环比和周环比：当天收入减去 LAG 一天前的收入就是日环比差值，除以前一天收入就是日环比率。

第四类，聚合窗口。把 SUM、COUNT、AVG 等聚合函数放进 OVER 里，可以在每行上显示组内的总和或均值。最典型的用途是算占比：当前行的值除以 SUM OVER 按组的总值。

#### 窗口函数速记

需要排名就用 ROW_NUMBER 或 RANK。需要累计就用 SUM OVER 加 ORDER BY。需要前后对比就用 LAG 和 LEAD。需要组内占比就用值除以 SUM OVER 加 PARTITION BY。需要滑动均值就用 AVG OVER 配合 ROWS BETWEEN。

---

### 语法三（补充推荐）：多表 JOIN

#### 为什么选它作为第三个重点

实际工作中数据永远不在一张表里。用户表、充值表、行为表、渠道表，几乎每条查询都要关联两到五张表。JOIN 写不好，数据就会重复膨胀或者丢失记录，这是新手踩得最多的坑。

#### 三种 JOIN 的区别

INNER JOIN 只保留两边都能匹配上的记录，相当于取交集。LEFT JOIN 保留左表全部记录，右表匹配不上的字段补空值，是工作中用得最多的。FULL JOIN 保留两边全部记录，任何一边没匹配上的都补空值。

#### 最大的坑：数据膨胀

如果一个用户在充值表里有三条记录，直接和用户表 JOIN 后这个用户就会变成三行。结果看起来人数和金额都变多了，实际是重复计算。

解决原则是先聚合再关联。先把充值表按用户维度汇总成每人一行的汇总表，再拿这个汇总表去和用户表做 LEFT JOIN，这样就能保证一人一行不膨胀。

#### 实战经典模式

最常见的工作场景是三表关联：用户基础表提供注册信息和渠道来源，充值汇总表提供付费数据，登录汇总表提供活跃数据。先用 CTE 分别把充值表和登录表按用户维度聚合好，再用用户表做主表分别 LEFT JOIN 这两个汇总表，最后在 SELECT 里用 CASE WHEN 打上用户分层标签，空值用 IFNULL 替换为零。

这一个查询把三大语法全串起来了：CTE 临时表做数据预加工，CASE WHEN 做分类打标，LEFT JOIN 做多表关联。这就是日常取数最真实的写法。

---

## 三、学习节奏建议

第一周，过一遍基础语法，能独立写出带筛选、分组、排序的简单查询。

第二周，重点练 CASE WHEN 加 CTE 临时表，用真实业务数据做用户分层练习。

第三周，重点练 JOIN，反复理解 LEFT JOIN 和先聚合再关联的原则，写三表关联查询。

第四周，练窗口函数，从 ROW_NUMBER 取 TOP N 和 SUM OVER 算累计开始，再拓展到 LAG 做环比。

之后持续练习，每天写一条真实业务 SQL，不会的随时查速查模块。

#### 一个检验标准

当你能独立写出三表关联的完整查询，并且清楚每一步为什么这样写、换一个业务场景能自己改出来的时候，日常百分之八十的取数需求就都能自己搞定了。
`,Mn=`---
id: "code-retention-cohort"
title: "用户留存队列分析 (Cohort Retention Model)"
category: "template"
description: "标准 Cohort 留存模型：按首访自然周聚合首购用户，并计算次周、第3周到第8周的留存率与留存人数矩阵。"
isFavorite: true
createdAt: "2026-03-05T09:15:00.000Z"
updatedAt: "2026-03-21T14:00:00.000Z"
tags:
  - "留存分析"
  - "Cohort"
  - "窗口函数"
  - "用户增长"
params:
  - name: "event_table"
    label: "事件日志表名"
    defaultValue: "user_events"
    description: "包含 user_id 和 event_time 的行为日志表"
  - name: "start_date"
    label: "起始分析日期"
    defaultValue: "2026-01-01"
    description: "留存分析观察窗口下限"
---

\`\`\`sql
-- 确保存在样本行为日志表（若不存在则自动准备，确保开箱即跑）
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
ORDER BY cohort_week DESC;
\`\`\`
`;function de(n){const a=["---"];if(a.push(`id: "${B(n.id)}"`),a.push(`type: "${n.type}"`),a.push(`isFavorite: ${!!n.isFavorite}`),a.push(`createdAt: "${n.createdAt||new Date().toISOString()}"`),a.push(`updatedAt: "${n.updatedAt||new Date().toISOString()}"`),n.tags&&n.tags.length>0&&(a.push("tags:"),n.tags.forEach(t=>{a.push(`  - "${B(t)}"`)})),n.type==="code"){const t=n;return a.push(`title: "${B(t.title)}"`),a.push(`category: "${t.category||"snippet"}"`),a.push(`description: "${B(t.description||"")}"`),t.params&&t.params.length>0&&(a.push("params:"),t.params.forEach(o=>{a.push(`  - name: "${B(o.name)}"`),a.push(`    label: "${B(o.label||o.name)}"`),a.push(`    defaultValue: "${B(o.defaultValue||"")}"`),o.description&&a.push(`    description: "${B(o.description)}"`)})),a.push("---"),a.push(""),a.push("```sql"),a.push(t.sql.trim()),a.push("```"),a.push(""),a.join(`
`)}if(n.type==="metric"){const t=n;return a.push(`name: "${B(t.name)}"`),t.owner&&a.push(`owner: "${B(t.owner)}"`),t.sourceTables&&t.sourceTables.length>0&&(a.push("sourceTables:"),t.sourceTables.forEach(o=>{a.push(`  - "${B(o)}"`)})),t.dimensions&&t.dimensions.length>0&&(a.push("dimensions:"),t.dimensions.forEach(o=>{a.push(`  - "${B(o)}"`)})),a.push("---"),a.push(""),a.push("## 业务定义与统计场景"),a.push(t.businessMeaning||""),a.push(""),a.push("## 计算公式与度量逻辑"),a.push(t.calculationFormula||""),a.push(""),a.push("## SQL 查询定义"),a.push("```sql"),a.push(t.sqlExpression?t.sqlExpression.trim():""),a.push("```"),a.push(""),a.join(`
`)}if(n.type==="note"){const t=n;return a.push(`title: "${B(t.title)}"`),a.push(`topic: "${t.topic||"pitfall"}"`),t.summary&&a.push(`summary: "${B(t.summary)}"`),t.references&&t.references.length>0&&(a.push("references:"),t.references.forEach(o=>{a.push(`  - "${B(o)}"`)})),a.push("---"),a.push(""),a.push(t.content.trim()),a.push(""),a.join(`
`)}return a.push("---"),a.join(`
`)}function Un(n){return de(n)}const ge={"001 内嵌DuckDB教程_简单":{id:"duckdb-sql-complete",category:"入门",difficulty:"Beginner"},"002 内嵌DuckDB教程_简单":{id:"duckdb-sql-lesson-1",category:"入门",difficulty:"Beginner"},"003 DuckDB教程_自定义上传":{id:"ontology-duckdb-complete",category:"本体建模",difficulty:"Intermediate"},"004 DuckDB教程_自定义上传":{id:"ontology-duckdb-runnable",category:"本体建模",difficulty:"Intermediate"},Quick_Tutorial:{id:"sql-learning-path",category:"学习路径",difficulty:"Beginner"}};function Fn(n){const a=n.split(/\r?\n/);for(const t of a){const o=t.trim();if(!(!o||o.startsWith("--")||o.startsWith("/*")))return/^(?:SELECT|WITH|CREATE|INSERT|UPDATE|DELETE|COPY|PRAGMA|EXPLAIN|DESCRIBE|ATTACH|DETACH|USE|ALTER)\b/i.test(o)}return!1}function vn(n,a){if(n.type==="code"||n.type==="metric"||n.type==="note")return n.type;if(n.topic||n.references)return"note";if(n.calculationFormula||n.name||n.businessMeaning)return"metric";if(n.params||n.category==="snippet"||n.category==="template"||n.category==="script")return"code";const t=a.trim(),o=Fn(t),s=/^```(?:sql)?\r?\n[\s\S]*?\r?\n```$/i.test(t),l=/^#\s+[^\r\n]+\r?\n+```(?:sql)?\r?\n[\s\S]*?\r?\n```\s*$/i.test(t);if(o||s||l)return"code";if(/##\s*(?:业务定义|计算公式|度量逻辑)/.test(t))return"metric";const c=(t.match(/^#{1,4}\s+.+$/gm)||[]).length,i=t.split(/\r?\n\r?\n/).filter(d=>d.trim().length>0).length;return c>=1||i>=3||t.length>250?"note":"code"}function Oe(n,a){const t=n.match(/^#\s+(.+)$/m);if(t)return t[1].replace(/[*_`]/g,"").trim();const o=n.match(/^##\s+(.+)$/m);return o?o[1].replace(/[*_`]/g,"").trim():a}function we(n){const a=n.split(/\r?\n/),t=[];for(const s of a){const l=s.trim();if(!(!l||l.startsWith("#")||l.startsWith("```")||l.startsWith("---")||l.startsWith("|"))){if(l.startsWith(">")){const c=l.replace(/^>+\s*/,"").replace(/\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i,"").trim();if(c.length>10)return c.length>200?c.slice(0,197)+"...":c}if(!/^\d+\.\s*\[.+\]\(#.+\)/.test(l)&&l.length>15&&(t.push(l.replace(/[*_`]/g,"")),t.length>=2))break}}const o=t.join(" ").trim();return o?o.length>200?o.slice(0,197)+"...":o:"DuckDB 知识库核心技术讲义与实践笔记"}function wn(n,a,t){if(t&&t.length>0)return t;const o=new Set,s=`${a} ${n}`.toLowerCase();return o.add("DuckDB"),s.includes("sql")&&o.add("SQL"),(s.includes("教程")||s.includes("tutorial")||s.includes("lesson"))&&o.add("教程"),(s.includes("ontology")||s.includes("本体"))&&o.add("本体建模"),s.includes("palantir")&&o.add("Palantir"),(s.includes("入门")||s.includes("beginner")||s.includes("简单"))&&o.add("入门教程"),(s.includes("进阶")||s.includes("高级")||s.includes("intermediate"))&&o.add("进阶实战"),(s.includes("调优")||s.includes("内存")||s.includes("oom")||s.includes("performance"))&&o.add("性能调优"),s.includes("parquet")&&o.add("Parquet"),s.includes("pivot")&&o.add("透视分析"),s.includes("学习路径")&&o.add("学习路径"),Array.from(o).slice(0,5)}function Pn(n,a,t,o){if(n&&n.trim())return n.trim();const s=(a||o||"").replace(/\.md$/,"").trim();if(ge[s])return ge[s].id;if(a&&a.trim())return a.trim();if(s){const l=s.replace(/[\s\/\\?%*:|"<>]+/g,"-").replace(/^-+|-+$/g,"");if(l)return`${t}-${l}`}return`${t}-${Date.now()}`}function Ne(n,a){const t=n.trim(),o=/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/,s=t.match(o);let l="",c=t;s&&(l=s[1],c=s[2].trim());const i=Bn(l),d=vn(i,c),R=new Date().toISOString(),E=Pn(i.id,a,d),u=!!i.isFavorite,O=i.createdAt||R,D=i.updatedAt||R,p=(a||"").replace(/\.md$/,"").trim(),L=ge[p],x=wn(c,a||"",Array.isArray(i.tags)?i.tags:L?[L.category,"DuckDB","教程"]:void 0);if(d==="note"){const S=i.title||Oe(c,E.replace(/^note-/,"")),y=["pitfall","optimization","best_practice","faq"].includes(i.topic)?i.topic:"best_practice",g=i.summary||we(c),N=Array.isArray(i.references)?i.references:[];return{id:E,type:"note",title:S,topic:y,summary:g,content:c,tags:x,references:N,isFavorite:u,createdAt:O,updatedAt:D}}if(d==="metric"){const S=i.name||i.title||Oe(c,E.replace(/^metric-/,"")),y=i.owner||"",g=Array.isArray(i.sourceTables)?i.sourceTables:[],N=Array.isArray(i.dimensions)?i.dimensions:[];let C=i.businessMeaning||"",f=i.calculationFormula||"",q="";const X=/```sql\b[^\r\n]*\r?\n([\s\S]*?)\r?\n```/i,J=c.match(X);J&&(q=J[1].trim());const $=c.match(/## 业务定义与统计场景\r?\n([\s\S]*?)(?=\r?\n##|$)/i);$&&(C=$[1].trim());const K=c.match(/## 计算公式与度量逻辑\r?\n([\s\S]*?)(?=\r?\n##|$)/i);return K&&(f=K[1].trim()),{id:E,type:"metric",name:S,businessMeaning:C||S,calculationFormula:f||"SUM(value)",sqlExpression:q,sourceTables:g,dimensions:N,owner:y,tags:x,isFavorite:u,createdAt:O,updatedAt:D}}let T=c;const h=/```sql\b[^\r\n]*\r?\n([\s\S]*?)\r?\n```/i,M=c.match(h);M?T=M[1].trim():c.startsWith("```")&&(T=c.replace(/^```[a-zA-Z]*\r?\n/,"").replace(/\r?\n```$/,"").trim());const v=i.title||Oe(c,E.replace(/^code-/,"")),V=["snippet","template","script"].includes(i.category)?i.category:"snippet";let w=i.description||"";if(!w){const S=c.split("```")[0].trim();S&&!S.startsWith("#")?w=S:w=we(c)}const I=Array.isArray(i.params)?i.params:[];return{id:E,type:"code",title:v,category:V,description:w||"自定义 SQL 片段",sql:T,params:I,tags:x,isFavorite:u,createdAt:O,updatedAt:D}}function B(n){return n?n.replace(/\\/g,"\\\\").replace(/"/g,'\\"').replace(/\n/g,"\\n"):""}function Bn(n){const a={};if(!n.trim())return a;const t=n.split(/\r?\n/);let o="",s=!1,l=!1,c=!1,i=!1,d=!1,R=null;for(let E=0;E<t.length;E++){const u=t[E],O=u.trim();if(!O||O.startsWith("#"))continue;const D=u.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);if(D&&!u.startsWith(" ")&&!u.startsWith("	")){o=D[1];const p=D[2].trim();if(s=o==="tags",l=o==="params",c=o==="sourceTables",i=o==="dimensions",d=o==="references",s){a.tags=[];continue}else if(l){a.params=[];continue}else if(c){a.sourceTables=[];continue}else if(i){a.dimensions=[];continue}else if(d){a.references=[];continue}else{a[o]=Z(p);continue}}if(s&&O.startsWith("-")){const p=Z(O.slice(1).trim());p&&a.tags.push(p);continue}if(c&&O.startsWith("-")){const p=Z(O.slice(1).trim());p&&a.sourceTables.push(p);continue}if(i&&O.startsWith("-")){const p=Z(O.slice(1).trim());p&&a.dimensions.push(p);continue}if(d&&O.startsWith("-")){const p=Z(O.slice(1).trim());p&&a.references.push(p);continue}if(l){if(O.startsWith("-")){R={},a.params.push(R);const L=O.slice(1).trim().match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);L&&R&&(R[L[1]]=Z(L[2].trim()));continue}else if(R&&u.startsWith("   ")){const p=O.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);p&&(R[p[1]]=Z(p[2].trim()));continue}}}return a}function Z(n){return n?n==="true"?!0:n==="false"?!1:n.startsWith('"')&&n.endsWith('"')||n.startsWith("'")&&n.endsWith("'")?n.slice(1,-1).replace(/\\"/g,'"').replace(/\\n/g,`
`):n:""}function Hn(n){if(!n)return[];const a=/```(?:sql|duckdb)\b([\s\S]*?)```/gi,t=[];let o;for(;(o=a.exec(n))!==null;){const s=o[1].trim();s&&t.push(s)}return t}const $e="duckdb_snippets_dir_handle",Vn="duckdb_snippets_fs",le="handles",Wn=Object.assign({"/snippets/duckdb-dynamic-pivot.md":bn,"/snippets/duckdb-memory-tuning-guide.md":hn,"/snippets/duckdb-sql-complete_md.md":xn,"/snippets/duckdb-sql-lesson-1_md.md":In,"/snippets/gmv-net-calculation.md":Cn,"/snippets/ontology-duckdb-complete_md.md":fn,"/snippets/ontology-duckdb-runnable_md.md":kn,"/snippets/parquet-schema-sample.md":Dn,"/snippets/sql-learning-path_md.md":jn,"/snippets/user-cohort-retention.md":Mn});function qn(){const n=[];for(const[a,t]of Object.entries(Wn)){const o=a.split("/").pop()||"snippet.md";try{const s=Ne(t,o.replace(/\.md$/,""));n.push(s)}catch(s){console.warn(`[SnippetFsService] Failed to parse bundled snippet ${a}:`,s)}}return n}async function Gn(){try{const n="/DuckDB_Editor_Pro/",a=n.endsWith("/")?n.slice(0,-1):n,t=await fetch(`${a}/api/snippets`,{signal:AbortSignal.timeout(2e3)});if(!t.ok)return null;const o=await t.json();return o&&o.success&&Array.isArray(o.snippets)?o.snippets.map(s=>Ne(s.content,s.filename.replace(/\.md$/,""))):null}catch{return null}}async function Yn(){try{const n="/DuckDB_Editor_Pro/",a=n.endsWith("/")?n.slice(0,-1):n,t=await fetch(`${a}/api/docs`,{signal:AbortSignal.timeout(3e3)});if(t.ok){const o=await t.json();if(o&&o.success&&Array.isArray(o.docs)&&o.docs.length>0)return o.docs}}catch{}try{const n="/DuckDB_Editor_Pro/",a=n.endsWith("/")?n.slice(0,-1):n,t=await fetch(`${a}/docs/index.json`,{signal:AbortSignal.timeout(3e3)});if(t.ok){const o=await t.json();if(o&&Array.isArray(o.tutorials)){const l=(await Promise.all(o.tutorials.map(async c=>{const i=c.docPath||"",d=i.startsWith("/")?i:`/${i}`,R=await fetch(`${a}${d}`);if(R.ok){const E=await R.text();return{filename:d.split("/").pop()||`${c.id}.md`,content:E}}return null}))).filter(Boolean);if(l.length>0)return l}}}catch{}return null}async function Ke(n){try{const a="/DuckDB_Editor_Pro/",t=a.endsWith("/")?a.slice(0,-1):a,o=de(n),s=`${n.id}.md`;return(await fetch(`${t}/api/snippets`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:n.id,filename:s,content:o})})).ok}catch{return!1}}async function Jn(n){try{const a="/DuckDB_Editor_Pro/",t=a.endsWith("/")?a.slice(0,-1):a;return(await fetch(`${t}/api/snippets?id=${encodeURIComponent(n)}`,{method:"DELETE"})).ok}catch{return!1}}function Qe(){return new Promise((n,a)=>{const t=indexedDB.open(Vn,1);t.onupgradeneeded=()=>{t.result.createObjectStore(le)},t.onsuccess=()=>n(t.result),t.onerror=()=>a(t.error)})}async function $n(n){const a=await Qe();return new Promise((t,o)=>{const s=a.transaction(le,"readwrite");s.objectStore(le).put(n,$e),s.oncomplete=()=>t(),s.onerror=()=>o(s.error)})}async function Se(){try{const n=await Qe();return new Promise(a=>{const o=n.transaction(le,"readonly").objectStore(le).get($e);o.onsuccess=()=>a(o.result||null),o.onerror=()=>a(null)})}catch{return null}}async function Kn(){if(!("showDirectoryPicker"in window))throw new Error("当前浏览器不支持 File System Access API，请使用 Chrome 或 Edge 浏览器。");try{const n=await window.showDirectoryPicker({mode:"readwrite"});return await $n(n),n}catch(n){if(n.name==="AbortError")return null;throw n}}async function Qn(n){const a=[];for await(const[t,o]of n.entries())if(o.kind==="file"&&t.endsWith(".md")){const l=await(await o.getFile()).text();try{const c=Ne(l,t.replace(/\.md$/,""));a.push(c)}catch(c){console.warn(`[SnippetFsService] Failed to parse ${t}:`,c)}}return a}async function Xn(n,a){const t=`${a.id}.md`,s=await(await n.getFileHandle(t,{create:!0})).createWritable(),l=de(a);await s.write(l),await s.close()}async function Zn(n,a){const t=`${a}.md`;try{await n.removeEntry(t)}catch{for await(const[o,s]of n.entries())if(s.kind==="file"&&o.endsWith(".md")){const c=await(await s.getFile()).text();if(c.includes(`id: "${a}"`)||c.includes(`id: ${a}`)){await n.removeEntry(o);break}}}}const zn="duckdb_knowledge_hub",et=1,H="assets",ne=()=>new Promise((n,a)=>{if(typeof indexedDB>"u"){a(new Error("IndexedDB is not available in current environment."));return}const t=indexedDB.open(zn,et);t.onerror=()=>a(t.error),t.onsuccess=()=>n(en(t.result)),t.onupgradeneeded=o=>{const s=o.target.result;if(!s.objectStoreNames.contains(H)){const l=s.createObjectStore(H,{keyPath:"id"});l.createIndex("type","type",{unique:!1}),l.createIndex("updatedAt","updatedAt",{unique:!1}),l.createIndex("isFavorite","isFavorite",{unique:!1})}}}),Re=async()=>{try{const n=await ne(),a=await new Promise((i,d)=>{const u=n.transaction(H,"readonly").objectStore(H).getAll();u.onsuccess=()=>i(u.result||[]),u.onerror=()=>d(u.error)});let t=null;const o=await Se();if(o)try{t=await Qn(o)}catch(i){console.warn("[KnowledgeAssetStorage] Error reading from bound directory handle:",i)}if((!t||t.length===0)&&(t=await Gn()),!t||t.length===0){const i=qn();i.length>0&&(t=i)}const s=new Map;(a.length===0?Le:a).forEach(i=>s.set(i.id,i)),t&&t.length>0&&t.forEach(i=>{const d=s.get(i.id);d?s.set(i.id,{...d,...i,isFavorite:d.isFavorite??i.isFavorite}):s.set(i.id,i)});const c=Array.from(s.values());return a.length===0&&await De(c),c.sort((i,d)=>new Date(d.updatedAt).getTime()-new Date(i.updatedAt).getTime())}catch(n){return console.warn("[KnowledgeAssetStorage] Error loading assets, falling back to seed data:",n),Le}},nt=async n=>{try{const a=await ne();return new Promise((t,o)=>{const c=a.transaction(H,"readonly").objectStore(H).get(n);c.onsuccess=()=>t(c.result||null),c.onerror=()=>o(c.error)})}catch(a){return console.warn(`[KnowledgeAssetStorage] Error getting asset ${n}:`,a),null}},be=async n=>{const a=await ne(),t={...n,updatedAt:new Date().toISOString(),createdAt:n.createdAt||new Date().toISOString()};await new Promise((o,s)=>{const i=a.transaction(H,"readwrite").objectStore(H).put(t);i.onsuccess=()=>o(),i.onerror=()=>s(i.error)}),Ke(t).catch(()=>{}),Se().then(o=>{o&&Xn(o,t).catch(s=>console.warn("[KnowledgeAssetStorage] Failed writing to directory handle:",s))}).catch(()=>{})},De=async n=>{const a=await ne();return new Promise((t,o)=>{const s=a.transaction(H,"readwrite"),l=s.objectStore(H);n.forEach(c=>{l.put(c)}),s.oncomplete=()=>t(),s.onerror=()=>o(s.error)})},tt=async n=>{const a=await ne();await new Promise((t,o)=>{const c=a.transaction(H,"readwrite").objectStore(H).delete(n);c.onsuccess=()=>t(),c.onerror=()=>o(c.error)}),Jn(n).catch(()=>{}),Se().then(t=>{t&&Zn(t,n).catch(()=>{})}).catch(()=>{})},at=async n=>{const a=await nt(n);if(!a)return!1;const t=!a.isFavorite;return await be({...a,isFavorite:t}),t},ot=async()=>{const n=await Re();return JSON.stringify({version:"1.0",exportedAt:new Date().toISOString(),assetCount:n.length,assets:n},null,2)},st=async n=>{const a=JSON.parse(n),t=Array.isArray(a)?a:a.assets;if(!Array.isArray(t))throw new Error("无效的导入数据格式，未找到资产列表。");const o=await Re(),s=new Map(o.map(d=>[d.id,d]));let l=0,c=0;const i=[];for(const d of t)!d.id||!d.type||!d.tags||(s.has(d.id)?c++:l++,i.push({...d,updatedAt:new Date().toISOString()}));return await De(i),{total:i.length,added:l,updated:c}},Xe=async n=>{if(!Array.isArray(n)||n.length===0)return{total:0,added:0,updated:0,assets:[]};const a=await Re(),t=new Map(a.map(c=>[c.id,c]));let o=0,s=0;const l=[];for(const c of n){if(!c.content||!c.content.trim())continue;const i=c.filename.replace(/\.md$/,"").trim(),d=Ne(c.content,i);t.has(d.id)?s++:o++,l.push(d)}if(l.length>0){await De(l);for(const c of l)Ke(c).catch(()=>{})}return{total:l.length,added:o,updated:s,assets:l}},it=async()=>{const n=await Yn();if(!n||n.length===0)throw new Error("未在 docs 目录检测到 Markdown 教程文件，或本地服务端未返回文档数据。");return await Xe(n)},rt=async()=>{const n=await ne();return new Promise((a,t)=>{const o=n.transaction(H,"readwrite"),s=o.objectStore(H);s.clear(),Le.forEach(l=>s.put(l)),o.oncomplete=()=>a(),o.onerror=()=>t(o.error)})};function ct(n){const a=(n.type==="metric"?n.name:n.title).toLowerCase(),t=(n.tags||[]).map(o=>o.toLowerCase());return t.includes("ontology")||t.includes("本体")||a.includes("本体")||a.includes("ontology")?"Ontology":t.includes("sql")||t.includes("duckdb")||n.type==="code"||a.includes("sql")||a.includes("duckdb")?"SQL":t.includes("tutorial")||t.includes("course")||a.includes("教程")||a.includes("入门")||a.includes("lesson")||a.includes("讲义")?"Tutorials":t.includes("data")||t.includes("dataset")||t.includes("parquet")||a.includes("数据")||a.includes("data")||n.type==="metric"?"Data":"General"}const lt=({assets:n,selectedAssetId:a,onSelectAsset:t,searchQuery:o="",onSearchChange:s,isCollapsed:l=!1,onToggleCollapse:c,selectedCategory:i,onSelectCategory:d,onExport:R,onImport:E,onImportDocs:u,onResetSeeds:O,onOpenAiAssistant:D,onPickDirectory:p,boundDirectoryName:L,onNewAsset:x})=>{const[T,h]=m.useState({}),M=m.useMemo(()=>{const I=o.trim().toLowerCase();return n.filter(_=>{if(i&&i!=="all"){if(i==="favorites"){if(!_.isFavorite)return!1}else if(_.type!==i)return!1}if(!I)return!0;const S=(_.type==="metric"?_.name:_.title).toLowerCase(),y=(_.type==="code"?_.description:_.type==="note"?_.summary:_.businessMeaning)||"",g=(_.tags||[]).join(" ").toLowerCase();return S.includes(I)||y.toLowerCase().includes(I)||g.includes(I)})},[n,o,i]),v=m.useMemo(()=>{const I=new Map;["SQL","Ontology","Tutorials","Data","General"].forEach(y=>I.set(y,[])),M.forEach(y=>{const g=ct(y);I.has(g)||I.set(g,[]),I.get(g).push(y)});const S=[];return I.forEach((y,g)=>{y.length>0&&S.push({topic:g,list:y})}),S},[M]),V=I=>{h(_=>({..._,[I]:!_[I]}))},w=I=>{switch(I){case"SQL":return e.jsx(re,{className:"w-3.5 h-3.5 text-monokai-accent"});case"Ontology":return e.jsx(Ie,{className:"w-3.5 h-3.5 text-purple-400"});case"Tutorials":return e.jsx(ye,{className:"w-3.5 h-3.5 text-sky-400"});case"Data":return e.jsx(xe,{className:"w-3.5 h-3.5 text-amber-400"});default:return e.jsx(cn,{className:"w-3.5 h-3.5 text-monokai-comment"})}};return l?null:e.jsxs("aside",{className:"w-72 h-full bg-monokai-bg border-r border-monokai-border flex flex-col shrink-0 select-none overflow-hidden","aria-label":"知识沉淀导航栏",children:[e.jsxs("div",{className:"p-3.5 pb-2 border-b border-monokai-border flex items-center justify-between",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("div",{className:"w-6 h-6 rounded bg-monokai-elevated border border-monokai-border flex items-center justify-center text-monokai-accent",children:e.jsx(ye,{className:"w-3.5 h-3.5"})}),e.jsxs("div",{children:[e.jsx("h2",{className:"text-xs font-bold text-monokai-fg-muted tracking-wide",children:"知识文献库"}),e.jsxs("span",{className:"text-[10px] text-monokai-comment font-mono",children:[M.length," 篇文档 / 讲义"]})]})]}),e.jsxs("div",{className:"flex items-center gap-1.5",children:[x&&e.jsxs("button",{type:"button",onClick:()=>x("note"),className:"flex items-center gap-1 px-2 py-1 rounded bg-monokai-elevated hover:bg-monokai-hover text-monokai-accent text-[11px] font-medium border border-monokai-border transition-colors cursor-pointer",title:"新建知识笔记",children:[e.jsx(nn,{className:"w-3 h-3"}),e.jsx("span",{children:"新建"})]}),c&&e.jsx("button",{type:"button",onClick:c,className:"p-1 rounded bg-monokai-surface hover:bg-monokai-hover text-monokai-comment hover:text-monokai-fg-muted border border-monokai-border transition-colors cursor-pointer",title:"折叠隐藏侧边栏","aria-label":"折叠隐藏侧边栏",children:e.jsx(tn,{className:"w-3.5 h-3.5"})})]})]}),e.jsx("div",{className:"px-3 pt-2.5 pb-2",children:e.jsxs("div",{className:"relative flex items-center",children:[e.jsx(an,{className:"w-3.5 h-3.5 absolute left-2.5 text-monokai-comment pointer-events-none"}),e.jsx("input",{type:"search",value:o,onChange:I=>s==null?void 0:s(I.target.value),placeholder:"筛选标题或标签... (Ctrl+/)",className:"w-full pl-8 pr-7 py-1.5 bg-monokai-surface border border-monokai-border rounded-md text-[11.5px] text-monokai-fg-muted placeholder:text-monokai-comment focus:outline-hidden focus:border-monokai-accent/60 transition-colors"}),o&&e.jsx("button",{type:"button",onClick:()=>s==null?void 0:s(""),className:"absolute right-2 text-monokai-comment hover:text-monokai-fg-muted p-0.5",children:e.jsx(Pe,{className:"w-3 h-3"})})]})}),e.jsx("div",{className:"flex-1 overflow-y-auto custom-scrollbar px-2 py-1 space-y-3",children:v.length===0?e.jsxs("div",{className:"text-center py-10 px-4 text-monokai-comment text-xs",children:[e.jsx("p",{children:"未找到匹配文档"}),o&&e.jsx("button",{type:"button",onClick:()=>s==null?void 0:s(""),className:"mt-2 text-monokai-accent hover:underline text-[11px]",children:"清除筛选条件              "})]}):v.map(({topic:I,list:_})=>{const S=T[I],y=String(_.length).padStart(2,"0");return e.jsxs("div",{className:"space-y-0.5",children:[e.jsxs("button",{type:"button",onClick:()=>V(I),className:"w-full flex items-center justify-between px-2.5 py-1 text-monokai-comment hover:text-monokai-fg-muted hover:bg-monokai-surface rounded transition-colors cursor-pointer text-left group",children:[e.jsxs("div",{className:"flex items-center gap-1.5",children:[w(I),e.jsx("span",{className:"text-xs font-semibold tracking-wide text-monokai-fg-muted group-hover:text-monokai-fg",children:I})]}),e.jsxs("div",{className:"flex items-center gap-1 text-[10.5px]",children:[e.jsx("span",{className:"font-mono text-monokai-comment px-1 py-0.2 rounded bg-monokai-surface border border-monokai-border",children:y}),S?e.jsx(he,{className:"w-3 h-3 text-monokai-comment"}):e.jsx(ue,{className:"w-3 h-3 text-monokai-comment"})]})]}),!S&&e.jsx("ul",{className:"pl-2 space-y-0.5 border-l border-monokai-border ml-2.5 my-1",children:_.map(g=>{const N=a===g.id,C=g.type==="metric"?g.name:g.title;return e.jsx("li",{children:e.jsxs("button",{type:"button",onClick:()=>{t==null||t(g.id),d&&i!=="all"&&d("all")},className:`w-full text-left px-2.5 py-1.5 rounded-md text-[11.5px] transition-all flex items-center justify-between group cursor-pointer ${N?"bg-monokai-elevated text-monokai-accent font-medium border-l-2 border-monokai-accent shadow-2xs":"text-monokai-fg-muted hover:text-monokai-fg hover:bg-monokai-surface"}`,children:[e.jsx("span",{className:"truncate pr-1 leading-snug",children:C}),g.isFavorite&&e.jsx("span",{className:"text-yellow-400/80 text-[10px] shrink-0",children:"★"})]})},g.id)})})]},I)})}),e.jsxs("div",{className:"p-2.5 border-t border-monokai-border bg-monokai-bg space-y-1 text-xs",children:[u&&e.jsxs("button",{type:"button",onClick:u,className:"w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md bg-monokai-elevated hover:bg-monokai-hover text-monokai-accent border border-monokai-border text-[11px] font-medium transition-colors cursor-pointer",title:"读取本地 docs 目录全部讲义与文档并全量导入",children:[e.jsx(ye,{className:"w-3.5 h-3.5"}),e.jsx("span",{children:"载入 docs 目录文档"})]}),e.jsxs("div",{className:"grid grid-cols-2 gap-1",children:[e.jsxs("button",{type:"button",onClick:E,className:"flex items-center justify-center gap-1 py-1 px-1.5 rounded bg-monokai-surface hover:bg-monokai-hover text-monokai-comment hover:text-monokai-fg-muted border border-monokai-border text-[10.5px] transition-colors cursor-pointer",title:"导入本地 Markdown / JSON 知识资产",children:[e.jsx(on,{className:"w-3 h-3 text-sky-400"}),e.jsx("span",{children:"导入 .md"})]}),e.jsxs("button",{type:"button",onClick:R,className:"flex items-center justify-center gap-1 py-1 px-1.5 rounded bg-monokai-surface hover:bg-monokai-hover text-monokai-comment hover:text-monokai-fg-muted border border-monokai-border text-[10.5px] transition-colors cursor-pointer",title:"导出全部知识资产为备份文件",children:[e.jsx(sn,{className:"w-3 h-3 text-emerald-400"}),e.jsx("span",{children:"导出全部"})]})]}),L?e.jsxs("div",{className:"flex items-center justify-between px-2 py-1 bg-monokai-surface border border-monokai-border rounded text-[10px] text-monokai-comment",children:[e.jsxs("span",{className:"truncate",children:["已绑定 ",L]}),e.jsx("button",{type:"button",onClick:p,className:"text-monokai-accent hover:underline shrink-0 ml-1",children:"更换"})]}):p?e.jsxs("button",{type:"button",onClick:p,className:"w-full flex items-center justify-center gap-1 py-1 px-2 rounded bg-transparent hover:bg-monokai-surface text-monokai-comment hover:text-monokai-fg-muted text-[10px] transition-colors cursor-pointer",children:[e.jsx(rn,{className:"w-3 h-3"}),e.jsx("span",{children:"绑定本地 .md 目录"})]}):null]})]})},dt=ee.memo(lt),mt=({asset:n,onTryCode:a})=>{const[t,o]=m.useState(!1),[s,l]=m.useState({}),[c,i]=m.useState(!1),[d,R]=m.useState(null),[E,u]=m.useState(null),[O,D]=m.useState(null),[p,L]=m.useState(!0),x=ee.useRef(null),T=m.useMemo(()=>{const _=/\{\{([a-zA-Z0-9_]+)\}\}/g,S=new Set;let y;for(;(y=_.exec(n.sql))!==null;)S.add(y[1]);const g=new Map((n.params||[]).map(C=>[C.name,C])),N=[];return S.forEach(C=>{const f=g.get(C);N.push({name:C,label:(f==null?void 0:f.label)||C,defaultValue:(f==null?void 0:f.defaultValue)||"",description:f==null?void 0:f.description})}),N},[n.sql,n.params]);m.useEffect(()=>{const _={};T.forEach(S=>{_[S.name]=S.defaultValue}),l(_),R(null),u(null),D(null)},[n.id]);const h=m.useMemo(()=>{let _=n.sql;return T.forEach(S=>{const y=s[S.name]!==void 0?s[S.name]:S.defaultValue,g=new RegExp(`\\{\\{${S.name}\\}\\}`,"g");_=_.replace(g,y)}),_},[n.sql,T,s]),M=async()=>{try{await navigator.clipboard.writeText(h),o(!0),setTimeout(()=>o(!1),2e3)}catch{}},v=()=>{a&&a(h)},V=()=>{const _=Un({...n,sql:h}),S=new Blob([_],{type:"text/markdown;charset=utf-8"}),y=URL.createObjectURL(S),g=document.createElement("a");g.href=y,g.download=`${n.id}.md`,g.click(),URL.revokeObjectURL(y)},w=async()=>{i(!0),u(null),R(null);const _=performance.now();try{const S=h.split(";").map(N=>N.trim()).filter(N=>N.length>0);let y=[];for(const N of S){const C=N.replace(/--.*$/gm,"").trim();if(!C)continue;const f=await En.query(C.endsWith(";")?C:`${C};`);f&&Array.isArray(f)&&(y=f)}const g=Math.round(performance.now()-_);R(y),D(g),requestAnimationFrame(()=>{var N,C;(C=(N=x.current)==null?void 0:N.scrollIntoView)==null||C.call(N,{behavior:"smooth",block:"nearest"})})}catch(S){const y=Math.round(performance.now()-_);D(y);const g=(S==null?void 0:S.message)||String(S);g.includes("No files found that match the pattern")?u(`${g}

💡 提示：该 Parquet 文件路径在当前DuckDB WASM 浏览器虚拟内存中不存在。模板已更新为自包含生成并读取orders_sample.parquet，你可以直接重置参数为默认值或填入有效路径。`):u(g),requestAnimationFrame(()=>{var N,C;(C=(N=x.current)==null?void 0:N.scrollIntoView)==null||C.call(N,{behavior:"smooth",block:"nearest"})})}finally{i(!1)}},I=m.useMemo(()=>!d||d.length===0?[]:Object.keys(d[0]),[d]);return e.jsx("div",{className:"flex-1 flex flex-col h-full overflow-y-auto custom-scrollbar p-4 md:p-6",children:e.jsxs("div",{className:"w-[95%] max-w-[95%] mx-auto space-y-6 pb-12",children:[e.jsxs("div",{children:[e.jsxs("div",{className:"flex items-center gap-2 mb-2",children:[e.jsx("span",{className:"text-xs px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-medium",children:n.category==="template"?"SQL模版":n.category==="script"?"SQL脚本":"代码片段"}),e.jsxs("span",{className:"text-xs text-monokai-comment font-mono",children:["ID: ",n.id]})]}),e.jsx("h1",{className:"text-base font-semibold text-monokai-fg",children:n.title}),n.description&&e.jsx("div",{className:"text-[12.5px] text-monokai-fg-muted mt-1.5 leading-relaxed",children:e.jsx(pe,{content:n.description,onTryCode:a})}),n.tags&&n.tags.length>0&&e.jsx("div",{className:"flex flex-wrap gap-1.5 mt-2.5",children:n.tags.map(_=>e.jsxs("span",{className:"text-[10px] px-2 py-0.5 rounded bg-monokai-elevated text-monokai-comment border border-monokai-border font-mono",children:["#",_]},_))})]}),T.length>0&&e.jsxs("div",{className:"rounded-xl border border-monokai-border bg-monokai-surface overflow-hidden shadow-2xs",children:[e.jsxs("div",{onClick:()=>L(!p),className:"px-4 py-2 bg-monokai-elevated border-b border-monokai-border flex items-center justify-between cursor-pointer select-none",children:[e.jsxs("div",{className:"flex items-center gap-2 text-xs font-medium text-monokai-fg-muted",children:[e.jsx(On,{className:"w-3.5 h-3.5 text-monokai-accent"}),e.jsxs("span",{children:["动态参数填写(",T.length," 个占位符)"]})]}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsxs("button",{type:"button",onClick:_=>{_.stopPropagation();const S={};T.forEach(y=>{S[y.name]=y.defaultValue}),l(S)},title:"重置为默认",className:"text-[11px] text-monokai-comment hover:text-monokai-fg-muted flex items-center gap-1",children:[e.jsx(Be,{className:"w-3 h-3"}),e.jsx("span",{children:"重置"})]}),p?e.jsx(ue,{className:"w-4 h-4 text-monokai-comment"}):e.jsx(he,{className:"w-4 h-4 text-monokai-comment"})]})]}),p&&e.jsx("div",{className:"p-4 grid grid-cols-1 md:grid-cols-2 gap-3.5",children:T.map(_=>e.jsxs("div",{className:"flex flex-col gap-1",children:[e.jsxs("div",{className:"flex items-center justify-between text-xs",children:[e.jsx("label",{className:"text-monokai-fg-muted font-medium",children:_.label}),e.jsx("code",{className:"text-[10px] text-monokai-accent font-mono",children:`{{${_.name}}}`})]}),e.jsx("input",{type:"text",value:s[_.name]??"",onChange:S=>l(y=>({...y,[_.name]:S.target.value})),placeholder:_.defaultValue||`输入 ${_.name}`,className:"w-full bg-monokai-bg border border-monokai-border text-xs text-monokai-fg-muted rounded-md px-3 py-1.5 focus:outline-none focus:border-monokai-accent"}),_.description&&e.jsx("span",{className:"text-[10px] text-monokai-comment",children:_.description})]},_.name))})]}),e.jsxs("div",{className:"rounded-xl border border-monokai-border bg-monokai-bg overflow-hidden shadow-xs",children:[e.jsxs("div",{className:"px-4 py-2 bg-monokai-surface border-b border-monokai-border flex items-center justify-between",children:[e.jsxs("div",{className:"flex items-center gap-2 text-xs text-monokai-comment font-mono",children:[e.jsx(re,{className:"w-3.5 h-3.5 text-emerald-400"}),e.jsx("span",{children:"SQL 执行定义"})]}),e.jsxs("div",{className:"flex items-center gap-1.5",children:[e.jsx("button",{type:"button",onClick:M,className:"flex items-center gap-1 px-2.5 py-1 rounded-md text-xs text-monokai-comment hover:text-monokai-fg-muted hover:bg-monokai-hover transition-colors",children:t?e.jsxs(e.Fragment,{children:[e.jsx(Ae,{className:"w-3.5 h-3.5 text-monokai-accent"}),e.jsx("span",{className:"text-monokai-accent",children:"已复制"})]}):e.jsxs(e.Fragment,{children:[e.jsx(Ce,{className:"w-3.5 h-3.5"}),e.jsx("span",{children:"复制 SQL"})]})}),e.jsxs("button",{type:"button",onClick:V,title:"将此 SQL 片段下载为标准 .md 物理文件",className:"flex items-center gap-1 px-2.5 py-1 rounded-md text-xs text-monokai-comment hover:text-monokai-fg-muted hover:bg-monokai-hover transition-colors",children:[e.jsx(fe,{className:"w-3.5 h-3.5 text-emerald-400"}),e.jsx("span",{children:"保存为 .md"})]}),e.jsxs("button",{type:"button",onClick:v,className:"flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-sky-400 bg-sky-950/40 hover:bg-sky-900/60 border border-sky-800/50 hover:border-sky-700 transition-colors cursor-pointer",title:"将 SQL 自动带入 SQL 编辑器继续编辑执行",children:[e.jsx(ln,{className:"w-3.5 h-3.5"}),e.jsx("span",{children:"发送到 SQL 编辑器"})]}),e.jsxs("button",{type:"button",onClick:w,disabled:c,className:"flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-monokai-accent hover:bg-monokai-accent-hover text-monokai-bg transition-colors disabled:opacity-50 shadow-xs cursor-pointer",title:"直接执行当前 SQL",children:[e.jsx(He,{className:`w-3.5 h-3.5 fill-current ${c?"animate-pulse":""}`}),e.jsx("span",{children:c?"执行中...":"执行 SQL"})]})]})]}),e.jsxs("div",{className:"p-3",children:[e.jsx(Ve,{code:h,language:"sql",allowFormat:!0,showLineNumbers:!0,hideHeader:!0}),e.jsx("pre",{className:"sr-only","aria-hidden":"false",children:h})]})]}),(c||d!==null||E!==null)&&e.jsxs("div",{ref:x,className:"rounded-xl border border-monokai-border bg-monokai-bg overflow-hidden",children:[e.jsxs("div",{className:"px-4 py-2 bg-monokai-elevated border-b border-monokai-border flex items-center justify-between",children:[e.jsxs("div",{className:"flex items-center gap-2 text-xs font-medium text-monokai-fg-muted",children:[e.jsx(dn,{className:"w-3.5 h-3.5 text-monokai-accent"}),e.jsx("span",{children:"执行结果预览"}),O!==null&&e.jsxs("span",{className:"text-[10px] text-monokai-comment flex items-center gap-1 font-mono",children:[e.jsx(mn,{className:"w-3 h-3"}),O," ms"]})]}),d&&e.jsxs("span",{className:"text-[10px] font-mono text-emerald-400",children:[d.length," 行数据返回              "]})]}),e.jsxs("div",{className:"p-3",children:[c&&e.jsxs("div",{className:"py-8 flex flex-col items-center justify-center text-monokai-comment space-y-2",children:[e.jsx(xe,{className:"w-6 h-6 animate-spin text-monokai-accent"}),e.jsx("span",{className:"text-xs",children:"DuckDB WASM 正在计算中..."})]}),E&&e.jsxs("div",{className:"p-3 rounded-lg bg-red-950/40 border border-red-800/40 text-red-300 text-xs flex items-start gap-2",children:[e.jsx(ke,{className:"w-4 h-4 text-red-400 flex-shrink-0 mt-0.5"}),e.jsxs("div",{className:"space-y-1 overflow-x-auto",children:[e.jsx("p",{className:"font-semibold",children:"执行异常："}),e.jsx("pre",{className:"font-mono text-[11px] whitespace-pre-wrap",children:E})]})]}),!c&&!E&&d&&(d.length===0?e.jsx("div",{className:"py-6 text-center text-xs text-monokai-comment",children:"查询执行成功，返回结果集为空 (0 rows)。                "}):e.jsxs("div",{className:"overflow-x-auto max-h-72 custom-scrollbar",children:[e.jsxs("table",{className:"w-full text-left border-collapse text-[11px]",children:[e.jsx("thead",{children:e.jsx("tr",{className:"border-b border-monokai-border bg-monokai-surface",children:I.map(_=>e.jsx("th",{className:"p-2 font-mono text-monokai-comment font-medium",children:_},_))})}),e.jsx("tbody",{className:"divide-y divide-monokai-border/50 font-mono",children:d.slice(0,50).map((_,S)=>e.jsx("tr",{className:"hover:bg-monokai-elevated/80 text-monokai-fg-muted",children:I.map(y=>e.jsx("td",{className:"p-2 whitespace-nowrap",children:_[y]!==null&&_[y]!==void 0?String(_[y]):e.jsx("span",{className:"text-monokai-comment italic",children:"NULL"})},y))},S))})]}),d.length>50&&e.jsx("div",{className:"p-2 text-center text-[10px] text-monokai-comment bg-monokai-surface",children:"仅预览前 50 条记录，完整数据集请投递至 SQL 编辑器执行。                    "})]}))]})]})]})})},Et=({asset:n,onTryCode:a,onNavigateToMetrics:t})=>{var i;const[o,s]=m.useState(!1),l=async()=>{try{await navigator.clipboard.writeText(n.sqlExpression),s(!0),setTimeout(()=>s(!1),2e3)}catch{}},c=()=>{const d=de(n),R=new Blob([d],{type:"text/markdown;charset=utf-8"}),E=URL.createObjectURL(R),u=document.createElement("a");u.href=E,u.download=`${n.id}.md`,u.click(),URL.revokeObjectURL(E)};return e.jsx("div",{className:"flex-1 flex flex-col h-full overflow-y-auto custom-scrollbar p-4 md:p-6",children:e.jsxs("div",{className:"w-[95%] max-w-[95%] mx-auto space-y-5 pb-12",children:[e.jsxs("div",{children:[e.jsxs("div",{className:"flex items-center justify-between mb-2",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsxs("span",{className:"text-[11px] px-2.5 py-0.5 rounded-full bg-sky-950/60 text-sky-400 border border-sky-800/40 font-medium flex items-center gap-1",children:[e.jsx(_e,{className:"w-3 h-3"}),e.jsx("span",{children:"业务指标口径"})]}),n.owner&&e.jsxs("span",{className:"text-[11px] text-monokai-comment flex items-center gap-1",children:[e.jsx(gn,{className:"w-3 h-3 text-monokai-comment"}),e.jsxs("span",{children:["负责 ",n.owner]})]})]}),e.jsxs("div",{className:"flex items-center gap-1.5",children:[e.jsx("button",{type:"button",onClick:l,className:"flex items-center gap-1 px-2.5 py-1 rounded-md text-xs text-monokai-comment hover:text-monokai-fg-muted hover:bg-monokai-hover transition-colors",title:"复制 SQL 表达",children:o?e.jsxs(e.Fragment,{children:[e.jsx(Ae,{className:"w-3.5 h-3.5 text-monokai-accent"}),e.jsx("span",{className:"text-monokai-accent",children:"已复制 SQL"})]}):e.jsxs(e.Fragment,{children:[e.jsx(Ce,{className:"w-3.5 h-3.5"}),e.jsx("span",{children:"复制 SQL"})]})}),e.jsxs("button",{type:"button",onClick:c,title:"将此指标口径导出为标准 .md 物理文件",className:"flex items-center gap-1 px-2.5 py-1 rounded-md text-xs text-monokai-comment hover:text-monokai-fg-muted hover:bg-monokai-hover transition-colors",children:[e.jsx(fe,{className:"w-3.5 h-3.5 text-emerald-400"}),e.jsx("span",{children:"保存为 .md"})]}),t&&e.jsxs("button",{type:"button",onClick:()=>t(n.name),className:"flex items-center gap-1 px-2.5 py-1 rounded-md text-xs text-emerald-400 hover:bg-monokai-hover border border-emerald-800/40 transition-colors",children:[e.jsx(je,{className:"w-3.5 h-3.5"}),e.jsx("span",{children:"联动指标看板"})]})]})]}),e.jsx("h1",{className:"text-base font-semibold text-monokai-fg",children:n.name}),n.tags&&n.tags.length>0&&e.jsx("div",{className:"flex flex-wrap gap-1.5 mt-2.5",children:n.tags.map(d=>e.jsxs("span",{className:"text-[10px] px-2 py-0.5 rounded bg-monokai-elevated text-monokai-comment border border-monokai-border font-mono",children:["#",d]},d))})]}),e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-4",children:[e.jsx("div",{className:"rounded-xl border border-monokai-border bg-monokai-surface p-4 flex flex-col justify-between shadow-2xs",children:e.jsxs("div",{children:[e.jsxs("div",{className:"text-xs font-semibold text-monokai-fg-muted flex items-center gap-1.5 mb-2",children:[e.jsx(ce,{className:"w-3.5 h-3.5 text-sky-400 shrink-0"}),e.jsx("span",{children:"业务定义与统计场"})]}),e.jsx("div",{className:"text-[12.5px] leading-[1.65] text-monokai-fg-muted",children:e.jsx(pe,{content:n.businessMeaning,onTryCode:a})})]})}),e.jsx("div",{className:"rounded-xl border border-monokai-border bg-monokai-surface p-4 flex flex-col justify-between shadow-2xs",children:e.jsxs("div",{children:[e.jsxs("div",{className:"text-xs font-semibold text-monokai-fg-muted flex items-center gap-1.5 mb-2",children:[e.jsx(je,{className:"w-3.5 h-3.5 text-monokai-accent shrink-0"}),e.jsx("span",{children:"计算公式与度量逻辑"})]}),e.jsx("div",{className:"p-2.5 rounded-lg bg-monokai-bg border border-monokai-border font-mono text-[11.5px] text-monokai-accent leading-relaxed",children:n.calculationFormula})]})})]}),e.jsx("div",{className:"rounded-xl border border-monokai-border bg-monokai-surface p-4 space-y-4 shadow-2xs",children:e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-4",children:[e.jsxs("div",{children:[e.jsxs("div",{className:"text-xs font-semibold text-monokai-comment mb-2 flex items-center gap-1.5",children:[e.jsx(xe,{className:"w-3.5 h-3.5 text-monokai-comment"}),e.jsxs("span",{children:["涉及事实/维表 (",((i=n.sourceTables)==null?void 0:i.length)||0,")"]})]}),e.jsx("div",{className:"flex flex-wrap gap-1.5",children:n.sourceTables&&n.sourceTables.length>0?n.sourceTables.map(d=>e.jsx("span",{className:"text-[11px] px-2 py-0.5 rounded-md bg-monokai-bg border border-monokai-border text-monokai-fg-muted font-mono",children:d},d)):e.jsx("span",{className:"text-xs text-monokai-comment",children:"未指定关联表"})})]}),e.jsxs("div",{children:[e.jsxs("div",{className:"text-xs font-semibold text-monokai-comment mb-2 flex items-center gap-1.5",children:[e.jsx(Ie,{className:"w-3.5 h-3.5 text-monokai-comment"}),e.jsx("span",{children:"常用分析维度"})]}),e.jsx("div",{className:"flex flex-wrap gap-1.5",children:n.dimensions&&n.dimensions.length>0?n.dimensions.map(d=>e.jsx("span",{className:"text-[11px] px-2 py-0.5 rounded-md bg-monokai-elevated border border-monokai-border text-emerald-400 font-mono",children:d},d)):e.jsx("span",{className:"text-xs text-monokai-comment",children:"未配置细分维"})})]})]})}),e.jsxs("div",{className:"space-y-1.5",children:[e.jsx("div",{className:"text-xs font-semibold text-monokai-comment flex items-center gap-1.5 px-0.5",children:e.jsx("span",{children:"标准计算 SQL 脚本定义"})}),e.jsx(Ve,{code:n.sqlExpression,language:"sql",title:`${n.name} - 计算定义`,allowFormat:!0,onTryCode:a,initialCollapsed:!1})]})]})})};function pt(n){if(!n)return[];const a=n.split(/\r?\n/),t=[];let o=0,s=0,l=0,c=!1;for(const i of a){const d=i.trim();if(d.startsWith("```")){c=!c;continue}if(c)continue;const R=/^(#{1,3})\s+(.+)$/.exec(d);if(R){const E=R[1].length,O=R[2].trim().replace(/\*\*(.*?)\*\*/g,"$1").replace(/\*(.*?)\*/g,"$1").replace(/`(.*`)`/g,"$1").trim();if(!O)continue;let D="";E===1?(o++,s=0,l=0,D=`${o}.`):E===2?(o===0&&(o=1),s++,l=0,D=`${o}.${s}.`):E===3&&(o===0&&(o=1),s===0&&(s=1),l++,D=`${o}.${s}.${l}.`);const p=O.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g,"-").replace(/^-+|-+$/g,"")||"section";t.push({id:p,text:O,level:E,sectionNumber:D})}}return t}const _t=({content:n,className:a="",floating:t=!0})=>{const[o,s]=m.useState(!0),[l,c]=m.useState(!1),[i,d]=m.useState(!1),[R,E]=m.useState(""),u=m.useMemo(()=>pt(n),[n]);if(m.useEffect(()=>{if(u.length===0||typeof window>"u"||!("IntersectionObserver"in window))return;const p=new IntersectionObserver(L=>{L.forEach(x=>{x.isIntersecting&&E(x.target.id)})},{rootMargin:"-80px 0px -60% 0px",threshold:.1});return u.forEach(L=>{const x=document.getElementById(L.id);x&&p.observe(x)}),()=>p.disconnect()},[u]),u.length<2)return null;const O=(p,L)=>{p.preventDefault(),E(L);const x=document.getElementById(L);x&&(x.scrollIntoView({behavior:"smooth",block:"start"}),history.replaceState(null,"",`#${L}`))},D=e.jsxs("nav",{"aria-label":"Table of contents",className:`rounded-xl border border-monokai-border bg-monokai-surface/98 backdrop-blur-xl overflow-hidden text-xs shadow-2xl transition-all ${t?"w-72 sm:w-80 max-w-[calc(100vw-40px)]":"w-full"} ${a}`,children:[e.jsxs("div",{className:"w-full flex items-center justify-between px-3.5 py-2.5 bg-monokai-surface border-b border-monokai-border/60 select-none",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(ve,{className:"w-3.5 h-3.5 text-monokai-accent"}),e.jsx("span",{className:"font-bold text-monokai-fg-muted tracking-wider uppercase font-mono text-[11px]",children:"TABLE OF CONTENTS"}),e.jsx("span",{className:"text-[10px] text-monokai-accent font-mono px-1.5 py-0.2 rounded bg-monokai-elevated border border-monokai-border",children:u.length})]}),e.jsxs("div",{className:"flex items-center gap-2",children:[t&&e.jsx("button",{type:"button",onClick:()=>d(p=>!p),className:`text-[10px] font-mono px-1.5 py-0.5 rounded transition-colors cursor-pointer ${i?"bg-monokai-elevated text-monokai-accent border border-monokai-accent/40":"text-monokai-comment hover:text-monokai-fg-muted"}`,title:i?"已固定常驻(点击取消固定)":"点击固定常驻",children:i?"已固定":"固定"}),e.jsxs("button",{type:"button",onClick:()=>s(p=>!p),className:"flex items-center gap-1 text-[11px] text-monokai-comment hover:text-monokai-fg-muted cursor-pointer",children:[e.jsx("span",{children:o?"收起":"展开"}),o?e.jsx(ue,{className:"w-3.5 h-3.5 text-monokai-comment"}):e.jsx(he,{className:"w-3.5 h-3.5 text-monokai-comment"})]})]})]}),o&&e.jsx("div",{className:"px-3.5 py-3 max-h-[calc(100vh-220px)] overflow-y-auto custom-scrollbar",children:e.jsx("ul",{className:"space-y-1 font-sans",children:u.map((p,L)=>{const x=R===p.id,T=p.level===1?"pl-0 font-medium":p.level===2?"pl-3.5 text-[11.5px]":"pl-6 text-[11px]";return e.jsxs("li",{className:`${T} flex items-baseline gap-1.5 py-1 px-1.5 rounded transition-all group/item ${x?"bg-monokai-elevated text-monokai-accent font-semibold border-l-2 border-monokai-accent":"text-monokai-comment hover:text-monokai-fg-muted hover:bg-monokai-surface"}`,children:[e.jsx("span",{className:`font-mono text-[10px] shrink-0 select-none ${x?"text-monokai-accent":"text-monokai-comment group-hover/item:text-monokai-comment"}`,children:p.sectionNumber}),e.jsx("a",{href:`#${p.id}`,onClick:h=>O(h,p.id),className:"truncate flex-1",title:p.text,children:p.text})]},`${p.id}-${L}`)})})})]});return t?e.jsxs("div",{"data-testid":"floating-toc-dock",className:"fixed right-0 top-24 sm:top-28 z-40 flex items-start select-none",onMouseEnter:()=>c(!0),onMouseLeave:()=>c(!1),children:[e.jsx("div",{className:`absolute right-full top-0 pr-1.5 transition-all duration-300 ease-out origin-top-right ${l||i?"opacity-100 translate-x-0 scale-100 pointer-events-auto visible shadow-2xl":"opacity-0 translate-x-6 scale-95 pointer-events-none invisible"}`,children:D}),e.jsxs("button",{type:"button",onClick:()=>d(p=>!p),title:i?"点击取消固定目录":"鼠标移上展开目录，点击可固定 (TOC)","aria-label":"文章目录大纲",className:`flex flex-col items-center justify-center gap-1.5 py-3 px-1 rounded-l-md border-l border-y shadow-lg cursor-pointer transition-all ${l||i?"bg-monokai-elevated text-monokai-accent border-monokai-accent/80 shadow-monokai-accent/15":"bg-monokai-surface/90 hover:bg-monokai-elevated text-monokai-comment hover:text-monokai-accent border-monokai-border"}`,children:[e.jsx(ve,{className:"w-3.5 h-3.5 text-monokai-accent"}),e.jsx("span",{className:"text-[9.5px] font-mono font-bold tracking-widest uppercase text-monokai-fg-muted group-hover:text-monokai-accent",style:{writingMode:"vertical-rl"},children:"TOC"}),e.jsx(pn,{className:`w-3 h-3 text-monokai-comment transition-transform ${l||i?"rotate-180 text-monokai-accent":""}`})]})]}):D},Tt=ee.memo(_t),ut=({asset:n,onTryCode:a,onSendToEditor:t,onUpdateNoteContent:o})=>{const[s,l]=m.useState(!1),[c,i]=m.useState(!1),[d,R]=m.useState(n.content),[E,u]=m.useState("source"),[O,D]=m.useState(!0),[p,L]=m.useState(!1),[x,T]=m.useState(null),[h,M]=m.useState(null),v=m.useMemo(()=>Hn(n.content),[n.content]);m.useEffect(()=>{R(n.content),i(!1),D(!0),L(!1),T(null),M(null)},[n.id,n.content]);const V=async()=>{try{await navigator.clipboard.writeText(n.content),l(!0),setTimeout(()=>l(!1),2e3)}catch{}},w=()=>{const N=de({...n,content:d}),C=new Blob([N],{type:"text/markdown;charset=utf-8"}),f=URL.createObjectURL(C),q=document.createElement("a");q.href=f,q.download=`${n.id}.md`,q.click(),URL.revokeObjectURL(f)},I=()=>{o&&o(d),i(!1)},_=()=>{D(N=>!N)},S=()=>{if(p||v.length===0)return;L(!0),M(null),D(!1);const N=v.length,C=performance.now();U.info(`开始一键运行文档中全部 ${N} 个 SQL 片段...`),window.dispatchEvent(new CustomEvent("duckdb_run_all_sql_blocks",{detail:{assetId:n.id}})),setTimeout(()=>{const f=Math.round(performance.now()-C);L(!1),T(null),M({total:N,duration:f,failedCount:0}),U.success(`全部 ${N} 个 SQL 片段执行完成 (耗时 ${f}ms)`)},300)},g=(N=>{switch(N){case"pitfall":return{label:"避坑指南",cls:"bg-red-950/60 text-red-400 border-red-800/40"};case"optimization":return{label:"性能优化",cls:"bg-emerald-950/60 text-emerald-400 border-emerald-800/40"};case"best_practice":return{label:"最佳实践",cls:"bg-blue-950/60 text-blue-400 border-blue-800/40"};default:return{label:"经验备忘",cls:"bg-amber-950/60 text-amber-400 border-amber-800/40"}}})(n.topic);return e.jsx("div",{className:"flex-1 flex flex-col h-full overflow-y-auto custom-scrollbar p-4 md:p-6",id:"note-reading-container",children:e.jsxs("div",{className:"w-[95%] max-w-[95%] mx-auto space-y-5 pb-12",children:[e.jsxs("div",{children:[e.jsxs("div",{className:"flex items-center justify-between mb-2 flex-wrap gap-2",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsxs("span",{className:`text-[11px] px-2.5 py-0.5 rounded-full border font-medium flex items-center gap-1 ${g.cls}`,children:[e.jsx(Te,{className:"w-3 h-3"}),e.jsx("span",{children:g.label})]}),e.jsxs("span",{className:"text-[11px] text-monokai-comment font-mono",children:["ID: ",n.id]})]}),e.jsxs("div",{className:"flex items-center gap-1.5 flex-wrap",children:[v.length>0&&!c&&e.jsx("button",{type:"button",onClick:S,disabled:p,className:"flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-monokai-accent text-monokai-bg hover:bg-monokai-accent-hover active:bg-monokai-accent disabled:opacity-50 transition-all shadow-xs cursor-pointer",title:`一键依次执行正文中全部 ${v.length} 个 SQL 片段`,children:p?e.jsxs(e.Fragment,{children:[e.jsx(We,{className:"w-3.5 h-3.5 animate-spin"}),e.jsxs("span",{children:["运行中(",(x==null?void 0:x.current)||0,"/",v.length,")..."]})]}):e.jsxs(e.Fragment,{children:[e.jsx(He,{className:"w-3.5 h-3.5 fill-current"}),e.jsxs("span",{children:["一键全部运行 (",v.length,")"]})]})}),!c&&e.jsx("button",{type:"button",onClick:_,className:"flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-monokai-fg-muted hover:text-monokai-fg bg-monokai-elevated hover:bg-monokai-hover border border-monokai-border transition-colors cursor-pointer",title:O?"展开文章中所有代码块":"折叠文章中所有代码块",children:O?e.jsxs(e.Fragment,{children:[e.jsx(ue,{className:"w-3.5 h-3.5 text-monokai-accent"}),e.jsx("span",{children:"一键展开代码"})]}):e.jsxs(e.Fragment,{children:[e.jsx(_n,{className:"w-3.5 h-3.5 text-monokai-accent"}),e.jsx("span",{children:"一键折叠全部代码块"})]})}),e.jsx("button",{type:"button",onClick:V,className:"flex items-center gap-1 px-2.5 py-1 rounded-md text-xs text-monokai-comment hover:text-monokai-fg-muted hover:bg-monokai-hover transition-colors cursor-pointer",title:"复制 Markdown 原文",children:s?e.jsxs(e.Fragment,{children:[e.jsx(Ae,{className:"w-3.5 h-3.5 text-monokai-accent"}),e.jsx("span",{className:"text-monokai-accent",children:"已复制"})]}):e.jsxs(e.Fragment,{children:[e.jsx(Ce,{className:"w-3.5 h-3.5"}),e.jsx("span",{children:"复制 Markdown"})]})}),e.jsxs("button",{type:"button",onClick:w,title:"将此笔记导出为本地标准 .md 物理文件",className:"flex items-center gap-1 px-2.5 py-1 rounded-md text-xs text-monokai-comment hover:text-monokai-fg-muted hover:bg-monokai-hover transition-colors cursor-pointer",children:[e.jsx(fe,{className:"w-3.5 h-3.5 text-emerald-400"}),e.jsx("span",{children:"保存为 .md"})]}),c?e.jsxs("div",{className:"flex items-center gap-1.5",children:[e.jsxs("button",{type:"button",onClick:()=>{R(n.content),i(!1)},className:"flex items-center gap-1 px-2.5 py-1 rounded-md text-xs text-monokai-comment hover:bg-monokai-hover cursor-pointer",children:[e.jsx(Be,{className:"w-3 h-3"}),e.jsx("span",{children:"取消"})]}),e.jsxs("button",{type:"button",onClick:I,className:"flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-monokai-accent text-monokai-bg hover:bg-monokai-accent-hover shadow-xs cursor-pointer",children:[e.jsx(qe,{className:"w-3.5 h-3.5"}),e.jsx("span",{children:"保存笔记"})]})]}):e.jsxs("button",{type:"button",onClick:()=>i(!0),className:"flex items-center gap-1 px-2.5 py-1 rounded-md text-xs text-monokai-fg-muted hover:text-monokai-fg hover:bg-monokai-hover border border-monokai-border transition-colors cursor-pointer",children:[e.jsx(Je,{className:"w-3.5 h-3.5 text-monokai-accent"}),e.jsx("span",{children:"在线编辑"})]})]})]}),e.jsx("h1",{className:"text-base font-semibold text-monokai-fg",children:n.title}),h&&e.jsxs("div",{className:"mt-2.5 rounded-lg border border-monokai-border bg-monokai-surface px-3.5 py-2 text-xs flex items-center justify-between text-monokai-fg-muted shadow-xs",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[h.failedCount===0?e.jsx(Tn,{className:"w-4 h-4 text-monokai-accent shrink-0"}):e.jsx(ke,{className:"w-4 h-4 text-amber-400 shrink-0"}),e.jsxs("span",{children:["已全部运行 ",h.total," 个 SQL 片段：                  ",e.jsxs("strong",{className:"text-monokai-accent ml-1",children:[h.total-h.failedCount," 成功"]}),h.failedCount>0&&e.jsxs("span",{className:"text-red-400 ml-1",children:["(",h.failedCount," 异常)"]}),e.jsxs("span",{className:"text-monokai-comment font-mono ml-2",children:["总耗时 ",h.duration," ms"]})]})]}),e.jsx("button",{type:"button",onClick:()=>M(null),className:"text-monokai-comment hover:text-monokai-fg-muted text-xs p-1 cursor-pointer",title:"关闭提示",children:e.jsx(Pe,{className:"w-3.5 h-3.5"})})]}),n.summary&&e.jsxs("div",{className:"mt-2.5 p-3 rounded-lg bg-monokai-surface border border-monokai-border text-xs text-monokai-fg-muted leading-relaxed flex items-start gap-2 shadow-2xs",children:[e.jsx(ce,{className:"w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5"}),e.jsxs("div",{className:"text-[12px]",children:[e.jsx("span",{className:"font-semibold text-monokai-fg-muted mr-1.5",children:"核心结论："}),e.jsx("span",{className:"text-monokai-fg-muted",children:n.summary})]})]}),n.tags&&n.tags.length>0&&e.jsx("div",{className:"flex flex-wrap gap-1.5 mt-2.5",children:n.tags.map(N=>e.jsxs("span",{className:"text-[10px] px-2 py-0.5 rounded bg-monokai-elevated text-monokai-comment border border-monokai-border font-mono flex items-center gap-1",children:[e.jsx(Ge,{className:"w-2.5 h-2.5 text-monokai-comment"}),N]},N))})]}),c?e.jsxs("div",{className:"rounded-xl border border-monokai-border bg-monokai-bg overflow-hidden min-h-[460px] flex flex-col shadow-xs",children:[e.jsxs("div",{className:"px-4 py-2 bg-monokai-surface border-b border-monokai-border flex items-center justify-between text-xs text-monokai-comment font-mono",children:[e.jsx("span",{children:"Markdown 源码编辑"}),e.jsxs("div",{className:"flex items-center gap-1 text-[11px]",children:[e.jsxs("button",{type:"button",onClick:()=>u("source"),className:`px-2 py-0.5 rounded ${E==="source"?"bg-monokai-hover text-monokai-accent":"text-monokai-comment hover:text-monokai-fg-muted"}`,children:[e.jsx(un,{className:"w-3 h-3 inline mr-1"}),"源码"]}),e.jsx("button",{type:"button",onClick:()=>u("split"),className:`px-2 py-0.5 rounded ${E==="split"?"bg-monokai-hover text-monokai-accent":"text-monokai-comment hover:text-monokai-fg-muted"}`,children:"分栏"}),e.jsxs("button",{type:"button",onClick:()=>u("preview"),className:`px-2 py-0.5 rounded ${E==="preview"?"bg-monokai-hover text-monokai-accent":"text-monokai-comment hover:text-monokai-fg-muted"}`,children:[e.jsx(An,{className:"w-3 h-3 inline mr-1"}),"预览"]})]})]}),e.jsx("div",{className:"p-6 flex-1",children:e.jsxs("div",{className:`h-full min-h-[420px] ${E==="split"?"grid grid-cols-2 gap-4":""}`,children:[(E==="source"||E==="split")&&e.jsx("textarea",{value:d,onChange:N=>R(N.target.value),className:"w-full h-full min-h-[420px] bg-transparent text-monokai-fg-muted text-xs font-mono resize-none focus:outline-none leading-relaxed p-3 rounded border border-monokai-border/60 focus:border-monokai-accent",placeholder:"在此书写 Markdown 笔记..."}),(E==="preview"||E==="split")&&e.jsx("div",{className:"h-full min-h-[420px] overflow-y-auto custom-scrollbar p-3 rounded bg-monokai-surface/50 border border-monokai-border/40",children:e.jsx(pe,{content:d,onTryCode:a})})]})})]}):e.jsxs("div",{className:"relative w-full space-y-6",children:[e.jsxs("div",{className:"rounded-xl border border-monokai-border bg-monokai-bg overflow-hidden shadow-xs",children:[e.jsxs("div",{className:"px-4 py-2 bg-monokai-surface border-b border-monokai-border flex items-center justify-between text-xs text-monokai-comment font-mono",children:[e.jsx("span",{children:"知识笔记正文"}),e.jsx("span",{className:"text-[10.5px] text-monokai-comment",children:"支持代码高亮与公式格式化"})]}),e.jsx("div",{className:"p-5 sm:p-6",children:e.jsx(pe,{content:n.content,onTryCode:a,onSendToEditor:t||a,collapseAll:O})})]}),n.references&&n.references.length>0&&e.jsxs("div",{className:"rounded-xl border border-monokai-border bg-monokai-surface p-3.5",children:[e.jsxs("div",{className:"text-xs font-semibold text-monokai-comment mb-2 flex items-center gap-1.5",children:[e.jsx(Nn,{className:"w-3.5 h-3.5 text-monokai-comment"}),e.jsx("span",{children:"延伸阅读与参考依据"})]}),e.jsx("div",{className:"flex flex-col gap-1",children:n.references.map((N,C)=>e.jsx("a",{href:N.startsWith("http")?N:void 0,target:"_blank",rel:"noreferrer",className:"text-[12px] text-monokai-accent hover:underline flex items-center gap-1 truncate",children:e.jsxs("span",{children:["→ ",N]})},C))})]}),e.jsx(Tt,{content:n.content})]})]})})},At=ee.memo(ut),Nt=({asset:n,isSidebarCollapsed:a,onToggleSidebar:t,onTryCode:o,onNavigateToMetrics:s,onToggleFavorite:l,onEditAsset:c,onDeleteAsset:i,onUpdateNoteContent:d,onOpenAiAssistant:R})=>n?e.jsxs("div",{className:"flex-1 flex flex-col h-full bg-monokai-bg overflow-hidden",children:[e.jsxs("div",{className:"px-6 py-2.5 border-b border-monokai-border bg-monokai-surface flex items-center justify-between",children:[e.jsxs("div",{className:"flex items-center gap-2.5 text-xs text-monokai-comment min-w-0",children:[a&&t&&e.jsxs("button",{type:"button",onClick:t,title:"展开知识文献库侧边栏 (Ctrl+B)","aria-label":"展开知识文献库侧边栏",className:"flex items-center gap-1.5 px-2 py-1 -ml-2 mr-1 rounded bg-monokai-elevated hover:bg-monokai-hover text-monokai-accent text-[11px] font-medium border border-monokai-border transition-colors cursor-pointer shrink-0",children:[e.jsx(Me,{className:"w-3.5 h-3.5"}),e.jsx("span",{className:"hidden sm:inline",children:"展开侧边"})]}),e.jsx("span",{className:"font-mono px-2 py-0.5 rounded bg-monokai-elevated text-monokai-accent border border-monokai-border text-[10.5px] font-semibold shrink-0",children:n.type==="code"?"SQL":n.type==="note"?"DOC":"METRIC"}),e.jsx("span",{className:"text-monokai-comment",children:"/"}),e.jsx("span",{className:"text-monokai-fg-muted font-semibold truncate max-w-md",children:n.type==="metric"?n.name:n.title}),e.jsx("span",{className:"text-monokai-comment hidden sm:inline",children:"·"}),e.jsxs("span",{className:"text-monokai-comment font-mono text-[10.5px] hidden sm:inline",children:["更新→ ",n.updatedAt.slice(0,10)]})]}),e.jsxs("div",{className:"flex items-center gap-1.5 shrink-0",children:[R&&e.jsxs("button",{type:"button",onClick:()=>R(n),title:"使用 AI 提炼/润色此项资产",className:"flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-monokai-accent bg-monokai-elevated hover:bg-monokai-border border border-monokai-border transition-colors cursor-pointer",children:[e.jsx(ce,{className:"w-3.5 h-3.5"}),e.jsx("span",{children:"AI 润色"})]}),e.jsx("button",{type:"button",onClick:()=>l(n.id),title:n.isFavorite?"取消收藏":"加入收藏",className:`p-1.5 rounded-md hover:bg-monokai-elevated transition-colors cursor-pointer ${n.isFavorite?"text-yellow-400":"text-monokai-comment hover:text-monokai-fg-muted"}`,children:e.jsx(Sn,{className:`w-4 h-4 ${n.isFavorite?"fill-yellow-400":""}`})}),e.jsx("button",{type:"button",onClick:()=>c(n),title:"编辑资产属",className:"p-1.5 rounded-md text-monokai-comment hover:text-monokai-fg-muted hover:bg-monokai-elevated transition-colors cursor-pointer",children:e.jsx(Je,{className:"w-4 h-4"})}),e.jsx("button",{type:"button",onClick:()=>i(n.id),title:"删除资产",className:"p-1.5 rounded-md text-monokai-comment hover:text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer",children:e.jsx(Rn,{className:"w-4 h-4"})})]})]}),e.jsxs("div",{className:"flex-1 overflow-hidden flex flex-col",children:[n.type==="code"&&e.jsx(mt,{asset:n,onTryCode:o}),n.type==="metric"&&e.jsx(Et,{asset:n,onTryCode:o,onNavigateToMetrics:s}),n.type==="note"&&e.jsx(At,{asset:n,onTryCode:o,onSendToEditor:o,onUpdateNoteContent:E=>d&&d(n.id,E)})]})]}):e.jsxs("div",{className:"flex-1 flex flex-col items-center justify-center h-full bg-monokai-bg p-8 text-center text-monokai-comment relative",children:[a&&t&&e.jsxs("button",{type:"button",onClick:t,title:"展开知识文献库侧边栏 (Ctrl+B)","aria-label":"展开知识文献库侧边栏",className:"absolute top-3 left-4 flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-monokai-accent bg-monokai-elevated hover:bg-monokai-hover border border-monokai-border transition-colors cursor-pointer",children:[e.jsx(Me,{className:"w-3.5 h-3.5"}),e.jsx("span",{children:"展开侧边"})]}),e.jsx("div",{className:"w-16 h-16 rounded-2xl bg-monokai-elevated border border-monokai-border flex items-center justify-center mb-4 text-monokai-comment",children:e.jsx(Ie,{className:"w-8 h-8"})}),e.jsx("h3",{className:"text-sm font-semibold text-monokai-fg-muted",children:"请选择一项知识资"}),e.jsx("p",{className:"text-xs text-monokai-comment mt-1 max-w-sm",children:"在左侧列表浏览或搜索，点击任将 SQL 片段、业务口径或知识笔记查看详情并进行实战操作        "})]}),St=ee.memo(Nt),Rt=({isOpen:n,onClose:a,assetToEdit:t,defaultType:o="code",onSave:s})=>{const[l,c]=m.useState(o),[i,d]=m.useState(""),[R,E]=m.useState(""),[u,O]=m.useState(""),[D,p]=m.useState("snippet"),[L,x]=m.useState(""),[T,h]=m.useState(""),[M,v]=m.useState(""),[V,w]=m.useState(""),[I,_]=m.useState(""),[S,y]=m.useState(""),[g,N]=m.useState(""),[C,f]=m.useState(""),[q,X]=m.useState(""),[J,$]=m.useState(""),[K,z]=m.useState("pitfall"),[me,te]=m.useState(""),[ae,oe]=m.useState(""),[Ee,r]=m.useState("");if(m.useEffect(()=>{t?(c(t.type),d(t.id),E((t.tags||[]).join(", ")),t.type==="code"?(O(t.title),p(t.category),x(t.description),h(t.sql)):t.type==="metric"?(v(t.name),w(t.businessMeaning),_(t.calculationFormula),y(t.sqlExpression),N((t.sourceTables||[]).join(", ")),f((t.dimensions||[]).join(", ")),X(t.owner||"")):t.type==="note"&&($(t.title),z(t.topic),te(t.summary),oe(t.content),r((t.references||[]).join(", ")))):(c(o),d(`asset-${Date.now()}`),E(""),O(""),p("snippet"),x(""),h(""),v(""),w(""),_(""),y(""),N(""),f(""),X(""),$(""),z("pitfall"),te(""),oe(""),r(""))},[t,o,n]),!n)return null;const b=A=>A.split(/[,\n]/).map(P=>P.trim()).filter(Boolean),j=A=>{A.preventDefault();const P=b(R),G=new Date().toISOString();if(l==="code"){if(!u.trim()||!T.trim())return;const Y={id:i||`code-${Date.now()}`,type:"code",title:u.trim(),category:D,description:L.trim(),sql:T.trim(),tags:P,isFavorite:(t==null?void 0:t.isFavorite)||!1,createdAt:(t==null?void 0:t.createdAt)||G,updatedAt:G};s(Y)}else if(l==="metric"){if(!M.trim()||!I.trim())return;const Y={id:i||`metric-${Date.now()}`,type:"metric",name:M.trim(),businessMeaning:V.trim(),calculationFormula:I.trim(),sqlExpression:S.trim(),sourceTables:b(g),dimensions:b(C),owner:q.trim(),tags:P,isFavorite:(t==null?void 0:t.isFavorite)||!1,createdAt:(t==null?void 0:t.createdAt)||G,updatedAt:G};s(Y)}else if(l==="note"){if(!J.trim()||!ae.trim())return;const Y={id:i||`note-${Date.now()}`,type:"note",title:J.trim(),topic:K,summary:me.trim(),content:ae.trim(),references:b(Ee),tags:P,isFavorite:(t==null?void 0:t.isFavorite)||!1,createdAt:(t==null?void 0:t.createdAt)||G,updatedAt:G};s(Y)}a()},k=l==="metric"?_e:l==="note"?Te:re;return e.jsx(Ye,{open:n,onClose:a,title:t?"编辑知识资产":"创建新知识资产",description:"沉淀到本地统一知识资产库 (IndexedDB)，随时复用",size:"lg",icon:k,iconColor:"text-monokai-accent",children:e.jsxs("form",{onSubmit:j,className:"space-y-4",children:[!t&&e.jsxs("div",{className:"flex items-center gap-2 p-1 bg-monokai-bg rounded-xl border border-monokai-border",children:[e.jsxs("button",{type:"button",onClick:()=>c("code"),className:`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${l==="code"?"bg-monokai-border text-monokai-accent shadow":"text-monokai-comment hover:text-monokai-fg-muted"}`,children:[e.jsx(re,{className:"w-3.5 h-3.5"}),e.jsx("span",{children:"代码资产"})]}),e.jsxs("button",{type:"button",onClick:()=>c("metric"),className:`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${l==="metric"?"bg-monokai-border text-monokai-cyan shadow":"text-monokai-comment hover:text-monokai-fg-muted"}`,children:[e.jsx(_e,{className:"w-3.5 h-3.5"}),e.jsx("span",{children:"指标资产"})]}),e.jsxs("button",{type:"button",onClick:()=>c("note"),className:`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${l==="note"?"bg-monokai-border text-monokai-yellow shadow":"text-monokai-comment hover:text-monokai-fg-muted"}`,children:[e.jsx(Te,{className:"w-3.5 h-3.5"}),e.jsx("span",{children:"知识笔记"})]})]}),l==="code"&&e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-3 gap-3",children:[e.jsxs("div",{className:"md:col-span-2",children:[e.jsxs("label",{className:"block text-xs text-monokai-fg-muted font-medium mb-1",children:["标题 ",e.jsx("span",{className:"text-red-400",children:"*"})]}),e.jsx("input",{type:"text",required:!0,value:u,onChange:A=>O(A.target.value),placeholder:"例如：Parquet 高效过滤与分页查询",className:"w-full bg-monokai-bg border border-monokai-border rounded-lg px-3 py-1.5 text-xs text-monokai-fg-muted focus:outline-none focus:border-monokai-accent"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"block text-xs text-monokai-fg-muted font-medium mb-1",children:"分类"}),e.jsxs("select",{value:D,onChange:A=>p(A.target.value),className:"w-full bg-monokai-bg border border-monokai-border rounded-lg px-3 py-1.5 text-xs text-monokai-fg-muted focus:outline-none focus:border-monokai-accent",children:[e.jsx("option",{value:"snippet",children:"代码片段"}),e.jsx("option",{value:"template",children:"SQL 模板"}),e.jsx("option",{value:"script",children:"多步脚本"})]})]})]}),e.jsxs("div",{children:[e.jsx("label",{className:"block text-xs text-monokai-fg-muted font-medium mb-1",children:"简要说明"}),e.jsx("input",{type:"text",value:L,onChange:A=>x(A.target.value),placeholder:"例如：用于快速抽样 Parquet 元数据与分布的 SQL 模板...",className:"w-full bg-monokai-bg border border-monokai-border rounded-lg px-3 py-1.5 text-xs text-monokai-fg-muted focus:outline-none focus:border-monokai-accent"})]}),e.jsxs("div",{children:[e.jsxs("div",{className:"flex items-center justify-between mb-1",children:[e.jsxs("label",{className:"text-xs text-monokai-fg-muted font-medium",children:["SQL 正文 / 模板定义 ",e.jsx("span",{className:"text-red-400",children:"*"})]}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsxs("span",{className:"text-[10px] text-monokai-comment font-mono",children:["支持参数化占位符 ","{{param_name}}"]}),T.trim()&&e.jsxs("button",{type:"button",onClick:()=>{try{h(Ue(T,{language:"duckdb",tabWidth:2,keywordCase:"upper"}))}catch{}},className:"flex items-center gap-1 text-[10.5px] text-monokai-accent hover:text-monokai-accent-hover px-1.5 py-0.5 rounded bg-monokai-elevated border border-monokai-border",children:[e.jsx(Sparkles,{className:"w-2.5 h-2.5"}),e.jsx("span",{children:"格式化 SQL"})]})]})]}),e.jsx("textarea",{required:!0,rows:8,value:T,onChange:A=>h(A.target.value),placeholder:"SELECT * FROM {{table_name}} WHERE event_date >= '{{start_date}}';",className:"w-full bg-monokai-bg border border-monokai-border rounded-md p-3 text-xs text-monokai-fg-muted font-mono focus:outline-none focus:border-monokai-accent resize-none leading-relaxed"})]})]}),l==="metric"&&e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-3",children:[e.jsxs("div",{children:[e.jsxs("label",{className:"block text-xs text-monokai-fg-muted font-medium mb-1",children:["指标名称 ",e.jsx("span",{className:"text-red-400",children:"*"})]}),e.jsx("input",{type:"text",required:!0,value:M,onChange:A=>v(A.target.value),placeholder:"例如：GMV (含退款口径)",className:"w-full bg-monokai-bg border border-monokai-border rounded-lg px-3 py-1.5 text-xs text-monokai-fg-muted focus:outline-none focus:border-monokai-accent"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"block text-xs text-monokai-fg-muted font-medium mb-1",children:"负责人 / Owner"}),e.jsx("input",{type:"text",value:q,onChange:A=>X(A.target.value),placeholder:"输入内容",className:"w-full bg-monokai-bg border border-monokai-border rounded-lg px-3 py-1.5 text-xs text-monokai-fg-muted focus:outline-none focus:border-monokai-accent"})]})]}),e.jsxs("div",{children:[e.jsxs("label",{className:"block text-xs text-monokai-fg-muted font-medium mb-1",children:["计算公式 ",e.jsx("span",{className:"text-red-400",children:"*"})]}),e.jsx("input",{type:"text",required:!0,value:I,onChange:A=>_(A.target.value),placeholder:"例如：SUM(pay_amount) - SUM(refund_amount)",className:"w-full bg-monokai-bg border border-monokai-border rounded-lg px-3 py-1.5 text-xs text-monokai-fg-muted focus:outline-none focus:border-monokai-accent"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"block text-xs text-monokai-fg-muted font-medium mb-1",children:"业务含义"}),e.jsx("textarea",{rows:2,value:V,onChange:A=>w(A.target.value),placeholder:"说明该指标的业务口径、适用范围与注意事项...",className:"w-full bg-monokai-bg border border-monokai-border rounded-lg p-2 text-xs text-monokai-fg-muted focus:outline-none focus:border-monokai-accent resize-none"})]}),e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-3",children:[e.jsxs("div",{children:[e.jsx("label",{className:"block text-xs text-monokai-fg-muted font-medium mb-1",children:"()"}),e.jsx("input",{type:"text",value:g,onChange:A=>N(A.target.value),placeholder:"fact_orders, dim_product",className:"w-full bg-monokai-bg border border-monokai-border rounded-lg px-3 py-1.5 text-xs text-monokai-fg-muted focus:outline-none focus:border-monokai-accent"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"block text-xs text-monokai-fg-muted font-medium mb-1",children:"常用分析维度 (逗号分隔)"}),e.jsx("input",{type:"text",value:C,onChange:A=>f(A.target.value),placeholder:"日期, 渠道, 品类",className:"w-full bg-monokai-bg border border-monokai-border rounded-lg px-3 py-1.5 text-xs text-monokai-fg-muted focus:outline-none focus:border-monokai-accent"})]})]}),e.jsxs("div",{children:[e.jsxs("div",{className:"flex items-center justify-between mb-1",children:[e.jsx("label",{className:"text-xs text-monokai-fg-muted font-medium",children:"可执行参考 SQL"}),S.trim()&&e.jsxs("button",{type:"button",onClick:()=>{try{y(Ue(S,{language:"duckdb",tabWidth:2,keywordCase:"upper"}))}catch{}},className:"flex items-center gap-1 text-[10.5px] text-monokai-accent hover:text-monokai-accent-hover px-1.5 py-0.5 rounded bg-monokai-elevated border border-monokai-border",children:[e.jsx(Sparkles,{className:"w-2.5 h-2.5"}),e.jsx("span",{children:"格式化 SQL"})]})]}),e.jsx("textarea",{rows:5,value:S,onChange:A=>y(A.target.value),placeholder:"SELECT date_trunc('day', pay_time), sum(amount) FROM fact_orders GROUP BY 1;",className:"w-full bg-monokai-bg border border-monokai-border rounded-md p-3 text-xs text-monokai-fg-muted font-mono focus:outline-none focus:border-monokai-accent resize-none leading-relaxed"})]})]}),l==="note"&&e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-3 gap-3",children:[e.jsxs("div",{className:"md:col-span-2",children:[e.jsxs("label",{className:"block text-xs text-monokai-fg-muted font-medium mb-1",children:["笔记标题 ",e.jsx("span",{className:"text-red-400",children:"*"})]}),e.jsx("input",{type:"text",required:!0,value:J,onChange:A=>$(A.target.value),placeholder:"例如：DuckDB WASM 时区解析陷阱与规避方案",className:"w-full bg-monokai-bg border border-monokai-border rounded-lg px-3 py-1.5 text-xs text-monokai-fg-muted focus:outline-none focus:border-monokai-accent"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"block text-xs text-monokai-fg-muted font-medium mb-1",children:"专题分类"}),e.jsxs("select",{value:K,onChange:A=>z(A.target.value),className:"w-full bg-monokai-bg border border-monokai-border rounded-lg px-3 py-1.5 text-xs text-monokai-fg-muted focus:outline-none focus:border-monokai-accent",children:[e.jsx("option",{value:"pitfall",children:"踩坑记录"}),e.jsx("option",{value:"optimization",children:"优化技巧"}),e.jsx("option",{value:"best_practice",children:"最佳实践"}),e.jsx("option",{value:"memo",children:"备忘笔记"})]})]})]}),e.jsxs("div",{children:[e.jsx("label",{className:"block text-xs text-monokai-fg-muted font-medium mb-1",children:"核心结论摘要"}),e.jsx("input",{type:"text",value:me,onChange:A=>te(A.target.value),placeholder:"一句话概括本笔记的核心结论...",className:"w-full bg-monokai-bg border border-monokai-border rounded-lg px-3 py-1.5 text-xs text-monokai-fg-muted focus:outline-none focus:border-monokai-accent"})]}),e.jsxs("div",{children:[e.jsxs("label",{className:"block text-xs text-monokai-fg-muted font-medium mb-1",children:["正文内容 (Markdown 格式) ",e.jsx("span",{className:"text-red-400",children:"*"})]}),e.jsx("textarea",{required:!0,rows:8,value:ae,onChange:A=>oe(A.target.value),placeholder:"## 问题背景\\n\\n## 解决步骤\\n\\n```sql\\nSELECT ...\\n```",className:"w-full bg-monokai-bg border border-monokai-border rounded-lg p-3 text-xs text-monokai-fg-muted font-mono focus:outline-none focus:border-monokai-accent resize-none"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"block text-xs text-monokai-fg-muted font-medium mb-1",children:"延伸阅读与参考链接 (逗号分隔)"}),e.jsx("input",{type:"text",value:Ee,onChange:A=>r(A.target.value),placeholder:"https://duckdb.org/docs/...",className:"w-full bg-monokai-bg border border-monokai-border rounded-lg px-3 py-1.5 text-xs text-monokai-fg-muted focus:outline-none focus:border-monokai-accent"})]})]}),e.jsxs("div",{children:[e.jsxs("label",{className:"block text-xs text-monokai-fg-muted font-medium mb-1 flex items-center gap-1",children:[e.jsx(Ge,{className:"w-3 h-3 text-monokai-comment"}),e.jsx("span",{children:"标签 (逗号分隔)"})]}),e.jsx("input",{type:"text",value:R,onChange:A=>E(A.target.value),placeholder:"DuckDB, 性能, 最佳实践",className:"w-full bg-monokai-bg border border-monokai-border rounded-lg px-3 py-1.5 text-xs text-monokai-fg-muted focus:outline-none focus:border-monokai-accent"})]}),e.jsxs("div",{className:"pt-2 border-t border-monokai-border flex items-center justify-end gap-2",children:[e.jsx("button",{type:"button",onClick:a,className:"px-4 py-1.5 rounded-lg text-xs text-monokai-comment hover:text-monokai-fg-muted hover:bg-monokai-elevated transition-colors",children:"取消"}),e.jsxs("button",{type:"submit",className:"px-4 py-1.5 rounded-lg text-xs font-semibold bg-monokai-accent hover:bg-monokai-accent-hover text-monokai-bg transition-colors flex items-center gap-1.5 shadow-sm",children:[e.jsx(qe,{className:"w-3.5 h-3.5"}),e.jsx("span",{children:"保存知识资产"})]})]})]})})},yt=({isOpen:n,onClose:a,targetAsset:t,onSaveExtractedAsset:o})=>{const[s,l]=m.useState(""),[c,i]=m.useState(!1),[d,R]=m.useState(null),[E,u]=m.useState(null);if(ee.useEffect(()=>{t?t.type==="code"?l(`请帮我优化并润色以下 DuckDB SQL，补全适用场景说明和参数占位符：

${t.sql}`):t.type==="metric"?l(`请帮我完善指标口径?{targetAsset.name}」的业务定义与计算公式：

${t.sqlExpression}`):t.type==="note"&&l(`请帮我润色并扩充以下知识笔记，增加避坑实践与最佳建议：

${t.content}`):l(""),u(null),R(null)},[t,n]),!n)return null;const O=async()=>{if(!s.trim())return;if(i(!0),R(null),u(null),!Fe.isConfigured()){setTimeout(()=>{const L=s.trim();if(/SELECT|WITH|CREATE|INSERT|FROM/i.test(L)){const T=L.match(/FROM\s+([a-zA-Z0-9_]+)/i),h=T?T[1]:"my_table",M={id:"ai-code-"+Date.now(),type:"code",title:"AI 提炼：基于 "+h+" 的查询资产",category:"template",description:"由 AI 自动从输入脚本中提炼的高效查询模版",sql:L,tags:["AI提炼",h,"DuckDB"],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};u(M)}else{const T={id:"ai-note-"+Date.now(),type:"note",title:L.slice(0,24)+"...",topic:"best_practice",summary:L.slice(0,80),content:`## 核心经验沉淀

`+L+`

### 建议行动
- 纳入日常开发规范
- 定期复盘`,tags:["AI归档","经验沉淀"],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};u(T)}i(!1)},500);return}try{const L=`你是一个资深 DuckDB 与数据分析专家。请分析以下内容，并提炼为符合规格的知识资产 JSON。
内容：
`+s+`

请严格输出且仅输出合法 JSON，包含 type/title/category/description/sql/name/businessMeaning/calculationFormula/sqlExpression/topic/summary/content/tags 字段。`,x=await Fe.robustCall("sql_explain",L,"你是一个数据资产提炼专家，严格返回 JSON。",!0,2),T=typeof x=="string"?JSON.parse(x):x,h=new Date().toISOString();let M;T.type==="metric"?M={id:"ai-metric-"+Date.now(),type:"metric",name:T.name||T.title||"未命名指标",businessMeaning:T.businessMeaning||"",calculationFormula:T.calculationFormula||"",sqlExpression:T.sqlExpression||T.sql||"",sourceTables:T.sourceTables||[],dimensions:T.dimensions||[],owner:T.owner||"",tags:T.tags||["AI提炼"],isFavorite:!1,createdAt:h,updatedAt:h}:T.type==="note"?M={id:"ai-note-"+Date.now(),type:"note",title:T.title||"未命名笔记",topic:T.topic||"memo",summary:T.summary||"",content:T.content||s,references:T.references||[],tags:T.tags||["AI提炼"],isFavorite:!1,createdAt:h,updatedAt:h}:M={id:"ai-code-"+Date.now(),type:"code",title:T.title||"未命名代码资产",category:T.category||"snippet",description:T.description||"",sql:T.sql||s,tags:T.tags||["AI提炼"],isFavorite:!1,createdAt:h,updatedAt:h},u(M)}catch(L){R(L&&L.message||"AI 提炼失败，请检查网络或配置")}finally{i(!1)}},D=()=>{E&&(o(E),a())};return e.jsx(Ye,{open:n,onClose:a,title:"AI 知识资产智能提炼",description:"输入 SQL、业务口径描述或踩坑心得，AI 自动提炼并结构化归档",size:"lg",icon:ce,iconColor:"text-monokai-accent",children:e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{children:[e.jsx("label",{className:"block text-xs font-medium text-monokai-fg-muted mb-1.5",children:"输入原始文本 / SQL / 经验心得"}),e.jsx("textarea",{rows:6,value:s,onChange:p=>l(p.target.value),placeholder:"例如粘贴一段正在调优的 DuckDB 复杂查询，或输入一段关于业务指标的业务要求...",className:"w-full bg-monokai-bg border border-monokai-border rounded-xl p-3 text-xs text-monokai-fg-muted font-mono focus:outline-none focus:border-monokai-accent resize-none"})]}),e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsxs("span",{className:"text-[11px] text-monokai-comment flex items-center gap-1",children:[e.jsx(yn,{className:"w-3.5 h-3.5 text-monokai-yellow"}),e.jsx("span",{children:"未配置外部 API Key 时将自动启用本地快速智能规则提炼"})]}),e.jsx("button",{type:"button",onClick:O,disabled:c||!s.trim(),className:"px-4 py-1.5 rounded-lg text-xs font-semibold bg-monokai-accent hover:bg-monokai-accent-hover text-monokai-bg transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm",children:c?e.jsxs(e.Fragment,{children:[e.jsx(We,{className:"w-3.5 h-3.5 animate-spin"}),e.jsx("span",{children:"AI 正在提炼..."})]}):e.jsxs(e.Fragment,{children:[e.jsx(ce,{className:"w-3.5 h-3.5"}),e.jsx("span",{children:"开始提炼资产"})]})})]}),d&&e.jsxs("div",{className:"p-3 rounded-lg bg-monokai-pink/10 border border-monokai-pink/40 text-monokai-pink text-xs flex items-center gap-2",children:[e.jsx(ke,{className:"w-4 h-4 text-monokai-pink flex-shrink-0"}),e.jsx("span",{children:d})]}),E&&e.jsxs("div",{className:"rounded-xl border border-monokai-border bg-monokai-elevated p-4 space-y-3",children:[e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsxs("span",{className:"text-xs px-2 py-0.5 rounded bg-monokai-border text-monokai-accent font-medium flex items-center gap-1",children:[E.type==="code"&&e.jsx(re,{className:"w-3 h-3"}),E.type==="metric"&&e.jsx(_e,{className:"w-3 h-3"}),E.type==="note"&&e.jsx(Te,{className:"w-3 h-3"}),e.jsxs("span",{children:["已提炼为：",E.type.toUpperCase()," 资产"]})]}),e.jsx("span",{className:"text-xs font-semibold text-monokai-fg-muted",children:E.type==="metric"?E.name:E.title})]}),e.jsxs("button",{type:"button",onClick:D,className:"px-3 py-1 rounded-md text-xs font-semibold bg-monokai-accent text-monokai-bg hover:bg-monokai-accent-hover flex items-center gap-1 transition-colors",children:[e.jsx(Ae,{className:"w-3.5 h-3.5"}),e.jsx("span",{children:"确认归档入库"})]})]}),E.type==="code"&&e.jsx("pre",{className:"p-3 rounded-lg bg-monokai-bg text-xs font-mono text-monokai-fg-muted overflow-x-auto max-h-48 border border-monokai-border",children:E.sql}),E.type==="metric"&&e.jsxs("div",{className:"text-xs text-monokai-fg-muted space-y-1",children:[e.jsxs("p",{children:[e.jsx("span",{className:"text-monokai-comment",children:"计算公式："}),E.calculationFormula]}),e.jsxs("p",{children:[e.jsx("span",{className:"text-monokai-comment",children:"业务含义："}),E.businessMeaning]})]}),E.type==="note"&&e.jsx("div",{className:"text-xs text-monokai-fg-muted space-y-1",children:e.jsxs("p",{children:[e.jsx("span",{className:"text-monokai-comment",children:"摘要："}),E.summary]})})]})]})})},Ut=({onTryCode:n,onOpenTable:a,onNavigateToMetrics:t})=>{const[o,s]=m.useState([]),[l,c]=m.useState("all"),[i,d]=m.useState(null),[R,E]=m.useState(""),[u,O]=m.useState(null),[D,p]=m.useState(null),[L,x]=m.useState(()=>{try{return localStorage.getItem("duckdb_knowledge_hub_sidebar_collapsed")==="true"}catch{return!1}}),T=m.useCallback(()=>{x(r=>{const b=!r;try{localStorage.setItem("duckdb_knowledge_hub_sidebar_collapsed",String(b))}catch{}return b})},[]),[h,M]=m.useState(!1),[v,V]=m.useState(null),[w,I]=m.useState("code"),[_,S]=m.useState(!1),[y,g]=m.useState(null),N=m.useCallback(async()=>{try{const r=await Re();s(r),r.length>0&&O(b=>b||r[0].id)}catch(r){console.error("[KnowledgeHub] Failed to load assets:",r),U.error(`加载资产数据失败: ${(r==null?void 0:r.message)||"未知错误"}`)}},[]);m.useEffect(()=>{N(),Se().then(r=>{r&&p(r.name)})},[N]),m.useEffect(()=>{const r=b=>{if((b.ctrlKey||b.metaKey)&&b.key.toLowerCase()==="b"){const j=b.target;if(j&&(j.tagName==="INPUT"||j.tagName==="TEXTAREA"||j.isContentEditable))return;b.preventDefault(),T()}};return window.addEventListener("keydown",r),()=>window.removeEventListener("keydown",r)},[T]);const C=async()=>{try{const r=await Kn();r&&(p(r.name),await N(),U.success(`已成功绑定本地代码片段文件夹: ${r.name}`))}catch(r){U.error(`绑定本地文件夹失败: ${(r==null?void 0:r.message)||"操作取消"}`)}},f=m.useMemo(()=>o.filter(r=>{var b,j,k,A,P,G,Y;if(l==="favorites"){if(!r.isFavorite)return!1}else if(l!=="all"&&r.type!==l)return!1;if(i&&(!r.tags||!r.tags.includes(i)))return!1;if(R.trim()){const F=R.toLowerCase().trim(),Q=(b=r.tags)==null?void 0:b.some(W=>W.toLowerCase().includes(F));if(r.type==="code"){const W=r.title.toLowerCase().includes(F),se=(j=r.description)==null?void 0:j.toLowerCase().includes(F),ie=r.sql.toLowerCase().includes(F);return W||se||ie||Q}else if(r.type==="metric"){const W=r.name.toLowerCase().includes(F),se=(k=r.businessMeaning)==null?void 0:k.toLowerCase().includes(F),ie=(A=r.calculationFormula)==null?void 0:A.toLowerCase().includes(F),Ze=(P=r.sqlExpression)==null?void 0:P.toLowerCase().includes(F);return W||se||ie||Ze||Q}else if(r.type==="note"){const W=r.title.toLowerCase().includes(F),se=(G=r.summary)==null?void 0:G.toLowerCase().includes(F),ie=(Y=r.content)==null?void 0:Y.toLowerCase().includes(F);return W||se||ie||Q}}return!0}),[o,l,i,R]);m.useEffect(()=>{f.length>0?f.some(b=>b.id===u)||O(f[0].id):o.length>0&&O(null)},[f,u,o.length]);const q=m.useMemo(()=>{if(u){const r=o.find(b=>b.id===u);if(r)return r}return f.length>0?f[0]:o.length>0?o[0]:null},[o,f,u]),X=async(r,b)=>{b&&b.stopPropagation();try{const j=await at(r);s(k=>k.map(A=>A.id===r?{...A,isFavorite:j}:A)),U.info(j?"已加入收藏":"已取消收藏")}catch(j){U.error(`收藏失败: ${j==null?void 0:j.message}`)}},J=r=>{V(null),I(r),M(!0)},$=r=>{V(r),M(!0)},K=async r=>{try{await be(r),await N(),O(r.id),U.success(`知识资产「${r.type==="metric"?r.name:r.title}」已保存`)}catch(b){U.error(`保存资产失败: ${b==null?void 0:b.message}`)}},z=async r=>{const b=o.find(k=>k.id===r),j=b?b.type==="metric"?b.name:b.title:"此资产";if(window.confirm(`确定要彻底删除「${j}」吗？`))try{await tt(r);const k=o.filter(A=>A.id!==r);s(k),u===r&&O(k.length>0?k[0].id:null),U.success(`已成功删除资产「${j}」`)}catch(k){U.error(`删除失败: ${k==null?void 0:k.message}`)}},me=async(r,b)=>{const j=o.find(k=>k.id===r);if(!(!j||j.type!=="note"))try{const k={...j,content:b};await be(k),s(A=>A.map(P=>P.id===r?k:P)),U.success("笔记内容已自动保存")}catch(k){U.error(`保存笔记失败: ${k==null?void 0:k.message}`)}},te=async()=>{try{const r=await ot(),b=new Blob([r],{type:"application/json"}),j=URL.createObjectURL(b),k=document.createElement("a");k.href=j,k.download=`duckdb-knowledge-assets-${new Date().toISOString().slice(0,10)}.json`,k.click(),URL.revokeObjectURL(j),U.success(`已导出 ${o.length} 项知识资产备份`)}catch(r){U.error(`导出失败: ${r==null?void 0:r.message}`)}},ae=()=>{const r=document.createElement("input");r.type="file",r.accept=".json,.md,.markdown,text/markdown,application/json",r.multiple=!0,r.onchange=async b=>{var k;const j=Array.from(((k=b.target)==null?void 0:k.files)||[]);if(j.length!==0)try{let A=0,P=0;const G=j.filter(F=>F.name.toLowerCase().endsWith(".json")),Y=j.filter(F=>F.name.toLowerCase().endsWith(".md")||F.name.toLowerCase().endsWith(".markdown"));for(const F of G){const Q=await F.text(),W=await st(Q);A+=W.added,P+=W.updated}if(Y.length>0){const F=await Promise.all(Y.map(async W=>({filename:W.name,content:await W.text()}))),Q=await Xe(F);A+=Q.added,P+=Q.updated}await N(),U.success(`导入成功：共处理 ${j.length} 个文件（新增 ${A} 项，更新 ${P} 项）`)}catch(A){console.error("[KnowledgeHub] Import error:",A),U.error(`导入失败: ${(A==null?void 0:A.message)||"文件格式不符"}`)}},r.click()},oe=async()=>{try{U.info("正在从 docs 目录载入教程文档...");const r=await it();await N(),r.assets.length>0&&O(r.assets[0].id),U.success(`已成功载入 docs 目录下的 ${r.total} 篇教程文档（新增 ${r.added} 篇，更新 ${r.updated} 篇）！`)}catch(r){console.error("[KnowledgeHub] Failed to import docs directory:",r),U.error(`载入 docs 文档失败: ${(r==null?void 0:r.message)||"请检查服务端连接"}`)}},Ee=async()=>{if(window.confirm("重置将清除所有自建资产并恢复初始内置资产，是否继续？"))try{await rt(),await N(),U.success("已重置为初始内置知识资产")}catch(r){U.error(`重置失败: ${r==null?void 0:r.message}`)}};return e.jsxs("div",{className:"w-full h-full flex overflow-hidden bg-monokai-bg select-text",children:[e.jsx(dt,{assets:o,selectedAssetId:u,onSelectAsset:r=>O(r),searchQuery:R,onSearchChange:E,isCollapsed:L,onToggleCollapse:T,selectedCategory:l,onSelectCategory:r=>{c(r),d(null)},selectedTag:i,onSelectTag:r=>d(r),onExport:te,onImport:ae,onImportDocs:oe,onResetSeeds:Ee,onPickDirectory:C,boundDirectoryName:D,onNewAsset:J,onOpenAiAssistant:()=>{g(null),S(!0)}}),e.jsx(St,{asset:q,isSidebarCollapsed:L,onToggleSidebar:T,onTryCode:n,onNavigateToMetrics:t,onToggleFavorite:X,onEditAsset:$,onDeleteAsset:z,onUpdateNoteContent:me,onOpenAiAssistant:r=>{g(r||null),S(!0)}}),e.jsx(Rt,{isOpen:h,onClose:()=>M(!1),assetToEdit:v,defaultType:w,onSave:K}),e.jsx(yt,{isOpen:_,onClose:()=>S(!1),targetAsset:y,onSaveExtractedAsset:K})]})};export{Ut as KnowledgeHubApp,Ut as default,tt as deleteKnowledgeAsset,ot as exportKnowledgeAssetsToJson,Re as getAllKnowledgeAssets,nt as getKnowledgeAssetById,it as importDocsTutorials,st as importKnowledgeAssetsFromJson,Xe as importKnowledgeAssetsFromMarkdownFiles,rt as resetKnowledgeAssetsToSeeds,be as saveKnowledgeAsset,De as saveMultipleAssets,at as toggleAssetFavorite};
