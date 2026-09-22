/**
 * ontologyLayout.types.ts - 知识图谱统一数据模型
 * 
 * 设计目标：
 * 1. 统一 OntologyCanvas (ReactFlow) 和 D3GraphView (D3) 的类型定义
 * 2. 消除重复的类型转换开销
 * 3. 提供清晰的数据流契约
 */

// ============================================================
// 节点类型定义
// ============================================================

export type NodeGroup = 'typeHub' | 'instance' | 'action' | 'linkType';

export interface OntologyNodePosition {
  x: number;
  y: number;
}

export interface OntologyNodeStyle {
  /** 节点颜色 */
  color: string;
  /** 节点尺寸 (半径) */
  size: number;
  /** 边框宽度 */
  strokeWidth?: number;
  /** 是否锁定 */
  isLocked?: boolean;
  /** 是否高亮 */
  isHighlighted?: boolean;
}

export interface OntologyNodeData {
  /** 节点ID */
  id: number;
  /** 节点名称 */
  name: string;
  /** 实体类型ID */
  objectTypeId: number;
  /** 类型名称 */
  typeName?: string;
  /** 属性JSON */
  properties?: string;
  /** 注解 */
  annotations?: string;
  /** 描述 */
  description?: string;
}

/** 统一节点模型 - 适用于所有渲染引擎 */
export interface UnifiedOntologyNode {
  /** 全局唯一ID */
  id: string;
  /** 显示名称 */
  label: string;
  /** 节点分组 (类型/实例/行动/关联类型) */
  group: NodeGroup;
  /** 位置 */
  position: OntologyNodePosition;
  /** 样式 */
  style: OntologyNodeStyle;
  /** 数据 */
  data: OntologyNodeData;
  /** 层级深度 (用于布局) */
  depth?: number;
  /** 所属分支索引 */
  branchIndex?: number;
  /** 类型ID (用于颜色映射) */
  typeId?: number;
  /** 对象ID (用于关联) */
  objId?: number;
  /** 用户锁定坐标 */
  fx?: number | null;
  fy?: number | null;
  /** 扩展数据 */
  [key: string]: any;
}

// ============================================================
// 边类型定义
// ============================================================

export type EdgeRoutingMode = 'straight' | 'orthogonal' | 'bezier';

export interface OntologyEdgeStyle {
  /** 边颜色 */
  color: string;
  /** 边框宽度 */
  strokeWidth?: number;
  /** 虚线样式 */
  dashArray?: string;
  /** 透明度 */
  opacity?: number;
  /** 是否显示箭头 */
  showArrow?: boolean;
}

export interface OntologyEdgeData {
  /** 边ID */
  id: number;
  /** 关联类型ID */
  linkTypeId: number;
  /** 关联类型名称 */
  linkTypeName?: string;
  /** 权重 */
  weight: number;
}

/** 统一边模型 - 适用于所有渲染引擎 */
export interface UnifiedOntologyEdge {
  /** 全局唯一ID */
  id: string;
  /** 源节点ID */
  source: string;
  /** 目标节点ID */
  target: string;
  /** 样式 */
  style: OntologyEdgeStyle;
  /** 数据 */
  data: OntologyEdgeData;
  /** 路由模式 */
  routingMode?: EdgeRoutingMode;
  /** 路由点 (正交模式) */
  routePoints?: Array<{ x: number; y: number }>;
  /** 路径偏移 (并行边) */
  laneOffset?: number;
  /** 是否激活 (上下游追踪) */
  isActive?: boolean;
  /** 是否上游 */
  isUpstream?: boolean;
  /** 扩展数据 */
  [key: string]: any;
}

// ============================================================
// 布局配置
// ============================================================

export type UnifiedLayoutMode = 
  | 'hierarchical'   // 层级布局 (LR/TB)
  | 'orthogonal'     // 正交网格布局
  | 'radial'         // 放射状布局
  | 'tree'           // 紧凑树形
  | 'circular'       // 环形布局
  | 'force'          // 力导向布局
  | 'topologicalFlow' // 拓扑语义流
  | 'concentric'     // 同心圆布局
  | 'dagre'          // Dagre层级算法
  | 'grouped';       // 分组聚类布局

export interface UnifiedLayoutConfig {
  /** 布局模式 */
  mode: UnifiedLayoutMode;
  /** 水平间距 */
  nodesep: number;
  /** 垂直间距 */
  ranksep: number;
  /** 节点宽度 */
  nodeWidth: number;
  /** 节点高度 */
  nodeHeight: number;
  /** 方向 (LR/TB) */
  direction?: 'LR' | 'TB';
  /** 是否启用动画 */
  animated?: boolean;
}

/** 默认布局配置 */
export const DEFAULT_LAYOUT_CONFIG: UnifiedLayoutConfig = {
  mode: 'hierarchical',
  nodesep: 140,
  ranksep: 280,
  nodeWidth: 220,
  nodeHeight: 82,
  direction: 'LR',
  animated: true,
};

