/**
 * 本体论数据模型 - 本体建模教育版 (Palantir 本体论版 - 精简版)
 *
 * 该模型包含 9 张核心表，基于 Palantir Foundry 的本体设计思想：
 * - life_object_type:     对象类型（核心元、控制元）
 * - life_object:          对象实例（对象类型、链接类型、行动类型、属性、逻辑函数、对象接口）
 * - life_link_type:      链接类型（从属于、定义关联、作用于、驱动计算、实现接口）
 * - life_link:           对象链接（关系链接拓扑）
 * - life_action:          行动（属性回写、函数计算、数据同步）
 * - life_introspection:   反思记录（探讨双向操作孪生、多态接口复用等）
 * - life_insight:         洞察（业务操作系统、单源真实性总结）
 * - life_canvas_state:    Canvas 布局状态
 * - life_canvas_edge:     Canvas 画布连线
 */

// ============================================
// 1. 建表语句（CREATE TABLE）
// ============================================

export const ONTOLOGY_CREATE_TABLES = `-- ═══════════════════════════════════════
-- 本体论教学数据模型 - Palantir 本体模型精简版
-- ═══════════════════════════════════════

-- ① 对象类型表
CREATE TABLE life_object_type (
    id INTEGER PRIMARY KEY,
    name VARCHAR NOT NULL,
    description VARCHAR
);

-- ② 对象实例表
CREATE TABLE life_object (
    id INTEGER PRIMARY KEY,
    object_type_id INTEGER REFERENCES life_object_type(id),
    name VARCHAR NOT NULL,
    properties JSON DEFAULT '{}',
    annotations VARCHAR DEFAULT ''
);

-- ③ 链接类型表
CREATE TABLE life_link_type (
    id INTEGER PRIMARY KEY,
    name VARCHAR NOT NULL,
    description VARCHAR
);

-- ④ 对象链接表
CREATE TABLE life_link (
    id INTEGER PRIMARY KEY,
    link_type_id INTEGER REFERENCES life_link_type(id),
    source_object_id INTEGER REFERENCES life_object(id),
    target_object_id INTEGER REFERENCES life_object(id),
    weight DECIMAL(3,2) DEFAULT 1.0
);

-- ⑤ 行动表
CREATE TABLE life_action (
    id INTEGER PRIMARY KEY,
    object_id INTEGER REFERENCES life_object(id),
    name VARCHAR NOT NULL,
    description VARCHAR,
    status VARCHAR DEFAULT 'pending',
    execute_at DATE
);

-- ⑥ 反思记录表
CREATE TABLE life_introspection (
    id INTEGER PRIMARY KEY,
    object_id INTEGER REFERENCES life_object(id),
    question VARCHAR,
    answer VARCHAR,
    created_at DATE DEFAULT CURRENT_DATE
);

-- ⑦ 洞察表
CREATE TABLE life_insight (
    id INTEGER PRIMARY KEY,
    object_id INTEGER REFERENCES life_object(id),
    insight VARCHAR,
    tag VARCHAR,
    created_at DATE DEFAULT CURRENT_DATE
);

-- ⑧ Canvas 布局状态表
CREATE TABLE life_canvas_state (
    id VARCHAR PRIMARY KEY,
    space_id VARCHAR,
    object_id INTEGER,
    title VARCHAR,
    color VARCHAR,
    x DECIMAL, y DECIMAL, width DECIMAL, height DECIMAL,
    node_type VARCHAR DEFAULT 'Source',
    metadata JSON DEFAULT '{}'
);

-- ⑨ Canvas 画布连线表
CREATE TABLE life_canvas_edge (
    id VARCHAR PRIMARY KEY,
    source_id VARCHAR,
    target_id VARCHAR
);`;

// ============================================
// 2. 种子数据（INSERT）
// ============================================

