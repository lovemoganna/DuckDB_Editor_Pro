import React, { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
    Background,
    Controls,
    useNodesState,
    useEdgesState,
    Connection,
    Edge,
    addEdge,
    Node,
    MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';

interface CausalGraphProps {
    data: {
        nodes: Array<{ id: string, label: string }>;
        edges: Array<{ from: string, to: string, label: string, confidence?: number }>;
        narrative?: string;
    };
    correlations?: { columns: string[], matrix: number[][] };
}

const CausalGraph: React.FC<CausalGraphProps> = ({ data, correlations }) => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    // Simulation State
    const [isSimulating, setIsSimulating] = useState(false);
    const [deltas, setDeltas] = useState<Record<string, number>>({}); // % change
    const [selectedNode, setSelectedNode] = useState<string | null>(null);

    useEffect(() => {
        if (!data?.nodes || !data?.edges) return;

        // Layout Logic (Simple Circle)
        const radius = 250;
        const center = { x: 350, y: 300 };
        const count = data.nodes.length;

        // Initial Nodes
        const rfNodes: Node[] = data.nodes.map((node, index) => {
            const angle = (index / count) * 2 * Math.PI;
            return {
                id: node.id,
                position: {
                    x: center.x + radius * Math.cos(angle),
                    y: center.y + radius * Math.sin(angle)
                },
                data: { label: node.label },
                type: 'default',
                style: {
                    background: '#fff',
                    border: '1px solid #777',
                    borderRadius: '8px',
                    padding: '12px',
                    fontWeight: 'bold',
                    width: 160,
                    textAlign: 'center',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }
            };
        });

        // Edges
        const rfEdges: Edge[] = data.edges.map((edge, i) => {
            const label = edge.label || 'Relates';
            const isCausal = label.toLowerCase().includes('cause');

            return {
                id: `e-${edge.from}-${edge.to}-${i}`,
                source: edge.from,
                target: edge.to,
                label: label,
                animated: isCausal,
                style: { stroke: isCausal ? '#333' : '#aaa', strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed },
                type: 'smoothstep'
            };
        });

        setNodes(rfNodes);
        setEdges(rfEdges);

    }, [data]);

    // Update Node Styles based on Simulation
    useEffect(() => {
        setNodes((nds) => nds.map((node) => {
            const delta = deltas[node.id] || 0;
            let bg = '#fff';
            let border = '1px solid #777';
            let label = node.data.label;

            // Reset label to base before appending (hacky but works for simple case)
            if (typeof label === 'string' && label.includes('(')) {
                label = label.split(' (')[0];
            }

            if (isSimulating && delta !== 0) {
                if (delta > 0) {
                    bg = `rgba(16, 185, 129, ${Math.min(delta / 50, 0.8)})`; // Green
                    border = '2px solid #059669';
                    label = `${label} (+${delta.toFixed(1)}%)`;
                } else {
                    bg = `rgba(239, 68, 68, ${Math.min(Math.abs(delta) / 50, 0.8)})`; // Red
                    border = '2px solid #DC2626';
                    label = `${label} (${delta.toFixed(1)}%)`;
                }
            }

            return {
                ...node,
                data: { ...node.data, label },
                style: {
                    ...node.style,
                    background: bg,
                    border: border,
                    transition: 'all 0.3s ease'
                }
            };
        }));
    }, [deltas, isSimulating]);

    const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

    // Simulation Logic
    const handleSimulationChange = (nodeId: string, value: number) => {
        if (!correlations) return;

        const newDeltas: Record<string, number> = {};
        const queue: { id: string, rawDelta: number }[] = [];
        const visited = new Set<string>();

        // Init Source
        newDeltas[nodeId] = value;
        queue.push({ id: nodeId, rawDelta: value });
        visited.add(nodeId);

        // BFS Propagation
        while (queue.length > 0) {
            const { id, rawDelta } = queue.shift()!;

            // Find outgoing edges
            const children = data.edges.filter(e => e.from === id);

            for (const edge of children) {
                if (visited.has(edge.to)) continue; // Avoid cycles for now

                // Get Correlation Strength
                const idxA = correlations.columns.indexOf(id);
                const idxB = correlations.columns.indexOf(edge.to);

                let strength = 0.5; // Default if not found
                if (idxA >= 0 && idxB >= 0) {
                    strength = correlations.matrix[idxA][idxB] || 0;
                }

                // Effect = ParentDelta * Correlation
                // This is a naive linear approximation
                const effect = rawDelta * strength;

                if (Math.abs(effect) > 0.1) { // Threshold
                    newDeltas[edge.to] = (newDeltas[edge.to] || 0) + effect;
                    queue.push({ id: edge.to, rawDelta: effect });
                    visited.add(edge.to);
                }
            }
        }
        setDeltas(newDeltas);
    };

    return (
        <div className="w-full h-full min-h-[500px] border border-gray-200 rounded-lg bg-gray-50 flex flex-col relative">
            {/* Header / Controls */}
            <div className="p-3 bg-white border-b border-gray-200 flex justify-between items-center z-10 shadow-sm">
                <div className="flex items-center gap-4">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Causal Graph</span>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-700">🕹️ Simulation Mode</span>
                        <button
                            onClick={() => { setIsSimulating(!isSimulating); setDeltas({}); setSelectedNode(null); }}
                            className={`w-10 h-5 rounded-full flex items-center transition-colors px-1 ${isSimulating ? 'bg-blue-600 justify-end' : 'bg-gray-300 justify-start'}`}
                        >
                            <div className="w-3 h-3 bg-white rounded-full shadow-md"></div>
                        </button>
                    </div>
                </div>
                {isSimulating && (
                    <button onClick={() => setDeltas({})} className="text-xs text-red-500 font-bold hover:underline">Reset</button>
                )}
            </div>

            {/* Canvas */}
            <div className="flex-1 w-full h-full relative">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeClick={(_, node) => isSimulating && setSelectedNode(node.id)}
                    fitView
                >
                    <Background />
                    <Controls />
                </ReactFlow>

                {/* Simulation Overlay */}
                {isSimulating && selectedNode && (
                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur border border-gray-200 p-4 rounded-xl shadow-xl w-64 z-20">
                        <h4 className="font-bold text-gray-800 mb-2 text-sm">Adjust {selectedNode}</h4>
                        <div className="mb-4">
                            <div className="flex justify-between text-xs text-gray-500 mb-1">
                                <span>-50%</span>
                                <span className="font-bold text-blue-600">{(deltas[selectedNode] || 0).toFixed(0)}%</span>
                                <span>+50%</span>
                            </div>
                            <input
                                type="range"
                                min="-50" max="50"
                                value={deltas[selectedNode] || 0}
                                onChange={(e) => handleSimulationChange(selectedNode, Number(e.target.value))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                        </div>
                        <p className="text-[10px] text-gray-400 leading-tight">
                            Adjusting this factor will propagate effects to downstream nodes based on correlation strength.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export { CausalGraph };
