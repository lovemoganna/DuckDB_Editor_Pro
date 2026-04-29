/**
 * SkillResultCard - SQL execution result display
 *
 * Displays the generated SQL with explanation, copy/insert actions,
 * and success/error states. Uses unified design system tokens.
 */

import React, { useState } from 'react';
import {
  Check, AlertCircle, Copy, ArrowUpRight, RefreshCw,
  Loader2,
} from 'lucide-react';
import { SkillResult } from '../../types';
import {
  SEMANTIC_THEME,
} from '../theme';

interface SkillResultCardProps {
  result: SkillResult;
  isExecuting?: boolean;
  onInsert?: (sql: string) => void;
  onRetry?: () => void;
  intentLabel?: string;
  intentColor?: string;
  intentBg?: string;
  intentBorder?: string;
}

export const SkillResultCard: React.FC<SkillResultCardProps> = ({
  result,
  isExecuting = false,
  onInsert,
  onRetry,
  intentLabel,
  intentColor,
  intentBg,
  intentBorder,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isExecuting) {
    return (
      <div className="skill-result-card border-monokai-accent/50 bg-monokai-sidebar/40 p-4">
        <div className="flex items-center gap-2 text-monokai-fg">
          <Loader2 className="w-4 h-4 animate-spin text-monokai-purple" />
          <span className="text-sm font-medium">生成中...</span>
        </div>
      </div>
    );
  }

  if (!result.success) {
    return (
      <div className="skill-result-card error skill-result-card-error">
        <div className="flex items-start gap-2.5 text-monokai-red">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold">生成失败</span>
            <p className="text-xs mt-1 opacity-80 leading-relaxed">{result.error}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-3 flex items-center gap-1.5 px-3 py-1.5 text-xs bg-monokai-accent/20 hover:bg-monokai-accent/30 text-monokai-fg rounded-lg transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                重试
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="skill-result-card success skill-result-card-success animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-monokai-green">
          <Check className="w-4 h-4" />
          <span className="text-sm font-semibold">SQL 生成成功</span>
        </div>
        {intentLabel && (
          <span className={`px-2.5 py-0.5 text-[10px] font-semibold rounded-md border ${intentBg || ''} ${intentColor || ''} ${intentBorder || ''}`}>
            {intentLabel}
          </span>
        )}
      </div>

      {/* SQL Code */}
      {result.sql && (
        <div className="relative group mb-3">
          <pre className="skill-sql-block max-h-56 overflow-y-auto">
            {result.sql}
          </pre>
          <button
            onClick={() => handleCopy(result.sql!, 'sql')}
            className="absolute top-2 right-2 p-1.5 bg-monokai-accent/40 hover:bg-monokai-accent rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
            title="复制 SQL"
          >
            {copiedId === 'sql' ? (
              <Check className="w-3 h-3 text-monokai-green" />
            ) : (
              <Copy className="w-3 h-3 text-monokai-fg" />
            )}
          </button>
        </div>
      )}

      {/* Explanation */}
      {result.explanation && (
        <div className="p-2.5 bg-monokai-bg/50 rounded-lg border border-monokai-accent/20 mb-3">
          <span className="text-[10px] font-medium text-monokai-comment uppercase tracking-wider block mb-1">说明</span>
          <p className="text-xs text-monokai-fg leading-relaxed">{result.explanation}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => onInsert?.(result.sql!)}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold bg-gradient-to-r from-monokai-green to-emerald-500 text-white rounded-lg hover:opacity-90 transition-all skill-btn-primary shadow-md"
        >
          <ArrowUpRight className="w-4 h-4" />
          插入到编辑器
        </button>
        <button
          onClick={() => handleCopy(result.sql!, 'sql2')}
          className="px-4 py-2 text-sm font-medium bg-monokai-accent/20 hover:bg-monokai-accent/30 text-monokai-fg rounded-lg transition-all flex items-center gap-2"
        >
          {copiedId === 'sql2' ? (
            <>
              <Check className="w-3.5 h-3.5 text-monokai-green" />
              已复制
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              复制
            </>
          )}
        </button>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 text-sm font-medium bg-monokai-accent/20 hover:bg-monokai-accent/30 text-monokai-fg rounded-lg transition-all flex items-center gap-2"
            title="重新生成"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default SkillResultCard;
