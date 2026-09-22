import React, { memo } from 'react';
import {
  EdgeProps,
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
} from 'reactflow';
import { Trash2 } from 'lucide-react';
import { OntologyRelation } from '../../types/ontologyStudioTypes';
import { useOntologyStudioStore } from '../../hooks/useOntologyStudioStore';
import {
  LINK_TYPE_COLOR_TOKENS,
  EDGE_STATE_TOKENS,
  getRelationTypeColor,
  getRelationTypeWidth,
  getRelationTypeDashArray,
} from '../Library/ontologyStyles';

// 全部基数都享受常驻慢速 dash 流，提升视觉感知；N:M 节奏更快以示强调。
const SLOW_DASH_PATTERN = '6 4';
const FAST_DASH_PATTERN = '5 3';

export interface RelationEdgeData {
  relation: OntologyRelation;
}

export const OntologyRelationEdge: React.FC<EdgeProps<RelationEdgeData>> = memo(
  ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    selected,
    animated,
    data,
  }) => {
    const [edgePath, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });

    const { selectElement, deleteRelation } = useOntologyStudioStore();
    const relation = data?.relation;

    const handleEdgeClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (relation) {
        selectElement('relation', relation.id);
      }
    };

    const handleDelete = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (relation) {
        deleteRelation(relation.id);
      }
    };

    // ReactFlow 通过 `animated` prop 把"是否在多跳路径上"传下来
    const isDeductionEdgeActive = Boolean(animated);

    // 取该 cardinality 的 token
    const cardinality = relation?.cardinality || '1:N';
    const linkTypeInfo = LINK_TYPE_COLOR_TOKENS[cardinality] ?? LINK_TYPE_COLOR_TOKENS['1:N'];
    const baseColor = getRelationTypeColor(cardinality);
    const baseWidth = getRelationTypeWidth(cardinality);
    const dashArray = getRelationTypeDashArray(cardinality);

    // 选中/未选中色与宽度
    const strokeColor = selected ? baseColor : baseColor;
    const strokeOpacity = selected
      ? EDGE_STATE_TOKENS.selected.strokeOpacity
      : EDGE_STATE_TOKENS.default.strokeOpacity;
    const strokeWidth = selected ? baseWidth + 0.8 : baseWidth + 0.4;

    // halo 描边宽度（用于防止交叉视觉混淆）
    const haloColor = EDGE_STATE_TOKENS.halo.color;
    const haloWidth = strokeWidth * EDGE_STATE_TOKENS.halo.widthScale;

    // marker 颜色与基线同步
    const markerColor = baseColor;

    // 标签内容
    const labelText = relation?.label || relation?.name || '关联';

    // 全部基数都使用常驻慢速 dash 流；N:M 节奏更快以示强调；实线与虚线最终
    // 通过 strokeDashoffset 动画呈现"流向"感，强化视觉感知。
    const effectiveDashArray =
      dashArray ?? (cardinality === 'N:M' ? FAST_DASH_PATTERN : SLOW_DASH_PATTERN);

    // 把 ReactFlow 传下来的 `animated` 字段转成内联 style.animation
    // （BaseEdge 不接受 className，所以不能用 animate-edge-flow-* 类名）
    const flowAnimation = isDeductionEdgeActive
      ? 'ontology-edge-dash-flow-fast 0.8s linear infinite'
      : 'ontology-edge-dash-flow-slow 1.6s linear infinite';

    return (
      <>
        {/* Layer 1: 视觉桥接 halo（防交叉连线视觉混淆） */}
        <path
          style={{
            stroke: haloColor,
            strokeWidth: haloWidth,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            fill: 'none',
            pointerEvents: 'none',
          }}
          d={edgePath}
        />

        {/* Layer 2: 基线路径（按 cardinality 颜色 + 宽度 + 常驻 dash 流） */}
        <BaseEdge
          id={id}
          path={edgePath}
          markerEnd={markerEnd}
          style={{
            ...style,
            stroke: strokeColor,
            strokeWidth,
            strokeOpacity,
            strokeDasharray: effectiveDashArray,
            strokeLinecap: 'round',
            animation: flowAnimation,
            transition: 'stroke 0.2s ease, stroke-width 0.2s ease, stroke-opacity 0.2s ease',
          }}
        />

        {/* Layer 3: label 卡片 */}
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan select-none group"
            onClick={handleEdgeClick}
          >
            <div
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-xs font-mono shadow-md backdrop-blur-md cursor-pointer transition-all ${
                selected
                  ? 'bg-monokai-surface border-2 text-monokai-fg ring-2 scale-105'
                  : 'bg-monokai-surface/95 border-monokai-border text-monokai-fg-muted hover:text-monokai-fg'
              }`}
              style={{
                borderColor: selected ? baseColor : undefined,
                boxShadow: selected ? `0 0 0 2px ${baseColor}40` : undefined,
              }}
            >
              {/* cardinality 色块 */}
              <span
                className="inline-block w-2 h-2 rounded-sm shrink-0"
                style={{ backgroundColor: baseColor }}
                aria-hidden="true"
              />
              <span className="font-semibold" style={{ color: baseColor }}>
                {linkTypeInfo.label}
              </span>
              <span className="text-monokai-comment">|</span>
              <span className="font-medium text-monokai-fg truncate max-w-[110px]">
                {labelText}
              </span>
              {relation?.joinType && (
                <span className="text-xs px-1 py-0.2 rounded bg-monokai-bg text-monokai-fg-muted border border-monokai-border-subtle">
                  {relation.joinType}
                </span>
              )}
              <button
                onClick={handleDelete}
                className="opacity-0 group-hover:opacity-100 p-0.5 text-monokai-comment hover:text-monokai-pink rounded transition-opacity"
                title="删除关联"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        </EdgeLabelRenderer>
      </>
    );
  }
);

OntologyRelationEdge.displayName = 'OntologyRelationEdge';
