// ============================================================
// Assertion Template Library for V6.0
// ============================================================
import { AssertionTemplate, CustomAssertion } from '../../types';

/**
 * Pre-defined assertion templates for common data quality checks
 */
export const ASSERTION_TEMPLATES: AssertionTemplate[] = [
  // Null Check Templates
  {
    id: 'null_check_required',
    name: '必填字段校验',
    category: 'null_check',
    description: '检查必填字段是否存在空值',
    templateSql: 'SELECT count(*) as null_count FROM "${table}" WHERE ${column} IS NULL',
    params: [
      { name: 'table', type: 'string', required: true },
      { name: 'column', type: 'column', required: true }
    ]
  },
  {
    id: 'null_check_percent',
    name: '空值率校验',
    category: 'null_check',
    description: '检查字段空值率是否超过阈值',
    templateSql: 'SELECT count(*) * 100.0 / (SELECT count(*) FROM "${table}") as null_percent FROM "${table}" WHERE ${column} IS NULL',
    params: [
      { name: 'table', type: 'string', required: true },
      { name: 'column', type: 'column', required: true },
      { name: 'threshold', type: 'number', required: false, default: 5 }
    ]
  },
  
  // Uniqueness Templates
  {
    id: 'unique_check',
    name: '唯一性校验',
    category: 'uniqueness',
    description: '检查字段值是否唯一（主键或标识字段）',
    templateSql: 'SELECT count(*) - count(DISTINCT ${column}) as duplicate_count FROM "${table}"',
    params: [
      { name: 'table', type: 'string', required: true },
      { name: 'column', type: 'column', required: true }
    ]
  },
  {
    id: 'unique_composite',
    name: '复合唯一性校验',
    category: 'uniqueness',
    description: '检查多个字段组合是否唯一',
    templateSql: 'SELECT count(*) - count(DISTINCT ${column1} || \'_\' || ${column2}) as duplicate_count FROM "${table}"',
    params: [
      { name: 'table', type: 'string', required: true },
      { name: 'column1', type: 'column', required: true },
      { name: 'column2', type: 'column', required: true }
    ]
  },

  // Range Check Templates
  {
    id: 'range_positive',
    name: '正数校验',
    category: 'range',
    description: '检查数值字段是否为正数',
    templateSql: 'SELECT count(*) as invalid_count FROM "${table}" WHERE ${column} <= 0',
    params: [
      { name: 'table', type: 'string', required: true },
      { name: 'column', type: 'column', required: true }
    ]
  },
  {
    id: 'range_bound',
    name: '范围校验',
    category: 'range',
    description: '检查字段值是否在指定范围内',
    templateSql: 'SELECT count(*) as out_of_range FROM "${table}" WHERE ${column} < ${min} OR ${column} > ${max}',
    params: [
      { name: 'table', type: 'string', required: true },
      { name: 'column', type: 'column', required: true },
      { name: 'min', type: 'number', required: true },
      { name: 'max', type: 'number', required: true }
    ]
  },
  {
    id: 'range_date_future',
    name: '未来日期校验',
    category: 'range',
    description: '检查日期字段是否包含未来日期（异常检测）',
    templateSql: 'SELECT count(*) as future_count FROM "${table}" WHERE ${column} > CURRENT_DATE',
    params: [
      { name: 'table', type: 'string', required: true },
      { name: 'column', type: 'column', required: true }
    ]
  },

  // Relationship Check Templates
  {
    id: 'relationship_foreign_key',
    name: '外键关联校验',
    category: 'relationship',
    description: '检查外键是否在关联表中存在',
    templateSql: 'SELECT count(*) as orphan_count FROM "${table}" t WHERE NOT EXISTS (SELECT 1 FROM "${ref_table}" r WHERE t.${column} = r.${ref_column})',
    params: [
      { name: 'table', type: 'string', required: true },
      { name: 'column', type: 'column', required: true },
      { name: 'ref_table', type: 'string', required: true },
      { name: 'ref_column', type: 'column', required: true }
    ]
  },
  {
    id: 'relationship_cardinality',
    name: '基数校验',
    category: 'relationship',
    description: '检查一对多关系的基数是否合理',
    templateSql: 'SELECT ${group_by}, count(*) as cnt FROM "${table}" GROUP BY ${group_by} HAVING count(*) > ${max_count}',
    params: [
      { name: 'table', type: 'string', required: true },
      { name: 'group_by', type: 'column', required: true },
      { name: 'max_count', type: 'number', required: false, default: 1000 }
    ]
  },

  // Custom Business Rules
  {
    id: 'custom_regex',
    name: '格式校验',
    category: 'custom',
    description: '使用正则表达式校验字段格式',
    templateSql: 'SELECT count(*) as invalid_format FROM "${table}" WHERE ${column} NOT REGEXP \'${pattern}\'',
    params: [
      { name: 'table', type: 'string', required: true },
      { name: 'column', type: 'column', required: true },
      { name: 'pattern', type: 'string', required: true }
    ]
  },
  {
    id: 'custom_value_set',
    name: '枚举值校验',
    category: 'custom',
    description: '检查字段值是否在允许的枚举值列表中',
    templateSql: 'SELECT count(*) as invalid_enum FROM "${table}" WHERE ${column} NOT IN (${values})',
    params: [
      { name: 'table', type: 'string', required: true },
      { name: 'column', type: 'column', required: true },
      { name: 'values', type: 'string', required: true }
    ]
  },
  {
    id: 'custom_data_freshness',
    name: '数据时效性校验',
    category: 'custom',
    description: '检查数据是否在指定时间内有更新',
    templateSql: 'SELECT DATEDIFF(\'${unit}\', MAX(${date_column}), CURRENT_TIMESTAMP) as days_since_update FROM "${table}"',
    params: [
      { name: 'table', type: 'string', required: true },
      { name: 'date_column', type: 'column', required: true },
      { name: 'unit', type: 'string', required: false, default: 'day' }
    ]
  }
];

