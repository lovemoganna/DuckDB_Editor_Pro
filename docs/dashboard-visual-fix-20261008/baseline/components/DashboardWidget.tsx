import React, { useEffect, useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { dbService } from '../services/dbService';
import { updateObjectPresentation } from '../services/analysisObjects';
import { SavedQuery, ChartConfig, Tab, DashboardItem } from '../types';
import { formatTableValue, formatValueBySpec } from '../utils/chartFormat';
import { enrichWidgetChartConfig } from '../services/analysis';
import { computePivotTable, filterSortTableRows } from '../services/analysis/chartDisplay';
import { ChartRenderer } from './charts/ChartRenderer';
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
  Zap,
  Grid,
  Database,
  GitBranch,
  Layers,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
} from 'lucide-react';
import { exportCsv } from '../utils/sqlExporter';
import { useAppStore } from '../hooks/store/useAppStore';
import { toastService } from '../services/toastService';
import { PRESET_WIDGETS } from '../services/presetWidgets';
import type { BoardBrushFilter } from './Dashboard/Home/homeBoardTypes';
import { WidgetChartConfigPanel } from './Dashboard/WidgetChartConfigPanel';
import { openAnalysis } from '../hooks/store/useAnalysisWorkspace';
import { executeWidget, brushBindings, temporalBrush } from '../services/workbench/runtime';
import { loadDatasets } from '../services/workbench/datasets';
import type { DatasetDefinition, DashboardContext, WidgetSettings } from '../services/workbench/analysisTypes';
import { WidgetInstanceEditor } from './Dashboard/Home/WorkbenchControls';
import { formatCellValue } from '../utils/typeFormatter';

const getChartIcon = (type: string) => {
  switch (type) {
    case 'bar':
    case 'histogram':
    case 'funnel':
    case 'waterfall':
    case 'combo':
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
    case 'kpi':
    case 'value':
      return <Zap size={14} className="text-monokai-green" />;
    case 'pivot':
      return <Grid size={14} className="text-monokai-amethyst" />;
    case 'table':
      return <Table2 size={14} className="text-monokai-blue" />;
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
    case 'histogram':
      return '直方图';
    case 'funnel':
      return '漏斗图';
    case 'waterfall':
      return '瀑布图';
    case 'combo':
      return '组合图';
    case 'counter':
    case 'kpi':
    case 'value':
      return 'KPI 卡片';
    case 'pivot':
      return '交叉透视表';
    case 'table':
      return '数据表格';
    default:
      return '数据表格';
  }
};

interface DashboardWidgetProps {
  onDisplayKind?: (id: string, kind: 'value' | 'chart' | 'table', rows?: number, metrics?: number) => void;
  item?: DashboardItem;
  datasets?: DatasetDefinition[];
  context?: DashboardContext;
  ownerCatalog?: string;
  onSettingsChange?: (id:string,settings:WidgetSettings)=>Promise<void>;
  savedQueryId: string;
  widgetInstanceId?: string;
  refreshTrigger: number;
  onRemove: () => void;
  onNavigate?: (tab: Tab) => void;
  boardParams?: Record<string, string>;
  brushFilter?: BoardBrushFilter | null;
  onBrushFilter?: (filter: BoardBrushFilter | null) => void;
  onSelectTable?: (tableName: string) => void;
  onSelectTableStructure?: (tableName: string) => void;
  onSelectTableDataFlow?: (tableName: string) => void;
}

