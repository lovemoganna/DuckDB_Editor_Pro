/**
 * OntologyPanel - 本体论知识工作台
 *
 * 基于 MECE 原则设计，围绕"我的人生"场景展开
 * 5 大互斥分类 × 7 维度背景说明 × AI 一键填充 × 快速清除
 *
 * MECE 分类体系：
 * - DDL-结构：五张核心表的创建
 * - DML-操作：数据增删改操作
 * - DQL-查询：基础检索查询
 * - DQL-分析：高级分析查询（聚合、递归）
 * - DDL-进阶：视图与清理
 */

import React, { useState, useCallback } from 'react';
import {
  Copy, Check, ChevronDown, ChevronUp, ArrowRight, Play,
  Network, Layers, Link2, Zap, Database, Eye,
  ArrowDownRight, TrendingUp, BookOpen, Sparkles,
  Trash2, Lightbulb, AlertTriangle, Loader2, RotateCcw, Info,
  Target, Star, Clock
} from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { EditorView } from '@codemirror/view';
import { monokai } from '@uiw/codemirror-theme-monokai';
import { duckDBService } from '../../services/duckdbService';
import { ResultTable } from '../Learn/ResultTable';
import {
  CATEGORY_HELP,
  AI_FILL_TEMPLATES,
  CategoryHelpData
} from '../../hooks/useOntologyPanel';

interface OntologyPanelProps {
  onCopy?: (id: string, content: string) => void;
  onInsert?: (sql: string) => void;
  copiedId?: string | null;
  onTablesReady?: () => void;
}

interface ExecutionResult {
  data: any[] | null;
  error: string | null;
  loading: boolean;
  executionTime?: number;
}

interface SqlSnippet {
  label: string;
  sql: string;
  description?: string;
  refreshTables?: boolean;
}

interface OntologyCategory {
  id: string;
  title: string;
  icon: React.ElementType;
  color: string;
  badgeColor: string;
  description: string;
  meceCategory: string;
  snippets: SqlSnippet[];
}

// ============================================================
// MECE 五分类数据 - 互斥且完整穷尽
// ============================================================

