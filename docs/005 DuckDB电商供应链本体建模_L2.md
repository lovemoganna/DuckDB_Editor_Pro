---
id: "duckdb-sql-lesson-2"
type: "note"
isFavorite: false
createdAt: "2026-09-27T07:00:00.000Z"
updatedAt: "2026-09-27T07:00:00.000Z"
tags:
  - "本体建模"
  - "DuckDB"
  - "电商"
  - "教程"
title: "Lesson 2 · 电商供应链本体建模"
topic: "best_practice"
summary: "以**电商供应链**为领域，建立 品牌（Brand）/ 品类（Category）/ 商品（Product）/ 订单（Order）/ 买家（Buyer）五类核心实体的最小闭环本体，演示实体-关系-层级三层图谱自动生成。"
---

以下内容为 **Lesson 2（L2）**，独立运行，无需导入任何外部文件，确保**最小闭环 + 开箱即跑**。

---

# Lesson 2 · 电商供应链本体建模

## 电商领域本体 · 供应链最小闭环

**难度等级**：L2  
**前置依赖**：无（内嵌种子数据，可独立执行）  
**本课定位**：

> 在一个典型的电商供应链场景中，理解 **品牌 / 品类 / 商品 / 订单 / 买家** 的本体区分，并用关系型模型将其落实为可查询的知识图谱。

---

## 一、学习目标

完成本课后，你将能够：

1. 使用 DuckDB 建立**电商供应链领域的多层本体表结构**
2. 理解 **品类层级（多级分类树）** 的递归建模方式
3. 理解 **品牌 ↔ 商品 ↔ 订单 ↔ 买家** 的外键语义关联
4. 用 SQL 查询验证：商品所属品类层级、品牌旗下商品、买家订单关联

---

## 二、领域概念说明（本体锚定）

### 核心实体（5类）

| 实体            | 业务含义              | 本体角色   |
| ------------- | ----------------- | ------ |
| 品类（Category）  | 商品归属的多级分类树节点      | 层级分类结构 |
| 品牌（Brand）     | 商品的生产与品牌归属方       | 主体实体   |
| 商品（Product）   | 可被购买的货品标的         | 核心交易标的 |
| 买家（Buyer）     | 产生购买行为的消费者        | 行为主体   |
| 订单（Order）     | 买家发起的购买凭据         | 业务事件   |

### 实体关系（4条语义连线）

| 关系 | 语义 |
|---|---|
| Product → belongs_to → Category | 商品归属品类 |
| Product → made_by → Brand | 商品由品牌制造/归属 |
| Order → placed_by → Buyer | 订单由买家发起 |
| Order → contains → Product | 订单包含的商品 |

---

## 三、DDL：建表（全局唯一版本）

### 1️⃣ 品类表 `categories`（支持多级分类树）

```sql
CREATE TABLE categories (
    category_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    parent_id INTEGER,
    level INTEGER NOT NULL DEFAULT 1,
    description TEXT,
    FOREIGN KEY (parent_id) REFERENCES categories(category_id)
);
```

---

### 2️⃣ 品牌表 `brands`

```sql
CREATE TABLE brands (
    brand_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    country TEXT,
    founded_year INTEGER,
    description TEXT
);
```

---

### 3️⃣ 商品表 `products`

```sql
CREATE TABLE products (
    product_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    category_id INTEGER NOT NULL,
    brand_id INTEGER NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    stock_qty INTEGER DEFAULT 0,
    FOREIGN KEY (category_id) REFERENCES categories(category_id),
    FOREIGN KEY (brand_id) REFERENCES brands(brand_id)
);
```

---

### 4️⃣ 买家表 `buyers`

```sql
CREATE TABLE buyers (
    buyer_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    city TEXT,
    signup_date DATE
);
```

---

### 5️⃣ 订单表 `orders`

```sql
CREATE TABLE orders (
    order_id INTEGER PRIMARY KEY,
    buyer_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    order_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    FOREIGN KEY (buyer_id) REFERENCES buyers(buyer_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);
```

---

## 四、DML：种子数据

### 1️⃣ 品类数据（含多级层级）

```sql
INSERT INTO categories VALUES
(1,  '电子产品',   NULL, 1, '数码与电子消费品顶级分类'),
(2,  '手机',       1,    2, '移动通信智能手机'),
(3,  '电脑',       1,    2, '个人计算机与笔记本'),
(4,  '平板',       1,    2, '平板电脑与手写板'),
(5,  '家用电器',   NULL, 1, '家庭生活用电设备'),
(6,  '厨房电器',   5,    2, '厨房使用的小家电'),
(7,  '生活电器',   5,    2, '日常生活辅助电器'),
(8,  '运动户外',   NULL, 1, '运动装备与户外用品'),
(9,  '健身器材',   8,    2, '室内外健身运动器材'),
(10, '户外露营',   8,    2, '露营与野外探险装备');
```

---

### 2️⃣ 品牌数据

