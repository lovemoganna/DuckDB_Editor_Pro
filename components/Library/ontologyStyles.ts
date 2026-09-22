/**
 * ontologyStyles.ts - 知识图谱统一样式系统
 * 
 * 设计目标：
 * 1. 统一 OntologyCanvas 和 D3GraphView 的颜色方案
 * 2. 提供一致的节点、边、标签样式
 * 3. 消除视觉不一致
 */

// ============================================================
// 颜色方案 (Monokai 风格)
// ============================================================

/** 主题色 — 指向 index.css `:root` Monokai SSOT，禁止平行 hex 调色板 */
export const THEME_COLORS = {
  /** 背景色 */
  background: 'var(--monokai-bg)',
  surface: 'var(--monokai-surface)',
  elevated: 'var(--monokai-elevated)',
  border: 'var(--monokai-border)',
  borderSubtle: 'var(--monokai-border-subtle)',
  borderStrong: 'var(--monokai-border-strong)',

  /** 文字色 */
  fg: 'var(--monokai-fg)',
  fgMuted: 'var(--monokai-fg-muted)',
  fgDim: 'var(--monokai-comment)',
  comment: 'var(--monokai-comment)',

  /** 强调色 */
  accent: 'var(--monokai-cyan)',
  cyan: 'var(--monokai-cyan)',
  green: 'var(--monokai-accent)',
  yellow: 'var(--monokai-yellow)',
  orange: 'var(--monokai-orange)',
  pink: 'var(--monokai-pink)',
  purple: 'var(--monokai-purple)',
  red: 'var(--monokai-pink)',
  blue: 'var(--monokai-cyan)',

  /** 语义色 */
  success: 'var(--monokai-accent)',
  warning: 'var(--monokai-orange)',
  error: 'var(--monokai-pink)',
  info: 'var(--monokai-cyan)',

  /** 特殊色 */
  highlight: 'var(--monokai-yellow)',
  selected: 'var(--monokai-cyan)',
  connected: 'var(--monokai-accent)',
  dimmed: 'color-mix(in srgb, var(--monokai-fg) 15%, transparent)',
} as const;

/** TypeHub 节点颜色 (暖色系) */
export const TYPE_COLORS_WARM = [
  '#c77dff', // 紫
  '#ff6b9d', // 粉
  '#ffa040', // 橙
  '#ffe066', // 黄
  '#7dd87d', // 绿
  '#ff6b9d', // 粉
  '#c77dff', // 紫
  '#ffa040', // 橙
] as const;

/** Instance 节点颜色 (冷色系，对应 TypeHub) */
export const TYPE_COLORS_INSTANCE = [
  '#a070d0',
  '#d06080',
  '#c88030',
  '#b0b040',
  '#60b060',
  '#d06080',
  '#a070d0',
  '#c88030',
] as const;

/** 链接类型颜色 */
export const LINKTYPE_COLORS = [
  '#5ab0d0', // 青蓝
  '#60c0e0', // 天蓝
  '#50d0a0', // 青绿
  '#9090e0', // 紫蓝
  '#e09090', // 珊瑚
  '#5ab0d0', // 青蓝
  '#60c0e0', // 天蓝
] as const;

// ============================================================
// 节点样式
// ============================================================

export interface NodeStyleConfig {
  /** 填充色 */
  fill: string;
  /** 边框色 */
  stroke: string;
  /** 边框宽度 */
  strokeWidth: number;
  /** 半径 */
  radius: number;
  /** 图标类型 */
  icon?: string;
  /** 是否显示图标 */
  showIcon?: boolean;
}

export const DEFAULT_NODE_STYLES: Record<string, NodeStyleConfig> = {
  typeHub: {
    fill: 'rgba(199, 125, 255, 0.15)',
    stroke: '#c77dff',
    strokeWidth: 2,
    radius: 28,
    icon: 'hexagon',
    showIcon: true,
  },
  instance: {
    fill: 'rgba(102, 217, 239, 0.12)',
    stroke: '#66d9ef',
    strokeWidth: 1.5,
    radius: 11,
    icon: 'box',
    showIcon: false,
  },
  action: {
    fill: 'rgba(255, 156, 247, 0.15)',
    stroke: '#ff9cf7',
    strokeWidth: 1,
    radius: 6,
    icon: 'bolt',
    showIcon: false,
  },
  linkType: {
    fill: 'rgba(144, 144, 224, 0.2)',
    stroke: '#9090e0',
    strokeWidth: 0.8,
    radius: 8,
    icon: 'link',
    showIcon: false,
  },
};

