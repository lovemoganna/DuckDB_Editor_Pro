/**
 * OntologyNode - 实体节点组件 (MECE v4.3 优化版)
 * 
 * 优化内容:
 * 1. hover状态稳定性优化 - 消除按钮显示抖动
 * 2. 动画性能优化 - 使用GPU加速和will-change优化
 * 3. z-index层级管理 - 路径追踪时正确层级显示
 * 4. 路径追踪视觉效果增强 - 动态发光和过渡动画
 * 5. 操作按钮位置稳定化 - 固定定位消除布局抖动
 * 6. 节点状态指示器优化
 * 7. 选中状态视觉强化
 * 
 * v4.3 优化内容:
 * 1. 属性展开/收起动画流畅度优化 - 使用max-height过渡
 * 2. 属性值类型高亮显示 - 根据类型显示不同颜色
 * 3. 属性项交错动画 - 依次淡入效果
 * 4. 展开按钮旋转动画 - ChevronDown旋转180°
 * 
 * v4.2 优化内容:
 * 1. 使用CSS变量统一管理动画时长
 * 2. 优化will-change属性减少重排重绘
 * 3. 添加节点激活状态脉冲动画
 * 4. 优化路径追踪节点的高亮过渡
 * 5. 改进hover区域的稳定性
 */

import React, { useState, useMemo, useCallback, useEffect, memo } from 'react';
import { Handle, Position, useViewport, useUpdateNodeInternals } from 'reactflow';
import { 
  Lock, Unlock, Settings, Trash2, Database, Copy, Eye, EyeOff, 
  ChevronDown, ChevronUp, GripVertical, Maximize2, 
  ArrowUp, ArrowDown, ArrowLeftRight, 
  Link2, Circle
} from 'lucide-react';
import { 
  getTypeStyles,
  NODE_DEFAULT_WIDTH,
  NODE_COLLAPSED_HEIGHT,
  NODE_EXPANDED_HEIGHT,
  NODE_COMPACT_WIDTH,
  NODE_COMPACT_HEIGHT,
} from './OntologyCanvas.helpers';

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
    onCopy?: (node: any) => void;
    onDuplicate?: (node: any) => void;
  };
  selected: boolean;
}

// ============================================================
// 常量定义
// ============================================================

/** 节点尺寸常量 (与 helpers 严格统一) */
const NODE_Sizes = {
  defaultWidth: NODE_DEFAULT_WIDTH, // 210
  defaultHeight: NODE_COLLAPSED_HEIGHT, // 84
  collapsedHeight: NODE_COLLAPSED_HEIGHT, // 84
  expandedHeight: NODE_EXPANDED_HEIGHT, // 148
  compactWidth: NODE_COMPACT_WIDTH, // 170
  compactHeight: NODE_COMPACT_HEIGHT, // 48
} as const;

/**
 * 缩放阈值定义 - MECE重构
 * - 鸟瞰紧凑模式（zoom < 0.45）：全景视角，呈现紧凑胶囊卡片（名称+类型色标+连接数）
 * - 标准与精细模式（zoom >= 0.45）：常用交互与编辑视角，核心信息（名称、类型、连线拓扑）常驻展示，次要属性受控折叠
 */
const COMPACT_ZOOM_THRESHOLD = 0.45;

/** 动画时长常量 (v4.2统一管理, v4.3增强) */
const ANIMATION_DURATION = {
  /** 基础过渡时长 */
  transition: '200ms',
  /** 高度动画时长 */
  height: '250ms',
  /** 脉冲动画时长 */
  pulse: '2s',
  /** 发光动画时长 */
  glow: '1.5s',
  /** 按钮显示过渡 */
  button: '150ms',
  /** 属性展开时长 (v4.3新增) */
  propertiesExpand: '300ms',
  /** 属性项交错延迟(毫秒数值) (v4.3新增) */
  propertiesStagger: 50,
} as const;

