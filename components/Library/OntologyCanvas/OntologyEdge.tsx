import React from 'react';
import { EdgeProps, getBezierPath, EdgeLabelRenderer } from 'reactflow';

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

  let path = '';
  let labelX = 0;
  let labelY = 0;

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
    labelX = lx;
    labelY = ly;
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
    labelX = cx;
    labelY = cy;
  }

  const labelColor = isActive
    ? (isUpstreamLink ? '#10b981' : '#06b6d4')
    : (selected ? '#06b6d4' : '#e4e4e7');

  const labelBorderColor = isActive
    ? (isUpstreamLink ? 'rgba(16, 185, 129, 0.4)' : 'rgba(6, 182, 212, 0.4)')
    : (selected ? 'rgba(6, 182, 212, 0.4)' : 'rgba(82, 82, 91, 0.4)');

  return (
    <>
      <path
        id={id}
        style={{
          ...style,
          stroke: isActive
            ? (isUpstreamLink ? '#10b981' : '#06b6d4')
            : (selected ? '#06b6d4' : '#52525b'),
          strokeWidth: selected || isActive ? 2.5 : 1.5,
        }}
        className="react-flow__edge-path fill-none transition-all duration-200"
        d={path}
        markerEnd={markerEnd}
      />
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
