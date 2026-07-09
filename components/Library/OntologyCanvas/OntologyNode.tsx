import React from 'react';
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
    onLockToggle: (id: number) => void;
    onEditOpen: (node: any) => void;
    onDelete: (id: number) => void;
    onExpandToggle: (id: number) => void;
  };
  selected: boolean;
}

export const OntologyNode: React.FC<OntologyNodeProps> = ({ id, data, selected }) => {
  const { zoom } = useViewport();
  const isCompact = zoom < 0.65;
  const isDetailed = zoom >= 0.95;

  const {
    obj,
    type,
    isLocked,
    isHighlighted,
    isExpanded,
    activePathNodesAndLinks,
    isFocusMode,
    onLockToggle,
    onEditOpen,
    onDelete,
    onExpandToggle,
  } = data;

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

  let inlineProps: [string, any][] = [];
  try {
    const parsed = typeof obj.properties === 'string' ? JSON.parse(obj.properties || '{}') : (obj.properties || {});
    inlineProps = Object.entries(parsed).slice(0, 2);
  } catch (e) {}

  const borderHighlight = selected || isSelfActive
    ? 'ring-2 ring-monokai-blue border-transparent'
    : (isUpstreamNode ? 'ring-1.5 ring-monokai-green border-transparent'
    : (isDownstreamNode ? 'ring-1.5 ring-monokai-blue border-transparent'
    : ''));

  return (
    <div
      style={{
        width: '220px',
        minHeight: isExpanded ? '145px' : '82px',
        overflow: 'hidden',
        transition: 'opacity 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease, min-height 0.2s ease',
        ...cardDisplayStyle
      }}
      className={`relative rounded bg-zinc-900/95 border px-3.5 py-3 flex flex-col justify-between select-none overflow-hidden ${isLocked ? 'border-amber-500/40 border-dashed bg-[#121110]/95' : 'border-zinc-800/90'} group ${cardOpacity} ${borderHighlight} ${isHighlighted ? 'ring-2 ring-monokai-blue border-transparent' : ''}`}
    >
      {/* Target & Source Handles - Glowing small green dots */}
      <Handle
        type="target"
        position={Position.Left}
        id="left-target"
        className="w-2 h-2 rounded-full border border-monokai-green hover:scale-125 transition-all !bg-zinc-950 opacity-0 group-hover:opacity-100"
        style={{ left: -4, borderColor: '#a6e22e' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right-source"
        className="w-2 h-2 rounded-full border border-monokai-green hover:scale-125 transition-all !bg-zinc-950 opacity-0 group-hover:opacity-100"
        style={{ right: -4, borderColor: '#a6e22e' }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top-target"
        className="w-2 h-2 rounded-full border border-monokai-green hover:scale-125 transition-all !bg-zinc-950 opacity-0 group-hover:opacity-100"
        style={{ top: -4, borderColor: '#a6e22e' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom-source"
        className="w-2 h-2 rounded-full border border-monokai-green hover:scale-125 transition-all !bg-zinc-950 opacity-0 group-hover:opacity-100"
        style={{ bottom: -4, borderColor: '#a6e22e' }}
      />

      {/* Decorative indicator bar */}
      <div className={`absolute top-0 left-0 right-0 h-[3px] rounded-t-[4px] bg-gradient-to-r from-zinc-700 to-zinc-800 ${typeStyle.text.replace('text-', 'bg-')}`} />

      {isCompact ? (
        <div className="flex items-center justify-between w-full overflow-hidden mt-1 gap-1.5 pointer-events-none">
          <span className="text-[10px] font-bold text-slate-100 truncate w-[68%]" title={obj.name}>
            {obj.name}
          </span>
          <span className={`text-[7px] font-mono font-bold tracking-wider uppercase px-1 py-0.2 shrink-0 rounded-sm ${typeStyle.bg} ${typeStyle.text}`}>
            {type?.name || '未知'}
          </span>
        </div>
      ) : (
        <>
          {/* Card Hover Action Bar */}
          <div className="absolute -top-7 right-0 bg-zinc-950/90 border border-zinc-800 rounded px-1.5 py-0.5 flex gap-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-auto">
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

          <div className="flex items-start justify-between gap-2 w-full overflow-hidden mt-1">
            <div className="flex items-center gap-1.5 truncate w-[80%]">
              {isLocked && (
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
            <span className={`text-[8px] font-mono font-bold tracking-widest uppercase px-1.5 py-0.5 rounded-sm ${typeStyle.bg} ${typeStyle.text}`}>
              {type?.name || '未知'}
            </span>
          </div>
        </>
      )}
    </div>
  );
};
