import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Activity,
  Terminal,
  Copy,
  Check,
  RefreshCw,
  Sliders,
  Table as TableIcon,
  BarChart2,
  AlertCircle,
} from 'lucide-react';
import {
  analysisEngine,
  classifySemanticType,
  type TimeSeriesConfig,
} from './analysisEngine';
import { AnalysisChartRenderer } from './AnalysisChartRenderer';
import type { ColumnInfo, ChartConfig } from '../../types';
import { toastService } from '../../services/toastService';

interface AnalysisTimeSeriesProps {
  currentTable: string;
  schema: ColumnInfo[];
  initialTimeColumn?: string;
  onInsertSql?: (sql: string, executeDirectly?: boolean) => void;
}

export const AnalysisTimeSeries: React.FC<AnalysisTimeSeriesProps> = ({
  currentTable,
  schema,
  initialTimeColumn,
  onInsertSql,
}) => {
  // Find date columns
  const dateColumns = useMemo(() => {
    return schema.filter(c => classifySemanticType(c.name, c.type) === 'temporal').map(c => c.name);
  }, [schema]);

  const numericColumns = useMemo(() => {
    return schema.filter(c => classifySemanticType(c.name, c.type) === 'numeric').map(c => c.name);
  }, [schema]);

  // Config state
  const [timeColumn, setTimeColumn] = useState<string>('');
  const [valueColumn, setValueColumn] = useState<string>('');
  const [granularity, setGranularity] = useState<TimeSeriesConfig['granularity']>('month');
  const [aggFunc, setAggFunc] = useState<TimeSeriesConfig['aggFunc']>('sum');
  const [windowMode, setWindowMode] = useState<TimeSeriesConfig['windowMode']>('raw');

  // View state
  const [chartType, setChartType] = useState<ChartConfig['type']>('line');
  const [loading, setLoading] = useState<boolean>(false);
  const [rows, setRows] = useState<any[]>([]);
  const [summary, setSummary] = useState<{
    latestVal: number;
    avgVal: number;
    maxVal: number;
    totalGrowthPct: number;
  }>({
    latestVal: 0,
    avgVal: 0,
    maxVal: 0,
    totalGrowthPct: 0,
  });
  const [generatedSql, setGeneratedSql] = useState<string>('');
  const [executionTimeMs, setExecutionTimeMs] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);

  // Initialize defaults
  useEffect(() => {
    const selectedDateCol = initialTimeColumn && schema.some(c => c.name === initialTimeColumn)
      ? initialTimeColumn
      : dateColumns[0] || schema[0]?.name || '';

    const selectedValCol = numericColumns[0] || schema.find(c => c.name !== selectedDateCol)?.name || selectedDateCol;

    setTimeColumn(selectedDateCol);
    setValueColumn(selectedValCol);
  }, [currentTable, schema, dateColumns, numericColumns, initialTimeColumn]);

  // Execute time-series calculation
  const handleExecute = useCallback(async () => {
    if (!currentTable || !timeColumn || !valueColumn) return;
    setLoading(true);
    try {
      const config: TimeSeriesConfig = {
        tableName: currentTable,
        timeColumn,
        valueColumn,
        granularity,
        aggFunc,
        windowMode,
      };

      const res = await analysisEngine.executeTimeSeries(config);
      setGeneratedSql(res.sql);
      setRows(res.rows);
      setSummary(res.summary);
      setExecutionTimeMs(res.executionTimeMs);
    } catch (err: any) {
      console.error('[AnalysisTimeSeries] Calculation failed:', err);
      toastService.error(`时序计算失败: ${err?.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [currentTable, timeColumn, valueColumn, granularity, aggFunc, windowMode]);

  useEffect(() => {
    if (timeColumn && valueColumn) {
      void handleExecute();
    }
  }, [timeColumn, valueColumn, granularity, aggFunc, windowMode, handleExecute]);

  const handleCopySql = () => {
    if (!generatedSql) return;
    navigator.clipboard.writeText(generatedSql);
    setCopied(true);
    toastService.success('时序分析 SQL 已复制！');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenInSqlEditor = () => {
    if (!generatedSql) return;
    if (onInsertSql) {
      onInsertSql(generatedSql, false);
      toastService.success('已带入 SQL 工作台！');
    }
  };

  const chartConfig: ChartConfig = useMemo(() => {
    const cols = rows.length > 0 ? Object.keys(rows[0]) : [];
    const xKey = cols[0] || '时间周期';
    const yKeys = cols.slice(1);

    return {
      id: 'timeseries_chart',
      title: `${currentTable} 时序波动走势 (${windowMode.toUpperCase()})`,
      type: chartType,
      xKey,
      yKeys,
      showLegend: true,
      showValues: false,
    };
  }, [currentTable, rows, windowMode, chartType]);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-monokai-bg font-sans">
      {/* Top Configuration Bar */}
      <div className="flex flex-col gap-3 border-b border-monokai-border bg-monokai-surface px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-monokai-cyan/20 text-monokai-cyan">
              <TrendingUp className="h-3.5 w-3.5" />
            </span>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-monokai-fg">
                时序走势与波动分析
              </h3>
              <p className="text-[10px] text-monokai-comment">
                自动对齐时间窗口 • 环比变动率 • 移动均线与累计总额计算
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopySql}
              className="flex items-center gap-1 rounded bg-monokai-bg border border-monokai-border px-2.5 py-1 text-xs text-monokai-comment hover:text-monokai-fg font-mono transition-colors cursor-pointer"
            >
              {copied ? <Check className="h-3 w-3 text-monokai-green" /> : <Copy className="h-3 w-3" />}
              <span>{copied ? '已复制' : '复制 SQL'}</span>
            </button>

            <button
              type="button"
              onClick={handleOpenInSqlEditor}
              className="flex items-center gap-1 rounded bg-monokai-orange text-monokai-bg px-3 py-1 text-xs font-semibold hover:bg-monokai-orange/90 transition-colors cursor-pointer"
            >
              <Terminal className="h-3.5 w-3.5" />
              <span>在 SQL 工作台查看</span>
            </button>
          </div>
        </div>

        {/* Warning if no date columns */}
        {dateColumns.length === 0 && (
          <div className="flex items-center gap-2 rounded bg-monokai-warning/10 border border-monokai-warning/30 p-2 text-xs text-monokai-warning">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>当前表未显式包含 DATE 或 TIMESTAMP 字段，已使用默认字段进行时序转换。</span>
          </div>
        )}

        {/* Controls Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 text-xs">
          {/* Time Col */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-monokai-comment font-mono">时间戳字段:</label>
            <select
              value={timeColumn}
              onChange={e => setTimeColumn(e.target.value)}
              className="rounded border border-monokai-border bg-monokai-bg px-2 py-1 text-xs text-monokai-orange font-mono focus:border-monokai-accent focus:outline-none"
            >
              {schema.map(c => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.type})
                </option>
              ))}
            </select>
          </div>

          {/* Granularity */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-monokai-comment font-mono">时间粒度:</label>
            <select
              value={granularity}
              onChange={e => setGranularity(e.target.value as any)}
              className="rounded border border-monokai-border bg-monokai-bg px-2 py-1 text-xs text-monokai-fg font-mono focus:border-monokai-accent focus:outline-none"
            >
              <option value="day">按日 (Daily)</option>
              <option value="week">按周 (Weekly)</option>
              <option value="month">按月 (Monthly)</option>
              <option value="quarter">按季度 (Quarterly)</option>
              <option value="year">按年 (Yearly)</option>
            </select>
          </div>

          {/* Value Col */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-monokai-comment font-mono">观测指标字段:</label>
            <select
              value={valueColumn}
              onChange={e => setValueColumn(e.target.value)}
              className="rounded border border-monokai-border bg-monokai-bg px-2 py-1 text-xs text-monokai-cyan font-mono focus:border-monokai-accent focus:outline-none"
            >
              {(numericColumns.length > 0 ? numericColumns : schema.map(c => c.name)).map(col => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>

          {/* Agg Func */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-monokai-comment font-mono">聚合计算函数:</label>
            <select
              value={aggFunc}
              onChange={e => setAggFunc(e.target.value as any)}
              className="rounded border border-monokai-border bg-monokai-bg px-2 py-1 text-xs text-monokai-fg font-mono focus:border-monokai-accent focus:outline-none"
            >
              <option value="sum">SUM (累计总额)</option>
              <option value="avg">AVG (周期均值)</option>
              <option value="count">COUNT (记录条数)</option>
              <option value="max">MAX (周期极值)</option>
              <option value="min">MIN (周期低谷)</option>
            </select>
          </div>

          {/* Window Mode */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-monokai-comment font-mono">窗口分析模式:</label>
            <select
              value={windowMode}
              onChange={e => setWindowMode(e.target.value as any)}
              className="rounded border border-monokai-border bg-monokai-bg px-2 py-1 text-xs text-monokai-green font-mono focus:border-monokai-accent focus:outline-none font-bold"
            >
              <option value="raw">📊 原生趋势走势</option>
              <option value="mom">⚡ 环比增长率 (LAG)</option>
              <option value="moving_avg">📈 7周期移动均线</option>
              <option value="cumulative">🎯 累计增长总和</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 pb-0">
        <div className="rounded-lg border border-monokai-border bg-monokai-surface p-3">
          <span className="text-[10px] font-mono text-monokai-comment">最新周期数值</span>
          <div className="mt-1 text-lg font-bold font-mono text-monokai-fg">
            {summary.latestVal.toLocaleString()}
          </div>
        </div>

        <div className="rounded-lg border border-monokai-border bg-monokai-surface p-3">
          <span className="text-[10px] font-mono text-monokai-comment">全周期均值</span>
          <div className="mt-1 text-lg font-bold font-mono text-monokai-cyan">
            {summary.avgVal.toLocaleString()}
          </div>
        </div>

        <div className="rounded-lg border border-monokai-border bg-monokai-surface p-3">
          <span className="text-[10px] font-mono text-monokai-comment">周期历史最高峰值</span>
          <div className="mt-1 text-lg font-bold font-mono text-monokai-yellow">
            {summary.maxVal.toLocaleString()}
          </div>
        </div>

        <div className="rounded-lg border border-monokai-border bg-monokai-surface p-3">
          <span className="text-[10px] font-mono text-monokai-comment">首末周期总增长率</span>
          <div className="flex items-center gap-1.5 mt-1">
            <span
              className={`text-lg font-bold font-mono ${
                summary.totalGrowthPct >= 0 ? 'text-monokai-green' : 'text-monokai-pink'
              }`}
            >
              {summary.totalGrowthPct >= 0 ? `+${summary.totalGrowthPct}%` : `${summary.totalGrowthPct}%`}
            </span>
            {summary.totalGrowthPct >= 0 ? (
              <TrendingUp className="h-4 w-4 text-monokai-green" />
            ) : (
              <TrendingDown className="h-4 w-4 text-monokai-pink" />
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area: Chart + Data Grid */}
      <div className="flex-1 overflow-auto p-4 custom-scrollbar flex flex-col gap-4">
        {loading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-xs font-mono text-monokai-comment">
            <RefreshCw className="h-6 w-6 animate-spin text-monokai-orange" />
            <span>DuckDB WASM 正在实时计算时序窗口函数…</span>
          </div>
        ) : (
          <>
            <AnalysisChartRenderer
              data={rows}
              config={chartConfig}
              height={280}
              onChartTypeChange={setChartType}
            />

            {/* Detail Data Table */}
            <div className="flex flex-col rounded-lg border border-monokai-border bg-monokai-surface overflow-hidden">
              <div className="px-3.5 py-2 border-b border-monokai-border bg-monokai-bg flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-monokai-fg">
                  时序明细数据 ({rows.length} 周期)
                </span>
                <span className="text-[10px] text-monokai-comment font-mono">
                  执行耗时: {executionTimeMs} ms
                </span>
              </div>
              <div className="max-h-56 overflow-auto custom-scrollbar">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-monokai-border bg-monokai-bg/60 sticky top-0">
                      {rows.length > 0 &&
                        Object.keys(rows[0]).map(col => (
                          <th key={col} className="px-3 py-2 text-monokai-comment">
                            {col}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-monokai-border/40">
                    {rows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-monokai-bg/30">
                        {Object.keys(row).map((col, cIdx) => (
                          <td key={cIdx} className="px-3 py-1.5 text-monokai-fg/90">
                            {row[col] !== null && row[col] !== undefined
                              ? typeof row[col] === 'number'
                                ? Number.isInteger(row[col])
                                  ? row[col].toLocaleString()
                                  : row[col].toFixed(2)
                                : String(row[col])
                              : '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
