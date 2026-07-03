/**
 * sqlAiPrompts — Centralised AI prompt templates for the SQL Editor
 *
 * Extracted from SqlEditor.tsx (Loop 3 of SqlEditor Pro refactor).
 *
 * Centralising prompts lets us:
 *   - iterate on prompt wording without touching the React components
 *   - add prompt variants per provider (Google/Claude/OpenAI/Groq)
 *   - unit-test prompt content in isolation
 */

/** Result-mode prompts — used by `handleAiContinueOptimize(type)`. */
export const OPTIMIZATION_PROMPTS: Record<string, (sql: string) => string> = {
  improve: (sql) =>
    `请优化以下 SQL，提升性能和可读性。直接返回优化后的 SQL 代码，不要包含其他说明文字：\n\n${sql}`,
  explain: (sql) =>
    `请详细解释以下 SQL 查询的作用、计算逻辑和数据指标。请使用 Markdown 格式返回，每个要点单独一行，格式示例：\n\n` +
    `## 查询目的\n该查询的目的是...\n\n` +
    `## 使用的表和字段\n- 表：xxx\n- 字段：xxx\n\n` +
    `## 主要计算逻辑\n...（详细说明）\n\n` +
    `## 输出结果\n...（代表什么含义）\n\n` +
    `**注意**：标题和内容必须分开两行，列表项格式为 "- 项目：内容"，不要把标题和内容写在同一行。\n\n` +
    `SQL: ${sql}`,
  adapt: (sql) =>
    `请将以下 SQL 适配到 DuckDB 语法，利用 DuckDB 特有功能（如 SUMMARIZE、PIVOT、UNPIVOT、USING SAMPLE 等）优化。直接返回优化后的 SQL 代码：\n\n${sql}`,
  diagnoseProfiling: (sql, bottleneck) =>
    `根据以下 SQL 的性能剖析瓶颈节点信息：\n瓶颈描述：${bottleneck}\n\n请对此 SQL 进行针对性的性能重构和优化，直接返回优化后的 SQL，不需要说明文字。在 SQL 注释中简要说明优化的原因。\n\nSQL: ${sql}`,
};

/** Type-aware prompts used by the "AI 智能填充" button. */
export const FILL_PROMPTS: Record<string, (tableName: string, ctx: string) => string> = {
  select: (table, ctx) =>
    `为 DuckDB 生成带 WHERE 条件和 LIMIT 的基础 SELECT 查询。${ctx}`,
  join: (table, ctx) =>
    `为 DuckDB 生成 LEFT JOIN 多表关联查询，主表是 ${table || 'table1'}，${ctx}`,
  aggregate: (_table, ctx) =>
    `为 DuckDB 生成按时间维度分组的聚合分析 SQL，包含 COUNT 和 SUM。${ctx}`,
  transform: (_table, ctx) =>
    `为 DuckDB 生成数据转换 SQL，使用 TRY_CAST 进行类型转换并用 TRIM/LOWER 清洗字符串。${ctx}`,
  performance: (_table, ctx) =>
    `为以下查询生成 EXPLAIN ANALYZE 诊断版本，并在注释中说明如何解读执行计划。${ctx}`,
  utilities: (_table, ctx) =>
    `为 DuckDB 生成 SUMMARIZE 摘要统计语句，并附上数据质量检查 SQL（NULL 率、重复行）。${ctx}`,
};

export const DEFAULT_FILL_PROMPT = (ctx: string) =>
  `为 DuckDB 生成 SQL 查询。${ctx}`;
