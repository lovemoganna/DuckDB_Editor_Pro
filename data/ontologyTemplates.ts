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
        WHEN ll.weight >= 0.9 THEN '★★★ 核心'
        WHEN ll.weight >= 0.7 THEN '★★ 重要'
        ELSE '★ 一般'
    END AS 重要程度
FROM life_link ll
JOIN life_object src ON ll.source_object_id = src.id
JOIN life_object tgt ON ll.target_object_id = tgt.id;`,
      },
      {
        id: 'json-state-query',
        label: 'JSON 属性查询：状态为"焦虑"的对象',
        description: 'DuckDB 支持直接用 :: 类型转换从 JSON 提取字段',
        sql: `SELECT name, properties['state']::VARCHAR AS state
FROM life_object
WHERE properties['state']::VARCHAR = '焦虑';`,
      },
      {
        id: 'pending-actions',
        label: '查询所有待执行行动',
        description: '查看所有未完成的承诺',
        sql: `SELECT name, description FROM life_action WHERE status = 'pending';`,
      },
      {
        id: 'recursive-impact',
        label: '递归追溯：从 A 出发的所有影响路径',
        description: '递归 CTE 追溯影响链，depth 限制防止无限递归',
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
      },
      {
        id: 'link-stats',
        label: '每种关系的数量和平均强度',
        description: '了解哪种关系类型使用最频繁',
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
        description: '找出权重最高的三条关系',
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
        description: '三个预设类型',
        sql: `INSERT INTO life_object_type VALUES
    (1, 'Aspect', '生活维度'),
    (2, 'Person', '人物'),
    (3, 'Goal',   '目标');`,
      },
      {
        id: 'insert-object',
        label: '插入对象实例',
        description: '四个核心对象',
        sql: `INSERT INTO life_object (id, object_type_id, name, properties) VALUES
    (1, 1, '心态', '{"state": "焦虑", "goal": "内心平静"}'),
    (2, 1, '工作', '{"role": "工程师", "struggle": "沟通"}'),
    (3, 1, '家庭', '{"priority": "最高"}'),
    (4, 1, '身体', '{"state": "还行", "goal": "健康"}');`,
      },
      {
        id: 'insert-link-type',
        label: '插入关系类型',
        description: '四种核心关系',
        sql: `INSERT INTO life_link_type VALUES
    (1, '影响', 'A 作用于 B'),
    (2, '养活', 'A 为 B 提供物质基础'),
    (3, '锚定', 'A 为 B 提供精神支撑'),
    (4, '支撑', 'A 为 B 提供基础条件');`,
      },
      {
        id: 'insert-link',
        label: '插入关系实例',
        description: '心态→影响→工作(0.9)，工作→养活→家庭(1.0)，家庭→锚定→心态(0.8)，身体→支撑→心态(0.7)',
        sql: `INSERT INTO life_link VALUES
    (1, 1, 1, 2, 0.9),
    (2, 2, 2, 3, 1.0),
    (3, 3, 3, 1, 0.8),
    (4, 4, 4, 1, 0.7);`,
      },
      {
        id: 'update-weight',
        label: '调整关系权重（反思后）',
        description: '权重不是一成不变的，定期反思后可以调整',
        sql: `UPDATE life_link
SET weight = 0.6
WHERE source_object_id = (SELECT id FROM life_object WHERE name = '心态')
  AND target_object_id = (SELECT id FROM life_object WHERE name = '工作');`,
      },
      {
        id: 'mark-action-done',
        label: '标记行动已执行',
        description: '执行完一个行动后更新状态',
        sql: `UPDATE life_action
SET status = 'executed', execute_at = CURRENT_DATE
WHERE name = '深呼吸';`,
      },
      {
        id: 'relation-to-action',
        label: '将关系转化为行动建议',
        description: '用 SQL 分析哪些关系需要行动介入',
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
        label: '创建视图：关系网络',
        description: '视图将三表 JOIN 固化，之后直接 SELECT * FROM v_relation_network',
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
        refreshTables: true,
      },
      {
        id: 'use-view',
        label: '使用视图查询',
        description: '基于视图做二次过滤',
        sql: `SELECT * FROM v_relation_network
WHERE relation_weight > 0.7
ORDER BY relation_weight DESC;`,
      },
      {
        id: 'cte-weighted-links',
        label: 'CTE：带权重的完整关系视图',
        description: '封装关系 JOIN + CASE 分级，后续可直接 SELECT * FROM relation_view',
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
      },
      {
        id: 'truncate-all',
        label: '清空数据（保留表结构）',
        description: 'TRUNCATE 比 DELETE 快很多，适合重新初始化数据',
        sql: `TRUNCATE TABLE life_action;
TRUNCATE TABLE life_link;
TRUNCATE TABLE life_object;
TRUNCATE TABLE life_link_type;`,
      },
      {
        id: 'drop-all-tables',
        label: '删除所有表（反向依赖顺序）',
        description: '先删子表，再删父表（外键约束顺序）',
        sql: `DROP TABLE IF EXISTS life_action;
