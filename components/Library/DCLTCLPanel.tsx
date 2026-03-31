/**
 * DCLTCLPanel - DCL/TCL 面板（权限与事务）
 * 
 * 显示权限管理、事务控制、ACID 特性、隔离级别等内容
 * 每个知识点拆分为独立的代码块，便于用户专注理解
 */

import React, { useState, useCallback } from 'react';
import { Copy, Check, Shield, Lock, Database, AlertTriangle, Key, Users, Play, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { EditorView } from '@codemirror/view';
import { monokai } from '@uiw/codemirror-theme-monokai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { duckDBService } from '../../services/duckdbService';
import { ResultTable } from '../Learn/ResultTable';

interface DCLTCLPanelProps {
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

// DCL/TCL 知识数据 - 拆分为独立代码块
interface SqlSnippet {
  label: string;
  sql?: string;
  markdown?: string;
  description?: string;
}

const DCLTCL_DATA: {
  id: string;
  title: string;
  category: string;
  snippets: SqlSnippet[];
  description?: string;
}[] = [
  {
    id: 'permissions',
    title: '权限管理 (DCL)',
    category: '权限',
    description: 'GRANT / REVOKE 权限管理',
    snippets: [
      {
        label: '授予权限',
        sql: `GRANT SELECT, INSERT ON employees TO user_name;
GRANT ALL PRIVILEGES ON database_name.* TO 'user'@'host';`,
        description: '授予 SELECT 和 INSERT 权限，以及所有表的所有权限'
      },
      {
        label: '授予执行权限',
        sql: `GRANT EXECUTE ON PROCEDURE sp_get_stats TO user_name;`,
        description: '授予存储过程执行权限'
      },
      {
        label: '撤销权限',
        sql: `REVOKE INSERT ON employees FROM user_name;`,
        description: '撤销指定权限'
      },
      {
        label: '创建角色',
        sql: `CREATE ROLE analyst;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO analyst;
GRANT analyst TO user_name;`,
        description: '创建角色并批量管理权限'
      },
      {
        label: '权限类型说明',
        markdown: `| 权限 | 适用范围 |
|------|---------|
| SELECT | 查询数据 |
| INSERT | 插入数据 |
| UPDATE | 更新数据 |
| DELETE | 删除数据 |
| CREATE | 创建对象 |
| DROP | 删除对象 |
| ALTER | 修改结构 |
| ALL PRIVILEGES | 所有权限 |`,
        description: '常用权限类型对照表'
      }
    ]
  },
  {
    id: 'transaction',
    title: '事务控制 (TCL)',
    category: '事务',
    description: 'BEGIN / COMMIT / ROLLBACK 事务控制',
    snippets: [
      {
        label: '开启事务',
        sql: `BEGIN TRANSACTION;
-- 或
BEGIN;
-- 或
START TRANSACTION;`,
        description: '开始一个事务'
      },
      {
        label: '提交事务',
        sql: `COMMIT;`,
        description: '永久保存事务中的所有修改'
      },
      {
        label: '回滚事务',
        sql: `ROLLBACK;`,
        description: '撤销事务中的所有修改'
      },
      {
        label: '保存点回滚',
        sql: `BEGIN TRANSACTION;
  UPDATE accounts SET balance = balance - 1000 WHERE id = 1;
  SAVEPOINT sp1;
  UPDATE accounts SET balance = balance + 1000 WHERE id = 2;
  ROLLBACK TO sp1;  -- 仅撤销 sp1 之后的操作
COMMIT;`,
        description: '使用保存点进行部分回滚'
      },
      {
        label: '自动提交模式',
        sql: `SET autocommit = 0;  -- 关闭自动提交，需手动 COMMIT/ROLLBACK
SET autocommit = 1;  -- 开启自动提交（默认）`,
        description: 'MySQL 自动提交设置'
      }
    ]
  },
  {
    id: 'acid',
    title: '事务的 ACID 特性',
    category: '原理',
    description: '原子性、一致性、隔离性、持久性',
    snippets: [
      {
        label: 'ACID 特性说明',
        markdown: `**事务必须满足 ACID 特性：**

**【A - Atomicity 原子性】**
- 事务内的操作要么全部成功，要么全部回滚
- 不会出现"部分成功"的状态

**【C - Consistency 一致性】**
- 事务前后数据满足所有约束和规则
- 不会出现违反约束的数据

**【I - Isolation 隔离性】**
- 并发事务之间互不干扰
- 隔离级别决定干扰程度

**【D - Durability 持久性】**
- 已提交的事务永久保存
- 即使系统崩溃也不会丢失`,
        description: 'ACID 特性详细说明'
      },
      {
        label: '事务示例：银行转账',
        sql: `BEGIN TRANSACTION;
  UPDATE accounts SET balance = balance - 1000 WHERE id = 1;
  UPDATE accounts SET balance = balance + 1000 WHERE id = 2;
COMMIT;  -- 两条 UPDATE 必须同时成功或同时失败`,
        description: '经典的转账事务示例'
      }
    ]
  },
  {
    id: 'isolation-levels',
    title: '事务隔离级别',
    category: '原理',
    description: 'READ UNCOMMITTED/READ COMMITTED/REPEATABLE READ/SERIALIZABLE',
    snippets: [
      {
        label: '设置隔离级别',
        sql: `SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;   -- 可读未提交（脏读）
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;     -- 可读已提交（多数数据库默认）
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;    -- 可重复读（MySQL InnoDB 默认）
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;        -- 串行化（最高隔离）`,
        description: '设置事务隔离级别'
      },
      {
        label: '隔离级别对比',
        markdown: `| 隔离级别 | 脏读 | 不可重复读 | 幻读 | 性能 |
|---------|------|-----------|------|------|
| READ UNCOMMITTED | 是 | 是 | 是 | 最高 |
| READ COMMITTED | 否 | 是 | 是 | 高 |
| REPEATABLE READ | 否 | 否 | 是 | 中 |
| SERIALIZABLE | 否 | 否 | 否 | 最低 |

**现象解释：**
- **脏读**：读取到其他事务未提交的数据
- **不可重复读**：同一查询返回不同结果（其他事务修改了数据）
- **幻读**：同一查询返回不同行数（其他事务插入了新行）`,
        description: '各隔离级别对比说明'
      }
    ]
  },
  {
    id: 'sql-injection',
    title: 'SQL 注入防御',
    category: '安全',
    description: '防止 SQL 注入攻击',
    snippets: [
      {
        label: '危险示例：SQL 注入',
        sql: `-- 危险：直接拼接用户输入
EXEC("SELECT * FROM users WHERE name = '" + @userInput + "'");
-- 若用户输入：' OR 1=1 --  则可绕过身份验证`,
        description: '展示 SQL 注入漏洞'
      },
      {
        label: '安全示例：参数化查询',
        sql: `-- SQL Server
EXEC sp_executesql N'SELECT * FROM users WHERE name = @name',
  N'@name NVARCHAR(100)', @name = @userInput;

-- 应用层（以 Python 为例）
cursor.execute("SELECT * FROM users WHERE name = %s", (user_input,))

-- DuckDB（Python 绑定）
duckdb.sql("SELECT * FROM users WHERE name = $1", params=[user_input])`,
        description: '使用参数化查询防止注入'
      },
      {
        label: '最佳实践',
        markdown: `**SQL 注入防御最佳实践：**
- 始终使用参数化查询或存储过程
- 遵循最小权限原则
- 对用户输入进行白名单校验
- 定期审计数据库账号和权限`,
        description: '防御措施总结'
      }
    ]
  }
];

export const DCLTCLPanel: React.FC<DCLTCLPanelProps> = ({
  onCopy,
  onInsert,
  copiedId
}) => {
  const [expandedCategory, setExpandedCategory] = useState<Set<string>>(new Set(DCLTCL_DATA.map(item => item.id)));
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
      setExpandedCategory(new Set(DCLTCL_DATA.map(item => item.id)));
      const allSnippetIds = new Set<string>();
      DCLTCL_DATA.forEach((item) => {
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
          共 {DCLTCL_DATA.length} 个分类，{DCLTCL_DATA.reduce((acc, item) => acc + item.snippets.length, 0)} 个代码块
        </span>
        <button
          onClick={toggleAllCategories}
          className="px-3 py-1.5 text-xs rounded bg-monokai-accent/20 text-monokai-accent hover:bg-monokai-accent/30 transition-colors"
        >
          {allCategoriesExpanded ? '全部折叠' : '全部展开'}
        </button>
      </div>
      <div className="space-y-4">
        {DCLTCL_DATA.map((item) => (
          <div key={item.id}>
            {/* 分类头部 - 可展开/折叠整个类别 */}
            <div className="bg-monokai-sidebar border border-monokai-accent rounded-lg overflow-hidden mb-3">
              <div 
                className="px-4 py-2 bg-monokai-bg border-b border-monokai-accent flex items-center justify-between cursor-pointer hover:bg-monokai-accent/10"
                onClick={() => toggleExpandCategory(item.id)}
              >
                <div className="flex items-center gap-2">
                  {item.category === '权限' && <Key className="w-4 h-4 text-monokai-red" />}
                  {item.category === '事务' && <Database className="w-4 h-4 text-monokai-blue" />}
                  {item.category === '原理' && <Lock className="w-4 h-4 text-monokai-purple" />}
                  {item.category === '安全' && <AlertTriangle className="w-4 h-4 text-monokai-orange" />}
                  <span className="font-medium text-monokai-fg">{item.title}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-monokai-red/20 text-monokai-red">
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
                            <span className="text-xs px-1.5 py-0.5 rounded bg-monokai-purple/20 text-monokai-purple mr-1">
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
                                    onInsert(snippet.sql!);
                                  }}
                                  className="p-1.5 rounded hover:bg-monokai-blue/30 text-monokai-comment hover:text-monokai-blue transition-colors"
                                  title="插入到 SQL 编辑器"
                                >
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {/* 复制按钮 */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onCopy?.(snippetId, snippet.sql || snippet.markdown || '');
                                }}
                                className="p-1.5 rounded hover:bg-monokai-accent/30 text-monokai-comment hover:text-monokai-fg transition-colors"
                                title="复制内容"
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

export default DCLTCLPanel;
