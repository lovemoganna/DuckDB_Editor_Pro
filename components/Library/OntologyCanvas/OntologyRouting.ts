/**
 * OntologyRouting - 实体路由算法
 * 
 * MECE重构：
 * 1. 优化锚点计算 - 确保连线准确连接到节点边缘中心
 * 2. 增强正交路由 - 改善复杂布局下的路径规划
 * 3. 改进碰撞检测 - 更精确的障碍物检测
 */

import { Edge, Node, Position } from 'reactflow';
import { getOntologyNodeDimensions, OntologyLayoutMode } from './OntologyLayout';
import { NODE_DEFAULT_WIDTH, NODE_COLLAPSED_HEIGHT } from './OntologyCanvas.helpers';

export interface GraphPoint {
  x: number;
  y: number;
}

export interface GraphRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type HandleSide = 'left' | 'right' | 'top' | 'bottom';

export interface OrthogonalRoute {
  points: GraphPoint[];
  path: string;
  label: GraphPoint;
  sourceSide: HandleSide;
  targetSide: HandleSide;
}

/**
 * MECE重构：获取节点的边界矩形
 * 确保使用节点的实际尺寸，而非固定值
 */
export const getGraphNodeRect = (node: Node, isExport = false): GraphRect => {
  let width = NODE_DEFAULT_WIDTH;
  let height = NODE_COLLAPSED_HEIGHT;
  
  if (isExport) {
    width = 220;
    const raw = node.data?.obj?.properties;
    let propCount = 0;
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw ?? {});
      propCount = Math.min(5, Object.keys(parsed).length);
    } catch {}
    height = propCount > 0 ? NODE_COLLAPSED_HEIGHT + propCount * 18 + 6 : NODE_COLLAPSED_HEIGHT;
  }
  
  // 使用实际节点尺寸
  const dimensions = getOntologyNodeDimensions(node, width, height);
  const position = node.positionAbsolute ?? node.position;
  
  return {
    id: node.id,
    x: position.x,
    y: position.y,
    width: dimensions.width,
    height: dimensions.height,
  };
};

/**
 * 辅助函数
 */
const round = (value: number) => Math.round(value * 10) / 10;
const pointKey = (point: GraphPoint) => `${round(point.x)}:${round(point.y)}`;

const centerOf = (rect: GraphRect): GraphPoint => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2,
});

/**
 * MECE重构：锚点计算
 * 确保连线准确连接到节点边缘中心点
 * 修复了之前固定像素偏移导致的问题
 */
export const getEdgeHandleSides = (
  source: GraphRect,
  target: GraphRect,
  mode: OntologyLayoutMode,
): { sourceSide: HandleSide; targetSide: HandleSide } => {
  const sourceCenter = centerOf(source);
  const targetCenter = centerOf(target);
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;

  if (mode === 'hierarchical' || mode === 'orthogonal') {
    // Normal forward flow: source on the left, target on the right
    if (dx >= 20) {
      return { sourceSide: 'right', targetSide: 'left' };
    }
    // Backward edge / cycle: target is significantly to the left of source
    // Rather than looping all the way around source and target, use shortest clean path
    if (dx <= -20) {
      if (Math.abs(dy) > Math.abs(dx) * 1.2) {
        return dy > 0
          ? { sourceSide: 'bottom', targetSide: 'top' }
          : { sourceSide: 'top', targetSide: 'bottom' };
      }
      return { sourceSide: 'left', targetSide: 'right' };
    }
    // Roughly aligned vertically
    return dy >= 0
      ? { sourceSide: 'bottom', targetSide: 'top' }
      : { sourceSide: 'top', targetSide: 'bottom' };
  }
  if (mode === 'tree') {
    if (dy >= 20) {
      return { sourceSide: 'bottom', targetSide: 'top' };
    }
    if (dy <= -20) {
      return { sourceSide: 'top', targetSide: 'bottom' };
    }
    return dx >= 0
      ? { sourceSide: 'right', targetSide: 'left' }
      : { sourceSide: 'left', targetSide: 'right' };
  }

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceSide: 'right', targetSide: 'left' }
      : { sourceSide: 'left', targetSide: 'right' };
  }
  return dy >= 0
    ? { sourceSide: 'bottom', targetSide: 'top' }
    : { sourceSide: 'top', targetSide: 'bottom' };
};

export const sideToPosition = (side: HandleSide): Position => ({
  left: Position.Left,
  right: Position.Right,
  top: Position.Top,
  bottom: Position.Bottom,
})[side];

export const sideToHandleId = (side: HandleSide, type: 'source' | 'target') =>
  `${side}-${type}`;

