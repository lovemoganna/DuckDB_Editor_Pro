import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  LineChart,
  PieChart,
  Play,
  Loader2,
  TrendingUp,
  BarChart2,
  Layers,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { Bar, Line, Pie } from 'react-chartjs-2';
import '../../utils/chartUtils';
import { duckDBService } from '../../services/duckdbService';
import { toastService } from '../../services/toastService';

interface InstantDataChartBuilderProps {
  currentTable: string | null;
  tables: string[];
}

export const InstantDataChartBuilder: React.FC<InstantDataChartBuilderProps> = ({
  currentTable,
  tables,
}) => {
  const [selectedTable, setSelectedTable] = useState<string>(
    currentTable || tables[0] || '',
  );
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>('bar');
  const [columns, setColumns] = useState<Array<{ name: string; type: string }>>([]);
  const [xCol, setXCol] = useState<string>('');
  const [yCol, setYCol] = useState<string>('');
  const [aggFunc, setAggFunc] = useState<'COUNT' | 'SUM' | 'AVG'>('COUNT');
  const [loadingCols, setLoadingCols] = useState(false);

  // Chart rendering state
  const [isGenerating, setIsGenerating] = useState(false);
  const [chartData, setChartData] = useState<any | null>(null);
  const [executedSql, setExecutedSql] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch columns on demand when user clicks or selects table
  const handleFetchColumns = async (tbl: string) => {
    setSelectedTable(tbl);
    setLoadingCols(true);
    setChartData(null);
    setError(null);
    try {
      const cols = await duckDBService.getTableSchema(tbl);
      setColumns(cols || []);
      if (cols && cols.length > 0) {
        setXCol(cols[0].name);
        // Find first numeric column for Y, or default to first
        const numCol = cols.find(c => {
          const t = c.type.toUpperCase();
          return t.includes('INT') || t.includes('FLOAT') || t.includes('DOUBLE') || t.includes('DECIMAL');
        });
        setYCol(numCol ? numCol.name : cols[0].name);
      }
    } catch (err: any) {
      console.error('Failed to get columns', err);
      toastService.error(`获取字段失败: ${err?.message || '未知异常'}`);
    } finally {
      setLoadingCols(false);
    }
  };

  // Auto-sync table selection when currentTable or tables change
  useEffect(() => {
    if (tables.length === 0) return;
    const target = currentTable && tables.includes(currentTable) ? currentTable : tables[0];
    if (target && (target !== selectedTable || columns.length === 0)) {
      void handleFetchColumns(target);
    }
  }, [currentTable, tables]);

  const handleGenerateChart = async () => {
    if (!selectedTable) {
      toastService.warning('请先选择一张数据表');
      return;
    }

    setIsGenerating(true);
    setError(null);
    const start = performance.now();

    // Construct honest aggregation query
    let querySql = '';
    if (aggFunc === 'COUNT') {
      querySql = `SELECT "${xCol || '1'}" as dimension, COUNT(*) as metric FROM "${selectedTable}" GROUP BY 1 ORDER BY metric DESC LIMIT 15;`;
    } else {
      querySql = `SELECT "${xCol || '1'}" as dimension, ${aggFunc}("${yCol || '1'}") as metric FROM "${selectedTable}" GROUP BY 1 ORDER BY metric DESC LIMIT 15;`;
    }

    setExecutedSql(querySql);

    try {
      const rows = await duckDBService.query(querySql);
      const elapsed = +(performance.now() - start).toFixed(2);
      setElapsedMs(elapsed);

      if (!rows || rows.length === 0) {
        setError('查询未返回任何数据行，无法生成图表');
        setChartData(null);
        return;
      }

      const labels = rows.map(r => String(r.dimension ?? '空值'));
      const values = rows.map(r => Number(r.metric ?? 0));

      const colors = [
        '#66d9ef',
        '#a6e22e',
        '#e6db74',
        '#fd971f',
        '#f92672',
        '#38bdf8',
        '#4ade80',
        '#facc15',
        '#fb923c',
        '#f43f5e',
        '#0284c7',
        '#10b981',
      ];

      setChartData({
        labels,
        datasets: [
          {
            label: `${aggFunc}(${aggFunc === 'COUNT' ? '*' : yCol})`,
            data: values,
            backgroundColor: chartType === 'pie' ? colors.slice(0, labels.length) : 'rgba(102, 217, 239, 0.4)',
            borderColor: chartType === 'pie' ? '#1e1e1e' : '#66d9ef',
            borderWidth: 1.5,
          },
        ],
      });
    } catch (err: any) {
      console.error('Failed to generate chart', err);
      setError(err?.message || '图表数据查询失败');
      setChartData(null);
    } finally {
      setIsGenerating(false);
    }
  };


  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: chartType === 'pie',
        labels: { color: '#f8f8f2', font: { family: 'monospace', size: 10 } },
      },
      tooltip: {
        backgroundColor: '#2d2a2e',
        borderColor: '#403e41',
        borderWidth: 1,
        titleColor: '#f8f8f2',
        bodyColor: '#66d9ef',
      },
      datalabels: { display: false },
    },
    scales: chartType === 'pie' ? {} : {
      x: {
        ticks: { color: '#90908a', font: { family: 'monospace', size: 10 } },
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
      },
      y: {
        ticks: { color: '#90908a', font: { family: 'monospace', size: 10 } },
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        suggestedMin: 0,
      },
    },
  };

  if (tables.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col rounded-md border border-monokai-border bg-monokai-surface overflow-hidden font-sans shadow-xs">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-monokai-border bg-monokai-elevated">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-monokai-cyan" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-monokai-fg">
            真实数据即时图表生成器 (Live Data Visualizer)
          </h3>
        </div>
        <span className="font-mono text-2xs text-monokai-comment">
          基于当前 DuckDB 数据表的真实聚合图表
        </span>
      </div>

      <div className="p-4 space-y-3.5">
        {/* Controls Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
          {/* 1. Table Selector */}
          <div>
            <label className="block text-2xs font-mono text-monokai-comment mb-1">目标数据表</label>
            <select
              value={selectedTable}
              onChange={e => void handleFetchColumns(e.target.value)}
              className="w-full h-7 rounded-md border border-monokai-border bg-monokai-bg px-2 font-mono text-xs text-monokai-fg outline-none focus:border-monokai-border-strong"
            >
              {tables.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* 2. Dimension (X axis) */}
          <div>
            <label className="block text-2xs font-mono text-monokai-comment mb-1">维度 (X 轴)</label>
            {columns.length === 0 ? (
              <button
                type="button"
                onClick={() => void handleFetchColumns(selectedTable || tables[0])}
                disabled={loadingCols}
                className="w-full h-7 rounded-md border border-monokai-border bg-monokai-bg px-2 font-mono text-meta text-monokai-fg hover:border-monokai-border-strong cursor-pointer"
              >
                {loadingCols ? '读取字段…' : '点击读取字段'}
              </button>
            ) : (
              <select
                value={xCol}
                onChange={e => setXCol(e.target.value)}
                className="w-full h-7 rounded-md border border-monokai-border bg-monokai-bg px-2 font-mono text-xs text-monokai-fg outline-none focus:border-monokai-border-strong"
              >
                {columns.map(c => (
                  <option key={c.name} value={c.name}>{c.name} ({c.type})</option>
                ))}
              </select>
            )}
          </div>

          {/* 3. Aggregation Function */}
          <div>
            <label className="block text-2xs font-mono text-monokai-comment mb-1">聚合方式</label>
            <select
              value={aggFunc}
              onChange={e => setAggFunc(e.target.value as any)}
              className="w-full h-7 rounded-md border border-monokai-border bg-monokai-bg px-2 font-mono text-xs text-monokai-fg outline-none focus:border-monokai-border-strong"
            >
              <option value="COUNT">COUNT (计数)</option>
              <option value="SUM">SUM (求和)</option>
              <option value="AVG">AVG (均值)</option>
            </select>
          </div>

          {/* 4. Measure (Y axis) */}
          <div>
            <label className="block text-2xs font-mono text-monokai-comment mb-1">度量字段 (Y 轴)</label>
            <select
              disabled={aggFunc === 'COUNT' || columns.length === 0}
              value={yCol}
              onChange={e => setYCol(e.target.value)}
              className="w-full h-7 rounded-md border border-monokai-border bg-monokai-bg px-2 font-mono text-xs text-monokai-fg outline-none focus:border-monokai-border-strong disabled:opacity-40"
            >
              {columns.map(c => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* 5. Chart Type & Run Button */}
          <div>
            <label className="block text-2xs font-mono text-monokai-comment mb-1">图表形态</label>
            <div className="flex items-center gap-1.5">
              <div className="flex items-center rounded-md border border-monokai-border bg-monokai-bg p-0.5 h-7">
                <button
                  type="button"
                  onClick={() => setChartType('bar')}
                  className={`px-1.5 py-0.5 rounded-md cursor-pointer ${chartType === 'bar' ? 'bg-monokai-surface text-monokai-cyan' : 'text-monokai-comment'}`}
                  title="柱状图"
                >
                  <BarChart2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setChartType('line')}
                  className={`px-1.5 py-0.5 rounded-md cursor-pointer ${chartType === 'line' ? 'bg-monokai-surface text-monokai-cyan' : 'text-monokai-comment'}`}
                  title="折线图"
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setChartType('pie')}
                  className={`px-1.5 py-0.5 rounded-md cursor-pointer ${chartType === 'pie' ? 'bg-monokai-surface text-monokai-cyan' : 'text-monokai-comment'}`}
                  title="饼图"
                >
                  <PieChart className="h-3.5 w-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleGenerateChart}
                disabled={isGenerating}
                className="flex-1 h-7 flex items-center justify-center gap-1 rounded-md bg-monokai-cyan px-2 text-xs font-bold text-monokai-bg hover:brightness-110 transition-all cursor-pointer disabled:opacity-50"
              >
                {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 fill-current" />}
                <span>生成</span>
              </button>
            </div>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="flex items-center gap-2 rounded-md border border-monokai-border bg-monokai-surface/60 p-2.5 text-xs text-monokai-pink font-mono">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Chart View Area */}
        {chartData ? (
          <div className="space-y-2 border border-monokai-border rounded-md bg-monokai-bg p-3">
            <div className="flex items-center justify-between text-xs font-mono text-monokai-comment">
              <span className="truncate max-w-md text-monokai-fg">SQL: {executedSql}</span>
              {elapsedMs !== null && (
                <span className="text-monokai-cyan font-bold shrink-0 ml-2">耗时: {elapsedMs} ms</span>
              )}
            </div>

            <div className="h-56 w-full">
              {chartType === 'bar' && <Bar data={chartData} options={chartOptions as any} />}
              {chartType === 'line' && <Line data={chartData} options={chartOptions as any} />}
              {chartType === 'pie' && <Pie data={chartData} options={chartOptions as any} />}
            </div>
          </div>
        ) : (
          <div className="flex h-36 flex-col items-center justify-center rounded-md border border-dashed border-monokai-border bg-monokai-bg/40 text-center text-xs text-monokai-comment font-mono">
            <BarChart3 className="h-6 w-6 mb-1 text-monokai-comment/60" />
            <span>选择维度与度量，点击“生成”即可将表中真实数据即时绘制为图表</span>
          </div>
        )}
      </div>
    </div>
  );
};
