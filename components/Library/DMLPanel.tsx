/**
 * DMLPanel - DML 数据操作语言面板
 * 
 * 显示 DML 相关内容：INSERT、UPDATE、DELETE、UPSERT、CTE、批量操作、导出
 */

import React, { useState, useCallback } from 'react';
import { Copy, Check, Plus, Edit, Trash2, Database, ArrowRight, Play, ChevronDown, ChevronUp } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { EditorView } from '@codemirror/view';
import { monokai } from '@uiw/codemirror-theme-monokai';
import { duckDBService } from '../../services/duckdbService';
import { ResultTable } from '../Learn/ResultTable';

interface DMLPanelProps {
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

// DML 知识数据 - 基于"我的人生"本体论数据模型
// SQL 代码片段（用于细粒度展示）
interface SqlSnippet {
  label: string;       // 片段标题
  sql: string;        // SQL 语句
  description?: string; // 简短说明
}

const DML_DATA: {
  id: string;
  title: string;
  category: string;
  snippets: SqlSnippet[];
  description?: string;
}[] = [
  {
    id: 'insert',
    title: 'INSERT 插入数据',
    category: '插入',
    description: '插入单行、多行、从查询插入',
    snippets: [
      {
        label: '插入单行',
        sql: `INSERT INTO life_object_type (id, name, description)
VALUES (1, 'Aspect', '生活维度');`,
        description: '向表中插入单行数据'
      },
      {
        label: '插入多行',
        sql: `INSERT INTO life_object VALUES
    (1, 1, '心态', '{"state": "焦虑", "goal": "内心平静"}'),
    (2, 1, '工作', '{"role": "工程师"}'),
    (3, 1, '家庭', '{"priority": "最高"}');`,
        description: '批量插入多行数据（推荐）'
      },
      {
        label: '插入关系类型',
        sql: `INSERT INTO life_link_type VALUES
    (1, '影响', 'A 作用于 B'),
    (2, '养活', 'A 为 B 提供物质基础'),
    (3, '锚定', 'A 为 B 提供精神支撑');`,
        description: '插入关系类型数据'
      },
      {
        label: '插入对象链接',
        sql: `INSERT INTO life_link VALUES
    (1, 1, 1, 2, 0.9),  -- 心态 -> 影响 -> 工作
    (2, 2, 2, 3, 1.0);  -- 工作 -> 养活 -> 家庭`,
        description: '插入对象之间的关系'
      }
    ]
  },
  {
    id: 'update',
    title: 'UPDATE 更新数据',
    category: '修改',
    description: '更新单列、多列、使用表达式和子查询',
    snippets: [
      {
        label: '更新单列',
        sql: `UPDATE life_object
SET properties = '{"state": "平静", "goal": "内心平静"}'
WHERE name = '心态';`,
        description: '更新指定行的单列'
      },
      {
        label: '更新多列',
        sql: `UPDATE life_object
SET 
    properties = '{"state": "焦虑", "goal": "调整中"}',
    name = '工作（新）'
WHERE name = '工作';`,
        description: '同时更新多列'
      },
      {
        label: '使用表达式更新',
        sql: `UPDATE life_link
SET weight = weight * 1.1
WHERE weight < 0.8;`,
        description: '使用计算表达式更新'
      },
      {
        label: '更新行动状态',
        sql: `UPDATE life_action
SET status = 'executed'
WHERE name = '深呼吸';`,
        description: '更新行动执行状态'
      }
    ]
  },
  {
    id: 'delete',
    title: 'DELETE 删除数据',
    category: '删除',
    description: '删除指定行、满足条件的所有行',
    snippets: [
      {
        label: '删除指定行',
        sql: `DELETE FROM life_action
WHERE name = '深呼吸';`,
        description: '删除满足条件的行'
      },
      {
        label: '删除满足条件的所有行',
        sql: `DELETE FROM life_link
WHERE weight < 0.5;`,
        description: '删除弱关系'
      },
      {
        label: '删除所有数据',
        sql: `DELETE FROM life_link;`,
        description: '删除所有数据（保留表结构）'
      },
      {
        label: '基于其他表删除',
        sql: `DELETE FROM life_object
WHERE object_type_id IN (
    SELECT id FROM life_object_type WHERE name = 'Deprecated'
);`,
        description: '根据其他表的条件删除'
      }
    ]
  },
  {
    id: 'upsert',
    title: 'UPSERT 插入或更新',
    category: '高级',
    description: '插入更新冲突处理',
    snippets: [
      {
        label: '插入或更新',
        sql: `INSERT INTO life_object (id, name, properties)
VALUES (1, '心态', '{"state": "平静"}')
ON CONFLICT (id) DO UPDATE SET
    properties = EXCLUDED.properties;`,
        description: '存在则更新，不存在则插入'
      },
      {
        label: '只在不存在时插入',
        sql: `INSERT INTO life_object (id, name, properties)
VALUES (1, '心态', '{"state": "平静"}')
ON CONFLICT (id) DO NOTHING;`,
        description: '冲突时什么都不做'
      },
      {
        label: '更新关系权重',
        sql: `INSERT INTO life_link (id, link_type_id, source_object_id, target_object_id, weight)
VALUES (1, 1, 1, 2, 0.95)
ON CONFLICT (id) DO UPDATE SET
    weight = GREATEST(life_link.weight, EXCLUDED.weight);`,
        description: '取最大值更新'
      }
    ]
  },
  {
    id: 'merge',
    title: 'MERGE 合并操作',
    category: '高级',
    description: '根据条件合并数据',
    snippets: [
      {
        label: 'MERGE 基础用法',
        sql: `MERGE INTO target_table AS t
USING source_table AS s
ON t.id = s.id
WHEN MATCHED AND s.is_deleted = true THEN
    DELETE
WHEN MATCHED THEN
    UPDATE SET
        name = s.name,
        updated_at = CURRENT_DATE
WHEN NOT MATCHED THEN
    INSERT (id, name, created_at)
    VALUES (s.id, s.name, CURRENT_DATE);`,
        description: '根据条件插入、更新或删除'
      },
      {
        label: '简化版本',
        sql: `MERGE INTO life_object AS t
USING (VALUES (1, '新心态', '{"state": "平静"}')) AS s(id, name, properties)
ON t.id = s.id
WHEN MATCHED THEN
    UPDATE SET name = s.name, properties = s.properties
WHEN NOT MATCHED THEN
    INSERT (id, name, properties)
    VALUES (s.id, s.name, s.properties);`,
        description: '更新已存在记录，插入新记录'
      }
    ]
  },
  {
    id: 'transaction',
    title: '事务控制',
    category: '高级',
    description: 'BEGIN、COMMIT、ROLLBACK、SAVEPOINT',
    snippets: [
      {
        label: '基本事务',
        sql: `BEGIN;

INSERT INTO life_object VALUES (99, 1, '测试', '{"test": true}');
INSERT INTO life_link VALUES (99, 1, 99, 1, 0.5);

COMMIT;`,
        description: '开始事务并提交'
      },
      {
        label: '保存点',
        sql: `BEGIN;
INSERT INTO life_object VALUES (100, 1, '对象1', '{"test": true}');
SAVEPOINT sp1;
INSERT INTO life_object VALUES (101, 1, '对象2', '{"test": true}');
ROLLBACK TO SAVEPOINT sp1;
COMMIT;`,
        description: '部分回滚，保留之前的操作'
      }
    ]
  },
  {
    id: 'copy-export',
    title: 'COPY 导入导出',
    category: '导出',
    description: '导入导出 CSV、Parquet、JSON',
    snippets: [
      {
        label: '导出 CSV',
        sql: `COPY life_object TO 'life_objects.csv' (HEADER, DELIMITER ',');`,
        description: '导出为 CSV 格式'
      },
      {
        label: '导出 Parquet',
        sql: `COPY life_object TO 'objects.parquet' (FORMAT PARQUET, CODEC snappy);`,
        description: '导出为 Parquet 格式'
      },
      {
        label: '导入 CSV',
        sql: `COPY life_object FROM 'life_objects.csv' (HEADER, DELIMITER ',');`,
        description: '从 CSV 文件导入'
      },
      {
        label: '导入 Parquet',
        sql: `COPY life_object FROM 'objects.parquet' (FORMAT PARQUET);`,
        description: '从 Parquet 文件导入'
      }
    ]
  }
];

export const DMLPanel: React.FC<DMLPanelProps> = ({
  onCopy,
  onInsert,
  copiedId
}) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(DML_DATA.map(item => item.id)));
  const [expandedSnippets, setExpandedSnippets] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(true);
  const [executionResults, setExecutionResults] = useState<Record<string, ExecutionResult>>({});

  // 执行 SQL
  const handleExecute = useCallback(async (id: string, sql: string) => {
    const isMutation = /insert|delete|update|truncate/i.test(sql);
    if (isMutation) {
      const confirmRun = window.confirm("【执行安全确认】\n提示：此操作是一个 DML (数据操纵) 语句，执行后将直接插入、更新或删除当前数据库的数据。\n\n您确定要在当前数据库中运行这段代码吗？");
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
      // 折叠所有
      setExpandedItems(new Set());
      setExpandedSnippets(new Set());
    } else {
      // 展开所有
      setExpandedItems(new Set(DML_DATA.map(item => item.id)));
      const allSnippetIds = new Set<string>();
      DML_DATA.forEach((item) => {
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
          共 {DML_DATA.length} 个分类，{DML_DATA.reduce((acc, item) => acc + item.snippets.length, 0)} 个代码块
        </span>
        <button
          onClick={toggleAll}
          className="px-3 py-1.5 text-xs rounded bg-monokai-accent/20 text-monokai-accent hover:bg-monokai-accent/30 transition-colors"
        >
          {allExpanded ? '全部折叠' : '全部展开'}
        </button>
      </div>
      <div className="space-y-3">
        {DML_DATA.map((item) => (
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
                {item.category === '插入' && <Plus className="w-4 h-4 text-monokai-green" />}
                {item.category === '修改' && <Edit className="w-4 h-4 text-monokai-blue" />}
                {item.category === '删除' && <Trash2 className="w-4 h-4 text-monokai-red" />}
                {item.category === '高级' && <Database className="w-4 h-4 text-monokai-amethyst" />}
                {item.category === '导出' && <Database className="w-4 h-4 text-monokai-yellow" />}
                <span className="font-medium text-monokai-fg">{item.title}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-monokai-orange/20 text-monokai-orange">
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

export default DMLPanel;
