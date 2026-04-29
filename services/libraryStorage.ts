// Library Storage Service
// 使用 IndexedDB 存储 Library 模块的所有数据

import {
  ReferenceCard,
  SqlTemplate,
  LearningStage,
  CodeSnippet,
  LibraryTab,
  OntologyEntry,
  OntologyView,
  AbstractionTable
} from '../types';
import { AISession } from '../types/abstraction';

// ==================== 数据库配置 ====================
const DB_NAME = 'duckdb_library';
const DB_VERSION = 4; // 升级版本号（4: 新增 ai_sessions）

// 对象仓库名称
const STORES = {
  REFERENCE_CARDS: 'reference_cards',
  SQL_TEMPLATES: 'sql_templates',
  LEARNING_PROGRESS: 'learning_progress',
  CODE_SNIPPETS: 'code_snippets',
  ONTOLOGY_ENTRIES: 'ontology_entries',
  ONTOLOGY_VIEWS: 'ontology_views',
  ABSTRACTION_TABLES: 'abstraction_tables',
  AI_SESSIONS: 'ai_sessions',
} as const;

// ==================== 工具函数 ====================
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 创建速查卡片仓库
      if (!db.objectStoreNames.contains(STORES.REFERENCE_CARDS)) {
        const refStore = db.createObjectStore(STORES.REFERENCE_CARDS, { keyPath: 'id' });
        refStore.createIndex('tags', 'tags', { unique: false });
        refStore.createIndex('isSystem', 'isSystem', { unique: false });
      }

      // 创建 SQL 模板仓库
      if (!db.objectStoreNames.contains(STORES.SQL_TEMPLATES)) {
        const templateStore = db.createObjectStore(STORES.SQL_TEMPLATES, { keyPath: 'id' });
        templateStore.createIndex('category', 'category', { unique: false });
        templateStore.createIndex('tags', 'tags', { unique: false });
        templateStore.createIndex('isSystem', 'isSystem', { unique: false });
      }

      // 创建学习进度仓库
      if (!db.objectStoreNames.contains(STORES.LEARNING_PROGRESS)) {
        const learningStore = db.createObjectStore(STORES.LEARNING_PROGRESS, { keyPath: 'id' });
        learningStore.createIndex('order', 'order', { unique: false });
      }

      // 创建代码片段仓库
      if (!db.objectStoreNames.contains(STORES.CODE_SNIPPETS)) {
        const snippetStore = db.createObjectStore(STORES.CODE_SNIPPETS, { keyPath: 'id' });
        snippetStore.createIndex('tags', 'tags', { unique: false });
        snippetStore.createIndex('favorite', 'favorite', { unique: false });
      }

      // 创建本体论条目仓库
      if (!db.objectStoreNames.contains(STORES.ONTOLOGY_ENTRIES)) {
        const ontologyStore = db.createObjectStore(STORES.ONTOLOGY_ENTRIES, { keyPath: 'id' });
        ontologyStore.createIndex('abstractionLevel', 'abstractionLevel', { unique: false });
        ontologyStore.createIndex('semanticType', 'semanticType', { unique: false });
        ontologyStore.createIndex('domain', 'domain', { unique: false });
        ontologyStore.createIndex('parentId', 'parentId', { unique: false });
        ontologyStore.createIndex('isSystem', 'isSystem', { unique: false });
      }

      // 创建本体论视图仓库
      if (!db.objectStoreNames.contains(STORES.ONTOLOGY_VIEWS)) {
        const viewStore = db.createObjectStore(STORES.ONTOLOGY_VIEWS, { keyPath: 'id' });
        viewStore.createIndex('name', 'name', { unique: false });
      }

      // 创建数据抽象表仓库
      if (!db.objectStoreNames.contains(STORES.ABSTRACTION_TABLES)) {
        const abstractionStore = db.createObjectStore(STORES.ABSTRACTION_TABLES, { keyPath: 'id' });
        abstractionStore.createIndex('domain', 'domain', { unique: false });
        abstractionStore.createIndex('isSystem', 'isSystem', { unique: false });
      }

      // 创建 AI 会话仓库
      if (!db.objectStoreNames.contains(STORES.AI_SESSIONS)) {
        const sessionStore = db.createObjectStore(STORES.AI_SESSIONS, { keyPath: 'id' });
        sessionStore.createIndex('database', 'database', { unique: false });
        sessionStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
  });
};

// ==================== 速查卡片 CRUD ====================

/**
 * 保存速查卡片
 */
export const saveReferenceCard = async (card: Omit<ReferenceCard, 'id' | 'createdAt' | 'updatedAt'>): Promise<ReferenceCard> => {
  const db = await openDB();
  const now = Date.now();
  const newCard: ReferenceCard = {
    ...card,
    id: generateId(),
    createdAt: now,
    updatedAt: now
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.REFERENCE_CARDS, 'readwrite');
    const store = transaction.objectStore(STORES.REFERENCE_CARDS);
    const request = store.add(newCard);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(newCard);
  });
};

/**
 * 获取所有速查卡片
 */
export const getAllReferenceCards = async (): Promise<ReferenceCard[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.REFERENCE_CARDS, 'readonly');
    const store = transaction.objectStore(STORES.REFERENCE_CARDS);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
};

/**
 * 更新速查卡片
 */
export const updateReferenceCard = async (card: ReferenceCard): Promise<ReferenceCard> => {
  const db = await openDB();
  const updatedCard = { ...card, updatedAt: Date.now() };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.REFERENCE_CARDS, 'readwrite');
    const store = transaction.objectStore(STORES.REFERENCE_CARDS);
    const request = store.put(updatedCard);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(updatedCard);
  });
};

/**
 * 删除速查卡片
 */
export const deleteReferenceCard = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.REFERENCE_CARDS, 'readwrite');
    const store = transaction.objectStore(STORES.REFERENCE_CARDS);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

// ==================== SQL 模板 CRUD ====================

/**
 * 保存 SQL 模板
 */
export const saveSqlTemplate = async (template: Omit<SqlTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>): Promise<SqlTemplate> => {
  const db = await openDB();
  const now = Date.now();
  const newTemplate: SqlTemplate = {
    ...template,
    id: generateId(),
    usageCount: 0,
    createdAt: now,
    updatedAt: now
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.SQL_TEMPLATES, 'readwrite');
    const store = transaction.objectStore(STORES.SQL_TEMPLATES);
    const request = store.add(newTemplate);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(newTemplate);
  });
};

/**
 * 获取所有 SQL 模板
 */
export const getAllSqlTemplates = async (): Promise<SqlTemplate[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.SQL_TEMPLATES, 'readonly');
    const store = transaction.objectStore(STORES.SQL_TEMPLATES);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
};

