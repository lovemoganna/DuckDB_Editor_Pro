/**
 * useOntologyPanel - Ontology 模块共享状态管理 + 三阶功能 Hook
 * 
 * 基于 MECE 原则设计，为"我的人生"场景提供：
 * - AI 一键填充：智能生成/填充 SQL 片段
 * - 快速清除：一键重置输入和状态
 * - 背景说明：使用场景、常见错误、AI 协作提示
 */

import { useState, useCallback, useMemo } from 'react';

// ============================================================
// Types - MECE 背景说明数据
// ============================================================

export interface ExampleFlow {
  name: string;
  description: string;
}

export interface CategoryHelpData {
  title: string;                // 分类标题
  description: string;          // 简要描述
  scenarios: string[];          // 4-5 个适用场景
  commonErrors: string[];       // 4-5 个常见错误
  aiHints: string[];            // 4-5 个 AI 协作提示
  quickStart: string[];         // 4-5 步快速开始
  bestPractices: string[];      // 3-4 个最佳实践
  exampleFlows: ExampleFlow[];   // 2-3 个示例流程
}

// ============================================================
// MECE 背景说明配置 - 按五大分类组织
// ============================================================

export const CATEGORY_HELP: Record<string, CategoryHelpData> = {
  'ddl-structure': {
    title: 'DDL 结构定义',
    description: '创建"我的人生"五张核心表：对象类型、对象实例、关系类型、关系实例、行动表。表结构是整个本体论的基础。',
    scenarios: [
      '从零开始构建本体论知识图谱',
      '需要重新初始化五张核心表',
      '想要扩展新的对象类型或关系类型',
      '学习 DuckDB 建表语法和外键约束'
    ],
    commonErrors: [
      '先创建实例表再创建类型表，导致外键引用失败',
      '忘记为 JSON 列设置 DEFAULT，避免插入报错',
      'PRIMARY KEY 和 REFERENCES 混用导致约束冲突',
      '删除表时未按反向依赖顺序（子表先删）'
    ],
    aiHints: [
      '描述"我的人生"场景中某个具体对象，AI 会自动建议合适的 properties JSON 结构',
      '想让 AI 生成带注释的建表语句，可以指定"详细注释"或"简洁模式"',
      '扩展类型时，建议使用合理的 ID 序列，避免与预设类型 ID 冲突',
      'DuckDB 的 JSON 类型支持直接索引，如 properties["goal"]::VARCHAR'
    ],
    quickStart: [
      '1. 执行「创建对象类型表」和「创建关系类型表」（可并行）',
      '2. 执行「创建对象实例表」和「创建关系实例表」（依赖类型表）',
      '3. 执行「创建行动表」（无依赖）',
      '4. 插入预设数据（按类型顺序插入）',
      '5. 使用「查看」类 SQL 验证数据是否正确'
    ],
    bestPractices: [
      '类型表是金字塔尖，应最先创建',
      '实例表通过外键引用类型表，保证数据一致性',
      'JSON 列用于存储灵活属性，避免频繁 ALTER TABLE',
      '合理设置 DEFAULT 值，减少 INSERT 时的重复劳动'
    ],
    exampleFlows: [
      { name: '完整初始化', description: '类型表 → 实例表 → 关系表 → 行动表 → 插入数据' },
      { name: '增量扩展', description: 'ALTER TABLE 添加新列 → INSERT 新类型 → 插入新实例' },
      { name: '结构审查', description: 'DESCRIBE 表结构 → 验证外键 → 检查 JSON 属性' }
    ]
  },

  'dml-operation': {
    title: 'DML 数据操作',
    description: '对五张表进行增删改操作，包括插入对象/关系/行动、更新权重、删除清理。这是管理本体论的日常操作。',
    scenarios: [
      '新增一个人生对象（如"读书"）或关系（如"读书→滋养→心态"）',
      '反思后调整关系权重（如将"工作→影响→心态"从 0.9 调整为 0.6）',
      '标记行动已完成或删除过期行动',
      '批量更新多个对象的状态'
    ],
    commonErrors: [
      'INSERT 时未指定所有非空列，导致报错',
      'UPDATE WHERE 条件写错，误更新了不想改的行',
      'DELETE 前忘记 WHERE，导致清空整表',
      '在有外键约束的表上插入不存在的类型 ID'
    ],
    aiHints: [
      '输入"心态很好"等描述，AI 会自动生成带 state=稳定 的 properties JSON',
      '想批量插入类似数据，可以描述"插入 5 个对象，分别是..."让 AI 生成多行 INSERT',
      '调整权重时，可以描述"最近心态受了工作很大影响"，AI 会建议适当的权重值',
      'DuckDB 支持 UPDATE FROM 语法，可以基于 JOIN 结果更新数据'
    ],
    quickStart: [
      '1. 选择对应的插入/更新/删除操作',
      '2. 使用「AI 填充」生成示例数据',
      '3. 根据实际情况调整 values',
      '4. 执行 SQL 并验证结果',
      '5. 查询确认数据已正确变更'
    ],
    bestPractices: [
      'INSERT 前先确认类型 ID，避免外键约束失败',
      'UPDATE 前先用 SELECT 预览将要修改的行',
      '重要操作前先备份数据或使用事务',
      '定期"反思"权重设置，保持本体论与现实同步'
    ],
    exampleFlows: [
      { name: '新增对象', description: '确定类型 → 生成 INSERT → 调整 properties → 执行' },
      { name: '调整权重', description: '查询当前权重 → 反思评估 → UPDATE → 验证变更' },
      { name: '标记完成', description: 'SELECT 待执行行动 → UPDATE status → 查询确认' }
    ]
  },

  'dql-query': {
    title: 'DQL 数据查询',
    description: '从五张表中检索数据，包括基本查询、JOIN 多表、JSON 属性提取。这是理解本体论数据的核心技能。',
    scenarios: [
      '查看所有对象及其类型名称（JOIN）',
      '查询某个 JSON 属性满足条件的所有对象',
      '筛选特定关系类型（如所有"影响"关系）的实例',
      '按权重排序查看最重要的关系'
    ],
    commonErrors: [
      'JOIN 条件写错（ON 而非 WHERE），导致笛卡尔积',
      'JSON 属性查询时未做类型转换（::VARCHAR），导致比较失败',
      'LEFT JOIN 和 INNER JOIN 混淆，导致漏掉某些行',
      'JSON 键名拼写错误或大小写不匹配'
    ],
    aiHints: [
      '描述"查看所有心态相关的对象"，AI 会生成带 JOIN 和 WHERE 的查询',
      '查询 JSON 属性时，可以指定"状态为焦虑"让 AI 自动处理类型转换',
      '复杂 JOIN 可以分步构建：先 JOIN 两表验证，再逐步增加',
      'DuckDB 的 JSON_EXTRACT 语法和 standard JSON 不同，注意使用 ->> 或 ::'
    ],
    quickStart: [
      '1. 确定要查询的信息（对象？关系？行动？）',
      '2. 确认需要的表和关联关系',
      '3. 编写 SELECT 列表和 JOIN 条件',
      '4. 添加 WHERE 筛选条件',
      '5. ORDER BY 排序，执行查看结果'
    ],
    bestPractices: [
      '优先使用 INNER JOIN 查询有完整关系的数据',
      '需要包含"空"类型时使用 LEFT JOIN',
      'JSON 查询记得类型转换：::VARCHAR',
      '为列设置 AS 别名，让结果更易读'
    ],
    exampleFlows: [
      { name: '对象查询', description: '基本 SELECT → JOIN 类型表 → WHERE 筛选 → ORDER BY' },
      { name: 'JSON 查询', description: '提取属性 → 类型转换 → WHERE 比较 → AS 别名展示' },
      { name: '关系查询', description: '三表 JOIN → 筛选关系类型 → 按权重排序' }
    ]
  },

  'dql-analysis': {
    title: 'DQL 数据分析',
    description: '使用聚合、递归 CTE、UNION ALL 等高级查询技术，对本体论进行统计分析和路径追溯。',
    scenarios: [
      '统计各类型的对象数量、各关系的平均权重',
      '找出影响链最长的路径（递归 CTE）',
      '用 UNION ALL 快速总览本体论整体状态',
      '对关系进行分级（核心/重要/一般）'
    ],
    commonErrors: [
      '递归 CTE 缺少基础情况（UNION ALL 的第一个 SELECT），导致死循环',
      '聚合查询中未 GROUP BY 所有非聚合列，导致报错',
      'UNION 和 UNION ALL 混用，前者会去重（更慢）',
      '递归深度设置不当，数据量大时性能问题'
    ],
    aiHints: [
      '描述"追溯从心态出发的影响链"，AI 会自动生成递归 CTE',
      '输入"哪些关系最重要"，AI 会建议按权重分组统计',
      '递归 CTE 中注意设置 depth 限制，防止无限递归',
      'DuckDB 的 GROUP BY ALL 可以自动包含所有非聚合列，非常方便'
    ],
    quickStart: [
      '1. 选择分析类型（聚合/递归/UNION）',
      '2. 使用「AI 填充」生成查询模板',
      '3. 替换起始对象名称（如"心态"）',
      '4. 调整 depth/limit 等参数',
      '5. 执行并分析结果'
    ],
    bestPractices: [
      '递归 CTE 一定要设置 depth 限制和终止条件',
      'UNION ALL 比 UNION 性能更好（不去重）',
      '聚合前确认 GROUP BY 的粒度是否正确',
      '用 CASE WHEN 实现复杂的分级逻辑'
    ],
    exampleFlows: [
      { name: '递归追溯', description: '基础 SELECT → UNION ALL 递归 → depth 限制 → 路径展示' },
      { name: '聚合统计', description: 'UNION ALL 总览 → GROUP BY 计数 → AVG/SUM 聚合' },
      { name: '路径分析', description: '定义起始点 → 递归扩展 → depth 过滤 → 排序输出' }
    ]
  },

  'ddl-advanced': {
    title: 'DDL 进阶操作',
    description: '使用 CTE、视图、TRUNCATE、DROP 等进阶操作封装和优化查询逻辑。',
    scenarios: [
      '用 CTE 封装复杂的三表 JOIN，方便复用',
      '创建视图固化频繁使用的查询',
      '重新初始化数据（TRUNCATE）',
      '彻底清理所有表（DROP）'
    ],
    commonErrors: [
      'CTE 名称与已有表名冲突，导致"表已存在"错误',
      'DROP 表时未按反向依赖顺序，导致外键约束报错',
      'TRUNCATE 忘记 WHERE，导致清空不该清的数据',
      'CREATE VIEW 时 SELECT 列名与视图列名不匹配'
    ],
    aiHints: [
      '描述"封装关系查询为可复用视图"，AI 会生成完整的 CREATE VIEW 语句',
      '需要清理数据时，可以指定"保留表结构，只清数据"让 AI 生成 TRUNCATE',
      'DROP 前让 AI 检查依赖顺序，生成正确的删除序列',
      'CTE 可以嵌套使用，构建更复杂的分析逻辑'
    ],
    quickStart: [
      '1. 选择操作类型（CTE/视图/清理）',
      '2. 使用「AI 填充」生成模板',
      '3. 根据需要调整 CTE 逻辑或视图名称',
      '4. 执行创建操作',
      '5. 用 SELECT * FROM 视图 验证'
    ],
    bestPractices: [
      'CTE 名称要有意义，便于后续维护',
      '视图命名遵循 v_ 前缀约定',
      'TRUNCATE 前先备份重要数据',
      'DROP 操作不可逆，执行前务必确认'
    ],
    exampleFlows: [
      { name: '封装视图', description: '手写/AI 生成 SELECT → CREATE VIEW → 验证查询' },
      { name: 'CTE 组合', description: '定义多个 CTE → 相互引用 → 最终 SELECT' },
      { name: '重新初始化', description: 'TRUNCATE 数据 → INSERT 新数据 → 验证' }
    ]
  }
};

