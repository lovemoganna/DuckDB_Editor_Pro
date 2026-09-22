import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart3,
  Table as TableIcon,
  Play,
  Plus,
  Trash2,
  Copy,
  Terminal,
  Layers,
  Sparkles,
  Filter,
  ArrowUpDown,
  RefreshCw,
  Code,
  Download,
  Check,
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
  // Config state
  const [dimensions, setDimensions] = useState<PivotDimension[]>([]);
  const [metrics, setMetrics] = useState<PivotMetric[]>([]);
  const [filters, setFilters] = useState<PivotFilter[]>([]);
  const [sortMetric, setSortMetric] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [limit, setLimit] = useState<number>(50);

  // View state
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [chartType, setChartType] = useState<ChartConfig['type']>('bar');
  const [showSqlDrawer, setShowSqlDrawer] = useState<boolean>(false);

  // Execution state
  const [loading, setLoading] = useState<boolean>(false);
  const [resultRows, setResultRows] = useState<any[]>([]);
  const [resultColumns, setResultColumns] = useState<string[]>([]);
  const [generatedSql, setGeneratedSql] = useState<string>('');
  const [executionTimeMs, setExecutionTimeMs] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);

  // Categorize columns
  const numericColumns = useMemo(() => {
    return schema.filter(c => classifySemanticType(c.name, c.type) === 'numeric').map(c => c.name);
  }, [schema]);

  const categoricalColumns = useMemo(() => {
    return schema.filter(c => {
      const sem = classifySemanticType(c.name, c.type);
      return sem === 'categorical' || sem === 'identifier' || sem === 'temporal';
    }).map(c => c.name);
  }, [schema]);

  // Initialize sensible defaults on table load
  useEffect(() => {
    if (!currentTable || schema.length === 0) return;

    let defaultDimCol = initialDimension || categoricalColumns[0] || schema[0]?.name;
    const defaultDim: PivotDimension = { column: defaultDimCol };

    const sem = schema.find(c => c.name === defaultDimCol);
    if (sem && classifySemanticType(sem.name, sem.type) === 'temporal') {
      defaultDim.dateTrunc = 'month';
    }

    const defaultMetrics: PivotMetric[] = [];
    if (numericColumns.length > 0) {
      const firstNum = numericColumns[0];
      defaultMetrics.push({
        column: firstNum,
        agg: 'sum',
        alias: `总${firstNum}`,
      });
      defaultMetrics.push({
        column: undefined,
        agg: 'count',
        alias: '记录条数',
      });
    } else {
      defaultMetrics.push({
        column: undefined,
        agg: 'count',
        alias: '记录条数',
      });
    }

    setDimensions([defaultDim]);
    setMetrics(defaultMetrics);
    setSortMetric(defaultMetrics[0]?.alias || '');
    setFilters([]);
  }, [currentTable, schema, initialDimension]);

  // Run pivot query
  const handleExecute = useCallback(async () => {
    if (!currentTable || dimensions.length === 0 || metrics.length === 0) return;
    setLoading(true);
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
    } catch (err: any) {
      console.error('[PivotWorkbench] Query execution failed:', err);
      toastService.error(`透视计算执行失败: ${err?.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [currentTable, dimensions, metrics, filters, sortMetric, sortOrder, limit]);

  // Execute on dependency change
  useEffect(() => {
    if (dimensions.length > 0 && metrics.length > 0) {
      void handleExecute();
    }
  }, [dimensions, metrics, filters, sortMetric, sortOrder, limit, handleExecute]);

  // Add new metric
  const handleAddMetric = () => {
    const targetCol = numericColumns[0] || schema[0]?.name;
    const newMetric: PivotMetric = {
      column: targetCol,
      agg: 'sum',
      alias: `sum_${targetCol}_${metrics.length + 1}`,
    };
    setMetrics([...metrics, newMetric]);
  };

  const handleRemoveMetric = (idx: number) => {
    if (metrics.length <= 1) {
      toastService.warning('至少保留一个度量指标！');
      return;
    }
    setMetrics(metrics.filter((_, i) => i !== idx));
  };

  // Add filter
  const handleAddFilter = () => {
    const col = schema[0]?.name || '';
    setFilters([...filters, { column: col, op: '=', value: '' }]);
  };

  const handleRemoveFilter = (idx: number) => {
    setFilters(filters.filter((_, i) => i !== idx));
  };

  const handleCopySql = () => {
    if (!generatedSql) return;
    navigator.clipboard.writeText(generatedSql);
    setCopied(true);
    toastService.success('透视 SQL 已复制到剪贴板！');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenInSqlEditor = () => {
    if (!generatedSql) return;
    if (onInsertSql) {
      onInsertSql(generatedSql, false);
      toastService.success('已带入 SQL 工作台！');
    }
  };

  const handleExportCsv = () => {
    if (resultRows.length === 0) return;
    const headers = resultColumns.join(',');
    const csvRows = resultRows.map(row =>
      resultColumns.map(col => {
        const val = row[col];
        if (val === null || val === undefined) return '';
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(',')
    );
    const blob = new Blob([`${headers}\n${csvRows.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pivot_${currentTable}_${Date.now()}.csv`;
    a.click();
    toastService.success('数据已导出为 CSV！');
  };

  // Generate chart config
  const chartConfig: ChartConfig = useMemo(() => {
    const xKey = resultColumns[0] || '';
    const yKeys = resultColumns.slice(dimensions.length);

    return {
      id: 'pivot_chart',
      title: `${currentTable} 多维聚合分布`,
      type: chartType,
      xKey,
      yKeys: yKeys.length > 0 ? yKeys : [resultColumns[1] || ''],
      showLegend: true,
      showValues: false,
    };
  }, [currentTable, resultColumns, dimensions, chartType]);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-monokai-bg font-sans">
      {/* Top Configuration & Control Bar */}
      <div className="flex flex-col gap-2.5 border-b border-monokai-border bg-monokai-surface px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-monokai-orange/20 text-monokai-orange">
              <BarChart3 className="h-3.5 w-3.5" />
            </span>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-monokai-fg">
                多维透视与切片聚合
              </h3>
              <p className="text-[10px] text-monokai-comment">
                即时分组计算 • 支持多度量与条件筛选 • 毫秒级 DuckDB 内核直出
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Switcher */}
            <div className="flex rounded bg-monokai-bg p-0.5 border border-monokai-border">
              <button
                type="button"
                onClick={() => setViewMode('chart')}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded transition-colors ${
                  viewMode === 'chart'
                    ? 'bg-monokai-orange text-monokai-bg font-bold'
                    : 'text-monokai-comment hover:text-monokai-fg'
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                <span>图表</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded transition-colors ${
                  viewMode === 'table'
                    ? 'bg-monokai-orange text-monokai-bg font-bold'
                    : 'text-monokai-comment hover:text-monokai-fg'
                }`}
              >
                <TableIcon className="h-3.5 w-3.5" />
                <span>数据表</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={resultRows.length === 0}
              className="flex items-center gap-1 rounded bg-monokai-bg border border-monokai-border px-2.5 py-1 text-xs text-monokai-fg hover:border-monokai-orange transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Download className="h-3 w-3" />
              <span>导出 CSV</span>
            </button>

            <button
              type="button"
              onClick={handleOpenInSqlEditor}
              className="flex items-center gap-1 rounded bg-monokai-orange text-monokai-bg px-3 py-1 text-xs font-semibold hover:bg-monokai-orange/90 transition-colors cursor-pointer"
            >
              <Terminal className="h-3.5 w-3.5" />
              <span>在 SQL 工作台打开</span>
            </button>
          </div>
        </div>

        {/* Builder Panels: Dimensions & Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1 text-xs">
          {/* 1. Dimensions Box */}
          <div className="flex flex-col gap-1.5 rounded border border-monokai-border/80 bg-monokai-bg/60 p-2.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-monokai-comment uppercase">
              <span>行分组维度 (GROUP BY)</span>
              <span className="font-mono text-[10px] text-monokai-fg">1~2 维度</span>
            </div>

            <div className="flex flex-col gap-1.5">
              {dimensions.map((dim, idx) => {
                const colMeta = schema.find(c => c.name === dim.column);
                const isDate = colMeta && classifySemanticType(colMeta.name, colMeta.type) === 'temporal';

                return (
                  <div key={idx} className="flex items-center gap-1.5">
                    <select
                      value={dim.column}
                      onChange={e => {
                        const newCol = e.target.value;
                        const newDims = [...dimensions];
                        newDims[idx].column = newCol;
                        const sem = schema.find(c => c.name === newCol);
                        if (sem && classifySemanticType(sem.name, sem.type) === 'temporal') {
                          newDims[idx].dateTrunc = 'month';
                        } else {
                          newDims[idx].dateTrunc = undefined;
                        }
                        setDimensions(newDims);
                      }}
                      className="flex-1 rounded border border-monokai-border bg-monokai-surface px-2 py-1 text-xs text-monokai-fg focus:border-monokai-orange focus:outline-none"
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
                          const newDims = [...dimensions];
                          newDims[idx].dateTrunc = e.target.value as any;
                          setDimensions(newDims);
                        }}
                        className="rounded border border-monokai-border bg-monokai-surface px-2 py-1 text-xs text-monokai-orange font-mono focus:outline-none"
                      >
                        <option value="day">按日截断</option>
                        <option value="week">按周截断</option>
                        <option value="month">按月截断</option>
                        <option value="quarter">按季截断</option>
                        <option value="year">按年截断</option>
                      </select>
                    )}

                    {dimensions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setDimensions(dimensions.filter((_, i) => i !== idx))}
                        className="text-monokai-comment hover:text-monokai-pink transition-colors p-1 cursor-pointer"
                        title="移除此维度"
                      >
                        <Trash2 className="h-3 w-3" />
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
                    if (remaining) {
                      setDimensions([...dimensions, { column: remaining.name }]);
                    }
                  }}
                  className="flex items-center justify-center gap-1 rounded border border-dashed border-monokai-border py-1 text-[11px] text-monokai-comment hover:border-monokai-orange hover:text-monokai-fg transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  <span>添加次级交叉维度</span>
                </button>
              )}
            </div>
          </div>

          {/* 2. Metrics Box */}
          <div className="flex flex-col gap-1.5 rounded border border-monokai-border/80 bg-monokai-bg/60 p-2.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-monokai-comment uppercase">
              <span>计算度量指标 (METRICS)</span>
              <button
                type="button"
                onClick={handleAddMetric}
                className="text-monokai-orange hover:underline font-mono text-[11px] flex items-center gap-0.5 cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                <span>新增指标</span>
              </button>
            </div>

            <div className="flex flex-col gap-1.5 max-h-[120px] overflow-y-auto custom-scrollbar pr-1">
              {metrics.map((m, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <select
                    value={m.agg}
                    onChange={e => {
                      const newM = [...metrics];
                      newM[idx].agg = e.target.value as any;
                      setMetrics(newM);
                    }}
                    className="w-24 rounded border border-monokai-border bg-monokai-surface px-1.5 py-1 text-xs text-monokai-cyan font-mono focus:outline-none"
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
                        const newM = [...metrics];
                        newM[idx].column = e.target.value;
                        setMetrics(newM);
                      }}
                      className="flex-1 rounded border border-monokai-border bg-monokai-surface px-2 py-1 text-xs text-monokai-fg focus:outline-none"
                    >
                      {(numericColumns.length > 0 ? numericColumns : schema.map(c => c.name)).map(col => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  )}

                  <input
                    type="text"
                    value={m.alias}
                    placeholder="别名"
                    onChange={e => {
                      const newM = [...metrics];
                      newM[idx].alias = e.target.value;
                      setMetrics(newM);
                    }}
                    className="w-24 rounded border border-monokai-border bg-monokai-surface px-2 py-1 text-xs text-monokai-fg font-mono focus:outline-none"
                  />

                  <button
                    type="button"
                    onClick={() => handleRemoveMetric(idx)}
                    className="text-monokai-comment hover:text-monokai-pink transition-colors p-1 cursor-pointer"
                    title="移除度量"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Filters & Limit Controls */}
          <div className="flex flex-col gap-1.5 rounded border border-monokai-border/80 bg-monokai-bg/60 p-2.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-monokai-comment uppercase">
              <span>过滤与排序控制</span>
              <button
                type="button"
                onClick={handleAddFilter}
                className="text-monokai-cyan hover:underline font-mono text-[11px] flex items-center gap-0.5 cursor-pointer"
              >
                <Filter className="h-3 w-3" />
                <span>加筛选</span>
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              {filters.map((f, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <select
                    value={f.column}
                    onChange={e => {
                      const newF = [...filters];
                      newF[idx].column = e.target.value;
                      setFilters(newF);
                    }}
                    className="w-24 rounded border border-monokai-border bg-monokai-surface px-1.5 py-1 text-xs text-monokai-fg focus:outline-none"
                  >
                    {schema.map(c => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>

                  <select
                    value={f.op}
                    onChange={e => {
                      const newF = [...filters];
                      newF[idx].op = e.target.value as any;
                      setFilters(newF);
                    }}
                    className="w-16 rounded border border-monokai-border bg-monokai-surface px-1 py-1 text-xs text-monokai-yellow font-mono focus:outline-none"
                  >
                    <option value="=">=</option>
                    <option value="!=">!=</option>
                    <option value=">">&gt;</option>
                    <option value="<">&lt;</option>
                    <option value="contains">包含</option>
                    <option value="not_null">非空</option>
                  </select>

                  {f.op !== 'not_null' && (
                    <input
                      type="text"
                      placeholder="值"
                      value={f.value}
                      onChange={e => {
                        const newF = [...filters];
                        newF[idx].value = e.target.value;
                        setFilters(newF);
                      }}
                      className="flex-1 rounded border border-monokai-border bg-monokai-surface px-2 py-1 text-xs text-monokai-fg focus:outline-none"
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => handleRemoveFilter(idx)}
                    className="text-monokai-comment hover:text-monokai-pink transition-colors p-1 cursor-pointer"
                    title="移除过滤条件"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}

              <div className="flex items-center gap-2 pt-1 border-t border-monokai-border/40">
                <span className="text-[10px] text-monokai-comment font-mono">截取行数:</span>
                <select
                  value={limit}
                  onChange={e => setLimit(Number(e.target.value))}
                  className="rounded border border-monokai-border bg-monokai-surface px-1.5 py-0.5 text-xs text-monokai-fg font-mono focus:outline-none"
                >
                  <option value={10}>Top 10</option>
                  <option value={25}>Top 25</option>
                  <option value={50}>Top 50</option>
                  <option value={100}>Top 100</option>
                  <option value={0}>全部行</option>
                </select>

                <span className="text-[10px] text-monokai-comment font-mono ml-auto">
                  耗时: {executionTimeMs} ms
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: Chart or Table */}
      <div className="flex-1 overflow-auto p-4 custom-scrollbar">
        {loading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-xs font-mono text-monokai-comment">
            <RefreshCw className="h-6 w-6 animate-spin text-monokai-orange" />
            <span>正在执行 DuckDB WASM 本地多维聚合…</span>
          </div>
        ) : viewMode === 'chart' ? (
          <AnalysisChartRenderer
            data={resultRows}
            config={chartConfig}
            height={360}
            onChartTypeChange={setChartType}
          />
        ) : (
          <div className="flex flex-col rounded-lg border border-monokai-border bg-monokai-surface overflow-hidden">
            <div className="max-h-[500px] overflow-auto custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-monokai-border bg-monokai-bg/80 sticky top-0 z-10">
                    {resultColumns.map((col, idx) => (
                      <th
                        key={col}
                        className="px-3.5 py-2.5 font-mono font-semibold text-monokai-fg border-r border-monokai-border/40 last:border-r-0"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-monokai-border/40 font-mono">
                  {resultRows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-monokai-bg/40 transition-colors">
                      {resultColumns.map((col, cIdx) => (
                        <td
                          key={cIdx}
                          className="px-3.5 py-2 text-monokai-fg/90 border-r border-monokai-border/30 last:border-r-0 whitespace-nowrap"
                        >
                          {row[col] !== null && row[col] !== undefined
                            ? typeof row[col] === 'number'
                              ? Number.isInteger(row[col])
                                ? row[col].toLocaleString()
                                : row[col].toFixed(2)
                              : String(row[col])
                            : <span className="text-monokai-comment italic">null</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-3.5 py-2 bg-monokai-bg border-t border-monokai-border text-[11px] text-monokai-comment font-mono flex items-center justify-between">
              <span>共展示 {resultRows.length} 条聚合结果行</span>
              <span>DuckDB Local WASM Kernel</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom SQL Drawer Bar */}
      <div className="border-t border-monokai-border bg-monokai-surface px-4 py-2 flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={() => setShowSqlDrawer(!showSqlDrawer)}
          className="flex items-center gap-1.5 text-monokai-comment hover:text-monokai-fg font-mono transition-colors cursor-pointer"
        >
          <Code className="h-3.5 w-3.5 text-monokai-cyan" />
          <span>{showSqlDrawer ? '收起底层 DuckDB SQL' : '查看底层 DuckDB SQL 语句'}</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopySql}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-monokai-bg border border-monokai-border text-monokai-comment hover:text-monokai-fg text-[11px] font-mono transition-colors cursor-pointer"
          >
            {copied ? <Check className="h-3 w-3 text-monokai-green" /> : <Copy className="h-3 w-3" />}
            <span>{copied ? '已复制' : '复制 SQL'}</span>
          </button>
        </div>
      </div>

      {/* Collapsible SQL Pre */}
      {showSqlDrawer && (
        <div className="border-t border-monokai-border bg-monokai-bg p-3 text-xs font-mono text-monokai-cyan max-h-40 overflow-y-auto custom-scrollbar select-text">
          <pre className="whitespace-pre-wrap leading-relaxed">{generatedSql}</pre>
        </div>
      )}
    </div>
  );
};
