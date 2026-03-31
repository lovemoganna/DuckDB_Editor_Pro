/**
 * QuickActions - Context-Aware Shortcut Cards
 *
 * Shows smart action cards based on whether a table is selected.
 * Each action pre-fills the NL input and can auto-trigger execution.
 * Categorization follows strict MECE (Mutually Exclusive, Collectively Exhaustive) principle.
 * Actions are sorted by difficulty: ⭐基础 → ⭐⭐进阶 → ⭐⭐⭐专家
 */

import React, { useState } from 'react';
import {
    Database, TrendingUp, GitCompare, FileText, Sparkles, Table,
    TestTube, Filter, Layers, Clock, Eraser, Settings2, Hash,
    Trash2, Eye, Wrench, ArrowRightLeft, Type, Calendar, Microscope,
    DatabaseZap, Zap, GitBranch, Calculator, Search, Upload, Target,
    PieChart, Focus, FileCode, Link, ShieldCheck, Box, Archive, Combine,
    RefreshCcw, LayoutList, Activity, Network, ListFilter, Users, ShieldAlert,
    Key, Download, Globe, ServerCog, Fingerprint, Lock, Shield, SplitSquareHorizontal,
    ChevronDown, ChevronRight
} from 'lucide-react';

/** Difficulty levels: 1=基础, 2=进阶, 3=专家 */
type Difficulty = 1 | 2 | 3;

const DIFFICULTY_META: Record<Difficulty, { label: string; tag: string; color: string; dotColor: string }> = {
    1: { label: '基础', tag: 'Lv.1', color: 'text-monokai-green', dotColor: 'bg-monokai-green' },
    2: { label: '进阶', tag: 'Lv.2', color: 'text-monokai-yellow', dotColor: 'bg-monokai-yellow' },
    3: { label: '专家', tag: 'Lv.3', color: 'text-monokai-pink', dotColor: 'bg-monokai-pink' },
};

/** Group-level color tokens for unified visual identity */
const GROUP_COLORS: Record<string, { text: string; border: string; bg: string; hoverBg: string; icon: string }> = {
    'dql': { text: 'text-monokai-cyan', border: 'border-monokai-cyan/30', bg: 'bg-monokai-cyan/5', hoverBg: 'hover:bg-monokai-cyan/10 hover:border-monokai-cyan/40', icon: 'text-monokai-cyan' },
    'dml': { text: 'text-monokai-orange', border: 'border-monokai-orange/30', bg: 'bg-monokai-orange/5', hoverBg: 'hover:bg-monokai-orange/10 hover:border-monokai-orange/40', icon: 'text-monokai-orange' },
    'olap': { text: 'text-monokai-purple', border: 'border-monokai-purple/30', bg: 'bg-monokai-purple/5', hoverBg: 'hover:bg-monokai-purple/10 hover:border-monokai-purple/40', icon: 'text-monokai-purple' },
    'etl': { text: 'text-monokai-green', border: 'border-monokai-green/30', bg: 'bg-monokai-green/5', hoverBg: 'hover:bg-monokai-green/10 hover:border-monokai-green/40', icon: 'text-monokai-green' },
    'ddl': { text: 'text-monokai-yellow', border: 'border-monokai-yellow/30', bg: 'bg-monokai-yellow/5', hoverBg: 'hover:bg-monokai-yellow/10 hover:border-monokai-yellow/40', icon: 'text-monokai-yellow' },
    'schema': { text: 'text-monokai-cyan', border: 'border-monokai-cyan/30', bg: 'bg-monokai-cyan/5', hoverBg: 'hover:bg-monokai-cyan/10 hover:border-monokai-cyan/40', icon: 'text-monokai-cyan' },
    'integration': { text: 'text-monokai-green', border: 'border-monokai-green/30', bg: 'bg-monokai-green/5', hoverBg: 'hover:bg-monokai-green/10 hover:border-monokai-green/40', icon: 'text-monokai-green' },
    'mock': { text: 'text-monokai-yellow', border: 'border-monokai-yellow/30', bg: 'bg-monokai-yellow/5', hoverBg: 'hover:bg-monokai-yellow/10 hover:border-monokai-yellow/40', icon: 'text-monokai-yellow' },
    'config': { text: 'text-monokai-pink', border: 'border-monokai-pink/30', bg: 'bg-monokai-pink/5', hoverBg: 'hover:bg-monokai-pink/10 hover:border-monokai-pink/40', icon: 'text-monokai-pink' },
    'syntax': { text: 'text-monokai-blue', border: 'border-monokai-blue/30', bg: 'bg-monokai-blue/5', hoverBg: 'hover:bg-monokai-blue/10 hover:border-monokai-blue/40', icon: 'text-monokai-blue' },
};

export interface QuickAction {
    id: string;
    label: string;
    description: string;
    icon: React.ElementType;
    prompt: string;
    color: string;
    bgColor: string;
    difficulty: Difficulty;
}

export interface QuickActionGroup {
    title: string;
    icon: React.ElementType;
    colorKey: string;
    actions: QuickAction[];
}

interface QuickActionsProps {
    currentTable?: string;
    currentColumns?: { name: string; type: string }[];
    onAction: (prompt: string) => void;
}

/** Sort actions ascending by difficulty within each group */
function sortByDifficulty(groups: QuickActionGroup[]): QuickActionGroup[] {
    return groups.map(g => ({
        ...g,
        actions: [...g.actions].sort((a, b) => a.difficulty - b.difficulty)
    }));
}

