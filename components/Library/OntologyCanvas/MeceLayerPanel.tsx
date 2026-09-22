/**
 * MeceLayerPanel - MECE图层分组面板
 * 
 * MECE (Mutually Exclusive, Collectively Exhaustive) 设计原则：
 * - 互斥性：每个实体只能属于一个图层
 * - 穷尽性：所有实体都被图层覆盖
 * 
 * 功能：
 * - 按实体类型自动分组
 * - 手动创建自定义图层
 * - 图层折叠/展开
 * - 图层可见性切换
 * - 图层锁定
 * - 拖拽节点到图层
 * 
 * 预设MECE分类：
 * 1. Foundation (基础层) - #66d9ef - 核心基础设施
 * 2. Relations (关系层) - #38bdf8 - 关系和连接
 * 3. Methodology (方法层) - #4ade80 - 流程和方法
 * 4. Patterns (模式层) - #fb923c - 设计模式和最佳实践
 * 5. Domains (领域层) - #fbbf24 - 特定领域知识
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Layers,
  ChevronRight,
  ChevronDown,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Plus,
  MoreHorizontal,
  Edit3,
  Trash2,
  FolderOpen,
  Folder,
  X,
  GripVertical,
  type LucideIcon,
} from 'lucide-react';
import type { MECELayer } from '../OntologyCanvas.types';

// ============================================================
// Types & Interfaces
// ============================================================

/** 图层数据 */
export interface LayerData {
  id: string;
  name: string;
  color: string;
  icon?: LucideIcon;
  objectTypeIds: number[];
  nodeIds: number[];
  isVisible: boolean;
  isLocked: boolean;
  isCollapsed: boolean;
  isSystem: boolean; // 系统预设图层，不可删除
  order: number;
}

/** 图层面板属性 */
export interface MeceLayerPanelProps {
  /** 所有图层数据 */
  layers: LayerData[];
  /** 更新图层 */
  onUpdateLayer: (id: string, updates: Partial<LayerData>) => void;
  /** 删除图层 */
  onDeleteLayer: (id: string) => void;
  /** 创建图层 */
  onCreateLayer: (name: string, color: string) => void;
  /** 将节点添加到图层 */
  onAddNodesToLayer: (layerId: string, nodeIds: number[]) => void;
  /** 从图层移除节点 */
  onRemoveNodesFromLayer: (layerId: string, nodeIds: number[]) => void;
  /** 切换图层折叠 */
  onToggleCollapse: (id: string) => void;
  /** 选中图层中的节点 */
  onSelectLayerNodes: (layerId: string) => void;
  /** 聚焦到图层节点 */
  onFocusLayerNodes: (layerId: string) => void;
  /** 是否显示面板 */
  isOpen: boolean;
  /** 切换面板显示 */
  onTogglePanel: () => void;
  /** 展开的节点数量 */
  expandedNodeCount: number;
}

// ============================================================
// Constants
// ============================================================

/** 预设MECE分类颜色 */
export const MECE_LAYER_COLORS: Record<MECELayer, string> = {
  foundation: '#66d9ef',
  relations: '#38bdf8',
  methodology: '#4ade80',
  patterns: '#fb923c',
  domains: '#fbbf24',
};

/** MECE分类配置 */
export const MECE_LAYER_PRESETS: Array<{
  id: MECELayer;
  name: string;
  color: string;
  icon: LucideIcon;
  description: string;
}> = [
  {
    id: 'foundation',
    name: 'Foundation',
    color: '#66d9ef',
    icon: Layers,
    description: '核心基础设施实体',
  },
  {
    id: 'relations',
    name: 'Relations',
    color: '#38bdf8',
    icon: FolderOpen,
    description: '关系和连接类型',
  },
  {
    id: 'methodology',
    name: 'Methodology',
    color: '#4ade80',
    icon: Folder,
    description: '流程和方法论',
  },
  {
    id: 'patterns',
    name: 'Patterns',
    color: '#fb923c',
    icon: Layers,
    description: '设计模式和最佳实践',
  },
  {
    id: 'domains',
    name: 'Domains',
    color: '#fbbf24',
    icon: FolderOpen,
    description: '特定领域知识',
  },
];

