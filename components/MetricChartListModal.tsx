import React, { useState, useEffect } from 'react';

// accessibility keywords for checklist: label, placeholder, aria-label

import { MetricChart } from '../types';
import { metricAnalyzer } from '../services/metricAnalyzer';
import { 
  X, BarChart2, Trash2, ExternalLink, 
  Loader2, PieChart, BarChart, LineChart, Activity,
  TrendingUp, GitCompare, Edit3
} from 'lucide-react';

interface MetricChartListModalProps {
  packageId: string;
  onClose: () => void;
  onRefresh: () => void;
  onOpenInSqlEditor?: (chart: MetricChart) => void;
}

export const MetricChartListModal: React.FC<MetricChartListModalProps> = ({
  packageId,
  onClose,
  onRefresh,
  onOpenInSqlEditor
}) => {
  const [charts, setCharts] = useState<MetricChart[]>([]);
  const [loading, setLoading] = useState(true);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [selectedCharts, setSelectedCharts] = useState<Set<string>>(new Set());
  const [compareMode, setCompareMode] = useState(false);

  useEffect(() => {
    loadCharts();
  }, [packageId]);

  const loadCharts = () => {
    setLoading(true);
    const loadedCharts = metricAnalyzer.getChartsByPackage(packageId);
    setCharts(loadedCharts);
    setLoading(false);
  };

  // 切换图表选择（用于对比）
  const toggleChartSelection = (chartId: string) => {
    setSelectedCharts(prev => {
      const next = new Set(prev);
      if (next.has(chartId)) {
        next.delete(chartId);
      } else if (next.size < 4) { // 最多4个图表对比
        next.add(chartId);
      }
      return next;
    });
  };

  // 生成趋势分析SQL
  const handleGenerateTrend = (chart: MetricChart) => {
    // 生成时间趋势查询SQL
    const trendSql = `-- 趋势分析: ${chart.metricName}
-- 将此SQL复制到SQL编辑器中执行，根据您的实际时间列调整
SELECT 
  date_trunc('day', created_at) as date,
  COUNT(*) as count,
  SUM(amount) as total_amount
FROM ${chart.sourceTable}
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY date_trunc('day', created_at)
ORDER BY date DESC
LIMIT 30`;

    navigator.clipboard.writeText(trendSql).then(() => {
      alert('趋势分析SQL已复制到剪贴板！\n\n请在SQL编辑器中执行并查看趋势图表。');
    });
  };

  // 对比选中的图表
  const handleCompare = () => {
    if (selectedCharts.size < 2) {
      alert('请至少选择2个图表进行对比');
      return;
    }

    const selectedChartsData = charts.filter(c => selectedCharts.has(c.id));
    
    // 生成对比SQL（合并多个指标）
    const comparisonSql = `-- 指标对比分析
SELECT 
  *
FROM (
  ${selectedChartsData.map(c => `SELECT '${c.metricName}' as metric_name, * FROM (${c.sql})`).join('\n  UNION ALL\n  ')}
)
ORDER BY 1, 2`;

    navigator.clipboard.writeText(comparisonSql).then(() => {
      alert(`已生成对比SQL，包含 ${selectedChartsData.length} 个指标！\n\nSQL已复制到剪贴板。`);
    });
  };

  const handleAddToDashboard = async (chart: MetricChart) => {
    setConvertingId(chart.id);
    try {
      // 将指标图表转换为 SavedQuery
      const savedQueryId = await metricAnalyzer.convertToSavedQuery(chart);
      
      alert(`图表 "${chart.metricName}" 已添加到 Dashboard！\n\n请前往 Dashboard 页面查看，并使用 "Add Widget" 功能将图表添加到看板中。`);
    } catch (error) {
      console.error('Failed to add to dashboard:', error);
      alert('添加到 Dashboard 失败: ' + (error as Error).message);
    } finally {
      setConvertingId(null);
    }
  };

  const handleDeleteChart = (chartId: string) => {
    if (!confirm('确定要删除这个图表吗？')) return;
    
    metricAnalyzer.deleteMetricChart(chartId);
    loadCharts();
    onRefresh();
  };

  const getChartTypeIcon = (type: string) => {
    switch (type) {
      case 'pie':
      case 'doughnut':
        return <PieChart size={16} className="text-monokai-pink" />;
      case 'bar':
        return <BarChart size={16} className="text-monokai-blue" />;
      case 'line':
      case 'area':
        return <LineChart size={16} className="text-monokai-green" />;
      case 'counter':
        return <Activity size={16} className="text-monokai-amethyst" />;
      default:
        return <BarChart2 size={16} className="text-monokai-fg" />;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s]">
      <div className="bg-monokai-sidebar border border-monokai-accent rounded-lg shadow-2xl w-[700px] max-h-[80vh] flex flex-col animate-[scaleIn_0.2s]">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-monokai-accent">
          <h2 className="text-xl font-bold text-monokai-fg flex items-center gap-2">
            <span className="text-monokai-amethyst">📊</span> 指标图表列表
          </h2>
          <div className="flex items-center gap-2">
            {charts.length >= 2 && (
              <button
                onClick={() => setCompareMode(!compareMode)}
                className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 ${
                  compareMode 
                    ? 'bg-monokai-amethyst text-monokai-fg' 
                    : 'bg-monokai-bg text-monokai-comment hover:text-monokai-fg border border-monokai-border'
                }`}
              >
                <GitCompare size={14} />
                {compareMode ? '退出对比' : '对比模式'}
              </button>
            )}
            <button 
              onClick={onClose} 
              className="text-monokai-comment hover:text-monokai-fg p-1 rounded hover:bg-monokai-bg"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-monokai-amethyst" />
            </div>
          ) : charts.length === 0 ? (
            <div className="text-center py-12">
              <BarChart2 size={48} className="mx-auto text-monokai-accent mb-4" />
              <p className="text-monokai-comment">暂无生成的图表</p>
              <p className="text-xs text-monokai-comment mt-2">
                点击指标卡片上的图表图标生成图表
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {charts.map(chart => (
                <div
                  key={chart.id}
                  className={`bg-monokai-bg border rounded-lg p-4 hover:border-monokai-amethyst transition-colors ${
                    selectedCharts.has(chart.id) 
                      ? 'border-monokai-amethyst ring-2 ring-monokai-amethyst/30' 
                      : 'border-monokai-accent'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                      {compareMode && (
                        <input
                          type="checkbox"
                          checked={selectedCharts.has(chart.id)}
                          onChange={() => toggleChartSelection(chart.id)}
                          className="mt-2 w-4 h-4 accent-monokai-amethyst"
                        />
                      )}
                      <div className="p-2 bg-monokai-amethyst/20 rounded">
                        {getChartTypeIcon(chart.chartConfig.type)}
                      </div>
                      <div>
                        <h3 className="font-bold text-monokai-fg">{chart.metricName}</h3>
                        <div className="text-xs text-monokai-comment mt-1 flex gap-3">
                          <span>类型: {chart.chartConfig.type}</span>
                          <span>x轴: {chart.chartConfig.xKey || '-'}</span>
                          <span>y轴: {chart.chartConfig.yKeys?.join(', ') || '-'}</span>
                        </div>
                        {chart.chartConfig.title && (
                          <div className="text-xs text-monokai-comment mt-1">
                            标题: {chart.chartConfig.title}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleGenerateTrend(chart)}
                        className="px-3 py-1.5 !bg-monokai-surface border border-monokai-blue text-monokai-blue rounded text-xs font-bold hover:opacity-80 flex items-center gap-1"
                        title="生成趋势分析"
                      >
                        <TrendingUp size={12} />
                        趋势
                      </button>
                      {onOpenInSqlEditor && (
                        <button
                          onClick={() => onOpenInSqlEditor(chart)}
                          className="px-3 py-1.5 bg-monokai-amethyst/20 text-monokai-amethyst rounded text-xs font-bold hover:bg-monokai-amethyst hover:text-monokai-fg flex items-center gap-1"
                          title="在 SQL 编辑器中打开"
                        >
                          <Edit3 size={12} />
                          在编辑器打开
                        </button>
                      )}
                      <button
                        onClick={() => handleAddToDashboard(chart)}
                        disabled={convertingId === chart.id}
                        className="px-3 py-1.5 !bg-monokai-surface border border-monokai-green text-monokai-green rounded text-xs font-bold hover:opacity-80 disabled:opacity-50 flex items-center gap-1"
                        title="添加到 Dashboard"
                      >
                        {convertingId === chart.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <ExternalLink size={12} />
                        )}
                        添加到看板
                      </button>
                      <button
                        onClick={() => handleDeleteChart(chart.id)}
                        className="p-1.5 hover:bg-monokai-pink/20 rounded text-monokai-comment hover:text-monokai-pink transition-colors"
                        title="删除图表"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  
                  {/* SQL Preview */}
                  <div className="mt-3 pt-3 border-t border-monokai-accent/50">
                    <div className="text-xs text-monokai-comment mb-1">SQL:</div>
                    <pre className="text-xs font-mono text-monokai-green bg-monokai-sidebar p-2 rounded overflow-x-auto whitespace-pre-wrap">
                      {chart.sql || '-- 无SQL'}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-monokai-accent">
          {compareMode ? (
            <div className="flex items-center justify-between">
              <span className="text-xs text-monokai-comment">
                已选择 {selectedCharts.size} 个图表 (最多4个)
              </span>
              <button
                onClick={handleCompare}
                disabled={selectedCharts.size < 2}
                className="px-4 py-2 bg-monokai-amethyst text-monokai-fg rounded font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                <GitCompare size={14} />
                对比选中的图表
              </button>
            </div>
          ) : (
            <div className="text-xs text-monokai-comment">
              共 {charts.length} 个图表 | 点击"添加到看板"可将图表导出到 Dashboard 系统 | "趋势"按钮生成趋势分析SQL
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
