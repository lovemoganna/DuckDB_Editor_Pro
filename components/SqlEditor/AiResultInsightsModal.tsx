import React, { useState } from 'react';
import { Sparkles, X, BarChart2, Table, Clock, Check, Copy } from 'lucide-react';
import MarkdownPreview from '../MarkdownPreview';
import type { QueryResult } from '../../types';

export interface AiResultInsightsModalProps {
  isOpen: boolean;
  result: QueryResult | null;
  insightMarkdown: string;
  isLoading: boolean;
  onClose: () => void;
}

export const AiResultInsightsModal: React.FC<AiResultInsightsModalProps> = ({
  isOpen,
  result,
  insightMarkdown,
  isLoading,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(insightMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 p-4 select-none">
      <div className="bg-monokai-sidebar border border-monokai-border rounded-xl shadow-2xl max-w-3xl w-full flex flex-col max-h-[85vh] overflow-hidden text-monokai-fg">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-monokai-border bg-monokai-bg/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-monokai-surface border border-monokai-border flex items-center justify-center text-monokai-blue">
              <BarChart2 size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-monokai-fg flex items-center gap-2">
                AI 结果集数据洞察与业务解读
              </h3>
              <p className="text-[11px] text-monokai-comment">基于当前查询结果集（共 {result?.rows.length || 0} 行数据）自动归纳业务结论与异常项。</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-monokai-surface flex items-center justify-center text-monokai-comment hover:text-monokai-pink transition-colors cursor-pointer"
            title="关闭窗口"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-4 select-text">
          
          {/* Quick Metrics Bar */}
          {result && (
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-monokai-bg/80 border border-monokai-border rounded-lg flex items-center gap-3 shadow-xs">
                <div className="w-8 h-8 rounded-md bg-monokai-surface text-monokai-green flex items-center justify-center border border-monokai-border shrink-0">
                  <Table size={15} />
                </div>
                <div>
                  <div className="text-[10px] text-monokai-comment font-mono">结果总行数</div>
                  <div className="text-xs font-bold font-mono text-monokai-fg">{result.rows.length.toLocaleString()} 行</div>
                </div>
              </div>
              <div className="p-3 bg-monokai-bg/80 border border-monokai-border rounded-lg flex items-center gap-3 shadow-xs">
                <div className="w-8 h-8 rounded-md bg-monokai-surface text-monokai-amethyst flex items-center justify-center border border-monokai-border shrink-0">
                  <BarChart2 size={15} />
                </div>
                <div>
                  <div className="text-[10px] text-monokai-comment font-mono">字段维度数</div>
                  <div className="text-xs font-bold font-mono text-monokai-fg">{result.columns.length} 个字段</div>
                </div>
              </div>
              <div className="p-3 bg-monokai-bg/80 border border-monokai-border rounded-lg flex items-center gap-3 shadow-xs">
                <div className="w-8 h-8 rounded-md bg-monokai-surface text-monokai-yellow flex items-center justify-center border border-monokai-border shrink-0">
                  <Clock size={15} />
                </div>
                <div>
                  <div className="text-[10px] text-monokai-comment font-mono">查询执行耗时</div>
                  <div className="text-xs font-bold font-mono text-monokai-fg">{(result.executionTime || 0).toFixed(1)} ms</div>
                </div>
              </div>
            </div>
          )}

          {/* AI Markdown Body */}
          <div className="p-4 bg-monokai-bg border border-monokai-border rounded-lg text-xs leading-relaxed overflow-y-auto max-h-[380px] custom-scrollbar">
            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-monokai-comment">
                <Sparkles size={24} className="animate-spin text-monokai-amethyst" />
                <span className="text-xs font-mono">AI 正在深度扫描数据结果分布并生成业务解读...</span>
              </div>
            ) : insightMarkdown ? (
              <MarkdownPreview content={insightMarkdown} />
            ) : (
              <div className="py-8 text-center text-monokai-comment/60 italic font-mono text-xs">暂无生成的洞察报告</div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-monokai-border bg-monokai-bg/90 flex items-center justify-between shrink-0">
          <button
            onClick={handleCopy}
            disabled={!insightMarkdown}
            className="px-3.5 py-1.5 bg-monokai-surface hover:bg-monokai-surface/80 border border-monokai-border/80 text-monokai-fg text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 hover:scale-105 active:scale-95"
          >
            {copied ? <Check size={12} className="text-monokai-green" /> : <Copy size={12} className="text-monokai-comment" />}
            <span>{copied ? '已复制分析报告！' : '复制解读报告'}</span>
          </button>

          <button
            onClick={onClose}
            className="px-4.5 py-1.5 bg-monokai-surface hover:bg-monokai-surface/80 border border-monokai-border/80 text-monokai-fg font-bold text-xs rounded-lg transition-all cursor-pointer hover:scale-105 active:scale-95"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
