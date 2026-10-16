import type { ChartSpec } from './types';
export interface ScatterRange { seriesIndex: number; xMin: number; xMax: number; yMin: number; yMax: number }
/** Select real records only; regression series never becomes a filter record. */
export function selectScatterRecords(spec: ChartSpec, ranges: ScatterRange[], field: string) {
  const values = new Set<string | number>();
  for (const range of ranges) {
    const series = spec.scatterSeries?.[range.seriesIndex];
    if (!series || series.trend) continue;
    for (const point of series.points) {
      if (point.x < range.xMin || point.x > range.xMax || point.y < range.yMin || point.y > range.yMax) continue;
      const value = point.raw?.[field];
      if (typeof value === 'string' || typeof value === 'number') values.add(value);
    }
  }
  return [...values];
}
