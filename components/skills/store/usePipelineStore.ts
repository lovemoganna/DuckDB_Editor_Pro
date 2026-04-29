import { create } from 'zustand';
import {
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  addEdge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
} from 'reactflow';

export interface PipelineState {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (node: Node) => void;
  clear: () => void;
}

export const usePipelineStore = create<PipelineState>((set, get) => ({
  nodes: [],
  edges: [],
  onNodesChange: (changes: NodeChange[]) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
  },
  onEdgesChange: (changes: EdgeChange[]) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },
  onConnect: (connection: Connection) => {
    set({
      edges: addEdge(
        {
          ...connection,
          animated: true,
          style: { stroke: '#a6e22e', strokeWidth: 2 }, // monokai green
        },
        get().edges
      ),
    });
  },
  setNodes: (nodes: Node[]) => {
    set({ nodes });
  },
  setEdges: (edges: Edge[]) => {
    set({ edges });
  },
  addNode: (node: Node) => {
    set({ nodes: [...get().nodes, node] });
  },
  clear: () => {
    set({ nodes: [], edges: [] });
  },
}));

/**
 * Non-hook store instance for use in callbacks / outside React components.
 * Use this instead of calling usePipelineStore.getState() inside closures
 * that may be detached from the React component lifecycle.
 */
export const pipelineStore = {
  getState: usePipelineStore.getState,
  setState: usePipelineStore.setState,
  subscribe: usePipelineStore.subscribe,
};