// ============================================================
// AI 填充数据 - 按五大分类提供填充模板
// ============================================================

export interface AIFillData {
  description: string;
  sql: string;
  targetSnippet?: string;
}

export const AI_FILL_TEMPLATES: Record<string, AIFillData[]> = {
  'ddl-structure': [
    {
      description: '生成带注释的完整五表结构',
      sql: `-- =============================================
-- "我的人生" 本体论五张核心表
-- =============================================

-- ① 对象类型表（金字塔尖）
CREATE TABLE life_object_type (
    id          INTEGER PRIMARY KEY,
    name        VARCHAR NOT NULL,
    description VARCHAR
);

-- ② 对象实例表（类型具体化）
CREATE TABLE life_object (
    id             INTEGER PRIMARY KEY,
    object_type_id INTEGER REFERENCES life_object_type(id),
    name           VARCHAR NOT NULL,
    properties     JSON    DEFAULT '{}'
);

-- ③ 关系类型表
CREATE TABLE life_link_type (
    id          INTEGER PRIMARY KEY,
    name        VARCHAR NOT NULL,
    description VARCHAR
);

-- ④ 关系实例表（带权重）
CREATE TABLE life_link (
    id               INTEGER PRIMARY KEY,
    link_type_id     INTEGER REFERENCES life_link_type(id),
    source_object_id INTEGER REFERENCES life_object(id),
    target_object_id INTEGER REFERENCES life_object(id),
    weight           DECIMAL(3,2) DEFAULT 1.0
);

-- ⑤ 行动表
CREATE TABLE life_action (
    id          INTEGER PRIMARY KEY,
    name        VARCHAR NOT NULL,
    description VARCHAR,
    status      VARCHAR DEFAULT 'pending',
    execute_at  DATE
);`,
      targetSnippet: '创建对象类型表'
    },
    {
      description: '插入五张表的完整预设数据',
      sql: `-- 插入对象类型
INSERT INTO life_object_type VALUES
    (1, 'Aspect', '生活维度'),
    (2, 'Person', '人物'),
    (3, 'Goal',   '目标');

-- 插入对象实例
INSERT INTO life_object VALUES
    (1, 1, '心态', '{"state": "焦虑", "goal": "内心平静"}'),
    (2, 1, '工作', '{"role": "工程师", "struggle": "沟通与办公室政治"}'),
    (3, 1, '家庭', '{"priority": "最高"}'),
    (4, 1, '身体', '{"state": "还行", "goal": "健康"}');

-- 插入关系类型
INSERT INTO life_link_type VALUES
    (1, '影响', 'A 作用于 B，强度可量化'),
    (2, '养活', 'A 为 B 提供物质基础'),
    (3, '锚定', 'A 为 B 提供精神支撑'),
    (4, '支撑', 'A 为 B 提供基础条件');

-- 插入关系实例（核心关系网络）
INSERT INTO life_link VALUES
    (1, 1, 1, 2, 0.9),  -- 心态 → 影响 → 工作 (0.9)
    (2, 2, 2, 3, 1.0),  -- 工作 → 养活 → 家庭 (1.0)
    (3, 3, 3, 1, 0.8),  -- 家庭 → 锚定 → 心态 (0.8)
    (4, 4, 4, 1, 0.7);  -- 身体 → 支撑 → 心态 (0.7)

-- 插入预设行动
INSERT INTO life_action VALUES
    (1, '深呼吸', '就这一刻。其他的都不重要。', 'pending', NULL),
    (2, '迈出下一步', '低头看路。路已经在脚下了。', 'pending', NULL);`,
      targetSnippet: '插入类型数据'
    }
  ],

  'dml-operation': [
    {
      description: '新增一个"读书"对象（心态维度）',
      sql: `-- 新增对象：读书
INSERT INTO life_object VALUES
    (5, 1, '读书', '{"type": "习惯", "frequency": "每天", "state": "进行中", "goal": "拓宽认知边界"}');

-- 为读书创建关系：读书 → 滋养 → 心态
INSERT INTO life_link VALUES
    (5, 1, 5, 1, 0.6);  -- 读书 → 影响 → 心态 (0.6)`,
      targetSnippet: '插入对象实例'
    },
    {
      description: '调整关系权重（反思后）',
      sql: `-- 反思后调整：工作对心态的影响减弱了
UPDATE life_link
SET weight = 0.6
WHERE source_object_id = (SELECT id FROM life_object WHERE name = '工作')
  AND target_object_id = (SELECT id FROM life_object WHERE name = '心态');

-- 查询验证
SELECT 
    src.name AS 发起方,
    tgt.name AS 被影响方,
    ll.weight AS 新强度
FROM life_link ll
JOIN life_object src ON ll.source_object_id = src.id
JOIN life_object tgt ON ll.target_object_id = tgt.id
WHERE src.name = '工作';`,
      targetSnippet: '更新关系权重（反思后调整）'
    }
  ],

  'dql-query': [
    {
      description: '完整关系视图（带权重分级）',
      sql: `-- 完整关系视图（带名称 + 权重分级）
SELECT
    src.name         AS 来源对象,
    lt.name          AS 关系类型,
    tgt.name         AS 目标对象,
    ll.weight        AS 强度,
    CASE
        WHEN ll.weight >= 0.9 THEN '★★★ 核心'
        WHEN ll.weight >= 0.7 THEN '★★ 重要'
        ELSE '★ 一般'
    END AS 重要程度
FROM life_link ll
JOIN life_link_type lt ON ll.link_type_id  = lt.id
JOIN life_object  src ON ll.source_object_id = src.id
JOIN life_object  tgt ON ll.target_object_id = tgt.id
ORDER BY ll.weight DESC;`,
      targetSnippet: '完整关系视图（带名称）'
    },
    {
      description: 'JSON 属性查询：有目标的对象',
      sql: `-- 查询所有设定了目标的对象
SELECT 
    name,
    properties['goal']::VARCHAR AS 目标,
    properties['state']::VARCHAR AS 当前状态
FROM life_object
WHERE properties['goal'] IS NOT NULL;`,
      targetSnippet: 'JSON 属性查询：查询有目标的对象'
    }
  ],

  'dql-analysis': [
    {
      description: '递归追溯：从"心态"出发的所有影响路径',
      sql: `WITH RECURSIVE impact_chain AS (
    -- 基础情况：从指定对象出发的直接关系
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

    -- 递归情况：沿着关系链继续追溯
    SELECT
        ic.start_id,
        ll.target_object_id,
        ic.path || ' -> ' || tgt.name,
        ic.depth + 1
    FROM impact_chain ic
    JOIN life_link ll ON ll.source_object_id = ic.current_id
    JOIN life_object tgt ON ll.target_object_id = tgt.id
    WHERE ic.depth < 10  -- 限制递归深度
      AND ic.path NOT LIKE '%' || tgt.name || '%'  -- 避免循环
)
SELECT 
    depth AS 深度,
    path  AS 影响路径
FROM impact_chain
ORDER BY depth, weight DESC;`,
      targetSnippet: '递归追溯：从 A 出发的所有影响路径'
    },
    {
      description: '本体论整体状态统计',
      sql: `-- 本体论整体状态：各表数据量一览
SELECT '对象类型' AS 指标, COUNT(*) AS 数值 FROM life_object_type
UNION ALL
SELECT '对象实例',         COUNT(*)        FROM life_object
UNION ALL
SELECT '关系类型',         COUNT(*)        FROM life_link_type
UNION ALL
SELECT '关系实例',         COUNT(*)        FROM life_link
UNION ALL
SELECT '待执行行动',       COUNT(*)        FROM life_action WHERE status = 'pending'
UNION ALL
SELECT '已执行行动',       COUNT(*)        FROM life_action WHERE status = 'executed';`,
      targetSnippet: '本体论总览'
    }
  ],

  'ddl-advanced': [
    {
      description: '创建关系网络视图（可复用）',
      sql: `-- 创建关系网络视图：固化三表 JOIN
CREATE OR REPLACE VIEW v_relation_network AS
SELECT
    src.name  AS source_object,
    lt.name   AS relation_type,
    tgt.name  AS target_object,
    ll.weight AS relation_weight,
    CASE
        WHEN ll.weight >= 0.9 THEN '核心'
        WHEN ll.weight >= 0.7 THEN '重要'
        ELSE '一般'
    END AS importance
FROM life_link ll
JOIN life_link_type lt ON ll.link_type_id  = lt.id
JOIN life_object  src ON ll.source_object_id = src.id
JOIN life_object  tgt ON ll.target_object_id = tgt.id;

-- 使用视图查询：只看重要关系
SELECT * FROM v_relation_network
WHERE relation_weight > 0.7
ORDER BY relation_weight DESC;`,
      targetSnippet: '创建视图：关系网络'
    },
    {
      description: '完整清理（按反向依赖顺序）',
      sql: `-- 重要：按反向依赖顺序删除所有表
-- 先删子表，再删父表

-- 1. 删除行动表（无依赖）
DROP TABLE IF EXISTS life_action;

-- 2. 删除关系实例表（依赖对象表和关系类型表）
DROP TABLE IF EXISTS life_link;

-- 3. 删除对象实例表（依赖对象类型表）
DROP TABLE IF EXISTS life_object;

-- 4. 删除关系类型表
DROP TABLE IF EXISTS life_link_type;

-- 5. 删除对象类型表（最后删除）
DROP TABLE IF EXISTS life_object_type;

-- 6. 删除视图
DROP VIEW IF EXISTS v_relation_network;

-- 验证清理结果
SHOW TABLES;`,
      targetSnippet: '删除所有表（反向依赖顺序）'
    }
  ]
};

