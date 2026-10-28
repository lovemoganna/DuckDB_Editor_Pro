import type { MetricDefinition } from '../types';
import { quoteIdent, quoteTable } from './analysis/sqlUtils';
import { requireAnalysisQuery } from './analysis/readQueryGuard';
import type { MetricMeasure } from '../types/metric';

export const METRIC_AGGREGATIONS = ['COUNT', 'COUNT DISTINCT', 'SUM', 'AVG', 'MIN', 'MAX', 'MEDIAN', 'QUANTILE', 'STDDEV_SAMP', 'STDDEV_POP', 'VAR_SAMP', 'VAR_POP', 'WEIGHTED_AVG', 'RATIO'] as const;
export const METRIC_GRAINS = ['hour', 'day', 'week', 'month', 'quarter', 'year'] as const;

function measureSql(measure: MetricMeasure | undefined): string {
  if (!measure || !['COUNT', 'COUNT DISTINCT', 'SUM'].includes(measure.aggregation)) throw new Error('请配置分子和分母的聚合方式');
  if (measure.aggregation !== 'COUNT' && !measure.field) throw new Error('请选择分子 / 分母计算字段');
  const operand = measure.field ? quoteIdent(measure.field) : '*';
  return `${measure.aggregation === 'COUNT DISTINCT' ? `COUNT(DISTINCT ${operand})` : `${measure.aggregation}(${operand})`}${measure.filter?.trim() ? ` FILTER (WHERE (${measure.filter.trim()}))` : ''}`;
}

export function metricCalculationFields(metric: MetricDefinition): string[] {
  const c = metric.calculation;
  if (!c) return metric.dependencies || [];
  return [...new Set([c.aggregation === 'RATIO' ? undefined : c.field, c.aggregation === 'WEIGHTED_AVG' ? c.weightField : undefined,
    ...(c.aggregation === 'RATIO' ? [c.numerator?.field, c.denominator?.field] : []), ...(c.groupBy || []), c.grain ? c.timeField : undefined].filter(Boolean) as string[])];
}

/** A metric owns its source. A multi-table package is never an implicit source. */
export function metricSource(metric: MetricDefinition, tables: string[]): string {
  return metric.sourceTable || (tables.length === 1 ? tables[0] : '');
}