DROP TABLE IF EXISTS life_link;
DROP TABLE IF EXISTS life_object;
DROP TABLE IF EXISTS life_link_type;
DROP TABLE IF EXISTS life_object_type;
DROP VIEW IF EXISTS v_relation_network;`,
        refreshTables: true,
      },
    ],
  },
  industry: {
    label: '行业模板',
    description: '快速导入典型行业本体论结构',
    color: 'purple',
    icon: 'Sparkles',
    templates: [
      {
        id: 'financial-audit',
        label: '金融审计风控图谱',
        description: '商户 -> 账户 -> 异常交易 -> 风控处置',
        sql: `INSERT INTO life_object_type VALUES (110, 'Merchant', '商户'), (111, 'Card', '银行卡'), (112, 'RiskAlert', '风险告警');
INSERT INTO life_object (id, object_type_id, name, properties) VALUES (1100, 110, '商户A', '{"industry": "Retail", "risk_level": "medium"}'), (1101, 111, '尾号8888的借记卡', '{"bank": "ICBC"}'), (1102, 112, '洗钱嫌疑告警', '{"rules_triggered": 3, "score": 92}');
INSERT INTO life_link_type VALUES (110, '绑定', 'A 绑定了 B'), (111, '触发', 'A 交易触发了 B 告警');
INSERT INTO life_link VALUES (1100, 110, 1101, 1100, 1.0), (1101, 111, 1101, 1102, 0.95);
INSERT INTO life_action (id, object_id, name, description, status) VALUES (1100, 1102, '冻结账户并上报', '触发高风险洗钱告警，需要立即执行暂停交易处置', 'pending');`,
        refreshTables: true,
      },
      {
        id: 'supply-chain',
        label: '物流供应链物流图谱',
        description: '仓库 -> 货运线路 -> 承运商',
        sql: `INSERT INTO life_object_type VALUES (120, 'Warehouse', '仓库'), (121, 'Route', '线路'), (122, 'Carrier', '承运商');
INSERT INTO life_object (id, object_type_id, name, properties) VALUES (1200, 120, '华东1号仓', '{\"capacity\": 50000}'), (1201, 121, '沪宁高速专线', '{\"distance\": 310}'), (1202, 122, '顺丰速运', '{\"contract_active\": true}');
INSERT INTO life_link_type VALUES (120, '指派', 'A 任务指派给 B'), (121, '起始于', 'A 线路起始于 B 仓');
INSERT INTO life_link VALUES (1201, 120, 1201, 1200, 0.9), (1202, 120, 1202, 1201, 0.85);`,
        refreshTables: true,
      },
      {
        id: 'devops-observability',
        label: 'DevOps可观测性图谱',
        description: '服务 -> 核心指标 -> 故障事件',
        sql: `INSERT INTO life_object_type VALUES (130, 'Service', '微服务'), (131, 'Metric', '核心指标'), (132, 'Incident', '故障事件');
INSERT INTO life_object (id, object_type_id, name, properties) VALUES (1300, 130, '订单API服务', '{\"language\": \"Go\", \"version\": \"v2.1\"}'), (1301, 131, 'P99 响应延迟', '{\"unit\": \"ms\", \"value\": 1200}'), (1302, 132, '支付超时故障', '{\"severity\": \"P0\", \"status\": \"active\"}');
INSERT INTO life_link_type VALUES (130, '引发', 'A 异常导致 B 故障'), (131, '监控', 'A 监控 B 服务性能');
INSERT INTO life_link VALUES (1301, 131, 1301, 1300, 0.95), (1301, 130, 1301, 1302, 0.9);
INSERT INTO life_action (id, object_id, name, description, status) VALUES (1300, 1302, '重启Pod实例', '立即重启以清空连接池异常状态', 'pending');`,
        refreshTables: true,
      },
      {
        id: 'ai-knowledge',
        label: 'AI 学术与模型图谱',
        description: '论文 -> 模型 -> 评估基准',
        sql: `INSERT INTO life_object_type VALUES (140, 'Paper', '论文'), (141, 'Model', 'AI模型'), (142, 'Benchmark', '评估基准');
INSERT INTO life_object (id, object_type_id, name, properties) VALUES (1400, 140, 'Attention Is All You Need', '{\"year\": 2017}'), (1401, 141, 'Transformer', '{\"parameters\": \"large\"}'), (1402, 142, 'MMLU', '{\"metric\": \"Accuracy\"}');
INSERT INTO life_link_type VALUES (140, '提出', 'A 论文提出了 B 模型'), (141, '测试于', 'A 模型测试于 B 基准');
INSERT INTO life_link VALUES (1400, 140, 1400, 1401, 1.0), (1401, 141, 1401, 1402, 0.92);`,
        refreshTables: true,
      },
    ],
  },
};

export const TEMPLATE_CATEGORY_ORDER = ['setup', 'query', 'modify', 'export', 'industry'];
