/**
 * CanvasGraphRenderer.ts — High-performance HTML5 Canvas 2D Graph Renderer
 *
 * Provides smooth 60 FPS hardware-accelerated 2D canvas batch rendering for
 * knowledge graphs. Handles thousands of nodes and links with zero DOM overhead,
 * full hit-testing, zoom/pan transform synchronization, LOD, and selection highlighting.
 */

import type { GraphNode, GraphLink } from './D3GraphView.types';
import type { ScopeMode } from './D3GraphView.focus';

export interface CanvasTransform {
  k: number;
  x: number;
  y: number;
}

export interface CanvasGraphRenderOptions {
  nodes: GraphNode[];
  links: GraphLink[];
  transform: CanvasTransform;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  focusedNodeId: string | null;
  connectedNodeIds?: Set<string> | null;
  showWeakLinks?: boolean;
  weightThreshold?: number;
  collapsedNodes?: Set<string>;
  scopeMode?: ScopeMode;
}

export class CanvasGraphRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private animFrameId: number | null = null;
  private currentOptions: CanvasGraphRenderOptions | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
  }

  public resize(width: number, height: number): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    if (this.currentOptions) {
      this.render(this.currentOptions);
    }
  }

  public scheduleRender(options: CanvasGraphRenderOptions): void {
    this.currentOptions = options;
    if (this.animFrameId !== null) return;
    this.animFrameId = requestAnimationFrame(() => {
      this.animFrameId = null;
      if (this.currentOptions) {
        this.render(this.currentOptions);
      }
    });
  }

  public render(options: CanvasGraphRenderOptions): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.currentOptions = options;

    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.width / dpr;
    const h = this.canvas.height / dpr;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const {
      nodes,
      links,
      transform,
      selectedNodeId,
      hoveredNodeId,
      connectedNodeIds,
      showWeakLinks = true,
      weightThreshold = 0.2,
      collapsedNodes = new Set<string>(),
    } = options;

    const { k, x, y } = transform;
    ctx.translate(x, y);
    ctx.scale(k, k);

    // Viewport bounds for culling
    const vx0 = -x / k - 100;
    const vy0 = -y / k - 100;
    const vx1 = (w - x) / k + 100;
    const vy1 = (h - y) / k + 100;

    const hasHighlight = !!hoveredNodeId || !!selectedNodeId;
    const targetNodeId = hoveredNodeId || selectedNodeId;

    // Node lookup map
    const nodeMap = new Map<string, GraphNode>();
    for (let i = 0; i < nodes.length; i++) {
      nodeMap.set(nodes[i].id, nodes[i]);
    }

    // ── 1. RENDER LINKS ──────────────────────────────────────────────────────────
    for (let i = 0; i < links.length; i++) {
      const l = links[i];
      if (!showWeakLinks && l.weight !== undefined && l.weight < weightThreshold) {
        continue;
      }

      const sNode = typeof l.source === 'object' ? (l.source as GraphNode) : nodeMap.get(String(l.source));
      const tNode = typeof l.target === 'object' ? (l.target as GraphNode) : nodeMap.get(String(l.target));

      if (!sNode || !tNode || sNode.x == null || sNode.y == null || tNode.x == null || tNode.y == null) {
        continue;
      }

      const sx = sNode.x;
      const sy = sNode.y;
      const tx = tNode.x;
      const ty = tNode.y;

      // Skip link if both endpoints are outside the viewport
      if (
        (sx < vx0 && tx < vx0) ||
        (sx > vx1 && tx > vx1) ||
        (sy < vy0 && ty < vy0) ||
        (sy > vy1 && ty > vy1)
      ) {
        continue;
      }

      const isConnected = targetNodeId ? (sNode.id === targetNodeId || tNode.id === targetNodeId) : false;
      const alpha = hasHighlight ? (isConnected ? 1.0 : 0.12) : 0.75;
      const strokeColor = isConnected ? '#38bdf8' : (l.color || '#94a3b8');
      const baseWidth = isConnected ? 2.5 : (l._isTypeInstLink ? 1.2 : 1.5);

      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = baseWidth / Math.max(0.6, Math.min(1.4, Math.sqrt(k)));
      ctx.globalAlpha = alpha;

      if (l._isActionLink) {
        ctx.setLineDash([4, 4]);
      } else if (l._isTypeInstLink) {
        ctx.setLineDash([3, 3]);
      } else {
        ctx.setLineDash([]);
      }

      const offset = l._groupOffset || 0;
      if (offset !== 0) {
        const mx = (sx + tx) / 2;
        const my = (sy + ty) / 2;
        const dx = tx - sx;
        const dy = ty - sy;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = (-dy / len) * offset;
        const ny = (dx / len) * offset;
        const cpx = mx + nx;
        const cpy = my + ny;
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(cpx, cpy, tx, ty);
        ctx.stroke();

        // Draw arrow near target
        this.drawArrow(ctx, cpx, cpy, tx, ty, this.getNodeRadius(tNode), strokeColor, alpha);
      } else {
        ctx.moveTo(sx, sy);
        ctx.lineTo(tx, ty);
        ctx.stroke();

        // Draw arrow near target
        this.drawArrow(ctx, sx, sy, tx, ty, this.getNodeRadius(tNode), strokeColor, alpha);
      }
      ctx.restore();
    }

    // ── 2. RENDER NODES ──────────────────────────────────────────────────────────
    const showAllLabels = k >= 1.2;
    const showKeyLabels = k >= 0.55;

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.x == null || n.y == null) continue;

      const nx = n.x;
      const ny = n.y;
      const r = this.getNodeRadius(n);

      // Culling check
      if (nx + r < vx0 || nx - r > vx1 || ny + r < vy0 || ny - r > vy1) {
        continue;
      }

      const isSel = n.id === selectedNodeId;
      const isHov = n.id === hoveredNodeId;
      const isConn = connectedNodeIds ? connectedNodeIds.has(n.id) : false;
      const isTarget = isSel || isHov;

      let dimAlpha = 1.0;
      if (hasHighlight && !isTarget && !isConn) {
        dimAlpha = 0.22;
      }

      ctx.save();
      ctx.globalAlpha = dimAlpha;

      // 2.1 Selection or Hover Halo
      if (isSel) {
        ctx.beginPath();
        ctx.arc(nx, ny, r + 8, 0, Math.PI * 2);
        ctx.strokeStyle = '#FFD166';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#FFD166';
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (isHov) {
        ctx.beginPath();
        ctx.arc(nx, ny, r + 5, 0, Math.PI * 2);
        ctx.strokeStyle = '#66d9ef';
        ctx.lineWidth = 2.0;
        ctx.stroke();
      }

      // 2.2 Collapsed Node Ring
      const isCollapsed = collapsedNodes.has(n.id);
      if (isCollapsed) {
        ctx.beginPath();
        ctx.arc(nx, ny, r + 4, 0, Math.PI * 2);
        ctx.strokeStyle = '#FFD166';
        ctx.lineWidth = 2.0;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 2.3 Main Shape by Node Group
      const fillColor = n.color || '#a070d0';
      ctx.fillStyle = fillColor;
      ctx.strokeStyle = isTarget ? '#ffffff' : 'rgba(255,255,255,0.7)';
      ctx.lineWidth = isTarget ? 2.5 : 1.5;

      if (n.group === 'typeHub') {
        // Hexagon
        this.drawHexagon(ctx, nx, ny, r);
        ctx.fill();
        ctx.stroke();
      } else if (n.group === 'action') {
        // Circle with bolt icon
        ctx.beginPath();
        ctx.arc(nx, ny, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        // Instance: Rounded rectangle
        const side = r * 1.7;
        this.drawRoundRect(ctx, nx - side / 2, ny - side / 2, side, side, 4);
        ctx.fill();
        ctx.stroke();
      }

      // 2.4 Property Count Badge
      const propsCount = n._propsCount || 0;
      if (propsCount > 0 && k > 0.75) {
        const badgeR = Math.max(5, Math.min(8, 3 + propsCount));
        const bx = nx + r * 0.7;
        const by = ny - r * 0.7;
        ctx.beginPath();
        ctx.arc(bx, by, badgeR, 0, Math.PI * 2);
        ctx.fillStyle = '#9b8fff';
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = `bold ${Math.max(7, badgeR)}px sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(propsCount), bx, by);
      }

      // 2.5 Node Label
      const shouldDrawLabel = isTarget || showAllLabels || (showKeyLabels && (n.group === 'typeHub' || isConn));
      if (shouldDrawLabel && n.label) {
        const fontSize = n.group === 'typeHub' ? 11 : 9.5;
        ctx.font = `${n.group === 'typeHub' ? 'bold ' : ''}${fontSize}px sans-serif`;

        const displayLabel = n.label.length > 20 ? n.label.slice(0, 19) + '…' : n.label;
        const textMetrics = ctx.measureText(displayLabel);
        const textW = textMetrics.width;
        const textH = fontSize + 4;
        const textX = nx + r + 6;
        const textY = ny;

        // Label pill background for maximum legibility
        ctx.fillStyle = 'rgba(15, 20, 26, 0.82)';
        this.drawRoundRect(ctx, textX - 3, textY - textH / 2, textW + 6, textH, 3);
        ctx.fill();

        ctx.fillStyle = isSel ? '#FFD166' : (isHov ? '#66d9ef' : '#f8f8f2');
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(displayLabel, textX, textY);
      }

      ctx.restore();
    }

    ctx.restore();
  }

  private drawHexagon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const px = x + r * Math.cos(angle);
      const py = y + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  private drawRoundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    rad: number
  ): void {
    const r = Math.min(rad, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  private drawArrow(
    ctx: CanvasRenderingContext2D,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    targetRadius: number,
    color: string,
    alpha: number
  ): void {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < targetRadius + 10) return;

    const ux = dx / dist;
    const uy = dy / dist;

    // Position arrow head just outside target node boundary
    const ax = toX - ux * (targetRadius + 3);
    const ay = toY - uy * (targetRadius + 3);

    const arrowLen = 7;
    const arrowW = 4.5;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax - ux * arrowLen + uy * arrowW, ay - uy * arrowLen - ux * arrowW);
    ctx.lineTo(ax - ux * arrowLen - uy * arrowW, ay - uy * arrowLen + ux * arrowW);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  public getNodeRadius(node: GraphNode): number {
    if (node.size) return node.size;
    if (node.group === 'typeHub') {
      return node._hasInstances ? 26 : 18;
    }
    if (node.group === 'action') return 10;
    return 12;
  }

  /**
   * Spatial hit testing: maps screen coordinates (clientX/Y - canvasRect) to GraphNode.
   */
  public hitTest(screenX: number, screenY: number, nodes: GraphNode[], transform: CanvasTransform): GraphNode | null {
    const { k, x, y } = transform;
    const wx = (screenX - x) / k;
    const wy = (screenY - y) / k;

    let bestNode: GraphNode | null = null;
    let minDist = Infinity;

    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      if (n.x == null || n.y == null) continue;
      const r = this.getNodeRadius(n);
      const hitRadius = r + 6 / k;
      const dx = wx - n.x;
      const dy = wy - n.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= hitRadius && dist < minDist) {
        minDist = dist;
        bestNode = n;
      }
    }
    return bestNode;
  }

  /**
   * Spatial link hit testing: maps screen coordinates to GraphLink.
   */
  public hitTestLink(screenX: number, screenY: number, links: GraphLink[], transform: CanvasTransform): GraphLink | null {
    const { k, x, y } = transform;
    const wx = (screenX - x) / k;
    const wy = (screenY - y) / k;
    const threshold = 8 / k;

    for (let i = links.length - 1; i >= 0; i--) {
      const l = links[i];
      const sNode = typeof l.source === 'object' ? (l.source as GraphNode) : null;
      const tNode = typeof l.target === 'object' ? (l.target as GraphNode) : null;
      if (!sNode || !tNode || sNode.x == null || sNode.y == null || tNode.x == null || tNode.y == null) continue;

      const sx = sNode.x;
      const sy = sNode.y;
      const tx = tNode.x;
      const ty = tNode.y;

      const dx = tx - sx;
      const dy = ty - sy;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) continue;

      const t = Math.max(0, Math.min(1, ((wx - sx) * dx + (wy - sy) * dy) / lenSq));
      const projX = sx + t * dx;
      const projY = sy + t * dy;
      const dist = Math.hypot(wx - projX, wy - projY);

      if (dist <= threshold) {
        return l;
      }
    }
    return null;
  }

  public destroy(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.ctx = null;
  }
}
