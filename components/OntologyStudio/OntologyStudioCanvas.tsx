import React, { useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Connection,
  Edge,
  Node,
  NodeChange,
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
  ReactFlowProvider,
  BackgroundVariant,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sparkles,
  Plus,
  Play,
  RotateCcw,
  LayoutGrid,
  Code2,
} from 'lucide-react';
import { useOntologyStudioStore } from '../../hooks/useOntologyStudioStore';
import { toastService } from '../../services/toastService';
import { OntologyEntityCard } from './OntologyEntityCard';
import { OntologyRelationEdge } from './OntologyRelationEdge';
import { EdgeTypeLegend } from './EdgeTypeLegend';

const nodeTypes = {
  ontologyEntity: OntologyEntityCard,
};

const edgeTypes = {
  ontologyRelation: OntologyRelationEdge,
};

const CanvasInner: React.FC<{ onInsertToEditor?: (sql: string) => void }> = ({
  onInsertToEditor,
}) => {
  const {
    entities,
    relations,
    selectedId,
    selectedType,
    selectElement,
    updateEntityPosition,
    addEntity,
    addRelation,
    autoLayout,
    compileToSql,
    loadPhysicalTables,
    physicalTables,
    importFromDuckDBTables,
    loadSampleCommerceModel,
    activeDeductionPath,
    hiddenCardinalities,
    isCardinalityVisible,
    setAllCardinalitiesVisible,
  } = useOntologyStudioStore();

  const { fitView, zoomIn, zoomOut } = useReactFlow();

  // Convert entities to ReactFlow nodes
  const flowNodes: Node[] = useMemo(() => {
    return entities.map((ent) => {
      const isDeductionActive = activeDeductionPath?.nodes.includes(ent.id);
      return {
        id: ent.id,
        type: 'ontologyEntity',
        position: ent.position || { x: 100, y: 100 },
        data: { entity: ent },
        selected: (selectedType === 'entity' && selectedId === ent.id) || isDeductionActive,
      };
    });
  }, [entities, selectedId, selectedType, activeDeductionPath]);

  // Convert relations to ReactFlow edges (filtered by hiddenCardinalities)
  const flowEdges: Edge[] = useMemo(() => {
    return relations
      .filter((rel) => isCardinalityVisible(rel.cardinality))
      .map((rel) => {
        const isDeductionEdgeActive = activeDeductionPath?.edges.includes(rel.id);
        const isSelected = selectedType === 'relation' && selectedId === rel.id;
        return {
          id: rel.id,
          source: rel.sourceEntityId,
          target: rel.targetEntityId,
          type: 'ontologyRelation',
          data: { relation: rel },
          selected: isSelected,
          animated: isDeductionEdgeActive,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 18,
            height: 18,
            color: isDeductionEdgeActive ? '#FBBF24' : isSelected ? '#66d9ef' : 'rgba(248, 248, 242, 0.65)',
          },
          style: isDeductionEdgeActive
            ? { stroke: '#FBBF24', strokeWidth: 3 }
            : undefined,
        };
      });
  }, [relations, selectedId, selectedType, activeDeductionPath, hiddenCardinalities, isCardinalityVisible]);

  // Handle dragging nodes
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      changes.forEach((change) => {
        if (change.type === 'position' && change.position && change.id) {
          updateEntityPosition(change.id, change.position);
        }
      });
    },
    [updateEntityPosition]
  );

  // Handle new connection between entities
  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;
      if (params.source === params.target) return;

      const sourceEnt = entities.find((e) => e.id === params.source);
      const targetEnt = entities.find((e) => e.id === params.target);

      const sourceField = sourceEnt?.primaryKey || 'id';
      const targetField = `${sourceEnt?.name.toLowerCase() || 'source'}_id`;

      addRelation({
        sourceEntityId: params.source,
        targetEntityId: params.target,
        name: `${sourceEnt?.name.toLowerCase()}_to_${targetEnt?.name.toLowerCase()}`,
        label: `${sourceEnt?.label || sourceEnt?.name} 关联 ${targetEnt?.label || targetEnt?.name}`,
        cardinality: '1:N',
        joinType: 'LEFT',
        sourceField,
        targetField,
      });
    },
    [entities, addRelation]
  );

  // Handle canvas background click to deselect
  const onPaneClick = useCallback(() => {
    selectElement(null, null);
  }, [selectElement]);

  const handleAutoDiscovery = async () => {
    await loadPhysicalTables();
    const currentTables = useOntologyStudioStore.getState().physicalTables;
    if (currentTables.length > 0) {
      await importFromDuckDBTables(currentTables.map((t) => t.name));
      toastService.success(`已从 DuckDB 自动发现并生成 ${currentTables.length} 个实体`);
      setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 100);
    } else {
      toastService.info('DuckDB 中暂无物理表，可使用左侧“模板”快速体验电商业务模型。');
    }
  };

  const handleAutoLayoutClick = () => {
    autoLayout('LR');
    setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 150);
  };

  const handleCompileAndRun = () => {
    const sql = compileToSql();
    if (onInsertToEditor) {
      onInsertToEditor(sql);
    }
  };

  return (
    <div className="relative w-full h-full bg-monokai-bg overflow-hidden">
      {/* Floating Canvas Action Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 p-1 rounded-md bg-monokai-surface/90 backdrop-blur-md border border-monokai-border shadow-md">
        <button
          onClick={() => addEntity()}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-monokai-accent hover:bg-monokai-accent-hover text-[#102022] font-semibold text-xs cursor-pointer transition-colors shadow-xs active:scale-98"
          title="添加业务实体"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>新建实体</span>
        </button>

        <button
          onClick={handleAutoLayoutClick}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-monokai-bg hover:bg-white/[0.06] text-monokai-fg border border-monokai-border text-xs font-medium cursor-pointer transition-colors shadow-xs"
          title="Dagre 智能拓扑自动排版"
        >
          <LayoutGrid className="w-3.5 h-3.5 text-monokai-accent" />
          <span>自动排版</span>
        </button>

        <button
          onClick={handleAutoDiscovery}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-monokai-bg hover:bg-white/[0.06] text-monokai-fg border border-monokai-border text-xs font-medium cursor-pointer transition-colors shadow-xs"
          title="从当前 DuckDB 物理表逆向推导实体与关联"
        >
          <Sparkles className="w-3.5 h-3.5 text-monokai-yellow" />
          <span>逆向推导</span>
        </button>

        <div className="w-[1px] h-4 bg-monokai-border mx-0.5" />

        <button
          onClick={handleCompileAndRun}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-monokai-accent/15 hover:bg-monokai-accent/25 text-monokai-accent border border-monokai-accent/30 text-xs font-medium cursor-pointer transition-colors shadow-xs"
          title="生成多表 CTE SQL 并送入 Workbench"
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>编译 CTE</span>
        </button>
      </div>

      {/* Floating Zoom / Fit Controls */}
      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-1 p-1 rounded-md bg-monokai-surface/90 backdrop-blur-md border border-monokai-border shadow-md">
        <button
          onClick={() => zoomIn()}
          className="p-1.5 rounded-md text-monokai-comment hover:text-monokai-fg hover:bg-white/[0.06] transition-colors cursor-pointer"
          title="放大"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => zoomOut()}
          className="p-1.5 rounded-md text-monokai-comment hover:text-monokai-fg hover:bg-white/[0.06] transition-colors cursor-pointer"
          title="缩小"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => fitView({ padding: 0.2, duration: 300 })}
          className="p-1.5 rounded-md text-monokai-comment hover:text-monokai-fg hover:bg-white/[0.06] transition-colors cursor-pointer"
          title="居中自适应"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Floating EdgeTypeLegend (Top-Right) */}
      {relations.length > 0 && <EdgeTypeLegend />}

      {/* Critical Banner: All Relations Hidden */}
      {relations.length > 0 && hiddenCardinalities.length >= 4 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 select-none pointer-events-none">
          <div className="px-5 py-4 rounded-lg bg-monokai-surface/95 backdrop-blur-md border-2 border-rose-500/40 shadow-xl pointer-events-auto max-w-md text-center space-y-2.5">
            <div className="flex items-center justify-center gap-2 text-rose-300">
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
              <span className="text-xs font-semibold tracking-wide uppercase">
                所有关系类型已隐藏
              </span>
            </div>
            <p className="text-xs text-monokai-fg-muted leading-relaxed">
              画布上的实体节点已加载，但所有 {relations.length} 条语义关联目前都被过滤掉。
              <br />
              颜色编码：<span className="text-monokai-green">1:1</span> /
              <span className="text-monokai-cyan"> 1:N </span> /
              <span className="text-monokai-orange"> N:1 </span> /
              <span className="text-monokai-pink"> N:M</span>
            </p>
            <button
              onClick={() => setAllCardinalitiesVisible()}
              className="px-3.5 py-1.5 rounded-md bg-monokai-accent hover:bg-monokai-accent-hover text-[#102022] font-semibold text-xs cursor-pointer transition-colors shadow-sm active:scale-98"
            >
              一键显示全部连线
            </button>
          </div>
        </div>
      )}

      {/* Empty State Overlay if canvas is completely empty */}
      {entities.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-1 pointer-events-none select-none">
          <div className="p-6 rounded-lg bg-monokai-surface/95 border border-monokai-border text-center max-w-md space-y-3.5 pointer-events-auto backdrop-blur-md shadow-lg">
            <Sparkles className="w-10 h-10 text-monokai-cyan mx-auto opacity-80 animate-pulse" />
            <h3 className="text-monokai-fg font-semibold text-sm">画布尚无业务实体</h3>
            <p className="text-xs text-monokai-comment leading-relaxed">
              您可以从左侧将 DuckDB 物理表加入模型，点击上方“逆向推导”，或点击下方载入电商模板体验。
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                onClick={() => addEntity()}
                className="px-3.5 py-1.5 rounded-md bg-monokai-accent hover:bg-monokai-accent-hover text-[#102022] font-semibold text-xs cursor-pointer transition-colors shadow-xs active:scale-98"
              >
                新建实体
              </button>
              <button
                onClick={() => handleAutoDiscovery()}
                className="px-3.5 py-1.5 rounded-md bg-monokai-bg hover:bg-white/[0.06] text-monokai-fg border border-monokai-border font-medium text-xs cursor-pointer transition-colors shadow-xs"
              >
                从物理表逆向分析
              </button>
              <button
                onClick={() => loadSampleCommerceModel()}
                className="px-3.5 py-1.5 rounded-md bg-monokai-surface hover:bg-monokai-hover text-monokai-fg hover:text-monokai-accent border border-monokai-border font-medium text-xs cursor-pointer transition-colors shadow-xs"
              >
                载入电商示例模型
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main ReactFlow Component */}
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color="rgba(248, 248, 242, 0.12)" />
        <MiniMap
          nodeColor={(node) => {
            const ent = (node.data as any)?.entity;
            return ent?.color || '#66d9ef';
          }}
          maskColor="rgba(30, 31, 28, 0.75)"
          className="!bottom-4 !right-4 !bg-monokai-sidebar !border !border-monokai-border !rounded-md overflow-hidden shadow-lg"
        />
      </ReactFlow>
    </div>
  );
};

export const OntologyStudioCanvas: React.FC<{ onInsertToEditor?: (sql: string) => void }> = (
  props
) => {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
};
