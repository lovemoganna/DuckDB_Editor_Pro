/**
 * Skill Assistant Component (Lightweight Modal)
 *
 * Quick NL → SQL entry point from SQL Editor toolbar.
 * Uses shared useSkillRouter hook for consistent behavior.
 */

import React, { useEffect, useRef } from 'react';
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

interface SkillAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertSql: (sql: string) => void;
  currentTable?: string;
  currentColumns?: { name: string; type: string }[];
}

const INTENT_LABELS: Record<string, string> = {
  select: '数据查询', insert: '数据插入', update: '数据更新', delete: '数据删除',
  aggregation: '聚合统计', join: '多表关联', window: '窗口函数',
  transformation: '数据转换', analysis: '数据分析', optimization: 'SQL 优化',
  utility: '工具生成',
};

export const SkillAssistant: React.FC<SkillAssistantProps> = ({
  isOpen,
  onClose,
  onInsertSql,
  currentTable,
  currentColumns
}) => {
  const router = useSkillRouter({ currentTable, currentColumns });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 bg-monokai-bg border border-monokai-accent rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-monokai-accent bg-monokai-sidebar">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-monokai-purple to-monokai-pink flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-monokai-fg">AI 技能助手</h2>
              <p className="text-xs text-monokai-comment">描述你的需求，AI 自动生成 SQL</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-monokai-accent/30 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-monokai-comment" />
          </button>
        </div>

        {/* Context Info */}
        {currentTable && (
          <div className="px-4 py-2 bg-monokai-purple/10 border-b border-monokai-accent/50 flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 text-monokai-fg">
              <Table className="w-3.5 h-3.5 text-monokai-purple" />
              <span>表:</span>
              <span className="font-medium">{currentTable}</span>
            </div>
            {currentColumns && currentColumns.length > 0 && (
              <div className="flex items-center gap-1.5 text-monokai-comment">
                <Columns className="w-3.5 h-3.5" />
                <span>{currentColumns.length} 列</span>
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Input Area */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={router.input}
              onChange={(e) => router.setInput(e.target.value)}
              placeholder="描述你的需求，例如：帮我统计每个月的销售总额，按金额降序排列"
              className="w-full px-4 py-3 text-sm bg-monokai-bg border border-monokai-accent text-monokai-fg placeholder-monokai-comment rounded-lg focus:outline-none focus:ring-2 focus:ring-monokai-purple focus:border-transparent transition-all resize-none"
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
                className="px-3 py-1.5 text-xs font-medium bg-monokai-purple/20 text-monokai-purple rounded-lg hover:bg-monokai-purple/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
              >
                {router.isAnalyzing ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 分析中</>
                ) : (
                  <><Lightbulb className="w-3.5 h-3.5" /> 分析</>
                )}
              </button>
              <button
                onClick={router.handleExecute}
                disabled={router.isExecuting || !router.input.trim()}
                className="px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-monokai-purple to-monokai-pink text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
              >
                {router.isExecuting ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 执行中</>
                ) : (
                  <><Zap className="w-3.5 h-3.5" /> 一键生成</>
                )}
              </button>
            </div>
          </div>

          {/* Intent Analysis Result */}
          {router.intentAnalysis && !router.executionResult && (
            <div className="p-3 bg-monokai-bg border border-monokai-accent rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-monokai-comment">识别意图:</span>
                  <span className="px-2 py-0.5 text-xs font-medium bg-monokai-purple/20 text-monokai-purple rounded">
                    {INTENT_LABELS[router.intentAnalysis.intent] || router.intentAnalysis.intent}
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
                    {router.suggestedSkills.slice(0, 4).map(skill => (
                      <span
                        key={skill.id}
                        className="px-2 py-1 text-xs bg-monokai-accent/30 text-monokai-fg rounded flex items-center gap-1"
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
            <div className={`p-4 border rounded-lg ${router.executionResult.success
                ? 'bg-monokai-green/5 border-monokai-green/30'
                : 'bg-monokai-red/5 border-monokai-red/30'
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
                      className="flex-1 px-4 py-2 text-sm font-medium bg-gradient-to-r from-monokai-green to-emerald-500 text-white rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      插入到编辑器
                    </button>
                    <button
                      onClick={() => navigator.clipboard.writeText(router.executionResult?.sql || '')}
                      className="px-4 py-2 text-sm font-medium bg-monokai-accent/30 text-monokai-fg rounded-lg hover:bg-monokai-accent/50 transition-all"
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
        <div className="p-3 border-t border-monokai-accent bg-monokai-sidebar/50 flex items-center justify-between text-xs text-monokai-comment">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-monokai-bg rounded font-mono">Ctrl+Enter</kbd>
              <span>一键生成</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-monokai-purple" />
            <span>AI 驱动 · 自然语言</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkillAssistant;
