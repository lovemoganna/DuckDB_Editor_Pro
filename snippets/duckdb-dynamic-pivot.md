---
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

```sql
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
```
