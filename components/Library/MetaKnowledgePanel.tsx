/**
 * MetaKnowledgePanel - 元知识面板
 * 
 * 显示 SQL 基础概念：语言分类、OLTP/OLAP、执行顺序、数据类型、方言差异、SQL标准演进
 * 使用 CodeMirror 实现语法高亮（与 Learn 板块一致）
 */

import React, { useState } from 'react';
import { BookOpen, Copy, Check, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SqlCodeBlock } from './SqlCodeBlock';

interface MetaKnowledgePanelProps {
  onCopy?: (id: string, content: string) => void;
  onInsert?: (sql: string) => void;
  copiedId?: string | null;
}

// 元知识数据 - 拆分为独立卡片
interface KnowledgeItem {
  id: string;
  title: string;
  category: string;
  content: string;
  syntax?: string;
}

const META_KNOWLEDGE_DATA: KnowledgeItem[] = [
  {
    id: 'sql-classification',
    title: 'SQL 语言分类总览',
    category: '基础概念',
    content: `SQL 命令根据用途分为五个分类：

| 分类 | 全称 | 核心用途 |
|------|------|---------|
| DDL | Data Definition Language | 定义/修改数据库架构（表、索引、视图） |
| DML | Data Manipulation Language | 处理数据记录（增、删，改） |
| DQL | Data Query Language | 从数据库检索数据（查） |
| DCL | Data Control Language | 管理访问权限与安全 |
| TCL | Transaction Control Language | 管理事务，确保一致性 |`,
    syntax: `-- 无直接语法，这是概念分类`
  },
  {
    id: 'oltp-olap',
    title: 'OLTP vs OLAP',
    category: '基础概念',
    content: `选择数据库首先取决于工作负载类型：

**【OLTP - 联机事务处理】**
- 核心目标：高并发、低延迟的增删改查
- 典型操作：单行 INSERT/UPDATE/DELETE、点查
- 存储模型：行存储（Row-oriented）
- 代表产品：MySQL、PostgreSQL、SQL Server、Oracle

**【OLAP - 联机分析处理】**
- 核心目标：海量数据的复杂聚合分析
- 典型操作：全表扫描、多表 JOIN、窗口函数
- 存储模型：列存储（Column-oriented）
- 代表产品：DuckDB、ClickHouse、Snowflake、BigQuery

**【DuckDB 独特定位】**
嵌入式（无需服务器）、进程内运行的 OLAP 引擎。类比"分析领域的 SQLite"。可直接查询 CSV/Parquet/JSON 文件。`,
    syntax: `-- 无直接语法，这是概念区分`
  },
  {
    id: 'execution-order',
    title: 'SQL 查询逻辑执行顺序',
    category: '核心原理',
    content: `SQL 的书写顺序和执行顺序完全不同：

**【书写顺序】**
SELECT → FROM → WHERE → GROUP BY → HAVING → SELECT → QUALIFY → ORDER BY → LIMIT

**【逻辑执行顺序】**
1. FROM / JOIN     → 确定数据来源
2. ON              → 连接条件过滤
3. WHERE           → 行级条件过滤
4. GROUP BY        → 分组
5. HAVING          → 分组后过滤
6. SELECT / DISTINCT → 选择列并去重
7. QUALIFY         → 窗口函数结果过滤 ★
8. ORDER BY        → 排序
9. LIMIT / OFFSET  → 截取行数

**【核心推论】**
- WHERE 中不能使用 SELECT 中的别名（WHERE 先于 SELECT 执行）
- HAVING 可以使用聚合函数（HAVING 在 GROUP BY 之后执行）
- QUALIFY 在 SELECT 之后执行，可以引用窗口函数结果
- ORDER BY 可以使用别名（ORDER BY 在 SELECT 之后执行）`,
    syntax: `-- 这是执行流程，不是语法`
  },
  {
    id: 'data-types',
    title: '数据类型体系',
    category: '基础概念',
    content: `建表的基石，所有列都必须声明数据类型：

**【精确数值】**
INT, BIGINT, SMALLINT, TINYINT, DECIMAL(p,s), NUMERIC(p,s), HUGEINT(DuckDB)

**【近似数值】**
FLOAT, REAL, DOUBLE（存在精度损失，不适合金融计算）

**【字符串】**
CHAR(n), VARCHAR(n), NVARCHAR(n), TEXT, NTEXT

**【日期时间】**
DATE, TIME, DATETIME, DATETIME2, TIMESTAMP, TIMESTAMPTZ, INTERVAL

**【布尔】**
BOOLEAN(DuckDB/PostgreSQL), BIT(SQL Server), TINYINT(1)(MySQL)

**【二进制】**
BINARY(n), VARBINARY(n), BLOB, IMAGE

**【半结构化】**
JSON, JSONB, XML

**【复合/嵌套】**
ARRAY, LIST, STRUCT, MAP, UNION (DuckDB/PostgreSQL 支持)`,
    syntax: `-- 示例：CREATE TABLE t (id INT, name VARCHAR(100), data JSON);`
  },
  {
    id: 'dialect-differences',
    title: 'SQL 方言差异速查',
    category: '跨方言',
    content: `不同数据库在语法细节上存在差异：

| 功能 | MySQL | PostgreSQL | SQL Server | Oracle | DuckDB |
|------|-------|-----------|------------|--------|--------|
| 限制行数 | LIMIT n | LIMIT n | TOP n | FETCH FIRST | LIMIT n |
| 字符串拼接 | CONCAT() | \|\| | + | \|\| | \|\| 或 CONCAT() |
| 当前时间 | NOW() | NOW() | GETDATE() | SYSDATE | NOW() |
| 空值替代 | IFNULL() | COALESCE() | ISNULL() | NVL() | COALESCE() |
| 自增主键 | AUTO_INCREMENT | SERIAL | IDENTITY | SEQUENCE | GENERATED ALWAYS AS IDENTITY |
| 正则匹配 | REGEXP | ~ / ~* | 无原生 | REGEXP_LIKE() | regexp_matches() |
| QUALIFY | ❌ | ❌ | ❌ | ❌ | ✅ 原生支持 |
| 直接查文件 | ❌ | 需扩展 | ❌ | ❌ | ✅ 原生 CSV/Parquet |
| ASOF JOIN | ❌ | ❌ | ❌ | ❌ | ✅ 原生支持 |
| PIVOT/UNPIVOT | 手动 CASE | 扩展 | ✅ | ✅ | ✅ 原生 |`,
    syntax: `-- 参见上方表格`
  },
  {
    id: 'sql-standards',
    title: 'SQL 标准演进简表',
    category: '标准演进',
    content: `| 标准版本 | 引入的关键特性 |
|---------|--------------|
| SQL-86 / SQL-89 | 基础 SELECT / INSERT / UPDATE / DELETE |
| SQL-92 | JOIN 语法、CASE 表达式、子查询、CAST |
| SQL:1999 | CTE（WITH）、RECURSIVE、窗口函数、BOOLEAN、触发器 |
| SQL:2003 | MERGE、SEQUENCE、XML 支持、窗口帧（ROWS/RANGE） |
| SQL:2011 | 时态表（Temporal Tables）、PERIOD |
| SQL:2016 | JSON 函数（JSON_VALUE / JSON_QUERY / JSON_TABLE） |
| SQL:2023 | GRAPH 查询、ANY VALUE 聚合、多维数组增强 |`,
    syntax: `-- 这是标准演进历史，不是具体语法`
  }
];

