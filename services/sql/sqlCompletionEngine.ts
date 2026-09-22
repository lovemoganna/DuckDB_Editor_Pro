/**
 * sqlCompletionEngine.ts — Dynamic Schema-Aware & Context-Intelligent SQL Autocompletion Engine
 *
 * Requirements fulfilled:
 * 1. Visual consistency & rich metadata:
 *    - Uses semantic types: table ('class'), column ('property'), keyword ('keyword'), function ('function')
 *    - Detail chips for column data types (VARCHAR, BIGINT, TIMESTAMP, etc.)
 *    - Rich documentation in completion info (signature, description, column details)
 * 2. Dynamic schema perception:
 *    - Queries DuckDB information_schema / PRAGMA in real-time
 *    - Subscribes to 'duckdb-schema-changed' event for instant synchronization
 *    - Never uses hardcoded table or column names
 * 3. Intelligent context perception:
 *    - Table context: after FROM, JOIN, INTO, UPDATE, TABLE, SUMMARIZE, DESCRIBE -> suggests tables & TVFs with high priority
 *    - Dotted identifier: after `<table_or_alias>.` -> resolves alias/table, suggests specifically its columns with high priority
 *    - Query context: inside SELECT, WHERE, ON, GROUP BY, ORDER BY -> prioritizes columns of tables referenced in the query
 *    - Preserves rich SQL keywords and DuckDB functions
 */

import type { CompletionContext, CompletionResult, Completion, CompletionSource } from '@codemirror/autocomplete';
import { duckDBService } from '../duckdbService';

export interface TableColumn {
  name: string;
  type: string;
  nullable?: boolean;
  pk?: boolean;
}

export type SchemaTree = Record<string, TableColumn[]>;

// ============================================================================
// 1. DuckDB Functions & Keywords Knowledge Base
// ============================================================================

export interface SqlFunctionMeta {
  name: string;
  signature: string;
  description: string;
  category: 'aggregate' | 'string' | 'date' | 'math' | 'table' | 'window' | 'general';
}

