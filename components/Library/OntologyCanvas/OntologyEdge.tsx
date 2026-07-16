import React from 'react';
import { EdgeLabelRenderer, EdgeProps, getBezierPath, getSmoothStepPath, getStraightPath } from 'reactflow';
import { getPolylineMidpoint, GraphPoint, pointsToOrthogonalPath } from './OntologyRouting';

export const OntologyEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  label,
  selected,
}) => {
  const curveOffset = data?.curveOffset ?? 0;
  const isActive = data?.isActive;
  const isUpstreamLink = data?.isUpstreamLink;
  const routing = data?.routing ?? 'orthogonal';
  const labelLoc = data?.labelLoc ?? 0.5;

  let path = '';
  let labelX = 0;
  let labelY = 0;

  const routedPoints = Array.isArray(data?.routePoints)
    ? (data.routePoints as GraphPoint[]).map((point) => ({ ...point }))
    : null;

  if (routedPoints && routedPoints.length >= 2) {
    const originalSource = routedPoints[0];
    const originalTarget = routedPoints[routedPoints.length - 1];
    routedPoints[0] = { x: sourceX, y: sourceY };
    routedPoints[routedPoints.length - 1] = { x: targetX, y: targetY };

    if (routedPoints.length > 2) {
      const second = routedPoints[1];
      if (Math.abs(second.y - originalSource.y) < 0.1) second.y = sourceY;
      else second.x = sourceX;
      const penultimate = routedPoints[routedPoints.length - 2];
      if (Math.abs(penultimate.y - originalTarget.y) < 0.1) penultimate.y = targetY;
      else penultimate.x = targetX;
    }
    path = pointsToOrthogonalPath(routedPoints);
    const midpoint = getPolylineMidpoint(routedPoints);
    labelX = midpoint.x;
    labelY = midpoint.y;
  } else if (routing === 'straight') {
    const [straightPath] = getStraightPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
    });
    path = straightPath;
    labelX = sourceX * (1 - labelLoc) + targetX * labelLoc;
    labelY = sourceY * (1 - labelLoc) + targetY * labelLoc;
  } else if (routing === 'orthogonal') {
    const [stepPath, lx, ly] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 0,
    });
    path = stepPath;
    if (labelLoc === 0.5) {
      labelX = lx;
      labelY = ly;
    } else {
      labelX = sourceX * (1 - labelLoc) + targetX * labelLoc;
      labelY = sourceY * (1 - labelLoc) + targetY * labelLoc;
    }
  } else {
    // curved routing (default)
    if (curveOffset === 0) {
      const [bezierPath, lx, ly] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        curvature: 0.25,
      });
      path = bezierPath;
      if (labelLoc === 0.5) {
        labelX = lx;
        labelY = ly;
      } else {
        labelX = sourceX * (1 - labelLoc) + targetX * labelLoc;
        labelY = sourceY * (1 - labelLoc) + targetY * labelLoc;
      }
    } else {
      // Parallel edges: Route via quadratic bezier curve with perpendicular offset
      const midX = (sourceX + targetX) / 2;
      const midY = (sourceY + targetY) / 2;

      const dx = targetX - sourceX;
      const dy = targetY - sourceY;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = -dy / len; // Perpendicular unit vector
      const ny = dx / len;

      const cx = midX + nx * curveOffset;
      const cy = midY + ny * curveOffset;

      path = `M ${sourceX} ${sourceY} Q ${cx} ${cy} ${targetX} ${targetY}`;
      
      const t = labelLoc;
      const mt = 1 - t;
      labelX = mt * mt * sourceX + 2 * mt * t * cx + t * t * targetX;
      labelY = mt * mt * sourceY + 2 * mt * t * cy + t * t * targetY;
    }
  }

  const labelColor = isActive
    ? (isUpstreamLink ? '#10b981' : '#06b6d4')
    : (selected ? '#06b6d4' : '#e4e4e7');

  const labelBorderColor = isActive
    ? (isUpstreamLink ? 'rgba(16, 185, 129, 0.4)' : 'rgba(6, 182, 212, 0.4)')
    : (selected ? 'rgba(6, 182, 212, 0.4)' : 'rgba(82, 82, 91, 0.4)');

  const flowColor = isActive
    ? (isUpstreamLink ? '#34d399' : '#22d3ee')
    : '#38bdf8';

  return (
    <>
      <style>{`
        @keyframes edge-flow-${id} {
          from { stroke-dashoffset: 16; }
          to { stroke-dashoffset: 0; }
        }
        .edge-flow-${id} {
          stroke-dasharray: 6, 10;
          animation: edge-flow-${id} 1.2s linear infinite;
        }
      `}</style>

      {/* Glow shadow blur path */}
      {(selected || isActive) && (
        <path
          style={{
            stroke: flowColor,
            strokeWidth: 4,
            opacity: 0.15,
            filter: 'blur(3px)',
            pointerEvents: 'none',
          }}
          className="fill-none"
          d={path}
        />
      )}

      {/* Base structural path */}
      <path
        id={id}
        style={{
          ...style,
          stroke: isActive
            ? (isUpstreamLink ? '#10b981' : '#06b6d4')
            : (selected ? '#06b6d4' : '#3f3f46'),
          strokeWidth: selected || isActive ? 2.5 : 1.5,
        }}
        className="react-flow__edge-path fill-none transition-all duration-250"
        d={path}
        markerEnd={markerEnd}
      />

      {/* Moving dash flow overlay */}
      {(selected || isActive) && (
        <path
          style={{
            stroke: flowColor,
            strokeWidth: 1.2,
            opacity: 0.85,
            pointerEvents: 'none',
          }}
          className={`fill-none edge-flow-${id}`}
          d={path}
        />
      )}
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
              zIndex: selected || isActive ? 10 : 1,
            }}
            className="nodrag nopan select-none cursor-pointer"
          >
            <div
              style={{
                background: '#0c0d12',
                color: labelColor,
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: 650,
                fontFamily: 'monospace',
                border: '1px solid',
                borderColor: labelBorderColor,
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
                transition: 'all 0.2s ease',
              }}
              className="hover:scale-105 hover:border-monokai-blue"
            >
              {label}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};
