import React from 'react';

const SQL_KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'GROUP', 'BY', 'ORDER',
  'LIMIT', 'OFFSET', 'WITH', 'AS', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'DELETE',
  'CREATE', 'TABLE', 'DROP', 'ALTER', 'AND', 'OR', 'NOT', 'NULL', 'IS', 'IN', 'ON',
  'UNION', 'ALL', 'DISTINCT', 'HAVING', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'SUMMARIZE'
]);

const SQL_FUNCS = new Set([
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'ROUND', 'DATE_TRUNC', 'CONCAT',
  'CAST', 'TRY_CAST', 'STRPTIME', 'STRFTIME'
]);

export const renderMonokaiSql = (sql: string, maxTokens = 32): React.ReactNode => {
  if (!sql) return <span className="text-monokai-comment">-- 无 SQL 语句</span>;
  const tokens = sql.split(/(\s+|[(),;])/);

  return (
    <span className="font-mono text-xs truncate inline-block max-w-full text-monokai-fg">
      {tokens.slice(0, maxTokens).map((token, i) => {
        const upper = token.toUpperCase();
        if (SQL_KEYWORDS.has(upper)) {
          return <span key={i} className="text-monokai-pink font-semibold">{token}</span>;
        }
        if (SQL_FUNCS.has(upper)) {
          return <span key={i} className="text-monokai-cyan font-medium">{token}</span>;
        }
        if (/^'[^']*'?$/.test(token) || /^"[^"]*"?$/.test(token)) {
          return <span key={i} className="text-monokai-yellow">{token}</span>;
        }
        if (/^\d+(\.\d+)?$/.test(token)) {
          return <span key={i} className="text-monokai-green">{token}</span>;
        }
        return <span key={i} className="text-monokai-fg">{token}</span>;
      })}
      {tokens.length > maxTokens ? <span className="text-monokai-comment"> …</span> : null}
    </span>
  );
};
