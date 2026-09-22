/**
 * D3GraphView.renderer.tsx - 图谱渲染组件
 * 
 * 职责：
 * 1. SVG 节点渲染
 * 2. 边渲染
 * 3. 标签渲染
 * 4. 集群边界渲染
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import type { GraphNode, GraphLink, GraphData } from './D3GraphView.types';
import { LINKTYPE_COLORS, LINKTYPE_DASH } from './D3GraphView.types';
import { ICON_HEXAGON, ICON_BOX, ICON_BOLT } from './D3GraphView.visuals';

export interface GraphRendererProps {
  nodes: GraphNode[];
  links: GraphLink[];
  graphData: GraphData | null;
  selectedNode: GraphNode | null;
  hoveredNode: GraphNode | null;
  showLabels: boolean;
  labelMode: 'all' | 'hover' | 'auto';
  zoomLevel: number;
  onNodeClick?: (node: GraphNode, event: React.MouseEvent) => void;
  onNodeDoubleClick?: (node: GraphNode, event: React.MouseEvent) => void;
  onNodeContextMenu?: (node: GraphNode, event: React.MouseEvent) => void;
  onNodeDragStart?: (node: GraphNode, event: React.MouseEvent) => void;
  onNodeDrag?: (node: GraphNode, event: React.MouseEvent) => void;
  onNodeDragEnd?: (node: GraphNode, event: React.MouseEvent) => void;
  onLinkClick?: (link: GraphLink, event: React.MouseEvent) => void;
  getNodeIconPath?: (node: GraphNode) => string;
  getNodeFillColor?: (node: GraphNode) => string;
}

// 辅助函数：获取节点图标路径
function getDefaultNodeIconPath(node: GraphNode): string {
  if (node.group === 'typeHub') return ICON_HEXAGON;
  if (node.group === 'action') return ICON_BOLT;
  return ICON_BOX;
}

// 辅助函数：获取节点填充颜色
function getDefaultNodeFillColor(node: GraphNode): string {
  if (node.group === 'typeHub') return node.color || '#c77dff';
  if (node.group === 'action') return node.color || '#50fa7b';
  return node.color || '#a070d0';
}

// 辅助函数：获取节点半径
function getNodeRadius(node: GraphNode): number {
  const base = node.size || (node.group === 'typeHub' ? 28 : node.group === 'action' ? 10 : 11);
  if (node.group === 'typeHub' && !node._hasInstances) return 18;
  return base;
}

// 辅助函数：获取节点图标变换
function getNodeIconTransform(node: GraphNode): string {
  const r = getNodeRadius(node);
  const scale = node.group === 'typeHub' ? 1.6 : node.group === 'action' ? 0.55 : 0.9;
  const offsetY = node.group === 'typeHub' ? 1 : 1;
  return `scale(${scale}) translate(0, ${offsetY})`;
}

// 辅助函数：获取链接路径
function getLinkPath(link: GraphLink, nodeMap: Map<string, GraphNode>): string {
  const source = typeof link.source === 'object' ? link.source : nodeMap.get(String(link.source));
  const target = typeof link.target === 'object' ? link.target : nodeMap.get(String(link.target));
  
  if (!source?.x || !source?.y || !target?.x || !target?.y) return '';
  
  const sx = source.x, sy = source.y;
  const tx = target.x, ty = target.y;
  
  // 如果有分组偏移，使用二次贝塞尔曲线
  if (link._groupOffset && link._groupOffset !== 0) {
    const mx = (sx + tx) / 2;
    const my = (sy + ty) / 2;
    const dx = tx - sx, dy = ty - sy;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len * link._groupOffset;
    const ny = dx / len * link._groupOffset;
    return `M${sx},${sy} Q${mx + nx},${my + ny} ${tx},${ty}`;
  }
  
  return `M${sx},${sy} L${tx},${ty}`;
}

/**
 * GraphRenderer - 图谱渲染组件
 * 
 * 渲染图谱的节点、边和标签。
 * 这个组件接收数据和交互回调，渲染 SVG 元素。
 */
