/**
 * useCanvasSnapshot - 画布快照管理 Hook
 * 
 * 功能:
 * - 创建画布快照
 * - 恢复快照
 * - 快照对比
 * - 自动清理旧快照
 * - localStorage 持久化
 * 
 * @example
 * ```tsx
 * const {
 *   snapshots,
 *   createSnapshot,
 *   restoreSnapshot,
 *   deleteSnapshot,
 *   compareSnapshots,
 * } = useCanvasSnapshot();
 * ```
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { Node, Edge, Viewport } from 'reactflow';

// ============================================================
// Types
// ============================================================

export interface CanvasSnapshot {
  /** 快照 ID */
  id: string;
  
  /** 快照名称 */
  name: string;
  
  /** 快照描述 */
  description?: string;
  
  /** 创建时间 */
  createdAt: number;
  
  /** 节点快照 */
  nodes: Node[];
  
  /** 边快照 */
  edges: Edge[];
  
  /** 视图位置 */
  viewport?: Viewport;
  
  /** 快照元数据 */
  metadata: {
    nodeCount: number;
    edgeCount: number;
    layoutMode?: string;
  };
}

export interface SnapshotDiff {
  /** 新增的节点 */
  addedNodes: Node[];
  
  /** 删除的节点 */
  removedNodes: Node[];
  
  /** 新增的边 */
  addedEdges: Edge[];
  
  /** 删除的边 */
  removedEdges: Edge[];
  
  /** 位置变化的节点 */
  movedNodes: Array<{
    node: Node;
    oldPosition: { x: number; y: number };
    newPosition: { x: number; y: number };
  }>;
}

export interface SnapshotPolicy {
  /** 最大快照数 */
  maxSnapshots: number;
  
  /** 是否自动清理 */
  autoCleanup: boolean;
  
  /** 清理策略 */
  cleanupStrategy: 'oldest' | 'largest' | 'manual';
}

// ============================================================
// Constants
// ============================================================

const SNAPSHOTS_STORAGE_KEY = 'ontology-canvas-snapshots';

const DEFAULT_POLICY: SnapshotPolicy = {
  maxSnapshots: 20,
  autoCleanup: true,
  cleanupStrategy: 'oldest',
};

// ============================================================
// ID Generation
// ============================================================

