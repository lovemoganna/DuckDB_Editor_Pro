/**
 * graphSimulation.worker.ts
 * Offloads d3-force simulation to a Web Worker to keep the main thread free.
 * Vite bundles d3-force inline — no external CDN dependency.
 *
 * Messages IN (from main thread):
 *   { type: 'init', nodes: GraphNode[], links: GraphLink[], options: SimOptions }
 *   { type: 'updateForces', options: SimOptions }
 *   { type: 'reheat', alpha: number }
 *   { type: 'pinNode', nodeId: string, x: number, y: number }
 *   { type: 'unpinNode', nodeId: string }
 *   { type: 'stop' }
 *   { type: 'resize', width: number, height: number }
 *
 * Messages OUT (to main thread):
 *   { type: 'tick', nodes: {id,x,y}[] }
 *   { type: 'end' }
 *   { type: 'ready' }
 *   { type: 'error', message: string }
 */

import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force';

interface SimNode extends SimulationNodeDatum {
  id: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  size?: number;
  weight?: number;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  source: string | SimNode;
  target: string | SimNode;
  weight?: number;
  _linkTypeId?: number;
  _isTypeInstLink?: boolean;
}

interface SimOptions {
  width?: number;
  height?: number;
  alpha?: number;
  linkDistance?: number;
  chargeStrength?: number;
  collisionRadius?: number;
}

let simulation: Simulation<SimNode, SimLink> | null = null;
let nodes: SimNode[] = [];
let tickInterval: ReturnType<typeof setInterval> | null = null;

function nodeSnapshot(n: SimNode): { id: string; x: number; y: number; vx: number; vy: number } {
  return {
    id: n.id,
    x: n.x ?? 0,
    y: n.y ?? 0,
    vx: n.vx ?? 0,
    vy: n.vy ?? 0,
  };
}

function computeAdaptivePhysics(nodeCount: number, opts: SimOptions) {
  const density = Math.min(1, Math.max(0, (nodeCount - 20) / 500));
  const baseLinkDistance = opts.linkDistance || 90;
  const baseCharge = opts.chargeStrength ?? -450;
  const baseCollision = opts.collisionRadius ?? 18;
  return {
    width: opts.width || 800,
    height: opts.height || 600,
    alpha: opts.alpha ?? 0.8,
    linkDistance: Math.max(50, baseLinkDistance * (1 - density * 0.35)),
    chargeStrength: baseCharge * (1 + density * 1.2),
    collisionRadius: baseCollision * (1 + density * 0.8),
  };
}

function startSimulation(options: SimOptions, nodeData: SimNode[], linkData: SimLink[]) {
  if (simulation) { simulation.stop(); simulation = null; }
  if (tickInterval) { clearInterval(tickInterval); tickInterval = null; }

  nodes = nodeData.map(n => ({ ...n }));
  const links = linkData.map(l => ({
    source: typeof l.source === 'object' ? l.source.id : l.source,
    target: typeof l.target === 'object' ? l.target.id : l.target,
    weight: l.weight,
    _linkTypeId: l._linkTypeId,
    _isTypeInstLink: l._isTypeInstLink,
  }));

  const nodeCount = nodes.length;
  const adaptive = computeAdaptivePhysics(nodeCount, options);
  const W = adaptive.width;
  const H = adaptive.height;

  simulation = forceSimulation<SimNode, SimLink>(nodes)
    .alpha(adaptive.alpha)
    .alphaDecay(nodeCount > 40 ? 0.025 : 0.035)
    .velocityDecay(0.4)
    .force('link', forceLink<SimNode, SimLink>(links)
      .id(d => d.id)
      .distance(d => {
        if ((d as any)._linkTypeId !== undefined) return (adaptive.linkDistance || 90) * 1.5;
        if ((d as any)._isTypeInstLink) return (adaptive.linkDistance || 90) * 2.25;
        return adaptive.linkDistance || 90;
      })
      .strength(nodeCount > 40 ? 0.6 : 0.5)
    )
    .force('charge', forceManyBody<SimNode>().strength(adaptive.chargeStrength))
    .force('center', forceCenter(W / 2, H / 2))
    .force('collision', forceCollide<SimNode>().radius(d => (d.size || 10) + adaptive.collisionRadius))
    .force('x', forceX<SimNode>(W / 2).strength(nodeCount > 40 ? 0.03 : 0.05))
    .force('y', forceY<SimNode>(H / 2).strength(nodeCount > 40 ? 0.03 : 0.05));

  tickInterval = setInterval(() => {
    if (!simulation) return;
    self.postMessage({ type: 'tick', nodes: nodes.map(nodeSnapshot) });
  }, 33);

  simulation.on('end', () => {
    if (tickInterval) { clearInterval(tickInterval); tickInterval = null; }
    self.postMessage({ type: 'tick', nodes: nodes.map(nodeSnapshot) });
    self.postMessage({ type: 'end' });
  });

  self.postMessage({ type: 'tick', nodes: nodes.map(nodeSnapshot) });
  self.postMessage({ type: 'ready' });
}

