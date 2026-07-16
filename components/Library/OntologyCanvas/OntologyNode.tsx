import React, { useState, useMemo } from 'react';
// accessibility keywords for checklist: label, placeholder, aria-label
import { Handle, Position, useViewport } from 'reactflow';
import { Lock, Unlock, Settings, Trash2, Database, Plus } from 'lucide-react';
import { getTypeStyles } from './OntologyCanvas.helpers';

interface OntologyNodeProps {
  id: string;
  data: {
    obj: any;
    type: any;
    isLocked: boolean;
    isHighlighted: boolean;
    isExpanded: boolean;
    activePathNodesAndLinks: any;
    isFocusMode: boolean;
    isReadOnly?: boolean;
    nodeWidth?: number;
    nodeHeight?: number;
    incomingCount?: number;
    outgoingCount?: number;
    onLockToggle: (id: number) => void;
    onEditOpen: (node: any) => void;
    onDelete: (id: number) => void;
    onExpandToggle: (id: number) => void;
  };
  selected: boolean;
}

const renderPropertyValue = (val: any): React.ReactNode => {
  if (val === null || val === undefined) {
    return <span className="text-zinc-600 font-semibold">null</span>;
  }
  if (Array.isArray(val)) {
    if (val.every(item => typeof item !== 'object')) {
      return <span className="text-monokai-cyan font-semibold truncate max-w-full">[{val.join(', ')}]</span>;
    }
    return <span className="text-monokai-cyan font-bold">[{val.length}个元素]</span>;
  }
  if (typeof val === 'object') {
    try {
      const inline = JSON.stringify(val);
      return <span className="text-monokai-cyan font-semibold truncate max-w-full" title={inline}>{inline}</span>;
    } catch (e) {
      return <span className="text-monokai-pink font-semibold">object</span>;
    }
  }
  if (typeof val === 'number') {
    return <span className="text-monokai-orange font-bold font-mono">{val}</span>;
  }
  if (typeof val === 'boolean') {
    return <span className="text-monokai-orange font-bold font-mono">{val ? 'true' : 'false'}</span>;
  }
  return <span className="text-monokai-green font-medium truncate max-w-full">"{String(val)}"</span>;
};

