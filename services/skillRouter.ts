/**
 * AI Skill Router
 * 
 * Handles orchestration of intent analysis, skill matching, and execution.
 * Simplified into a Facade that delegates to specialized services.
 */

import {
  AISkill,
  SkillExecutionContext,
  SkillResult,
  IntentAnalysis,
  SkillChain,
  SkillChainStep,
  ColumnInfo,
  SkillCategory,
} from '../types';
import { getAllSkills, skillRegistry } from './skillRegistry';
import { intentAnalyzer } from './skill/intentAnalyzer';
import { parameterExtractor } from './skill/parameterExtractor';
import { getSkillStats, getSkillHistory } from './skill/skillHistoryStorage';
import { skillExecutor } from './skillExecutor';

/** Type guard for ColumnInfo arrays */
function isColumnInfoArray(val: unknown): val is ColumnInfo[] {
  return Array.isArray(val) && val.every(v =>
    typeof v === 'object' && v !== null && 'name' in v && 'type' in v
  );
}

/** Factory function for building SkillExecutionContext with type safety */
export function buildContext(
  table?: string,
  columns?: unknown,
  userIntent?: string,
  currentSql?: string
): SkillExecutionContext {
  return {
    tableName: table,
    columns: isColumnInfoArray(columns) ? columns : undefined,
    userIntent: userIntent ?? '',
    currentSql,
  };
}

/** Get context-aware skill scores based on recent usage */
function getContextBoost(skillId: string): number {
  const stats = getSkillStats();
  const stat = stats[skillId];
  if (!stat) return 0;
  
  // More recent = higher boost, capped at 7 days
  const daysSinceUse = (Date.now() - stat.lastExecuted) / (1000 * 60 * 60 * 24);
  if (daysSinceUse > 7) return 0;
  
  // Exponential decay: recent skills get boost
  return Math.max(0, (7 - daysSinceUse) / 7) * 0.3;
}

class SkillRouter {
  private executionHistory: IntentAnalysis[] = [];
  private maxHistorySize = 20;
  // Session memory: recent skill IDs used in this session
  private sessionRecentSkills: string[] = [];
  private maxSessionRecent = 5;

  /**
   * Analyze user intent (Delegated to IntentAnalyzer)
   */
  async analyzeIntent(userRequest: string, context: SkillExecutionContext): Promise<IntentAnalysis> {
    const analysis = await intentAnalyzer.analyze(userRequest, context);
    
    // Fill required skills if not present
    if (analysis.requiredSkills.length === 0) {
      analysis.requiredSkills = this.suggestSkillIds(analysis, context);
    }

    // Check for complex chain
    const complexSkills = intentAnalyzer.getComplexSkills(userRequest);
    if (complexSkills) {
      analysis.skillChain = this.buildSkillChain(complexSkills, context);
    }

    this.addToHistory(analysis);
    return analysis;
  }

  /**
   * Suggest skill IDs based on intent analysis
   */
  private suggestSkillIds(analysis: IntentAnalysis, context: SkillExecutionContext): string[] {
    // 1. Check advanced triggers from registry
    const triggered = skillRegistry.matchAdvancedTriggers(analysis.userRequest);
    if (triggered.length > 0) return triggered.map(s => s.id);

    // 2. Match by operation type
    const byOp = skillRegistry.matchSkillsByOperation(analysis.intent);
    if (byOp.length > 0) return byOp.slice(0, 3).map(s => s.id);

    // 3. Fallback to default
    return [this.getDefaultSkillId(analysis.intent)];
  }

  private getDefaultSkillId(operation: string): string {
    // Attempt to find any skill matching the operation declaratively
    const matches = skillRegistry.matchSkillsByOperation(operation);
    if (matches.length > 0) {
      return matches[0].id;
    }
    
    // Fallback: get any core/basic SQL skill
    const sqlSkills = skillRegistry.getByCategory('modeling');
    if (sqlSkills.length > 0) {
      return sqlSkills[0].id;
    }
    
    return 'sql-select-generator';
  }

  /**
   * Suggest skills (Context-aware hybrid mode)
   */
  async suggestSkills(userRequest: string, context: SkillExecutionContext, maxSuggestions: number = 5): Promise<AISkill[]> {
    const analysis = await this.analyzeIntent(userRequest, context);
    
    // Get base suggested skills
    let suggested = analysis.requiredSkills
      .map(id => skillRegistry.get(id))
      .filter((s): s is AISkill => s !== undefined);

    // Boost suggestions with context awareness
    suggested = this.contextAwareSort(suggested, context);

    // Fill with category skills if needed
    if (suggested.length < maxSuggestions) {
      const category = this.intentToCategory(analysis.intent);
      const categorySkills = skillRegistry.getByCategory(category)
        .filter(s => !suggested.includes(s));

      // Apply context boost to category skills too
      const boostedCategory = this.contextAwareSort(categorySkills, context);

      const needed = maxSuggestions - suggested.length;
      suggested = [...suggested, ...boostedCategory.slice(0, needed)];
    }

    // Filter by context requirements (table/columns)
    suggested = this.filterByContext(suggested, context);

    // Track in session memory
    suggested.forEach(s => this.addToSessionMemory(s.id));

    return suggested.slice(0, maxSuggestions);
  }

