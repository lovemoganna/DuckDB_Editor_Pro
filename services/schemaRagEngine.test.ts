import { describe, it, expect } from 'vitest';
import { SchemaRagEngine } from './schemaRagEngine';

describe('SchemaRagEngine', () => {
  const sampleSchema = {
    users: [
      { name: 'id', type: 'BIGINT' },
      { name: 'username', type: 'VARCHAR' },
      { name: 'email', type: 'VARCHAR' },
    ],
    orders: [
      { name: 'id', type: 'BIGINT' },
      { name: 'user_id', type: 'BIGINT' },
      { name: 'total_amount', type: 'DOUBLE' },
      { name: 'created_at', type: 'TIMESTAMP' },
    ],
    products: [
      { name: 'product_id', type: 'BIGINT' },
      { name: 'title', type: 'VARCHAR' },
      { name: 'price', type: 'DOUBLE' },
    ],
    logs: [
      { name: 'log_id', type: 'BIGINT' },
      { name: 'message', type: 'TEXT' },
    ],
    settings: [
      { name: 'key', type: 'VARCHAR' },
      { name: 'value', type: 'VARCHAR' },
    ],
    analytics: [
      { name: 'event', type: 'VARCHAR' },
      { name: 'timestamp', type: 'TIMESTAMP' },
    ],
  };

  it('prunes schema down to Top-K tables based on prompt keywords', () => {
    const pruned = SchemaRagEngine.pruneSchema(sampleSchema, '查询用户 users 的订单 total_amount', 2);
    const tableKeys = Object.keys(pruned);

    expect(tableKeys.length).toBeLessThanOrEqual(2);
    expect(tableKeys).toContain('users');
    expect(tableKeys).toContain('orders');
  });

  it('always includes forced active tables', () => {
    const pruned = SchemaRagEngine.pruneSchema(sampleSchema, '查询日志 log_id', 1, ['products']);
    const tableKeys = Object.keys(pruned);

    expect(tableKeys).toContain('products');
  });

  it('ranks rare business terms above ubiquitous identifier fields', () => {
    const schema = {
      event_log: [
        { name: 'id', type: 'BIGINT' },
        { name: 'event', type: 'VARCHAR' },
      ],
      customer_orders: [
        { name: 'id', type: 'BIGINT' },
        { name: 'customer_id', type: 'BIGINT' },
        { name: 'gross_revenue', type: 'DECIMAL', description: 'recognized customer revenue' },
      ],
      user_archive: [
        { name: 'id', type: 'BIGINT' },
        { name: 'customer_id', type: 'BIGINT' },
      ],
    };

    const ranked = SchemaRagEngine.rankSchema(schema, 'customer revenue');

    expect(ranked[0].tableName).toBe('customer_orders');
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
    expect(ranked[0].matchedKeywords).toEqual(expect.arrayContaining(['customer', 'revenue']));
  });

  it('uses Chinese bigrams and descriptions for deterministic ranking', () => {
    const schema = {
      logs: [{ name: 'message', type: 'VARCHAR', description: '系统日志消息' }],
      orders: [{ name: 'amount', type: 'DECIMAL', description: '订单金额' }],
      users: [{ name: 'name', type: 'VARCHAR', description: '用户名称' }],
    };

    const ranked = SchemaRagEngine.rankSchema(schema, '分析订单金额');

    expect(ranked[0].tableName).toBe('orders');
    expect(ranked[0].matchedKeywords).toEqual(expect.arrayContaining(['订单', '金额']));
  });
});
