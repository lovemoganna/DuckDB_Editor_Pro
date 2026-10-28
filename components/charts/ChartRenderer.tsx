import { useUiTheme } from '../../services/uiTheme';
/**
 * Unified Chart Renderer — Chart Spec → Adapter → display.
 * Home dashboard / Analysis Hub / builders share this component.
 * Do not invent formats, datasets, or Chart.js constructors here.
 */

import React, { useMemo, useState, useRef, useEffect, useId } from 'react';
import { MoveHorizontal } from 'lucide-react';
import type { Chart as ChartJS } from 'chart.js';
import { useContainerSize } from '../ui/useContainerWidth';
import { tableSpace } from '../../utils/tableSpace';
import { chartSpace, chartPixelRatio } from '../../utils/chartSpace';
import { Bar, Line, Pie, Doughnut, Scatter } from 'react-chartjs-2';
import { formatTableValue, formatValueBySpec, formatPercentValue } from '../../utils/chartFormat';
import {
  adaptChartSpec,
  type AdaptedChartBundle,
} from '../../services/analysis/adapters/chartJsAdapter';
import type { ChartSpec } from '../../services/analysis/types';
import { filterSortTableRows, summarizeTableRows } from '../../services/analysis/chartDisplay';
import { chartWindow } from '../../services/analysis/chartWindow';
import { PivotTableView } from './PivotTableView';
import { selectScatterRecords } from '../../services/analysis/scatterSelection';

export interface ChartRendererProps {
  chartSpec: ChartSpec;
  /** Optional shared visibility for multiple presentations of one widget. */
  hiddenLegend?: ReadonlySet<number>;
  onLegendChange?: (hidden: ReadonlySet<number>) => void;
  className?: string;
  heightClass?: string;
  /** Hide Chart.js plugin title (widget chrome already shows name) */
  hideTitle?: boolean;
  onBrush?: (field: string, value: string | number) => void;
  onBrushSelection?: (field: string, values: Array<string | number>) => void;
  /** Compact KPI for dashboard widgets */
  kpiVariant?: 'dashboard' | 'analysis';
}

function EmptyView({ message, className, heightClass }: { message: string; className?: string; heightClass?: string }) {
  return (
    <div
      className={`flex items-center justify-center text-xs text-monokai-comment px-3 text-center ${heightClass || 'h-full'} ${className || ''}`}
    >
      {message}
    </div>
  );
}

