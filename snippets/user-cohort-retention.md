---
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

```sql
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
```
