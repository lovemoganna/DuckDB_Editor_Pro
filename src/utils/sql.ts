/**
 * SQL Utility Helpers — Pure functions, no React/D3 dependencies.
 */

/**
 * Basic SQL formatter: adds line breaks and indentation for major keywords.
 */
export function formatSql(sql: string): string {
  const keywords = [
    'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'ORDER BY', 'GROUP BY',
    'HAVING', 'LIMIT', 'OFFSET', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN',
    'INNER JOIN', 'FULL JOIN', 'CROSS JOIN', 'ON', 'AS', 'SET',
    'INSERT INTO', 'VALUES', 'UPDATE', 'DELETE FROM', 'CREATE TABLE',
    'ALTER TABLE', 'DROP TABLE', 'WITH', 'UNION', 'UNION ALL',
    'EXCEPT', 'INTERSECT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  ];

  let result = sql.trim();
  let indent = 0;
  const indentStr = '  ';

  // Normalize whitespace first
  result = result.replace(/\s+/g, ' ').trim();

  // Split on major keywords (case-insensitive) for line breaks
  const pattern = keywords.map(k => `\\b${k}\\b`).join('|');
  result = result.replace(new RegExp(`\\b(${pattern})\\b`, 'gi'), '\n$&');

  // Apply indentation
  const lines = result.split('\n').map(line => {
    const trimmed = line.trim();
    const upper = trimmed.toUpperCase();

    if (upper.startsWith('END') || upper.startsWith('ELSE') || upper.startsWith('WHEN')) {
      indent = Math.max(0, indent - 1);
    }

    const indented = indentStr.repeat(indent) + trimmed;

    if (upper.startsWith('SELECT') || upper.startsWith('WITH') || upper.startsWith('CASE') ||
        upper.startsWith('WHERE') || upper.startsWith('AND') || upper.startsWith('OR') ||
        upper.startsWith('JOIN') || upper.startsWith('SET') || upper.startsWith('VALUES') ||
        upper.startsWith('WHEN') || upper.startsWith('THEN')) {
      indent++;
    }

    return indented;
  });

  return lines.join('\n');
}

/**
 * Quote a SQL identifier (table name, column name) using double quotes.
 * Handles identifiers that already contain quotes (escape by doubling).
 */
export function escapeSqlIdentifier(name: string): string {
  if (!name) return '""';
  const escaped = String(name).replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Build a SQL WHERE clause from a conditions object.
 * Values are parameterized to prevent SQL injection.
 *
 * @example
 * buildWhereClause({ status: 'active', age: 30 })
 * // => { clause: '"status" = $1 AND "age" = $2', values: ['active', 30] }
 */
export function buildWhereClause(
  conditions: Record<string, any>
): { clause: string; values: any[] } {
  const entries = Object.entries(conditions).filter(([, v]) => v !== undefined && v !== null);
  if (entries.length === 0) {
    return { clause: '', values: [] };
  }

  const values: any[] = [];
  const parts: string[] = [];

  entries.forEach(([key, value], i) => {
    const paramIndex = i + 1;
    parts.push(`${escapeSqlIdentifier(key)} = $${paramIndex}`);
    values.push(value);
  });

  return {
    clause: parts.join(' AND '),
    values,
  };
}

/**
 * Format a list of column names as a comma-separated string of quoted identifiers.
 */
export function quoteColumnList(columns: string[]): string {
  return columns.map(escapeSqlIdentifier).join(', ');
}

/**
 * Build a SELECT list from column names or return '*'.
 */
export function buildSelectList(columns?: string[]): string {
  if (!columns || columns.length === 0) return '*';
  return quoteColumnList(columns);
}

/**
 * Validate that a string looks like a safe SQL identifier (alphanumeric + underscore only).
 */
export function isValidIdentifier(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

/**
 * Clamp a numeric value to the 0–1 range.
 */
export function clampWeight(w: number): number {
  return Math.max(0, Math.min(1, Number(w) || 0));
}
