import React, { useState, useEffect, useMemo } from 'react';
import {
    GraduationCap,
    Check,
    CheckCircle2,
    Play,
    ChevronRight,
    ChevronDown,
    ArrowLeft,
    ArrowRight,
    Sparkles,
    Code2,
    Copy,
    BookOpen,
    Layers,
    Clock,
    Zap,
    ExternalLink,
    Filter
} from 'lucide-react';
import { PageHeader, ActionButton, IconButton, SearchInput } from './ui/Workbench';
import { toastService } from '../services/toastService';

interface Lesson {
    id: string;
    category: 'Foundations' | 'Data Cleaning' | 'Complex Types' | 'Time Series' | 'Analytics' | 'Utilities' | 'Extensions';
    title: string;
    description: string;
    whyItMatters: string;
    code: string;
    difficulty: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
    tags: string[];
}

const lessons: Lesson[] = [
    // --- FOUNDATIONS ---
    {
        id: 'basics_01',
        category: 'Foundations',
        title: '基础 SELECT 查询与过滤',
        difficulty: 'Beginner',
        tags: ['SELECT', 'WHERE', 'LIMIT'],
        description: 'SQL 查询的基石。学习如何检索特定列并使用过滤条件精确筛选数据。',
        whyItMatters: '90% 的数据工程任务都从精准检索开始，熟练掌握 WHERE 条件能够快速完成数据切片。',
        code: `SELECT \n  operation_type, \n  target_table, \n  log_time \nFROM main._sys_audit_log \nWHERE affected_rows > 0 \nORDER BY log_time DESC \nLIMIT 5;`
    },
    {
        id: 'aggr_01',
        category: 'Foundations',
        title: '聚合计算与分组统计',
        difficulty: 'Beginner',
        tags: ['GROUP BY', 'COUNT', 'AVG'],
        description: '汇总明细数据以发现业务趋势。按类别统计操作记录总数与平均影响行数。',
        whyItMatters: '原始明细数据繁杂散乱，聚合分析能将海量明细快速提炼为可量化指标。',
        code: `SELECT \n  operation_type,\n  COUNT(*) as total_ops,\n  SUM(affected_rows) as total_affected\nFROM main._sys_audit_log\nGROUP BY operation_type\nORDER BY total_ops DESC;`
    },
    // --- DATA CLEANING ---
    {
        id: 'clean_01',
        category: 'Data Cleaning',
        title: '正则表达式文本清洗',
        difficulty: 'Intermediate',
        tags: ['RegEx', 'Extract'],
        description: '利用正则表达式在复杂文本中精准提取目标子串并批量替换不规则内容。',
        whyItMatters: '真实业务数据往往包含大量非结构化文本，正则提取是数据标准化必备技能。',
        code: `-- 提取详情字段首词并替换关键字\nSELECT \n  details,\n  regexp_extract(details, '^([a-zA-Z]+)', 1) as first_word,\n  regexp_replace(details, 'Imported', 'LOADED') as cleaned\nFROM main._sys_audit_log\nLIMIT 5;`
    },
    {
        id: 'clean_02',
        category: 'Data Cleaning',
        title: '缺失值与空值安全处理',
        difficulty: 'Intermediate',
        tags: ['COALESCE', 'NULL'],
        description: '使用 COALESCE 函数优雅处理 NULL 缺失值，提供保底默认值以避免计算异常。',
        whyItMatters: '未处理的 NULL 值会导致下游聚合与接口崩坏，安全默认值保障数据链路健壮性。',
        code: `SELECT \n  target_table,\n  affected_rows,\n  COALESCE(target_table, 'UNKNOWN_TABLE') as safe_table,\n  COALESCE(affected_rows, 0) as safe_rows\nFROM main._sys_audit_log;`
    },
    {
        id: 'fuzzy_01',
        category: 'Data Cleaning',
        title: '模糊匹配与相似度算法',
        difficulty: 'Advanced',
        tags: ['Jaro-Winkler', 'Levenshtein'],
        description: '使用 Jaro-Winkler 与 Levenshtein 字符串距离算法跨系统匹配拼写相似的文本。',
        whyItMatters: '在实体对齐与客户去重场景下，模糊匹配能高效识别拼写变体与录入错误。',
        code: `-- 1. 构造测试数据\nCREATE OR REPLACE TABLE customers (name VARCHAR);\nINSERT INTO customers VALUES ('Jon Smith'), ('John Smith'), ('Jhon Smyth'), ('Alice');\n\n-- 2. 查找与 'John Smith' 的相似度\nSELECT \n  name,\n  jaro_winkler_similarity(name, 'John Smith') as similarity,\n  levenshtein(name, 'John Smith') as edit_distance\nFROM customers\nORDER BY similarity DESC;`
    },
    // --- COMPLEX TYPES ---
    {
        id: 'struct_01',
        category: 'Complex Types',
        title: '嵌套结构 Structs & Lists',
        difficulty: 'Advanced',
        tags: ['STRUCT', 'LIST'],
        description: 'DuckDB 原生高效支持复杂嵌套类型，无需 JOIN 即可将层级属性统一打包。',
        whyItMatters: '现代数据格式（JSON/Parquet）多为层级结构，Structs 保持了天然的高效紧凑性。',
        code: `-- 动态构造包含嵌套结构的数据切片\nSELECT \n  1 as id,\n  {'street': '123 Main St', 'city': 'Duckburg'} as address,\n  [100, 200, 300] as scores\nUNION ALL\nSELECT \n  2, {'street': '456 Web Way', 'city': 'BrowserCity'}, [50, 60];`
    },
    {
        id: 'unnest_01',
        category: 'Complex Types',
        title: '数组多维展开 UNNEST',
        difficulty: 'Advanced',
        tags: ['UNNEST', 'Arrays'],
        description: '使用 UNNEST 函数将嵌套数组平铺展开为一维关系型行记录，便于深入统计分析。',
        whyItMatters: '标签数组或多选值展开后可直接与主维度进行联合聚合与漏斗分析。',
        code: `SELECT \n  id,\n  UNNEST([10, 20, 30]) as score\nFROM (SELECT 1 as id);`
    },
    // --- TIME SERIES ---
    {
        id: 'time_01',
        category: 'Time Series',
        title: '时序窗口与滑动聚合',
        difficulty: 'Advanced',
        tags: ['OVER', 'WINDOW', 'Rolling'],
        description: '利用窗口函数计算滚动平均值与累计总和，平滑短期抖动以洞察长期趋势。',
        whyItMatters: '金融与用户行为指标分析极度依赖滑动窗口来识别周期性规律。',
        code: `SELECT \n  log_time,\n  affected_rows,\n  SUM(affected_rows) OVER (ORDER BY log_time ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) as rolling_3_sum\nFROM main._sys_audit_log\nORDER BY log_time DESC\nLIMIT 10;`
    },
    // --- ANALYTICS ---
    {
        id: 'analytics_01',
        category: 'Analytics',
        title: 'QUALIFY 语法精准排名过滤',
        difficulty: 'Intermediate',
        tags: ['QUALIFY', 'ROW_NUMBER'],
        description: 'DuckDB 特色 QUALIFY 子句直接对窗口函数结果进行过滤，告别繁琐子查询嵌套。',
        whyItMatters: '相比传统嵌套子查询，QUALIFY 语法清晰直观，大幅提升分析型 SQL 的可读性与执行效率。',
        code: `SELECT \n  operation_type,\n  target_table,\n  log_time,\n  ROW_NUMBER() OVER (PARTITION BY operation_type ORDER BY log_time DESC) as rank\nFROM main._sys_audit_log\nQUALIFY rank = 1;`
    },
    {
        id: 'analytics_02',
        category: 'Analytics',
        title: 'PIVOT 矩阵透视表转换',
        difficulty: 'Advanced',
        tags: ['PIVOT', 'Matrix'],
        description: '使用 PIVOT 关键字快速将行维度值转换为列维度，一键生成多维透视矩阵报表。',
        whyItMatters: '无需冗长的 CASE WHEN 堆砌，PIVOT 极大简化了报表展示层的多维透视逻辑。',
        code: `PIVOT main._sys_audit_log \nON operation_type \nUSING COUNT(id);`
    },
    // --- UTILITIES ---
    {
        id: 'gen_01',
        category: 'Utilities',
        title: '动态模拟数据生成 Range',
        difficulty: 'Beginner',
        tags: ['RANGE', 'RANDOM', 'Mock'],
        description: '利用 RANGE 与 RANDOM 函数在浏览器内存中快速生成数万条测试数据集。',
        whyItMatters: '在缺乏真实数据源时，生成合成数据可以迅速验证查询性能与算法逻辑。',
        code: `-- 快速生成 1000 条带随机评分的模拟用户记录\nSELECT \n  range as id, \n  round(random() * 100, 2) as score, \n  'User-' || (range % 10) as category \nFROM range(1000);`
    },
    // --- EXTENSIONS ---
    {
        id: 'fts_01',
        category: 'Extensions',
        title: '全文检索引擎 FTS (BM25)',
        difficulty: 'Expert',
        tags: ['FTS', 'Search', 'BM25'],
        description: '借助 DuckDB 原生 FTS 扩展与 BM25 评分算法，在数据库内部构建高效全文搜索引擎。',
        whyItMatters: 'LIKE 模糊查询无法打分且性能低下，FTS 提供了工业级的相关性排序与词干分析。',
        code: `-- 1. 加载扩展与创建知识文档库\nINSTALL fts; LOAD fts;\nCREATE OR REPLACE TABLE documents (id INT, title VARCHAR, content VARCHAR);\nINSERT INTO documents VALUES \n (1, 'DuckDB 简介', 'DuckDB 是一个专为浏览器与嵌入式分析优化的列式数据库引擎'),\n (2, 'SQL 高阶指南', '结构化查询语言在分析型工作流中扮演核心基石角色'),\n (3, '向量搜索与检索', '结合 Embedding 向量与全文搜索实现混合知识检索');\n\n-- 2. 构建全文索引\nPRAGMA create_fts_index('documents', 'id', 'content');\n\n-- 3. 执行 BM25 相关性检索\nSELECT id, title, score \nFROM (SELECT *, fts_main_documents.match_bm25(id, 'DuckDB') as score FROM documents)\nWHERE score IS NOT NULL \nORDER BY score DESC;`
    },
    {
        id: 'geo_01',
        category: 'Extensions',
        title: '地理空间数据计算 Spatial',
        difficulty: 'Expert',
        tags: ['Spatial', 'GIS', 'Distance'],
        description: '使用 Spatial 地理扩展计算经纬度点集间球面距离与空间多边形拓扑关系。',
        whyItMatters: '直接在 DuckDB 内部完成地理空间几何运算，无需部署昂贵的重型 GIS 服务器。',
        code: `-- 1. 加载空间计算扩展\nINSTALL spatial; LOAD spatial;\n\n-- 2. 计算伦敦与纽约两地坐标间的大圆距离\nSELECT \n  st_distance(\n    st_point(51.5, -0.1),\n    st_point(40.7, -74.0)\n  ) as distance_deg;`
    }
];

