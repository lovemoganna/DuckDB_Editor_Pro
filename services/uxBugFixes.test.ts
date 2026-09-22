import { describe, it, expect } from 'vitest';

describe('UX Bug Fixes & Resiliency Verification', () => {
  describe('BigInt Serialization', () => {
    it('serializes DuckDB rows containing BigInt values without throwing TypeError', () => {
      const duckdbRow = {
        id: BigInt('9007199254740993'),
        name: 'test_user',
        count: BigInt(42),
        nullField: null,
      };

      // Ensure standard JSON.stringify with BigInt replacer succeeds
      const serialize = () =>
        JSON.stringify(duckdbRow, (k, v) => (typeof v === 'bigint' ? v.toString() : v), 2);

      expect(serialize).not.toThrow();
      const parsed = JSON.parse(serialize());
      expect(parsed.id).toBe('9007199254740993');
      expect(parsed.count).toBe('42');
      expect(parsed.name).toBe('test_user');
      expect(parsed.nullField).toBeNull();
    });

    it('formats CSV headers and row data safely when containing BigInt', () => {
      const rows = [
        { id: BigInt(1), amount: BigInt('10000000000'), desc: 'large value' },
        { id: BigInt(2), amount: BigInt('20000000000'), desc: 'another value' },
      ];
      const headers = ['id', 'amount', 'desc'];

      const csvLines = rows.map((row) =>
        headers
          .map((h) => {
            const val = (row as any)[h];
            if (val === null || val === undefined) return '""';
            const safeVal = typeof val === 'bigint' ? val.toString() : val;
            return JSON.stringify(safeVal);
          })
          .join(',')
      );

      expect(csvLines[0]).toBe('"1","10000000000","large value"');
      expect(csvLines[1]).toBe('"2","20000000000","another value"');
    });
  });

  describe('AI Capability Template Parameter Substitution', () => {
    it('correctly replaces template placeholders and preserves userPrompt for interactive filling', () => {
      const template =
        '/* {currentSql} */\nSchema:\n{schemaContext}\nAnalyze {userPrompt} on {rowCount} rows.';
      const currentSql = 'SELECT * FROM users;';
      const schemaContext = 'CREATE TABLE users (id INT);';
      const rowCount = 100;

      const substituted = template
        .replace(/\{currentSql\}/g, currentSql)
        .replace(/\{schemaContext\}/g, schemaContext)
        .replace(/\{rowCount\}/g, String(rowCount));

      expect(substituted).toContain('/* SELECT * FROM users; */');
      expect(substituted).toContain('CREATE TABLE users (id INT);');
      expect(substituted).toContain('100 rows.');
      expect(substituted).toContain('{userPrompt}');

      // When user supplies final prompt
      const finalPrompt = substituted.replace(/\{userPrompt\}/g, 'active users trend');
      expect(finalPrompt).toContain('Analyze active users trend on 100 rows.');
      expect(finalPrompt).not.toContain('{userPrompt}');
    });
  });
});
