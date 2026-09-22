import React, { useState, useEffect } from 'react';
import { MetricChart } from '../types';
import { metricAnalyzer } from '../services/metricAnalyzer';
import { duckDBService } from '../services/duckdbService';
import { toastService } from '../services/toastService';
import {
  X, BarChart2, Trash2, ExternalLink,
  Loader2, PieChart, BarChart, LineChart, Activity,
  TrendingUp, GitCompare, Edit3, Plus, Sparkles, Check
} from 'lucide-react';
import { ActionButton, IconButton } from './ui/Workbench';

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
  onOpenInSqlEditor,
}) => {
  const [charts, setCharts] = useState<MetricChart[]>([]);
  const [loading, setLoading] = useState(true);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [selectedCharts, setSelectedCharts] = useState<Set<string>>(new Set());
  const [compareMode, setCompareMode] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
      } else if (next.size < 4) {
        next.add(chartId);
      } else {
        toastService.warning('最多支持 4 个图表同时对比');
      }
      return next;
    });
  };

  // 生成趋势分析 SQL
  const handleGenerateTrend = async (chart: MetricChart) => {
    let timeCol = 'created_at';
    const config = chart.chartConfig;
    let valCol = config?.yKeys?.[0] || 'amount';

    try {
      const schema = await duckDBService.getTableSchema(chart.sourceTable).catch(() => []);
      const dateCol = schema.find((c: any) => /date|time|timestamp/i.test(c.type || c.name));
      if (dateCol) {
        timeCol = dateCol.name;
      }
      const numCol = schema.find((c: any) => /int|float|double|decimal|num/i.test(c.type));
      if (numCol && !config?.yKeys?.[0]) {
        valCol = numCol.name;
      }
    } catch {}

    const trendSql = `-- 趋势分析: ${chart.metricName}
-- 时间粒度按天聚合 (基于 ${chart.sourceTable}.${timeCol})
SELECT 
  date_trunc('day', "${timeCol}") AS time_bucket,
  COUNT(*) AS metric_count,
  COALESCE(SUM(TRY_CAST("${valCol}" AS DOUBLE)), COUNT(*)) AS total_value
FROM "${chart.sourceTable}"
GROUP BY 1
ORDER BY 1 DESC
LIMIT 30;`;

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(trendSql).catch(() => {});
    }

    if (onOpenInSqlEditor) {
      onOpenInSqlEditor({ ...chart, sql: trendSql });
    } else {
      window.dispatchEvent(
        new CustomEvent('duckdb_execute_sql', {
          detail: { sql: trendSql, autoRun: true, title: `趋势分析: ${chart.metricName}` },
        })
      );
    }
    toastService.success('趋势分析 SQL 已生成并载入 SQL 工作台', '已复制至剪贴板');
  };

  // 对比选中的图表
  const handleCompare = async () => {
    if (selectedCharts.size < 2) {
      toastService.warning('请至少勾选 2 个图表进行对比分析');
      return;
    }

    const selectedChartsData = charts.filter(c => selectedCharts.has(c.id));
    const comparisonSql = `-- 指标对比分析视图
SELECT 
  *
FROM (
  ${selectedChartsData.map(c => `SELECT '${c.metricName}' AS metric_name, * FROM (${c.sql.replace(/;+$/, '')})`).join('\n  UNION ALL\n  ')}
)
LIMIT 100;`;

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(comparisonSql).catch(() => {});
    }

    window.dispatchEvent(
      new CustomEvent('duckdb_execute_sql', {
        detail: { sql: comparisonSql, autoRun: true, title: `指标对比分析 (${selectedChartsData.length})` },
      })
    );
    toastService.success(`已生成 ${selectedChartsData.length} 个指标的对比 SQL 并载入工作台`, '已复制至剪贴板');
  };

  const handleAddToDashboard = async (chart: MetricChart) => {
    setConvertingId(chart.id);
    try {
      await metricAnalyzer.convertToSavedQuery(chart);
      toastService.success(`图表「${chart.metricName}」已发送至看板`, '可在 Dashboard 中添加该组件');
    } catch (error) {
      console.error('Failed to add to dashboard:', error);
      toastService.error('添加到 Dashboard 失败', (error as Error).message);
    } finally {
      setConvertingId(null);
    }
  };

  const handleDeleteChart = (chartId: string) => {
    metricAnalyzer.deleteMetricChart(chartId);
    setDeletingId(null);
    loadCharts();
    onRefresh();
    toastService.success('图表已删除');
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
        return <Activity size={16} className="text-monokai-cyan" />;
      default:
        return <BarChart2 size={16} className="text-monokai-yellow" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="指标图表资产列表"
    >
      <div
        className="w-full max-w-3xl bg-monokai-sidebar border border-monokai-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-monokai-border bg-monokai-sidebar/95">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-monokai-surface border border-monokai-border flex items-center justify-center text-monokai-fg-muted shrink-0">
              <BarChart2 size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-monokai-fg flex items-center gap-2">
                指标图表资产 (Visual Charts)
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-monokai-surface text-monokai-fg-muted border border-monokai-border">
                  {charts.length} 个已生成图表
                </span>
              </h2>
              <p className="text-xs text-monokai-comment mt-0.5">
                声明式可视化图表配置，支持多指标合并对比与一键同步至 Dashboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {charts.length >= 2 && (
              <ActionButton
                variant={compareMode ? 'primary' : 'secondary'}
                size="sm"
                icon={GitCompare}
                onClick={() => {
                  setCompareMode(!compareMode);
                  if (compareMode) setSelectedCharts(new Set());
                }}
              >
                {compareMode ? '退出对比' : '对比模式'}
              </ActionButton>
            )}
            <IconButton label="关闭" icon={X} onClick={onClose} size="sm" />
          </div>
        </div>

        {/* Compare Toolbar strip if in compare mode */}
        {compareMode && (
          <div className="px-6 py-2.5 bg-monokai-surface border-b border-monokai-border flex items-center justify-between">
            <span className="text-xs text-monokai-fg font-medium flex items-center gap-1.5">
              <GitCompare size={14} className="text-monokai-fg-muted" />
              已选择 {selectedCharts.size} / 4 个图表进行对比
            </span>
            <ActionButton
              variant="primary"
              size="sm"
              icon={GitCompare}
              onClick={handleCompare}
              disabled={selectedCharts.size < 2}
            >
              生成对比 SQL
            </ActionButton>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-monokai-bg">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-monokai-comment gap-2">
              <Loader2 size={20} className="animate-spin text-monokai-comment" />
              <span className="text-xs">加载图表数据中...</span>
            </div>
          ) : charts.length === 0 ? (
            <div className="text-center py-16">
              <BarChart2 size={40} className="mx-auto text-monokai-comment/40 mb-3" />
              <p className="text-sm font-semibold text-monokai-fg">暂无生成的图表</p>
              <p className="text-xs text-monokai-comment mt-1">
                在指标卡片上点击「📊 图表」图标，AI 将自动分析数据维度并生成匹配图表
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {charts.map(chart => {
                const isSelected = selectedCharts.has(chart.id);
                return (
                  <div
                    key={chart.id}
                    className={`bg-monokai-sidebar border rounded-lg p-4 transition-all duration-150 ${
                      isSelected
                        ? 'border-monokai-border-strong bg-monokai-surface/60 shadow-xs'
                        : 'border-monokai-border hover:border-monokai-border-strong'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        {compareMode && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleChartSelection(chart.id)}
                            className="mt-1 h-4 w-4 rounded border-monokai-border accent-monokai-yellow cursor-pointer"
                          />
                        )}

                        <div className="h-9 w-9 rounded-lg bg-monokai-surface border border-monokai-border flex items-center justify-center shrink-0">
                          {getChartTypeIcon(chart.chartConfig.type)}
                        </div>

                        <div className="min-w-0">
                          <h3 className="font-bold text-xs text-monokai-fg font-mono truncate">
                            {chart.metricName}
                          </h3>
                          <div className="flex items-center gap-3 text-[11px] text-monokai-comment mt-1 flex-wrap">
                            <span>类型: <strong className="text-monokai-fg font-mono uppercase">{chart.chartConfig.type}</strong></span>
                            <span>维度: <code className="text-monokai-yellow">{chart.chartConfig.xKey || '-'}</code></span>
                            <span>度量: <code className="text-monokai-green">{chart.chartConfig.yKeys?.join(', ') || '-'}</code></span>
                          </div>
                          {chart.chartConfig.title && (
                            <div className="text-[11px] text-monokai-comment mt-1">
                              图表标题: {chart.chartConfig.title}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <ActionButton
                          variant="secondary"
                          size="sm"
                          icon={TrendingUp}
                          onClick={() => handleGenerateTrend(chart)}
                          title="复制时间趋势分析 SQL"
                        >
                          趋势
                        </ActionButton>

                        {onOpenInSqlEditor && (
                          <ActionButton
                            variant="secondary"
                            size="sm"
                            icon={Edit3}
                            onClick={() => onOpenInSqlEditor(chart)}
                            title="在 SQL 编辑器中执行分析"
                          >
                            打开 SQL
                          </ActionButton>
                        )}

                        <ActionButton
                          variant="success"
                          size="sm"
                          icon={convertingId === chart.id ? Loader2 : ExternalLink}
                          loading={convertingId === chart.id}
                          onClick={() => handleAddToDashboard(chart)}
                          title="发布到 Dashboard 看板"
                        >
                          发送到看板
                        </ActionButton>

                        {deletingId === chart.id ? (
                          <div className="flex items-center gap-1 bg-monokai-surface border border-monokai-border rounded-lg px-2 py-1">
                            <span className="text-[10px] text-monokai-pink">确认删除?</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteChart(chart.id)}
                              className="text-xs text-monokai-pink font-bold hover:underline"
                            >
                              是
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingId(null)}
                              className="text-xs text-monokai-comment hover:text-monokai-fg ml-1"
                            >
                              否
                            </button>
                          </div>
                        ) : (
                          <IconButton
                            label="删除图表"
                            icon={Trash2}
                            size="sm"
                            tone="danger"
                            onClick={() => setDeletingId(chart.id)}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-monokai-border bg-monokai-sidebar/95 flex items-center justify-between text-xs text-monokai-comment">
          <span>共 {charts.length} 个图表资产</span>
          <ActionButton variant="secondary" size="sm" onClick={onClose}>
            关闭
          </ActionButton>
        </div>
      </div>
    </div>
  );
};
