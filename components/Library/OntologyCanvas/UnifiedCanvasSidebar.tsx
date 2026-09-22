/**
 * UnifiedCanvasSidebar - 统一画布侧边栏 (MECE优化版本)
 * 
 * MECE设计原则：
 * - Mutually Exclusive：每个Tab标签页功能独立
 * - Collectively Exhaustive：覆盖所有画布操作场景
 * 
 * 功能分层：
 * ┌──────────────────────────────────────────────────────────────┐
 * │ L1 选择 (Select)     - 节点/连线选择、筛选、统计           │
 * │ L2 编辑 (Edit)        - 批量重命名、移动、类型修改            │
 * │ L3 属性 (Properties) - 属性设置、添加、删除、替换           │
 * │ L4 图层 (Layers)     - MECE图层管理、可见性、锁定          │
 * │ L5 历史 (History)     - 操作历史、撤销、重做               │
 * └──────────────────────────────────────────────────────────────┘
 * 
 * 优化内容：
 * 1. 整合所有批量操作到一个组件
 * 2. 清晰的Tab切换
 * 3. 统一的UI风格
 * 4. 优化的交互体验
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  // 选择操作
  CheckSquare, Square, Filter, Search, X, ChevronDown, ChevronRight,
  // 编辑操作
  Edit3, Move, Type, Layers, Plus, Clipboard, Copy,
  // 属性操作
  Settings, Plus as AddIcon, Trash2, AlertTriangle,
  // 图层操作
  Eye, EyeOff, Lock, Unlock, FolderOpen, GripVertical,
  // 历史操作
  History, RotateCcw, RotateCw, Clock, Undo2, Redo2, SkipBack, SkipForward,
  // 导出操作
  Download, ChevronLeft, Check,
  // 辅助
  type LucideIcon,
} from 'lucide-react';

// ============================================================
// Types & Interfaces
// ============================================================

/** Tab类型 */
export type SidebarTab = 'select' | 'edit' | 'properties' | 'layers' | 'history';

/** 节点数据 */
export interface NodeData {
  id: number;
  name: string;
  typeId: number;
  typeName: string;
  position: { x: number; y: number };
  properties: Record<string, any>;
}

/** 图层数据 */
export interface LayerData {
  id: string;
  name: string;
  color: string;
  nodeIds: number[];
  isVisible: boolean;
  isLocked: boolean;
  isCollapsed: boolean;
  isSystem: boolean;
}

/** 历史记录条目 */
export interface HistoryEntry {
  id: string;
  description: string;
  timestamp: number;
  nodeCount: number;
  edgeCount: number;
  type: 'create' | 'update' | 'delete' | 'layout' | 'batch' | 'other';
  canUndo: boolean;
}

/** 统一侧边栏属性 */
export interface UnifiedCanvasSidebarProps {
  // 数据
  selectedNodes: NodeData[];
  allNodes: NodeData[];
  nodeTypes: Array<{ id: number; name: string }>;
  layers: LayerData[];
  historyEntries: HistoryEntry[];
  currentHistoryIndex: number;
  
  // 选择操作
  onSelectAll: () => void;
  onSelectInverse: () => void;
  onSelectByType: (typeIds: number[]) => void;
  onClearSelection: () => void;
  
  // 编辑操作
  onBatchRename: (nodeIds: number[], newName: string, mode: 'prefix' | 'suffix' | 'replace') => void;
  onBatchMove: (nodeIds: number[], offsetX: number, offsetY: number) => void;
  onBatchChangeType: (nodeIds: number[], newTypeId: number) => void;
  
  // 属性操作
  onUpdateNodesProperties: (nodeIds: number[], updates: {
    addProperties?: Record<string, any>;
    deleteProperties?: string[];
    replacePropertyValues?: { key: string; oldValue?: any; newValue: any }[];
  }) => Promise<void>;
  
  // 导出操作
  onExportSelected: (nodeIds: number[], format: 'json' | 'csv') => void;
  onCopyToClipboard: (nodeIds: number[]) => void;
  
  // 删除操作
  onBatchDelete: (nodeIds: number[]) => Promise<void>;
  
  // 图层操作
  onCreateLayer: (name: string, color: string) => void;
  onUpdateLayer: (id: string, updates: Partial<LayerData>) => void;
  onDeleteLayer: (id: string) => void;
  onAddNodesToLayer: (layerId: string, nodeIds: number[]) => void;
  onRemoveNodesFromLayer: (layerId: string, nodeIds: number[]) => void;
  
