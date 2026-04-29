/**
 * Utility Skill Definitions
 *
 * Covers: Test Data, Summarize, Sample Query
 */

import { AISkill } from '../../../types';

export const UTILITY_SKILLS: AISkill[] = [
  {
    id: 'utility-test-data',
    name: '测试数据生成',
    description: '生成测试数据插入语句',
    category: 'engineering',
    icon: '🧪',
    generatorId: 'utility-test-data',
    inputSchema: [
      { name: 'rowCount', type: 'number', required: true, label: '生成行数', defaultValue: 10, min: 1, max: 1000 },
      { name: 'pattern', type: 'select', required: true, label: '数据模式', options: ['随机数据', '序列数据', '重复数据', '边界值'], defaultValue: '随机数据' }
    ],
    outputType: 'sql',
    requiresTable: true,
    requiresColumns: true
  },
  {
    id: 'utility-summarize',
    name: '数据摘要',
    description: '生成 SUMMARIZE 或统计摘要查询',
    category: 'engineering',
    icon: '📋',
    generatorId: 'utility-summarize',
    inputSchema: [
      { name: 'table', type: 'table', required: true, label: '表名' },
      { name: 'includeHistograms', type: 'boolean', required: false, label: '包含直方图', defaultValue: true }
    ],
    outputType: 'sql',
    requiresTable: false
  },
  {
    id: 'utility-sample-query',
    name: '样本查询',
    description: '生成各种样本查询（随机抽样、分层抽样等）',
    category: 'engineering',
    icon: '🎲',
    generatorId: 'utility-sample-query',
    inputSchema: [
      { name: 'sampleType', type: 'select', required: true, label: '抽样类型', options: ['随机抽样', '分层抽样', '系统抽样', '分组抽样'], defaultValue: '随机抽样' },
      { name: 'sampleSize', type: 'number', required: true, label: '样本数量或百分比', defaultValue: 100 },
      { name: 'stratifyBy', type: 'column', required: false, label: '分层列' }
    ],
    outputType: 'sql',
    requiresTable: true,
    requiresColumns: true
  },
];
