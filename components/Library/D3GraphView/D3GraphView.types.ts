/**
 * D3GraphView — Shared Types
 *
 * Extracted from D3GraphView.tsx to reduce cognitive load on the main component.
 * All interfaces, constants, and SVG icon paths live here.
 */

import type { Cluster } from '../../../services/graphClusteringService';

// ── Core Domain Types ────────────────────────────────────────────────────────

export interface LifeObjectType { id: number; name: string; description: string }
export interface LifeObject { id: number; object_type_id: number; name: string; properties: string }
export interface LifeLinkType { id: number; name: string; description: string }
export interface LifeLink { id: number; link_type_id: number; source_object_id: number; target_object_id: number; weight: number }
export interface LifeAction { id: number; object_id: number; name: string; description: string; status: string; execute_at: string }

// ── Graph Model ───────────────────────────────────────────────────────────────

export interface GraphNode {
  id: string; label: string; group: string; color: string;
  size: number; description: string; x?: number; y?: number;
  fx?: number | null; fy?: number | null;
  _focusLevel?: number; // 0=focused, 1=first-hop, 2=second-hop, 3=hidden
  _typeId?: number; _objId?: number;
  _typeColor?: string;       // TypeHub color for this node's category
  _instanceColor?: string;   // muted color for instance node
  _propsCount?: number;      // number of key-value pairs in properties
  _propsRaw?: string;        // raw properties string for display
  _instanceCount?: number;    // count of instances belonging to this typeHub
  _hasInstances?: boolean;   // whether this typeHub has any instances
  _communityId?: number;    // community ID for cluster folding
  _degree?: number;          // degree centrality (computed at render time)
  _userPinned?: boolean;     // whether user pinned this node
  [key: string]: any;
}

export interface GraphLink {
  source: string | GraphNode; target: string | GraphNode;
  color: string; weight: number;
  _linkTypeId?: number; _linkTypeName?: string;
  _bidirectional?: boolean;
  _mergedIndices?: number[];
  _count?: number;           // number of collapsed links (community)
  _relations?: string[];    // list of relation names in a collapsed community edge
  _edgeCount?: number;      // count of aggregated parallel edges
  _edgeWeight?: number;     // sum of weights of aggregated parallel edges
  _groupOffset?: number;    // perpendicular offset for edge routing
  _displayed?: boolean;     // for filtering
  _isTypeInstLink?: boolean; // L0-L1 根节点到实例节点的衍生归属连线
  _isActionLink?: boolean;   // L1-L2 实例节点到行为节点的动作依附连线
  _gradientId?: string;     // 双色线性渐变 ID
  _isSelected?: boolean;     // 当前是否被用户点击选中
  [key: string]: any;
}

// ── Edge Presentation Settings (MECE 连线控制维度) ─────────────────────────

export type EdgeRoutingMode = 'spline' | 'straight';
export type EdgeLabelDisplay = 'auto' | 'always' | 'hover' | 'none';

export interface EdgePresentationSettings {
  /** 是否展示 L0-L1 根节点(TypeHub)到实例节点(Instance)的衍生归属线 */
  showHierarchyLinks: boolean;
  /** 是否开启业务连线流向动态粒子效果 (Flow Particles) */
  enableLinkParticles: boolean;
  /** 连线曲率避让形态：平滑贝塞尔避障 (spline) vs 经典直连线 (straight) */
  routingMode: EdgeRoutingMode;
  /** 连线关系文字徽章展示策略 */
  edgeLabelDisplay: EdgeLabelDisplay;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  typeMap: Record<number, LifeObjectType>;
  linkTypeMap: Record<number, LifeLinkType>;
  typeNames: string[];       // ordered type names for legend
  _rawLinks?: LifeLink[];    // raw link rows from DuckDB, used for semantic layout
}

// ── Layout Types ─────────────────────────────────────────────────────────────────

/**
 * 统一布局模式类型 - MECE 完整覆盖所有布局算法
 * 
 * 【分类说明】
 * 层级结构 (Hierarchical): 展示有向依赖关系，减少边交叉
 * 网状结构 (Network): 自由关联关系，节点自然聚集
 * 辐射结构 (Radial): 中心-边缘关系，层次清晰
 * 网格结构 (Grid): 同质节点均匀分布
 */
export type D3LayoutMode = 
  // 层级结构 (4种)
  | 'topologicalFlow'    // 拓扑语义层级流 - 自动减少边交叉
  | 'dagre'              // Dagre分层 - 基于Dagre库的严格分层布局
  | 'verticalTree'       // 纵向层级树 - 自上而下的树形布局
  | 'horizontalTree'     // 横向层级树 - 默认推荐，自左至右的树形布局
  // 网状结构 (3种)
  | 'force'              // 有机力导向 - 物理模拟，节点自然聚集
  | 'clusteredForce'     // 社区重心极坐标 - 社区检测+重心布局
  | 'groupedCircular'     // 分组环形 - 按类型分组，组内环形排列
  // 辐射结构 (4种)
  | 'concentric'         // 同心圆径向 - 度数最高节点在中心
  | 'starburst'          // 星系辐射 - 以度数最高节点为中心向外射线分布
  | 'dandelion'          // 蒲公英径向 - TypeHub作花心，扇形分布
  | 'spoke'              // 辐射骨架 - 轮辐布局，均匀分布
  // 网格结构 (1种)
  | 'grid';              // 网格排列 - 均匀网格分布

