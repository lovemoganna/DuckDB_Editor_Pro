/**
 * AI Parameter Extractor
 * 
 * Logic decoupled from SkillRouter for cleaner architecture.
 * Responsibility: Extract structured inputs from NL using rules, skill-specific parsers, or AI.
 */

import {
  AISkill,
  SkillExecutionContext,
  SkillInputField
} from '../../types';
import { aiService } from '../aiService';
import { getSkill } from '../skillRegistry';

export class ParameterExtractor {
  /**
   * Extract parameters for a specific skill from a user request
   */
  async extract(
    userRequest: string,
    skillId: string,
    context: SkillExecutionContext
  ): Promise<Record<string, any>> {
    const skill = getSkill(skillId);
    if (!skill) return { description: userRequest };

    // 1. Try skill-specific parser if defined
    if (skill.inputParser) {
      try {
        const customInputs = skill.inputParser(userRequest, context);
        if (Object.keys(customInputs).length > 0) return customInputs;
      } catch (e) {
        console.warn(`Custom parser failed for skill ${skillId}:`, e);
      }
    }

    // 2. Rule-based extraction (legacy logic, but cleaner)
    const ruleInputs = this.extractByRules(userRequest, skill.inputSchema, context);

    // 3. Check for missing required fields
    const missingRequired = skill.inputSchema.filter(
      field => field.required && (ruleInputs[field.name] === undefined || ruleInputs[field.name] === '')
    );

    if (missingRequired.length === 0) return ruleInputs;

    // 4. AI-powered extraction for missing fields or complex scenarios
    try {
      const aiInputs = await this.extractByAI(userRequest, skill, context, ruleInputs);
      return { ...ruleInputs, ...aiInputs };
    } catch (e) {
      console.warn(`AI parameter extraction failed for skill ${skillId}:`, e);
      return ruleInputs;
    }
  }

  /**
   * Rule-based extraction logic
   */
  private extractByRules(
    userRequest: string,
    schema: SkillInputField[],
    context: SkillExecutionContext
  ): Record<string, any> {
    const lowerRequest = userRequest.toLowerCase();
    const inputs: Record<string, any> = {};

    for (const field of schema) {
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
          const match = userRequest.match(/(?:条件?|where|过滤|筛选)(.+?)(?:，|,|。|$)/i);
          if (match) inputs[field.name] = match[1].trim();
          break;
        }

        case 'limit': {
          const match = userRequest.match(/(?:前|top|limit|最多)\s*(\d+)/i);
          inputs[field.name] = match ? parseInt(match[1], 10) : (field.defaultValue || 100);
          break;
        }

        case 'orderBy':
        case 'sortBy': {
          const match = userRequest.match(/(?:按|排序|order\s*by|sort)\s*(\S+)/i);
          if (match) {
            const col = this.matchColumnName(match[1], context);
            inputs[field.name] = col || match[1];
          }
          break;
        }

        case 'groupBy':
        case 'groupByColumns': {
          const match = userRequest.match(/(?:按|分组|group\s*by)\s*(\S+)/i);
          if (match) {
            const col = this.matchColumnName(match[1], context);
            inputs[field.name] = col || match[1];
          }
          break;
        }

        case 'aggregationType': {
          const aggMap: [RegExp, string][] = [
            [/求和|总[和计额]|sum/i, 'SUM'],
            [/平均|均值|avg|average/i, 'AVG'],
            [/计数|数量|count/i, 'COUNT'],
            [/最大|最高|max/i, 'MAX'],
            [/最小|最低|min/i, 'MIN'],
          ];
          for (const [pattern, type] of aggMap) {
            if (pattern.test(userRequest)) {
              inputs[field.name] = type;
              break;
            }
          }
          break;
        }

        default:
          if (field.defaultValue !== undefined) {
            inputs[field.name] = field.defaultValue;
          }
      }
    }

    return inputs;
  }

  /**
   * AI-powered parameter extraction
   */
  private async extractByAI(
    userRequest: string,
    skill: AISkill,
    context: SkillExecutionContext,
    existing: Record<string, any>
  ): Promise<Record<string, any>> {
    const schemaContext = context.tableName 
      ? `表: ${context.tableName}, 列: ${context.columns?.map(c => c.name).join(', ')}` 
      : '无表结构上下文';

    const fieldsToExtract = skill.inputSchema
      .filter(f => !existing[f.name])
      .map(f => `${f.name} (${f.label}): ${f.description || ''}`)
      .join('\n');

    if (!fieldsToExtract) return {};

    const prompt = `你是一个参数提取专家。从用户的自然语言需求中提取以下字段。
需求: ${userRequest}
${schemaContext}

需要提取的字段:
${fieldsToExtract}

请仅返回 JSON 格式结果，不要包含任何解释。
格式: {"field1": "value1", "field2": "value2"}`;

    const response = await aiService.generateSql(prompt, '');
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  }

  /**
   * Helper to match column names from context
   */
  private matchColumnName(mention: string, context: SkillExecutionContext): string | null {
    if (!context.columns || context.columns.length === 0) return null;
    const lower = mention.toLowerCase().replace(/[，,。、]/g, '');

    const exact = context.columns.find(c => c.name.toLowerCase() === lower);
    if (exact) return exact.name;

    const partial = context.columns.find(c =>
      c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase())
    );
    return partial?.name || null;
  }
}

export const parameterExtractor = new ParameterExtractor();
