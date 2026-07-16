import dagre from 'dagre';
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
} from 'd3-force';
import { Edge, Node } from 'reactflow';

export type OntologyLayoutMode =
  | 'hierarchical'
  | 'orthogonal'
  | 'radial'
  | 'tree'
  | 'circular'
  | 'force';

export const ONTOLOGY_LAYOUTS: Array<{
  id: OntologyLayoutMode;
  label: string;
  description: string;
}> = [
  { id: 'hierarchical', label: '层级', description: '从左到右的关系分层' },
  { id: 'orthogonal', label: '正交', description: '对齐网格与正交连线' },
  { id: 'radial', label: '放射', description: '根节点向外逐层扩散' },
  { id: 'tree', label: '树形', description: '从上到下的紧凑树' },
  { id: 'circular', label: '环形', description: '稳定的环形顺序' },
  { id: 'force', label: '力导向', description: '根据连接密度聚合' },
];

interface Dimensions {
  width: number;
  height: number;
}

interface GraphModel {
  ids: string[];
  children: Map<string, string[]>;
  parents: Map<string, string[]>;
  roots: string[];
  depth: Map<string, number>;
}

const normalizeMode = (mode: string): OntologyLayoutMode => {
  if (mode === 'LR') return 'hierarchical';
  if (mode === 'TB') return 'tree';
  if (mode === 'RADIAL') return 'radial';
  if (ONTOLOGY_LAYOUTS.some((layout) => layout.id === mode)) return mode as OntologyLayoutMode;
  return 'hierarchical';
};

export const getOntologyNodeDimensions = (
  node: Node,
  nodeWidth = 220,
  nodeHeight = 82,
): Dimensions => {
  const width = Number(node.width ?? node.data?.nodeWidth ?? nodeWidth);
  const baseHeight = Number(node.height ?? node.data?.nodeHeight ?? nodeHeight);
  const height = node.data?.isExpanded && node.height == null ? baseHeight + 63 : baseHeight;
  return {
    width: Number.isFinite(width) && width > 0 ? width : nodeWidth,
    height: Number.isFinite(height) && height > 0 ? height : nodeHeight,
  };
};

const compareIds = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

const buildGraphModel = (nodes: Node[], edges: Edge[]): GraphModel => {
  const ids = nodes.map((node) => node.id).sort(compareIds);
  const idSet = new Set(ids);
  const children = new Map<string, string[]>();
  const parents = new Map<string, string[]>();
  ids.forEach((id) => {
    children.set(id, []);
    parents.set(id, []);
  });

  [...edges]
    .sort((a, b) => compareIds(a.id, b.id))
    .forEach((edge) => {
      if (!idSet.has(edge.source) || !idSet.has(edge.target) || edge.source === edge.target) return;
      if (!children.get(edge.source)!.includes(edge.target)) children.get(edge.source)!.push(edge.target);
      if (!parents.get(edge.target)!.includes(edge.source)) parents.get(edge.target)!.push(edge.source);
    });
  children.forEach((items) => items.sort(compareIds));
  parents.forEach((items) => items.sort(compareIds));

  let roots = ids.filter((id) => parents.get(id)!.length === 0);
  if (roots.length === 0 && ids.length > 0) {
    roots = [[...ids].sort((a, b) => {
      const degreeA = children.get(a)!.length + parents.get(a)!.length;
      const degreeB = children.get(b)!.length + parents.get(b)!.length;
      return degreeB - degreeA || compareIds(a, b);
    })[0]];
  }

  const depth = new Map<string, number>();
  const queue = roots.map((id) => ({ id, depth: 0 }));
  while (queue.length > 0) {
    const current = queue.shift()!;
    const known = depth.get(current.id);
    if (known != null && known <= current.depth) continue;
    depth.set(current.id, current.depth);
    children.get(current.id)!.forEach((child) => queue.push({ id: child, depth: current.depth + 1 }));
  }

  let disconnectedDepth = Math.max(0, ...depth.values()) + 1;
  ids.forEach((id) => {
    if (!depth.has(id)) depth.set(id, disconnectedDepth++);
  });
  return { ids, children, parents, roots, depth };
};