/** 获取节点样式 */
export function getNodeStyle(group: string, typeId?: number): NodeStyleConfig {
  const baseStyle = DEFAULT_NODE_STYLES[group] || DEFAULT_NODE_STYLES.instance;
  
  // 如果有类型ID，应用类型颜色
  if (typeId !== undefined) {
    const colorIndex = (typeId - 1) % TYPE_COLORS_WARM.length;
    const warmColor = TYPE_COLORS_WARM[colorIndex];
    const coolColor = TYPE_COLORS_INSTANCE[colorIndex];
    
    return {
      ...baseStyle,
      stroke: group === 'typeHub' ? warmColor : coolColor,
      fill: group === 'typeHub' 
        ? `${warmColor}22` 
        : `${coolColor}1a`,
    };
  }
  
  return baseStyle;
}

// ============================================================
// 关系类型颜色 Token (新增 - 实体画布核心修复)
// ============================================================

import type { RelationCardinality } from '../../types/ontologyStudioTypes';

/** 关系类型信息（cardinality → 颜色 + 宽度 + dash） */
export interface RelationTypeInfo {
  cardinality: RelationCardinality;
  color: string;
  width: number;
  dashArray?: string;
  label: string;
}

/** 4 种 cardinality 的颜色 token（按 DESIGN.md 决策 q1_a） */
export const LINK_TYPE_COLOR_TOKENS: Record<RelationCardinality, RelationTypeInfo> = {
  '1:1': { cardinality: '1:1', color: THEME_COLORS.green,  width: 2.2, label: '一对一' },
  '1:N': { cardinality: '1:N', color: THEME_COLORS.cyan,   width: 2.4, label: '一对多' },
  'N:1': { cardinality: 'N:1', color: THEME_COLORS.orange, width: 2.4, label: '多对一' },
  'N:M': { cardinality: 'N:M', color: THEME_COLORS.pink,   width: 2.6, dashArray: '6 4', label: '多对多' },
};

/** 边状态 Token */
export const EDGE_STATE_TOKENS = {
  default:    { strokeOpacity: 0.85, animation: 'ontology-edge-flow 2.4s linear infinite' },
  selected:   { strokeOpacity: 1.0,  animation: 'ontology-edge-flow 1.2s linear infinite' },
  upstream:   { strokeOpacity: 1.0,  animation: 'ontology-edge-flow 1.2s linear infinite' },
  downstream: { strokeOpacity: 1.0,  animation: 'ontology-edge-flow 1.2s linear infinite' },
  dimmed:     { strokeOpacity: 0.35, animation: 'none' },
  halo:       { color: '#12131a', widthScale: 1.6 },
} as const;

/** 字号 Token（4 档） */
export const ONTOLOGY_TEXT_SIZE = {
  '3xs': '8px',
  '2xs': '10px',
  xs: '12px',
  sm: '14px',
} as const;

/** 圆角 Token（3 档） */
export const ONTOLOGY_RADIUS = {
  sm: '4px',
  md: '6px',
  lg: '10px',
} as const;

/** Z-Index 层级（5 档） */
export const ONTOLOGY_STACKING = {
  base: 0,
  edge: 5,
  node: 10,
  toolbar: 30,
  legend: 40,
  modal: 50,
} as const;

/** 根据 cardinality 获取颜色 */
export function getRelationTypeColor(cardinality: RelationCardinality): string {
  return LINK_TYPE_COLOR_TOKENS[cardinality]?.color ?? THEME_COLORS.fgMuted;
}

/** 根据 cardinality 获取 strokeWidth */
export function getRelationTypeWidth(cardinality: RelationCardinality): number {
  return LINK_TYPE_COLOR_TOKENS[cardinality]?.width ?? 2.0;
}

/** 根据 cardinality 获取 dashArray */
export function getRelationTypeDashArray(cardinality: RelationCardinality): string | undefined {
  return LINK_TYPE_COLOR_TOKENS[cardinality]?.dashArray;
}

// ============================================================
// 边样式（原有，保留向后兼容）
// ============================================================

export interface EdgeStyleConfig {
  /** 颜色 */
  color: string;
  /** 宽度 */
  strokeWidth: number;
  /** 透明度 */
  opacity: number;
  /** 虚线样式 */
  dashArray?: string;
  /** 是否显示箭头 */
  showArrow: boolean;
}

