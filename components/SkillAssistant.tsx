/**
 * Skill Assistant Component (Lightweight Modal)
 *
 * Quick NL → SQL entry point from SQL Editor toolbar.
 * Uses shared useSkillRouter hook for consistent behavior.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Loader2,
  Zap,
  ChevronRight,
  Check,
  AlertCircle,
  Lightbulb,
  Table,
  Columns,
  Copy,
  RefreshCw,
  MessageSquare,
} from 'lucide-react';
import { AISkill } from '../types';
import { useSkillRouter } from '../hooks/useSkillRouter';
import { INTENT_LABELS_SIMPLE } from './constants/skills';
import { getStoredAiCapabilities, AiCapabilityDefinition, AI_CAPABILITIES_CHANGED_EVENT } from '../services/aiCapabilitiesStorage';

interface SkillAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertSql: (sql: string) => void;
  currentTable?: string;
  currentColumns?: { name: string; type: string }[];
}

export const SkillAssistant: React.FC<SkillAssistantProps> = ({
  isOpen,
  onClose,
  onInsertSql,
  currentTable,
  currentColumns
}) => {
  const router = useSkillRouter({ currentTable, currentColumns });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [capabilities, setCapabilities] = useState<AiCapabilityDefinition[]>(() => getStoredAiCapabilities());

  useEffect(() => {
    const updateCaps = () => setCapabilities(getStoredAiCapabilities());
    window.addEventListener(AI_CAPABILITIES_CHANGED_EVENT, updateCaps);
    return () => window.removeEventListener(AI_CAPABILITIES_CHANGED_EVENT, updateCaps);
  }, []);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) router.reset();
  }, [isOpen]);

  const handleInsert = () => {
    if (router.executionResult?.sql) {
      onInsertSql(router.executionResult.sql);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150 select-none">
      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-monokai-sidebar border border-monokai-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-monokai-border bg-monokai-bg/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-monokai-accent/10 border border-monokai-border-subtle flex items-center justify-center text-monokai-accent shadow-xs">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-monokai-fg">AI 技能助手</h2>
              <p className="text-[10px] text-monokai-comment">描述您的业务分析需求，AI 自动匹配意图并生成高精度 DuckDB SQL</p>
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

        {/* Context Info */}
        {currentTable && (
          <div className="px-5 py-2 bg-monokai-bg/60 border-b border-monokai-border/60 flex items-center gap-4 text-xs shrink-0">
            <div className="flex items-center gap-1.5 text-monokai-fg font-mono">
              <Table className="w-3.5 h-3.5 text-monokai-accent" />
              <span className="text-monokai-comment text-[11px]">当前表:</span>
              <span className="font-semibold text-monokai-yellow">{currentTable}</span>
            </div>
            {currentColumns && currentColumns.length > 0 && (
              <div className="flex items-center gap-1.5 text-monokai-comment text-[11px] font-mono">
                <Columns className="w-3.5 h-3.5" />
                <span>{currentColumns.length} 字段</span>
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* AI Capability Library Quick Pills */}
          {capabilities.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
              <span className="text-[11px] text-monokai-comment font-medium shrink-0 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-monokai-accent" />
                能力库联动:
              </span>
              {capabilities.map((cap) => (
                <button
                  key={cap.id}
                  type="button"
                  onClick={() => {
                    const ctx = currentTable ? `表: ${currentTable}` : '';
                    const prompt = cap.purpose || cap.description || cap.name;
                    router.setInput(ctx ? `基于 ${ctx}，${prompt}` : prompt);
                  }}
                  className="px-2 py-0.5 text-[10px] bg-monokai-surface hover:bg-monokai-hover text-monokai-fg-muted hover:text-monokai-accent border border-monokai-border rounded-md transition-all shrink-0 cursor-pointer font-medium"
                  title={cap.description || cap.purpose}
                >
                  {cap.name}
                </button>
              ))}
            </div>
          )}

          {/* Input Area */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={router.input}
              onChange={(e) => router.setInput(e.target.value)}
              placeholder="描述您的业务分析需求，例如：统计每个月的销售总额，按金额降序排列，筛选交易量大于 100 笔的记录"
              className="w-full px-3.5 py-2.5 pb-10 text-xs font-mono bg-monokai-bg border border-monokai-border rounded-lg text-monokai-fg placeholder-monokai-comment/50 outline-none focus:border-monokai-accent focus:ring-1 focus:ring-monokai-accent/20 transition-all resize-none leading-relaxed"
              rows={4}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  router.handleExecute();
                }
              }}
            />
            <div className="absolute bottom-3 right-3 flex items-center gap-2">
              <button
                onClick={router.handleAnalyze}
                disabled={router.isAnalyzing || !router.input.trim()}
                className="px-3 py-1.5 text-xs font-medium bg-monokai-surface text-monokai-fg hover:bg-monokai-hover border border-monokai-border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {router.isAnalyzing ? (
                  <><span className="typing-dot"><span /><span /><span /></span> 分析中</>
                ) : (
                  <><Lightbulb className="w-3.5 h-3.5" /> 分析</>
                )}
              </button>
              <button
                onClick={router.handleExecute}
                disabled={router.isExecuting || !router.input.trim()}
                className="px-3.5 py-1.5 text-xs font-semibold bg-monokai-accent text-monokai-bg hover:bg-monokai-accent-hover rounded-lg shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {router.isExecuting ? (
                  <><span className="typing-dot"><span /><span /><span /></span> 执行中</>
                ) : (
                  <><Zap className="w-3.5 h-3.5" /> 一键生成</>
                )}
              </button>
            </div>
          </div>

          {/* Intent Analysis Result */}
          {router.intentAnalysis && !router.executionResult && (
            <div className="p-3 bg-monokai-bg border border-monokai-border rounded-lg space-y-3 animate-fade-in-up">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-monokai-comment">识别意图:</span>
                  <span className="px-2 py-0.5 text-xs font-medium bg-monokai-surface text-monokai-accent border border-monokai-border-subtle rounded">
                    {INTENT_LABELS_SIMPLE[router.intentAnalysis.intent] || router.intentAnalysis.intent}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-monokai-comment">置信度:</span>
                  <span className={`text-xs font-medium ${router.intentAnalysis.confidence >= 0.8 ? 'text-monokai-green' :
                      router.intentAnalysis.confidence >= 0.5 ? 'text-monokai-yellow' : 'text-monokai-red'
                    }`}>
                    {Math.round(router.intentAnalysis.confidence * 100)}%
                  </span>
                </div>
              </div>

              {router.intentAnalysis.reasoning && (
                <p className="text-xs text-monokai-comment">{router.intentAnalysis.reasoning}</p>
              )}

              {router.intentAnalysis.missingInfo && router.intentAnalysis.missingInfo.length > 0 && (
                <div className="flex items-start gap-2 text-xs text-monokai-yellow">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>需要补充: {router.intentAnalysis.missingInfo.join(', ')}</span>
                </div>
              )}

              {router.suggestedSkills.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-monokai-comment">推荐技能:</span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {router.suggestedSkills.slice(0, 4).map((skill, idx) => (
                      <span
                        key={skill.id}
                        className="px-2 py-1 text-xs bg-monokai-surface border border-monokai-border-subtle text-monokai-fg rounded flex items-center gap-1 animate-fade-in-up"
                        style={{ animationDelay: `${idx * 80}ms`, animationFillMode: 'both' }}
                      >
                        {skill.icon && <span>{skill.icon}</span>}
                        {skill.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Execution Result */}
          {router.executionResult && (
            <div className={`p-4 border rounded-lg animate-fade-in-up ${router.executionResult.success
                ? 'bg-monokai-green/5 border-monokai-border-subtle'
                : 'bg-rose-500/5 border-monokai-border-subtle'
              }`}>
              {router.executionResult.success ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-monokai-green">
                    <Check className="w-4 h-4" />
                    <span className="text-xs font-medium">SQL 生成成功</span>
                  </div>

                  <pre className="p-3 bg-monokai-bg rounded-lg overflow-x-auto text-xs font-mono text-monokai-fg custom-scrollbar max-h-48">
                    {router.executionResult.sql}
                  </pre>

                  {router.executionResult.explanation && (
                    <div className="p-3 bg-monokai-bg rounded-lg">
                      <span className="text-xs font-medium text-monokai-comment">说明:</span>
                      <p className="text-xs text-monokai-fg mt-1">{router.executionResult.explanation}</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={handleInsert}
                      className="flex-1 px-4 py-2 text-xs font-bold bg-monokai-accent text-monokai-bg hover:bg-monokai-accent-hover rounded-lg shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      插入到编辑器
                    </button>
                    <button
                      onClick={() => navigator.clipboard.writeText(router.executionResult?.sql || '')}
                      className="px-4 py-2 text-xs font-medium bg-monokai-surface text-monokai-fg border border-monokai-border hover:bg-monokai-hover rounded-lg transition-all cursor-pointer"
                    >
                      复制
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-monokai-red">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-xs font-medium">执行失败</span>
                    <p className="text-xs mt-1 opacity-80">{router.executionResult.error}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-monokai-border bg-monokai-bg/90 flex items-center justify-between text-xs text-monokai-comment shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              <kbd className="px-1.5 py-0.5 bg-monokai-surface border border-monokai-border rounded text-[10px] text-monokai-fg">Ctrl+Enter</kbd>
              <span>一键生成</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-monokai-amethyst text-[11px] font-mono">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI 驱动 · 自然语言转 SQL</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkillAssistant;