// ==========================================
// SCENARIO A: Table Selected (Context-Aware)
// ==========================================
function getTableActionGroups(tableName: string, columns?: { name: string; type: string }[]): QuickActionGroup[] {
    const dateCol = columns?.find(c =>
        /date|time|timestamp|created|updated/i.test(c.name) ||
        /DATE|TIME|TIMESTAMP/i.test(c.type)
    );
    const numCols = columns?.filter(c =>
        /INT|FLOAT|DOUBLE|DECIMAL|NUMERIC/i.test(c.type)
    ) || [];

    const groups: QuickActionGroup[] = [
        {
            title: '1. 条件查询与取数 (DQL - Query)',
            icon: DatabaseZap,
            colorKey: 'dql',
            actions: [
                {
                    id: 'select', label: '基础条件过滤', description: 'WHERE / ORDER BY', icon: Search,
                    prompt: `查询 ${tableName} 表中满足特定条件的数据，并进行排序`,
                    color: 'text-monokai-blue', bgColor: 'bg-monokai-blue/10 hover:bg-monokai-blue/20 border-monokai-blue/30',
                    difficulty: 1
                },
                {
                    id: 'distinct', label: '去重与唯一值提取', description: 'DISTINCT / COUNT DISTINCT', icon: Filter,
                    prompt: `查询 ${tableName} 中某个字段有哪些唯一值，并统计不同值的出现次数，展示 DISTINCT 和 COUNT(DISTINCT ...) 的用法`,
                    color: 'text-monokai-green', bgColor: 'bg-monokai-green/10 hover:bg-monokai-green/20 border-monokai-green/30',
                    difficulty: 1
                },
                {
                    id: 'alias_expr', label: '别名与表达式计算', description: 'AS / 算术运算', icon: Calculator,
                    prompt: `在查询 ${tableName} 时使用 AS 列别名命名输出列，并展示列间的算术运算（加减乘除取余）和常用内置函数（ABS/ROUND/LENGTH）的组合用法`,
                    color: 'text-monokai-yellow', bgColor: 'bg-monokai-yellow/10 hover:bg-monokai-yellow/20 border-monokai-yellow/30',
                    difficulty: 1
                },
                {
                    id: 'fulltext', label: '模糊匹配与检索', description: 'LIKE / ILIKE', icon: ListFilter,
                    prompt: `对 ${tableName} 中的文本字段进行模糊查询 (LIKE / ILIKE) 或多条件 OR 安全匹配`,
                    color: 'text-monokai-orange', bgColor: 'bg-monokai-orange/10 hover:bg-monokai-orange/20 border-monokai-orange/30',
                    difficulty: 1
                },
                {
                    id: 'in_batch', label: '多值 IN 批量过滤', description: 'IN (...) / NOT IN', icon: ListFilter,
                    prompt: `在 ${tableName} 中使用 IN (val1, val2, ...) 批量匹配多个候选值，同时演示 NOT IN 和安全的 NULL 规避写法`,
                    color: 'text-monokai-red', bgColor: 'bg-monokai-red/10 hover:bg-monokai-red/20 border-monokai-red/30',
                    difficulty: 1
                },
                {
                    id: 'join', label: '多表关联查询', description: 'INNER / LEFT JOIN', icon: GitCompare,
                    prompt: `以 ${tableName} 为主表编写与其他相关子表的 JOIN 关联查询，返回组合扩充字段`,
                    color: 'text-monokai-pink', bgColor: 'bg-monokai-pink/10 hover:bg-monokai-pink/20 border-monokai-pink/30',
                    difficulty: 2
                },
                {
                    id: 'cte', label: 'CTE 公共表达式', description: 'WITH 预处理隔离', icon: GitBranch,
                    prompt: `使用 CTE (WITH) 对 ${tableName} 表进行一次数据预处理筛选，再执行主查询`,
                    color: 'text-monokai-yellow', bgColor: 'bg-monokai-yellow/10 hover:bg-monokai-yellow/20 border-monokai-yellow/30',
                    difficulty: 2
                },
                {
                    id: 'setops', label: '集合与分页', description: 'UNION / LIMIT OFFSET', icon: Combine,
                    prompt: `查询 ${tableName} 表并演示集合操作(UNION/EXCEPT)或跨页 Top-N 分页(LIMIT/OFFSET)提取`,
                    color: 'text-monokai-purple', bgColor: 'bg-monokai-purple/10 hover:bg-monokai-purple/20 border-monokai-purple/30',
                    difficulty: 2
                },
                {
                    id: 'self_join', label: '自关联对比查询', description: 'Self-JOIN 同表', icon: GitCompare,
                    prompt: `在 ${tableName} 中使用 Self-JOIN (同表关联) 发现相邻行间关系，如寻找同城市的不同用户、同分类下相连的两条记录`,
                    color: 'text-monokai-cyan', bgColor: 'bg-monokai-cyan/10 hover:bg-monokai-cyan/20 border-monokai-cyan/30',
                    difficulty: 2
                },
                {
                    id: 'subquery', label: '相关子查询提取', description: 'IN / EXISTS', icon: SplitSquareHorizontal,
                    prompt: `在 ${tableName} 中演示如何使用 EXISTS 或 IN 的嵌套关联子查询过滤主表数据`,
                    color: 'text-emerald-500', bgColor: 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30',
                    difficulty: 3
                },
                {
                    id: 'sql_template_lib', label: '参数化查询模板沉淀', description: '📚 Library 模板库', icon: FileCode,
                    prompt: `基于 ${tableName} 的高频复杂条件查询，帮我提炼并封装一个带详细占位符参数的业务提取 SQL 模板 (SQL Template)，格式化以便加入 Library 模板库`,
                    color: 'text-monokai-orange', bgColor: 'bg-monokai-orange/10 hover:bg-monokai-orange/20 border-monokai-orange/30',
                    difficulty: 3
                }
            ]
        },
        {
            title: '2. 数据写入与变更 (DML - Modification)',
            icon: Settings2,
            colorKey: 'dml',
            actions: [
                {
                    id: 'insert', label: '新增实体数据', description: 'INSERT INTO', icon: Database,
                    prompt: `为 ${tableName} 表生成插入单条新记录和批量插入的 SQL 模板`,
                    color: 'text-monokai-green', bgColor: 'bg-monokai-green/10 hover:bg-monokai-green/20 border-monokai-green/30',
                    difficulty: 1
                },
                {
                    id: 'update', label: '定向更新覆盖', description: 'UPDATE SET WHERE', icon: Settings2,
                    prompt: `生成安全的 UPDATE 语句，用于条件性批量更新 ${tableName} 表中某些字段的值`,
                    color: 'text-monokai-yellow', bgColor: 'bg-monokai-yellow/10 hover:bg-monokai-yellow/20 border-monokai-yellow/30',
                    difficulty: 1
                },
                {
                    id: 'delete', label: '按规废弃删除', description: 'DELETE WHERE', icon: Trash2,
                    prompt: `生成带有 WHERE 强条件的 DELETE 语句，用于安全的清理 ${tableName} 表的废弃历史记录`,
                    color: 'text-monokai-red', bgColor: 'bg-monokai-red/10 hover:bg-monokai-red/20 border-monokai-red/30',
                    difficulty: 1
                },
                {
                    id: 'upsert', label: '冲突插入 (UPSERT)', description: 'ON CONFLICT DO UPDATE', icon: RefreshCcw,
                    prompt: `为 ${tableName} 表生成「存在则更新，不存在则插入 (UPSERT / ON CONFLICT)」 的语句`,
                    color: 'text-monokai-cyan', bgColor: 'bg-monokai-cyan/10 hover:bg-monokai-cyan/20 border-monokai-cyan/30',
                    difficulty: 2
                },
                {
                    id: 'soft_delete', label: '业务软删除变更', description: '标志位 is_deleted=1', icon: Shield,
                    prompt: `为 ${tableName} 编写一个通过更新标志位字段 (如 is_deleted) 来实现逻辑软删除的安全更新语法`,
                    color: 'text-monokai-pink', bgColor: 'bg-monokai-pink/10 hover:bg-monokai-pink/20 border-monokai-pink/30',
                    difficulty: 2
                },
                {
                    id: 'insert_select', label: '跨表迁移写入', description: 'INSERT INTO...SELECT', icon: ArrowRightLeft,
                    prompt: `用 INSERT INTO ${tableName} SELECT ... FROM other_table 的模式演示跨表子查询抽取目标行并直接插入归档的数据迁移写法`,
                    color: 'text-monokai-purple', bgColor: 'bg-monokai-purple/10 hover:bg-monokai-purple/20 border-monokai-purple/30',
                    difficulty: 2
                },
                {
                    id: 'batch_update', label: '条件批量计算更新', description: 'UPDATE...SET = CASE', icon: Calculator,
                    prompt: `对 ${tableName} 中满足不同条件的行批量套用不同计算公式更新（如：UPDATE SET price = CASE WHEN type='A' THEN price*1.1 … END）`,
                    color: 'text-monokai-blue', bgColor: 'bg-monokai-blue/10 hover:bg-monokai-blue/20 border-monokai-blue/30',
                    difficulty: 3
                }
            ]
        },
        {
            title: '3. 统计与业务模型 (OLAP - Analytics)',
            icon: PieChart,
            colorKey: 'olap',
            actions: [
                {
                    id: 'aggregation', label: '属性分组聚合', description: 'GROUP BY', icon: Layers,
                    prompt: `按某分类维度分组，统计 ${tableName} 表的条数${numCols.length > 0 ? `以及 ${numCols[0].name} 的聚合指标` : '和其他关键指标'}`,
                    color: 'text-monokai-purple', bgColor: 'bg-monokai-purple/10 hover:bg-monokai-purple/20 border-monokai-purple/30',
                    difficulty: 1
                },
                {
                    id: 'case_classify', label: '条件分支打标分桶', description: 'CASE WHEN 分类', icon: Filter,
                    prompt: `在 ${tableName} 中使用 CASE WHEN 按数值区间或字段值将记录分为几个业务档位（如高中低、大R中R小R），生成分桶打标SQL`,
                    color: 'text-monokai-cyan', bgColor: 'bg-monokai-cyan/10 hover:bg-monokai-cyan/20 border-monokai-cyan/30',
                    difficulty: 1
                },
                {
                    id: 'group_pct', label: '组内百分比占比', description: '占比 / SUM OVER', icon: PieChart,
                    prompt: `按分类维度统计 ${tableName} 各组的数值总和，并用 SUM(...) OVER() 窗口函数算出每组占全局总量的百分比（对应 Library 系统模板 sys-tpl-6 占比计算）`,
                    color: 'text-monokai-orange', bgColor: 'bg-monokai-orange/10 hover:bg-monokai-orange/20 border-monokai-orange/30',
                    difficulty: 1
                },
                {
                    id: 'date_period', label: '按日期周期统计', description: 'DATE_TRUNC 时间粒度', icon: Calendar,
                    prompt: `按周/月/季度对 ${tableName} 进行 DATE_TRUNC 时间分片聚合，输出每个时间周期的核心数量与金额汇总`,
                    color: 'text-monokai-green', bgColor: 'bg-monokai-green/10 hover:bg-monokai-green/20 border-monokai-green/30',
                    difficulty: 1
                },
                {
                    id: 'funnel', label: '漏斗转化模型', description: '多级步骤流失率', icon: Target,
                    prompt: `假设这是行为流水表，基于 ${tableName} 生成一个经典的三步连续漏斗的节点转化率分析模型`,
                    color: 'text-monokai-orange', bgColor: 'bg-monokai-orange/10 hover:bg-monokai-orange/20 border-monokai-orange/30',
                    difficulty: 2
                },
                {
                    id: 'retention', label: '用户群组留存', description: 'Cohort 分析', icon: Focus,
                    prompt: `基于 ${tableName} 构建一个标准的用户同期群留存率(Cohort)分析查询（展示 1,3,7 日留存变化）`,
                    color: 'text-monokai-pink', bgColor: 'bg-monokai-pink/10 hover:bg-monokai-pink/20 border-monokai-pink/30',
                    difficulty: 2
                },
                {
                    id: 'topn_per_group', label: '分组 TopN 排行榜', description: 'ROW_NUMBER 分组取前', icon: TrendingUp,
                    prompt: `使用 ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ...) 在 ${tableName} 中提取每个分组内的 Top 3/5/10 排名记录`,
                    color: 'text-monokai-blue', bgColor: 'bg-monokai-blue/10 hover:bg-monokai-blue/20 border-monokai-blue/30',
                    difficulty: 2
                },
                {
                    id: 'day_chain', label: '日/周环比同比增长率', description: 'LAG 环比偏移', icon: Activity,
                    prompt: `在 ${tableName} 中使用 LAG 偏移窗口函数计算日增长环比(DoD)、周同比(WoW)和月同比(MoM)增长率百分比（对应 Library 系统模板 sys-tpl-5 日环比/周环比）`,
                    color: 'text-emerald-500', bgColor: 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30',
                    difficulty: 2
                },
                {
                    id: 'running_total', label: '累计运行总计', description: 'SUM OVER / Running Total', icon: TrendingUp,
                    prompt: `在 ${tableName} 中按时间排序计算累计汇总（Running Total）及 7 日滑动平均，展示 SUM(...) OVER(ORDER BY date) 的用法（对应 Library 系统模板 sys-tpl-4 累计计算）`,
                    color: 'text-monokai-cyan', bgColor: 'bg-monokai-cyan/10 hover:bg-monokai-cyan/20 border-monokai-cyan/30',
                    difficulty: 2
                },
                {
                    id: 'rollup', label: '多维钻取分析', description: 'ROLLUP / CUBE', icon: Box,
                    prompt: `在 ${tableName} 中使用 ROLLUP 或 CUBE 构建支持按年/月/总计多维度下钻的聚合查询`,
                    color: 'text-monokai-blue', bgColor: 'bg-monokai-blue/10 hover:bg-monokai-blue/20 border-monokai-blue/30',
                    difficulty: 3
                },
                {
                    id: 'rfm', label: '用户价值 RFM 建模', description: 'Recency Frequency Monetary', icon: Users,
                    prompt: `基于 ${tableName} 生成一个经典的电商/SAAS RFM 价值用户切分分层打分模型计算逻辑`,
                    color: 'text-emerald-500', bgColor: 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30',
                    difficulty: 3
                },
                {
                    id: 'abstraction_lib', label: '核心指标抽象模型封装', description: '📚 Library 抽象表', icon: Layers,
                    prompt: `针对 ${tableName} 的核心业务指标（如留存、转化），将其底层聚合过程极致抽象，输出一份标准的 MECE 业务指标「数据抽象表 (Abstraction Table)」格式供知识库储备`,
                    color: 'text-monokai-pink', bgColor: 'bg-monokai-pink/10 hover:bg-monokai-pink/20 border-monokai-pink/30',
                    difficulty: 3
                },
                {
                    id: 'moving_avg', label: '滑动/移动周期均值', description: 'YTD/MA 核心大屏指标', icon: TrendingUp,
                    prompt: `在 ${tableName} 中利用窗口函数构建按日期的财务 7 日滑动移动平均 (Moving Average) 与 YTD 首日累计`,
                    color: 'text-monokai-yellow', bgColor: 'bg-monokai-yellow/10 hover:bg-monokai-yellow/20 border-monokai-yellow/30',
                    difficulty: 3
                }
            ]
        },
        {
            title: '4. 数据转换与精炼 (ETL - Transform)',
            icon: Eraser,
            colorKey: 'etl',
            actions: [
                {
                    id: 'imputation', label: '空缺值插补兜底', description: 'COALESCE 处理', icon: Table,
                    prompt: `在查询 ${tableName} 表时使用 COALESCE 函数为众多缺失 NULL 空值列提供默认填补和容错处理兜底`,
                    color: 'text-monokai-blue', bgColor: 'bg-monokai-blue/10 hover:bg-monokai-blue/20 border-monokai-blue/30',
                    difficulty: 1
                },
                {
                    id: 'str_func', label: '字符串截取拼接', description: 'CONCAT / SUBSTR / TRIM', icon: Type,
                    prompt: `对 ${tableName} 中的文本字段进行基本的字符处理操作：拼接 (CONCAT / ||)、截取子串 (SUBSTR)、去除前后空白 (TRIM)、大小写转换 (UPPER/LOWER)`,
                    color: 'text-monokai-green', bgColor: 'bg-monokai-green/10 hover:bg-monokai-green/20 border-monokai-green/30',
                    difficulty: 1
                },
                {
                    id: 'cond_replace', label: '条件替换 IF/IIF', description: 'IF / IIF / NULLIF', icon: RefreshCcw,
                    prompt: `在 ${tableName} 的查询中用 IIF(condition, true_val, false_val) 或 NULLIF 进行行级条件快速替换（对应 Library sys-ref-4 CASE WHEN 的简化形式）`,
                    color: 'text-monokai-cyan', bgColor: 'bg-monokai-cyan/10 hover:bg-monokai-cyan/20 border-monokai-cyan/30',
                    difficulty: 1
                },
                {
                    id: 'window', label: '开窗排名累计', description: 'OVER / PARTITION BY', icon: Clock,
                    prompt: `在 ${tableName} 使用窗口函数（如 ROW_NUMBER, SUM(..) OVER）计算并列排名与滑动累计值`,
                    color: 'text-monokai-orange', bgColor: 'bg-monokai-orange/10 hover:bg-monokai-orange/20 border-monokai-orange/30',
                    difficulty: 2
                },
                {
                    id: 'dedup', label: '重复数据清除', description: '去重保留最新行', icon: Eraser,
                    prompt: `在 ${tableName} 中发现重复记录，并使用 ROW_NUMBER + CTE 的方式仅保留每组最新/最早的一条进行去重清洗`,
                    color: 'text-monokai-pink', bgColor: 'bg-monokai-pink/10 hover:bg-monokai-pink/20 border-monokai-pink/30',
                    difficulty: 2
                },
                {
                    id: 'date_calc', label: '日期差值与年龄计算', description: 'DATEDIFF / AGE / INTERVAL', icon: Calendar,
                    prompt: `在 ${tableName} 中计算两个日期字段的差值天数 (DATEDIFF)、年龄 (AGE)，以及用 INTERVAL 做日期偏移加减（对应 Library sys-ref-6 日期处理函数）`,
                    color: 'text-monokai-yellow', bgColor: 'bg-monokai-yellow/10 hover:bg-monokai-yellow/20 border-monokai-yellow/30',
                    difficulty: 2
                },
                {
                    id: 'pivot', label: '交叉表透视', description: 'PIVOT / UNPIVOT', icon: ArrowRightLeft,
                    prompt: `对 ${tableName} 表数据进行交叉表透视 (Pivot 或 Unpivot)，实现长表与宽表间的行转列指标映射`,
                    color: 'text-monokai-cyan', bgColor: 'bg-monokai-cyan/10 hover:bg-monokai-cyan/20 border-monokai-cyan/30',
                    difficulty: 2
                },
                {
                    id: 'regex_clean', label: '正则提取与漂洗', description: 'RegEx / 强转 CAST', icon: Type,
                    prompt: `对 ${tableName} 中的脏文本应用正则表达式清晰提取特定子串，并包含如何 CAST 强制类型转换的样例`,
                    color: 'text-monokai-purple', bgColor: 'bg-monokai-purple/10 hover:bg-monokai-purple/20 border-monokai-purple/30',
                    difficulty: 2
                },
                {
                    id: 'json_array', label: 'JSON与嵌套展平', description: 'UNNEST / JSON_EXTRACT', icon: LayoutList,
                    prompt: `在 ${tableName} 中提供从 JSON 提取特定键值，或对 Array 数组列使用 UNNEST 展开成横向多行的方案`,
                    color: 'text-monokai-green', bgColor: 'bg-monokai-green/10 hover:bg-monokai-green/20 border-monokai-green/30',
                    difficulty: 3
                },
                {
                    id: 'masking', label: '隐私掩码加工', description: '脱敏 HASH/Masking', icon: Fingerprint,
                    prompt: `生成将 ${tableName} 中敏感信息（如手机尾号、邮箱、姓名拼音）进行字符截取打码或 MD5 哈希的数据脱敏方案`,
                    color: 'text-monokai-red', bgColor: 'bg-monokai-red/10 hover:bg-monokai-red/20 border-monokai-red/30',
                    difficulty: 3
                },
                {
                    id: 'list_agg', label: '多值聚合拼接合并', description: 'STRING_AGG / LIST', icon: Combine,
                    prompt: `在 ${tableName} 中使用 STRING_AGG 或 LIST 将每个分组内多行值压缩聚合为一个逗号分隔字符串或数组列表`,
                    color: 'text-emerald-500', bgColor: 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30',
                    difficulty: 3
                },
                {
                    id: 'snippet_lib', label: '高频清洗代码块提取', description: '📚 Library 收藏片段', icon: Sparkles,
                    prompt: `总结并提取针对 ${tableName} 最为经典复杂的脏数据清洗或平铺长难字符串拆开的处理逻辑，封装成 1-2 段极简的可直接存入 Library 收藏区的小段代码片段 (Code Snippets)`,
                    color: 'text-monokai-yellow', bgColor: 'bg-monokai-yellow/10 hover:bg-monokai-yellow/20 border-monokai-yellow/30',
                    difficulty: 3
                }
            ]
        },
        {
            title: '5. 表结构调优与维护 (DDL & DBA)',
            icon: Wrench,
            colorKey: 'ddl',
            actions: [
                {
                    id: 'alter', label: '增修表列结构', description: 'ALTER COLUMN', icon: Wrench,
                    prompt: `修改 ${tableName} 表结构，例如添加带默认值的新列，修改列名，或改变某列的物理存储类型`,
                    color: 'text-monokai-blue', bgColor: 'bg-monokai-blue/10 hover:bg-monokai-blue/20 border-monokai-blue/30',
                    difficulty: 1
                },
                {
                    id: 'comment_meta', label: '表列注释元数据管理', description: 'COMMENT ON / RENAME', icon: FileText,
                    prompt: `为 ${tableName} 表及其列添加业务描述注释 (COMMENT ON)，并展示如何重命名字段 (ALTER TABLE RENAME COLUMN)`,
                    color: 'text-monokai-cyan', bgColor: 'bg-monokai-cyan/10 hover:bg-monokai-cyan/20 border-monokai-cyan/30',
                    difficulty: 1
                },
                {
                    id: 'index', label: '优化建索引', description: 'CREATE INDEX', icon: Hash,
                    prompt: `为 ${tableName} 表分析可能导致拖慢速度的全表查询短板，并推荐生成加速用的 B-Tree 组合索引`,
                    color: 'text-monokai-purple', bgColor: 'bg-monokai-purple/10 hover:bg-monokai-purple/20 border-monokai-purple/30',
                    difficulty: 2
                },
                {
                    id: 'constraints', label: '约束限制加固', description: 'UNIQUE / CHECK', icon: Lock,
                    prompt: `为 ${tableName} 添加业务数据层面的非空校验约束 (NOT NULL)、唯一性约束 (UNIQUE) 或检查约束 (CHECK)`,
                    color: 'text-monokai-orange', bgColor: 'bg-monokai-orange/10 hover:bg-monokai-orange/20 border-monokai-orange/30',
                    difficulty: 2
                },
                {
                    id: 'diagnose', label: '探查画像与计划', description: 'EXPLAIN / SUMMARIZE', icon: Microscope,
                    prompt: `生成两套代码：1. SUMMARIZE ${tableName} 画像极速探查；2. 针对它常用查询的 EXPLAIN 性能命中率诊断`,
                    color: 'text-monokai-green', bgColor: 'bg-monokai-green/10 hover:bg-monokai-green/20 border-monokai-green/30',
                    difficulty: 2
                },
                {
                    id: 'ctas', label: '快速物化派生表', description: 'CREATE TABLE AS SELECT', icon: Database,
                    prompt: `使用 CREATE TABLE new_table AS SELECT ... FROM ${tableName} WHERE ... 将查询结果一步物化成新的独立实体表`,
                    color: 'text-monokai-yellow', bgColor: 'bg-monokai-yellow/10 hover:bg-monokai-yellow/20 border-monokai-yellow/30',
                    difficulty: 2
                },
                {
                    id: 'view_drop', label: '视图化与危操作', description: 'VIEW / TRUNCATE', icon: Archive,
                    prompt: `为清洗后的 ${tableName} 建立持久化视图，同时教我如何用 TRUNCATE 释放磁盘以及 DROP 爆破销毁表`,
                    color: 'text-monokai-red', bgColor: 'bg-monokai-red/10 hover:bg-monokai-red/20 border-monokai-red/30',
                    difficulty: 3
                }
            ]
        }
    ];

    // Dynamic date-aware injection
    if (dateCol) {
        groups[2].actions.splice(1, 0, {
            id: 'trend', label: '时序趋势推测', description: '时间轴线波动特征', icon: TrendingUp,
            prompt: `以 ${dateCol.name} 为时间轴维度统计 ${tableName} 的时间线波动趋势${numCols.length > 0 ? `，并叠加分析折算 ${numCols[0].name} 波动指标` : ''}`,
            color: 'text-emerald-500', bgColor: 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30',
            difficulty: 2
        });
    }

    return sortByDifficulty(groups);
}

