/**
 * Analysis Skill Definitions
 *
 * Covers: Time Series, Comparison, Funnel, Retention
 */

import { AISkill } from '../../../types';

export const ANALYSIS_SKILLS: AISkill[] = [
  {
    id: 'analysis-time-series',
    name: '时间序列分析',
    description: '生成时间序列趋势分析查询',
    category: 'insights',
    icon: '📈',
    generatorId: 'analysis-time-series',
    inputSchema: [
      { name: 'timeColumn', type: 'column', required: true, label: '时间列' },
      { name: 'valueColumn', type: 'column', required: true, label: '数值列' },
      { name: 'granularity', type: 'select', required: true, label: '时间粒度', options: ['日', '周', '月', '季度', '年'], defaultValue: '月' },
      { name: 'analysisType', type: 'select', required: true, label: '分析类型', options: ['趋势分析', '环比增长率', '同比增长率', '移动平均', '累计增长'], defaultValue: '趋势分析' }
    ],
    outputType: 'sql',
    requiresTable: true,
    requiresColumns: true,
    examples: [
      { name: '月趋势分析', input: { granularity: '月', analysisType: '趋势分析' }, description: '按月汇总数据趋势' },
      { name: '环比增长', input: { granularity: '月', analysisType: '环比增长率' }, description: '计算月度环比增长率' },
      { name: '移动平均', input: { granularity: '日', analysisType: '移动平均' }, description: '计算7天移动平均' }
    ]
  },
  {
    id: 'analysis-comparison',
    name: '对比分析',
    description: '生成组间对比分析查询',
    category: 'insights',
    icon: '⚖️',
    generatorId: 'analysis-comparison',
    inputSchema: [
      { name: 'dimension', type: 'column', required: true, label: '对比维度' },
      { name: 'metrics', type: 'text', required: true, label: '度量列', placeholder: '需要对比的数值列' },
      { name: 'comparisonType', type: 'select', required: true, label: '对比类型', options: ['占比分析', '差异分析', '排名分析', '分层分析'], defaultValue: '占比分析' }
    ],
    outputType: 'sql',
    requiresTable: true,
    requiresColumns: true
  },
  {
    id: 'analysis-funnel',
    name: '漏斗分析',
    description: '生成用户转化漏斗分析',
    category: 'insights',
    icon: '🔻',
    generatorId: 'analysis-funnel',
    inputSchema: [
      { name: 'steps', type: 'textarea', required: true, label: '漏斗步骤', placeholder: '每行一个步骤：SELECT ... FROM ... WHERE step = 1', rows: 4 },
      { name: 'userIdColumn', type: 'column', required: true, label: '用户ID列' },
      { name: 'timeRange', type: 'text', required: false, label: '时间范围' }
    ],
    outputType: 'sql',
    requiresTable: true,
    examples: [
      {
        name: '电商转化漏斗',
        input: { steps: '注册 → 浏览商品 → 加入购物车 → 下单 → 支付', userIdColumn: 'user_id', timeRange: '最近30天' },
        description: '分析用户从注册到支付的完整转化路径'
      },
      {
        name: '注册转化',
        input: { steps: '访问 → 注册 → 实名认证 → 首次交易', userIdColumn: 'user_id', timeRange: '最近7天' },
        description: '分析新用户注册转化流程'
      }
    ]
  },
  {
    id: 'analysis-retention',
    name: '留存分析',
    description: '生成用户留存率分析查询',
    category: 'insights',
    icon: '🎯',
    generatorId: 'analysis-retention',
    inputSchema: [
      { name: 'eventColumn', type: 'column', required: true, label: '事件列' },
      { name: 'userColumn', type: 'column', required: true, label: '用户ID列' },
      { name: 'timeColumn', type: 'column', required: true, label: '时间列' },
      { name: 'periods', type: 'text', required: false, label: '留存周期', placeholder: '1,3,7,14,30 (天)', defaultValue: '1,3,7,14,30' }
    ],
    outputType: 'sql',
    requiresTable: true,
    requiresColumns: true
  },
];
