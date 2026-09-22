/**
 * sqlContextBuilder — Build schema-aware context strings for AI prompts
 *
 * Extracted from SqlEditor.tsx (Loop 3 of SqlEditor Pro refactor).
 *
 * Before: the same `for (const t of tables) { cols = getSchema; append ... }`
 * pattern was duplicated 4 times in SqlEditor.tsx.
 * After: one helper `buildSchemaContext()` used by all AI calls.
 */

/**
 * Build a multi-line schema description for AI prompts.
 *
 * Format:
 * ```
 * Table users: [id (BIGINT), name (VARCHAR), ...]
 * Table orders: [id (BIGINT), user_id (BIGINT), total (DOUBLE), ...]
 * ```
 */
import { duckDBService } from './duckdbService';
import { SchemaRagEngine, SchemaTreeContext } from './schemaRagEngine';

interface LoadedSchema {
  table: string;
  columns: Awaited<ReturnType<typeof duckDBService.getTableSchema>>;
}

async function loadTableSchemas(tables: readonly string[]): Promise<LoadedSchema[]> {
  const settled = await Promise.allSettled(
    tables.map(async table => ({
      table,
      columns: await duckDBService.getTableSchema(table),
    })),
  );

  return settled.flatMap(result =>
    result.status === 'fulfilled' ? [result.value] : [],
  );
}

/**
 * Build a multi-line schema description for AI prompts with Schema RAG Top-K Context Pruning.
 *
 * Format:
 * ```
 * Table users: [id (BIGINT), name (VARCHAR), ...]
 * Table orders: [id (BIGINT), user_id (BIGINT), total (DOUBLE), ...]
 * ```
 */
export async function buildSchemaContext(userQuery: string = '', topK: number = 5): Promise<string> {
  const tables = await duckDBService.getTables();
  const rawSchemaTree: SchemaTreeContext = {};

  for (const { table, columns } of await loadTableSchemas(tables)) {
    rawSchemaTree[table] = columns.map(c => ({ name: c.name, type: c.type }));
  }

  // Perform Context Pruning (RAG Top-K filtering)
  const prunedSchemaTree = SchemaRagEngine.pruneSchema(rawSchemaTree, userQuery, topK);

  const lines: string[] = [];
  for (const t of Object.keys(prunedSchemaTree)) {
    const cols = prunedSchemaTree[t];
    const colStr = cols.map((c) => `${c.name} (${c.type})`).join(', ');
    lines.push(`Table ${t}: [${colStr}]`);
  }
  return lines.join('\n');
}


/**
 * Build a minimal schema context that only lists table names + primary
 * column types. Useful for prompts where token budget matters.
 */
export async function buildMinimalSchemaContext(): Promise<string> {
  const tables = await duckDBService.getTables();
  const schemas = await loadTableSchemas(tables);
  return schemas
    .map(({ table, columns }) => `${table}: [${columns.map(column => column.name).join(', ')}]`)
    .join('\n');
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

/**
 * Option D Optimization: Schema Context RAG (Retrieval-Augmented Generation)
 * Performs semantic relevance ranking over database schemas based on user query tokens.
 * Limits Token overhead for AI Prompts while providing pin-point relevant tables.
 */
export async function buildRelevantSchemaContext(
  query: string,
  maxTables = 5
): Promise<string> {
  const tables = await duckDBService.getTables();
  if (tables.length === 0) return '';

  const terms = query
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);

  const scoredTables: Array<{ tableName: string; score: number; colStr: string }> = [];

  for (const { table, columns } of await loadTableSchemas(tables)) {
    const colNames = columns.map((column) => column.name.toLowerCase());
    const colStr = columns.map((column) => `${column.name} (${column.type})`).join(', ');

    let score = 0;
    const lowerTableName = table.toLowerCase();

    // Score matching
    terms.forEach((term) => {
      if (lowerTableName.includes(term)) score += 5;
      colNames.forEach((colName) => {
        if (colName.includes(term)) score += 2;
      });
    });

    scoredTables.push({ tableName: table, score, colStr });
  }

  // Sort by relevance score descending, fallback to top tables if score is zero
  scoredTables.sort((a, b) => b.score - a.score);
  const selected = scoredTables.slice(0, Math.min(maxTables, scoredTables.length));

  return selected.map((s) => `Table ${s.tableName}: [${s.colStr}]`).join('\n');
}
