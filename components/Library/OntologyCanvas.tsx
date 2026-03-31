/**
 * OntologyCanvas — 自由画布模块
 *
 * 允许用户在 2D 自由空间中组织本体论对象
 * - SpaceNode: 空间容器，用于分组对象
 * - ItemNode: 自由放置的对象节点
 * - 拖拽、缩放、画布平移
 * - 持久化到 DuckDB
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Move, Plus, ZoomIn, ZoomOut, Maximize2, Save, Trash2,
  GripVertical, ChevronDown, ChevronRight, Layers,
  Network, X, Edit3, Check, Search, ArrowRight,
  LayoutGrid, MousePointer2, Sparkles,
} from 'lucide-react';
import { duckDBService } from '../../services/duckdbService';

// ==================== Types ====================

interface LifeObject {
  id: number;
  object_type_id: number;
  name: string;
  properties: string;
  annotations?: string;
}

interface LifeObjectType {
  id: number;
  name: string;
  description: string;
}

interface LifeLink {
  id: number;
  link_type_id: number;
  source_object_id: number;
  target_object_id: number;
  weight: number;
}

interface LifeLinkType {
  id: number;
  name: string;
  description: string;
}

interface CanvasItem {
  id: string;
  objectId: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CanvasSpace {
  id: string;
  title: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  collapsed: boolean;
  items: CanvasItem[];
}

interface CanvasState {
  spaces: CanvasSpace[];
  items: CanvasItem[];
  viewportX: number;
  viewportY: number;
  zoom: number;
}

const SPACE_COLORS = [
  '#a78bfa', '#38bdf8', '#4ade80', '#fb923c',
  '#f472b6', '#a3e635', '#fbbf24', '#60a5fa',
];

const OBJECT_TYPE_STYLES: Record<string, {
  border: string;
  text: string;
  bg: string;
}> = {
  '1': { border: '#a78bfa', text: '#c4b5fd', bg: 'rgba(30, 27, 51, 0.95)' },
  '2': { border: '#38bdf8', text: '#7dd3fc', bg: 'rgba(27, 51, 64, 0.95)' },
  '3': { border: '#4ade80', text: '#86efac', bg: 'rgba(27, 51, 38, 0.95)' },
  default: { border: '#94a3b8', text: '#cbd5e1', bg: 'rgba(50, 50, 50, 0.95)' },
};

interface OntologyCanvasProps {
  onClose?: () => void;
}

// ==================== Item Node ====================

interface ItemNodeProps {
  item: CanvasItem;
  obj: LifeObject | undefined;
  objType: LifeObjectType | undefined;
  isSelected: boolean;
  onSelect: () => void;
  onDragStart: (e: React.MouseEvent) => void;
  onDelete: () => void;
}

const ItemNode: React.FC<ItemNodeProps> = ({
  item, obj, objType, isSelected, onSelect, onDragStart, onDelete,
}) => {
  const style = OBJECT_TYPE_STYLES[String(obj?.object_type_id)] || OBJECT_TYPE_STYLES.default;
  let parsedProps: Record<string, string> = {};
  try { if (obj?.properties && obj.properties !== 'null' && typeof obj.properties === 'string') parsedProps = JSON.parse(obj.properties) || {}; } catch {}
  const firstKey = Object.keys(parsedProps || {})[0];
  const firstVal = firstKey ? parsedProps[firstKey] : null;

  return (
    <div
      onClick={onSelect}
      style={{
        position: 'absolute',
        left: item.x, top: item.y,
        width: item.width, height: item.height,
        background: style.bg,
        border: `${isSelected ? 2 : 1.5}px solid ${isSelected ? style.text : style.border}`,
        borderRadius: 10,
        cursor: 'grab',
        userSelect: 'none',
        boxShadow: isSelected
          ? `0 0 0 3px ${style.border}40, 0 8px 20px rgba(0,0,0,0.5)`
          : '0 2px 8px rgba(0,0,0,0.3)',
        transition: 'box-shadow 0.15s, border 0.15s',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseDown={(e) => { if (e.button === 0) onDragStart(e); }}
    >
      {/* Color bar */}
      <div style={{ height: 3, background: `linear-gradient(90deg, ${style.border}, transparent)`, flexShrink: 0 }} />

      {/* Header */}
      <div style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 4, borderBottom: `1px solid ${style.border}20`, flexShrink: 0 }}>
        <GripVertical className="w-3 h-3" style={{ color: style.border, flexShrink: 0, cursor: 'grab' }} />
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: style.border, flexShrink: 0 }} />
        <span style={{ fontSize: 9, color: style.border, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {objType?.name || '其他'}
        </span>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: '#6b7280', opacity: 0.6 }}>
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '6px 8px', overflow: 'hidden' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: style.text, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {obj?.name || '未知对象'}
        </div>
        {firstVal !== null && (
          <div style={{ fontSize: 10, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {firstKey}: {String(firstVal)}
          </div>
        )}
      </div>
    </div>
  );
};