/**
 * 更新 SQL 模板
 */
export const updateSqlTemplate = async (template: SqlTemplate): Promise<SqlTemplate> => {
  const db = await openDB();
  const updatedTemplate = { ...template, updatedAt: Date.now() };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.SQL_TEMPLATES, 'readwrite');
    const store = transaction.objectStore(STORES.SQL_TEMPLATES);
    const request = store.put(updatedTemplate);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(updatedTemplate);
  });
};

/**
 * 删除 SQL 模板
 */
export const deleteSqlTemplate = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.SQL_TEMPLATES, 'readwrite');
    const store = transaction.objectStore(STORES.SQL_TEMPLATES);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

/**
 * 增加模板使用次数
 */
export const incrementTemplateUsage = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.SQL_TEMPLATES, 'readwrite');
    const store = transaction.objectStore(STORES.SQL_TEMPLATES);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const template = getRequest.result;
      if (template) {
        template.usageCount = (template.usageCount || 0) + 1;
        template.updatedAt = Date.now();
        store.put(template);
      }
    };

    getRequest.onerror = () => reject(getRequest.error);
    transaction.oncomplete = () => resolve();
  });
};

// ==================== 学习进度 CRUD ====================

/**
 * 保存学习阶段进度
 */
export const saveLearningProgress = async (stage: LearningStage): Promise<LearningStage> => {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.LEARNING_PROGRESS, 'readwrite');
    const store = transaction.objectStore(STORES.LEARNING_PROGRESS);
    const request = store.put(stage);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(stage);
  });
};

/**
 * 获取所有学习阶段进度
 */
export const getAllLearningProgress = async (): Promise<LearningStage[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.LEARNING_PROGRESS, 'readonly');
    const store = transaction.objectStore(STORES.LEARNING_PROGRESS);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
};

/**
 * 更新节点完成状态
 */
export const markNodeCompleted = async (stageId: string, nodeId: string, completed: boolean): Promise<void> => {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.LEARNING_PROGRESS, 'readwrite');
    const store = transaction.objectStore(STORES.LEARNING_PROGRESS);
    const getRequest = store.get(stageId);

    getRequest.onsuccess = () => {
      const stage = getRequest.result;
      if (stage) {
        const node = stage.nodes.find(n => n.id === nodeId);
        if (node) {
          node.isCompleted = completed;
          store.put(stage);
        }
      }
    };

    getRequest.onerror = () => reject(getRequest.error);
    transaction.oncomplete = () => resolve();
  });
};

// ==================== 代码片段 CRUD ====================

/**
 * 保存代码片段
 */
export const saveCodeSnippet = async (snippet: Omit<CodeSnippet, 'id' | 'createdAt' | 'updatedAt'>): Promise<CodeSnippet> => {
  const db = await openDB();
  const now = Date.now();
  const newSnippet: CodeSnippet = {
    ...snippet,
    id: generateId(),
    createdAt: now,
    updatedAt: now
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.CODE_SNIPPETS, 'readwrite');
    const store = transaction.objectStore(STORES.CODE_SNIPPETS);
    const request = store.add(newSnippet);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(newSnippet);
  });
};

/**
 * 获取所有代码片段
 */
export const getAllCodeSnippets = async (): Promise<CodeSnippet[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.CODE_SNIPPETS, 'readonly');
    const store = transaction.objectStore(STORES.CODE_SNIPPETS);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
};

/**
 * 更新代码片段
 */
export const updateCodeSnippet = async (snippet: CodeSnippet): Promise<CodeSnippet> => {
  const db = await openDB();
  const updatedSnippet = { ...snippet, updatedAt: Date.now() };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.CODE_SNIPPETS, 'readwrite');
    const store = transaction.objectStore(STORES.CODE_SNIPPETS);
    const request = store.put(updatedSnippet);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(updatedSnippet);
  });
};

/**
 * 删除代码片段
 */
export const deleteCodeSnippet = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.CODE_SNIPPETS, 'readwrite');
    const store = transaction.objectStore(STORES.CODE_SNIPPETS);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

/**
 * 切换收藏状态
 */
export const toggleSnippetFavorite = async (id: string): Promise<void> => {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.CODE_SNIPPETS, 'readwrite');
    const store = transaction.objectStore(STORES.CODE_SNIPPETS);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const snippet = getRequest.result;
      if (snippet) {
        snippet.favorite = !snippet.favorite;
        snippet.updatedAt = Date.now();
        store.put(snippet);
      }
    };

    getRequest.onerror = () => reject(getRequest.error);
    transaction.oncomplete = () => resolve();
  });
};

// ==================== 预置数据 ====================

/**
 * 获取系统预置速查卡片
 */
