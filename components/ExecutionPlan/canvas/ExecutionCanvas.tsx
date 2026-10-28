/**
 * components/ExecutionPlan/canvas/ExecutionCanvas.tsx
 *
 * Master Execution Canvas for DuckDB Query X-Ray.
 * Combines SVG Edge Layer and HTML Node Cards.
 * Manages viewport pan/zoom, auto-layout updates, and selection states.
 */

import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  ExecutionPlanGraph,
  LensType,
  LayoutDirection,
} from '../model/types';
import { computeGraphLayout } from '../layout/planLayout';
import { HtmlNodeCard } from './HtmlNodeCard';
import { SvgEdgeLayer } from './SvgEdgeLayer';
import { CanvasControls } from './CanvasControls';

export interface ExecutionCanvasProps {
  graph: ExecutionPlanGraph;
  lens: LensType;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  direction?: LayoutDirection;
  onDirectionChange?: (dir: LayoutDirection) => void;
}

export const ExecutionCanvas: React.FC<ExecutionCanvasProps> = ({
  graph,
  lens,
  selectedNodeId,
  onSelectNode,
  direction: controlledDirection,
  onDirectionChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [internalDirection, setInternalDirection] = useState<LayoutDirection>('LR');
  const activeDirection = controlledDirection ?? internalDirection;

  // Viewport transforms: pan (x, y) and zoom scale (default 80% centered)
  const [viewport, setViewport] = useState<{ x: number; y: number; scale: number }>({
    x: 40,
    y: 40,
    scale: 0.8,
  });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ startX: number; startY: number; panX: number; panY: number }>({
    startX: 0,
    startY: 0,
    panX: 40,
    panY: 40,
  });

  const scale = viewport.scale;
  const pan = { x: viewport.x, y: viewport.y };

  // Calculate layout
  const layout = useMemo(() => {
    return computeGraphLayout(graph, activeDirection);
  }, [graph, activeDirection]);

  // Compute upstream and downstream lineage highlight when a node is selected
  const { highlightedNodeIds, highlightedEdgeIds } = useMemo(() => {
    const nodeIds = new Set<string>();
    const edgeIds = new Set<string>();

    if (!selectedNodeId || !graph.nodes.has(selectedNodeId)) {
      return { highlightedNodeIds: nodeIds, highlightedEdgeIds: edgeIds };
    }

    nodeIds.add(selectedNodeId);

    // Upstream walk (children)
    const walkUpstream = (currId: string) => {
      const node = graph.nodes.get(currId);
      if (!node) return;
      for (const childId of node.childrenIds) {
        nodeIds.add(childId);
        edgeIds.add(`edge_${childId}_to_${currId}`);
        walkUpstream(childId);
      }
    };

    // Downstream walk (parents)
    const walkDownstream = (currId: string) => {
      const node = graph.nodes.get(currId);
      if (!node) return;
      for (const parentId of node.parentIds) {
        nodeIds.add(parentId);
        edgeIds.add(`edge_${currId}_to_${parentId}`);
        walkDownstream(parentId);
      }
    };

    walkUpstream(selectedNodeId);
    walkDownstream(selectedNodeId);

    return { highlightedNodeIds: nodeIds, highlightedEdgeIds: edgeIds };
  }, [selectedNodeId, graph]);

  // Auto-fit to screen and center at 80% scale
  const fitToView = useCallback(() => {
    if (!containerRef.current || layout.width === 0 || layout.height === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const targetScale = 0.8;
    const targetX = (rect.width - layout.width * targetScale) / 2;
    const targetY = (rect.height - layout.height * targetScale) / 2;

    setViewport({
      scale: targetScale,
      x: Math.round(targetX),
      y: Math.round(targetY),
    });
  }, [layout]);

  useEffect(() => {
    fitToView();
  }, [graph.rootNodeId, activeDirection]); // eslint-disable-line react-hooks/exhaustive-deps

  // Zoom centered on canvas viewport center (for toolbar buttons)
  const zoomFromCenter = useCallback((factor: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    setViewport(prev => {
      const nextScale = Math.min(2.5, Math.max(0.2, Number((prev.scale * factor).toFixed(3))));
      if (nextScale === prev.scale) return prev;

      const scaleRatio = nextScale / prev.scale;
      return {
        x: Math.round(centerX - (centerX - prev.x) * scaleRatio),
        y: Math.round(centerY - (centerY - prev.y) * scaleRatio),
        scale: nextScale,
      };
    });
  }, []);

  const handleZoomIn = () => zoomFromCenter(1.15);
  const handleZoomOut = () => zoomFromCenter(0.85);
  const handleResetZoom = () => {
    fitToView();
  };

  const handleToggleDirection = () => {
    // Cycle: BT (Vertical Bottom-Up) -> LR (Horizontal Left-to-Right) -> TB (Vertical Top-Down) -> BT
    let nextDir: LayoutDirection = 'LR';
    if (activeDirection === 'BT') nextDir = 'LR';
    else if (activeDirection === 'LR') nextDir = 'TB';
    else nextDir = 'BT';

    if (onDirectionChange) {
      onDirectionChange(nextDir);
    } else {
      setInternalDirection(nextDir);
    }
  };

  // Zoom anchored directly at mouse pointer (Middle Wheel / Wheel Zoom)
  const handleWheelZoom = useCallback((deltaY: number, clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cursorX = clientX - rect.left;
    const cursorY = clientY - rect.top;

    setViewport(prev => {
      // deltaY < 0 is scroll up (Zoom In); deltaY > 0 is scroll down (Zoom Out)
      const zoomFactor = deltaY < 0 ? 1.10 : 0.90;
      const nextScale = Math.min(2.5, Math.max(0.2, Number((prev.scale * zoomFactor).toFixed(3))));
      if (nextScale === prev.scale) return prev;

      const scaleRatio = nextScale / prev.scale;
      const nextX = cursorX - (cursorX - prev.x) * scaleRatio;
      const nextY = cursorY - (cursorY - prev.y) * scaleRatio;

      return {
        x: Math.round(nextX),
        y: Math.round(nextY),
        scale: nextScale,
      };
    });
  }, []);

  // React synthetic wheel handler (prevent slide, enforce zoom)
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleWheelZoom(e.deltaY, e.clientX, e.clientY);
  };

  // Native non-passive wheel listener to strictly prevent browser/container scrolling
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      handleWheelZoom(e.deltaY, e.clientX, e.clientY);
    };

    container.addEventListener('wheel', onNativeWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', onNativeWheel);
    };
  }, [handleWheelZoom]);

  // Drag to pan: supports empty space Left Click (0) and Middle Mouse Click (1)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 && e.button !== 1) return;

    if (e.button === 0) {
      if ((e.target as HTMLElement).closest('[role="button"]') || (e.target as HTMLElement).closest('.prevent-pan')) {
        return;
      }
    } else if (e.button === 1) {
      e.preventDefault();
    }

    setIsPanning(true);
    panStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      panX: viewport.x,
      panY: viewport.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - panStartRef.current.startX;
    const dy = e.clientY - panStartRef.current.startY;
    setViewport(prev => ({
      ...prev,
      x: panStartRef.current.panX + dx,
      y: panStartRef.current.panY + dy,
    }));
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      data-testid="execution-canvas"
      className={`relative w-full h-full overflow-hidden select-none bg-monokai-bg flex-1 ${
        isPanning ? 'cursor-grabbing' : 'cursor-grab'
      }`}
      style={{
        backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)`,
        backgroundSize: '24px 24px',
      }}
    >
      {/* ── Viewport Canvas Content ─────────────────────────────────── */}
      <div
        className="absolute origin-top-left transition-transform duration-75 ease-out"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          width: layout.width,
          height: layout.height,
        }}
      >
        {/* SVG Edges Layer */}
        <SvgEdgeLayer
          edges={layout.edges}
          lens={lens}
          selectedNodeId={selectedNodeId}
          highlightedEdgeIds={highlightedEdgeIds}
          canvasWidth={layout.width}
          canvasHeight={layout.height}
        />

        {/* HTML Node Cards Layer */}
        {Array.from(layout.nodes.entries()).map(([nodeId, layoutNode]) => {
          const node = graph.nodes.get(nodeId);
          if (!node) return null;

          const isSelected = nodeId === selectedNodeId;
          const isHighlighted = highlightedNodeIds.has(nodeId);

          return (
            <div
              key={nodeId}
              style={{
                position: 'absolute',
                left: layoutNode.x - layoutNode.width / 2,
                top: layoutNode.y - layoutNode.height / 2,
                width: layoutNode.width,
                height: layoutNode.height,
              }}
            >
              <HtmlNodeCard
                node={node}
                lens={lens}
                isSelected={isSelected}
                isHighlighted={isHighlighted}
                onSelect={(id) => onSelectNode(id === selectedNodeId ? null : id)}
              />
            </div>
          );
        })}
      </div>

      {/* ── Floating Controls ───────────────────────────────────────── */}
      <CanvasControls
        scale={scale}
        direction={activeDirection}
        nodeCount={graph.nodes.size}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
        onFitToView={fitToView}
        onToggleDirection={handleToggleDirection}
      />
    </div>
  );
};