/**
 * MECE重构：锚点位置计算
 * 根据指定的边返回该边中心点的精确坐标
 * 这是确保连线准确连接节点的核心函数
 */
const anchorForSide = (rect: GraphRect, side: HandleSide): GraphPoint => {
  switch (side) {
    case 'left': 
      return { 
        x: rect.x, 
        y: rect.y + rect.height / 2 
      };
    case 'right': 
      return { 
        x: rect.x + rect.width, 
        y: rect.y + rect.height / 2 
      };
    case 'top': 
      return { 
        x: rect.x + rect.width / 2, 
        y: rect.y 
      };
    case 'bottom': 
      return { 
        x: rect.x + rect.width / 2, 
        y: rect.y + rect.height 
      };
  }
};

const moveOutward = (point: GraphPoint, side: HandleSide, distance: number): GraphPoint => {
  switch (side) {
    case 'left': return { x: point.x - distance, y: point.y };
    case 'right': return { x: point.x + distance, y: point.y };
    case 'top': return { x: point.x, y: point.y - distance };
    case 'bottom': return { x: point.x, y: point.y + distance };
  }
};

const expandRect = (rect: GraphRect, padding: number): GraphRect => ({
  ...rect,
  x: rect.x - padding,
  y: rect.y - padding,
  width: rect.width + padding * 2,
  height: rect.height + padding * 2,
});

const pointInside = (point: GraphPoint, rect: GraphRect) =>
  point.x > rect.x + 0.1
  && point.x < rect.x + rect.width - 0.1
  && point.y > rect.y + 0.1
  && point.y < rect.y + rect.height - 0.1;

const segmentBlocked = (a: GraphPoint, b: GraphPoint, obstacles: GraphRect[]) => {
  if (Math.abs(a.x - b.x) < 0.1) {
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    return obstacles.some((rect) =>
      a.x > rect.x + 0.1
      && a.x < rect.x + rect.width - 0.1
      && maxY > rect.y + 0.1
      && minY < rect.y + rect.height - 0.1);
  }
  if (Math.abs(a.y - b.y) < 0.1) {
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    return obstacles.some((rect) =>
      a.y > rect.y + 0.1
      && a.y < rect.y + rect.height - 0.1
      && maxX > rect.x + 0.1
      && minX < rect.x + rect.width - 0.1);
  }
  return true;
};

const uniqueSorted = (values: number[]) => [...new Set(values.map(round))].sort((a, b) => a - b);

class MinHeap<T> {
  private values: Array<{ priority: number; value: T }> = [];

  push(value: T, priority: number) {
    this.values.push({ value, priority });
    let index = this.values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.values[parent].priority <= priority) break;
      this.values[index] = this.values[parent];
      index = parent;
    }
    this.values[index] = { value, priority };
  }

  pop(): T | undefined {
    if (this.values.length === 0) return undefined;
    const root = this.values[0].value;
    const last = this.values.pop();
    if (!last || this.values.length === 0) return root;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      if (left >= this.values.length) break;
      const child = right < this.values.length && this.values[right].priority < this.values[left].priority ? right : left;
      if (this.values[child].priority >= last.priority) break;
      this.values[index] = this.values[child];
      index = child;
    }
    this.values[index] = last;
    return root;
  }

  get size() { return this.values.length; }
}

const simplifyPoints = (points: GraphPoint[]) => {
  const deduplicated = points.filter((point, index) => index === 0 || pointKey(point) !== pointKey(points[index - 1]));
  return deduplicated.filter((point, index) => {
    if (index === 0 || index === deduplicated.length - 1) return true;
    const previous = deduplicated[index - 1];
    const next = deduplicated[index + 1];
    const vertical = Math.abs(previous.x - point.x) < 0.1 && Math.abs(point.x - next.x) < 0.1;
    const horizontal = Math.abs(previous.y - point.y) < 0.1 && Math.abs(point.y - next.y) < 0.1;
    return !vertical && !horizontal;
  });
};

const fallbackRoute = (source: GraphPoint, target: GraphPoint, obstacles: GraphRect[]) => {
  const candidates: GraphPoint[][] = [
    [source, { x: target.x, y: source.y }, target],
    [source, { x: source.x, y: target.y }, target],
  ];
  if (obstacles.length > 0) {
    const left = Math.min(...obstacles.map((rect) => rect.x)) - 24;
    const right = Math.max(...obstacles.map((rect) => rect.x + rect.width)) + 24;
    const top = Math.min(...obstacles.map((rect) => rect.y)) - 24;
    const bottom = Math.max(...obstacles.map((rect) => rect.y + rect.height)) + 24;
    candidates.push(
      [source, { x: left, y: source.y }, { x: left, y: target.y }, target],
      [source, { x: right, y: source.y }, { x: right, y: target.y }, target],
      [source, { x: source.x, y: top }, { x: target.x, y: top }, target],
      [source, { x: source.x, y: bottom }, { x: target.x, y: bottom }, target],
    );
  }
  const valid = candidates.filter((candidate) => candidate.slice(1).every((point, index) => !segmentBlocked(candidate[index], point, obstacles)));
  const pool = valid.length > 0 ? valid : candidates;
  return pool.sort((a, b) => {
    const length = (points: GraphPoint[]) => points.slice(1).reduce((sum, point, index) => sum + Math.abs(point.x - points[index].x) + Math.abs(point.y - points[index].y), 0);
    return length(a) - length(b) || a.length - b.length;
  })[0];
};

