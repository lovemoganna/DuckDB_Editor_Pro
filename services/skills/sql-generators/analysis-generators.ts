/**
 * Analysis SQL Generators
 *
 * Template-based SQL generation for analytics skills:
 * Time Series, Comparison, Funnel, Retention
 */

import { SkillExecutionContext } from '../../../types';

export const analysisGenerators = {
  timeSeries(inputs: Record<string, any>, context: SkillExecutionContext): string {
    const { timeColumn, valueColumn, granularity, analysisType } = inputs;
    const tableName = context.tableName || 'table_name';
    const tc = timeColumn || context.columns?.find(c => c.type?.toLowerCase().includes('timestamp') || c.name.toLowerCase().includes('time') || c.name.toLowerCase().includes('date'))?.name || 'created_at';
    const vc = valueColumn || context.columns?.[0]?.name || 'value';
    const gran = granularity || '日';

    const truncateMap: Record<string, string> = {
      '日': "DATE_TRUNC('day', " + tc + ")",
      '周': "DATE_TRUNC('week', " + tc + ")",
      '月': "DATE_TRUNC('month', " + tc + ")",
      '季度': "DATE_TRUNC('quarter', " + tc + ")",
      '年': "DATE_TRUNC('year', " + tc + ")",
    };

    const truncatedTime = truncateMap[gran] || "DATE_TRUNC('day', " + tc + ")";

    if (analysisType === '移动平均') {
      return "SELECT " + truncatedTime + " AS period, AVG(" + vc + ") OVER (ORDER BY " + tc + " ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS moving_avg, AVG(" + vc + ") AS period_avg, SUM(" + vc + ") AS period_total FROM \"" + tableName + "\" GROUP BY " + truncatedTime + ", " + tc + " ORDER BY period;";
    }

    if (analysisType === '累计') {
      return "SELECT " + truncatedTime + " AS period, SUM(" + vc + ") AS period_total, SUM(SUM(" + vc + ")) OVER (ORDER BY " + truncatedTime + " ROWS UNBOUNDED PRECEDING) AS cumulative_total FROM \"" + tableName + "\" GROUP BY " + truncatedTime + " ORDER BY period;";
    }

    return "SELECT " + truncatedTime + " AS period, SUM(" + vc + ") AS total_" + vc + ", AVG(" + vc + ") AS avg_" + vc + ", MIN(" + vc + ") AS min_" + vc + ", MAX(" + vc + ") AS max_" + vc + ", COUNT(*) AS record_count FROM \"" + tableName + "\" GROUP BY " + truncatedTime + " ORDER BY period;";
  },

  comparison(inputs: Record<string, any>, context: SkillExecutionContext): string {
    const { dimension, metrics, comparisonType, tableName } = inputs;
    const table = tableName || context.tableName || 'table_name';
    const dim = dimension || context.columns?.[0]?.name || 'category';
    const met = metrics || context.columns?.find(c => c.type?.toLowerCase().includes('int') || c.type?.toLowerCase().includes('double') || c.type?.toLowerCase().includes('bigint'))?.name || 'amount';

    if (comparisonType === '占比分析') {
      return "SELECT " + dim + ", " + met + ", ROUND(100.0 * " + met + " / SUM(" + met + ") OVER (), 2) AS percentage, RANK() OVER (ORDER BY " + met + " DESC) AS rank_by_value FROM \"" + table + "\" ORDER BY " + met + " DESC;";
    }

    if (comparisonType === '排名分析') {
      return "SELECT " + dim + ", " + met + ", RANK() OVER (ORDER BY " + met + " DESC) AS rank, DENSE_RANK() OVER (ORDER BY " + met + " DESC) AS dense_rank, PERCENT_RANK() OVER (ORDER BY " + met + " DESC) AS percentile_rank, NTILE(4) OVER (ORDER BY " + met + " DESC) AS quartile FROM \"" + table + "\" ORDER BY rank;";
    }

    if (comparisonType === '分位数分析') {
      return "SELECT " + dim + ", " + met + ", NTILE(10) OVER (ORDER BY " + met + ") AS decile, CASE NTILE(4) OVER (ORDER BY " + met + ") WHEN 1 THEN 'Q1 (0-25%)' WHEN 2 THEN 'Q2 (25-50%)' WHEN 3 THEN 'Q3 (50-75%)' ELSE 'Q4 (75-100%)' END AS quartile_bucket FROM \"" + table + "\" ORDER BY " + met + ";";
    }

    return "SELECT " + dim + ", " + met + " FROM \"" + table + "\" ORDER BY " + dim + ";";
  },

  funnel(inputs: Record<string, any>, context: SkillExecutionContext): string {
    const { steps, userIdColumn } = inputs;
    const uc = userIdColumn || 'user_id';

    if (!steps) {
      return "-- 漏斗分析模板\n-- 请在 steps 参数中定义各步骤的 SQL 子查询\n-- 参考 DuckDB 官方 PIVOT 文档了解具体语法";
    }

    return "-- 漏斗分析模板\n-- 步骤: " + steps + "\nSELECT step_name, COUNT(DISTINCT " + uc + ") AS user_count, ROUND(100.0 * COUNT(DISTINCT " + uc + ") / NULLIF(LAG(COUNT(DISTINCT " + uc + ")) OVER (ORDER BY step_order), 0), 2) AS conversion_rate FROM (" + steps + ") funnel GROUP BY step_name, step_order ORDER BY step_order;";
  },

  retention(inputs: Record<string, any>, context: SkillExecutionContext): string {
    const { userColumn, timeColumn, periods } = inputs;
    const tableName = context.tableName || 'table_name';
    const uc = userColumn || 'user_id';
    const tc = timeColumn || 'created_at';

    const periodList = periods
      ? periods.split(',').map((p: string) => parseInt(p.trim()))
      : [1, 3, 7, 14, 30];

    const retentionCols = periodList.map((p: number) =>
      "  ROUND(100.0 * COUNT(DISTINCT CASE WHEN DATE_DIFF('day', cohort.cohort_date, DATE_TRUNC('day', t." + tc + ")) <= " + p + " THEN t." + uc + " END) / NULLIF(cohort.cohort_size, 0), 2) AS day_" + p + "_retention"
    ).join(',\n');

    return "-- 留存分析模板\nWITH cohort AS (\n  SELECT\n    " + uc + " AS user_id,\n    DATE_TRUNC('day', " + tc + ") AS cohort_date,\n    COUNT(DISTINCT " + uc + ") OVER (PARTITION BY DATE_TRUNC('day', " + tc + ")) AS cohort_size\n  FROM \"" + tableName + "\"\n  GROUP BY " + uc + ", DATE_TRUNC('day', " + tc + ")\n)\nSELECT\n  cohort.cohort_date,\n  cohort.cohort_size AS initial_users,\n" + retentionCols + "\nFROM cohort\nJOIN \"" + tableName + "\" t ON cohort.user_id = t." + uc + "\nGROUP BY cohort.cohort_date, cohort.cohort_size\nORDER BY cohort.cohort_date;";
  },
};