// ==================== Space Node ====================

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
  selectedItemId: string | null;
  objects: LifeObject[];
  objectTypes: LifeObjectType[];
  canvasZoom: number;
  children?: React.ReactNode;
}

const SpaceNode: React.FC<SpaceNodeProps> = ({
  space, isSelected, onSelect, onMoveStart, onResize, onToggleCollapse,
  onTitleChange, onDelete, onItemSelect, onItemDragStart, onItemDelete,
  selectedItemId, objects, objectTypes, canvasZoom, children
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
      onClick={onSelect}
      style={{
        position: 'absolute',
        left: space.x, top: space.y,
        width: space.width, height: space.collapsed ? 40 : space.height,
        background: 'rgba(20, 20, 32, 0.85)',
        border: `2px ${isSelected ? 'solid' : 'dashed'} ${space.color}50`,
        borderRadius: 14,
        cursor: 'default',
        userSelect: 'none',
        backdropFilter: 'blur(8px)',
        boxShadow: isSelected
          ? `0 0 0 2px ${space.color}30, 0 8px 24px rgba(0,0,0,0.4)`
          : '0 4px 16px rgba(0,0,0,0.2)',
        transition: 'box-shadow 0.15s, height 0.2s',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header — draggable area */}
      <div
        onMouseDown={(e) => { e.stopPropagation(); onMoveStart(e); }}
        style={{
          padding: '8px 10px',
          display: 'flex', alignItems: 'center', gap: 6,
          cursor: isSelected ? 'grab' : 'default',
          borderBottom: space.collapsed ? 'none' : `1px solid ${space.color}20`,
          flexShrink: 0,
        }}
      >
        <button onClick={(e) => { e.stopPropagation(); onToggleCollapse(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: space.color }}>
          {space.collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {editingTitle ? (
          <input
            ref={titleRef}
            value={titleValue}
            onChange={e => setTitleValue(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={e => { if (e.key === 'Enter') handleTitleBlur(); if (e.key === 'Escape') { setTitleValue(space.title); setEditingTitle(false); } }}
            onClick={e => e.stopPropagation()}
            style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: `1px solid ${space.color}60`, borderRadius: 4, padding: '2px 6px', color: '#f1f5f9', fontSize: 12, fontWeight: 600, outline: 'none' }}
          />
        ) : (
          <span
            onDoubleClick={() => setEditingTitle(true)}
            style={{ flex: 1, fontSize: 12, fontWeight: 700, color: space.color, cursor: 'text', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {space.title}
          </span>
        )}

        <span style={{ fontSize: 9, color: space.color, opacity: 0.6, fontFamily: 'monospace' }}>
          {space.items.length}
        </span>

        <button onClick={(e) => { e.stopPropagation(); setEditingTitle(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: '#6b7280', opacity: 0.6 }}>
          <Edit3 className="w-3 h-3" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: '#f87171', opacity: 0.6 }}>
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Items inside space */}
      {!space.collapsed && (
        <div style={{ flex: 1, overflow: 'auto', padding: 8, position: 'relative' }}>
          {space.items.length === 0 && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 11, pointerEvents: 'none' }}>
              从对象库拖入，或双击添加
            </div>
          )}
          {space.items.map(item => {
            const obj = objects.find(o => o.id === item.objectId);
            const objType = obj ? objectTypes.find(t => t.id === obj.object_type_id) : undefined;
            return (
              <ItemNode
                key={item.id}
                item={item}
                obj={obj}
                objType={objType}
                isSelected={selectedItemId === item.id}
                onSelect={() => onItemSelect(item.id)}
                onDragStart={(e) => { e.stopPropagation(); onItemDragStart(item.id, e); }}
                onDelete={() => onItemDelete(item.id)}
              />
            );
          })}
          {/* Render children (free items) */}
          {children}
        </div>
      )}
    </div>
  );
};

