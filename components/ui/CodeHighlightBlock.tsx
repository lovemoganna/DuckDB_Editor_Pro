import React, { useState, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { python } from '@codemirror/lang-python';
import { json } from '@codemirror/lang-json';
import { javascript } from '@codemirror/lang-javascript';
import { markdown } from '@codemirror/lang-markdown';
import { yaml } from '@codemirror/lang-yaml';
import { EditorView } from '@codemirror/view';
import { monokai } from '@uiw/codemirror-theme-monokai';
import { lightEditorTheme } from '../../themes/sqlEditorThemes';
import { useUiTheme } from '../../services/uiTheme';
import { 
  Copy, 
  Check, 
  FileCode2, 
  Send, 
  Play, 
  Sparkles, 
  Loader2, 
  ChevronUp, 
  ChevronDown,
  ChevronRight,
  AlertCircle, 
  CheckCircle2, 
  Table as TableIcon,
  RotateCcw,
  X
} from 'lucide-react';
import { format } from 'sql-formatter';
import { duckDBService } from '../../services/duckdbService';
import { toastService } from '../../services/toastService';
import { splitSqlScript } from '../../services/dataflow/sqlStructure';

export type SupportedLanguage =
  | 'sql'
  | 'duckdb'
  | 'python'
  | 'json'
  | 'javascript'
  | 'js'
  | 'ts'
  | 'typescript'
  | 'markdown'
  | 'md'
  | 'yaml'
  | 'yml'
  | 'bash'
  | 'sh'
  | 'shell'
  | 'text';

export interface CodeHighlightBlockProps {
  code: string;
  language?: string;
  title?: string;
  maxHeight?: string;
  showLineNumbers?: boolean;
  allowFormat?: boolean;
  initialFormat?: boolean;
  className?: string;
  onCopy?: () => void;
  onTryCode?: (code: string) => void;
  onSendToEditor?: (code: string) => void;
  onRun?: (code: string) => void;
  hideHeader?: boolean;
  enableExecute?: boolean;
  initialCollapsed?: boolean;
  collapseAll?: boolean;
}

const SHARED_CODE_THEME = EditorView.theme({
  '&': {
    fontSize: '11.5px',
    fontFamily: 'var(--font-mono)',
    backgroundColor: 'var(--monokai-bg)',
    borderRadius: '0 0 8px 8px',
  },
  '.cm-content': {
    padding: '8px 12px',
    fontFamily: 'var(--font-mono)',
  },
  '.cm-line': {
    lineHeight: '1.65',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--monokai-sidebar)',
    color: 'var(--monokai-comment)',
    borderRight: '1px solid var(--monokai-border)',
    paddingRight: '6px',
  },
  '.cm-scroller': {
    overflow: 'auto',
  },
});

const SQL_EXT = sql();
const PYTHON_EXT = python();
const JSON_EXT = json();
const JS_EXT = javascript();
const MD_EXT = markdown();
const YAML_EXT = yaml();

const getLangExtension = (lang: string) => {
  switch (lang) {
    case 'sql':
      return SQL_EXT;
    case 'python':
      return PYTHON_EXT;
    case 'json':
      return JSON_EXT;
    case 'javascript':
      return JS_EXT;
    case 'markdown':
      return MD_EXT;
    case 'yaml':
      return YAML_EXT;
    default:
      return null;
  }
};

