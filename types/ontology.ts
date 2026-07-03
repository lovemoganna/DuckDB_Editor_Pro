/**
 * types/ontology.ts — 本体模块统一类型定义
 *
 * 整合所有本体相关类型，消除跨文件重复定义。
 * 组件层、Store 层、Service 层统一从此文件导入类型。
 */

import type { LifeObjectType, LifeObject, LifeLinkType, LifeLink, LifeAction, LifeIntrospection, LifeInsight } from '../hooks/useOntologyStore';

// ── MECE 层 ──────────────────────────────────────────────────
export type MECELayer = 'foundation' | 'relations' | 'methodology' | 'patterns' | 'domains';

export const MECE_LAYER_LABELS: Record<MECELayer, string> = {
  foundation: '基础层',
  relations: '关系层',
  methodology: '方法论层',
  patterns: '模式层',
  domains: '领域层',
};

// ── MECE 五层颜色语义（按 Ontology_Canvas_MECE_Optimize_Prompt.md 规范）────────
export const MECE_LAYER_COLORS: Record<MECELayer, string> = {
  foundation:  '#a78bfa', // purple-400 — 对象类型
  relations:   '#38bdf8', // sky-400 — 链接类型
  methodology: '#4ade80',  // green-400 — 行动
  patterns:    '#fb923c',  // orange-400 — 洞察
  domains:     '#fbbf24',  // amber-400 — 自省
};

export const MECE_LAYER_TAILWIND: Record<MECELayer, string> = {
  foundation:  'text-purple-400',
  relations:   'text-sky-400',
  methodology: 'text-green-400',
  patterns:    'text-orange-400',
  domains:     'text-amber-400',
};

export const MECE_LAYER_BG: Record<MECELayer, string> = {
  foundation:  'bg-purple-400',
  relations:   'bg-sky-400',
  methodology: 'bg-green-400',
  patterns:    'bg-orange-400',
  domains:     'bg-amber-400',
};

// ── Canvas 常量 ────────────────────────────────────────────────
export const CANVAS_WIDTH = 4600;
export const CANVAS_HEIGHT = 3200;
export const CANVAS_MIN_ZOOM = 0.1;
export const CANVAS_MAX_ZOOM = 3.0;
export const CANVAS_DEFAULT_ZOOM = 1.0;

// 节点类型颜色轮转（用于无 MECE 层信息时的降级展示）
export const NODE_TYPE_COLORS = [
  '#7dd3fc', // sky-300
  '#a78bfa', // purple-400
  '#4ade80', // green-400
  '#fbbf24', // amber-400
  '#fb923c', // orange-400
  '#f472b6', // pink-400
  '#67e8f9', // cyan-300
];

// 边的颜色语义
export const EDGE_COLORS = {
  strong:  '#22c55e', // green-500
  weak:    '#94a3b8', // slate-400
  default: '#38bdf8', // sky-400
};

// ── 快速清除级别 ───────────────────────────────────────────────
export type ClearLevel = 'L1' | 'L2' | 'L3';

export const CLEAR_LEVEL_DESCRIPTIONS: Record<ClearLevel, { label: string; description: string; tables: string[] }> = {
  L1: {
    label: '清除行动',
    description: '清空所有待执行行动，保留对象和关系',
    tables: ['life_action'],
  },
  L2: {
    label: '清除实体',
    description: '清空对象和关系，保留表结构和行动',
    tables: ['life_object', 'life_link'],
  },
  L3: {
    label: '全部清空',
    description: '清空所有数据（保留表结构）',
    tables: ['life_object', 'life_link', 'life_object_type', 'life_link_type', 'life_action', 'life_introspection', 'life_insight', 'life_canvas_state'],
  },
};

// ── 快速导出的类型别名（兼容现有代码） ─────────────────────────
export type OntologyObjectType = LifeObjectType;
export type OntologyObject = LifeObject;
export type OntologyLinkType = LifeLinkType;
export type OntologyLink = LifeLink;
export type OntologyAction = LifeAction;
export type OntologyIntrospection = LifeIntrospection;
export type OntologyInsight = LifeInsight;

// ── Canvas 视图模式 ─────────────────────────────────────────────
export type CanvasViewMode = 'all' | 'core' | 'issues' | 'one-hop' | 'two-hop' | 'path';

export const VIEW_MODE_LABELS: Record<CanvasViewMode, string> = {
  all:     '全量视图',
  core:    '核心视图',
  issues:  '异常视图',
  'one-hop': '一跳局部',
  'two-hop': '两跳局部',
  path:    '路径追踪',
};
