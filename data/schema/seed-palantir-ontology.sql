-- ============================================================
-- Palantir 风格本体论数据模型 — 最小可用集
-- 用途：验证 SQL 编辑器、本体导入、查询和知识图谱可视化
--
-- 数据结构（6 类核心 + 1 层抽象层级）：
--   1. ont_object_type      对象类型定义
--   2. ont_object            对象实例
--   3. ont_property_type     属性类型定义
--   4. ont_property_instance  属性实例（对象 × 属性 = 属性值）
--   5. ont_relation_type     关系类型定义
--   6. ont_relation_instance 关系实例
--   7. ont_action            行动
--   8. ont_event            事件
--   9. ont_state            状态变迁记录
--   10. taxonomy_tag         三级标签层级（抽象 / 分类）
--   11. taxonomy_tagged      标签挂载关联
-- ============================================================

-- ============================================
-- 1. 对象类型表
-- ============================================
CREATE TABLE IF NOT EXISTS ont_object_type (
    id INTEGER PRIMARY KEY,
    name VARCHAR NOT NULL,
    description VARCHAR,
    abstraction_level VARCHAR DEFAULT 'instance'
);

INSERT INTO ont_object_type VALUES
    (1, 'Person',   '组织成员',                    'instance'),
    (2, 'System',   '系统 / 数字资产',              'instance'),
    (3, 'Document', '文档 / 产出物',                 'instance'),
    (4, 'Workflow', '业务流程 / 工作流',             'instance');

-- ============================================
-- 2. 对象实例表
-- ============================================
CREATE TABLE IF NOT EXISTS ont_object (
    id INTEGER PRIMARY KEY,
    object_type_id INTEGER REFERENCES ont_object_type(id),
    name VARCHAR NOT NULL,
    description VARCHAR,
    status VARCHAR DEFAULT 'active',
    metadata JSON DEFAULT '{}'
);

INSERT INTO ont_object VALUES
    (1,  1, '张明',   '前端工程师，3 年经验',                                              'active',   '{}'),
    (2,  1, '李娜',   '后端工程师，专注分布式系统',                                          'active',   '{}'),
    (3,  1, '王强',   '技术负责人，架构委员会成员',                                          'active',   '{}'),
    (4,  2, '用户中心', '统一身份认证与权限管理系统，支撑全公司 SSO',                        'active',   '{"version": "3.2", "sla": "99.9%"}'),
    (5,  2, '数据仓库', 'ClickHouse OLAP 数据仓库，承载报表与 Ad-hoc 查询',                  'active',   '{"version": "2.1", "sla": "99.5%"}'),
    (6,  2, 'API网关', 'Kong 网关，统一下游服务入口，提供鉴权、限流、日志',                  'active',   '{"version": "1.8", "sla": "99.95%"}'),
    (7,  3, '需求文档 v3.2',  '2024Q3 产品需求清单，含优先级和预估工时',                    'active',   '{"format": "markdown", "size_kb": 128}'),
    (8,  3, '架构设计文档 v1.0', '微服务拆分方案与服务间通信协议设计',                        'active',   '{"format": "drawio", "size_kb": 512}'),
    (9,  4, '代码审查流程', 'Pull Request 审查规范，含自动化检查与人工 review 要求',          'active',   '{"owner": "王强", "sla_hours": 24}'),
    (10, 4, '发布流程',   '从分支合并到灰度上线的标准化流水线',                               'active',   '{"owner": "王强", "sla_hours": 48}');

-- ============================================
-- 3. 属性类型定义表
-- ============================================
CREATE TABLE IF NOT EXISTS ont_property_type (
    id INTEGER PRIMARY KEY,
    object_type_id INTEGER REFERENCES ont_object_type(id),
    name VARCHAR NOT NULL,
    data_type VARCHAR NOT NULL,
    description VARCHAR
);

INSERT INTO ont_property_type VALUES
    (1,  1, 'email',       'VARCHAR', '工作邮箱地址'),
    (2,  1, 'department',  'VARCHAR', '所属部门'),
    (3,  1, 'level',       'VARCHAR', '职级'),
    (4,  2, 'owner',       'VARCHAR', '负责人'),
    (5,  2, 'tech_stack',  'VARCHAR', '技术栈'),
    (6,  2, 'version',    'VARCHAR', '当前版本号'),
    (7,  3, 'author',      'VARCHAR', '作者'),
    (8,  3, 'file_format', 'VARCHAR', '文件格式'),
    (9,  4, 'process_owner', 'VARCHAR', '流程负责人'),
    (10, 4, 'sla_hours',  'DOUBLE',  'SLA 响应时限（小时）');

