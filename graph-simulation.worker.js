/**
 * graph-simulation.worker.js
 * Offloads d3-force simulation to a Web Worker to keep the main thread free.
 *
 * Messages IN (from main thread):
 *   { type: 'init', nodes: GraphNode[], links: GraphLink[], options: SimOptions }
 *   { type: 'updateForces', options: SimOptions }
 *   { type: 'reheat', alpha: number }
 *   { type: 'pinNode', nodeId: string, x: number, y: number }
 *   { type: 'unpinNode', nodeId: string }
 *   { type: 'stop' }
 *
 * Messages OUT (to main thread):
 *   { type: 'tick', nodes: {id,x,y}[] }
 *   { type: 'end' }
 *   { type: 'ready' }
 *   { type: 'error', message: string }
 */

/* eslint-disable no-restricted-globals */

// d3-force is bundled via importScripts — Vite will inject the correct CDN path
importScripts('https://cdn.jsdelivr.net/npm/d3-force@3.0.0/dist/d3-force.min.js');

let simulation = null;
let nodes = [];
let links = [];
let tickInterval = null;

/** Serialize only the fields the main thread needs from a node */
function nodeSnapshot(n) {
  return { id: n.id, x: n.x, y: n.y, vx: n.vx, vy: n.vy };
}

/**
 * Compute physics parameters that adapt to node count.
 * Larger graphs need stronger repulsion and tighter collision radii
 * to prevent node overlap and hairball layouts.
 */
function computeAdaptivePhysics(nodeCount, opts) {
  // density: 0 = sparse (<50 nodes), 1 = very dense (>500)
  const density = Math.min(1, Math.max(0, (nodeCount - 20) / 500));
  const baseLinkDistance = opts.linkDistance || 90;
  const baseCharge = opts.chargeStrength ?? -450;
  const baseCollision = opts.collisionRadius ?? 18;
  return {
    width: opts.width || 800,
    height: opts.height || 600,
    alpha: opts.alpha ?? 0.8,
    // Larger graphs → slightly shorter links so clusters stay compact
    linkDistance: Math.max(50, baseLinkDistance * (1 - density * 0.35)),
    // Larger graphs → stronger repulsion (more negative) to spread nodes apart
    chargeStrength: baseCharge * (1 + density * 1.2),
    // Larger graphs → larger collision radius to prevent挤压
    collisionRadius: baseCollision * (1 + density * 0.8),
  };
}

function startSimulation(options, nodeData, linkData) {
  // Kill existing sim
  if (simulation) {
    simulation.stop();
    simulation = null;
  }
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }

  nodes = nodeData.map(n => Object.assign({}, n));
  links = linkData.map(l => ({
    source: typeof l.source === 'object' ? l.source.id : l.source,
    target: typeof l.target === 'object' ? l.target.id : l.target,
    weight: l.weight,
    _linkTypeId: l._linkTypeId,
    _isTypeInstLink: l._isTypeInstLink || l.source?.group === 'typeHub' || l.target?.group === 'typeHub',
  }));

  const nodeCount = nodes.length;
  // Apply adaptive physics: scales charge/collision/linkDistance with node count
  const adaptive = computeAdaptivePhysics(nodeCount, options);
  const W = adaptive.width;
  const H = adaptive.height;

  // Build the simulation with adaptive parameters
  simulation = d3.forceSimulation(nodes)
    .alpha(adaptive.alpha)
    .alphaDecay(nodeCount > 40 ? 0.025 : 0.035)
    .velocityDecay(0.4)
    .force('link', d3.forceLink(links)
      .id(d => d.id)
      .distance(d => {
        if (d._linkTypeId !== undefined) return (adaptive.linkDistance || 90) * 1.5;
        if (d._isTypeInstLink) return (adaptive.linkDistance || 90) * 2.25;
        return adaptive.linkDistance || 90;
      })
      .strength(nodeCount > 40 ? 0.6 : 0.5)
    )
    .force('charge', d3.forceManyBody().strength(adaptive.chargeStrength))
    .force('center', d3.forceCenter(W / 2, H / 2))
    .force('collision', d3.forceCollide().radius(d => (d.size || 10) + adaptive.collisionRadius))
    .force('x', d3.forceX(W / 2).strength(nodeCount > 40 ? 0.03 : 0.05))
    .force('y', d3.forceY(H / 2).strength(nodeCount > 40 ? 0.03 : 0.05));

  // Send ticks at ~30fps (every 33ms) via setInterval
  tickInterval = setInterval(() => {
    if (!simulation) return;
    self.postMessage({ type: 'tick', nodes: nodes.map(nodeSnapshot) });
  }, 33);

  simulation.on('end', () => {
    if (tickInterval) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
    // Send one final complete state
    self.postMessage({ type: 'tick', nodes: nodes.map(nodeSnapshot) });
    self.postMessage({ type: 'end' });
  });

  // Also send immediate first frame
  self.postMessage({ type: 'tick', nodes: nodes.map(nodeSnapshot) });
  self.postMessage({ type: 'ready' });
}

function updateForces(options) {
  if (!simulation) return;
  const nodeCount = nodes.length;
  const adaptive = computeAdaptivePhysics(nodeCount, options);

  const chargeForce = simulation.force('charge');
  if (chargeForce) chargeForce.strength(adaptive.chargeStrength);

  const collisionForce = simulation.force('collision');
  if (collisionForce) collisionForce.radius(d => (d.size || 10) + adaptive.collisionRadius);

  const linkForce = simulation.force('link');
  if (linkForce) {
    linkForce.distance(d => {
      if (d._linkTypeId !== undefined) return (adaptive.linkDistance || 90) * 1.5;
      if (d._isTypeInstLink) return (adaptive.linkDistance || 90) * 2.25;
      return adaptive.linkDistance || 90;
    });
  }

  simulation.alpha(options.alpha ?? 0.3).restart();
}

function reheat(alpha) {
  if (!simulation) return;
  simulation.alpha(alpha ?? 0.5).restart();
}

function pinNode(nodeId, x, y) {
  const node = nodes.find(n => n.id === nodeId);
  if (node) {
    node.fx = x;
    node.fy = y;
  }
}

function unpinNode(nodeId) {
  const node = nodes.find(n => n.id === nodeId);
  if (node) {
    node.fx = null;
    node.fy = null;
  }
}

self.onmessage = function (e) {
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
          simulation.force('center', d3.forceCenter(W / 2, H / 2));
          simulation.force('x', d3.forceX(W / 2));
          simulation.force('y', d3.forceY(H / 2));
          simulation.alpha(0.1).restart();
        }
        break;
      default:
        self.postMessage({ type: 'error', message: `Unknown message type: ${type}` });
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message || String(err) });
  }
};
