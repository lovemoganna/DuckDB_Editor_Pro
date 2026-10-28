import { wrapChartLabel } from './chartSpace';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    RadialLinearScale,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { ChartConfig } from '../types';
import { axisTitleWithUnit, formatValueBySpec, resolveChartUnit } from './chartFormat';
import type { ValueFormatSpec } from '../services/analysis/types';
import { CHART_THEME, chartFillLabelColor } from './chartTheme';
import { doughnutCenterPlugin, pieLabelPlugin } from './chartPlugins';
import {
    cartesianLayoutPadding,
    barLabelPlacement,
    cartesianValueLabelAlign,
    cartesianValueLabelAnchor,
    pieLayoutPadding,
    truncateLabel,
} from './chartStyleRules';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    RadialLinearScale,
    Title,
    Tooltip,
    Legend,
    Filler,
    ChartDataLabels,
    doughnutCenterPlugin,
    pieLabelPlugin,
);

/** @deprecated Prefer CHART_THEME.series -?kept for existing imports */
export const MONOKAI_COLORS = [...CHART_THEME.series];

function datasetMaxAbs(data: unknown[] | undefined): number {
    if (!data?.length) return 1;
    let m = 0;
    for (const v of data) {
        const n = typeof v === 'number' ? v : Number(v);
        if (Number.isFinite(n)) m = Math.max(m, Math.abs(n));
    }
    return m || 1;
}

