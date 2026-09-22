/**
 * OntologyCanvas.helpers - 实体画布辅助函数和常量
 * 
 * MECE组织原则：
 * 1. 类型定义 - 核心数据结构和接口
 * 2. 常量定义 - 网格大小、颜色、布局参数
 * 3. 工具函数 - 碰撞检测、路径计算
 * 4. 布局算法 - 节点排列、碰撞解决
 * 
 * MECE重构（v5.0）：
 * - 统一缩放阈值常量，与OntologyNode保持一致
 * - 优化节点尺寸计算
 */

// ============================================================
// Types & Interfaces
// ============================================================

/** 2D坐标位置 */
export interface Position {
  x: number;
  y: number;
}

/** 节点位置映射表 */
export interface SavedPositions {
  [key: number]: Position;
}

/** 链接路径计算结果 */
export interface ComputeLinkPathResult {
  smoothPath: string;
  labelX: number;
  labelY: number;
  arrowheadPath: string;
}

/** 节点类型颜色定义 */
export interface TypeColor {
  border: string;
  bg: string;
  text: string;
  glow: string;
}

/** 布局模式 */
export type LayoutMode = 'hierarchical' | 'tree' | 'force' | 'radial' | 'circular' | 'orthogonal';

/** 连线路由模式 */
export type EdgeRoutingMode = 'straight' | 'orthogonal' | 'bezier';

/** 工具模式 */
export type ToolMode = 'select' | 'pan' | 'box-select';

/** 选择状态 */
export interface SelectionState {
  nodeIds: Set<string>;
  edgeIds: Set<string>;
  isSelecting: boolean;
  boxStart: Position | null;
  boxEnd: Position | null;
}

/** 快捷键定义 */
export interface ShortcutDefinition {
  key: string;
  modifiers?: ('ctrl' | 'shift' | 'alt' | 'meta')[];
  action: string;
  description: string;
  scope?: 'canvas' | 'node' | 'edge' | 'all';
}

// ============================================================
// Constants - MECE重构
// ============================================================

/** 网格吸附单位（像素） */
export const GRID_SIZE = 20;

/** 节点默认宽度 */
export const NODE_DEFAULT_WIDTH = 210;

/** 节点默认基准高度（展示实体标题、类型徽章、1条核心属性预览、底部拓扑出入度统计指标） */
export const NODE_COLLAPSED_HEIGHT = 84;

/** 节点默认展开基准高度 */
export const NODE_EXPANDED_HEIGHT = 148;

/** 节点极小鸟瞰紧凑模式宽度 */
export const NODE_COMPACT_WIDTH = 170;

/** 节点极小鸟瞰紧凑模式高度 */
export const NODE_COMPACT_HEIGHT = 48;

/**
 * 缩放阈值常量 - MECE重构
 * - 极小全景鸟瞰模式（zoom < 0.35）：弱化次要文字与小图标
 * - 常用标准模式（0.35 <= zoom <= 1.5）：核心信息（名称、类型徽章、出入度拓扑统计、核心特征）始终 100% 清晰完整展现
 * - 放大观察模式（zoom > 1.5）：高分辨率细节，展示全部特征
 */
export const ZOOM_THRESHOLDS = {
  ULTRA_COMPACT: 0.25,
  COMPACT: 0.35,
  DETAILED: 1.0,
} as const;

/** 碰撞检测安全边距 */
export const COLLISION_MARGIN = 16;

/** 最大碰撞解决迭代次数 */
export const MAX_COLLISION_ATTEMPTS = 15;

/** 默认层级间距（收紧以保证100%视图下多节点全览） */
export const DEFAULT_RANK_SEP = 150;

/** 默认同层节点间距 */
export const DEFAULT_NODE_SEP = 70;

/** 默认并行线偏移 */
export const DEFAULT_PARALLEL_OFFSET = 24;

/** 缩放范围 */
export const ZOOM_RANGE = { min: 0.1, max: 4.0 };

/** 默认缩放 */
export const DEFAULT_ZOOM = 1.0;

/** 视图适配边距 */
export const VIEWPORT_PADDING = 0.22;

