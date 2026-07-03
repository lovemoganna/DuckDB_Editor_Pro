import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Panel,
  MarkerType,
  Connection,
  Edge,
  Node
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import {
  Plus, X, Play, RefreshCw, ZoomIn, ZoomOut, Maximize2,
  Trash2, Sparkles, HelpCircle, ChevronRight, ChevronDown, Check, Info, FileText,
  Undo2, Redo2
} from 'lucide-react';
import { duckDBService } from '../../services/duckdbService';
import { ontologyAiService, MECELayer, MeceCanvasLayoutPlan } from '../../services/ontologyAiService';
import { compileToSql, NodeType } from './CanvasTopologyManager';
import { useOntologyStore } from '../../hooks/useOntologyStore';
import {
  SourceNode,
  TransformNode,
  ControlNode,
  SinkNode,
  GroupSpaceNode,
  getNodeColor
} from './CustomCanvasNodes';

const nodeTypes = {
  Source: SourceNode,
  Transform: TransformNode,
  Control: ControlNode,
  Sink: SinkNode,
  groupSpace: GroupSpaceNode
};

export const OntologyCanvas: React.FC<{
  onInsert?: (sql: string) => void;
  onClose?: () => void;
  ontologyState?: any;
}> = ({ onInsert, onClose, ontologyState }) => {
  const store = useOntologyStore();
  const storeState = ontologyState ?? store.state;
  const { refresh } = store;
  const { objects = [], objectTypes = [] } = storeState ?? {};

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [activeLayer, setActiveLayer] = useState<MECELayer>('foundation');
  const [showHelp, setShowHelp] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showSqlPanel, setShowSqlPanel] = useState(true);
  const [isAIFilling, setIsAIFilling] = useState(false);

  // Object picker modal states
  const [showObjectPicker, setShowObjectPicker] = useState(false);
  const [pickerNodeType, setPickerNodeType] = useState<NodeType>('Source');

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  // ── Undo/Redo Engine ──
  const [history, setHistory] = useState<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const isTransitioningRef = useRef(false);

  const pushHistory = useCallback((newNodes: Node[], newEdges: Edge[]) => {
    if (isTransitioningRef.current) return;
    setHistory(prev => {
      const nextHistory = prev.slice(0, historyIndex + 1);
      const updated = [...nextHistory, { nodes: newNodes, edges: newEdges }];
      if (updated.length > 50) {
        updated.shift();
      }
      return updated;
    });
    setHistoryIndex(prev => {
      const nextIndex = prev + 1;
      return nextIndex > 49 ? 49 : nextIndex;
    });
  }, [historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      isTransitioningRef.current = true;
      const prevIndex = historyIndex - 1;
      const targetState = history[prevIndex];
      setNodes(targetState.nodes);
      setEdges(targetState.edges);
      setHistoryIndex(prevIndex);
      setTimeout(() => {
        isTransitioningRef.current = false;
      }, 50);
    }
  }, [history, historyIndex, setNodes, setEdges]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isTransitioningRef.current = true;
      const nextIndex = historyIndex + 1;
      const targetState = history[nextIndex];
      setNodes(targetState.nodes);
      setEdges(targetState.edges);
      setHistoryIndex(nextIndex);
      setTimeout(() => {
        isTransitioningRef.current = false;
      }, 50);
    }
  }, [history, historyIndex, setNodes, setEdges]);

  // Global Ctrl+Z / Ctrl+Y key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))
      ) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const onNodeDragStop = useCallback(() => {
    pushHistory(nodes, edges);
  }, [nodes, edges, pushHistory]);

  // ── Database Loader ──
  const loadCanvas = useCallback(async () => {
    try {
      await duckDBService.query('CREATE TABLE IF NOT EXISTS life_canvas_state (id VARCHAR PRIMARY KEY, space_id VARCHAR, object_id INTEGER, title VARCHAR, color VARCHAR, x DECIMAL, y DECIMAL, width DECIMAL, height DECIMAL, node_type VARCHAR, metadata JSON)');
      await duckDBService.query('CREATE TABLE IF NOT EXISTS life_canvas_edge (id VARCHAR PRIMARY KEY, source_id VARCHAR, target_id VARCHAR)');

      const rows = await duckDBService.query('SELECT * FROM life_canvas_state');
      const edgeRows = await duckDBService.query('SELECT * FROM life_canvas_edge');

      const loadedNodes: Node[] = [];
      
      // Load groups/spaces first
      (rows as any[]).forEach(row => {
        if (row.space_id && row.id === row.space_id) {
          loadedNodes.push({
            id: row.id,
            type: 'groupSpace',
            position: { x: Number(row.x), y: Number(row.y) },
            style: { width: Number(row.width) || 300, height: Number(row.height) || 300 },
            data: {
              title: row.title || '分组空间',
              color: row.color || '#a78bfa',
              onDelete: (id: string) => handleDeleteNode(id)
            }
          });
        }
      });

      // Load items
      (rows as any[]).forEach(row => {
        if (row.id !== row.space_id) {
          const absoluteX = Number(row.x);
          const absoluteY = Number(row.y);
          
          let parentId = row.space_id || undefined;
          let relX = absoluteX;
          let relY = absoluteY;

          // Convert absolute coordinates back to relative for react-flow if inside group
          if (parentId) {
            const parent = loadedNodes.find(n => n.id === parentId);
            if (parent) {
              relX = absoluteX - parent.position.x;
              relY = absoluteY - parent.position.y;
            } else {
              parentId = undefined; // Parent space does not exist
            }
          }

          loadedNodes.push({
            id: row.id,
            type: row.node_type || 'Source',
            position: { x: relX, y: relY },
            parentId,
            extent: parentId ? 'parent' : undefined,
            data: {
              objectId: row.object_id,
              name: row.title || '节点',
              tableName: row.title || 'unknown_table',
              sqlFragment: row.metadata ? JSON.parse(row.metadata).sqlFragment : '',
              metadata: row.metadata ? JSON.parse(row.metadata) : {},
              onDelete: (id: string) => handleDeleteNode(id)
            }
          });
        }
      });

      const loadedEdges: Edge[] = (edgeRows as any[]).map(e => ({
        id: e.id,
        source: e.source_id,
        target: e.target_id,
        animated: true,
        style: { stroke: '#64748b', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' }
      }));

      setNodes(loadedNodes);
      setEdges(loadedEdges);
      setHistory([{ nodes: loadedNodes, edges: loadedEdges }]);
      setHistoryIndex(0);
    } catch (e) {
      console.error('[Canvas Loader] Loading failed:', e);
    } finally {
      setLoading(false);
    }
  }, [setNodes, setEdges, setHistory, setHistoryIndex]);

  useEffect(() => {
    loadCanvas();
  }, [loadCanvas]);

  // ── Database Saver ──
  const saveCanvas = useCallback(async () => {
    if (loading) return;
    try {
      await duckDBService.query('BEGIN TRANSACTION');
      await duckDBService.query('DELETE FROM life_canvas_state');
      await duckDBService.query('DELETE FROM life_canvas_edge');

      for (const node of nodes) {
        if (node.type === 'groupSpace') {
          // Saving Group
          await duckDBService.query(
            `INSERT INTO life_canvas_state VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
            [
              node.id,
              node.id,
              node.data.title,
              node.data.color,
              node.position.x,
              node.position.y,
              node.style?.width || 300,
              node.style?.height || 300
            ]
          );
        } else {
          // Saving node. Compute absolute coordinate from parent if inside group
          let absX = node.position.x;
          let absY = node.position.y;
          if (node.parentId) {
            const parent = nodes.find(n => n.id === node.parentId);
            if (parent) {
              absX += parent.position.x;
              absY += parent.position.y;
            }
          }

          const metaStr = JSON.stringify({
            sqlFragment: node.data.sqlFragment || '',
            tableName: node.data.tableName || '',
            layerTag: activeLayer
          });

          await duckDBService.query(
            `INSERT INTO life_canvas_state VALUES (?, ?, ?, ?, NULL, ?, ?, NULL, NULL, ?, ?)`,
            [
              node.id,
              node.parentId || null,
              node.data.objectId || 0,
              node.data.name,
              absX,
              absY,
              node.type,
              metaStr
            ]
          );
        }
      }

      for (const edge of edges) {
        await duckDBService.query(
          `INSERT INTO life_canvas_edge VALUES (?, ?, ?)`,
          [edge.id, edge.source, edge.target]
        );
      }
      await duckDBService.query('COMMIT');
    } catch (e) {
      console.error('[Canvas Saver] Auto-save failed, rolling back:', e);
      try {
        await duckDBService.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('[Canvas Saver] Transaction rollback failed:', rollbackErr);
      }
    }
  }, [nodes, edges, loading, activeLayer]);

  // Debounced auto-save on nodes/edges changes
  useEffect(() => {
    const timer = setTimeout(saveCanvas, 2000);
    return () => clearTimeout(timer);
  }, [nodes, edges, saveCanvas]);

  // ── SQL Compiler Integration ──
  const compileResult = useMemo(() => {
    const items = nodes
      .filter(n => n.type !== 'groupSpace')
      .map(n => ({
        id: n.id,
        objectId: n.data.objectId || 0,
        nodeType: n.type,
        metadata: {
          sqlFragment: n.data.sqlFragment || '',
          tableName: n.data.tableName || ''
        }
      }));

    const compiledEdges = edges.map(e => ({
      id: e.id,
      sourceId: e.source,
      targetId: e.target
    }));

    return compileToSql(items, compiledEdges);
  }, [nodes, edges]);

  const compiledSql = compileResult.sql;

  // ── Node & Edge Operations ──
  const onConnect = useCallback((params: any) => {
    const edgeColor = getNodeColor(nodes.find(n => n.id === params.source)?.type || '');
    const newEdge = {
      ...params,
      animated: true,
      style: { stroke: edgeColor, strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor }
    };
    setEdges((eds) => {
      const updated = addEdge(newEdge, eds);
      pushHistory(nodes, updated);
      return updated;
    });
  }, [nodes, setEdges, pushHistory]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    let nextNodes: Node[] = [];
    let nextEdges: Edge[] = [];
    setNodes(nds => {
      nextNodes = nds.filter(n => n.id !== nodeId);
      return nextNodes;
    });
    setEdges(eds => {
      nextEdges = eds.filter(e => e.source !== nodeId && e.target !== nodeId);
      return nextEdges;
    });
    setSelectedNode(curr => curr?.id === nodeId ? null : curr);
    pushHistory(nextNodes, nextEdges);
  }, [setNodes, setEdges, pushHistory]);

  const addGroupSpace = useCallback(() => {
    const spaceColors = ['#a78bfa', '#38bdf8', '#4ade80', '#fb923c', '#f472b6', '#a3e635', '#fbbf24', '#60a5fa'];
    const id = `group-${Date.now()}`;
    const newGroup: Node = {
      id,
      type: 'groupSpace',
      position: { x: 100 + Math.random() * 100, y: 100 + Math.random() * 100 },
      style: { width: 320, height: 280 },
      data: {
        title: `分组空间 #${nodes.filter(n => n.type === 'groupSpace').length + 1}`,
        color: spaceColors[nodes.filter(n => n.type === 'groupSpace').length % spaceColors.length],
        onDelete: (id: string) => handleDeleteNode(id)
      }
    };
    setNodes(nds => {
      const updated = [...nds, newGroup];
      pushHistory(updated, edges);
      return updated;
    });
  }, [nodes, edges, setNodes, handleDeleteNode, pushHistory]);

  const openObjectPicker = useCallback((nodeType: NodeType) => {
    setPickerNodeType(nodeType);
    setShowObjectPicker(true);
  }, []);

  const handleSelectObject = useCallback((objectId: number) => {
    const obj = objects.find(o => o.id === objectId);
    if (!obj) return;
    const id = `node-${Date.now()}`;
    const color = getNodeColor(pickerNodeType);
    const newNode: Node = {
      id,
      type: pickerNodeType,
      position: { x: 200 + Math.random() * 100, y: 150 + Math.random() * 100 },
      data: {
        objectId,
        name: obj.name,
        tableName: obj.name,
        sqlFragment: pickerNodeType === 'Source'
          ? `SELECT * FROM "${obj.name}"`
          : pickerNodeType === 'Transform'
          ? `SELECT * FROM previous_cte -- ${obj.name} 变换`
          : pickerNodeType === 'Control'
          ? `WHERE 1=1`
          : `SELECT * FROM previous_cte`,
        onDelete: (id: string) => handleDeleteNode(id)
      }
    };
    setNodes(nds => {
      const updated = [...nds, newNode];
      pushHistory(updated, edges);
      return updated;
    });
    setShowObjectPicker(false);
  }, [pickerNodeType, objects, edges, setNodes, handleDeleteNode, pushHistory]);

  // ── Auto Layout (Dagre LR) ──
  const handleAutoLayout = useCallback(() => {
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'LR', nodesep: 80, ranksep: 120 });
    g.setDefaultEdgeLabel(() => ({}));

    // Add nodes to layout
    const activeNodes = nodes.filter(n => n.type !== 'groupSpace');
    activeNodes.forEach(n => {
      g.setNode(n.id, { width: 200, height: 80 });
    });

    // Add edges to layout
    edges.forEach(e => {
      if (g.hasNode(e.source) && g.hasNode(e.target)) {
        g.setEdge(e.source, e.target);
      }
    });

    dagre.layout(g);

    // Apply computed layouts
    setNodes(nds => {
      const updated = nds.map(n => {
        if (n.type === 'groupSpace') return n;
        const layoutNode = g.node(n.id);
        if (layoutNode) {
          return {
            ...n,
            position: {
              x: layoutNode.x - layoutNode.width / 2,
              y: layoutNode.y - layoutNode.height / 2
            }
          };
        }
        return n;
      });
      pushHistory(updated, edges);
      return updated;
    });
  }, [nodes, edges, setNodes, pushHistory]);

  // ── MECE Layer AI Fill ──
  const handleMeceFill = async () => {
    if (objects.length === 0) {
      alert('请先在左侧面板添加至少一个对象后再使用 AI 填充');
      return;
    }
    setIsAIFilling(true);
    try {
      const plan: MeceCanvasLayoutPlan = await ontologyAiService.generateMeceCanvasLayout(
        activeLayer,
        objects.map(o => o.name),
        objectTypes.map(t => t.name),
        `MECE 分组设计及 SQL 生成`,
      );

      const builtNodes: Node[] = [];
      const builtEdges: Edge[] = [];
      const spaceColors = ['#a78bfa', '#38bdf8', '#4ade80', '#fb923c', '#f472b6', '#a3e635', '#fbbf24', '#60a5fa'];

      // 1. Build Group Spaces
      (plan.spaces || []).forEach((sp, si) => {
        const spaceId = sp.id || `mece-space-${si}`;
        builtNodes.push({
          id: spaceId,
          type: 'groupSpace',
          position: { x: sp.x ?? (50 + si * 380), y: sp.y ?? 50 },
          style: { width: sp.w ?? 340, height: sp.h ?? 300 },
          data: {
            title: sp.name || `空间 ${si + 1}`,
            color: sp.color || spaceColors[si % spaceColors.length],
            onDelete: (id: string) => handleDeleteNode(id)
          }
        });
      });

      // 2. Build Nodes Inside Spaces
      (plan.items || []).forEach((aiItem, itemIndex) => {
        const space = builtNodes.find(n => n.id === aiItem.spaceId) || builtNodes[0];
        const obj = objects.find(o => o.name === aiItem.objectName) || objects[itemIndex % objects.length];

        const nodeId = aiItem.id || `mece-node-${itemIndex}`;
        const nodeType = aiItem.nodeType || 'Source';

        // React Flow positions inside groups are relative to parent
        const relX = aiItem.x ?? 40;
        const relY = aiItem.y ?? (40 + (itemIndex % 3) * 80);

        builtNodes.push({
          id: nodeId,
          type: nodeType,
          position: { x: relX, y: relY },
          parentId: space?.id,
          extent: 'parent',
          data: {
            objectId: obj.id,
            name: aiItem.objectName,
            tableName: aiItem.metadata?.tableName || aiItem.objectName,
            sqlFragment: aiItem.metadata?.sqlFragment || `-- ${aiItem.objectName}`,
            metadata: {
              layerTag: activeLayer,
              tableName: aiItem.metadata?.tableName || aiItem.objectName
            },
            onDelete: (id: string) => handleDeleteNode(id)
          }
        });
      });

      // 3. Build Edges
      (plan.edges || []).forEach((edge, ei) => {
        const edgeColor = '#64748b';
        builtEdges.push({
          id: `mece-edge-${ei}`,
          source: edge.sourceId,
          target: edge.targetId,
          animated: true,
          style: { stroke: edgeColor, strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor }
        });
      });

      setNodes(builtNodes);
      setEdges(builtEdges);
      pushHistory(builtNodes, builtEdges);
    } catch (err) {
      console.error('[OntologyCanvas] MECE AI fill failed:', err);
      alert('AI 填充失败，请检查连接或配置');
    } finally {
      setIsAIFilling(false);
    }
  };

  const handleClearAll = useCallback(() => {
    if (confirm('确认清空画布？此操作不可逆。')) {
      setNodes([]);
      setEdges([]);
      setSelectedNode(null);
      pushHistory([], []);
    }
  }, [setNodes, setEdges, pushHistory]);

  // Update properties of the selected node
  const handleUpdateNodeData = (field: string, value: any) => {
    if (!selectedNode) return;
    setNodes(nds => nds.map(n => {
      if (n.id === selectedNode.id) {
        const updated = {
          ...n,
          data: {
            ...n.data,
            [field]: value
          }
        };
        // Update local reference to keep form synced
        setSelectedNode(updated);
        return updated;
      }
      return n;
    }));
  };

  const handleUpdateNodeGroupTitle = (value: string) => {
    if (!selectedNode) return;
    setNodes(nds => nds.map(n => {
      if (n.id === selectedNode.id) {
        const updated = {
          ...n,
          data: {
            ...n.data,
            title: value
          }
        };
        setSelectedNode(updated);
        return updated;
      }
      return n;
    }));
  };

  return (
    <div className="h-full w-full flex bg-[#0c0c12] relative text-slate-200" ref={reactFlowWrapper}>
      
      {/* ── Top Floating Toolbar ── */}
      <div className="absolute top-4 left-4 right-4 z-50 flex items-center justify-between pointer-events-none">
        
        {/* Main Actions Panel */}
        <div className="flex items-center gap-3 p-1.5 bg-[#171723]/95 backdrop-blur-xl border border-monokai-accent/15 rounded-2xl shadow-2xl pointer-events-auto">
          {/* Add actions */}
          <div className="flex items-center gap-1.5 px-1.5">
            <button onClick={() => openObjectPicker('Source')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-monokai-purple/10 border border-monokai-purple/20 text-monokai-purple hover:bg-monokai-purple/20 transition-all">
              <Plus className="w-3.5 h-3.5" /> Source
            </button>
            <button onClick={() => openObjectPicker('Transform')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-monokai-cyan/10 border border-monokai-cyan/20 text-monokai-cyan hover:bg-monokai-cyan/20 transition-all">
              <Plus className="w-3.5 h-3.5" /> Transform
            </button>
            <button onClick={() => openObjectPicker('Control')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-monokai-orange/10 border border-monokai-orange/20 text-monokai-orange hover:bg-monokai-orange/20 transition-all">
              <Plus className="w-3.5 h-3.5" /> Filter
            </button>
            <button onClick={() => openObjectPicker('Sink')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-monokai-green/10 border border-monokai-green/20 text-monokai-green hover:bg-monokai-green/20 transition-all">
              <Plus className="w-3.5 h-3.5" /> Sink
            </button>
            <button onClick={addGroupSpace}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-all">
              <Plus className="w-3.5 h-3.5" /> Group Space
            </button>
          </div>

          <div className="w-px h-6 bg-slate-800" />

          {/* Auto Layout */}
          <button onClick={handleAutoLayout} title="自动整理布局"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-slate-800" />

          {/* Undo */}
          <button onClick={handleUndo} disabled={historyIndex <= 0} title="撤销 (Ctrl+Z)"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#171723] hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-all">
            <Undo2 className="w-4 h-4" />
          </button>

          {/* Redo */}
          <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} title="重做 (Ctrl+Y)"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#171723] hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-all">
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* MECE Layer Segment Controls */}
        <div className="flex items-center gap-1 p-1 bg-[#171723]/95 backdrop-blur-xl border border-monokai-accent/15 rounded-2xl shadow-2xl pointer-events-auto">
          {(['foundation', 'relations', 'methodology', 'patterns', 'domains'] as MECELayer[]).map(layer => {
            const isActive = activeLayer === layer;
            const label = { foundation: '基础', relations: '关系', methodology: '方法论', patterns: '模式', domains: '领域' }[layer];
            return (
              <button
                key={layer}
                onClick={() => setActiveLayer(layer)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-monokai-purple/20 text-monokai-purple shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/55'
                }`}
              >
                {label}
              </button>
            );
          })}
          
          <div className="w-px h-6 bg-slate-800 mx-1" />

          {/* AI fill under layer */}
          <button onClick={handleMeceFill} disabled={isAIFilling}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-monokai-purple/20 border border-monokai-purple/30 text-monokai-purple hover:bg-monokai-purple/30 disabled:opacity-50 transition-all">
            <Sparkles className="w-3.5 h-3.5" />
            {isAIFilling ? '构建中...' : 'AI 填充'}
          </button>
        </div>

        {/* Action Panel Utilities */}
        <div className="flex items-center gap-1.5 p-1 bg-[#171723]/95 backdrop-blur-xl border border-monokai-accent/15 rounded-2xl shadow-2xl pointer-events-auto">
          <button onClick={() => setShowHelp(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all" title="指南">
            <HelpCircle className="w-4 h-4" />
          </button>
          <button onClick={handleClearAll}
            className="p-1.5 rounded-lg text-monokai-pink/80 hover:text-monokai-pink hover:bg-monokai-pink/10 transition-all" title="清空画布">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── React Flow Canvas Workspace ── */}
      <div className="flex-1 h-full w-full pointer-events-auto">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          onInit={setReactFlowInstance}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => setSelectedNode(node)}
          onPaneClick={() => setSelectedNode(null)}
          fitView
          onlyRenderVisibleElements={true}
        >
          <Background color="#64748b" gap={24} size={1} opacity={0.15} />
          <Controls className="react-flow__controls bg-[#171723] border border-slate-800 rounded-lg text-slate-400 shadow-xl" />
          <MiniMap
            nodeStrokeColor={(n) => getNodeColor(n.type || '')}
            nodeColor="#1a1a24"
            maskColor="rgba(0,0,0,0.6)"
            className="react-flow__minimap bg-[#171723]/90 border border-slate-800 rounded-lg shadow-xl"
          />
        </ReactFlow>
      </div>

      {/* ── Floating Real-time SQL Preview Panel (Right Bottom) ── */}
      {showSqlPanel && (
        <div className="absolute bottom-4 right-4 w-96 max-h-[380px] bg-[#12121e]/98 border border-monokai-accent/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-40 backdrop-blur-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-monokai-accent/10 bg-monokai-sidebar/35">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-monokai-cyan" />
              <span className="text-xs font-bold text-monokai-fg">SQL 拓扑实时预览</span>
            </div>
            <div className="flex items-center gap-1.5">
              {compileResult.success && onInsert && (
                <button
                  onClick={() => {
                    onInsert(compiledSql);
                    alert('已插入 SQL 到编辑器');
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-monokai-cyan/15 text-monokai-cyan hover:bg-monokai-cyan/25 text-[10px] font-bold transition-all"
                >
                  <Play className="w-2.5 h-2.5" /> 载入编辑器
                </button>
              )}
              <button onClick={() => setShowSqlPanel(false)} className="p-1 rounded text-slate-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4 font-mono text-[11px] leading-relaxed bg-black/25 text-slate-300 select-text">
            {compileResult.warnings.length > 0 && (
              <div className="mb-3 p-2 border border-monokai-orange/20 bg-monokai-orange/5 text-monokai-orange rounded-lg">
                <strong>拓扑警报：</strong>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  {compileResult.warnings.map((w, idx) => <li key={idx}>{w}</li>)}
                </ul>
              </div>
            )}
            <pre className="whitespace-pre-wrap">{compiledSql}</pre>
          </div>
        </div>
      )}

      {/* SQL Panel toggler */}
      {!showSqlPanel && (
        <button
          onClick={() => setShowSqlPanel(true)}
          className="absolute bottom-4 right-4 z-40 px-4 py-2 bg-[#171723] hover:bg-slate-800 border border-slate-700 rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold text-slate-200"
        >
          <FileText className="w-4 h-4 text-monokai-cyan" /> 展开 SQL 预览
        </button>
      )}

      {/* ── Floating Node Inspector Overlay Panel (Left Center) ── */}
      {selectedNode && (
        <div className="absolute top-24 left-4 w-72 bg-[#12121e]/98 border border-monokai-accent/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-40 backdrop-blur-2xl max-h-[75vh]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-monokai-accent/10 bg-monokai-sidebar/35">
            <span className="text-xs font-bold text-slate-200">属性配置 & 检查</span>
            <button onClick={() => setSelectedNode(null)} className="p-1 rounded text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          
          <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar">
            {selectedNode.type === 'groupSpace' ? (
              // Group Inspector Form
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-monokai-purple">空间名称</label>
                  <input
                    type="text"
                    value={selectedNode.data.title || ''}
                    onChange={(e) => handleUpdateNodeGroupTitle(e.target.value)}
                    className="w-full mt-1.5 px-3 py-2 bg-black/35 border border-slate-700 rounded-lg text-xs outline-none focus:border-monokai-purple/50 text-white"
                  />
                </div>
              </div>
            ) : (
              // Node Inspector Form
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-monokai-cyan">节点名称</label>
                  <input
                    type="text"
                    value={selectedNode.data.name || ''}
                    onChange={(e) => handleUpdateNodeData('name', e.target.value)}
                    className="w-full mt-1.5 px-3 py-2 bg-black/35 border border-slate-700 rounded-lg text-xs outline-none focus:border-monokai-cyan/50 text-white"
                  />
                </div>

                {selectedNode.type === 'Source' && (
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-monokai-purple">对应物理表</label>
                    <input
                      type="text"
                      value={selectedNode.data.tableName || ''}
                      onChange={(e) => handleUpdateNodeData('tableName', e.target.value)}
                      className="w-full mt-1.5 px-3 py-2 bg-black/35 border border-slate-700 rounded-lg text-xs outline-none focus:border-monokai-purple/50 text-white"
                    />
                  </div>
                )}

                {(selectedNode.type === 'Transform' || selectedNode.type === 'Control' || selectedNode.type === 'Sink') && (
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-monokai-yellow">SQL 片段 (Fragment)</label>
                    <textarea
                      value={selectedNode.data.sqlFragment || ''}
                      onChange={(e) => handleUpdateNodeData('sqlFragment', e.target.value)}
                      rows={5}
                      className="w-full mt-1.5 px-3 py-2 bg-black/35 border border-slate-700 rounded-lg text-xs font-mono outline-none focus:border-monokai-yellow/50 text-white resize-none"
                      placeholder={selectedNode.type === 'Control' ? '例如: WHERE age > 18' : 'SELECT * FROM previous_cte'}
                    />
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => handleDeleteNode(selectedNode.id)}
              className="w-full py-2 flex items-center justify-center gap-1.5 bg-monokai-pink/15 text-monokai-pink hover:bg-monokai-pink/25 border border-monokai-pink/20 rounded-xl text-xs font-bold transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" /> 移除节点
            </button>
          </div>
        </div>
      )}

      {/* ── Object Picker Dialog Modal ── */}
      {showObjectPicker && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm" onClick={() => setShowObjectPicker(false)}>
          <div className="w-[420px] bg-[#12121e] border border-monokai-accent/20 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-monokai-accent/10 flex items-center justify-between bg-monokai-sidebar/35">
              <div>
                <span className="text-sm font-bold text-slate-200">关联物理对象到画布</span>
                <p className="text-[10px] text-slate-400 mt-1">选择一个数据库或本体对象绑定到新建的 {pickerNodeType} 节点</p>
              </div>
              <button onClick={() => setShowObjectPicker(false)} className="p-1 rounded text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="max-h-[360px] overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {objects.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  物理本体库为空，请先在“实体库”中创建对象。
                </div>
              ) : (
                objects.map(obj => (
                  <button
                    key={obj.id}
                    onClick={() => handleSelectObject(obj.id)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-800/35 border border-slate-700/60 hover:bg-slate-700/50 hover:border-slate-600 transition-all text-left flex items-center justify-between"
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">{obj.name}</span>
                      <span className="text-[9px] text-monokai-purple/80 bg-monokai-purple/10 px-1.5 py-0.5 rounded mt-1.5 inline-block">
                        {objectTypes.find(ot => ot.id === obj.object_type_id)?.name || '未定义类型'}
                      </span>
                    </div>
                    <Plus className="w-4 h-4 text-monokai-cyan" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Custom Help Overlay Modal ── */}
      {showHelp && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setShowHelp(false)}>
          <div className="w-[500px] bg-[#12121e] border border-monokai-accent/20 rounded-2xl shadow-2xl p-6 overflow-hidden pointer-events-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-monokai-accent/10">
              <span className="text-sm font-bold text-slate-200">💡 画布重构版操作指南</span>
              <button onClick={() => setShowHelp(false)} className="p-1 rounded text-slate-400 hover:text-white"><X className="w-4.5 h-4.5" /></button>
            </div>
            
            <div className="space-y-4 text-xs text-slate-300 leading-relaxed overflow-y-auto max-h-[60vh] custom-scrollbar pr-1">
              <p>
                重构后的<strong>高阶画布</strong>基于 <strong>React Flow</strong> 实现。这是一个高度优化的无环向导图（DAG）生成器，用于可视化构建数据提取、转换和输出的 SQL 流水线。
              </p>
              
              <div className="space-y-2">
                <h4 className="font-bold text-monokai-cyan">1. 画布控制</h4>
                <ul className="list-disc list-inside space-y-1 pl-2 text-slate-400">
                  <li><strong>拖拽画布</strong>：在空白处按住鼠标左键并拖拽以平移视口。</li>
                  <li><strong>缩放视口</strong>：使用鼠标滚轮或双指在触摸板上缩放，或使用左下角缩放面板。</li>
                  <li><strong>选择节点</strong>：单击选择节点，将激活属性编辑框；双击可直接定位到重要属性。</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-monokai-purple">2. 构建 DAG 管道</h4>
                <ul className="list-disc list-inside space-y-1 pl-2 text-slate-400">
                  <li><strong>增加节点</strong>：在顶部工具栏点击 Source/Transform/Filter/Sink，从弹出窗中选择物理对象即可实例化入场。</li>
                  <li><strong>连接线</strong>：鼠标移到源节点右侧的圆形手写点（Handle）上拖出一条线，连接到目标节点的左侧即可创建依赖。</li>
                  <li><strong>分组空间</strong>：新建 Group Space 框，可将任意节点拖入其中进行逻辑嵌套（联动移动）。</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-monokai-green">3. 实时 SQL 翻译机制</h4>
                <p className="text-slate-400 pl-2">
                  任何节点、连线关系发生变动时，右下角的 SQL 编译预览看板都将实时生成 CTE (With 语法) 对齐的关系代码，支持一键直接载入 SQL 主编辑器执行。
                </p>
              </div>
            </div>
            
            <button onClick={() => setShowHelp(false)} className="mt-6 w-full py-2.5 bg-monokai-purple text-slate-900 rounded-xl font-bold hover:bg-monokai-purple/90 transition-all text-xs flex items-center justify-center gap-1.5">
              <Check className="w-4 h-4" /> 我明白了
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default OntologyCanvas;
