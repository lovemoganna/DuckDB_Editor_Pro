/**
 * useHistory - 撤销/重做历史管理 Hook
 * 
 * 功能:
 * - 记录操作历史 (节点、边、位置)
 * - Ctrl+Z 撤销
 * - Ctrl+Y / Ctrl+Shift+Z 重做
 * - 可配置最大历史数 (默认200步)
 * - 节流防抖支持
 * 
 * @example
 * ```tsx
 * const {
 *   canUndo,
 *   canRedo,
 *   undo,
 *   redo,
 *   push,
 * } = useHistory(200); // 最多200步
 * 
 * // 在节点位置变化时记录历史
 * const handleNodeDragStop = useCallback((event, node) => {
 *   push({ nodes, edges, positions, timestamp: Date.now() });
 * }, [push, nodes, edges, positions]);
 * ```
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import type { Node, Edge } from 'reactflow';

// ============================================================
// Types
// ============================================================

export interface HistoryEntry {
  /** 节点快照 */
  nodes: Node[];
  
  /** 边快照 */
  edges: Edge[];
  
  /** 节点位置快照 (用于快速恢复) */
  positions?: Record<string, { x: number; y: number }>;
  
  /** 时间戳 */
  timestamp: number;
  
  /** 操作描述 (用于调试) */
  description?: string;
}

export interface UseHistoryReturn {
  /** 能否撤销 */
  canUndo: boolean;
  
  /** 能否重做 */
  canRedo: boolean;
  
  /** 当前历史索引 */
  currentIndex: number;
  
  /** 历史总数 */
  totalHistory: number;
  
  /** 最大历史数 */
  maxHistory: number;
  
  /** 撤销 */
  undo: () => HistoryEntry | null;
  
  /** 重做 */
  redo: () => HistoryEntry | null;
  
  /** 推入新历史 */
  push: (entry: HistoryEntry) => void;
  
  /** 替换当前历史 (不创建新历史) */
  replace: (entry: HistoryEntry) => void;
  
  /** 清空历史 */
  clear: () => void;
  
  /** 获取当前历史项 */
  getCurrent: () => HistoryEntry | null;
  
  /** 获取指定索引的历史项 */
  getAt: (index: number) => HistoryEntry | null;
  
  /** 跳转到指定历史 */
  jumpTo: (index: number) => HistoryEntry | null;
  
  /** 设置最大历史数 */
  setMaxHistory: (max: number) => void;
  
  /** 获取最近 N 条历史 */
  getRecent: (n: number) => HistoryEntry[];
}

const DEFAULT_MAX_HISTORY = 200; // 默认最大200步

// ============================================================
// Deep Clone Helper
// ============================================================

/**
 * 深拷贝节点和边 (避免引用问题)
 */
function cloneEntries(entry: HistoryEntry): HistoryEntry {
  return {
    nodes: entry.nodes.map((node) => ({
      ...node,
      position: { ...node.position },
      data: node.data ? JSON.parse(JSON.stringify(node.data)) : {},
    })),
    edges: entry.edges.map((edge) => ({
      ...edge,
      source: edge.source,
      target: edge.target,
      data: edge.data ? JSON.parse(JSON.stringify(edge.data)) : {},
    })),
    positions: entry.positions
      ? Object.fromEntries(
          Object.entries(entry.positions).map(([k, v]) => [k, { ...v }])
        )
      : undefined,
    timestamp: entry.timestamp,
    description: entry.description,
  };
}

// ============================================================
// Hook
// ============================================================

