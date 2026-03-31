/**
 * AI Skill Router
 * 
 * Handles intent analysis, skill matching, and skill chain orchestration.
 * This module provides automatic skill discovery and execution based on
 * natural language user requests.
 */

import {
  AISkill,
  SkillExecutionContext,
  SkillResult,
  IntentAnalysis,
  SkillChain,
  SkillChainStep,
  SqlOperationType
} from '../types';
import { getAllSkills, getSkill, skillRegistry } from './skillRegistry';
import { aiService } from './aiService';

/**
 * Intent keywords mapping to SQL operation types
 */
const INTENT_KEYWORDS_MAP: Record<SqlOperationType, string[]> = {
  select: [
    '查询', '查找', '获取', '看看', '显示', '展示', '获取',
    'query', 'find', 'get', 'show', 'select', 'read', 'list'
  ],
  insert: [
    '添加', '插入', '新建', '创建', '新增',
    'add', 'insert', 'create', 'new', 'append'
  ],
  update: [
    '修改', '更新', '改变', '调整',
    'update', 'modify', 'change', 'edit', 'alter'
  ],
  delete: [
    '删除', '移除', '清除', '去掉',
    'delete', 'remove', 'drop', 'clear'
  ],
  aggregation: [
    '统计', '合计', '求和', '平均', '计数', '最大值', '最小值', '汇总',
    'group', 'sum', 'count', 'avg', 'max', 'min', 'total', 'aggregate'
  ],
  join: [
    '关联', '连接', '合并', 'join', 'link', 'combine', 'merge'
  ],
  window: [
    '排名', '排序', '累计', '移动平均', '滞后', '领先', '窗口',
    'rank', 'row_number', 'lag', 'lead', 'cumulative', 'moving', 'window'
  ],
  transformation: [
    '转换', '变换', '透视', '逆透视', 'pivot', 'unpivot', 'transform'
  ],
  analysis: [
    '分析', '趋势', '留存', '漏斗', '转化', '对比', '占比', '占比',
    'analyze', 'trend', 'retention', 'funnel', 'conversion', 'compare', 'ratio'
  ],
  optimization: [
    '优化', '性能', '慢查询', '索引', 'explain', 'optimize', 'performance', 'index'
  ],
  utility: [
    '生成', '测试', '示例', '模拟', '摘要', 'generate', 'test', 'sample', 'mock'
  ]
};

/**
 * Complex intent patterns that require multiple skills
 */
const COMPLEX_PATTERNS = [
  { pattern: /留存/i, skills: ['sql-time-series', 'sql-retention-analysis'] },
  { pattern: /漏斗/i, skills: ['sql-funnel-analysis'] },
  { pattern: /(同比增长|环比|增长率)/i, skills: ['sql-time-series', 'sql-growth-analysis'] },
  { pattern: /(占比|占比|百分比)/i, skills: ['sql-aggregation', 'sql-ratio-analysis'] },
];

/**
 * Skill Router class
 */
class SkillRouter {
  private executionHistory: IntentAnalysis[] = [];
  private maxHistorySize = 20;

  /**
   * Analyze user intent from natural language request
   */
  async analyzeIntent(
    userRequest: string,
    context: SkillExecutionContext
  ): Promise<IntentAnalysis> {
    // First try keyword-based matching
    const keywordResult = this.matchByKeywords(userRequest);

    // If high confidence from keywords, return immediately
    if (keywordResult.confidence >= 0.8) {
      return keywordResult;
    }

    // Otherwise, use AI to enhance intent analysis
    try {
      const aiResult = await this.aiAnalyzeIntent(userRequest, context);

      // Combine results, prefer AI result if higher confidence
      if (aiResult.confidence > keywordResult.confidence) {
        this.addToHistory(aiResult);
        return aiResult;
      }

      // Use keyword result but add AI reasoning
      keywordResult.reasoning = aiResult.reasoning;
      this.addToHistory(keywordResult);
      return keywordResult;
    } catch (error) {
      // Fall back to keyword matching on AI failure
      console.warn('AI intent analysis failed, using keyword matching:', error);
      this.addToHistory(keywordResult);
      return keywordResult;
    }
  }

