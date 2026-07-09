import { ONTOLOGY_INIT_SCRIPT } from '../components/Library/ontologyDataModel';

export interface SqlTemplate {
  id: string;
  label: string;
  description: string;
  sql: string;
  refreshTables?: boolean;
}

export interface TemplateCategory {
  label: string;
  description: string;
  color: string;
  icon: string;
  templates: SqlTemplate[];
}

export const ONTOLOGY_TEMPLATE_CATEGORIES: Record<string, TemplateCategory> = {

  // ── 初始化：创建表结构 + 种子数据 ──
  setup: {
    label: '初始化',
    description: '创建表结构和导入种子数据',
    color: 'purple',
    icon: 'Database',
    templates: [
      {
        id: 'init-full',
        label: '一键完整初始化',
        description: '建表 + 导入种子数据，开启完整体验',
        sql: ONTOLOGY_INIT_SCRIPT,
        refreshTables: true,
      },
      {
        id: 'create-object-type',
        label: '创建对象类型表',
        description: 'id、name、description 三列',
        sql: `CREATE TABLE life_object_type (
    id          INTEGER PRIMARY KEY,
    name        VARCHAR NOT NULL,
    description VARCHAR
);`,
        refreshTables: true,
      },
      {
        id: 'create-object',
        label: '创建对象实例表',
        description: 'object_type_id 指向类型表，properties 用 JSON 存储灵活属性',
        sql: `CREATE TABLE life_object (
    id             INTEGER PRIMARY KEY,
    object_type_id INTEGER REFERENCES life_object_type(id),
    name           VARCHAR NOT NULL,
    properties     JSON    DEFAULT '{}',
    annotations    VARCHAR DEFAULT ''
);`,
        refreshTables: true,
      },
      {
        id: 'create-link-type',
        label: '创建关系类型表',
        description: '和对象类型表结构相同，但语义不同',
        sql: `CREATE TABLE life_link_type (
    id          INTEGER PRIMARY KEY,
    name        VARCHAR NOT NULL,
    description VARCHAR
);`,
        refreshTables: true,
      },
      {
        id: 'create-link',
        label: '创建关系实例表',
        description: '三个外键 + weight 表示关系强度 0.0~1.0',
        sql: `CREATE TABLE life_link (
    id               INTEGER PRIMARY KEY,
    link_type_id     INTEGER REFERENCES life_link_type(id),
    source_object_id INTEGER REFERENCES life_object(id),
    target_object_id INTEGER REFERENCES life_object(id),
    weight           DECIMAL(3,2) DEFAULT 1.0
);`,
        refreshTables: true,
      },
      {
        id: 'create-action',
        label: '创建行动表',
        description: 'status 控制状态机：pending→in_progress→executed',
        sql: `CREATE TABLE life_action (
    id          INTEGER PRIMARY KEY,
    object_id   INTEGER,
    name        VARCHAR NOT NULL,
    description VARCHAR,
    status      VARCHAR DEFAULT 'pending',
    execute_at  DATE
);`,
        refreshTables: true,
      },
    ],
  },

  // ── 查询：基础检索 + 高级分析 ──
  query: {
    label: '查询',
    description: '查看和分析本体数据',
    color: 'cyan',
    icon: 'Eye',
    templates: [
      {
        id: 'ontology-overview',
        label: '本体论状态总览',
        description: '用 UNION ALL 统计各表行数',
        sql: `SELECT '对象类型' AS 指标, COUNT(*) AS 数值 FROM life_object_type
UNION ALL
SELECT '对象实例',         COUNT(*)        FROM life_object
UNION ALL
SELECT '关系类型',         COUNT(*)        FROM life_link_type
UNION ALL
SELECT '关系实例',         COUNT(*)        FROM life_link
UNION ALL
SELECT '待执行行动',       COUNT(*)        FROM life_action WHERE status = 'pending';`,
      },
      {
        id: 'objects-with-type',
        label: '查看所有对象及类型',
        description: 'JOIN 查看对象时带上类型名称',
        sql: `SELECT lo.id, lo.name, lot.name AS type_name, lo.properties
FROM life_object lo
JOIN life_object_type lot ON lo.object_type_id = lot.id;`,
      },
      {
        id: 'full-relation-view',
        label: '完整关系视图（带名称）',
        description: '三表 JOIN，将 id 翻译成名称',
        sql: `SELECT
    src.name  AS 来源对象,
    lt.name   AS 关系类型,
    tgt.name  AS 目标对象,
    ll.weight AS 强度
FROM life_link ll
JOIN life_link_type lt ON ll.link_type_id  = lt.id
JOIN life_object  src ON ll.source_object_id = src.id
JOIN life_object  tgt ON ll.target_object_id = tgt.id
ORDER BY ll.weight DESC;`,
      },
      {
        id: 'weight-levels',
        label: '关系强度分级',
        description: '用 CASE WHEN 对关系强度进行分级',
        sql: `SELECT
    src.name || ' -> ' || tgt.name AS 关系,
    ll.weight,
    CASE
        WHEN ll.weight >= 0.9 THEN '★★★ 核心关联'
        WHEN ll.weight >= 0.7 THEN '★★ 普通关联'
        ELSE '★ 微弱关联'
    END AS 重要程度
FROM life_link ll
JOIN life_object src ON ll.source_object_id = src.id
JOIN life_object tgt ON ll.target_object_id = tgt.id;`,
      },
      {
        id: 'json-abstract-query',
        label: 'JSON 属性查询：获取所有元定义类型',
        description: 'DuckDB 支持直接从 JSON 提取布尔属性进行条件过滤',
        sql: `SELECT name, properties['启用共享']::BOOLEAN AS 启用共享
FROM life_object
WHERE properties['启用共享']::BOOLEAN = true;`,
      },
      {
        id: 'pending-actions',
        label: '查询所有待执行行动',
        description: '查看所有未完成的本体维护任务',
        sql: `SELECT name, description FROM life_action WHERE status = 'pending';`,
      },
      {
        id: 'recursive-subclass',
        label: '递归追溯：核心实体的接口与继承链条',
        description: '使用递归 CTE 追溯从属性到其实现接口及核心实体的调用全链条',
        sql: `WITH RECURSIVE path_chain AS (
    SELECT
        source_object_id AS start_id,
        target_object_id AS current_id,
        CAST(src.name || ' --(' || lt.name || ')--> ' || tgt.name AS VARCHAR) AS path,
        1 AS depth
    FROM life_link ll
    JOIN life_link_type lt ON ll.link_type_id = lt.id
    JOIN life_object src ON ll.source_object_id = src.id
    JOIN life_object tgt ON ll.target_object_id = tgt.id
    WHERE src.name = '属性'

    UNION ALL

    SELECT
        pc.start_id,
        ll.target_object_id,
        pc.path || ' --(' || lt.name || ')--> ' || tgt.name,
        pc.depth + 1
    FROM path_chain pc
    JOIN life_link ll ON ll.source_object_id = pc.current_id
    JOIN life_link_type lt ON ll.link_type_id = lt.id
    JOIN life_object tgt ON ll.target_object_id = tgt.id
    WHERE pc.depth < 10
)
SELECT * FROM path_chain;`,
      },
      {
        id: 'link-stats',
        label: '每种关系的数量和平均强度',
        description: '了解哪种关系类型在元建模中使用最频繁',
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
      },
      {
        id: 'top-links',
        label: '最核心的关系（Top 3）',
        description: '找出语义关联中权重最高的三条关系',
        sql: `SELECT
    src.name || ' --(' || lt.name || ')--> ' || tgt.name AS 关系链,
    ll.weight AS 强度
FROM life_link ll
JOIN life_link_type lt ON ll.link_type_id = lt.id
JOIN life_object src ON ll.source_object_id = src.id
JOIN life_object tgt ON ll.target_object_id = tgt.id
ORDER BY ll.weight DESC
LIMIT 3;`,
      },
    ],
  },

  // ── 修改：调整关系权重、标记行动状态 ──
  modify: {
    label: '修改',
    description: '调整关系权重、标记行动状态',
    color: 'yellow',
    icon: 'Link2',
    templates: [
      {
        id: 'insert-object-type',
        label: '插入对象类型',
        description: '本体建模的两个预设类型',
        sql: `INSERT INTO life_object_type VALUES
    (1, '核心元', '代表本体元模型的主干概念'),
    (2, '控制元', '代表对属性的改变与关联逻辑运算');`,
      },
      {
        id: 'insert-object',
        label: '插入对象实例',
        description: '插入概念类与具体实例对象',
        sql: `INSERT INTO life_object (id, object_type_id, name, properties) VALUES
    (1, 1, '对象类型', '{"数据源表": "主物理表"}'),
    (2, 1, '属性', '{"字段类型": "字符型"}'),
    (3, 2, '行动类型', '{"回写模式": "同步事务回写"}');`,
      },
      {
        id: 'insert-link-type',
        label: '插入关系类型',
        description: '插入四种核心关系',
        sql: `INSERT INTO life_link_type VALUES
    (1, '从属于', '表示基础特征附属于实体的包含关系'),
    (2, '定义关联', '声明两个实体之间的关联关系'),
    (3, '作用于', '指示行动修改或作用的目标'),
    (4, '驱动计算', '表示逻辑重新计算属性');`,
      },
      {
        id: 'insert-link',
        label: '插入关系实例',
        description: '属性与对象类型之间的关联',
        sql: `INSERT INTO life_link VALUES
    (1, 1, 2, 1, 1.0);`,
      },
      {
        id: 'update-weight',
        label: '调整关系权重（校验后）',
        description: '修改属性在对象类型结构上的绑定强度',
        sql: `UPDATE life_link
SET weight = 0.99
WHERE source_object_id = (SELECT id FROM life_object WHERE name = '属性')
  AND target_object_id = (SELECT id FROM life_object WHERE name = '对象类型');`,
      },
      {
        id: 'mark-action-done',
        label: '标记行动已执行',
        description: '完成对本体的属性回写行动后，更新其状态',
        sql: `UPDATE life_action
SET status = 'executed', execute_at = CURRENT_DATE
WHERE name = '属性回写';`,
      },
      {
        id: 'relation-to-action',
        label: '将关系转化为行动建议',
        description: '分析哪些实体关联度较低，建议补充建模',
        sql: `SELECT
    src.name || ' --(' || lt.name || ')--> ' || tgt.name AS 关系,
    ll.weight,
    CASE
        WHEN ll.weight < 0.5 THEN '建议：检查关联语义是否准确'
        WHEN ll.weight < 0.7 THEN '建议：补充属性特征刻画'
        ELSE '关系配置完善'
    END AS 建模建议
FROM life_link ll
JOIN life_link_type lt ON ll.link_type_id = lt.id
JOIN life_object src ON ll.source_object_id = src.id
JOIN life_object tgt ON ll.target_object_id = tgt.id;`,
      },
    ],
  },

  // ── 导出：创建视图、清理数据 ──
  export: {
    label: '导出',
    description: '导出数据或重置',
    color: 'green',
    icon: 'Layers',
    templates: [
      {
        id: 'create-view-network',
        label: '创建视图：本体关系网络',
        description: '视图将三表 JOIN 固化，之后直接 SELECT * FROM v_ontology_network',
        sql: `CREATE OR REPLACE VIEW v_ontology_network AS
SELECT
    src.name  AS source_object,
    lt.name   AS relation_type,
    tgt.name  AS target_object,
    ll.weight AS relation_weight
FROM life_link ll
JOIN life_link_type lt ON ll.link_type_id  = lt.id
JOIN life_object  src ON ll.source_object_id = src.id
JOIN life_object  tgt ON ll.target_object_id = tgt.id;`,
        refreshTables: true,
      },
      {
        id: 'use-view',
        label: '使用视图查询',
        description: '基于视图进行重要关联筛选',
        sql: `SELECT * FROM v_ontology_network
WHERE relation_weight > 0.7
ORDER BY relation_weight DESC;`,
      },
      {
        id: 'cte-weighted-links',
        label: 'CTE：带权重的关系视图',
        description: '封装关系 JOIN 并分级，后续直接 SELECT',
        sql: `WITH relation_view AS (
    SELECT
        src.name  AS source,
        lt.name   AS relation,
        tgt.name  AS target,
        ll.weight AS weight,
        CASE
            WHEN ll.weight >= 0.9 THEN '强相关'
            WHEN ll.weight >= 0.7 THEN '中相关'
            ELSE '弱相关'
        END AS importance
    FROM life_link ll
    JOIN life_link_type lt ON ll.link_type_id  = lt.id
    JOIN life_object  src ON ll.source_object_id = src.id
    JOIN life_object  tgt ON ll.target_object_id = tgt.id
)
SELECT * FROM relation_view ORDER BY weight DESC;`,
      },
      {
        id: 'truncate-all',
        label: '清空数据（保留表结构）',
        description: 'TRUNCATE 比 DELETE 快很多，适合重新导入数据',
        sql: `TRUNCATE TABLE life_action;
TRUNCATE TABLE life_introspection;
TRUNCATE TABLE life_insight;
TRUNCATE TABLE life_link;
TRUNCATE TABLE life_object;
TRUNCATE TABLE life_link_type;`,
      },
      {
        id: 'drop-all-tables',
        label: '删除所有表（反向依赖顺序）',
        description: '先删子表，再删父表（外键约束顺序）',
        sql: `DROP TABLE IF EXISTS life_introspection;
DROP TABLE IF EXISTS life_insight;
DROP TABLE IF EXISTS life_action;
DROP TABLE IF EXISTS life_link;
DROP TABLE IF EXISTS life_object;
DROP TABLE IF EXISTS life_link_type;
DROP TABLE IF EXISTS life_object_type;
DROP VIEW IF EXISTS v_ontology_network;`,
        refreshTables: true,
      },
    ],
  },

  // ── 进阶练习：本体论深度分析 ──
  ontology_advanced: {
    label: '进阶练习',
    description: '使用 SQL 对本体结构及关系网进行深度分析',
    color: 'purple',
    icon: 'Sparkles',
    templates: [
      {
        id: 'property-validation',
        label: '接口多态特征实现校验',
        description: '查询实现了特定对象接口的所有对象类型的公共特征属性集',
        sql: `SELECT 
    lo_inst.name AS 物理实体,
    lo_class.name AS 所属接口,
    lo_inst.properties AS 实例配置,
    lo_class.properties['共享特征'] AS 接口特征约束集
FROM life_object lo_inst
JOIN life_link ll ON lo_inst.id = ll.source_object_id
JOIN life_link_type lt ON ll.link_type_id = lt.id
JOIN life_object lo_class ON ll.target_object_id = lo_class.id
WHERE lt.name LIKE '%接口%';`,
        refreshTables: true,
      },
      {
        id: 'degree-analysis',
        label: '双向孪生组件连线度数分析',
        description: '分析各个本体孪生组件在整体操作系统中的调度热度',
        sql: `SELECT 
    lo.name AS 实体名称,
    lot.name AS 实体类型,
    COUNT(ll.id) AS 关联线数量
FROM life_object lo
JOIN life_object_type lot ON lo.object_type_id = lot.id
LEFT JOIN life_link ll ON lo.id = ll.source_object_id OR lo.id = ll.target_object_id
GROUP BY lo.id, lo.name, lot.name
ORDER BY 关联线数量 DESC;`,
        refreshTables: true,
      },
    ],
  },
};

export const TEMPLATE_CATEGORY_ORDER = ['setup', 'query', 'modify', 'export', 'ontology_advanced'];
