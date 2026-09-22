/**
 * ontologyLayoutEngine.ts - 统一的图谱布局引擎
 * 
 * 设计目标：
 * 1. 提供高性能的布局算法
 * 2. 消除重复代码
 * 3. 支持多种布局模式
 * 4. 与 OntologyLayout.ts 保持兼容
 * 
 * @deprecated 请使用 services/graphLayoutService.ts 中的统一布局服务
 */

import { graphlib, layout as dagreLayout } from 'dagre';
import type { GraphNode, GraphLink } from './D3GraphView/D3GraphView.types';

// 重新导出统一布局服务的所有内容
export {
  applyLayout,
  applySpokeLayout,
  applyDandelionLayout,
  applyTopologicalFlowLayout,
  applyDagreLayout,
  applyConcentricLayout,
  applyCircularLayout,
  applyCommunityCentricBarycentricLayout,
  computeInitialPositions,
  aggregateCrossBranchLinks,
  computeTypeAffinityMatrix,
  orderTypeHubsCirculary,
  getLayoutStats,
  getLayoutMetricsHistory,
  onLayoutPerformance,
  getAvailableLayoutModes,
  LAYOUT_MODE_LABELS,
  clearLayoutMetrics,
  setLayoutPerformanceLogging,
  // 新增的布局函数
  applyStarburstLayout,
  applyGridLayout,
  applyGroupedCircularLayout,
  applyVerticalTreeLayout,
  applyHorizontalTreeLayout,
  type LayoutMode,
  type LayoutOptions,
  type LayoutMetrics,
  type LayoutStats,
} from '../../services/graphLayoutService';

// 重新导出辅助函数
export {
  computeNodeDegrees,
  findHubNode,
  degToRad,
  radToDeg,
  normalizeAngle,
} from '../../services/graphLayoutService';

// 本地类型（向后兼容）
export type LocalLayoutMode = 
  | 'hierarchical'   // 层级布局
  | 'topologicalFlow' // 拓扑流布局
  | 'concentric'     // 同心圆布局
  | 'radial'         // 放射状布局
  | 'tree'          // 树形布局
  | 'circular'       // 环形布局
  | 'force'          // 力导向布局
  | 'dagre'          // Dagre优化布局
  | 'grouped';       // 分组聚类布局

export interface LocalLayoutOptions {
  /** 水平间距 */
  nodesep?: number;
  /** 垂直间距 */
  ranksep?: number;
  /** 方向 */
  direction?: 'LR' | 'TB';
  /** 最小半径 */
  minRadius?: number;
  /** 最大迭代次数 */
  maxIterations?: number;
}

// ============================================================
// Dagre 层级布局
// ============================================================

/**
 * Dagre 层级布局 - 优化版本
 * 适用于有向无环图 (DAG)，生成清晰的从左到右层级结构
 */
export function applyDagreHierarchicalLayout(
  nodes: GraphNode[],
  links: GraphLink[],
  svgW: number,
  svgH: number,
  options: LocalLayoutOptions = {}
): void {
  const { nodesep = 180, ranksep = 320, direction = 'LR' } = options;
  
  if (nodes.length === 0) return;
  
  const g = new graphlib.Graph({ multigraph: true, compound: false });
  g.setGraph({
    rankdir: direction,
    nodesep,
    ranksep,
    marginx: 60,
    marginy: 60,
    ranker: 'network-simplex',
    align: direction === 'LR' ? 'UL' : 'DL',
  });
  g.setDefaultEdgeLabel(() => ({}));

  // 设置节点尺寸
  nodes.forEach(n => {
    const labelLen = String(n.label || n.id).length;
    const width = Math.max(90, Math.min(180, labelLen * 9 + 40));
    const height = n.group === 'typeHub' ? 52 : 44;
    g.setNode(n.id, { width, height });
  });

  // 设置边 (排除类型-实例的星型连线)
  links.forEach(link => {
    const sId = typeof link.source === 'object' ? (link.source as GraphNode).id : String(link.source);
    const tId = typeof link.target === 'object' ? (link.target as GraphNode).id : String(link.target);
    if (sId && tId && sId !== tId && !(link as any)._isTypeInstLink) {
      g.setEdge(sId, tId);
    }
  });

  dagreLayout(g);

  // 计算边界用于居中
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
  const padding = 80;
  const scaleX = (svgW - padding * 2) / dagreW;
  const scaleY = (svgH - padding * 2) / dagreH;
  const scale = Math.min(Math.max(scaleX, scaleY, 0.8), 1.2);

  const cx = svgW / 2;
  const cy = svgH / 2;
  const dagreCx = minX + dagreW / 2;
  const dagreCy = minY + dagreH / 2;

  // 应用位置
  nodes.forEach(n => {
    const dn = g.node(n.id);
    if (dn) {
      n.x = cx + (dn.x - dagreCx) * scale;
      n.y = cy + (dn.y - dagreCy) * scale;
      n.fx = n.x;
      n.fy = n.y;
    }
  });
}
