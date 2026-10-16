import type { AnalysisSpec } from './types';
/** Monetary aggregates must have either a unit dimension or a single unit filter. */
export function validateMeasurementUnits(spec: AnalysisSpec): void {
  const unit = spec.fields.find(field => /^(currency|asset)$/i.test(field.column));
  const monetary = spec.metrics.some(metric => metric.agg !== 'count' && metric.agg !== 'count_distinct' && /amount|fee|price|revenue|balance/i.test(metric.column || ''));
  if (!unit || !monetary) return;
  const filtered = [...spec.filters.global,...spec.filters.interactive].some(filter => filter.column === unit.column && (filter.op === '=' && filter.value !== '' && filter.value != null || filter.op === 'in' && Array.isArray(filter.value) && filter.value.length === 1));
  if (!filtered && !spec.dimensions.some(dimension => dimension.column === unit.column)) throw new Error('金额聚合需选择一种计量资产，或把资产字段加入分组；不能直接合计不同币种');
  if (!filtered && spec.calcs.length) throw new Error('窗口与比例计算需先选择一种计量资产，避免跨币种比较');
}
