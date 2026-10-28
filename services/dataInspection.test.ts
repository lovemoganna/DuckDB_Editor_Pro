import { beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, existsSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const connection = vi.hoisted(() => ({ read: vi.fn(), schema: vi.fn() }));
vi.mock('./duckdbService', () => ({ duckDBService: {
  getCurrentCatalogAndSchema: async () => ({ catalog: 'inspection', schema: 'main' }),
  readQuery: connection.read, getTableSchema: connection.schema,
} }));
import { inspectData } from './dataInspection';

const available = spawnSync('duckdb', ['--version']).status === 0;
const directory = mkdtempSync(join(tmpdir(), 'duckdb-inspection-'));
const database = join(directory, 'inspection.duckdb');
function read(sql: string) {
  const text = execFileSync('duckdb', [database, '-bail', '-json', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  return text ? JSON.parse(text) : [];
}
beforeEach(() => {
  if (!available) return;
  read(`CREATE OR REPLACE TABLE observations AS SELECT * FROM (VALUES (1,'甲'),(1,NULL),(2,'乙')) r(identifier,note);
    CREATE TABLE IF NOT EXISTS parent(id INTEGER PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS child(id INTEGER NOT NULL,parent_id INTEGER REFERENCES parent(id));`);
  connection.read.mockImplementation(async (sql: string) => read(sql));
  connection.schema.mockImplementation(async (table: string) => read(`SELECT name,type,CAST(pk AS INTEGER) AS pk,"notnull" FROM pragma_table_info('${table.replace(/'/g,"''")}')`));
});
afterAll(() => {
  for (const path of [database, database + '.wal']) if (existsSync(path)) unlinkSync(path);
  rmdirSync(directory);
});
describe.skipIf(!available)('real DuckDB inspection evidence', () => {
  it('does not report absent keys or nullable values as quality failures', async () => {
    const report = await inspectData('observations');
    expect(report.constraints).toEqual([]);
    expect(report.status).toBe('passed');
    expect(report.rules).toHaveLength(1);
    expect(report.rules[0].evidence).toEqual([{ identifier: 0, note: 1 }]);
  });
  it('retains an explicit duplicate rule, query and actual failure evidence', async () => {
    const report = await inspectData('observations', { uniqueColumn: 'identifier' });
    expect(report.status).toBe('issues');
    expect(report.rules[0]).toMatchObject({ failures: 1, evidence: [{ identifier: 1, occurrences: 2 }] });
    expect(report.rules[0].sql).toContain('"inspection"."main"."observations"');
  });
  it('executes declared foreign key and non-null rules', async () => {
    const report = await inspectData('child');
    expect(report.status).toBe('passed');
    expect(report.rules.find(rule=>rule.name==='外键约束')).toMatchObject({status:'passed',failures:0});
    expect(report.rules.find(rule=>rule.name==='非空约束')).toMatchObject({status:'passed',failures:0});
  });
  it('distinguishes a failed rule from an unavailable metadata source', async () => {
    connection.read.mockImplementation(async (sql: string) => {
      if (sql.startsWith('SELECT COUNT(*) AS failures')) throw new Error('真实执行入口不可用');
      return read(sql);
    });
    const failed = await inspectData('child');
    expect(failed.status).toBe('failed');
    expect(failed.rules[0].failures).toBeUndefined();
    expect(failed.rules[0].error).toContain('执行入口');
    connection.schema.mockRejectedValue(new Error('字段读取失败'));
    expect(await inspectData('child')).toMatchObject({status:'unavailable',error:'字段读取失败'});
  });
});
