import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
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
  Undo2, Redo2, Layers, CheckSquare, Square, Settings, Database, PlaySquare
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

import { useCanvasHistory } from './useCanvasHistory';
import { useCanvasPersistence } from './useCanvasPersistence';
import { CanvasHelpModal } from './CanvasHelpModal';
import { CanvasObjectPicker } from './CanvasObjectPicker';

const nodeTypes = {
  Source: SourceNode,
  Transform: TransformNode,
  Control: ControlNode,
  Sink: SinkNode,
  groupSpace: GroupSpaceNode
};

// Helper: Trace upstream physical tables for schema lookup
const getUpstreamTables = (nodeId: string, nodes: Node[], edges: Edge[]): string[] => {
  const tables: string[] = [];
  const visited = new Set<string>();

  const traverse = (currentId: string) => {
    if (visited.has(currentId)) return;
    visited.add(currentId);

    const node = nodes.find(n => n.id === currentId);
    if (!node) return;

    if (node.type === 'Source' && node.data.tableName) {
      tables.push(node.data.tableName);
    }

    const incoming = edges.filter(e => e.target === currentId);
    incoming.forEach(e => traverse(e.source));
  };

  traverse(nodeId);
  return tables;
};

export const OntologyCanvas: React.FC<{
  onInsert?: (sql: string) => void;
  onClose?: () => void;
  ontologyState?: any;
}> = ({ onInsert, onClose, ontologyState }) => {
  const store = useOntologyStore();
  const storeState = ontologyState ?? store.state;
  const { objects = [], objectTypes = [] } = storeState ?? {};

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [activeLayer, setActiveLayer] = useState<MECELayer>('foundation');
  const [showHelp, setShowHelp] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showSqlPanel, setShowSqlPanel] = useState(true);
  const [isAIFilling, setIsAIFilling] = useState(false);
  
  // Custom schema state for active node parameters
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [executingSink, setExecutingSink] = useState(false);
  const [showLayers, setShowLayers] = useState(false); // Collapsed by default to avoid clutter

  // Object picker modal states
  const [showObjectPicker, setShowObjectPicker] = useState(false);
  const [pickerNodeType, setPickerNodeType] = useState<NodeType>('Source');

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  // ── Undo/Redo Engine ──
  const {
    canUndo,
    canRedo,
    pushHistory,
    initHistory,
    undo: handleUndo,
    redo: handleRedo
  } = useCanvasHistory(nodes, edges, setNodes, setEdges);

  // ── Persistence Engine ──
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

  const { loading } = useCanvasPersistence(
    nodes,
    edges,
    setNodes,
    setEdges,
    activeLayer,
    initHistory,
    handleDeleteNode
  );

  const onNodeDragStop = useCallback(() => {
    pushHistory(nodes, edges);
  }, [nodes, edges, pushHistory]);

  // Load physical table columns for parameterization
  useEffect(() => {
    if (!selectedNode) {
      setAvailableColumns([]);
      return;
    }

    const loadColumns = async () => {
      const upstream = getUpstreamTables(selectedNode.id, nodes, edges);
      const cols = new Set<string>();
      for (const table of upstream) {
        try {
          const schema = await duckDBService.getTableSchema(table);
          schema.forEach((col: any) => cols.add(col.name));
        } catch (e) {
          console.error(e);
        }
      }
      setAvailableColumns(Array.from(cols));
    };

    loadColumns();
  }, [selectedNode, nodes, edges]);

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
        onDelete: handleDeleteNode
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
        onDelete: handleDeleteNode
      }
    };
    setNodes(nds => {
      const updated = [...nds, newNode];
      pushHistory(updated, edges);
      return updated;
    });
    setShowObjectPicker(false);
  }, [pickerNodeType, objects, edges, setNodes, handleDeleteNode, pushHistory]);

  // ── Auto Quick Pipeline Instantiation ──
  const handleQuickPipeline = useCallback((tableId: number) => {
    const obj = objects.find(o => o.id === tableId);
    if (!obj) return;
    
    const time = Date.now();
    const idSource = `node-source-${time}`;
    const idTransform = `node-transform-${time}`;
    const idFilter = `node-filter-${time}`;
    const idSink = `node-sink-${time}`;

    const newNodes: Node[] = [
      {
        id: idSource,
        type: 'Source',
        position: { x: 50, y: 180 },
        data: {
          objectId: tableId,
          name: obj.name,
          tableName: obj.name,
          sqlFragment: `SELECT * FROM "${obj.name}"`,
          onDelete: handleDeleteNode
        }
      },
      {
        id: idTransform,
        type: 'Transform',
        position: { x: 280, y: 180 },
        data: {
          objectId: tableId,
          name: `${obj.name}_选择列`,
          sqlFragment: `SELECT * FROM previous_cte`,
          metadata: { selectedColumns: [], isCustom: false },
          onDelete: handleDeleteNode
        }
      },
      {
        id: idFilter,
        type: 'Control',
        position: { x: 510, y: 180 },
        data: {
          objectId: tableId,
          name: `${obj.name}_数据筛选`,
          sqlFragment: `WHERE 1=1`,
          metadata: { filterColumn: '', filterOperator: '=', filterValue: '', isCustom: false },
          onDelete: handleDeleteNode
        }
      },
      {
        id: idSink,
        type: 'Sink',
        position: { x: 740, y: 180 },
        data: {
          objectId: tableId,
          name: `${obj.name}_保存表`,
          tableName: `${obj.name}_output`,
          sqlFragment: ``,
          metadata: { sinkTableName: `${obj.name}_output` },
          onDelete: handleDeleteNode
        }
      }
    ];

    const newEdges: Edge[] = [
      {
        id: `edge-1-${time}`,
        source: idSource,
        target: idTransform,
        animated: true,
        style: { stroke: '#38bdf8', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#38bdf8' }
      },
      {
        id: `edge-2-${time}`,
        source: idTransform,
        target: idFilter,
        animated: true,
        style: { stroke: '#fb923c', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#fb923c' }
      },
      {
        id: `edge-3-${time}`,
        source: idFilter,
        target: idSink,
        animated: true,
        style: { stroke: '#4ade80', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#4ade80' }
      }
    ];

    setNodes(newNodes);
    setEdges(newEdges);
    pushHistory(newNodes, newEdges);
    setShowObjectPicker(false);
  }, [objects, setNodes, setEdges, pushHistory, handleDeleteNode]);

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
            onDelete: handleDeleteNode
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
            onDelete: handleDeleteNode
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

  // Update visual parameters for column picker (Transform Node)
  const handleUpdateTransformColumns = (col: string, selected: boolean) => {
    if (!selectedNode) return;
    const currentMeta = selectedNode.data.metadata || {};
    const cols: string[] = currentMeta.selectedColumns || [];
    const nextCols = selected ? [...cols, col] : cols.filter(c => c !== col);
    
    const nextMeta = { ...currentMeta, selectedColumns: nextCols };
    const sqlFragment = nextMeta.isCustom
      ? selectedNode.data.sqlFragment
      : `SELECT ${nextCols.length > 0 ? nextCols.map(c => `"${c}"`).join(', ') : '*'} FROM previous_cte`;

    setNodes(nds => nds.map(n => {
      if (n.id === selectedNode.id) {
        const updated = {
          ...n,
          data: {
            ...n.data,
            sqlFragment,
            metadata: nextMeta
          }
        };
        setSelectedNode(updated);
        return updated;
      }
      return n;
    }));
  };

  // Update visual parameters for filter (Filter/Control Node)
  const handleUpdateFilterConfig = (key: 'filterColumn' | 'filterOperator' | 'filterValue' | 'isCustom', value: any) => {
    if (!selectedNode) return;
    const nextMeta = {
      ...(selectedNode.data.metadata || { filterColumn: '', filterOperator: '=', filterValue: '', isCustom: false }),
      [key]: value
    };

    let sqlFragment = selectedNode.data.sqlFragment;
    if (!nextMeta.isCustom) {
      if (nextMeta.filterColumn) {
        const valStr = isNaN(Number(nextMeta.filterValue)) ? `'${nextMeta.filterValue}'` : nextMeta.filterValue;
        sqlFragment = `WHERE "${nextMeta.filterColumn}" ${nextMeta.filterOperator} ${valStr}`;
      } else {
        sqlFragment = `WHERE 1=1`;
      }
    }

    setNodes(nds => nds.map(n => {
      if (n.id === selectedNode.id) {
        const updated = {
          ...n,
          data: {
            ...n.data,
            sqlFragment,
            metadata: nextMeta
          }
        };
        setSelectedNode(updated);
        return updated;
      }
      return n;
    }));
  };

  // Execute CTE query in DuckDB to actually build physical tables (Sink Node)
  const handleRunSinkPipeline = async () => {
    if (!selectedNode) return;
    const name = selectedNode.data.tableName || selectedNode.data.metadata?.sinkTableName;
    if (!name) {
      alert('请先在右侧配置目标表名！');
      return;
    }
    setExecutingSink(true);
    try {
      await duckDBService.query(`CREATE OR REPLACE TABLE "${name}" AS (${compiledSql})`);
      alert(`🎉 管道执行成功！物理表 "${name}" 已成功创建并写入数据！`);
    } catch (e: any) {
      alert(`执行失败: ${e.message}`);
    } finally {
      setExecutingSink(false);
    }
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-monokai-purple/10 border border-monokai-purple/20 text-monokai-purple hover:bg-monokai-purple/20 transition-all"
              title="关联一张物理数据库表">
              <Plus className="w-3.5 h-3.5" /> 导入数据源 (Source)
            </button>
            <button onClick={() => openObjectPicker('Transform')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-monokai-cyan/10 border border-monokai-cyan/20 text-monokai-cyan hover:bg-monokai-cyan/20 transition-all"
              title="增加列选择或数据转换节点">
              <Plus className="w-3.5 h-3.5" /> 选择列 (Transform)
            </button>
            <button onClick={() => openObjectPicker('Control')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-monokai-orange/10 border border-monokai-orange/20 text-monokai-orange hover:bg-monokai-orange/20 transition-all"
              title="增加数据过滤规则">
              <Plus className="w-3.5 h-3.5" /> 过滤条件 (Filter)
            </button>
            <button onClick={() => openObjectPicker('Sink')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-monokai-green/10 border border-monokai-green/20 text-monokai-green hover:bg-monokai-green/20 transition-all"
              title="设置导出或最终数据落表节点">
              <Plus className="w-3.5 h-3.5" /> 数据落表 (Sink)
            </button>
            <button onClick={addGroupSpace}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-all">
              <Plus className="w-3.5 h-3.5" /> 逻辑分组
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
          <button onClick={handleUndo} disabled={!canUndo} title="撤销 (Ctrl+Z)"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#171723] hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-all">
            <Undo2 className="w-4 h-4" />
          </button>

          {/* Redo */}
          <button onClick={handleRedo} disabled={!canRedo} title="重做 (Ctrl+Y)"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#171723] hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-all">
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Collapsible MECE layers - simplified UX */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => setShowLayers(prev => !prev)}
            className={`px-3 py-1.5 border rounded-2xl flex items-center gap-1.5 text-xs font-bold bg-[#171723]/95 backdrop-blur-xl transition-all shadow-2xl ${
              showLayers ? 'border-monokai-purple/55 text-monokai-purple' : 'border-slate-800 text-slate-400'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            AI MECE 分层设计 {showLayers ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>

          {showLayers && (
            <div className="flex items-center gap-1 p-1 bg-[#171723]/95 backdrop-blur-xl border border-monokai-accent/15 rounded-2xl shadow-2xl pointer-events-auto">
              {(['foundation', 'relations', 'methodology', 'patterns', 'domains'] as MECELayer[]).map(layer => {
                const isActive = activeLayer === layer;
                const label = { foundation: '基础', relations: '关系', methodology: '方法论', patterns: '模式', domains: '领域' }[layer];
                return (
                  <button
                    key={layer}
                    onClick={() => setActiveLayer(layer)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                      isActive
                        ? 'bg-monokai-purple/20 text-monokai-purple'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/55'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
              
              <div className="w-px h-5 bg-slate-800 mx-1" />

              <button onClick={handleMeceFill} disabled={isAIFilling}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-monokai-purple/20 border border-monokai-purple/30 text-monokai-purple hover:bg-monokai-purple/30 disabled:opacity-50 transition-all">
                <Sparkles className="w-3 h-3" />
                {isAIFilling ? 'AI 生成中...' : '生成'}
              </button>
            </div>
          )}
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
        <div className="absolute top-24 left-4 w-76 bg-[#12121e]/98 border border-monokai-accent/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-40 backdrop-blur-2xl max-h-[75vh]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-monokai-accent/10 bg-monokai-sidebar/35">
            <div className="flex items-center gap-1.5">
              <Settings className="w-4 h-4 text-monokai-cyan" />
              <span className="text-xs font-bold text-slate-200">可视化属性配置</span>
            </div>
            <button onClick={() => setSelectedNode(null)} className="p-1 rounded text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          
          <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar text-xs">
            
            {/* Generic Name Config */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">节点标识名称</label>
              <input
                type="text"
                value={selectedNode.type === 'groupSpace' ? (selectedNode.data.title || '') : (selectedNode.data.name || '')}
                onChange={(e) => selectedNode.type === 'groupSpace' ? handleUpdateNodeGroupTitle(e.target.value) : handleUpdateNodeData('name', e.target.value)}
                className="w-full px-3 py-2 bg-black/35 border border-slate-700 rounded-lg text-xs outline-none focus:border-monokai-cyan/50 text-white"
              />
            </div>

            {/* Parameterized View: Source Node */}
            {selectedNode.type === 'Source' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-monokai-purple block mb-1">物理数据表</label>
                  <select
                    value={selectedNode.data.tableName || ''}
                    onChange={(e) => {
                      const name = e.target.value;
                      handleUpdateNodeData('tableName', name);
                      handleUpdateNodeData('name', name);
                      handleUpdateNodeData('sqlFragment', `SELECT * FROM "${name}"`);
                    }}
                    className="w-full px-3 py-2 bg-black/35 border border-slate-700 rounded-lg text-xs text-white outline-none focus:border-monokai-purple/50 cursor-pointer"
                  >
                    <option value="" disabled>-- 选择物理数据库表 --</option>
                    {objects.map(obj => (
                      <option key={obj.id} value={obj.name}>{obj.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Parameterized View: Transform Node */}
            {selectedNode.type === 'Transform' && (
              <div className="space-y-3 border-t border-slate-800 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-monokai-cyan">列过滤器 (Column Filter)</span>
                  <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedNode.data.metadata?.isCustom || false}
                      onChange={(e) => {
                        const custom = e.target.checked;
                        handleUpdateNodeData('metadata', {
                          ...(selectedNode.data.metadata || {}),
                          isCustom: custom
                        });
                      }}
                      className="rounded border-slate-700 text-monokai-cyan focus:ring-0 bg-transparent"
                    />
                    自定义 SQL
                  </label>
                </div>

                {!selectedNode.data.metadata?.isCustom ? (
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1.5">勾选保留的字段 (默认全选)：</span>
                    <div className="max-h-[160px] overflow-y-auto border border-slate-800 bg-black/20 rounded-lg p-2 space-y-1">
                      {availableColumns.length === 0 ? (
                        <div className="text-[10px] text-slate-500 italic p-1">连线物理表源以获取字段</div>
                      ) : (
                        availableColumns.map(col => {
                          const isChecked = (selectedNode.data.metadata?.selectedColumns || []).includes(col);
                          return (
                            <button
                              key={col}
                              onClick={() => handleUpdateTransformColumns(col, !isChecked)}
                              className="w-full flex items-center gap-2 py-1 px-1.5 rounded hover:bg-slate-800/50 text-left text-[11px]"
                            >
                              {isChecked ? (
                                <CheckSquare className="w-3.5 h-3.5 text-monokai-cyan" />
                              ) : (
                                <Square className="w-3.5 h-3.5 text-slate-600" />
                              )}
                              <span className={isChecked ? 'text-monokai-fg font-bold' : 'text-slate-400'}>{col}</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-monokai-yellow block mb-1">自定义 SELECT 语句</label>
                    <textarea
                      value={selectedNode.data.sqlFragment || ''}
                      onChange={(e) => handleUpdateNodeData('sqlFragment', e.target.value)}
                      rows={5}
                      className="w-full px-3 py-2 bg-black/35 border border-slate-700 rounded-lg text-xs font-mono outline-none focus:border-monokai-yellow/50 text-white resize-none"
                      placeholder="SELECT col1, col2 FROM previous_cte"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Parameterized View: Filter Node */}
            {selectedNode.type === 'Control' && (
              <div className="space-y-3 border-t border-slate-800 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-monokai-orange">筛选器规则 (WHERE Clause)</span>
                  <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedNode.data.metadata?.isCustom || false}
                      onChange={(e) => handleUpdateFilterConfig('isCustom', e.target.checked)}
                      className="rounded border-slate-700 text-monokai-orange focus:ring-0 bg-transparent"
                    />
                    自定义 SQL
                  </label>
                </div>

                {!selectedNode.data.metadata?.isCustom ? (
                  <div className="space-y-2.5">
                    <div>
                      <label className="text-[9px] text-slate-400 block mb-1">筛选字段</label>
                      <select
                        value={selectedNode.data.metadata?.filterColumn || ''}
                        onChange={(e) => handleUpdateFilterConfig('filterColumn', e.target.value)}
                        className="w-full px-3 py-1.5 bg-black/35 border border-slate-700 rounded-lg text-[11px] text-white outline-none cursor-pointer focus:border-monokai-orange/50"
                      >
                        <option value="">-- 选择字段 --</option>
                        {availableColumns.map(col => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[9px] text-slate-400 block mb-1">比较符号</label>
                      <select
                        value={selectedNode.data.metadata?.filterOperator || '='}
                        onChange={(e) => handleUpdateFilterConfig('filterOperator', e.target.value)}
                        className="w-full px-3 py-1.5 bg-black/35 border border-slate-700 rounded-lg text-[11px] text-white outline-none cursor-pointer focus:border-monokai-orange/50"
                      >
                        <option value="=">等于 (=)</option>
                        <option value="!=">不等于 (!=)</option>
                        <option value=">">大于 (&gt;)</option>
                        <option value="<">小于 (&lt;)</option>
                        <option value=">=">大于等于 (&gt;=)</option>
                        <option value="<=">小于等于 (&lt;=)</option>
                        <option value="LIKE">包含 (LIKE)</option>
                        <option value="IS NULL">为空 (IS NULL)</option>
                        <option value="IS NOT NULL">不为空 (IS NOT NULL)</option>
                      </select>
                    </div>

                    {selectedNode.data.metadata?.filterOperator !== 'IS NULL' && selectedNode.data.metadata?.filterOperator !== 'IS NOT NULL' && (
                      <div>
                        <label className="text-[9px] text-slate-400 block mb-1">目标值 (文本请直接输入)</label>
                        <input
                          type="text"
                          value={selectedNode.data.metadata?.filterValue || ''}
                          onChange={(e) => handleUpdateFilterConfig('filterValue', e.target.value)}
                          placeholder="数值或文本，如：18 或 Active"
                          className="w-full px-3 py-1.5 bg-black/35 border border-slate-700 rounded-lg text-[11px] text-white outline-none focus:border-monokai-orange/50"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-monokai-yellow block mb-1">条件逻辑片段</label>
                    <textarea
                      value={selectedNode.data.sqlFragment || ''}
                      onChange={(e) => handleUpdateNodeData('sqlFragment', e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 bg-black/35 border border-slate-700 rounded-lg text-xs font-mono outline-none focus:border-monokai-yellow/50 text-white resize-none"
                      placeholder="WHERE age > 18 AND status = 'active'"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Parameterized View: Sink Node */}
            {selectedNode.type === 'Sink' && (
              <div className="space-y-4 border-t border-slate-800 pt-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-monokai-green block mb-1">持久化保存到 DuckDB 表</label>
                  <input
                    type="text"
                    value={selectedNode.data.tableName || selectedNode.data.metadata?.sinkTableName || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      handleUpdateNodeData('tableName', val);
                      handleUpdateNodeData('metadata', {
                        ...(selectedNode.data.metadata || {}),
                        sinkTableName: val
                      });
                    }}
                    placeholder="输入要保存的目标物理表名"
                    className="w-full px-3 py-2 bg-black/35 border border-slate-700 rounded-lg text-xs outline-none focus:border-monokai-green/50 text-white"
                  />
                </div>

                <button
                  onClick={handleRunSinkPipeline}
                  disabled={executingSink}
                  className="w-full py-2.5 flex items-center justify-center gap-2 bg-monokai-green text-slate-900 hover:bg-monokai-green/90 rounded-xl font-bold transition-all shadow-lg text-xs cursor-pointer disabled:opacity-50"
                >
                  <PlaySquare className="w-4 h-4" />
                  {executingSink ? '正在物理建表...' : '⚡ 执行并创建表 (Run & Create Table)'}
                </button>
              </div>
            )}

            {/* General Delete Action */}
            <button
              onClick={() => handleDeleteNode(selectedNode.id)}
              className="w-full py-2.5 flex items-center justify-center gap-1.5 bg-monokai-pink/15 text-monokai-pink hover:bg-monokai-pink/25 border border-monokai-pink/20 rounded-xl text-xs font-bold transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" /> 移除节点
            </button>
          </div>
        </div>
      )}

      {/* ── Object Picker Dialog Modal ── */}
      <CanvasObjectPicker
        show={showObjectPicker}
        onClose={() => setShowObjectPicker(false)}
        pickerNodeType={pickerNodeType}
        objects={objects}
        objectTypes={objectTypes}
        onSelectObject={handleSelectObject}
        onSelectPipeline={handleQuickPipeline}
      />

      {/* ── Custom Help Overlay Modal ── */}
      <CanvasHelpModal
        show={showHelp}
        onClose={() => setShowHelp(false)}
      />

    </div>
  );
};

export default OntologyCanvas;