/** 节点类型颜色映射表 */
export const TYPE_COLORS: TypeColor[] = [
  { border: 'border-monokai-border hover:border-monokai-fg-muted', bg: 'bg-monokai-surface', text: 'text-monokai-comment', glow: '' },
  { border: 'border-monokai-blue/50 hover:border-monokai-blue', bg: 'bg-monokai-blue/10', text: 'text-monokai-blue', glow: 'shadow-monokai-blue/20' },
  { border: 'border-monokai-green/50 hover:border-monokai-green', bg: 'bg-monokai-green/10', text: 'text-monokai-green', glow: 'shadow-monokai-green/20' },
  { border: 'border-monokai-yellow/50 hover:border-monokai-yellow', bg: 'bg-monokai-yellow/10', text: 'text-monokai-yellow', glow: 'shadow-monokai-yellow/20' },
  { border: 'border-monokai-orange/50 hover:border-monokai-orange', bg: 'bg-monokai-orange/10', text: 'text-monokai-orange', glow: 'shadow-monokai-orange/20' },
  { border: 'border-monokai-pink/50 hover:border-monokai-pink', bg: 'bg-monokai-pink/10', text: 'text-monokai-pink', glow: 'shadow-monokai-pink/20' },
];

/** 实体类型到颜色的映射索引 */
export const getTypeColorIndex = (typeId: number): number => {
  return Math.abs(typeId) % TYPE_COLORS.length;
};

/** 获取类型样式 */
export const getTypeStyles = (typeId: number): TypeColor => {
  return TYPE_COLORS[getTypeColorIndex(typeId)];
};

/** 快捷键定义 */
export const CANVAS_SHORTCUTS: ShortcutDefinition[] = [
  // 选择与导航
  { key: 'v', action: 'select-tool', description: '选择工具', scope: 'canvas' },
  { key: 'h', action: 'pan-tool', description: '平移工具', scope: 'canvas' },
  { key: 'b', action: 'box-select-tool', description: '框选工具', scope: 'canvas' },
  { key: 'Escape', action: 'deselect', description: '取消选择', scope: 'all' },
  
  // 文件操作
  { key: 'n', action: 'new-node', description: '新建节点', scope: 'canvas' },
  { key: 'Ctrl+c', modifiers: ['ctrl'], action: 'copy', description: '复制', scope: 'node' },
  { key: 'Ctrl+v', modifiers: ['ctrl'], action: 'paste', description: '粘贴', scope: 'canvas' },
  { key: 'Ctrl+x', modifiers: ['ctrl'], action: 'cut', description: '剪切', scope: 'node' },
  { key: 'Ctrl+d', modifiers: ['ctrl'], action: 'duplicate', description: '复制并新建', scope: 'node' },
  
  // 选择操作
  { key: 'Ctrl+a', modifiers: ['ctrl'], action: 'select-all', description: '全选', scope: 'canvas' },
  { key: 'Delete', action: 'delete', description: '删除选中', scope: 'node' },
  { key: 'Backspace', action: 'delete', description: '删除选中', scope: 'node' },
  
  // 节点操作
  { key: 'l', action: 'toggle-lock', description: '锁定/解锁', scope: 'node' },
  { key: 'f', action: 'focus-node', description: '聚焦节点', scope: 'node' },
  { key: 'Enter', action: 'edit-node', description: '编辑节点', scope: 'node' },
  
  // 连线操作
  { key: 'r', action: 'reverse-edge', description: '反转连线', scope: 'edge' },
  
  // 视图操作
  { key: '+', action: 'zoom-in', description: '放大', scope: 'canvas' },
  { key: '-', action: 'zoom-out', description: '缩小', scope: 'canvas' },
  { key: '0', action: 'reset-zoom', description: '重置缩放', scope: 'canvas' },
  { key: '1', action: 'fit-view', description: '适应视图', scope: 'canvas' },
  { key: 'l', action: 'auto-layout', description: '自动布局', scope: 'canvas' },
  
  // 历史操作
  { key: 'Ctrl+z', modifiers: ['ctrl'], action: 'undo', description: '撤销', scope: 'canvas' },
  { key: 'Ctrl+y', modifiers: ['ctrl'], action: 'redo', description: '重做', scope: 'canvas' },
  
  // 帮助
  { key: '?', action: 'show-shortcuts', description: '显示快捷键', scope: 'canvas' },
];

// ============================================================
// Utility Functions
// ============================================================

/**
 * 解决节点碰撞
 * 使用迭代方式将碰撞的节点推开
 */
