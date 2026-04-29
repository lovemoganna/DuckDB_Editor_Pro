import React, { useCallback, useState, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  NodeTypes,
  Edge,
  Node,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { usePipelineStore, pipelineStore } from './store/usePipelineStore';
import SkillNode from './nodes/SkillNode';
import { Play, RotateCcw, Trash2, Loader2 } from 'lucide-react';
import { executeSkill } from '../../services/skillExecutor';
import { buildContext } from '../../services/skillRouter';

const nodeTypes: NodeTypes = {
  skill: SkillNode,
};

interface PipelineBuilderProps {
  currentTable?: string;
  currentColumns?: { name: string; type: string }[];
}

/**
 * Build an adjacency list and in-degree map from React Flow edges.
 */
function buildDAG(edges: Edge[]): { adj: Map<string, string[]>; inDeg: Map<string, number> } {
  const adj = new Map<string, string[]>();
  const inDeg = new Map<string, number>();

  for (const edge of edges) {
    const src = edge.source;
    const dst = edge.target;
    if (!adj.has(src)) adj.set(src, []);
    adj.get(src)!.push(dst);
    inDeg.set(dst, (inDeg.get(dst) ?? 0) + 1);
    if (!inDeg.has(src)) inDeg.set(src, 0);
  }
  return { adj, inDeg };
}

/**
 * Kahn's algorithm topological sort. Returns node IDs in execution order.
 * Falls back to x-position sort when no edges exist.
 */
function topologicalSort(nodeIds: string[], edges: Edge[]): string[] {
  if (edges.length === 0) {
    // No explicit edges — fall back to x-position (visual order)
    return nodeIds;
  }

  const { adj, inDeg } = buildDAG(edges);
  const queue: string[] = [];
  for (const id of nodeIds) {
    if ((inDeg.get(id) ?? 0) === 0) queue.push(id);
  }
  const result: string[] = [];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    result.push(curr);
    for (const neighbor of adj.get(curr) ?? []) {
      const deg = (inDeg.get(neighbor) ?? 1) - 1;
      inDeg.set(neighbor, deg);
      if (deg === 0) queue.push(neighbor);
    }
  }

  // Cycle or disconnected — append remaining nodes in original order
  if (result.length < nodeIds.length) {
    const remaining = nodeIds.filter(id => !result.includes(id));
    result.push(...remaining);
  }

  return result;
}

/**
 * Merge dataflow edges into execution context so downstream nodes
 * can see the resultSql of upstream nodes.
 */
function buildPipelineContext(
  nodeId: string,
  resultMap: Map<string, string>,
  currentTable?: string,
  currentColumns?: { name: string; type: string }[]
): Record<string, any> {
  const base: Record<string, any> = {};
  const sql = resultMap.get(nodeId);
  if (sql) {
    base['_pipelineInput'] = sql;
  }
  return base;
}

