export type WidgetContent = { kind: 'value' | 'chart' | 'table'; rows?: number; metrics?: number; rowHeight?: number };
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

export function readingLayout(items: Array<{ i: string; x: number; y: number }>, width: number, content: Record<string, WidgetContent>) {
  const availableColumns = Math.max(1, Math.floor((width + 12) / 252));
  const hasWideContent = items.some(item => content[item.i]?.kind !== 'value');
  const columns = hasWideContent && availableColumns > 2 && availableColumns % 2 === 1 ? availableColumns - 1 : availableColumns;
  const cell = (width - (columns - 1) * 12) / columns;
  let column = 1, row = 1;
  return { columns, items: [...items].sort((a, b) => a.y - b.y || a.x - b.x).map((item, index, ordered) => {
    const info = content[item.i] || { kind: 'chart' as const };
    const minimum = widgetSpace(info, width);
    let span = Math.min(columns, Math.max(1, Math.ceil((minimum.width + 12) / (cell + 12))));
    if (column + span - 1 > columns) { row++; column = 1; }
    const last = index === ordered.length - 1;
    if (last && column === 1 && info.kind !== 'value') span = columns;
    const height = widgetSpace(info, cell * span + (span - 1) * 12).height;
    const result = { i: item.i, column, span, row, height };
    column += span;
    return result;
  }) };
}