-- ============================================
-- 4. 属性实例表（对象 × 属性 = 属性值）
-- ============================================
CREATE TABLE IF NOT EXISTS ont_property_instance (
    id INTEGER PRIMARY KEY,
    object_id INTEGER REFERENCES ont_object(id),
    property_type_id INTEGER REFERENCES ont_property_type(id),
    value VARCHAR NOT NULL,
    effective_date DATE DEFAULT CURRENT_DATE
);

INSERT INTO ont_property_instance VALUES
    (1,  1,  1, 'zhangming@corp.com', '2024-01-01'),
    (2,  1,  2, '前端部',              '2024-01-01'),
    (3,  1,  3, 'P6',                 '2024-01-01'),
    (4,  2,  1, 'lina@corp.com',       '2024-01-01'),
    (5,  2,  2, '后端部',              '2024-01-01'),
    (6,  2,  3, 'P6',                 '2024-01-01'),
    (7,  3,  1, 'wangqiang@corp.com', '2023-06-01'),
    (8,  3,  2, '技术委员会',           '2023-06-01'),
    (9,  3,  3, 'P8',                 '2023-06-01'),
    (10, 4,  4, '王强',                '2024-01-01'),
    (11, 4,  5, 'Spring Boot, Redis, MySQL', '2024-01-01'),
    (12, 4,  6, '3.2',               '2024-06-15'),
    (13, 5,  4, '李娜',               '2024-01-01'),
    (14, 5,  5, 'ClickHouse, Kafka, Airflow', '2024-01-01'),
    (15, 5,  6, '2.1',               '2024-04-01'),
    (16, 6,  4, '张明',               '2024-01-01'),
    (17, 6,  5, 'Kong, Lua, PostgreSQL',   '2024-01-01'),
    (18, 6,  6, '1.8',               '2024-05-01'),
    (19, 7,  7, '刘PM',              '2024-07-01'),
    (20, 7,  8, 'markdown',          '2024-07-01'),
    (21, 8,  7, '王强',              '2024-07-15'),
    (22, 8,  8, 'drawio',           '2024-07-15'),
    (23, 9,  9, '王强',              '2024-01-01'),
    (24, 9,  10, 24.0,              '2024-01-01'),
    (25, 10, 9, '王强',              '2024-01-01'),
    (26, 10, 10, 48.0,              '2024-01-01');

-- ============================================
-- 5. 关系类型定义表
-- ============================================
CREATE TABLE IF NOT EXISTS ont_relation_type (
    id INTEGER PRIMARY KEY,
    name VARCHAR NOT NULL,
    description VARCHAR,
    weightable BOOLEAN DEFAULT TRUE
);

INSERT INTO ont_relation_type VALUES
    (1, 'depends_on',  'A 依赖 B',                         TRUE),
    (2, 'manages',    'A 管理 / 负责 B',                   FALSE),
    (3, 'produces',   'A 产出 B（人 / 系统 → 产出物）',     FALSE),
    (4, 'part_of',    'A 是 B 的一部分（子流程 → 父流程）', FALSE);

-- ============================================
-- 6. 关系实例表
-- ============================================
CREATE TABLE IF NOT EXISTS ont_relation_instance (
    id INTEGER PRIMARY KEY,
    relation_type_id INTEGER REFERENCES ont_relation_type(id),
    source_object_id INTEGER REFERENCES ont_object(id),
    target_object_id INTEGER REFERENCES ont_object(id),
    weight DECIMAL(3,2) DEFAULT 1.0,
    effective_date DATE DEFAULT CURRENT_DATE
);

INSERT INTO ont_relation_instance VALUES
    (1,  1,  5,  4, 0.9,  '2024-01-01'),   -- 数据仓库 依赖 用户中心
    (2,  1,  6,  4, 0.8,  '2024-01-01'),   -- API网关 依赖 用户中心
    (3,  1,  5,  6, 0.7,  '2024-01-01'),   -- 数据仓库 依赖 API网关
    (4,  2,  3,  4, 1.0,  '2024-01-01'),   -- 王强 管理 用户中心
    (5,  2,  3,  5, 0.9,  '2024-01-01'),   -- 王强 管理 数据仓库
    (6,  2,  3,  9, 1.0,  '2024-01-01'),   -- 王强 管理 代码审查流程
    (7,  2,  3, 10, 1.0,  '2024-01-01'),   -- 王强 管理 发布流程
    (8,  3,  3,  8, 1.0,  '2024-01-01'),   -- 王强 产出 架构设计文档
    (9,  3,  2,  7, 0.8,  '2024-01-01'),   -- 李娜 产出 需求文档
    (10, 4,  9, 10, 1.0,  '2024-01-01');   -- 代码审查流程 归属 发布流程

-- ============================================
-- 7. 行动表
-- ============================================
CREATE TABLE IF NOT EXISTS ont_action (
    id INTEGER PRIMARY KEY,
    name VARCHAR NOT NULL,
    description VARCHAR,
    status VARCHAR DEFAULT 'pending',
    priority VARCHAR DEFAULT 'medium',
    assignee VARCHAR,
    planned_date DATE,
    completed_date DATE
);

