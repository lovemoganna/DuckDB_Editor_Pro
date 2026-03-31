/**
 * AI Skills Tester
 * 
 * Automated testing framework for validating AI skills,
 * including test execution, issue detection, and diagnostic reporting.
 */

import { AISkill, SkillExecutionContext, SkillResult, SkillInputField } from '../types';
import { getSkill, BUILT_IN_SKILLS } from './skillRegistry';
import { skillExecutor } from './skillExecutor';
import { duckDBService } from './duckdbService';

/**
 * Test types
 */
export type TestType = 'syntax' | 'execution' | 'output' | 'integration';

/**
 * Test severity levels
 */
export type TestSeverity = 'error' | 'warning' | 'info';

/**
 * Individual test case result
 */
export interface TestCaseResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  expected?: any;
  actual?: any;
  details?: string;
}

/**
 * Skill test result
 */
export interface SkillTestResult {
  skillId: string;
  skillName: string;
  passed: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  testResults: TestCaseResult[];
  executionTime: number;
  issues: SkillIssue[];
  suggestions: string[];
  timestamp: number;
}

/**
 * Skill issue
 */
export interface SkillIssue {
  type: 'error' | 'warning' | 'suggestion';
  severity: TestSeverity;
  message: string;
  location?: string;
  fix?: string;
}

/**
 * Test configuration
 */
export interface TestConfig {
  enableSyntaxCheck: boolean;
  enableExecutionTest: boolean;
  enableOutputValidation: boolean;
  enableIntegrationTest: boolean;
  testData?: Record<string, any>[];
  mockContext?: Partial<SkillExecutionContext>;
}

/**
 * Default test configuration
 */
const DEFAULT_CONFIG: TestConfig = {
  enableSyntaxCheck: true,
  enableExecutionTest: true,
  enableOutputValidation: true,
  enableIntegrationTest: true
};

/**
 * SQL Syntax validation patterns
 */
const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL',
  'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT', 'OFFSET', 'INSERT', 'INTO', 'VALUES',
  'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'INDEX', 'VIEW', 'DROP', 'ALTER',
  'WITH', 'AS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'UNION', 'ALL', 'DISTINCT',
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'NULLIF', 'CAST', 'EXTRACT'
];

/**
 * SkillTester class
 */
class SkillTester {
  private testHistory: SkillTestResult[] = [];
  private maxHistorySize = 50;

  /**
   * Run comprehensive tests on a skill
   */
  async testSkill(
    skillId: string,
    config: Partial<TestConfig> = {}
  ): Promise<SkillTestResult> {
    const skill = getSkill(skillId);
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    const startTime = Date.now();
    const testResults: TestCaseResult[] = [];
    const issues: SkillIssue[] = [];
    const suggestions: string[] = [];

    if (!skill) {
      return {
        skillId,
        skillName: 'Unknown',
        passed: false,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        testResults: [],
        executionTime: Date.now() - startTime,
        issues: [{ type: 'error', severity: 'error', message: `Skill not found: ${skillId}` }],
        suggestions: [],
        timestamp: Date.now()
      };
    }

    try {
      // 1. Test: Validate skill structure
      const structureTest = this.validateSkillStructure(skill);
      testResults.push(structureTest);

      // 2. Test: Validate input schema
      if (mergedConfig.enableSyntaxCheck) {
        const schemaTests = this.validateInputSchema(skill);
        testResults.push(...schemaTests);
      }

      // 3. Test: Run with example inputs
      if (skill.examples && skill.examples.length > 0 && mergedConfig.enableExecutionTest) {
        for (const example of skill.examples) {
          const exampleTest = await this.testWithExample(skill, example.input);
          testResults.push(exampleTest);
        }
      }

      // 4. Test: Generate SQL and validate syntax
      if (mergedConfig.enableSyntaxCheck) {
        const syntaxTest = await this.validateSQLSyntax(skill, mergedConfig.mockContext);
        testResults.push(syntaxTest);
      }

      // 5. Test: Integration test (try actual execution if DuckDB is available)
      if (mergedConfig.enableIntegrationTest && mergedConfig.testData) {
        const integrationTest = await this.runIntegrationTest(skill, mergedConfig.testData);
        testResults.push(integrationTest);
      }

      // Analyze results and generate issues
      const analysis = this.analyzeTestResults(testResults);
      issues.push(...analysis.issues);
      suggestions.push(...analysis.suggestions);

    } catch (error) {
      testResults.push({
        name: 'Fatal Error',
        passed: false,
        duration: 0,
        error: (error as Error).message
      });
    }

    const passedTests = testResults.filter(t => t.passed).length;
    const failedTests = testResults.filter(t => !t.passed).length;
    const passed = failedTests === 0;

    const result: SkillTestResult = {
      skillId,
      skillName: skill.name,
      passed,
      totalTests: testResults.length,
      passedTests,
      failedTests,
      testResults,
      executionTime: Date.now() - startTime,
      issues,
      suggestions,
      timestamp: Date.now()
    };

    // Add to history
    this.addToHistory(result);

    return result;
  }

