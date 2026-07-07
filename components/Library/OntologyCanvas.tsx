import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Sparkles, Database, Plus, Trash2, ArrowRight,
  Check, AlertTriangle, Search, RefreshCw, ZoomIn, ZoomOut, Maximize2,
  X, Link2, Info, Move, Settings, Zap, BookOpen, GitCommit,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { useOntologyStore } from '../../hooks/useOntologyStore';

// ============================================================
// Types & Interfaces
// ============================================================

interface Position {
  x: number;
  y: number;
}

interface SavedPositions {
  [key: number]: Position;
}

const TYPE_COLORS = [
  { border: 'border-monokai-purple/60 hover:border-monokai-purple', bg: 'bg-monokai-purple/10', text: 'text-monokai-purple', glow: 'shadow-[0_0_15px_rgba(167,139,250,0.15)]' },
  { border: 'border-monokai-cyan/60 hover:border-monokai-cyan', bg: 'bg-monokai-cyan/10', text: 'text-monokai-cyan', glow: 'shadow-[0_0_15px_rgba(102,217,239,0.15)]' },
  { border: 'border-monokai-green/60 hover:border-monokai-green', bg: 'bg-monokai-green/10', text: 'text-monokai-green', glow: 'shadow-[0_0_15px_rgba(166,226,46,0.15)]' },
  { border: 'border-monokai-yellow/60 hover:border-monokai-yellow', bg: 'bg-monokai-yellow/10', text: 'text-monokai-yellow', glow: 'shadow-[0_0_15px_rgba(244,191,68,0.15)]' },
  { border: 'border-monokai-orange/60 hover:border-monokai-orange', bg: 'bg-monokai-orange/10', text: 'text-monokai-orange', glow: 'shadow-[0_0_15px_rgba(253,151,31,0.15)]' },
  { border: 'border-monokai-pink/60 hover:border-monokai-pink', bg: 'bg-monokai-pink/10', text: 'text-monokai-pink', glow: 'shadow-[0_0_15px_rgba(249,38,114,0.15)]' }
];

