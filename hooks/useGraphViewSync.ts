/**
 * useGraphViewSync.ts - 图谱视图同步 Hook
 * 
 * 设计目标：
 * 1. 统一管理 D3GraphView 和 OntologyCanvas 之间的数据同步
 * 2. 确保切换视图时布局信息不会丢失
 * 3. 提供统一的刷新和布局更新机制
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { useOntologyStore } from './useOntologyStore';

/** 同步状态 */
export interface GraphViewSyncState {
  /** 最后同步时间戳 */
  lastSyncTime: number;
  /** 同步状态 */
  isSyncing: boolean;
  /** 同步版本号 (用于检测冲突) */
  syncVersion: number;
}

/** 布局信息 */
export interface LayoutInfo {
  /** 节点位置映射 */
  nodePositions: Record<number, { x: number; y: number }>;
  /** 当前布局模式 */
  layoutMode: string;
  /** 缩放级别 */
  zoom: number;
  /** 视图偏移 */
  pan: { x: number; y: number };
}

/** 同步 Hook 配置 */
export interface GraphViewSyncConfig {
  /** 启用同步 */
  enabled?: boolean;
  /** 同步延迟 (ms) */
  syncDelay?: number;
  /** 是否在切换视图时同步 */
  syncOnTabChange?: boolean;
}

/**
 * 图谱视图同步 Hook
 * 
 * 使用方式：
 * ```tsx
 * const { syncState, pushLayout, pullLayout } = useGraphViewSync();
 * 
 * // 在 OntologyCanvas 中
 * useEffect(() => {
 *   // 当画布布局变化时，同步到全局
 *   pushLayout({ nodePositions, layoutMode });
 * }, [nodePositions, layoutMode]);
 * 
 * // 在 D3GraphView 中
 * useEffect(() => {
 *   // 切换到图谱视图时，拉取最新布局
 *   if (activeTab === 'graph') {
 *     pullLayout();
 *   }
 * }, [activeTab]);
 * ```
 */
export function useGraphViewSync(config: GraphViewSyncConfig = {}) {
  const {
    enabled = true,
    syncDelay = 100,
    syncOnTabChange = true,
  } = config;
  
  const store = useOntologyStore();
  const { state } = store;
  
  // 同步状态
  const [syncState, setSyncState] = useState<GraphViewSyncState>({
    lastSyncTime: 0,
    isSyncing: false,
    syncVersion: 0,
  });
  
  // 本地布局缓存
  const layoutCacheRef = useRef<LayoutInfo | null>(null);
  
  // 防抖定时器
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  /** 推送布局到全局存储 */
  const pushLayout = useCallback((layout: Partial<LayoutInfo>) => {
    if (!enabled) return;
    
    // 更新本地缓存
    layoutCacheRef.current = {
      ...layoutCacheRef.current,
      ...layout,
    };
    
    // 防抖同步到 store
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
    }
    
    syncTimerRef.current = setTimeout(() => {
      setSyncState(prev => ({
        ...prev,
        isSyncing: true,
      }));
      
      // 同步到 store
      if (layout.nodePositions) {
        const validPositions: Record<number, { x: number; y: number }> = {};
        for (const [key, pos] of Object.entries(layout.nodePositions)) {
          let id: number | null = null;
          if (/^\d+$/.test(key)) {
            id = Number(key);
          } else if (key.startsWith('obj::')) {
            const parsed = Number(key.slice(5));
            if (Number.isFinite(parsed)) id = parsed;
          }
          if (id !== null && Number.isFinite(id) && !Number.isNaN(id) && pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
            validPositions[id] = { x: pos.x, y: pos.y };
          }
        }
        if (Object.keys(validPositions).length > 0) {
          store.updateCanvasPositions(validPositions);
        }
      }
      
      setSyncState(prev => ({
        lastSyncTime: Date.now(),
        isSyncing: false,
        syncVersion: prev.syncVersion + 1,
      }));
    }, syncDelay);
  }, [enabled, syncDelay, store]);
  
  /** 从全局存储拉取布局 */
  const pullLayout = useCallback((): LayoutInfo | null => {
    if (!enabled) return null;
    
    // 直接从 store 读取
    const positions: Record<number, { x: number; y: number }> = {};
    Object.entries(state.canvasPositions).forEach(([key, value]) => {
      const numKey = Number(key);
      if (Number.isFinite(numKey) && !Number.isNaN(numKey) && value && Number.isFinite(value.x) && Number.isFinite(value.y)) {
        positions[numKey] = { x: value.x, y: value.y };
      }
    });
    
    return {
      nodePositions: positions,
      layoutMode: 'hierarchical', // 默认值
      zoom: 1,
      pan: { x: 0, y: 0 },
    };
  }, [enabled, state.canvasPositions]);
  
  /** 清除缓存并重置同步状态 */
  const resetSync = useCallback(() => {
    layoutCacheRef.current = null;
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
    }
    setSyncState({
      lastSyncTime: 0,
      isSyncing: false,
      syncVersion: 0,
    });
  }, []);
  
  /** 强制同步 (取消防抖) */
  const forceSync = useCallback(() => {
    if (!enabled || !layoutCacheRef.current) return;
    
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
    }
    
    setSyncState(prev => ({
      lastSyncTime: Date.now(),
      isSyncing: true,
      syncVersion: prev.syncVersion + 1,
    }));
    
    if (layoutCacheRef.current.nodePositions) {
      const validPositions: Record<number, { x: number; y: number }> = {};
      for (const [key, pos] of Object.entries(layoutCacheRef.current.nodePositions)) {
        let id: number | null = null;
        if (/^\d+$/.test(key)) {
          id = Number(key);
        } else if (key.startsWith('obj::')) {
          const parsed = Number(key.slice(5));
          if (Number.isFinite(parsed)) id = parsed;
        }
        if (id !== null && Number.isFinite(id) && !Number.isNaN(id) && pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
          validPositions[id] = { x: pos.x, y: pos.y };
        }
      }
      if (Object.keys(validPositions).length > 0) {
        store.updateCanvasPositions(validPositions);
      }
    }
    
    setSyncState(prev => ({
      ...prev,
      isSyncing: false,
    }));
  }, [enabled, store]);
  
  /** 获取当前布局缓存 */
  const getCachedLayout = useCallback((): LayoutInfo | null => {
    return layoutCacheRef.current;
  }, []);
  
  // 清理
  useEffect(() => {
    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
    };
  }, []);
  
  return {
    // 状态
    syncState,
    cachedLayout: layoutCacheRef.current,
    
    // 方法
    pushLayout,
    pullLayout,
    resetSync,
    forceSync,
    getCachedLayout,
  };
}

