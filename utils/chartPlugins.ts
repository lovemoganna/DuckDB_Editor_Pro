import type { Chart, ChartType, ChartTypeRegistry, Plugin } from 'chart.js';
import { CHART_THEME } from './chartTheme';
import {
  formatPieSliceLabelText,
  pieSliceCanFitInside,
  resolvePieLabelPlacement,
  type SliceLabel,
} from './chartStyleRules';

export interface DoughnutCenterOptions {
  /** Primary value text (already formatted) */
  valueText?: string | null;
  /** Caption above value, e.g. 合计 */
  labelText?: string | null;
  /** Hide when chart area is too small */
  minSidePx?: number;
}

export interface PieLabelPluginOptions {
  /** Map of category → engine slice label */
  sliceMap?: Map<string, SliceLabel>;
  slices?: SliceLabel[];
  visibleRange?: { from:number; to:number };
  labelMode?: 'auto' | 'always' | 'never';
  /** Format a raw value for inside labels when slice.label missing */
  formatValue?: (raw: unknown, category: string) => string;
}

declare module 'chart.js' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface PluginOptionsByType<TType extends ChartType> {
    doughnutCenter?: DoughnutCenterOptions;
    pieSectorLabels?: PieLabelPluginOptions;
  }
}

type CenterOpts = DoughnutCenterOptions;

type ArcGeom = {
  x: number;
  y: number;
  startAngle: number;
  endAngle: number;
  innerRadius: number;
  outerRadius: number;
};

function readArc(el: unknown): ArcGeom | null {
  const a = el as Partial<ArcGeom>;
  if (
    a == null ||
    typeof a.x !== 'number' ||
    typeof a.y !== 'number' ||
    typeof a.startAngle !== 'number' ||
    typeof a.endAngle !== 'number' ||
    typeof a.innerRadius !== 'number' ||
    typeof a.outerRadius !== 'number'
  ) {
    return null;
  }
  return a as ArcGeom;
}

function chartTypeOf(chart: Chart): string | undefined {
  const cfg = chart.config as { type?: string };
  return cfg?.type;
}

/**
 * Draws KPI text at the true geometric center of the doughnut arcs
 * (not the full canvas, which includes legend / padding).
 * Scales font with the hole so it stays centered across widget sizes.
 */
export const doughnutCenterPlugin: Plugin<keyof ChartTypeRegistry, CenterOpts> = {
  id: 'doughnutCenter',
  afterDraw(chart: Chart, _args, opts: CenterOpts = {}) {
    const valueText = opts.valueText;
    if (valueText == null || valueText === '') return;
    if (chartTypeOf(chart) !== 'doughnut') return;

    const meta = chart.getDatasetMeta(0);
    const arcs = meta?.data;
    if (!arcs?.length) return;

    // Average arc centers in case of tiny float drift
    let sx = 0;
    let sy = 0;
    let n = 0;
    let innerR = 0;
    for (const el of arcs) {
      const g = readArc(el);
      if (!g) continue;
      sx += g.x;
      sy += g.y;
      innerR = Math.max(innerR, g.innerRadius);
      n += 1;
    }
    if (!n) return;
    const cx = sx / n;
    const cy = sy / n;

    const { chartArea } = chart;
    const areaW = chartArea.right - chartArea.left;
    const areaH = chartArea.bottom - chartArea.top;
    const minSide = Math.min(areaW, areaH);
    const minSidePx = opts.minSidePx ?? CHART_THEME.centerMinSidePx;
    if (minSide < minSidePx) return;

    const hole = innerR > 0 ? innerR * 2 : minSide * 0.55;
    const maxW = Math.max(24, hole * 0.82);

    const ctx = chart.ctx;
    const labelText = opts.labelText || '';
    const valueSize = Math.max(10, Math.min(CHART_THEME.centerValueSize + 6, Math.floor(hole * 0.26)));
    const labelSize = Math.max(8, Math.min(CHART_THEME.centerLabelSize, Math.floor(valueSize * 0.7)));

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const fit = (text: string, fontPx: number, weight: string, family: string) => {
      ctx.font = `${weight} ${fontPx}px ${family}`;
      let size = fontPx;
      while (size > 8 && ctx.measureText(text).width > maxW) {
        size -= 1;
        ctx.font = `${weight} ${size}px ${family}`;
      }
      return size;
    };

    let vSize = fit(String(valueText), valueSize, '700', CHART_THEME.fontMono);
    const hasLabel = Boolean(labelText);
    let lSize = hasLabel
      ? fit(String(labelText), labelSize, '500', CHART_THEME.fontSans)
      : 0;
    let gap = hasLabel ? Math.max(2, Math.round(vSize * 0.16)) : 0;
    let blockH = hasLabel ? lSize + gap + vSize : vSize;

    if (blockH > hole * 0.82) {
      const scale = (hole * 0.82) / blockH;
      vSize = Math.max(8, Math.floor(vSize * scale));
      if (hasLabel) lSize = Math.max(8, Math.floor(lSize * scale));
      gap = hasLabel ? Math.max(2, Math.round(vSize * 0.16)) : 0;
      blockH = hasLabel ? lSize + gap + vSize : vSize;
    }

    // True vertical center of the text block on (cx, cy)
    const midY = cy;

    if (hasLabel) {
      ctx.fillStyle = CHART_THEME.muted;
      ctx.font = `500 ${lSize}px ${CHART_THEME.fontSans}`;
      ctx.fillText(String(labelText), cx, midY - blockH / 2 + lSize / 2, maxW);
    }

    ctx.fillStyle = CHART_THEME.fg;
    ctx.font = `700 ${vSize}px ${CHART_THEME.fontMono}`;
    ctx.fillText(
      String(valueText),
      cx,
      hasLabel ? midY - blockH / 2 + lSize + gap + vSize / 2 : midY,
      maxW,
    );

    ctx.restore();
  },
};

