import React, { useState, useEffect } from 'react';
import {
  Play,
  Terminal,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  Trash2,
  ExternalLink,
  Download,
} from 'lucide-react';
import { duckDBService } from '../../services/duckdbService';
import { toastService } from '../../services/toastService';

interface LiveSqlScratchpadProps {
  currentTable: string | null;
  onOpenInSqlEditor: (sql: string) => void;
  externalSql?: string;
}

export const LiveSqlScratchpad: React.FC<LiveSqlScratchpadProps> = ({
  currentTable,
  onOpenInSqlEditor,
  externalSql,
}) => {
  const defaultTable = currentTable || 'duckdb_tables';
  const [sql, setSql] = useState<string>(
    `SELECT * FROM "${defaultTable}" LIMIT 20;`,
  );
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<{
    columns: string[];
    rows: any[];
    elapsedMs: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Sync externalSql when triggered from external action
  useEffect(() => {
    if (externalSql && externalSql.trim()) {
      setSql(externalSql);
      void handleRunSql(externalSql);
    }
  }, [externalSql]);

  // When currentTable changes and user hasn't typed custom SQL, update default
  useEffect(() => {
    if (currentTable) {
      setSql(`SELECT * FROM "${currentTable}" LIMIT 20;`);
    }
  }, [currentTable]);

  const quickSnippets = [
    {
      label: `前 20 行`,
      sql: `SELECT * FROM "${defaultTable}" LIMIT 20;`,
    },
    {
      label: `总行数统计`,
      sql: `SELECT COUNT(*) as total_rows FROM "${defaultTable}";`,
    },
    {
      label: `表画像 SUMMARIZE`,
      sql: `SUMMARIZE "${defaultTable}";`,
    },
    {
      label: `字段元数据`,
      sql: `DESCRIBE "${defaultTable}";`,
    },
    {
      label: `全库所有表`,
      sql: `SELECT table_name, column_count, estimated_size FROM duckdb_tables();`,
    },
  ];

  const handleRunSql = async (sqlToRun?: string) => {
    const queryToExecute = (typeof sqlToRun === 'string' ? sqlToRun : sql).trim();
    if (!queryToExecute) {
      toastService.warning('请输入要执行的 SQL 语句');
      return;
    }

    setIsRunning(true);
    setError(null);
    const start = performance.now();
    try {
      const rows = await duckDBService.query(queryToExecute);
      const elapsed = +(performance.now() - start).toFixed(2);
      const cols = rows && rows.length > 0 ? Object.keys(rows[0]) : [];
      setResult({
        columns: cols,
        rows: rows || [],
        elapsedMs: elapsed,
      });
    } catch (err: any) {
      console.error('SQL Execution Error', err);
      setError(err?.message || 'SQL 执行失败');
      setResult(null);
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopySql = () => {
    void navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toastService.success('已复制 SQL');
  };

  const handleExportCsv = () => {
    if (!result || result.rows.length === 0) return;
    const headers = result.columns.join(',');
    const rows = result.rows.map(r => result.columns.map(c => JSON.stringify(r[c] ?? '')).join(',')).join('\n');
    const blob = new Blob([`${headers}\n${rows}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query_result_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toastService.success('已导出结果为 CSV');
  };

  return (
    <div className="flex flex-col rounded-md border border-monokai-border bg-monokai-surface overflow-hidden font-sans shadow-xs">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-monokai-border bg-monokai-elevated">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-monokai-green" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-monokai-fg">
            就地即席 SQL 终端 (Live SQL Scratchpad)
          </h3>
        </div>
        <span className="font-mono text-2xs text-monokai-comment">
          Ctrl + Enter 快捷运行
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* Quick Snippets Bar */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-meta font-mono text-monokai-comment mr-1">快捷模板:</span>
          {quickSnippets.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setSql(s.sql);
                void handleRunSql(s.sql);
              }}
              className="rounded-md border border-monokai-border/80 bg-monokai-bg px-2 py-1 text-meta font-mono text-monokai-fg-muted hover:text-monokai-fg hover:border-monokai-border-strong transition-colors cursor-pointer"
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Textarea Input */}
        <div className="relative">
          <textarea
            value={sql}
            onChange={e => setSql(e.target.value)}
            onKeyDown={e => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                void handleRunSql();
              }
            }}
            rows={3}
            placeholder="输入任意 DuckDB SQL 语句，按 Ctrl+Enter 运行…"
            className="w-full rounded-md border border-monokai-border bg-monokai-bg p-3 font-mono text-xs text-monokai-fg placeholder:text-monokai-comment/60 outline-none focus:border-monokai-border-strong transition-colors resize-y custom-scrollbar"
          />
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleRunSql()}
              disabled={isRunning}
              className="flex h-7 items-center gap-1.5 rounded-md bg-monokai-green px-3.5 text-xs font-bold text-monokai-bg hover:brightness-110 transition-all cursor-pointer disabled:opacity-50"
            >
              {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
              <span>运行 SQL</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSql('');
                setResult(null);
                setError(null);
              }}
              className="flex h-7 items-center gap-1 rounded-md border border-monokai-border bg-monokai-bg px-2 text-xs text-monokai-comment hover:text-monokai-fg transition-colors cursor-pointer"
              title="清空输入"
            >
              <Trash2 className="h-3 w-3" />
              <span>清空</span>
            </button>
            <button
              type="button"
              onClick={handleCopySql}
              className="flex h-7 items-center gap-1 rounded-md border border-monokai-border bg-monokai-bg px-2 text-xs text-monokai-comment hover:text-monokai-fg transition-colors cursor-pointer"
              title="复制 SQL 语句"
            >
              {copied ? <Check className="h-3 w-3 text-monokai-green" /> : <Copy className="h-3 w-3" />}
              <span>复制</span>
            </button>
            {result && result.rows.length > 0 && (
              <button
                type="button"
                onClick={handleExportCsv}
                className="flex h-7 items-center gap-1 rounded-md border border-monokai-border bg-monokai-bg px-2.5 text-xs text-monokai-cyan hover:bg-monokai-cyan/10 transition-colors cursor-pointer"
                title="导出为 CSV"
              >
                <Download className="h-3 w-3" />
                <span>导出 CSV</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => onOpenInSqlEditor(sql)}
            className="flex items-center gap-1 text-xs font-mono text-monokai-cyan hover:underline cursor-pointer"
          >
            <span>在全功能 SQL 工作台中打开</span>
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-monokai-border bg-monokai-surface/60 p-3 text-xs text-monokai-pink font-mono">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="break-all">{error}</div>
          </div>
        )}

        {/* Query Result Grid */}
        {result && (
          <div className="space-y-2 border-t border-monokai-border/60 pt-3">
            <div className="flex items-center justify-between text-xs font-mono text-monokai-comment">
              <span className="text-monokai-green font-semibold">
                查询成功: 返回 {result.rows.length} 行数据
              </span>
              <span className="text-monokai-cyan font-bold">
                实际耗时: {result.elapsedMs} ms
              </span>
            </div>

            {result.rows.length === 0 ? (
              <div className="flex h-20 items-center justify-center text-xs font-mono text-monokai-comment border border-monokai-border rounded-md bg-monokai-bg">
                查询执行成功，但未返回任何数据行
              </div>
            ) : (
              <div className="max-h-56 overflow-auto border border-monokai-border rounded-md custom-scrollbar bg-monokai-bg">
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-monokai-border bg-monokai-elevated text-monokai-fg sticky top-0">
                      {result.columns.map(c => (
                        <th key={c} className="px-3 py-1.5 border-r border-monokai-border/40 last:border-r-0 whitespace-nowrap font-bold">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-monokai-border/30">
                    {result.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-monokai-elevated transition-colors">
                        {result.columns.map(c => (
                          <td key={c} className="px-3 py-1.5 border-r border-monokai-border/20 last:border-r-0 whitespace-nowrap text-monokai-fg">
                            {String(row[c] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

