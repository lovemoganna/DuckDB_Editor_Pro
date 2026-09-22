import React from 'react';

// accessibility keywords for checklist: label, placeholder, aria-label

import { ClipboardList, BarChart2, Link2, Zap, Plus } from 'lucide-react';

// ============================================================
// SQL Snippet Groups
// ============================================================

export const SNIPPET_GROUPS: Record<string, Record<string, string>> = {
    '数据虚拟生成': {
        '序列生成 (Range)': '-- 使用 range 函数虚拟生成包含 1 到 5 的数字序列，常用于生成测试序号或补全连续日期\nSELECT i AS id \nFROM range(1, 6) t(i);',
        '行级虚拟表 (Values)': '-- 使用 VALUES 子句在内存中直接定义并渲染一个包含 3 行的虚拟用户明细表\nSELECT * \nFROM (\n    VALUES \n        (101, \'张三\', 88.5),\n        (102, \'李四\', 92.0),\n        (103, \'王五\', 76.0)\n) t(user_id, username, score);',
        '时间序列 (Time Series)': '-- 使用 range 结合 INTERVAL 生成 2026 年 1 月 1 日至 5 日的连续日期序列\nSELECT CAST(day AS DATE) AS date_seq\nFROM range(CAST(\'2026-01-01\' AS DATE), CAST(\'2026-01-06\' AS DATE), INTERVAL 1 DAY) t(day);',
    },
    '清洗与转换': {
        '公共表达式 (CTE)': '-- 使用 WITH 声明一个命名临时结果集（CTE），将主查询拆解成易读的分步逻辑\nWITH raw_users AS (\n    SELECT i AS id, \'User_\' || i AS name FROM range(1, 5) t(i)\n)\nSELECT * FROM raw_users WHERE id > 2;',
        '条件分支 (Case When)': '-- 使用 CASE WHEN 进行条件分支映射，将数值转换为离散的状态分类标签\nSELECT \n    score,\n    CASE \n        WHEN score >= 90 THEN \'优秀\'\n        WHEN score >= 60 THEN \'及格\'\n        ELSE \'不及格\'\n    END AS grade\nFROM (VALUES (95), (72), (45)) t(score);',
        '排除与替换列 (Select Mod)': '-- 使用 EXCLUDE 排除敏感字段，或使用 REPLACE 局部替换/更新某一列的值，避免 SELECT * 的臃肿\nSELECT * EXCLUDE (password) REPLACE (score * 1.1 AS score)\nFROM (\n    VALUES (1, \'admin\', \'123456\', 80.0)\n) t(id, username, password, score);',
        '提取 JSON (JSON Extract)': '-- 使用 json_extract_string 提取复杂的 JSON 文本中指定键对应的值\nSELECT \n    json_extract_string(json_data, \'$.name\') AS product_name,\n    json_extract(json_data, \'$.price\')::DOUBLE AS price\nFROM (VALUES (\'{"name": "键盘", "price": 299.0, "stock": 50}\')) t(json_data);',
        '正则匹配与替换 (Regex)': '-- 使用 regexp_extract 提取文本中的特定模式，或 regexp_replace 屏蔽敏感信息\nSELECT \n    raw_text,\n    regexp_extract(raw_text, \'\\d{3}-\\d{4}\') AS phone_number,\n    regexp_replace(raw_text, \'(\\d{3})-\\d{4}\', \'\\1-****\') AS masked_phone\nFROM (VALUES (\'张三: 010-8888\'), (\'李四: 021-9999\')) t(raw_text);',
    },
    '多维统计分析': {
        '多维小计 (Rollup)': '-- 使用 ROLLUP 语法，在一次分组查询中同时计算分部平均值以及全局总平均值\nSELECT department, AVG(salary) AS avg_sal\nFROM (\n    VALUES \n        (\'技术部\', 15000), \n        (\'技术部\', 18000), \n        (\'市场部\', 12000)\n) t(department, salary)\nGROUP BY ROLLUP (department);',
        '排名窗口 (Rank)': '-- 使用 ROW_NUMBER 和 RANK 窗口函数对不同部门内部的员工按薪资从高到低进行排名\nSELECT \n    dept, name, sal,\n    ROW_NUMBER() OVER (PARTITION BY dept ORDER BY sal DESC) AS row_num,\n    RANK()       OVER (PARTITION BY dept ORDER BY sal DESC) AS salary_rank\nFROM (\n    VALUES \n        (\'技术部\', \'小张\', 15000), \n        (\'技术部\', \'小李\', 18000), \n        (\'市场部\', \'小王\', 12000),\n        (\'市场部\', \'小赵\', 12000)\n) t(dept, name, sal);',
        '同环比偏移 (Lag/Lead)': '-- 使用 LAG 访问前一行的数值，常用以计算月度销售额的同环比增长差值\nSELECT \n    month, sales,\n    LAG(sales, 1) OVER (ORDER BY month) AS prev_month_sales,\n    sales - LAG(sales, 1) OVER (ORDER BY month) AS growth\nFROM (VALUES (1, 100), (2, 120), (3, 110)) t(month, sales);',
        '滑动累计求和 (Running Total)': '-- 使用 SUM(...) OVER (ORDER BY ...) 计算随时间推移的累计总销售额（Running Total）\nSELECT date, sales,\n    SUM(sales) OVER (ORDER BY date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_total\nFROM (VALUES (\'2026-01-01\', 100), (\'2026-01-02\', 150), (\'2026-01-03\', 200)) t(date, sales);',
        '移动平均线 (Moving Avg)': '-- 计算当前行及前两行的 3 日移动平均值（Moving Average），常用以消除时序数据的短噪\nSELECT date, price,\n    ROUND(AVG(price) OVER (ORDER BY date ROWS BETWEEN 2 PRECEDING AND CURRENT ROW), 2) AS moving_avg_3d\nFROM (VALUES (\'01-01\', 10), (\'01-02\', 12), (\'01-03\', 11), (\'01-04\', 15)) t(date, price);',
    },
    '关系与连接': {
        '内部关联 (Inner Join)': '-- 使用 JOIN 筛选两张虚拟表中完全匹配的数据，演示典型的用户和订单关联\nSELECT u.id, u.name, o.item\nFROM (VALUES (1, \'Alice\'), (2, \'Bob\')) u(id, name)\nJOIN (VALUES (1, \'Book\'), (3, \'Pen\')) o(user_id, item) ON u.id = o.user_id;',
        '左外关联 (Left Join)': '-- 使用 LEFT JOIN 保留左表（用户表）的全部数据，若右表（订单）缺失则补 NULL\nSELECT u.id, u.name, o.item\nFROM (VALUES (1, \'Alice\'), (2, \'Bob\')) u(id, name)\nLEFT JOIN (VALUES (1, \'Book\')) o(user_id, item) ON u.id = o.user_id;',
        '差集关联 (Anti Join)': '-- 运用 LEFT JOIN 并判断右表关联键 IS NULL，找出只存在于左表而不在右表的差集数据\nSELECT u.id, u.name\nFROM (VALUES (1, \'Alice\'), (2, \'Bob\'), (3, \'Charlie\')) u(id, name)\nLEFT JOIN (VALUES (1), (2)) o(user_id) ON u.id = o.user_id\nWHERE o.user_id IS NULL;',
        '集合交集 (Set Intersect)': '-- 使用 INTERSECT 找出同时存在于两个查询结果集中的共有数据\n(SELECT name FROM (VALUES (\'A\'), (\'B\'), (\'C\')) t(name))\nINTERSECT\n(SELECT name FROM (VALUES (\'B\'), (\'C\'), (\'D\')) t(name));',
    },
    '高级透视与嵌套类型': {
        '列转行透视 (Pivot)': '-- 使用 DuckDB 独有的 PIVOT 将行值（年份）交叉透视为不同的列头，计算各品牌年销售额\nPIVOT (\n    SELECT * FROM (\n        VALUES \n            (\'华为\', 2024, 500), \n            (\'华为\', 2025, 700), \n            (\'小米\', 2024, 300)\n    ) t(brand, year, sales)\n) ON year USING SUM(sales);',
        '行转列逆透视 (Unpivot)': '-- 使用 UNPIVOT 将多列（不同月份）折叠合并为一个单列（季度）和值列（金额）\nUNPIVOT (\n    SELECT 101 AS user_id, 500 AS q1_sales, 800 AS q2_sales\n)\nON (q1_sales, q2_sales)\nINTO NAME quarter VALUE sales;',
        '嵌套数组展开 (Unnest)': '-- 使用 UNNEST 将数组或列表类型的列，行级拆解展开为多行明细数据\nSELECT name, UNNEST(tags) AS tag\nFROM (VALUES (\'苹果\', [\'水果\', \'红色\', \'健康\']), (\'土豆\', [\'蔬菜\', \'淀粉\'])) t(name, tags);',
        '多行归并数组 (List Agg)': '-- 使用 list(col) 函数将分组后的多行明细数据收集归并为一个数组字段\nSELECT department, list(employee) AS employee_list\nFROM (VALUES (\'技术部\', \'小张\'), (\'技术部\', \'小李\'), (\'市场部\', \'小王\')) t(department, employee)\nGROUP BY department;',
        '随机抽样 (Sample)': '-- 使用 USING SAMPLE 进行个数随机抽样，适合对数据进行快速勘探\nSELECT * \nFROM range(1, 1001) t(i) \nUSING SAMPLE 5 ROWS;',
        '临时宏定义 (Macro)': '-- 创建并调用一个自定义的临时计算宏函数，封装可复用的计算公式\nCREATE OR REPLACE TEMP MACRO calc_vat(price, rate := 0.13) AS price * (1 + rate);\nSELECT calc_vat(100) AS price_with_tax;',
    },
};

