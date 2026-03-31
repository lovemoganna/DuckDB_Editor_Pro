/**
 * AI Skills Diagnostics
 * 
 * Intelligent error diagnosis and auto-fix service for AI skills,
 * providing automated troubleshooting and repair suggestions.
 */

import { AISkill, SkillExecutionContext, SkillResult } from '../types';
import { getSkill, updateSkill } from './skillRegistry';
import { skillExecutor } from './skillExecutor';
import { SkillTestResult, SkillIssue, TestCaseResult } from './skillTester';
import { skillStorage } from './skillStorage';

/**
 * Diagnostic category
 */
export type DiagnosticCategory = 'syntax' | 'runtime' | 'logic' | 'performance' | 'compatibility';

/**
 * Diagnostic severity
 */
export type DiagnosticSeverity = 'critical' | 'high' | 'medium' | 'low';

/**
 * Diagnostic result
 */
export interface DiagnosticResult {
  category: DiagnosticCategory;
  severity: DiagnosticSeverity;
  title: string;
  description: string;
  location?: string;
  detectedAt: number;
  evidence?: string;
  fix?: DiagnosticFix;
  relatedIssues?: string[];
}

/**
 * Diagnostic fix suggestion
 */
export interface DiagnosticFix {
  type: 'auto' | 'manual';
  description: string;
  originalValue?: string;
  suggestedValue?: string;
  confidence: number; // 0-1
  risk: 'safe' | 'moderate' | 'risky';
  steps?: string[];
  code?: string;
}

/**
 * Comprehensive diagnostic report
 */
export interface DiagnosticReport {
  skillId: string;
  skillName: string;
  timestamp: number;
  diagnostics: DiagnosticResult[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    autoFixable: number;
  };
  testResults?: SkillTestResult;
  recommendations: string[];
}

/**
 * Common error patterns and fixes
 */
const ERROR_PATTERNS = [
  {
    pattern: /skill not found/i,
    category: 'runtime' as DiagnosticCategory,
    severity: 'critical' as DiagnosticSeverity,
    title: 'Skill未找到',
    getDescription: () => '指定的技能ID不存在于注册表中',
    fix: {
      type: 'manual' as const,
      description: '请检查技能ID是否正确，或使用有效的内置技能',
      risk: 'safe' as const,
      confidence: 1.0
    }
  },
  {
    pattern: /invalid.*json/i,
    category: 'syntax' as DiagnosticCategory,
    severity: 'high' as DiagnosticSeverity,
    title: 'JSON格式错误',
    getDescription: () => '技能定义包含无效的JSON格式',
    fix: {
      type: 'manual' as const,
      description: '请检查技能定义中的JSON语法，确保所有括号、引号匹配',
      risk: 'safe' as const,
      confidence: 0.9
    }
  },
  {
    pattern: /missing.*required.*field/i,
    category: 'syntax' as DiagnosticCategory,
    severity: 'critical' as DiagnosticSeverity,
    title: '缺少必需字段',
    getDescription: (field?: string) => `技能定义缺少必需字段: ${field || '未知'}`,
    fix: {
      type: 'manual' as const,
      description: '请确保技能定义包含所有必需字段: id, name, description, category, inputSchema',
      risk: 'safe' as const,
      confidence: 1.0
    }
  },
  {
    pattern: /undefined.*null/i,
    category: 'runtime' as DiagnosticCategory,
    severity: 'high' as DiagnosticSeverity,
    title: '空值引用错误',
    getDescription: () => '代码尝试访问null或undefined的属性',
    fix: {
      type: 'manual' as const,
      description: '请检查技能执行代码，确保所有对象在使用前已正确初始化',
      risk: 'moderate' as const,
      confidence: 0.7
    }
  },
  {
    pattern: /table.*not.*found/i,
    category: 'runtime' as DiagnosticCategory,
    severity: 'high' as DiagnosticSeverity,
    title: '表不存在',
    getDescription: () => '执行的SQL引用了不存在的表',
    fix: {
      type: 'manual' as const,
      description: '请确保在执行技能前选择了有效的表，或在技能输入中指定正确的表名',
      risk: 'safe' as const,
      confidence: 0.8
    }
  },
  {
    pattern: /syntax.*error/i,
    category: 'syntax' as DiagnosticCategory,
    severity: 'critical' as DiagnosticSeverity,
    title: 'SQL语法错误',
    getDescription: () => '生成的SQL语句包含语法错误',
    fix: {
      type: 'manual' as const,
      description: '请检查技能模板生成的SQL是否符合DuckDB语法',
      risk: 'moderate' as const,
      confidence: 0.8
    }
  }
];

