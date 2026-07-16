/**
 * DQLPanel - DQL 数据查询语言面板
 * 
 * 显示 DQL 相关内容：基础检索、排序、WHERE 条件、多表关联、聚合分组、子查询、窗口函数
 * 基于"我的人生"本体论数据模型
 */

import React, { useState, useCallback } from 'react';
import { Copy, Check, Search, Filter, Table, Calculator, GitBranch, FunctionSquare, Database, ArrowRight, Play, ChevronDown, ChevronUp } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { EditorView } from '@codemirror/view';
import { monokai } from '@uiw/codemirror-theme-monokai';
import { duckDBService } from '../../services/duckdbService';
import { ResultTable } from '../Learn/ResultTable';

interface DQLPanelProps {
  onCopy?: (id: string, content: string) => void;
  onInsert?: (sql: string) => void;
  copiedId?: string | null;
}

interface ExecutionResult {
  data: any[] | null;
  error: string | null;
  loading: boolean;
  executionTime?: number;
}

// SQL 代码片段
interface SqlSnippet {
  label: string;
  sql: string;
  description?: string;
}

const DQL_DATA: {
  id: string;
  title: string;
  category: string;
  snippets: SqlSnippet[];
  description?: string;
}[] = [
  {
    id: 'basic-select',
    title: '基础检索与排序',
    category: '基础',
    description: 'SELECT、ORDER BY、LIMIT、DISTINCT 等基础语法',
    snippets: [
      {
        label: '选择列',
        sql: `-- 查询本体对象的标题、状态和创建时间
SELECT title, status, created_at FROM life_object;`,
        description: '指定列查询'
      },
      {
        label: '去重',
        sql: `SELECT DISTINCT status FROM life_object;`,
        description: '去除重复行'
      },
      {
        label: '列别名',
        sql: `SELECT title AS entity_name, created_at AS discovered_date FROM life_object;`,
        description: '使用 AS 设置别名'
      },
      {
        label: 'DuckDB EXCLUDE',
        sql: `SELECT * EXCLUDE (updated_at) FROM life_object;`,
        description: '排除指定列'
      },
      {
        label: 'DuckDB REPLACE',
        sql: `SELECT * REPLACE ('archived' AS status) FROM life_object;`,
        description: '替换列值'
      },
      {
        label: 'LIMIT 和 OFFSET',
        sql: `SELECT * FROM life_object LIMIT 10 OFFSET 5;`,
        description: '分页查询'
      },
      {
        label: '排序 ASC/DESC',
        sql: `SELECT * FROM life_object ORDER BY created_at DESC;`,
        description: '降序排序'
      },
      {
        label: '多列排序',
        sql: `SELECT * FROM life_object ORDER BY status ASC, created_at DESC;`,
        description: '先按状态再按时间排序'
      },
      {
        label: 'NULL 排序控制',
        sql: `SELECT * FROM life_object ORDER BY updated_at NULLS LAST;`,
        description: 'NULL 值排在最后'
      }
    ]
  },
  {
    id: 'where',
    title: '条件过滤 (WHERE)',
    category: '过滤',
    description: 'WHERE 子句实现数据过滤',
    snippets: [
      {
        label: '基本比较',
        sql: `SELECT * FROM life_object WHERE status = 'active';`,
        description: '等于条件'
      },
      {
        label: 'IN 列表',
        sql: `SELECT * FROM life_object WHERE status IN ('active', 'flagged');`,
        description: '多值匹配'
      },
      {
        label: 'LIKE 模糊匹配',
        sql: `SELECT * FROM life_object WHERE title LIKE 'A%';`,
        description: '以 A 开头'
      },
      {
        label: 'BETWEEN 范围',
        sql: `SELECT * FROM life_object WHERE created_at BETWEEN '2024-03-01' AND '2024-04-30';`,
        description: '日期范围查询'
      },
      {
        label: 'NULL 判断',
        sql: `SELECT * FROM life_object WHERE updated_at IS NULL;`,
        description: '空值查询'
      },
      {
        label: 'AND 组合',
        sql: `SELECT * FROM life_object WHERE status = 'active' AND life_life_object = 1;`,
        description: '多条件与'
      },
      {
        label: 'OR 组合',
        sql: `SELECT * FROM life_object WHERE status = 'flagged' OR status = 'archived';`,
        description: '多条件或'
      },
      {
        label: '正则表达式',
        sql: `SELECT * FROM life_object WHERE regexp_matches(title, '^[A-Z][a-z]+');`,
        description: '正则匹配'
      }
    ]
  },
  {
    id: 'joins',
    title: '多表关联 (JOINs)',
    category: '关联',
    description: 'INNER/LEFT/RIGHT/FULL/CROSS/SELF/LATERAL/ASOF JOIN',
    snippets: [
      {
        label: 'INNER JOIN',
        sql: `SELECT o.name, o.properties['state']::VARCHAR, ot.name AS life_object_type_name
FROM life_object o
INNER JOIN life_object_type ot ON o.life_life_object = ot.id;`,
        description: '内连接'
      },
      {
        label: 'LEFT JOIN',
        sql: `SELECT o.name, ot.name AS type_name
FROM life_object o
LEFT JOIN life_object_type ot ON o.life_life_object = ot.id;`,
        description: '左外连接'
      },
      {
        label: 'RIGHT JOIN',
        sql: `SELECT o.name, ot.name AS type_name
FROM life_object o
RIGHT JOIN life_object_type ot ON o.life_life_object = ot.id;`,
        description: '右外连接'
      },
      {
        label: 'FULL OUTER JOIN',
        sql: `SELECT o.name, ot.name AS type_name
FROM life_object o
FULL OUTER JOIN life_object_type ot ON o.life_life_object = ot.id;`,
        description: '全外连接'
      },
      {
        label: '自连接',
        sql: `SELECT ot1.name AS type_name, ot2.name AS source_type
FROM life_object_type ot1
LEFT JOIN life_link_type ds ON ot1.life_link_type_id = ds.id
LEFT JOIN life_object_type ot2 ON ds.id = ot2.life_link_type_id;`,
        description: '表自身连接'
      },
      {
        label: 'LATERAL JOIN',
        sql: `SELECT o.name, link_info.*
FROM life_object o,
LATERAL (
  SELECT ll.weight, ll.id
  FROM life_link ol
  WHERE ol.source_object = o.id OR ol.target_object = o.id
  ORDER BY ol.confidence DESC LIMIT 1
) AS link_info;`,
        description: 'DuckDB 特有 LATERAL'
      },
      {
        label: 'ASOF JOIN',
        sql: `SELECT t.*, r.rate
FROM transactions t
ASOF JOIN exchange_rates r
ON t.currency = r.currency AND t.trade_time >= r.effective_time;`,
        description: '时间序列最近匹配'
      }
    ]
  },
  {
    id: 'aggregation',
    title: '聚合与分组',
    category: '聚合',
    description: 'GROUP BY、HAVING、聚合函数、ROLLUP、CUBE',
    snippets: [
      {
        label: 'COUNT 聚合',
        sql: `SELECT COUNT(*), COUNT(title), COUNT(DISTINCT status)
FROM life_object;`,
        description: '计数函数'
      },
      {
        label: 'GROUP BY 分组',
        sql: `SELECT status, COUNT(*) AS object_count
FROM life_object
GROUP BY status;`,
        description: '按状态分组统计'
      },
      {
        label: '多维分组',
        sql: `SELECT life_life_object, status, COUNT(*) AS count
FROM life_object
GROUP BY life_life_object, status;`,
        description: '多列分组'
      },
      {
        label: 'GROUP BY ALL',
        sql: `SELECT status, life_life_object, COUNT(*) AS count
FROM life_object
GROUP BY ALL;`,
        description: 'DuckDB 简化语法'
      },
      {
        label: 'HAVING 过滤',
        sql: `SELECT status, COUNT(*) AS object_count
FROM life_object
GROUP BY status
HAVING COUNT(*) > 2;`,
        description: '分组后过滤'
      },
      {
        label: 'ROLLUP 汇总',
        sql: `SELECT life_life_object, status, COUNT(*) AS count
FROM life_object
GROUP BY ROLLUP (life_life_object, status);`,
        description: '小计汇总'
      },
      {
        label: 'CUBE 组合',
        sql: `SELECT life_life_object, status, COUNT(*) AS count
FROM life_object
GROUP BY CUBE (life_life_object, status);`,
        description: '所有维度组合'
      }
    ]
  },
  {
    id: 'subqueries',
    title: '子查询与 CTE',
    category: '子查询',
    description: '子查询、公用表表达式 CTE、递归 CTE',
    snippets: [
      {
        label: '标量子查询',
        sql: `SELECT title, created_at,
  (SELECT AVG(created_at) FROM life_object) AS avg_date
FROM life_object;`,
        description: 'SELECT 中的子查询'
      },
      {
        label: '派生表',
        sql: `SELECT type_stats.type_name, type_stats.object_count
FROM (
  SELECT ot.name AS type_name, COUNT(o.id) AS object_count
  FROM life_object_type ot
  LEFT JOIN life_object o ON ot.id = o.life_life_object
  GROUP BY ot.id, ot.name
) AS type_stats
WHERE type_stats.object_count > 1;`,
        description: 'FROM 中的子查询'
      },
      {
        label: 'IN 子查询',
        sql: `SELECT title FROM life_object
WHERE id IN (SELECT source_object FROM life_link);`,
        description: 'WHERE 中子查询'
      },
      {
        label: 'EXISTS 子查询',
        sql: `SELECT ot.name FROM life_object_type ot
WHERE EXISTS (SELECT 1 FROM life_object o WHERE o.life_life_object = ot.id);`,
        description: ' EXISTS 检查'
      },
      {
        label: 'CTE 公用表表达式',
        sql: `WITH type_object_counts AS (
  SELECT ot.name AS type_name, COUNT(o.id) AS object_count
  FROM life_object_type ot
  LEFT JOIN life_object o ON ot.id = o.life_life_object
  GROUP BY ot.id, ot.name
)
SELECT * FROM type_object_counts WHERE object_count > 1;`,
        description: '使用 WITH 语法'
      },
      {
        label: '递归 CTE',
        sql: `WITH RECURSIVE type_hierarchy AS (
  SELECT id, name, name AS full_path, 1 AS level
  FROM life_object_type WHERE id = 1
  UNION ALL
  SELECT ot.id, ot.name, th.full_path || ' > ' || ot.name, th.level + 1
  FROM life_object_type ot INNER JOIN type_hierarchy th ON ot.parent_id = th.id
)
SELECT * FROM type_hierarchy;`,
        description: '递归查询层级'
      }
    ]
  },
  {
    id: 'window-functions',
    title: '窗口函数',
    category: '高级',
    description: '窗口函数：排名、偏移、聚合、QUALIFY',
    snippets: [
      {
        label: 'ROW_NUMBER 排名',
        sql: `SELECT title, status, created_at,
  ROW_NUMBER() OVER (ORDER BY created_at DESC) AS row_num,
  RANK() OVER (ORDER BY created_at DESC) AS rank_val,
  DENSE_RANK() OVER (ORDER BY created_at DESC) AS dense_rank_val
FROM life_object;`,
        description: '排名函数'
      },
      {
        label: 'NTILE 分箱',
        sql: `SELECT title, status, created_at,
  NTILE(4) OVER (ORDER BY created_at DESC) AS quartile
FROM life_object;`,
        description: '分成 N 箱'
      },
      {
        label: 'LAG/LEAD 偏移',
        sql: `SELECT title, created_at, status,
  LAG(status, 1) OVER (ORDER BY created_at) AS prev_status,
  LEAD(status, 1) OVER (ORDER BY created_at) AS next_status
FROM life_object;`,
        description: '前后行偏移'
      },
      {
        label: 'FIRST/LAST VALUE',
        sql: `SELECT title, created_at, status,
  FIRST_VALUE(title) OVER (ORDER BY created_at) AS first_object,
  LAST_VALUE(title) OVER (
    ORDER BY created_at
    ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
  ) AS latest_object
FROM life_object;`,
        description: '首尾值'
      },
      {
        label: '聚合窗口函数',
        sql: `SELECT title, life_life_object, status,
  COUNT(*) OVER (PARTITION BY life_life_object) AS type_count
FROM life_object;`,
        description: '分区聚合'
      },
      {
        label: 'QUALIFY 过滤',
        sql: `SELECT title, status, created_at,
  ROW_NUMBER() OVER (PARTITION BY status ORDER BY created_at) AS rn
FROM life_object
QUALIFY rn = 1;`,
        description: '直接过滤窗口结果'
      }
    ]
  },
  {
    id: 'set-operations',
    title: '集合操作',
    category: '集合',
    description: 'UNION、UNION ALL、INTERSECT、EXCEPT',
    snippets: [
      {
        label: 'UNION 去重',
        sql: `SELECT title AS name FROM life_object
UNION
SELECT name FROM life_object_type;`,
        description: '并集去重'
      },
      {
        label: 'UNION ALL 保留',
        sql: `SELECT id FROM life_object
UNION ALL
SELECT id FROM life_object_type;`,
        description: '并集保留重复'
      },
      {
        label: 'INTERSECT 交集',
        sql: `SELECT name FROM life_link_type
INTERSECT
SELECT title FROM life_object;`,
        description: '交集'
      },
      {
        label: 'EXCEPT 差集',
        sql: `SELECT name FROM life_object_type
EXCEPT
SELECT ot.name FROM life_object_type ot
INNER JOIN life_object o ON ot.id = o.life_life_object;`,
        description: '差集'
      }
    ]
  },
  {
    id: 'duckdb-file-queries',
    title: '直接文件查询 (DuckDB)',
    category: 'DuckDB',
    description: 'DuckDB 特有：无需导入直接查询文件',
    snippets: [
      {
        label: '查询 CSV',
        sql: `SELECT * FROM read_csv_auto('life_link_type.csv');
-- 或简写
SELECT * FROM 'life_link_type.csv';`,
        description: '直接读 CSV'
      },
      {
        label: '查询 Parquet',
        sql: `SELECT * FROM read_parquet('data/life_objects.parquet');
-- 或简写
SELECT * FROM 'data/life_objects.parquet';`,
        description: '直接读 Parquet'
      },
      {
        label: '查询 JSON',
        sql: `SELECT * FROM read_json_auto('links.json');`,
        description: '直接读 JSON'
      },
      {
        label: '通配符查询',
        sql: `SELECT * FROM read_parquet('data/objects_*.parquet');
SELECT * FROM read_parquet('data/year=*/month=*/*.parquet', hive_partitioning = true);`,
        description: '批量文件查询'
      },
      {
        label: '远程文件',
        sql: `SELECT * FROM read_parquet('s3://my-bucket/ontology/objects.parquet');
SELECT * FROM read_csv_auto('https://example.com/life_link_type.csv');`,
        description: 'S3/HTTP 远程'
      },
      {
        label: '导出为 Parquet',
        sql: `COPY (SELECT * FROM life_object WHERE status = 'active')
TO 'active_objects.parquet' (FORMAT PARQUET);`,
        description: '查询结果导出'
      }
    ]
  }
];

