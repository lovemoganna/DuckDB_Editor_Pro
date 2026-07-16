// --- Ontology Icons Helper ---
export const getTypeIcon = (type: string) => {
    const t = type.toUpperCase();
    if (t.includes('INT') || t.includes('FLOAT') || t.includes('DOUBLE') || t.includes('DECIMAL')) return '#️⃣';
    if (t.includes('CHAR') || t.includes('TEXT') || t.includes('STRING')) return '🔤';
    if (t.includes('DATE') || t.includes('TIME')) return '📅';
    if (t.includes('BOOL')) return '☯';
    if (t.includes('LIST') || t.includes('ARRAY')) return '📚';
    if (t.includes('STRUCT') || t.includes('MAP')) return '📦';
    if (t.includes('JSON')) return '📄';
    if (t.includes('BLOB')) return '💾';
    return '❓';
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
    
    let result = sql;

    // First escape HTML entities to prevent XSS and rendering issues
    result = result
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    // Highlight multi-line comments /* */
    result = result.replace(/(\/\*[\s\S]*?\*\/)/g, 
        '<span class="sql-comment">$1</span>');

    // Highlight single-line comments -- 
    result = result.replace(/(--[^\n]*)/g, 
        '<span class="sql-comment">$1</span>');

    // Highlight strings in single quotes - must be greedy to handle escaped quotes
    result = result.replace(/('(?:[^'\\]|\\.)*')/g, 
        '<span class="sql-string">$1</span>');

    // Highlight double-quoted identifiers
    result = result.replace(/"([^"]+)"/g, 
        '<span class="sql-identifier">$1</span>');

    // Highlight numbers
    result = result.replace(/\b(\d+(?:\.\d+)?)\b/g, 
        '<span class="sql-number">$1</span>');

    // Highlight functions (before keywords, so function calls get function color)
    SQL_FUNCTIONS.forEach(fn => {
        const regex = new RegExp(`\\b(${fn})\\s*\\(`, 'gi');
        result = result.replace(regex, '<span class="sql-function">$1</span>(');
    });

    // Highlight keywords
    SQL_KEYWORDS.forEach(keyword => {
        const regex = new RegExp(`\\b(${keyword})\\b`, 'gi');
        result = result.replace(regex, '<span class="sql-keyword">$1</span>');
    });

    return result;
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
