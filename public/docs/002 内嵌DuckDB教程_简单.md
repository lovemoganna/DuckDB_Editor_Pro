以下内容为 **Lesson 1（L1）**，直接可执行，不引入任何后续未定义结构，确保**最小闭环 + 可持续演进**。

---

# Lesson 1 · DuckDB SQL 入门

## 哲学知识图谱 · 本体论最小闭环

**难度等级**：L1
**前置依赖**：无
**本课定位**：

> 建立“哲学概念本体”的**最小可运行宇宙**，为后续所有 DML / JOIN / 事务 / 递归查询提供唯一数据根基。

---

## 一、学习目标

完成本课后，你将能够：

1. 使用 DuckDB 创建一组**具备哲学含义的关系型表**
2. 理解 **概念 / 思想家 / 学派** 的本体论区分
3. 建立 **稳定、不返工** 的基础数据结构
4. 跑通第一批**可查询、可扩展**的哲学数据

---

## 二、哲学概念说明（本体论锚定）

### 1. 本体论三要素（最低必要）

| 实体           | 哲学含义           | 数据库角色 |
| ------------ | -------------- | ----- |
| 思想家（Thinker） | 概念的提出者、论证者     | 行为主体  |
| 学派（School）   | 方法论与立场的集合      | 立场集合  |
| 概念（Concept）  | 被讨论、被使用、被演化的对象 | 核心节点  |

> 本课**只做“是什么”**，不涉及“如何知道”（认识论留到 Lesson 3）。

---

## 三、DuckDB 环境说明（极简）

* DuckDB 是 **嵌入式分析型数据库**
* SQL 标准高度兼容（Postgres 风格）
* 支持：

  * 外键
  * 递归 CTE
  * JSON
  * 列式分析

启动方式（任选）：

```bash
duckdb philosophy.db
```

---

## 四、DDL：建表（全局唯一版本）

> ⚠️ 说明：
>
> * **后续所有课程禁止重复建表**
> * 只允许 `ALTER TABLE` 演进

### 1️⃣ 学派表 `schools`

```sql
CREATE TABLE schools (
    school_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT
);
```

---

### 2️⃣ 思想家表 `thinkers`

```sql
CREATE TABLE thinkers (
    thinker_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    birth_year INTEGER,
    death_year INTEGER,
    era TEXT
);
```

---

### 3️⃣ 思想家 ↔ 学派（多对多）

```sql
CREATE TABLE thinker_schools (
    thinker_id INTEGER NOT NULL,
    school_id INTEGER NOT NULL,
    PRIMARY KEY (thinker_id, school_id),
    FOREIGN KEY (thinker_id) REFERENCES thinkers(thinker_id),
    FOREIGN KEY (school_id) REFERENCES schools(school_id)
);
```

---

### 4️⃣ 概念表 `concepts`（本体核心）

```sql
CREATE TABLE concepts (
    concept_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    definition TEXT,
    domain TEXT,        -- 本体论 / 认识论 / 形而上学等
    introduced_by INTEGER,
    FOREIGN KEY (introduced_by) REFERENCES thinkers(thinker_id)
);
```

---

### 5️⃣ 概念层级表 `concept_hierarchy`

> 表达 **genus → species（上位 / 下位）**

```sql
CREATE TABLE concept_hierarchy (
    parent_concept_id INTEGER NOT NULL,
    child_concept_id INTEGER NOT NULL,
    PRIMARY KEY (parent_concept_id, child_concept_id),
    FOREIGN KEY (parent_concept_id) REFERENCES concepts(concept_id),
    FOREIGN KEY (child_concept_id) REFERENCES concepts(concept_id)
);
```

---

## 五、DML：种子数据（第一性、不可随意改）

### 1️⃣ 学派数据

```sql
INSERT INTO schools VALUES
(1, '理性主义', '强调理性与先天结构'),
(2, '经验主义', '强调感官经验'),
(3, '现象学', '研究意识如何呈现对象');
```

---

### 2️⃣ 思想家数据（≥5）

```sql
INSERT INTO thinkers VALUES
(1, '柏拉图', -427, -347, '古典'),
(2, '亚里士多德', -384, -322, '古典'),
(3, '笛卡尔', 1596, 1650, '近代'),
(4, '休谟', 1711, 1776, '近代'),
(5, '康德', 1724, 1804, '近代'),
(6, '胡塞尔', 1859, 1938, '现代');
```

---

### 3️⃣ 思想家 ↔ 学派映射

```sql
INSERT INTO thinker_schools VALUES
(1, 1),  -- 柏拉图 → 理性主义
(3, 1),  -- 笛卡尔 → 理性主义
(4, 2),  -- 休谟 → 经验主义
(5, 1),  -- 康德 → 理性主义
(5, 2),  -- 康德 → 经验主义（调和）
(6, 3);  -- 胡塞尔 → 现象学
```

---

### 4️⃣ 概念数据（≥15）

```sql
INSERT INTO concepts VALUES
(1, '理念', '独立于感官世界的永恒实体', '本体论', 1),
(2, '实体', '独立存在的存在者', '本体论', 2),
(3, '形式', '事物的结构与本质', '本体论', 2),
(4, '理性', '认识的先天能力', '认识论', 3),
(5, '经验', '来自感官的认识来源', '认识论', 4),
(6, '先验', '经验之前的认识条件', '认识论', 5),
(7, '现象', '对象对主体的显现方式', '认识论', 5),
(8, '物自身', '不依赖主体的真实存在', '本体论', 5),
(9, '意识', '一切显现的场域', '认识论', 6),
(10, '意向性', '意识指向对象的结构', '认识论', 6),
(11, '存在', '作为存在者之存在', '本体论', 2),
(12, '本质', '决定对象是什么的规定性', '本体论', 2),
(13, '感性', '直观的能力', '认识论', 5),
(14, '知性', '概念化的能力', '认识论', 5),
(15, '理念论', '理念高于感性世界', '形而上学', 1);
```

---

### 5️⃣ 概念层级（示例）

```sql
INSERT INTO concept_hierarchy VALUES
(11, 2),   -- 存在 → 实体
(2, 12),   -- 实体 → 本质
(9, 10),   -- 意识 → 意向性
(6, 7),    -- 先验 → 现象
(1, 15);   -- 理念 → 理念论
```

---

## 六、即学即练（SELECT 基础）

### 练习 1：列出所有本体论概念

```sql
SELECT name, definition
FROM concepts
WHERE domain = '本体论';
```

---

### 练习 2：查询康德提出的概念

```sql
SELECT c.name
FROM concepts c
JOIN thinkers t ON c.introduced_by = t.thinker_id
WHERE t.name = '康德';
```

---

### 练习 3：查询每个学派下的思想家数量

```sql
SELECT s.name, COUNT(*) AS thinker_count
FROM schools s
JOIN thinker_schools ts ON s.school_id = ts.school_id
GROUP BY s.name;
```

---

## 七、小结（本课闭环）

* 你已经建立：

  * 一个**哲学本体论的关系模型**
  * 一套**可递归、可 JOIN、可事务化**的数据根
* 当前系统满足：

  * 稳定
  * 可扩展
  * 不返工

---

## 下一课预告（Lesson 2 · L2）

**主题**：关系建模与 JOIN
**重点**：

* 概念 ↔ 学派 ↔ 思想家
* 自连接（概念谱系）
* 为认识论层做结构铺垫

如果确认，回复：
**“执行第二课”**




https://chatgpt.com/c/69764572-b0f4-832c-bd51-7e34208b07c4