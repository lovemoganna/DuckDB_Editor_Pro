/**
 * services/skills/generators.test.ts — Unit tests for SQL Generators
 *
 * Tests all generator functions for:
 * - Template SQL generation correctness (field substitution, placeholders)
 * - Context injection (tableName, columns)
 * - Error handling (missing fields, fallback values)
 */

import { describe, it, expect } from 'vitest';
import { sqlQueryGenerators } from './sql-generators/query-generators';
import { sqlDdlGenerators } from './sql-generators/ddl-generators';
import { analysisGenerators } from './sql-generators/analysis-generators';
import {
  transformationGenerators,
  optimizationGenerators,
  utilityGenerators,
} from './sql-generators/misc-generators';
import type { SkillExecutionContext } from '../../types';

// ─── Test Context Factory ───────────────────────────────────────────────────────

function makeContext(overrides: Partial<SkillExecutionContext> = {}): SkillExecutionContext {
  return {
    tableName: 'test_table',
    columns: [
      { name: 'id', type: 'BIGINT', notnull: true, dflt_value: null, pk: true },
      { name: 'name', type: 'VARCHAR', notnull: false, dflt_value: null, pk: false },
      { name: 'amount', type: 'DOUBLE', notnull: false, dflt_value: null, pk: false },
      { name: 'created_at', type: 'TIMESTAMP', notnull: false, dflt_value: null, pk: false },
    ],
    userIntent: '',
    currentSql: '',
    ...overrides,
  };
}

// ─── Query Generators ─────────────────────────────────────────────────────────

describe('sqlQueryGenerators', () => {
  const ctx = makeContext();

  describe('select', () => {
    it('generates basic SELECT *', () => {
      const sql = sqlQueryGenerators.select({}, ctx);
      expect(sql).toContain('SELECT *');
      expect(sql).toContain('"test_table"');
      expect(sql).toContain('LIMIT 100');
    });

    it('adds WHERE clause from conditions input', () => {
      const sql = sqlQueryGenerators.select({ conditions: 'amount > 100' }, ctx);
      expect(sql).toContain('WHERE amount > 100');
    });

    it('adds ORDER BY with ASC/DESC', () => {
      const sql = sqlQueryGenerators.select({ orderBy: '升序', limit: 50 }, ctx);
      expect(sql).toContain('ORDER BY id ASC');
      expect(sql).toContain('LIMIT 50');
    });
  });

  describe('join', () => {
    it('generates JOIN clause', () => {
      const sql = sqlQueryGenerators.join({
        joinType: 'INNER JOIN',
        rightTable: 'users',
        joinCondition: 'orders.user_id = users.id',
        selectColumns: 'orders.*, users.name',
      }, ctx);
      expect(sql).toContain('INNER JOIN "users"');
      expect(sql).toContain('orders.user_id = users.id');
    });
  });

  describe('aggregation', () => {
    it('generates aggregation with GROUP BY', () => {
      const sql = sqlQueryGenerators.aggregation({
        aggregationType: 'SUM',
        groupBy: 'name',
      }, ctx);
      expect(sql).toContain('SUM(col)');
      expect(sql).toContain('GROUP BY name');
    });

    it('handles multi-aggregation', () => {
      const sql = sqlQueryGenerators.aggregation({
        aggregationType: '多聚合',
        groupBy: 'name',
      }, ctx);
      expect(sql).toContain('COUNT(*)');
      expect(sql).toContain('SUM(col)');
      expect(sql).toContain('AVG(col)');
    });
  });

  describe('window', () => {
    it('generates window function with PARTITION BY and ORDER BY', () => {
      const sql = sqlQueryGenerators.window({
        windowFunction: 'ROW_NUMBER',
        partitionBy: 'name',
        orderBy: 'amount DESC',
      }, ctx);
      expect(sql).toContain('ROW_NUMBER()');
      expect(sql).toContain('PARTITION BY name');
      expect(sql).toContain('ORDER BY amount DESC');
    });
  });

  describe('cte', () => {
    it('generates CTE with AS clause', () => {
      const sql = sqlQueryGenerators.cte({
        cteName: 'base_data',
        cteQuery: 'SELECT * FROM orders WHERE status = \'active\'',
        mainQuery: 'SELECT * FROM base_data WHERE amount > 100',
      }, ctx);
      expect(sql).toContain('WITH base_data AS');
      expect(sql).toContain('SELECT * FROM base_data');
    });
  });

  describe('insert', () => {
    it('generates INSERT with values', () => {
      const sql = sqlQueryGenerators.insert({
        values: '1, \'test\', 100.0',
        mode: 'INSERT ... RETURNING',
      }, ctx);
      expect(sql).toContain('INSERT INTO "test_table"');
      expect(sql).toContain('RETURNING');
    });

    it('falls back to basic INSERT when no mode specified', () => {
      const sql = sqlQueryGenerators.insert({ values: '1, \'test\'' }, ctx);
      expect(sql).toContain('INSERT INTO');
    });
  });

  describe('update', () => {
    it('generates UPDATE with SET and WHERE', () => {
      const sql = sqlQueryGenerators.update({
        setClause: 'amount = 200',
        whereCondition: 'id = 1',
        returning: true,
      }, ctx);
      expect(sql).toContain('UPDATE "test_table"');
      expect(sql).toContain('SET amount = 200');
      expect(sql).toContain('RETURNING');
    });
  });

  describe('delete', () => {
    it('generates DELETE with WHERE and LIMIT', () => {
      const sql = sqlQueryGenerators.delete({
        whereCondition: 'status = \'inactive\'',
        limit: 10,
        returning: true,
      }, ctx);
      expect(sql).toContain('DELETE FROM "test_table"');
      expect(sql).toContain('WHERE status');
      expect(sql).toContain('LIMIT 10');
    });
  });
});

