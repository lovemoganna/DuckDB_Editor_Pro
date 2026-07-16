// Pure types and constants — no JSX allowed

export interface CanvasItem {
  id: string;
  objectId: number;
  x: number;
  y: number;
  width: number;
  height: number;
  nodeType?: string;
  metadata?: any;
}

export interface CanvasEdge {
  id: string;
  sourceId: string;
  targetId: string;
}

export interface CanvasSpace {
  id: string;
  title: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  collapsed: boolean;
  items: CanvasItem[];
}

export interface CanvasState {
  spaces: CanvasSpace[];
  items: CanvasItem[];
  edges: CanvasEdge[];
  viewportX: number;
  viewportY: number;
  zoom: number;
}

export const SPACE_COLORS = [
  '#ae81ff', '#38bdf8', '#4ade80', '#fb923c',
  '#f472b6', '#a3e635', '#fbbf24', '#60a5fa',
];

export type MECELayer = 'foundation' | 'relations' | 'methodology' | 'patterns' | 'domains';

export const MECE_LAYER_COLORS: Record<MECELayer, string> = {
  foundation:  '#ae81ff',
  relations:   '#38bdf8',
  methodology: '#4ade80',
  patterns:    '#fb923c',
  domains:     '#fbbf24',
};

export type CanvasMode = 'pipeline' | 'knowledge' | 'explorer';
