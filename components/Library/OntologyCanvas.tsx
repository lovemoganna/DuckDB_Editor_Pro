import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Node,
  Edge,
  useViewport,
  Connection,
  MarkerType,
  ReactFlowInstance,
  NodeChange,
  EdgeChange,
  SelectionMode,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useConfirmDialog } from '../ui/ConfirmDialog';
import { useToastManager, ToastPortal } from '../ui/ToastNotification';
import { ModalShell, ActionButton, IconButton } from '../ui/Workbench';

import {
  Sparkles, Database, Plus, Trash2, ArrowRight,
  Check, AlertTriangle, Search, RefreshCw, ZoomIn, ZoomOut, Maximize2,
  X, Link2, Info, Move, Settings, Zap, BookOpen, GitCommit,
  ChevronDown, ChevronUp, Lock, Unlock, RotateCcw, RotateCw,
  Copy, Clipboard, Layers, Trash, Square, CheckSquare,
  Keyboard,
} from 'lucide-react';

import { useOntologyStore } from '../../hooks/useOntologyStore';
import { duckDBService } from '../../services/duckdbService';
import {
  Position,
  SavedPositions,
  GRID_SIZE,
  TYPE_COLORS,
  getTypeStyles,
  resolveCollisions,
  OntologyNode,
  OntologyEdge,
  ONTOLOGY_LAYOUTS,
  downloadOntologyGraph,
  getLayoutedElements,
  applyIncrementalLocalLayout,
  canvasPositionsNeedRelayout,
  getOrthogonalRouteForEdge,
  sideToHandleId,
  compileOntologyToCTE,
  getOntologyNodeDimensions,
  NODE_DEFAULT_WIDTH,
  NODE_COLLAPSED_HEIGHT,
} from './OntologyCanvas/index';
import type { OntologyLayoutMode } from './OntologyCanvas/index';
import { CanvasContextMenu, type ContextMenuState, type ContextMenuType } from './OntologyCanvas/CanvasContextMenu';
import { OntologyCanvasHeader } from './OntologyCanvas/OntologyCanvasHeader';
import { UnifiedCanvasToolbar } from './OntologyCanvas/UnifiedCanvasToolbar';
import { BatchWorkbench, type NodeData as BatchNodeData } from './OntologyCanvas/BatchWorkbench';
import { EdgePropertyDialog, type EdgeProperties, type EdgePropertyUpdates } from './OntologyCanvas/EdgePropertyDialog';
import { HistoryPanel, type HistoryEntry } from './OntologyCanvas/HistoryPanel';
import { resolveReadableCanvasZoom } from './ontologyViewportPolicy';
import { ShortcutsHelpDialog } from './OntologyCanvas/ShortcutsHelpDialog';

/**
 * Graph keys that already received a forced first-entry layout this page session.
 * Survives OntologyCanvas remounts (tab switches) so user drag / 排版微调 results
 * are not wiped when returning to the canvas.
 */
const canvasForcedLayoutKeys = new Set<string>();

// Custom style injection for Monokai Context IDE theme controls
const DarkStyle = () => (
  <style>{`
    .react-flow__controls {
      background: var(--monokai-surface) !important;
      border: 1px solid var(--monokai-border) !important;
      border-radius: 6px !important;
      overflow: hidden;
      box-shadow: var(--shadow-md) !important;
    }
    .react-flow__controls-button {
      background: transparent !important;
      border-bottom: 1px solid var(--monokai-border) !important;
      fill: var(--monokai-comment) !important;
      color: var(--monokai-comment) !important;
      width: 26px !important;
      height: 26px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      transition: background-color 120ms ease, color 120ms ease, fill 120ms ease !important;
    }
    .react-flow__controls-button:hover {
      background: var(--monokai-elevated) !important;
      fill: var(--monokai-fg) !important;
      color: var(--monokai-fg) !important;
    }
    .react-flow__minimap {
      background: var(--monokai-sidebar) !important;
      border: 1px solid var(--monokai-border) !important;
      border-radius: 6px !important;
    }
    .react-flow__edge-path {
      transition: stroke 0.25s ease, stroke-width 0.2s ease;
    }
    .react-flow__edge.selected .react-flow__edge-path {
      stroke: var(--monokai-cyan) !important;
      stroke-width: 2.5px !important;
    }
    .react-flow__node {
      position: absolute !important;
    }
    .react-flow__viewport {
      transition: none !important;
    }
  `}</style>
);

const nodeTypes = {
  ontology: OntologyNode,
};

const edgeTypes = {
  ontology: OntologyEdge,
};

interface OntologyCanvasInnerProps {
  onInsert?: (sql: string) => void;
  ontologyState?: any;
  onInspect?: (mode: 'object', target: any) => void;
}

