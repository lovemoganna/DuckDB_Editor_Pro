/**
 * useAbstractionAI — 抽象表 AI 生成 Hook
 *
 * 核心职责：按 operation 类型路由到 ontologyAiService 方法
 * 会话由 AbstractionStore 统一管理（支持数据库生命周期的持续会话）
 */

import { useCallback } from 'react';
import { useAnalysisHubStore } from './store/analysisHubStore';
import {
  AbstractionGenerationRequest,
} from '../types/abstraction';

export const useAbstractionAI = () => {
  const generate = useAnalysisHubStore(s => s.generate);
  const clearAI = useAnalysisHubStore(s => s.clearAI);
  const isGenerating = useAnalysisHubStore(s => s.isGenerating);
  const aiResult = useAnalysisHubStore(s => s.aiResult);
  const aiError = useAnalysisHubStore(s => s.aiError);
  const aiRequest = useAnalysisHubStore(s => s.aiRequest);

  /**
   * 发起 AI 生成请求（旧的单次请求模式，由 store 统一管理）
   */
  const generateSQL = useCallback(async (request: AbstractionGenerationRequest) => {
    await generate(request);
  }, [generate]);

  /**
   * 通过会话发送消息（会话模式，自动维护历史上下文）
   */
  const sendMessage = useAnalysisHubStore(s => s.sendMessage);

  /**
   * 清除 AI 结果（单次模式）
   */
  const clear = useCallback(() => {
    clearAI();
  }, [clearAI]);

  return {
    generate: generateSQL,
    sendMessage,
    clear,
    isGenerating,
    generatedSQL: aiResult?.sql || '',
    explanation: aiResult?.explanation || '',
    error: aiError,
    request: aiRequest,
  };
};