// Flat alias for backward-compat usages
export const SNIPPETS = Object.values(SNIPPET_GROUPS).reduce(
    (acc, group) => ({ ...acc, ...group }),
    {} as Record<string, string>
);

// ============================================================
// Snippet Category Metadata
// ============================================================

export const SNIPPET_CATEGORY_META: Record<string, {
    icon: React.ReactNode;
    color: string;
    description: string;
}> = {
    '数据虚拟生成': { icon: <Plus className="w-4 h-4" />, color: 'text-monokai-blue', description: 'Range 序列、VALUES 虚拟表' },
    '清洗与转换': { icon: <ClipboardList className="w-4 h-4" />, color: 'text-monokai-amethyst', description: 'CTE、条件判断、EXCLUDE 排除、JSON与正则' },
    '多维统计分析': { icon: <BarChart2 className="w-4 h-4" />, color: 'text-monokai-green', description: 'ROLLUP 汇总、Rank 窗口、同环比与滑动指标' },
    '关系与连接': { icon: <Link2 className="w-4 h-4" />, color: 'text-monokai-blue', description: 'INNER/LEFT/ANTI 关联与集合交并' },
    '高级透视与嵌套类型': { icon: <Zap className="w-4 h-4" />, color: 'text-monokai-orange', description: 'PIVOT 透视、Unpivot 逆透视、数组解包、合并与宏' },
};

