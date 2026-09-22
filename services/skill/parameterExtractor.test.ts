/**
 * parameterExtractor.test.ts — Unit tests for AI Parameter Extractor
 *
 * Tests:
 * - Rule-based extraction for description, conditions, limit, orderBy, groupBy, aggregationType
 * - Column name matching from context
 * - Skill not found handling
 * - Custom inputParser fallback
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ParameterExtractor } from './parameterExtractor';
import type { SkillInputField, SkillExecutionContext } from '../../types';

// ─── Mock dependencies ─────────────────────────────────────────────────────

vi.mock('../aiService', () => ({
  aiService: {
    generateSql: vi.fn().mockResolvedValue('{}'),
  },
}));

vi.mock('../skillRegistry', () => ({
  getSkill: vi.fn(),
}));

// ─── Test helpers ─────────────────────────────────────────────────────────

function makeCtx(overrides?: Partial<SkillExecutionContext>): SkillExecutionContext {
  return {
    tableName: 'orders',
    columns: [
      { name: 'order_id', type: 'VARCHAR', notnull: false, dflt_value: null, pk: true },
      { name: 'user_id', type: 'VARCHAR', notnull: false, dflt_value: null, pk: false },
      { name: 'amount', type: 'DOUBLE', notnull: false, dflt_value: null, pk: false },
      { name: 'status', type: 'VARCHAR', notnull: false, dflt_value: null, pk: false },
      { name: 'created_at', type: 'TIMESTAMP', notnull: false, dflt_value: null, pk: false },
    ],
    userIntent: '',
    ...overrides,
  };
}

function makeSelectSchema(): SkillInputField[] {
  return [
    { name: 'description', type: 'textarea', required: true, label: '查询描述' },
    { name: 'conditions', type: 'textarea', required: false, label: '筛选条件' },
    { name: 'orderBy', type: 'select', required: false, label: '排序方式', options: ['不排序', '升序', '降序'] },
    { name: 'limit', type: 'number', required: false, label: '返回行数', defaultValue: 100, min: 1, max: 10000 },
  ];
}

function makeAggSchema(): SkillInputField[] {
  return [
    { name: 'description', type: 'textarea', required: true, label: '查询描述' },
    { name: 'aggregationType', type: 'select', required: true, label: '聚合类型', options: ['SUM', 'AVG', 'COUNT', 'MAX', 'MIN'] },
    { name: 'groupByColumns', type: 'textarea', required: false, label: '分组字段' },
    { name: 'limit', type: 'number', required: false, label: '返回行数', defaultValue: 100 },
  ];
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe('ParameterExtractor — rule-based extraction', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('description field', () => {
    it('should extract description from user request', async () => {
      const { getSkill } = await import('../skillRegistry');
      vi.mocked(getSkill).mockReturnValue({
        id: 'test-skill', name: 'Test', description: 'Test',
        category: 'modeling' as const, inputSchema: makeSelectSchema(), outputType: 'sql' as const,
      });

      const extractor = new ParameterExtractor();
      const result = await extractor.extract('查询所有订单金额大于1000元的用户', 'test-skill', makeCtx());
      expect(result.description).toBe('查询所有订单金额大于1000元的用户');
    });
  });

  describe('conditions field', () => {
    it('should extract conditions with Chinese keyword', async () => {
      const { getSkill } = await import('../skillRegistry');
      vi.mocked(getSkill).mockReturnValue({
        id: 'test-skill', name: 'Test', description: 'Test',
        category: 'modeling' as const, inputSchema: makeSelectSchema(), outputType: 'sql' as const,
      });

      const extractor = new ParameterExtractor();
      // The regex captures "是金额大于1000" because "条件" matches and ".+?" is greedy up to the comma
      const result = await extractor.extract('查询所有订单，条件是金额大于1000', 'test-skill', makeCtx());
      expect(result.conditions).toBe('是金额大于1000');
    });

    it('should extract conditions with "where" keyword', async () => {
      const { getSkill } = await import('../skillRegistry');
      vi.mocked(getSkill).mockReturnValue({
        id: 'test-skill', name: 'Test', description: 'Test',
        category: 'modeling' as const, inputSchema: makeSelectSchema(), outputType: 'sql' as const,
      });

      const extractor = new ParameterExtractor();
      const result = await extractor.extract("查询所有订单 where status = paid", 'test-skill', makeCtx());
      expect(result.conditions).toBe('status = paid');
    });

    it('should return undefined conditions when not found', async () => {
      const { getSkill } = await import('../skillRegistry');
      vi.mocked(getSkill).mockReturnValue({
        id: 'test-skill', name: 'Test', description: 'Test',
        category: 'modeling' as const, inputSchema: makeSelectSchema(), outputType: 'sql' as const,
      });

      const extractor = new ParameterExtractor();
      const result = await extractor.extract('查询所有订单', 'test-skill', makeCtx());
      expect(result.conditions).toBeUndefined();
    });
  });

  describe('limit field', () => {
    it('should extract limit with Chinese "前" keyword', async () => {
      const { getSkill } = await import('../skillRegistry');
      vi.mocked(getSkill).mockReturnValue({
        id: 'test-skill', name: 'Test', description: 'Test',
        category: 'modeling' as const, inputSchema: makeSelectSchema(), outputType: 'sql' as const,
      });

      const extractor = new ParameterExtractor();
      const result = await extractor.extract('查询前50条订单', 'test-skill', makeCtx());
      expect(result.limit).toBe(50);
    });

    it('should extract limit with "top" keyword', async () => {
      const { getSkill } = await import('../skillRegistry');
      vi.mocked(getSkill).mockReturnValue({
        id: 'test-skill', name: 'Test', description: 'Test',
        category: 'modeling' as const, inputSchema: makeSelectSchema(), outputType: 'sql' as const,
      });

      const extractor = new ParameterExtractor();
      const result = await extractor.extract('查询top 200的订单', 'test-skill', makeCtx());
      expect(result.limit).toBe(200);
    });

    it('should use default limit when not specified', async () => {
      const { getSkill } = await import('../skillRegistry');
      vi.mocked(getSkill).mockReturnValue({
        id: 'test-skill', name: 'Test', description: 'Test',
        category: 'modeling' as const, inputSchema: makeSelectSchema(), outputType: 'sql' as const,
      });

      const extractor = new ParameterExtractor();
      const result = await extractor.extract('查询所有订单', 'test-skill', makeCtx());
      expect(result.limit).toBe(100);
    });
  });

  describe('orderBy field', () => {
    it('should extract sort column from request and try to match context', async () => {
      const { getSkill } = await import('../skillRegistry');
      vi.mocked(getSkill).mockReturnValue({
        id: 'test-skill', name: 'Test', description: 'Test',
        category: 'modeling' as const, inputSchema: makeSelectSchema(), outputType: 'sql' as const,
      });

      const extractor = new ParameterExtractor();
      // "金额" is not a column in ctx, so matchColumnName returns null, and raw text is used
      const result = await extractor.extract('按金额排序查询', 'test-skill', makeCtx());
      expect(result.orderBy).toBe('金额排序查询');
    });

    it('should match exact column name case-insensitively', async () => {
      const { getSkill } = await import('../skillRegistry');
      vi.mocked(getSkill).mockReturnValue({
        id: 'test-skill', name: 'Test', description: 'Test',
        category: 'modeling' as const, inputSchema: makeSelectSchema(), outputType: 'sql' as const,
      });

      const extractor = new ParameterExtractor();
      const result = await extractor.extract('按AMOUNT排序', 'test-skill', makeCtx());
      expect(result.orderBy).toBe('amount');
    });
  });

  describe('groupBy fields', () => {
    it('should extract groupBy column from request', async () => {
      const { getSkill } = await import('../skillRegistry');
      vi.mocked(getSkill).mockReturnValue({
        id: 'test-skill', name: 'Test', description: 'Test',
        category: 'modeling' as const, inputSchema: makeAggSchema(), outputType: 'sql' as const,
      });

      const extractor = new ParameterExtractor();
      // "用户ID" is not in ctx.columns, so matchColumnName returns null, raw text is used
      const result = await extractor.extract('按用户ID分组统计', 'test-skill', makeCtx());
      expect(result.groupByColumns).toBe('用户ID分组统计');
    });
  });

  describe('aggregationType fields', () => {
    it('should extract SUM keyword', async () => {
      const { getSkill } = await import('../skillRegistry');
      vi.mocked(getSkill).mockReturnValue({
        id: 'test-skill', name: 'Test', description: 'Test',
        category: 'modeling' as const, inputSchema: makeAggSchema(), outputType: 'sql' as const,
      });

      const extractor = new ParameterExtractor();
      const result = await extractor.extract('求和订单金额', 'test-skill', makeCtx());
      expect(result.aggregationType).toBe('SUM');
    });

    it('should extract AVG keyword', async () => {
      const { getSkill } = await import('../skillRegistry');
      vi.mocked(getSkill).mockReturnValue({
        id: 'test-skill', name: 'Test', description: 'Test',
        category: 'modeling' as const, inputSchema: makeAggSchema(), outputType: 'sql' as const,
      });

      const extractor = new ParameterExtractor();
      const result = await extractor.extract('平均订单金额', 'test-skill', makeCtx());
      expect(result.aggregationType).toBe('AVG');
    });

    it('should extract COUNT keyword', async () => {
      const { getSkill } = await import('../skillRegistry');
      vi.mocked(getSkill).mockReturnValue({
        id: 'test-skill', name: 'Test', description: 'Test',
        category: 'modeling' as const, inputSchema: makeAggSchema(), outputType: 'sql' as const,
      });

      const extractor = new ParameterExtractor();
      const result = await extractor.extract('计数订单数量', 'test-skill', makeCtx());
      expect(result.aggregationType).toBe('COUNT');
    });

    it('should extract MAX keyword', async () => {
      const { getSkill } = await import('../skillRegistry');
      vi.mocked(getSkill).mockReturnValue({
        id: 'test-skill', name: 'Test', description: 'Test',
        category: 'modeling' as const, inputSchema: makeAggSchema(), outputType: 'sql' as const,
      });

      const extractor = new ParameterExtractor();
      const result = await extractor.extract('最大订单金额', 'test-skill', makeCtx());
      expect(result.aggregationType).toBe('MAX');
    });

    it('should extract MIN keyword', async () => {
      const { getSkill } = await import('../skillRegistry');
      vi.mocked(getSkill).mockReturnValue({
        id: 'test-skill', name: 'Test', description: 'Test',
        category: 'modeling' as const, inputSchema: makeAggSchema(), outputType: 'sql' as const,
      });

      const extractor = new ParameterExtractor();
      const result = await extractor.extract('最小订单金额', 'test-skill', makeCtx());
      expect(result.aggregationType).toBe('MIN');
    });
  });

  describe('tableName fallback', () => {
    it('should use context.tableName when field name matches', async () => {
      const { getSkill } = await import('../skillRegistry');
      vi.mocked(getSkill).mockReturnValue({
        id: 'test-skill', name: 'Test', description: 'Test',
        category: 'modeling' as const,
        inputSchema: [{ name: 'tableName', type: 'text', required: true, label: '表名' }],
        outputType: 'sql' as const,
      });

      const extractor = new ParameterExtractor();
      const result = await extractor.extract('查询表', 'test-skill', makeCtx());
      expect(result.tableName).toBe('orders');
    });

    it('should use defaultValue when no context tableName', async () => {
      const { getSkill } = await import('../skillRegistry');
      vi.mocked(getSkill).mockReturnValue({
        id: 'test-skill', name: 'Test', description: 'Test',
        category: 'modeling' as const,
        inputSchema: [{ name: 'tableName', type: 'text', required: true, label: '表名', defaultValue: 'default_table' }],
        outputType: 'sql' as const,
      });

      const extractor = new ParameterExtractor();
      const result = await extractor.extract('查询表', 'test-skill', makeCtx({ tableName: undefined }));
      expect(result.tableName).toBe('default_table');
    });
  });

  describe('skill not found', () => {
    it('should return description as fallback when skill not found', async () => {
      const { getSkill } = await import('../skillRegistry');
      vi.mocked(getSkill).mockReturnValue(undefined);

      const extractor = new ParameterExtractor();
      const result = await extractor.extract('查询所有订单', 'non-existent', makeCtx());
      expect(result.description).toBe('查询所有订单');
    });
  });

  describe('custom inputParser', () => {
    it('should use custom parser when defined and returns non-empty result', async () => {
      const customParser = vi.fn().mockReturnValue({ customField: 'customValue' });
      const { getSkill } = await import('../skillRegistry');
      vi.mocked(getSkill).mockReturnValue({
        id: 'test-skill', name: 'Test', description: 'Test',
        category: 'modeling' as const, inputSchema: makeSelectSchema(),
        outputType: 'sql' as const, inputParser: customParser,
      });

      const extractor = new ParameterExtractor();
      const result = await extractor.extract('some request', 'test-skill', makeCtx());
      expect(customParser).toHaveBeenCalledWith('some request', makeCtx());
      expect(result.customField).toBe('customValue');
    });

    it('should fall back to rules when custom parser returns empty', async () => {
      const customParser = vi.fn().mockReturnValue({});
      const { getSkill } = await import('../skillRegistry');
      vi.mocked(getSkill).mockReturnValue({
        id: 'test-skill', name: 'Test', description: 'Test',
        category: 'modeling' as const, inputSchema: makeSelectSchema(),
        outputType: 'sql' as const, inputParser: customParser,
      });

      const extractor = new ParameterExtractor();
      const result = await extractor.extract('查询前10条订单', 'test-skill', makeCtx());
      expect(result.limit).toBe(10);
    });

    it('should fall back to rules when custom parser throws', async () => {
      const customParser = vi.fn().mockImplementation(() => { throw new Error('Parser error'); });
      const { getSkill } = await import('../skillRegistry');
      vi.mocked(getSkill).mockReturnValue({
        id: 'test-skill', name: 'Test', description: 'Test',
        category: 'modeling' as const, inputSchema: makeSelectSchema(),
        outputType: 'sql' as const, inputParser: customParser,
      });

      const extractor = new ParameterExtractor();
      const result = await extractor.extract('查询前10条订单', 'test-skill', makeCtx());
      expect(result.limit).toBe(10);
    });
  });

  describe('column name matching', () => {
    it('should handle empty columns context gracefully', async () => {
      const { getSkill } = await import('../skillRegistry');
      vi.mocked(getSkill).mockReturnValue({
        id: 'test-skill', name: 'Test', description: 'Test',
        category: 'modeling' as const, inputSchema: makeSelectSchema(), outputType: 'sql' as const,
      });

      const extractor = new ParameterExtractor();
      // When columns is empty, matchColumnName returns null, but raw text is still assigned
      const result = await extractor.extract('按某字段排序', 'test-skill', makeCtx({ columns: [] }));
      expect(result.orderBy).toBe('某字段排序');
    });
  });
});