export const DashboardWidget: React.FC<DashboardWidgetProps> = ({
  item,
  datasets,
  context,
  ownerCatalog,
  onSettingsChange,
  onDisplayKind,
  savedQueryId,
  widgetInstanceId,
  refreshTrigger,
  onRemove,
  onNavigate,
  boardParams = {},
  brushFilter,
  onBrushFilter,
  onSelectTable,
  onSelectTableStructure,
  onSelectTableDataFlow,
}) => {
  const [query, setQuery] = useState<SavedQuery | null>(null);
  const displayKind = query?.widgetType === 'value' || ['counter', 'kpi'].includes(query?.charts?.[0]?.type || '') ? 'value'
    : query?.charts?.length && query.charts[0].type !== 'table' ? 'chart' : 'table';
  const [data, setData] = useState<any[]>([]);
  useEffect(() => {
    if (query) onDisplayKind?.(widgetInstanceId || savedQueryId, displayKind, data.length, query.charts?.[0]?.yKeys.length || 1);
  }, [Boolean(query), displayKind, onDisplayKind, widgetInstanceId, savedQueryId, data.length, query?.charts?.[0]?.yKeys.length]);
  const [fieldTypes,setFieldTypes] = useState<Record<string,string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [showFieldConfig, setShowFieldConfig] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenView, setFullscreenView] = useState<'chart' | 'table' | 'pivot'>('chart');
  const menuRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);

  // Table interactive filter & sort state
  const [tableFilter, setTableFilter] = useState('');
  const [tableSortCol, setTableSortCol] = useState<string | null>(null);
  const [tableSortDir, setTableSortDir] = useState<'ASC' | 'DESC'>('ASC');
  const loadGeneration = useRef(0);
  const [showInstanceSettings,setShowInstanceSettings] = useState(false);
  const [notices,setNotices] = useState<string[]>([]);
  const [page,setPage] = useState(0);
  const [total,setTotal] = useState(0);
  const [updatedAt,setUpdatedAt] = useState(0);

  const loadWidgetData = async (force = false) => {
    const generation = ++loadGeneration.current;
    const catalog = ownerCatalog || useAppStore.getState().currentDatabase;
    const stillCurrent = () => generation === loadGeneration.current && useAppStore.getState().currentDatabase === catalog;
    setLoading(true);
    setError(null);
    try {
      const saved = await dbService.getQueries(catalog);
      if (!stillCurrent()) return;
      let q = saved.find((s) => s.id === savedQueryId);
      if (!q) {
        const preset = PRESET_WIDGETS.find((p) => p.id === savedQueryId);
        if (preset) {
          q = {
            id: preset.id,
            name: preset.name,
            desc: preset.desc,
            sql: preset.sql,
            widgetType: preset.widgetType,
            charts: preset.chartConfig ? [preset.chartConfig] : undefined,
            createdAt: Date.now(),
            databaseName: catalog,
          };
        }
      }
      if (!q) throw new Error('未找到已保存的查询组件');
      if (q.databaseName !== catalog) throw new Error('此图表不属于当前数据库');
      if (stillCurrent() && !query) setQuery(q);
      const sources = datasets || await loadDatasets(catalog);
      if (!stillCurrent()) return;
      const result=await executeWidget({query:q,settings:item?.settings,datasets:sources,context,brush:brushFilter,refresh:refreshTrigger,params:boardParams,page,force});
      if(stillCurrent()){
        const lastPage=Math.max(0,Math.ceil(result.total/result.pageSize)-1);
        if(page>lastPage){setPage(lastPage);return;}
        setQuery(result.query);setData(result.rows);setTotal(result.total);setUpdatedAt(result.at);setNotices(result.notices);setFieldTypes(result.fieldTypes);
      }
    } catch (e: any) {
      if (stillCurrent()) setError(e.message || '查询执行异常');
    } finally {
      if (stillCurrent()) setLoading(false);
    }
  };

  useEffect(() => {
    setQuery(null);setData([]);setTotal(0);setUpdatedAt(0);setNotices([]);setFieldTypes({});setPage(0);
    setTableFilter('');setTableSortCol(null);
  },[savedQueryId,ownerCatalog]);

  useEffect(() => {
    void loadWidgetData();
    return () => { loadGeneration.current += 1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedQueryId, ownerCatalog, refreshTrigger, JSON.stringify(boardParams), JSON.stringify(item?.settings), JSON.stringify(context), JSON.stringify(brushFilter), datasets, page]);

  useEffect(()=>{setPage(0);},[savedQueryId,JSON.stringify(context),JSON.stringify(item?.settings),JSON.stringify(brushFilter)]);

  useEffect(() => {
    if (!menuOpen || !menuBtnRef.current) {
      setMenuPos(null);
      return;
    }
    const rect = menuBtnRef.current.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + 6,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  }, [menuOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t)) return;
      if (menuBtnRef.current?.contains(t)) return;
      const portal = document.getElementById(`widget-menu-${widgetInstanceId || savedQueryId}`);
      if (portal?.contains(t)) return;
      setMenuOpen(false);
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen, widgetInstanceId, savedQueryId]);

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
    if (!query?.sql?.trim()) {
      toastService.warning('当前组件没有可载入的 SQL');
      return;
    }
    // WorkbenchView 通过 pendingSql 注入新工作表；SqlEditorStore 已不再驱动 Tab.SQL
    useAppStore.getState().setPendingSql(query.sql.trim());
    if (onNavigate) {
      onNavigate(Tab.SQL);
    } else {
      useAppStore.getState().setActiveTab(Tab.SQL);
    }
    toastService.success(`已将「${query.name}」载入 SQL 工作台`);
  };

  const handleSaveChartConfig = async (next: ChartConfig) => {
    if (!query) return;
    const updated: SavedQuery = {
      ...query,
      charts: [next],
      widgetType:
        next.type === 'counter' || next.type === 'kpi'
          ? 'value'
          : next.type === 'pivot' || next.type === 'table'
            ? 'table'
            : 'chart',
    };
    if(item && onSettingsChange) await onSettingsChange(item.i,{...item.settings,chartConfig:next});
    else await updateObjectPresentation(updated, next);
    setQuery(updated);
    setShowFieldConfig(false);
    toastService.success('图表字段配置已保存');
  };

  const primaryTable = query?.referencedTables?.[0]
    ? query.referencedTables[0].includes('.')
      ? query.referencedTables[0].split('.').pop()!
      : query.referencedTables[0]
    : null;

  // Table filtering and sorting + board brush filter
  const processedTableData = useMemo(() => {
    return filterSortTableRows(data || [], {
      brush: datasets ? null : brushFilter,
      filter: tableFilter,
      sortColumn: tableSortCol,
      sortDirection: tableSortDir,
    });
  }, [data, tableFilter, tableSortCol, tableSortDir, brushFilter]);

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

  if (error && !updatedAt) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center p-4 text-center text-monokai-pink bg-monokai-sidebar/95 border border-monokai-border rounded-md">
        <AlertCircle size={24} className="mb-2 opacity-90 text-monokai-pink" />
        <strong className="text-xs mb-1">{item?.settings?.title || query?.name || '分析组件'} · 查询定义已失效</strong>
        <div role="alert" title={error} className="max-w-[95%] max-h-24 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-monokai-fg">{error}</div>
        <div className="mt-3.5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadWidgetData(true)}
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
        {item&&onSettingsChange&&<><button className="mt-2 text-xs underline" onClick={()=>setShowInstanceSettings(true)}>重新绑定 / 实例设置</button><WidgetInstanceEditor item={item} datasets={datasets||[]} open={showInstanceSettings} onClose={()=>setShowInstanceSettings(false)} onSave={settings=>onSettingsChange(item.i,settings)}/></>}
      </div>
    );
  }

  if (!query) return null;

  const isValueCard = query.widgetType === 'value' || ['counter', 'kpi'].includes(query.charts?.[0]?.type || '');
  const isPivotCard = query.widgetType === 'pivot' || query.charts?.[0]?.type === 'pivot';
  const chartConfig = !isValueCard && !isPivotCard && query.charts && query.charts.length > 0 ? query.charts[0] : null;
  const pivotConfig = isPivotCard && query.charts && query.charts.length > 0 ? query.charts[0] : null;

  const titleBar = (
    <div className="drag-handle flex min-h-9 flex-wrap gap-1 cursor-move select-none items-center justify-between border-b border-monokai-border bg-monokai-surface/90 px-3 py-1.5 text-xs backdrop-blur-sm">
      <div className="flex min-w-24 flex-1 items-center gap-2">
        <GripVertical size={13} className="shrink-0 text-monokai-comment hover:text-monokai-fg transition-colors" />
        <span className="shrink-0">
          {getChartIcon(isValueCard ? 'value' : isPivotCard ? 'pivot' : chartConfig?.type || 'table')}
        </span>
        <span className="break-words font-semibold text-monokai-fg" title={query.name}>
          {query.name}
        </span>
      </div>

      <div className="flex max-w-full flex-wrap items-center gap-1 shrink-0">
        {item&&onSettingsChange&&<button type="button" title="组件实例设置" aria-label={`设置组件 ${query.name}`} onClick={()=>setShowInstanceSettings(true)} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-monokai-comment hover:bg-monokai-surface hover:text-monokai-fg"><SlidersHorizontal size={12}/></button>}
        <button
          type="button"
          onClick={() => void loadWidgetData(true)}
          title="刷新当前组件数据"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-monokai-comment hover:bg-monokai-surface hover:text-monokai-accent transition-colors cursor-pointer"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>

        <button
          type="button"
          onClick={() => {
            setFullscreenView(
              isPivotCard ? 'pivot' : isValueCard || chartConfig ? 'chart' : 'table',
            );
            setIsFullscreen(true);
          }}
          title="全屏透视"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-monokai-comment hover:bg-monokai-surface hover:text-monokai-fg transition-colors cursor-pointer"
        >
          <Maximize2 size={12} />
        </button>

        {(chartConfig || isValueCard) && (
          <button
            type="button"
            onClick={() => setShowFieldConfig((v) => !v)}
            title="配置字段 / 单位 / 图例"
            className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors cursor-pointer ${
              showFieldConfig
                ? 'bg-monokai-accent/15 text-monokai-accent'
                : 'text-monokai-comment hover:bg-monokai-surface hover:text-monokai-fg'
            }`}
          >
            <SlidersHorizontal size={12} />
          </button>
        )}

        <div className="relative" ref={menuRef}>
          <button
            ref={menuBtnRef}
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            title="更多组件选项"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-monokai-comment hover:bg-monokai-surface hover:text-monokai-fg transition-colors cursor-pointer"
          >
            <MoreVertical size={12} />
          </button>

          {menuOpen &&
            menuPos &&
            createPortal(
              <div
                id={`widget-menu-${widgetInstanceId || savedQueryId}`}
                className="fixed z-[1100] w-44 rounded-lg border border-monokai-border bg-monokai-sidebar/95 backdrop-blur-xl p-1 shadow-2xl"
                style={{ top: menuPos.top, right: menuPos.right }}
              >
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  handleOpenInSqlEditor();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-monokai-fg-muted hover:bg-monokai-accent/10 hover:text-monokai-accent transition-colors cursor-pointer"
              >
                <Code2 size={13} />
                <span>打开 SQL</span>
              </button>
              <button type="button" onClick={() => {
                setMenuOpen(false);
                void (async () => {
                  try {
                    const ref = query.analysisRef;
                    if (ref?.kind === 'analysis') {
                      const records = await dbService.getDomainSetting<import('../services/analysisObjects').AnalysisRecord[]>('linked-analyses', query.databaseName) || [];
                      const record = records.find(item => item.id === ref.id);
                      if (!record) throw new Error('关联分析已删除');
                      openAnalysis({ ...record, analysisId: record.id });
                    } else openAnalysis({ databaseName: query.databaseName, title: query.name,
                      metricId: ref?.kind === 'metric' ? ref.id : undefined,
                      chartId: ref?.kind === 'chart' ? ref.id : query.metricChartId,
                      sql: query.sql, chartConfig: query.charts?.[0], sourceTables: query.referencedTables || [] });
                  } catch (err) { toastService.error(String((err as Error).message)); }
                })();
              }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-monokai-fg-muted hover:bg-monokai-surface cursor-pointer">
                <TrendingUp size={13}/><span>进入关联分析</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setShowFieldConfig(true);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-monokai-fg-muted hover:bg-monokai-surface hover:text-monokai-fg transition-colors cursor-pointer"
              >
                <SlidersHorizontal size={13} />
                <span>字段 / 单位配置</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setShowSql((v) => !v);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-monokai-fg-muted hover:bg-monokai-surface hover:text-monokai-fg transition-colors cursor-pointer"
              >
                <Layers size={13} />
                <span>查看 SQL / 血缘</span>
              </button>
              {primaryTable && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onSelectTable?.(primaryTable);
                      if (!onSelectTable) onNavigate?.(Tab.DATA);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-monokai-fg-muted hover:bg-monokai-surface hover:text-monokai-fg transition-colors cursor-pointer"
                  >
                    <Database size={13} />
                    <span>打开数据表</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onSelectTableStructure?.(primaryTable);
                      if (!onSelectTableStructure) onNavigate?.(Tab.STRUCTURE);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-monokai-fg-muted hover:bg-monokai-surface hover:text-monokai-fg transition-colors cursor-pointer"
                  >
                    <Layers size={13} />
                    <span>打开 Schema</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onSelectTableDataFlow?.(primaryTable);
                      if (!onSelectTableDataFlow) onNavigate?.(Tab.DATAFLOW);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-monokai-fg-muted hover:bg-monokai-surface hover:text-monokai-fg transition-colors cursor-pointer"
                  >
                    <GitBranch size={13} />
                    <span>打开数据流</span>
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  handleExportCsv();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-monokai-fg-muted hover:bg-monokai-surface hover:text-monokai-fg transition-colors cursor-pointer"
              >
                <Download size={13} />
                <span>导出当前页 CSV</span>
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
              </div>,
              document.body,
            )}
        </div>
      </div>
    </div>
  );

  /** KPI / counter — Spec → ChartRenderer (no local formatting). */
  const renderValueCards = () => {
    const rows = (data || []) as Record<string, unknown>[];
    if (!rows.length) {
      return (
        <div className="flex h-full items-center justify-center text-xs text-monokai-comment">
          暂无数据
        </div>
      );
    }
    const kpiCfg: ChartConfig = query.charts?.[0] || {
      id: `kpi_${query.id}`,
      title: query.name,
      type: 'counter',
      xKey: Object.keys(rows[0])[0] || '',
      yKeys: Object.keys(rows[0]),
    };
    const { chartSpec } = enrichWidgetChartConfig(rows, { ...kpiCfg, type: 'counter' }, {
      title: query.name,
    });
    return <ChartRenderer chartSpec={chartSpec} kpiVariant="dashboard" hideTitle />;
  };

  /**
   * All Chart.js / Spec chart kinds — Spec → Adapter → ChartRenderer.
   * Drill-down and brush stay in the widget shell; display rules live in the adapter.
   */
  const renderChart = (cfg: ChartConfig, heightClass = 'h-full') => {
    const chartSource = ((brushFilter?.column ? processedTableData : data) || []) as Record<
      string,
      unknown
    >[];
    if (!chartSource.length) {
      return (
        <div className={`flex ${heightClass} items-center justify-center text-xs text-monokai-comment`}>
          当前筛选无数据
        </div>
      );
    }

    const displayRows=chartSource.map(row=>Object.fromEntries(Object.entries(row).map(([name,value])=>[name,/^(DATE|TIMESTAMP)/i.test(fieldTypes[name]||'')&&value!=null?formatCellValue(value,fieldTypes[name]):value])));
    const { chartSpec } = enrichWidgetChartConfig(displayRows, cfg, {
      title: query?.name || cfg.title,
    });

    return (
      <ChartRenderer
        chartSpec={chartSpec}
        heightClass={heightClass}
        hideTitle
        onBrush={(field, value) => {
          const bindings=datasets&&query?brushBindings(query,datasets,field,context):undefined;
          const v = String(value);
          if (chartSpec.chartType === 'histogram' && chartSpec.histogramBins?.length) {
            const index = chartSpec.histogramBins.findIndex((bin) => bin.label === v);
            if (index >= 0) {
              const bin = chartSpec.histogramBins[index];
              onBrushFilter?.({
                column: field,
                value: bin.label,
                range: { from: bin.from, to: bin.to, includeTo: index === chartSpec.histogramBins.length - 1 },
                sourceWidgetId: widgetInstanceId,
                bindings,
              });
              return;
            }
          }
          if (cfg.drillDownConfig?.enabled && cfg.drillDownConfig.drillDownSql) {
            const col = cfg.drillDownConfig.drillDownColumn || field;
            const drillSql = cfg.drillDownConfig.drillDownSql
              .replace(/\{\{\s*value\s*\}\}/g, v.replace(/'/g, "''"))
              .replace(/\{\{\s*column\s*\}\}/g, col);
            useAppStore.getState().setPendingSql(drillSql);
            if (onNavigate) {
              onNavigate(Tab.SQL);
            } else {
              useAppStore.getState().setActiveTab(Tab.SQL);
            }
            toastService.info('已生成下钻 SQL');
            return;
          }
          onBrushFilter?.({
            column: field,
            value: v,
            sourceWidgetId: widgetInstanceId,
            bindings,
            temporalRange:datasets&&query?temporalBrush(query,field,v):undefined,
          });
        }}
      />
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

    const { rowValues, colValues, matrix, rowTotals, colTotals, grandTotal } =
      computePivotTable(processedTableData, rowDim, colDim, valDim);

    const pivotFmt = {
      unit: cfg?.unit || cfg?.format?.unit,
      compact: true,
      thousandSeparator: true,
      ...(cfg?.format || {}),
    };
    const fmtPivot = (n: number) => formatValueBySpec(n, pivotFmt);

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
                      <td
                        key={c}
                        className="p-2 text-right tabular-nums text-monokai-fg/90 border-r border-monokai-border/40 cursor-pointer hover:bg-monokai-accent/10"
                        title="点击联动筛选"
                        onClick={() =>
                          onBrushFilter?.({
                            column: rowDim,
                            value: r,
                            sourceWidgetId: widgetInstanceId,
                            bindings:datasets&&query?brushBindings(query,datasets,rowDim,context):undefined,
                          })
                        }
                      >
                        {val !== undefined ? fmtPivot(val) : '—'}
                      </td>
                    );
                  })}
                  <td className="p-2 text-right font-bold text-monokai-yellow tabular-nums bg-monokai-surface/20">
                    {fmtPivot(rowTotals[r] || 0)}
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
                    {fmtPivot(colTotals[c] || 0)}
                  </td>
                ))}
                <td className="p-2 text-right text-monokai-green text-sm tabular-nums">
                  {fmtPivot(grandTotal)}
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
            placeholder={datasets ? "搜索当前页（全部筛选请用实例设置）" : "行内快速搜索过滤..."}
            className="w-full h-7 rounded border border-monokai-border bg-monokai-surface pl-6 pr-2 text-[11px] text-monokai-fg outline-none focus:border-monokai-border-strong"
          />
        </div>
        <span className="text-[10px] text-monokai-comment">
          匹配 {processedTableData.length} / {data.length} 行
        </span>
      </div>

      {/* Table Body */}
      <div className="flex-1 overflow-auto rounded border border-monokai-border bg-monokai-bg custom-scrollbar">
        <table className="w-full border-collapse text-left" style={{ minWidth: Object.keys(data[0] || {}).length * 140 }}>
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
                  <td key={j} className="whitespace-nowrap px-2.5 py-1.5 text-xs text-monokai-fg/90">
                    {v === null || v === undefined ? (
                      <span className="italic text-monokai-comment/50">NULL</span>
                    ) : typeof v === 'object' && !(v instanceof Uint8Array) ? (
                      JSON.stringify(v)
                    ) : (
                      formatTableValue(v, Object.keys(row)[j], chartConfig?.formatByKey?.[Object.keys(row)[j]] || chartConfig?.format)
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
    <div className="relative z-10 flex h-full w-full flex-col bg-monokai-surface/60 rounded-xl overflow-hidden border border-monokai-border hover:border-monokai-border-strong shadow-xl transition-all">
      {titleBar}
      {error&&<div role="alert" className="shrink-0 border-b border-monokai-border p-2 text-xs text-monokai-pink"><p className="max-h-16 overflow-auto">刷新失败，以下是 {new Date(updatedAt).toLocaleTimeString()} 的最后成功结果：{error}</p><button className="underline" onClick={()=>void loadWidgetData(true)}>重试</button></div>}
      {query.analysisRef && query.desc && <details className="shrink-0 px-3 py-1 text-xs text-monokai-comment border-b border-monokai-border"><summary className="cursor-pointer">分析口径</summary><p className="whitespace-pre-wrap max-h-20 overflow-auto">{query.desc}</p></details>}
      {showFieldConfig && (
        <WidgetChartConfigPanel
          columns={data[0] ? Object.keys(data[0]) : []}
          config={
            query.charts?.[0] || {
              id: `cfg-${query.id}`,
              title: query.name,
              type: isValueCard ? 'counter' : 'bar',
              xKey: data[0] ? Object.keys(data[0])[0] : '',
              yKeys: data[0] ? Object.keys(data[0]).slice(1, 2) : [],
              showLegend: true,
              legendPosition: 'bottom',
              legendAlign: 'center',
            }
          }
          onChange={(next) => void handleSaveChartConfig(next)}
          onClose={() => setShowFieldConfig(false)}
        />
      )}
      {showSql && query && (
        <div className="shrink-0 border-b border-monokai-border bg-monokai-elevated/80 px-3 py-2 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-2xs font-mono uppercase tracking-wide text-monokai-comment">SQL / 血缘</span>
            <button type="button" className="text-monokai-comment hover:text-monokai-fg cursor-pointer" onClick={() => setShowSql(false)}>
              <X size={12} />
            </button>
          </div>
          <pre className="max-h-24 overflow-auto font-mono text-2xs text-monokai-fg whitespace-pre-wrap break-all custom-scrollbar">
            {query.sql}
          </pre>
          <div className="flex flex-wrap gap-1.5 text-2xs font-mono text-monokai-comment">
            {(query.referencedTables || []).map((t) => (
              <button
                key={t}
                type="button"
                className="rounded border border-monokai-border bg-monokai-bg px-1.5 py-0.5 hover:border-monokai-accent hover:text-monokai-accent cursor-pointer"
                onClick={() => {
                  const name = t.includes('.') ? t.split('.').pop()! : t;
                  onSelectTable?.(name);
                }}
              >
                {t}
              </button>
            ))}
            {(query.referencedSchemas || []).map((s) => (
              <span key={s} className="rounded border border-monokai-border/60 px-1.5 py-0.5">
                schema:{s}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="relative flex-1 min-h-0 overflow-hidden bg-monokai-bg/40">
        {loading&&<div role="status" className="absolute right-2 top-2 z-20 rounded bg-monokai-surface px-2 py-1 text-xs">正在刷新…</div>}
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

      {/* Fullscreen Inspector — portaled to body so grid-item CSS transforms
          do not trap position:fixed inside the tiny card. */}
      {isFullscreen &&
        createPortal(
          <div
            className="fixed inset-0 z-[2000] flex items-stretch justify-center bg-monokai-bg/80 backdrop-blur-sm p-3 sm:p-5 animate-[fadeIn_0.15s_ease-out]"
            role="dialog"
            aria-modal="true"
            aria-label={`${query.name} 全屏透视`}
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsFullscreen(false);
            }}
          >
            <div className="flex h-full w-full max-w-[1400px] flex-col overflow-hidden rounded-lg border border-monokai-border bg-monokai-bg shadow-2xl">
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-monokai-border bg-monokai-sidebar px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-monokai-border bg-monokai-surface">
                    {getChartIcon(
                      isValueCard ? 'value' : isPivotCard ? 'pivot' : chartConfig?.type || 'table',
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-sm font-semibold text-monokai-fg sm:text-base">
                        {query.name}
                      </h2>
                      <span className="rounded border border-monokai-border/70 px-1.5 py-0.5 text-[10px] font-mono text-monokai-comment">
                        {getChartTypeLabel(
                          isValueCard
                            ? 'value'
                            : isPivotCard
                              ? 'pivot'
                              : chartConfig?.type || 'table',
                        )}
                      </span>
                    </div>
                    <p
                      className="mt-0.5 max-w-2xl truncate font-mono text-[11px] text-monokai-comment"
                      title={query.sql}
                    >
                      {query.sql}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex rounded border border-monokai-border bg-monokai-bg p-0.5">
                    {isValueCard && (
                      <button
                        type="button"
                        onClick={() => setFullscreenView('chart')}
                        className={`cursor-pointer rounded px-3 py-1 text-xs font-medium transition-colors ${
                          fullscreenView === 'chart'
                            ? 'bg-monokai-green text-monokai-bg font-bold shadow-sm'
                            : 'text-monokai-comment hover:text-monokai-fg'
                        }`}
                      >
                        KPI
                      </button>
                    )}
                    {chartConfig && (
                      <button
                        type="button"
                        onClick={() => setFullscreenView('chart')}
                        className={`cursor-pointer rounded px-3 py-1 text-xs font-medium transition-colors ${
                          fullscreenView === 'chart'
                            ? 'bg-monokai-blue text-monokai-bg font-bold shadow-sm'
                            : 'text-monokai-comment hover:text-monokai-fg'
                        }`}
                      >
                        图表
                      </button>
                    )}
                    {isPivotCard && (
                      <button
                        type="button"
                        onClick={() => setFullscreenView('pivot')}
                        className={`cursor-pointer rounded px-3 py-1 text-xs font-medium transition-colors ${
                          fullscreenView === 'pivot'
                            ? 'bg-monokai-amethyst text-monokai-bg font-bold shadow-sm'
                            : 'text-monokai-comment hover:text-monokai-fg'
                        }`}
                      >
                        透视表
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setFullscreenView('table')}
                      className={`cursor-pointer rounded px-3 py-1 text-xs font-medium transition-colors ${
                        fullscreenView === 'table'
                          ? 'bg-monokai-blue text-monokai-bg font-bold shadow-sm'
                          : 'text-monokai-comment hover:text-monokai-fg'
                      }`}
                    >
                      明细 ({data.length})
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenInSqlEditor}
                    className="flex cursor-pointer items-center gap-1.5 rounded border border-monokai-border bg-monokai-surface px-3 py-1.5 text-xs font-medium text-monokai-fg transition-colors hover:border-monokai-border-strong hover:bg-monokai-elevated"
                  >
                    <Code2 size={13} />
                    <span className="hidden sm:inline">在 SQL 中运行</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="flex cursor-pointer items-center gap-1.5 rounded border border-monokai-border bg-monokai-surface px-3 py-1.5 text-xs font-medium text-monokai-fg transition-colors hover:border-monokai-border-strong hover:bg-monokai-elevated"
                  >
                    <Download size={13} />
                    <span className="hidden sm:inline">导出当前页 CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsFullscreen(false)}
                    aria-label="关闭全屏透视"
                    title="关闭 (Esc)"
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded border border-monokai-border bg-monokai-surface text-monokai-comment transition-colors hover:border-monokai-border-strong hover:text-monokai-fg"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-monokai-surface/40 p-3 sm:p-4">
                {fullscreenView === 'chart' && isValueCard
                  ? renderValueCards()
                  : fullscreenView === 'chart' && chartConfig
                    ? renderChart(chartConfig, 'h-full')
                    : fullscreenView === 'pivot' || (isPivotCard && fullscreenView !== 'table')
                      ? renderPivotTable(pivotConfig)
                      : renderTable(500)}
              </div>

              <div className="flex shrink-0 items-center justify-between border-t border-monokai-border bg-monokai-sidebar/80 px-4 py-1.5 text-[10px] font-mono text-monokai-comment">
                <span>全屏透视 · Esc 或点击遮罩关闭</span>
                <span>
                  {data.length} 行
                  {brushFilter ? ` · 联动: ${brushFilter.column}=${brushFilter.value}` : ''}
                </span>
              </div>
            </div>
          </div>,
          document.body,
        )}
      {datasets&&<div className="shrink-0 flex flex-wrap items-center justify-between gap-1 border-t border-monokai-border px-2 py-1 text-2xs text-monokai-comment">
        <span>{total} 行 · {updatedAt?new Date(updatedAt).toLocaleTimeString():'未更新'}{total>100?' · 分页结果':''}</span>
        {total>100&&<div className="flex items-center gap-2"><button disabled={page===0} onClick={()=>setPage(n=>n-1)}>上一页</button><span>{page+1}/{Math.max(1,Math.ceil(total/100))}</span><button disabled={(page+1)*100>=total} onClick={()=>setPage(n=>n+1)}>下一页</button></div>}
        {notices.length>0&&<details className="w-full"><summary>筛选适用范围（{notices.length}）</summary>{notices.map(n=><p key={n}>{n}</p>)}</details>}
      </div>}
      {item&&onSettingsChange&&<WidgetInstanceEditor item={item} datasets={datasets||[]} open={showInstanceSettings} onClose={()=>setShowInstanceSettings(false)} onSave={settings=>onSettingsChange(item.i,settings)}/>}
    </div>
  );
};