/** 布局模式元数据 */
export const UNIFIED_LAYOUT_MODES: Array<{
  id: UnifiedLayoutMode;
  label: string;
  description: string;
  icon: string;
}> = [
  { id: 'hierarchical', label: '层级', description: '从左到右的关系分层', icon: '➡️' },
  { id: 'orthogonal', label: '正交', description: '对齐网格与正交连线', icon: '📐' },
  { id: 'radial', label: '放射', description: '根节点向外逐层扩散', icon: '🔵' },
  { id: 'tree', label: '树形', description: '从上到下的紧凑树', icon: '🌳' },
  { id: 'circular', label: '环形', description: '稳定的环形顺序', icon: '⭕' },
  { id: 'force', label: '力导向', description: '根据连接密度聚合', icon: '🧲' },
  { id: 'topologicalFlow', label: '拓扑流', description: '语义层级流式布局', icon: '🌊' },
  { id: 'concentric', label: '同心圆', description: '类型-实例-行动分层', icon: '🎯' },
  { id: 'dagre', label: 'Dagre', description: 'Dagre DAG优化布局', icon: '⚡' },
  { id: 'grouped', label: '分组', description: '按类型聚类分组', icon: '📦' },
];

// ============================================================
// 图谱数据
// ============================================================

export interface UnifiedGraphData {
  /** 节点列表 */
  nodes: UnifiedOntologyNode[];
  /** 边列表 */
  edges: UnifiedOntologyEdge[];
  /** 类型映射表 */
  typeMap: Record<number, { id: number; name: string; description: string }>;
  /** 关联类型映射表 */
  linkTypeMap: Record<number, { id: number; name: string; description: string }>;
  /** 类型名称列表 (用于图例) */
  typeNames: string[];
}

// ============================================================
// 视图状态
// ============================================================

export interface GraphViewState {
  /** 当前布局模式 */
  layoutMode: UnifiedLayoutMode;
  /** 缩放级别 */
  zoom: number;
  /** 平移偏移 */
  pan: { x: number; y: number };
  /** 是否显示MiniMap */
  showMiniMap: boolean;
  /** 是否显示网格 */
  showGrid: boolean;
  /** 是否显示连线动画 */
  animateEdges: boolean;
  /** 当前选中节点ID */
  selectedNodeId: number | null;
  /** 当前悬停节点ID */
  hoveredNodeId: number | null;
  /** 搜索关键词 */
  searchQuery: string;
  /** 聚焦模式节点ID */
  focusedNodeId: string | null;
  /** 视图模式 */
  viewMode: 'graph' | 'canvas' | 'data';
}

// ============================================================
// 转换工具函数
// ============================================================

import type { Node, Edge } from 'reactflow';
import type { GraphNode, GraphLink } from './D3GraphView/D3GraphView.types';

/** ReactFlow Node 转换为统一节点模型 */
export function convertReactFlowNode(node: Node): UnifiedOntologyNode {
  const data = node.data?.obj || {};
  return {
    id: node.id,
    label: data.name || node.id,
    group: 'instance',
    position: node.position,
    style: {
      color: '#66d9ef',
      size: 11,
      isLocked: node.data?.isLocked,
      isHighlighted: node.data?.isHighlighted,
    },
    data: {
      id: data.id,
      name: data.name,
      objectTypeId: data.object_type_id,
      properties: data.properties,
    },
    fx: node.position.x,
    fy: node.position.y,
  };
}

/** 统一节点模型转换为 ReactFlow Node */
export function convertToReactFlowNode(
  node: UnifiedOntologyNode,
  extraData?: Record<string, any>
): Node {
  return {
    id: String(node.id),
    type: 'ontology',
    position: node.position,
    data: {
      obj: node.data,
      ...extraData,
    },
  };
}

/** D3 GraphNode 转换为统一节点模型 */
export function convertD3GraphNode(node: GraphNode): UnifiedOntologyNode {
  return {
    id: node.id,
    label: node.label,
    group: node.group as NodeGroup,
    position: { x: node.x || 0, y: node.y || 0 },
    style: {
      color: node.color,
      size: node.size,
    },
    data: {
      id: node._objId,
      name: node.label,
      objectTypeId: node._typeId,
    },
    fx: node.fx,
    fy: node.fy,
    typeId: node._typeId,
    objId: node._objId,
    depth: node._focusLevel,
  };
}

/** 统一节点模型转换为 D3 GraphNode */
export function convertToD3GraphNode(node: UnifiedOntologyNode): GraphNode {
  return {
    id: node.id,
    label: node.label,
    group: node.group,
    color: node.style.color,
    size: node.style.size,
    description: node.data.description || node.label,
    x: node.position.x,
    y: node.position.y,
    fx: node.fx,
    fy: node.fy,
    _typeId: node.typeId,
    _objId: node.objId,
    _focusLevel: node.depth,
  };
}

/** ReactFlow Edge 转换为统一边模型 */
export function convertReactFlowEdge(edge: Edge): UnifiedOntologyEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    style: {
      color: '#64748b',
      strokeWidth: 1.5,
    },
    data: {
      id: Number(edge.id),
      linkTypeId: 1,
      weight: 0.5,
    },
    routingMode: edge.data?.routing as EdgeRoutingMode,
    routePoints: edge.data?.routePoints,
    laneOffset: edge.data?.laneOffset,
    isActive: edge.data?.isActive,
    isUpstream: edge.data?.isUpstreamLink,
  };
}

/** D3 GraphLink 转换为统一边模型 */
export function convertD3GraphLink(link: GraphLink): UnifiedOntologyEdge {
  return {
    id: `${link.source}|${link.target}`,
    source: typeof link.source === 'object' ? link.source.id : link.source,
    target: typeof link.target === 'object' ? link.target.id : link.target,
    style: {
      color: link.color,
      strokeWidth: 1.5 + (link.weight || 0.5) * 1.5,
      opacity: 0.3 + (link.weight || 0.5) * 0.5,
    },
    data: {
      id: 0,
      linkTypeId: link._linkTypeId,
      linkTypeName: link._linkTypeName,
      weight: link.weight,
    },
  };
}