export function compileMetricSql(metric: MetricDefinition, fallbackSource = ''): string {
  const source = metric.sourceTable || fallbackSource;
  const calculation = metric.calculation;
  if (calculation) {
    if (!source) throw new Error('请选择指标来源表');
    const { aggregation, field, filter, timeField, grain } = calculation;
    if (!(METRIC_AGGREGATIONS as readonly string[]).includes(aggregation)) throw new Error('无效聚合方式');
    if (!['COUNT', 'RATIO'].includes(aggregation) && !field) throw new Error('请选择计算字段');
    const operand = field ? quoteIdent(field) : '*';
    let aggregate = aggregation === 'COUNT DISTINCT' ? `COUNT(DISTINCT ${operand})` : `${aggregation}(${operand})`;
    if (aggregation === 'QUANTILE') {
      if (typeof calculation.quantile !== 'number' || !Number.isFinite(calculation.quantile) || calculation.quantile < 0 || calculation.quantile > 1) throw new Error('分位点必须在 0 到 1 之间');
      aggregate = `quantile_cont(${operand}, ${calculation.quantile})`;
    }
    if (aggregation === 'WEIGHTED_AVG') {
      if (!calculation.weightField) throw new Error('请选择权重字段');
      const weight = quoteIdent(calculation.weightField);
      // Paired non-null observations; zero total weight remains undefined, not infinity.
      aggregate = `SUM(CAST(${operand} AS DOUBLE) * CAST(${weight} AS DOUBLE)) / NULLIF(SUM(CAST(${weight} AS DOUBLE)) FILTER (WHERE ${operand} IS NOT NULL), 0)`;
    }
    if (aggregation === 'RATIO') {
      if (calculation.scale !== undefined && ![1, 100].includes(calculation.scale)) throw new Error('比率倍率必须为 1 或 100');
      aggregate = `(${measureSql(calculation.numerator)}) * ${calculation.scale || 1}.0 / NULLIF((${measureSql(calculation.denominator)}), 0)`;
    }
    const groups = calculation.groupBy || [];
    if (new Set(groups).size !== groups.length || groups.some(name => ['period', 'value', 'base_value', 'previous_value'].includes(name.toLowerCase()))) throw new Error('分组维度重复或与结果保留列名冲突');
    const dimensions = groups.map(quoteIdent);
    if (grain) {
      if (!timeField || !(METRIC_GRAINS as readonly string[]).includes(grain)) throw new Error('请选择有效时间字段和统计粒度');
      dimensions.unshift(`date_trunc('${grain}', ${quoteIdent(timeField)}) AS period`);
    }
    const positions = dimensions.map((_, index) => index + 1).join(', ');
    const base = `SELECT ${[...dimensions, `${aggregate} AS value`].join(', ')} FROM ${quoteTable(source)}${filter?.trim() ? ` WHERE (${filter.trim()})` : ''}${positions ? ` GROUP BY ${positions}` : ''}`;
    const transform = calculation.transform || 'none';
    if (transform === 'none') return requireAnalysisQuery(`${base}${positions ? ` ORDER BY ${positions}` : ''}`);
    if (!['cumulative', 'rolling', 'previous_growth', 'year_growth'].includes(transform)) throw new Error('无效分析变换');
    if (!grain || !timeField) throw new Error('时间分析需要时间字段和统计粒度');
    const groupSql = groups.map(quoteIdent);
    const partition = groupSql.length ? `PARTITION BY ${groupSql.join(', ')} ` : '';
    const output = ['period', ...groupSql].join(', ');
    if (transform === 'cumulative' || transform === 'rolling') {
      if (!['COUNT', 'SUM'].includes(aggregation)) throw new Error('累计 / 滚动求和仅适用于可加的 COUNT / SUM；去重、比率和均值须在窗口原始数据上重新计算');
      if (metric.governance?.additivity && metric.governance.additivity !== 'additive') throw new Error('该指标声明为非完全可加，不能直接累计 / 滚动求和');
      const periods = calculation.windowPeriods ?? 7;
      if (!Number.isInteger(periods) || periods < 1 || periods > 10000) throw new Error('窗口期数必须为 1 到 10000 的整数');
      const frame = transform === 'cumulative' ? 'ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW'
        : `RANGE BETWEEN INTERVAL '${(periods - 1) * (grain === 'quarter' ? 3 : 1)} ${grain === 'quarter' ? 'month' : grain}' PRECEDING AND CURRENT ROW`;
      return requireAnalysisQuery(`WITH metric_base AS (${base}) SELECT ${output}, SUM(value) OVER (${partition}ORDER BY period ${frame}) AS value, value AS base_value FROM metric_base ORDER BY ${output}`);
    }
    const interval = transform === 'year_growth' ? '1 year' : `${grain === 'quarter' ? 3 : 1} ${grain === 'quarter' ? 'month' : grain}`;
    const joins = groups.map(name => `c.${quoteIdent(name)} IS NOT DISTINCT FROM p.${quoteIdent(name)}`);
    return requireAnalysisQuery(`WITH metric_base AS (${base}) SELECT ${['c.period', ...groupSql.map(name => `c.${name}`)].join(', ')}, (c.value - p.value) * 100.0 / NULLIF(p.value, 0) AS value, c.value AS base_value, p.value AS previous_value FROM metric_base c LEFT JOIN metric_base p ON c.period = p.period + INTERVAL '${interval}'${joins.length ? ` AND ${joins.join(' AND ')}` : ''} ORDER BY ${['c.period', ...groupSql.map(name => `c.${name}`)].join(', ')}`);
  }
  const formula = (metric.formula || '').trim();
  if (!formula) throw new Error('指标缺少计算公式');
  const head = formula.replace(/^\s*(?:(?:--[^\n]*(?:\n|$))|(?:\/\*[\s\S]*?\*\/))*/g, '').trim();
  if (/^(?:select|with|values)\b/i.test(head)) return requireAnalysisQuery(formula);
  if (!source) throw new Error('指标未绑定来源表；多表指标包必须为每个指标明确来源或填写完整 SQL');
  return requireAnalysisQuery(`SELECT ${formula} AS ${quoteIdent(metric.name)} FROM ${quoteTable(source)}`);
}
