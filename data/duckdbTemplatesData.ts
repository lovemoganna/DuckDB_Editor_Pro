/**
 * duckdbTemplatesData — Comprehensive 12-Category MECE DuckDB Quick SQL Templates
 * Sourced directly from MECE 3.4 duckdb_notes.md
 */

export type TemplateCategoryKey = 
  | 'duckdb_features'
  | 'basic_query'
  | 'filtering'
  | 'string_date'
  | 'aggregation'
  | 'window'
  | 'join'
  | 'set_operations'
  | 'file_io'
  | 'data_export'
  | 'ddl_dml'
  | 'metadata';

export interface DuckDbQuickTemplate {
  id: string;
  title: string;
  category: TemplateCategoryKey;
  categoryLabel: string;
  purpose: string;            // 解决什么问题
  keyParameters: string[];    // 可替换参数
  sqlExample: string;         // SQL 示例
  tags: string[];
  notesRef?: string;
  isSystem?: boolean;
  createdAt?: number;
}

export const QUICK_TEMPLATE_CATEGORIES: { key: TemplateCategoryKey; label: string; icon: string }[] = [
  { key: 'duckdb_features', label: 'DuckDB 2026 WASM 原生黑科技', icon: '🐉' },
  { key: 'basic_query', label: '基础查询', icon: '🔍' },
  { key: 'filtering', label: '条件过滤', icon: '🎯' },
  { key: 'string_date', label: '字符串与日期处理', icon: '📅' },
  { key: 'aggregation', label: '聚合统计', icon: '📊' },
  { key: 'window', label: '窗口分析', icon: '🪟' },
  { key: 'join', label: 'JOIN 关联', icon: '🔗' },
  { key: 'set_operations', label: '多表与集合操作', icon: '🔀' },
  { key: 'file_io', label: 'CSV/JSON/Parquet 读取', icon: '📁' },
  { key: 'data_export', label: '数据导出', icon: '📤' },
  { key: 'ddl_dml', label: '建表与数据修改', icon: '📐' },
  { key: 'metadata', label: '元数据查询', icon: '⚙️' },
];

