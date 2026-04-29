/**
 * Pipeline Templates - Preset skill chain templates
 *
 * Common analysis patterns that users can quickly load and execute.
 */

import { SkillChain, SkillChainStep } from '../../types';

export interface PipelineTemplate {
  id: string;
  name: string;
  description: string;
  category: 'analysis' | 'modeling' | 'wrangling' | 'engineering';
  tags: string[];
  icon: string;
  steps: Array<Omit<SkillChainStep, 'stepId' | 'status'> & { description?: string }>;
}

// Common pipeline templates
export const PIPELINE_TEMPLATES: PipelineTemplate[] = [
  {
    id: 'data-exploration',
    name: '数据探索',
    description: '快速了解数据结构，生成基础统计和分布分析',
    category: 'analysis',
    tags: ['探索', '统计', '分布'],
    icon: '🔍',
    steps: [
      {
        skillId: 'schema-profiler',
        dependsOn: [],
        inputs: {},
        description: '探测表结构和列类型',
      },
      {
        skillId: 'data-sampler',
        dependsOn: ['schema-profiler'],
        inputs: {},
        description: '采样数据预览',
      },
      {
        skillId: 'statistical-summary',
        dependsOn: ['data-sampler'],
        inputs: {},
        description: '生成统计摘要',
      },
    ],
  },
  {
    id: 'trend-analysis',
    name: '趋势分析',
    description: '时间序列趋势分析，包含同比环比和预测',
    category: 'analysis',
    tags: ['趋势', '时间序列', '预测'],
    icon: '📈',
    steps: [
      {
        skillId: 'time-range-detector',
        dependsOn: [],
        inputs: {},
        description: '识别时间范围',
      },
      {
        skillId: 'trend-aggregator',
        dependsOn: ['time-range-detector'],
        inputs: {},
        description: '聚合趋势数据',
      },
      {
        skillId: 'comparison-generator',
        dependsOn: ['trend-aggregator'],
        inputs: {},
        description: '生成对比分析',
      },
    ],
  },
  {
    id: 'data-cleaning',
    name: '数据清洗流程',
    description: '标准化数据格式，处理缺失值和异常值',
    category: 'wrangling',
    tags: ['清洗', '标准化', '缺失值'],
    icon: '🧹',
    steps: [
      {
        skillId: 'missing-value-detector',
        dependsOn: [],
        inputs: {},
        description: '检测缺失值',
      },
      {
        skillId: 'outlier-detector',
        dependsOn: [],
        inputs: {},
        description: '检测异常值',
      },
      {
        skillId: 'data-normalizer',
        dependsOn: ['missing-value-detector', 'outlier-detector'],
        inputs: {},
        description: '标准化数据',
      },
    ],
  },
  {
    id: 'funnel-analysis',
    name: '漏斗分析',
    description: '多步骤转化漏斗分析',
    category: 'analysis',
    tags: ['漏斗', '转化', '留存'],
    icon: '🎯',
    steps: [
      {
        skillId: 'funnel-step-definer',
        dependsOn: [],
        inputs: {},
        description: '定义漏斗步骤',
      },
      {
        skillId: 'funnel-calculator',
        dependsOn: ['funnel-step-definer'],
        inputs: {},
        description: '计算转化率',
      },
      {
        skillId: 'funnel-visualizer',
        dependsOn: ['funnel-calculator'],
        inputs: {},
        description: '可视化漏斗',
      },
    ],
  },
  {
    id: 'etl-pipeline',
    name: 'ETL 流水线',
    description: 'Extract-Transform-Load 数据处理流程',
    category: 'engineering',
    tags: ['ETL', '导入', '导出'],
    icon: '⚙️',
    steps: [
      {
        skillId: 'data-extractor',
        dependsOn: [],
        inputs: {},
        description: '提取源数据',
      },
      {
        skillId: 'transformer',
        dependsOn: ['data-extractor'],
        inputs: {},
        description: '转换数据格式',
      },
      {
        skillId: 'data-loader',
        dependsOn: ['transformer'],
        inputs: {},
        description: '加载到目标表',
      },
    ],
  },
  {
    id: 'cohort-analysis',
    name: '队列分析',
    description: '用户行为队列分析，计算留存率',
    category: 'analysis',
    tags: ['留存', '队列', '用户'],
    icon: '👥',
    steps: [
      {
        skillId: 'cohort-definer',
        dependsOn: [],
        inputs: {},
        description: '定义分析队列',
      },
      {
        skillId: 'retention-calculator',
        dependsOn: ['cohort-definer'],
        inputs: {},
        description: '计算留存率',
      },
      {
        skillId: 'cohort-matrix',
        dependsOn: ['retention-calculator'],
        inputs: {},
        description: '生成队列矩阵',
      },
    ],
  },
];

// Template categories with metadata
export const TEMPLATE_CATEGORIES = [
  { id: 'analysis', name: '分析类', icon: '📊', color: '#ae81ff' },
  { id: 'modeling', name: '建模类', icon: '🏗️', color: '#66d9ef' },
  { id: 'wrangling', name: '清洗类', icon: '🧹', color: '#a6e22e' },
  { id: 'engineering', name: '工程类', icon: '⚙️', color: '#fd971f' },
];

// Helper to get template by ID
export function getTemplateById(id: string): PipelineTemplate | undefined {
  return PIPELINE_TEMPLATES.find(t => t.id === id);
}

// Helper to get templates by category
export function getTemplatesByCategory(category: PipelineTemplate['category']): PipelineTemplate[] {
  return PIPELINE_TEMPLATES.filter(t => t.category === category);
}

// Convert template to SkillChain
export function templateToSkillChain(template: PipelineTemplate): SkillChain {
  return {
    id: `chain-${template.id}`,
    name: template.name,
    description: template.description,
    steps: template.steps.map((step, idx) => ({
      ...step,
      stepId: `step-${idx}`,
      status: 'pending',
    })),
  };
}