/** CSS缓动曲线 (v4.2统一管理, v4.3增强) */
const EASING = {
  /** 标准缓出 */
  standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
  /** 弹性缓出 */
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  /** 平滑进入 */
  smooth: 'cubic-bezier(0.0, 0, 0.2, 1)',
  /** 属性展开专用 (v4.3新增) */
  propertiesReveal: 'cubic-bezier(0.16, 1, 0.3, 1)',
} as const;

/**
 * 属性值类型样式 (v4.3新增)
 * 根据属性值的类型显示不同的视觉样式，提高可读性
 */
const PROPERTY_VALUE_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  string: { color: 'text-monokai-green', bg: 'bg-monokai-green/10', label: '文本' },
  number: { color: 'text-monokai-orange', bg: 'bg-monokai-orange/10', label: '数字' },
  boolean: { color: 'text-monokai-purple', bg: 'bg-monokai-purple/10', label: '布尔' },
  null: { color: 'text-monokai-comment', bg: 'bg-monokai-bg', label: '空值' },
  array: { color: 'text-monokai-cyan', bg: 'bg-monokai-cyan/10', label: '数组' },
  object: { color: 'text-monokai-pink', bg: 'bg-monokai-pink/10', label: '对象' },
};

/**
 * 获取属性值的类型信息 (v4.3新增)
 */
const getPropertyTypeInfo = (val: any): { type: string; style: typeof PROPERTY_VALUE_STYLES.string } => {
  if (val === null || val === undefined) {
    return { type: 'null', style: PROPERTY_VALUE_STYLES.null };
  }
  if (Array.isArray(val)) {
    return { type: 'array', style: PROPERTY_VALUE_STYLES.array };
  }
  if (typeof val === 'object') {
    return { type: 'object', style: PROPERTY_VALUE_STYLES.object };
  }
  if (typeof val === 'number') {
    return { type: 'number', style: PROPERTY_VALUE_STYLES.number };
  }
  if (typeof val === 'boolean') {
    return { type: 'boolean', style: PROPERTY_VALUE_STYLES.boolean };
  }
  return { type: 'string', style: PROPERTY_VALUE_STYLES.string };
};

/**
 * 属性值渲染器 - 统一格式化各种类型的属性值 (v4.3增强)
 * 添加类型高亮显示
 */
const renderPropertyValue = (val: any, showTypeHint: boolean = false): React.ReactNode => {
  const typeInfo = getPropertyTypeInfo(val);
  
  // null/undefined
  if (val === null || val === undefined) {
    return (
      <span className="text-monokai-comment font-semibold">null</span>
    );
  }
  
  // 数组
  if (Array.isArray(val)) {
    if (val.every(item => typeof item !== 'object')) {
      return (
        <span className="text-monokai-cyan font-semibold truncate max-w-full">
          [{val.join(', ')}]
        </span>
      );
    }
    return (
      <span className="text-monokai-cyan font-bold">
        [{val.length}个元素]
      </span>
    );
  }
  
  // 对象
  if (typeof val === 'object') {
    try {
      const inline = JSON.stringify(val);
      return (
        <span className="text-monokai-cyan font-semibold truncate max-w-full" title={inline}>
          {inline}
        </span>
      );
    } catch (e) {
      return <span className="text-monokai-pink font-semibold">object</span>;
    }
  }
  
  // 数字
  if (typeof val === 'number') {
    return (
      <span className="text-monokai-orange font-bold font-mono">{val}</span>
    );
  }
  
  // 布尔值
  if (typeof val === 'boolean') {
    return (
      <span className={`font-bold font-mono ${val ? 'text-monokai-purple' : 'text-monokai-comment'}`}>
        {val ? 'true' : 'false'}
      </span>
    );
  }
  
  // 字符串
  return (
    <span className="text-monokai-green font-medium truncate max-w-full">"{String(val)}"</span>
  );
};

/**
 * 带类型高亮的属性值渲染器 (v4.3新增)
 */
const renderPropertyValueWithTypeHint = (val: any): React.ReactNode => {
  const typeInfo = getPropertyTypeInfo(val);
  
  return (
    <div className="flex items-center gap-1.5 max-w-full">
      {renderPropertyValue(val)}
      {typeInfo.type !== 'string' && (
        <span className={`text-[8px] px-1 py-0.5 rounded ${typeInfo.style.bg} ${typeInfo.style.color} font-medium shrink-0`}>
          {typeInfo.style.label}
        </span>
      )}
    </div>
  );
};