// ==============================================
// SCENARIO B: No Table Selected (Global Context)
// ==============================================
function getNoTableActionGroups(): QuickActionGroup[] {
    return sortByDifficulty([
        {
            title: '1. 库表规划与构建 (Schema & Modeling)',
            icon: Table,
            colorKey: 'schema',
            actions: [
                {
                    id: 'create-table-nl', label: '自然语言极速建表', description: '单张表精准建模', icon: Sparkles,
                    prompt: '设计一张极具规范性的日志类型单表，包含自增主键 uuid、审计时间戳和常见的复合字典枚举类型状态机设计',
                    color: 'text-monokai-pink', bgColor: 'bg-monokai-pink/10 hover:bg-monokai-pink/20 border-monokai-pink/30',
                    difficulty: 1
                },
                {
                    id: 'create-table-template', label: '调用严谨行业模版', description: '复用大厂成熟表结构', icon: Layers,
                    prompt: '跳过思考，直接应用业界巨头开源方案中成熟的「双边财务支付流水账单表」的高内聚低耦合 DDL 架构',
                    color: 'text-monokai-cyan', bgColor: 'bg-monokai-cyan/10 hover:bg-monokai-cyan/20 border-monokai-cyan/30',
                    difficulty: 1
                },
                {
                    id: 'create-design', label: '宏观业务架构设计', description: '多表联合实体设计', icon: Network,
                    prompt: '设计一套包含强业务逻辑（如电商、物流、SaaS）的完整微服务库模型，涵盖多张表的主外键ER链路关系',
                    color: 'text-monokai-blue', bgColor: 'bg-monokai-blue/10 hover:bg-monokai-blue/20 border-monokai-blue/30',
                    difficulty: 2
                },
                {
                    id: 'enum_type', label: '枚举与自定义类型设计', description: 'CREATE TYPE / ENUM', icon: LayoutList,
                    prompt: '展示 DuckDB 中如何使用 CREATE TYPE 定义自定义枚举 ENUM 以及 STRUCT 复合类型，并在建表时引用它们保证字段安全性',
                    color: 'text-monokai-orange', bgColor: 'bg-monokai-orange/10 hover:bg-monokai-orange/20 border-monokai-orange/30',
                    difficulty: 2
                },
                {
                    id: 'ctas_schema', label: 'CTAS 快速物化建表', description: 'CREATE TABLE AS SELECT', icon: Database,
                    prompt: '展示如何用 CREATE TABLE new_name AS SELECT ... FROM ... WHERE ... 的 CTAS 模式一步完成从查询结果到新表的物化创建',
                    color: 'text-monokai-yellow', bgColor: 'bg-monokai-yellow/10 hover:bg-monokai-yellow/20 border-monokai-yellow/30',
                    difficulty: 2
                },
                {
                    id: 'dw-schema', label: '数仓建设星型模型', description: 'Star / Snowflake', icon: Box,
                    prompt: '生成一套标准的数据仓库维度模型设计（如：星型模型或雪花模型），包含事实中心表及相关周边的几个维度子表',
                    color: 'text-monokai-purple', bgColor: 'bg-monokai-purple/10 hover:bg-monokai-purple/20 border-monokai-purple/30',
                    difficulty: 3
                },
                {
                    id: 'ontology_lib', label: '降维业务本体论提炼', description: '📚 Library 本体论库', icon: Network,
                    prompt: '为特定产业（例如互金/SaaS订阅/游戏）设计并沉淀出一份顶层级 本体论 (Ontology) 模型，梳理出该领域的实体概念、核心基础属性与上下游链路关系',
                    color: 'text-monokai-green', bgColor: 'bg-monokai-green/10 hover:bg-monokai-green/20 border-monokai-green/30',
                    difficulty: 3
                },
                {
                    id: 'migration', label: '版本化变更发版脚本', description: '表结构 Schema 补丁', icon: GitBranch,
                    prompt: '针对现有系统上线所需，出具一组保证向前兼容的安全线上 DDL Migration 升级（结构与安全默认值追加）脚本',
                    color: 'text-monokai-orange', bgColor: 'bg-monokai-orange/10 hover:bg-monokai-orange/20 border-monokai-orange/30',
                    difficulty: 3
                }
            ]
        },
        {
            title: '2. 外部数据源集成 (Data Integration)',
            icon: Link,
            colorKey: 'integration',
            actions: [
                {
                    id: 'import-infer', label: '智能推断建表装载', description: '分析 JSON/CSV 属性', icon: Upload,
                    prompt: '我将粘贴一段 JSON 或大CSV文本的第一行样本，请你自动推断最佳字段的物理类型并生成建表及配套加载语句',
                    color: 'text-monokai-purple', bgColor: 'bg-monokai-purple/10 hover:bg-monokai-purple/20 border-monokai-purple/30',
                    difficulty: 1
                },
                {
                    id: 'duckdb-external', label: '直连外部文件解析', description: '读取 S3 对象与本地磁盘', icon: FileText,
                    prompt: '教我在 DuckDB 极速算力中如何使用 read_parquet() 或 read_csv_auto() 不需导入步骤直接暴搜 S3 桶里的超大文件',
                    color: 'text-monokai-green', bgColor: 'bg-monokai-green/10 hover:bg-monokai-green/20 border-monokai-green/30',
                    difficulty: 1
                },
                {
                    id: 'export_result', label: '写出导表计算结果', description: 'COPY TO Parquet/CSV', icon: Download,
                    prompt: '产出将复杂分析查询过滤的结果集，高效使用 COPY 指令一键压出并落盘卸载到目标 Parquet/CSV/JSON 文件的模板',
                    color: 'text-emerald-500', bgColor: 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30',
                    difficulty: 2
                },
                {
                    id: 'glob_multi', label: '通配符批量文件扫描', description: 'glob 文件匹配模式', icon: Search,
                    prompt: '使用 DuckDB 的 glob 通配符功能 (*.parquet, data_202*.csv) 一次性读取多个同结构文件并自动合并为单表查询',
                    color: 'text-monokai-pink', bgColor: 'bg-monokai-pink/10 hover:bg-monokai-pink/20 border-monokai-pink/30',
                    difficulty: 2
                },
                {
                    id: 'duckdb-attach', label: '挂载外部异构数据库', description: 'ATTACH 外接引擎联邦', icon: Link,
                    prompt: '展示如何将远端的 PostgreSQL, MySQL 或本地 SQLite 作为 DuckDB 的外挂网关连接引擎进行跨库数据无缝 ATTACH 查询',
                    color: 'text-monokai-yellow', bgColor: 'bg-monokai-yellow/10 hover:bg-monokai-yellow/20 border-monokai-yellow/30',
                    difficulty: 3
                },
                {
                    id: 'httpfs', label: '抓取互联网端点数据', description: 'HTTPFS Remote 读取', icon: Globe,
                    prompt: '如何配置及发起通过 DuckDB 直接读取网络空间互联网开放 HTTP REST 端点或远程静态资源直接作为虚拟表查询',
                    color: 'text-monokai-blue', bgColor: 'bg-monokai-blue/10 hover:bg-monokai-blue/20 border-monokai-blue/30',
                    difficulty: 3
                }
            ]
        },
        {
            title: '3. 仿真数据研发 (Simulation & Mock)',
            icon: TestTube,
            colorKey: 'mock',
            actions: [
                {
                    id: 'mock-data', label: '高仿真规律 Mock 数据', description: '随机注入与分布构造', icon: TestTube,
                    prompt: '为我编写一段极其复杂的 SQL 脚本，随机生成千条贴近真实电商商业世界偏态概率分布（例如二八冷热购买分布带）的订单行集',
                    color: 'text-monokai-orange', bgColor: 'bg-monokai-orange/10 hover:bg-monokai-orange/20 border-monokai-orange/30',
                    difficulty: 1
                },
                {
                    id: 'mock-enum', label: '字典枚举分布组合 Mock', description: '状态机比例分配', icon: PieChart,
                    prompt: '生成一张含有多个枚举类型字段（如 status=[\'pending\',\'paid\',\'shipped\',\'refunded\'] 按 6:2:1.5:0.5 比例分配）的逻辑真实双字典数据表',
                    color: 'text-monokai-green', bgColor: 'bg-monokai-green/10 hover:bg-monokai-green/20 border-monokai-green/30',
                    difficulty: 1
                },
                {
                    id: 'mock-timeseries', label: '时序时间轴序列填充', description: '持续跨期生成日历序列', icon: Calendar,
                    prompt: '教我利用 DuckDB内置特殊序列生成器（如 generate_series），构造长达一年间歇性跳空随机起伏的气象 IoT 物联网流水数据',
                    color: 'text-monokai-cyan', bgColor: 'bg-monokai-cyan/10 hover:bg-monokai-cyan/20 border-monokai-cyan/30',
                    difficulty: 2
                },
                {
                    id: 'mock-relational', label: '约束关联网 Mock 制备', description: '级联匹配一致性', icon: Combine,
                    prompt: '写一段通过多层脚本构造的两组父子表（如客户表、及其客户各自名下的关联订单详情）彼此主外键能够相互勾稽自洽的数据群组',
                    color: 'text-monokai-purple', bgColor: 'bg-monokai-purple/10 hover:bg-monokai-purple/20 border-monokai-purple/30',
                    difficulty: 2
                },
                {
                    id: 'mock-hierarchy', label: '多级树状层次 Mock', description: '递归自引用父子层级', icon: GitBranch,
                    prompt: '生成一组含有 parent_id 自引用字段的多级树状组织架构（如部门 → 子部门 → 团队），层次深度至少 4 级，保证每级节点数随深度衰减',
                    color: 'text-monokai-blue', bgColor: 'bg-monokai-blue/10 hover:bg-monokai-blue/20 border-monokai-blue/30',
                    difficulty: 2
                },
                {
                    id: 'mock-edge', label: '异常边缘破坏力生成', description: '边界穿透空指针用例', icon: Activity,
                    prompt: '为 QA 测试生成一组含有大量危险空窗值、千亿级越界浮点数、完全重复重叠副本和日文Emoji非法字符混合插入的数据弹药',
                    color: 'text-monokai-red', bgColor: 'bg-monokai-red/10 hover:bg-monokai-red/20 border-monokai-red/30',
                    difficulty: 3
                }
            ]
        },
        {
            title: '4. 引擎配置与权限环境 (Config & Security)',
            icon: ShieldCheck,
            colorKey: 'config',
            actions: [
                {
                    id: 'sys-catalog', label: '系统字典元视图深挖', description: 'DuckDB Catalog', icon: Eye,
                    prompt: '展示如何像黑客架构师一样去查询内置底层 information_schema、pg_class 查询到底偷偷存了哪些系统类型及内部函数细节',
                    color: 'text-monokai-cyan', bgColor: 'bg-monokai-cyan/10 hover:bg-monokai-cyan/20 border-monokai-cyan/30',
                    difficulty: 1
                },
                {
                    id: 'db_overview', label: '全库全表概览引导', description: 'SHOW TABLES / DESCRIBE', icon: Database,
                    prompt: '用最简单的方式查看当前数据库有哪些表 (SHOW TABLES / SHOW ALL TABLES)，以及查看某张表的全部字段结构 (DESCRIBE table_name) 的完整方法',
                    color: 'text-monokai-green', bgColor: 'bg-monokai-green/10 hover:bg-monokai-green/20 border-monokai-green/30',
                    difficulty: 1
                },
                {
                    id: 'memory_mode', label: '内存数据库 vs 持久化', description: ':memory: / .duckdb 文件', icon: Database,
                    prompt: '解释 DuckDB 的两种运行模式：纯内存模式 (:memory:) 与持久化磁盘模式 (.duckdb 文件)，各自的使用场景和性能差异',
                    color: 'text-monokai-orange', bgColor: 'bg-monokai-orange/10 hover:bg-monokai-orange/20 border-monokai-orange/30',
                    difficulty: 1
                },
                {
                    id: 'pragma-tune', label: 'DuckDB 引擎参数调优', description: 'PRAGMA 内存线程', icon: Settings2,
                    prompt: '详细列出对单机 DuckDB 算子内存上限、并行线程、溢写磁盘临时目录最关键的 PRAGMA 引擎执行引擎核心瓶颈调优命令',
                    color: 'text-monokai-blue', bgColor: 'bg-monokai-blue/10 hover:bg-monokai-blue/20 border-monokai-blue/30',
                    difficulty: 2
                },
                {
                    id: 'extensions', label: '驱动引擎拓展库安装', description: 'INSTALL / LOAD', icon: ServerCog,
                    prompt: '指导如何引入和安装配置第三方强大的官方扩展引擎包 (如空间索引 spatial, fts, excel 读写, httpfs 拓展模块)',
                    color: 'text-monokai-yellow', bgColor: 'bg-monokai-yellow/10 hover:bg-monokai-yellow/20 border-monokai-yellow/30',
                    difficulty: 2
                },
                {
                    id: 'use_schema', label: '多 Schema 切换上下文', description: 'USE / SET search_path', icon: ArrowRightLeft,
                    prompt: '展示 DuckDB 中如何用 USE schema_name 或 SET search_path 切换当前的默认 Schema 上下文，以及如何列出所有可用 Schema',
                    color: 'text-monokai-pink', bgColor: 'bg-monokai-pink/10 hover:bg-monokai-pink/20 border-monokai-pink/30',
                    difficulty: 2
                },
                {
                    id: 'secret-config', label: '安全秘钥及凭证连接', description: 'CREATE SECRET', icon: Key,
                    prompt: '在 DuckDB 中如何安全高强度的使用 CREATE SECRET 声明去设置绑定连接到云端 AWS S3 / R2 对象云存储的私密身份验证配置',
                    color: 'text-emerald-500', bgColor: 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30',
                    difficulty: 3
                },
                {
                    id: 'learning_path_lib', label: '定制高阶学习规划路标', description: '📚 Library 学习路径', icon: Target,
                    prompt: '我希望系统突破 DuckDB 某一垂直技能树（如内存算子与并发调优/高级多维分析引擎），请为我制定一份含有7天内阶段性目标的 进阶学习全路径 (Learning Path)',
                    color: 'text-monokai-purple', bgColor: 'bg-monokai-purple/10 hover:bg-monokai-purple/20 border-monokai-purple/30',
                    difficulty: 3
                },
                {
                    id: 'permissions', label: '权限授权与审计模型', description: 'GRANT / REVOKE 操作', icon: ShieldAlert,
                    prompt: '生成一组经典的基于角色的权限剥夺与有限授予 (GRANT SELECT, REVOKE ALL) 防止写表的 RBAC 通用权限框架脚本',
                    color: 'text-monokai-pink', bgColor: 'bg-monokai-pink/10 hover:bg-monokai-pink/20 border-monokai-pink/30',
                    difficulty: 3
                }
            ]
        },
        {
            title: '5. 复杂语法大全与反模式重写 (Syntax & Patterns)',
            icon: FileCode,
            colorKey: 'syntax',
            actions: [
                {
                    id: 'cast-func', label: '时区日历转换对齐精要', description: '时间轴切片维度重截断', icon: Calendar,
                    prompt: '一次性交代清楚时间戳重赋值切片对齐的方法，重点涵盖利用月/周/半小时维度做 TRUNCATE 日历聚合切割，或是应对冬夏令时差的避坑偏门技巧',
                    color: 'text-emerald-400', bgColor: 'bg-emerald-400/10 hover:bg-emerald-400/20 border-emerald-400/30',
                    difficulty: 1
                },
                {
                    id: 'having_filter', label: 'HAVING 聚合后筛选', description: '分组聚合过滤条件', icon: Filter,
                    prompt: '展示 WHERE 与 HAVING 的区别，用实例将先 GROUP BY 分组聚合再用 HAVING 过滤掉数量不足的组（如：HAVING COUNT(*) > 5 或 HAVING SUM(amount) > 1000）',
                    color: 'text-monokai-green', bgColor: 'bg-monokai-green/10 hover:bg-monokai-green/20 border-monokai-green/30',
                    difficulty: 1
                },
                {
                    id: 'rewrite-slow', label: '慢查询优化改写降维', description: '消灭子查询/笛卡尔积', icon: Zap,
                    prompt: '分享将多重深坑嵌套循环标量子查询强行重组降维扁平拉直为 JOIN 或者预聚合派生表的高并发快性能查询法则',
                    color: 'text-monokai-yellow', bgColor: 'bg-monokai-yellow/10 hover:bg-monokai-yellow/20 border-monokai-yellow/30',
                    difficulty: 2
                },
                {
                    id: 'anti_join', label: '缺失反相过滤与剔除', description: 'Anti-Join 等价写法', icon: Eraser,
                    prompt: '列出用 LEFT JOIN ... IS NULL 以及 NOT EXISTS 及 EXCEPT 找出一组在主表中多余或未命中子表的数据的各种反叛过滤(Anti-Join)实战写法',
                    color: 'text-monokai-green', bgColor: 'bg-monokai-green/10 hover:bg-monokai-green/20 border-monokai-green/30',
                    difficulty: 2
                },
                {
                    id: 'lateral_join', label: 'LATERAL 侧向派生关联', description: '每行独立计算参引', icon: SplitSquareHorizontal,
                    prompt: '解释并演示 DuckDB 支持的 LATERAL JOIN 语法，它如何让右侧子查询引用左侧行数据，适用于每个用户取最新 3 条记录等场景',
                    color: 'text-monokai-cyan', bgColor: 'bg-monokai-cyan/10 hover:bg-monokai-cyan/20 border-monokai-cyan/30',
                    difficulty: 2
                },
                {
                    id: 'exclude_replace', label: 'EXCLUDE/REPLACE 列操控', description: 'SELECT * EXCLUDE/REPLACE', icon: Eraser,
                    prompt: '展示 DuckDB 独有的 SELECT * EXCLUDE(col1, col2) 删列和 SELECT * REPLACE(expr AS col) 替列语法，极大简化宽表查询',
                    color: 'text-monokai-orange', bgColor: 'bg-monokai-orange/10 hover:bg-monokai-orange/20 border-monokai-orange/30',
                    difficulty: 2
                },
                {
                    id: 'macro_def', label: '变量与宏定义', description: 'CREATE MACRO / 参数化', icon: Zap,
                    prompt: '展示如何用 CREATE MACRO 定义可复用的参数化 SQL 函数（标量宏和表宏），实现一次定义、到处调用的 DRY 原则',
                    color: 'text-monokai-purple', bgColor: 'bg-monokai-purple/10 hover:bg-monokai-purple/20 border-monokai-purple/30',
                    difficulty: 2
                },
                {
                    id: 'window-cookbook', label: '超长开窗函数高阶食谱', description: '分片滑动窗 / 波峰计算', icon: Clock,
                    prompt: '提供一个涵盖前后邻行差分探测 (LAG/LEAD) 及无限延伸带上下物理帧范围 (ROWS BETWEEN) 滑动窗口累计峰谷值的解惑大全',
                    color: 'text-monokai-pink', bgColor: 'bg-monokai-pink/10 hover:bg-monokai-pink/20 border-monokai-pink/30',
                    difficulty: 3
                },
                {
                    id: 'cte-recursive', label: '递归展开式 CTE 精讲', description: '无限层级树状结构', icon: GitBranch,
                    prompt: '给我一个使用 RECURSIVE CTE 优雅解决无限深层次自引用的树形层级组织（如多级员工汇报路线，菜单嵌套分类管理）下穿遍历精写模板',
                    color: 'text-monokai-orange', bgColor: 'bg-monokai-orange/10 hover:bg-monokai-orange/20 border-monokai-orange/30',
                    difficulty: 3
                },
                {
                    id: 'lambda_expr', label: 'Lambda 列表变换表达式', description: 'list_transform / list_filter', icon: Zap,
                    prompt: '展示 DuckDB 独有的 Lambda 表达式（如 list_transform(arr, x -> x * 2)、list_filter(arr, x -> x > 0)）在数组列上的高阶函数式编程用法',
                    color: 'text-monokai-red', bgColor: 'bg-monokai-red/10 hover:bg-monokai-red/20 border-monokai-red/30',
                    difficulty: 3
                },
                {
                    id: 'qualify', label: 'QUALIFY 优雅取最值排位', description: '后置窗筛选截断', icon: Filter,
                    prompt: '对比传统的套用子查询方式，使用 DuckDB 支持的超强 QUALIFY 次级直接后窗过滤语法实现极其优雅紧凑的 "取各分组首末或连击行" 示例',
                    color: 'text-monokai-purple', bgColor: 'bg-monokai-purple/10 hover:bg-monokai-purple/20 border-monokai-purple/30',
                    difficulty: 3
                },
                {
                    id: 'reference_card_lib', label: '浓缩语法速查卡片提取', description: '📚 Library Reference Card', icon: FileText,
                    prompt: '针对极其晦涩高深的开窗时间错位比对、或罕见的 Array 数组拆铺高阶函数嵌套，帮我提炼归纳一份直戳痛点的速学 速查卡片 (Reference Card) 标准文档',
                    color: 'text-monokai-blue', bgColor: 'bg-monokai-blue/10 hover:bg-monokai-blue/20 border-monokai-blue/30',
                    difficulty: 3
                }
            ]
        }
    ]);
}

