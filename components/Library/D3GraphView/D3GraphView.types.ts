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
  [key: string]: any;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  typeMap: Record<number, LifeObjectType>;
  linkTypeMap: Record<number, LifeLinkType>;
  typeNames: string[];       // ordered type names for legend
  _rawLinks?: LifeLink[];    // raw link rows from DuckDB, used for semantic layout
}

// ── Layout Types ──────────────────────────────────────────────────────────────

export type LayoutMode = 'force' | 'dagre' | 'circle' | 'grid';

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
 * TypeHub: purple/pink/orange spectrum (Monokai accent colors)
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
  '#5ab0d0', '#60c0e0', '#50d0a0', '#9090e0', '#e09090',
  '#5ab0d0', '#60c0e0', '#50d0a0', '#9090e0', '#e09090',
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
