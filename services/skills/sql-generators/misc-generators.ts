/**
 * Miscellaneous SQL Generators
 *
 * Template-based SQL generation for:
 * - Transformation: PIVOT, UNPIVOT, Type Conversion, String Manipulation, Date Handling
 * - Optimization: EXPLAIN, CREATE INDEX, Query Rewrite
 * - Utility: Test Data, SUMMARIZE, Sample Query
 */

import { SkillExecutionContext } from '../../../types';

export const transformationGenerators = {
  /**
   * Generate PIVOT SQL for rotating rows to columns.
   * input: { tableName, rowColumn, columnColumn, valueColumn, aggregator }
   */
  pivot(inputs: Record<string, any>, context: SkillExecutionContext): string {
    const { tableName, rowColumn, columnColumn, valueColumn, aggregator } = inputs;
    const sourceTable = tableName || context.tableName || 'source_table';
    const agg = aggregator || 'SUM';

    if (!rowColumn || !columnColumn || !valueColumn) {
      return `-- PIVOT requires: rowColumn, columnColumn, valueColumn
SELECT
  ${rowColumn || '<row_column>'} AS row_key,
  MAX(CASE WHEN ${columnColumn} = 'value1' THEN ${agg}(${valueColumn}) END) AS col_value1,
  MAX(CASE WHEN ${columnColumn} = 'value2' THEN ${agg}(${valueColumn}) END) AS col_value2,
  MAX(CASE WHEN ${columnColumn} = 'value3' THEN ${agg}(${valueColumn}) END) AS col_value3
FROM "${sourceTable}"
GROUP BY ${rowColumn || '<row_column>'};`;
    }

    return `-- PIVOT: rotate ${columnColumn} into columns
SELECT
  ${rowColumn},
  MAX(CASE WHEN ${columnColumn} = 'A' THEN ${agg}(${valueColumn}) END) AS "A",
  MAX(CASE WHEN ${columnColumn} = 'B' THEN ${agg}(${valueColumn}) END) AS "B",
  MAX(CASE WHEN ${columnColumn} = 'C' THEN ${agg}(${valueColumn}) END) AS "C",
  MAX(CASE WHEN ${columnColumn} = 'D' THEN ${agg}(${valueColumn}) END) AS "D"
FROM "${sourceTable}"
GROUP BY ${rowColumn}
ORDER BY ${rowColumn};`;
  },

  /**
   * Generate UNPIVOT SQL for rotating columns to rows.
   * input: { tableName, inputColumns, nameColumn, valueColumn }
   */
  unpivot(inputs: Record<string, any>, context: SkillExecutionContext): string {
    const { tableName, inputColumns, nameColumn, valueColumn } = inputs;
    const sourceTable = tableName || context.tableName || 'source_table';
    const colName = nameColumn || 'attribute';
    const valName = valueColumn || 'value';

    if (!inputColumns) {
      return `-- UNPIVOT: rotate columns to rows
SELECT id, 'col_a' AS ${colName}, col_a AS ${valName} FROM "${sourceTable}"
UNION ALL
SELECT id, 'col_b' AS ${colName}, col_b AS ${valName} FROM "${sourceTable}"
UNION ALL
SELECT id, 'col_c' AS ${colName}, col_c AS ${valName} FROM "${sourceTable}";`;
    }

    const cols = inputColumns.split(',').map((c: string) => c.trim());
    const unionParts = cols.map((col: string) =>
      `SELECT id, '${col}' AS ${colName}, ${col}::VARCHAR AS ${valName} FROM "${sourceTable}"`
    );

    return `-- UNPIVOT: rotate ${cols.length} columns to rows
SELECT * FROM (
  ${unionParts.join('\n  UNION ALL\n  ')}
) t
ORDER BY id, ${colName};`;
  },

  /**
   * Generate type conversion SQL.
   * input: { column, targetType, format }
   */
  typeConversion(inputs: Record<string, any>, context: SkillExecutionContext): string {
    const { column, targetType, format } = inputs;
    const tableName = context.tableName || 'source_table';
    const col = column || context.columns?.[0]?.name || 'column_name';

    const conversions: Record<string, string> = {
      VARCHAR: `CAST(${col} AS VARCHAR)`,
      INTEGER: `TRY_CAST(${col} AS INTEGER)`,
      BIGINT: `TRY_CAST(${col} AS BIGINT)`,
      DOUBLE: `TRY_CAST(${col} AS DOUBLE)`,
      DECIMAL: `TRY_CAST(${col} AS DECIMAL(18,4))`,
      DATE: `TRY_CAST(${col} AS DATE)`,
      TIMESTAMP: `TRY_CAST(${col} AS TIMESTAMP)`,
      BOOLEAN: `CASE WHEN ${col} IN ('1','true','yes','T') THEN true ELSE false END`,
      JSON: `TRY_CAST(${col} AS JSON)`,
    };

    const converted = conversions[targetType] || `CAST(${col} AS ${targetType})`;

    return `-- Type conversion: ${col} -> ${targetType}
SELECT
  ${col} AS original_value,
  ${converted} AS converted_value
FROM "${tableName}"
LIMIT 100;`;
  },

  /**
   * Generate string manipulation SQL.
   * input: { column, operations }
   */
  stringManipulation(inputs: Record<string, any>, context: SkillExecutionContext): string {
    const { column, operations } = inputs;
    const tableName = context.tableName || 'source_table';
    const col = column || context.columns?.[0]?.name || 'text_column';

    if (!operations) {
      return `-- String manipulation examples for: ${col}
SELECT
  ${col} AS original,
  UPPER(${col}) AS upper_case,
  LOWER(${col}) AS lower_case,
  INITCAP(${col}) AS title_case,
  TRIM(${col}) AS trimmed,
  LENGTH(${col}) AS char_length,
  SUBSTRING(${col}, 1, 10) AS first_10_chars,
  REPLACE(${col}, 'old', 'new') AS replaced,
  REGEXP_REPLACE(${col}, '[^a-zA-Z0-9]', '', 'g') AS alphanumeric_only,
  CONCAT_WS('-', ${col}, 'suffix') AS concatenated
FROM "${tableName}"
LIMIT 50;`;
    }

    const ops = operations.split(',').map((o: string) => o.trim().toLowerCase());
    let sql = `-- String manipulation: ${operations}\nSELECT ${col} AS original,\n`;
    const selectParts: string[] = [];

    for (const op of ops) {
      switch (op) {
        case 'upper': selectParts.push(`UPPER(${col}) AS upper_case`); break;
        case 'lower': selectParts.push(`LOWER(${col}) AS lower_case`); break;
        case 'trim': selectParts.push(`TRIM(BOTH ' ' FROM ${col}) AS trimmed`); break;
        case 'length': selectParts.push(`LENGTH(${col}) AS char_count`); break;
        case 'substring': selectParts.push(`SUBSTRING(${col}, 1, 10) AS first_10`); break;
        case 'replace': selectParts.push(`REPLACE(${col}, ' ', '_') AS spaces_to_underscore`); break;
        case 'regex': selectParts.push(`REGEXP_REPLACE(${col}, '[^0-9]', '', 'g') AS numbers_only`); break;
        case 'concat': selectParts.push(`CONCAT(${col}, '_v1') AS with_suffix`); break;
        default: selectParts.push(`${col} AS ${op}`);
      }
    }

    sql += `  ${selectParts.join(',\n  ')}\nFROM "${tableName}"\nLIMIT 50;`;
    return sql;
  },

  /**
   * Generate date/time handling SQL.
   * input: { column, operations }
   */
  dateHandling(inputs: Record<string, any>, context: SkillExecutionContext): string {
    const { column, operations } = inputs;
    const tableName = context.tableName || 'source_table';
    const col = column || context.columns?.[0]?.name || 'created_at';

    if (!operations) {
      return `-- Date/time operations on: ${col}
SELECT
  ${col} AS original_date,
  DATE_TRUNC('day', ${col}) AS day_start,
  DATE_TRUNC('week', ${col}) AS week_start,
  DATE_TRUNC('month', ${col}) AS month_start,
  DATE_TRUNC('quarter', ${col}) AS quarter_start,
  DATE_TRUNC('year', ${col}) AS year_start,
  DATE_DIFF('day', ${col}, CURRENT_DATE) AS days_ago,
  DATE_DIFF('month', ${col}, CURRENT_DATE) AS months_ago,
  DAYNAME(${col}) AS day_name,
  MONTHNAME(${col}) AS month_name,
  EXTRACT(YEAR FROM ${col}) AS year,
  EXTRACT(QUARTER FROM ${col}) AS quarter,
  EXTRACT(MONTH FROM ${col}) AS month,
  EXTRACT(DAY FROM ${col}) AS day,
  EXTRACT(HOUR FROM ${col}) AS hour,
  WEEK(${col}) AS week_of_year,
  DATE_FORMAT(${col}, '%Y-%m-%d') AS formatted_date
FROM "${tableName}"
LIMIT 100;`;
    }

    const ops = operations.split(',').map((o: string) => o.trim().toLowerCase());
    let sql = `-- Date operations: ${operations}\nSELECT ${col} AS original,\n`;
    const selectParts: string[] = [];

    for (const op of ops) {
      switch (op) {
        case 'trunc_day': selectParts.push(`DATE_TRUNC('day', ${col}) AS day_trunc`); break;
        case 'trunc_week': selectParts.push(`DATE_TRUNC('week', ${col}) AS week_trunc`); break;
        case 'trunc_month': selectParts.push(`DATE_TRUNC('month', ${col}) AS month_trunc`); break;
        case 'diff_days': selectParts.push(`DATE_DIFF('day', ${col}, CURRENT_DATE) AS days_ago`); break;
        case 'dayname': selectParts.push(`DAYNAME(${col}) AS day_name`); break;
        case 'monthname': selectParts.push(`MONTHNAME(${col}) AS month_name`); break;
        case 'year': selectParts.push(`EXTRACT(YEAR FROM ${col}) AS year`); break;
        case 'quarter': selectParts.push(`EXTRACT(QUARTER FROM ${col}) AS quarter`); break;
        case 'week': selectParts.push(`WEEK(${col}) AS week_of_year`); break;
        case 'format': selectParts.push(`DATE_FORMAT(${col}, '%Y-%m-%d') AS formatted`); break;
        case 'age': selectParts.push(`AGE(${col}) AS age_from_date`); break;
        default: selectParts.push(`${col} AS ${op}`);
      }
    }

    sql += `  ${selectParts.join(',\n  ')}\nFROM "${tableName}"\nLIMIT 100;`;
    return sql;
  },
};

