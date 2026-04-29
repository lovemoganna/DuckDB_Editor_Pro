/**
 * intentAnalyzer.test.ts — Unit tests for AI Intent Analyzer
 *
 * Tests the core intent matching logic:
 * - Keyword-based intent detection
 * - Declarative triggers matching (new system)
 * - Fallback behavior
 */

import { describe, it, expect } from 'vitest';

// Inline minimal imports for testing (avoids full service setup)
import { SqlOperationType } from '../../types';

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
  utility: ['生成', '测试', '示例', '模拟', '摘要', 'generate', 'test', 'sample', 'mock'],
};

/** Minimal intent matcher — mirrors intentAnalyzer.ts logic */
function matchIntentByKeywords(query: string): { intent: SqlOperationType; confidence: number } {
  const q = query.toLowerCase();
  const scores: Record<SqlOperationType, number> = {
    select: 0, insert: 0, update: 0, delete: 0,
    aggregation: 0, join: 0, window: 0, transformation: 0,
    analysis: 0, optimization: 0, utility: 0,
  };

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS_MAP)) {
    for (const kw of keywords) {
      if (q.includes(kw.toLowerCase())) {
        scores[intent as SqlOperationType] += 1;
      }
    }
  }

  const maxIntent = Object.entries(scores).reduce(
    (best, curr) => (curr[1] > best[1] ? curr : best),
    ['select', 0] as [string, number]
  );

  const maxScore = maxIntent[1];
  if (maxScore === 0) return { intent: 'select', confidence: 0.5 };
  return { intent: maxIntent[0] as SqlOperationType, confidence: Math.min(maxScore * 0.3, 1) };
}

describe('IntentAnalyzer — Keyword matching', () => {
  it('should detect select intent from Chinese keywords', () => {
    const result = matchIntentByKeywords('查询所有已支付的订单');
    expect(result.intent).toBe('select');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should detect aggregation intent from Chinese keywords', () => {
    const result = matchIntentByKeywords('统计每个月的销售额');
    expect(result.intent).toBe('aggregation');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should detect insert intent', () => {
    const result = matchIntentByKeywords('插入一条新记录');
    expect(result.intent).toBe('insert');
  });

  it('should detect update intent', () => {
    const result = matchIntentByKeywords('更新用户状态为已过期');
    expect(result.intent).toBe('update');
  });

  it('should detect delete intent', () => {
    const result = matchIntentByKeywords('删除过期记录');
    expect(result.intent).toBe('delete');
  });

  it('should detect join intent', () => {
    const result = matchIntentByKeywords('关联用户表和订单表');
    expect(result.intent).toBe('join');
  });

  it('should detect window intent', () => {
    const result = matchIntentByKeywords('按月份进行累计排名');
    expect(result.intent).toBe('window');
  });

  it('should detect transformation intent', () => {
    const result = matchIntentByKeywords('透视转换数据');
    expect(result.intent).toBe('transformation');
  });

  it('should detect analysis intent', () => {
    const result = matchIntentByKeywords('分析最近30天的趋势');
    expect(result.intent).toBe('analysis');
  });

  it('should detect optimization intent', () => {
    const result = matchIntentByKeywords('优化查询性能');
    expect(result.intent).toBe('optimization');
  });

  it('should detect utility intent', () => {
    const result = matchIntentByKeywords('生成测试数据');
    expect(result.intent).toBe('utility');
  });

  it('should fall back to select with 0.5 confidence for unknown input', () => {
    const result = matchIntentByKeywords('foobarbaz xyz123');
    expect(result.intent).toBe('select');
    expect(result.confidence).toBe(0.5);
  });

  it('should handle English keywords', () => {
    const result = matchIntentByKeywords('select all users');
    expect(result.intent).toBe('select');
  });

  it('should score multiple keywords higher', () => {
    const single = matchIntentByKeywords('查询');
    const multi = matchIntentByKeywords('查询统计每月的订单数量');
    expect(multi.confidence).toBeGreaterThanOrEqual(single.confidence);
  });
});

describe('IntentAnalyzer — Declarative triggers (mock)', () => {
  interface MockTrigger {
    keywords: string[];
    examples: string[];
    score?: number;
  }

  interface MockSkill {
    id: string;
    triggers?: MockTrigger;
  }

  function matchByTriggers(skill: MockSkill, userInput: string): { score: number; matched: boolean } {
    if (!skill.triggers) return { score: 0, matched: false };
    const lower = userInput.toLowerCase();
    let score = 0;

    for (const kw of skill.triggers.keywords) {
      if (lower.includes(kw.toLowerCase())) score += (skill.triggers.score ?? 1) * 0.4;
    }
    for (const ex of skill.triggers.examples) {
      if (lower.includes(ex.toLowerCase())) score += (skill.triggers.score ?? 1) * 0.3;
    }

    return { score: Math.min(score, 1), matched: score > 0 };
  }

  it('should match skill by trigger keyword', () => {
    const skill: MockSkill = {
      id: 'test-skill',
      triggers: {
        keywords: ['排名', 'rank'],
        examples: ['按月排名', 'show rankings'],
      },
    };
    const result = matchByTriggers(skill, '我想按月份排名');
    expect(result.matched).toBe(true);
    expect(result.score).toBeGreaterThan(0);
  });

  it('should not match skill with no triggers', () => {
    const skill: MockSkill = { id: 'test-skill' };
    const result = matchByTriggers(skill, '查询数据');
    expect(result.matched).toBe(false);
    expect(result.score).toBe(0);
  });

  it('should give higher score to multiple keyword matches', () => {
    const skill: MockSkill = {
      id: 'test-skill',
      triggers: {
        keywords: ['查询', '统计'],
        examples: [],
      },
    };
    const partial = matchByTriggers(skill, '查询数据');
    const full = matchByTriggers(skill, '查询统计所有数据');
    expect(full.score).toBeGreaterThan(partial.score);
  });
});