const OntologyCanvasInner: React.FC<OntologyCanvasInnerProps> = ({ onInsert, ontologyState, onInspect }) => {
  const store = useOntologyStore();
  const { confirm } = useConfirmDialog();
  const { toasts, addToast, removeToast } = useToastManager();
  const storeState = ontologyState ?? store.state;
  const {
    objects = [],
    objectTypes = [],
    links = [],
    linkTypes = []
  } = storeState ?? {};

  // Store actions
  const {
    dispatch,
    createObject,
    deleteObject,
    createLink,
    deleteLink,
    updateObject,
    canvasPositions,
    canvasLockedNodeIds,
    updateCanvasPosition,
    updateCanvasPositions,
    toggleLockNode: toggleLockNodeStore,
    lockAllNodes,
    unlockAllNodes
  } = store;

  const reactFlowInstance = useReactFlow();
  const { x: rfX, y: rfY, zoom: rfZoom } = useViewport();

  // ReactFlow Nodes and Edges States
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Selected, Dragging & Hover States
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<number | null>(null);

  // Use values from global store
  const nodePositions = canvasPositions;
  const lockedNodeIds = canvasLockedNodeIds;


  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<number>>(new Set());
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__rfInstance = reactFlowInstance;
    }
  }, [reactFlowInstance]);

  // DuckDB Table Import States & Callback
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [dbTables, setDbTables] = useState<string[]>([]);
  const [importing, setImporting] = useState<boolean>(false);
  // Reverse Engineering Progress
  const [reverseProgress, setReverseProgress] = useState<{ current: number; total: number } | null>(null);

  // ── 批量选择与剪贴板状态 ──────────────────────────────────────
  /** 多选节点ID集合 */
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  /** 多选连线ID集合 */
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<Set<string>>(new Set());
  /** 复制的节点数据（用于粘贴） */
  const [clipboardData, setClipboardData] = useState<any[]>([]);
  
  /** 获取选中的节点数量 */
  const selectedNodeCount = selectedNodeIds.size;
  /** 获取选中的连线数量 */
  const selectedEdgeCount = selectedEdgeIds.size;
  /** 是否有剪贴板数据 */
  const hasClipboardData = clipboardData.length > 0;

  // ── 批量工作台状态 (MECE v3.0) ────────────────────────────────
  /** 是否显示批量工作台 */
  const [showBatchWorkbench, setShowBatchWorkbench] = useState<boolean>(false);

  // ── 历史面板状态 (MECE v3.0) ─────────────────────────────────
  /** 是否显示历史面板 */
  const [showHistoryPanel, setShowHistoryPanel] = useState<boolean>(false);
  /** 历史记录列表 */
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  /** 当前历史索引 */
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // ── 连线属性编辑状态 (MECE v3.0) ──────────────────────────────
  /** 是否显示连线属性编辑对话框 */
  const [showEdgePropertyDialog, setShowEdgePropertyDialog] = useState<boolean>(false);
  /** 当前编辑的连线属性 */
  const [editingEdgeProperties, setEditingEdgeProperties] = useState<EdgeProperties | null>(null);

  // ── 布局预设状态 (MECE v3.0) ─────────────────────────────────
  /** 布局预设列表 */
  const [layoutPresets, setLayoutPresets] = useState<Array<{ id: string; name: string; builtIn?: boolean }>>([]);
  /** 当前激活的预设ID */
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  // Dynamic Auto-Align Layout configuration settings
  const [nodesep, setNodesep] = useState<number>(100);
  const [ranksep, setRanksep] = useState<number>(200);
  const [layoutMode, setLayoutMode] = useState<OntologyLayoutMode>('orthogonal');
  const [parallelOffset, setParallelOffset] = useState<number>(35); // Stable lanes for parallel orthogonal edges
  const [edgeRoutingMode, setEdgeRoutingMode] = useState<'straight' | 'orthogonal' | 'bezier'>('orthogonal');
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true); // Snap node dragging coordinates to grid snip size
  const [showGrid, setShowGrid] = useState<boolean>(true); // Toggle background dots grid on/off
  const [showMiniMap, setShowMiniMap] = useState<boolean>(true); // Toggle bottom-right minimap on/off
  const [animateEdges, setAnimateEdges] = useState<boolean>(true); // Toggle connection lines flow animation
  const [enableDbClickCreate, setEnableDbClickCreate] = useState<boolean>(true); // Toggle double click to create node
  const [isReadOnly, setIsReadOnly] = useState<boolean>(false); // Toggle read-only mode
  const [showSpacingPanel, setShowSpacingPanel] = useState<boolean>(false);

  // ── 上下文菜单状态 ──────────────────────────────────────────────
  /** 上下文菜单状态 */
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  /** 右键点击的节点数据 */
  const [contextMenuNodeData, setContextMenuNodeData] = useState<any>(null);
  
  // ── 框选状态 ────────────────────────────────────────────────────
  /** 框选起始点 */
  const [boxSelectionStart, setBoxSelectionStart] = useState<{ x: number; y: number } | null>(null);
  /** 框选模式 */
  const [isBoxSelecting, setIsBoxSelecting] = useState(false);
  const boxSelectionRef = useRef<HTMLDivElement>(null);

  // Undo/Redo History Stacks
  const undoStackRef = useRef<SavedPositions[]>([]);
  const redoStackRef = useRef<SavedPositions[]>([]);

  const pushToHistory = useCallback((positions: SavedPositions) => {
    if (undoStackRef.current.length >= 50) {
      undoStackRef.current.shift();
    }
    undoStackRef.current.push(JSON.parse(JSON.stringify(positions)));
    redoStackRef.current = [];
  }, []);

  // Save specific node position helper
  const saveNodePosition = useCallback((id: number, pos: Position) => {
    const updated = { ...nodePositions, [id]: pos };
    const resolved = resolveCollisions(id, updated, expandedNodeIds);
    updateCanvasPositions(resolved);
  }, [nodePositions, expandedNodeIds, updateCanvasPositions]);

  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    const previous = undoStackRef.current.pop()!;
    redoStackRef.current.push(JSON.parse(JSON.stringify(nodePositions)));
    updateCanvasPositions(previous);
  }, [nodePositions, updateCanvasPositions]);

  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const next = redoStackRef.current.pop()!;
    undoStackRef.current.push(JSON.parse(JSON.stringify(nodePositions)));
    updateCanvasPositions(next);
  }, [nodePositions, updateCanvasPositions]);

  const toggleLockNode = useCallback((nodeId: number) => {
    toggleLockNodeStore(nodeId);
  }, [toggleLockNodeStore]);

  const handleLockAll = () => {
    lockAllNodes();
  };

  const handleUnlockAll = () => {
    unlockAllNodes();
  };

  // ── 上下文菜单处理函数 ────────────────────────────────────────
  /** 打开节点上下文菜单 */
  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    event.stopPropagation();
    
    const nodeId = String(node.id);
    const nodeObj = objects.find((o: any) => o.id === Number(nodeId));
    
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      type: 'node',
      targetId: nodeId,
      targetData: {
        ...nodeObj,
        isLocked: lockedNodeIds.has(Number(nodeId)),
        isExpanded: expandedNodeIds.has(Number(nodeId)),
      },
    });
    setContextMenuNodeData(nodeObj);
  }, [objects, lockedNodeIds, expandedNodeIds]);

  /** 打开连线上下文菜单 */
  const handleEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    event.stopPropagation();
    
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      type: 'edge',
      targetId: String(edge.id),
    });
  }, []);

  /** 打开画布上下文菜单 */
  const handlePaneContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    
    // 计算画布坐标
    const reactFlowBounds = canvasRef.current?.getBoundingClientRect();
    if (!reactFlowBounds) return;
    
    const position = reactFlowInstance.project({
      x: event.clientX - reactFlowBounds.left,
      y: event.clientY - reactFlowBounds.top,
    });
    
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      type: 'canvas',
      targetId: undefined,
      targetData: { position },
    });
  }, [reactFlowInstance]);

  /** 关闭上下文菜单 */
  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
    setContextMenuNodeData(null);
  }, []);

  // ── ReactFlow选择变更监听 ─────────────────────────────────────
  const onSelectionChange = useCallback(({ nodes, edges }: { nodes: Node[], edges: Edge[] }) => {
    setSelectedNodeIds(new Set(nodes.map(n => n.id)));
    setSelectedEdgeIds(new Set(edges.map(e => e.id)));
  }, []);

  // ── 框选处理 ──────────────────────────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isBoxSelecting || !boxSelectionStart) return;
    // 框选逻辑由ReactFlow处理
  }, [isBoxSelecting, boxSelectionStart]);

  const handleMouseUp = useCallback(() => {
    setIsBoxSelecting(false);
    setBoxSelectionStart(null);
  }, []);

  // ── 快捷键帮助显示状态 ────────────────────────────────────────
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // ── 批量操作处理函数 ──────────────────────────────────────────
  /** 全选所有节点 */
  const handleSelectAll = useCallback(() => {
    const allNodeIds = new Set<string>(objects.map((o: any) => String(o.id)));
    setSelectedNodeIds(allNodeIds);
    addToast(`已选择 ${allNodeIds.size} 个节点`, 'info');
  }, [objects, addToast]);

  /** 反选 */
  const handleSelectInverse = useCallback(() => {
    const allNodeIds = new Set<string>(objects.map((o: any) => String(o.id)));
    const newSelection = new Set<string>();
    allNodeIds.forEach(id => {
      if (!selectedNodeIds.has(id)) {
        newSelection.add(id);
      }
    });
    setSelectedNodeIds(newSelection);
    addToast(`已选择 ${newSelection.size} 个节点`, 'info');
  }, [objects, selectedNodeIds, addToast]);

  /** 复制选中节点 */
  const handleCopySelected = useCallback(() => {
    if (selectedNodeIds.size === 0) return;
    
    const copiedNodes = objects.filter((o: any) => selectedNodeIds.has(String(o.id)));
    setClipboardData(copiedNodes);
    
    // 同时复制到系统剪贴板
    try {
      navigator.clipboard.writeText(JSON.stringify(copiedNodes.map((n: any) => ({
        id: n.id,
        name: n.name,
        object_type_id: n.object_type_id,
        properties: n.properties,
      }))));
    } catch (e) {}
    
    addToast(`已复制 ${copiedNodes.length} 个节点`, 'success');
  }, [selectedNodeIds, objects, addToast]);

  /** 剪切选中节点 */
  const handleCutSelected = useCallback(() => {
    if (selectedNodeIds.size === 0 || isReadOnly) return;
    
    handleCopySelected();
    
    // 删除选中的节点
    const deletePromises = Array.from(selectedNodeIds).map(id => 
      deleteObject(Number(id)).catch((err: any) => {
        addToast(`删除节点失败: ${err.message}`, 'error');
      })
    );
    
    Promise.all(deletePromises).then(() => {
      setSelectedNodeIds(new Set());
      addToast(`已剪切 ${selectedNodeIds.size} 个节点`, 'success');
    });
  }, [selectedNodeIds, isReadOnly, addToast, deleteObject]);

  /** 粘贴节点 */
  const handlePaste = useCallback(async () => {
    if (clipboardData.length === 0 || isReadOnly) return;
    
    const reactFlowBounds = canvasRef.current?.getBoundingClientRect();
    if (!reactFlowBounds) return;
    
    // 获取当前视口中心作为粘贴位置
    const centerX = (window.innerWidth / 2 - reactFlowBounds.left);
    const centerY = (window.innerHeight / 2 - reactFlowBounds.top);
    
    const pasteOffset = { x: 30, y: 30 };
    let offsetX = 0, offsetY = 0;
    
    const newNodeIds: number[] = [];
    for (const nodeData of clipboardData) {
      try {
        await createObject(
          `${nodeData.name} (副本)`,
          nodeData.object_type_id,
          typeof nodeData.properties === 'string' ? nodeData.properties : JSON.stringify(nodeData.properties || {})
        );
        
        // 获取新创建的节点ID
        setTimeout(() => {
          store.state.objects.forEach((obj: any) => {
            if (obj.name === `${nodeData.name} (副本)` && obj.object_type_id === nodeData.object_type_id) {
              // 保存新节点位置（偏移）
              const newX = (nodePositions[nodeData.id]?.x || centerX) + offsetX;
              const newY = (nodePositions[nodeData.id]?.y || centerY) + offsetY;
              saveNodePosition(obj.id, { x: newX, y: newY });
              newNodeIds.push(obj.id);
              offsetX += pasteOffset.x;
              offsetY += pasteOffset.y;
            }
          });
        }, 100);
      } catch (err: any) {
        addToast(`粘贴节点失败: ${err.message}`, 'error');
      }
    }
    
    addToast(`已粘贴 ${clipboardData.length} 个节点`, 'success');
  }, [clipboardData, isReadOnly, nodePositions, saveNodePosition, addToast, createObject, store]);

  /** 删除选中节点 */
  const handleDeleteSelected = useCallback(async () => {
    if (selectedNodeIds.size === 0 || isReadOnly) return;
    
    const ok = await confirm({
      title: '批量删除节点',
      message: `确定要删除选中的 ${selectedNodeIds.size} 个节点及其关联连线吗？`,
      variant: 'danger',
      confirmText: '删除全部',
    });
    
    if (ok) {
      const deletePromises = Array.from(selectedNodeIds).map(id => 
        deleteObject(Number(id)).catch((err: any) => {
          addToast(`删除节点失败: ${err.message}`, 'error');
        })
      );
      
      await Promise.all(deletePromises);
      setSelectedNodeIds(new Set());
      setSelectedEdgeIds(new Set());
      addToast(`已删除 ${selectedNodeIds.size} 个节点`, 'success');
    }
  }, [selectedNodeIds, isReadOnly, confirm, addToast, deleteObject]);

  /** 在指定位置创建节点 */
  const handleCreateNodeAtPos = useCallback((x: number, y: number) => {
    setCreateNodeClickPos({ x, y });
    setNewNodeName('');
    setNewNodeTypeId(objectTypes[0]?.id || 1);
    setShowCreateNode(true);
  }, [objectTypes]);

  /** 聚焦到节点 */
  const handleFocusNode = useCallback((nodeId: string) => {
    const nodeX = nodePositions[Number(nodeId)]?.x;
    const nodeY = nodePositions[Number(nodeId)]?.y;
    if (nodeX !== undefined && nodeY !== undefined) {
      reactFlowInstance.setCenter(nodeX, nodeY, { zoom: 1.2, duration: 400 });
    }
  }, [nodePositions, reactFlowInstance]);

  /** 复制并新建节点 */
  const handleDuplicateNode = useCallback(async (nodeId: string) => {
    const nodeObj = objects.find((o: any) => o.id === Number(nodeId));
    if (!nodeObj) return;
    
    try {
      await createObject(
        `${nodeObj.name} (副本)`,
        nodeObj.object_type_id,
        typeof nodeObj.properties === 'string' ? nodeObj.properties : JSON.stringify(nodeObj.properties || {})
      );
      
      // 复制位置并偏移
      setTimeout(() => {
        store.state.objects.forEach((obj: any) => {
          if (obj.name === `${nodeObj.name} (副本)` && obj.object_type_id === nodeObj.object_type_id) {
            const originalPos = nodePositions[Number(nodeId)];
            if (originalPos) {
              saveNodePosition(obj.id, {
                x: originalPos.x + 40,
                y: originalPos.y + 40,
              });
            }
          }
        });
      }, 100);
      
      addToast(`已创建节点副本`, 'success');
    } catch (err: any) {
      addToast(`复制失败: ${err.message}`, 'error');
    }
  }, [objects, nodePositions, saveNodePosition, createObject, store, addToast]);

  /** 反转连线方向 */
  const handleReverseEdge = useCallback(async (edgeId: string) => {
    const edge = links.find((l: any) => l.id === Number(edgeId));
    if (!edge) return;
    
    // 连线方向反转需要删除旧连线并创建新连线
    try {
      await deleteLink(Number(edgeId));
      await createLink(
        edge.link_type_id,
        edge.target_object_id,
        edge.source_object_id,
        edge.weight || 0.5
      );
      addToast('连线方向已反转', 'success');
    } catch (err: any) {
      addToast(`反转失败: ${err.message}`, 'error');
    }
  }, [links, deleteLink, createLink, addToast]);

  /** 高亮关联路径 */
  const handleHighlightPath = useCallback((edgeId: string) => {
    setSelectedNodeId(Number(edgeId)); // 复用selectedNodeId来触发路径高亮
  }, []);

  /** 展开/折叠节点 */
  const handleToggleExpand = useCallback((nodeId: string) => {
    setExpandedNodeIds(prev => {
      const next = new Set(prev);
      const id = Number(nodeId);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ── 批量操作回调函数 (MECE v3.0) ─────────────────────────────
  /** 批量重命名 */
  const handleBatchRename = useCallback(async (nodeIds: number[], newNamePrefix: string, mode: 'prefix' | 'suffix' | 'replace' | 'numbering') => {
    pushToHistory(nodePositions);
    for (let i = 0; i < nodeIds.length; i++) {
      const nodeId = nodeIds[i];
      const node = objects.find((o: any) => o.id === nodeId);
      if (!node) continue;

      let newName = newNamePrefix;
      if (mode === 'prefix') {
        newName = `${newNamePrefix}${node.name}`;
      } else if (mode === 'suffix') {
        newName = `${node.name}${newNamePrefix}`;
      } else if (mode === 'replace') {
        newName = newNamePrefix;
      } else if (mode === 'numbering') {
        newName = `${newNamePrefix}_${String(i + 1).padStart(3, '0')}`;
      }

      await updateObject(nodeId, newName, node.object_type_id, node.properties || '{}');
    }
    addToast(`已重命名 ${nodeIds.length} 个节点`, 'success');
  }, [objects, updateObject, pushToHistory, nodePositions, addToast]);

  /** 批量移动节点位置 */
  const handleBatchMove = useCallback((nodeIds: number[], offsetX: number, offsetY: number) => {
    pushToHistory(nodePositions);
    const updated = { ...nodePositions };
    nodeIds.forEach(id => {
      const pos = updated[id];
      if (pos) {
        updated[id] = { x: pos.x + offsetX, y: pos.y + offsetY };
      }
    });
    updateCanvasPositions(updated);
    addToast(`已移动 ${nodeIds.length} 个节点`, 'success');
  }, [nodePositions, updateCanvasPositions, pushToHistory, addToast]);

  /** 批量修改节点类型 */
  const handleBatchChangeType = useCallback(async (nodeIds: number[], newTypeId: number) => {
    pushToHistory(nodePositions);
    for (const nodeId of nodeIds) {
      const node = objects.find((o: any) => o.id === nodeId);
      if (!node) continue;
      await updateObject(nodeId, node.name, newTypeId, node.properties || '{}');
    }
    addToast(`已修改 ${nodeIds.length} 个节点的类型`, 'success');
  }, [objects, updateObject, pushToHistory, nodePositions, addToast]);

  /** 批量更新节点属性 */
  const handleBatchUpdateProperties = useCallback(async (
    nodeIds: number[],
    updates: {
      addProperties?: Record<string, any>;
      deleteProperties?: string[];
      replacePropertyValues?: { key: string; oldValue?: any; newValue: any }[];
    }
  ) => {
    pushToHistory(nodePositions);
    for (const nodeId of nodeIds) {
      const node = objects.find((o: any) => o.id === nodeId);
      if (!node) continue;
      
      let props = typeof node.properties === 'string' ? JSON.parse(node.properties || '{}') : (node.properties || {});
      
      if (updates.addProperties) {
        props = { ...props, ...updates.addProperties };
      }
      if (updates.deleteProperties) {
        updates.deleteProperties.forEach(key => delete props[key]);
      }
      if (updates.replacePropertyValues) {
        updates.replacePropertyValues.forEach(({ key, oldValue, newValue }) => {
          if (key in props) {
            if (oldValue === undefined || props[key] === oldValue) {
              props[key] = newValue;
            }
          }
        });
      }
      
      await updateObject(nodeId, node.name, node.object_type_id, JSON.stringify(props));
    }
    addToast(`已更新 ${nodeIds.length} 个节点的属性`, 'success');
  }, [objects, updateObject, pushToHistory, nodePositions, addToast]);

  /** 批量导出选中节点 */
  const handleExportSelected = useCallback((nodeIds: number[], format: 'json' | 'csv') => {
    const selectedObjs = objects.filter((o: any) => nodeIds.includes(o.id));
    
    if (format === 'json') {
      const json = JSON.stringify(selectedObjs, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ontology-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const headers = ['id', 'name', 'type_id', 'properties'];
      const rows = selectedObjs.map((o: any) => [
        o.id,
        o.name,
        o.object_type_id,
        o.properties || '{}'
      ]);
      const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ontology-export-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
    addToast(`已导出 ${selectedObjs.length} 个节点`, 'success');
  }, [objects, addToast]);

  /** 复制选中节点到剪贴板 */
  const handleCopyToClipboard = useCallback((nodeIds: number[]) => {
    const selectedObjs = objects.filter((o: any) => nodeIds.includes(o.id));
    const text = JSON.stringify(selectedObjs, null, 2);
    navigator.clipboard.writeText(text);
    addToast(`已复制 ${selectedObjs.length} 个节点到剪贴板`, 'success');
  }, [objects, addToast]);

  /** 批量删除节点 */
  const handleBatchDelete = useCallback(async (nodeIds: number[]) => {
    pushToHistory(nodePositions);
    for (const nodeId of nodeIds) {
      await deleteObject(nodeId);
    }
    setSelectedNodeIds(new Set());
    addToast(`已删除 ${nodeIds.length} 个节点`, 'success');
  }, [deleteObject, pushToHistory, nodePositions, addToast]);

  // ── 连线属性编辑回调函数 (MECE v3.0) ───────────────────────
  /** 打开连线属性编辑对话框 */
  const handleOpenEdgePropertyDialog = useCallback((edgeId: string) => {
    const link = links.find((l: any) => l.id === Number(edgeId));
    if (!link) return;

    const linkType = linkTypes.find((t: any) => t.id === link.link_type_id);
    
    setEditingEdgeProperties({
      id: edgeId,
      label: linkType?.name || '关联',
      weight: link.weight || 0.5,
      color: '#64748b',
      animated: false,
      linkTypeId: link.link_type_id,
    });
    setShowEdgePropertyDialog(true);
  }, [links, linkTypes]);

  /** 保存连线属性 */
  const handleSaveEdgeProperties = useCallback(async (edgeId: string, updates: EdgePropertyUpdates) => {
    const link = links.find((l: any) => l.id === Number(edgeId));
    if (!link) return;

    // 如果更新了连线类型，需要删除旧连线并创建新连线
    if (updates.linkTypeId && updates.linkTypeId !== link.link_type_id) {
      await deleteLink(Number(edgeId));
      await createLink(
        updates.linkTypeId,
        link.source_object_id,
        link.target_object_id,
        updates.weight ?? link.weight ?? 0.5
      );
    }
    // TODO: 其他属性更新（标签、颜色、动画等）需要扩展 store
    
    addToast('连线属性已保存', 'success');
    setShowEdgePropertyDialog(false);
    setEditingEdgeProperties(null);
  }, [links, deleteLink, createLink, addToast]);

  /** 删除连线 */
  const handleDeleteEdge = useCallback(async (edgeId: string) => {
    await deleteLink(Number(edgeId));
    addToast('连线已删除', 'success');
  }, [deleteLink, addToast]);

  // ── 历史面板回调函数 (MECE v3.0) ─────────────────────────────
  /** 跳转到指定历史 */
  const handleJumpToHistory = useCallback((index: number) => {
    if (index < 0 || index >= historyEntries.length) return;
    setHistoryIndex(index);
    // TODO: 实现历史状态恢复
  }, [historyEntries]);

  /** 清空历史记录 */
  const handleClearHistory = useCallback(() => {
    setHistoryEntries([]);
    setHistoryIndex(-1);
  }, []);

  /** 添加历史记录 */
  const addHistoryEntry = useCallback((description: string, type: HistoryEntry['type']) => {
    const entry: HistoryEntry = {
      id: `history-${Date.now()}`,
      description,
      timestamp: Date.now(),
      nodeCount: objects.length,
      edgeCount: links.length,
      type,
      canUndo: true,
    };
    setHistoryEntries(prev => [...prev, entry]);
    setHistoryIndex(prev => prev + 1);
  }, [objects.length, links.length]);

  // Line drawing (connecting nodes)
  const [connectingSourceId, setConnectingSourceId] = useState<number | null>(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedNodeId, setHighlightedNodeId] = useState<number | null>(null);

  // Modals
  const [showCreateNode, setShowCreateNode] = useState(false);
  const [createNodeClickPos, setCreateNodeClickPos] = useState<Position>({ x: 400, y: 300 });
  const [newNodeName, setNewNodeName] = useState('');
  const [newNodeTypeId, setNewNodeTypeId] = useState<number>(0);

  const [showCreateLink, setShowCreateLink] = useState(false);
  const [selectedLinkTypeId, setSelectedLinkTypeId] = useState<number>(0);
  const [linkWeight, setLinkWeight] = useState(0.5);

  const [showEditNode, setShowEditNode] = useState(false);
  const [editNodeName, setEditNodeName] = useState('');
  const [editNodeTypeId, setEditNodeTypeId] = useState<number>(0);

  const canvasRef = useRef<HTMLDivElement>(null);

  // Dynamic path tracing computation for upstream/downstream highlights
  const activePathNodesAndLinks = useMemo(() => {
    const targetId = selectedNodeId ?? hoveredNodeId;
    if (targetId === null) return null;

    const upstreamNodes = new Set<number>([targetId]);
    const downstreamNodes = new Set<number>([targetId]);
    const upstreamLinks = new Set<number>();
    const downstreamLinks = new Set<number>();

    // Tracing Upstream relations (BFS)
    const upQueue = [targetId];
    while (upQueue.length > 0) {
      const curr = upQueue.shift()!;
      links.forEach((link: any) => {
        if (link.target_object_id === curr && !upstreamNodes.has(link.source_object_id)) {
          upstreamNodes.add(link.source_object_id);
          upstreamLinks.add(link.id);
          upQueue.push(link.source_object_id);
        }
      });
    }

    // Tracing Downstream relations (BFS)
    const downQueue = [targetId];
    while (downQueue.length > 0) {
      const curr = downQueue.shift()!;
      links.forEach((link: any) => {
        if (link.source_object_id === curr && !downstreamNodes.has(link.target_object_id)) {
          downstreamNodes.add(link.target_object_id);
          downstreamLinks.add(link.id);
          downQueue.push(link.target_object_id);
        }
      });
    }

    return {
      upstreamNodes,
      downstreamNodes,
      upstreamLinks,
      downstreamLinks,
      targetId
    };
  }, [hoveredNodeId, selectedNodeId, links]);

  const [isInitialLayoutDone, setIsInitialLayoutDone] = useState<boolean>(false);
  // Graph membership key — reset auto-layout suppression when objects/links change.
  const autoLayoutGraphKeyRef = useRef<string>('');
  // After the user drags (or manually aligns), stop auto-relayout so we don't fight them.
  const suppressAutoLayoutRef = useRef(false);
  // Guard against pathological re-entry if a layout engine ever returns overlapping coords.
  const autoLayoutAttemptsRef = useRef(0);

  const fitReadableView = useCallback(() => {
    // MECE重构：调整缩放范围以匹配新的三级缩放模式
    // 最小缩放0.3确保超紧凑模式下仍可查看全貌
    reactFlowInstance.fitView({ padding: 0.22, minZoom: 0.3, maxZoom: 1.5, duration: 300 });
  }, [reactFlowInstance]);

  // Fit only when positions are already usable (no pending auto-relayout).
  useEffect(() => {
    if (isInitialLayoutDone || objects.length === 0 || nodes.length === 0) return;
    const objectIds = objects.map((obj: any) => Number(obj.id)).filter((id: number) => Number.isFinite(id));
    if (canvasPositionsNeedRelayout(objectIds, nodePositions, expandedNodeIds, lockedNodeIds)) {
      return;
    }
    const timer = setTimeout(() => {
      fitReadableView();
      setIsInitialLayoutDone(true);
    }, 240);
    return () => clearTimeout(timer);
  }, [objects, nodes, nodePositions, expandedNodeIds, lockedNodeIds, isInitialLayoutDone, fitReadableView]);

  useEffect(() => {
    if (!isInitialLayoutDone) return;
    const timer = window.setTimeout(fitReadableView, 180);
    return () => window.clearTimeout(timer);
  }, [ontologyState.drawerOpen, isInitialLayoutDone, fitReadableView]);

  // Search node focus handler
  const handleSearchFocus = (nodeId: number) => {
    setSelectedNodeId(nodeId);
    setHighlightedNodeId(nodeId);
    const nodeX = nodePositions[nodeId]?.x;
    const nodeY = nodePositions[nodeId]?.y;
    if (nodeX !== undefined && nodeY !== undefined && !isNaN(nodeX) && !isNaN(nodeY)) {
      reactFlowInstance.setCenter(nodeX, nodeY, { zoom: 1, duration: 400 });
    }
    setIsSidebarOpen(true);
    setTimeout(() => setHighlightedNodeId(null), 2000);
  };

  const handleLockNodeToggle = useCallback((nodeId: number) => {
    toggleLockNode(nodeId);
  }, [toggleLockNode]);

  // CRUD Trigger: Save Node
  const handleSaveNewNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNodeName.trim()) return;

    try {
      await createObject(newNodeName.trim(), newNodeTypeId);
      
      setTimeout(() => {
        store.state.objects.forEach((obj: any) => {
          if (obj.name === newNodeName.trim() && obj.object_type_id === newNodeTypeId) {
            saveNodePosition(obj.id, createNodeClickPos);
          }
        });
      }, 300);

      setShowCreateNode(false);
      addToast(`节点 "${newNodeName.trim()}" 已创建`, 'success');
    } catch (err: any) {
      addToast(`创建失败: ${err.message}`, 'error');
    }
  };

  // CRUD Trigger: Save Link
  const handleSaveNewLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (connectingSourceId === null || selectedNodeId === null) return;

    try {
      await createLink(selectedLinkTypeId, connectingSourceId, selectedNodeId, linkWeight);
      setShowCreateLink(false);
      setConnectingSourceId(null);
      addToast('关系连接已建立', 'success');
    } catch (err: any) {
      addToast(`创建关系失败: ${err.message}`, 'error');
    }
  };

  // CRUD Trigger: Delete Node
  const handleDeleteNode = async (nodeId: number) => {
    const ok = await confirm({
      title: '删除实体',
      message: '确定要删除该实体以及关联的全部连线吗？',
      variant: 'danger',
      confirmText: '删除',
    });
    if (ok) {
      try {
        await deleteObject(nodeId);
        setSelectedNodeId(null);
        setIsSidebarOpen(false);
        addToast('实体已删除', 'success');
      } catch (err: any) {
        addToast(`删除失败: ${err.message}`, 'error');
      }
    }
  };

  // CRUD Trigger: Edit Node Name / Type
  const handleOpenEditNode = (node: any) => {
    if (node) {
      setSelectedNodeId(node.id);
      setEditNodeName(node.name);
      setEditNodeTypeId(node.object_type_id);
      setShowEditNode(true);
    }
  };

  const handleSaveEditNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNodeId || !editNodeName.trim()) return;

    try {
      const node = objects.find((o: any) => o.id === selectedNodeId);
      await updateObject(selectedNodeId, editNodeName.trim(), editNodeTypeId, node?.properties || '{}');
      setShowEditNode(false);
      addToast(`节点 "${editNodeName.trim()}" 已保存`, 'success');
    } catch (err: any) {
      addToast(`更新失败: ${err.message}`, 'error');
    }
  };

  const handleAutoAlign = useCallback((customNodesep?: number, customRanksep?: number, customMode?: OntologyLayoutMode) => {
    suppressAutoLayoutRef.current = true;
    pushToHistory(nodePositions);
    const ns = customNodesep ?? nodesep;
    const rs = customRanksep ?? ranksep;
    const mode = customMode ?? layoutMode;
    const layoutEdges = links.map((link: any) => ({
      id: String(link.id),
      source: String(link.source_object_id),
      target: String(link.target_object_id),
    }));
    const { nodes: layoutedNodes } = getLayoutedElements(nodes, layoutEdges, mode, ns, rs);
    const updated = { ...nodePositions };
    layoutedNodes.forEach((node) => {
      updated[Number(node.id)] = node.position;
    });
    // Treat manual 排版微调 as the session's initial layout so remount won't force again.
    const objectIds = objects.map((obj: any) => Number(obj.id)).filter((id: number) => Number.isFinite(id));
    const graphKey = `${objectIds.slice().sort((a, b) => a - b).join(',')}|${links.map((l: any) => `${l.id}`).sort().join(',')}`;
    canvasForcedLayoutKeys.add(graphKey);
    setLayoutMode(mode);
    updateCanvasPositions(updated);
    window.setTimeout(() => reactFlowInstance.fitView({ padding: 0.24, duration: 320 }), 80);
  }, [nodes, links, objects, nodePositions, nodesep, ranksep, layoutMode, updateCanvasPositions, pushToHistory, reactFlowInstance]);

  const handleFitView = useCallback(() => {
    // MECE重构：调整缩放范围以匹配新的三级缩放模式
    reactFlowInstance.fitView({ padding: 0.22, minZoom: 0.3, maxZoom: 1.5, duration: 300 });
  }, [reactFlowInstance]);

  const handleResetZoom = useCallback(() => {
    reactFlowInstance.setViewport({ x: 100, y: 100, zoom: 0.9 }, { duration: 300 });
  }, [reactFlowInstance]);

  const handleForceResetLayout = useCallback(() => {
    suppressAutoLayoutRef.current = true;
    pushToHistory(nodePositions);
    const mockNodes = objects.map((obj: any) => ({
      id: String(obj.id),
      position: { x: 100, y: 100 },
      data: {
        isExpanded: expandedNodeIds.has(obj.id)
      }
    }));
    const mockEdges = links.map((link: any) => ({
      id: String(link.id),
      source: String(link.source_object_id),
      target: String(link.target_object_id)
    }));

    const { nodes: layoutedNodes } = getLayoutedElements(mockNodes, mockEdges, layoutMode, nodesep, ranksep);
    const updated: SavedPositions = {};
    layoutedNodes.forEach((node) => {
      updated[Number(node.id)] = node.position;
    });
    updateCanvasPositions(updated);

    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.35, duration: 400 });
    }, 100);
  }, [objects, links, nodePositions, layoutMode, nodesep, ranksep, expandedNodeIds, updateCanvasPositions, pushToHistory, reactFlowInstance]);

  // Synchronize store → ReactFlow nodes. On first entry (or when stored coords still
  // collide), run the exact same getLayoutedElements path as「排版微调」and setNodes
  // in the same layout pass — writing only to the store was racing the sync effect
  // and left D3-crowded positions on screen.
  useLayoutEffect(() => {
    if (objects.length === 0) {
      setNodes([]);
      return;
    }

    const objectIds = objects.map((obj: any) => Number(obj.id)).filter((id: number) => Number.isFinite(id));
    const graphKey = `${objectIds.slice().sort((a, b) => a - b).join(',')}|${links.map((l: any) => `${l.id}`).sort().join(',')}`;
    if (autoLayoutGraphKeyRef.current !== graphKey) {
      autoLayoutGraphKeyRef.current = graphKey;
      suppressAutoLayoutRef.current = false;
      autoLayoutAttemptsRef.current = 0;
    }

    let rfNodes: Node[] = objects.map((obj: any) => {
      const pos = nodePositions[obj.id] || { x: 100, y: 100 };
      const isExpanded = expandedNodeIds.has(obj.id);
      const incomingCount = links.filter((l: any) => l.target_object_id === obj.id).length;
      const outgoingCount = links.filter((l: any) => l.source_object_id === obj.id).length;
      const dims = getOntologyNodeDimensions({
        id: String(obj.id),
        data: { obj, isExpanded },
      } as any, NODE_DEFAULT_WIDTH, NODE_COLLAPSED_HEIGHT);

      return {
        id: String(obj.id),
        type: 'ontology',
        position: pos,
        width: dims.width,
        height: dims.height,
        data: {
          obj,
          type: objectTypes.find((t: any) => t.id === obj.object_type_id),
          isLocked: lockedNodeIds.has(obj.id),
          isHighlighted: highlightedNodeId === obj.id,
          isExpanded,
          nodeWidth: dims.width,
          nodeHeight: dims.height,
          incomingCount,
          outgoingCount,
          activePathNodesAndLinks,
          isFocusMode,
          isReadOnly,
          onLockToggle: handleLockNodeToggle,
          onEditOpen: handleOpenEditNode,
          onDelete: handleDeleteNode,
          onExpandToggle: (nodeId: number) => {
            setExpandedNodeIds(prev => {
              const next = new Set(prev);
              if (next.has(nodeId)) next.delete(nodeId);
              else next.add(nodeId);
              return next;
            });
          },
        },
      };
    });

    const alreadyForced = canvasForcedLayoutKeys.has(graphKey);
    const needsRepair = canvasPositionsNeedRelayout(
      objectIds,
      nodePositions,
      expandedNodeIds,
      lockedNodeIds,
    );
    const shouldLayout =
      !suppressAutoLayoutRef.current
      && autoLayoutAttemptsRef.current < 5
      && (!alreadyForced || needsRepair);

    if (shouldLayout) {
      const layoutEdges = links.map((link: any) => ({
        id: String(link.id),
        source: String(link.source_object_id),
        target: String(link.target_object_id),
      }));
      // Identical engine call to handleAutoAlign /「排版微调」.
      const { nodes: layoutedNodes } = getLayoutedElements(
        rfNodes,
        layoutEdges,
        layoutMode,
        nodesep,
        ranksep,
      );
      const updated: SavedPositions = { ...nodePositions };
      const byId = new Map(layoutedNodes.map((n) => [n.id, n]));
      rfNodes = rfNodes.map((node) => {
        const layouted = byId.get(node.id);
        if (!layouted) return node;
        updated[Number(node.id)] = layouted.position;
        return { ...node, position: layouted.position };
      });
      canvasForcedLayoutKeys.add(graphKey);
      autoLayoutAttemptsRef.current += 1;
      updateCanvasPositions(updated);
      window.setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.24, minZoom: 0.3, maxZoom: 1.5, duration: 320 });
        setIsInitialLayoutDone(true);
      }, 80);
    }

    setNodes(rfNodes);
  }, [objects, links, nodePositions, objectTypes, lockedNodeIds, highlightedNodeId, expandedNodeIds, activePathNodesAndLinks, isFocusMode, isReadOnly, handleLockNodeToggle, setNodes, layoutMode, nodesep, ranksep, updateCanvasPositions, reactFlowInstance]);

  // Deterministic lane offsets keep parallel orthogonal paths from stacking.
  const linkOffsets = useMemo(() => {
    const counts: { [key: string]: number } = {};
    const offsets: { [key: number]: number } = {};
    const sortedLinks = [...links].sort((a, b) => a.id - b.id);
    
    sortedLinks.forEach((link: any) => {
      const s = Math.min(link.source_object_id, link.target_object_id);
      const t = Math.max(link.source_object_id, link.target_object_id);
      const key = `${s}-${t}`;
      
      if (counts[key] === undefined) {
        counts[key] = 0;
      }
      
      const index = counts[key];
      counts[key]++;
      
      let offset = 0;
      if (index === 0) {
        offset = 0;
      } else if (index === 1) {
        offset = parallelOffset;
      } else if (index === 2) {
        offset = -parallelOffset;
      } else {
        const sign = index % 2 === 1 ? 1 : -1;
        const multiplier = Math.floor((index + 1) / 2);
        offset = sign * multiplier * parallelOffset;
      }
      offsets[link.id] = offset;
    });
    
    return offsets;
  }, [links, parallelOffset]);

  // Synchronize store links to ReactFlow edges
  useEffect(() => {
    const rfEdges = links.map((link: any) => {
      const isSelected = selectedNodeId === link.source_object_id || selectedNodeId === link.target_object_id;
      const isUpstreamLink = activePathNodesAndLinks?.upstreamLinks.has(link.id);
      const isDownstreamLink = activePathNodesAndLinks?.downstreamLinks.has(link.id);
      const linkName = linkTypes.find((t: any) => t.id === link.link_type_id)?.name || '关联';
      const isActive = isUpstreamLink || isDownstreamLink;
      const laneOffset = linkOffsets[link.id] ?? 0;
      const baseEdge: Edge = {
        id: String(link.id),
        source: String(link.source_object_id),
        target: String(link.target_object_id),
      };
      const route = getOrthogonalRouteForEdge(nodes, baseEdge, layoutMode, laneOffset);
      let sourceHandleId = route ? sideToHandleId(route.sourceSide, 'source') : undefined;
      let targetHandleId = route ? sideToHandleId(route.targetSide, 'target') : undefined;
      if (!sourceHandleId || !targetHandleId) {
        const sNode = nodes.find(n => n.id === String(link.source_object_id));
        const tNode = nodes.find(n => n.id === String(link.target_object_id));
        const sPos = sNode?.position || { x: 0, y: 0 };
        const tPos = tNode?.position || { x: 0, y: 0 };
        if (tPos.x >= sPos.x) {
          sourceHandleId = sourceHandleId || 'right-source';
          targetHandleId = targetHandleId || 'left-target';
        } else {
          sourceHandleId = sourceHandleId || 'left-source';
          targetHandleId = targetHandleId || 'right-target';
        }
      }

      const strokeColor = isActive
        ? (isUpstreamLink ? '#10b981' : '#06b6d4')
        : (isSelected ? '#06b6d4' : '#64748b');

      return {
        ...baseEdge,
        sourceHandle: sourceHandleId,
        targetHandle: targetHandleId,
        label: linkName,
        animated: animateEdges && (isSelected || isActive),
        type: 'ontology',
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color: strokeColor,
        },
        data: {
          routing: edgeRoutingMode,
          routePoints: route?.points,
          laneOffset,
          isActive,
          isUpstreamLink,
        }
      };
    }).filter(e => {
      if (isFocusMode && activePathNodesAndLinks) {
        return activePathNodesAndLinks.upstreamLinks.has(Number(e.id)) || activePathNodesAndLinks.downstreamLinks.has(Number(e.id));
      }
      return true;
    });
    setEdges(rfEdges);
  }, [links, nodes, layoutMode, selectedNodeId, activePathNodesAndLinks, linkTypes, isFocusMode, linkOffsets, animateEdges, setEdges, edgeRoutingMode]);

  // Interactive Incremental Local Relayout on Node Dragging
  const onNodeDrag = useCallback((event: any, node: any) => {
    suppressAutoLayoutRef.current = true;
    const nodeId = Number(node.id);
    const isFixedDrag = Boolean(event.altKey || event.shiftKey || lockedNodeIds.has(nodeId));

    if (isFixedDrag) {
      updateCanvasPosition(nodeId, node.position.x, node.position.y);
      return;
    }

    const updatedNodes = applyIncrementalLocalLayout(
      nodes,
      edges,
      node.id,
      node.position,
      false,
    );

    const updatedPositions: SavedPositions = {};
    updatedNodes.forEach((n) => {
      updatedPositions[Number(n.id)] = n.position;
    });

    updateCanvasPositions(updatedPositions);
  }, [nodes, edges, lockedNodeIds, updateCanvasPosition, updateCanvasPositions]);

  // Dragging node ends: save position and local neighbor updates back to store with grid snap
  const onNodeDragStop = useCallback((event: any, node: any) => {
    const nodeId = Number(node.id);
    const isFixedDrag = Boolean(event.altKey || event.shiftKey || lockedNodeIds.has(nodeId));

    pushToHistory(nodePositions);
    const grid = snapToGrid ? GRID_SIZE : 1;

    if (isFixedDrag) {
      updateCanvasPosition(
        nodeId,
        Math.round(node.position.x / grid) * grid,
        Math.round(node.position.y / grid) * grid,
      );
    } else {
      const updatedNodes = applyIncrementalLocalLayout(
        nodes,
        edges,
        node.id,
        node.position,
        false,
      );
      const updatedPositions: SavedPositions = {};
      updatedNodes.forEach((n) => {
        updatedPositions[Number(n.id)] = {
          x: Math.round(n.position.x / grid) * grid,
          y: Math.round(n.position.y / grid) * grid,
        };
      });
      updateCanvasPositions(updatedPositions);
    }
  }, [lockedNodeIds, nodePositions, snapToGrid, pushToHistory, updateCanvasPosition, updateCanvasPositions, nodes, edges]);

  // Click edge to delete
  const onEdgeClick = useCallback(async (event: React.MouseEvent, edge: Edge) => {
    event.stopPropagation();
    const ok = await confirm({
      title: '删除关系连接',
      message: '确定删除该关系连接吗？',
      variant: 'warning',
      confirmText: '删除',
    });
    if (ok) {
      deleteLink(Number(edge.id));
      addToast('关系连接已删除', 'success');
    }
  }, [deleteLink, confirm, addToast]);

  // Double click pane: create object node
  const handlePaneDoubleClick = useCallback((e: React.MouseEvent) => {
    const reactFlowBounds = canvasRef.current?.getBoundingClientRect();
    if (!reactFlowBounds || !reactFlowInstance) return;

    const position = reactFlowInstance.project({
      x: e.clientX - reactFlowBounds.left,
      y: e.clientY - reactFlowBounds.top,
    });

    setCreateNodeClickPos(position);
    setNewNodeName('');
    setNewNodeTypeId(objectTypes[0]?.id || 1);
    setShowCreateNode(true);
  }, [reactFlowInstance, objectTypes]);

  // Connect handles: open create link dialog
  const onConnect = useCallback((connection: Connection) => {
    const sourceId = Number(connection.source);
    const targetId = Number(connection.target);
    if (sourceId === targetId) return;

    setSelectedLinkTypeId(linkTypes[0]?.id || 1);
    setLinkWeight(0.5);
    setConnectingSourceId(sourceId);
    setSelectedNodeId(targetId);
    setShowCreateLink(true);
  }, [linkTypes]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    const nodeId = Number(node.id);
    setSelectedNodeId(nodeId);
    setIsSidebarOpen(true);
    const target = objects.find((object: any) => object.id === nodeId);
    if (target) onInspect?.('object', target);
  }, [objects, onInspect]);

  const onPaneClick = useCallback((event: React.MouseEvent) => {
    setSelectedNodeId(null);
    setIsSidebarOpen(false);
    setSelectedNodeIds(new Set());
    setSelectedEdgeIds(new Set());
  }, []);

  const onNodeMouseEnter = useCallback((event: React.MouseEvent, node: Node) => {
    setHoveredNodeId(Number(node.id));
  }, []);

  const onNodeMouseLeave = useCallback(() => {
    setHoveredNodeId(null);
  }, []);


  const handleExport = useCallback(async (format: 'png' | 'jpeg' | 'svg') => {
    try {
      addToast(`正在导出 ${format.toUpperCase()} 图像...`, 'info');
      const graphNodes = reactFlowInstance.getNodes().map((node) => ({
        ...node,
        width: undefined,
        height: undefined,
        positionAbsolute: undefined,
      }));
      const graphEdges: Edge[] = links.map((link: any) => ({
        id: String(link.id),
        source: String(link.source_object_id),
        target: String(link.target_object_id),
        label: linkTypes.find((type: any) => type.id === link.link_type_id)?.name || '关联',
        data: { laneOffset: linkOffsets[link.id] ?? 0 },
      }));
      await downloadOntologyGraph(graphNodes, graphEdges, layoutMode, format);
      addToast(`${format.toUpperCase()} 图像已成功导出`, 'success');
    } catch (err: any) {
      addToast(`导出失败: ${err.message}`, 'error');
    }
  }, [reactFlowInstance, links, linkTypes, linkOffsets, layoutMode, addToast]);

  const handleOpenImportModal = useCallback(async () => {
    setImporting(true);
    try {
      const tablesList = await duckDBService.getTables();
      const filtered = tablesList.filter((t) => 
        !t.startsWith('_sys_') && 
        !['life_object', 'life_object_type', 'life_link', 'life_link_type', 'life_action', 'life_introspection', 'life_insight'].includes(t)
      );
      setDbTables(filtered);
      setShowImportModal(true);
    } catch (e: any) {
      addToast(`无法读取物理数据表: ${e.message}`, 'error');
    } finally {
      setImporting(false);
    }
  }, [addToast]);

  const handleImportSelectTable = useCallback(async (tableName: string) => {
    setShowImportModal(false);
    addToast(`正在导入物理表 ${tableName}...`, 'info');
    try {
      const columns = await duckDBService.getTableSchema(tableName);
      
      const typeName = tableName.toUpperCase();
      let typeId = objectTypes.find((t: any) => t.name.toUpperCase() === typeName)?.id;
      
      if (!typeId) {
        const newTypeId = Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 100);
        await store.createObjectType(typeName, `从 DuckDB 物理数据表 ${tableName} 导入的实体类型`);
        await store.loadData();
        typeId = newTypeId;
      }

      const propsObj: Record<string, any> = {};
      columns.forEach((col: any) => {
        const isNum = col.type.includes('INT') || col.type.includes('DOUBLE') || col.type.includes('FLOAT') || col.type.includes('DECIMAL');
        const isBool = col.type.includes('BOOL');
        propsObj[col.name] = isNum ? 0 : isBool ? false : "";
      });

      const latestTypes = store.state.objectTypes;
      const createdType = latestTypes.find((t: any) => t.name.toUpperCase() === typeName);
      const finalTypeId = createdType ? createdType.id : typeId;

      await store.createObject(tableName, finalTypeId, JSON.stringify(propsObj));
      await store.loadData();

      setTimeout(() => {
        handleAutoAlign();
      }, 100);
      addToast(`物理表 "${tableName}" 已成功导入为实体节点（${columns.length} 个列属性）`, 'success');
    } catch (err: any) {
      addToast(`导入物理表失败: ${err.message}`, 'error');
    }
  }, [objectTypes, store, handleAutoAlign, addToast]);

  const handleBatchReverseEngineeringFromDB = useCallback(async () => {
    setImporting(true);
    try {
      const tablesList = await duckDBService.getTables();
      const userTables = tablesList.filter((t) => 
        !t.startsWith('_sys_') && 
        !['life_object', 'life_object_type', 'life_link', 'life_link_type', 'life_action', 'life_introspection', 'life_insight'].includes(t)
      );

      if (userTables.length === 0) {
        addToast('DuckDB 中暂无物理表，请先创建或导入数据后再执行反向工程', 'warning');
        return;
      }

      setReverseProgress({ current: 0, total: userTables.length });
      let importedCount = 0;
      for (const tableName of userTables) {
        const columns = await duckDBService.getTableSchema(tableName);
        const typeName = tableName.toUpperCase();
        let typeId = objectTypes.find((t: any) => t.name.toUpperCase() === typeName)?.id;
        
        if (!typeId) {
          const newTypeId = Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 100);
          await store.createObjectType(typeName, `从 DuckDB 数据库自动反向工程推导的实体类型 ${tableName}`);
          await store.loadData();
          typeId = newTypeId;
        }

        const propsObj: Record<string, any> = {};
        columns.forEach((col: any) => {
          const isNum = col.type.includes('INT') || col.type.includes('DOUBLE') || col.type.includes('FLOAT') || col.type.includes('DECIMAL');
          const isBool = col.type.includes('BOOL');
          propsObj[col.name] = isNum ? 0 : isBool ? false : "";
        });

        const latestTypes = store.state.objectTypes;
        const createdType = latestTypes.find((t: any) => t.name.toUpperCase() === typeName);
        const finalTypeId = createdType ? createdType.id : typeId;

        await store.createObject(tableName, finalTypeId, JSON.stringify(propsObj));
        importedCount++;
        setReverseProgress({ current: importedCount, total: userTables.length });
      }

      await store.loadData();
      setTimeout(() => {
        handleAutoAlign();
      }, 150);

      addToast(
        `反向工程完成！已还原 ${importedCount} 张物理表`,
        'success',
        '本体对象已按 MECE 拓扑自动排列布局',
      );
    } catch (e: any) {
      addToast(`反向工程推导失败: ${e.message}`, 'error');
    } finally {
      setImporting(false);
      setReverseProgress(null);
    }
  }, [objectTypes, store, handleAutoAlign, addToast]);

  const handleGenerateDDL = useCallback(() => {
    if (!onInsert) {
      addToast('未连接 SQL 编辑器，无法插入 DDL 语句', 'warning');
      return;
    }
    
    let sql = `-- =========================================================\n`;
    sql += `-- Generated from Ontology Entity Canvas\n`;
    sql += `-- Created At: ${new Date().toISOString()}\n`;
    sql += `-- =========================================================\n\n`;

    objectTypes.forEach((t: any) => {
      const typeObjects = objects.filter((o: any) => o.object_type_id === t.id);
      
      const columns = new Map<string, string>();
      columns.set("id", "INTEGER PRIMARY KEY");
      
      typeObjects.forEach((obj: any) => {
        try {
          const parsed = typeof obj.properties === 'string' ? JSON.parse(obj.properties || '{}') : (obj.properties || {});
          Object.entries(parsed).forEach(([k, val]) => {
            if (k === 'id') return;
            let typeStr = "VARCHAR";
            if (typeof val === 'number') {
              typeStr = Number.isInteger(val) ? "INTEGER" : "DOUBLE";
            } else if (typeof val === 'boolean') {
              typeStr = "BOOLEAN";
            }
            columns.set(k, typeStr);
          });
        } catch (e) {}
      });

      sql += `-- Table representing entity type: ${t.name} (${t.description || ''})\n`;
      sql += `CREATE TABLE IF NOT EXISTS ${t.name.toLowerCase()} (\n`;
      const colDefs = Array.from(columns.entries()).map(([name, type]) => `  ${name} ${type}`);
      sql += colDefs.join(",\n");
      sql += `\n);\n\n`;

      if (typeObjects.length > 0) {
        sql += `-- Seed data for ${t.name}\n`;
        typeObjects.forEach((obj: any) => {
          try {
            const parsed = typeof obj.properties === 'string' ? JSON.parse(obj.properties || '{}') : (obj.properties || {});
            const keys = ["id", "name", ...Object.keys(parsed).filter(k => k !== 'id')];
            
            const values = keys.map((k) => {
              if (k === 'id') return obj.id;
              if (k === 'name') return `'${obj.name.replace(/'/g, "''")}'`;
              const val = parsed[k];
              if (val === null || val === undefined) return "NULL";
              if (typeof val === 'boolean') return val ? "TRUE" : "FALSE";
              if (typeof val === 'number') return val;
              return `'${String(val).replace(/'/g, "''")}'`;
            });

            sql += `INSERT INTO ${t.name.toLowerCase()} (${keys.join(', ')}) VALUES (${values.join(', ')});\n`;
          } catch (e) {
            sql += `INSERT INTO ${t.name.toLowerCase()} (id, name) VALUES (${obj.id}, '${obj.name.replace(/'/g, "''")}');\n`;
          }
        });
        sql += `\n`;
      }
    });

    onInsert(sql);
    addToast('SQL DDL 与 Seed 脚本已成功插入 SQL 编辑器', 'success', `共生成 ${objectTypes.length} 张表定义`);
  }, [objects, objectTypes, onInsert, addToast]);

  const handleCompileCTE = useCallback(() => {
    const res = compileOntologyToCTE(nodes, edges);
    if (res.errors.length > 0) {
      addToast('CTE 编译遇到错误', 'error', res.errors.join(' | '));
      return;
    }
    if (onInsert) {
      onInsert(res.sql);
      addToast(`CTE 视图 SQL 已发送至编辑器`, 'success', `包含 ${res.cteCount} 个拓扑 CTE 节点`);
    } else {
      navigator.clipboard.writeText(res.sql);
      addToast(`CTE 视图 SQL 已复制到剪贴板`, 'success', `包含 ${res.cteCount} 个拓扑 CTE 节点`);
    }
  }, [nodes, edges, onInsert, addToast]);

  // ── Empty State Guidance ────────────────────────────────────────
  const isCanvasEmpty = objects.length === 0;

  // Custom metadata renderer
  const renderProperties = (propertiesStr: string) => {
    try {
      const parsed = typeof propertiesStr === 'string' ? JSON.parse(propertiesStr || '{}') : (propertiesStr || {});
      const entries = Object.entries(parsed);
      if (entries.length === 0) return <div className="text-[10px] text-monokai-comment italic">空特性数据</div>;
      return (
        <div className="space-y-1.5 font-mono text-[10px] text-monokai-fg-muted">
          {entries.map(([k, val]) => (
            <div key={k} className="flex justify-between border-b border-monokai-border/40 py-1">
              <span className="text-monokai-comment font-bold shrink-0">{k}:</span>
              <span className="text-monokai-fg-muted text-right truncate max-w-[65%]" title={String(val)}>{String(val)}</span>
            </div>
          ))}
        </div>
      );
    } catch (err) {
      return <div className="text-[10px] text-monokai-pink">特性 JSON 解析错误</div>;
    }
  };

  // Filtered dropdown suggestions
  const filteredObjects = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return objects.filter((obj: any) =>
      obj.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, objects]);

  return (
    <div className="flex flex-col h-full w-full bg-monokai-bg select-none text-monokai-fg relative overflow-hidden font-sans">
      <DarkStyle />

      <OntologyCanvasHeader
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filteredObjects={filteredObjects}
        objectTypes={objectTypes}
        handleSearchFocus={handleSearchFocus}
        zoom={rfZoom}
        setZoom={(newZoomVal) => {
          const targetZoom = typeof newZoomVal === 'function' ? newZoomVal(rfZoom) : newZoomVal;
          if (isNaN(targetZoom) || !isFinite(targetZoom)) return;
          const clampedZoom = Math.max(0.1, Math.min(4.0, targetZoom));
          reactFlowInstance.zoomTo(clampedZoom, { duration: 250 });
        }}
        handleFitView={handleFitView}
        handleResetZoom={handleResetZoom}
        handleUndo={handleUndo}
        handleRedo={handleRedo}
        undoDisabled={undoStackRef.current.length === 0}
        redoDisabled={redoStackRef.current.length === 0}
        isFocusMode={isFocusMode}
        setIsFocusMode={setIsFocusMode}
        handleLockAll={handleLockAll}
        handleUnlockAll={handleUnlockAll}
        handleAutoAlign={handleAutoAlign}
        onExport={handleExport}
        onGenerateDDL={handleGenerateDDL}
        onImportTable={handleOpenImportModal}
        onCompileCTE={handleCompileCTE}
        onReverseInferSchema={handleBatchReverseEngineeringFromDB}
        onSavePreset={() => addToast('预设保存功能开发中', 'info')}
        onShowShortcuts={() => setShowShortcutsHelp(true)}
        edgeRoutingMode={edgeRoutingMode}
        setEdgeRoutingMode={setEdgeRoutingMode}
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid(v => !v)}
        showMiniMap={showMiniMap}
        onToggleMiniMap={() => setShowMiniMap(v => !v)}
        isReadOnly={isReadOnly}
        onToggleReadOnly={() => setIsReadOnly(v => !v)}
      />

      <div ref={canvasRef} className="flex-1 relative outline-none focus:outline-none">
        {/* Empty Canvas Guidance */}
        {isCanvasEmpty && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="flex flex-col items-center gap-6 max-w-lg text-center px-6 pointer-events-auto">
              {/* Central icon ring */}
              <div className="relative">
                <div className="w-16 h-16 rounded-full border border-monokai-border flex items-center justify-center bg-monokai-surface">
                  <svg className="w-8 h-8 text-monokai-comment" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <circle cx="12" cy="12" r="3" />
                    <circle cx="4" cy="6" r="2" />
                    <circle cx="20" cy="6" r="2" />
                    <circle cx="4" cy="18" r="2" />
                    <circle cx="20" cy="18" r="2" />
                    <line x1="6" y1="6" x2="10" y2="11" />
                    <line x1="18" y1="6" x2="14" y2="11" />
                    <line x1="6" y1="18" x2="10" y2="13" />
                    <line x1="18" y1="18" x2="14" y2="13" />
                  </svg>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-monokai-fg mb-1">开始构建本体知识图谱</h3>
                <p className="text-xs text-monokai-comment leading-relaxed">
                  本体画布用于可视化建模实体与关系，生成 DuckDB 数据库结构与 CTE 分析流水线。
                </p>
              </div>

              {/* Action Cards */}
              <div className="grid grid-cols-3 gap-3 w-full">
                <button
                  type="button"
                  onClick={() => { setNewNodeName(''); setNewNodeTypeId(objectTypes[0]?.id || 1); setCreateNodeClickPos({ x: 400, y: 300 }); setShowCreateNode(true); }}
                  className="flex flex-col items-center gap-2 p-3 rounded-md border border-monokai-border bg-monokai-surface hover:bg-monokai-sidebar hover:border-monokai-fg-muted/40 transition-all group"
                >
                  <div className="w-7 h-7 rounded bg-monokai-blue/10 flex items-center justify-center text-monokai-blue group-hover:bg-monokai-blue/20 transition-colors">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-medium text-monokai-fg">新建节点</div>
                    <div className="text-[10px] text-monokai-comment mt-0.5">双击画布创建</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleBatchReverseEngineeringFromDB}
                  disabled={importing}
                  className="flex flex-col items-center gap-2 p-3 rounded-md border border-monokai-border bg-monokai-surface hover:bg-monokai-sidebar hover:border-monokai-fg-muted/40 transition-all group disabled:opacity-50"
                >
                  <div className="w-7 h-7 rounded bg-monokai-orange/10 flex items-center justify-center text-monokai-orange group-hover:bg-monokai-orange/20 transition-colors">
                    <GitCommit className="w-4 h-4" />
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-medium text-monokai-fg">反向工程</div>
                    <div className="text-[10px] text-monokai-comment mt-0.5">从数据库还原</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleOpenImportModal}
                  disabled={importing}
                  className="flex flex-col items-center gap-2 p-3 rounded-md border border-monokai-border bg-monokai-surface hover:bg-monokai-sidebar hover:border-monokai-fg-muted/40 transition-all group disabled:opacity-50"
                >
                  <div className="w-7 h-7 rounded bg-monokai-green/10 flex items-center justify-center text-monokai-green group-hover:bg-monokai-green/20 transition-colors">
                    <Database className="w-4 h-4" />
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-medium text-monokai-fg">导入物理表</div>
                    <div className="text-[10px] text-monokai-comment mt-0.5">选择单张表</div>
                  </div>
                </button>
              </div>

              <p className="text-[11px] text-monokai-comment">
                提示：右上角「操作」菜单可访问 MECE 排版、CTE 编译等功能
              </p>
              
              {/* 快捷键提示 */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2 border-t border-monokai-border/50">
                <div className="flex items-center gap-1.5 text-[10px] text-monokai-comment">
                  <kbd className="px-1.5 py-0.5 bg-monokai-surface rounded border border-monokai-border font-mono">N</kbd>
                  <span>新建节点</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-monokai-comment">
                  <kbd className="px-1.5 py-0.5 bg-monokai-surface rounded border border-monokai-border font-mono">双击</kbd>
                  <span>快速创建</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-monokai-comment">
                  <kbd className="px-1.5 py-0.5 bg-monokai-surface rounded border border-monokai-border font-mono">?</kbd>
                  <span>快捷键帮助</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-monokai-comment">
                  <kbd className="px-1.5 py-0.5 bg-monokai-surface rounded border border-monokai-border font-mono">右键</kbd>
                  <span>上下文菜单</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reverse Engineering Progress Indicator */}
        {reverseProgress && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-4 py-2.5 rounded-md border border-monokai-border bg-monokai-surface/95 shadow-xl">
            <div className="w-4 h-4 border-2 border-monokai-orange/30 border-t-monokai-orange rounded-full animate-spin shrink-0" />
            <div className="text-xs text-monokai-fg font-medium">
              反向工程进行中...
              <span className="text-monokai-orange font-bold ml-1">{reverseProgress.current}/{reverseProgress.total}</span>
              <span className="text-monokai-comment ml-1">张表</span>
            </div>
            <div className="w-24 h-1 bg-monokai-bg rounded-full overflow-hidden">
              <div
                className="h-full bg-monokai-orange transition-all duration-300 rounded-full"
                style={{ width: `${(reverseProgress.current / reverseProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onEdgeClick={onEdgeClick}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          onNodeContextMenu={handleNodeContextMenu}
          onEdgeContextMenu={handleEdgeContextMenu}
          onPaneContextMenu={handlePaneContextMenu}
          onSelectionChange={onSelectionChange}
          selectionMode={SelectionMode.Partial}
          onDoubleClick={!isReadOnly && enableDbClickCreate ? handlePaneDoubleClick : undefined}
          nodesDraggable={!isReadOnly}
          nodesConnectable={!isReadOnly}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onlyRenderVisibleElements={true}
          minZoom={0.1}
          maxZoom={4.0}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          className="bg-[#0c0d12]"
        >
          {showGrid && <Background color="#27272a" gap={16} size={1} />}
          {showMiniMap && (
            <MiniMap
              nodeColor={(node) => {
                const typeId = node.data?.obj?.object_type_id;
                if (typeId === undefined) return '#3e3f4c';
                const style = getTypeStyles(typeId);
                if (style.text.includes('cyan')) return '#06b6d4';
                if (style.text.includes('green')) return '#10b981';
                if (style.text.includes('pink')) return '#f43f5e';
                return '#14b8a6';
              }}
              maskColor="rgba(0, 0, 0, 0.6)"
              style={{ right: 10, bottom: 10 }}
            />
          )}
          <Controls showInteractive={false} style={{ left: 10, bottom: 10 }} />
        </ReactFlow>

        {/* Dynamic Spacing Control Panel */}
        <div className="absolute left-3 top-3 z-10 flex flex-col items-start gap-2">
          <button
            onClick={() => setShowSpacingPanel(!showSpacingPanel)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-semibold shadow-lg backdrop-blur-md transition-all select-none ${
              showSpacingPanel
                ? 'bg-monokai-surface border-monokai-accent text-monokai-fg'
                : 'bg-monokai-sidebar border-monokai-border text-monokai-comment hover:text-monokai-fg-muted hover:border-monokai-border-strong'
            }`}
            title="手动调整画布排版设置"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>排版微调</span>
          </button>

          {showSpacingPanel && (
            <div className="flex flex-col gap-3.5 p-4 rounded bg-monokai-bg/95 border border-monokai-border shadow-2xl backdrop-blur-md w-72 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between border-b border-monokai-border-subtle pb-2">
                <span className="text-xs font-bold text-monokai-fg flex items-center gap-1.5">
                  <Settings className="w-3.5 h-3.5 text-monokai-accent" />
                  排版微调面板
                </span>
                <span
                  onClick={() => {
                    setNodesep(100);
                    setRanksep(200);
                    setLayoutMode('orthogonal');
                    setParallelOffset(40);
                    setSnapToGrid(true);
                    setShowGrid(true);
                    setShowMiniMap(true);
                    setAnimateEdges(true);
                    setIsFocusMode(false);
                    setEnableDbClickCreate(true);
                    setEdgeRoutingMode('orthogonal');
                    setIsReadOnly(false);
                    handleAutoAlign(100, 200, 'orthogonal');
                  }}
                  className="text-[10px] text-monokai-comment hover:text-monokai-fg-muted cursor-pointer transition-all"
                >
                  恢复默认
                </span>
              </div>

              {/* Layout algorithms */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-monokai-comment">布局方式</span>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  {ONTOLOGY_LAYOUTS.map((layout) => (
                    <button
                      key={layout.id}
                      type="button"
                      data-testid={`ontology-layout-${layout.id}`}
                      title={layout.description}
                      onClick={() => handleAutoAlign(nodesep, ranksep, layout.id)}
                      className={`py-1.5 px-2 rounded border transition-all text-left ${
                        layoutMode === layout.id
                          ? 'bg-monokai-surface border-monokai-accent text-monokai-fg font-bold'
                          : 'bg-monokai-sidebar/40 border-monokai-border text-monokai-comment hover:text-monokai-fg-muted'
                      }`}
                    >
                      <span className="block">{layout.label}布局</span>
                      <span className="block mt-0.5 text-[8px] font-normal opacity-70 truncate">{layout.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Horizontal Spacing */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-monokai-comment">层级间距</span>
                  <span className="text-monokai-blue font-mono font-bold">{ranksep}px</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="500"
                  step="20"
                  value={ranksep}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setRanksep(val);
                    handleAutoAlign(nodesep, val);
                  }}
                  className="w-full h-1 bg-monokai-surface rounded-lg appearance-none cursor-pointer accent-monokai-blue focus:outline-none"
                />
              </div>

              {/* Vertical Spacing */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-monokai-comment">同层节点间距</span>
                  <span className="text-monokai-green font-mono font-bold">{nodesep}px</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="300"
                  step="10"
                  value={nodesep}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setNodesep(val);
                    handleAutoAlign(val, ranksep);
                  }}
                  className="w-full h-1 bg-monokai-surface rounded-lg appearance-none cursor-pointer accent-monokai-green focus:outline-none"
                />
              </div>

              {/* Parallel orthogonal lane offset */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-monokai-comment">并行线间距</span>
                  <span className="text-monokai-orange font-mono font-bold">{parallelOffset}px</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="70"
                  step="5"
                  value={parallelOffset}
                  onChange={(e) => {
                    setParallelOffset(Number(e.target.value));
                  }}
                  className="w-full h-1 bg-monokai-surface rounded-lg appearance-none cursor-pointer accent-monokai-orange focus:outline-none"
                />
              </div>

              {/* Edge Routing Style */}
              <div className="flex flex-col gap-1.5 border-t border-monokai-border-subtle pt-2">
                <span className="text-xs text-monokai-comment">连线风格 (Reactor 直线 / 正交 / 贝塞尔)</span>
                <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setEdgeRoutingMode('straight')}
                    className={`py-1.5 px-2 rounded border transition-all text-center ${
                      edgeRoutingMode === 'straight'
                        ? 'bg-monokai-surface border-monokai-cyan text-monokai-cyan font-bold shadow-sm'
                        : 'bg-monokai-sidebar/40 border-monokai-border text-monokai-comment hover:text-monokai-fg-muted'
                    }`}
                  >
                    极简直线
                  </button>
                  <button
                    type="button"
                    onClick={() => setEdgeRoutingMode('orthogonal')}
                    className={`py-1.5 px-2 rounded border transition-all text-center ${
                      edgeRoutingMode === 'orthogonal'
                        ? 'bg-monokai-surface border-monokai-green text-monokai-green font-bold shadow-sm'
                        : 'bg-monokai-sidebar/40 border-monokai-border text-monokai-comment hover:text-monokai-fg-muted'
                    }`}
                  >
                    圆角正交
                  </button>
                  <button
                    type="button"
                    onClick={() => setEdgeRoutingMode('bezier')}
                    className={`py-1.5 px-2 rounded border transition-all text-center ${
                      edgeRoutingMode === 'bezier'
                        ? 'bg-monokai-surface border-monokai-yellow text-monokai-yellow font-bold shadow-sm'
                        : 'bg-monokai-sidebar/40 border-monokai-border text-monokai-comment hover:text-monokai-fg-muted'
                    }`}
                  >
                    平滑贝塞尔
                  </button>
                </div>
              </div>

              {/* Interactive Toggles Header */}
              <div className="text-[10px] font-bold text-monokai-comment border-t border-monokai-border-subtle pt-2.5 mb-0.5 uppercase tracking-wider">
                画布交互与状态
              </div>

              {/* Focus Mode */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-monokai-comment" title="开启后仅显示选中节点及其关联的前后代节点">聚焦模式 (Focus)</span>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isFocusMode}
                    onChange={(e) => setIsFocusMode(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-7 h-4 bg-monokai-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-monokai-comment after:border-monokai-border-strong after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-monokai-green peer-checked:after:bg-monokai-sidebar peer-checked:after:border-transparent"></div>
                </label>
              </div>

              {/* Grid Snapping */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-monokai-comment">网格吸附对齐</span>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={snapToGrid}
                    onChange={(e) => setSnapToGrid(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-7 h-4 bg-monokai-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-monokai-comment after:border-monokai-border-strong after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-monokai-green peer-checked:after:bg-monokai-sidebar peer-checked:after:border-transparent"></div>
                </label>
              </div>

              {/* Background dots grid */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-monokai-comment">背景网格点阵</span>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showGrid}
                    onChange={(e) => setShowGrid(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-7 h-4 bg-monokai-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-monokai-comment after:border-monokai-border-strong after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-monokai-green peer-checked:after:bg-monokai-sidebar peer-checked:after:border-transparent"></div>
                </label>
              </div>

              {/* MiniMap toggle */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-monokai-comment">鹰眼小地图</span>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showMiniMap}
                    onChange={(e) => setShowMiniMap(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-7 h-4 bg-monokai-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-monokai-comment after:border-monokai-border-strong after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-monokai-green peer-checked:after:bg-monokai-sidebar peer-checked:after:border-transparent"></div>
                </label>
              </div>

              {/* Edge animations toggle */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-monokai-comment">连线流向动画</span>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={animateEdges}
                    onChange={(e) => setAnimateEdges(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-7 h-4 bg-monokai-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-monokai-comment after:border-monokai-border-strong after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-monokai-green peer-checked:after:bg-monokai-sidebar peer-checked:after:border-transparent"></div>
                </label>
              </div>

              {/* Double-Click Create Node */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-monokai-comment">双击新建节点</span>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={enableDbClickCreate}
                    onChange={(e) => setEnableDbClickCreate(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-7 h-4 bg-monokai-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-monokai-comment after:border-monokai-border-strong after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-monokai-green peer-checked:after:bg-monokai-sidebar peer-checked:after:border-transparent"></div>
                </label>
              </div>

              {/* Read Only toggle */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-monokai-comment font-semibold text-amber-500">只读画布模式</span>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isReadOnly}
                    onChange={(e) => setIsReadOnly(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-7 h-4 bg-monokai-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-monokai-comment after:border-monokai-border-strong after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-monokai-orange peer-checked:after:bg-monokai-sidebar peer-checked:after:border-transparent"></div>
                </label>
              </div>

              {/* Force Reset Layout button */}
              <button
                disabled={isReadOnly}
                onClick={handleForceResetLayout}
                className="mt-1 w-full py-1.5 rounded bg-monokai-surface border border-monokai-border text-amber-400 hover:bg-amber-500/10 active:scale-98 disabled:opacity-30 disabled:pointer-events-none transition-all text-xs font-medium flex items-center justify-center gap-1.5"
                title="清除所有拖拽的偏移坐标，重新计算Dagre自动布局"
              >
                <span>重置全局网格排版</span>
              </button>

              <div className="text-[9px] text-monokai-comment border-t border-monokai-border-subtle pt-2 leading-relaxed">
                * 拖动滑块或切换参数将实时响应重算排版，不影响手动锁定的节点。
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Local Right Details Panel */}
      {isSidebarOpen && selectedNodeId !== null && (
        (() => {
          const node = objects.find((o: any) => o.id === selectedNodeId);
          if (!node) return null;
          const type = objectTypes.find((t: any) => t.id === node.object_type_id);
          const typeStyle = getTypeStyles(node.object_type_id);
          const connectedRelations = links.filter((l: any) => l.source_object_id === node.id || l.target_object_id === node.id);
          const isNodeLocked = lockedNodeIds.has(node.id);

          return (
            <div className="absolute top-0 right-0 bottom-0 w-80 border-l border-monokai-border bg-monokai-bg/95 backdrop-blur-md flex flex-col h-full z-20 animate-in slide-in-from-right duration-250 shadow-2xl">
              {/* 头部 */}
              <div className="px-4 py-4 border-b border-monokai-border flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Database className={`w-4 h-4 shrink-0 ${typeStyle.text}`} />
                  <span className="text-xs font-bold text-monokai-fg truncate max-w-[160px]" title={node.name}>{node.name}</span>
                  {isNodeLocked && (
                    <span title="已锁定">
                      <Lock className="w-3 h-3 text-monokai-yellow shrink-0" />
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {/* 复制快捷按钮 */}
                  <button
                    onClick={() => {
                      setSelectedNodeIds(new Set([String(node.id)]));
                      handleCopySelected();
                    }}
                    className="p-1.5 rounded-lg text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface transition-colors"
                    title="复制节点 (Ctrl+C)"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleFocusNode(String(node.id))}
                    className="p-1.5 rounded-lg text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface transition-colors"
                    title="聚焦到节点 (F)"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                  <IconButton
                    icon={X}
                    label="关闭属性抽屉"
                    size="sm"
                    onClick={() => setIsSidebarOpen(false)}
                />
              </div>
            </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-5 font-sans">
                <div className="space-y-1">
                  <span className="text-xs text-monokai-comment font-bold uppercase tracking-wider">实体类型</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs font-mono font-bold tracking-wider px-2 py-0.5 rounded-lg ${typeStyle.bg} ${typeStyle.text}`}>
                      {type?.name || '未知'}
                    </span>
                    {type?.description && (
                      <span className="text-xs text-monokai-comment italic truncate" title={type.description}>
                        {type.description}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs text-monokai-comment font-bold uppercase tracking-wider">节点操作</span>
                  <div className="grid grid-cols-3 gap-1.5 mt-1">
                    <button
                      onClick={() => handleOpenEditNode(node)}
                      className="flex flex-col items-center justify-center gap-1 p-2 text-xs bg-monokai-sidebar hover:bg-monokai-surface text-monokai-fg-muted font-bold rounded-lg transition-colors border border-monokai-border cursor-pointer"
                      title="编辑节点属性设置"
                    >
                      <Settings className="w-4 h-4 text-monokai-blue" />
                      <span>编辑设置</span>
                    </button>
                    <button
                      onClick={() => toggleLockNode(node.id)}
                      className={`flex flex-col items-center justify-center gap-1 p-2 text-xs font-bold rounded-lg transition-colors border cursor-pointer ${lockedNodeIds.has(node.id) ? 'bg-amber-500/10 border-monokai-border-subtle text-amber-400 hover:bg-amber-500/20' : 'bg-monokai-sidebar border-monokai-border hover:bg-monokai-surface text-monokai-comment hover:text-monokai-fg-muted'}`}
                      title={lockedNodeIds.has(node.id) ? '解锁此节点' : '锁定此节点，防止在画布中被误拖拽移动'}
                    >
                      {lockedNodeIds.has(node.id) ? (
                        <>
                          <Lock className="w-4 h-4 text-amber-400" />
                          <span>已锁定</span>
                        </>
                      ) : (
                        <>
                          <Unlock className="w-4 h-4" />
                          <span>锁定节点</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteNode(node.id)}
                      className="flex flex-col items-center justify-center gap-1 p-2 text-xs bg-monokai-surface hover:bg-rose-500/10 text-monokai-comment hover:text-rose-400 font-bold rounded-lg transition-colors border border-monokai-border hover:border-rose-500/30 cursor-pointer"
                      title="从画布中删除此节点"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>删除节点</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs text-monokai-comment font-bold uppercase tracking-wider">附加属性列表</span>
                  <div className="bg-monokai-bg/40 border border-monokai-border rounded-lg p-3 select-text">
                    {renderProperties(node.properties)}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] text-monokai-comment font-bold uppercase tracking-wider">已连接的关联关系 ({connectedRelations.length})</span>
                  {connectedRelations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-4 text-center">
                      <div className="w-10 h-10 rounded-full bg-monokai-surface flex items-center justify-center mb-2">
                        <Link2 className="w-5 h-5 text-monokai-comment" />
                      </div>
                      <div className="text-[10px] text-monokai-comment italic">暂无关联关系</div>
                      <div className="text-[9px] text-monokai-comment/60 mt-1">拖拽节点锚点创建连线</div>
                    </div>
                  ) : (
                    <div className="space-y-2 mt-1">
                      {connectedRelations.map((link: any) => {
                        const isSource = link.source_object_id === node.id;
                        const relatedId = isSource ? link.target_object_id : link.source_object_id;
                        const relatedNode = objects.find((o: any) => o.id === relatedId);
                        const relationName = linkTypes.find((t: any) => t.id === link.link_type_id)?.name || '关联';

                        return (
                          <div key={link.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-monokai-border/60 bg-monokai-bg text-[10px]">
                            <div className="flex flex-col gap-0.5 truncate max-w-[80%]">
                              <span className="text-monokai-comment flex items-center gap-1">
                                {isSource ? '指向 →' : '来自 ←'}
                                <span className="font-mono text-monokai-comment font-bold">({relationName})</span>
                              </span>
                              <span className="text-monokai-fg-muted font-semibold truncate" title={relatedNode?.name || '未知节点'}>
                                {relatedNode?.name || '未知节点'}
                              </span>
                            </div>
                            <button
                              onClick={async () => {
                                const ok = await confirm({
                                  title: '断开关联关系',
                                  message: '确定断开此关联关系吗？',
                                  variant: 'warning',
                                  confirmText: '断开',
                                });
                                if (ok) {
                                  deleteLink(link.id);
                                  addToast('关联关系已断开', 'success');
                                }
                              }}
                              className="p-1 rounded-lg text-monokai-comment hover:text-monokai-pink hover:bg-monokai-pink/10 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                
                {/* 底部批量操作栏 */}
                <div className="mt-auto pt-4 border-t border-monokai-border shrink-0">
                  <div className="flex items-center justify-between text-[10px] text-monokai-comment mb-2">
                    <span>批量操作</span>
                    {selectedNodeCount > 1 && (
                      <span className="text-monokai-accent">已选 {selectedNodeCount} 个节点</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={handleSelectAll}
                      className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] bg-monokai-surface hover:bg-monokai-sidebar rounded border border-monokai-border text-monokai-comment hover:text-monokai-fg transition-colors"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>全选</span>
                    </button>
                    <button
                      onClick={() => setSelectedNodeIds(new Set())}
                      className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] bg-monokai-surface hover:bg-monokai-sidebar rounded border border-monokai-border text-monokai-comment hover:text-monokai-fg transition-colors"
                    >
                      <Square className="w-3.5 h-3.5" />
                      <span>取消选择</span>
                    </button>
                    <button
                      onClick={handleCopySelected}
                      disabled={selectedNodeCount === 0}
                      className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] bg-monokai-surface hover:bg-monokai-sidebar rounded border border-monokai-border text-monokai-comment hover:text-monokai-fg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Clipboard className="w-3.5 h-3.5" />
                      <span>复制</span>
                    </button>
                    <button
                      onClick={handleDeleteSelected}
                      disabled={selectedNodeCount === 0 || isReadOnly}
                      className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] bg-monokai-surface hover:bg-rose-500/10 rounded border border-monokai-border text-monokai-comment hover:text-rose-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Trash className="w-3.5 h-3.5" />
                      <span>删除</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()
      )}

      {/* MODAL: Create Object Node */}
      <ModalShell
        open={showCreateNode}
        onClose={() => setShowCreateNode(false)}
        title="新建实体节点"
        description="配置实体名称与所属类型，将其添加到实体画布中"
        size="md"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <ActionButton
              variant="secondary"
              onClick={() => setShowCreateNode(false)}
            >
              取消
            </ActionButton>
            <ActionButton
              variant="primary"
              onClick={handleSaveNewNode as any}
            >
              确定创建
            </ActionButton>
          </div>
        }
      >
        <form onSubmit={handleSaveNewNode} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-monokai-comment uppercase tracking-wide">节点名称</label>
            <input
              type="text"
              autoFocus
              required
              value={newNodeName}
              onChange={(e) => setNewNodeName(e.target.value)}
              placeholder="例如：主数据库 / 分析引擎"
              className="w-full bg-monokai-surface border border-monokai-border rounded-lg px-3 py-2 text-xs text-monokai-fg focus:border-monokai-accent focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-monokai-comment uppercase tracking-wide">实体类型</label>
            <select
              value={newNodeTypeId}
              onChange={(e) => setNewNodeTypeId(parseInt(e.target.value, 10))}
              className="w-full bg-monokai-surface border border-monokai-border rounded-lg px-3 py-2 text-xs text-monokai-fg focus:border-monokai-accent focus:outline-none"
            >
              {objectTypes.map((t: any) => (
                <option key={t.id} value={t.id}>{t.name} ({t.description})</option>
              ))}
            </select>
          </div>
        </form>
      </ModalShell>

      {/* MODAL: Create Link Relationship */}
      <ModalShell
        open={showCreateLink}
        onClose={() => { setShowCreateLink(false); setConnectingSourceId(null); }}
        title="建立关系连接"
        description="为所选源实体与目标实体建立拓扑连接与语义关系"
        size="md"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <ActionButton
              variant="secondary"
              onClick={() => { setShowCreateLink(false); setConnectingSourceId(null); }}
            >
              取消
            </ActionButton>
            <ActionButton
              variant="primary"
              onClick={handleSaveNewLink as any}
            >
              建立关系
            </ActionButton>
          </div>
        }
      >
        <form onSubmit={handleSaveNewLink} className="space-y-4">
          <div className="bg-monokai-surface/60 p-3 rounded-lg border border-monokai-border text-xs space-y-1 text-monokai-comment">
            <div>源实体: <strong className="text-monokai-fg font-medium">{objects.find((o: any) => o.id === connectingSourceId)?.name}</strong></div>
            <div>目标实体: <strong className="text-monokai-fg font-medium">{objects.find((o: any) => o.id === selectedNodeId)?.name}</strong></div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-monokai-comment uppercase tracking-wide">关系类型</label>
            <select
              value={selectedLinkTypeId}
              onChange={(e) => setSelectedLinkTypeId(parseInt(e.target.value, 10))}
              className="w-full bg-monokai-surface border border-monokai-border rounded-lg px-3 py-2 text-xs text-monokai-fg focus:border-monokai-accent focus:outline-none"
            >
              {linkTypes.map((t: any) => (
                <option key={t.id} value={t.id}>{t.name} ({t.description})</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-monokai-comment uppercase tracking-wide">权重参数</label>
              <span className="text-xs font-mono text-monokai-green font-bold">{linkWeight}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.1"
              value={linkWeight}
              onChange={(e) => setLinkWeight(parseFloat(e.target.value))}
              className="w-full accent-monokai-accent bg-monokai-bg rounded-lg appearance-none h-1.5 cursor-pointer"
            />
          </div>
        </form>
      </ModalShell>

      {/* MODAL: Edit Node */}
      <ModalShell
        open={showEditNode}
        onClose={() => setShowEditNode(false)}
        title="编辑实体节点属性"
        description="更新实体节点名称与其所属对象类型"
        size="md"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <ActionButton
              variant="secondary"
              onClick={() => setShowEditNode(false)}
            >
              取消
            </ActionButton>
            <ActionButton
              variant="primary"
              onClick={handleSaveEditNode as any}
            >
              保存修改
            </ActionButton>
          </div>
        }
      >
        <form onSubmit={handleSaveEditNode} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-monokai-comment uppercase tracking-wide">实体名称</label>
            <input
              type="text"
              required
              value={editNodeName}
              onChange={(e) => setEditNodeName(e.target.value)}
              className="w-full bg-monokai-surface border border-monokai-border rounded-lg px-3 py-2 text-xs text-monokai-fg focus:border-monokai-accent focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-monokai-comment uppercase tracking-wide">实体类型</label>
            <select
              value={editNodeTypeId}
              onChange={(e) => setEditNodeTypeId(parseInt(e.target.value, 10))}
              className="w-full bg-monokai-surface border border-monokai-border rounded-lg px-3 py-2 text-xs text-monokai-fg focus:border-monokai-accent focus:outline-none"
            >
              {objectTypes.map((t: any) => (
                <option key={t.id} value={t.id}>{t.name} ({t.description})</option>
              ))}
            </select>
          </div>
        </form>
      </ModalShell>

      {/* MODAL: Import DuckDB Physical Table */}
      <ModalShell
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="导入物理表为实体节点"
        description="选择底层 DuckDB 真实物理表，自动推导列属性并实例化为画布节点"
        size="md"
        footer={
          <div className="flex justify-end w-full">
            <ActionButton
              variant="secondary"
              onClick={() => setShowImportModal(false)}
            >
              关闭
            </ActionButton>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="max-h-56 overflow-y-auto custom-scrollbar border border-monokai-border rounded-lg bg-monokai-bg p-1.5 space-y-1">
            {dbTables.length === 0 ? (
              <div className="text-xs text-monokai-comment text-center py-6">无可用物理数据表</div>
            ) : (
              dbTables.map((tbl) => (
                <button
                  key={tbl}
                  onClick={() => handleImportSelectTable(tbl)}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs text-monokai-fg hover:bg-monokai-surface hover:text-white transition-colors flex items-center justify-between group cursor-pointer"
                >
                  <span className="font-mono">{tbl}</span>
                  <span className="text-xs text-monokai-green opacity-0 group-hover:opacity-100 transition-opacity font-medium">导入 →</span>
                </button>
              ))
            )}
          </div>
        </div>
      </ModalShell>

      {/* Global Toast Portal */}
      <ToastPortal toasts={toasts} onRemove={removeToast} />

      {/* 快捷键帮助对话框 */}
      <ShortcutsHelpDialog
        isOpen={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
        isReadOnly={isReadOnly}
        hasSelection={selectedNodeCount > 0}
        hasClipboard={hasClipboardData}
      />

      {/* ── 上下文菜单 ─────────────────────────────────────────── */}
      {(() => {
        // 计算当前选中的单个节点是否具有同类型节点或相邻节点
        const singleNodeId = selectedNodeIds.size === 1 ? Number(Array.from(selectedNodeIds)[0]) : (selectedNodeId ? Number(selectedNodeId) : null);
        const activeNode = singleNodeId ? objects.find((o: any) => o.id === singleNodeId) : null;
        const dynamicHasSameTypeNodes = activeNode 
          ? objects.some((o: any) => o.id !== singleNodeId && o.object_type_id === activeNode.object_type_id)
          : false;
        const dynamicHasAdjacentNodes = singleNodeId
          ? links.some((l: any) => l.source_object_id === singleNodeId || l.target_object_id === singleNodeId)
          : false;

        return (
          <CanvasContextMenu
            menu={contextMenu}
        onClose={handleCloseContextMenu}
        // Node actions
        onEditNode={(nodeId) => {
          const nodeObj = objects.find((o: any) => o.id === Number(nodeId));
          if (nodeObj) handleOpenEditNode(nodeObj);
        }}
        onDeleteNode={(nodeId) => handleDeleteNode(Number(nodeId))}
        onCopyNode={(nodeId) => {
          setSelectedNodeIds(new Set([nodeId]));
          handleCopySelected();
        }}
        onDuplicateNode={handleDuplicateNode}
        onAddEdgeFromNode={(nodeId) => {
          setConnectingSourceId(Number(nodeId));
          setSelectedLinkTypeId(linkTypes[0]?.id || 1);
          setLinkWeight(0.5);
          setShowCreateLink(true);
        }}
        onFocusNode={handleFocusNode}
        onLockNode={(nodeId) => toggleLockNodeStore(Number(nodeId))}
        onUnlockNode={(nodeId) => toggleLockNodeStore(Number(nodeId))}
        onToggleExpand={handleToggleExpand}
        onNavigatePrev={(nodeId) => {
          // 导航到上一个节点（如果有选择的话）
          if (selectedNodeIds.size > 0) {
            const nodeIds = Array.from(selectedNodeIds);
            const currentIndex = nodeIds.indexOf(nodeId);
            if (currentIndex > 0) {
              setSelectedNodeId(Number(nodeIds[currentIndex - 1]));
              handleFocusNode(nodeIds[currentIndex - 1]);
            }
          }
        }}
        onNavigateNext={(nodeId) => {
          // 导航到下一个节点
          if (selectedNodeIds.size > 0) {
            const nodeIds = Array.from(selectedNodeIds);
            const currentIndex = nodeIds.indexOf(nodeId);
            if (currentIndex < nodeIds.length - 1) {
              setSelectedNodeId(Number(nodeIds[currentIndex + 1]));
              handleFocusNode(nodeIds[currentIndex + 1]);
            }
          }
        }}
        // Edge actions
        onEditEdge={(edgeId) => handleOpenEdgePropertyDialog(edgeId)}
        onDeleteEdge={(edgeId) => deleteLink(Number(edgeId))}
        onReverseEdge={handleReverseEdge}
        onHighlightPath={handleHighlightPath}
        onSelectConnectedNodes={(edgeId) => {
          const link = links.find((l: any) => l.id === Number(edgeId));
          if (link) {
            setSelectedNodeIds(new Set([String(link.source_object_id), String(link.target_object_id)]));
          }
        }}
        // Canvas actions
        onCreateNodeAtPos={handleCreateNodeAtPos}
        onCreateLinkAtPos={(x, y) => {
          // 画布空白处创建连线需要先选择一个源节点
          addToast('请先选择连线源节点', 'info');
        }}
        onAutoLayout={handleAutoAlign}
        onFitView={handleFitView}
        onSelectAll={handleSelectAll}
        onSelectInverse={handleSelectInverse}
        onCopySelected={handleCopySelected}
        onCutSelected={handleCutSelected}
        onPaste={handlePaste}
        onDeleteSelected={handleDeleteSelected}
        // Batch actions
        onSelectSameType={(nodeId) => {
          const nodeObj = objects.find((o: any) => o.id === Number(nodeId));
          if (nodeObj) {
            const sameTypeNodes = objects.filter((o: any) => o.object_type_id === nodeObj.object_type_id);
            setSelectedNodeIds(new Set(sameTypeNodes.map((o: any) => String(o.id))));
            addToast(`已选择 ${sameTypeNodes.length} 个同类节点`, 'info');
          }
        }}
        onSelectAdjacent={(nodeId) => {
          const nodeIdNum = Number(nodeId);
          const adjacentIds = new Set<string>();
          adjacentIds.add(String(nodeIdNum));
          links.forEach((link: any) => {
            if (link.source_object_id === nodeIdNum) adjacentIds.add(String(link.target_object_id));
            if (link.target_object_id === nodeIdNum) adjacentIds.add(String(link.source_object_id));
          });
          setSelectedNodeIds(adjacentIds);
          addToast(`已选择 ${adjacentIds.size} 个相邻节点`, 'info');
        }}
        // Zoom actions
        onZoomIn={() => reactFlowInstance.zoomIn({ duration: 200 })}
        onZoomOut={() => reactFlowInstance.zoomOut({ duration: 200 })}
        onResetZoom={handleResetZoom}
        // State
        hasClipboardData={hasClipboardData}
        isReadOnly={isReadOnly}
        selectedNodeCount={selectedNodeCount}
        selectedEdgeCount={selectedEdgeCount}
        hasSameTypeNodes={dynamicHasSameTypeNodes}
        hasAdjacentNodes={dynamicHasAdjacentNodes}
        totalNodeCount={objects.length}
        currentNodeIndex={selectedNodeIds.size === 1 ? Array.from(selectedNodeIds).indexOf(String(selectedNodeId)) : -1}
      />
    );
  })()}
</div>
  );
};

export const OntologyCanvas: React.FC<OntologyCanvasInnerProps> = (props) => (
  <ReactFlowProvider>
    <OntologyCanvasInner {...props} />
  </ReactFlowProvider>
);

export default OntologyCanvas;