const ONTOLOGY_DATA: OntologyCategory[] = [

  // ─────────────────────────────────────────────
  // 第 1 类：DDL-结构（表结构定义）
  // ─────────────────────────────────────────────
  {
    id: 'ddl-structure',
    title: 'DDL 结构定义',
    icon: Database,
    color: 'text-monokai-purple',
    badgeColor: 'bg-monokai-purple/20 text-monokai-purple',
    description: '创建"我的人生"五张核心表。类型表是金字塔尖，实例表通过外键引用类型表。',
    meceCategory: 'ddl-structure',
    snippets: [
      {
        label: '创建对象类型表',
        sql: `CREATE TABLE life_object_type (
    id          INTEGER PRIMARY KEY,
    name        VARCHAR NOT NULL,
    description VARCHAR
);`,
        description: 'id、name、description 三列',
        refreshTables: true
      },
      {
        label: '创建对象实例表',
        sql: `CREATE TABLE life_object (
    id             INTEGER PRIMARY KEY,
    object_type_id INTEGER REFERENCES life_object_type(id),
    name           VARCHAR NOT NULL,
    properties     JSON    DEFAULT '{}'
);`,
        description: 'object_type_id 指向类型表，properties 用 JSON 存储灵活属性',
        refreshTables: true
      },
      {
        label: '创建关系类型表',
        sql: `CREATE TABLE life_link_type (
    id          INTEGER PRIMARY KEY,
    name        VARCHAR NOT NULL,
    description VARCHAR
);`,
        description: '和对象类型表结构相同，但语义不同',
        refreshTables: true
      },
      {
        label: '创建关系实例表',
        sql: `CREATE TABLE life_link (
    id               INTEGER PRIMARY KEY,
    link_type_id     INTEGER REFERENCES life_link_type(id),
    source_object_id INTEGER REFERENCES life_object(id),
    target_object_id INTEGER REFERENCES life_object(id),
    weight           DECIMAL(3,2) DEFAULT 1.0
);`,
        description: '三个外键 + weight 表示关系强度 0.0~1.0',
        refreshTables: true
      },
      {
        label: '创建行动表',
        sql: `CREATE TABLE life_action (
    id          INTEGER PRIMARY KEY,
    name        VARCHAR NOT NULL,
    description VARCHAR,
    status      VARCHAR DEFAULT 'pending',
    execute_at  DATE
);`,
        description: 'status 控制状态机：pending→in_progress→executed',
        refreshTables: true
      }
    ]
  },

  // ─────────────────────────────────────────────
  // 第 2 类：DML-操作（数据增删改）
  // ─────────────────────────────────────────────
  {
    id: 'dml-operation',
    title: 'DML 数据操作',
    icon: Zap,
    color: 'text-monokai-yellow',
    badgeColor: 'bg-monokai-yellow/20 text-monokai-yellow',
    description: '插入、修改、删除数据。反思后调整权重是本体论迭代的核心操作。',
    meceCategory: 'dml-operation',
    snippets: [
      {
        label: '插入类型数据',
        sql: `INSERT INTO life_object_type VALUES
    (1, 'Aspect', '生活维度'),
    (2, 'Person', '人物'),
    (3, 'Goal',   '目标');`,
        description: '三个预设类型'
      },
      {
        label: '插入对象实例',
        sql: `INSERT INTO life_object VALUES
    (1, 1, '心态', '{"state": "焦虑", "goal": "内心平静"}'),
    (2, 1, '工作', '{"role": "工程师", "struggle": "沟通"}'),
    (3, 1, '家庭', '{"priority": "最高"}'),
    (4, 1, '身体', '{"state": "还行", "goal": "健康"}');`,
        description: '四个实例都属于 Aspect 类型（object_type_id=1）'
      },
      {
        label: '插入关系类型',
        sql: `INSERT INTO life_link_type VALUES
    (1, '影响', 'A 作用于 B，强度可量化'),
    (2, '养活', 'A 为 B 提供物质基础'),
    (3, '锚定', 'A 为 B 提供精神支撑'),
    (4, '支撑', 'A 为 B 提供基础条件');`,
        description: '四种核心关系'
      },
      {
        label: '插入关系实例',
        sql: `INSERT INTO life_link VALUES
    (1, 1, 1, 2, 0.9),
    (2, 2, 2, 3, 1.0),
    (3, 3, 3, 1, 0.8),
    (4, 4, 4, 1, 0.7);`,
        description: '心态→影响→工作(0.9)，工作→养活→家庭(1.0)，家庭→锚定→心态(0.8)，身体→支撑→心态(0.7)'
      },
      {
        label: '插入预设行动',
        sql: `INSERT INTO life_action VALUES
    (1, '深呼吸', '就这一刻。其他的都不重要。', 'pending', NULL),
    (2, '迈出下一步', '低头看路。路已经在脚下了。', 'pending', NULL);`,
        description: '两个预设行动'
      },
      {
        label: '更新关系权重（反思后）',
        sql: `UPDATE life_link
SET weight = 0.6
WHERE source_object_id = (SELECT id FROM life_object WHERE name = '心态')
  AND target_object_id = (SELECT id FROM life_object WHERE name = '工作');`,
        description: '权重不是一成不变的，定期反思后可以调整'
      },
      {
        label: '标记行动已执行',
        sql: `UPDATE life_action
SET status = 'executed', execute_at = CURRENT_DATE
WHERE name = '深呼吸';`,
        description: '执行完一个行动后更新状态'
      }
    ]
  },

  // ─────────────────────────────────────────────
  // 第 3 类：DQL-查询（基础检索）
  // ─────────────────────────────────────────────
  {
    id: 'dql-query',
    title: 'DQL 数据查询',
    icon: Eye,
    color: 'text-monokai-blue',
    badgeColor: 'bg-monokai-blue/20 text-monokai-blue',
    description: '从五张表检索数据，包括基本查询、JOIN 多表、JSON 属性提取。',
    meceCategory: 'dql-query',
    snippets: [
      {
        label: '查看所有对象及类型',
        sql: `SELECT lo.id, lo.name, lot.name AS type_name, lo.properties
FROM life_object lo
JOIN life_object_type lot ON lo.object_type_id = lot.id;`,
        description: 'JOIN 查看对象时带上类型名称'
      },
      {
        label: '查询某类型的全部对象',
        sql: `SELECT name, properties
FROM life_object
WHERE object_type_id = (
    SELECT id FROM life_object_type WHERE name = 'Aspect'
);`,
        description: '通过子查询查找特定类型的对象'
      },
      {
        label: '完整关系视图（带名称）',
        sql: `SELECT
    src.name         AS 来源对象,
    lt.name          AS 关系类型,
    tgt.name         AS 目标对象,
    ll.weight        AS 强度
FROM life_link ll
JOIN life_link_type lt ON ll.link_type_id  = lt.id
JOIN life_object  src ON ll.source_object_id = src.id
JOIN life_object  tgt ON ll.target_object_id = tgt.id
ORDER BY ll.weight DESC;`,
        description: '三表 JOIN，将 id 翻译成名称'
      },
      {
        label: '查询所有"影响"关系',
        sql: `SELECT
    src.name AS 发起方,
    tgt.name AS 被影响方,
    ll.weight AS 影响强度
FROM life_link ll
JOIN life_link_type lt ON ll.link_type_id = lt.id
JOIN life_object src ON ll.source_object_id = src.id
JOIN life_object tgt ON ll.target_object_id = tgt.id
WHERE lt.name = '影响';`,
        description: '筛选特定关系类型的全部实例'
      },
      {
        label: '关系强度分级',
        sql: `SELECT
    src.name || ' -> ' || tgt.name AS 关系,
    ll.weight,
    CASE
        WHEN ll.weight >= 0.9 THEN '★★★ 核心'
        WHEN ll.weight >= 0.7 THEN '★★ 重要'
        ELSE '★ 一般'
    END AS 重要程度
FROM life_link ll
JOIN life_object src ON ll.source_object_id = src.id
JOIN life_object tgt ON ll.target_object_id = tgt.id;`,
        description: '用 CASE WHEN 对关系强度进行分级'
      },
      {
        label: 'JSON 属性查询：状态为"焦虑"的对象',
        sql: `SELECT name, properties['state']::VARCHAR AS state
FROM life_object
WHERE properties['state']::VARCHAR = '焦虑';`,
        description: 'DuckDB 支持直接用 :: 类型转换从 JSON 提取字段'
      },
      {
        label: 'JSON 属性查询：有目标的对象',
        sql: `SELECT name, properties['goal']::VARCHAR AS goal
FROM life_object
WHERE properties['goal'] IS NOT NULL;`,
        description: '筛选 properties 中存在 goal 字段的行'
      },
      {
        label: '查询所有待执行行动',
        sql: `SELECT name, description FROM life_action WHERE status = 'pending';`,
        description: '查看所有未完成的承诺'
      }
    ]
  },

  // ─────────────────────────────────────────────
  // 第 4 类：DQL-分析（高级分析）
  // ─────────────────────────────────────────────
  {
    id: 'dql-analysis',
    title: 'DQL 数据分析',
    icon: TrendingUp,
    color: 'text-monokai-cyan',
    badgeColor: 'bg-monokai-cyan/20 text-monokai-cyan',
    description: '聚合统计、递归 CTE 追溯影响链。理解本体论整体状态和关系路径。',
    meceCategory: 'dql-analysis',
    snippets: [
      {
        label: '本体论总览',
        sql: `SELECT '对象类型' AS 指标, COUNT(*) AS 数值 FROM life_object_type
UNION ALL
SELECT '对象实例',         COUNT(*)        FROM life_object
UNION ALL
SELECT '关系类型',         COUNT(*)        FROM life_link_type
UNION ALL
SELECT '关系实例',         COUNT(*)        FROM life_link
UNION ALL
SELECT '待执行行动',       COUNT(*)        FROM life_action WHERE status = 'pending';`,
        description: '用 UNION ALL 统计各表行数'
      },
      {
        label: '每个类型的对象数量',
        sql: `SELECT
    lot.name  AS 类型名称,
    COUNT(lo.id) AS 对象数量
FROM life_object_type lot
LEFT JOIN life_object lo ON lot.id = lo.object_type_id
GROUP BY lot.id, lot.name
ORDER BY 对象数量 DESC;`,
        description: '统计各类型的实例数量（LEFT JOIN 含零计数）'
      },
      {
        label: '每种关系的数量和平均强度',
        sql: `SELECT
    lt.name           AS 关系类型,
    COUNT(ll.id)      AS 实例数,
    AVG(ll.weight)    AS 平均强度,
    MAX(ll.weight)    AS 最强,
    MIN(ll.weight)    AS 最弱
FROM life_link_type lt
LEFT JOIN life_link ll ON lt.id = ll.link_type_id
GROUP BY lt.id, lt.name
ORDER BY 实例数 DESC;`,
        description: '了解哪种关系类型使用最频繁'
      },
      {
        label: '最核心的关系（Top 3）',
        sql: `SELECT
    src.name || ' --(' || lt.name || ')--> ' || tgt.name AS 关系链,
    ll.weight AS 强度
FROM life_link ll
JOIN life_link_type lt ON ll.link_type_id = lt.id
JOIN life_object src ON ll.source_object_id = src.id
JOIN life_object tgt ON ll.target_object_id = tgt.id
ORDER BY ll.weight DESC
LIMIT 3;`,
        description: '找出权重最高的三条关系'
      },
      {
        label: '递归追溯：从 A 出发的所有影响路径',
        sql: `WITH RECURSIVE impact_chain AS (
    SELECT
        source_object_id AS start_id,
        target_object_id AS current_id,
        CAST(src.name || ' -> ' || tgt.name AS VARCHAR) AS path,
        1 AS depth
    FROM life_link ll
    JOIN life_object src ON ll.source_object_id = src.id
    JOIN life_object tgt ON ll.target_object_id = tgt.id
    WHERE src.name = '心态'

    UNION ALL

    SELECT
        ic.start_id,
        ll.target_object_id,
        ic.path || ' -> ' || tgt.name,
        ic.depth + 1
    FROM impact_chain ic
    JOIN life_link ll ON ll.source_object_id = ic.current_id
    JOIN life_object tgt ON ll.target_object_id = tgt.id
    WHERE ic.depth < 10
      AND ic.path NOT LIKE '%' || tgt.name || '%'
)
SELECT * FROM impact_chain ORDER BY depth, weight DESC;`,
        description: '递归 CTE 追溯影响链，depth 限制防止无限递归'
      },
      {
        label: '完整影响网络（递归）',
        sql: `WITH RECURSIVE full_network AS (
    SELECT
        source_object_id AS root_id,
        source_object_id AS current_id,
        CAST(src.name AS VARCHAR) AS path,
        0 AS depth
    FROM life_link ll
    JOIN life_object src ON ll.source_object_id = src.id

    UNION ALL

    SELECT
        fn.root_id,
        ll.target_object_id,
        fn.path || ' -> ' || tgt.name,
        fn.depth + 1
    FROM full_network fn
    JOIN life_link ll ON ll.source_object_id = fn.current_id
    JOIN life_object tgt ON ll.target_object_id = tgt.id
    WHERE fn.depth < 10
      AND fn.path NOT LIKE '%' || tgt.name || '%'
)
SELECT path, COUNT(*) AS times FROM full_network GROUP BY path ORDER BY depth;`,
        description: '从任意节点出发探索完整影响网络'
      },
      {
        label: '将关系转化为行动',
        sql: `SELECT
    src.name || ' --(' || lt.name || ')--> ' || tgt.name AS 关系,
    ll.weight,
    CASE
        WHEN ll.weight < 0.5 THEN '建议：重新评估关系价值'
        WHEN ll.weight < 0.7 THEN '建议：定期维护'
        ELSE '关系稳固，继续保持'
    END AS 行动建议
FROM life_link ll
JOIN life_link_type lt ON ll.link_type_id = lt.id
JOIN life_object src ON ll.source_object_id = src.id
JOIN life_object tgt ON ll.target_object_id = tgt.id;`,
        description: '用 SQL 分析哪些关系需要行动介入'
      }
    ]
  },

  // ─────────────────────────────────────────────
  // 第 5 类：DDL-进阶（视图与清理）
  // ─────────────────────────────────────────────
  {
    id: 'ddl-advanced',
    title: 'DDL 进阶操作',
    icon: Layers,
    color: 'text-monokai-green',
    badgeColor: 'bg-monokai-green/20 text-monokai-green',
    description: 'CTE 封装、视图创建、数据清理。固化查询逻辑，方便复用。',
    meceCategory: 'ddl-advanced',
    snippets: [
      {
        label: 'CTE：带权重的完整关系视图',
        sql: `WITH relation_view AS (
    SELECT
        src.name  AS source,
        lt.name   AS relation,
        tgt.name  AS target,
        ll.weight AS weight,
        CASE
            WHEN ll.weight >= 0.9 THEN '核心'
            WHEN ll.weight >= 0.7 THEN '重要'
            ELSE '一般'
        END AS importance
    FROM life_link ll
    JOIN life_link_type lt ON ll.link_type_id  = lt.id
    JOIN life_object  src ON ll.source_object_id = src.id
    JOIN life_object  tgt ON ll.target_object_id = tgt.id
)
SELECT * FROM relation_view ORDER BY weight DESC;`,
        description: '封装关系 JOIN + CASE 分级，后续可直接 SELECT * FROM relation_view'
      },
      {
        label: 'CTE：行动转化分析',
        sql: `WITH action_analysis AS (
    SELECT
        la.name        AS 行动名称,
        la.status      AS 状态,
        CASE
            WHEN la.status = 'pending'    THEN '等待执行'
            WHEN la.status = 'executed'   THEN '已完成'
            ELSE '进行中'
        END AS 状态描述
    FROM life_action la
)
SELECT * FROM action_analysis;`,
        description: '将 CASE WHEN 逻辑封装在 CTE 中'
      },
      {
        label: '创建视图：关系网络',
        sql: `CREATE OR REPLACE VIEW v_relation_network AS
SELECT
    src.name  AS source_object,
    lt.name   AS relation_type,
    tgt.name  AS target_object,
    ll.weight AS relation_weight
FROM life_link ll
JOIN life_link_type lt ON ll.link_type_id  = lt.id
JOIN life_object  src ON ll.source_object_id = src.id
JOIN life_object  tgt ON ll.target_object_id = tgt.id;`,
        description: '视图将三表 JOIN 固化，之后直接 SELECT * FROM v_relation_network',
        refreshTables: true
      },
      {
        label: '使用视图查询',
        sql: `SELECT * FROM v_relation_network
WHERE relation_weight > 0.7
ORDER BY relation_weight DESC;`,
        description: '基于视图做二次过滤'
      },
      {
        label: '删除视图',
        sql: `DROP VIEW IF EXISTS v_relation_network;`,
        description: '清理创建的视图',
        refreshTables: true
      },
      {
        label: '删除所有表（反向依赖顺序）',
        sql: `-- 重要：先删子表，再删父表（外键约束顺序）
DROP TABLE IF EXISTS life_action;
DROP TABLE IF EXISTS life_link;
DROP TABLE IF EXISTS life_object;
DROP TABLE IF EXISTS life_link_type;
DROP TABLE IF EXISTS life_object_type;`,
        description: '清理全部五张表（反向：子→父）',
        refreshTables: true
      },
      {
        label: '清空数据（保留表结构）',
        sql: `-- 保留表结构，只清数据
TRUNCATE TABLE life_action;
TRUNCATE TABLE life_link;
TRUNCATE TABLE life_object;
TRUNCATE TABLE life_link_type;`,
        description: 'TRUNCATE 比 DELETE 快很多，适合重新初始化数据'
      }
    ]
  }

];