export const QUICK_SQL_TEMPLATES: DuckDbQuickTemplate[] = [
  // 0. 🐉 DuckDB 2026 WASM 原生黑科技
  {
    id: 'df_read_parquet_http',
    title: 'HTTP Parquet 免全量下载 Range 极速流式查询',
    category: 'duckdb_features',
    categoryLabel: '🐉 DuckDB 2026 WASM 原生黑科技',
    purpose: '利用 DuckDB 引擎 HTTP Range 分片加载，零延迟检索远端 GB 级 Parquet 文件。',
    keyParameters: ['HTTP Parquet URL'],
    sqlExample: `SELECT * 
FROM read_parquet('https://raw.githubusercontent.com/duckdb/duckdb/main/data/parquet-testing/arrow/alltypes_plain.parquet')
LIMIT 20;`,
    tags: ['read_parquet', 'WASM Stream', 'HTTP Range'],
    notesRef: '#204-wasm',
  },
  {
    id: 'df_pivot_on',
    title: 'PIVOT ... ON 动态列透视交叉分析表',
    category: 'duckdb_features',
    categoryLabel: '🐉 DuckDB 2026 WASM 原生黑科技',
    purpose: '一行语法替代繁琐的 CASE WHEN 交叉表拼接，支持自动列扩展。',
    keyParameters: ['{table_name}', '{column_name}'],
    sqlExample: `WITH raw_data AS (
    SELECT 
        COALESCE("{column_name}"::VARCHAR, 'Category') AS item_cat,
        10.5 AS score
    FROM "{table_name}"
    LIMIT 50
)
PIVOT raw_data
ON item_cat
USING SUM(score);`,
    tags: ['PIVOT', '透视表', '交叉表'],
    notesRef: '#301-sql',
  },
  {
    id: 'df_unnest_struct',
    title: 'UNNEST 嵌套 List 与 Struct 字段展开解构',
    category: 'duckdb_features',
    categoryLabel: '🐉 DuckDB 2026 WASM 原生黑科技',
    purpose: '原生拆解 JSON/Map/Array 嵌套结构为平铺行流数据。',
    keyParameters: ['LIST/STRUCT 字段'],
    sqlExample: `SELECT UNNEST(['Apple', 'Banana', 'Orange']) AS fruit_name, UNNEST([10, 20, 30]) AS qty;`,
    tags: ['UNNEST', 'List/Struct', '嵌套展开'],
    notesRef: '#101-semantic',
  },
  {
    id: 'df_explain_analyze',
    title: 'EXPLAIN ANALYZE 物理执行计划与算子耗时剖析',
    category: 'duckdb_features',
    categoryLabel: '🐉 DuckDB 2026 WASM 原生黑科技',
    purpose: '输出内存算子执行树、扫描成本与 HashJoin 耗时，帮助诊断 SQL 性能瓶颈。',
    keyParameters: ['目标 SQL 语句'],
    sqlExample: `EXPLAIN ANALYZE 
SELECT COUNT(*) AS total_rows, COUNT("{column_name}") AS valid_cnt
FROM "{table_name}";`,
    tags: ['EXPLAIN ANALYZE', '性能剖析', 'WASM Profile'],
    notesRef: '#301-sql',
  },
  {
    id: 'df_create_macro',
    title: 'CREATE MACRO 一键定义 DuckDB 自定义重用宏函数',
    category: 'duckdb_features',
    categoryLabel: '🐉 DuckDB 2026 WASM 原生黑科技',
    purpose: '将复杂逻辑封装为 SQL 宏，像原生内建函数一样直接调用。',
    keyParameters: ['宏名称', '参数列表'],
    sqlExample: `CREATE OR REPLACE MACRO calc_discounted_price(price, ratio) AS price * (1.0 - ratio);

-- 测试调用宏函数
SELECT calc_discounted_price(100, 0.15) AS final_price;`,
    tags: ['CREATE MACRO', '宏函数', '逻辑封装'],
    notesRef: '#304-macro',
  },
  {
    id: 'df_array_vector_cosine',
    title: 'array_cosine_similarity 向量相似度余弦计算',
    category: 'duckdb_features',
    categoryLabel: '🐉 DuckDB 2026 WASM 原生黑科技',
    purpose: '用于 AI Embedding 向量相似度快速比对检索。',
    keyParameters: ['VECTOR[3]'],
    sqlExample: `SELECT array_cosine_similarity([1.0, 2.0, 3.0]::FLOAT[3], [1.2, 1.9, 3.1]::FLOAT[3]) AS similarity_score;`,
    tags: ['AI 向量检索', 'Cosine Similarity', 'Embedding'],
    notesRef: '#205-ai',
  },
  {
    id: 'df_spatial_st_point',
    title: 'ST_Point & ST_Distance 地理空间经纬度距离计算',
    category: 'duckdb_features',
    categoryLabel: '🐉 DuckDB 2026 WASM 原生黑科技',
    purpose: '利用地理空间函数快速计算坐标间的空间距离。',
    keyParameters: ['经度', '纬度'],
    sqlExample: `SELECT sqrt(power(121.4737 - 116.4074, 2) + power(31.2304 - 39.9042, 2)) AS distance_degrees;`,
    tags: ['Spatial', 'ST_Point', 'GIS'],
    notesRef: '#206-spatial',
  },

  // 1. 🔍 基础查询
  {
    id: 'bq_select_calc',
    title: 'SELECT 无表计算与版本自检',
    category: 'basic_query',
    categoryLabel: '🔍 基础查询',
    purpose: '无需指定 FROM 表，直接进行数学计算或验证当前 DuckDB 引擎版本号。',
    keyParameters: ['计算表达式', '列别名'],
    sqlExample: `SELECT 100 - 1 AS calc_result, version() AS db_version;`,
    tags: ['SELECT', 'version', '无表计算'],
    notesRef: '#1.1 & 1.1.B',
  },
  {
    id: 'bq_values_range',
    title: 'VALUES 常量表 & range 序列生成',
    category: 'basic_query',
    categoryLabel: '🔍 基础查询',
    purpose: '免建表构造临时多行数据，或自动生成指定步长的连续正整数序列流。',
    keyParameters: ['range(start, stop, step)', 'VALUES (row1), (row2)'],
    sqlExample: `-- 1. 生成 1 到 10 连续序列
SELECT * FROM range(1, 11) AS t(id);

-- 2. 直接构造多行常量数据
VALUES ('张三', 25), ('李四', 30);`,
    tags: ['VALUES', 'range', '序列'],
    notesRef: '#1.2 & 1.2.B',
  },
  {
    id: 'bq_cte',
    title: 'WITH CTE 别名与命名虚拟表',
    category: 'basic_query',
    categoryLabel: '🔍 基础查询',
    purpose: '使用 WITH 语句声明逻辑中转虚拟表，将复杂的嵌套查询模块化。',
    keyParameters: ['虚拟表名', '字段列表'],
    sqlExample: `WITH cte_sample AS (
    SELECT 101 AS id, '张三' AS username, 'Active' AS status
)
SELECT * FROM cte_sample;`,
    tags: ['WITH', 'CTE', '虚拟表'],
    notesRef: '#1.3',
  },
  {
    id: 'bq_recursive_cte',
    title: 'WITH RECURSIVE 递归阶梯树状结构生成',
    category: 'basic_query',
    categoryLabel: '🔍 基础查询',
    purpose: '递归展开层级树状关系或生成步进数据流。',
    keyParameters: ['RECURSIVE CTE'],
    sqlExample: `WITH RECURSIVE cnt(x) AS (
    SELECT 1
    UNION ALL
    SELECT x + 1 FROM cnt WHERE x < 10
)
SELECT * FROM cnt;`,
    tags: ['RECURSIVE', 'CTE', '树形层级'],
    notesRef: '#1.4',
  },

  // 2. 🎯 条件过滤
  {
    id: 'fl_where_in_between',
    title: 'WHERE 范围 (BETWEEN) 与集合 (IN) 过滤',
    category: 'filtering',
    categoryLabel: '🎯 条件过滤',
    purpose: '精准限定数据筛选区间，或按枚举范围过滤记录。',
    keyParameters: ['{column_name}', 'BETWEEN min AND max', 'IN (val1, val2)'],
    sqlExample: `SELECT * 
FROM "{table_name}"
WHERE "{column_name}" IS NOT NULL
LIMIT 50;`,
    tags: ['WHERE', 'BETWEEN', 'IN'],
    notesRef: '#2.1',
  },
  {
    id: 'fl_ilike_case_decode',
    title: 'ILIKE 大小写不敏感与 DECODE 值映射',
    category: 'filtering',
    categoryLabel: '🎯 条件过滤',
    purpose: '忽略英文字母大小写进行模糊搜索，或利用 DECODE / CASE WHEN 快速转译状态码。',
    keyParameters: ['ILIKE pattern', 'DECODE(col, k1, v1, default)'],
    sqlExample: `SELECT 
    "{column_name}",
    CASE WHEN TRY_CAST("{column_name}" AS DOUBLE) >= 60 THEN 'High' ELSE 'Normal' END AS eval_level
FROM "{table_name}"
LIMIT 50;`,
    tags: ['ILIKE', 'CASE WHEN', 'DECODE'],
    notesRef: '#2.1.B & 2.2',
  },
  {
    id: 'fl_coalesce_nullif',
    title: 'COALESCE & IFNULL 空值安全兜底',
    category: 'filtering',
    categoryLabel: '🎯 条件过滤',
    purpose: '检查多个备用字段，按顺序返回第一个非 NULL 值，防止数据脏空值。',
    keyParameters: ['COALESCE(col1, col2, default)', 'IFNULL(col, default)'],
    sqlExample: `SELECT 
    IFNULL("{column_name}"::VARCHAR, '未填充') AS safe_val,
    COALESCE("{column_name}"::VARCHAR, '默认空值') AS clean_text
FROM "{table_name}"
LIMIT 50;`,
    tags: ['COALESCE', 'IFNULL', 'NULLIF'],
    notesRef: '#2.3',
  },
  {
    id: 'fl_regexp_matches',
    title: 'REGEXP_MATCHES 正则表达搜索与规则校验',
    category: 'filtering',
    categoryLabel: '🎯 条件过滤',
    purpose: '使用正则表达式校验字段格式（如手机号、邮箱、纯数字）。',
    keyParameters: ['REGEXP_MATCHES(col, pattern)'],
    sqlExample: `SELECT 
    "{column_name}",
    regexp_matches("{column_name}"::VARCHAR, '^[A-Za-z0-9]+$') AS is_alphanumeric
FROM "{table_name}"
LIMIT 50;`,
    tags: ['REGEXP_MATCHES', '正则', '格式校验'],
    notesRef: '#2.4',
  },

  // 3. 📅 字符串与日期处理
  {
    id: 'sd_str_concat_replace',
    title: '字符串双竖线拼接与 REGEXP_REPLACE 脱敏',
    category: 'string_date',
    categoryLabel: '📅 字符串与日期处理',
    purpose: '使用 SQL 标准 || 进行文本高效拼接，或利用正则对敏感字段批量脱敏。',
    keyParameters: ['str1 || str2', "regexp_replace(col, '\\d+', '****')"],
    sqlExample: `SELECT 
    '记录: ' || "{column_name}"::VARCHAR AS item_title,
    regexp_replace("{column_name}"::VARCHAR, '\\d+', '****') AS masked_str
FROM "{table_name}"
LIMIT 50;`,
    tags: ['||', 'REGEXP_REPLACE', '字符串'],
    notesRef: '#3.1.B & 3.2.C',
  },
  {
    id: 'sd_substring_negative',
    title: 'SUBSTRING 负数索引倒数截取与 SPLIT_PART',
    category: 'string_date',
    categoryLabel: '📅 字符串与日期处理',
    purpose: '无需计算总长度，直接利用 negative index 从字符串尾部倒数截取，或按分隔符拆分。',
    keyParameters: ['substring(col, -4)', 'split_part(col, delimiter, index)'],
    sqlExample: `SELECT 
    substring('report_2026.csv', -3) AS ext_name,
    substring('report_2026.csv', -8, 4) AS year_val,
    split_part('北京-上海-广州', '-', 2) AS city_extracted;`,
    tags: ['SUBSTRING', 'SPLIT_PART', '负数索引'],
    notesRef: '#3.2.B & 3.3',
  },
  {
    id: 'sd_date_trunc_interval',
    title: 'date_trunc 时间截断与 INTERVAL 时间加减',
    category: 'string_date',
    categoryLabel: '📅 字符串与日期处理',
    purpose: '将时间戳截断为按小时/按天粒度，或进行 INTERVAL 多级加减与月底 DATE 计算。',
    keyParameters: ["date_trunc('hour', ts)", "ts + INTERVAL '3 days'", "last_day(date)"],
    sqlExample: `SELECT 
    date_trunc('day', NOW()) AS today_start,
    NOW() + INTERVAL '7 days' AS next_week,
    last_day(CURRENT_DATE) AS month_end;`,
    tags: ['date_trunc', 'INTERVAL', 'last_day'],
    notesRef: '#3.5.B & 3.5.G',
  },
  {
    id: 'sd_timezone_convert',
    title: 'AT TIME ZONE 跨时区转换',
    category: 'string_date',
    categoryLabel: '📅 字符串与日期处理',
    purpose: '在 UTC 与 local 本地时区之间精准转换时间戳。',
    keyParameters: ["ts AT TIME ZONE 'UTC'", "ts AT TIME ZONE 'Asia/Shanghai'"],
    sqlExample: `SELECT 
    NOW() AT TIME ZONE 'UTC' AS utc_time,
    (NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Shanghai' AS local_time;`,
    tags: ['AT TIME ZONE', '时区'],
    notesRef: '#3.5.C',
  },
  {
    id: 'sd_date_diff_age',
    title: 'DATEDIFF 与 AGE 日期差值与年龄计算',
    category: 'string_date',
    categoryLabel: '📅 字符串与日期处理',
    purpose: '精确计算两个日期时间点之间相差的天数、小时数或年满年龄。',
    keyParameters: ["DATEDIFF('day', start, end)", "AGE(end, start)"],
    sqlExample: `SELECT 
    datediff('day', DATE '2026-01-01', CURRENT_DATE) AS days_elapsed,
    age(CURRENT_DATE, DATE '2000-01-01') AS age_interval;`,
    tags: ['DATEDIFF', 'AGE', '日期计算'],
    notesRef: '#3.5.D',
  },

  // 4. 📊 聚合统计
  {
    id: 'ag_group_by_all',
    title: 'GROUP BY ALL 自动全分组与 string_agg 拼接',
    category: 'aggregation',
    categoryLabel: '📊 聚合统计',
    purpose: '利用 DuckDB GROUP BY ALL 自动推导非聚合列，并用 string_agg 将组内字符串压平拼接。',
    keyParameters: ['SUM(col)', 'COUNT(*)', "string_agg(col, ', ')"],
    sqlExample: `SELECT 
    "{column_name}",
    COUNT(*) AS total_cnt,
    string_agg("{column_name}"::VARCHAR, ', ') AS aggregated_items
FROM "{table_name}"
GROUP BY ALL
HAVING total_cnt >= 1;`,
    tags: ['GROUP BY ALL', 'string_agg', 'HAVING'],
    notesRef: '#4.1',
  },
  {
    id: 'ag_rollup_subtotal',
    title: 'ROLLUP 多维分组小计与全局 Sum 总计',
    category: 'aggregation',
    categoryLabel: '📊 聚合统计',
    purpose: '在一句 SQL 内同时计算明细、分类小计与全局 Sum 总计。',
    keyParameters: ['ROLLUP(dim_a, dim_b)', 'SUM(measure)'],
    sqlExample: `SELECT 
    "{column_name}",
    COUNT(*) AS row_cnt
FROM "{table_name}"
GROUP BY ROLLUP ("{column_name}")
ORDER BY "{column_name}" NULLS LAST;`,
    tags: ['ROLLUP', '小计', '总计'],
    notesRef: '#4.1.B',
  },
  {
    id: 'ag_filter_inline',
    title: 'FILTER 内联聚合专属条件过滤',
    category: 'aggregation',
    categoryLabel: '📊 聚合统计',
    purpose: '为同一句 SELECT 内不同的聚合函数指定各自独立的 WHERE 过滤条件。',
    keyParameters: ['COUNT(*) FILTER (WHERE ...)', 'SUM(col) FILTER (WHERE ...)'],
    sqlExample: `SELECT 
    COUNT(*) AS total_count,
    COUNT(*) FILTER (WHERE "{column_name}" IS NOT NULL) AS valid_count
FROM "{table_name}";`,
    tags: ['FILTER', '条件聚合'],
    notesRef: '#4.1.C',
  },
  {
    id: 'ag_grouping_sets_cube',
    title: 'GROUPING SETS & CUBE 全维度交叉组合汇总',
    category: 'aggregation',
    categoryLabel: '📊 聚合统计',
    purpose: '自动展开多维度笛卡尔积组合，生成小计与交叉分析矩阵。',
    keyParameters: ['CUBE (dim1, dim2)', 'GROUPING SETS'],
    sqlExample: `WITH sample_sales AS (
    SELECT 'East' AS region, 'Electronics' AS category, 100 AS sales
    UNION ALL SELECT 'East', 'Clothing', 150
    UNION ALL SELECT 'West', 'Electronics', 200
)
SELECT region, category, SUM(sales) AS total_sales
FROM sample_sales
GROUP BY CUBE (region, category);`,
    tags: ['CUBE', 'GROUPING SETS', '多维汇总'],
    notesRef: '#4.1.D',
  },
  {
    id: 'ag_quantile_median',
    title: 'quantile_cont 分位数与 median 中位数计算',
    category: 'aggregation',
    categoryLabel: '📊 聚合统计',
    purpose: '计算连续分布的中位数、25%/75% 四分位数，防止极值拉偏均值。',
    keyParameters: ['median(col)', 'quantile_cont(col, [0.25, 0.75])'],
    sqlExample: `SELECT 
    median(TRY_CAST("{column_name}" AS DOUBLE)) AS median_val,
    quantile_cont(TRY_CAST("{column_name}" AS DOUBLE), [0.25, 0.5, 0.75]) AS quartiles
FROM "{table_name}";`,
    tags: ['median', 'quantile', '中位数', '四分位数'],
    notesRef: '#4.2',
  },

  // 5. 🪟 窗口分析
  {
    id: 'wn_running_sum_rank',
    title: 'OVER () 运行中累计求和与 DENSE_RANK 密集排名',
    category: 'window',
    categoryLabel: '🪟 窗口分析',
    purpose: '保留明细行的同时计算动态累计 Sum 以及不跳名次的密集排名。',
    keyParameters: ['SUM(col) OVER (ORDER BY ...)', 'DENSE_RANK() OVER (...)', 'NTILE(4) OVER (...)'],
    sqlExample: `SELECT 
    "{column_name}",
    DENSE_RANK() OVER (ORDER BY "{column_name}" DESC) AS rank_num,
    NTILE(4) OVER (ORDER BY "{column_name}" DESC) AS quartile
FROM "{table_name}"
LIMIT 50;`,
    tags: ['OVER', '累计求和', 'DENSE_RANK', 'NTILE'],
    notesRef: '#4.3',
  },
  {
    id: 'wn_lag_lead_shift',
    title: 'LAG & LEAD 窗口前后行错位对比分析',
    category: 'window',
    categoryLabel: '🪟 窗口分析',
    purpose: '免子查询对比当前行与上一行/下一行的数据环比或差值。',
    keyParameters: ['LAG(col, offset)', 'LEAD(col, offset)'],
    sqlExample: `WITH time_series AS (
    SELECT range AS day_num, range * 15.5 AS val FROM range(1, 10)
)
SELECT 
    day_num,
    val,
    LAG(val, 1) OVER (ORDER BY day_num) AS prev_val,
    LEAD(val, 1) OVER (ORDER BY day_num) AS next_val,
    val - LAG(val, 1) OVER (ORDER BY day_num) AS diff_val
FROM time_series;`,
    tags: ['LAG', 'LEAD', '环比分析', '错位对比'],
    notesRef: '#4.4',
  },
  {
    id: 'wn_qualify_window_filter',
    title: 'QUALIFY 窗口计算结果直接过滤 (免写嵌套子查询)',
    category: 'window',
    categoryLabel: '🪟 窗口分析',
    purpose: '在 SQL 末尾直接对 ROW_NUMBER() 或窗口聚合结果进行 WHERE 级别的二次筛选。',
    keyParameters: ['QUALIFY ROW_NUMBER() OVER (...) <= N'],
    sqlExample: `SELECT 
    "{column_name}",
    ROW_NUMBER() OVER (ORDER BY "{column_name}" DESC) AS row_num
FROM "{table_name}"
QUALIFY row_num <= 5;`,
    tags: ['QUALIFY', '窗口过滤', 'Top-N'],
    notesRef: '#4.5',
  },

  // 6. 🔗 JOIN 关联
  {
    id: 'jn_left_inner_using',
    title: 'LEFT JOIN 与 USING (关联列) 投影合并',
    category: 'join',
    categoryLabel: '🔗 JOIN 关联',
    purpose: '经典多表关联，并利用 USING (col) 自动合并同名关联列投影。',
    keyParameters: ['t1 LEFT JOIN t2 ON t1.id = t2.id', 'USING (id)'],
    sqlExample: `SELECT t1.*
FROM "{table_name}" t1
LEFT JOIN "{table_name}" t2 ON t1.rowid = t2.rowid
LIMIT 50;`,
    tags: ['LEFT JOIN', 'USING'],
    notesRef: '#6.1 & 6.1.C',
  },
  {
    id: 'jn_semi_anti',
    title: 'SEMI JOIN (半连接) 与 ANTI JOIN (反连接)',
    category: 'join',
    categoryLabel: '🔗 JOIN 关联',
    purpose: '无需子查询，直接高效获取在右表中存在 (SEMI) 或不存在 (ANTI) 的左表记录。',
    sqlExample: `SELECT * FROM "{table_name}" t1
SEMI JOIN "{table_name}" t2 ON t1.rowid = t2.rowid;`,
    keyParameters: ['t1 SEMI JOIN t2 ON ...', 't1 ANTI JOIN t2 ON ...'],
    tags: ['SEMI JOIN', 'ANTI JOIN'],
    notesRef: '#6.1.D',
  },
  {
    id: 'jn_asof_temporal',
    title: 'ASOF JOIN 时序最近对齐关联',
    category: 'join',
    categoryLabel: '🔗 JOIN 关联',
    purpose: '基于时间戳自动匹配离当前记录最近的上一条关联记录。',
    keyParameters: ['ASOF JOIN ON t1.ts >= t2.ts'],
    sqlExample: `WITH t1 AS (
    SELECT range AS id, NOW() + (range || ' seconds')::INTERVAL AS ts, range * 10.0 AS price FROM range(1, 10)
),
t2 AS (
    SELECT range AS id, NOW() + (range || ' seconds')::INTERVAL AS ts, range * 9.5 AS bid FROM range(1, 10)
)
SELECT t1.ts, t1.price, t2.bid
FROM t1 ASOF JOIN t2 ON t1.id = t2.id AND t1.ts >= t2.ts;`,
    tags: ['ASOF JOIN', '时序对齐'],
    notesRef: '#6.2',
  },
  {
    id: 'jn_positional_join',
    title: 'POSITIONAL JOIN 行物理位置无 Key 对齐拼接',
    category: 'join',
    categoryLabel: '🔗 JOIN 关联',
    purpose: '无需指定 ON 关联条件，直接按两表的物理行号顺序一比对齐拼接。',
    keyParameters: ['POSITIONAL JOIN'],
    sqlExample: `WITH names AS (SELECT UNNEST(['Alice', 'Bob', 'Charlie']) AS name),
scores AS (SELECT UNNEST([95, 88, 92]) AS score)
SELECT names.name, scores.score
FROM names POSITIONAL JOIN scores;`,
    tags: ['POSITIONAL JOIN', '行按序对齐'],
    notesRef: '#6.3',
  },

  // 7. 🔀 多表与集合操作
  {
    id: 'so_union_by_name',
    title: 'UNION BY NAME 异构按名称自动对齐并集',
    category: 'set_operations',
    categoryLabel: '🔀 多表与集合操作',
    purpose: '合并列顺序或列数量不一致的两个数据集，按字段名称自动匹配并集。',
    keyParameters: ['SELECT ... UNION BY NAME SELECT ...'],
    sqlExample: `SELECT "{column_name}"::VARCHAR AS item_val FROM "{table_name}"
UNION BY NAME
SELECT 'Sample_Extra' AS item_val;`,
    tags: ['UNION BY NAME', '集合操作'],
    notesRef: '#6.4',
  },
  {
    id: 'so_exists_subquery',
    title: 'EXISTS 关联子查询存在性判定',
    category: 'set_operations',
    categoryLabel: '🔀 多表与集合操作',
    purpose: '使用 WHERE EXISTS 判定相关联记录是否存在。',
    keyParameters: ['WHERE EXISTS (SELECT 1 FROM ...)'],
    sqlExample: `SELECT * 
FROM "{table_name}" t1
WHERE EXISTS (
    SELECT 1 FROM "{table_name}" t2 WHERE t1.rowid = t2.rowid
);`,
    tags: ['EXISTS', '子查询'],
    notesRef: '#6.3',
  },
  {
    id: 'so_intersect_except',
    title: 'INTERSECT 交集与 EXCEPT 差集集合比对',
    category: 'set_operations',
    categoryLabel: '🔀 多表与集合操作',
    purpose: '快速找出两个查询结果集中重复相交的元素 (INTERSECT) 或仅在单侧存在的元素 (EXCEPT)。',
    keyParameters: ['INTERSECT', 'EXCEPT'],
    sqlExample: `WITH list_a AS (SELECT UNNEST([1, 2, 3, 4]) AS num),
list_b AS (SELECT UNNEST([3, 4, 5, 6]) AS num)
SELECT num FROM list_a INTERSECT SELECT num FROM list_b;`,
    tags: ['INTERSECT', 'EXCEPT', '交集', '差集'],
    notesRef: '#6.5',
  },

  // 8. 📁 CSV/JSON/Parquet 读取
  {
    id: 'io_read_parquet_csv',
    title: '免建表直接读取 Parquet / CSV 文件与 通配符',
    category: 'file_io',
    categoryLabel: '📁 CSV/JSON/Parquet 读取',
    purpose: '无需写 DDL 建表，直接在 FROM 后面接本地文件路径或 *.parquet 通配符进行检索。',
    keyParameters: ["FROM 'data.parquet'", "FROM 'test*.csv'"],
    sqlExample: `SELECT *
FROM read_parquet('https://raw.githubusercontent.com/duckdb/duckdb/main/data/parquet-testing/arrow/alltypes_plain.parquet')
LIMIT 10;`,
    tags: ['Parquet', 'CSV', '免建表读取', 'HTTP'],
    notesRef: '#7.1 & 7.1.B',
  },
  {
    id: 'io_exclude_replace_pivot',
    title: 'EXCLUDE / REPLACE 列裁剪与 PIVOT 行转列',
    category: 'file_io',
    categoryLabel: '📁 CSV/JSON/Parquet 读取',
    purpose: '在 SELECT * 中排除特定列或就地替换；或者一键进行 PIVOT 数据透视。',
    keyParameters: ['* EXCLUDE (col1) REPLACE (expr AS col2)', 'PIVOT ... ON col USING SUM(val)'],
    sqlExample: `SELECT * REPLACE (UPPER("{column_name}"::VARCHAR) AS "{column_name}")
FROM "{table_name}"
LIMIT 50;`,
    tags: ['EXCLUDE', 'REPLACE', 'PIVOT'],
    notesRef: '#7.3 & 7.4',
  },

  // 9. 📤 数据导出
  {
    id: 'ex_copy_to_file',
    title: 'COPY TO 导出为 CSV / Parquet 外部文件',
    category: 'data_export',
    categoryLabel: '📤 数据导出',
    purpose: '将任意 SELECT 查询结果一键导出保存为本地 CSV、JSON 或 Parquet 文件。',
    keyParameters: ["COPY (SELECT ...) TO 'output.csv' (HEADER)", "COPY (...) TO 'out.parquet' (FORMAT PARQUET)"],
    sqlExample: `SELECT * FROM "{table_name}" LIMIT 50;`,
    tags: ['COPY TO', 'CSV 导出', 'Parquet 导出'],
    notesRef: '#7.5',
  },
  {
    id: 'ex_copy_to_parquet_snappy',
    title: 'COPY TO Parquet SNAPPY 压缩选项导出',
    category: 'data_export',
    categoryLabel: '📤 数据导出',
    purpose: '指定 SNAPPY/ZSTD 列式高效压缩格式导出二进制 Parquet 文件。',
    keyParameters: ['FORMAT PARQUET', 'COMPRESSION SNAPPY'],
    sqlExample: `COPY (
    SELECT * FROM "{table_name}" LIMIT 100
) TO 'output_snappy.parquet' (FORMAT PARQUET, COMPRESSION SNAPPY);`,
    tags: ['COPY TO', 'Parquet', 'SNAPPY'],
    notesRef: '#7.6',
  },

  // 10. 📐 建表与数据修改 (DDL & DML)
  {
    id: 'dm_ctas_alter_table',
    title: 'CTAS 一键物化建表与 ALTER TABLE 结构在线演进',
    category: 'ddl_dml',
    categoryLabel: '📐 建表与数据修改',
    purpose: '基于查询结果一键建表物化备份，或使用 ALTER TABLE 在线新增/修改列类型。',
    keyParameters: ['CREATE TABLE t AS SELECT ...', 'ALTER TABLE t ADD COLUMN ...', 'ALTER TABLE t ALTER COLUMN col TYPE ...'],
    sqlExample: `CREATE TEMP TABLE IF NOT EXISTS temp_backup_table AS 
SELECT * FROM "{table_name}" LIMIT 50;

SELECT * FROM temp_backup_table LIMIT 10;`,
    tags: ['CTAS', 'ALTER TABLE', 'DDL'],
    notesRef: '#8.1.C & 8.1.E',
  },
  {
    id: 'dm_upsert_on_conflict',
    title: 'INSERT ON CONFLICT 冲突合并更新 (UPSERT)',
    category: 'ddl_dml',
    categoryLabel: '📐 建表与数据修改',
    purpose: '向表中插入记录时，若主键冲突则自动转换为 UPDATE 累加或更新。',
    keyParameters: ['INSERT INTO table VALUES (...) ON CONFLICT (pk) DO UPDATE SET ...'],
    sqlExample: `CREATE TEMP TABLE IF NOT EXISTS temp_kv (id INT PRIMARY KEY, val VARCHAR);
INSERT INTO temp_kv VALUES (1, 'Initial_Value') ON CONFLICT (id) DO UPDATE SET val = excluded.val;

SELECT * FROM temp_kv;`,
    tags: ['UPSERT', 'ON CONFLICT', 'DML'],
    notesRef: '#8.1.B',
  },

  // 11. ⚙️ 元数据查询
  {
    id: 'md_show_tables_describe',
    title: 'SHOW TABLES 库表一览与 duckdb_columns 元数据字典',
    category: 'metadata',
    categoryLabel: '⚙️ 元数据查询',
    purpose: '查询当前会话中的数据表清单、物理列信息与扩展插件自检。',
    keyParameters: ['SHOW TABLES', 'DESCRIBE table', 'SELECT * FROM duckdb_columns'],
    sqlExample: `SHOW TABLES;`,
    tags: ['SHOW TABLES', 'DESCRIBE', 'duckdb_columns', '元数据'],
    notesRef: '#8.2',
  },
  {
    id: 'md_duckdb_settings',
    title: 'duckdb_settings 系统配置与内存线程字典',
    category: 'metadata',
    categoryLabel: '⚙️ 元数据查询',
    purpose: '查询与监控引擎内存配额、Worker 线程数等系统级 Runtime 参数配置。',
    keyParameters: ['duckdb_settings()'],
    sqlExample: `SELECT name, value, description 
FROM duckdb_settings()
WHERE name LIKE '%memory%' OR name LIKE '%threads%'
LIMIT 20;`,
    tags: ['duckdb_settings', '系统配置', '内存瓶颈'],
    notesRef: '#8.3',
  },
  {
    id: 'md_duckdb_extensions',
    title: 'duckdb_extensions WASM 扩展插件自检',
    category: 'metadata',
    categoryLabel: '⚙️ 元数据查询',
    purpose: '列出当前 DuckDB 环境中已安装与加载的 Extension 插件清单（如 spatial, fts, parquet）。',
    keyParameters: ['duckdb_extensions()'],
    sqlExample: `SELECT extension_name, loaded, installed, description
FROM duckdb_extensions()
LIMIT 20;`,
    tags: ['duckdb_extensions', '插件清单', 'WASM'],
    notesRef: '#8.4',
  },
];
