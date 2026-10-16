import { describe, expect, it } from 'vitest';
import { widgetRowsToChartSpec } from './adapters/dashboardWidgetAdapter';
import { adaptChartSpec } from './adapters/chartJsAdapter';
import { filterSortTableRows } from './chartDisplay';
import { inferChartUnit } from '../../utils/chartFormat';
import type { ChartConfig } from '../../types';
import { chartWindow } from './chartWindow';

const config = (patch: Partial<ChartConfig> = {}): ChartConfig => ({
  id: 'boundary', title: 'Amount', type: 'bar', xKey: 'category', yKeys: ['amount'], ...patch,
});

describe('visualization calculation and binding boundaries', () => {
  it.each(['bar', 'line', 'area', 'pie', 'doughnut', 'kpi', 'funnel', 'waterfall', 'histogram', 'combo'] as const)(
    '%s rejects a partially invalid measure instead of silently removing it', type => {
      const spec = widgetRowsToChartSpec([{ category: 'A', amount: 5 }, { category: 'B', amount: 'invalid' }], config({ type }));
      expect(spec.emptyState).toBe('error');
      expect(spec.emptyMessage).toContain('amount');
    },
  );

  it('ranks TopN using the selected average rather than the raw sum', () => {
    const rows = [{ category: 'A', amount: 6 }, { category: 'A', amount: 6 }, { category: 'B', amount: 10 }];
    const spec = widgetRowsToChartSpec(rows, config({ aggregation: 'avg', topN: 1 }));
    expect(spec.cartesian?.labels).toEqual(['B']);
    expect(spec.cartesian?.series[0].values).toEqual([10]);
    const minimum = widgetRowsToChartSpec(rows, config({ aggregation: 'min', categorySort: 'value_asc', topN: 1 }));
    expect(minimum.cartesian?.labels).toEqual(['A']);
  });

  it('counts rows including null measures, with a count unit and a nonempty state', () => {
    const spec = widgetRowsToChartSpec([{ category: 'A', amount: null }, { category: 'A', amount: null }], config({ aggregation: 'count', unit: 'USD' }));
    expect(spec.emptyState).toBe('ok');
    expect(spec.cartesian?.series[0].values).toEqual([2]);
    expect(spec.formatByKey?.amount).toMatchObject({ unit: '个', percent: false, decimals: 0 });
    const text = widgetRowsToChartSpec([{ category: 'A', amount: 'text' }], config({ aggregation: 'count' }));
    expect(text.emptyState).toBe('ok');
    expect(text.cartesian?.series[0].values).toEqual([1]);
  });

  it('applies an explicit KPI aggregation to every filtered record', () => {
    const rows = [{category:'A',amount:3},{category:'B',amount:7}];
    expect(widgetRowsToChartSpec(rows,config({type:'kpi',aggregation:'sum'})).kpiValue).toBe(10);
    expect(widgetRowsToChartSpec(rows,config({type:'kpi',aggregation:'avg'})).kpiValue).toBe(5);
    expect(widgetRowsToChartSpec([{category:'A',amount:'text'},{category:'B',amount:null}],config({type:'counter',aggregation:'count'})).kpiValue).toBe(2);
  });

  it('does not reject a negative absolute right axis when the left stack is positive', () => {
    const spec = widgetRowsToChartSpec([{ category: 'A', amount: 10, profit: -3 }], config({
      type: 'combo', stackMode: 'percent', yRightKeys: ['profit'], unitRight: 'USD',
    }));
    expect(spec.emptyState).toBe('ok');
    expect(spec.cartesian?.series.map(series => series.values)).toEqual([[100], [-3]]);
  });

  it('still rejects mixed right-axis units when the left axis is a percent stack', () => {
    const spec = widgetRowsToChartSpec([{ category: 'A', amount: 10, profit: 3, orders: 2 }], config({
      type: 'combo', stackMode: 'percent', yRightKeys: ['profit', 'orders'],
      formatByKey: { profit: { unit: 'USD' }, orders: { unit: '笔' } },
    }));
    expect(spec.emptyState).toBe('error');
  });

  it('sorts explicitly numeric VARCHAR measures by decimal value and keeps identifiers textual', () => {
    const rows = [{ amount: '-2.5', record_id: '02' }, { amount: '-10', record_id: '010' }, { amount: null, record_id: '001' }];
    expect(filterSortTableRows(rows, { sortColumn: 'amount', sortDirection: 'ASC', numericColumns: ['amount'] }).map(row => row.amount)).toEqual(['-10', '-2.5', null]);
    expect(filterSortTableRows(rows, { sortColumn: 'record_id', sortDirection: 'ASC', numericColumns: ['amount'] }).map(row => row.record_id)).toEqual(['001', '02', '010']);
  });

  it('only infers measurement units from complete field tokens', () => {
    expect(inferChartUnit('items')).toBeUndefined();
    expect(inferChartUnit('customer_id')).toBeUndefined();
    expect(inferChartUnit('order_amount')).toBeUndefined();
    expect(inferChartUnit('latency_ms')).toBe('ms');
    expect(inferChartUnit('orders')).toBe('笔');
  });

  it('exposes both axis assignments in a combo legend', () => {
    const spec = widgetRowsToChartSpec([{ category: 'A', amount: 10, orders: 2 }], config({ type: 'combo', unit: 'USD', unitRight: '笔', yRightKeys: ['orders'] }));
    const bundle = adaptChartSpec(spec);
    if (bundle.kind !== 'canvas') throw new Error('Expected canvas');
    expect(bundle.data.datasets[0].label).toContain('左轴');
    expect(bundle.data.datasets[1].label).toContain('右轴');
  });

  it('computes fixed-width bins and percent display without changing sample counts', () => {
    const rows = [0, 1, 2, 3, 4].map((amount, category) => ({ category, amount }));
    const spec = widgetRowsToChartSpec(rows, config({ type: 'histogram', binWidth: 2, valueMode: 'percent', unit: 'USD' }));
    expect(spec.histogramBins?.map(bin => [bin.from, bin.to, bin.count, bin.percent])).toEqual([[0, 2, 2, 40], [2, 4, 3, 60]]);
    const bundle = adaptChartSpec(spec);
    if (bundle.kind !== 'canvas') throw new Error('Expected canvas');
    expect(bundle.data.datasets[0].data).toEqual([40, 60]);
    expect(bundle.options.scales.y).toMatchObject({ min: 0, max: 100 });
    expect(bundle.options.scales.y.ticks.callback?.(50)).toBe('50%');
    expect(bundle.options.plugins.tooltip.callbacks.label({ label: spec.histogramBins![1].label })).toContain('3 个 (60%)');
    const filtered = widgetRowsToChartSpec(rows.slice(0, 3), config({ type: 'histogram', binWidth: 2, valueMode: 'percent' }));
    expect(filtered.histogramBins?.map(bin => bin.percent)).toEqual([100]);
  });

  it.each([0, -1, NaN, Infinity, .0000001])('rejects invalid or excessive bin width %s', binWidth => {
    expect(widgetRowsToChartSpec([{ category: 'A', amount: 0 }, { category: 'B', amount: 100 }], config({ type: 'histogram', binWidth })).emptyState).toBe('error');
  });

  it('uses explicit waterfall roles even when category names suggest a different role', () => {
    const rows = [{ category: 'Opening balance', amount: 100, role: 'start' },
      { category: 'end', amount: -20, role: 'change' }, { category: 'Closing balance', amount: 80, role: 'end' }];
    const spec = widgetRowsToChartSpec(rows, config({ type: 'waterfall', waterfallRoleKey: 'role' }));
    expect(spec.emptyState).toBe('ok');
    expect(spec.waterfall).toMatchObject({ bases: [0, 80, 0], deltas: [100, 20, 80], kinds: ['total', 'decrease', 'total'], roles: ['start', 'change', 'end'] });
    expect(chartWindow(spec, 1, 1).spec.waterfall?.roles).toEqual(['change']);
    const bundle = adaptChartSpec(spec);
    if (bundle.kind !== 'canvas') throw new Error('Expected canvas');
    expect(bundle.options.plugins.tooltip.callbacks.label({ dataIndex: 2 })).toContain('终点');
    expect(widgetRowsToChartSpec([{ ...rows[0], role: 'unknown' }], config({ type: 'waterfall', waterfallRoleKey: 'role' })).emptyState).toBe('error');
    expect(widgetRowsToChartSpec(rows, config({ type: 'waterfall', waterfallRoleKey: 'missing' })).emptyState).toBe('error');
  });

  it('shows only valid KPI baselines and explicitly formatted target differences', () => {
    const patch = {type:'kpi' as const,unit:'USD',kpiBaselineKey:'prior',kpiTarget:90};
    const spec = widgetRowsToChartSpec([{category:'A',amount:100,prior:80}],config(patch));
    expect(spec.kpiCompare?.map(compare => compare.formatted)).toEqual(['25%', '10 USD']);
    expect(spec.kpiCompare?.[0].baseline).toContain('prior (80 USD)');
    for (const prior of [null,0]) {
      expect(widgetRowsToChartSpec([{category:'A',amount:100,prior}],config(patch)).kpiCompare?.map(compare=>compare.key)).toEqual(['target']);
    }
    expect(widgetRowsToChartSpec([{category:'A',amount:100}],config(patch)).emptyState).toBe('error');
    expect(widgetRowsToChartSpec([{category:'A',amount:100}],config({type:'kpi',kpiTarget:Infinity})).emptyState).toBe('error');
  });
});
