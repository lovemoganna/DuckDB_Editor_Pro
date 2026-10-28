import { useUiTheme } from '../../services/uiTheme';
/**
 * Unified Chart Renderer — Chart Spec → Adapter → display.
 * Home dashboard / Analysis Hub / builders share this component.
 * Do not invent formats, datasets, or Chart.js constructors here.
 */

import React, { useMemo, useState, useRef, useEffect } from 'react';
import type { Chart as ChartJS } from 'chart.js';
import { useContainerSize } from '../ui/useContainerWidth';
import { chartSpace } from '../../utils/chartSpace';
import { Bar, Line, Pie, Doughnut, Scatter } from 'react-chartjs-2';
import { formatTableValue, formatValueBySpec } from '../../utils/chartFormat';
import {
  adaptChartSpec,
  type AdaptedChartBundle,
} from '../../services/analysis/adapters/chartJsAdapter';
import type { ChartSpec } from '../../services/analysis/types';
import { filterSortTableRows, summarizeTableRows } from '../../services/analysis/chartDisplay';

export interface ChartRendererProps {
  chartSpec: ChartSpec;
  className?: string;
  heightClass?: string;
  /** Hide Chart.js plugin title (widget chrome already shows name) */
  hideTitle?: boolean;
  onBrush?: (field: string, value: string | number) => void;
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
      <div data-chart-kind="kpi" className={`flex h-full flex-col justify-center p-4 ${className || ''} ${heightClass || ''}`}>
        {!['value', 'records'].includes((card?.label || '').toLowerCase()) && <span className="text-xs font-semibold text-monokai-comment uppercase tracking-wider break-words">
          {card?.label || bundle.title}
        </span>}
        <div className="mt-1 flex items-baseline gap-2 min-w-0">
          <span className="font-mono text-2xl font-bold text-monokai-green tracking-tight break-words">
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
  const rows = useMemo(() => filterSortTableRows(bundle.rows, { filter, sortColumn, sortDirection }), [bundle.rows, filter, sortColumn, sortDirection]);
  const totals = useMemo(() => summarizeTableRows(rows, bundle.columns), [rows, bundle.columns]);
  return (
    <div className={`flex flex-col h-full min-h-0 ${className || ''} ${heightClass || ''}`}>
      <div className="flex items-center gap-2 px-2 py-1 text-xs text-monokai-comment">
        <input aria-label="筛选表格" value={filter} onChange={(event) => setFilter(event.target.value)}
          placeholder="筛选表格…" className="min-w-0 flex-1 rounded border border-monokai-border bg-monokai-surface px-2 py-1 text-monokai-fg" />
        <span>{rows.length} / {bundle.rows.length} 行</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full text-xs" style={{ minWidth: bundle.columns.length * 140 }}>
        <thead className="sticky top-0 bg-monokai-surface">
          <tr className="border-b border-monokai-border">
            {bundle.columns.map((c) => (
              <th key={c} aria-sort={sortColumn === c ? (sortDirection === 'ASC' ? 'ascending' : 'descending') : 'none'} className="px-2 py-1.5 text-left text-monokai-comment font-medium">
                <button type="button" onClick={() => {
                  setSortDirection(sortColumn === c && sortDirection === 'ASC' ? 'DESC' : 'ASC');
                  setSortColumn(c);
                }} aria-label={`按 ${c} 排序`} className="hover:text-monokai-fg">
                  {c}{sortColumn === c ? (sortDirection === 'ASC' ? ' ↑' : ' ↓') : ''}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={bundle.columns.length || 1} className="p-4 text-center text-monokai-comment">没有匹配的数据<button type="button" className="ml-2 text-monokai-cyan underline" onClick={() => setFilter('')}>清除筛选</button></td></tr>}
          {rows.map((row, i) => (
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
              className="hover:bg-monokai-surface/60 cursor-pointer border-b border-monokai-border/40"
              onClick={() => {
                const field = bundle.brushField;
                if (!field || !onBrush) return;
                const v = row[field];
                if (v != null) onBrush(field, v as string | number);
              }}
            >
              {bundle.columns.map((c) => {
                const raw = row[c];
                const fmt = bundle.formatByKey?.[c] || bundle.format;
                return (
                  <td key={c} className="px-2 py-1 font-mono text-monokai-fg whitespace-nowrap">
                    {formatTableValue(raw, c, fmt)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        {Object.keys(totals).length > 0 && <tfoot><tr className="sticky bottom-0 bg-monokai-surface font-bold">
          {bundle.columns.map((c, i) => <td key={c} className="px-2 py-1.5 font-mono text-monokai-fg">
            {c in totals ? formatValueBySpec(totals[c], bundle.formatByKey?.[c] || bundle.format) : i === 0 ? '当前筛选汇总' : ''}
          </td>)}
        </tr></tfoot>}
      </table>
      </div>
    </div>
  );
}

function CanvasView({ bundle, className, heightClass, spec }: {
  bundle: Extract<AdaptedChartBundle, { kind: 'canvas' }>;
  className?: string; heightClass?: string; spec: ChartSpec;
}) {
  const host = useRef<HTMLDivElement>(null);
  const plot = useRef<HTMLDivElement>(null);
  const { width, height } = useContainerSize(plot);
  const hostSize = useContainerSize(host);
  const chart = useRef<ChartJS | null>(null);
  const [hidden, setHidden] = useState<Set<number>>(() => new Set(bundle.data.datasets.flatMap((dataset, index) => (dataset as { hidden?: boolean }).hidden ? [index] : [])));
  const { chartJsType, data, options } = bundle;
  const arc = chartJsType === 'pie' || chartJsType === 'doughnut';
  const legendPosition = options.plugins.legend.position;
  const sideLegend = hostSize.width >= 720 && (legendPosition === 'left' || legendPosition === 'right');
  const geometry = chartSpace({ width: Math.max(0, width - 16), height: Math.max(0, height - 16), type: chartJsType,
    labels: data.labels.map(String), series: data.datasets.length, horizontal: options.indexAxis === 'y' });
  const canvasOptions = { ...options, plugins: { ...options.plugins, doughnutCenter: { valueText: null }, legend: { ...options.plugins.legend, display: false } } };
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
    setHidden(previous => { const next = new Set(previous); if (next.has(index)) next.delete(index); else next.add(index); return next; });
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
  const props = { ref: chart as never, data: data as never, options: canvasOptions as never };
  return <div ref={host} className={`flex ${sideLegend ? 'flex-row' : 'flex-col'} min-w-0 min-h-0 w-full ${heightClass || 'h-full'} ${className || ''}`}>
    {chartJsType === 'doughnut' && options.plugins.doughnutCenter?.valueText && <p className="px-2 py-1 text-xs break-words">{options.plugins.doughnutCenter.labelText || '合计'} · {options.plugins.doughnutCenter.valueText}</p>}
    <div ref={plot} className="min-h-0 flex-1 overflow-auto custom-scrollbar" aria-label="图表绘图区">
      <div className="relative" style={{ width: geometry.width, height: geometry.height }}>
        {chartJsType === 'bar' && <Bar {...props} />}
        {chartJsType === 'line' && <Line {...props} />}
        {chartJsType === 'pie' && <Pie {...props} />}
        {chartJsType === 'doughnut' && <Doughnut {...props} />}
        {chartJsType === 'scatter' && <Scatter {...props} />}
      </div>
    </div>
    {options.plugins.legend.display && <div aria-label="图例" style={{ order: legendPosition === 'top' || legendPosition === 'left' ? -1 : 1,
      ...(sideLegend ? { maxWidth: '40%', maxHeight: '100%' } : {}) }} className={`shrink-0 ${sideLegend ? 'flex-col' : 'max-h-24 flex-wrap'} overflow-auto flex gap-x-4 gap-y-2 px-2 py-2 text-xs`}>
      {entries.map(entry => <button key={entry.index} type="button" aria-pressed={!hidden.has(entry.index)}
        onClick={() => toggle(entry.index)} className="flex items-start gap-2 text-left max-w-full break-words">
        <span aria-hidden="true" className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: entry.color }} />
        <span className={hidden.has(entry.index) ? 'line-through opacity-60' : ''}>{entry.label}{arc ? ` · ${formatValueBySpec(entry.value, spec.format)}${spec.sliceLabels?.find(slice => slice.key === entry.label) ? ` · ${spec.sliceLabels.find(slice => slice.key === entry.label)!.percent.toPrecision(3)}%` : ''}` : ''}</span>
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
}) => {
  useUiTheme(state => state.theme);
  const bundle = adaptChartSpec(chartSpec, { onBrush, hideTitle });

  if (bundle.kind === 'empty') {
    return <EmptyView message={bundle.message} className={className} heightClass={heightClass} />;
  }
  if (bundle.kind === 'kpi') {
    return (
      <KpiView bundle={bundle} className={className} heightClass={heightClass} />
    );
  }
  if (bundle.kind === 'table') {
    return (
      <TableView bundle={bundle} className={className} heightClass={heightClass} onBrush={onBrush} />
    );
  }
  return <CanvasView spec={chartSpec} bundle={bundle} className={className} heightClass={heightClass} />;
};

export default ChartRenderer;
