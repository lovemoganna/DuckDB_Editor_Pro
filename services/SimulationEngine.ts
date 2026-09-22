/**
 * SimulationEngine — wraps d3-force simulation (local or Web Worker).
 *
 * Provides the same `.alpha()`, `.alphaTarget()`, `.stop()`, `.restart()`,
 * `.force()` API as d3.Simulation, so existing code (drag, physics controls,
 * ResizeObserver, layout resets) works unchanged.
 *
 * Falls back to local d3.forceSimulation when:
 *   - No Worker support (IE11)
 *   - Node count < 30 (Worker overhead not worth it)
 *   - Worker fails to initialize
 *
 * Usage:
 *   const engine = new SimulationEngine(nodes, links, options, {
 *     onTick: (nodePositions) => { /* update DOM *|/ },
 *     onEnd: () => { /* fit to canvas *|/ },
 *   });
 *   engine.alpha(0.3).restart();
 *   engine.force('charge').strength(-500);
 *   engine.stop();
 *   engine.destroy();
 */

import * as d3 from 'd3';
import type { Simulation, SimulationNodeDatum, SimulationLinkDatum } from 'd3';

export interface SimNode extends SimulationNodeDatum {
  id: string;
  size?: number;
  group?: string;
  x?: number; y?: number;
  fx?: number | null; fy?: number | null;
  vx?: number; vy?: number;
}

export interface SimLink extends SimulationLinkDatum<SimNode> {
  weight?: number;
  _linkTypeId?: number;
  _isTypeInstLink?: boolean;
}

export interface SimOptions {
  width?: number;
  height?: number;
  alpha?: number;
  linkDistance?: number;
  chargeStrength?: number;
  collisionRadius?: number;
}

/**
 * Compute physics parameters that adapt to node count.
 * Larger graphs need stronger repulsion and tighter collision radii
 * to prevent node overlap and hairball layouts.
 *
 * Uses sqrt decay curves so parameters scale gently with node count —
 * avoids the previous problem where chargeStrength shot up to -990 on large graphs.
 */
export function computeAdaptivePhysics(nodeCount: number, opts?: Partial<SimOptions>): SimOptions {
  // Density coefficient: 0 = sparse (<50 nodes), 1 = very dense (>320)
  const density = Math.min(1, Math.max(0, (nodeCount - 20) / 300));

  const baseLinkDistance = opts?.linkDistance ?? 90;
  const baseCharge = opts?.chargeStrength ?? -450;
  const baseCollision = opts?.collisionRadius ?? 18;

  return {
    width: opts?.width ?? 800,
    height: opts?.height ?? 600,
    alpha: opts?.alpha ?? 0.8,
    // Larger graphs → shorter links so clusters stay compact (max 25% reduction)
    linkDistance: Math.max(60, baseLinkDistance * (1 - density * 0.25)),
    // Larger graphs → stronger repulsion via sqrt curve: [-450, -700], not [-450, -990]
    chargeStrength: baseCharge * (1 + Math.sqrt(density) * 0.55),
    // Larger graphs → larger collision radius via sqrt curve: [18, 28], not [18, 32]
    collisionRadius: baseCollision * (1 + Math.sqrt(density) * 0.56),
  };
}

interface EngineCallbacks {
  onTick: (nodes: SimNode[]) => void;
  onEnd: () => void;
  onFallback?: (reason: string) => void;
}

export type SimulationEngine = {
  alpha: (n: number) => SimulationEngine;
  alphaTarget: (n: number) => SimulationEngine;
  restart: () => SimulationEngine;
  stop: () => SimulationEngine;
  nodes: () => SimNode[];
  force: (name: string) => d3.Force<SimNode, SimLink> | null;
  updateOptions: (opts: Partial<SimOptions>) => void;
  destroy: () => void;
  isWorker: () => boolean;
  hasFallback: () => boolean;
  dragStart: (nodeId: string, x: number, y: number) => void;
  dragMove: (nodeId: string, x: number, y: number) => void;
  dragEnd: (nodeId: string) => void;
  resize: (width: number, height: number) => void;
};

class LocalSimulationEngine implements SimulationEngine {
  private sim: Simulation<SimNode, SimLink>;
  private _nodes: SimNode[];
  private _links: SimLink[];
  private _options: SimOptions;

  constructor(nodes: SimNode[], links: SimLink[], options: SimOptions, callbacks: EngineCallbacks) {
    this._nodes = nodes;
    this._links = links;
    this._options = options;
    const nodeCount = nodes.length;

    // Apply adaptive physics: parameters scale with node count
    const adaptive = computeAdaptivePhysics(nodeCount, options);

    this.sim = d3.forceSimulation(nodes)
      .alpha(adaptive.alpha ?? 1)
      .alphaDecay(nodeCount > 40 ? 0.025 : 0.035)
      .velocityDecay(0.4)
      .on('tick', () => callbacks.onTick(nodes))
      .on('end', () => callbacks.onEnd());

    this.applyForces(adaptive);
  }