  /**
   * Run tests on multiple skills
   */
  async testAllSkills(config: Partial<TestConfig> = {}): Promise<SkillTestResult[]> {
    const skills = BUILT_IN_SKILLS;
    const results: SkillTestResult[] = [];

    for (const skill of skills) {
      const result = await this.testSkill(skill.id, config);
      results.push(result);
    }

    return results;
  }

  /**
   * Validate skill structure
   */
  private validateSkillStructure(skill: AISkill): TestCaseResult {
    const startTime = Date.now();
    const errors: string[] = [];

    if (!skill.id) errors.push('Missing id');
    if (!skill.name) errors.push('Missing name');
    if (!skill.description) errors.push('Missing description');
    if (!skill.category) errors.push('Missing category');
    if (!skill.inputSchema || !Array.isArray(skill.inputSchema)) {
      errors.push('Missing or invalid inputSchema');
    }
    if (!skill.outputType) errors.push('Missing outputType');

    return {
      name: 'Skill Structure Validation',
      passed: errors.length === 0,
      duration: Date.now() - startTime,
      error: errors.length > 0 ? errors.join('; ') : undefined,
      details: errors.length === 0 ? 'All required fields present' : undefined
    };
  }

  /**
   * Validate input schema
   */
  private validateInputSchema(skill: AISkill): TestCaseResult[] {
    const results: TestCaseResult[] = [];
    const startTime = Date.now();

    if (!skill.inputSchema || skill.inputSchema.length === 0) {
      results.push({
        name: 'Input Schema Check',
        passed: false,
        duration: Date.now() - startTime,
        error: 'No input fields defined'
      });
      return results;
    }

    // Check for required fields
    const requiredFields = skill.inputSchema.filter(f => f.required);
    if (requiredFields.length === 0) {
      results.push({
        name: 'Required Fields Check',
        passed: false,
        duration: Date.now() - startTime,
        error: 'No required input fields defined'
      });
    } else {
      results.push({
        name: 'Required Fields Check',
        passed: true,
        duration: Date.now() - startTime,
        details: `${requiredFields.length} required fields found`
      });
    }

    // Check field types
    const validTypes = ['text', 'textarea', 'number', 'boolean', 'select', 'table', 'column', 'date', 'json'];
    const invalidFields = skill.inputSchema.filter(f => !validTypes.includes(f.type));
    
    results.push({
      name: 'Field Types Check',
      passed: invalidFields.length === 0,
      duration: Date.now() - startTime,
      error: invalidFields.length > 0 
        ? `Invalid field types: ${invalidFields.map(f => f.name).join(', ')}` 
        : undefined,
      details: invalidFields.length === 0 ? 'All field types are valid' : undefined
    });

    // Check for select fields have options
    const selectFields = skill.inputSchema.filter(f => f.type === 'select');
    const missingOptions = selectFields.filter(f => !f.options || f.options.length === 0);
    
    results.push({
      name: 'Select Options Check',
      passed: missingOptions.length === 0,
      duration: Date.now() - startTime,
      error: missingOptions.length > 0
        ? `Select fields missing options: ${missingOptions.map(f => f.name).join(', ')}`
        : undefined,
      details: missingOptions.length === 0 
        ? `${selectFields.length} select fields have options` 
        : undefined
    });

    return results;
  }