// ─── DDL Generators ────────────────────────────────────────────────────────────

describe('sqlDdlGenerators', () => {
  const ctx = makeContext();

  describe('createTable', () => {
    it('generates CREATE TABLE with column definitions', () => {
      const sql = sqlDdlGenerators.createTable({
        tableName: 'users',
        columns: 'id BIGINT PRIMARY KEY,\nname VARCHAR(100) NOT NULL',
        ifNotExists: true,
      }, ctx);
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS "users"');
      expect(sql).toContain('id BIGINT PRIMARY KEY');
      expect(sql).toContain('name VARCHAR(100) NOT NULL');
    });
  });

  describe('dropTable', () => {
    it('generates DROP TABLE', () => {
      const sql = sqlDdlGenerators.dropTable({ tableName: 'stale_data', mode: 'DROP TABLE IF EXISTS' }, {});
      expect(sql).toContain('DROP TABLE IF EXISTS "stale_data"');
    });

    it('supports TRUNCATE mode', () => {
      const sql = sqlDdlGenerators.dropTable({ tableName: 'orders', mode: 'TRUNCATE' }, {});
      expect(sql).toContain('TRUNCATE TABLE');
    });

    it('supports CASCADE option', () => {
      const sql = sqlDdlGenerators.dropTable({ tableName: 'old', cascade: true }, {});
      expect(sql).toContain('CASCADE');
    });
  });

  describe('alterTable', () => {
    it('generates ALTER TABLE ADD COLUMN', () => {
      const sql = sqlDdlGenerators.alterTable({
        alterType: '添加列',
        columnName: 'email',
        columnDefinition: 'VARCHAR(255) UNIQUE',
      }, ctx);
      expect(sql).toContain('ALTER TABLE');
      expect(sql).toContain('ADD COLUMN');
    });

    it('falls back to test_table context when tableName not in input', () => {
      const sql = sqlDdlGenerators.alterTable({
        alterType: '添加列',
        columnName: 'new_col',
      }, ctx);
      expect(sql).toContain('test_table');
    });
  });

  describe('createIndex', () => {
    it('generates CREATE INDEX with index name', () => {
      const sql = sqlDdlGenerators.createIndex({
        indexName: 'idx_orders_user_id',
        tableName: 'orders',
        columns: 'user_id, created_at',
      }, ctx);
      expect(sql).toContain('CREATE INDEX');
      expect(sql).toContain('idx_orders_user_id');
      expect(sql).toContain('user_id, created_at');
    });
  });
});

// ─── Analysis Generators ────────────────────────────────────────────────────────

