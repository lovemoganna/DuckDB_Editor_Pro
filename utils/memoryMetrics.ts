/** Derive memory indicators only from collected DuckDB diagnostics. */
export function memoryBytes(value: string): number | null {
  const match = value.trim().match(/^([\d.]+)\s*(B|KB|KiB|MB|MiB|GB|GiB|TB|TiB)$/i);
  if (!match) return null;
  const power = { B: 0, K: 1, M: 2, G: 3, T: 4 }[match[2][0].toUpperCase() as 'B' | 'K' | 'M' | 'G' | 'T'];
  const bytes = Number(match[1]) * 1024 ** power;
  return Number.isFinite(bytes) ? bytes : null;
}

export function resolveMemoryMetrics(usage: string, limit: string) {
  const used = memoryBytes(usage);
  const total = memoryBytes(limit);
  const measured = used !== null && total !== null && total > 0;
  const percentage = measured ? used / total * 100 : 0;
  return {
    memoryUsageFormatted: used === null ? '未采集' : usage,
    memoryUsedGb: used === null ? 0 : used / 1024 ** 3,
    memoryTotalGb: total === null ? 0 : total / 1024 ** 3,
    memoryPercentage: percentage,
    memoryPercentageDisplay: measured ? (percentage > 0 && percentage < 1 ? '< 1%' : `${Math.round(percentage)}%`) : '未采集',
  };
}