interface TutorialsProps {
    onTryCode: (code: string) => void;
}

const DIFFICULTY_BADGES: Record<Lesson['difficulty'], { label: string; text: string; bg: string; border: string }> = {
    Beginner: { label: '入门', text: 'text-monokai-green', bg: 'bg-monokai-surface', border: 'border-monokai-border' },
    Intermediate: { label: '进阶', text: 'text-monokai-yellow', bg: 'bg-monokai-surface', border: 'border-monokai-border' },
    Advanced: { label: '高级', text: 'text-monokai-orange', bg: 'bg-monokai-surface', border: 'border-monokai-border' },
    Expert: { label: '专家', text: 'text-monokai-amethyst', bg: 'bg-monokai-surface', border: 'border-monokai-border' },
};

export const Tutorials: React.FC<TutorialsProps> = ({ onTryCode }) => {
    const [selectedId, setSelectedId] = useState<string>(lessons[0].id);
    const [completed, setCompleted] = useState<Set<string>>(new Set());
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
        new Set(['Foundations', 'Data Cleaning', 'Complex Types', 'Analytics', 'Extensions'])
    );
    const [searchQuery, setSearchQuery] = useState('');
    const [copied, setCopied] = useState(false);

    const activeIndex = lessons.findIndex(l => l.id === selectedId);
    const activeLesson = lessons[activeIndex >= 0 ? activeIndex : 0];

    useEffect(() => {
        try {
            const saved = localStorage.getItem('duckdb_tutorials_progress');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    setCompleted(new Set(parsed as string[]));
                }
            }
        } catch { }
    }, []);

    const toggleComplete = (id: string) => {
        const newSet = new Set(completed);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
            toastService.success('恭喜完成本节实战课程！');
        }
        setCompleted(newSet);
        try {
            localStorage.setItem('duckdb_tutorials_progress', JSON.stringify(Array.from(newSet)));
        } catch { }
    };

    const toggleCategory = (cat: string) => {
        const newSet = new Set(expandedCategories);
        if (newSet.has(cat)) newSet.delete(cat);
        else newSet.add(cat);
        setExpandedCategories(newSet);
    };

    const filteredLessons = useMemo(() => {
        if (!searchQuery.trim()) return lessons;
        const q = searchQuery.toLowerCase().trim();
        return lessons.filter(l =>
            l.title.toLowerCase().includes(q) ||
            l.description.toLowerCase().includes(q) ||
            l.category.toLowerCase().includes(q) ||
            l.tags.some(t => t.toLowerCase().includes(q))
        );
    }, [searchQuery]);

    const groupedLessons = useMemo<Record<string, Lesson[]>>(() => {
        const groups: Record<string, Lesson[]> = {};
        filteredLessons.forEach(l => {
            if (!groups[l.category]) groups[l.category] = [];
            groups[l.category].push(l);
        });
        return groups;
    }, [filteredLessons]);

    const progress = Math.round((completed.size / lessons.length) * 100);

    const handleCopyCode = () => {
        if (!activeLesson) return;
        navigator.clipboard.writeText(activeLesson.code);
        setCopied(true);
        toastService.success('SQL 代码已复制到剪贴板');
        setTimeout(() => setCopied(false), 2000);
    };

    const handleRunCode = () => {
        if (!activeLesson) return;
        onTryCode(activeLesson.code);
        if (!completed.has(activeLesson.id)) {
            toggleComplete(activeLesson.id);
        }
    };

    return (
        <div className="flex h-full flex-col overflow-hidden bg-monokai-bg text-monokai-fg font-sans">
            <PageHeader
                title="SQL 互动教学工作坊"
                description="沉浸式实战教程，覆盖从基础过滤聚合、正则清洗、时序窗口到全文检索与地理扩展"
                icon={GraduationCap}
                actions={
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 h-8 rounded-md border border-monokai-border bg-monokai-surface px-3 text-xs text-monokai-comment">
                            <span className="font-medium text-monokai-fg">学习进度</span>
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-monokai-bg border border-monokai-border">
                                <div
                                    className="h-full bg-monokai-green transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <span className="font-mono text-monokai-fg font-semibold">{progress}%</span>
                            <span className="text-[10px] text-monokai-comment font-mono">({completed.size}/{lessons.length})</span>
                        </div>
                    </div>
                }
            />

            <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* ── 左侧：课程导航大纲 ── */}
                <aside className="flex w-80 shrink-0 flex-col border-r border-monokai-border bg-monokai-sidebar font-sans">
                    <div className="p-3 border-b border-monokai-border bg-monokai-surface">
                        <SearchInput
                            value={searchQuery}
                            onChange={setSearchQuery}
                            onClear={() => setSearchQuery('')}
                            placeholder="搜索课程章节或关键字..."
                            className="w-full"
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-1.5">
                        {Object.entries(groupedLessons).map(([category, items]) => {
                            const isExpanded = expandedCategories.has(category);
                            const catCompletedCount = items.filter(i => completed.has(i.id)).length;
                            return (
                                <div key={category} className="rounded-md border border-monokai-border overflow-hidden bg-monokai-surface/60">
                                    <button
                                        type="button"
                                        onClick={() => toggleCategory(category)}
                                        className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-monokai-fg hover:bg-monokai-surface transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2">
                                            {isExpanded ? (
                                                <ChevronDown className="h-3.5 w-3.5 text-monokai-comment" />
                                            ) : (
                                                <ChevronRight className="h-3.5 w-3.5 text-monokai-comment" />
                                            )}
                                            <span className="tracking-wide">{category}</span>
                                        </div>
                                        <span className="font-mono text-[10px] text-monokai-comment">
                                            {catCompletedCount}/{items.length}
                                        </span>
                                    </button>

                                    {isExpanded && (
                                        <div className="space-y-0.5 px-1.5 pb-1.5 pt-0.5 border-t border-monokai-border/40">
                                            {items.map(lesson => {
                                                const isSelected = selectedId === lesson.id;
                                                const isDone = completed.has(lesson.id);
                                                const badge = DIFFICULTY_BADGES[lesson.difficulty];
                                                return (
                                                    <button
                                                        key={lesson.id}
                                                        type="button"
                                                        onClick={() => setSelectedId(lesson.id)}
                                                        className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors cursor-pointer ${
                                                            isSelected
                                                                ? 'bg-monokai-elevated text-monokai-fg font-medium'
                                                                : 'text-monokai-fg-muted hover:bg-monokai-surface hover:text-monokai-fg'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            {isDone ? (
                                                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-monokai-green" />
                                                            ) : (
                                                                <span className="h-2 w-2 rounded-full border border-monokai-comment/60 shrink-0" />
                                                            )}
                                                            <span className="truncate">{lesson.title}</span>
                                                        </div>
                                                        <span className={`shrink-0 rounded px-1.5 py-0.2 text-[9px] font-mono font-medium border ${badge.bg} ${badge.text} ${badge.border}`}>
                                                            {badge.label}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </aside>

                {/* ── 右侧：课程沉浸工作区 ── */}
                <main className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-monokai-bg font-sans">
                    {activeLesson ? (
                        <div className="mx-auto max-w-4xl space-y-4">
                            {/* 头部元数据 */}
                            <div className="rounded-md border border-monokai-border bg-monokai-surface p-5 shadow-xs">
                                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-monokai-border pb-3">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-mono font-semibold uppercase tracking-wider text-monokai-comment">
                                            {activeLesson.category}
                                        </span>
                                        <span className="text-monokai-border">/</span>
                                        <span
                                            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                                                DIFFICULTY_BADGES[activeLesson.difficulty].bg
                                            } ${DIFFICULTY_BADGES[activeLesson.difficulty].text} ${
                                                DIFFICULTY_BADGES[activeLesson.difficulty].border
                                            }`}
                                        >
                                            {DIFFICULTY_BADGES[activeLesson.difficulty].label}难度
                                        </span>
                                    </div>
                                    <ActionButton
                                        variant={completed.has(activeLesson.id) ? 'success' : 'secondary'}
                                        icon={completed.has(activeLesson.id) ? CheckCircle2 : Check}
                                        onClick={() => toggleComplete(activeLesson.id)}
                                        size="sm"
                                    >
                                        {completed.has(activeLesson.id) ? '已完成学习' : '标记为已完成'}
                                    </ActionButton>
                                </div>

                                <div className="mt-4 space-y-2">
                                    <h1 className="text-xl font-bold text-monokai-fg sm:text-2xl">{activeLesson.title}</h1>
                                    <p className="text-sm leading-relaxed text-monokai-comment">{activeLesson.description}</p>
                                    <div className="flex flex-wrap gap-1.5 pt-2">
                                        {activeLesson.tags.map(tag => (
                                            <span
                                                key={tag}
                                                className="rounded border border-monokai-border bg-monokai-bg px-2 py-0.5 text-[11px] font-mono text-monokai-fg-muted"
                                            >
                                                #{tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* 为什么重要？ */}
                            <div className="rounded-md border border-monokai-border bg-monokai-surface p-4 shadow-xs">
                                <div className="flex items-center gap-2 text-xs font-semibold text-monokai-fg">
                                    <Sparkles className="h-4 w-4 text-monokai-accent" />
                                    <span>核心价值与实战背景 (Why It Matters)</span>
                                </div>
                                <p className="mt-2 text-xs leading-relaxed text-monokai-fg-muted">
                                    {activeLesson.whyItMatters}
                                </p>
                            </div>

                            {/* 示例 SQL 执行卡片 */}
                            <div className="rounded-md border border-monokai-border bg-monokai-surface overflow-hidden shadow-xs">
                                <div className="flex items-center justify-between border-b border-monokai-border bg-monokai-elevated/40 px-4 py-2.5">
                                    <div className="flex items-center gap-2">
                                        <Code2 className="h-4 w-4 text-monokai-comment" />
                                        <span className="font-mono text-xs font-semibold text-monokai-fg">实战演练 SQL (Interactive Query)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <ActionButton
                                            variant="ghost"
                                            size="sm"
                                            icon={copied ? Check : Copy}
                                            onClick={handleCopyCode}
                                        >
                                            {copied ? '已复制' : '复制 SQL'}
                                        </ActionButton>
                                        <ActionButton
                                            variant="primary"
                                            size="sm"
                                            icon={Play}
                                            onClick={handleRunCode}
                                        >
                                            带入 SQL 执行
                                        </ActionButton>
                                    </div>
                                </div>

                                <div className="p-4 bg-monokai-bg overflow-x-auto">
                                    <pre className="font-mono text-xs leading-relaxed text-monokai-fg m-0">
                                        <code>{activeLesson.code}</code>
                                    </pre>
                                </div>
                            </div>

                            {/* 底部翻页导航 */}
                            <div className="flex items-center justify-between border-t border-monokai-border pt-4">
                                {activeIndex > 0 ? (
                                    <ActionButton
                                        variant="secondary"
                                        icon={ArrowLeft}
                                        onClick={() => setSelectedId(lessons[activeIndex - 1].id)}
                                    >
                                        上一课：{lessons[activeIndex - 1].title}
                                    </ActionButton>
                                ) : <div />}

                                {activeIndex < lessons.length - 1 ? (
                                    <ActionButton
                                        variant="primary"
                                        icon={ArrowRight}
                                        iconPosition="right"
                                        onClick={() => {
                                            if (!completed.has(activeLesson.id)) toggleComplete(activeLesson.id);
                                            setSelectedId(lessons[activeIndex + 1].id);
                                        }}
                                    >
                                        下一课：{lessons[activeIndex + 1].title}
                                    </ActionButton>
                                ) : (
                                    <span className="text-xs text-monokai-green font-medium flex items-center gap-1.5">
                                        <CheckCircle2 className="h-4 w-4" /> 您已浏览完所有实战课程！
                                    </span>
                                )}
                            </div>
                        </div>
                    ) : null}
                </main>
            </div>
        </div>
    );
};
