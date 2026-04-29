/**
 * abstractionSeedData — 示例数据
 *
 * 提供丰富的示例抽象表数据，覆盖 8 种 SQL 操作类型和 4 种抽象层级
 */

import { AbstractionTable } from '../types';

// 示例数据抽象表
export const SAMPLE_ABSTRACTION_TABLES: Omit<AbstractionTable, 'id' | 'createdAt' | 'updatedAt'>[] = [
  // ============================================
  // SELECT 操作类型
  // ============================================
  {
    name: '用户行为分析',
    description: '用于分析用户在平台上的行为数据，统计访问次数和最后访问时间',
    abstractionPath: {
      concept: '用户行为',
      property: '访问记录',
      instance: 'user_behavior',
    },
    sqlConfig: {
      operation: 'SELECT',
      template: `SELECT 
  user_id,
  COUNT(*) AS visit_count,
  MAX(visit_time) AS last_visit,
  MIN(visit_time) AS first_visit
FROM user_behavior
WHERE visit_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY user_id
ORDER BY visit_count DESC`,
      parameters: [
        { name: '${table}', type: 'table', description: '行为表名', defaultValue: 'user_behavior' },
        { name: '${days}', type: 'number', description: '统计天数', defaultValue: '30' },
      ],
      sampleOutput: 'user_id | visit_count | last_visit          | first_visit\n101     | 45         | 2024-01-15 10:30:00 | 2024-01-01 08:00:00',
    },
    tags: ['用户', '行为', '分析'],
    domain: '分析',
    isSystem: true,
    isFavorite: false,
  },

  // ============================================
  // AGGREGATE 操作类型
  // ============================================
  {
    name: '订单汇总统计',
    description: '订单金额和数量的汇总统计，支持按日期维度聚合',
    abstractionPath: {
      concept: '订单',
      property: '金额',
      relation: 'AGGREGATE',
      instance: 'orders',
    },
    sqlConfig: {
      operation: 'AGGREGATE',
      template: `SELECT 
  DATE_TRUNC('day', order_date) AS date,
  COUNT(*) AS order_count,
  SUM(amount) AS total_amount,
  AVG(amount) AS avg_amount,
  MAX(amount) AS max_amount,
  MIN(amount) AS min_amount
FROM orders
WHERE order_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE_TRUNC('day', order_date)
ORDER BY date DESC`,
      parameters: [
        { name: '${table}', type: 'table', description: '订单表名', defaultValue: 'orders' },
      ],
      sampleOutput: 'date       | order_count | total_amount | avg_amount | max_amount | min_amount\n2024-01-15 | 156         | 45678.90     | 292.68      | 1999.00    | 10.00',
    },
    tags: ['订单', '汇总', '统计'],
    domain: '电商',
    isSystem: true,
    isFavorite: false,
  },
  {
    name: '日活统计',
    description: '每日活跃用户数统计，包含新用户和活跃用户',
    abstractionPath: {
      concept: '用户',
      property: '活跃度',
      relation: 'DAU',
      instance: 'user_activity',
    },
    sqlConfig: {
      operation: 'AGGREGATE',
      template: `WITH daily_users AS (
  SELECT 
    DATE(login_time) AS date,
    user_id,
    COUNT(*) AS login_count
  FROM user_logins
  WHERE login_time >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY DATE(login_time), user_id
)
SELECT 
  date,
  COUNT(DISTINCT user_id) AS dau,
  SUM(login_count) AS total_logins,
  AVG(login_count) AS avg_logins_per_user
FROM daily_users
GROUP BY date
ORDER BY date DESC`,
      parameters: [
        { name: '${table}', type: 'table', description: '登录记录表名', defaultValue: 'user_logins' },
      ],
      sampleOutput: 'date       | dau  | total_logins | avg_logins_per_user\n2024-01-15 | 1234 | 3456          | 2.8',
    },
    tags: ['用户', '日活', '统计'],
    domain: '运营',
    isSystem: true,
    isFavorite: false,
  },

  // ============================================
  // JOIN 操作类型
  // ============================================
  {
    name: '用户订单关联查询',
    description: '查询用户及其订单详情，支持 LEFT JOIN 关联',
    abstractionPath: {
      concept: '用户',
      relation: 'HAS_MANY',
      instance: 'orders',
    },
    sqlConfig: {
      operation: 'JOIN',
      template: `SELECT 
  u.user_id,
  u.username,
  u.email,
  u.register_time,
  o.order_id,
  o.order_date,
  o.amount,
  o.status
FROM users u
LEFT JOIN orders o ON u.user_id = o.user_id
WHERE o.order_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY o.order_date DESC`,
      parameters: [
        { name: '${user_table}', type: 'table', description: '用户表名', defaultValue: 'users' },
        { name: '${order_table}', type: 'table', description: '订单表名', defaultValue: 'orders' },
      ],
      sampleOutput: 'user_id | username | email           | order_id | order_date | amount\n101     | 张三     | zhangsan@...   | 5001     | 2024-01-15 | 299.00',
    },
    tags: ['用户', '订单', '关联'],
    domain: '电商',
    isSystem: true,
    isFavorite: false,
  },
  {
    name: '多表关联统计',
    description: '用户基础表 + 充值汇总 + 登录汇总，三表关联统计',
    abstractionPath: {
      concept: '用户',
      property: '多维分析',
      relation: 'MULTI_JOIN',
      instance: 'user_stats',
    },
    sqlConfig: {
      operation: 'JOIN',
      template: `WITH 
recharge_summary AS (
  SELECT 
    user_id,
    SUM(amount) AS total_recharge,
    COUNT(*) AS recharge_count,
    MAX(created_at) AS last_recharge_time
  FROM recharge_orders
  WHERE status = 'completed'
  GROUP BY user_id
),
login_summary AS (
  SELECT 
    user_id,
    COUNT(*) AS login_count,
    MAX(login_time) AS last_login_time
  FROM user_logins
  GROUP BY user_id
)
SELECT
  u.id,
  u.name,
  u.channel,
  COALESCE(r.total_recharge, 0) AS total_recharge,
  COALESCE(r.recharge_count, 0) AS recharge_count,
  COALESCE(l.login_count, 0) AS login_count
FROM users u
LEFT JOIN recharge_summary r ON u.id = r.user_id
LEFT JOIN login_summary l ON u.id = l.user_id
ORDER BY total_recharge DESC`,
      parameters: [
        { name: '${users}', type: 'table', description: '用户表', defaultValue: 'users' },
        { name: '${recharge}', type: 'table', description: '充值表', defaultValue: 'recharge_orders' },
        { name: '${logins}', type: 'table', description: '登录表', defaultValue: 'user_logins' },
      ],
      sampleOutput: 'id   | name  | total_recharge | recharge_count | login_count\n101  | 张三   | 10000          | 50             | 200',
    },
    tags: ['用户', '多表', '关联', '汇总'],
    domain: '运营',
    isSystem: true,
    isFavorite: false,
  },

  // ============================================
  // WINDOW 操作类型
  // ============================================
  {
    name: '时间序列窗口分析',
    description: '使用窗口函数进行时间序列分析，计算滑动窗口指标',
    abstractionPath: {
      concept: '销售数据',
      property: '趋势',
      relation: 'WINDOW',
      instance: 'sales',
    },
    sqlConfig: {
      operation: 'WINDOW',
      template: `SELECT 
  sale_date,
  amount,
  SUM(amount) OVER (
    ORDER BY sale_date 
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ) AS rolling_7d_sum,
  AVG(amount) OVER (
    ORDER BY sale_date 
    ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
  ) AS rolling_30d_avg,
  LAG(amount, 1) OVER (ORDER BY sale_date) AS prev_day_amount,
  amount - LAG(amount, 1) OVER (ORDER BY sale_date) AS day_over_day_change
FROM sales
WHERE sale_date >= CURRENT_DATE - INTERVAL '90 days'
ORDER BY sale_date`,
      parameters: [
        { name: '${table}', type: 'table', description: '销售表名', defaultValue: 'sales' },
      ],
      sampleOutput: 'sale_date | amount | rolling_7d_sum | rolling_30d_avg | prev_day | change\n2024-01-15 | 1234   | 8765          | 5432            | 1100     | 134',
    },
    tags: ['销售', '窗口', '趋势'],
    domain: '分析',
    isSystem: true,
    isFavorite: false,
  },
  {
    name: '部门薪资排名',
    description: '使用窗口函数计算部门内排名和占比',
    abstractionPath: {
      concept: '员工',
      property: '薪资',
      relation: 'RANK',
      instance: 'employees',
    },
    sqlConfig: {
      operation: 'WINDOW',
      template: `SELECT 
  dept,
  name,
  salary,
  ROW_NUMBER() OVER (PARTITION BY dept ORDER BY salary DESC) AS dept_rank,
  DENSE_RANK() OVER (ORDER BY salary DESC) AS company_rank,
  SUM(salary) OVER (PARTITION BY dept) AS dept_total,
  ROUND(salary / SUM(salary) OVER (PARTITION BY dept) * 100, 2) AS pct_of_dept,
  ROUND(AVG(salary) OVER (PARTITION BY dept), 2) AS dept_avg
FROM employees
ORDER BY dept, dept_rank`,
      parameters: [
        { name: '${table}', type: 'table', description: '员工表名', defaultValue: 'employees' },
      ],
      sampleOutput: 'dept    | name  | salary | dept_rank | company_rank | dept_total | pct_of_dept\n工程部   | 张三   | 30000  | 1         | 5            | 80000      | 37.50',
    },
    tags: ['员工', '薪资', '排名', '窗口'],
    domain: 'HR',
    isSystem: true,
    isFavorite: false,
  },

  // ============================================
  // CTE 操作类型
  // ============================================
  {
    name: '递归分类统计',
    description: '使用递归 CTE 进行树形结构分类统计',
    abstractionPath: {
      concept: '分类',
      property: '层级',
      relation: 'RECURSIVE',
      instance: 'categories',
    },
    sqlConfig: {
      operation: 'CTE',
      template: `WITH RECURSIVE category_tree AS (
  -- 基础查询：获取顶级分类
  SELECT 
    id,
    name,
    parent_id,
    1 AS level,
    name AS path
  FROM categories
  WHERE parent_id IS NULL
  
  UNION ALL
  
  -- 递归查询：获取子分类
  SELECT 
    c.id,
    c.name,
    c.parent_id,
    ct.level + 1,
    ct.path || ' > ' || c.name
  FROM categories c
  INNER JOIN category_tree ct ON c.parent_id = ct.id
)
SELECT 
  id,
  name,
  level,
  path,
  (SELECT COUNT(*) FROM products p WHERE p.category_id = category_tree.id) AS product_count
FROM category_tree
ORDER BY path`,
      parameters: [
        { name: '${table}', type: 'table', description: '分类表名', defaultValue: 'categories' },
        { name: '${product_table}', type: 'table', description: '产品表名', defaultValue: 'products' },
      ],
      sampleOutput: 'id | name      | level | path                    | product_count\n1  | 电子产品   | 1     | 电子产品                 | 100\n2  | 手机       | 2     | 电子产品 > 手机         | 50',
    },
    tags: ['分类', '递归', 'CTE', '层级'],
    domain: '电商',
    isSystem: true,
    isFavorite: false,
  },

  // ============================================
  // INSERT 操作类型
  // ============================================
  {
    name: '批量插入订单',
    description: '批量插入订单数据的模板，支持子查询',
    abstractionPath: {
      concept: '订单',
      property: '新增',
      instance: 'orders',
    },
    sqlConfig: {
      operation: 'INSERT',
      template: `INSERT INTO orders (user_id, product_id, quantity, amount, order_date, status)
SELECT 
  u.id AS user_id,
  p.id AS product_id,
  1 AS quantity,
  p.price AS amount,
  CURRENT_DATE AS order_date,
  'pending' AS status
FROM users u
CROSS JOIN products p
WHERE u.register_date >= CURRENT_DATE - INTERVAL '7 days'
  AND p.stock > 0`,
      parameters: [
        { name: '${orders_table}', type: 'table', description: '订单表', defaultValue: 'orders' },
        { name: '${users_table}', type: 'table', description: '用户表', defaultValue: 'users' },
        { name: '${products_table}', type: 'table', description: '产品表', defaultValue: 'products' },
      ],
      sampleOutput: '成功插入 500 条订单记录',
    },
    tags: ['订单', '插入', '批量'],
    domain: '电商',
    isSystem: true,
    isFavorite: false,
  },

  // ============================================
  // UPDATE 操作类型
  // ============================================
  {
    name: '批量更新用户等级',
    description: '根据累计消费更新用户等级',
    abstractionPath: {
      concept: '用户',
      property: '等级',
      relation: 'UPDATE',
      instance: 'user_levels',
    },
    sqlConfig: {
      operation: 'UPDATE',
      template: `UPDATE user_levels ul
SET 
  level = CASE
    WHEN total_amount >= 10000 THEN 'VIP'
    WHEN total_amount >= 5000 THEN '银卡'
    WHEN total_amount >= 1000 THEN '金卡'
    ELSE '普通'
  END,
  updated_at = CURRENT_TIMESTAMP
FROM (
  SELECT 
    user_id,
    SUM(amount) AS total_amount
  FROM orders
  WHERE status = 'completed'
  GROUP BY user_id
) o
WHERE ul.user_id = o.user_id`,
      parameters: [
        { name: '${user_levels_table}', type: 'table', description: '用户等级表', defaultValue: 'user_levels' },
        { name: '${orders_table}', type: 'table', description: '订单表', defaultValue: 'orders' },
      ],
      sampleOutput: '更新了 1000 个用户的等级信息',
    },
    tags: ['用户', '等级', '更新'],
    domain: '运营',
    isSystem: true,
    isFavorite: false,
  },

  // ============================================
  // DELETE 操作类型
  // ============================================
  {
    name: '清理过期会话',
    description: '删除过期的用户会话记录',
    abstractionPath: {
      concept: '会话',
      property: '过期',
      relation: 'DELETE',
      instance: 'user_sessions',
    },
    sqlConfig: {
      operation: 'DELETE',
      template: `DELETE FROM user_sessions
WHERE last_active_time < CURRENT_TIMESTAMP - INTERVAL '7 days'
  AND status = 'inactive'`,
      parameters: [
        { name: '${table}', type: 'table', description: '会话表名', defaultValue: 'user_sessions' },
        { name: '${days}', type: 'number', description: '过期天数', defaultValue: '7' },
      ],
      sampleOutput: '删除了 150 个过期会话记录',
    },
    tags: ['会话', '清理', '删除'],
    domain: '系统',
    isSystem: true,
    isFavorite: false,
  },
];

/**
 * 获取所有示例数据
 */
export const getAllSampleData = () => {
  return SAMPLE_ABSTRACTION_TABLES;
};

/**
 * 按操作类型获取示例数据
 */
export const getSampleDataByOperation = (operation: string) => {
  return SAMPLE_ABSTRACTION_TABLES.filter(
    t => t.sqlConfig.operation === operation
  );
};

/**
 * 按领域获取示例数据
 */
export const getSampleDataByDomain = (domain: string) => {
  return SAMPLE_ABSTRACTION_TABLES.filter(t => t.domain === domain);
};
