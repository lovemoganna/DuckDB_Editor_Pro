/**
 * useSelection - 节点/边选择状态管理 Hook
 * 
 * 功能:
 * - 单选/多选节点和边
 * - Shift+Click 添加到选择
 * - Ctrl+Click 切换选择
 * - Ctrl+A 全选
 * - Escape 清空选择
 * - 框选 (Box Selection)
 * 
 * @example
 * ```tsx
 * const {
 *   selectedNodeIds,
 *   select,
 *   selectAll,
 *   clearSelection,
 *   startBoxSelection,
 *   endBoxSelection,
 * } = useSelection(nodes, edges);
 * ```
 */

import { useReducer, useCallback, useMemo } from 'react';
import type { Node, Edge } from 'reactflow';
import type { Position } from '../OntologyCanvas.helpers';

// ============================================================
// Types
// ============================================================

export type SelectionMode = 'none' | 'single' | 'multi' | 'box';

export interface SelectionState {
  mode: SelectionMode;
  selectedNodeIds: Set<string>;
  selectedEdgeIds: Set<string>;
  boxStart: Position | null;
  boxEnd: Position | null;
  isBoxSelecting: boolean;
}

export type SelectionAction =
  | { type: 'SET_MODE'; mode: SelectionMode }
  | { type: 'TOGGLE_NODE'; nodeId: string; additive: boolean }
  | { type: 'TOGGLE_EDGE'; edgeId: string; additive: boolean }
  | { type: 'SELECT_NODE'; nodeId: string }
  | { type: 'SELECT_EDGE'; edgeId: string }
  | { type: 'DESELECT_NODE'; nodeId: string }
  | { type: 'DESELECT_EDGE'; edgeId: string }
  | { type: 'SELECT_ALL'; nodeIds: string[]; edgeIds: string[] }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'START_BOX'; position: Position }
  | { type: 'UPDATE_BOX'; position: Position }
  | { type: 'END_BOX' }
  | { type: 'DELETE_SELECTED' };

// ============================================================
// Reducer
// ============================================================

const initialState: SelectionState = {
  mode: 'none',
  selectedNodeIds: new Set(),
  selectedEdgeIds: new Set(),
  boxStart: null,
  boxEnd: null,
  isBoxSelecting: false,
};

function selectionReducer(state: SelectionState, action: SelectionAction): SelectionState {
  switch (action.type) {
    case 'SET_MODE':
      return { ...state, mode: action.mode };

    case 'TOGGLE_NODE': {
      const newSet = new Set(state.selectedNodeIds);
      if (newSet.has(action.nodeId)) {
        newSet.delete(action.nodeId);
      } else {
        newSet.add(action.nodeId);
      }
      return {
        ...state,
        mode: newSet.size > 1 ? 'multi' : newSet.size === 1 ? 'single' : 'none',
        selectedNodeIds: newSet,
      };
    }

    case 'TOGGLE_EDGE': {
      const newSet = new Set(state.selectedEdgeIds);
      if (newSet.has(action.edgeId)) {
        newSet.delete(action.edgeId);
      } else {
        newSet.add(action.edgeId);
      }
      return {
        ...state,
        mode: newSet.size > 1 ? 'multi' : newSet.size === 1 ? 'single' : 'none',
        selectedEdgeIds: newSet,
      };
    }

    case 'SELECT_NODE':
      return {
        ...state,
        mode: 'single',
        selectedNodeIds: new Set([action.nodeId]),
        selectedEdgeIds: new Set(),
      };

    case 'SELECT_EDGE':
      return {
        ...state,
        mode: 'single',
        selectedNodeIds: new Set(),
        selectedEdgeIds: new Set([action.edgeId]),
      };

    case 'DESELECT_NODE': {
      const newSet = new Set(state.selectedNodeIds);
      newSet.delete(action.nodeId);
      return {
        ...state,
        mode: newSet.size > 1 ? 'multi' : newSet.size === 1 ? 'single' : 'none',
        selectedNodeIds: newSet,
      };
    }

    case 'DESELECT_EDGE': {
      const newSet = new Set(state.selectedEdgeIds);
      newSet.delete(action.edgeId);
      return {
        ...state,
        mode: newSet.size > 1 ? 'multi' : newSet.size === 1 ? 'single' : 'none',
        selectedEdgeIds: newSet,
      };
    }

    case 'SELECT_ALL':
      return {
        ...state,
        mode: action.nodeIds.length + action.edgeIds.length > 1 ? 'multi' : 'single',
        selectedNodeIds: new Set(action.nodeIds),
        selectedEdgeIds: new Set(action.edgeIds),
      };

    case 'CLEAR_SELECTION':
      return {
        ...state,
        mode: 'none',
        selectedNodeIds: new Set(),
        selectedEdgeIds: new Set(),
        boxStart: null,
        boxEnd: null,
        isBoxSelecting: false,
      };

    case 'START_BOX':
      return {
        ...state,
        mode: 'box',
        boxStart: action.position,
        boxEnd: action.position,
        isBoxSelecting: true,
      };

    case 'UPDATE_BOX':
      return {
        ...state,
        boxEnd: action.position,
      };

    case 'END_BOX':
      return {
        ...state,
        mode: state.selectedNodeIds.size > 0 || state.selectedEdgeIds.size > 0 ? 'multi' : 'none',
        boxStart: null,
        boxEnd: null,
        isBoxSelecting: false,
      };

    case 'DELETE_SELECTED':
      return {
        ...state,
        mode: 'none',
        selectedNodeIds: new Set(),
        selectedEdgeIds: new Set(),
      };

    default:
      return state;
  }
}

