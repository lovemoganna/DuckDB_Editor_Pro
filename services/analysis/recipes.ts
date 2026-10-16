import { quoteTable, quoteIdent, literalValue } from './sqlUtils';
/**
 * Analysis scenario recipes (Pareto 80/20, RFM, IQR, Histogram, Cohort).
 * Complex recipes may use dedicated SQL, but all exits go through Chart Registry.
 */

import { duckDBService } from '../duckdbService';
import {
  chartSpecToChartConfig,
  mapRecipeResultToChartSpec,
} from './chartRegistry';
import type { ChartSpec } from './types';
import type { ChartConfig } from '../../types';

export interface RecipeParamDef {
  key: string;
  label: string;
  description: string;
  type: 'column_select' | 'number' | 'select';
  filterType?: 'numeric' | 'temporal' | 'categorical' | 'any';
  options?: { label: string; value: string | number }[];
  defaultValue?: string | number;
}

export interface RecipeMetadata {
  id: 'pareto' | 'rfm' | 'iqr' | 'histogram' | 'cohort';
  title: string;
  badge: string;
  description: string;
  applicableScenario: string;
  icon: string;
  params: RecipeParamDef[];
}

export interface RecipeExecutionResult {
  sql: string;
  rows: Record<string, unknown>[];
  insights: string[];
  extraStats?: Record<string, unknown>;
  executionTimeMs: number;
  /** Unified chart exit — UI must consume these, not invent encodings */
  chart: ChartSpec;
  chartConfig: ChartConfig;
  columns: string[];
}

function withChart(
  recipeId: RecipeMetadata['id'],
  title: string,
  partial: Omit<RecipeExecutionResult, 'chart' | 'chartConfig' | 'columns'> & {
    chartType?: ChartSpec['chartType'];
    xKey?: string;
    yKeys?: string[];
  },
): RecipeExecutionResult {
  const columns =
    partial.rows.length > 0 ? Object.keys(partial.rows[0]) : [];
  const chart = mapRecipeResultToChartSpec(partial.rows, columns, {
    recipeId,
    title,
    chartType: partial.chartType,
    xKey: partial.xKey,
    yKeys: partial.yKeys,
  });
  chart.format = { ...chart.format, decimals: 8 };
  return {
    ...partial,
    columns,
    chart,
    chartConfig: chartSpecToChartConfig(chart),
  };
}

export const SCENARIO_RECIPES: RecipeMetadata[] = [
  {
    id: 'pareto',
    title: '帕累托 80/20 分析',
    badge: '价值集中度',
    description: '识别驱动 80% 产出的头部实体',
    applicableScenario: '客户价值 / 爆款 SKU / 资源倾斜',
    icon: 'TrendingUp',
    params: [
      {
        key: 'entityCol',
        label: '实体字段',
        description: '如 customer_id, product_name',
        type: 'column_select',
        filterType: 'any',
      },
      {
        key: 'metricCol',
        label: '价值度量',
        description: '如 revenue, amount',
        type: 'column_select',
        filterType: 'numeric',
      },
    ],
  },
  {
    id: 'rfm',
    title: 'RFM 价值分层',
    badge: '用户画像',
    description: '按 R/F/M 分层标记高价值与流失风险',
    applicableScenario: '精准营销 / 流失预警',
    icon: 'Users',
    params: [
      {
        key: 'userCol',
        label: '用户字段',
        description: '如 customer_id',
        type: 'column_select',
        filterType: 'any',
      },
      {
        key: 'dateCol',
        label: '时间字段',
        description: '如 order_date',
        type: 'column_select',
        filterType: 'temporal',
      },
      {
        key: 'amountCol',
        label: '金额字段',
        description: '如 amount, revenue',
        type: 'column_select',
        filterType: 'numeric',
      },
    ],
  },
  {
    id: 'iqr',
    title: 'IQR 异常值检测',
    badge: '数据清洗',
    description: '基于 Tukey 四分位距智能识别统计离群值',
    applicableScenario: '数据清洗 / 欺诈侦测 / 极值风控',
    icon: 'AlertTriangle',
    params: [
      {
        key: 'numCol',
        label: '数值字段',
        description: '检测异常波动的数值列',
        type: 'column_select',
        filterType: 'numeric',
      },
    ],
  },
  {
    id: 'histogram',
    title: '等宽分箱频次分布',
    badge: '分布密度',
    description: '将连续数值按等宽区间切片，生成直方图',
    applicableScenario: '客单价分布 / 年龄段分布 / 停留时长分档',
    icon: 'BarChart2',
    params: [
      {
        key: 'numCol',
        label: '分箱字段',
        description: '需分箱的数值列',
        type: 'column_select',
        filterType: 'numeric',
      },
      {
        key: 'bucketCount',
        label: '分箱数量',
        description: '建议 5 - 12 个分箱',
        type: 'number',
        defaultValue: 8,
      },
    ],
  },
  {
    id: 'cohort',
    title: '同期群留存矩阵',
    badge: '生命周期',
    description: '按首访首购月份构建留存热力衰减矩阵',
    applicableScenario: '用户留存 / 复购率衰减 / 队列流失',
    icon: 'Calendar',
    params: [
      {
        key: 'userCol',
        label: '用户唯一标识',
        description: '如 user_id, device_id',
        type: 'column_select',
        filterType: 'any',
      },
      {
        key: 'dateCol',
        label: '业务行为时间',
        description: '如 event_time, order_date',
        type: 'column_select',
        filterType: 'temporal',
      },
    ],
  },
];