export const getSystemReferenceCards = (): ReferenceCard[] => {
  return [
    // 第一层：每天都用
    {
      id: 'sys-ref-1',
      title: 'SELECT 查询结构',
      syntax: 'SELECT cols FROM table WHERE conditions GROUP BY cols HAVING condition ORDER BY cols LIMIT n',
      example: `SELECT user_id, SUM(amount) as total
FROM orders
WHERE status = 'completed'
GROUP BY user_id
HAVING SUM(amount) > 1000
ORDER BY total DESC
LIMIT 10`,
      scenario: '日常数据查询，按条件筛选、分组汇总、排序取TOP',
      tags: ['select', '基础', '高频'],
      isSystem: true,
      createdAt: 0,
      updatedAt: 0
    },
    {
      id: 'sys-ref-2',
      title: 'JOIN 连接语法',
      syntax: 'SELECT ... FROM t1 [LEFT/INNER/FULL] JOIN t2 ON t1.col = t2.col',
      example: `-- 三表关联示例
SELECT u.name, o.total, l.login_count
FROM users u
LEFT JOIN (
  SELECT user_id, SUM(amount) as total
  FROM orders GROUP BY user_id
) o ON u.id = o.user_id
LEFT JOIN (
  SELECT user_id, COUNT(*) as login_count
  FROM logins GROUP BY user_id
) l ON u.id = l.user_id`,
      scenario: '多表数据关联，补充维度信息',
      tags: ['join', '高频', '关联'],
      isSystem: true,
      createdAt: 0,
      updatedAt: 0
    },
    {
      id: 'sys-ref-3',
      title: '窗口函数框架',
      syntax: 'FUNC() OVER (PARTITION BY col ORDER BY col ROWS BETWEEN ...)',
      example: `-- 排名示例
SELECT name, dept, salary,
  ROW_NUMBER() OVER (PARTITION BY dept ORDER BY salary DESC) as rn,
  SUM(salary) OVER (PARTITION BY dept) as dept_total,
  salary / SUM(salary) OVER (PARTITION BY dept) as pct_of_dept
FROM employees`,
      scenario: '保留明细同时计算排名、累计、占比',
      tags: ['window', '分析', '高频'],
      isSystem: true,
      createdAt: 0,
      updatedAt: 0
    },
    // 第二层：经常要用
    {
      id: 'sys-ref-4',
      title: 'CASE WHEN 条件分支',
      syntax: 'CASE WHEN condition THEN result ELSE default END',
      example: `SELECT
  user_id,
  total_amount,
  CASE
    WHEN total_amount >= 10000 THEN '大R'
    WHEN total_amount >= 1000 THEN '中R'
    ELSE '小R'
  END as user_level
FROM user_summary`,
      scenario: '数据分类打标，用户分层',
      tags: ['case', '转换', '高频'],
      isSystem: true,
      createdAt: 0,
      updatedAt: 0
    },
    {
      id: 'sys-ref-5',
      title: 'CTE 临时表',
      syntax: 'WITH cte_name AS (SELECT ...) SELECT * FROM cte_name',
      example: `WITH
  order_summary AS (
    SELECT user_id, SUM(amount) as total, COUNT(*) as cnt
    FROM orders WHERE status = 'completed'
    GROUP BY user_id
  ),
  login_summary AS (
    SELECT user_id, MAX(login_time) as last_login
    FROM logins GROUP BY user_id
  )
SELECT u.*, o.total, o.cnt, l.last_login
FROM users u
LEFT JOIN order_summary o ON u.id = o.user_id
LEFT JOIN login_summary l ON u.id = l.user_id`,
      scenario: '复杂查询的中间结果复用，提升可读性',
      tags: ['cte', '进阶', '高频'],
      isSystem: true,
      createdAt: 0,
      updatedAt: 0
    },
    // 第三层：关键时刻用
    {
      id: 'sys-ref-6',
      title: '日期处理函数',
      syntax: "DATE_FORMAT(date, format) | DATEDIFF(unit, date1, date2) | DATE_TRUNC(unit, date)",
      example: `-- 日期格式化
SELECT DATE_FORMAT(created_at, '%Y-%m') as month,
  DATE_TRUNC('week', order_date) as week_start,
  DATEDIFF('day', login_time, NOW()) as days_since_login
FROM users`,
      scenario: '按时间周期统计，周/月/年汇总',
      tags: ['date', '时间', '关键时刻'],
      isSystem: true,
      createdAt: 0,
      updatedAt: 0
    },
    {
      id: 'sys-ref-7',
      title: '空值处理',
      syntax: 'COALESCE(val, ...) | IFNULL(val, default) | NULLIF(val1, val2)',
      example: `SELECT
  COALESCE(email, phone, 'unknown') as contact,
  IFNULL(total_amount, 0) as amount,
  -- 避免除零
  revenue / NULLIF(orders, 0) as avg_order_value
FROM sales`,
      scenario: '空值替换，避免除零错误',
      tags: ['null', '关键时刻', '空值'],
      isSystem: true,
      createdAt: 0,
      updatedAt: 0
    }
  ];
};

/**
 * 获取系统预置 SQL 模板
 */
