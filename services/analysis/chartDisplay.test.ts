/**
 * Chart display + formatter unit tests (no DuckDB).
 */

import { describe, it, expect } from 'vitest';
import { formatValueBySpec } from '../../utils/chartFormat';
import {
  applyMissingValuePolicy,
  computeSliceLabels,
  detectEmptyState,
  scanSignedDomain,
  sortRowsByTimeAxis,
  buildKpiCompare,
  buildFormatSpec,
  chartDimensionValue,
  computeCartesianSeries,
  computePivotTable,
  summarizeTableRows,
} from './chartDisplay';
import { createEmptySpec, emptyFilters } from './types';
import { mapResultToChartSpec, chartSpecToChartConfig } from './chartRegistry';

describe('formatValueBySpec', () => {
  it('formats currency compact and percent', () => {
    expect(formatValueBySpec(12400, { unit: '¥', compact: true })).toMatch(/¥/);
    expect(formatValueBySpec(23.6, { percent: true, decimals: 1 })).toBe('23.6%');
    expect(formatValueBySpec(null)).toBe('—');
  });
});

describe('chartDisplay', () => {
  it('never sums different currencies, percentages, rates or identifiers',()=>{
    const rows=[{unit:'USD',amount:100,orders:6,completed:5,success_pct:83.33,uid:1,rate_to_usdt:1},
      {unit:'BTC',amount:.081,orders:4,completed:4,success_pct:100,uid:2,rate_to_usdt:64500}];
    expect(summarizeTableRows(rows,Object.keys(rows[0]))).toEqual({orders:10,completed:9});
    expect(summarizeTableRows([rows[0]],Object.keys(rows[0]))).toEqual({amount:100,orders:6,completed:5});
  });
  it('retains repeated categories and null records when no aggregation is selected', () => {
    const chart = computeCartesianSeries([
      { region: 'East', amount: 100 }, { region: 'West', amount: 200 },
      { region: 'East', amount: null }, { region: 'East', amount: 75 },
    ], 'region', ['amount'], [], undefined, 'none', 'break', 'none');
    expect(chart.labels).toEqual(['East', 'West', 'East', 'East']);
    expect(chart.series[0].values).toEqual([100, 200, null, 75]);
  });
  it('retains every repeated category within a group without dropping other groups', () => {
    const chart = computeCartesianSeries([
      { day: 'Monday', region: 'East', amount: 100 },
      { day: 'Monday', region: 'West', amount: 200 },
      { day: 'Monday', region: 'East', amount: 75 },
    ], 'day', ['amount'], [], 'region', 'none', 'break', 'none');
    expect(chart.labels).toEqual(['Monday', 'Monday']);
    expect(chart.series.map(series => series.values)).toEqual([[100, 75], [200, null]]);
  });
  it('aggregates repeated categories only when the chosen calculation requests it', () => {
    const rows = [
      { region: 'East', amount: 100 }, { region: 'West', amount: 200 },
      { region: 'East', amount: 50 }, { region: 'East', amount: 75 },
    ];
    const sum = computeCartesianSeries(rows, 'region', ['amount'], [], undefined, 'none', 'break', 'sum');
    expect(sum.labels).toEqual(['East', 'West']);
    expect(sum.series[0].values).toEqual([225, 200]);
    const count = computeCartesianSeries([{ region: 'East', amount: null }], 'region', ['amount'], [], undefined, 'none', 'break', 'count');
    expect(count.series[0].values).toEqual([1]);
  });
  it('formats DuckDB date epochs in conventional sold_at fields without changing numeric measures', () => {
    expect(chartDimensionValue(1788220800000, 'sold_at')).toBe('2026-09-01');
    expect(chartDimensionValue(1788220800000, 'created_at_month')).toBe('2026-09-01');
    expect(chartDimensionValue('1788220800000', 'completed_on_week')).toBe('2026-09-01');
    expect(chartDimensionValue(1788220800000, 'amount_month')).toBe('1788220800000');
    expect(chartDimensionValue(1788220800000, 'amount')).toBe('1788220800000');
    expect(chartDimensionValue(1788220800000 + 3600000, 'sold_at')).toBe('2026-09-01T01:00:00.000Z');
  });
  it('honors an explicitly unitless metric instead of guessing currency from its table title', () => {
    const visual = createEmptySpec({ dataset: { table: 'sales' } }).visual;
    expect(buildFormatSpec('', { ...visual, title: 'sales 行数', format: { unit: '' } }, 'metric_value').unit).toBe('');
    expect(buildFormatSpec('行', { ...visual, title: 'sales 行数' }, 'metric_value').unit).toBe('行');
  });
  it('detects empty / all_null', () => {
    expect(detectEmptyState([], ['a']).emptyState).toBe('empty');
    expect(detectEmptyState([{ a: null }], ['a']).emptyState).toBe('all_null');
    expect(detectEmptyState([{ a: 1 }], ['a']).emptyState).toBe('ok');
  });

  it('scans signed domain for zero axis', () => {
    expect(scanSignedDomain([{ v: -1 }, { v: 2 }], ['v']).hasNegative).toBe(true);
    expect(scanSignedDomain([{ v: 1 }], ['v']).includeZero).toBe(true);
  });

  it('sorts time axis chronologically', () => {
    const { rows, timeSorted } = sortRowsByTimeAxis(
      [{ t: '2024-03-01', v: 1 }, { t: '2024-01-01', v: 2 }],
      't',
      true,
    );
    expect(timeSorted).toBe(true);
    expect(String(rows[0].t)).toContain('2024-01');
  });

  it('applies missing value policies', () => {
    const vals = [1, null, 3];
    expect(applyMissingValuePolicy(vals, 'zero')).toEqual([1, 0, 3]);
    expect(applyMissingValuePolicy(vals, 'forward_fill')).toEqual([1, 1, 3]);
    expect(applyMissingValuePolicy(vals, 'break')).toEqual([1, null, 3]);
  });

  it('computes pie slice labels from filtered rows', () => {
    const { sliceLabels, centerTotal } = computeSliceLabels(
      [
        { region: 'East', amt: 80 },
        { region: 'West', amt: 20 },
      ],
      'region',
      'amt',
      { unit: '¥' },
    );
    expect(centerTotal).toBe(100);
    expect(sliceLabels[0].percent).toBe(80);
    expect(sliceLabels[0].label).toMatch(/80/);
    expect(sliceLabels[0].label).toMatch(/%/);
  });

  it('hides kpi compare when baseline missing', () => {
    const spec = createEmptySpec({
      dataset: { table: 't' },
      dimensions: [{ id: 'd', column: 'x', alias: 'x' }],
      metrics: [{ id: 'm', column: 'v', agg: 'sum', alias: 'v' }],
      calcs: [{ id: 'y', kind: 'yoy', alias: '同比%', sourceMetricId: 'v' }],
      filters: emptyFilters(),
    });
    expect(buildKpiCompare({ v: 10, '同比%': null }, spec, {})).toHaveLength(0);
    expect(buildKpiCompare({ v: 10, '同比%': 12 }, spec, {})[0].baseline).toContain('同比');
  });
});

