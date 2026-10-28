import './metricUi.css';
import React, { useState, useEffect } from 'react';
import { MetricChart } from '../types';
import { metricAnalyzer } from '../services/metricAnalyzer';
import { duckDBService } from '../services/duckdbService';
import { toastService } from '../services/toastService';
import { executeAnalysisQuery, requireAnalysisQuery } from '../services/analysis/readQuery';
import { quoteIdent, quoteTable, escapeLiteral } from '../services/analysis/sqlUtils';
import { deleteVisualizationAsset } from '../services/visualizationAssets';
import { compileMetricSql } from '../services/metricSql';
import { activeAnalysisDatabase } from '../services/metricAssetStorage';
import {
  X, BarChart2, Trash2, ExternalLink,
  Loader2, PieChart, BarChart, LineChart, Activity,
  TrendingUp, GitCompare, Edit3, Plus, Sparkles, Check
} from 'lucide-react';
import { ActionButton, IconButton, ModalShell } from './ui/Workbench';

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
  const [operation, setOperation] = useState<string | null>(null);

  useEffect(() => {
    loadCharts();
  }, [packageId]);

  const loadCharts = () => {
    setLoading(true);
    const loadedCharts = metricAnalyzer.getChartsByPackage(packageId);
    setCharts(loadedCharts);
    setSelectedCharts(prev => new Set([...prev].filter(id => loadedCharts.some(chart => chart.id === id))));
    if (loadedCharts.length < 2) setCompareMode(false);
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
    if (operation || convertingId) return;
    const database = activeAnalysisDatabase();
    setOperation(chart.id);
    try {
      const metric = metricAnalyzer.loadMetricPackages().find(pkg => pkg.id === chart.metricPackageId)
        ?.metrics.find(metric => metric.id === chart.metricId);
      if (!metric || (!metric.calculation && /^(?:select|with|values)\b/i.test(metric.formula.trim()))) {
        throw new Error('此图表无法自动拆分日期口径，请在 SQL 工作台编辑其原始查询');
      }
      const schema = await duckDBService.getTableSchema(chart.sourceTable || '');
      const dateCol = schema.find(column => column.name === metric.calculation?.timeField) || schema.find((column: any) => /date|timestamp/i.test(column.type));
      if (!dateCol) throw new Error('数据源没有日期字段，无法生成时间趋势');
      const trendSql = metric.calculation ? compileMetricSql({ ...metric, sourceTable: chart.sourceTable,
        calculation: { ...metric.calculation, timeField: dateCol.name, grain: metric.calculation.grain || 'day' } }) : requireAnalysisQuery(`SELECT date_trunc('day', ${quoteIdent(dateCol.name)}) AS time_bucket,
  ${metric.formula} AS ${quoteIdent(metric.name)}
FROM ${quoteTable(chart.sourceTable || '')}
GROUP BY 1 ORDER BY 1 DESC LIMIT 30`);
      await executeAnalysisQuery(trendSql);
      if (database !== activeAnalysisDatabase()) throw new Error('数据库已切换，请重新打开图表');
      openSql({ ...chart, sql: trendSql, chartConfig: { ...chart.chartConfig,
        type: 'line', xKey: metric.calculation ? 'period' : 'time_bucket', yKeys: [metric.calculation ? 'value' : metric.name],
        aggregation: 'none', groupBy: metric.calculation?.groupBy?.[0],
      } }, `趋势分析: ${chart.metricName}`);
      toastService.success('已载入按真实日期字段和指标口径生成的趋势查询');
    } catch (error) { toastService.error('无法生成趋势查询', (error as Error).message); }
    finally { setOperation(null); }
  };

  const openSql = (chart: MetricChart, title: string) => {
    if (onOpenInSqlEditor) onOpenInSqlEditor(chart);
    else window.dispatchEvent(new CustomEvent('duckdb_execute_sql', {
      detail: { sql: chart.sql, autoRun: true, title },
    }));
  };

  // Compare scalar values using the same two-column schema.
  const handleCompare = async () => {
    if (operation || convertingId) return;
    if (selectedCharts.size < 2) {
      toastService.warning('请至少勾选 2 个图表进行对比分析');
      return;
    }
    const database = activeAnalysisDatabase();
    setOperation('compare');
    try {
      const selected = charts.filter(chart => selectedCharts.has(chart.id));
      const parts: string[] = [];
      for (const chart of selected) {
        if (database !== activeAnalysisDatabase()) throw new Error('数据库已切换，对比已停止');
        const sql = requireAnalysisQuery(chart.sql);
        const rows = await executeAnalysisQuery(sql);
        const valueKey = chart.chartConfig.yKeys[0];
        if (rows.length !== 1 || !valueKey || rows[0][valueKey] == null || !Number.isFinite(Number(rows[0][valueKey]))) {
          throw new Error('对比支持单值数值指标；分类或趋势图请在 SQL 工作台合并分析');
        }
        parts.push(`SELECT '${escapeLiteral(chart.metricName)}' AS metric_name, TRY_CAST(${quoteIdent(valueKey)} AS DOUBLE) AS metric_value FROM (${sql})`);
      }
      const sql = parts.join('\nUNION ALL\n');
      await executeAnalysisQuery(sql);
      if (database !== activeAnalysisDatabase()) throw new Error('数据库已切换，对比已停止');
      openSql({ ...selected[0], sql, chartConfig: { ...selected[0].chartConfig,
        type: 'bar', xKey: 'metric_name', yKeys: ['metric_value'], aggregation: 'none', groupBy: undefined,
      } }, `指标对比分析 (${selected.length})`);
      toastService.success(`已载入 ${selected.length} 个真实指标的对比查询`);
    } catch (error) { toastService.error('无法对比这些指标', (error as Error).message); }
    finally { setOperation(null); }
  };

  const handleAddToDashboard = async (chart: MetricChart) => {
    if (operation || convertingId) return;
    setConvertingId(chart.id);
    try {
      await metricAnalyzer.convertToSavedQuery(chart);
      toastService.success(`图表「${chart.metricName}」已固定到首页仪表盘`);
    } catch (error) {
      console.error('Failed to add to dashboard:', error);
      toastService.error('添加到 Dashboard 失败', (error as Error).message);
    } finally {
      setConvertingId(null);
    }
  };

  const handleDeleteChart = async (chartId: string) => {
    if (operation || convertingId) return;
    const chart = charts.find(chart => chart.id === chartId);
    if (!chart) return;
    setOperation(chartId);
    try {
      await deleteVisualizationAsset(chart);
      setDeletingId(null);
      loadCharts();
      onRefresh();
      toastService.success('图表已删除，首页关联已更新');
    } catch (error) { toastService.error('删除图表失败', (error as Error).message); }
    finally { setOperation(null); }
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
    <ModalShell
      className="metric-surface"
      open={true}
      onClose={onClose}
      title="指标图表资产"
      description="声明式可视化图表配置，支持多指标合并对比与一键同步至 Dashboard"
      icon={BarChart2}
      badge={`${charts.length} 个已生成图表`}
      size="lg"
      headerActions={
        charts.length >= 2 ? (
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
        ) : null
      }
      footer={
        <>
          <span className="mr-auto text-xs text-monokai-comment">共 {charts.length} 个图表资产</span>
          <ActionButton variant="secondary" size="sm" onClick={onClose}>
            关闭
          </ActionButton>
        </>
      }
    >
      <div className="-m-5 flex min-h-0 flex-col">
        {/* Compare Toolbar strip if in compare mode */}
        {compareMode && (
          <div className="px-5 py-2.5 bg-monokai-surface border-b border-monokai-border flex items-center justify-between">
            <span className="text-xs text-monokai-fg font-medium flex items-center gap-1.5">
              <GitCompare size={14} className="text-monokai-fg-muted" />
              已选择 {selectedCharts.size} / 4 个图表进行对比
            </span>
            <ActionButton
              variant="primary"
              size="sm"
              icon={GitCompare}
              onClick={handleCompare}
              disabled={selectedCharts.size < 2 || Boolean(operation || convertingId)}
              loading={operation === 'compare'}
            >
              生成对比 SQL
            </ActionButton>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-monokai-bg">
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
                在指标卡片上点击「生成图表」，按当前指标口径计算真实数据并创建图表。
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
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        {compareMode && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            aria-label={`选择 ${chart.metricName} 进行对比`}
                            disabled={Boolean(operation || convertingId)}
                            onChange={() => toggleChartSelection(chart.id)}
                            className="mt-1 h-4 w-4 rounded border-monokai-border accent-monokai-accent cursor-pointer"
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
                      <div className="flex flex-wrap items-center gap-1.5">
                        <ActionButton
                          variant="secondary"
                          size="sm"
                          icon={TrendingUp}
                          onClick={() => handleGenerateTrend(chart)}
                          disabled={Boolean(operation || convertingId)}
                          loading={operation === chart.id}
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
                          disabled={Boolean(operation || convertingId)}
                          title="发布到 Dashboard 看板"
                        >
                          发送到看板
                        </ActionButton>

                        {deletingId === chart.id ? (
                          <div className="flex items-center gap-1.5 bg-monokai-surface border border-monokai-pink/40 rounded-lg px-2.5 py-1 shadow-2xs">
                            <span className="text-[10px] text-monokai-pink font-semibold">确认删除?</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteChart(chart.id)}
                              disabled={Boolean(operation || convertingId)}
                              className="text-xs text-monokai-pink font-bold hover:underline cursor-pointer px-1 rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent"
                            >
                              是
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingId(null)}
                              className="text-xs text-monokai-comment hover:text-monokai-fg cursor-pointer px-1 rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent"
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
                            disabled={Boolean(operation || convertingId)}
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
      </div>
    </ModalShell>
  );
};
