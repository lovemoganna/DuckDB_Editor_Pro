import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Plus, X, Save, Maximize, Minus, ExternalLink,
  Terminal, History, Layout, PlusCircle, Trash2,
  GripVertical, MousePointer2, Share2, Sparkles,
  Zap, Database, Layers, Settings, RefreshCcw,
  ChevronDown, ChevronRight, Edit3, Search, ArrowRight,
  ZoomIn, ZoomOut, Maximize2, Loader2, HelpCircle,
  Undo2, ChevronUp, Copy, Code, MousePointerClick,
  Circle, Square, CheckSquare, SquareStack
} from 'lucide-react';
import dagre from 'dagre';
import { duckDBService } from '../../services/duckdbService';
import { ontologyAiService, MECELayer, MeceCanvasLayoutPlan } from '../../services/ontologyAiService';
import { compileToSql, NodeType } from './CanvasTopologyManager';
import { CanvasNodeInspector } from './CanvasNodeInspector';
import { CanvasHelpPanel } from '../skills/CanvasHelpPanel';
import { CANVAS_MECE_LAYER_DESIGN } from '../skills/CanvasHelpPanel';
import { useOntologyStore } from '../../hooks/useOntologyStore';

// ==================== Types ====================

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

interface CanvasEdge {
  id: string;
  sourceId: string;
  targetId: string;
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
  edges: CanvasEdge[];
  viewportX: number;
  viewportY: number;
  zoom: number;
}

const SPACE_COLORS = [
  '#a78bfa', '#38bdf8', '#4ade80', '#fb923c',
  '#f472b6', '#a3e635', '#fbbf24', '#60a5fa',
];

/** MECE 五层对应的语义颜色 — 用于 Space/Item 的层色标注 */
export const MECE_LAYER_COLORS: Record<MECELayer, string> = {
  foundation:  '#a78bfa',
  relations:   '#38bdf8',
  methodology: '#4ade80',
  patterns:    '#fb923c',
  domains:     '#fbbf24',
};

interface OntologyCanvasProps {
  onInsert?: (sql: string) => void;
  onClose?: () => void;
}

// ==================== Item Node ====================