export const QuickActions: React.FC<QuickActionsProps> = ({
    currentTable,
    currentColumns,
    onAction,
}) => {
    const actionGroups = currentTable
        ? getTableActionGroups(currentTable, currentColumns)
        : getNoTableActionGroups();

    const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});

    const toggleGroup = (idx: number) => {
        setCollapsed(prev => ({ ...prev, [idx]: !prev[idx] }));
    };

    return (
        <div className="space-y-4 pb-4">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 mb-1 pb-3 border-b border-monokai-accent/20">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-monokai-purple animate-pulse" />
                    <span className="text-xs font-bold text-monokai-fg uppercase tracking-[0.15em]">
                        {currentTable ? '针对选中表的专家级快捷处理阵列 (全域 MECE 规约)' : '全引擎操作集分类导航总署 (全域 MECE 规约)'}
                    </span>
                </div>
                <div className="text-[10px] text-monokai-comment px-2 py-0.5 bg-monokai-surface border border-monokai-accent/20 rounded">
                    {currentTable ? `已挂载上下文: [ ${currentTable} ]` : '探索 AI SQL 全域无限可能'}
                </div>
            </div>

            {/* Groups */}
            <div className="space-y-4">
                {actionGroups.map((group, groupIdx) => {
                    const GroupIcon = group.icon;
                    const gc = GROUP_COLORS[group.colorKey] || GROUP_COLORS['dql'];
                    const isCollapsed = collapsed[groupIdx] ?? false;

                    return (
                        <div key={groupIdx} className="rounded-lg border border-monokai-accent/15 bg-monokai-bg overflow-hidden">
                            {/* Group Header - Clickable */}
                            <button
                                onClick={() => toggleGroup(groupIdx)}
                                className={`w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors duration-150 cursor-pointer hover:bg-monokai-surface/50`}
                            >
                                {isCollapsed
                                    ? <ChevronRight className={`w-3.5 h-3.5 ${gc.text} shrink-0`} />
                                    : <ChevronDown className={`w-3.5 h-3.5 ${gc.text} shrink-0`} />
                                }
                                <GroupIcon className={`w-4 h-4 ${gc.icon} shrink-0`} />
                                <span className={`text-xs font-bold ${gc.text} uppercase tracking-wider`}>
                                    {group.title}
                                </span>
                                <span className={`ml-auto text-[10px] font-mono px-2 py-0.5 rounded-full ${gc.bg} ${gc.text} border ${gc.border}`}>
                                    {group.actions.length}
                                </span>
                            </button>

                            {/* Cards Grid - Collapsible */}
                            {!isCollapsed && (
                                <div className="px-3 pb-3 pt-1">
                                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-3">
                                        {group.actions.map(action => {
                                            const ActionIcon = action.icon;
                                            const diff = DIFFICULTY_META[action.difficulty];
                                            return (
                                                <button
                                                    key={action.id}
                                                    onClick={() => onAction(action.prompt)}
                                                    className={`flex flex-col items-start gap-2 p-3.5 rounded-lg border text-left transition-all duration-200 group cursor-pointer bg-monokai-bg ${gc.border} ${gc.hoverBg} hover:shadow-sm`}
                                                >
                                                    <div className="flex items-center justify-between w-full">
                                                        <div className={`flex items-center gap-1.5 ${gc.text}`}>
                                                            <ActionIcon className="w-4 h-4 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity" />
                                                            <div className="text-xs font-semibold truncate group-hover:brightness-110">
                                                                {action.label}
                                                            </div>
                                                        </div>
                                                        <span className={`text-[9px] shrink-0 ml-1.5 px-1.5 py-0.5 rounded-full border border-monokai-accent/20 ${diff.color} font-mono leading-none bg-monokai-surface`} title={diff.label}>
                                                            {diff.tag}
                                                        </span>
                                                    </div>
                                                    <div className="text-[10px] text-monokai-comment line-clamp-2 leading-relaxed w-full group-hover:text-monokai-fg/60 transition-colors">
                                                        {action.description}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default QuickActions;