export const DQLPanel: React.FC<DQLPanelProps> = ({
  onCopy,
  onInsert,
  copiedId
}) => {
  const [expandedCategory, setExpandedCategory] = useState<Set<string>>(new Set(DQL_DATA.map(item => item.id)));
  const [expandedSnippets, setExpandedSnippets] = useState<Set<string>>(new Set());
  const [allCategoriesExpanded, setAllCategoriesExpanded] = useState(true);
  const [executionResults, setExecutionResults] = useState<Record<string, ExecutionResult>>({});

  // 执行 SQL
  const handleExecute = useCallback(async (id: string, sql: string) => {
    setExecutionResults(prev => ({
      ...prev,
      [id]: { data: null, error: null, loading: true }
    }));

    const startTime = performance.now();
    try {
      const res = await duckDBService.query(sql);
      const endTime = performance.now();
      setExecutionResults(prev => ({
        ...prev,
        [id]: { data: res, error: null, loading: false, executionTime: endTime - startTime }
      }));
    } catch (e: any) {
      setExecutionResults(prev => ({
        ...prev,
        [id]: { data: null, error: e.message, loading: false }
      }));
    }
  }, []);

  const toggleExpandCategory = (id: string) => {
    setExpandedCategory(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleExpandSnippet = (id: string) => {
    setExpandedSnippets(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAllCategories = () => {
    if (allCategoriesExpanded) {
      // 折叠所有：清空分类和代码块
      setExpandedCategory(new Set());
      setExpandedSnippets(new Set());
    } else {
      // 展开所有：展开所有分类和所有代码块
      setExpandedCategory(new Set(DQL_DATA.map(item => item.id)));
      const allSnippetIds = new Set<string>();
      DQL_DATA.forEach((item, itemIdx) => {
        item.snippets.forEach((_, snippetIdx) => {
          allSnippetIds.add(`${item.id}-${snippetIdx}`);
        });
      });
      setExpandedSnippets(allSnippetIds);
    }
    setAllCategoriesExpanded(!allCategoriesExpanded);
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* 一键展开/折叠按钮 */}
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs text-monokai-comment">
          共 {DQL_DATA.length} 个分类，{DQL_DATA.reduce((acc, item) => acc + item.snippets.length, 0)} 个代码块
        </span>
        <button
          onClick={toggleAllCategories}
          className="px-3 py-1.5 text-xs rounded bg-monokai-accent/20 text-monokai-accent hover:bg-monokai-accent/30 transition-colors"
        >
          {allCategoriesExpanded ? '全部折叠' : '全部展开'}
        </button>
      </div>
      <div className="space-y-4">
        {DQL_DATA.map((item) => (
          <div key={item.id}>
            {/* 分类头部 - 可展开/折叠整个类别 */}
            <div 
              className="bg-monokai-sidebar border border-monokai-accent rounded-lg overflow-hidden mb-3"
            >
              <div 
                className="px-4 py-2 bg-monokai-bg border-b border-monokai-accent flex items-center justify-between cursor-pointer hover:bg-monokai-accent/10"
                onClick={() => toggleExpandCategory(item.id)}
              >
                <div className="flex items-center gap-2">
                  {item.category === '基础' && <Search className="w-4 h-4 text-monokai-blue" />}
                  {item.category === '过滤' && <Filter className="w-4 h-4 text-monokai-green" />}
                  {item.category === '关联' && <Table className="w-4 h-4 text-monokai-cyan" />}
                  {item.category === '聚合' && <Calculator className="w-4 h-4 text-monokai-yellow" />}
                  {item.category === '子查询' && <GitBranch className="w-4 h-4 text-monokai-amethyst" />}
                  {item.category === '高级' && <FunctionSquare className="w-4 h-4 text-monokai-pink" />}
                  {item.category === '集合' && <Table className="w-4 h-4 text-monokai-orange" />}
                  {item.category === 'DuckDB' && <Database className="w-4 h-4 text-monokai-green" />}
                  <span className="font-medium text-monokai-fg">{item.title}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-monokai-cyan/20 text-monokai-cyan">
                    {item.category}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-monokai-comment">
                    {item.snippets.length} 个代码块
                  </span>
                  {expandedCategory.has(item.id) ? (
                    <ChevronUp className="w-4 h-4 text-monokai-comment" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-monokai-comment" />
                  )}
                </div>
              </div>

              {/* 描述 */}
              <div className="px-4 py-2 bg-monokai-bg/50 border-b border-monokai-accent">
                <p className="text-xs text-monokai-comment">{item.description}</p>
              </div>
            </div>

            {/* 每个代码片段作为独立卡片 - 只有在分类展开时才显示 */}
            {expandedCategory.has(item.id) && (
              <div className="space-y-2 pl-2">
                {item.snippets.map((snippet, idx) => {
                  const snippetId = `${item.id}-${idx}`;
                  const isExpanded = expandedSnippets.has(snippetId);
                  return (
                    <div
                      key={idx}
                      className="bg-monokai-sidebar border border-monokai-accent/50 rounded-lg overflow-hidden"
                    >
                      {/* 片段标题栏 - 点击可展开/折叠 */}
                      <div 
                        className="px-3 py-2 bg-monokai-bg flex items-center justify-between cursor-pointer hover:bg-monokai-accent/10"
                        onClick={() => toggleExpandSnippet(snippetId)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-monokai-fg">{snippet.label}</span>
                          {snippet.description && (
                            <span className="text-xs text-monokai-comment">- {snippet.description}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {isExpanded ? (
                            <ChevronUp className="w-3 h-3 text-monokai-comment" />
                          ) : (
                            <ChevronDown className="w-3 h-3 text-monokai-comment" />
                          )}
                        </div>
                      </div>

                      {/* 展开的代码块和操作按钮 */}
                      {isExpanded && (
                        <>
                          {/* 操作按钮栏 */}
                          <div className="px-3 py-2 bg-monokai-accent/5 border-b border-monokai-accent/30 flex items-center gap-1">
                            {/* 执行按钮 */}
                            {(() => {
                              const resultId = `${item.id}-${idx}`;
                              const result = executionResults[resultId];
                              return (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleExecute(resultId, snippet.sql);
                                  }}
                                  disabled={result?.loading}
                                  className={`p-1.5 rounded transition-colors ${
                                    result?.loading
                                      ? 'bg-monokai-yellow/20 text-monokai-yellow cursor-wait'
                                      : result?.error
                                      ? 'hover:bg-monokai-pink/30 text-monokai-pink'
                                      : result?.data
                                      ? 'hover:bg-monokai-green/30 text-monokai-green'
                                      : 'hover:bg-monokai-green/30 text-monokai-comment hover:text-monokai-green'
                                  }`}
                                  title={result?.loading ? '执行中...' : '执行 SQL'}
                                >
                                  {result?.loading ? (
                                    <span className="w-3.5 h-3.5 border-2 border-monokai-yellow border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <Play className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              );
                            })()}
                            {/* 插入到编辑器按钮 */}
                            {onInsert && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onInsert(snippet.sql);
                                }}
                                className="p-1.5 rounded hover:bg-monokai-blue/30 text-monokai-comment hover:text-monokai-blue transition-colors"
                                title="插入到 SQL 编辑器"
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {/* 复制按钮 */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onCopy?.(`${item.id}-${idx}`, snippet.sql);
                              }}
                              className="p-1.5 rounded hover:bg-monokai-accent/30 text-monokai-comment hover:text-monokai-fg transition-colors"
                              title="复制 SQL"
                            >
                              {copiedId === `${item.id}-${idx}` ? (
                                <Check className="w-3.5 h-3.5 text-monokai-green" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                          
                          {/* CodeMirror 代码块 */}
                          <div>
                            <CodeMirror
                              value={snippet.sql}
                              height="auto"
                              theme={monokai}
                              extensions={[
                                sql(),
                                EditorView.lineWrapping,
                                EditorView.theme({
                                  "&": { fontSize: "12px" },
                                  ".cm-content": { fontSize: "12px" },
                                  ".cm-line": { fontSize: "12px" }
                                })
                              ]}
                              editable={false}
                              basicSetup={false}
                            />
                          </div>

                          {/* 执行结果展示 */}
                          {(() => {
                            const resultId = `${item.id}-${idx}`;
                            const result = executionResults[resultId];
                            if (!result) return null;
                            return (
                              <ResultTable
                                data={result.data || []}
                                error={result.error}
                                loading={result.loading}
                                executionTime={result.executionTime}
                              />
                            );
                          })()}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DQLPanel;
