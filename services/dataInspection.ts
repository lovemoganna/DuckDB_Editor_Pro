import { duckDBService } from './duckdbService';
import { quoteIdent, escapeLiteral } from './analysis/sqlUtils';

export type InspectionState = 'not_checked' | 'passed' | 'issues' | 'failed' | 'unavailable';
export interface InspectionRule {
  name: string; object: string; sql: string; status: InspectionState;
  failures?: number; evidence?: Record<string, unknown>[]; error?: string;
}
export interface DataInspection {
  catalog: string; schema: string; table: string; checkedAt: number;
  status: InspectionState; rules: InspectionRule[]; constraints: string[]; error?: string;
}

/** Fully qualified queries prevent catalog changes from mixing snapshots. */
export async function inspectData(table: string, options: { uniqueColumn?: string } = {}): Promise<DataInspection> {
  const scope = await duckDBService.getCurrentCatalogAndSchema();
  const source = [scope.catalog, scope.schema, table].map(quoteIdent).join('.');
  const result: DataInspection = { ...scope, table, checkedAt: Date.now(), status: 'not_checked', rules: [], constraints: [] };
  try {
    const columns = await duckDBService.getTableSchema(table);
    if (!columns.length) return { ...result, status: 'unavailable', error: '字段元数据不可用' };
    const constraints = await duckDBService.readQuery(`SELECT constraint_type, to_json(constraint_column_names) AS constraint_column_names,
      referenced_table, to_json(referenced_column_names) AS referenced_column_names FROM duckdb_constraints()
      WHERE database_name='${escapeLiteral(scope.catalog)}' AND schema_name='${escapeLiteral(scope.schema)}'
      AND table_name='${escapeLiteral(table)}'`);
    result.constraints = constraints.map(row => String(row.constraint_type));
    const run = async (name: string, object: string, evidenceSql: string) => {
      const rule: InspectionRule = { name, object, sql: evidenceSql, status: 'not_checked' };
      result.rules.push(rule);
      try {
        const counts = await duckDBService.readQuery(`SELECT COUNT(*) AS failures FROM (${evidenceSql}) AS violations`);
        if (counts[0]?.failures == null) throw new Error('检查未返回失败数量');
        rule.failures = Number(counts[0].failures);
        rule.status = rule.failures > 0 ? 'issues' : 'passed';
        rule.evidence = rule.failures ? await duckDBService.readQuery(`${evidenceSql} LIMIT 20`) : [];
      } catch (error) { rule.status = 'failed'; rule.error = String((error as Error).message); }
    };
    for (const column of columns.filter(column => column.notnull || column.pk)) {
      await run('非空约束', column.name, `SELECT * FROM ${source} WHERE ${quoteIdent(column.name)} IS NULL`);
    }
    for (const constraint of constraints) {
      const names = Array.isArray(constraint.constraint_column_names) ? constraint.constraint_column_names as string[]
        : JSON.parse(String(constraint.constraint_column_names || '[]')) as string[];
      if (!Array.isArray(names) || !names.length) continue;
      const keys = names.map(quoteIdent).join(', ');
      if (['PRIMARY KEY', 'UNIQUE'].includes(String(constraint.constraint_type))) {
        const present = names.map(name => `${quoteIdent(name)} IS NOT NULL`).join(' AND ');
        await run('唯一约束', names.join(', '), `SELECT ${keys}, COUNT(*) AS occurrences FROM ${source} WHERE ${present} GROUP BY ${keys} HAVING COUNT(*) > 1`);
      }
      if (constraint.constraint_type === 'FOREIGN KEY') {
        const targetColumns = Array.isArray(constraint.referenced_column_names) ? constraint.referenced_column_names as string[]
          : JSON.parse(String(constraint.referenced_column_names || '[]')) as string[];
        if (!Array.isArray(targetColumns) || names.length !== targetColumns.length) {
          result.rules.push({ name: '外键约束', object: names.join(', '), sql: '', status: 'unavailable', error: '关联字段元数据不完整' });
          continue;
        }
        const target = [scope.catalog, scope.schema, String(constraint.referenced_table)].map(quoteIdent).join('.');
        const join = names.map((name, i) => `s.${quoteIdent(name)} = t.${quoteIdent(targetColumns[i])}`).join(' AND ');
        const present = names.map(name => `s.${quoteIdent(name)} IS NOT NULL`).join(' AND ');
        await run('外键约束', `${table} → ${constraint.referenced_table}`, `SELECT s.* FROM ${source} s WHERE ${present} AND NOT EXISTS (SELECT 1 FROM ${target} t WHERE ${join})`);
      }
    }
    if (options.uniqueColumn) {
      if (!columns.some(column => column.name === options.uniqueColumn)) throw new Error('选择的检查字段已不存在');
      const key = quoteIdent(options.uniqueColumn);
      await run('用户选择的唯一性规则', options.uniqueColumn, `SELECT ${key}, COUNT(*) AS occurrences FROM ${source} WHERE ${key} IS NOT NULL GROUP BY ${key} HAVING COUNT(*) > 1`);
    }
    // Nullable fields are observations, never implicit violations.
    const nullColumns = columns.map(column => `COUNT(*) - COUNT(${quoteIdent(column.name)}) AS ${quoteIdent(column.name)}`).join(', ');
    const sql = `SELECT ${nullColumns} FROM ${source}`;
    try {
      const evidence = await duckDBService.readQuery(sql);
      result.rules.push({ name: '字段空值数量（观察）', object: table, sql, status: 'passed', evidence });
    } catch (error) { result.rules.push({ name: '字段空值数量（观察）', object: table, sql, status: 'failed', error: String((error as Error).message) }); }
    result.status = result.rules.some(rule => rule.status === 'issues') ? 'issues'
      : result.rules.some(rule => rule.status === 'failed') ? 'failed'
      : result.rules.some(rule => rule.status === 'unavailable') ? 'unavailable' : 'passed';
  } catch (error) { result.status = 'unavailable'; result.error = String((error as Error).message); }
  return result;
}
