import React, { useState, useMemo, useEffect } from 'react';
import { 
  Code2, 
  Copy, 
  Check, 
  Play, 
  Send, 
  RotateCcw, 
  Settings2, 
  ChevronDown, 
  ChevronRight,
  Clock,
  AlertCircle,
  Table as TableIcon,
  FileCode,
  Sparkles,
  Database
} from 'lucide-react';
import { format } from 'sql-formatter';
import { CodeAsset, CodeParam } from '../types';
import { duckDBService } from '../../../services/duckdbService';
import { serializeSnippetToMarkdown } from '../services/snippetMarkdownParser';
import { MarkdownPreview } from '../../MarkdownPreview';
import { CodeHighlightBlock } from '../../ui/CodeHighlightBlock';

interface CodeAssetDetailProps {
  asset: CodeAsset;
  onTryCode?: (sql: string) => void;
}

export const CodeAssetDetail: React.FC<CodeAssetDetailProps> = ({ asset, onTryCode }) => {
  const [copied, setCopied] = useState(false);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [queryResult, setQueryResult] = useState<any[] | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [executionDuration, setExecutionDuration] = useState<number | null>(null);
  const [isParamsExpanded, setIsParamsExpanded] = useState(true);
  const resultPanelRef = React.useRef<HTMLDivElement>(null);

  // 解析 SQL 中的动态占位符 {{param_name}}
  const detectedParams = useMemo(() => {
    const regex = /\{\{([a-zA-Z0-9_]+)\}\}/g;
    const matches = new Set<string>();
    let m;
    while ((m = regex.exec(asset.sql)) !== null) {
      matches.add(m[1]);
    }

    const explicitMap = new Map((asset.params || []).map((p) => [p.name, p]));
    const result: Array<{ name: string; label: string; defaultValue: string; description?: string }> = [];

    matches.forEach((paramName) => {
      const explicit = explicitMap.get(paramName);
      result.push({
        name: paramName,
        label: explicit?.label || paramName,
        defaultValue: explicit?.defaultValue || '',
        description: explicit?.description,
      });
    });

    return result;
  }, [asset.sql, asset.params]);

  // 仅在切换资产时重置；不要依赖 detectedParams 引用，避免误清执行结果
  useEffect(() => {
    const initial: Record<string, string> = {};
    detectedParams.forEach((p) => {
      initial[p.name] = p.defaultValue;
    });
    setParamValues(initial);
    setQueryResult(null);
    setQueryError(null);
    setExecutionDuration(null);
  }, [asset.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 动态拼装编译后的SQL
  const compiledSql = useMemo(() => {
    let output = asset.sql;
    detectedParams.forEach((p) => {
      const val = paramValues[p.name] !== undefined ? paramValues[p.name] : p.defaultValue;
      const regex = new RegExp(`\\{\\{${p.name}\\}\\}`, 'g');
      output = output.replace(regex, val);
    });
    return output;
  }, [asset.sql, detectedParams, paramValues]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(compiledSql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleInsertToEditor = () => {
    if (onTryCode) {
      onTryCode(compiledSql);
    }
  };

  const handleDownloadMarkdown = () => {
    const md = serializeSnippetToMarkdown({
      ...asset,
      sql: compiledSql,
    });
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${asset.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 本地 DuckDB WASM 行内试运行
  const handleRunQuery = async () => {
    setIsRunning(true);
    setQueryError(null);
    setQueryResult(null);
    const start = performance.now();

    try {
      // 拆分多条 SQL 语句逐条执行并保留最终查询集
      const rawStatements = compiledSql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      let lastRows: any[] = [];
      for (const stmt of rawStatements) {
        const cleanStmt = stmt.replace(/--.*$/gm, '').trim();
        if (!cleanStmt) continue;

        const res = await duckDBService.query(cleanStmt.endsWith(';') ? cleanStmt : `${cleanStmt};`);
        if (res && Array.isArray(res)) {
          lastRows = res;
        }
      }

      const duration = Math.round(performance.now() - start);
      setQueryResult(lastRows);
      setExecutionDuration(duration);
      requestAnimationFrame(() => {
        resultPanelRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
      });
    } catch (err: any) {
      const duration = Math.round(performance.now() - start);
      setExecutionDuration(duration);
      const msg = err?.message || String(err);
      if (msg.includes('No files found that match the pattern')) {
        setQueryError(
          `${msg}\n\n💡 提示：该 Parquet 文件路径在当前DuckDB WASM 浏览器虚拟内存中不存在。模板已更新为自包含生成并读取orders_sample.parquet，你可以直接重置参数为默认值或填入有效路径。`
        );
      } else {
        setQueryError(msg);
      }
      requestAnimationFrame(() => {
        resultPanelRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
      });
    } finally {
      setIsRunning(false);
    }
  };

  const columns = useMemo(() => {
    if (!queryResult || queryResult.length === 0) return [];
    return Object.keys(queryResult[0]);
  }, [queryResult]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto custom-scrollbar p-4 md:p-6">
      <div className="w-[95%] max-w-[95%] mx-auto space-y-6 pb-12">
        {/* 头部元数据*/}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-medium">
            {asset.category === 'template' ? 'SQL模版' : asset.category === 'script' ? 'SQL脚本' : '代码片段'}
          </span>
          <span className="text-xs text-monokai-comment font-mono">ID: {asset.id}</span>
        </div>

        <h1 className="text-base font-semibold text-monokai-fg">{asset.title}</h1>
        {asset.description && (
          <div className="text-[12.5px] text-monokai-fg-muted mt-1.5 leading-relaxed">
            <MarkdownPreview content={asset.description} onTryCode={onTryCode} />
          </div>
        )}

        {/* 标签 */}
        {asset.tags && asset.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {asset.tags.map((t) => (
              <span
                key={t}
                className="text-[10px] px-2 py-0.5 rounded bg-monokai-elevated text-monokai-comment border border-monokai-border font-mono"
              >
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 参数化占位符表单 (如果含有占位符 */}
      {detectedParams.length > 0 && (
        <div className="rounded-xl border border-monokai-border bg-monokai-surface overflow-hidden shadow-2xs">
          <div
            onClick={() => setIsParamsExpanded(!isParamsExpanded)}
            className="px-4 py-2 bg-monokai-elevated border-b border-monokai-border flex items-center justify-between cursor-pointer select-none"
          >
            <div className="flex items-center gap-2 text-xs font-medium text-monokai-fg-muted">
              <Settings2 className="w-3.5 h-3.5 text-monokai-accent" />
              <span>动态参数填写({detectedParams.length} 个占位符)</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const resetObj: Record<string, string> = {};
                  detectedParams.forEach((p) => {
                    resetObj[p.name] = p.defaultValue;
                  });
                  setParamValues(resetObj);
                }}
                title="重置为默认"
                className="text-[11px] text-monokai-comment hover:text-monokai-fg-muted flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>重置</span>
              </button>
              {isParamsExpanded ? (
                <ChevronDown className="w-4 h-4 text-monokai-comment" />
              ) : (
                <ChevronRight className="w-4 h-4 text-monokai-comment" />
              )}
            </div>
          </div>

          {isParamsExpanded && (
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {detectedParams.map((param) => (
                <div key={param.name} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <label className="text-monokai-fg-muted font-medium">{param.label}</label>
                    <code className="text-[10px] text-monokai-accent font-mono">
                      {`{{${param.name}}}`}
                    </code>
                  </div>
                  <input
                    type="text"
                    value={paramValues[param.name] ?? ''}
                    onChange={(e) =>
                      setParamValues((prev) => ({
                        ...prev,
                        [param.name]: e.target.value,
                      }))
                    }
                    placeholder={param.defaultValue || `输入 ${param.name}`}
                    className="w-full bg-monokai-bg border border-monokai-border text-xs text-monokai-fg-muted rounded-md px-3 py-1.5 focus:outline-none focus:border-monokai-accent"
                  />
                  {param.description && (
                    <span className="text-[10px] text-monokai-comment">{param.description}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SQL 代码展示与快捷操作区 */}
      <div className="rounded-xl border border-monokai-border bg-monokai-bg overflow-hidden shadow-xs">
        {/* 代码顶栏工具栏*/}
        <div className="px-4 py-2 bg-monokai-surface border-b border-monokai-border flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-monokai-comment font-mono">
            <Code2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>SQL 执行定义</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs text-monokai-comment hover:text-monokai-fg-muted hover:bg-monokai-hover transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-monokai-accent" />
                  <span className="text-monokai-accent">已复制</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>复制 SQL</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownloadMarkdown}
              title="将此 SQL 片段下载为标准 .md 物理文件"
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs text-monokai-comment hover:text-monokai-fg-muted hover:bg-monokai-hover transition-colors"
            >
              <FileCode className="w-3.5 h-3.5 text-emerald-400" />
              <span>保存为 .md</span>
            </button>

            <button
              type="button"
              onClick={handleInsertToEditor}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-sky-400 bg-sky-950/40 hover:bg-sky-900/60 border border-sky-800/50 hover:border-sky-700 transition-colors cursor-pointer"
              title="将 SQL 自动带入 SQL 编辑器继续编辑执行"
            >
              <Send className="w-3.5 h-3.5" />
              <span>发送到 SQL 编辑器</span>
            </button>

            <button
              type="button"
              onClick={handleRunQuery}
              disabled={isRunning}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-monokai-accent hover:bg-monokai-accent-hover text-monokai-bg transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
              title="直接执行当前 SQL"
            >
              <Play className={`w-3.5 h-3.5 fill-current ${isRunning ? 'animate-pulse' : ''}`} />
              <span>{isRunning ? '执行中...' : '执行 SQL'}</span>
            </button>
          </div>
        </div>

        {/* 代码主体展示 (CodeHighlightBlock + 原生纯文本辅助容器 */}
        <div className="p-3">
          <CodeHighlightBlock
            code={compiledSql}
            language="sql"
            allowFormat={true}
            showLineNumbers={true}
            hideHeader={true}
          />
          {/* 隐藏纯文本供无障碍读取与匹配 */}
          <pre className="sr-only" aria-hidden="false">
            {compiledSql}
          </pre>
        </div>
      </div>

      {/* 行内执行结果预览区域 */}
      {(isRunning || queryResult !== null || queryError !== null) && (
        <div ref={resultPanelRef} className="rounded-xl border border-monokai-border bg-monokai-bg overflow-hidden">
          <div className="px-4 py-2 bg-monokai-elevated border-b border-monokai-border flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium text-monokai-fg-muted">
              <TableIcon className="w-3.5 h-3.5 text-monokai-accent" />
              <span>执行结果预览</span>
              {executionDuration !== null && (
                <span className="text-[10px] text-monokai-comment flex items-center gap-1 font-mono">
                  <Clock className="w-3 h-3" />
                  {executionDuration} ms
                </span>
              )}
            </div>

            {queryResult && (
              <span className="text-[10px] font-mono text-emerald-400">
                {queryResult.length} 行数据返回              </span>
            )}
          </div>

          <div className="p-3">
            {isRunning && (
              <div className="py-8 flex flex-col items-center justify-center text-monokai-comment space-y-2">
                <Database className="w-6 h-6 animate-spin text-monokai-accent" />
                <span className="text-xs">DuckDB WASM 正在计算中...</span>
              </div>
            )}

            {queryError && (
              <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/40 text-red-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1 overflow-x-auto">
                  <p className="font-semibold">执行异常：</p>
                  <pre className="font-mono text-[11px] whitespace-pre-wrap">{queryError}</pre>
                </div>
              </div>
            )}

            {!isRunning && !queryError && queryResult && (
              queryResult.length === 0 ? (
                <div className="py-6 text-center text-xs text-monokai-comment">
                  查询执行成功，返回结果集为空 (0 rows)。                </div>
              ) : (
                <div className="overflow-x-auto max-h-72 custom-scrollbar">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="border-b border-monokai-border bg-monokai-surface">
                        {columns.map((col) => (
                          <th key={col} className="p-2 font-mono text-monokai-comment font-medium">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-monokai-border/50 font-mono">
                      {queryResult.slice(0, 50).map((row, idx) => (
                        <tr key={idx} className="hover:bg-monokai-elevated/80 text-monokai-fg-muted">
                          {columns.map((col) => (
                            <td key={col} className="p-2 whitespace-nowrap">
                              {row[col] !== null && row[col] !== undefined
                                ? String(row[col])
                                : <span className="text-monokai-comment italic">NULL</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {queryResult.length > 50 && (
                    <div className="p-2 text-center text-[10px] text-monokai-comment bg-monokai-surface">
                      仅预览前 50 条记录，完整数据集请投递至 SQL 编辑器执行。                    </div>
                  )}
                </div>
              )
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
