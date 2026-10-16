import type { ChartSpec } from './types';

/** A display window preserves engine values, totals and original category identities. */
export function chartWindow(spec: ChartSpec, page: number, requestedSize = 80) {
  const arc = ['pie','doughnut'].includes(spec.chartType);
  const eligible = arc || ['bar', 'line', 'area', 'combo', 'waterfall', 'histogram', 'funnel'].includes(spec.chartType);
  const count = eligible ? spec.waterfall?.labels.length ?? spec.histogramBins?.length ?? spec.cartesian?.labels.length ?? 0 : 0;
  const size = Math.max(1, Math.min(arc ? 40 : requestedSize, Math.floor(12000 / Math.max(84, (spec.cartesian?.series.length || 1) * 84))));
  const pages = Math.max(1, Math.ceil(count / size));
  const current = Math.max(0, Math.min(pages - 1, Number.isFinite(page) ? Math.floor(page) : 0));
  const start = current * size, end = Math.min(count, start + size);
  if (pages === 1) return { spec, count, pages, current, start, end };
  if (arc) return { spec:{...spec,arcLabelWindow:{from:start,to:end}},count,pages,current,start,end };
  const visible: ChartSpec = {
    ...spec,
    cartesian: spec.cartesian && { ...spec.cartesian, labels: spec.cartesian.labels.slice(start, end),
      displayLabels: spec.cartesian.displayLabels?.slice(start, end),
      series: spec.cartesian.series.map(series => ({ ...series, values: series.values.slice(start, end) })) },
    sliceLabels: spec.sliceLabels?.slice(start, end), histogramBins: spec.histogramBins?.slice(start, end),
    waterfall: spec.waterfall && { labels: spec.waterfall.labels.slice(start, end), bases: spec.waterfall.bases.slice(start, end),
      deltas: spec.waterfall.deltas.slice(start, end), kinds: spec.waterfall.kinds.slice(start, end), roles: spec.waterfall.roles?.slice(start, end) },
  };
  return { spec: visible, count, pages, current, start, end };
}