const snap = (value: number, grid = 10) => Math.round(value / grid) * grid;

const applyPositions = (
  nodes: Node[],
  positions: Map<string, { x: number; y: number }>,
  nodeWidth: number,
  nodeHeight: number,
) => nodes.map((node) => {
  if (node.data?.isLocked) return node;
  const position = positions.get(node.id);
  if (!position) return node;
  return { ...node, position: { x: snap(position.x), y: snap(position.y) } };
});

const layoutWithDagre = (
  nodes: Node[],
  edges: Edge[],
  rankdir: 'LR' | 'TB',
  nodesep: number,
  ranksep: number,
  nodeWidth: number,
  nodeHeight: number,
  orthogonal = false,
) => {
  const graph = new dagre.graphlib.Graph({ multigraph: true, compound: false });
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir,
    nodesep: Math.max(nodesep, orthogonal ? 100 : 70),
    ranksep: Math.max(ranksep, orthogonal ? 240 : 170),
    marginx: 40,
    marginy: 40,
    ranker: orthogonal ? 'tight-tree' : 'network-simplex',
    align: rankdir === 'LR' ? 'UL' : 'DL',
  });

  [...nodes].sort((a, b) => compareIds(a.id, b.id)).forEach((node) => {
    graph.setNode(node.id, getOntologyNodeDimensions(node, nodeWidth, nodeHeight));
  });
  [...edges].sort((a, b) => compareIds(a.id, b.id)).forEach((edge, index) => {
    if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
      graph.setEdge(edge.source, edge.target, {}, `${edge.id}-${index}`);
    }
  });
  dagre.layout(graph);

  const positions = new Map<string, { x: number; y: number }>();
  nodes.forEach((node) => {
    const point = graph.node(node.id);
    if (!point) return;
    const dimensions = getOntologyNodeDimensions(node, nodeWidth, nodeHeight);
    positions.set(node.id, {
      x: point.x - dimensions.width / 2,
      y: point.y - dimensions.height / 2,
    });
  });
  return applyPositions(nodes, positions, nodeWidth, nodeHeight);
};

const layoutRadial = (
  nodes: Node[],
  edges: Edge[],
  nodesep: number,
  ranksep: number,
  nodeWidth: number,
  nodeHeight: number,
) => {
  const model = buildGraphModel(nodes, edges);
  const layers = new Map<number, string[]>();
  model.depth.forEach((depth, id) => {
    if (!layers.has(depth)) layers.set(depth, []);
    layers.get(depth)!.push(id);
  });

  const positions = new Map<string, { x: number; y: number }>();
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const minArc = Math.max(nodeWidth, nodeHeight) + Math.max(60, nodesep * 0.6);
  const ringGap = Math.max(ranksep, nodeWidth + 100);
  let previousRadius = 0;

  [...layers.entries()].sort(([a], [b]) => a - b).forEach(([depth, ids]) => {
    ids.sort(compareIds);
    const circumferenceRadius = ids.length <= 1 ? 0 : (ids.length * minArc) / (Math.PI * 2);
    const radius = depth === 0 && ids.length === 1
      ? 0
      : Math.max(previousRadius + (depth === 0 ? 0 : ringGap), circumferenceRadius, depth * ringGap);
    previousRadius = radius;
    const step = (Math.PI * 2) / ids.length;
    const offset = -Math.PI / 2 + (depth % 2 ? step / 2 : 0);
    ids.forEach((id, index) => {
      const dimensions = getOntologyNodeDimensions(nodeById.get(id)!, nodeWidth, nodeHeight);
      positions.set(id, {
        x: Math.cos(offset + step * index) * radius - dimensions.width / 2,
        y: Math.sin(offset + step * index) * radius - dimensions.height / 2,
      });
    });
  });
  return applyPositions(nodes, positions, nodeWidth, nodeHeight);
};