/** 类型图标映射 */
const TYPE_ICONS: Record<string, React.FC<{ className?: string }>> = {
  'user': ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>,
  'product': ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
  'order': ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>,
  'default': ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/></svg>,
};

/** 获取类型图标 */
const getTypeIcon = (typeName: string): React.FC<{ className?: string }> => {
  const key = typeName?.toLowerCase() || '';
  if (key.includes('user') || key.includes('客户') || key.includes('人员')) return TYPE_ICONS.user;
  if (key.includes('product') || key.includes('产品') || key.includes('商品')) return TYPE_ICONS.product;
  if (key.includes('order') || key.includes('订单') || key.includes('交易')) return TYPE_ICONS.order;
  return TYPE_ICONS.default;
};

/**
 * 节点动作按钮组件 - MECE优化版本
 * 
 * 优化点:
 * 1. 固定定位消除hover抖动
 * 2. 稳定的过渡动画
 * 3. 统一的视觉语言
 */
const NodeActionButton: React.FC<{
  onClick: (e: React.MouseEvent) => void;
  icon: React.ReactNode;
  title: string;
  variant?: 'default' | 'danger' | 'warning';
  size?: 'sm' | 'md';
}> = ({ onClick, icon, title, variant = 'default', size = 'md' }) => {
  const sizeClasses = size === 'sm' ? 'p-1' : 'p-1.5';
  
  const variantClasses = {
    default: 'text-monokai-comment hover:text-monokai-info hover:bg-monokai-surface/80',
    danger: 'text-monokai-comment hover:text-monokai-danger hover:bg-monokai-danger/10',
    warning: 'text-monokai-comment hover:text-monokai-warning hover:bg-monokai-warning/10',
  };

  return (
    <button
      onClick={onClick}
      className={`
        ${sizeClasses} rounded-md transition-all duration-150
        ${variantClasses[variant]}
        active:scale-95
      `}
      title={title}
    >
      {icon}
    </button>
  );
};

/**
 * 操作按钮栏组件 - v4.2 稳定版
 * 
 * v4.2 优化点:
 * 1. 固定定位消除hover抖动 - 使用transform而非宽高变化
 * 2. 稳定的过渡动画 - 使用统一的缓动曲线
 * 3. GPU加速优化 - will-change提示
 * 4. hover区域扩大 - 提高可操作性
 * 5. 按钮间距优化 - 视觉更舒适
 */
const NodeActionBar: React.FC<{
  visible: boolean;
  isReadOnly: boolean;
  isLocked: boolean;
  objId: number | string;
  onLockToggle: () => void;
  onEditOpen: () => void;
  onDuplicate?: () => void;
  onDelete: () => void;
}> = ({ visible, isReadOnly, isLocked, objId, onLockToggle, onEditOpen, onDuplicate, onDelete }) => {
  return (
    <div
      className={`
        absolute top-2 right-2 z-20 pointer-events-none
        flex items-center gap-0.5
        bg-monokai-bg/95 border border-monokai-border rounded-lg
        px-1 py-1 shadow-xl
        transition-all duration-200 ease-out
        will-change-transform, opacity
        ${visible 
          ? 'opacity-100 translate-x-0 pointer-events-auto scale-100' 
          : 'opacity-0 -translate-x-1 pointer-events-none scale-95'
        }
      `}
    >
      {!isReadOnly && (
        <>
          <NodeActionButton
            onClick={(e) => { e.stopPropagation(); onLockToggle(); }}
            icon={isLocked ? <Lock className="w-3 h-3 text-monokai-warning" /> : <Unlock className="w-3 h-3" />}
            title={isLocked ? "解锁节点" : "锁定节点"}
            variant="warning"
            size="sm"
          />
          <div className="w-px h-3.5 bg-monokai-border mx-0.5" />
          <NodeActionButton
            onClick={(e) => { e.stopPropagation(); onEditOpen(); }}
            icon={<Settings className="w-3 h-3" />}
            title="编辑设置"
            size="sm"
          />
          {onDuplicate && (
            <NodeActionButton
              onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
              icon={<Copy className="w-3 h-3" />}
              title="复制节点"
              size="sm"
            />
          )}
          <div className="w-px h-3.5 bg-monokai-border mx-0.5" />
          <NodeActionButton
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            icon={<Trash2 className="w-3 h-3" />}
            title="删除节点"
            variant="danger"
            size="sm"
          />
        </>
      )}
      {isReadOnly && (
        <div className="px-2 py-0.5">
          <span className="text-[9px] text-monokai-comment font-medium">只读</span>
        </div>
      )}
    </div>
  );
};

