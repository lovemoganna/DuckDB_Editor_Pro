export type OntologyDrawerMode = 'inline' | 'overlay';

/** Only very narrow viewports overlay the drawer; workbench widths keep inline push layout so the graph stays visible. */
export const ONTOLOGY_DRAWER_BREAKPOINT = 720;
export const ONTOLOGY_DRAWER_PREFERENCE_KEY = 'duckdb-manager:ontology-drawer-open';

/** 最小可读缩放阈值 - 确保节点名称清晰可见 */
export const MIN_READABLE_ZOOM = 0.3;

/** 视图适配边距 */
export const VIEWPORT_PADDING = 0.22;

export function resolveOntologyDrawerMode(width: number): OntologyDrawerMode {
  return width < ONTOLOGY_DRAWER_BREAKPOINT ? 'overlay' : 'inline';
}

/**
 * MECE重构：计算可读的画布缩放级别
 * 确保节点名称在任何缩放级别下都清晰可读
 * 
 * 设计原则：
 * - 小数据集：优先保证可读性，最小缩放0.6
 * - 大数据集：允许更小的缩放以查看全貌
 */
export function resolveReadableCanvasZoom(
  fittedZoom: number,
  nodeCount: number,
  fitAll = false,
): number {
  // 大数据集允许更小的缩放以查看全貌
  if (fitAll || nodeCount > 12) return fittedZoom;
  
  // 小数据集保证最小缩放为0.6，确保核心信息清晰可见
  // 配合节点的三级缩放模式（0.3/0.6/1.0），保证用户体验
  return Math.max(fittedZoom, 0.6);
}
