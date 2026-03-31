import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Play, Save, FolderOpen, X, Plus, Clock, Database, ChevronRight, ChevronDown, ChevronLeft, Search, MoreVertical, Layout, Type, Download, Trash2, Maximize2, Minimize2, Table, BarChart2, FileText, Smartphone, Monitor, RefreshCw, Sparkles, Lightbulb, Zap, AlertTriangle, Target, Wand2, Eye, EyeOff, Code, Info, Loader2, RotateCcw, HelpCircle, MessageSquare, Copy, Check, Link, Wrench, Globe, Pin, Terminal } from 'lucide-react';
import { duckDBService } from '../services/duckdbService';
import { dbService } from '../services/dbService';
import { aiService } from '../services/aiService';
import { saveExplanation, getAllExplanations, clearAllExplanations, deleteExplanation, AiExplanation } from '../services/aiExplanationStorage';
import { QueryResult, QueryHistoryItem, SavedQuery, ColumnInfo, ChartConfig, SqlTab } from '../types';
import { getTypeIcon } from '../utils';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Bar, Line, Pie, Doughnut, Scatter } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { TableTree } from './TableTree';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { EditorView } from '@codemirror/view';
import { format } from 'sql-formatter';
import { ChartDashboard } from './ChartDashboard';
import { ChartBuilder } from './ChartBuilder';
import { SkillAssistant } from './SkillAssistant';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    ChartDataLabels
);

interface SqlEditorProps {
    onRun: () => void;
    initialCode?: string;
    pendingChartConfig?: ChartConfig | null;
    isZenMode: boolean;
    onToggleZen: () => void;
    onPendingConsumed?: () => void;
}



