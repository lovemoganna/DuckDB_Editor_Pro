import React, { useEffect, useState, useRef, useMemo } from 'react';
import { duckDBService } from '../services/duckdbService';
import { dbService } from '../services/dbService';
import { SavedQuery, ChartConfig, Tab } from '../types';
import { transformDataForChart, getChartOptions } from '../utils/chartUtils';
import { formatCellValue } from '../utils/typeFormatter';
import { Bar, Line, Pie, Doughnut, Scatter } from 'react-chartjs-2';
import {
  RefreshCw,
  AlertCircle,
  Maximize2,
  BarChart2,
  TrendingUp,
  PieChart,
  Target,
  Table2,
  MoreVertical,
  Download,
  Trash2,
  Code2,
  GripVertical,
  X,
  Sparkles,
  Zap,
  Activity,
  Layers,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Grid,
} from 'lucide-react';
import { exportCsv } from '../utils/sqlExporter';
import { useSqlEditorStore } from '../hooks/store/useSqlEditorStore';
import { toastService } from '../services/toastService';
import { PRESET_WIDGETS } from '../services/presetWidgets';

const getChartIcon = (type: string) => {
  switch (type) {
    case 'bar':
      return <BarChart2 size={14} className="text-monokai-blue" />;
    case 'line':
    case 'area':
      return <TrendingUp size={14} className="text-monokai-green" />;
    case 'pie':
    case 'doughnut':
      return <PieChart size={14} className="text-monokai-yellow" />;
    case 'scatter':
      return <Target size={14} className="text-monokai-orange" />;
    case 'counter':
    case 'value':
      return <Zap size={14} className="text-monokai-green" />;
    case 'pivot':
      return <Grid size={14} className="text-monokai-amethyst" />;
    default:
      return <Table2 size={14} className="text-monokai-blue" />;
  }
};

const getChartTypeLabel = (type: string) => {
  switch (type) {
    case 'bar':
      return '柱状图';
    case 'line':
      return '折线图';
    case 'area':
      return '面积图';
    case 'pie':
      return '饼图';
    case 'doughnut':
      return '环形图';
    case 'scatter':
      return '散点图';
    case 'counter':
    case 'value':
      return 'KPI 卡片';
    case 'pivot':
      return '交叉透视表';
    default:
      return '数据表格';
  }
};

interface DashboardWidgetProps {
  savedQueryId: string;
  refreshTrigger: number;
  onRemove: () => void;
  onNavigate?: (tab: Tab) => void;
}