const findManhattanPath = (
  source: GraphPoint,
  target: GraphPoint,
  obstacles: GraphRect[],
  laneOffset: number,
) => {
  const directBounds = {
    x: Math.min(source.x, target.x) - 600,
    y: Math.min(source.y, target.y) - 600,
    width: Math.abs(target.x - source.x) + 1200,
    height: Math.abs(target.y - source.y) + 1200,
  };
  const nearby = obstacles.filter((rect) =>
    rect.x < directBounds.x + directBounds.width
    && rect.x + rect.width > directBounds.x
    && rect.y < directBounds.y + directBounds.height
    && rect.y + rect.height > directBounds.y);
  const preferredX = (source.x + target.x) / 2 + laneOffset;
  const preferredY = (source.y + target.y) / 2 + laneOffset;

  // Add obstacle boundary gutters (±20px offset) into grid lines so paths can travel safely around corners
  const gutterX = nearby.flatMap((rect) => [rect.x - 20, rect.x, rect.x + rect.width, rect.x + rect.width + 20]);
  const gutterY = nearby.flatMap((rect) => [rect.y - 20, rect.y, rect.y + rect.height, rect.y + rect.height + 20]);

  const xs = uniqueSorted([source.x, target.x, preferredX, ...gutterX]);
  const ys = uniqueSorted([source.y, target.y, preferredY, ...gutterY]);
  const valid = new Set<string>();
  xs.forEach((x, xi) => ys.forEach((y, yi) => {
    if (!nearby.some((rect) => pointInside({ x, y }, rect))) valid.add(`${xi}:${yi}`);
  }));

  const startXi = xs.indexOf(round(source.x));
  const startYi = ys.indexOf(round(source.y));
  const endXi = xs.indexOf(round(target.x));
  const endYi = ys.indexOf(round(target.y));
  type Direction = 'h' | 'v' | 'start';
  interface State { xi: number; yi: number; direction: Direction }
  const start: State = { xi: startXi, yi: startYi, direction: 'start' };
  const stateKey = (state: State) => `${state.xi}:${state.yi}:${state.direction}`;
  const queue = new MinHeap<State>();
  const distance = new Map([[stateKey(start), 0]]);
  const previous = new Map<string, string>();
  const states = new Map([[stateKey(start), start]]);
  queue.push(start, 0);
  let finalKey: string | null = null;

  while (queue.size > 0) {
    const current = queue.pop()!;
    const currentKey = stateKey(current);
    const currentDistance = distance.get(currentKey)!;
    if (current.xi === endXi && current.yi === endYi) {
      finalKey = currentKey;
      break;
    }
    const neighbors = [
      { xi: current.xi - 1, yi: current.yi, direction: 'h' as const },
      { xi: current.xi + 1, yi: current.yi, direction: 'h' as const },
      { xi: current.xi, yi: current.yi - 1, direction: 'v' as const },
      { xi: current.xi, yi: current.yi + 1, direction: 'v' as const },
    ];
    neighbors.forEach((neighbor) => {
      if (neighbor.xi < 0 || neighbor.xi >= xs.length || neighbor.yi < 0 || neighbor.yi >= ys.length) return;
      if (!valid.has(`${neighbor.xi}:${neighbor.yi}`)) return;
      const a = { x: xs[current.xi], y: ys[current.yi] };
      const b = { x: xs[neighbor.xi], y: ys[neighbor.yi] };
      if (segmentBlocked(a, b, nearby)) return;
      const segmentLength = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      const bendPenalty = current.direction !== 'start' && current.direction !== neighbor.direction ? 120 : 0;
      const lanePenalty = neighbor.direction === 'v'
        ? Math.abs(b.x - preferredX) * 0.002
        : Math.abs(b.y - preferredY) * 0.002;
      const nextDistance = currentDistance + segmentLength + bendPenalty + lanePenalty;
      const nextKey = stateKey(neighbor);
      if (nextDistance >= (distance.get(nextKey) ?? Number.POSITIVE_INFINITY)) return;
      distance.set(nextKey, nextDistance);
      previous.set(nextKey, currentKey);
      states.set(nextKey, neighbor);
      const heuristic = Math.abs(b.x - target.x) + Math.abs(b.y - target.y);
      queue.push(neighbor, nextDistance + heuristic);
    });
  }

  if (!finalKey) return simplifyPoints(fallbackRoute(source, target, nearby));
  const result: GraphPoint[] = [];
  let cursor: string | undefined = finalKey;
  while (cursor) {
    const state = states.get(cursor)!;
    result.push({ x: xs[state.xi], y: ys[state.yi] });
    cursor = previous.get(cursor);
  }
  return simplifyPoints(result.reverse());
};

