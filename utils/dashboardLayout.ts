export type WidgetContent = { kind: 'value' | 'chart' | 'table'; rows?: number; metrics?: number; rowHeight?: number };
import { layoutOverlaps } from '../services/workbench/dashboardFormat';

/** One canvas contract for editing and reading. Results never influence geometry. */
export const BOARD_CANVAS_MIN_WIDTH = 960;
export function viewportBoardLayout(items: Array<{i:string;x:number;y:number;w:number;h:number}>, width: number) {
  // An explicitly restored overlapping legacy layout remains readable without rewriting it.
  const stacked = width < BOARD_CANVAS_MIN_WIDTH || layoutOverlaps(items as import('../types').Dashboard['items']);
  return {
    stacked,
    columns: stacked ? 1 : 12,
    items: [...items].sort((a,b) => a.y - b.y || a.x - b.x).map((item,index) => ({
      i:item.i,
      column:stacked ? 1 : item.x + 1,
      span:stacked ? 1 : item.w,
      row:stacked ? index + 1 : item.y + 1,
      rowSpan:stacked ? 1 : item.h,
      height:item.h * 60 + (item.h - 1) * 8,
    })),
  };
}
export function chartContent(type: string, rows?: number, metrics?: number): WidgetContent {
  return { kind: ['kpi', 'counter'].includes(type) ? 'value' : ['table', 'pivot'].includes(type) ? 'table' : 'chart', rows, metrics };
}

/** Presentation only. Never writes saved grid coordinates. */
export function widgetSpace(content: WidgetContent, width: number) {
  if (content.kind === 'value') return {
    width: Math.min(240, width),
    height: 56 + Math.ceil((content.metrics || 1) / Math.max(1, Math.floor(width / 220))) * 64,
  };
  if (content.kind === 'table') return {
    width: Math.min(480, width), height: Math.min(440, 112 + Math.max(1, content.rows ?? 8) * (content.rowHeight || 34)),
  };
  return { width: Math.min(480, width), height: width < 480 ? 360 : 400 };
}

