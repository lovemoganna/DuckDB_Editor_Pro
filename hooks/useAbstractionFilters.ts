/**
 * useAbstractionFilters — 抽象表筛选状态 Hook（Selector 优化版本）
 *
 * 核心职责：管理筛选状态，筛选逻辑已在 store 内部实现
 */

import { useCallback } from 'react';
import { useAnalysisHubStore } from './store/analysisHubStore';
import { AbstractionFilters } from '../types/abstraction';

export const useAbstractionFilters = (tables?: never) => {
  // 直接从 store 读取筛选状态
  const filters = useAnalysisHubStore(s => s.filters);
  const stats = useAnalysisHubStore(s => s.stats);
  const domains = useAnalysisHubStore(s => s.domains);
  const setFilters = useAnalysisHubStore(s => s.setFilters);
  const resetFilters = useAnalysisHubStore(s => s.resetFilters);

  // 更新筛选条件（合并更新）
  const updateFilters = useCallback((updates: Partial<AbstractionFilters>) => {
    setFilters(updates);
  }, [setFilters]);

  // 重置筛选条件
  const clearFilters = useCallback(() => {
    resetFilters();
  }, [resetFilters]);

  return {
    filters,
    updateFilters,
    resetFilters: clearFilters,
    stats,
    domains,
  };
};
