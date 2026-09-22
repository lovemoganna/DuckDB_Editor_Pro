/**
 * DataFlowCustomEdge - 语义化连线
 *
 * 硬约束：路径始终从上游右侧中点 (Position.Right) 进入下游左侧中点 (Position.Left)，
 * 忽略 props 中可能错误的 sourcePosition/targetPosition，杜绝顶/底出线。
 *
 * 短边策略：水平跨度不足时上移/精简标签，避免徽章盖住终点导致「连线中断」错觉。
 */

import React, { memo } from 'react';
import {
  EdgeProps,
  getSmoothStepPath,
  EdgeLabelRenderer,
  Position,
} from 'reactflow';
import { Link2, Filter, Sigma, Layers, ArrowRight, X } from 'lucide-react';
import type { DataFlowEdgeData } from '../../../services/dataflow/workflowTypes';
import { useWorkflowStore } from '../../../services/dataflow/workflowStore';

/** 节点固定宽度 — 与 DataFlowNode / Canvas 映射保持一致 */
const NODE_WIDTH = 208;

export const DataFlowCustomEdge: React.FC<EdgeProps<DataFlowEdgeData>> = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style = {},
  markerEnd,
  data,
  selected,
}) => {
  const horizontalSpan = Math.abs(targetX - sourceX);
  const isShortEdge = horizontalSpan < 120;

  // 强制右中 → 左中；短边缩小折线 offset，避免路径在节点间打结
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition: Position.Right,
    targetX,
    targetY,
    targetPosition: Position.Left,
    borderRadius: isShortEdge ? 6 : 12,
    offset: isShortEdge ? 8 : 18,
  });

  const highlightState = data?.highlightState || 'none';
  const isAncestor = highlightState === 'ancestor';
  const isDescendant = highlightState === 'descendant';
  const isDimmed = highlightState === 'dimmed';
  const isHighlighted = selected || isAncestor || isDescendant;
  const deleteEdge = useWorkflowStore(s => s.deleteEdge);

  let strokeColor = 'var(--monokai-edge-idle)';
  let strokeWidth = 2.5;
  let filterEffect: string | undefined;
  let isAnimated = false;
  let markerType = 'default';

  if (selected) {
    strokeColor = 'var(--monokai-accent)';
    strokeWidth = 2.75;
    filterEffect = 'drop-shadow(0 0 6px rgba(166, 226, 46, 0.75))';
    isAnimated = true;
    markerType = 'accent';
  } else if (isAncestor) {
    strokeColor = 'var(--monokai-accent)';
    strokeWidth = 2.75;
    filterEffect = 'drop-shadow(0 0 6px rgba(166, 226, 46, 0.85))';
    isAnimated = true;
    markerType = 'accent';
  } else if (isDescendant) {
    strokeColor = 'var(--monokai-cyan)';
    strokeWidth = 2.75;
    filterEffect = 'drop-shadow(0 0 6px rgba(102, 217, 239, 0.85))';
    isAnimated = true;
    markerType = 'cyan';
  } else if (isDimmed) {
    strokeColor = 'var(--monokai-edge-muted)';
    strokeWidth = 1.75;
    markerType = 'dimmed';
  }

  const getRelationIcon = () => {
    switch (data?.relationType) {
      case 'join':
        return <Link2 className="w-2.5 h-2.5 text-monokai-pink shrink-0" />;
      case 'filter':
        return <Filter className="w-2.5 h-2.5 text-monokai-orange shrink-0" />;
      case 'aggregate':
        return <Sigma className="w-2.5 h-2.5 text-monokai-yellow shrink-0" />;
      case 'schema':
        return <Layers className="w-2.5 h-2.5 text-monokai-amethyst shrink-0" />;
      default:
        return <ArrowRight className="w-2.5 h-2.5 text-monokai-comment shrink-0" />;
    }
  };

  const ratioText = data?.filterRatio !== undefined
    ? (data.filterRatio >= 0 ? `↓${data.filterRatio}%` : `↑${Math.abs(data.filterRatio)}%`)
    : null;

  // 短边：仅保留极短语义字，避免大徽章盖住终点
  let badgeLabel: string | null = null;
  if (isShortEdge) {
    if (data?.relationType === 'join') {
      badgeLabel = data.joinSide === 'right' ? '右' : '左';
    } else if (isHighlighted || selected) {
      badgeLabel = data?.label?.slice(0, 6) || null;
    }
    // 默认短边不显示标签，连线本身即为「最终输出」语义
  } else {
    badgeLabel = ratioText && data?.label
      ? `${data.label} (${ratioText})`
      : data?.condition || data?.label || (data?.rowCount !== undefined ? `${data.rowCount.toLocaleString()} 行` : null);
  }

  // 标签一律上移离开路径中线；Join 左右再错峰
  let offsetX = 0;
  let offsetY = isShortEdge ? -18 : -22;
  const joinSide = data?.joinSide || (data?.targetHandle === 'left' || data?.targetHandle === 'right' ? data.targetHandle : undefined);
  if (joinSide === 'left') {
    offsetX = -10;
    offsetY = -26;
  } else if (joinSide === 'right') {
    offsetX = 10;
    offsetY = 18;
  } else if (!isShortEdge) {
    const hash = (id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 5) - 2;
    offsetX = hash * 8;
  }

  const finalLabelX = labelX + offsetX;
  const finalLabelY = labelY + offsetY;

  return (
    <>
      {/* Halo：略窄于主线，避免暗底「吃」掉端点 */}
      <path
        d={edgePath}
        style={{
          stroke: 'var(--monokai-bg)',
          strokeWidth: isHighlighted ? 6 : 4.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          fill: 'none',
          pointerEvents: 'none',
        }}
        className="fill-none"
      />

      <path
        id={id}
        d={edgePath}
        style={{
          ...style,
          stroke: strokeColor,
          strokeWidth,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          filter: filterEffect,
          fill: 'none',
          opacity: isDimmed ? 0.55 : 1,
          transition: 'stroke 0.2s ease, stroke-width 0.2s ease, filter 0.2s ease, opacity 0.2s ease',
          cursor: 'pointer',
        }}
        className={`react-flow__edge-path fill-none ${isAnimated ? 'dataflow-animated-edge' : ''}`}
        markerEnd={markerEnd || `url(#df-marker-${markerType})`}
      />

      {isAnimated && (
        <path
          d={edgePath}
          style={{
            stroke: isAncestor || selected ? 'var(--monokai-accent)' : 'var(--monokai-cyan)',
            strokeWidth: 2,
            strokeLinecap: 'round',
            fill: 'none',
            pointerEvents: 'none',
          }}
          className="dataflow-edge-pulse-flow fill-none"
        />
      )}

      <path
        d={edgePath}
        fill="none"
        strokeOpacity={0}
        strokeWidth={22}
        className="react-flow__edge-interaction cursor-pointer"
      />

      {badgeLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${finalLabelX}px,${finalLabelY}px)`,
              pointerEvents: 'all',
              zIndex: isHighlighted ? 15 : 2,
            }}
            className={`group/edge-badge flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-mono border shadow-md transition-all select-none cursor-pointer ${
              selected || isAncestor
                ? 'bg-monokai-surface text-monokai-accent border-monokai-accent/60 shadow-[0_0_8px_rgba(166,226,46,0.35)]'
                : isDescendant
                ? 'bg-monokai-surface text-monokai-cyan border-monokai-cyan/60 shadow-[0_0_8px_rgba(102,217,239,0.35)]'
                : isDimmed
                ? 'bg-monokai-bg/85 text-monokai-comment border-monokai-border/60 opacity-70'
                : 'bg-monokai-surface/95 text-monokai-fg border-monokai-border hover:border-monokai-accent/50'
            }`}
            title={
              data?.condition
                ? `关联条件: ${data.condition}`
                : data?.label
                ? `数据流: ${data.label}`
                : data?.rowCount !== undefined
                ? `流转数据量: ${data.rowCount.toLocaleString()} 行`
                : '数据流向 · 右中 → 左中'
            }
          >
            {!isShortEdge && getRelationIcon()}
            <span className={`truncate font-medium leading-none ${isShortEdge ? 'max-w-[48px]' : 'max-w-[140px]'}`}>
              {badgeLabel}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                deleteEdge(id);
              }}
              className={`p-0.5 rounded-full hover:bg-white/20 text-monokai-comment hover:text-monokai-pink transition-colors cursor-pointer ${
                isShortEdge ? 'opacity-0 group-hover/edge-badge:opacity-100' : ''
              }`}
              title="断开此连线"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

DataFlowCustomEdge.displayName = 'DataFlowCustomEdge';

export const DATAFLOW_NODE_WIDTH = NODE_WIDTH;
