/**
 * OntologyEdge - 实体连线组件 (MECE v5.0 重构版)
 * 
 * 核心优化:
 * 1. 连线准确连接 - 基于OntologyRouting的精确锚点计算
 * 2. 路径追踪增强 - 上游/下游链路可视化
 * 3. 视觉反馈优化 - hover状态、选中状态、流动动画
 * 4. 标签交互 - 可点击区域扩大，方向指示器
 * 
 * v5.0 重构:
 * - 统一使用ReactFlow传入的sourceX/Y和targetX/Y
 * - 这些值已经过ReactFlow基于节点位置和Handle计算
 * - 确保与OntologyRouting的锚点计算保持一致
 */

import React, { useState, useMemo, memo } from 'react';
import { EdgeLabelRenderer, EdgeProps, getBezierPath, getSmoothStepPath, getStraightPath, Position } from 'reactflow';

export const OntologyEdge: React.FC<EdgeProps> = memo(({
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
  // v4.2新增：连线hover状态
  const [isHovered, setIsHovered] = useState(false);
  
  const curveOffset = data?.curveOffset ?? 0;
  const laneOffset = data?.laneOffset ?? 0;
  const isActive = data?.isActive;
  const isUpstreamLink = data?.isUpstreamLink;
  const isDownstreamLink = data?.isDownstreamLink;
  const routing = data?.routing ?? 'straight';
  const labelLoc = data?.labelLoc ?? 0.5;

  // v4.2新增：连线宽度计算
  const isHighlighted = selected || isActive || isHovered;
  const strokeWidth = isHighlighted ? 2.5 : 1.5;

  let path = '';
  let labelX = 0;
  let labelY = 0;

  const isOrthogonal = routing === 'orthogonal';

  if (isOrthogonal) {
    const [stepPath, lx, ly] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 14,
      offset: laneOffset,
    });
    path = stepPath;
    if (labelLoc === 0.5) {
      labelX = lx;
      labelY = ly;
    } else {
      labelX = sourceX * (1 - labelLoc) + targetX * labelLoc;
      labelY = sourceY * (1 - labelLoc) + targetY * labelLoc;
    }
  } else if (routing === 'bezier') {
    const [bezierPath, bx, by] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      curvature: 0.35,
    });
    path = bezierPath;
    labelX = bx;
    labelY = by;
  } else {
    // straight mode
    const effOffset = laneOffset !== 0 ? laneOffset : curveOffset;
    if (effOffset === 0) {
      const [straightPath, sx, sy] = getStraightPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
      });
      path = straightPath;
      labelX = labelLoc === 0.5 ? sx : sourceX * (1 - labelLoc) + targetX * labelLoc;
      labelY = labelLoc === 0.5 ? sy : sourceY * (1 - labelLoc) + targetY * labelLoc;
    } else {
      const dx = targetX - sourceX;
      const dy = targetY - sourceY;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = (-dy / len) * Math.max(-24, Math.min(24, effOffset * 0.4));
      const ny = (dx / len) * Math.max(-24, Math.min(24, effOffset * 0.4));
      const midX = (sourceX + targetX) / 2 + nx;
      const midY = (sourceY + targetY) / 2 + ny;

      // Quadratic bezier curve firmly anchored at source and target
      path = `M ${sourceX} ${sourceY} Q ${midX} ${midY} ${targetX} ${targetY}`;
      labelX = (sourceX * 0.25) + (midX * 0.5) + (targetX * 0.25);
      labelY = (sourceY * 0.25) + (midY * 0.5) + (targetY * 0.25);
    }
  }

  // v4.2优化：连线颜色计算
  const getStrokeColor = () => {
    if (isActive) {
      return isUpstreamLink ? '#10b981' : '#06b6d4';
    }
    if (isHovered) {
      return '#8b8b9e';
    }
    return selected ? '#06b6d4' : '#52525b';
  };

  const labelColor = isActive
    ? (isUpstreamLink ? '#10b981' : '#06b6d4')
    : (selected ? '#06b6d4' : '#e4e4e7');

  const labelBorderColor = isActive
    ? (isUpstreamLink ? 'rgba(16, 185, 129, 0.4)' : 'rgba(6, 182, 212, 0.4)')
    : (selected ? 'rgba(6, 182, 212, 0.4)' : 'rgba(82, 82, 91, 0.4)');

  const flowColor = isActive
    ? (isUpstreamLink ? '#34d399' : '#22d3ee')
    : '#38bdf8';

  // v4.2新增：路径追踪连线颜色
  const pathTrackingColor = isUpstreamLink 
    ? '#10b981' 
    : isDownstreamLink 
      ? '#06b6d4' 
      : flowColor;

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
        /* v4.2新增：hover高亮效果 */
        .edge-hover-${id}:hover {
          filter: drop-shadow(0 0 3px ${getStrokeColor()});
        }
      `}</style>

      {/* Visual Bridge Halo: Dark outline to prevent intersection clashing */}
      <path
        d={path}
        style={{
          stroke: '#12131a',
          strokeWidth: isHighlighted ? 5 : 3.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          pointerEvents: 'none',
          transition: 'stroke-width 0.15s ease',
        }}
        className="fill-none"
      />

      {/* Glow shadow blur path */}
      {isHighlighted && (
        <path
          d={path}
          style={{
            stroke: pathTrackingColor,
            strokeWidth: 5,
            opacity: 0.15,
            filter: 'blur(4px)',
            pointerEvents: 'none',
          }}
          className="fill-none"
        />
      )}

      {/* Base structural path */}
      <path
        id={id}
        d={path}
        style={{
          ...style,
          stroke: getStrokeColor(),
          strokeWidth: strokeWidth,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          transition: 'stroke 0.15s ease, stroke-width 0.15s ease',
          cursor: 'pointer',
        }}
        className={`react-flow__edge-path fill-none ${isHighlighted ? 'edge-hover-' + id : ''}`}
        markerEnd={markerEnd}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />

      {/* Moving dash flow overlay */}
      {isHighlighted && (
        <path
          d={path}
          style={{
            stroke: pathTrackingColor,
            strokeWidth: 1.5,
            opacity: 0.8,
            pointerEvents: 'none',
            strokeLinecap: 'round',
          }}
          className={`fill-none edge-flow-${id}`}
        />
      )}
      
      {/* v4.2优化：标签可点击区域扩大 */}
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
              zIndex: isHighlighted ? 10 : 1,
            }}
            className="nodrag nopan select-none"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {/* v4.2：扩大hover区域 */}
            <div
              className="relative"
              style={{
                padding: '6px 12px',
                margin: '-6px -12px', // 扩大点击区域
              }}
            >
              <div
                style={{
                  background: '#0c0d12',
                  color: labelColor,
                  padding: '3px 7px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 650,
                  fontFamily: 'monospace',
                  border: '1px solid',
                  borderColor: labelBorderColor,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
                  transition: 'all 0.15s ease, transform 0.15s ease',
                  transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                }}
                className="cursor-pointer hover:border-monokai-border-strong"
              >
                {label}
              </div>
              
              {/* v4.2新增：路径追踪方向指示器 */}
              {isActive && (
                <div 
                  className="absolute -top-1 -right-1 w-2 h-2 rounded-full"
                  style={{ backgroundColor: pathTrackingColor }}
                />
              )}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});