const CodeHighlightBlockInner: React.FC<CodeHighlightBlockProps> = ({
  code,
  language = 'sql',
  title,
  maxHeight = '420px',
  showLineNumbers = true,
  allowFormat = true,
  initialFormat = false,
  className = '',
  onCopy,
  onTryCode,
  onSendToEditor,
  onRun,
  hideHeader = false,
  enableExecute = true,
  initialCollapsed = true,
  collapseAll,
}) => {
  const uiTheme = useUiTheme(state => state.theme);
  const [copied, setCopied] = useState(false);
  const [isFormatted, setIsFormatted] = useState(initialFormat);
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed ?? true);
  const [isExecuting, setIsExecuting] = useState(false);
  const [execResult, setExecResult] = useState<any[] | null>(null);
  const [execError, setExecError] = useState<string | null>(null);
  const [execDuration, setExecDuration] = useState<number | null>(null);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // 响应外部一键折叠/展开全部代码块变化
  React.useEffect(() => {
    if (typeof collapseAll === 'boolean') {
      setIsCollapsed(collapseAll);
    }
  }, [collapseAll]);

  // 当代码块展开时，立即确保 CodeMirror 渲染与语法高亮就绪
  React.useEffect(() => {
    if (!isCollapsed) {
      setIsVisible(true);
    }
  }, [isCollapsed]);

  // 视口近距离按需唤醒 CodeMirror，显著降低首屏与多代码块切页耗时
  React.useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setIsVisible(true);
      return;
    }

    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '400px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const [editableCode, setEditableCode] = useState(code);
  React.useEffect(() => {
    setEditableCode(code);
  }, [code]);

  const isUserModified = editableCode !== code;

  const normalizedLang = useMemo(() => {
    const l = (language || '').toLowerCase().trim();
    if (['sql', 'duckdb', 'postgresql', 'postgres'].includes(l)) return 'sql';
    if (['python', 'py'].includes(l)) return 'python';
    if (['json'].includes(l)) return 'json';
    if (['js', 'javascript', 'ts', 'typescript', 'jsx', 'tsx'].includes(l)) return 'javascript';
    if (['markdown', 'md'].includes(l)) return 'markdown';
    if (['yaml', 'yml'].includes(l)) return 'yaml';
    return 'text';
  }, [language]);

  const formattedCode = useMemo(() => {
    if (!isFormatted) return editableCode;
    if (normalizedLang === 'sql') {
      try {
        return format(editableCode, { language: 'duckdb', tabWidth: 2, keywordCase: 'upper' });
      } catch {
        try {
          return format(editableCode, { language: 'sql', tabWidth: 2, keywordCase: 'upper' });
        } catch {
          return editableCode;
        }
      }
    }
    if (normalizedLang === 'json') {
      try {
        return JSON.stringify(JSON.parse(editableCode), null, 2);
      } catch {
        return editableCode;
      }
    }
    return editableCode;
  }, [editableCode, isFormatted, normalizedLang]);

  const extensions = useMemo(() => {
    const langExt = getLangExtension(normalizedLang);
    const exts = langExt ? [langExt, SHARED_CODE_THEME] : [SHARED_CODE_THEME];
    if (maxHeight !== 'none') {
      exts.push(EditorView.theme({ '.cm-scroller': { maxHeight } }));
    }
    return exts;
  }, [normalizedLang, maxHeight]);

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedCode);
    setCopied(true);
    onCopy?.();
    setTimeout(() => setCopied(false), 2000);
  };

  const isSql = normalizedLang === 'sql';

  const resultPanelRef = React.useRef<HTMLDivElement>(null);

  // 监听外部「一键全部运行」全局广播通知
  React.useEffect(() => {
    const handleBatchRun = (e: any) => {
      if (!isSql || !enableExecute) return;

      setIsCollapsed(false);

      const report = e?.detail?.report;
      if (report && Array.isArray(report.results)) {
        // 尝试从预计算的报告中直接匹配此代码块的执行结果，避免重复并发发起 DuckDB 查询导致连接争抢
        const normCode = formattedCode.replace(/\s+/g, ' ').trim();
        const rawCode = code.replace(/\s+/g, ' ').trim();

        const matched = report.results.find((r: any) => {
          const rSql = (r.sql || '').replace(/\s+/g, ' ').trim();
          return (
            rSql === normCode ||
            rSql === rawCode ||
            rSql.includes(normCode.slice(0, 35)) ||
            normCode.includes(rSql.slice(0, 35)) ||
            rSql.includes(rawCode.slice(0, 35)) ||
            rawCode.includes(rSql.slice(0, 35))
          );
        });

        setIsExecuting(false);
        if (matched) {
          setExecDuration(matched.durationMs);
          if (matched.success) {
            setExecError(null);
            setExecResult(matched.rows || []);
          } else {
            setExecError(matched.error || '执行出错');
            setExecResult(null);
          }
          setIsResultOpen(true);
        }
        // 关键：当有全局报告分发时，不再回退到单块并发执行，防止 DuckDB 队列锁死
        return;
      }

      // 未命中预执行报告时，安全单块执行
      void handleExecuteSql();
    };

    const handleBatchComplete = () => {
      setIsExecuting(false);
    };

    window.addEventListener('duckdb_run_all_sql_blocks', handleBatchRun);
    window.addEventListener('duckdb_run_all_completed', handleBatchComplete);
    return () => {
      window.removeEventListener('duckdb_run_all_sql_blocks', handleBatchRun);
      window.removeEventListener('duckdb_run_all_completed', handleBatchComplete);
    };
  }, [isSql, enableExecute, formattedCode, code]);

  const handleSendToEditor = () => {
    if (onSendToEditor) {
      onSendToEditor(formattedCode);
    } else if (onTryCode) {
      onTryCode(formattedCode);
    } else {
      window.dispatchEvent(new CustomEvent('duckdb_send_to_editor', { detail: { sql: formattedCode } }));
    }
    setSendSuccess(true);
    toastService.success('已发送到 SQL 编辑器');
    setTimeout(() => setSendSuccess(false), 2000);
  };

  const handleExecuteSql = async () => {
    setIsCollapsed(false);

    // 若外部接管执行（如指标口径详情），仍展开结果区占位，由外部面板展示真实数据；
    // 但笔记正文等场景不传 onRun，必须在本组件内完成执行并就地展示结果。
    if (onRun) {
      onRun(formattedCode);
      return;
    }

    setIsExecuting(true);
    setExecError(null);
    setExecResult(null);
    setIsResultOpen(true);
    const start = performance.now();
    try {
      const rawStatements = splitSqlScript(formattedCode).map(statement => statement.sql);

      let lastRows: any[] = [];
      for (const cleanStmt of rawStatements) {
        let timeoutHandle: any;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            reject(new Error(`SQL 执行超时 (超过 15000ms)`));
          }, 15000);
        });
        const queryPromise = duckDBService.query(cleanStmt.endsWith(';') ? cleanStmt : `${cleanStmt};`);
        const res = await Promise.race([queryPromise, timeoutPromise]).finally(() => {
          if (timeoutHandle) clearTimeout(timeoutHandle);
        });
        if (res && Array.isArray(res)) {
          lastRows = res;
        }
      }
      const duration = Math.round(performance.now() - start);
      setExecResult(lastRows);
      setExecDuration(duration);
      // 广播单块 SQL 执行结果，驱动知识资产本体图谱实时同步
      window.dispatchEvent(
        new CustomEvent('duckdb_sql_block_executed', {
          detail: {
            sql: formattedCode,
            rows: lastRows,
            columns: lastRows && lastRows.length > 0 ? Object.keys(lastRows[0]) : [],
            rowCount: lastRows ? lastRows.length : 0,
            durationMs: duration,
            success: true,
          },
        })
      );
      // 结果出来后滚入视口，避免长 SQL 下方结果被挡住
      requestAnimationFrame(() => {
        resultPanelRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
      });
    } catch (err: any) {
      const duration = Math.round(performance.now() - start);
      setExecDuration(duration);
      setExecError(err?.message || String(err));
      window.dispatchEvent(
        new CustomEvent('duckdb_sql_block_executed', {
          detail: {
            sql: formattedCode,
            durationMs: duration,
            success: false,
            error: err?.message || String(err),
          },
        })
      );
      requestAnimationFrame(() => {
        resultPanelRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const lineCount = useMemo(() => formattedCode.split('\n').length, [formattedCode]);
  const isFormattable = normalizedLang === 'sql' || normalizedLang === 'json';

  return (
    <div
      ref={containerRef}
      data-code-block="true"
      data-sql-snippet={formattedCode.slice(0, 100)}
      className={`code-highlight-block-container rounded-xl border border-monokai-border bg-monokai-bg overflow-hidden font-sans shadow-xs my-2.5 transition-all duration-300 ${className}`}
      style={
        // 结果面板展开时禁用 content-visibility，否则浏览器可能按 containIntrinsicSize
        // 把结果区裁切/跳过绘制，表现为「执行了但看不到结果」
        isResultOpen || !isCollapsed
          ? undefined
          : { contentVisibility: 'auto', containIntrinsicSize: '0 32px' }
      }
    >
      {/* Header Bar */}
      {!hideHeader && (
        <div
          className={`flex min-h-8 flex-wrap items-center justify-between gap-x-2 gap-y-1 px-3 py-1 bg-monokai-surface text-[10px] transition-colors cursor-pointer select-none ${
            !isCollapsed || isResultOpen ? 'border-b border-monokai-border' : ''
          }`}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('button')) return;
            setIsCollapsed((prev) => !prev);
          }}
          title={isCollapsed ? '点击展开代码' : '点击折叠代码'}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsCollapsed((prev) => !prev);
              }}
              className="text-monokai-comment hover:text-monokai-accent p-0.5 rounded transition-colors cursor-pointer"
              title={isCollapsed ? '展开代码块' : '折叠代码块'}
            >
              <ChevronRight
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  !isCollapsed ? 'rotate-90 text-monokai-accent' : ''
                }`}
              />
            </button>
            <FileCode2 className="w-3.5 h-3.5 text-monokai-accent shrink-0" />
            <span className="font-semibold text-monokai-fg-muted truncate">
              {title || (normalizedLang === 'sql' ? 'SQL STATEMENT' : `${normalizedLang.toUpperCase()} SNIPPET`)}
            </span>
            <span className="shrink-0 text-monokai-comment font-mono text-[9px]">({lineCount} 行)</span>
            {isCollapsed && (
              <span className="text-monokai-comment font-mono text-[10px] truncate max-w-xs md:max-w-md hidden sm:inline ml-1.5 opacity-70">
                {formattedCode.trim().split('\n')[0].slice(0, 55)}
                {formattedCode.trim().split('\n')[0].length > 55 || lineCount > 1 ? ' ...' : ''}
              </span>
            )}
          </div>

          <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            {/* 执行 SQL 按钮 */}
            {isSql && enableExecute && (
              <button
                type="button"
                onClick={handleExecuteSql}
                disabled={isExecuting}
                className="flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-medium bg-monokai-accent text-monokai-on-accent hover:bg-monokai-accent-hover active:bg-monokai-accent-hover disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
                title="直接就地执行当前 SQL (会自动展开代码)"
              >
                {isExecuting ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>执行中...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 fill-current" />
                    <span>执行 SQL</span>
                  </>
                )}
              </button>
            )}

            {/* 发送到 SQL 编辑器 按钮 */}
            {isSql && (
              <button
                type="button"
                onClick={handleSendToEditor}
                aria-label={sendSuccess ? '已发送到 SQL 编辑器' : '在编辑器中运行 (发送到 SQL 编辑器)'}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-monokai-cyan bg-monokai-cyan/10 hover:bg-monokai-cyan/20 border border-monokai-cyan/30 hover:border-monokai-cyan transition-colors cursor-pointer"
                title="在编辑器中运行，将 SQL 自动带入 SQL 编辑器继续编辑执行"
              >
                {sendSuccess ? (
                  <>
                    <Check className="w-3 h-3" />
                    <span>已发送</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3 h-3" />
                    <span>发送到 SQL 编辑器</span>
                  </>
                )}
              </button>
            )}

            {/* 格式化 */}
            {allowFormat && isFormattable && (
              <button
                type="button"
                onClick={() => setIsFormatted((prev) => !prev)}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors cursor-pointer border ${
                  isFormatted
                    ? 'bg-monokai-accent/15 text-monokai-accent border-monokai-accent/30 font-semibold'
                    : 'bg-transparent text-monokai-comment hover:text-monokai-fg border-monokai-border hover:bg-monokai-hover'
                }`}
                title="美化格式化代码"
              >
                <Sparkles className="w-2.5 h-2.5" />
                <span>{isFormatted ? '已格式化' : '格式化'}</span>
              </button>
            )}

            {/* 已修改状态提示与重置 */}
            {isUserModified && (
              <button
                type="button"
                onClick={() => {
                  setEditableCode(code);
                  toastService.info('已重置为原教程代码');
                }}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-monokai-yellow bg-monokai-yellow/10 hover:bg-monokai-yellow/20 border border-monokai-yellow/30 transition-colors cursor-pointer"
                title="已修改代码，点击恢复为教程初始代码"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>已修改 · 重置</span>
              </button>
            )}

            {/* 复制 */}
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-monokai-comment hover:text-monokai-fg hover:bg-monokai-hover border border-transparent hover:border-monokai-border transition-all cursor-pointer"
              title="复制代码到剪贴板"
            >
              {copied ? <Check className="w-3 h-3 text-monokai-accent" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? '已复制' : '复制'}</span>
            </button>

            {/* 单个代码块快速展开/折叠指示按钮 */}
            <button
              type="button"
              onClick={() => setIsCollapsed((prev) => !prev)}
              className="px-1.5 py-0.5 rounded text-[10px] text-monokai-comment hover:text-monokai-fg hover:bg-monokai-hover transition-colors cursor-pointer"
              title={isCollapsed ? '展开代码' : '折叠代码'}
            >
              <span>{isCollapsed ? '展开' : '折叠'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Code Area: 折叠状态时不渲染内部编辑器，支持原地编辑实时驱动右侧本体 */}
      {!isCollapsed && (
        <div className="relative min-h-[44px]">
          {isVisible ? (
            <CodeMirror
              value={formattedCode}
              onChange={(val) => setEditableCode(val)}
              extensions={extensions}
              theme={uiTheme === 'light' ? lightEditorTheme : monokai}
              editable={!isExecuting}
              basicSetup={{
                lineNumbers: showLineNumbers,
                foldGutter: false,
                highlightActiveLine: true,
              }}
              className="text-[11px] custom-scrollbar selection:bg-monokai-accent/20"
            />
          ) : (
            <pre
              className="p-3 text-[11px] font-mono leading-[1.65] text-monokai-fg-muted bg-monokai-bg overflow-x-auto select-text m-0 whitespace-pre"
              style={{ maxHeight: maxHeight !== 'none' ? maxHeight : undefined }}
            >
              <code>{formattedCode}</code>
            </pre>
          )}
        </div>
      )}

      {/* 就地执行结果面板 */}
      {isResultOpen && (
        <div ref={resultPanelRef} className="border-t border-monokai-border bg-monokai-sidebar">
          {/* Result Bar */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-monokai-elevated border-b border-monokai-border/60 text-[10px]">
            <div className="flex items-center gap-2">
              {isExecuting ? (
                <span className="flex items-center gap-1 text-monokai-accent font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>执行中...</span>
                </span>
              ) : execError ? (
                <span className="flex items-center gap-1 text-red-400 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>执行异常</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-monokai-accent font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>执行完成</span>
                </span>
              )}
              {execDuration !== null && !isExecuting && (
                <span className="text-zinc-500 font-mono text-[10px]">({execDuration} ms)</span>
              )}
              {!isExecuting && execResult && (
                <span className="text-monokai-comment font-mono text-[10px]">
                  {execResult.length} 行 · {execResult.length > 0 ? Object.keys(execResult[0]).length : 0} 列
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsResultOpen(false)}
              className="flex items-center gap-1 text-[10px] text-monokai-comment hover:text-monokai-fg px-1.5 py-0.5 rounded hover:bg-monokai-hover transition-colors cursor-pointer"
              title="收起结果面板"
            >
              <ChevronUp className="w-3 h-3" />
              <span>收起结果</span>
            </button>
          </div>

          {/* Result Body */}
          <div className="max-h-[220px] overflow-auto custom-scrollbar p-2">
            {isExecuting ? (
              <div className="p-4 text-center text-zinc-500 text-[11px] flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-monokai-accent" />
                <span>DuckDB WASM 正在计算中...</span>
              </div>
            ) : execError ? (
              <div className="p-2.5 rounded bg-red-950/40 border border-red-800/40 text-red-300 font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
                {execError}
              </div>
            ) : !execResult || execResult.length === 0 ? (
              <div className="p-3 text-center text-zinc-500 text-[11px]">
                语句已成功执行，无返回数据行（例如 DDL/DML 操作）。
              </div>
            ) : (
              <table className="w-full text-left border-collapse font-mono text-[11px]">
                <thead>
                  <tr className="border-b border-monokai-border bg-monokai-elevated/80 sticky top-0">
                    {Object.keys(execResult[0]).map((col) => (
                      <th key={col} className="px-2.5 py-1 text-monokai-accent font-semibold tracking-wider">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-monokai-border/50">
                  {execResult.slice(0, 50).map((row, idx) => (
                    <tr key={idx} className="hover:bg-monokai-elevated/80 text-monokai-fg-muted">
                      {Object.keys(execResult[0]).map((col) => (
                        <td key={col} className="px-2.5 py-1 whitespace-nowrap">
                          {row[col] !== null && row[col] !== undefined ? (
                            String(row[col])
                          ) : (
                            <span className="text-zinc-600 italic">NULL</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!isExecuting && execResult && execResult.length > 50 && (
              <div className="text-[10px] text-zinc-500 text-center py-1 mt-1 font-mono">
                (仅显示前 50 行，共 {execResult.length} 行)
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const CodeHighlightBlock = React.memo(CodeHighlightBlockInner);
export default CodeHighlightBlock;
