/**
 * DDLPanel - DDL 数据定义语言面板
 * 
 * 显示 DDL 相关内容：库表创建、临时表、ALTER TABLE、约束、索引、视图、物化视图、触发器、序列、分区
 */

import React, { useState, useCallback } from 'react';
import { Copy, Check, ChevronRight, Database, Table, ListOrdered, Eye, Cpu, ArrowRight, ChevronDown, ChevronUp, Play } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { EditorView } from '@codemirror/view';
import { monokai } from '@uiw/codemirror-theme-monokai';
import { duckDBService } from '../../services/duckdbService';
import { ResultTable } from '../Learn/ResultTable';

interface DDLPanelProps {
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

// SQL 代码片段（用于细粒度展示）
interface SqlSnippet {
  label: string;       // 片段标题
  sql: string;        // SQL 语句
  description?: string; // 简短说明
}

// DDL 知识数据 - 基于"我的人生"本体论数据模型
const DDL_DATA: {
  id: string;
  title: string;
  category: string;
  snippets: SqlSnippet[];
  description?: string;
}[] = [
  {
    id: 'create-database',
    title: '创建数据库',
    category: '基础',
    description: '数据库的创建、查看、切换',
    snippets: [
      {
        label: '创建数据库',
        sql: 'CREATE DATABASE intelligence_db;',
        description: '创建一个新的数据库'
      },
      {
        label: '查看所有数据库',
        sql: 'SHOW DATABASES;',
        description: '列出当前所有数据库'
      },
      {
        label: '切换数据库',
        sql: 'USE intelligence_db;',
        description: '切换到指定数据库'
      }
    ]
  },
  {
    id: 'create-table',
    title: '创建表结构',
    category: '基础',
    description: '"我的人生"本体论五张核心表',
    snippets: [
      {
        label: '① life_object_type 表',
        sql: `CREATE TABLE life_object_type (
    id INTEGER PRIMARY KEY,
    name VARCHAR NOT NULL,
    description VARCHAR
);`,
        description: '对象类型 - 生活维度、人物、目标'
      },
      {
        label: '② life_object 表',
        sql: `CREATE TABLE life_object (
    id INTEGER PRIMARY KEY,
    object_type_id INTEGER REFERENCES life_object_type(id),
    name VARCHAR NOT NULL,
    properties JSON DEFAULT '{}'
);`,
        description: '对象实例 - 心态、工作、家庭、身体'
      },
      {
        label: '③ life_link_type 表',
        sql: `CREATE TABLE life_link_type (
    id INTEGER PRIMARY KEY,
    name VARCHAR NOT NULL,
    description VARCHAR
);`,
        description: '链接类型 - 影响、养活、锚定、支撑'
      },
      {
        label: '④ life_link 表',
        sql: `CREATE TABLE life_link (
    id INTEGER PRIMARY KEY,
    link_type_id INTEGER REFERENCES life_link_type(id),
    source_object_id INTEGER REFERENCES life_object(id),
    target_object_id INTEGER REFERENCES life_object(id),
    weight DECIMAL(3,2) DEFAULT 1.0
);`,
        description: '对象链接 - 关系实例'
      },
      {
        label: '⑤ life_action 表',
        sql: `CREATE TABLE life_action (
    id INTEGER PRIMARY KEY,
    name VARCHAR NOT NULL,
    description VARCHAR,
    status VARCHAR DEFAULT 'pending',
    execute_at DATE
);`,
        description: '行动 - 尚未执行的操作'
      }
    ]
  },
  {
    id: 'ctas-drop-truncate',
    title: 'CTAS / 删除 / 清空',
    category: '基础',
    description: '其他建表和删除操作',
    snippets: [
      {
        label: 'CTAS 创建表',
        sql: `CREATE TABLE active_objects AS
SELECT * FROM life_object 
WHERE properties['state']::VARCHAR = '焦虑';`,
        description: '从查询结果创建新表'
      },
      {
        label: '删除表',
        sql: `DROP TABLE life_link;
DROP TABLE IF EXISTS life_link;`,
        description: '删除表（结构+数据），安全写法带 IF EXISTS'
      },
      {
        label: '清空表数据',
        sql: `TRUNCATE TABLE life_action;`,
        description: '删除所有行但保留表结构'
      }
    ]
  },
  {
    id: 'temp-table',
    title: '临时表',
    category: '基础',
    description: '会话级临时存储',
    snippets: [
      {
        label: '创建临时表',
        sql: `CREATE TEMP TABLE type_stats AS
SELECT lot.name AS type_name, COUNT(lo.id) AS object_count
FROM life_object_type lot
LEFT JOIN life_object lo ON lot.id = lo.object_type_id
GROUP BY lot.name;`,
        description: '会话级临时表，连接断开后自动销毁'
      },
      {
        label: '临时表存储关系',
        sql: `CREATE TEMP TABLE high_weight_links AS
SELECT ll.*, lt.name AS link_type_name
FROM life_link ll
JOIN life_link_type lt ON ll.link_type_id = lt.id
WHERE ll.weight > 0.8;`,
        description: '存储中间计算结果'
      }
    ]
  },
  {
    id: 'alter-table',
    title: '表结构修改',
    category: '修改',
    description: '修改已有表的结构',
    snippets: [
      {
        label: '新增列',
        sql: `ALTER TABLE life_object 
ADD priority INTEGER DEFAULT 0;`,
        description: '添加新列'
      },
      {
        label: '删除列',
        sql: `ALTER TABLE life_object 
DROP COLUMN priority;`,
        description: '移除列'
      },
      {
        label: '修改列类型',
        sql: `ALTER TABLE life_object 
ALTER COLUMN name VARCHAR(200);`,
        description: '更改列定义'
      },
      {
        label: '重命名列',
        sql: `ALTER TABLE life_object 
RENAME COLUMN name TO object_name;`,
        description: '更改列名'
      }
    ]
  },
  {
    id: 'constraints',
    title: '约束体系',
    category: '约束',
    description: '数据完整性约束',
    snippets: [
      {
        label: '常用约束',
        sql: `id           INTEGER PRIMARY KEY,           -- 主键
confidence   DECIMAL(3,2) NOT NULL,        -- 非空
name         VARCHAR(100) UNIQUE,          -- 唯一
status       VARCHAR(20) DEFAULT 'active', -- 默认值
created_at   DATE CHECK (created_at >= '2020-01-01')`,
        description: '主键、唯一、非空、默认值、检查约束'
      },
      {
        label: '外键约束',
        sql: `FOREIGN KEY (object_type_id) REFERENCES life_object_type(id),
FOREIGN KEY (link_type_id) REFERENCES life_link_type(id),
FOREIGN KEY (source_object_id) REFERENCES life_object(id),
FOREIGN KEY (target_object_id) REFERENCES life_object(id)`,
        description: '表间关联关系'
      },
      {
        label: '级联操作',
        sql: `ON DELETE CASCADE   -- 删除父记录时级联删除子记录
ON DELETE SET NULL  -- 删除父记录时将外键设为 NULL
ON DELETE RESTRICT  -- 阻止删除有子记录的父记录`,
        description: '外键级联行为'
      }
    ]
  },
  {
    id: 'index',
    title: '索引管理',
    category: '性能',
    description: '加速查询的数据结构',
    snippets: [
      {
        label: '创建索引',
        sql: `CREATE INDEX idx_object_type ON life_object(object_type_id);
CREATE INDEX idx_link_weight ON life_link(weight);
CREATE INDEX idx_action_status ON life_action(status);`,
        description: '为频繁查询的列创建索引'
      },
      {
        label: '唯一索引',
        sql: `CREATE UNIQUE INDEX idx_link_type_name ON life_link_type(name);`,
        description: '确保列值唯一'
      },
      {
        label: '删除索引',
        sql: `DROP INDEX idx_object_type;
DROP INDEX IF EXISTS idx_object_type;`,
        description: '移除索引'
      }
    ]
  },
  {
    id: 'view',
    title: '视图',
    category: '视图',
    description: '虚拟表',
    snippets: [
      {
        label: '创建视图',
        sql: `CREATE VIEW v_core_objects AS
SELECT lo.id, lo.name, lot.name AS type_name, lo.properties
FROM life_object lo
JOIN life_object_type lot ON lo.object_type_id = lot.id;`,
        description: '封装常用查询逻辑'
      },
      {
        label: '使用视图',
        sql: `SELECT * FROM v_core_objects 
WHERE type_name = 'Aspect';`,
        description: '像使用普通表一样查询'
      },
      {
        label: '物化视图 (DuckDB)',
        sql: `-- DuckDB 用 CTAS 模拟物化视图
CREATE TABLE mv_type_statistics AS
SELECT lot.name AS type_name, COUNT(lo.id) AS object_count
FROM life_object_type lot
LEFT JOIN life_object lo ON lot.id = lo.object_type_id
GROUP BY lot.name;`,
        description: '预先计算并存储结果'
      }
    ]
  }
];

export const DDLPanel: React.FC<DDLPanelProps> = ({
  onCopy,
  onInsert,
  copiedId
}) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(DDL_DATA.map(item => item.id)));
  const [expandedSnippets, setExpandedSnippets] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(true);
  const [executionResults, setExecutionResults] = useState<Record<string, ExecutionResult>>({});

  // 执行 SQL
  const handleExecute = useCallback(async (id: string, sql: string) => {
    const isMutation = /create|drop|alter|insert|delete|update|truncate/i.test(sql);
    if (isMutation) {
      const confirmRun = window.confirm("【执行安全确认】\n提示：此操作是一个 DDL (数据定义) 语句，执行后将直接修改当前数据库的表结构。\n\n您确定要在当前数据库中运行这段代码吗？");
      if (!confirmRun) {
        setExecutionResults(prev => ({
          ...prev,
          [id]: { data: null, error: "执行已被取消 (用户未确认风险)", loading: false }
        }));
        return;
      }
    }

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

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
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

  const toggleAll = () => {
    if (allExpanded) {
      // 折叠所有：清空分类和代码块
      setExpandedItems(new Set());
      setExpandedSnippets(new Set());
    } else {
      // 展开所有：展开所有分类和所有代码块
      setExpandedItems(new Set(DDL_DATA.map(item => item.id)));
      const allSnippetIds = new Set<string>();
      DDL_DATA.forEach((item) => {
        item.snippets.forEach((_, snippetIdx) => {
          allSnippetIds.add(`${item.id}-${snippetIdx}`);
        });
      });
      setExpandedSnippets(allSnippetIds);
    }
    setAllExpanded(!allExpanded);
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* 一键展开/折叠按钮 */}
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs text-monokai-comment">
          共 {DDL_DATA.length} 个分类，{DDL_DATA.reduce((acc, item) => acc + item.snippets.length, 0)} 个代码块
        </span>
        <button
          onClick={toggleAll}
          className="px-3 py-1.5 text-xs rounded bg-monokai-accent/20 text-monokai-accent hover:bg-monokai-accent/30 transition-colors"
        >
          {allExpanded ? '全部折叠' : '全部展开'}
        </button>
      </div>
      <div className="space-y-3">
        {DDL_DATA.map((item) => (
          <div
            key={item.id}
            className="bg-monokai-sidebar border border-monokai-accent rounded-lg overflow-hidden"
          >
            {/* 卡片头部 - 可展开/折叠 */}
            <div 
              className="px-4 py-2 bg-monokai-bg border-b border-monokai-accent flex items-center justify-between cursor-pointer hover:bg-monokai-accent/10"
              onClick={() => toggleExpand(item.id)}
            >
              <div className="flex items-center gap-2">
                {item.category === '基础' && <Database className="w-4 h-4 text-monokai-green" />}
                {item.category === '修改' && <Table className="w-4 h-4 text-monokai-blue" />}
                {item.category === '约束' && <Check className="w-4 h-4 text-monokai-red" />}
                {item.category === '性能' && <ListOrdered className="w-4 h-4 text-monokai-yellow" />}
                {item.category === '视图' && <Eye className="w-4 h-4 text-monokai-amethyst" />}
                {item.category === '自动化' && <Cpu className="w-4 h-4 text-monokai-cyan" />}
                <span className="font-medium text-monokai-fg">{item.title}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-monokai-green/20 text-monokai-green">
                  {item.category}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-monokai-comment">
                  {item.snippets.length} 个片段
                </span>
                {expandedItems.has(item.id) ? (
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

            {/* 展开的片段列表 */}
            {expandedItems.has(item.id) && (
              <div className="p-3 space-y-3">
                {item.snippets.map((snippet, idx) => (
                  <div 
                    key={idx}
                    className="bg-monokai-bg rounded border border-monokai-accent/50 overflow-hidden"
                  >
                    {/* 片段标题栏 */}
                    <div className="px-3 py-2 bg-monokai-accent/10 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-monokai-fg">{snippet.label}</span>
                        {snippet.description && (
                          <span className="text-xs text-monokai-comment">- {snippet.description}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
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
                              className={`p-1 rounded transition-colors ${
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
                            className="p-1 rounded hover:bg-monokai-blue/30 text-monokai-comment hover:text-monokai-blue transition-colors"
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
                          className="p-1 rounded hover:bg-monokai-accent/30 text-monokai-comment hover:text-monokai-fg transition-colors"
                          title="复制 SQL"
                        >
                          {copiedId === `${item.id}-${idx}` ? (
                            <Check className="w-3.5 h-3.5 text-monokai-green" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                    
                    {/* CodeMirror 代码块 */}
                    <div className="border-t border-monokai-accent/30">
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
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DDLPanel;