describe('analysisGenerators', () => {
  const ctx = makeContext();

  describe('timeSeries', () => {
    it('generates time series with DATE_TRUNC', () => {
      const sql = analysisGenerators.timeSeries({
        timeColumn: 'created_at',
        valueColumn: 'amount',
        granularity: '月',
        analysisType: '求和',
      }, ctx);
      expect(sql).toContain("DATE_TRUNC('month'");
      expect(sql).toContain('SUM(amount)');
      expect(sql).toContain('GROUP BY');
    });

    it('generates moving average analysis', () => {
      const sql = analysisGenerators.timeSeries({
        timeColumn: 'created_at',
        valueColumn: 'amount',
        granularity: '周',
        analysisType: '移动平均',
      }, ctx);
      expect(sql).toContain('AVG(amount) OVER');
      expect(sql).toContain('moving_avg');
    });

    it('falls back to default when columns not provided', () => {
      const sql = analysisGenerators.timeSeries({}, ctx);
      expect(sql).toContain('SELECT');
      expect(sql).toContain('GROUP BY');
    });
  });

  describe('comparison', () => {
    it('generates percentage analysis SQL', () => {
      const sql = analysisGenerators.comparison({
        dimension: 'category',
        metrics: 'revenue',
        comparisonType: '占比分析',
      }, ctx);
      expect(sql).toContain('ROUND(100.0');
      expect(sql).toContain('SUM(revenue)');
      expect(sql).toContain('OVER ()');
    });

    it('generates ranking analysis SQL', () => {
      const sql = analysisGenerators.comparison({
        dimension: 'name',
        metrics: 'amount',
        comparisonType: '排名分析',
      }, ctx);
      expect(sql).toContain('RANK() OVER');
      expect(sql).toContain('DENSE_RANK()');
    });

    it('falls back to basic select without comparisonType', () => {
      const sql = analysisGenerators.comparison({}, ctx);
      expect(sql).toContain('SELECT');
      expect(sql).toContain('test_table');
    });
  });

  describe('funnel', () => {
    it('generates funnel analysis template with steps', () => {
      const sql = analysisGenerators.funnel({
        steps: "SELECT '注册' AS step_name, 1 AS step_order FROM orders WHERE event='signup'\nUNION ALL SELECT '激活', 2 AS step_order FROM orders WHERE event='activate'",
        userIdColumn: 'user_id',
      }, ctx);
      expect(sql).toContain('漏斗分析模板');
      expect(sql).toContain('COUNT(DISTINCT');
      expect(sql).toContain('conversion_rate');
      expect(sql).toContain('user_id');
    });

    it('shows template placeholder when steps not provided', () => {
      const sql = analysisGenerators.funnel({}, ctx);
      expect(sql).toContain('漏斗分析模板');
      expect(sql).toContain('请在 steps 参数');
    });
  });

  describe('retention', () => {
    it('generates retention analysis CTE', () => {
      const sql = analysisGenerators.retention({
        userColumn: 'user_id',
        timeColumn: 'created_at',
        periods: '1, 7, 30',
      }, ctx);
      expect(sql).toContain('留存分析模板');
      expect(sql).toContain('WITH cohort AS');
      expect(sql).toContain('day_1_retention');
      expect(sql).toContain('day_7_retention');
      expect(sql).toContain('day_30_retention');
    });

    it('falls back to default columns when not provided', () => {
      const sql = analysisGenerators.retention({}, makeContext());
      expect(sql).toContain('WITH cohort AS');
      expect(sql).toContain('user_id');
    });
  });
});

// ─── Transformation Generators ────────────────────────────────────────────────

