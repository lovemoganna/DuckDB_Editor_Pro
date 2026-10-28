import { forceSimulation, forceLink, forceManyBody, forceCollide, forceCenter, type SimulationNodeDatum } from 'd3-force';
import type { ElkNode } from 'elkjs/lib/elk.bundled.js';
import type { DataFlowEdge } from './workflowTypes';

interface Body extends SimulationNodeDatum { id: string; width: number; height: number }
export interface Box { id: string; x: number; y: number; width: number; height: number }
interface Point { x: number; y: number }

/** Run a seeded, finite force simulation inside each real SQL boundary. */
export function layoutForceBoundaries(root: ElkNode, edges: DataFlowEdge[]): ElkNode {
  const descendants = new Map<string, Set<string>>();
  const visit = (group: ElkNode) => {
    const children = group.children || [];
    children.forEach(visit);
    descendants.set(group.id, new Set([group.id, ...children.flatMap(c => [...descendants.get(c.id)!])]));
    if (!children.length) return;
    const owner = new Map<string, string>();
    for (const child of children) for (const id of descendants.get(child.id)!) owner.set(id, child.id);
    const links = new Map<string, { source: string; target: string }>();
    for (const edge of edges) {
      const source = owner.get(edge.source), target = owner.get(edge.target);
      if (source && target && source !== target) links.set(`${source}:${target}`, { source, target });
    }
    const bodies: Body[] = children.map(c => ({ id: c.id, width: c.width || 224, height: c.height || 74 }));
    let seed = 1;
    const simulation = forceSimulation(bodies).stop().randomSource(() => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    }).force('links', forceLink<Body, { source: string | Body; target: string | Body }>([...links.values()])
      .id(n => n.id).distance(link => {
        const a = link.source as Body, b = link.target as Body;
        return (Math.hypot(a.width, a.height) + Math.hypot(b.width, b.height)) / 2 + 48;
      }).strength(.4))
      .force('charge', forceManyBody().strength(-240))
      .force('collision', forceCollide<Body>(n => Math.hypot(n.width, n.height) / 2 + 18).iterations(4))
      .force('center', forceCenter(0, 0));
    simulation.tick(300);
    // Resolve any residual collision after cooling, using measured rectangles.
    for (let pass = 0; pass < bodies.length * 2; pass++) {
      let moved = false;
      for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i], b = bodies[j];
        const dx = b.x! - a.x!, dy = b.y! - a.y!;
        const ox = (a.width + b.width) / 2 + 32 - Math.abs(dx);
        const oy = (a.height + b.height) / 2 + 32 - Math.abs(dy);
        if (ox > 0 && oy > 0) {
          if (ox < oy) { const shift = (ox / 2 + .01) * (dx >= 0 ? 1 : -1); a.x! -= shift; b.x! += shift; }
          else { const shift = (oy / 2 + .01) * (dy >= 0 ? 1 : -1); a.y! -= shift; b.y! += shift; }
          moved = true;
        }
      }
      if (!moved) break;
    }
    const left = Math.min(...bodies.map(n => n.x! - n.width / 2));
    const top = Math.min(...bodies.map(n => n.y! - n.height / 2));
    bodies.forEach((body, i) => {
      children[i].x = Math.round((body.x! - body.width / 2 - left + 20) * 100) / 100;
      children[i].y = Math.round((body.y! - body.height / 2 - top + 36) * 100) / 100;
    });
    group.width = Math.max(...children.map(c => c.x! + c.width!)) + 20;
    group.height = Math.max(...children.map(c => c.y! + c.height!)) + 20;
  };
  visit(root);
  return root;
}

/** Orthogonal visibility-grid routing; every leaf is an obstacle, including endpoints. */
export function routeAroundNodes(source: Point, target: Point, boxes: Box[], vertical = false): Point[] {
  const padding = 8;
  const obstacles = boxes.map(b => ({ left: b.x - padding, right: b.x + b.width + padding, top: b.y - padding, bottom: b.y + b.height + padding }));
  const start = vertical ? { x: source.x, y: source.y + 12 } : { x: source.x + 12, y: source.y };
  const end = vertical ? { x: target.x, y: target.y - 12 } : { x: target.x - 12, y: target.y };
  const xs = [...new Set([start.x, end.x, ...obstacles.flatMap(b => [b.left - 1, b.right + 1])])].sort((a,b) => a-b);
  const ys = [...new Set([start.y, end.y, ...obstacles.flatMap(b => [b.top - 1, b.bottom + 1])])].sort((a,b) => a-b);
  const width = xs.length;
  const id = (p: Point) => ys.indexOf(p.y) * width + xs.indexOf(p.x);
  const point = (index: number): Point => ({ x: xs[index % width], y: ys[Math.floor(index / width)] });
  const crosses = (a: Point, b: Point) => obstacles.some(o => a.x === b.x
    ? a.x > o.left && a.x < o.right && Math.max(a.y,b.y) > o.top && Math.min(a.y,b.y) < o.bottom
    : a.y > o.top && a.y < o.bottom && Math.max(a.x,b.x) > o.left && Math.min(a.x,b.x) < o.right);
  const begin = id(start), finish = id(end), queue = new Set([begin]);
  const costs = new Map([[begin, 0]]), previous = new Map<number,number>();
  const distance = (a: Point, b: Point) => Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
  while (queue.size) {
    let current = -1, best = Infinity;
    for (const candidate of queue) {
      const score = costs.get(candidate)! + distance(point(candidate), end);
      if (score < best) { current = candidate; best = score; }
    }
    queue.delete(current);
    if (current === finish) break;
    const x = current % width, y = Math.floor(current / width), a = point(current);
    const neighbors = [x > 0 ? current-1 : -1, x < width-1 ? current+1 : -1, y > 0 ? current-width : -1, y < ys.length-1 ? current+width : -1];
    for (const neighbor of neighbors) {
      if (neighbor < 0) continue;
      const b = point(neighbor);
      if (crosses(a,b)) continue;
      const cost = costs.get(current)! + distance(a,b);
      if (cost < (costs.get(neighbor) ?? Infinity)) {
        costs.set(neighbor,cost); previous.set(neighbor,current); queue.add(neighbor);
      }
    }
  }
  if (!costs.has(finish)) throw new Error('无法找到避开节点的连接路径');
  const path = [finish];
  while (path[0] !== begin) path.unshift(previous.get(path[0])!);
  const points = [source, ...path.map(point), target];
  return points.filter((p,i) => {
    const a=points[i-1], b=points[i+1];
    return !a || !b || !((a.x===p.x && p.x===b.x) || (a.y===p.y && p.y===b.y));
  });
}
