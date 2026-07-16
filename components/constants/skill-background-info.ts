/**
 * Skill Background Info - Category-level help and guidance data
 *
 * Moved from SkillPanel.tsx. Contains the SKILL_BACKGROUND_INFO constant
 * used by BrowseMode background info panels.
 */

export const SKILL_BACKGROUND_INFO: Record<string, {
  title: string;
  scenarios: string[];
  commonErrors: string[];
  bestPractices: string[];
  aiPrompt: string;
}> = {
  all: {
    title: '全部技能',
    scenarios: [
      '浏览所有可用技能',
      '按分类筛选技能',
      '搜索特定技能',
      '导入自定义技能'
    ],
    commonErrors: [
      '技能选择不当导致生成结果不匹配',
      '未理解技能的使用场景',
      '忽略技能参数配置'
    ],
    bestPractices: [
      '先了解技能功能再使用',
      '根据需求选择合适的技能',
      '参考示例调整参数'
    ],
    aiPrompt: '帮我生成一个[需求描述]的 SQL，要求使用[表名]表'
  },
  smart: {
    title: '智能模式',
    scenarios: [
      '自然语言描述 SQL 需求',
      '意图分析与技能推荐',
      '一键生成可执行 SQL',
      '基于表结构的智能适配'
    ],
    commonErrors: [
      '描述过于模糊，导致意图识别失败',
      '未指定表名或列名，生成内容不匹配',
      '期望一步到位，缺少迭代优化'
    ],
    bestPractices: [
      '明确指定目标表和列',
      '描述具体的业务逻辑',
      '根据 AI 反馈补充缺失信息',
      '多次迭代优化结果'
    ],
    aiPrompt: '帮我生成一个[需求描述]的 SQL，要求使用[表名]表，包含[字段列表]'
  },
  sql: {
    title: 'SQL 生成',
    scenarios: [
      'SELECT 查询构建',
      'INSERT/UPDATE/DELETE 操作',
      'CREATE/ALTER/DROP 表结构',
      '索引和视图创建'
    ],
    commonErrors: [
      '未检查表名和列名是否存在',
      '忽略数据类型匹配',
      '缺少必要的 WHERE 条件'
    ],
    bestPractices: [
      '先了解目标表结构',
      '使用参数化查询',
      '添加适当的注释说明'
    ],
    aiPrompt: '帮我生成一个[具体需求]的 SQL 查询，使用[表名]表'
  },
  analysis: {
    title: '数据分析',
    scenarios: [
      '聚合统计与分组',
      '排名与 Top N 查询',
      '时间序列分析',
      '漏斗分析与留存'
    ],
    commonErrors: [
      '聚合函数使用不当',
      '分组与排序混淆',
      '窗口函数理解偏差'
    ],
    bestPractices: [
      '明确聚合维度',
      '合理使用 HAVING',
      '理解窗口函数的帧概念'
    ],
    aiPrompt: '帮我设计一个[分析类型]的 SQL，例如[具体业务场景]'
  },
  transformation: {
    title: '数据转换',
    scenarios: [
      '数据类型转换',
      '字符串处理',
      '行列转换',
      '条件逻辑 CASE'
    ],
    commonErrors: [
      '忽略转换后的 NULL 处理',
      '字符编码问题',
      '转换方向错误'
    ],
    bestPractices: [
      '使用 COALESCE 处理 NULL',
      '明确转换目标类型',
      '添加错误处理'
    ],
    aiPrompt: '帮我实现[转换类型]的数据转换，例如[具体场景]'
  },
  optimization: {
    title: '性能优化',
    scenarios: [
      'SQL 性能诊断',
      '索引建议',
      '查询重写',
      '执行计划分析'
    ],
    commonErrors: [
      '过早优化',
      '忽略统计信息',
      '滥用子查询'
    ],
    bestPractices: [
      '先分析执行计划',
      '关注瓶颈而非全面',
      '使用 EXPLAIN 分析'
    ],
    aiPrompt: '帮我优化这个 SQL：[SQL语句]，给出优化建议和替代方案'
  },
  utility: {
    title: '实用工具',
    scenarios: [
      '测试数据生成',
      'SQL 格式化',
      '批量操作',
      '辅助脚本'
    ],
    commonErrors: [
      '生成数据不符合业务规则',
      '批量操作缺少事务',
      '格式化破坏 SQL 语义'
    ],
    bestPractices: [
      '生成数据符合约束',
      '使用事务保证原子性',
      '保持格式化可读性'
    ],
    aiPrompt: '帮我生成[工具类型]工具，例如[具体需求]'
  }
};

/** Get category colors for tags — desaturated for visual harmony */
export const getCategoryTagColors = (category: string) => {
  const colors: Record<string, { bg: string; border: string; text: string }> = {
    modeling:      { bg: 'bg-monokai-amethyst/10', border: 'border-monokai-amethyst/20', text: 'text-monokai-amethyst' },
    wrangling:     { bg: 'bg-monokai-green/10', border: 'border-monokai-green/20', text: 'text-monokai-green' },
    insights:      { bg: 'bg-monokai-blue/10', border: 'border-monokai-blue/20', text: 'text-monokai-blue' },
    optimization:  { bg: 'bg-monokai-yellow/10', border: 'border-monokai-yellow/20', text: 'text-monokai-yellow' },
    engineering:   { bg: 'bg-monokai-cyan/10', border: 'border-monokai-cyan/20', text: 'text-monokai-cyan' },
    handbook:      { bg: 'bg-monokai-amethyst/10', border: 'border-monokai-amethyst/20', text: 'text-monokai-amethyst' },
  };
  return colors[category] ?? { bg: 'bg-monokai-amethyst/10', border: 'border-monokai-amethyst/20', text: 'text-monokai-amethyst' };
};