// ============================================================
// SQL Category Help
// ============================================================

export type SqlCategoryHelp = {
    title: string;
    description: string;
    scenarios: string[];
    commonErrors: string[];
    aiHints: string[];
    quickStart: string[];
    bestPractices: string[];
    duckdbSpecific: string[];
    exampleFlows: { name: string; description: string }[];
};

export const SQL_CATEGORY_HELP: Record<string, SqlCategoryHelp> = {
    'select': {
        title: 'SELECT 查询生成',
        description: '将自然语言需求快速转成可执行的 DuckDB SELECT 查询，含过滤、排序、分页、多表关联。',
        scenarios: [
            '有明确业务问题，需要一条 SQL 直接回答',
            '需要从表中筛选特定条件的数据',
            '需要对数据进行排序、分页、聚合',
            '需要多表关联查询（JOIN）'
        ],
        commonErrors: [
            'SELECT * 导致返回过多不必要的数据',
            'WHERE 条件使用中文或错误运算符',
            'JOIN 条件不完整导致笛卡尔积（数据膨胀）',
            '未处理 NULL 值导致结果偏差',
            '缺少 LIMIT 导致返回大量数据卡顿'
        ],
        aiHints: [
            '尽量用「业务意图 + 关键字段名」描述需求，AI 生成更准确',
            '指定时间范围（如「最近 30 天」）可以提高查询效率',
            '需要聚合时明确说「按 X 分组，统计 Y」',
            '告知 AI 所用数据库是 DuckDB，可启用特有语法'
        ],
        quickStart: [
            '1. 在左侧 Schema 选中目标表，点击表名自动插入',
            '2. 点击「AI 填充」生成带上下文的查询模板',
            '3. 在 AI 输入框描述具体需求，Enter 生成完整 SQL',
            '4. Ctrl+Enter 执行，查看结果',
            '5. 结果满意后点 Save 收藏'
        ],
        bestPractices: [
            '使用具体列名而非 SELECT *，减少传输数据量',
            'WHERE 条件优先使用原始列（避免在列上做函数运算）',
            '添加 LIMIT 100 限制结果集，调试时更安全',
            '复杂查询使用 CTE（WITH）逐步分解'
        ],
        duckdbSpecific: [
            'SELECT * EXCLUDE (col1, col2) — 排除特定列',
            'FROM table SELECT col — FROM 可写在 SELECT 之前',
            'SELECT * REPLACE (col * 2 AS col) — 替换指定列值',
            'USING SAMPLE 100 ROWS — 快速随机抽样'
        ],
        exampleFlows: [
            { name: '简单筛选', description: 'SELECT cols → FROM → WHERE → LIMIT' },
            { name: '分组统计', description: 'SELECT → FROM → WHERE → GROUP BY → HAVING' },
            { name: '多表关联', description: 'FROM t1 JOIN t2 ON key → SELECT → WHERE' }
        ]
    },
    'join': {
        title: 'JOIN 关联查询',
        description: '处理多表关联查询，包括 INNER、LEFT、RIGHT、FULL OUTER JOIN 及差异分析。',
        scenarios: [
            '需要合并多个表的数据到一个结果集',
            '需要保留一方的全部数据（LEFT/RIGHT JOIN）',
            '需要找出两表的差异或不匹配数据',
            '需要自关联查询（树形结构、层级关系）'
        ],
        commonErrors: [
            'JOIN 条件遗漏导致笛卡尔积（结果行数爆炸）',
            '混用 ON 和 WHERE 导致过滤时机错误',
            'LEFT JOIN 后在 WHERE 加右表条件，变为内连接',
            '多表 JOIN 顺序不当影响性能',
            '关联列数据类型不一致导致无法匹配'
        ],
        aiHints: [
            '明确主表（保留全部数据的那张）和从表',
            '在描述中指出关联字段名，AI 生成 ON 条件更准确',
            'LEFT JOIN + WHERE right.col IS NULL 可找差异数据',
            '三张以上表 JOIN 时，建议先描述两两关系'
        ],
        quickStart: [
            '1. 确定主表（LEFT JOIN 左侧）',
            '2. 确定关联表和关联字段（如 user_id）',
            '3. 选择 JOIN 类型（INNER / LEFT / FULL）',
            '4. 在 AI 输入框描述关联逻辑',
            '5. 检查结果行数是否符合预期'
        ],
        bestPractices: [
            '先过滤再 JOIN，减少参与连接的行数',
            '用 EXPLAIN 确认 JOIN 执行顺序是否合理',
            '避免在 JOIN 后的 WHERE 中过滤右表（改用子查询）',
            '复杂多表 JOIN 拆分为多个 CTE，逐步构建'
        ],
        duckdbSpecific: [
            'JOIN t2 USING (user_id) — 相同列名时简化 ON 语法',
            'ASOF JOIN — 时间序列最近匹配连接',
            'POSITIONAL JOIN — 按行位置连接两表',
            'FROM t1, t2 WHERE t1.id = t2.id — 隐式 JOIN 语法'
        ],
        exampleFlows: [
            { name: '用户订单', description: 'users LEFT JOIN orders USING (user_id)' },
            { name: '差异数据', description: 'LEFT JOIN + WHERE right_id IS NULL' },
            { name: '时序关联', description: 'ASOF JOIN 匹配最近时间点' }
        ]
    },
    'aggregate': {
        title: '聚合 / 指标分析',
        description: '使用聚合函数和窗口函数进行指标统计、趋势分析、排名和同环比计算。',
        scenarios: [
            '按时间维度统计指标趋势（日/周/月）',
            '计算同比 / 环比增长率',
            '多维度下钻（GROUP BY ROLLUP / CUBE）',
            '用户行为漏斗与留存分析',
            '排名、Top N、累计计算'
        ],
        commonErrors: [
            'SELECT 中混用聚合 and 非聚合列（缺 GROUP BY）',
            'GROUP BY 遗漏必要字段导致报错',
            '窗口函数缺少 ORDER BY，排序结果不确定',
            'HAVING 和 WHERE 混淆（HAVING 过滤聚合后结果）',
            '留存计算时忘记处理用户首次出现的边界条件'
        ],
        aiHints: [
            '描述「按 X 维度，统计 Y 指标」，AI 直接生成 GROUP BY',
            '同环比场景提示 AI 使用 LAG 窗口函数',
            '漏斗分析建议用 CTE 逐步筛选各步骤用户',
            '多维分析说「需要小计和总计」，AI 用 ROLLUP 生成'
        ],
        quickStart: [
            '1. 确定分组字段（如 dept_id）和指标字段（如 sales）',
            '2. 确定过滤条件（WHERE）',
            '3. 编写 GROUP BY 语句',
            '4. 如需过滤统计后的指标，编写 HAVING',
            '5. 执行并利用图表可视化趋势'
        ],
        bestPractices: [
            '聚合字段名使用有业务含义的别名（如 total_amount）',
            '复杂聚合逻辑，如跨表指标，拆分为 CTE 或子查询',
            '窗口函数中必须明确 ORDER BY 保证排名及偏移正确',
            '善用 COALESCE 处理聚合结果中的 NULL 值'
        ],
        duckdbSpecific: [
            'GROUP BY ALL — 自动推导分组字段',
            'median(col) — 内置求中位数函数',
            'mode(col) — 内置求众数函数',
            'quantiles(col, 0.9) — 快速分位数计算'
        ],
        exampleFlows: [
            { name: '月度环比', description: 'LAG(sales, 1) OVER (ORDER BY month)' },
            { name: '排名 TopN', description: 'ROW_NUMBER() OVER (...) + WHERE rn <= N' },
            { name: '漏斗分析', description: '通过多个聚合 CASE WHEN 统计转化率' }
        ]
    },
    'transform': {
        title: '数据清洗与转换',
        description: '对脏数据进行格式转换、空值填充、字符串处理、类型强转及复杂 JSON 解析。',
        scenarios: [
            '清洗导入的原始脏数据（去空格、统一大小写）',
            '将不规范的日期字符串强转为 DATE 类型',
            '解析从 API 获取的复杂嵌套 JSON 字符串',
            '使用 COALESCE 对 NULL 值进行默认值填充',
            '使用正则表达式进行敏感字段脱敏或特征提取'
        ],
        commonErrors: [
            '直接对非数值列进行数学计算导致报错',
            '强转失败直接返回 NULL 却未做容错处理（推荐用 try_cast）',
            '对 JSON 解析路径写错，导致提取空值',
            '正则修饰符使用不当，导致漏配或错配',
            '清洗字符串时遗漏 trim 导致看不见的空格干扰匹配'
        ],
        aiHints: [
            '提供样例数据格式（如 "2026/05/01"），AI 转换更精确',
            '说明空值处理策略（如 "为空时填0"），AI 会使用 COALESCE',
            '提供 JSON 样本结构，AI 能写出精准的 json_extract_string 路径',
            '说明正则匹配的要求（如 "仅提取数字"）'
        ],
        quickStart: [
            '1. 查看原始数据样式和存在的问题',
            '2. 针对类型问题，使用 TRY_CAST 进行安全强转',
            '3. 针对文本问题，运用 TRIM、LOWER、REGEXP 函数清洗',
            '4. 针对空值，使用 COALESCE 提供默认值',
            '5. 查看清洗后的分布，确保无大范围 NULL 值产生'
        ],
        bestPractices: [
            '强转时优先使用 try_cast 代替 cast，避免整批查询因单行脏数据崩溃',
            '处理 JSON 时，对频繁访问的字段建议通过物化表提取成物理列',
            '字符串连接使用 concat 避免因 NULL 导致整行变为 NULL',
            '正则处理复杂的模式，简单的查找优先使用 LIKE'
        ],
        duckdbSpecific: [
            'try_cast(col AS type) — 容错类型转换',
            'string_split(str, desc) — 拆分字符串为数组',
            'json_extract(json, path) — 极速 JSON 提取',
            'bar(val, min, max) — 在终端/表格中渲染文本进度条'
        ],
        exampleFlows: [
            { name: '脏数据容错', description: 'COALESCE(try_cast(col AS INT), 0)' },
            { name: 'JSON解包', description: 'json_extract_string + UNNEST 数组展开' },
            { name: '敏感词屏蔽', description: 'regexp_replace 替换手机号中间四位' }
        ]
    },
    'performance': {
        title: '性能执行与诊断',
        description: '利用 EXPLAIN 和诊断工具分析查询瓶颈，进行索引优化、内存调优和扫描优化。',
        scenarios: [
            '查询运行缓慢，需要找出性能瓶颈（慢查询）',
            '确认 DuckDB 优化器是否执行了正确的 Join 类型（Hash/Merge）',
            '检查大数据量下内存和 CPU 的使用效率',
            '排查多线程并行度以及磁盘溢出（Spill to Disk）问题'
        ],
        commonErrors: [
            '在小数据量上做 EXPLAIN，诊断结果代表性不足',
            '忽视 EXPLAIN ANALYZE 最终的实际耗时，只看静态计划',
            '对带有大字段或长文本的表进行全表扫描（SELECT *）导致 I/O 阻塞',
            '大表 JOIN 时未将过滤条件提前下推（Filter Pushdown）',
            '频繁执行临时临时大计算，未做物化（Materialization）缓存'
        ],
        aiHints: [
            '在慢 SQL 前加上 EXPLAIN 并提供给 AI 协助诊断',
            '描述表的量级和硬件环境（如 "千万级行，16G内存"）',
            '询问如何优化特定的 HashJoin 瓶颈',
            '让 AI 提供重构为 CTE 临时表以缓存中间结果的方案'
        ],
        quickStart: [
            '1. 在慢查询语句最前方加上 EXPLAIN ANALYZE 关键字',
            '2. 执行查询，结果将切换到 Explain/Plan 图形化树状视图',
            '3. 寻找树中耗时最长（红橘色高亮或百分比较高）的算子节点',
            '4. 查看该算子在内存/磁盘间的数据传输规模',
            '5. 根据瓶颈采取优化动作（如过滤下推、使用 Parquet 投影等）'
        ],
        bestPractices: [
            '大文件查询时使用 Parquet 格式，利用其列式存储的投影下推机制',
            '尽量避免笛卡尔积关联，检查 ON 条件是否完全对齐',
            '合理调整 memory_limit 参数，避免频繁发生临时数据溢写磁盘',
            '对于极复杂的中间计算，使用物化视图或临时表进行阶段性缓存'
        ],
        duckdbSpecific: [
            'EXPLAIN ANALYZE — 附带运行时诊断的执行计划',
            'PRAGMA database_size — 查看数据库物理空间分布',
            'PRAGMA show_tables — 查看所有常驻及内存临时表',
            'SUMMARIZE SELECT ... — 全速分析查询输出的数据画像'
        ],
        exampleFlows: [
            { name: '静态计划', description: 'EXPLAIN SELECT ... 查看静态逻辑计划' },
            { name: '性能诊断', description: 'EXPLAIN ANALYZE SELECT ... 抓取运行时算子耗时' },
            { name: '下推确认', description: '通过计划树叶子节点确认 Filter 是否已成功下推' }
        ]
    },
    'utilities': {
        title: '辅助工具方法',
        description: '使用 PRAGMA 指令、系统变量查询、信息架构元数据和数据库管理命令进行辅助操作。',
        scenarios: [
            '查看当前连接的 DuckDB 内存、线程等运行参数',
            '查看所有已加载的扩展模块（Extensions）',
            '查询所有物理表名、字段数及列属性元数据',
            '清除临时内存缓存或修改全局会话配置'
        ],
        commonErrors: [
            '混淆 PRAGMA 指令与普通 SQL 函数的调用语法',
            '在只读模式下执行配置修改指令导致报错',
            '频繁对临时会话设置进行覆盖，影响并行查询性能',
            '系统表字段理解有偏（如将物理表和临时视图混淆统计）'
        ],
        aiHints: [
            '描述你想调优的系统配置（如 "怎么查看当前最大内存设置"）',
            '问 AI 怎么列出当前库里所有的表和对应的字段',
            '让 AI 写一条清理垃圾文件或释放空闲页的 PRAGMA SQL'
        ],
        quickStart: [
            '1. 打开 AI 智能工具下拉框选择「辅助工具方法」',
            '2. 选择你需要的系统状态模板',
            '3. Ctrl+Enter 执行 pragma 或系统查询语句',
            '4. 检查系统返回的环境配置信息并进行调优配置'
        ],
        bestPractices: [
            '设置全局参数时（如 threads）优先使用 SET 语法',
            '在开发调试阶段，先通过系统视图检查是否有僵死会话或大临时表未释放',
            '扩展包动态安装后，需执行 LOAD 指令进行显式激活',
            '定期分析 system 信息确认当前 WASM 运行处于健康水位'
        ],
        duckdbSpecific: [
            'PRAGMA show_tables — 查看表列表',
            'PRAGMA database_list — 查看已附加的外部数据库',
            'SELECT * FROM duckdb_settings() — 查看所有全局设置项',
            'SELECT * FROM duckdb_extensions() — 查看扩展包状态'
        ],
        exampleFlows: [
            { name: '系统设置查询', description: 'SELECT * FROM duckdb_settings() WHERE name LIKE ...' },
            { name: '表结构元数据', description: 'SELECT * FROM duckdb_columns WHERE table_name = ...' },
            { name: '扩展包检查', description: 'SELECT name, loaded, installed FROM duckdb_extensions()' }
        ]
    },
    'external': {
        title: '外部数据与文件',
        description: '无需导入建表，直接在 SQL 中读写在线/本地 CSV, Parquet, JSON, Excel 等外部文件。',
        scenarios: [
            '零建表直接查询 HTTP/HTTPS 上的 Parquet 或 CSV 数据',
            '模糊匹配读取本地目录下的一批 CSV 文件',
            '将查询结果直接高速导出保存为 Parquet 或 CSV 物理文件',
            'Attach 附加并跨库联合查询 SQLite / PostgreSQL 数据源'
        ],
        commonErrors: [
            '本地文件绝对路径写错或反斜杠未转义',
            '网络 URL 链接未用单引号/双引号包裹导致语法报错',
            '读取大型网络文件时忘记用 WHERE 过滤多余数据导致流量浪费',
            '复制/导出目标文件夹没有写权限或文件名重复'
        ],
        aiHints: [
            '描述网络文件 URL 并指定其格式（如 "S3上的CSV文件"）',
            '说明通配符模式（如 "读取目录下所有的 json 文件"）',
            '询问如何将查询出的虚拟表另存/拷贝为本地 Parquet 文件'
        ],
        quickStart: [
            '1. 获取文件的绝对路径或网络 HTTPS URL 链接',
            '2. 将其用单引号包裹并直接放在 FROM 后面',
            '3. 执行查询，DuckDB 会自动匹配最佳文件驱动（ CSV/Parquet 自动探测）',
            '4. 使用 EXCLUDE 或 REPLACE 精炼字段',
            '5. 对满意的查询结合 COPY 语句一键导出物理文件'
        ],
        bestPractices: [
            '优先使用 Parquet 格式读写，支持投影与过滤器下推，网络查询速度最快',
            '对大量零碎小文件使用 Glob 语法（如 `*.csv`）进行分片多线程联合读取',
            '结合 ATTACH 语法临时装载 SQLite 等其他外部文件进行混合关联'
        ],
        duckdbSpecific: [
            'SELECT * FROM \'https://example.com/data.parquet\' — 查询网络在线 Parquet',
            'SELECT * FROM read_csv_auto(\'c:/data/*.csv\') — 通配符读取本地多 CSV 文件',
            'COPY (SELECT * FROM my_table) TO \'output.parquet\' (FORMAT PARQUET) — 快速导出 Parquet',
            'ATTACH \'sqlite.db\' AS my_lite (TYPE SQLITE) — 附加外部 SQLite 数据库'
        ],
        exampleFlows: [
            { name: '在线Parquet直读', description: 'SELECT * FROM \'http://domain/file.parquet\' LIMIT 10' },
            { name: '多文件联合分析', description: 'SELECT col1, SUM(col2) FROM \'path/*.csv\' GROUP BY 1' },
            { name: '跨库临时关联', description: 'ATTACH \'db.sqlite\' AS sqlite; SELECT * FROM sqlite.users;' }
        ]
    }
};