/**
 * SQL-specific issues and fixes
 */
const SQL_ISSUES = [
  {
    check: (sql: string) => sql.includes('col') && sql.includes('table_name'),
    category: 'logic' as DiagnosticCategory,
    severity: 'medium' as DiagnosticSeverity,
    title: '模板占位符未替换',
    getDescription: () => 'SQL模板中的占位符(col, table_name)未被实际值替换',
    getFix: (sql: string) => ({
      type: 'auto' as const,
      description: '已自动添加占位符警告，实际使用时需要提供正确的表名和列名',
      confidence: 0.9,
      risk: 'safe' as const,
      steps: [
        '1. 确保技能执行时提供了正确的表名和列名',
        '2. 在SkillInvoker中正确设置executionContext'
      ]
    })
  },
  {
    check: (sql: string) => (sql.match(/\(/g) || []).length !== (sql.match(/\)/g) || []).length,
    category: 'syntax' as DiagnosticCategory,
    severity: 'critical' as DiagnosticSeverity,
    title: '括号不匹配',
    getDescription: () => 'SQL语句中括号的数量不匹配',
    getFix: () => ({
      type: 'manual' as const,
      description: '请检查SQL模板中的所有括号是否正确配对',
      confidence: 0.95,
      risk: 'moderate' as const,
      steps: [
        '1. 逐行检查SQL模板',
        '2. 确保每个开括号都有对应的闭括号',
        '3. 检查嵌套的函数调用'
      ]
    })
  },
  {
    check: (sql: string) => /WHERE/i.test(sql) && !/SELECT/i.test(sql),
    category: 'logic' as DiagnosticCategory,
    severity: 'high' as DiagnosticSeverity,
    title: 'WHERE条件无SELECT',
    getDescription: () => 'SQL包含WHERE子句但缺少SELECT',
    getFix: () => ({
      type: 'manual' as const,
      description: '请确保SQL语句以SELECT开头',
      confidence: 0.9,
      risk: 'safe' as const
    })
  },
  {
    check: (sql: string) => /DROP|TRUNCATE|DELETE/i.test(sql) && !/WHERE/i.test(sql) && !/CREATE/i.test(sql),
    category: 'performance' as DiagnosticCategory,
    severity: 'high' as DiagnosticSeverity,
    title: '危险操作无限制',
    getDescription: () => '执行的删除/清空操作没有WHERE条件，可能导致数据丢失',
    getFix: () => ({
      type: 'auto' as const,
      description: '已检测到危险操作，添加安全警告',
      confidence: 1.0,
      risk: 'safe' as const,
      steps: [
        '1. 确认是否需要WHERE条件',
        '2. 建议先备份数据',
        '3. 使用事务执行'
      ]
    })
  },
  {
    check: (sql: string) => sql.length > 10000,
    category: 'performance' as DiagnosticCategory,
    severity: 'medium' as DiagnosticSeverity,
    title: 'SQL语句过长',
    getDescription: () => '生成的SQL语句超过10000字符，可能影响性能',
    getFix: () => ({
      type: 'manual' as const,
      description: '建议将复杂的SQL拆分为多个简单语句或使用CTE',
      confidence: 0.7,
      risk: 'safe' as const
    })
  }
];

/**
 * SkillDiagnostics class
 */
class SkillDiagnostics {
  private diagnosticHistory: DiagnosticReport[] = [];
  private maxHistorySize = 30;

  /**
   * Run comprehensive diagnostics on a skill
   */
  async diagnose(skillId: string, testResults?: SkillTestResult): Promise<DiagnosticReport> {
    const skill = getSkill(skillId);
    const diagnostics: DiagnosticResult[] = [];
    const recommendations: string[] = [];

    if (!skill) {
      return this.createErrorReport(skillId, 'Skill not found');
    }

    const report: DiagnosticReport = {
      skillId,
      skillName: skill.name,
      timestamp: Date.now(),
      diagnostics,
      summary: {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        autoFixable: 0
      },
      testResults,
      recommendations
    };

    try {
      // 1. Analyze skill structure
      this.analyzeSkillStructure(skill, diagnostics);

      // 2. Analyze input schema
      this.analyzeInputSchema(skill, diagnostics);

      // 3. Analyze skill templates/prompts
      await this.analyzeSkillTemplates(skill, diagnostics);

      // 4. Analyze test results if provided
      if (testResults) {
        this.analyzeTestResults(testResults, diagnostics);
      }

      // 5. Generate recommendations
      recommendations.push(...this.generateRecommendations(diagnostics, skill));

    } catch (error) {
      diagnostics.push({
        category: 'runtime',
        severity: 'critical',
        title: '诊断过程出错',
        description: (error as Error).message,
        detectedAt: Date.now()
      });
    }

    // Calculate summary
    report.summary = this.calculateSummary(diagnostics);
    report.diagnostics = diagnostics;
    report.recommendations = recommendations;

    // Add to history
    this.addToHistory(report);

    return report;
  }