export const resolveCollisions = (
  droppedId: number,
  currentPositions: SavedPositions,
  expandedNodeIds?: Set<number>
): SavedPositions => {
  const updated = { ...currentPositions };
  const droppedPos = updated[droppedId];
  if (!droppedPos) return currentPositions;

  // 吸附到网格
  droppedPos.x = Math.round(droppedPos.x / GRID_SIZE) * GRID_SIZE;
  droppedPos.y = Math.round(droppedPos.y / GRID_SIZE) * GRID_SIZE;

  const isExpanded = (id: number) => expandedNodeIds?.has(id) ?? false;
  const getWidth = (id: number) => NODE_DEFAULT_WIDTH;
  const getHeight = (id: number) => isExpanded(id) ? NODE_EXPANDED_HEIGHT : NODE_COLLAPSED_HEIGHT;

  let hasCollision = true;
  let attempts = 0;

  while (hasCollision && attempts < MAX_COLLISION_ATTEMPTS) {
    hasCollision = false;
    const Aw = getWidth(droppedId) + COLLISION_MARGIN;
    const Ah = getHeight(droppedId) + COLLISION_MARGIN;

    for (const idStr of Object.keys(updated)) {
      const id = parseInt(idStr, 10);
      if (id === droppedId) continue;

      const otherPos = updated[id];
      if (!otherPos) continue;

      const Bw = getWidth(id) + COLLISION_MARGIN;
      const Bh = getHeight(id) + COLLISION_MARGIN;

      // AABB碰撞检测
      const overlapX = droppedPos.x < otherPos.x + Bw - 5 && droppedPos.x + Aw > otherPos.x + 5;
      const overlapY = droppedPos.y < otherPos.y + Bh - 5 && droppedPos.y + Ah > otherPos.y + 5;

      if (overlapX && overlapY) {
        hasCollision = true;
        
        const overlapWidth = Math.min(droppedPos.x + Aw - otherPos.x, otherPos.x + Bw - droppedPos.x);
        const overlapHeight = Math.min(droppedPos.y + Ah - otherPos.y, otherPos.y + Bh - droppedPos.y);

        if (overlapWidth < overlapHeight) {
          const pushX = droppedPos.x >= otherPos.x ? overlapWidth : -overlapWidth;
          droppedPos.x = Math.round((droppedPos.x + pushX) / GRID_SIZE) * GRID_SIZE;
        } else {
          const pushY = droppedPos.y >= otherPos.y ? overlapHeight : -overlapHeight;
          droppedPos.y = Math.round((droppedPos.y + pushY) / GRID_SIZE) * GRID_SIZE;
        }
        attempts++;
        break;
      }
    }
  }
  return updated;
};

/**
 * 计算链接贝塞尔曲线路径 - MECE重构
 * 确保在不同缩放级别下正确计算锚点位置
 */
