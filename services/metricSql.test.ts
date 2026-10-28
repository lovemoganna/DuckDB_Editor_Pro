import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { compileMetricSql } from './metricSql';
import { buildMetricRecipe } from './metricRecipes';
import { METRIC_TEMPLATES } from '../data/metricSystem';
import type { MetricDefinition } from '../types';
import type { MetricCalculation } from '../types/metric';

// Disposable in-memory fixtures exercise the actual DuckDB engine, never user data.
function run(sql: string, setup = ''): Record<string, any>[] {
  const result = spawnSync('duckdb', [':memory:', '-json', '-bail'], { input: `${setup}\n${sql};`, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.error?.message || 'DuckDB unavailable');
  return JSON.parse(result.stdout);
}
const base: MetricDefinition = { id: 'm', name: 'metric', sourceTable: 'facts', formula: '', scenario: '', definition: '', characteristics: '', value: '', example: '', dependencies: [], createdAt: 1 };
const compile = (calculation: MetricCalculation) => compileMetricSql({ ...base, calculation });
const facts = `CREATE TABLE facts(id INTEGER, amount DOUBLE, weight DOUBLE, status VARCHAR, ts DATE, region VARCHAR);
INSERT INTO facts VALUES (1,10,1,'paid','2025-01-01','A'),(2,30,3,'paid','2025-01-01','A'),(2,NULL,100,'cancelled','2025-01-03','A'),(NULL,50,NULL,'paid','2025-01-04','A');`;

describe('metric compiler against DuckDB', () => {
  it.each([['COUNT', undefined, 4], ['COUNT', 'id', 3], ['COUNT DISTINCT', 'id', 2], ['SUM', 'amount', 90], ['AVG', 'amount', 30], ['MIN', 'amount', 10], ['MAX', 'amount', 50], ['MEDIAN', 'amount', 30], ['QUANTILE', 'amount', 48], ['STDDEV_SAMP', 'amount', 20], ['VAR_SAMP', 'amount', 400], ['VAR_POP', 'amount', 800 / 3]] as const)('%s follows NULL and statistical semantics', (aggregation, field, expected) => {
    expect(run(compile({ aggregation, field, quantile: 0.95 }), facts)[0].value).toBeCloseTo(expected);
  });
  it('weighted average pairs non-null observations and handles zero total weight', () => {
    expect(run(compile({ aggregation: 'WEIGHTED_AVG', field: 'amount', weightField: 'weight' }), facts)[0].value).toBe(25);
    expect(run(compile({ aggregation: 'WEIGHTED_AVG', field: 'amount', weightField: 'weight', filter: 'weight = 0' }), facts)[0].value).toBeNull();
  });
  it('ratio separately filters numerator and denominator, with explicit percent scale', () => {
    const c: MetricCalculation = { aggregation: 'RATIO', numerator: { aggregation: 'COUNT', filter: "status = 'paid'" }, denominator: { aggregation: 'COUNT' }, scale: 100 };
    expect(run(compile(c), facts)[0].value).toBe(75);
    expect(run(compile({ ...c, denominator: { aggregation: 'COUNT', filter: 'FALSE' } }), facts)[0].value).toBeNull();
  });
  it('does not confuse missing calendar periods with previous rows', () => {
    const rows = run(compile({ aggregation: 'COUNT', timeField: 'ts', grain: 'day', transform: 'previous_growth' }), facts);
    expect(rows.map(row => row.value)).toEqual([null, null, 0]);
    expect(rows.map(row => row.previous_value)).toEqual([null, null, 1]);
  });
  it('uses a calendar RANGE and resets partitions independently', () => {
    const c: MetricCalculation = { aggregation: 'COUNT', timeField: 'ts', grain: 'day', groupBy: ['region'], transform: 'rolling', windowPeriods: 2 };
    expect(run(compile(c), facts).map(row => row.value)).toEqual([2, 1, 2]);
    expect(run(compile({ ...c, transform: 'cumulative' }), facts).map(row => row.value)).toEqual([2, 3, 4]);
  });
  it('matches quarter and year comparisons without relying on row offsets', () => {
    const setup = `CREATE TABLE facts(ts DATE, amount DOUBLE); INSERT INTO facts VALUES ('2024-01-01',10),('2024-04-01',20),('2025-01-01',30);`;
    expect(run(compile({ aggregation: 'SUM', field: 'amount', timeField: 'ts', grain: 'quarter', transform: 'previous_growth' }), setup).map(row => row.value)).toEqual([null, 100, null]);
    expect(run(compile({ aggregation: 'SUM', field: 'amount', timeField: 'ts', grain: 'quarter', transform: 'year_growth' }), setup).map(row => row.value)).toEqual([null, null, 200]);
  });
  it('rejects nonadditive rolling, invalid quantiles, duplicate dimensions and mutating filters', () => {
    expect(() => compile({ aggregation: 'COUNT DISTINCT', field: 'id', timeField: 'ts', grain: 'day', transform: 'rolling' })).toThrow('重新计算');
    expect(() => compile({ aggregation: 'QUANTILE', field: 'amount', quantile: NaN })).toThrow('分位点');
    expect(() => compile({ aggregation: 'COUNT', groupBy: ['id', 'id'] })).toThrow('重复');
    expect(() => compile({ aggregation: 'COUNT', filter: 'TRUE); DROP TABLE facts; --' })).toThrow('只读');
  });
  it('every basic template can bind and execute on real schema fields', () => {
    for (const template of METRIC_TEMPLATES) {
      const metric = { ...base, ...template, sourceTable: 'facts', calculation: { ...template.calculation!, field: 'amount', weightField: 'weight', timeField: 'ts' } };
      expect(run(compileMetricSql(metric), facts).length).toBeGreaterThan(0);
    }
  });
});

const events = `CREATE TABLE events(user_id VARCHAR, ts TIMESTAMP, event VARCHAR);
INSERT INTO events VALUES
('a','2025-01-01 10:00','join'),('a','2025-01-02 09:00','active'),('a','2025-01-02 10:00','active'),
('b','2025-01-01 11:00','join'),('b','2025-01-03 10:00','active'),
('c','2025-01-04 10:00','join'),('c','2025-01-05 10:00','active'),
('d','2025-01-03 10:00','active'),('d','2025-01-03 12:00','join');`;
const binding = { source: 'events', fields: { entity: 'user_id', time: 'ts', event: 'event' }, startEvent: 'join', endEvent: 'active', days: 1, cutoff: '2025-01-05' };
describe('professional method recipes against DuckDB', () => {
  it('retention counts subjects, deduplicates return events and excludes immature cohorts', () => {
    const rows = run(buildMetricRecipe('retention', binding).formula, events);
    expect(rows).toEqual([{ period: '2025-01-01', cohort_size: 2, retained_entities: 1, value: 50 }, { period: '2025-01-03', cohort_size: 1, retained_entities: 0, value: 0 }]);
  });
  it('ordered funnel excludes reverse events and immature windows', () => {
    const rows = run(buildMetricRecipe('funnel', binding).formula, events);
    expect(rows.map(row => [row.opportunities, row.converted_entities, row.value])).toEqual([[2, 1, 50], [1, 0, 0]]);
  });
  it('snapshot takes last value per subject, never sums all balances in the month', () => {
    const setup = `CREATE TABLE snapshots(id INTEGER, user_id VARCHAR, ts TIMESTAMP, balance DOUBLE);
      INSERT INTO snapshots VALUES (1,'a','2025-01-01',10),(2,'a','2025-01-20',20),(3,'a','2025-01-20',30),(4,'b','2025-01-10',50),(5,'b','2025-02-01',60);`;
    const recipe = buildMetricRecipe('snapshot', { source: 'snapshots', fields: { entity: 'user_id', time: 'ts', value: 'balance', tie: 'id' } });
    expect(run(recipe.formula, setup).map(row => row.value)).toEqual([80, 60]);
  });
  it('share uses the total across groups and preserves a null category', () => {
    const recipe = buildMetricRecipe('share', { source: 'facts', fields: { dimension: 'region', value: 'amount' } });
    expect(run(recipe.formula, facts)[0].value).toBe(100);
  });
  it('does not generate queries for invalid dates or incomplete binding', () => {
    expect(() => buildMetricRecipe('retention', { ...binding, cutoff: '2025-02-30' })).toThrow('有效观察');
    expect(() => buildMetricRecipe('funnel', { ...binding, fields: {} })).toThrow('请选择');
  });
});