  /**
   * Analyze skill structure
   */
  private analyzeSkillStructure(skill: AISkill, diagnostics: DiagnosticResult[]): void {
    // Check required fields
    if (!skill.id) {
      diagnostics.push({
        category: 'syntax',
        severity: 'critical',
        title: '缺少技能ID',
        description: '技能定义缺少必需的id字段',
        detectedAt: Date.now(),
        fix: {
          type: 'manual',
          description: '为技能添加唯一的id字段，使用kebab-case格式',
          risk: 'safe',
          confidence: 1.0,
          code: `id: 'my-custom-skill'`
        }
      });
    }

    if (!skill.name) {
      diagnostics.push({
        category: 'syntax',
        severity: 'critical',
        title: '缺少技能名称',
        description: '技能定义缺少必需的name字段',
        detectedAt: Date.now(),
        fix: {
          type: 'manual',
          description: '为技能添加清晰的name字段',
          risk: 'safe',
          confidence: 1.0
        }
      });
    }

    if (!skill.category) {
      diagnostics.push({
        category: 'syntax',
        severity: 'high',
        title: '缺少技能分类',
        description: '技能定义缺少category字段',
        detectedAt: Date.now(),
        fix: {
          type: 'manual',
          description: '为技能指定category: sql | analysis | transformation | optimization | utility',
          risk: 'safe',
          confidence: 1.0
        }
      });
    }

    // Check ID format
    if (skill.id && !/^[a-z][a-z0-9-]*$/.test(skill.id)) {
      diagnostics.push({
        category: 'syntax',
        severity: 'low',
        title: '技能ID格式不规范',
        description: '技能ID应使用kebab-case格式',
        detectedAt: Date.now(),
        fix: {
          type: 'manual',
          description: '将ID改为小写字母开头，只包含字母、数字和连字符',
          risk: 'safe',
          confidence: 0.9,
          originalValue: skill.id,
          suggestedValue: skill.id.toLowerCase().replace(/[^a-z0-9]/g, '-')
        }
      });
    }
  }

  /**
   * Analyze input schema
   */
  private analyzeInputSchema(skill: AISkill, diagnostics: DiagnosticResult[]): void {
    if (!skill.inputSchema || skill.inputSchema.length === 0) {
      diagnostics.push({
        category: 'syntax',
        severity: 'high',
        title: '缺少输入字段定义',
        description: '技能没有定义任何输入字段',
        detectedAt: Date.now(),
        fix: {
          type: 'manual',
          description: '为技能添加inputSchema数组，定义用户需要提供的输入',
          risk: 'safe',
          confidence: 1.0,
          steps: [
            '1. 确定技能需要哪些输入参数',
            '2. 为每个参数定义字段类型',
            '3. 标记必需字段和可选字段'
          ]
        }
      });
      return;
    }

    // Check each field
    skill.inputSchema.forEach((field, index) => {
      // Check for required field without label
      if (field.required && !field.label) {
        diagnostics.push({
          category: 'syntax',
          severity: 'medium',
          title: `字段${index}缺少标签`,
          description: `字段 ${field.name} 是必需的但没有定义label`,
          location: `inputSchema[${index}]`,
          detectedAt: Date.now(),
          fix: {
            type: 'auto',
            description: '自动生成字段标签',
            risk: 'safe',
            confidence: 0.8,
            suggestedValue: field.name.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
          }
        });
      }

      // Check select fields without options
      if (field.type === 'select' && (!field.options || field.options.length === 0)) {
        diagnostics.push({
          category: 'syntax',
          severity: 'high',
          title: `选择字段缺少选项`,
          description: `字段 ${field.name} 是select类型但没有定义options`,
          location: `inputSchema[${index}]`,
          detectedAt: Date.now(),
          fix: {
            type: 'manual',
            description: '为select类型字段添加options数组',
            risk: 'safe',
            confidence: 1.0
          }
        });
      }

      // Check for fields without defaults in complex skills
      if (field.required && field.defaultValue === undefined) {
        diagnostics.push({
          category: 'logic',
          severity: 'low',
          title: `必需字段无默认值`,
          description: `字段 ${field.name} 是必需的但没有默认值，用户必须手动输入`,
          location: `inputSchema[${index}]`,
          detectedAt: Date.now()
        });
      }
    });
  }