export const getSystemSqlTemplates = (): SqlTemplate[] => {
  return [
    {
      id: 'sys-tpl-1',
      name: '用户充值分层',
      description: '按累计充值金额将用户分为大R、中R、小R三个层级',
      sql: `WITH user_recharge AS (
  SELECT
    user_id,
    SUM(amount) as total_amount,
    COUNT(*) as order_count,
    MAX(created_at) as last_order_time
  FROM recharge_orders
  WHERE status = 'completed'
  GROUP BY user_id
)
SELECT
  user_id,
  total_amount,
  order_count,
  last_order_time,
  CASE
    WHEN total_amount >= 10000 THEN '大R'
    WHEN total_amount >= 1000 THEN '中R'
    ELSE '小R'
  END as user_level,
  CASE
    WHEN DATEDIFF('day', last_order_time, NOW()) <= 7 THEN '高活'
    WHEN DATEDIFF('day', last_order_time, NOW()) <= 30 THEN '中活'
    ELSE '沉默'
  END as activity_level
FROM user_recharge
ORDER BY total_amount DESC`,
      params: [
        { name: 'recharge_orders', type: 'table', required: true, description: '充值订单表' },
        { name: '大R阈值', type: 'number', required: false, default: 10000 }
      ],
      category: 'user-segmentation',
      tags: ['用户分层', 'RFM', '充值'],
      usageCount: 0,
      isSystem: true,
      createdAt: 0,
      updatedAt: 0
    },
    {
      id: 'sys-tpl-2',
      name: '多表关联统计',
      description: '用户基础表 + 充值汇总 + 登录汇总，三表LEFT JOIN',
      sql: `-- 主表：用户基础信息
WITH base_users AS (
  SELECT id, name, register_time, channel
  FROM users
),
-- 充值汇总表
recharge_summary AS (
  SELECT
    user_id,
    SUM(amount) as total_recharge,
    COUNT(*) as recharge_count,
    MAX(created_at) as last_recharge_time
  FROM recharge_orders
  WHERE status = 'completed'
  GROUP BY user_id
),
-- 登录汇总表
login_summary AS (
  SELECT
    user_id,
    COUNT(*) as login_count,
    MAX(login_time) as last_login_time,
    DATEDIFF('day', MAX(login_time), NOW()) as days_inactive
  FROM user_logins
  GROUP BY user_id
)
-- 最终关联
SELECT
  b.id,
  b.name,
  b.channel,
  COALESCE(r.total_recharge, 0) as total_recharge,
  COALESCE(r.recharge_count, 0) as recharge_count,
  COALESCE(l.login_count, 0) as login_count,
  l.days_inactive
FROM base_users b
LEFT JOIN recharge_summary r ON b.id = r.user_id
LEFT JOIN login_summary l ON b.id = l.user_id
ORDER BY total_recharge DESC`,
      params: [
        { name: 'users', type: 'table', required: true, description: '用户基础表' },
        { name: 'recharge_orders', type: 'table', required: true, description: '充值订单表' },
        { name: 'user_logins', type: 'table', required: true, description: '登录记录表' }
      ],
      category: 'multi-table-join',
      tags: ['多表', '关联', '汇总'],
      usageCount: 0,
      isSystem: true,
      createdAt: 0,
      updatedAt: 0
    },
    {
      id: 'sys-tpl-3',
      name: '窗口函数-TOP N',
      description: '按分组取每组 TOP N 记录',
      sql: `-- 每个部门薪资 TOP 3
WITH ranked_employees AS (
  SELECT
    dept,
    name,
    salary,
    ROW_NUMBER() OVER (PARTITION BY dept ORDER BY salary DESC) as dept_rank,
    DENSE_RANK() OVER (ORDER BY salary DESC) as company_rank
  FROM employees
)
SELECT
  dept,
  name,
  salary,
  dept_rank,
  company_rank
FROM ranked_employees
WHERE dept_rank <= 3
ORDER BY dept, dept_rank`,
      params: [
        { name: 'employees', type: 'table', required: true, description: '员工表' },
        { name: 'TOP N', type: 'number', required: false, default: 3, description: '每组取几条' }
      ],
      category: 'window-function',
      tags: ['窗口', '排名', 'TOP N'],
      usageCount: 0,
      isSystem: true,
      createdAt: 0,
      updatedAt: 0
    },
    {
      id: 'sys-tpl-4',
      name: '累计计算',
      description: '按时间累计汇总，计算累计收入、累计订单数',
      sql: `-- 累计收入计算
WITH daily_sales AS (
  SELECT
    DATE_TRUNC('day', created_at) as sale_date,
    SUM(amount) as daily_revenue,
    COUNT(*) as daily_orders
  FROM orders
  WHERE status = 'completed'
  GROUP BY DATE_TRUNC('day', created_at)
),
running_total AS (
  SELECT
    sale_date,
    daily_revenue,
    daily_orders,
    SUM(daily_revenue) OVER (ORDER BY sale_date) as running_revenue,
    SUM(daily_orders) OVER (ORDER BY sale_date) as running_orders,
    -- 7日滑动平均
    AVG(daily_revenue) OVER (
      ORDER BY sale_date
      ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) as moving_avg_7d
  FROM daily_sales
)
SELECT
  sale_date,
  daily_revenue,
  running_revenue,
  daily_orders,
  running_orders,
  moving_avg_7d
FROM running_total
ORDER BY sale_date`,
      params: [
        { name: 'orders', type: 'table', required: true, description: '订单表' }
      ],
      category: 'time-series',
      tags: ['累计', '滑动平均', '时间序列'],
      usageCount: 0,
      isSystem: true,
      createdAt: 0,
      updatedAt: 0
    },
    {
      id: 'sys-tpl-5',
      name: '日环比/周环比',
      description: '计算日环比增长率，使用 LAG 偏移函数',
      sql: `-- 日环比计算
WITH daily_revenue AS (
  SELECT
    DATE(created_at) as date,
    SUM(amount) as revenue
  FROM orders
  WHERE status = 'completed'
  GROUP BY DATE(created_at)
),
with_lag AS (
  SELECT
    date,
    revenue,
    LAG(revenue, 1) OVER (ORDER BY date) as prev_day_revenue,
    LAG(revenue, 7) OVER (ORDER BY date) as prev_week_revenue
  FROM daily_revenue
)
SELECT
  date,
  revenue,
  prev_day_revenue,
  prev_week_revenue,
  -- 日环比
  ROUND((revenue - prev_day_revenue) / NULLIF(prev_day_revenue, 0) * 100, 2) as day_growth_pct,
  -- 周环比
  ROUND((revenue - prev_week_revenue) / NULLIF(prev_week_revenue, 0) * 100, 2) as week_growth_pct
FROM with_lag
ORDER BY date DESC`,
      params: [
        { name: 'orders', type: 'table', required: true, description: '订单表' }
      ],
      category: 'time-series',
      tags: ['环比', 'LAG', '增长率'],
      usageCount: 0,
      isSystem: true,
      createdAt: 0,
      updatedAt: 0
    },
    {
      id: 'sys-tpl-6',
      name: '组内占比计算',
      description: '计算各项占组内总值的百分比',
      sql: `-- 各类目销售额占比
WITH category_sales AS (
  SELECT
    category,
    SUM(amount) as category_revenue
  FROM orders
  WHERE status = 'completed'
  GROUP BY category
),
with_total AS (
  SELECT
    category,
    category_revenue,
    SUM(category_revenue) OVER () as total_revenue
  FROM category_sales
)
SELECT
  category,
  category_revenue,
  total_revenue,
  ROUND(category_revenue / total_revenue * 100, 2) as pct_of_total
FROM with_total
ORDER BY category_revenue DESC`,
      params: [
        { name: 'orders', type: 'table', required: true, description: '订单表' }
      ],
      category: 'aggregation',
      tags: ['占比', '百分比', '聚合'],
      usageCount: 0,
      isSystem: true,
      createdAt: 0,
      updatedAt: 0
    }
  ];
};

/**
 * 获取系统预置学习路径
 */