describe('transformationGenerators', () => {
  const ctx = makeContext();

  describe('pivot', () => {
    it('generates PIVOT SQL with CASE WHEN', () => {
      const sql = transformationGenerators.pivot({
        rowColumn: 'product',
        columnColumn: 'quarter',
        valueColumn: 'sales',
        aggregator: 'SUM',
      }, ctx);
      expect(sql).toContain('CASE WHEN');
      expect(sql).toContain('SUM(sales)');
      expect(sql).toContain('GROUP BY product');
    });

    it('shows placeholder template when fields missing', () => {
      const sql = transformationGenerators.pivot({}, ctx);
      expect(sql).toContain('PIVOT requires');
      expect(sql).toContain('<row_column>');
    });
  });

  describe('unpivot', () => {
    it('generates UNPIVOT with UNION ALL', () => {
      const sql = transformationGenerators.unpivot({
        inputColumns: 'col_a, col_b, col_c',
      }, ctx);
      expect(sql).toContain('UNION ALL');
      expect(sql).toContain("'col_a'");
      expect(sql).toContain("'col_b'");
    });
  });

  describe('typeConversion', () => {
    it('generates CAST expressions', () => {
      const sql = transformationGenerators.typeConversion({
        column: 'amount',
        targetType: 'INTEGER',
      }, ctx);
      expect(sql).toContain('TRY_CAST(amount AS INTEGER)');
    });

    it('handles VARCHAR, DATE, BOOLEAN conversions', () => {
      const varchar = transformationGenerators.typeConversion({ column: 'val', targetType: 'VARCHAR' }, ctx);
      expect(varchar).toContain('CAST(val AS VARCHAR)');

      const date = transformationGenerators.typeConversion({ column: 'val', targetType: 'DATE' }, ctx);
      expect(date).toContain('TRY_CAST(val AS DATE)');

      const bool = transformationGenerators.typeConversion({ column: 'val', targetType: 'BOOLEAN' }, ctx);
      expect(bool).toContain('CASE WHEN');
    });
  });

  describe('stringManipulation', () => {
    it('generates string functions example output', () => {
      const sql = transformationGenerators.stringManipulation({
        column: 'name',
        operations: 'upper, lower, trim, length',
      }, ctx);
      expect(sql).toContain('UPPER(name)');
      expect(sql).toContain('LOWER(name)');
      expect(sql).toContain('LENGTH(name)');
    });

    it('shows all examples when no operations specified', () => {
      const sql = transformationGenerators.stringManipulation({}, ctx);
      expect(sql).toContain('INITCAP');
      expect(sql).toContain('SUBSTRING');
      expect(sql).toContain('REPLACE');
    });
  });

  describe('dateHandling', () => {
    it('generates DATE_TRUNC and EXTRACT examples', () => {
      const sql = transformationGenerators.dateHandling({
        column: 'created_at',
        operations: 'trunc_month, diff_days, dayname, year',
      }, ctx);
      expect(sql).toContain("DATE_TRUNC('month'");
      expect(sql).toContain("DATE_DIFF('day'");
      expect(sql).toContain('EXTRACT(YEAR');
    });

    it('shows full date example when no operations specified', () => {
      const sql = transformationGenerators.dateHandling({}, ctx);
      expect(sql).toContain("DATE_TRUNC('week'");
      expect(sql).toContain("DATE_TRUNC('quarter'");
      expect(sql).toContain('WEEK(');
    });
  });
});

// ─── Optimization Generators ──────────────────────────────────────────────────

describe('optimizationGenerators', () => {
  const ctx = makeContext();

  describe('explain', () => {
    it('generates EXPLAIN ANALYZE for given SQL', () => {
      const sql = optimizationGenerators.explain({
        sql: 'SELECT * FROM orders LIMIT 100',
      }, ctx);
      expect(sql).toContain('EXPLAIN ANALYZE');
      expect(sql).toContain('SELECT * FROM orders');
    });

    it('uses currentSql from context when sql input empty', () => {
      const ctxWithSql = makeContext({ currentSql: 'SELECT * FROM users' });
      const sql = optimizationGenerators.explain({}, ctxWithSql);
      expect(sql).toContain('SELECT * FROM users');
    });

    it('shows template when no SQL provided', () => {
      const sql = optimizationGenerators.explain({}, ctx);
      expect(sql).toContain('Replace');   // lowercase per template
      expect(sql).toContain("'<your_query>'");
    });
  });

  describe('index', () => {
    it('generates CREATE INDEX for given columns', () => {
      const sql = optimizationGenerators.index({
        tableName: 'orders',
        columns: 'user_id, created_at',
      }, ctx);
      expect(sql).toContain('CREATE INDEX');
      expect(sql).toContain('orders');
      expect(sql).toContain('user_id, created_at');
    });

    it('shows all index type examples when no columns provided', () => {
      const sql = optimizationGenerators.index({}, ctx);
      expect(sql).toContain('Single column index');
      expect(sql).toContain('Composite index');
      expect(sql).toContain('Partial index');
      expect(sql).toContain('Expression index');
      expect(sql).toContain('Covering index');
    });

    it('respects IF NOT EXISTS and UNIQUE flags', () => {
      const sql = optimizationGenerators.index({
        tableName: 'users',
        columns: 'email',
        unique: true,
        ifNotExists: true,
      }, ctx);
      expect(sql).toContain('CREATE UNIQUE INDEX');
      expect(sql).toContain('IF NOT EXISTS');
    });
  });

  describe('queryRewrite', () => {
    it('shows optimization patterns when no original SQL', () => {
      const sql = optimizationGenerators.queryRewrite({}, ctx);
      expect(sql).toContain('rewrite');
      expect(sql).toContain('SELECT *');
      expect(sql).toContain('UNION ALL');
      expect(sql).toContain('CTE');
    });

    it('includes original SQL in rewrite analysis', () => {
      const sql = optimizationGenerators.queryRewrite({
        originalSql: 'SELECT * FROM large_table WHERE id IN (SELECT id FROM other)',
      }, ctx);
      expect(sql).toContain('SELECT * FROM large_table');
    });
  });
});