function generateId(): string {
  return `snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ============================================================
// Storage Helpers
// ============================================================

function loadSnapshots(): CanvasSnapshot[] {
  try {
    const stored = localStorage.getItem(SNAPSHOTS_STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

function saveSnapshots(snapshots: CanvasSnapshot[]): void {
  try {
    localStorage.setItem(SNAPSHOTS_STORAGE_KEY, JSON.stringify(snapshots));
  } catch (error) {
    console.error('[useCanvasSnapshot] Failed to save snapshots:', error);
  }
}

// ============================================================
// Diff Calculation
// ============================================================

function calculateDiff(before: CanvasSnapshot, after: CanvasSnapshot): SnapshotDiff {
  const beforeNodeMap = new Map(before.nodes.map((n) => [n.id, n]));
  const afterNodeMap = new Map(after.nodes.map((n) => [n.id, n]));
  
  const beforeEdgeMap = new Map(before.edges.map((e) => [e.id, e]));
  const afterEdgeMap = new Map(after.edges.map((e) => [e.id, e]));

  // 新增节点
  const addedNodes = after.nodes.filter((n) => !beforeNodeMap.has(n.id));
  
  // 删除节点
  const removedNodes = before.nodes.filter((n) => !afterNodeMap.has(n.id));
  
  // 新增边
  const addedEdges = after.edges.filter((e) => !beforeEdgeMap.has(e.id));
  
  // 删除边
  const removedEdges = before.edges.filter((e) => !afterEdgeMap.has(e.id));
  
  // 位置变化的节点
  const movedNodes: SnapshotDiff['movedNodes'] = [];
  
  after.nodes.forEach((afterNode) => {
    const beforeNode = beforeNodeMap.get(afterNode.id);
    if (beforeNode && beforeNode.position) {
      const dx = Math.abs(afterNode.position.x - beforeNode.position.x);
      const dy = Math.abs(afterNode.position.y - beforeNode.position.y);
      if (dx > 1 || dy > 1) { // 阈值 1px
        movedNodes.push({
          node: afterNode,
          oldPosition: beforeNode.position,
          newPosition: afterNode.position,
        });
      }
    }
  });

  return {
    addedNodes,
    removedNodes,
    addedEdges,
    removedEdges,
    movedNodes,
  };
}

// ============================================================
// Hook
// ============================================================

export interface UseCanvasSnapshotReturn {
  /** 所有快照 */
  snapshots: CanvasSnapshot[];
  
  /** 快照数量 */
  snapshotCount: number;
  
  /** 快照策略 */
  policy: SnapshotPolicy;
  
  /** 创建快照 */
  createSnapshot: (
    name: string,
    nodes: Node[],
    edges: Edge[],
    viewport?: Viewport,
    description?: string,
    metadata?: Partial<CanvasSnapshot['metadata']>
  ) => CanvasSnapshot;
  
  /** 恢复快照 */
  restoreSnapshot: (id: string) => CanvasSnapshot | null;
  
  /** 删除快照 */
  deleteSnapshot: (id: string) => boolean;
  
  /** 重命名快照 */
  renameSnapshot: (id: string, name: string) => boolean;
  
  /** 更新快照描述 */
  updateDescription: (id: string, description: string) => boolean;
  
  /** 对比两个快照 */
  compareSnapshots: (id1: string, id2: string) => SnapshotDiff | null;
  
  /** 导出快照为 JSON */
  exportSnapshot: (id: string) => string | null;
  
  /** 从 JSON 导入快照 */
  importSnapshot: (json: string) => CanvasSnapshot | null;
  
  /** 清空所有快照 */
  clearAll: () => void;
  
  /** 更新策略 */
  setPolicy: (policy: Partial<SnapshotPolicy>) => void;
  
  /** 手动清理 */
  cleanup: () => number; // 返回清理数量
}

export function useCanvasSnapshot(initialPolicy?: Partial<SnapshotPolicy>): UseCanvasSnapshotReturn {
  const [snapshots, setSnapshots] = useState<CanvasSnapshot[]>(() => loadSnapshots());
  const [policy, setPolicyState] = useState<SnapshotPolicy>(() => ({
    ...DEFAULT_POLICY,
    ...initialPolicy,
  }));

  const policyRef = useRef(policy);
  policyRef.current = policy;

  // ============================================================
  // Create Snapshot
  // ============================================================

  const createSnapshot = useCallback((
    name: string,
    nodes: Node[],
    edges: Edge[],
    viewport?: Viewport,
    description?: string,
    metadata?: Partial<CanvasSnapshot['metadata']>
  ): CanvasSnapshot => {
    const snapshot: CanvasSnapshot = {
      id: generateId(),
      name,
      description,
      createdAt: Date.now(),
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
      viewport: viewport ? { ...viewport } : undefined,
      metadata: {
        nodeCount: nodes.length,
        edgeCount: edges.length,
        ...metadata,
      },
    };

    setSnapshots((prev) => {
      let updated = [snapshot, ...prev];
      
      // 自动清理
      if (policyRef.current.autoCleanup && updated.length > policyRef.current.maxSnapshots) {
        updated = cleanupSnapshots(updated, policyRef.current);
      }
      
      saveSnapshots(updated);
      return updated;
    });

    return snapshot;
  }, []);

  // ============================================================
  // Restore Snapshot
  // ============================================================

  const restoreSnapshot = useCallback((id: string): CanvasSnapshot | null => {
    const snapshot = snapshots.find((s) => s.id === id);
    if (!snapshot) return null;
    
    // 深拷贝返回
    return JSON.parse(JSON.stringify(snapshot));
  }, [snapshots]);

  // ============================================================
  // Delete Snapshot
  // ============================================================

  const deleteSnapshot = useCallback((id: string): boolean => {
    const index = snapshots.findIndex((s) => s.id === id);
    if (index === -1) return false;

    setSnapshots((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      saveSnapshots(updated);
      return updated;
    });

    return true;
  }, [snapshots]);

  // ============================================================
  // Rename Snapshot
  // ============================================================

  const renameSnapshot = useCallback((id: string, name: string): boolean => {
    const snapshot = snapshots.find((s) => s.id === id);
    if (!snapshot) return false;

    setSnapshots((prev) => {
      const updated = prev.map((s) =>
        s.id === id ? { ...s, name } : s
      );
      saveSnapshots(updated);
      return updated;
    });

    return true;
  }, [snapshots]);

  // ============================================================
  // Update Description
  // ============================================================

  const updateDescription = useCallback((id: string, description: string): boolean => {
    const snapshot = snapshots.find((s) => s.id === id);
    if (!snapshot) return false;

    setSnapshots((prev) => {
      const updated = prev.map((s) =>
        s.id === id ? { ...s, description } : s
      );
      saveSnapshots(updated);
      return updated;
    });

    return true;
  }, [snapshots]);

  // ============================================================
  // Compare Snapshots
  // ============================================================

  const compareSnapshots = useCallback((id1: string, id2: string): SnapshotDiff | null => {
    const snapshot1 = snapshots.find((s) => s.id === id1);
    const snapshot2 = snapshots.find((s) => s.id === id2);
    
    if (!snapshot1 || !snapshot2) return null;
    
    // 始终以较早的作为 before
    if (snapshot1.createdAt > snapshot2.createdAt) {
      return calculateDiff(snapshot2, snapshot1);
    }
    return calculateDiff(snapshot1, snapshot2);
  }, [snapshots]);

  // ============================================================
  // Export/Import
  // ============================================================

  const exportSnapshot = useCallback((id: string): string | null => {
    const snapshot = snapshots.find((s) => s.id === id);
    if (!snapshot) return null;
    return JSON.stringify(snapshot, null, 2);
  }, [snapshots]);

  const importSnapshot = useCallback((json: string): CanvasSnapshot | null => {
    try {
      const data = JSON.parse(json);
      
      if (!data.name || !Array.isArray(data.nodes)) {
        throw new Error('Invalid snapshot format');
      }

      const snapshot: CanvasSnapshot = {
        ...data,
        id: generateId(), // 生成新 ID
        createdAt: Date.now(), // 更新时间戳
      };

      setSnapshots((prev) => {
        let updated = [snapshot, ...prev];
        
        if (policyRef.current.autoCleanup && updated.length > policyRef.current.maxSnapshots) {
          updated = cleanupSnapshots(updated, policyRef.current);
        }
        
        saveSnapshots(updated);
        return updated;
      });

      return snapshot;
    } catch (error) {
      console.error('[useCanvasSnapshot] Failed to import snapshot:', error);
      return null;
    }
  }, []);

  // ============================================================
  // Clear All
  // ============================================================

  const clearAll = useCallback(() => {
    setSnapshots([]);
    saveSnapshots([]);
  }, []);

  // ============================================================
  // Policy
  // ============================================================

  const setPolicy = useCallback((newPolicy: Partial<SnapshotPolicy>) => {
    setPolicyState((prev) => {
      const updated = { ...prev, ...newPolicy };
      policyRef.current = updated;
      return updated;
    });
  }, []);

  // ============================================================
  // Cleanup
  // ============================================================

  function cleanupSnapshots(
    snapshotList: CanvasSnapshot[],
    policy: SnapshotPolicy
  ): CanvasSnapshot[] {
    if (snapshotList.length <= policy.maxSnapshots) {
      return snapshotList;
    }

    const toRemove = snapshotList.length - policy.maxSnapshots;
    const sorted = [...snapshotList].sort((a, b) => a.createdAt - b.createdAt);

    switch (policy.cleanupStrategy) {
      case 'oldest':
        return sorted.slice(toRemove);
      case 'largest':
        const bySize = sorted.sort(
          (a, b) =>
            (b.metadata.nodeCount + b.metadata.edgeCount) -
            (a.metadata.nodeCount + a.metadata.edgeCount)
        );
        return bySize.slice(Math.max(0, toRemove));
      case 'manual':
      default:
        return snapshotList;
    }
  }

  const cleanup = useCallback((): number => {
    if (snapshots.length <= policy.maxSnapshots) return 0;

    let removedCount = 0;
    setSnapshots((prev) => {
      const updated = cleanupSnapshots(prev, policy);
      removedCount = prev.length - updated.length;
      if (removedCount > 0) {
        saveSnapshots(updated);
      }
      return updated;
    });

    return removedCount;
  }, [snapshots, policy]);

  return {
    snapshots,
    snapshotCount: snapshots.length,
    policy,
    createSnapshot,
    restoreSnapshot,
    deleteSnapshot,
    renameSnapshot,
    updateDescription,
    compareSnapshots,
    exportSnapshot,
    importSnapshot,
    clearAll,
    setPolicy,
    cleanup,
  };
}

export default useCanvasSnapshot;
