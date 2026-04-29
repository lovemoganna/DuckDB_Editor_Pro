/**
 * 本体论数据模型 - "我的人生"版本
 *
 * 本教程统一使用的基础数据模型
 * 业务场景：个人生活管理 / 自我认知
 *
 * 该模型包含 8 张核心表，贯穿所有 SQL 教学示例：
 * - life_object_type:     对象类型（生活维度、人物、目标）
 * - life_object:          对象实例（心态、工作、家庭、身体）
 * - life_link_type:      链接类型（影响、养活、锚定、支撑）
 * - life_link:           对象链接（关系实例，连接两个对象）
 * - life_action:          行动（尚未执行的操作，关联到对象）
 * - life_introspection:   反思记录（问题与回答）
 * - life_insight:         洞察（闪念与标签）
 * - life_canvas_state:    Canvas 布局状态（画布空间与项目位置）
 *
 * 使用说明：
 * 1. 先执行建表语句创建 8 张表
 * 2. 再执行 INSERT 语句插入种子数据
 * 3. 之后所有 SQL 示例均可基于此数据模型运行
 */

// ============================================
// 1. 建表语句（CREATE TABLE）
// ============================================

export const ONTOLOGY_CREATE_TABLES = `-- ═══════════════════════════════════════
-- 本体论教学数据模型 - "我的人生"
-- 业务场景：个人生活管理 / 自我认知
-- 
-- 核心思想：Object（对象）+ Link（关系）+ Action（行动）
-- ═══════════════════════════════════════

-- ① 对象类型表
-- 定义生活中的实体分类
CREATE TABLE life_object_type (
    id INTEGER PRIMARY KEY,
    name VARCHAR NOT NULL,
    description VARCHAR
);

-- ② 对象实例表
-- 生活中的具体实体
CREATE TABLE life_object (
    id INTEGER PRIMARY KEY,
    object_type_id INTEGER REFERENCES life_object_type(id),
    name VARCHAR NOT NULL,
    properties JSON DEFAULT '{}',
    annotations VARCHAR DEFAULT ''
);

-- ③ 链接类型表
-- 定义实体之间的关系类型
CREATE TABLE life_link_type (
    id INTEGER PRIMARY KEY,
    name VARCHAR NOT NULL,
    description VARCHAR
);

-- ④ 对象链接表
-- 具体的实体关系
CREATE TABLE life_link (
    id INTEGER PRIMARY KEY,
    link_type_id INTEGER REFERENCES life_link_type(id),
    source_object_id INTEGER REFERENCES life_object(id),
    target_object_id INTEGER REFERENCES life_object(id),
    weight DECIMAL(3,2) DEFAULT 1.0
);

-- ⑤ 行动表
-- 尚未执行的操作
CREATE TABLE life_action (
    id INTEGER PRIMARY KEY,
    object_id INTEGER REFERENCES life_object(id),
    name VARCHAR NOT NULL,
    description VARCHAR,
    status VARCHAR DEFAULT 'pending',
    execute_at DATE
);

-- ⑥ Canvas 布局状态表
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

-- ⑦ Canvas 画布连线表
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
-- 说明：以下数据模拟"我的人生"本体论
-- ═══════════════════════════════════════

-- 对象类型（3 种类型）
INSERT INTO life_object_type VALUES
    (1, 'Aspect', '生活维度'),
    (2, 'Person', '人物'),
    (3, 'Goal', '目标');

-- 对象实例（4 个核心对象）
INSERT INTO life_object (id, object_type_id, name, properties) VALUES
    (1, 1, '心态', '{"state": "焦虑", "goal": "内心平静"}'),
    (2, 1, '工作', '{"role": "工程师", "struggle": "沟通与办公室政治"}'),
    (3, 1, '家庭', '{"priority": "最高"}'),
    (4, 1, '身体', '{"state": "还行", "goal": "健康"}');

-- 链接类型（4 种关系类型）
INSERT INTO life_link_type VALUES
    (1, '影响', 'A 作用于 B'),
    (2, '养活', 'A 为 B 提供物质基础'),
    (3, '锚定', 'A 为 B 提供精神支撑'),
    (4, '支撑', 'A 为 B 提供基础条件');

-- 对象链接（4 条关系实例）
INSERT INTO life_link VALUES
    (1, 1, 1, 2, 0.9),   -- 心态 -> 影响 -> 工作
    (2, 2, 2, 3, 1.0),   -- 工作 -> 养活 -> 家庭
    (3, 3, 3, 1, 0.8),   -- 家庭 -> 锚定 -> 心态
    (4, 4, 4, 1, 0.7);   -- 身体 -> 支撑 -> 心态

-- 行动实例（将行动关联到具体的本体对象）
INSERT INTO life_action VALUES
    (1, 4, '早睡早起', '调整作息，保持充足睡眠', 'pending', '2024-12-31');

-- 反思记录（introspection 层）
INSERT INTO life_introspection VALUES
    (1, 1, '为什么最近总是焦虑？', '因为工作沟通不顺畅，把情绪带到了生活中。', CURRENT_DATE);

-- 洞察（insight 层）
INSERT INTO life_insight VALUES
    (1, 2, '沟通是工程师最大的软技能壁垒', '职场真相', CURRENT_DATE);

-- Canvas 画布状态
INSERT INTO life_canvas_state VALUES
    ('space-1', 'space-1', NULL, '个人生活', '#a78bfa', 100, 100, 320, 350),
    ('item-1',  'space-1', 1,     NULL,              NULL,  20,  50,  280, 100),
    ('item-4',  'space-1', 4,     NULL,              NULL,  20,  180, 280, 100),
    ('space-2', 'space-2', NULL, '外部事务',         '#38bdf8', 480, 100, 320, 350),
    ('item-2',  'space-2', 2,     NULL,              NULL,  20,  50,  280, 100),
    ('item-3',  'space-2', 3,     NULL,              NULL,  20,  180, 280, 100);`

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
  `INSERT INTO life_object_type VALUES (1, 'Aspect', '生活维度'), (2, 'Person', '人物'), (3, 'Goal', '目标') ON CONFLICT (id) DO NOTHING`,
  `INSERT INTO life_object (id, object_type_id, name, properties) VALUES (1, 1, '心态', '{"state": "焦虑", "goal": "内心平静"}'), (2, 1, '工作', '{"role": "工程师", "struggle": "沟通与办公室政治"}'), (3, 1, '家庭', '{"priority": "最高"}'), (4, 1, '身体', '{"state": "还行", "goal": "健康"}') ON CONFLICT (id) DO NOTHING`,
  `INSERT INTO life_object (id, object_type_id, name, properties) VALUES (5, 2, '父母', '{"relationship": "直系亲属", "emotional_anchor": true, "contact_freq": "每月"}'), (6, 2, '配偶', '{"relationship": "伴侣", "emotional_anchor": true, "contact_freq": "每天"}'), (7, 2, '同事小王', '{"relationship": "同事", "support_level": "高", "contact_freq": "工作日"}'), (8, 2, '老友老李', '{"relationship": "挚友", "emotional_anchor": true, "contact_freq": "每周"}') ON CONFLICT (id) DO NOTHING`,
  `INSERT INTO life_object (id, object_type_id, name, properties) VALUES (9, 3, '副业变现', '{"deadline": "2025-12-31", "progress": 20, "priority": "高"}'), (10, 3, '读完50本书', '{"deadline": "2025-12-31", "progress": 38, "priority": "中"}'), (11, 3, '跑完半马', '{"deadline": "2025-06-01", "progress": 60, "priority": "高"}'), (12, 3, '掌握日语N3', '{"deadline": "2025-12-31", "progress": 45, "priority": "低"}') ON CONFLICT (id) DO NOTHING`,
  `INSERT INTO life_link_type VALUES (1, '影响', 'A 作用于 B'), (2, '养活', 'A 为 B 提供物质基础'), (3, '锚定', 'A 为 B 提供精神支撑'), (4, '支撑', 'A 为 B 提供基础条件'), (5, '依恋', 'A 深度依赖 B'), (6, '协助', 'A 帮助 B 完成任务') ON CONFLICT (id) DO NOTHING`,
  `INSERT INTO life_link VALUES (1, 1, 1, 2, 0.9), (2, 2, 2, 3, 1.0), (3, 3, 3, 1, 0.8), (4, 4, 4, 1, 0.7), (5, 1, 6, 1, 0.95), (6, 3, 5, 1, 0.85), (7, 5, 5, 6, 1.0), (8, 6, 7, 2, 0.6), (9, 1, 8, 1, 0.7), (10, 3, 8, 1, 0.75), (11, 4, 4, 11, 0.9), (12, 2, 2, 9, 0.8), (13, 1, 1, 10, 0.5) ON CONFLICT (id) DO NOTHING`,
  `INSERT INTO life_action VALUES (1, 4, '早睡早起', '调整作息，保持充足睡眠', 'pending', '2024-12-31'), (2, 9, '搭建 MVP', '完成副业项目第一个可演示版本', 'pending', '2025-06-01'), (3, 11, '月跑量80公里', '本月跑步总里程目标', 'pending', '2025-05-01') ON CONFLICT (id) DO NOTHING`,
  `INSERT INTO life_introspection VALUES (1, 1, '为什么最近总是焦虑？', '因为工作沟通不顺畅，把情绪带到了生活中。', CURRENT_DATE), (2, 2, '工作对我意味着什么？', '既是收入来源，也是自我价值实现的途径。', CURRENT_DATE) ON CONFLICT (id) DO NOTHING`,
  `INSERT INTO life_insight VALUES (1, 2, '沟通是工程师最大的软技能壁垒', '职场真相', CURRENT_DATE), (2, 6, '家庭是情绪的稳定器，再忙也要留时间', '家庭优先级', CURRENT_DATE), (3, 8, '老友不需要常常联系，但关键时刻一定在', '友情', CURRENT_DATE) ON CONFLICT (id) DO NOTHING`,
  `INSERT INTO life_canvas_state VALUES ('space-1', 'space-1', NULL, '个人生活', '#a78bfa', 100, 100, 320, 350), ('item-1', 'space-1', 1, NULL, NULL, 20, 50, 280, 100), ('item-4', 'space-1', 4, NULL, NULL, 20, 180, 280, 100), ('space-2', 'space-2', NULL, '外部事务', '#38bdf8', 480, 100, 320, 350), ('item-2', 'space-2', 2, NULL, NULL, 20, 50, 280, 100), ('item-3', 'space-2', 3, NULL, NULL, 20, 180, 280, 100) ON CONFLICT (id) DO NOTHING`,
];