/**
 * Generate a CustomAssertion from a template
 */
export const createAssertionFromTemplate = (
  template: AssertionTemplate,
  params: Record<string, string | number>,
  tableName: string,
  column?: string
): CustomAssertion => {
  let sql = template.templateSql
    .replace(/\${table}/g, params.table as string || tableName)
    .replace(/\${column}/g, params.column as string || column || '')
    .replace(/\${column1}/g, params.column1 as string || '')
    .replace(/\${column2}/g, params.column2 as string || '')
    .replace(/\${ref_table}/g, params.ref_table as string || '')
    .replace(/\${ref_column}/g, params.ref_column as string || '')
    .replace(/\${group_by}/g, params.group_by as string || '')
    .replace(/\${min}/g, String(params.min || 0))
    .replace(/\${max}/g, String(params.max || 0))
    .replace(/\${max_count}/g, String(params.max_count || 1000))
    .replace(/\${pattern}/g, params.pattern as string || '')
    .replace(/\${values}/g, params.values as string || '')
    .replace(/\${date_column}/g, params.date_column as string || '')
    .replace(/\${unit}/g, params.unit as string || 'day')
    .replace(/\${threshold}/g, String(params.threshold || 5));

  // Determine severity based on category
  let severity: 'error' | 'warning' | 'info' = 'warning';
  if (template.category === 'null_check' || template.category === 'uniqueness') {
    severity = 'error';
  }

  return {
    id: `custom_${Date.now()}`,
    name: template.name,
    description: template.description,
    sql: sql,
    expectedValue: 0,
    severity: severity,
    category: template.category,
    status: 'pending'
  };
};

/**
 * Get templates by category
 */
export const getTemplatesByCategory = (category: AssertionTemplate['category']): AssertionTemplate[] => {
  return ASSERTION_TEMPLATES.filter(t => t.category === category);
};

/**
 * Get all unique categories
 */
export const getAssertionCategories = (): AssertionTemplate['category'][] => {
  return [...new Set(ASSERTION_TEMPLATES.map(t => t.category))];
};

export default {
  ASSERTION_TEMPLATES,
  createAssertionFromTemplate,
  getTemplatesByCategory,
  getAssertionCategories
};