const layoutCircular = (
  nodes: Node[],
  edges: Edge[],
  nodesep: number,
  nodeWidth: number,
  nodeHeight: number,
) => {
  if (nodes.length <= 1) return applyPositions(nodes, new Map(nodes.map((node) => [node.id, { x: 0, y: 0 }])), nodeWidth, nodeHeight);
  const model = buildGraphModel(nodes, edges);
  const order: string[] = [];
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    order.push(id);
    model.children.get(id)!.forEach(visit);
  };
  model.roots.forEach(visit);
  model.ids.forEach(visit);

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const widest = Math.max(...nodes.map((node) => getOntologyNodeDimensions(node, nodeWidth, nodeHeight).width));
  const radius = Math.max(260, (order.length * (widest + Math.max(nodesep, 70))) / (Math.PI * 2));
  const positions = new Map<string, { x: number; y: number }>();
  order.forEach((id, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / order.length;
    const dimensions = getOntologyNodeDimensions(nodeById.get(id)!, nodeWidth, nodeHeight);
    positions.set(id, {
      x: Math.cos(angle) * radius - dimensions.width / 2,
      y: Math.sin(angle) * radius - dimensions.height / 2,
    });
  });
  return applyPositions(nodes, positions, nodeWidth, nodeHeight);
};

const layoutTree = (
  nodes: Node[],
  edges: Edge[],
  nodesep: number,
  ranksep: number,
  nodeWidth: number,
  nodeHeight: number,
) => {
  const model = buildGraphModel(nodes, edges);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const primaryParent = new Map<string, string>();
  model.ids.forEach((id) => {
    const candidates = model.parents.get(id)!
      .filter((parent) => (model.depth.get(parent) ?? 0) < (model.depth.get(id) ?? 0))
      .sort((a, b) => (model.depth.get(a)! - model.depth.get(b)!) || compareIds(a, b));
    if (candidates[0]) primaryParent.set(id, candidates[0]);
  });
  const treeChildren = new Map(model.ids.map((id) => [id, [] as string[]]));
  primaryParent.forEach((parent, child) => treeChildren.get(parent)!.push(child));
  treeChildren.forEach((children) => children.sort(compareIds));

  const roots = model.ids.filter((id) => !primaryParent.has(id));
  const subtreeWidth = new Map<string, number>();
  const measure = (id: string): number => {
    const children = treeChildren.get(id)!;
    const ownWidth = getOntologyNodeDimensions(nodeById.get(id)!, nodeWidth, nodeHeight).width;
    if (children.length === 0) {
      subtreeWidth.set(id, ownWidth);
      return ownWidth;
    }
    const width = Math.max(ownWidth, children.reduce((sum, child) => sum + measure(child), 0) + (children.length - 1) * nodesep);
    subtreeWidth.set(id, width);
    return width;
  };
  roots.forEach(measure);

  const positions = new Map<string, { x: number; y: number }>();
  const place = (id: string, left: number, depth: number) => {
    const width = subtreeWidth.get(id)!;
    const dimensions = getOntologyNodeDimensions(nodeById.get(id)!, nodeWidth, nodeHeight);
    positions.set(id, { x: left + (width - dimensions.width) / 2, y: depth * Math.max(ranksep, nodeHeight + 120) });
    let childLeft = left;
    treeChildren.get(id)!.forEach((child) => {
      place(child, childLeft, depth + 1);
      childLeft += subtreeWidth.get(child)! + nodesep;
    });
  };
  let forestLeft = 0;
  roots.forEach((root) => {
    place(root, forestLeft, 0);
    forestLeft += subtreeWidth.get(root)! + Math.max(nodesep * 2, 140);
  });
  return applyPositions(nodes, positions, nodeWidth, nodeHeight);
};

interface ForceDatum {
  id: string;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
}

const seededRandom = (initialSeed: number) => {
  let seed = initialSeed >>> 0;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
};

