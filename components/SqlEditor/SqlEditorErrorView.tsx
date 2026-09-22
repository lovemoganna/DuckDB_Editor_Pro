/**
 * SqlEditorErrorView — Renders a query execution error.
 *
 * Extracted from SqlEditor.tsx (Loop 5 of SqlEditor Pro refactor).
 * Provides "Fix with AI" and "Continue optimize" action buttons.
 */

import React from 'react';
import { Loader2, Sparkles, Wand2, Check, Copy } from 'lucide-react';

export interface SqlEditorErrorViewProps {
  error: string;
  isFixing: boolean;
  isAiLoading: boolean;
  hasCode: boolean;
  onFixWithAi: () => void;
  onContinueOptimize: () => void;
}

export const SqlEditorErrorView: React.FC<SqlEditorErrorViewProps> = ({
  error,
  isFixing,
  isAiLoading,
  hasCode,
  onFixWithAi,
  onContinueOptimize,
}) => {
  const [copied, setCopied] = React.useState(false);
  const lineCount = (error || '').split('\n').length;

  const handleCopyError = () => {
    navigator.clipboard.writeText(error);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 h-full flex flex-col bg-monokai-bg font-sans">
      {/* Error Bar */}
      <div className="flex items-center justify-between gap-2 mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-monokai-pink" />
          <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-monokai-pink">执行异常 (Execution Error)</span>
          <span className="text-[10px] text-monokai-comment font-mono bg-monokai-surface border border-monokai-border px-2 py-0.5 rounded-md">{lineCount} 行诊断日志</span>
        </div>
        <button
          onClick={handleCopyError}
          className="text-xs font-medium text-monokai-comment hover:text-monokai-fg bg-monokai-surface/60 hover:bg-monokai-surface border border-monokai-border px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95"
          title="复制错误信息到剪贴板"
        >
          {copied ? <><Check size={12} className="text-monokai-green" /> <span>已复制</span></> : <><Copy size={12} /> <span>复制日志</span></>}
        </button>
      </div>

      {/* Error Box */}
      <div className="flex-1 overflow-hidden rounded-xl border border-monokai-border bg-monokai-sidebar flex flex-col shadow-xs">
        <div className="px-3.5 py-2 bg-monokai-surface/80 border-b border-monokai-border flex items-center gap-2 shrink-0">
          <span className="text-[10.5px] font-mono text-monokai-pink uppercase tracking-wider font-bold">详细诊断信息</span>
          <div className="h-px flex-1 bg-monokai-border" />
        </div>
        <div className="flex-1 overflow-auto p-4 custom-scrollbar bg-monokai-bg">
          <pre className="text-[11px] font-mono leading-relaxed text-monokai-pink/90 whitespace-pre-wrap selection:bg-monokai-pink/20">{error}</pre>
        </div>
      </div>

      {/* Actions Row */}
      <div className="flex items-center gap-2.5 mt-3 px-1">
        <button
          onClick={onFixWithAi}
          disabled={isFixing}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-monokai-amethyst text-monokai-bg text-xs font-bold rounded-lg transition-all disabled:opacity-40 cursor-pointer shadow-xs hover:brightness-110 active:scale-95"
        >
          {isFixing
            ? <><Loader2 size={13} className="animate-spin" /> <span>AI 诊断修复中...</span></>
            : <><Sparkles size={13} /> <span>AI 智能修复</span></>}
        </button>
        <button
          onClick={onContinueOptimize}
          disabled={isAiLoading || !hasCode}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-monokai-green/15 hover:bg-monokai-green/25 border border-monokai-border text-monokai-green text-xs font-bold rounded-lg transition-all disabled:opacity-40 cursor-pointer active:scale-95"
          title="基于当前 SQL 继续优化"
        >
          <Wand2 size={13} />
          <span>继续优化</span>
        </button>
        <div className="h-3.5 w-px bg-monokai-border/70 mx-1" />
        <span className="text-[11px] text-monokai-comment">或直接在上方编辑器中修改 SQL 并重新按 Ctrl+Enter 执行</span>
      </div>
    </div>
  );
};

export default SqlEditorErrorView;
