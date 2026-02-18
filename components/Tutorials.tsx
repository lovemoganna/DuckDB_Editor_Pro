import React, { useState, useEffect, useMemo } from 'react';


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
        title: 'Basic SELECT & Filtering',
        difficulty: 'Beginner',
        tags: ['SELECT', 'WHERE', 'LIMIT'],
        description: 'The foundation of SQL. Learn how to retrieve specific columns and filter rows to find exactly what you need.',
        whyItMatters: '90% of data work involves simply finding the right data points. Mastering WHERE clauses allows you to slice data with precision.',
        code: `SELECT \n  operation_type, \n  target_table, \n  log_time \nFROM memory._sys_audit_log \nWHERE affected_rows > 0 \nORDER BY log_time DESC \nLIMIT 5;`
    },
    {
        id: 'aggr_01',
        category: 'Foundations',
        title: 'Aggregations & Grouping',
        difficulty: 'Beginner',
        tags: ['GROUP BY', 'COUNT', 'AVG'],
        description: 'Summarize data to find trends. Count logs, average values, or find maximums per category.',
        whyItMatters: 'Raw data is noisy. Aggregation turns rows of data into actionable insights and metrics.',
        code: `SELECT \n  operation_type,\n  COUNT(*) as total_ops,\n  SUM(affected_rows) as total_affected\nFROM memory._sys_audit_log\nGROUP BY operation_type\nORDER BY total_ops DESC;`
    },
    // --- DATA CLEANING ---
    {
        id: 'clean_01',
        category: 'Data Cleaning',
        title: 'Cleaning with RegEx',
        difficulty: 'Intermediate',
        tags: ['RegEx', 'Extract'],
        description: 'Use Regular Expressions to extract specific patterns from messy text fields.',
        whyItMatters: 'Real-world data is dirty. Extracting IDs, emails, or codes from unstructured text blocks is a daily task for engineers.',
        code: `-- Extract the first word from the details column\nSELECT \n  details,\n  regexp_extract(details, '^([a-zA-Z]+)', 1) as first_word,\n  regexp_replace(details, 'Imported', 'LOADED') as cleaned\nFROM memory._sys_audit_log\nLIMIT 5;`
    },
    {
        id: 'clean_02',
        category: 'Data Cleaning',
        title: 'Handling Nulls',
        difficulty: 'Intermediate',
        tags: ['COALESCE', 'NULL'],
        description: 'Gracefully handle missing data using COALESCE to provide default values.',
        whyItMatters: 'NULLs break applications. Ensuring your API or report always returns a valid value prevents downstream crashes.',
        code: `SELECT \n  target_table,\n  affected_rows,\n  COALESCE(target_table, 'UNKNOWN_TABLE') as safe_table,\n  COALESCE(affected_rows, 0) as safe_rows\nFROM memory._sys_audit_log;`
    },
    {
        id: 'fuzzy_01',
        category: 'Data Cleaning',
        title: 'Fuzzy Matching',
        difficulty: 'Advanced',
        tags: ['Jaro-Winkler', 'Levenshtein'],
        description: 'Match strings that are similar but not identical (e.g., typos, variations) using distance algorithms.',
        whyItMatters: 'Match customers across systems even when names are spelled slightly differently.',
        code: `-- 1. Create dirty data\nCREATE OR REPLACE TABLE customers (name VARCHAR);\nINSERT INTO customers VALUES ('Jon Smith'), ('John Smith'), ('Jhon Smyth'), ('Alice');\n\n-- 2. Find Similarities to 'John Smith'\nSELECT \n  name,\n  jaro_winkler_similarity(name, 'John Smith') as similarity,\n  levenshtein(name, 'John Smith') as edit_distance\nFROM customers\nORDER BY similarity DESC;`
    },
    // --- COMPLEX TYPES ---
    {
        id: 'struct_01',
        category: 'Complex Types',
        title: 'Structs & Nested Data',
        difficulty: 'Advanced',
        tags: ['STRUCT', 'LIST'],
        description: 'DuckDB excels at handling nested data types without needing to JOIN multiple tables.',
        whyItMatters: 'Modern data (JSON, Parquet) is hierarchical. Structs allow you to keep related data (like an address) packaged together efficiently.',
        code: `-- Create a list of structs on the fly\nSELECT \n  1 as id,\n  {'street': '123 Main St', 'city': 'Duckburg'} as address,\n  [100, 200, 300] as scores\nUNION ALL\nSELECT \n  2, {'street': '456 Web Way', 'city': 'BrowserCity'}, [50, 60];`
    },
    {
        id: 'unnest_01',
        category: 'Complex Types',
        title: 'Unnesting Arrays',
        difficulty: 'Advanced',
        tags: ['UNNEST', 'Flatten'],
        description: 'Explode a list column into multiple rows to analyze individual elements.',
        whyItMatters: 'When data comes as a list (e.g., tags on a blog post), you need to unnest it to count how many times each tag appears.',
        code: `-- 1. Create data with lists\nWITH posts AS (\n  SELECT 1 as id, ['sql', 'duckdb', 'analytics'] as tags\n  UNION ALL SELECT 2, ['sql', 'beginner']\n)\n-- 2. Flatten and Count\nSELECT \n  unnest(tags) as tag, \n  COUNT(*) as frequency \nFROM posts \nGROUP BY 1 \nORDER BY 2 DESC;`
    },
    {
        id: 'lambdas_01',
        category: 'Complex Types',
        title: 'List Lambdas',
        difficulty: 'Advanced',
        tags: ['Lambda', 'Functional'],
        description: 'Apply functions to every element in a list directly in SQL using the arrow (->) syntax.',
        whyItMatters: 'Avoids unnesting (exploding) arrays just to filter or transform them. Extremely fast for vector operations.',
        code: `-- Filter and Transform list elements in place\nWITH data AS (SELECT [1, 2, 3, 4, 5] as numbers)\nSELECT \n  numbers,\n  list_filter(numbers, x -> x > 2) as gt_two,\n  list_transform(numbers, x -> x * 2) as doubled\nFROM data;`
    },
    {
        id: 'json_create_01',
        category: 'Complex Types',
        title: 'Creating JSON',
        difficulty: 'Advanced',
        tags: ['JSON', 'API'],
        description: 'Convert relational table data into JSON documents directly in the database.',
        whyItMatters: 'Prepare data for API responses or NoSQL databases without needing middleware transformation loops.',
        code: `-- Convert table rows to a JSON array of objects\nSELECT \n  json_group_array(json_object(\n    'type': operation_type, \n    'table': target_table, \n    'meta': {'rows': affected_rows}\n  ))\nFROM memory._sys_audit_log\nLIMIT 3;`
    },
    // --- TIME SERIES ---
    {
        id: 'time_01',
        category: 'Time Series',
        title: 'Time Bucketing',
        difficulty: 'Advanced',
        tags: ['Date_Trunc', 'Interval'],
        description: 'Powerful functions to bucket time and calculate durations.',
        whyItMatters: 'Aggregating by "Day" or "Hour" is the most common analytics task. DuckDB makes this trivial.',
        code: `SELECT \n  date_trunc('minute', log_time) as minute_bucket,\n  count(*) as events,\n  max(log_time) - min(log_time) as duration\nFROM memory._sys_audit_log\nGROUP BY 1\nORDER BY 1 DESC;`
    },
    {
        id: 'window_01',
        category: 'Time Series',
        title: 'Moving Averages',
        difficulty: 'Advanced',
        tags: ['Window', 'Analytics'],
        description: 'Calculate rolling averages to smooth out noisy data and identify trends.',
        whyItMatters: 'Essential for financial and monitoring dashboards. It filters out short-term fluctuations to show the longer-term trend.',
        code: `-- 1. Create sample stock data\nCREATE OR REPLACE TABLE stock (day INT, price DOUBLE);\nINSERT INTO stock VALUES (1, 10), (2, 12), (3, 11), (4, 15), (5, 14), (6, 18);\n\n-- 2. Calculate 3-Day Moving Average\nSELECT \n  day, price,\n  AVG(price) OVER (ORDER BY day ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) as moving_avg\nFROM stock;`
    },
    {
        id: 'yoy_01',
        category: 'Time Series',
        title: 'Year-Over-Year Growth',
        difficulty: 'Advanced',
        tags: ['LAG', 'Window', 'Finance'],
        description: 'Compare current values with values from a previous period using the LAG function.',
        whyItMatters: 'The standard metric for growth. Are we doing better than last month/year?',
        code: `-- 1. Monthly Revenue Data\nCREATE OR REPLACE TABLE revenue (month INT, amount INT);\nINSERT INTO revenue VALUES (1, 1000), (2, 1100), (3, 1050), (4, 1300);\n\n-- 2. Calculate Growth\nSELECT \n  month, amount,\n  LAG(amount) OVER (ORDER BY month) as prev_month,\n  amount - LAG(amount) OVER (ORDER BY month) as diff,\n  ROUND((amount - LAG(amount) OVER (ORDER BY month)) / LAG(amount) OVER (ORDER BY month) * 100, 1) || '%' as growth_pct\nFROM revenue;`
    },
    // --- ANALYTICS ---
    {
        id: 'pivot_01',
        category: 'Analytics',
        title: 'Pivot Tables',
        difficulty: 'Advanced',
        tags: ['Pivot', 'Reshaping'],
        description: 'Transform rows into columns. Create cross-tabulation reports natively in SQL.',
        whyItMatters: 'Business users love "wide" data (like Excel Pivot Tables). It allows for easier side-by-side comparison of categories.',
        code: `-- 1. Create sample data\nCREATE OR REPLACE TABLE sales (region VARCHAR, product VARCHAR, amount INT);\nINSERT INTO sales VALUES ('North', 'A', 100), ('North', 'B', 50), ('South', 'A', 200), ('South', 'B', 150);\n\n-- 2. Pivot Products to Columns\nPIVOT sales ON product USING SUM(amount);`
    },
    {
        id: 'cohort_01',
        category: 'Analytics',
        title: 'Cohort Analysis',
        difficulty: 'Advanced',
        tags: ['Self-Join', 'Retention'],
        description: 'Calculate retention rates by grouping users into cohorts based on their first activity date.',
        whyItMatters: 'The gold standard of SaaS metrics. It tells you if users are coming back after their first visit.',
        code: `-- 1. Generate sample data\nCREATE OR REPLACE TABLE activity (user_id INT, action_date DATE);\nINSERT INTO activity VALUES \n (1, '2023-01-01'), (2, '2023-01-01'), (1, '2023-02-01'), \n (3, '2023-02-01'), (2, '2023-02-01'), (3, '2023-03-01');\n\n-- 2. Calculate Cohort\nWITH first_seen AS (\n  SELECT user_id, min(action_date) as cohort_month \n  FROM activity GROUP BY user_id\n)\nSELECT \n  f.cohort_month,\n  a.action_date,\n  COUNT(DISTINCT f.user_id) as users\nFROM first_seen f\nJOIN activity a ON f.user_id = a.user_id\nGROUP BY 1, 2\nORDER BY 1, 2;`
    },
    {
        id: 'rank_01',
        category: 'Analytics',
        title: 'Ranking & Top-N',
        difficulty: 'Advanced',
        tags: ['RANK', 'Window'],
        description: 'Assign a rank to each row within a partition of a result set.',
        whyItMatters: 'Find the top 3 salesmen per region, or the most recent log entry per user. Standard LIMIT cannot do this per-group.',
        code: `-- 1. Create sample scores\nCREATE OR REPLACE TABLE scores (team VARCHAR, player VARCHAR, score INT);\nINSERT INTO scores VALUES ('A', 'Alice', 50), ('A', 'Bob', 40), ('A', 'Charlie', 45), ('B', 'Dave', 60), ('B', 'Eve', 55);\n\n-- 2. Find Top 2 Players per Team\nSELECT * FROM (\n  SELECT \n    team, player, score,\n    RANK() OVER (PARTITION BY team ORDER BY score DESC) as rank\n  FROM scores\n) WHERE rank <= 2;`
    },
    // --- UTILITIES ---
    {
        id: 'macro_01',
        category: 'Utilities',
        title: 'SQL Macros',
        difficulty: 'Advanced',
        tags: ['Macro', 'Reuse'],
        description: 'Create reusable parameterized queries that act like functions but expand at compile time.',
        whyItMatters: 'Don\'t repeat yourself (DRY). Macros let you encapsulate complex logic (like tax calculations) and reuse it everywhere.',
        code: `-- Create a macro to convert Celsius to Fahrenheit\nCREATE OR REPLACE MACRO c_to_f(c) AS (c * 9/5) + 32;\n\n-- Use it in a query\nSELECT \n  25 as temp_c, \n  c_to_f(25) as temp_f;`
    },
    {
        id: 'sampling_01',
        category: 'Utilities',
        title: 'Data Sampling',
        difficulty: 'Intermediate',
        tags: ['SAMPLE', 'Exploration'],
        description: 'Get a random subset of your data for quick analysis without processing the entire dataset.',
        whyItMatters: 'When working with millions of rows, sampling allows you to test queries and get quick estimates almost instantly.',
        code: `-- Get a 10% sample of the audit log\nSELECT * \nFROM memory._sys_audit_log \nUSING SAMPLE 10%;\n\n-- Or get a fixed number of rows\n-- SELECT * FROM memory._sys_audit_log USING SAMPLE 5 ROWS;`
    },
    {
        id: 'gen_01',
        category: 'Utilities',
        title: 'Synthetic Data Gen',
        difficulty: 'Intermediate',
        tags: ['Range', 'Testing'],
        description: 'Create massive datasets on the fly using generate_series and range functions.',
        whyItMatters: 'Need to test performance or prototype a schema but have no data? DuckDB can generate millions of rows instantly.',
        code: `-- Generate 1000 rows with random values\nSELECT \n  range as id, \n  random() as score, \n  'User-' || (range % 10) as category \nFROM range(1000);`
    },
    // --- EXTENSIONS ---
    {
        id: 'fts_01',
        category: 'Extensions',
        title: 'Full Text Search (FTS)',
        difficulty: 'Expert',
        tags: ['FTS', 'Search', 'BM25'],
        description: 'Build a search engine inside DuckDB using the FTS extension with BM25 scoring.',
        whyItMatters: 'Standard LIKE queries are slow and dumb. FTS provides ranked, stemmed, and high-performance search capabilities.',
        code: `-- 1. Load Extension & Create Data\nINSTALL fts; LOAD fts;\nCREATE OR REPLACE TABLE documents (id INT, title VARCHAR, content VARCHAR);\nINSERT INTO documents VALUES \n (1, 'DuckDB Intro', 'DuckDB is an in-process SQL OLAP database management system'),\n (2, 'SQL Guide', 'Structured Query Language is a domain-specific language'),\n (3, 'Vector Search', 'Search using embeddings and vectors');\n\n-- 2. Build Index\nPRAGMA create_fts_index('documents', 'id', 'content');\n\n-- 3. Search Ranked\nSELECT id, title, score \nFROM (SELECT *, fts_main_documents.match_bm25(id, 'database language') as score FROM documents)\nWHERE score IS NOT NULL \nORDER BY score DESC;`
    },
    {
        id: 'geo_01',
        category: 'Extensions',
        title: 'Spatial Analysis',
        difficulty: 'Expert',
        tags: ['Spatial', 'GIS', 'Distance'],
        description: 'Perform geospatial calculations using the Spatial extension.',
        whyItMatters: 'Calculate distances between cities or find points within a polygon without external GIS tools.',
        code: `-- 1. Load Extension\nINSTALL spatial; LOAD spatial;\n\n-- 2. Calculate Distance (London to NYC approx)\n-- ST_Point(Lat, Lon)\nSELECT \n  st_distance(\n    st_point(51.5, -0.1),\n    st_point(40.7, -74.0)\n  ) as distance_deg;`
    }
];