  /**
   * Match skills by keywords in user request
   */
  private matchByKeywords(userRequest: string): IntentAnalysis {
    const lowerRequest = userRequest.toLowerCase();

    // Find matching operation types
    const matchedOperations: { type: SqlOperationType; score: number }[] = [];

    for (const [operation, keywords] of Object.entries(INTENT_KEYWORDS_MAP)) {
      let score = 0;
      for (const keyword of keywords) {
        if (lowerRequest.includes(keyword.toLowerCase())) {
          score += 1;
        }
      }
      if (score > 0) {
        matchedOperations.push({ type: operation as SqlOperationType, score });
      }
    }

    // Sort by score descending
    matchedOperations.sort((a, b) => b.score - a.score);

    // Determine primary intent
    const primaryIntent = matchedOperations[0]?.type || 'select';
    const confidence = matchedOperations.length > 0
      ? Math.min(0.5 + (matchedOperations[0].score * 0.1), 0.95)
      : 0.3;

    // Find matching skills
    const allSkills = getAllSkills();
    const requiredSkills = allSkills
      .filter(skill => skill.sqlOperationType === primaryIntent ||
        (skill.intentKeywords?.some(kw => lowerRequest.includes(kw.toLowerCase()))))
      .slice(0, 3)
      .map(s => s.id);

    // Check for complex patterns
    let skillChain: SkillChain | undefined;
    for (const { pattern, skills } of COMPLEX_PATTERNS) {
      if (pattern.test(userRequest)) {
        skillChain = this.buildSkillChain(skills, {} as SkillExecutionContext);
        break;
      }
    }

    return {
      intent: primaryIntent,
      confidence,
      requiredSkills: requiredSkills.length > 0 ? requiredSkills : [this.getDefaultSkillId(primaryIntent)],
      skillChain,
      userRequest,
      reasoning: `关键词匹配: 识别到 "${matchedOperations[0]?.type || 'unknown'}" 操作类型`
    };
  }

  /**
   * Use AI to analyze user intent
   */
  private async aiAnalyzeIntent(
    userRequest: string,
    context: SkillExecutionContext
  ): Promise<IntentAnalysis> {
    // Build schema context
    let schemaContext = '';
    if (context.tableName) {
      schemaContext = `当前表: ${context.tableName}\n`;
      if (context.columns && context.columns.length > 0) {
        schemaContext += `可用列: ${context.columns.map(c => c.name).join(', ')}\n`;
      }
    }

    // Build prompt
    const prompt = `你是一个 SQL 需求分析专家。根据用户的自然语言需求，分析并返回结构化的意图分析结果。

用户需求: ${userRequest}

${schemaContext}

请分析用户想要执行的 SQL 操作类型，并从以下选项中选择:
- select: 查询数据
- insert: 插入新数据
- update: 更新数据
- delete: 删除数据
- aggregation: 聚合统计（如求和、计数、平均、分组等）
- join: 多表关联查询
- window: 窗口函数（如排名、累计等）
- transformation: 数据转换（如透视、逆透视）
- analysis: 数据分析（如趋势、留存、漏斗）
- optimization: SQL 优化
- utility: 工具类（如生成测试数据）

请以 JSON 格式返回分析结果，格式如下:
{
  "intent": "操作类型",
  "confidence": 0.0-1.0 置信度,
  "requiredSkills": ["技能ID1", "技能ID2"],
  "reasoning": "简短的分析理由",
  "missingInfo": ["需要补充的信息"] // 可选
}`;

    try {
      const response = await aiService.generateSql(prompt, '');

      // Parse AI response
      const parsed = this.parseAIResponse(response);

      return {
        intent: parsed.intent || 'select',
        confidence: Math.min(parsed.confidence || 0.6, 0.95),
        requiredSkills: parsed.requiredSkills || [this.getDefaultSkillId(parsed.intent || 'select')],
        userRequest,
        reasoning: parsed.reasoning || 'AI 智能分析',
        missingInfo: parsed.missingInfo
      };
    } catch (error) {
      console.error('AI intent analysis error:', error);
      throw error;
    }
  }

