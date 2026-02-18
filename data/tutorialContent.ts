export const EMBEDDED_CONTENT: Record<string, string> = {
    'duckdb-basics': `
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

\`\`\`bash
# Python
pip install duckdb

# Node.js
npm install duckdb

# CLI (macOS)
brew install duckdb
\`\`\`

### 启动 DuckDB

\`\`\`bash
# 内存模式（数据不持久化）
duckdb

# 文件模式（数据持久化到文件）
duckdb my_database.db
\`\`\`

### Python 中使用

\`\`\`python
import duckdb

# 内存数据库
con = duckdb.connect()

# 持久化数据库
con = duckdb.connect('my_database.db')

# 执行 SQL
con.execute("SELECT 'Hello DuckDB!' AS greeting").fetchall()
\`\`\`

---

## 2. 数据库与表操作

### 2.1 创建表（CREATE TABLE）

\`\`\`sql
-- 创建部门表
CREATE TABLE departments (
    dept_id     INTEGER PRIMARY KEY,
    dept_name   VARCHAR(50) NOT NULL,
    location    VARCHAR(100),
    budget      DECIMAL(15, 2) DEFAULT 0.00,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建员工表
CREATE TABLE employees (
    emp_id      INTEGER PRIMARY KEY,
    first_name  VARCHAR(50) NOT NULL,
    last_name   VARCHAR(50) NOT NULL,
    email       VARCHAR(100) UNIQUE,
    hire_date   DATE NOT NULL,
    salary      DECIMAL(10, 2),
    dept_id     INTEGER REFERENCES departments(dept_id),
    is_active   BOOLEAN DEFAULT TRUE
);
\`\`\`

### 2.2 查看表信息

\`\`\`sql
-- 查看所有表
SHOW TABLES;

-- 查看表结构
DESCRIBE employees;
\`\`\`

> 💡 **小贴士**：你可以点击这里直接查看 [employees 表的数据](table://employees)。

---

## 3. 增删改查 (CRUD)

### 3.1 插入数据（INSERT）

\`\`\`sql
-- 插入部门数据
INSERT INTO departments (dept_id, dept_name, location, budget) VALUES
    (1, '技术研发部', '北京-海淀', 5000000.00),
    (2, '市场营销部', '上海-浦东', 3000000.00);

-- 插入员工数据
INSERT INTO employees (emp_id, first_name, last_name, email, hire_date, salary, dept_id) VALUES
    (1, '张', '明', 'zhang.ming@company.com', '2020-03-15', 35000.00, 1),
    (2, '李', '丽', 'li.li@company.com', '2020-05-20', 30000.00, 1);
\`\`\`

### 3.2 查询数据（SELECT）

\`\`\`sql
-- 查询所有列
SELECT * FROM employees;

-- 查询指定列
SELECT emp_id, first_name, last_name, salary FROM employees;

-- 条件查询
SELECT * FROM employees WHERE salary > 28000;

-- 排序
SELECT * FROM employees ORDER BY salary DESC;

-- 分页
SELECT * FROM employees ORDER BY emp_id LIMIT 5 OFFSET 5;
\`\`\`

### 3.3 更新数据（UPDATE）

\`\`\`sql
-- 更新单条记录
UPDATE employees
SET salary = 36000.00
WHERE emp_id = 1;
\`\`\`

### 3.4 删除数据（DELETE）

\`\`\`sql
-- 删除单条记录
DELETE FROM employees WHERE emp_id = 1;
\`\`\`

---

## 4. 连接操作 (JOIN)

### 4.1 INNER JOIN（内连接）

\`\`\`sql
SELECT 
    e.emp_id,
    e.first_name || ' ' || e.last_name AS 员工姓名,
    d.dept_name
FROM employees e
INNER JOIN departments d ON e.dept_id = d.dept_id;
\`\`\`

### 4.2 LEFT JOIN（左连接）

\`\`\`sql
SELECT 
    d.dept_name,
    COUNT(e.emp_id) AS 员工人数
FROM departments d
LEFT JOIN employees e ON d.dept_id = e.dept_id
GROUP BY d.dept_name;
\`\`\`

---

## 5. 视图 (VIEW)

\`\`\`sql
-- 创建视图
CREATE VIEW v_employee_details AS
SELECT 
    e.emp_id,
    e.first_name || ' ' || e.last_name AS full_name,
    d.dept_name,
    e.salary
FROM employees e
LEFT JOIN departments d ON e.dept_id = d.dept_id;

-- 使用视图
SELECT * FROM v_employee_details WHERE salary > 25000;
\`\`\`

---

## 6. 事务 (TRANSACTION)

\`\`\`sql
-- 开始事务
BEGIN TRANSACTION;

-- 执行操作
UPDATE employees SET salary = salary * 1.1 WHERE dept_id = 1;

-- 提交事务
COMMIT;

-- 或者回滚
-- ROLLBACK;
\`\`\`

---

## 7. 高级特性

### 窗口函数

\`\`\`sql
SELECT 
    emp_id,
    salary,
    AVG(salary) OVER (PARTITION BY dept_id) AS 部门平均薪资
FROM employees;
\`\`\`

### PIVOT（行转列）

\`\`\`sql
PIVOT (
    SELECT dept_id, status FROM projects
)
ON status
USING COUNT(*);
\`\`\`

---

> **提示**：本教程中的所有 SQL 可以直接在 DuckDB CLI 或 Python \`duckdb.connect()\` 中按顺序执行。
`,
    'philosophy-db': `
# 哲学数据库入门

## 课程目标

通过哲学案例学习数据库设计，建立最小可运行宇宙，理解本体论概念。

## 哲学概念说明（本体论锚定）

### 1. 本体论三要素（最低必要）

| 实体 | 哲学含义 | 数据库角色 |
| ---- | -------- | --------- |
| 思想家（Thinker） | 概念的提出者、论证者 | 行为主体 |
| 学派（School） | 方法论与立场的集合 | 立场集合 |
| 概念（Concept） | 被讨论、被使用、被演化的对象 | 核心节点 |

---

## DDL：建表

### 1. 学派表 \`schools\`

\`\`\`sql
CREATE TABLE schools (
    school_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT
);
\`\`\`

### 2. 思想家表 \`thinkers\`

\`\`\`sql
CREATE TABLE thinkers (
    thinker_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    birth_year INTEGER,
    death_year INTEGER,
    era TEXT
);
\`\`\`

### 3. 思想家 ↔ 学派（多对多）

\`\`\`sql
CREATE TABLE thinker_schools (
    thinker_id INTEGER NOT NULL,
    school_id INTEGER NOT NULL,
    PRIMARY KEY (thinker_id, school_id),
    FOREIGN KEY (thinker_id) REFERENCES thinkers(thinker_id),
    FOREIGN KEY (school_id) REFERENCES schools(school_id)
);
\`\`\`

---

## 插入初始数据

\`\`\`sql
-- 插入学派
INSERT INTO schools VALUES 
    (1, '儒家', '孔子开创的学说'),
    (2, '道家', '老子、庄子为代表的学派'),
    (3, '佛家', '释迦牟尼创立的宗教哲学');

-- 插入思想家
INSERT INTO thinkers VALUES 
    (1, '孔子', -551, -479, '春秋'),
    (2, '老子', -571, -471, '春秋'),
    (3, '庄子', -369, -286, '战国'),
    (4, '孟子', -372, -289, '战国');

-- 插入关联
INSERT INTO thinker_schools VALUES 
    (1, 1),  -- 孔子 -> 儒家
    (2, 2),  -- 老子 -> 道家
    (3, 2),  -- 庄子 -> 道家
    (4, 1);  -- 孟子 -> 儒家
\`\`\`

---

## 查询示例

### 查询每个学派的思想家数量

\`\`\`sql
SELECT 
    s.name AS 学派,
    COUNT(ts.thinker_id) AS 思想家数量
FROM schools s
LEFT JOIN thinker_schools ts ON s.school_id = ts.school_id
GROUP BY s.school_id, s.name
ORDER BY 思想家数量 DESC;
\`\`\`

---

> **学习目标**：完成本课后，你将能够使用 DuckDB 创建具备哲学含义的关系型表，理解概念、思想家、学派的本体论区分。
`
};