// ============================================================
// Hook 实现
// ============================================================

export interface UseOntologyPanelReturn {
  // MECE 分类状态
  expandedCategories: Set<string>;
  toggleCategory: (id: string) => void;
  toggleAll: () => void;
  allExpanded: boolean;
  
  // 展开状态
  expandedSnippets: Set<string>;
  toggleSnippet: (id: string) => void;
  
  // AI 一键填充
  aiFillingStates: Record<string, boolean>;
  handleAIFill: (categoryId: string, targetSnippet?: string) => Promise<void>;
  
  // 快速清除
  handleClearSnippet: (snippetId: string) => void;
  handleClearCategory: (categoryId: string) => void;
  handleClearAll: () => void;
  
  // 背景说明
  getCategoryHelp: (categoryId: string) => CategoryHelpData | undefined;
  showHelpStates: Record<string, boolean>;
  toggleCategoryHelp: (categoryId: string) => void;
  
  // 展开的分类帮助
  expandedHelpCategories: Set<string>;
  toggleExpandedHelp: (categoryId: string) => void;
}

export function useOntologyPanel(): UseOntologyPanelReturn {
  // 分类展开状态
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set([
    'ddl-structure', 'dml-operation', 'dql-query', 'dql-analysis', 'ddl-advanced'
  ]));
  const [allExpanded, setAllExpanded] = useState(true);
  
  // 片段展开状态
  const [expandedSnippets, setExpandedSnippets] = useState<Set<string>>(new Set());
  
  // 分类帮助展开状态
  const [expandedHelpCategories, setExpandedHelpCategories] = useState<Set<string>>(new Set());
  
  // AI 填充状态
  const [aiFillingStates, setAIFillingStates] = useState<Record<string, boolean>>({});

  // 分类切换
  const toggleCategory = useCallback((id: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // 全选/全不选
  const toggleAll = useCallback(() => {
    const allCategoryIds = ['ddl-structure', 'dml-operation', 'dql-query', 'dql-analysis', 'ddl-advanced'];
    if (allExpanded) {
      setExpandedCategories(new Set());
      setExpandedSnippets(new Set());
    } else {
      setExpandedCategories(new Set(allCategoryIds));
    }
    setAllExpanded(!allExpanded);
  }, [allExpanded]);

  // 片段切换
  const toggleSnippet = useCallback((id: string) => {
    setExpandedSnippets(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // 分类帮助切换
  const toggleExpandedHelp = useCallback((categoryId: string) => {
    setExpandedHelpCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  // 分类帮助状态（每个分类是否显示帮助）
  const showHelpStates = useMemo(() => ({
    'ddl-structure': true,
    'dml-operation': true,
    'dql-query': true,
    'dql-analysis': true,
    'ddl-advanced': true
  }), []);

  const toggleCategoryHelp = useCallback((categoryId: string) => {
    // 帮助面板使用 expandedHelpCategories 控制
    toggleExpandedHelp(categoryId);
  }, [toggleExpandedHelp]);

  // AI 一键填充
  const handleAIFill = useCallback(async (categoryId: string, targetSnippet?: string) => {
    const key = `ai-fill-${categoryId}`;
    setAIFillingStates(prev => ({ ...prev, [key]: true }));
    
    // 模拟 AI 处理延迟（实际场景中这里会调用 AI 服务）
    await new Promise(resolve => setTimeout(resolve, 300));
    
    setAIFillingStates(prev => ({ ...prev, [key]: false }));
  }, []);

  // 快速清除 - 清除指定片段的展开状态和执行结果
  const handleClearSnippet = useCallback((snippetId: string) => {
    setExpandedSnippets(prev => {
      const next = new Set(prev);
      next.delete(snippetId);
      return next;
    });
  }, []);

  // 快速清除 - 清除整个分类的片段展开状态
  const handleClearCategory = useCallback((categoryId: string) => {
    setExpandedSnippets(prev => {
      const next = new Set(prev);
      Object.keys(prev).forEach(key => {
        if (key.startsWith(categoryId)) {
          next.delete(key);
        }
      });
      return next;
    });
  }, []);

  // 快速清除 - 全部清除
  const handleClearAll = useCallback(() => {
    setExpandedCategories(new Set());
    setExpandedSnippets(new Set());
    setAllExpanded(false);
  }, []);

  // 获取分类帮助数据
  const getCategoryHelp = useCallback((categoryId: string): CategoryHelpData | undefined => {
    return CATEGORY_HELP[categoryId];
  }, []);

  return {
    expandedCategories,
    toggleCategory,
    toggleAll,
    allExpanded,
    expandedSnippets,
    toggleSnippet,
    aiFillingStates,
    handleAIFill,
    handleClearSnippet,
    handleClearCategory,
    handleClearAll,
    getCategoryHelp,
    showHelpStates,
    toggleCategoryHelp,
    expandedHelpCategories,
    toggleExpandedHelp
  };
}
