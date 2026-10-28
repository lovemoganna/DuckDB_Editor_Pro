// --- Ontology Icons Helper ---
export const getTypeIcon = (type: string) => {
    const t = type.toUpperCase();
    if (t.includes('INT') || t.includes('FLOAT') || t.includes('DOUBLE') || t.includes('DECIMAL') || t.includes('NUMERIC')) return 'INT';
    if (t.includes('CHAR') || t.includes('TEXT') || t.includes('STRING') || t.includes('VARCHAR')) return 'TXT';
    if (t.includes('DATE') || t.includes('TIME')) return 'TIME';
    if (t.includes('BOOL')) return 'BOOL';
    if (t.includes('LIST') || t.includes('ARRAY')) return 'ARR';
    if (t.includes('STRUCT') || t.includes('MAP')) return 'MAP';
    if (t.includes('JSON')) return 'JSON';
    if (t.includes('BLOB') || t.includes('BYTE')) return 'BLOB';
    return 'VAL';
};

// --- SQL Syntax Highlighting Utility ---
// Monokai theme: amethyst for keywords, cyan for functions, green for strings, orange for numbers, gray for comments

const SQL_KEYWORDS = [
    'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN',
    'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL', 'CROSS', 'ON',
    'GROUP', 'BY', 'HAVING', 'ORDER', 'ASC', 'DESC', 'LIMIT', 'OFFSET',
    'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'DROP',
    'ALTER', 'TABLE', 'VIEW', 'INDEX', 'AS', 'DISTINCT', 'COUNT', 'SUM',
    'AVG', 'MIN', 'MAX', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'NULL',
    'IS', 'TRUE', 'FALSE', 'WITH', 'RECURSIVE', 'OVER', 'PARTITION',
    'PIVOT', 'UNPIVOT', 'UNION', 'ALL', 'EXCEPT', 'INTERSECT', 'CAST',
    'COALESCE', 'NULLIF', 'EXTRACT', 'DATE_TRUNC', 'DATE_ADD', 'DATEDIFF',
    'STRFTIME', 'REGEXP_EXTRACT', 'REPLACE', 'SUBSTRING', 'CONCAT', 'TRIM',
    'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'LAG', 'LEAD', 'FIRST_VALUE', 'LAST_VALUE',
    'SUMMARIZE', 'DESCRIBE', 'COPY', 'TO', 'GENERATE_SERIES',
    'MATERIALIZED', 'BEGIN', 'COMMIT', 'ROLLBACK', 'TRANSACTION',
    'NATURAL', 'USING', 'EXISTS', 'ANY', 'SOME', 'ILIKE',
    'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'CONSTRAINT', 'UNIQUE',
    'DEFAULT', 'CHECK', 'CASCADE', 'RESTRICT'
];

const SQL_FUNCTIONS = [
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'NULLIF', 'EXTRACT',
    'DATE_TRUNC', 'DATE_ADD', 'DATEDIFF', 'STRFTIME', 'REGEXP_EXTRACT',
    'REGEXP_MATCHES', 'REPLACE', 'SUBSTRING', 'CONCAT', 'CONCAT_WS', 'TRIM',
    'LTRIM', 'RTRIM', 'UPPER', 'LOWER', 'LENGTH', 'REVERSE', 'SPLIT',
    'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'NTILE', 'LAG', 'LEAD', 
    'FIRST_VALUE', 'LAST_VALUE', 'NTH_VALUE', 'SUMMARIZE', 'MODE',
    'LIST', 'STRUCT', 'MAP', 'ARRAY', 'UNNEST', 'FLATTEN',
    'TO_DATE', 'TO_TIMESTAMP', 'CURRENT_DATE', 'CURRENT_TIMESTAMP',
    'NOW', 'INTERVAL', 'AGE', 'DATE_PART', 'TYPEOF'
];

/**
 * Highlights SQL syntax with Monokai theme colors
 * @param sql - Raw SQL string to highlight
 * @returns HTML string with syntax highlighting spans
 */
export const highlightSql = (sql: string): string => {
    if (!sql) return '';
    const keywords = new Set(SQL_KEYWORDS);
    const functions = new Set(SQL_FUNCTIONS);
    const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    // Tokenize the raw source once. Generated markup never re-enters the lexer.
    const tokens = /--[^\n]*|\/\*[\s\S]*?(?:\*\/|$)|'(?:''|[^'])*(?:'|$)|"(?:""|[^"])*(?:"|$)|\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|[A-Za-z_][A-Za-z_0-9$]*|[\s\S]/g;
    return Array.from(sql.matchAll(tokens), match => {
        const token = match[0];
        const upper = token.toUpperCase();
        const tone = token.startsWith('--') || token.startsWith('/*') ? 'comment'
            : token.startsWith("'") ? 'string'
            : token.startsWith('"') ? 'identifier'
            : /^\d/.test(token) ? 'number'
            : functions.has(upper) && /^\s*\(/.test(sql.slice((match.index ?? 0) + token.length)) ? 'function'
            : keywords.has(upper) ? 'keyword' : null;
        return tone ? `<span class="sql-${tone}">${escape(token)}</span>` : escape(token);
    }).join('');
};

/**
 * Renders SQL with syntax highlighting as JSX
 * @param sql - Raw SQL string
 * @param className - Additional CSS classes
 * @returns JSX element with syntax highlighting
 */
export const renderSqlHighlighted = (sql: string, className: string = ''): React.ReactNode => {
    return (
        <pre 
            className={`sql-highlight-container ${className}`}
            dangerouslySetInnerHTML={{ __html: highlightSql(sql) }}
        />
    );
};
