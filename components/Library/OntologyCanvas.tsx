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
  `}</style>
);

const nodeTypes = {
  ontology: OntologyNode,
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

  // Selected, Dragging & Hover States
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<number | null>(null);

  // Use values from global store
  const nodePositions = canvasPositions;
  const lockedNodeIds = canvasLockedNodeIds;

  // Expanded nodes for properties
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<number>>(new Set());
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);

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

  // Load and construct node positions if missing
  useEffect(() => {
    const updated = { ...nodePositions };
    let missingCount = 0;
    objects.forEach((obj: any) => {
      if (!updated[obj.id] || isNaN(updated[obj.id].x) || isNaN(updated[obj.id].y)) {
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
      updateCanvasPositions(updated);
    }
  }, [objects, nodePositions, updateCanvasPositions]);

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

  // Force Layout auto sorting (Dagre hierarchical layout algorithm)
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const handleAutoAlign = useCallback(() => {
    pushToHistory(nodePositions);
    const { nodes: layoutedNodes } = getLayoutedElements(nodes, edges, 'LR');
    const updated = { ...nodePositions };
    layoutedNodes.forEach((node) => {
      updated[Number(node.id)] = node.position;
    });
    updateCanvasPositions(updated);
  }, [nodes, edges, nodePositions, updateCanvasPositions, pushToHistory]);

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
          isCompact: rfZoom < 0.65,
          isDetailed: rfZoom >= 0.95,
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
  }, [objects, nodePositions, objectTypes, lockedNodeIds, highlightedNodeId, rfZoom, expandedNodeIds, activePathNodesAndLinks, isFocusMode, handleLockNodeToggle, setNodes]);

  // Synchronize store links to ReactFlow edges
  useEffect(() => {
    const rfEdges = links.map((link: any) => {
      const isSelected = selectedNodeId === link.source_object_id || selectedNodeId === link.target_object_id;
      const isUpstreamLink = activePathNodesAndLinks?.upstreamLinks.has(link.id);
      const isDownstreamLink = activePathNodesAndLinks?.downstreamLinks.has(link.id);
      const linkName = linkTypes.find((t: any) => t.id === link.link_type_id)?.name || '关联';
      const isActive = isUpstreamLink || isDownstreamLink;

      return {
        id: String(link.id),
        source: String(link.source_object_id),
        target: String(link.target_object_id),
        label: linkName,
        animated: isSelected || isActive,
        style: {
          stroke: isActive
            ? (isUpstreamLink ? '#10b981' : '#06b6d4')
            : (isSelected ? '#06b6d4' : '#71717a'),
          strokeWidth: isSelected || isActive ? 2.5 : 1.5,
        },
        labelStyle: {
          fill: isActive ? '#06b6d4' : '#a1a1aa',
          fontWeight: 700,
          fontSize: 9,
          fontFamily: 'monospace',
        },
        labelBgStyle: {
          fill: '#12131a',
          fillOpacity: 0.85,
        }
      };
    }).filter(e => {
      if (isFocusMode && activePathNodesAndLinks) {
        return activePathNodesAndLinks.upstreamLinks.has(Number(e.id)) || activePathNodesAndLinks.downstreamLinks.has(Number(e.id));
      }
      return true;
    });
    setEdges(rfEdges);
  }, [links, selectedNodeId, activePathNodesAndLinks, linkTypes, isFocusMode, setEdges]);

  // Dragging node ends: save position back to store
  const onNodeDragStop = useCallback((event: any, node: any) => {
    const nodeId = Number(node.id);
    if (!lockedNodeIds.has(nodeId)) {
      pushToHistory(nodePositions);
      saveNodePosition(nodeId, {
        x: Math.round(node.position.x / GRID_SIZE) * GRID_SIZE,
        y: Math.round(node.position.y / GRID_SIZE) * GRID_SIZE,
      });
    }
  }, [lockedNodeIds, nodePositions, pushToHistory, saveNodePosition]);

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
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          onDoubleClick={handlePaneDoubleClick}
          nodeTypes={nodeTypes}
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
