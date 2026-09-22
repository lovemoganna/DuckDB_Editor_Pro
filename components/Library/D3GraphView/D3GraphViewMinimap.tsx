/**
 * D3GraphViewMinimap — bottom-right canvas minimap showing graph overview.
 * Self-contained: manages its own canvas, receives all data via props.
 */
import React, { useRef, useEffect } from 'react';
import type { GraphNode } from './D3GraphView.types';

interface D3GraphViewMinimapProps {
  nodes: GraphNode[];
  zoomK: number;
  zoomX: number;
  zoomY: number;
  onViewportDrag?: (tx: number, ty: number) => void;
  svgRef?: React.RefObject<SVGSVGElement | null>;
}

export const D3GraphViewMinimap: React.FC<D3GraphViewMinimapProps> = ({
  nodes,
  zoomK,
  zoomX,
  zoomY,
  onViewportDrag,
  svgRef,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef({ dragging: false, lastX: 0, lastY: 0 });
  const minimapDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Debounce: avoid thrashing canvas redraws
    if (minimapDebounceRef.current) clearTimeout(minimapDebounceRef.current);
    minimapDebounceRef.current = setTimeout(() => {
      const W = 160, H = 120, PAD = 10;
      ctx.clearRect(0, 0, W, H);

      if (!nodes.length) return;

      const xs = nodes.map(n => n.x || 0);
      const ys = nodes.map(n => n.y || 0);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const bw = maxX - minX || 1, bh = maxY - minY || 1;
      const mmScale = Math.min((W - PAD * 2) / bw, (H - PAD * 2) / bh);

      // Node density heatmap (8×8 grid) — only for large graphs
      if (nodes.length > 100) {
        const GRID = 8;
        const cellW = (W - PAD * 2) / GRID;
        const cellH = (H - PAD * 2) / GRID;
        const density = Array.from({ length: GRID * GRID }, () => 0);
        nodes.forEach(n => {
          const mx = ((n.x || 0) - minX) * mmScale + PAD;
          const my = ((n.y || 0) - minY) * mmScale + PAD;
          const gx = Math.min(GRID - 1, Math.max(0, Math.floor((mx - PAD) / cellW)));
          const gy = Math.min(GRID - 1, Math.max(0, Math.floor((my - PAD) / cellH)));
          density[gy * GRID + gx]++;
        });
        const maxD = Math.max(...density, 1);
        density.forEach((count, i) => {
          if (count === 0) return;
          const gx = i % GRID;
          const gy = Math.floor(i / GRID);
          const alpha = 0.08 + 0.32 * (count / maxD);
          ctx.fillStyle = `rgba(126,232,250,${alpha})`;
          ctx.fillRect(PAD + gx * cellW, PAD + gy * cellH, cellW, cellH);
        });
      }

      // Draw nodes
      nodes.forEach(n => {
        const mx = ((n.x || 0) - minX) * mmScale + PAD;
        const my = ((n.y || 0) - minY) * mmScale + PAD;
        ctx.beginPath();
        ctx.arc(mx, my, n.group === 'typeHub' ? 4 : 2, 0, Math.PI * 2);
        ctx.fillStyle = n.color || '#c77dff';
        ctx.globalAlpha = 0.6;
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Store scale/offset for drag handler
      (canvas as any).__mmScale = mmScale;
      (canvas as any).__minX = minX;
      (canvas as any).__minY = minY;

      // Draw current viewport rectangle
      if (svgRef?.current) {
        const svgW = svgRef.current.clientWidth || 800;
        const svgH = svgRef.current.clientHeight || 600;
        const rectX = (-zoomX / zoomK - minX) * mmScale + PAD;
        const rectY = (-zoomY / zoomK - minY) * mmScale + PAD;
        const rectW = (svgW / zoomK) * mmScale;
        const rectH = (svgH / zoomK) * mmScale;
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(rectX, rectY, rectW, rectH);
      }
    }, 50);
  }, [nodes, zoomK, zoomX, zoomY]);

  // Drag: clicking on minimap moves the viewport
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !onViewportDrag) return;

    const onMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      dragRef.current = { dragging: true, lastX: e.clientX, lastY: e.clientY };
      e.preventDefault();
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current.dragging) return;
      const dx = e.clientX - dragRef.current.lastX;
      const dy = e.clientY - dragRef.current.lastY;
      dragRef.current.lastX = e.clientX;
      dragRef.current.lastY = e.clientY;
      // Convert minimap pixel delta to SVG pan delta (inverse of mmScale)
      const mmScale = (canvas as any).__mmScale || 1;
      onViewportDrag(-dx / mmScale, -dy / mmScale);
    };
    const onMouseUp = () => { dragRef.current.dragging = false; };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onViewportDrag]);

  return (
    <canvas
      ref={canvasRef}
      width={160}
      height={120}
      className="absolute bottom-3 right-3 rounded-lg border border-monokai-border/30 cursor-crosshair z-10"
      style={{ imageRendering: 'crisp-edges' }}
      title="Minimap — click/drag to navigate"
    />
  );
};