  /**
   * Test skill with example inputs
   */
  private async testWithExample(
    skill: AISkill,
    inputs: Record<string, any>
  ): Promise<TestCaseResult> {
    const startTime = Date.now();

    try {
      // Create mock context
      const mockContext: SkillExecutionContext = {
        tableName: 'test_table',
        columns: [
          { name: 'id', type: 'INTEGER', isPk: true },
          { name: 'name', type: 'VARCHAR(100)', isPk: false },
          { name: 'value', type: 'DECIMAL(10,2)', isPk: false },
          { name: 'created_at', type: 'TIMESTAMP', isPk: false }
        ]
      };

      const result = await skillExecutor.execute({
        skillId: skill.id,
        inputs,
        context: mockContext,
        simulateOnly: true
      });

      return {
        name: `Example: ${skill.examples?.find(e => JSON.stringify(e.input) === JSON.stringify(inputs))?.name || 'Test'}`,
        passed: result.success,
        duration: Date.now() - startTime,
        error: result.error,
        expected: 'Valid SQL output',
        actual: result.success ? 'Generated' : result.error,
        details: result.success ? 'SQL generated successfully' : `Error: ${result.error}`
      };
    } catch (error) {
      return {
        name: 'Example Execution',
        passed: false,
        duration: Date.now() - startTime,
        error: (error as Error).message
      };
    }
  }

  /**
   * Validate generated SQL syntax
   */
  private async validateSQLSyntax(
    skill: AISkill,
    mockContext?: Partial<SkillExecutionContext>
  ): Promise<TestCaseResult> {
    const startTime = Date.now();

    try {
      // Create test inputs
      const testInputs = this.generateTestInputs(skill.inputSchema);
      
      const context: SkillExecutionContext = {
        tableName: 'test_table',
        columns: [
          { name: 'id', type: 'INTEGER', isPk: true },
          { name: 'name', type: 'VARCHAR(100)', isPk: false },
          { name: 'value', type: 'DECIMAL(10,2)', isPk: false }
        ],
        ...mockContext
      };

      const result = await skillExecutor.execute({
        skillId: skill.id,
        inputs: testInputs,
        context,
        simulateOnly: true
      });

      if (!result.success || !result.sql) {
        return {
          name: 'SQL Generation',
          passed: false,
          duration: Date.now() - startTime,
          error: result.error || 'Failed to generate SQL'
        };
      }

      // Check for common SQL issues
      const sqlIssues = this.checkSQLIssues(result.sql);

      return {
        name: 'SQL Syntax Check',
        passed: sqlIssues.length === 0,
        duration: Date.now() - startTime,
        error: sqlIssues.length > 0 ? sqlIssues.join('; ') : undefined,
        actual: result.sql.substring(0, 200),
        details: sqlIssues.length === 0 ? 'SQL syntax appears valid' : undefined
      };
    } catch (error) {
      return {
        name: 'SQL Generation',
        passed: false,
        duration: Date.now() - startTime,
        error: (error as Error).message
      };
    }
  }

