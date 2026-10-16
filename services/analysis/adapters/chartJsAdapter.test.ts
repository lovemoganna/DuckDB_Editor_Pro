import { describe, expect, it } from 'vitest';
import {
  computeHistogramBins,
  computeCartesianSeries,
  computePivotTable,
  filterSortTableRows,
  orderCategoryRows,
  computeScatterPoints,
  computeWaterfallSeries,
  buildKpiCards,
} from '../chartDisplay';
import { adaptChartSpec, resolveChartJsCtor } from './chartJsAdapter';
import { mapResultToChartSpec } from '../chartRegistry';
import { createEmptySpec, emptyFilters, type AnalysisSpec } from '../types';

describe('chartDisplay engine transforms', () => {
  it('aggregates grouped rows and computes percent stacks after filtering', () => {
    const rows = [
      { category: 'A', group: 'East', value: 2 },
      { category: 'A', group: 'East', value: 3 },
      { category: 'A', group: 'West', value: 5 },
      { category: 'B', group: 'East', value: null },
    ];
    const result = computeCartesianSeries(rows, 'category', ['value'], [], 'group', 'percent', 'break', 'sum');
    expect(result.labels).toEqual(['A', 'B']);
    expect(result.series[0].values).toEqual([50, null]);
    expect(result.series[1].values).toEqual([50, null]);
  });

  it('keeps all left and right metrics when categories are grouped', () => {
    const rows = [{ category: 'A', group: 'East', sales: 3, profit: 2, rate: 10 }];
    const result = computeCartesianSeries(rows, 'category', ['sales', 'profit'], ['rate'], 'group', 'none', 'break');
    expect(result.series.map((s) => [s.measure, s.axis])).toEqual([
      ['sales', 'y'], ['profit', 'y'], ['rate', 'y1'],
    ]);
  });

  it('sorts and limits categories before encoding', () => {
    const rows = [{ category: 'A', value: 2 }, { category: 'B', value: 8 }, { category: 'C', value: 5 }];
    expect(orderCategoryRows(rows, 'category', 'value', 'value_desc', 2).map((r) => r.category)).toEqual(['B', 'C']);
  });

  it('filters and totals pivot records without converting nulls to zero records', () => {
    const rows = [{ region: 'East', month: 'Jan', value: 2 }, { region: 'East', month: 'Jan', value: 3 }, { region: 'West', month: 'Jan', value: null }];
    const visible = filterSortTableRows(rows, { brush: { column: 'region', value: 'East' } });
    const pivot = computePivotTable(visible, 'region', 'month', 'value');
    expect(pivot.matrix.East.Jan).toBe(5);
    expect(pivot.grandTotal).toBe(5);
  });
  it('does not blank charts whose result has no field for a board brush', () => {
    const rows = [{ status: 'completed', count: 2 }];
    expect(filterSortTableRows(rows, { brush: { column: 'category', value: 'Clothing' } })).toEqual(rows);
  });
  it('renders DuckDB epoch dates as dates and links a selected date back to its raw row', () => {
    const rows = [{ order_date: 1704067200000, units: 12 }];
    const prepared = computeCartesianSeries(rows, 'order_date', ['units'], [], undefined, 'none', 'break');
    expect(prepared.labels).toEqual(['2024-01-01']);
    expect(filterSortTableRows(rows, { brush: { column: 'order_date', value: '2024-01-01' } })).toEqual(rows);
  });
  it('bins numeric values into equal-width histogram with percents', () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({ v: i }));
    const bins = computeHistogramBins(rows, 'v', 10);
    expect(bins).toHaveLength(10);
    expect(bins.reduce((s, b) => s + b.count, 0)).toBe(100);
    expect(bins[0].percent).toBeCloseTo(10, 0);
    expect(bins[0].label).toContain('–');
  });

  it('keeps narrow histogram interval labels distinct', () => {
    const bins = computeHistogramBins([{ v: 0 }, { v: 0.001 }, { v: 0.002 }], 'v', 3);
    expect(new Set(bins.map((bin) => bin.label)).size).toBe(3);
  });

  it('builds waterfall bases and deltas with total row', () => {
    const rows = [
      { step: '起始', amt: 100 },
      { step: '增长', amt: 40 },
      { step: '下降', amt: -20 },
      { step: '合计', amt: 120 },
    ];
    const wf = computeWaterfallSeries(rows, 'step', 'amt');
    expect(wf.labels).toEqual(['起始', '增长', '下降', '合计']);
    expect(wf.kinds).toEqual(['increase', 'increase', 'decrease', 'total']);
    expect(wf.deltas[3]).toBe(120);
    expect(wf.bases[3]).toBe(0);
  });

  it('builds scatter points and skips non-numeric', () => {
    const pts = computeScatterPoints(
      [
        { x: 1, y: 2, size: 5 },
        { x: 'a', y: 3 },
        { x: 4, y: 5, size: 10 },
      ],
      'x',
      'y',
      'size',
    );
    expect(pts).toHaveLength(2);
    expect(pts[0]).toMatchObject({ x: 1, y: 2 });
    expect(pts[0].r).toBeGreaterThan(0);
  });

  it('formats kpi cards via shared formatter', () => {
    const cards = buildKpiCards(
      { revenue: 12500, orders: 3 },
      ['revenue', 'orders'],
      { unit: '¥', compact: true, thousandSeparator: true },
    );
    expect(cards).toHaveLength(2);
    expect(cards[0].formatted).toMatch(/¥|12/);
  });
});

