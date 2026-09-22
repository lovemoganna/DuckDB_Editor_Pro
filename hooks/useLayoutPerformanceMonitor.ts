/**
 * hooks/useLayoutPerformanceMonitor.ts - 布局性能监控 Hook
 * 
 * 提供布局性能指标的实时监控和历史统计
 * 
 * @module useLayoutPerformanceMonitor
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  onLayoutPerformance, 
  getLayoutStats, 
  getLayoutMetricsHistory, 
  clearLayoutMetrics,
  setLayoutPerformanceLogging,
  type LayoutMetrics,
  type LayoutStats 
} from '../services/graphLayoutService';

/**
 * 布局性能监控配置
 */
export interface LayoutPerformanceConfig {
  /** 保留的历史记录数量 */
  historyLimit?: number;
  /** 启用自动日志 */
  autoLogging?: boolean;
  /** 性能阈值警告（毫秒） */
  warningThreshold?: number;
  /** 性能阈值错误（毫秒） */
  errorThreshold?: number;
}

/**
 * 性能警告信息
 */
export interface LayoutPerformanceWarning {
  /** 布局模式 */
  layoutMode: string;
  /** 警告类型 */
  type: 'slow' | 'error';
  /** 耗时 */
  duration: number;
  /** 阈值 */
  threshold: number;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 布局性能监控 Hook
 * 
 * @example
 * ```tsx
 * function GraphView() {
 *   const { metrics, stats, warnings, clearHistory } = useLayoutPerformanceMonitor({
 *     warningThreshold: 200,
 *     errorThreshold: 500,
 *   });
 * 
 *   return (
 *     <div>
 *       <div>平均耗时: {stats?.avgDuration.toFixed(2)}ms</div>
 *       <div>
 *         {warnings.map(w => (
 *           <div key={w.timestamp}>警告: {w.layoutMode} 耗时 {w.duration}ms</div>
 *         ))}
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 */
export function useLayoutPerformanceMonitor(config: LayoutPerformanceConfig = {}) {
  const {
    historyLimit = 100,
    autoLogging = true,
    warningThreshold = 200,
    errorThreshold = 500,
  } = config;

  // 历史指标
  const [metrics, setMetrics] = useState<LayoutMetrics[]>(() => 
    getLayoutMetricsHistory(historyLimit)
  );

  // 性能警告
  const [warnings, setWarnings] = useState<LayoutPerformanceWarning[]>([]);

  // 统计信息
  const stats = useMemo(() => {
    if (metrics.length === 0) return null;
    return getLayoutStats();
  }, [metrics]);

  // 注册性能回调
  useEffect(() => {
    // 设置自动日志
    setLayoutPerformanceLogging(autoLogging);

    // 注册性能监控回调
    const unsubscribe = onLayoutPerformance((metric) => {
      // 更新历史记录
      setMetrics(prev => {
        const updated = [...prev, metric];
        if (updated.length > historyLimit) {
          return updated.slice(-historyLimit);
        }
        return updated;
      });

      // 检查警告阈值
      if (metric.status === 'error') {
        setWarnings(prev => [...prev.slice(-19), {
          layoutMode: metric.layoutMode,
          type: 'error',
          duration: metric.duration,
          threshold: errorThreshold,
          timestamp: metric.timestamp,
        }]);
      } else if (metric.duration > warningThreshold) {
        setWarnings(prev => [...prev.slice(-19), {
          layoutMode: metric.layoutMode,
          type: 'slow',
          duration: metric.duration,
          threshold: warningThreshold,
          timestamp: metric.timestamp,
        }]);
      }
    });

    return () => {
      unsubscribe();
      setLayoutPerformanceLogging(true); // 恢复默认
    };
  }, [historyLimit, autoLogging, warningThreshold, errorThreshold]);

  /**
   * 清除历史记录
   */
  const clearHistory = useCallback(() => {
    clearLayoutMetrics();
    setMetrics([]);
    setWarnings([]);
  }, []);

  /**
   * 清除警告
   */
  const clearWarnings = useCallback(() => {
    setWarnings([]);
  }, []);

  /**
   * 获取按布局模式分组的统计
   */
  const statsByMode = useMemo(() => {
    const modeMap = new Map<string, { durations: number[]; errors: number }>();
    
    metrics.forEach(m => {
      const existing = modeMap.get(m.layoutMode) || { durations: [], errors: 0 };
      existing.durations.push(m.duration);
      if (m.status === 'error') {
        existing.errors += 1;
      }
      modeMap.set(m.layoutMode, existing);
    });

    const result: Record<string, {
      avgDuration: number;
      minDuration: number;
      maxDuration: number;
      count: number;
      errorCount: number;
    }> = {};

    modeMap.forEach((data, mode) => {
      const durations = data.durations;
      result[mode] = {
        avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
        minDuration: Math.min(...durations),
        maxDuration: Math.max(...durations),
        count: durations.length,
        errorCount: data.errors,
      };
    });

    return result;
  }, [metrics]);

  /**
   * 导出性能报告
   */
  const exportReport = useCallback(() => {
    const report = {
      generatedAt: new Date().toISOString(),
      summary: stats,
      byMode: statsByMode,
      recentWarnings: warnings.slice(-10),
      totalMetrics: metrics.length,
    };
    
    return JSON.stringify(report, null, 2);
  }, [stats, statsByMode, warnings, metrics.length]);

  return {
    // 当前统计
    stats,
    
    // 历史记录
    metrics,
    
    // 警告列表
    warnings,
    
    // 按模式分组的统计
    statsByMode,
    
    // 操作
    clearHistory,
    clearWarnings,
    exportReport,
  };
}

/**
 * 简洁的性能监控 Hook
 * 只返回基本统计信息，适合轻量级使用
 */
export function useSimpleLayoutStats() {
  const [stats, setStats] = useState<LayoutStats | null>(null);

  useEffect(() => {
    // 初始加载
    setStats(getLayoutStats());

    // 订阅更新
    const unsubscribe = onLayoutPerformance(() => {
      setStats(getLayoutStats());
    });

    return unsubscribe;
  }, []);

  return stats;
}

/**
 * 布局性能等级
 */
export type PerformanceGrade = 'excellent' | 'good' | 'acceptable' | 'slow' | 'critical';

/**
 * 根据耗时获取性能等级
 */
export function getPerformanceGrade(duration: number): PerformanceGrade {
  if (duration < 50) return 'excellent';
  if (duration < 100) return 'good';
  if (duration < 200) return 'acceptable';
  if (duration < 500) return 'slow';
  return 'critical';
}

/**
 * 性能等级对应的颜色
 */
export const PERFORMANCE_GRADE_COLORS: Record<PerformanceGrade, string> = {
  excellent: '#22c55e', // green
  good: '#84cc16',      // lime
  acceptable: '#eab308', // yellow
  slow: '#f97316',      // orange
  critical: '#ef4444',  // red
};

/**
 * 性能等级对应的中文名称
 */
export const PERFORMANCE_GRADE_LABELS: Record<PerformanceGrade, string> = {
  excellent: '优秀',
  good: '良好',
  acceptable: '可接受',
  slow: '较慢',
  critical: '严重',
};
