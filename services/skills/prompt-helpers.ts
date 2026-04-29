import { AISkill } from '../../types';

export const generateFillPrompt = (
  skill: AISkill,
  inputs: Record<string, any>,
  currentTable?: string,
  currentColumns?: { name: string; type: string }[],
): string => {
  const tableName = currentTable || inputs.tableName || 'unknown_table';
  const columns = currentColumns?.map(c => `${c.name} (${c.type})`).join(', ') || '';

  const prompts: Record<string, string> = {
    'sql-select-generator': `基于表 ${tableName}${columns ? `，字段: ${columns}` : ''}，用户需求: "${inputs.description || '未填写'}"，生成优化的 SELECT 查询。`,
    'sql-join-generator': `基于当前表 ${tableName}，连接类型: ${inputs.joinType || 'INNER JOIN'}，连接条件: ${inputs.joinCondition || '未填写'}，生成完整的 JOIN 查询。`,
    'sql-create-table-nl': `基于用户需求描述: "${inputs.description || '未填写'}"，业务领域: ${inputs.businessDomain || '通用'}，生成完整的建表 SQL。`,
    'analysis-time-series': `基于时间列 ${inputs.timeColumn || '未选择'}，数值列 ${inputs.valueColumn || '未选择'}，时间粒度: ${inputs.granularity || '月'}，分析类型: ${inputs.analysisType || '趋势分析'}，生成时间序列分析 SQL。`,
    'transform-pivot': `基于行标签 ${inputs.rows || '未选择'}，列标签 ${inputs.columns || '未选择'}，值列 ${inputs.values || '未选择'}，聚合函数: ${inputs.aggregation || 'SUM'}，生成 PIVOT SQL。`,
    'optimization-query-rewrite': `优化以下 SQL: "${inputs.originalSql || '未填写'}"，优化目标: ${inputs.optimizationGoals || '性能优先'}。`,
  };

  return prompts[skill.id] || `基于技能 ${skill.name}，输入: ${JSON.stringify(inputs)}，生成 SQL。`;
};

export const generateContextHint = (
  skill: AISkill,
  table?: string,
  columns?: { name: string; type: string }[],
): string => {
  if (!table) return '';

  const colNames = columns?.map(c => c.name).join(', ') || '';
  const hints: Record<string, string> = {
    'sql-select-generator': `查询 ${table} 表中的数据${colNames ? `，可选字段：${colNames}` : ''}`,
    'sql-create-table-nl': `创建一个${table}表，包含业务所需的核心字段和属性`,
    'analysis-time-series': `按时间分析 ${table} 表中的数据变化趋势`,
    'transform-pivot': `将 ${table} 表从行转列，便于对比分析`,
  };

  return hints[skill.id] || `基于 ${table} 表生成 SQL`;
};
