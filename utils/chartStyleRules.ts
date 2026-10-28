/**
 * Unified chart style rules — placement, text density, padding, overflow.
 * All dashboard / hub / builder charts must consume these via getChartOptions + plugins.
 * Do not patch individual widgets.
 *
 * Pie rules mirror ECharts concepts:
 *   minShowLabelAngle ≈ pieLabelMinPercent
 *   label.position inside/outside ≈ resolvePieLabelPlacement
 *   label.distance ≈ CHART_THEME.pieLabelDistance
 *   avoidLabelOverlap ≈ display 'auto' + pieLabelPlugin collision cull
 */

import type { ChartConfig } from '../types';
import { CHART_THEME } from './chartTheme';
import { formatPercentValue } from './chartFormat';

export type SliceLabel = NonNullable<ChartConfig['sliceLabels']>[number];

export type PieLabelPlacement = 'inside' | 'outside' | false;

/**
 * Decide whether a slice shows a label, and where.
 * `always` still hides near-zero slices to avoid unreadable crush.
 */
export function resolvePieLabelPlacement(
  percent: number | undefined,
  labelMode: ChartConfig['labelMode'] | undefined,
): PieLabelPlacement {
  if (labelMode === 'never') return false;
  const pct = percent ?? 0;
  if (pct <= 0) return false;
  if (pct >= CHART_THEME.pieLabelInsideMinPercent) return 'inside';
  return 'outside';
}

/** @deprecated Prefer resolvePieLabelPlacement — kept for call sites / tests */
export function pieSliceLabelDisplay(
  percent: number | undefined,
  labelMode: ChartConfig['labelMode'] | undefined,
): false | true | 'auto' {
  const place = resolvePieLabelPlacement(percent, labelMode);
  if (place === false) return false;
  if (labelMode === 'always') return true;
  return 'auto';
}

/**
 * Compact label text by placement.
 * Inside: engine `slice.label` = `数值, 百分比` (e.g. `83, 20%`).
 * Outside: short percent (or truncated name+%) — keeps leader-line labels readable.
 */
export function formatPieSliceLabelText(
  slice: SliceLabel | undefined,
  category: string,
  fallbackValue: string,
  placement: PieLabelPlacement = 'inside',
): string {
  if (placement === false) return '';

  if (!slice) {
    const name = category.trim();
    if (placement === 'outside') return fallbackValue;
    return name ? `${fallbackValue}` : fallbackValue;
  }

  if (placement === 'inside') {
    // Prefer engine preformatted "value, percent"
    if (slice.label && slice.label.trim()) return slice.label.trim();
    const pct = formatPercentValue(slice.percent);
    return `${fallbackValue}, ${pct}`;
  }

  // Keep both values available even after moving outside the sector.
  const pct = formatPercentValue(slice.percent);
  return `${fallbackValue}\n${pct}`;
}

export function truncateLabel(text: string, maxChars: number): string {
  const t = text.trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, Math.max(1, maxChars - 1))}…`;
}

/** Extra canvas padding — outside pie labels + leader lines need rim space. */
export function pieLayoutPadding(hasBottomLegend: boolean, hasOutsideLabels = true) {
  const rim = hasOutsideLabels ? 22 : 10;
  return {
    top: rim,
    right: rim,
    bottom: hasBottomLegend ? Math.max(6, rim - 8) : rim,
    left: rim,
  };
}

export function cartesianLayoutPadding(hasBottomLegend: boolean) {
  return {
    top: 12,
    right: 10,
    bottom: hasBottomLegend ? 6 : 6,
    left: 4,
  };
}

/**
 * Bar/value label align: keep labels readable without clipping into the bar body
 * when the segment is short (Chart.js datalabels align).
 */
export function cartesianValueLabelAlign(
  value: number | null | undefined,
  chartMax: number | undefined,
  horizontal: boolean,
): 'start' | 'end' | 'center' {
  if (value == null || !Number.isFinite(value)) return 'end';
  const max = chartMax && chartMax !== 0 ? Math.abs(chartMax) : 1;
  const ratio = Math.abs(value) / max;
  if (ratio < 0.12) {
    // Too short to fit inside → place outside the end
    return 'end';
  }
  if (ratio < 0.22) return horizontal ? 'end' : 'end';
  return 'center';
}

export function cartesianValueLabelAnchor(
  value: number | null | undefined,
  chartMax: number | undefined,
): 'start' | 'end' | 'center' {
  if (value == null || !Number.isFinite(value)) return 'end';
  const max = chartMax && chartMax !== 0 ? Math.abs(chartMax) : 1;
  const ratio = Math.abs(value) / max;
  // Short bars: anchor at end so "align end" sits just outside
  if (ratio < 0.18) return 'end';
  return 'center';
}

/** Estimate whether text fits in an annular sector (rough chord length). */
export function pieSliceCanFitInside(
  percent: number,
  outerRadius: number,
  innerRadius: number,
  textWidth: number,
  textHeight: number,
): boolean {
  if (percent < CHART_THEME.pieLabelInsideMinPercent) return false;
  const midR = (outerRadius + innerRadius) / 2;
  const angle = (percent / 100) * Math.PI * 2;
  const arcLen = midR * angle;
  const thickness = Math.max(0, outerRadius - innerRadius);
  // Need both angular room and radial thickness
  return arcLen >= textWidth * 0.92 && thickness >= textHeight * 1.15;
}

export function anyOutsidePieLabels(
  slices: Array<{ percent?: number } | undefined>,
  labelMode: ChartConfig['labelMode'] | undefined,
): boolean {
  return slices.some((s) => resolvePieLabelPlacement(s?.percent, labelMode) === 'outside');
}

/** Placement uses rendered bar capacity and measured text, never a value/domain ratio. */
export function barLabelPlacement(value: number, width: number, height: number, textWidth: number, textHeight: number) {
  const inside = width >= textWidth + 8 && height >= textHeight + 6;
  return { anchor: inside ? 'center' as const : value < 0 ? 'start' as const : 'end' as const,
    align: inside ? 'center' as const : value < 0 ? 'start' as const : 'end' as const };
}