export const getSystemLearningPath = (): LearningStage[] => {
  return [
    {
      id: 'stage-basic',
      title: '第一周：基础查询',
      description: '掌握 SELECT 查询的七个关键词，理解数据流向',
      order: 1,
      isUnlocked: true,
      nodes: [
        {
          id: 'node-1-1',
          title: 'SELECT 与 FROM',
          description: '最基础的查询语句',
          content: `# SELECT 与 FROM

SELECT 是 SQL 最核心的关键字，用于指定要查询的列。

## 基本语法
\`\`\`sql
SELECT column1, column2, ...
FROM table_name;
\`\`\`

## 使用星号 * 
\`\`\`sql
SELECT * FROM users;  -- 查询所有列
\`\`\`

## 实战提示
- 尽量避免使用 *，明确列出需要的列可以提升性能
- 列别名使用 AS 关键字
\`\`\`sql
SELECT name AS 用户名, age AS 年龄 FROM users;
\`\`\``,
          order: 1,
          duration: 10,
          isCompleted: false,
          skills: []
        },
        {
          id: 'node-1-2',
          title: 'WHERE 条件筛选',
          description: '按条件过滤数据',
          content: `# WHERE 条件筛选

WHERE 用于过滤行，只有满足条件的记录才会被返回。

## 常用比较运算符
- \`=\` 等于
- \`<> 或 !=\` 不等于
- \`>\` \`<\` \`>=\` \`<=\` 大于/小于
- \`IN\` 在集合中
- \`BETWEEN ... AND ...\` 在范围内
- \`LIKE\` 模糊匹配
- \`IS NULL\` / \`IS NOT NULL\` 空值判断

## 示例
\`\`\`sql
SELECT * FROM users
WHERE age >= 18 AND status = 'active';

SELECT * FROM orders
WHERE created_at BETWEEN '2024-01-01' AND '2024-12-31';
\`\`\``,
          order: 2,
          duration: 15,
          isCompleted: false,
          skills: []
        },
        {
          id: 'node-1-3',
          title: 'GROUP BY 分组',
          description: '按维度聚合数据',
          content: `# GROUP BY 分组

GROUP BY 用于将数据按某个维度分组，通常与聚合函数配合使用。

## 聚合函数
- COUNT() 计数
- SUM() 求和
- AVG() 平均
- MAX() 最大
- MIN() 最小

## 示例
\`\`\`sql
-- 按部门统计人数和平均薪资
SELECT
  department,
  COUNT(*) as emp_count,
  AVG(salary) as avg_salary
FROM employees
GROUP BY department;
\`\`\`

## 注意事项
- SELECT 中的列要么在 GROUP BY 中，要么是聚合函数`,
          order: 3,
          duration: 15,
          isCompleted: false,
          skills: []
        },
        {
          id: 'node-1-4',
          title: 'ORDER BY 与 LIMIT',
          description: '排序与限制返回条数',
          content: `# ORDER BY 与 LIMIT

## ORDER BY 排序
\`\`\`sql
-- 按薪资降序
SELECT * FROM employees ORDER BY salary DESC;

-- 多列排序
SELECT * FROM users ORDER BY age ASC, created_at DESC;
\`\`\`

## LIMIT 限制条数
\`\`\`sql
-- 取前10条
SELECT * FROM users LIMIT 10;

-- 分页查询 (第2页，每页10条)
SELECT * FROM users LIMIT 10 OFFSET 10;
\`\`\``,
          order: 4,
          duration: 10,
          isCompleted: false,
          skills: []
        }
      ]
    },
    {
      id: 'stage-advanced',
      title: '第二周：数据加工',
      description: '掌握 CASE WHEN 与 CTE 临时表',
      order: 2,
      isUnlocked: false,
      nodes: [
        {
          id: 'node-2-1',
          title: 'CASE WHEN 条件分支',
          description: '数据分类与打标',
          content: `# CASE WHEN 条件分支

CASE WHEN 相当于编程中的 if-else 嵌套，用于数据分类。

## 基本语法
\`\`\`sql
CASE
  WHEN 条件1 THEN 结果1
  WHEN 条件2 THEN 结果2
  ELSE 默认结果
END
\`\`\`

## 示例：用户分层
\`\`\`sql
SELECT
  user_id,
  total_amount,
  CASE
    WHEN total_amount >= 10000 THEN '大R'
    WHEN total_amount >= 1000 THEN '中R'
    ELSE '小R'
  END as user_level
FROM user_recharge;
\`\`\``,
          order: 1,
          duration: 20,
          isCompleted: false,
          skills: []
        },
        {
          id: 'node-2-2',
          title: 'CTE 临时表',
          description: '用 WITH 提升复杂查询可读性',
          content: `# CTE 临时表

CTE (Common Table Expression) 用 WITH 关键字定义临时命名结果集。

## 语法
\`\`\`sql
WITH cte_name AS (
  SELECT ...
)
SELECT * FROM cte_name;
\`\`\`

## 多 CTE 串联
\`\`\`sql
WITH
  step1 AS (SELECT ...),
  step2 AS (SELECT * FROM step1 ...)
SELECT * FROM step2;
\`\`\`

## 优势
- 提升复杂查询可读性
- 中间结果可复用
- 可以连续定义多个临时表`,
          order: 2,
          duration: 20,
          isCompleted: false,
          skills: []
        }
      ]
    },
    {
      id: 'stage-join',
      title: '第三周：多表关联',
      description: '掌握 LEFT JOIN 与数据膨胀处理',
      order: 3,
      isUnlocked: false,
      nodes: [
        {
          id: 'node-3-1',
          title: 'JOIN 类型详解',
          description: 'INNER/LEFT/FULL JOIN 的区别',
          content: `# JOIN 类型详解

## INNER JOIN
只保留两边都匹配的记录

## LEFT JOIN
保留左表全部，右表无匹配补 NULL

## FULL JOIN
保留两边全部记录

## 示例
\`\`\`sql
SELECT u.name, o.amount
FROM users u
LEFT JOIN orders o ON u.id = o.user_id;
\`\`\``,
          order: 1,
          duration: 20,
          isCompleted: false,
          skills: []
        },
        {
          id: 'node-3-2',
          title: '数据膨胀与解决',
          description: '先聚合再关联的原则',
          content: `# 数据膨胀问题

## 为什么会膨胀？
如果用户有多条订单，直接 JOIN 会导致记录膨胀。

## 解决原则：先聚合再关联
\`\`\`sql
-- 错误写法：数据膨胀
SELECT u.name, o.*
FROM users u
LEFT JOIN orders o ON u.id = o.user_id;

-- 正确写法：先聚合
WITH order_summary AS (
  SELECT user_id, SUM(amount) total
  FROM orders GROUP BY user_id
)
SELECT u.name, o.total
FROM users u
LEFT JOIN order_summary o ON u.id = o.user_id;
\`\`\``,
          order: 2,
          duration: 20,
          isCompleted: false,
          skills: []
        }
      ]
    },
    {
      id: 'stage-window',
      title: '第四周：窗口函数',
      description: '在不减少行数的情况下做聚合计算',
      order: 4,
      isUnlocked: false,
      nodes: [
        {
          id: 'node-4-1',
          title: '窗口函数基础',
          description: 'OVER 关键字与框架',
          content: `# 窗口函数基础

窗口函数 = 普通函数 + OVER

## 基本结构
\`\`\`sql
FUNC() OVER (
  PARTITION BY col  -- 分组（可选）
  ORDER BY col       -- 排序（可选）
  ROWS BETWEEN ...   -- 窗口范围（可选）
)
\`\`\`

## 关键点
- 不减少数据行数
- 每行都能看到聚合结果`,
          order: 1,
          duration: 15,
          isCompleted: false,
          skills: []
        },
        {
          id: 'node-4-2',
          title: '排名函数',
          description: 'ROW_NUMBER/RANK/DENSE_RANK',
          content: `# 排名函数

## ROW_NUMBER() - 严格递增
1, 2, 3, 4...

## RANK() - 并列跳号
1, 1, 3, 4...

## DENSE_RANK() - 并列不跳号
1, 1, 2, 3...

## 取 TOP N
\`\`\`sql
SELECT * FROM (
  SELECT *, ROW_NUMBER() OVER (ORDER BY score DESC) as rn
  FROM users
) t WHERE rn <= 10;
\`\`\``,
          order: 2,
          duration: 20,
          isCompleted: false,
          skills: []
        },
        {
          id: 'node-4-3',
          title: '偏移函数',
          description: 'LAG 与 LEAD 取前后行',
          content: `# 偏移函数

## LAG(col, n) - 取前n行
## LEAD(col, n) - 取后n行

## 日环比示例
\`\`\`sql
SELECT
  date,
  revenue,
  LAG(revenue, 1) OVER (ORDER BY date) as prev_day,
  revenue - LAG(revenue, 1) OVER (ORDER BY date) as diff
FROM daily_sales;
\`\`\``,
          order: 3,
          duration: 20,
          isCompleted: false,
          skills: []
        }
      ]
    }
  ];
};

