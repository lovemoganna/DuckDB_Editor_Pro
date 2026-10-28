import { describe, expect, it } from 'vitest';
import { rebindDomainSql } from './domainMigrationSql';

describe('domain SQL migration', () => {
  it('rebinds qualified catalog names without changing strings or comments', () => {
    const sql = `SELECT 'source.main.t', "source".main.t.id FROM source.main.t -- source.main.t\n/* source.main.t */`;
    expect(rebindDomainSql(sql, 'source', 'target')).toBe(`SELECT 'source.main.t', "target".main.t.id FROM "target".main.t -- source.main.t\n/* source.main.t */`);
  });
  it('preserves unqualified columns and explicitly referenced third-party catalogs', () => {
    expect(rebindDomainSql('SELECT source FROM other.main.t', 'source', 'target')).toBe('SELECT source FROM other.main.t');
  });
});
