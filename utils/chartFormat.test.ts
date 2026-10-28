import { describe, it, expect } from 'vitest';
import { chartNumber, formatTableValue, formatChartNumber, inferChartUnit, resolveChartUnit, axisTitleWithUnit } from './chartFormat';

describe('chartFormat', () => {
  it('decodes DuckDB 128-bit integer aggregates and preserves identifiers in tables', () => {
    const bytes = new Uint8Array(16);
    bytes[0] = 192;
    bytes[1] = 6;
    expect(chartNumber(bytes)).toBe(1728);
    expect(formatTableValue(bytes, 'units')).toBe('1,728');
    expect(formatTableValue(8760001, 'order_id')).toBe('8760001');
    expect(formatTableValue('2024', 'year')).toBe('2024');
  });
  it('infers currency / count units from field names', () => {
    expect(inferChartUnit('revenue')).toBeUndefined();
    expect(inferChartUnit('amount')).toBeUndefined();
    expect(inferChartUnit('rate_to_usdt')).toBeUndefined();
    expect(inferChartUnit('USD 完成交易总额')).toBe('USD');
    expect(inferChartUnit('order_count')).toBe('笔');
    expect(inferChartUnit('customers')).toBe('人');
    expect(inferChartUnit('units')).toBe('件');
    expect(inferChartUnit('success_rate')).toBe('%');
  });

  it('formats with unit prefix for currency', () => {
    expect(formatChartNumber(1234.5, '¥')).toBe('¥1,234.5');
    expect(formatChartNumber(12, '笔')).toBe('12 笔');
  });

  it('resolves explicit unit over inference', () => {
    expect(resolveChartUnit({ unit: '', title: 'sales 行数', xKey: '', yKeys: ['metric_value'] })).toBe('');
    expect(
      resolveChartUnit({
        unit: 'USD',
        title: 'revenue',
        xKey: 'revenue',
        yKeys: ['revenue'],
      } as any),
    ).toBe('USD');
  });

  it('appends unit to axis title', () => {
    expect(axisTitleWithUnit('营业额', '¥')).toBe('营业额 (¥)');
    expect(axisTitleWithUnit('', '¥')).toBe('单位: ¥');
  });
});
