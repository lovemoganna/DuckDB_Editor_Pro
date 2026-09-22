/**
 * useLearningProgress - 教程学习进度 Hook
 * 
 * 职责：
 * 1. 管理普通教程的学习进度
 * 2. 提供进度保存和加载功能
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { TutorialMetadata } from '../data/tutorials';

export interface TutorialProgress {
  tutorialId: string;
  completedSections: string[];
  lastPosition: string;
  startedAt: string;
  completedAt?: string;
  totalSections?: number;
  timeSpent?: number;
}

export interface UseLearningProgressReturn {
  markSectionComplete: (tutorialId: string, sectionId: string) => void;
  markTutorialComplete: (tutorialId: string) => void;
  getTutorialProgress: (tutorialId: string) => TutorialProgress | null;
  isTutorialCompleted: (tutorialId: string) => boolean;
  getAllProgress: () => Record<string, TutorialProgress>;
  resetProgress: (tutorialId: string) => void;
  resetAllProgress: () => void;
}

const STORAGE_KEY = 'duckdb_learn_progress';

export function useLearningProgress(): UseLearningProgressReturn {
  const [progress, setProgress] = useState<Record<string, TutorialProgress>>({});

  // 加载进度
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setProgress(JSON.parse(saved));
      }
    } catch (e) {
      console.error('[useLearningProgress] Failed to load progress:', e);
    }
  }, []);

  // 保存进度
  const saveProgress = useCallback((newProgress: Record<string, TutorialProgress>) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newProgress));
    } catch (e) {
      console.error('[useLearningProgress] Failed to save progress:', e);
    }
  }, []);

  // 获取单个教程进度
  const getTutorialProgress = useCallback((tutorialId: string): TutorialProgress | null => {
    return progress[tutorialId] || null;
  }, [progress]);

  // 检查教程是否已完成（用于 OntologyLearnViewer 兼容）
  const isTutorialCompleted = useCallback((tutorialId: string): boolean => {
    return !!progress[tutorialId]?.completedAt;
  }, [progress]);

  // 获取所有进度
  const getAllProgress = useCallback((): Record<string, TutorialProgress> => {
    return progress;
  }, [progress]);

  // 标记章节完成
  const markSectionComplete = useCallback((tutorialId: string, sectionId: string) => {
    setProgress(prev => {
      const tutorialProgress = prev[tutorialId] || {
        tutorialId,
        completedSections: [],
        lastPosition: sectionId,
        startedAt: new Date().toISOString(),
      };

      if (tutorialProgress.completedSections.includes(sectionId)) {
        return prev;
      }

      const updated = {
        ...prev,
        [tutorialId]: {
          ...tutorialProgress,
          completedSections: [...tutorialProgress.completedSections, sectionId],
          lastPosition: sectionId,
        },
      };

      saveProgress(updated);
      return updated;
    });
  }, [saveProgress]);

  // 标记教程完成
  const markTutorialComplete = useCallback((tutorialId: string) => {
    setProgress(prev => {
      const tutorialProgress = prev[tutorialId] || {
        tutorialId,
        completedSections: [],
        lastPosition: '',
        startedAt: new Date().toISOString(),
      };

      const updated = {
        ...prev,
        [tutorialId]: {
          ...tutorialProgress,
          completedAt: tutorialProgress.completedAt || new Date().toISOString(),
        },
      };

      saveProgress(updated);
      return updated;
    });
  }, [saveProgress]);

  // 重置单个教程进度
  const resetProgress = useCallback((tutorialId: string) => {
    setProgress(prev => {
      const { [tutorialId]: _, ...rest } = prev;
      saveProgress(rest);
      return rest;
    });
  }, [saveProgress]);

  // 重置所有进度
  const resetAllProgress = useCallback(() => {
    setProgress({});
    saveProgress({});
  }, [saveProgress]);

  return {
    markSectionComplete,
    markTutorialComplete,
    getTutorialProgress,
    isTutorialCompleted,
    getAllProgress,
    resetProgress,
    resetAllProgress,
  };
}

export default useLearningProgress;