export function getRecipeList(): RecipeMetadata[] {
  return SCENARIO_RECIPES;
}

/**
 * Execute scenario recipe (pareto, rfm, iqr, histogram, cohort)
 */
export async function executeRecipe(
  recipeId: 'pareto' | 'rfm' | 'iqr' | 'histogram' | 'cohort',
  tableName: string,
  params: Record<string, unknown>,
): Promise<RecipeExecutionResult> {
  const startTime = performance.now();
  const scopeSchema = await duckDBService.getTableSchema(tableName);
  const unitColumn = scopeSchema.find(c => /^(asset|currency)$/i.test(c.name))?.name;
  if (unitColumn && !params.selectedUnit) throw new Error('请先选择计量资产，不能合计不同币种');
  const escapedTable = unitColumn
    ? `(SELECT * FROM ${quoteTable(tableName)} WHERE ${quoteIdent(unitColumn)}=${literalValue(String(params.selectedUnit))})`
    : quoteTable(tableName);
  let sql = '';
  const insights: string[] = [];

  if (recipeId === 'pareto') {
    const entityCol = `"${String(params.entityCol || 'customer_id').replace(/"/g, '""')}"`;
    const metricCol = `"${String(params.metricCol || 'revenue').replace(/"/g, '""')}"`;

    sql = `
WITH aggregated AS (
  SELECT
    ${entityCol} AS 实体标识,
    SUM(CAST(${metricCol} AS DOUBLE)) AS 贡献金额
  FROM ${escapedTable}
  WHERE ${entityCol} IS NOT NULL
  GROUP BY 1
),
ranked AS (
  SELECT
    实体标识,
    贡献金额,
    SUM(贡献金额) OVER (ORDER BY 贡献金额 DESC) AS 累计贡献金额,
    SUM(贡献金额) OVER () AS 全局总额,
    ROW_NUMBER() OVER (ORDER BY 贡献金额 DESC) AS 排名,
    COUNT(*) OVER () AS 总实体数
  FROM aggregated
)
SELECT
  实体标识,
  贡献金额,
  累计贡献金额,
  ROUND(累计贡献金额 / NULLIF(全局总额, 0) * 100, 2) AS 累计贡献率_百分比,
  ROUND(排名 / NULLIF(总实体数, 0) * 100, 2) AS 实体排位占比_百分比,
  CASE WHEN (累计贡献金额 / NULLIF(全局总额, 0)) <= 0.80 THEN '核心头部 (80%贡献圈)' ELSE '长尾群体' END AS 帕累托分组
FROM ranked
ORDER BY 排名 ASC
LIMIT 100;`;

    const rawRows = await duckDBService.readQuery(sql);
    const rows = (rawRows || []) as Record<string, unknown>[];
    const topRows = rows.filter((r) => r.帕累托分组 === '核心头部 (80%贡献圈)');
    const totalEntities = rows.length > 0 ? Number(rows[0].总实体数 || rows.length) : 0;
    const topCount = topRows.length;
    const totalRev = rows.length > 0 ? Number(rows[rows.length - 1].累计贡献金额 || 0) : 0;
    const topRev = topRows.length > 0 ? Number(topRows[topRows.length - 1].累计贡献金额 || 0) : 0;

    insights.push(`共探查 ${totalEntities} 个实体。`);
    insights.push(
      `前 ${topCount} 个核心头部实体（占 ${totalEntities > 0 ? Math.round((topCount / totalEntities) * 1000) / 10 : 0}%）贡献了当前样本 ${totalRev > 0 ? (topRev / totalRev * 100).toFixed(2) : '0'}% 的价值。`,
    );
    insights.push(`建议将核心头部客户提取为目标重点服务名单。`);

    const cleanSql = `CREATE OR REPLACE TABLE "pareto_vip_${tableName}" AS
WITH aggregated AS (
  SELECT ${entityCol} AS entity_id, SUM(CAST(${metricCol} AS DOUBLE)) AS contribution
  FROM ${escapedTable} WHERE ${entityCol} IS NOT NULL GROUP BY 1
),
ranked AS (
  SELECT entity_id, contribution,
    SUM(contribution) OVER (ORDER BY contribution DESC) AS running_sum,
    SUM(contribution) OVER () AS total_sum
  FROM aggregated
)
SELECT entity_id, contribution, ROUND(running_sum / NULLIF(total_sum, 0) * 100, 2) AS cumulative_pct
FROM ranked
WHERE (running_sum / NULLIF(total_sum, 0)) <= 0.80
ORDER BY contribution DESC;`;

    return withChart('pareto', '帕累托累计贡献', {
      sql,
      rows,
      insights,
      extraStats: {
        totalEntities,
        topEntitiesCount: topCount,
        topRatio: totalEntities > 0 ? Math.round((topCount / totalEntities) * 1000) / 10 : 0,
        totalRevenue: totalRev,
        topRevenue: topRev,
        cleanSql,
      },
      executionTimeMs: Math.round((performance.now() - startTime) * 10) / 10,
      chartType: 'line',
      xKey: '实体标识',
      yKeys: ['累计贡献率_百分比'],
    });
  }

  if (recipeId === 'rfm') {
    const userCol = `"${String(params.userCol || 'customer_id').replace(/"/g, '""')}"`;
    const dateCol = `"${String(params.dateCol || 'order_date').replace(/"/g, '""')}"`;
    const amountCol = `"${String(params.amountCol || 'amount').replace(/"/g, '""')}"`;

    sql = `
WITH rfm_raw AS (
  SELECT
    ${userCol} AS 用户标识,
    DATEDIFF('day', MAX(CAST(${dateCol} AS DATE)), (SELECT MAX(CAST(${dateCol} AS DATE)) FROM ${escapedTable})) AS recency_days,
    COUNT(*) AS frequency_orders,
    ROUND(SUM(CAST(${amountCol} AS DOUBLE)), 2) AS monetary_amount
  FROM ${escapedTable}
  WHERE ${userCol} IS NOT NULL AND ${dateCol} IS NOT NULL
  GROUP BY 1
),
rfm_scored AS (
  SELECT
    用户标识,
    recency_days,
    frequency_orders,
    monetary_amount,
    NTILE(3) OVER (ORDER BY recency_days ASC) AS r_score,
    NTILE(3) OVER (ORDER BY frequency_orders DESC) AS f_score,
    NTILE(3) OVER (ORDER BY monetary_amount DESC) AS m_score
  FROM rfm_raw
)
SELECT
  用户标识,
  recency_days AS 最近活跃天数,
  frequency_orders AS 消费频次,
  monetary_amount AS 累计消费金额,
  CASE
    WHEN r_score >= 2 AND f_score >= 2 AND m_score >= 2 THEN '💎 高价值核心客户'
    WHEN r_score >= 2 AND f_score < 2 AND m_score >= 2 THEN '🌱 新晋高消客户'
    WHEN r_score >= 2 AND f_score >= 2 AND m_score < 2 THEN '🏆 忠诚高频客户'
    WHEN r_score >= 2 AND f_score < 2 AND m_score < 2 THEN '✨ 新晋初访客户'
    WHEN r_score < 2 AND f_score >= 2 AND m_score >= 2 THEN '⚠️ 重点挽留流失客户'
    WHEN r_score < 2 AND f_score < 2 AND m_score >= 2 THEN '⏳ 消费睡眠客户'
    WHEN r_score < 2 AND f_score >= 2 AND m_score < 2 THEN '💤 低贡献老客户'
    ELSE '❌ 一般流失与低价值客户'
  END AS RFM分层标签
FROM rfm_scored
ORDER BY monetary_amount DESC
LIMIT 100;`;

    const rawRows = await duckDBService.readQuery(sql);
    const rows = (rawRows || []) as Record<string, unknown>[];

    const segmentSql = `
WITH rfm_raw AS (
  SELECT
    ${userCol} AS user_id,
    DATEDIFF('day', MAX(CAST(${dateCol} AS DATE)), (SELECT MAX(CAST(${dateCol} AS DATE)) FROM ${escapedTable})) AS recency_days,
    COUNT(*) AS frequency_orders,
    ROUND(SUM(CAST(${amountCol} AS DOUBLE)), 2) AS monetary_amount
  FROM ${escapedTable}
  WHERE ${userCol} IS NOT NULL AND ${dateCol} IS NOT NULL
  GROUP BY 1
),
rfm_scored AS (
  SELECT
    user_id,
    recency_days,
    frequency_orders,
    monetary_amount,
    NTILE(3) OVER (ORDER BY recency_days ASC) AS r_score,
    NTILE(3) OVER (ORDER BY frequency_orders DESC) AS f_score,
    NTILE(3) OVER (ORDER BY monetary_amount DESC) AS m_score
  FROM rfm_raw
),
labeled AS (
  SELECT
    user_id,
    recency_days,
    frequency_orders,
    monetary_amount,
    CASE
      WHEN r_score >= 2 AND f_score >= 2 AND m_score >= 2 THEN '💎 高价值核心客户'
      WHEN r_score >= 2 AND f_score < 2 AND m_score >= 2 THEN '🌱 新晋高消客户'
      WHEN r_score >= 2 AND f_score >= 2 AND m_score < 2 THEN '🏆 忠诚高频客户'
      WHEN r_score >= 2 AND f_score < 2 AND m_score < 2 THEN '✨ 新晋初访客户'
      WHEN r_score < 2 AND f_score >= 2 AND m_score >= 2 THEN '⚠️ 重点挽留流失客户'
      WHEN r_score < 2 AND f_score < 2 AND m_score >= 2 THEN '⏳ 消费睡眠客户'
      WHEN r_score < 2 AND f_score >= 2 AND m_score < 2 THEN '💤 低贡献老客户'
      ELSE '❌ 一般流失与低价值客户'
    END AS segment
  FROM rfm_scored
)
SELECT
  segment,
  COUNT(*) AS user_count,
  ROUND(SUM(monetary_amount), 2) AS total_amount,
  ROUND(AVG(monetary_amount), 2) AS avg_amount,
  ROUND(AVG(recency_days), 1) AS avg_recency,
  ROUND(AVG(frequency_orders), 1) AS avg_freq
FROM labeled
GROUP BY 1
ORDER BY total_amount DESC;`;

    let segmentSummary: Record<string, unknown>[] = [];
    try {
      segmentSummary = (await duckDBService.readQuery(segmentSql)) || [];
    } catch (err) {
      console.warn('Failed to query RFM segments:', err);
    }

    const championCount = rows.filter((r) => String(r.RFM分层标签 || '').includes('高价值核心')).length;
    const atRiskCount = rows.filter((r) => String(r.RFM分层标签 || '').includes('重点挽留')).length;

    insights.push(`已完成多维 RFM 智能打分，识别出 ${championCount} 位高价值核心客户。`);
    insights.push(`检测到 ${atRiskCount} 位高消费但近期未活跃的重点挽留客户，需尽快采取触达召回。`);

    return withChart('rfm', 'RFM 价值分层', {
      sql,
      rows,
      insights,
      extraStats: {
        segmentSummary,
      },
      executionTimeMs: Math.round((performance.now() - startTime) * 10) / 10,
      chartType: 'bar',
      xKey: 'RFM分层标签',
      yKeys: ['累计消费金额'],
    });
  }

  if (recipeId === 'iqr') {
    const numCol = `"${String(params.numCol || 'amount').replace(/"/g, '""')}"`;
    const boundsSql = `
WITH percentiles AS (
  SELECT
    QUANTILE_CONT(${numCol}, 0.25) AS q1,
    QUANTILE_CONT(${numCol}, 0.75) AS q3,
    (QUANTILE_CONT(${numCol}, 0.75) - QUANTILE_CONT(${numCol}, 0.25)) AS iqr
  FROM ${escapedTable}
  WHERE ${numCol} IS NOT NULL
),
bounds AS (
  SELECT
    q1,
    q3,
    iqr,
    (q1 - 1.5 * iqr) AS lower_bound,
    (q3 + 1.5 * iqr) AS upper_bound
  FROM percentiles
)
`;
    sql = `${boundsSql}SELECT
  t.*,
  b.q1,
  b.q3,
  b.iqr,
  b.lower_bound AS 正常下界,
  b.upper_bound AS 正常上界,
  CASE 
    WHEN t.${numCol} > b.upper_bound THEN '高位极端异常值 (高于上界)'
    WHEN t.${numCol} < b.lower_bound THEN '低位极端异常值 (低于下界)'
    ELSE '正常值'
  END AS 异常判定
FROM ${escapedTable} t
CROSS JOIN bounds b
WHERE t.${numCol} > b.upper_bound OR t.${numCol} < b.lower_bound
LIMIT 100;`;

    const rawRows = await duckDBService.readQuery(sql);
    const rows = (rawRows || []) as Record<string, unknown>[];
    const statistics = await duckDBService.readQuery(`${boundsSql}SELECT * FROM bounds;`);
    const q1 = Number(statistics[0]?.q1 ?? 0);
    const q3 = Number(statistics[0]?.q3 ?? 0);
    const iqr = Number(statistics[0]?.iqr ?? 0);
    const lowerBound = Number(statistics[0]?.lower_bound ?? 0);
    const upperBound = Number(statistics[0]?.upper_bound ?? 0);

    insights.push(`基于 Tukey's IQR 原则计算，正常取值范围为 [${lowerBound} ~ ${upperBound}]。`);
    insights.push(`甄别出 ${rows.length} 条突破边界的离群极端值记录。`);
    insights.push(`异常判定仅基于当前资产样本的统计分布，不代表已确认的欺诈或风控故障。`);

    const cleanSql = `CREATE OR REPLACE VIEW "cleaned_${tableName}" AS
SELECT * FROM ${escapedTable}
WHERE ${numCol} >= ${lowerBound} AND ${numCol} <= ${upperBound};`;

    return withChart('iqr', 'IQR 异常值检测', {
      sql,
      rows,
      insights,
      extraStats: {
        q1,
        q3,
        iqr,
        lowerBound,
        upperBound,
        outlierCount: rows.length,
        cleanSql,
      },
      executionTimeMs: Math.round((performance.now() - startTime) * 10) / 10,
      chartType: 'table',
    });
  }

  if (recipeId === 'histogram') {
    const numCol = `"${String(params.numCol || 'amount').replace(/"/g, '""')}"`;
    const bucketCount = Number(params.bucketCount) || 8;

    sql = `
WITH stats AS (
  SELECT
    MIN(${numCol}) AS min_v,
    MAX(${numCol}) AS max_v
  FROM ${escapedTable}
  WHERE ${numCol} IS NOT NULL
),
binned AS (
  SELECT
    ${numCol} AS val,
    CASE WHEN s.max_v=s.min_v THEN 1 ELSE LEAST(${bucketCount}, GREATEST(1, FLOOR((CAST(${numCol} AS DOUBLE)-s.min_v)/NULLIF(s.max_v-s.min_v,0)*${bucketCount})+1)) END::INTEGER AS bucket_idx,
    s.min_v,
    s.max_v,
    (s.max_v - s.min_v) / ${bucketCount} AS bucket_width
  FROM ${escapedTable} t
  CROSS JOIN stats s
  WHERE ${numCol} IS NOT NULL
)
SELECT
  bucket_idx AS 分箱编号,
  CONCAT(
    ROUND(min_v + (bucket_idx - 1) * bucket_width, 8), 
    ' ~ ', 
    ROUND(min_v + bucket_idx * bucket_width, 8)
  ) AS 区间范围,
  COUNT(*) AS 样本频次,
  ROUND(COUNT(*) / NULLIF((SELECT COUNT(*) FROM binned), 0) * 100, 2) AS 频次占比_百分比
FROM binned
GROUP BY 1, 2
ORDER BY 1 ASC;`;

    const rawRows = await duckDBService.readQuery(sql);
    const rows = (rawRows || []) as Record<string, unknown>[];
    insights.push(`当前资产按 ${bucketCount} 个等宽区间分箱，其中 ${rows.length} 个区间有样本。`);
    const maxBucket = rows.slice().sort((a, b) => Number(b.样本频次) - Number(a.样本频次))[0];
    if (maxBucket) {
      insights.push(
        `最集中的核心波峰区间位于 [${maxBucket.区间范围}]，占全量样本的 ${maxBucket.频次占比_百分比}%。`,
      );
    }

    return withChart('histogram', '等宽区间频次分布', {
      sql,
      rows,
      insights,
      executionTimeMs: Math.round((performance.now() - startTime) * 10) / 10,
      chartType: 'bar',
      xKey: '区间范围',
      yKeys: ['样本频次'],
    });
  }

  // Default: Cohort retention
  const userCol = `"${String(params.userCol || 'customer_id').replace(/"/g, '""')}"`;
  const dateCol = `"${String(params.dateCol || 'order_date').replace(/"/g, '""')}"`;

  sql = `
WITH user_first_date AS (
  SELECT
    ${userCol} AS user_id,
    MIN(DATE_TRUNC('month', CAST(${dateCol} AS DATE))) AS cohort_month
  FROM ${escapedTable}
  WHERE ${userCol} IS NOT NULL AND ${dateCol} IS NOT NULL
  GROUP BY 1
),
activities AS (
  SELECT
    ${userCol} AS user_id,
    DATE_TRUNC('month', CAST(${dateCol} AS DATE)) AS activity_month
  FROM ${escapedTable}
  WHERE ${userCol} IS NOT NULL AND ${dateCol} IS NOT NULL
  GROUP BY 1, 2
)
SELECT
  STRFTIME(f.cohort_month, '%Y-%m') AS 初始群组月份,
  DATEDIFF('month', f.cohort_month, a.activity_month) AS 月度周期间隔,
  COUNT(DISTINCT a.user_id) AS 活跃用户数
FROM user_first_date f
JOIN activities a ON f.user_id = a.user_id
GROUP BY 1, 2
ORDER BY 1 ASC, 2 ASC
LIMIT 100;`;

  const rawRows = await duckDBService.readQuery(sql);
  const rows = (rawRows || []) as Record<string, unknown>[];
  insights.push(`完成多周期月度用户队列映射，支持跟踪新用户随时间衰减留存率。`);

  const cohortsSet = new Set<string>();
  let maxPeriod = 0;
  const countMap: Record<string, Record<number, number>> = {};

  rows.forEach((r) => {
    const cohort = String(r['初始群组月份']);
    const period = Number(r['月度周期间隔']);
    const cnt = Number(r['活跃用户数']);
    cohortsSet.add(cohort);
    if (period > maxPeriod) maxPeriod = period;
    if (!countMap[cohort]) countMap[cohort] = {};
    countMap[cohort][period] = cnt;
  });

  const sortedCohorts = Array.from(cohortsSet).sort();
  const cohortMatrix = sortedCohorts.map((cohort) => {
    const initialUsers = countMap[cohort]?.[0] || 1;
    const periodsData: { period: number; users: number; pct: number }[] = [];
    for (let p = 0; p <= maxPeriod; p++) {
      const u = countMap[cohort]?.[p];
      if (u !== undefined) {
        periodsData.push({
          period: p,
          users: u,
          pct: Math.round((u / initialUsers) * 1000) / 10,
        });
      }
    }
    return {
      cohort,
      initialUsers,
      periods: periodsData,
    };
  });

  return withChart('cohort', '同期群留存矩阵', {
    sql,
    rows,
    insights,
    extraStats: {
      cohortMatrix,
      maxPeriod,
    },
    executionTimeMs: Math.round((performance.now() - startTime) * 10) / 10,
    chartType: 'table',
    xKey: '初始群组月份',
    yKeys: ['活跃用户数'],
  });
}