/**
 * 图谱视图切换 Hook
 * 
 * 在视图切换时自动处理布局同步
 */
export function useGraphViewSwitcher(
  activeTab: 'graph' | 'data' | 'canvas',
  onGraphViewSync: () => void,
  onCanvasViewSync: () => void
) {
  const { pullLayout, pushLayout, syncState } = useGraphViewSync();
  const lastTabRef = useRef<string>(activeTab);
  
  useEffect(() => {
    // 检测视图切换
    if (lastTabRef.current === activeTab) return;
    
    const previousTab = lastTabRef.current;
    lastTabRef.current = activeTab;
    
    // Graph -> Canvas: 推送布局
    if (previousTab === 'graph' && activeTab === 'canvas') {
      const layout = pullLayout();
      if (layout) {
        onCanvasViewSync();
      }
    }
    
    // Canvas -> Graph: 拉取布局
    if (previousTab === 'canvas' && activeTab === 'graph') {
      onGraphViewSync();
    }
  }, [activeTab, pullLayout, onGraphViewSync, onCanvasViewSync]);
  
  return {
    syncState,
    pullLayout,
    pushLayout,
  };
}

/**
 * 创建全局布局事件总线
 * 用于在非 React 组件中触发布局同步
 */
class LayoutEventBus {
  private listeners: Set<(layout: LayoutInfo) => void> = new Set();
  
  /** 订阅布局更新 */
  subscribe(callback: (layout: LayoutInfo) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
  
  /** 发布布局更新 */
  publish(layout: LayoutInfo) {
    this.listeners.forEach(callback => {
      try {
        callback(layout);
      } catch (error) {
        console.error('[LayoutEventBus] Error in listener:', error);
      }
    });
  }
}

// 全局单例
export const layoutEventBus = new LayoutEventBus();

/**
 * 使用全局布局事件总线
 */
export function useLayoutEventBus(callback: (layout: LayoutInfo) => void) {
  useEffect(() => {
    return layoutEventBus.subscribe(callback);
  }, [callback]);
}
