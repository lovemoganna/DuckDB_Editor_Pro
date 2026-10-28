import React, { useRef, useState, useId } from 'react';
import { useContainerSize } from '../ui/useContainerWidth';
import { chartSpace } from '../../utils/chartSpace';
import { formatValueBySpec } from '../../utils/chartFormat';
import type { ChartSpec } from '../../services/analysis/types';
/** For legacy Chart.js paths: preserve their options and interaction refs. */
export function ChartViewport({ type, labels, series, children, sliceValues, sliceLabels, sliceColors, legendPosition = 'bottom', showLegend = true, onToggleSlice }: {
  type: string; labels: unknown[]; series: number; children: React.ReactNode;
  sliceValues?: unknown[]; sliceColors?: string[]; legendPosition?: string; showLegend?: boolean; onToggleSlice?: (index: number) => void;
  sliceLabels?: ChartSpec['sliceLabels'];
}) {
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const id = useId();
  const arc = ['pie', 'doughnut'].includes(type);
  const host = useRef<HTMLDivElement>(null);
  const { width, height } = useContainerSize(host);
  const sideLegend = arc && showLegend && ['left', 'right'].includes(legendPosition) && width >= 720;
  const geometry = chartSpace({ width: Math.max(0, width - 16 - (sideLegend ? 240 : 0)), height: Math.max(0, height - 16), type: type === 'bar' ? 'bar' : type,
    labels: labels.map(String), series, horizontal: type === 'bar' });
  return <div id={`chart-viewport-${id}`} data-chart-viewport ref={host} aria-label="图表绘图区" className="h-full min-h-[320px] min-w-0 w-full overflow-auto">
    <div className={sideLegend ? 'flex items-start' : ''} style={{ width: geometry.width + (sideLegend ? 240 : 0) }}>
    <div className="relative" style={{ width: geometry.width, height: Math.max(geometry.height, 320, series * 24 + 240) }}>{children}</div>
    {arc && showLegend && sliceValues && <div aria-label="分类数值" style={{ ...(sideLegend ? { width: 240, maxHeight: Math.max(320, geometry.height) } : {}), order: legendPosition === 'left' ? -1 : 1 }} className={`${sideLegend ? 'shrink-0' : 'max-h-36'} overflow-auto custom-scrollbar p-2.5 text-2xs space-y-1.5`}>
      {labels.map((label, index) => <button type="button" key={index} aria-pressed={!hidden.has(index)}
        onClick={() => { if (!onToggleSlice) return; onToggleSlice(index); setHidden(previous => { const next = new Set(previous); if (next.has(index)) next.delete(index); else next.add(index); return next; }); }}
        className={`flex items-start gap-2 w-full text-left break-words rounded px-1.5 py-1 transition-colors hover:bg-monokai-surface/60 cursor-pointer ${hidden.has(index) ? 'line-through opacity-50' : 'text-monokai-fg'}`}>
        <span aria-hidden className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: sliceColors?.[index] }} />
        <span>{String(label)} · {formatValueBySpec(sliceValues[index], { compact: false })} · {formatValueBySpec(sliceLabels?.[index]?.percent, { percent: true, decimals: 6 })}</span>
      </button>)}
    </div>}
    </div>
  </div>;
}
