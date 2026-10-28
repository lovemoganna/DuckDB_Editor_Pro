/**
 * Analysis Hub chart shell — delegates display to unified ChartRenderer.
 * Type toggles remain here; encoding / format / empty come from Chart Spec.
 */

import React, { useMemo } from 'react';
import { chartContent, widgetSpace } from '../../utils/dashboardLayout';
import type { ChartConfig } from '../../types';
import {
  listChartTypes,
  type ChartTypeId,
  type ChartSpec,
  chartSpecToChartConfig,
  mapResultToChartSpec,
  createEmptySpec,
  emptyFilters,
} from '../../services/analysis';
import { widgetRowsToChartSpec } from '../../services/analysis/adapters/dashboardWidgetAdapter';
import { ChartRenderer } from '../charts/ChartRenderer';
import { BarChart3, TrendingUp, PieChart, Layers, Table2, Gauge } from 'lucide-react';
import { AH, AnalysisEmptyHint } from './analysisUi';

const TYPE_ICONS: Partial<Record<string, typeof BarChart3>> = {
  bar: BarChart3,
  line: TrendingUp,
  area: Layers,
  doughnut: PieChart,
  pie: PieChart,
  scatter: Layers,
  table: Table2,
  kpi: Gauge,
  counter: Gauge,
  histogram: BarChart3,
  funnel: BarChart3,
  waterfall: BarChart3,
  combo: BarChart3,
};

const RENDERABLE = new Set([
  'bar',
  'line',
  'area',
  'doughnut',
  'pie',
  'scatter',
  'histogram',
  'funnel',
  'waterfall',
  'combo',
]);

interface AnalysisChartRendererProps {
  data?: unknown[];
  config?: ChartConfig;
  /** Prefer Chart Spec from engine — drives format / labels / empty / brush */
  chartSpec?: ChartSpec | null;
  height?: number | string;
  className?: string;
  onChartTypeChange?: (type: ChartConfig['type']) => void;
  /** Click mark → brush filter (engine re-run via parent) */
  onBrush?: (field: string, value: string | number) => void;
}

/** When only legacy ChartConfig is passed, rebuild a Spec via the registry. */

export const AnalysisChartRenderer: React.FC<AnalysisChartRendererProps> = ({
  data,
  config: configProp,
  chartSpec: chartSpecProp,
  height = AH.chartHeight,
  className = '',
  onChartTypeChange,
  onBrush,
}) => {
  const rows = ((chartSpecProp?.rows as unknown[]) || data || []) as Record<string, unknown>[];

  const chartSpec = useMemo(() => {
    if (chartSpecProp) return chartSpecProp;
    if (configProp) return widgetRowsToChartSpec(rows, configProp);
    return null;
  }, [chartSpecProp, configProp, rows]);

  const config = useMemo(() => {
    if (chartSpec) return chartSpecToChartConfig(chartSpec);
    return configProp!;
  }, [chartSpec, configProp]);

  const toggleTypes = useMemo(
    () => listChartTypes().filter((t) => RENDERABLE.has(t.id)),
    [],
  );

  if (!chartSpec) {
    return (
      <div style={{ height }} className={`flex items-center justify-center ${className}`}>
        <AnalysisEmptyHint className="w-full" message="暂无可视化配置" />
      </div>
    );
  }

  const emptyState = chartSpec.emptyState || (rows.length === 0 ? 'empty' : 'ok');
  if (emptyState === 'empty' || emptyState === 'all_null' || emptyState === 'error') {
    return (
      <div style={{ height }} className={`flex items-center justify-center ${className}`}>
        <AnalysisEmptyHint
          className="w-full"
          message={
            chartSpec.emptyMessage ||
            (emptyState === 'all_null'
              ? '指标值全部为空，无法绘图'
              : '暂无可视化数据 — 请配置维度与度量，或检查过滤条件')
          }
        />
      </div>
    );
  }

  // KPI / table: no type toggle chrome
  if (chartSpec.chartType === 'kpi' || chartSpec.chartType === 'counter') {
    return (
      <div className={`${AH.card} ${className}`} style={{ height: widgetSpace(chartContent(chartSpec.chartType, rows.length, chartSpec.yKeys.length), 480).height }}>
        <ChartRenderer
          chartSpec={chartSpec}
          kpiVariant="analysis"
          hideTitle={false}
          heightClass="h-full"
        />
      </div>
    );
  }

  if (chartSpec.chartType === 'table') {
    return (
      <div className={`${AH.card} ${className}`} style={{ height: widgetSpace(chartContent('table', rows.length), 480).height }}>
        <ChartRenderer chartSpec={chartSpec} onBrush={onBrush} heightClass="h-full" />
      </div>
    );
  }

  const typeBtn = (typeId: ChartTypeId, title: string) => {
    const Icon = TYPE_ICONS[typeId] || BarChart3;
    return (
      <button
        key={typeId}
        type="button"
        title={title}
        onClick={() => onChartTypeChange?.(typeId as ChartConfig['type'])}
        className={
          config.type === typeId || chartSpec.chartType === typeId
            ? AH.segmentItemActive
            : AH.segmentItem
        }
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    );
  };

  return (
    <div className={`${AH.card} flex flex-col p-2.5 ${className}`}>
      <div className={`mb-2 flex flex-wrap gap-2 items-center justify-between pb-2 ${AH.divider}`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-1.5 w-1.5 rounded-sm bg-monokai-green shrink-0" aria-hidden="true" />
          <h4 className={`${AH.sectionTitle} break-words`}>{config.title || '分析图表'}</h4>
          <span className={AH.badge}>{rows.length} 行</span>
          {config.unit ? <span className={AH.badge}>单位 {config.unit}</span> : null}
        </div>

        {onChartTypeChange && (
          <div className={AH.segmentTrack}>
            {toggleTypes.map((t) => typeBtn(t.id, t.label))}
          </div>
        )}
      </div>

      <div style={{ height: typeof height === 'number' ? Math.max(400, height) : height }} className="relative w-full min-w-0 min-h-[400px]">
        <ChartRenderer
          chartSpec={chartSpec}
          hideTitle
          heightClass="h-full"
          onBrush={onBrush}
        />
      </div>
    </div>
  );
};
