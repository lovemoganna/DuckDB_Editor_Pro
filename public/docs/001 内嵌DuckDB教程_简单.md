# DuckDB SQL 完整使用教程

## 目录
1. [环境准备](#1-环境准备)
2. [数据库与表操作](#2-数据库与表操作)
3. [增删改查 (CRUD)](#3-增删改查-crud)
4. [连接操作 (JOIN)](#4-连接操作-join)
5. [视图 (VIEW)](#5-视图-view)
6. [事务 (TRANSACTION)](#6-事务-transaction)
7. [高级特性](#7-高级特性)

---

## 1. 环境准备

### 安装 DuckDB

```bash
# Python
pip install duckdb

# Node.js
npm install duckdb

# CLI (macOS)
brew install duckdb
```

### 启动 DuckDB

```bash
# 内存模式（数据不持久化）
duckdb

# 文件模式（数据持久化到文件）
duckdb my_database.db
```

### Python 中使用

```python
import duckdb

# 内存数据库
con = duckdb.connect()

# 持久化数据库
con = duckdb.connect('my_database.db')

# 执行 SQL
con.execute("SELECT 'Hello DuckDB!' AS greeting").fetchall()
```

---

## 2. 数据库与表操作

### 2.1 创建表（CREATE TABLE）

```sql
-- ========================================
-- 创建部门表
-- ========================================
CREATE TABLE departments (
    dept_id     INTEGER PRIMARY KEY,
    dept_name   VARCHAR(50) NOT NULL,
    location    VARCHAR(100),
    budget      DECIMAL(15, 2) DEFAULT 0.00,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- 创建员工表
-- ========================================
CREATE TABLE employees (
    emp_id      INTEGER PRIMARY KEY,
    first_name  VARCHAR(50) NOT NULL,
    last_name   VARCHAR(50) NOT NULL,
    email       VARCHAR(100) UNIQUE,
    phone       VARCHAR(20),
    hire_date   DATE NOT NULL,
    salary      DECIMAL(10, 2),
    dept_id     INTEGER REFERENCES departments(dept_id),
    manager_id  INTEGER REFERENCES employees(emp_id),
    is_active   BOOLEAN DEFAULT TRUE
);

-- ========================================
-- 创建项目表
-- ========================================
CREATE TABLE projects (
    project_id   INTEGER PRIMARY KEY,
    project_name VARCHAR(100) NOT NULL,
    start_date   DATE,
    end_date     DATE,
    status       VARCHAR(20) DEFAULT 'planning',   -- planning/active/completed/cancelled
    dept_id      INTEGER REFERENCES departments(dept_id),
    budget       DECIMAL(12, 2),
    
    -- 表级约束：确保结束日期晚于开始日期
    CHECK (end_date IS NULL OR end_date >= start_date)
);

-- ========================================
-- 创建员工-项目关联表（多对多关系）
-- ========================================
CREATE TABLE employee_projects (
    emp_id      INTEGER REFERENCES employees(emp_id),
    project_id  INTEGER REFERENCES projects(project_id),
    role        VARCHAR(50) DEFAULT 'member',       -- member/lead/reviewer
    join_date   DATE DEFAULT CURRENT_DATE,
    hours_worked DECIMAL(8, 2) DEFAULT 0,
    PRIMARY KEY (emp_id, project_id)
);

-- ========================================
-- 创建工资记录表（用于演示事务）
-- ========================================
CREATE TABLE salary_history (
    history_id   INTEGER PRIMARY KEY,
    emp_id       INTEGER REFERENCES employees(emp_id),
    old_salary   DECIMAL(10, 2),
    new_salary   DECIMAL(10, 2),
    change_date  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    change_reason VARCHAR(200)
);
```

### 2.2 修改表结构（ALTER TABLE）

```sql
-- 添加列
ALTER TABLE employees ADD COLUMN performance_rating INTEGER;

-- 删除列
ALTER TABLE employees DROP COLUMN performance_rating;

-- 重命名表
ALTER TABLE departments RENAME TO dept_backup;
ALTER TABLE dept_backup RENAME TO departments;

-- 重命名列
ALTER TABLE employees RENAME COLUMN phone TO phone_number;
ALTER TABLE employees RENAME COLUMN phone_number TO phone;
```

### 2.3 查看表信息

```sql
-- 查看所有表
SHOW TABLES;

-- 查看表结构
DESCRIBE employees;
-- 或
PRAGMA table_info('employees');

-- 查看建表语句（DuckDB 特有）
SELECT sql FROM duckdb_tables() WHERE table_name = 'employees';
```

### 2.4 删除表（DROP TABLE）

```sql
-- 删除表（不存在时报错）
DROP TABLE table_name;

-- 安全删除（不存在时不报错）
DROP TABLE IF EXISTS table_name;
```

---

## 3. 增删改查 (CRUD)

### 3.1 插入数据（CREATE - INSERT）

```sql
-- ========================================
-- 插入部门数据
-- ========================================
INSERT INTO departments (dept_id, dept_name, location, budget) VALUES
    (1, '技术研发部', '北京-海淀', 5000000.00),
    (2, '市场营销部', '上海-浦东', 3000000.00),
    (3, '人力资源部', '北京-朝阳', 1500000.00),
    (4, '财务部',     '深圳-南山', 2000000.00),
    (5, '产品设计部', '杭州-西湖', 2500000.00);

-- ========================================
-- 插入员工数据
-- ========================================
INSERT INTO employees (emp_id, first_name, last_name, email, phone, hire_date, salary, dept_id, manager_id, is_active) VALUES
    (1,  '明',  '张', 'zhang.ming@company.com',   '13800001001', '2020-03-15', 35000.00, 1, NULL,  TRUE),
    (2,  '丽',  '李', 'li.li@company.com',        '13800001002', '2020-05-20', 30000.00, 1, 1,     TRUE),
    (3,  '强',  '王', 'wang.qiang@company.com',    '13800001003', '2019-08-10', 38000.00, 1, NULL,  TRUE),
    (4,  '芳',  '赵', 'zhao.fang@company.com',     '13800001004', '2021-01-05', 25000.00, 2, NULL,  TRUE),
    (5,  '伟',  '刘', 'liu.wei@company.com',       '13800001005', '2021-06-15', 28000.00, 2, 4,     TRUE),
    (6,  '娜',  '陈', 'chen.na@company.com',       '13800001006', '2020-11-20', 22000.00, 3, NULL,  TRUE),
    (7,  '鹏',  '杨', 'yang.peng@company.com',     '13800001007', '2022-02-28', 20000.00, 3, 6,     TRUE),
    (8,  '雪',  '黄', 'huang.xue@company.com',     '13800001008', '2019-04-12', 32000.00, 4, NULL,  TRUE),
    (9,  '军',  '周', 'zhou.jun@company.com',      '13800001009', '2022-07-01', 26000.00, 1, 1,     TRUE),
    (10, '婷',  '吴', 'wu.ting@company.com',       '13800001010', '2023-01-10', 24000.00, 5, NULL,  TRUE),
    (11, '磊',  '郑', 'zheng.lei@company.com',     '13800001011', '2020-09-05', 29000.00, 5, 10,    TRUE),
    (12, '静',  '孙', 'sun.jing@company.com',      '13800001012', '2023-03-20', 21000.00, 2, 4,     FALSE);

-- ========================================
-- 插入项目数据
-- ========================================
INSERT INTO projects (project_id, project_name, start_date, end_date, status, dept_id, budget) VALUES
    (1, '智能推荐系统 V2.0',     '2024-01-01', '2024-06-30', 'active',    1, 800000.00),
    (2, '品牌升级营销活动',      '2024-02-15', '2024-05-31', 'active',    2, 500000.00),
    (3, '员工培训体系建设',      '2024-03-01', '2024-12-31', 'planning',  3, 200000.00),
    (4, '财务自动化系统',        '2023-06-01', '2024-03-31', 'completed', 4, 600000.00),
    (5, '移动端APP重构',         '2024-04-01', NULL,         'planning',  1, 1000000.00),
    (6, '用户体验优化项目',      '2024-01-15', '2024-08-31', 'active',    5, 350000.00);

-- ========================================
-- 插入员工-项目关联数据
-- ========================================
INSERT INTO employee_projects (emp_id, project_id, role, join_date, hours_worked) VALUES
    (1,  1, 'lead',     '2024-01-01', 320.5),
    (2,  1, 'member',   '2024-01-15', 280.0),
    (3,  1, 'reviewer', '2024-01-01', 45.0),
    (9,  1, 'member',   '2024-02-01', 200.0),
    (4,  2, 'lead',     '2024-02-15', 250.0),
    (5,  2, 'member',   '2024-02-20', 180.0),
    (12, 2, 'member',   '2024-02-20', 30.0),
    (6,  3, 'lead',     '2024-03-01', 60.0),
    (7,  3, 'member',   '2024-03-01', 40.0),
    (8,  4, 'lead',     '2023-06-01', 500.0),
    (3,  5, 'lead',     '2024-04-01', 80.0),
    (1,  5, 'reviewer', '2024-04-01', 20.0),
    (10, 6, 'lead',     '2024-01-15', 200.0),
    (11, 6, 'member',   '2024-01-20', 175.0);

-- ========================================
-- 通过 SELECT 插入（从查询结果插入）
-- ========================================
CREATE TABLE high_salary_employees AS
    SELECT emp_id, first_name, last_name, salary, dept_id
    FROM employees
    WHERE salary > 30000;

-- 查看结果
SELECT * FROM high_salary_employees;

-- 用完清理
DROP TABLE high_salary_employees;
```

### 3.2 查询数据（READ - SELECT）

#### 基础查询

```sql
-- 查询所有列
SELECT * FROM employees;

-- 查询指定列
SELECT emp_id, first_name, last_name, salary
FROM employees;

-- 使用别名
SELECT 
    emp_id        AS 员工编号,
    first_name    AS 名,
    last_name     AS 姓,
    salary        AS 月薪,
    salary * 12   AS 年薪
FROM employees;

-- 去重查询
SELECT DISTINCT dept_id FROM employees;
```

#### WHERE 条件查询

```sql
-- 基本比较
SELECT * FROM employees WHERE salary > 28000;

-- 多条件组合（AND / OR）
SELECT * FROM employees
WHERE dept_id = 1 AND salary > 25000;

SELECT * FROM employees
WHERE dept_id = 1 OR dept_id = 2;

-- IN 操作符
SELECT * FROM employees
WHERE dept_id IN (1, 2, 5);

-- BETWEEN 范围查询
SELECT * FROM employees
WHERE salary BETWEEN 25000 AND 35000;

-- LIKE 模糊查询
SELECT * FROM employees
WHERE email LIKE '%company.com';

SELECT * FROM employees
WHERE first_name LIKE '___';       -- 恰好3个字符（注意中文可能不同）

-- IS NULL / IS NOT NULL
SELECT * FROM employees
WHERE manager_id IS NULL;          -- 查找没有上级的员工（部门主管）

-- NOT 取反
SELECT * FROM employees
WHERE dept_id NOT IN (1, 2);

-- 布尔条件
SELECT * FROM employees
WHERE is_active = TRUE;

-- 日期条件
SELECT * FROM employees
WHERE hire_date >= '2022-01-01';
```

#### 排序与分页

```sql
-- ORDER BY 排序
SELECT * FROM employees
ORDER BY salary DESC;                            -- 降序

SELECT * FROM employees
ORDER BY dept_id ASC, salary DESC;               -- 多列排序

-- LIMIT 与 OFFSET（分页）
SELECT * FROM employees
ORDER BY emp_id
LIMIT 5;                                         -- 前5条

SELECT * FROM employees
ORDER BY emp_id
LIMIT 5 OFFSET 5;                                -- 第6-10条（第2页）
```

#### 聚合函数与 GROUP BY

```sql
-- 常用聚合函数
SELECT 
    COUNT(*)          AS 员工总数,
    AVG(salary)       AS 平均薪资,
    MAX(salary)       AS 最高薪资,
    MIN(salary)       AS 最低薪资,
    SUM(salary)       AS 薪资总和,
    MEDIAN(salary)    AS 薪资中位数     -- DuckDB 特有
FROM employees
WHERE is_active = TRUE;

-- GROUP BY 分组统计
SELECT 
    dept_id,
    COUNT(*)            AS 部门人数,
    ROUND(AVG(salary), 2)  AS 平均薪资,
    MAX(salary)         AS 最高薪资,
    MIN(salary)         AS 最低薪资
FROM employees
WHERE is_active = TRUE
GROUP BY dept_id
ORDER BY 平均薪资 DESC;

-- HAVING 过滤分组结果
SELECT 
    dept_id,
    COUNT(*)              AS 部门人数,
    ROUND(AVG(salary), 2) AS 平均薪资
FROM employees
WHERE is_active = TRUE
GROUP BY dept_id
HAVING COUNT(*) >= 2                    -- 只显示2人以上的部门
ORDER BY 平均薪资 DESC;
```

#### 子查询

```sql
-- 标量子查询：薪资高于平均值的员工
SELECT first_name, last_name, salary
FROM employees
WHERE salary > (SELECT AVG(salary) FROM employees);

-- IN 子查询：查询参与了"active"项目的员工
SELECT first_name, last_name
FROM employees
WHERE emp_id IN (
    SELECT DISTINCT ep.emp_id
    FROM employee_projects ep
    JOIN projects p ON ep.project_id = p.project_id
    WHERE p.status = 'active'
);

-- EXISTS 子查询：查询至少参与了一个项目的员工
SELECT e.first_name, e.last_name
FROM employees e
WHERE EXISTS (
    SELECT 1
    FROM employee_projects ep
    WHERE ep.emp_id = e.emp_id
);

-- 派生表（FROM 子查询）
SELECT dept_id, avg_salary
FROM (
    SELECT dept_id, AVG(salary) AS avg_salary
    FROM employees
    GROUP BY dept_id
) dept_stats
WHERE avg_salary > 25000;
```

#### DuckDB 特色查询

```sql
-- QUALIFY 子句（窗口函数过滤，无需子查询包装）
-- 每个部门薪资最高的员工
SELECT 
    emp_id, first_name, last_name, dept_id, salary,
    ROW_NUMBER() OVER (PARTITION BY dept_id ORDER BY salary DESC) AS rn
FROM employees
QUALIFY rn = 1;

-- SAMPLE 抽样查询
SELECT * FROM employees USING SAMPLE 50%;        -- 随机50%
SELECT * FROM employees USING SAMPLE 3 ROWS;     -- 随机3行

-- EXCLUDE 排除列
SELECT * EXCLUDE (phone, email, is_active) FROM employees;

-- REPLACE 替换列表达式
SELECT * REPLACE (salary * 12 AS salary) FROM employees;

-- COLUMNS 正则匹配列
SELECT COLUMNS('.*name.*') FROM employees;
```

### 3.3 更新数据（UPDATE）

```sql
-- 更新单条记录
UPDATE employees
SET salary = 36000.00
WHERE emp_id = 1;

-- 更新多列
UPDATE employees
SET 
    salary = 27000.00,
    is_active = TRUE
WHERE emp_id = 12;

-- 条件批量更新（全部门加薪5%）
UPDATE employees
SET salary = salary * 1.05
WHERE dept_id = 1;

-- 使用子查询更新
UPDATE employees
SET salary = salary * 1.10
WHERE emp_id IN (
    SELECT ep.emp_id
    FROM employee_projects ep
    WHERE ep.role = 'lead'
);

-- 更新项目状态
UPDATE projects
SET status = 'active'
WHERE project_id = 5;
```

### 3.4 删除数据（DELETE）

```sql
-- 删除单条记录
DELETE FROM employee_projects
WHERE emp_id = 12 AND project_id = 2;

-- 条件删除
DELETE FROM employees
WHERE is_active = FALSE AND emp_id NOT IN (
    SELECT emp_id FROM employee_projects
);

-- ⚠️ 清空表（删除所有数据，保留表结构）
-- DELETE FROM table_name;        -- 逐行删除
-- TRUNCATE TABLE table_name;     -- 快速清空（DuckDB 不支持 TRUNCATE，用 DELETE）

-- 重新插入被删除的数据以保持后续示例正常
INSERT INTO employee_projects (emp_id, project_id, role, join_date, hours_worked) VALUES
    (12, 2, 'member', '2024-02-20', 30.0);
INSERT INTO employees (emp_id, first_name, last_name, email, phone, hire_date, salary, dept_id, manager_id, is_active) VALUES
    (12, '静', '孙', 'sun.jing@company.com', '13800001012', '2023-03-20', 21000.00, 2, 4, FALSE)
ON CONFLICT (emp_id) DO UPDATE SET is_active = FALSE;
```

### 3.5 UPSERT（INSERT OR UPDATE）

```sql
-- INSERT OR REPLACE（DuckDB 支持 ON CONFLICT）
INSERT INTO employees (emp_id, first_name, last_name, email, hire_date, salary, dept_id)
VALUES (12, '静', '孙', 'sun.jing@company.com', '2023-03-20', 23000.00, 2)
ON CONFLICT (emp_id) DO UPDATE SET
    salary = EXCLUDED.salary;

-- INSERT OR IGNORE（冲突时忽略）
INSERT INTO employees (emp_id, first_name, last_name, email, hire_date, salary, dept_id)
VALUES (12, '静', '孙', 'sun.jing_new@company.com', '2023-03-20', 23000.00, 2)
ON CONFLICT (emp_id) DO NOTHING;
```

---

## 4. 连接操作 (JOIN)

> 下面通过可视化示意图和实例全面演示各种 JOIN。

```
┌──────────────────────────────────────────────────────────┐
│                     JOIN 类型概览                         │
├──────────────────────────────────────────────────────────┤
│                                                          │
│   INNER JOIN         LEFT JOIN          RIGHT JOIN       │
│   ┌───┐ ┌───┐      ┌───┐ ┌───┐       ┌───┐ ┌───┐      │
│   │ A ├─┤ B │      │ A ├─┤ B │       │ A ├─┤ B │      │
│   │   │█│   │      │███│█│   │       │   │█│███│      │
│   └───┘ └───┘      └───┘ └───┘       └───┘ └───┘      │
│   只保留交集        保留左表全部       保留右表全部       │
│                                                          │
│   FULL OUTER JOIN   CROSS JOIN         SELF JOIN        │
│   ┌───┐ ┌───┐      A × B              表自身连接        │
│   │ A ├─┤ B │      每行与每行                           │
│   │███│█│███│      笛卡尔积                             │
│   └───┘ └───┘                                           │
│   保留两表全部                                           │
└──────────────────────────────────────────────────────────┘
```

### 4.1 INNER JOIN（内连接）

```sql
-- 查询所有员工及其部门信息（只返回有匹配的记录）
SELECT 
    e.emp_id,
    e.first_name || ' ' || e.last_name AS 员工姓名,
    e.salary,
    d.dept_name,
    d.location
FROM employees e
INNER JOIN departments d ON e.dept_id = d.dept_id
ORDER BY d.dept_name, e.salary DESC;
```

### 4.2 LEFT JOIN（左连接）

```sql
-- 查询所有部门及其员工数（即使部门没有员工也显示）
SELECT 
    d.dept_id,
    d.dept_name,
    d.budget AS 部门预算,
    COUNT(e.emp_id)         AS 员工人数,
    COALESCE(SUM(e.salary), 0)  AS 薪资总和
FROM departments d
LEFT JOIN employees e ON d.dept_id = e.dept_id AND e.is_active = TRUE
GROUP BY d.dept_id, d.dept_name, d.budget
ORDER BY 员工人数 DESC;

-- 查询没有参与任何项目的员工（LEFT JOIN + IS NULL 模式）
SELECT 
    e.emp_id,
    e.first_name || ' ' || e.last_name AS 员工姓名,
    e.dept_id
FROM employees e
LEFT JOIN employee_projects ep ON e.emp_id = ep.emp_id
WHERE ep.emp_id IS NULL;
```

### 4.3 RIGHT JOIN（右连接）

```sql
-- 查询所有项目及其负责人信息（即使项目没有分配人员也显示）
SELECT 
    p.project_id,
    p.project_name,
    p.status,
    e.first_name || ' ' || e.last_name AS 负责人,
    ep.role
FROM employee_projects ep
RIGHT JOIN projects p ON ep.project_id = p.project_id AND ep.role = 'lead'
LEFT JOIN employees e ON ep.emp_id = e.emp_id
ORDER BY p.project_id;
```

### 4.4 FULL OUTER JOIN（全外连接）

```sql
-- 创建临时数据演示 FULL OUTER JOIN
CREATE TEMP TABLE team_a (id INT, name VARCHAR);
CREATE TEMP TABLE team_b (id INT, name VARCHAR);

INSERT INTO team_a VALUES (1, 'Alice'), (2, 'Bob'), (3, 'Charlie');
INSERT INTO team_b VALUES (2, 'Bob'), (3, 'Charlie'), (4, 'Diana');

-- FULL OUTER JOIN：显示两个团队的全部成员
SELECT 
    COALESCE(a.id, b.id) AS id,
    a.name AS team_a_member,
    b.name AS team_b_member,
    CASE 
        WHEN a.id IS NOT NULL AND b.id IS NOT NULL THEN '两个团队都有'
        WHEN a.id IS NOT NULL THEN '仅在Team A'
        ELSE '仅在Team B'
    END AS 状态
FROM team_a a
FULL OUTER JOIN team_b b ON a.id = b.id
ORDER BY COALESCE(a.id, b.id);

-- 结果：
-- ┌────┬───────────────┬───────────────┬───────────────┐
-- │ id │ team_a_member │ team_b_member │     状态       │
-- ├────┼───────────────┼───────────────┼───────────────┤
-- │  1 │ Alice         │ NULL          │ 仅在Team A    │
-- │  2 │ Bob           │ Bob           │ 两个团队都有   │
-- │  3 │ Charlie       │ Charlie       │ 两个团队都有   │
-- │  4 │ NULL          │ Diana         │ 仅在Team B    │
-- └────┴───────────────┴───────────────┴───────────────┘

DROP TABLE team_a;
DROP TABLE team_b;
```

### 4.5 CROSS JOIN（交叉连接 / 笛卡尔积）

```sql
-- 生成所有员工与所有项目的组合（通常用于生成报表模板）
SELECT 
    e.first_name || ' ' || e.last_name AS 员工,
    p.project_name AS 项目
FROM employees e
CROSS JOIN projects p
WHERE e.dept_id = 1 AND p.dept_id = 1    -- 限制范围，避免结果过大
ORDER BY 员工, 项目;
```

### 4.6 SELF JOIN（自连接）

```sql
-- 查询每个员工及其直属上级
SELECT 
    e.emp_id,
    e.first_name || ' ' || e.last_name     AS 员工姓名,
    e.salary                                 AS 员工薪资,
    m.first_name || ' ' || m.last_name     AS 上级姓名,
    m.salary                                 AS 上级薪资
FROM employees e
LEFT JOIN employees m ON e.manager_id = m.emp_id
ORDER BY e.emp_id;
```

### 4.7 多表连接（复杂查询）

```sql
-- ========================================
-- 综合查询：员工 + 部门 + 项目 完整信息
-- ========================================
SELECT 
    e.emp_id,
    e.first_name || ' ' || e.last_name  AS 员工姓名,
    d.dept_name                          AS 所属部门,
    e.salary                             AS 薪资,
    p.project_name                       AS 参与项目,
    ep.role                              AS 项目角色,
    ep.hours_worked                      AS 工作小时数,
    p.status                             AS 项目状态
FROM employees e
JOIN departments d      ON e.dept_id = d.dept_id
LEFT JOIN employee_projects ep ON e.emp_id = ep.emp_id
LEFT JOIN projects p    ON ep.project_id = p.project_id
WHERE e.is_active = TRUE
ORDER BY d.dept_name, e.emp_id, p.project_name;

-- ========================================
-- 统计分析：每个部门在各项目上投入的总工时
-- ========================================
SELECT 
    d.dept_name                          AS 部门,
    p.project_name                       AS 项目,
    COUNT(DISTINCT ep.emp_id)            AS 参与人数,
    SUM(ep.hours_worked)                 AS 总工时,
    ROUND(AVG(ep.hours_worked), 1)       AS 人均工时
FROM departments d
JOIN employees e        ON d.dept_id = e.dept_id
JOIN employee_projects ep ON e.emp_id = ep.emp_id
JOIN projects p         ON ep.project_id = p.project_id
GROUP BY d.dept_name, p.project_name
ORDER BY d.dept_name, 总工时 DESC;
```

### 4.8 LATERAL JOIN（横向连接 - DuckDB 特色）

```sql
-- 查询每个部门薪资前2名的员工
SELECT 
    d.dept_name,
    top_emp.first_name,
    top_emp.last_name,
    top_emp.salary,
    top_emp.rank_num
FROM departments d,
LATERAL (
    SELECT 
        e.first_name,
        e.last_name,
        e.salary,
        ROW_NUMBER() OVER (ORDER BY e.salary DESC) AS rank_num
    FROM employees e
    WHERE e.dept_id = d.dept_id AND e.is_active = TRUE
    LIMIT 2
) top_emp
ORDER BY d.dept_name, top_emp.rank_num;
```

### 4.9 集合操作

```sql
-- UNION：合并结果（去重）
SELECT emp_id, first_name FROM employees WHERE dept_id = 1
UNION
SELECT emp_id, first_name FROM employees WHERE salary > 30000;

-- UNION ALL：合并结果（不去重，更快）
SELECT emp_id, first_name FROM employees WHERE dept_id = 1
UNION ALL
SELECT emp_id, first_name FROM employees WHERE salary > 30000;

-- INTERSECT：交集 —— 既在技术研发部，薪资又超过30000的人
SELECT emp_id, first_name FROM employees WHERE dept_id = 1
INTERSECT
SELECT emp_id, first_name FROM employees WHERE salary > 30000;

-- EXCEPT：差集 —— 在技术研发部但薪资不超过30000的人
SELECT emp_id, first_name FROM employees WHERE dept_id = 1
EXCEPT
SELECT emp_id, first_name FROM employees WHERE salary > 30000;
```

---

## 5. 视图 (VIEW)

### 5.1 创建视图

```sql
-- ========================================
-- 基础视图：员工详细信息
-- ========================================
CREATE VIEW v_employee_details AS
SELECT 
    e.emp_id,
    e.first_name || ' ' || e.last_name     AS full_name,
    e.email,
    e.hire_date,
    e.salary,
    e.salary * 12                            AS annual_salary,
    e.is_active,
    d.dept_name,
    d.location                               AS dept_location,
    m.first_name || ' ' || m.last_name     AS manager_name
FROM employees e
LEFT JOIN departments d ON e.dept_id = d.dept_id
LEFT JOIN employees m   ON e.manager_id = m.emp_id;

-- 使用视图（像普通表一样查询）
SELECT * FROM v_employee_details;

SELECT full_name, dept_name, annual_salary
FROM v_employee_details
WHERE is_active = TRUE
ORDER BY annual_salary DESC;
```

```sql
-- ========================================
-- 统计视图：部门统计概览
-- ========================================
CREATE VIEW v_department_summary AS
SELECT 
    d.dept_id,
    d.dept_name,
    d.location,
    d.budget                                   AS dept_budget,
    COUNT(e.emp_id)                            AS total_employees,
    COUNT(CASE WHEN e.is_active THEN 1 END)    AS active_employees,
    ROUND(AVG(e.salary), 2)                    AS avg_salary,
    MAX(e.salary)                               AS max_salary,
    MIN(e.salary)                               AS min_salary,
    COALESCE(SUM(e.salary), 0)                 AS total_salary_cost,
    ROUND(COALESCE(SUM(e.salary), 0) * 12 / NULLIF(d.budget, 0) * 100, 1) 
                                                AS salary_budget_ratio_pct
FROM departments d
LEFT JOIN employees e ON d.dept_id = e.dept_id
GROUP BY d.dept_id, d.dept_name, d.location, d.budget;

-- 查询
SELECT * FROM v_department_summary ORDER BY total_employees DESC;
```

```sql
-- ========================================
-- 项目仪表板视图
-- ========================================
CREATE VIEW v_project_dashboard AS
SELECT 
    p.project_id,
    p.project_name,
    p.status,
    p.start_date,
    p.end_date,
    p.budget                                                AS project_budget,
    d.dept_name                                             AS owning_dept,
    COUNT(DISTINCT ep.emp_id)                               AS team_size,
    SUM(ep.hours_worked)                                    AS total_hours,
    STRING_AGG(
        DISTINCT CASE WHEN ep.role = 'lead' 
                 THEN e.first_name || ' ' || e.last_name 
                 END, ', '
    )                                                        AS project_leads,
    CASE 
        WHEN p.end_date IS NULL THEN NULL
        WHEN p.end_date < CURRENT_DATE AND p.status != 'completed' THEN '已逾期'
        WHEN p.end_date - CURRENT_DATE <= 30 THEN '即将到期'
        ELSE '正常'
    END                                                      AS deadline_status
FROM projects p
LEFT JOIN departments d      ON p.dept_id = d.dept_id
LEFT JOIN employee_projects ep ON p.project_id = ep.project_id
LEFT JOIN employees e        ON ep.emp_id = e.emp_id
GROUP BY p.project_id, p.project_name, p.status, p.start_date, 
         p.end_date, p.budget, d.dept_name;

-- 查询
SELECT project_name, status, team_size, total_hours, project_leads
FROM v_project_dashboard
ORDER BY project_id;
```

### 5.2 CREATE OR REPLACE VIEW

```sql
-- 修改已有视图（不需要先删除）
CREATE OR REPLACE VIEW v_employee_details AS
SELECT 
    e.emp_id,
    e.first_name || ' ' || e.last_name     AS full_name,
    e.email,
    e.hire_date,
    e.salary,
    e.salary * 12                            AS annual_salary,
    -- 新增字段：工龄（年）
    ROUND((CURRENT_DATE - e.hire_date) / 365.25, 1) AS years_of_service,
    e.is_active,
    d.dept_name,
    d.location                               AS dept_location,
    m.first_name || ' ' || m.last_name     AS manager_name
FROM employees e
LEFT JOIN departments d ON e.dept_id = d.dept_id
LEFT JOIN employees m   ON e.manager_id = m.emp_id;

SELECT full_name, years_of_service, dept_name FROM v_employee_details;
```

### 5.3 临时视图

```sql
-- 临时视图：仅在当前会话/连接中可用
CREATE TEMP VIEW v_temp_active_employees AS
SELECT * FROM employees WHERE is_active = TRUE;

SELECT * FROM v_temp_active_employees;
```

### 5.4 查看与删除视图

```sql
-- 查看所有视图
SELECT * FROM duckdb_views();

-- 删除视图
DROP VIEW v_temp_active_employees;
DROP VIEW IF EXISTS v_nonexistent;       -- 安全删除
```

### 5.5 CTE（公用表表达式）— 临时的"内联视图"

```sql
-- WITH 子句（非持久化，单次查询使用）
WITH 
-- CTE 1: 部门薪资统计
dept_salary AS (
    SELECT 
        dept_id,
        AVG(salary) AS avg_salary,
        COUNT(*)    AS emp_count
    FROM employees
    WHERE is_active = TRUE
    GROUP BY dept_id
),
-- CTE 2: 公司平均薪资
company_avg AS (
    SELECT AVG(salary) AS overall_avg
    FROM employees
    WHERE is_active = TRUE
)
-- 主查询：比较各部门薪资与公司平均值
SELECT 
    d.dept_name,
    ds.emp_count                                       AS 人数,
    ROUND(ds.avg_salary, 2)                            AS 部门平均薪资,
    ROUND(ca.overall_avg, 2)                           AS 公司平均薪资,
    ROUND(ds.avg_salary - ca.overall_avg, 2)           AS 差异,
    CASE 
        WHEN ds.avg_salary > ca.overall_avg THEN '↑ 高于平均'
        WHEN ds.avg_salary < ca.overall_avg THEN '↓ 低于平均'
        ELSE '= 持平'
    END                                                 AS 对比
FROM dept_salary ds
JOIN departments d ON ds.dept_id = d.dept_id
CROSS JOIN company_avg ca
ORDER BY ds.avg_salary DESC;

-- ========================================
-- 递归 CTE：组织架构层级展示
-- ========================================
WITH RECURSIVE org_tree AS (
    -- 基础条件：顶层管理者（没有上级的人）
    SELECT 
        emp_id,
        first_name || ' ' || last_name AS name,
        manager_id,
        1 AS level,
        first_name || ' ' || last_name AS path
    FROM employees
    WHERE manager_id IS NULL AND is_active = TRUE
    
    UNION ALL
    
    -- 递归条件：找到每个人的下属
    SELECT 
        e.emp_id,
        e.first_name || ' ' || e.last_name,
        e.manager_id,
        ot.level + 1,
        ot.path || ' → ' || e.first_name || ' ' || e.last_name
    FROM employees e
    JOIN org_tree ot ON e.manager_id = ot.emp_id
    WHERE e.is_active = TRUE
)
SELECT 
    REPEAT('  ', level - 1) || name AS 组织架构,
    level                            AS 层级,
    path                             AS 汇报链
FROM org_tree
ORDER BY path;
```

---

## 6. 事务 (TRANSACTION)

> DuckDB 支持 ACID 事务，默认每条语句是一个自动提交的事务。

```
┌──────────────────────────────────────────────────┐
│              事务生命周期                          │
│                                                  │
│   BEGIN TRANSACTION                              │
│        │                                         │
│        ▼                                         │
│   ┌──────────┐                                   │
│   │  SQL操作   │ ◄─── INSERT / UPDATE / DELETE    │
│   │  SQL操作   │                                  │
│   │  SQL操作   │                                  │
│   └──────────┘                                   │
│        │                                         │
│   ┌────┴────┐                                    │
│   ▼         ▼                                    │
│ COMMIT   ROLLBACK                                │
│ (提交)    (回滚)                                  │
│   │         │                                    │
│   ▼         ▼                                    │
│ 永久保存   撤销所有更改                            │
└──────────────────────────────────────────────────┘
```

### 6.1 基本事务操作

```sql
-- ========================================
-- 示例1：成功的事务（COMMIT）
-- 场景：员工调薪，同时记录薪资变更历史
-- ========================================
BEGIN TRANSACTION;

    -- 查看当前薪资
    SELECT emp_id, first_name, salary 
    FROM employees WHERE emp_id = 2;

    -- 记录变更历史
    INSERT INTO salary_history (history_id, emp_id, old_salary, new_salary, change_reason)
    SELECT 
        1,
        emp_id,
        salary,
        salary * 1.15,
        '年度绩效调薪 - 优秀'
    FROM employees
    WHERE emp_id = 2;

    -- 更新薪资（加薪15%）
    UPDATE employees
    SET salary = salary * 1.15
    WHERE emp_id = 2;

    -- 验证更新
    SELECT emp_id, first_name, salary FROM employees WHERE emp_id = 2;
    SELECT * FROM salary_history WHERE emp_id = 2;

COMMIT;   -- 提交事务，所有更改永久生效
```

### 6.2 事务回滚

```sql
-- ========================================
-- 示例2：失败回滚的事务（ROLLBACK）
-- 场景：批量调薪，发现预算超标后回滚
-- ========================================
BEGIN TRANSACTION;

    -- 查看调整前的薪资总额
    SELECT SUM(salary) AS 调整前总薪资 FROM employees WHERE dept_id = 1;

    -- 全部门加薪20%
    UPDATE employees
    SET salary = salary * 1.20
    WHERE dept_id = 1;

    -- 查看调整后的薪资总额
    SELECT SUM(salary) AS 调整后总薪资 FROM employees WHERE dept_id = 1;

    -- 假设发现预算超标，需要撤销所有更改
    -- 模拟检查逻辑（实际应用中可能是程序化判断）

ROLLBACK;  -- 回滚事务，所有更改被撤销！

-- 验证：薪资未变
SELECT emp_id, first_name, salary FROM employees WHERE dept_id = 1;
```

### 6.3 Python 中的事务管理

```python
import duckdb

con = duckdb.connect('my_database.db')

# ========================================
# 方式1：手动管理事务
# ========================================
try:
    con.execute("BEGIN TRANSACTION")
    
    # 从部门1转一名员工到部门5
    emp_id = 9
    
    # 获取当前信息
    result = con.execute(
        "SELECT first_name, last_name, dept_id FROM employees WHERE emp_id = ?",
        [emp_id]
    ).fetchone()
    print(f"转移前: {result}")
    
    # 更新员工部门
    con.execute(
        "UPDATE employees SET dept_id = 5 WHERE emp_id = ?",
        [emp_id]
    )
    
    # 验证
    result = con.execute(
        "SELECT first_name, last_name, dept_id FROM employees WHERE emp_id = ?",
        [emp_id]
    ).fetchone()
    print(f"转移后: {result}")
    
    # 模拟业务检查
    count = con.execute(
        "SELECT COUNT(*) FROM employees WHERE dept_id = 1 AND is_active = TRUE"
    ).fetchone()[0]
    
    if count < 2:
        raise Exception("部门人数不能少于2人！")
    
    con.execute("COMMIT")
    print("✅ 事务已提交")
    
except Exception as e:
    con.execute("ROLLBACK")
    print(f"❌ 事务已回滚: {e}")


# ========================================
# 方式2：使用上下文管理器（推荐）
# ========================================
def transfer_employee(con, emp_id, new_dept_id):
    """安全地转移员工部门"""
    try:
        con.begin()
        
        # 检查员工存在
        emp = con.execute(
            "SELECT emp_id, dept_id FROM employees WHERE emp_id = ?",
            [emp_id]
        ).fetchone()
        
        if emp is None:
            raise ValueError(f"员工 {emp_id} 不存在")
        
        if emp[1] == new_dept_id:
            raise ValueError(f"员工已在目标部门中")
        
        # 检查目标部门存在
        dept = con.execute(
            "SELECT dept_id FROM departments WHERE dept_id = ?",
            [new_dept_id]
        ).fetchone()
        
        if dept is None:
            raise ValueError(f"部门 {new_dept_id} 不存在")
        
        # 执行转移
        con.execute(
            "UPDATE employees SET dept_id = ? WHERE emp_id = ?",
            [new_dept_id, emp_id]
        )
        
        con.commit()
        print(f"✅ 员工 {emp_id} 已转移到部门 {new_dept_id}")
        
    except Exception as e:
        con.rollback()
        print(f"❌ 转移失败: {e}")

# 调用
transfer_employee(con, 9, 5)
```

### 6.4 事务中的并发控制

```sql
-- DuckDB 使用 MVCC（多版本并发控制）
-- 读取不阻塞写入，写入不阻塞读取
-- 但同一时间只允许一个写事务

-- ========================================
-- 模拟批量操作的事务安全
-- ========================================
BEGIN TRANSACTION;

    -- 步骤1：冻结离职员工的项目分配
    DELETE FROM employee_projects
    WHERE emp_id IN (
        SELECT emp_id FROM employees WHERE is_active = FALSE
    );

    -- 步骤2：统计受影响的数据
    SELECT 
        '活跃员工' AS 类别, COUNT(*) AS 数量
    FROM employees WHERE is_active = TRUE
    UNION ALL
    SELECT 
        '项目分配数', COUNT(*)
    FROM employee_projects;

    -- 步骤3：归档（可选）
    CREATE TABLE IF NOT EXISTS archived_employees AS
    SELECT *, CURRENT_TIMESTAMP AS archived_at
    FROM employees
    WHERE is_active = FALSE
    LIMIT 0;  -- 仅创建结构

    INSERT INTO archived_employees
    SELECT *, CURRENT_TIMESTAMP
    FROM employees
    WHERE is_active = FALSE;

COMMIT;
```

### 6.5 自动提交模式说明

```sql
-- DuckDB 默认每条语句是一个独立事务（自动提交）
-- 以下两句各自独立提交
INSERT INTO departments VALUES (6, '法务部', '广州-天河', 1200000.00, CURRENT_TIMESTAMP);
UPDATE departments SET budget = 1300000 WHERE dept_id = 6;

-- 如果需要原子性（要么全成功，要么全失败），必须显式使用事务
BEGIN;
    INSERT INTO departments VALUES (7, '运维部', '成都-高新', 1800000.00, CURRENT_TIMESTAMP);
    INSERT INTO departments VALUES (8, '数据分析部', '北京-中关村', 2200000.00, CURRENT_TIMESTAMP);
    -- 如果第二条失败，第一条也不会生效
COMMIT;

-- 清理测试数据
DELETE FROM departments WHERE dept_id > 5;
```

---

## 7. 高级特性

### 7.1 窗口函数

```sql
-- ========================================
-- 窗口函数全面展示
-- ========================================
SELECT 
    e.emp_id,
    e.first_name || ' ' || e.last_name    AS name,
    d.dept_name,
    e.salary,
    
    -- 排名函数
    ROW_NUMBER() OVER w                     AS 序号,
    RANK()       OVER w                     AS 排名_有间隔,
    DENSE_RANK() OVER w                     AS 排名_无间隔,
    
    -- 聚合窗口
    AVG(e.salary) OVER w_dept              AS 部门平均薪资,
    SUM(e.salary) OVER w_dept              AS 部门薪资总和,
    COUNT(*)      OVER w_dept              AS 部门人数,
    
    -- 偏移函数
    LAG(e.salary, 1)  OVER w               AS 前一名薪资,
    LEAD(e.salary, 1) OVER w               AS 后一名薪资,
    
    -- 首尾值
    FIRST_VALUE(e.first_name || ' ' || e.last_name) OVER w_dept AS 部门最高薪,
    LAST_VALUE(e.first_name || ' ' || e.last_name)  OVER (
        PARTITION BY e.dept_id 
        ORDER BY e.salary DESC 
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) AS 部门最低薪,
    
    -- 百分位
    PERCENT_RANK() OVER w                  AS 薪资百分位
    
FROM employees e
JOIN departments d ON e.dept_id = d.dept_id
WHERE e.is_active = TRUE
WINDOW 
    w      AS (ORDER BY e.salary DESC),
    w_dept AS (PARTITION BY e.dept_id ORDER BY e.salary DESC)
ORDER BY e.salary DESC;
```

### 7.2 PIVOT / UNPIVOT（DuckDB 特色）

```sql
-- PIVOT：行转列 —— 每个部门各状态的项目数
PIVOT (
    SELECT d.dept_name, p.status
    FROM projects p
    JOIN departments d ON p.dept_id = d.dept_id
)
ON status
USING COUNT(*)
ORDER BY dept_name;

-- UNPIVOT 示例
CREATE TEMP TABLE quarterly_sales (
    product VARCHAR,
    q1 INTEGER, q2 INTEGER, q3 INTEGER, q4 INTEGER
);
INSERT INTO quarterly_sales VALUES 
    ('产品A', 100, 150, 200, 180),
    ('产品B', 80,  90,  110, 130);

UNPIVOT quarterly_sales
ON q1, q2, q3, q4
INTO NAME quarter VALUE sales;

DROP TABLE quarterly_sales;
```

### 7.3 直接查询文件（DuckDB 特色）

```sql
-- 直接查询 CSV 文件（无需建表导入）
-- SELECT * FROM read_csv_auto('employees.csv');

-- 直接查询 Parquet 文件
-- SELECT * FROM read_parquet('data/*.parquet');

-- 直接查询 JSON 文件
-- SELECT * FROM read_json_auto('data.json');

-- 将查询结果导出为文件
-- COPY (SELECT * FROM v_employee_details) TO 'output.csv' (HEADER, DELIMITER ',');
-- COPY (SELECT * FROM v_employee_details) TO 'output.parquet' (FORMAT PARQUET);
```

### 7.4 实用函数速查

```sql
-- ========================================
-- 字符串函数
-- ========================================
SELECT
    CONCAT('Hello', ' ', 'DuckDB')       AS concat_result,        -- Hello DuckDB
    LENGTH('DuckDB')                      AS str_length,           -- 6
    UPPER('duckdb')                       AS upper_case,           -- DUCKDB
    LOWER('DUCKDB')                       AS lower_case,           -- duckdb
    TRIM('  hello  ')                     AS trimmed,              -- hello
    REPLACE('DuckDB', 'Duck', 'Swan')     AS replaced,             -- SwanDB
    SUBSTRING('DuckDB', 1, 4)             AS sub_str,              -- Duck
    SPLIT_PART('a-b-c', '-', 2)           AS split_result,         -- b
    LEFT('DuckDB', 4)                     AS left_str,             -- Duck
    REGEXP_EXTRACT('emp_123', '(\d+)', 1) AS regex_result;         -- 123

-- ========================================
-- 日期/时间函数
-- ========================================
SELECT
    CURRENT_DATE                          AS today,
    CURRENT_TIMESTAMP                     AS now,
    DATE_PART('year', DATE '2024-06-15')  AS year_part,            -- 2024
    DATE_PART('month', DATE '2024-06-15') AS month_part,           -- 6
    DATE_DIFF('day', DATE '2024-01-01', DATE '2024-06-15') AS days_diff, -- 166
    DATE_ADD(DATE '2024-01-01', INTERVAL 3 MONTH) AS add_months,  -- 2024-04-01
    DATE_TRUNC('month', DATE '2024-06-15') AS month_start,         -- 2024-06-01
    STRFTIME(CURRENT_TIMESTAMP, '%Y年%m月%d日') AS formatted;

-- ========================================
-- 条件表达式
-- ========================================
SELECT 
    emp_id,
    salary,
    -- CASE WHEN
    CASE 
        WHEN salary >= 35000 THEN '高薪'
        WHEN salary >= 25000 THEN '中等'
        ELSE '待提升'
    END AS salary_level,
    -- COALESCE
    COALESCE(manager_id, -1) AS manager_or_default,
    -- NULLIF
    NULLIF(manager_id, -1) AS null_if_negative,
    -- IIF (DuckDB 简写)
    IIF(is_active, '在职', '离职') AS status
FROM employees;
```

---

## 完整清理脚本

```sql
-- 按依赖顺序删除所有对象
DROP VIEW IF EXISTS v_employee_details;
DROP VIEW IF EXISTS v_department_summary;
DROP VIEW IF EXISTS v_project_dashboard;
DROP TABLE IF EXISTS archived_employees;
DROP TABLE IF EXISTS salary_history;
DROP TABLE IF EXISTS employee_projects;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS departments;
```

---

## 快速参考卡片

```
┌────────────────────────────────────────────────────────────────┐
│                    DuckDB SQL 速查表                           │
├──────────────┬─────────────────────────────────────────────────┤
│   CRUD       │                                                 │
├──────────────┼─────────────────────────────────────────────────┤
│ CREATE       │ INSERT INTO t VALUES (...);                     │
│ READ         │ SELECT ... FROM t WHERE ... ORDER BY ... LIMIT;│
│ UPDATE       │ UPDATE t SET col=val WHERE ...;                 │
│ DELETE       │ DELETE FROM t WHERE ...;                        │
│ UPSERT       │ INSERT ... ON CONFLICT DO UPDATE/NOTHING;       │
├──────────────┼─────────────────────────────────────────────────┤
│   JOIN       │                                                 │
├──────────────┼─────────────────────────────────────────────────┤
│ INNER JOIN   │ 两表交集                                        │
│ LEFT JOIN    │ 保留左表全部 + 匹配的右表                        │
│ RIGHT JOIN   │ 保留右表全部 + 匹配的左表                        │
│ FULL JOIN    │ 保留两表全部                                     │
│ CROSS JOIN   │ 笛卡尔积                                        │
│ SELF JOIN    │ 表与自身连接                                     │
│ LATERAL JOIN │ 关联子查询连接（DuckDB特色）                      │
├──────────────┼─────────────────────────────────────────────────┤
│   VIEW       │                                                 │
├──────────────┼─────────────────────────────────────────────────┤
│ CREATE VIEW  │ CREATE [OR REPLACE] VIEW v AS SELECT ...;       │
│ TEMP VIEW    │ CREATE TEMP VIEW v AS SELECT ...;               │
│ DROP VIEW    │ DROP VIEW [IF EXISTS] v;                        │
│ CTE          │ WITH cte AS (...) SELECT ...;                   │
├──────────────┼─────────────────────────────────────────────────┤
│ TRANSACTION  │                                                 │
├──────────────┼─────────────────────────────────────────────────┤
│ 开始         │ BEGIN [TRANSACTION];                             │
│ 提交         │ COMMIT;                                         │
│ 回滚         │ ROLLBACK;                                       │
│ 自动提交     │ 默认每条语句自动提交                               │
├──────────────┼─────────────────────────────────────────────────┤
│ DuckDB 特色  │ QUALIFY, SAMPLE, EXCLUDE, COLUMNS, PIVOT,       │
│              │ read_csv_auto, read_parquet, LATERAL JOIN       │
└──────────────┴─────────────────────────────────────────────────┘
```

> **提示**：本教程中的所有 SQL 可以直接在 DuckDB CLI 或 Python `duckdb.connect()` 中按顺序执行。建议从「环境准备 → 建表 → 插入数据」开始，然后逐步实验每个查询。

https://arena.ai/c/019c42c1-3d76-7477-8f72-abc81792d0ef