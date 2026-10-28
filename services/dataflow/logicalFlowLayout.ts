import type ELK from "elkjs/lib/elk.bundled.js";
import type {
  ElkNode,
  ElkExtendedEdge,
} from "elkjs/lib/elk.bundled.js";
import type { FlowData } from "./logicalRelationFlowTypes";
import { logicalFlowToCanvas } from "./logicalRelationFlowParser";
import type { DataFlowNode, DataFlowEdge } from "./workflowTypes";
import { Position } from "reactflow";
import { MIN_READABLE_FLOW_ZOOM } from './logicalFlowViewport';
import { layoutForceBoundaries, routeAroundNodes } from './logicalFlowForce';

export type LogicalFlowLayoutMode = 'auto' | 'horizontal' | 'vertical' | 'tree' | 'force';
export const LOGICAL_FLOW_LAYOUTS: Array<{ value: LogicalFlowLayoutMode; label: string }> = [
  { value: 'auto', label: '自动' },
  { value: 'horizontal', label: '横向' },
  { value: 'vertical', label: '纵向' },
  { value: 'tree', label: '树形' },
  { value: 'force', label: '力导向' },
];

let elkPromise: Promise<InstanceType<typeof ELK>> | undefined;
function loadLayoutEngine() {
  return elkPromise ||= import('elkjs/lib/elk.bundled.js').then(module => new module.default()).catch(error => {
    elkPromise = undefined;
    throw error;
  });
}
export type NodeMeasurements = Map<string, { width: number; height: number }>;
/** Compound boundaries and explicit ports are laid out together with all semantic edges. */
export async function layoutLogicalFlow(
  flow: FlowData,
  sizes: NodeMeasurements = new Map(),
  viewportWidth = 1000,
  mode: LogicalFlowLayoutMode = 'auto',
): Promise<{ nodes: DataFlowNode[]; edges: DataFlowEdge[] }> {
  const canvas = logicalFlowToCanvas(flow);
  if (!canvas.nodes.length) return canvas;
  // Estimate the longest forward chain, not the total number of branch nodes.
  const depth = new Map<string, number>();
  const visiting = new Set<string>();
  const chainDepth = (id: string): number => {
    if (depth.has(id)) return depth.get(id)!;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const incoming = canvas.edges.filter(e => e.target === id && e.data?.flowKind !== 'recursive_back');
    const value = 1 + Math.max(0, ...incoming.map(e => chainDepth(e.source)));
    visiting.delete(id);
    depth.set(id, value);
    return value;
  };
  const longestChain = Math.max(...canvas.nodes.map(n => chainDepth(n.id)));
  const widest = Math.max(...canvas.nodes.map(n => sizes.get(n.id)?.width || 224));
  const vertical = mode === 'vertical' || mode === 'tree' || (mode === 'auto' && longestChain > 3 && longestChain * (widest + 52) - 52 + 120 > Math.max(320, viewportWidth) / MIN_READABLE_FLOW_ZOOM);
  const direction = vertical ? 'DOWN' : 'RIGHT';
  for (const node of canvas.nodes) {
    node.data.flowDirection = direction;
    node.sourcePosition = vertical ? Position.Bottom : Position.Right;
    node.targetPosition = vertical ? Position.Top : Position.Left;
  }
  const used = new Set<string>();
  const byBoundary = new Map(flow.boundaries.map((b) => [b.id, b]));
  for (const node of canvas.nodes) {
    let parent = node.data.boundaryId;
    while (parent && !used.has(parent)) {
      used.add(parent);
      parent = byBoundary.get(parent)?.parentBoundaryId;
    }
  }
  const groups = new Map<string, ElkNode>();
  const options = {
    "elk.algorithm": "layered",
    "elk.direction": direction,
    "elk.edgeRouting": "ORTHOGONAL",
    "elk.hierarchyHandling": "INCLUDE_CHILDREN",
    "elk.spacing.nodeNode": mode === 'tree' ? "64" : "28",
    "elk.layered.spacing.nodeNodeBetweenLayers": mode === 'tree' ? "80" : "52",
    "elk.layered.nodePlacement.strategy": mode === 'tree' ? "BRANDES_KOEPF" : "NETWORK_SIMPLEX",
    "elk.layered.nodePlacement.bk.fixedAlignment": mode === 'tree' ? "BALANCED" : "NONE",
    "elk.randomSeed": "1",
    "elk.aspectRatio": "0.15",
    "elk.layered.considerModelOrder.components": "MODEL_ORDER",
    "elk.padding": "[top=36,left=20,bottom=20,right=20]",
  };
  flow.boundaries
    .filter((b) => used.has(b.id))
    .forEach((b) =>
      groups.set(b.id, {
        id: b.id,
        children: [],
        layoutOptions: {
          ...options,
          "elk.direction": direction,
        },
      }),
    );
  const root: ElkNode = {
    id: "logical-flow",
    children: [],
    edges: [],
    layoutOptions: { ...options, "elk.direction": direction },
  };
  for (const b of flow.boundaries) {
    const g = groups.get(b.id);
    if (g) (groups.get(b.parentBoundaryId || "") || root).children!.push(g);
  }
  for (const node of canvas.nodes) {
    const size = sizes.get(node.id) || { width: 224, height: 74 };
    const handles =
      node.data.type === "join"
        ? ["input", "left", "right", "output"]
        : ["input", "output"];
    const ports = handles.map((handle) => ({
      id: `${node.id}:${handle}`,
      width: 0,
      height: 0,
      x: vertical ? size.width * (handle === 'left' ? .35 : handle === 'right' ? .65 : .5) : handle === "output" ? size.width : 0,
      y:
        vertical ? (handle === 'output' ? size.height : 0) : size.height *
        (handle === "left" ? 0.35 : handle === "right" ? 0.65 : 0.5),
      layoutOptions: { "elk.port.side": vertical ? (handle === 'output' ? 'SOUTH' : 'NORTH') : handle === "output" ? "EAST" : "WEST" },
    }));
    (groups.get(node.data.boundaryId || "") || root).children!.push({
      id: node.id,
      ...size,
      ports,
      layoutOptions: { "elk.portConstraints": "FIXED_POS" },
    });
  }
  const boundaryAncestors = (node: DataFlowNode) => {
    const result = ["logical-flow"];
    let id = node.data.boundaryId;
    while (id) {
      result.splice(1, 0, id);
      id = byBoundary.get(id)?.parentBoundaryId;
    }
    return result;
  };
  for (const edge of canvas.edges) {
    // Feedback is routed around its component after layering the forward graph.
    // ELK's compound cycle reversal cannot safely reverse cross-hierarchy ports.
    if (edge.data?.flowKind === "recursive_back") continue;
    const source = canvas.nodes.find((n) => n.id === edge.source),
      target = canvas.nodes.find((n) => n.id === edge.target);
    if (!source || !target) throw new Error(`Dangling logical edge ${edge.id}`);
    const sa = boundaryAncestors(source),
      ta = new Set(boundaryAncestors(target));
    const common = sa.filter((id) => ta.has(id)).at(-1)!;
    const e: ElkExtendedEdge = {
      id: edge.id,
      sources: [`${edge.source}:output`],
      targets: [`${edge.target}:${edge.targetHandle || "input"}`],
    };
    const container = groups.get(common) || root;
    (container.edges ||= []).push(e);
  }
  const result = mode === 'force' ? layoutForceBoundaries(root, canvas.edges) : await (await loadLayoutEngine()).layout(root);
  const nodes: DataFlowNode[] = [],
    edgeRoutes = new Map<string, Array<{ x: number; y: number }>>();
  const absolute = new Map<
    string,
    { x: number; y: number; width: number; height: number }
  >();
  const visit = (g: ElkNode, parent?: string, absoluteX = 0, absoluteY = 0) => {
    const x = absoluteX + (g.x || 0),
      y = absoluteY + (g.y || 0);
    absolute.set(g.id, { x, y, width: g.width || 0, height: g.height || 0 });
    if (g.id !== root.id) {
      const original = canvas.nodes.find((n) => n.id === g.id),
        b = byBoundary.get(g.id);
      if (original)
        nodes.push({
          ...original,
          position: { x: g.x || 0, y: g.y || 0 },
          parentNode: parent === root.id ? undefined : parent,
          extent: parent === root.id ? undefined : "parent",
          width: g.width,
          height: g.height,
        });
      else if (b)
        nodes.push({
          id: g.id,
          type: "logicalBoundary",
          position: { x: g.x || 0, y: g.y || 0 },
          parentNode: parent === root.id ? undefined : parent,
          selectable: false,
          draggable: false,
          style: { width: g.width, height: g.height },
          data: {
            id: g.id,
            type: "schema",
            title: b.name || b.kind,
            status: "idle",
            config: b,
            logicalKind: "boundary",
            statementId: flow.nodes.find((n) => n.id === b.id)?.statementId,
          },
        });
    }
    for (const e of g.edges || []) {
      const points = (e.sections || [])
        .flatMap((s) => [s.startPoint, ...(s.bendPoints || []), s.endPoint])
        .map((p) => ({ x: p.x + x, y: p.y + y }));
      if (points.length) edgeRoutes.set(e.id, points);
    }
    for (const child of g.children || []) visit(child, g.id, x, y);
  };
  visit(result);
  // ELK packs disconnected compounds by area, even when model order is requested.
  // Repack whole disconnected Statement components in source order. Each component
  // keeps its ELK geometry and routes; translations use computed extents, not slots.
  const statementIds = flow.statements.map((s) => s.id);
  const roots = new Map(statementIds.map((id) => [id, id]));
  const find = (id: string): string =>
    roots.get(id) === id ? id : find(roots.get(id)!);
  for (const edge of canvas.edges) {
    const source = canvas.nodes.find((n) => n.id === edge.source)?.data
      .statementId;
    const target = canvas.nodes.find((n) => n.id === edge.target)?.data
      .statementId;
    if (source && target && source !== target)
      roots.set(find(target), find(source));
  }
  const componentsByStatement = new Map<string, string[]>();
  for (const id of statementIds) {
    const key = find(id);
    const list = componentsByStatement.get(key) || [];
    list.push(id);
    componentsByStatement.set(key, list);
  }
  const shifts = new Map<string, { x: number; y: number }>();
  let cursorY = 36,
    contentWidth = 0;
  for (const ids of componentsByStatement.values()) {
    const groups = ids
      .map((id) =>
        nodes.find(
          (n) => n.id === flow.statements.find((s) => s.id === id)!.boundaryId,
        ),
      )
      .filter((n): n is DataFlowNode => !!n);
    if (!groups.length) continue;
    const left = Math.min(...groups.map((n) => n.position.x)),
      top = Math.min(...groups.map((n) => n.position.y));
    const right = Math.max(
        ...groups.map((n) => n.position.x + Number(n.style?.width)),
      ),
      bottom = Math.max(
        ...groups.map((n) => n.position.y + Number(n.style?.height)),
      );
    const shift = { x: 20 - left, y: cursorY - top };
    for (const id of ids) shifts.set(id, shift);
    for (const group of groups)
      group.position = {
        x: group.position.x + shift.x,
        y: group.position.y + shift.y,
      };
    contentWidth = Math.max(contentWidth, right - left);
    cursorY += bottom - top + 28;
  }
  for (const node of nodes) {
    const shift = shifts.get(node.data.statementId || "");
    const box = absolute.get(node.id);
    if (shift && box) {
      box.x += shift.x;
      box.y += shift.y;
    }
  }
  for (const edge of canvas.edges) {
    const statement = canvas.nodes.find((n) => n.id === edge.source)?.data
      .statementId;
    const shift = shifts.get(statement || "");
    const points = edgeRoutes.get(edge.id);
    if (shift && points)
      edgeRoutes.set(
        edge.id,
        points.map((p) => ({ x: p.x + shift.x, y: p.y + shift.y })),
      );
  }
  const connection = nodes.find(
    (n) => byBoundary.get(n.id)?.kind === "connection",
  );
  if (connection) {
    connection.style = {
      ...connection.style,
      width: contentWidth + 40,
      height: cursorY - 28 + 20,
    };
  }
  const components = stronglyConnectedComponents(
    canvas.nodes.map((n) => n.id),
    canvas.edges,
  );
  let feedbackIndex = 0;
  for (const edge of canvas.edges.filter(
    (e) => e.data?.flowKind === "recursive_back",
  )) {
    const component = components.find(
      (c) => c.includes(edge.source) && c.includes(edge.target),
    ) || [edge.source, edge.target];
    const boxes = component.map((id) => absolute.get(id)!);
    const source = absolute.get(edge.source)!,
      target = absolute.get(edge.target)!;
    const gap = 10 + feedbackIndex++ * 8;
    const east = Math.max(...boxes.map((b) => b.x + b.width)) + gap,
      west = Math.min(...boxes.map((b) => b.x)) - gap,
      bottom = Math.max(...boxes.map((b) => b.y + b.height)) + gap;
    const sy = source.y + source.height / 2,
      ty = target.y + target.height / 2;
    edgeRoutes.set(edge.id, vertical ? [
      { x: source.x + source.width / 2, y: source.y + source.height },
      { x: source.x + source.width / 2, y: bottom },
      { x: west, y: bottom },
      { x: west, y: Math.min(...boxes.map(b => b.y)) - gap },
      { x: target.x + target.width / 2, y: Math.min(...boxes.map(b => b.y)) - gap },
      { x: target.x + target.width / 2, y: target.y },
    ] : [
      { x: source.x + source.width, y: sy },
      { x: east, y: sy },
      { x: east, y: bottom },
      { x: west, y: bottom },
      { x: west, y: ty },
      { x: target.x, y: ty },
    ]);
    // A component's outer lane may intersect another branch outside that SCC.
    const route = edgeRoutes.get(edge.id)!;
    const obstacles = canvas.nodes.map(n => ({ id: n.id, ...absolute.get(n.id)! }));
    const blocked = route.some((b, i) => {
      if (!i) return false;
      const a = route[i - 1];
      return obstacles.some(o => o.id !== edge.source && o.id !== edge.target && (a.x === b.x
        ? a.x > o.x && a.x < o.x + o.width && Math.max(a.y,b.y) > o.y && Math.min(a.y,b.y) < o.y + o.height
        : a.y > o.y && a.y < o.y + o.height && Math.max(a.x,b.x) > o.x && Math.min(a.x,b.x) < o.x + o.width));
    });
    if (blocked) edgeRoutes.set(edge.id, routeAroundNodes(route[0], route.at(-1)!, obstacles, vertical));
  }
  if (mode === 'force') {
    const boxes = canvas.nodes.map(n => ({ id: n.id, ...absolute.get(n.id)! }));
    for (const edge of canvas.edges) {
      const source = absolute.get(edge.source)!, target = absolute.get(edge.target)!;
      const fraction = edge.targetHandle === 'left' ? .35 : edge.targetHandle === 'right' ? .65 : .5;
      edgeRoutes.set(edge.id, routeAroundNodes(
        { x: source.x + source.width, y: source.y + source.height / 2 },
        { x: target.x, y: target.y + target.height * fraction },
        boxes,
      ));
    }
  }
  return {
    nodes,
    edges: canvas.edges.map((e) => ({
      ...e,
      data: { ...e.data, routePoints: edgeRoutes.get(e.id) },
    })),
  };
}

export function stronglyConnectedComponents(
  ids: string[],
  edges: DataFlowEdge[],
): string[][] {
  let counter = 0;
  const indices = new Map<string, number>(),
    lows = new Map<string, number>(),
    stack: string[] = [],
    active = new Set<string>(),
    result: string[][] = [];
  const visit = (id: string) => {
    indices.set(id, counter);
    lows.set(id, counter++);
    stack.push(id);
    active.add(id);
    for (const edge of edges.filter((e) => e.source === id)) {
      if (!indices.has(edge.target)) {
        visit(edge.target);
        lows.set(id, Math.min(lows.get(id)!, lows.get(edge.target)!));
      } else if (active.has(edge.target))
        lows.set(id, Math.min(lows.get(id)!, indices.get(edge.target)!));
    }
    if (lows.get(id) === indices.get(id)) {
      const component: string[] = [];
      let current: string;
      do {
        current = stack.pop()!;
        active.delete(current);
        component.push(current);
      } while (current !== id);
      result.push(component);
    }
  };
  ids.forEach((id) => {
    if (!indices.has(id)) visit(id);
  });
  return result;
}
