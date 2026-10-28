/**
 * components/ExecutionPlan/canvas/SvgEdgeLayer.tsx
 *
 * SVG Edge Layer for the Execution Canvas.
 * Renders smooth bezier curves, glow filters, arrows, and data flow scales.
 * In Data Lens: scales line stroke-width proportionally, pulses on selection,
 * and renders clean glassmorphic row volume badges.
 */

import React from 'react';
import { LayoutEdge, LensType } from '../model/types';

export interface SvgEdgeLayerProps {
  edges: LayoutEdge[];
  lens: LensType;
  selectedNodeId: string | null;
  highlightedEdgeIds: Set<string>;
  canvasWidth: number;
  canvasHeight: number;
}

export const SvgEdgeLayer: React.FC<SvgEdgeLayerProps> = ({
  edges,
  lens,
  selectedNodeId,
  highlightedEdgeIds,
  canvasWidth,
  canvasHeight,
}) => {
  // Generate a smooth cubic bezier SVG path definition from a list of points
  const generatePathD = (points: { x: number; y: number }[]): string => {
    if (!points || points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    const totalDx = Math.abs(points[points.length - 1].x - points[0].x);
    const totalDy = Math.abs(points[points.length - 1].y - points[0].y);
    const isHorizontal = totalDx > totalDy;

    if (points.length === 2) {
      const [p0, p1] = points;
      if (isHorizontal) {
        const midX = (p0.x + p1.x) / 2;
        return `M ${p0.x} ${p0.y} C ${midX} ${p0.y}, ${midX} ${p1.y}, ${p1.x} ${p1.y}`;
      } else {
        const midY = (p0.y + p1.y) / 2;
        return `M ${p0.x} ${p0.y} C ${p0.x} ${midY}, ${p1.x} ${midY}, ${p1.x} ${p1.y}`;
      }
    }

    // Multiple points (from Dagre route)
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      if (isHorizontal) {
        const midX = (prev.x + curr.x) / 2;
        d += ` C ${midX} ${prev.y}, ${midX} ${curr.y}, ${curr.x} ${curr.y}`;
      } else {
        const midY = (prev.y + curr.y) / 2;
        d += ` C ${prev.x} ${midY}, ${curr.x} ${midY}, ${curr.x} ${curr.y}`;
      }
    }
    return d;
  };

  return (
    <svg
      className="absolute inset-0 pointer-events-none overflow-visible"
      width={canvasWidth}
      height={canvasHeight}
      style={{ minWidth: canvasWidth, minHeight: canvasHeight }}
    >
      <defs>
        {/* Glow filter for highlighted edges */}
        <filter id="edge-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        {/* Standard Arrow Marker */}
        <marker
          id="exec-arrow-default"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 1 2 L 7 5 L 1 8 z" fill="#75715e" opacity="0.85" />
        </marker>

        {/* Active / Highlight Arrow Marker */}
        <marker
          id="exec-arrow-highlight"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 1 2 L 7 5 L 1 8 z" fill="#66d9ef" />
        </marker>

        {/* Data Lens Arrow Marker */}
        <marker
          id="exec-arrow-data"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 1 2 L 7 5 L 1 8 z" fill="#38bdf8" />
        </marker>

        {/* Data Explosion Arrow Marker */}
        <marker
          id="exec-arrow-explosion"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 1 2 L 7 5 L 1 8 z" fill="#fbbf24" />
        </marker>
      </defs>

      {/* Render Edges */}
      {edges.map(edge => {
        const isHighlighted =
          highlightedEdgeIds.has(edge.id) ||
          edge.source === selectedNodeId ||
          edge.target === selectedNodeId;

        const pathD = generatePathD(edge.points);

        // Compute stroke styling
        let strokeColor = '#49483e';
        let strokeWidth = 2;
        let marker = 'url(#exec-arrow-default)';

        if (lens === 'data') {
          strokeWidth = Math.max(2, edge.relativeWidth);
          strokeColor = isHighlighted ? '#66d9ef' : '#0284c7';
          marker = isHighlighted ? 'url(#exec-arrow-highlight)' : 'url(#exec-arrow-data)';
        } else if (isHighlighted) {
          strokeColor = '#66d9ef';
          strokeWidth = 2.5;
          marker = 'url(#exec-arrow-highlight)';
        }

        // Midpoint for row badge in Data lens
        const midPoint =
          edge.points.length > 1
            ? edge.points[Math.floor(edge.points.length / 2)]
            : null;

        return (
          <g key={edge.id} className="transition-all duration-200">
            {/* Background halo on highlight */}
            {isHighlighted && (
              <path
                d={pathD}
                fill="none"
                stroke="#66d9ef"
                strokeWidth={strokeWidth + 5}
                strokeOpacity="0.25"
                strokeLinecap="round"
                filter="url(#edge-glow)"
              />
            )}

            {/* Main Edge Path */}
            <path
              d={pathD}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeOpacity={isHighlighted ? '1' : '0.8'}
              strokeLinecap="round"
              strokeLinejoin="round"
              markerEnd={marker}
            />

            {/* Data Lens Row Count Badge */}
            {lens === 'data' && edge.rows !== undefined && midPoint && (
              <g
                transform={`translate(${midPoint.x}, ${midPoint.y})`}
                className="select-none"
              >
                <rect
                  x="-34"
                  y="-11"
                  width="68"
                  height="22"
                  rx="11"
                  fill="#181915"
                  stroke={isHighlighted ? '#66d9ef' : '#38bdf8'}
                  strokeWidth="1.2"
                  strokeOpacity="0.85"
                  filter="drop-shadow(0 2px 4px rgba(0,0,0,0.5))"
                />
                <text
                  x="0"
                  y="4"
                  textAnchor="middle"
                  fill="#a6e22e"
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {edge.rows >= 1000000
                    ? `${(edge.rows / 1000000).toFixed(1)}M`
                    : edge.rows >= 10000
                    ? `${(edge.rows / 1000).toFixed(1)}k`
                    : edge.rows.toLocaleString()}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
};
