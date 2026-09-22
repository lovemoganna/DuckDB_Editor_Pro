/**
 * services/graphLayoutService.ts - 统一图谱布局服务
 * 
 * 设计目标：
 * 1. 统一管理所有布局算法（D3GraphView + ontologyLayoutEngine）
 * 2. 提供高性能的布局调用接口
 * 3. 内置性能监控和日志记录
 * 4. 支持布局状态持久化和同步
 * 
 * @module graphLayoutService
 */

import { graphlib, layout as dagreLayout } from 'dagre';
import { quadtree } from 'd3';
import type { GraphNode, GraphLink, LifeLink } from '../components/Library/D3GraphView/D3GraphView.types';

// ============================================================
// 类型定义
// ============================================================

/** 布局模式枚举 */
export type LayoutMode = 
  | 'spoke'              // 轮辐布局（中心辐射）
  | 'dandelion'          // 蒲公英布局（类型中心 + 实例环绕）
  | 'topologicalFlow'    // 拓扑流布局（语义层级）
  | 'dagre'              // Dagre 分层布局
  | 'concentric'         // 同心圆布局
  | 'circular'           // 环形布局
  | 'force'              // 力导向布局
  | 'grouped'            // 分组聚类布局
  | 'hierarchical'       // 层级布局
  | 'radial'             // 放射状布局
  | 'tree'               // 树形布局
  | 'grid'               // 网格布局
  | 'starburst'          // 星爆布局
  | 'groupedCircular'    // 分组环形布局
  | 'verticalTree'       // 纵向树布局
  | 'horizontalTree';    // 横向树布局

/** 布局选项配置 */
export interface LayoutOptions {
  /** 水平间距 */
  nodesep?: number;
  /** 垂直间距 */
  ranksep?: number;
  /** 布局方向 */
  direction?: 'LR' | 'TB';
  /** 最小半径 */
  minRadius?: number;
  /** 最大迭代次数 */
  maxIterations?: number;
  /** 聚焦节点 ID（用于局部布局） */
  focusedNodeId?: string | null;
}

/** 布局放置结果 */
export interface LayoutPlacement {
  x: number;
  y: number;
  depth: number;
  branchIndex: number;
  branchAngle: number;
  parentId: string | null;
  labelAnchor: 'start' | 'end' | 'middle';
}