export const ONTOLOGY_SEED_DATA = `-- ═══════════════════════════════════════
-- 种子数据
-- 说明：以下数据模拟 Palantir 本体建模自身的核心定义
-- ═══════════════════════════════════════

-- 对象类型（2 种类型）
INSERT INTO life_object_type VALUES
    (1, '核心元', '实体与关系'),
    (2, '控制元', '运算与操作');

-- 对象实例（6 个核心元对象）
INSERT INTO life_object (id, object_type_id, name, properties, annotations) VALUES
    (1, 1, '对象类型', '{"数据源表": "主物理表", "主键字段": "标识键", "启用共享": true}', '数字孪生体'),
    (2, 1, '链接类型', '{"关联映射": "外键联合表", "对应基数": "多对多"}', '关联关系'),
    (3, 2, '行动类型', '{"回写模式": "同步事务回写", "授权范围": "操作员组"}', '回写操作'),
    (4, 1, '属性', '{"字段类型": "字符型", "主键约束": false, "敏感评级": "普通"}', '特征字段'),
    (5, 2, '逻辑函数', '{"执行环境": "计算引擎节点", "输入参数": "属性集合"}', '指标运算'),
    (6, 1, '对象接口', '{"共享特征": ["标识码", "修改时间"], "多态继承": true}', '多态复用');

-- 链接类型（5 种关系类型）
INSERT INTO life_link_type VALUES
    (1, '从属于', '包含归属'),
    (2, '定义关联', '声明关系'),
    (3, '作用于', '修改目标'),
    (4, '驱动计算', '重算特征'),
    (5, '实现接口', '协议遵从');

-- 对象链接（5 条关系实例）
INSERT INTO life_link VALUES
    (1, 1, 4, 1, 1.0),   -- 属性 -> 从属于 -> 对象类型
    (2, 2, 2, 1, 0.95),  -- 链接类型 -> 定义关联 -> 对象类型
    (3, 3, 3, 1, 0.9),   -- 行动类型 -> 作用于 -> 对象类型
    (4, 4, 5, 4, 0.8),   -- 逻辑函数 -> 驱动计算 -> 属性
    (5, 5, 1, 6, 0.85);  -- 对象类型 -> 实现接口 -> 对象接口

-- 行动实例（建模维护行动）
INSERT INTO life_action VALUES
    (1, 3, '属性回写', '更新属性值', 'executed', '2026-07-08'),
    (2, 5, '函数计算', '重算指标', 'in_progress', '2026-07-10'),
    (3, 1, '数据同步', '同步源表', 'pending', '2026-07-15');

-- 反思记录
INSERT INTO life_introspection VALUES
    (1, 1, 'Palantir本体论与传统数据仓库的本质区别是什么？', '传统数据仓库仅仅提供静态只读表格。而Palantir本体论是一个集成了“对象、链接、行动和逻辑函数”的双向可操作性数字孪生。它直接充当企业的“操作系统”，允许在实体对象上发生决策并安全回写修改底层数据源。', '2026-07-08'),
    (2, 6, '对象接口如何在复杂本体数据集成中发挥多态复用价值？', '当面临来自不同业务部门的异构表结构时，对象接口声明了一套公共特征协议，使得这些异构表的对象类型可以实现该接口。这使得下游分析逻辑只需面向接口开发，免除由于底层架构变更导致的大量修改。', '2026-07-08'),
    (3, 3, '如何设计安全的行动回写机制？', '结合底层数据源的权限设计，定义参数校验规则与条件逻辑，保证在事务内发生，避免并发冲突。', '2026-07-08');

-- 洞察
INSERT INTO life_insight VALUES
    (1, 1, '将业务逻辑沉淀在本体层面（如把逻辑函数直接与对象属性绑定），可以打破“应用层烟囱式”的开发困局，使得核心业务指标对于整个平台和全部上层决策流保持单源真实性。', '集成架构', '2026-07-08'),
    (2, 4, '链接类型 (Link Types) 并非简单的物理主外键，它不仅定义了物理维度的关联，还限制了决策沿拓扑链条蔓延的逻辑通路。', '模型拓扑', '2026-07-08'),
    (3, 3, '行动回写的实时反馈能力是让数据产生“生产力”的关键。从单纯的数据提取到业务状态回写，实现了从“看见数据”到“驱动变革”的范式飞跃。', '核心洞察', '2026-07-08');

-- Canvas 画布状态
INSERT INTO life_canvas_state (id, space_id, object_id, title, color, x, y, width, height) VALUES
    ('space-class', 'space-class', NULL, '关系拓扑', '#a78bfa', 100, 100, 320, 480),
    ('item-c1',      'space-class', 1,    NULL,   NULL,      20,  50,  280, 100),
    ('item-c2',      'space-class', 2,    NULL,   NULL,      20,  180, 280, 100),
    ('item-c3',      'space-class', 3,    NULL,   NULL,      20,  310, 280, 100),
    ('space-inst',  'space-inst',  NULL, '控制逻辑', '#38bdf8', 480, 100, 320, 480),
    ('item-i4',      'space-inst',  4,    NULL,   NULL,      20,  50,  280, 100),
    ('item-i5',      'space-inst',  5,    NULL,   NULL,      20,  180, 280, 100),
    ('item-i6',      'space-inst',  6,    NULL,   NULL,      20,  310, 280, 100);`;