// ============================================================
// 子组件：背景说明面板
// ============================================================

const CategoryHelpPanel: React.FC<{
  help: CategoryHelpData;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ help, isExpanded, onToggle }) => (
  <div className="rounded-lg border border-monokai-accent/60 bg-monokai-sidebar/70 overflow-hidden">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-3.5 py-2.5 text-left hover:bg-monokai-accent/20 transition-colors"
    >
      <div className="flex items-center gap-2">
        <Lightbulb className="w-4 h-4 text-monokai-yellow" />
        <span className="text-xs font-semibold text-monokai-fg">{help.title}</span>
        <span className="text-[11px] text-monokai-comment">使用帮助</span>
      </div>
      <div className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
        <ChevronDown className="w-4 h-4 text-monokai-comment" />
      </div>
    </button>

    {isExpanded && (
      <div className="px-3.5 pb-3 space-y-3">
        <p className="text-xs text-monokai-comment">{help.description}</p>

        {/* 三列布局：适用场景 + 常见错误 + AI 提示 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-monokai-green/90">
              <Target className="w-3 h-3" /><span>适用场景</span>
            </div>
            <ul className="space-y-1">
              {help.scenarios.map((s, idx) => (
                <li key={idx} className="text-[11px] text-monokai-comment leading-relaxed flex items-start gap-1">
                  <span className="text-monokai-green/70 mt-0.5">•</span><span>{s}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-monokai-pink/90">
              <AlertTriangle className="w-3 h-3" /><span>常见错误</span>
            </div>
            <ul className="space-y-1">
              {help.commonErrors.slice(0, 4).map((s, idx) => (
                <li key={idx} className="text-[11px] text-monokai-comment leading-relaxed flex items-start gap-1">
                  <span className="text-monokai-pink/70 mt-0.5">•</span><span>{s}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-monokai-purple/90">
              <Sparkles className="w-3 h-3" /><span>AI 协作提示</span>
            </div>
            <ul className="space-y-1">
              {help.aiHints.slice(0, 3).map((s, idx) => (
                <li key={idx} className="text-[11px] text-monokai-comment leading-relaxed flex items-start gap-1">
                  <span className="text-monokai-purple/70 mt-0.5">•</span><span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 快速开始 + 最佳实践 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-monokai-accent/40">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-monokai-cyan/90">
              <Clock className="w-3 h-3" /><span>快速开始</span>
            </div>
            <ul className="space-y-1">
              {help.quickStart.map((s, idx) => (
                <li key={idx} className="text-[11px] text-monokai-comment leading-relaxed">{s}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-monokai-orange/90">
              <Star className="w-3 h-3" /><span>最佳实践</span>
            </div>
            <ul className="space-y-1">
              {help.bestPractices.map((s, idx) => (
                <li key={idx} className="text-[11px] text-monokai-comment leading-relaxed flex items-start gap-1">
                  <span className="text-monokai-orange/70 mt-0.5">✓</span><span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    )}
  </div>
);

// ============================================================
// 子组件：AI 填充面板
// ============================================================

const AIFillPanel: React.FC<{
  categoryId: string;
  onFill: (sql: string, description: string) => void;
  isLoading: boolean;
}> = ({ categoryId, onFill, isLoading }) => {
  const templates = AI_FILL_TEMPLATES[categoryId];
  if (!templates || templates.length === 0) return null;

  return (
    <div className="mb-3 p-2 bg-monokai-purple/5 border border-monokai-purple/20 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-3.5 h-3.5 text-monokai-purple" />
        <span className="text-[11px] font-medium text-monokai-purple">AI 一键填充</span>
        <span className="text-[10px] text-monokai-comment">快速生成示例内容</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {templates.map((t, idx) => (
          <button
            key={idx}
            onClick={() => onFill(t.sql, t.description)}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded bg-monokai-purple/10 text-monokai-purple hover:bg-monokai-purple/20 transition-colors disabled:opacity-50 disabled:cursor-wait"
            title={t.description}
          >
            {isLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            <span>{t.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

// ============================================================
// 主组件
// ============================================================

export const OntologyPanel: React.FC<OntologyPanelProps> = ({
  onCopy,
  onInsert,
  copiedId,
  onTablesReady
}) => {
  // 分类展开状态
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(ONTOLOGY_DATA.map(c => c.id))
  );
  // 片段展开状态
  const [expandedSnippets, setExpandedSnippets] = useState<Set<string>>(new Set());
  // 全部展开/折叠
  const [allExpanded, setAllExpanded] = useState(true);
  // 帮助面板展开状态
  const [expandedHelpCategories, setExpandedHelpCategories] = useState<Set<string>>(new Set());
  // AI 填充状态
  const [aiFillingStates, setAIFillingStates] = useState<Record<string, boolean>>({});
  // 执行结果
  const [executionResults, setExecutionResults] = useState<Record<string, ExecutionResult>>({});
  // 填充后的 SQL（用于预览）
  const [filledSql, setFilledSql] = useState<{ [key: string]: string }>({});
  // 错误消息（用于提示）
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 执行 SQL
  const handleExecute = useCallback(async (id: string, sql: string, refreshTables?: boolean) => {
    setExecutionResults(prev => ({ ...prev, [id]: { data: null, error: null, loading: true } }));
    setErrorMessage(null);
    const startTime = performance.now();
    try {
      const res = await duckDBService.query(sql);
      const endTime = performance.now();
      setExecutionResults(prev => ({
        ...prev,
        [id]: { data: res, error: null, loading: false, executionTime: endTime - startTime }
      }));
      if (refreshTables) onTablesReady?.();
    } catch (e: any) {
      setExecutionResults(prev => ({
        ...prev,
        [id]: { data: null, error: e.message, loading: false }
      }));
      setErrorMessage(e.message);
    }
  }, [onTablesReady]);

  // 切换分类展开
  const toggleCategory = useCallback((id: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // 切换片段展开
  const toggleSnippet = useCallback((id: string) => {
    setExpandedSnippets(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // 切换全部展开/折叠
  const toggleAll = useCallback(() => {
    if (allExpanded) {
      setExpandedCategories(new Set());
      setExpandedSnippets(new Set());
    } else {
      setExpandedCategories(new Set(ONTOLOGY_DATA.map(c => c.id)));
    }
    setAllExpanded(!allExpanded);
  }, [allExpanded]);

  // 切换帮助面板
  const toggleHelp = useCallback((categoryId: string) => {
    setExpandedHelpCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }, []);

  // AI 填充处理
  const handleAIFill = useCallback(async (categoryId: string, sql: string, description: string) => {
    const key = `ai-fill-${categoryId}`;
    setAIFillingStates(prev => ({ ...prev, [key]: true }));

    // 模拟 AI 处理延迟
    await new Promise(resolve => setTimeout(resolve, 300));

    // 将填充的 SQL 设置到第一个 DDL 语句
    setFilledSql(prev => ({ ...prev, [categoryId]: sql }));
    setAIFillingStates(prev => ({ ...prev, [key]: false }));

    // 自动展开该分类
    setExpandedCategories(prev => {
      const next = new Set(prev);
      next.add(categoryId);
      return next;
    });
  }, []);

  // 快速清除 - 清除所有状态
  const handleClearAll = useCallback(() => {
    setExpandedCategories(new Set());
    setExpandedSnippets(new Set());
    setExpandedHelpCategories(new Set());
    setFilledSql({});
    setErrorMessage(null);
    setAllExpanded(false);
  }, []);

  // 获取当前分类的帮助数据
  const getHelp = useCallback((categoryId: string): CategoryHelpData | undefined => {
    return CATEGORY_HELP[categoryId];
  }, []);

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* 顶部：统计 + 全局控制 */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-monokai-purple" />
          <span className="text-xs text-monokai-fg font-medium">本体论知识工作台</span>
          <span className="text-xs text-monokai-comment">
            {ONTOLOGY_DATA.length} 个分类 · {ONTOLOGY_DATA.reduce((a, c) => a + c.snippets.length, 0)} 个代码块
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleAll}
            className="px-3 py-1.5 text-xs rounded bg-monokai-accent/20 text-monokai-accent hover:bg-monokai-accent/30 transition-colors"
          >
            {allExpanded ? '全部折叠' : '全部展开'}
          </button>
          {/* 快速清除按钮 */}
          <button
            onClick={handleClearAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-monokai-pink/10 border border-monokai-pink/40 text-monokai-pink hover:bg-monokai-pink/20 transition-colors"
            title="一键清空所有输入和状态"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>快速清除</span>
          </button>
          <button
            onClick={() => {
              handleExecute('cleanup-all', 'DROP TABLE IF EXISTS life_action;DROP TABLE IF EXISTS life_link;DROP TABLE IF EXISTS life_object;DROP TABLE IF EXISTS life_link_type;DROP TABLE IF EXISTS life_object_type;DROP VIEW IF EXISTS v_relation_network;', true);
            }}
            className="px-3 py-1.5 text-xs rounded bg-monokai-red/20 text-monokai-red hover:bg-monokai-red/30 transition-colors"
          >
            清空所有表
          </button>
        </div>
      </div>

      {/* 错误消息提示 */}
      {errorMessage && (
        <div className="mb-4 p-2 bg-monokai-red/10 border border-monokai-red/30 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-monokai-red shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] text-monokai-red font-medium">执行错误</p>
            <p className="text-[11px] text-monokai-comment mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* 场景说明横幅 */}
      <div className="mb-4 p-3 bg-monokai-purple/10 border border-monokai-purple/30 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Network className="w-4 h-4 text-monokai-purple" />
          <span className="text-xs font-bold text-monokai-purple">场景：我的人生</span>
          <span className="text-[10px] text-monokai-comment ml-2">MECE 五分类体系</span>
        </div>
        <p className="text-[11px] text-monokai-comment leading-relaxed">
          本体论的核心三元组：<span className="text-monokai-orange">Object（对象）</span>、
          <span className="text-monokai-blue">Link（关系）</span>、
          <span className="text-monokai-yellow">Action（行动）</span>。
          MECE 五分类：<span className="text-monokai-purple">DDL-结构</span>、
          <span className="text-monokai-yellow">DML-操作</span>、
          <span className="text-monokai-blue">DQL-查询</span>、
          <span className="text-monokai-cyan">DQL-分析</span>、
          <span className="text-monokai-green">DDL-进阶</span>
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-mono">
          <span className="px-2 py-0.5 rounded bg-monokai-bg text-monokai-comment">身体 →(支撑)→ 心态</span>
          <span className="text-monokai-comment">→</span>
          <span className="px-2 py-0.5 rounded bg-monokai-bg text-monokai-comment">心态 →(影响)→ 工作</span>
          <span className="text-monokai-comment">→</span>
          <span className="px-2 py-0.5 rounded bg-monokai-bg text-monokai-comment">工作 →(养活)→ 家庭</span>
          <span className="text-monokai-comment">←</span>
          <span className="px-2 py-0.5 rounded bg-monokai-bg text-monokai-comment">家庭 →(锚定)→ 心态</span>
        </div>
      </div>

      {/* 分类卡片列表 */}
      <div className="space-y-3">
        {ONTOLOGY_DATA.map((cat) => {
          const Icon = cat.icon;
          const isExpanded = expandedCategories.has(cat.id);
          const help = getHelp(cat.meceCategory);
          const isHelpExpanded = expandedHelpCategories.has(cat.meceCategory);
          const isFilling = aiFillingStates[`ai-fill-${cat.meceCategory}`] || false;
          const currentFilledSql = filledSql[cat.meceCategory];

          return (
            <div key={cat.id} className="bg-monokai-sidebar border border-monokai-accent rounded-lg overflow-hidden">

              {/* 分类头部 */}
              <div
                className="px-4 py-3 bg-monokai-bg border-b border-monokai-accent flex items-center justify-between cursor-pointer hover:bg-monokai-accent/10"
                onClick={() => toggleCategory(cat.id)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${cat.color}`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-monokai-fg">{cat.title}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded ${cat.badgeColor}`}>
                        {cat.snippets.length} 个代码块
                      </span>
                    </div>
                    <p className="text-[10px] text-monokai-comment mt-0.5 hidden md:block">
                      {cat.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* AI 填充按钮 */}
                  {isExpanded && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (currentFilledSql) {
                          // 如果已经有填充内容，使用已填充的 SQL
                          handleAIFill(cat.meceCategory, currentFilledSql, '已填充');
                        } else {
                          // 否则使用第一个模板
                          const templates = AI_FILL_TEMPLATES[cat.meceCategory];
                          if (templates && templates.length > 0) {
                            handleAIFill(cat.meceCategory, templates[0].sql, templates[0].description);
                          }
                        }
                      }}
                      disabled={isFilling}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] rounded bg-monokai-purple/10 text-monokai-purple hover:bg-monokai-purple/20 transition-colors disabled:opacity-50"
                      title="AI 一键填充"
                    >
                      {isFilling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      <span>AI 填充</span>
                    </button>
                  )}
                  {isExpanded
                    ? <ChevronUp className="w-4 h-4 text-monokai-comment" />
                    : <ChevronDown className="w-4 h-4 text-monokai-comment" />
                  }
                </div>
              </div>

              {/* 展开内容 */}
              {isExpanded && (
                <div className="p-3">
                  {/* 背景说明面板 */}
                  {help && (
                    <CategoryHelpPanel
                      help={help}
                      isExpanded={isHelpExpanded}
                      onToggle={() => toggleHelp(cat.meceCategory)}
                    />
                  )}

                  {/* AI 填充面板 */}
                  <AIFillPanel
                    categoryId={cat.meceCategory}
                    onFill={(sql, desc) => handleAIFill(cat.meceCategory, sql, desc)}
                    isLoading={isFilling}
                  />

                  {/* 快速清除按钮 */}
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[10px] text-monokai-comment">
                      点击代码块标题展开操作
                    </span>
                    <button
                      onClick={() => {
                        setExpandedSnippets(prev => {
                          const next = new Set(prev);
                          Object.keys(prev).forEach(key => {
                            if (key.startsWith(cat.id)) next.delete(key);
                          });
                          return next;
                        });
                        setFilledSql(prev => {
                          const next = { ...prev };
                          delete next[cat.meceCategory];
                          return next;
                        });
                      }}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] rounded bg-monokai-pink/10 text-monokai-pink hover:bg-monokai-pink/20 transition-colors"
                      title="快速清除"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>清除</span>
                    </button>
                  </div>

                  {/* 代码块列表 */}
                  <div className="space-y-2">
                    {cat.snippets.map((snippet, idx) => {
                      const snippetId = `${cat.id}-${idx}`;
                      const result = executionResults[snippetId];
                      const isSnippetExpanded = expandedSnippets.has(snippetId);
                      // 如果有填充内容，使用填充内容替换默认 SQL
                      const displaySql = currentFilledSql && idx === 0 ? currentFilledSql : snippet.sql;

                      return (
                        <div key={idx} className="bg-monokai-bg rounded border border-monokai-accent/50 overflow-hidden">

                          {/* 片段标题栏 */}
                          <div
                            className="px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-monokai-accent/5"
                            onClick={() => toggleSnippet(snippetId)}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {result?.error ? (
                                <span className="text-monokai-red text-[10px]">✕</span>
                              ) : result?.data !== null && result?.data !== undefined ? (
                                <span className="text-monokai-green text-[10px]">✓</span>
                              ) : null}
                              <span className="text-xs font-medium text-monokai-fg">{snippet.label}</span>
                              {snippet.description && (
                                <span className="text-[10px] text-monokai-comment hidden sm:inline">
                                  — {snippet.description}
                                </span>
                              )}
                              {/* 标记是否为 AI 填充 */}
                              {currentFilledSql && idx === 0 && (
                                <span className="text-[9px] px-1 py-0.5 rounded bg-monokai-purple/20 text-monokai-purple">
                                  AI 填充
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {isSnippetExpanded
                                ? <ChevronUp className="w-3 h-3 text-monokai-comment" />
                                : <ChevronDown className="w-3 h-3 text-monokai-comment" />
                              }
                            </div>
                          </div>

                          {/* 展开内容 */}
                          {isSnippetExpanded && (
                            <>
                              {/* 操作按钮栏 */}
                              <div className="px-3 py-1.5 bg-monokai-accent/5 border-t border-monokai-accent/30 flex items-center gap-1">
                                {/* 执行 */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleExecute(snippetId, displaySql, snippet.refreshTables);
                                  }}
                                  disabled={result?.loading}
                                  className={`p-1.5 rounded transition-colors ${
                                    result?.loading
                                      ? 'bg-monokai-yellow/20 text-monokai-yellow cursor-wait'
                                      : result?.error
                                      ? 'hover:bg-monokai-pink/30 text-monokai-pink'
                                      : result?.data !== null && result?.data !== undefined
                                      ? 'hover:bg-monokai-green/30 text-monokai-green'
                                      : 'hover:bg-monokai-green/30 text-monokai-comment hover:text-monokai-green'
                                  }`}
                                  title={result?.loading ? '执行中...' : '执行 SQL'}
                                >
                                  {result?.loading
                                    ? <span className="w-3.5 h-3.5 border-2 border-monokai-yellow border-t-transparent rounded-full animate-spin" />
                                    : <Play className="w-3.5 h-3.5" />
                                  }
                                </button>
                                {/* 插入 */}
                                {onInsert && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onInsert(displaySql);
                                    }}
                                    className="p-1.5 rounded hover:bg-monokai-blue/30 text-monokai-comment hover:text-monokai-blue transition-colors"
                                    title="插入到 SQL 编辑器"
                                  >
                                    <ArrowRight className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {/* 复制 */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onCopy?.(snippetId, displaySql);
                                  }}
                                  className="p-1.5 rounded hover:bg-monokai-accent/30 text-monokai-comment hover:text-monokai-fg transition-colors"
                                  title="复制 SQL"
                                >
                                  {copiedId === snippetId
                                    ? <Check className="w-3.5 h-3.5 text-monokai-green" />
                                    : <Copy className="w-3.5 h-3.5" />
                                  }
                                </button>
                              </div>

                              {/* 代码块 */}
                              <div>
                                <CodeMirror
                                  value={displaySql}
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

                              {/* 执行结果 */}
                              {result && (
                                <ResultTable
                                  data={result.data || []}
                                  error={result.error}
                                  loading={result.loading}
                                  executionTime={result.executionTime}
                                />
                              )}
                            </>
                          )}
                        </div>
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

export default OntologyPanel;