/** 布局计算结果 */
export interface LayoutResult {
  placements: Map<string, LayoutPlacement>;
  rootId: string | null;
  branchCount: number;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

/** 关系束 */
export interface RelationBundle {
  id: string;
  sourceBranch: number;
  targetBranch: number;
  relationTypeIds: number[];
  links: GraphLink[];
  count: number;
}

/** 布局性能指标 */
export interface LayoutMetrics {
  /** 布局模式 */
  layoutMode: LayoutMode;
  /** 节点数量 */
  nodeCount: number;
  /** 边数量 */
  linkCount: number;
  /** 布局耗时（毫秒） */
  duration: number;
  /** 时间戳 */
  timestamp: number;
  /** 状态 */
  status: 'success' | 'error';
  /** 错误信息 */
  errorMessage?: string;
}

/** 布局统计信息 */
export interface LayoutStats {
  /** 平均耗时 */
  avgDuration: number;
  /** 最大耗时 */
  maxDuration: number;
  /** 最小耗时 */
  minDuration: number;
  /** 总调用次数 */
  totalCount: number;
  /** 错误次数 */
  errorCount: number;
}

// ============================================================
// 性能监控
// ============================================================

/** 布局指标历史记录（保留最近 100 条） */
const layoutMetricsHistory: LayoutMetrics[] = [];

/** 性能回调函数集合 */
const performanceCallbacks: Set<(metrics: LayoutMetrics) => void> = new Set();

/** 当前是否启用性能日志 */
let performanceLoggingEnabled = true;

/**
 * 记录布局性能指标
 */
function recordLayoutMetrics(metrics: LayoutMetrics): void {
  layoutMetricsHistory.push(metrics);
  // 保留最近 100 条记录
  if (layoutMetricsHistory.length > 100) {
    layoutMetricsHistory.shift();
  }
  // 触发所有回调
  performanceCallbacks.forEach(cb => {
    try {
      cb(metrics);
    } catch (error) {
      console.error('[Layout] Performance callback error:', error);
    }
  });
  // 控制台输出
  if (performanceLoggingEnabled) {
    if (metrics.status === 'error') {
      console.error(
        `[Layout] ❌ ${metrics.layoutMode} 布局失败: ${metrics.errorMessage}`,
        `节点数: ${metrics.nodeCount}, 边数: ${metrics.linkCount}, 耗时: ${metrics.duration.toFixed(2)}ms`
      );
    } else {
      const statusIcon = metrics.duration < 50 ? '✓' : metrics.duration < 200 ? '⚠' : '✗';
      console.log(
        `[Layout] ${statusIcon} ${metrics.layoutMode} 布局完成`,
        `节点: ${metrics.nodeCount}, 边: ${metrics.linkCount}, 耗时: ${metrics.duration.toFixed(2)}ms`
      );
    }
  }
}

// ============================================================
// 性能监控 API
// ============================================================

/**
 * 注册布局性能回调
 * @param callback - 性能回调函数
 * @returns 取消注册函数
 */
export function onLayoutPerformance(callback: (metrics: LayoutMetrics) => void): () => void {
  performanceCallbacks.add(callback);
  return () => performanceCallbacks.delete(callback);
}

/**
 * 获取布局性能历史
 * @param limit - 返回记录数量限制（默认全部）
 * @returns 性能指标数组
 */
export function getLayoutMetricsHistory(limit?: number): LayoutMetrics[] {
  if (limit !== undefined) {
    return layoutMetricsHistory.slice(-limit);
  }
  return [...layoutMetricsHistory];
}

/**
 * 获取布局性能统计
 * @returns 统计信息或 null（无数据时）
 */
export function getLayoutStats(): LayoutStats | null {
  if (layoutMetricsHistory.length === 0) return null;
  
  const durations = layoutMetricsHistory.map(m => m.duration);
  const errors = layoutMetricsHistory.filter(m => m.status === 'error').length;
  
  return {
    avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
    maxDuration: Math.max(...durations),
    minDuration: Math.min(...durations),
    totalCount: layoutMetricsHistory.length,
    errorCount: errors,
  };
}

/**
 * 清除布局性能历史
 */
export function clearLayoutMetrics(): void {
  layoutMetricsHistory.length = 0;
}

/**
 * 启用/禁用性能日志
 * @param enabled - 是否启用
 */
export function setLayoutPerformanceLogging(enabled: boolean): void {
  performanceLoggingEnabled = enabled;
}

// ============================================================
// 布局辅助函数
// ============================================================

/** 获取边的源节点 ID */
const linkNodeId = (value: string | GraphNode) => 
  typeof value === 'object' ? value.id : value;

/** 计算节点的度数 */
export function computeNodeDegrees(nodes: GraphNode[], links: GraphLink[]): Map<string, number> {
  const degrees = new Map<string, number>();
  nodes.forEach(n => degrees.set(n.id, 0));
  
  links.forEach(link => {
    const sId = linkNodeId(link.source);
    const tId = linkNodeId(link.target);
    degrees.set(sId, (degrees.get(sId) || 0) + 1);
    degrees.set(tId, (degrees.get(tId) || 0) + 1);
  });
  
  return degrees;
}

/** 获取度数最高的节点作为中心 */
export function findHubNode(nodes: GraphNode[], degrees: Map<string, number>): GraphNode | null {
  let maxDegree = -1;
  let hub: GraphNode | null = null;
  
  nodes.forEach(n => {
    const d = degrees.get(n.id) || 0;
    if (d > maxDegree) {
      maxDegree = d;
      hub = n;
    }
  });
  
  return hub;
}

/** 角度转弧度 */
export const degToRad = (deg: number) => (deg * Math.PI) / 180;

/** 弧度转角度 */
export const radToDeg = (rad: number) => (rad * 180) / Math.PI;

/** 标准化角度到 [-π, π] */
export function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

/**
 * 弹性防重叠 Pass：在保留整体拓扑结构和方向的前提下，消解近邻节点几何重叠
 */
export function resolveNodeOverlaps(
  nodes: GraphNode[],
  minDistMap?: (a: GraphNode, b: GraphNode) => number,
  iterations: number = 8,
  pinnedIds?: Set<string>
): void {
  const n = nodes.length;
  if (n <= 1) return;

  for (let iter = 0; iter < iterations; iter++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      const a = nodes[i];
      if (a.x == null || a.y == null) continue;
      const aPinned = pinnedIds?.has(a.id) ?? false;
      const rA = a.size || (a.group === 'typeHub' ? 28 : a.group === 'action' ? 10 : 12);

      for (let j = i + 1; j < n; j++) {
        const b = nodes[j];
        if (b.x == null || b.y == null) continue;
        const bPinned = pinnedIds?.has(b.id) ?? false;
        if (aPinned && bPinned) continue;

        const rB = b.size || (b.group === 'typeHub' ? 28 : b.group === 'action' ? 10 : 12);

        // Group-aware clearance incorporating node sizes and label safety envelopes
        let defaultGap = 36;
        if (a.group === 'action' || b.group === 'action') {
          defaultGap = 24;
        } else if (a.group === 'typeHub' && b.group === 'typeHub') {
          defaultGap = 72;
        } else if ((a.group === 'typeHub' && b.group === 'instance') || (a.group === 'instance' && b.group === 'typeHub')) {
          defaultGap = 54;
        } else if (a.group === 'instance' && b.group === 'instance') {
          defaultGap = 48;
        }

        const targetDist = minDistMap ? minDistMap(a, b) : (rA + rB + defaultGap);
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let distSq = dx * dx + dy * dy;

        // Handle coincident coordinates
        if (distSq < 0.01) {
          dx = ((i * 13 + j * 7) % 11 - 5) * 2 || 2;
          dy = ((i * 7 + j * 13) % 11 - 5) * 2 || -2;
          distSq = dx * dx + dy * dy;
        }

        if (distSq < targetDist * targetDist) {
          const dist = Math.sqrt(distSq) || 0.1;
          const overlap = targetDist - dist;
          const nx = (dx / dist) * overlap;
          const ny = (dy / dist) * overlap;

          if (aPinned) {
            b.x += nx;
            b.y += ny;
            if (b.fx !== null && b.fx !== undefined) { b.fx = b.x; b.fy = b.y; }
          } else if (bPinned) {
            a.x -= nx;
            a.y -= ny;
            if (a.fx !== null && a.fx !== undefined) { a.fx = a.x; a.fy = a.y; }
          } else {
            const aWeight = a.group === 'typeHub' ? 0.2 : a.group === 'action' ? 0.7 : 0.5;
            const bWeight = b.group === 'typeHub' ? 0.2 : b.group === 'action' ? 0.7 : 0.5;
            const totalW = aWeight + bWeight;

            a.x -= nx * (aWeight / totalW);
            a.y -= ny * (aWeight / totalW);
            b.x += nx * (bWeight / totalW);
            b.y += ny * (bWeight / totalW);

            if (a.fx !== null && a.fx !== undefined) { a.fx = a.x; a.fy = a.y; }
            if (b.fx !== null && b.fx !== undefined) { b.fx = b.x; b.fy = b.y; }
          }
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
}

// ============================================================
// 布局算法实现
// ============================================================

/**
 * 收缩跨分支的语义边
 */
export function aggregateCrossBranchLinks(
  links: GraphLink[], 
  nodeMap?: Map<string, GraphNode>
): GraphLink[] {
  const bundles = new Map<string, RelationBundle>();
  const keep: GraphLink[] = [];
  
  links.forEach(link => {
    const source = (typeof link.source === 'object' ? link.source : nodeMap?.get(link.source)) as GraphNode | null | undefined;
    const target = (typeof link.target === 'object' ? link.target : nodeMap?.get(link.target)) as GraphNode | null | undefined;
    
    if (typeof source !== 'object' || typeof target !== 'object' ||
        source.group !== 'instance' || target.group !== 'instance' ||
        source._branchIndex == null || target._branchIndex == null ||
        source._branchIndex === target._branchIndex) {
      keep.push(link);
      return;
    }
    
    const branchA = Math.min(source._branchIndex, target._branchIndex);
    const branchB = Math.max(source._branchIndex, target._branchIndex);
    const typeId = link._linkTypeId ?? 0;
    const key = `${branchA}|${branchB}|${typeId}`;
    
    const bundle = bundles.get(key) || {
      id: `bundle:${key}`,
      sourceBranch: branchA,
      targetBranch: branchB,
      relationTypeIds: typeId ? [typeId] : [],
      links: [],
      count: 0,
    };
    
    bundle.links.push(link);
    bundle.count += 1;
    bundles.set(key, bundle);
  });
  
  bundles.forEach(bundle => {
    const first = bundle.links[0];
    keep.push({
      ...first,
      _isRelationBundle: true,
      _bundleId: bundle.id,
      _bundleCount: bundle.count,
      _relations: bundle.links.map(link => link._linkTypeName || 'relation'),
      _mergedIndices: bundle.links.map((_, index) => index),
      color: 'rgba(255, 210, 92, 0.48)',
      weight: Math.max(...bundle.links.map(link => link.weight || 0.4)),
    });
  });
  
  return keep;
}

/**
 * 节点放置辅助函数
 */
function place(
  placements: Map<string, LayoutPlacement>,
  node: GraphNode,
  x: number,
  y: number,
  depth: number,
  branchIndex: number,
  branchAngle: number,
  parentId: string | null,
): void {
  const anchor: LayoutPlacement['labelAnchor'] = Math.abs(x) < 46 ? 'middle' : x < 0 ? 'end' : 'start';
  node.x = x;
  node.y = y;
  node.fx = x;
  node.fy = y;
  node._focusLevel = depth;
  node._branchIndex = branchIndex;
  node._branchAngle = branchAngle;
  node._parentId = parentId;
  placements.set(node.id, { x, y, depth, branchIndex, branchAngle, parentId, labelAnchor: anchor });
}

/**
 * 计算类型亲密度矩阵
 */
export function computeTypeAffinityMatrix(
  nodes: GraphNode[],
  links: GraphLink[]
): Map<string, number> {
  const nodeMap = new Map<string, GraphNode>(nodes.map(n => [n.id, n]));
  const typeAffinity = new Map<string, number>();

  links.forEach(l => {
    if (l._isTypeInstLink) return;
    const sId = linkNodeId(l.source);
    const tId = linkNodeId(l.target);
    const sNode = nodeMap.get(sId);
    const tNode = nodeMap.get(tId);
    if (!sNode || !tNode) return;
    
    const st = sNode._typeId;
    const tt = tNode._typeId;
    if (st !== undefined && tt !== undefined && st !== tt) {
      const key = st < tt ? `${st}|${tt}` : `${tt}|${st}`;
      typeAffinity.set(key, (typeAffinity.get(key) || 0) + (Number(l.weight) || 1));
    }
  });
  
  return typeAffinity;
}

/**
 * 贪婪圆形排序类型中心
 */
export function orderTypeHubsCirculary(
  hubs: GraphNode[],
  typeAffinity: Map<string, number>
): GraphNode[] {
  if (hubs.length <= 1) return [...hubs];
  if (typeAffinity.size === 0) {
    return [...hubs].sort((a, b) => (a._typeId ?? 0) - (b._typeId ?? 0) || a.id.localeCompare(b.id));
  }
  if (hubs.length <= 3) {
    return [...hubs].sort((a, b) => (a._typeId ?? 0) - (b._typeId ?? 0) || a.id.localeCompare(b.id));
  }
  
  const remaining = new Set(hubs);
  let bestStart = hubs[0];
  let maxWeight = -1;
  
  hubs.forEach(h => {
    let totalW = 0;
    hubs.forEach(other => {
      if (h === other) return;
      const key = (h._typeId ?? 0) < (other._typeId ?? 0) ? `${h._typeId}|${other._typeId}` : `${other._typeId}|${h._typeId}`;
      totalW += typeAffinity.get(key) || 0;
    });
    if (totalW > maxWeight) {
      maxWeight = totalW;
      bestStart = h;
    }
  });

  const orderedHubs: GraphNode[] = [bestStart];
  remaining.delete(bestStart);

  while (remaining.size > 0) {
    const current = orderedHubs[orderedHubs.length - 1];
    let bestNext: GraphNode | null = null;
    let bestW = -1;
    
    remaining.forEach(cand => {
      const key = (current._typeId ?? 0) < (cand._typeId ?? 0) ? `${current._typeId}|${cand._typeId}` : `${cand._typeId}|${current._typeId}`;
      const w = typeAffinity.get(key) || 0;
      if (w > bestW) {
        bestW = w;
        bestNext = cand;
      }
    });
    
    const chosen = bestNext || remaining.values().next().value!;
    orderedHubs.push(chosen);
    remaining.delete(chosen);
  }
  
  return orderedHubs;
}

// ============================================================
// 核心布局算法
// ============================================================

/**
 * 轮辐布局 - 中心辐射布局
 * 以度数最高的节点为中心，子节点沿射线分布
 */
export function applySpokeLayout(
  nodes: GraphNode[],
  links: GraphLink[],
  W: number,
  H: number,
  focusedNodeId?: string | null,
): LayoutResult {
  const start = performance.now();
  
  try {
    const instances = nodes.filter(node => node.group === 'instance').sort((a, b) => a.id.localeCompare(b.id));
    const nodeById = new Map(nodes.map(node => [node.id, node]));
    const adjacency = new Map<string, Set<string>>(instances.map(node => [node.id, new Set()]));
    
    links.forEach(link => {
      const source = nodeById.get(linkNodeId(link.source));
      const target = nodeById.get(linkNodeId(link.target));
      if (source?.group !== 'instance' || target?.group !== 'instance') return;
      adjacency.get(source.id)?.add(target.id);
      adjacency.get(target.id)?.add(source.id);
    });
    
    const degree = (id: string) => adjacency.get(id)?.size || 0;
    const root = nodeById.get(focusedNodeId || '')?.group === 'instance'
      ? nodeById.get(focusedNodeId!)!
      : instances.slice().sort((a, b) => degree(b.id) - degree(a.id) || a.id.localeCompare(b.id))[0] || null;
    
    const placements = new Map<string, LayoutPlacement>();
    if (!root) {
      return { placements, rootId: null, branchCount: 0, bounds: { minX: 0, minY: 0, maxX: W, maxY: H } };
    }

    const cx = W / 2;
    const cy = H / 2;
    const visited = new Set<string>([root.id]);
    const parentById = new Map<string, string | null>([[root.id, null]]);
    const depthById = new Map<string, number>([[root.id, 0]]);
    const childrenById = new Map<string, string[]>();
    const queue = [root.id];
    
    while (queue.length) {
      const current = queue.shift()!;
      const depth = depthById.get(current) || 0;
      if (depth >= 8) continue;
      
      const children = [...(adjacency.get(current) || [])]
        .filter(id => !visited.has(id))
        .sort((a, b) => degree(b) - degree(a) || a.localeCompare(b));
      
      childrenById.set(current, children);
      children.forEach(child => {
        visited.add(child);
        parentById.set(child, current);
        depthById.set(child, depth + 1);
        queue.push(child);
      });
    }

    place(placements, root, cx, cy, 0, 0, -Math.PI / 2, null);
    const branches = childrenById.get(root.id) || [];
    const branchCount = Math.max(branches.length, 1);
    const baseAngle = -Math.PI / 2;
    const branchStep = (Math.PI * 2) / branchCount;
    const branchDistance = Math.max(148, Math.min(W, H) * 0.24);

    branches.forEach((branchId, branchIndex) => {
      const angle = baseAngle + branchIndex * branchStep;
      const branchRoot = nodeById.get(branchId);
      if (!branchRoot) return;
      
      const branchRing = Math.floor(branchIndex / 18);
      const branchRadius = branchDistance + branchRing * 54;
      place(placements, branchRoot, cx + Math.cos(angle) * branchRadius, cy + Math.sin(angle) * branchRadius, 1, branchIndex, angle, root.id);
      
      const walk = (parentId: string, depth: number) => {
        const parent = nodeById.get(parentId);
        if (!parent || depth >= 8) return;
        const children = childrenById.get(parentId) || [];
        const spread = Math.min(0.82, Math.max(0.28, (children.length - 1) * 0.18));
        const radius = branchDistance + (depth - 1) * Math.max(118, Math.min(W, H) * 0.17);
        
        children.forEach((childId, index) => {
          const child = nodeById.get(childId);
          if (!child) return;
          const childAngle = angle + (children.length === 1 ? 0 : -spread / 2 + index * (spread / (children.length - 1)));
          place(placements, child, 
            cx + Math.cos(angle) * radius + Math.cos(childAngle + Math.PI / 2) * (index - (children.length - 1) / 2) * 75, 
            cy + Math.sin(angle) * radius + Math.sin(childAngle + Math.PI / 2) * (index - (children.length - 1) / 2) * 75, 
            depth, branchIndex, childAngle, parentId);
          walk(childId, depth + 1);
        });
      };
      walk(branchId, 2);
    });

    // 孤立节点作为外围卫星簇
    const disconnected = instances.filter(node => !visited.has(node.id));
    const satelliteRadius = Math.max(branchDistance * 2.15, Math.min(W, H) * 0.42);
    disconnected.forEach((node, index) => {
      const angle = baseAngle + ((index + 0.5) / Math.max(disconnected.length, 1)) * Math.PI * 2;
      const ring = Math.floor(index / 10);
      place(placements, node, 
        cx + Math.cos(angle) * (satelliteRadius + ring * 54), 
        cy + Math.sin(angle) * (satelliteRadius + ring * 54), 
        3, branchCount + index, angle, null);
    });

    // Action 节点放置在所属实例旁边
    const actionsByOwner = new Map<number, GraphNode[]>();
    nodes.filter(node => node.group === 'action').forEach(action => {
      const list = actionsByOwner.get(action._objId || 0) || [];
      list.push(action);
      actionsByOwner.set(action._objId || 0, list);
    });
    
    actionsByOwner.forEach((actions, ownerId) => {
      const owner = instances.find(node => node._objId === ownerId);
      if (!owner || owner.x == null || owner.y == null) return;
      const ownerPlacement = placements.get(owner.id)!;
      const spread = Math.min(0.75, Math.max(0.24, (actions.length - 1) * 0.18));
      
      actions.sort((a, b) => a.id.localeCompare(b.id)).forEach((action, index) => {
        const angle = ownerPlacement.branchAngle + (actions.length === 1 ? 0 : -spread / 2 + index * spread / (actions.length - 1));
        const distance = 48 + Math.floor(index / 6) * 24;
        place(placements, action, owner.x! + Math.cos(angle) * distance, owner.y! + Math.sin(angle) * distance, ownerPlacement.depth + 1, ownerPlacement.branchIndex, angle, owner.id);
      });
    });

    // TypeHub 节点
    nodes.filter(node => node.group === 'typeHub').forEach((hub, index) => {
      const member = instances.find(node => node._typeId === hub._typeId && placements.has(node.id));
      const angle = member ? placements.get(member.id)!.branchAngle : baseAngle + index * branchStep;
      const x = member?.x != null ? member.x - Math.cos(angle) * 85 : cx + Math.cos(angle) * 110;
      const y = member?.y != null ? member.y - Math.sin(angle) * 85 : cy + Math.sin(angle) * 110;
      place(placements, hub, x, y, member ? placements.get(member.id)!.depth : 1, member ? placements.get(member.id)!.branchIndex : index, angle, member?.id || null);
    });

    resolveNodeOverlaps(nodes, undefined, 8, new Set([root.id]));

    // Sync updated positions to placements
    nodes.forEach(n => {
      const p = placements.get(n.id);
      if (p && n.x != null && n.y != null) {
        p.x = n.x;
        p.y = n.y;
      }
    });

    const points = [...placements.values()];
    const result: LayoutResult = {
      placements,
      rootId: root.id,
      branchCount,
      bounds: {
        minX: Math.min(...points.map(point => point.x)), 
        minY: Math.min(...points.map(point => point.y)),
        maxX: Math.max(...points.map(point => point.x)), 
        maxY: Math.max(...points.map(point => point.y)),
      },
    };
    
    recordLayoutMetrics({
      layoutMode: 'spoke',
      nodeCount: nodes.length,
      linkCount: links.length,
      duration: performance.now() - start,
      timestamp: Date.now(),
      status: 'success',
    });
    
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    recordLayoutMetrics({
      layoutMode: 'spoke',
      nodeCount: nodes.length,
      linkCount: links.length,
      duration: performance.now() - start,
      timestamp: Date.now(),
      status: 'error',
      errorMessage,
    });
    throw error;
  }
}

/**
 * 蒲公英布局 - 类型中心 + 实例环绕
 * 核心特点：
 * 1. TypeHub 作为花心
 * 2. Instance 按类型扇形分布
 * 3. Action 作为外向花瓣
 */
export function applyDandelionLayout(
  nodes: GraphNode[],
  links: GraphLink[],
  W: number,
  H: number
): void {
  const start = performance.now();
  
  try {
    const cx = W / 2;
    const cy = H / 2;

    const semanticLinks = (links || []).filter(l => !l._isTypeInstLink);
    const typeAffinity = computeTypeAffinityMatrix(nodes, semanticLinks);
    const typeHubs = orderTypeHubsCirculary(
      nodes.filter(n => n.group === 'typeHub'),
      typeAffinity
    );
    const instances = nodes.filter(n => n.group === 'instance');
    const actions = nodes.filter(n => n.group === 'action');
    const typeCount = Math.max(typeHubs.length, 1);

    // Hub 轨道半径
    const hubRadius = typeCount === 1 ? 0 : Math.min(160, Math.max(100, Math.min(W, H) * 0.20));
    const sectorSize = (Math.PI * 2) / typeCount;
    const hubAngle = (index: number) => -Math.PI / 2 + index * sectorSize;

    const hubAngles = new Map<number, number>();
    typeHubs.forEach((hub, index) => {
      const angle = hubAngle(index);
      hub.x = cx + Math.cos(angle) * hubRadius;
      hub.y = cy + Math.sin(angle) * hubRadius;
      hub.fx = hub.x;
      hub.fy = hub.y;
      if (hub._typeId !== undefined) {
        hubAngles.set(hub._typeId, angle);
      }
    });

    // 按类型分组实例
    const instancesByType = new Map<number, GraphNode[]>();
    instances.forEach(node => {
      const list = instancesByType.get(node._typeId || 0) || [];
      list.push(node);
      instancesByType.set(node._typeId || 0, list);
    });

    // 计算每个实例的目标外部方向
    const nodeTargetAngle = new Map<string, number>();
    if (semanticLinks.length > 0) {
      const nodeMap = new Map<string, GraphNode>(nodes.map(n => [n.id, n]));
      const nodeVec = new Map<string, { dx: number; dy: number; count: number }>();
      instances.forEach(n => nodeVec.set(n.id, { dx: 0, dy: 0, count: 0 }));

      semanticLinks.forEach(l => {
        const sId = linkNodeId(l.source);
        const tId = linkNodeId(l.target);
        const sNode = nodeMap.get(sId);
        const tNode = nodeMap.get(tId);
        if (!sNode || !tNode || sNode._typeId === tNode._typeId) return;

        const sAngle = hubAngles.get(sNode._typeId ?? -1) ?? 0;
        const tAngle = hubAngles.get(tNode._typeId ?? -1) ?? 0;
        const sV = nodeVec.get(sId);
        if (sV) { sV.dx += Math.cos(tAngle); sV.dy += Math.sin(tAngle); sV.count++; }
        const tV = nodeVec.get(tId);
        if (tV) { tV.dx += Math.cos(sAngle); tV.dy += Math.sin(sAngle); tV.count++; }
      });

      nodeVec.forEach((v, id) => {
        if (v.count > 0) nodeTargetAngle.set(id, Math.atan2(v.dy, v.dx));
      });
    }

    // 分布类型扇形内的实例
    typeHubs.forEach((hub, typeIndex) => {
      const list = instancesByType.get(hub._typeId || 0) || [];
      const centerAngle = hubAngle(typeIndex);
      const sectorStart = centerAngle - sectorSize * 0.38;
      const span = Math.max(sectorSize * 0.62, Math.PI / 3);

      list.sort((a, b) => {
        const angleA = nodeTargetAngle.get(a.id);
        const angleB = nodeTargetAngle.get(b.id);
        if (angleA != null && angleB != null) {
          let diffA = angleA - centerAngle;
          while (diffA > Math.PI) diffA -= Math.PI * 2;
          while (diffA < -Math.PI) diffA += Math.PI * 2;

          let diffB = angleB - centerAngle;
          while (diffB > Math.PI) diffB -= Math.PI * 2;
          while (diffB < -Math.PI) diffB += Math.PI * 2;

          return diffA - diffB || a.id.localeCompare(b.id);
        }
        if (angleA != null) return -1;
        if (angleB != null) return 1;
        return a.id.localeCompare(b.id);
      });

      const minLeafGap = 85;
      const maxPerRing = Math.max(2, Math.floor((span * 240) / minLeafGap));
      
      list.forEach((node, index) => {
        const ring = Math.floor(index / maxPerRing);
        const inRing = index % maxPerRing;
        const ringSize = Math.min(maxPerRing, list.length - ring * maxPerRing);
        const t = ringSize <= 1 ? 0.5 : inRing / (ringSize - 1);
        const angle = sectorStart + t * span;
        const radius = Math.max(260, Math.min(W, H) * 0.40) + ring * 100;
        node.x = cx + Math.cos(angle) * radius;
        node.y = cy + Math.sin(angle) * radius;
        node.fx = node.x;
        node.fy = node.y;
      });
    });

    // 未定位的实例回退
    const positionedInstances = new Set(
      typeHubs.flatMap(hub => instancesByType.get(hub._typeId || 0) || [])
    );
    instances.filter(node => !positionedInstances.has(node)).forEach((node, index, list) => {
      const angle = -Math.PI / 2 + (index / Math.max(list.length, 1)) * Math.PI * 2;
      const radius = Math.max(184, Math.min(W, H) * 0.31);
      node.x = cx + Math.cos(angle) * radius;
      node.y = cy + Math.sin(angle) * radius;
      node.fx = node.x;
      node.fy = node.y;
    });

    // Action 节点
    const actionsByOwner = new Map<number, GraphNode[]>();
    actions.forEach(node => {
      const list = actionsByOwner.get(node._objId || 0) || [];
      list.push(node);
      actionsByOwner.set(node._objId || 0, list);
    });
    
    actionsByOwner.forEach((list, ownerId) => {
      const owner = instances.find(n => n._objId === ownerId);
      if (!owner || owner.x == null || owner.y == null) return;
      const outward = Math.atan2(owner.y - cy, owner.x - cx);
      const span = Math.min(Math.PI * 0.72, Math.max(Math.PI / 5, (list.length - 1) * 0.24));
      
      list.sort((a, b) => a.id.localeCompare(b.id)).forEach((node, index) => {
        const t = list.length <= 1 ? 0.5 : index / (list.length - 1);
        const angle = outward - span / 2 + t * span;
        const radius = 52 + Math.floor(index / 5) * 24;
        node.x = owner.x! + Math.cos(angle) * radius;
        node.y = owner.y! + Math.sin(angle) * radius;
        node.fx = node.x;
        node.fy = node.y;
      });
    });

    resolveNodeOverlaps(nodes);

    recordLayoutMetrics({
      layoutMode: 'dandelion',
      nodeCount: nodes.length,
      linkCount: links.length,
      duration: performance.now() - start,
      timestamp: Date.now(),
      status: 'success',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    recordLayoutMetrics({
      layoutMode: 'dandelion',
      nodeCount: nodes.length,
      linkCount: links.length,
      duration: performance.now() - start,
      timestamp: Date.now(),
      status: 'error',
      errorMessage,
    });
    throw error;
  }
}

/**
 * 拓扑流布局 - 语义层级流式布局
 * 核心设计：
 * 1. 优先减少无意义的边交叉
 * 2. 保持存在关系的节点合理接近
 * 3. 根据节点层级和关系类型组织位置
 */
export function applyTopologicalFlowLayout(
  nodes: GraphNode[],
  links: GraphLink[],
  svgW: number,
  svgH: number,
  options: LayoutOptions = {}
): void {
  const start = performance.now();
  
  try {
    if (nodes.length === 0) return;
    
    const cx = svgW / 2;
    const cy = svgH / 2;
    const { ranksep = 380, nodesep = 180, direction = 'LR' } = options;
    const isTB = direction === 'TB';

    const hubs = nodes.filter(n => n.group === 'typeHub');
    const instances = nodes.filter(n => n.group === 'instance');
    const actions = nodes.filter(n => n.group === 'action');
    const primaryNodes = instances.length > 0 ? instances : nodes.filter(n => n.group !== 'typeHub' && n.group !== 'action');
    const nodeMap = new Map<string, GraphNode>(nodes.map(n => [n.id, n]));

    // 构建有向图邻接表
    const outgoing = new Map<string, Set<string>>();
    const incoming = new Map<string, Set<string>>();
    primaryNodes.forEach(n => {
      outgoing.set(n.id, new Set());
      incoming.set(n.id, new Set());
    });

    const semanticLinks = links.filter(l => !l._isTypeInstLink);
    semanticLinks.forEach(l => {
      const sId = linkNodeId(l.source);
      const tId = linkNodeId(l.target);
      if (outgoing.has(sId) && incoming.has(tId) && sId !== tId) {
        outgoing.get(sId)!.add(tId);
        incoming.get(tId)!.add(sId);
      }
    });

    // 循环检测
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const backEdges = new Set<string>();

    function detectBackEdges(u: string) {
      visited.add(u);
      inStack.add(u);
      for (const v of outgoing.get(u) || []) {
        if (!visited.has(v)) {
          detectBackEdges(v);
        } else if (inStack.has(v)) {
          backEdges.add(`${u}|${v}`);
        }
      }
      inStack.delete(u);
    }

    primaryNodes.forEach(n => {
      if (!visited.has(n.id)) detectBackEdges(n.id);
    });

    // 拓扑排序 + 最长路径
    const ranks = new Map<string, number>();
    const dagInDegree = new Map<string, number>();
    primaryNodes.forEach(n => {
      let deg = 0;
      for (const p of incoming.get(n.id) || []) {
        if (!backEdges.has(`${p}|${n.id}`)) deg++;
      }
      dagInDegree.set(n.id, deg);
    });

    let queue: string[] = primaryNodes.filter(n => (dagInDegree.get(n.id) || 0) === 0).map(n => n.id);
    if (queue.length === 0 && primaryNodes.length > 0) {
      const sorted = [...primaryNodes].sort((a, b) => {
        const netA = (outgoing.get(a.id)?.size || 0) - (incoming.get(a.id)?.size || 0);
        const netB = (outgoing.get(b.id)?.size || 0) - (incoming.get(b.id)?.size || 0);
        return netB - netA || a.id.localeCompare(b.id);
      });
      queue = [sorted[0].id];
    }
    queue.forEach(id => ranks.set(id, 0));

    let cursor = 0;
    while (cursor < queue.length) {
      const u = queue[cursor++];
      const rU = ranks.get(u) || 0;
      for (const v of outgoing.get(u) || []) {
        if (backEdges.has(`${u}|${v}`)) continue;
        const nextR = rU + 1;
        if (!ranks.has(v) || ranks.get(v)! < nextR) {
          ranks.set(v, nextR);
          queue.push(v);
        }
      }
    }

    primaryNodes.forEach(n => {
      if (!ranks.has(n.id)) ranks.set(n.id, 0);
    });

    // 分配层级
    const allRanks = Array.from(new Set(primaryNodes.map(n => ranks.get(n.id) || 0))).sort((a, b) => a - b);
    const rankMap = new Map(allRanks.map((r, i) => [r, i]));
    primaryNodes.forEach(n => {
      n._topologicalRank = rankMap.get(ranks.get(n.id) || 0) || 0;
    });

    const K = Math.max(allRanks.length, 1);
    const layers: GraphNode[][] = Array.from({ length: K }, () => []);
    primaryNodes.forEach(n => {
      layers[n._topologicalRank as number].push(n);
    });

    // 重心法交叉减少
    for (let sweep = 0; sweep < 8; sweep++) {
      const isForward = sweep % 2 === 0;
      for (let layerIdx = isForward ? 1 : K - 2; 
           isForward ? layerIdx < K : layerIdx >= 0; 
           layerIdx += isForward ? 1 : -1) {
        
        const prevLayer = isForward ? layers[layerIdx - 1] : layers[layerIdx + 1];
        if (!prevLayer) continue;
        
        const prevPosMap = new Map(prevLayer.map((n, i) => [n.id, i]));
        const currLayer = layers[layerIdx];
        
        currLayer.sort((a, b) => {
          const predsA = Array.from(incoming.get(a.id) || []).filter(id => prevPosMap.has(id));
          const predsB = Array.from(incoming.get(b.id) || []).filter(id => prevPosMap.has(id));
          
          const bcA = predsA.length > 0
            ? predsA.reduce((sum, id) => sum + prevPosMap.get(id)!, 0) / predsA.length
            : currLayer.indexOf(a);
          const bcB = predsB.length > 0
            ? predsB.reduce((sum, id) => sum + prevPosMap.get(id)!, 0) / predsB.length
            : currLayer.indexOf(b);
          
          return bcA - bcB || (a._typeId ?? 0) - (b._typeId ?? 0) || a.id.localeCompare(b.id);
        });
      }
    }

    // 计算最大边跨度
    let maxEdgeSpan = 1;
    semanticLinks.forEach(l => {
      const sId = linkNodeId(l.source);
      const tId = linkNodeId(l.target);
      const sRank = nodeMap.get(sId)?._topologicalRank as number | undefined;
      const tRank = nodeMap.get(tId)?._topologicalRank as number | undefined;
      if (sRank !== undefined && tRank !== undefined) {
        maxEdgeSpan = Math.max(maxEdgeSpan, Math.abs(tRank - sRank));
      }
    });

    const channelExpansion = Math.min(80, (maxEdgeSpan - 1) * 18);

    // 布局位置计算
    if (isTB) {
      const baseRowSpacing = Math.max(ranksep, Math.min(320, (svgH - 120) / Math.max(K - 1, 1)));
      const rowSpacing = (options.ranksep ?? baseRowSpacing) + channelExpansion;
      const totalHeight = (K - 1) * rowSpacing;
      const startY = cy - totalHeight / 2;

      layers.forEach((layerNodes, layerIdx) => {
        const rowY = startY + layerIdx * rowSpacing;
        const layerLen = layerNodes.length;
        const colSpacing = Math.max(nodesep, (svgW - 120) / Math.max(layerLen, 1));
        const rowWidth = (layerLen - 1) * colSpacing;
        const startX = cx - rowWidth / 2;

        layerNodes.forEach((node, nodeIdx) => {
          node.x = startX + nodeIdx * colSpacing;
          node.y = rowY;
          node.fx = node.x;
          node.fy = node.y;
        });
      });
    } else {
      // 自适应列间距：针对水平层级树（LR），将全图宽度自适应收敛在安全可视区间内（~800px-1080px），
      // 确保任意层级（3~6层）均获得与初始化载入（Palantir元本体，scale: ~0.88）完全一致的大字号、适中边长与舒适边距
      const maxAllowedWidth = Math.min(Math.max(svgW - 140, 720), 1080);
      const adaptiveColSpacing = Math.min(320, Math.max(180, Math.floor(maxAllowedWidth / Math.max(K - 1, 1))));
      const colSpacing = (options.ranksep ?? adaptiveColSpacing) + Math.min(channelExpansion, 20);
      const totalWidth = (K - 1) * colSpacing;
      const startX = cx - totalWidth / 2;

      layers.forEach((layerNodes, layerIdx) => {
        const colX = startX + layerIdx * colSpacing;
        const layerLen = layerNodes.length;
        const rowSpacing = Math.max(nodesep, (svgH - 120) / Math.max(layerLen, 1));
        const colHeight = (layerLen - 1) * rowSpacing;
        const startY = cy - colHeight / 2;

        layerNodes.forEach((node, nodeIdx) => {
          node.x = colX;
          node.y = startY + nodeIdx * rowSpacing;
          node.fx = node.x;
          node.fy = node.y;
        });
      });
    }

    // Action 节点
    const instanceMap = new Map<number, GraphNode>();
    primaryNodes.forEach(n => {
      if (n._objId !== undefined) instanceMap.set(n._objId, n);
    });

    const actionsByOwner = new Map<number, GraphNode[]>();
    actions.forEach(act => {
      const list = actionsByOwner.get(act._objId ?? -1) || [];
      list.push(act);
      actionsByOwner.set(act._objId ?? -1, list);
    });

    actionsByOwner.forEach((actList, ownerId) => {
      const owner = instanceMap.get(ownerId);
      if (owner && owner.x != null && owner.y != null) {
        const actSpacing = 26;
        const actStartX = owner.x - ((actList.length - 1) * actSpacing) / 2;
        actList.forEach((act, actIdx) => {
          act.x = actStartX + actIdx * actSpacing;
          act.y = owner.y! + 36;
          act.fx = act.x;
          act.fy = act.y;
        });
      } else {
        actList.forEach((act, idx) => {
          act.x = cx + 260;
          act.y = cy + (idx - actList.length / 2) * 28;
          act.fx = act.x;
          act.fy = act.y;
        });
      }
    });

    // TypeHub 节点布局：统一放置在整个图谱实体层的上方（或侧边），形成清晰优雅的元模型概念头部（Header Tier）
    const allInstY = instances.map(i => i.y ?? cy);
    const globalMinInstY = allInstY.length > 0 ? Math.min(...allInstY) : cy;
    const allInstX = instances.map(i => i.x ?? cx);
    const globalMinInstX = allInstX.length > 0 ? Math.min(...allInstX) : cx;

    const hubPositions: Array<{ hub: GraphNode; targetX: number; targetY: number }> = [];
    hubs.forEach((hub, idx) => {
      const typeInsts = instances.filter(i => i._typeId === hub._typeId);
      let targetX = cx;
      let targetY = cy;
      if (typeInsts.length > 0) {
        const avgX = typeInsts.reduce((sum, i) => sum + (i.x ?? cx), 0) / typeInsts.length;
        const avgY = typeInsts.reduce((sum, i) => sum + (i.y ?? cy), 0) / typeInsts.length;
        if (isTB) {
          targetX = globalMinInstX - 110;
          targetY = avgY;
        } else {
          targetX = avgX;
          targetY = globalMinInstY - 110;
        }
      } else {
        if (isTB) {
          targetX = globalMinInstX - 110;
          targetY = cy + (idx - hubs.length / 2) * 120;
        } else {
          targetX = cx + (idx - hubs.length / 2) * 160;
          targetY = globalMinInstY - 110;
        }
      }
      hubPositions.push({ hub, targetX, targetY });
    });

    // 针对横向树布局，若多个 TypeHub 在顶部水平间距过近，做弹性错开，防止重叠
    if (!isTB && hubPositions.length > 1) {
      hubPositions.sort((a, b) => a.targetX - b.targetX);
      const minHubSpacing = 160;
      for (let i = 1; i < hubPositions.length; i++) {
        const prev = hubPositions[i - 1];
        const curr = hubPositions[i];
        if (curr.targetX - prev.targetX < minHubSpacing) {
          curr.targetX = prev.targetX + minHubSpacing;
        }
      }
    }

    hubPositions.forEach(({ hub, targetX, targetY }) => {
      hub.x = targetX;
      hub.y = targetY;
      hub.fx = hub.x;
      hub.fy = hub.y;
    });

    resolveNodeOverlaps(nodes);

    recordLayoutMetrics({
      layoutMode: 'topologicalFlow',
      nodeCount: nodes.length,
      linkCount: links.length,
      duration: performance.now() - start,
      timestamp: Date.now(),
      status: 'success',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    recordLayoutMetrics({
      layoutMode: 'topologicalFlow',
      nodeCount: nodes.length,
      linkCount: links.length,
      duration: performance.now() - start,
      timestamp: Date.now(),
      status: 'error',
      errorMessage,
    });
    throw error;
  }
}

/**
 * Dagre 分层布局
 */
export function applyDagreLayout(
  nodes: GraphNode[],
  links: GraphLink[],
  W: number,
  H: number
): void {
  const start = performance.now();
  
  try {
    const g = new graphlib.Graph();
    g.setGraph({
      rankdir: 'TB',
      nodesep: 160,
      edgesep: 65,
      ranksep: 180,
      marginx: 60,
      marginy: 60
    });
    g.setDefaultEdgeLabel(() => ({}));

    nodes.forEach(n => {
      const labelLen = String(n.label || n.description || n.id).length;
      const labelWidth = Math.max(90, Math.min(180, labelLen * 8.5 + 36));
      const isHub = n.group === 'typeHub';
      const width = isHub ? Math.max(labelWidth, 120) : Math.max(labelWidth, 90);
      const height = isHub ? 52 : 44;
      g.setNode(n.id, { width, height });
    });

    const semanticLinks = links.filter(l => !l._isTypeInstLink);
    const linksToUse = semanticLinks.length > 0 ? semanticLinks : links;

    linksToUse.forEach(l => {
      const sId = linkNodeId(l.source);
      const tId = linkNodeId(l.target);
      if (sId && tId && sId !== tId) {
        g.setEdge(sId, tId);
      }
    });

    dagreLayout(g);

    // TypeHub 节点优雅放置
    const instanceNodes = nodes.filter(n => n.group === 'instance');
    const typeHubNodes = nodes.filter(n => n.group === 'typeHub');
    typeHubNodes.forEach(hub => {
      const owned = instanceNodes.filter(n => n._typeId === hub._typeId);
      if (owned.length > 0) {
        const avgX = owned.reduce((sum, n) => sum + (g.node(n.id)?.x || 0), 0) / owned.length;
        const minY = Math.min(...owned.map(n => g.node(n.id)?.y || 0));
        g.setNode(hub.id, { x: avgX, y: minY - 90 });
      }
    });

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    nodes.forEach(n => {
      const dn = g.node(n.id);
      if (dn) {
        minX = Math.min(minX, dn.x);
        maxX = Math.max(maxX, dn.x);
        minY = Math.min(minY, dn.y);
        maxY = Math.max(maxY, dn.y);
      }
    });

    const dagreW = maxX - minX || 1;
    const dagreH = maxY - minY || 1;
    const padding = 60;
    const scaleX = (W - padding * 2) / dagreW;
    const scaleY = (H - padding * 2) / dagreH;
    // 保障节点间距不被暴力压缩，由 D3 视口处理缩放适配
    const scale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.85), 1.15);

    const cx = W / 2;
    const cy = H / 2;
    const dagreCx = minX + dagreW / 2;
    const dagreCy = minY + dagreH / 2;

    nodes.forEach(n => {
      const dn = g.node(n.id);
      if (dn) {
        n.x = cx + (dn.x - dagreCx) * scale;
        n.y = cy + (dn.y - dagreCy) * scale;
        if (!(n as any)._userPinned) {
          n.fx = n.x;
          n.fy = n.y;
        }
      }
    });

    resolveNodeOverlaps(nodes);

    recordLayoutMetrics({
      layoutMode: 'dagre',
      nodeCount: nodes.length,
      linkCount: links.length,
      duration: performance.now() - start,
      timestamp: Date.now(),
      status: 'success',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    recordLayoutMetrics({
      layoutMode: 'dagre',
      nodeCount: nodes.length,
      linkCount: links.length,
      duration: performance.now() - start,
      timestamp: Date.now(),
      status: 'error',
      errorMessage,
    });
    throw error;
  }
}

/**
 * 同心圆布局
 */
export function applyConcentricLayout(
  nodes: GraphNode[],
  W: number,
  H: number,
  links?: GraphLink[]
): void {
  const start = performance.now();
  
  try {
    const cx = W / 2;
    const cy = H / 2;

    const typeHubs = nodes.filter(n => n.group === 'typeHub');
    const instances = nodes.filter(n => n.group === 'instance');
    const actions = nodes.filter(n => n.group === 'action');

    const semanticLinks = (links || []).filter(l => !l._isTypeInstLink);
    const typeAffinity = computeTypeAffinityMatrix(nodes, semanticLinks);
    const orderedHubs = orderTypeHubsCirculary(typeHubs, typeAffinity);
    const typeCount = Math.max(orderedHubs.length, 1);

    // 内圈：TypeHub (单 Hub 居于同心圆中心，多 Hub 则保持紧凑内轨 <= 150px)
    const innerR = typeCount === 1 ? 0 : Math.max(100, Math.min(150, Math.min(W, H) * 0.20));
    const hubAngles = new Map<number, number>();

    orderedHubs.forEach((hub, i) => {
      const angle = (i / typeCount) * Math.PI * 2 - Math.PI / 2;
      hub.x = cx + innerR * Math.cos(angle);
      hub.y = cy + innerR * Math.sin(angle);
      hub.fx = hub.x;
      hub.fy = hub.y;
      if (hub._typeId !== undefined) {
        hubAngles.set(hub._typeId, angle);
      }
    });

    // 中圈：Instance
    const instancesByType = new Map<number, GraphNode[]>();
    instances.forEach(n => {
      const list = instancesByType.get(n._typeId || 0) || [];
      list.push(n);
      instancesByType.set(n._typeId || 0, list);
    });

    const baseMiddleR = Math.max(320, Math.min(450, Math.min(W, H) * 0.44));
    const sectorSpan = (Math.PI * 2) / typeCount;

    orderedHubs.forEach(hub => {
      const tid = hub._typeId ?? 0;
      const list = instancesByType.get(tid) || [];
      if (list.length === 0) return;

      const centerAngle = hubAngles.get(tid) ?? -Math.PI / 2;
      const arcHalfSpan = Math.min(sectorSpan * 0.44, Math.PI / 2);

      list.sort((a, b) => a.id.localeCompare(b.id));
      
      list.forEach((node, idx) => {
        const t = list.length <= 1 ? 0.5 : idx / (list.length - 1);
        const angle = centerAngle + (t * 2 - 1) * arcHalfSpan;
        const r = baseMiddleR + Math.floor(idx / 3) * 90;
        
        node.x = cx + r * Math.cos(angle);
        node.y = cy + r * Math.sin(angle);
        node.fx = node.x;
        node.fy = node.y;
      });
    });

    // 外圈：Action
    const instanceObjMap = new Map<number, GraphNode>();
    instances.forEach(n => {
      if (n._objId !== undefined) instanceObjMap.set(n._objId, n);
    });

    actions.forEach((act, idx) => {
      const owner = instanceObjMap.get(act._objId || -1);
      if (owner && owner.x != null && owner.y != null) {
        const outward = Math.atan2(owner.y - cy, owner.x - cx);
        const angle = outward + ((idx % 3) - 1) * 0.4;
        act.x = owner.x + Math.cos(angle) * 40;
        act.y = owner.y + Math.sin(angle) * 40;
        act.fx = act.x;
        act.fy = act.y;
      } else {
        act.x = cx + baseMiddleR * 1.3 * Math.cos(idx / actions.length * Math.PI * 2);
        act.y = cy + baseMiddleR * 1.3 * Math.sin(idx / actions.length * Math.PI * 2);
        act.fx = act.x;
        act.fy = act.y;
      }
    });

    resolveNodeOverlaps(nodes);

    recordLayoutMetrics({
      layoutMode: 'concentric',
      nodeCount: nodes.length,
      linkCount: links?.length ?? 0,
      duration: performance.now() - start,
      timestamp: Date.now(),
      status: 'success',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    recordLayoutMetrics({
      layoutMode: 'concentric',
      nodeCount: nodes.length,
      linkCount: links?.length ?? 0,
      duration: performance.now() - start,
      timestamp: Date.now(),
      status: 'error',
      errorMessage,
    });
    throw error;
  }
}

/**
 * 环形布局
 */
export function applyCircularLayout(
  nodes: GraphNode[],
  svgW: number,
  svgH: number,
  options: LayoutOptions = {}
): void {
  const start = performance.now();
  
  try {
    if (nodes.length === 0) return;
    
    const cx = svgW / 2;
    const cy = svgH / 2;
    const { minRadius = 200 } = options;

    const r = Math.max(minRadius, Math.min(350, Math.min(svgW, svgH) * 0.38));
    
    nodes.forEach((node, idx) => {
      const angle = (idx / nodes.length) * Math.PI * 2 - Math.PI / 2;
      node.x = cx + r * Math.cos(angle);
      node.y = cy + r * Math.sin(angle);
      node.fx = node.x;
      node.fy = node.y;
    });

    recordLayoutMetrics({
      layoutMode: 'circular',
      nodeCount: nodes.length,
      linkCount: 0,
      duration: performance.now() - start,
      timestamp: Date.now(),
      status: 'success',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    recordLayoutMetrics({
      layoutMode: 'circular',
      nodeCount: nodes.length,
      linkCount: 0,
      duration: performance.now() - start,
      timestamp: Date.now(),
      status: 'error',
      errorMessage,
    });
    throw error;
  }
}

/**
 * 社区重心布局
 */
export function applyCommunityCentricBarycentricLayout(
  nodes: GraphNode[],
  links: GraphLink[],
  svgW: number,
  svgH: number
): void {
  const start = performance.now();
  
  try {
    const cx = svgW / 2;
    const cy = svgH / 2;
    const hubs = nodes.filter(n => n.group === 'typeHub').sort((a, b) => (a._typeId ?? 0) - (b._typeId ?? 0));
    const instances = nodes.filter(n => n.group === 'instance');
    const actions = nodes.filter(n => n.group === 'action');
    const typeCount = Math.max(hubs.length, 1);

    const instancesByType = new Map<number, GraphNode[]>();
    instances.forEach(n => {
      const tid = n._typeId ?? 0;
      const list = instancesByType.get(tid) || [];
      list.push(n);
      instancesByType.set(tid, list);
    });

    const nodeMap = new Map<string, GraphNode>(nodes.map(n => [n.id, n]));
    const typeAffinity = computeTypeAffinityMatrix(nodes, links);

    // 贪婪圆形排序
    let orderedHubs: GraphNode[] = [];
    if (hubs.length <= 3) {
      orderedHubs = [...hubs];
    } else {
      const remaining = new Set(hubs);
      let bestStart = hubs[0];
      let maxWeight = -1;
      
      hubs.forEach(h => {
        let totalW = 0;
        hubs.forEach(other => {
          if (h === other) return;
          const key = (h._typeId ?? 0) < (other._typeId ?? 0) ? `${h._typeId}|${other._typeId}` : `${other._typeId}|${h._typeId}`;
          totalW += typeAffinity.get(key) || 0;
        });
        if (totalW > maxWeight) {
          maxWeight = totalW;
          bestStart = h;
        }
      });

      orderedHubs.push(bestStart);
      remaining.delete(bestStart);

      while (remaining.size > 0) {
        const current = orderedHubs[orderedHubs.length - 1];
        let bestNext: GraphNode | null = null;
        let bestW = -1;
        
        remaining.forEach(cand => {
          const key = (current._typeId ?? 0) < (cand._typeId ?? 0) ? `${current._typeId}|${cand._typeId}` : `${cand._typeId}|${current._typeId}`;
          const w = typeAffinity.get(key) || 0;
          if (w > bestW) {
            bestW = w;
            bestNext = cand;
          }
        });
        
        const chosen = bestNext || remaining.values().next().value!;
        orderedHubs.push(chosen);
        remaining.delete(chosen);
      }
    }

    const orbitRadiusX = Math.max(220, svgW * (typeCount <= 3 ? 0.34 : 0.42));
    const orbitRadiusY = Math.max(180, svgH * (typeCount <= 3 ? 0.32 : 0.40));
    const hubCenters = new Map<number, { x: number; y: number; angle: number }>();

    orderedHubs.forEach((hub, i) => {
      const angle = (i / typeCount) * Math.PI * 2 - Math.PI / 2;
      const hx = cx + Math.cos(angle) * orbitRadiusX;
      const hy = cy + Math.sin(angle) * orbitRadiusY;
      hub.x = hx;
      hub.y = hy;
      hub.fx = hx;
      hub.fy = hy;
      if (hub._typeId !== undefined) {
        hubCenters.set(hub._typeId, { x: hx, y: hy, angle });
      }
    });

    // 3. 内部基于外部连接重心的方向化极坐标排布 (Directional Polar Ordering)
    const nodeExternalVec = new Map<string, { dx: number; dy: number; count: number }>();
    instances.forEach(inst => {
      nodeExternalVec.set(inst.id, { dx: 0, dy: 0, count: 0 });
    });

    links.forEach(l => {
      if (l._isTypeInstLink) return;
      const sId = typeof l.source === 'object' ? (l.source as any).id : String(l.source);
      const tId = typeof l.target === 'object' ? (l.target as any).id : String(l.target);
      const sNode = nodeMap.get(sId);
      const tNode = nodeMap.get(tId);
      if (!sNode || !tNode) return;
      if (sNode.group === 'instance' && tNode.group === 'instance' && sNode._typeId !== tNode._typeId) {
        const sCenter = hubCenters.get(sNode._typeId ?? -1) || { x: cx, y: cy };
        const tCenter = hubCenters.get(tNode._typeId ?? -1) || { x: cx, y: cy };
        const dirX = tCenter.x - sCenter.x;
        const dirY = tCenter.y - sCenter.y;
        const dist = Math.hypot(dirX, dirY) || 1;
        const sVec = nodeExternalVec.get(sId);
        if (sVec) {
          sVec.dx += dirX / dist;
          sVec.dy += dirY / dist;
          sVec.count += 1;
        }
        const tVec = nodeExternalVec.get(tId);
        if (tVec) {
          tVec.dx -= dirX / dist;
          tVec.dy -= dirY / dist;
          tVec.count += 1;
        }
      }
    });

    // 分布各类型实例：连接外部的节点朝向目标方向，孤立/内部节点排在背部内圈
    instancesByType.forEach((instList, tid) => {
      const hubCenter = hubCenters.get(tid) || { x: cx, y: cy, angle: 0 };
      const hx = hubCenter.x;
      const hy = hubCenter.y;

      const orientedNodes: { node: GraphNode; angle: number; priority: number }[] = [];
      const internalNodes: GraphNode[] = [];

      instList.forEach(inst => {
        const vec = nodeExternalVec.get(inst.id);
        if (vec && vec.count > 0) {
          const targetAngle = Math.atan2(vec.dy, vec.dx);
          orientedNodes.push({ node: inst, angle: targetAngle, priority: vec.count });
        } else {
          internalNodes.push(inst);
        }
      });

      orientedNodes.sort((a, b) => a.angle - b.angle);

      const maxOrientedPerRing = 8;
      const orientedCount = orientedNodes.length;
      orientedNodes.forEach((item, idx) => {
        const ring = Math.floor(idx / maxOrientedPerRing);
        const r = 75 + ring * 55;
        const minAngularStep = Math.min(0.65, 48 / r);
        const offset = orientedCount <= 1 ? 0 : (idx - (orientedCount - 1) / 2) * minAngularStep;
        const adjustedAngle = item.angle + offset;
        const nx = hx + Math.cos(adjustedAngle) * r;
        const ny = hy + Math.sin(adjustedAngle) * r;
        item.node.x = nx;
        item.node.y = ny;
        item.node.fx = nx;
        item.node.fy = ny;
      });

      const internalCount = internalNodes.length;
      internalNodes.forEach((inst, idx) => {
        const ring = Math.floor(idx / 5);
        const r = 45 + ring * 42;
        const countInRing = Math.min(5, Math.max(1, internalCount - ring * 5));
        const step = (Math.PI * 2) / countInRing;
        const angle = hubCenter.angle + Math.PI + (idx % 5) * step;
        const nx = hx + Math.cos(angle) * r;
        const ny = hy + Math.sin(angle) * r;
        inst.x = nx;
        inst.y = ny;
        inst.fx = nx;
        inst.fy = ny;
      });

      // 局部间隙松弛
      for (let pass = 0; pass < 3; pass++) {
        for (let i = 0; i < instList.length; i++) {
          for (let j = i + 1; j < instList.length; j++) {
            const a = instList[i];
            const b = instList[j];
            if (a.x == null || a.y == null || b.x == null || b.y == null) continue;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.hypot(dx, dy) || 1;
            if (dist < 36) {
              const push = (36 - dist) / 2;
              const ux = dx / dist;
              const uy = dy / dist;
              a.x -= ux * push;
              a.y -= uy * push;
              b.x += ux * push;
              b.y += uy * push;
              a.fx = a.x;
              a.fy = a.y;
              b.fx = b.x;
              b.fy = b.y;
            }
          }
        }
      }
    });

    // Action 节点
    const instanceMap = new Map<number, GraphNode>();
    instances.forEach(n => {
      if (n._objId !== undefined) instanceMap.set(n._objId, n);
    });

    actions.forEach((act, k) => {
      const owner = act._objId !== undefined ? instanceMap.get(act._objId) : undefined;
      if (owner && owner.x != null && owner.y != null) {
        const hubCenter = hubCenters.get(owner._typeId ?? -1) || { x: cx, y: cy };
        const outwardAngle = Math.atan2(owner.y - hubCenter.y, owner.x - hubCenter.x);
        const spreadAngle = outwardAngle + ((k % 3) - 1) * 0.35;
        act.x = owner.x + Math.cos(spreadAngle) * 32;
        act.y = owner.y + Math.sin(spreadAngle) * 32;
        act.fx = act.x;
        act.fy = act.y;
      } else {
        const angle = (k / Math.max(actions.length, 1)) * Math.PI * 2;
        act.x = cx + Math.cos(angle) * (orbitRadiusX * 1.25);
        act.y = cy + Math.sin(angle) * (orbitRadiusY * 1.25);
        act.fx = act.x;
        act.fy = act.y;
      }
    });

    recordLayoutMetrics({
      layoutMode: 'grouped',
      nodeCount: nodes.length,
      linkCount: links.length,
      duration: performance.now() - start,
      timestamp: Date.now(),
      status: 'success',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    recordLayoutMetrics({
      layoutMode: 'grouped',
      nodeCount: nodes.length,
      linkCount: links.length,
      duration: performance.now() - start,
      timestamp: Date.now(),
      status: 'error',
      errorMessage,
    });
    throw error;
  }
}

/**
 * 计算初始位置（连通分量聚类）
 */
export function computeInitialPositions(
  nodes: GraphNode[],
  typeHubNodes: GraphNode[],
  svgW: number,
  svgH: number,
  rawLinks?: LifeLink[]
): void {
  const start = performance.now();
  
  try {
    const cx = svgW / 2;
    const cy = svgH / 2;
    const instanceNodes = nodes.filter(n => n.group === 'instance');
    const actionNodes = nodes.filter(n => n.group === 'action');
    const linkTypeNodes = nodes.filter(n => n.group === 'linkType');

    const adj: Record<number, { neighbor: number; weight: number }[]> = {};
    instanceNodes.filter(n => n._objId !== undefined).forEach(n => { adj[n._objId!] = []; });

    if (rawLinks) {
      for (const link of rawLinks) {
        const srcId = Number(link.source_object_id);
        const tgtId = Number(link.target_object_id);
        const w = Number(link.weight) || 0.5;
        if (adj[srcId] && adj[tgtId]) {
          adj[srcId].push({ neighbor: tgtId, weight: w });
          adj[tgtId].push({ neighbor: srcId, weight: w });
        }
      }
    }

    // BFS 找连通分量
    const visited = new Set<number>();
    const components: { nodes: GraphNode[]; degree: number }[] = [];

    instanceNodes.filter(n => n._objId !== undefined).forEach(instNode => {
      const id = instNode._objId!;
      if (visited.has(id)) return;
      
      const compNodes: GraphNode[] = [];
      let totalDegree = 0;
      const queue = [id];
      visited.add(id);
      
      while (queue.length > 0) {
        const cur = queue.shift()!;
        const node = instanceNodes.find(n => n._objId === cur)!;
        if (node) {
          compNodes.push(node);
          totalDegree += (adj[cur] || []).length;
        }
        for (const { neighbor } of (adj[cur] || [])) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
      
      compNodes.sort((a, b) => {
        const degA = adj[a._objId!]?.length ?? 0;
        const degB = adj[b._objId!]?.length ?? 0;
        return degB - degA || a.label.localeCompare(b.label);
      });
      components.push({ nodes: compNodes, degree: totalDegree });
    });

    components.sort((a, b) => b.degree - a.degree);

    // 分配扇形区域
    const N = components.length || 1;
    const sectorAngle = (2 * Math.PI) / N;
    const sectorGap = 0.08;
    const effectiveAngle = sectorAngle - sectorGap;
    const sectorMidAngles: number[] = [];
    for (let i = 0; i < N; i++) {
      sectorMidAngles.push(i * sectorAngle + sectorAngle / 2 - Math.PI / 2);
    }

    const baseR = Math.max(200, Math.min(380, Math.min(svgW, svgH) * 0.32));
    const innerR = baseR * 0.45;
    const ring1R = baseR * 0.85;
    const ring2R = baseR * 1.40;

    components.forEach((comp, ci) => {
      const midAngle = sectorMidAngles[ci];
      const total = comp.nodes.length;

      comp.nodes.forEach((node, ni) => {
        const neighbors = adj[node._objId!] || [];
        const hasConnections = neighbors.length > 0;

        let r: number;
        if (ni === 0) {
          r = innerR;
        } else if (hasConnections) {
          r = innerR + (ring1R - innerR) * Math.min((neighbors.length) / 4, 1);
        } else {
          r = ring1R + (ring2R - innerR) * Math.min((ni) / Math.max(total - 1, 1), 1);
        }

        const ringTotal = total - 1;
        const ringIndex = hasConnections ? ni - 1 : ni;
        const posInRing = ringTotal > 0 ? ringIndex / Math.max(ringTotal, 1) : 0;
        const angleSpread = effectiveAngle * 0.85;
        const angleOffset = (posInRing - 0.5) * angleSpread;

        node.x = cx + r * Math.cos(midAngle + angleOffset);
        node.y = cy + r * Math.sin(midAngle + angleOffset);
      });
    });

    // TypeHub 节点
    const typeHubRadius = Math.max(260, baseR * 1.45);
    typeHubNodes.forEach((node, i) => {
      const angle = (i / Math.max(typeHubNodes.length, 1)) * 2 * Math.PI - Math.PI / 2;
      node.x = cx + typeHubRadius * Math.cos(angle);
      node.y = cy + typeHubRadius * Math.sin(angle);
    });

    // Action 节点
    actionNodes.forEach((node, i) => {
      const ownerId = node._objId!;
      const owner = instanceNodes.find(n => n._objId === ownerId);
      if (owner && owner.x !== undefined && owner.y !== undefined && !isNaN(owner.x!)) {
        const angle = (i / Math.max(actionNodes.length, 1)) * 2 * Math.PI;
        const r = 36;
        node.x = owner.x + r * Math.cos(angle);
        node.y = owner.y + r * Math.sin(angle);
      } else {
        node.x = cx + 50 * Math.cos((i / Math.max(actionNodes.length, 1)) * 2 * Math.PI);
        node.y = cy + 50 * Math.sin((i / Math.max(actionNodes.length, 1)) * 2 * Math.PI);
      }
    });

    // linkType 节点
    linkTypeNodes.forEach((node, i) => {
      node.x = cx + 24 * Math.cos((i / Math.max(linkTypeNodes.length, 1)) * 2 * Math.PI);
      node.y = cy + 24 * Math.sin((i / Math.max(linkTypeNodes.length, 1)) * 2 * Math.PI);
    });

    recordLayoutMetrics({
      layoutMode: 'grid',
      nodeCount: nodes.length,
      linkCount: rawLinks?.length ?? 0,
      duration: performance.now() - start,
      timestamp: Date.now(),
      status: 'success',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    recordLayoutMetrics({
      layoutMode: 'grid',
      nodeCount: nodes.length,
      linkCount: rawLinks?.length ?? 0,
      duration: performance.now() - start,
      timestamp: Date.now(),
      status: 'error',
      errorMessage,
    });
    throw error;
  }
}

// ============================================================
// 包装函数（兼容旧 API）
// ============================================================

/**
 * computeClusteredPositions — Type-Centroid Radial Cluster Layout
 * 
 * 这是 applyCommunityCentricBarycentricLayout 的别名，用于兼容旧的 API。
 */
export function computeClusteredPositions(
  nodes: GraphNode[],
  typeHubNodes: GraphNode[],
  svgW: number,
  svgH: number
): void {
  applyCommunityCentricBarycentricLayout(nodes, [], svgW, svgH);
}

/**
 * Relationship-reading layout. The selected entity is the stable centre,
 * direct neighbours occupy the first orbit, and second-hop neighbours occupy
 * the next orbit. Non-entity metadata stays close to its owning entity so the
 * relation graph remains complete without turning into a hairball.
 * 
 * 这是 applySpokeLayout 的包装，返回 rootId。
 */
export function applyRelationshipAnalysisLayout(
  nodes: GraphNode[],
  links: GraphLink[],
  W: number,
  H: number,
  focusedNodeId?: string | null,
): string | null {
  return applySpokeLayout(nodes, links, W, H, focusedNodeId).rootId;
}

// ============================================================
// 统一布局入口
// ============================================================

/**
 * 统一布局入口函数
 * 
 * @param nodes - 节点数组（会被直接修改位置）
 * @param links - 边数组
 * @param mode - 布局模式
 * @param svgW - 画布宽度
 * @param svgH - 画布高度
 * @param options - 布局选项
 */
export function applyLayout(
  nodes: GraphNode[],
  links: GraphLink[],
  mode: LayoutMode,
  svgW: number,
  svgH: number,
  options: LayoutOptions = {}
): void {
  const start = performance.now();
  
  try {
    switch (mode) {
      case 'spoke':
        applySpokeLayout(nodes, links, svgW, svgH, options.focusedNodeId);
        break;
      case 'dandelion':
        applyDandelionLayout(nodes, links, svgW, svgH);
        break;
      case 'topologicalFlow':
        applyTopologicalFlowLayout(nodes, links, svgW, svgH, options);
        break;
      case 'dagre':
      case 'hierarchical':
        applyDagreLayout(nodes, links, svgW, svgH);
        break;
      case 'concentric':
        applyConcentricLayout(nodes, svgW, svgH, links);
        break;
      case 'circular':
        applyCircularLayout(nodes, svgW, svgH, options);
        break;
      case 'force':
        // 力导向布局由 D3 simulation 处理，解除固定坐标
        nodes.forEach(n => { n.fx = null; n.fy = null; });
        break;
      case 'grouped':
        applyCommunityCentricBarycentricLayout(nodes, links, svgW, svgH);
        break;
      case 'starburst':
        applyStarburstLayout(nodes, links, svgW, svgH);
        break;
      case 'grid':
        applyGridLayout(nodes, svgW, svgH, links);
        break;
      case 'groupedCircular':
        applyGroupedCircularLayout(nodes, svgW, svgH, links);
        break;
      case 'verticalTree':
        applyVerticalTreeLayout(nodes, svgW, svgH, links);
        break;
      case 'horizontalTree':
        applyHorizontalTreeLayout(nodes, svgW, svgH, links);
        break;
      case 'radial':
      case 'tree':
      default:
        // 默认使用初始位置计算
        computeInitialPositions(nodes, nodes.filter(n => n.group === 'typeHub'), svgW, svgH);
        break;
    }
    
    recordLayoutMetrics({
      layoutMode: mode,
      nodeCount: nodes.length,
      linkCount: links.length,
      duration: performance.now() - start,
      timestamp: Date.now(),
      status: 'success',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    recordLayoutMetrics({
      layoutMode: mode,
      nodeCount: nodes.length,
      linkCount: links.length,
      duration: performance.now() - start,
      timestamp: Date.now(),
      status: 'error',
      errorMessage,
    });
    throw error;
  }
}

/**
 * 布局模式到中文名称的映射
 */
export const LAYOUT_MODE_LABELS: Record<LayoutMode, string> = {
  spoke: '轮辐布局',
  dandelion: '蒲公英布局',
  topologicalFlow: '拓扑流布局',
  dagre: 'Dagre 分层',
  concentric: '同心圆布局',
  circular: '环形布局',
  force: '力导向',
  grouped: '分组聚类',
  hierarchical: '层级布局',
  radial: '放射状布局',
  tree: '树形布局',
  grid: '网格布局',
  starburst: '星爆布局',
  groupedCircular: '分组环形',
  verticalTree: '纵向树',
  horizontalTree: '横向树',
};

/**
 * 获取所有可用的布局模式
 */
export function getAvailableLayoutModes(): Array<{ mode: LayoutMode; label: string }> {
  return Object.entries(LAYOUT_MODE_LABELS).map(([mode, label]) => ({
    mode: mode as LayoutMode,
    label,
  }));
}

// ============================================================
// 补充布局算法（从 D3GraphView.layout.ts 迁移）
// ============================================================

/**
 * 星爆布局 - 以度数最高的节点为中心向外辐射
 */
export function applyStarburstLayout(nodes: GraphNode[], links: GraphLink[], W: number, H: number): void {
  const start = performance.now();
  
  try {
    const cx = W / 2;
    const cy = H / 2;

    if (nodes.length === 0) return;

    const semanticLinks = links.filter(l => !l._isTypeInstLink);
    const linksToUse = semanticLinks.length > 0 ? semanticLinks : links;

    // 计算度数中心性
    const degreeMap: Record<string, number> = {};
    nodes.forEach(n => { degreeMap[n.id] = 0; });
    linksToUse.forEach(l => {
      const s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
      const t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
      if (degreeMap[s] !== undefined) degreeMap[s]++;
      if (degreeMap[t] !== undefined) degreeMap[t]++;
    });

    // 选择度数最高的节点作为中心
    let centerNode = nodes[0];
    nodes.forEach(n => {
      if (degreeMap[n.id] > degreeMap[centerNode.id]) {
        centerNode = n;
      }
    });

    centerNode.x = cx;
    centerNode.y = cy;
    centerNode.fx = cx;
    centerNode.fy = cy;

    // 识别中心节点的邻居
    const parentIds = new Set<string>();
    const parentAdjacency = new Map<string, Set<string>>();

    linksToUse.forEach(l => {
      const s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
      const t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
      if (s === centerNode.id) { parentIds.add(t); }
      if (t === centerNode.id) { parentIds.add(s); }
    });

    const parents = nodes.filter(n => parentIds.has(n.id) && n.id !== centerNode.id);
    parents.forEach(p => parentAdjacency.set(p.id, new Set()));

    linksToUse.forEach(l => {
      const s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
      const t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
      if (parentAdjacency.has(s) && parentAdjacency.has(t) && s !== t) {
        parentAdjacency.get(s)!.add(t);
        parentAdjacency.get(t)!.add(s);
      }
    });

    // 哈密顿贪婪排序
    const orderedParents: GraphNode[] = [];
    if (parents.length > 0) {
      const remaining = new Set(parents);
      let current = [...parents].sort((a, b) => degreeMap[b.id] - degreeMap[a.id] || a.id.localeCompare(b.id))[0];
      orderedParents.push(current);
      remaining.delete(current);

      while (remaining.size > 0) {
        const neighbors = parentAdjacency.get(current.id) || new Set();
        let next: GraphNode | null = null;
        for (const cand of remaining) {
          if (neighbors.has(cand.id)) {
            next = cand;
            break;
          }
        }
        if (!next) {
          next = [...remaining].sort((a, b) => degreeMap[b.id] - degreeMap[a.id] || a.id.localeCompare(b.id))[0];
        }
        orderedParents.push(next);
        remaining.delete(next);
        current = next;
      }
    }

    const placedIds = new Set<string>([centerNode.id]);

    // 分布父节点
    const R1 = Math.max(220, Math.min(320, Math.min(W, H) * 0.32));
    orderedParents.forEach((parent, i) => {
      const angle = (i / Math.max(orderedParents.length, 1)) * 2 * Math.PI - Math.PI / 2;
      parent.x = cx + R1 * Math.cos(angle);
      parent.y = cy + R1 * Math.sin(angle);
      parent.fx = parent.x;
      parent.fy = parent.y;
      placedIds.add(parent.id);

      // 子节点
      const childNodes: GraphNode[] = [];
      linksToUse.forEach(l => {
        const s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
        const t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
        if (s === parent.id && !placedIds.has(t)) {
          const node = nodes.find(n => n.id === t);
          if (node && !childNodes.some(c => c.id === node.id)) childNodes.push(node);
        }
        if (t === parent.id && !placedIds.has(s)) {
          const node = nodes.find(n => n.id === s);
          if (node && !childNodes.some(c => c.id === node.id)) childNodes.push(node);
        }
      });

      const R2 = 125;
      const M = childNodes.length;
      if (M > 0) {
        const spread = Math.min(Math.PI * 0.55, Math.max(0.32, (M - 1) * 0.20));
        childNodes.sort((a, b) => a.id.localeCompare(b.id)).forEach((child, j) => {
          const t = M <= 1 ? 0 : (j / (M - 1)) * 2 - 1;
          const childAngle = angle + t * (spread / 2);
          const childRadius = R2 + (j % 2 === 0 ? 0 : 34);
          child.x = parent.x! + childRadius * Math.cos(childAngle);
          child.y = parent.y! + childRadius * Math.sin(childAngle);
          child.fx = child.x;
          child.fy = child.y;
          placedIds.add(child.id);
        });
      }
    });

    // 剩余节点
    const remaining = nodes.filter(n => !placedIds.has(n.id));
    if (remaining.length > 0) {
      const R3 = R1 + 160;
      remaining.forEach((node, i) => {
        const angle = (i / remaining.length) * 2 * Math.PI;
        node.x = cx + R3 * Math.cos(angle);
        node.y = cy + R3 * Math.sin(angle);
        node.fx = node.x;
        node.fy = node.y;
      });
    }

    resolveNodeOverlaps(nodes);
    centerNode.x = cx;
    centerNode.y = cy;
    centerNode.fx = cx;
    centerNode.fy = cy;

    recordLayoutMetrics({
      layoutMode: 'starburst',
      nodeCount: nodes.length,
      linkCount: links.length,
      duration: performance.now() - start,
      timestamp: Date.now(),
      status: 'success',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    recordLayoutMetrics({
      layoutMode: 'starburst',
      nodeCount: nodes.length,
      linkCount: links.length,
      duration: performance.now() - start,
      timestamp: Date.now(),
      status: 'error',
      errorMessage,
    });
    throw error;
  }
}

/**
 * 网格布局 - 按类型分列排布
 */
export function applyGridLayout(nodes: GraphNode[], W: number, H: number, links?: GraphLink[]): void {
  const start = performance.now();
  
  try {
    const cx = W / 2;
    const cy = H / 2;
    const padding = 60;
    const availW = Math.max(W - padding * 2, 200);

    const semanticLinks = (links || []).filter(l => !l._isTypeInstLink);
    const typeAffinity = computeTypeAffinityMatrix(nodes, semanticLinks);
    const typeHubs = orderTypeHubsCirculary(
      nodes.filter(n => n.group === 'typeHub'),
      typeAffinity
    );
    const instances = nodes.filter(n => n.group === 'instance');
    const actions = nodes.filter(n => n.group === 'action');

    const typeCount = Math.max(typeHubs.length, 1);
    const colSpacing = Math.min(340, Math.max(240, availW / typeCount));
    const totalColWidth = (typeCount - 1) * colSpacing;
    const startColX = cx - totalColWidth / 2;

    const placedRowIndex = new Map<string, number>();

    typeHubs.forEach((hub, colIdx) => {
      const colX = startColX + colIdx * colSpacing;
      hub.x = colX;
      hub.y = cy - 160;
      hub.fx = hub.x;
      hub.fy = hub.y;

      const colInstances = instances.filter(n => n._typeId === hub._typeId);

      if (colInstances.length === 0) return;

      // 重心排序
      if (semanticLinks.length > 0 && placedRowIndex.size > 0) {
        colInstances.sort((a, b) => {
          const neighborsA = semanticLinks
            .filter(l => {
              const s = typeof l.source === 'object' ? (l.source as GraphNode).id : String(l.source);
              const t = typeof l.target === 'object' ? (l.target as GraphNode).id : String(l.target);
              return (s === a.id && placedRowIndex.has(t)) || (t === a.id && placedRowIndex.has(s));
            })
            .map(l => {
              const s = typeof l.source === 'object' ? (l.source as GraphNode).id : String(l.source);
              const t = typeof l.target === 'object' ? (l.target as GraphNode).id : String(l.target);
              return s === a.id ? placedRowIndex.get(t)! : placedRowIndex.get(s)!;
            });

          const neighborsB = semanticLinks
            .filter(l => {
              const s = typeof l.source === 'object' ? (l.source as GraphNode).id : String(l.source);
              const t = typeof l.target === 'object' ? (l.target as GraphNode).id : String(l.target);
              return (s === b.id && placedRowIndex.has(t)) || (t === b.id && placedRowIndex.has(s));
            })
            .map(l => {
              const s = typeof l.source === 'object' ? (l.source as GraphNode).id : String(l.source);
              const t = typeof l.target === 'object' ? (l.target as GraphNode).id : String(l.target);
              return s === b.id ? placedRowIndex.get(t)! : placedRowIndex.get(s)!;
            });

          const bcA = neighborsA.length > 0 ? neighborsA.reduce((s, r) => s + r, 0) / neighborsA.length : 0;
          const bcB = neighborsB.length > 0 ? neighborsB.reduce((s, r) => s + r, 0) / neighborsB.length : 0;
          return bcA - bcB || a.id.localeCompare(b.id);
        });
      } else {
        colInstances.sort((a, b) => a.id.localeCompare(b.id));
      }

      const rowStep = 115;
      colInstances.forEach((inst, rowIdx) => {
        inst.x = colX;
        inst.y = cy - 70 + rowIdx * rowStep;
        inst.fx = inst.x;
        inst.fy = inst.y;
        placedRowIndex.set(inst.id, rowIdx);

        const instActions = actions
          .filter(n => n._objId === inst._objId)
          .sort((a, b) => a.id.localeCompare(b.id));

        instActions.forEach((act, actIdx) => {
          const actOffsetCol = actIdx % 2;
          const actOffsetRow = Math.floor(actIdx / 2);
          act.x = inst.x! + 38 + actOffsetCol * 24;
          act.y = inst.y! - 12 + actOffsetRow * 24;
          act.fx = act.x;
          act.fy = act.y;
        });
      });
    });

    const handledIds = new Set(nodes.filter(n => n.fx !== undefined).map(n => n.id));
    const unhandled = nodes.filter(n => !handledIds.has(n.id));
    if (unhandled.length > 0) {
      const cols = Math.ceil(Math.sqrt(unhandled.length));
      const stepX = 80;
      const stepY = 60;
      const startX = cx - ((cols - 1) * stepX) / 2;
      unhandled.forEach((node, idx) => {
        const c = idx % cols;
        const r = Math.floor(idx / cols);
        node.x = startX + c * stepX;
        node.y = cy + 120 + r * stepY;
        node.fx = node.x;
        node.fy = node.y;
      });
    }

    resolveNodeOverlaps(nodes);

    recordLayoutMetrics({
      layoutMode: 'grid',
      nodeCount: nodes.length,
      linkCount: links?.length ?? 0,
      duration: performance.now() - start,
      timestamp: Date.now(),
      status: 'success',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    recordLayoutMetrics({
      layoutMode: 'grid',
      nodeCount: nodes.length,
      linkCount: links?.length ?? 0,
      duration: performance.now() - start,
      timestamp: Date.now(),
      status: 'error',
      errorMessage,
    });
    throw error;
  }
}

/**
 * 分组环形布局 - 不同类型各自成环
 */
export function applyGroupedCircularLayout(nodes: GraphNode[], W: number, H: number, links?: GraphLink[]): void {
  const start = performance.now();
  
  try {
    const cx = W / 2;
    const cy = H / 2;

    const semanticLinks = (links || []).filter(l => !l._isTypeInstLink);
    const typeAffinity = computeTypeAffinityMatrix(nodes, semanticLinks);
    const typeHubs = orderTypeHubsCirculary(
      nodes.filter(n => n.group === 'typeHub'),
      typeAffinity
    );
    const instances = nodes.filter(n => n.group === 'instance');
    const actions = nodes.filter(n => n.group === 'action');

    const typeCount = Math.max(typeHubs.length, 1);
    const layoutRadius = Math.min(W, H) * (typeCount <= 3 ? 0.30 : 0.34);

    typeHubs.forEach((hub, typeIdx) => {
      const typeAngle = (typeIdx / typeCount) * Math.PI * 2 - Math.PI / 2;
      const hubX = cx + Math.cos(typeAngle) * layoutRadius;
      const hubY = cy + Math.sin(typeAngle) * layoutRadius;

      hub.x = hubX;
      hub.y = hubY;
      hub.fx = hub.x;
      hub.fy = hub.y;

      const typeInstances = instances
        .filter(n => n._typeId === hub._typeId)
        .sort((a, b) => a.id.localeCompare(b.id));

      const instCount = typeInstances.length;
      if (instCount === 0) return;

      const instRadius = Math.max(105, 55 + instCount * 14);
      typeInstances.forEach((inst, instIdx) => {
        const instAngle = typeAngle - Math.PI / 3 + (instIdx / Math.max(instCount - 1, 1)) * (Math.PI * 2 / 3);
        const finalAngle = instCount === 1 ? typeAngle : instAngle;
        inst.x = hubX + Math.cos(finalAngle) * instRadius;
        inst.y = hubY + Math.sin(finalAngle) * instRadius;
        inst.fx = inst.x;
        inst.fy = inst.y;

        const instActions = actions
          .filter(n => n._objId === inst._objId)
          .sort((a, b) => a.id.localeCompare(b.id));

        const actCount = instActions.length;
        if (actCount === 0) return;
        const actRadius = 30;
        instActions.forEach((act, actIdx) => {
          const actAngle = finalAngle - Math.PI / 4 + (actIdx / Math.max(actCount - 1, 1)) * (Math.PI / 2);
          const finalActAngle = actCount === 1 ? finalAngle : actAngle;
          act.x = inst.x! + Math.cos(finalActAngle) * actRadius;
          act.y = inst.y! + Math.sin(finalActAngle) * actRadius;
          act.fx = act.x;
          act.fy = act.y;
        });
      });
    });

    const handledIds = new Set(nodes.filter(n => n.fx !== undefined).map(n => n.id));
    const unhandled = nodes.filter(n => !handledIds.has(n.id));
    if (unhandled.length > 0) {
      unhandled.forEach((node, idx) => {
        const angle = (idx / unhandled.length) * Math.PI * 2;
        node.x = cx + Math.cos(angle) * (layoutRadius * 1.4);
        node.y = cy + Math.sin(angle) * (layoutRadius * 1.4);
        node.fx = node.x;
        node.fy = node.y;
      });
    }

    resolveNodeOverlaps(nodes);

    recordLayoutMetrics({
      layoutMode: 'groupedCircular',
      nodeCount: nodes.length,
      linkCount: links?.length ?? 0,
      duration: performance.now() - start,
      timestamp: Date.now(),
      status: 'success',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    recordLayoutMetrics({
      layoutMode: 'groupedCircular',
      nodeCount: nodes.length,
      linkCount: links?.length ?? 0,
      duration: performance.now() - start,
      timestamp: Date.now(),
      status: 'error',
      errorMessage,
    });
    throw error;
  }
}

/**
 * 纵向树布局 - 从上到下的层级结构
 */
export function applyVerticalTreeLayout(nodes: GraphNode[], W: number, H: number, links?: GraphLink[]): void {
  const start = performance.now();
  
  try {
    const semanticLinks = (links || []).filter(l => !l._isTypeInstLink);
    if (semanticLinks.length > 0) {
      applyTopologicalFlowLayout(nodes, semanticLinks, W, H, { direction: 'TB' });
      recordLayoutMetrics({
        layoutMode: 'verticalTree',
        nodeCount: nodes.length,
        linkCount: links?.length ?? 0,
        duration: performance.now() - start,
        timestamp: Date.now(),
        status: 'success',
      });
      return;
    }

    // 无语义链接时的回退
    const cx = W / 2;
    const cy = H / 2;

    const typeHubs = nodes.filter(n => n.group === 'typeHub').sort((a, b) => a.id.localeCompare(b.id));
    const instances = nodes.filter(n => n.group === 'instance');
    const actions = nodes.filter(n => n.group === 'action');

    const typeCount = Math.max(typeHubs.length, 1);
    const colSpacing = Math.min(260, Math.max(180, (W - 120) / Math.max(typeCount, 1)));
    const totalColWidth = (typeCount - 1) * colSpacing;
    const startColX = cx - totalColWidth / 2;

    const yType = cy - 130;
    const yInstBase = cy - 40;

    typeHubs.forEach((hub, colIdx) => {
      const colX = startColX + colIdx * colSpacing;
      hub.x = colX;
      hub.y = yType;
      hub.fx = hub.x;
      hub.fy = hub.y;

      const colInstances = instances
        .filter(n => n._typeId === hub._typeId)
        .sort((a, b) => a.id.localeCompare(b.id));

      const instCount = colInstances.length;
      if (instCount === 0) return;

      const actualCols = instCount <= 3 ? 1 : 2;
      const colGap = 125;
      const rowGap = 90;
      const startX = colX - ((actualCols - 1) * colGap) / 2;

      colInstances.forEach((inst, instIdx) => {
        const gridCol = instIdx % actualCols;
        const gridRow = Math.floor(instIdx / actualCols);

        inst.x = startX + gridCol * colGap;
        inst.y = yInstBase + gridRow * rowGap;
        inst.fx = inst.x;
        inst.fy = inst.y;

        const instActions = actions
          .filter(n => n._objId === inst._objId)
          .sort((a, b) => a.id.localeCompare(b.id));

        const actCount = instActions.length;
        if (actCount === 0) return;

        const actSpacing = 36;
        const actWidth = (actCount - 1) * actSpacing;
        const actStartY = inst.y! + 40;

        instActions.forEach((act, actIdx) => {
          act.x = inst.x! - actWidth / 2 + actIdx * actSpacing;
          act.y = actStartY;
          act.fx = act.x;
          act.fy = act.y;
        });
      });
    });

    // 剩余节点
    const handledIds = new Set(nodes.filter(n => n.fx !== undefined).map(n => n.id));
    const unhandled = nodes.filter(n => !handledIds.has(n.id));
    if (unhandled.length > 0) {
      const cols = Math.ceil(Math.sqrt(unhandled.length));
      const stepX = 80;
      const stepY = 60;
      const startX = cx - ((cols - 1) * stepX) / 2;
      unhandled.forEach((node, idx) => {
        const c = idx % cols;
        const r = Math.floor(idx / cols);
        node.x = startX + c * stepX;
        node.y = cy + 150 + r * stepY;
        node.fx = node.x;
        node.fy = node.y;
      });
    }

    resolveNodeOverlaps(nodes);

    recordLayoutMetrics({
      layoutMode: 'verticalTree',
      nodeCount: nodes.length,
      linkCount: links?.length ?? 0,
      duration: performance.now() - start,
      timestamp: Date.now(),
      status: 'success',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    recordLayoutMetrics({
      layoutMode: 'verticalTree',
      nodeCount: nodes.length,
      linkCount: links?.length ?? 0,
      duration: performance.now() - start,
      timestamp: Date.now(),
      status: 'error',
      errorMessage,
    });
    throw error;
  }
}

/**
 * 横向树布局 - 从左到右的层级结构
 */
export function applyHorizontalTreeLayout(nodes: GraphNode[], W: number, H: number, links?: GraphLink[]): void {
  const start = performance.now();
  
  try {
    const cx = W / 2;
    const cy = H / 2;

    const typeHubs = nodes.filter(n => n.group === 'typeHub').sort((a, b) => a.id.localeCompare(b.id));
    const instances = nodes.filter(n => n.group === 'instance');
    const actions = nodes.filter(n => n.group === 'action');

    // 1. 全局跨组拓扑排序：计算各实例节点的真实依赖层级，保证有向连线严格从左往右自然流动，根除倒流与交织
    const outgoing = new Map<string, Set<string>>();
    const incoming = new Map<string, Set<string>>();
    instances.forEach(n => {
      outgoing.set(n.id, new Set());
      incoming.set(n.id, new Set());
    });

    const semanticLinks = (links || []).filter(l => !l._isTypeInstLink && !l._isActionLink);
    semanticLinks.forEach(l => {
      const sId = typeof l.source === 'object' ? (l.source as any).id : String(l.source);
      const tId = typeof l.target === 'object' ? (l.target as any).id : String(l.target);
      if (outgoing.has(sId) && incoming.has(tId) && sId !== tId) {
        outgoing.get(sId)!.add(tId);
        incoming.get(tId)!.add(sId);
      }
    });

    // 环路检测与破环 (DFS)
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const backEdges = new Set<string>();

    function detectBackEdges(u: string) {
      visited.add(u);
      inStack.add(u);
      for (const v of outgoing.get(u) || []) {
        if (!visited.has(v)) {
          detectBackEdges(v);
        } else if (inStack.has(v)) {
          backEdges.add(`${u}|${v}`);
        }
      }
      inStack.delete(u);
    }
    instances.forEach(n => {
      if (!visited.has(n.id)) detectBackEdges(n.id);
    });

    const topoRank = new Map<string, number>();
    const inDegree = new Map<string, number>();
    instances.forEach(n => {
      let deg = 0;
      for (const p of incoming.get(n.id) || []) {
        if (!backEdges.has(`${p}|${n.id}`)) deg++;
      }
      inDegree.set(n.id, deg);
    });

    const queue: string[] = instances.filter(n => (inDegree.get(n.id) || 0) === 0).map(n => n.id);
    queue.forEach(id => topoRank.set(id, 0));

    let cursor = 0;
    while (cursor < queue.length) {
      const u = queue[cursor++];
      const rU = topoRank.get(u) || 0;
      for (const v of outgoing.get(u) || []) {
        if (backEdges.has(`${u}|${v}`)) continue;
        const nextR = rU + 1;
        if (!topoRank.has(v) || topoRank.get(v)! < nextR) {
          topoRank.set(v, nextR);
          queue.push(v);
        }
      }
    }
    instances.forEach(n => {
      if (!topoRank.has(n.id)) topoRank.set(n.id, 0);
    });

    // 压缩空秩列，确保层级紧凑连续
    const usedRanks = Array.from(new Set(topoRank.values())).sort((a, b) => a - b);
    const rankCompressMap = new Map(usedRanks.map((r, idx) => [r, idx]));
    instances.forEach(n => {
      topoRank.set(n.id, rankCompressMap.get(topoRank.get(n.id) || 0) || 0);
    });

    const maxRank = Math.max(...Array.from(topoRank.values()), 0);
    const hasSemanticLinks = semanticLinks.length > 0;

    const typeCount = Math.max(typeHubs.length, 1);
    const rowSpacing = Math.min(200, Math.max(140, (H - 140) / Math.max(typeCount, 1)));
    const totalRowHeight = (typeCount - 1) * rowSpacing;
    const startRowY = cy - totalRowHeight / 2;

    const colGap = 135;
    const totalCols = hasSemanticLinks ? Math.max(maxRank + 1, 3) : 3;
    const xType = cx - (totalCols * colGap + 180) / 2;
    const xInstBase = xType + 160;

    typeHubs.forEach((hub, rowIdx) => {
      const rowY = startRowY + rowIdx * rowSpacing;
      hub.x = xType;
      hub.y = rowY;
      hub.fx = hub.x;
      hub.fy = hub.y;

      let rowInstances = instances.filter(n => n._typeId === hub._typeId);
      const instCount = rowInstances.length;
      if (instCount === 0) return;

      if (hasSemanticLinks) {
        rowInstances.sort((a, b) => {
          const rDiff = (topoRank.get(a.id) || 0) - (topoRank.get(b.id) || 0);
          if (rDiff !== 0) return rDiff;
          const degDiff = (inDegree.get(a.id) || 0) - (inDegree.get(b.id) || 0);
          if (degDiff !== 0) return degDiff;
          return a.id.localeCompare(b.id);
        });

        const rankGroupCounts = new Map<number, number>();
        const rankSubIndex = new Map<string, number>();
        rowInstances.forEach(n => {
          const r = topoRank.get(n.id) || 0;
          const count = rankGroupCounts.get(r) || 0;
          rankSubIndex.set(n.id, count);
          rankGroupCounts.set(r, count + 1);
        });

        const maxNodesInSameRank = Math.max(...Array.from(rankGroupCounts.values()), 1);
        const actualRows = Math.min(2, Math.max(instCount > 3 ? 2 : 1, maxNodesInSameRank));
        const rowGap = 85;
        const startY = rowY - ((actualRows - 1) * rowGap) / 2;

        rowInstances.forEach(inst => {
          const r = topoRank.get(inst.id) || 0;
          const subIdx = rankSubIndex.get(inst.id) || 0;
          const gridRow = subIdx % actualRows;
          const gridCol = r;

          inst.x = xInstBase + gridCol * colGap;
          inst.y = startY + gridRow * rowGap;
          inst.fx = inst.x;
          inst.fy = inst.y;

          const instActions = actions
            .filter(n => n._objId === inst._objId)
            .sort((a, b) => a.id.localeCompare(b.id));

          const actCount = instActions.length;
          if (actCount === 0) return;

          const actSpacing = 28;
          const actStartX = inst.x! + 40;

          instActions.forEach((act, actIdx) => {
            act.x = actStartX;
            act.y = inst.y! - actSpacing * ((actCount - 1) / 2) + actIdx * actSpacing;
            act.fx = act.x;
            act.fy = act.y;
          });
        });
      } else {
        // 无跨节点语义关系时的经典基准排列（与基准上传图 100% 像素级对齐）
        rowInstances.sort((a, b) => a.id.localeCompare(b.id));
        const actualRows = instCount <= 3 ? 1 : 2;
        const rowGap = 85;
        const startY = rowY - ((actualRows - 1) * rowGap) / 2;

        rowInstances.forEach((inst, instIdx) => {
          const gridRow = instIdx % actualRows;
          const gridCol = Math.floor(instIdx / actualRows);

          inst.x = xInstBase + gridCol * colGap;
          inst.y = startY + gridRow * rowGap;
          inst.fx = inst.x;
          inst.fy = inst.y;

          const instActions = actions
            .filter(n => n._objId === inst._objId)
            .sort((a, b) => a.id.localeCompare(b.id));

          const actCount = instActions.length;
          if (actCount === 0) return;

          const actSpacing = 28;
          const actStartX = inst.x! + 40;

          instActions.forEach((act, actIdx) => {
            act.x = actStartX;
            act.y = inst.y! - actSpacing * ((actCount - 1) / 2) + actIdx * actSpacing;
            act.fx = act.x;
            act.fy = act.y;
          });
        });
      }
    });

    // 剩余节点
    const handledIds = new Set(nodes.filter(n => n.fx !== undefined).map(n => n.id));
    const unhandled = nodes.filter(n => !handledIds.has(n.id));
    if (unhandled.length > 0) {
      const cols = Math.ceil(Math.sqrt(unhandled.length));
      const stepX = 80;
      const stepY = 60;
      const startX = cx + 180;
      unhandled.forEach((node, idx) => {
        const c = idx % cols;
        const r = Math.floor(idx / cols);
        node.x = startX + c * stepX;
        node.y = cy + (r - cols / 2) * stepY;
        node.fx = node.x;
        node.fy = node.y;
      });
    }
    resolveNodeOverlaps(nodes);

    recordLayoutMetrics({
      layoutMode: 'horizontalTree',
      nodeCount: nodes.length,
      linkCount: links?.length ?? 0,
      duration: performance.now() - start,
      timestamp: Date.now(),
      status: 'success',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    recordLayoutMetrics({
      layoutMode: 'horizontalTree',
      nodeCount: nodes.length,
      linkCount: links?.length ?? 0,
      duration: performance.now() - start,
      timestamp: Date.now(),
      status: 'error',
      errorMessage,
    });
    throw error;
  }
}