INSERT INTO ont_action VALUES
    (1, '用户中心升级 v3.3', '升级认证模块至 v3.3，修复会话管理漏洞',       'pending',  'high',   '王强',   '2024-08-15', NULL),
    (2, '数据仓库索引优化',   '为高频报表查询添加覆盖索引，降低 P99 延迟',    'pending',  'medium', '李娜',   '2024-08-20', NULL),
    (3, 'API网关限流规则更新', '新增按用户维度的请求限额，防止突发流量',       'in_progress','high',  '张明',   '2024-08-10', NULL),
    (4, '发布流程文档化',      '将非正式的发布 SOP 整理为标准操作文档',        'done',     'low',    '王强',   '2024-07-01', '2024-07-15');

-- ============================================
-- 8. 事件表
-- ============================================
CREATE TABLE IF NOT EXISTS ont_event (
    id INTEGER PRIMARY KEY,
    object_id INTEGER REFERENCES ont_object(id),
    name VARCHAR NOT NULL,
    event_type VARCHAR NOT NULL,
    description VARCHAR,
    occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    severity VARCHAR DEFAULT 'info'
);

INSERT INTO ont_event VALUES
    (1, 4, '用户中心 v3.2 升级完成',     '版本发布',    '用户中心成功从 v3.1 升级至 v3.2，SSO 登录延迟降低 40%',         '2024-06-15 10:30:00', 'info'),
    (2, 4, '用户中心部署失败告警',         '异常事件',    '部署脚本执行中断，回滚至 v3.1，原因：数据库迁移脚本语法错误',  '2024-06-14 14:22:00', 'error'),
    (3, 5, '数据仓库磁盘使用率告警',       '告警事件',    'ClickHouse 数据盘使用率超过 80%，触发扩容流程',               '2024-07-20 09:15:00', 'warning'),
    (4, 8, '架构设计文档 v1.0 评审通过',  '评审完成',    '微服务拆分方案经技术委员会评审一致通过，进入实施阶段',         '2024-07-25 16:00:00', 'info'),
    (5, 9, '代码审查流程变更发布',        '配置变更',    '新增自动化安全扫描步骤，强制要求 Critical 漏洞清零后才能合并', '2024-08-01 11:00:00', 'info');

-- ============================================
-- 9. 状态变迁记录表
-- ============================================
CREATE TABLE IF NOT EXISTS ont_state (
    id INTEGER PRIMARY KEY,
    object_id INTEGER REFERENCES ont_object(id),
    from_status VARCHAR,
    to_status VARCHAR NOT NULL,
    changed_by VARCHAR,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reason VARCHAR
);

INSERT INTO ont_state VALUES
    (1,  4, 'v3.1',  'v3.2',  '王强', '2024-06-15 10:30:00', '功能升级，修复会话漏洞'),
    (2,  5, NULL,   'planning', '李娜', '2024-07-01 09:00:00', '新版本规划启动'),
    (3,  5, 'planning', 'in_progress', '李娜', '2024-07-15 09:00:00', '开发阶段开始'),
    (4,  6, 'v1.7', 'v1.8',  '张明',  '2024-05-01 18:00:00', '例行版本迭代'),
    (5, 10, NULL,   'active', '王强',  '2024-01-01 09:00:00', '发布流程标准化，SLA 48h');

-- ============================================
-- 10. 三级标签层级表（抽象 / 分类）
-- ============================================
-- Level 1（一级）：最抽象的业务域
-- Level 2（二级）：中层级分类
-- Level 3（三级）：最具体的对象或事件
CREATE TABLE IF NOT EXISTS taxonomy_tag (
    id INTEGER PRIMARY KEY,
    name VARCHAR NOT NULL,
    level INTEGER NOT NULL CHECK (level IN (1, 2, 3)),
    parent_id INTEGER,
    description VARCHAR,
    color VARCHAR DEFAULT '#6b7280'
);