  /**
   * Analyze skill templates
   */
  private async analyzeSkillTemplates(skill: AISkill, diagnostics: DiagnosticResult[]): Promise<void> {
    try {
      // Try to generate SQL and check for issues
      const testContext: SkillExecutionContext = {
        tableName: 'test_table',
        columns: [
          { name: 'id', type: 'INTEGER' },
          { name: 'name', type: 'VARCHAR(100)' }
        ]
      };

      // Generate minimal test inputs
      const testInputs: Record<string, any> = {};
      skill.inputSchema?.forEach(field => {
        if (field.type === 'text') testInputs[field.name] = 'test';
        else if (field.type === 'number') testInputs[field.name] = 1;
        else if (field.type === 'boolean') testInputs[field.name] = false;
        else if (field.type === 'select') testInputs[field.name] = field.options?.[0];
        else testInputs[field.name] = 'test';
      });

      const result = await skillExecutor.execute({
        skillId: skill.id,
        inputs: testInputs,
        context: testContext,
        simulateOnly: true
      });

      if (result.success && result.sql) {
        // Check for template placeholders
        this.checkForPlaceholders(result.sql, diagnostics);
        
        // Check SQL syntax issues
        this.checkSQLSyntax(result.sql, diagnostics);
      } else if (result.error) {
        // Analyze the error
        this.analyzeError(result.error, diagnostics);
      }

    } catch (error) {
      diagnostics.push({
        category: 'runtime',
        severity: 'high',
        title: '技能执行失败',
        description: (error as Error).message,
        detectedAt: Date.now()
      });
    }
  }

