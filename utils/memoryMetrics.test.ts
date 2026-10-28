import { describe, expect, it } from 'vitest';
import { memoryBytes, resolveMemoryMetrics } from './memoryMetrics';

describe('collected memory diagnostics', () => {
  it('uses the collected memory limit instead of a fixed system capacity', () => {
    expect(resolveMemoryMetrics('128 MiB', '512 MiB')).toMatchObject({ memoryPercentage: 25, memoryTotalGb: 0.5, memoryPercentageDisplay: '25%' });
    expect(memoryBytes('1.5 GiB')).toBe(1.5 * 1024 ** 3);
  });
  it('distinguishes unknown diagnostics from zero usage', () => {
    expect(resolveMemoryMetrics('Unknown', 'Unknown')).toMatchObject({ memoryUsageFormatted: '未采集', memoryPercentageDisplay: '未采集', memoryTotalGb: 0 });
    expect(resolveMemoryMetrics('0 B', '512 MB').memoryPercentageDisplay).toBe('0%');
  });
  it('does not use an available limit as measured usage', () => {
    expect(resolveMemoryMetrics('Unknown', '4 GB')).toMatchObject({ memoryUsageFormatted: '未采集', memoryPercentageDisplay: '未采集' });
    expect(resolveMemoryMetrics('1 MB', '1 GB').memoryPercentage).toBeLessThan(1);
  });
});