  /**
   * Parse AI response to extract intent analysis
   */
  private parseAIResponse(response: string): any {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback parsing
      const result: any = { intent: 'select', confidence: 0.5, requiredSkills: [] };

      // Extract intent
      const intentMatch = response.match(/"intent"\s*:\s*"(\w+)"/);
      if (intentMatch) {
        result.intent = intentMatch[1];
      }

      // Extract confidence
      const confidenceMatch = response.match(/"confidence"\s*:\s*([\d.]+)/);
      if (confidenceMatch) {
        result.confidence = parseFloat(confidenceMatch[1]);
      }

      return result;
    } catch (error) {
      console.warn('Failed to parse AI response:', error);
      return { intent: 'select', confidence: 0.5, requiredSkills: [] };
    }
  }

  /**
   * Build skill chain for complex requirements
   */
  private buildSkillChain(skillIds: string[], context: SkillExecutionContext): SkillChain {
    const steps: SkillChainStep[] = skillIds.map((skillId, index) => ({
      stepId: `step_${index}`,
      skillId,
      inputs: {},
      dependsOn: index > 0 ? [`step_${index - 1}`] : [],
      expectedOutput: 'SQL query'
    }));

    return { steps };
  }

  /**
   * Get default skill ID for an operation type
   */
  private getDefaultSkillId(operation: SqlOperationType): string {
    const defaultSkills: Record<SqlOperationType, string> = {
      select: 'sql-select-generator',
      insert: 'sql-insert-generator',
      update: 'sql-update-generator',
      delete: 'sql-delete-generator',
      aggregation: 'sql-aggregation-generator',
      join: 'sql-join-generator',
      window: 'sql-window-function',
      transformation: 'transform-pivot',
      analysis: 'analysis-time-series',
      optimization: 'optimization-explain',
      utility: 'utility-test-data'
    };

    return defaultSkills[operation] || 'sql-select-generator';
  }

  /**
   * Suggest skills based on user request (hybrid mode)
   */
  async suggestSkills(
    userRequest: string,
    context: SkillExecutionContext,
    maxSuggestions: number = 5
  ): Promise<AISkill[]> {
    const analysis = await this.analyzeIntent(userRequest, context);

    // Get all skills and filter by recommended IDs
    const allSkills = getAllSkills();
    const suggested = analysis.requiredSkills
      .map(id => allSkills.find(s => s.id === id))
      .filter((s): s is AISkill => s !== undefined);

    // If not enough suggestions, add similar skills
    if (suggested.length < maxSuggestions) {
      const category = this.intentToCategory(analysis.intent);
      const categorySkills = allSkills
        .filter(s => s.category === category && !suggested.includes(s))
        .slice(0, maxSuggestions - suggested.length);

      return [...suggested, ...categorySkills];
    }

    return suggested.slice(0, maxSuggestions);
  }

  /**
   * Execute skill from intent (auto mode)
   */
  async executeFromIntent(
    userRequest: string,
    context: SkillExecutionContext,
    simulateOnly: boolean = false
  ): Promise<SkillResult> {
    const analysis = await this.analyzeIntent(userRequest, context);

    // If skill chain exists, execute the chain
    if (analysis.skillChain && analysis.skillChain.steps.length > 0) {
      return this.executeSkillChain(analysis.skillChain, context, simulateOnly);
    }

    // Otherwise, execute single skill
    const skillId = analysis.requiredSkills[0];
    if (!skillId) {
      return {
        success: false,
        error: '无法识别用户意图，没有找到匹配的技能'
      };
    }

    // Import skillExecutor dynamically to avoid circular dependency
    const { skillExecutor } = await import('./skillExecutor');

    // Build inputs from user request and context
    const inputs = this.buildInputsFromRequest(userRequest, context, skillId);

    return skillExecutor.execute({
      skillId,
      inputs,
      context,
      simulateOnly
    });
  }

  /**
   * Execute skill chain
   */
  private async executeSkillChain(
    chain: SkillChain,
    context: SkillExecutionContext,
    simulateOnly: boolean
  ): Promise<SkillResult> {
    const { skillExecutor } = await import('./skillExecutor');

    let finalSql = '';
    let explanations: string[] = [];
    let currentContext = { ...context };

    for (const step of chain.steps) {
      const skill = getSkill(step.skillId);
      if (!skill) {
        return {
          success: false,
          error: `技能未找到: ${step.skillId}`
        };
      }

      // Update context with previous step results
      if (finalSql) {
        currentContext = {
          ...currentContext,
          currentSql: finalSql
        };
      }

      // Build inputs
      const inputs = this.buildInputsFromRequest(
        `Step: ${skill.name}`,
        currentContext,
        step.skillId
      );

      const result = await skillExecutor.execute({
        skillId: step.skillId,
        inputs,
        context: currentContext,
        simulateOnly
      });

      if (!result.success) {
        return result;
      }

      if (result.sql) {
        finalSql += (finalSql ? '\n\n' : '') + result.sql;
      }

      if (result.explanation) {
        explanations.push(result.explanation);
      }
    }

    return {
      success: true,
      sql: finalSql,
      explanation: explanations.join('\n\n'),
      metadata: {
        chainExecution: true,
        steps: chain.steps.length
      }
    };
  }

  /**
   * Build inputs for skill from user request
   */
  private buildInputsFromRequest(
    userRequest: string,
    context: SkillExecutionContext,
    skillId: string
  ): Record<string, any> {
    const skill = getSkill(skillId);
    if (!skill) {
      return { description: userRequest };
    }

    const lowerRequest = userRequest.toLowerCase();
    const inputs: Record<string, any> = {};

    for (const field of skill.inputSchema) {
      switch (field.name) {
        case 'description':
        case 'userRequest':
          inputs[field.name] = userRequest;
          break;

        case 'tableName':
          inputs[field.name] = context.tableName || field.defaultValue;
          break;

        case 'conditions':
        case 'whereClause': {
          const conditionMatch = userRequest.match(/(?:条件?|where|过滤|筛选)(.+?)(?:，|,|。|$)/i);
          if (conditionMatch) {
            inputs[field.name] = conditionMatch[1].trim();
          }
          break;
        }

        case 'limit': {
          const limitMatch = userRequest.match(/(?:前|top|limit|最多)\s*(\d+)/i);
          inputs[field.name] = limitMatch ? parseInt(limitMatch[1], 10) : (field.defaultValue || 100);
          break;
        }

        case 'orderBy':
        case 'sortBy': {
          // Detect sort direction keywords
          const descKeywords = ['降序', '倒序', '从大到小', '从高到低', 'desc', 'descending'];
          const ascKeywords = ['升序', '正序', '从小到大', '从低到高', 'asc', 'ascending'];
          const isDesc = descKeywords.some(k => lowerRequest.includes(k));
          const isAsc = ascKeywords.some(k => lowerRequest.includes(k));

          // Try to find column name mentioned near sort keywords
          const sortColMatch = userRequest.match(/(?:按|排序|order\s*by|sort)\s*(\S+)/i);
          if (sortColMatch) {
            const matchedCol = this.matchColumnName(sortColMatch[1], context);
            inputs[field.name] = matchedCol || sortColMatch[1];
          }
          if (isDesc) inputs['sortDirection'] = 'DESC';
          else if (isAsc) inputs['sortDirection'] = 'ASC';
          break;
        }

        case 'groupBy':
        case 'groupByColumns': {
          // Detect group-by dimensions
          const groupMatch = userRequest.match(/(?:按|分组|group\s*by)\s*(\S+)/i);
          if (groupMatch) {
            const matchedCol = this.matchColumnName(groupMatch[1], context);
            inputs[field.name] = matchedCol || groupMatch[1];
          }
          break;
        }

        case 'aggregationType':
        case 'aggregation': {
          // Detect aggregation type
          const aggMap: [RegExp, string][] = [
            [/求和|总[和计额]|sum/i, 'SUM'],
            [/平均|均值|avg|average/i, 'AVG'],
            [/计数|数量|count/i, 'COUNT'],
            [/最大|最高|max/i, 'MAX'],
            [/最小|最低|min/i, 'MIN'],
          ];
          for (const [pattern, aggType] of aggMap) {
            if (pattern.test(userRequest)) {
              inputs[field.name] = aggType;
              break;
            }
          }
          if (!inputs[field.name]) inputs[field.name] = field.defaultValue;
          break;
        }

        case 'dateRange':
        case 'timeRange': {
          // Detect time range expressions
          const timeRanges: [RegExp, string][] = [
            [/最近\s*(\d+)\s*天/i, 'INTERVAL \'$1\' DAY'],
            [/最近\s*(\d+)\s*[个]?月/i, 'INTERVAL \'$1\' MONTH'],
            [/最近\s*(\d+)\s*[个]?周/i, 'INTERVAL \'$1\' WEEK'],
            [/今天|今日/i, 'CURRENT_DATE'],
            [/本月|这个月/i, 'DATE_TRUNC(\'month\', CURRENT_DATE)'],
            [/本周|这周/i, 'DATE_TRUNC(\'week\', CURRENT_DATE)'],
            [/last\s*(\d+)\s*days/i, 'INTERVAL \'$1\' DAY'],
          ];
          for (const [pattern, value] of timeRanges) {
            const match = userRequest.match(pattern);
            if (match) {
              inputs[field.name] = value.replace('$1', match[1] || '');
              break;
            }
          }
          break;
        }

        case 'selectColumns':
        case 'columns': {
          // Try to extract column names from request by matching against context
          if (context.columns && context.columns.length > 0) {
            const mentioned = context.columns
              .filter(c => lowerRequest.includes(c.name.toLowerCase()))
              .map(c => c.name);
            if (mentioned.length > 0) {
              inputs[field.name] = mentioned.join(', ');
            }
          }
          break;
        }

        default:
          inputs[field.name] = field.defaultValue;
      }
    }

    return inputs;
  }

  /**
   * Match a user-mentioned name to an actual column in the context
   */
  private matchColumnName(mention: string, context: SkillExecutionContext): string | null {
    if (!context.columns || context.columns.length === 0) return null;
    const lower = mention.toLowerCase().replace(/[，,。、]/g, '');

    // Exact match
    const exact = context.columns.find(c => c.name.toLowerCase() === lower);
    if (exact) return exact.name;

    // Partial match
    const partial = context.columns.find(c =>
      c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase())
    );
    return partial?.name || null;
  }

  /**
   * Match skills by SQL operation type
   */
  matchSkillsByOperation(operation: SqlOperationType): AISkill[] {
    return getAllSkills().filter(skill => skill.sqlOperationType === operation);
  }

  /**
   * Find compatible skills for a given skill
   */
  findCompatibleSkills(skillId: string): AISkill[] {
    const skill = getSkill(skillId);
    if (!skill) {
      return [];
    }

    // Return explicitly defined compatible skills
    if (skill.compatibleWith) {
      return skill.compatibleWith
        .map(id => getSkill(id))
        .filter((s): s is AISkill => s !== undefined);
    }

    // Find skills with compatible operation types
    const compatibleTypes = this.getCompatibleOperationTypes(skill.sqlOperationType || 'select');
    return getAllSkills().filter(s =>
      s.id !== skillId &&
      compatibleTypes.includes(s.sqlOperationType || 'select')
    );
  }

  /**
   * Get compatible operation types for a given operation
   */
  private getCompatibleOperationTypes(operation: SqlOperationType): SqlOperationType[] {
    const compatibilityMap: Record<SqlOperationType, SqlOperationType[]> = {
      select: ['aggregation', 'join', 'window', 'transformation'],
      insert: [],
      update: [],
      delete: [],
      aggregation: ['select', 'window'],
      join: ['select', 'aggregation'],
      window: ['select', 'aggregation'],
      transformation: ['select'],
      analysis: ['aggregation', 'window', 'transformation'],
      optimization: ['select'],
      utility: ['select', 'insert']
    };

    return compatibilityMap[operation] || [];
  }

  /**
   * Convert SQL operation type to skill category
   */
  private intentToCategory(operation: SqlOperationType): string {
    const mapping: Record<SqlOperationType, string> = {
      select: 'sql',
      insert: 'sql',
      update: 'sql',
      delete: 'sql',
      aggregation: 'sql',
      join: 'sql',
      window: 'sql',
      transformation: 'transformation',
      analysis: 'analysis',
      optimization: 'optimization',
      utility: 'utility'
    };

    return mapping[operation] || 'sql';
  }

  /**
   * Add analysis to history
   */
  private addToHistory(analysis: IntentAnalysis): void {
    this.executionHistory.push(analysis);
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory.shift();
    }
  }

  /**
   * Get execution history
   */
  getHistory(): IntentAnalysis[] {
    return [...this.executionHistory];
  }

  /**
   * Clear execution history
   */
  clearHistory(): void {
    this.executionHistory = [];
  }
}

// Singleton instance
export const skillRouter = new SkillRouter();

// Export convenience functions
export const analyzeIntent = (userRequest: string, context: SkillExecutionContext) =>
  skillRouter.analyzeIntent(userRequest, context);

export const suggestSkills = (userRequest: string, context: SkillExecutionContext, maxSuggestions?: number) =>
  skillRouter.suggestSkills(userRequest, context, maxSuggestions);

export const executeFromIntent = (userRequest: string, context: SkillExecutionContext, simulateOnly?: boolean) =>
  skillRouter.executeFromIntent(userRequest, context, simulateOnly);

export const matchSkillsByOperation = (operation: SqlOperationType) =>
  skillRouter.matchSkillsByOperation(operation);

export const findCompatibleSkills = (skillId: string) =>
  skillRouter.findCompatibleSkills(skillId);