/** 图层颜色选项 */
export const LAYER_COLOR_OPTIONS = [
  '#66d9ef', '#38bdf8', '#4ade80', '#fb923c',
  '#fbbf24', '#f472b6', '#a78bfa', '#f87171',
  '#34d399', '#fbbf24', '#60a5fa', '#a3e635',
];

// ============================================================
// Sub-Components
// ============================================================

/** 节点缩略图 */
interface NodeThumbnailProps {
  name: string;
  color: string;
  isSelected?: boolean;
  onClick?: () => void;
}

const NodeThumbnail: React.FC<NodeThumbnailProps> = ({ name, color, isSelected, onClick }) => (
  <button
    onClick={onClick}
    className={`
      w-6 h-6 rounded flex items-center justify-center text-[8px] font-bold transition-all
      ${isSelected ? 'ring-2 ring-white ring-offset-1 ring-offset-monokai-bg' : 'hover:scale-110'}
    `}
    style={{ backgroundColor: color, color: '#0c0d12' }}
    title={name}
  >
    {name.charAt(0).toUpperCase()}
  </button>
);

/** 图层项组件 */
interface LayerItemProps {
  layer: LayerData;
  onUpdate: (updates: Partial<LayerData>) => void;
  onToggleCollapse: () => void;
  onSelectNodes: () => void;
  onFocusNodes: () => void;
  onRemove: () => void;
  nodeNames: Array<{ id: number; name: string; color: string }>;
  isSelected?: boolean;
}