export const optimizationGenerators = {
  /**
   * Generate EXPLAIN ANALYZE SQL.
   * input: { sql, format }
   */
  explain(inputs: Record<string, any>, context: SkillExecutionContext): string {
    const { sql, format } = inputs;

    if (!sql && context.currentSql) {
      return `-- EXPLAIN ANALYZE: analyze query performance
EXPLAIN ANALYZE ${context.currentSql};`;
    }

    if (!sql) {
      return `-- EXPLAIN ANALYZE: show query plan and execution statistics
-- Replace '<your_query>' with the SQL to analyze
EXPLAIN ANALYZE
SELECT *
FROM "<table_name>"
WHERE <condition>
LIMIT 100;`;
    }

    const explainType = format === 'json' ? 'ANALYZE FORMAT JSON' : format === 'yaml' ? 'ANALYZE FORMAT YAML' : 'ANALYZE';
    return `-- Query execution plan analysis
EXPLAIN ${explainType}
${sql};`;
  },

  /**
   * Generate CREATE INDEX SQL.
   * input: { tableName, columns, indexType, unique, ifNotExists }
   */
  index(inputs: Record<string, any>, context: SkillExecutionContext): string {
    const { tableName, columns, indexType, unique, ifNotExists } = inputs;
    const sourceTable = tableName || context.tableName || 'table_name';

    if (!columns) {
      return `-- Create index suggestions for: ${sourceTable}
-- Review EXPLAIN output for sequential scans, then add targeted indexes:

-- Single column index (B-tree default)
CREATE INDEX idx_${sourceTable}_col1 ON "${sourceTable}" (col1);

-- Composite index (column order matters!)
CREATE INDEX idx_${sourceTable}_col1_col2 ON "${sourceTable}" (col1, col2);

-- Partial index (index only rows matching filter)
CREATE INDEX idx_${sourceTable}_active ON "${sourceTable}" (created_at)
WHERE status = 'active';

-- Expression index (index on computed value)
CREATE INDEX idx_${sourceTable}_lower_email ON "${sourceTable}" (LOWER(email));

-- Covering index (includes all columns needed by query)
CREATE INDEX idx_${sourceTable}_covering ON "${sourceTable}" (user_id) INCLUDE (name, email);`;
    }

    const idxName = `idx_${sourceTable}_${columns.replace(/[^a-zA-Z0-9_]/g, '_')}`;
    const ifNot = ifNotExists ? 'IF NOT EXISTS ' : '';
    const uniq = unique ? 'UNIQUE ' : '';
    const idxType = indexType && indexType !== 'B-TREE' ? `USING ${indexType}` : '';

    return `-- Create index on ${sourceTable}(${columns})
CREATE ${uniq}INDEX ${ifNot}${idxName}
ON "${sourceTable}" ${idxType}(${columns});`;
  },

  /**
   * Generate query rewrite/optimization suggestions.
   * input: { originalSql, targetGoal }
   */
  queryRewrite(inputs: Record<string, any>, context: SkillExecutionContext): string {
    const { originalSql, targetGoal } = inputs;

    if (!originalSql) {
      return `-- Query optimization and rewrite suggestions
-- Paste your original SQL above for optimization analysis

-- Common optimization patterns:

-- 1. Avoid SELECT * - specify needed columns
-- BAD:  SELECT * FROM large_table
-- GOOD: SELECT id, name, email FROM large_table

-- 2. Use early filtering (push predicates down)
-- BAD:  SELECT * FROM t WHERE (SELECT COUNT(*) FROM x) > 0
-- GOOD: SELECT * FROM t WHERE EXISTS (SELECT 1 FROM x WHERE x.id = t.id)

-- 3. Replace OR with UNION ALL or IN
-- BAD:  WHERE status = 'a' OR status = 'b' OR status = 'c'
-- GOOD: WHERE status IN ('a', 'b', 'c')

-- 4. Replace subquery with JOIN
-- BAD:  WHERE col IN (SELECT col FROM t2 WHERE ...)
-- GOOD: SELECT DISTINCT t1.* FROM t1 JOIN t2 ON t1.col = t2.col WHERE ...

-- 5. Use LIMIT early to reduce row count
-- BAD:  SELECT ... (complex query computing all rows)
-- GOOD: WITH filtered AS (SELECT * FROM t WHERE <condition> LIMIT 10000)
--       SELECT ... (further processing on filtered)

-- 6. Pre-aggregate in CTE before joining
-- BAD:  SELECT t1.*, SUM(t2.amount) ... GROUP BY t1.id
-- GOOD: WITH agg AS (SELECT col, SUM(amount) AS total FROM t2 GROUP BY col)
--       SELECT t1.*, agg.total FROM t1 JOIN agg ON t1.col = agg.col;`;
    }

    return `-- Original query optimization analysis
-- Original:
${originalSql}

-- Rewrite suggestions:

-- 1. Verify indexes exist on filter columns
EXPLAIN ${originalSql};

-- 2. If using OR conditions, replace with IN or UNION ALL
-- 3. If aggregating on large tables, pre-filter first
-- 4. If joining multiple large tables, consider hash join hints
-- 5. If using correlated subqueries, replace with JOIN or CTE

-- Rewritten example (with SARGable predicates):
SELECT *
FROM (
  SELECT * FROM "<table>" WHERE <sargable_condition> LIMIT 100000
) t
WHERE <additional_filters>;`;
  },
};

