import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildMinimalSchemaContext,
  buildRelevantSchemaContext,
} from './sqlContextBuilder';
import { duckDBService } from './duckdbService';

describe('sqlContextBuilder - Option D Schema Context RAG', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should filter relevant tables based on query terms', async () => {
    vi.spyOn(duckDBService, 'getTables').mockResolvedValue(['users', 'orders', 'products']);
    vi.spyOn(duckDBService, 'getTableSchema').mockImplementation(async (tableName: string) => {
      if (tableName === 'users') {
        return [{ name: 'user_id', type: 'BIGINT' }, { name: 'email', type: 'VARCHAR' }];
      }
      if (tableName === 'orders') {
        return [{ name: 'order_id', type: 'BIGINT' }, { name: 'total_amount', type: 'DOUBLE' }];
      }
      return [{ name: 'product_id', type: 'BIGINT' }, { name: 'title', type: 'VARCHAR' }];
    });

    const context = await buildRelevantSchemaContext('find all user orders total amount', 2);

    expect(context).toContain('Table orders');
    expect(context).toContain('total_amount (DOUBLE)');
    expect(context).not.toContain('Table products');
  });

  it('introspects table schemas concurrently instead of using an N+1 serial loop', async () => {
    const resolvers: Array<(value: any[]) => void> = [];
    vi.spyOn(duckDBService, 'getTables').mockResolvedValue(['a', 'b', 'c']);
    const schemaSpy = vi.spyOn(duckDBService, 'getTableSchema').mockImplementation(
      () => new Promise(resolve => resolvers.push(resolve)),
    );

    const pending = buildMinimalSchemaContext();
    await vi.waitFor(() => expect(schemaSpy).toHaveBeenCalledTimes(3));

    resolvers.forEach((resolve, index) => resolve([
      { name: `col_${index}`, type: 'INTEGER', notnull: false, dflt_value: null, pk: false },
    ]));

    await expect(pending).resolves.toContain('a: [col_0]');
  });
});
