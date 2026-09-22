---
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
> 在并发分析与大宽表聚合场景下，DuckDB 默认会尝试使用系统物理内存的 80%。在容器化（K8s/Docker）或浏览器端（WASM 2GB/4GB 限制）中，必须显式收紧 `max_memory`，否则可能触发宿主系统的 OOM Killer。

## 1. 核心控制参数矩阵

| 参数名称 | 默认值 | 推荐生产配置 | 核心作用说明 |
| :--- | :--- | :--- | :--- |
| `max_memory` | `物理内存 * 80%` | 容器 Limit 的 70% | 限制缓冲池（Buffer Manager）最大可用内存 |
| `temp_directory` | 系统临时目录 | 高速 SSD 挂载卷 | 内存不足时数据落盘 Spilling 目录 |
| `preserve_insertion_order` | `true` | 大扫描下置为 `false` | 关闭保持行插入顺序可节省约 15% 内存开销 |
| `threads` | CPU 物理核数 | `min(CPU核数, 8)` | 并发线程池上限，防止线程风暴引发内存急剧膨胀 |

## 2. 调优生效 SQL 配置脚本

```sql
-- 1. 显式限制最大缓冲内存为 2GB
SET max_memory = '2GB';

-- 2. 关闭保持插入顺序，加速海量数据聚合
SET preserve_insertion_order = false;

-- 3. 查看当前内存与临时缓冲状态
SELECT * FROM duckdb_settings() 
WHERE name IN ('max_memory', 'threads', 'preserve_insertion_order');
```

> [!TIP]
> 当处理超过内存上限的巨大 Parquet 文件时，DuckDB 会自动开启流式查询（Streaming Execution）与外排序（External Merge Sort）。务必确保 `temp_directory` 所在磁盘有至少目标数据量 1.5 倍的剩余空间。

## 3. 常见避坑要点 (Anti-patterns)

- **避免无限制 `SELECT *`**：在宽表（>100 列）上全量投影会导致大量列在内存中被解压；
- **慎用超大窗口全量排序**：`OVER (ORDER BY id)` 在无分区键时会退化为全局单点排序，极易引发内存水位陡增；
- **浏览器 WASM 环境清理**：执行完毕海量临时分析后，建议执行 `PRAGMA shrink_memory;` 强制触发 GC 回收。
