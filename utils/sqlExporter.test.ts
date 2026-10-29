import { describe, it, expect } from 'vitest';
import { exportCsv, exportJson, exportMarkdown, sanitizeCsvFormula } from './sqlExporter';
import type { QueryResult } from '../types';

describe('sqlExporter & formula sanitization', () => {
  it('correctly detects and prefixes sensitive formula characters', () => {
    expect(sanitizeCsvFormula('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
    expect(sanitizeCsvFormula('+12345')).toBe("'+12345");
    expect(sanitizeCsvFormula('-100')).toBe("'-100");
    expect(sanitizeCsvFormula('@special')).toBe("'@special");
    expect(sanitizeCsvFormula('\tcmd')).toBe("'\tcmd");
    expect(sanitizeCsvFormula('normal text')).toBe('normal text');
    expect(sanitizeCsvFormula('')).toBe('');
  });

  it('exports CSV with sanitized formula cells by default', async () => {
    const mockResult: QueryResult = {
      executedSql: 'SELECT 1',
      databaseName: 'main',
      schemaName: 'main',
      columns: ['id', 'formula_field', 'safe_field'],
      rows: [
        { id: 1, formula_field: '=cmd|/C calc!A0', safe_field: 'safe_text' },
        { id: 2, formula_field: '+SUM(1,2)', safe_field: 'another_text' },
      ],
      executionTime: 12,
    };

    const blob = exportCsv(mockResult);
    const text = await blob.text();

    expect(text).toContain('"\'=cmd|/C calc!A0"');
    expect(text).toContain('"\'+SUM(1,2)"');
    expect(text).toContain('"safe_text"');
  });

  it('allows disabling formula sanitization if explicitly requested', async () => {
    const mockResult: QueryResult = {
      executedSql: 'SELECT 1',
      databaseName: 'main',
      schemaName: 'main',
      columns: ['formula_field'],
      rows: [
        { formula_field: '=SUM(1,2)' },
      ],
      executionTime: 5,
    };

    const blob = exportCsv(mockResult, { sanitizeFormulas: false });
    const text = await blob.text();

    expect(text).toContain('"=SUM(1,2)"');
    expect(text).not.toContain('"\'=SUM(1,2)"');
  });

  it('exports valid JSON and Markdown', () => {
    const mockResult: QueryResult = {
      executedSql: 'SELECT 1',
      databaseName: 'main',
      schemaName: 'main',
      columns: ['name', 'amount'],
      rows: [
        { name: 'Alice', amount: 100n },
      ],
      executionTime: 5,
    };

    const md = exportMarkdown(mockResult);
    expect(md).toContain('| name | amount |');
    expect(md).toContain('| Alice | 100 |');

    const jsonBlob = exportJson(mockResult);
    expect(jsonBlob.size).toBeGreaterThan(0);
  });
});