describe('chartJsAdapter', () => {
  it('maps semantic types to Chart.js constructors', () => {
    expect(resolveChartJsCtor('funnel')).toBe('bar');
    expect(resolveChartJsCtor('waterfall')).toBe('bar');
    expect(resolveChartJsCtor('histogram')).toBe('bar');
    expect(resolveChartJsCtor('combo')).toBe('bar');
    expect(resolveChartJsCtor('area')).toBe('line');
    expect(resolveChartJsCtor('kpi')).toBeNull();
  });

  it('adapts doughnut Spec to canvas bundle with center total', () => {
    const rows = [
      { region: 'East', amount: 80 },
      { region: 'West', amount: 20 },
    ];
    const spec = createEmptySpec({
      id: 't1',
      dataset: { table: 't' },
      dimensions: [{ id: 'd0', column: 'region', alias: 'region' }],
      metrics: [{ id: 'm0', column: 'amount', agg: 'sum', alias: 'amount' }],
      filters: emptyFilters(),
      visual: { chartType: 'doughnut', title: '份额', encoding: { x: 'region', y: ['amount'] } },
    }) as AnalysisSpec;
    const chart = mapResultToChartSpec(rows, ['region', 'amount'], spec, {
      roles: { region: 'dimension', amount: 'metric' },
      dimAliases: ['region'],
      metricAliases: ['amount'],
      calcAliases: [],
    });
    const bundle = adaptChartSpec(chart);
    expect(bundle.kind).toBe('canvas');
    if (bundle.kind === 'canvas') {
      expect(bundle.chartJsType).toBe('doughnut');
      expect(bundle.semanticType).toBe('doughnut');
      expect(chart.centerTotal).toBe(100);
    }
  });

  it('adapts kpi Spec to kpi bundle', () => {
    const rows = [{ revenue: 1000 }];
    const spec = createEmptySpec({
      id: 'k1',
      dataset: { table: 't' },
      dimensions: [],
      metrics: [{ id: 'm0', column: 'revenue', agg: 'sum', alias: 'revenue', unitHint: '¥' }],
      filters: emptyFilters(),
      visual: { chartType: 'kpi', title: '营收', encoding: { y: ['revenue'] } },
    }) as AnalysisSpec;
    const chart = mapResultToChartSpec(rows, ['revenue'], spec, {
      roles: { revenue: 'metric' },
      dimAliases: [],
      metricAliases: ['revenue'],
      calcAliases: [],
    });
    const bundle = adaptChartSpec(chart);
    expect(bundle.kind).toBe('kpi');
    if (bundle.kind === 'kpi') {
      expect(bundle.cards.length).toBeGreaterThanOrEqual(1);
      expect(bundle.cards[0].formatted).toBeTruthy();
    }
  });

  it('adapts histogram Spec with engine bins', () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({ score: i * 2 }));
    const spec = createEmptySpec({
      id: 'h1',
      dataset: { table: 't' },
      dimensions: [],
      metrics: [{ id: 'm0', column: 'score', agg: 'sum', alias: 'score' }],
      filters: emptyFilters(),
      visual: {
        chartType: 'histogram',
        title: '分布',
        encoding: { y: ['score'] },
        binCount: 5,
      },
    }) as AnalysisSpec;
    const chart = mapResultToChartSpec(rows, ['score'], spec, {
      roles: { score: 'metric' },
      dimAliases: [],
      metricAliases: ['score'],
      calcAliases: [],
    });
    expect(chart.histogramBins?.length).toBe(5);
    const bundle = adaptChartSpec(chart);
    expect(bundle.kind).toBe('canvas');
    if (bundle.kind === 'canvas') {
      expect(bundle.chartJsType).toBe('bar');
      expect((bundle.data.labels as string[]).length).toBe(5);
    }
  });

  it('adapts waterfall Spec to signed floating bars', () => {
    const rows = [
      { step: 'A', v: 50 },
      { step: 'B', v: 30 },
      { step: '合计', v: 80 },
    ];
    const spec = createEmptySpec({
      id: 'w1',
      dataset: { table: 't' },
      dimensions: [{ id: 'd0', column: 'step', alias: 'step' }],
      metrics: [{ id: 'm0', column: 'v', agg: 'sum', alias: 'v' }],
      filters: emptyFilters(),
      visual: { chartType: 'waterfall', title: '瀑布', encoding: { x: 'step', y: ['v'] } },
    }) as AnalysisSpec;
    const chart = mapResultToChartSpec(rows, ['step', 'v'], spec, {
      roles: { step: 'dimension', v: 'metric' },
      dimAliases: ['step'],
      metricAliases: ['v'],
      calcAliases: [],
    });
    expect(chart.waterfall?.kinds).toContain('total');
    const bundle = adaptChartSpec(chart);
    expect(bundle.kind).toBe('canvas');
    if (bundle.kind === 'canvas') {
      expect(bundle.data.datasets.length).toBe(1);
      expect((bundle.data.datasets[0] as { data: number[][] }).data[1]).toEqual([50, 80]);
    }
  });
});