export const DEFAULT_EDGE_STYLES: Record<string, EdgeStyleConfig> = {
  default: {
    color: '#9090e0',
    strokeWidth: 1.5,
    opacity: 0.6,
    showArrow: true,
  },
  typeInst: {
    color: 'rgba(255, 255, 255, 0.25)',
    strokeWidth: 0.6,
    opacity: 0.22,
    dashArray: '4 4',
    showArrow: false,
  },
  action: {
    color: '#ff9cf7',
    strokeWidth: 0.9,
    opacity: 0.4,
    dashArray: '3 3',
    showArrow: false,
  },
  highlight: {
    color: '#66d9ef',
    strokeWidth: 2.5,
    opacity: 1,
    showArrow: true,
  },
  selected: {
    color: '#ffd166',
    strokeWidth: 2,
    opacity: 1,
    showArrow: true,
  },
  active: {
    color: '#a6e22e',
    strokeWidth: 2,
    opacity: 1,
    showArrow: true,
  },
};

/** 获取边样式 */
export function getEdgeStyle(
  linkTypeId?: number,
  isHighlighted?: boolean,
  isSelected?: boolean,
  isActive?: boolean
): EdgeStyleConfig {
  // 优先级：激活 > 高亮 > 选中 > 默认
  if (isActive) return DEFAULT_EDGE_STYLES.active;
  if (isHighlighted) return DEFAULT_EDGE_STYLES.highlight;
  if (isSelected) return DEFAULT_EDGE_STYLES.selected;
  
  // 按链接类型
  if (linkTypeId !== undefined) {
    const colorIndex = (linkTypeId - 1) % LINKTYPE_COLORS.length;
    return {
      ...DEFAULT_EDGE_STYLES.default,
      color: LINKTYPE_COLORS[colorIndex],
    };
  }
  
  return DEFAULT_EDGE_STYLES.default;
}

// ============================================================
// 标签样式
// ============================================================

export interface LabelStyleConfig {
  /** 字体大小 */
  fontSize: number;
  /** 字体粗细 */
  fontWeight: number;
  /** 文字颜色 */
  fill: string;
  /** 描边颜色 */
  strokeColor: string;
  /** 描边宽度 */
  strokeWidth: number;
  /** 最大字符数 */
  maxChars: number;
}

export const DEFAULT_LABEL_STYLES: Record<string, LabelStyleConfig> = {
  typeHub: {
    fontSize: 12,
    fontWeight: 800,
    fill: '#f8f8f2',
    strokeColor: '#000',
    strokeWidth: 0.5,
    maxChars: 20,
  },
  instance: {
    fontSize: 10,
    fontWeight: 700,
    fill: '#f8f8f2',
    strokeColor: '#000',
    strokeWidth: 0.4,
    maxChars: 18,
  },
  action: {
    fontSize: 8,
    fontWeight: 600,
    fill: '#f8f8f2',
    strokeColor: '#000',
    strokeWidth: 0.3,
    maxChars: 16,
  },
  linkType: {
    fontSize: 7,
    fontWeight: 600,
    fill: '#a8a8b2',
    strokeColor: '#000',
    strokeWidth: 0.3,
    maxChars: 12,
  },
};

// ============================================================
// SVG CSS 样式 (用于 D3GraphView)
// ============================================================

