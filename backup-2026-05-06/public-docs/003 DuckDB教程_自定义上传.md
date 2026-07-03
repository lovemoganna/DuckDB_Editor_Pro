# 用 DuckDB 建模 Palantir Ontology 元结构：完整教程

## 目录

1. [前言：为什么用 SQL 建模 Ontology 本身](#1-前言)
2. [环境准备](#2-环境准备)
3. [第一部分：Object — 万物皆对象](#3-object)
4. [第二部分：Link — 关系即结构](#4-link)
5. [第三部分：State — 状态即生命周期](#5-state)
6. [第四部分：Action — 行为即变迁](#6-action)
7. [第五部分：四元协作 — 完整运转](#7-collaboration)
8. [第六部分：DuckDB 全能力覆盖](#8-duckdb-full)
9. [第七部分：复用到任意业务场景](#9-reuse)
10. [附录：MECE 能力清单](#10-mece)

---

## 1. 前言

Palantir Foundry 的 Ontology 由四个元概念构成：

| 元概念 | 本质 | 类比 |
|--------|------|------|
| **Object** | 实体定义 + 实例 | OOP 的 Class + Instance |
| **Link** | 实体间的有向/无向关系 | ER 图的 Relationship |
| **State** | 实体在某时刻的快照/阶段 | 状态机的 State |
| **Action** | 改变实体状态或关系的操作 | 状态机的 Transition |

**本文不是用 Ontology 来建模某个业务，而是把 Ontology 本身当作被建模的对象。** 你运行的每条 SQL，操作的都是"Object Type 的定义"、"Link Type 的定义"这些**元层面**的数据。理解元模型后，你可以将其实例化到任何业务域。

---

## 2. 环境准备

```bash
# 安装 DuckDB（macOS）
brew install duckdb

# 或者 pip
pip install duckdb

# 启动
duckdb ontology_meta.db
```

```sql
-- 确认版本
SELECT version();

-- 开启进度条（大查询可视）
PRAGMA enable_progress_bar;

-- 设置内存与线程
SET memory_limit = '2GB';
SET threads TO 4;
```

---

## 3. 第一部分：Object — 万物皆对象

### 3.1 元模型设计

在 Ontology 中，Object 有两层含义：
- **Object Type**：类型定义（如 "Employee"、"Building"）
- **Object Instance**：某个类型下的具体实体（如 "Employee #42"）

我们用 SQL 同时建模这两层。

```sql
-- ============================================================
-- Schema: 使用 DuckDB 的 SCHEMA 做逻辑隔离
-- ============================================================
CREATE SCHEMA IF NOT EXISTS ontology;

-- ============================================================
-- SEQUENCE: 全局 ID 生成器
-- ============================================================
CREATE SEQUENCE ontology.seq_object_type START 1;
CREATE SEQUENCE ontology.seq_object_instance START 1;
CREATE SEQUENCE ontology.seq_property_def START 1;

-- ============================================================
-- ENUM: 属性值的数据类型枚举
-- ============================================================
CREATE TYPE ontology.property_dtype AS ENUM (
    'STRING', 'INTEGER', 'FLOAT', 'BOOLEAN',
    'DATE', 'TIMESTAMP', 'JSON', 'ARRAY', 'MAP'
);

-- ============================================================
-- TABLE 1: Object Type（元定义）
-- ============================================================
CREATE TABLE ontology.object_type (
    type_id       INTEGER DEFAULT nextval('ontology.seq_object_type') PRIMARY KEY,
    type_name     VARCHAR NOT NULL UNIQUE,          -- e.g. 'Employee'
    description   VARCHAR,
    icon          VARCHAR DEFAULT '📦',
    created_at    TIMESTAMP DEFAULT current_timestamp,
    is_abstract   BOOLEAN DEFAULT FALSE,            -- 是否抽象类型
    parent_type   VARCHAR,                          -- 继承
    tags          VARCHAR[],                         -- DuckDB 原生 LIST 类型
    metadata      MAP(VARCHAR, VARCHAR)              -- DuckDB 原生 MAP 类型
);

-- ============================================================
-- TABLE 2: Property Definition（属性定义，属于某个 Object Type）
-- ============================================================
CREATE TABLE ontology.property_definition (
    prop_id       INTEGER DEFAULT nextval('ontology.seq_property_def') PRIMARY KEY,
    type_name     VARCHAR NOT NULL,                  -- FK → object_type.type_name
    prop_name     VARCHAR NOT NULL,
    prop_dtype    ontology.property_dtype NOT NULL,
    is_primary    BOOLEAN DEFAULT FALSE,             -- 是否主标识
    is_required   BOOLEAN DEFAULT FALSE,
    default_value VARCHAR,
    description   VARCHAR,
    UNIQUE (type_name, prop_name),
    FOREIGN KEY (type_name) REFERENCES ontology.object_type(type_name)
);

-- ============================================================
-- TABLE 3: Object Instance（实例 — 使用 STRUCT + JSON 存储动态属性）
-- ============================================================
CREATE TABLE ontology.object_instance (
    instance_id   INTEGER DEFAULT nextval('ontology.seq_object_instance') PRIMARY KEY,
    type_name     VARCHAR NOT NULL,
    display_name  VARCHAR,
    properties    JSON,                              -- 动态属性，用 JSON 存
    created_at    TIMESTAMP DEFAULT current_timestamp,
    updated_at    TIMESTAMP DEFAULT current_timestamp,
    version       INTEGER DEFAULT 1,                 -- 乐观锁版本号
    FOREIGN KEY (type_name) REFERENCES ontology.object_type(type_name)
);
```

### 3.2 插入元数据：定义 Object Types

```sql
-- 插入 Object Type 定义
INSERT INTO ontology.object_type (type_name, description, icon, is_abstract, parent_type, tags, metadata)
VALUES
    ('ObjectType',    'Meta: 描述所有对象类型的类型',   '🔷', TRUE,  NULL,          ['meta', 'core'],       MAP {'layer': 'meta', 'version': '1.0'}),
    ('LinkType',      'Meta: 描述所有关系类型的类型',   '🔗', TRUE,  NULL,          ['meta', 'core'],       MAP {'layer': 'meta', 'version': '1.0'}),
    ('StateType',     'Meta: 描述所有状态类型的类型',   '🔄', TRUE,  NULL,          ['meta', 'core'],       MAP {'layer': 'meta', 'version': '1.0'}),
    ('ActionType',    'Meta: 描述所有行为类型的类型',   '⚡', TRUE,  NULL,          ['meta', 'core'],       MAP {'layer': 'meta', 'version': '1.0'}),
    ('Employee',      '业务示例: 员工',               '👤', FALSE, 'ObjectType',  ['business', 'hr'],     MAP {'layer': 'business', 'domain': 'HR'}),
    ('Department',    '业务示例: 部门',               '🏢', FALSE, 'ObjectType',  ['business', 'hr'],     MAP {'layer': 'business', 'domain': 'HR'}),
    ('Project',       '业务示例: 项目',               '📋', FALSE, 'ObjectType',  ['business', 'pm'],     MAP {'layer': 'business', 'domain': 'PM'}),
    ('Ticket',        '业务示例: 工单',               '🎫', FALSE, 'ObjectType',  ['business', 'ops'],    MAP {'layer': 'business', 'domain': 'OPS'});

-- 定义属性
INSERT INTO ontology.property_definition (type_name, prop_name, prop_dtype, is_primary, is_required, description)
VALUES
    -- Employee 属性
    ('Employee', 'emp_id',     'STRING',    TRUE,  TRUE,  '工号'),
    ('Employee', 'name',       'STRING',    FALSE, TRUE,  '姓名'),
    ('Employee', 'hire_date',  'DATE',      FALSE, FALSE, '入职日期'),
    ('Employee', 'salary',     'FLOAT',     FALSE, FALSE, '薪资'),
    ('Employee', 'is_active',  'BOOLEAN',   FALSE, FALSE, '是否在职'),
    -- Department 属性
    ('Department', 'dept_id',   'STRING',   TRUE,  TRUE,  '部门编号'),
    ('Department', 'dept_name', 'STRING',   FALSE, TRUE,  '部门名称'),
    -- Project 属性
    ('Project', 'proj_id',     'STRING',    TRUE,  TRUE,  '项目编号'),
    ('Project', 'proj_name',   'STRING',    FALSE, TRUE,  '项目名称'),
    ('Project', 'budget',      'FLOAT',     FALSE, FALSE, '预算'),
    -- Ticket 属性
    ('Ticket', 'ticket_id',    'STRING',    TRUE,  TRUE,  '工单号'),
    ('Ticket', 'title',        'STRING',    FALSE, TRUE,  '标题'),
    ('Ticket', 'priority',     'INTEGER',   FALSE, FALSE, '优先级 1-5');
```

### 3.3 插入实例数据

```sql
-- Employee 实例（使用 DuckDB JSON 构造）
INSERT INTO ontology.object_instance (type_name, display_name, properties)
VALUES
    ('Employee', 'Alice',   '{"emp_id":"E001","name":"Alice","hire_date":"2020-03-15","salary":95000,"is_active":true}'),
    ('Employee', 'Bob',     '{"emp_id":"E002","name":"Bob","hire_date":"2019-07-01","salary":105000,"is_active":true}'),
    ('Employee', 'Charlie', '{"emp_id":"E003","name":"Charlie","hire_date":"2021-01-10","salary":82000,"is_active":false}'),
    ('Employee', 'Diana',   '{"emp_id":"E004","name":"Diana","hire_date":"2022-06-20","salary":78000,"is_active":true}'),
    ('Employee', 'Eve',     '{"emp_id":"E005","name":"Eve","hire_date":"2018-11-05","salary":120000,"is_active":true}');

INSERT INTO ontology.object_instance (type_name, display_name, properties)
VALUES
    ('Department', 'Engineering',  '{"dept_id":"D001","dept_name":"Engineering"}'),
    ('Department', 'Marketing',    '{"dept_id":"D002","dept_name":"Marketing"}'),
    ('Department', 'Operations',   '{"dept_id":"D003","dept_name":"Operations"}');

INSERT INTO ontology.object_instance (type_name, display_name, properties)
VALUES
    ('Project', 'Project Alpha',  '{"proj_id":"P001","proj_name":"Project Alpha","budget":500000}'),
    ('Project', 'Project Beta',   '{"proj_id":"P002","proj_name":"Project Beta","budget":300000}');

INSERT INTO ontology.object_instance (type_name, display_name, properties)
VALUES
    ('Ticket', 'Fix login bug',       '{"ticket_id":"T001","title":"Fix login bug","priority":1}'),
    ('Ticket', 'Update dashboard',    '{"ticket_id":"T002","title":"Update dashboard","priority":3}'),
    ('Ticket', 'DB migration',        '{"ticket_id":"T003","title":"DB migration","priority":2}');
```

### 3.4 查询：理解 Object

```sql
-- 查看所有 Object Type 及其属性数量
SELECT
    ot.icon,
    ot.type_name,
    ot.is_abstract,
    ot.parent_type,
    ot.tags,
    COUNT(pd.prop_id) AS prop_count
FROM ontology.object_type ot
LEFT JOIN ontology.property_definition pd USING (type_name)
GROUP BY ALL
ORDER BY ot.type_id;

-- 用 JSON 提取函数查询 Employee 实例的结构化字段
SELECT
    instance_id,
    display_name,
    properties->>'emp_id'    AS emp_id,
    properties->>'name'      AS name,
    CAST(properties->>'salary' AS FLOAT) AS salary,
    CAST(properties->>'is_active' AS BOOLEAN) AS is_active
FROM ontology.object_instance
WHERE type_name = 'Employee'
ORDER BY salary DESC;
```

> **核心洞察**：Object = Type 定义 + Property Schema + 实例集合。Ontology 的 Object 不仅仅是一张表，它是**自描述**的 — 类型定义本身也是 Object。

---

## 4. 第二部分：Link — 关系即结构

### 4.1 元模型设计

Link 有三个层次：
- **Link Type**：关系类型定义（如 "belongs_to"、"assigned_to"）
- **Link Instance**：两个 Object Instance 之间的具体关系
- **Link 的基数约束**：one-to-one / one-to-many / many-to-many

```sql
CREATE SEQUENCE ontology.seq_link_type START 1;
CREATE SEQUENCE ontology.seq_link_instance START 1;

-- ============================================================
-- ENUM: 关系基数
-- ============================================================
CREATE TYPE ontology.cardinality AS ENUM (
    'ONE_TO_ONE', 'ONE_TO_MANY', 'MANY_TO_ONE', 'MANY_TO_MANY'
);

-- ============================================================
-- TABLE 4: Link Type（关系类型定义）
-- ============================================================
CREATE TABLE ontology.link_type (
    link_type_id    INTEGER DEFAULT nextval('ontology.seq_link_type') PRIMARY KEY,
    link_name       VARCHAR NOT NULL UNIQUE,          -- e.g. 'belongs_to'
    from_type       VARCHAR NOT NULL,                 -- 源 Object Type
    to_type         VARCHAR NOT NULL,                 -- 目标 Object Type
    cardinality     ontology.cardinality NOT NULL,
    is_directed     BOOLEAN DEFAULT TRUE,             -- 有向/无向
    reverse_name    VARCHAR,                          -- 反向名称
    description     VARCHAR,
    properties      JSON,                             -- Link 自身可携带属性
    FOREIGN KEY (from_type) REFERENCES ontology.object_type(type_name),
    FOREIGN KEY (to_type) REFERENCES ontology.object_type(type_name)
);

-- ============================================================
-- TABLE 5: Link Instance（关系实例）
-- ============================================================
CREATE TABLE ontology.link_instance (
    link_id         INTEGER DEFAULT nextval('ontology.seq_link_instance') PRIMARY KEY,
    link_name       VARCHAR NOT NULL,
    from_instance   INTEGER NOT NULL,
    to_instance     INTEGER NOT NULL,
    properties      JSON,                             -- 关系上的属性（如 role, weight）
    created_at      TIMESTAMP DEFAULT current_timestamp,
    valid_from      TIMESTAMP DEFAULT current_timestamp,
    valid_to        TIMESTAMP,                        -- NULL = 当前有效
    FOREIGN KEY (link_name) REFERENCES ontology.link_type(link_name),
    FOREIGN KEY (from_instance) REFERENCES ontology.object_instance(instance_id),
    FOREIGN KEY (to_instance) REFERENCES ontology.object_instance(instance_id),
    -- 防止重复关系
    UNIQUE (link_name, from_instance, to_instance, valid_from)
);
```

### 4.2 定义 Link Types 并创建实例

```sql
-- 定义关系类型
INSERT INTO ontology.link_type (link_name, from_type, to_type, cardinality, is_directed, reverse_name, description)
VALUES
    ('belongs_to_dept',  'Employee',   'Department', 'MANY_TO_ONE',  TRUE, 'has_member',      '员工所属部门'),
    ('manages',          'Employee',   'Department', 'ONE_TO_ONE',   TRUE, 'managed_by',      '员工管理部门'),
    ('works_on',         'Employee',   'Project',    'MANY_TO_MANY', TRUE, 'has_worker',      '员工参与项目'),
    ('assigned_ticket',  'Employee',   'Ticket',     'ONE_TO_MANY',  TRUE, 'assigned_to',     '员工被分配工单'),
    ('dept_owns_proj',   'Department', 'Project',    'ONE_TO_MANY',  TRUE, 'owned_by_dept',   '部门拥有项目'),
    ('ticket_in_proj',   'Ticket',     'Project',    'MANY_TO_ONE',  TRUE, 'has_ticket',      '工单属于项目');

-- 创建关系实例（通过子查询获取 instance_id）
-- Alice(1), Bob(2), Charlie(3), Diana(4), Eve(5)
-- Engineering(6), Marketing(7), Operations(8)
-- Project Alpha(9), Project Beta(10)
-- Ticket T001(11), T002(12), T003(13)

INSERT INTO ontology.link_instance (link_name, from_instance, to_instance, properties)
VALUES
    -- 员工归属部门
    ('belongs_to_dept', 1, 6, '{"since":"2020-03"}'),   -- Alice → Engineering
    ('belongs_to_dept', 2, 6, '{"since":"2019-07"}'),   -- Bob → Engineering
    ('belongs_to_dept', 3, 7, '{"since":"2021-01"}'),   -- Charlie → Marketing
    ('belongs_to_dept', 4, 8, '{"since":"2022-06"}'),   -- Diana → Operations
    ('belongs_to_dept', 5, 6, '{"since":"2018-11"}'),   -- Eve → Engineering
    -- 部门经理
    ('manages', 5, 6, NULL),                             -- Eve manages Engineering
    ('manages', 3, 7, NULL),                             -- Charlie manages Marketing
    -- 项目参与
    ('works_on', 1, 9, '{"role":"developer"}'),          -- Alice → Alpha
    ('works_on', 2, 9, '{"role":"lead"}'),               -- Bob → Alpha
    ('works_on', 2, 10, '{"role":"reviewer"}'),          -- Bob → Beta
    ('works_on', 4, 10, '{"role":"developer"}'),         -- Diana → Beta
    -- 工单分配
    ('assigned_ticket', 1, 11, NULL),                    -- Alice ← T001
    ('assigned_ticket', 2, 12, NULL),                    -- Bob ← T002
    ('assigned_ticket', 1, 13, NULL),                    -- Alice ← T003
    -- 工单属于项目
    ('ticket_in_proj', 11, 9, NULL),                     -- T001 → Alpha
    ('ticket_in_proj', 12, 9, NULL),                     -- T002 → Alpha
    ('ticket_in_proj', 13, 10, NULL),                    -- T003 → Beta
    -- 部门拥有项目
    ('dept_owns_proj', 6, 9, NULL),                      -- Engineering → Alpha
    ('dept_owns_proj', 8, 10, NULL);                     -- Operations → Beta
```

### 4.3 查询：理解 Link

```sql
-- 查看所有 Link Type 定义
SELECT
    '🔗' AS icon,
    link_name,
    from_type || ' → ' || to_type AS direction,
    cardinality,
    reverse_name
FROM ontology.link_type;

-- 图遍历：从 Alice 出发，找到她所有的直接关系
SELECT
    'Alice' AS from_entity,
    li.link_name AS relationship,
    oi.display_name AS to_entity,
    oi.type_name AS to_type,
    li.properties->>'role' AS role_on_link
FROM ontology.link_instance li
JOIN ontology.object_instance oi ON li.to_instance = oi.instance_id
WHERE li.from_instance = 1
ORDER BY li.link_name;

-- 反向遍历：谁在 Engineering 部门？（利用 reverse_name 语义）
SELECT
    oi.display_name AS employee,
    li.properties->>'since' AS joined_since
FROM ontology.link_instance li
JOIN ontology.object_instance oi ON li.from_instance = oi.instance_id
WHERE li.link_name = 'belongs_to_dept'
  AND li.to_instance = (
      SELECT instance_id FROM ontology.object_instance
      WHERE display_name = 'Engineering'
  );

-- 多跳查询：Employee → Department → Project (2-hop)
SELECT DISTINCT
    e.display_name AS employee,
    d.display_name AS department,
    p.display_name AS project
FROM ontology.link_instance l1
JOIN ontology.object_instance e ON l1.from_instance = e.instance_id
JOIN ontology.object_instance d ON l1.to_instance = d.instance_id
JOIN ontology.link_instance l2 ON l2.from_instance = d.instance_id
JOIN ontology.object_instance p ON l2.to_instance = p.instance_id
WHERE l1.link_name = 'belongs_to_dept'
  AND l2.link_name = 'dept_owns_proj'
ORDER BY employee;
```

> **核心洞察**：Link = 有类型的边 + 自身属性 + 基数约束 + 双向语义。它不仅仅是外键，它是**一等公民**。

---

## 5. 第三部分：State — 状态即生命周期

### 5.1 元模型设计

State 描述 Object Instance 在时间轴上的离散阶段。

```sql
CREATE SEQUENCE ontology.seq_state_type START 1;
CREATE SEQUENCE ontology.seq_state_history START 1;

-- ============================================================
-- TABLE 6: State Type（状态类型定义 — 绑定到 Object Type）
-- ============================================================
CREATE TABLE ontology.state_type (
    state_type_id  INTEGER DEFAULT nextval('ontology.seq_state_type') PRIMARY KEY,
    object_type    VARCHAR NOT NULL,                  -- 哪个 Object Type 拥有这组状态
    state_name     VARCHAR NOT NULL,                  -- e.g. 'OPEN'
    ordinal        INTEGER NOT NULL,                  -- 状态排序（生命周期位置）
    is_initial     BOOLEAN DEFAULT FALSE,
    is_terminal    BOOLEAN DEFAULT FALSE,
    color          VARCHAR DEFAULT '#888888',          -- 可视化颜色
    description    VARCHAR,
    UNIQUE (object_type, state_name),
    FOREIGN KEY (object_type) REFERENCES ontology.object_type(type_name)
);

-- ============================================================
-- TABLE 7: State Transition Rule（允许的状态转换）
-- ============================================================
CREATE TABLE ontology.state_transition_rule (
    rule_id        INTEGER PRIMARY KEY,
    object_type    VARCHAR NOT NULL,
    from_state     VARCHAR NOT NULL,
    to_state       VARCHAR NOT NULL,
    guard_expr     VARCHAR,                           -- 转换守卫条件（表达式）
    description    VARCHAR,
    UNIQUE (object_type, from_state, to_state)
);

-- ============================================================
-- TABLE 8: State History（状态变更历史 — 时间序列）
-- ============================================================
CREATE TABLE ontology.state_history (
    history_id     INTEGER DEFAULT nextval('ontology.seq_state_history') PRIMARY KEY,
    instance_id    INTEGER NOT NULL,
    from_state     VARCHAR,                           -- NULL = 初始创建
    to_state       VARCHAR NOT NULL,
    changed_at     TIMESTAMP DEFAULT current_timestamp,
    changed_by     VARCHAR DEFAULT 'system',
    reason         VARCHAR,
    action_ref     INTEGER,                           -- 关联触发此变更的 Action
    FOREIGN KEY (instance_id) REFERENCES ontology.object_instance(instance_id)
);
```

### 5.2 定义状态机

```sql
-- Ticket 的状态集合
INSERT INTO ontology.state_type (object_type, state_name, ordinal, is_initial, is_terminal, color, description)
VALUES
    ('Ticket', 'DRAFT',       0, TRUE,  FALSE, '#CCCCCC', '草稿'),
    ('Ticket', 'OPEN',        1, FALSE, FALSE, '#3498DB', '已开启'),
    ('Ticket', 'IN_PROGRESS', 2, FALSE, FALSE, '#F39C12', '进行中'),
    ('Ticket', 'IN_REVIEW',   3, FALSE, FALSE, '#9B59B6', '审核中'),
    ('Ticket', 'RESOLVED',    4, FALSE, FALSE, '#2ECC71', '已解决'),
    ('Ticket', 'CLOSED',      5, FALSE, TRUE,  '#1ABC9C', '已关闭'),
    ('Ticket', 'CANCELLED',   6, FALSE, TRUE,  '#E74C3C', '已取消');

-- Employee 的状态集合
INSERT INTO ontology.state_type (object_type, state_name, ordinal, is_initial, is_terminal, color, description)
VALUES
    ('Employee', 'ONBOARDING',  0, TRUE,  FALSE, '#3498DB', '入职中'),
    ('Employee', 'ACTIVE',      1, FALSE, FALSE, '#2ECC71', '在职'),
    ('Employee', 'ON_LEAVE',    2, FALSE, FALSE, '#F39C12', '休假'),
    ('Employee', 'OFFBOARDING', 3, FALSE, FALSE, '#E67E22', '离职中'),
    ('Employee', 'TERMINATED',  4, FALSE, TRUE,  '#E74C3C', '已离职');

-- 状态转换规则
INSERT INTO ontology.state_transition_rule VALUES
    -- Ticket 的转换规则
    (1,  'Ticket', 'DRAFT',       'OPEN',        NULL, '提交工单'),
    (2,  'Ticket', 'DRAFT',       'CANCELLED',   NULL, '取消草稿'),
    (3,  'Ticket', 'OPEN',        'IN_PROGRESS', NULL, '开始处理'),
    (4,  'Ticket', 'OPEN',        'CANCELLED',   NULL, '取消工单'),
    (5,  'Ticket', 'IN_PROGRESS', 'IN_REVIEW',   NULL, '提交审核'),
    (6,  'Ticket', 'IN_PROGRESS', 'OPEN',        NULL, '退回重开'),
    (7,  'Ticket', 'IN_REVIEW',   'RESOLVED',    NULL, '审核通过'),
    (8,  'Ticket', 'IN_REVIEW',   'IN_PROGRESS', NULL, '打回修改'),
    (9,  'Ticket', 'RESOLVED',    'CLOSED',      NULL, '确认关闭'),
    (10, 'Ticket', 'RESOLVED',    'OPEN',        NULL, '重新打开'),
    -- Employee 的转换规则
    (11, 'Employee', 'ONBOARDING',  'ACTIVE',      NULL, '入职完成'),
    (12, 'Employee', 'ACTIVE',      'ON_LEAVE',    NULL, '开始休假'),
    (13, 'Employee', 'ON_LEAVE',    'ACTIVE',      NULL, '休假结束'),
    (14, 'Employee', 'ACTIVE',      'OFFBOARDING', 'tenure > 0', '申请离职'),
    (15, 'Employee', 'OFFBOARDING', 'TERMINATED',  NULL, '离职完成');
```

### 5.3 记录状态历史

```sql
-- Ticket T001 (instance_id=11) 的状态流转
INSERT INTO ontology.state_history (instance_id, from_state, to_state, changed_at, changed_by, reason)
VALUES
    (11, NULL,          'DRAFT',       '2024-01-10 09:00:00', 'alice',  '创建工单'),
    (11, 'DRAFT',       'OPEN',        '2024-01-10 09:15:00', 'alice',  '提交'),
    (11, 'OPEN',        'IN_PROGRESS', '2024-01-10 10:00:00', 'alice',  '开始修复'),
    (11, 'IN_PROGRESS', 'IN_REVIEW',   '2024-01-11 16:00:00', 'alice',  '修复完成，提交 review'),
    (11, 'IN_REVIEW',   'RESOLVED',    '2024-01-12 11:00:00', 'bob',    'Code review 通过');

-- Ticket T002 (instance_id=12)
INSERT INTO ontology.state_history (instance_id, from_state, to_state, changed_at, changed_by, reason)
VALUES
    (12, NULL,          'DRAFT',       '2024-01-11 08:00:00', 'bob',    '创建'),
    (12, 'DRAFT',       'OPEN',        '2024-01-11 08:30:00', 'bob',    '提交'),
    (12, 'OPEN',        'IN_PROGRESS', '2024-01-12 09:00:00', 'bob',    '开始开发');

-- Employee Alice (instance_id=1)
INSERT INTO ontology.state_history (instance_id, from_state, to_state, changed_at, changed_by, reason)
VALUES
    (1, NULL,          'ONBOARDING', '2020-03-01 09:00:00', 'hr_system', '入职流程启动'),
    (1, 'ONBOARDING',  'ACTIVE',    '2020-03-15 09:00:00', 'hr_system', '入职完成'),
    (1, 'ACTIVE',      'ON_LEAVE',  '2024-07-01 00:00:00', 'alice',     '年假'),
    (1, 'ON_LEAVE',    'ACTIVE',    '2024-07-15 00:00:00', 'alice',     '休假结束');
```

### 5.4 查询：理解 State

```sql
-- 查看 Ticket 的状态机定义（生命周期图）
SELECT
    st.state_name,
    st.ordinal,
    CASE WHEN st.is_initial THEN '→ START' ELSE '' END AS start_marker,
    CASE WHEN st.is_terminal THEN 'END ■' ELSE '' END AS end_marker,
    st.color,
    LIST(str.to_state ORDER BY str.to_state) AS can_transition_to
FROM ontology.state_type st
LEFT JOIN ontology.state_transition_rule str
    ON st.object_type = str.object_type AND st.state_name = str.from_state
WHERE st.object_type = 'Ticket'
GROUP BY ALL
ORDER BY st.ordinal;

-- 查看 T001 的完整状态时间线
SELECT
    sh.changed_at,
    COALESCE(sh.from_state, '(none)') AS from_state,
    '→' AS arrow,
    sh.to_state,
    sh.changed_by,
    sh.reason,
    -- 计算在每个状态停留时长
    COALESCE(
        LEAD(sh.changed_at) OVER (ORDER BY sh.changed_at) - sh.changed_at,
        INTERVAL '0' SECOND
    ) AS duration_in_state
FROM ontology.state_history sh
WHERE sh.instance_id = 11
ORDER BY sh.changed_at;

-- 所有实例的当前状态（取每个 instance 最新的 state）
SELECT
    oi.type_name,
    oi.display_name,
    sh.to_state AS current_state,
    sh.changed_at AS since
FROM ontology.state_history sh
JOIN ontology.object_instance oi ON sh.instance_id = oi.instance_id
QUALIFY ROW_NUMBER() OVER (
    PARTITION BY sh.instance_id
    ORDER BY sh.changed_at DESC
) = 1
ORDER BY oi.type_name, oi.display_name;
```

> **核心洞察**：State = 有限状态集 + 转换规则 + 时序历史。它让 Object 有了**生命周期**，而不仅仅是静态属性包。

---

## 6. 第四部分：Action — 行为即变迁

### 6.1 元模型设计

Action 是唯一能改变 Object 状态和 Link 关系的操作。它连接了前三个概念。

```sql
CREATE SEQUENCE ontology.seq_action_type START 1;
CREATE SEQUENCE ontology.seq_action_log START 1;

-- ============================================================
-- ENUM: Action 操作类别
-- ============================================================
CREATE TYPE ontology.action_category AS ENUM (
    'CREATE',           -- 创建 Object
    'UPDATE',           -- 修改 Object 属性
    'DELETE',           -- 删除 Object
    'STATE_CHANGE',     -- 状态转换
    'LINK_CREATE',      -- 创建关系
    'LINK_DELETE',      -- 删除关系
    'COMPOSITE'         -- 组合操作
);

-- ============================================================
-- TABLE 9: Action Type（行为类型定义）
-- ============================================================
CREATE TABLE ontology.action_type (
    action_type_id  INTEGER DEFAULT nextval('ontology.seq_action_type') PRIMARY KEY,
    action_name     VARCHAR NOT NULL UNIQUE,
    category        ontology.action_category NOT NULL,
    target_type     VARCHAR NOT NULL,                 -- 作用于哪个 Object Type
    description     VARCHAR,
    preconditions   JSON,                             -- 前置条件（声明式）
    effects         JSON,                             -- 效果描述（声明式）
    parameters      JSON,                             -- 参数签名
    requires_auth   BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (target_type) REFERENCES ontology.object_type(type_name)
);

-- ============================================================
-- TABLE 10: Action Log（行为执行日志 — 完整审计）
-- ============================================================
CREATE TABLE ontology.action_log (
    log_id          INTEGER DEFAULT nextval('ontology.seq_action_log') PRIMARY KEY,
    action_name     VARCHAR NOT NULL,
    executed_at     TIMESTAMP DEFAULT current_timestamp,
    executed_by     VARCHAR NOT NULL,
    target_instance INTEGER,                          -- 作用的 Object Instance
    parameters      JSON,                             -- 实际传入的参数
    result          VARCHAR DEFAULT 'SUCCESS',        -- SUCCESS / FAILED / ROLLED_BACK
    error_message   VARCHAR,
    before_snapshot JSON,                             -- 执行前快照
    after_snapshot  JSON,                             -- 执行后快照
    duration_ms     INTEGER,                          -- 执行耗时
    FOREIGN KEY (action_name) REFERENCES ontology.action_type(action_name),
    FOREIGN KEY (target_instance) REFERENCES ontology.object_instance(instance_id)
);
```

### 6.2 定义 Action Types

```sql
INSERT INTO ontology.action_type (action_name, category, target_type, description, preconditions, effects, parameters, requires_auth)
VALUES
    ('create_ticket',     'CREATE',       'Ticket',   '创建新工单',
     '{}',
     '{"state": "DRAFT"}',
     '{"title": "STRING", "priority": "INTEGER", "project_id": "STRING"}',
     FALSE),

    ('submit_ticket',     'STATE_CHANGE', 'Ticket',   '提交工单（DRAFT→OPEN）',
     '{"current_state": "DRAFT"}',
     '{"new_state": "OPEN"}',
     '{}',
     FALSE),

    ('start_work',        'STATE_CHANGE', 'Ticket',   '开始处理（OPEN→IN_PROGRESS）',
     '{"current_state": "OPEN", "has_assignee": true}',
     '{"new_state": "IN_PROGRESS"}',
     '{}',
     FALSE),

    ('submit_review',     'STATE_CHANGE', 'Ticket',   '提交审核（IN_PROGRESS→IN_REVIEW）',
     '{"current_state": "IN_PROGRESS"}',
     '{"new_state": "IN_REVIEW"}',
     '{"review_notes": "STRING"}',
     FALSE),

    ('approve_ticket',    'STATE_CHANGE', 'Ticket',   '审核通过（IN_REVIEW→RESOLVED）',
     '{"current_state": "IN_REVIEW"}',
     '{"new_state": "RESOLVED"}',
     '{}',
     TRUE),

    ('close_ticket',      'STATE_CHANGE', 'Ticket',   '关闭工单（RESOLVED→CLOSED）',
     '{"current_state": "RESOLVED"}',
     '{"new_state": "CLOSED"}',
     '{}',
     FALSE),

    ('assign_ticket',     'COMPOSITE',    'Ticket',   '分配工单给员工（创建 Link + 可能变更状态）',
     '{}',
     '{"link": "assigned_ticket"}',
     '{"employee_id": "INTEGER"}',
     FALSE),

    ('transfer_dept',     'COMPOSITE',    'Employee', '员工调岗（删除旧 Link + 创建新 Link）',
     '{"current_state": "ACTIVE"}',
     '{"old_link_delete": "belongs_to_dept", "new_link_create": "belongs_to_dept"}',
     '{"new_dept_id": "INTEGER"}',
     TRUE),

    ('update_salary',     'UPDATE',       'Employee', '调整薪资',
     '{"current_state": "ACTIVE"}',
     '{"field": "salary"}',
     '{"new_salary": "FLOAT", "reason": "STRING"}',
     TRUE),

    ('onboard_employee',  'COMPOSITE',    'Employee', '完成入职（状态变更 + 部门关系建立）',
     '{"current_state": "ONBOARDING"}',
     '{"new_state": "ACTIVE", "link": "belongs_to_dept"}',
     '{"dept_id": "INTEGER"}',
     TRUE);
```

### 6.3 模拟执行 Action 并记录日志

```sql
-- 模拟：Alice 创建并提交了 T001
INSERT INTO ontology.action_log (action_name, executed_at, executed_by, target_instance, parameters, result, before_snapshot, after_snapshot, duration_ms)
VALUES
    ('create_ticket',  '2024-01-10 09:00:00', 'alice', 11,
     '{"title":"Fix login bug","priority":1,"project_id":"P001"}',
     'SUCCESS', NULL, '{"state":"DRAFT","title":"Fix login bug"}', 45),

    ('submit_ticket',  '2024-01-10 09:15:00', 'alice', 11,
     '{}',
     'SUCCESS', '{"state":"DRAFT"}', '{"state":"OPEN"}', 12),

    ('assign_ticket',  '2024-01-10 09:20:00', 'system', 11,
     '{"employee_id":1}',
     'SUCCESS', '{"assignee":null}', '{"assignee":"Alice"}', 30),

    ('start_work',     '2024-01-10 10:00:00', 'alice', 11,
     '{}',
     'SUCCESS', '{"state":"OPEN"}', '{"state":"IN_PROGRESS"}', 8),

    ('submit_review',  '2024-01-11 16:00:00', 'alice', 11,
     '{"review_notes":"Fixed auth token refresh"}',
     'SUCCESS', '{"state":"IN_PROGRESS"}', '{"state":"IN_REVIEW"}', 15),

    ('approve_ticket', '2024-01-12 11:00:00', 'bob', 11,
     '{}',
     'SUCCESS', '{"state":"IN_REVIEW"}', '{"state":"RESOLVED"}', 10),

    -- 模拟一个失败的 Action
    ('update_salary',  '2024-01-15 14:00:00', 'diana', 1,
     '{"new_salary":100000,"reason":"promotion"}',
     'FAILED', NULL, NULL, 5),

    -- 成功的薪资更新
    ('update_salary',  '2024-01-15 14:05:00', 'eve', 1,
     '{"new_salary":100000,"reason":"promotion"}',
     'SUCCESS', '{"salary":95000}', '{"salary":100000}', 22);
```

### 6.4 查询：理解 Action

```sql
-- 查看所有 Action Type 及其分类分布
SELECT
    category,
    COUNT(*) AS count,
    LIST(action_name) AS actions
FROM ontology.action_type
GROUP BY category
ORDER BY category;

-- T001 的完整 Action 时间线（审计追踪）
SELECT
    al.executed_at,
    al.action_name,
    at.category,
    al.executed_by,
    al.result,
    al.before_snapshot->>'state' AS state_before,
    al.after_snapshot->>'state'  AS state_after,
    al.duration_ms || 'ms' AS duration,
    al.parameters
FROM ontology.action_log al
JOIN ontology.action_type at ON al.action_name = at.action_name
WHERE al.target_instance = 11
ORDER BY al.executed_at;

-- 统计：各操作者的行为分布
SELECT
    executed_by,
    COUNT(*) AS total_actions,
    COUNT(*) FILTER (WHERE result = 'SUCCESS') AS successes,
    COUNT(*) FILTER (WHERE result = 'FAILED') AS failures,
    ROUND(AVG(duration_ms), 1) AS avg_duration_ms
FROM ontology.action_log
GROUP BY executed_by
ORDER BY total_actions DESC;
```

> **核心洞察**：Action = 参数化操作 + 前置条件 + 效果声明 + 审计日志。它是 Ontology 中**唯一合法的变更入口**，确保所有变化可追溯。

---

## 7. 第五部分：四元协作 — 完整运转

现在把四个概念联合起来，展示它们如何协同工作。

### 7.1 全景视图：某个 Object 的完整上下文

```sql
-- 完整上下文查询：给定一个 Object Instance，展示其所有维度
WITH target AS (SELECT 11 AS id), -- T001: Fix login bug

-- 基本信息
obj AS (
    SELECT * FROM ontology.object_instance WHERE instance_id = (SELECT id FROM target)
),

-- 当前状态
current_state AS (
    SELECT to_state, changed_at
    FROM ontology.state_history
    WHERE instance_id = (SELECT id FROM target)
    ORDER BY changed_at DESC
    LIMIT 1
),

-- 所有关系
relationships AS (
    SELECT
        li.link_name,
        CASE WHEN li.from_instance = (SELECT id FROM target)
             THEN 'outgoing' ELSE 'incoming' END AS direction,
        CASE WHEN li.from_instance = (SELECT id FROM target)
             THEN oi2.display_name ELSE oi1.display_name END AS related_entity,
        li.properties AS link_props
    FROM ontology.link_instance li
    JOIN ontology.object_instance oi1 ON li.from_instance = oi1.instance_id
    JOIN ontology.object_instance oi2 ON li.to_instance = oi2.instance_id
    WHERE li.from_instance = (SELECT id FROM target)
       OR li.to_instance = (SELECT id FROM target)
),

-- 最近的 Actions
recent_actions AS (
    SELECT action_name, executed_at, executed_by, result
    FROM ontology.action_log
    WHERE target_instance = (SELECT id FROM target)
    ORDER BY executed_at DESC
    LIMIT 5
)

SELECT '📦 OBJECT' AS section, obj.type_name || ': ' || obj.display_name AS detail, NULL AS extra
FROM obj
UNION ALL
SELECT '🔄 STATE', cs.to_state || ' (since ' || cs.changed_at::VARCHAR || ')', NULL
FROM current_state cs
UNION ALL
SELECT '🔗 LINK', r.direction || ': ' || r.link_name || ' → ' || r.related_entity, r.link_props::VARCHAR
FROM relationships r
UNION ALL
SELECT '⚡ ACTION', ra.action_name || ' by ' || ra.executed_by || ' [' || ra.result || ']', ra.executed_at::VARCHAR
FROM recent_actions ra;
```

### 7.2 元模型自引用：Ontology 描述自身

```sql
-- 元层面：有多少 Object Type？每个有几个属性、几种状态、几种 Action？
SELECT
    ot.icon,
    ot.type_name,
    (SELECT COUNT(*) FROM ontology.property_definition pd WHERE pd.type_name = ot.type_name) AS properties,
    (SELECT COUNT(*) FROM ontology.state_type st WHERE st.object_type = ot.type_name) AS states,
    (SELECT COUNT(*) FROM ontology.action_type at WHERE at.target_type = ot.type_name) AS actions,
    (SELECT COUNT(*) FROM ontology.link_type lt
     WHERE lt.from_type = ot.type_name OR lt.to_type = ot.type_name) AS link_types,
    (SELECT COUNT(*) FROM ontology.object_instance oi WHERE oi.type_name = ot.type_name) AS instances
FROM ontology.object_type ot
WHERE NOT ot.is_abstract
ORDER BY ot.type_name;
```

### 7.3 验证：状态转换合法性检查

```sql
-- 检查：是否存在历史中出现了非法的状态转换
SELECT
    sh.history_id,
    oi.display_name,
    sh.from_state,
    sh.to_state,
    CASE WHEN str.rule_id IS NOT NULL THEN '✅ VALID' ELSE '❌ INVALID' END AS validity
FROM ontology.state_history sh
JOIN ontology.object_instance oi ON sh.instance_id = oi.instance_id
LEFT JOIN ontology.state_transition_rule str
    ON str.object_type = oi.type_name
    AND str.from_state = sh.from_state
    AND str.to_state = sh.to_state
WHERE sh.from_state IS NOT NULL  -- 排除初始创建
ORDER BY sh.changed_at;
```

---

## 8. 第六部分：DuckDB 全能力覆盖

以下按 MECE 原则，确保覆盖 DuckDB 所支持的各类操作。

### 8.1 DDL（已覆盖于上文）

```sql
-- 汇总已使用的 DDL
-- ✅ CREATE SCHEMA
-- ✅ CREATE TABLE (含约束: PK, FK, UNIQUE, DEFAULT)
-- ✅ CREATE SEQUENCE
-- ✅ CREATE TYPE (ENUM)
-- ✅ 复合类型: VARCHAR[], MAP(K,V), JSON, STRUCT

-- 补充：ALTER TABLE
ALTER TABLE ontology.object_type ADD COLUMN visibility VARCHAR DEFAULT 'PUBLIC';

-- 补充：CREATE VIEW
CREATE VIEW ontology.v_current_states AS
SELECT
    oi.instance_id,
    oi.type_name,
    oi.display_name,
    sh.to_state AS current_state,
    sh.changed_at AS state_since
FROM ontology.state_history sh
JOIN ontology.object_instance oi ON sh.instance_id = oi.instance_id
QUALIFY ROW_NUMBER() OVER (PARTITION BY sh.instance_id ORDER BY sh.changed_at DESC) = 1;

-- 补充：CREATE TEMPORARY TABLE
CREATE TEMPORARY TABLE tmp_analysis AS
SELECT type_name, COUNT(*) AS cnt FROM ontology.object_instance GROUP BY type_name;

-- 补充：CREATE MACRO (标量)
CREATE MACRO ontology.is_terminal_state(obj_type, state) AS (
    EXISTS (
        SELECT 1 FROM ontology.state_type
        WHERE object_type = obj_type AND state_name = state AND is_terminal
    )
);

-- 补充：CREATE TABLE MACRO (表函数)
CREATE MACRO ontology.get_instances(t) AS TABLE
    SELECT * FROM ontology.object_instance WHERE type_name = t;

-- 补充：DROP
DROP TABLE IF EXISTS tmp_analysis;
```

### 8.2 DML

```sql
-- ✅ INSERT (已大量使用)

-- ✅ UPDATE
UPDATE ontology.object_instance
SET properties = json_merge_patch(properties, '{"salary": 100000}'),
    updated_at = current_timestamp,
    version = version + 1
WHERE instance_id = 1;

-- ✅ DELETE
DELETE FROM ontology.action_log WHERE result = 'FAILED';

-- ✅ UPSERT (INSERT OR REPLACE / ON CONFLICT)
INSERT INTO ontology.object_type (type_name, description, icon)
VALUES ('Employee', '业务示例: 员工（更新版）', '👤')
ON CONFLICT (type_name) DO UPDATE SET description = EXCLUDED.description;

-- ✅ INSERT FROM SELECT
INSERT INTO ontology.state_history (instance_id, from_state, to_state, changed_at, changed_by, reason)
SELECT
    12, 'IN_PROGRESS', 'IN_REVIEW', '2024-01-13 10:00:00', 'bob', '模拟批量插入'
FROM (SELECT 1);
```

### 8.3 窗口函数（Window Functions）

```sql
-- ROW_NUMBER: 已在 current_state 查询中使用

-- RANK / DENSE_RANK: 按薪资排名
SELECT
    display_name,
    CAST(properties->>'salary' AS FLOAT) AS salary,
    RANK() OVER (ORDER BY CAST(properties->>'salary' AS FLOAT) DESC) AS salary_rank,
    DENSE_RANK() OVER (ORDER BY CAST(properties->>'salary' AS FLOAT) DESC) AS dense_rank,
    NTILE(3) OVER (ORDER BY CAST(properties->>'salary' AS FLOAT) DESC) AS salary_tier
FROM ontology.object_instance
WHERE type_name = 'Employee';

-- LAG / LEAD: 状态变更的前后对比
SELECT
    changed_at,
    to_state,
    LAG(to_state) OVER (ORDER BY changed_at) AS prev_state,
    LEAD(to_state) OVER (ORDER BY changed_at) AS next_state,
    changed_at - LAG(changed_at) OVER (ORDER BY changed_at) AS time_in_prev_state
FROM ontology.state_history
WHERE instance_id = 11;

-- FIRST_VALUE / LAST_VALUE
SELECT DISTINCT
    instance_id,
    FIRST_VALUE(to_state) OVER w AS initial_state,
    LAST_VALUE(to_state) OVER w AS latest_state,
    COUNT(*) OVER w AS total_transitions
FROM ontology.state_history
WINDOW w AS (
    PARTITION BY instance_id
    ORDER BY changed_at
    ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
);

-- 累积统计：Action 执行的累计计数
SELECT
    executed_at::DATE AS action_date,
    action_name,
    COUNT(*) AS daily_count,
    SUM(COUNT(*)) OVER (ORDER BY executed_at::DATE) AS cumulative_total
FROM ontology.action_log
GROUP BY action_date, action_name
ORDER BY action_date;
```

### 8.4 聚合函数

```sql
-- 基础聚合
SELECT
    type_name,
    COUNT(*) AS instance_count,
    MIN(created_at) AS earliest,
    MAX(created_at) AS latest
FROM ontology.object_instance
GROUP BY type_name;

-- LIST / STRING_AGG: 聚合为列表
SELECT
    object_type,
    LIST(state_name ORDER BY ordinal) AS state_lifecycle,
    STRING_AGG(state_name, ' → ' ORDER BY ordinal) AS lifecycle_path
FROM ontology.state_type
GROUP BY object_type;

-- FILTER 子句
SELECT
    executed_by,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE result = 'SUCCESS') AS ok,
    COUNT(*) FILTER (WHERE result = 'FAILED') AS fail,
    AVG(duration_ms) FILTER (WHERE result = 'SUCCESS') AS avg_ok_ms
FROM ontology.action_log
GROUP BY executed_by;

-- GROUPING SETS / ROLLUP / CUBE
SELECT
    COALESCE(at.category::VARCHAR, '== ALL ==') AS category,
    COALESCE(al.result, '== ALL ==') AS result,
    COUNT(*) AS cnt
FROM ontology.action_log al
JOIN ontology.action_type at ON al.action_name = at.action_name
GROUP BY CUBE(at.category, al.result)
ORDER BY category, result;
```

### 8.5 CTE、递归查询、子查询

```sql
-- ✅ 普通 CTE（已大量使用）

-- ✅ 递归 CTE：沿 parent_type 遍历 Object Type 的继承树
WITH RECURSIVE type_hierarchy AS (
    -- 基础：根节点（没有 parent）
    SELECT
        type_name,
        parent_type,
        0 AS depth,
        type_name AS root,
        [type_name] AS path
    FROM ontology.object_type
    WHERE parent_type IS NULL

    UNION ALL

    -- 递归：子类型
    SELECT
        ot.type_name,
        ot.parent_type,
        th.depth + 1,
        th.root,
        list_append(th.path, ot.type_name)
    FROM ontology.object_type ot
    JOIN type_hierarchy th ON ot.parent_type = th.type_name
)
SELECT
    REPEAT('  ', depth) || icon || ' ' || type_name AS tree,
    depth,
    parent_type,
    path
FROM type_hierarchy th
JOIN ontology.object_type ot USING (type_name)
ORDER BY path;

-- ✅ 相关子查询（已在 7.2 中使用）

-- ✅ EXISTS / NOT EXISTS
SELECT type_name, 'has_states' AS info
FROM ontology.object_type ot
WHERE EXISTS (
    SELECT 1 FROM ontology.state_type st WHERE st.object_type = ot.type_name
);

-- ✅ IN / NOT IN
SELECT display_name
FROM ontology.object_instance
WHERE type_name IN (
    SELECT from_type FROM ontology.link_type WHERE link_name = 'works_on'
);
```

### 8.6 JOIN 全类型

```sql
-- ✅ INNER JOIN（已大量使用）

-- ✅ LEFT JOIN: 所有 Object Type，包括没有实例的
SELECT ot.type_name, COUNT(oi.instance_id) AS instances
FROM ontology.object_type ot
LEFT JOIN ontology.object_instance oi USING (type_name)
GROUP BY ot.type_name;

-- ✅ RIGHT JOIN (等价写法，DuckDB 支持)
SELECT oi.display_name, ot.icon
FROM ontology.object_type ot
RIGHT JOIN ontology.object_instance oi USING (type_name);

-- ✅ FULL OUTER JOIN: 哪些 Action Type 从未执行过？
SELECT
    at.action_name,
    COALESCE(COUNT(al.log_id), 0) AS times_executed
FROM ontology.action_type at
FULL OUTER JOIN ontology.action_log al USING (action_name)
GROUP BY at.action_name
ORDER BY times_executed;

-- ✅ CROSS JOIN: 为验证完整性，每个 Object Type × 每种 Action Category
SELECT ot.type_name, unnest(['CREATE','UPDATE','DELETE','STATE_CHANGE','LINK_CREATE','LINK_DELETE','COMPOSITE']) AS category
FROM ontology.object_type ot
WHERE NOT ot.is_abstract;

-- ✅ SEMI JOIN (用 WHERE EXISTS 实现)
-- 已在 8.5 中展示

-- ✅ ANTI JOIN: 没有任何关系的 Object Instance
SELECT oi.display_name, oi.type_name
FROM ontology.object_instance oi
WHERE NOT EXISTS (
    SELECT 1 FROM ontology.link_instance li
    WHERE li.from_instance = oi.instance_id OR li.to_instance = oi.instance_id
);

-- ✅ LATERAL JOIN: 每个 Object Type 的最新 3 个实例
SELECT ot.type_name, latest.*
FROM ontology.object_type ot,
LATERAL (
    SELECT display_name, created_at
    FROM ontology.object_instance oi
    WHERE oi.type_name = ot.type_name
    ORDER BY oi.created_at DESC
    LIMIT 3
) latest
WHERE NOT ot.is_abstract;

-- ✅ NATURAL JOIN
SELECT * FROM ontology.object_type NATURAL JOIN ontology.property_definition LIMIT 5;

-- ✅ POSITIONAL JOIN (DuckDB 特有 —— 按行位置对齐)
SELECT *
FROM (SELECT type_name FROM ontology.object_type WHERE NOT is_abstract ORDER BY type_name LIMIT 4)
POSITIONAL JOIN
(SELECT COUNT(*) AS inst_count FROM ontology.object_instance GROUP BY type_name ORDER BY type_name LIMIT 4);

-- ✅ ASOF JOIN: 模拟 "某时刻的状态"
-- 给定一组时间点，找到每个时间点对应的最新状态
CREATE TEMPORARY TABLE query_times AS
SELECT unnest([
    TIMESTAMP '2024-01-10 09:10:00',
    TIMESTAMP '2024-01-10 12:00:00',
    TIMESTAMP '2024-01-11 17:00:00',
    TIMESTAMP '2024-01-12 12:00:00'
]) AS query_time;

SELECT qt.query_time, sh.to_state AS state_at_time
FROM query_times qt
ASOF JOIN (
    SELECT changed_at, to_state FROM ontology.state_history WHERE instance_id = 11
) sh ON qt.query_time >= sh.changed_at
ORDER BY qt.query_time;

DROP TABLE query_times;
```

### 8.7 集合运算

```sql
-- ✅ UNION ALL (已使用于全景视图)

-- ✅ UNION (去重)
SELECT type_name AS entity FROM ontology.object_type WHERE is_abstract
UNION
SELECT type_name FROM ontology.object_type WHERE NOT is_abstract;

-- ✅ INTERSECT: 既有状态定义又有 Action 定义的 Object Type
SELECT object_type AS type_name FROM ontology.state_type
INTERSECT
SELECT target_type FROM ontology.action_type;

-- ✅ EXCEPT: 有 Object 定义但没有状态定义的类型
SELECT type_name FROM ontology.object_type WHERE NOT is_abstract
EXCEPT
SELECT DISTINCT object_type FROM ontology.state_type;
```

### 8.8 高级数据类型操作

```sql
-- ✅ LIST / ARRAY 操作
SELECT
    type_name,
    tags,
    list_contains(tags, 'core') AS is_core,
    list_filter(tags, x -> x != 'meta') AS non_meta_tags,
    list_transform(tags, x -> upper(x)) AS upper_tags,
    len(tags) AS tag_count
FROM ontology.object_type
WHERE tags IS NOT NULL;

-- ✅ MAP 操作
SELECT
    type_name,
    metadata,
    map_keys(metadata) AS keys,
    map_values(metadata) AS vals,
    metadata['layer'] AS layer,
    map_contains(metadata, 'domain') AS has_domain
FROM ontology.object_type
WHERE metadata IS NOT NULL;

-- ✅ STRUCT 操作
SELECT
    instance_id,
    {'name': display_name, 'type': type_name, 'version': version} AS obj_struct
FROM ontology.object_instance
LIMIT 3;

-- ✅ JSON 操作（深度使用）
SELECT
    display_name,
    json_keys(properties) AS all_keys,
    json_type(properties) AS jtype,
    json_extract_string(properties, '$.name') AS name_via_path,
    json_array_length('[1,2,3]'::JSON) AS demo_array_len
FROM ontology.object_instance
WHERE type_name = 'Employee'
LIMIT 3;

-- ✅ UNNEST: 展开 LIST / MAP
SELECT
    ot.type_name,
    unnest(ot.tags) AS tag
FROM ontology.object_type ot
WHERE ot.tags IS NOT NULL;
```

### 8.9 日期 / 时间函数

```sql
SELECT
    changed_at,
    date_part('year', changed_at) AS year,
    date_part('month', changed_at) AS month,
    date_part('dow', changed_at) AS day_of_week,
    date_trunc('hour', changed_at) AS truncated,
    changed_at + INTERVAL '7 days' AS plus_7_days,
    age(current_timestamp, changed_at) AS time_ago,
    strftime(changed_at, '%Y-%m-%d %H:%M') AS formatted
FROM ontology.state_history
LIMIT 5;
```

### 8.10 字符串函数

```sql
SELECT
    type_name,
    upper(type_name) AS upper_name,
    lower(type_name) AS lower_name,
    length(type_name) AS name_len,
    left(type_name, 3) AS prefix,
    replace(type_name, 'Type', '') AS cleaned,
    regexp_extract(type_name, '([A-Z][a-z]+)', 1) AS first_word,
    format('{} has {} chars', type_name, length(type_name)) AS msg,
    starts_with(type_name, 'Object') AS starts_obj,
    contains(type_name, 'Link') AS has_link
FROM ontology.object_type;

-- LIKE / ILIKE
SELECT * FROM ontology.object_type WHERE type_name ILIKE '%type%';

-- regexp_matches
SELECT * FROM ontology.object_type WHERE regexp_matches(type_name, '^[A-Z][a-z]+$');
```

### 8.11 CASE / COALESCE / CAST / TRY_CAST

```sql
SELECT
    display_name,
    type_name,
    CASE type_name
        WHEN 'Employee'   THEN '👤 人员'
        WHEN 'Department' THEN '🏢 部门'
        WHEN 'Project'    THEN '📋 项目'
        WHEN 'Ticket'     THEN '🎫 工单'
        ELSE '❓ 未知'
    END AS chinese_type,
    COALESCE(properties->>'priority', 'N/A') AS priority,
    TRY_CAST(properties->>'salary' AS INTEGER) AS salary_int,
    CAST(version AS VARCHAR) || '.0' AS version_str,
    NULLIF(properties->>'priority', '') AS nullable_priority,
    typeof(properties) AS properties_type
FROM ontology.object_instance;
```

### 8.12 PIVOT / UNPIVOT（DuckDB 特有）

```sql
-- ✅ PIVOT: 每个 Object Type 在各状态下有多少实例
PIVOT (
    SELECT vcs.type_name, vcs.current_state, COUNT(*) AS cnt
    FROM ontology.v_current_states vcs
    GROUP BY ALL
)
ON current_state
USING SUM(cnt)
GROUP BY type_name;

-- ✅ UNPIVOT: 把 state_type 的布尔列展开
SELECT * FROM (
    SELECT state_name, is_initial, is_terminal FROM ontology.state_type WHERE object_type = 'Ticket'
)
UNPIVOT (flag_value FOR flag_name IN (is_initial, is_terminal))
WHERE flag_value = TRUE;
```

### 8.13 GENERATE_SERIES / 表生成函数

```sql
-- 生成时间维度表
SELECT
    ts AS time_slot,
    date_part('hour', ts) AS hour,
    CASE WHEN date_part('dow', ts) IN (0, 6) THEN 'weekend' ELSE 'weekday' END AS day_type
FROM generate_series(
    TIMESTAMP '2024-01-10', TIMESTAMP '2024-01-13', INTERVAL '6 hours'
) t(ts);

-- 生成序号
SELECT unnest(generate_series(1, 10)) AS n;

-- range 函数
SELECT unnest(range(0, 100, 10)) AS decile;
```

### 8.14 导出 / 导入（文件 I/O）

```sql
-- ✅ 导出为 CSV
COPY ontology.object_type TO '/tmp/object_types.csv' (HEADER, DELIMITER ',');

-- ✅ 导出为 Parquet
COPY ontology.object_instance TO '/tmp/instances.parquet' (FORMAT PARQUET, COMPRESSION ZSTD);

-- ✅ 导出为 JSON
COPY (SELECT * FROM ontology.link_type) TO '/tmp/link_types.json' (FORMAT JSON, ARRAY TRUE);

-- ✅ 从 CSV 读取
-- CREATE TABLE test AS SELECT * FROM read_csv_auto('/tmp/object_types.csv');

-- ✅ 从 Parquet 读取
-- SELECT * FROM read_parquet('/tmp/instances.parquet');

-- ✅ 直接查询远程文件 (示例语法)
-- SELECT * FROM read_parquet('s3://bucket/path/data.parquet');

-- ✅ ATTACH 另一个 DuckDB 数据库
-- ATTACH 'other.db' AS other_db;

-- ✅ 导出整个数据库
EXPORT DATABASE '/tmp/ontology_backup' (FORMAT PARQUET);
-- IMPORT DATABASE '/tmp/ontology_backup';
```

### 8.15 EXPLAIN / PRAGMA / 系统函数

```sql
-- ✅ 执行计划
EXPLAIN
SELECT oi.display_name, COUNT(li.link_id)
FROM ontology.object_instance oi
LEFT JOIN ontology.link_instance li ON oi.instance_id = li.from_instance
GROUP BY oi.display_name;

-- ✅ EXPLAIN ANALYZE（实际执行并收集统计）
EXPLAIN ANALYZE
SELECT * FROM ontology.state_history WHERE instance_id = 11;

-- ✅ 系统表查询
SELECT table_name, estimated_size, column_count
FROM duckdb_tables()
WHERE schema_name = 'ontology';

SELECT column_name, data_type, is_nullable
FROM duckdb_columns()
WHERE schema_name = 'ontology' AND table_name = 'object_type';

-- ✅ 数据库大小
SELECT * FROM pragma_database_size();

-- ✅ 表信息
PRAGMA table_info('ontology.object_type');

-- ✅ 列表所有设置
SELECT * FROM duckdb_settings() WHERE name LIKE '%memory%';
```

### 8.16 事务控制

```sql
-- ✅ 事务（DuckDB 支持 ACID）
BEGIN TRANSACTION;

-- 模拟一个 Composite Action: 调岗
-- Step 1: 标记旧关系无效
UPDATE ontology.link_instance
SET valid_to = current_timestamp
WHERE link_name = 'belongs_to_dept'
  AND from_instance = 4      -- Diana
  AND valid_to IS NULL;

-- Step 2: 创建新关系
INSERT INTO ontology.link_instance (link_name, from_instance, to_instance, properties, valid_from)
VALUES ('belongs_to_dept', 4, 6, '{"since":"2024-02"}', current_timestamp);

-- Step 3: 记录日志
INSERT INTO ontology.action_log (action_name, executed_by, target_instance, parameters, result, duration_ms)
VALUES ('transfer_dept', 'hr_admin', 4, '{"new_dept_id":6}', 'SUCCESS', 55);

COMMIT;

-- ✅ ROLLBACK 示例
BEGIN TRANSACTION;
DELETE FROM ontology.object_instance WHERE type_name = 'Employee';
-- 哎呀! 回滚!
ROLLBACK;
-- 数据安全
SELECT COUNT(*) FROM ontology.object_instance WHERE type_name = 'Employee';
```

### 8.17 SAMPLE / TABLESAMPLE

```sql
-- ✅ 随机采样
SELECT * FROM ontology.object_instance USING SAMPLE 50%;
SELECT * FROM ontology.object_instance TABLESAMPLE reservoir(3);
```

### 8.18 QUALIFY（DuckDB 特有简洁语法）

```sql
-- 已在 current_state 视图中使用
-- 再举一例：每种类型保留最新创建的一个实例
SELECT type_name, display_name, created_at
FROM ontology.object_instance
QUALIFY ROW_NUMBER() OVER (PARTITION BY type_name ORDER BY created_at DESC) = 1;
```

### 8.19 EXCLUDE / REPLACE / COLUMNS（SELECT 增强）

```sql
-- ✅ EXCLUDE: 排除某些列
SELECT * EXCLUDE (metadata, tags, visibility) FROM ontology.object_type;

-- ✅ REPLACE: 替换列表达式
SELECT * REPLACE (upper(type_name) AS type_name) FROM ontology.object_type;

-- ✅ COLUMNS: 正则选列
SELECT COLUMNS('.*name.*') FROM ontology.object_type;

-- ✅ COLUMNS + 表达式
SELECT MIN(COLUMNS(* EXCLUDE (type_id))) FROM ontology.object_type;
```

### 8.20 Lambda 函数 + List Comprehension

```sql
SELECT
    type_name,
    tags,
    -- Lambda: 过滤
    list_filter(tags, t -> length(t) > 3) AS long_tags,
    -- Lambda: 转换
    list_transform(tags, t -> t || '!') AS excited_tags,
    -- Lambda: 排序
    list_sort(tags) AS sorted_tags,
    -- Lambda: 聚合
    list_reduce(tags, (a, b) -> a || '+' || b) AS concatenated,
    -- List comprehension 风格
    [upper(t) FOR t IN tags IF length(t) >= 4] AS filtered_upper
FROM ontology.object_type
WHERE tags IS NOT NULL AND len(tags) > 0;
```

### 8.21 索引 与 约束

```sql
-- ✅ 创建索引（DuckDB 使用 ART 索引）
CREATE INDEX idx_instance_type ON ontology.object_instance(type_name);
CREATE INDEX idx_link_from ON ontology.link_instance(from_instance);
CREATE INDEX idx_link_to ON ontology.link_instance(to_instance);
CREATE INDEX idx_state_history_inst ON ontology.state_history(instance_id, changed_at);

-- ✅ CHECK 约束（补充展示）
ALTER TABLE ontology.state_type ADD CONSTRAINT chk_ordinal CHECK (ordinal >= 0);
```

---

## 9. 第七部分：复用到任意业务场景

元模型的价值在于：**一次建模，无限实例化**。

### 9.1 通用实例化流程

```
业务场景                 元模型操作
─────────            ─────────
识别实体       →      INSERT INTO object_type
定义属性       →      INSERT INTO property_definition
识别关系       →      INSERT INTO link_type
设计状态机     →      INSERT INTO state_type + state_transition_rule
定义操作       →      INSERT INTO action_type
灌入数据       →      INSERT INTO object_instance + link_instance
运行业务       →      INSERT INTO action_log + state_history
```

### 9.2 示例：30 秒实例化一个供应链场景

```sql
-- 只需 INSERT，无需建新表
INSERT INTO ontology.object_type (type_name, description, icon, tags, metadata)
VALUES
    ('Warehouse',    '仓库',     '🏭', ['supply_chain'], MAP {'domain': 'SCM'}),
    ('Product',      '产品',     '📦', ['supply_chain'], MAP {'domain': 'SCM'}),
    ('Shipment',     '运单',     '🚛', ['supply_chain'], MAP {'domain': 'SCM'});

INSERT INTO ontology.link_type (link_name, from_type, to_type, cardinality, reverse_name, description)
VALUES
    ('stored_in',    'Product',  'Warehouse', 'MANY_TO_MANY', 'stores',       '产品存放于仓库'),
    ('shipped_from', 'Shipment', 'Warehouse', 'MANY_TO_ONE',  'sends',        '运单发出仓库'),
    ('contains',     'Shipment', 'Product',   'ONE_TO_MANY',  'shipped_via',  '运单包含产品');

INSERT INTO ontology.state_type (object_type, state_name, ordinal, is_initial, is_terminal)
VALUES
    ('Shipment', 'PREPARING', 0, TRUE,  FALSE),
    ('Shipment', 'IN_TRANSIT', 1, FALSE, FALSE),
    ('Shipment', 'DELIVERED',  2, FALSE, TRUE),
    ('Shipment', 'RETURNED',   3, FALSE, TRUE);

-- 验证：新业务场景已就绪
SELECT type_name, tags FROM ontology.object_type WHERE tags IS NOT NULL AND list_contains(tags, 'supply_chain');
```

### 9.3 跨场景分析：Ontology 的 Ontology

```sql
-- 跨所有业务域的元统计
SELECT
    COALESCE(metadata['domain'], 'META') AS domain,
    COUNT(DISTINCT ot.type_name) AS object_types,
    COUNT(DISTINCT lt.link_name) AS link_types,
    COUNT(DISTINCT st.state_name) AS state_types,
    COUNT(DISTINCT act.action_name) AS action_types
FROM ontology.object_type ot
LEFT JOIN ontology.link_type lt ON (lt.from_type = ot.type_name OR lt.to_type = ot.type_name)
LEFT JOIN ontology.state_type st ON st.object_type = ot.type_name
LEFT JOIN ontology.action_type act ON act.target_type = ot.type_name
WHERE NOT ot.is_abstract
GROUP BY domain
ORDER BY domain;
```

---

## 10. 附录：MECE 能力清单

以下清单确认本教程覆盖了 DuckDB 的所有主要操作类别：

| # | 能力类别 | 具体操作 | 章节 |
|---|---------|---------|------|
| 1 | **DDL** | CREATE TABLE/VIEW/SCHEMA/SEQUENCE/TYPE/MACRO/INDEX, ALTER, DROP | §3, §8.1, §8.21 |
| 2 | **DML** | INSERT, UPDATE, DELETE, UPSERT (ON CONFLICT) | §3-6, §8.2 |
| 3 | **查询基础** | SELECT, WHERE, ORDER BY, LIMIT, OFFSET, DISTINCT | 全文 |
| 4 | **JOIN** | INNER, LEFT, RIGHT, FULL OUTER, CROSS, LATERAL, NATURAL, POSITIONAL, ASOF, SEMI, ANTI | §8.6 |
| 5 | **集合运算** | UNION, UNION ALL, INTERSECT, EXCEPT | §8.7 |
| 6 | **聚合** | COUNT, SUM, AVG, MIN, MAX, LIST, STRING_AGG, FILTER, GROUP BY, HAVING | §8.4 |
| 7 | **分组增强** | GROUPING SETS, ROLLUP, CUBE | §8.4 |
| 8 | **窗口函数** | ROW_NUMBER, RANK, DENSE_RANK, NTILE, LAG, LEAD, FIRST_VALUE, LAST_VALUE, 窗口帧 | §8.3 |
| 9 | **CTE** | WITH, 递归 CTE (WITH RECURSIVE) | §8.5 |
| 10 | **子查询** | 标量子查询, EXISTS, IN, NOT EXISTS, NOT IN, 相关子查询 | §8.5 |
| 11 | **条件表达式** | CASE, COALESCE, NULLIF, CAST, TRY_CAST, typeof | §8.11 |
| 12 | **复合类型** | LIST/ARRAY, MAP, STRUCT, JSON, ENUM | §3, §8.8 |
| 13 | **Lambda/List** | list_filter, list_transform, list_reduce, list comprehension | §8.20 |
| 14 | **日期时间** | date_part, date_trunc, age, strftime, INTERVAL, generate_series | §8.9, §8.13 |
| 15 | **字符串** | upper/lower, length, replace, regexp_extract, format, LIKE, ILIKE | §8.10 |
| 16 | **PIVOT/UNPIVOT** | PIVOT ON...USING, UNPIVOT...IN | §8.12 |
| 17 | **QUALIFY** | 窗口函数后过滤 | §8.18 |
| 18 | **SELECT 增强** | EXCLUDE, REPLACE, COLUMNS, COLUMNS 正则 | §8.19 |
| 19 | **采样** | SAMPLE, TABLESAMPLE, reservoir | §8.17 |
| 20 | **生成函数** | generate_series, range, unnest | §8.13 |
| 21 | **文件 I/O** | COPY TO/FROM, read_csv_auto, read_parquet, EXPORT/IMPORT DATABASE | §8.14 |
| 22 | **事务** | BEGIN, COMMIT, ROLLBACK | §8.16 |
| 23 | **执行计划** | EXPLAIN, EXPLAIN ANALYZE | §8.15 |
| 24 | **系统元数据** | duckdb_tables(), duckdb_columns(), pragma_database_size, PRAGMA | §8.15 |
| 25 | **MACRO** | CREATE MACRO (标量), CREATE MACRO...AS TABLE | §8.1 |
| 26 | **ATTACH** | 多数据库 | §8.14 |
| 27 | **JSON 函数** | json_extract, ->>, json_keys, json_type, json_merge_patch, json_array_length | §8.2, §8.8 |
| 28 | **索引/约束** | CREATE INDEX, PK, FK, UNIQUE, CHECK, DEFAULT | §3, §8.21 |
| 29 | **临时表** | CREATE TEMPORARY TABLE | §8.1 |
| 30 | **设置/配置** | SET, PRAGMA, duckdb_settings() | §2, §8.15 |

---

## 最终总结

```
┌─────────────────────────────────────────────────────────┐
│                   ONTOLOGY META-MODEL                    │
│                                                         │
│   ┌──────────┐    Link     ┌──────────┐                │
│   │  Object  │◆───────────▶│  Object  │                │
│   │  (Type + │             │  (Type + │                │
│   │Instance) │             │Instance) │                │
│   └────┬─────┘             └────┬─────┘                │
│        │                        │                       │
│   has State                has State                    │
│        │                        │                       │
│   ┌────▼─────┐             ┌────▼─────┐                │
│   │  State   │             │  State   │                │
│   │(Machine +│             │(Machine +│                │
│   │ History) │             │ History) │                │
│   └────┬─────┘             └────┬─────┘                │
│        │                        │                       │
│        └──────── Action ────────┘                       │
│                 (触发状态变迁,                            │
│                  创建/删除关系,                           │
│                  修改属性,                               │
│                  完整审计)                               │
└─────────────────────────────────────────────────────────┘

  Object 定义"是什么"
  Link   定义"什么关系"
  State  定义"在哪个阶段"
  Action 定义"怎么变化"
  
  四者协同 = 完整的企业本体论
```

将本教程的 SQL 从头到尾粘贴进 `duckdb` CLI，你将获得一个完全自描述的 Ontology 元数据库。在此基础上，只需 INSERT 新的 Type 定义，即可将任何业务域纳入同一套元模型管理。