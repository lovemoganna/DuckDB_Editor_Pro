/**
 * Transformation Skill Definitions
 *
 * Covers: PIVOT, UNPIVOT, Type Conversion, String Manipulation, Date Handling
 */

import { AISkill } from '../../../types';

export const TRANSFORMATION_SKILLS: AISkill[] = [
  {
    id: 'transform-pivot',
    name: '数据透视 (PIVOT)',
    description: '生成 PIVOT 语句进行行转列',
    category: 'wrangling',
    icon: '🔄',
    generatorId: 'transform-pivot',
    inputSchema: [
      { name: 'rows', type: 'column', required: true, label: '行标签' },
      { name: 'columns', type: 'column', required: true, label: '列标签' },
      { name: 'values', type: 'column', required: true, label: '值列' },
      { name: 'aggregation', type: 'select', required: true, label: '聚合函数', options: ['SUM', 'AVG', 'COUNT', 'MAX', 'MIN'], defaultValue: 'SUM' }
    ],
    outputType: 'sql',
    requiresTable: true,
    requiresColumns: true
  },
  {
    id: 'transform-unpivot',
    name: '逆透视 (UNPIVOT)',
    description: '生成 UNPIVOT 语句进行列转行',
    category: 'wrangling',
    icon: '🔃',
    generatorId: 'transform-unpivot',
    inputSchema: [
      { name: 'columns', type: 'text', required: true, label: '要转换的列', placeholder: 'col1, col2, col3' },
      { name: 'nameColumn', type: 'text', required: true, label: '新列名列', placeholder: '例如：attribute' },
      { name: 'valueColumn', type: 'text', required: true, label: '新值列', placeholder: '例如：value' }
    ],
    outputType: 'sql',
    requiresTable: true
  },
  {
    id: 'transform-type-conversion',
    name: '类型转换',
    description: '生成类型转换表达式',
    category: 'wrangling',
    icon: '🔠',
    generatorId: 'transform-type-conversion',
    inputSchema: [
      { name: 'column', type: 'column', required: true, label: '源列' },
      { name: 'targetType', type: 'select', required: true, label: '目标类型', options: ['VARCHAR', 'INTEGER', 'BIGINT', 'DOUBLE', 'DATE', 'TIMESTAMP', 'BOOLEAN', 'JSON'], defaultValue: 'VARCHAR' },
      { name: 'format', type: 'text', required: false, label: '格式模板', placeholder: '例如：YYYY-MM-DD' }
    ],
    outputType: 'sql',
    requiresTable: true,
    requiresColumns: true
  },
  {
    id: 'transform-string-manipulation',
    name: '字符串处理',
    description: '生成字符串处理函数',
    category: 'wrangling',
    icon: '🔤',
    generatorId: 'transform-string-manipulation',
    inputSchema: [
      { name: 'column', type: 'column', required: true, label: '源列' },
      { name: 'operation', type: 'select', required: true, label: '操作类型', options: ['字符串拼接', '大小写转换', '去空格', '截取子串', '替换', '正则提取', '分割'], defaultValue: '字符串拼接' },
      { name: 'params', type: 'text', required: false, label: '操作参数', placeholder: '根据操作类型填写' }
    ],
    outputType: 'sql',
    requiresTable: true,
    requiresColumns: true
  },
  {
    id: 'transform-date-handling',
    name: '日期处理',
    description: '生成日期时间处理函数',
    category: 'wrangling',
    icon: '📅',
    generatorId: 'transform-date-handling',
    inputSchema: [
      { name: 'column', type: 'column', required: true, label: '日期列' },
      { name: 'operation', type: 'select', required: true, label: '操作类型', options: ['提取年月日', '日期加减', '日期差计算', '日期格式化', '日期截断', '星期计算'], defaultValue: '提取年月日' },
      { name: 'params', type: 'text', required: false, label: '操作参数' }
    ],
    outputType: 'sql',
    requiresTable: true,
    requiresColumns: true
  },
];