export const SVG_STYLES = `
  /* 节点基础样式 */
  .nv-node { cursor: move; }
  
  /* 悬停高亮 - 使用 stroke 而不是 drop-shadow */
  .nv-node:hover circle {
    stroke: ${THEME_COLORS.accent} !important;
    stroke-width: 2.5px !important;
    stroke-opacity: 1.0 !important;
  }
  .nv-typehub:hover circle {
    stroke: ${THEME_COLORS.accent} !important;
    stroke-width: 3.5px !important;
  }
  .nv-action:hover circle {
    stroke: ${THEME_COLORS.accent} !important;
    stroke-width: 2.0px !important;
  }

  /* 标签样式 */
  .nv-node-label {
    font-size: 10px;
    font-weight: bold;
    fill: ${THEME_COLORS.fg};
    text-anchor: start;
    pointer-events: all;
    cursor: pointer;
    text-shadow: 0 0 3px rgba(0,0,0,0.9);
    stroke: #000;
    stroke-width: 0.5px;
    paint-order: stroke fill;
  }
  .nv-typehub-label {
    font-size: 12px !important;
    font-weight: 800 !important;
  }

  /* 搜索/选中高亮 */
  .nv-highlight-node circle {
    stroke: ${THEME_COLORS.highlight} !important;
    stroke-width: 3px !important;
    stroke-opacity: 1.0 !important;
  }
  .nv-selected-pulse circle {
    animation: nv-pulse-stroke 2s infinite ease-in-out;
  }
  
  @keyframes nv-pulse-stroke {
    0%   { stroke-width: 1.5px; stroke-opacity: 0.6; }
    50%  { stroke-width: 4.5px; stroke-opacity: 1.0; stroke: ${THEME_COLORS.highlight}; }
    100% { stroke-width: 1.5px; stroke-opacity: 0.6; }
  }

  /* 连接节点样式 */
  .nv-connected-node circle {
    stroke: ${THEME_COLORS.connected} !important;
    stroke-width: 2.5px !important;
    opacity: 1.0 !important;
  }

  /* 边样式 */
  .nv-links path {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .nv-links path:hover {
    stroke: ${THEME_COLORS.highlight} !important;
    stroke-width: 3.5px !important;
  }

  /* 淡化效果 */
  .nv-dim { opacity: 0.28 !important; }
  .nv-dim-label { opacity: 0.22 !important; }

  /* 图标样式 */
  .nv-icon-typehub { fill: rgba(255,255,255,0.18); stroke: rgba(255,255,255,0.5); stroke-width: 1px; }
  .nv-icon-instance { fill: none; stroke: rgba(255,255,255,0.85); stroke-width: 1.2px; }
  .nv-icon-action { fill: rgba(255,255,255,0.25); stroke: rgba(255,255,255,0.6); stroke-width: 0.8px; }

  /* 过渡动画 */
  .nv-node, .nv-links path, .nv-node-label {
    transition: opacity 0.25s ease, stroke-width 0.25s ease, stroke 0.25s ease;
  }
`;

// ============================================================
// ReactFlow 样式 (用于 OntologyCanvas)
// ============================================================

export const REACTFLOW_STYLES = `
  .react-flow__controls {
    background: ${THEME_COLORS.surface} !important;
    border: 1px solid ${THEME_COLORS.border} !important;
    border-radius: 6px !important;
    overflow: hidden;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3) !important;
  }
  .react-flow__controls-button {
    background: transparent !important;
    border-bottom: 1px solid ${THEME_COLORS.border} !important;
    fill: ${THEME_COLORS.comment} !important;
    color: ${THEME_COLORS.comment} !important;
    width: 26px !important;
    height: 26px !important;
  }
  .react-flow__controls-button:hover {
    background: ${THEME_COLORS.elevated} !important;
    fill: ${THEME_COLORS.fg} !important;
    color: ${THEME_COLORS.fg} !important;
  }
  .react-flow__minimap {
    background: ${THEME_COLORS.surface} !important;
    border: 1px solid ${THEME_COLORS.border} !important;
    border-radius: 6px !important;
  }
  .react-flow__edge-path {
    transition: stroke 0.25s ease, stroke-width 0.2s ease;
  }
  .react-flow__edge.selected .react-flow__edge-path {
    stroke: ${THEME_COLORS.cyan} !important;
    stroke-width: 2.5px !important;
  }
`;

// ============================================================
// 工具函数
// ============================================================

/** 根据类型ID获取颜色 */
export function getColorByTypeId(typeId: number, isHub: boolean = false): string {
  const index = (typeId - 1) % TYPE_COLORS_WARM.length;
  return isHub ? TYPE_COLORS_WARM[index] : TYPE_COLORS_INSTANCE[index];
}

/** 根据链接类型ID获取颜色 */
export function getColorByLinkTypeId(linkTypeId: number): string {
  return LINKTYPE_COLORS[(linkTypeId - 1) % LINKTYPE_COLORS.length];
}

/** 获取虚线样式 */
export function getDashArray(linkTypeId: number): string {
  const dashPatterns = [
    '5 3',     // 影响
    '2 4',     // 养活
    '6 3 2 3', // 锚定
    '10 3',    // 支撑
    '',         // 依恋 (实线)
    '6 2 2 2', // 协助
    '',         // 推进 (实线)
  ];
  return dashPatterns[(linkTypeId - 1) % dashPatterns.length];
}

/** 截断文本 */
export function truncateLabel(label: string, maxChars: number): string {
  if (!label || label.length <= maxChars) return label;
  return label.substring(0, maxChars - 1) + '…';
}