INSERT INTO taxonomy_tag VALUES
    -- 一级标签（业务域）
    (1, '技术资产',        1, NULL, '数字系统和基础设施资产',                              '#6366f1'),
    (2, '业务流程',        1, NULL, '跨团队的工作流程和规范',                              '#10b981'),
    (3, '人员组织',        1, NULL, '组织成员及其职能划分',                                '#f59e0b'),
    -- 二级标签（分类）
    (4, '数据系统',        2, 1,    '数据库、仓库、中间件等数据基础设施',                  '#8b5cf6'),
    (5, '身份认证',        2, 1,    '认证、授权、权限相关系统',                            '#a78bfa'),
    (6, '监控告警',        2, 2,    '系统监控与告警响应流程',                              '#34d399'),
    (7, '代码工程',        2, 2,    '代码开发与审查相关流程',                              '#6ee7b7'),
    (8, '发布运维',        2, 2,    '上线发布与运维保障流程',                              '#a7f3d0'),
    (9, '工程职能',        2, 3,    '工程角色与职级',                                      '#fbbf24'),
    -- 三级标签（具体对象）
    (10, '数据仓库',       3, 4,    'ClickHouse OLAP 数据仓库',                           '#c4b5fd'),
    (11, 'API网关',        3, 5,    'Kong API 网关',                                       '#ddd6fe'),
    (12, '代码审查流程',   3, 7,    'Pull Request 审查规范',                              '#d1fae5'),
    (13, '发布流程',       3, 8,    '灰度上线标准化流水线',                                '#d1fae5'),
    (14, '告警响应',       3, 6,    '监控告警的响应与升级流程',                            '#6ee7b7'),
    (15, '成员记录',       3, 9,    '组织成员个人信息与职能',                              '#fef3c7');

-- ============================================
-- 11. 标签挂载关联表
-- ============================================
CREATE TABLE IF NOT EXISTS taxonomy_tagged (
    tag_id INTEGER,
    object_type_id INTEGER,
    PRIMARY KEY (tag_id, object_type_id)
);

INSERT INTO taxonomy_tagged VALUES
    -- 数据仓库 → 数据系统标签
    (10, 2),
    -- API网关 → 身份认证标签
    (11, 2),
    -- 代码审查流程 → 代码工程标签
    (12, 4),
    -- 发布流程 → 发布运维标签
    (13, 4),
    -- 张明/李娜/王强 → 工程职能标签
    (15, 1);

-- ============================================
-- 验证查询（可直接在 SQL 编辑器执行）
-- ============================================

-- 验证 1：汇总各表数据量
SELECT '本体论数据完整性验证' AS info, COUNT(*) AS row_count FROM ont_object_type
UNION ALL SELECT '对象实例', COUNT(*) FROM ont_object
UNION ALL SELECT '属性类型', COUNT(*) FROM ont_property_type
UNION ALL SELECT '属性实例', COUNT(*) FROM ont_property_instance
UNION ALL SELECT '关系类型', COUNT(*) FROM ont_relation_type
UNION ALL SELECT '关系实例', COUNT(*) FROM ont_relation_instance
UNION ALL SELECT '行动', COUNT(*) FROM ont_action
UNION ALL SELECT '事件', COUNT(*) FROM ont_event
UNION ALL SELECT '状态变迁', COUNT(*) FROM ont_state
UNION ALL SELECT '三级标签', COUNT(*) FROM taxonomy_tag
UNION ALL SELECT '标签挂载', COUNT(*) FROM taxonomy_tagged;

-- 验证 2：查询对象及属性（JOIN 展示属性结构）
SELECT
    ot.name AS 对象类型,
    o.name AS 对象名称,
    o.status AS 状态,
    pt.name AS 属性名,
    pi.value AS 属性值
FROM ont_object o
JOIN ont_object_type ot ON o.object_type_id = ot.id
LEFT JOIN ont_property_instance pi ON pi.object_id = o.id
LEFT JOIN ont_property_type pt ON pi.property_type_id = pt.id
ORDER BY ot.id, o.id, pt.id;

-- 验证 3：查询关系网络（展示完整图谱结构）
SELECT
    rt.name AS 关系类型,
    src.name AS A端,
    tgt.name AS B端,
    ri.weight AS 权重,
    ri.effective_date AS 生效日期
FROM ont_relation_instance ri
JOIN ont_relation_type rt ON ri.relation_type_id = rt.id
JOIN ont_object src ON ri.source_object_id = src.id
JOIN ont_object tgt ON ri.target_object_id = tgt.id
ORDER BY rt.id;

-- 验证 4：查询三级标签层级（展示抽象层级结构）
SELECT
    t.name AS 标签名,
    t.level AS 层级,
    p.name AS 上级标签,
    t.description AS 描述
FROM taxonomy_tag t
LEFT JOIN taxonomy_tag p ON t.parent_id = p.id
ORDER BY t.level, t.id;

-- 验证 5：查询标签挂载（展示对象类型与抽象标签的关联）
SELECT
    tt.name AS 一级分类,
    t2.name AS 二级分类,
    t3.name AS 三级标签,
    ot.name AS 对象类型
FROM taxonomy_tagged tg
JOIN taxonomy_tag t3 ON tg.tag_id = t3.id
JOIN taxonomy_tag t2 ON t3.parent_id = t2.id
JOIN taxonomy_tag tt ON t2.parent_id = tt.id
JOIN ont_object_type ot ON tg.object_type_id = ot.id
ORDER BY tt.id, t2.id, t3.id;
