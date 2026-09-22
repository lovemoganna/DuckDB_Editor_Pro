import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Terminal,
  Download,
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
import { InlineAlert } from '../ui/Workbench';
import {
  AH,
  AnalysisLoadingState,
  AnalysisSubViewHeader,
  AnalysisKpiTile,
  AnalysisResultTable,
  AnalysisErrorState,
  AnalysisEmptyHint,
  AnalysisField,
  AnalysisSqlBar,
} from './analysisUi';

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
  const dateColumns = useMemo(
    () => schema.filter(c => classifySemanticType(c.name, c.type) === 'temporal').map(c => c.name),
    [schema],
  );

  const numericColumns = useMemo(
    () => schema.filter(c => classifySemanticType(c.name, c.type) === 'numeric').map(c => c.name),
    [schema],
  );

  const [timeColumn, setTimeColumn] = useState('');
  const [valueColumn, setValueColumn] = useState('');
  const [granularity, setGranularity] = useState<TimeSeriesConfig['granularity']>('month');
  const [aggFunc, setAggFunc] = useState<TimeSeriesConfig['aggFunc']>('sum');
  const [windowMode, setWindowMode] = useState<TimeSeriesConfig['windowMode']>('raw');

  const [chartType, setChartType] = useState<ChartConfig['type']>('line');
  const [showSqlDrawer, setShowSqlDrawer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    latestVal: 0,
    avgVal: 0,
    maxVal: 0,
    totalGrowthPct: 0,
  });
  const [generatedSql, setGeneratedSql] = useState('');
  const [executionTimeMs, setExecutionTimeMs] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const selectedDateCol =
      initialTimeColumn && schema.some(c => c.name === initialTimeColumn)
        ? initialTimeColumn
        : dateColumns[0] || schema[0]?.name || '';
    const selectedValCol =
      numericColumns[0] ||
      schema.find(c => c.name !== selectedDateCol)?.name ||
      selectedDateCol;
    setTimeColumn(selectedDateCol);
    setValueColumn(selectedValCol);
    setError(null);
  }, [currentTable, schema, dateColumns, numericColumns, initialTimeColumn]);

  const handleExecute = useCallback(async () => {
    if (!currentTable || !timeColumn || !valueColumn) return;
    setLoading(true);
    setError(null);
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
    } catch (err: unknown) {
      console.error('[AnalysisTimeSeries] Calculation failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setRows([]);
      toastService.error(`时序计算失败: ${msg}`);
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
    void navigator.clipboard.writeText(generatedSql);
    setCopied(true);
    toastService.success('时序 SQL 已复制');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenInSqlEditor = () => {
    if (!generatedSql || !onInsertSql) return;
    onInsertSql(generatedSql, false);
    toastService.success('已带入 SQL 工作台');
  };

  const handleExportCsv = () => {
    if (rows.length === 0) return;
    const cols = Object.keys(rows[0]);
    const headers = cols.join(',');
    const csvRows = rows.map(row =>
      cols
        .map(col => {
          const val = row[col];
          if (val === null || val === undefined) return '';
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(','),
    );
    const blob = new Blob([`${headers}\n${csvRows.join('\n')}`], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timeseries_${currentTable}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toastService.success('已导出 CSV');
  };

  const chartConfig: ChartConfig = useMemo(() => {
    const cols = rows.length > 0 ? Object.keys(rows[0]) : [];
    return {
      id: 'timeseries_chart',
      title: `${currentTable} 时序走势 (${windowMode.toUpperCase()})`,
      type: chartType,
      xKey: cols[0] || '时间周期',
      yKeys: cols.slice(1),
      showLegend: true,
      showValues: false,
    };
  }, [currentTable, rows, windowMode, chartType]);

  if (!currentTable || schema.length === 0) {
    return (
      <div className={AH.pane}>
        <div className={AH.scrollBody}>
          <AnalysisEmptyHint message="请选择数据表后再配置时序字段。" />
        </div>
      </div>
    );
  }

  return (
    <div className={AH.pane}>
      <div className={AH.configBar}>
        <AnalysisSubViewHeader
          icon={TrendingUp}
          iconTone="cyan"
          title="时序走势与波动分析"
          description="时间窗口对齐 · 环比 · 移动均线 · 累计总额"
          actions={
            <>
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={rows.length === 0}
                className={AH.btnGhost}
              >
                <Download className="h-3 w-3" aria-hidden="true" />
                导出 CSV
              </button>
              <button
                type="button"
                onClick={handleOpenInSqlEditor}
                disabled={!generatedSql || !onInsertSql}
                className={AH.btnWarning}
              >
                <Terminal className="h-3 w-3" aria-hidden="true" />
                打开 SQL
              </button>
            </>
          }
        />

        {dateColumns.length === 0 && (
          <InlineAlert tone="warning" icon={AlertCircle}>
            <span className={AH.body}>
              当前表未显式包含 DATE / TIMESTAMP 字段，已使用默认字段做时序转换。
            </span>
          </InlineAlert>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          <AnalysisField label="时间字段">
            <select
              value={timeColumn}
              onChange={e => setTimeColumn(e.target.value)}
              className={`${AH.select} text-monokai-orange`}
            >
              {schema.map(c => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.type})
                </option>
              ))}
            </select>
          </AnalysisField>
          <AnalysisField label="时间粒度">
            <select
              value={granularity}
              onChange={e => setGranularity(e.target.value as TimeSeriesConfig['granularity'])}
              className={AH.select}
            >
              <option value="day">按日</option>
              <option value="week">按周</option>
              <option value="month">按月</option>
              <option value="quarter">按季</option>
              <option value="year">按年</option>
            </select>
          </AnalysisField>
          <AnalysisField label="观测指标">
            <select
              value={valueColumn}
              onChange={e => setValueColumn(e.target.value)}
              className={`${AH.select} text-monokai-cyan`}
            >
              {(numericColumns.length > 0 ? numericColumns : schema.map(c => c.name)).map(col => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </AnalysisField>
          <AnalysisField label="聚合函数">
            <select
              value={aggFunc}
              onChange={e => setAggFunc(e.target.value as TimeSeriesConfig['aggFunc'])}
              className={AH.select}
            >
              <option value="sum">SUM</option>
              <option value="avg">AVG</option>
              <option value="count">COUNT</option>
              <option value="max">MAX</option>
              <option value="min">MIN</option>
            </select>
          </AnalysisField>
          <AnalysisField label="窗口模式">
            <select
              value={windowMode}
              onChange={e => setWindowMode(e.target.value as TimeSeriesConfig['windowMode'])}
              className={`${AH.select} text-monokai-green font-semibold`}
            >
              <option value="raw">原生趋势</option>
              <option value="mom">环比增长 (LAG)</option>
              <option value="moving_avg">7 周期移动均线</option>
              <option value="cumulative">累计总和</option>
            </select>
          </AnalysisField>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-3 pt-2.5">
        <AnalysisKpiTile label="最新周期" value={summary.latestVal.toLocaleString()} />
        <AnalysisKpiTile
          label="全周期均值"
          value={summary.avgVal.toLocaleString()}
          valueClassName="text-monokai-cyan"
        />
        <AnalysisKpiTile
          label="历史峰值"
          value={summary.maxVal.toLocaleString()}
          valueClassName="text-monokai-yellow"
        />
        <AnalysisKpiTile
          label="首末增长率"
          value={
            <span className="flex items-center gap-1">
              <span
                className={
                  summary.totalGrowthPct >= 0 ? 'text-monokai-green' : 'text-monokai-pink'
                }
              >
                {summary.totalGrowthPct >= 0
                  ? `+${summary.totalGrowthPct}%`
                  : `${summary.totalGrowthPct}%`}
              </span>
              {summary.totalGrowthPct >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5 text-monokai-green" aria-hidden="true" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-monokai-pink" aria-hidden="true" />
              )}
            </span>
          }
        />
      </div>

      <div className={`${AH.scrollBody} flex flex-col gap-2.5`}>
        {error ? (
          <AnalysisErrorState title="时序计算异常" message={error} onRetry={handleExecute} />
        ) : loading ? (
          <AnalysisLoadingState message="正在计算时序窗口函数…" />
        ) : (
          <>
            <AnalysisChartRenderer
              data={rows}
              config={chartConfig}
              height={AH.chartHeight}
              onChartTypeChange={setChartType}
            />
            <AnalysisResultTable
              columns={rows.length > 0 ? Object.keys(rows[0]) : []}
              rows={rows}
              title={`时序明细 (${rows.length} 周期)`}
              metaRight={`${executionTimeMs} ms`}
              emptyMessage="暂无时序数据，请检查时间字段与聚合配置。"
            />
          </>
        )}
      </div>

      <AnalysisSqlBar
        sql={generatedSql}
        open={showSqlDrawer}
        onToggle={() => setShowSqlDrawer(v => !v)}
        onCopy={handleCopySql}
        copied={copied}
      />
    </div>
  );
};
