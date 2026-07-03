const c={pivot(A,s){const{tableName:E,rowColumn:a,columnColumn:r,valueColumn:e,aggregator:n}=A,o=E||s.tableName||"source_table",t=n||"SUM";return!a||!r||!e?`-- PIVOT requires: rowColumn, columnColumn, valueColumn
SELECT
  ${a||"<row_column>"} AS row_key,
  MAX(CASE WHEN ${r} = 'value1' THEN ${t}(${e}) END) AS col_value1,
  MAX(CASE WHEN ${r} = 'value2' THEN ${t}(${e}) END) AS col_value2,
  MAX(CASE WHEN ${r} = 'value3' THEN ${t}(${e}) END) AS col_value3
FROM "${o}"
GROUP BY ${a||"<row_column>"};`:`-- PIVOT: rotate ${r} into columns
SELECT
  ${a},
  MAX(CASE WHEN ${r} = 'A' THEN ${t}(${e}) END) AS "A",
  MAX(CASE WHEN ${r} = 'B' THEN ${t}(${e}) END) AS "B",
  MAX(CASE WHEN ${r} = 'C' THEN ${t}(${e}) END) AS "C",
  MAX(CASE WHEN ${r} = 'D' THEN ${t}(${e}) END) AS "D"
FROM "${o}"
GROUP BY ${a}
ORDER BY ${a};`},unpivot(A,s){const{tableName:E,inputColumns:a,nameColumn:r,valueColumn:e}=A,n=E||s.tableName||"source_table",o=r||"attribute",t=e||"value";if(!a)return`-- UNPIVOT: rotate columns to rows
SELECT id, 'col_a' AS ${o}, col_a AS ${t} FROM "${n}"
UNION ALL
SELECT id, 'col_b' AS ${o}, col_b AS ${t} FROM "${n}"
UNION ALL
SELECT id, 'col_c' AS ${o}, col_c AS ${t} FROM "${n}";`;const i=a.split(",").map(l=>l.trim()),S=i.map(l=>`SELECT id, '${l}' AS ${o}, ${l}::VARCHAR AS ${t} FROM "${n}"`);return`-- UNPIVOT: rotate ${i.length} columns to rows
SELECT * FROM (
  ${S.join(`
  UNION ALL
  `)}
) t
ORDER BY id, ${o};`},typeConversion(A,s){var i,S;const{column:E,targetType:a,format:r}=A,e=s.tableName||"source_table",n=E||((S=(i=s.columns)==null?void 0:i[0])==null?void 0:S.name)||"column_name",t={VARCHAR:`CAST(${n} AS VARCHAR)`,INTEGER:`TRY_CAST(${n} AS INTEGER)`,BIGINT:`TRY_CAST(${n} AS BIGINT)`,DOUBLE:`TRY_CAST(${n} AS DOUBLE)`,DECIMAL:`TRY_CAST(${n} AS DECIMAL(18,4))`,DATE:`TRY_CAST(${n} AS DATE)`,TIMESTAMP:`TRY_CAST(${n} AS TIMESTAMP)`,BOOLEAN:`CASE WHEN ${n} IN ('1','true','yes','T') THEN true ELSE false END`,JSON:`TRY_CAST(${n} AS JSON)`}[a]||`CAST(${n} AS ${a})`;return`-- Type conversion: ${n} -> ${a}
SELECT
  ${n} AS original_value,
  ${t} AS converted_value
FROM "${e}"
LIMIT 100;`},stringManipulation(A,s){var i,S;const{column:E,operations:a}=A,r=s.tableName||"source_table",e=E||((S=(i=s.columns)==null?void 0:i[0])==null?void 0:S.name)||"text_column";if(!a)return`-- String manipulation examples for: ${e}
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
LIMIT 50;`;const n=a.split(",").map(l=>l.trim().toLowerCase());let o=`-- String manipulation: ${a}
SELECT ${e} AS original,
`;const t=[];for(const l of n)switch(l){case"upper":t.push(`UPPER(${e}) AS upper_case`);break;case"lower":t.push(`LOWER(${e}) AS lower_case`);break;case"trim":t.push(`TRIM(BOTH ' ' FROM ${e}) AS trimmed`);break;case"length":t.push(`LENGTH(${e}) AS char_count`);break;case"substring":t.push(`SUBSTRING(${e}, 1, 10) AS first_10`);break;case"replace":t.push(`REPLACE(${e}, ' ', '_') AS spaces_to_underscore`);break;case"regex":t.push(`REGEXP_REPLACE(${e}, '[^0-9]', '', 'g') AS numbers_only`);break;case"concat":t.push(`CONCAT(${e}, '_v1') AS with_suffix`);break;default:t.push(`${e} AS ${l}`)}return o+=`  ${t.join(`,
  `)}
FROM "${r}"
LIMIT 50;`,o},dateHandling(A,s){var i,S;const{column:E,operations:a}=A,r=s.tableName||"source_table",e=E||((S=(i=s.columns)==null?void 0:i[0])==null?void 0:S.name)||"created_at";if(!a)return`-- Date/time operations on: ${e}
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
LIMIT 100;`;const n=a.split(",").map(l=>l.trim().toLowerCase());let o=`-- Date operations: ${a}
SELECT ${e} AS original,
`;const t=[];for(const l of n)switch(l){case"trunc_day":t.push(`DATE_TRUNC('day', ${e}) AS day_trunc`);break;case"trunc_week":t.push(`DATE_TRUNC('week', ${e}) AS week_trunc`);break;case"trunc_month":t.push(`DATE_TRUNC('month', ${e}) AS month_trunc`);break;case"diff_days":t.push(`DATE_DIFF('day', ${e}, CURRENT_DATE) AS days_ago`);break;case"dayname":t.push(`DAYNAME(${e}) AS day_name`);break;case"monthname":t.push(`MONTHNAME(${e}) AS month_name`);break;case"year":t.push(`EXTRACT(YEAR FROM ${e}) AS year`);break;case"quarter":t.push(`EXTRACT(QUARTER FROM ${e}) AS quarter`);break;case"week":t.push(`WEEK(${e}) AS week_of_year`);break;case"format":t.push(`DATE_FORMAT(${e}, '%Y-%m-%d') AS formatted`);break;case"age":t.push(`AGE(${e}) AS age_from_date`);break;default:t.push(`${e} AS ${l}`)}return o+=`  ${t.join(`,
  `)}
FROM "${r}"
LIMIT 100;`,o}},T={explain(A,s){const{sql:E,format:a}=A;return!E&&s.currentSql?`-- EXPLAIN ANALYZE: analyze query performance
EXPLAIN ANALYZE ${s.currentSql};`:E?`-- Query execution plan analysis
EXPLAIN ${a==="json"?"ANALYZE FORMAT JSON":a==="yaml"?"ANALYZE FORMAT YAML":"ANALYZE"}
${E};`:`-- EXPLAIN ANALYZE: show query plan and execution statistics
-- Replace '<your_query>' with the SQL to analyze
EXPLAIN ANALYZE
SELECT *
FROM "<table_name>"
WHERE <condition>
LIMIT 100;`},index(A,s){const{tableName:E,columns:a,indexType:r,unique:e,ifNotExists:n}=A,o=E||s.tableName||"table_name";if(!a)return`-- Create index suggestions for: ${o}
-- Review EXPLAIN output for sequential scans, then add targeted indexes:

-- Single column index (B-tree default)
CREATE INDEX idx_${o}_col1 ON "${o}" (col1);

-- Composite index (column order matters!)
CREATE INDEX idx_${o}_col1_col2 ON "${o}" (col1, col2);

-- Partial index (index only rows matching filter)
CREATE INDEX idx_${o}_active ON "${o}" (created_at)
WHERE status = 'active';

-- Expression index (index on computed value)
CREATE INDEX idx_${o}_lower_email ON "${o}" (LOWER(email));

-- Covering index (includes all columns needed by query)
CREATE INDEX idx_${o}_covering ON "${o}" (user_id) INCLUDE (name, email);`;const t=`idx_${o}_${a.replace(/[^a-zA-Z0-9_]/g,"_")}`,i=n?"IF NOT EXISTS ":"",S=e?"UNIQUE ":"",l=r&&r!=="B-TREE"?`USING ${r}`:"";return`-- Create index on ${o}(${a})
CREATE ${S}INDEX ${i}${t}
ON "${o}" ${l}(${a});`},queryRewrite(A,s){const{originalSql:E,targetGoal:a}=A;return E?`-- Original query optimization analysis
-- Original:
${E}

-- Rewrite suggestions:

-- 1. Verify indexes exist on filter columns
EXPLAIN ${E};

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
--       SELECT t1.*, agg.total FROM t1 JOIN agg ON t1.col = agg.col;`}},u={testData(A,s){const{tableName:E,rowCount:a,schema:r}=A,e=E||"test_data",n=a||100;return r?`-- Generate ${n} test rows for: ${e}
CREATE TABLE "${e}" AS
SELECT
  ${r}
FROM GENERATE_SERIES(1, ${n}) t(i);`:`-- Generate test data using GENERATE_SERIES
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
FROM GENERATE_SERIES(1, ${n}) t(i);

-- Events table
CREATE TABLE "${e}_events" AS
SELECT
  GENERATE_UUID() AS event_id,
  (RANDOM() * ${n})::INT + 1 AS user_id,
  CASE (RANDOM() * 4)::INT
    WHEN 0 THEN 'page_view'
    WHEN 1 THEN 'click'
    WHEN 2 THEN 'purchase'
    ELSE 'signup'
  END AS event_type,
  TIMESTAMP '2024-01-01' + INTERVAL (RANDOM() * 365 * 24) HOUR AS event_time,
  (RANDOM() * 100)::DOUBLE AS revenue
FROM GENERATE_SERIES(1, ${n*3}) t(i);

SELECT 'Generated ' || COUNT(*) || ' rows in ${e}_users' AS result FROM "${e}_users";`},summarize(A,s){const E=A.tableName||s.tableName||"table_name";return`-- Data profiling summary for: ${E}
SUMMARIZE "${E}";

-- Extended statistics
SELECT
  COUNT(*) AS total_rows,
  COUNT(DISTINCT *) AS distinct_rows,
  COUNT(*) * 1.0 / NULLIF(COUNT(DISTINCT <key_column>), 0) AS avg_rows_per_key
FROM "${E}";

-- Column-level statistics
SELECT
  'column_name' AS column_name,
  COUNT(*) AS total_count,
  COUNT(column_name) AS non_null_count,
  COUNT(*) - COUNT(column_name) AS null_count,
  ROUND(100.0 * (COUNT(*) - COUNT(column_name)) / COUNT(*), 2) AS null_percentage,
  COUNT(DISTINCT column_name) AS distinct_count
FROM "${E}";`},sampleQuery(A,s){const{tableName:E,sampleMethod:a,sampleSize:r,columns:e}=A,n=E||s.tableName||"table_name",o=e||"*",t=r||"10%",i=a||"BERNOULLI",S={BERNOULLI:`USING SAMPLE ${t} (BERNOULLI)`,RESERVOIR:`USING SAMPLE ${t} (RESERVOIR)`,SYSTEM:`USING SAMPLE ${t} (SYSTEM)`,FIRST:`USING SAMPLE ${t} ROWS`},l=S[i]||S.BERNOULLI;return`-- Sample query on: ${n}
SELECT ${o}
FROM "${n}"
${l};`}};export{T as optimizationGenerators,c as transformationGenerators,u as utilityGenerators};
