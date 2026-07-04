/**
 * AI Skill Executor
 *
 * Handles skill execution by coordinating template-based SQL generation,
 * AI-powered generation, and result processing.
 *
 * Generator resolution order:
 *   1. skill.execute (direct function on skill definition)
 *   2. skill.generatorId (declarative registry lookup)
 *   3. AI fallback (with Handbook context injection)
 */

import { AISkill, SkillExecutionContext, SkillResult, SkillInvokeRequest } from '../types';
import { getSkill } from './skillRegistry';
import { aiService } from './aiService';
import { OFFICIAL_HANDBOOK_SKILLS } from './skills/definitions/official-skills';
import { ensureInitialized, getGenerator } from './skills/generators';
import {
  addToSkillHistory as persistHistory,
  getSkillHistory as getPersistedHistory,
  clearSkillHistory as clearPersistedHistory,
} from './skill/skillHistoryStorage';

// ============================================================
// Cancel Token for interrupting long-running operations
// ============================================================

export interface CancelToken {
  cancelled: boolean;
}

export function createCancelToken(): CancelToken {
  return { cancelled: false };
}

export function isCancelled(token: CancelToken): boolean {
  return token.cancelled;
}

// ============================================================
// Schema context builder
// ============================================================

function buildSchemaContext(context: SkillExecutionContext): string {
  const parts: string[] = [];
  if (context.tableName) parts.push(`表名: ${context.tableName}`);
  if (context.columns && context.columns.length > 0) {
    parts.push(`列信息:\n${context.columns.map(c => `  - ${c.name} (${c.type}${c.pk ? ', 主键' : ''})`).join('\n')}`);
  }
  if (context.schema) parts.push(`Schema: ${context.schema}`);
  return parts.join('\n\n');
}

// ============================================================
// Generator resolution
// ============================================================

async function resolveGenerator(skill: AISkill) {
  // 1. Direct execute function on the skill itself
  if (skill.execute) {
    return async (inputs: Record<string, any>, ctx: SkillExecutionContext) => {
      const result = await skill.execute!(inputs, ctx);
      return result.sql ?? '';
    };
  }

  // 2. Declarative generatorId registry lookup
  if (skill.generatorId) {
    await ensureInitialized();
    const fn = getGenerator(skill.generatorId);
    if (fn) return fn;
  }

  return null;
}

// ============================================================
// AI-powered generation fallback (with cancellation support)
// ============================================================

async function generateWithAI(
  skill: AISkill,
  inputs: Record<string, any>,
  context: SkillExecutionContext,
  onChunk?: (text: string) => void,
  cancelToken?: CancelToken
): Promise<SkillResult> {
  const startTime = Date.now();

  try {
    // Check cancellation before starting
    if (cancelToken?.cancelled) {
      return {
        success: false,
        error: 'Execution cancelled',
        executionTime: Date.now() - startTime,
      };
    }

    const schemaContext = buildSchemaContext(context);
    const inputDescription = Object.entries(inputs).map(([k, v]) => `${k}: ${v}`).join(', ');

    const categoryPrompts: Record<string, string> = {
      modeling: `基于以下需求生成 DuckDB SQL 建模查询：\n需求: ${inputs.description || inputDescription}\n表结构: ${schemaContext}\n\n请分析业务语义，生成完整、可执行的 SQL 语句、DDL 或数据模型。`,
      wrangling: `基于以下需求生成 DuckDB 数据转换 (Data Wrangling) SQL：\n需求: ${inputDescription}\n表结构: ${schemaContext}\n\n请专注于数据清洗、类型转换、字符串处理或结构化转换逻辑。`,
      insights: `基于以下需求生成 DuckDB 深度分析 (Insights) 查询：\n需求: ${inputDescription}\n表结构: ${schemaContext}\n\n请生成包含复杂聚合、窗口函数、时间序列分析或多维对比的 SQL。`,
      optimization: `基于以下需求生成 DuckDB 诊断与优化建议：\n需求: ${inputDescription}\n表结构: ${schemaContext}\n\n请分析 SQL 性能，提供优化后的查询语句或索引思路。`,
      engineering: `基于以下需求生成 DuckDB 工程辅助 (Engineering) SQL：\n需求: ${inputDescription}\n表结构: ${schemaContext}\n\n请专注于测试数据生成、抽样、导入导出或数据质量检查逻辑。`,
    };

    // Inject Official Handbook Skills if matched
    let officialSkillsContext = '';
    if (context.matchedOfficialSkills && context.matchedOfficialSkills.length > 0) {
      officialSkillsContext = '\n\n## 必须遵循的官方手册规则 (Handbook Rules):\n';
      context.matchedOfficialSkills.forEach(id => {
        const skill = OFFICIAL_HANDBOOK_SKILLS.find(s => s.id === id);
        if (skill) {
          officialSkillsContext += `\n### [${skill.id}] ${skill.name}\n${skill.content}\n`;
        }
      });
    }

    const prompt = (categoryPrompts[skill.category] || `生成 DuckDB SQL: ${inputDescription}\n表结构: ${schemaContext}`) + officialSkillsContext;

    // Check cancellation before AI call
    if (cancelToken?.cancelled) {
      return {
        success: false,
        error: 'Execution cancelled',
        executionTime: Date.now() - startTime,
      };
    }

    const sql = await aiService.generateSql(prompt, schemaContext, onChunk);

    // Check cancellation after AI call
    if (cancelToken?.cancelled) {
      return {
        success: false,
        error: 'Execution cancelled',
        executionTime: Date.now() - startTime,
      };
    }

    return {
      success: true,
      sql: sql.trim(),
      explanation: `基于 ${skill.name} 生成的 SQL 查询`,
      executionTime: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'SQL generation failed',
      executionTime: Date.now() - startTime,
    };
  }
}

