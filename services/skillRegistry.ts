/**
 * AI Skills Registry
 * 
 * Central registry for all available AI skills.
 * This module manages skill definitions, categories, and provides
 * a unified interface for skill discovery and invocation.
 */

import { AISkill, SkillCategory } from '../types';

/**
 * Built-in skill definitions organized by category
 */
export const BUILT_IN_SKILLS: AISkill[] = [
  // ==================== SQL Generation Skills ====================
  {
    id: 'sql-select-generator',
    name: 'SELECT 查询生成',
    description: '根据自然语言描述生成 SELECT 查询语句',
    category: 'sql',
    icon: '🔍',
    inputSchema: [
      {
        name: 'description',
        type: 'textarea',
        required: true,
        label: '查询描述',
        placeholder: '例如：查询所有订单金额大于1000元的客户',
        rows: 3
      },
      {
        name: 'conditions',
        type: 'textarea',
        required: false,
        label: '筛选条件',
        placeholder: 'WHERE 条件，可选'
      },
      {
        name: 'orderBy',
        type: 'select',
        required: false,
        label: '排序方式',
        options: ['不排序', '升序', '降序']
      },
      {
        name: 'limit',
        type: 'number',
        required: false,
        label: '返回行数',
        defaultValue: 100,
        min: 1,
        max: 10000
      }
    ],
    outputType: 'sql',
    requiresTable: true,
    requiresColumns: true,
    examples: [
      {
        name: '基础查询',
        input: { description: '查询所有用户' },
        description: '生成最基本的 SELECT 查询'
      },
      {
        name: '条件查询',
        input: { description: '查询活跃用户', conditions: 'status = \'active\'' },
        description: '带 WHERE 条件的查询'
      }
    ]
  },
  {
    id: 'sql-join-generator',
    name: 'JOIN 查询生成',
    description: '生成多表关联查询',
    category: 'sql',
    icon: '🔗',
    inputSchema: [
      {
        name: 'joinType',
        type: 'select',
        required: true,
        label: '连接类型',
        options: ['INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'CROSS JOIN', 'FULL OUTER JOIN'],
        defaultValue: 'INNER JOIN'
      },
      {
        name: 'rightTable',
        type: 'table',
        required: true,
        label: '右表'
      },
      {
        name: 'joinCondition',
        type: 'text',
        required: true,
        label: '连接条件',
        placeholder: '例如：a.user_id = b.id'
      },
      {
        name: 'selectColumns',
        type: 'text',
        required: false,
        label: '选择列',
        placeholder: 'a.*, b.name'
      }
    ],
    outputType: 'sql',
    requiresTable: true,
    requiresColumns: true,
    examples: [
      {
        name: '用户订单关联',
        input: { joinType: 'INNER JOIN', joinCondition: 'a.user_id = b.id', selectColumns: 'a.*, b.order_id, b.total_amount' },
        description: '关联用户表和订单表'
      },
      {
        name: '左连接查询',
        input: { joinType: 'LEFT JOIN', joinCondition: 'a.product_id = b.id', selectColumns: 'a.*, b.category_name' },
        description: '使用左连接保留左表所有记录'
      }
    ]
  },
  {
    id: 'sql-aggregation-generator',
    name: '聚合查询生成',
    description: '生成聚合函数和分组查询',
    category: 'sql',
    icon: '📊',
    inputSchema: [
      {
        name: 'aggregationType',
        type: 'select',
        required: true,
        label: '聚合类型',
        options: ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', '多聚合'],
        defaultValue: 'COUNT'
      },
      {
        name: 'groupBy',
        type: 'text',
        required: false,
        label: '分组列',
        placeholder: '按某列分组'
      },
      {
        name: 'having',
        type: 'text',
        required: false,
        label: 'HAVING 条件',
        placeholder: '分组后筛选'
      }
    ],
    outputType: 'sql',
    requiresTable: true,
    requiresColumns: true
  },
  {
    id: 'sql-window-function',
    name: '窗口函数查询',
    description: '生成窗口函数（OVER, PARTITION BY, RANK 等）',
    category: 'sql',
    icon: '🪟',
    inputSchema: [
      {
        name: 'windowFunction',
        type: 'select',
        required: true,
        label: '窗口函数',
        options: ['ROW_NUMBER', 'RANK', 'DENSE_RANK', 'LAG', 'LEAD', 'SUM OVER', 'AVG OVER', 'FIRST_VALUE', 'LAST_VALUE'],
        defaultValue: 'ROW_NUMBER'
      },
      {
        name: 'partitionBy',
        type: 'text',
        required: false,
        label: '分区列',
        placeholder: 'PARTITION BY col'
      },
      {
        name: 'orderBy',
        type: 'text',
        required: false,
        label: '排序列',
        placeholder: 'ORDER BY col'
      },
      {
        name: 'frame',
        type: 'select',
        required: false,
        label: '窗口范围',
        options: ['无', 'ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW', 'ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING'],
        defaultValue: '无'
      }
    ],
    outputType: 'sql',
    requiresTable: true,
    requiresColumns: true
  },
  {
    id: 'sql-cte-generator',
    name: 'CTE 查询生成',
    description: '生成 Common Table Expression（WITH 子句）',
    category: 'sql',
    icon: '🌳',
    inputSchema: [
      {
        name: 'cteName',
        type: 'text',
        required: true,
        label: 'CTE 名称',
        placeholder: '例如：recent_orders'
      },
      {
        name: 'cteQuery',
        type: 'textarea',
        required: true,
        label: 'CTE 查询',
        placeholder: 'SELECT ... FROM ...',
        rows: 3
      },
      {
        name: 'mainQuery',
        type: 'textarea',
        required: true,
        label: '主查询',
        placeholder: 'SELECT * FROM cte_name ...',
        rows: 3
      }
    ],
    outputType: 'sql',
    requiresTable: true
  },
  {
    id: 'sql-insert-generator',
    name: 'INSERT 语句生成',
    description: '生成数据插入语句',
    category: 'sql',
    icon: '➕',
    inputSchema: [
      {
        name: 'values',
        type: 'textarea',
        required: true,
        label: '插入值',
        placeholder: "VALUES (val1, val2, ...)",
        rows: 3
      },
      {
        name: 'mode',
        type: 'select',
        required: true,
        label: '插入模式',
        options: ['普通 INSERT', 'INSERT ... RETURNING', 'INSERT ... ON CONFLICT'],
        defaultValue: '普通 INSERT'
      },
      {
        name: 'conflictAction',
        type: 'select',
        required: false,
        label: '冲突处理',
        options: ['DO NOTHING', 'DO UPDATE SET']
      }
    ],
    outputType: 'sql',
    requiresTable: true,
    requiresColumns: true
  },
  {
    id: 'sql-update-generator',
    name: 'UPDATE 语句生成',
    description: '生成数据更新语句',
    category: 'sql',
    icon: '✏️',
    inputSchema: [
      {
        name: 'setClause',
        type: 'text',
        required: true,
        label: '更新字段',
        placeholder: 'column = new_value'
      },
      {
        name: 'whereCondition',
        type: 'text',
        required: true,
        label: '更新条件',
        placeholder: 'WHERE id = ?'
      },
      {
        name: 'returning',
        type: 'boolean',
        required: false,
        label: '返回更新行',
        defaultValue: false
      }
    ],
    outputType: 'sql',
    requiresTable: true,
    requiresColumns: true
  },
  {
    id: 'sql-delete-generator',
    name: 'DELETE 语句生成',
    description: '生成数据删除语句',
    category: 'sql',
    icon: '🗑️',
    inputSchema: [
      {
        name: 'whereCondition',
        type: 'text',
        required: true,
        label: '删除条件',
        placeholder: 'WHERE id = ?'
      },
      {
        name: 'limit',
        type: 'number',
        required: false,
        label: '限制删除行数'
      },
      {
        name: 'returning',
        type: 'boolean',
        required: false,
        label: '返回删除行',
        defaultValue: false
      }
    ],
    outputType: 'sql',
    requiresTable: true,
    requiresColumns: true
  },
  {
    id: 'sql-create-table-generator',
    name: 'CREATE TABLE 生成',
    description: '生成建表语句，支持完整表结构定义',
    category: 'sql',
    icon: '🏗️',
    inputSchema: [
      {
        name: 'tableName',
        type: 'text',
        required: true,
        label: '表名',
        placeholder: '例如：users, orders, products'
      },
      {
        name: 'columns',
        type: 'textarea',
        required: true,
        label: '列定义',
        rows: 6,
        placeholder: `格式：列名 类型 [约束]
示例：
id INTEGER PRIMARY KEY,
name VARCHAR(100) NOT NULL,
email VARCHAR(255) UNIQUE,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
status VARCHAR(20) DEFAULT 'active'`
      },
      {
        name: 'primaryKey',
        type: 'text',
        required: false,
        label: '主键',
        placeholder: '例如：id 或 (id, name)'
      },
      {
        name: 'foreignKeys',
        type: 'textarea',
        required: false,
        label: '外键',
        rows: 3,
        placeholder: `格式：FOREIGN KEY (列名) REFERENCES 表名(列名)
示例：
FOREIGN KEY (user_id) REFERENCES users(id),
FOREIGN KEY (category_id) REFERENCES categories(id)`
      },
      {
        name: 'indexes',
        type: 'textarea',
        required: false,
        label: '索引',
        rows: 3,
        placeholder: `格式：INDEX 索引名 (列名)
示例：
INDEX idx_email (email),
INDEX idx_created (created_at)`
      },
      {
        name: 'engine',
        type: 'select',
        required: false,
        label: '存储引擎',
        options: ['默认', 'DuckDB', 'Memory', 'Parquet'],
        defaultValue: '默认'
      },
      {
        name: 'ifNotExists',
        type: 'boolean',
        required: false,
        label: 'IF NOT EXISTS',
        defaultValue: true
      }
    ],
    outputType: 'sql',
    requiresTable: false,
    requiresColumns: false,
    examples: [
      {
        name: '用户表',
        input: { 
          tableName: 'users',
          columns: `id INTEGER PRIMARY KEY,
username VARCHAR(50) NOT NULL,
email VARCHAR(100) NOT NULL,
password_hash VARCHAR(255) NOT NULL,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
last_login TIMESTAMP`,
          primaryKey: 'id',
          ifNotExists: true
        },
        description: '创建完整的用户表'
      },
      {
        name: '订单表',
        input: { 
          tableName: 'orders',
          columns: `order_id BIGINT PRIMARY KEY,
user_id INTEGER NOT NULL,
total_amount DECIMAL(10,2),
status VARCHAR(20) DEFAULT 'pending',
created_at TIMESTAMP`,
          foreignKeys: 'FOREIGN KEY (user_id) REFERENCES users(id)',
          ifNotExists: true
        },
        description: '创建订单表并设置外键'
      }
    ]
  },
  {
    id: 'sql-create-table-nl',
    name: '自然语言建表',
    description: '用自然语言描述需求，AI 自动生成表结构',
    category: 'sql',
    icon: '✨',
    inputSchema: [
      {
        name: 'description',
        type: 'textarea',
        required: true,
        label: '表需求描述',
        rows: 4,
        placeholder: `用自然语言描述你的表需求：

例如：创建一个用户管理系统，包含用户基本信息（用户名、邮箱、手机号、注册时间）、用户状态、会员等级等信息。还需要记录用户的收货地址，每位用户可以有多个收货地址。`
      },
      {
        name: 'businessDomain',
        type: 'select',
        required: false,
        label: '业务领域',
        options: ['通用', '电商', '用户管理', '订单系统', '库存管理', '财务', '日志分析', '物联网'],
        defaultValue: '通用'
      },
      {
        name: 'includeSample',
        type: 'boolean',
        required: false,
        label: '包含示例数据',
        defaultValue: false
      },
      {
        name: 'useAI',
        type: 'boolean',
        required: false,
        label: '启用 AI 增强',
        defaultValue: true,
        description: '使用 AI 分析需求并优化表结构'
      }
    ],
    outputType: 'sql',
    requiresTable: false,
    requiresColumns: false,
    examples: [
      {
        name: '电商订单表',
        input: {
          description: '创建电商订单系统，包含订单主表和订单明细表。订单包含订单号、用户、下单时间、订单金额、支付状态、物流信息。订单明细包含商品、价格、数量、小计。',
          businessDomain: '电商',
          includeSample: true,
          useAI: true
        },
        description: '根据电商业务需求生成完整订单系统'
      }
    ]
  },
  {
    id: 'sql-create-table-template',
    name: '模板建表',
    description: '使用预置模板快速创建标准表结构',
    category: 'sql',
    icon: '📋',
    inputSchema: [
      {
        name: 'templateType',
        type: 'select',
        required: true,
        label: '选择模板',
        options: ['用户表', '订单表', '商品表', '分类表', '支付记录表', '日志表', '配置表', '关系表'],
        defaultValue: '用户表'
      },
      {
        name: 'tableName',
        type: 'text',
        required: true,
        label: '表名',
        placeholder: '自定义表名，留空使用模板默认名'
      },
      {
        name: 'customizeFields',
        type: 'textarea',
        required: false,
        label: '自定义字段',
        rows: 3,
        placeholder: '添加自定义字段，每行一个：字段名 类型'
      },
      {
        name: 'addStatus',
        type: 'boolean',
        required: false,
        label: '包含状态字段',
        defaultValue: true
      },
      {
        name: 'addTimestamps',
        type: 'boolean',
        required: false,
        label: '包含时间戳',
        defaultValue: true
      }
    ],
    outputType: 'sql',
    requiresTable: false,
    requiresColumns: false,
    examples: [
      {
        name: '会员用户表',
        input: {
          templateType: '用户表',
          tableName: 'members',
          addStatus: true,
          addTimestamps: true
        },
        description: '基于用户表模板创建会员表'
      }
    ]
  },
  {
    id: 'sql-create-table-import',
    name: '导入建表',
    description: '从 JSON、CSV 或剪切板导入表结构',
    category: 'sql',
    icon: '📥',
    inputSchema: [
      {
        name: 'importSource',
        type: 'select',
        required: true,
        label: '导入来源',
        options: ['JSON', 'CSV', '剪切板'],
        defaultValue: 'JSON'
      },
      {
        name: 'importData',
        type: 'textarea',
        required: true,
        label: '导入数据',
        rows: 8,
        placeholder: `JSON 格式示例：
[
  {"name": "id", "type": "INTEGER", "pk": true},
  {"name": "username", "type": "VARCHAR(50)", "notNull": true},
  {"name": "email", "type": "VARCHAR(255)", "unique": true},
  {"name": "status", "type": "VARCHAR(20)", "default": "active"}
]

或 CSV 格式：
name,type,pk,notNull,unique,default
id,INTEGER,true,true,false,
username,VARCHAR(50),false,true,false,
email,VARCHAR(255),false,true,true,`
      },
      {
        name: 'tableName',
        type: 'text',
        required: true,
        label: '表名',
        placeholder: '导入后的表名'
      },
      {
        name: 'inferTypes',
        type: 'boolean',
        required: false,
        label: '智能推断类型',
        defaultValue: true,
        description: '从数据值推断列类型'
      }
    ],
    outputType: 'sql',
    requiresTable: false,
    requiresColumns: false
  },

  // ==================== Analysis Skills ====================
  {
    id: 'sql-alter-table-generator',
    name: 'ALTER TABLE 生成',
    description: '生成表结构修改语句（添加/修改/删除列）',
    category: 'sql',
    icon: '🔧',
    inputSchema: [
      {
        name: 'alterType',
        type: 'select',
        required: true,
        label: '操作类型',
        options: ['添加列', '修改列', '删除列', '添加约束', '删除约束', '重命名表'],
        defaultValue: '添加列'
      },
      {
        name: 'columnName',
        type: 'text',
        required: false,
        label: '列名',
        placeholder: '要操作的列名'
      },
      {
        name: 'columnDefinition',
        type: 'text',
        required: false,
        label: '列定义',
        placeholder: '例如：VARCHAR(100) NOT NULL'
      },
      {
        name: 'constraint',
        type: 'text',
        required: false,
        label: '约束',
        placeholder: '例如：PRIMARY KEY, UNIQUE, CHECK'
      },
      {
        name: 'ifExists',
        type: 'boolean',
        required: false,
        label: 'IF EXISTS',
        defaultValue: false
      }
    ],
    outputType: 'sql',
    requiresTable: true,
    requiresColumns: true
  },
  {
    id: 'sql-drop-table-generator',
    name: 'DROP TABLE 生成',
    description: '生成删除表语句',
    category: 'sql',
    icon: '💣',
    inputSchema: [
      {
        name: 'tableName',
        type: 'text',
        required: true,
        label: '表名'
      },
      {
        name: 'mode',
        type: 'select',
        required: true,
        label: '删除模式',
        options: ['DROP TABLE', 'DROP TABLE IF EXISTS', 'TRUNCATE'],
        defaultValue: 'DROP TABLE IF EXISTS'
      },
      {
        name: 'cascade',
        type: 'boolean',
        required: false,
        label: 'CASCADE',
        defaultValue: false,
        description: '同时删除依赖对象'
      }
    ],
    outputType: 'sql',
    requiresTable: false,
    requiresColumns: false
  },
  {
    id: 'sql-view-generator',
    name: 'CREATE VIEW 生成',
    description: '生成视图创建语句',
    category: 'sql',
    icon: '👁️',
    inputSchema: [
      {
        name: 'viewName',
        type: 'text',
        required: true,
        label: '视图名',
        placeholder: '例如：active_users_view'
      },
      {
        name: 'query',
        type: 'textarea',
        required: true,
        label: '视图查询',
        rows: 5,
        placeholder: 'SELECT ... FROM ... WHERE ...'
      },
      {
        name: 'replace',
        type: 'boolean',
        required: false,
        label: 'OR REPLACE',
        defaultValue: false
      },
      {
        name: 'recursive',
        type: 'boolean',
        required: false,
        label: 'RECURSIVE',
        defaultValue: false
      }
    ],
    outputType: 'sql',
    requiresTable: false,
    requiresColumns: false
  },
  {
    id: 'sql-index-generator',
    name: 'CREATE INDEX 生成',
    description: '生成索引创建语句',
    category: 'sql',
    icon: '📇',
    inputSchema: [
      {
        name: 'indexName',
        type: 'text',
        required: true,
        label: '索引名',
        placeholder: '例如：idx_user_email'
      },
      {
        name: 'tableName',
        type: 'text',
        required: true,
        label: '表名'
      },
      {
        name: 'columns',
        type: 'text',
        required: true,
        label: '索引列',
        placeholder: '例如：email, (last_name, first_name)'
      },
      {
        name: 'indexType',
        type: 'select',
        required: false,
        label: '索引类型',
        options: ['BTREE', 'HASH', 'GIST', 'GIN', '默认'],
        defaultValue: '默认'
      },
      {
        name: 'unique',
        type: 'boolean',
        required: false,
        label: 'UNIQUE',
        defaultValue: false
      },
      {
        name: 'ifNotExists',
        type: 'boolean',
        required: false,
        label: 'IF NOT EXISTS',
        defaultValue: true
      }
    ],
    outputType: 'sql',
    requiresTable: false,
    requiresColumns: false
  },
  {
    id: 'sql-table-design',
    name: '表结构设计',
    description: '根据业务需求设计完整的表结构（支持多表关联设计）',
    category: 'sql',
    icon: '📐',
    inputSchema: [
      {
        name: 'businessObject',
        type: 'text',
        required: true,
        label: '业务对象',
        placeholder: '例如：电商订单系统、用户管理系统、库存管理系统'
      },
      {
        name: 'tables',
        type: 'textarea',
        required: true,
        label: '表清单',
        rows: 4,
        placeholder: `每行一个表及用途：
users - 用户信息
orders - 订单信息
order_items - 订单明细
products - 商品信息`
      },
      {
        name: 'relationships',
        type: 'textarea',
        required: false,
        label: '表关系',
        rows: 3,
        placeholder: `描述表之间的关系：
users 1-n orders
orders 1-n order_items
products 1-n order_items`
      },
      {
        name: 'includeSample',
        type: 'boolean',
        required: false,
        label: '包含示例数据',
        defaultValue: false
      }
    ],
    outputType: 'sql',
    requiresTable: false,
    requiresColumns: false,
    examples: [
      {
        name: '电商订单系统',
        input: {
          businessObject: '电商订单系统',
          tables: `users - 用户账户信息
addresses - 用户收货地址
orders - 订单主表
order_items - 订单商品明细
products - 商品信息
categories - 商品分类
payments - 支付记录`,
          relationships: `users 1-n addresses
users 1-n orders
orders 1-n order_items
orders 1-n payments
products 1-n order_items
categories 1-n products`,
          includeSample: true
        },
        description: '设计完整的电商订单系统表结构'
      }
    ]
  },
  {
    id: 'analysis-time-series',
    name: '时间序列分析',
    description: '生成时间序列趋势分析查询',
    category: 'analysis',
    icon: '📈',
    inputSchema: [
      {
        name: 'timeColumn',
        type: 'column',
        required: true,
        label: '时间列'
      },
      {
        name: 'valueColumn',
        type: 'column',
        required: true,
        label: '数值列'
      },
      {
        name: 'granularity',
        type: 'select',
        required: true,
        label: '时间粒度',
        options: ['日', '周', '月', '季度', '年'],
        defaultValue: '月'
      },
      {
        name: 'analysisType',
        type: 'select',
        required: true,
        label: '分析类型',
        options: ['趋势分析', '环比增长率', '同比增长率', '移动平均', '累计增长'],
        defaultValue: '趋势分析'
      }
    ],
    outputType: 'sql',
    requiresTable: true,
    requiresColumns: true,
    examples: [
      {
        name: '月趋势分析',
        input: { granularity: '月', analysisType: '趋势分析' },
        description: '按月汇总数据趋势'
      },
      {
        name: '环比增长',
        input: { granularity: '月', analysisType: '环比增长率' },
        description: '计算月度环比增长率'
      },
      {
        name: '移动平均',
        input: { granularity: '日', analysisType: '移动平均' },
        description: '计算7天移动平均'
      }
    ]
  },
  {
    id: 'analysis-comparison',
    name: '对比分析',
    description: '生成组间对比分析查询',
    category: 'analysis',
    icon: '⚖️',
    inputSchema: [
      {
        name: 'dimension',
        type: 'column',
        required: true,
        label: '对比维度'
      },
      {
        name: 'metrics',
        type: 'text',
        required: true,
        label: '度量列',
        placeholder: '需要对比的数值列'
      },
      {
        name: 'comparisonType',
        type: 'select',
        required: true,
        label: '对比类型',
        options: ['占比分析', '差异分析', '排名分析', '分层分析'],
        defaultValue: '占比分析'
      }
    ],
    outputType: 'sql',
    requiresTable: true,
    requiresColumns: true
  },
  {
    id: 'analysis-funnel',
    name: '漏斗分析',
    description: '生成用户转化漏斗分析',
    category: 'analysis',
    icon: '🔻',
    inputSchema: [
      {
        name: 'steps',
        type: 'textarea',
        required: true,
        label: '漏斗步骤',
        placeholder: '每行一个步骤：SELECT ... FROM ... WHERE step = 1',
        rows: 4
      },
      {
        name: 'userIdColumn',
        type: 'column',
        required: true,
        label: '用户ID列'
      },
      {
        name: 'timeRange',
        type: 'text',
        required: false,
        label: '时间范围'
      }
    ],
    outputType: 'sql',
    requiresTable: true,
    examples: [
      {
        name: '电商转化漏斗',
        input: { 
          steps: '注册 → 浏览商品 → 加入购物车 → 下单 → 支付',
          userIdColumn: 'user_id',
          timeRange: '最近30天'
        },
        description: '分析用户从注册到支付的完整转化路径'
      },
      {
        name: '注册转化',
        input: { 
          steps: '访问 → 注册 → 实名认证 → 首次交易',
          userIdColumn: 'user_id',
          timeRange: '最近7天'
        },
        description: '分析新用户注册转化流程'
      }
    ]
  },
  {
    id: 'analysis-retention',
    name: '留存分析',
    description: '生成用户留存率分析查询',
    category: 'analysis',
    icon: '🎯',
    inputSchema: [
      {
        name: 'eventColumn',
        type: 'column',
        required: true,
        label: '事件列'
      },
      {
        name: 'userColumn',
        type: 'column',
        required: true,
        label: '用户ID列'
      },
      {
        name: 'timeColumn',
        type: 'column',
        required: true,
        label: '时间列'
      },
      {
        name: 'periods',
        type: 'text',
        required: false,
        label: '留存周期',
        placeholder: '1,3,7,14,30 (天)',
        defaultValue: '1,3,7,14,30'
      }
    ],
    outputType: 'sql',
    requiresTable: true,
    requiresColumns: true
  },

  // ==================== Transformation Skills ====================
  {
    id: 'transform-pivot',
    name: '数据透视 (PIVOT)',
    description: '生成 PIVOT 语句进行行转列',
    category: 'transformation',
    icon: '🔄',
    inputSchema: [
      {
        name: 'rows',
        type: 'column',
        required: true,
        label: '行标签'
      },
      {
        name: 'columns',
        type: 'column',
        required: true,
        label: '列标签'
      },
      {
        name: 'values',
        type: 'column',
        required: true,
        label: '值列'
      },
      {
        name: 'aggregation',
        type: 'select',
        required: true,
        label: '聚合函数',
        options: ['SUM', 'AVG', 'COUNT', 'MAX', 'MIN'],
        defaultValue: 'SUM'
      }
    ],
    outputType: 'sql',
    requiresTable: true,
    requiresColumns: true
  },
  {
    id: 'transform-unpivot',
    name: '逆透视 (UNPIVOT)',
    description: '生成 UNPIVOT 语句进行列转行',
    category: 'transformation',
    icon: '🔃',
    inputSchema: [
      {
        name: 'columns',
        type: 'text',
        required: true,
        label: '要转换的列',
        placeholder: 'col1, col2, col3'
      },
      {
        name: 'nameColumn',
        type: 'text',
        required: true,
        label: '新列名列',
        placeholder: '例如：attribute'
      },
      {
        name: 'valueColumn',
        type: 'text',
        required: true,
        label: '新值列',
        placeholder: '例如：value'
      }
    ],
    outputType: 'sql',
    requiresTable: true
  },
  {
    id: 'transform-type-conversion',
    name: '类型转换',
    description: '生成类型转换表达式',
    category: 'transformation',
    icon: '🔠',
    inputSchema: [
      {
        name: 'column',
        type: 'column',
        required: true,
        label: '源列'
      },
      {
        name: 'targetType',
        type: 'select',
        required: true,
        label: '目标类型',
        options: ['VARCHAR', 'INTEGER', 'BIGINT', 'DOUBLE', 'DATE', 'TIMESTAMP', 'BOOLEAN', 'JSON'],
        defaultValue: 'VARCHAR'
      },
      {
        name: 'format',
        type: 'text',
        required: false,
        label: '格式模板',
        placeholder: '例如：YYYY-MM-DD'
      }
    ],
    outputType: 'sql',
    requiresTable: true,
    requiresColumns: true
  },
  {
    id: 'transform-string-manipulation',
    name: '字符串处理',
    description: '生成字符串处理函数',
    category: 'transformation',
    icon: '🔤',
    inputSchema: [
      {
        name: 'column',
        type: 'column',
        required: true,
        label: '源列'
      },
      {
        name: 'operation',
        type: 'select',
        required: true,
        label: '操作类型',
        options: ['字符串拼接', '大小写转换', '去空格', '截取子串', '替换', '正则提取', '分割'],
        defaultValue: '字符串拼接'
      },
      {
        name: 'params',
        type: 'text',
        required: false,
        label: '操作参数',
        placeholder: '根据操作类型填写'
      }
    ],
    outputType: 'sql',
    requiresTable: true,
    requiresColumns: true
  },
  {
    id: 'transform-date-handling',
    name: '日期处理',
    description: '生成日期时间处理函数',
    category: 'transformation',
    icon: '📅',
    inputSchema: [
      {
        name: 'column',
        type: 'column',
        required: true,
        label: '日期列'
      },
      {
        name: 'operation',
        type: 'select',
        required: true,
        label: '操作类型',
        options: ['提取年月日', '日期加减', '日期差计算', '日期格式化', '日期截断', '星期计算'],
        defaultValue: '提取年月日'
      },
      {
        name: 'params',
        type: 'text',
        required: false,
        label: '操作参数'
      }
    ],
    outputType: 'sql',
    requiresTable: true,
    requiresColumns: true
  },

  // ==================== Optimization Skills ====================
  {
    id: 'optimization-explain',
    name: '执行计划分析',
    description: '生成 EXPLAIN ANALYZE 查询分析执行计划',
    category: 'optimization',
    icon: '🔬',
    inputSchema: [
      {
        name: 'sql',
        type: 'textarea',
        required: true,
        label: 'SQL 语句',
        rows: 5,
        placeholder: '要分析的 SQL 语句'
      },
      {
        name: 'analyze',
        type: 'boolean',
        required: false,
        label: '执行并分析',
        defaultValue: true
      }
    ],
    outputType: 'sql',
    requiresTable: false
  },
  {
    id: 'optimization-index',
    name: '索引建议',
    description: '分析查询并给出索引建议',
    category: 'optimization',
    icon: '🚀',
    inputSchema: [
      {
        name: 'query',
        type: 'textarea',
        required: true,
        label: '查询语句',
        rows: 3,
        placeholder: '需要优化的查询'
      },
      {
        name: 'table',
        type: 'table',
        required: true,
        label: '相关表'
      }
    ],
    outputType: 'sql',
    requiresTable: true
  },
  {
    id: 'optimization-query-rewrite',
    name: '查询重写优化',
    description: '优化和重写低效查询',
    category: 'optimization',
    icon: '⚡',
    inputSchema: [
      {
        name: 'originalSql',
        type: 'textarea',
        required: true,
        label: '原始 SQL',
        rows: 5
      },
      {
        name: 'optimizationGoals',
        type: 'select',
        required: false,
        label: '优化目标',
        options: ['性能优先', '可读性优先', '资源占用优先'],
        defaultValue: '性能优先'
      }
    ],
    outputType: 'sql',
    requiresTable: false
  },

  // ==================== Utility Skills ====================
  {
    id: 'utility-test-data',
    name: '测试数据生成',
    description: '生成测试数据插入语句',
    category: 'utility',
    icon: '🧪',
    inputSchema: [
      {
        name: 'rowCount',
        type: 'number',
        required: true,
        label: '生成行数',
        defaultValue: 10,
        min: 1,
        max: 1000
      },
      {
        name: 'pattern',
        type: 'select',
        required: true,
        label: '数据模式',
        options: ['随机数据', '序列数据', '重复数据', '边界值'],
        defaultValue: '随机数据'
      }
    ],
    outputType: 'sql',
    requiresTable: true,
    requiresColumns: true
  },
  {
    id: 'utility-summarize',
    name: '数据摘要',
    description: '生成 SUMMARIZE 或统计摘要查询',
    category: 'utility',
    icon: '📋',
    inputSchema: [
      {
        name: 'table',
        type: 'table',
        required: true,
        label: '表名'
      },
      {
        name: 'includeHistograms',
        type: 'boolean',
        required: false,
        label: '包含直方图',
        defaultValue: true
      }
    ],
    outputType: 'sql',
    requiresTable: false
  },
  {
    id: 'utility-sample-query',
    name: '样本查询',
    description: '生成各种样本查询（随机抽样、分层抽样等）',
    category: 'utility',
    icon: '🎲',
    inputSchema: [
      {
        name: 'sampleType',
        type: 'select',
        required: true,
        label: '抽样类型',
        options: ['随机抽样', '分层抽样', '系统抽样', '分组抽样'],
        defaultValue: '随机抽样'
      },
      {
        name: 'sampleSize',
        type: 'number',
        required: true,
        label: '样本数量或百分比',
        defaultValue: 100
      },
      {
        name: 'stratifyBy',
        type: 'column',
        required: false,
        label: '分层列'
      }
    ],
    outputType: 'sql',
    requiresTable: true,
    requiresColumns: true
  }
];

/**
 * SkillRegistry class for managing skills
 */
class SkillRegistry {
  private skills: Map<string, AISkill> = new Map();
  private categories: Map<SkillCategory, string[]> = new Map();

  constructor() {
    this.registerBuiltInSkills();
  }

  /**
   * Register all built-in skills
   */
  private registerBuiltInSkills(): void {
    BUILT_IN_SKILLS.forEach(skill => {
      this.register(skill);
    });
  }

  /**
   * Register a new skill
   */
  register(skill: AISkill): void {
    this.skills.set(skill.id, skill);
    this.updateCategoryIndex(skill);
  }

  /**
   * Update an existing skill
   */
  update(skill: AISkill): boolean {
    if (!this.skills.has(skill.id)) {
      return false;
    }
    this.skills.set(skill.id, skill);
    this.updateCategoryIndex(skill);
    return true;
  }

  /**
   * Unregister a skill
   */
  unregister(skillId: string): boolean {
    const skill = this.skills.get(skillId);
    if (skill) {
      this.skills.delete(skillId);
      this.removeFromCategoryIndex(skill);
      return true;
    }
    return false;
  }

  /**
   * Get a skill by ID
   */
  get(skillId: string): AISkill | undefined {
    return this.skills.get(skillId);
  }

  /**
   * Get all skills
   */
  getAll(): AISkill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Get skills by category
   */
  getByCategory(category: SkillCategory): AISkill[] {
    const categoryIds = this.categories.get(category) || [];
    return categoryIds.map(id => this.skills.get(id)).filter(Boolean) as AISkill[];
  }

  /**
   * Get all categories
   */
  getCategories(): { category: SkillCategory; count: number }[] {
    const result: { category: SkillCategory; count: number }[] = [];
    this.categories.forEach((ids, category) => {
      result.push({ category, count: ids.length });
    });
    return result;
  }

  /**
   * Search skills by name or description
   */
  search(query: string): AISkill[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.skills.values()).filter(skill =>
      skill.name.toLowerCase().includes(lowerQuery) ||
      skill.description.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Match skills by intent keywords
   */
  matchSkillsByIntent(keywords: string[]): AISkill[] {
    const lowerKeywords = keywords.map(k => k.toLowerCase());
    return Array.from(this.skills.values()).filter(skill => {
      // Check explicit intent keywords
      if (skill.intentKeywords) {
        return skill.intentKeywords.some(kw => 
          lowerKeywords.some(lk => kw.toLowerCase().includes(lk) || lk.includes(kw.toLowerCase()))
        );
      }
      // Check intent patterns
      if (skill.intentPatterns) {
        return skill.intentPatterns.some(pattern => {
          try {
            const regex = new RegExp(pattern, 'i');
            return keywords.some(kw => regex.test(kw));
          } catch {
            return false;
          }
        });
      }
      return false;
    });
  }

  /**
   * Match skills by SQL operation type
   */
  matchSkillsByOperation(operation: string): AISkill[] {
    return Array.from(this.skills.values()).filter(skill => 
      skill.sqlOperationType === operation
    );
  }

  /**
   * Find compatible skills for a given skill
   */
  findCompatibleSkills(skillId: string): AISkill[] {
    const skill = this.skills.get(skillId);
    if (!skill) {
      return [];
    }
    
    // Return explicitly defined compatible skills
    if (skill.compatibleWith) {
      return skill.compatibleWith
        .map(id => this.skills.get(id))
        .filter((s): s is AISkill => s !== undefined);
    }
    
    // Find skills with compatible operation types
    const operation = skill.sqlOperationType || 'select';
    const compatibleTypes = this.getCompatibleOperationTypes(operation);
    
    return Array.from(this.skills.values()).filter(s => 
      s.id !== skillId && 
      s.sqlOperationType && compatibleTypes.includes(s.sqlOperationType)
    );
  }

  /**
   * Get compatible operation types for a given operation
   */
  private getCompatibleOperationTypes(operation: string): string[] {
    const compatibilityMap: Record<string, string[]> = {
      select: ['aggregation', 'join', 'window', 'transformation'],
      insert: [],
      update: [],
      delete: [],
      aggregation: ['select', 'window'],
      join: ['select', 'aggregation'],
      window: ['select', 'aggregation'],
      transformation: ['select'],
      analysis: ['aggregation', 'window', 'transformation'],
      optimization: ['select'],
      utility: ['select', 'insert']
    };
    
    return compatibilityMap[operation] || [];
  }

  /**
   * Update category index
   */
  private updateCategoryIndex(skill: AISkill): void {
    const categoryIds = this.categories.get(skill.category) || [];
    if (!categoryIds.includes(skill.id)) {
      categoryIds.push(skill.id);
      this.categories.set(skill.category, categoryIds);
    }
  }

  /**
   * Remove skill from category index
   */
  private removeFromCategoryIndex(skill: AISkill): void {
    const categoryIds = this.categories.get(skill.category);
    if (categoryIds) {
      const index = categoryIds.indexOf(skill.id);
      if (index > -1) {
        categoryIds.splice(index, 1);
      }
    }
  }
}

// Singleton instance
export const skillRegistry = new SkillRegistry();

// Export convenience functions
export const getSkill = (id: string) => skillRegistry.get(id);
export const getAllSkills = () => skillRegistry.getAll();
export const getSkillsByCategory = (category: SkillCategory) => skillRegistry.getByCategory(category);
export const searchSkills = (query: string) => skillRegistry.search(query);
export const getSkillCategories = () => skillRegistry.getCategories();
export const matchSkillsByIntent = (keywords: string[]) => skillRegistry.matchSkillsByIntent(keywords);
export const matchSkillsByOperation = (operation: string) => skillRegistry.matchSkillsByOperation(operation);
export const findCompatibleSkills = (skillId: string) => skillRegistry.findCompatibleSkills(skillId);
export const updateSkill = (skill: AISkill) => skillRegistry.update(skill);
export const registerSkill = (skill: AISkill) => skillRegistry.register(skill);
export const unregisterSkill = (skillId: string) => skillRegistry.unregister(skillId);