// ============================================
// 3. 完整初始化脚本（建表 + 种子数据）
// ============================================

export const ONTOLOGY_INIT_SCRIPT = `${ONTOLOGY_CREATE_TABLES};

${ONTOLOGY_SEED_DATA};`;

// ============================================
// 4. 数据模型元信息（用于 UI 显示）
// ============================================

export const ONTOLOGY_MODEL_INFO = {
  name: '"我的人生"本体论数据模型',
  description: '基于 Object + Link + Action 的个人生活知识图谱',
  businessScenario: '个人生活管理 / 自我认知',
  tables: [
    {
      name: 'life_object_type',
      description: '对象类型 - 生活维度、人物、目标',
      rowCount: 3,
      fields: ['id', 'name', 'description']
    },
    {
      name: 'life_object',
      description: '对象实例 - 心态、工作、家庭、身体',
      rowCount: 4,
      fields: ['id', 'object_type_id', 'name', 'properties', 'annotations']
    },
    {
      name: 'life_link_type',
      description: '链接类型 - 影响、养活、锚定、支撑',
      rowCount: 4,
      fields: ['id', 'name', 'description']
    },
    {
      name: 'life_link',
      description: '对象链接 - 关系实例',
      rowCount: 4,
      fields: ['id', 'link_type_id', 'source_object_id', 'target_object_id', 'weight']
    },
    {
      name: 'life_action',
      description: '行动 - 尚未执行的操作',
      rowCount: 1,
      fields: ['id', 'object_id', 'name', 'description', 'status', 'execute_at']
    },
    {
      name: 'life_introspection',
      description: '反思记录 - 问题与回答',
      rowCount: 1,
      fields: ['id', 'object_id', 'question', 'answer', 'created_at']
    },
    {
      name: 'life_insight',
      description: '洞察 - 闪念与标签',
      rowCount: 1,
      fields: ['id', 'object_id', 'insight', 'tag', 'created_at']
    },
    {
      name: 'life_canvas_state',
      description: 'Canvas 布局 - 画布空间与项目位置',
      rowCount: 6,
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
  { from: 'life_object', to: 'life_action', type: '1:N', description: '一个对象可关联多条行动' },
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
      `-- 查询所有对象
SELECT * FROM life_object;`,
      `-- 查询所有对象及其类型
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
      `-- 查询所有生活维度对象
SELECT lo.*, lot.name AS type_name
FROM life_object lo
JOIN life_object_type lot ON lo.object_type_id = lot.id
WHERE lot.name = 'Aspect';`,
      `-- 查询状态为"焦虑"的对象
SELECT name, properties
FROM life_object
WHERE properties['state']::VARCHAR = '焦虑';`,
      `-- 查询所有待执行行动
SELECT * FROM life_action WHERE status = 'pending';`
    ]
  },
  // 关联查询
  join: {
    description: '多表关联 - 查询对象之间的关系统一',
    queries: [
      `-- 查询所有关系网络
SELECT 
    src.name AS A端,
    lt.name AS 关系,
    tgt.name AS B端,
    ll.weight AS 强度
FROM life_link ll
JOIN life_link_type lt ON ll.link_type_id = lt.id
JOIN life_object src ON ll.source_object_id = src.id
JOIN life_object tgt ON ll.target_object_id = tgt.id;`,
      `-- 查询"影响"关系
SELECT 
    src.name AS 发起方,
    tgt.name AS 被影响方,
    ll.weight AS 影响强度
FROM life_link ll
JOIN life_link_type lt ON ll.link_type_id = lt.id
JOIN life_object src ON ll.source_object_id = src.id
JOIN life_object tgt ON ll.target_object_id = tgt.id
WHERE lt.name = '影响';`
    ]
  },
  // 聚合查询
  aggregation: {
    description: '聚合统计 - 按类型统计对象和关系数量',
    queries: [
      `-- 按类型统计对象数量
SELECT lot.name AS 类型, COUNT(lo.id) AS 对象数
FROM life_object_type lot
LEFT JOIN life_object lo ON lot.id = lo.object_type_id
GROUP BY lot.name;`,
      `-- 统计每种关系类型的链接数量
SELECT lt.name AS 关系类型, COUNT(ll.id) AS 关系数, AVG(ll.weight) AS 平均强度
FROM life_link_type lt
LEFT JOIN life_link ll ON lt.id = ll.link_type_id
GROUP BY lt.name;`,
      `-- 分析关系强度分布
SELECT 
    CASE 
        WHEN ll.weight >= 0.9 THEN '核心关系'
        WHEN ll.weight >= 0.7 THEN '重要关系'
        ELSE '一般关系'
    END AS 关系等级,
    COUNT(*) AS 数量
FROM life_link ll
GROUP BY 1;`
    ]
  },
  // JSON 属性查询
  json: {
    description: 'JSON 属性查询 - 提取对象的状态和目标',
    queries: [
      `-- 查询所有对象的名称和状态
SELECT 
    name AS 对象,
    properties['state']::VARCHAR AS 当前状态,
    properties['goal']::VARCHAR AS 目标状态
FROM life_object;`,
      `-- 查询有"目标"属性的对象
SELECT name, properties['goal']::VARCHAR AS 目标
FROM life_object
WHERE properties['goal'] IS NOT NULL;`
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