function KpiView({
  bundle,
  className,
  heightClass,
}: {
  bundle: Extract<AdaptedChartBundle, { kind: 'kpi' }>;
  className?: string;
  heightClass?: string;
}) {
  const cards = bundle.cards;
  if (cards.length <= 1) {
    const card = cards[0];
    return (
      <div data-chart-kind="kpi" className={`flex overflow-auto h-full flex-col justify-center p-4 ${className || ''} ${heightClass || ''}`}>
        {<span className="text-xs font-semibold text-monokai-comment uppercase tracking-wider break-words">
          {['value', 'records'].includes((card?.label || '').toLowerCase()) ? bundle.title : card?.label || bundle.title}
        </span>}
        <div className="mt-1 flex items-baseline gap-2 min-w-0">
          <span className="font-mono text-3xl font-semibold tabular-nums text-monokai-green tracking-tight break-words">
            {card?.formatted ?? '—'}
          </span>
        </div>
        {bundle.compare.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-monokai-comment">
            {bundle.compare.map((c) => (
              <span key={c.key} title={c.baseline}>
                {c.baseline}: {c.formatted}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }


  return (
    <div
      data-chart-kind="kpi"
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))' }}
      className={`grid gap-2 p-3 h-full overflow-y-auto custom-scrollbar ${className || ''} ${heightClass || ''}`}
    >
      {cards.map((card, idx) => {
        const tones = [
          'text-monokai-green border-monokai-border bg-monokai-surface/60',
          'text-monokai-blue border-monokai-border bg-monokai-surface/60',
          'text-monokai-yellow border-monokai-border bg-monokai-surface/60',
          'text-monokai-orange border-monokai-border bg-monokai-surface/60',
        ];
        return (
          <div
            key={card.key}
            className={`flex flex-col justify-center rounded border p-2.5 shadow-sm ${tones[idx % tones.length]}`}
          >
            <span className="break-words text-xs font-semibold text-monokai-comment" title={card.label}>
              {card.label}
            </span>
            <span className="mt-0.5 break-all font-mono text-lg font-bold text-monokai-fg">
              {card.formatted}
            </span>
          </div>
        );
      })}
      {bundle.compare.length > 0 && (
        <div className="col-span-full flex flex-wrap gap-2 text-[11px] text-monokai-comment">
          {bundle.compare.map((c) => (
            <span key={c.key}>
              {c.baseline}: {c.formatted}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function TableView({
  bundle,
  className,
  heightClass,
  onBrush,
}: {
  bundle: Extract<AdaptedChartBundle, { kind: 'table' }>;
  className?: string;
  heightClass?: string;
  onBrush?: (field: string, value: string | number) => void;
}) {
  const [filter, setFilter] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>('ASC');
  const [page,setPage] = useState(0);
  const rows = useMemo(() => filterSortTableRows(bundle.rows, { filter, sortColumn, sortDirection, numericColumns: bundle.measureKeys }), [bundle.rows, bundle.measureKeys, filter, sortColumn, sortDirection]);
  const sizing = tableSpace(bundle.columns, rows);
  const totals = useMemo(() => summarizeTableRows(rows, bundle.columns, bundle.measureKeys), [rows, bundle.columns, bundle.measureKeys]);
  const currentPage = Math.min(page,Math.max(0,Math.ceil(rows.length/100)-1));
  return (
    <div className={`flex flex-col h-full min-h-0 ${className || ''} ${heightClass || ''}`}>
      <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-monokai-border bg-monokai-surface/40 text-2xs text-monokai-comment shrink-0">
        <input aria-label="筛选表格" value={filter} onChange={(event) => {setFilter(event.target.value);setPage(0);}}
          placeholder="筛选表格…" className="min-w-0 flex-1 rounded-md border border-monokai-border bg-monokai-bg px-2 py-1 text-2xs text-monokai-fg outline-none focus:border-monokai-border-strong transition-colors" />
        <span className="font-mono">{rows.length} / {bundle.rows.length} 行</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto custom-scrollbar">
      <table className="w-full text-2xs" style={{ minWidth: sizing.width, tableLayout: 'fixed' }}>
        <colgroup>{sizing.widths.map((width,i)=><col key={i} style={{width}} />)}</colgroup>
        <thead className="sticky top-0 z-10 bg-monokai-surface">
          <tr className="border-b border-monokai-border">
            {bundle.columns.map((c, index) => (
              <th key={c} aria-sort={sortColumn === c ? (sortDirection === 'ASC' ? 'ascending' : 'descending') : 'none'} className={`px-2.5 py-1.5 text-left text-monokai-fg-muted font-medium ${index === 0 ? 'sticky left-0 z-20 bg-monokai-surface' : ''}`}>
                <button type="button" onClick={() => {
                  setSortDirection(sortColumn === c && sortDirection === 'ASC' ? 'DESC' : 'ASC');
                  setSortColumn(c);
                  setPage(0);
                }} aria-label={`按 ${c} 排序`} className="hover:text-monokai-fg cursor-pointer transition-colors">
                  {c}{sortColumn === c ? (sortDirection === 'ASC' ? ' ↑' : ' ↓') : ''}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={bundle.columns.length || 1} className="p-4 text-center text-monokai-comment">没有匹配的数据<button type="button" className="ml-2 text-monokai-cyan underline cursor-pointer" onClick={() => setFilter('')}>清除筛选</button></td></tr>}
          {rows.slice(currentPage*100,currentPage*100+100).map((row, i) => (
            <tr
              key={i}
              tabIndex={bundle.brushField && onBrush ? 0 : undefined}
              onKeyDown={event => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                const field = bundle.brushField;
                if (!field || !onBrush || row[field] == null) return;
                event.preventDefault();
                onBrush(field, row[field] as string | number);
              }}
              className="hover:bg-monokai-surface/60 cursor-pointer border-b border-monokai-border/40 transition-colors"
              onClick={() => {
                const field = bundle.brushField;
                if (!field || !onBrush) return;
                const v = row[field];
                if (v != null) onBrush(field, v as string | number);
              }}
            >
              {bundle.columns.map((c, index) => {
                const raw = row[c];
                const fmt = bundle.formatByKey?.[c] || bundle.format;
                return (
                  <td key={c} className={`px-2.5 py-1.5 font-mono text-2xs text-monokai-fg whitespace-normal break-words ${index === 0 ? 'sticky left-0 bg-monokai-bg' : ''}`}>
                    {onBrush && (typeof raw==='string'||typeof raw==='number') ? <button type="button" className="text-left hover:text-monokai-cyan cursor-pointer transition-colors" title="点击单元格联动筛选" onClick={event=>{event.stopPropagation();onBrush(c,raw);}}>{formatTableValue(raw,c,fmt)}</button> : formatTableValue(raw, c, fmt)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        {Object.keys(totals).length > 0 && <tfoot><tr className="sticky bottom-0 bg-monokai-surface font-semibold border-t border-monokai-border">
          {bundle.columns.map((c, i) => <td key={c} className="px-2.5 py-1.5 font-mono text-monokai-fg text-2xs">
            {c in totals ? formatValueBySpec(totals[c], bundle.formatByKey?.[c] || bundle.format) : i === 0 ? '当前筛选汇总' : ''}
          </td>)}
        </tr></tfoot>}
      </table>
      </div>
      {rows.length>100&&<div className="flex items-center justify-center gap-2 px-2.5 py-1.5 border-t border-monokai-border bg-monokai-surface/20 text-2xs text-monokai-comment">
        <button disabled={currentPage===0} onClick={()=>setPage(currentPage-1)} className="rounded px-2 py-0.5 border border-monokai-border bg-monokai-surface hover:text-monokai-fg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors">上一页</button>
        <span className="font-mono">{currentPage*100+1}–{Math.min((currentPage+1)*100,rows.length)} / {rows.length}</span>
        <button disabled={(currentPage+1)*100>=rows.length} onClick={()=>setPage(currentPage+1)} className="rounded px-2 py-0.5 border border-monokai-border bg-monokai-surface hover:text-monokai-fg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors">下一页</button>
      </div>}
    </div>
  );
}

function CanvasView({ bundle, className, heightClass, spec, hiddenLegend, onLegendChange, onBrushSelection }: {
  bundle: Extract<AdaptedChartBundle, { kind: 'canvas' }>;
  className?: string; heightClass?: string; spec: ChartSpec;
  hiddenLegend?: ReadonlySet<number>; onLegendChange?: (hidden: ReadonlySet<number>) => void;
  onBrushSelection?: (field: string, values: Array<string | number>) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const scrollHintId = useId();
  const plot = useRef<HTMLDivElement>(null);
  const { width, height } = useContainerSize(plot);
  const hostSize = useContainerSize(host);
  const chart = useRef<ChartJS | null>(null);
  const [boxSelection, setBoxSelection] = useState(false);
  const [drag, setDrag] = useState<{ x: number; y: number; endX: number; endY: number } | null>(null);
  const pointerPosition = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = chart.current?.canvas.getBoundingClientRect();
    return rect ? { x: event.clientX - rect.left, y: event.clientY - rect.top } : null;
  };
  const [localHidden, setHidden] = useState<Set<number>>(() => new Set(bundle.data.datasets.flatMap((dataset, index) => (dataset as { hidden?: boolean }).hidden ? [index] : [])));
  const signature = JSON.stringify([spec.id, spec.chartType, spec.xKey, spec.yKeys, spec.yRightKeys, spec.seriesKey, bundle.chartJsType === 'pie' || bundle.chartJsType === 'doughnut' ? bundle.data.labels : bundle.data.datasets.map(dataset => (dataset as { label?: string }).label)]);
  const previousSignature = useRef(signature);
  const changed = previousSignature.current !== signature;
  const hidden = changed ? new Set<number>() : hiddenLegend ?? localHidden;
  useEffect(() => {
    if (previousSignature.current === signature) return;
    previousSignature.current = signature;
    setHidden(new Set());
    onLegendChange?.(new Set());
  }, [signature, onLegendChange]);
  const { chartJsType, data, options } = bundle;
  const arc = chartJsType === 'pie' || chartJsType === 'doughnut';
  const legendPosition = options.plugins.legend.position;
  const sideLegend = hostSize.width >= 720 && (legendPosition === 'left' || legendPosition === 'right');
  const geometry = chartSpace({ width: Math.max(0, width - 16), height: Math.max(0, height - 16), type: spec.chartType === 'funnel' ? 'funnel' : chartJsType,
    labels: (spec.arcLabelWindow ? data.labels.slice(spec.arcLabelWindow.from,spec.arcLabelWindow.to) : data.labels).map(String), series: chartJsType==='bar'?data.datasets.filter(dataset=>(dataset as {type?:string}).type!=='line').length:data.datasets.length, horizontal: options.indexAxis === 'y' });
  const canvasOptions = { ...options, devicePixelRatio:chartPixelRatio(geometry.width,geometry.height,typeof window==='undefined'?1:window.devicePixelRatio), plugins: { ...options.plugins, legend: { ...options.plugins.legend, display: false } } };
  useEffect(() => {
    // Data updates alone can leave Chart.js at the previous height while its
    // parent has already resized. Use the same measured geometry as the host.
    chart.current?.resize(geometry.width, geometry.height);
    chart.current?.update('none');
  }, [geometry.width, geometry.height]);
  const datasets = data.datasets as Array<{ label?: string; backgroundColor?: string | string[]; borderColor?: string; data: unknown[] }>;
  const entries = arc ? data.labels.map((label, index) => ({ label: String(label), index,
    color: Array.isArray(datasets[0]?.backgroundColor) ? datasets[0].backgroundColor[index] : datasets[0]?.backgroundColor,
    value: datasets[0]?.data[index] })) : datasets.map((dataset, index) => ({ label: dataset.label || `系列 ${index + 1}`, index,
      color: typeof dataset.borderColor === 'string' ? dataset.borderColor : typeof dataset.backgroundColor === 'string' ? dataset.backgroundColor : undefined, value: undefined }));
  const toggle = (index: number) => {
    const instance = chart.current;
    if (!instance) return;
    if (arc) instance.toggleDataVisibility(index);
    else instance.setDatasetVisibility(index, !instance.isDatasetVisible(index));
    instance.update();
    const next = new Set(hidden);
    if (next.has(index)) next.delete(index); else next.add(index);
    setHidden(next);
    onLegendChange?.(next);
  };
  useEffect(() => {
    const instance = chart.current;
    if (!instance) return;
    entries.forEach(entry => {
      const visible = !hidden.has(entry.index);
      if (arc) { if (instance.getDataVisibility(entry.index) !== visible) instance.toggleDataVisibility(entry.index); }
      else instance.setDatasetVisibility(entry.index, visible);
    });
    instance.update('none');
  }, [hidden, data, width, height, arc]);
  const scrollsHorizontally = width > 0 && geometry.width > width + 1;
  const props = { ref: chart as never, data: data as never, options: canvasOptions as never, role: 'img', 'aria-label': `${spec.title}，${spec.chartType === 'scatter' ? '散点图' : `${data.labels.length} 个分类`}，${data.datasets.length} 个系列` };
  return <div ref={host} className={`flex ${sideLegend ? 'flex-row' : 'flex-col'} min-w-0 min-h-0 w-full ${heightClass || 'h-full'} ${className || ''}`}>
    {spec.chartType === 'scatter' && onBrushSelection && <button type="button" aria-pressed={boxSelection} className="shrink-0 px-2 py-1 text-xs text-monokai-cyan" onClick={() => { setBoxSelection(!boxSelection); setDrag(null); }}>框选联动{boxSelection ? '：拖动选择' : ''}</button>}
    {spec.colorScale&&<div className="shrink-0 px-2 text-xs text-monokai-comment">颜色：{spec.colorScale.field} · {formatValueBySpec(spec.colorScale.min,spec.formatByKey?.[spec.colorScale.field])}–{formatValueBySpec(spec.colorScale.max,spec.formatByKey?.[spec.colorScale.field])}</div>}

    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
    <div ref={plot} role="region" tabIndex={0} aria-describedby={scrollsHorizontally ? scrollHintId : undefined} className="min-h-0 flex-1 overflow-auto custom-scrollbar flex focus-visible:outline focus-visible:outline-2 focus-visible:outline-monokai-accent focus-visible:-outline-offset-2" aria-label="图表绘图区">
      {/* Auto margins center a fitting plot, but collapse to zero for overflow so both axes remain reachable. */}
      <div className="relative shrink-0 m-auto" style={{ width: geometry.width, height: geometry.height, touchAction: boxSelection ? 'none' : 'auto' }}
        onClickCapture={event => { if (boxSelection) event.stopPropagation(); }}
        onPointerDown={event => {
          if (!boxSelection) return;
          const point = pointerPosition(event); if (!point) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          setDrag({ ...point, endX: point.x, endY: point.y });
        }}
        onPointerMove={event => { if (!drag) return; const point = pointerPosition(event); if (point) setDrag({ ...drag, endX: point.x, endY: point.y }); }}
        onPointerCancel={() => setDrag(null)}
        onPointerUp={event => {
          if (!drag || !chart.current) return;
          const point = pointerPosition(event); if (!point) return;
          const instance = chart.current;
          const ranges = (spec.scatterSeries || []).flatMap((series, seriesIndex) => {
            if (series.trend || !instance.isDatasetVisible(seriesIndex)) return [];
            const dataset = instance.data.datasets[seriesIndex] as { xAxisID?: string; yAxisID?: string };
            const x = instance.scales[dataset.xAxisID || 'x'], y = instance.scales[dataset.yAxisID || 'y'];
            if (!x || !y) return [];
            const xs = [Number(x.getValueForPixel(drag.x)), Number(x.getValueForPixel(point.x))];
            const ys = [Number(y.getValueForPixel(drag.y)), Number(y.getValueForPixel(point.y))];
            return [{ seriesIndex, xMin: Math.min(...xs), xMax: Math.max(...xs), yMin: Math.min(...ys), yMax: Math.max(...ys) }];
          });
          const field = spec.brushField || spec.xKey;
          const values = selectScatterRecords(spec, ranges, field);
          if (values.length) onBrushSelection?.(field, values);
          setDrag(null);
        }}>
        {chartJsType === 'bar' && <Bar key={signature} {...props} />}
        {chartJsType === 'line' && <Line key={signature} {...props} />}
        {chartJsType === 'pie' && <Pie key={signature} {...props} />}
        {chartJsType === 'doughnut' && <Doughnut key={signature} {...props} />}
        {chartJsType === 'scatter' && <Scatter key={signature} {...props} />}
        {drag && <div aria-hidden className="pointer-events-none absolute border border-monokai-cyan bg-monokai-cyan/10" style={{ left: Math.min(drag.x, drag.endX), top: Math.min(drag.y, drag.endY), width: Math.abs(drag.x - drag.endX), height: Math.abs(drag.y - drag.endY) }}/>}
      </div>
    </div>
    {scrollsHorizontally && <p id={scrollHintId} className="flex shrink-0 items-center justify-center gap-1.5 border-t border-monokai-border/50 px-2 py-1 text-xs text-monokai-comment"><MoveHorizontal size={13} aria-hidden="true" />横向滚动查看完整图表</p>}
    </div>
    {options.plugins.legend.display && <div aria-label="图例" style={{ order: legendPosition === 'top' || legendPosition === 'left' ? -1 : 1,
      ...(sideLegend ? { maxWidth: '40%', maxHeight: '100%' } : {}) }} className={`shrink-0 ${sideLegend ? `flex-col ${options.plugins.legend.align === 'center' ? 'justify-center' : options.plugins.legend.align === 'end' ? 'justify-end' : 'justify-start'}` : `max-h-24 flex-wrap ${options.plugins.legend.align === 'center' ? 'justify-center' : options.plugins.legend.align === 'end' ? 'justify-end' : 'justify-start'}`} overflow-auto custom-scrollbar flex gap-x-4 gap-y-2 px-2.5 py-2 text-2xs text-monokai-fg`}>
      {entries.filter(entry => !arc || !spec.arcLabelWindow || entry.index>=spec.arcLabelWindow.from&&entry.index<spec.arcLabelWindow.to).map(entry => <button key={entry.index} type="button" aria-pressed={!hidden.has(entry.index)}
        onClick={() => toggle(entry.index)} className="flex items-center gap-2 text-left max-w-full break-words rounded px-1.5 py-0.5 hover:bg-monokai-surface/60 transition-colors cursor-pointer">
        <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: entry.color }} />
        <span className={hidden.has(entry.index) ? 'line-through opacity-50' : 'text-monokai-fg'}>{entry.label}{arc ? ` · ${formatValueBySpec(entry.value, spec.format)} · ${formatPercentValue(spec.sliceLabels?.[entry.index]?.percent)}` : ''}</span>
      </button>)}
    </div>}
  </div>;
}

/**
 * Single entry for all chart kinds. Pass engine ChartSpec only.
 */
export const ChartRenderer: React.FC<ChartRendererProps> = ({
  chartSpec,
  className,
  heightClass = 'h-full',
  hideTitle = true,
  onBrush,
  onBrushSelection,
  hiddenLegend,
  onLegendChange,
}) => {
  useUiTheme(state => state.theme);
  const [page, setPage] = useState(0);
  const identity = JSON.stringify([chartSpec.id, chartSpec.chartType, chartSpec.xKey, chartSpec.yKeys, chartSpec.cartesian, chartSpec.histogramBins, chartSpec.waterfall,chartSpec.pivotTable,
    chartSpec.chartType === 'table' ? chartSpec.rows : undefined], (_key, value) => typeof value === 'bigint' ? { bigint: String(value) } : value);
  const previousIdentity = useRef(identity);
  const display = chartWindow(chartSpec, previousIdentity.current === identity ? page : 0);
  useEffect(() => { previousIdentity.current = identity; setPage(0); }, [identity]);
  const bundle = adaptChartSpec(display.spec, { onBrush, hideTitle });

  if (bundle.kind === 'empty') {
    return <EmptyView message={bundle.message} className={className} heightClass={heightClass} />;
  }
  if (bundle.kind === 'kpi') {
    return (
      <KpiView bundle={bundle} className={className} heightClass={heightClass} />
    );
  }
  if (bundle.kind === 'table') {
    if (chartSpec.pivotTable) return <PivotTableView key={identity} spec={chartSpec} onBrush={onBrush}/>;
    return (
      <TableView key={identity} bundle={bundle} className={className} heightClass={heightClass} onBrush={onBrush} />
    );
  }
  return <div className={`flex flex-col min-h-0 ${heightClass} ${className || ''}`}>
    {display.pages > 1 && <div className="flex flex-wrap items-center justify-center gap-2 px-2 py-1 text-xs text-monokai-comment" aria-label="图表显示范围">
      <button type="button" disabled={display.current === 0} onClick={() => setPage(display.current - 1)}>上一段</button>
      <span>显示 {display.start + 1}–{display.end} / {display.count} 项</span>
      <button type="button" disabled={display.current === display.pages - 1} onClick={() => setPage(display.current + 1)}>下一段</button>
      <span>统计基于全部筛选数据</span>
    </div>}
    <CanvasView hiddenLegend={hiddenLegend} onLegendChange={onLegendChange} onBrushSelection={onBrushSelection} spec={display.spec} bundle={bundle} className="flex-1" heightClass="h-full" />
  </div>;
};

export default ChartRenderer;
