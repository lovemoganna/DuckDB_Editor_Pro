import React from 'react';
import { Lock, Unlock, Settings, Trash2, Database, Plus } from 'lucide-react';
import { Position, getTypeStyles } from './OntologyCanvas.helpers';

interface OntologyNodeCardProps {
  obj: any;
  pos: Position;
  isSelected: boolean;
  isHighlighted: boolean;
  type: any;
  isSelfActive: boolean;
  isUpstreamNode: boolean;
  isDownstreamNode: boolean;
  isFocusMode: boolean;
  isPropertiesExpanded: boolean;
  isCompact: boolean;
  isDetailed: boolean;
  draggingNodeId: number | null;
  lockedNodeIds: Set<number>;
  zoom: number;
  handleNodePointerDown: (e: React.PointerEvent, id: number) => void;
  handleNodePointerMove: (e: React.PointerEvent, id: number) => void;
  handleNodePointerUp: (e: React.PointerEvent, id: number) => void;
  handleConnectStart: (e: React.MouseEvent, id: number) => void;
  setSelectedNodeId: (id: number) => void;
  setHoveredNodeId: (id: number | null) => void;
  setIsSidebarOpen: (o: boolean) => void;
  toggleLockNode: (id: number) => void;
  handleOpenEditNode: (node: any) => void;
  handleDeleteNode: (id: number) => void;
  toggleExpandNode: (e: React.MouseEvent, id: number) => void;
  activePathNodesAndLinks: any;
}

