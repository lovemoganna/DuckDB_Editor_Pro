/**
 * PixiGraphRenderer — WebGL rendering layer for large knowledge graphs.
 *
 * Strategy: Hybrid rendering
 *   - SVG stays: links (lines), labels (text), cluster boundaries
 *   - PixiJS takes over: node circles, badges, icons, using cached PIXI.Container instances
 *
 * LOD (Level of Detail):
 *   - Zoom >= 2.5x: Full detail — circles, stroke highlights, badges, labels
 *   - Zoom 0.8x-2.5x: Medium — circles + stroke highlights
 *   - Zoom < 0.8x: Low — circles only, no stroke details or badges/labels
 */

import * as PIXI from 'pixi.js';
import * as d3 from 'd3';

export interface PixiNode {
  id: string;
  x: number;
  y: number;
  color: string;
  size: number;
  group: string;
  label: string;
  badgeCount?: number;
  isHovered?: boolean;
  isSelected?: boolean;
}

export interface PixiRendererOptions {
  container: HTMLElement;
  nodeCount: number;
  onNodeClick?: (id: string) => void;
  onNodeHover?: (id: string | null) => void;
  onNodeDoubleClick?: (id: string) => void;
  onContextMenu?: (id: string, x: number, y: number) => void;
  activateThreshold?: number;
}

export class PixiGraphRenderer {
  private app: PIXI.Application | null = null;
  private container: HTMLElement;
  
  // High-performance cache of Pixi containers and graphic components
  private nodeContainers: Map<string, PIXI.Container> = new Map();
  private nodeGraphics: Map<string, PIXI.Graphics> = new Map();
  private nodeLabels: Map<string, PIXI.Text> = new Map();
  private nodeBadges: Map<string, PIXI.Graphics> = new Map();
  private nodeBadgeTexts: Map<string, PIXI.Text> = new Map();

  private overlayEl: HTMLDivElement | null = null;
  private canvasEl: HTMLCanvasElement | null = null;
  private isEnabled = false;
  private activeNodeCount = 0;
  private activateThreshold: number;
  private currentScale = 1;
  private currentTranslate = { x: 0, y: 0 };
  private rafId: number | null = null;
  private pendingUpdates = false;
  private nodeData: Map<string, PixiNode> = new Map();
  private hoveredNodeId: string | null = null;
  private selectedNodeId: string | null = null;
  private egoNodeIds: Set<string> | null = null; // Node IDs to highlight in local focus mode
  private viewportCullBuffer = 200; // px beyond viewport to pre-render
  private spatialIndex: d3.Quadtree<{ id: string; x: number; y: number; size: number }> | null = null;
  private nodeDirtyFlags: Map<string, boolean> = new Map(); // true = geometry needs redraw

  private onNodeClick?: (id: string) => void;
  private onNodeHover?: (id: string | null) => void;
  private onNodeDoubleClick?: (id: string) => void;
  private onContextMenu?: (id: string, x: number, y: number) => void;

  constructor(options: PixiRendererOptions) {
    this.container = options.container;
    this.activateThreshold = options.activateThreshold ?? 200;
    this.onNodeClick = options.onNodeClick;
    this.onNodeHover = options.onNodeHover;
    this.onNodeDoubleClick = options.onNodeDoubleClick;
    this.onContextMenu = options.onContextMenu;
  }

