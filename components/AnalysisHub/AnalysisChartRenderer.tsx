import React, { useMemo } from 'react';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { transformDataForChart, getChartOptions } from '../../utils/chartUtils';
import type { ChartConfig } from '../../types';
import { BarChart3, TrendingUp, PieChart, Layers } from 'lucide-react';
import { AH, AnalysisEmptyHint } from './analysisUi';

interface AnalysisChartRendererProps {
  data: unknown[];
  config: ChartConfig;
  height?: number | string;
  className?: string;
  onChartTypeChange?: (type: ChartConfig['type']) => void;
}

export const AnalysisChartRenderer: React.FC<AnalysisChartRendererProps> = ({
  data,
  config,
  height = AH.chartHeight,
  className = '',
  onChartTypeChange,
}) => {
  const chartData = useMemo(() => transformDataForChart(data as any[], config), [data, config]);
  const chartOptions = useMemo(() => getChartOptions(config), [config]);

  if (!data || data.length === 0) {
    return (
      <div style={{ height }} className={`flex items-center justify-center ${className}`}>
        <AnalysisEmptyHint
          className="w-full"
          message="暂无可视化数据 — 请配置维度与度量，或检查过滤条件"
        />
      </div>
    );
  }

  const typeBtn = (type: ChartConfig['type'], title: string, Icon: typeof BarChart3) => (
    <button
      type="button"
      title={title}
      onClick={() => onChartTypeChange?.(type)}
      className={config.type === type ? AH.segmentItemActive : AH.segmentItem}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );

  return (
    <div className={`${AH.card} flex flex-col p-2.5 ${className}`}>
      <div className={`mb-2 flex items-center justify-between pb-2 ${AH.divider}`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-1.5 w-1.5 rounded-sm bg-monokai-green shrink-0" aria-hidden="true" />
          <h4 className={`${AH.sectionTitle} truncate`}>{config.title || '分析图表'}</h4>
          <span className={AH.badge}>{data.length} 行</span>
        </div>

        {onChartTypeChange && (
          <div className={AH.segmentTrack}>
            {typeBtn('bar', '柱状图', BarChart3)}
            {typeBtn('line', '折线图', TrendingUp)}
            {typeBtn('area', '面积图', Layers)}
            {typeBtn('doughnut', '环形图', PieChart)}
          </div>
        )}
      </div>

      <div style={{ height }} className="relative w-full">
        {config.type === 'bar' && <Bar data={chartData} options={chartOptions as object} />}
        {(config.type === 'line' || config.type === 'area') && (
          <Line data={chartData} options={chartOptions as object} />
        )}
        {(config.type === 'doughnut' || config.type === 'pie') && (
          <Doughnut data={chartData} options={chartOptions as object} />
        )}
      </div>
    </div>
  );
};