// ─── Utility Generators ────────────────────────────────────────────────────────

describe('utilityGenerators', () => {
  const ctx = makeContext();

  describe('testData', () => {
    it('generates test data creation with GENERATE_SERIES', () => {
      const sql = utilityGenerators.testData({
        tableName: 'test_users',
        rowCount: 50,
      }, ctx);
      expect(sql).toContain('GENERATE_SERIES(1, 50)');
      expect(sql).toContain('test_users');
      expect(sql).toContain('CREATE TABLE');
    });

    it('uses default count when rowCount not provided', () => {
      const sql = utilityGenerators.testData({}, ctx);
      expect(sql).toContain('GENERATE_SERIES(1, 100)');
    });
  });

  describe('summarize', () => {
    it('generates SUMMARIZE command', () => {
      const sql = utilityGenerators.summarize({ tableName: 'orders' }, ctx);
      expect(sql).toContain('SUMMARIZE "orders"');
      expect(sql).toContain('total_rows');
      expect(sql).toContain('null_count');
    });

    it('uses context tableName when input not provided', () => {
      const sql = utilityGenerators.summarize({}, ctx);
      expect(sql).toContain('SUMMARIZE "test_table"');
    });
  });

  describe('sampleQuery', () => {
    it('generates sample query with BERNOULLI method', () => {
      const sql = utilityGenerators.sampleQuery({
        tableName: 'orders',
        sampleMethod: 'BERNOULLI',
        sampleSize: '10%',
      }, ctx);
      expect(sql).toContain('USING SAMPLE 10% (BERNOULLI)');
    });

    it('generates sample query with RESERVOIR method', () => {
      const sql = utilityGenerators.sampleQuery({
        tableName: 'events',
        sampleMethod: 'RESERVOIR',
        sampleSize: '1000',
      }, ctx);
      expect(sql).toContain('USING SAMPLE 1000 (RESERVOIR)');
    });

    it('uses default 10% BERNOULLI when no method specified', () => {
      const sql = utilityGenerators.sampleQuery({}, ctx);
      expect(sql).toContain('USING SAMPLE 10%');
    });
  });
});

// ─── Edge Cases ────────────────────────────────────────────────────────────────

describe('Edge cases', () => {
  it('all generators handle missing context gracefully', () => {
    const emptyCtx: SkillExecutionContext = {} as any;

    expect(() => sqlQueryGenerators.select({}, emptyCtx)).not.toThrow();
    expect(() => sqlDdlGenerators.dropTable({}, emptyCtx)).not.toThrow();
    expect(() => analysisGenerators.timeSeries({}, emptyCtx)).not.toThrow();
    expect(() => transformationGenerators.pivot({}, emptyCtx)).not.toThrow();
    expect(() => optimizationGenerators.explain({}, emptyCtx)).not.toThrow();
    expect(() => utilityGenerators.testData({}, emptyCtx)).not.toThrow();
  });

  it('all generators return a non-empty string for valid inputs', () => {
    const ctx = makeContext();
    const inputs = { tableName: 'test', conditions: 'id > 0' };

    expect(sqlQueryGenerators.select(inputs, ctx).length).toBeGreaterThan(0);
    expect(analysisGenerators.comparison(inputs, ctx).length).toBeGreaterThan(0);
    expect(transformationGenerators.typeConversion(inputs, ctx).length).toBeGreaterThan(0);
    expect(optimizationGenerators.index(inputs, ctx).length).toBeGreaterThan(0);
    expect(utilityGenerators.summarize(inputs, ctx).length).toBeGreaterThan(0);
  });

  it('all generators return a string (not undefined or null)', () => {
    const ctx = makeContext();
    expect(typeof sqlQueryGenerators.select({}, ctx)).toBe('string');
    expect(typeof sqlDdlGenerators.createTable({}, ctx)).toBe('string');
    expect(typeof analysisGenerators.funnel({}, ctx)).toBe('string');
    expect(typeof transformationGenerators.dateHandling({}, ctx)).toBe('string');
    expect(typeof optimizationGenerators.queryRewrite({}, ctx)).toBe('string');
    expect(typeof utilityGenerators.sampleQuery({}, ctx)).toBe('string');
  });
});