// ==================== 导出预设数据 ====================

/**
 * 初始化预置数据（首次加载时调用）
 */
export const initializeSystemData = async (): Promise<void> => {
  // 检查是否已有系统数据
  const existingCards = await getAllReferenceCards();
  if (existingCards.some(c => c.isSystem)) return;

  // 添加系统预置速查卡片
  const systemCards = getSystemReferenceCards();
  for (const card of systemCards) {
    await saveReferenceCard(card);
  }

  // 添加系统预置模板
  const systemTemplates = getSystemSqlTemplates();
  for (const template of systemTemplates) {
    await saveSqlTemplate(template);
  }

  // 添加系统预置学习路径
  const systemLearning = getSystemLearningPath();
  for (const stage of systemLearning) {
    await saveLearningProgress(stage);
  }

  // 初始化本体论数据
  await initializeOntologyData();

  console.log('[Library] System data initialized');
};

// ==================== 本体论 CRUD ====================

/**
 * 保存本体论条目
 */
export const saveOntologyEntry = async (entry: Omit<OntologyEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<OntologyEntry> => {
  const db = await openDB();
  const now = Date.now();
  const newEntry: OntologyEntry = {
    ...entry,
    id: generateId(),
    createdAt: now,
    updatedAt: now
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.ONTOLOGY_ENTRIES, 'readwrite');
    const store = transaction.objectStore(STORES.ONTOLOGY_ENTRIES);
    const request = store.add(newEntry);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(newEntry);
  });
};

/**
 * 获取所有本体论条目
 */
export const getAllOntologyEntries = async (): Promise<OntologyEntry[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.ONTOLOGY_ENTRIES, 'readonly');
    const store = transaction.objectStore(STORES.ONTOLOGY_ENTRIES);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
};

/**
 * 根据 ID 获取本体论条目
 */
export const getOntologyEntryById = async (id: string): Promise<OntologyEntry | undefined> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.ONTOLOGY_ENTRIES, 'readonly');
    const store = transaction.objectStore(STORES.ONTOLOGY_ENTRIES);
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

/**
 * 更新本体论条目
 */
export const updateOntologyEntry = async (entry: OntologyEntry): Promise<OntologyEntry> => {
  const db = await openDB();
  const updatedEntry = { ...entry, updatedAt: Date.now() };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.ONTOLOGY_ENTRIES, 'readwrite');
    const store = transaction.objectStore(STORES.ONTOLOGY_ENTRIES);
    const request = store.put(updatedEntry);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(updatedEntry);
  });
};

/**
 * 删除本体论条目
 */
export const deleteOntologyEntry = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.ONTOLOGY_ENTRIES, 'readwrite');
    const store = transaction.objectStore(STORES.ONTOLOGY_ENTRIES);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

/**
 * 获取子条目
 */
export const getChildEntries = async (parentId: string): Promise<OntologyEntry[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.ONTOLOGY_ENTRIES, 'readonly');
    const store = transaction.objectStore(STORES.ONTOLOGY_ENTRIES);
    const index = store.index('parentId');
    const request = index.getAll(parentId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
};

// ==================== 本体论视图 CRUD ====================

/**
 * 保存本体论视图
 */
export const saveOntologyView = async (view: Omit<OntologyView, 'id' | 'createdAt' | 'updatedAt'>): Promise<OntologyView> => {
  const db = await openDB();
  const now = Date.now();
  const newView: OntologyView = {
    ...view,
    id: generateId(),
    createdAt: now,
    updatedAt: now
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.ONTOLOGY_VIEWS, 'readwrite');
    const store = transaction.objectStore(STORES.ONTOLOGY_VIEWS);
    const request = store.add(newView);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(newView);
  });
};

/**
 * 获取所有本体论视图
 */
export const getAllOntologyViews = async (): Promise<OntologyView[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.ONTOLOGY_VIEWS, 'readonly');
    const store = transaction.objectStore(STORES.ONTOLOGY_VIEWS);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
};

/**
 * 更新本体论视图
 */
export const updateOntologyView = async (view: OntologyView): Promise<OntologyView> => {
  const db = await openDB();
  const updatedView = { ...view, updatedAt: Date.now() };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.ONTOLOGY_VIEWS, 'readwrite');
    const store = transaction.objectStore(STORES.ONTOLOGY_VIEWS);
    const request = store.put(updatedView);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(updatedView);
  });
};

/**
 * 删除本体论视图
 */
export const deleteOntologyView = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.ONTOLOGY_VIEWS, 'readwrite');
    const store = transaction.objectStore(STORES.ONTOLOGY_VIEWS);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

// ==================== 数据抽象表 CRUD ====================

/**
 * 保存数据抽象表
 */
export const saveAbstractionTable = async (table: Omit<AbstractionTable, 'id' | 'createdAt' | 'updatedAt'>): Promise<AbstractionTable> => {
  const db = await openDB();
  const now = Date.now();
  const newTable: AbstractionTable = {
    ...table,
    id: generateId(),
    createdAt: now,
    updatedAt: now
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.ABSTRACTION_TABLES, 'readwrite');
    const store = transaction.objectStore(STORES.ABSTRACTION_TABLES);
    const request = store.add(newTable);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(newTable);
  });
};

/**
 * 获取所有数据抽象表
 */
export const getAllAbstractionTables = async (): Promise<AbstractionTable[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.ABSTRACTION_TABLES, 'readonly');
    const store = transaction.objectStore(STORES.ABSTRACTION_TABLES);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
};

/**
 * 根据 ID 获取数据抽象表
 */
export const getAbstractionTableById = async (id: string): Promise<AbstractionTable | undefined> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.ABSTRACTION_TABLES, 'readonly');
    const store = transaction.objectStore(STORES.ABSTRACTION_TABLES);
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

/**
 * 更新数据抽象表
 */
export const updateAbstractionTable = async (table: AbstractionTable): Promise<AbstractionTable> => {
  const db = await openDB();
  const updatedTable = { ...table, updatedAt: Date.now() };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.ABSTRACTION_TABLES, 'readwrite');
    const store = transaction.objectStore(STORES.ABSTRACTION_TABLES);
    const request = store.put(updatedTable);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(updatedTable);
  });
};

/**
 * 删除数据抽象表
 */
export const deleteAbstractionTable = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.ABSTRACTION_TABLES, 'readwrite');
    const store = transaction.objectStore(STORES.ABSTRACTION_TABLES);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

// ==================== 系统预置本体论数据 ====================

/**
 * 获取系统预置本体论条目
 */
