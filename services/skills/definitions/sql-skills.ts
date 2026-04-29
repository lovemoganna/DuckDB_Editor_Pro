/**
 * SQL Query Skill Definitions
 *
 * Covers: SELECT, JOIN, Aggregation, Window Function, CTE, INSERT, UPDATE, DELETE
 */

import { AISkill } from '../../../types';

export const SQL_QUERY_SKILLS: AISkill[] = [
  {
    id: 'sql-select-generator',
    name: 'SELECT 查询生成',
    description: '根据自然语言描述生成 SELECT 查询语句',
    category: 'modeling',
    icon: '🔍',
    generatorId: 'sql-select',
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
    triggers: {
      keywords: ['查询', '查找', '获取', '看看', '显示', '展示', 'query', 'find', 'get', 'show', 'select', 'read', 'list'],
      sqlOperations: ['select']
    },
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
    category: 'modeling',
    icon: '🔗',
    generatorId: 'sql-join',
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
    triggers: {
      keywords: ['关联', '连接', '合并', 'join', 'link', 'combine', 'merge'],
      sqlOperations: ['join']
    },
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
    category: 'modeling',
    icon: '📊',
    generatorId: 'sql-aggregation',
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
    requiresColumns: true,
    triggers: {
      keywords: ['统计', '合计', '求和', '平均', '计数', '最大值', '最小值', '汇总', 'group', 'sum', 'count', 'avg', 'max', 'min', 'total', 'aggregate'],
      sqlOperations: ['aggregation']
    }
  },
  {
    id: 'sql-window-function',
    name: '窗口函数查询',
    description: '生成窗口函数（OVER, PARTITION BY, RANK 等）',
    category: 'modeling',
    icon: '🪟',
    generatorId: 'sql-window',
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
    requiresColumns: true,
    triggers: {
      keywords: ['排名', '排序', '累计', '移动平均', '滞后', '领先', '窗口', 'rank', 'row_number', 'lag', 'lead', 'cumulative', 'moving', 'window'],
      sqlOperations: ['window']
    }
  },
  {
    id: 'sql-cte-generator',
    name: 'CTE 查询生成',
    description: '生成 Common Table Expression（WITH 子句）',
    category: 'modeling',
    icon: '🌳',
    generatorId: 'sql-cte',
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
    category: 'modeling',
    icon: '➕',
    generatorId: 'sql-insert',
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
    category: 'modeling',
    icon: '✏️',
    generatorId: 'sql-update',
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
    category: 'modeling',
    icon: '🗑️',
    generatorId: 'sql-delete',
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
];