const layoutForce = (
  nodes: Node[],
  edges: Edge[],
  nodesep: number,
  ranksep: number,
  nodeWidth: number,
  nodeHeight: number,
) => {
  if (nodes.length === 0) return nodes;
  const sortedNodes = [...nodes].sort((a, b) => compareIds(a.id, b.id));
  const radius = Math.max(220, sortedNodes.length * 28);
  const forceNodes: ForceDatum[] = sortedNodes.map((node, index) => ({
    id: node.id,
    x: Math.cos((index * Math.PI * 2) / sortedNodes.length) * radius,
    y: Math.sin((index * Math.PI * 2) / sortedNodes.length) * radius,
  }));
  const idSet = new Set(forceNodes.map((node) => node.id));
  const links = [...edges]
    .filter((edge) => idSet.has(edge.source) && idSet.has(edge.target) && edge.source !== edge.target)
    .sort((a, b) => compareIds(a.id, b.id))
    .map((edge) => ({ source: edge.source, target: edge.target }));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  const simulation = forceSimulation(forceNodes)
    .randomSource(seededRandom(0x51f15e))
    .force('link', forceLink<ForceDatum, { source: string | ForceDatum; target: string | ForceDatum }>(links)
      .id((node) => node.id)
      .distance(Math.max(ranksep, 230))
      .strength(0.35))
    .force('charge', forceManyBody().strength(-Math.max(700, nodes.length * 34)).distanceMax(900))
    .force('collision', forceCollide<ForceDatum>().radius((datum) => {
      const dimensions = getOntologyNodeDimensions(nodeById.get(datum.id)!, nodeWidth, nodeHeight);
      return Math.hypot(dimensions.width, dimensions.height) / 2 + Math.max(24, nodesep / 3);
    }).iterations(3))
    .force('center', forceCenter(0, 0))
    .force('x', forceX(0).strength(0.035))
    .force('y', forceY(0).strength(0.035))
    .stop();
  simulation.tick(320);

  const positions = new Map<string, { x: number; y: number }>();
  forceNodes.forEach((datum) => {
    const dimensions = getOntologyNodeDimensions(nodeById.get(datum.id)!, nodeWidth, nodeHeight);
    positions.set(datum.id, { x: datum.x - dimensions.width / 2, y: datum.y - dimensions.height / 2 });
  });
  return applyPositions(nodes, positions, nodeWidth, nodeHeight);
};

/**
 * Layout is calculated only in React Flow graph coordinates. Viewport pan and
 * zoom are intentionally absent so switching layouts is deterministic and so
 * the same positions can be used by the renderer and the exporter.
 */
export const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  requestedMode: OntologyLayoutMode | string = 'hierarchical',
  nodesep = 80,
  ranksep = 200,
  nodeWidth = 220,
  nodeHeight = 82,
) => {
  const mode = normalizeMode(requestedMode);
  let layoutedNodes: Node[];
  switch (mode) {
    case 'orthogonal':
      layoutedNodes = layoutWithDagre(nodes, edges, 'LR', nodesep, ranksep, nodeWidth, nodeHeight, true);
      break;
    case 'radial':
      layoutedNodes = layoutRadial(nodes, edges, nodesep, ranksep, nodeWidth, nodeHeight);
      break;
    case 'tree':
      layoutedNodes = layoutTree(nodes, edges, nodesep, ranksep, nodeWidth, nodeHeight);
      break;
    case 'circular':
      layoutedNodes = layoutCircular(nodes, edges, nodesep, nodeWidth, nodeHeight);
      break;
    case 'force':
      layoutedNodes = layoutForce(nodes, edges, nodesep, ranksep, nodeWidth, nodeHeight);
      break;
    case 'hierarchical':
    default:
      layoutedNodes = layoutWithDagre(nodes, edges, 'LR', nodesep, ranksep, nodeWidth, nodeHeight);
      break;
  }
  return { nodes: layoutedNodes, edges };
};
