/**
 * services/workbench/columnProfiler.ts
 *
 * Backend Column Profiler for DuckDB Workbench (BRD index10.md Section 3.1 & 3.3).
 * Responsibilities:
 * - Immutably compute and cache ColumnProfileSnapshot for a specific (snapshotId, columnName).
 * - Exact statistical metric computation (Min, Max, Avg, Median, Sum, Nulls, Distincts).
 * - Continuous distribution calculation (20-bin histogram with clean tick labels).
 * - Top values extraction with frequencies and percentages.
 */

import type { QuerySnapshot, ColumnProfileSnapshot, TopValueEntry } from './types';

export class ColumnProfiler {
  private cache: Map<string, ColumnProfileSnapshot> = new Map();

  private getCacheKey(snapshotId: string, columnName: string): string {
    return `${snapshotId}::${columnName}`;
  }

  /**
   * Profile a specific column for a given QuerySnapshot
   */
  profileColumn(snapshot: QuerySnapshot, columnName: string): ColumnProfileSnapshot {
    const key = this.getCacheKey(snapshot.snapshotId, columnName);
    const cached = this.cache.get(key);
    if (cached) return cached;

    const rows = snapshot.rows || [];
    const totalRows = rows.length;
    const colType = (snapshot.columnTypeMap && snapshot.columnTypeMap[columnName]) ||
      (snapshot.columnTypes && snapshot.columnTypes[snapshot.columns.indexOf(columnName)]) ||
      'VARCHAR';

    const upperType = colType.toUpperCase();
    const isNumeric = /INT|DECIMAL|NUMERIC|FLOAT|DOUBLE|REAL|BIGINT|SMALLINT|TINYINT|HUGEINT/i.test(upperType);
    const isDate = /DATE|TIME|TIMESTAMP/i.test(upperType);

    let nullCount = 0;
    const valueMap: Map<any, number> = new Map();
    const numericValues: number[] = [];

    for (const row of rows) {
      const val = row[columnName];
      if (val === null || val === undefined || val === '') {
        nullCount++;
      } else {
        const count = valueMap.get(val) || 0;
        valueMap.set(val, count + 1);

        if (isNumeric) {
          const num = typeof val === 'number' ? val : parseFloat(String(val));
          if (!isNaN(num)) {
            numericValues.push(num);
          }
        }
      }
    }

    const nonNullCount = totalRows - nullCount;
    const distinctCount = valueMap.size;
    const nullPct = totalRows > 0 ? `${((nullCount / totalRows) * 100).toFixed(2)}%` : '0.00%';
    const distinctPct = nonNullCount > 0 ? `${((distinctCount / nonNullCount) * 100).toFixed(2)}%` : '0.00%';

    let min = '-';
    let max = '-';
    let avg = '-';
    let median = '-';
    let sum = '-';
    let histogramBars: number[] = [];
    let histogramTicks: string[] = [];

    if (isNumeric && numericValues.length > 0) {
      numericValues.sort((a, b) => a - b);
      const minVal = numericValues[0];
      const maxVal = numericValues[numericValues.length - 1];
      const sumVal = numericValues.reduce((acc, curr) => acc + curr, 0);
      const avgVal = sumVal / numericValues.length;

      const mid = Math.floor(numericValues.length / 2);
      const medianVal = numericValues.length % 2 !== 0
        ? numericValues[mid]
        : (numericValues[mid - 1] + numericValues[mid]) / 2;

      min = minVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      max = maxVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      avg = avgVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      median = medianVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      sum = sumVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      // Generate 20-bin continuous histogram
      const binCount = 20;
      const range = maxVal - minVal;
      const binWidth = range > 0 ? range / binCount : 1;
      histogramBars = new Array(binCount).fill(0);

      for (const v of numericValues) {
        let binIdx = range > 0 ? Math.floor((v - minVal) / binWidth) : 0;
        if (binIdx >= binCount) binIdx = binCount - 1;
        histogramBars[binIdx]++;
      }

      // X-Axis tick markers: 0, 40k, 80k, 123k, 160k, 200k
      const tickSteps = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
      histogramTicks = tickSteps.map(step => {
        const tickVal = minVal + range * step;
        if (tickVal >= 1000000) return `${(tickVal / 1000000).toFixed(1)}M`;
        if (tickVal >= 1000) return `${Math.round(tickVal / 1000)}k`;
        return `${Math.round(tickVal)}`;
      });
    } else if (valueMap.size > 0) {
      const keys = Array.from(valueMap.keys()).map(String).sort();
      min = keys[0] || '-';
      max = keys[keys.length - 1] || '-';
    }

    // Top values (sorted by frequency desc)
    const sortedEntries = Array.from(valueMap.entries()).sort((a, b) => b[1] - a[1]);
    const topValues: TopValueEntry[] = sortedEntries.slice(0, 30).map(([val, cnt]) => {
      const formattedVal = isNumeric && typeof val === 'number'
        ? val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : String(val);
      const pct = totalRows > 0 ? `${((cnt / totalRows) * 100).toFixed(2)}%` : '0.00%';
      return {
        value: formattedVal,
        count: cnt,
        pct,
      };
    });

    // Approximate memory size & ratio
    const avgBytesPerValue = isNumeric ? 8 : 24;
    const estMemoryBytes = totalRows * avgBytesPerValue;
    const memorySize = estMemoryBytes >= 1024 * 1024
      ? `${(estMemoryBytes / (1024 * 1024)).toFixed(2)} MB`
      : `${(estMemoryBytes / 1024).toFixed(2)} KB`;

    const totalColCount = snapshot.columns.length || 1;
    const columnRatio = `${((1 / totalColCount) * 100).toFixed(2)}%`;

    const profile: ColumnProfileSnapshot = {
      snapshotId: snapshot.snapshotId,
      columnName,
      columnType: colType,
      isNumeric,
      isDate,
      min,
      max,
      avg,
      median,
      sum,
      nullCount,
      nullPct,
      distinctCount,
      distinctPct,
      histogramBars,
      histogramTicks,
      topValues,
      memorySize,
      columnRatio,
      isExact: true,
      sampleRows: totalRows,
      totalRows,
      calculatedAt: Date.now(),
    };

    this.cache.set(key, profile);
    return profile;
  }

  /**
   * Clear cache for a specific snapshot or everything
   */
  clearCache(snapshotId?: string) {
    if (!snapshotId) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${snapshotId}::`)) {
        this.cache.delete(key);
      }
    }
  }
}

export const columnProfiler = new ColumnProfiler();