// ============================================
// 2b. 种子数据（JavaScript 数组 - 运行时使用）
// 与 ONTOLOGY_SEED_DATA 内容完全一致，但结构化为 JS 数组
// ============================================

/** 建表语句数组 — 用于 duckDBService.query() 逐条执行 */
export const ONTOLOGY_CREATE_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS life_object_type (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL, description VARCHAR)`,
  `CREATE TABLE IF NOT EXISTS life_object (id INTEGER PRIMARY KEY, object_type_id INTEGER, name VARCHAR NOT NULL, properties JSON DEFAULT '{}', annotations VARCHAR DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS life_link_type (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL, description VARCHAR)`,
  `CREATE TABLE IF NOT EXISTS life_link (id INTEGER PRIMARY KEY, link_type_id INTEGER, source_object_id INTEGER, target_object_id INTEGER, weight DECIMAL(3,2) DEFAULT 1.0)`,
  `CREATE TABLE IF NOT EXISTS life_action (id INTEGER PRIMARY KEY, object_id INTEGER, name VARCHAR NOT NULL, description VARCHAR, status VARCHAR DEFAULT 'pending', execute_at DATE)`,
  `CREATE TABLE IF NOT EXISTS life_introspection (id INTEGER PRIMARY KEY, object_id INTEGER, question VARCHAR, answer VARCHAR, created_at DATE DEFAULT CURRENT_DATE)`,
  `CREATE TABLE IF NOT EXISTS life_insight (id INTEGER PRIMARY KEY, object_id INTEGER, insight VARCHAR, tag VARCHAR, created_at DATE DEFAULT CURRENT_DATE)`,
  `CREATE TABLE IF NOT EXISTS life_canvas_state (id VARCHAR PRIMARY KEY, space_id VARCHAR, object_id INTEGER, title VARCHAR, color VARCHAR, x DECIMAL, y DECIMAL, width DECIMAL, height DECIMAL, node_type VARCHAR DEFAULT 'Source', metadata JSON DEFAULT '{}')`,
  `CREATE TABLE IF NOT EXISTS life_canvas_edge (id VARCHAR PRIMARY KEY, source_id VARCHAR, target_id VARCHAR)`,
];

/** 种子数据 INSERT 语句数组 — 与 ONTOLOGY_SEED_DATA 内容一致 */
export const ONTOLOGY_SEED_STATEMENTS: string[] = [
  `INSERT INTO life_object_type VALUES (1, '核心元', '实体与关系'), (2, '控制元', '运算与操作') ON CONFLICT (id) DO NOTHING`,
  `INSERT INTO life_object (id, object_type_id, name, properties, annotations) VALUES (1, 1, '对象类型', '{"数据源表": "主物理表", "主键字段": "标识键", "启用共享": true}', '数字孪生体'), (2, 1, '链接类型', '{"关联映射": "外键联合表", "对应基数": "多对多"}', '关联关系'), (3, 2, '行动类型', '{"回写模式": "同步事务回写", "授权范围": "操作员组"}', '回写操作') ON CONFLICT (id) DO NOTHING`,
  `INSERT INTO life_object (id, object_type_id, name, properties, annotations) VALUES (4, 1, '属性', '{"字段类型": "字符型", "主键约束": false, "敏感评级": "普通"}', '特征字段'), (5, 2, '逻辑函数', '{"执行环境": "计算引擎节点", "输入参数": "属性集合"}', '指标运算'), (6, 1, '对象接口', '{"共享特征": ["标识码", "修改时间"], "多态继承": true}', '多态复用') ON CONFLICT (id) DO NOTHING`,
  `INSERT INTO life_link_type VALUES (1, '从属于', '包含归属'), (2, '定义关联', '声明关系'), (3, '作用于', '修改目标'), (4, '驱动计算', '重算特征'), (5, '实现接口', '协议遵从') ON CONFLICT (id) DO NOTHING`,
  `INSERT INTO life_link VALUES (1, 1, 4, 1, 1.0), (2, 2, 2, 1, 0.95), (3, 3, 3, 1, 0.9), (4, 4, 5, 4, 0.8), (5, 5, 1, 6, 0.85) ON CONFLICT (id) DO NOTHING`,
  `INSERT INTO life_action VALUES (1, 3, '属性回写', '更新属性值', 'executed', '2026-07-08'), (2, 5, '函数计算', '重算指标', 'in_progress', '2026-07-10'), (3, 1, '数据同步', '同步源表', 'pending', '2026-07-15') ON CONFLICT (id) DO NOTHING`,
  `INSERT INTO life_introspection (id, object_id, question, answer, created_at) VALUES (1, 1, '本体与数仓区别？', '本体是双向可操作孪生，数仓仅只读表格。', '2026-07-08'), (2, 6, '接口多态价值？', '声明公共协议，异构表复用接口，下游面向接口开发。', '2026-07-08'), (3, 3, '回写安全机制？', '参数校验加事务隔离，防止并发冲突。', '2026-07-08') ON CONFLICT (id) DO NOTHING`,
  `INSERT INTO life_insight (id, object_id, insight, tag, created_at) VALUES (1, 1, '将业务逻辑沉淀在本体层面（如把逻辑函数直接与对象属性绑定），可以打破“应用层烟囱式”的开发困局，使得核心业务指标对于整个平台和全部上层决策流保持单源真实性。', '集成架构', '2026-07-08'), (2, 4, '链接类型并非简单的物理主外键，它不仅定义了物理维度的关联，还限制了决策沿拓扑链条蔓延的逻辑通路。', '模型拓扑', '2026-07-08'), (3, 3, '行动回写的实时反馈能力是让数据产生“生产力”的关键。从单纯的数据提取到业务状态回写，实现了从“看见数据”到“驱动变革”的范式飞跃。', '核心洞察', '2026-07-08') ON CONFLICT (id) DO NOTHING`,
  `INSERT INTO life_canvas_state (id, space_id, object_id, title, color, x, y, width, height) VALUES ('space-class', 'space-class', NULL, '关系拓扑', '#a78bfa', 100, 100, 320, 480), ('item-c1', 'space-class', 1, NULL, NULL, 20, 50, 280, 100), ('item-c2', 'space-class', 2, NULL, NULL, 20, 180, 280, 100), ('item-c3', 'space-class', 3, NULL, NULL, 20, 310, 280, 100), ('space-inst', 'space-inst', NULL, '控制逻辑', '#38bdf8', 480, 100, 320, 480), ('item-i4', 'space-inst', 4, NULL, NULL, 20, 50, 280, 100), ('item-i5', 'space-inst', 5, NULL, NULL, 20, 180, 280, 100), ('item-i6', 'space-inst', 6, NULL, NULL, 20, 310, 280, 100) ON CONFLICT (id) DO NOTHING`,
];

// ============================================
// 3. 完整初始化脚本（建表 + 种子数据）
// ============================================

export const ONTOLOGY_INIT_SCRIPT = [
  ...ONTOLOGY_CREATE_STATEMENTS,
  ...ONTOLOGY_SEED_STATEMENTS,
].join(';\n\n') + ';';

// ============================================
// 4. 数据模型元信息（用于 UI 显示）
// ============================================

export const ONTOLOGY_MODEL_INFO = {
  name: 'Palantir本体论元本体模型',
  description: '基于 对象-关系-行动-函数 的操作数字孪生本体模型',
  businessScenario: '业务数字孪生 / 双向回写操作系统',
  tables: [
    {
      name: 'life_object_type',
      description: '对象类型 - 核心元、控制元',
      rowCount: 2,
      fields: ['id', 'name', 'description']
    },
    {
      name: 'life_object',
      description: '对象实例 - 对象类型、链接类型、行动类型等具体定义',
      rowCount: 6,
      fields: ['id', 'object_type_id', 'name', 'properties', 'annotations']
    },
    {
      name: 'life_link_type',
      description: '链接类型 - 从属于、定义关联、作用于、驱动计算、实现接口',
      rowCount: 5,
      fields: ['id', 'name', 'description']
    },
    {
      name: 'life_link',
      description: '对象链接 - 本体各核心定义之间的关系拓扑连线',
      rowCount: 5,
      fields: ['id', 'link_type_id', 'source_object_id', 'target_object_id', 'weight']
    },
    {
      name: 'life_action',
      description: '建模行动 - 属性回写、函数计算、数据同步',
      rowCount: 3,
      fields: ['id', 'object_id', 'name', 'description', 'status', 'execute_at']
    },
    {
      name: 'life_introspection',
      description: '建模反思 - 操作系统孪生与多态接口设计反思',
      rowCount: 3,
      fields: ['id', 'object_id', 'question', 'answer', 'created_at']
    },
    {
      name: 'life_insight',
      description: '建模洞察 - 指标单源真实性与链接传递规则经验提炼',
      rowCount: 3,
      fields: ['id', 'object_id', 'insight', 'tag', 'created_at']
    },
    {
      name: 'life_canvas_state',
      description: 'Canvas 布局 - 数字孪生建模拓扑分区配置',
      rowCount: 8,
      fields: ['id', 'space_id', 'object_id', 'title', 'color', 'x', 'y', 'width', 'height']
    }
  ],
  erDiagram: `erDiagram
    life_object_type ||--o{ life_object : "instantiates"
    life_object_type ||--o{ life_link_type : "defines"
    life_link_type ||--o{ life_link : "categorizes"
    life_object ||--o{ life_link : "as source"
    life_object ||--o{ life_link : "as target"`
};

// ============================================
// 5. 表关系说明
// ============================================

export const ONTOLOGY_RELATIONSHIPS = [
  { from: 'life_object_type', to: 'life_object', type: '1:N', description: '一个类型可包含多个对象实例' },
  { from: 'life_object', to: 'life_link', type: '1:N', description: '一个对象可作为多个链接的源或目标' },
  { from: 'life_link_type', to: 'life_link', type: '1:N', description: '一种链接类型可包含多条关系实例' },
  { from: 'life_object', to: 'life_action', type: '1:N', description: '一个对象可关联多条行动建议' },
  { from: 'life_object', to: 'life_introspection', type: '1:N', description: '一个对象可有多条反思记录' },
  { from: 'life_object', to: 'life_insight', type: '1:N', description: '一个对象可有多条洞察' },
];

// ============================================
// 6. 常用查询示例（教学演示）
// ============================================

export const ONTOLOGY_EXAMPLE_QUERIES = {
  // 基础查询
  basic: {
    description: '基础检索 - 查询所有数据表内容',
    queries: [
      `-- 查询所有本体定义对象
SELECT * FROM life_object;`,
      `-- 查询所有对象及其归属的元定义类型
SELECT lo.*, lot.name AS type_name
FROM life_object lo
JOIN life_object_type lot ON lo.object_type_id = lot.id;`,
      `-- 查询所有关系类型
SELECT * FROM life_link_type;`
    ]
  },
  // 过滤查询
  filter: {
    description: '条件过滤 - 按类型、状态筛选对象',
    queries: [
      `-- 查询所有主干核心实体类型定义
SELECT lo.*, lot.name AS type_name
FROM life_object lo
JOIN life_object_type lot ON lo.object_type_id = lot.id
WHERE lot.name = '核心元';`,
      `-- 查询启用了多态或共享的对象属性
SELECT name, properties
FROM life_object
WHERE properties['启用共享']::BOOLEAN = true OR properties['多态继承']::BOOLEAN = true;`,
      `-- 查询所有待执行的同步及运算指令
SELECT * FROM life_action WHERE status = 'pending';`
    ]
  },
  // 关联查询
  join: {
    description: '多表关联 - 查询语义关联关系',
    queries: [
      `-- 查询完整数字孪生本体拓扑关系网
SELECT 
    src.name AS 来源实体,
    lt.name AS 关联方式,
    tgt.name AS 目标实体,
    ll.weight AS 关联强弱
FROM life_link ll
JOIN life_link_type lt ON ll.link_type_id = lt.id
JOIN life_object src ON ll.source_object_id = src.id
JOIN life_object tgt ON ll.target_object_id = tgt.id;`,
      `-- 查询接口的多态实现与继承关系 (实现接口)
SELECT 
    src.name AS 物理对象,
    tgt.name AS 多态接口,
    ll.weight AS 映射系数
FROM life_link ll
JOIN life_link_type lt ON ll.link_type_id = lt.id
JOIN life_object src ON ll.source_object_id = src.id
JOIN life_object tgt ON ll.target_object_id = tgt.id
WHERE lt.name LIKE '%接口%';`
    ]
  },
  // 聚合查询
  aggregation: {
    description: '聚合统计 - 统计各类及关系链接数量',
    queries: [
      `-- 统计各类别的实例分布数量
SELECT lot.name AS 元类型, COUNT(lo.id) AS 对象数
FROM life_object_type lot
LEFT JOIN life_object lo ON lot.id = lo.object_type_id
GROUP BY lot.name;`,
      `-- 统计每类链接关系在整体拓扑中的频次与权重
SELECT lt.name AS 链接关系, COUNT(ll.id) AS 连线数, AVG(ll.weight) AS 平均权重
FROM life_link_type lt
LEFT JOIN life_link ll ON lt.id = ll.link_type_id
GROUP BY lt.name;`,
      `-- 分析连线重要度等级分布
SELECT 
    CASE 
        WHEN ll.weight >= 0.9 THEN '直接依赖语义'
        WHEN ll.weight >= 0.7 THEN '普通调用语义'
        ELSE '辅助逻辑关系'
    END AS 依赖级别,
    COUNT(*) AS 数量
FROM life_link ll
GROUP BY 1;`
    ]
  },
  // JSON 属性查询
  json: {
    description: 'JSON 属性查询 - 提取特定字段与约束属性',
    queries: [
      `-- 提取不同实体对应的回写模式或数据源映射表
SELECT 
    name AS 本体概念,
    properties['数据源表']::VARCHAR AS 映射物理表,
    properties['回写模式']::VARCHAR AS 运作回写机制
FROM life_object;`,
      `-- 查询指定了共享接口特征集的对象定义
SELECT name, properties['共享特征'] AS 接口约定集
FROM life_object
WHERE properties['共享特征'] IS NOT NULL;`
    ]
  }
};

export default {
  ONTOLOGY_CREATE_TABLES,
  ONTOLOGY_SEED_DATA,
  ONTOLOGY_CREATE_STATEMENTS,
  ONTOLOGY_SEED_STATEMENTS,
  ONTOLOGY_INIT_SCRIPT,
  ONTOLOGY_MODEL_INFO,
  ONTOLOGY_RELATIONSHIPS,
  ONTOLOGY_EXAMPLE_QUERIES
};
