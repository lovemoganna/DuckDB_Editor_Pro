import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractTableAliases,
  extractReferencedTables,
  isTableContext,
  resolveTableKey,
  createSqlCompletionSource,
  SchemaTree,
} from './sqlCompletionEngine';
import type { CompletionContext } from '@codemirror/autocomplete';

describe('sqlCompletionEngine Unit Tests', () => {
  const sampleSchema: SchemaTree = {
    users: [
      { name: 'id', type: 'BIGINT', pk: true, nullable: false },
      { name: 'username', type: 'VARCHAR', nullable: false },
      { name: 'email', type: 'VARCHAR', nullable: true },
      { name: 'created_at', type: 'TIMESTAMP', nullable: false },
    ],
    orders: [
      { name: 'order_id', type: 'BIGINT', pk: true },
      { name: 'user_id', type: 'BIGINT' },
      { name: 'amount', type: 'DECIMAL(10,2)' },
      { name: 'status', type: 'VARCHAR' },
    ],
    'memory.products': [
      { name: 'product_id', type: 'INTEGER', pk: true },
      { name: 'title', type: 'VARCHAR' },
      { name: 'price', type: 'DOUBLE' },
    ],
  };

  describe('extractTableAliases', () => {
    it('extracts single table alias without AS', () => {
      const sql = 'SELECT u.id FROM users u WHERE u.id > 10';
      const aliases = extractTableAliases(sql);
      expect(aliases.u).toBe('users');
    });

    it('extracts table alias with AS', () => {
      const sql = 'SELECT o.order_id FROM orders AS o';
      const aliases = extractTableAliases(sql);
      expect(aliases.o).toBe('orders');
    });

    it('extracts multiple JOIN aliases', () => {
      const sql = `
        SELECT u.username, o.amount
        FROM users AS u
        JOIN orders o ON u.id = o.user_id
        LEFT JOIN memory.products p ON p.product_id = o.product_id
      `;
      const aliases = extractTableAliases(sql);
      expect(aliases.u).toBe('users');
      expect(aliases.o).toBe('orders');
      expect(aliases.p).toBe('memory.products');
    });

    it('handles CTE aliases', () => {
      const sql = 'WITH active_users AS (SELECT * FROM users) SELECT * FROM active_users a';
      const aliases = extractTableAliases(sql);
      expect(aliases.active_users).toBe('active_users');
      expect(aliases.a).toBe('active_users');
    });

    it('ignores SQL keywords mistaken as aliases', () => {
      const sql = 'SELECT * FROM users WHERE id = 1';
      const aliases = extractTableAliases(sql);
      expect(aliases.where).toBeUndefined();
    });
  });

  describe('extractReferencedTables', () => {
    it('extracts tables from FROM and JOIN clauses', () => {
      const sql = 'SELECT u.id, o.amount FROM users u JOIN orders o ON u.id = o.user_id';
      const tables = extractReferencedTables(sql);
      expect(tables).toContain('users');
      expect(tables).toContain('orders');
    });

    it('extracts schema-prefixed tables and their base names', () => {
      const sql = 'SELECT * FROM memory.products';
      const tables = extractReferencedTables(sql);
      expect(tables).toContain('memory.products');
      expect(tables).toContain('products');
    });
  });

  describe('isTableContext', () => {
    it('detects FROM context', () => {
      expect(isTableContext('SELECT * FROM ')).toBe(true);
      expect(isTableContext('SELECT * FROM u')).toBe(true);
      expect(isTableContext('select * from  ')).toBe(true);
    });

    it('detects JOIN contexts', () => {
      expect(isTableContext('SELECT * FROM users LEFT JOIN ')).toBe(true);
      expect(isTableContext('SELECT * FROM users INNER JOIN ord')).toBe(true);
    });

    it('detects INTO and UPDATE contexts', () => {
      expect(isTableContext('INSERT INTO ')).toBe(true);
      expect(isTableContext('UPDATE ')).toBe(true);
    });

    it('returns false for expression contexts', () => {
      expect(isTableContext('SELECT ')).toBe(false);
      expect(isTableContext('WHERE ')).toBe(false);
      expect(isTableContext('SELECT id, ')).toBe(false);
    });
  });

  describe('resolveTableKey', () => {
    const aliases = { u: 'users', o: 'orders', p: 'memory.products' };

    it('resolves direct table name', () => {
      expect(resolveTableKey('users', aliases, sampleSchema)).toBe('users');
      expect(resolveTableKey('USERS', aliases, sampleSchema)).toBe('users');
    });

    it('resolves alias to table name', () => {
      expect(resolveTableKey('u', aliases, sampleSchema)).toBe('users');
      expect(resolveTableKey('o', aliases, sampleSchema)).toBe('orders');
      expect(resolveTableKey('p', aliases, sampleSchema)).toBe('memory.products');
    });

    it('resolves schema-stripped table name', () => {
      expect(resolveTableKey('products', aliases, sampleSchema)).toBe('memory.products');
    });

    it('returns null for unknown identifier', () => {
      expect(resolveTableKey('unknown_table', aliases, sampleSchema)).toBeNull();
    });
  });

  describe('createSqlCompletionSource CodeMirror Completion', () => {
    const completionSource = createSqlCompletionSource(() => sampleSchema);

    function createMockContext(docText: string, cursorOffset: number): CompletionContext {
      return {
        state: {
          doc: {
            toString: () => docText,
            lineAt: (offset: number) => ({
              from: 0,
              to: docText.length,
              text: docText,
              number: 1,
            }),
          },
        },
        pos: cursorOffset,
        explicit: true,
        matchBefore: (regex: RegExp) => {
          const textBefore = docText.slice(0, cursorOffset);
          const match = textBefore.match(new RegExp(regex.source + '$'));
          if (!match) return null;
          return {
            from: cursorOffset - match[0].length,
            to: cursorOffset,
            text: match[0],
          };
        },
      } as unknown as CompletionContext;
    }

    it('provides dotted column completion when typing table_name.', async () => {
      const sql = 'SELECT users.';
      const context = createMockContext(sql, sql.length);
      const result = await completionSource(context);

      expect(result).not.toBeNull();
      expect(result!.options.length).toBe(4); // id, username, email, created_at
      const labels = result!.options.map(o => o.label);
      expect(labels).toContain('id');
      expect(labels).toContain('username');
      expect(labels).toContain('email');
      expect(labels).toContain('created_at');

      // Verify detail shows column type
      const idOpt = result!.options.find(o => o.label === 'id');
      expect(idOpt?.detail).toBe('BIGINT');
      expect(idOpt?.type).toBe('property');
    });

    it('provides dotted column completion when typing alias. with resolved alias', async () => {
      const sql = 'SELECT u. FROM users u';
      const cursor = 'SELECT u.'.length;
      const context = createMockContext(sql, cursor);
      const result = await completionSource(context);

      expect(result).not.toBeNull();
      const labels = result!.options.map(o => o.label);
      expect(labels).toContain('id');
      expect(labels).toContain('username');
    });

    it('prioritizes tables in table context (FROM / JOIN)', async () => {
      const sql = 'SELECT * FROM ';
      const context = createMockContext(sql, sql.length);
      const result = await completionSource(context);

      expect(result).not.toBeNull();
      const tableOption = result!.options.find(o => o.label === 'users');
      expect(tableOption).toBeDefined();
      expect(tableOption?.type).toBe('class');
      expect(tableOption?.boost).toBeGreaterThan(90);

      // Table-valued functions should also be boosted
      const csvFn = result!.options.find(o => o.label === 'read_csv_auto');
      expect(csvFn).toBeDefined();
      expect(csvFn?.boost).toBeGreaterThan(80);
    });

    it('prioritizes referenced table columns in SELECT / WHERE clauses', async () => {
      const sql = 'SELECT  FROM users u JOIN orders o ON u.id = o.user_id';
      const cursor = 'SELECT '.length;
      const context = createMockContext(sql, cursor);
      const result = await completionSource(context);

      expect(result).not.toBeNull();
      // Should include columns from users and orders
      const userCol = result!.options.find(o => o.label === 'username');
      expect(userCol).toBeDefined();
      expect(userCol?.boost).toBeGreaterThan(60);

      // Functions should also be available
      const countFn = result!.options.find(o => o.label === 'COUNT');
      expect(countFn).toBeDefined();
    });
  });
});
