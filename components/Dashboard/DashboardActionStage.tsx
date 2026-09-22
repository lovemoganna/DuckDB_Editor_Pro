import React, { useState, useEffect, useCallback } from 'react';
import {
  Table2,
  Terminal,
  BarChart3,
  UploadCloud,
  Play,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  Download,
  Trash2,
  ExternalLink,
  Eye,
  Columns3,
  Hash,
  BarChart2,
  TrendingUp,
  PieChart,
  X,
  ChevronRight,
  ArrowUpRight,
  Globe,
} from 'lucide-react';
import { Bar, Line, Pie } from 'react-chartjs-2';
import '../../utils/chartUtils';
import { duckDBService } from '../../services/duckdbService';
import { toastService } from '../../services/toastService';
import { Tab } from '../../types';

type ActiveTab = 'preview' | 'sql' | 'chart' | 'probe';

interface DashboardActionStageProps {
  selectedTable: string | null;
  tables: string[];
  onOpenInSqlEditor: (sql: string) => void;
  onNavigateToData: (tableName: string) => void;
  onNavigate: (tab: Tab) => void;
  externalSql?: string;
}

// ─── Inline Preview & Profile Tab ────────────────────────────────────────────

const PreviewTab: React.FC<{ tableName: string | null; onNavigateToData: (t: string) => void }> = ({
  tableName,
  onNavigateToData,
}) => {
  const [activeView, setActiveView] = useState<'data' | 'schema' | 'summarize'>('data');
  const [previewRows, setPreviewRows] = useState<any[] | null>(null);
  const [previewCols, setPreviewCols] = useState<string[]>([]);
  const [schemaCols, setSchemaCols] = useState<{ name: string; type: string }[] | null>(null);
  const [summarizeRows, setSummarizeRows] = useState<any[] | null>(null);
  const [summarizeCols, setSummarizeCols] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [lastTable, setLastTable] = useState<string | null>(null);

  // Reset when table changes
  if (tableName !== lastTable) {
    setLastTable(tableName);
    setPreviewRows(null);
    setSchemaCols(null);
    setSummarizeRows(null);
    setElapsedMs(null);
  }

  const loadData = useCallback(async (view: 'data' | 'schema' | 'summarize') => {
    if (!tableName) return;
    setLoading(true);
    const start = performance.now();
    try {
      if (view === 'data') {
        if (previewRows !== null) return;
        const rows = await duckDBService.query(`SELECT * FROM "${tableName}" LIMIT 50;`);
        const elapsed = +(performance.now() - start).toFixed(2);
        const cols = rows && rows.length > 0 ? Object.keys(rows[0]) : [];
        setPreviewRows(rows || []);
        setPreviewCols(cols);
        setElapsedMs(elapsed);
      } else if (view === 'schema') {
        if (schemaCols !== null) return;
        const schema = await duckDBService.getTableSchema(tableName);
        setSchemaCols(schema || []);
      } else {
        if (summarizeRows !== null) return;
        const rows = await duckDBService.query(`SUMMARIZE "${tableName}";`);
        const elapsed = +(performance.now() - start).toFixed(2);
        const cols = rows && rows.length > 0 ? Object.keys(rows[0]) : [];
        setSummarizeRows(rows || []);
        setSummarizeCols(cols);
        setElapsedMs(elapsed);
      }
    } catch (err: any) {
      toastService.error(`加载失败: ${err?.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  }, [tableName, previewRows, schemaCols, summarizeRows]);

  const handleViewChange = (view: 'data' | 'schema' | 'summarize') => {
    setActiveView(view);
    void loadData(view);
  };

  // Reset caches when table changes — data is loaded on demand by user click
  useEffect(() => {
    if (tableName) {
      setPreviewRows(null);
      setSchemaCols(null);
      setSummarizeRows(null);
      setElapsedMs(null);
      setActiveView('data');
    }
  }, [tableName]);

  if (!tableName) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-monokai-comment font-mono">
        <div className="text-center space-y-2">
          <Table2 className="h-8 w-8 mx-auto text-monokai-comment/40" />
          <p>← 从左侧选择一张数据表</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tab selector */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-monokai-border bg-monokai-bg/40 shrink-0">
        {(['data', 'schema', 'summarize'] as const).map(v => (
          <button
            key={v}
            type="button"
            onClick={() => handleViewChange(v)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-meta font-mono transition-colors cursor-pointer ${
              activeView === v
                ? 'bg-monokai-elevated text-monokai-cyan font-bold border border-monokai-border'
                : 'text-monokai-comment hover:text-monokai-fg'
            }`}
          >
            {v === 'data' && <Eye className="h-3 w-3" />}
            {v === 'schema' && <Columns3 className="h-3 w-3" />}
            {v === 'summarize' && <BarChart3 className="h-3 w-3" />}
            {v === 'data' ? '数据预览' : v === 'schema' ? '字段结构' : '统计画像'}
          </button>
        ))}

        <div className="flex-1" />

        {elapsedMs !== null && (
          <span className="font-mono text-2xs text-monokai-comment">
            耗时 {elapsedMs} ms
          </span>
        )}
        <button
          type="button"
          onClick={() => onNavigateToData(tableName)}
          title="在完整数据网格中打开"
          className="flex items-center gap-1 font-mono text-meta text-monokai-cyan hover:underline cursor-pointer"
        >
          <ArrowUpRight className="h-3 w-3" />
          完整视图
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto custom-scrollbar p-4">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-monokai-cyan" />
          </div>
        ) : activeView === 'data' ? (
          previewRows !== null && previewRows.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-xs text-monokai-comment font-mono">
              该表暂无数据行
            </div>
          ) : previewRows !== null ? (
            <div className="overflow-auto custom-scrollbar rounded-md border border-monokai-border bg-monokai-bg">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b border-monokai-border bg-monokai-elevated sticky top-0">
                    {previewCols.map(c => (
                      <th key={c} className="px-3 py-1.5 border-r border-monokai-border/40 last:border-r-0 whitespace-nowrap font-bold text-monokai-fg">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-monokai-border/30">
                  {previewRows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-monokai-elevated/50 transition-colors">
                      {previewCols.map(c => (
                        <td key={c} className="px-3 py-1.5 border-r border-monokai-border/20 last:border-r-0 whitespace-nowrap text-monokai-fg">
                          {row[c] === null ? (
                            <span className="text-monokai-comment italic">NULL</span>
                          ) : (
                            String(row[c])
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col h-48 items-center justify-center gap-3">
              <Table2 className="h-6 w-6 text-monokai-comment/40" />
              <p className="text-xs text-monokai-comment font-mono">点击按钮加载前 50 行数据</p>
              <button
                type="button"
                onClick={() => void loadData('data')}
                className="flex items-center gap-1.5 rounded-md bg-monokai-cyan px-3 py-1.5 text-xs font-bold text-monokai-bg hover:brightness-110 transition-all cursor-pointer"
              >
                <Play className="h-3 w-3 fill-current" />
                加载预览数据
              </button>
            </div>
          )
        ) : activeView === 'schema' ? (
          schemaCols !== null ? (
            <div className="rounded-md border border-monokai-border bg-monokai-bg overflow-hidden">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b border-monokai-border bg-monokai-elevated">
                    <th className="px-3 py-2 text-monokai-fg font-bold border-r border-monokai-border/40">字段名</th>
                    <th className="px-3 py-2 text-monokai-fg font-bold">数据类型</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-monokai-border/30">
                  {schemaCols.map((col, i) => (
                    <tr key={i} className="hover:bg-monokai-elevated/50 transition-colors">
                      <td className="px-3 py-1.5 border-r border-monokai-border/20 text-monokai-cyan font-semibold">
                        {col.name}
                      </td>
                      <td className="px-3 py-1.5 text-monokai-yellow">
                        {col.type}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null
        ) : (
          summarizeRows !== null ? (
            <div className="overflow-auto custom-scrollbar rounded-md border border-monokai-border bg-monokai-bg">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b border-monokai-border bg-monokai-elevated sticky top-0">
                    {summarizeCols.map(c => (
                      <th key={c} className="px-3 py-1.5 border-r border-monokai-border/40 last:border-r-0 whitespace-nowrap font-bold text-monokai-fg">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-monokai-border/30">
                  {summarizeRows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-monokai-elevated/50 transition-colors">
                      {summarizeCols.map(c => (
                        <td key={c} className="px-3 py-1.5 border-r border-monokai-border/20 last:border-r-0 whitespace-nowrap text-monokai-fg">
                          {row[c] === null ? (
                            <span className="text-monokai-comment italic">NULL</span>
                          ) : (
                            String(row[c])
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null
        )}
      </div>
    </div>
  );
};

// ─── SQL Runner Tab ───────────────────────────────────────────────────────────

const SqlTab: React.FC<{
  selectedTable: string | null;
  onOpenInSqlEditor: (sql: string) => void;
  externalSql?: string;
}> = ({ selectedTable, onOpenInSqlEditor, externalSql }) => {
  const defaultTable = selectedTable || 'my_table';
  const [sql, setSql] = useState(`SELECT * FROM "${defaultTable}" LIMIT 20;`);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<{ columns: string[]; rows: any[]; elapsedMs: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (selectedTable) {
      setSql(`SELECT * FROM "${selectedTable}" LIMIT 20;`);
      setResult(null);
      setError(null);
    }
  }, [selectedTable]);

  useEffect(() => {
    if (externalSql && externalSql.trim()) {
      setSql(externalSql);
      void runSql(externalSql);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalSql]);

  const quickTemplates = [
    { label: '前 20 行', sql: `SELECT * FROM "${defaultTable}" LIMIT 20;` },
    { label: '计行数', sql: `SELECT COUNT(*) as total_rows FROM "${defaultTable}";` },
    { label: 'SUMMARIZE', sql: `SUMMARIZE "${defaultTable}";` },
    { label: 'DESCRIBE', sql: `DESCRIBE "${defaultTable}";` },
    { label: 'EXPLAIN', sql: `EXPLAIN SELECT * FROM "${defaultTable}" LIMIT 100;` },
    { label: '全库表', sql: `SELECT table_name, column_count, estimated_size FROM duckdb_tables();` },
  ];

  const runSql = async (sqlToRun?: string) => {
    const q = (typeof sqlToRun === 'string' ? sqlToRun : sql).trim();
    if (!q) { toastService.warning('请输入 SQL 语句'); return; }
    setIsRunning(true);
    setError(null);
    const start = performance.now();
    try {
      const rows = await duckDBService.query(q);
      const elapsed = +(performance.now() - start).toFixed(2);
      const cols = rows && rows.length > 0 ? Object.keys(rows[0]) : [];
      setResult({ columns: cols, rows: rows || [], elapsedMs: elapsed });
    } catch (err: any) {
      setError(err?.message || 'SQL 执行失败');
      setResult(null);
    } finally {
      setIsRunning(false);
    }
  };

  const exportCsv = () => {
    if (!result || result.rows.length === 0) return;
    const headers = result.columns.join(',');
    const rows = result.rows.map(r =>
      result.columns.map(c => JSON.stringify(r[c] ?? '')).join(',')
    ).join('\n');
    const blob = new Blob([`${headers}\n${rows}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toastService.success('已导出 CSV');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Quick Template Chips */}
      <div className="flex items-center gap-1.5 px-4 py-2 border-b border-monokai-border bg-monokai-bg/40 shrink-0 overflow-x-auto custom-scrollbar">
        <span className="text-2xs font-mono text-monokai-comment shrink-0 mr-1">模板:</span>
        {quickTemplates.map((t, i) => (
          <button
            key={i}
            type="button"
            onClick={() => { setSql(t.sql); void runSql(t.sql); }}
            className="shrink-0 rounded-md border border-monokai-border/80 bg-monokai-bg px-2 py-0.5 text-2xs font-mono text-monokai-comment hover:text-monokai-fg hover:border-monokai-border-strong transition-colors cursor-pointer whitespace-nowrap"
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* SQL Input */}
      <div className="px-4 pt-3 shrink-0">
        <textarea
          value={sql}
          onChange={e => setSql(e.target.value)}
          onKeyDown={e => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault();
              void runSql();
            }
          }}
          rows={4}
          placeholder="输入任意 DuckDB SQL，按 Ctrl+Enter 运行…"
          className="w-full rounded-md border border-monokai-border bg-monokai-bg p-3 font-mono text-xs text-monokai-fg placeholder:text-monokai-comment/60 outline-none focus:border-monokai-border-strong transition-colors resize-y custom-scrollbar"
          aria-label="SQL 输入框"
        />
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void runSql()}
            disabled={isRunning}
            aria-label="运行 SQL"
            className="flex h-7 items-center gap-1.5 rounded-md bg-monokai-green px-3.5 text-xs font-bold text-monokai-bg hover:brightness-110 transition-all cursor-pointer disabled:opacity-50"
          >
            {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
            <span>运行 SQL</span>
          </button>
          <button
            type="button"
            onClick={() => { setSql(''); setResult(null); setError(null); }}
            className="flex h-7 items-center gap-1 rounded-md border border-monokai-border bg-monokai-bg px-2 text-xs text-monokai-comment hover:text-monokai-fg transition-colors cursor-pointer"
          >
            <Trash2 className="h-3 w-3" />
            <span>清空</span>
          </button>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(sql);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
              toastService.success('已复制 SQL');
            }}
            className="flex h-7 items-center gap-1 rounded-md border border-monokai-border bg-monokai-bg px-2 text-xs text-monokai-comment hover:text-monokai-fg transition-colors cursor-pointer"
          >
            {copied ? <Check className="h-3 w-3 text-monokai-green" /> : <Copy className="h-3 w-3" />}
            <span>复制</span>
          </button>
          {result && result.rows.length > 0 && (
            <button
              type="button"
              onClick={exportCsv}
              className="flex h-7 items-center gap-1 rounded-md border border-monokai-border bg-monokai-bg px-2.5 text-xs text-monokai-cyan hover:bg-monokai-cyan/10 transition-colors cursor-pointer"
            >
              <Download className="h-3 w-3" />
              <span>导出 CSV</span>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => onOpenInSqlEditor(sql)}
          className="flex items-center gap-1 text-xs font-mono text-monokai-cyan hover:underline cursor-pointer"
        >
          <span>在专业 SQL 编辑器中打开</span>
          <ExternalLink className="h-3 w-3" />
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto custom-scrollbar px-4 pb-4">
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-monokai-border bg-monokai-surface/60 p-3 text-xs text-monokai-pink font-mono mb-3">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="break-all">{error}</div>
          </div>
        )}

        {result && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-monokai-comment">
              <span className="text-monokai-green font-semibold">
                查询成功: 返回 {result.rows.length} 行数据
              </span>
              <span className="text-monokai-cyan font-bold">
                耗时: {result.elapsedMs} ms
              </span>
            </div>

            {result.rows.length === 0 ? (
              <div className="flex h-20 items-center justify-center text-xs font-mono text-monokai-comment border border-monokai-border rounded-md bg-monokai-bg">
                查询执行成功，但未返回任何数据行
              </div>
            ) : (
              <div className="overflow-auto border border-monokai-border rounded-md custom-scrollbar bg-monokai-bg">
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-monokai-border bg-monokai-elevated text-monokai-fg sticky top-0">
                      {result.columns.map(c => (
                        <th key={c} className="px-3 py-1.5 border-r border-monokai-border/40 last:border-r-0 whitespace-nowrap font-bold">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-monokai-border/30">
                    {result.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-monokai-elevated/50 transition-colors">
                        {result.columns.map(c => (
                          <td key={c} className="px-3 py-1.5 border-r border-monokai-border/20 last:border-r-0 whitespace-nowrap text-monokai-fg">
                            {row[c] === null ? <span className="text-monokai-comment italic">NULL</span> : String(row[c])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Chart Builder Tab ────────────────────────────────────────────────────────

const ChartTab: React.FC<{ selectedTable: string | null; tables: string[] }> = ({
  selectedTable,
  tables,
}) => {
  const [table, setTable] = useState(selectedTable || tables[0] || '');
  const [columns, setColumns] = useState<{ name: string; type: string }[]>([]);
  const [xCol, setXCol] = useState('');
  const [yCol, setYCol] = useState('');
  const [aggFunc, setAggFunc] = useState<'COUNT' | 'SUM' | 'AVG'>('COUNT');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>('bar');
  const [loadingCols, setLoadingCols] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [chartData, setChartData] = useState<any | null>(null);
  const [executedSql, setExecutedSql] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchColumns = useCallback(async (tbl: string) => {
    setTable(tbl);
    setLoadingCols(true);
    setChartData(null);
    setError(null);
    try {
      const cols = await duckDBService.getTableSchema(tbl);
      setColumns(cols || []);
      if (cols && cols.length > 0) {
        setXCol(cols[0].name);
        const numCol = cols.find(c => {
          const t = c.type.toUpperCase();
          return t.includes('INT') || t.includes('FLOAT') || t.includes('DOUBLE') || t.includes('DECIMAL');
        });
        setYCol(numCol ? numCol.name : cols[0].name);
      }
    } catch (err: any) {
      toastService.error(`获取字段失败: ${err?.message || '未知错误'}`);
    } finally {
      setLoadingCols(false);
    }
  }, []);

  useEffect(() => {
    if (selectedTable && tables.includes(selectedTable)) {
      void fetchColumns(selectedTable);
    } else if (tables.length > 0) {
      void fetchColumns(tables[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTable, tables]);

  const generateChart = async () => {
    if (!table) { toastService.warning('请先选择一张数据表'); return; }
    setIsGenerating(true);
    setError(null);
    const start = performance.now();

    const querySql = aggFunc === 'COUNT'
      ? `SELECT "${xCol || '1'}" as dimension, COUNT(*) as metric FROM "${table}" GROUP BY 1 ORDER BY metric DESC LIMIT 15;`
      : `SELECT "${xCol || '1'}" as dimension, ${aggFunc}("${yCol || '1'}") as metric FROM "${table}" GROUP BY 1 ORDER BY metric DESC LIMIT 15;`;

    setExecutedSql(querySql);
    try {
      const rows = await duckDBService.query(querySql);
      const elapsed = +(performance.now() - start).toFixed(2);
      setElapsedMs(elapsed);
      if (!rows || rows.length === 0) { setError('查询无数据，无法生成图表'); setChartData(null); return; }

      const labels = rows.map(r => String(r.dimension ?? ''));
      const values = rows.map(r => Number(r.metric ?? 0));
      const colors = ['#66d9ef','#a6e22e','#e6db74','#fd971f','#f92672','#38bdf8','#4ade80','#facc15','#fb923c','#f43f5e'];

      setChartData({
        labels,
        datasets: [{
          label: `${aggFunc}(${aggFunc === 'COUNT' ? '*' : yCol})`,
          data: values,
          backgroundColor: chartType === 'pie' ? colors.slice(0, labels.length) : 'rgba(102,217,239,0.4)',
          borderColor: chartType === 'pie' ? '#1e1e1e' : '#66d9ef',
          borderWidth: 1.5,
        }],
      });
    } catch (err: any) {
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
      legend: { display: chartType === 'pie', labels: { color: '#f8f8f2', font: { family: 'monospace', size: 10 } } },
      tooltip: { backgroundColor: '#2d2a2e', borderColor: '#403e41', borderWidth: 1, titleColor: '#f8f8f2', bodyColor: '#66d9ef' },
      datalabels: { display: false },
    },
    scales: chartType === 'pie' ? {} : {
      x: { ticks: { color: '#90908a', font: { family: 'monospace', size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
      y: { ticks: { color: '#90908a', font: { family: 'monospace', size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' }, suggestedMin: 0 },
    },
  };

  if (tables.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-monokai-comment font-mono">
        请先导入数据表以使用图表分析
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto custom-scrollbar p-4 space-y-4">
      {/* Controls */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {/* Table */}
        <div className="sm:col-span-1">
          <label className="block text-2xs font-mono text-monokai-comment mb-1">数据表</label>
          <select
            value={table}
            onChange={e => void fetchColumns(e.target.value)}
            className="w-full h-7 rounded-md border border-monokai-border bg-monokai-bg px-2 font-mono text-xs text-monokai-fg outline-none focus:border-monokai-border-strong"
          >
            {tables.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {/* X Axis */}
        <div className="sm:col-span-1">
          <label className="block text-2xs font-mono text-monokai-comment mb-1">维度 (X)</label>
          {columns.length === 0 ? (
            <button
              type="button"
              onClick={() => void fetchColumns(table)}
              disabled={loadingCols}
              className="w-full h-7 rounded-md border border-monokai-border bg-monokai-bg px-2 font-mono text-meta text-monokai-fg hover:border-monokai-border-strong cursor-pointer"
            >
              {loadingCols ? '读取…' : '点击读取字段'}
            </button>
          ) : (
            <select value={xCol} onChange={e => setXCol(e.target.value)}
              className="w-full h-7 rounded-md border border-monokai-border bg-monokai-bg px-2 font-mono text-xs text-monokai-fg outline-none focus:border-monokai-border-strong">
              {columns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          )}
        </div>
        {/* Agg */}
        <div className="sm:col-span-1">
          <label className="block text-2xs font-mono text-monokai-comment mb-1">聚合</label>
          <select value={aggFunc} onChange={e => setAggFunc(e.target.value as any)}
            className="w-full h-7 rounded-md border border-monokai-border bg-monokai-bg px-2 font-mono text-xs text-monokai-fg outline-none focus:border-monokai-border-strong">
            <option value="COUNT">COUNT</option>
            <option value="SUM">SUM</option>
            <option value="AVG">AVG</option>
          </select>
        </div>
        {/* Y Axis */}
        <div className="sm:col-span-1">
          <label className="block text-2xs font-mono text-monokai-comment mb-1">度量 (Y)</label>
          <select disabled={aggFunc === 'COUNT' || columns.length === 0} value={yCol} onChange={e => setYCol(e.target.value)}
            className="w-full h-7 rounded-md border border-monokai-border bg-monokai-bg px-2 font-mono text-xs text-monokai-fg outline-none focus:border-monokai-border-strong disabled:opacity-40">
            {columns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        {/* Chart Type + Generate */}
        <div className="sm:col-span-1">
          <label className="block text-2xs font-mono text-monokai-comment mb-1">图表</label>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center rounded-md border border-monokai-border bg-monokai-bg p-0.5 h-7">
              {(['bar', 'line', 'pie'] as const).map(ct => (
                <button key={ct} type="button" onClick={() => setChartType(ct)}
                  className={`px-1.5 py-0.5 rounded-md cursor-pointer ${chartType === ct ? 'bg-monokai-surface text-monokai-cyan' : 'text-monokai-comment'}`}
                  title={ct === 'bar' ? '柱状图' : ct === 'line' ? '折线图' : '饼图'}
                >
                  {ct === 'bar' && <BarChart2 className="h-3.5 w-3.5" />}
                  {ct === 'line' && <TrendingUp className="h-3.5 w-3.5" />}
                  {ct === 'pie' && <PieChart className="h-3.5 w-3.5" />}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void generateChart()}
              disabled={isGenerating}
              className="flex-1 h-7 flex items-center justify-center gap-1 rounded-md bg-monokai-cyan px-2 text-xs font-bold text-monokai-bg hover:brightness-110 transition-all cursor-pointer disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 fill-current" />}
              生成
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-monokai-border bg-monokai-elevated p-2.5 text-xs text-monokai-pink font-mono">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {chartData ? (
        <div className="space-y-2 border border-monokai-border rounded-md bg-monokai-bg p-3">
          <div className="flex items-center justify-between text-2xs font-mono text-monokai-comment">
            <span className="truncate max-w-[60%] text-monokai-fg/70">{executedSql}</span>
            {elapsedMs !== null && <span className="text-monokai-cyan font-bold shrink-0">耗时: {elapsedMs} ms</span>}
          </div>
          <div className="h-64 w-full">
            {chartType === 'bar' && <Bar data={chartData} options={chartOptions as any} />}
            {chartType === 'line' && <Line data={chartData} options={chartOptions as any} />}
            {chartType === 'pie' && <Pie data={chartData} options={chartOptions as any} />}
          </div>
        </div>
      ) : (
        <div className="flex h-48 flex-col items-center justify-center rounded-md border border-dashed border-monokai-border bg-monokai-bg/40 text-center text-xs text-monokai-comment font-mono gap-2">
          <BarChart3 className="h-7 w-7 text-monokai-comment/40" />
          <span>选择维度与度量，点击"生成"即时可视化</span>
        </div>
      )}
    </div>
  );
};

// ─── File Probe Tab ───────────────────────────────────────────────────────────

const ProbeTab: React.FC<{ onRefreshTables: () => void }> = ({ onRefreshTables }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [probeMode, setProbeMode] = useState<'drop' | 'url'>('drop');
  const [urlInput, setUrlInput] = useState('');
  const [isProbing, setIsProbing] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [probeResult, setProbeResult] = useState<{
    name: string; columns: { name: string; type: string }[]; previewRows: any[]; selectSource: string; elapsedMs: number;
  } | null>(null);
  const [isMaterializing, setIsMaterializing] = useState(false);
  const [materializeTableName, setMaterializeTableName] = useState('');
  const [showMaterializeInput, setShowMaterializeInput] = useState(false);

  const handleProbeFile = async (file: File) => {
    setIsProbing(true);
    setProbeResult(null);
    try {
      const res = await duckDBService.probeFile(file);
      setProbeResult({ name: res.name, columns: res.columns, previewRows: res.previewRows, selectSource: res.selectSource, elapsedMs: res.elapsedMs });
      const cleanName = file.name.split('.')[0].replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase() || 'probed_table';
      setMaterializeTableName(cleanName);
      setShowMaterializeInput(false);
      toastService.success(`已探测文件："${file.name}" (耗时 ${res.elapsedMs}ms)`);
    } catch (err: any) {
      toastService.error(`文件探测失败: ${err?.message || '无法解析文件'}`);
    } finally {
      setIsProbing(false);
    }
  };

  const handleMaterialize = async () => {
    if (!probeResult || !materializeTableName.trim()) return;
    setIsMaterializing(true);
    try {
      await duckDBService.query(`CREATE TABLE IF NOT EXISTS "${materializeTableName.trim()}" AS ${probeResult.selectSource};`);
      await onRefreshTables();
      toastService.success(`已物化为表："${materializeTableName.trim()}"`);
      setProbeResult(null);
      setShowMaterializeInput(false);
    } catch (err: any) {
      toastService.error(`物化失败: ${err?.message || '未知错误'}`);
    } finally {
      setIsMaterializing(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-auto custom-scrollbar p-4 space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".parquet,.csv,.tsv,.json,.arrow"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) void handleProbeFile(f);
          e.target.value = '';
        }}
      />

      {/* Mode Selector */}
      <div className="flex items-center gap-1 rounded-md border border-monokai-border bg-monokai-bg p-0.5 w-fit">
        {(['drop', 'url'] as const).map(m => (
          <button key={m} type="button" onClick={() => setProbeMode(m)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-meta font-mono transition-colors cursor-pointer ${
              probeMode === m ? 'bg-monokai-surface text-monokai-cyan font-bold' : 'text-monokai-comment hover:text-monokai-fg'
            }`}>
            {m === 'drop' ? <UploadCloud className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
            {m === 'drop' ? '本地文件' : 'URL 探查'}
          </button>
        ))}
      </div>

      {probeMode === 'drop' ? (
        <div
          role="button"
          tabIndex={0}
          onDragOver={e => { e.preventDefault(); setIsDraggingOver(true); }}
          onDragLeave={() => setIsDraggingOver(false)}
          onDrop={e => {
            e.preventDefault();
            setIsDraggingOver(false);
            const file = e.dataTransfer.files[0];
            if (file) void handleProbeFile(file);
          }}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
          className={`flex min-h-[120px] flex-col items-center justify-center rounded-md border border-dashed p-5 text-center cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-border-strong ${
            isDraggingOver
              ? 'border-monokai-border-strong bg-monokai-elevated text-monokai-fg'
              : 'border-monokai-border bg-monokai-bg/60 hover:border-monokai-border-strong hover:bg-monokai-elevated text-monokai-comment'
          }`}
        >
          {isProbing ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-monokai-fg" />
              <span className="text-xs font-mono text-monokai-fg">正在探测文件…</span>
            </div>
          ) : (
            <>
              <UploadCloud className="h-6 w-6 mb-2 text-monokai-comment" />
              <p className="text-xs font-bold text-monokai-fg">
                {isDraggingOver ? '释放文件即时探查' : '拖入文件即时探查（不写入数据库）'}
              </p>
              <p className="text-meta font-mono mt-1">CSV · Parquet · JSON · Arrow</p>
              <p className="text-2xs font-mono mt-0.5 text-monokai-comment">零拷贝 · 无副作用 · 满意后一键物化</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              placeholder="输入 Parquet / CSV 的 HTTPS URL…"
              className="flex-1 h-8 rounded-md border border-monokai-border bg-monokai-bg px-3 font-mono text-xs text-monokai-fg outline-none focus:border-monokai-border-strong placeholder:text-monokai-comment"
            />
            <button
              type="button"
              disabled={isProbing || !urlInput.trim()}
              onClick={async () => {
                if (!urlInput.trim()) return;
                setIsProbing(true);
                setProbeResult(null);
                try {
                  const ext = urlInput.split('?')[0].split('.').pop()?.toLowerCase();
                  const fn = ext === 'parquet' ? 'read_parquet' : 'read_csv_auto';
                  const sql = `SELECT * FROM ${fn}('${urlInput.trim()}') LIMIT 50;`;
                  const rows = await duckDBService.query(sql);
                  const cols = rows && rows.length > 0 ? Object.keys(rows[0]).map(n => ({ name: n, type: '' })) : [];
                  setProbeResult({ name: urlInput.split('/').pop() || 'url_probe', columns: cols, previewRows: rows || [], selectSource: `${fn}('${urlInput.trim()}')`, elapsedMs: 0 });
                  setMaterializeTableName('url_data');
                  toastService.success('URL 文件探测成功');
                } catch (err: any) {
                  toastService.error(`URL 探测失败: ${err?.message}`);
                } finally {
                  setIsProbing(false);
                }
              }}
              className="flex h-8 items-center gap-1.5 rounded-md bg-monokai-cyan px-3 text-xs font-bold text-monokai-bg hover:brightness-110 transition-all cursor-pointer disabled:opacity-50"
            >
              {isProbing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
              探查
            </button>
          </div>
        </div>
      )}

      {/* Probe Result */}
      {probeResult && (
        <div className="space-y-3 border border-monokai-border rounded-md p-3 bg-monokai-surface">
          {/* Meta */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-meta font-bold text-monokai-fg">{probeResult.name}</span>
              <span className="font-mono text-2xs text-monokai-comment bg-monokai-bg border border-monokai-border px-1.5 py-0.5 rounded-md">
                {probeResult.columns.length} 字段 · {probeResult.previewRows.length} 行预览
              </span>
            </div>
            <button
              type="button"
              onClick={() => setProbeResult(null)}
              className="p-0.5 text-monokai-comment hover:text-monokai-fg cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Materialize Action */}
          <div className="flex items-center gap-2 flex-wrap">
            {showMaterializeInput ? (
              <>
                <input
                  value={materializeTableName}
                  onChange={e => setMaterializeTableName(e.target.value)}
                  placeholder="表名"
                  className="h-7 rounded-md border border-monokai-border bg-monokai-bg px-2 font-mono text-xs text-monokai-fg outline-none focus:border-monokai-border-strong w-40"
                />
                <button
                  type="button"
                  onClick={() => void handleMaterialize()}
                  disabled={isMaterializing || !materializeTableName.trim()}
                  className="flex h-7 items-center gap-1.5 rounded-md bg-monokai-green px-3 text-xs font-bold text-monokai-bg hover:brightness-110 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isMaterializing ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  物化为真实表
                </button>
                <button type="button" onClick={() => setShowMaterializeInput(false)}
                  className="text-xs text-monokai-comment hover:text-monokai-fg cursor-pointer">取消</button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setShowMaterializeInput(true)}
                className="flex h-7 items-center gap-1.5 rounded-md border border-monokai-border bg-monokai-surface px-3 text-xs font-semibold text-monokai-fg hover:border-monokai-border-strong hover:bg-monokai-elevated transition-all cursor-pointer"
              >
                <ChevronRight className="h-3.5 w-3.5 text-monokai-comment" />
                一键物化为真实 DuckDB 表
              </button>
            )}
          </div>

          {/* Preview Table */}
          {probeResult.previewRows.length > 0 && (
            <div className="overflow-auto custom-scrollbar max-h-52 border border-monokai-border rounded-md bg-monokai-bg">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b border-monokai-border bg-monokai-elevated sticky top-0">
                    {probeResult.columns.map(c => (
                      <th key={c.name} className="px-3 py-1.5 border-r border-monokai-border/40 last:border-r-0 whitespace-nowrap font-bold text-monokai-fg">
                        {c.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-monokai-border/30">
                  {probeResult.previewRows.slice(0, 30).map((row, i) => (
                    <tr key={i} className="hover:bg-monokai-elevated/50 transition-colors">
                      {probeResult.columns.map(c => (
                        <td key={c.name} className="px-3 py-1.5 border-r border-monokai-border/20 last:border-r-0 whitespace-nowrap text-monokai-fg">
                          {String(row[c.name] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main DashboardActionStage ────────────────────────────────────────────────

export const DashboardActionStage: React.FC<DashboardActionStageProps> = ({
  selectedTable,
  tables,
  onOpenInSqlEditor,
  onNavigateToData,
  onNavigate,
  externalSql,
}) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('sql');

  // When external SQL arrives, switch to SQL tab
  useEffect(() => {
    if (externalSql && externalSql.trim()) {
      setActiveTab('sql');
    }
  }, [externalSql]);

  const tabs: { id: ActiveTab; label: string; icon: React.ReactNode; color: string }[] = [
    { id: 'preview', label: '数据探查', icon: <Eye className="h-3.5 w-3.5" />, color: 'text-monokai-cyan' },
    { id: 'sql', label: '即席 SQL', icon: <Terminal className="h-3.5 w-3.5" />, color: 'text-monokai-green' },
    { id: 'chart', label: '智能图表', icon: <BarChart3 className="h-3.5 w-3.5" />, color: 'text-monokai-orange' },
    { id: 'probe', label: '文件探查', icon: <UploadCloud className="h-3.5 w-3.5" />, color: 'text-monokai-yellow' },
  ];

  const noTablesYet = tables.length === 0 && activeTab !== 'probe';

  return (
    <div className="flex flex-col h-full bg-monokai-bg font-sans overflow-hidden">
      {/* Standard Unified Tab Bar */}
      <div className="flex h-10 items-center justify-between border-b border-monokai-border bg-monokai-sidebar px-3 shrink-0 overflow-x-auto select-none">
        <div className="flex items-center gap-1">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all cursor-pointer ${
                  isActive
                    ? 'bg-monokai-accent/15 text-monokai-accent border border-monokai-accent/30 shadow-xs font-semibold'
                    : 'text-monokai-fg-muted hover:text-monokai-fg hover:bg-monokai-surface/80 border border-transparent'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right: table context badge */}
        <div className="flex items-center gap-2 px-2 shrink-0">
          {selectedTable && (
            <span className="flex items-center gap-1.5 font-mono text-meta text-monokai-comment bg-monokai-surface/60 border border-monokai-border/80 px-2 py-0.5 rounded">
              <Table2 className="h-3 w-3 text-monokai-cyan" />
              <span className="text-monokai-cyan font-semibold">{selectedTable}</span>
            </span>
          )}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {noTablesYet ? (
          <div className="flex h-full items-center justify-center text-xs text-monokai-comment font-mono">
            <div className="text-center space-y-3">
              <Table2 className="h-10 w-10 mx-auto text-monokai-comment/30" />
              <p className="text-sm font-bold text-monokai-fg">暂无数据表</p>
              <p>从左侧面板导入文件或装载示例数据集</p>
              <button
                type="button"
                onClick={() => setActiveTab('probe')}
                className="flex items-center gap-1.5 mx-auto rounded-md border border-monokai-border bg-monokai-surface px-3 py-1.5 text-xs font-semibold text-monokai-fg hover:border-monokai-border-strong hover:bg-monokai-elevated transition-all cursor-pointer"
              >
                <UploadCloud className="h-3.5 w-3.5 text-monokai-comment" />
                打开文件探查台
              </button>
            </div>
          </div>
        ) : activeTab === 'preview' ? (
          <PreviewTab tableName={selectedTable} onNavigateToData={onNavigateToData} />
        ) : activeTab === 'sql' ? (
          <SqlTab selectedTable={selectedTable} onOpenInSqlEditor={onOpenInSqlEditor} externalSql={externalSql} />
        ) : activeTab === 'chart' ? (
          <ChartTab selectedTable={selectedTable} tables={tables} />
        ) : (
          <ProbeTab onRefreshTables={() => Promise.resolve()} />
        )}
      </div>
    </div>
  );
};