  private applyForces(opts: SimOptions) {
    const W = opts.width || 800;
    const H = opts.height || 600;
    const nodeCount = this._nodes.length;

    this.sim
      .force('link', d3.forceLink(this._links)
        .id((d: any) => d.id)
        .distance((d: any) => {
          if (d._linkTypeId !== undefined) return (opts.linkDistance || 90) * 0.9;
          if (d._isTypeInstLink) return (opts.linkDistance || 90) * 1.8;
          return (opts.linkDistance || 90) * 0.7;
        })
        .strength((d: any) => {
          if (d._linkTypeId !== undefined) return 0.8;
          if (d._isTypeInstLink) return 0.1;
          return 0.4;
        })
      )
      .force('charge', d3.forceManyBody<SimNode>().strength(opts.chargeStrength ?? -450))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide<SimNode>().radius(d => (d.size || 10) + (opts.collisionRadius ?? 18)))
      .force('x', d3.forceX<SimNode>(W / 2).strength(nodeCount > 40 ? 0.03 : 0.05))
      .force('y', d3.forceY<SimNode>(H / 2).strength(nodeCount > 40 ? 0.03 : 0.05));
  }

  alpha(n: number) { this.sim.alpha(n); return this; }
  alphaTarget(n: number) { this.sim.alphaTarget(n); return this; }
  restart() { this.sim.restart(); return this; }
  stop() { this.sim.stop(); return this; }
  nodes() { return this._nodes; }
  force(name: string) { return this.sim.force(name) as d3.Force<SimNode, SimLink> | null; }
  isWorker() { return false; }
  hasFallback() { return false; }
  dragStart(nodeId: string, x: number, y: number) {
    const n = this._nodes.find(nd => nd.id === nodeId);
    if (n) { n.fx = x; n.fy = y; }
  }
  dragMove(nodeId: string, x: number, y: number) {
    const n = this._nodes.find(nd => nd.id === nodeId);
    if (n) { n.fx = x; n.fy = y; }
  }
  dragEnd(nodeId: string) {
    const n = this._nodes.find(nd => nd.id === nodeId);
    if (n) { n.fx = null; n.fy = null; }
  }
  resize(width: number, height: number) {
    this._options = { ...this._options, width, height };
    this.applyForces(this._options);
    this.sim.alpha(0.1).restart();
  }

  updateOptions(opts: Partial<SimOptions>) {
    this._options = { ...this._options, ...opts };
    const nodeCount = this._nodes.length;
    const adaptive = computeAdaptivePhysics(nodeCount, this._options);
    this.applyForces(adaptive);
  }

  destroy() {
    this.sim.stop();
    // @ts-ignore - internal cleanup
    this.sim.on('tick', null);
    // @ts-ignore
    this.sim.on('end', null);
  }
}

class WorkerSimulationEngine implements SimulationEngine {
  private worker: Worker | null = null;
  private _nodes: SimNode[];
  private _links: SimLink[];
  private _options: SimOptions;
  private _callbacks: EngineCallbacks;
  private _localSim: Simulation<SimNode, SimLink> | null = null;
  private _tickCount = 0;
  private _fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private _didFallback = false;

  constructor(nodes: SimNode[], links: SimLink[], options: SimOptions, callbacks: EngineCallbacks) {
    this._nodes = nodes;
    this._links = links;
    this._options = options;
    this._callbacks = callbacks;

    // Pre-position nodes so the canvas is usable immediately even before Worker responds
    this._localSim = d3.forceSimulation(nodes)
      .alpha(0.1)
      .velocityDecay(1) // no movement, just hold initial positions
      .force('center', d3.forceCenter((options.width || 800) / 2, (options.height || 600) / 2));

    try {
      const worker = new Worker(new URL('../graph-simulation.worker.js', import.meta.url));
      worker.onmessage = this._handleWorkerMessage.bind(this);
      worker.onerror = (err) => {
        console.warn('[SimulationEngine] Worker error, falling back to local:', err);
        this._fallback('worker-error');
      };

      worker.postMessage({
        type: 'init',
        nodes: nodes.map(n => ({ ...n })),
        links: links.map(l => ({ ...l })),
        options,
      });

      // If Worker hasn't sent 'ready' in 10s, fall back to local
      this._fallbackTimer = setTimeout(() => {
        if (this.worker) {
          console.warn('[SimulationEngine] Worker timeout (10s), falling back to local');
          this._fallback('timeout');
        }
      }, 10000);
      this.worker = worker;
    } catch (err) {
      console.warn('[SimulationEngine] Worker init failed, using local simulation:', err);
      this._fallback('init-failed');
    }
  }