type PieLabelOpts = PieLabelPluginOptions;

type PlannedLabel = {
  index: number;
  text: string;
  lines: string[];
  placement: 'inside' | 'outside';
  mid: number;
  cx: number;
  cy: number;
  innerR: number;
  outerR: number;
  x: number;
  y: number;
  fontPx: number;
  width: number;
  height: number;
};

/**
 * Pie/doughnut slice labels with ECharts-like placement:
 * - default: visual center of the sector (inside)
 * - if too narrow: outside + leader line with elbow
 * - Two-pass vertical packing for left/right halves (ECharts avoidLabelOverlap)
 * - Inside labels registered in shared collision table so outside never overlaps them
 * - Never paint outside the canvas (clip)
 *
 * Disables reliance on chartjs-plugin-datalabels for arc charts.
 */
export const pieLabelPlugin: Plugin<keyof ChartTypeRegistry, PieLabelOpts> = {
  id: 'pieSectorLabels',
  afterDatasetsDraw(chart: Chart, _args, opts: PieLabelOpts = {}) {
    const type = chartTypeOf(chart);
    if (type !== 'pie' && type !== 'doughnut') return;
    if (opts.labelMode === 'never') return;

    const meta = chart.getDatasetMeta(0);
    if (!meta?.data?.length || meta.hidden) return;

    const labels = (chart.data.labels || []) as unknown[];
    const data = (chart.data.datasets[0]?.data || []) as unknown[];
    const sliceMap = opts.sliceMap || new Map<string, SliceLabel>();
    const fmt = opts.formatValue || ((v: unknown) => String(v ?? ''));

    const ctx = chart.ctx;
    const { chartArea } = chart;
    const areaW = chartArea.right - chartArea.left;
    const areaH = chartArea.bottom - chartArea.top;
    if (Math.min(areaW, areaH) < 40) return;
    const canvasW = chart.width;
    const canvasH = chart.height;

    const planned: PlannedLabel[] = [];
    const insideBoxes: Array<{ l: number; t: number; r: number; b: number }> = [];

    for (let i = 0; i < meta.data.length; i++) {
      if (opts.visibleRange && (i < opts.visibleRange.from || i >= opts.visibleRange.to)) continue;
      const geom = readArc(meta.data[i]);
      if (!geom) continue;
      const cat = String(labels[i] ?? '');
      if (!chart.getDataVisibility(i) || geom.endAngle <= geom.startAngle) continue;
      const slice = opts.slices?.[i] || sliceMap.get(cat);
      if (!slice) continue;
      const percent = slice.percent;
      let placement = resolvePieLabelPlacement(percent, opts.labelMode);
      if (!placement) continue;
      const fallback = fmt(data[i], cat);
      const synthetic = slice;
      let text = formatPieSliceLabelText(synthetic, cat, fallback, placement);
      if (placement === 'inside') text = text.replace(', ', '\n');
      if (!text) continue;

      const mid = (geom.startAngle + geom.endAngle) / 2;
      const thickness = Math.max(1, geom.outerRadius - geom.innerRadius);
      let fontPx = Math.max(
        CHART_THEME.labelSizeMini,
        Math.min(
          placement === 'inside' ? CHART_THEME.labelSize : CHART_THEME.labelSizeDense,
          Math.floor(thickness * 0.42),
        ),
      );

      ctx.save();
      ctx.font = `500 ${fontPx}px ${CHART_THEME.fontMono}`;
      let lines = text.split('\n');
      let width = Math.max(...lines.map((ln) => ctx.measureText(ln).width));
      let height = lines.length * (fontPx * 1.15);
      ctx.restore();

      // Check inside placement capacity and collisions with other inside labels
      if (placement === 'inside') {
        const fits = pieSliceCanFitInside(
          percent ?? 0,
          geom.outerRadius,
          geom.innerRadius,
          width,
          height,
        );
        const midR = (geom.innerRadius + geom.outerRadius) / 2;
        const testX = geom.x + Math.cos(mid) * midR;
        const testY = geom.y + Math.sin(mid) * midR;
        const box = {
          l: testX - width / 2 - 1,
          t: testY - height / 2 - 1,
          r: testX + width / 2 + 1,
          b: testY + height / 2 + 1,
        };
        const collidesInside = insideBoxes.some(
          (b) => !(box.r < b.l || box.l > b.r || box.b < b.t || box.t > b.b),
        );

        if (!fits || collidesInside) {
          placement = 'outside';
          text = formatPieSliceLabelText(synthetic, cat, fallback, 'outside');
          if (!text) continue;
          fontPx = Math.max(
            CHART_THEME.labelSizeMini,
            Math.min(CHART_THEME.labelSizeDense, Math.floor(thickness * 0.42)),
          );
        } else {
          insideBoxes.push(box);
        }
      }

      const midR =
        placement === 'inside'
          ? (geom.innerRadius + geom.outerRadius) / 2
          : geom.outerRadius + CHART_THEME.pieLabelDistance;

      let x = geom.x + Math.cos(mid) * midR;
      let y = geom.y + Math.sin(mid) * midR;

      // Re-measure if text changed after promotion
      ctx.save();
      ctx.font = `500 ${fontPx}px ${CHART_THEME.fontMono}`;
      const lines2 = text.split('\n');
      const lineH2 = fontPx * 1.15;
      const width2 = Math.max(...lines2.map((ln) => ctx.measureText(ln).width));
      const height2 = lines2.length * lineH2;
      ctx.restore();

      if (placement === 'outside') {
        const pad = 2;
        x = Math.min(canvasW - width2 / 2 - pad, Math.max(width2 / 2 + pad, x));
        y = Math.min(chartArea.bottom - height2 / 2 - pad, Math.max(chartArea.top + height2 / 2 + pad, y));
      }

      planned.push({
        index: i,
        text,
        lines: lines2,
        placement,
        mid,
        cx: geom.x,
        cy: geom.y,
        innerR: geom.innerRadius,
        outerR: geom.outerRadius,
        x,
        y,
        fontPx,
        width: width2,
        height: height2,
      });
    }

    // ── Two-pass vertical packing for outside labels (ECharts avoidLabelOverlap) ──
    const GUTTER = 3;   // minimum vertical gap between adjacent label boxes (px)
    const EDGE_PAD = 4; // minimum gap from canvas edge (px)

    function packHalf(items: PlannedLabel[], isLeft: boolean) {
      if (!items.length) return;
      items.sort((a, b) => a.y - b.y);

      const minAvailableY = chartArea.top + EDGE_PAD;
      const maxAvailableY = chartArea.bottom - EDGE_PAD;
      const totalH = items.reduce((sum, item) => sum + item.height, 0);
      const availableSpace = maxAvailableY - minAvailableY;
      const effectiveGutter =
        items.length > 1 && totalH + (items.length - 1) * GUTTER > availableSpace
          ? Math.max(1, (availableSpace - totalH) / (items.length - 1))
          : GUTTER;

      // Forward pass: push items down to avoid overlap with the item above
      for (let i = 1; i < items.length; i++) {
        const prev = items[i - 1];
        const cur = items[i];
        const minY = prev.y + prev.height / 2 + effectiveGutter + cur.height / 2;
        if (cur.y < minY) cur.y = minY;
      }

      // Clamp to bottom edge, then backward pass to pull items up
      for (let i = items.length - 1; i >= 0; i--) {
        const cur = items[i];
        const maxY = maxAvailableY - cur.height / 2;
        if (cur.y > maxY) cur.y = maxY;
        if (i > 0) {
          const maxPrevY =
            items[i].y - items[i].height / 2 - effectiveGutter - items[i - 1].height / 2;
          if (items[i - 1].y > maxPrevY) items[i - 1].y = maxPrevY;
        }
      }

      // Clamp to top edge, then forward pass again
      if (items[0].y < minAvailableY + items[0].height / 2) {
        items[0].y = minAvailableY + items[0].height / 2;
        for (let i = 1; i < items.length; i++) {
          const prev = items[i - 1];
          const cur = items[i];
          const needed = prev.y + prev.height / 2 + effectiveGutter + cur.height / 2;
          if (cur.y < needed) cur.y = needed;
        }
      }

      // Snap X to the correct side so labels don't straddle the center
      for (const p of items) {
        if (isLeft) {
          const idealX = p.cx - p.outerR - CHART_THEME.pieLabelDistance - p.width / 2;
          p.x = Math.max(EDGE_PAD + p.width / 2, idealX);
        } else {
          const idealX = p.cx + p.outerR + CHART_THEME.pieLabelDistance + p.width / 2;
          p.x = Math.min(canvasW - EDGE_PAD - p.width / 2, idealX);
        }
      }
    }

    const outsideLeft = planned.filter(
      (p) => p.placement === 'outside' && Math.cos(p.mid) < 0,
    );
    const outsideRight = planned.filter(
      (p) => p.placement === 'outside' && Math.cos(p.mid) >= 0,
    );
    packHalf(outsideLeft, true);
    packHalf(outsideRight, false);

    // ── Collision cull: drop outside labels that still overlap inside ones ─
    const collisionBoxes: Array<{ l: number; t: number; r: number; b: number }> = [];
    for (const p of planned) {
      if (p.placement === 'inside') {
        collisionBoxes.push({
          l: p.x - p.width / 2 - 1,
          t: p.y - p.height / 2 - 1,
          r: p.x + p.width / 2 + 1,
          b: p.y + p.height / 2 + 1,
        });
      }
    }

    // Sort outside by descending slice percent so larger slices win cull
    const outsideAll = [...outsideLeft, ...outsideRight].sort((a, b) =>
      (opts.slices?.[b.index]?.percent ?? sliceMap.get(String(labels[b.index]))?.percent ?? 0) -
      (opts.slices?.[a.index]?.percent ?? sliceMap.get(String(labels[a.index]))?.percent ?? 0));
    const keptOutside = new Set<number>();
    for (const p of outsideAll) {
      const box = {
        l: p.x - p.width / 2 - 2,
        t: p.y - p.height / 2 - 2,
        r: p.x + p.width / 2 + 2,
        b: p.y + p.height / 2 + 2,
      };
      const hit = collisionBoxes.some(
        (b) => !(box.r < b.l || box.l > b.r || box.b < b.t || box.t > b.b),
      );
      if (hit || box.l < 0 || box.r > canvasW || box.t < 0 || box.b > canvasH) continue;
      collisionBoxes.push(box);
      keptOutside.add(p.index);
    }

    const visible = planned.filter(
      (p) => p.placement === 'inside' || keptOutside.has(p.index),
    );

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, canvasW, canvasH);
    ctx.clip();

    for (const p of visible) {
      if (p.placement === 'outside') {
        // Leader: radial segment rim->bend, then horizontal elbow bend->label edge
        const rimX = p.cx + Math.cos(p.mid) * p.outerR;
        const rimY = p.cy + Math.sin(p.mid) * p.outerR;
        const bendR = p.outerR + CHART_THEME.pieLeaderBend;
        const bendX = p.cx + Math.cos(p.mid) * bendR;
        const bendY = Math.max(chartArea.top + EDGE_PAD, Math.min(chartArea.bottom - EDGE_PAD, p.cy + Math.sin(p.mid) * bendR));
        const isLeftSide = Math.cos(p.mid) < 0;
        const elbowEndX = isLeftSide ? p.x + p.width / 2 : p.x - p.width / 2;
        const elbowBendX = isLeftSide ? Math.max(elbowEndX + 2, bendX) : Math.min(elbowEndX - 2, bendX);

        ctx.strokeStyle = CHART_THEME.leader;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(rimX, rimY);
        ctx.lineTo(elbowBendX, bendY);
        ctx.lineTo(elbowEndX, p.y);
        ctx.stroke();
      }

      ctx.fillStyle = CHART_THEME.labelOnArc;
      ctx.font = `500 ${p.fontPx}px ${CHART_THEME.fontMono}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 1;
      const lineH = p.fontPx * 1.15;
      const top = p.y - ((p.lines.length - 1) * lineH) / 2;
      p.lines.forEach((ln, li) => {
        ctx.fillText(ln, p.x, top + li * lineH);
      });
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  },
};

