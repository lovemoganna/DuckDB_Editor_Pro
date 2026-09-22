import React, { useState } from 'react';
import { Sparkles, Check, Copy, X, ArrowRight, Code, ShieldCheck, AlertCircle } from 'lucide-react';

export interface AiDiffProposalModalProps {
  isOpen: boolean;
  title: string;
  explanation: string;
  originalSql: string;
  proposedSql: string;
  onApply: (finalSql: string) => void;
  onClose: () => void;
}

export const AiDiffProposalModal: React.FC<AiDiffProposalModalProps> = ({
  isOpen,
  title,
  explanation,
  originalSql,
  proposedSql,
  onApply,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'diff' | 'proposed'>('diff');

  if (!isOpen) return null;

  // Simple line-by-line diff algorithm for visual presentation
  const computeDiffLines = () => {
    const origLines = (originalSql || '').split('\n');
    const propLines = (proposedSql || '').split('\n');
    const maxLines = Math.max(origLines.length, propLines.length);
    const diff: Array<{ type: 'same' | 'added' | 'removed' | 'changed'; orig?: string; prop?: string }> = [];

    for (let i = 0; i < maxLines; i++) {
      const orig = origLines[i];
      const prop = propLines[i];

      if (orig === prop) {
        diff.push({ type: 'same', orig, prop });
      } else if (orig !== undefined && prop === undefined) {
        diff.push({ type: 'removed', orig });
      } else if (orig === undefined && prop !== undefined) {
        diff.push({ type: 'added', prop });
      } else {
        diff.push({ type: 'changed', orig, prop });
      }
    }
    return diff;
  };

  const diffLines = computeDiffLines();

  const handleCopy = () => {
    navigator.clipboard.writeText(proposedSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 p-4 select-none">
      <div className="bg-monokai-sidebar border border-monokai-border rounded-xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh] overflow-hidden text-monokai-fg">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-monokai-border bg-monokai-bg/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-monokai-surface border border-monokai-border flex items-center justify-center text-monokai-amethyst">
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-monokai-fg flex items-center gap-2">
                {title}
                <span className="text-[10px] bg-monokai-surface text-monokai-green border border-monokai-border px-2 py-0.5 rounded font-mono flex items-center gap-1">
                  <ShieldCheck size={10} /> 差异审核确认
                </span>
              </h3>
              <p className="text-[11px] text-monokai-comment">AI 优化建议将先由您进行代码差异审核，确认无误后方会更新编辑器内容。</p>
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

        {/* Content Body */}
        <div className="p-5 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-4 select-text">
          
          {/* Explanation Banner */}
          {explanation && (
            <div className="p-3.5 bg-monokai-bg/80 border border-monokai-border rounded-lg text-xs leading-relaxed flex items-start gap-2.5">
              <AlertCircle size={15} className="text-monokai-yellow shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-bold text-monokai-yellow mb-1 font-mono text-[11px]">AI 优化/修复诊断说明：</div>
                <div className="text-monokai-fg/90 whitespace-pre-wrap font-sans text-xs leading-relaxed">{explanation}</div>
              </div>
            </div>
          )}

          {/* Segmented Control Switcher */}
          <div className="flex items-center justify-between border-b border-monokai-border/60 pb-3">
            <div className="flex items-center p-0.5 bg-monokai-bg/90 rounded-lg border border-monokai-border/80">
              <button
                onClick={() => setActiveTab('diff')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'diff'
                    ? 'bg-monokai-surface text-monokai-yellow shadow-xs border border-monokai-border/80'
                    : 'text-monokai-comment hover:text-monokai-fg border border-transparent'
                }`}
              >
                <Code size={12} />
                <span>差异对比 (Diff View)</span>
              </button>
              <button
                onClick={() => setActiveTab('proposed')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'proposed'
                    ? 'bg-monokai-surface text-monokai-green shadow-xs border border-monokai-border/80'
                    : 'text-monokai-comment hover:text-monokai-fg border border-transparent'
                }`}
              >
                <Check size={12} />
                <span>完整新代码</span>
              </button>
            </div>

            <div className="text-[11px] text-monokai-comment font-mono flex items-center gap-3 select-none">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-xs bg-monokai-pink/20 border border-monokai-pink/60 inline-block"></span> 移除原代码</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-xs bg-monokai-green/20 border border-monokai-green/60 inline-block"></span> AI 建议新增</span>
            </div>
          </div>

          {/* Code Diff Display */}
          {activeTab === 'diff' ? (
            <div className="bg-monokai-bg border border-monokai-border rounded-lg p-2.5 font-mono text-xs overflow-x-auto max-h-[360px] custom-scrollbar">
              {diffLines.map((line, idx) => (
                <React.Fragment key={idx}>
                  {line.type === 'same' && (
                    <div className="py-0.5 px-2 text-monokai-fg/70 whitespace-pre font-mono hover:bg-monokai-surface/20 transition-colors">
                      <span className="inline-block w-8 text-monokai-comment/40 text-right pr-3 select-none">{idx + 1}</span>
                      {line.orig}
                    </div>
                  )}
                  {line.type === 'removed' && (
                    <div className="py-0.5 px-2 bg-monokai-pink/15 text-monokai-pink border-l-2 border-monokai-pink whitespace-pre font-mono font-medium">
                      <span className="inline-block w-8 text-monokai-pink/60 text-right pr-3 select-none">-</span>
                      {line.orig}
                    </div>
                  )}
                  {line.type === 'added' && (
                    <div className="py-0.5 px-2 bg-monokai-green/15 text-monokai-green border-l-2 border-monokai-green whitespace-pre font-mono font-medium">
                      <span className="inline-block w-8 text-monokai-green/60 text-right pr-3 select-none">+</span>
                      {line.prop}
                    </div>
                  )}
                  {line.type === 'changed' && (
                    <>
                      <div className="py-0.5 px-2 bg-monokai-pink/15 text-monokai-pink border-l-2 border-monokai-pink whitespace-pre font-mono font-medium">
                        <span className="inline-block w-8 text-monokai-pink/60 text-right pr-3 select-none">-</span>
                        {line.orig}
                      </div>
                      <div className="py-0.5 px-2 bg-monokai-green/15 text-monokai-green border-l-2 border-monokai-green whitespace-pre font-mono font-medium">
                        <span className="inline-block w-8 text-monokai-green/60 text-right pr-3 select-none">+</span>
                        {line.prop}
                      </div>
                    </>
                  )}
                </React.Fragment>
              ))}
            </div>
          ) : (
            <div className="bg-monokai-bg border border-monokai-border rounded-lg p-3 font-mono text-xs text-monokai-fg/90 whitespace-pre-wrap max-h-[360px] overflow-y-auto custom-scrollbar leading-relaxed">
              <code>{proposedSql}</code>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-monokai-border bg-monokai-bg/90 flex items-center justify-between shrink-0">
          <button
            onClick={handleCopy}
            className="px-3.5 py-1.5 bg-monokai-surface hover:bg-monokai-surface/80 border border-monokai-border/80 text-monokai-fg text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 cursor-pointer hover:scale-105 active:scale-95"
          >
            {copied ? <Check size={12} className="text-monokai-green" /> : <Copy size={12} className="text-monokai-comment" />}
            <span>{copied ? '已复制新代码！' : '复制新代码'}</span>
          </button>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-medium text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface rounded-lg transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              onClick={() => onApply(proposedSql)}
              className="px-4.5 py-1.5 bg-monokai-green text-monokai-bg font-bold text-xs rounded-lg hover:brightness-110 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            >
              <Check size={13} strokeWidth={2.5} />
              <span>确认应用修改</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