  // 历史操作
  onJumpToHistory: (index: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClearHistory: () => void;
  
  // Toast
  addToast?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  
  // 面板状态
  isOpen?: boolean;
  onToggle: () => void;
}

// ============================================================
// Constants
// ============================================================

/** Tab配置 */
const TAB_CONFIG: Array<{
  id: SidebarTab;
  label: string;
  icon: LucideIcon;
  color: string;
}> = [
  { id: 'select', label: '选择', icon: CheckSquare, color: '#66d9ef' },
  { id: 'edit', label: '编辑', icon: Edit3, color: '#a6e22e' },
  { id: 'properties', label: '属性', icon: Settings, color: '#e6db74' },
  { id: 'layers', label: '图层', icon: Layers, color: '#f92672' },
  { id: 'history', label: '历史', icon: History, color: '#ae81ff' },
];

/** 图层颜色选项 */
const LAYER_COLORS = [
  '#66d9ef', '#38bdf8', '#4ade80', '#fb923c',
  '#fbbf24', '#f472b6', '#a78bfa', '#f87171',
];

/** 历史类型配置 */
const HISTORY_TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  create: { color: '#10b981', label: '创建' },
  update: { color: '#3b82f6', label: '更新' },
  delete: { color: '#ef4444', label: '删除' },
  layout: { color: '#f59e0b', label: '布局' },
  batch: { color: '#8b5cf6', label: '批量' },
  other: { color: '#6b7280', label: '其他' },
};

// ============================================================
// Sub-Components
// ============================================================

/** Tab按钮 */
interface TabButtonProps {
  tab: typeof TAB_CONFIG[0];
  isActive: boolean;
  onClick: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ tab, isActive, onClick }) => {
  const Icon = tab.icon;
  return (
    <button
      onClick={onClick}
      className={`
        flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg
        border text-[10px] font-medium transition-all duration-150
        ${isActive
          ? 'border-current bg-monokai-surface'
          : 'border-transparent text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/50'
        }
      `}
      style={{ color: isActive ? tab.color : undefined }}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">{tab.label}</span>
    </button>
  );
};

/** 通用输入框 */
const InputField: React.FC<{
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'number';
}> = ({ label, value, onChange, placeholder, type = 'text' }) => (
  <div className="mb-2">
    <label className="block text-[10px] text-monokai-comment mb-1">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-2.5 py-1.5 text-[11px] bg-monokai-bg border border-monokai-border rounded-lg
        text-monokai-fg placeholder-monokai-comment/60 focus:outline-none focus:border-monokai-accent"
    />
  </div>
);

