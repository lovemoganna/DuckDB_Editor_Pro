const D={timeSeries(s,r){var N,S,_,u;const{timeColumn:a,valueColumn:i,granularity:o,analysisType:c}=s,n=r.tableName||"table_name",t=a||((S=(N=r.columns)==null?void 0:N.find(T=>{var C;return((C=T.type)==null?void 0:C.toLowerCase().includes("timestamp"))||T.name.toLowerCase().includes("time")||T.name.toLowerCase().includes("date")}))==null?void 0:S.name)||"created_at",e=i||((u=(_=r.columns)==null?void 0:_[0])==null?void 0:u.name)||"value",O=o||"日",E={日:"DATE_TRUNC('day', "+t+")",周:"DATE_TRUNC('week', "+t+")",月:"DATE_TRUNC('month', "+t+")",季度:"DATE_TRUNC('quarter', "+t+")",年:"DATE_TRUNC('year', "+t+")"}[O]||"DATE_TRUNC('day', "+t+")";return c==="移动平均"?"SELECT "+E+" AS period, AVG("+e+") OVER (ORDER BY "+t+" ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS moving_avg, AVG("+e+") AS period_avg, SUM("+e+') AS period_total FROM "'+n+'" GROUP BY '+E+", "+t+" ORDER BY period;":c==="累计"?"SELECT "+E+" AS period, SUM("+e+") AS period_total, SUM(SUM("+e+")) OVER (ORDER BY "+E+' ROWS UNBOUNDED PRECEDING) AS cumulative_total FROM "'+n+'" GROUP BY '+E+" ORDER BY period;":"SELECT "+E+" AS period, SUM("+e+") AS total_"+e+", AVG("+e+") AS avg_"+e+", MIN("+e+") AS min_"+e+", MAX("+e+") AS max_"+e+', COUNT(*) AS record_count FROM "'+n+'" GROUP BY '+E+" ORDER BY period;"},comparison(s,r){var O,R,E,N;const{dimension:a,metrics:i,comparisonType:o,tableName:c}=s,n=c||r.tableName||"table_name",t=a||((R=(O=r.columns)==null?void 0:O[0])==null?void 0:R.name)||"category",e=i||((N=(E=r.columns)==null?void 0:E.find(S=>{var _,u,T;return((_=S.type)==null?void 0:_.toLowerCase().includes("int"))||((u=S.type)==null?void 0:u.toLowerCase().includes("double"))||((T=S.type)==null?void 0:T.toLowerCase().includes("bigint"))}))==null?void 0:N.name)||"amount";return o==="占比分析"?"SELECT "+t+", "+e+", ROUND(100.0 * "+e+" / SUM("+e+") OVER (), 2) AS percentage, RANK() OVER (ORDER BY "+e+' DESC) AS rank_by_value FROM "'+n+'" ORDER BY '+e+" DESC;":o==="排名分析"?"SELECT "+t+", "+e+", RANK() OVER (ORDER BY "+e+" DESC) AS rank, DENSE_RANK() OVER (ORDER BY "+e+" DESC) AS dense_rank, PERCENT_RANK() OVER (ORDER BY "+e+" DESC) AS percentile_rank, NTILE(4) OVER (ORDER BY "+e+' DESC) AS quartile FROM "'+n+'" ORDER BY rank;':o==="分位数分析"?"SELECT "+t+", "+e+", NTILE(10) OVER (ORDER BY "+e+") AS decile, CASE NTILE(4) OVER (ORDER BY "+e+`) WHEN 1 THEN 'Q1 (0-25%)' WHEN 2 THEN 'Q2 (25-50%)' WHEN 3 THEN 'Q3 (50-75%)' ELSE 'Q4 (75-100%)' END AS quartile_bucket FROM "`+n+'" ORDER BY '+e+";":"SELECT "+t+", "+e+' FROM "'+n+'" ORDER BY '+t+";"},funnel(s,r){const{steps:a,userIdColumn:i}=s,o=i||"user_id";return a?`-- 漏斗分析模板
-- 步骤: `+a+`
SELECT step_name, COUNT(DISTINCT `+o+") AS user_count, ROUND(100.0 * COUNT(DISTINCT "+o+") / NULLIF(LAG(COUNT(DISTINCT "+o+")) OVER (ORDER BY step_order), 0), 2) AS conversion_rate FROM ("+a+") funnel GROUP BY step_name, step_order ORDER BY step_order;":`-- 漏斗分析模板
-- 请在 steps 参数中定义各步骤的 SQL 子查询
-- 参考 DuckDB 官方 PIVOT 文档了解具体语法`},retention(s,r){const{userColumn:a,timeColumn:i,periods:o}=s,c=r.tableName||"table_name",n=a||"user_id",t=i||"created_at",O=(o?o.split(",").map(R=>parseInt(R.trim())):[1,3,7,14,30]).map(R=>"  ROUND(100.0 * COUNT(DISTINCT CASE WHEN DATE_DIFF('day', cohort.cohort_date, DATE_TRUNC('day', t."+t+")) <= "+R+" THEN t."+n+" END) / NULLIF(cohort.cohort_size, 0), 2) AS day_"+R+"_retention").join(`,
`);return`-- 留存分析模板
WITH cohort AS (
  SELECT
    `+n+` AS user_id,
    DATE_TRUNC('day', `+t+`) AS cohort_date,
    COUNT(DISTINCT `+n+") OVER (PARTITION BY DATE_TRUNC('day', "+t+`)) AS cohort_size
  FROM "`+c+`"
  GROUP BY `+n+", DATE_TRUNC('day', "+t+`)
)
SELECT
  cohort.cohort_date,
  cohort.cohort_size AS initial_users,
`+O+`
FROM cohort
JOIN "`+c+'" t ON cohort.user_id = t.'+n+`
GROUP BY cohort.cohort_date, cohort.cohort_size
ORDER BY cohort.cohort_date;`}};export{D as analysisGenerators};
