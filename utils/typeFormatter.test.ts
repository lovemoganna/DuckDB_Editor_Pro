import { describe, it, expect } from 'vitest';
import {
  formatCellValue,
  normalizeDuckDBType,
  arrowTypeToDuckDBType,
  formatTimestamp,
  formatDate,
  formatTime,
  formatInteger,
  formatDecimal,
  formatBoolean,
  getTypeBadgeStyle,
} from './typeFormatter';

describe('typeFormatter', () => {
  describe('Acceptance Criteria Cases', () => {
    it('labels DuckDB integer128 Arrow fields without relabeling variable binary', () => {
      expect(arrowTypeToDuckDBType({typeId:15,byteWidth:16})).toBe('HUGEINT');
      expect(arrowTypeToDuckDBType({typeId:4,toString:()=> 'Binary'})).not.toBe('HUGEINT');
    });
    it('preserves naive TIMESTAMP wall clocks instead of shifting them to browser timezone', () => {
      const previous = process.env.TZ;
      process.env.TZ = 'America/Los_Angeles';
      try {
        const epoch = Date.parse('2025-01-01T00:20:00Z');
        expect(formatCellValue(epoch, 'TIMESTAMP')).toBe('2025-01-01 00:20:00');
        expect(formatCellValue(BigInt(epoch) * 1000n, 'TIMESTAMP')).toBe('2025-01-01 00:20:00');
        expect(formatCellValue('2025-01-01 00:20:00', 'TIMESTAMP')).toBe('2025-01-01 00:20:00');
      } finally {
        if (previous === undefined) delete process.env.TZ;
        else process.env.TZ = previous;
      }
    });
    it('keeps DATE calendar days unchanged in a western timezone', () => {
      const previous = process.env.TZ;
      process.env.TZ = 'America/Los_Angeles';
      try {
        expect(formatCellValue(1788220800000, 'DATE')).toBe('2026-09-01');
        expect(formatDate(new Date('2026-09-01T00:00:00Z'))).toBe('2026-09-01');
      } finally {
        if (previous === undefined) delete process.env.TZ;
        else process.env.TZ = previous;
      }
    });
    it('formats acceptance criteria table correctly based strictly on DuckDB column types', () => {
      // id: BIGINT -> 1001 (NOT 1,001)
      expect(formatCellValue(1001, 'BIGINT')).toBe('1001');
      expect(formatCellValue(1001n, 'BIGINT')).toBe('1001');

      // name: VARCHAR -> 张三
      expect(formatCellValue('张三', 'VARCHAR')).toBe('张三');

      // created_at: TIMESTAMP with timestamp string or epoch millis -> 2026-08-29 22:53:09.808
      expect(formatCellValue('2026-08-29 22:53:09.808', 'TIMESTAMP')).toBe('2026-08-29 22:53:09.808');

      // age: INTEGER -> 20
      expect(formatCellValue(20, 'INTEGER')).toBe('20');
    });

    it('prohibits automatic comma formatting on IDs, BIGINT, and INTEGER fields', () => {
      expect(formatCellValue(1001, 'BIGINT')).not.toBe('1,001');
      expect(formatCellValue(1002, 'INTEGER')).not.toBe('1,002');
      expect(formatCellValue(123456789, 'BIGINT')).toBe('123456789');
    });

    it('prohibits guessing timestamp based on column name when real database type is BIGINT', () => {
      // Column named created_at, but type is BIGINT -> MUST stay as raw BIGINT
      const rawTimestampEpoch = 1788015989808;
      const formatted = formatCellValue(rawTimestampEpoch, 'BIGINT');
      expect(formatted).toBe('1788015989808');
      expect(formatted).not.toContain('2026-');
      expect(formatted).not.toContain('1,788,015,989,808');
    });

    it('formats timestamp when real database type is TIMESTAMP', () => {
      const d = new Date('2026-08-29T22:53:09.808Z'); // Arrow representation of a naive DuckDB wall clock
      const formatted = formatCellValue(d, 'TIMESTAMP');
      expect(formatted).toBe('2026-08-29 22:53:09.808');
    });
  });

  describe('Type Normalization & Formatter Rules', () => {
    it('handles NULL values with weakened placeholder', () => {
      expect(formatCellValue(null, 'VARCHAR')).toBe('NULL');
      expect(formatCellValue(undefined, 'INTEGER')).toBe('NULL');
      expect(formatCellValue(null, 'TIMESTAMP', { nullPlaceholder: '—' })).toBe('—');
    });

    it('handles DATE, TIME, and BOOLEAN types', () => {
      expect(formatCellValue('2026-08-29', 'DATE')).toBe('2026-08-29');
      expect(formatCellValue('22:53:09', 'TIME')).toBe('22:53:09');
      expect(formatCellValue(true, 'BOOLEAN')).toBe('true');
      expect(formatCellValue(false, 'BOOLEAN')).toBe('false');
      expect(formatCellValue(1, 'BOOLEAN')).toBe('true');
      expect(formatCellValue(0, 'BOOLEAN')).toBe('false');
    });

    it('handles DECIMAL and DOUBLE without forced commas', () => {
      expect(formatCellValue(1234.56, 'DOUBLE')).toBe('1234.56');
      expect(formatCellValue(1234.5678, 'DECIMAL(10,2)', { maxDecimals: 2 })).toBe('1234.57');
    });

    it('normalizes various DuckDB type aliases', () => {
      expect(normalizeDuckDBType('INT4')).toBe('INTEGER');
      expect(normalizeDuckDBType('INT8')).toBe('BIGINT');
      expect(normalizeDuckDBType('FLOAT8')).toBe('DOUBLE');
      expect(normalizeDuckDBType('TEXT')).toBe('VARCHAR');
      expect(normalizeDuckDBType('TIMESTAMPTZ')).toBe('TIMESTAMPTZ');
    });

    it('maps Arrow types to DuckDB types', () => {
      expect(arrowTypeToDuckDBType({ constructor: { name: 'Int64' } })).toBe('BIGINT');
      expect(arrowTypeToDuckDBType({ constructor: { name: 'Int32' } })).toBe('INTEGER');
      expect(arrowTypeToDuckDBType({ constructor: { name: 'Float64' } })).toBe('DOUBLE');
      expect(arrowTypeToDuckDBType({ constructor: { name: 'Utf8' } })).toBe('VARCHAR');
      expect(arrowTypeToDuckDBType({ constructor: { name: 'Timestamp' } })).toBe('TIMESTAMP');
      expect(arrowTypeToDuckDBType({ constructor: { name: 'DateDay' } })).toBe('DATE');
    });

    it('formats microseconds and nanoseconds timestamps properly', () => {
      // 1788015989808000 (microseconds)
      const formattedMicro = formatCellValue(1788015989808000, 'TIMESTAMP');
      expect(formattedMicro).toContain('2026-08-29');

      // 1788015989808000000n (nanoseconds bigint)
      const formattedNano = formatCellValue(1788015989808000000n, 'TIMESTAMP');
      expect(formattedNano).toContain('2026-08-29');
    });

    it('returns appropriate light pastel badge styles for data types', () => {
      expect(getTypeBadgeStyle('BIGINT')).toContain('monokai-green');
      expect(getTypeBadgeStyle('DOUBLE')).toContain('monokai-green');
      expect(getTypeBadgeStyle('VARCHAR')).toContain('monokai-cyan');
      expect(getTypeBadgeStyle('TIMESTAMP')).toContain('monokai-purple');
      expect(getTypeBadgeStyle('BOOLEAN')).toContain('monokai-pink');
      expect(getTypeBadgeStyle('JSON')).toContain('monokai-orange');
      expect(getTypeBadgeStyle('UNKNOWN')).toContain('monokai-yellow');
    });
  });
});
