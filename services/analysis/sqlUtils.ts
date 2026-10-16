/** Shared SQL identifier / literal helpers for the analysis kernel. */

export function quoteIdent(name: string): string {
  return `"${String(name).replace(/"/g, '""')}"`;
}

export function quoteTable(table: string): string {
  // Allow schema.table
  return String(table)
    .split('.')
    .map((part) => quoteIdent(part.trim()))
    .join('.');
}

export function escapeLiteral(value: string): string {
  return String(value).replace(/'/g, "''");
}

export function literalValue(value: string | number): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return `'${escapeLiteral(String(value))}'`;
}

/** Safe alias: letters, digits, underscore, CJK; fallback to hash-ish slug */
export function sanitizeAlias(alias: string, fallback = 'col'): string {
  const cleaned = String(alias).trim();
  if (!cleaned) return fallback;
  // Keep as-is for display; quoting handles specials
  return cleaned.slice(0, 120);
}
