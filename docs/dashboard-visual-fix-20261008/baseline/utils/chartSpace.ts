/** Display geometry only: never filters or aggregates chart data. */
export const CHART_MIN_WIDTH = 480;
export const CHART_MIN_HEIGHT = 320;
export function chartSpace(input: { width: number; height?: number; type: string; labels: string[]; series: number; horizontal?: boolean }) {
  const arc = ['pie', 'doughnut'].includes(input.type);
  const longest = Math.max(0, ...input.labels.map(label => Array.from(label).length));
  const horizontal = input.horizontal && !arc;
  const categoryWidth = Math.max(56, Math.min(180, longest * 7));
  const minWidth = input.width > 0 ? Math.min(CHART_MIN_WIDTH, input.width) : CHART_MIN_WIDTH;
  const width = Math.max(minWidth, input.width || 0,
    !arc && !horizontal && input.type !== 'scatter' ? input.labels.length * Math.max(categoryWidth, input.series * 18) + 100 : 0);
  const height = Math.max(260, input.height || 0, horizontal ? input.labels.length * 34 + 90 : 260,
    !horizontal && !arc ? 230 + Math.ceil(longest / Math.max(8, Math.floor(categoryWidth / 7))) * 16 : 0);
  return { minWidth, minHeight: CHART_MIN_HEIGHT, width, height };
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