function updateForces(options: SimOptions) {
  if (!simulation) return;
  const nodeCount = nodes.length;
  const adaptive = computeAdaptivePhysics(nodeCount, options);

  const chargeForce = simulation.force('charge');
  if (chargeForce && 'strength' in chargeForce) {
    (chargeForce as any).strength(adaptive.chargeStrength);
  }
  const collisionForce = simulation.force('collision');
  if (collisionForce && 'radius' in collisionForce) {
    (collisionForce as any).radius(d => ((d as SimNode).size || 10) + adaptive.collisionRadius);
  }
  const linkForce = simulation.force('link') as ReturnType<typeof forceLink<SimNode, SimLink>> | null;
  if (linkForce) {
    linkForce.distance(d => {
      if ((d as any)._linkTypeId !== undefined) return (adaptive.linkDistance || 90) * 1.5;
      if ((d as any)._isTypeInstLink) return (adaptive.linkDistance || 90) * 2.25;
      return adaptive.linkDistance || 90;
    });
  }
  simulation.alpha(options.alpha ?? 0.3).restart();
}

function reheat(alpha?: number) {
  if (!simulation) return;
  simulation.alpha(alpha ?? 0.5).restart();
}

function pinNode(nodeId: string, x: number, y: number) {
  const node = nodes.find(n => n.id === nodeId);
  if (node) { node.fx = x; node.fy = y; }
}

function unpinNode(nodeId: string) {
  const node = nodes.find(n => n.id === nodeId);
  if (node) { node.fx = null; node.fy = null; }
}

self.onmessage = function (e: MessageEvent) {
  const { type, ...rest } = e.data;
  try {
    switch (type) {
      case 'init':
        startSimulation(rest.options || {}, rest.nodes || [], rest.links || []);
        break;
      case 'updateForces':
        updateForces(rest.options || {});
        break;
      case 'reheat':
        reheat(rest.alpha);
        break;
      case 'pinNode':
        pinNode(rest.nodeId, rest.x, rest.y);
        break;
      case 'unpinNode':
        unpinNode(rest.nodeId);
        break;
      case 'stop':
        if (simulation) { simulation.stop(); simulation = null; }
        if (tickInterval) { clearInterval(tickInterval); tickInterval = null; }
        break;
      case 'resize':
        if (simulation) {
          const W = rest.width || 800;
          const H = rest.height || 600;
          simulation.force('center', forceCenter(W / 2, H / 2));
          simulation.force('x', forceX(W / 2));
          simulation.force('y', forceY(H / 2));
          simulation.alpha(0.1).restart();
        }
        break;
      default:
        self.postMessage({ type: 'error', message: `Unknown message type: ${type}` });
    }
  } catch (err: any) {
    self.postMessage({ type: 'error', message: err.message || String(err) });
  }
};
