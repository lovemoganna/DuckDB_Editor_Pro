/**
 * FunctionsPanel - 函数库面板
 * 
 * 显示内置函数：字符串函数、数值函数、日期函数、空值处理、类型转换、条件分支、JSON函数、数组函数、序列生成
 * 使用 CodeMirror 实现语法高亮，每个函数片段可独立执行
 */

import React, { useState, useCallback } from 'react';
import { Copy, Check, Type, Percent, Calendar, Ban, RefreshCw, GitBranch, Braces, ListOrdered, Hash, ArrowRight, Play, ChevronDown, ChevronUp } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { EditorView } from '@codemirror/view';
import { monokai } from '@uiw/codemirror-theme-monokai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { duckDBService } from '../../services/duckdbService';
import { ResultTable } from '../Learn/ResultTable';

interface FunctionsPanelProps {
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

// SQL 函数片段
interface SqlSnippet {
  label: string;
  sql: string;
  description?: string;
}

// 函数数据 - 每个类别包含多个可执行的 snippet
const FUNCTIONS_DATA: {
  id: string;
  title: string;
  category: string;
  snippets: SqlSnippet[];
  description?: string;
}[] = [
  {
    id: 'string-functions',
    title: '字符串函数',
    category: '字符串',
    description: '字符串处理与操作函数',
    snippets: [
      {
        label: 'CONCAT 拼接',
        sql: `SELECT CONCAT(o.title, ' (', ot.name, ')') AS entity_info 
FROM ontology_object o
JOIN object_type ot ON o.object_type_id = ot.id
LIMIT 5;`,
        description: '拼接多个字符串'
      },
      {
        label: 'SUBSTRING 截取',
        sql: `SELECT title, SUBSTRING(title, 1, 10) AS short_title 
FROM ontology_object 
LIMIT 5;`,
        description: '截取子字符串'
      },
      {
        label: 'UPPER/LOWER 大小写',
        sql: `SELECT name, UPPER(name) AS upper_name, LOWER(name) AS lower_name 
FROM object_type 
LIMIT 5;`,
        description: '转换为大写/小写'
      },
      {
        label: 'TRIM 去空格',
        sql: `SELECT TRIM('  hello  ') AS trimmed;`,
        description: '去除两端空格'
      },
      {
        label: 'REPLACE 替换',
        sql: `SELECT name, REPLACE(name, '_', ' ') AS clean_name 
FROM object_type 
LIMIT 5;`,
        description: '替换字符串内容'
      },
      {
        label: 'LENGTH 长度',
        sql: `SELECT title, LENGTH(title) AS title_len 
FROM ontology_object 
LIMIT 5;`,
        description: '获取字符串长度'
      },
      {
        label: 'REVERSE 反转',
        sql: `SELECT name, REVERSE(name) AS reversed_name 
FROM object_type 
LIMIT 5;`,
        description: '反转字符串'
      },
      {
        label: 'LPAD/RPAD 填充',
        sql: `SELECT name, LPAD(name, 20, '*') AS left_padded, RPAD(name, 20, '-') AS right_padded 
FROM object_type 
LIMIT 5;`,
        description: '左/右填充字符'
      },
      {
        label: 'SPLIT_PART 拆分',
        sql: `SELECT SPLIT_PART('a,b,c,d', ',', 2) AS part;`,
        description: '按分隔符拆分取第 n 部分'
      }
    ]
  },
  {
    id: 'numeric-functions',
    title: '数值与数学函数',
    category: '数值',
    description: '数值计算与数学运算函数',
    snippets: [
      {
        label: 'ROUND 四舍五入',
        sql: `SELECT confidence, ROUND(confidence, 1) AS conf_rounded 
FROM object_link 
LIMIT 5;`,
        description: '四舍五入到指定小数位'
      },
      {
        label: 'CEILING/FLOOR 取整',
        sql: `SELECT confidence, 
       CEILING(confidence) AS ceil_conf,
       FLOOR(confidence) AS floor_conf
FROM object_link 
LIMIT 5;`,
        description: '向上/向下取整'
      },
      {
        label: 'ABS 绝对值',
        sql: `SELECT -5.5 AS original, ABS(-5.5) AS absolute_val;`,
        description: '绝对值'
      },
      {
        label: 'POWER 幂运算',
        sql: `SELECT confidence, POWER(confidence, 2) AS conf_squared 
FROM object_link 
LIMIT 5;`,
        description: '幂运算'
      },
      {
        label: 'SQRT 平方根',
        sql: `SELECT 16 AS num, SQRT(16) AS square_root;`,
        description: '平方根'
      },
      {
        label: 'GREATEST/LEAST 最大最小',
        sql: `SELECT GREATEST(1, 5, 3) AS greatest_val, LEAST(1, 5, 3) AS least_val;`,
        description: '取最大/最小值'
      },
      {
        label: 'MOD 取模',
        sql: `SELECT 10 % 3 AS mod_result, MOD(10, 3) AS mod_function;`,
        description: '取模（余数）'
      },
      {
        label: 'RAND 随机数',
        sql: `SELECT RAND() AS random_val, FLOOR(RAND() * 100) AS random_int;`,
        description: '生成随机数'
      }
    ]
  },
  {
    id: 'date-functions',
    title: '日期时间函数',
    category: '日期',
    description: '日期时间处理函数',
    snippets: [
      {
        label: '当前日期/时间',
        sql: `SELECT CURRENT_DATE AS today, CURRENT_TIMESTAMP AS now, NOW() AS now_duckdb;`,
        description: '获取当前日期时间'
      },
      {
        label: 'EXTRACT 提取日期部分',
        sql: `SELECT title, created_at, 
       EXTRACT(YEAR FROM created_at) AS year,
       EXTRACT(MONTH FROM created_at) AS month,
       EXTRACT(DAY FROM created_at) AS day
FROM ontology_object 
LIMIT 5;`,
        description: '提取日期组成部分'
      },
      {
        label: '日期加减',
        sql: `SELECT created_at, 
       created_at + INTERVAL '7 days' AS next_week,
       created_at - INTERVAL '30 days' AS past_month
FROM ontology_object 
LIMIT 5;`,
        description: '日期加减运算'
      },
      {
        label: 'DATEDIFF 日期差',
        sql: `SELECT created_at, CURRENT_DATE AS today,
       DATEDIFF(DAY, created_at, CURRENT_DATE) AS days_since
FROM ontology_object 
LIMIT 5;`,
        description: '计算日期差值'
      },
      {
        label: 'TO_CHAR 格式化',
        sql: `SELECT created_at, TO_CHAR(created_at, 'YYYY-MM-DD') AS formatted_date
FROM ontology_object 
LIMIT 5;`,
        description: '日期格式化输出'
      },
      {
        label: 'STRFTIME (DuckDB)',
        sql: `SELECT created_at, STRFTIME(created_at, '%Y-%m-%d') AS fmt_date
FROM ontology_object 
LIMIT 5;`,
        description: 'DuckDB 日期格式化'
      }
    ]
  },
  {
    id: 'null-functions',
    title: '空值处理函数',
    category: '空值',
    description: '处理 NULL 值的函数',
    snippets: [
      {
        label: 'COALESCE 首非空',
        sql: `SELECT title, COALESCE(updated_at, created_at) AS last_activity 
FROM ontology_object 
LIMIT 5;`,
        description: '返回第一个非 NULL 值'
      },
      {
        label: 'IFNULL',
        sql: `SELECT title, IFNULL(updated_at, created_at) AS effective_date 
FROM ontology_object 
LIMIT 5;`,
        description: 'MySQL/DuckDB 空值替换'
      },
      {
        label: 'NULLIF 防除零',
        sql: `SELECT link_type_id, 
       SUM(confidence) / NULLIF(COUNT(*), 0) AS avg_conf
FROM object_link 
GROUP BY link_type_id 
LIMIT 5;`,
        description: '两值相等时返回 NULL'
      },
      {
        label: 'IS NULL 判断',
        sql: `SELECT title, updated_at 
FROM ontology_object 
WHERE updated_at IS NULL 
LIMIT 5;`,
        description: '判断是否为空值'
      },
      {
        label: 'IS NOT NULL 判断',
        sql: `SELECT title, updated_at 
FROM ontology_object 
WHERE updated_at IS NOT NULL 
LIMIT 5;`,
        description: '判断是否非空'
      }
    ]
  },
  {
    id: 'cast-functions',
    title: '数据类型转换',
    category: '转换',
    description: '数据类型之间的转换',
    snippets: [
      {
        label: 'CAST 转换',
        sql: `SELECT CAST('2024-01-15' AS DATE) AS date_val,
       CAST(123 AS VARCHAR) AS str_val,
       CAST(0.8765 AS DECIMAL(3,2)) AS dec_val;`,
        description: 'ANSI 标准类型转换'
      },
      {
        label: '双冒号 :: 简写',
        sql: `SELECT '2024-01-15'::DATE AS date_val,
       123::VARCHAR AS str_val,
       0.8765::DECIMAL(3,2) AS dec_val;`,
        description: 'PostgreSQL/DuckDB 简写'
      },
      {
        label: 'TRY_CAST 安全转换',
        sql: `SELECT TRY_CAST('abc' AS INTEGER) AS safe_int,
       TRY_CAST('123' AS INTEGER) AS valid_int;`,
        description: '转换失败返回 NULL'
      },
      {
        label: '字符串转日期',
        sql: `SELECT '2024-01-15'::DATE + INTERVAL '1 month' AS next_month;`,
        description: '字符串转日期运算'
      }
    ]
  },
  {
    id: 'conditional-functions',
    title: '条件分支逻辑',
    category: '条件',
    description: '条件判断与分支选择',
    snippets: [
      {
        label: 'CASE WHEN 复杂条件',
        sql: `SELECT title, status,
       CASE
         WHEN status = 'active' THEN '活跃'
         WHEN status = 'flagged' THEN '标记'
         WHEN status = 'archived' THEN '归档'
         ELSE '未知'
       END AS status_cn
FROM ontology_object 
LIMIT 5;`,
        description: '多条件分支'
      },
      {
        label: 'CASE 简单匹配',
        sql: `SELECT name, source_type,
       CASE source_type
         WHEN 'signal' THEN '信号情报'
         WHEN 'human' THEN '人力情报'
         WHEN 'financial' THEN '金融情报'
         ELSE '其他'
       END AS source_type_cn
FROM data_source 
LIMIT 5;`,
        description: '值匹配分支'
      },
      {
        label: 'IF 函数',
        sql: `SELECT title, 
       IF(status = 'active', '正常', '非正常') AS status_label
FROM ontology_object 
LIMIT 5;`,
        description: 'MySQL/DuckDB 简写'
      },
      {
        label: 'IIF 函数',
        sql: `SELECT confidence, 
       IIF(confidence > 0.8, '高可信度', '低可信度') AS trust_level
FROM object_link 
LIMIT 5;`,
        description: 'SQL Server 简写'
      },
      {
        label: 'CASE 数值分段',
        sql: `SELECT confidence,
       CASE
         WHEN confidence > 0.8 THEN '高'
         WHEN confidence > 0.5 THEN '中'
         WHEN confidence > 0.2 THEN '低'
         ELSE '极低'
       END AS conf_level
FROM object_link 
LIMIT 5;`,
        description: '数值范围分段'
      }
    ]
  },
  {
    id: 'json-functions',
    title: 'JSON 函数',
    category: 'JSON',
    description: '处理 JSON 数据的函数',
    snippets: [
      {
        label: '创建 JSON',
        sql: `SELECT '{"name": "Alice", "age": 30}'::JSON AS json_val;`,
        description: '创建 JSON 值'
      },
      {
        label: 'JSON 访问 ->',
        sql: `SELECT '{"category": "person", "risk": "high"}'::JSON -> 'category' AS cat;`,
        description: 'JSON 对象访问'
      },
      {
        label: 'JSON 访问 ->>',
        sql: `SELECT '{"category": "person"}'::JSON ->> 'category' AS cat_str;`,
        description: 'JSON 获取字符串'
      },
      {
        label: 'JSON 索引访问',
        sql: `SELECT '[1, 2, 3]'::JSON ->> 0 AS first_element;`,
        description: 'JSON 数组索引'
      },
      {
        label: 'UNNEST 展开数组',
        sql: `SELECT UNNEST(ARRAY['a', 'b', 'c']) AS item;`,
        description: '展开 JSON 数组为行'
      }
    ]
  },
  {
    id: 'array-functions',
    title: '数组与复合类型函数',
    category: '数组',
    description: '数组、列表、结构体、映射类型操作函数',
    snippets: [
      {
        label: '创建数组/LIST',
        sql: `SELECT ['signal', 'human', 'cyber'] AS tags;`,
        description: 'DuckDB LIST 创建'
      },
      {
        label: '数组长度',
        sql: `SELECT LEN(['intelligence', 'analysis', 'target']) AS list_len;`,
        description: '获取数组长度'
      },
      {
        label: 'LIST_CONTAINS 包含判断',
        sql: `SELECT LIST_CONTAINS(['VIP', 'target', 'observer'], 'VIP') AS has_vip;`,
        description: '判断是否包含元素'
      },
      {
        label: 'LIST_FILTER 过滤',
        sql: `SELECT LIST_FILTER(['high', 'medium', 'low'], x -> x != 'low') AS filtered;`,
        description: 'Lambda 过滤元素'
      },
      {
        label: 'UNNEST 展开',
        sql: `SELECT UNNEST(['a', 'b', 'c']) AS item;`,
        description: '展开数组为多行'
      },
      {
        label: 'ARRAY_AGG 聚合',
        sql: `SELECT ARRAY_AGG(status) AS statuses
FROM ontology_object 
LIMIT 1;`,
        description: '聚合为数组'
      }
    ]
  },
  {
    id: 'sequence-functions',
    title: '序列生成函数',
    category: '序列',
    description: '生成数字序列和日期序列',
    snippets: [
      {
        label: 'generate_series 数字',
        sql: `SELECT * FROM generate_series(1, 10);`,
        description: '生成数字序列 1-10'
      },
      {
        label: 'generate_series 步长',
        sql: `SELECT * FROM generate_series(0, 100, 10);`,
        description: '步长为 10 的序列'
      },
      {
        label: 'range() 简写',
        sql: `SELECT * FROM range(5);`,
        description: 'DuckDB 0-4 序列'
      },
      {
        label: '日期序列',
        sql: `SELECT * FROM generate_series(DATE '2024-01-01', DATE '2024-01-10', INTERVAL '1 day');`,
        description: '生成日期序列'
      },
      {
        label: '月份序列',
        sql: `SELECT * FROM generate_series(DATE '2024-01-01', DATE '2024-12-31', INTERVAL '1 month');`,
        description: '生成月份序列'
      },
      {
        label: '生成序列 + 聚合',
        sql: `SELECT 
    TO_CHAR(month, 'YYYY-MM') AS month,
    COUNT(o.id) AS object_count
FROM generate_series(DATE '2024-01-01', DATE '2024-12-31', INTERVAL '1 month') AS month
LEFT JOIN ontology_object o ON DATE_TRUNC('month', o.created_at) = month
GROUP BY month
ORDER BY month
LIMIT 5;`,
        description: '月份统计补齐'
      }
    ]
  }
];

export const FunctionsPanel: React.FC<FunctionsPanelProps> = ({
  onCopy,
  onInsert,
  copiedId
}) => {
  const [expandedCategory, setExpandedCategory] = useState<Set<string>>(new Set(FUNCTIONS_DATA.map(item => item.id)));
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
      setExpandedCategory(new Set(FUNCTIONS_DATA.map(item => item.id)));
      const allSnippetIds = new Set<string>();
      FUNCTIONS_DATA.forEach((item) => {
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
          共 {FUNCTIONS_DATA.length} 个分类，{FUNCTIONS_DATA.reduce((acc, item) => acc + item.snippets.length, 0)} 个代码块
        </span>
        <button
          onClick={toggleAllCategories}
          className="px-3 py-1.5 text-xs rounded bg-monokai-accent/20 text-monokai-accent hover:bg-monokai-accent/30 transition-colors"
        >
          {allCategoriesExpanded ? '全部折叠' : '全部展开'}
        </button>
      </div>
      <div className="space-y-4">
        {FUNCTIONS_DATA.map((item) => (
          <div key={item.id}>
            {/* 分类头部 - 可展开/折叠整个类别 */}
            <div className="bg-monokai-sidebar border border-monokai-accent rounded-lg overflow-hidden mb-3">
              <div 
                className="px-4 py-2 bg-monokai-bg border-b border-monokai-accent flex items-center justify-between cursor-pointer hover:bg-monokai-accent/10"
                onClick={() => toggleExpandCategory(item.id)}
              >
                <div className="flex items-center gap-2">
                  {item.category === '字符串' && <Type className="w-4 h-4 text-monokai-green" />}
                  {item.category === '数值' && <Percent className="w-4 h-4 text-monokai-blue" />}
                  {item.category === '日期' && <Calendar className="w-4 h-4 text-monokai-yellow" />}
                  {item.category === '空值' && <Ban className="w-4 h-4 text-monokai-red" />}
                  {item.category === '转换' && <RefreshCw className="w-4 h-4 text-monokai-cyan" />}
                  {item.category === '条件' && <GitBranch className="w-4 h-4 text-monokai-amethyst" />}
                  {item.category === 'JSON' && <Braces className="w-4 h-4 text-monokai-orange" />}
                  {item.category === '数组' && <ListOrdered className="w-4 h-4 text-monokai-pink" />}
                  {item.category === '序列' && <Hash className="w-4 h-4 text-monokai-green" />}
                  <span className="font-medium text-monokai-fg">{item.title}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-monokai-yellow/20 text-monokai-yellow">
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

            {/* 每个代码片段作为独立卡片 */}
            {expandedCategory.has(item.id) && (
              <div className="space-y-2 pl-2">
                {/* 函数语法参考表格（Markdown 渲染） */}
                <div className="bg-monokai-bg rounded border border-monokai-accent/50 p-3">
                  <div className="markdown-body" style={{ fontSize: '11px' }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {getFunctionSyntaxTable(item.category)}
                    </ReactMarkdown>
                  </div>
                </div>

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

// 获取函数语法参考表格（Markdown 格式）
function getFunctionSyntaxTable(category: string): string {
  const tables: Record<string, string> = {
    '字符串': `| 函数 | 说明 |
|------|-------|
| CONCAT(s1, s2, ...) | 拼接多个字符串 |
| SUBSTRING(s, start, len) | 截取子串，start 从 1 开始 |
| LEFT(s, n) / RIGHT(s, n) | 从左/右取 n 个字符 |
| UPPER(s) / LOWER(s) | 转大写/小写 |
| TRIM(s) / LTRIM(s) / RTRIM(s) | 去除空格 |
| REPLACE(s, old, new) | 替换字符串 |
| LENGTH(s) / LEN(s) | 字符串长度 |
| POSITION(sub IN s) | 查找子串位置 |
| REVERSE(s) | 反转字符串 |
| LPAD(s, len, pad) / RPAD(s, len, pad) | 左/右填充 |
| SPLIT_PART(s, delim, n) | 按分隔符拆分取第 n 部分 |`,
    
    '数值': `| 函数 | 说明 |
|------|-------|
| ROUND(n, decimals) | 四舍五入 |
| CEILING(n) / CEIL(n) | 向上取整 |
| FLOOR(n) | 向下取整 |
| ABS(n) | 绝对值 |
| MOD(n, m) | 取模（余数） |
| POWER(n, p) | 幂运算 |
| SQRT(n) | 平方根 |
| LOG(n) / LN(n) | 自然对数 |
| LOG10(n) / LOG2(n) | 以 10/2 为底的对数 |
| RAND() / RANDOM() | 随机数（0~1） |
| GREATEST(a, b, ...) | 取最大值 |
| LEAST(a, b, ...) | 取最小值 |`,
    
    '日期': `| 函数 | 说明 |
|------|-------|
| CURRENT_DATE | 当前日期 |
| CURRENT_TIMESTAMP / NOW() | 当前时间戳 |
| EXTRACT(part FROM date) | 提取日期部分 |
| date + INTERVAL 'n days' | 日期加法 |
| date - INTERVAL 'n days' | 日期减法 |
| DATEDIFF(unit, d1, d2) | 日期差值 |
| TO_CHAR(date, format) | 日期格式化 |
| STRFTIME(date, format) | DuckDB 日期格式化 |`,
    
    '空值': `| 函数 | 说明 |
|------|-------|
| COALESCE(v1, v2, ...) | 返回第一个非 NULL 值 |
| IFNULL(col, val) | MySQL/DuckDB 空值替换 |
| ISNULL(col, val) | SQL Server 空值替换 |
| NVL(col, val) | Oracle 空值替换 |
| NULLIF(v1, v2) | 两值相等时返回 NULL |
| IS NULL / IS NOT NULL | 空值判断 |`,
    
    '转换': `| 函数 | 说明 |
|------|-------|
| CAST(expr AS type) | ANSI 标准类型转换 |
| expr::type | PostgreSQL/DuckDB 简写 |
| CONVERT(type, expr) | SQL Server 转换 |
| TRY_CAST(expr AS type) | 安全转换（失败返回 NULL） |`,
    
    '条件': `| 函数 | 说明 |
|------|-------|
| CASE WHEN ... THEN ... END | 条件分支（ANSI 标准） |
| IF(cond, true_val, false_val) | MySQL/DuckDB 条件函数 |
| IIF(cond, true_val, false_val) | SQL Server 条件函数 |`,
    
    'JSON': `| 函数 | 说明 |
|------|-------|
| json -> 'key' | JSON 对象访问（返回 JSON） |
| json ->> 'key' | JSON 对象访问（返回文本） |
| json ->> index | JSON 数组索引访问 |
| JSON_EXTRACT(json, '$.key') | MySQL JSON 提取 |
| jsonb @> '{}' | JSON 包含查询 |`,
    
    '数组': `| 函数 | 说明 |
|------|-------|
| ['a', 'b', 'c'] | 创建 LIST（DuckDB） |
| ARRAY['a', 'b', 'c'] | 创建数组（PG） |
| LEN(list) | LIST/数组长度 |
| LIST_CONTAINS(list, elem) | 包含判断 |
| UNNEST(list) | 展开为多行 |
| ARRAY_AGG(col) | 聚合为数组 |
| LIST_FILTER(list, lambda) | Lambda 过滤 |`,
    
    '序列': `| 函数 |说明 |
|------|-------|
| generate_series(start, end) | 生成数字序列 |
| generate_series(start, end, step) | 带步长序列 |
| generate_series(date, date, interval) | 日期序列 |
| range(n) | DuckDB 0~(n-1) 序列 |`
  };
  
  return tables[category] || '';
}

export default FunctionsPanel;