interface ItemNodeProps {
  item: CanvasItem;
  obj: any | undefined;
  objType: any | undefined;
  isSelected: boolean;
  isDraggingThis: boolean;
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
  item, obj, objType, isSelected, isDraggingThis, onSelect, onDragStart, onDragEnd, onDelete, onLinkStart, onLinkEnd,
  layerColor = '#94a3b8', onContextMenu
}) => {
  const meceColor = item.metadata?.layerTag ? MECE_LAYER_COLORS[item.metadata.layerTag as MECELayer] || layerColor : layerColor;
  const borderColor = meceColor;

  const NodeTypeIcon = item.nodeType === 'Source' ? Database :
                      item.nodeType === 'Transform' ? Layers :
                      item.nodeType === 'Sink' ? Zap : Settings;

  return (
    <div
      onClick={onSelect}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(e, item.id); }}
      onMouseUp={(e) => {
        if (isDraggingThis) {
          // Dragging: stop propagation so parent doesn't clear draggingItemId mid-drop
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
        width: Math.max(120, item.width), height: Math.max(48, item.height),
        background: 'rgba(13, 13, 20, 0.98)',
        border: `${isSelected ? 2 : 1}px solid ${isSelected ? '#fff' : borderColor}40`,
        borderRadius: 10,
        cursor: isDraggingThis ? 'grabbing' : 'grab',
        userSelect: 'none',
        boxShadow: isSelected
          ? `0 0 0 3px ${borderColor}50, 0 8px 32px rgba(0,0,0,0.6)`
          : `0 4px 12px rgba(0,0,0,0.3)`,
        transition: 'box-shadow 0.2s, border-color 0.2s',
        display: 'flex',
        flexDirection: 'column',
        zIndex: isDraggingThis ? 100 : isSelected ? 10 : 1,
        pointerEvents: 'auto'
      }}
      onMouseDown={(e) => { if (e.button === 0) { e.stopPropagation(); onDragStart(e); } }}
    >
      {/* Header — 层色标签 + 节点类型 */}
      <div style={{ padding: '5px 8px', display: 'flex', alignItems: 'center', gap: 4, borderBottom: '1px solid rgba(255,255,255,0.05)', minHeight: 28 }}>
        <div onMouseDown={onDragStart} style={{ cursor: 'grab', display: 'flex', alignItems: 'center' }}>
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
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', opacity: 0.4, padding: 0 }}>
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: '6px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3 }}>
          {obj?.name || '未命名对象'}
        </div>
        <div style={{ fontSize: 10, color: '#64748b', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {objType?.name || '节点'}
        </div>
        {item.metadata?.sqlFragment && (
          <div style={{ fontSize: 9, color: '#475569', marginTop: 4, fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.6 }}>
            {item.metadata.sqlFragment.slice(0, 40)}
          </div>
        )}
      </div>

      {/* Connection Handle (Right) */}
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
  onLinkStart: (itemId: string, e: React.MouseEvent) => void;
  onLinkEnd: (itemId: string) => void;
  selectedItemId: string | null;
  objects: any[];
  objectTypes: any[];
  canvasZoom: number;
}

const SpaceNode: React.FC<SpaceNodeProps> = ({
  space, isSelected, onSelect, onMoveStart, onResize, onToggleCollapse,
  onTitleChange, onDelete, onItemSelect, onItemDragStart, onItemDelete,
  onLinkStart, onLinkEnd,
  selectedItemId, objects, objectTypes, canvasZoom
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
        <button onClick={(e) => { e.stopPropagation(); onToggleCollapse(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          {space.collapsed ? <ChevronRight className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
        </button>
        {editingTitle ? (
          <input ref={titleRef} value={titleValue} onChange={e => setTitleValue(e.target.value)} onBlur={handleTitleBlur} 
            onKeyDown={e => { if (e.key === 'Enter') handleTitleBlur(); }}
            style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', fontSize: 12, outline: 'none' }} 
          />
        ) : (
          <span onDoubleClick={() => setEditingTitle(true)} style={{ flex: 1, fontSize: 12, fontWeight: 700, color: space.color }}>{space.title}</span>
        )}
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', opacity: 0.5 }}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {!space.collapsed && (
        <div style={{ flex: 1, position: 'relative', overflow: 'auto', padding: 12 }}>
          {space.items.map(item => (
            <ItemNode
              key={item.id} item={item}
              obj={objects.find(o => o.id === item.objectId)}
              objType={objectTypes.find(t => t.id === objects.find(o => o.id === item.objectId)?.object_type_id)}
              isSelected={selectedItemId === item.id}
              isDraggingThis={false}
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

// ==================== Object Picker ====================

interface ObjectPickerProps {
  objects: any[];
  objectTypes: any[];
  onSelect: (objectId: number) => void;
  onClose: () => void;
}

const ObjectPicker: React.FC<ObjectPickerProps> = ({ objects, objectTypes, onSelect, onClose }) => {
  const [search, setSearch] = useState('');
  const filtered = objects.filter(o => o.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ width: 400, background: '#1a1a24', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600 }}>添加对象到画布</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X className="w-4 h-4" /></button>
        </div>
        <div style={{ padding: 12 }}>
           <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索对象名称..." style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', outline: 'none' }} />
        </div>
        <div style={{ maxHeight: 300, overflow: 'auto', padding: '0 12px 12px' }}>
          {filtered.map(obj => (
            <button key={obj.id} onClick={() => { onSelect(obj.id); onClose(); }} style={{ width: '100%', padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 6, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{obj.name}</span>
              <Plus className="w-3.5 h-3.5 text-indigo-400" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ==================== Main Canvas Component ====================

const OntologyCanvasInner: React.FC<OntologyCanvasProps & { objects: any[]; objectTypes: any[] }> = ({
  objects, objectTypes, onClose, onInsert
}) => {
  const [loading, setLoading] = useState(true);
  const [canvasState, setCanvasState] = useState<CanvasState>({
    spaces: [],
    items: [],
    edges: [],
    viewportX: 0,
    viewportY: 0,
    zoom: 1
  });

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [draggingSpaceId, setDraggingSpaceId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showObjectPicker, setShowObjectPicker] = useState(false);
  const [pickerSpaceId, setPickerSpaceId] = useState<string | null>(null);
  const [showSqlPreview, setShowSqlPreview] = useState(false);
  const [isAIFilling, setIsAIFilling] = useState(false);
  const [showRefinePanel, setShowRefinePanel] = useState(false);
  const [refineInput, setRefineInput] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [refineResult, setRefineResult] = useState<{ summary: string; steps: any[] } | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [activeLayer, setActiveLayer] = useState<MECELayer>('foundation');
  const [showClearMenu, setShowClearMenu] = useState(false);

  // Undo/redo
  const [undoStack, setUndoStack] = useState<CanvasState[]>([]);
  const [redoStack, setRedoStack] = useState<CanvasState[]>([]);

  // Multi-select
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isBoxSelecting, setIsBoxSelecting] = useState(false);
  const [boxSelectStart, setBoxSelectStart] = useState({ x: 0, y: 0 });
  const [boxSelectEnd, setBoxSelectEnd] = useState({ x: 0, y: 0 });
  const [snapEnabled, setSnapEnabled] = useState(true);

  // Right-click context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; itemId: string } | null>(null);

  const [linkingSourceId, setLinkingSourceId] = useState<string | null>(null);
  const [linkTargetPos, setLinkTargetPos] = useState({ x: 0, y: 0 });
  
  const canvasRef = useRef<HTMLDivElement>(null);

  // ── Grid Snap ──
  const GRID_SIZE = 8;
  const snapToGrid = (v: number) => snapEnabled ? Math.round(v / GRID_SIZE) * GRID_SIZE : v;

  // ── Alignment ──
  type AlignDir = 'left' | 'right' | 'top' | 'bottom' | 'centerX' | 'centerY';
  const alignSelected = (direction: AlignDir) => {
    const allItems = [...canvasState.items, ...canvasState.spaces.flatMap(s => s.items)];
    const targets = allItems.filter(i => selectedItemIds.has(i.id));
    if (targets.length < 2) return;
    const bounds = targets.reduce(
      (acc, i) => ({
        minX: Math.min(acc.minX, i.x),
        maxX: Math.max(acc.maxX, i.x + i.width),
        minY: Math.min(acc.minY, i.y),
        maxY: Math.max(acc.maxY, i.y + i.height),
      }),
      { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
    );
    const alignItem = (item: CanvasItem): Partial<CanvasItem> => {
      switch (direction) {
        case 'left':   return { x: bounds.minX };
        case 'right':  return { x: bounds.maxX - item.width };
        case 'top':    return { y: bounds.minY };
        case 'bottom': return { y: bounds.maxY - item.height };
        case 'centerX': return { x: (bounds.minX + bounds.maxX) / 2 - item.width / 2 };
        case 'centerY': return { y: (bounds.minY + bounds.maxY) / 2 - item.height / 2 };
      }
    };
    setCanvasState(prev => ({
      ...prev,
      items: prev.items.map(i => selectedItemIds.has(i.id) ? { ...i, ...alignItem(i) } : i),
      spaces: prev.spaces.map(s => ({ ...s, items: s.items.map(i => selectedItemIds.has(i.id) ? { ...i, ...alignItem(i) } : i) })),
    }));
  };

  // ── Undo/Redo ──
  const pushUndo = useCallback((state: CanvasState) => {
    setUndoStack(prev => [...prev.slice(-49), state]);
    setRedoStack([]);
  }, []);

  // ── SQL Compilation (topology-to-SQL engine) ──
  const compileResult = useMemo(() => {
    const allItems = [...canvasState.items, ...canvasState.spaces.flatMap(s => s.items)];
    return compileToSql(allItems as any, canvasState.edges);
  }, [canvasState.items, canvasState.spaces, canvasState.edges]);

  const compiledSql = compileResult.sql;

  // ── Effects ──
  const checkAndInit = useCallback(async () => {
    try {
      await duckDBService.query('CREATE TABLE IF NOT EXISTS life_canvas_state (id VARCHAR PRIMARY KEY, space_id VARCHAR, object_id INTEGER, title VARCHAR, color VARCHAR, x DECIMAL, y DECIMAL, width DECIMAL, height DECIMAL, node_type VARCHAR, metadata JSON)');
      await duckDBService.query('CREATE TABLE IF NOT EXISTS life_canvas_edge (id VARCHAR PRIMARY KEY, source_id VARCHAR, target_id VARCHAR)');
      
      const rows = await duckDBService.query('SELECT * FROM life_canvas_state');
      const edgeRows = await duckDBService.query('SELECT * FROM life_canvas_edge');
      
      // Reconstruction of state from DB logic (Simplified for execution speed)
      const spacesMap = new Map<string, CanvasSpace>();
      const freeItems: CanvasItem[] = [];
      (rows as any[]).forEach(row => {
        if (row.space_id && row.id === row.space_id) {
          spacesMap.set(row.id, { id: row.id, title: row.title, color: row.color, x: Number(row.x), y: Number(row.y), width: Number(row.width), height: Number(row.height), collapsed: false, items: [] });
        } else if (row.space_id) {
          if (!spacesMap.has(row.space_id)) spacesMap.set(row.space_id, { id: row.space_id, title: '空间', color: '#fff', x: 0, y: 0, width: 300, height: 300, collapsed: false, items: [] });
          spacesMap.get(row.space_id)!.items.push({ id: row.id, objectId: row.object_id, x: Number(row.x), y: Number(row.y), width: Number(row.width), height: Number(row.height), nodeType: row.node_type, metadata: row.metadata ? JSON.parse(row.metadata) : {} });
        } else {
          freeItems.push({ id: row.id, objectId: row.object_id, x: Number(row.x), y: Number(row.y), width: Number(row.width), height: Number(row.height), nodeType: row.node_type, metadata: row.metadata ? JSON.parse(row.metadata) : {} });
        }
      });

      setCanvasState(prev => ({ 
        ...prev, 
        spaces: Array.from(spacesMap.values()),
        items: freeItems,
        edges: edgeRows.map((e: any) => ({ id: e.id, sourceId: e.source_id, targetId: e.target_id })) 
      }));
    } catch (e) { console.error('Canvas init failed', e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { checkAndInit(); }, [checkAndInit]);

  const saveCanvas = useCallback(async () => {
    if (loading) return;
    try {
      await duckDBService.query('DELETE FROM life_canvas_state');
      await duckDBService.query('DELETE FROM life_canvas_edge');
      for (const space of canvasState.spaces) {
        await duckDBService.query(
          `INSERT INTO life_canvas_state VALUES (${duckDBService.escapeLiteral(space.id)}, ${duckDBService.escapeLiteral(space.id)}, NULL, ${duckDBService.escapeLiteral(space.title)}, ${duckDBService.escapeLiteral(space.color)}, ${space.x}, ${space.y}, ${space.width}, ${space.height}, NULL, NULL)`
        );
        for (const i of space.items) {
          const meta = i.metadata ? JSON.stringify(i.metadata).replace(/'/g, "''") : '{}';
          await duckDBService.query(
            `INSERT INTO life_canvas_state VALUES (${duckDBService.escapeLiteral(i.id)}, ${duckDBService.escapeLiteral(space.id)}, ${i.objectId}, NULL, NULL, ${i.x}, ${i.y}, ${i.width}, ${i.height}, ${duckDBService.escapeLiteral(i.nodeType || 'Source')}, ${duckDBService.escapeLiteral(meta)})`
          );
        }
      }
      for (const i of canvasState.items) {
        const meta = i.metadata ? JSON.stringify(i.metadata).replace(/'/g, "''") : '{}';
        await duckDBService.query(
          `INSERT INTO life_canvas_state VALUES (${duckDBService.escapeLiteral(i.id)}, NULL, ${i.objectId}, NULL, NULL, ${i.x}, ${i.y}, ${i.width}, ${i.height}, ${duckDBService.escapeLiteral(i.nodeType || 'Source')}, ${duckDBService.escapeLiteral(meta)})`
        );
      }
      for (const edge of canvasState.edges) {
        await duckDBService.query(
          `INSERT INTO life_canvas_edge VALUES (${duckDBService.escapeLiteral(edge.id)}, ${duckDBService.escapeLiteral(edge.sourceId)}, ${duckDBService.escapeLiteral(edge.targetId)})`
        );
      }
    } catch (e) { console.error('Save failed', e); }
  }, [canvasState, loading]);

  useEffect(() => { const t = setTimeout(saveCanvas, 2000); return () => clearTimeout(t); }, [canvasState, saveCanvas]);

  // ── Handlers ──

  const updateItemPos = (id: string, x: number, y: number) => {
    const snappedX = snapToGrid(x);
    const snappedY = snapToGrid(y);
    setCanvasState(prev => {
      const inItems = prev.items.find(i => i.id === id);
      if (inItems) return { ...prev, items: prev.items.map(i => i.id === id ? { ...i, x: snappedX, y: snappedY } : i) };
      return { ...prev, spaces: prev.spaces.map(s => ({ ...s, items: s.items.map(i => i.id === id ? { ...i, x: snappedX, y: snappedY } : i) })) };
    });
  };

  const handleLinkStart = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLinkingSourceId(id);
    const rect = canvasRef.current!.getBoundingClientRect();
    setLinkTargetPos({ x: (e.clientX - rect.left - canvasState.viewportX) / canvasState.zoom, y: (e.clientY - rect.top - canvasState.viewportY) / canvasState.zoom });
  };

  const handleLinkEnd = (targetId: string) => {
    if (linkingSourceId && linkingSourceId !== targetId) {
      if (!canvasState.edges.some(e => e.sourceId === linkingSourceId && e.targetId === targetId)) {
        setCanvasState(prev => ({ ...prev, edges: [...prev.edges, { id: `edge-${Date.now()}`, sourceId: linkingSourceId, targetId }] }));
      }
    }
    setLinkingSourceId(null);
  };

  const handleAutoLayout = () => {
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'LR', nodesep: 70, ranksep: 100 });
    g.setDefaultEdgeLabel(() => ({}));
    const all = [...canvasState.items, ...canvasState.spaces.flatMap(s => s.items)];
    all.forEach(i => g.setNode(i.id, { width: i.width, height: i.height }));
    canvasState.edges.forEach(e => g.setEdge(e.sourceId, e.targetId));
    dagre.layout(g);
    setCanvasState(prev => ({
      ...prev,
      items: prev.items.map(i => { const n = g.node(i.id); return n ? { ...i, x: n.x - n.width/2, y: n.y - n.height/2 } : i; }),
      spaces: prev.spaces.map(s => ({ ...s, items: s.items.map(i => { const n = g.node(i.id); return n ? { ...i, x: n.x - n.width/2, y: n.y - n.height/2 } : i; }) }))
    }));
  };

  const handleAiFill = async () => {
    if (objects.length === 0) {
      alert('请先在左侧面板添加至少一个对象后再使用 AI 填充');
      return;
    }
    setIsAIFilling(true);
    try {
      const scene = objects.map(o => o.name).join(' / ');
      const plan = await ontologyAiService.generateCanvasLayout(scene);

      const spaceColors = [
        '#a78bfa', '#38bdf8', '#4ade80', '#fb923c',
        '#f472b6', '#a3e635', '#fbbf24', '#60a5fa',
      ];

      // Build spaces from AI plan
      const builtSpaces: CanvasSpace[] = (plan.spaces || []).map((sp, si) => ({
        id: sp.id || `ai-space-${si}`,
        title: sp.name || `Space ${si + 1}`,
        color: sp.color || spaceColors[si % spaceColors.length],
        x: sp.x ?? 50 + si * 320,
        y: sp.y ?? 50,
        width: sp.w ?? 400,
        height: sp.h ?? 320,
        collapsed: false,
        items: [],
      }));

      // Build items from AI groups
      const builtItems: CanvasItem[] = [];
      const builtEdges: CanvasEdge[] = [];
      let itemCounter = 0;

      (plan.groups || []).forEach(group => {
        const space = builtSpaces.find(s => s.id === group.spaceId) || builtSpaces[0];
        (group.items || []).forEach((itemName, ii) => {
          const obj = objects.find(o => o.name === itemName) || objects[itemCounter % objects.length];
          const itemId = `ai-node-${itemCounter}`;
          const nodeType = ii === 0 ? 'Source' : ii === (group.items?.length ?? 0) - 1 ? 'Sink' : 'Transform';

          builtItems.push({
            id: itemId,
            objectId: obj.id,
            x: (space.x || 50) + (group.x ?? 10) + ii * 200,
            y: (space.y || 50) + (group.y ?? 10),
            width: 180,
            height: 75,
            nodeType,
            metadata: {
              tableName: itemName,
              sqlFragment: nodeType === 'Source'
                ? `SELECT * FROM "${itemName}"`
                : nodeType === 'Transform'
                ? `SELECT * FROM previous_cte -- ${itemName} 变换`
                : `-- 最终输出: ${itemName}`,
            },
          });
          itemCounter++;
        });
      });

      // Build edges from AI plan (connect items within same group or across groups)
      if (plan.edges && plan.edges.length > 0) {
        plan.edges.forEach((edge, ei) => {
          const srcItem = builtItems.find(it => it.metadata?.tableName === edge.source);
          const tgtItem = builtItems.find(it => it.metadata?.tableName === edge.target);
          if (srcItem && tgtItem) {
            builtEdges.push({ id: `ai-edge-${ei}`, sourceId: srcItem.id, targetId: tgtItem.id });
          }
        });
      } else {
        // Default linear edges if no explicit edges from AI
        for (let i = 0; i < builtItems.length - 1; i++) {
          builtEdges.push({ id: `ai-edge-${i}`, sourceId: builtItems[i].id, targetId: builtItems[i + 1].id });
        }
      }

      pushUndo(canvasState);
      setCanvasState(prev => ({
        ...prev,
        spaces: builtSpaces,
        items: builtItems,
        edges: builtEdges,
      }));
    } catch (err) {
      console.error('[OntologyCanvas] AI fill failed:', err);
      alert('AI 填充失败，请检查 AI 配置或网络连接');
    } finally {
      setIsAIFilling(false);
    }
  };

  const handleRefine = async () => {
    if (!refineInput.trim()) return;
    setIsRefining(true);
    try {
      const result = await ontologyAiService.generateMethodologyAdvice(
        `${compiledSql}\n\n用户需求：${refineInput}`
      );
      setRefineResult({ summary: result.recommendedMethod, steps: result.steps || [] });
    } catch (err) {
      console.error('[OntologyCanvas] refine failed:', err);
      setRefineResult({ summary: 'AI 优化建议生成失败', steps: [] });
    } finally {
      setIsRefining(false);
    }
  };

  // ── MECE Layer AI 填充 ──
  const handleMeceFill = async () => {
    if (objects.length === 0) {
      alert('请先在左侧面板添加至少一个对象后再使用 AI 填充');
      return;
    }
    setIsAIFilling(true);
    try {
      const meceHint = CANVAS_MECE_LAYER_DESIGN[activeLayer].description;
      const plan: MeceCanvasLayoutPlan = await ontologyAiService.generateMeceCanvasLayout(
        activeLayer,
        objects.map(o => o.name),
        objectTypes.map(t => t.name),
        meceHint,
      );

      // Build spaces from AI plan
      const builtSpaces: CanvasSpace[] = (plan.spaces || []).map((sp, si) => ({
        id: sp.id || `mece-space-${si}`,
        title: sp.name || `Space ${si + 1}`,
        color: sp.color ? `#${sp.color === 'purple' ? 'a78bfa' : sp.color === 'blue' ? '38bdf8' : sp.color === 'green' ? '4ade80' : sp.color === 'orange' ? 'fb923c' : sp.color === 'yellow' ? 'fbbf24' : sp.color === 'cyan' ? '60a5fa' : sp.color === 'red' ? 'f472b6' : 'a78bfa'}` : MECE_LAYER_COLORS[activeLayer],
        x: sp.x ?? 50 + si * 380,
        y: sp.y ?? 50,
        width: sp.w ?? 420,
        height: sp.h ?? 340,
        collapsed: false,
        items: [],
      }));

      // Build items from AI plan
      const builtItems: CanvasItem[] = [];
      const builtEdges: CanvasEdge[] = [];
      let itemCounter = 0;

      (plan.items || []).forEach((aiItem) => {
        const space = builtSpaces.find(s => s.id === aiItem.spaceId) || builtSpaces[0];
        const obj = objects.find(o => o.name === aiItem.objectName) || objects[itemCounter % objects.length];

        builtItems.push({
          id: aiItem.id || `mece-node-${itemCounter}`,
          objectId: obj.id,
          x: (space.x || 50) + (aiItem.x ?? 10) + itemCounter * 200,
          y: (space.y || 50) + (aiItem.y ?? 10),
          width: aiItem.width ?? 180,
          height: aiItem.height ?? 75,
          nodeType: aiItem.nodeType || 'Source',
          metadata: {
            tableName: aiItem.metadata?.tableName || aiItem.objectName,
            sqlFragment: aiItem.metadata?.sqlFragment || `-- ${aiItem.objectName}（${activeLayer}层）`,
            layerTag: aiItem.metadata?.layerTag || activeLayer,
          },
        });
        itemCounter++;
      });

      // Build edges
      (plan.edges || []).forEach((edge, ei) => {
        builtEdges.push({ id: `mece-edge-${ei}`, sourceId: edge.sourceId, targetId: edge.targetId });
      });

      // If no edges, create default linear edges
      if (builtEdges.length === 0 && builtItems.length > 1) {
        for (let i = 0; i < builtItems.length - 1; i++) {
          builtEdges.push({ id: `mece-edge-${i}`, sourceId: builtItems[i].id, targetId: builtItems[i + 1].id });
        }
      }

      pushUndo(canvasState);
      setCanvasState(prev => ({
        ...prev,
        spaces: builtSpaces,
        items: builtItems,
        edges: builtEdges,
      }));
    } catch (err) {
      console.error('[OntologyCanvas] MECE AI fill failed:', err);
      alert('AI 填充失败，请检查 AI 配置或网络连接');
    } finally {
      setIsAIFilling(false);
    }
  };

  // ── 分级清除 ──
  const handleClear = (level: 'selected' | 'space' | 'all') => {
    setShowClearMenu(false);
    if (level === 'selected') {
      if (selectedItemId) {
        pushUndo(canvasState);
        deleteItem(selectedItemId);
      }
    } else if (level === 'space') {
      if (selectedSpaceId) {
        pushUndo(canvasState);
        deleteSpace(selectedSpaceId);
      }
    } else {
      // L3: 清除全部（画布 + AI 状态 + 面板状态）
      pushUndo(canvasState);
      setCanvasState(p => ({ ...p, items: [], spaces: [], edges: [] }));
      setSelectedItemId(null);
      setSelectedSpaceId(null);
      setSelectedItemIds(new Set());
      setIsAIFilling(false);
      setShowSqlPreview(false);
      setShowRefinePanel(false);
      setUndoStack([]);
      setRedoStack([]);
    }
  };

  const updateNode = (id: string, updates: any) => {
    setCanvasState(prev => ({
      ...prev,
      items: prev.items.map(i => i.id === id ? { ...i, ...updates } : i),
      spaces: prev.spaces.map(s => ({ ...s, items: s.items.map(i => i.id === id ? { ...i, ...updates } : i) }))
    }));
  };

  const deleteItem = (id: string) => {
    setCanvasState(prev => ({
      ...prev,
      items: prev.items.filter(i => i.id !== id),
      spaces: prev.spaces.map(s => ({ ...s, items: s.items.filter(i => i.id !== id) })),
      edges: prev.edges.filter(e => e.sourceId !== id && e.targetId !== id)
    }));
    if (selectedItemId === id) setSelectedItemId(null);
  };

  const addItem = (objectId: number, spaceId?: string) => {
    const id = `item-${Date.now()}`;
    const newItem: CanvasItem = {
      id, objectId,
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
      width: 180, height: 75,
      nodeType: 'Source',
      metadata: {}
    };
    if (spaceId) {
      setCanvasState(prev => ({
        ...prev,
        spaces: prev.spaces.map(s => s.id === spaceId ? { ...s, items: [...s.items, newItem] } : s)
      }));
    } else {
      setCanvasState(prev => ({ ...prev, items: [...prev.items, newItem] }));
    }
  };

  const deleteSpace = (id: string) => {
    setCanvasState(prev => ({
      ...prev,
      spaces: prev.spaces.filter(s => s.id !== id),
      edges: prev.edges.filter(e => {
        const space = prev.spaces.find(s => s.id === id);
        if (!space) return true;
        const itemIds = space.items.map(i => i.id);
        return !itemIds.includes(e.sourceId) && !itemIds.includes(e.targetId);
      })
    }));
    if (selectedSpaceId === id) setSelectedSpaceId(null);
  };

  const allNodesMap = useMemo(() => {
    const m = new Map<string, CanvasItem>();
    canvasState.items.forEach(i => m.set(i.id, i));
    canvasState.spaces.forEach(s => s.items.forEach(i => m.set(i.id, i)));
    return m;
  }, [canvasState.items, canvasState.spaces]);

  const selectedItem = selectedItemId ? allNodesMap.get(selectedItemId) : null;

  // ── Keyboard Shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+Shift+O → AI fill
      if (e.key === 'O' && e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        if (!isAIFilling) handleAiFill();
        return;
      }
      // Ctrl+Z → Undo
      if (e.key === 'z' && e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        if (undoStack.length === 0) return;
        const prev = undoStack[undoStack.length - 1];
        setRedoStack(r => [...r, canvasState]);
        setUndoStack(u => u.slice(0, -1));
        setCanvasState(prev);
        return;
      }
      // Ctrl+Shift+Z / Ctrl+Y → Redo
      if ((e.key === 'Z' && e.ctrlKey && e.shiftKey) || (e.key === 'Y' && e.ctrlKey)) {
        e.preventDefault();
        if (redoStack.length === 0) return;
        const next = redoStack[redoStack.length - 1];
        setUndoStack(u => [...u, canvasState]);
        setRedoStack(r => r.slice(0, -1));
        setCanvasState(next);
        return;
      }
      // Ctrl+0 → Reset zoom
      if (e.key === '0' && e.ctrlKey) {
        e.preventDefault();
        setCanvasState(p => ({ ...p, zoom: 1 }));
        return;
      }
      // Ctrl+= → Zoom in
      if ((e.key === '=' || e.key === '+') && e.ctrlKey) {
        e.preventDefault();
        setCanvasState(p => ({ ...p, zoom: Math.min(3.0, p.zoom + 0.1) }));
        return;
      }
      // Ctrl+- → Zoom out
      if (e.key === '-' && e.ctrlKey) {
        e.preventDefault();
        setCanvasState(p => ({ ...p, zoom: Math.max(0.1, p.zoom - 0.1) }));
        return;
      }
      // Escape → close menus / L3 clear
      if (e.key === 'Escape') {
        if (contextMenu) { setContextMenu(null); return; }
        if (showClearMenu) { setShowClearMenu(false); return; }
        if (showHelp) { setShowHelp(false); return; }
        // L3 clear only when no menus open
        pushUndo(canvasState);
        setCanvasState(p => ({ ...p, items: [], spaces: [], edges: [] }));
        setSelectedItemId(null);
        setSelectedSpaceId(null);
        setSelectedItemIds(new Set());
        setIsAIFilling(false);
        setShowSqlPreview(false);
        setShowRefinePanel(false);
      }
      // Delete / Backspace → delete selected
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedItemId) {
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
        e.preventDefault();
        pushUndo(canvasState);
        deleteItem(selectedItemId);
      }
      // Ctrl+A → select all
      if (e.key === 'a' && e.ctrlKey) {
        e.preventDefault();
        const allIds = [...canvasState.items.map(i => i.id), ...canvasState.spaces.flatMap(s => s.items.map(i => i.id))];
        setSelectedItemIds(new Set(allIds));
      }
      // Ctrl+Shift+R → Quick clear all canvas
      if (e.key === 'R' && e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        if (confirm('确认清空画布？此操作不可撤销。')) {
          handleClear('all');
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isAIFilling, showClearMenu, showHelp, undoStack, redoStack, canvasState, selectedItemId, contextMenu, handleClear]);

  return (
    <div className="h-full w-full flex bg-[#0d0d14] relative overflow-hidden text-slate-200">
      {/* ── Toolbar Row 1: Actions + MECE Layers + Tools ── */}
      <div style={{
        position: 'absolute', top: 16, left: 16, right: 16, zIndex: 100,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {/* Row 1: Main toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '5px 14px',
          background: 'rgba(23,23,35,0.95)', backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 14,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>

          {/* ── Left: Add Actions ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <button onClick={() => { setPickerSpaceId(null); setShowObjectPicker(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: '#818cf8', cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseOver={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.15)')}
              onMouseOut={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.08)')}
            ><PlusCircle className="w-3.5 h-3.5" /> 节点</button>

            <button onClick={() => setCanvasState(p => ({ ...p, spaces: [...p.spaces, { id: `sp-${Date.now()}`, title: '新空间', color: SPACE_COLORS[p.spaces.length % 8], x: 50, y: 50, width: 300, height: 300, collapsed: false, items: [] }] }))}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', color: '#7dd3fc', cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseOver={e => (e.currentTarget.style.background = 'rgba(56,189,248,0.15)')}
              onMouseOut={e => (e.currentTarget.style.background = 'rgba(56,189,248,0.08)')}
            ><Layout className="w-3.5 h-3.5" /> 空间</button>

            <button onClick={handleAutoLayout}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: '#86efac', cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseOver={e => (e.currentTarget.style.background = 'rgba(74,222,128,0.15)')}
              onMouseOut={e => (e.currentTarget.style.background = 'rgba(74,222,128,0.08)')}
            ><RefreshCcw className="w-3.5 h-3.5" /> 智能布局</button>
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.08)', margin: '0 4px' }} />

          {/* ── Center: MECE Layer Tabs ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1, justifyContent: 'center' }}>
            {(Object.keys(MECE_LAYER_COLORS) as MECELayer[]).map(layer => {
              const isActive = activeLayer === layer;
              const color = MECE_LAYER_COLORS[layer];
              const label = { foundation: '基础', relations: '关系', methodology: '方法论', patterns: '模式', domains: '领域' }[layer];
              return (
                <button key={layer} onClick={() => setActiveLayer(layer)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                    borderRadius: 8, fontSize: 11, fontWeight: 600,
                    background: isActive ? `${color}20` : 'transparent',
                    border: `1px solid ${isActive ? color + '60' : 'transparent'}`,
                    color: isActive ? color : '#475569',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                  onMouseOver={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = `${color}10`; (e.currentTarget as HTMLButtonElement).style.color = color; }}}
                  onMouseOut={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#475569'; }}}
                >
                  {isActive && <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />}
                  {label}
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.08)', margin: '0 4px' }} />

          {/* ── AI Fill ── */}
          <button onClick={handleMeceFill} disabled={isAIFilling}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: isAIFilling ? 'not-allowed' : 'pointer', background: `${MECE_LAYER_COLORS[activeLayer]}15`, border: `1px solid ${MECE_LAYER_COLORS[activeLayer]}40`, color: MECE_LAYER_COLORS[activeLayer], transition: 'all 0.15s' }}
          >
            {isAIFilling ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> AI 构思中...</> : <><Sparkles className="w-3.5 h-3.5" /> AI 填充</>}
          </button>

          {/* ── Right: Guide + SQL + Clear ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginLeft: 4 }}>
            <button onClick={() => setShowHelp(!showHelp)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: showHelp ? 'rgba(99,102,241,0.15)' : 'transparent', border: `1px solid ${showHelp ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)'}`, color: showHelp ? '#818cf8' : '#64748b', cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseOver={e => { if (!showHelp) (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; }}
              onMouseOut={e => { if (!showHelp) (e.currentTarget as HTMLButtonElement).style.color = '#64748b'; }}
            ><HelpCircle className="w-3.5 h-3.5" /> 指南</button>

            <button onClick={() => setShowSqlPreview(!showSqlPreview)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: showSqlPreview ? 'rgba(99,102,241,0.15)' : 'transparent', border: `1px solid ${showSqlPreview ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)'}`, color: showSqlPreview ? '#818cf8' : '#64748b', cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseOver={e => { if (!showSqlPreview) (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; }}
              onMouseOut={e => { if (!showSqlPreview) (e.currentTarget as HTMLButtonElement).style.color = '#64748b'; }}
            ><Terminal className="w-3.5 h-3.5" /> SQL</button>

            {/* Clear dropdown */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowClearMenu(!showClearMenu)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseOver={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.15)')}
                onMouseOut={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
              ><Trash2 className="w-3.5 h-3.5" /> 清除 <ChevronDown className="w-3 h-3" /></button>
              {showClearMenu && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 6, minWidth: 148,
                  background: 'rgba(23,23,35,0.98)', backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
                  padding: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 300,
                }}>
                  <button onClick={() => handleClear('selected')} style={{ width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: 6, fontSize: 11, color: '#94a3b8', cursor: 'pointer', background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 8 }}
                    onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                    onMouseOut={e => (e.currentTarget.style.background = 'none')}
                  ><MousePointerClick className="w-3.5 h-3.5 text-slate-500" /> L1 清除选中</button>
                  <button onClick={() => handleClear('space')} style={{ width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: 6, fontSize: 11, color: '#94a3b8', cursor: 'pointer', background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 8 }}
                    onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                    onMouseOut={e => (e.currentTarget.style.background = 'none')}
                  ><Square className="w-3.5 h-3.5 text-slate-500" /> L2 清除空间</button>
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '3px 0' }} />
                  <button onClick={() => handleClear('all')} style={{ width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: 6, fontSize: 11, color: '#ef4444', cursor: 'pointer', background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}
                    onMouseOver={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
                    onMouseOut={e => (e.currentTarget.style.background = 'none')}
                  ><Trash2 className="w-3.5 h-3.5" /> L3 清除全部</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Toolbar Row 2: Utility (Zoom + Undo/Redo) ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
          padding: '4px 14px',
          background: 'rgba(15,15,24,0.9)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 10,
        }}>
          {/* Undo/Redo + Alignment + Snap */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <button onClick={() => { if (undoStack.length === 0) return; const prev = undoStack[undoStack.length - 1]; setRedoStack(r => [...r, canvasState]); setUndoStack(u => u.slice(0, -1)); setCanvasState(prev); }}
              disabled={undoStack.length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: 'none', border: '1px solid rgba(255,255,255,0.08)', color: undoStack.length === 0 ? '#374151' : '#64748b', cursor: undoStack.length === 0 ? 'not-allowed' : 'pointer', transition: 'all 0.15s' }}
              title="撤销 (Ctrl+Z)"
            ><Undo2 className="w-3.5 h-3.5" /> 撤销</button>
            <button onClick={() => { if (redoStack.length === 0) return; const next = redoStack[redoStack.length - 1]; setUndoStack(u => [...u, canvasState]); setRedoStack(r => r.slice(0, -1)); setCanvasState(next); }}
              disabled={redoStack.length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: 'none', border: '1px solid rgba(255,255,255,0.08)', color: redoStack.length === 0 ? '#374151' : '#64748b', cursor: redoStack.length === 0 ? 'not-allowed' : 'pointer', transition: 'all 0.15s' }}
              title="重做 (Ctrl+Shift+Z)"
            ><Undo2 className="w-3.5 h-3.5" style={{ transform: 'scaleX(-1)' }} /> 重做</button>
          </div>

          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.06)' }} />

          {/* Alignment Tools — shown when multiple items selected */}
          {selectedItemIds.size > 1 ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ fontSize: 9, color: '#64748b', marginRight: 2 }}>对齐</span>
                {([
                  { dir: 'left' as AlignDir, label: '左', icon: '◧' },
                  { dir: 'centerX' as AlignDir, label: '中', icon: '⊕' },
                  { dir: 'right' as AlignDir, label: '右', icon: '◨' },
                  { dir: 'top' as AlignDir, label: '顶', icon: '◩' },
                  { dir: 'centerY' as AlignDir, label: '垂', icon: '⊙' },
                  { dir: 'bottom' as AlignDir, label: '底', icon: '○' },
                ] as const).map(({ dir, label }) => (
                  <button key={dir} onClick={() => alignSelected(dir)}
                    style={{ width: 22, height: 22, borderRadius: 4, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'none', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', cursor: 'pointer', transition: 'all 0.1s' }}
                    title={`对齐${label}`}
                    onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.15)'; (e.currentTarget as HTMLButtonElement).style.color = '#818cf8'; }}
                    onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; }}
                  >{label}</button>
                ))}
              </div>
              <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.06)' }} />
            </>
          ) : (
            <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.06)' }} />
          )}

          {/* Snap-to-Grid Toggle */}
          <button onClick={() => setSnapEnabled(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: snapEnabled ? 'rgba(99,102,241,0.1)' : 'none', border: `1px solid ${snapEnabled ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.08)'}`, color: snapEnabled ? '#818cf8' : '#64748b', cursor: 'pointer', transition: 'all 0.15s' }}
            title={snapEnabled ? '网格吸附：开' : '网格吸附：关'}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <line x1="0" y1="4" x2="12" y2="4" stroke="currentColor" strokeWidth="1" />
              <line x1="0" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="1" />
              <line x1="4" y1="0" x2="4" y2="12" stroke="currentColor" strokeWidth="1" />
              <line x1="8" y1="0" x2="8" y2="12" stroke="currentColor" strokeWidth="1" />
            </svg>
            {snapEnabled ? '吸附' : '自由'}
          </button>

          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.06)' }} />

          {/* Zoom */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button onClick={() => setCanvasState(p => ({ ...p, zoom: Math.max(0.1, p.zoom - 0.1) }))}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 6, background: 'none', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b', cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; }}
              onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = '#64748b'; }}
              title="缩小 (Ctrl+-)"
            ><Minus className="w-3 h-3" /></button>
            <button onClick={() => setCanvasState(p => ({ ...p, zoom: 1 }))}
              style={{ minWidth: 48, height: 24, borderRadius: 6, background: 'none', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', fontSize: 10, fontFamily: 'monospace', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}
              onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'; }}
              onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
              title="重置缩放 (Ctrl+0)"
            >{Math.round(canvasState.zoom * 100)}%</button>
            <button onClick={() => setCanvasState(p => ({ ...p, zoom: Math.min(3.0, p.zoom + 0.1) }))}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 6, background: 'none', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b', cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; }}
              onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = '#64748b'; }}
              title="放大 (Ctrl+=)"
            ><Plus className="w-3 h-3" /></button>
          </div>
        </div>
      </div>

      <div ref={canvasRef} className="flex-1 overflow-hidden" 
        onMouseMove={(e) => {
          if (isBoxSelecting) {
            const rect = canvasRef.current!.getBoundingClientRect();
            setBoxSelectEnd({ x: (e.clientX - rect.left - canvasState.viewportX) / canvasState.zoom, y: (e.clientY - rect.top - canvasState.viewportY) / canvasState.zoom });
            return;
          }
          if (!canvasRef.current) return;
          const rect = canvasRef.current.getBoundingClientRect();
          const x = (e.clientX - rect.left - canvasState.viewportX) / canvasState.zoom;
          const y = (e.clientY - rect.top - canvasState.viewportY) / canvasState.zoom;

          if (isPanning) {
            setCanvasState(prev => ({ ...prev, viewportX: prev.viewportX + e.movementX, viewportY: prev.viewportY + e.movementY }));
          } else if (draggingItemId) {
            updateItemPos(draggingItemId, x - dragOffset.x, y - dragOffset.y);
          } else if (draggingSpaceId) {
            setCanvasState(prev => ({ ...prev, spaces: prev.spaces.map(s => s.id === draggingSpaceId ? { ...s, x: x - dragOffset.x, y: y - dragOffset.y } : s) }));
          } else if (linkingSourceId) {
            setLinkTargetPos({ x, y });
          }
        }}
        onMouseDown={(e) => {
          if (e.button === 0 && e.target === canvasRef.current) {
            setIsBoxSelecting(true);
            const rect = canvasRef.current!.getBoundingClientRect();
            const bx = (e.clientX - rect.left - canvasState.viewportX) / canvasState.zoom;
            const by = (e.clientY - rect.top - canvasState.viewportY) / canvasState.zoom;
            setBoxSelectStart({ x: bx, y: by });
            setBoxSelectEnd({ x: bx, y: by });
            setSelectedItemId(null);
          }
        }}
        onMouseUp={() => {
          if (isBoxSelecting) {
            const minX = Math.min(boxSelectStart.x, boxSelectEnd.x);
            const maxX = Math.max(boxSelectStart.x, boxSelectEnd.x);
            const minY = Math.min(boxSelectStart.y, boxSelectEnd.y);
            const maxY = Math.max(boxSelectStart.y, boxSelectEnd.y);
            if (maxX - minX > 5 || maxY - minY > 5) {
              const inBox = [...canvasState.items, ...canvasState.spaces.flatMap(s => s.items)]
                .filter(i => i.x >= minX && i.x + i.width <= maxX && i.y >= minY && i.y + i.height <= maxY)
                .map(i => i.id);
              if (inBox.length > 0) {
                setSelectedItemIds(prev => new Set([...prev, ...inBox]));
                if (inBox.length === 1) setSelectedItemId(inBox[0]);
              }
            }
            setIsBoxSelecting(false);
          }
          setIsPanning(false);
          setDraggingItemId(null);
          setDraggingSpaceId(null);
          if (linkingSourceId) setLinkingSourceId(null);
        }}
        onWheel={(e) => {
          const newZoom = Math.max(0.1, Math.min(3.0, canvasState.zoom * (e.deltaY > 0 ? 0.9 : 1.1)));
          setCanvasState(prev => ({ ...prev, zoom: newZoom }));
        }}
        onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
      >
        <div style={{ transformOrigin: '0 0', transform: `translate(${canvasState.viewportX}px, ${canvasState.viewportY}px) scale(${canvasState.zoom})`, width: 5000, height: 5000 }}>
          <svg style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}>
            <defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#4f46e5" /></marker></defs>
            {canvasState.edges.map(e => {
              const s = allNodesMap.get(e.sourceId), t = allNodesMap.get(e.targetId);
              if (!s || !t) return null;
              const srcLayer = s.metadata?.layerTag;
              const srcColor = srcLayer ? MECE_LAYER_COLORS[srcLayer as MECELayer] || '#4f46e5' : '#4f46e5';
              const x1 = s.x + s.width, y1 = s.y + s.height/2, x2 = t.x, y2 = t.y + t.height/2, dx = x2 - x1;
              return <path key={e.id} d={`M${x1},${y1} C${x1 + dx/2},${y1} ${x2 - dx/2},${y2} ${x2},${y2}`} stroke={srcColor} strokeWidth="2" fill="none" markerEnd="url(#arrowhead)" opacity="0.5" />;
            })}
            {linkingSourceId && (
              <path
                d={((): string => {
                  const s = allNodesMap.get(linkingSourceId); if (!s) return '';
                  const x1 = s.x + s.width, y1 = s.y + s.height/2, dx = linkTargetPos.x - x1;
                  return `M${x1},${y1} C${x1 + dx/2},${y1} ${linkTargetPos.x - dx/2},${linkTargetPos.y} ${linkTargetPos.x},${linkTargetPos.y}`;
                })()}
                stroke="#6366f1" strokeWidth="2" strokeDasharray="5,5" fill="none" opacity="0.6"
              />
            )}
            {/* 框选矩形 */}
            {isBoxSelecting && (() => {
              const rx = Math.min(boxSelectStart.x, boxSelectEnd.x);
              const ry = Math.min(boxSelectStart.y, boxSelectEnd.y);
              const rw = Math.abs(boxSelectEnd.x - boxSelectStart.x);
              const rh = Math.abs(boxSelectEnd.y - boxSelectStart.y);
              return rw > 2 && rh > 2
                ? <rect x={rx} y={ry} width={rw} height={rh} fill="rgba(99,102,241,0.08)" stroke="#6366f1" strokeWidth="1" strokeDasharray="4,3" rx="4" />
                : null;
            })()}
          </svg>
          {canvasState.spaces.map(s => (
            <SpaceNode key={s.id} space={s} isSelected={selectedSpaceId === s.id} onSelect={() => setSelectedSpaceId(s.id)}
              onMoveStart={(e) => { setDraggingSpaceId(s.id); setDragOffset({ x: (e.clientX - canvasRef.current!.getBoundingClientRect().left)/canvasState.zoom - s.x, y: (e.clientY - canvasRef.current!.getBoundingClientRect().top)/canvasState.zoom - s.y }); }}
              onResize={(w, h) => setCanvasState(p => ({ ...p, spaces: p.spaces.map(sp => sp.id === s.id ? { ...sp, width: w, height: h } : sp) }))}
              onToggleCollapse={() => setCanvasState(p => ({ ...p, spaces: p.spaces.map(sp => sp.id === s.id ? { ...sp, collapsed: !sp.collapsed } : sp) }))}
              onTitleChange={(t) => setCanvasState(p => ({ ...p, spaces: p.spaces.map(sp => sp.id === s.id ? { ...sp, title: t } : sp) }))}
              onDelete={() => deleteSpace(s.id)} onItemSelect={setSelectedItemId}
              onLinkStart={handleLinkStart} onLinkEnd={handleLinkEnd}
              onItemDragStart={(id, e) => { e.stopPropagation(); setDraggingItemId(id); setDragOffset({ x: (e.clientX - canvasRef.current!.getBoundingClientRect().left)/canvasState.zoom - allNodesMap.get(id)!.x, y: (e.clientY - canvasRef.current!.getBoundingClientRect().top)/canvasState.zoom - allNodesMap.get(id)!.y }); }}
              onItemDelete={deleteItem} selectedItemId={selectedItemId} objects={objects} objectTypes={objectTypes} canvasZoom={canvasState.zoom}
            />
          ))}
          {canvasState.items.map(item => (
            <ItemNode key={item.id} item={item}
              obj={objects.find(o => o.id === item.objectId)}
              objType={objectTypes.find(t => t.id === objects.find(o => o.id === item.objectId)?.object_type_id)}
              isSelected={selectedItemId === item.id}
              isDraggingThis={draggingItemId === item.id}
              onSelect={() => { setSelectedItemId(item.id); setSelectedSpaceId(null); }}
              onDragStart={(e) => { e.stopPropagation(); setDraggingItemId(item.id); setDragOffset({ x: (e.clientX - canvasRef.current!.getBoundingClientRect().left)/canvasState.zoom - item.x, y: (e.clientY - canvasRef.current!.getBoundingClientRect().top)/canvasState.zoom - item.y }); }}
              onDragEnd={() => { setDraggingItemId(null); }}
              onDelete={() => deleteItem(item.id)} onLinkStart={(e) => handleLinkStart(item.id, e)} onLinkEnd={() => handleLinkEnd(item.id)}
              layerColor={MECE_LAYER_COLORS[activeLayer]}
              onContextMenu={(e) => setContextMenu({ x: e.clientX, y: e.clientY, itemId: item.id })}
            />
          ))}

          {/* 空画布引导 */}
          {canvasState.items.length === 0 && canvasState.spaces.length === 0 && !isAIFilling && (
            <div style={{
              position: 'absolute', left: '50%', top: '50%',
              transform: 'translate(-50%, -50%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
              userSelect: 'none', pointerEvents: 'none',
            }}>
              <Sparkles className="w-12 h-12" style={{ color: '#64748b' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#475569', marginBottom: 8 }}>还没有任何节点</div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 20 }}>拖拽添加 · 或点击「AI 一键填充」自动生成</div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleAiFill(); }}
                disabled={isAIFilling}
                style={{
                  pointerEvents: 'auto',
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 20px', borderRadius: 9999,
                  background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                  border: 'none', color: 'white', fontSize: 12, fontWeight: 700,
                  cursor: isAIFilling ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 16px rgba(99, 102, 241, 0.4)',
                  transition: 'all 0.2s',
                }}
              >
                {isAIFilling ? <><Loader2 className="w-4 h-4 animate-spin" /> AI 构思中...</> : <><Sparkles className="w-4 h-4" /> AI 一键填充</>}
              </button>
            </div>
          )}

          {/* 右键上下文菜单 */}
          {contextMenu && (() => {
            const menuItem = allNodesMap.get(contextMenu.itemId);
            const menuStyle = {
              position: 'fixed' as const, left: contextMenu.x, top: contextMenu.y,
              minWidth: 200, background: 'rgba(23,23,35,0.98)', backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
              padding: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 500,
            };
            const btnStyle = (color?: string) => ({
              width: '100%', textAlign: 'left' as const, padding: '7px 10px', borderRadius: 6,
              fontSize: 11, color: color || '#94a3b8', cursor: 'pointer',
              background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 8,
            });
            const handleMenu = (fn: () => void) => { fn(); setContextMenu(null); };
            return (
              <div style={menuStyle} onMouseLeave={() => setContextMenu(null)}>
                <button style={btnStyle('#e2e8f0')} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'} onMouseOut={e => e.currentTarget.style.background = 'none'} onClick={() => handleMenu(() => { setSelectedItemId(contextMenu.itemId); setSelectedSpaceId(null); })}><Edit3 className="w-3.5 h-3.5" /> 编辑节点属性</button>
                <button style={btnStyle()} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'} onMouseOut={e => e.currentTarget.style.background = 'none'} onClick={() => handleMenu(() => { const it = allNodesMap.get(contextMenu.itemId); if (it) { pushUndo(canvasState); const newItem = { ...it, id: `item-${Date.now()}`, x: it.x + 20, y: it.y + 20 }; setCanvasState(p => ({ ...p, items: [...p.items, newItem] })); } })}><Copy className="w-3.5 h-3.5" /> 复制节点</button>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
                <button style={btnStyle('#a78bfa')} onMouseOver={e => e.currentTarget.style.background = 'rgba(167,139,250,0.1)'} onMouseOut={e => e.currentTarget.style.background = 'none'} onClick={() => handleMenu(() => updateNode(contextMenu.itemId, { nodeType: 'Source' }))}><Database className="w-3.5 h-3.5" /> 设为 Source</button>
                <button style={btnStyle('#4ade80')} onMouseOver={e => e.currentTarget.style.background = 'rgba(74,222,128,0.1)'} onMouseOut={e => e.currentTarget.style.background = 'none'} onClick={() => handleMenu(() => updateNode(contextMenu.itemId, { nodeType: 'Transform' }))}><Layers className="w-3.5 h-3.5" /> 设为 Transform</button>
                <button style={btnStyle('#fb923c')} onMouseOver={e => e.currentTarget.style.background = 'rgba(251,146,60,0.1)'} onMouseOut={e => e.currentTarget.style.background = 'none'} onClick={() => handleMenu(() => updateNode(contextMenu.itemId, { nodeType: 'Sink' }))}><Zap className="w-3.5 h-3.5" /> 设为 Sink</button>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
                {menuItem?.metadata?.sqlFragment && (
                  <button style={btnStyle()} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'} onMouseOut={e => e.currentTarget.style.background = 'none'} onClick={() => handleMenu(() => { navigator.clipboard.writeText(menuItem.metadata.sqlFragment); })}><Code className="w-3.5 h-3.5" /> 复制 SQL 片段</button>
                )}
                <button style={btnStyle()} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'} onMouseOut={e => e.currentTarget.style.background = 'none'} onClick={() => handleMenu(() => { if (menuItem?.metadata?.sqlFragment) onInsert?.(menuItem.metadata.sqlFragment); })}><ExternalLink className="w-3.5 h-3.5" /> 注入到编辑器</button>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
                <button style={btnStyle('#ef4444')} onMouseOver={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'} onMouseOut={e => e.currentTarget.style.background = 'none'} onClick={() => handleMenu(() => { pushUndo(canvasState); deleteItem(contextMenu.itemId); })}><Trash2 className="w-3.5 h-3.5" /> 删除节点</button>
              </div>
            );
          })()}
        </div>
      </div>

      <div style={{ width: (selectedItemId || showSqlPreview) ? 360 : 0, transition: 'width 0.3s ease', overflow: 'hidden', position: 'relative', zIndex: 110, boxShadow: '-10px 0 30px rgba(0,0,0,0.5)' }}>
        {selectedItemId && selectedItem && <CanvasNodeInspector
          item={selectedItem as any}
          object={objects.find(o => o.id === selectedItem.objectId)}
          allItems={[...canvasState.items, ...canvasState.spaces.flatMap(s => s.items)]}
          onUpdate={(u) => updateNode(selectedItemId, u)}
          onClose={() => setSelectedItemId(null)}
          onDelete={() => deleteItem(selectedItemId)}
        />}
        {showSqlPreview && !selectedItemId && (
          <div style={{ height: '100%', background: 'rgba(13,13,20,0.98)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Terminal className="w-4 h-4 text-indigo-400" /><span style={{ fontSize: 13, fontWeight: 700 }}>拓扑 SQL 预览</span></div>
              <button onClick={() => setShowSqlPreview(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X className="w-4 h-4" /></button>
            </div>
            <div style={{ flex: 1, padding: 20, overflow: 'auto' }}>
              {/* Topology metadata badges */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}>
                  {canvasState.items.length} 节点
                </span>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(56,189,248,0.1)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.2)' }}>
                  {canvasState.edges.length} 边
                </span>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(251,146,60,0.1)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.2)' }}>
                  {compileResult.ctes.length} CTE
                </span>
                {compileResult.warnings.length > 0 && (
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                    {compileResult.warnings.length} 警告
                  </span>
                )}
              </div>

              {/* SQL Preview */}
              <pre style={{ margin: 0, fontSize: 11, color: '#94a3b8', whiteSpace: 'pre-wrap', fontFamily: 'monospace', lineHeight: 1.6, background: '#000', padding: 12, borderRadius: 8, maxHeight: 260, overflow: 'auto' }}>{compiledSql}</pre>

              {/* Warnings */}
              {compileResult.warnings.length > 0 && (
                <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: 'rgba(251,146,60,0.06)', border: '1px solid rgba(251,146,60,0.15)', fontSize: 10, color: '#fb923c', lineHeight: 1.6 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>⚠ 拓扑警告</div>
                  {compileResult.warnings.map((w, i) => <div key={i}>• {w}</div>)}
                </div>
              )}

              {/* Topology Insights */}
              <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.1)', fontSize: 11, color: '#94a3b8' }}>
                <div style={{ color: '#6366f1', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}><Sparkles className="w-3.5 h-3.5" /> 拓扑洞察</div>
                {compileResult.ctes.length === 0 ? (
                  <span>画布为空或所有节点均为 Control 类型。请添加 Source/Transform/Sink 节点并连线。</span>
                ) : (
                  <>
                    <span>检测到 <strong style={{ color: '#818cf8' }}>{canvasState.edges.length}</strong> 条数据依赖路径，共 <strong style={{ color: '#818cf8' }}>{compileResult.ctes.length}</strong> 个 CTE 阶段。</span><br/>
                    {compileResult.success
                      ? <span style={{ color: '#4ade80' }}>✓ 拓扑结构有效，可生成 SQL</span>
                      : <span style={{ color: '#f87171' }}>✗ 存在错误，请检查节点配置</span>}
                  </>
                )}
              </div>

              {/* 二次优化入口 */}
              {!showRefinePanel ? (
                <button
                  onClick={() => setShowRefinePanel(true)}
                  style={{
                    marginTop: 12, width: '100%', padding: '8px 12px', borderRadius: 8,
                    background: 'rgba(251,146,60,0.05)', border: '1px dashed rgba(251,146,60,0.3)',
                    color: '#fb923c', fontSize: 11, cursor: 'pointer', textAlign: 'left',
                    transition: 'all 0.2s',
                  }}
                >
                  再细化一下... （输入优化方向，AI 分析拓扑并给出建议）
                </button>
              ) : (
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    <input
                      autoFocus
                      value={refineInput}
                      onChange={e => setRefineInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleRefine(); if (e.key === 'Escape') { setShowRefinePanel(false); setRefineInput(''); } }}
                      placeholder="描述优化方向，如：增加过滤节点、改为时序聚合..."
                      style={{
                        flex: 1, padding: '7px 10px', borderRadius: 8,
                        background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(251,146,60,0.3)',
                        color: '#fff', fontSize: 11, outline: 'none',
                      }}
                    />
                    <button
                      onClick={handleRefine}
                      disabled={isRefining || !refineInput.trim()}
                      style={{
                        padding: '7px 12px', borderRadius: 8,
                        background: isRefining ? 'rgba(251,146,60,0.2)' : 'rgba(251,146,60,0.1)',
                        border: '1px solid rgba(251,146,60,0.4)', color: '#fb923c',
                        fontSize: 11, cursor: isRefining ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}
                    >
                      {isRefining ? '分析中...' : '优化'}
                    </button>
                    <button onClick={() => { setShowRefinePanel(false); setRefineInput(''); }} style={{ padding: '7px 8px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#64748b', cursor: 'pointer', fontSize: 11 }}>✕</button>
                  </div>
                  {refineResult && (
                    <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(251,146,60,0.06)', border: '1px solid rgba(251,146,60,0.2)', fontSize: 11, color: '#94a3b8' }}>
                      <div style={{ color: '#fb923c', fontWeight: 600, marginBottom: 6, fontSize: 11 }}>{refineResult.summary}</div>
                      {refineResult.steps.map((step, i) => (
                        <div key={i} style={{ marginBottom: 6, paddingLeft: 10, borderLeft: '2px solid rgba(251,146,60,0.3)', lineHeight: 1.6 }}>
                          {step.action}
                          {step.introspection && <div style={{ fontSize: 10, color: '#a78bfa', marginTop: 2, fontStyle: 'italic' }}>? {step.introspection}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div style={{ padding: 20, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button onClick={() => onInsert?.(compiledSql)} style={{ width: '100%', padding: 10, borderRadius: 8, background: 'linear-gradient(135deg, #4f46e5, #6366f1)', border: 'none', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>注入 SQL 到解析器</button>
            </div>
          </div>
        )}
      </div>

      {showHelp && (
        <CanvasHelpPanel
          config={{ type: 'canvas', existingObjects: objects.map(o => o.name) }}
          onClose={() => setShowHelp(false)}
        />
      )}

      {showObjectPicker && <ObjectPicker objects={objects} objectTypes={objectTypes} onSelect={(id) => addItem(id, pickerSpaceId || undefined)} onClose={() => setShowObjectPicker(false)} />}
    </div>
  );
};

const OntologyCanvas: React.FC<OntologyCanvasProps> = (props) => {
  const store = useOntologyStore();
  return <OntologyCanvasInner {...props} objects={store.state.objects} objectTypes={store.state.objectTypes} />;
};

export default OntologyCanvas;
