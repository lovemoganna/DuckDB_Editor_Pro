import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
} from 'reactflow';
import 'reactflow/dist/style.css';

import {
  Sparkles, Database, Plus, Trash2, ArrowRight,
  Check, AlertTriangle, Search, RefreshCw, ZoomIn, ZoomOut, Maximize2,
  X, Link2, Info, Move, Settings, Zap, BookOpen, GitCommit,
  ChevronDown, ChevronUp, Lock, Unlock, RotateCcw, RotateCw
} from 'lucide-react';

import { useOntologyStore } from '../../hooks/useOntologyStore';
import {
  Position,
  SavedPositions,
  GRID_SIZE,
  TYPE_COLORS,
  getTypeStyles,
  resolveCollisions,
  OntologyCanvasHeader,
  OntologyNode,
  OntologyEdge,
  getLayoutedElements
} from './OntologyCanvas/index';

// Custom style injection for dark theme controls
const DarkStyle = () => (
  <style>{`
    .react-flow__controls {
      background: rgba(9, 9, 11, 0.9) !important;
      border: 1px solid rgba(39, 39, 42, 0.8) !important;
      border-radius: 4px !important;
      overflow: hidden;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5) !important;
    }
    .react-flow__controls-button {
      background: transparent !important;
      border-bottom: 1px solid rgba(39, 39, 42, 0.8) !important;
      fill: #a1a1aa !important;
      color: #a1a1aa !important;
      width: 26px !important;
      height: 26px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
    }
    .react-flow__controls-button:hover {
      background: rgba(39, 39, 42, 0.6) !important;
      fill: #ffffff !important;
      color: #ffffff !important;
    }
    .react-flow__minimap {
      background: #12131a !important;
      border: 1px solid rgba(39, 39, 42, 0.8) !important;
      border-radius: 4px !important;
    }
    .react-flow__edge-path {
      transition: stroke 0.25s ease, stroke-width 0.2s ease;
    }
    .react-flow__edge.selected .react-flow__edge-path {
      stroke: #06b6d4 !important;
      stroke-width: 2.5px !important;
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
}

const OntologyCanvasInner: React.FC<OntologyCanvasInnerProps> = ({ onInsert, ontologyState }) => {
  const store = useOntologyStore();
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

  // Dynamic Auto-Align Layout configuration settings
  const [nodesep, setNodesep] = useState<number>(130); // Default vertical spacing set to 130px
  const [ranksep, setRanksep] = useState<number>(200);
  const [layoutDir, setLayoutDir] = useState<string>('LR'); // Layout direction: 'LR' (Left-to-Right) or 'TB' (Top-to-Bottom)
  const [parallelOffset, setParallelOffset] = useState<number>(35); // Curve offset for parallel edges
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true); // Snap node dragging coordinates to grid snip size
  const [showSpacingPanel, setShowSpacingPanel] = useState<boolean>(false);

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

  // Load and construct node positions if missing, applying Dagre auto layout on first load
  useEffect(() => {
    if (objects.length === 0) return;

    const updated = { ...nodePositions };
    let missingCount = 0;
    objects.forEach((obj: any) => {
      if (!updated[obj.id] || isNaN(updated[obj.id].x) || isNaN(updated[obj.id].y)) {
        // Spiral fallback coordinate mapping to give temporary coordinates
        const angle = missingCount * 0.6;
        const radius = 120 + Math.floor(missingCount / 3) * 60;
        updated[obj.id] = {
          x: 450 + Math.cos(angle) * radius,
          y: 300 + Math.sin(angle) * radius
        };
        missingCount++;
      }
    });

    if (missingCount > 0) {
      const isInitialLoad = Object.keys(nodePositions).length === 0;

      if (isInitialLoad) {
        const mockNodes = objects.map((obj: any) => ({
          id: String(obj.id),
          position: updated[obj.id],
          data: {
            isExpanded: expandedNodeIds.has(obj.id)
          }
        }));
        const mockEdges = links.map((link: any) => ({
          id: String(link.id),
          source: String(link.source_object_id),
          target: String(link.target_object_id)
        }));

        const { nodes: layoutedNodes } = getLayoutedElements(mockNodes, mockEdges, 'LR', nodesep, ranksep);
        layoutedNodes.forEach((node) => {
          updated[Number(node.id)] = node.position;
        });
      }

      updateCanvasPositions(updated);
    }
  }, [objects, links, nodePositions, updateCanvasPositions, expandedNodeIds, nodesep, ranksep]);

  // Automatically center view on mount/first render once nodes are ready
  useEffect(() => {
    if (objects.length > 0 && nodes.length > 0 && !isInitialLayoutDone) {
      const timer = setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.35, duration: 400 });
        setIsInitialLayoutDone(true);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [objects, nodes, isInitialLayoutDone, reactFlowInstance]);

  // Save specific node position helper
  const saveNodePosition = useCallback((id: number, pos: Position) => {
    const updated = { ...nodePositions, [id]: pos };
    const resolved = resolveCollisions(id, updated, expandedNodeIds);
    updateCanvasPositions(resolved);
  }, [nodePositions, expandedNodeIds, updateCanvasPositions]);

  // Search node focus handler
  const handleSearchFocus = (nodeId: number) => {
    setSelectedNodeId(nodeId);
    setHighlightedNodeId(nodeId);
    reactFlowInstance.setCenter(
      nodePositions[nodeId]?.x || 0,
      nodePositions[nodeId]?.y || 0,
      { zoom: 1, duration: 400 }
    );
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
    } catch (err: any) {
      alert(`创建失败: ${err.message}`);
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
    } catch (err: any) {
      alert(`创建关系失败: ${err.message}`);
    }
  };

  // CRUD Trigger: Delete Node
  const handleDeleteNode = async (nodeId: number) => {
    if (window.confirm('确定要删除该实体以及关联的全部连线吗？')) {
      try {
        await deleteObject(nodeId);
        setSelectedNodeId(null);
        setIsSidebarOpen(false);
      } catch (err: any) {
        alert(`删除失败: ${err.message}`);
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
    } catch (err: any) {
      alert(`更新失败: ${err.message}`);
    }
  };



  const handleAutoAlign = useCallback((customNodesep?: number, customRanksep?: number, customDir?: string) => {
    pushToHistory(nodePositions);
    const ns = customNodesep ?? nodesep;
    const rs = customRanksep ?? ranksep;
    const dir = customDir ?? layoutDir;
    const { nodes: layoutedNodes } = getLayoutedElements(nodes, edges, dir, ns, rs);
    const updated = { ...nodePositions };
    layoutedNodes.forEach((node) => {
      updated[Number(node.id)] = node.position;
    });
    updateCanvasPositions(updated);
  }, [nodes, edges, nodePositions, nodesep, ranksep, layoutDir, updateCanvasPositions, pushToHistory]);

  const handleFitView = useCallback(() => {
    reactFlowInstance.fitView({ duration: 300 });
  }, [reactFlowInstance]);

  const handleResetZoom = useCallback(() => {
    reactFlowInstance.setViewport({ x: 100, y: 100, zoom: 0.9 }, { duration: 300 });
  }, [reactFlowInstance]);

  // Synchronize store nodes to ReactFlow nodes
  useEffect(() => {
    const rfNodes = objects.map((obj: any) => {
      const pos = nodePositions[obj.id] || { x: 100, y: 100 };
      return {
        id: String(obj.id),
        type: 'ontology',
        position: pos,
        data: {
          obj,
          type: objectTypes.find((t: any) => t.id === obj.object_type_id),
          isLocked: lockedNodeIds.has(obj.id),
          isHighlighted: highlightedNodeId === obj.id,
          isExpanded: expandedNodeIds.has(obj.id),
          activePathNodesAndLinks,
          isFocusMode,
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
          }
        }
      };
    });
    setNodes(rfNodes);
  }, [objects, nodePositions, objectTypes, lockedNodeIds, highlightedNodeId, expandedNodeIds, activePathNodesAndLinks, isFocusMode, handleLockNodeToggle, setNodes]);

  // Calculate parallel link curvature offsets to prevent overlapping paths
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
      const curveOffset = linkOffsets[link.id] ?? 0;

      return {
        id: String(link.id),
        source: String(link.source_object_id),
        target: String(link.target_object_id),
        label: linkName,
        animated: isSelected || isActive,
        type: 'ontology', // Custom premium curved edge
        data: {
          curveOffset,
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
  }, [links, selectedNodeId, activePathNodesAndLinks, linkTypes, isFocusMode, linkOffsets, setEdges]);

  // Dragging node ends: save position back to store
  const onNodeDragStop = useCallback((event: any, node: any) => {
    const nodeId = Number(node.id);
    if (!lockedNodeIds.has(nodeId)) {
      pushToHistory(nodePositions);
      const grid = snapToGrid ? GRID_SIZE : 1;
      saveNodePosition(nodeId, {
        x: Math.round(node.position.x / grid) * grid,
        y: Math.round(node.position.y / grid) * grid,
      });
    }
  }, [lockedNodeIds, nodePositions, snapToGrid, pushToHistory, saveNodePosition]);

  // Click edge to delete
  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.stopPropagation();
    if (window.confirm(`确定删除该关系连接吗？`)) {
      deleteLink(Number(edge.id));
    }
  }, [deleteLink]);

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
    setSelectedNodeId(Number(node.id));
    setIsSidebarOpen(true);
  }, []);

  const onPaneClick = useCallback((event: React.MouseEvent) => {
    setSelectedNodeId(null);
    setIsSidebarOpen(false);
  }, []);

  const onNodeMouseEnter = useCallback((event: React.MouseEvent, node: Node) => {
    setHoveredNodeId(Number(node.id));
  }, []);

  const onNodeMouseLeave = useCallback(() => {
    setHoveredNodeId(null);
  }, []);

  // Filtered dropdown suggestions
  const filteredObjects = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return objects.filter((obj: any) =>
      obj.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, objects]);

  // Custom metadata renderer
  const renderProperties = (propertiesStr: string) => {
    try {
      const parsed = typeof propertiesStr === 'string' ? JSON.parse(propertiesStr || '{}') : (propertiesStr || {});
      const entries = Object.entries(parsed);
      if (entries.length === 0) return <div className="text-[10px] text-zinc-600 italic">空特性数据</div>;
      return (
        <div className="space-y-1.5 font-mono text-[10px] text-zinc-300">
          {entries.map(([k, val]) => (
            <div key={k} className="flex justify-between border-b border-zinc-800/40 py-1">
              <span className="text-zinc-500 font-bold shrink-0">{k}:</span>
              <span className="text-zinc-200 text-right truncate max-w-[65%]" title={String(val)}>{String(val)}</span>
            </div>
          ))}
        </div>
      );
    } catch (err) {
      return <div className="text-[10px] text-monokai-pink">特性 JSON 解析错误</div>;
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0c0d12] select-none text-slate-300 relative overflow-hidden font-sans">
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
          reactFlowInstance.zoomTo(targetZoom, { duration: 250 });
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
      />

      <div ref={canvasRef} className="flex-1 relative outline-none focus:outline-none">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={onNodeDragStop}
          onEdgeClick={onEdgeClick}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          onDoubleClick={handlePaneDoubleClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          className="bg-[#0c0d12]"
        >
          <Background color="#27272a" gap={16} size={1} />
          <MiniMap
            nodeColor={(node) => {
              const typeId = node.data?.obj?.object_type_id;
              if (typeId === undefined) return '#3e3f4c';
              const style = getTypeStyles(typeId);
              if (style.text.includes('cyan')) return '#06b6d4';
              if (style.text.includes('green')) return '#10b981';
              if (style.text.includes('pink')) return '#f43f5e';
              return '#a855f7';
            }}
            maskColor="rgba(0, 0, 0, 0.6)"
            style={{ right: 10, bottom: 10 }}
          />
          <Controls showInteractive={false} style={{ left: 10, bottom: 10 }} />
        </ReactFlow>

        {/* Dynamic Spacing Control Panel */}
        <div className="absolute left-3 top-3 z-10 flex flex-col items-start gap-2">
          <button
            onClick={() => setShowSpacingPanel(!showSpacingPanel)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-semibold shadow-lg backdrop-blur-md transition-all select-none ${
              showSpacingPanel
                ? 'bg-monokai-blue/20 border-monokai-blue/50 text-monokai-blue'
                : 'bg-zinc-900/90 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
            }`}
            title="手动调整画布排版设置"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>排版微调</span>
          </button>

          {showSpacingPanel && (
            <div className="flex flex-col gap-3.5 p-4 rounded bg-zinc-950/95 border border-zinc-800/90 shadow-2xl backdrop-blur-md w-64 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                  <Settings className="w-3.5 h-3.5 text-monokai-yellow" />
                  排版微调面板
                </span>
                <span 
                  onClick={() => {
                    setNodesep(130);
                    setRanksep(200);
                    setLayoutDir('LR');
                    setParallelOffset(35);
                    setSnapToGrid(true);
                    handleAutoAlign(130, 200, 'LR');
                  }}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300 cursor-pointer transition-all"
                >
                  恢复默认
                </span>
              </div>

              {/* Layout Direction */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-zinc-400">排列方向</span>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <button
                    onClick={() => {
                      setLayoutDir('LR');
                      handleAutoAlign(nodesep, ranksep, 'LR');
                    }}
                    className={`py-1 rounded border transition-all ${
                      layoutDir === 'LR'
                        ? 'bg-monokai-blue/15 border-monokai-blue/40 text-monokai-blue font-bold'
                        : 'bg-zinc-900/40 border-zinc-850 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    水平排列 (L-R)
                  </button>
                  <button
                    onClick={() => {
                      setLayoutDir('TB');
                      handleAutoAlign(nodesep, ranksep, 'TB');
                    }}
                    className={`py-1 rounded border transition-all ${
                      layoutDir === 'TB'
                        ? 'bg-monokai-blue/15 border-monokai-blue/40 text-monokai-blue font-bold'
                        : 'bg-zinc-900/40 border-zinc-850 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    垂直排列 (T-B)
                  </button>
                </div>
              </div>

              {/* Horizontal Spacing */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">列间距 (水平)</span>
                  <span className="text-monokai-blue font-mono font-bold">{ranksep}px</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="350"
                  step="10"
                  value={ranksep}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setRanksep(val);
                    handleAutoAlign(nodesep, val);
                  }}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-monokai-blue focus:outline-none"
                />
              </div>

              {/* Vertical Spacing */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">行间距 (垂直)</span>
                  <span className="text-monokai-green font-mono font-bold">{nodesep}px</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="220"
                  step="5"
                  value={nodesep}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setNodesep(val);
                    handleAutoAlign(val, ranksep);
                  }}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-monokai-green focus:outline-none"
                />
              </div>

              {/* Connection Curve offset */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">连线弧度</span>
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
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-monokai-orange focus:outline-none"
                />
              </div>

              {/* Grid Snapping */}
              <div className="flex items-center justify-between border-t border-zinc-900 pt-2.5">
                <span className="text-xs text-zinc-400">网格吸附对齐</span>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={snapToGrid}
                    onChange={(e) => setSnapToGrid(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-7 h-4 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-monokai-green peer-checked:after:bg-zinc-900 peer-checked:after:border-transparent"></div>
                </label>
              </div>

              <div className="text-[9px] text-zinc-500 border-t border-zinc-900 pt-2 leading-relaxed">
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

          return (
            <div className="absolute top-0 right-0 bottom-0 w-80 border-l border-zinc-800/80 bg-[#12131a]/95 backdrop-blur-md flex flex-col h-full z-20 animate-in slide-in-from-right duration-250 shadow-2xl">
              <div className="px-4 py-4 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className={`w-4 h-4 ${typeStyle.text}`} />
                  <span className="text-xs font-bold text-slate-100 truncate max-w-[180px]" title={node.name}>{node.name}</span>
                </div>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1 rounded-[2px] text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-5">
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">实体类型</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded-[2px] ${typeStyle.bg} ${typeStyle.text}`}>
                      {type?.name || '未知'}
                    </span>
                    {type?.description && (
                      <span className="text-[10px] text-zinc-500 italic truncate" title={type.description}>
                        {type.description}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">节点操作</span>
                  <div className="grid grid-cols-3 gap-1.5 mt-1">
                    <button
                      onClick={() => handleOpenEditNode(node)}
                      className="flex flex-col items-center justify-center gap-1 p-2 text-[9px] bg-slate-855 hover:bg-slate-800 text-slate-200 font-bold rounded-[2px] transition-colors border border-zinc-800"
                      title="编辑节点属性设置"
                    >
                      <Settings className="w-3.5 h-3.5 text-monokai-blue" />
                      <span>编辑设置</span>
                    </button>
                    <button
                      onClick={() => toggleLockNode(node.id)}
                      className={`flex flex-col items-center justify-center gap-1 p-2 text-[9px] font-bold rounded-[2px] transition-colors border ${lockedNodeIds.has(node.id) ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20' : 'bg-slate-855 border-zinc-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200'}`}
                      title={lockedNodeIds.has(node.id) ? "解锁此节点" : "锁定此节点，防止在画布中被误拖拽移动"}
                    >
                      {lockedNodeIds.has(node.id) ? (
                        <>
                          <Lock className="w-3.5 h-3.5 text-amber-500" />
                          <span>已锁定</span>
                        </>
                      ) : (
                        <>
                          <Unlock className="w-3.5 h-3.5" />
                          <span>锁定节点</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteNode(node.id)}
                      className="flex flex-col items-center justify-center gap-1 p-2 text-[9px] bg-monokai-pink/10 hover:bg-monokai-pink/20 text-monokai-pink font-bold rounded-[2px] transition-colors border border-monokai-pink/20"
                      title="从画布中删除此节点"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>删除节点</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">附加属性列表</span>
                  <div className="bg-zinc-950/40 border border-zinc-800/80 rounded-[2px] p-3 select-text">
                    {renderProperties(node.properties)}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">已连接的关联关系 ({connectedRelations.length})</span>
                  {connectedRelations.length === 0 ? (
                    <div className="text-[10px] text-zinc-655 italic pl-1">暂无关联关系，可通过锚点拖拽建连</div>
                  ) : (
                    <div className="space-y-2 mt-1">
                      {connectedRelations.map((link: any) => {
                        const isSource = link.source_object_id === node.id;
                        const relatedId = isSource ? link.target_object_id : link.source_object_id;
                        const relatedNode = objects.find((o: any) => o.id === relatedId);
                        const relationName = linkTypes.find((t: any) => t.id === link.link_type_id)?.name || '关联';
                        
                        return (
                          <div key={link.id} className="flex items-center justify-between gap-2 p-2.5 rounded-[2px] border border-zinc-800/60 bg-[#12131a] text-[10px]">
                            <div className="flex flex-col gap-0.5 truncate max-w-[80%]">
                              <span className="text-zinc-500 flex items-center gap-1">
                                {isSource ? '指向 →' : '来自 ←'}
                                <span className="font-mono text-zinc-400 font-bold">({relationName})</span>
                              </span>
                              <span className="text-slate-200 font-semibold truncate" title={relatedNode?.name || '未知节点'}>
                                {relatedNode?.name || '未知节点'}
                              </span>
                            </div>
                            <button
                              onClick={() => {
                                if (window.confirm('确定断开此关联关系吗？')) deleteLink(link.id);
                              }}
                              className="p-1 rounded-[2px] text-zinc-500 hover:text-monokai-pink hover:bg-monokai-pink/10 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()
      )}

      {/* MODAL: Create Object Node */}
      {showCreateNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <form onSubmit={handleSaveNewNode} className="w-80 bg-[#12131a] border border-slate-800 rounded-[2px] p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Plus className="w-4 h-4 text-monokai-blue" /> 新建实体节点
            </h3>
            
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">节点名称</label>
              <input
                type="text"
                autoFocus
                required
                value={newNodeName}
                onChange={(e) => setNewNodeName(e.target.value)}
                placeholder="例如：主数据库 / 分析引擎"
                className="w-full bg-[#0c0c12] border border-slate-700 rounded-[2px] px-3 py-2 text-xs text-slate-200 focus:border-monokai-blue focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">实体类型</label>
              <select
                value={newNodeTypeId}
                onChange={(e) => setNewNodeTypeId(parseInt(e.target.value, 10))}
                className="w-full bg-[#0c0c12] border border-slate-700 rounded-[2px] px-3 py-2 text-xs text-slate-200 focus:border-monokai-blue focus:outline-none"
              >
                {objectTypes.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.description})</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setShowCreateNode(false)}
                className="px-4 py-2 rounded-[2px] text-slate-400 hover:bg-slate-800 transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-monokai-blue text-slate-900 rounded-[2px] hover:bg-monokai-blue/90 transition-colors"
              >
                确定创建
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Create Link Relationship */}
      {showCreateLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <form onSubmit={handleSaveNewLink} className="w-80 bg-[#12131a] border border-slate-800 rounded-[2px] p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Link2 className="w-4 h-4 text-monokai-green" /> 建立关系连接
            </h3>

            <div className="bg-slate-900/60 p-2.5 rounded-[2px] border border-slate-800 text-[10px] space-y-1 text-slate-400">
              <div>源实体: <strong className="text-slate-200">{objects.find((o: any) => o.id === connectingSourceId)?.name}</strong></div>
              <div>目标实体: <strong className="text-slate-200">{objects.find((o: any) => o.id === selectedNodeId)?.name}</strong></div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">关系类型</label>
              <select
                value={selectedLinkTypeId}
                onChange={(e) => setSelectedLinkTypeId(parseInt(e.target.value, 10))}
                className="w-full bg-[#0c0c12] border border-slate-700 rounded-[2px] px-3 py-2 text-xs text-slate-200 focus:border-monokai-green focus:outline-none"
              >
                {linkTypes.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.description})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">权重参数</label>
                <span className="text-[10px] font-mono text-monokai-green">{linkWeight}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.1"
                value={linkWeight}
                onChange={(e) => setLinkWeight(parseFloat(e.target.value))}
                className="w-full accent-monokai-green bg-slate-950 rounded-[2px] appearance-none h-1.5"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => { setShowCreateLink(false); setConnectingSourceId(null); }}
                className="px-4 py-2 rounded-[2px] text-slate-400 hover:bg-slate-800 transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-monokai-green text-slate-900 rounded-[2px] hover:bg-monokai-green/90 transition-colors"
              >
                建立关系
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Edit Node */}
      {showEditNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <form onSubmit={handleSaveEditNode} className="w-80 bg-[#12131a] border border-slate-800 rounded-[2px] p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Settings className="w-4 h-4 text-monokai-cyan" /> 属性设置编辑
            </h3>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">实体名称</label>
              <input
                type="text"
                required
                value={editNodeName}
                onChange={(e) => setEditNodeName(e.target.value)}
                className="w-full bg-[#0c0c12] border border-slate-700 rounded-[2px] px-3 py-2 text-xs text-slate-200 focus:border-monokai-cyan focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">实体类型</label>
              <select
                value={editNodeTypeId}
                onChange={(e) => setEditNodeTypeId(parseInt(e.target.value, 10))}
                className="w-full bg-[#0c0c12] border border-slate-700 rounded-[2px] px-3 py-2 text-xs text-slate-200 focus:border-monokai-cyan focus:outline-none"
              >
                {objectTypes.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.description})</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setShowEditNode(false)}
                className="px-4 py-2 rounded-[2px] text-slate-400 hover:bg-slate-800 transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-monokai-cyan text-slate-900 rounded-[2px] hover:bg-monokai-cyan/90 transition-colors"
              >
                保存修改
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export const OntologyCanvas: React.FC<OntologyCanvasInnerProps> = (props) => (
  <ReactFlowProvider>
    <OntologyCanvasInner {...props} />
  </ReactFlowProvider>
);

export default OntologyCanvas;