export const getSystemOntologyEntries = (): OntologyEntry[] => {
  const now = Date.now();
  
  return [
    // ===== 第一层：抽象概念 (CONCEPT) =====
    {
      id: 'onto-concept-entity',
      name: '实体',
      fullName: 'sql.concept.entity',
      abstractionLevel: 'concept',
      semanticType: 'ATTRIBUTE',
      description: '数据库中的基本数据对象，代表业务意义上的对象主体',
      example: '用户、订单、商品、员工等',
      sqlTemplate: 'SELECT * FROM ${table} WHERE id = ?',
      parentId: undefined,
      childIds: ['onto-instance-user', 'onto-instance-order', 'onto-instance-product'],
      relatedEntries: [],
      tags: ['概念', '实体', '核心'],
      domain: 'SQL',
      isSystem: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'onto-concept-dimension',
      name: '维度',
      fullName: 'sql.concept.dimension',
      abstractionLevel: 'concept',
      semanticType: 'DIMENSION',
      description: '用于分析和观察数据的角度，如时间、地域、渠道等',
      example: '时间维度、地区维度、渠道维度、品类维度',
      sqlTemplate: 'SELECT ${dimension}, COUNT(*) FROM ${table} GROUP BY ${dimension}',
      parentId: undefined,
      childIds: ['onto-property-time', 'onto-property-region', 'onto-property-channel'],
      relatedEntries: [],
      tags: ['概念', '维度', '分析'],
      domain: '分析',
      isSystem: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'onto-concept-measure',
      name: '度量',
      fullName: 'sql.concept.measure',
      abstractionLevel: 'concept',
      semanticType: 'MEASURE',
      description: '可量化的数值指标，通常需要聚合函数计算',
      example: '销售额、订单数、用户数、转化率',
      sqlTemplate: 'SELECT SUM(${measure}) FROM ${table}',
      parentId: undefined,
      childIds: ['onto-property-amount', 'onto-property-count', 'onto-property-rate'],
      relatedEntries: [],
      tags: ['概念', '度量', '指标'],
      domain: '分析',
      isSystem: true,
      createdAt: now,
      updatedAt: now
    },
    // ===== 第二层：属性 (PROPERTY) =====
    {
      id: 'onto-property-time',
      name: '时间',
      fullName: 'sql.property.time',
      abstractionLevel: 'property',
      semanticType: 'TIME',
      description: '时间相关的属性，用于时间序列分析和周期统计',
      sqlTemplate: "SELECT DATE_TRUNC('${unit}', ${time_column}) AS period FROM ${table}",
      parentId: 'onto-concept-dimension',
      childIds: [],
      relatedEntries: [],
      tags: ['属性', '时间', '维度'],
      domain: 'SQL',
      isSystem: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'onto-property-region',
      name: '地域',
      fullName: 'sql.property.region',
      abstractionLevel: 'property',
      semanticType: 'DIMENSION',
      description: '地理位置相关的属性，如国家、省份、城市',
      sqlTemplate: 'SELECT ${region}, SUM(${metric}) FROM ${table} GROUP BY ${region}',
      parentId: 'onto-concept-dimension',
      childIds: [],
      relatedEntries: [],
      tags: ['属性', '地域', '维度'],
      domain: 'SQL',
      isSystem: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'onto-property-amount',
      name: '金额',
      fullName: 'sql.property.amount',
      abstractionLevel: 'property',
      semanticType: 'MEASURE',
      description: '货币金额属性，用于财务统计',
      sqlTemplate: 'SELECT SUM(${amount}) AS total_amount FROM ${table}',
      parentId: 'onto-concept-measure',
      childIds: [],
      relatedEntries: [],
      tags: ['属性', '金额', '度量'],
      domain: '业务',
      isSystem: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'onto-property-count',
      name: '数量',
      fullName: 'sql.property.count',
      abstractionLevel: 'property',
      semanticType: 'MEASURE',
      description: '计数属性，统计事件发生的次数',
      sqlTemplate: 'SELECT COUNT(*) AS ${count_alias} FROM ${table}',
      parentId: 'onto-concept-measure',
      childIds: [],
      relatedEntries: [],
      tags: ['属性', '数量', '度量'],
      domain: '业务',
      isSystem: true,
      createdAt: now,
      updatedAt: now
    },
    // ===== 第三层：关系 (RELATION) =====
    {
      id: 'onto-relation-has-many',
      name: '一对多',
      fullName: 'sql.relation.has-many',
      abstractionLevel: 'relation',
      semanticType: 'RELATIONSHIP',
      description: '一个实体对应多个其他实体，如一个用户有多个订单',
      example: '用户 HAS_MANY 订单',
      sqlTemplate: 'SELECT u.*, o.* FROM ${parent_table} u LEFT JOIN ${child_table} o ON u.id = o.${parent_id}',
      parentId: undefined,
      childIds: [],
      relatedEntries: [
        { targetId: 'onto-instance-user', relationType: 'has_many', description: '一个用户可以有多个订单' },
        { targetId: 'onto-instance-order', relationType: 'belongs_to', description: '每个订单属于一个用户' }
      ],
      tags: ['关系', '一对多', '关联'],
      domain: 'SQL',
      isSystem: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'onto-relation-many-to-many',
      name: '多对多',
      fullName: 'sql.relation.many-to-many',
      abstractionLevel: 'relation',
      semanticType: 'RELATIONSHIP',
      description: '多个实体对应多个其他实体，通常需要中间表',
      example: '用户 MANY_TO_MANY 角色（通过用户角色中间表）',
      sqlTemplate: 'SELECT * FROM ${table1} t1 JOIN ${junction_table} j ON t1.id = j.${table1}_id JOIN ${table2} t2 ON j.${table2}_id = t2.id',
      parentId: undefined,
      childIds: [],
      relatedEntries: [],
      tags: ['关系', '多对多', '关联'],
      domain: 'SQL',
      isSystem: true,
      createdAt: now,
      updatedAt: now
    },
    // ===== 第四层：实例 (INSTANCE) =====
    {
      id: 'onto-instance-user',
      name: '用户',
      fullName: 'sql.instance.user',
      abstractionLevel: 'instance',
      semanticType: 'IDENTIFIER',
      description: '系统中的用户实体',
      sqlTemplate: 'SELECT * FROM users WHERE id = ?',
      parentId: 'onto-concept-entity',
      childIds: [],
      relatedEntries: [
        { targetId: 'onto-instance-order', relationType: 'has_many', description: '用户可以有多个订单' },
        { targetId: 'onto-property-amount', relationType: 'has_a', description: '用户有消费金额属性' }
      ],
      tags: ['实例', '用户', '实体'],
      domain: '业务',
      isSystem: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'onto-instance-order',
      name: '订单',
      fullName: 'sql.instance.order',
      abstractionLevel: 'instance',
      semanticType: 'IDENTIFIER',
      description: '用户的购买订单',
      sqlTemplate: 'SELECT * FROM orders WHERE user_id = ?',
      parentId: 'onto-concept-entity',
      childIds: [],
      relatedEntries: [
        { targetId: 'onto-instance-user', relationType: 'belongs_to', description: '订单属于某个用户' },
        { targetId: 'onto-property-amount', relationType: 'has_a', description: '订单有金额属性' }
      ],
      tags: ['实例', '订单', '实体'],
      domain: '业务',
      isSystem: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'onto-instance-product',
      name: '商品',
      fullName: 'sql.instance.product',
      abstractionLevel: 'instance',
      semanticType: 'IDENTIFIER',
      description: '销售的商品',
      sqlTemplate: 'SELECT * FROM products WHERE id = ?',
      parentId: 'onto-concept-entity',
      childIds: [],
      relatedEntries: [],
      tags: ['实例', '商品', '实体'],
      domain: '业务',
      isSystem: true,
      createdAt: now,
      updatedAt: now
    },
    // ===== 计算派生 =====
    {
      id: 'onto-computed-rate',
      name: '转化率',
      fullName: 'sql.computed.conversion-rate',
      abstractionLevel: 'instance',
      semanticType: 'COMPUTED',
      description: '由基础指标计算派生的比率指标',
      sqlTemplate: 'SELECT CAST(SUM(${action}) AS FLOAT) / COUNT(*) AS ${rate_name} FROM ${table}',
      parentId: 'onto-concept-measure',
      childIds: [],
      relatedEntries: [
        { targetId: 'onto-property-count', relationType: 'depends_on', description: '依赖数量计算' }
      ],
      tags: ['计算', '派生', '比率'],
      domain: '分析',
      isSystem: true,
      createdAt: now,
      updatedAt: now
    }
  ];
};

