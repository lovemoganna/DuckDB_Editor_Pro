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
  X
} from 'lucide-react';
import { format } from 'sql-formatter';
import { duckDBService } from '../../services/duckdbService';
import { toastService } from '../../services/toastService';

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
    fontFamily: "'JetBrains Mono', 'Victor Mono', 'Roboto Mono', monospace",
    backgroundColor: '#0c0f0d',
    borderRadius: '0 0 8px 8px',
  },
  '.cm-content': {
    padding: '8px 12px',
    fontFamily: "'JetBrains Mono', 'Victor Mono', 'Roboto Mono', monospace",
  },
  '.cm-line': {
    lineHeight: '1.65',
  },
  '.cm-gutters': {
    backgroundColor: '#111613',
    color: '#525e54',
    borderRight: '1px solid #22331c',
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
    if (!isFormatted) return code;
    if (normalizedLang === 'sql') {
      try {
        return format(code, { language: 'duckdb', tabWidth: 2, keywordCase: 'upper' });
      } catch {
        try {
          return format(code, { language: 'sql', tabWidth: 2, keywordCase: 'upper' });
        } catch {
          return code;
        }
      }
    }
    if (normalizedLang === 'json') {
      try {
        return JSON.stringify(JSON.parse(code), null, 2);
      } catch {
        return code;
      }
    }
    return code;
  }, [code, isFormatted, normalizedLang]);

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
    const handleBatchRun = () => {
      if (isSql && enableExecute) {
        setIsCollapsed(false);
        void handleExecuteSql();
      }
    };
    window.addEventListener('duckdb_run_all_sql_blocks', handleBatchRun);
    return () => {
      window.removeEventListener('duckdb_run_all_sql_blocks', handleBatchRun);
    };
  }, [isSql, enableExecute, formattedCode]);

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
      const rawStatements = formattedCode
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
      setExecResult(lastRows);
      setExecDuration(duration);
      // 结果出来后滚入视口，避免长 SQL 下方结果被挡住
      requestAnimationFrame(() => {
        resultPanelRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
      });
    } catch (err: any) {
      const duration = Math.round(performance.now() - start);
      setExecDuration(duration);
      setExecError(err?.message || String(err));
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
      className={`rounded-xl border border-[#22331c] bg-[#0c0f0d] overflow-hidden font-sans shadow-xs my-2.5 ${className}`}
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
          className={`flex h-8 items-center justify-between px-3 bg-[#141a15] text-[10px] transition-colors cursor-pointer select-none ${
            !isCollapsed || isResultOpen ? 'border-b border-[#22331c]' : ''
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
              className="text-zinc-400 hover:text-[#a3e635] p-0.5 rounded transition-colors cursor-pointer"
              title={isCollapsed ? '展开代码块' : '折叠代码块'}
            >
              <ChevronRight
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  !isCollapsed ? 'rotate-90 text-[#a3e635]' : ''
                }`}
              />
            </button>
            <FileCode2 className="w-3.5 h-3.5 text-[#a3e635] shrink-0" />
            <span className="font-semibold text-zinc-300 truncate">
              {title || (normalizedLang === 'sql' ? 'SQL STATEMENT' : `${normalizedLang.toUpperCase()} SNIPPET`)}
            </span>
            <span className="text-zinc-500 font-mono text-[9px]">({lineCount} 行)</span>
            {isCollapsed && (
              <span className="text-zinc-500 font-mono text-[10px] truncate max-w-xs md:max-w-md hidden sm:inline ml-1.5 opacity-70">
                {formattedCode.trim().split('\n')[0].slice(0, 55)}
                {formattedCode.trim().split('\n')[0].length > 55 || lineCount > 1 ? ' ...' : ''}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            {/* 执行 SQL 按钮 */}
            {isSql && enableExecute && (
              <button
                type="button"
                onClick={handleExecuteSql}
                disabled={isExecuting}
                className="flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-medium bg-[#a3e635] text-zinc-950 hover:bg-[#bef264] active:bg-[#84cc16] disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
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
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-sky-400 bg-sky-950/40 hover:bg-sky-900/60 border border-sky-800/50 hover:border-sky-700 transition-colors cursor-pointer"
                title="将 SQL 自动带入 SQL 编辑器继续编辑执行"
              >
                {sendSuccess ? (
                  <>
                    <Check className="w-3 h-3 text-sky-300" />
                    <span className="text-sky-300">已发送</span>
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
                    ? 'bg-[#a3e635]/15 text-[#a3e635] border-[#a3e635]/30 font-semibold'
                    : 'bg-transparent text-zinc-400 hover:text-zinc-200 border-[#22331c] hover:bg-[#1f2a20]'
                }`}
                title="美化格式化代码"
              >
                <Sparkles className="w-2.5 h-2.5" />
                <span>{isFormatted ? '已格式化' : '格式化'}</span>
              </button>
            )}

            {/* 复制 */}
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-zinc-400 hover:text-zinc-200 hover:bg-[#1f2a20] border border-transparent hover:border-[#22331c] transition-all cursor-pointer"
              title="复制代码到剪贴板"
            >
              {copied ? <Check className="w-3 h-3 text-[#a3e635]" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? '已复制' : '复制'}</span>
            </button>

            {/* 单个代码块快速展开/折叠指示按钮 */}
            <button
              type="button"
              onClick={() => setIsCollapsed((prev) => !prev)}
              className="px-1.5 py-0.5 rounded text-[10px] text-zinc-400 hover:text-zinc-200 hover:bg-[#1f2a20] transition-colors cursor-pointer"
              title={isCollapsed ? '展开代码' : '折叠代码'}
            >
              <span>{isCollapsed ? '展开' : '折叠'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Code Area: 折叠状态时不渲染内部编辑器，保持极致紧凑与极速渲染 */}
      {!isCollapsed && (
        <div className="relative min-h-[44px]">
          {isVisible ? (
            <CodeMirror
              value={formattedCode}
              extensions={extensions}
              theme={monokai}
              editable={false}
              basicSetup={{
                lineNumbers: showLineNumbers,
                foldGutter: false,
                highlightActiveLine: false,
              }}
              className="text-[11px] custom-scrollbar selection:bg-[#a3e635]/20"
            />
          ) : (
            <pre
              className="p-3 text-[11px] font-mono leading-[1.65] text-zinc-300 bg-[#0c0f0d] overflow-x-auto select-text m-0 whitespace-pre"
              style={{ maxHeight: maxHeight !== 'none' ? maxHeight : undefined }}
            >
              <code>{formattedCode}</code>
            </pre>
          )}
        </div>
      )}

      {/* 就地执行结果面板 */}
      {isResultOpen && (
        <div ref={resultPanelRef} className="border-t border-[#22331c] bg-[#111613]">
          {/* Result Bar */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#161d17] border-b border-[#22331c]/60 text-[10px]">
            <div className="flex items-center gap-2">
              {isExecuting ? (
                <span className="flex items-center gap-1 text-[#a3e635] font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>执行中...</span>
                </span>
              ) : execError ? (
                <span className="flex items-center gap-1 text-red-400 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>执行异常</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[#a3e635] font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>执行完成</span>
                </span>
              )}
              {execDuration !== null && !isExecuting && (
                <span className="text-zinc-500 font-mono text-[10px]">({execDuration} ms)</span>
              )}
              {!isExecuting && execResult && (
                <span className="text-zinc-400 font-mono text-[10px]">
                  {execResult.length} 行 · {execResult.length > 0 ? Object.keys(execResult[0]).length : 0} 列
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsResultOpen(false)}
              className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-200 px-1.5 py-0.5 rounded hover:bg-[#1f2a20] transition-colors cursor-pointer"
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
                <Loader2 className="w-4 h-4 animate-spin text-[#a3e635]" />
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
                  <tr className="border-b border-[#22331c] bg-[#161d17]/80 sticky top-0">
                    {Object.keys(execResult[0]).map((col) => (
                      <th key={col} className="px-2.5 py-1 text-[#a3e635] font-semibold tracking-wider">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#22331c]/50">
                  {execResult.slice(0, 50).map((row, idx) => (
                    <tr key={idx} className="hover:bg-[#161d17]/80 text-zinc-300">
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