export const DUCKDB_BUILTIN_FUNCTIONS: SqlFunctionMeta[] = [
  // Table-valued functions
  { name: 'read_csv_auto', signature: "read_csv_auto('file.csv')", description: '自动推断 Schema 并读取 CSV 文件为虚拟表', category: 'table' },
  { name: 'read_parquet', signature: "read_parquet('file.parquet')", description: '读取单个或多个 Parquet 文件为虚拟表', category: 'table' },
  { name: 'read_json_auto', signature: "read_json_auto('file.json')", description: '自动解析并读取 JSON / NDJSON 文件', category: 'table' },
  { name: 'read_ndjson', signature: "read_ndjson('file.ndjson')", description: '按行读取换行分隔的 NDJSON 文件', category: 'table' },
  { name: 'range', signature: 'range(start, stop [, step])', description: '生成等差数值序列虚拟表（类比 generate_series）', category: 'table' },
  { name: 'generate_series', signature: 'generate_series(start, stop [, step])', description: '生成数值或日期时间序列', category: 'table' },
  
  // Aggregates
  { name: 'COUNT', signature: 'COUNT(expression | *)', description: '计算行数或非空表达式计数', category: 'aggregate' },
  { name: 'SUM', signature: 'SUM(expression)', description: '计算数值列的总和', category: 'aggregate' },
  { name: 'AVG', signature: 'AVG(expression)', description: '计算数值列的算术平均值', category: 'aggregate' },
  { name: 'MIN', signature: 'MIN(expression)', description: '计算列的最小值', category: 'aggregate' },
  { name: 'MAX', signature: 'MAX(expression)', description: '计算列的最大值', category: 'aggregate' },
  { name: 'STRING_AGG', signature: "STRING_AGG(expression, ',')", description: '将组内字符串按指定分隔符拼接', category: 'aggregate' },
  { name: 'ARRAY_AGG', signature: 'ARRAY_AGG(expression)', description: '将组内元素聚合为列表（List）', category: 'aggregate' },

  // Window functions
  { name: 'ROW_NUMBER', signature: 'ROW_NUMBER() OVER (...)', description: '为窗口分区内的每一行分配从 1 开始的连续序号', category: 'window' },
  { name: 'RANK', signature: 'RANK() OVER (...)', description: '窗口排名，存在并列时产生间隙', category: 'window' },
  { name: 'DENSE_RANK', signature: 'DENSE_RANK() OVER (...)', description: '窗口密集排名，存在并列时不产生间隙', category: 'window' },
  { name: 'LAG', signature: 'LAG(expression [, offset [, default]])', description: '获取窗口分区中当前行之前指定偏移行的值', category: 'window' },
  { name: 'LEAD', signature: 'LEAD(expression [, offset [, default]])', description: '获取窗口分区中当前行之后指定偏移行的值', category: 'window' },

  // Date/Time
  { name: 'current_date', signature: 'current_date', description: '获取当前日期 (DATE)', category: 'date' },
  { name: 'current_timestamp', signature: 'current_timestamp', description: '获取当前时间戳 (TIMESTAMP WITH TIME ZONE)', category: 'date' },
  { name: 'date_trunc', signature: "date_trunc('part', timestamp)", description: '截断日期/时间至指定精度（year, month, day, hour 等）', category: 'date' },
  { name: 'date_diff', signature: "date_diff('part', start_date, end_date)", description: '计算两个时间点之间的单位差值', category: 'date' },
  { name: 'strftime', signature: "strftime(date, '%Y-%m-%d')", description: '按指定格式将日期时间转换为字符串', category: 'date' },

  // String & Math
  { name: 'coalesce', signature: 'coalesce(val1, val2, ...)', description: '返回参数列表中首个非空 (NOT NULL) 的值', category: 'general' },
  { name: 'nullif', signature: 'nullif(a, b)', description: '如果 a == b 则返回 NULL，否则返回 a', category: 'general' },
  { name: 'round', signature: 'round(number [, decimals])', description: '四舍五入数值至指定小数位数', category: 'math' },
  { name: 'concat', signature: 'concat(str1, str2, ...)', description: '拼接多个字符串', category: 'string' },
  { name: 'lower', signature: 'lower(string)', description: '将字符串转为全小写', category: 'string' },
  { name: 'upper', signature: 'upper(string)', description: '将字符串转为全大写', category: 'string' },
  { name: 'regexp_matches', signature: "regexp_matches(string, 'pattern')", description: '正则表达式匹配检测', category: 'string' },
  { name: 'typeof', signature: 'typeof(expression)', description: '返回表达式或字段的 DuckDB 内部类型字符串', category: 'general' },
];

export const SQL_KEYWORDS_LIST: string[] = [
  'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'OFFSET',
  'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'FULL OUTER JOIN', 'CROSS JOIN',
  'ON', 'USING', 'AS', 'WITH', 'UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT',
  'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'ILIKE', 'SIMILAR TO',
  'IS NULL', 'IS NOT NULL', 'DISTINCT', 'ALL',
  'OVER', 'PARTITION BY', 'ROWS BETWEEN', 'RANGE BETWEEN',
  'CREATE TABLE', 'CREATE OR REPLACE TABLE', 'CREATE VIEW', 'CREATE OR REPLACE VIEW',
  'CREATE TEMPORARY TABLE', 'DROP TABLE', 'DROP VIEW', 'ALTER TABLE',
  'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'TRUNCATE',
  'SUMMARIZE', 'PIVOT', 'UNPIVOT', 'QUALIFY', 'SAMPLE', 'DESCRIBE', 'EXPLAIN', 'PRAGMA',
];

// ============================================================================
// 2. Query Analysis & Context Extraction
// ============================================================================

const SQL_CLAUSE_KEYWORDS = new Set([
  'as', 'join', 'left', 'right', 'inner', 'outer', 'cross', 'natural', 'full',
  'where', 'group', 'order', 'limit', 'offset', 'on', 'using', 'union', 'select',
  'and', 'or', 'set', 'by', 'having', 'with', 'from', 'table', 'values', 'into'
]);

/**
 * Parses table aliases declared in current SQL string.
 * Supports:
 *   - FROM users u
 *   - FROM users AS u
 *   - JOIN orders o ON ...
 *   - WITH cte AS (...)
 */
