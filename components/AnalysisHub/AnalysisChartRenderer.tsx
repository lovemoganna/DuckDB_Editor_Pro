import React, { useMemo } from 'react';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { transformDataForChart, getChartOptions, MONOKAI_COLORS } from '../../utils/chartUtils';
import type { ChartConfig } from '../../types';
import { BarChart3, TrendingUp, PieChart, Layers, HelpCircle } from 'lucide-react';

interface AnalysisChartRendererProps {
  data: any[];
  config: ChartConfig;
  height?: number | string;
  className?: string;
  onChartTypeChange?: (type: ChartConfig['type']) => void;
}

export const AnalysisChartRenderer: React.FC<AnalysisChartRendererProps> = ({
  data,
  config,
  height = 320,
  className = '',
  onChartTypeChange,
}) => {
  const chartData = useMemo(() => {
    return transformDataForChart(data, config);
  }, [data, config]);

  const chartOptions = useMemo(() => {
    return getChartOptions(config);
  }, [config]);

  if (!data || data.length === 0) {
    return (
      <div
        style={{ height }}
        className={`flex flex-col items-center justify-center rounded-lg border border-dashed border-monokai-border bg-monokai-bg/50 p-6 text-center text-monokai-comment ${className}`}
      >
        <BarChart3 className="mb-2 h-8 w-8 text-monokai-comment/60" />
        <p className="text-xs font-medium text-monokai-fg/80">暂无可视化数据</p>
        <p className="text-[11px] text-monokai-comment mt-1">请配置维度与度量，或检查过滤条件返回的记录数</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col rounded-lg border border-monokai-border bg-monokai-surface p-3.5 shadow-sm ${className}`}>
      {/* Chart Top Control Bar */}
      <div className="mb-3 flex items-center justify-between border-b border-monokai-border/60 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-monokai-green" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-monokai-fg">
            {config.title || '分析可视化图表'}
          </h4>
          <span className="font-mono text-[10px] text-monokai-comment bg-monokai-bg px-1.5 py-0.5 rounded border border-monokai-border">
            {data.length} 条记录
          </span>
        </div>

        {onChartTypeChange && (
          <div className="flex items-center gap-1 rounded bg-monokai-bg p-0.5 border border-monokai-border">
            <button
              type="button"
              title="柱状图"
              onClick={() => onChartTypeChange('bar')}
              className={`p-1 rounded transition-colors ${
                config.type === 'bar'
                  ? 'bg-monokai-orange text-monokai-bg font-bold'
                  : 'text-monokai-comment hover:text-monokai-fg'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="折线图"
              onClick={() => onChartTypeChange('line')}
              className={`p-1 rounded transition-colors ${
                config.type === 'line'
                  ? 'bg-monokai-orange text-monokai-bg font-bold'
                  : 'text-monokai-comment hover:text-monokai-fg'
              }`}
            >
              <TrendingUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="面积图"
              onClick={() => onChartTypeChange('area')}
              className={`p-1 rounded transition-colors ${
                config.type === 'area'
                  ? 'bg-monokai-orange text-monokai-bg font-bold'
                  : 'text-monokai-comment hover:text-monokai-fg'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="环形图"
              onClick={() => onChartTypeChange('doughnut')}
              className={`p-1 rounded transition-colors ${
                config.type === 'doughnut'
                  ? 'bg-monokai-orange text-monokai-bg font-bold'
                  : 'text-monokai-comment hover:text-monokai-fg'
              }`}
            >
              <PieChart className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Chart Canvas Area */}
      <div style={{ height }} className="relative w-full">
        {config.type === 'bar' && <Bar data={chartData} options={chartOptions as any} />}
        {(config.type === 'line' || config.type === 'area') && (
          <Line data={chartData} options={chartOptions as any} />
        )}
        {(config.type === 'doughnut' || config.type === 'pie') && (
          <Doughnut data={chartData} options={chartOptions as any} />
        )}
      </div>
    </div>
  );
};
