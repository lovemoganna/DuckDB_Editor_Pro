---
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

```sql
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
```