export const OntologyCanvas: React.FC<{
  onInsert?: (sql: string) => void;
  ontologyState?: any;
}> = ({ onInsert, ontologyState }) => {
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
    createObject,
    deleteObject,
    createLink,
    deleteLink,
    updateObject
  } = store;

  // Viewport transformation states
  const [zoom, setZoom] = useState(0.9);
  const [pan, setPan] = useState<Position>({ x: 120, y: 80 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Position>({ x: 0, y: 0 });

  // Selected & Dragging States
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [nodePositions, setNodePositions] = useState<SavedPositions>({});

  // Expanded nodes for properties
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<number>>(new Set());

  // Performance throttling refs for requestAnimationFrame
  const rafRef = useRef<number | null>(null);
  const nextPanRef = useRef<Position | null>(null);
  const nextNodePosRef = useRef<{ id: number; pos: Position } | null>(null);
  const nextConnMousePosRef = useRef<Position | null>(null);

  // Line drawing (connecting nodes)
  const [connectingSourceId, setConnectingSourceId] = useState<number | null>(null);
  const [connectionMousePos, setConnectionMousePos] = useState<Position>({ x: 0, y: 0 });

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

  // Dynamic multi-relationship curvature router
  const linkCurvatures = useMemo(() => {
    const counts: { [key: string]: number } = {};
    const curvatures: { [key: number]: number } = {};
    
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
      
      let factor = 0.15;
      if (index === 0) {
        factor = 0.12;
      } else if (index === 1) {
        factor = -0.12;
      } else {
        const sign = index % 2 === 0 ? 1 : -1;
        const level = Math.floor(index / 2) + 1;
        factor = sign * (0.12 + level * 0.10);
      }
      
      if (link.source_object_id > link.target_object_id) {
        factor = -factor;
      }
      
      curvatures[link.id] = factor;
    });
    
    return curvatures;
  }, [links]);

  // Load and construct node positions
  useEffect(() => {
    try {
      const stored = localStorage.getItem('ontology_canvas_positions_v2');
      const saved: SavedPositions = stored ? JSON.parse(stored) : {};
      
      // Calculate missing positions spiraling outwards from center
      const updated = { ...saved };
      let missingCount = 0;
      objects.forEach((obj: any) => {
        if (!updated[obj.id]) {
          const angle = missingCount * 0.6;
          const radius = 120 + Math.floor(missingCount / 3) * 60;
          updated[obj.id] = {
            x: 450 + Math.cos(angle) * radius,
            y: 300 + Math.sin(angle) * radius
          };
          missingCount++;
        }
      });

      setNodePositions(updated);
      if (missingCount > 0) {
        localStorage.setItem('ontology_canvas_positions_v2', JSON.stringify(updated));
      }
    } catch (e) {
      console.error('Failed to load node coordinates', e);
    }
  }, [objects]);

  // Save specific node position helper
  const saveNodePosition = (id: number, pos: Position) => {
    setNodePositions(prev => {
      const updated = { ...prev, [id]: pos };
      localStorage.setItem('ontology_canvas_positions_v2', JSON.stringify(updated));
      return updated;
    });
  };

  // Helper: Get color index based on Object Type ID
  const getTypeStyles = useCallback((typeId: number) => {
    const idx = typeId % TYPE_COLORS.length;
    return TYPE_COLORS[idx];
  }, []);

  // Search node focus handler
  const handleSearchFocus = (nodeId: number) => {
    const pos = nodePositions[nodeId];
    if (pos && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const targetX = rect.width / 2 - pos.x * zoom;
      const targetY = rect.height / 2 - pos.y * zoom;
      setPan({ x: targetX, y: targetY });
      setHighlightedNodeId(nodeId);
      setSelectedNodeId(nodeId);
      setTimeout(() => setHighlightedNodeId(null), 2000);
    }
  };

  // Canvas Interactions: Pan
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Only pan on background click with left click
    if (e.button === 0 && e.target === e.currentTarget) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  // Clean up animation frame on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Wheel zoom handler using standard browser WheelEvent to allow preventDefault inside non-passive listener
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const scaleFactor = 1.05;
      setZoom(prevZoom => {
        const newZoom = e.deltaY < 0 ? prevZoom * scaleFactor : prevZoom / scaleFactor;
        return Math.max(0.3, Math.min(2.0, newZoom));
      });
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Node Interactions: Drag & Select
  const handleNodeMouseDown = (e: React.MouseEvent, node: any) => {
    e.stopPropagation();
    if (e.button !== 0) return; // Only left click

    setSelectedNodeId(node.id);
    const pos = nodePositions[node.id] || { x: 0, y: 0 };
    
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const xInCanvas = (e.clientX - rect.left - pan.x) / zoom;
    const yInCanvas = (e.clientY - rect.top - pan.y) / zoom;

    setDraggingNodeId(node.id);
    setDragOffset({
      x: xInCanvas - pos.x,
      y: yInCanvas - pos.y
    });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const newPan = {
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      };
      nextPanRef.current = newPan;
      
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          if (nextPanRef.current) {
            setPan(nextPanRef.current);
            nextPanRef.current = null;
          }
          rafRef.current = null;
        });
      }
    } else if (draggingNodeId !== null) {
      // Drag node
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const xInCanvas = (e.clientX - rect.left - pan.x) / zoom;
      const yInCanvas = (e.clientY - rect.top - pan.y) / zoom;
      
      const newPos = {
        x: Math.round(xInCanvas - dragOffset.x),
        y: Math.round(yInCanvas - dragOffset.y)
      };
      
      nextNodePosRef.current = { id: draggingNodeId, pos: newPos };
      
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          if (nextNodePosRef.current) {
            const { id, pos } = nextNodePosRef.current;
            setNodePositions(prev => ({
              ...prev,
              [id]: pos
            }));
            nextNodePosRef.current = null;
          }
          rafRef.current = null;
        });
      }
    } else if (connectingSourceId !== null) {
      // Connect line mouse tracking
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const newMousePos = {
        x: (e.clientX - rect.left - pan.x) / zoom,
        y: (e.clientY - rect.top - pan.y) / zoom
      };
      nextConnMousePosRef.current = newMousePos;
      
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          if (nextConnMousePosRef.current) {
            setConnectionMousePos(nextConnMousePosRef.current);
            nextConnMousePosRef.current = null;
          }
          rafRef.current = null;
        });
      }
    }
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
    
    // Flush any pending animation frames synchronously to ensure states are aligned on release
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      
      if (nextPanRef.current) {
        setPan(nextPanRef.current);
        nextPanRef.current = null;
      }
      if (nextNodePosRef.current) {
        const { id, pos } = nextNodePosRef.current;
        setNodePositions(prev => {
          const updated = { ...prev, [id]: pos };
          localStorage.setItem('ontology_canvas_positions_v2', JSON.stringify(updated));
          return updated;
        });
        nextNodePosRef.current = null;
      }
      if (nextConnMousePosRef.current) {
        setConnectionMousePos(nextConnMousePosRef.current);
        nextConnMousePosRef.current = null;
      }
    } else if (draggingNodeId !== null) {
      const pos = nodePositions[draggingNodeId];
      if (pos) {
        saveNodePosition(draggingNodeId, pos);
      }
    }
    
    setDraggingNodeId(null);
    if (connectingSourceId !== null) {
      setConnectingSourceId(null);
    }
  };

  // Draw Line Handle
  const handleConnectStart = (e: React.MouseEvent, nodeId: number) => {
    e.stopPropagation();
    e.preventDefault();
    setConnectingSourceId(nodeId);
    const pos = nodePositions[nodeId] || { x: 0, y: 0 };
    setConnectionMousePos(pos);
  };

  const handleConnectEnd = (e: React.MouseEvent, targetNodeId: number) => {
    e.stopPropagation();
    if (connectingSourceId !== null && connectingSourceId !== targetNodeId) {
      // Open Create Link dialog
      setCreateNodeClickPos({ x: 0, y: 0 }); // reset click pos
      setSelectedLinkTypeId(linkTypes[0]?.id || 1);
      setLinkWeight(0.5);
      setShowCreateLink(true);
      // Keep connecting source to use in submit
    }
    setConnectingSourceId(null);
  };

  // Double Click Canvas: Create Node
  const handleCanvasDoubleClick = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;

    setCreateNodeClickPos({ x, y });
    setNewNodeName('');
    setNewNodeTypeId(objectTypes[0]?.id || 1);
    setShowCreateNode(true);
  };

  // CRUD Trigger: Save Node
  const handleSaveNewNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNodeName.trim()) return;

    try {
      await createObject(newNodeName.trim(), newNodeTypeId);
      
      // The store refreshes and updates state.objects.
      // In the next render, nodePositions hook will assign a position to the new object.
      // We overwrite it with the double-click position coordinates right away.
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
      } catch (err: any) {
        alert(`删除失败: ${err.message}`);
      }
    }
  };

  // CRUD Trigger: Edit Node Name / Type
  const handleOpenEditNode = () => {
    const node = objects.find((o: any) => o.id === selectedNodeId);
    if (node) {
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

  // Force Layout auto sorting
  const handleAutoAlign = () => {
    // Dynamic circular alignment group by types
    const updated = { ...nodePositions };
    const radiusStep = 150;
    const typeGroups: { [key: number]: any[] } = {};
    
    objects.forEach((obj: any) => {
      if (!typeGroups[obj.object_type_id]) {
        typeGroups[obj.object_type_id] = [];
      }
      typeGroups[obj.object_type_id].push(obj);
    });

    let typeIndex = 0;
    Object.keys(typeGroups).forEach((typeIdStr) => {
      const typeId = parseInt(typeIdStr, 10);
      const list = typeGroups[typeId];
      const count = list.length;
      const ringRadius = 150 + typeIndex * radiusStep;
      
      list.forEach((obj: any, idx: number) => {
        const angle = (idx / count) * 2 * Math.PI + (typeIndex * 0.5);
        // Add a radial expansion based on index to spiral outwards if there are too many nodes of the same type
        const radialOffset = Math.floor(idx / 6) * 45;
        const currentRadius = ringRadius + radialOffset;
        // Add a small alternating angular wiggle to stagger nodes
        const wiggle = (idx % 2 === 0 ? 0.05 : -0.05);
        
        updated[obj.id] = {
          x: 450 + Math.cos(angle + wiggle) * currentRadius,
          y: 350 + Math.sin(angle + wiggle) * currentRadius
        };
      });
      typeIndex++;
    });

    setNodePositions(updated);
    localStorage.setItem('ontology_canvas_positions_v2', JSON.stringify(updated));
  };

  // Fit view helper
  const handleFitView = () => {
    if (objects.length === 0) return;
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    objects.forEach((obj: any) => {
      const pos = nodePositions[obj.id];
      if (pos) {
        minX = Math.min(minX, pos.x);
        minY = Math.min(minY, pos.y);
        maxX = Math.max(maxX, pos.x);
        maxY = Math.max(maxY, pos.y);
      }
    });

    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const graphW = maxX - minX + 240;
      const graphH = maxY - minY + 160;
      const scaleX = rect.width / graphW;
      const scaleY = rect.height / graphH;
      const newZoom = Math.max(0.5, Math.min(1.2, Math.min(scaleX, scaleY)));
      
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      setZoom(newZoom);
      setPan({
        x: rect.width / 2 - centerX * newZoom,
        y: rect.height / 2 - centerY * newZoom
      });
    }
  };

  // Reset helper
  const handleResetZoom = () => {
    setZoom(0.9);
    setPan({ x: 120, y: 80 });
  };

  // Filter objects by search query
  const filteredObjects = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return objects.filter((o: any) => o.name.toLowerCase().includes(q));
  }, [objects, searchQuery]);

  const toggleExpandNode = (e: React.MouseEvent, nodeId: number) => {
    e.stopPropagation();
    setExpandedNodeIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const renderProperties = (properties: any) => {
    try {
      const parsed = typeof properties === 'string' ? JSON.parse(properties || '{}') : (properties || {});
      const keys = Object.keys(parsed);
      if (keys.length === 0) return <span className="text-[10px] text-slate-600 italic">无附加属性</span>;
      return (
        <div className="mt-1.5 pt-1.5 border-t border-slate-800/60 space-y-1 max-h-24 overflow-y-auto custom-scrollbar select-text text-left">
          {keys.map(k => (
            <div key={k} className="flex justify-between gap-1 text-[10px] font-mono leading-tight">
              <span className="text-slate-500 truncate max-w-[45%] shrink-0" title={k}>{k}:</span>
              <span className="text-monokai-cyan break-all text-right font-semibold" title={typeof parsed[k] === 'object' ? JSON.stringify(parsed[k]) : String(parsed[k])}>
                {typeof parsed[k] === 'object' ? JSON.stringify(parsed[k]) : String(parsed[k])}
              </span>
            </div>
          ))}
        </div>
      );
    } catch (e) {
      return <span className="text-[10px] text-monokai-pink font-mono">解析错误</span>;
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0b0c10] select-none text-slate-300 relative overflow-hidden font-sans">
      
      {/* Top Floating Control Bar */}
      <div className="absolute top-4 left-4 right-4 z-10 flex flex-wrap gap-3 items-center justify-between pointer-events-none">
        
        {/* Title Badge */}
        <div className="bg-[#12131a]/90 backdrop-blur-md px-4 py-2.5 rounded-xl border border-monokai-accent/15 flex items-center gap-3 shadow-2xl pointer-events-auto">
          <div className="w-8 h-8 rounded-lg bg-monokai-purple/10 flex items-center justify-center border border-monokai-purple/20">
            <Sparkles className="w-4 h-4 text-monokai-purple animate-pulse" />
          </div>
          <div>
            <h1 className="text-xs font-bold text-slate-100 flex items-center gap-1.5 leading-none">
              互动本体画布
            </h1>
            <p className="text-[10px] text-slate-500 mt-1">双击空白处建节点 | 拽锚点连线建关系</p>
          </div>
        </div>

        {/* Searching & Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Quick Search */}
          <div className="relative group">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="搜索实体定位..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#12131a]/95 border border-monokai-accent/10 focus:border-monokai-cyan/50 pl-9 pr-8 py-2 rounded-xl text-xs w-48 transition-all focus:outline-none placeholder-slate-600 focus:w-60 shadow-lg text-slate-200"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            {/* Dropdown for search results */}
            {filteredObjects.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#12131a] border border-slate-800 rounded-xl overflow-hidden shadow-2xl max-h-48 overflow-y-auto custom-scrollbar z-50">
                {filteredObjects.slice(0, 5).map((obj: any) => (
                  <button
                    key={obj.id}
                    onClick={() => { handleSearchFocus(obj.id); setSearchQuery(''); }}
                    className="w-full text-left px-3.5 py-2 text-xs hover:bg-[#1a1c27] flex items-center justify-between text-slate-300 transition-colors"
                  >
                    <span className="font-bold truncate">{obj.name}</span>
                    <span className="text-[9px] text-monokai-cyan font-mono">{objectTypes.find((t: any) => t.id === obj.object_type_id)?.name || '未知类型'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Action Toolbar */}
          <div className="bg-[#12131a]/95 border border-monokai-accent/10 px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 shadow-lg">
            <button onClick={handleFitView} title="自适应视口" className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors">
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleResetZoom} title="重置缩放" className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} title="缩小" className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setZoom(z => Math.min(2.0, z + 0.1))} title="放大" className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-4 bg-slate-800 mx-1" />
            <button onClick={handleAutoAlign} title="一键网格力学排列" className="p-1.5 rounded-lg bg-monokai-purple/10 border border-monokai-purple/20 text-monokai-purple hover:bg-monokai-purple/20 transition-all text-xs font-semibold flex items-center gap-1 px-2.5">
              <GitCommit className="w-3.5 h-3.5" /> 自动排版
            </button>
          </div>
        </div>

      </div>

      {/* Main Canvas Work Area */}
      <div
        ref={canvasRef}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onDoubleClick={handleCanvasDoubleClick}
        className={`flex-1 relative overflow-hidden outline-none ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{
          backgroundImage: 'radial-gradient(rgba(102, 217, 239, 0.05) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          backgroundPosition: `${pan.x}px ${pan.y}px`
        }}
      >
        
        {/* Render Graph Wrapper */}
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            position: 'absolute',
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none'
          }}
        >
          {/* SVG Connection Lines Layer */}
          <svg className="absolute inset-0 overflow-visible pointer-events-auto" style={{ width: '100%', height: '100%' }}>
            <defs>
              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="20"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#4b5563" />
              </marker>
              <marker
                id="arrow-hover"
                viewBox="0 0 10 10"
                refX="20"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#a6e22e" />
              </marker>
            </defs>

            {/* Existing Relationships */}
            {links.map((link: any) => {
              const srcPos = nodePositions[link.source_object_id];
              const tgtPos = nodePositions[link.target_object_id];
              if (!srcPos || !tgtPos) return null;

              // Compute offset endpoints to avoid lines going directly into exact center of cards
              const dx = tgtPos.x - srcPos.x;
              const dy = tgtPos.y - srcPos.y;
              const angle = Math.atan2(dy, dx);
              
              // Custom offset depending on whether cards are expanded and angle to point clean to card edges
              const srcExpanded = expandedNodeIds.has(link.source_object_id);
              const tgtExpanded = expandedNodeIds.has(link.target_object_id);
              const srcH = srcExpanded ? 60 : 25;
              const tgtH = tgtExpanded ? 60 : 25;
              const srcW = 90; // Half of 200px width with margin
              const tgtW = 90;

              const sourceX = srcPos.x + Math.cos(angle) * srcW;
              const sourceY = srcPos.y + Math.sin(angle) * srcH;
              const targetX = tgtPos.x - Math.cos(angle) * tgtW;
              const targetY = tgtPos.y - Math.sin(angle) * tgtH;

              // Curved arc line
              const midX = (sourceX + targetX) / 2;
              const midY = (sourceY + targetY) / 2;
              const factor = linkCurvatures[link.id] ?? 0.15;
              const cx = midX + (targetY - sourceY) * factor;
              const cy = midY - (targetX - sourceX) * factor;

              const isSelected = selectedNodeId === link.source_object_id || selectedNodeId === link.target_object_id;

              return (
                <g key={link.id} className="group cursor-pointer">
                  {/* Outer Thick Hidden Line to Make Hover/Click Easier */}
                  <path
                    d={`M ${sourceX} ${sourceY} Q ${cx} ${cy} ${targetX} ${targetY}`}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="15"
                    className="pointer-events-stroke"
                    onClick={() => {
                      if (window.confirm(`确定删除该关系连接吗？`)) {
                        deleteLink(link.id);
                      }
                    }}
                  />
                  {/* Visible Line */}
                  <path
                    d={`M ${sourceX} ${sourceY} Q ${cx} ${cy} ${targetX} ${targetY}`}
                    fill="none"
                    stroke={isSelected ? '#66d9ef' : '#374151'}
                    strokeWidth={isSelected ? '2' : '1.2'}
                    markerEnd={`url(#${isSelected ? 'arrow-hover' : 'arrow'})`}
                    className="transition-all duration-300 group-hover:stroke-monokai-cyan group-hover:stroke-[2px]"
                  />
                  
                  {/* Floating Relation Label Badge */}
                  {(() => {
                    const linkName = linkTypes.find((t: any) => t.id === link.link_type_id)?.name || '关联';
                    const textWidth = Math.max(70, linkName.length * 7.5 + 16);
                    return (
                      <g transform={`translate(${cx}, ${cy})`}>
                        <rect
                          x={-textWidth / 2}
                          y="-10"
                          width={textWidth}
                          height="20"
                          rx="6"
                          fill="#12131a"
                          stroke={isSelected ? '#66d9ef' : '#1e293b'}
                          strokeWidth="1"
                          className="group-hover:stroke-monokai-cyan"
                        />
                        <text
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill={isSelected ? '#66d9ef' : '#94a3b8'}
                          fontSize="10"
                          fontWeight="bold"
                          className="select-none font-mono"
                        >
                          {linkName}
                        </text>
                      </g>
                    );
                  })()}
                </g>
              );
            })}

            {/* Draw Pointer Connection dragging line */}
            {connectingSourceId !== null && (
              (() => {
                const srcPos = nodePositions[connectingSourceId];
                if (!srcPos) return null;
                return (
                  <line
                    x1={srcPos.x}
                    y1={srcPos.y}
                    x2={connectionMousePos.x}
                    y2={connectionMousePos.y}
                    stroke="#a6e22e"
                    strokeWidth="1.5"
                    strokeDasharray="4,4"
                    className="animate-pulse"
                  />
                );
              })()
            )}
          </svg>

          {/* HTML Entity Cards Layer */}
          <div className="absolute inset-0 pointer-events-none">
            {objects.map((obj: any) => {
              const pos = nodePositions[obj.id] || { x: 300, y: 300 };
              const isSelected = selectedNodeId === obj.id;
              const isHighlighted = highlightedNodeId === obj.id;
              const type = objectTypes.find((t: any) => t.id === obj.object_type_id);
              const typeStyle = getTypeStyles(obj.object_type_id);

              const isExpanded = expandedNodeIds.has(obj.id);

              return (
                <div
                  key={obj.id}
                  onMouseDown={(e) => handleNodeMouseDown(e, obj)}
                  onMouseUp={(e) => handleConnectEnd(e, obj.id)}
                  style={{
                    left: pos.x,
                    top: pos.y,
                    transform: 'translate(-50%, -50%)',
                    width: '200px',
                    minHeight: isExpanded ? '130px' : '60px',
                    height: isExpanded ? 'auto' : '60px'
                  }}
                  className={`absolute rounded-xl bg-[#12131a] border px-3.5 py-2 flex flex-col justify-between cursor-grab hover:scale-102 hover:bg-[#151620] select-none transition-all duration-150 pointer-events-auto ${typeStyle.border} ${typeStyle.glow} ${
                    isSelected ? 'ring-2 ring-slate-100 ring-offset-2 ring-offset-[#0b0c10]' : ''
                  } ${isHighlighted ? 'animate-bounce ring-4 ring-monokai-cyan' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2 w-full overflow-hidden">
                    <span className="text-xs font-bold text-slate-100 line-clamp-2 break-all w-[85%] leading-snug" title={obj.name}>
                      {obj.name}
                    </span>
                    <div className="flex items-center gap-1 shrink-0 mt-0.5">
                      <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => toggleExpandNode(e, obj.id)}
                        className="p-0.5 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors shrink-0"
                        title={isExpanded ? "收起属性" : "展开属性"}
                      >
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                      <Database className={`w-3.5 h-3.5 ${typeStyle.text} shrink-0`} />
                    </div>
                  </div>

                  {isExpanded && renderProperties(obj.properties)}

                  <div className="flex items-center justify-between w-full mt-2 pt-1.5 border-t border-slate-900/50">
                    {/* Object Type label */}
                    <span className={`text-[9px] font-mono font-bold tracking-wider px-2 py-0.5 rounded ${typeStyle.bg} ${typeStyle.text}`}>
                      {type?.name || '未知'}
                    </span>

                    {/* Pull Link Connector Anchor Handle */}
                    <button
                      onMouseDown={(e) => handleConnectStart(e, obj.id)}
                      title="拖拽拉线新建关系"
                      className="w-4 h-4 rounded-full bg-slate-800 hover:bg-monokai-green flex items-center justify-center group/btn cursor-crosshair border border-slate-700/60 shadow"
                    >
                      <Plus className="w-2.5 h-2.5 text-slate-400 group-hover/btn:text-slate-900" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

        </div>

      </div>

      {/* Selected Node Action Floating panel */}
      {selectedNodeId !== null && (
        (() => {
          const node = objects.find((o: any) => o.id === selectedNodeId);
          if (!node) return null;
          const type = objectTypes.find((t: any) => t.id === node.object_type_id);
          const typeStyle = getTypeStyles(node.object_type_id);
          
          return (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 bg-[#12131a]/95 border border-slate-800/80 px-4 py-3 rounded-2xl flex items-center gap-4 shadow-2xl backdrop-blur-lg animate-in slide-in-from-bottom-5 duration-200">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none">选中的实体</span>
                <span className="text-xs font-bold text-slate-200 mt-1 flex items-center gap-1.5">
                  <Database className={`w-3.5 h-3.5 ${typeStyle.text}`} /> {node.name}
                  <span className="text-[9px] text-slate-500 font-normal">({type?.name})</span>
                </span>
              </div>
              <div className="w-px h-6 bg-slate-800" />
              <div className="flex gap-2">
                <button
                  onClick={handleOpenEditNode}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg transition-colors border border-slate-700"
                >
                  重命名/换类
                </button>
                <button
                  onClick={() => handleDeleteNode(node.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] bg-monokai-pink/15 hover:bg-monokai-pink/25 text-monokai-pink font-bold rounded-lg transition-all border border-monokai-pink/25"
                >
                  <Trash2 className="w-3 h-3" /> 删除节点
                </button>
                <button
                  onClick={() => setSelectedNodeId(null)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })()
      )}

      {/* MODAL: Create Object Node */}
      {showCreateNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <form onSubmit={handleSaveNewNode} className="w-80 bg-[#12131a] border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Plus className="w-4 h-4 text-monokai-purple" /> 新建实体节点
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
                className="w-full bg-[#0c0c12] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-monokai-purple focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">实体类型</label>
              <select
                value={newNodeTypeId}
                onChange={(e) => setNewNodeTypeId(parseInt(e.target.value, 10))}
                className="w-full bg-[#0c0c12] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-monokai-purple focus:outline-none"
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
                className="px-4 py-2 rounded-lg text-slate-400 hover:bg-slate-800 transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-monokai-purple text-white rounded-lg hover:bg-monokai-purple/90 transition-colors"
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
          <form onSubmit={handleSaveNewLink} className="w-80 bg-[#12131a] border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Link2 className="w-4 h-4 text-monokai-green" /> 建立关系连接
            </h3>

            <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 text-[10px] space-y-1 text-slate-400">
              <div>源实体: <strong className="text-slate-200">{objects.find((o: any) => o.id === connectingSourceId)?.name}</strong></div>
              <div>目标实体: <strong className="text-slate-200">{objects.find((o: any) => o.id === selectedNodeId)?.name}</strong></div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">关系类型</label>
              <select
                value={selectedLinkTypeId}
                onChange={(e) => setSelectedLinkTypeId(parseInt(e.target.value, 10))}
                className="w-full bg-[#0c0c12] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-monokai-green focus:outline-none"
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
                className="w-full accent-monokai-green bg-slate-950 rounded-lg appearance-none h-1.5"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => { setShowCreateLink(false); setConnectingSourceId(null); }}
                className="px-4 py-2 rounded-lg text-slate-400 hover:bg-slate-800 transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-monokai-green text-slate-900 rounded-lg hover:bg-monokai-green/90 transition-colors"
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
          <form onSubmit={handleSaveEditNode} className="w-80 bg-[#12131a] border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
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
                className="w-full bg-[#0c0c12] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-monokai-cyan focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">实体类型</label>
              <select
                value={editNodeTypeId}
                onChange={(e) => setEditNodeTypeId(parseInt(e.target.value, 10))}
                className="w-full bg-[#0c0c12] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-monokai-cyan focus:outline-none"
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
                className="px-4 py-2 rounded-lg text-slate-400 hover:bg-slate-800 transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-monokai-cyan text-slate-900 rounded-lg hover:bg-monokai-cyan/90 transition-colors"
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

export default OntologyCanvas;
