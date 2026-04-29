/**
 * abstractionValidator — SQL 模板验证工具
 *
 * 验证抽象表的 SQL 模板格式和参数完整性
 */

import { AbstractionTable, SqlParameter } from '../types';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}

/**
 * 验证抽象表数据
 */
export const validateAbstractionTable = (
  table: Partial<AbstractionTable>
): ValidationResult => {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // 名称验证
  if (!table.name?.trim()) {
    errors.push({
      field: 'name',
      message: '名称不能为空',
      code: 'NAME_REQUIRED',
    });
  } else if (table.name.length > 100) {
    errors.push({
      field: 'name',
      message: '名称不能超过 100 个字符',
      code: 'NAME_TOO_LONG',
    });
  }

  // 领域验证
  if (!table.domain?.trim()) {
    errors.push({
      field: 'domain',
      message: '领域不能为空',
      code: 'DOMAIN_REQUIRED',
    });
  }

  // SQL 模板验证
  if (!table.sqlConfig?.template?.trim()) {
    errors.push({
      field: 'sqlConfig.template',
      message: 'SQL 模板不能为空',
      code: 'TEMPLATE_REQUIRED',
    });
  } else {
    // 检查 SQL 模板语法
    const templateValidation = validateSQLTemplate(
      table.sqlConfig.template,
      table.sqlConfig.parameters
    );
    errors.push(...templateValidation.errors);
    warnings.push(...templateValidation.warnings);
  }

  // 抽象路径验证
  if (!table.abstractionPath) {
    errors.push({
      field: 'abstractionPath',
      message: '抽象路径不能为空',
      code: 'PATH_REQUIRED',
    });
  } else {
    // 至少需要 concept
    if (!table.abstractionPath.concept?.trim()) {
      errors.push({
        field: 'abstractionPath.concept',
        message: '抽象路径的 concept 不能为空',
        code: 'CONCEPT_REQUIRED',
      });
    }

    // 检查层级是否合理（concept → property → relation → instance）
    const levels = ['concept', 'property', 'relation', 'instance'];
    const filledLevels = levels.filter(
      level => table.abstractionPath?.[level as keyof typeof table.abstractionPath]
    );

    // 如果有 property 但没有 concept
    if (table.abstractionPath.property && !table.abstractionPath.concept) {
      errors.push({
        field: 'abstractionPath',
        message: 'property 必须依赖 concept',
        code: 'PATH_ORDER_ERROR',
      });
    }

    // 如果有 relation 但没有 concept
    if (table.abstractionPath.relation && !table.abstractionPath.concept) {
      errors.push({
        field: 'abstractionPath',
        message: 'relation 必须依赖 concept',
        code: 'PATH_ORDER_ERROR',
      });
    }
  }

  // 操作类型验证
  const validOperations = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'AGGREGATE', 'JOIN', 'WINDOW', 'CTE'];
  if (!table.sqlConfig?.operation) {
    errors.push({
      field: 'sqlConfig.operation',
      message: 'SQL 操作类型不能为空',
      code: 'OPERATION_REQUIRED',
    });
  } else if (!validOperations.includes(table.sqlConfig.operation)) {
    errors.push({
      field: 'sqlConfig.operation',
      message: `无效的操作类型: ${table.sqlConfig.operation}`,
      code: 'INVALID_OPERATION',
    });
  }

  // 标签验证
  if (!table.tags || table.tags.length === 0) {
    warnings.push({
      field: 'tags',
      message: '建议添加标签以便分类',
      code: 'TAGS_EMPTY',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * 验证 SQL 模板格式
 */
export const validateSQLTemplate = (
  template: string,
  parameters?: SqlParameter[]
): { errors: ValidationError[]; warnings: ValidationWarning[] } => {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!template.trim()) {
    errors.push({
      field: 'template',
      message: 'SQL 模板不能为空',
      code: 'TEMPLATE_EMPTY',
    });
    return { errors, warnings };
  }

  // 检查是否包含基本 SQL 关键字
  const upperTemplate = template.toUpperCase();
  const hasSelect = upperTemplate.includes('SELECT');
  const hasInsert = upperTemplate.includes('INSERT');
  const hasUpdate = upperTemplate.includes('UPDATE');
  const hasDelete = upperTemplate.includes('DELETE');

  if (!hasSelect && !hasInsert && !hasUpdate && !hasDelete) {
    warnings.push({
      field: 'template',
      message: 'SQL 模板看起来不包含标准的 DML 语句（SELECT/INSERT/UPDATE/DELETE）',
      code: 'UNUSUAL_SQL',
    });
  }

  // 提取模板中的参数占位符
  const placeholderRegex = /\$\{([^}]+)\}/g;
  const placeholders = new Set<string>();
  let match;
  while ((match = placeholderRegex.exec(template)) !== null) {
    placeholders.add(match[1]);
  }

  // 检查参数定义
  if (parameters && parameters.length > 0) {
    const definedParams = new Set(parameters.map(p => p.name.replace(/^\$\{?/, '').replace(/\}$/, '')));

    // 检查未定义的占位符
    for (const placeholder of placeholders) {
      if (!definedParams.has(placeholder)) {
        warnings.push({
          field: 'template',
          message: `模板中存在未定义的参数占位符: \${${placeholder}}`,
          code: 'UNDEFINED_PLACEHOLDER',
        });
      }
    }

    // 检查未使用的参数
    for (const param of parameters) {
      const paramName = param.name.replace(/^\$\{?/, '').replace(/\}$/, '');
      if (!placeholders.has(paramName) && paramName !== 'table' && paramName !== 'column') {
        warnings.push({
          field: 'parameters',
          message: `参数 ${param.name} 在模板中未被使用`,
          code: 'UNUSED_PARAMETER',
        });
      }
    }
  } else if (placeholders.size > 0) {
    warnings.push({
      field: 'parameters',
      message: `模板包含 ${placeholders.size} 个占位符，但未定义参数`,
      code: 'MISSING_PARAMETERS',
    });
  }

  // 检查 SQL 注入风险（简单的警告）
  const dangerousPatterns = [
    { pattern: /;\s*DROP\s+/gi, message: '检测到 DROP 语句' },
    { pattern: /;\s*DELETE\s+FROM\s+/gi, message: '检测到 DELETE 语句' },
    { pattern: /;\s*TRUNCATE\s+/gi, message: '检测到 TRUNCATE 语句' },
  ];

  for (const { pattern, message } of dangerousPatterns) {
    if (pattern.test(template)) {
      warnings.push({
        field: 'template',
        message,
        code: 'POTENTIAL_DANGER',
      });
    }
  }

  return { errors, warnings };
};

/**
 * 验证导入数据格式
 */
export const validateImportData = (
  data: unknown
): { isValid: boolean; error?: string } => {
  if (!data || typeof data !== 'object') {
    return { isValid: false, error: '导入数据格式无效' };
  }

  const obj = data as Record<string, unknown>;

  // 检查版本
  if (!obj.version || typeof obj.version !== 'string') {
    return { isValid: false, error: '缺少版本信息' };
  }

  // 检查模板数据
  if (!Array.isArray(obj.templates)) {
    return { isValid: false, error: '缺少模板数据' };
  }

  // 检查每个模板
  for (let i = 0; i < obj.templates.length; i++) {
    const template = obj.templates[i] as Record<string, unknown>;
    if (!template.name || typeof template.name !== 'string') {
      return { isValid: false, error: `第 ${i + 1} 个模板缺少名称` };
    }
    // 兼容两种字段名：sqlConfig.template 或 sql
    const sqlTemplate = (template.sqlConfig as Record<string, unknown> | undefined)?.template as string | undefined;
    const sqlField = template.sql as string | undefined;
    if (!sqlTemplate && !sqlField) {
      return { isValid: false, error: `模板 "${template.name}" 缺少 SQL 模板` };
    }
  }

  return { isValid: true };
};