// ============================================================
// SkillExecutor class with cancellation support
// ============================================================

class SkillExecutor {
  private executionHistory: { skillId: string; result: SkillResult; timestamp: number }[] = [];
  private maxHistorySize = 50;
  // Current cancel token for aborting ongoing execution
  private currentCancelToken: CancelToken | null = null;

  /**
   * Execute a skill with optional cancellation support
   */
  async execute(request: SkillInvokeRequest): Promise<SkillResult> {
    const { skillId, inputs, context, simulateOnly, onChunk, cancelToken } = request;
    const skill = getSkill(skillId);

    if (!skill) {
      return { success: false, error: `Skill not found: ${skillId}` };
    }

    // Set as current execution
    this.currentCancelToken = cancelToken || null;
    const startTime = Date.now();

    try {
      // Check cancellation before starting
      if (cancelToken?.cancelled) {
        return { success: false, error: 'Execution cancelled', executionTime: Date.now() - startTime };
      }

      // 1. Try declarative generator (registry or direct function)
      const generator = await resolveGenerator(skill);

      let result: SkillResult;

      if (generator) {
        // Check cancellation
        if (cancelToken?.cancelled) {
          return { success: false, error: 'Execution cancelled', executionTime: Date.now() - startTime };
        }

        const raw = generator(inputs, context);
        const sql = raw instanceof Promise ? await raw : raw;

        // If template generated meaningful SQL (not just placeholders), use it directly
        if (sql && !sql.includes('col') && !sql.includes('table_name')) {
          result = {
            success: true,
            sql,
            explanation: `基于 ${skill.name} 模板生成的 SQL`,
          };
          this.addToHistory(skillId, result, context, inputs);
          return { ...result, executionTime: Date.now() - startTime };
        }

        // Template generated placeholder-heavy output — enhance with AI
        result = {
          success: true,
          sql,
          explanation: `基于 ${skill.name} 模板生成的 SQL (AI 增强)`,
        };
      } else {
        // 2. No generator found — use AI fallback
        result = await generateWithAI(skill, inputs, context, onChunk, cancelToken);
      }

      // Check cancellation after first pass
      if (cancelToken?.cancelled) {
        return { success: false, error: 'Execution cancelled', executionTime: Date.now() - startTime };
      }

      // 3. AI enhancement pass (if we already have a template result)
      if (generator) {
        try {
          const aiResult = await generateWithAI(skill, inputs, context, onChunk, cancelToken);
          if (aiResult.success && aiResult.sql) {
            result = {
              ...result,
              ...aiResult,
              explanation: (result.explanation || '') + ' (AI 增强)',
              executionTime: aiResult.executionTime,
            };
          }
        } catch (e) {
          console.warn('AI enhancement failed, using template:', e);
        }
      }

      this.addToHistory(skillId, result, context, inputs);

      if (simulateOnly) {
        return { ...result, metadata: { ...result.metadata, simulated: true, executionTime: Date.now() - startTime } };
      }

      return { ...result, executionTime: Date.now() - startTime };
    } catch (error: any) {
      const errorResult = { success: false, error: error.message || 'Execution failed', executionTime: Date.now() - startTime };
      this.addToHistory(skillId, errorResult, context, inputs);
      return errorResult;
    } finally {
      this.currentCancelToken = null;
    }
  }

  /**
   * Cancel the current ongoing execution
   */
  cancel(): void {
    if (this.currentCancelToken) {
      this.currentCancelToken.cancelled = true;
    }
  }

  /**
   * Check if there's an ongoing execution
   */
  isExecuting(): boolean {
    return this.currentCancelToken !== null;
  }

  private addToHistory(skillId: string, result: SkillResult, context?: SkillExecutionContext, inputs?: Record<string, any>): void {
    const skill = getSkill(skillId);
    const entry = {
      skillId,
      skillName: skill?.name || skillId,
      skillCategory: skill?.category || 'unknown',
      inputs: inputs || {},
      result: {
        success: result.success,
        sql: result.sql,
        error: result.error,
        explanation: result.explanation,
      },
      duration: result.executionTime,
      tableName: context?.tableName,
    };
    persistHistory(entry);
    // Also keep in-memory for backward compatibility
    this.executionHistory.unshift({ skillId, result, timestamp: Date.now() });
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory = this.executionHistory.slice(0, this.maxHistorySize);
    }
  }

  getHistory() {
    // Return persisted history which has more details
    return getPersistedHistory().map(e => ({
      skillId: e.skillId,
      result: e.result as SkillResult,
      timestamp: e.timestamp,
    }));
  }
  clearHistory(): void {
    clearPersistedHistory();
    this.executionHistory = [];
  }
}

// Singleton
export const skillExecutor = new SkillExecutor();

// Convenience functions
export const executeSkill = (request: SkillInvokeRequest) => skillExecutor.execute(request);
export const getSkillHistory = () => skillExecutor.getHistory();
export const clearSkillHistory = () => skillExecutor.clearHistory();
export const cancelSkillExecution = () => skillExecutor.cancel();
export const isSkillExecuting = () => skillExecutor.isExecuting();