export function extractTableAliases(sqlText: string): Record<string, string> {
  const aliases: Record<string, string> = {};

  // 1. CTE expressions: WITH cte_name AS (...)
  const cteRegex = /\bwith\s+([a-zA-Z0-9_]+)\s+as\s*\(/gi;
  let match: RegExpExecArray | null;
  while ((match = cteRegex.exec(sqlText)) !== null) {
    const cte = match[1].toLowerCase();
    aliases[cte] = cte;
  }

  // 2. FROM / JOIN table [AS] alias
  const aliasRegex = /\b(?:from|join)\s+([a-zA-Z0-9_.]+)(?:\s+as)?\s+([a-zA-Z0-9_]+)/gi;
  while ((match = aliasRegex.exec(sqlText)) !== null) {
    const table = match[1];
    const alias = match[2].toLowerCase();
    if (!SQL_CLAUSE_KEYWORDS.has(alias)) {
      aliases[alias] = table;
    }
  }

  return aliases;
}

/**
 * Extracts all table names referenced in FROM or JOIN clauses of the query.
 */
export function extractReferencedTables(sqlText: string): string[] {
  const tables = new Set<string>();
  const tableRegex = /\b(?:from|join|into|update)\s+([a-zA-Z0-9_.]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = tableRegex.exec(sqlText)) !== null) {
    const rawName = match[1].replace(/["`]/g, '');
    // Exclude table-valued functions
    const lower = rawName.toLowerCase();
    if (!lower.startsWith('read_') && lower !== 'range' && lower !== 'generate_series') {
      tables.add(rawName);
      // Also add schema-stripped name if "memory.my_table"
      const dot = rawName.indexOf('.');
      if (dot !== -1) {
        tables.add(rawName.substring(dot + 1));
      }
    }
  }
  return Array.from(tables);
}

/**
 * Checks if the position immediately precedes a table name (after FROM, JOIN, INTO, etc.)
 */
export function isTableContext(textBeforeCursor: string): boolean {
  return /\b(?:from|join|inner\s+join|left\s+join|right\s+join|full\s+join|cross\s+join|into|update|table|truncate|describe|summarize|from\s+only)\s+([a-zA-Z0-9_]*)$/i.test(textBeforeCursor);
}

/**
 * Resolves an identifier (could be alias, table name, or schema-prefixed name)
 * to an entry in schemaTree.
 */
export function resolveTableKey(
  identifier: string,
  aliases: Record<string, string>,
  schemaTree: SchemaTree
): string | null {
  const lowerIdent = identifier.toLowerCase();
  
  // 1. Check if identifier is an alias
  const mapped = aliases[lowerIdent];
  const targetName = (mapped || identifier).toLowerCase();

  // 2. Direct match or dot-suffix match in schemaTree
  const keys = Object.keys(schemaTree);
  for (const k of keys) {
    const kLower = k.toLowerCase();
    if (kLower === targetName) return k;
    if (kLower.endsWith('.' + targetName)) return k;
    const dotIdx = kLower.indexOf('.');
    if (dotIdx !== -1 && kLower.substring(dotIdx + 1) === targetName) return k;
  }

  return null;
}

// ============================================================================
// 3. CodeMirror 6 Completion Source
// ============================================================================

/**
 * Builds a context-intelligent, schema-aware CodeMirror 6 CompletionSource.
 */
export function createSqlCompletionSource(getSchemaTree: () => SchemaTree): CompletionSource {
  return async (context: CompletionContext): Promise<CompletionResult | null> => {
    const schemaTree = getSchemaTree();
    const doc = context.state.doc;
    const pos = context.pos;
    const line = doc.lineAt(pos);
    const textBeforeCursor = line.text.slice(0, pos - line.from);
    const fullSql = doc.toString();

    // ────────────────────────────────────────────────────────────────────────
    // CASE A: Dotted Identifier (<table_or_alias>.<column_prefix>)
    // ────────────────────────────────────────────────────────────────────────
    const dottedMatch = textBeforeCursor.match(/([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]*)$/);
    if (dottedMatch) {
      const identifier = dottedMatch[1];
      const columnPrefix = dottedMatch[2];
      const fromPos = pos - columnPrefix.length;

      const aliases = extractTableAliases(fullSql);
      const matchedTableKey = resolveTableKey(identifier, aliases, schemaTree);

      if (matchedTableKey && schemaTree[matchedTableKey]) {
        const columns = schemaTree[matchedTableKey];
        const options: Completion[] = columns.map((col, idx) => ({
          label: col.name,
          type: 'property', // Styled with green [COL] badge in sqlAutocompleteTheme
          detail: col.type,
          boost: 100 - idx * 0.1, // Highest priority
          info: `表: ${matchedTableKey}\n字段: ${col.name}\n类型: ${col.type}${col.pk ? ' (主键)' : ''}${col.nullable === false ? ' (NOT NULL)' : ''}`,
        }));

        return {
          from: fromPos,
          to: pos,
          options,
          validFor: /^[a-zA-Z0-9_]*$/,
        };
      }

      // If identifier didn't match a table, check if identifier is a schema (e.g. "main.")
      const schemaTables = Object.keys(schemaTree).filter(t =>
        t.toLowerCase().startsWith(identifier.toLowerCase() + '.')
      );
      if (schemaTables.length > 0) {
        const options: Completion[] = schemaTables.map(t => {
          const shortName = t.split('.').slice(1).join('.');
          return {
            label: shortName,
            type: 'class', // Styled with cyan [TBL] badge
            detail: 'TABLE',
            boost: 90,
            info: `Schema: ${identifier}\n表名: ${shortName}`,
          };
        });
        return {
          from: fromPos,
          to: pos,
          options,
          validFor: /^[a-zA-Z0-9_]*$/,
        };
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // CASE B: Standard Word Matching & Context Inference
    // ────────────────────────────────────────────────────────────────────────
    const word = context.matchBefore(/[a-zA-Z0-9_]+/);
    // Trigger if explicit or word length >= 1
    if (!word && !context.explicit) {
      return null;
    }

    const fromPos = word ? word.from : pos;
    const isAfterTableKeyword = isTableContext(textBeforeCursor);
    const referencedTables = extractReferencedTables(fullSql);
    const tableKeys = Object.keys(schemaTree);

    const options: Completion[] = [];

    // 1. Table suggestions
    for (const tableKey of tableKeys) {
      const cols = schemaTree[tableKey] || [];
      const colSummary = cols.slice(0, 5).map(c => `${c.name} (${c.type})`).join(', ');
      const extra = cols.length > 5 ? ` 等 ${cols.length} 个字段` : '';

      options.push({
        label: tableKey,
        type: 'class', // [TBL]
        detail: 'TABLE',
        boost: isAfterTableKeyword ? 95 : 25, // Strong boost when after FROM/JOIN
        info: `表名: ${tableKey}\n字段数量: ${cols.length}\n结构: ${colSummary || '无字段'}${extra}`,
      });

      // Also suggest schema-stripped table name if prefixed (e.g. "my_table" for "memory.my_table")
      const dotIdx = tableKey.indexOf('.');
      if (dotIdx !== -1) {
        const shortName = tableKey.substring(dotIdx + 1);
        options.push({
          label: shortName,
          type: 'class',
          detail: 'TABLE',
          boost: isAfterTableKeyword ? 94 : 24,
          info: `表名: ${tableKey} (简写: ${shortName})\n字段数量: ${cols.length}\n结构: ${colSummary || '无字段'}${extra}`,
        });
      }
    }

    // 2. Table-valued functions (boosted in table context)
    for (const fn of DUCKDB_BUILTIN_FUNCTIONS) {
      if (fn.category === 'table') {
        options.push({
          label: fn.name,
          type: 'function',
          detail: 'TABLE FUNC',
          boost: isAfterTableKeyword ? 85 : 35,
          info: `${fn.signature}\n\n${fn.description}`,
        });
      }
    }

    // 3. Column suggestions (boosted if not in table context, especially for referenced tables)
    if (!isAfterTableKeyword) {
      const addedCols = new Set<string>();

      // First: Columns from explicitly referenced tables in the query (highest expression priority)
      for (const refTable of referencedTables) {
        const aliases = extractTableAliases(fullSql);
        const resolvedKey = resolveTableKey(refTable, aliases, schemaTree);
        if (resolvedKey && schemaTree[resolvedKey]) {
          for (const col of schemaTree[resolvedKey]) {
            const key = `${col.name}::${col.type}`;
            if (!addedCols.has(key)) {
              addedCols.add(key);
              options.push({
                label: col.name,
                type: 'property', // [COL]
                detail: `${col.type} · ${resolvedKey}`,
                boost: 65,
                info: `字段: ${col.name}\n类型: ${col.type}\n所属表: ${resolvedKey} (当前查询已引用)`,
              });
            }
          }
        }
      }

      // Second: Columns across all other tables in database
      for (const tableKey of tableKeys) {
        for (const col of schemaTree[tableKey] || []) {
          const key = `${col.name}::${col.type}`;
          if (!addedCols.has(key)) {
            addedCols.add(key);
            options.push({
              label: col.name,
              type: 'property',
              detail: col.type,
              boost: 20,
              info: `字段: ${col.name}\n类型: ${col.type}\n所属表: ${tableKey}`,
            });
          }
        }
      }
    }

    // 4. Built-in SQL functions
    for (const fn of DUCKDB_BUILTIN_FUNCTIONS) {
      if (fn.category !== 'table') {
        options.push({
          label: fn.name,
          type: 'function',
          detail: 'FUNC',
          boost: isAfterTableKeyword ? 10 : 45,
          info: `${fn.signature}\n\n${fn.description}`,
        });
      }
    }

    // 5. SQL Keywords
    for (const kw of SQL_KEYWORDS_LIST) {
      options.push({
        label: kw,
        type: 'keyword',
        detail: 'KEYWORD',
        boost: isAfterTableKeyword ? 15 : 30,
      });
    }

    return {
      from: fromPos,
      to: pos,
      options,
      validFor: /^[a-zA-Z0-9_]*$/,
    };
  };
}

// ============================================================================
// 4. Live Schema Cache & Synchronization Provider
// ============================================================================

class SqlSchemaCache {
  private schemaTree: SchemaTree = {};
  private listeners: Set<(tree: SchemaTree) => void> = new Set();
  private isFetching = false;
  private isInitialized = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('duckdb-schema-changed', () => {
        void this.refreshSchema();
      });
    }
  }

  getSchema(): SchemaTree {
    return this.schemaTree;
  }

  setSchema(tree: SchemaTree) {
    this.schemaTree = tree;
    this.notify();
  }

  subscribe(fn: (tree: SchemaTree) => void): () => void {
    this.listeners.add(fn);
    if (this.isInitialized) {
      fn(this.schemaTree);
    } else {
      void this.refreshSchema();
    }
    return () => this.listeners.delete(fn);
  }

  private notify() {
    for (const fn of this.listeners) {
      try { fn(this.schemaTree); } catch (e) { console.error(e); }
    }
  }

  async refreshSchema(): Promise<SchemaTree> {
    if (this.isFetching) return this.schemaTree;
    this.isFetching = true;

    try {
      const tree: SchemaTree = {};

      // Approach 1: Fast batch query on information_schema.columns
      try {
        const rows = await duckDBService.query(`
          SELECT table_name, column_name, data_type, is_nullable
          FROM information_schema.columns 
          WHERE table_schema = current_schema()
          ORDER BY table_name, ordinal_position
        `);

        if (rows && rows.length > 0) {
          for (const r of rows) {
            const tbl = String(r.table_name || '');
            if (!tbl || tbl.startsWith('_sys_')) continue;
            if (!tree[tbl]) tree[tbl] = [];
            tree[tbl].push({
              name: String(r.column_name || ''),
              type: String(r.data_type || 'VARCHAR').toUpperCase(),
              nullable: r.is_nullable === 'YES',
            });
          }
          this.schemaTree = tree;
          this.isInitialized = true;
          this.notify();
          return tree;
        }
      } catch {
        // Fallback below
      }

      // Approach 2: Table-by-table inspection via getTables & getTableSchema
      const tables = await duckDBService.getTables();
      for (const t of tables) {
        if (t.startsWith('_sys_')) continue;
        try {
          const cols = await duckDBService.getTableSchema(t);
          tree[t] = cols.map((c: any) => ({
            name: c.name || String(c),
            type: (c.type || 'VARCHAR').toUpperCase(),
            pk: Boolean(c.pk),
            nullable: c.notnull === 0 || c.nullable === true,
          }));
        } catch {
          tree[t] = [];
        }
      }

      this.schemaTree = tree;
      this.isInitialized = true;
      this.notify();
      return tree;
    } catch (e) {
      console.warn('[sqlCompletionEngine] Failed to refresh schema:', e);
      return this.schemaTree;
    } finally {
      this.isFetching = false;
    }
  }
}

export const sqlSchemaCache = new SqlSchemaCache();
