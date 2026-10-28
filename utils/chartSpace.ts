/** Display geometry only: never filters or aggregates chart data. */
export const CHART_MIN_WIDTH = 480;
export const CHART_MIN_HEIGHT = 320;
export function chartSpace(input: { width: number; height?: number; type: string; labels: string[]; series: number; horizontal?: boolean }) {
  const arc = ['pie', 'doughnut'].includes(input.type);
  const longest = input.labels.reduce((max, label) => Math.max(max, Array.from(label).length), 0);
  const horizontal = input.horizontal && !arc;
  const continuous = ['line', 'area'].includes(input.type);
  const categoryWidth = continuous ? Math.max(24, Math.min(120, longest * 4)) : Math.max(56, Math.min(180, longest * 7));
  const minWidth = input.width > 0 ? Math.min(CHART_MIN_WIDTH, input.width) : CHART_MIN_WIDTH;
  const width = Math.max(minWidth, input.width || 0,
    !arc && !horizontal && input.type !== 'scatter' ? input.labels.length * (continuous ? categoryWidth : Math.max(categoryWidth, input.series * 84)) + 100 : 0);
  const height = arc
    ? (input.height && input.height > 0 ? Math.max(160, input.height) : 260)
    : Math.max(
        260,
        input.height || 0,
        horizontal ? input.labels.length * (input.type === 'funnel' ? 72 : 34) + 90 : 260,
        !horizontal ? 230 + Math.ceil(longest / Math.max(8, Math.floor(categoryWidth / 7))) * 16 : 0,
      );
  return { minWidth, minHeight: CHART_MIN_HEIGHT, width: Math.min(16000, width), height: Math.min(16000, height) };
}
export function wrapChartLabel(value: unknown, length = 16): string[] {
  const chars = Array.from(String(value ?? ''));
  const lines: string[] = [];
  for (let index = 0; index < chars.length; index += length) lines.push(chars.slice(index, index + length).join(''));
  return lines.length ? lines : [''];
}
export function chartColumns(width: number, minimum = CHART_MIN_WIDTH, gap = 16) {
  return Math.max(1, Math.floor((width + gap) / (minimum + gap)));
}
export function chartPixelRatio(width:number,height:number,requested:number) {
  return Math.min(Number.isFinite(requested)&&requested>0?requested:1, 2, Math.sqrt(16000000/Math.max(1,width*height)));
}