// 片段库分组配置 - 增强分类展示
const SNIPPET_GROUPS: Record<string, Record<string, string>> = {
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

// 片段库分类元数据 - 用于增强展示
const SNIPPET_CATEGORY_META: Record<string, { icon: string; color: string; description: string }> = {
    '基础查询': { icon: '📋', color: 'text-monokai-blue', description: 'CTE、条件判断、排序分页' },
    '聚合 / 窗口': { icon: '📊', color: 'text-monokai-purple', description: '聚合统计、窗口函数、时间处理' },
    'JOIN': { icon: '🔗', color: 'text-monokai-green', description: '表关联、内外连接、集合运算' },
    'DuckDB 专有': { icon: '⚡', color: 'text-monokai-orange', description: 'DuckDB 特有语法' },
};

// Flat alias for backward-compat usages
const SNIPPETS = Object.values(SNIPPET_GROUPS).reduce(
    (acc, group) => ({ ...acc, ...group }),
    {} as Record<string, string>
);

const CHEATSHEET = [
    { label: 'Select All', code: 'SELECT * FROM table_name;', cat: 'Basic' },
    { label: 'Filter (Where)', code: "SELECT * FROM table_name WHERE col = 'val';", cat: 'Basic' },
    { label: 'Sort', code: 'SELECT * FROM table_name ORDER BY col DESC;', cat: 'Basic' },
    { label: 'Limit', code: 'SELECT * FROM table_name LIMIT 10;', cat: 'Basic' },
    { label: 'Aggregation', code: 'SELECT col, COUNT(*) FROM table_name GROUP BY col;', cat: 'Aggr' },
    { label: 'Join', code: 'SELECT t1.*, t2.* FROM t1 JOIN t2 ON t1.id = t2.id;', cat: 'Join' },
    { label: 'Insert', code: "INSERT INTO table_name (col1, col2) VALUES (1, 'val');", cat: 'DML' },
    { label: 'Update', code: "UPDATE table_name SET col = 'val' WHERE id = 1;", cat: 'DML' },
    { label: 'CSV Import', code: "CREATE TABLE t AS SELECT * FROM read_csv_auto('file.csv');", cat: 'I/O' },
    { label: 'Parquet Import', code: "CREATE TABLE t AS SELECT * FROM read_parquet('file.parquet');", cat: 'I/O' },
    { label: 'Current Date', code: 'SELECT current_date, current_timestamp;', cat: 'Func' },
    { label: 'Regex Match', code: "SELECT * FROM t WHERE regexp_matches(col, 'pattern');", cat: 'Func' },
];

const DEFAULT_CODE = "-- Type your SQL here or use AI to generate it\nSELECT * FROM memory._sys_audit_log ORDER BY log_time DESC;";

const MONOKAI_COLORS = [
    'rgba(249, 38, 114, 0.8)', // Pink
    'rgba(166, 226, 46, 0.8)', // Green
    'rgba(102, 217, 239, 0.8)', // Blue
    'rgba(253, 151, 31, 0.8)', // Orange
    'rgba(174, 129, 255, 0.8)', // Purple
    'rgba(230, 219, 116, 0.8)', // Yellow
];

/**
 * SQL 板块背景说明 - MECE 结构
 * 用于帮助用户理解使用场景、常见错误和 AI 协作提示
 */
type SqlCategoryHelp = {
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

const SQL_CATEGORY_HELP: Record<string, SqlCategoryHelp> = {
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

// 智能填充提示词生成（上下文感知）
const generateAIFillPrompt = (sqlType: string, tableName?: string, columns?: ColumnInfo[]): string => {
    const columnList = columns?.map(c => `${c.name} (${c.type})`).join(', ') || '';
    const ctx = tableName ? `表: ${tableName}，字段: ${columnList || '未知'}` : '请先在左侧 Schema 选择一个表';

    switch (sqlType) {
        case 'select':
            return `为 DuckDB 生成带 WHERE 条件和 LIMIT 的基础 SELECT 查询。${ctx}`;
        case 'join':
            return `为 DuckDB 生成 LEFT JOIN 多表关联查询，主表是 ${tableName || 'table1'}，${ctx}`;
        case 'aggregate':
            return `为 DuckDB 生成按时间维度分组的聚合分析 SQL，包含 COUNT 和 SUM。${ctx}`;
        case 'transform':
            return `为 DuckDB 生成数据转换 SQL，使用 TRY_CAST 进行类型转换并用 TRIM/LOWER 清洗字符串。${ctx}`;
        case 'performance':
            return `为以下查询生成 EXPLAIN ANALYZE 诊断版本，并在注释中说明如何解读执行计划。${ctx}`;
        case 'utilities':
            return `为 DuckDB 生成 SUMMARIZE 摘要统计语句，并附上数据质量检查 SQL（NULL 率、重复行）。${ctx}`;
        default:
            return `为 DuckDB 生成 SQL 查询。${ctx}`;
    }
};

export const SqlEditor: React.FC<SqlEditorProps> = ({ onRun, initialCode, pendingChartConfig, isZenMode, onToggleZen, onPendingConsumed }) => {
    // --- Tab State Management ---
    const [tabs, setTabs] = useState<SqlTab[]>(() => {
        try {
            const saved = localStorage.getItem('duckdb_sql_tabs');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed.map((t: any) => ({
                        ...t,
                        result: null,
                        loading: false,
                        filterTerm: '',
                        chartConfig: {
                            ...t.chartConfig,
                            yKeys: t.chartConfig.yKeys || (t.chartConfig.yKey ? [t.chartConfig.yKey] : []),
                            yRightKeys: t.chartConfig.yRightKeys || [],
                            stacked: t.chartConfig.stacked || false,
                            horizontal: t.chartConfig.horizontal || false
                        }
                    }));
                }
            }
        } catch (e) { }
        return [{
            id: 'default-tab',
            title: 'Untitled Query',
            code: DEFAULT_CODE,
            result: null,
            loading: false,
            viewMode: 'table',
            chartConfig: { id: 'default', title: 'Start Execution', type: 'bar', xKey: '', yKeys: [], yRightKeys: [], stacked: false, horizontal: false, aggregation: 'none' },
            page: 0,
            filterTerm: ''
        }];
    });

    const [activeTabId, setActiveTabId] = useState<string>(() => {
        try {
            const saved = localStorage.getItem('duckdb_sql_tabs');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed[0].id;
            }
        } catch (e) { }
        return 'default-tab';
    });

    // AI & Sidebar State
    const [aiPrompt, setAiPrompt] = useState("");
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [isFixing, setIsFixing] = useState(false);
    const [activeSidebarTab, setActiveSidebarTab] = useState<'history' | 'saved' | 'schema' | 'help'>('schema');

    // Toast 状态提示
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'warning' } | null>(null);
    const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

    const showToast = useCallback((message: string, type: 'success' | 'info' | 'warning' = 'info') => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToast({ message, type });
        toastTimerRef.current = setTimeout(() => setToast(null), 2500);
    }, []);

    // AI 增强功能状态
    const [selectedSqlType, setSelectedSqlType] = useState<string>('select');
    const [showHelp, setShowHelp] = useState(true);
    const [showLivePreview, setShowLivePreview] = useState(false);
    const [liveSqlPreview, setLiveSqlPreview] = useState<string>('');
    const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
    const [aiSuggestion, setAiSuggestion] = useState<string>('');
    const [isGeneratingSuggestion, setIsGeneratingSuggestion] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [lastClearedContent, setLastClearedContent] = useState<{ sql: string; aiInput: string } | null>(null);
    const previewDebounceRef = useRef<NodeJS.Timeout | null>(null);

    // Data for Sidebar
    const [history, setHistory] = useState<QueryHistoryItem[]>([]);
    const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
    const [schemaTree, setSchemaTree] = useState<Record<string, ColumnInfo[]>>({});
    const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
    const [historyFilter, setHistoryFilter] = useState('');

    // Modals & Menus
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [showChartBuilder, setShowChartBuilder] = useState(false);
    const [editingChartId, setEditingChartId] = useState<string | null>(null);
    const [showMaterializeModal, setShowMaterializeModal] = useState(false);
    const [materializeType, setMaterializeType] = useState<'TABLE' | 'VIEW'>('TABLE');
    const [materializeName, setMaterializeName] = useState('');

    const [showSnippetsMenu, setShowSnippetsMenu] = useState(false);
    const [expandedSnippetCategory, setExpandedSnippetCategory] = useState<string | null>('基础查询'); // 当前展开的分类
    const [hoveredSnippet, setHoveredSnippet] = useState<{ label: string; sql: string } | null>(null); // 悬停预览的片段
    const [aiOptimizationHistory, setAiOptimizationHistory] = useState<{ sql: string; timestamp: number }[]>([]); // AI 优化历史
    const [aiExplanation, setAiExplanation] = useState<string>(''); // AI 解释结果
    const [showAiExplanation, setShowAiExplanation] = useState<boolean>(false); // 是否显示解释弹窗
    const [aiExplanationHistory, setAiExplanationHistory] = useState<AiExplanation[]>([]); // AI 解释历史
    const [showYAxisMenu, setShowYAxisMenu] = useState(false);
    const [showYRightAxisMenu, setShowYRightAxisMenu] = useState(false);
    const [saveQueryName, setSaveQueryName] = useState('');
    const [saveAsWidget, setSaveAsWidget] = useState(false);
    const [widgetType, setWidgetType] = useState<'value' | 'table' | 'chart'>('table');
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [showMaterializeMenu, setShowMaterializeMenu] = useState(false);
    const [showSkillAssistant, setShowSkillAssistant] = useState(false);
    const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(0); // 0 = 禁用, 其他值 = 秒数

    // Editing Tab Title
    const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
    const [tempTitle, setTempTitle] = useState('');

    // Editor Splitter State
    const [editorHeightPercent, setEditorHeightPercent] = useState(50);
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef(false);

    const chartRef = useRef<any>(null);
    const PAGE_SIZE = 50;

    // --- Initialization ---

    // --- Initialization ---

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const hist = localStorage.getItem('duckdb_sql_history');
            if (hist) setHistory(JSON.parse(hist));
            const saved = await dbService.getQueries();
            setSavedQueries(saved);
            // 加载 AI 解释历史
            const explanationHistory = await getAllExplanations();
            setAiExplanationHistory(explanationHistory);
        } catch (e) { console.error(e); }
        refreshSchema();
    };

    useEffect(() => {
        if (initialCode) {
            setTabs(prev => {
                if (prev.length === 0) {
                    const newTab = createTabObject(initialCode);
                    setActiveTabId(newTab.id);
                    return [newTab];
                }
                return prev.map(t => t.id === activeTabId ? { ...t, code: initialCode } : t);
            });
        }
    }, [initialCode]);

    // Handle pending chart config from Metrics - auto-run SQL
    useEffect(() => {
        if (pendingChartConfig) {
            const sqlCode = initialCode || ''; // Get SQL from initialCode prop
            setTabs(prev => {
                if (prev.length === 0) {
                    const newTab = createTabObject(pendingChartConfig.title || 'Metric Chart');
                    setActiveTabId(newTab.id);
                    return [{
                        ...newTab,
                        code: sqlCode,  // Use the SQL code
                        chartConfig: pendingChartConfig,
                        charts: [pendingChartConfig],  // Add to charts array
                        viewMode: 'chart' as const
                    }];
                }
                return prev.map(t => t.id === activeTabId ? {
                    ...t,
                    code: sqlCode || t.code,  // Use provided SQL or keep existing
                    chartConfig: pendingChartConfig,
                    charts: [...(t.charts || []), pendingChartConfig],  // Add to charts array
                    viewMode: 'chart' as const
                } : t);
            });

            // Auto-run the SQL after setting the config (with a small delay to ensure state is updated)
            if (sqlCode) {
                setTimeout(() => {
                    onRun();
                    // Notify parent that pending has been consumed
                    onPendingConsumed?.();
                }, 150);
            }
        }
    }, [pendingChartConfig, initialCode]); // Also track initialCode changes

    useEffect(() => {
        if (tabs.length > 0) {
            const toSave = tabs.map(t => ({
                ...t,
                result: null,
                loading: false
            }));
            localStorage.setItem('duckdb_sql_tabs', JSON.stringify(toSave));
        }
    }, [tabs]);

    // Dragging Logic
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDraggingRef.current || !editorContainerRef.current) return;
            const containerRect = editorContainerRef.current.parentElement?.getBoundingClientRect();
            if (!containerRect) return;

            const relativeY = e.clientY - containerRect.top;
            const percent = (relativeY / containerRect.height) * 100;
            setEditorHeightPercent(Math.min(Math.max(percent, 20), 80)); // Clamp between 20% and 80%
        };

        const handleMouseUp = () => {
            isDraggingRef.current = false;
            document.body.style.cursor = 'default';
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    const startDragging = () => {
        isDraggingRef.current = true;
        document.body.style.cursor = 'row-resize';
    };

    const refreshSchema = async () => {
        try {
            const tables = await duckDBService.getTables();
            const tree: Record<string, ColumnInfo[]> = {};
            for (const t of tables) {
                const cols = await duckDBService.getTableSchema(t);
                tree[t] = cols;
            }
            setSchemaTree(tree);
        } catch (e) { console.error(e); }
    };

    // --- Tab Helpers ---

    const createTabObject = (code = DEFAULT_CODE): SqlTab => ({
        id: Date.now().toString(),
        title: 'Untitled Query',
        code,
        result: null,
        history: [],
        historyIndex: -1,
        loading: false,
        viewMode: 'table',
        chartConfig: { id: 'default', title: 'Start Execution', type: 'bar', xKey: '', yKeys: [], yRightKeys: [], stacked: false, horizontal: false, aggregation: 'none' },
        page: 0,
        filterTerm: ''
    });

    const createNewTab = () => {
        const newTab = createTabObject();
        setTabs(prev => [...prev, newTab]);
        setActiveTabId(newTab.id);
    };

    const closeTab = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newTabs = tabs.filter(t => t.id !== id);
        if (newTabs.length === 0) {
            const defaultTab = createTabObject();
            setTabs([defaultTab]);
            setActiveTabId(defaultTab.id);
        } else {
            setTabs(newTabs);
            if (activeTabId === id) {
                setActiveTabId(newTabs[newTabs.length - 1].id);
            }
        }
    };

    const updateActiveTab = (updates: Partial<SqlTab>) => {
        setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, ...updates } : t));
    };

    const getActiveTab = () => tabs.find(t => t.id === activeTabId) || tabs[0];

    const handleTitleDoubleClick = (tab: SqlTab) => {
        setEditingTitleId(tab.id);
        setTempTitle(tab.title);
    };

    const saveTitle = () => {
        if (editingTitleId) {
            setTabs(prev => prev.map(t => t.id === editingTitleId ? { ...t, title: tempTitle || 'Untitled' } : t));
            setEditingTitleId(null);
        }
    };

    // --- Execution Logic ---

    const execute = async (explain = false) => {
        const tab = getActiveTab();
        if (!tab || tab.loading) return;

        updateActiveTab({ loading: true, viewMode: explain ? 'explain' : 'table', page: 0, filterTerm: '' });

        const startTime = performance.now();
        let sqlToRun = tab.code;
        if (explain && !sqlToRun.toUpperCase().startsWith('EXPLAIN')) {
            sqlToRun = `EXPLAIN ${tab.code}`;
        }

        try {
            const upper = tab.code.trim().toUpperCase();
            let type = 'QUERY';
            if (upper.startsWith('INSERT')) type = 'INSERT';
            if (upper.startsWith('UPDATE')) type = 'UPDATE';
            if (upper.startsWith('DELETE')) type = 'DELETE';
            if (upper.startsWith('CREATE')) type = 'CREATE';
            if (upper.startsWith('DROP')) type = 'DELETE';
            if (upper.startsWith('ALTER')) type = 'ALTER';
            if (upper.startsWith('PIVOT')) type = 'QUERY';

            const tableMatch = tab.code.match(/(?:FROM|INTO|UPDATE|TABLE)\s+"?([a-zA-Z0-9_]+)"?/i);
            const table = tableMatch ? tableMatch[1] : null;

            let rows;
            if (explain) {
                rows = await duckDBService.query(sqlToRun);
            } else {
                rows = await duckDBService.executeAndAudit(sqlToRun, type, table, 'Executed via SQL Editor');
            }

            const endTime = performance.now();

            if (type === 'CREATE' || type === 'DROP' || type === 'ALTER') {
                refreshSchema();
            }

            const columns = rows.length > 0 ? Object.keys(rows[0]) : [];



            updateActiveTab({
                result: {
                    columns,
                    rows,
                    executionTime: endTime - startTime,
                    isExplain: explain
                },
                loading: false
            });

            if (!explain) saveToHistory(tab.code, 'success', endTime - startTime);
            onRun();

        } catch (e: any) {
            updateActiveTab({
                result: { columns: [], rows: [], executionTime: 0, error: e.message },
                loading: false
            });
            if (!explain) saveToHistory(tab.code, 'error', 0);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            execute();
        }
        // Ctrl+Z 撤销快速清除（仅在存在已清除内容时触发）
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && lastClearedContent) {
            e.preventDefault();
            handleUndoClear();
        }
    };

    // --- Materialization ---
    const openMaterializeModal = (type: 'TABLE' | 'VIEW') => {
        setMaterializeType(type);
        setMaterializeName('');
        setShowMaterializeModal(true);
        setShowMaterializeMenu(false);
    };

    const handleMaterialize = async () => {
        const tab = getActiveTab();
        if (!tab || !materializeName) return;

        const sql = `CREATE ${materializeType} "${materializeName}" AS ${tab.code}`;

        try {
            updateActiveTab({ loading: true });
            await duckDBService.executeAndAudit(sql, 'CREATE', materializeName, `Materialized from SQL Editor as ${materializeType}`);
            setShowMaterializeModal(false);
            refreshSchema();
            updateActiveTab({ loading: false });
            alert(`Successfully created ${materializeType}: ${materializeName}`);
            onRun(); // Refresh global
        } catch (e: any) {
            alert(`Failed to create ${materializeType}: ${e.message}`);
            updateActiveTab({ loading: false });
        }
    };

    // --- AI & Tools ---

    // AI 一键填充 - 基于当前表/列上下文
    const handleAIFill = useCallback(() => {
        const tab = getActiveTab();
        if (!tab) return;

        // 从 SQL 中解析表名
        const tableMatch = tab.code.match(/(?:FROM|INTO|UPDATE|TABLE)\s+"?([a-zA-Z0-9_]+)"?/i);
        const currentTable = tableMatch ? tableMatch[1] : '';
        const currentColumns = currentTable ? schemaTree[currentTable] : undefined;

        const prompt = generateAIFillPrompt(selectedSqlType, currentTable, currentColumns);

        // 生成智能填充的 SQL 示例（上下文感知）
        let filledSql = '';
        const tbl = currentTable || 'table_name';
        const hasCols = currentColumns && currentColumns.length > 0;
        const cols5 = hasCols ? currentColumns!.slice(0, 5).map(c => c.name) : ['col1', 'col2', 'col3'];
        const allCols = hasCols ? currentColumns!.map(c => c.name) : [];
        const timeCol = allCols.find(c => /date|time|created|updated|ts|at/i.test(c)) || 'created_at';
        const numCol = allCols.find(c => /amount|count|total|sum|value|price|qty/i.test(c)) || 'amount';
        const idCol = allCols.find(c => /^id$|_id$/i.test(c)) || 'id';

        switch (selectedSqlType) {
            case 'select':
                filledSql = hasCols
                    ? `SELECT ${cols5.join(', ')}\nFROM ${tbl}\nWHERE 1=1\n  -- AND ${cols5[0]} = 'value'\nORDER BY ${idCol} DESC\nLIMIT 100;`
                    : `SELECT column1, column2\nFROM ${tbl}\nWHERE condition\nORDER BY id DESC\nLIMIT 100;`;
                break;
            case 'join':
                filledSql = `SELECT\n    t1.${idCol},\n    t1.${cols5[0] || 'col1'},\n    t2.related_col\nFROM ${tbl} t1\nLEFT JOIN other_table t2\n    ON t1.${idCol} = t2.${tbl}_id\nWHERE t1.${timeCol} >= current_date - interval '30 day'\nLIMIT 100;`;
                break;
            case 'aggregate':
                filledSql = `SELECT\n    date_trunc('day', ${timeCol}) AS date,\n    COUNT(*)               AS row_count,\n    COUNT(DISTINCT ${idCol}) AS unique_count,\n    SUM(${numCol})         AS total_${numCol}\nFROM ${tbl}\nWHERE ${timeCol} >= current_date - interval '30 day'\nGROUP BY 1\nORDER BY 1 DESC;`;
                break;
            case 'transform':
                filledSql = `-- 数据转换 / 清洗示例\nSELECT\n    TRY_CAST(${timeCol} AS DATE)              AS date_clean,\n    TRIM(LOWER(${cols5[0] || 'text_col'}))    AS text_clean,\n    COALESCE(${numCol}, 0)                    AS ${numCol}_filled\nFROM ${tbl}\nWHERE ${numCol} IS NOT NULL;\n\n-- 列转行示例（UNPIVOT）\n-- UNPIVOT ${tbl}\n-- ON (${cols5.slice(0, 3).join(', ')})\n-- INTO NAME metric VALUE value;`;
                break;
            case 'performance':
                filledSql = `-- 执行计划诊断：在原始查询前加 EXPLAIN ANALYZE\nEXPLAIN ANALYZE\nSELECT ${cols5.slice(0, 3).join(', ')}\nFROM ${tbl}\nWHERE ${timeCol} >= current_date - interval '7 day'\nLIMIT 1000;\n\n-- 执行后在结果区点击「Plan」标签查看详细计划`;
                break;
            case 'utilities':
                filledSql = `-- 数据摘要统计（一行搞定）\nSUMMARIZE ${tbl};\n\n-- 数据质量检查\nSELECT 'null_check'   AS check_type, COUNT(*) FILTER (WHERE ${cols5[0] || 'col1'} IS NULL) AS issues FROM ${tbl}\nUNION ALL\nSELECT 'dup_check',   COUNT(*) - COUNT(DISTINCT ${idCol}) FROM ${tbl}\nUNION ALL\nSELECT 'total_rows',  COUNT(*) FROM ${tbl};\n\n-- 随机抽样 100 行（固定种子可重现）\n-- CALL setseed(0.42);\n-- SELECT * FROM ${tbl} USING SAMPLE 100 ROWS;`;
                break;
            default:
                filledSql = `SELECT * FROM ${tbl} LIMIT 10;`;
        }

        updateActiveTab({ code: filledSql });
        showToast(`已填充「${SQL_CATEGORY_HELP[selectedSqlType]?.title || selectedSqlType}」模板`, 'success');
    }, [selectedSqlType, schemaTree, showToast]);

    // 快速清除 - 清空当前编辑器内容 + AI 输入框
    const handleClear = useCallback(() => {
        const tab = getActiveTab();
        if (!tab) return;

        // 同时保存 SQL 内容与 AI 输入框，以便撤销
        setLastClearedContent({ sql: tab.code, aiInput: aiPrompt });
        updateActiveTab({ code: '' });
        setAiPrompt('');
        showToast('已清除 SQL 与 AI 输入，Ctrl+Z 可撤销', 'info');
    }, [aiPrompt, showToast]);

    // 撤销清除 - 同时恢复 SQL 内容与 AI 输入框
    const handleUndoClear = useCallback(() => {
        const tab = getActiveTab();
        if (!tab || !lastClearedContent) return;

        updateActiveTab({ code: lastClearedContent.sql });
        setAiPrompt(lastClearedContent.aiInput);
        setLastClearedContent(null);
        showToast('已恢复清除前的内容（SQL + AI 输入）', 'success');
    }, [lastClearedContent, showToast]);

    // 实时预览 - 基于当前输入生成 SQL 预览
    const generateLivePreview = useCallback(async () => {
        const tab = getActiveTab();
        if (!tab || !tab.code.trim()) {
            setLiveSqlPreview('// 请输入 SQL 以预览');
            return;
        }

        // 基本语法验证和格式化
        setIsGeneratingPreview(true);
        try {
            const formatted = format(tab.code, {
                language: 'postgresql',
                keywordCase: 'upper',
                linesBetweenQueries: 2
            });
            setLiveSqlPreview(formatted);
        } catch {
            setLiveSqlPreview(tab.code);
        } finally {
            setIsGeneratingPreview(false);
        }
    }, []);

    // 防抖实时预览
    useEffect(() => {
        if (!showLivePreview) return;

        if (previewDebounceRef.current) {
            clearTimeout(previewDebounceRef.current);
        }

        previewDebounceRef.current = setTimeout(() => {
            generateLivePreview();
        }, 500);

        return () => {
            if (previewDebounceRef.current) {
                clearTimeout(previewDebounceRef.current);
            }
        };
    }, [tabs, activeTabId, showLivePreview, generateLivePreview]);

    // AI 建议生成
    const handleAISuggestion = useCallback(async () => {
        if (!aiSuggestion.trim()) return;

        setIsGeneratingSuggestion(true);

        try {
            const tables = await duckDBService.getTables();
            let schemaStr = '';
            for (const t of tables) {
                const cols = await duckDBService.getTableSchema(t);
                const colStr = cols.map(c => `${c.name} (${c.type})`).join(', ');
                schemaStr += `Table ${t}: [${colStr}]\n`;
            }

            const sql = await aiService.generateSql(aiSuggestion, schemaStr);
            updateActiveTab({ code: sql });
            setAiSuggestion('');
        } catch (e) {
            console.error(e);
        } finally {
            setIsGeneratingSuggestion(false);
        }
    }, [aiSuggestion]);

    // 复制功能
    const handleCopy = (text: string, fieldName: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(fieldName);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const formatSql = () => {
        const tab = getActiveTab();
        if (!tab) return;
        try {
            const formatted = format(tab.code, {
                language: 'postgresql', // DuckDB is Postgres-compatible enough for formatting
                keywordCase: 'upper',
                linesBetweenQueries: 2
            });
            updateActiveTab({ code: formatted });
        } catch (e) {
            console.error("Formatting failed", e);
            // Fallback to basic trimming if formatter fails
            updateActiveTab({ code: tab.code.trim() });
        }
    };

    const handleAiGenerate = async () => {
        if (!aiPrompt.trim()) return;
        setIsAiLoading(true);
        try {
            const tables = await duckDBService.getTables();
            let schemaStr = "";
            for (const t of tables) {
                const cols = await duckDBService.getTableSchema(t);
                const colStr = cols.map(c => `${c.name} (${c.type})`).join(', ');
                schemaStr += `Table ${t}: [${colStr}]\n`;
            }
            const sql = await aiService.generateSql(aiPrompt, schemaStr);
            // 记录 AI 优化历史
            setAiOptimizationHistory(prev => [...prev.slice(-4), { sql, timestamp: Date.now() }]);
            updateActiveTab({ code: sql });
        } catch (e) { console.error(e); }
        finally { setIsAiLoading(false); }
    };

    // AI 二次优化 - 基于已有 SQL 继续优化
    const handleAiContinueOptimize = async (optimizationType: string) => {
        const tab = getActiveTab();
        if (!tab || !tab.code.trim()) return;

        setIsAiLoading(true);
        try {
            const tables = await duckDBService.getTables();
            let schemaStr = "";
            for (const t of tables) {
                const cols = await duckDBService.getTableSchema(t);
                const colStr = cols.map(c => `${c.name} (${c.type})`).join(', ');
                schemaStr += `Table ${t}: [${colStr}]\n`;
            }

            const optimizationPrompts: Record<string, string> = {
                'improve': `请优化以下 SQL，提升性能和可读性。直接返回优化后的 SQL 代码，不要包含其他说明文字：\n\n${tab.code}`,
                'explain': `请详细解释以下 SQL 查询的作用、计算逻辑和数据指标。请使用 Markdown 格式返回，每个要点单独一行，格式示例：\n\n## 查询目的\n该查询的目的是...\n\n## 使用的表和字段\n- 表：xxx\n- 字段：xxx\n\n## 主要计算逻辑\n...（详细说明）\n\n## 输出结果\n...（代表什么含义）\n\n**注意**：标题和内容必须分开两行，列表项格式为 "- 项目：内容"，不要把标题和内容写在同一行。\n\nSQL: ${tab.code}`,
                'adapt': `请将以下 SQL 适配到 DuckDB 语法，利用 DuckDB 特有功能（如 SUMMARIZE、PIVOT、UNPIVOT、USING SAMPLE 等）优化。直接返回优化后的 SQL 代码：\n\n${tab.code}`,
            };

            const prompt = optimizationPrompts[optimizationType] || optimizationPrompts['improve'];
            const aiResult = await aiService.generateSql(prompt, schemaStr);

            // 解释功能显示在弹窗中，不覆盖 SQL
            if (optimizationType === 'explain') {
                // 保存到持久化存储
                const explanationRecord: AiExplanation = {
                    id: `explain_${Date.now()}`,
                    sql: tab.code,
                    explanation: aiResult,
                    createdAt: Date.now()
                };
                await saveExplanation(explanationRecord);
                const history = await getAllExplanations();
                setAiExplanationHistory(history);
                setAiExplanation(aiResult);
                setShowAiExplanation(true);
            } else {
                // 优化和适配功能更新 SQL
                setAiOptimizationHistory(prev => [...prev.slice(-4), { sql: aiResult, timestamp: Date.now() }]);
                updateActiveTab({ code: aiResult });
                showToast(optimizationType === 'improve' ? 'SQL 优化完成' : 'DuckDB 适配完成', 'success');
            }
        } catch (e) { console.error(e); }
        finally { setIsAiLoading(false); }
    };

    const handleAiFix = async () => {
        const tab = getActiveTab();
        if (!tab || !tab.result?.error) return;
        setIsFixing(true);
        try {
            const tables = await duckDBService.getTables();
            let schemaStr = "";
            for (const t of tables) {
                const cols = await duckDBService.getTableSchema(t);
                schemaStr += `Table ${t}: [${cols.map(c => c.name).join(',')}]\n`;
            }
            const fixedSql = await aiService.fixSql(tab.code, tab.result.error, schemaStr);
            updateActiveTab({ code: fixedSql });
        } catch (e) { console.error(e); }
        finally { setIsFixing(false); }
    };

    // --- Persistence Wrappers ---
    const saveToHistory = (sql: string, status: 'success' | 'error', duration: number = 0) => {
        const newItem: QueryHistoryItem = {
            id: crypto.randomUUID(),
            sql,
            timestamp: Date.now(),
            status,
            executionTime: duration
        };
        const updated = [newItem, ...history].slice(0, 100);
        setHistory(updated);
        localStorage.setItem('duckdb_sql_history', JSON.stringify(updated));
    };

    const clearHistory = () => {
        setHistory([]);
        localStorage.removeItem('duckdb_sql_history');
    };

    const handleSaveQuery = async () => {
        const tab = getActiveTab();
        if (!tab || !saveQueryName.trim()) return;
        const newSaved: SavedQuery = {
            id: Date.now().toString(),
            name: saveQueryName,
            sql: tab.code,
            createdAt: Date.now(),
            pinned: saveAsWidget,
            widgetType: saveAsWidget ? widgetType : undefined,
            charts: (saveAsWidget && widgetType === 'chart') ? [tab.chartConfig] : undefined
        };
        await dbService.saveQuery(newSaved);
        await loadData(); // Reload to refresh list

        setShowSaveModal(false);
        setSaveQueryName('');
        setSaveAsWidget(false);
        setActiveSidebarTab('saved');
    };

    const deleteSavedQuery = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        await dbService.deleteQuery(id);
        const updated = savedQueries.filter(q => q.id !== id);
        setSavedQueries(updated);
    };

    // --- Sidebar Helpers ---
    const insertText = (text: string) => {
        const tab = getActiveTab();
        if (tab) updateActiveTab({ code: tab.code + text });
    };

    const toggleTableExpand = (table: string) => {
        const newSet = new Set(expandedTables);
        if (newSet.has(table)) newSet.delete(table); else newSet.add(table);
        setExpandedTables(newSet);
    };

    // --- Export ---
    const generateHtmlReport = () => {
        const tab = getActiveTab();
        if (!tab || !tab.result) return;

        const chartImg = chartRef.current ? chartRef.current.toBase64Image() : null;
        const rowsHtml = tab.result.rows.slice(0, 100).map(r => `<tr>${tab.result!.columns.map(c => `<td>${r[c]}</td>`).join('')}</tr>`).join('');

        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Query Report - ${tab.title}</title>
            <style>
                body { font-family: sans-serif; padding: 20px; background: #f8f8f8; color: #333; }
                h1 { margin-bottom: 5px; }
                .meta { font-size: 12px; color: #666; margin-bottom: 20px; }
                .sql { background: #eee; padding: 15px; border-radius: 5px; font-family: monospace; white-space: pre-wrap; border: 1px solid #ddd; margin-bottom: 20px; }
                table { border-collapse: collapse; width: 100%; font-size: 12px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background: #f2f2f2; font-weight: bold; }
                .chart-container { margin-bottom: 30px; background: white; padding: 20px; border-radius: 5px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; }
                img { max-width: 100%; height: auto; }
            </style>
        </head>
        <body>
            <h1>${tab.title}</h1>
            <div class="meta">Generated on ${new Date().toLocaleString()} | Execution: ${tab.result.executionTime.toFixed(2)}ms | Rows: ${tab.result.rows.length}</div>
            
            <div class="sql">${tab.code}</div>
            
            ${chartImg ? `<div class="chart-container"><h3>Visualization</h3><img src="${chartImg}" /></div>` : ''}
            
            <h3>Data Preview (First 100 rows)</h3>
            <table>
                <thead><tr>${tab.result.columns.map(c => `<th>${c}</th>`).join('')}</tr></thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        </body>
        </html>
      `;

        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `report_${Date.now()}.html`;
        link.click();
        setShowExportMenu(false);
    };

    const downloadResult = async (format: 'csv' | 'json' | 'parquet') => {
        const tab = getActiveTab();
        if (!tab || !tab.result || !tab.result.rows.length) return;

        const fileName = `query_result_${Date.now()}.${format}`;

        try {
            if (format === 'parquet') {
                const blob = await duckDBService.exportParquet(tab.code, 'export.parquet');
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = fileName;
                link.click();
            } else {
                let content = '', mime = '';
                const replacer = (key: string, value: any) => typeof value === 'bigint' ? value.toString() : value;

                if (format === 'json') {
                    content = JSON.stringify(tab.result.rows, replacer, 2);
                    mime = 'application/json';
                } else {
                    const headers = tab.result.columns.join(',');
                    const rows = tab.result.rows.map(r =>
                        tab.result!.columns.map(c => {
                            const v = r[c];
                            const safeV = typeof v === 'bigint' ? v.toString() : v;
                            return safeV === null ? '' : `"${String(safeV).replace(/"/g, '""')}"`;
                        }).join(',')
                    ).join('\n');
                    content = `${headers}\n${rows}`;
                    mime = 'text/csv';
                }
                const blob = new Blob([content], { type: mime });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = fileName;
                link.click();
            }
            setShowExportMenu(false);
        } catch (e) { alert("Export failed. Ensure query supports export."); }
    };

    const downloadChartImage = () => {
        if (chartRef.current) {
            const link = document.createElement('a');
            link.download = `chart_${Date.now()}.png`;
            link.href = chartRef.current.toBase64Image();
            link.click();
        }
    };

    const copyToClipboard = (mode: 'tsv' | 'md' | 'html') => {
        const tab = getActiveTab();
        if (!tab || !tab.result) return;
        const { columns, rows } = tab.result;

        let text = '';
        if (mode === 'tsv') {
            text = columns.join('\t') + '\n' + rows.map(r => columns.map(c => r[c]).join('\t')).join('\n');
        } else if (mode === 'md') {
            const sep = `| ${columns.map(() => '---').join(' | ')} |`;
            const header = `| ${columns.join(' | ')} |`;
            const body = rows.map(r => `| ${columns.map(c => r[c]).join(' | ')} |`).join('\n');
            text = `${header}\n${sep}\n${body}`;
        } else if (mode === 'html') {
            const header = `<thead><tr>${columns.map(c => `<th>${c}</th>`).join('')}</tr></thead>`;
            const body = `<tbody>${rows.map(r => `<tr>${columns.map(c => `<td>${r[c]}</td>`).join('')}</tr>`).join('')}</tbody>`;
            text = `<table border="1" cellspacing="0" cellpadding="5">\n${header}\n${body}\n</table>`;
        }
        navigator.clipboard.writeText(text);
    };

    const toggleYAxis = (col: string) => {
        const tab = getActiveTab();
        if (!tab) return;
        const current = new Set(tab.chartConfig.yKeys);
        const currentRight = new Set(tab.chartConfig.yRightKeys || []);

        if (current.has(col)) current.delete(col);
        else {
            current.add(col);
            currentRight.delete(col);
        }

        updateActiveTab({ chartConfig: { ...tab.chartConfig, yKeys: Array.from(current), yRightKeys: Array.from(currentRight) } });
    };

    const toggleYRightAxis = (col: string) => {
        const tab = getActiveTab();
        if (!tab) return;
        const currentRight = new Set(tab.chartConfig.yRightKeys || []);
        const currentLeft = new Set(tab.chartConfig.yKeys);

        if (currentRight.has(col)) currentRight.delete(col);
        else {
            currentRight.add(col);
            currentLeft.delete(col);
        }

        updateActiveTab({ chartConfig: { ...tab.chartConfig, yRightKeys: Array.from(currentRight), yKeys: Array.from(currentLeft) } });
    };

    // --- Rendering Helpers ---
    const activeTab = getActiveTab();

    // 自动刷新定时器
    useEffect(() => {
        if (autoRefreshInterval <= 0 || !activeTab?.code) return;

        const interval = setInterval(() => {
            onRun();
        }, autoRefreshInterval * 1000);

        return () => clearInterval(interval);
    }, [autoRefreshInterval, activeTab?.code, onRun]);

    if (!activeTab) {
        return <div className="flex flex-col h-full items-center justify-center text-monokai-comment">Loading...</div>;
    }

    const allRows = activeTab.result?.rows || [];
    const filteredRows = activeTab.filterTerm
        ? allRows.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(activeTab.filterTerm.toLowerCase())))
        : allRows;

    const paginatedRows = filteredRows.slice(activeTab.page * PAGE_SIZE, (activeTab.page + 1) * PAGE_SIZE);
    const maxPage = filteredRows.length > 0 ? Math.ceil(filteredRows.length / PAGE_SIZE) - 1 : 0;



    const filteredHistory = history.filter(h => h.sql.toLowerCase().includes(historyFilter.toLowerCase()));

    return (
        <div className="flex flex-col h-full gap-4 relative">
            {/* Toast 状态提示 */}
            {toast && (
                <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-2xl text-sm font-medium transition-all animate-[fadeIn_0.2s] border ${toast.type === 'success' ? 'bg-monokai-green/20 border-monokai-green/50 text-monokai-green' :
                        toast.type === 'warning' ? 'bg-monokai-yellow/20 border-monokai-yellow/50 text-monokai-yellow' :
                            'bg-monokai-blue/20 border-monokai-blue/50 text-monokai-blue'
                    }`}>
                    {toast.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> :
                        toast.type === 'warning' ? <AlertTriangle className="w-4 h-4 shrink-0" /> :
                            <Info className="w-4 h-4 shrink-0" />}
                    <span>{toast.message}</span>
                </div>
            )}
            {/* 保存查询模态框 */}
            {showSaveModal && (
                <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-[fadeIn_0.2s]">
                    <div className="bg-monokai-sidebar border border-monokai-accent rounded-xl shadow-2xl w-[400px] overflow-hidden animate-[slideIn_0.25s_ease-out]">
                        {/* 头部 */}
                        <div className="flex items-center justify-between px-5 py-4 bg-monokai-bg border-b border-monokai-accent">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-monokai-green/20 flex items-center justify-center">
                                    <Save className="w-4 h-4 text-monokai-green" />
                                </div>
                                <h3 className="text-base font-bold text-monokai-fg">保存查询</h3>
                            </div>
                            <button
                                onClick={() => setShowSaveModal(false)}
                                className="w-7 h-7 rounded-lg hover:bg-monokai-accent flex items-center justify-center text-monokai-comment hover:text-monokai-fg transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* 内容 */}
                        <div className="p-5 space-y-4">
                            {/* 查询名称输入 */}
                            <div>
                                <label className="block text-xs font-medium text-monokai-comment mb-2">查询名称</label>
                                <input
                                    autoFocus
                                    value={saveQueryName}
                                    onChange={e => setSaveQueryName(e.target.value)}
                                    placeholder="输入查询名称..."
                                    className="w-full bg-monokai-bg border border-monokai-accent rounded-lg px-3 py-2.5 text-sm text-monokai-fg placeholder-monokai-comment/50 outline-none focus:border-monokai-green/50 focus:ring-1 focus:ring-monokai-green/20 transition-all"
                                />
                            </div>

                            {/* 固定到仪表板选项 */}
                            <div className="p-4 bg-monokai-bg/50 border border-monokai-accent/50 rounded-lg">
                                <label className="flex items-center justify-between cursor-pointer">
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            checked={saveAsWidget}
                                            onChange={e => setSaveAsWidget(e.target.checked)}
                                            className="w-4 h-4 rounded border-monokai-accent bg-monokai-bg text-monokai-green focus:ring-monokai-green/30"
                                        />
                                        <div>
                                            <span className="text-sm font-medium text-monokai-fg">固定到仪表板</span>
                                            <p className="text-[10px] text-monokai-comment mt-0.5">将此查询添加为小部件显示</p>
                                        </div>
                                    </div>
                                </label>

                                {/* Widget 类型选择 */}
                                {saveAsWidget && (
                                    <div className="mt-4 pl-7">
                                        <label className="block text-xs text-monokai-comment mb-2">小部件类型</label>
                                        <select
                                            value={widgetType}
                                            onChange={(e: any) => setWidgetType(e.target.value)}
                                            className="w-full bg-monokai-bg border border-monokai-accent rounded-lg px-3 py-2 text-sm text-monokai-fg outline-none focus:border-monokai-green/50"
                                        >
                                            <option value="table">迷你表格</option>
                                            <option value="value">单值显示</option>
                                            <option value="chart">图表</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 底部按钮 */}
                        <div className="flex justify-end gap-3 px-5 py-4 bg-monokai-bg border-t border-monokai-accent">
                            <button
                                onClick={() => setShowSaveModal(false)}
                                className="px-4 py-2 text-sm font-medium text-monokai-comment hover:text-monokai-fg hover:bg-monokai-accent rounded-lg transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleSaveQuery}
                                disabled={!saveQueryName.trim()}
                                className="px-5 py-2 bg-monokai-green text-monokai-bg font-bold rounded-lg text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                            >
                                <Save size={14} />
                                保存查询
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* AI 解释弹窗 */}
            {showAiExplanation && (
                <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-[fadeIn_0.2s]">
                    <div className="bg-monokai-sidebar border border-monokai-accent rounded-xl shadow-2xl w-[600px] max-h-[80vh] overflow-hidden animate-[slideIn_0.25s_ease-out]">
                        {/* 头部 */}
                        <div className="flex items-center justify-between px-5 py-4 bg-monokai-bg border-b border-monokai-accent">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-monokai-purple/20 flex items-center justify-center">
                                    <Zap className="w-4 h-4 text-monokai-purple" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-monokai-fg">SQL 解释</h3>
                                    <p className="text-[10px] text-monokai-comment">当前查询的作用和计算逻辑</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowAiExplanation(false)}
                                className="w-7 h-7 rounded-lg hover:bg-monokai-accent flex items-center justify-center text-monokai-comment hover:text-monokai-fg transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* 原始 SQL */}
                        <div className="px-5 py-3 bg-monokai-bg/50 border-b border-monokai-accent/50">
                            <div className="flex items-center gap-2 mb-2">
                                <Code className="w-3 h-3 text-monokai-comment" />
                                <span className="text-[10px] font-medium text-monokai-comment">原始 SQL</span>
                            </div>
                            <pre className="text-xs text-monokai-fg/80 font-mono whitespace-pre-wrap bg-monokai-bg p-3 rounded-lg border border-monokai-accent/30 max-h-24 overflow-auto">
                                {activeTab.code}
                            </pre>
                        </div>

                        {/* 解释内容 */}
                        <div className="p-5 overflow-auto max-h-[50vh] text-sm text-monokai-fg">
                            <ReactMarkdown 
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    h1: ({children}) => <h1 className="text-lg font-bold text-monokai-purple mb-3 mt-2">{children}</h1>,
                                    h2: ({children}) => <h2 className="text-base font-bold text-monokai-blue mb-2 mt-3">{children}</h2>,
                                    h3: ({children}) => <h3 className="text-sm font-semibold text-monokai-purple mb-1 mt-2">{children}</h3>,
                                    p: ({children}) => <p className="mb-2 leading-relaxed">{children}</p>,
                                    ul: ({children}) => <ul className="list-disc list-inside mb-2 space-y-1 ml-2">{children}</ul>,
                                    ol: ({children}) => <ol className="list-decimal list-inside mb-2 space-y-1 ml-2">{children}</ol>,
                                    li: ({children}) => <li className="text-monokai-fg/90 mb-1">{children}</li>,
                                    strong: ({children}) => <strong className="text-monokai-pink font-semibold">{children}</strong>,
                                    em: ({children}) => <em className="text-monokai-yellow">{children}</em>,
                                    code: ({className, children, ...props}) => {
                                        const match = /language-(\w+)/.exec(className || '');
                                        const isInline = !match && !className;
                                        if (isInline) {
                                            return <code className="bg-monokai-bg px-1.5 py-0.5 rounded text-monokai-purple text-xs font-mono">{children}</code>;
                                        }
                                        return <code className="block bg-monokai-bg p-3 rounded-lg border border-monokai-accent/30 text-xs font-mono overflow-x-auto mb-2" {...props}>{children}</code>;
                                    },
                                    pre: ({children}) => <pre className="mb-2">{children}</pre>,
                                    a: ({href, children}) => <a href={href} className="text-monokai-blue hover:underline">{children}</a>,
                                    blockquote: ({children}) => <blockquote className="border-l-4 border-monokai-purple pl-3 italic text-monokai-comment mb-2">{children}</blockquote>,
                                }}
                            >
                                {aiExplanation}
                            </ReactMarkdown>
                        </div>

                        {/* 底部按钮 */}
                        <div className="flex justify-between items-center px-5 py-4 bg-monokai-bg border-t border-monokai-accent">
                            <div className="flex gap-2">
                                {aiExplanationHistory.length > 0 && (
                                    <button
                                        onClick={async () => {
                                            if (confirm('确定要清除所有解释历史吗？')) {
                                                await clearAllExplanations();
                                                setAiExplanationHistory([]);
                                            }
                                        }}
                                        className="px-3 py-1.5 text-xs font-medium text-monokai-red hover:bg-monokai-red/20 rounded-lg transition-colors"
                                    >
                                        清除历史
                                    </button>
                                )}
                            </div>
                            <button
                                onClick={() => setShowAiExplanation(false)}
                                className="px-4 py-2 text-sm font-medium text-monokai-comment hover:text-monokai-fg hover:bg-monokai-accent rounded-lg transition-colors"
                            >
                                关闭
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* 物化模态框 */}
            {showMaterializeModal && (
                <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-[fadeIn_0.2s]">
                    <div className="bg-monokai-sidebar border border-monokai-accent rounded-xl shadow-2xl w-[400px] overflow-hidden animate-[slideIn_0.25s_ease-out]">
                        {/* 头部 */}
                        <div className="flex items-center justify-between px-5 py-4 bg-monokai-bg border-b border-monokai-accent">
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${materializeType === 'TABLE' ? 'bg-monokai-blue/20' : 'bg-monokai-purple/20'}`}>
                                    <Database className={`w-4 h-4 ${materializeType === 'TABLE' ? 'text-monokai-blue' : 'text-monokai-purple'}`} />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-monokai-fg">创建 {materializeType === 'TABLE' ? '表' : '视图'}</h3>
                                    <p className="text-[10px] text-monokai-comment">将查询结果持久化存储</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowMaterializeModal(false)}
                                className="w-7 h-7 rounded-lg hover:bg-monokai-accent flex items-center justify-center text-monokai-comment hover:text-monokai-fg transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* 内容 */}
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-monokai-comment mb-2">
                                    {materializeType === 'TABLE' ? '表名称' : '视图名称'}
                                </label>
                                <input
                                    autoFocus
                                    value={materializeName}
                                    onChange={e => setMaterializeName(e.target.value)}
                                    placeholder={`输入${materializeType === 'TABLE' ? '表' : '视图'}名称...`}
                                    className="w-full bg-monokai-bg border border-monokai-accent rounded-lg px-3 py-2.5 text-sm text-monokai-fg placeholder-monokai-comment/50 outline-none focus:border-monokai-purple/50 focus:ring-1 focus:ring-monokai-purple/20 transition-all"
                                />
                            </div>

                            {/* SQL 预览 */}
                            <div className="p-3 bg-monokai-bg/50 border border-monokai-accent/50 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <Code className="w-3 h-3 text-monokai-comment" />
                                    <span className="text-[10px] font-medium text-monokai-comment">SQL 预览</span>
                                </div>
                                <pre className="text-[10px] text-monokai-fg/70 font-mono truncate">
                                    CREATE {materializeType} "{materializeName || 'name'}" AS ...
                                </pre>
                            </div>
                        </div>

                        {/* 底部按钮 */}
                        <div className="flex justify-end gap-3 px-5 py-4 bg-monokai-bg border-t border-monokai-accent">
                            <button
                                onClick={() => setShowMaterializeModal(false)}
                                className="px-4 py-2 text-sm font-medium text-monokai-comment hover:text-monokai-fg hover:bg-monokai-accent rounded-lg transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleMaterialize}
                                disabled={!materializeName.trim()}
                                className="px-5 py-2 bg-monokai-purple text-monokai-bg font-bold rounded-lg text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                            >
                                <Database size={14} />
                                创建 {materializeType === 'TABLE' ? '表' : '视图'}
                            </button>
                        </div>
                    </div>
                </div>
            )}


            <div className="flex flex-1 min-h-0 gap-4">
                <div className="flex flex-col gap-0 flex-1 min-w-0">
                    {/* Editor Area with Tabs */}
                    <div
                        className="flex flex-col gap-0 min-h-[100px] border border-monokai-accent rounded-t-lg bg-monokai-bg overflow-hidden shadow-2xl relative"
                        style={{ height: `${editorHeightPercent}%` }}
                        ref={editorContainerRef}
                    >
                        {/* Tabs */}
                        <div className="flex items-end bg-monokai-surface pt-2 px-2 gap-1 overflow-x-auto scrollbar-hide border-b border-monokai-accent">
                            {tabs.map(tab => {
                                const isActive = activeTabId === tab.id;
                                return (
                                    <div
                                        key={tab.id}
                                        className={`group relative flex items-center gap-2 px-4 py-2 text-xs cursor-pointer min-w-[140px] max-w-[200px] select-none transition-all rounded-t-md border-t border-l border-r ${isActive ? 'bg-monokai-bg border-monokai-accent z-10 text-monokai-fg font-bold' : 'bg-monokai-sidebar border-transparent text-monokai-comment hover:bg-monokai-accent'}`}
                                        onClick={() => setActiveTabId(tab.id)}
                                        onDoubleClick={() => handleTitleDoubleClick(tab)}
                                    >
                                        <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-monokai-green' : 'bg-monokai-comment/30'}`}></div>
                                        {editingTitleId === tab.id ? (
                                            <input autoFocus value={tempTitle} onChange={e => setTempTitle(e.target.value)} onBlur={saveTitle} onKeyDown={e => e.key === 'Enter' && saveTitle()} className="bg-transparent text-monokai-fg outline-none w-full" />
                                        ) : (
                                            <span className="truncate flex-1">{tab.title}</span>
                                        )}
                                        <button onClick={(e) => closeTab(tab.id, e)} className="opacity-0 group-hover:opacity-100 hover:text-monokai-pink font-bold ml-1">×</button>
                                        {isActive && <div className="absolute bottom-[-1px] left-0 right-0 h-1 bg-monokai-bg z-20"></div>}
                                    </div>
                                )
                            })}
                            <button onClick={createNewTab} className="px-3 py-1.5 text-monokai-comment hover:text-monokai-fg font-bold text-lg opacity-50 hover:opacity-100 transition-opacity h-[29px] flex items-end">+</button>
                        </div>

                        {/* Toolbar - 第一行：SQL编辑控制 */}
                        <div className="flex justify-between items-center p-2 bg-monokai-bg border-b border-monokai-accent z-50 gap-2 flex-wrap overflow-visible">
                            <div className="flex gap-2 items-center flex-wrap overflow-visible">
                                {/* 撤销清除 */}
                                {lastClearedContent && (
                                    <button
                                        onClick={handleUndoClear}
                                        className="flex items-center gap-1.5 px-2 py-1 bg-monokai-blue/10 border border-monokai-blue/40 hover:bg-monokai-blue/20 text-monokai-blue text-xs font-medium rounded transition-colors"
                                        title="撤销上一次清除（恢复 SQL + AI 输入）"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                    </button>
                                )}

                                <button onClick={() => execute(false)} disabled={activeTab.loading} className={`px-4 py-1.5 bg-monokai-green text-monokai-bg font-bold rounded text-xs hover:opacity-90 disabled:opacity-50 transition-transform active:scale-95 flex items-center gap-2 ${activeTab.loading ? 'animate-pulse' : ''}`}>
                                    <Play size={12} /> 运行
                                </button>
                                <div className="relative">
                                    <button
                                        onClick={() => setShowSnippetsMenu(!showSnippetsMenu)}
                                        className="px-3 py-1.5 bg-monokai-yellow/10 border border-monokai-yellow/30 text-monokai-yellow hover:bg-monokai-yellow/20 text-xs font-bold rounded flex items-center gap-1.5 transition-colors"
                                    >
                                        <Code size={12} /> 片段 <ChevronDown size={10} />
                                    </button>
                                    {showSnippetsMenu && (
                                        <div className="absolute top-full left-0 mt-1 bg-monokai-sidebar border border-monokai-accent rounded shadow-xl z-50 min-w-[240px] max-h-80 overflow-y-auto custom-scrollbar">
                                            {Object.entries(SNIPPET_GROUPS).map(([groupName, snippets]) => (
                                                <div key={groupName} className="border-b border-monokai-accent/20">
                                                    {/* 分类标题 - 可点击展开/折叠 */}
                                                    <button
                                                        className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold uppercase tracking-wider bg-monokai-bg/80 hover:bg-monokai-yellow/10 transition-colors"
                                                        onClick={() => setExpandedSnippetCategory(expandedSnippetCategory === groupName ? null : groupName)}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <span>{SNIPPET_CATEGORY_META[groupName]?.icon || '📦'}</span>
                                                            <span className={SNIPPET_CATEGORY_META[groupName]?.color || 'text-monokai-yellow/70'}>{groupName}</span>
                                                            <span className="text-monokai-comment/50 text-[9px] normal-case tracking-normal">
                                                                ({Object.keys(snippets).length})
                                                            </span>
                                                        </div>
                                                        <ChevronDown
                                                            size={10}
                                                            className={`transition-transform ${expandedSnippetCategory === groupName ? 'rotate-180' : ''}`}
                                                        />
                                                    </button>
                                                    {/* 分类描述 */}
                                                    {expandedSnippetCategory === groupName && SNIPPET_CATEGORY_META[groupName]?.description && (
                                                        <div className="px-3 py-1 text-[9px] text-monokai-comment/60 bg-monokai-bg/40">
                                                            {SNIPPET_CATEGORY_META[groupName].description}
                                                        </div>
                                                    )}
                                                    {/* 片段列表 - 仅在展开时显示 */}
                                                    {expandedSnippetCategory === groupName && (
                                                        <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                                            {Object.entries(snippets).map(([label, snippet]) => (
                                                                <div
                                                                    key={label}
                                                                    className="relative"
                                                                    onMouseEnter={() => setHoveredSnippet({ label, sql: snippet })}
                                                                    onMouseLeave={() => setHoveredSnippet(null)}
                                                                >
                                                                    <button
                                                                        className="w-full text-left px-4 py-2 text-xs text-monokai-fg hover:bg-monokai-yellow/10 hover:text-monokai-yellow transition-colors flex items-center gap-2"
                                                                        onClick={() => { insertText(snippet); setShowSnippetsMenu(false); }}
                                                                    >
                                                                        <Code className="w-3 h-3 text-monokai-yellow/40 shrink-0" />
                                                                        {label}
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                            {/* 底部提示 */}
                                            <div className="px-3 py-2 text-[9px] text-monokai-comment/60 bg-monokai-bg/60 border-t border-monokai-accent/30 sticky bottom-0">
                                                💡 悬停片段可预览 SQL • 点击插入编辑器
                                            </div>
                                        </div>
                                    )}
                                    {showSnippetsMenu && <div className="fixed inset-0 z-40" onClick={() => setShowSnippetsMenu(false)} />}
                                </div>

                                {/* AI Skills Button */}
                                <button 
                                    onClick={() => setShowSkillAssistant(true)}
                                    className="px-3 py-1.5 bg-monokai-purple/10 border border-monokai-purple/30 text-monokai-purple hover:bg-monokai-purple/20 text-xs font-bold rounded flex items-center gap-1.5 transition-colors"
                                >
                                    <Sparkles size={12} /> AI 技能
                                </button>

                                <div className="relative">
                                    <button onClick={() => setShowMaterializeMenu(!showMaterializeMenu)} className="px-3 py-1.5 text-xs border border-monokai-purple text-monokai-purple hover:bg-monokai-purple hover:text-monokai-fg rounded transition-colors flex items-center gap-1.5">
                                        <Save size={12} /> 物化 <ChevronDown size={10} />
                                    </button>
                                    {showMaterializeMenu && (
                                        <div className="absolute top-full right-0 mt-1 bg-monokai-sidebar border border-monokai-accent rounded shadow-xl z-50 min-w-[150px]">
                                            <button onClick={() => openMaterializeModal('TABLE')} className="w-full text-left px-4 py-2 text-xs text-monokai-fg hover:bg-monokai-accent hover:text-monokai-blue transition-colors">存为表</button>
                                            <button onClick={() => openMaterializeModal('VIEW')} className="w-full text-left px-4 py-2 text-xs text-monokai-fg hover:bg-monokai-accent hover:text-monokai-blue transition-colors">存为视图</button>
                                        </div>
                                    )}
                                    {showMaterializeMenu && <div className="fixed inset-0 z-40" onClick={() => setShowMaterializeMenu(false)} />}
                                </div>
                                <button onClick={formatSql} className="text-xs text-monokai-yellow hover:text-monokai-fg px-2 py-1 flex items-center gap-1"><Type size={12} /> 格式化</button>
                                <button onClick={() => setShowSaveModal(true)} className="text-xs text-monokai-orange hover:text-monokai-fg px-2 py-1 flex items-center gap-1"><Save size={12} /> 保存</button>
                                <button
                                    onClick={handleClear}
                                    className="text-xs text-monokai-pink hover:text-monokai-fg px-2 py-1 flex items-center gap-1"
                                    title="一键清空 SQL 编辑器与 AI 输入框（Ctrl+Z 可撤销）"
                                >
                                    <Trash2 size={12} /> 清除
                                </button>
                                <button
                                    onClick={onToggleZen}
                                    className={`text-xs px-3 py-1 rounded font-bold transition-all border ${isZenMode ? 'bg-monokai-pink text-monokai-fg border-monokai-pink' : 'text-monokai-comment border-monokai-comment hover:text-monokai-fg'} flex items-center gap-1`}
                                    title="Toggle Zen Mode"
                                >
                                    {isZenMode ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                                    {isZenMode ? '退出' : '禅模式'}
                                </button>
                                <button
                                    onClick={() => setShowLivePreview(!showLivePreview)}
                                    className={`text-xs px-2 py-1 rounded font-bold transition-all border ${showLivePreview ? 'bg-monokai-purple/20 border-monokai-purple/50 text-monokai-purple' : 'text-monokai-comment border-monokai-comment hover:text-monokai-fg'} flex items-center gap-1`}
                                    title={showLivePreview ? '隐藏格式化预览' : '开启格式化预览'}
                                >
                                    {showLivePreview ? <Eye size={12} /> : <EyeOff size={12} />}
                                    预览
                                </button>
                            </div>
                        </div>

                        {/* Toolbar - 第二行：AI能力 */}
                        <div className="flex justify-between items-center p-2 bg-monokai-bg border-b border-monokai-accent z-40 gap-2 flex-wrap overflow-visible">
                            <div className="flex gap-2 items-center flex-wrap overflow-visible">
                                {/* 模式选择 */}
                                <span className="text-[10px] text-monokai-comment/60 uppercase tracking-wider shrink-0">模式</span>
                                <select
                                    value={selectedSqlType}
                                    onChange={(e) => setSelectedSqlType(e.target.value)}
                                    className="bg-monokai-bg border border-monokai-accent rounded px-2 py-1 text-xs text-monokai-fg outline-none focus:border-monokai-purple"
                                >
                                    <option value="select">SELECT</option>
                                    <option value="join">JOIN</option>
                                    <option value="aggregate">聚合</option>
                                    <option value="transform">转换</option>
                                    <option value="performance">执行</option>
                                    <option value="utilities">工具</option>
                                </select>

                                {/* AI 智能填充 */}
                                {(() => {
                                    const tab = tabs.find(t => t.id === activeTabId);
                                    const tableMatch = tab?.code.match(/(?:FROM|INTO|UPDATE|TABLE)\s+"?([a-zA-Z0-9_.]+)"?/i);
                                    const detectedTable = tableMatch?.[1];
                                    return (
                                        <button
                                            onClick={handleAIFill}
                                            className="flex items-center gap-1.5 px-2 py-1 bg-monokai-green/10 border border-monokai-green/40 hover:bg-monokai-green/20 text-monokai-green text-xs font-medium rounded transition-colors"
                                            title={detectedTable ? `基于表 ${detectedTable} 的上下文智能填充 SQL` : '基于当前表/列上下文智能填充 SQL（先在 Schema 中选择表）'}
                                        >
                                            <Sparkles className="w-3.5 h-3.5" />
                                            AI
                                            {detectedTable && (
                                                <span className="text-[10px] bg-monokai-green/20 text-monokai-green/80 px-1 py-0.5 rounded font-mono">
                                                    {detectedTable}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })()}

                                {/* 自然语言生成 */}
                                <button
                                    onClick={() => handleAiContinueOptimize('explain')}
                                    disabled={!activeTab.code.trim()}
                                    className="px-3 py-1.5 border border-monokai-purple text-monokai-purple font-bold rounded text-xs hover:bg-monokai-purple hover:text-monokai-fg disabled:opacity-40 transition-colors flex items-center gap-1.5 shrink-0"
                                    title="AI 解释当前 SQL 的作用和计算逻辑"
                                >
                                    <Zap size={12} /> 解释
                                </button>
                                <div className="flex items-center gap-1 bg-monokai-bg px-3 py-2 rounded border border-monokai-accent focus-within:border-monokai-purple/60 transition-colors flex-1 min-w-0">
                                    <span className="text-[10px] text-monokai-purple/70 font-bold uppercase tracking-wider shrink-0 whitespace-nowrap">自然语言</span>
                                    <input
                                        type="text"
                                        value={aiPrompt}
                                        onChange={(e) => setAiPrompt(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && !isAiLoading && handleAiGenerate()}
                                        placeholder="描述需求，AI 生成 SQL..."
                                        className="bg-transparent border-none focus:ring-0 text-monokai-blue placeholder-monokai-comment/60 outline-none font-mono text-xs flex-1 min-w-[370px]"
                                    />
                                    {aiPrompt && (
                                        <button
                                            onClick={() => setAiPrompt('')}
                                            className="text-monokai-comment hover:text-monokai-pink transition-colors shrink-0"
                                            title="清除输入"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    )}
                                    <button
                                        onClick={handleAiGenerate}
                                        disabled={isAiLoading || !aiPrompt.trim()}
                                        className="px-2 py-0.5 bg-monokai-purple/20 border border-monokai-purple text-monokai-purple text-xs font-bold rounded hover:bg-monokai-purple hover:text-monokai-fg transition-all disabled:opacity-40 shrink-0 flex items-center gap-1"
                                    >
                                        {isAiLoading ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                            <Wand2 className="w-3 h-3" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Code Editor */}
                        <div className="relative flex-1 overflow-auto bg-monokai-bg" onKeyDown={handleKeyDown} tabIndex={0}>
                            {showLivePreview && (
                                <div className="absolute top-0 left-0 right-0 bottom-0 z-20 flex flex-col bg-monokai-bg/95 backdrop-blur-sm">
                                    <div className="flex items-center justify-between px-3 py-2 bg-monokai-surface border-b border-monokai-accent">
                                        <div className="flex items-center gap-2">
                                            <Eye className="w-4 h-4 text-monokai-purple" />
                                            <span className="text-xs font-bold text-monokai-fg">SQL 格式化预览</span>
                                            {isGeneratingPreview && <Loader2 className="w-3 h-3 animate-spin text-monokai-purple" />}
                                        </div>
                                        <button
                                            onClick={() => setShowLivePreview(false)}
                                            className="text-xs text-monokai-comment hover:text-monokai-fg px-2 py-1"
                                        >
                                            关闭
                                        </button>
                                    </div>
                                    <pre className="flex-1 overflow-auto p-4 font-mono text-xs text-monokai-fg whitespace-pre-wrap">
                                        {liveSqlPreview || activeTab.code || '-- 输入 SQL 以查看预览'}
                                    </pre>
                                </div>
                            )}
                            <CodeMirror
                                value={activeTab.code}
                                height="100%"
                                theme="dark"
                                extensions={[
                                    sql(),
                                    EditorView.lineWrapping,
                                    EditorView.theme({
                                        "&": { backgroundColor: "#272822", color: "#f8f8f2", fontFamily: "'Victor Mono', 'Noto Sans SC', monospace", fontSize: "10px" },
                                        ".cm-gutters": { backgroundColor: "#272822", color: "#75715e", border: "none", fontSize: "10px" },
                                        ".cm-activeLine": { backgroundColor: "rgba(73, 72, 62, .15)" },
                                        ".cm-activeLineGutter": { backgroundColor: "rgba(73, 72, 62, .15)" },
                                        ".cm-content": { fontFamily: "'Victor Mono', 'Noto Sans SC', monospace", fontSize: "10px" },
                                        ".cm-line": { fontFamily: "'Victor Mono', 'Noto Sans SC', monospace", fontSize: "10px" },
                                        ".cm-tooltip-autocomplete": { fontFamily: "'Victor Mono', 'Noto Sans SC', monospace", fontSize: "10px" },
                                        ".cm-completionLabel": { fontFamily: "'Victor Mono', 'Noto Sans SC', monospace", fontSize: "10px" },
                                        ".cm-completionDetail": { fontFamily: "'Victor Mono', 'Noto Sans SC', monospace", fontSize: "10px", color: "#75715e" }
                                    }, { dark: true })
                                ]}
                                onChange={(value) => updateActiveTab({ code: value })}
                                className="h-full text-[10px]"
                                basicSetup={{
                                    lineNumbers: true,
                                    foldGutter: true,
                                    dropCursor: true,
                                    allowMultipleSelections: true,
                                    indentOnInput: true,
                                }}
                            />
                        </div>
                    </div>

                    {/* Resizer Handle */}
                    <div
                        onMouseDown={startDragging}
                        className="h-2 bg-monokai-bg hover:bg-monokai-blue cursor-row-resize z-20 flex items-center justify-center transition-colors group"
                    >
                        <div className="w-8 h-1 rounded-full bg-monokai-accent group-hover:bg-white"></div>
                    </div>

                    {/* Results Area */}
                    <div className="flex flex-col gap-0 flex-1 min-h-0 border border-monokai-accent rounded-b-lg bg-monokai-bg relative">
                        {/* View Toggles */}
                        <div className="flex justify-between items-center bg-monokai-surface p-2 border-b border-monokai-accent shrink-0">
                            <div className="flex gap-1 bg-monokai-bg p-0.5 rounded border border-monokai-accent/30">
                                <button onClick={() => updateActiveTab({ viewMode: 'table' })} className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded ${activeTab.viewMode === 'table' ? 'bg-monokai-accent text-monokai-fg shadow-sm' : 'text-monokai-comment hover:text-monokai-fg'}`}>Table</button>
                                <button onClick={() => updateActiveTab({ viewMode: 'chart' })} disabled={!activeTab.result || activeTab.result.rows.length === 0 || activeTab.result.isExplain} className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded ${activeTab.viewMode === 'chart' ? 'bg-monokai-accent text-monokai-pink shadow-sm' : 'text-monokai-comment hover:text-monokai-pink disabled:opacity-30'}`}>Chart</button>
                                {activeTab.result?.isExplain && <button onClick={() => updateActiveTab({ viewMode: 'explain' })} className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded bg-monokai-purple text-monokai-fg">Plan</button>}
                            </div>
                            {activeTab.viewMode === 'chart' && (
                                <div className="flex items-center gap-2">
                                    {/* Source indicator for metric charts */}
                                    {activeTab.charts?.some(c => c.source === 'metric') && (
                                        <span className="text-xs bg-monokai-purple/20 text-monokai-purple px-2 py-0.5 rounded flex items-center gap-1">
                                            <BarChart2 size={10} />
                                            指标图表
                                        </span>
                                    )}
                                    <button
                                        onClick={() => { setEditingChartId(null); setShowChartBuilder(true); }}
                                        className="ml-2 px-3 py-1 bg-monokai-green text-monokai-bg font-bold rounded text-[10px] uppercase tracking-wider hover:opacity-90 flex items-center gap-1 transition-transform active:scale-95"
                                    >
                                        <Plus size={12} /> New Visualization
                                    </button>
                                    <button
                                        onClick={() => onRun()}
                                        className="px-2 py-1 bg-monokai-blue/20 text-monokai-blue hover:bg-monokai-blue hover:text-monokai-bg rounded text-[10px] flex items-center gap-1"
                                        title="刷新图表数据"
                                    >
                                        <RefreshCw size={12} /> 刷新
                                    </button>
                                    <select
                                        value={autoRefreshInterval}
                                        onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                                        className="px-2 py-1 bg-monokai-bg border border-monokai-accent/30 rounded text-[10px] text-monokai-comment"
                                        title="自动刷新间隔"
                                    >
                                        <option value={0}>自动刷新: 关闭</option>
                                        <option value={5}>5秒</option>
                                        <option value={10}>10秒</option>
                                        <option value={30}>30秒</option>
                                        <option value={60}>1分钟</option>
                                        <option value={300}>5分钟</option>
                                    </select>
                                </div>
                            )}

                            {activeTab.result && !activeTab.result.error && !activeTab.result.isExplain && (
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-2 bg-monokai-sidebar border border-monokai-accent/30 rounded px-2 py-0.5 mr-2">
                                        <Search size={12} className="text-monokai-comment shrink-0" />
                                        <input
                                            className="bg-transparent border-none outline-none text-xs text-monokai-fg placeholder-monokai-comment/50 w-32 focus:w-48 transition-all"
                                            placeholder="Filter results..."
                                            value={activeTab.filterTerm}
                                            onChange={(e) => updateActiveTab({ filterTerm: e.target.value, page: 0 })}
                                        />
                                        {activeTab.filterTerm && <button onClick={() => updateActiveTab({ filterTerm: '' })} className="text-monokai-pink hover:text-monokai-fg"><X size={12} /></button>}
                                    </div>

                                    {maxPage > 0 && activeTab.viewMode === 'table' && (
                                        <div className="flex items-center gap-1 mr-2 bg-monokai-bg rounded px-1 border border-monokai-accent/30">
                                            <button onClick={() => updateActiveTab({ page: Math.max(0, activeTab.page - 1) })} disabled={activeTab.page === 0} className="text-monokai-comment hover:text-monokai-fg disabled:opacity-30 px-2 py-0.5"><ChevronLeft size={14} /></button>
                                            <span className="text-[10px] font-mono w-12 text-center text-monokai-fg">{activeTab.page + 1}/{maxPage + 1}</span>
                                            <button onClick={() => updateActiveTab({ page: Math.min(maxPage, activeTab.page + 1) })} disabled={activeTab.page === maxPage} className="text-monokai-comment hover:text-monokai-fg disabled:opacity-30 px-2 py-0.5"><ChevronRight size={14} /></button>
                                        </div>
                                    )}
                                    <div className="flex border border-monokai-accent/30 rounded overflow-hidden">
                                        <button onClick={() => copyToClipboard('tsv')} className="text-[10px] bg-monokai-sidebar hover:bg-monokai-accent px-2 py-1 border-r border-monokai-accent/30 flex items-center" title="Copy TSV"><Copy size={11} className="text-monokai-comment" /></button>
                                        <button onClick={() => copyToClipboard('md')} className="text-[10px] bg-monokai-sidebar hover:bg-monokai-accent px-2 py-1 border-r border-monokai-accent/30 flex items-center" title="Copy MD"><FileText size={11} className="text-monokai-comment" /></button>
                                        <button onClick={() => copyToClipboard('html')} className="text-[10px] bg-monokai-sidebar hover:bg-monokai-accent px-2 py-1 flex items-center" title="Copy HTML"><Globe size={11} className="text-monokai-comment" /></button>
                                    </div>
                                    <div className="relative">
                                        <button onClick={() => setShowExportMenu(!showExportMenu)} className="text-[10px] bg-monokai-blue/10 text-monokai-blue hover:bg-monokai-blue hover:text-monokai-bg px-2 py-1 rounded font-bold transition-colors">Export ▼</button>
                                        {showExportMenu && (
                                            <div className="absolute right-0 bottom-full mb-1 bg-monokai-sidebar border border-monokai-accent p-1 rounded shadow-xl z-30 min-w-[100px] flex flex-col gap-0.5">
                                                <button onClick={() => downloadResult('csv')} className="text-xs text-left px-2 py-1 hover:bg-monokai-accent rounded text-monokai-fg">CSV</button>
                                                <button onClick={() => downloadResult('json')} className="text-xs text-left px-2 py-1 hover:bg-monokai-accent rounded text-monokai-fg">JSON</button>
                                                <button onClick={() => downloadResult('parquet')} className="text-xs text-left px-2 py-1 hover:bg-monokai-accent rounded text-monokai-orange">Parquet</button>
                                                <button onClick={() => generateHtmlReport()} className="text-xs text-left px-2 py-1 hover:bg-monokai-accent rounded text-monokai-green font-bold">HTML Report</button>
                                            </div>
                                        )}
                                        {showExportMenu && <div className="fixed inset-0 z-20" onClick={() => setShowExportMenu(false)} />}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 bg-monokai-surface overflow-hidden relative">
                            {/* ... Result Content ... */}
                            {activeTab.result?.error ? (
                                <div className="p-8 flex flex-col items-center justify-center h-full text-center">
                                    <div className="text-monokai-pink font-mono mb-6 bg-monokai-surface p-6 rounded-lg border border-monokai-pink/50 max-w-2xl shadow-lg">
                                        <div className="text-xs uppercase font-bold tracking-widest mb-2 opacity-50">Error</div>
                                        {activeTab.result.error}
                                    </div>
                                    <div className="flex gap-3">
                                        <button onClick={handleAiFix} disabled={isFixing} className="px-6 py-2 bg-monokai-purple text-monokai-fg font-bold rounded shadow-lg hover:bg-monokai-purple/80 flex items-center gap-2 transition-transform active:scale-95">
                                            {isFixing ? <><Loader2 size={14} className="animate-spin" /> Analyzing...</> : <><Sparkles size={14} /> Fix with AI</>}
                                        </button>
                                        {/* AI 二次优化入口 */}
                                        <button
                                            onClick={() => handleAiContinueOptimize('improve')}
                                            disabled={isAiLoading || !activeTab.code.trim()}
                                            className="px-6 py-2 bg-monokai-green/10 border border-monokai-green/40 text-monokai-green font-bold rounded shadow-lg hover:bg-monokai-green/20 flex items-center gap-2 transition-colors disabled:opacity-40"
                                            title="基于当前 SQL 继续优化"
                                        >
                                            <Wand2 size={14} /> 继续优化
                                        </button>
                                    </div>
                                </div>
                            ) : activeTab.loading ? (
                                <div className="p-4 text-monokai-comment text-center h-full flex items-center justify-center flex-col gap-4">
                                    <div className="w-12 h-12 border-4 border-monokai-blue border-t-transparent rounded-full animate-spin"></div>
                                    <div className="animate-pulse tracking-widest text-xs uppercase font-bold">Executing Query...</div>
                                </div>
                            ) : !activeTab.result ? (
                                <div className="p-4 text-monokai-comment/30 text-center h-full flex items-center justify-center flex-col gap-4 select-none">
                                    <Terminal size={48} className="animate-bounce" />
                                    <div className="text-sm">Cmd/Ctrl + Enter to run</div>
                                    <div className="flex gap-2 text-xs">
                                        <span className="bg-monokai-sidebar px-2 py-1 rounded border border-monokai-accent">SELECT</span>
                                        <span className="bg-monokai-sidebar px-2 py-1 rounded border border-monokai-accent">FROM</span>
                                        <span className="bg-monokai-sidebar px-2 py-1 rounded border border-monokai-accent">WHERE</span>
                                    </div>
                                </div>
                            ) : activeTab.viewMode === 'explain' ? (
                                <div className="p-4 overflow-auto h-full font-mono text-sm">
                                    <pre className="text-xs text-monokai-fg bg-monokai-surface p-4 rounded border border-monokai-accent/50 whitespace-pre-wrap">{activeTab.result.rows.map(r => r['explain_value'] || r['explore_value'] || JSON.stringify(r)).join('\n')}</pre>
                                </div>
                            ) : activeTab.viewMode === 'table' ? (
                                <div className="overflow-auto h-full w-full custom-scrollbar">
                                    <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
                                        <thead className="bg-monokai-surface sticky top-0 z-10 shadow-md">
                                            <tr>
                                                {activeTab.result.columns.map(c => (
                                                    <th key={c} className="p-2 font-mono text-xs text-monokai-blue border-b border-r border-monokai-accent/50 last:border-r-0 select-none hover:bg-monokai-accent/20 transition-colors">
                                                        {c}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="font-mono text-xs">
                                            {paginatedRows.map((r, i) => (
                                                <tr key={i} className="border-b border-monokai-accent/20 hover:bg-monokai-accent/30 transition-colors even:bg-white/5">
                                                    {activeTab.result!.columns.map(c => (
                                                        <td key={c} className="p-2 text-monokai-fg border-r border-monokai-accent/20 last:border-r-0 max-w-[300px] truncate" title={String(r[c])}>
                                                            {r[c] === null ? <span className="text-monokai-comment italic">NULL</span> : String(r[c])}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                            {paginatedRows.length === 0 && (
                                                <tr><td colSpan={activeTab.result.columns.length} className="p-8 text-center text-monokai-comment">No results match your filter.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col p-4 bg-monokai-surface">
                                    {(!activeTab.charts || activeTab.charts.length === 0) ? (
                                        <div className="flex flex-col items-center justify-center h-full text-monokai-comment opacity-50">
                                            <BarChart2 size={48} className="mb-4" />
                                            <p>No visualizations yet.</p>
                                            <p className="text-xs mt-2">Click "New Visualization" above to create one.</p>
                                        </div>
                                    ) : (
                                        <ChartDashboard
                                            charts={activeTab.charts}
                                            data={activeTab.result?.rows || []}
                                            onEdit={(id) => { setEditingChartId(id); setShowChartBuilder(true); }}
                                            onDelete={(id) => {
                                                const updated = activeTab.charts.filter(c => c.id !== id);
                                                updateActiveTab({ charts: updated });
                                            }}
                                        />
                                    )}
                                </div>
                            )}

                            {/* Chart Builder Modal */}
                            {showChartBuilder && activeTab.result && (
                                <ChartBuilder
                                    columns={activeTab.result.columns}
                                    data={activeTab.result.rows}
                                    initialConfig={editingChartId ? activeTab.charts.find(c => c.id === editingChartId) : undefined}
                                    onCancel={() => setShowChartBuilder(false)}
                                    onSave={(config) => {
                                        let updatedCharts;
                                        const currentCharts = activeTab.charts || [];
                                        if (editingChartId) {
                                            updatedCharts = currentCharts.map(c => c.id === editingChartId ? config : c);
                                        } else {
                                            updatedCharts = [...currentCharts, config];
                                        }
                                        updateActiveTab({ charts: updatedCharts });
                                        setShowChartBuilder(false);
                                    }}
                                />
                            )}

                            {/* Skill Assistant Modal */}
                            {showSkillAssistant && (
                                <SkillAssistant
                                    isOpen={showSkillAssistant}
                                    onClose={() => setShowSkillAssistant(false)}
                                    onInsertSql={(sql) => insertText('\n' + sql)}
                                    currentTable={getActiveTab()?.selectedTable}
                                    currentColumns={activeTab?.result?.columns as any}
                                />
                            )}
                        </div>
                    </div>

                    {/* Footer Status Bar */}
                    {
                        activeTab.result && !activeTab.result.error && (
                            <div className="bg-monokai-surface border-t border-monokai-accent px-4 py-1.5 flex justify-between items-center text-[10px] font-mono text-monokai-comment select-none">
                                <div className="flex gap-6">
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-monokai-green shadow-[0_0_5px_rgba(166,226,46,0.5)]"></span>
                                        <span className="text-monokai-green font-bold">Success</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Table size={11} className="text-monokai-comment" />
                                        <span className="text-monokai-fg">
                                            <span className="text-monokai-fg font-bold">{filteredRows.length}</span> rows
                                            {filteredRows.length !== allRows.length && <span className="opacity-50"> (filtered from {allRows.length})</span>}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Clock size={11} className="text-monokai-comment" />
                                        <span className="text-monokai-fg"><span className="text-monokai-fg font-bold">{activeTab.result.executionTime.toFixed(2)}</span> ms</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Layout size={11} className="text-monokai-comment" />
                                        <span className="text-monokai-fg">{activeTab.result.columns.length} columns</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {/* AI 优化快捷入口 */}
                                    {activeTab.code.trim() && (
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleAiContinueOptimize('improve')}
                                                disabled={isAiLoading}
                                                className="flex items-center gap-1 px-2 py-0.5 bg-monokai-green/10 hover:bg-monokai-green/20 text-monokai-green/80 hover:text-monokai-green rounded transition-colors text-[9px]"
                                                title="优化 SQL"
                                            >
                                                <Sparkles size={10} />
                                                优化
                                            </button>
                                            <button
                                                onClick={() => handleAiContinueOptimize('explain')}
                                                disabled={isAiLoading}
                                                className="flex items-center gap-1 px-2 py-0.5 bg-monokai-purple/10 hover:bg-monokai-purple/20 text-monokai-purple/80 hover:text-monokai-purple rounded transition-colors text-[9px]"
                                                title="解释 SQL"
                                            >
                                                <Lightbulb size={10} />
                                                解释
                                            </button>
                                            <button
                                                onClick={() => handleAiContinueOptimize('adapt')}
                                                disabled={isAiLoading}
                                                className="flex items-center gap-1 px-2 py-0.5 bg-monokai-blue/10 hover:bg-monokai-blue/20 text-monokai-blue/80 hover:text-monokai-blue rounded transition-colors text-[9px]"
                                                title="适配 DuckDB"
                                            >
                                                <Wand2 size={10} />
                                                适配
                                            </button>
                                        </div>
                                    )}
                                    <div className="opacity-50 hover:opacity-100 transition-opacity">
                                        DuckDB WASM
                                    </div>
                                </div>
                            </div>
                        )
                    }
                </div >
                {/* Sidebar (Schema/History) */}
                {
                    !isZenMode && (
                        <div className="w-64 bg-monokai-bg border-l border-monokai-accent flex flex-col shrink-0">
                            <div className="flex gap-1 p-1.5 bg-monokai-bg border-b border-monokai-accent">
                                {['schema', 'history', 'saved', 'help'].map((t: any) => (
                                    <button key={t} onClick={() => setActiveSidebarTab(t)} className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded transition-colors flex justify-center items-center ${activeSidebarTab === t ? 'bg-monokai-accent text-monokai-fg shadow-sm' : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-accent/30'}`}>{t === 'help' ? 'Help' : t === 'schema' ? 'Schema' : t === 'history' ? 'History' : t === 'saved' ? 'Saved' : t}</button>
                                ))}
                            </div>
                            <div className="flex-1 overflow-y-auto bg-monokai-bg">
                                {/* ... Sidebar content unchanged ... */}
                                {activeSidebarTab === 'schema' && (
                                    <TableTree tables={Object.keys(schemaTree)} onInsert={insertText} />
                                )}
                                {activeSidebarTab === 'history' && (
                                    <>
                                        <div className="p-2 border-b border-monokai-accent sticky top-0 bg-monokai-bg/80 backdrop-blur z-10">
                                            <input 
                                                className="w-full bg-monokai-surface border border-monokai-accent rounded px-2 py-1 text-xs text-monokai-fg outline-none focus:border-monokai-purple" 
                                                placeholder="Search history..." 
                                                value={historyFilter} 
                                                onChange={e => setHistoryFilter(e.target.value)} 
                                            />
                                        </div>
                                        <div className="p-2 flex justify-end border-b border-monokai-accent/30">
                                            <button onClick={clearHistory} className="text-[10px] text-monokai-purple hover:underline uppercase font-bold tracking-wider">Clear All</button>
                                        </div>
                                        {filteredHistory.map(item => (
                                            <div key={item.id} className="p-3 border-b border-monokai-accent/50 cursor-pointer hover:bg-monokai-sidebar group transition-colors" onClick={() => insertText(item.sql)}>
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className={`text-[9px] font-bold px-1 rounded ${item.status === 'success' ? 'bg-monokai-bg text-monokai-green border border-monokai-green/30' : 'bg-monokai-bg text-monokai-pink border border-monokai-pink/30'}`}>
                                                        {item.status === 'success' ? 'OK' : 'ERR'}
                                                    </span>
                                                    <span className="text-[10px] text-monokai-comment flex gap-2">
                                                        {item.executionTime && <span>{item.executionTime.toFixed(0)}ms</span>}
                                                        <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                                                    </span>
                                                </div>
                                                <div className="text-xs font-mono text-monokai-fg line-clamp-2 opacity-80">{item.sql}</div>
                                            </div>
                                        ))}
                                    </>
                                )}
                                {activeSidebarTab === 'saved' && (
                                    <>
                                        <div className="p-3 text-xs text-monokai-comment border-b border-monokai-accent bg-monokai-bg/30 italic">Click query to load code.</div>
                                        {savedQueries.map(item => (<div key={item.id} className="p-3 border-b border-monokai-accent/50 cursor-pointer hover:bg-monokai-sidebar group transition-colors" onClick={() => updateActiveTab({ code: item.sql })}><div className="flex justify-between items-center mb-1"><span className="text-xs font-bold text-monokai-green flex items-center gap-2">{item.name}{item.pinned && <Pin size={10} className="text-monokai-yellow" title="Pinned to Dashboard" />}</span><button onClick={(e) => deleteSavedQuery(item.id, e)} className="text-monokai-comment hover:text-monokai-pink p-1 opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} /></button></div><div className="text-xs font-mono text-monokai-fg line-clamp-1 opacity-60">{item.sql}</div></div>))}
                                    </>
                                )}
                                {activeSidebarTab === 'help' && (
                                    <div className="flex flex-col h-full overflow-hidden">
                                        {/* 帮助类型选择 */}
                                        <div className="p-2 border-b border-monokai-accent bg-monokai-bg/50">
                                            <select
                                                value={selectedSqlType}
                                                onChange={(e) => setSelectedSqlType(e.target.value)}
                                                className="w-full bg-monokai-surface border border-monokai-accent rounded px-2 py-1.5 text-xs text-monokai-fg outline-none focus:border-monokai-purple"
                                            >
                                                <option value="select">SELECT 查询生成</option>
                                                <option value="join">JOIN 关联查询</option>
                                                <option value="aggregate">聚合 / 指标分析</option>
                                                <option value="transform">数据转换 / 清洗</option>
                                                <option value="performance">执行计划 / 性能优化</option>
                                                <option value="utilities">实用工具 / 测试数据</option>
                                            </select>
                                        </div>

                                        {/* 帮助内容 */}
                                        <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                                            {(() => {
                                                const help = SQL_CATEGORY_HELP[selectedSqlType];
                                                if (!help) return null;

                                                return (
                                                    <>
                                                        {/* 标题与描述 */}
                                                        <div className="space-y-1.5 pb-2 border-b border-monokai-accent/30">
                                                            <div className="flex items-center gap-2">
                                                                <Lightbulb className="w-4 h-4 text-monokai-yellow shrink-0" />
                                                                <span className="text-sm font-semibold text-monokai-fg">{help.title}</span>
                                                            </div>
                                                            <p className="text-[11px] text-monokai-comment leading-relaxed">{help.description}</p>
                                                        </div>

                                                        {/* 快速上手步骤 */}
                                                        <div className="space-y-1.5">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-1.5 text-xs font-semibold text-monokai-orange/90">
                                                                    <Zap className="w-3 h-3 shrink-0" /><span>快速上手</span>
                                                                </div>
                                                                <span className="text-[10px] text-monokai-comment/60">点击步骤填入输入框</span>
                                                            </div>
                                                            <ol className="space-y-1">
                                                                {help.quickStart.map((s, idx) => {
                                                                    const stepText = s.replace(/^\d+\.\s*/, '');
                                                                    const isActionable = /描述|输入|填写|说明/.test(stepText);
                                                                    return (
                                                                        <li
                                                                            key={idx}
                                                                            onClick={isActionable ? () => setAiPrompt(stepText) : undefined}
                                                                            className={`text-[11px] text-monokai-comment leading-relaxed flex items-start gap-1.5 rounded px-1 py-0.5 ${isActionable
                                                                                    ? 'cursor-pointer hover:text-monokai-orange hover:bg-monokai-orange/5 transition-colors group'
                                                                                    : ''
                                                                                }`}
                                                                            title={isActionable ? '点击填入 AI 输入框' : undefined}
                                                                        >
                                                                            <span className={`font-mono shrink-0 mt-0.5 ${isActionable ? 'text-monokai-orange/70' : 'text-monokai-comment/50'}`}>{idx + 1}.</span>
                                                                            <span>{stepText}</span>
                                                                        </li>
                                                                    );
                                                                })}
                                                            </ol>
                                                        </div>

                                                        {/* 适用场景 */}
                                                        <div className="space-y-1.5">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-1.5 text-xs font-semibold text-monokai-green/90">
                                                                    <Target className="w-3 h-3 shrink-0" /><span>适用场景</span>
                                                                </div>
                                                                <span className="text-[10px] text-monokai-comment/60">点击场景填入输入框</span>
                                                            </div>
                                                            <ul className="space-y-1">
                                                                {help.scenarios.map((s, idx) => (
                                                                    <li
                                                                        key={idx}
                                                                        onClick={() => setAiPrompt(s)}
                                                                        className="text-[11px] text-monokai-comment leading-relaxed flex items-start gap-1 cursor-pointer hover:text-monokai-green hover:bg-monokai-green/5 rounded px-1 py-0.5 transition-colors group"
                                                                        title="点击填入 AI 输入框"
                                                                    >
                                                                        <span className="text-monokai-green/70 mt-0.5 shrink-0 group-hover:text-monokai-green">•</span><span>{s}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>

                                                        {/* 常见错误 */}
                                                        <div className="space-y-1.5">
                                                            <div className="flex items-center gap-1.5 text-xs font-semibold text-monokai-pink/90">
                                                                <AlertTriangle className="w-3 h-3 shrink-0" /><span>常见错误</span>
                                                            </div>
                                                            <ul className="space-y-1">
                                                                {help.commonErrors.map((s, idx) => (
                                                                    <li key={idx} className="text-[11px] text-monokai-comment leading-relaxed flex items-start gap-1">
                                                                        <span className="text-monokai-pink/70 mt-0.5 shrink-0">•</span><span>{s}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>

                                                        {/* AI 协作提示（可点击填入 AI 输入框） */}
                                                        <div className="space-y-1.5">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-1.5 text-xs font-semibold text-monokai-purple/90">
                                                                    <Sparkles className="w-3 h-3 shrink-0" /><span>AI 协作提示</span>
                                                                </div>
                                                                <span className="text-[10px] text-monokai-comment/60">点击填入输入框</span>
                                                            </div>
                                                            <ul className="space-y-1">
                                                                {help.aiHints.map((s, idx) => (
                                                                    <li
                                                                        key={idx}
                                                                        onClick={() => setAiPrompt(s)}
                                                                        className="text-[11px] text-monokai-comment leading-relaxed flex items-start gap-1 cursor-pointer hover:text-monokai-purple hover:bg-monokai-purple/5 rounded px-1 py-0.5 transition-colors group"
                                                                        title="点击填入 AI 输入框"
                                                                    >
                                                                        <span className="text-monokai-purple/50 mt-0.5 shrink-0 group-hover:text-monokai-purple">→</span>
                                                                        <span>{s}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>

                                                        {/* DuckDB 专有语法 */}
                                                        <div className="space-y-1.5 pt-2 border-t border-monokai-accent/40">
                                                            <div className="flex items-center gap-1.5 text-xs font-semibold text-monokai-blue/90">
                                                                <Code className="w-3 h-3 shrink-0" /><span>DuckDB 专有语法</span>
                                                            </div>
                                                            <ul className="space-y-1">
                                                                {help.duckdbSpecific.map((s, idx) => {
                                                                    const [code, ...desc] = s.split(' — ');
                                                                    return (
                                                                        <li
                                                                            key={idx}
                                                                            onClick={() => {
                                                                                const snippet = code.trim();
                                                                                const tab = tabs.find(t => t.id === activeTabId);
                                                                                if (tab) updateActiveTab({ code: tab.code + (tab.code.trim() ? '\n' : '') + snippet });
                                                                            }}
                                                                            className="text-[11px] leading-relaxed flex items-start gap-1.5 cursor-pointer hover:bg-monokai-blue/5 rounded px-1 py-0.5 transition-colors group"
                                                                            title="点击插入到编辑器"
                                                                        >
                                                                            <code className="text-monokai-blue/80 font-mono bg-monokai-bg px-1 rounded text-[10px] shrink-0 group-hover:text-monokai-blue">{code.trim()}</code>
                                                                            {desc.length > 0 && <span className="text-monokai-comment">{desc.join(' — ')}</span>}
                                                                        </li>
                                                                    );
                                                                })}
                                                            </ul>
                                                        </div>

                                                        {/* 最佳实践 */}
                                                        <div className="space-y-1.5 pt-2 border-t border-monokai-accent/40">
                                                            <div className="flex items-center gap-1.5 text-xs font-semibold text-monokai-yellow/90">
                                                                <Target className="w-3 h-3 shrink-0" /><span>最佳实践</span>
                                                            </div>
                                                            <ul className="space-y-1">
                                                                {help.bestPractices.map((s, idx) => (
                                                                    <li key={idx} className="text-[11px] text-monokai-comment leading-relaxed flex items-start gap-1">
                                                                        <span className="text-monokai-yellow/70 mt-0.5 shrink-0">✓</span><span>{s}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>

                                                        {/* 推荐流程（点击触发 AI 填充） */}
                                                        <div className="space-y-1.5 pt-2 border-t border-monokai-accent/40">
                                                            <div className="flex items-center gap-1.5 text-xs font-semibold text-monokai-blue/90">
                                                                <Wand2 className="w-3 h-3 shrink-0" /><span>推荐使用流程</span>
                                                            </div>
                                                            <div className="flex flex-col gap-1.5">
                                                                {help.exampleFlows.map((flow, idx) => (
                                                                    <button
                                                                        key={idx}
                                                                        onClick={() => setAiPrompt(`${flow.name}：${flow.description}`)}
                                                                        className="w-full text-left flex items-start gap-2 px-2 py-1.5 bg-monokai-blue/5 border border-monokai-blue/20 rounded-md hover:bg-monokai-blue/15 hover:border-monokai-blue/40 transition-colors group"
                                                                        title="点击填入 AI 输入框"
                                                                    >
                                                                        <span className="text-monokai-blue/50 group-hover:text-monokai-blue text-[10px] mt-0.5 shrink-0">▶</span>
                                                                        <div>
                                                                            <span className="text-[11px] font-medium text-monokai-blue/80 group-hover:text-monokai-blue">{flow.name}</span>
                                                                            <span className="text-[10px] text-monokai-comment ml-1">{flow.description}</span>
                                                                        </div>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                }
            </div>
        </div>
    );
};