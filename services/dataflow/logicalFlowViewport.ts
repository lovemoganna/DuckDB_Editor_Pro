import type { DataFlowNode } from './workflowTypes';
export const MIN_READABLE_FLOW_ZOOM = .85;

/** Start at the beginning of an oversized flow, keeping text readable. */
export function readableFlowViewport(nodes: DataFlowNode[], width: number, height: number) {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const absolute = (node: DataFlowNode): { x: number; y: number } => {
    const parent = node.parentNode ? byId.get(node.parentNode) : undefined;
    const offset = parent ? absolute(parent) : { x: 0, y: 0 };
    return { x: offset.x + node.position.x, y: offset.y + node.position.y };
  };
  const boxes = nodes.map(node => ({ ...absolute(node), width: Number(node.style?.width || node.width || 224), height: Number(node.style?.height || node.height || 74) }));
  if (!boxes.length || !width || !height) return null;
  const left = Math.min(...boxes.map(b => b.x)), top = Math.min(...boxes.map(b => b.y));
  const graphWidth = Math.max(...boxes.map(b => b.x + b.width)) - left;
  const graphHeight = Math.max(...boxes.map(b => b.y + b.height)) - top;
  const zoom = Math.min(1, Math.max(MIN_READABLE_FLOW_ZOOM, Math.min((width - 80) / graphWidth, (height - 100) / graphHeight)));
  return {
    zoom,
    x: (graphWidth * zoom < width - 80 ? (width - graphWidth * zoom) / 2 : 24) - left * zoom,
    y: (graphHeight * zoom < height - 100 ? (height - graphHeight * zoom) / 2 : 52) - top * zoom,
  };
}