  /**
   * Check for template placeholders
   */
  private checkForPlaceholders(sql: string, diagnostics: DiagnosticResult[]): void {
    const placeholderPatterns = [
      { pattern: /\b(col|column|field)\b/i, suggestion: '实际的列名' },
      { pattern: /\b(table|name)\b(?!\s*")/i, suggestion: '实际的表名' },
      { pattern: /\{[^}]+\}/g, suggestion: '模板变量' }
    ];

    placeholderPatterns.forEach(({ pattern, suggestion }) => {
      if (pattern.test(sql)) {
        diagnostics.push({
          category: 'logic',
          severity: 'medium',
          title: '可能存在未替换的占位符',
          description: `SQL中可能包含未替换的${suggestion}`,
          evidence: sql.substring(0, 200),
          detectedAt: Date.now(),
          fix: {
            type: 'manual',
            description: '确保执行时提供了所有必需的上下文信息',
            risk: 'safe',
            confidence: 0.7
          }
        });
      }
    });
  }

  /**
   * Check SQL syntax issues
   */
  private checkSQLSyntax(sql: string, diagnostics: DiagnosticResult[]): void {
    SQL_ISSUES.forEach(issue => {
      if (issue.check(sql)) {
        diagnostics.push({
          category: issue.category,
          severity: issue.severity,
          title: issue.title,
          description: issue.getDescription(),
          evidence: sql.substring(0, 300),
          detectedAt: Date.now(),
          fix: issue.getFix(sql)
        });
      }
    });
  }

  /**
   * Analyze test results
   */
  private analyzeTestResults(testResults: SkillTestResult, diagnostics: DiagnosticResult[]): void {
    testResults.testResults.forEach(test => {
      if (!test.passed) {
        diagnostics.push({
          category: 'runtime',
          severity: test.error?.includes('critical') ? 'high' : 'medium',
          title: `测试失败: ${test.name}`,
          description: test.error || '测试未通过',
          evidence: test.actual,
          detectedAt: Date.now()
        });
      }
    });

    // Add warnings from test results
    testResults.issues?.forEach(issue => {
      if (issue.severity === 'warning') {
        diagnostics.push({
          category: 'logic',
          severity: 'low',
          title: issue.message,
          description: issue.message,
          detectedAt: Date.now(),
          fix: issue.fix ? {
            type: 'manual',
            description: issue.fix,
            risk: 'safe',
            confidence: 0.6
          } : undefined
        });
      }
    });
  }

  /**
   * Analyze error message
   */
  private analyzeError(error: string, diagnostics: DiagnosticResult[]): void {
    ERROR_PATTERNS.forEach(({ pattern, category, severity, title, getDescription, fix }) => {
      if (pattern.test(error)) {
        diagnostics.push({
          category,
          severity,
          title,
          description: getDescription(),
          evidence: error,
          detectedAt: Date.now(),
          fix
        });
      }
    });

    // If no pattern matched, add generic error
    if (!ERROR_PATTERNS.some(p => p.pattern.test(error))) {
      diagnostics.push({
        category: 'runtime',
        severity: 'high',
        title: '执行错误',
        description: error,
        detectedAt: Date.now()
      });
    }
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(diagnostics: DiagnosticResult[], skill: AISkill): string[] {
    const recommendations: string[] = [];
    const criticalCount = diagnostics.filter(d => d.severity === 'critical').length;
    const autoFixable = diagnostics.filter(d => d.fix?.type === 'auto').length;

    if (criticalCount > 0) {
      recommendations.push('⚠️ 技能存在严重问题，建议修复后再使用');
    }

    if (autoFixable > 0) {
      recommendations.push(`✨ 发现 ${autoFixable} 个问题可以自动修复`);
    }

    if (!skill.examples || skill.examples.length === 0) {
      recommendations.push('📝 建议添加示例数据，帮助用户理解技能用法');
    }

    if (diagnostics.some(d => d.category === 'performance')) {
      recommendations.push('⚡ 建议优化SQL性能，避免使用SELECT *和大数据操作');
    }

    if (diagnostics.length === 0) {
      recommendations.push('✅ 技能诊断通过，未发现问题');
    }

    return recommendations;
  }

  /**
   * Calculate diagnostic summary
   */
  private calculateSummary(diagnostics: DiagnosticResult[]): DiagnosticReport['summary'] {
    return {
      total: diagnostics.length,
      critical: diagnostics.filter(d => d.severity === 'critical').length,
      high: diagnostics.filter(d => d.severity === 'high').length,
      medium: diagnostics.filter(d => d.severity === 'medium').length,
      low: diagnostics.filter(d => d.severity === 'low').length,
      autoFixable: diagnostics.filter(d => d.fix?.type === 'auto').length
    };
  }

  /**
   * Create error report
   */
  private createErrorReport(skillId: string, message: string): DiagnosticReport {
    return {
      skillId,
      skillName: 'Unknown',
      timestamp: Date.now(),
      diagnostics: [{
        category: 'runtime',
        severity: 'critical',
        title: '诊断失败',
        description: message,
        detectedAt: Date.now()
      }],
      summary: {
        total: 1,
        critical: 1,
        high: 0,
        medium: 0,
        low: 0,
        autoFixable: 0
      },
      recommendations: ['请检查技能ID是否正确']
    };
  }

  /**
   * Add to history
   */
  private addToHistory(report: DiagnosticReport): void {
    this.diagnosticHistory.unshift(report);
    if (this.diagnosticHistory.length > this.maxHistorySize) {
      this.diagnosticHistory = this.diagnosticHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Get diagnostic history
   */
  getHistory(): DiagnosticReport[] {
    return [...this.diagnosticHistory];
  }

  /**
   * Get latest diagnostic for a skill
   */
  getLatest(skillId: string): DiagnosticReport | null {
    return this.diagnosticHistory.find(r => r.skillId === skillId) || null;
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.diagnosticHistory = [];
  }

  /**
   * Auto-fix skill if possible
   */
  async autoFix(skillId: string): Promise<{ success: boolean; fixed: number; errors: string[]; fixedSkills?: AISkill[] }> {
    const skill = getSkill(skillId);
    if (!skill) {
      return { success: false, fixed: 0, errors: ['Skill not found'] };
    }

    const diagnostics = await this.diagnose(skillId);
    let fixed = 0;
    const errors: string[] = [];
    const fixedSkills: AISkill[] = [];

    // Clone the skill for modification
    let fixedSkill = { ...skill, inputSchema: [...skill.inputSchema] } as AISkill;

    // Only apply auto-fixes for safe, high-confidence fixes
    const autoFixable = diagnostics.diagnostics.filter(d => 
      d.fix?.type === 'auto' && 
      d.fix.confidence > 0.7 &&
      d.fix.risk === 'safe'
    );

    if (autoFixable.length === 0) {
      return { success: false, fixed: 0, errors: ['没有可自动修复的问题'] };
    }

    // Apply auto-fixes based on diagnostic results
    for (const diagnostic of autoFixable) {
      try {
        // Fix: Generate label for fields missing labels
        if (diagnostic.title.includes('缺少标签') && diagnostic.location) {
          const match = diagnostic.location.match(/inputSchema\[(\d+)\]/);
          if (match) {
            const index = parseInt(match[1]);
            if (fixedSkill.inputSchema[index]) {
              const suggestedLabel = diagnostic.fix?.suggestedValue || 
                fixedSkill.inputSchema[index].name.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
              fixedSkill.inputSchema[index] = {
                ...fixedSkill.inputSchema[index],
                label: suggestedLabel
              };
              fixed++;
              console.log(`[AutoFix] Fixed: Added label "${suggestedLabel}" to field ${fixedSkill.inputSchema[index].name}`);
            }
          }
        }

        // Fix: Generate default values for required fields
        if (diagnostic.title.includes('无默认值') && diagnostic.location) {
          const match = diagnostic.location.match(/inputSchema\[(\d+)\]/);
          if (match) {
            const index = parseInt(match[1]);
            if (fixedSkill.inputSchema[index]) {
              const field = fixedSkill.inputSchema[index];
              let defaultValue: any;
              switch (field.type) {
                case 'text':
                case 'textarea':
                  defaultValue = '';
                  break;
                case 'number':
                  defaultValue = 0;
                  break;
                case 'boolean':
                  defaultValue = false;
                  break;
                case 'select':
                  defaultValue = field.options?.[0] || '';
                  break;
                default:
                  defaultValue = null;
              }
              fixedSkill.inputSchema[index] = {
                ...field,
                defaultValue
              };
              fixed++;
              console.log(`[AutoFix] Fixed: Added default value to field ${field.name}`);
            }
          }
        }

        // Fix: ID format issues
        if (diagnostic.title.includes('ID格式') && diagnostic.fix?.suggestedValue) {
          const suggestedId = diagnostic.fix.suggestedValue;
          // Update skill ID
          const oldId = fixedSkill.id;
          fixedSkill = { ...fixedSkill, id: suggestedId };
          
          // Also update in storage
          skillStorage.deleteSkill(oldId);
          skillStorage.saveSkill(fixedSkill);
          
          fixed++;
          console.log(`[AutoFix] Fixed: Renamed skill from "${oldId}" to "${suggestedId}"`);
        }

      } catch (e) {
        errors.push(`Failed to apply fix for "${diagnostic.title}": ${(e as Error).message}`);
      }
    }

    // If we made changes, update the skill registry and storage
    if (fixed > 0) {
      try {
        // Update in skill registry
        updateSkill(fixedSkill);
        
        // Update in storage (for custom skills)
        const stored = skillStorage.getSkill(skillId);
        if (stored && stored.source !== 'built-in') {
          skillStorage.saveSkill(fixedSkill);
        }
        
        fixedSkills.push(fixedSkill);
        console.log(`[AutoFix] Successfully applied ${fixed} fixes to skill "${fixedSkill.name}"`);
      } catch (e) {
        errors.push(`Failed to save fixed skill: ${(e as Error).message}`);
        return { success: false, fixed: 0, errors };
      }
    }

    return { success: true, fixed, errors, fixedSkills };
  }
}

// Singleton instance
export const skillDiagnostics = new SkillDiagnostics();

// Export convenience functions
export const diagnoseSkill = (skillId: string, testResults?: SkillTestResult) => 
  skillDiagnostics.diagnose(skillId, testResults);

export const getDiagnosticHistory = () => skillDiagnostics.getHistory();

export const getLatestDiagnostic = (skillId: string) => skillDiagnostics.getLatest(skillId);

export const clearDiagnosticHistory = () => skillDiagnostics.clearHistory();

export const autoFixSkill = (skillId: string) => skillDiagnostics.autoFix(skillId);

export type { DiagnosticResult, DiagnosticFix, DiagnosticReport, DiagnosticCategory, DiagnosticSeverity };