```sql
INSERT INTO brands VALUES
(1, '苹果',    '美国', 1976, '全球高端消费电子领导品牌'),
(2, '华为',    '中国', 1987, '全球领先通信与智能终端品牌'),
(3, '小米',    '中国', 2010, '性价比智能生态链品牌'),
(4, '索尼',    '日本', 1946, '全球消费电子与娱乐内容品牌'),
(5, '戴森',    '英国', 1991, '高端家用电器与工程技术品牌'),
(6, '迪卡侬',  '法国', 1976, '全球最大运动用品零售与自有品牌');
```

---

### 3️⃣ 商品数据

```sql
INSERT INTO products VALUES
(1,  'iPhone 15 Pro',   2, 1, 7999.00, 150),
(2,  'Mate 60 Pro',     2, 2, 6999.00, 200),
(3,  'Redmi Note 13',   2, 3, 1299.00, 800),
(4,  'MacBook Pro 14',  3, 1, 14999.00, 80),
(5,  'MateBook X Pro',  3, 2, 9999.00, 120),
(6,  'iPad Pro M4',     4, 1, 8999.00, 100),
(7,  '小米平板 6 Pro',  4, 3, 2799.00, 300),
(8,  '戴森吸尘器 V15', 7, 5, 3999.00, 60),
(9,  '戴森卷发棒',     6, 5, 2499.00, 90),
(10, '迪卡侬跑步机',   9, 6, 4999.00, 40);
```

---

### 4️⃣ 买家数据

```sql
INSERT INTO buyers VALUES
(1, '张伟',   'zhangwei@mail.com',   '北京', '2024-01-15'),
(2, '李娜',   'lina@mail.com',       '上海', '2024-03-22'),
(3, '王芳',   'wangfang@mail.com',   '广州', '2024-06-08'),
(4, '刘洋',   'liuyang@mail.com',    '深圳', '2024-09-01'),
(5, '陈静',   'chenjing@mail.com',   '杭州', '2025-01-10');
```

---

### 5️⃣ 订单数据

```sql
INSERT INTO orders VALUES
(1001, 1, 1,  1, 7999.00,  7999.00,  '2026-01-05', 'COMPLETED'),
(1002, 2, 4,  1, 14999.00, 14999.00, '2026-01-12', 'COMPLETED'),
(1003, 3, 8,  1, 3999.00,  3999.00,  '2026-02-03', 'COMPLETED'),
(1004, 4, 3,  2, 1299.00,  2598.00,  '2026-02-18', 'PENDING'),
(1005, 1, 6,  1, 8999.00,  8999.00,  '2026-03-01', 'COMPLETED'),
(1006, 5, 10, 1, 4999.00,  4999.00,  '2026-03-15', 'SHIPPED'),
(1007, 2, 9,  1, 2499.00,  2499.00,  '2026-04-02', 'COMPLETED'),
(1008, 3, 2,  1, 6999.00,  6999.00,  '2026-04-20', 'PENDING'),
(1009, 4, 5,  1, 9999.00,  9999.00,  '2026-05-08', 'COMPLETED'),
(1010, 5, 7,  2, 2799.00,  5598.00,  '2026-05-25', 'SHIPPED');
```

---

## 五、验证查询

### 查询 1：商品及其品类路径（JOIN 三表）

```sql
SELECT 
    p.name AS product_name,
    b.name AS brand_name,
    c.name AS category_name,
    pc.name AS parent_category,
    p.price
FROM products p
JOIN brands b ON p.brand_id = b.brand_id
JOIN categories c ON p.category_id = c.category_id
LEFT JOIN categories pc ON c.parent_id = pc.category_id
ORDER BY pc.name, c.name, p.price;
```

---

### 查询 2：买家订单汇总（含商品与品牌）

```sql
SELECT 
    bu.name AS buyer_name,
    bu.city,
    COUNT(o.order_id) AS order_count,
    SUM(o.total_amount) AS total_spent,
    MAX(o.order_date) AS last_order_date
FROM buyers bu
JOIN orders o ON bu.buyer_id = o.buyer_id
GROUP BY bu.buyer_id, bu.name, bu.city
ORDER BY total_spent DESC;
```

---

### 查询 3：品牌商品销售额排名

```sql
SELECT 
    br.name AS brand_name,
    COUNT(DISTINCT p.product_id) AS product_count,
    SUM(o.total_amount) AS total_revenue,
    ROUND(AVG(o.total_amount), 2) AS avg_order_value
FROM brands br
JOIN products p ON br.brand_id = p.brand_id
JOIN orders o ON p.product_id = o.product_id
WHERE o.status = 'COMPLETED'
GROUP BY br.brand_id, br.name
ORDER BY total_revenue DESC;
```

---

### 查询 4：品类销售分布

```sql
SELECT 
    COALESCE(pc.name, c.name) AS top_category,
    c.name AS sub_category,
    COUNT(o.order_id) AS order_count,
    SUM(o.total_amount) AS category_revenue
FROM categories c
LEFT JOIN categories pc ON c.parent_id = pc.category_id
JOIN products p ON p.category_id = c.category_id
JOIN orders o ON o.product_id = p.product_id
GROUP BY pc.name, c.name
ORDER BY top_category, category_revenue DESC;
```
