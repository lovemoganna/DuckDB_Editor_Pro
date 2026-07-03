import React from 'react';
import {
  Plus, X, Trash2,
  GripVertical, ExternalLink, Sparkles,
  Database, RefreshCcw, Layers, Zap
} from 'lucide-react';
import { MECE_LAYER_COLORS } from './OntologyCanvas.types';
import type { MECELayer } from './OntologyCanvas.types';

interface CanvasItem {
  id: string;
  objectId: number;
  x: number;
  y: number;
  width: number;
  height: number;
  nodeType?: string;
  metadata?: any;
}

interface ItemNodeProps {
  item: CanvasItem;
  obj: any | undefined;
  objType: any | undefined;
  isSelected: boolean;
  isDraggingThis: boolean;
  isDimmed: boolean;
  isFocusHighlighted: boolean;
  onSelect: () => void;
  onDragStart: (e: React.MouseEvent) => void;
  onDragEnd: () => void;
  onDelete: () => void;
  onLinkStart: (e: React.MouseEvent) => void;
  onLinkEnd: () => void;
  layerColor?: string;
  onContextMenu?: (e: React.MouseEvent, itemId: string) => void;
}

const ItemNode: React.FC<ItemNodeProps> = ({
  item, obj, objType, isSelected, isDraggingThis, isDimmed, isFocusHighlighted,
  onSelect, onDragStart, onDragEnd, onDelete, onLinkStart, onLinkEnd,
  layerColor = '#94a3b8', onContextMenu
}) => {
  const meceColor = item.metadata?.layerTag
    ? MECE_LAYER_COLORS[item.metadata.layerTag as MECELayer] || layerColor
    : layerColor;
  const borderColor = meceColor;

  const NodeTypeIcon =
    item.nodeType === 'Source' ? Database :
    item.nodeType === 'Transform' ? RefreshCcw :
    item.nodeType === 'Sink' ? ExternalLink :
    item.nodeType === 'Concept' ? Database :
    item.nodeType === 'Event' ? Zap :
    item.nodeType === 'Goal' ? Layers :
    item.nodeType === 'Insight' ? Sparkles :
    item.nodeType === 'Table' ? Database : Sparkles;

  const dimOpacity = isDimmed ? 0.15 : 1;
  const focusGlow = isFocusHighlighted
    ? `0 0 0 3px ${borderColor}60, 0 0 20px ${borderColor}30, 0 8px 32px rgba(0,0,0,0.6)`
    : undefined;
  const normalShadow = isSelected
    ? `0 0 0 3px ${borderColor}50, 0 8px 32px rgba(0,0,0,0.6)`
    : `0 4px 12px rgba(0,0,0,0.3)`;

  return (
    <div
      data-item-id={item.id}
      onClick={onSelect}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(e, item.id); }}
      onMouseUp={(e) => {
        if (isDraggingThis) {
          e.stopPropagation();
          onDragEnd();
        } else {
          e.stopPropagation();
          onLinkEnd();
        }
      }}
      style={{
        position: 'absolute',
        left: item.x, top: item.y,
        width: Math.max(140, item.width), height: Math.max(80, item.height),
        background: 'rgba(13, 13, 20, 0.98)',
        border: `${isSelected ? 2 : 1}px solid ${isSelected ? '#fff' : borderColor}40`,
        borderRadius: 10,
        cursor: isDraggingThis ? 'grabbing' : 'grab',
        userSelect: 'none',
        boxShadow: focusGlow || normalShadow,
        transition: 'box-shadow 0.25s ease, opacity 0.25s ease, filter 0.25s ease',
        opacity: dimOpacity,
        filter: isDimmed ? 'blur(0.5px) saturate(0.2)' : isFocusHighlighted ? 'saturate(1.3)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        zIndex: isDraggingThis ? 100 : isFocusHighlighted ? 10 : isSelected ? 10 : 1,
        pointerEvents: 'auto'
      }}
      onMouseDown={(e) => { if (e.button === 0) { e.stopPropagation(); onDragStart(e); } }}
    >
      <div style={{
        padding: '5px 8px', display: 'flex', alignItems: 'center', gap: 4,
        borderBottom: '1px solid rgba(255,255,255,0.05)', minHeight: 28
      }}>
        <div onMouseDown={onDragStart}
          aria-label="拖拽移动节点"
          style={{ cursor: 'grab', display: 'flex', alignItems: 'center' }}
        >
          <GripVertical className="w-3 h-3 text-slate-600" />
        </div>
        <NodeTypeIcon className="w-3 h-3" style={{ color: borderColor }} />
        <span style={{ fontSize: 9, color: borderColor, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {item.nodeType || 'Source'}
        </span>
        {item.metadata?.layerTag && (
          <span style={{ fontSize: 8, color: meceColor, fontWeight: 600, marginLeft: 2, opacity: 0.7 }}>
            · {item.metadata.layerTag}
          </span>
        )}
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
          aria-label="删除节点"
          title="删除节点"
          className="ml-auto bg-none border-none cursor-pointer text-red-400 p-0 transition-all duration-150 hover:opacity-100 hover:scale-110"
          style={{ opacity: 0.55 }}
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      <div style={{
        flex: 1, padding: '6px 10px', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', minHeight: 0
      }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: '#f1f5f9',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3
        }}>
          {obj?.name || '未命名对象'}
        </div>
        <div style={{
          fontSize: 10, color: '#64748b', marginTop: 2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
        }}>
          {objType?.name || '节点'}
        </div>
        {item.metadata?.sqlFragment && (
          <div style={{
            fontSize: 9, color: '#475569', marginTop: 4, fontFamily: 'monospace',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.6
          }}>
            {item.metadata.sqlFragment.slice(0, 40)}
          </div>
        )}
      </div>

      <div
        onMouseDown={onLinkStart}
        style={{
          position: 'absolute', right: -6, top: '50%', transform: 'translateY(-50%)',
          width: 12, height: 12, borderRadius: '50%',
          background: borderColor, border: '2px solid #0d0d14',
          cursor: 'crosshair', zIndex: 100,
          boxShadow: `0 0 8px ${borderColor}60`
        }}
        title="拖拽连线"
        onMouseUp={(e) => e.stopPropagation()}
      />
    </div>
  );
};

export default ItemNode;
