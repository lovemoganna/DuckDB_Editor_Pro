/**
 * sqlContextBuilder — Build schema-aware context strings for AI prompts
 *
 * Extracted from SqlEditor.tsx (Loop 3 of SqlEditor Pro refactor).
 *
 * Before: the same `for (const t of tables) { cols = getSchema; append ... }`
 * pattern was duplicated 4 times in SqlEditor.tsx.
 * After: one helper `buildSchemaContext()` used by all AI calls.
 */

import { duckDBService } from './duckdbService';

/**
 * Build a multi-line schema description for AI prompts.
 *
 * Format:
 * ```
 * Table users: [id (BIGINT), name (VARCHAR), ...]
 * Table orders: [id (BIGINT), user_id (BIGINT), total (DOUBLE), ...]
 * ```
 */
export async function buildSchemaContext(): Promise<string> {
  const tables = await duckDBService.getTables();
  const lines: string[] = [];
  for (const t of tables) {
    try {
      const cols = await duckDBService.getTableSchema(t);
      const colStr = cols.map((c) => `${c.name} (${c.type})`).join(', ');
      lines.push(`Table ${t}: [${colStr}]`);
    } catch {
      // Skip tables we can't introspect (e.g. system tables); never throw.
    }
  }
  return lines.join('\n');
}

/**
 * Build a minimal schema context that only lists table names + primary
 * column types. Useful for prompts where token budget matters.
 */
export async function buildMinimalSchemaContext(): Promise<string> {
  const tables = await duckDBService.getTables();
  const lines: string[] = [];
  for (const t of tables) {
    try {
      const cols = await duckDBService.getTableSchema(t);
      const colNames = cols.map((c) => c.name).join(', ');
      lines.push(`${t}: [${colNames}]`);
    } catch {
      // skip
    }
  }
  return lines.join('\n');
}

/**
 * Build a context focused on a single table's columns. Useful when the
 * caller already knows which table is in scope (e.g. AI Fill mode).
 */
export async function buildTableContext(tableName: string): Promise<string> {
  try {
    const cols = await duckDBService.getTableSchema(tableName);
    return cols.map((c) => `${c.name} (${c.type})`).join(', ');
  } catch {
    return '';
  }
}