describe('chartRegistry display enrich', () => {
  it('bar ChartSpec carries format, brushField, legend bottom', () => {
    const spec = createEmptySpec({
      id: 's1',
      dataset: { table: 'orders' },
      dimensions: [{ id: 'd0', column: 'region', alias: 'region' }],
      metrics: [{ id: 'm0', column: 'amount', agg: 'sum', alias: '总金额', unitHint: '¥' }],
      filters: emptyFilters(),
      visual: { chartType: 'bar', title: '区域', showValues: true },
    });
    const chart = mapResultToChartSpec(
      [{ region: 'East', 总金额: 12000 }, { region: 'West', 总金额: -100 }],
      ['region', '总金额'],
      spec,
      {
        roles: { region: 'dimension', 总金额: 'metric' },
        dimAliases: ['region'],
        metricAliases: ['总金额'],
        calcAliases: [],
      },
    );
    expect(chart.legendPosition).toBe('bottom');
    expect(chart.brushField).toBe('region');
    expect(chart.hasNegative).toBe(true);
    expect(chart.includeZero).toBe(true);
    expect(chart.showValues).toBe(true);
    expect(chart.format?.unit).toBe('¥');
    const cfg = chartSpecToChartConfig(chart);
    expect(cfg.legendPosition).toBe('bottom');
    expect(cfg.sliceLabels).toBeUndefined();
  });

  it('pie ChartSpec precomputes slice percent labels', () => {
    const spec = createEmptySpec({
      id: 's2',
      dataset: { table: 'orders' },
      dimensions: [{ id: 'd0', column: 'region', alias: 'region' }],
      metrics: [{ id: 'm0', column: 'amount', agg: 'sum', alias: '总金额' }],
      filters: emptyFilters(),
      visual: { chartType: 'doughnut' },
    });
    const chart = mapResultToChartSpec(
      [{ region: 'A', 总金额: 75 }, { region: 'B', 总金额: 25 }],
      ['region', '总金额'],
      spec,
      {
        roles: { region: 'dimension', 总金额: 'metric' },
        dimAliases: ['region'],
        metricAliases: ['总金额'],
        calcAliases: [],
      },
    );
    expect(chart.sliceLabels?.length).toBe(2);
    expect(chart.centerTotal).toBe(100);
    expect(chart.sliceLabels![0].label).toMatch(/,/);
  });
});

it('pivot count counts non-null text records without numeric coercion', () => {
 const result=computePivotTable([{r:'A',c:'B',v:'record'},{r:'A',c:'B',v:''},{r:'A',c:'B',v:null}], 'r','c','v','count');
 expect(result.matrix.A.B).toBe(2); expect(result.grandTotal).toBe(2);
});
