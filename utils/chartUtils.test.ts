import { describe, expect, it } from 'vitest';
import type { ChartConfig } from '../types';
import { getChartOptions, transformDataForChart } from './chartUtils';

const config = (aggregation: ChartConfig['aggregation'] = 'avg', extra: Partial<ChartConfig> = {}): ChartConfig => ({
  id: 'visual-contract',
  title: 'Amount by category',
  type: 'bar',
  xKey: 'category',
  yKeys: ['amount'],
  aggregation,
  ...extra,
});

const series = (rows: Record<string, unknown>[], aggregation: ChartConfig['aggregation'], extra: Partial<ChartConfig> = {}) =>
  transformDataForChart(rows, config(aggregation, extra)).datasets[0].data;

describe('Chart.js data contract: missing and invalid numeric observations', () => {
  it('excludes null from averages and minima without discarding numeric zero', () => {
    const rows = [{ category: 'A', amount: 10 }, { category: 'A', amount: null }, { category: 'B', amount: 0 }];
    expect(series(rows, 'avg')).toEqual([10, 0]);
    expect(series(rows, 'min')).toEqual([10, 0]);
  });

  it('prevents NaN from propagating into sum and average', () => {
    const rows = [
      { category: 'A', amount: 10 },
      { category: 'A', amount: 'N/A' },
      { category: 'A', amount: Infinity },
      { category: 'A', amount: '' },
    ];
    expect(series(rows, 'sum')).toEqual([10]);
    expect(series(rows, 'avg')).toEqual([10]);
  });

  it('represents groups with no numeric values as null, never as fabricated zero', () => {
    const rows = [{ category: 'A', amount: null }, { category: 'A', amount: undefined }];
    for (const fn of ['sum', 'avg', 'min', 'max', 'none'] as const) {
      expect(series(rows, fn)).toEqual([null]);
    }
  });

  it('keeps row count semantics and empty-result contract', () => {
    const rows = [{ category: 'A', amount: null }, { category: 'A', amount: 5 }];
    expect(series(rows, 'count')).toEqual([2]);
    expect(transformDataForChart([], config())).toEqual({ labels: [], datasets: [] });
  });

  it('treats absent pivot average as undefined, but preserves matched zero and empty sum', () => {
    const rows = [
      { category: 'A', region: 'east', amount: 0 },
      { category: 'B', region: 'west', amount: 5 },
    ];
    const avg = transformDataForChart(rows, config('avg', { groupBy: 'region' }));
    const east = avg.datasets.find(dataset => dataset.label === 'east');
    const west = avg.datasets.find(dataset => dataset.label === 'west');
    expect(east?.data).toEqual([0, null]);
    expect(west?.data).toEqual([null, 5]);
    const sum = transformDataForChart(rows, config('sum', { groupBy: 'region' }));
    expect(sum.datasets.find(dataset => dataset.label === 'east')?.data).toEqual([0, 0]);
  });

  it('retains common chart legend option contract for explicit false', () => {
    expect(getChartOptions(config('sum', { showLegend: false })).plugins.legend.display).toBe(false);
  });
});
