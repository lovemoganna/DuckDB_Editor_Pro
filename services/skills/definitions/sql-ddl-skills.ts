/**
 * SQL DDL Skill Definitions
 *
 * Covers: CREATE TABLE (4 variants), ALTER TABLE, DROP TABLE,
 *         CREATE VIEW, CREATE INDEX, Table Design
 */

import { AISkill } from '../../../types';

export const SQL_DDL_SKILLS: AISkill[] = [
  {
    id: 'sql-create-table-generator',
    name: 'CREATE TABLE 生成',
    description: '生成建表语句，支持完整表结构定义',
    category: 'modeling',
    icon: '🏗️',
    generatorId: 'sql-create-table',
    inputSchema: [
      { name: 'tableName', type: 'text', required: true, label: '表名', placeholder: '例如：users, orders, products' },
      {
        name: 'columns', type: 'textarea', required: true, label: '列定义', rows: 6,
        placeholder: `格式：列名 类型 [约束]\n示例：\nid INTEGER PRIMARY KEY,\nname VARCHAR(100) NOT NULL,\nemail VARCHAR(255) UNIQUE,\ncreated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\nstatus VARCHAR(20) DEFAULT 'active'`
      },
      { name: 'primaryKey', type: 'text', required: false, label: '主键', placeholder: '例如：id 或 (id, name)' },
      {
        name: 'foreignKeys', type: 'textarea', required: false, label: '外键', rows: 3,
        placeholder: `格式：FOREIGN KEY (列名) REFERENCES 表名(列名)\n示例：\nFOREIGN KEY (user_id) REFERENCES users(id),\nFOREIGN KEY (category_id) REFERENCES categories(id)`
      },
      {
        name: 'indexes', type: 'textarea', required: false, label: '索引', rows: 3,
        placeholder: `格式：INDEX 索引名 (列名)\n示例：\nINDEX idx_email (email),\nINDEX idx_created (created_at)`
      },
      { name: 'engine', type: 'select', required: false, label: '存储引擎', options: ['默认', 'DuckDB', 'Memory', 'Parquet'], defaultValue: '默认' },
      { name: 'ifNotExists', type: 'boolean', required: false, label: 'IF NOT EXISTS', defaultValue: true }
    ],
    outputType: 'sql',
    requiresTable: false,
    requiresColumns: false,
    examples: [
      {
        name: '用户表',
        input: {
          tableName: 'users',
          columns: `id INTEGER PRIMARY KEY,\nusername VARCHAR(50) NOT NULL,\nemail VARCHAR(100) NOT NULL,\npassword_hash VARCHAR(255) NOT NULL,\ncreated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\nlast_login TIMESTAMP`,
          primaryKey: 'id', ifNotExists: true
        },
        description: '创建完整的用户表'
      },
      {
        name: '订单表',
        input: {
          tableName: 'orders',
          columns: `order_id BIGINT PRIMARY KEY,\nuser_id INTEGER NOT NULL,\ntotal_amount DECIMAL(10,2),\nstatus VARCHAR(20) DEFAULT 'pending',\ncreated_at TIMESTAMP`,
          foreignKeys: 'FOREIGN KEY (user_id) REFERENCES users(id)', ifNotExists: true
        },
        description: '创建订单表并设置外键'
      }
    ]
  },
  {
    id: 'sql-create-table-nl',
    name: '自然语言建表',
    description: '用自然语言描述需求，AI 自动生成表结构',
    category: 'modeling',
    icon: '✨',
    generatorId: 'sql-create-table-nl',
    inputSchema: [
      {
        name: 'description', type: 'textarea', required: true, label: '表需求描述', rows: 4,
        placeholder: `用自然语言描述你的表需求：\n\n例如：创建一个用户管理系统，包含用户基本信息（用户名、邮箱、手机号、注册时间）、用户状态、会员等级等信息。还需要记录用户的收货地址，每位用户可以有多个收货地址。`
      },
      { name: 'businessDomain', type: 'select', required: false, label: '业务领域', options: ['通用', '电商', '用户管理', '订单系统', '库存管理', '财务', '日志分析', '物联网'], defaultValue: '通用' },
      { name: 'includeSample', type: 'boolean', required: false, label: '包含示例数据', defaultValue: false },
      { name: 'useAI', type: 'boolean', required: false, label: '启用 AI 增强', defaultValue: true, description: '使用 AI 分析需求并优化表结构' }
    ],
    outputType: 'sql',
    requiresTable: false,
    requiresColumns: false,
    examples: [
      {
        name: '电商订单表',
        input: {
          description: '创建电商订单系统，包含订单主表和订单明细表。订单包含订单号、用户、下单时间、订单金额、支付状态、物流信息。订单明细包含商品、价格、数量、小计。',
          businessDomain: '电商', includeSample: true, useAI: true
        },
        description: '根据电商业务需求生成完整订单系统'
      }
    ]
  },
  {
    id: 'sql-create-table-template',
    name: '模板建表',
    description: '使用预置模板快速创建标准表结构',
    category: 'modeling',
    icon: '📋',
    generatorId: 'sql-create-table-template',
    inputSchema: [
      { name: 'templateType', type: 'select', required: true, label: '选择模板', options: ['用户表', '订单表', '商品表', '分类表', '支付记录表', '日志表', '配置表', '关系表'], defaultValue: '用户表' },
      { name: 'tableName', type: 'text', required: true, label: '表名', placeholder: '自定义表名，留空使用模板默认名' },
      { name: 'customizeFields', type: 'textarea', required: false, label: '自定义字段', rows: 3, placeholder: '添加自定义字段，每行一个：字段名 类型' },
      { name: 'addStatus', type: 'boolean', required: false, label: '包含状态字段', defaultValue: true },
      { name: 'addTimestamps', type: 'boolean', required: false, label: '包含时间戳', defaultValue: true }
    ],
    outputType: 'sql',
    requiresTable: false,
    requiresColumns: false,
    examples: [
      {
        name: '会员用户表',
        input: { templateType: '用户表', tableName: 'members', addStatus: true, addTimestamps: true },
        description: '基于用户表模板创建会员表'
      }
    ]
  },
  {
    id: 'sql-create-table-import',
    name: '导入建表',
    description: '从 JSON、CSV 或剪切板导入表结构',
    category: 'modeling',
    icon: '📥',
    generatorId: 'sql-create-table-import',
    inputSchema: [
      { name: 'importSource', type: 'select', required: true, label: '导入来源', options: ['JSON', 'CSV', '剪切板'], defaultValue: 'JSON' },
      {
        name: 'importData', type: 'textarea', required: true, label: '导入数据', rows: 8,
        placeholder: `JSON 格式示例：\n[\n  {"name": "id", "type": "INTEGER", "pk": true},\n  {"name": "username", "type": "VARCHAR(50)", "notNull": true},\n  {"name": "email", "type": "VARCHAR(255)", "unique": true},\n  {"name": "status", "type": "VARCHAR(20)", "default": "active"}\n]\n\n或 CSV 格式：\nname,type,pk,notNull,unique,default\nid,INTEGER,true,true,false,\nusername,VARCHAR(50),false,true,false,\nemail,VARCHAR(255),false,true,true,`
      },
      { name: 'tableName', type: 'text', required: true, label: '表名', placeholder: '导入后的表名' },
      { name: 'inferTypes', type: 'boolean', required: false, label: '智能推断类型', defaultValue: true, description: '从数据值推断列类型' }
    ],
    outputType: 'sql',
    requiresTable: false,
    requiresColumns: false
  },
  {
    id: 'sql-alter-table-generator',
    name: 'ALTER TABLE 生成',
    description: '生成表结构修改语句（添加/修改/删除列）',
    category: 'modeling',
    icon: '🔧',
    generatorId: 'sql-alter-table',
    inputSchema: [
      { name: 'alterType', type: 'select', required: true, label: '操作类型', options: ['添加列', '修改列', '删除列', '添加约束', '删除约束', '重命名表'], defaultValue: '添加列' },
      { name: 'columnName', type: 'text', required: false, label: '列名', placeholder: '要操作的列名' },
      { name: 'columnDefinition', type: 'text', required: false, label: '列定义', placeholder: '例如：VARCHAR(100) NOT NULL' },
      { name: 'constraint', type: 'text', required: false, label: '约束', placeholder: '例如：PRIMARY KEY, UNIQUE, CHECK' },
      { name: 'ifExists', type: 'boolean', required: false, label: 'IF EXISTS', defaultValue: false }
    ],
    outputType: 'sql',
    requiresTable: true,
    requiresColumns: true
  },
  {
    id: 'sql-drop-table-generator',
    name: 'DROP TABLE 生成',
    description: '生成删除表语句',
    category: 'modeling',
    icon: '💣',
    generatorId: 'sql-drop-table',
    inputSchema: [
      { name: 'tableName', type: 'text', required: true, label: '表名' },
      { name: 'mode', type: 'select', required: true, label: '删除模式', options: ['DROP TABLE', 'DROP TABLE IF EXISTS', 'TRUNCATE'], defaultValue: 'DROP TABLE IF EXISTS' },
      { name: 'cascade', type: 'boolean', required: false, label: 'CASCADE', defaultValue: false, description: '同时删除依赖对象' }
    ],
    outputType: 'sql',
    requiresTable: false,
    requiresColumns: false
  },
  {
    id: 'sql-view-generator',
    name: 'CREATE VIEW 生成',
    description: '生成视图创建语句',
    category: 'modeling',
    icon: '👁️',
    generatorId: 'sql-view',
    inputSchema: [
      { name: 'viewName', type: 'text', required: true, label: '视图名', placeholder: '例如：active_users_view' },
      { name: 'query', type: 'textarea', required: true, label: '视图查询', rows: 5, placeholder: 'SELECT ... FROM ... WHERE ...' },
      { name: 'replace', type: 'boolean', required: false, label: 'OR REPLACE', defaultValue: false },
      { name: 'recursive', type: 'boolean', required: false, label: 'RECURSIVE', defaultValue: false }
    ],
    outputType: 'sql',
    requiresTable: false,
    requiresColumns: false
  },
  {
    id: 'sql-index-generator',
    name: 'CREATE INDEX 生成',
    description: '生成索引创建语句',
    category: 'modeling',
    icon: '📇',
    generatorId: 'sql-index',
    inputSchema: [
      { name: 'indexName', type: 'text', required: true, label: '索引名', placeholder: '例如：idx_user_email' },
      { name: 'tableName', type: 'text', required: true, label: '表名' },
      { name: 'columns', type: 'text', required: true, label: '索引列', placeholder: '例如：email, (last_name, first_name)' },
      { name: 'indexType', type: 'select', required: false, label: '索引类型', options: ['BTREE', 'HASH', 'GIST', 'GIN', '默认'], defaultValue: '默认' },
      { name: 'unique', type: 'boolean', required: false, label: 'UNIQUE', defaultValue: false },
      { name: 'ifNotExists', type: 'boolean', required: false, label: 'IF NOT EXISTS', defaultValue: true }
    ],
    outputType: 'sql',
    requiresTable: false,
    requiresColumns: false
  },
  {
    id: 'sql-table-design',
    name: '表结构设计',
    description: '根据业务需求设计完整的表结构（支持多表关联设计）',
    category: 'modeling',
    icon: '📐',
    generatorId: 'sql-table-design',
    inputSchema: [
      { name: 'businessObject', type: 'text', required: true, label: '业务对象', placeholder: '例如：电商订单系统、用户管理系统、库存管理系统' },
      {
        name: 'tables', type: 'textarea', required: true, label: '表清单', rows: 4,
        placeholder: `每行一个表及用途：\nusers - 用户信息\norders - 订单信息\norder_items - 订单明细\nproducts - 商品信息`
      },
      {
        name: 'relationships', type: 'textarea', required: false, label: '表关系', rows: 3,
        placeholder: `描述表之间的关系：\nusers 1-n orders\norders 1-n order_items\nproducts 1-n order_items`
      },
      { name: 'includeSample', type: 'boolean', required: false, label: '包含示例数据', defaultValue: false }
    ],
    outputType: 'sql',
    requiresTable: false,
    requiresColumns: false,
    examples: [
      {
        name: '电商订单系统',
        input: {
          businessObject: '电商订单系统',
          tables: `users - 用户账户信息\naddresses - 用户收货地址\norders - 订单主表\norder_items - 订单商品明细\nproducts - 商品信息\ncategories - 商品分类\npayments - 支付记录`,
          relationships: `users 1-n addresses\nusers 1-n orders\norders 1-n order_items\norders 1-n payments\nproducts 1-n order_items\ncategories 1-n products`,
          includeSample: true
        },
        description: '设计完整的电商订单系统表结构'
      }
    ]
  },
];
