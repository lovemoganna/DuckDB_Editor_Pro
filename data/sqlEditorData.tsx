/**
 * sqlEditorData.tsx
 *
 * Extracted static data constants from SqlEditor.tsx.
 * This file contains SQL snippet groups, category metadata, and AI assistance
 * guidance for the SQL editor. Kept separate from the main editor component
 * to reduce SqlEditor.tsx size and improve maintainability.
 */

import React from 'react';
import { ClipboardList, BarChart2, Link2, Zap } from 'lucide-react';

// ============================================================
// SQL Snippet Groups
// ============================================================

export const SNIPPET_GROUPS: Record<string, Record<string, string>> = {
    '基础查询': {
        'CTE': 'WITH cte_name AS (\n    SELECT * FROM table_name\n)\nSELECT * FROM cte_name;',
        'Case When': "SELECT *,\n    CASE\n        WHEN condition THEN 'A'\n        ELSE 'B'\n    END AS category\nFROM table_name;",
        'Limit + Order': 'SELECT *\nFROM table_name\nORDER BY id DESC\nLIMIT 100;',
    },
    '聚合 / 窗口': {
        'GROUP BY': 'SELECT col, COUNT(*) AS cnt, SUM(amount) AS total\nFROM table_name\nGROUP BY col\nHAVING COUNT(*) > 1;',
        'Window Rank': 'SELECT *,\n    ROW_NUMBER() OVER (PARTITION BY col ORDER BY date DESC) AS rn,\n    RANK()       OVER (PARTITION BY col ORDER BY amount DESC) AS rnk\nFROM table_name;',
        'Date Trunc': "SELECT date_trunc('month', ts) AS mth,\n    COUNT(*) AS cnt,\n    SUM(amount) AS total\nFROM table_name\nGROUP BY 1\nORDER BY 1;",
        'LAG / LEAD': 'SELECT *,\n    LAG(amount, 1)  OVER (PARTITION BY user_id ORDER BY date) AS prev_amount,\n    LEAD(amount, 1) OVER (PARTITION BY user_id ORDER BY date) AS next_amount\nFROM table_name;',
    },
    'JOIN': {
        'Inner Join': 'SELECT t1.*, t2.*\nFROM table1 t1\nJOIN table2 t2 ON t1.id = t2.id;',
        'Left Join': 'SELECT t1.*, t2.col\nFROM table1 t1\nLEFT JOIN table2 t2 USING (user_id);',
        'Anti Join': '-- 找出在 table1 但不在 table2 的数据\nSELECT t1.*\nFROM table1 t1\nLEFT JOIN table2 t2 ON t1.id = t2.id\nWHERE t2.id IS NULL;',
    },
    'DuckDB 专有': {
        'SUMMARIZE': 'SUMMARIZE table_name;',
        'PIVOT': 'PIVOT table_name ON col_name USING SUM(val_col);',
        'UNPIVOT': 'UNPIVOT table_name\nON (col1, col2, col3)\nINTO NAME metric VALUE value;',
        'SAMPLE': 'SELECT * FROM table_name USING SAMPLE 100 ROWS;',
        'EXCLUDE cols': 'SELECT * EXCLUDE (col1, col2) FROM table_name;',
        'JSON Extract': "SELECT json_extract_string(json_col, '$.key') AS val FROM table_name;",
        'Macro': 'CREATE MACRO pair_sum(a, b) AS a + b;',
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
    '基础查询': { icon: <ClipboardList className="w-4 h-4" />, color: 'text-monokai-blue', description: 'CTE、条件判断、排序分页' },
    '聚合 / 窗口': { icon: <BarChart2 className="w-4 h-4" />, color: 'text-monokai-purple', description: '聚合统计、窗口函数、时间处理' },
    'JOIN': { icon: <Link2 className="w-4 h-4" />, color: 'text-monokai-green', description: '表关联、内外连接、集合运算' },
    'DuckDB 专有': { icon: <Zap className="w-4 h-4" />, color: 'text-monokai-orange', description: 'DuckDB 特有语法' },
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
            'SELECT 中混用聚合和非聚合列（缺 GROUP BY）',
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
            '1. 选择包含时间列的数据表',
            '2. 描述分析场景（如：统计最近 30 天每日新增）',
            '3. AI 填充生成基础聚合 SQL',
            '4. 在结果区切换「Chart」模式查看趋势',
            '5. 收藏为指标查询'
        ],
        bestPractices: [
            '时间截断统一用 date_trunc，保证粒度一致',
            'WHERE 在 GROUP BY 之前过滤，减少聚合数据量',
            '多指标用 CTE 分别计算后 JOIN 合并',
            'FILTER 子句替代 CASE WHEN，可读性更高'
        ],
        duckdbSpecific: [
            "date_trunc('month', ts) — 时间截断到月",
            'GROUPING SETS / ROLLUP / CUBE — 多维聚合一次完成',
            'COUNT(*) FILTER (WHERE condition) — 条件聚合',
            'quantile_cont(0.5) WITHIN GROUP (ORDER BY col) — 中位数'
        ],
        exampleFlows: [
            { name: '日活趋势', description: "date_trunc + COUNT(DISTINCT user_id)" },
            { name: '同比计算', description: 'LAG(val, 12) OVER (PARTITION BY ... ORDER BY month)' },
            { name: '漏斗分析', description: 'CTE 逐步筛选 → LEFT JOIN → 计算转化率' }
        ]
    },
    'transform': {
        title: '数据转换 / 清洗',
        description: '处理列转行、行转列、类型转换、字符串标准化与数据质量清洗等预处理操作。',
        scenarios: [
            '宽表转长表（多列 → 行，UNPIVOT）',
            '长表转宽表（行 → 多列，PIVOT）',
            '字段类型转换与格式标准化',
            '字符串提取、分割与拼接',
            '去重与数据质量检查'
        ],
        commonErrors: [
            'CAST 类型不兼容导致静默 NULL（应先用 TRY_CAST）',
            'UNPIVOT 时列数据类型不一致报错',
            'regexp_extract 捕获组序号写错（DuckDB 从 0 开始）',
            '字符串拼接使用 + 而非 || 或 concat()',
            '去重未考虑大小写或前后空格差异'
        ],
        aiHints: [
            '描述「从哪种格式转为哪种格式」，AI 直接生成 PIVOT/UNPIVOT',
            '类型转换提示 AI 使用 TRY_CAST 防错误中断',
            '提供示例字符串，AI 生成正则表达式更准确',
            '去重说明「以哪些字段为唯一键」，AI 用 QUALIFY 生成'
        ],
        quickStart: [
            '1. 用 SUMMARIZE 快速查看列结构和类型',
            '2. 描述目标格式（如：把 q1/q2/q3 列转为行）',
            '3. AI 填充生成 UNPIVOT 或 PIVOT 语句',
            '4. 执行并检查结果行数',
            '5. 用 TRY_CAST + COALESCE 补全缺失值'
        ],
        bestPractices: [
            '类型转换优先用 TRY_CAST，避免整批失败',
            '字符串统一 lower() + trim() 后再比较',
            '去重用 QUALIFY ROW_NUMBER() OVER (...) = 1',
            '清洗逻辑用 CTE 分层，方便定位问题步骤'
        ],
        duckdbSpecific: [
            'PIVOT col FOR key IN (v1, v2, v3) — 原生行转列',
            'UNPIVOT tbl ON (c1, c2) INTO name k value v — 原生列转行',
            'TRY_CAST(col AS INTEGER) — 安全类型转换，失败返回 NULL',
            "regexp_extract(col, pattern, 0) — 正则提取（第 0 组）"
        ],
        exampleFlows: [
            { name: '宽转长', description: 'UNPIVOT 多季度列 → quarter + value' },
            { name: '长转宽', description: 'PIVOT category OVER month → 交叉表' },
            { name: '字段清洗', description: 'TRY_CAST + COALESCE + trim + lower' }
        ]
    },
    'performance': {
        title: '执行计划 / 性能优化',
        description: '通过 EXPLAIN ANALYZE 诊断慢查询，定位性能瓶颈并生成优化改写方案。',
        scenarios: [
            '查询执行时间超出预期，需定位慢节点',
            '大表 JOIN 时内存占用过高',
            '扫描行数远多于实际返回行数',
            '复杂子查询可改写为更高效的形式',
            '需要对比改写前后的执行计划差异'
        ],
        commonErrors: [
            '未用 EXPLAIN ANALYZE，只看计划未看实际执行数据',
            '过早 JOIN 大表，未先过滤（应先 WHERE 再 JOIN）',
            'WHERE 中对列做函数运算，导致无法裁剪分区',
            'SELECT * 导致读取不必要的列（Parquet 场景尤其慢）',
            '子查询每行触发一次，改为 JOIN 性能大幅提升'
        ],
        aiHints: [
            '将 EXPLAIN ANALYZE 输出粘贴到 AI 输入框，让 AI 定位最耗时节点',
            '描述表的大小（行数/列数），AI 优化建议更有针对性',
            '告知 AI「将子查询改为 JOIN」或「尝试 CTE 物化」',
            '询问 AI「是否可以下推 WHERE 条件」减少扫描量'
        ],
        quickStart: [
            '1. 在 SQL 前加 EXPLAIN ANALYZE，执行查询',
            '2. 在结果区点击「Plan」标签查看执行计划',
            '3. 找到耗时最长的节点（行数多 × 耗时高）',
            '4. 将计划文本粘贴到 AI 输入框，描述优化目标',
            '5. AI 生成改写版本，对比执行时间'
        ],
        bestPractices: [
            '先 WHERE 过滤再 JOIN，减少参与连接的行数',
            '避免在 WHERE 对列做函数（用计算列代替）',
            '读取 Parquet 时只 SELECT 需要的列',
            '复杂 CTE 用 MATERIALIZED 强制物化，避免重复计算'
        ],
        duckdbSpecific: [
            'EXPLAIN ANALYZE query — 查看实际执行计划与耗时',
            'PRAGMA threads=N — 调整并行线程数',
            "SET memory_limit='4GB' — 限制内存使用",
            'CREATE TABLE t AS SELECT ... — 物化中间结果加速'
        ],
        exampleFlows: [
            { name: '慢查询诊断', description: 'EXPLAIN ANALYZE → 定位扫描节点 → 下推 WHERE' },
            { name: '子查询改写', description: '相关子查询 → LEFT JOIN + COALESCE' },
            { name: '大表优化', description: '先过滤小表 → JOIN → 减少扫描行数' }
        ]
    },
    'utilities': {
        title: '实用工具 / 测试数据',
        description: '快速生成模拟数据、统计数据摘要、随机抽样与数据质量检查等辅助操作。',
        scenarios: [
            '快速生成模拟数据用于功能测试',
            '查看表的数据分布与统计摘要',
            '从大表中随机抽取样本',
            '检查数据质量（缺失值、重复值、异常值）',
            '快速了解新导入数据的整体情况'
        ],
        commonErrors: [
            'generate_series 范围参数填错，生成数据量异常',
            'random() 未固定种子，每次结果不同影响可重现',
            'SUMMARIZE 结果中 null_percentage 列名拼写易错',
            'USING SAMPLE 与 TABLESAMPLE 语法混淆',
            '质量检查时忘记对字符串 trim 去空格再比较'
        ],
        aiHints: [
            '描述「几行、哪些字段、什么类型」，AI 直接生成 INSERT 语句',
            '数据摘要直接用「SUMMARIZE 表名」，AI 可进一步解读',
            '抽样提示 AI 使用 USING SAMPLE，并指定行数或百分比',
            '质量检查提示 AI 生成「NULL / 重复 / 范围异常」三合一检查 SQL'
        ],
        quickStart: [
            '1. 选择目标：生成数据 / 摘要统计 / 抽样 / 质量检查',
            '2. 描述需求（如：生成 1000 行订单测试数据）',
            '3. AI 填充生成对应 SQL',
            '4. 执行并检查结果',
            '5. 保存为片段模板复用'
        ],
        bestPractices: [
            '测试数据固定随机种子 setseed(0.42)，保证可重现',
            '摘要统计优先用 SUMMARIZE，比手写 COUNT/AVG 更全面',
            '大表抽样用 USING SAMPLE N ROWS（精确行数）',
            '质量检查结果用 UNION ALL 合并，一次性审查'
        ],
        duckdbSpecific: [
            'SUMMARIZE table_name — 一行代码生成全列统计摘要',
            'SELECT * FROM range(1, 1001) — 生成 1~1000 序列',
            'SELECT * FROM t USING SAMPLE 100 ROWS — 精确行数抽样',
            'setseed(0.42) — 固定随机种子，结果可重现'
        ],
        exampleFlows: [
            { name: '测试数据', description: 'generate_series + random() + setseed() → INSERT' },
            { name: '数据摘要', description: 'SUMMARIZE → 解读 null_percentage / min / max' },
            { name: '质量检查', description: 'NULL + 重复 + 范围异常 → UNION ALL 汇总' }
        ]
    }
};
