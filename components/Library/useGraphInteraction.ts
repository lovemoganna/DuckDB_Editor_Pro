/**
 * useGraphInteraction — drag, zoom, pan, and brush interaction state
 *
 * Encapsulates D3 zoom behavior refs and interaction mode management.
 */

import { useState, useRef, useCallback } from 'react';
import * as d3 from 'd3';

export interface InteractionState {
  interactionMode: 'select' | 'connect';
  zoomScale: number;
  panOffset: { x: number; y: number };
}

export interface UseGraphInteractionResult {
  interactionMode: 'select' | 'connect';
  interactionModeRef: React.MutableRefObject<'select' | 'connect'>;
  setInteractionMode: (m: 'select' | 'connect') => void;
  zoomScale: number;
  panOffset: { x: number; y: number };
  // D3 zoom ref is managed by the component; this hook provides helpers
  fitAll: (svgRef: React.RefObject<SVGSVGElement | null>, zoomRef: React.RefObject<d3.ZoomBehavior<SVGSVGElement, unknown> | null>, nodesRef: React.RefObject<import('./D3GraphView/D3GraphView.types').GraphNode[]>) => void;
  zoomIn: (svgRef: React.RefObject<SVGSVGElement | null>, zoomRef: React.RefObject<d3.ZoomBehavior<SVGSVGElement, unknown> | null>) => void;
  zoomOut: (svgRef: React.RefObject<SVGSVGElement | null>, zoomRef: React.RefObject<d3.ZoomBehavior<SVGSVGElement, unknown> | null>) => void;
}

import type { GraphNode } from './D3GraphView/D3GraphView.types';

export function useGraphInteraction(): UseGraphInteractionResult {
  const [interactionMode, setInteractionModeRaw] = useState<'select' | 'connect'>('select');
  const interactionModeRef = useRef<'select' | 'connect'>('select');
  const [zoomScale, setZoomScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  const setInteractionMode = useCallback((m: 'select' | 'connect') => {
    setInteractionModeRaw(m);
    interactionModeRef.current = m;
  }, []);

  const fitAll = useCallback((
    svgRef: React.RefObject<SVGSVGElement | null>,
    zoomRef: React.RefObject<d3.ZoomBehavior<SVGSVGElement, unknown> | null>,
    nodesRef: React.RefObject<GraphNode[]>,
  ) => {
    if (!svgRef.current || !zoomRef.current || !nodesRef.current?.length) return;
    const nodes = nodesRef.current;
    const xs = nodes.map(n => n.x || 0);
    const ys = nodes.map(n => n.y || 0);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const W = svgRef.current.clientWidth, H = svgRef.current.clientHeight;
    const PAD = 60;
    const bw = maxX - minX || 1, bh = maxY - minY || 1;
    const scale = Math.min((W - PAD * 2) / bw, (H - PAD * 2) / bh, 2.5);
    const tx = W / 2 - (minX + bw / 2) * scale;
    const ty = H / 2 - (minY + bh / 2) * scale;
    d3.select(svgRef.current).transition().duration(600)
      .call(zoomRef.current.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    setZoomScale(scale);
    setPanOffset({ x: tx, y: ty });
  }, []);

  const zoomIn = useCallback((
    svgRef: React.RefObject<SVGSVGElement | null>,
    zoomRef: React.RefObject<d3.ZoomBehavior<SVGSVGElement, unknown> | null>,
  ) => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1.4);
  }, []);

  const zoomOut = useCallback((
    svgRef: React.RefObject<SVGSVGElement | null>,
    zoomRef: React.RefObject<d3.ZoomBehavior<SVGSVGElement, unknown> | null>,
  ) => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1 / 1.4);
  }, []);

  return {
    interactionMode,
    interactionModeRef: interactionModeRef as React.MutableRefObject<'select' | 'connect'>,
    setInteractionMode,
    zoomScale,
    panOffset,
    fitAll,
    zoomIn,
    zoomOut,
  };
}
