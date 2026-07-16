/**
 * OptimizationPanel - 性能优化面板
 * 
 * 显示性能优化相关内容：执行计划、索引、查询改写、统计信息、行列存储差异
 * 每个知识点拆分为独立的代码块，便于用户专注理解
 */

import React, { useState, useCallback } from 'react';
import { Copy, Check, Zap, BarChart3, Gauge, Search, AlertTriangle, Database, Table2, ArrowRight, Play, ChevronDown, ChevronUp } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { EditorView } from '@codemirror/view';
import { monokai } from '@uiw/codemirror-theme-monokai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { duckDBService } from '../../services/duckdbService';
import { ResultTable } from '../Learn/ResultTable';

interface OptimizationPanelProps {
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

// 性能优化知识数据 - 拆分为独立代码块
interface SqlSnippet {
  label: string;
  sql?: string;
  markdown?: string;
  description?: string;
}

const OPTIMIZATION_DATA: {
  id: string;
  name: string;
  category: string;
  snippets: SqlSnippet[];
  description?: string;
}[] = [
  {
    id: 'explain',
    name: '执行计划解读',
    category: '分析',
    description: 'EXPLAIN / ANALYZE 分析查询执行计划',
    snippets: [
      {
        label: 'DuckDB 执行计划',
        sql: `-- DuckDB 执行计划分析
EXPLAIN SELECT * FROM life_object WHERE status = 'active';
EXPLAIN ANALYZE SELECT * FROM life_object WHERE status = 'active';`,
        description: 'DuckDB 的 EXPLAIN 和 EXPLAIN ANALYZE 用法'
      },
      {
        label: '多表连接分析',
        sql: `-- 分析多表连接性能
EXPLAIN ANALYZE
SELECT o.name, ot.name AS type_name, ol.confidence
FROM life_object o
JOIN life_object_type ot ON o.life_life_object = ot.id
JOIN object_link ol ON o.id = ol.source_object_id
WHERE o.status = 'active';`,
        description: '分析多表 JOIN 的执行计划'
      },
      {
        label: 'MySQL 执行计划',
        sql: `-- MySQL 执行计划
EXPLAIN SELECT * FROM life_object WHERE status = 'flagged';`,
        description: 'MySQL 的 EXPLAIN 用法'
      },
      {
        label: 'PostgreSQL 执行计划',
        sql: `-- PostgreSQL 详细执行计划
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM life_object WHERE life_life_object = 1;`,
        description: 'PostgreSQL 的详细执行计划分析'
      },
      {
        label: '关键指标解读',
        markdown: `| 指标 | 含义 | 期望值 |
|------|------|--------|
| Scan Type | 全表扫描 vs 索引扫描 | Index Seek > Index Scan > Table Scan |
| Estimated Rows | 预估返回行数 | 与实际行数差距不大 |
| Cost | 相对开销 | 越小越好 |
| Key | 使用的索引 | 不应为 NULL |
| Actual Time | 实际执行时间 | 定位瓶颈算子 |`,
        description: '执行计划关键指标说明'
      }
    ]
  },
  {
    id: 'index-types',
    name: '索引类型详解',
    category: '索引',
    description: '聚集索引、非聚集索引、复合索引、覆盖索引',
    snippets: [
      {
        label: '索引类型对比表',
        markdown: `| 索引类型 | 说明 | 适用场景 |
|---------|------|---------|
| 聚集索引 | 决定数据物理存储顺序，每表一个 | 主键列、范围查询 |
| 非聚集索引 | 独立索引结构，指向数据行 | WHERE/JOIN/ORDER BY 常用列 |
| 复合索引 | 多列组合索引 | 多列联合查询条件 |
| 覆盖索引 | 包含查询所需所有列 | 避免回表 |
| 唯一索引 | 保证列值唯一 | 业务唯一性约束 |
| 全文索引 | 大文本内容搜索优化 | 文章内容搜索 |
| 表达式索引 | 基于表达式结果建索引 | CREATE INDEX idx ON t (LOWER(name)) |`,
        description: '各种索引类型及其适用场景'
      },
      {
        label: '创建复合索引',
        sql: `-- 基于 Palantir Ontology 的复合索引示例
CREATE INDEX idx_life_life_object_type_status 
ON life_object (life_life_object, status);

CREATE INDEX idx_object_link_confidence 
ON object_link (confidence DESC);`,
        description: '创建复合索引示例'
      },
      {
        label: '最左前缀原则',
        markdown: `**能利用索引的条件：**
- ✅ WHERE life_life_object = 1
- ✅ WHERE life_life_object = 1 AND status = 'active'

**无法利用索引的条件：**
- ❌ WHERE status = 'active'  -- 跳过最左列
- ❌ WHERE confidence > 0.5`,
        description: '复合索引的最左前缀原则'
      }
    ]
  },
  {
    id: 'index-fail',
    name: '索引失效场景',
    category: '索引',
    description: '索引失效的常见场景与修复',
    snippets: [
      {
        label: '对索引列使用函数',
        sql: `-- ❌ 索引失效：使用函数
WHERE YEAR(created_at) = 2024

-- ✅ 正确方式：范围条件
WHERE created_at >= '2024-01-01' AND created_at < '2025-01-01'`,
        description: '函数导致索引失效'
      },
      {
        label: '隐式类型转换',
        sql: `-- ❌ 索引失效：隐式类型转换
WHERE life_life_object = '1'  -- 数字转字符串

-- ✅ 正确方式：保持类型一致
WHERE life_life_object = 1`,
        description: '类型转换导致索引失效'
      },
      {
        label: '前导通配符',
        sql: `-- ❌ 索引失效：前导通配符
WHERE name LIKE '%Network%'  -- 无法利用 B-Tree 有序性

-- ✅ 正确方式：后置通配符
WHERE name LIKE 'Network%'`,
        description: '前导通配符导致索引失效'
      },
      {
        label: '否定条件和 OR',
        sql: `-- ❌ 索引失效：否定条件
WHERE status <> 'active'  -- 通常全表扫描

-- ❌ 索引失效：OR 条件不当
WHERE source_object_id = 1 OR target_object_id = 1

-- ✅ 正确方式：改写为 UNION
WHERE source_object_id = 1 
UNION ALL 
SELECT * FROM object_link WHERE target_object_id = 1`,
        description: '否定条件和 OR 导致索引失效'
      },
      {
        label: '修复方式汇总',
        markdown: `| 场景 | 修复方式 |
|------|---------|
| 函数包裹 | 改为范围条件 |
| 隐式转换 | 保持类型一致 |
| 前导通配符 | 考虑全文索引 |
| 否定条件 | 改为正向条件 |
| OR 条件 | 改写为 UNION |`,
        description: '索引失效的修复方式'
      }
    ]
  },
  {
    id: 'query-patterns',
    name: '查询改写与反模式',
    category: '优化',
    description: '常见查询反模式与优化技巧',
    snippets: [
      {
        label: '避免 SELECT *',
        sql: `-- ❌ 低效：SELECT *
SELECT * FROM life_object;

-- ✅ 高效：只取需要的列
SELECT name, status FROM life_object;`,
        description: '只选择需要的列'
      },
      {
        label: '分页优化',
        sql: `-- ❌ 低效：OFFSET 分页（页码越大越慢）
SELECT * FROM life_object ORDER BY id LIMIT 10 OFFSET 10000;

-- ✅ 高效：Keyset Pagination（基于 ID 的游标分页）
SELECT * FROM life_object
WHERE id > 100
ORDER BY id LIMIT 10;`,
        description: '分页查询优化技巧'
      },
      {
        label: 'N+1 查询问题',
        sql: `-- ❌ N+1 查询（先查对象，再查链接）
-- 第1次：SELECT * FROM life_object;
-- 第2~N+1次：SELECT * FROM object_link WHERE source_object_id = ?;

-- ✅ 一次 JOIN（推荐）
SELECT o.name, ol.confidence, o_tgt.name AS target
FROM life_object o
JOIN object_link ol ON o.id = ol.source_object_id
JOIN life_object o_tgt ON ol.target_object_id = o_tgt.id;`,
        description: '避免 N+1 查询问题'
      },
      {
        label: '其他优化技巧',
        markdown: `**查询优化技巧：**
- 用 UNION ALL 替代 UNION（不需要去重时）
- 用 JOIN 替代相关子查询
- 提前过滤（WHERE 在 JOIN 之前）
- 批量操作替代逐行操作
- 使用临时表/CTE 分解超复杂查询`,
        description: '其他查询优化技巧'
      },
      {
        label: 'CTE 分解复杂查询',
        sql: `-- CTE 分解复杂查询
WITH active_links AS (
  SELECT * FROM object_link WHERE confidence > 0.8
)
SELECT 
    o.name AS source,
    o_tgt.name AS target,
    lt.name AS link_type,
    al.confidence
FROM active_links al
JOIN life_object o ON al.source_object_id = o.id
JOIN life_object o_tgt ON al.target_object_id = o_tgt.id
JOIN link_type lt ON al.link_type_id = lt.id;`,
        description: '使用 CTE 分解复杂查询'
      }
    ]
  },
  {
    id: 'statistics',
    name: '统计信息与优化器',
    category: '优化器',
    description: '统计信息与查询优化器',
    snippets: [
      {
        label: '统计信息更新',
        sql: `-- SQL Server
UPDATE STATISTICS life_object;
UPDATE STATISTICS object_link idx_confidence WITH FULLSCAN;

-- MySQL
ANALYZE TABLE life_object;

-- PostgreSQL
ANALYZE life_object;
VACUUM ANALYZE object_link;

-- DuckDB（自动维护，通常无需手动操作）`,
        description: '不同数据库的统计信息更新语法'
      },
      {
        label: '统计信息的作用',
        markdown: `**统计信息的作用：**
- 告诉优化器表中数据的分布情况
- 影响执行计划的选择
- 大量数据变更后需更新

**优化器工作原理：**
1. 解析 SQL 为抽象语法树
2. 生成多种执行计划
3. 基于统计信息估算成本
4. 选择成本最低的执行计划`,
        description: '统计信息的意义和工作原理'
      },
      {
        label: '统计信息过期影响',
        markdown: `**统计信息过期的影响：**
- 可能选择次优/错误的执行计划
- 导致查询性能急剧下降
- 表现为忽快忽慢

**验证统计信息是否过期：**
\`\`\`sql
-- PostgreSQL 查看表统计信息
SELECT * FROM pg_stats WHERE tablename = 'life_object';
\`\`\``,
        description: '统计信息过期的问题'
      }
    ]
  },
  {
    id: 'row-vs-column',
    name: '行存储 vs 列存储优化',
    category: '架构',
    description: '行存储与列存储的优化思路差异',
    snippets: [
      {
        label: '存储模式对比',
        markdown: `| 维度 | 行存储 (MySQL/PG/SQL Server) | 列存储 (DuckDB/ClickHouse) |
|------|------------------------------|---------------------------|
| 存储方式 | 同一行所有列物理相邻 | 同一列所有值物理相邻 |
| 擅长场景 | 单行查找、小范围更新 | 全表聚合、多列分析 |
| 索引依赖 | 非常依赖（无索引=慢） | 不太依赖（列扫本身就快） |
| 压缩效率 | 较低 | 极高 |
| 写入模式 | 逐行写入，适合小事务 | 批量写入 |`,
        description: '行存储与列存储的对比'
      },
      {
        label: '列存引擎优化',
        sql: `-- 列存引擎优化重点（DuckDB 场景）

-- ❌ 避免 SELECT *
SELECT * FROM life_object;

-- ✅ 只选择需要的列
SELECT name, status FROM life_object;

-- 减少扫描列数
-- 向量化执行
-- 并行扫描
-- Hash Join 优于 Nested Loop`,
        description: '列存储引擎的优化重点'
      },
      {
        label: '行存引擎优化',
        markdown: `**行存引擎优化重点：**
- 合理设计索引
- 避免全表扫描
- 减少 JOIN 次数
- 优化子查询

**实践建议：**
- 列存引擎中，精确选列收益更显著
- DuckDB 中 SELECT * 代价远大于 SELECT col1, col2
- 对 Ontology 对象的多维分析使用列存非常高效`,
        description: '行存储引擎的优化重点'
      }
    ]
  }
];

export const OptimizationPanel: React.FC<OptimizationPanelProps> = ({
  onCopy,
  onInsert,
  copiedId
}) => {
  const [expandedCategory, setExpandedCategory] = useState<Set<string>>(new Set(OPTIMIZATION_DATA.map(item => item.id)));
  const [expandedSnippets, setExpandedSnippets] = useState<Set<string>>(new Set());
  const [allCategoriesExpanded, setAllCategoriesExpanded] = useState(true);
  const [executionResults, setExecutionResults] = useState<Record<string, ExecutionResult>>({});

  // 执行 SQL
  const handleExecute = useCallback(async (id: string, sqlContent: string) => {
    if (!sqlContent) return;
    
    setExecutionResults(prev => ({
      ...prev,
      [id]: { data: null, error: null, loading: true }
    }));

    const startTime = performance.now();
    try {
      const res = await duckDBService.query(sqlContent);
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
      setExpandedCategory(new Set(OPTIMIZATION_DATA.map(item => item.id)));
      const allSnippetIds = new Set<string>();
      OPTIMIZATION_DATA.forEach((item) => {
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
          共 {OPTIMIZATION_DATA.length} 个分类，{OPTIMIZATION_DATA.reduce((acc, item) => acc + item.snippets.length, 0)} 个代码块
        </span>
        <button
          onClick={toggleAllCategories}
          className="px-3 py-1.5 text-xs rounded bg-monokai-accent/20 text-monokai-accent hover:bg-monokai-accent/30 transition-colors"
        >
          {allCategoriesExpanded ? '全部折叠' : '全部展开'}
        </button>
      </div>
      <div className="space-y-4">
        {OPTIMIZATION_DATA.map((item) => (
          <div key={item.id}>
            {/* 分类头部 - 可展开/折叠整个类别 */}
            <div className="bg-monokai-sidebar border border-monokai-accent rounded-lg overflow-hidden mb-3">
              <div 
                className="px-4 py-2 bg-monokai-bg border-b border-monokai-accent flex items-center justify-between cursor-pointer hover:bg-monokai-accent/10"
                onClick={() => toggleExpandCategory(item.id)}
              >
                <div className="flex items-center gap-2">
                  {item.category === '分析' && <Zap className="w-4 h-4 text-monokai-yellow" />}
                  {item.category === '索引' && <Search className="w-4 h-4 text-monokai-blue" />}
                  {item.category === '优化' && <Gauge className="w-4 h-4 text-monokai-green" />}
                  {item.category === '优化器' && <BarChart3 className="w-4 h-4 text-monokai-amethyst" />}
                  {item.category === '架构' && <Database className="w-4 h-4 text-monokai-cyan" />}
                  <span className="font-medium text-monokai-fg">{item.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-monokai-amethyst/20 text-monokai-amethyst">
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
                {item.snippets.map((snippet, idx) => {
                  const snippetId = `${item.id}-${idx}`;
                  const isExpanded = expandedSnippets.has(snippetId);
                  const isMarkdown = !!snippet.markdown;

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
                          {isMarkdown && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-monokai-amethyst/20 text-monokai-amethyst mr-1">
                              Markdown
                            </span>
                          )}
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
                          {/* 操作按钮栏 - 仅 SQL 有执行按钮 */}
                          {snippet.sql && (
                            <div className="px-3 py-2 bg-monokai-accent/5 border-b border-monokai-accent/30 flex items-center gap-1">
                              {/* 执行按钮 */}
                              {(() => {
                                const result = executionResults[snippetId];
                                return (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleExecute(snippetId, snippet.sql!);
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
                                    name={result?.loading ? '执行中...' : '执行 SQL'}
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
                                    onInsert(snippet.sql!);
                                  }}
                                  className="p-1.5 rounded hover:bg-monokai-blue/30 text-monokai-comment hover:text-monokai-blue transition-colors"
                                  name="插入到 SQL 编辑器"
                                >
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {/* 复制按钮 */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onCopy?.(snippetId, snippet.sql || snippet.markdown || '');
                                }}
                                className="p-1.5 rounded hover:bg-monokai-accent/30 text-monokai-comment hover:text-monokai-fg transition-colors"
                                name="复制内容"
                              >
                                {copiedId === snippetId ? (
                                  <Check className="w-3.5 h-3.5 text-monokai-green" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          )}

                          {/* Markdown 渲染或 SQL 代码块 */}
                          {isMarkdown ? (
                            <div className="p-3 bg-monokai-bg">
                              <div className="markdown-body" style={{ fontSize: '12px' }}>
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {snippet.markdown!}
                                </ReactMarkdown>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <CodeMirror
                                value={snippet.sql || ''}
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
                          )}

                          {/* 执行结果展示 */}
                          {snippet.sql && (() => {
                            const result = executionResults[snippetId];
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

export default OptimizationPanel;