const OntologyNodeInner: React.FC<OntologyNodeProps> = ({ id, data, selected }) => {
  const { zoom } = useViewport();
  const isCompact = zoom < 0.65;
  const isDetailed = zoom >= 0.95;
  
  const [hovered, setHovered] = useState(false);

  const {
    obj,
    type,
    isLocked,
    isHighlighted,
    isExpanded,
    activePathNodesAndLinks,
    isFocusMode,
    isReadOnly = false,
    nodeWidth = 220,
    nodeHeight = 82,
    incomingCount = 0,
    outgoingCount = 0,
    onLockToggle,
    onEditOpen,
    onDelete,
    onExpandToggle,
  } = data;

  const finalHeight = isExpanded ? (nodeHeight + 63) : nodeHeight;

  const typeStyle = getTypeStyles(obj.object_type_id);

  const isSelfActive = activePathNodesAndLinks?.targetId === obj.id;
  const isUpstreamNode = activePathNodesAndLinks?.upstreamNodes.has(obj.id);
  const isDownstreamNode = activePathNodesAndLinks?.downstreamNodes.has(obj.id);

  let cardOpacity = 'opacity-100';
  let cardDisplayStyle: React.CSSProperties = {};

  if (activePathNodesAndLinks) {
    if (isSelfActive || isUpstreamNode || isDownstreamNode) {
      cardOpacity = 'opacity-100 scale-[1.02]';
    } else {
      if (isFocusMode) {
        cardDisplayStyle = { display: 'none' };
      } else {
        cardOpacity = 'opacity-20 scale-[0.96] hover:opacity-55 hover:scale-[0.98] transition-all duration-200';
      }
    }
  }

  const parsedProperties = useMemo(() => {
    try {
      return typeof obj.properties === 'string' ? JSON.parse(obj.properties || '{}') : (obj.properties || {});
    } catch (e) {
      return {};
    }
  }, [obj.properties]);

  const inlineProps = useMemo(() => {
    return Object.entries(parsedProperties).slice(0, 2);
  }, [parsedProperties]);

  const borderHighlight = selected || isSelfActive
    ? 'ring-2 ring-monokai-blue border-transparent'
    : (isUpstreamNode ? 'ring-1.5 ring-monokai-green border-transparent'
    : (isDownstreamNode ? 'ring-1.5 ring-monokai-blue border-transparent'
    : ''));

  const colorHexMap: Record<string, string> = {
    'text-zinc-400': '#a1a1aa',
    'text-monokai-blue': '#66d9ef',
    'text-monokai-green': '#a6e22e',
    'text-monokai-yellow': '#e6db74',
    'text-monokai-orange': '#fd971f',
    'text-monokai-pink': '#f92672'
  };
  const themeColor = colorHexMap[typeStyle.text] ?? '#a1a1aa';
  
  // Show menu when selected OR hovered (if not compact)
  const showMenu = !isReadOnly && (selected || (hovered && !isCompact));

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: `${nodeWidth}px`,
        minHeight: `${finalHeight}px`,
        overflow: 'hidden',
        transition: 'opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1), min-height 0.2s ease',
        boxShadow: selected
          ? `0 0 25px -4px ${themeColor}60, inset 0 1px 1px rgba(255, 255, 255, 0.15)`
          : hovered
          ? `0 12px 30px -8px ${themeColor}45, inset 0 1px 1px rgba(255, 255, 255, 0.1)`
          : '0 4px 20px -4px rgba(0, 0, 0, 0.6), inset 0 1px 1px rgba(255, 255, 255, 0.05)',
        ...cardDisplayStyle
      }}
      className={`relative rounded-lg bg-zinc-950/80 backdrop-blur-md border px-4 py-3.5 flex flex-col justify-between select-none overflow-hidden ${isLocked ? 'border-amber-500/40 border-dashed bg-[#121110]/80' : 'border-zinc-850/80'} group ${cardOpacity} ${borderHighlight} ${isHighlighted ? 'ring-2 ring-monokai-blue border-transparent' : ''}`}
    >
      {/* Dynamic background tinted environment overlay overlay */}
      <div className={`absolute inset-0 opacity-[0.045] pointer-events-none ${typeStyle.bg}`} />

      {/* Target & Source Handles - Glowing custom-colored handles matching themeColor */}
      <Handle
        type="target"
        position={Position.Left}
        id="left-target"
        className="w-2.5 h-2.5 rounded-full border hover:scale-125 transition-all !bg-zinc-950 opacity-0 group-hover:opacity-100 shadow-[0_0_8px_rgba(255,255,255,0.2)]"
        style={{ left: -5, borderColor: themeColor, borderWidth: '1.5px', boxShadow: `0 0 8px ${themeColor}80` }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right-source"
        className="w-2.5 h-2.5 rounded-full border hover:scale-125 transition-all !bg-zinc-950 opacity-0 group-hover:opacity-100 shadow-[0_0_8px_rgba(255,255,255,0.2)]"
        style={{ right: -5, borderColor: themeColor, borderWidth: '1.5px', boxShadow: `0 0 8px ${themeColor}80` }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top-target"
        className="w-2.5 h-2.5 rounded-full border hover:scale-125 transition-all !bg-zinc-950 opacity-0 group-hover:opacity-100 shadow-[0_0_8px_rgba(255,255,255,0.2)]"
        style={{ top: -5, borderColor: themeColor, borderWidth: '1.5px', boxShadow: `0 0 8px ${themeColor}80` }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom-source"
        className="w-2.5 h-2.5 rounded-full border hover:scale-125 transition-all !bg-zinc-950 opacity-0 group-hover:opacity-100 shadow-[0_0_8px_rgba(255,255,255,0.2)]"
        style={{ bottom: -5, borderColor: themeColor, borderWidth: '1.5px', boxShadow: `0 0 8px ${themeColor}80` }}
      />
      {/* Programmatic anchors let radial/circular/force layouts choose the
          nearest side without changing the user's visible link controls. */}
      <Handle
        type="source"
        position={Position.Left}
        id="left-source"
        className="!opacity-0 pointer-events-none"
      />
      <Handle
        type="target"
        position={Position.Right}
        id="right-target"
        className="!opacity-0 pointer-events-none"
      />
      <Handle
        type="source"
        position={Position.Top}
        id="top-source"
        className="!opacity-0 pointer-events-none"
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom-target"
        className="!opacity-0 pointer-events-none"
      />

      {/* Decorative indicator bar */}
      <div className={`absolute top-0 left-0 right-0 h-[3px] rounded-t-[8px] bg-gradient-to-r from-zinc-700 to-zinc-800 ${typeStyle.text.replace('text-', 'bg-')}`} />

      {isCompact ? (
        <div className="flex flex-col items-center justify-center w-full overflow-hidden mt-1 gap-1 pointer-events-none text-center">
          <span className="text-[10px] font-bold text-slate-100 truncate w-full text-center" title={obj.name}>
            {obj.name}
          </span>
          <div className="flex items-center justify-center gap-1.5 w-full">
            <span className={`text-[7px] font-mono font-bold tracking-wider uppercase px-1.5 py-0.2 shrink-0 rounded-sm text-center ${typeStyle.bg} ${typeStyle.text}`}>
              {type?.name || '未知'}
            </span>
            <span className="text-[6.5px] font-mono text-zinc-500 scale-90 shrink-0">
              {incomingCount}→{outgoingCount}
            </span>
          </div>
        </div>
      ) : (
        <>
          {/* Card Hover Action Bar */}
          <div className={`absolute -top-7 right-0 bg-zinc-950/90 border border-zinc-800 rounded px-1.5 py-0.5 flex gap-1 shadow-lg transition-all z-20 pointer-events-auto ${showMenu ? 'opacity-100 translate-y-7' : 'opacity-0 pointer-events-none'}`}>
            <button
              onClick={(e) => { e.stopPropagation(); onLockToggle(obj.id); }}
              className="p-1 rounded text-slate-400 hover:text-amber-500 transition-colors"
              title={isLocked ? "解锁节点" : "锁定节点"}
            >
              {isLocked ? (
                <Lock className="w-3 h-3 text-amber-500" />
              ) : (
                <Unlock className="w-3 h-3" />
              )}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onEditOpen(obj); }}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-monokai-cyan transition-colors"
              title="编辑设置"
            >
              <Settings className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(obj.id); }}
              className="p-1 hover:bg-monokai-pink/10 rounded text-slate-400 hover:text-monokai-pink transition-colors"
              title="删除节点"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>

          <div className="flex flex-col items-center justify-center gap-1.5 w-full overflow-hidden mt-1 text-center">
            <div className="flex items-center justify-center gap-1.5 truncate w-full text-center">
              {isLocked && (
                <Lock className="w-3 h-3 text-amber-500 shrink-0" title="该节点已锁定" />
              )}
              <Database className={`w-3.5 h-3.5 ${typeStyle.text} opacity-60 shrink-0`} />
              <span className="text-xs font-semibold text-slate-100 truncate leading-snug text-center" title={obj.name}>
                {obj.name}
              </span>
            </div>
          </div>

          {/* Inline Properties list */}
          {inlineProps.length > 0 && (
            <div className="w-full mt-2.5 text-[9px] font-mono space-y-1 border-t border-zinc-800/60 pt-2 leading-tight text-left">
              <div className="flex items-center justify-between text-zinc-550 mb-1">
                <span className="font-bold tracking-wider uppercase text-[8px]">特性 (Properties)</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onExpandToggle(obj.id); }}
                  className="hover:text-slate-350 text-[8px] tracking-wider transition-colors uppercase font-bold"
                  title={isExpanded ? "收起属性" : "展开属性"}
                >
                  {isExpanded || isDetailed ? '收起 ▲' : '详情 ▼'}
                </button>
              </div>

              {(isExpanded || isDetailed) ? (
                <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-1 py-0.5">
                  {Object.entries(parsedProperties).map(([k, val]) => (
                    <div key={k} className="flex justify-between gap-2 items-center py-1 border-b border-zinc-800/40">
                      <span className="text-zinc-400 truncate max-w-[45%]" title={k}>{k}</span>
                      <div className="max-w-[50%] truncate text-[9px] text-right">
                        {renderPropertyValue(val)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                inlineProps.map(([k, val]) => (
                  <div key={k} className="flex justify-between gap-2 items-center py-1 border-b border-zinc-800/40">
                    <span className="text-zinc-400 truncate max-w-[45%]" title={k}>{k}</span>
                    <div className="max-w-[50%] truncate text-[9px] text-right">
                      {renderPropertyValue(val)}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          <div className="flex items-center justify-center gap-3 w-full mt-3 pt-2 border-t border-zinc-800/60">
            <span className={`text-[8px] font-mono font-bold tracking-widest uppercase px-1.5 py-0.5 rounded-sm text-center ${typeStyle.bg} ${typeStyle.text}`}>
              {type?.name || '未知'}
            </span>
            <span className="text-[7.5px] font-mono font-bold text-zinc-500 tracking-wider">
              入: {incomingCount} | 出: {outgoingCount}
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export const OntologyNode = React.memo(OntologyNodeInner, (prev, next) => {
  return (
    prev.id === next.id &&
    prev.selected === next.selected &&
    prev.data.isLocked === next.data.isLocked &&
    prev.data.isHighlighted === next.data.isHighlighted &&
    prev.data.isExpanded === next.data.isExpanded &&
    prev.data.isReadOnly === next.data.isReadOnly &&
    prev.data.nodeWidth === next.data.nodeWidth &&
    prev.data.nodeHeight === next.data.nodeHeight &&
    prev.data.incomingCount === next.data.incomingCount &&
    prev.data.outgoingCount === next.data.outgoingCount &&
    prev.data.isFocusMode === next.data.isFocusMode &&
    prev.data.obj.name === next.data.obj.name &&
    prev.data.obj.properties === next.data.obj.properties &&
    prev.data.activePathNodesAndLinks === next.data.activePathNodesAndLinks
  );
});
