const c={pivot(s,i){const{tableName:n,rowColumn:a,columnColumn:r,valueColumn:e,aggregator:o}=s,E=n||i.tableName||"source_table",t=o||"SUM";return!a||!r||!e?`-- PIVOT requires: rowColumn, columnColumn, valueColumn
SELECT
  ${a||"<row_column>"} AS row_key,
  MAX(CASE WHEN ${r} = 'value1' THEN ${t}(${e}) END) AS col_value1,
  MAX(CASE WHEN ${r} = 'value2' THEN ${t}(${e}) END) AS col_value2,
  MAX(CASE WHEN ${r} = 'value3' THEN ${t}(${e}) END) AS col_value3
FROM "${E}"
GROUP BY ${a||"<row_column>"};`:`-- PIVOT: rotate ${r} into columns
SELECT
  ${a},
  MAX(CASE WHEN ${r} = 'A' THEN ${t}(${e}) END) AS "A",
  MAX(CASE WHEN ${r} = 'B' THEN ${t}(${e}) END) AS "B",
  MAX(CASE WHEN ${r} = 'C' THEN ${t}(${e}) END) AS "C",
  MAX(CASE WHEN ${r} = 'D' THEN ${t}(${e}) END) AS "D"
FROM "${E}"
GROUP BY ${a}
ORDER BY ${a};`},unpivot(s,i){const{tableName:n,inputColumns:a,nameColumn:r,valueColumn:e}=s,o=n||i.tableName||"source_table",E=r||"attribute",t=e||"value";if(!a)return`-- UNPIVOT: rotate columns to rows
SELECT id, 'col_a' AS ${E}, col_a AS ${t} FROM "${o}"
UNION ALL
SELECT id, 'col_b' AS ${E}, col_b AS ${t} FROM "${o}"
UNION ALL
SELECT id, 'col_c' AS ${E}, col_c AS ${t} FROM "${o}";`;const l=a.split(",").map(A=>A.trim()),S=l.map(A=>`SELECT id, '${A}' AS ${E}, ${A}::VARCHAR AS ${t} FROM "${o}"`);return`-- UNPIVOT: rotate ${l.length} columns to rows
SELECT * FROM (
  ${S.join(`
  UNION ALL
  `)}
) t
ORDER BY id, ${E};`},typeConversion(s,i){var l,S;const{column:n,targetType:a,format:r}=s,e=i.tableName||"source_table",o=n||((S=(l=i.columns)==null?void 0:l[0])==null?void 0:S.name)||"column_name",t={VARCHAR:`CAST(${o} AS VARCHAR)`,INTEGER:`TRY_CAST(${o} AS INTEGER)`,BIGINT:`TRY_CAST(${o} AS BIGINT)`,DOUBLE:`TRY_CAST(${o} AS DOUBLE)`,DECIMAL:`TRY_CAST(${o} AS DECIMAL(18,4))`,DATE:`TRY_CAST(${o} AS DATE)`,TIMESTAMP:`TRY_CAST(${o} AS TIMESTAMP)`,BOOLEAN:`CASE WHEN ${o} IN ('1','true','yes','T') THEN true ELSE false END`,JSON:`TRY_CAST(${o} AS JSON)`}[a]||`CAST(${o} AS ${a})`;return`-- Type conversion: ${o} -> ${a}
SELECT
  ${o} AS original_value,
  ${t} AS converted_value
FROM "${e}"
LIMIT 100;`},stringManipulation(s,i){var l,S;const{column:n,operations:a}=s,r=i.tableName||"source_table",e=n||((S=(l=i.columns)==null?void 0:l[0])==null?void 0:S.name)||"text_column";if(!a)return`-- String manipulation examples for: ${e}
SELECT
  ${e} AS original,
  UPPER(${e}) AS upper_case,
  LOWER(${e}) AS lower_case,
  INITCAP(${e}) AS title_case,
  TRIM(${e}) AS trimmed,
  LENGTH(${e}) AS char_length,
  SUBSTRING(${e}, 1, 10) AS first_10_chars,
  REPLACE(${e}, 'old', 'new') AS replaced,
  REGEXP_REPLACE(${e}, '[^a-zA-Z0-9]', '', 'g') AS alphanumeric_only,
  CONCAT_WS('-', ${e}, 'suffix') AS concatenated
FROM "${r}"
LIMIT 50;`;const o=a.split(",").map(A=>A.trim().toLowerCase());let E=`-- String manipulation: ${a}
SELECT ${e} AS original,
`;const t=[];for(const A of o)switch(A){case"upper":t.push(`UPPER(${e}) AS upper_case`);break;case"lower":t.push(`LOWER(${e}) AS lower_case`);break;case"trim":t.push(`TRIM(BOTH ' ' FROM ${e}) AS trimmed`);break;case"length":t.push(`LENGTH(${e}) AS char_count`);break;case"substring":t.push(`SUBSTRING(${e}, 1, 10) AS first_10`);break;case"replace":t.push(`REPLACE(${e}, ' ', '_') AS spaces_to_underscore`);break;case"regex":t.push(`REGEXP_REPLACE(${e}, '[^0-9]', '', 'g') AS numbers_only`);break;case"concat":t.push(`CONCAT(${e}, '_v1') AS with_suffix`);break;default:t.push(`${e} AS ${A}`)}return E+=`  ${t.join(`,
  `)}
FROM "${r}"
LIMIT 50;`,E},dateHandling(s,i){var l,S;const{column:n,operations:a}=s,r=i.tableName||"source_table",e=n||((S=(l=i.columns)==null?void 0:l[0])==null?void 0:S.name)||"created_at";if(!a)return`-- Date/time operations on: ${e}
SELECT
  ${e} AS original_date,
  DATE_TRUNC('day', ${e}) AS day_start,
  DATE_TRUNC('week', ${e}) AS week_start,
  DATE_TRUNC('month', ${e}) AS month_start,
  DATE_TRUNC('quarter', ${e}) AS quarter_start,
  DATE_TRUNC('year', ${e}) AS year_start,
  DATE_DIFF('day', ${e}, CURRENT_DATE) AS days_ago,
  DATE_DIFF('month', ${e}, CURRENT_DATE) AS months_ago,
  DAYNAME(${e}) AS day_name,
  MONTHNAME(${e}) AS month_name,
  EXTRACT(YEAR FROM ${e}) AS year,
  EXTRACT(QUARTER FROM ${e}) AS quarter,
  EXTRACT(MONTH FROM ${e}) AS month,
  EXTRACT(DAY FROM ${e}) AS day,
  EXTRACT(HOUR FROM ${e}) AS hour,
  WEEK(${e}) AS week_of_year,
  DATE_FORMAT(${e}, '%Y-%m-%d') AS formatted_date
FROM "${r}"
LIMIT 100;`;const o=a.split(",").map(A=>A.trim().toLowerCase());let E=`-- Date operations: ${a}
SELECT ${e} AS original,
`;const t=[];for(const A of o)switch(A){case"trunc_day":t.push(`DATE_TRUNC('day', ${e}) AS day_trunc`);break;case"trunc_week":t.push(`DATE_TRUNC('week', ${e}) AS week_trunc`);break;case"trunc_month":t.push(`DATE_TRUNC('month', ${e}) AS month_trunc`);break;case"diff_days":t.push(`DATE_DIFF('day', ${e}, CURRENT_DATE) AS days_ago`);break;case"dayname":t.push(`DAYNAME(${e}) AS day_name`);break;case"monthname":t.push(`MONTHNAME(${e}) AS month_name`);break;case"year":t.push(`EXTRACT(YEAR FROM ${e}) AS year`);break;case"quarter":t.push(`EXTRACT(QUARTER FROM ${e}) AS quarter`);break;case"week":t.push(`WEEK(${e}) AS week_of_year`);break;case"format":t.push(`DATE_FORMAT(${e}, '%Y-%m-%d') AS formatted`);break;case"age":t.push(`AGE(${e}) AS age_from_date`);break;default:t.push(`${e} AS ${A}`)}return E+=`  ${t.join(`,
  `)}
FROM "${r}"
LIMIT 100;`,E}},T={explain(s,i){const{sql:n,format:a}=s;return!n&&i.currentSql?`-- EXPLAIN ANALYZE: analyze query performance
EXPLAIN ANALYZE ${i.currentSql};`:n?`-- Query execution plan analysis
EXPLAIN ${a==="json"?"ANALYZE FORMAT JSON":a==="yaml"?"ANALYZE FORMAT YAML":"ANALYZE"}
${n};`:`-- EXPLAIN ANALYZE: show query plan and execution statistics
-- Replace '<your_query>' with the SQL to analyze
EXPLAIN ANALYZE
SELECT *
FROM "<table_name>"
WHERE <condition>
LIMIT 100;`},index(s,i){const{tableName:n,columns:a,indexType:r,unique:e,ifNotExists:o}=s,E=n||i.tableName||"table_name";if(!a)return`-- Create index suggestions for: ${E}
-- Review EXPLAIN output for sequential scans, then add targeted indexes:

-- Single column index (B-tree default)
CREATE INDEX idx_${E}_col1 ON "${E}" (col1);

-- Composite index (column order matters!)
CREATE INDEX idx_${E}_col1_col2 ON "${E}" (col1, col2);

-- Partial index (index only rows matching filter)
CREATE INDEX idx_${E}_active ON "${E}" (created_at)
WHERE status = 'active';

-- Expression index (index on computed value)
CREATE INDEX idx_${E}_lower_email ON "${E}" (LOWER(email));

-- Covering index (includes all columns needed by query)
CREATE INDEX idx_${E}_covering ON "${E}" (user_id) INCLUDE (name, email);`;const t=`idx_${E}_${a.replace(/[^a-zA-Z0-9_]/g,"_")}`,l=o?"IF NOT EXISTS ":"",S=e?"UNIQUE ":"",A=r&&r!=="B-TREE"?`USING ${r}`:"";return`-- Create index on ${E}(${a})
CREATE ${S}INDEX ${l}${t}
ON "${E}" ${A}(${a});`},queryRewrite(s,i){const{originalSql:n,targetGoal:a}=s;return n?`-- Original query optimization analysis
-- Original:
${n}

-- Rewrite suggestions:

-- 1. Verify indexes exist on filter columns
EXPLAIN ${n};

-- 2. If using OR conditions, replace with IN or UNION ALL
-- 3. If aggregating on large tables, pre-filter first
-- 4. If joining multiple large tables, consider hash join hints
-- 5. If using correlated subqueries, replace with JOIN or CTE

-- Rewritten example (with SARGable predicates):
SELECT *
FROM (
  SELECT * FROM "<table>" WHERE <sargable_condition> LIMIT 100000
) t
WHERE <additional_filters>;`:`-- Query optimization and rewrite suggestions
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
--       SELECT t1.*, agg.total FROM t1 JOIN agg ON t1.col = agg.col;`},duckdbTuner(s,i){const n=s.memoryLimit||"2GB",a=s.threads||4;return`-- DuckDB WASM Execution & Memory Optimization Suite
-- 1. Configure Memory Upper Bound (Prevent OOM in Browser)
SET memory_limit = '${n}';

-- 2. Configure Parallel Worker Threads
SET threads = ${a};

-- 3. Enable Vectorized Engine & Memory Tracking
PRAGMA enable_profiling = 'json';
PRAGMA profiling_mode = 'detailed';

-- 4. Enable Automatic Spill To Disk (If Supported)
SET preserve_insertion_order = false;

SELECT 'DuckDB WASM Memory and Threads Optimized Successfully' AS status, '${n}' AS memory_limit, ${a} AS threads;`},schemaSanitizer(s,i){const n=s.tableName||i.tableName||"target_table",a=s.maskPii!==!1;return`-- Data Quality & PII Sanitization Audit for "${n}"
-- 1. Audit Null Value Frequencies & Summary
SUMMARIZE SELECT * FROM "${n}";

-- 2. Create Masked / Sanitized View
CREATE OR REPLACE VIEW "${n}_sanitized" AS
SELECT
  * EXCLUDE (${a?"email, phone":"none"}),
  ${a?"REGEXP_REPLACE(email, '(^.{2})(.*)(@.*$)', '\\1***\\3') AS email_masked,":""}
  ${a?"REGEXP_REPLACE(phone, '(^\\d{3})\\d{4}(\\d{4}$)', '\\1****\\2') AS phone_masked,":""}
  MD5(CAST(id AS VARCHAR)) AS anonymized_id
FROM "${n}";

SELECT * FROM "${n}_sanitized" LIMIT 50;`}},u={testData(s,i){const{tableName:n,rowCount:a,schema:r}=s,e=n||"test_data",o=a||100;return r?`-- Generate ${o} test rows for: ${e}
CREATE TABLE "${e}" AS
SELECT
  ${r}
FROM GENERATE_SERIES(1, ${o}) t(i);`:`-- Generate test data using GENERATE_SERIES
-- Users table
CREATE TABLE "${e}_users" AS
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
FROM GENERATE_SERIES(1, ${o}) t(i);

-- Events table
CREATE TABLE "${e}_events" AS
SELECT
  GENERATE_UUID() AS event_id,
  (RANDOM() * ${o})::INT + 1 AS user_id,
  CASE (RANDOM() * 4)::INT
    WHEN 0 THEN 'page_view'
    WHEN 1 THEN 'click'
    WHEN 2 THEN 'purchase'
    ELSE 'signup'
  END AS event_type,
  TIMESTAMP '2024-01-01' + INTERVAL (RANDOM() * 365 * 24) HOUR AS event_time,
  (RANDOM() * 100)::DOUBLE AS revenue
FROM GENERATE_SERIES(1, ${o*3}) t(i);

SELECT 'Generated ' || COUNT(*) || ' rows in ${e}_users' AS result FROM "${e}_users";`},summarize(s,i){const n=s.tableName||i.tableName||"table_name";return`-- Data profiling summary for: ${n}
SUMMARIZE "${n}";

-- Extended statistics
SELECT
  COUNT(*) AS total_rows,
  COUNT(DISTINCT *) AS distinct_rows,
  COUNT(*) * 1.0 / NULLIF(COUNT(DISTINCT <key_column>), 0) AS avg_rows_per_key
FROM "${n}";

-- Column-level statistics
SELECT
  'column_name' AS column_name,
  COUNT(*) AS total_count,
  COUNT(column_name) AS non_null_count,
  COUNT(*) - COUNT(column_name) AS null_count,
  ROUND(100.0 * (COUNT(*) - COUNT(column_name)) / COUNT(*), 2) AS null_percentage,
  COUNT(DISTINCT column_name) AS distinct_count
FROM "${n}";`},sampleQuery(s,i){const{tableName:n,sampleMethod:a,sampleSize:r,columns:e}=s,o=n||i.tableName||"table_name",E=e||"*",t=r||"10%",l=a||"BERNOULLI",S={BERNOULLI:`USING SAMPLE ${t} (BERNOULLI)`,RESERVOIR:`USING SAMPLE ${t} (RESERVOIR)`,SYSTEM:`USING SAMPLE ${t} (SYSTEM)`,FIRST:`USING SAMPLE ${t} ROWS`},A=S[l]||S.BERNOULLI;return`-- Sample query on: ${o}
SELECT ${E}
FROM "${o}"
${A};`}};export{T as optimizationGenerators,c as transformationGenerators,u as utilityGenerators};
