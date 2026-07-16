/**
 * AbstractionAIPanel — AI 生成面板
 *
 * 改进：
 * - 移除 window 事件总线，直接通过 store 操作
 * - 精简布局，突出生成结果
 * - 生成结果一键保存为模板
 */

import React, { useState } from 'react';
import {
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  RotateCcw,
  Wand2,
} from 'lucide-react';
import { useAnalysisHubStore } from '../../hooks/store/analysisHubStore';
import { useAbstractionAI } from '../../hooks/useAbstractionAI';
import { AbstractionSqlOperation } from '../../types';
import { OPERATION_CONFIG } from '../../types/abstraction';
import { OPERATION_SELECTED_CLASSES, OPERATION_TAG_CLASSES } from './abstractionColors';

const OPERATIONS: AbstractionSqlOperation[] = [
  'SELECT', 'AGGREGATE', 'JOIN', 'WINDOW', 'CTE', 'INSERT', 'UPDATE', 'DELETE'
];

export const AbstractionAIPanel: React.FC = () => {
  const [operation, setOperation] = useState<AbstractionSqlOperation>('AGGREGATE');
  const [concept, setConcept] = useState('');
  const [property, setProperty] = useState('');
  const [relation, setRelation] = useState('');
  const [context, setContext] = useState('');
  const [copied, setCopied] = useState(false);

  const { generate, clear, isGenerating } = useAbstractionAI();
  const aiResult = useAnalysisHubStore(s => s.aiResult);
  const aiError = useAnalysisHubStore(s => s.aiError);
  const openAddForm = useAnalysisHubStore(s => s.openAddForm);
  const setSandboxSql = useAnalysisHubStore(s => s.setSandboxSql);

  const handleGenerate = async () => {
    if (!concept.trim()) return;
    await generate({
      concept: concept.trim(),
      property: property.trim() || undefined,
      relation: relation.trim() || undefined,
      operation,
      context: context.trim() || undefined,
    });
  };

  const handleCopy = () => {
    if (aiResult?.sql) {
      navigator.clipboard.writeText(aiResult.sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveTemplate = () => {
    if (aiResult?.sql) {
      // 使用 store 的 applyGeneratedSQL 将 AI 结果预填充到表单
      useAnalysisHubStore.getState().applyGeneratedSQL(aiResult.sql);
    }
  };

  const handleSendToSandbox = () => {
    if (aiResult?.sql) {
      setSandboxSql(aiResult.sql);
    }
  };

  return (
    <div className="flex flex-col h-full bg-monokai-surface">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-monokai-border bg-monokai-bg">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-monokai-amethyst to-monokai-blue flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-monokai-fg">AI 生成</span>
        </div>
        <button
          onClick={clear}
          className="p-1 rounded-md hover:bg-monokai-bg text-monokai-fg-muted hover:text-monokai-fg transition-colors"
          title="清除"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 表单区域 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* 操作类型 */}
        <div>
          <label className="block text-xs font-medium text-monokai-fg-muted mb-2">SQL 操作类型</label>
          <div className="flex flex-wrap gap-1.5">
            {OPERATIONS.map((op) => {
              const config = OPERATION_CONFIG[op];
              const selectedClass = OPERATION_SELECTED_CLASSES[op];
              const defaultClass = 'bg-monokai-bg text-monokai-fg-muted hover:text-monokai-fg';
              return (
                <button
                  key={op}
                  onClick={() => setOperation(op)}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                    operation === op ? selectedClass : defaultClass
                  }`}
                >
                  {config?.label || op}
                </button>
              );
            })}
          </div>
        </div>

        {/* 概念 */}
        <div>
          <label className="block text-xs font-medium text-monokai-fg-muted mb-1.5">
            分析概念 <span className="text-monokai-pink">*</span>
          </label>
          <input
            type="text"
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            placeholder="例如：日活、订单金额统计"
            className="w-full px-3 py-2 text-sm bg-monokai-bg border border-monokai-border rounded-lg text-monokai-fg placeholder-monokai-fg-muted focus:outline-none focus:border-monokai-amethyst transition-colors"
          />
        </div>

        {/* 属性 */}
        <div>
          <label className="block text-xs font-medium text-monokai-fg-muted mb-1.5">分析维度</label>
          <input
            type="text"
            value={property}
            onChange={(e) => setProperty(e.target.value)}
            placeholder="例如：金额、时间段、用户类型"
            className="w-full px-3 py-2 text-sm bg-monokai-bg border border-monokai-border rounded-lg text-monokai-fg placeholder-monokai-fg-muted focus:outline-none focus:border-monokai-amethyst transition-colors"
          />
        </div>

        {/* 关系 */}
        <div>
          <label className="block text-xs font-medium text-monokai-fg-muted mb-1.5">关联关系</label>
          <input
            type="text"
            value={relation}
            onChange={(e) => setRelation(e.target.value)}
            placeholder="例如：用户表 JOIN 订单表"
            className="w-full px-3 py-2 text-sm bg-monokai-bg border border-monokai-border rounded-lg text-monokai-fg placeholder-monokai-fg-muted/50 focus:outline-none focus:border-monokai-amethyst transition-colors"
          />
        </div>

        {/* 业务场景 */}
        <div>
          <label className="block text-xs font-medium text-monokai-fg-muted mb-1.5">业务场景（可选）</label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="补充具体的业务背景、约束条件..."
            rows={2}
            className="w-full px-3 py-2 text-sm bg-monokai-bg border border-monokai-border rounded-lg text-monokai-fg placeholder-monokai-fg-muted/50 focus:outline-none focus:border-monokai-amethyst transition-colors resize-none"
          />
        </div>

        {/* 生成按钮 */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !concept.trim()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-monokai-amethyst to-monokai-blue text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
          style={{ boxShadow: '0 0 20px rgba(189,147,249,0.25)' }}
        >
          {isGenerating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4" />
              生成 SQL
            </>
          )}
        </button>

        {/* 错误 */}
        {aiError && (
          <div className="px-3 py-2.5 bg-monokai-pink/10 border border-monokai-pink/30 rounded-lg">
            <p className="text-xs text-monokai-pink">{aiError}</p>
          </div>
        )}

        {/* 生成结果 */}
        {aiResult?.sql && (
          <div className="space-y-3 pt-2">
            {/* 解释 */}
            {aiResult.explanation && (
              <div className="px-3 py-2 bg-monokai-amethyst/10 border border-monokai-amethyst/30 rounded-lg">
                <p className="text-xs text-monokai-amethyst leading-relaxed">{aiResult.explanation}</p>
              </div>
            )}

            {/* SQL 代码 */}
            <div className="bg-monokai-bg border border-monokai-border rounded-lg overflow-hidden">
              <pre className="px-3 py-2.5 text-xs text-monokai-fg font-mono whitespace-pre-wrap leading-relaxed max-h-52 overflow-y-auto">
                {aiResult.sql}
              </pre>
            </div>

            {/* 操作按钮组 */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-md bg-monokai-bg border border-monokai-border text-monokai-fg-muted hover:text-monokai-fg hover:border-monokai-fg-muted transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-monokai-green" /> : <Copy className="w-3 h-3" />}
                {copied ? '已复制' : '复制'}
              </button>
              <button
                onClick={handleSendToSandbox}
                className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-md bg-monokai-bg border border-monokai-border text-monokai-fg-muted hover:text-monokai-blue hover:border-monokai-blue/50 transition-colors"
              >
                <Sparkles className="w-3 h-3" />
                实验台
              </button>
              <button
                onClick={handleSaveTemplate}
                className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-md bg-monokai-amethyst/15 border border-monokai-amethyst/40 text-monokai-amethyst hover:bg-monokai-amethyst/25 transition-colors"
              >
                <Wand2 className="w-3 h-3" />
                保存模板
              </button>
            </div>
          </div>
        )}

        {/* 空状态引导 */}
        {!aiResult?.sql && !aiError && (
          <div className="mt-4 px-3 py-4 bg-monokai-bg rounded-lg border border-dashed border-monokai-border text-center">
            <Wand2 className="w-6 h-6 mx-auto mb-2 text-monokai-fg-muted/40" />
            <p className="text-xs text-monokai-fg-muted/70">
              输入概念后点击生成，AI 将为你构建 SQL 模板
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AbstractionAIPanel;
