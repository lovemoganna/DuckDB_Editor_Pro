import type { MetricDefinition } from '../types';
import { quoteIdent, quoteTable } from './analysis/sqlUtils';
import { requireAnalysisQuery } from './analysis/readQueryGuard';

export const METRIC_RECIPES = [
  { id: 'retention', title: '严格第 N 日留存', fields: ['entity', 'time', 'event'], note: '按观测历史中首次入组事件分 cohort，以成熟 cohort 主体为分母；指定第 N 个业务日期回访，主体去重。需保证历史覆盖首次入组。' },
  { id: 'funnel', title: '两步有序主体漏斗', fields: ['entity', 'time', 'event'], note: '每主体首次起始事件作为一次机会；完成事件必须严格晚于起点，且在窗口内。仅纳入观察窗口完整的主体，不做重复机会或多触点归因。' },
  { id: 'snapshot', title: '主体期末快照汇总', fields: ['entity', 'time', 'value', 'tie'], note: '先取每主体每月最后一条记录再求和；并列时间按唯一排序键降序取值。只报告当月有记录的主体，不自动前向填充缺失月份。' },
  { id: 'share', title: '分组构成占比', fields: ['dimension', 'value'], note: '先按维度求和，再除以所有组总量；适用于可加且口径一致的数值。零总量返回 NULL，保留全部组。' },
] as const;
export type MetricRecipeId = typeof METRIC_RECIPES[number]['id'];
export interface MetricRecipeBinding {
  source: string;
  fields: Record<string, string>;
  startEvent?: string;
  endEvent?: string;
  days?: number;
  /** Exclusive observation cutoff in the declared business timezone. */
  cutoff?: string;
}

export function buildMetricRecipe(id: MetricRecipeId, binding: MetricRecipeBinding): Omit<MetricDefinition, 'id' | 'createdAt'> {
  const recipe = METRIC_RECIPES.find(item => item.id === id);
  if (!recipe || !binding.source) throw new Error('请选择分析方法与真实来源表');
  for (const role of recipe.fields) if (!binding.fields[role]) throw new Error(`请选择 ${role} 对应字段`);
  const table = quoteTable(binding.source);
  const col = (role: string) => quoteIdent(binding.fields[role]);
  const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;
  let sql = '';
  const isEvent = id === 'retention' || id === 'funnel';
  if (isEvent) {
    if (!binding.startEvent?.trim() || !binding.endEvent?.trim()) throw new Error('请填写起始事件与回访 / 完成事件的实际取值');
    if (!Number.isInteger(binding.days) || binding.days! < 1 || binding.days! > 3650) throw new Error('观察天数必须为 1 到 3650 的整数');
    if (!binding.cutoff || !/^\d{4}-\d{2}-\d{2}$/.test(binding.cutoff) || Number.isNaN(Date.parse(binding.cutoff)) || new Date(binding.cutoff).toISOString().slice(0, 10) !== binding.cutoff) throw new Error('请填写有效观察截止日期（不含当日）');
    const events = `SELECT ${col('entity')} AS entity_id, ${col('time')} AS event_time, ${col('event')} AS event_name FROM ${table} WHERE ${col('entity')} IS NOT NULL AND ${col('time')} IS NOT NULL AND ${col('time')} < DATE ${literal(binding.cutoff)}`;
    const start = literal(binding.startEvent), end = literal(binding.endEvent), days = binding.days;
    if (id === 'retention') sql = `WITH events AS (${events}), cohort AS (
      SELECT entity_id, CAST(MIN(event_time) AS DATE) AS cohort_date FROM events WHERE event_name = ${start} GROUP BY entity_id
    ), activity AS (SELECT DISTINCT entity_id, CAST(event_time AS DATE) AS active_date FROM events WHERE event_name = ${end})
    SELECT c.cohort_date AS period, COUNT(*) AS cohort_size, COUNT(a.entity_id) AS retained_entities,
      COUNT(a.entity_id) * 100.0 / NULLIF(COUNT(*), 0) AS value
    FROM cohort c LEFT JOIN activity a ON a.entity_id = c.entity_id AND a.active_date = c.cohort_date + INTERVAL '${days} day'
    WHERE c.cohort_date + INTERVAL '${days} day' < DATE ${literal(binding.cutoff)} GROUP BY c.cohort_date ORDER BY c.cohort_date`;
    else sql = `WITH events AS (${events}), entries AS (
      SELECT entity_id, MIN(event_time) AS start_time FROM events WHERE event_name = ${start} GROUP BY entity_id
    ), opportunities AS (SELECT e.*, EXISTS(SELECT 1 FROM events x WHERE x.entity_id = e.entity_id AND x.event_name = ${end}
      AND x.event_time > e.start_time AND x.event_time <= e.start_time + INTERVAL '${days} day') AS converted
      FROM entries e WHERE e.start_time + INTERVAL '${days} day' < DATE ${literal(binding.cutoff)})
    SELECT CAST(start_time AS DATE) AS period, COUNT(*) AS opportunities, COUNT(*) FILTER (WHERE converted) AS converted_entities,
      COUNT(*) FILTER (WHERE converted) * 100.0 / NULLIF(COUNT(*), 0) AS value FROM opportunities GROUP BY 1 ORDER BY 1`;
  } else if (id === 'snapshot') sql = `WITH ranked AS (
    SELECT ${col('entity')} AS entity_id, date_trunc('month', ${col('time')}) AS period, ${col('value')} AS amount,
      ROW_NUMBER() OVER (PARTITION BY ${col('entity')}, date_trunc('month', ${col('time')}) ORDER BY ${col('time')} DESC, ${col('tie')} DESC) AS rn
    FROM ${table} WHERE ${col('entity')} IS NOT NULL AND ${col('time')} IS NOT NULL)
    SELECT period, SUM(amount) AS value, COUNT(*) AS observed_entities, COUNT(amount) AS valued_entities FROM ranked WHERE rn = 1 GROUP BY period ORDER BY period`;
  else sql = `WITH grouped AS (SELECT ${col('dimension')} AS dimension, SUM(${col('value')}) AS amount FROM ${table} GROUP BY 1)
    SELECT dimension, amount, amount * 100.0 / NULLIF(SUM(amount) OVER (), 0) AS value FROM grouped ORDER BY amount DESC NULLS LAST`;
  return { name: id === 'retention' ? `day_${binding.days}_retention` : id === 'funnel' ? `ordered_${binding.days}d_conversion` : id === 'snapshot' ? 'monthly_closing_snapshot' : 'group_share',
    sourceTable: binding.source, scenario: recipe.title, definition: `${recipe.note}${isEvent ? ` 起点=${binding.startEvent}；终点=${binding.endEvent}；天数=${binding.days}；观察截止（不含）=${binding.cutoff}。` : ''}`,
    formula: requireAnalysisQuery(sql), dependencies: [...new Set(recipe.fields.map(role => binding.fields[role]))],
    characteristics: id === 'snapshot' ? '沿时间半可加；缺失主体需另外核对' : '不可直接跨组 / 跨期累加',
    value: '在显式主体、时间和范围约束下复算', example: '使用当前来源数据执行核验', unit: id === 'snapshot' ? '' : '%',
    governance: { reviewStatus: 'draft', additivity: id === 'snapshot' ? 'semi_additive' : 'non_additive', entity: binding.fields.entity,
      sourceGrain: isEvent ? '一行一事件（需核对历史完整性）' : id === 'snapshot' ? '一行一主体快照；时间与排序键应唯一' : '一行一可加事实（需核对）' } };
}