export const DashboardWidget: React.FC<DashboardWidgetProps> = ({
  savedQueryId,
  refreshTrigger,
  onRemove,
  onNavigate,
}) => {
  const [query, setQuery] = useState<SavedQuery | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenView, setFullscreenView] = useState<'chart' | 'table' | 'pivot'>('chart');
  const menuRef = useRef<HTMLDivElement>(null);

  // Table interactive filter & sort state
  const [tableFilter, setTableFilter] = useState('');
  const [tableSortCol, setTableSortCol] = useState<string | null>(null);
  const [tableSortDir, setTableSortDir] = useState<'ASC' | 'DESC'>('ASC');

  const loadWidgetData = async () => {
    setLoading(true);
    setError(null);
    try {
      const saved = await dbService.getQueries();
      let q = saved.find(s => s.id === savedQueryId);
      if (!q) {
        const preset = PRESET_WIDGETS.find(p => p.id === savedQueryId);
        if (preset) {
          q = {
            id: preset.id,
            name: preset.name,
            desc: preset.desc,
            sql: preset.sql,
            widgetType: preset.widgetType,
            charts: preset.chartConfig ? [preset.chartConfig] : undefined,
            createdAt: Date.now(),
          };
        }
      }
      if (!q) throw new Error('未找到已保存的查询组件');
      setQuery(q);

      const cleanSql = q.sql.trim().replace(/;+$/, '');
      const sql = cleanSql.toLowerCase().includes('limit')
        ? cleanSql
        : `SELECT * FROM (${cleanSql}) LIMIT 1000`;
      const res = await duckDBService.query(sql);
      setData(res);
    } catch (e: any) {
      setError(e.message || '查询执行异常');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadWidgetData();
  }, [savedQueryId, refreshTrigger]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    if (isFullscreen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const handleExportCsv = () => {
    if (!data || data.length === 0) {
      toastService.warning('当前无数据可导出');
      return;
    }
    const cols = Object.keys(data[0]);
    const blob = exportCsv({ columns: cols, rows: data, executionTime: 0 });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${query?.name || 'widget_data'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toastService.success('CSV 数据导出完成');
  };

  const handleOpenInSqlEditor = () => {
    if (!query?.sql) return;
    useSqlEditorStore.getState().updateActiveTab({ code: query.sql });
    if (onNavigate) {
      onNavigate(Tab.SQL);
    }
    toastService.info(`已将「${query.name}」载入 SQL 编辑器`);
  };

  // Table filtering and sorting
  const processedTableData = useMemo(() => {
    if (!data || data.length === 0) return [];
    let list = data;
    if (tableFilter.trim()) {
      const q = tableFilter.toLowerCase().trim();
      list = list.filter(row =>
        Object.values(row).some(v => String(v).toLowerCase().includes(q))
      );
    }
    if (tableSortCol) {
      list = [...list].sort((a, b) => {
        const va = a[tableSortCol];
        const vb = b[tableSortCol];
        if (typeof va === 'number' && typeof vb === 'number') {
          return tableSortDir === 'ASC' ? va - vb : vb - va;
        }
        return tableSortDir === 'ASC'
          ? String(va).localeCompare(String(vb))
          : String(vb).localeCompare(String(va));
      });
    }
    return list;
  }, [data, tableFilter, tableSortCol, tableSortDir]);

  const handleToggleSort = (col: string) => {
    if (tableSortCol === col) {
      if (tableSortDir === 'ASC') {
        setTableSortDir('DESC');
      } else {
        setTableSortCol(null);
      }
    } else {
      setTableSortCol(col);
      setTableSortDir('ASC');
    }
  };

  if (loading && !data.length) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-monokai-sidebar/80 p-4 text-xs text-monokai-comment">
        <RefreshCw size={20} className="animate-spin text-monokai-blue" />
        <span className="font-mono text-[11px]">载入组件数据中…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center p-4 text-center text-monokai-pink bg-monokai-sidebar/95 border border-monokai-border rounded-md">
        <AlertCircle size={24} className="mb-2 opacity-90 text-monokai-pink" />
        <div className="max-w-[85%] font-mono text-xs line-clamp-3 text-monokai-fg">{error}</div>
        <div className="mt-3.5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadWidgetData()}
            className="rounded border border-monokai-border bg-monokai-bg px-2.5 py-1 text-[11px] text-monokai-fg hover:border-monokai-border-strong transition-colors cursor-pointer"
          >
            重试
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded border border-monokai-border bg-monokai-surface px-2.5 py-1 text-[11px] text-monokai-pink hover:bg-monokai-pink/10 hover:border-monokai-border-strong transition-colors cursor-pointer"
          >
            移除
          </button>
        </div>
      </div>
    );
  }

  if (!query) return null;

  const isValueCard = query.widgetType === 'value' || query.charts?.[0]?.type === 'counter';
  const isPivotCard = query.widgetType === 'pivot' || query.charts?.[0]?.type === 'pivot';
  const chartConfig = !isValueCard && !isPivotCard && query.charts && query.charts.length > 0 ? query.charts[0] : null;
  const pivotConfig = isPivotCard && query.charts && query.charts.length > 0 ? query.charts[0] : null;

  const titleBar = (
    <div className="drag-handle flex min-h-9 cursor-move select-none items-center justify-between border-b border-monokai-border bg-monokai-surface/90 px-3 py-1.5 text-xs backdrop-blur-sm">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <GripVertical size={13} className="shrink-0 text-monokai-comment hover:text-monokai-fg transition-colors" />
        <span className="shrink-0">
          {getChartIcon(isValueCard ? 'value' : isPivotCard ? 'pivot' : chartConfig?.type || 'table')}
        </span>
        <span className="truncate font-semibold text-monokai-fg" title={query.name}>
          {query.name}
        </span>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => void loadWidgetData()}
          title="刷新当前组件数据"
          className="rounded-lg p-1 text-monokai-comment hover:bg-monokai-surface hover:text-monokai-accent transition-colors cursor-pointer"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>

        <button
          type="button"
          onClick={() => {
            setFullscreenView(isPivotCard ? 'pivot' : chartConfig ? 'chart' : 'table');
            setIsFullscreen(true);
          }}
          title="全屏透视"
          className="rounded-lg p-1 text-monokai-comment hover:bg-monokai-surface hover:text-monokai-fg transition-colors cursor-pointer"
        >
          <Maximize2 size={12} />
        </button>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            title="更多组件选项"
            className="rounded-lg p-1 text-monokai-comment hover:bg-monokai-surface hover:text-monokai-fg transition-colors cursor-pointer"
          >
            <MoreVertical size={12} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1.5 z-50 w-36 rounded-lg border border-monokai-border bg-monokai-sidebar/95 backdrop-blur-xl p-1 shadow-2xl animate-[scaleIn_0.1s_ease-out]">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  handleOpenInSqlEditor();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-monokai-fg-muted hover:bg-monokai-accent/10 hover:text-monokai-accent transition-colors cursor-pointer"
              >
                <Code2 size={13} />
                <span>在 SQL 中探索</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  handleExportCsv();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-monokai-fg-muted hover:bg-monokai-surface hover:text-monokai-fg transition-colors cursor-pointer"
              >
                <Download size={13} />
                <span>导出 CSV</span>
              </button>
              <div className="my-1 border-t border-monokai-border" />
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onRemove();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
              >
                <Trash2 size={13} />
                <span>从大盘移除</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderValueCards = () => {
    if (!data || data.length === 0) {
      return (
        <div className="flex h-full items-center justify-center text-xs text-monokai-comment">
          暂无数据
        </div>
      );
    }

    const firstRow = data[0];
    const entries = Object.entries(firstRow);

    const formatWidgetVal = (key: string, val: any) => {
      if (val === null || val === undefined) return 'NULL';
      if (typeof val === 'number') {
        const isId = /_?id$/i.test(key.trim()) || key.toLowerCase() === 'id';
        if (isId || Number.isInteger(val)) {
          return isId ? String(val) : formatCellValue(val, 'INTEGER');
        }
        return formatCellValue(val, 'DOUBLE');
      }
      return formatCellValue(val, 'VARCHAR');
    };

    if (entries.length === 1) {
      const [label, val] = entries[0];
      return (
        <div className="flex h-full flex-col justify-center p-4">
          <span className="text-xs font-semibold text-monokai-comment uppercase tracking-wider">{label}</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-2xl sm:text-3xl font-black text-monokai-green tracking-tight">
              {formatWidgetVal(label, val)}
            </span>
          </div>
          {query.desc && (
            <p className="mt-1 line-clamp-1 text-[11px] text-monokai-comment">{query.desc}</p>
          )}
        </div>
      );
    }

    const colsClass =
      entries.length <= 2
        ? 'grid-cols-2'
        : entries.length <= 4
        ? 'grid-cols-2 sm:grid-cols-4'
        : 'grid-cols-2 sm:grid-cols-3';

    return (
      <div className={`grid ${colsClass} gap-2 p-3 h-full overflow-y-auto custom-scrollbar`}>
        {entries.map(([k, v], idx) => {
          const colors = [
            'text-monokai-green border-monokai-border bg-monokai-surface/60',
            'text-monokai-blue border-monokai-border bg-monokai-surface/60',
            'text-monokai-yellow border-monokai-border bg-monokai-surface/60',
            'text-monokai-orange border-monokai-border bg-monokai-surface/60',
          ];
          const colorTheme = colors[idx % colors.length];

          return (
            <div
              key={k}
              className={`flex flex-col justify-center rounded border p-2.5 shadow-sm ${colorTheme}`}
            >
              <span className="truncate text-[10px] font-semibold text-monokai-comment" title={k}>
                {k}
              </span>
              <span className="mt-0.5 truncate font-mono text-base sm:text-lg font-bold text-monokai-fg">
                {formatWidgetVal(k, v)}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderChart = (cfg: ChartConfig, heightClass = 'h-full') => {
    const chartData = transformDataForChart(data, cfg);
    const options = getChartOptions({ ...cfg, showLegend: true } as ChartConfig);
    if (options.plugins?.title) {
      options.plugins.title.display = false;
    }
    return (
      <div className={`relative w-full ${heightClass} min-h-0 p-3`}>
        {cfg.type === 'bar' && <Bar data={chartData} options={options} />}
        {cfg.type === 'line' && <Line data={chartData} options={options} />}
        {cfg.type === 'area' && <Line data={chartData} options={options} />}
        {cfg.type === 'pie' && <Pie data={chartData} options={options} />}
        {cfg.type === 'doughnut' && <Doughnut data={chartData} options={options} />}
        {cfg.type === 'scatter' && <Scatter data={chartData} options={options} />}
      </div>
    );
  };

  // ── Volcano-Engine Style Multi-Dimensional Cross-Tab Pivot Table ──
  const renderPivotTable = (cfg?: ChartConfig | null) => {
    if (!data || data.length === 0) {
      return <div className="p-8 text-center text-xs text-monokai-comment">暂无透视数据</div>;
    }

    const cols = Object.keys(data[0]);
    const rowDim = cfg?.rowKey || cols[0] || 'row';
    const colDim = cfg?.colKey || cols[1] || 'col';
    const valDim = cfg?.valKey || cols[2] || cols[cols.length - 1] || 'val';

    // Collect unique row and column values
    const rowValues = Array.from(new Set(data.map(r => String(r[rowDim] ?? '')))).sort();
    const colValues = Array.from(new Set(data.map(r => String(r[colDim] ?? '')))).sort();

    // Map: rowKey -> colKey -> number value
    const matrix: Record<string, Record<string, number>> = {};
    const rowTotals: Record<string, number> = {};
    const colTotals: Record<string, number> = {};
    let grandTotal = 0;

    data.forEach(r => {
      const rVal = String(r[rowDim] ?? '');
      const cVal = String(r[colDim] ?? '');
      const rawNum = Number(r[valDim] ?? 0);
      const num = isNaN(rawNum) ? 0 : rawNum;

      if (!matrix[rVal]) matrix[rVal] = {};
      matrix[rVal][cVal] = (matrix[rVal][cVal] || 0) + num;

      rowTotals[rVal] = (rowTotals[rVal] || 0) + num;
      colTotals[cVal] = (colTotals[cVal] || 0) + num;
      grandTotal += num;
    });

    return (
      <div className="flex flex-col h-full overflow-hidden p-2 text-xs font-mono">
        {/* Pivot Dimension Tags */}
        <div className="flex items-center justify-between gap-2 mb-2 px-1 text-[10px] text-monokai-comment shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.2 rounded bg-monokai-amethyst/15 border border-monokai-border text-monokai-amethyst font-bold">
              行维度: {rowDim}
            </span>
            <span className="px-1.5 py-0.2 rounded bg-monokai-blue/15 border border-monokai-border text-monokai-blue font-bold">
              列维度: {colDim}
            </span>
            <span className="px-1.5 py-0.2 rounded bg-monokai-yellow/15 border border-monokai-border text-monokai-yellow font-bold">
              度量值: {valDim}
            </span>
          </div>
          <span className="text-[10px] text-monokai-comment">多维交叉汇总</span>
        </div>

        {/* Pivot Table Grid */}
        <div className="flex-1 overflow-auto rounded border border-monokai-border bg-monokai-bg/90 custom-scrollbar">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-monokai-border bg-monokai-surface sticky top-0 z-10">
                <th className="p-2 text-[11px] font-bold text-monokai-amethyst border-r border-monokai-border">
                  {rowDim} \ {colDim}
                </th>
                {colValues.map(c => (
                  <th key={c} className="p-2 text-[11px] font-bold text-monokai-blue text-right border-r border-monokai-border/60">
                    {c}
                  </th>
                ))}
                <th className="p-2 text-[11px] font-bold text-monokai-yellow text-right bg-monokai-surface/90">
                  行汇总 (Total)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-monokai-border/40">
              {rowValues.map(r => (
                <tr key={r} className="hover:bg-monokai-surface/60 transition-colors">
                  <td className="p-2 font-bold text-monokai-fg border-r border-monokai-border bg-monokai-surface/30">
                    {r}
                  </td>
                  {colValues.map(c => {
                    const val = matrix[r]?.[c];
                    return (
                      <td key={c} className="p-2 text-right tabular-nums text-monokai-fg/90 border-r border-monokai-border/40">
                        {val !== undefined ? val.toLocaleString('zh-CN') : '-'}
                      </td>
                    );
                  })}
                  <td className="p-2 text-right font-bold text-monokai-yellow tabular-nums bg-monokai-surface/20">
                    {(rowTotals[r] || 0).toLocaleString('zh-CN')}
                  </td>
                </tr>
              ))}
              {/* Grand Totals Row */}
              <tr className="border-t-2 border-monokai-border bg-monokai-surface/80 font-bold sticky bottom-0">
                <td className="p-2 text-monokai-yellow border-r border-monokai-border">
                  列汇总 (Grand Total)
                </td>
                {colValues.map(c => (
                  <td key={c} className="p-2 text-right text-monokai-blue tabular-nums border-r border-monokai-border/60">
                    {(colTotals[c] || 0).toLocaleString('zh-CN')}
                  </td>
                ))}
                <td className="p-2 text-right text-monokai-green text-sm tabular-nums">
                  {grandTotal.toLocaleString('zh-CN')}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ── Volcano-Engine Style Interactive Filterable Table ─────────────
  const renderTable = (limit = 100) => (
    <div className="flex flex-col h-full overflow-hidden p-2 text-xs font-mono">
      {/* Inline Quick Filter Toolbar */}
      <div className="flex items-center justify-between gap-2 mb-2 px-1 shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-monokai-comment" />
          <input
            type="text"
            value={tableFilter}
            onChange={e => setTableFilter(e.target.value)}
            placeholder="行内快速搜索过滤..."
            className="w-full h-7 rounded border border-monokai-border bg-monokai-surface pl-6 pr-2 text-[11px] text-monokai-fg outline-none focus:border-monokai-border-strong"
          />
        </div>
        <span className="text-[10px] text-monokai-comment">
          匹配 {processedTableData.length} / {data.length} 行
        </span>
      </div>

      {/* Table Body */}
      <div className="flex-1 overflow-auto rounded border border-monokai-border bg-monokai-bg custom-scrollbar">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="sticky top-0 z-10 border-b border-monokai-border bg-monokai-surface">
              {data.length > 0 &&
                Object.keys(data[0]).map(k => {
                  const isSorted = tableSortCol === k;
                  return (
                    <th
                      key={k}
                      onClick={() => handleToggleSort(k)}
                      className="px-2.5 py-1.5 text-[11px] font-semibold text-monokai-blue hover:text-monokai-yellow transition-colors cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-1">
                        <span>{k}</span>
                        {isSorted ? (
                          tableSortDir === 'ASC' ? (
                            <ArrowUp size={11} className="text-monokai-yellow" />
                          ) : (
                            <ArrowDown size={11} className="text-monokai-yellow" />
                          )
                        ) : (
                          <ArrowUpDown size={10} className="text-monokai-comment opacity-40 hover:opacity-100" />
                        )}
                      </div>
                    </th>
                  );
                })}
            </tr>
          </thead>
          <tbody className="divide-y divide-monokai-border/40">
            {processedTableData.slice(0, limit).map((row, i) => (
              <tr key={i} className={`hover:bg-monokai-surface/60 transition-colors ${i % 2 === 1 ? 'bg-monokai-bg/40' : ''}`}>
                {Object.values(row).map((v: any, j) => (
                  <td key={j} className="truncate px-2.5 py-1.5 text-[11px] text-monokai-fg/90">
                    {v === null || v === undefined ? (
                      <span className="italic text-monokai-comment/50">NULL</span>
                    ) : typeof v === 'object' ? (
                      JSON.stringify(v)
                    ) : (
                      String(v)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {processedTableData.length === 0 && (
          <div className="py-8 text-center text-xs text-monokai-comment">暂无匹配的查询数据</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-full w-full flex-col bg-monokai-surface/60 rounded-xl overflow-hidden border border-monokai-border hover:border-monokai-border-strong shadow-xl transition-all">
      {titleBar}
      <div className="relative flex-1 min-h-0 overflow-hidden bg-monokai-bg/40">
        {isValueCard
          ? renderValueCards()
          : isPivotCard
          ? renderPivotTable(pivotConfig)
          : chartConfig
          ? renderChart(chartConfig)
          : renderTable(12)}
      </div>
      {!chartConfig && !isValueCard && !isPivotCard && data.length > 0 && (
        <div className="flex shrink-0 items-center justify-between border-t border-monokai-border bg-monokai-sidebar/40 px-3 py-1 text-[10px] text-monokai-comment font-mono">
          <span>{getChartTypeLabel('table')}</span>
          <span>
            显示 {Math.min(processedTableData.length, 12)} / {data.length} 行
          </span>
        </div>
      )}

      {/* Fullscreen Inspector Modal */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-[1000] flex flex-col bg-monokai-bg/95 backdrop-blur-md p-4 sm:p-6 animate-[fadeIn_0.15s_ease-out]"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-monokai-border bg-monokai-sidebar px-4 py-3 rounded-t-lg shadow-sm">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-md bg-monokai-bg border border-monokai-border">
                {getChartIcon(isValueCard ? 'value' : isPivotCard ? 'pivot' : chartConfig?.type || 'table')}
              </span>
              <div>
                <h2 className="text-base font-bold text-monokai-fg">{query.name}</h2>
                <p className="text-xs text-monokai-comment font-mono max-w-xl truncate">{query.sql}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex border border-monokai-border bg-monokai-bg p-0.5 rounded">
                {chartConfig && (
                  <button
                    type="button"
                    onClick={() => setFullscreenView('chart')}
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                      fullscreenView === 'chart'
                        ? 'bg-monokai-blue text-monokai-bg font-bold shadow-sm'
                        : 'text-monokai-comment hover:text-monokai-fg'
                    }`}
                  >
                    图表透视
                  </button>
                )}
                {isPivotCard && (
                  <button
                    type="button"
                    onClick={() => setFullscreenView('pivot')}
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                      fullscreenView === 'pivot'
                        ? 'bg-monokai-amethyst text-monokai-bg font-bold shadow-sm'
                        : 'text-monokai-comment hover:text-monokai-fg'
                    }`}
                  >
                    交叉透视表
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setFullscreenView('table')}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                    fullscreenView === 'table' || (!chartConfig && !isPivotCard)
                      ? 'bg-monokai-blue text-monokai-bg font-bold shadow-sm'
                      : 'text-monokai-comment hover:text-monokai-fg'
                  }`}
                >
                  明细表格 ({data.length}行)
                </button>
              </div>

              <button
                type="button"
                onClick={handleOpenInSqlEditor}
                className="flex items-center gap-1.5 rounded border border-monokai-border bg-monokai-surface px-3 py-1.5 text-xs font-medium text-monokai-fg hover:border-monokai-border-strong hover:bg-monokai-elevated transition-colors cursor-pointer"
              >
                <Code2 size={13} />
                <span>在 SQL 中运行</span>
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 rounded border border-monokai-border bg-monokai-surface px-3 py-1.5 text-xs font-medium text-monokai-fg hover:border-monokai-border-strong hover:bg-monokai-elevated transition-colors cursor-pointer"
              >
                <Download size={13} />
                <span>导出 CSV</span>
              </button>

              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                aria-label="关闭全屏透视"
                className="flex h-8 w-8 items-center justify-center rounded border border-monokai-border bg-monokai-bg text-monokai-comment hover:text-monokai-fg hover:border-monokai-border-strong transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden border border-t-0 border-monokai-border bg-monokai-sidebar/60 p-4 rounded-b-lg shadow-inner">
            {fullscreenView === 'chart' && chartConfig
              ? renderChart(chartConfig, 'h-full')
              : fullscreenView === 'pivot' || isPivotCard
              ? renderPivotTable(pivotConfig)
              : renderTable(500)}
          </div>
        </div>
      )}
    </div>
  );
};