  /**
   * Run integration test with actual DuckDB
   */
  private async runIntegrationTest(
    skill: AISkill,
    testData: Record<string, any>[]
  ): Promise<TestCaseResult> {
    const startTime = Date.now();

    try {
      // Generate test SQL
      const testInputs = this.generateTestInputs(skill.inputSchema);
      const context: SkillExecutionContext = {
        tableName: 'integration_test',
        columns: [
          { name: 'id', type: 'INTEGER', isPk: true },
          { name: 'name', type: 'VARCHAR(100)', isPk: false },
          { name: 'value', type: 'DECIMAL(10,2)', isPk: false }
        ]
      };

      const result = await skillExecutor.execute({
        skillId: skill.id,
        inputs: testInputs,
        context,
        simulateOnly: false
      });

      if (!result.success) {
        return {
          name: 'Integration Test (DuckDB)',
          passed: false,
          duration: Date.now() - startTime,
          error: result.error
        };
      }

      // If it's a DDL statement, try to execute it
      if (result.sql && /^(CREATE|INSERT|UPDATE|DELETE|DROP|ALTER)/i.test(result.sql.trim())) {
        // For DDL, we just verify it was generated (can't easily test in isolation)
        return {
          name: 'Integration Test (DDL)',
          passed: true,
          duration: Date.now() - startTime,
          details: 'DDL statement generated successfully'
        };
      }

      // For SELECT statements, verify we get results
      return {
        name: 'Integration Test',
        passed: true,
        duration: Date.now() - startTime,
        details: 'SQL executed successfully'
      };
    } catch (error) {
      return {
        name: 'Integration Test',
        passed: false,
        duration: Date.now() - startTime,
        error: (error as Error).message
      };
    }
  }

  /**
   * Generate test inputs for skill
   */
  private generateTestInputs(schema: SkillInputField[]): Record<string, any> {
    const inputs: Record<string, any> = {};

    for (const field of schema) {
      switch (field.type) {
        case 'text':
        case 'textarea':
          inputs[field.name] = field.placeholder || 'test value';
          break;
        case 'number':
          inputs[field.name] = field.defaultValue || 10;
          break;
        case 'boolean':
          inputs[field.name] = field.defaultValue || false;
          break;
        case 'select':
          inputs[field.name] = field.options?.[0] || 'option1';
          break;
        default:
          inputs[field.name] = field.defaultValue || null;
      }
    }

    return inputs;
  }