export function useHistory(initialMaxHistory: number = DEFAULT_MAX_HISTORY): UseHistoryReturn {
  const [maxHistory, setMaxHistoryState] = useState(initialMaxHistory);
  
  // 历史记录栈
  const [history, setHistory] = useState<HistoryEntry[]>(() => []);
  
  // 当前指针
  const [currentIndex, setCurrentIndex] = useState(-1);
  
  // 使用 ref 存储最新状态 (避免闭包问题)
  const historyRef = useRef<HistoryEntry[]>([]);
  const currentIndexRef = useRef(-1);
  const maxHistoryRef = useRef(initialMaxHistory);

  // 同步 ref 和 state
  const syncState = useCallback(() => {
    historyRef.current = history;
    currentIndexRef.current = currentIndex;
  }, [history, currentIndex]);

  // ============================================================
  // Undo/Redo
  // ============================================================

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;
  const totalHistory = history.length;

  const undo = useCallback((): HistoryEntry | null => {
    if (currentIndex <= 0) return null;

    const newIndex = currentIndex - 1;
    const entry = history[newIndex];

    setCurrentIndex(newIndex);
    syncState();

    return entry ? cloneEntries(entry) : null;
  }, [currentIndex, history, syncState]);

  const redo = useCallback((): HistoryEntry | null => {
    if (currentIndex >= history.length - 1) return null;

    const newIndex = currentIndex + 1;
    const entry = history[newIndex];

    setCurrentIndex(newIndex);
    syncState();

    return entry ? cloneEntries(entry) : null;
  }, [currentIndex, history, syncState]);

  // ============================================================
  // Push
  // ============================================================

  const push = useCallback((entry: HistoryEntry) => {
    // 深拷贝 entry
    const clonedEntry = cloneEntries(entry);

    setHistory((prevHistory) => {
      // 如果当前指针不在最后，需要截断后面的历史
      const newHistory = currentIndex < prevHistory.length - 1
        ? prevHistory.slice(0, currentIndex + 1)
        : [...prevHistory];

      // 添加新历史
      newHistory.push(clonedEntry);

      // 如果超过最大历史数，删除最旧的历史
      if (newHistory.length > maxHistoryRef.current) {
        newHistory.shift();
      }

      // 更新指针
      const newIndex = newHistory.length - 1;
      setCurrentIndex(newIndex);
      historyRef.current = newHistory;
      currentIndexRef.current = newIndex;

      return newHistory;
    });
  }, [currentIndex]); // 不依赖 maxHistoryRef

  // ============================================================
  // Replace (不创建新历史)
  // ============================================================

  const replace = useCallback((entry: HistoryEntry) => {
    if (currentIndex < 0 || currentIndex >= history.length) return;

    const clonedEntry = cloneEntries(entry);

    setHistory((prevHistory) => {
      const newHistory = [...prevHistory];
      newHistory[currentIndex] = clonedEntry;
      historyRef.current = newHistory;
      return newHistory;
    });
  }, [currentIndex, history]);

  // ============================================================
  // Clear
  // ============================================================

  const clear = useCallback(() => {
    setHistory([]);
    setCurrentIndex(-1);
    historyRef.current = [];
    currentIndexRef.current = -1;
  }, []);

  // ============================================================
  // Getters
  // ============================================================

  const getCurrent = useCallback((): HistoryEntry | null => {
    if (currentIndex < 0 || currentIndex >= history.length) return null;
    return cloneEntries(history[currentIndex]);
  }, [currentIndex, history]);

  const getAt = useCallback((index: number): HistoryEntry | null => {
    if (index < 0 || index >= history.length) return null;
    return cloneEntries(history[index]);
  }, [history]);

  const jumpTo = useCallback((index: number): HistoryEntry | null => {
    if (index < 0 || index >= history.length) return null;

    setCurrentIndex(index);
    currentIndexRef.current = index;

    return cloneEntries(history[index]);
  }, [history]);

  const setMaxHistory = useCallback((max: number) => {
    const newMax = Math.max(1, max); // 至少保留1步
    setMaxHistoryState(newMax);
    maxHistoryRef.current = newMax;

    // 如果当前历史超过新限制，截断最旧的
    if (history.length > newMax) {
      const excess = history.length - newMax;
      const newHistory = history.slice(excess);
      const newIndex = currentIndex - excess;
      
      setHistory(newHistory);
      setCurrentIndex(Math.max(0, newIndex));
      
      historyRef.current = newHistory;
      currentIndexRef.current = Math.max(0, newIndex);
    }
  }, [history, currentIndex]);

  const getRecent = useCallback((n: number): HistoryEntry[] => {
    const start = Math.max(0, currentIndex - n + 1);
    return history.slice(start, currentIndex + 1).map(cloneEntries);
  }, [history, currentIndex]);

  return {
    canUndo,
    canRedo,
    currentIndex,
    totalHistory,
    maxHistory,
    undo,
    redo,
    push,
    replace,
    clear,
    getCurrent,
    getAt,
    jumpTo,
    setMaxHistory,
    getRecent,
  };
}

export default useHistory;