// ==================== Object Picker ====================

interface ObjectPickerProps {
  objects: LifeObject[];
  objectTypes: LifeObjectType[];
  onSelect: (objectId: number) => void;
  onClose: () => void;
}

const ObjectPicker: React.FC<ObjectPickerProps> = ({ objects, objectTypes, onSelect, onClose }) => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<number | null>(null);

  const filtered = objects.filter(o => {
    if (search && !o.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== null && o.object_type_id !== typeFilter) return false;
    return true;
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div style={{ width: 420, maxHeight: '70vh', background: 'rgba(20, 20, 32, 0.98)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>添加到画布</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ position: 'relative' }}>
            <Search className="w-3.5 h-3.5" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索对象..." style={{ width: '100%', paddingLeft: 28, paddingRight: 10, paddingTop: 6, paddingBottom: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e5e7eb', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          {/* Type filter */}
          <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
            <button onClick={() => setTypeFilter(null)} style={{ padding: '2px 8px', borderRadius: 12, border: 'none', cursor: 'pointer', background: typeFilter === null ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.05)', color: typeFilter === null ? '#c4b5fd' : '#6b7280', fontSize: 10, fontWeight: 500 }}>全部</button>
            {objectTypes.map(ot => {
              const s = OBJECT_TYPE_STYLES[String(ot.id)] || OBJECT_TYPE_STYLES.default;
              const active = typeFilter === ot.id;
              return (
                <button key={ot.id} onClick={() => setTypeFilter(ot.id)} style={{ padding: '2px 8px', borderRadius: 12, border: 'none', cursor: 'pointer', background: active ? `${s.border}20` : 'rgba(255,255,255,0.05)', color: active ? s.text : '#6b7280', fontSize: 10, fontWeight: 500 }}>
                  {ot.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: '#6b7280', fontSize: 12 }}>没有匹配的对象</div>}
          {filtered.map(obj => {
            const objType = objectTypes.find(t => t.id === obj.object_type_id);
            const s = OBJECT_TYPE_STYLES[String(obj.object_type_id)] || OBJECT_TYPE_STYLES.default;
            return (
              <button key={obj.id} onClick={() => { onSelect(obj.id); onClose(); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, cursor: 'pointer', marginBottom: 4, textAlign: 'left' as const }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.border, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: s.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{obj.name}</div>
                  {objType && <div style={{ fontSize: 10, color: '#6b7280' }}>{objType.name}</div>}
                </div>
                <ArrowRight className="w-3 h-3" style={{ color: s.border, flexShrink: 0 }} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ==================== Main Canvas ====================

const OntologyCanvasInner: React.FC<OntologyCanvasProps> = ({ onClose }) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasState, setCanvasState] = useState<CanvasState>({
    spaces: [],
    items: [],
    viewportX: 0,
    viewportY: 0,
    zoom: 1,
  });

  const [objects, setObjects] = useState<LifeObject[]>([]);
  const [objectTypes, setObjectTypes] = useState<LifeObjectType[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsInit, setNeedsInit] = useState(false);

  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [draggingSpaceId, setDraggingSpaceId] = useState<string | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showObjectPicker, setShowObjectPicker] = useState(false);
  const [pickerSpaceId, setPickerSpaceId] = useState<string | null>(null);
  const [showToolbar, setShowToolbar] = useState(true);
  const [initting, setInitting] = useState(false);

  // P2-1: Listen for AI Canvas Layout events from OntologyView
  useEffect(() => {
    const handler = (e: Event) => {
      const layout = (e as CustomEvent).detail;
      if (!layout) return;
      const SPACE_COLORS_CANVAS = [
        '#a78bfa', '#38bdf8', '#4ade80', '#fb923c', '#f87171', '#fbbf24',
      ];
      // Apply AI layout to canvas spaces
      const newSpaces: CanvasSpace[] = (layout.spaces || []).map((s: any, i: number) => ({
        id: s.id || `ai-space-${i}`,
        title: s.name,
        color: s.color || SPACE_COLORS_CANVAS[i % SPACE_COLORS_CANVAS.length],
        x: s.x || 0,
        y: s.y || 0,
        width: s.w || 400,
        height: s.h || 300,
        collapsed: false,
        items: [],
      }));
      // Apply AI layout to canvas items
      const newItems: CanvasItem[] = [];
      (layout.groups || []).forEach((g: any, gi: number) => {
        (g.items || []).forEach((itemName: string, ii: number) => {
          const matchingObj = objects.find(o => o.name.includes(itemName));
          if (matchingObj) {
            newItems.push({
              id: `ai-item-${gi}-${ii}`,
              objectId: matchingObj.id,
              x: (g.x || 50) + ii * 120,
              y: (g.y || 50) + gi * 100,
              width: 110,
              height: 60,
            });
          }
        });
      });
      setCanvasState(prev => ({
        ...prev,
        spaces: [...prev.spaces, ...newSpaces],
        items: [...prev.items, ...newItems],
      }));
    };
    window.addEventListener('ontology:ai-canvas-layout', handler);
    return () => window.removeEventListener('ontology:ai-canvas-layout', handler);
  }, [objects]);

  // Load data — auto-initialize tables first
  const checkAndInit = useCallback(async () => {
    setLoading(true);
    setNeedsInit(false);
    try {
      await duckDBService.ontologyInit();
      const [objs, ots] = await Promise.all([
        duckDBService.query('SELECT * FROM life_object ORDER BY id'),
        duckDBService.query('SELECT * FROM life_object_type ORDER BY id'),
      ]);
      setObjects(objs as LifeObject[]);
      setObjectTypes(ots as LifeObjectType[]);

      // Load canvas state
      try {
        const saved = await duckDBService.query('SELECT * FROM life_canvas_state ORDER BY id');
        if (Array.isArray(saved) && saved.length > 0) {
          const spacesMap = new Map<string, CanvasSpace>();
          const freeItems: CanvasItem[] = [];

          for (const row of saved as any[]) {
            if (row.space_id) {
              if (!spacesMap.has(row.space_id)) {
                spacesMap.set(row.space_id, {
                  id: row.space_id, title: row.title || '空间', color: row.color || SPACE_COLORS[0],
                  x: row.x || 50, y: row.y || 50,
                  width: row.width || 280, height: row.height || 300,
                  collapsed: false, items: [],
                });
              }
              if (row.id === row.space_id) {
                const space = spacesMap.get(row.space_id)!;
                space.title = row.title || '空间';
                space.color = row.color || SPACE_COLORS[0];
                space.x = row.x || 50;
                space.y = row.y || 50;
                space.width = row.width || 280;
                space.height = row.height || 300;
              } else {
                spacesMap.get(row.space_id)!.items.push({
                  id: row.id, objectId: row.object_id,
                  x: row.x || 0, y: row.y || 0,
                  width: row.width || 180, height: row.height || 70,
                });
              }
            } else {
              freeItems.push({
                id: row.id, objectId: row.object_id,
                x: row.x || 100, y: row.y || 100,
                width: row.width || 180, height: row.height || 70,
              });
            }
          }

          setCanvasState(prev => ({
            ...prev,
            spaces: Array.from(spacesMap.values()),
            items: freeItems,
          }));
        }
      } catch {}
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.includes('does not exist') || msg.includes('Catalog Error')) {
        setNeedsInit(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAndInit();
  }, [checkAndInit]);

  // Save to DuckDB
  const saveCanvas = useCallback(async () => {
    try {
      await duckDBService.query('CREATE TABLE IF NOT EXISTS life_canvas_state (id VARCHAR PRIMARY KEY, space_id VARCHAR, object_id INTEGER, title VARCHAR, color VARCHAR, x DECIMAL, y DECIMAL, width DECIMAL, height DECIMAL)');

      await duckDBService.query('DELETE FROM life_canvas_state');

      for (const space of canvasState.spaces) {
        await duckDBService.query(`INSERT INTO life_canvas_state VALUES ('${space.id}', '${space.id}', NULL, '${space.title.replace(/'/g, "''")}', '${space.color}', ${space.x}, ${space.y}, ${space.width}, ${space.height})`);
        for (const item of space.items) {
          await duckDBService.query(`INSERT INTO life_canvas_state VALUES ('${item.id}', '${space.id}', ${item.objectId}, NULL, NULL, ${item.x}, ${item.y}, ${item.width}, ${item.height})`);
        }
      }
      for (const item of canvasState.items) {
        await duckDBService.query(`INSERT INTO life_canvas_state VALUES ('${item.id}', NULL, ${item.objectId}, NULL, NULL, ${item.x}, ${item.y}, ${item.width}, ${item.height})`);
      }
    } catch (e) { console.error('Failed to save canvas:', e); }
  }, [canvasState]);

  // Pan handlers
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target !== canvasRef.current) return;
    if (e.button !== 0) return;
    setIsPanning(true);
    panStartRef.current = { x: e.clientX, y: e.clientY, vx: canvasState.viewportX, vy: canvasState.viewportY };
    setSelectedSpaceId(null);
    setSelectedItemId(null);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingItemId) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const scale = canvasState.zoom;
        const x = (e.clientX - rect.left) / scale - dragOffsetRef.current.x;
        const y = (e.clientY - rect.top) / scale - dragOffsetRef.current.y;

        setCanvasState(prev => {
          // Check which space contains this item
          for (const space of prev.spaces) {
            const itemIdx = space.items.findIndex(i => i.id === draggingItemId);
            if (itemIdx !== -1) {
              const updated = [...prev.spaces];
              updated[prev.spaces.indexOf(space)] = {
                ...space,
                items: space.items.map((item, idx) =>
                  idx === itemIdx ? { ...item, x, y } : item
                ),
              };
              return { ...prev, spaces: updated };
            }
          }
          // Free item
          return {
            ...prev,
            items: prev.items.map(item =>
              item.id === draggingItemId ? { ...item, x, y } : item
            ),
          };
        });
        return;
      }
      if (draggingSpaceId) {
        const scale = canvasState.zoom;
        const dx = (e.clientX - panStartRef.current.x) / scale;
        const dy = (e.clientY - panStartRef.current.y) / scale;
        setCanvasState(prev => ({
          ...prev,
          spaces: prev.spaces.map(s =>
            s.id === draggingSpaceId ? { ...s, x: panStartRef.current.vx + dx, y: panStartRef.current.vy + dy } : s
          ),
        }));
        return;
      }
      if (isPanning) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        setCanvasState(prev => ({
          ...prev,
          viewportX: panStartRef.current.vx + dx,
          viewportY: panStartRef.current.vy + dy,
        }));
      }
    };

    const handleMouseUp = () => {
      if (draggingItemId) { setDraggingItemId(null); }
      if (draggingSpaceId) { setDraggingSpaceId(null); }
      setIsPanning(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [isPanning, draggingItemId, draggingSpaceId, canvasState.zoom]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setCanvasState(prev => ({
      ...prev,
      zoom: Math.max(0.2, Math.min(3, prev.zoom * delta)),
    }));
  };

  // Item drag start
  const handleItemDragStart = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggingItemId(itemId);
    setSelectedItemId(itemId);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scale = canvasState.zoom;
    // Find the item
    for (const space of canvasState.spaces) {
      const item = space.items.find(i => i.id === itemId);
      if (item) {
        dragOffsetRef.current = {
          x: (e.clientX - rect.left) / scale - item.x,
          y: (e.clientY - rect.top) / scale - item.y,
        };
        return;
      }
    }
    const item = canvasState.items.find(i => i.id === itemId);
    if (item) {
      dragOffsetRef.current = {
        x: (e.clientX - rect.left) / scale - item.x,
        y: (e.clientY - rect.top) / scale - item.y,
      };
    }
  };

  // Space drag start
  const handleSpaceMoveStart = (spaceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggingSpaceId(spaceId);
    panStartRef.current = {
      x: e.clientX, y: e.clientY,
      vx: canvasState.spaces.find(s => s.id === spaceId)?.x || 0,
      vy: canvasState.spaces.find(s => s.id === spaceId)?.y || 0,
    };
    setSelectedSpaceId(spaceId);
  };

  // Add space
  const addSpace = () => {
    const id = `space-${Date.now()}`;
    const colorIdx = canvasState.spaces.length % SPACE_COLORS.length;
    setCanvasState(prev => ({
      ...prev,
      spaces: [...prev.spaces, {
        id, title: `空间 ${prev.spaces.length + 1}`,
        color: SPACE_COLORS[colorIdx],
        x: 50 + prev.spaces.length * 30,
        y: 50 + prev.spaces.length * 30,
        width: 280, height: 300,
        collapsed: false, items: [],
      }],
    }));
  };

  // Add item from picker
  const addItem = (objectId: number, spaceId?: string) => {
    const id = `item-${Date.now()}`;
    const newItem: CanvasItem = {
      id, objectId,
      x: spaceId ? 10 : 100 + Math.random() * 200,
      y: spaceId ? 10 : 100 + Math.random() * 200,
      width: 180, height: 70,
    };
    if (spaceId) {
      setCanvasState(prev => ({
        ...prev,
        spaces: prev.spaces.map(s =>
          s.id === spaceId ? { ...s, items: [...s.items, newItem] } : s
        ),
      }));
    } else {
      setCanvasState(prev => ({ ...prev, items: [...prev.items, newItem] }));
    }
  };

  // Delete space
  const deleteSpace = (spaceId: string) => {
    setCanvasState(prev => ({
      ...prev,
      spaces: prev.spaces.filter(s => s.id !== spaceId),
    }));
    if (selectedSpaceId === spaceId) setSelectedSpaceId(null);
  };

  // Delete item
  const deleteItem = (itemId: string) => {
    setCanvasState(prev => {
      let updated = prev;
      updated = { ...prev, spaces: prev.spaces.map(s => ({ ...s, items: s.items.filter(i => i.id !== itemId) })) };
      updated = { ...updated, items: updated.items.filter(i => i.id !== itemId) };
      return updated;
    });
    if (selectedItemId === itemId) setSelectedItemId(null);
  };

  const selectedSpace = canvasState.spaces.find(s => s.id === selectedSpaceId);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', gap: 12 }}>
        <div className="animate-spin" style={{ width: 24, height: 24, border: '2px solid rgba(167,139,250,0.3)', borderTopColor: '#a78bfa', borderRadius: '50%' }} />
        加载画布...
      </div>
    );
  }

  if (needsInit) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, padding: 40 }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <LayoutGrid className="w-8 h-8" style={{ color: '#a78bfa' }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e7eb', marginBottom: 6 }}>本体论尚未初始化</div>
          <div style={{ fontSize: 12, color: '#64748b', maxWidth: 320, lineHeight: 1.6 }}>
            点击下方按钮初始化表结构并导入种子数据，即可开启画布探索。
          </div>
        </div>
        <button
          onClick={async () => {
            setInitting(true);
            try {
              await duckDBService.ontologyInit();
              await duckDBService.ontologySeed();
              setNeedsInit(false);
              await checkAndInit();
            } catch (e: any) { console.error('[Canvas] Init failed:', e); }
            setInitting(false);
          }}
          disabled={initting}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 10,
            background: initting ? 'rgba(167,139,250,0.5)' : 'linear-gradient(135deg, #7c3aed, #a78bfa)',
            border: 'none', cursor: initting ? 'not-allowed' : 'pointer',
            color: '#fff', fontSize: 13, fontWeight: 600,
            boxShadow: '0 4px 16px rgba(124, 58, 237, 0.3)',
          }}
        >
          {initting ? (
            <><div className="animate-spin" style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%' }} /> 初始化中...</>
          ) : (
            <><Sparkles className="w-4 h-4" /> 一键初始化</>
          )}
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0d0d14', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #a78bfa, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <LayoutGrid className="w-4 h-4 text-white" />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>自由画布</div>
          <div style={{ fontSize: 10, color: '#64748b' }}>拖拽布局 · 空间分组 · 自由思考</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={addSpace} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', cursor: 'pointer', color: '#c4b5fd', fontSize: 11, fontWeight: 500 }}>
            <Plus className="w-3.5 h-3.5" /> 空间
          </button>
          <button onClick={() => { setPickerSpaceId(null); setShowObjectPicker(true); }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', cursor: 'pointer', color: '#86efac', fontSize: 11, fontWeight: 500 }}>
            <Plus className="w-3.5 h-3.5" /> 对象
          </button>
          <button onClick={saveCanvas} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', color: '#94a3b8', fontSize: 11, fontWeight: 500 }}>
            <Save className="w-3.5 h-3.5" /> 保存
          </button>
          <button onClick={() => setCanvasState(p => ({ ...p, zoom: 1, viewportX: 0, viewportY: 0 }))} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', color: '#94a3b8', fontSize: 11 }}>
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          {onClose && (
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ padding: '6px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setCanvasState(p => ({ ...p, zoom: Math.min(3, p.zoom * 1.2) }))} style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setCanvasState(p => ({ ...p, zoom: Math.max(0.2, p.zoom * 0.8) }))} style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
        </div>
        <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>{Math.round(canvasState.zoom * 100)}%</span>
        <div style={{ height: 12, width: 1, background: 'rgba(255,255,255,0.1)' }} />
        <span style={{ fontSize: 10, color: '#64748b' }}>
          <MousePointer2 className="w-3 h-3 inline" /> 拖拽空白处平移 · 滚轮缩放 · 双击标题编辑
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <span style={{ fontSize: 10, color: '#6b7280' }}>{canvasState.spaces.length} 空间 · {canvasState.items.length + canvasState.spaces.reduce((a, s) => a + s.items.length, 0)} 对象</span>
        </div>
      </div>

      {/* Canvas area */}
      <div
        ref={canvasRef}
        onMouseDown={handleCanvasMouseDown}
        onWheel={handleWheel}
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          background: 'radial-gradient(ellipse at 50% 50%, rgba(99,102,241,0.03) 0%, transparent 70%), #0d0d14',
          cursor: isPanning ? 'grabbing' : 'grab',
        }}
      >
        {/* Grid background */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)`,
          backgroundSize: `${20 * canvasState.zoom}px ${20 * canvasState.zoom}px`,
          backgroundPosition: `${canvasState.viewportX}px ${canvasState.viewportY}px`,
          pointerEvents: 'none',
        }} />

        {/* Transform container */}
        <div style={{
          position: 'absolute', inset: 0,
          transform: `translate(${canvasState.viewportX}px, ${canvasState.viewportY}px) scale(${canvasState.zoom})`,
          transformOrigin: '0 0',
          pointerEvents: 'none',
        }}>
          {/* Spaces */}
          {canvasState.spaces.map(space => (
            <SpaceNode
              key={space.id}
              space={space}
              isSelected={selectedSpaceId === space.id}
              onSelect={() => { setSelectedSpaceId(space.id); setSelectedItemId(null); }}
              onMoveStart={(e) => handleSpaceMoveStart(space.id, e)}
              onResize={(w, h) => setCanvasState(prev => ({ ...prev, spaces: prev.spaces.map(s => s.id === space.id ? { ...s, width: w, height: h } : s) }))}
              onToggleCollapse={() => setCanvasState(prev => ({ ...prev, spaces: prev.spaces.map(s => s.id === space.id ? { ...s, collapsed: !s.collapsed } : s) }))}
              onTitleChange={(title) => setCanvasState(prev => ({ ...prev, spaces: prev.spaces.map(s => s.id === space.id ? { ...s, title } : s) }))}
              onDelete={() => deleteSpace(space.id)}
              onItemSelect={(itemId) => { setSelectedItemId(itemId); setSelectedSpaceId(null); }}
              onItemDragStart={(itemId, e) => handleItemDragStart(itemId, e)}
              onItemDelete={(itemId) => deleteItem(itemId)}
              selectedItemId={selectedItemId}
              objects={objects}
              objectTypes={objectTypes}
              canvasZoom={canvasState.zoom}
            />
          ))}

          {/* Free items (not in any space) */}
          {canvasState.items.map(item => {
            const obj = objects.find(o => o.id === item.objectId);
            const objType = obj ? objectTypes.find(t => t.id === obj.object_type_id) : undefined;
            return (
              <ItemNode
                key={item.id}
                item={item}
                obj={obj}
                objType={objType}
                isSelected={selectedItemId === item.id}
                onSelect={() => { setSelectedItemId(item.id); setSelectedSpaceId(null); }}
                onDragStart={(e) => handleItemDragStart(item.id, e)}
                onDelete={() => deleteItem(item.id)}
              />
            );
          })}
        </div>

        {/* Selected space info panel */}
        {selectedSpace && (
          <div style={{ position: 'absolute', bottom: 16, right: 16, background: 'rgba(20,20,32,0.97)', border: `1px solid ${selectedSpace.color}30`, borderRadius: 12, padding: 12, backdropFilter: 'blur(8px)', minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: selectedSpace.color }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: selectedSpace.color }}>{selectedSpace.title}</span>
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>
              包含 {selectedSpace.items.length} 个对象
            </div>
            <button onClick={() => { setPickerSpaceId(selectedSpace.id); setShowObjectPicker(true); }} style={{ width: '100%', padding: '5px 10px', borderRadius: 8, background: `${selectedSpace.color}15`, border: `1px solid ${selectedSpace.color}30`, cursor: 'pointer', color: selectedSpace.color, fontSize: 11, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <Plus className="w-3 h-3" /> 添加对象
            </button>
          </div>
        )}
      </div>

      {showObjectPicker && (
        <ObjectPicker
          objects={objects}
          objectTypes={objectTypes}
          onSelect={(objectId) => addItem(objectId, pickerSpaceId || undefined)}
          onClose={() => setShowObjectPicker(false)}
        />
      )}
    </div>
  );
};

const OntologyCanvas: React.FC<OntologyCanvasProps> = (props) => <OntologyCanvasInner {...props} />;

export default OntologyCanvas;