/** 向后兼容的类型别名 */
export type LayoutMode = D3LayoutMode;

// ── UI State Types ───────────────────────────────────────────────────────────

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  node: GraphNode | null;
}

export interface GraphStats {
  fps: number;
  nodeCount: number;
  linkCount: number;
  visibleCount: number;
  culledCount: number;
  renderTime: number;
}

export type LabelMode = 'auto' | 'all' | 'top' | 'hover';
export type ViewMode = 'global' | 'local' | 'detail';
export type EdgeColorMode = 'linkType' | 'cluster';
export type ClusterMode = 'community' | 'type' | 'property' | 'cc';
export type InteractionMode = 'select' | 'connect';
export type NodeImportance = 'all' | 'hub' | 'peripheral';
export type FilterDirection = 'all' | 'in' | 'out';

// ── SVG Icon Paths (Line-style, consistent) ───────────────────────────────────

/** Hexagon — semantically represents a TYPE / CATEGORY node */
export const ICON_HEXAGON = `M 8.66,-5 L 0,-10 L -8.66,-5 L -8.66,5 L 0,10 L 8.66,5 Z`;

/** Box — represents a concrete DATA ENTITY / INSTANCE */
export const ICON_BOX = `M -7,-4 L 0,-8 L 7,-4 L 7,4 L 0,8 L -7,4 Z`;

/** Lightning bolt — represents an ACTION node */
export const ICON_BOLT = `M 2,-9 L -5,1 L -1,1 L -2,9 L 5,-1 L 1,-1 Z`;

// ── Color Palettes ───────────────────────────────────────────────────────────

/**
 * Type palette: WARM colors for TypeHub (parent), COOL colors for Instance (child)
 * Monokai semantic colors —克制、专业、与项目整体调性一致
 * TypeHub: amethyst/pink/orange spectrum (Monokai accent colors)
 * Instance: muted pastel of corresponding TypeHub color (same hue, lower saturation)
 */
export const TYPE_COLORS_WARM = [
  '#c77dff', '#ff6b9d', '#ffa040', '#ffe066', '#7dd87d',
  '#ff6b9d', '#c77dff', '#ffa040', '#ffe066',
] as const;

export const TYPE_COLORS_INSTANCE = [
  '#a070d0', '#d06080', '#c88030', '#b0b040', '#60b060',
  '#d06080', '#a070d0', '#c88030', '#b0b040',
] as const;

export const LINKTYPE_COLORS = [
  '#66d9ef', // id=1 采购/流转/制作 - vibrant cyan
  '#a6e22e', // id=2 支撑/生成 - lime green
  '#ffb86c', // id=3 线索/证据 - warm amber
  '#bd93f9', // id=4 汇聚/关联 - amethyst purple
  '#ff79c6', // id=5 推断/演化 - soft rose
  '#ff5555', // id=6 暴露/警示/未知 - coral red
  '#38bdf8', // id=7 推进/协同 - sky blue
  '#f1fa8c', // id=8 检验/校准 - lemon yellow
  '#4ade80', // id=9 沉淀/归档 - emerald
  '#cbd5e1', // id=10 通用关联 - slate
] as const;

/**
 * 7 distinct dash patterns for the 7 link types.
 * Ordered by semantic prominence: stronger/structural relations get simpler patterns.
 * 0=实线 1=虚线 2=点线 3=dash-dot 4=long-dash 5=dash-dot-dot 6=wave
 */
export const LINKTYPE_DASH = [
  '5 3',     // id=1 影响 — dashed
  '2 4',     // id=2 养活 — dotted
  '6 3 2 3', // id=3 锚定 — dash-dot
  '10 3',    // id=4 支撑 — long-dash
  '0',       // id=5 依恋 — solid (emotionally most prominent)
  '6 2 2 2', // id=6 协助 — dash-dot-dot
  '0',       // id=7 推进 — solid
] as const;

/** Legacy alias */
export const TYPE_COLORS = TYPE_COLORS_WARM;

// ── Rendering Constants ──────────────────────────────────────────────────────

export const LABEL_MAX_CHARS = 18;
export const LABEL_MAX_COLLAPSED_CHARS = 22;
export const LABEL_W = 90;
export const LABEL_H = 16;
export const LABEL_PADDING = 4;
export const MAX_VISIBLE_LABELS = 120;
export const MAX_VISIBLE_LABELS_ZOOMED = 60;
export const VISIBLE_BUFFER = 500; // px beyond viewport edge to pre-render
export const VIEWPORT_CULL_BUFFER = 200; // px for edge viewport culling
export const TICK_THROTTLE_MS = 33; // ~30fps