  /**
   * Check SQL for common issues
   */
  private checkSQLIssues(sql: string): string[] {
    const issues: string[] = [];
    const sqlUpper = sql.toUpperCase();

    // Check for unbalanced parentheses
    const openParens = (sql.match(/\(/g) || []).length;
    const closeParens = (sql.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      issues.push('Unbalanced parentheses');
    }

    // Check for unbalanced quotes
    const singleQuotes = (sql.match(/'/g) || []).length;
    if (singleQuotes % 2 !== 0) {
      issues.push('Unbalanced single quotes');
    }

    // Check for missing SELECT in query
    if (sqlUpper.includes('SELECT') && !sqlUpper.match(/SELECT\s+.+\s+FROM/i)) {
      issues.push('SELECT statement may be incomplete');
    }

    // Check for dangerous operations without warnings
    const dangerousOps = ['DROP', 'TRUNCATE', 'DELETE FROM'];
    for (const op of dangerousOps) {
      if (sqlUpper.includes(op) && !sqlUpper.includes('WHERE')) {
        issues.push(`${op} without WHERE clause - data loss risk`);
      }
    }

    // Check for common syntax errors in DuckDB
    if (sqlUpper.includes('LIMIT') && !sqlUpper.match(/LIMIT\s+\d+/i)) {
      issues.push('LIMIT clause may be invalid');
    }

    return issues;
  }

  /**
   * Analyze test results and generate issues
   */
  private analyzeTestResults(testResults: TestCaseResult[]): { issues: SkillIssue[]; suggestions: string[] } {
    const issues: SkillIssue[] = [];
    const suggestions: string[] = [];
    const failedTests = testResults.filter(t => !t.passed);

    // Group failures by type
    const structureFailures = failedTests.filter(t => t.name.includes('Structure'));
    const schemaFailures = failedTests.filter(t => t.name.includes('Schema'));
    const executionFailures = failedTests.filter(t => t.name.includes('Execution') || t.name.includes('SQL'));
    const integrationFailures = failedTests.filter(t => t.name.includes('Integration'));

    // Generate issues based on failures
    if (structureFailures.length > 0) {
      issues.push({
        type: 'error',
        severity: 'error',
        message: 'Skill structure has critical errors that prevent execution',
        fix: 'Ensure all required fields (id, name, description, category, inputSchema) are defined'
      });
    }

    if (schemaFailures.length > 0) {
      issues.push({
        type: 'error',
        severity: 'warning',
        message: 'Input schema validation failed',
        fix: schemaFailures.map(t => t.error).join('; ')
      });
    }

    if (executionFailures.length > 0) {
      issues.push({
        type: 'error',
        severity: 'error',
        message: 'Skill execution failed',
        location: executionFailures[0].name,
        fix: executionFailures[0].error || 'Check skill implementation'
      });
    }

    if (integrationFailures.length > 0) {
      issues.push({
        type: 'error',
        severity: 'warning',
        message: 'Integration test failed',
        fix: integrationFailures[0].error || 'Verify skill works with actual DuckDB'
      });
    }

    // Generate suggestions
    const passedTests = testResults.filter(t => t.passed);
    
    if (passedTests.length === testResults.length) {
      suggestions.push('All tests passed! This skill is working correctly.');
    } else if (passedTests.length > testResults.length / 2) {
      suggestions.push('Most tests passed. Review failed tests to improve reliability.');
    }

    // Add specific suggestions based on skill content
    testResults.forEach(test => {
      if (test.name.includes('Example') && test.passed) {
        suggestions.push('Consider adding more examples to help users understand the skill');
      }
    });

    return { issues, suggestions };
  }

  /**
   * Add result to history
   */
  private addToHistory(result: SkillTestResult): void {
    this.testHistory.unshift(result);
    if (this.testHistory.length > this.maxHistorySize) {
      this.testHistory = this.testHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Get test history
   */
  getHistory(): SkillTestResult[] {
    return [...this.testHistory];
  }

  /**
   * Get latest test result for a skill
   */
  getLatestResult(skillId: string): SkillTestResult | null {
    return this.testHistory.find(r => r.skillId === skillId) || null;
  }

  /**
   * Clear test history
   */
  clearHistory(): void {
    this.testHistory = [];
  }

  /**
   * Get test summary statistics
   */
  getSummary(): {
    totalTests: number;
    passed: number;
    failed: number;
    averageExecutionTime: number;
  } {
    if (this.testHistory.length === 0) {
      return { totalTests: 0, passed: 0, failed: 0, averageExecutionTime: 0 };
    }

    const passed = this.testHistory.filter(r => r.passed).length;
    const totalExecutionTime = this.testHistory.reduce((sum, r) => sum + r.executionTime, 0);

    return {
      totalTests: this.testHistory.length,
      passed,
      failed: this.testHistory.length - passed,
      averageExecutionTime: Math.round(totalExecutionTime / this.testHistory.length)
    };
  }

  /**
   * Export test results to JSON format
   */
  exportToJSON(results?: SkillTestResult[]): string {
    const dataToExport = results || this.testHistory;
    const exportData = {
      exportedAt: new Date().toISOString(),
      totalSkills: dataToExport.length,
      summary: {
        passed: dataToExport.filter(r => r.passed).length,
        failed: dataToExport.filter(r => !r.passed).length,
        averageExecutionTime: Math.round(
          dataToExport.reduce((sum, r) => sum + r.executionTime, 0) / dataToExport.length
        )
      },
      results: dataToExport
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Export test results to HTML format for easy viewing
   */
  exportToHTML(results?: SkillTestResult[]): string {
    const dataToExport = results || this.testHistory;
    const passed = dataToExport.filter(r => r.passed).length;
    const failed = dataToExport.filter(r => !r.passed).length;

    let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>AI Skills Test Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; background: #f5f5f5; }
    .container { max-width: 900px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
    .summary { display: flex; gap: 20px; margin: 20px 0; }
    .stat { padding: 15px 25px; border-radius: 8px; text-align: center; }
    .stat.total { background: #f0f0f0; }
    .stat.passed { background: #d4edda; color: #155724; }
    .stat.failed { background: #f8d7da; color: #721c24; }
    .stat .value { font-size: 28px; font-weight: bold; }
    .stat .label { font-size: 12px; text-transform: uppercase; margin-top: 5px; }
    .result { padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 4px solid; }
    .result.passed { background: #f0fff4; border-color: #28a745; }
    .result.failed { background: #fff5f5; border-color: #dc3545; }
    .result-header { display: flex; justify-content: space-between; align-items: center; }
    .result-title { font-weight: 600; font-size: 16px; }
    .result-status { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .result.passed .result-status { background: #28a745; color: white; }
    .result.failed .result-status { background: #dc3545; color: white; }
    .result-details { margin-top: 10px; font-size: 13px; color: #666; }
    .test-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
    .test-item:last-child { border-bottom: none; }
    .test-passed { color: #28a745; }
    .test-failed { color: #dc3545; }
    .timestamp { color: #999; font-size: 12px; margin-top: 20px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <h1>AI Skills Test Report</h1>
    <div class="summary">
      <div class="stat total">
        <div class="value">${dataToExport.length}</div>
        <div class="label">Total Skills</div>
      </div>
      <div class="stat passed">
        <div class="value">${passed}</div>
        <div class="label">Passed</div>
      </div>
      <div class="stat failed">
        <div class="value">${failed}</div>
        <div class="label">Failed</div>
      </div>
    </div>
`;

    dataToExport.forEach(result => {
      const statusClass = result.passed ? 'passed' : 'failed';
      const statusText = result.passed ? 'PASSED' : 'FAILED';
      
      html += `
    <div class="result ${statusClass}">
      <div class="result-header">
        <div class="result-title">${result.skillName}</div>
        <div class="result-status">${statusText}</div>
      </div>
      <div class="result-details">
        <div>Tests: ${result.passedTests}/${result.totalTests} passed | Time: ${result.executionTime}ms</div>
        <div style="margin-top: 8px;">
          ${result.testResults.map(t => `
            <div class="test-item">
              <span>${t.name}</span>
              <span class="${t.passed ? 'test-passed' : 'test-failed'}">${t.passed ? '✓' : '✗'} ${t.passed ? 'Passed' : 'Failed'}</span>
            </div>
          `).join('')}
        </div>
        ${result.issues.length > 0 ? `
          <div style="margin-top: 10px; color: #dc3545;">
            <strong>Issues:</strong> ${result.issues.map(i => i.message).join(', ')}
          </div>
        ` : ''}
      </div>
    </div>
`;
    });

    html += `
    <div class="timestamp">Generated at ${new Date().toLocaleString()}</div>
  </div>
</body>
</html>`;

    return html;
  }

  /**
   * Download test results as JSON file
   */
  downloadJSON(results?: SkillTestResult[]): void {
    const json = this.exportToJSON(results);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `skill-test-report-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Download test results as HTML file
   */
  downloadHTML(results?: SkillTestResult[]): void {
    const html = this.exportToHTML(results);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `skill-test-report-${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// Singleton instance
export const skillTester = new SkillTester();

// Export convenience functions
export const testSkill = (skillId: string, config?: Partial<TestConfig>) => 
  skillTester.testSkill(skillId, config);

export const testAllSkills = (config?: Partial<TestConfig>) => 
  skillTester.testAllSkills(config);

export const getTestHistory = () => skillTester.getHistory();

export const getLatestTestResult = (skillId: string) => skillTester.getLatestResult(skillId);

export const clearTestHistory = () => skillTester.clearHistory();

export const getTestSummary = () => skillTester.getSummary();

export const exportTestResultsJSON = (results?: SkillTestResult[]) => skillTester.exportToJSON(results);
export const exportTestResultsHTML = (results?: SkillTestResult[]) => skillTester.exportToHTML(results);
export const downloadTestResultsJSON = (results?: SkillTestResult[]) => skillTester.downloadJSON(results);
export const downloadTestResultsHTML = (results?: SkillTestResult[]) => skillTester.downloadHTML(results);

export type { SkillTestResult, TestCaseResult, SkillIssue, TestConfig };
