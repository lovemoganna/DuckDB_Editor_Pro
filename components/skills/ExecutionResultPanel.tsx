/**
 * ExecutionResultPanel Component
 * 
 * 共享的执行结果展示组件。
 * 从 SkillAssistant 和 SkillPanel 中提取的重复逻辑。
 */

import React from 'react';
import { Check, AlertCircle, Copy, CheckCircle2 } from 'lucide-react';
import { SkillResult } from '../../types';

interface ExecutionResultPanelProps {
  result: SkillResult;
  onInsert?: () => void;
  onCopy?: () => void;
  showInsertButton?: boolean;
  insertButtonText?: string;
  /** When provided, shows the live streaming SQL instead of the final result.sql */
  streamingSql?: string;
  className?: string;
}

export const ExecutionResultPanel: React.FC<ExecutionResultPanelProps> = ({
  result,
  onInsert,
  onCopy,
  showInsertButton = true,
  insertButtonText = '插入到编辑器',
  streamingSql,
  className = '',
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    if (result.sql) {
      await navigator.clipboard.writeText(result.sql);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!result.success) {
    return (
      <div className={`p-4 border border-monokai-red/25 bg-monokai-red/5 rounded-lg animate-fade-in-up ${className}`}>
        <div className="flex items-start gap-2 text-monokai-red">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <span className="text-xs font-medium font-sans">执行失败</span>
            <p className="text-xs mt-1 opacity-80 font-sans">{result.error}</p>
            {result.warnings && result.warnings.length > 0 && (
              <div className="mt-2 space-y-1">
                {result.warnings.map((warning, idx) => (
                  <p key={idx} className="text-xs text-monokai-yellow font-sans">
                    {warning}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 border border-monokai-green/25 bg-monokai-green/5 rounded-lg animate-fade-in-up ${className}`}>
      <div className="space-y-3">
        {/* 成功标题 */}
        <div className="flex items-center gap-2 text-monokai-green">
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-xs font-medium font-sans">SQL 生成成功</span>
          {result.executionTime && (
            <span className="text-xs text-monokai-comment font-sans">
              ({result.executionTime}ms)
            </span>
          )}
        </div>

        {/* SQL 代码展示 */}
        {result.sql && (
          <pre className="p-3 bg-monokai-sidebar/60 rounded-lg overflow-x-auto text-xs font-mono text-monokai-fg custom-scrollbar max-h-48 border border-monokai-accent/30">
            {result.sql}
          </pre>
        )}

        {/* Streaming SQL (replaces static SQL display when still streaming) */}
        {streamingSql && (
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] text-monokai-comment/70 font-sans">流式输出</span>
            </div>
            <pre className="p-3 bg-monokai-sidebar/60 rounded-lg overflow-x-auto text-xs font-mono text-monokai-fg custom-scrollbar max-h-48 border border-monokai-amethyst/20">
              {streamingSql}
              <span className="inline-block w-2 h-3.5 bg-monokai-amethyst ml-0.5 animate-pulse align-middle" />
            </pre>
          </div>
        )}

        {/* 说明文字 */}
        {result.explanation && (
          <div className="p-3 bg-monokai-bg/50 rounded-lg">
            <span className="text-xs font-medium text-monokai-comment font-sans">说明:</span>
            <p className="text-xs text-monokai-fg mt-1 font-sans">{result.explanation}</p>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-2">
          {showInsertButton && onInsert && (
            <button
              onClick={onInsert}
              className="flex-1 px-4 py-2 text-sm font-medium bg-gradient-to-r from-monokai-green to-emerald-500 text-white rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2 font-sans"
            >
              <Check className="w-4 h-4" />
              {insertButtonText}
            </button>
          )}
          <button
            onClick={handleCopy}
            className="px-4 py-2 text-sm font-medium bg-monokai-accent/20 text-monokai-fg rounded-lg hover:bg-monokai-accent/40 transition-all flex items-center justify-center gap-2 font-sans"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                已复制
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                复制
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExecutionResultPanel;
