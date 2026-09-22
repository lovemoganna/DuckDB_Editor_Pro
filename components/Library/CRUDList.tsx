/**
 * OntologyPanel CRUDList - MECE 优化重构
 * 
 * MECE 分类原则：
 * - Ⅰ. 模式层 (Schema): ObjectTypes + LinkTypes (类型定义)
 * - Ⅱ. 实例层 (Instances): Objects + Links + Actions (数据实例)
 * - Ⅲ. 沉思层 (Reflection): Introspections + Insights (元认知)
 * 
 * 优化点：
 * 1. 批量选择与操作
 * 2. 类型筛选器
 * 3. 键盘导航支持
 * 4. 危险操作二次确认
 * 5. 展开状态持久化
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Search, List, Upload, Download, Loader2, Plus, Trash2, 
  ChevronDown, ChevronRight, Target, Edit3, Layers, Link2,
  Table2, Zap, Brain, Lightbulb, AlertTriangle, Check, X,
  Filter, Square, CheckSquare, ListFilter, ListChecks, ArrowRight, Focus, Eye
} from 'lucide-react';
import { useOntologyStore } from '../../hooks/useOntologyStore';
import { useConfirmDialog } from '../ui/ConfirmDialog';
import { ToastNotification } from '../ui/ToastNotification';
import {
  downloadOntologyJSON,
  importOntologyFromJSON,
} from '../../services/ontology/ontologyStorage';
import { IconButton, Badge, ActionButton, SegmentedTabs } from '../ui/Workbench';
import type { EditMode } from './OntologyPanel.types';

// ============================================================
// Types
// ============================================================

type SubTab = 'schema' | 'instances' | 'reflection';

interface SelectionState {
  objectTypes: Set<number>;
  linkTypes: Set<number>;
  objects: Set<number>;
  links: Set<number>;
  actions: Set<number>;
  introspections: Set<number>;
  insights: Set<number>;
}

interface FilterState {
  objectTypeId: number | null;
  linkTypeId: number | null;
}

// ============================================================
// Utility Functions
// ============================================================

/** 高亮搜索匹配文本 */
const renderHighlight = (text: string, query: string): React.ReactNode => {
  if (!query) return <span>{text}</span>;
  const parts = text.split(new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
  return (
    <span>
      {parts.map((part, i) => 
        part.toLowerCase() === query.toLowerCase() 
          ? <mark key={i} className="bg-monokai-yellow/30 text-monokai-yellow font-bold px-0.5 rounded">{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </span>
  );
};

/** 获取选中数量统计 */
const getSelectionCount = (selection: SelectionState): number => {
  return Array.from(selection.objectTypes).length +
         Array.from(selection.linkTypes).length +
         Array.from(selection.objects).length +
         Array.from(selection.links).length +
         Array.from(selection.actions).length +
         Array.from(selection.introspections).length +
         Array.from(selection.insights).length;
};

// ============================================================
// Section Header Component
// ============================================================

interface SectionHeaderProps {
  title: string;
  icon: React.ElementType;
  count: number;
  matchedCount?: number;
  expanded: boolean;
  onToggle: () => void;
  onAdd: () => void;
  color: string;
  selectionCount?: number;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title, icon: Icon, count, matchedCount, expanded, onToggle, onAdd,
  color, selectionCount = 0, onSelectAll, onClearSelection
}) => {
  const colorMap: Record<string, { text: string; bg: string; border: string }> = {
    cyan:   { text: 'text-monokai-cyan', bg: 'bg-monokai-cyan/15', border: 'border-monokai-cyan/30' },
    green:  { text: 'text-monokai-green', bg: 'bg-monokai-green/15', border: 'border-monokai-green/30' },
    yellow: { text: 'text-monokai-yellow', bg: 'bg-monokai-yellow/15', border: 'border-monokai-yellow/30' },
    pink:   { text: 'text-monokai-pink', bg: 'bg-monokai-pink/15', border: 'border-monokai-pink/30' },
  };
  const styles = colorMap[color] || colorMap.cyan;

  return (
    <div className="flex items-center justify-between group py-1.5 px-2 rounded-lg hover:bg-monokai-surface/50 cursor-pointer transition-colors"
         onClick={onToggle}>
      <div className="flex items-center gap-2.5">
        <Icon className={`w-4 h-4 ${styles.text}`} />
        <span className="text-xs font-semibold text-monokai-fg">{title}</span>
        <Badge 
          variant={matchedCount !== undefined && matchedCount < count ? 'warning' : 'neutral'}
          size="sm"
        >
          {matchedCount !== undefined ? `${matchedCount}/${count}` : count}
        </Badge>
        {selectionCount > 0 && (
          <Badge variant="info" size="sm">
            已选 {selectionCount}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {selectionCount > 0 && onClearSelection && (
          <IconButton
            icon={Square}
            label="清除选择"
            size="sm"
            tone="neutral"
            onClick={(e) => { e.stopPropagation(); onClearSelection(); }}
          />
        )}
        {onSelectAll && selectionCount === 0 && (
          <IconButton
            icon={CheckSquare}
            label="全选"
            size="sm"
            tone="neutral"
            onClick={(e) => { e.stopPropagation(); onSelectAll(); }}
          />
        )}
        <IconButton
          icon={Plus}
          label={`新建${title}`}
          size="sm"
          tone="primary"
          onClick={(e) => { e.stopPropagation(); onAdd(); }}
        />
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-monokai-comment" />
        ) : (
          <ChevronRight className="w-4 h-4 text-monokai-comment" />
        )}
      </div>
    </div>
  );
};

// ============================================================
// Entity Row Component
// ============================================================

interface EntityRowProps {
  id: number;
  name: string;
  description?: string;
  typeLabel?: string;
  degreeBadge?: React.ReactNode;
  query: string;
  isSelected: boolean;
  isActive?: boolean;
  dataEntityId?: string;
  color: string;
  onClick: () => void;
  onSelect: (id: number, selected: boolean) => void;
  onDelete: () => void;
  onFocus?: () => void;
  onHoverChange?: (isHover: boolean) => void;
}

const EntityRow: React.FC<EntityRowProps> = ({
  id, name, description, typeLabel, degreeBadge, query, isSelected, isActive, dataEntityId, color, onClick, onSelect, onDelete, onFocus, onHoverChange
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const colorMap: Record<string, string> = {
    cyan: 'bg-monokai-cyan',
    green: 'bg-monokai-green',
    yellow: 'bg-monokai-yellow',
    pink: 'bg-monokai-pink',
  };

  return (
    <div
      data-entity-row
      data-entity-id={dataEntityId}
      className={`
        flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all duration-200 cursor-pointer group relative
        ${isActive
          ? 'bg-monokai-cyan/15 border border-monokai-cyan/60 ring-1 ring-monokai-cyan/40 shadow-xs'
          : isSelected 
            ? 'bg-monokai-cyan/10 border border-monokai-cyan/30' 
            : 'hover:bg-monokai-surface/60 border border-transparent hover:border-monokai-border'
        }
      `}
      onClick={onClick}
      onMouseEnter={() => { setIsHovered(true); onHoverChange?.(true); }}
      onMouseLeave={() => { setIsHovered(false); onHoverChange?.(false); }}
    >
      {/* Selection Checkbox */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onSelect(id, !isSelected); }}
        className={`
          shrink-0 p-1 rounded transition-all cursor-pointer
          ${isSelected 
            ? 'text-monokai-cyan' 
            : isHovered 
              ? 'text-monokai-comment hover:text-monokai-fg' 
              : 'text-transparent'
          }
        `}
      >
        {isSelected ? (
          <CheckSquare className="w-3.5 h-3.5" />
        ) : (
          <Square className="w-3.5 h-3.5" />
        )}
      </button>

      {/* Status Dot */}
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${colorMap[color] || colorMap.cyan} opacity-60`} />

      {/* Content */}
      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs text-monokai-fg font-medium truncate flex-1" title={name}>
            {renderHighlight(name, query)}
          </span>
          {degreeBadge}
          {typeLabel && (
            <span className="text-[10px] px-1.5 py-0.2 bg-monokai-bg text-monokai-cyan border border-monokai-border rounded font-mono shrink-0">
              {renderHighlight(typeLabel, query)}
            </span>
          )}
        </div>
        {description && (
          <span className="text-[10px] text-monokai-comment truncate font-sans" title={description}>
            {description}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className={`
        flex items-center gap-1 shrink-0 transition-opacity
        ${isHovered || isSelected || isActive ? 'opacity-100' : 'opacity-0'}
      `}>
        {onFocus && (
          <IconButton
            icon={Target}
            label="在图谱中定位"
            size="sm"
            tone="primary"
            onClick={(e) => { e.stopPropagation(); onFocus(); }}
          />
        )}
        <IconButton
          icon={Trash2}
          label="删除"
          size="sm"
          tone="danger"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        />
      </div>
    </div>
  );
};

// ============================================================
// Link Row Component (关系连线专用)
// ============================================================

interface LinkRowProps {
  id: number;
  sourceName: string;
  linkTypeName: string;
  targetName: string;
  query: string;
  isSelected: boolean;
  isActive?: boolean;
  dataEntityId?: string;
  onClick: () => void;
  onSelect: (id: number, selected: boolean) => void;
  onDelete: () => void;
  onFocusLink?: () => void;
  onFocusSource?: () => void;
  onFocusTarget?: () => void;
  onHoverChange?: (isHover: boolean) => void;
}

const LinkRow: React.FC<LinkRowProps> = ({
  id, sourceName, linkTypeName, targetName, query, isSelected, isActive, dataEntityId, onClick, onSelect, onDelete, onFocusLink, onFocusSource, onFocusTarget, onHoverChange
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      data-entity-row
      data-entity-id={dataEntityId}
      className={`
        flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all duration-200 cursor-pointer group relative
        ${isActive
          ? 'bg-monokai-green/15 border border-monokai-green/60 ring-1 ring-monokai-green/40 shadow-xs'
          : isSelected 
            ? 'bg-monokai-green/10 border border-monokai-green/30' 
            : 'hover:bg-monokai-surface/60 border border-transparent hover:border-monokai-border'
        }
      `}
      onClick={onClick}
      onMouseEnter={() => { setIsHovered(true); onHoverChange?.(true); }}
      onMouseLeave={() => { setIsHovered(false); onHoverChange?.(false); }}
    >
      {/* Selection Checkbox */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onSelect(id, !isSelected); }}
        className={`
          shrink-0 p-1 rounded transition-all cursor-pointer
          ${isSelected 
            ? 'text-monokai-cyan' 
            : isHovered 
              ? 'text-monokai-comment hover:text-monokai-fg' 
              : 'text-transparent'
          }
        `}
      >
        {isSelected ? (
          <CheckSquare className="w-3.5 h-3.5" />
        ) : (
          <Square className="w-3.5 h-3.5" />
        )}
      </button>

      {/* Link Path Visualization — Full width, no truncation clamp */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
        <span className="text-xs text-monokai-cyan font-semibold truncate flex-1 text-right" title={sourceName}>
          {renderHighlight(sourceName, query)}
        </span>
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-monokai-bg text-monokai-green border border-monokai-border shrink-0 font-medium text-[10px] font-mono shadow-2xs">
          <span>─</span>
          <span className="truncate max-w-[120px]">{renderHighlight(linkTypeName, query)}</span>
          <span>→</span>
        </span>
        <span className="text-xs text-monokai-fg font-semibold truncate flex-1 text-left" title={targetName}>
          {renderHighlight(targetName, query)}
        </span>
      </div>

      {/* Actions */}
      <div className={`
        flex items-center gap-1 shrink-0 transition-opacity
        ${isHovered || isSelected || isActive ? 'opacity-100' : 'opacity-0'}
      `}>
        {onFocusLink && (
          <IconButton
            icon={Target}
            label="在图谱中聚焦关系连线"
            size="sm"
            tone="primary"
            onClick={(e) => { e.stopPropagation(); onFocusLink(); }}
          />
        )}
        {onFocusSource && (
          <IconButton
            icon={ArrowRight}
            label="定位起点"
            size="sm"
            tone="neutral"
            onClick={(e) => { e.stopPropagation(); onFocusSource(); }}
          />
        )}
        {onFocusTarget && (
          <IconButton
            icon={ArrowRight}
            label="定位终点"
            size="sm"
            tone="neutral"
            onClick={(e) => { e.stopPropagation(); onFocusTarget(); }}
          />
        )}
        <IconButton
          icon={Trash2}
          label="删除"
          size="sm"
          tone="danger"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        />
      </div>
    </div>
  );
};

// ============================================================
// Batch Actions Bar Component
// ============================================================

interface BatchActionsBarProps {
  selectionCount: number;
  onDeleteSelected: () => void;
  onClearSelection: () => void;
  onSelectAll: () => void;
}

const BatchActionsBar: React.FC<BatchActionsBarProps> = ({
  selectionCount, onDeleteSelected, onClearSelection, onSelectAll
}) => {
  return (
    <div className="flex items-center justify-between px-3 py-2 bg-monokai-surface/80 border-b border-monokai-border/50 animate-in slide-in-from-top-2">
      <div className="flex items-center gap-2">
        <CheckSquare className="w-4 h-4 text-monokai-cyan" />
        <span className="text-xs font-medium text-monokai-fg">
          已选择 <span className="text-monokai-cyan font-bold">{selectionCount}</span> 项
        </span>
      </div>
      <div className="flex items-center gap-2">
        <ActionButton
          variant="ghost"
          size="sm"
          icon={X}
          onClick={onClearSelection}
        >
          清除
        </ActionButton>
        <ActionButton
          variant="danger"
          size="sm"
          icon={Trash2}
          onClick={onDeleteSelected}
        >
          批量删除
        </ActionButton>
      </div>
    </div>
  );
};

// ============================================================
// Type Filter Component
// ============================================================

interface TypeFilterProps {
  objectTypes: Array<{ id: number; name: string }>;
  selectedTypeId: number | null;
  onSelect: (typeId: number | null) => void;
}

const TypeFilter: React.FC<TypeFilterProps> = ({ objectTypes, selectedTypeId, onSelect }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const selectedType = objectTypes.find(t => t.id === selectedTypeId);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={`
          flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer
          ${selectedTypeId 
            ? 'bg-monokai-cyan/15 text-monokai-cyan border border-monokai-cyan/30' 
            : 'bg-monokai-surface text-monokai-comment border border-monokai-border hover:bg-monokai-surface/80'
          }
        `}
      >
        <Filter className="w-3.5 h-3.5" />
        <span>{selectedType?.name || '全部类型'}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {isExpanded && (
        <div className="absolute top-full left-0 mt-1 z-20 bg-monokai-bg border border-monokai-border rounded-lg shadow-xl py-1 min-w-[160px] animate-in fade-in zoom-in-95">
          <button
            type="button"
            onClick={() => { onSelect(null); setIsExpanded(false); }}
            className={`
              w-full px-3 py-2 text-xs text-left transition-colors cursor-pointer
              ${selectedTypeId === null 
                ? 'bg-monokai-cyan/15 text-monokai-cyan' 
                : 'text-monokai-fg hover:bg-monokai-surface'
              }
            `}
          >
            全部类型
          </button>
          {objectTypes.map(type => (
            <button
              key={type.id}
              type="button"
              onClick={() => { onSelect(type.id); setIsExpanded(false); }}
              className={`
                w-full px-3 py-2 text-xs text-left transition-colors cursor-pointer
                ${selectedTypeId === type.id 
                  ? 'bg-monokai-cyan/15 text-monokai-cyan' 
                  : 'text-monokai-fg hover:bg-monokai-surface'
                }
              `}
            >
              {type.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================
// Main CRUDList Component
// ============================================================

interface CRUDListProps {
  onInspect: (mode: EditMode, target: any) => void;
  onRequestDelete: (type: string, id: number, label: string) => void;
  activeEntity?: { mode: EditMode; id: number } | null;
}

export const CRUDList: React.FC<CRUDListProps> = ({ onInspect, onRequestDelete, activeEntity }) => {
  const store = useOntologyStore();
  const { state } = store;
  const { confirm } = useConfirmDialog();

  // ── State ──
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('schema');
  const [search, setSearch] = useState('');
  const [topologyFilter, setTopologyFilter] = useState<'all' | 'orphan' | 'hub'>('all');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    objectTypes: true, objects: true, linkTypes: true, links: true, actions: true,
    introspections: false, insights: false,
  });
  const [selection, setSelection] = useState<SelectionState>({
    objectTypes: new Set(), linkTypes: new Set(), objects: new Set(),
    links: new Set(), actions: new Set(), introspections: new Set(), insights: new Set(),
  });
  const [filter, setFilter] = useState<FilterState>({ objectTypeId: null, linkTypeId: null });
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [isOperating, setIsOperating] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Keyboard Navigation ──
  const listRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Auto switch subtab and scroll to active entity when changed externally
  useEffect(() => {
    if (!activeEntity) return;
    const { mode, id } = activeEntity;

    // Auto switch subtab
    if (mode === 'objectType' || mode === 'linkType') {
      setActiveSubTab('schema');
    } else if (mode === 'object' || mode === 'link' || mode === 'action') {
      setActiveSubTab('instances');
    } else if (mode === 'introspection' || mode === 'insight') {
      setActiveSubTab('reflection');
    }

    // Smooth scroll to target element
    const timer = setTimeout(() => {
      const el = listRef.current?.querySelector(`[data-entity-id="${mode}-${id}"]`);
      if (el && typeof (el as any).scrollIntoView === 'function') {
        (el as any).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [activeEntity]);

  // Synchronize selection to D3GraphView selected rings in real-time
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ids: string[] = [];
    selection.objects.forEach(id => ids.push(`obj::${id}`));
    selection.objectTypes.forEach(id => ids.push(`type::${id}`));
    selection.actions.forEach(id => ids.push(`action::${id}`));
    (window as any).__d3SetSelectedNodes?.(ids);
  }, [selection]);

  // Unified Inspection & Graph Focusing Handlers
  const handleInspectObject = useCallback((obj: any) => {
    onInspect('object', obj);
    (window as any).__d3FocusNode?.(obj.id, 'instance');
  }, [onInspect]);

  const handleInspectObjectType = useCallback((ot: any) => {
    onInspect('objectType', ot);
    (window as any).__d3FocusNode?.(ot.id, 'typeHub');
  }, [onInspect]);

  const handleInspectLinkType = useCallback((lt: any) => {
    onInspect('linkType', lt);
    const matchingLinks = (state.links || []).filter((l: any) => l.link_type_id === lt.id);
    if (matchingLinks.length > 0) {
      const nodeIds: number[] = [];
      matchingLinks.forEach((l: any) => {
        nodeIds.push(l.source_object_id);
        nodeIds.push(l.target_object_id);
      });
      (window as any).__d3FocusNodes?.(Array.from(new Set(nodeIds)));
    } else {
      (window as any).__d3FocusNode?.(lt.id, 'typeHub');
    }
  }, [onInspect, state.links]);

  const handleInspectLink = useCallback((link: any) => {
    onInspect('link', link);
    (window as any).__d3FocusLink?.(link.id, link.source_object_id, link.target_object_id);
  }, [onInspect]);

  const handleInspectAction = useCallback((action: any) => {
    onInspect('action', action);
    (window as any).__d3FocusNode?.(action.id, 'action');
  }, [onInspect]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle when list is focused
      if (!listRef.current?.contains(document.activeElement)) return;

      const items = listRef.current?.querySelectorAll('[data-entity-row]');
      if (!items?.length) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex(i => Math.min(i + 1, items.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex(i => Math.max(i - 1, 0));
          break;
        case 'Enter':
          if (focusedIndex >= 0) {
            (items[focusedIndex] as HTMLElement).click();
          }
          break;
        case 'Delete':
        case 'Backspace':
          if (e.shiftKey && focusedIndex >= 0) {
            // Batch delete with confirmation
          }
          break;
        case 'Escape':
          clearSelection();
          break;
        case 'a':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            selectAllInCurrentTab();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedIndex]);

  // ── Selection Helpers ──
  const toggleSelection = useCallback((
    category: keyof SelectionState, 
    id: number, 
    selected: boolean
  ) => {
    setSelection(prev => {
      const next = new Set(prev[category]);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return { ...prev, [category]: next };
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelection({
      objectTypes: new Set(), linkTypes: new Set(), objects: new Set(),
      links: new Set(), actions: new Set(), introspections: new Set(), insights: new Set(),
    });
  }, []);

  // ── Filtered Lists (defined early so selectAllInCurrentTab can reference them) ──
  const filteredObjectTypes = useMemo(() => {
    if (!search) return state.objectTypes;
    const t = search.toLowerCase();
    return state.objectTypes.filter((ot: any) => 
      ot.name.toLowerCase().includes(t) || (ot.description || '').toLowerCase().includes(t)
    );
  }, [state.objectTypes, search]);

  const filteredLinkTypes = useMemo(() => {
    if (!search) return state.linkTypes || [];
    const t = search.toLowerCase();
    return (state.linkTypes || []).filter((lt: any) => 
      lt.name.toLowerCase().includes(t) || (lt.description || '').toLowerCase().includes(t)
    );
  }, [state.linkTypes, search]);

  const nodeDegreeMap = useMemo(() => {
    const deg: Record<number, number> = {};
    for (const l of state.links || []) {
      deg[l.source_object_id] = (deg[l.source_object_id] || 0) + 1;
      deg[l.target_object_id] = (deg[l.target_object_id] || 0) + 1;
    }
    return deg;
  }, [state.links]);

  const filteredObjects = useMemo(() => {
    let objects = state.objects;
    if (search) {
      const t = search.toLowerCase();
      objects = objects.filter((o: any) =>
        o.name.toLowerCase().includes(t) ||
        (store.objectTypeMap[o.object_type_id]?.name || '').toLowerCase().includes(t)
      );
    }
    if (filter.objectTypeId !== null) {
      objects = objects.filter((o: any) => o.object_type_id === filter.objectTypeId);
    }
    if (topologyFilter === 'orphan') {
      objects = objects.filter((o: any) => !nodeDegreeMap[o.id] || nodeDegreeMap[o.id] === 0);
    } else if (topologyFilter === 'hub') {
      objects = objects.filter((o: any) => (nodeDegreeMap[o.id] || 0) >= 3);
    }
    return objects;
  }, [state.objects, search, filter.objectTypeId, store.objectTypeMap, topologyFilter, nodeDegreeMap]);

  const filteredLinks = useMemo(() => {
    if (!search) return state.links;
    const t = search.toLowerCase();
    return state.links.filter((l: any) =>
      store.objectNameMap[l.source_object_id]?.toLowerCase().includes(t) ||
      store.objectNameMap[l.target_object_id]?.toLowerCase().includes(t) ||
      (store.linkTypeMap[l.link_type_id]?.name || '').toLowerCase().includes(t)
    );
  }, [state.links, search, store.objectNameMap, store.linkTypeMap]);

  const filteredActions = useMemo(() => {
    if (!search) return state.actions;
    const t = search.toLowerCase();
    return state.actions.filter((a: any) =>
      a.name.toLowerCase().includes(t) || (a.description || '').toLowerCase().includes(t)
    );
  }, [state.actions, search]);

  const filteredIntrospections = useMemo(() => {
    if (!search) return state.introspections;
    const t = search.toLowerCase();
    return state.introspections.filter((i: any) =>
      (i.question || '').toLowerCase().includes(t) ||
      (i.answer || '').toLowerCase().includes(t)
    );
  }, [state.introspections, search]);

  const filteredInsights = useMemo(() => {
    if (!search) return state.insights;
    const t = search.toLowerCase();
    return state.insights.filter((i: any) =>
      (i.insight || '').toLowerCase().includes(t) ||
      (i.tag || '').toLowerCase().includes(t)
    );
  }, [state.insights, search]);

  const selectAllInCurrentTab = useCallback(() => {
    switch (activeSubTab) {
      case 'schema':
        setSelection(prev => ({
          ...prev,
          objectTypes: new Set(state.objectTypes.map((t: any) => t.id)),
          linkTypes: new Set((state.linkTypes || []).map((t: any) => t.id)),
        }));
        break;
      case 'instances':
        setSelection(prev => ({
          ...prev,
          objects: new Set(filteredObjects.map((o: any) => o.id)),
          links: new Set(filteredLinks.map((l: any) => l.id)),
          actions: new Set(filteredActions.map((a: any) => a.id)),
        }));
        break;
      case 'reflection':
        setSelection(prev => ({
          ...prev,
          introspections: new Set(filteredIntrospections.map((i: any) => i.id)),
          insights: new Set(filteredInsights.map((i: any) => i.id)),
        }));
        break;
    }
  }, [activeSubTab, state.objectTypes, state.linkTypes, filteredObjects, filteredLinks, filteredActions, filteredIntrospections, filteredInsights]);

  // ── Batch Delete ──
  const handleBatchDelete = useCallback(async () => {
    const count = getSelectionCount(selection);
    if (count === 0) return;

    const ok = await confirm({
      title: '批量删除确认',
      message: `确定要删除选中的 ${count} 项吗？此操作不可撤销。`,
      variant: 'danger',
      confirmText: `确认删除 ${count} 项`,
      cancelText: '取消',
    });

    if (!ok) return;

    // Execute deletions
    const deletePromises: Promise<void>[] = [];
    
    selection.objects.forEach(id => {
      deletePromises.push(store.deleteObject(id));
    });
    selection.links.forEach(id => {
      deletePromises.push(store.deleteLink(id));
    });
    selection.objectTypes.forEach(id => {
      deletePromises.push(store.deleteObjectType(id));
    });
    selection.linkTypes.forEach(id => {
      deletePromises.push(store.deleteLinkType(id));
    });
    selection.actions.forEach(id => {
      deletePromises.push(store.deleteAction(id));
    });
    selection.introspections.forEach(id => {
      deletePromises.push(store.deleteIntrospection(id));
    });
    selection.insights.forEach(id => {
      deletePromises.push(store.deleteInsight(id));
    });

    try {
      setIsOperating(true);
      await Promise.all(deletePromises);
      await store.refresh();
      clearSelection();
      setToast({ msg: `成功删除 ${count} 项`, type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (e: any) {
      setToast({ msg: `删除失败: ${e.message}`, type: 'error' });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setIsOperating(false);
    }
  }, [selection, confirm, store]);

  // ── Import/Export ──
  const exportOntologyJSON = useCallback(async () => {
    setIsOperating(true);
    try {
      await downloadOntologyJSON(state.mapping);
      setToast({ msg: '数据成功导出为 JSON 文件', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (e: any) {
      setToast({ msg: '导出失败: ' + e.message, type: 'error' });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setIsOperating(false);
    }
  }, [state.mapping]);

  const importOntologyJSON = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsOperating(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.objectTypes || !data.objects) throw new Error('无效的本体论 JSON 格式');
      
      await importOntologyFromJSON(state.mapping, data);
      await store.refresh();
      setToast({ 
        msg: `成功导入：${(data.objects || []).length}个节点，${(data.links || []).length}个关系`, 
        type: 'success' 
      });
      setTimeout(() => setToast(null), 4000);
    } catch (err: any) {
      setToast({ msg: '导入失败: ' + err.message, type: 'error' });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setIsOperating(false);
    }
    e.target.value = '';
  }, [state.mapping, store]);

  // ── Stats ──
  const totalSchemaCount = state.objectTypes.length + (state.linkTypes || []).length;
  const matchedSchemaCount = filteredObjectTypes.length + filteredLinkTypes.length;
  const totalInstanceCount = state.objects.length + state.links.length + state.actions.length;
  const matchedInstanceCount = filteredObjects.length + filteredLinks.length + filteredActions.length;
  const totalReflectionCount = state.introspections.length + state.insights.length;
  const matchedReflectionCount = filteredIntrospections.length + filteredInsights.length;

  const selectionCount = getSelectionCount(selection);

  // ── Render ──
  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden" ref={listRef}>
      {/* Toast */}
      {toast && (
        <ToastNotification 
          message={toast.msg} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}

      {/* ── Header: Search & Actions ── */}
      <div className="px-3 py-2.5 shrink-0 border-b border-monokai-border flex items-center gap-2">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-monokai-comment" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索节点、关系..."
            className="w-full pl-8 pr-8 py-1.5 bg-monokai-surface border border-monokai-border rounded-lg text-xs text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-cyan transition-colors"
          />
          {search && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  const matchIds: (number | string)[] = [];
                  filteredObjects.forEach((o: any) => matchIds.push(`obj::${o.id}`));
                  filteredObjectTypes.forEach((ot: any) => matchIds.push(`type::${ot.id}`));
                  if (matchIds.length > 0) {
                    (window as any).__d3FocusNodes?.(matchIds);
                  }
                }}
                title="在右侧图谱中高亮所有搜索匹配项"
                className="p-1 text-monokai-cyan hover:bg-monokai-cyan/20 rounded transition-colors cursor-pointer"
              >
                <Target className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setSearch('')}
                className="p-1 text-monokai-comment hover:text-monokai-fg cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Type Filter (for Instances tab) */}
        {activeSubTab === 'instances' && (
          <TypeFilter
            objectTypes={state.objectTypes}
            selectedTypeId={filter.objectTypeId}
            onSelect={(typeId) => setFilter(f => ({ ...f, objectTypeId: typeId }))}
          />
        )}

        {/* Import/Export */}
        <IconButton
          icon={Upload}
          label="导入 JSON"
          size="sm"
          disabled={isOperating}
          onClick={importOntologyJSON}
        />
        <IconButton
          icon={Download}
          label="导出 JSON"
          size="sm"
          disabled={isOperating}
          onClick={exportOntologyJSON}
        />
      </div>

      {/* Hidden File Input */}
      <input 
        ref={fileInputRef} 
        type="file" 
        accept=".json" 
        className="hidden" 
        onChange={handleFileImport} 
      />

      {/* Operating Banner */}
      {isOperating && (
        <div className="px-3 py-1.5 shrink-0 bg-monokai-surface border-b border-monokai-border flex items-center gap-2 text-xs animate-in slide-in-from-top-2">
          <Loader2 className="w-3.5 h-3.5 text-monokai-cyan animate-spin" />
          <span className="text-monokai-comment">正在处理...</span>
        </div>
      )}

      {/* ── Batch Actions Bar (when selection > 0) ── */}
      {selectionCount > 0 && (
        <BatchActionsBar
          selectionCount={selectionCount}
          onDeleteSelected={handleBatchDelete}
          onClearSelection={clearSelection}
          onSelectAll={selectAllInCurrentTab}
        />
      )}

      {/* ── Sub-Tab Navigation ── */}
      <div className="px-3 py-2 shrink-0 border-b border-monokai-border bg-monokai-sidebar/40">
        <SegmentedTabs
          value={activeSubTab}
          onChange={(v) => setActiveSubTab(v as SubTab)}
          aria-label="实体分类视图"
          tone="cyan"
          size="sm"
          className="w-full"
          items={[
            { 
              value: 'schema', 
              label: '模式', 
              badge: search ? `${matchedSchemaCount}/${totalSchemaCount}` : totalSchemaCount 
            },
            { 
              value: 'instances', 
              label: '实例', 
              badge: search ? `${matchedInstanceCount}/${totalInstanceCount}` : totalInstanceCount 
            },
            { 
              value: 'reflection', 
              label: '沉思', 
              badge: search ? `${matchedReflectionCount}/${totalReflectionCount}` : totalReflectionCount 
            },
          ]}
        />
      </div>

      {/* ── Topology Quality Filters (Instances Tab Only) ── */}
      {activeSubTab === 'instances' && (
        <div className="px-3 py-1.5 shrink-0 bg-monokai-surface/40 border-b border-monokai-border/40 flex items-center justify-between gap-1 text-[11px] select-none">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-monokai-comment">拓扑特征:</span>
            <button
              type="button"
              onClick={() => setTopologyFilter('all')}
              className={`px-2 py-0.5 rounded text-[10.5px] transition-colors cursor-pointer ${
                topologyFilter === 'all'
                  ? 'bg-monokai-cyan/20 text-monokai-cyan font-bold border border-monokai-cyan/40'
                  : 'text-monokai-comment hover:text-white hover:bg-monokai-surface'
              }`}
            >
              全部 ({state.objects?.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setTopologyFilter('hub')}
              title="连接度 >= 3 的核心枢纽实体"
              className={`px-2 py-0.5 rounded text-[10.5px] transition-colors cursor-pointer ${
                topologyFilter === 'hub'
                  ? 'bg-monokai-yellow/20 text-monokai-yellow font-bold border border-monokai-yellow/40'
                  : 'text-monokai-comment hover:text-monokai-yellow hover:bg-monokai-surface'
              }`}
            >
              核心枢纽 ({Object.values(nodeDegreeMap).filter(d => d >= 3).length})
            </button>
            <button
              type="button"
              onClick={() => setTopologyFilter('orphan')}
              title="没有连接任何关系的孤立实体"
              className={`px-2 py-0.5 rounded text-[10.5px] transition-colors cursor-pointer ${
                topologyFilter === 'orphan'
                  ? 'bg-monokai-pink/20 text-monokai-pink font-bold border border-monokai-pink/40'
                  : 'text-monokai-comment hover:text-monokai-pink hover:bg-monokai-surface'
              }`}
            >
              孤立实体 ({(state.objects || []).filter(o => !nodeDegreeMap[o.id]).length})
            </button>
          </div>
          {filteredObjects.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if ((window as any).__d3FocusNodes) {
                  (window as any).__d3FocusNodes(filteredObjects.map((o: any) => o.id));
                }
              }}
              title="在右侧画布中框选定位当前筛选出的所有实体"
              className="px-2 py-0.5 rounded text-[10px] text-monokai-cyan hover:bg-monokai-cyan/20 border border-monokai-cyan/30 flex items-center gap-1 transition-colors cursor-pointer shrink-0"
            >
              <Eye className="w-3 h-3" />
              画布同频
            </button>
          )}
        </div>
      )}

      {/* ── Content Area ── */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-3 py-3 space-y-4">
        {/* Empty State */}
        {state.initState === 'no-tables' ? (
          <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl bg-monokai-sidebar/30">
            <AlertTriangle className="w-10 h-10 mb-4 text-monokai-orange opacity-40" />
            <p className="text-sm font-medium text-monokai-fg mb-4">知识图谱数据仓未链接</p>
            <button 
              onClick={() => store.initOntology()} 
              disabled={state.initting}
              className="px-6 py-2.5 text-sm font-medium rounded-xl bg-monokai-cyan/20 text-monokai-cyan hover:bg-monokai-cyan/30 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {state.initting ? '挂载中...' : '一键构建并挂载'}
            </button>
          </div>
        ) : (
          <>
            {/* ── Schema Tab ── */}
            {activeSubTab === 'schema' && (
              <div className="space-y-4 animate-in fade-in-50 duration-150">
                {/* Ⅰ. Object Types */}
                <div className="space-y-2">
                  <SectionHeader
                    title="对象类型"
                    icon={Layers}
                    count={state.objectTypes.length}
                    matchedCount={search ? filteredObjectTypes.length : undefined}
                    expanded={expanded.objectTypes}
                    onToggle={() => setExpanded(p => ({...p, objectTypes: !p.objectTypes}))}
                    onAdd={() => onInspect('objectType', null)}
                    color="cyan"
                    selectionCount={selection.objectTypes.size}
                    onClearSelection={() => setSelection(p => ({...p, objectTypes: new Set()}))}
                    onSelectAll={() => setSelection(p => ({...p, objectTypes: new Set(state.objectTypes.map((t: any) => t.id))}))}
                  />
                  {expanded.objectTypes && (
                    <div className="pl-2 space-y-1">
                      {filteredObjectTypes.length === 0 ? (
                        <p className="text-xs text-monokai-comment p-2 text-center">暂无匹配的对象类型</p>
                      ) : (
                        filteredObjectTypes.map((ot: any) => (
                          <EntityRow
                            key={ot.id}
                            id={ot.id}
                            name={ot.name}
                            description={ot.description}
                            query={search}
                            isSelected={selection.objectTypes.has(ot.id)}
                            isActive={activeEntity?.mode === 'objectType' && activeEntity?.id === ot.id}
                            dataEntityId={`objectType-${ot.id}`}
                            color="cyan"
                            onClick={() => handleInspectObjectType(ot)}
                            onSelect={(id, selected) => toggleSelection('objectTypes', id, selected)}
                            onDelete={() => onRequestDelete('objectType', ot.id, ot.name)}
                            onFocus={() => {
                              if ((window as any).__d3FocusNode) (window as any).__d3FocusNode(ot.id, 'typeHub');
                            }}
                            onHoverChange={(isHover) => {
                              if ((window as any).__d3HoverNode) (window as any).__d3HoverNode(ot.id, 'typeHub', isHover);
                            }}
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Ⅱ. Link Types */}
                <div className="space-y-2">
                  <SectionHeader
                    title="关系类型"
                    icon={Link2}
                    count={(state.linkTypes || []).length}
                    matchedCount={search ? filteredLinkTypes.length : undefined}
                    expanded={expanded.linkTypes}
                    onToggle={() => setExpanded(p => ({...p, linkTypes: !p.linkTypes}))}
                    onAdd={() => onInspect('linkType', null)}
                    color="green"
                    selectionCount={selection.linkTypes.size}
                    onClearSelection={() => setSelection(p => ({...p, linkTypes: new Set()}))}
                    onSelectAll={() => setSelection(p => ({...p, linkTypes: new Set((state.linkTypes || []).map((t: any) => t.id))}))}
                  />
                  {expanded.linkTypes && (
                    <div className="pl-2 space-y-1">
                      {filteredLinkTypes.length === 0 ? (
                        <p className="text-xs text-monokai-comment p-2 text-center">暂无匹配的关系类型</p>
                      ) : (
                        filteredLinkTypes.map((lt: any) => (
                          <EntityRow
                            key={lt.id}
                            id={lt.id}
                            name={lt.name}
                            description={lt.description}
                            query={search}
                            isSelected={selection.linkTypes.has(lt.id)}
                            isActive={activeEntity?.mode === 'linkType' && activeEntity?.id === lt.id}
                            dataEntityId={`linkType-${lt.id}`}
                            color="green"
                            onClick={() => handleInspectLinkType(lt)}
                            onSelect={(id, selected) => toggleSelection('linkTypes', id, selected)}
                            onDelete={() => onRequestDelete('linkType', lt.id, lt.name)}
                            onFocus={() => {
                              const matchingLinks = (state.links || []).filter((l: any) => l.link_type_id === lt.id);
                              if (matchingLinks.length > 0 && (window as any).__d3FocusLink) {
                                const first = matchingLinks[0];
                                (window as any).__d3FocusLink(first.id, first.source_object_id, first.target_object_id);
                              }
                            }}
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Instances Tab ── */}
            {activeSubTab === 'instances' && (
              <div className="space-y-4 animate-in fade-in-50 duration-150">
                {/* Ⅲ. Objects */}
                <div className="space-y-2">
                  <SectionHeader
                    title="结构化实例"
                    icon={Table2}
                    count={state.objects.length}
                    matchedCount={search || filter.objectTypeId ? filteredObjects.length : undefined}
                    expanded={expanded.objects}
                    onToggle={() => setExpanded(p => ({...p, objects: !p.objects}))}
                    onAdd={() => onInspect('object', null)}
                    color="cyan"
                    selectionCount={selection.objects.size}
                    onClearSelection={() => setSelection(p => ({...p, objects: new Set()}))}
                    onSelectAll={() => setSelection(p => ({...p, objects: new Set(filteredObjects.map((o: any) => o.id))}))}
                  />
                  {expanded.objects && (
                    <div className="pl-2 space-y-1">
                      {filteredObjects.length === 0 ? (
                        <p className="text-xs text-monokai-comment p-2 text-center">暂无匹配的实体实例</p>
                      ) : (
                        filteredObjects.map((obj: any) => (
                          <EntityRow
                            key={obj.id}
                            id={obj.id}
                            name={obj.name}
                            typeLabel={store.objectTypeMap[obj.object_type_id]?.name || '?'}
                            degreeBadge={nodeDegreeMap[obj.id]}
                            query={search}
                            isSelected={selection.objects.has(obj.id)}
                            isActive={activeEntity?.mode === 'object' && activeEntity?.id === obj.id}
                            dataEntityId={`object-${obj.id}`}
                            color="cyan"
                            onClick={() => handleInspectObject(obj)}
                            onSelect={(id, selected) => toggleSelection('objects', id, selected)}
                            onDelete={() => onRequestDelete('object', obj.id, obj.name)}
                            onFocus={() => {
                              if ((window as any).__d3FocusNode) (window as any).__d3FocusNode(obj.id, 'instance');
                            }}
                            onHoverChange={(isHover) => {
                              if ((window as any).__d3HoverNode) (window as any).__d3HoverNode(obj.id, 'instance', isHover);
                            }}
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Ⅳ. Links */}
                <div className="space-y-2">
                  <SectionHeader
                    title="拓扑关系"
                    icon={Link2}
                    count={state.links.length}
                    matchedCount={search ? filteredLinks.length : undefined}
                    expanded={expanded.links}
                    onToggle={() => setExpanded(p => ({...p, links: !p.links}))}
                    onAdd={() => onInspect('link', null)}
                    color="green"
                    selectionCount={selection.links.size}
                    onClearSelection={() => setSelection(p => ({...p, links: new Set()}))}
                    onSelectAll={() => setSelection(p => ({...p, links: new Set(filteredLinks.map((l: any) => l.id))}))}
                  />
                  {expanded.links && (
                    <div className="pl-2 space-y-1">
                      {filteredLinks.length === 0 ? (
                        <p className="text-xs text-monokai-comment p-2 text-center">暂无匹配的拓扑关系</p>
                      ) : (
                        filteredLinks.map((link: any) => (
                          <LinkRow
                            key={link.id}
                            id={link.id}
                            sourceName={store.objectNameMap[link.source_object_id] || ''}
                            linkTypeName={store.linkTypeMap[link.link_type_id]?.name || ''}
                            targetName={store.objectNameMap[link.target_object_id] || ''}
                            query={search}
                            isSelected={selection.links.has(link.id)}
                            isActive={activeEntity?.mode === 'link' && activeEntity?.id === link.id}
                            dataEntityId={`link-${link.id}`}
                            onClick={() => handleInspectLink(link)}
                            onSelect={(id, selected) => toggleSelection('links', id, selected)}
                            onDelete={() => onRequestDelete('link', link.id, `关系 #${link.id}`)}
                            onFocusLink={() => {
                              if ((window as any).__d3FocusLink) (window as any).__d3FocusLink(link.id, link.source_object_id, link.target_object_id);
                            }}
                            onFocusSource={() => {
                              if ((window as any).__d3FocusNode) (window as any).__d3FocusNode(link.source_object_id, 'instance');
                            }}
                            onFocusTarget={() => {
                              if ((window as any).__d3FocusNode) (window as any).__d3FocusNode(link.target_object_id, 'instance');
                            }}
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Ⅴ. Actions */}
                <div className="space-y-2">
                  <SectionHeader
                    title="逻辑驱动"
                    icon={Zap}
                    count={state.actions.length}
                    matchedCount={search ? filteredActions.length : undefined}
                    expanded={expanded.actions}
                    onToggle={() => setExpanded(p => ({...p, actions: !p.actions}))}
                    onAdd={() => onInspect('action', null)}
                    color="yellow"
                    selectionCount={selection.actions.size}
                    onClearSelection={() => setSelection(p => ({...p, actions: new Set()}))}
                    onSelectAll={() => setSelection(p => ({...p, actions: new Set(filteredActions.map((a: any) => a.id))}))}
                  />
                  {expanded.actions && (
                    <div className="pl-2 space-y-1">
                      {filteredActions.length === 0 ? (
                        <p className="text-xs text-monokai-comment p-2 text-center">暂无匹配的行动逻辑</p>
                      ) : (
                        filteredActions.map((action: any) => (
                          <EntityRow
                            key={action.id}
                            id={action.id}
                            name={action.name}
                            description={action.description}
                            query={search}
                            isSelected={selection.actions.has(action.id)}
                            isActive={activeEntity?.mode === 'action' && activeEntity?.id === action.id}
                            dataEntityId={`action-${action.id}`}
                            color="yellow"
                            onClick={() => handleInspectAction(action)}
                            onSelect={(id, selected) => toggleSelection('actions', id, selected)}
                            onDelete={() => onRequestDelete('action', action.id, action.name)}
                            onFocus={() => {
                              if ((window as any).__d3FocusNode) (window as any).__d3FocusNode(action.id, 'action');
                            }}
                            onHoverChange={(isHover) => {
                              if ((window as any).__d3HoverNode) (window as any).__d3HoverNode(action.id, 'action', isHover);
                            }}
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Reflection Tab ── */}
            {activeSubTab === 'reflection' && (
              <div className="space-y-4 animate-in fade-in-50 duration-150">
                {/* Ⅵ. Introspections */}
                <div className="space-y-2">
                  <SectionHeader
                    title="引导反思"
                    icon={Brain}
                    count={state.introspections.length}
                    matchedCount={search ? filteredIntrospections.length : undefined}
                    expanded={expanded.introspections}
                    onToggle={() => setExpanded(p => ({...p, introspections: !p.introspections}))}
                    onAdd={() => onInspect('introspection', null)}
                    color="pink"
                    selectionCount={selection.introspections.size}
                    onClearSelection={() => setSelection(p => ({...p, introspections: new Set()}))}
                    onSelectAll={() => setSelection(p => ({...p, introspections: new Set(filteredIntrospections.map((i: any) => i.id))}))}
                  />
                  {expanded.introspections && (
                    <div className="pl-2 space-y-1">
                      {filteredIntrospections.length === 0 ? (
                        <p className="text-xs text-monokai-comment p-2 text-center">暂无匹配的沉思记录</p>
                      ) : (
                        filteredIntrospections.map((intro: any) => (
                          <EntityRow
                            key={intro.id}
                            id={intro.id}
                            name={intro.question || '无标题'}
                            description={intro.answer}
                            query={search}
                            isSelected={selection.introspections.has(intro.id)}
                            isActive={activeEntity?.mode === 'introspection' && activeEntity?.id === intro.id}
                            dataEntityId={`introspection-${intro.id}`}
                            color="pink"
                            onClick={() => onInspect('introspection', intro)}
                            onSelect={(id, selected) => toggleSelection('introspections', id, selected)}
                            onDelete={() => onRequestDelete('introspection', intro.id, intro.question || `反思 #${intro.id}`)}
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Ⅶ. Insights */}
                <div className="space-y-2">
                  <SectionHeader
                    title="洞察记录"
                    icon={Lightbulb}
                    count={state.insights.length}
                    matchedCount={search ? filteredInsights.length : undefined}
                    expanded={expanded.insights}
                    onToggle={() => setExpanded(p => ({...p, insights: !p.insights}))}
                    onAdd={() => onInspect('insight', null)}
                    color="yellow"
                    selectionCount={selection.insights.size}
                    onClearSelection={() => setSelection(p => ({...p, insights: new Set()}))}
                    onSelectAll={() => setSelection(p => ({...p, insights: new Set(filteredInsights.map((i: any) => i.id))}))}
                  />
                  {expanded.insights && (
                    <div className="pl-2 space-y-1">
                      {filteredInsights.length === 0 ? (
                        <p className="text-xs text-monokai-comment p-2 text-center">暂无匹配的洞察记录</p>
                      ) : (
                        filteredInsights.map((insight: any) => (
                          <EntityRow
                            key={insight.id}
                            id={insight.id}
                            name={insight.insight || '无标题'}
                            typeLabel={insight.tag}
                            query={search}
                            isSelected={selection.insights.has(insight.id)}
                            isActive={activeEntity?.mode === 'insight' && activeEntity?.id === insight.id}
                            dataEntityId={`insight-${insight.id}`}
                            color="yellow"
                            onClick={() => onInspect('insight', insight)}
                            onSelect={(id, selected) => toggleSelection('insights', id, selected)}
                            onDelete={() => onRequestDelete('insight', insight.id, insight.insight || `洞察 #${insight.id}`)}
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Footer: Keyboard Shortcuts Hint ── */}
      <div className="px-3 py-2 border-t border-monokai-border/30 shrink-0">
        <div className="flex items-center justify-between text-[10px] text-monokai-comment/50">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-monokai-surface rounded text-[9px]">↑↓</kbd>
              导航
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-monokai-surface rounded text-[9px]">Space</kbd>
              选择
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-monokai-surface rounded text-[9px]">Ctrl+A</kbd>
              全选
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-monokai-surface rounded text-[9px]">Esc</kbd>
              清除
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CRUDList;