export const MetaKnowledgePanel: React.FC<MetaKnowledgePanelProps> = ({
  onCopy,
  onInsert,
  copiedId
}) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(META_KNOWLEDGE_DATA.map(item => item.id)));
  const [allExpanded, setAllExpanded] = useState(true);

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

  const toggleAll = () => {
    if (allExpanded) {
      setExpandedItems(new Set());
    } else {
      setExpandedItems(new Set(META_KNOWLEDGE_DATA.map(item => item.id)));
    }
    setAllExpanded(!allExpanded);
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* 一键展开/折叠按钮 */}
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs text-monokai-comment">
          共 {META_KNOWLEDGE_DATA.length} 个知识点
        </span>
        <button
          onClick={toggleAll}
          className="px-3 py-1.5 text-xs rounded bg-monokai-accent/20 text-monokai-accent hover:bg-monokai-accent/30 transition-colors"
        >
          {allExpanded ? '全部折叠' : '全部展开'}
        </button>
      </div>
      <div className="space-y-4">
        {META_KNOWLEDGE_DATA.map((item) => (
          <div
            key={item.id}
            className="bg-monokai-sidebar border border-monokai-accent rounded-lg overflow-hidden"
          >
            <div 
              className="px-4 py-3 bg-monokai-bg border-b border-monokai-accent flex items-center justify-between cursor-pointer hover:bg-monokai-accent/10"
              onClick={() => toggleExpand(item.id)}
            >
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-monokai-blue" />
                <span className="font-medium text-monokai-fg">{item.title}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-monokai-blue/20 text-monokai-blue">
                  {item.category}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {expandedItems.has(item.id) ? (
                  <ChevronUp className="w-4 h-4 text-monokai-comment" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-monokai-comment" />
                )}
              </div>
            </div>
            {expandedItems.has(item.id) && (
              <div className="p-4">
                <div className="markdown-body" style={{ fontSize: '12px' }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {item.content}
                  </ReactMarkdown>
                </div>
                <div className="flex items-center gap-1 mt-3 pt-3 border-t border-monokai-accent">
                  {/* 插入编辑器按钮 */}
                  {onInsert && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onInsert(item.syntax || '');
                      }}
                      className="p-1.5 rounded hover:bg-monokai-blue/30 text-monokai-comment hover:text-monokai-blue transition-colors"
                      title="插入到 SQL 编辑器"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCopy?.(item.id, item.content);
                    }}
                    className="p-1.5 rounded hover:bg-monokai-accent/30 text-monokai-comment hover:text-monokai-fg transition-colors"
                    title="复制内容"
                  >
                    {copiedId === item.id ? (
                      <Check className="w-4 h-4 text-monokai-green" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {item.syntax && (
                  <div className="mt-3 pt-3 border-t border-monokai-accent">
                    <SqlCodeBlock code={item.syntax} />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MetaKnowledgePanel;