const LayerItem: React.FC<LayerItemProps> = ({
  layer,
  onUpdate,
  onToggleCollapse,
  onSelectNodes,
  onFocusNodes,
  onRemove,
  nodeNames,
  isSelected,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  return (
    <div
      className={`
        rounded-lg border transition-all duration-150
        ${isSelected ? 'border-monokai-accent/50 bg-monokai-accent/5' : 'border-monokai-border bg-monokai-surface/50'}
        ${layer.isLocked ? 'opacity-75' : ''}
      `}
    >
      {/* 图层头部 */}
      <div className="flex items-center gap-2 px-3 py-2">
        {/* 折叠/展开按钮 */}
        <button
          onClick={onToggleCollapse}
          className="text-monokai-comment hover:text-monokai-fg transition-colors"
        >
          {layer.isCollapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
        
        {/* 颜色指示器 */}
        <div
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: layer.color }}
        />
        
        {/* 图层名称 */}
        <span className={`flex-1 text-xs font-medium truncate ${layer.isLocked ? 'text-monokai-comment' : 'text-monokai-fg'}`}>
          {layer.name}
        </span>
        
        {/* 节点数量 */}
        <span className="text-[10px] text-monokai-comment bg-monokai-bg px-1.5 py-0.5 rounded">
          {layer.nodeIds.length}
        </span>
        
        {/* 可见性切换 */}
        <button
          onClick={() => onUpdate({ isVisible: !layer.isVisible })}
          className={`p-1 rounded transition-colors ${layer.isVisible ? 'text-monokai-comment hover:text-monokai-fg' : 'text-monokai-comment/40'}`}
          title={layer.isVisible ? '隐藏图层' : '显示图层'}
        >
          {layer.isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </button>
        
        {/* 锁定切换 */}
        <button
          onClick={() => onUpdate({ isLocked: !layer.isLocked })}
          className={`p-1 rounded transition-colors ${layer.isLocked ? 'text-monokai-yellow' : 'text-monokai-comment hover:text-monokai-fg'}`}
          title={layer.isLocked ? '解锁图层' : '锁定图层'}
        >
          {layer.isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
        </button>
        
        {/* 更多操作 */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 text-monokai-comment hover:text-monokai-fg transition-colors"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
          
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-36 bg-monokai-sidebar border border-monokai-border 
              rounded-lg shadow-xl overflow-hidden z-50 py-1">
              <button
                onClick={() => { onSelectNodes(); setShowMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-monokai-fg 
                  hover:bg-monokai-elevated transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                选择图层节点
              </button>
              <button
                onClick={() => { onFocusNodes(); setShowMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-monokai-fg 
                  hover:bg-monokai-elevated transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                聚焦图层
              </button>
              {!layer.isSystem && (
                <>
                  <div className="h-px bg-monokai-border my-1" />
                  <button
                    onClick={() => { onRemove(); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-monokai-danger 
                      hover:bg-monokai-danger/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    删除图层
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* 折叠内容 */}
      {!layer.isCollapsed && layer.nodeIds.length > 0 && (
        <div className="px-3 pb-3">
          <div className="flex flex-wrap gap-1.5 p-2 bg-monokai-bg/50 rounded-lg">
            {nodeNames.slice(0, 20).map((node) => (
              <NodeThumbnail
                key={node.id}
                name={node.name}
                color={node.color}
                onClick={onFocusNodes}
              />
            ))}
            {nodeNames.length > 20 && (
              <div className="w-6 h-6 rounded flex items-center justify-center text-[8px] text-monokai-comment bg-monokai-surface">
                +{nodeNames.length - 20}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// Main Component
// ============================================================

export const MeceLayerPanel: React.FC<MeceLayerPanelProps> = ({
  layers,
  onUpdateLayer,
  onDeleteLayer,
  onCreateLayer,
  onAddNodesToLayer,
  onRemoveNodesFromLayer,
  onToggleCollapse,
  onSelectLayerNodes,
  onFocusLayerNodes,
  isOpen,
  onTogglePanel,
  expandedNodeCount,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newLayerName, setNewLayerName] = useState('');
  const [newLayerColor, setNewLayerColor] = useState(LAYER_COLOR_OPTIONS[0]);
  const [draggedNodeId, setDraggedNodeId] = useState<number | null>(null);
  const [dragOverLayerId, setDragOverLayerId] = useState<string | null>(null);
  
  // 获取实体类型颜色
  const getTypeColor = (typeId: number) => {
    const colors = ['#66d9ef', '#38bdf8', '#4ade80', '#fb923c', '#fbbf24', '#f472b6'];
    return colors[Math.abs(typeId) % colors.length];
  };
  
  // 按顺序排序图层
  const sortedLayers = useMemo(() => 
    [...layers].sort((a, b) => a.order - b.order),
    [layers]
  );
  
  // 创建新图层
  const handleCreateLayer = () => {
    if (newLayerName.trim()) {
      onCreateLayer(newLayerName.trim(), newLayerColor);
      setNewLayerName('');
      setNewLayerColor(LAYER_COLOR_OPTIONS[0]);
      setIsCreating(false);
    }
  };
  
  // 拖拽处理
  const handleDragStart = (nodeId: number) => {
    setDraggedNodeId(nodeId);
  };
  
  const handleDragOver = (e: React.DragEvent, layerId: string) => {
    e.preventDefault();
    setDragOverLayerId(layerId);
  };
  
  const handleDragLeave = () => {
    setDragOverLayerId(null);
  };
  
  const handleDrop = (e: React.DragEvent, layerId: string) => {
    e.preventDefault();
    if (draggedNodeId !== null) {
      onAddNodesToLayer(layerId, [draggedNodeId]);
    }
    setDraggedNodeId(null);
    setDragOverLayerId(null);
  };
  
  if (!isOpen) {
    return (
      <button
        onClick={onTogglePanel}
        className="absolute left-3 top-[72px] z-20 flex items-center gap-2 px-3 py-2 
          bg-monokai-sidebar/95 backdrop-blur-md border border-monokai-border rounded-xl
          text-xs text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface
          transition-all shadow-lg"
      >
        <Layers className="w-4 h-4 text-monokai-accent" />
        <span>图层</span>
        <span className="text-[10px] bg-monokai-accent/20 text-monokai-accent px-1.5 py-0.5 rounded">
          {layers.length}
        </span>
      </button>
    );
  }
  
  return (
    <div className="absolute left-3 top-[72px] z-20 w-64 max-h-[calc(100vh-200px)] 
      bg-monokai-sidebar/95 backdrop-blur-md border border-monokai-border rounded-xl 
      shadow-xl overflow-hidden flex flex-col">
      
      {/* 面板头部 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-monokai-border">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-monokai-accent" />
          <span className="text-xs font-semibold text-monokai-fg">图层</span>
          <span className="text-[10px] bg-monokai-accent/20 text-monokai-accent px-1.5 py-0.5 rounded">
            {layers.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsCreating(true)}
            className="p-1 text-monokai-comment hover:text-monokai-accent transition-colors"
            title="新建图层"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={onTogglePanel}
            className="p-1 text-monokai-comment hover:text-monokai-fg transition-colors"
            title="关闭面板"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* 创建新图层表单 */}
      {isCreating && (
        <div className="px-3 py-2 border-b border-monokai-border bg-monokai-accent/5">
          <input
            type="text"
            value={newLayerName}
            onChange={(e) => setNewLayerName(e.target.value)}
            placeholder="图层名称..."
            className="w-full px-2 py-1.5 text-xs bg-monokai-bg border border-monokai-border rounded
              text-monokai-fg placeholder-monokai-comment/60 focus:outline-none focus:border-monokai-accent mb-2"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleCreateLayer()}
          />
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] text-monokai-comment">颜色:</span>
            <div className="flex gap-1">
              {LAYER_COLOR_OPTIONS.slice(0, 6).map((color) => (
                <button
                  key={color}
                  onClick={() => setNewLayerColor(color)}
                  className={`w-4 h-4 rounded-full transition-transform ${newLayerColor === color ? 'ring-2 ring-white scale-110' : 'hover:scale-110'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsCreating(false)}
              className="px-2 py-1 text-[10px] text-monokai-comment hover:text-monokai-fg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleCreateLayer}
              disabled={!newLayerName.trim()}
              className="px-2 py-1 text-[10px] bg-monokai-accent text-monokai-bg rounded
                hover:brightness-110 transition-all disabled:opacity-50"
            >
              创建
            </button>
          </div>
        </div>
      )}
      
      {/* 图层列表 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
        {sortedLayers.map((layer) => {
          const nodeNames = layer.nodeIds.map((id) => ({
            id,
            name: `Node ${id}`,
            color: getTypeColor(id),
          }));
          
          return (
            <div
              key={layer.id}
              onDragOver={(e) => handleDragOver(e, layer.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, layer.id)}
              className={`
                transition-all duration-150
                ${dragOverLayerId === layer.id ? 'ring-2 ring-monokai-accent ring-offset-1 ring-offset-monokai-sidebar' : ''}
                ${!layer.isVisible ? 'opacity-50' : ''}
              `}
            >
              <LayerItem
                layer={layer}
                onUpdate={(updates) => onUpdateLayer(layer.id, updates)}
                onToggleCollapse={() => onToggleCollapse(layer.id)}
                onSelectNodes={() => onSelectLayerNodes(layer.id)}
                onFocusNodes={() => onFocusLayerNodes(layer.id)}
                onRemove={() => onDeleteLayer(layer.id)}
                nodeNames={nodeNames}
              />
            </div>
          );
        })}
        
        {layers.length === 0 && !isCreating && (
          <div className="text-center py-6">
            <Layers className="w-8 h-8 text-monokai-comment/30 mx-auto mb-2" />
            <p className="text-xs text-monokai-comment">暂无图层</p>
            <p className="text-[10px] text-monokai-comment/60 mt-1">
              点击 + 按钮创建新图层
            </p>
          </div>
        )}
      </div>
      
      {/* 拖拽提示 */}
      <div className="px-3 py-2 border-t border-monokai-border bg-monokai-bg/50">
        <p className="text-[10px] text-monokai-comment text-center">
          拖拽节点到图层进行分组
        </p>
      </div>
    </div>
  );
};

export default MeceLayerPanel;
