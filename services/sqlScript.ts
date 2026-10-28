/** Strip interleaved whitespace and comments, including separated dump headers. */
export function stripSqlHeader(sql: string): string {
  return sql.replace(/^(?:\s+|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*\s*/, '').trim();
}