/**
 * 初始化预置本体论数据
 */
export const initializeOntologyData = async (): Promise<void> => {
  const existingEntries = await getAllOntologyEntries();
  if (existingEntries.some(e => e.isSystem)) return;

  const systemEntries = getSystemOntologyEntries();
  for (const entry of systemEntries) {
    await saveOntologyEntry(entry);
  }

  console.log('[Library] Ontology data initialized');
};

// ==================== Abstraction 补充方法 ====================

/**
 * 根据领域获取抽象表
 */
export const getAbstractionTablesByDomain = async (domain: string): Promise<AbstractionTable[]> => {
  const tables = await getAllAbstractionTables();
  return tables.filter(t => t.domain === domain);
};

/**
 * 根据操作类型获取抽象表
 */
export const getAbstractionTablesByOperation = async (
  operation: string
): Promise<AbstractionTable[]> => {
  const tables = await getAllAbstractionTables();
  return tables.filter(t => t.sqlConfig.operation === operation);
};

/**
 * 获取收藏的抽象表
 */
export const getFavoriteAbstractionTables = async (): Promise<AbstractionTable[]> => {
  const tables = await getAllAbstractionTables();
  return tables.filter(t => t.isFavorite);
};

/**
 * 搜索抽象表
 */
export const searchAbstractionTables = async (query: string): Promise<AbstractionTable[]> => {
  if (!query.trim()) {
    return getAllAbstractionTables();
  }

  const tables = await getAllAbstractionTables();
  const lowerQuery = query.toLowerCase();

  return tables.filter(
    t =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description?.toLowerCase().includes(lowerQuery) ||
      t.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      t.sqlConfig.template.toLowerCase().includes(lowerQuery)
  );
};

/**
 * 切换抽象表收藏状态
 */
export const toggleAbstractionFavorite = async (id: string): Promise<AbstractionTable | null> => {
  const tables = await getAllAbstractionTables();
  const table = tables.find(t => t.id === id);

  if (!table) return null;

  const updated: AbstractionTable = {
    ...table,
    isFavorite: !table.isFavorite,
    updatedAt: Date.now(),
  };

  await updateAbstractionTable(updated);
  return updated;
};

/**
 * 获取抽象表统计信息
 */
export const getAbstractionStats = async (): Promise<{
  total: number;
  byDomain: Record<string, number>;
  byOperation: Record<string, number>;
}> => {
  const tables = await getAllAbstractionTables();

  const stats = {
    total: tables.length,
    byDomain: {} as Record<string, number>,
    byOperation: {} as Record<string, number>,
  };

  for (const table of tables) {
    stats.byDomain[table.domain] = (stats.byDomain[table.domain] || 0) + 1;
    const op = table.sqlConfig.operation;
    stats.byOperation[op] = (stats.byOperation[op] || 0) + 1;
  }

  return stats;
};

/**
 * 批量保存抽象表（用于导入）
 */
export const batchSaveAbstractionTables = async (
  tables: Omit<AbstractionTable, 'id' | 'createdAt' | 'updatedAt'>[]
): Promise<AbstractionTable[]> => {
  const saved: AbstractionTable[] = [];

  for (const table of tables) {
    const result = await saveAbstractionTable(table);
    saved.push(result);
  }

  return saved;
};

// ==================== AI Session 会话管理 ====================

/** 获取指定数据库的所有会话（按最近更新时间倒序） */
export const getAISessions = async (database: string): Promise<AISession[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.AI_SESSIONS, 'readonly');
    const store = tx.objectStore(STORES.AI_SESSIONS);
    const index = store.index('database');
    const request = index.getAll(database);

    request.onsuccess = () => {
      const sessions = (request.result as AISession[]).sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(sessions);
    };
    request.onerror = () => reject(request.error);
  });
};

/** 创建新会话 */
export const createAISession = async (
  database: string,
  name: string
): Promise<AISession> => {
  const db = await openDB();
  const now = Date.now();
  const session: AISession = {
    id: generateId(),
    database,
    name,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.AI_SESSIONS, 'readwrite');
    const request = tx.objectStore(STORES.AI_SESSIONS).add(session);
    request.onsuccess = () => resolve(session);
    request.onerror = () => reject(request.error);
  });
};

/** 更新会话（追加消息、修改名称等） */
export const updateAISession = async (session: AISession): Promise<AISession> => {
  const db = await openDB();
  const updated = { ...session, updatedAt: Date.now() };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.AI_SESSIONS, 'readwrite');
    const request = tx.objectStore(STORES.AI_SESSIONS).put(updated);
    request.onsuccess = () => resolve(updated);
    request.onerror = () => reject(request.error);
  });
};

/** 删除会话 */
export const deleteAISession = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.AI_SESSIONS, 'readwrite');
    const request = tx.objectStore(STORES.AI_SESSIONS).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};
