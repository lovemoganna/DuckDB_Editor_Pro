import { describe, expect, it } from 'vitest';
import { widgetRowsToChartSpec } from './adapters/dashboardWidgetAdapter';
import { listChartTypes } from './chartRegistry';
import { adaptChartSpec } from './adapters/chartJsAdapter';
import { chartNumber, formatValueBySpec } from '../../utils/chartFormat';
import { computeHistogramBins, computePivotTable } from './chartDisplay';
import type { ChartConfig } from '../../types';

const config = (patch: Partial<ChartConfig> = {}): ChartConfig => ({
  id: 'contract', title: '金额', type: 'bar', xKey: 'category', yKeys: ['amount'], unit: 'USD', ...patch,
});
const canvas = (rows: Record<string, unknown>[], patch: Partial<ChartConfig> = {}) => {
  const spec = widgetRowsToChartSpec(rows, config(patch));
  const bundle = adaptChartSpec(spec);
  if (bundle.kind !== 'canvas') throw new Error(JSON.stringify(bundle));
  return { spec, bundle };
};

describe('global visualization contract', () => {
  for (const { id } of listChartTypes()) {
    it(`${id}: clears an empty result through the common renderer contract`, () => {
      const spec = widgetRowsToChartSpec([], config({ type: id }));
      expect(spec.emptyState).toBe('empty');
      expect(adaptChartSpec(spec)).toEqual({ kind: 'empty', message: '当前筛选无数据' });
    });
  }
  it('does not put incompatible measures on one axis', () => {
    const spec = widgetRowsToChartSpec([{ category: 'A', amount: 8, success_pct: 20 }], config({
      yKeys: ['amount', 'success_pct'], formatByKey: { amount: { unit: 'USD' }, success_pct: { unit: '%', percent: true } },
    }));
    expect(spec.emptyState).toBe('error');
    expect(adaptChartSpec(spec).kind).toBe('empty');
  });
  it('splits scatter colors by their bound dimension without losing records', () => {
    const { spec, bundle } = canvas([{ x: 1, amount: 8, segment: 'A' }, { x: 2, amount: 9, segment: 'B' }], { type: 'scatter', xKey: 'x', colorKey: 'segment' });
    expect(spec.scatterSeries?.map(series => series.label)).toEqual(['amount · A', 'amount · B']);
    expect(bundle.data.datasets).toHaveLength(2);
  });
  it('maps numeric color and size fields without creating one series per number', () => {
    const {spec,bundle}=canvas([{x:1,amount:8,color:10,size:100},{x:2,amount:9,color:20,size:1000}],{type:'scatter',xKey:'x',colorKey:'color',sizeKey:'size'});
    expect(spec.scatterSeries).toHaveLength(1);
    expect(spec.colorScale).toEqual({field:'color',min:10,max:20});
    expect(spec.scatterPoints?.map(point=>point.r)).toEqual([3,18]);
    expect(spec.scatterPoints?.map(point=>point.colorRatio)).toEqual([0,1]);
    expect(bundle.data.datasets).toHaveLength(1);
  });
  it('shows every bar value and the hovered line point', () => {
    const bar = canvas([{ category: 'A', amount: 8 }]).bundle;
    expect(bar.options.plugins.datalabels.display({})).toBe(true);
    const line = canvas([{ category: 'A', amount: 8 }], { type: 'line', showValues: true }).bundle;
    expect(line.options.plugins.datalabels.display({ active: true })).toBe(true);
    expect(line.options.plugins.datalabels.display({ active: false })).toBe(false);
  });
  it('keeps linked dimensions intact when binding a separate label field', () => {
    const spec=widgetRowsToChartSpec([{category:'key-1',caption:'可读名称',amount:10}],config({labelKey:'caption'}));
    const linked:unknown[]=[];
    const bundle=adaptChartSpec(spec,{onBrush:(...args)=>linked.push(args)});
    if(bundle.kind!=='canvas') throw new Error('expected canvas');
    expect(bundle.data.labels).toEqual(['可读名称']);
    bundle.options.onClick?.({},[{index:0}]);
    expect(linked).toEqual([['category','key-1']]);
  });
  it('rejects booleans, blank text, objects and non-finite numbers as measures', () => {
    for (const value of [true, false, '  ', [], {}, Infinity, NaN]) expect(chartNumber(value)).toBeNull();
    expect(formatValueBySpec(Infinity)).toBe('—');
    expect(formatValueBySpec(NaN)).toBe('—');
  });
  it('does not silently turn signed data into a positive composition', () => {
    const rows = [{ category: 'A', amount: 8 }, { category: 'B', amount: -2 }];
    for (const type of ['pie', 'doughnut'] as const) expect(widgetRowsToChartSpec(rows, config({ type })).emptyState).toBe('error');
    expect(widgetRowsToChartSpec(rows, config({ stackMode: 'percent' })).emptyState).toBe('error');
  });
  it('does not render an all-zero composition as a chart', () => {
    expect(widgetRowsToChartSpec([{ category: 'A', amount: 0 }], config({ type: 'pie' })).emptyState).toBe('empty');
  });
  it('honors arc label visibility and indexes repeated categories correctly', () => {
    const { spec, bundle } = canvas([{ category: 'A', amount: 80 }, { category: 'A', amount: 20 }], { type: 'pie', showValues: false });
    expect(spec.labelMode).toBe('never');
    const label = bundle.options.plugins.tooltip.callbacks.label;
    expect(label({ label: 'A', dataIndex: 1, parsed: 20 })).toContain('20%');
  });
  it('applies percent domains to the horizontal numeric axis', () => {
    const { bundle } = canvas([{ category: 'A', amount: 8, other: 2 }], { yKeys: ['amount', 'other'], horizontal: true, stackMode: 'percent' });
    expect(bundle.options.scales.x).toMatchObject({ min: 0, max: 100, beginAtZero: true });
    expect(bundle.options.scales.y).not.toMatchObject({ max: 100 });
  });
  it('formats right-axis labels with their own unit', () => {
    const { bundle } = canvas([{ category: 'A', amount: 8, success_pct: 20 }], { type: 'combo', yRightKeys: ['success_pct'], unitRight: '%' });
    expect(bundle.options.plugins.datalabels.formatter(20, { dataset: { metricKey: 'success_pct', yAxisID: 'y1' } })).toBe('20%');
  });
  it('keeps full scatter record identity and uses the requested brush field', () => {
    const spec = widgetRowsToChartSpec([{ x: 1, y: 2, record: 'customer-42' }], config({ type: 'scatter', xKey: 'x', yKeys: ['y'], brushField: 'record' }));
    const received: unknown[] = [];
    const bundle = adaptChartSpec(spec, { onBrush: (...args) => received.push(args) });
    expect(bundle.kind).toBe('canvas');
    if (bundle.kind !== 'canvas') return;
    expect(bundle.options.plugins.tooltip.callbacks.label({ dataIndex: 0, datasetIndex: 0 })).toContain('customer-42');
    bundle.options.onClick?.({}, [{ index: 0, datasetIndex: 0 }]);
    expect(received).toEqual([['record', 'customer-42']]);
  });
  it('uses chronological order for period/date fields and keeps missing values', () => {
    const { spec } = canvas([{ period: '2025-10-01', amount: null }, { period: '2025-02-01', amount: 8 }], { type: 'line', xKey: 'period' });
    expect(spec.cartesian?.labels).toEqual(['2025-02-01', '2025-10-01']);
    expect(spec.cartesian?.series[0].values).toEqual([8, null]);
  });
  it('normalizes bin counts and safely handles prototype-like dimension values', () => {
    const rows = [{ v: 0 }, { v: 10 }];
    expect(computeHistogramBins(rows, 'v', 2.5)).toHaveLength(2);
    expect(computeHistogramBins(rows, 'v', NaN).reduce((n, b) => n + b.count, 0)).toBe(2);
    const pivot = computePivotTable([{ r: '__proto__', c: 'constructor', v: 5 }], 'r', 'c', 'v');
    expect(pivot.matrix.__proto__.constructor).toBe(5);
  });
});
