/**
 * SandboxAIPanel — 实验台 AI 协作面板
 *
 * 改进：
 * - 支持选择 SQL 操作类型
 * - 支持将生成的 SQL 插入到编辑器
 * - 真实的 AI 调用
 */

import React, { useState } from 'react';
import { Sparkles, RefreshCw, Copy, Check, ArrowRight, Wand2 } from 'lucide-react';
import { useAbstractionSandbox } from '../../hooks/useAbstractionSandbox';
import { useAbstractionAI } from '../../hooks/useAbstractionAI';
import { OPERATION_CONFIG } from '../../types/abstraction';
import { AbstractionSqlOperation } from '../../types';

const OPERATIONS: AbstractionSqlOperation[] = [
  'SELECT', 'AGGREGATE', 'JOIN', 'WINDOW', 'CTE', 'INSERT', 'UPDATE', 'DELETE'
];

export const SandboxAIPanel: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [operation, setOperation] = useState<AbstractionSqlOperation>('AGGREGATE');
  const [copied, setCopied] = useState(false);

  const { setSql } = useAbstractionSandbox();
  const { generate, isGenerating, generatedSQL, explanation, error, clear } = useAbstractionAI();

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    clear();
    await generate({
      concept: prompt.trim(),
      operation,
    });
  };

  const handleCopy = () => {
    if (generatedSQL) {
      navigator.clipboard.writeText(generatedSQL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleInsertToEditor = () => {
    if (generatedSQL) {
      setSql(generatedSQL);
    }
  };

  const handleClear = () => {
    setPrompt('');
    clear();
  };

  return (
    <div className="h-full flex flex-col bg-monokai-bg">
      {/* 头部 */}
      <div className="flex items-center gap-2 px-4 py-3 bg-monokai-surface border-b border-monokai-border">
        <div className="w-5 h-5 rounded bg-gradient-to-br from-monokai-amethyst to-monokai-blue flex items-center justify-center">
          <Sparkles className="w-3 h-3 text-white" />
        </div>
        <span className="text-xs font-semibold text-monokai-fg">AI 协作</span>
      </div>

      {/* 操作类型选择 */}
      <div className="px-4 pt-3 pb-2">
        <label className="text-[10px] font-medium text-monokai-fg-muted mb-1 block">SQL 操作类型</label>
        <div className="flex flex-wrap gap-1">
          {OPERATIONS.map((op) => {
            const config = OPERATION_CONFIG[op];
            return (
              <button
                key={op}
                onClick={() => setOperation(op)}
                className={`px-2 py-0.5 text-[10px] rounded font-medium transition-all ${
                  operation === op
                    ? `bg-monokai-${config?.color || 'fg'}/20 text-monokai-${config?.color || 'fg'}`
                    : 'bg-monokai-surface text-monokai-fg-muted hover:text-monokai-fg'
                }`}
              >
                {config?.label || op}
              </button>
            );
          })}
        </div>
      </div>

      {/* 输入 */}
      <div className="p-4 space-y-3">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={`描述你想要的 SQL 功能，例如：帮我写一个按日统计新用户的 ${OPERATION_CONFIG[operation].label} SQL`}
          rows={3}
          className="w-full px-3 py-2 text-sm bg-monokai-surface border border-monokai-border rounded-lg text-monokai-fg placeholder-monokai-fg-muted/60 focus:outline-none focus:border-monokai-amethyst transition-colors resize-none"
        />
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-monokai-amethyst to-monokai-blue text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          style={{ boxShadow: '0 0 20px rgba(189,147,249,0.25)' }}
        >
          {isGenerating ? (
            <><RefreshCw className="w-4 h-4 animate-spin" /> 生成中...</>
          ) : (
            <><Wand2 className="w-4 h-4" /> 生成 SQL</>
          )}
        </button>
      </div>

      {/* 错误 */}
      {error && (
        <div className="mx-4 mb-3 px-3 py-2.5 bg-monokai-pink/10 border border-monokai-pink/30 rounded-lg">
          <p className="text-xs text-monokai-pink">{error}</p>
        </div>
      )}

      {/* 结果 */}
      {generatedSQL && (
        <div className="flex-1 px-4 pb-4 space-y-3 overflow-y-auto">
          {/* 解释 */}
          {explanation && (
            <div className="px-3 py-2 bg-monokai-amethyst/10 border border-monokai-amethyst/30 rounded-lg">
              <p className="text-xs text-monokai-amethyst leading-relaxed">{explanation}</p>
            </div>
          )}

          {/* SQL 代码 */}
          <div className="bg-monokai-surface border border-monokai-border rounded-lg overflow-hidden">
            <pre className="px-3 py-2.5 text-xs text-monokai-fg font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
              {generatedSQL}
            </pre>
          </div>

          {/* 操作按钮组 */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-md bg-monokai-surface border border-monokai-border text-monokai-fg-muted hover:text-monokai-fg hover:border-monokai-fg-muted transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-monokai-green" /> : <Copy className="w-3 h-3" />}
              {copied ? '已复制' : '复制'}
            </button>
            <button
              onClick={handleInsertToEditor}
              className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-md bg-monokai-blue/15 border border-monokai-blue/50 text-monokai-blue hover:bg-monokai-blue/25 transition-colors"
            >
              <ArrowRight className="w-3 h-3" />
              插入编辑器
            </button>
            <button
              onClick={handleClear}
              className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-md bg-monokai-surface border border-monokai-border text-monokai-fg-muted hover:text-monokai-fg transition-colors"
            >
              <Sparkles className="w-3 h-3" />
              清空
            </button>
          </div>
        </div>
      )}

      {/* 空状态 */}
      {!generatedSQL && !error && (
        <div className="flex-1 flex items-center justify-center px-8">
          <div className="text-center">
            <Wand2 className="w-8 h-8 mx-auto mb-3 text-monokai-fg-muted opacity-30" />
            <p className="text-xs text-monokai-fg-muted opacity-60">描述你的需求，AI 将生成 SQL</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SandboxAIPanel;
