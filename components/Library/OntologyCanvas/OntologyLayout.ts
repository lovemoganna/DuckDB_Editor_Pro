import dagre from 'dagre';
import { Node, Edge } from 'reactflow';

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

// 1. Dagre Layering Layout (Flow layout)
export const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
  dagreGraph.setGraph({ rankdir: direction });

  // Reset graph components on each layout run
  dagreGraph.nodes().forEach(n => dagreGraph.removeNode(n));
  dagreGraph.edges().forEach(e => dagreGraph.removeEdge(e.v, e.w));

  nodes.forEach((node) => {
    const isCompact = node.data?.isCompact;
    const isExpanded = node.data?.isExpanded;
    const width = isCompact ? 160 : 220;
    const height = isCompact ? 42 : (isExpanded ? 145 : 82);
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

    const isCompact = node.data?.isCompact;
    const isExpanded = node.data?.isExpanded;
    const width = isCompact ? 160 : 220;
    const height = isCompact ? 42 : (isExpanded ? 145 : 82);

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

// 2. Concentric/Circular Layout
export const getCircularLayout = (nodes: Node[]) => {
  const updated = nodes.map(n => ({ ...n }));
  const unlockedNodes = updated.filter(n => !n.data?.isLocked);
  const count = unlockedNodes.length;
  if (count === 0) return { nodes: updated };

  const cx = 500;
  const cy = 350;
  const radius = Math.max(220, count * 35);

  unlockedNodes.forEach((node, index) => {
    const angle = (index / count) * 2 * Math.PI;
    node.position = {
      x: Math.round(cx + radius * Math.cos(angle) - 110),
      y: Math.round(cy + radius * Math.sin(angle) - 41),
    };
  });

  return { nodes: updated };
};

// 3. Grid Matrix Layout sorted by Entity Type
export const getGridLayout = (nodes: Node[]) => {
  const updated = nodes.map(n => ({ ...n }));
  const unlockedNodes = updated.filter(n => !n.data?.isLocked);
  const count = unlockedNodes.length;
  if (count === 0) return { nodes: updated };

  // Sort logically by Entity Type ID first, then name
  unlockedNodes.sort((a, b) => {
    const typeA = a.data?.obj?.object_type_id || 0;
    const typeB = b.data?.obj?.object_type_id || 0;
    if (typeA !== typeB) return typeA - typeB;
    return (a.data?.obj?.name || '').localeCompare(b.data?.obj?.name || '');
  });

  const cols = Math.ceil(Math.sqrt(count));
  const colWidth = 260;
  const rowHeight = 160;
  const startX = 120;
  const startY = 100;

  unlockedNodes.forEach((node, index) => {
    const c = index % cols;
    const r = Math.floor(index / cols);
    node.position = {
      x: startX + c * colWidth,
      y: startY + r * rowHeight,
    };
  });

  return { nodes: updated };
};
