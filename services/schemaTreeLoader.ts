import { ColumnInfo } from '../types';

export interface SchemaLoadError {
  table: string;
  message: string;
}

export interface SchemaTreeLoadResult {
  tree: Record<string, ColumnInfo[]>;
  errors: SchemaLoadError[];
}

export async function loadSchemaTree(
  tables: readonly string[],
  loadTable: (table: string) => Promise<ColumnInfo[]>,
): Promise<SchemaTreeLoadResult> {
  const settled = await Promise.allSettled(
    tables.map(async table => ({ table, columns: await loadTable(table) })),
  );

  const tree: Record<string, ColumnInfo[]> = {};
  const errors: SchemaLoadError[] = [];

  settled.forEach((result, index) => {
    const table = tables[index];
    if (result.status === 'fulfilled') {
      tree[table] = result.value.columns;
      return;
    }

    errors.push({
      table,
      message: result.reason instanceof Error ? result.reason.message : String(result.reason),
    });
  });

  return { tree, errors };
}
