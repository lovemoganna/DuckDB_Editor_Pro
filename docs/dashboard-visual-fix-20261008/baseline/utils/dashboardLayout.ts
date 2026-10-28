export type WidgetContent = { kind: 'value' | 'chart' | 'table'; rows?: number; metrics?: number };
export function chartContent(type: string, rows?: number, metrics?: number): WidgetContent {
  return { kind: ['kpi', 'counter'].includes(type) ? 'value' : ['table', 'pivot'].includes(type) ? 'table' : 'chart', rows, metrics };
}

/** Presentation only. Never writes saved grid coordinates. */
export function widgetSpace(content: WidgetContent, width: number) {
  if (content.kind === 'value') return {
    width: Math.min(240, width),
    height: 120 + Math.ceil((content.metrics || 1) / Math.max(1, Math.floor(width / 220))) * 64,
  };
  if (content.kind === 'table') return {
    width: Math.min(480, width), height: Math.min(440, 144 + Math.max(1, content.rows ?? 8) * 32),
  };
  return { width: Math.min(480, width), height: width < 480 ? 360 : 400 };
}

export function readingLayout(items: Array<{ i: string; x: number; y: number }>, width: number, content: Record<string, WidgetContent>) {
  const columns = Math.max(1, Math.floor((width + 12) / 252));
  const cell = (width - (columns - 1) * 12) / columns;
  let column = 1, row = 1;
  return { columns, items: [...items].sort((a, b) => a.y - b.y || a.x - b.x).map(item => {
    const info = content[item.i] || { kind: 'chart' as const };
    const minimum = widgetSpace(info, width);
    const span = Math.min(columns, Math.max(1, Math.ceil((minimum.width + 12) / (cell + 12))));
    if (column + span - 1 > columns) { row++; column = 1; }
    const height = widgetSpace(info, cell * span + (span - 1) * 12).height;
    const result = { i: item.i, column, span, row, height };
    column += span;
    return result;
  }) };
}
