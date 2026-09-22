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
  {
    id: 'optimization-duckdb-tuner',
    name: 'DuckDB 向量化与内存调优',
    description: '自动配置 WASM 内存限制、Threads 并行度及 PRAGMA 执行调优',
    category: 'optimization',
    icon: '🚀',
    generatorId: 'optimization-duckdb-tuner',
    inputSchema: [
      { name: 'memoryLimit', type: 'select', required: false, label: '内存上限', options: ['1GB', '2GB', '4GB'], defaultValue: '2GB' },
      { name: 'threads', type: 'number', required: false, label: '并行线程数', defaultValue: 4 }
    ],
    outputType: 'sql',
    requiresTable: false
  },
  {
    id: 'optimization-schema-sanitizer',
    name: '数据质量与 PII 自动化脱敏审计',
    description: '扫描表数据质量并生成敏感数据哈希/掩码与 Null 值填充 SQL',
    category: 'optimization',
    icon: '🛡️',
    generatorId: 'optimization-schema-sanitizer',
    inputSchema: [
      { name: 'tableName', type: 'table', required: true, label: '目标数据表' },
      { name: 'maskPii', type: 'boolean', required: false, label: '启用 PII 自动脱敏', defaultValue: true }
    ],
    outputType: 'sql',
    requiresTable: true
  }
];