// ============================================================
// Hook
// ============================================================

export interface UseSelectionReturn {
  /** 当前选择状态 */
  state: SelectionState;
  
  /** 是否选中某个节点 */
  isNodeSelected: (nodeId: string) => boolean;
  
  /** 是否选中某条边 */
  isEdgeSelected: (edgeId: string) => boolean;
  
  /** 是否有选中项 */
  hasSelection: boolean;
  
  /** 选中节点数量 */
  selectedNodeCount: number;
  
  /** 选中边数量 */
  selectedEdgeCount: number;
  
  /** 获取选中的节点ID列表 */
  getSelectedNodeIds: () => string[];
  
  /** 获取选中的边ID列表 */
  getSelectedEdgeIds: () => string[];
  
  /** 选择单个节点 (替换现有选择) */
  selectNode: (nodeId: string) => void;
  
  /** 选择单个边 (替换现有选择) */
  selectEdge: (edgeId: string) => void;
  
  /** 切换节点选择 (Shift+Click) */
  toggleNode: (nodeId: string) => void;
  
  /** 切换边选择 (Shift+Click) */
  toggleEdge: (edgeId: string) => void;
  
  /** 添加节点到选择 (Ctrl+Click) */
  addNodeToSelection: (nodeId: string) => void;
  
  /** 添加边到选择 (Ctrl+Click) */
  addEdgeToSelection: (edgeId: string) => void;
  
  /** 从选择中移除节点 */
  deselectNode: (nodeId: string) => void;
  
  /** 从选择中移除边 */
  deselectEdge: (edgeId: string) => void;
  
  /** 全选 */
  selectAll: (nodeIds: string[], edgeIds?: string[]) => void;
  
  /** 清空选择 */
  clearSelection: () => void;
  
  /** 开始框选 */
  startBoxSelection: (position: Position) => void;
  
  /** 更新框选范围 */
  updateBoxSelection: (position: Position) => void;
  
  /** 结束框选并选中框内元素 */
  endBoxSelection: (nodes: Node[], edges: Edge[]) => void;
  
  /** 完成框选后设置选中项 */
  setBoxSelectionComplete: (nodeIds: string[], edgeIds?: string[]) => void;
  
  /** 删除选中项 (仅更新选择状态，不实际删除) */
  deleteSelection: () => void;
}

