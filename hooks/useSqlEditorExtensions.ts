/**
 * useSqlEditorExtensions — Build CodeMirror 6 extensions for the SQL editor.
 *
 * Loop 7 of SqlEditor Pro refactor.
 *
 * Provides:
 *   - Schema-aware SQL autocompletion (DuckDB keywords + table/column names)
 *   - Keyboard shortcuts for common SQL editing operations
 *   - DuckDB-specific SQL dialect
 *
 * All extensions are built from the current schema tree so autocompletion
 * reflects the live database schema.
 */

import { useMemo, useCallback } from 'react';
import {
  autocompletion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete';
import { keymap, EditorView, type KeyBinding } from '@codemirror/view';
import { monokai } from '@uiw/codemirror-theme-monokai';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands';
import { sql, SQLDialect, PostgreSQL } from '@codemirror/lang-sql';
import { linter, type Diagnostic } from '@codemirror/lint';
import { useSqlEditorStore } from './store/useSqlEditorStore';

// DuckDB dialect — Postgres base + DuckDB-specific keywords
const DUCKDB_DIALECT = SQLDialect.define({
  ...PostgreSQL.spec,
  keywords: (PostgreSQL.spec.keywords || '').toLowerCase() + ' ' + [
    // DuckDB-specific
    'summarize', 'from_schema', 'load', 'install', 'import',
    'using', 'sample', 'reservoir', 'with', 'replace', 'call',
    'qualify', 'pivot', 'lateral', 'unnest', 'unnest_original_order',
    'copy_to_file', 'export', 'import_database',
    'table', 'sequence', 'macro', 'materialized', 'view',
    'attach', 'detach', 'use', 'use_schema',
    'pragma', 'set', 'reset',
    'explain', 'analyze',
    'begin', 'commit', 'rollback', 'transaction',
    'create_schema', 'create_sequence', 'create_macro', 'create_view',
    'create_or_replace', 'if_not_exists', 'if_exists',
    // Table-valued functions
    'read_csv', 'read_csv_auto', 'read_parquet', 'read_json', 'read_json_auto',
    'read_ndjson', 'read_text', 'read_parquet_multiple_files',
    'range', 'generate_series',
    'information_schema', 'duckdb_tables', 'duckdb_columns',
  ].join(' '),
});

export interface UseSqlEditorExtensionsOptions {
  /** Called when Ctrl/Cmd+Enter is pressed. */
  onExecute?: () => void;
  /** Called when Ctrl/Cmd+. is pressed (cancel). */
  onCancel?: () => void;
  /** Navigate query history. */
  onNavigateHistory?: (direction: 'up' | 'down') => boolean;
}

const SQL_KEYWORDS = [
  // DDL
  'CREATE TABLE', 'CREATE OR REPLACE TABLE', 'CREATE VIEW', 'CREATE MATERIALIZED VIEW',
  'CREATE SCHEMA', 'CREATE SEQUENCE', 'CREATE MACRO', 'CREATE FUNCTION',
  'DROP TABLE', 'DROP VIEW', 'DROP SCHEMA', 'DROP SEQUENCE',
  'ALTER TABLE', 'ALTER VIEW',
  'INSERT INTO', 'UPDATE', 'DELETE FROM',
  'TRUNCATE', 'VACUUM',
  // DQL
  'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'OFFSET',
  'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'FULL OUTER JOIN', 'CROSS JOIN',
  'NATURAL JOIN', 'LATERAL JOIN',
  'UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT',
  'WITH', 'AS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'EXISTS', 'IN', 'BETWEEN', 'LIKE', 'ILIKE', 'SIMILAR TO',
  'DISTINCT', 'ALL', 'ANY', 'SOME',
  'CAST', 'TRY_CAST', 'COALESCE', 'NULLIF',
  'TRUE', 'FALSE', 'NULL',
  // Aggregates & window
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'ARRAY_AGG', 'STRING_AGG', 'LIST_AGG',
  'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'PERCENT_RANK', 'CUME_DIST',
  'LAG', 'LEAD', 'FIRST_VALUE', 'LAST_VALUE', 'NTH_VALUE',
  'OVER', 'PARTITION BY', 'ROWS BETWEEN', 'RANGE BETWEEN',
  'UNBOUNDED PRECEDING', 'UNBOUNDED FOLLOWING', 'CURRENT ROW',
  // DuckDB special
  'SUMMARIZE', 'SAMPLE', 'TABLESAMPLE',
  'COPY', 'EXPORT',
  // Table-valued functions
  'read_csv', 'read_csv_auto', 'read_parquet', 'read_json', 'read_json_auto',
  'range', 'generate_series',
];

const DUCKDB_FUNCTIONS = [
  {
    label: 'read_csv_auto',
    type: 'function',
    detail: 'read_csv_auto(file_path)',
    info: '自动检测 CSV 文件的 schema 并读取为表。\n示例: SELECT * FROM read_csv_auto(\'data.csv\');'
  },
  {
    label: 'read_parquet',
    type: 'function',
    detail: 'read_parquet(file_path)',
    info: '读取单或多个 Parquet 文件。\n示例: SELECT * FROM read_parquet(\'data.parquet\');'
  },
  {
    label: 'read_json_auto',
    type: 'function',
    detail: 'read_json_auto(file_path)',
    info: '自动检测 JSON/NDJSON 格式并读取。\n示例: SELECT * FROM read_json_auto(\'data.json\');'
  },
  {
    label: 'read_ndjson',
    type: 'function',
    detail: 'read_ndjson(file_path)',
    info: '读取换行分隔的 JSON 文件。\n示例: SELECT * FROM read_ndjson(\'data.ndjson\');'
  },
  {
    label: 'range',
    type: 'function',
    detail: 'range(start, end, step)',
    info: '生成数值序列。等同于 PostgreSQL 的 generate_series。\n示例: SELECT * FROM range(1, 10);'
  },
  {
    label: 'SUMMARIZE',
    type: 'keyword',
    detail: 'SUMMARIZE table_name',
    info: '计算表中每一列的统计数据（类型、最小值、最大值、缺失值等）。\n示例: SUMMARIZE my_table;'
  }
];

function getTableAliases(sqlText: string): Record<string, string> {
  const aliases: Record<string, string> = {};
  const aliasRegex = /(?:from|join)\s+([a-zA-Z0-9_.]+)(?:\s+as)?\s+([a-zA-Z0-9_]+)/gi;
  const sqlKeywords = new Set([
    'as', 'join', 'left', 'right', 'inner', 'outer', 'cross', 'natural', 'full',
    'where', 'group', 'order', 'limit', 'on', 'using', 'union', 'select', 'and', 'or', 'set'
  ]);
  let match;
  while ((match = aliasRegex.exec(sqlText)) !== null) {
    const table = match[1];
    const alias = match[2];
    if (!sqlKeywords.has(alias.toLowerCase())) {
      aliases[alias.toLowerCase()] = table;
    }
  }
  return aliases;
}



function buildSqlLinter(schemaTree: Record<string, { name: string; type: string }[]>) {
  return (view: any): Diagnostic[] => {
    const diagnostics: Diagnostic[] = [];
    const docText = view.state.doc.toString();
    if (!docText.trim()) return diagnostics;

    // 1. Extract CTE names (WITH cte_name AS (...)) and temporary tables
    const cteNames = new Set<string>();
    const cteRegex = /with\s+([a-zA-Z0-9_]+)\s+as\s*\(/gi;
    let match;
    while ((match = cteRegex.exec(docText)) !== null) {
      cteNames.add(match[1].toLowerCase());
    }

    const tempTableRegex = /create\s+(?:temp|temporary)?\s*table\s+([a-zA-Z0-9_]+)/gi;
    while ((match = tempTableRegex.exec(docText)) !== null) {
      cteNames.add(match[1].toLowerCase());
    }

    // Lowercase schema tree keys for easy case-insensitive matching
    const schemaTables = new Set<string>();
    for (const k of Object.keys(schemaTree)) {
      schemaTables.add(k.toLowerCase());
      // Also add schema-stripped names (e.g. "memory.my_table" -> "my_table")
      const dotIdx = k.indexOf('.');
      if (dotIdx !== -1) {
        schemaTables.add(k.substring(dotIdx + 1).toLowerCase());
      }
    }

    // 2. Validate FROM and JOIN tables
    const tableRegex = /(?:from|join)\s+([a-zA-Z0-9_.]+)/gi;
    while ((match = tableRegex.exec(docText)) !== null) {
      const fullTableName = match[1];
      const start = match.index + match[0].indexOf(fullTableName);
      const end = start + fullTableName.length;
      
      // Strip quotes and schema prefixes
      const tableNameClean = fullTableName.replace(/"/g, '').toLowerCase();
      let tableOnly = tableNameClean;
      const dotIdx = tableNameClean.indexOf('.');
      if (dotIdx !== -1) {
        tableOnly = tableNameClean.substring(dotIdx + 1);
      }

      // Check if it exists in schema or CTEs
      if (!schemaTables.has(tableNameClean) && !schemaTables.has(tableOnly) && !cteNames.has(tableOnly)) {
        diagnostics.push({
          from: start,
          to: end,
          severity: 'warning',
          message: `表 "${fullTableName}" 在架构中不存在或尚未定义。`
        });
      }
    }

    // Resolve table aliases for dotted identifier validation
    const aliases = getTableAliases(docText);

    // 3. Validate explicit dotted identifiers (table_name.column_name)
    const columnRegex = /([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)/gi;
    while ((match = columnRegex.exec(docText)) !== null) {
      const fullMatch = match[0];
      const tableName = match[1];
      const columnName = match[2];
      const start = match.index;
      const end = start + fullMatch.length;

      // Resolve alias to real table
      const resolvedTable = aliases[tableName.toLowerCase()] || tableName;

      // If the resolved table is a CTE or temp table, do not validate columns (no-op/skip to avoid false positives)
      if (cteNames.has(resolvedTable.toLowerCase())) {
        continue;
      }

      // Find if resolvedTable exists in schema (support schema-prefixed keys)
      const exactTableKey = Object.keys(schemaTree).find(k => 
        k.toLowerCase() === resolvedTable.toLowerCase() || 
        k.toLowerCase().endsWith('.' + resolvedTable.toLowerCase())
      );

      if (exactTableKey) {
        const columns = schemaTree[exactTableKey];
        const hasColumn = columns.some(c => (c.name || String(c)).toLowerCase() === columnName.toLowerCase());
        if (!hasColumn) {
          diagnostics.push({
            from: start + tableName.length + 1, // point directly to column name
            to: end,
            severity: 'error',
            message: `字段 "${columnName}" 在表 "${tableName}" 中不存在。`
          });
        }
      }
    }

    return diagnostics;
  };
}

import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

const customMonokaiHighlight = HighlightStyle.define([
  { tag: t.keyword, color: '#f92672', fontWeight: 'bold' },
  { tag: t.string, color: '#e6db74' },
  { tag: t.number, color: '#ae81ff' },
  { tag: t.bool, color: '#ae81ff' },
  { tag: t.null, color: '#ae81ff' },
  { tag: t.comment, color: '#75715e', fontStyle: 'italic' },
  { tag: [t.variableName, t.name, t.propertyName], color: '#f8f8f2' },
  { tag: t.function(t.variableName), color: '#66d9ef' },
  { tag: t.operator, color: '#f92672' },
  { tag: t.className, color: '#a6e22e' },
  { tag: t.typeName, color: '#66d9ef', fontStyle: 'italic' },
  { tag: t.invalid, color: '#f44747' },
]);

/**
 * Returns all CodeMirror 6 extensions for the SQL editor.
 */
export function useSqlEditorExtensions(options: UseSqlEditorExtensionsOptions = {}) {
  const schemaTree = useSqlEditorStore((s) => s.schemaTree);

  const extensions = useMemo(() => {
    const executeKey = options.onExecute
      ? [{
          key: 'Ctrl-Enter',
          mac: 'Cmd-Enter',
          run: () => { options.onExecute?.(); return true; },
        } as KeyBinding]
      : [];

    const cancelKey = options.onCancel
      ? [{
          key: 'Ctrl-.',
          mac: 'Cmd-.',
          run: () => { options.onCancel?.(); return true; },
        } as KeyBinding]
      : [];

    // Convert schemaTree (Record<string, ColumnInfo[]>) to Record<string, string[]> for native SQL config
    const formattedSchema: Record<string, string[]> = {};
    for (const [table, cols] of Object.entries(schemaTree)) {
      formattedSchema[table] = cols.map(c => c.name ?? String(c));
    }

    const historyKeys = options.onNavigateHistory
      ? ([
          {
            key: 'ArrowUp',
            run: (view: EditorView) => {
              const { selection, doc } = view.state;
              const cursor = selection.main.head;
              const text = doc.toString();
              const firstNewline = text.indexOf('\n');
              if (firstNewline === -1 || cursor <= firstNewline) {
                const success = options.onNavigateHistory?.('up');
                if (success) {
                  setTimeout(() => {
                    view.dispatch({
                      selection: { anchor: view.state.doc.length, head: view.state.doc.length }
                    });
                  }, 10);
                  return true;
                }
              }
              return false;
            }
          },
          {
            key: 'ArrowDown',
            run: (view: EditorView) => {
              const { selection, doc } = view.state;
              const cursor = selection.main.head;
              const text = doc.toString();
              const lastNewline = text.lastIndexOf('\n');
              if (lastNewline === -1 || cursor > lastNewline) {
                const success = options.onNavigateHistory?.('down');
                if (success) return true;
              }
              return false;
            }
          },
          {
            key: 'Alt-p',
            run: (view: EditorView) => {
              const { selection, doc } = view.state;
              const cursor = selection.main.head;
              const text = doc.toString();
              const firstNewline = text.indexOf('\n');
              if (firstNewline === -1 || cursor <= firstNewline) {
                const success = options.onNavigateHistory?.('up');
                if (success) {
                  setTimeout(() => {
                    view.dispatch({
                      selection: { anchor: view.state.doc.length, head: view.state.doc.length }
                    });
                  }, 10);
                  return true;
                }
              }
              return false;
            }
          },
          {
            key: 'Alt-n',
            run: (view: EditorView) => {
              const { selection, doc } = view.state;
              const cursor = selection.main.head;
              const text = doc.toString();
              const lastNewline = text.lastIndexOf('\n');
              if (lastNewline === -1 || cursor > lastNewline) {
                const success = options.onNavigateHistory?.('down');
                if (success) return true;
              }
              return false;
            }
          }
        ] as KeyBinding[])
      : [];

    const emacsKeys: KeyBinding[] = [
      {
        key: 'Alt-a',
        run: (view: EditorView) => {
          const line = view.state.doc.lineAt(view.state.selection.main.head);
          view.dispatch({ selection: { anchor: line.from, head: line.from }, scrollIntoView: true });
          return true;
        }
      },
      {
        key: 'Alt-e',
        run: (view: EditorView) => {
          const line = view.state.doc.lineAt(view.state.selection.main.head);
          view.dispatch({ selection: { anchor: line.to, head: line.to }, scrollIntoView: true });
          return true;
        }
      },
      {
        key: 'Alt-f',
        run: (view: EditorView) => {
          const pos = view.state.selection.main.head;
          if (pos < view.state.doc.length) {
            view.dispatch({ selection: { anchor: pos + 1, head: pos + 1 }, scrollIntoView: true });
            return true;
          }
          return false;
        }
      },
      {
        key: 'Alt-b',
        run: (view: EditorView) => {
          const pos = view.state.selection.main.head;
          if (pos > 0) {
            view.dispatch({ selection: { anchor: pos - 1, head: pos - 1 }, scrollIntoView: true });
            return true;
          }
          return false;
        }
      },
      {
        key: 'Alt-d',
        run: (view: EditorView) => {
          const pos = view.state.selection.main.head;
          if (pos < view.state.doc.length) {
            view.dispatch({ changes: { from: pos, to: pos + 1 }, scrollIntoView: true });
            return true;
          }
          return false;
        }
      },
      {
        key: 'Alt-k',
        run: (view: EditorView) => {
          const pos = view.state.selection.main.head;
          const line = view.state.doc.lineAt(pos);
          if (pos < line.to) {
            view.dispatch({ changes: { from: pos, to: line.to }, scrollIntoView: true });
            return true;
          } else if (pos === line.to && pos < view.state.doc.length) {
            view.dispatch({ changes: { from: pos, to: pos + 1 }, scrollIntoView: true });
            return true;
          }
          return false;
        }
      }
    ];

    return [
      sql({
        dialect: DUCKDB_DIALECT,
        schema: formattedSchema
      }),
      syntaxHighlighting(customMonokaiHighlight),
      history(),
      autocompletion({
        defaultKeymap: true,
        activateOnTyping: true,
        icons: false,
      }),
      linter(buildSqlLinter(schemaTree), { delay: 500 }),
      keymap.of([
        ...historyKeys,
        ...emacsKeys,
        ...executeKey,
        ...cancelKey,
        ...defaultKeymap,
        ...historyKeymap,
        indentWithTab
      ]),
    ];
  }, [schemaTree, options.onExecute, options.onCancel, options.onNavigateHistory]);

  return extensions;
}

export default useSqlEditorExtensions;