export const computeLinkPath = (
  linkId: number,
  srcId: number,
  tgtId: number,
  srcPos: Position,
  tgtPos: Position,
  zoomVal: number,
  isExpandedSrc: boolean,
  isExpandedTgt: boolean,
  linkCurvatures: { [key: number]: number }
): ComputeLinkPathResult => {
  const dx = tgtPos.x - srcPos.x;
  const dy = tgtPos.y - srcPos.y;
  const angle = Math.atan2(dy, dx);
  
  // MECE重构：使用新的三级缩放阈值
  const isUltraCompact = zoomVal < ZOOM_THRESHOLDS.ULTRA_COMPACT;
  const isCompact = zoomVal >= ZOOM_THRESHOLDS.ULTRA_COMPACT && zoomVal < ZOOM_THRESHOLDS.COMPACT;
  const isStandard = zoomVal >= ZOOM_THRESHOLDS.COMPACT && zoomVal < ZOOM_THRESHOLDS.DETAILED;
  const isDetailed = zoomVal >= ZOOM_THRESHOLDS.DETAILED;
  
  const getDim = (isComp: boolean, isExp: boolean, isDet: boolean) => {
    if (isUltraCompact) return { w: NODE_COMPACT_WIDTH / 2, h: NODE_COMPACT_HEIGHT / 2 };
    if (isCompact) return { w: NODE_COMPACT_WIDTH / 2, h: NODE_COMPACT_HEIGHT / 2 };
    if (isExp || isDet) return { w: NODE_DEFAULT_WIDTH / 2, h: NODE_EXPANDED_HEIGHT / 2 };
    return { w: NODE_DEFAULT_WIDTH / 2, h: NODE_COLLAPSED_HEIGHT / 2 };
  };
  
  const srcDim = getDim(isCompact, isExpandedSrc, isDetailed);
  const tgtDim = getDim(isCompact, isExpandedTgt, isDetailed);
  
  const cosA = Math.abs(Math.cos(angle));
  const sinA = Math.abs(Math.sin(angle));
  
  const srcOffset = Math.min(srcDim.w / (cosA || 0.001), srcDim.h / (sinA || 0.001));
  const tgtOffset = Math.min(tgtDim.w / (cosA || 0.001), tgtDim.h / (sinA || 0.001));
  
  const sourceX = srcPos.x + Math.cos(angle) * srcOffset;
  const sourceY = srcPos.y + Math.sin(angle) * srcOffset;
  const targetX = tgtPos.x - Math.cos(angle) * tgtOffset;
  const targetY = tgtPos.y - Math.sin(angle) * tgtOffset;
  
  const factor = linkCurvatures[linkId] ?? 0;
  const cpDist = Math.max(80, Math.abs(targetX - sourceX) * 0.4);
  const offset = factor * 160;
  
  const cp1X = sourceX + cpDist;
  const cp1Y = sourceY - offset;
  const cp2X = targetX - cpDist;
  const cp2Y = targetY - offset;
  
  const smoothPath = `M ${sourceX} ${sourceY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${targetX} ${targetY}`;
  
  const labelX = 0.125 * sourceX + 0.375 * cp1X + 0.375 * cp2X + 0.125 * targetX;
  const labelY = 0.125 * sourceY + 0.375 * cp1Y + 0.375 * cp2Y + 0.125 * targetY;

  const arrowSize = 7;
  const arrowAngle = Math.PI / 6;
  const endAngle = Math.atan2(targetY - cp2Y, targetX - cp2X);
  const ax1 = targetX - arrowSize * Math.cos(endAngle - arrowAngle);
  const ay1 = targetY - arrowSize * Math.sin(endAngle - arrowAngle);
  const ax2 = targetX - arrowSize * Math.cos(endAngle + arrowAngle);
  const ay2 = targetY - arrowSize * Math.sin(endAngle + arrowAngle);
  const arrowheadPath = `M ${targetX} ${targetY} L ${ax1} ${ay1} L ${ax2} ${ay2} Z`;

  // NaN检查
  if (
    isNaN(sourceX) || isNaN(sourceY) ||
    isNaN(targetX) || isNaN(targetY) ||
    isNaN(cp1X) || isNaN(cp1Y) ||
    isNaN(cp2X) || isNaN(cp2Y) ||
    isNaN(ax1) || isNaN(ay1) ||
    isNaN(ax2) || isNaN(ay2)
  ) {
    return { smoothPath: '', labelX: 0, labelY: 0, arrowheadPath: '' };
  }
  
  return { smoothPath, labelX, labelY, arrowheadPath };
};

/**
 * 格式化缩放百分比显示
 */
export const formatZoomLevel = (zoom: number): string => {
  return `${Math.round(zoom * 100)}%`;
};

/**
 * 判断是否为有效的坐标
 */
export const isValidPosition = (pos: Position): boolean => {
  return !isNaN(pos.x) && !isNaN(pos.y) && isFinite(pos.x) && isFinite(pos.y);
};

/**
 * 计算两点之间的欧几里得距离
 */
export const distance = (p1: Position, p2: Position): number => {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * 判断点是否在矩形内
 */
export const isPointInRect = (
  point: Position,
  rect: { x: number; y: number; width: number; height: number }
): boolean => {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
};

/**
 * 计算多个节点的外接矩形
 */
export const getBoundingBox = (
  positions: SavedPositions,
  width: number = NODE_DEFAULT_WIDTH,
  height: number = NODE_COLLAPSED_HEIGHT
): { x: number; y: number; width: number; height: number } | null => {
  const ids = Object.keys(positions);
  if (ids.length === 0) return null;
  
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  
  for (const idStr of ids) {
    const pos = positions[parseInt(idStr, 10)];
    if (!pos) continue;
    
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + width);
    maxY = Math.max(maxY, pos.y + height);
  }
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
};