  async init(): Promise<void> {
    if (this.app) return;
    this.app = new PIXI.Application();
    // PIXI v8: init() returns Promise<void>; cancelResize tracking removed
    await this.app.init({
      width: this.container.clientWidth || 800,
      height: this.container.clientHeight || 600,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    this.canvasEl = this.app.canvas as HTMLCanvasElement;
    this.overlayEl = document.createElement('div');
    this.overlayEl.style.cssText = `
      position: absolute; inset: 0; pointer-events: none;
      mix-blend-mode: normal; z-index: 5;
    `;
    this.overlayEl.appendChild(this.canvasEl);
    this.container.appendChild(this.overlayEl);
    this.setupInteraction();
  }

  private setupInteraction() {
    if (!this.canvasEl) return;
    this.canvasEl.style.pointerEvents = 'all';
    this.canvasEl.style.cursor = 'default';
    this.canvasEl.addEventListener('click', (e) => {
      if (!this.app) return;
      const rect = this.canvasEl!.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const node = this.hitTest(mx, my);
      if (node) {
        this.onNodeClick?.(node);
      }
    });
    this.canvasEl.addEventListener('mousemove', (e) => {
      if (!this.app) return;
      const rect = this.canvasEl!.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const node = this.hitTest(mx, my);
      const newHover = node ?? null;
      if (newHover !== this.hoveredNodeId) {
        this.hoveredNodeId = newHover;
        this.canvasEl!.style.cursor = newHover ? 'pointer' : 'default';
        this.onNodeHover?.(newHover);
        this.scheduleUpdate();
      }
    });
    this.canvasEl.addEventListener('dblclick', (e) => {
      if (!this.app) return;
      const rect = this.canvasEl!.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const node = this.hitTest(mx, my);
      if (node) this.onNodeDoubleClick?.(node);
    });
    this.canvasEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!this.app) return;
      const rect = this.canvasEl!.getBoundingClientRect();
      const node = this.hitTest(e.clientX - rect.left, e.clientY - rect.top);
      if (node) this.onContextMenu?.(node, e.clientX, e.clientY);
    });
    this.canvasEl.addEventListener('mouseleave', () => {
      if (this.hoveredNodeId !== null) {
        this.hoveredNodeId = null;
        this.onNodeHover?.(null);
        this.scheduleUpdate();
      }
    });
  }

  private hitTest(screenX: number, screenY: number): string | null {
    if (!this.app || !this.spatialIndex) return null;
    const worldX = (screenX - this.currentTranslate.x) / this.currentScale;
    const worldY = (screenY - this.currentTranslate.y) / this.currentScale;
    const R = 50 / this.currentScale; // max node radius in world coords
    let closestId: string | null = null;
    let minDist = Infinity;
    this.spatialIndex.visit((node, x0, y0, x1, y1) => {
      if (!node.length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = (node as any).data as { id: string; x: number; y: number; size: number }[];
        for (const n of d) {
          const dx = worldX - n.x, dy = worldY - n.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= n.size + 4 && dist < minDist) {
            minDist = dist; closestId = n.id;
          }
        }
      }
      // Skip subtrees entirely outside search radius
      return x0 > worldX + R || x1 < worldX - R || y0 > worldY + R || y1 < worldY - R;
    });
    return closestId;
  }

  /**
   * Schedule a render update on the next animation frame.
   */
  scheduleUpdate(): void {
    this.pendingUpdates = true;
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null;
        if (this.pendingUpdates) {
          this.pendingUpdates = false;
          this.renderFrame();
        }
      });
    }
  }

  /**
   * Update the zoom/pan transform from the SVG zoom layer.
   */
  setTransform(scale: number, translateX: number, translateY: number): void {
    this.currentScale = scale;
    this.currentTranslate = { x: translateX, y: translateY };
    if (this.app) {
      this.app.stage.pivot.set(0, 0);
      this.app.stage.scale.set(scale, scale);
      this.app.stage.position.set(translateX, translateY);
    }
    this.scheduleUpdate();
  }

  /**
   * Full re-render from node data.
   */
  setNodes(data: PixiNode[]): void {
    this.nodeData.clear();
    this.nodeDirtyFlags.clear();
    data.forEach(n => {
      this.nodeData.set(n.id, n);
      this.nodeDirtyFlags.set(n.id, true);
    });

    // Auto-activate when threshold exceeded
    if (!this.isEnabled && data.length > this.activateThreshold) {
      this.activate();
      return;
    }
    if (this.isEnabled && data.length <= this.activateThreshold) {
      this.deactivate();
      return;
    }
    // Rebuild spatial index when node set changes
    this.rebuildSpatialIndex();
    this.scheduleUpdate();
  }

  updatePositions(positions: Array<{ id: string; x: number; y: number }>): void {
    let needsRender = false;
    positions.forEach(p => {
      const nd = this.nodeData.get(p.id);
      if (nd) {
        nd.x = p.x;
        nd.y = p.y;
        this.nodeDirtyFlags.set(p.id, true);
        needsRender = true;
      }
    });
    if (needsRender) {
      this.rebuildSpatialIndex();
      this.scheduleUpdate();
    }
  }

  setSelectedNode(id: string | null): void {
    const prev = this.selectedNodeId;
    this.selectedNodeId = id;
    if (prev) this.nodeDirtyFlags.set(prev, true);
    if (id) this.nodeDirtyFlags.set(id, true);
    this.scheduleUpdate();
  }

  setEgoNetwork(egoNodeIds: Set<string> | null): void {
    // Mark all nodes dirty so dimAlpha recomputes on the next frame
    this.nodeData.forEach((_, id) => this.nodeDirtyFlags.set(id, true));
    this.egoNodeIds = egoNodeIds;
    this.scheduleUpdate();
  }

  activate(): void {
    if (this.isEnabled) return;
    this.isEnabled = true;
    this.init().then(() => {
      if (this.app) {
        this.app.start();
        this.scheduleUpdate();
      }
    }).catch(err => {
      console.error('[PixiGraphRenderer] Init failed:', err);
      this.isEnabled = false;
    });
  }

  deactivate(): void {
    if (!this.isEnabled) return;
    this.isEnabled = false;
    this.spatialIndex = null;
    if (this.app) {
      this.app.stop();
    }
    if (this.overlayEl && this.overlayEl.parentNode) {
      this.overlayEl.parentNode.removeChild(this.overlayEl);
    }
    this.nodeContainers.forEach(c => c.destroy({ children: true }));
    this.nodeContainers.clear();
    this.nodeGraphics.clear();
    this.nodeLabels.clear();
    this.nodeBadges.clear();
    this.nodeBadgeTexts.clear();
  }

  isActive(): boolean {
    return this.isEnabled;
  }

  setViewportBuffer(buffer: number): void {
    this.viewportCullBuffer = buffer;
  }

  private rebuildSpatialIndex(): void {
    const points = Array.from(this.nodeData.values()).map(n => ({
      id: n.id, x: n.x, y: n.y, size: n.size,
    }));
    this.spatialIndex = d3.quadtree<{ id: string; x: number; y: number; size: number }>()
      .x(d => d.x).y(d => d.y)
      .addAll(points);
  }

  /**
   * Returns visible node IDs within the current viewport.
   * Used by D3GraphView for stats/metrics.
   */
  getVisibleNodeIds(): string[] {
    const nodes: string[] = [];
    const W = this.container.clientWidth || 800;
    const H = this.container.clientHeight || 600;
    const [x0, y0] = this.currentScale > 0
      ? [(0 - this.currentTranslate.x) / this.currentScale, (0 - this.currentTranslate.y) / this.currentScale]
      : [0, 0];
    const [x1, y1] = this.currentScale > 0
      ? [(W - this.currentTranslate.x) / this.currentScale, (H - this.currentTranslate.y) / this.currentScale]
      : [W, H];
    const B = this.viewportCullBuffer;
    this.nodeData.forEach((nd, id) => {
      if (nd.x >= x0 - B && nd.x <= x1 + B && nd.y >= y0 - B && nd.y <= y1 + B) {
        nodes.push(id);
      }
    });
    return nodes;
  }

  /**
   * Reconcile stage children to match nodeData.
   * Allocates containers and elements once, then caches them.
   */
  private reconcileGraphics(): void {
    if (!this.app) return;
    const stage = this.app.stage;

    // 1. Remove old nodes
    for (const [id, container] of this.nodeContainers) {
      if (!this.nodeData.has(id)) {
        stage.removeChild(container);
        container.destroy({ children: true });
        this.nodeContainers.delete(id);
        this.nodeGraphics.delete(id);
        this.nodeLabels.delete(id);
        this.nodeBadges.delete(id);
        this.nodeBadgeTexts.delete(id);
      }
    }

    // 2. Add or update current nodes
    this.nodeData.forEach((nd, id) => {
      let container = this.nodeContainers.get(id);
      if (!container) {
        container = new PIXI.Container();
        stage.addChild(container);
        this.nodeContainers.set(id, container);
      }

      // Main circle graphics
      let g = this.nodeGraphics.get(id);
      if (!g) {
        g = new PIXI.Graphics();
        container.addChild(g);
        this.nodeGraphics.set(id, g);
      }

      // Badge graphics & badge text
      let bG = this.nodeBadges.get(id);
      let bTxt = this.nodeBadgeTexts.get(id);
      if (nd.badgeCount && nd.badgeCount > 0) {
        if (!bG) {
          bG = new PIXI.Graphics();
          container.addChild(bG);
          this.nodeBadges.set(id, bG);
        }
        if (!bTxt) {
          bTxt = new PIXI.Text({
            text: String(nd.badgeCount),
            style: { fontSize: 6, fill: 0xffffff, fontWeight: 'bold' }
          });
          bTxt.anchor.set(0.5);
          container.addChild(bTxt);
          this.nodeBadgeTexts.set(id, bTxt);
        }
      }

      // Label text
      let lbl = this.nodeLabels.get(id);
      if (!lbl) {
        const lblStyle = new PIXI.TextStyle({
          fontSize: nd.group === 'typeHub' ? 11 : 9,
          fill: 0xe8f4ff,
          fontWeight: nd.group === 'typeHub' ? 'bold' : 'normal',
          dropShadow: { color: 0x000000, blur: 3, distance: 1 },
        });
        const displayLabel = nd.label.length > 16 ? nd.label.slice(0, 16) + '…' : nd.label;
        lbl = new PIXI.Text({ text: displayLabel, style: lblStyle });
        lbl.anchor.set(0, 0.5);
        container.addChild(lbl);
        this.nodeLabels.set(id, lbl);
      } else {
        const displayLabel = nd.label.length > 16 ? nd.label.slice(0, 16) + '…' : nd.label;
        if (lbl.text !== displayLabel) {
          lbl.text = displayLabel;
        }
      }

      // Adjust relative positions within container
      const r = nd.size;
      lbl.position.set(r + 5, 0);

      if (bG && bTxt) {
        const badgeR = Math.max(4, Math.min(7, 3 + (nd.badgeCount ?? 0) * 1.2));
        bG.clear();
        bG.circle(r * 0.65, -r * 0.65, badgeR);
        bG.fill({ color: 0x9b8fff });
        bG.circle(r * 0.65, -r * 0.65, badgeR);
        bG.stroke({ color: 0x000000, width: 0.5, alpha: 0.5 });

        bTxt.style.fontSize = Math.max(6, badgeR - 1);
        bTxt.position.set(r * 0.65, -r * 0.65);
      }

      // Sync container position
      container.position.set(nd.x, nd.y);
    });
  }

  /**
   * Performs high-speed viewport culling and dynamic LOD updates.
   */
  private renderFrame(): void {
    if (!this.app || !this.isEnabled) return;
    
    // First synchronize geometry and containers
    this.reconcileGraphics();

    const lod = this.currentScale < 0.8 ? 'low' : this.currentScale < 2.5 ? 'medium' : 'high';
    const W = this.container.clientWidth || 800;
    const H = this.container.clientHeight || 600;

    const vx0 = (0 - this.currentTranslate.x) / this.currentScale;
    const vy0 = (0 - this.currentTranslate.y) / this.currentScale;
    const vx1 = (W - this.currentTranslate.x) / this.currentScale;
    const vy1 = (H - this.currentTranslate.y) / this.currentScale;
    const B = this.viewportCullBuffer;

    this.nodeData.forEach((nd, id) => {
      const container = this.nodeContainers.get(id);
      if (!container) return;

      // 1. Viewport culling
      if (nd.x < vx0 - B || nd.x > vx1 + B || nd.y < vy0 - B || nd.y > vy1 + B) {
        container.visible = false;
        return;
      }
      container.visible = true;

      // 2. Set current position
      container.position.set(nd.x, nd.y);

      const isHov = id === this.hoveredNodeId;
      const isSel = id === this.selectedNodeId;
      
      // Determine if node is highlighted in the active ego network
      const isInEgoNetwork = this.egoNodeIds === null || this.egoNodeIds.has(id);
      const dimAlpha = isInEgoNetwork ? 1.0 : 0.15;

      const g = this.nodeGraphics.get(id);
      const lbl = this.nodeLabels.get(id);
      const bG = this.nodeBadges.get(id);
      const bTxt = this.nodeBadgeTexts.get(id);

      // Redraw geometry only when appearance state changed (dirty-flag optimization)
      const isDirty = this.nodeDirtyFlags.get(id);
      if (isDirty && g) {
        g.clear();
        if (lod === 'low') {
          g.circle(0, 0, nd.size);
          g.fill({ color: nd.color, alpha: (isHov ? 1.0 : 0.9) * dimAlpha });
          if (isSel) {
            g.circle(0, 0, nd.size + 5);
            g.stroke({ color: 0x7ee8fa, width: 2, alpha: 0.8 * dimAlpha });
          }
        } else {
          // Medium / High LOD
          const baseAlpha = isHov ? 1.0 : 0.95;
          g.circle(0, 0, nd.size);
          g.fill({ color: nd.color, alpha: baseAlpha * dimAlpha });
          g.circle(0, 0, nd.size);
          g.stroke({ color: 'rgba(180,210,255,0.65)', width: 2, alpha: (isHov ? 1.0 : 0.8) * dimAlpha });

          if (isSel) {
            g.circle(0, 0, nd.size + 6);
            g.stroke({ color: 0x7ee8fa, width: 2, alpha: 0.9 * dimAlpha });
            g.circle(0, 0, nd.size + 10);
            g.stroke({ color: 0x7ee8fa, width: 1, alpha: 0.4 * dimAlpha });
          }
          if (isHov) {
            g.circle(0, 0, nd.size + 4);
            g.stroke({ color: nd.color, width: 2, alpha: 0.5 * dimAlpha });
          }
        }
        this.nodeDirtyFlags.set(id, false);
      }

      // LOD visibility toggles
      if (lod === 'low') {
        if (lbl) lbl.visible = false;
        if (bG) bG.visible = false;
        if (bTxt) bTxt.visible = false;
      } else if (lod === 'medium') {
        if (lbl) lbl.visible = false;
        if (bG) bG.visible = false;
        if (bTxt) bTxt.visible = false;
      } else {
        // High LOD
        if (lbl) {
          lbl.visible = true;
          lbl.alpha = dimAlpha;
          lbl.style.fill = isSel ? 0x7ee8fa : 0xe8f4ff;
        }
        const hasBadge = !!(nd.badgeCount && nd.badgeCount > 0);
        if (bG) {
          bG.visible = hasBadge;
          bG.alpha = dimAlpha;
        }
        if (bTxt) {
          bTxt.visible = hasBadge;
          bTxt.alpha = dimAlpha;
        }
      }
    });
  }

  resize(width: number, height: number): void {
    if (this.app) {
      this.app.renderer.resize(width, height);
      this.scheduleUpdate();
    }
  }

  destroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    if (this.app) {
      this.app.destroy(true, { children: true });
      this.app = null;
    }
    if (this.overlayEl && this.overlayEl.parentNode) {
      this.overlayEl.parentNode.removeChild(this.overlayEl);
    }
    this.nodeContainers.forEach(c => c.destroy({ children: true }));
    this.nodeContainers.clear();
    this.nodeGraphics.clear();
    this.nodeLabels.clear();
    this.nodeBadges.clear();
    this.nodeBadgeTexts.clear();
    this.nodeData.clear();
  }
}