export const getChartOptions = (config: ChartConfig) => {
    const isPie = config.type === 'pie' || config.type === 'doughnut';
    const isDoughnut = config.type === 'doughnut';
    const isBar = config.type === 'bar';
    const fontSans = CHART_THEME.fontSans;
    const fontMono = CHART_THEME.fontMono;
    const format = (config.format || {}) as ValueFormatSpec;
    const unit = format.unit || resolveChartUnit(config);
    const primaryFormat: ValueFormatSpec = {
        compact: true,
        thousandSeparator: true,
        ...format,
        unit: config.stackMode === 'percent' ? '%' : unit,
        percent: config.stackMode === 'percent' || format.percent || unit === '%',
    };
    const rightFormat: ValueFormatSpec = {
        compact: true,
        thousandSeparator: true,
        unit: config.unitRight || undefined,
    };
    const legendPosition = config.legendPosition || 'bottom';
    const legendAlign = config.legendAlign || 'center';
    const defaultLabelMode = isPie
        ? (config.showValues === false || config.labelMode === 'never' ? 'never' : 'auto')
        : (config.showValues ? 'auto' : (config.labelMode || 'never'));
    const labelMode = config.labelMode || defaultLabelMode;
    const sliceMap = new Map((config.sliceLabels || []).map((s) => [s.key, s]));
    const hasBottomLegend = config.showLegend !== false && legendPosition === 'bottom';
    const hasOutsidePie = isPie; // always reserve rim -?plugin may promote inside→outside at draw time

    const fmt = (v: unknown, key?: string) => {
        const per = key && config.formatByKey?.[key];
        return formatValueBySpec(v, { ...primaryFormat, ...per } as ValueFormatSpec);
    };

    const barPlacement = (ctx: { dataset?: { data?: unknown[]; displayValues?: string[]; metricKey?: string; label?: string; yAxisID?: string }; dataIndex?: number; datasetIndex?: number; chart?: { ctx: CanvasRenderingContext2D; getDatasetMeta(index: number): { data: unknown[] } } }) => {
        const raw = ctx.dataset?.data?.[ctx.dataIndex ?? 0];
        const value = Array.isArray(raw) ? Number(raw[1]) - Number(raw[0]) : Number(raw);
        const element = ctx.chart?.getDatasetMeta(ctx.datasetIndex ?? 0)?.data[ctx.dataIndex ?? 0] as { width?: number; height?: number } | undefined;
        const key = ctx.dataset?.metricKey || ctx.dataset?.label || '';
        const text = ctx.dataset?.displayValues?.[ctx.dataIndex ?? 0] ?? (ctx.dataset?.yAxisID === 'y1' ? formatValueBySpec(value, { ...rightFormat, ...config.formatByKey?.[key] }) : fmt(value, key));
        const context = ctx.chart?.ctx;
        if (!element || !context) return { anchor: cartesianValueLabelAnchor(value, datasetMaxAbs(ctx.dataset?.data)), align: cartesianValueLabelAlign(value, datasetMaxAbs(ctx.dataset?.data), !!config.horizontal) };
        context.save();context.font = `${CHART_THEME.labelSize}px ${fontMono}`;
        const measured = Math.max(...text.split('\n').map(line => context.measureText(line).width));context.restore();
        return barLabelPlacement(value, Math.abs(element.width ?? 0), Math.abs(element.height ?? 0), measured, CHART_THEME.labelSize * 1.2 * text.split('\n').length);
    };
    const centerTotalValue =
        config.centerTotal != null
            ? config.centerTotal
            : isDoughnut && config.sliceLabels?.length
                ? config.sliceLabels.reduce<number>(
                    (sum, s) => sum + (typeof s.value === 'number' && !isNaN(s.value) ? s.value : 0),
                    0,
                )
                : null;
    const centerValueText =
        isDoughnut && centerTotalValue != null
            ? fmt(centerTotalValue)
            : null;

    const axisFormat = primaryFormat;
    const axisTitleFont = {
        family: fontSans,
        size: CHART_THEME.axisTitleSize,
        weight: 500 as const,
    };

    return {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: (config.horizontal ? 'y' : 'x') as 'x' | 'y',
        ...(isDoughnut ? { cutout: CHART_THEME.cutout } : {}),
        ...(config.type === 'pie' ? { cutout: 0 } : {}),
        layout: {
            padding: isPie
                ? pieLayoutPadding(hasBottomLegend, hasOutsidePie)
                : cartesianLayoutPadding(hasBottomLegend),
        },
        interaction: { mode: isPie || config.type === 'scatter' ? 'nearest' as const : 'index' as const, intersect: isPie || config.type === 'scatter' },
        onClick: undefined as undefined | ((evt: unknown, elements: Array<{ index: number; datasetIndex?: number }>) => void),
        plugins: {
            legend: {
                display: config.showLegend !== false,
                position: legendPosition,
                align: legendAlign,
                onHover: (event: any) => {
                    const canvas = event?.chart?.canvas;
                    if (canvas) canvas.style.cursor = 'pointer';
                },
                onLeave: (event: any) => {
                    const canvas = event?.chart?.canvas;
                    if (canvas) canvas.style.cursor = 'default';
                },
                labels: {
                    color: CHART_THEME.fg,
                    font: { family: fontSans, size: CHART_THEME.legendSize, weight: 600 as const },
                    boxWidth: CHART_THEME.legendBox,
                    boxHeight: CHART_THEME.legendBox,
                    padding: CHART_THEME.legendPad,
                    usePointStyle: true,
                    pointStyle: isPie ? ('circle' as const) : ('rectRounded' as const),
                    generateLabels: (chart: {
                        getDataVisibility?: (index: number) => boolean;
                        isDatasetVisible?: (index: number) => boolean;
                        data: {
                            labels?: unknown[];
                            datasets: Array<{
                                backgroundColor?: string | string[];
                                borderColor?: string | string[];
                                label?: string;
                                data?: unknown[];
                            }>;
                        };
                        legend?: { options?: { labels?: { generateLabels?: (c: unknown) => unknown[] } } };
                    }) => {
                        // Arc charts: one legend item per category
                        if (isPie) {
                            const ds = chart.data.datasets[0];
                            const cats = chart.data.labels || [];
                            const colors = (ds?.backgroundColor || []) as string[];
                            return cats.map((cat, i) => {
                                const isVisible = chart.getDataVisibility ? chart.getDataVisibility(i) : true;
                                return {
                                    text: String(cat ?? ''),
                                    fillStyle: isVisible
                                        ? (colors[i % Math.max(colors.length, 1)] || CHART_THEME.series[i % CHART_THEME.series.length])
                                        : 'rgba(255, 255, 255, 0.15)',
                                    strokeStyle: isVisible ? CHART_THEME.bg : '#75715e',
                                    lineWidth: 1.5,
                                    fontColor: isVisible ? CHART_THEME.fg : '#75715e',
                                    hidden: !isVisible,
                                    index: i,
                                    datasetIndex: 0,
                                    pointStyle: 'circle' as const,
                                };
                            });
                        }
                        // Series legend with truncation
                        return (chart.data.datasets || []).map((ds, i) => {
                            const isVisible = chart.isDatasetVisible ? chart.isDatasetVisible(i) : true;
                            const baseBg = (Array.isArray(ds.backgroundColor)
                                ? ds.backgroundColor[0]
                                : ds.backgroundColor) || CHART_THEME.series[i % CHART_THEME.series.length];
                            const strokeBg = (Array.isArray(ds.borderColor)
                                ? ds.borderColor[0]
                                : ds.borderColor) || CHART_THEME.border;
                            return {
                                text: String(ds.label || `系列 ${i + 1}`),
                                fillStyle: isVisible ? baseBg : 'rgba(255, 255, 255, 0.15)',
                                strokeStyle: isVisible ? strokeBg : '#75715e',
                                lineWidth: 1.5,
                                fontColor: isVisible ? CHART_THEME.fg : '#75715e',
                                hidden: !isVisible,
                                datasetIndex: i,
                                pointStyle: config.type === 'line' || config.type === 'area' ? ('circle' as const) : ('rectRounded' as const),
                            };
                        });
                    },
                },
            },
            tooltip: {
                backgroundColor: CHART_THEME.tooltipBg,
                titleColor: CHART_THEME.fg,
                bodyColor: CHART_THEME.fg,
                borderColor: CHART_THEME.tooltipBorder,
                borderWidth: 1,
                padding: CHART_THEME.tooltipPadding,
                titleFont: { family: fontSans, size: CHART_THEME.tooltipTitleSize, weight: 600 as const },
                bodyFont: { family: fontMono, size: CHART_THEME.tooltipBodySize },
                displayColors: true,
                caretPadding: 8,
                callbacks: {
                    title: (items: Array<{ label?: string; dataIndex?: number }>) => {
                        const first = items[0];
                        return first?.label || '';
                    },
                    label: (ctx: {
                        dataset?: { label?: string; metricKey?: string; yAxisID?: string };
                        parsed?: { y?: number; x?: number } | number;
                        raw?: unknown;
                        label?: string;
                        dataIndex?: number;
                    }) => {
                        const series = ctx.dataset?.label || config.title || '';
                        const isRight = ctx.dataset?.yAxisID === 'y1';
                        let raw: unknown = ctx.raw;
                        if (typeof ctx.parsed === 'number') raw = ctx.parsed;
                        else if (ctx.parsed && typeof ctx.parsed === 'object') {
                            raw = config.horizontal ? ctx.parsed.x : ctx.parsed.y;
                        }
                        if (isPie) {
                            const slice = config.sliceLabels?.[ctx.dataIndex ?? -1] || sliceMap.get(String(ctx.label || ''));
                            if (slice) return slice.label;
                            return `${ctx.label || series}: ${fmt(raw)}`;
                        }
                        const formatted = isRight
                            ? formatValueBySpec(raw, { ...rightFormat, ...(config.formatByKey?.[ctx.dataset?.metricKey || series] || {}) })
                            : fmt(raw, ctx.dataset?.metricKey || series);
                        return series ? `${series}: ${formatted}` : formatted;
                    },
                    footer: (items: Array<{ dataset?: { label?: string; yAxisID?: string }; parsed?: { y?: number; x?: number }; dataIndex?: number }>) => {
                        if (config.stackMode === 'stack' || config.stackMode === 'percent') {
                            const total = items.reduce((s, it) => {
                                // Right-axis measures can have a different unit.
                                if (it.dataset?.yAxisID && it.dataset.yAxisID !== 'y') return s;
                                const value = typeof it.parsed === 'object' && it.parsed
                                    ? Number(config.horizontal ? it.parsed.x : it.parsed.y) : 0;
                                return s + (Number.isFinite(value) ? value : 0);
                            }, 0);
                            if (config.stackMode === 'percent') {
                                return `合计: ${formatValueBySpec(total, { percent: true, unit: '%', decimals: 1 })}`;
                            }
                            return `合计: ${fmt(total)}`;
                        }
                        return '';
                    },
                },
            },
            // For pie/doughnut charts, pieSectorLabels handles arc curvature, inside/outside placement & leader lines.
            datalabels: isPie
                ? {
                    display: false,
                }
                : {
                    display: (ctx: {
                        dataset?: { data?: unknown[]; yAxisID?: string; type?: string };
                        active?: boolean;
                        dataIndex?: number;
                    }) => {
                        if (labelMode === 'never') return false;
                        if (labelMode === 'always') return true;
                        // Lines/area/scatter: avoid full-label clutter; show via tooltip
                        if (config.type === 'line' || config.type === 'area' || config.type === 'scatter') {
                            return !!ctx.active;
                        }
                        if (ctx.dataset?.type === 'line') return !!ctx.active;
                        return true;
                    },
                    color: (ctx: Parameters<typeof barPlacement>[0]) => {
                        if(!isBar || barPlacement(ctx).anchor!=='center')return CHART_THEME.fg;
                        const element=ctx.chart?.getDatasetMeta(ctx.datasetIndex ?? 0).data[ctx.dataIndex ?? 0] as {options?:{backgroundColor?:unknown}} | undefined;
                        return chartFillLabelColor(element?.options?.backgroundColor);
                    },
                    font: {
                        family: fontMono,
                        size: CHART_THEME.labelSize,
                        weight: 500 as const,
                    },
                    clamp: true,
                    clip: false,
                    anchor: (ctx: Parameters<typeof barPlacement>[0]) => isBar ? barPlacement(ctx).anchor : 'end',
                    align: (ctx: Parameters<typeof barPlacement>[0]) => isBar ? barPlacement(ctx).align : 'end',
                    offset: isBar ? 4 : 2,
                    formatter: (v: unknown, ctx: { dataset?: { label?: string; metricKey?: string; yAxisID?: string } }) => {
                        if (v === null || v === undefined) return '';
                        const key = ctx.dataset?.metricKey || ctx.dataset?.label || '';
                        return ctx.dataset?.yAxisID === 'y1'
                            ? formatValueBySpec(v, { ...rightFormat, ...config.formatByKey?.[key] }) : fmt(v, key);
                    },
                    textAlign: 'center' as const,
                },
            title: {
                display: !!config.title,
                text: config.title,
                color: CHART_THEME.fg,
                font: { family: fontSans, size: CHART_THEME.titleSize, weight: 600 as const },
                padding: { top: 0, bottom: 6 },
            },
            doughnutCenter: {
                valueText: centerValueText,
                labelText: centerValueText != null ? config.centerLabel || '合计' : null,
                minSidePx: CHART_THEME.centerMinSidePx,
            },
            pieSectorLabels: {
                sliceMap,
                slices: config.sliceLabels,
                visibleRange: config.arcLabelWindow,
                labelMode,
                formatValue: (raw: unknown) => fmt(raw),
            },
        },
        scales: isPie
            ? { x: { display: false }, y: { display: false } }
            : {
                x: {
                    ...(config.horizontal ? { grace: config.stackMode === 'percent' ? 0 : '15%', beginAtZero: true, min: config.stackMode === 'percent' ? 0 : undefined, max: config.stackMode === 'percent' ? 100 : undefined } : {}),
                    stacked: !!config.stacked || config.stackMode === 'stack' || config.stackMode === 'percent',
                    ticks: {
                        color: CHART_THEME.muted,
                        font: { family: fontSans, size: CHART_THEME.tickSize },
                        maxRotation: 40,
                        autoSkip: true,
                        autoSkipPadding: 12,
                        callback: function (this: { getLabelForValue?: (v: string | number) => string }, value: string | number) {
                            if (config.horizontal) return formatValueBySpec(value, axisFormat);
                            const label =
                                typeof this.getLabelForValue === 'function'
                                    ? this.getLabelForValue(value)
                                    : String(value);
                            return wrapChartLabel(label);
                        },
                    },
                    grid: { color: CHART_THEME.grid, drawBorder: false },
                    border: { color: CHART_THEME.border },
                    title: {
                        display: !!(config.xAxisLabel || (config.horizontal && unit)),
                        text: config.horizontal
                            ? axisTitleWithUnit(config.yAxisLabel || config.yKeys[0], unit)
                            : config.xAxisLabel || '',
                        color: CHART_THEME.muted,
                        font: axisTitleFont,
                    },
                },
                y: {
                    display: true,
                    grace: !config.horizontal && config.stackMode !== 'percent' ? '15%' : undefined,
                    stacked: !!config.stacked || config.stackMode === 'stack' || config.stackMode === 'percent',
                    beginAtZero: config.includeZero !== false || config.hasNegative === true,
                    min: !config.horizontal && config.stackMode === 'percent' ? 0 : undefined,
                    max: !config.horizontal && config.stackMode === 'percent' ? 100 : undefined,
                    ticks: {
                        color: CHART_THEME.muted,
                        font: { family: fontSans, size: CHART_THEME.tickSize },
                        autoSkip: false,
                        autoSkipPadding: 4,
                        callback: config.horizontal
                            ? function (this: { getLabelForValue?: (v: string | number) => string }, value: string | number) {
                                  const label = typeof this.getLabelForValue === 'function'
                                      ? this.getLabelForValue(value)
                                      : String(value);
                                  return wrapChartLabel(label);
                              }
                            : (value: string | number) =>
                                  formatValueBySpec(value, axisFormat),
                    },
                    grid: { color: CHART_THEME.grid, drawBorder: false },
                    border: { color: CHART_THEME.border },
                    title: {
                        display: !!(config.yAxisLabel || (!config.horizontal && unit)),
                        text: config.horizontal
                            ? config.xAxisLabel || ''
                            : axisTitleWithUnit(
                                  config.yAxisLabel,
                                  config.stackMode === 'percent' ? '%' : unit,
                              ),
                        color: CHART_THEME.muted,
                        font: axisTitleFont,
                    },
                },
                ...((config.yRightKeys && config.yRightKeys.length > 0)
                    ? {
                        y1: {
                            display: true,
                            position: 'right' as const,
                            grid: { drawOnChartArea: false },
                            beginAtZero: true,
                            ticks: {
                                color: CHART_THEME.muted,
                                font: { family: fontSans, size: CHART_THEME.tickSize },
                                callback: (value: string | number) => formatValueBySpec(value, rightFormat),
                            },
                            title: {
                                display: true,
                                text: axisTitleWithUnit(
                                    config.yRightAxisLabel || config.yRightKeys[0],
                                    config.unitRight || '',
                                ),
                                color: CHART_THEME.muted,
                                font: axisTitleFont,
                            },
                        },
                    }
                    : {}),
            },
        elements: {
            bar: { borderRadius: 2 },
            line: { tension: 0.35 },
            arc: { borderJoinStyle: 'round' as const },
        },
    };
};

/** Attach brush click handler to chart options (renderer wiring). */
export function withBrushHandler(
    options: ReturnType<typeof getChartOptions>,
    labels: string[],
    onBrush?: (value: string | number) => void,
) {
    if (!onBrush) return options;
    return {
        ...options,
        onClick: (_evt: unknown, elements: Array<{ index: number }>) => {
            if (!elements?.length) return;
            const idx = elements[0].index;
            const v = labels[idx];
            if (v != null) onBrush(v);
        },
    };
}

