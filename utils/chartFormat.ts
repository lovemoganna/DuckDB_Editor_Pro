/**
 * Shared chart value formatting with explicit measurement units.
 * Tooltip / Label / Axis must share the same formatter (driven by Chart Spec).
 */

import type { ChartConfig } from '../types';
import type { ValueFormatSpec } from '../services/analysis/types';

/** Infer a sensible unit from field / title when config.unit is empty. */
export function inferChartUnit(fieldOrTitle: string): string | undefined {
  const s = fieldOrTitle.toLowerCase();
  if (isIdentifierColumn(fieldOrTitle)) return undefined;
  const explicitCurrency = fieldOrTitle.match(/\b(USD|USDT|EUR|GBP|BRL|TRY|BTC|ETH|CNY)\b/i);
  if (explicitCurrency) return explicitCurrency[1].toUpperCase();
  if (/[¥￥]/.test(s)) return '¥';
  if (/percent|pct|ratio|success_rate|failure_rate|growth_rate|占比|百分比|成功率|失败率|增长率/.test(s)) return '%';
  if (/(?:^|[^a-z])(?:units|quantity|qty)(?:$|[^a-z])|件数|销量/.test(s)) return '件';
  if (/^(?:orders?|order_count)$|笔数/.test(s)) return '笔';
  if (/^(?:customers?|users?|customer_count|user_count)$|客户数|用户数/.test(s)) return '人';
  if (/count|cnt|总数|数量/.test(s)) return '个';
  if (/(?:^|[^a-z])ms(?:$|[^a-z])|latency|耗时/.test(s)) return 'ms';
  if (/byte|size|内存|容量/.test(s)) return 'B';
  return undefined;
}

export function resolveChartUnit(
  config: Pick<ChartConfig, 'unit' | 'title' | 'yKeys' | 'xKey' | 'yAxisLabel'>,
): string {
  if (config.unit !== undefined) return config.unit.trim();
  const fromAxis = config.yAxisLabel ? inferChartUnit(config.yAxisLabel) : undefined;
  if (fromAxis) return fromAxis;
  const fromTitle = config.title ? inferChartUnit(config.title) : undefined;
  if (fromTitle) return fromTitle;
  for (const k of config.yKeys || []) {
    const u = inferChartUnit(k);
    if (u) return u;
  }
  if (config.xKey) {
    const u = inferChartUnit(config.xKey);
    if (u) return u;
  }
  return '';
}

/** DuckDB WASM can expose HUGEINT aggregates as little-endian 128-bit bytes. */
export function chartNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'bigint') {
    return value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= BigInt(Number.MIN_SAFE_INTEGER)
      ? Number(value) : null;
  }
  if (value instanceof Uint8Array && (value.length === 8 || value.length === 16)) {
    let integer = 0n;
    for (let i = value.length - 1; i >= 0; i--) integer = (integer << 8n) | BigInt(value[i]);
    if (value[value.length - 1] & 0x80) integer -= 1n << BigInt(value.length * 8);
    return chartNumber(integer);
  }
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isIdentifierColumn(column: string): boolean {
  return /^id$|(?:^|_)(?:id|uid)$|(?:^|_)key$|编号|编码/i.test(column);
}

export function formatTableValue(value: unknown, column: string, format?: ValueFormatSpec | null): string {
  if (value == null) return '—';
  if (typeof value === 'number' && !Number.isFinite(value)) return '—';
  // Text and identifiers retain their exact spelling. Explicitly formatted
  // numeric measures may arrive as VARCHAR/DECIMAL strings from DuckDB.
  const numericFormat = format && (Boolean(format.unit) || format.percent === true || format.decimals !== undefined
    || format.compact !== undefined || format.thousandSeparator !== undefined || Boolean(format.prefix) || Boolean(format.suffix));
  if (typeof value === 'string' && (isIdentifierColumn(column) || !numericFormat || chartNumber(value) === null)) return value;
  if (isIdentifierColumn(column)) {
    const number = chartNumber(value);
    return number === null ? String(value) : String(number);
  }
  const number = chartNumber(value);
  return number === null ? String(value) : formatValueBySpec(number, format);
}

/** Spec-driven formatter — single source for axis / tooltip / datalabel. */
export function formatValueBySpec(value: unknown, format?: ValueFormatSpec | null): string {
  if (value === null || value === undefined) return '—';
  if (format?.precisionSafe && typeof value==='string' && /^-?\d+(\.\d+)?$/.test(value)) {
    const unit=format.unit || '';
    const body=`${format.prefix || ''}${value}${format.suffix || ''}`;
    return !unit ? body : ['¥','$','€'].includes(unit) ? `${unit}${body}` : `${body} ${unit}`;
  }
  if (typeof value === 'bigint' || value instanceof Uint8Array) {
    const number = chartNumber(value);
    if (number === null) return String(value);
    value = number;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) return '—';
  if (typeof value !== 'number') return String(value);

  const f = format || {};
  const unit = f.unit || '';
  if(f.precisionSafe && value!==0 && Math.abs(value)<1e-20) {
    const body=`${f.prefix || ''}${value.toExponential(3)}${f.suffix || ''}`;
    return !unit?body:['¥','$','€'].includes(unit)?`${unit}${body}`:`${body} ${unit}`;
  }
  const isPercent = !!f.percent || unit === '%';
  const requested = f.decimals ?? (isPercent ? 1 : 2);
  const decimals = Number.isFinite(requested) ? Math.max(0, Math.min(20, Math.floor(requested))) : 2;
  const threshold = f.compactThreshold ?? 10000;
  const useCompact = f.compact !== false && !isPercent && Math.abs(value) >= threshold;

  let num: string;
  if (isPercent) {
    const precision = value !== 0 && Math.abs(value) < 10 ** -decimals ? Math.min(20, Math.ceil(-Math.log10(Math.abs(value))) + 1) : decimals;
    num = new Intl.NumberFormat('zh-CN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: precision,
    }).format(value);
    return `${f.prefix || ''}${num}%${f.suffix || ''}`;
  }

  if (useCompact) {
    num = new Intl.NumberFormat('zh-CN', {
      notation: 'compact',
      maximumFractionDigits: Math.min(2, decimals),
    }).format(value);
  } else {
    num = new Intl.NumberFormat('zh-CN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: f.precisionSafe && value!==0 && Math.abs(value)<10**-decimals ? Math.min(20,Math.ceil(-Math.log10(Math.abs(value)))+2) : decimals,
      useGrouping: f.thousandSeparator !== false,
    }).format(value);
  }

  const body = `${f.prefix || ''}${num}${f.suffix || ''}`;
  if (!unit) return body;
  if (unit === '¥' || unit === '$' || unit === '€') return `${unit}${body}`;
  return `${body} ${unit}`;
}

export function formatChartNumber(value: unknown, unit = '', opts?: { compact?: boolean }): string {
  return formatValueBySpec(value, {
    unit: unit || undefined,
    compact: opts?.compact ?? true,
    thousandSeparator: true,
  });
}

/** Composition shares use one precision in labels, legends and tooltips. */
export function formatPercentValue(value:unknown):string {
  return formatValueBySpec(value,{percent:true,unit:'%',decimals:1,compact:false});
}

export function axisTitleWithUnit(label: string | undefined, unit: string): string {
  const base = (label || '').trim();
  if (!unit) return base;
  if (!base) return `单位: ${unit}`;
  if (base.includes(unit)) return base;
  return `${base} (${unit})`;
}
