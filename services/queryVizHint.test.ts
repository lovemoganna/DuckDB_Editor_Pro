import { describe, it, expect } from 'vitest';
import {
  extractTablesFromSql,
  extractSchemasFromSql,
  computeVizHint,
  vizHintLabel,
} from './queryVizHint';
import { applyBoardParams } from './homeDashboardService';

describe('queryVizHint', () => {
  it('extracts tables from FROM/JOIN clauses', () => {
    const tables = extractTablesFromSql(
      'SELECT * FROM orders o JOIN main.customers c ON o.cid = c.id',
    );
    expect(tables).toContain('orders');
    expect(tables.some((t) => t.includes('customers'))).toBe(true);
  });

  it('resolves quoted catalog paths and excludes CTEs and literal references', () => {
    expect(extractTablesFromSql(`WITH tx AS (SELECT * FROM "crud_lab"."main"."fiat_transactions") SELECT 'FROM fake --' FROM tx JOIN "crud_lab"."main"."users" u USING(uid)`)).toEqual(['crud_lab.main.fiat_transactions','crud_lab.main.users']);
    expect(extractSchemasFromSql('SELECT * FROM "crud_lab"."lab_baseline"."users"')).toEqual(['lab_baseline']);
  });
  it('defaults schema to main' , () => {
    expect(extractSchemasFromSql('SELECT * FROM events')).toContain('main');
  });

  it('returns none for errors and empty results', () => {
    expect(computeVizHint({ status: 'error', rowCount: 10 })).toBe('none');
    expect(computeVizHint({ rowCount: 0 })).toBe('none');
  });

  it('marks single-row single-col as strong KPI', () => {
    expect(computeVizHint({ rowCount: 1, columns: ['total'] })).toBe('strong');
  });

  it('labels hints in Chinese', () => {
    expect(vizHintLabel('strong')).toContain('可视');
    expect(vizHintLabel('none')).toContain('暂无');
  });
});

describe('applyBoardParams', () => {
  it('substitutes named placeholders', () => {
    const sql = applyBoardParams('SELECT * FROM t WHERE region = {{region}} AND n > {{n}}', {
      region: 'APAC',
      n: '10',
    });
    expect(sql).toContain("'APAC'");
    expect(sql).toContain('10');
  });

  it('leaves unknown placeholders intact', () => {
    expect(applyBoardParams('SELECT {{missing}}', {})).toBe('SELECT {{missing}}');
  });
});
