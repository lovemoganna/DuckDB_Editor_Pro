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
  moveCompletionSelection,
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
import { duckDBService } from '../services/duckdbService';
import { sqlAutocompleteTheme } from '../themes/sqlAutocompleteTheme';
import { createSqlCompletionSource } from '../services/sql/sqlCompletionEngine';

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
  /** Format SQL (Ctrl+Shift+F). */
  onFormatSql?: () => void;
  /** Clear editor content (Ctrl+L). */
  onClear?: () => void;
  /** Materialize modal (Ctrl+Shift+M). */
  onMaterialize?: () => void;
  /** Save query modal (Ctrl+S). */
  onSaveModal?: () => void;
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
  // Enhanced AST regex matching: handles AS aliases, CTE declarations, and JOIN conditions
  const aliasRegex = /(?:from|join|with)\s+([a-zA-Z0-9_.]+)(?:\s+as)?\s+([a-zA-Z0-9_]+)/gi;
  const sqlKeywords = new Set([
    'as', 'join', 'left', 'right', 'inner', 'outer', 'cross', 'natural', 'full',
    'where', 'group', 'order', 'limit', 'on', 'using', 'union', 'select', 'and', 'or', 'set',
    'read_csv', 'read_csv_auto', 'read_parquet', 'read_json', 'read_json_auto', 'range'
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
  return async (view: any): Promise<Diagnostic[]> => {
    const diagnostics: Diagnostic[] = [];
    const docText = view.state.doc.toString();
    if (!docText.trim()) return diagnostics;

    // 0. DuckDB AST Syntax Validation (WASM AST Engine)
    try {
      const astResult = await duckDBService.validateSqlAst(docText);
      if (!astResult.valid && astResult.error) {
        // Extract offset or line number if DuckDB AST error message provides it
        diagnostics.push({
          from: 0,
          to: docText.length,
          severity: 'error',
          message: `[DuckDB AST 语法错误] ${astResult.error}`
        });
      }
    } catch (e) {
      // Ignore AST failure fallback to schema linting
    }

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

    // 2. Validate FROM and JOIN tables (excluding DuckDB TVFs like read_csv_auto, read_parquet)
    const tableRegex = /(?:from|join)\s+([a-zA-Z0-9_.]+)/gi;
    const tvfList = new Set(['read_csv', 'read_csv_auto', 'read_parquet', 'read_json', 'read_json_auto', 'range', 'generate_series']);

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

      // Check if it is a TVF, schema table, or CTE
      if (!tvfList.has(tableOnly) && !schemaTables.has(tableNameClean) && !schemaTables.has(tableOnly) && !cteNames.has(tableOnly)) {
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

    const extraKeybindings: KeyBinding[] = [
      ...(options.onFormatSql
        ? [
            { key: 'Alt-Shift-f', run: () => { options.onFormatSql?.(); return true; } },
            { key: 'Alt-Shift-F', run: () => { options.onFormatSql?.(); return true; } },
            { key: 'Meta-Shift-f', run: () => { options.onFormatSql?.(); return true; } },
            { key: 'Meta-Shift-F', run: () => { options.onFormatSql?.(); return true; } },
            { key: 'Mod-Shift-f', run: () => { options.onFormatSql?.(); return true; } },
            { key: 'Mod-Shift-F', run: () => { options.onFormatSql?.(); return true; } },
            { key: 'Ctrl-Shift-f', run: () => { options.onFormatSql?.(); return true; } },
            { key: 'Ctrl-Shift-F', run: () => { options.onFormatSql?.(); return true; } },
          ]
        : []),
      ...(options.onClear
        ? [
            { key: 'Mod-l', run: () => { options.onClear?.(); return true; } },
            { key: 'Mod-L', run: () => { options.onClear?.(); return true; } },
            { key: 'Ctrl-l', run: () => { options.onClear?.(); return true; } },
            { key: 'Ctrl-L', run: () => { options.onClear?.(); return true; } },
          ]
        : []),
      ...(options.onMaterialize
        ? [
            { key: 'Mod-Shift-m', run: () => { options.onMaterialize?.(); return true; } },
            { key: 'Mod-Shift-M', run: () => { options.onMaterialize?.(); return true; } },
            { key: 'Ctrl-Shift-m', run: () => { options.onMaterialize?.(); return true; } },
            { key: 'Ctrl-Shift-M', run: () => { options.onMaterialize?.(); return true; } },
          ]
        : []),
      ...(options.onSaveModal
        ? [
            { key: 'Mod-s', run: () => { options.onSaveModal?.(); return true; } },
            { key: 'Mod-S', run: () => { options.onSaveModal?.(); return true; } },
            { key: 'Ctrl-s', run: () => { options.onSaveModal?.(); return true; } },
            { key: 'Ctrl-S', run: () => { options.onSaveModal?.(); return true; } },
          ]
        : []),
    ];

    const completionSource = createSqlCompletionSource(() => schemaTree as any);

    return [
      sql({
        dialect: DUCKDB_DIALECT,
        schema: formattedSchema
      }),
      autocompletion({
        override: [completionSource],
        defaultKeymap: true,
        activateOnTyping: true,
      }),
      sqlAutocompleteTheme,
      history(),
      linter(buildSqlLinter(schemaTree), { delay: 500 }),
      keymap.of([
        // M-n / M-p: move autocomplete selection (before history so popup wins)
        { key: 'Alt-n', run: moveCompletionSelection(true) },
        { key: 'Alt-p', run: moveCompletionSelection(false) },
        ...extraKeybindings,
        ...historyKeys,
        ...emacsKeys,
        ...executeKey,
        ...cancelKey,
        ...defaultKeymap,
        ...historyKeymap,
        indentWithTab
      ]),
    ];
  }, [schemaTree, options.onExecute, options.onCancel, options.onNavigateHistory, options.onFormatSql, options.onClear, options.onMaterialize, options.onSaveModal]);

  return extensions;
}

export default useSqlEditorExtensions;