  private _fallback(reason: string) {
    if (this._fallbackTimer) { clearTimeout(this._fallbackTimer); this._fallbackTimer = null; }
    if (this.worker) { this.worker.terminate(); this.worker = null; }
    this._didFallback = true;
    // Replace with local simulation
    const local = new LocalSimulationEngine(this._nodes, this._links, this._options, this._callbacks);
    // @ts-ignore - swap internals
    this._localSim = local;
    this._callbacks.onFallback?.(reason);
  }

  private _handleWorkerMessage(e: MessageEvent) {
    // Ignore messages that arrive after fallback has been triggered
    if (!this.worker) return;

    const { type, nodes: tickNodes } = e.data;
    if (type === 'tick' && tickNodes) {
      this._tickCount++;
      tickNodes.forEach((n: { id: string; x: number; y: number; vx: number; vy: number }) => {
        if (typeof n?.id !== 'string') return;
        const node = this._nodes.find(nd => nd.id === n.id);
        if (node) { node.x = n.x; node.y = n.y; node.vx = n.vx; node.vy = n.vy; }
      });
      if (this._tickCount % 3 === 0) {
        try { this._callbacks.onTick(this._nodes); }
        catch (err) { console.error('[SimulationEngine] onTick threw:', err); }
      }
    } else if (type === 'end') {
      try { this._callbacks.onEnd(); }
      catch (err) { console.error('[SimulationEngine] onEnd threw:', err); }
    } else if (type === 'ready') {
      if (this._fallbackTimer) { clearTimeout(this._fallbackTimer); this._fallbackTimer = null; }
    } else if (type === 'error') {
      console.error('[SimulationEngine] Worker:', e.data.message);
    }
  }

  alpha(n: number) {
    this.worker?.postMessage({ type: 'reheat', alpha: n });
    return this;
  }
  alphaTarget(n: number) {
    // d3 alphaTarget affects the next alpha, approximate in worker
    this.worker?.postMessage({ type: 'reheat', alpha: n });
    return this;
  }
  restart() {
    this.worker?.postMessage({ type: 'reheat', alpha: 0.5 });
    return this;
  }
  stop() {
    this.worker?.postMessage({ type: 'stop' });
    return this;
  }
  // P3-3: Drag support via Worker messages
  dragStart(nodeId: string, x: number, y: number) {
    const node = this._nodes.find(n => n.id === nodeId);
    if (node) { node.fx = x; node.fy = y; }
    this.worker?.postMessage({ type: 'pinNode', nodeId, x, y });
  }
  dragMove(nodeId: string, x: number, y: number) {
    const node = this._nodes.find(n => n.id === nodeId);
    if (node) { node.fx = x; node.fy = y; }
    this.worker?.postMessage({ type: 'pinNode', nodeId, x, y });
  }
  dragEnd(nodeId: string) {
    const node = this._nodes.find(n => n.id === nodeId);
    if (node) { node.fx = null; node.fy = null; }
    this.worker?.postMessage({ type: 'unpinNode', nodeId });
  }

  // P3-3: Resize support
  resize(width: number, height: number) {
    this._options = { ...this._options, width, height };
    this.worker?.postMessage({ type: 'resize', width, height });
  }

  updateOptions(opts: Partial<SimOptions>) {
    this._options = { ...this._options, ...opts };
    this.worker?.postMessage({ type: 'updateForces', options: this._options });
  }

  nodes(): SimNode[] { return this._nodes; }

  force(name: string): d3.Force<SimNode, SimLink> | null {
    // Proxy force updates through the worker
    if (this.worker) {
      this.worker.postMessage({ type: 'updateForces', options: this._options });
    } else if (this._localSim) {
      return (this._localSim as any).force(name);
    }
    return null;
  }

  isWorker() { return this.worker !== null; }
  hasFallback() { return this._didFallback; }

  destroy() {
    if (this._fallbackTimer) { clearTimeout(this._fallbackTimer); }
    if (this.worker) {
      this.worker.postMessage({ type: 'stop' });
      this.worker.terminate();
      this.worker = null;
    }
    this._localSim?.stop();
  }
}

export function createSimulationEngine(
  nodes: SimNode[],
  links: SimLink[],
  options: SimOptions,
  callbacks: EngineCallbacks,
): SimulationEngine {
  const nodeCount = nodes.length;

  // Auto-select: Worker for large graphs, local for small
  if (nodeCount < 30) {
    return new LocalSimulationEngine(nodes, links, options, callbacks);
  }

  return new WorkerSimulationEngine(nodes, links, options, callbacks);
}
