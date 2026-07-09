import dagre from 'dagre';
import { Node, Edge } from 'reactflow';

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

export const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  direction = 'LR',
  nodesep = 80,
  ranksep = 200
) => {
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: nodesep,   // Dynamically configured spacing between nodes in the same rank
    ranksep: ranksep,   // Dynamically configured spacing between columns
    marginx: 50,
    marginy: 50
  });

  // Reset graph components on each layout run
  dagreGraph.nodes().forEach(n => dagreGraph.removeNode(n));
  dagreGraph.edges().forEach(e => dagreGraph.removeEdge(e.v, e.w));

  nodes.forEach((node) => {
    const isExpanded = node.data?.isExpanded;
    const width = 220;
    const height = isExpanded ? 145 : 82;
    dagreGraph.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    if (node.data?.isLocked) {
      return node; // Preserve locked positions
    }

    const nodeWithPosition = dagreGraph.node(node.id);
    if (!nodeWithPosition) return node;

    const isExpanded = node.data?.isExpanded;
    const width = 220;
    const height = isExpanded ? 145 : 82;

    return {
      ...node,
      position: {
        x: Math.round(nodeWithPosition.x - width / 2),
        y: Math.round(nodeWithPosition.y - height / 2),
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};
