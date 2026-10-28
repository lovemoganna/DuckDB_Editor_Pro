/**
 * components/ExecutionPlan/layout/planLayout.ts
 *
 * Auto Layout Engine for DuckDB Execution Plan Graphs.
 * Pure computation layer using Dagre to generate coordinate topologies.
 * Decoupled from React, DOM, and SVG rendering.
 */

import dagre from 'dagre';
import {
  ExecutionPlanGraph,
  LayoutDirection,
  LayoutNode,
  LayoutEdge,
  LayoutResult,
} from '../model/types';

export const NODE_WIDTH = 260;
export const NODE_HEIGHT = 100;
export const NODE_SEP = 48;
export const RANK_SEP = 64;

export function computeGraphLayout(
  graph: ExecutionPlanGraph,
  direction: LayoutDirection = 'LR'
): LayoutResult {
  const layoutNodes = new Map<string, LayoutNode>();
  const layoutEdges: LayoutEdge[] = [];

  if (!graph || graph.nodes.size === 0) {
    return {
      nodes: layoutNodes,
      edges: layoutEdges,
      width: 0,
      height: 0,
      direction,
    };
  }

  const isHorizontal = direction === 'LR' || direction === 'RL';

  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: direction,
    nodesep: isHorizontal ? 40 : NODE_SEP,
    ranksep: isHorizontal ? 72 : RANK_SEP,
    marginx: 40,
    marginy: 40,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes to Dagre
  for (const [nodeId] of graph.nodes) {
    g.setNode(nodeId, {
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    });
  }

  // Add edges to Dagre
  // Note: For Bottom-to-Top (BT) and Left-to-Right (LR), edges flow along the data stream
  // from source (child producer) to target (parent consumer).
  // For Top-to-Bottom (TB) and Right-to-Left (RL), edges flow from root to leaf.
  for (const edge of graph.edges) {
    if (graph.nodes.has(edge.source) && graph.nodes.has(edge.target)) {
      if (direction === 'BT' || direction === 'LR') {
        g.setEdge(edge.source, edge.target);
      } else {
        g.setEdge(edge.target, edge.source);
      }
    }
  }

  // Run Dagre layout calculation
  dagre.layout(g);

  // Extract layout coordinates
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const nodeId of graph.nodes.keys()) {
    const dagreNode = g.node(nodeId);
    if (!dagreNode) continue;

    const x = dagreNode.x;
    const y = dagreNode.y;
    const w = dagreNode.width || NODE_WIDTH;
    const h = dagreNode.height || NODE_HEIGHT;

    layoutNodes.set(nodeId, {
      id: nodeId,
      x,
      y,
      width: w,
      height: h,
    });

    minX = Math.min(minX, x - w / 2);
    minY = Math.min(minY, y - h / 2);
    maxX = Math.max(maxX, x + w / 2);
    maxY = Math.max(maxY, y + h / 2);
  }

  // Extract edge paths
  for (const edge of graph.edges) {
    const dagreEdge = direction === 'BT'
      ? g.edge(edge.source, edge.target)
      : g.edge(edge.target, edge.source);

    let points: { x: number; y: number }[] = [];

    if (dagreEdge && Array.isArray(dagreEdge.points) && dagreEdge.points.length > 0) {
      points = dagreEdge.points.map(pt => ({ x: pt.x, y: pt.y }));
      if (direction === 'TB') {
        // Reverse points so source to target is consistent with dataflow
        points = [...points].reverse();
      }
    } else {
      // Fallback: connect center of source to center of target
      const srcNode = layoutNodes.get(edge.source);
      const tgtNode = layoutNodes.get(edge.target);
      if (srcNode && tgtNode) {
        points = [
          { x: srcNode.x, y: srcNode.y },
          { x: tgtNode.x, y: tgtNode.y },
        ];
      }
    }

    layoutEdges.push({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      points,
      relativeWidth: edge.relativeWidth,
      rows: edge.rows,
    });
  }

  const boundingWidth = Number.isFinite(maxX) && Number.isFinite(minX) ? Math.max(800, maxX - minX + 80) : 800;
  const boundingHeight = Number.isFinite(maxY) && Number.isFinite(minY) ? Math.max(600, maxY - minY + 80) : 600;

  return {
    nodes: layoutNodes,
    edges: layoutEdges,
    width: boundingWidth,
    height: boundingHeight,
    direction,
  };
}
