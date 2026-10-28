/**
 * Shared Monokai chart visual tokens — single source for dashboard / hub / builders.
 * Do not scatter hex colors or font sizes in renderers.
 *
 * Behavioral layout (pie inside/outside, padding, collision) lives in chartStyleRules
 * + chartPlugins; this file is tokens only.
 */

const token = (name: string, fallback: string) => typeof document === 'undefined' ? fallback : getComputedStyle(document.documentElement).getPropertyValue('--monokai-' + name).trim() || fallback;

export const CHART_THEME = {
  get fg() { return token('fg', '#f8f8f2'); },
  get muted() { return token('comment', '#a8a594'); },
  get grid() { return token('border', '#3e3d32'); },
  get border() { return token('border-strong', '#49483e'); },
  get bg() { return token('bg', '#272822'); },
  get surface() { return token('surface', '#2d2e27'); },
  get elevated() { return token('elevated', '#3e3d32'); },
  get accent() { return token('accent', '#a6e22e'); },
  /** High-contrast label on filled arcs */
  get labelOnArc() { return token('fg', '#f8f8f2'); },
  get leader() { return token('comment', 'rgba(168, 165, 148, 0.75)'); },
  /** Dynamic tooltip theme styles */
  get tooltipBg() { return token('elevated', 'rgba(39, 40, 34, 0.94)'); },
  get tooltipBorder() { return token('border-strong', '#49483e'); },
  fontSans: "'Noto Sans SC', 'Noto Sans', 'IBM Plex Sans', sans-serif",
  fontMono: "'JetBrains Mono', Consolas, monospace",
  /** Series palette (rgba fill @ 0.8) */
  get series() { return ['pink', 'accent', 'cyan', 'orange', 'purple', 'yellow'].map((name, index) => token(name, ['#f92672', '#a6e22e', '#66d9ef', '#fd971f', '#ae81ff', '#e6db74'][index])); },
  /** Typography scale (px) */
  titleSize: 13,
  legendSize: 12,
  tickSize: 12,
  labelSize: 12,
  labelSizeDense: 12,
  labelSizeMini: 12,
  centerValueSize: 14,
  centerLabelSize: 10,
  axisTitleSize: 12,
  tooltipTitleSize: 11,
  tooltipBodySize: 11,
  /** Layout */
  cutout: '62%',
  /**
   * Pie/doughnut label gates (ECharts minShowLabelAngle / avoidLabelOverlap equivalents).
   * percent is 0–100 share of total.
   */
  /** Hide entirely below this share */
  pieLabelMinPercent: 3.5,
  /** Prefer inside sector center at/above this share when ring thickness allows */
  pieLabelInsideMinPercent: 8,
  /** Outside+leader only down to this; between min and this → short outside or hide */
  pieLabelOutsideMinPercent: 3.5,
  /** Radial gap from outer rim to outside label (px) — like ECharts label.distance */
  pieLabelDistance: 14,
  /** Soft elbow length for leader line */
  pieLeaderBend: 10,
  /** Max outside labels after collision cull */
  pieOutsideLabelCap: 8,
  /** Doughnut center: hide when chartArea min side below this */
  centerMinSidePx: 64,
  legendBox: 12,
  legendPad: 16,
  legendMaxChars: 28,
  tickMaxChars: 12,
  tooltipPadding: 10,
} as const;

export type ChartTheme = typeof CHART_THEME;

/** Inside a filled bar, contrast follows the fill rather than the page theme. */
export function chartFillLabelColor(fill: unknown, background = CHART_THEME.bg): string {
  const rgb = (value: unknown): number[] | undefined => {
    if (typeof value !== 'string') return;
    const hex=value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i)?.[1];
    if(hex) {
      const full=hex.length===3?hex.split('').map(c=>c+c).join(''):hex;
      return [0,2,4].map(i=>parseInt(full.slice(i,i+2),16)).concat(full.length===8?parseInt(full.slice(6),16)/255:1);
    }
    if(/^rgba?\(/i.test(value) && !value.includes('%')) {
      const values=value.match(/[\d.]+/g)?.map(Number);
      if(values && values.length>=3)return [...values.slice(0,3),values[3] ?? 1];
    }
  };
  const color=rgb(fill), base=rgb(background);
  if(!color || !base)return CHART_THEME.fg;
  const alpha=Math.max(0,Math.min(1,color[3]));
  const linear=color.slice(0,3).map((value,index)=>(value*alpha+base[index]*(1-alpha))/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);
  const luminance=linear.reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
  return (1.05/(luminance+.05))>=((luminance+.05)/.05)?'#ffffff':'#000000';
}