export function useSelection(nodes: Node[] = [], edges: Edge[] = []): UseSelectionReturn {
  const [state, dispatch] = useReducer(selectionReducer, initialState);

  // ============================================================
  // Selectors
  // ============================================================

  const isNodeSelected = useCallback(
    (nodeId: string) => state.selectedNodeIds.has(nodeId),
    [state.selectedNodeIds]
  );

  const isEdgeSelected = useCallback(
    (edgeId: string) => state.selectedEdgeIds.has(edgeId),
    [state.selectedEdgeIds]
  );

  const hasSelection = useMemo(
    () => state.selectedNodeIds.size > 0 || state.selectedEdgeIds.size > 0,
    [state.selectedNodeIds.size, state.selectedEdgeIds.size]
  );

  const selectedNodeCount = state.selectedNodeIds.size;
  const selectedEdgeCount = state.selectedEdgeIds.size;

  const getSelectedNodeIds = useCallback(
    () => Array.from(state.selectedNodeIds),
    [state.selectedNodeIds]
  );

  const getSelectedEdgeIds = useCallback(
    () => Array.from(state.selectedEdgeIds),
    [state.selectedEdgeIds]
  );

  // ============================================================
  // Actions
  // ============================================================

  const selectNode = useCallback((nodeId: string) => {
    dispatch({ type: 'SELECT_NODE', nodeId });
  }, []);

  const selectEdge = useCallback((edgeId: string) => {
    dispatch({ type: 'SELECT_EDGE', edgeId });
  }, []);

  const toggleNode = useCallback((nodeId: string) => {
    dispatch({ type: 'TOGGLE_NODE', nodeId, additive: true });
  }, []);

  const toggleEdge = useCallback((edgeId: string) => {
    dispatch({ type: 'TOGGLE_EDGE', edgeId, additive: true });
  }, []);

  const addNodeToSelection = useCallback((nodeId: string) => {
    dispatch({ type: 'TOGGLE_NODE', nodeId, additive: true });
  }, []);

  const addEdgeToSelection = useCallback((edgeId: string) => {
    dispatch({ type: 'TOGGLE_EDGE', edgeId, additive: true });
  }, []);

  const deselectNode = useCallback((nodeId: string) => {
    dispatch({ type: 'DESELECT_NODE', nodeId });
  }, []);

  const deselectEdge = useCallback((edgeId: string) => {
    dispatch({ type: 'DESELECT_EDGE', edgeId });
  }, []);

  const selectAll = useCallback((nodeIds: string[], edgeIds: string[] = []) => {
    dispatch({ type: 'SELECT_ALL', nodeIds, edgeIds });
  }, []);

  const clearSelection = useCallback(() => {
    dispatch({ type: 'CLEAR_SELECTION' });
  }, []);

  // ============================================================
  // Box Selection
  // ============================================================

  const startBoxSelection = useCallback((position: Position) => {
    dispatch({ type: 'START_BOX', position });
  }, []);

  const updateBoxSelection = useCallback((position: Position) => {
    dispatch({ type: 'UPDATE_BOX', position });
  }, []);

  /**
   * 结束框选，计算框内的节点和边
   */
  const endBoxSelection = useCallback((allNodes: Node[], allEdges: Edge[]) => {
    if (!state.boxStart || !state.boxEnd) {
      dispatch({ type: 'END_BOX' });
      return;
    }

    // 计算框选矩形 (归一化坐标)
    const minX = Math.min(state.boxStart.x, state.boxEnd.x);
    const maxX = Math.max(state.boxStart.x, state.boxEnd.x);
    const minY = Math.min(state.boxStart.y, state.boxEnd.y);
    const maxY = Math.max(state.boxStart.y, state.boxEnd.y);

    // 找出框内的节点
    const selectedNodeIds = allNodes
      .filter((node) => {
        const { x, y } = node.position;
        const width = (node.width ?? 220) as number;
        const height = (node.height ?? 82) as number;
        
        // 检查节点是否与选框相交
        return (
          x + width >= minX &&
          x <= maxX &&
          y + height >= minY &&
          y <= maxY
        );
      })
      .map((node) => node.id);

    // 找出框内边 (两端点都在框内或选框穿过边)
    const selectedEdgeIds = allEdges
      .filter((edge) => {
        const sourceNode = allNodes.find((n) => n.id === edge.source);
        const targetNode = allNodes.find((n) => n.id === edge.target);
        
        if (!sourceNode || !targetNode) return false;
        
        const sourceX = sourceNode.position.x + ((sourceNode.width ?? 220) as number) / 2;
        const sourceY = sourceNode.position.y + ((sourceNode.height ?? 82) as number) / 2;
        const targetX = targetNode.position.x + ((targetNode.width ?? 220) as number) / 2;
        const targetY = targetNode.position.y + ((targetNode.height ?? 82) as number) / 2;

        // 检查边的任一端点是否在选框内
        const sourceInBox = sourceX >= minX && sourceX <= maxX && sourceY >= minY && sourceY <= maxY;
        const targetInBox = targetX >= minX && targetX <= maxX && targetY >= minY && targetY <= maxY;

        return sourceInBox || targetInBox;
      })
      .map((edge) => edge.id);

    dispatch({ type: 'SELECT_ALL', nodeIds: selectedNodeIds, edgeIds: selectedEdgeIds });
    dispatch({ type: 'END_BOX' });
  }, [state.boxStart, state.boxEnd]);

  /**
   * 直接设置框选结果
   */
  const setBoxSelectionComplete = useCallback((nodeIds: string[], edgeIds: string[] = []) => {
    dispatch({ type: 'SELECT_ALL', nodeIds, edgeIds });
    dispatch({ type: 'END_BOX' });
  }, []);

  const deleteSelection = useCallback(() => {
    dispatch({ type: 'DELETE_SELECTED' });
  }, []);

  return {
    state,
    isNodeSelected,
    isEdgeSelected,
    hasSelection,
    selectedNodeCount,
    selectedEdgeCount,
    getSelectedNodeIds,
    getSelectedEdgeIds,
    selectNode,
    selectEdge,
    toggleNode,
    toggleEdge,
    addNodeToSelection,
    addEdgeToSelection,
    deselectNode,
    deselectEdge,
    selectAll,
    clearSelection,
    startBoxSelection,
    updateBoxSelection,
    endBoxSelection,
    setBoxSelectionComplete,
    deleteSelection,
  };
}

export default useSelection;
