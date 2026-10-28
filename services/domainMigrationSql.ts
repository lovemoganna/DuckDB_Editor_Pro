import { quoteIdent } from './databaseCatalog';

/** Rebind source catalog identifiers, preserving SQL strings and comments verbatim. */
export function rebindDomainSql(sql: string, source: string, target: string): string {
  const tokens = sql.match(/'(?:''|[^'])*'|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/|"(?:""|[^"])*"|[A-Za-z_][\w]*|\s+|./g) || [];
  return tokens.map((token, index) => {
    const identifier = token.startsWith('"') ? token.slice(1, -1).replace(/""/g, '"') : token;
    if (identifier.toLowerCase() !== source.toLowerCase()) return token;
    let next = index + 1;
    while (next < tokens.length && /^(?:\s+|--|\/\*)/.test(tokens[next])) next += 1;
    return tokens[next] === '.' ? quoteIdent(target) : token;
  }).join('');
}
