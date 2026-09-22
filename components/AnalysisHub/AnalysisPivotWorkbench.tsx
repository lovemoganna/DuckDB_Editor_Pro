import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart3,
  Table as TableIcon,
  Plus,
  Trash2,
  Terminal,
  Download,
} from 'lucide-react';
import {
  analysisEngine,
  classifySemanticType,
  type PivotDimension,
  type PivotMetric,
  type PivotFilter,
  type PivotQueryConfig,
} from './analysisEngine';
import { AnalysisChartRenderer } from './AnalysisChartRenderer';
import type { ColumnInfo, ChartConfig } from '../../types';
import { toastService } from '../../services/toastService';
import {
  AH,
  AnalysisLoadingState,
  AnalysisSubViewHeader,
  AnalysisResultTable,
  AnalysisEmptyHint,
  AnalysisErrorState,
  AnalysisSegmentToggle,
  AnalysisSqlBar,
} from './analysisUi';

interface AnalysisPivotWorkbenchProps {
  currentTable: string;
  schema: ColumnInfo[];
  initialDimension?: string;
  onInsertSql?: (sql: string, executeDirectly?: boolean) => void;
}

export const AnalysisPivotWorkbench: React.FC<AnalysisPivotWorkbenchProps> = ({
  currentTable,
  schema,
  initialDimension,
  onInsertSql,
}) => {
  const [dimensions, setDimensions] = useState<PivotDimension[]>([]);
  const [metrics, setMetrics] = useState<PivotMetric[]>([]);
  const [filters, setFilters] = useState<PivotFilter[]>([]);
  const [sortMetric, setSortMetric] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [limit, setLimit] = useState(50);

  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [chartType, setChartType] = useState<ChartConfig['type']>('bar');
  const [showSqlDrawer, setShowSqlDrawer] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultRows, setResultRows] = useState<any[]>([]);
  const [resultColumns, setResultColumns] = useState<string[]>([]);
  const [generatedSql, setGeneratedSql] = useState('');
  const [executionTimeMs, setExecutionTimeMs] = useState(0);
  const [copied, setCopied] = useState(false);

  const numericColumns = useMemo(
    () => schema.filter(c => classifySemanticType(c.name, c.type) === 'numeric').map(c => c.name),
    [schema],
  );

  const categoricalColumns = useMemo(
    () =>
      schema
        .filter(c => {
          const sem = classifySemanticType(c.name, c.type);
          return sem === 'categorical' || sem === 'identifier' || sem === 'temporal';
        })
        .map(c => c.name),
    [schema],
  );

  useEffect(() => {
    if (!currentTable || schema.length === 0) return;

    const defaultDimCol = initialDimension || categoricalColumns[0] || schema[0]?.name;
    const defaultDim: PivotDimension = { column: defaultDimCol };
    const sem = schema.find(c => c.name === defaultDimCol);
    if (sem && classifySemanticType(sem.name, sem.type) === 'temporal') {
      defaultDim.dateTrunc = 'month';
    }

    const defaultMetrics: PivotMetric[] = [];
    if (numericColumns.length > 0) {
      const firstNum = numericColumns[0];
      defaultMetrics.push({ column: firstNum, agg: 'sum', alias: `总${firstNum}` });
      defaultMetrics.push({ column: undefined, agg: 'count', alias: '记录条数' });
    } else {
      defaultMetrics.push({ column: undefined, agg: 'count', alias: '记录条数' });
    }

    setDimensions([defaultDim]);
    setMetrics(defaultMetrics);
    setSortMetric(defaultMetrics[0]?.alias || '');
    setFilters([]);
    setError(null);
  }, [currentTable, schema, initialDimension, categoricalColumns, numericColumns]);

  const handleExecute = useCallback(async () => {
    if (!currentTable || dimensions.length === 0 || metrics.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const config: PivotQueryConfig = {
        tableName: currentTable,
        rowDimensions: dimensions,
        metrics,
        filters,
        sortMetric,
        sortOrder,
        limit,
      };
      const res = await analysisEngine.executePivotQuery(config);
      setGeneratedSql(res.sql);
      setResultRows(res.rows);
      setResultColumns(res.columns);
      setExecutionTimeMs(res.executionTimeMs);
    } catch (err: unknown) {
      console.error('[PivotWorkbench] Query execution failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setResultRows([]);
      toastService.error(`透视计算失败: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [currentTable, dimensions, metrics, filters, sortMetric, sortOrder, limit]);

  useEffect(() => {
    if (dimensions.length > 0 && metrics.length > 0) {
      void handleExecute();
    }
  }, [dimensions, metrics, filters, sortMetric, sortOrder, limit, handleExecute]);

  useEffect(() => {
    if (metrics.length > 0 && !metrics.some(m => m.alias === sortMetric)) {
      setSortMetric(metrics[0].alias);
    }
  }, [metrics, sortMetric]);

  const handleAddMetric = () => {
    const targetCol = numericColumns[0] || schema[0]?.name;
    setMetrics([
      ...metrics,
      { column: targetCol, agg: 'sum', alias: `sum_${targetCol}_${metrics.length + 1}` },
    ]);
  };

  const handleRemoveMetric = (idx: number) => {
    if (metrics.length <= 1) {
      toastService.warning('至少保留一个度量指标');
      return;
    }
    setMetrics(metrics.filter((_, i) => i !== idx));
  };

  const handleAddFilter = () => {
    setFilters([...filters, { column: schema[0]?.name || '', op: '=', value: '' }]);
  };

  const handleCopySql = () => {
    if (!generatedSql) return;
    void navigator.clipboard.writeText(generatedSql);
    setCopied(true);
    toastService.success('透视 SQL 已复制');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenInSqlEditor = () => {
    if (!generatedSql || !onInsertSql) return;
    onInsertSql(generatedSql, false);
    toastService.success('已带入 SQL 工作台');
  };

  const handleExportCsv = () => {
    if (resultRows.length === 0) return;
    const headers = resultColumns.join(',');
    const csvRows = resultRows.map(row =>
      resultColumns
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
    a.download = `pivot_${currentTable}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toastService.success('已导出 CSV');
  };

  const chartConfig: ChartConfig = useMemo(() => {
    const xKey = resultColumns[0] || '';
    const yKeys = resultColumns.slice(dimensions.length);
    return {
      id: 'pivot_chart',
      title: `${currentTable} 多维聚合`,
      type: chartType,
      xKey,
      yKeys: yKeys.length > 0 ? yKeys : [resultColumns[1] || ''],
      showLegend: true,
      showValues: false,
    };
  }, [currentTable, resultColumns, dimensions, chartType]);

  if (!currentTable || schema.length === 0) {
    return (
      <div className={AH.pane}>
        <div className={AH.scrollBody}>
          <AnalysisEmptyHint message="请选择数据表后再配置透视维度与度量。" />
        </div>
      </div>
    );
  }

  return (
    <div className={AH.pane}>
      <div className={AH.configBar}>
        <AnalysisSubViewHeader
          icon={BarChart3}
          iconTone="orange"
          title="多维透视与切片聚合"
          description="分组计算 · 多度量筛选 · DuckDB 本地直出"
          actions={
            <>
              <AnalysisSegmentToggle<'chart' | 'table'>
                aria-label="透视结果展示方式"
                value={viewMode}
                onChange={setViewMode}
                options={[
                  { value: 'chart', label: '图表', icon: BarChart3 },
                  { value: 'table', label: '数据表', icon: TableIcon },
                ]}
              />
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={resultRows.length === 0}
                className={AH.btnGhost}
              >
                <Download className="h-3 w-3" aria-hidden="true" />
                导出 CSV
              </button>
              <button
                type="button"
                onClick={handleOpenInSqlEditor}
                disabled={!generatedSql}
                className={AH.btnWarning}
              >
                <Terminal className="h-3 w-3" aria-hidden="true" />
                打开 SQL
              </button>
            </>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 pt-0.5">
          <div className={`${AH.cardMuted} flex flex-col gap-1.5 p-2`}>
            <div className="flex items-center justify-between text-2xs font-bold text-monokai-comment uppercase">
              <span>行分组维度</span>
              <span className="font-mono text-monokai-fg">1~2</span>
            </div>
            {dimensions.map((dim, idx) => {
              const colMeta = schema.find(c => c.name === dim.column);
              const isDate =
                colMeta && classifySemanticType(colMeta.name, colMeta.type) === 'temporal';
              return (
                <div key={idx} className="flex items-center gap-1">
                  <select
                    value={dim.column}
                    onChange={e => {
                      const newCol = e.target.value;
                      const next = [...dimensions];
                      next[idx] = { ...next[idx], column: newCol };
                      const sem = schema.find(c => c.name === newCol);
                      next[idx].dateTrunc =
                        sem && classifySemanticType(sem.name, sem.type) === 'temporal'
                          ? 'month'
                          : undefined;
                      setDimensions(next);
                    }}
                    className={`flex-1 ${AH.select}`}
                  >
                    {schema.map(c => (
                      <option key={c.name} value={c.name}>
                        {c.name} ({c.type})
                      </option>
                    ))}
                  </select>
                  {isDate && (
                    <select
                      value={dim.dateTrunc || 'month'}
                      onChange={e => {
                        const next = [...dimensions];
                        next[idx] = {
                          ...next[idx],
                          dateTrunc: e.target.value as PivotDimension['dateTrunc'],
                        };
                        setDimensions(next);
                      }}
                      className={`${AH.select} text-monokai-orange`}
                    >
                      <option value="day">日</option>
                      <option value="week">周</option>
                      <option value="month">月</option>
                      <option value="quarter">季</option>
                      <option value="year">年</option>
                    </select>
                  )}
                  {dimensions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setDimensions(dimensions.filter((_, i) => i !== idx))}
                      className={AH.dangerIconBtn}
                      title="移除维度"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                    </button>
                  )}
                </div>
              );
            })}
            {dimensions.length < 2 && (
              <button
                type="button"
                onClick={() => {
                  const remaining = schema.find(c => !dimensions.some(d => d.column === c.name));
                  if (remaining) setDimensions([...dimensions, { column: remaining.name }]);
                }}
                className={AH.dashedAdd}
              >
                <Plus className="h-3 w-3" aria-hidden="true" />
                添加交叉维度
              </button>
            )}
          </div>

          <div className={`${AH.cardMuted} flex flex-col gap-1.5 p-2`}>
            <div className="flex items-center justify-between text-2xs font-bold text-monokai-comment uppercase">
              <span>度量指标</span>
              <button type="button" onClick={handleAddMetric} className={AH.textLink}>
                <Plus className="h-3 w-3" aria-hidden="true" />
                新增
              </button>
            </div>
            <div className="flex flex-col gap-1 max-h-[110px] overflow-y-auto custom-scrollbar pr-0.5">
              {metrics.map((m, idx) => (
                <div key={idx} className="flex items-center gap-1">
                  <select
                    value={m.agg}
                    onChange={e => {
                      const next = [...metrics];
                      next[idx] = { ...next[idx], agg: e.target.value as PivotMetric['agg'] };
                      setMetrics(next);
                    }}
                    className={`w-20 ${AH.select} text-monokai-cyan`}
                  >
                    <option value="count">COUNT</option>
                    <option value="count_distinct">DISTINCT</option>
                    <option value="sum">SUM</option>
                    <option value="avg">AVG</option>
                    <option value="min">MIN</option>
                    <option value="max">MAX</option>
                  </select>
                  {m.agg !== 'count' && (
                    <select
                      value={m.column}
                      onChange={e => {
                        const next = [...metrics];
                        next[idx] = { ...next[idx], column: e.target.value };
                        setMetrics(next);
                      }}
                      className={`flex-1 ${AH.select}`}
                    >
                      {(numericColumns.length > 0 ? numericColumns : schema.map(c => c.name)).map(
                        col => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ),
                      )}
                    </select>
                  )}
                  <input
                    type="text"
                    value={m.alias}
                    placeholder="别名"
                    onChange={e => {
                      const next = [...metrics];
                      next[idx] = { ...next[idx], alias: e.target.value };
                      setMetrics(next);
                    }}
                    className={`w-20 ${AH.input}`}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveMetric(idx)}
                    className={AH.dangerIconBtn}
                    title="移除度量"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className={`${AH.cardMuted} flex flex-col gap-1.5 p-2`}>
            <div className="flex items-center justify-between text-2xs font-bold text-monokai-comment uppercase">
              <span>过滤 / 排序</span>
              <button type="button" onClick={handleAddFilter} className={`${AH.textLink} text-monokai-cyan`}>
                + 筛选
              </button>
            </div>
            {filters.map((f, idx) => (
              <div key={idx} className="flex items-center gap-1">
                <select
                  value={f.column}
                  onChange={e => {
                    const next = [...filters];
                    next[idx] = { ...next[idx], column: e.target.value };
                    setFilters(next);
                  }}
                  className={`w-20 ${AH.select}`}
                >
                  {schema.map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  value={f.op}
                  onChange={e => {
                    const next = [...filters];
                    next[idx] = { ...next[idx], op: e.target.value as PivotFilter['op'] };
                    setFilters(next);
                  }}
                  className={`w-14 ${AH.select} text-monokai-yellow`}
                >
                  <option value="=">=</option>
                  <option value="!=">!=</option>
                  <option value=">">&gt;</option>
                  <option value="<">&lt;</option>
                  <option value="contains">含</option>
                  <option value="not_null">非空</option>
                </select>
                {f.op !== 'not_null' && (
                  <input
                    type="text"
                    placeholder="值"
                    value={f.value}
                    onChange={e => {
                      const next = [...filters];
                      next[idx] = { ...next[idx], value: e.target.value };
                      setFilters(next);
                    }}
                    className={`flex-1 ${AH.input}`}
                  />
                )}
                <button
                  type="button"
                  onClick={() => setFilters(filters.filter((_, i) => i !== idx))}
                  className={AH.dangerIconBtn}
                >
                  <Trash2 className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
            ))}

            <div className={`flex flex-wrap items-center gap-2 pt-1 ${AH.divider}`}>
              <span className={AH.label}>排序</span>
              <select
                value={sortMetric}
                onChange={e => setSortMetric(e.target.value)}
                className={`${AH.select} max-w-[100px]`}
              >
                {metrics.map(m => (
                  <option key={m.alias} value={m.alias}>
                    {m.alias}
                  </option>
                ))}
              </select>
              <select
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value as 'asc' | 'desc')}
                className={AH.select}
              >
                <option value="desc">降序</option>
                <option value="asc">升序</option>
              </select>
              <select
                value={limit}
                onChange={e => setLimit(Number(e.target.value))}
                className={AH.select}
              >
                <option value={10}>Top 10</option>
                <option value={25}>Top 25</option>
                <option value={50}>Top 50</option>
                <option value={100}>Top 100</option>
                <option value={0}>全部</option>
              </select>
              <span className={`${AH.label} ml-auto`}>{executionTimeMs} ms</span>
            </div>
          </div>
        </div>
      </div>

      <div className={AH.scrollBody}>
        {error ? (
          <AnalysisErrorState title="透视计算异常" message={error} onRetry={handleExecute} />
        ) : loading ? (
          <AnalysisLoadingState message="正在执行多维聚合…" />
        ) : viewMode === 'chart' ? (
          <AnalysisChartRenderer
            data={resultRows}
            config={chartConfig}
            height={AH.chartHeight}
            onChartTypeChange={setChartType}
          />
        ) : (
          <AnalysisResultTable
            columns={resultColumns}
            rows={resultRows}
            title={`聚合结果 (${resultRows.length})`}
            metaRight={`${executionTimeMs} ms`}
            maxHeightClass="max-h-[480px]"
            emptyMessage="暂无聚合结果，请调整维度或筛选条件。"
          />
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
