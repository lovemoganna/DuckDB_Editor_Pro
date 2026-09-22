/**
 * useClipboard - 节点/边复制/剪切/粘贴 Hook
 * 
 * 功能:
 * - Ctrl+C 复制选中节点及其关联边
 * - Ctrl+X 剪切选中节点及其关联边
 * - Ctrl+V 粘贴 (带位置偏移)
 * - 支持 localStorage 持久化
 * - 自动重建节点 ID 映射
 * 
 * @example
 * ```tsx
 * const { canPaste, copy, cut, paste } = useClipboard();
 * 
 * // 在键盘事件中
 * useEffect(() => {
 *   const handleKeyDown = (e) => {
 *     if (e.ctrlKey && e.key === 'c') {
 *       copy(selectedNodes, selectedEdges);
 *     }
 *   };
 * }, [copy]);
 * ```
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Node, Edge } from 'reactflow';
import { v4 as uuidv4 } from 'uuid';

// ============================================================
// Types
// ============================================================

export interface ClipboardData {
  /** 复制的节点 (原始 ID) */
  originalNodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data: Record<string, unknown>;
  }>;
  
  /** 复制的边 (原始 ID) */
  originalEdges: Array<{
    id: string;
    source: string;
    target: string;
    type: string;
    label?: string;
    data?: Record<string, unknown>;
  }>;
  
  /** 复制时间戳 */
  timestamp: number;
  
  /** 粘贴次数 (用于累积偏移) */
  pasteCount: number;
}

export interface UseClipboardReturn {
  /** 剪贴板是否有数据 */
  canPaste: boolean;
  
  /** 剪贴板数据 */
  clipboardData: ClipboardData | null;
  
  /** 复制节点和边 */
  copy: (nodes: Node[], edges: Edge[]) => void;
  
  /** 剪切节点和边 */
  cut: (nodes: Node[], edges: Edge[]) => void;
  
  /** 粘贴 (返回新的节点和边, 需自行合并到状态) */
  paste: (defaultOffset?: { x: number; y: number }) => {
    nodes: Node[];
    edges: Edge[];
    idMapping: Record<string, string>; // 旧ID -> 新ID 映射
  };
  
  /** 清空剪贴板 */
  clear: () => void;
  
  /** 获取粘贴次数 */
  getPasteCount: () => number;
  
  /** 重置粘贴次数 */
  resetPasteCount: () => void;
}

// ============================================================
// Constants
// ============================================================

const CLIPBOARD_STORAGE_KEY = 'ontology-canvas-clipboard';

const DEFAULT_OFFSET = 20; // 默认偏移量 (px)
const MAX_OFFSET = 200; // 最大偏移量 (px)
const CLIPBOARD_MAX_AGE = 30 * 60 * 1000; // 30分钟过期

// ============================================================
// ID Generation
// ============================================================

/**
 * 生成新的唯一 ID
 * 优先使用 uuid，如果没有则用时间戳+随机数
 */