interface TutorialsProps {
    onTryCode: (code: string) => void;
}

export const Tutorials: React.FC<TutorialsProps> = ({ onTryCode }) => {
    const [selectedId, setSelectedId] = useState<string>(lessons[0].id);
    const [completed, setCompleted] = useState<Set<string>>(new Set());
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Foundations', 'Extensions', 'Analytics']));

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
        } catch (e) { }
    }, []);

    const toggleComplete = (id: string) => {
        const newSet = new Set(completed);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setCompleted(newSet);
        localStorage.setItem('duckdb_tutorials_progress', JSON.stringify(Array.from(newSet)));
    };

    const toggleCategory = (cat: string) => {
        const newSet = new Set(expandedCategories);
        if (newSet.has(cat)) newSet.delete(cat);
        else newSet.add(cat);
        setExpandedCategories(newSet);
    };

    const groupedLessons = useMemo<Record<string, Lesson[]>>(() => {
        const groups: Record<string, Lesson[]> = {};
        lessons.forEach(l => {
            if (!groups[l.category]) groups[l.category] = [];
            groups[l.category].push(l);
        });
        return groups;
    }, []);

    const progress = Math.round((completed.size / lessons.length) * 100);

    return (
        <div className="h-full flex bg-monokai-bg overflow-hidden">
            {/* Sidebar List */}
            <div className="w-80 border-r border-monokai-accent flex flex-col shrink-0 bg-monokai-sidebar/50">
                <div className="p-4 border-b border-monokai-accent bg-monokai-sidebar">
                    <h2 className="text-lg font-bold text-monokai-fg flex items-center gap-2">
                        <span>📚</span> SQL Mastery
                    </h2>
                    <div className="mt-3">
                        <div className="flex justify-between text-[10px] text-monokai-comment mb-1 font-mono uppercase">
                            <span>Progress</span>
                            <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-monokai-bg h-1.5 rounded-full overflow-hidden">
                            <div className="bg-gradient-to-r from-monokai-green to-monokai-blue h-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                        </div>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {Object.entries(groupedLessons).map(([category, items]: [string, Lesson[]]) => (
                        <div key={category} className="border-b border-monokai-accent/30">
                            <div
                                className="p-3 flex justify-between items-center cursor-pointer hover:bg-monokai-accent/20 bg-[#22231e]"
                                onClick={() => toggleCategory(category)}
                            >
                                <span className="text-xs font-bold text-monokai-fg uppercase tracking-wider">{category}</span>
                                <span className="text-[10px] text-monokai-comment">{expandedCategories.has(category) ? '▼' : '▶'}</span>
                            </div>

                            {expandedCategories.has(category) && items.map(lesson => {
                                const isCompleted = completed.has(lesson.id);
                                return (
                                    <div
                                        key={lesson.id}
                                        onClick={() => setSelectedId(lesson.id)}
                                        className={`pl-6 p-3 border-l-4 cursor-pointer transition-all duration-200 group relative ${selectedId === lesson.id ? 'bg-monokai-accent/40 border-l-monokai-pink' : 'hover:bg-monokai-accent/20 border-l-transparent'}`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <h3 className={`text-xs font-bold flex items-center gap-2 ${selectedId === lesson.id ? 'text-white' : 'text-monokai-fg group-hover:text-monokai-blue'}`}>
                                                {isCompleted && <span className="text-monokai-green">✓</span>}
                                                {lesson.title}
                                            </h3>
                                        </div>
                                        <div className="flex gap-2">
                                            <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-bold opacity-80 ${lesson.difficulty === 'Beginner' ? 'text-monokai-green bg-monokai-green/10' :
                                                lesson.difficulty === 'Intermediate' ? 'text-monokai-orange bg-monokai-orange/10' :
                                                    lesson.difficulty === 'Advanced' ? 'text-monokai-purple bg-monokai-purple/10' :
                                                        'text-monokai-blue bg-monokai-blue/10'
                                                }`}>
                                                {lesson.difficulty}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-8 relative scroll-smooth">
                <div className="max-w-4xl mx-auto pb-20">
                    {/* Header */}
                    <header className="mb-8 border-b border-monokai-accent pb-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-3 mb-4">
                                    <span className="text-xs font-bold text-monokai-comment uppercase tracking-widest">{activeLesson.category}</span>
                                    <span className="text-monokai-comment">/</span>
                                    <span className={`text-xs font-bold px-3 py-1 rounded-full border ${activeLesson.difficulty === 'Beginner' ? 'border-monokai-green text-monokai-green' :
                                        activeLesson.difficulty === 'Intermediate' ? 'border-monokai-orange text-monokai-orange' :
                                            activeLesson.difficulty === 'Advanced' ? 'border-monokai-purple text-monokai-purple' :
                                                'border-monokai-blue text-monokai-blue'
                                        }`}>
                                        {activeLesson.difficulty}
                                    </span>
                                </div>
                                <h1 className="text-4xl font-bold text-white mb-4 leading-tight">{activeLesson.title}</h1>
                                <p className="text-lg text-monokai-fg/80 leading-relaxed">{activeLesson.description}</p>
                                <div className="flex gap-2 mt-4">
                                    {activeLesson.tags.map(tag => (
                                        <span key={tag} className="text-xs text-monokai-blue bg-monokai-blue/10 px-2 py-1 rounded font-mono">#{tag}</span>
                                    ))}
                                </div>
                            </div>
                            <button
                                onClick={() => toggleComplete(activeLesson.id)}
                                className={`px-4 py-2 rounded-full border text-sm font-bold flex items-center gap-2 transition-all ${completed.has(activeLesson.id) ? 'bg-monokai-green text-monokai-bg border-monokai-green' : 'border-monokai-comment text-monokai-comment hover:border-monokai-green hover:text-monokai-green'}`}
                            >
                                {completed.has(activeLesson.id) ? '✓ Completed' : '○ Mark Complete'}
                            </button>
                        </div>
                    </header>

                    {/* Why It Matters */}
                    <section className="mb-8 bg-monokai-sidebar/30 p-6 rounded-lg border-l-4 border-monokai-blue backdrop-blur-sm">
                        <h3 className="text-monokai-blue font-bold uppercase text-xs tracking-wider mb-2">Why This Matters</h3>
                        <p className="text-monokai-fg italic">"{activeLesson.whyItMatters}"</p>
                    </section>

                    {/* Code Block */}
                    <section className="mb-12">
                        <div className="flex justify-between items-end mb-3">
                            <h3 className="text-monokai-yellow font-bold uppercase text-xs tracking-wider">Example Query</h3>
                            <button
                                onClick={() => {
                                    onTryCode(activeLesson.code);
                                    if (!completed.has(activeLesson.id)) toggleComplete(activeLesson.id);
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-monokai-green hover:bg-monokai-green/80 text-monokai-bg font-bold rounded shadow-lg shadow-monokai-green/20 transition-all hover:translate-y-[-1px]"
                            >
                                <span>▶</span> Run & Complete
                            </button>
                        </div>
                        <div className="bg-[#1e1f1c] rounded-lg border border-monokai-accent overflow-hidden shadow-2xl">
                            <div className="flex items-center gap-2 px-4 py-2 bg-[#2a2b24] border-b border-monokai-accent">
                                <div className="w-3 h-3 rounded-full bg-monokai-pink/50"></div>
                                <div className="w-3 h-3 rounded-full bg-monokai-yellow/50"></div>
                                <div className="w-3 h-3 rounded-full bg-monokai-green/50"></div>
                                <span className="ml-2 text-xs text-monokai-comment font-mono">query.sql</span>
                            </div>
                            <div className="p-6 overflow-x-auto">
                                <pre className="text-sm font-mono !bg-transparent !m-0 !p-0">
                                    <code className="language-sql select-text">
                                        {activeLesson.code}
                                    </code>
                                </pre>
                            </div>
                        </div>
                    </section>

                    {/* Navigation Footer */}
                    <div className="flex justify-between items-center pt-8 border-t border-monokai-accent">
                        {activeIndex > 0 ? (
                            <button
                                onClick={() => setSelectedId(lessons[activeIndex - 1].id)}
                                className="px-6 py-3 rounded-lg border border-monokai-accent hover:border-monokai-blue hover:text-white text-monokai-comment font-bold transition-all flex items-center gap-2"
                            >
                                ← Previous Lesson
                            </button>
                        ) : <div></div>}

                        {activeIndex < lessons.length - 1 && (
                            <button
                                onClick={() => {
                                    if (!completed.has(activeLesson.id)) toggleComplete(activeLesson.id);
                                    setSelectedId(lessons[activeIndex + 1].id);
                                }}
                                className="px-6 py-3 rounded-lg bg-monokai-blue text-monokai-bg hover:bg-white hover:scale-105 font-bold transition-all shadow-lg flex items-center gap-2"
                            >
                                Next Lesson →
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};