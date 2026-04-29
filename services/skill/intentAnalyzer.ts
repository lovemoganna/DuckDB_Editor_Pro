/**
 * AI Intent Analyzer
 * 
 * Logic decoupled from SkillRouter for cleaner architecture.
 * Responsibility: Map Natural Language -> SqlOperationType + Suggested Skills.
 */

import {
  SqlOperationType,
  SkillExecutionContext,
  IntentAnalysis,
  AISkill
} from '../../types';
import { aiService } from '../aiService';
import { OFFICIAL_HANDBOOK_SKILLS } from '../skills/definitions/official-skills';

/**
 * @deprecated Use skill.triggers.keywords instead of INTENT_KEYWORDS_MAP.
 * This map will be removed once all skills migrate to declarative triggers.
 */
const INTENT_KEYWORDS_MAP: Record<SqlOperationType, string[]> = {
  select: ['查询', '查找', '获取', '看看', '显示', '展示', 'query', 'find', 'get', 'show', 'select', 'read', 'list'],
  insert: ['添加', '插入', '新建', '创建', '新增', 'add', 'insert', 'create', 'new', 'append'],
  update: ['修改', '更新', '改变', '调整', 'update', 'modify', 'change', 'edit', 'alter'],
  delete: ['删除', '移除', '清除', '去掉', 'delete', 'remove', 'drop', 'clear'],
  aggregation: ['统计', '合计', '求和', '平均', '计数', '最大值', '最小值', '汇总', 'group', 'sum', 'count', 'avg', 'max', 'min', 'total', 'aggregate'],
  join: ['关联', '连接', '合并', 'join', 'link', 'combine', 'merge'],
  window: ['排名', '排序', '累计', '移动平均', '滞后', '领先', '窗口', 'rank', 'row_number', 'lag', 'lead', 'cumulative', 'moving', 'window'],
  transformation: ['转换', '变换', '透视', '逆透视', 'pivot', 'unpivot', 'transform'],
  analysis: ['分析', '趋势', '留存', '漏斗', '转化', '对比', '占比', 'analyze', 'trend', 'retention', 'funnel', 'conversion', 'compare', 'ratio'],
  optimization: ['优化', '性能', '慢查询', '索引', 'explain', 'optimize', 'performance', 'index'],
  utility: ['生成', '测试', '示例', '模拟', '摘要', 'generate', 'test', 'sample', 'mock']
};

const COMPLEX_PATTERNS = [
  { pattern: /留存/i, skills: ['sql-time-series', 'sql-retention-analysis'] },
  { pattern: /漏斗/i, skills: ['sql-funnel-analysis'] },
  { pattern: /(同比增长|环比|增长率)/i, skills: ['sql-time-series', 'sql-growth-analysis'] },
  { pattern: /(占比|占比|百分比)/i, skills: ['sql-aggregation', 'sql-ratio-analysis'] },
];

export class IntentAnalyzer {
  /**
   * Match a skill against user input using declarative triggers.
   * Returns a score (0-1) for ranking multiple matches.
   */
  matchByTriggers(skill: AISkill, userInput: string): { score: number; matched: boolean } {
    if (!skill.triggers) return { score: 0, matched: false };

    const lower = userInput.toLowerCase();
    const { keywords, patterns } = skill.triggers;
    let score = 0;

    if (keywords?.some(k => lower.includes(k.toLowerCase()))) {
      score += 0.5;
    }

    if (patterns?.some(p => {
      const reg = typeof p === 'string' ? new RegExp(p, 'i') : p;
      return reg.test(userInput);
    })) {
      score += 0.3;
    }

    if (skill.triggers.sqlOperations?.length) {
      score += 0.1;
    }

    return { score, matched: score > 0 };
  }

  /**
   * Analyze user intent from natural language request
   */
  async analyze(userRequest: string, context: SkillExecutionContext): Promise<IntentAnalysis> {
    // 1. Keyword-based matching (deprecated — use triggers)
    const keywordResult = this.matchByKeywords(userRequest);
    if (keywordResult.confidence >= 0.85) return keywordResult;

    // 2. AI-powered matching if confidence is low
    try {
      const aiResult = await this.aiAnalyzeIntent(userRequest, context);
      if (aiResult.confidence > keywordResult.confidence) {
        return aiResult;
      }
      return { ...keywordResult, reasoning: `${keywordResult.reasoning} (AI 校验通过)` };
    } catch (error) {
      console.warn('AI intent analysis failed, using fallback:', error);
      return keywordResult;
    }
  }

  /**
   * Match official handbook skills
   */
  matchOfficialSkills(userRequest: string): string[] {
    const lowerRequest = userRequest.toLowerCase();
    return OFFICIAL_HANDBOOK_SKILLS
      .filter(skill => skill.triggers?.some(trigger => lowerRequest.includes(trigger.toLowerCase())))
      .map(skill => skill.id);
  }

  /** @deprecated Use matchByTriggers() instead */
  private matchByKeywords(userRequest: string): IntentAnalysis {
    const lowerRequest = userRequest.toLowerCase();
    const matches: { type: SqlOperationType; score: number }[] = [];

    for (const [op, keywords] of Object.entries(INTENT_KEYWORDS_MAP)) {
      const matched = keywords.filter(kw => lowerRequest.includes(kw.toLowerCase()));
      if (matched.length > 0) {
        matches.push({ type: op as SqlOperationType, score: matched.length / keywords.length + 0.5 });
      }
    }

    matches.sort((a, b) => b.score - a.score);
    const primary = matches[0]?.type || 'select';
    const confidence = matches.length > 0 ? Math.min(matches[0].score, 0.9) : 0.3;

    return {
      intent: primary,
      confidence,
      requiredSkills: [],
      userRequest,
      matchedOfficialSkills: this.matchOfficialSkills(userRequest),
      reasoning: `关键词匹配: 识别到 ${primary} 操作特征`
    };
  }

  private async aiAnalyzeIntent(userRequest: string, context: SkillExecutionContext): Promise<IntentAnalysis> {
    const schemaInfo = context.tableName ? `当前上下文: 表 ${context.tableName}` : '';
    const prompt = `你是一个 SQL 需求分析专家。分析用户意图并返回 JSON。
需求: ${userRequest}
${schemaInfo}

可能的意图: select, insert, update, delete, aggregation, join, window, transformation, analysis, optimization, utility.

返回格式: {"intent": "...", "confidence": 0.0-1.0, "reasoning": "..."}`;

    const response = await aiService.generateSql(prompt, '');
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { intent: 'select', confidence: 0.5 };

    return {
      intent: parsed.intent || 'select',
      confidence: parsed.confidence || 0.6,
      requiredSkills: [],
      userRequest,
      reasoning: parsed.reasoning || 'AI 语义分析',
      matchedOfficialSkills: this.matchOfficialSkills(userRequest)
    };
  }

  /**
   * Check for complex patterns that might trigger a skill chain
   */
  getComplexSkills(userRequest: string): string[] | null {
    for (const cp of COMPLEX_PATTERNS) {
      if (cp.pattern.test(userRequest)) return cp.skills;
    }
    return null;
  }
}

export const intentAnalyzer = new IntentAnalyzer();
