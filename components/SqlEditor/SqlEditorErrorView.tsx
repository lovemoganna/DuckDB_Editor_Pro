/**
 * SqlEditorErrorView — Renders a query execution error.
 *
 * Extracted from SqlEditor.tsx (Loop 5 of SqlEditor Pro refactor).
 * Provides "Fix with AI" and "Continue optimize" action buttons.
 */

import React from 'react';
import { Loader2, Sparkles, Wand2 } from 'lucide-react';

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
  const lineCount = error.split('\n').length;

  return (
    <div className="p-4 h-full flex flex-col">
      {/* Error Bar */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-monokai-pink" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-monokai-pink/70">Error</span>
        </div>
        <div className="h-px flex-1 bg-monokai-pink/20" />
        <span className="text-[9px] text-monokai-comment/40 font-mono">catalog</span>
      </div>

      {/* Error Box */}
      <div className="flex-1 overflow-hidden rounded border border-monokai-pink/30 bg-monokai-bg flex flex-col">
        <div className="px-3 py-2 bg-monokai-pink/8 border-b border-monokai-pink/20 flex items-center gap-2 shrink-0">
          <span className="text-[9px] font-mono text-monokai-pink/50 uppercase tracking-widest">Details</span>
          <div className="h-px flex-1 bg-monokai-pink/10" />
          <span className="text-[9px] text-monokai-pink/30">{lineCount} lines</span>
        </div>
        <div className="flex-1 overflow-auto p-3 custom-scrollbar">
          <pre className="text-[11px] font-mono leading-relaxed text-monokai-pink whitespace-pre-wrap">{error}</pre>
        </div>
      </div>

      {/* Actions Row */}
      <div className="flex items-center gap-2 mt-3 px-1">
        <button
          onClick={onFixWithAi}
          disabled={isFixing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-monokai-amethyst/15 hover:bg-monokai-amethyst/25 border border-monokai-amethyst/40 text-monokai-amethyst text-[11px] font-bold rounded transition-colors disabled:opacity-40"
        >
          {isFixing
            ? <><Loader2 size={11} className="animate-spin" /> <span>Analyzing...</span></>
            : <><Sparkles size={11} /> <span>Fix with AI</span></>}
        </button>
        <button
          onClick={onContinueOptimize}
          disabled={isAiLoading || !hasCode}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-monokai-green/10 hover:bg-monokai-green/20 border border-monokai-green/30 text-monokai-green text-[11px] font-bold rounded transition-colors disabled:opacity-40"
          title="基于当前 SQL 继续优化"
        >
          <Wand2 size={11} /> 继续优化
        </button>
        <div className="h-3 w-px bg-monokai-accent/30 mx-1" />
        <span className="text-[10px] text-monokai-comment/40">or edit SQL and run again</span>
      </div>
    </div>
  );
};

export default SqlEditorErrorView;