  /**
   * Sort skills by context relevance (recent usage, session memory)
   */
  private contextAwareSort(skills: AISkill[], context: SkillExecutionContext): AISkill[] {
    return [...skills].sort((a, b) => {
      let scoreA = getContextBoost(a.id);
      let scoreB = getContextBoost(b.id);

      // Session memory bonus
      if (this.sessionRecentSkills.includes(a.id)) {
        scoreA += 0.2;
      }
      if (this.sessionRecentSkills.includes(b.id)) {
        scoreB += 0.2;
      }

      // Table context: skills that require table get boost if table is available
      if (context.tableName && a.requiresTable) scoreA += 0.1;
      if (context.tableName && b.requiresTable) scoreB += 0.1;

      // Column context: skills that require columns get boost if columns are available
      if (context.columns && context.columns.length > 0) {
        if (a.requiresColumns) scoreA += 0.1;
        if (b.requiresColumns) scoreB += 0.1;
      }

      return scoreB - scoreA;
    });
  }

  /**
   * Filter skills by context requirements
   */
  private filterByContext(skills: AISkill[], context: SkillExecutionContext): AISkill[] {
    return skills.filter(skill => {
      // If skill requires a table but none is provided, still show but mark as unavailable
      // (The UI will handle the disabled state)
      return true;
    });
  }

  /**
   * Track skill usage in session memory
   */
  private addToSessionMemory(skillId: string): void {
    this.sessionRecentSkills = [
      skillId,
      ...this.sessionRecentSkills.filter(id => id !== skillId)
    ].slice(0, this.maxSessionRecent);
  }

  /**
   * Execute skill from intent (Auto mode)
   */
  async executeFromIntent(userRequest: string, context: SkillExecutionContext, simulateOnly: boolean = false): Promise<SkillResult> {
    const analysis = await this.analyzeIntent(userRequest, context);

    if (analysis.skillChain && analysis.skillChain.steps.length > 0) {
      return this.executeSkillChain(analysis.skillChain, context, simulateOnly);
    }

    const skillId = analysis.requiredSkills[0];
    if (!skillId) {
      return { success: false, error: '无法识别用户意图，没有找到匹配的技能' };
    }

    // Track execution in session
    this.addToSessionMemory(skillId);
    const inputs = await parameterExtractor.extract(userRequest, skillId, context);

    // Thread streaming callback from context if present
    const onChunk = (context as any)._onChunk;
    const cancelToken = (context as any).cancelToken;
    const invokeRequest: any = {
      skillId,
      inputs,
      context: { ...context, matchedOfficialSkills: analysis.matchedOfficialSkills },
      simulateOnly
    };
    if (onChunk) {
      invokeRequest.onChunk = onChunk;
    }
    if (cancelToken) {
      invokeRequest.cancelToken = cancelToken;
    }

    return skillExecutor.execute(invokeRequest);
  }

  /**
   * Execute skill chain
   */
  private async executeSkillChain(chain: SkillChain, context: SkillExecutionContext, simulateOnly: boolean): Promise<SkillResult> {
    let finalSql = '';
    let explanations: string[] = [];
    let currentContext = { ...context };

    for (const step of chain.steps) {
      this.addToSessionMemory(step.skillId);
      const inputs = await parameterExtractor.extract(context.userIntent || '', step.skillId, currentContext);
      
      const result = await skillExecutor.execute({
        skillId: step.skillId,
        inputs,
        context: { ...currentContext, currentSql: finalSql },
        simulateOnly
      });

      if (!result.success) return result;
      if (result.sql) finalSql += (finalSql ? '\n\n' : '') + result.sql;
      if (result.explanation) explanations.push(result.explanation);
      
      currentContext = { ...currentContext, currentSql: finalSql };
    }

    return {
      success: true,
      sql: finalSql,
      explanation: explanations.join('\n\n'),
      metadata: { chainExecution: true, steps: chain.steps.length }
    };
  }

  private buildSkillChain(skillIds: string[], context: SkillExecutionContext): SkillChain {
    return {
      steps: skillIds.map((id, i) => ({
        stepId: `step_${i}`,
        skillId: id,
        inputs: {},
        dependsOn: i > 0 ? [`step_${i-1}`] : []
      }))
    };
  }

  private intentToCategory(operation: string): SkillCategory {
    const mapping: Record<string, SkillCategory> = {
      select: 'modeling',
      insert: 'modeling',
      update: 'modeling',
      delete: 'modeling',
      aggregation: 'modeling',
      join: 'modeling',
      window: 'modeling',
      transformation: 'wrangling',
      analysis: 'insights',
      optimization: 'optimization',
      utility: 'engineering'
    };
    return mapping[operation] || 'modeling';
  }

  private addToHistory(analysis: IntentAnalysis): void {
    this.executionHistory.unshift(analysis);
    if (this.executionHistory.length > this.maxHistorySize) this.executionHistory.pop();
  }

  getHistory() { return [...this.executionHistory]; }
  clearHistory() { this.executionHistory = []; }

  /**
   * Clear session memory (call when switching contexts or tables)
   */
  clearSessionMemory(): void {
    this.sessionRecentSkills = [];
  }
}

export const skillRouter = new SkillRouter();
export const analyzeIntent = (userRequest: string, context: SkillExecutionContext) => skillRouter.analyzeIntent(userRequest, context);
export const suggestSkills = (userRequest: string, context: SkillExecutionContext, maxSuggestions?: number) => skillRouter.suggestSkills(userRequest, context, maxSuggestions);
export const executeFromIntent = (userRequest: string, context: SkillExecutionContext, simulateOnly?: boolean) => skillRouter.executeFromIntent(userRequest, context, simulateOnly);

/**
 * Find skills compatible with a given skill (same category or shared input/output types).
 * Exported for use by DuckDBSkillsGuide.
 */
export function findCompatibleSkills(skillId: string, maxResults = 5): AISkill[] {
  const skill = skillRegistry.get(skillId);
  if (!skill) return [];

  const sameCategory = skillRegistry.getByCategory(skill.category)
    .filter(s => s.id !== skillId);

  return [...sameCategory].slice(0, maxResults);
}