export const utilityGenerators = {
  /**
   * Generate test/sample data creation SQL.
   * input: { tableName, rowCount, schema }
   */
  testData(inputs: Record<string, any>, context: SkillExecutionContext): string {
    const { tableName, rowCount, schema } = inputs;
    const targetTable = tableName || 'test_data';
    const count = rowCount || 100;

    if (!schema) {
      return `-- Generate test data using GENERATE_SERIES
-- Users table
CREATE TABLE "${targetTable}_users" AS
SELECT
  i AS id,
  'user_' || i::VARCHAR AS username,
  'user' || i::VARCHAR || '@example.com' AS email,
  CASE (i % 4)
    WHEN 0 THEN 'admin'
    WHEN 1 THEN 'moderator'
    WHEN 2 THEN 'editor'
    ELSE 'viewer'
  END AS role,
  RANDOM() * 1000::DOUBLE AS balance,
  TIMESTAMP '2024-01-01' + INTERVAL (RANDOM() * 365) DAY AS created_at
FROM GENERATE_SERIES(1, ${count}) t(i);

-- Events table
CREATE TABLE "${targetTable}_events" AS
SELECT
  GENERATE_UUID() AS event_id,
  (RANDOM() * ${count})::INT + 1 AS user_id,
  CASE (RANDOM() * 4)::INT
    WHEN 0 THEN 'page_view'
    WHEN 1 THEN 'click'
    WHEN 2 THEN 'purchase'
    ELSE 'signup'
  END AS event_type,
  TIMESTAMP '2024-01-01' + INTERVAL (RANDOM() * 365 * 24) HOUR AS event_time,
  (RANDOM() * 100)::DOUBLE AS revenue
FROM GENERATE_SERIES(1, ${count * 3}) t(i);

SELECT 'Generated ' || COUNT(*) || ' rows in ${targetTable}_users' AS result FROM "${targetTable}_users";`;
    }

    return `-- Generate ${count} test rows for: ${targetTable}
CREATE TABLE "${targetTable}" AS
SELECT
  ${schema}
FROM GENERATE_SERIES(1, ${count}) t(i);`;
  },

  /**
   * Generate SUMMARIZE SQL for quick data profiling.
   * input: { tableName }
   */
  summarize(inputs: Record<string, any>, context: SkillExecutionContext): string {
    const tableName = inputs.tableName || context.tableName || 'table_name';

    return `-- Data profiling summary for: ${tableName}
SUMMARIZE "${tableName}";

-- Extended statistics
SELECT
  COUNT(*) AS total_rows,
  COUNT(DISTINCT *) AS distinct_rows,
  COUNT(*) * 1.0 / NULLIF(COUNT(DISTINCT <key_column>), 0) AS avg_rows_per_key
FROM "${tableName}";

-- Column-level statistics
SELECT
  'column_name' AS column_name,
  COUNT(*) AS total_count,
  COUNT(column_name) AS non_null_count,
  COUNT(*) - COUNT(column_name) AS null_count,
  ROUND(100.0 * (COUNT(*) - COUNT(column_name)) / COUNT(*), 2) AS null_percentage,
  COUNT(DISTINCT column_name) AS distinct_count
FROM "${tableName}";`;
  },

  /**
   * Generate sample query SQL.
   * input: { tableName, sampleMethod, sampleSize, columns }
   */
  sampleQuery(inputs: Record<string, any>, context: SkillExecutionContext): string {
    const { tableName, sampleMethod, sampleSize, columns } = inputs;
    const sourceTable = tableName || context.tableName || 'table_name';
    const cols = columns || '*';
    const size = sampleSize || '10%';
    const method = sampleMethod || 'BERNOULLI';

    const methodMap: Record<string, string> = {
      BERNOULLI: `USING SAMPLE ${size} (BERNOULLI)`,
      RESERVOIR: `USING SAMPLE ${size} (RESERVOIR)`,
      SYSTEM: `USING SAMPLE ${size} (SYSTEM)`,
      FIRST: `USING SAMPLE ${size} ROWS`,
    };

    const sampleClause = methodMap[method] || methodMap.BERNOULLI;

    return `-- Sample query on: ${sourceTable}
SELECT ${cols}
FROM "${sourceTable}"
${sampleClause};`;
  },
};