function generateId(): string {
  try {
    return uuidv4();
  } catch {
    return `node_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

// ============================================================
// LocalStorage Helpers
// ============================================================

function saveToStorage(data: ClipboardData): void {
  try {
    localStorage.setItem(CLIPBOARD_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('[useClipboard] Failed to save to localStorage:', error);
  }
}

function loadFromStorage(): ClipboardData | null {
  try {
    const stored = localStorage.getItem(CLIPBOARD_STORAGE_KEY);
    if (!stored) return null;
    
    const data: ClipboardData = JSON.parse(stored);
    
    // 检查是否过期
    if (Date.now() - data.timestamp > CLIPBOARD_MAX_AGE) {
      localStorage.removeItem(CLIPBOARD_STORAGE_KEY);
      return null;
    }
    
    return data;
  } catch (error) {
    console.warn('[useClipboard] Failed to load from localStorage:', error);
    return null;
  }
}

function clearStorage(): void {
  try {
    localStorage.removeItem(CLIPBOARD_STORAGE_KEY);
  } catch (error) {
    console.warn('[useClipboard] Failed to clear localStorage:', error);
  }
}

// ============================================================
// Hook
// ============================================================

export function useClipboard(): UseClipboardReturn {
  const [clipboardData, setClipboardData] = useState<ClipboardData | null>(() => loadFromStorage());
  const [pasteCount, setPasteCount] = useState(0);
  const pasteCountRef = useRef(0);

  // 初始化时从存储加载
  useEffect(() => {
    const stored = loadFromStorage();
    if (stored) {
      setClipboardData(stored);
      setPasteCount(stored.pasteCount);
      pasteCountRef.current = stored.pasteCount;
    }
  }, []);

  // ============================================================
  // Copy
  // ============================================================

  const copy = useCallback((nodes: Node[], edges: Edge[]) => {
    if (nodes.length === 0) return;

    // 提取节点数据 (只保留必要的属性)
    const originalNodes = nodes.map((node) => ({
      id: node.id,
      type: node.type ?? 'ontology',
      position: { ...node.position },
      data: { ...node.data },
    }));

    // 找出与选中节点关联的边
    const selectedNodeIds = new Set(nodes.map((n) => n.id));
    const originalEdges = edges
      .filter((edge) => selectedNodeIds.has(edge.source) || selectedNodeIds.has(edge.target))
      .map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type ?? 'ontology',
        label: typeof edge.label === 'string' ? edge.label : undefined,
        data: edge.data ? { ...edge.data } : undefined,
      }));

    const newData: ClipboardData = {
      originalNodes,
      originalEdges,
      timestamp: Date.now(),
      pasteCount: 0,
    };

    setClipboardData(newData);
    setPasteCount(0);
    pasteCountRef.current = 0;
    saveToStorage(newData);
  }, []);

  // ============================================================
  // Cut
  // ============================================================

  const cut = useCallback((nodes: Node[], edges: Edge[]) => {
    // 复制后清空 (实际删除由调用方处理)
    copy(nodes, edges);
  }, [copy]);

  // ============================================================
  // Paste
  // ============================================================

  const paste = useCallback((defaultOffset?: { x: number; y: number }): {
    nodes: Node[];
    edges: Edge[];
    idMapping: Record<string, string>;
  } => {
    if (!clipboardData || clipboardData.originalNodes.length === 0) {
      return { nodes: [], edges: [], idMapping: {} };
    }

    // 计算偏移 (累积偏移)
    const currentPasteCount = pasteCountRef.current + 1;
    const offsetMultiplier = Math.min(currentPasteCount, MAX_OFFSET / DEFAULT_OFFSET);
    const offsetX = defaultOffset?.x ?? DEFAULT_OFFSET * offsetMultiplier;
    const offsetY = defaultOffset?.y ?? DEFAULT_OFFSET * offsetMultiplier;

    // 生成 ID 映射
    const idMapping: Record<string, string> = {};
    clipboardData.originalNodes.forEach((node) => {
      idMapping[node.id] = generateId();
    });

    // 创建新节点
    const newNodes: Node[] = clipboardData.originalNodes.map((node) => ({
      id: idMapping[node.id],
      type: node.type,
      position: {
        x: node.position.x + offsetX,
        y: node.position.y + offsetY,
      },
      data: { ...node.data },
      // 保留原始尺寸
      width: (node.data as any)?.nodeWidth,
      height: (node.data as any)?.nodeHeight,
    }));

    // 创建新边 (使用映射后的 ID)
    const newEdges: Edge[] = clipboardData.originalEdges
      .filter((edge) => idMapping[edge.source] && idMapping[edge.target])
      .map((edge) => ({
        id: generateId(), // 边也生成新 ID
        source: idMapping[edge.source],
        target: idMapping[edge.target],
        type: edge.type,
        label: edge.label,
        data: edge.data,
      }));

    // 更新粘贴次数
    const updatedData: ClipboardData = {
      ...clipboardData,
      pasteCount: currentPasteCount,
    };
    setClipboardData(updatedData);
    setPasteCount(currentPasteCount);
    pasteCountRef.current = currentPasteCount;
    saveToStorage(updatedData);

    return { nodes: newNodes, edges: newEdges, idMapping };
  }, [clipboardData]);

  // ============================================================
  // Clear
  // ============================================================

  const clear = useCallback(() => {
    setClipboardData(null);
    setPasteCount(0);
    pasteCountRef.current = 0;
    clearStorage();
  }, []);

  // ============================================================
  // Getters
  // ============================================================

  const getPasteCount = useCallback(() => pasteCountRef.current, []);

  const resetPasteCount = useCallback(() => {
    setPasteCount(0);
    pasteCountRef.current = 0;
    if (clipboardData) {
      const updatedData = { ...clipboardData, pasteCount: 0 };
      setClipboardData(updatedData);
      saveToStorage(updatedData);
    }
  }, [clipboardData]);

  return {
    canPaste: clipboardData !== null && clipboardData.originalNodes.length > 0,
    clipboardData,
    copy,
    cut,
    paste,
    clear,
    getPasteCount,
    resetPasteCount,
  };
}

export default useClipboard;