export const OntologyNodeCard: React.FC<OntologyNodeCardProps> = ({
  obj,
  pos,
  isSelected,
  isHighlighted,
  type,
  isSelfActive,
  isUpstreamNode,
  isDownstreamNode,
  isFocusMode,
  isPropertiesExpanded,
  isCompact,
  isDetailed,
  draggingNodeId,
  lockedNodeIds,
  zoom,
  handleNodePointerDown,
  handleNodePointerMove,
  handleNodePointerUp,
  handleConnectStart,
  setSelectedNodeId,
  setHoveredNodeId,
  setIsSidebarOpen,
  toggleLockNode,
  handleOpenEditNode,
  handleDeleteNode,
  toggleExpandNode,
  activePathNodesAndLinks,
}) => {
  const typeStyle = getTypeStyles(obj.object_type_id);

  // Smart interaction dimming/highlighting & path tracing
  let cardOpacity = 'opacity-100';
  let cardDisplayStyle: React.CSSProperties = {};
  if (activePathNodesAndLinks) {
    if (isSelfActive || isUpstreamNode || isDownstreamNode) {
      cardOpacity = 'opacity-100 scale-[1.03]';
    } else {
      if (isFocusMode) {
        cardDisplayStyle = { display: 'none' };
      } else {
        cardOpacity = 'opacity-20 scale-[0.94] hover:opacity-50 hover:scale-95 transition-all duration-200';
      }
    }
  }

  // Parse properties to extract up to 2 items for compact preview
  let inlineProps: [string, any][] = [];
  try {
    const parsed = typeof obj.properties === 'string' ? JSON.parse(obj.properties || '{}') : (obj.properties || {});
    inlineProps = Object.entries(parsed).slice(0, 2);
  } catch (e) {}

  // Border highlighting colors
  const borderHighlight = isSelfActive 
    ? 'ring-2 ring-monokai-blue border-transparent' 
    : (isUpstreamNode ? 'ring-1.5 ring-monokai-green border-transparent' 
    : (isDownstreamNode ? 'ring-1.5 ring-monokai-blue border-transparent' 
    : ''));

  // Z-Index hierarchy: Dragged nodes are topmost, followed by selected and path highlights
  let nodeZIndex = 10;
  if (draggingNodeId === obj.id) {
    nodeZIndex = 50;
  } else if (isSelected) {
    nodeZIndex = 40;
  } else if (isSelfActive || isUpstreamNode || isDownstreamNode) {
    nodeZIndex = 30;
  }

  // Apply pointer-events: none to OTHER cards while dragging to avoid triggering random hovers
  const dragPointerClass = draggingNodeId !== null 
    ? (draggingNodeId === obj.id ? 'pointer-events-auto z-50' : 'pointer-events-none opacity-40') 
    : 'pointer-events-auto';

  return (
    <div
      id={`node-card-${obj.id}`}
      onPointerDown={(e) => handleNodePointerDown(e, obj.id)}
      onPointerMove={(e) => handleNodePointerMove(e, obj.id)}
      onPointerUp={(e) => handleNodePointerUp(e, obj.id)}
      onDoubleClick={(e) => { e.stopPropagation(); setSelectedNodeId(obj.id); setIsSidebarOpen(true); }}
      onMouseEnter={() => draggingNodeId === null && setHoveredNodeId(obj.id)}
      onMouseLeave={() => draggingNodeId === null && setHoveredNodeId(null)}
      style={{
        left: pos.x,
        top: pos.y,
        transform: 'translate(-50%, -50%)',
        width: isCompact ? '160px' : '220px',
        minHeight: isCompact ? '42px' : (isPropertiesExpanded ? '145px' : '82px'),
        zIndex: nodeZIndex,
        transition: draggingNodeId === obj.id 
          ? 'none' 
          : 'opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s ease, min-height 0.2s ease, width 0.2s ease',
         ...cardDisplayStyle
       }}
      className={`absolute rounded bg-zinc-900/95 backdrop-blur-md border px-3.5 py-3 flex flex-col justify-between select-none ${lockedNodeIds.has(obj.id) ? 'border-amber-500/40 border-dashed bg-[#121110]/95' : 'border-zinc-800/90'} group ${cardOpacity} ${borderHighlight} ${isHighlighted ? 'ring-2 ring-monokai-blue border-transparent' : ''} ${dragPointerClass} ${lockedNodeIds.has(obj.id) ? 'cursor-default' : 'touch-none cursor-grab'}`}
    >
      {/* Visual Connection Anchors - 4 sides */}
      {!isCompact && !lockedNodeIds.has(obj.id) && (
        <>
          <div
            onMouseDown={(e) => handleConnectStart(e, obj.id)}
            className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-zinc-950 border border-monokai-green hover:bg-monokai-green hover:scale-125 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all cursor-crosshair z-10"
            title="拖拽拉线新建关系"
          />
          <div
            onMouseDown={(e) => handleConnectStart(e, obj.id)}
            className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2.5 h-2.5 rounded-full bg-zinc-950 border border-monokai-green hover:bg-monokai-green hover:scale-125 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all cursor-crosshair z-10"
            title="拖拽拉线新建关系"
          />
          <div
            onMouseDown={(e) => handleConnectStart(e, obj.id)}
            className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-zinc-950 border border-monokai-green hover:bg-monokai-green hover:scale-125 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all cursor-crosshair z-10"
            title="拖拽拉线新建关系"
          />
          <div
            onMouseDown={(e) => handleConnectStart(e, obj.id)}
            className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-zinc-950 border border-monokai-green hover:bg-monokai-green hover:scale-125 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all cursor-crosshair z-10"
            title="拖拽拉线新建关系"
          />
        </>
      )}

      {/* Decorative type indicator bar on top */}
      <div className={`absolute top-0 left-0 right-0 h-[3px] rounded-t-[4px] bg-gradient-to-r from-zinc-700 to-zinc-800 ${typeStyle.text.replace('text-', 'bg-')}`} />

      {/* Zoom-dependent card presentation */}
      {isCompact ? (
        /* COMPACT MODE VIEW */
        <div className="flex items-center justify-between w-full overflow-hidden mt-1 gap-1.5 pointer-events-none">
          <span className="text-[10px] font-bold text-slate-100 truncate w-[68%]" title={obj.name}>
            {obj.name}
          </span>
          <span className={`text-[7px] font-mono font-bold tracking-wider uppercase px-1 py-0.2 shrink-0 rounded-sm ${typeStyle.bg} ${typeStyle.text}`}>
            {type?.name || '未知'}
          </span>
        </div>
      ) : (
        /* NORMAL & DETAILED VIEWS */
        <>
          {/* Detailed Quick Hover Action Bar */}
          {!isCompact && (
            <div className="absolute -top-7 right-0 bg-zinc-950/90 border border-zinc-800 rounded px-1.5 py-0.5 flex gap-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-auto">
              <button
                onClick={(e) => { e.stopPropagation(); toggleLockNode(obj.id); }}
                className={`p-1 rounded text-slate-400 hover:text-amber-500 transition-colors`}
                title={lockedNodeIds.has(obj.id) ? "解锁节点" : "锁定节点"}
              >
                {lockedNodeIds.has(obj.id) ? (
                  <Lock className="w-3 h-3 text-amber-500" />
                ) : (
                  <Unlock className="w-3 h-3" />
                )}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleOpenEditNode(obj); }}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-monokai-cyan transition-colors"
                title="编辑设置"
              >
                <Settings className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteNode(obj.id); }}
                className="p-1 hover:bg-monokai-pink/10 rounded text-slate-400 hover:text-monokai-pink transition-colors"
                title="删除节点"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}

          <div className="flex items-start justify-between gap-2 w-full overflow-hidden mt-1">
            <div className="flex items-center gap-1.5 truncate w-[80%]">
              {lockedNodeIds.has(obj.id) && (
                <Lock className="w-3 h-3 text-amber-500 shrink-0" title="该节点已锁定" />
              )}
              <span className="text-xs font-semibold text-slate-100 truncate leading-snug" title={obj.name}>
                {obj.name}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Database className={`w-3.5 h-3.5 ${typeStyle.text} opacity-80 shrink-0`} />
            </div>
          </div>

          {/* Inline Collapsible Properties - Slot Style Row Layout */}
          {inlineProps.length > 0 && (
            <div className="w-full mt-2.5 text-[9px] font-mono space-y-1 border-t border-zinc-800/60 pt-2 leading-tight text-left">
              <div className="flex items-center justify-between text-zinc-550 mb-1">
                <span className="font-bold tracking-wider uppercase text-[8px]">特性 (Properties)</span>
                <button
                  onClick={(e) => toggleExpandNode(e, obj.id)}
                  className="hover:text-slate-350 text-[8px] tracking-wider transition-colors uppercase font-bold"
                  title={isPropertiesExpanded ? "收起属性" : "展开属性"}
                >
                  {isPropertiesExpanded || isDetailed ? '收起 ▲' : '详情 ▼'}
                </button>
              </div>
              
              {(isPropertiesExpanded || isDetailed) ? (
                <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-1 py-0.5">
                  {(() => {
                    try {
                      const parsed = typeof obj.properties === 'string' ? JSON.parse(obj.properties || '{}') : (obj.properties || {});
                      return Object.entries(parsed).map(([k, val]) => (
                        <div key={k} className="flex justify-between gap-2 items-center py-1 border-b border-zinc-800/40">
                          <span className="text-zinc-400 truncate max-w-[45%]" title={k}>{k}</span>
                          <span className="text-zinc-200 truncate max-w-[50%] font-medium text-[9px] text-right" title={String(val)}>{String(val)}</span>
                        </div>
                      ));
                    } catch (e) {
                      return <span className="text-monokai-pink">解析错误</span>;
                    }
                  })()}
                </div>
              ) : (
                inlineProps.map(([k, val]) => (
                  <div key={k} className="flex justify-between gap-2 items-center py-1 border-b border-zinc-800/40">
                    <span className="text-zinc-400 truncate max-w-[45%]" title={k}>{k}</span>
                    <span className="text-zinc-200 truncate max-w-[50%] font-medium text-[9px] text-right" title={String(val)}>{String(val)}</span>
                  </div>
                ))
              )}
            </div>
          )}

          <div className="flex items-center justify-between w-full mt-3 pt-2 border-t border-zinc-800/60">
            {/* Object Type label */}
            <span className={`text-[8px] font-mono font-bold tracking-widest uppercase px-1.5 py-0.5 rounded-sm ${typeStyle.bg} ${typeStyle.text}`}>
              {type?.name || '未知'}
            </span>

            {/* Pull Link Connector Anchor Handle */}
            <button
              onMouseDown={(e) => handleConnectStart(e, obj.id)}
              title="拖拽拉线新建关系"
              className="w-4.5 h-4.5 rounded-full bg-zinc-800 hover:bg-monokai-green flex items-center justify-center group/btn cursor-crosshair border border-zinc-700/60 shadow transition-colors"
            >
              <Plus className="w-2.5 h-2.5 text-zinc-400 group-hover/btn:text-slate-900" />
            </button>
          </div>
        </>
      )}
    </div>
  );
};
