import React from 'react';
import { Position, computeLinkPath } from './OntologyCanvas.helpers';

interface OntologyLinkGroupProps {
  link: any;
  srcPos: Position;
  tgtPos: Position;
  selectedNodeId: number | null;
  activePathNodesAndLinks: any;
  isFocusMode: boolean;
  linkTypes: any[];
  deleteLink: (id: number) => void;
  expandedNodeIds: Set<number>;
  zoom: number;
  linkCurvatures: { [key: number]: number };
}

export const OntologyLinkGroup: React.FC<OntologyLinkGroupProps> = ({
  link,
  srcPos,
  tgtPos,
  selectedNodeId,
  activePathNodesAndLinks,
  isFocusMode,
  linkTypes,
  deleteLink,
  expandedNodeIds,
  zoom,
  linkCurvatures,
}) => {
  const isExpandedSrc = expandedNodeIds.has(link.source_object_id);
  const isExpandedTgt = expandedNodeIds.has(link.target_object_id);

  const { smoothPath, labelX, labelY, arrowheadPath } = computeLinkPath(
    link.id,
    link.source_object_id,
    link.target_object_id,
    srcPos,
    tgtPos,
    zoom,
    isExpandedSrc,
    isExpandedTgt,
    linkCurvatures
  );

  // If path computation returned empty (NaN safety check triggered), render nothing
  if (!smoothPath) return null;

  const isSelected = selectedNodeId === link.source_object_id || selectedNodeId === link.target_object_id;
  
  const hasActivePath = activePathNodesAndLinks !== null;
  const isUpstreamLink = activePathNodesAndLinks?.upstreamLinks.has(link.id);
  const isDownstreamLink = activePathNodesAndLinks?.downstreamLinks.has(link.id);
  
  // Focus Mode: Hide unrelated links completely
  if (isFocusMode && hasActivePath && !isUpstreamLink && !isDownstreamLink) {
    return null;
  }

  let opacity = 'opacity-70';
  let strokeColor = '#71717a'; // zinc-500 for better visibility on dark theme
  if (hasActivePath) {
    if (isUpstreamLink || isDownstreamLink) {
      opacity = 'opacity-100';
      strokeColor = isUpstreamLink ? '#10b981' : '#06b6d4'; // Use premium emerald and cyan
    } else {
      opacity = 'opacity-[0.06]';
    }
  } else if (isSelected) {
    strokeColor = '#06b6d4';
  }

  // Visual weight styling derived from relationship weight
  const relationshipWeight = link.weight ?? 0.5;
  const strokeWidth = (hasActivePath && (isUpstreamLink || isDownstreamLink)) || isSelected 
    ? 2.5 
    : 1 + relationshipWeight * 2;

  const linkName = linkTypes.find((t: any) => t.id === link.link_type_id)?.name || '关联';

  return (
    <g className={`group cursor-pointer transition-opacity duration-250 ${opacity}`}>
      {/* Outer Thick Hidden Line to Make Hover/Click Easier */}
      <path
        d={smoothPath}
        fill="none"
        stroke="black"
        strokeOpacity="0"
        strokeWidth="16"
        className="pointer-events-stroke"
        onClick={() => {
          if (window.confirm(`确定删除该关系连接吗？`)) {
            deleteLink(link.id);
          }
        }}
      />
      {/* Visible Line */}
      <path
        id={`edge-path-${link.id}`}
        d={smoothPath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        className="transition-all duration-300 group-hover:stroke-monokai-blue"
      />
      {/* Inline calculated arrowhead */}
      <path
        d={arrowheadPath}
        fill={strokeColor}
        className="transition-all duration-300 group-hover:fill-monokai-blue"
      />
      {/* Flow Animation Overlay when Selected or in active path */}
      {(isSelected || (hasActivePath && (isUpstreamLink || isDownstreamLink))) && (
        <path
          id={`edge-flow-${link.id}`}
          d={smoothPath}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth + 1}
          strokeDasharray="6, 8"
          className="animate-dash-flow pointer-events-none"
        />
      )}
      
      {/* Floating Relation Label Badge */}
      <g id={`edge-label-${link.id}`} transform={`translate(${labelX}, ${labelY})`}>
        <text
          textAnchor="middle"
          dominantBaseline="middle"
          fill={strokeColor === '#27272a' ? '#75715e' : strokeColor}
          fontSize="9"
          fontWeight="bold"
          className="select-none font-mono"
        >
          {linkName}
        </text>
      </g>
    </g>
  );
};