/** 按钮组件 */
const ActionButton: React.FC<{
  icon?: LucideIcon;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'primary' | 'danger' | 'success';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}> = ({ icon: Icon, label, onClick, variant = 'default', disabled, loading, className = '' }) => {
  const variantClasses = {
    default: 'bg-monokai-surface border border-monokai-border text-monokai-fg hover:border-monokai-accent',
    primary: 'bg-monokai-accent text-monokai-bg border border-monokai-accent/30 hover:brightness-110',
    danger: 'bg-monokai-danger/10 border border-monokai-danger/30 text-monokai-danger hover:bg-monokai-danger/20',
    success: 'bg-monokai-green/15 border border-monokai-green/30 text-monokai-green',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg
        text-[10px] font-medium transition-all duration-150
        disabled:opacity-40 disabled:cursor-not-allowed
        ${variantClasses[variant]} ${className}
      `}
    >
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </button>
  );
};

/** ============================================================
 * 选择标签页内容
 * ============================================================ */
interface SelectTabContentProps {
  selectedNodes: NodeData[];
  allNodes: NodeData[];
  nodeTypes: Array<{ id: number; name: string }>;
  onSelectAll: () => void;
  onSelectInverse: () => void;
  onSelectByType: (typeIds: number[]) => void;
  onClearSelection: () => void;
  addToast?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const SelectTabContent: React.FC<SelectTabContentProps> = ({
  selectedNodes,
  allNodes,
  nodeTypes,
  onSelectAll,
  onSelectInverse,
  onSelectByType,
  onClearSelection,
  addToast,
}) => {
  const [selectedTypeIds, setSelectedTypeIds] = useState<number[]>([]);
  const [showTypeSelector, setShowTypeSelector] = useState(false);

  const toggleType = (typeId: number) => {
    setSelectedTypeIds(prev =>
      prev.includes(typeId) ? prev.filter(id => id !== typeId) : [...prev, typeId]
    );
  };

  const handleTypeSelect = () => {
    if (selectedTypeIds.length === 0) {
      addToast?.('请选择至少一种类型', 'warning');
      return;
    }
    onSelectByType(selectedTypeIds);
    setSelectedTypeIds([]);
    setShowTypeSelector(false);
    addToast?.(`已选择 ${selectedNodes.length} 个节点`, 'info');
  };

  return (
    <div className="space-y-3">
      {/* 统计信息 */}
      <div className="flex items-center justify-between p-2 bg-monokai-bg/50 rounded-lg">
        <span className="text-[10px] text-monokai-comment">
          选中 <span className="text-monokai-accent font-bold">{selectedNodes.length}</span> 个节点
        </span>
        <span className="text-[10px] text-monokai-comment">
          共 <span className="font-medium">{allNodes.length}</span> 个
        </span>
      </div>

      {/* 快速操作 */}
      <div className="grid grid-cols-3 gap-1.5">
        <ActionButton icon={CheckSquare} label="全选" onClick={onSelectAll} />
        <ActionButton icon={Square} label="反选" onClick={onSelectInverse} />
        <ActionButton icon={X} label="清空" onClick={onClearSelection} disabled={selectedNodes.length === 0} />
      </div>

      {/* 按类型选择 */}
      <div className="border-t border-monokai-border pt-3">
        <button
          onClick={() => setShowTypeSelector(!showTypeSelector)}
          className="w-full flex items-center justify-between px-3 py-2 bg-monokai-bg rounded-lg border border-monokai-border hover:border-monokai-accent transition-colors"
        >
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-monokai-comment" />
            <span className="text-[10px] text-monokai-fg">按类型选择</span>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-monokai-comment transition-transform ${showTypeSelector ? 'rotate-180' : ''}`} />
        </button>

        {showTypeSelector && (
          <div className="mt-2 p-2 bg-monokai-bg/50 rounded-lg space-y-1">
            {nodeTypes.map(type => (
              <button
                key={type.id}
                onClick={() => toggleType(type.id)}
                className={`
                  w-full flex items-center justify-between px-2 py-1.5 rounded text-[10px] transition-colors
                  ${selectedTypeIds.includes(type.id)
                    ? 'bg-monokai-accent/15 text-monokai-accent'
                    : 'text-monokai-fg hover:bg-monokai-surface'
                  }
                `}
              >
                <span>{type.name}</span>
                <span className="text-monokai-comment">
                  {allNodes.filter(n => n.typeId === type.id).length}
                </span>
              </button>
            ))}
            <button
              onClick={handleTypeSelect}
              disabled={selectedTypeIds.length === 0}
              className="w-full mt-2 px-2 py-1.5 bg-monokai-accent text-monokai-bg rounded text-[10px] font-medium hover:brightness-110 disabled:opacity-40"
            >
              选择 {selectedTypeIds.length > 0 ? allNodes.filter(n => selectedTypeIds.includes(n.typeId)).length : 0} 个
            </button>
          </div>
        )}
      </div>

      {/* 节点列表 */}
      {selectedNodes.length > 0 && (
        <div className="border-t border-monokai-border pt-3">
          <div className="text-[10px] text-monokai-comment mb-2">已选节点</div>
          <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
            {selectedNodes.slice(0, 20).map(node => (
              <div
                key={node.id}
                className="flex items-center gap-2 px-2 py-1.5 bg-monokai-bg/50 rounded text-[10px]"
              >
                <div className="w-5 h-5 rounded bg-monokai-accent/20 flex items-center justify-center text-[8px] text-monokai-accent font-bold">
                  {node.name.charAt(0).toUpperCase()}
                </div>
                <span className="flex-1 truncate text-monokai-fg">{node.name}</span>
                <span className="text-monokai-comment">{node.typeName}</span>
              </div>
            ))}
            {selectedNodes.length > 20 && (
              <div className="text-center text-[10px] text-monokai-comment py-1">
                还有 {selectedNodes.length - 20} 个...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/** ============================================================
 * 编辑标签页内容
 * ============================================================ */
interface EditTabContentProps {
  selectedNodes: NodeData[];
  nodeTypes: Array<{ id: number; name: string }>;
  onBatchRename: (nodeIds: number[], newName: string, mode: 'prefix' | 'suffix' | 'replace') => void;
  onBatchMove: (nodeIds: number[], offsetX: number, offsetY: number) => void;
  onBatchChangeType: (nodeIds: number[], newTypeId: number) => void;
  addToast?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const EditTabContent: React.FC<EditTabContentProps> = ({
  selectedNodes,
  nodeTypes,
  onBatchRename,
  onBatchMove,
  onBatchChangeType,
  addToast,
}) => {
  const [activeEdit, setActiveEdit] = useState<'rename' | 'move' | 'type'>('rename');
  
  // 重命名状态
  const [renameMode, setRenameMode] = useState<'prefix' | 'suffix' | 'replace'>('prefix');
  const [renameValue, setRenameValue] = useState('');
  
  // 移动状态
  const [moveX, setMoveX] = useState(0);
  const [moveY, setMoveY] = useState(0);
  
  // 类型状态
  const [newTypeId, setNewTypeId] = useState<number>(0);

  const handleRename = () => {
    if (!renameValue.trim() && renameMode !== 'replace') {
      addToast?.('请输入名称', 'warning');
      return;
    }
    const nodeIds = selectedNodes.map(n => n.id);
    onBatchRename(nodeIds, renameValue.trim(), renameMode);
    setRenameValue('');
    addToast?.(`已重命名 ${nodeIds.length} 个节点`, 'success');
  };

  const handleMove = () => {
    if (moveX === 0 && moveY === 0) {
      addToast?.('偏移量不能为零', 'warning');
      return;
    }
    const nodeIds = selectedNodes.map(n => n.id);
    onBatchMove(nodeIds, moveX, moveY);
    setMoveX(0);
    setMoveY(0);
    addToast?.(`已将 ${nodeIds.length} 个节点移动`, 'success');
  };

  const handleChangeType = () => {
    if (!newTypeId) {
      addToast?.('请选择类型', 'warning');
      return;
    }
    const nodeIds = selectedNodes.map(n => n.id);
    onBatchChangeType(nodeIds, newTypeId);
    setNewTypeId(0);
    addToast?.(`已修改 ${nodeIds.length} 个节点的类型`, 'success');
  };

  if (selectedNodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Edit3 className="w-8 h-8 text-monokai-comment/30 mb-2" />
        <p className="text-[10px] text-monokai-comment">请先选择要编辑的节点</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 操作选择 */}
      <div className="flex gap-1">
        {(['rename', 'move', 'type'] as const).map(op => (
          <button
            key={op}
            onClick={() => setActiveEdit(op)}
            className={`
              flex-1 px-2 py-1.5 rounded-lg text-[10px] font-medium border transition-all
              ${activeEdit === op
                ? 'bg-monokai-accent/15 border-monokai-accent/40 text-monokai-accent'
                : 'border-monokai-border text-monokai-comment hover:text-monokai-fg'
              }
            `}
          >
            {op === 'rename' ? '重命名' : op === 'move' ? '移动' : '类型'}
          </button>
        ))}
      </div>

      {/* 重命名 */}
      {activeEdit === 'rename' && (
        <div className="space-y-2">
          <div className="flex gap-1">
            {(['prefix', 'suffix', 'replace'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setRenameMode(mode)}
                className={`
                  flex-1 px-2 py-1 text-[9px] rounded border transition-all
                  ${renameMode === mode
                    ? 'bg-monokai-accent/15 border-monokai-accent/40 text-monokai-accent'
                    : 'border-monokai-border text-monokai-comment hover:text-monokai-fg'
                  }
                `}
              >
                {mode === 'prefix' ? '前缀' : mode === 'suffix' ? '后缀' : '替换'}
              </button>
            ))}
          </div>
          <InputField
            label={renameMode === 'replace' ? '新名称' : '名称'}
            value={renameValue}
            onChange={setRenameValue}
            placeholder={renameMode === 'replace' ? '输入新名称...' : '输入名称...'}
          />
          <ActionButton label="确认重命名" onClick={handleRename} variant="primary" />
        </div>
      )}

      {/* 移动 */}
      {activeEdit === 'move' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <InputField label="X偏移" value={moveX} onChange={v => setMoveX(parseInt(v) || 0)} type="number" />
            <InputField label="Y偏移" value={moveY} onChange={v => setMoveY(parseInt(v) || 0)} type="number" />
          </div>
          <div className="flex gap-1">
            {[
              { label: '←50', x: -50, y: 0 },
              { label: '→50', x: 50, y: 0 },
              { label: '↑50', x: 0, y: -50 },
              { label: '↓50', x: 0, y: 50 },
            ].map(preset => (
              <button
                key={preset.label}
                onClick={() => { setMoveX(preset.x); setMoveY(preset.y); }}
                className="flex-1 px-1 py-1 text-[9px] bg-monokai-bg border border-monokai-border rounded hover:border-monokai-accent"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <ActionButton label="确认移动" onClick={handleMove} variant="primary" />
        </div>
      )}

      {/* 类型 */}
      {activeEdit === 'type' && (
        <div className="space-y-2">
          <div className="mb-2">
            <label className="block text-[10px] text-monokai-comment mb-1">选择新类型</label>
            <select
              value={newTypeId}
              onChange={e => setNewTypeId(parseInt(e.target.value) || 0)}
              className="w-full px-2.5 py-1.5 text-[11px] bg-monokai-bg border border-monokai-border rounded-lg text-monokai-fg"
            >
              <option value={0}>选择类型...</option>
              {nodeTypes.map(type => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
          </div>
          <ActionButton label="确认修改" onClick={handleChangeType} variant="primary" disabled={!newTypeId} />
        </div>
      )}
    </div>
  );
};

/** ============================================================
 * 属性标签页内容
 * ============================================================ */
interface PropertiesTabContentProps {
  selectedNodes: NodeData[];
  onUpdateNodesProperties: (nodeIds: number[], updates: {
    addProperties?: Record<string, any>;
    deleteProperties?: string[];
    replacePropertyValues?: { key: string; oldValue?: any; newValue: any }[];
  }) => Promise<void>;
  addToast?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const PropertiesTabContent: React.FC<PropertiesTabContentProps> = ({
  selectedNodes,
  onUpdateNodesProperties,
  addToast,
}) => {
  const [activeOp, setActiveOp] = useState<'set' | 'add' | 'delete' | 'replace'>('set');
  const [propertyKey, setPropertyKey] = useState('');
  const [propertyValue, setPropertyValue] = useState('');
  const [oldValue, setOldValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // 收集所有属性键
  const allPropertyKeys = useMemo(() => {
    const keys = new Set<string>();
    selectedNodes.forEach(node => {
      Object.keys(node.properties).forEach(key => keys.add(key));
    });
    return Array.from(keys).sort();
  }, [selectedNodes]);

  const handleConfirm = async () => {
    if (activeOp !== 'delete' && (!propertyKey.trim() || !propertyValue.trim())) {
      addToast?.('请输入属性名和值', 'warning');
      return;
    }
    if (activeOp === 'delete' && !propertyKey) {
      addToast?.('请选择要删除的属性', 'warning');
      return;
    }

    setIsProcessing(true);
    try {
      const nodeIds = selectedNodes.map(n => n.id);
      let parsedValue: any = propertyValue;
      if (!isNaN(Number(propertyValue))) parsedValue = Number(propertyValue);
      else if (propertyValue.toLowerCase() === 'true') parsedValue = true;
      else if (propertyValue.toLowerCase() === 'false') parsedValue = false;

      if (activeOp === 'set' || activeOp === 'add') {
        await onUpdateNodesProperties(nodeIds, { addProperties: { [propertyKey.trim()]: parsedValue } });
        addToast?.(`已为 ${nodeIds.length} 个节点设置属性`, 'success');
      } else if (activeOp === 'delete') {
        await onUpdateNodesProperties(nodeIds, { deleteProperties: [propertyKey] });
        addToast?.(`已删除属性 "${propertyKey}"`, 'success');
      } else if (activeOp === 'replace') {
        await onUpdateNodesProperties(nodeIds, {
          replacePropertyValues: [{ key: propertyKey, oldValue: oldValue || undefined, newValue: parsedValue }]
        });
        addToast?.(`已替换属性值`, 'success');
      }

      setPropertyKey('');
      setPropertyValue('');
      setOldValue('');
    } catch {
      addToast?.('操作失败', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  if (selectedNodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Settings className="w-8 h-8 text-monokai-comment/30 mb-2" />
        <p className="text-[10px] text-monokai-comment">请先选择要编辑属性的节点</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 操作选择 */}
      <div className="flex flex-wrap gap-1">
        {(['set', 'add', 'delete', 'replace'] as const).map(op => (
          <button
            key={op}
            onClick={() => setActiveOp(op)}
            className={`
              px-2 py-1 rounded text-[9px] font-medium border transition-all
              ${activeOp === op
                ? 'bg-monokai-accent/15 border-monokai-accent/40 text-monokai-accent'
                : 'border-monokai-border text-monokai-comment hover:text-monokai-fg'
              }
            `}
          >
            {op === 'set' ? '设置' : op === 'add' ? '添加' : op === 'delete' ? '删除' : '替换'}
          </button>
        ))}
      </div>

      {/* 属性名 */}
      {activeOp !== 'delete' ? (
        <InputField label="属性名称" value={propertyKey} onChange={setPropertyKey} placeholder="输入属性名..." />
      ) : (
        <div className="mb-2">
          <label className="block text-[10px] text-monokai-comment mb-1">选择属性</label>
          <select
            value={propertyKey}
            onChange={e => setPropertyKey(e.target.value)}
            className="w-full px-2.5 py-1.5 text-[11px] bg-monokai-bg border border-monokai-border rounded-lg text-monokai-fg"
          >
            <option value="">选择属性...</option>
            {allPropertyKeys.map(key => (
              <option key={key} value={key}>{key}</option>
            ))}
          </select>
        </div>
      )}

      {/* 属性值 */}
      {activeOp !== 'delete' && (
        <>
          <InputField label="属性值" value={propertyValue} onChange={setPropertyValue} placeholder="输入属性值..." />
          {activeOp === 'replace' && (
            <InputField label="原值(可选)" value={oldValue} onChange={setOldValue} placeholder="留空匹配所有..." />
          )}
        </>
      )}

      <ActionButton
        label={isProcessing ? '处理中...' : '确认操作'}
        onClick={handleConfirm}
        variant="primary"
        loading={isProcessing}
        disabled={isProcessing || (activeOp !== 'delete' && (!propertyKey.trim() || !propertyValue.trim()))}
      />
    </div>
  );
};

/** ============================================================
 * 图层标签页内容
 * ============================================================ */
interface LayersTabContentProps {
  layers: LayerData[];
  onCreateLayer: (name: string, color: string) => void;
  onUpdateLayer: (id: string, updates: Partial<LayerData>) => void;
  onDeleteLayer: (id: string) => void;
  onAddNodesToLayer: (layerId: string, nodeIds: number[]) => void;
  onRemoveNodesFromLayer: (layerId: string, nodeIds: number[]) => void;
  selectedNodes: NodeData[];
  addToast?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const LayersTabContent: React.FC<LayersTabContentProps> = ({
  layers,
  onCreateLayer,
  onUpdateLayer,
  onDeleteLayer,
  onAddNodesToLayer,
  onRemoveNodesFromLayer,
  selectedNodes,
  addToast,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newLayerName, setNewLayerName] = useState('');
  const [newLayerColor, setNewLayerColor] = useState(LAYER_COLORS[0]);

  const handleCreate = () => {
    if (!newLayerName.trim()) {
      addToast?.('请输入图层名称', 'warning');
      return;
    }
    onCreateLayer(newLayerName.trim(), newLayerColor);
    setNewLayerName('');
    setNewLayerColor(LAYER_COLORS[0]);
    setIsCreating(false);
    addToast?.(`已创建图层 "${newLayerName.trim()}"`, 'success');
  };

  return (
    <div className="space-y-3">
      {/* 创建新图层 */}
      {isCreating ? (
        <div className="p-2 bg-monokai-bg/50 rounded-lg space-y-2">
          <input
            type="text"
            value={newLayerName}
            onChange={e => setNewLayerName(e.target.value)}
            placeholder="图层名称..."
            className="w-full px-2 py-1.5 text-[11px] bg-monokai-bg border border-monokai-border rounded-lg text-monokai-fg"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-monokai-comment">颜色:</span>
            <div className="flex gap-1">
              {LAYER_COLORS.slice(0, 6).map(color => (
                <button
                  key={color}
                  onClick={() => setNewLayerColor(color)}
                  className={`w-4 h-4 rounded-full transition-transform ${newLayerColor === color ? 'ring-2 ring-white scale-110' : ''}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setIsCreating(false)} className="flex-1 px-2 py-1 text-[10px] text-monokai-comment hover:text-monokai-fg">
              取消
            </button>
            <button onClick={handleCreate} className="flex-1 px-2 py-1 bg-monokai-accent text-monokai-bg rounded text-[10px] font-medium">
              创建
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsCreating(true)}
          className="w-full flex items-center justify-center gap-1 px-3 py-2 bg-monokai-bg rounded-lg border border-monokai-border hover:border-monokai-accent transition-colors"
        >
          <Plus className="w-3.5 h-3.5 text-monokai-comment" />
          <span className="text-[10px] text-monokai-comment">新建图层</span>
        </button>
      )}

      {/* 图层列表 */}
      <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
        {layers.map(layer => (
          <div
            key={layer.id}
            className={`
              p-2 rounded-lg border transition-all
              ${layer.isVisible ? 'border-monokai-border bg-monokai-surface/50' : 'border-monokai-border/50 bg-monokai-bg/30 opacity-60'}
            `}
          >
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: layer.color }} />
              <span className="flex-1 text-[10px] text-monokai-fg truncate">{layer.name}</span>
              <span className="text-[9px] text-monokai-comment">{layer.nodeIds.length}</span>
              <button
                onClick={() => onUpdateLayer(layer.id, { isVisible: !layer.isVisible })}
                className="p-1 text-monokai-comment hover:text-monokai-fg"
              >
                {layer.isVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              </button>
              <button
                onClick={() => onUpdateLayer(layer.id, { isLocked: !layer.isLocked })}
                className={`p-1 ${layer.isLocked ? 'text-monokai-yellow' : 'text-monokai-comment hover:text-monokai-fg'}`}
              >
                {layer.isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
              </button>
            </div>
          </div>
        ))}
      </div>

      {layers.length === 0 && !isCreating && (
        <div className="text-center py-4">
          <Layers className="w-6 h-6 text-monokai-comment/30 mx-auto mb-1" />
          <p className="text-[10px] text-monokai-comment">暂无图层</p>
        </div>
      )}
    </div>
  );
};

/** ============================================================
 * 历史标签页内容
 * ============================================================ */
interface HistoryTabContentProps {
  entries: HistoryEntry[];
  currentIndex: number;
  onJumpTo: (index: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
}

const HistoryTabContent: React.FC<HistoryTabContentProps> = ({
  entries,
  currentIndex,
  onJumpTo,
  onUndo,
  onRedo,
  onClear,
}) => {
  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-3">
      {/* 快速操作 */}
      <div className="flex gap-1">
        <ActionButton icon={Undo2} label="撤销" onClick={onUndo} disabled={currentIndex <= 0} />
        <ActionButton icon={Redo2} label="重做" onClick={onRedo} disabled={currentIndex >= entries.length - 1} />
      </div>

      {/* 统计 */}
      <div className="flex items-center justify-between text-[10px] text-monokai-comment">
        <span>可撤销: <span className="text-monokai-green">{currentIndex + 1}</span></span>
        <span>可重做: <span className="text-monokai-orange">{entries.length - currentIndex - 1}</span></span>
        {entries.length > 0 && (
          <button onClick={onClear} className="text-monokai-danger hover:underline">清空</button>
        )}
      </div>

      {/* 历史列表 */}
      <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar">
        {entries.map((entry, index) => {
          const typeConfig = HISTORY_TYPE_CONFIG[entry.type] || HISTORY_TYPE_CONFIG.other;
          const isCurrent = index === currentIndex;
          const isPast = index < currentIndex;

          return (
            <button
              key={entry.id}
              onClick={() => onJumpTo(index)}
              className={`
                w-full flex items-start gap-2 p-2 rounded-lg border transition-all text-left
                ${isCurrent
                  ? 'border-monokai-accent/30 bg-monokai-accent/5'
                  : isPast
                    ? 'border-transparent bg-monokai-surface/30 opacity-70'
                    : 'border-monokai-border bg-monokai-surface/50'
                }
              `}
            >
              <div
                className="w-6 h-6 rounded flex items-center justify-center shrink-0 mt-0.5"
                style={{ backgroundColor: `${typeConfig.color}20`, color: typeConfig.color }}
              >
                <span className="text-[8px] font-bold">{entry.type.charAt(0).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-monokai-fg truncate">{entry.description}</div>
                <div className="flex items-center gap-2 text-[9px] text-monokai-comment mt-0.5">
                  <span>{formatTime(entry.timestamp)}</span>
                  <span>{entry.nodeCount}节点</span>
                </div>
              </div>
              {isCurrent && (
                <div className="w-1 h-5 bg-monokai-accent rounded-full shrink-0 mt-1" />
              )}
            </button>
          );
        })}
      </div>

      {entries.length === 0 && (
        <div className="text-center py-4">
          <History className="w-6 h-6 text-monokai-comment/30 mx-auto mb-1" />
          <p className="text-[10px] text-monokai-comment">暂无历史记录</p>
        </div>
      )}
    </div>
  );
};

// ============================================================
// Main Component
// ============================================================

export const UnifiedCanvasSidebar: React.FC<UnifiedCanvasSidebarProps> = ({
  selectedNodes,
  allNodes,
  nodeTypes,
  layers,
  historyEntries,
  currentHistoryIndex,
  onSelectAll,
  onSelectInverse,
  onSelectByType,
  onClearSelection,
  onBatchRename,
  onBatchMove,
  onBatchChangeType,
  onUpdateNodesProperties,
  onExportSelected,
  onCopyToClipboard,
  onBatchDelete,
  onCreateLayer,
  onUpdateLayer,
  onDeleteLayer,
  onAddNodesToLayer,
  onRemoveNodesFromLayer,
  onJumpToHistory,
  onUndo,
  onRedo,
  onClearHistory,
  addToast,
  isOpen = true,
  onToggle,
}) => {
  const [activeTab, setActiveTab] = useState<SidebarTab>('select');
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // 导出状态
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  
  // 删除确认
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const handleExport = () => {
    const nodeIds = selectedNodes.map(n => n.id);
    onExportSelected(nodeIds, exportFormat);
    addToast?.(`已导出 ${nodeIds.length} 个节点`, 'success');
  };

  const handleCopy = () => {
    const nodeIds = selectedNodes.map(n => n.id);
    onCopyToClipboard(nodeIds);
    addToast?.(`已复制 ${nodeIds.length} 个节点`, 'success');
  };

  const handleDelete = async () => {
    if (deleteConfirmText !== 'DELETE') {
      addToast?.('请输入 DELETE 确认删除', 'warning');
      return;
    }
    const nodeIds = selectedNodes.map(n => n.id);
    await onBatchDelete(nodeIds);
    addToast?.(`已删除 ${nodeIds.length} 个节点`, 'success');
    setDeleteConfirmText('');
  };

  // 折叠状态显示
  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="absolute left-3 top-[72px] z-20 flex items-center gap-2 px-3 py-2 
          bg-monokai-sidebar/95 backdrop-blur-md border border-monokai-border rounded-xl
          text-[10px] text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface
          transition-all shadow-lg"
      >
        <ChevronLeft className="w-4 h-4 text-monokai-accent rotate-180" />
        <span>侧边栏</span>
      </button>
    );
  }

  return (
    <div className={`
      absolute left-3 top-[72px] z-20 flex flex-col
      bg-monokai-sidebar/95 backdrop-blur-md border border-monokai-border rounded-xl 
      shadow-xl overflow-hidden transition-all duration-300
      ${isCollapsed ? 'w-12' : 'w-72'}
    `}>
      {/* 头部 */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-monokai-border shrink-0">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-monokai-accent" />
            <span className="text-[10px] font-semibold text-monokai-fg">工具</span>
            {selectedNodes.length > 0 && (
              <span className="text-[9px] bg-monokai-accent/20 text-monokai-accent px-1.5 py-0.5 rounded">
                {selectedNodes.length}
              </span>
            )}
          </div>
        )}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsCollapsed(v => !v)}
            className="p-1 text-monokai-comment hover:text-monokai-fg transition-colors"
            title={isCollapsed ? '展开' : '折叠'}
          >
            <ChevronLeft className={`w-4 h-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
          </button>
          <button
            onClick={onToggle}
            className="p-1 text-monokai-comment hover:text-monokai-fg transition-colors"
            title="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Tab切换 */}
      {!isCollapsed && (
        <div className="flex gap-0.5 p-1.5 border-b border-monokai-border bg-monokai-bg/30 shrink-0">
          {TAB_CONFIG.map(tab => (
            <TabButton
              key={tab.id}
              tab={tab}
              isActive={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            />
          ))}
        </div>
      )}
      
      {/* 内容区域 */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto p-2.5 custom-scrollbar">
          {activeTab === 'select' && (
            <SelectTabContent
              selectedNodes={selectedNodes}
              allNodes={allNodes}
              nodeTypes={nodeTypes}
              onSelectAll={onSelectAll}
              onSelectInverse={onSelectInverse}
              onSelectByType={onSelectByType}
              onClearSelection={onClearSelection}
              addToast={addToast}
            />
          )}
          
          {activeTab === 'edit' && (
            <EditTabContent
              selectedNodes={selectedNodes}
              nodeTypes={nodeTypes}
              onBatchRename={onBatchRename}
              onBatchMove={onBatchMove}
              onBatchChangeType={onBatchChangeType}
              addToast={addToast}
            />
          )}
          
          {activeTab === 'properties' && (
            <PropertiesTabContent
              selectedNodes={selectedNodes}
              onUpdateNodesProperties={onUpdateNodesProperties}
              addToast={addToast}
            />
          )}
          
          {activeTab === 'layers' && (
            <LayersTabContent
              layers={layers}
              onCreateLayer={onCreateLayer}
              onUpdateLayer={onUpdateLayer}
              onDeleteLayer={onDeleteLayer}
              onAddNodesToLayer={onAddNodesToLayer}
              onRemoveNodesFromLayer={onRemoveNodesFromLayer}
              selectedNodes={selectedNodes}
              addToast={addToast}
            />
          )}
          
          {activeTab === 'history' && (
            <HistoryTabContent
              entries={historyEntries}
              currentIndex={currentHistoryIndex}
              onJumpTo={onJumpToHistory}
              onUndo={onUndo}
              onRedo={onRedo}
              onClear={onClearHistory}
            />
          )}
        </div>
      )}
      
      {/* 底部操作栏 */}
      {!isCollapsed && selectedNodes.length > 0 && (
        <div className="px-2 py-2 border-t border-monokai-border bg-monokai-bg/50 shrink-0 space-y-2">
          {/* 导出格式 */}
          <div className="flex gap-1">
            <button
              onClick={() => setExportFormat('json')}
              className={`flex-1 px-2 py-1 text-[9px] rounded border transition-all ${exportFormat === 'json' ? 'bg-monokai-accent/15 border-monokai-accent/40 text-monokai-accent' : 'border-monokai-border text-monokai-comment'}`}
            >
              JSON
            </button>
            <button
              onClick={() => setExportFormat('csv')}
              className={`flex-1 px-2 py-1 text-[9px] rounded border transition-all ${exportFormat === 'csv' ? 'bg-monokai-accent/15 border-monokai-accent/40 text-monokai-accent' : 'border-monokai-border text-monokai-comment'}`}
            >
              CSV
            </button>
          </div>
          
          <div className="flex gap-1">
            <ActionButton icon={Download} label="导出" onClick={handleExport} variant="primary" />
            <ActionButton icon={Clipboard} label="复制" onClick={handleCopy} />
          </div>
          
          {/* 删除确认 */}
          {deleteConfirmText ? (
            <div className="space-y-1">
              <input
                type="text"
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder="输入 DELETE 确认"
                className="w-full px-2 py-1 text-[10px] bg-monokai-bg border border-monokai-danger/50 rounded text-monokai-fg"
              />
              <div className="flex gap-1">
                <button
                  onClick={() => setDeleteConfirmText('')}
                  className="flex-1 px-2 py-1 text-[10px] text-monokai-comment hover:text-monokai-fg"
                >
                  取消
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-2 py-1 text-[10px] bg-monokai-danger text-white rounded"
                >
                  确认删除
                </button>
              </div>
            </div>
          ) : (
            <ActionButton icon={Trash2} label="删除" onClick={() => setDeleteConfirmText('DELETE')} variant="danger" />
          )}
        </div>
      )}
      
      {/* 快捷键提示 */}
      {!isCollapsed && (
        <div className="px-2 py-1.5 border-t border-monokai-border bg-monokai-bg/30 shrink-0">
          <p className="text-[9px] text-monokai-comment text-center">
            Ctrl+A 全选 | Delete 删除 | Ctrl+C 复制
          </p>
        </div>
      )}
    </div>
  );
};

export default UnifiedCanvasSidebar;