export const pointsToOrthogonalPath = (points: GraphPoint[]) => {
  if (points.length === 0) return '';
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${round(point.x)} ${round(point.y)}`).join(' ');
};

/**
 * Generate a smooth orthogonal path with rounded fillet corners.
 * Replaces harsh, stiff 90-degree right angles with elegant curved transitions.
 */
export const pointsToRoundedOrthogonalPath = (points: GraphPoint[], borderRadius = 12): string => {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${round(points[0].x)} ${round(points[0].y)}`;
  if (points.length === 2 || borderRadius <= 0) {
    return pointsToOrthogonalPath(points);
  }

  let path = `M ${round(points[0].x)} ${round(points[0].y)}`;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const len1 = Math.hypot(dx1, dy1);

    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    const len2 = Math.hypot(dx2, dy2);

    if (len1 < 0.1 || len2 < 0.1) {
      continue;
    }

    // Check if points are collinear
    const crossProduct = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(crossProduct) < 0.01) {
      path += ` L ${round(curr.x)} ${round(curr.y)}`;
      continue;
    }

    // Clamp radius to at most half of the segment lengths
    const r = Math.min(borderRadius, len1 / 2, len2 / 2);

    const u1x = dx1 / len1;
    const u1y = dy1 / len1;
    const u2x = dx2 / len2;
    const u2y = dy2 / len2;

    const startX = curr.x - u1x * r;
    const startY = curr.y - u1y * r;
    const endX = curr.x + u2x * r;
    const endY = curr.y + u2y * r;

    path += ` L ${round(startX)} ${round(startY)} Q ${round(curr.x)} ${round(curr.y)} ${round(endX)} ${round(endY)}`;
  }

  const last = points[points.length - 1];
  path += ` L ${round(last.x)} ${round(last.y)}`;
  return path;
};

export const getPolylineMidpoint = (points: GraphPoint[]): GraphPoint => {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];
  const lengths = points.slice(1).map((point, index) =>
    Math.abs(point.x - points[index].x) + Math.abs(point.y - points[index].y));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  let remaining = total / 2;
  for (let index = 0; index < lengths.length; index += 1) {
    if (remaining <= lengths[index]) {
      const start = points[index];
      const end = points[index + 1];
      const ratio = lengths[index] === 0 ? 0 : remaining / lengths[index];
      return { x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio };
    }
    remaining -= lengths[index];
  }
  return points[points.length - 1];
};

export const getOrthogonalRoute = (
  sourceRect: GraphRect,
  targetRect: GraphRect,
  allRects: GraphRect[],
  mode: OntologyLayoutMode,
  laneOffset = 0,
  clearance = 28,
): OrthogonalRoute => {
  const { sourceSide, targetSide } = getEdgeHandleSides(sourceRect, targetRect, mode);
  const source = anchorForSide(sourceRect, sourceSide);
  const target = anchorForSide(targetRect, targetSide);
  const sourceExit = moveOutward(source, sourceSide, clearance);
  const targetEntry = moveOutward(target, targetSide, clearance);
  const expanded = allRects.map((rect) => expandRect(rect, clearance));
  const middle = findManhattanPath(sourceExit, targetEntry, expanded, laneOffset);
  const points = simplifyPoints([source, sourceExit, ...middle, targetEntry, target]);
  return {
    points,
    path: pointsToOrthogonalPath(points),
    label: getPolylineMidpoint(points),
    sourceSide,
    targetSide,
  };
};

export const getOrthogonalRouteForEdge = (
  nodes: Node[],
  edge: Edge,
  mode: OntologyLayoutMode,
  laneOffset = 0,
) => {
  const rects = nodes.map(node => getGraphNodeRect(node));
  const byId = new Map(rects.map((rect) => [rect.id, rect]));
  const sourceRect = byId.get(edge.source);
  const targetRect = byId.get(edge.target);
  if (!sourceRect || !targetRect) return null;
  return getOrthogonalRoute(sourceRect, targetRect, rects, mode, laneOffset);
};