export const GraphRenderer: React.FC<GraphRendererProps> = ({
  nodes,
  links,
  graphData,
  selectedNode,
  hoveredNode,
  showLabels,
  labelMode,
  zoomLevel,
  onNodeClick,
  onNodeDoubleClick,
  onNodeContextMenu,
  onNodeDragStart,
  onNodeDrag,
  onNodeDragEnd,
  onLinkClick,
  getNodeIconPath = getDefaultNodeIconPath,
  getNodeFillColor = getDefaultNodeFillColor,
}) => {
  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);
  
  // 过滤可见的边（只显示两端节点都存在的边）
  const visibleLinks = useMemo(() => {
    return links.filter(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : String(link.source);
      const targetId = typeof link.target === 'object' ? link.target.id : String(link.target);
      return nodeMap.has(sourceId) && nodeMap.has(targetId);
    });
  }, [links, nodeMap]);
  
  // 计算度数中心性
  const degreeMap = useMemo(() => {
    const degrees: Record<string, number> = {};
    nodes.forEach(n => { degrees[n.id] = 0; });
    visibleLinks.forEach(l => {
      const s = typeof l.source === 'object' ? (l.source as GraphNode).id : String(l.source);
      const t = typeof l.target === 'object' ? (l.target as GraphNode).id : String(l.target);
      if (degrees[s] !== undefined) degrees[s]++;
      if (degrees[t] !== undefined) degrees[t]++;
    });
    return degrees;
  }, [nodes, visibleLinks]);
  
  // 过滤可见标签
  const visibleLabelIds = useMemo(() => {
    if (labelMode === 'all') {
      return new Set(nodes.map(n => n.id));
    }
    if (labelMode === 'hover' && hoveredNode) {
      return new Set([hoveredNode.id]);
    }
    // 'auto' 模式：根据缩放级别和度数过滤
    if (zoomLevel < 0.3) {
      return new Set(nodes.filter(n => n.group === 'typeHub' && degreeMap[n.id] > 2).map(n => n.id));
    }
    if (zoomLevel < 0.7) {
      return new Set(nodes.filter(n => n.group !== 'action' || degreeMap[n.id] > 1).map(n => n.id));
    }
    return new Set(nodes.filter(n => degreeMap[n.id] > 0 || n.group === 'typeHub').map(n => n.id));
  }, [nodes, degreeMap, labelMode, hoveredNode, zoomLevel]);
  
  // 节点点击处理
  const handleNodeClick = useCallback((node: GraphNode, event: React.MouseEvent) => {
    event.stopPropagation();
    onNodeClick?.(node, event);
  }, [onNodeClick]);
  
  // 节点双击处理
  const handleNodeDoubleClick = useCallback((node: GraphNode, event: React.MouseEvent) => {
    event.stopPropagation();
    onNodeDoubleClick?.(node, event);
  }, [onNodeDoubleClick]);
  
  // 节点右键处理
  const handleNodeContextMenu = useCallback((node: GraphNode, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onNodeContextMenu?.(node, event);
  }, [onNodeContextMenu]);
  
  // 边点击处理
  const handleLinkClick = useCallback((link: GraphLink, event: React.MouseEvent) => {
    event.stopPropagation();
    onLinkClick?.(link, event);
  }, [onLinkClick]);
  
  return (
    <g className="graph-renderer">
      {/* 边层 */}
      <g className="links">
        {visibleLinks.map((link, idx) => {
          const sourceId = typeof link.source === 'object' ? link.source.id : String(link.source);
          const targetId = typeof link.target === 'object' ? link.target.id : String(link.target);
          const path = getLinkPath(link, nodeMap);
          const isHighlighted = selectedNode?.id === sourceId || selectedNode?.id === targetId;
          const dashArray = link._linkTypeId !== undefined 
            ? LINKTYPE_DASH[(link._linkTypeId - 1) % LINKTYPE_DASH.length] 
            : undefined;
          
          return (
            <path
              key={`link-${sourceId}-${targetId}-${idx}`}
              d={path}
              fill="none"
              stroke={isHighlighted ? '#66d9ef' : (link.color || '#5ab0d0')}
              strokeWidth={isHighlighted ? 3 : Math.max(1, (link.weight || 0.5) * 2)}
              strokeOpacity={isHighlighted ? 1 : 0.7}
              strokeDasharray={dashArray !== '0' ? dashArray : undefined}
              style={{ cursor: 'pointer' }}
              onClick={(e) => handleLinkClick(link, e)}
              markerEnd={link._linkTypeId !== undefined 
                ? `url(#arrow-linktype-${link._linkTypeId})` 
                : 'url(#arrow-amethyst)'}
            />
          );
        })}
      </g>
      
      {/* 节点层 */}
      <g className="nodes">
        {nodes.map(node => {
          const x = node.x || 0;
          const y = node.y || 0;
          const r = getNodeRadius(node);
          const fillColor = getNodeFillColor(node);
          const strokeColor = node.group === 'typeHub' ? fillColor : '#66d9ef';
          const iconPath = getNodeIconPath(node);
          const iconColor = fillColor === '#ffffff' ? '#0c0d12' : 'rgba(255,255,255,0.9)';
          const iconScale = node.group === 'typeHub' ? 1.6 : node.group === 'action' ? 0.55 : 0.9;
          
          const isSelected = selectedNode?.id === node.id;
          const isHovered = hoveredNode?.id === node.id;
          const showLabel = showLabels && visibleLabelIds.has(node.id);
          const isHighlighted = isSelected || isHovered;
          
          return (
            <g
              key={node.id}
              transform={`translate(${x}, ${y})`}
              style={{ cursor: 'move' }}
              onClick={(e) => handleNodeClick(node, e)}
              onDoubleClick={(e) => handleNodeDoubleClick(node, e)}
              onContextMenu={(e) => handleNodeContextMenu(node, e)}
            >
              {/* 外圈光晕（选中/悬停时） */}
              {isHighlighted && (
                <circle
                  r={r + 6}
                  fill="none"
                  stroke={isSelected ? '#FFD166' : '#66d9ef'}
                  strokeWidth={2}
                  strokeOpacity={0.5}
                  className="highlight-glow"
                />
              )}
              
              {/* 节点主体 */}
              <circle
                r={r}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={isHighlighted ? 2.5 : 1.5}
                strokeOpacity={0.9}
                className={`node-circle ${node.group}`}
              />
              
              {/* 图标 */}
              <path
                d={iconPath}
                transform={`scale(${iconScale}) translate(0, ${node.group === 'typeHub' ? 1 : 1})`}
                fill="none"
                stroke={iconColor}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="node-icon"
              />
              
              {/* 属性徽章 */}
              {node._propsCount && node._propsCount > 0 && (
                <>
                  <circle
                    cx={r * 0.65}
                    cy={-r * 0.65}
                    r={7}
                    fill="#FF6B35"
                    stroke="rgba(0,0,0,0.6)"
                    strokeWidth={1}
                  />
                  <text
                    x={r * 0.65}
                    y={-r * 0.65 + 3}
                    textAnchor="middle"
                    fontSize={9}
                    fontWeight="bold"
                    fill="white"
                  >
                    {node._propsCount}
                  </text>
                </>
              )}
              
              {/* 类型Hub 的实例数量 */}
              {node.group === 'typeHub' && node._instanceCount !== undefined && (
                <>
                  <circle
                    cx={-r * 0.65}
                    cy={r * 0.65}
                    r={6}
                    fill="rgba(255,255,255,0.2)"
                    stroke="rgba(255,255,255,0.5)"
                    strokeWidth={1}
                  />
                  <text
                    x={-r * 0.65}
                    y={r * 0.65 + 3}
                    textAnchor="middle"
                    fontSize={8}
                    fontWeight="bold"
                    fill="white"
                  >
                    {node._instanceCount}
                  </text>
                </>
              )}
              
              {/* 标签 */}
              {showLabel && (
                <text
                  x={r + 8}
                  y={4}
                  fill="white"
                  fontSize={node.group === 'typeHub' ? 13 : 11}
                  fontWeight={node.group === 'typeHub' ? 'bold' : 'normal'}
                  paintOrder="stroke"
                  stroke="#12131a"
                  strokeWidth={3.5}
                  strokeLinejoin="round"
                  className="node-label"
                  style={{ pointerEvents: 'none' }}
                >
                  {node.label.length > 18 ? node.label.slice(0, 18) + '…' : node.label}
                </text>
              )}
              
              {/* 类型Hub 的外围圆环 */}
              {node.group === 'typeHub' && (
                <circle
                  r={r + 6}
                  fill="none"
                  stroke={fillColor}
                  strokeWidth={1.5}
                  strokeOpacity={0.35}
                  className="typehub-ring"
                />
              )}
            </g>
          );
        })}
      </g>
    </g>
  );
};

export default GraphRenderer;
