import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronDown, Trash2 } from 'lucide-react';
import ItemNode from './CanvasItemNode';
import type { CanvasSpace, CanvasItem } from './OntologyCanvas.types';

interface SpaceNodeProps {
  space: CanvasSpace;
  isSelected: boolean;
  onSelect: () => void;
  onMoveStart: (e: React.MouseEvent) => void;
  onResize: (width: number, height: number) => void;
  onToggleCollapse: () => void;
  onTitleChange: (title: string) => void;
  onDelete: () => void;
  onItemSelect: (itemId: string) => void;
  onItemDragStart: (itemId: string, e: React.MouseEvent) => void;
  onItemDelete: (itemId: string) => void;
  onLinkStart: (itemId: string, e: React.MouseEvent) => void;
  onLinkEnd: (itemId: string) => void;
  selectedItemId: string | null;
  focusedItemId: string | null;
  connectedNodeIds: Set<string> | null;
  objects: any[];
  objectTypes: any[];
  canvasZoom: number;
}

const SpaceNode: React.FC<SpaceNodeProps> = ({
  space, isSelected, onSelect, onMoveStart, onToggleCollapse,
  onTitleChange, onDelete, onItemSelect, onItemDragStart, onItemDelete,
  onLinkStart, onLinkEnd,
  selectedItemId, focusedItemId, connectedNodeIds, objects, objectTypes, canvasZoom
}) => {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(space.title);
  const titleRef = useRef<HTMLInputElement>(null);

  const handleTitleBlur = () => {
    setEditingTitle(false);
    if (titleValue.trim()) onTitleChange(titleValue.trim());
  };

  useEffect(() => { if (editingTitle) titleRef.current?.select(); }, [editingTitle]);

  return (
    <div
      data-space-id={space.id}
      onClick={onSelect}
      style={{
        position: 'absolute',
        left: space.x, top: space.y,
        width: space.width, height: space.collapsed ? 40 : space.height,
        background: `linear-gradient(135deg, rgba(20,20,32,0.92) 0%, rgba(30,30,50,0.88) 100%)`,
        border: `2px ${isSelected ? 'solid' : 'dashed'} ${space.color}60`,
        borderRadius: 14,
        cursor: 'default',
        userSelect: 'none',
        backdropFilter: 'blur(8px)',
        boxShadow: isSelected
          ? `0 0 0 1px ${space.color}25, 0 0 20px ${space.color}15, 0 8px 24px rgba(0,0,0,0.4)`
          : `inset 0 1px 0 ${space.color}10, 0 4px 16px rgba(0,0,0,0.2)`,
        transition: 'box-shadow 0.15s, height 0.2s',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        pointerEvents: 'auto'
      }}
    >
      <div
        onMouseDown={(e) => { e.stopPropagation(); onMoveStart(e); }}
        style={{
          padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6,
          cursor: isSelected ? 'grab' : 'default',
          borderBottom: space.collapsed ? 'none' : `1px solid ${space.color}20`,
          flexShrink: 0
        }}
      >
        <button onClick={(e) => { e.stopPropagation(); onToggleCollapse(); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          {space.collapsed
            ? <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          }
        </button>
        {editingTitle ? (
          <input
            ref={titleRef}
            value={titleValue}
            onChange={e => setTitleValue(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={e => { if (e.key === 'Enter') handleTitleBlur(); }}
            style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', fontSize: 12, outline: 'none' }}
          />
        ) : (
          <span
            onDoubleClick={() => setEditingTitle(true)}
            style={{ flex: 1, fontSize: 12, fontWeight: 700, color: space.color }}
          >
            {space.title}
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          aria-label="删除空间"
          className="bg-none border-none cursor-pointer transition-all duration-150 hover:opacity-100"
          style={{ color: '#ef4444', opacity: 0.55 }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {!space.collapsed && (
        <div style={{ flex: 1, position: 'relative', overflow: 'auto', padding: 12 }}>
          {space.items.map(item => (
            <ItemNode
              key={item.id}
              item={item}
              obj={objects.find(o => o.id === item.objectId)}
              objType={objectTypes.find(t => t.id === objects.find(o => o.id === item.objectId)?.object_type_id)}
              isSelected={selectedItemId === item.id}
              isDraggingThis={false}
              isDimmed={!!(connectedNodeIds && !connectedNodeIds.has(item.id))}
              isFocusHighlighted={!!(connectedNodeIds && connectedNodeIds.has(item.id))}
              onSelect={() => onItemSelect(item.id)}
              onDragStart={(e) => { e.stopPropagation(); onItemDragStart(item.id, e); }}
              onDragEnd={() => {}}
              onDelete={() => onItemDelete(item.id)}
              onLinkStart={(e) => onLinkStart(item.id, e)}
              onLinkEnd={() => onLinkEnd(item.id)}
              layerColor={space.color}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default SpaceNode;
