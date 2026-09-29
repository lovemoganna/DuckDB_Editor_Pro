// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('./duckdbService', () => ({
  duckDBService: {
    getTableSchema: vi.fn(),
  },
}));

vi.mock('./aiService', () => ({
  aiService: {
    isConfigured: vi.fn(() => false),
    sendChatMessage: vi.fn(),
  },
}));

import { duckDBService } from './duckdbService';
import { aiService } from './aiService';
import {
  buildLocalExplorePrompts,
  generateExplorePrompts,
} from './copilotExplorePrompts';

describe('copilotExplorePrompts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (aiService.isConfigured as any).mockReturnValue(false);
  });

  it('builds schema-aware local prompts for a single table', () => {
    const prompts = buildLocalExplorePrompts([
      {
        table: 'orders',
        columns: [
          { name: 'id', type: 'BIGINT' },
          { name: 'amount', type: 'DOUBLE' },
          { name: 'created_at', type: 'TIMESTAMP' },
          { name: 'status', type: 'VARCHAR' },
        ],
      },
    ]);

    expect(prompts.length).toBeGreaterThanOrEqual(3);
    expect(prompts.some((p) => p.includes('orders'))).toBe(true);
    expect(prompts.some((p) => p.includes('amount'))).toBe(true);
    expect(prompts.some((p) => /分析 categories 数据全景/.test(p))).toBe(false);
  });

  it('builds join-oriented prompts for multiple tables', () => {
    const prompts = buildLocalExplorePrompts([
      { table: 'orders', columns: [{ name: 'user_id', type: 'BIGINT' }, { name: 'amount', type: 'DOUBLE' }] },
      { table: 'customers', columns: [{ name: 'id', type: 'BIGINT' }, { name: 'name', type: 'VARCHAR' }] },
    ]);

    expect(prompts.some((p) => /JOIN|跨表|关联/.test(p))).toBe(true);
    expect(prompts.some((p) => p.includes('orders') && p.includes('customers'))).toBe(true);
  });

  it('generateExplorePrompts uses local fallback when AI is not configured', async () => {
    (duckDBService.getTableSchema as any).mockResolvedValue([
      { name: 'category_id', type: 'INTEGER' },
      { name: 'category_name', type: 'VARCHAR' },
    ]);

    const prompts = await generateExplorePrompts(['categories']);
    expect(prompts.length).toBeGreaterThan(0);
    expect(prompts.every((p) => p.includes('categories') || p.includes('category'))).toBe(true);
    expect(aiService.sendChatMessage).not.toHaveBeenCalled();
  });

  it('generateExplorePrompts prefers AI JSON list when configured', async () => {
    (aiService.isConfigured as any).mockReturnValue(true);
    (duckDBService.getTableSchema as any).mockResolvedValue([
      { name: 'id', type: 'BIGINT' },
      { name: 'price', type: 'DOUBLE' },
    ]);
    (aiService.sendChatMessage as any).mockResolvedValue(
      JSON.stringify([
        '统计 products.price 分位数并找异常高价',
        '检查 products 主键唯一性与空值',
        '按价格区间汇总 SKU 数量',
        '给出 3 条适合看板的聚合 SQL',
      ]),
    );

    const prompts = await generateExplorePrompts(['products']);
    expect(prompts[0]).toContain('products.price');
    expect(aiService.sendChatMessage).toHaveBeenCalledOnce();
  });
});
