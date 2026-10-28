import { formatValueBySpec } from '../../utils/chartFormat';
import { useAnalysisUnit } from './AnalysisUnitSelector';
import { openAnalysis } from '../../hooks/store/useAnalysisWorkspace';
import { activeAnalysisDatabase } from '../../services/metricAssetStorage';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Terminal,
  Download,
  AlertCircle,
} from 'lucide-react';
import {
  classifySemanticType,
  timeSeriesConfigToSpec,
  runAnalysis,
  resolveDefaultAgg,
  type TimeSeriesConfig,
  type AnalysisFieldCatalog,
  type ChartSpec,
} from '../../services/analysis';
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
  fieldCatalog?: AnalysisFieldCatalog | null;
  initialTimeColumn?: string;
  onInsertSql?: (sql: string, executeDirectly?: boolean) => void;
}

export const AnalysisTimeSeries: React.FC<AnalysisTimeSeriesProps> = ({
  currentTable,
  schema,
  fieldCatalog,
  initialTimeColumn,
  onInsertSql,
}) => {
  const dateColumns = useMemo(() => {
    if (fieldCatalog?.timeFields?.length) {
      return fieldCatalog.timeFields.map((f) => f.column);
    }
    return schema.filter(c => classifySemanticType(c.name, c.type) === 'temporal').map(c => c.name);
  }, [schema, fieldCatalog]);

  const numericColumns = useMemo(() => {
    if (fieldCatalog?.measures?.length) {
      return fieldCatalog.measures.map((f) => f.column);
    }
    return schema.filter(c => classifySemanticType(c.name, c.type) === 'numeric').map(c => c.name);
  }, [schema, fieldCatalog]);

  const queryVersion = useRef(0);
  useEffect(() => () => { queryVersion.current++; }, []);
  const { column: unitColumn, unit: selectedUnit, selector: unitSelector } = useAnalysisUnit(currentTable, schema);
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
  const [chartConfig, setChartConfig] = useState<ChartConfig | null>(null);
  const [chartSpec, setChartSpec] = useState<ChartSpec | null>(null);
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
    setAggFunc(resolveDefaultAgg(fieldCatalog, selectedValCol, 'sum') as TimeSeriesConfig['aggFunc']);
    setError(null);
  }, [currentTable, schema, dateColumns, numericColumns, initialTimeColumn, fieldCatalog]);

  const handleExecute = useCallback(async () => {
    if (!currentTable || !timeColumn || !valueColumn) return;
    const request = ++queryVersion.current;
    setLoading(true);
    setRows([]);setChartConfig(null);setChartSpec(null);
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
      let spec = timeSeriesConfigToSpec(config, {
        chartType: chartType === 'pie' ? 'line' : chartType,
        title: `${currentTable} 时序走势 (${windowMode.toUpperCase()})`,
      });
      if (fieldCatalog) {
        spec = {
          ...spec,
          fields: fieldCatalog.fields.map((f) => ({
            column: f.column,
            physicalType: f.physicalType,
            role: f.role,
            unitHint: f.unitHint,
            defaultAgg: f.defaultAgg,
          })),
        };
      }
      if (unitColumn) {
        if (!selectedUnit) return;
        spec.filters.global = [...spec.filters.global.filter(f => f.column !== unitColumn), { column: unitColumn, op: '=', value: selectedUnit }];
        const money = !['count', 'count_distinct'].includes(aggFunc) && /amount|fee|price|revenue|balance/i.test(valueColumn);
        spec.visual.format = { ...spec.visual.format, unit: money ? selectedUnit : '', decimals: 8 };
        const percentageKeys = spec.calcs.filter(calc => calc.kind === 'mom' || calc.kind === 'yoy' || calc.kind === 'ratio').map(calc => calc.alias);
        if (percentageKeys.length) {
          spec.visual.encoding = { ...spec.visual.encoding, y: spec.metrics.map(metric => metric.alias), yRight: percentageKeys };
          spec.visual.unitRight = '%';
          spec.visual.formatByKey = Object.fromEntries(percentageKeys.map(key => [key, { unit: '%', percent: true, decimals: 2 }]));
        }
      }
      const res = await runAnalysis(spec, { skipDatasetResolve: true });
      if (request !== queryVersion.current) return;
      setGeneratedSql(res.sql);
      setRows(res.rows);
      setExecutionTimeMs(res.executionTimeMs);
      setChartConfig(res.chartConfig);
      setChartSpec(res.chart);

    } catch (err: unknown) {
      if (request !== queryVersion.current) return;
      console.error('[AnalysisTimeSeries] Calculation failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setRows([]);
      setChartConfig(null);
      setChartSpec(null);
      toastService.error(`时序计算失败: ${msg}`);
    } finally {
      if (request === queryVersion.current) setLoading(false);
    }
  }, [currentTable, timeColumn, valueColumn, granularity, aggFunc, windowMode, chartType, fieldCatalog, unitColumn, selectedUnit]);

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

  if (!currentTable || schema.length === 0) {
    return (
      <div className={AH.pane}>
        <div className={AH.scrollBody}>
          <AnalysisEmptyHint message="请选择数据表后再配置时序字段。" />
        </div>
      </div>
    );
  }

  const summary = chartSpec?.timeSummary || { latestVal: null, avgVal: null, maxVal: null, totalGrowthPct: null };
  const formatSummary = (value: number | null) => formatValueBySpec(value, chartSpec?.formatByKey?.[chartSpec.yKeys[0]] || chartSpec?.format);
  return (
    <div className={AH.pane}>
      <div className={AH.configBar}>
        <div className="flex gap-4 items-center mb-2">{unitSelector}<button type="button" disabled={!generatedSql || loading || Boolean(error)} className="text-xs text-monokai-cyan disabled:opacity-40" onClick={() => openAnalysis({ databaseName: activeAnalysisDatabase(), title: chartConfig?.title || '自定义分析', sql: generatedSql, chartConfig: chartConfig || undefined, sourceTables: [currentTable] })}>保存与复用本次分析</button></div>
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
        <AnalysisKpiTile label="最新周期" value={formatSummary(summary.latestVal)} />
        <AnalysisKpiTile
          label="全周期均值"
          value={formatSummary(summary.avgVal)}
          valueClassName="text-monokai-cyan"
        />
        <AnalysisKpiTile
          label="历史峰值"
          value={formatSummary(summary.maxVal)}
          valueClassName="text-monokai-yellow"
        />
        {summary.totalGrowthPct != null && <AnalysisKpiTile
          label="较首个周期增长率"
          value={formatValueBySpec(summary.totalGrowthPct, { unit: '%', percent: true, decimals: 2 })}
        />}
      </div>

      <div className={`${AH.scrollBody} flex flex-col gap-2.5`}>
        {error ? (
          <AnalysisErrorState title="时序计算异常" message={error} onRetry={handleExecute} />
        ) : loading ? (
          <AnalysisLoadingState message="正在计算时序窗口函数…" />
        ) : (
          <>
            {chartConfig && (
              <AnalysisChartRenderer
                data={rows}
                config={chartConfig}
                chartSpec={chartSpec}
                height={AH.chartHeight}
                onChartTypeChange={setChartType}
              />
            )}
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