export const PipelineBuilder: React.FC<PipelineBuilderProps> = ({ currentTable, currentColumns }) => {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, setNodes, clear } = usePipelineStore();
  const [isRunning, setIsRunning] = useState(false);

  // Use a stable ref to avoid stale closures in callbacks
  const storeRef = useRef(pipelineStore);
  storeRef.current = pipelineStore;

  const runPipeline = useCallback(async () => {
    // Always read fresh state from store to avoid stale closure
    const currentNodes = storeRef.current.getState().nodes;
    if (currentNodes.length === 0) return;
    setIsRunning(true);

    // Determine execution order
    const nodeIds = currentNodes.map(n => n.id);
    const execOrder = topologicalSort(nodeIds, storeRef.current.getState().edges);

    // Track results for inter-node dataflow
    const resultMap = new Map<string, string>();

    // Reset all node statuses
    setNodes(currentNodes.map(n => ({ ...n, data: { ...n.data, status: 'idle', errorMessage: undefined, resultSql: undefined } })));

    for (const nodeId of execOrder) {
      const node = storeRef.current.getState().nodes.find(n => n.id === nodeId);
      if (!node) continue;

      // Mark running
      setNodes(storeRef.current.getState().nodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, status: 'running', errorMessage: undefined } } : n));

      // Build execution context: table + columns + pipeline input (from upstream result)
      const pipelineCtx = buildPipelineContext(nodeId, resultMap, currentTable, currentColumns);
      const baseContext = buildContext(currentTable, currentColumns || []);
      const mergedInputs = { ...node.data.inputs, ...pipelineCtx };

      try {
        const result = await executeSkill({
          skillId: node.data.skill.id,
          inputs: mergedInputs,
          context: baseContext,
          simulateOnly: false,
        });

        if (result.success && result.sql) {
          resultMap.set(nodeId, result.sql);
          const updated = storeRef.current.getState().nodes.map(n => n.id === nodeId
            ? { ...n, data: { ...n.data, status: 'success', resultSql: result.sql, errorMessage: undefined } }
            : n);
          setNodes(updated);
        } else {
          const updated = storeRef.current.getState().nodes.map(n => n.id === nodeId
            ? { ...n, data: { ...n.data, status: 'error', errorMessage: result.error || 'Unknown error' } }
            : n);
          setNodes(updated);
          break;
        }
      } catch (err: any) {
        const updated = storeRef.current.getState().nodes.map(n => n.id === nodeId
          ? { ...n, data: { ...n.data, status: 'error', errorMessage: err.message } }
          : n);
        setNodes(updated);
        break;
      }
    }

    setIsRunning(false);
  }, [currentTable, currentColumns, setNodes]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const skillDataStr = event.dataTransfer.getData('application/reactflow-skill');
      if (!skillDataStr) return;

      const skill = JSON.parse(skillDataStr);

      const reactFlowBounds = event.currentTarget.getBoundingClientRect();
      const position = {
        x: event.clientX - reactFlowBounds.left - 150,
        y: event.clientY - reactFlowBounds.top - 100,
      };

      const defaults: Record<string, any> = {};
      skill.inputSchema?.forEach((field: any) => {
        if (field.defaultValue !== undefined) {
          defaults[field.name] = field.defaultValue;
        }
      });

      const onChangeInput = (nodeId: string, fieldName: string, value: any) => {
        const { nodes: current, setNodes: setN } = storeRef.current.getState();
        setN(
          current.map((n) => {
            if (n.id === nodeId) {
              return {
                ...n,
                data: {
                  ...n.data,
                  inputs: { ...n.data.inputs, [fieldName]: value },
                },
              };
            }
            return n;
          })
        );
      };

      const newNode: Node = {
        id: `skill-${skill.id}-${Date.now()}`,
        type: 'skill',
        position,
        data: {
          skill,
          inputs: defaults,
          status: 'idle' as const,
          currentTable,
          currentColumns,
          onChangeInput,
        },
      };

      storeRef.current.getState().addNode(newNode);
    },
    [currentTable, currentColumns]
  );

  return (
    <div className="flex-1 flex flex-col bg-monokai-surface relative h-full w-full" onDragOver={handleDragOver} onDrop={handleDrop}>
      {/* Top Bar for Pipeline controls */}
      <div className="h-12 bg-monokai-bg border-b border-monokai-sidebar flex items-center justify-between px-4 z-10 shrink-0">
        <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-monokai-fg font-mono">PIPELINE BUILDER</span>
            <span className="text-[10px] text-monokai-comment bg-monokai-sidebar px-2 py-0.5 rounded border border-monokai-sidebar">
              {edges.length > 0 ? `${edges.length} edge(s) connected` : 'Drag & Drop Skills'}
            </span>
        </div>
        <div className="flex items-center gap-2">
            <button
                onClick={clear}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-monokai-pink text-monokai-pink hover:bg-monokai-pink hover:text-monokai-surface transition-colors"
                title="Clear Canvas"
            >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
            </button>
            <button
                onClick={runPipeline}
                disabled={isRunning || nodes.length === 0}
                className={`flex items-center gap-2 px-4 py-1.5 font-mono font-bold text-xs uppercase border ${
                    isRunning || nodes.length === 0
                      ? 'opacity-50 border-monokai-sidebar text-monokai-comment cursor-not-allowed'
                      : 'border-monokai-green text-monokai-green hover:bg-monokai-green hover:text-monokai-surface cursor-pointer'
                }`}
            >
                {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {isRunning ? 'Running...' : 'Run Pipeline'}
            </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 w-full h-full relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          className="!bg-monokai-surface"
        >
          <Background color="#3e3d32" gap={24} size={2} />
          <Controls className="[&_button]:!bg-monokai-bg [&_button]:!border-monokai-sidebar [&_circle]:!fill-monokai-fg [&_circle]:!stroke-monokai-sidebar [&_path]:!stroke-monokai-fg [&_path]:!stroke-monokai-sidebar [&_svg]:!fill-monokai-fg hover:[&_button]:!bg-monokai-sidebar" />
          <MiniMap
            nodeColor={(node) => {
              if (node.data?.status === 'running') return '#e6db74';
              if (node.data?.status === 'success') return '#a6e22e';
              if (node.data?.status === 'error') return '#f92672';
              return '#3e3d32';
            }}
            maskColor="rgba(30, 30, 30, 0.7)"
            style={{ backgroundColor: '#272822', border: '1px solid #3e3d32' }}
          />
        </ReactFlow>
      </div>
    </div>
  );
};