/**
 * OntologyNodeInner - 节点主体组件 (v4.2 稳定版)
 * 
 * MECE优化:
 * 1. 使用NodeActionBar组件实现稳定的操作按钮定位
 * 2. 添加高度动画过渡
 * 3. 响应式显示模式
 * 4. GPU加速优化 (will-change)
 * 5. 统一的动画时长管理
 * 6. 路径追踪节点z-index层级管理
 */
const OntologyNodeInner: React.FC<OntologyNodeProps> = ({ id, data, selected }) => {
  const { zoom } = useViewport();
  const updateNodeInternals = useUpdateNodeInternals();
  
  // 悬停状态管理
  const [hovered, setHovered] = useState(false);
  
  // 属性展开/收起状态
  const [isPropertiesExpanded, setIsPropertiesExpanded] = useState(false);

  const {
    obj,
    type,
    isLocked,
    isHighlighted,
    isExpanded: storeIsExpanded,
    activePathNodesAndLinks,
    isFocusMode,
    isReadOnly = false,
    nodeWidth = NODE_Sizes.defaultWidth,
    nodeHeight = NODE_Sizes.collapsedHeight,
    incomingCount = 0,
    outgoingCount = 0,
    onLockToggle,
    onEditOpen,
    onDelete,
    onExpandToggle,
    onDuplicate,
  } = data;

  // 缩放模式判断：物理尺寸保持稳定确定性，避免滚轮缩放导致 DOM 盒模型剧烈变动与连线脱节
  const isCompact = (data as any).isCompact ?? false;
  const isExpanded = storeIsExpanded || isPropertiesExpanded;

  // 解析属性
  const parsedProperties = useMemo(() => {
    try {
      return typeof obj.properties === 'string' ? JSON.parse(obj.properties || '{}') : (obj.properties || {});
    } catch (e) {
      return {};
    }
  }, [obj.properties]);

  // 全部属性与前两项核心特征
  const allProperties = useMemo(() => Object.entries(parsedProperties), [parsedProperties]);
  const inlineProps = useMemo(() => allProperties.slice(0, 2), [allProperties]);

  // 严格确定性尺寸：与 getOntologyNodeDimensions 保持完全同步，杜绝复合累加
  const currentWidth = isCompact ? NODE_Sizes.compactWidth : NODE_Sizes.defaultWidth;
  const currentHeight = isCompact 
    ? NODE_Sizes.compactHeight 
    : (isExpanded ? (NODE_Sizes.collapsedHeight + Math.min(Math.max(allProperties.length, 1), 5) * 20 + 6) : NODE_Sizes.collapsedHeight);

  // 获取类型样式
  const typeStyle = getTypeStyles(obj.object_type_id);

  // 路径追踪状态
  const isSelfActive = activePathNodesAndLinks?.targetId === obj.id;
  const isUpstreamNode = activePathNodesAndLinks?.upstreamNodes?.has(obj.id);
  const isDownstreamNode = activePathNodesAndLinks?.downstreamNodes?.has(obj.id);
  
  const isPathActive = isSelfActive || isUpstreamNode || isDownstreamNode;
  const zIndexClass = isPathActive ? 'z-20' : 'z-0';

  // 透明度与显示控制
  let cardOpacity = 'opacity-100';
  let cardDisplayStyle: React.CSSProperties = {};

  if (activePathNodesAndLinks) {
    if (isSelfActive || isUpstreamNode || isDownstreamNode) {
      cardOpacity = 'opacity-100 shadow-lg';
    } else {
      if (isFocusMode) {
        cardDisplayStyle = { display: 'none' };
      } else {
        cardOpacity = 'opacity-30 hover:opacity-70';
      }
    }
  }

  // 边框高亮颜色
  const borderHighlight = selected || isSelfActive
    ? 'ring-2 ring-monokai-blue border-transparent'
    : (isUpstreamNode ? 'ring-1.5 ring-monokai-green border-transparent'
    : (isDownstreamNode ? 'ring-1.5 ring-monokai-blue border-transparent'
    : ''));

  // 主题色映射
  const colorHexMap: Record<string, string> = {
    'text-zinc-400': '#a1a1aa',
    'text-monokai-blue': '#66d9ef',
    'text-monokai-green': '#a6e22e',
    'text-monokai-yellow': '#e6db74',
    'text-monokai-orange': '#fd971f',
    'text-monokai-pink': '#f92672'
  };
  const themeColor = colorHexMap[typeStyle.text] ?? '#a1a1aa';
  
  // 交互状态：操作栏仅在非紧凑模式且选中或悬停时显示
  const showActionBar = !isCompact && (selected || hovered);
  
  // 回调绑定
  const handleLockToggle = useCallback(() => onLockToggle?.(obj.id), [onLockToggle, obj.id]);
  const handleEditOpen = useCallback(() => onEditOpen?.(obj), [onEditOpen, obj]);
  const handleDelete = useCallback(() => onDelete?.(obj.id), [onDelete, obj.id]);
  const handleDuplicate = useCallback(() => onDuplicate?.(obj), [onDuplicate, obj]);

  // 展开/收起切换回调
  const handleExpandToggle = useCallback(() => {
    setIsPropertiesExpanded(prev => !prev);
    onExpandToggle?.(obj.id);
  }, [onExpandToggle, obj.id]);

  // 动态boxShadow：使用发光而非外部scale变形，保证Handle坐标100%稳定
  const dynamicBoxShadow = useMemo(() => {
    if (selected) {
      return `0 0 20px -2px ${themeColor}60, 0 0 35px -6px ${themeColor}35, inset 0 1px 1px rgba(255, 255, 255, 0.15)`;
    }
    if (hovered && !isCompact) {
      return `0 8px 24px -4px ${themeColor}40, inset 0 1px 1px rgba(255, 255, 255, 0.1)`;
    }
    return '0 3px 14px -3px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.05)';
  }, [selected, hovered, isCompact, themeColor]);

  // 同步 ReactFlow 内部 Handle 缓存，确保高度/展开变化后连线始终贴合
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, currentWidth, currentHeight, isCompact, isExpanded, updateNodeInternals]);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: `${currentWidth}px`,
        height: `${currentHeight}px`,
        position: 'relative',
        transform: 'none',
        ...cardDisplayStyle
      }}
      className={`group ${zIndexClass}`}
    >
      {/* 4 方位对称精准锚点 Handle（外层容器 overflow: visible，圆点绝不被剪裁） */}
      {/* 左侧锚点 (x: 0, y: 50%) */}
      <Handle
        type="target"
        position={Position.Left}
        id="left-target"
        className="w-2.5 h-2.5 rounded-full border hover:scale-125 transition-all !bg-monokai-bg opacity-0 group-hover:opacity-100 z-30"
        style={{
          left: 0,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          borderColor: themeColor,
          borderWidth: '1.5px',
          boxShadow: `0 0 8px ${themeColor}80`,
        }}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left-source"
        className="w-2.5 h-2.5 rounded-full border hover:scale-125 transition-all !bg-monokai-bg opacity-0 group-hover:opacity-100 z-30"
        style={{
          left: 0,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          borderColor: themeColor,
          borderWidth: '1.5px',
          boxShadow: `0 0 8px ${themeColor}80`,
        }}
      />

      {/* 右侧锚点 (x: 100%, y: 50%) */}
      <Handle
        type="source"
        position={Position.Right}
        id="right-source"
        className="w-2.5 h-2.5 rounded-full border hover:scale-125 transition-all !bg-monokai-bg opacity-0 group-hover:opacity-100 z-30"
        style={{
          left: '100%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          borderColor: themeColor,
          borderWidth: '1.5px',
          boxShadow: `0 0 8px ${themeColor}80`,
        }}
      />
      <Handle
        type="target"
        position={Position.Right}
        id="right-target"
        className="w-2.5 h-2.5 rounded-full border hover:scale-125 transition-all !bg-monokai-bg opacity-0 group-hover:opacity-100 z-30"
        style={{
          left: '100%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          borderColor: themeColor,
          borderWidth: '1.5px',
          boxShadow: `0 0 8px ${themeColor}80`,
        }}
      />

      {/* 顶部锚点 (x: 50%, y: 0) */}
      <Handle
        type="target"
        position={Position.Top}
        id="top-target"
        className="w-2.5 h-2.5 rounded-full border hover:scale-125 transition-all !bg-monokai-bg opacity-0 group-hover:opacity-100 z-30"
        style={{
          top: 0,
          left: '50%',
          transform: 'translate(-50%, -50%)',
          borderColor: themeColor,
          borderWidth: '1.5px',
          boxShadow: `0 0 8px ${themeColor}80`,
        }}
      />
      <Handle
        type="source"
        position={Position.Top}
        id="top-source"
        className="w-2.5 h-2.5 rounded-full border hover:scale-125 transition-all !bg-monokai-bg opacity-0 group-hover:opacity-100 z-30"
        style={{
          top: 0,
          left: '50%',
          transform: 'translate(-50%, -50%)',
          borderColor: themeColor,
          borderWidth: '1.5px',
          boxShadow: `0 0 8px ${themeColor}80`,
        }}
      />

      {/* 底部锚点 (x: 50%, y: 100%) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom-source"
        className="w-2.5 h-2.5 rounded-full border hover:scale-125 transition-all !bg-monokai-bg opacity-0 group-hover:opacity-100 z-30"
        style={{
          top: '100%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          borderColor: themeColor,
          borderWidth: '1.5px',
          boxShadow: `0 0 8px ${themeColor}80`,
        }}
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom-target"
        className="w-2.5 h-2.5 rounded-full border hover:scale-125 transition-all !bg-monokai-bg opacity-0 group-hover:opacity-100 z-30"
        style={{
          top: '100%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          borderColor: themeColor,
          borderWidth: '1.5px',
          boxShadow: `0 0 8px ${themeColor}80`,
        }}
      />

      {/* 实体卡片主体容器 */}
      <div
        style={{
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          transition: `
            opacity ${ANIMATION_DURATION.transition} ${EASING.standard},
            box-shadow ${ANIMATION_DURATION.transition} ${EASING.standard},
            border-color ${ANIMATION_DURATION.transition} ${EASING.standard},
            height ${ANIMATION_DURATION.height} ${EASING.standard}
          `,
          boxShadow: dynamicBoxShadow,
          willChange: 'box-shadow, opacity',
        }}
        className={`
          relative rounded-lg bg-monokai-sidebar/95 backdrop-blur-md border 
          ${isCompact ? 'px-2.5 py-2' : 'px-3.5 py-2.5'} flex flex-col justify-between select-none 
          ${isLocked ? 'border-monokai-warning/40 border-dashed bg-monokai-bg/90' : 'border-monokai-border'} 
          ${cardOpacity} ${borderHighlight}
          ${isHighlighted ? 'ring-2 ring-monokai-blue border-transparent' : ''}
        `}
      >
        {/* 操作按钮栏组件 */}
        <NodeActionBar
          visible={showActionBar}
          isReadOnly={isReadOnly}
          isLocked={isLocked}
          objId={obj.id}
          onLockToggle={handleLockToggle}
          onEditOpen={handleEditOpen}
          onDuplicate={onDuplicate ? handleDuplicate : undefined}
          onDelete={handleDelete}
        />

        {/* 主题色背景叠加 */}
        <div className={`absolute inset-0 opacity-[0.04] pointer-events-none ${typeStyle.bg}`} />

        {/* 顶部装饰条 */}
        <div className={`absolute top-0 left-0 right-0 h-[3px] rounded-t-[8px] bg-gradient-to-r from-monokai-border to-monokai-surface ${typeStyle.text.replace('text-', 'bg-')}`} />

        {/* 模式一：极小鸟瞰紧凑模式 */}
        {isCompact ? (
          <div className="flex flex-col justify-between w-full h-full overflow-hidden pointer-events-none">
            <div className="flex items-center gap-1.5 truncate w-full">
              {isLocked && <Lock className="w-2.5 h-2.5 text-monokai-warning shrink-0" />}
              <Database className={`w-3 h-3 ${typeStyle.text} opacity-80 shrink-0`} />
              <span className="text-[11px] font-bold text-monokai-fg truncate" title={obj.name}>
                {obj.name}
              </span>
            </div>

            <div className="flex items-center justify-between w-full pt-0.5 border-t border-monokai-border/40 text-[8px] font-mono">
              <span className={`font-bold tracking-wider uppercase px-1 py-0.2 shrink-0 rounded-sm leading-none ${typeStyle.bg} ${typeStyle.text}`}>
                {type?.name || '未知'}
              </span>
              <div className="flex items-center gap-1">
                <span className="text-monokai-green flex items-center">
                  <ArrowUp className="w-2 h-2 mr-0.5" />{incomingCount}
                </span>
                <span className="text-monokai-comment">|</span>
                <span className="text-monokai-cyan flex items-center">
                  <ArrowDown className="w-2 h-2 mr-0.5" />{outgoingCount}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* 模式二：常用标准清晰模式 (常用缩放核心信息100%清晰完整，次要信息按需展开) */
          <>
            {/* L1 核心身份：实体名称 + 锁定状态 + 类型语义徽章 */}
            <div className="flex items-center justify-between gap-1.5 w-full shrink-0">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                {isLocked && (
                  <span title="该节点已锁定">
                    <Lock className="w-3 h-3 text-monokai-warning shrink-0" />
                  </span>
                )}
                <Database className={`w-3.5 h-3.5 ${typeStyle.text} opacity-90 shrink-0`} />
                <span className="text-xs font-bold text-monokai-fg truncate leading-none" title={obj.name}>
                  {obj.name}
                </span>
              </div>
              <span className={`text-[9px] font-mono font-bold tracking-wider uppercase px-1.5 py-0.5 rounded-sm shrink-0 leading-none ${typeStyle.bg} ${typeStyle.text}`}>
                {type?.name || '未知'}
              </span>
            </div>

            {/* L2 核心特征展示区：常用缩放常驻展示核心特征，展开后展示全量特征 */}
            <div className="w-full my-auto py-1 border-t border-b border-monokai-border/40 text-[9px] font-mono min-h-0 flex flex-col justify-center">
              {allProperties.length > 0 ? (
                isExpanded ? (
                  <div className="space-y-1 overflow-y-auto max-h-28 pr-0.5 flex-1">
                    {allProperties.map(([k, val]) => {
                      const typeInfo = getPropertyTypeInfo(val);
                      return (
                        <div key={k} className="flex justify-between gap-1.5 items-center py-0.5 border-b border-monokai-border/20">
                          <span className="text-monokai-comment truncate max-w-[45%]" title={k}>{k}:</span>
                          <div className="max-w-[55%] truncate text-right flex items-center justify-end gap-1">
                            {renderPropertyValue(val)}
                            {typeInfo.type !== 'string' && (
                              <span className={`text-[7px] px-1 py-0.2 rounded shrink-0 ${typeInfo.style.bg} ${typeInfo.style.color}`}>
                                {typeInfo.style.label}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-1 w-full leading-tight">
                    <span className="text-monokai-comment truncate max-w-[45%]" title={allProperties[0][0]}>
                      {allProperties[0][0]}:
                    </span>
                    <div className="max-w-[55%] truncate text-right flex items-center justify-end gap-1">
                      {renderPropertyValue(allProperties[0][1])}
                    </div>
                  </div>
                )
              ) : (
                <div className="text-monokai-comment/50 text-[9px] font-mono italic">
                  无扩展属性
                </div>
              )}
            </div>

            {/* L3 拓扑连接指标与展开收起控制 */}
            <div className="flex items-center justify-between w-full pt-0.5 shrink-0 text-[9px] font-mono">
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-0.5" title={`上游依赖数/入度: ${incomingCount}`}>
                  <ArrowUp className="w-2.5 h-2.5 text-monokai-green" />
                  <span className={`font-bold ${isUpstreamNode ? 'text-monokai-green font-extrabold' : 'text-monokai-comment'}`}>
                    {incomingCount}
                  </span>
                </div>
                
                <span className="text-monokai-border/60">|</span>
                
                <div className="flex items-center gap-0.5" title={`下游影响数/出度: ${outgoingCount}`}>
                  <ArrowDown className="w-2.5 h-2.5 text-monokai-cyan" />
                  <span className={`font-bold ${isDownstreamNode ? 'text-monokai-cyan font-extrabold' : 'text-monokai-comment'}`}>
                    {outgoingCount}
                  </span>
                </div>

                {(isSelfActive || selected) && (
                  <div className="flex items-center gap-0.5 px-1 py-0.2 rounded-full bg-monokai-accent/20 ml-0.5">
                    <Circle className="w-1.5 h-1.5 text-monokai-accent fill-current" />
                    <span className="text-[7px] font-bold text-monokai-accent">当前</span>
                  </div>
                )}
              </div>

              {allProperties.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleExpandToggle(); }}
                  className="hover:text-monokai-fg text-[8px] tracking-wider transition-colors uppercase font-bold flex items-center gap-0.5 text-monokai-comment cursor-pointer px-1 py-0.5 rounded hover:bg-white/5"
                  title={isExpanded ? "收起属性详情" : `展开查看全部 ${allProperties.length} 项属性`}
                >
                  <span>{isExpanded ? "收起" : `+${allProperties.length - 1} 属性`}</span>
                  <ChevronDown className={`w-2.5 h-2.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : 'rotate-0'}`} />
                </button>
              )}
            </div>

            {/* 路径追踪动态指示条 */}
            {activePathNodesAndLinks && !isCompact && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden">
                <div 
                  className="h-full flex transition-all duration-300"
                  style={{
                    animation: isSelfActive ? `pathPulse-${obj.id} ${ANIMATION_DURATION.glow} ease-in-out infinite` : undefined
                  }}
                >
                  {isUpstreamNode && (
                    <div 
                      className="h-full bg-monokai-green transition-all duration-300"
                      style={{ 
                        width: isSelfActive ? '40%' : '50%',
                        opacity: isSelfActive ? 1 : 0.7
                      }}
                    />
                  )}
                  {isSelfActive && (
                    <div 
                      className="h-full bg-monokai-accent"
                      style={{ width: '20%' }}
                    />
                  )}
                  {isDownstreamNode && (
                    <div 
                      className="h-full bg-monokai-cyan transition-all duration-300"
                      style={{ 
                        width: isSelfActive ? '40%' : '50%',
                        opacity: isSelfActive ? 1 : 0.7
                      }}
                    />
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export const OntologyNode = React.memo(OntologyNodeInner, (prev, next) => {
  // v4.2 优化：更精确的浅比较，避免不必要的重渲染
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
    // v4.2新增：路径追踪状态的引用比较优化
    prev.data.activePathNodesAndLinks?.targetId === next.data.activePathNodesAndLinks?.targetId &&
    prev.data.activePathNodesAndLinks?.upstreamNodes?.size === next.data.activePathNodesAndLinks?.upstreamNodes?.size &&
    prev.data.activePathNodesAndLinks?.downstreamNodes?.size === next.data.activePathNodesAndLinks?.downstreamNodes?.size
  );
});
