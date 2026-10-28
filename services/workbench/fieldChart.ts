import type { ChartConfig, SavedQuery } from '../../types';
import type { DatasetDefinition, WidgetQuerySpec } from './analysisTypes';
import { compileAnalysis } from './queryCompiler';

export const isNumericField = (type: string) => /INT|DECIMAL|DOUBLE|FLOAT|REAL|NUMERIC/i.test(type);
export const isTemporalField = (type: string) => /DATE|TIME/i.test(type);

/** One definition for preview and persistence; SQL generation stays in the existing compiler. */
export function fieldChartQuery(dataset: DatasetDefinition, datasets: DatasetDefinition[], input: {
  name: string; dimension: string; series: string; measure: string;
  aggregation: WidgetQuerySpec['aggregation']; timeGrain?: WidgetQuerySpec['timeGrain']; type: ChartConfig['type'];
}): SavedQuery {
  if (input.aggregation !== 'COUNT' && input.aggregation !== 'DETAIL' &&
      !dataset.fields.some(f => f.name === input.measure && isNumericField(f.type))) throw new Error('请选择数值指标');
  const unitNames = input.measure.startsWith('right_') ? /^right_(currency|asset|quote_currency)$/i : /^(currency|asset|quote_currency)$/i;
  const unit = ['COUNT', 'DETAIL'].includes(input.aggregation) ? undefined : dataset.fields.find(f => unitNames.test(f.name));
  const dimensions = input.aggregation === 'DETAIL' ? [] : [...new Set([input.dimension, input.series, unit?.name].filter(Boolean))] as string[];
  if (dimensions.length > 2) throw new Error('当前图表支持两个分组字段；请将第二维度设为金额单位，避免混合单位');
  const spec: WidgetQuerySpec = {datasetId: dataset.id, dimensions, aggregation: input.aggregation,
    measure: input.measure || undefined, timeGrain: input.aggregation === 'DETAIL' ? undefined : input.timeGrain};
  const compiled = compileAnalysis({sql: '', catalog: dataset.catalog, schema: dataset.schema, datasets, spec});
  const type = input.aggregation === 'DETAIL' ? 'table' : input.type === 'counter' && dimensions.length ? (dimensions.length > 1 ? 'table' : 'bar') : input.type;
  if (!dimensions.length && !['counter', 'table'].includes(type)) throw new Error('请先选择一个维度，或使用指标卡');
  if (dimensions.length > 1 && ['pie', 'doughnut'].includes(type)) throw new Error('饼图和环形图使用一个维度；请改用柱状图或数据表');
  const config: ChartConfig = {id: 'field-chart', title: input.name.trim() || dataset.table || dataset.name, type,
    xKey: dimensions[0] || '', yKeys: ['value'], groupBy: dimensions[1], aggregation: 'none'};
  return {id: 'field-preview', databaseName: dataset.catalog, name: config.title, sql: compiled.sql,
    createdAt: 0, datasetId: dataset.id, querySpec: spec, charts: [config],
    widgetType: type === 'counter' ? 'value' : type === 'table' ? 'table' : 'chart'};
}
