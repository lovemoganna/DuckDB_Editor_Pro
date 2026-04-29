/**
 * Optimization Skill Definitions
 *
 * Covers: EXPLAIN, Index Suggestions, Query Rewrite
 */

import { AISkill } from '../../../types';

export const OPTIMIZATION_SKILLS: AISkill[] = [
  {
    id: 'optimization-explain',
    name: '执行计划分析',
    description: '生成 EXPLAIN ANALYZE 查询分析执行计划',
    category: 'optimization',
    icon: '🔬',
    generatorId: 'optimization-explain',
    inputSchema: [
      { name: 'sql', type: 'textarea', required: true, label: 'SQL 语句', rows: 5, placeholder: '要分析的 SQL 语句' },
      { name: 'analyze', type: 'boolean', required: false, label: '执行并分析', defaultValue: true }
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
    generatorId: 'optimization-index',
    inputSchema: [
      { name: 'query', type: 'textarea', required: true, label: '查询语句', rows: 3, placeholder: '需要优化的查询' },
      { name: 'table', type: 'table', required: true, label: '相关表' }
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
    generatorId: 'optimization-query-rewrite',
    inputSchema: [
      { name: 'originalSql', type: 'textarea', required: true, label: '原始 SQL', rows: 5 },
      { name: 'optimizationGoals', type: 'select', required: false, label: '优化目标', options: ['性能优先', '可读性优先', '资源占用优先'], defaultValue: '性能优先' }
    ],
    outputType: 'sql',
    requiresTable: false
  },
];
