import { useAnalysisWorkspace } from '../../hooks/store/useAnalysisWorkspace';
import { executeAnalysisQuery } from '../../services/analysis/readQuery';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MetricChart, ChartConfig } from '../../types';
import { metricAnalyzer } from '../../services/metricAnalyzer';
import { duckDBService } from '../../services/duckdbService';
import { LineageService, DataLineageGraph } from '../../services/LineageService';
import { loadHomePinnedChartIds, pinChartToHome, unpinChartFromHome } from '../../services/homeDashboardService';
import { loadVisualizationAssets, updateVisualizationAsset, deleteVisualizationAsset } from '../../services/visualizationAssets';
import { activeAnalysisDatabase } from '../../services/metricAssetStorage';
import { metricSource } from '../../services/metricSql';
import { listChartTypes } from '../../services/analysis/chartRegistry';
import './visualizationUi.css';
import { quoteTable } from '../../services/analysis/sqlUtils';
import { extractTablesFromSql } from '../../services/queryVizHint';
import { chartNumber } from '../../utils/chartFormat';
import { toastService } from '../../services/toastService';
import { VisualizationCard } from './VisualizationCard';
import { VisualizationAssetList } from './VisualizationAssetList';
import { ChartBuilder } from '../ChartBuilder';
import { LineageGraphView } from '../ui/LineageGraphView';
import {
  PageHeader,
  FilterBar,
  SegmentedTabs,
  SearchInput,
  ActionButton,
  EmptyState,
  StatusBadge,
  ModalShell,
  FormSelect,
} from '../ui/Workbench';
import {
  BarChart2,
  Sparkles,
  Layers,
  RefreshCw,
  Plus,
  PieChart,
  GitBranch,
  X,
  Filter,
  TrendingUp,
  LayoutDashboard,
  CheckCircle2,
  LayoutGrid,
  List,
} from 'lucide-react';

export interface VisualizationWorkbenchProps {
  tables?: string[];
  currentTable?: string | null;
  currentMetricId?: string | null;
  onExecuteSql?: (sql: string, executeDirectly?: boolean) => void;
  onNavigateToDashboard?: () => void;
  onNavigateToData?: (tableName: string) => void;
  onNavigateToMetrics?: (metricId: string) => void;
}

export function matchesVisualizationTable(reference: string, table: string): boolean {
  const normalize = (value: string) => value.replace(/["`]/g, '').toLowerCase();
  const ref = normalize(reference);
  const target = normalize(table);
  return ref === target || (!ref.includes('.') && ref === target.split('.').pop())
    || (!target.includes('.') && ref.split('.').pop() === target);
}

export const VisualizationWorkbench: React.FC<VisualizationWorkbenchProps> = ({
  tables = [],
  currentTable,
  currentMetricId,
  onExecuteSql,
  onNavigateToDashboard,
  onNavigateToData,
  onNavigateToMetrics,
}) => {
  const [charts, setCharts] = useState<MetricChart[]>([]);
  const [chartDataMap, setChartDataMap] = useState<Record<string, any[]>>({});
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [pinnedChartIds, setPinnedChartIds] = useState<Set<string>>(new Set());
  const [chartErrors, setChartErrors] = useState<Record<string, string>>({});
  const [isLoadingAssets, setIsLoadingAssets] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [metricFilter, setMetricFilter] = useState<string | null>(currentMetricId || null);
  const refreshVersion = useRef(0);
  const dataVersion = useRef(0);
  const [builderSourceTable, setBuilderSourceTable] = useState(currentTable || tables[0] || '');
  const [builderData, setBuilderData] = useState<any[]>([]);
  const [builderColumns, setBuilderColumns] = useState<string[]>([]);
  const [builderLoading, setBuilderLoading] = useState(false);
  const [builderError, setBuilderError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const availableMetricIds = useMemo(() => new Set(metricAnalyzer.loadMetricPackages().flatMap(pkg => pkg.metrics.map(metric => metric.id))), [charts]);

  // 筛选与搜索
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'metric' | 'adhoc' | 'pinned'>('all');
  const [tableFilter, setTableFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [presentation, setPresentation] = useState<'gallery'|'list'>(() => {
    try { return localStorage.getItem('duckdb-viz-presentation') === 'list' ? 'list' : 'gallery'; } catch { return 'gallery'; }
  });
  const [inspectedId, setInspectedId] = useState<string|null>(null);
  const [refinementsOpen, setRefinementsOpen] = useState(false);
  useEffect(() => { try { localStorage.setItem('duckdb-viz-presentation',presentation); } catch {} }, [presentation]);

  // 模态弹窗状态
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingChart, setEditingChart] = useState<MetricChart | null>(null);
  const [lineageChart, setLineageChart] = useState<MetricChart | null>(null);
  const [lineageGraph, setLineageGraph] = useState<DataLineageGraph | null>(null);
  const [isGeneratingMetrics, setIsGeneratingMetrics] = useState(false);

  const [deletingChart, setDeletingChart] = useState<MetricChart | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const closeBuilder = () => { if (!isSaving) { setIsBuilderOpen(false); setEditingChart(null); } };

  const refreshCharts = useCallback(async () => {
    const version = ++refreshVersion.current;
    const catalog = activeAnalysisDatabase();
    setIsLoadingAssets(true);
    try {
      const [loaded, pinned] = await Promise.all([loadVisualizationAssets(), loadHomePinnedChartIds()]);
      if (version !== refreshVersion.current || catalog !== activeAnalysisDatabase()) return;
      setCharts(loaded);
      setPinnedChartIds(pinned);
      setLoadError(null);
    } catch (error) {
      if (version === refreshVersion.current) setLoadError((error as Error).message);
    } finally { if (version === refreshVersion.current) setIsLoadingAssets(false); }
  }, []);

  useEffect(() => {
    void refreshCharts();
    const reload = () => { void refreshCharts(); };
    const databaseChanged = () => {
      dataVersion.current++;
      setCharts([]); setChartDataMap({}); setChartErrors({}); setIsLoadingData(false);
      setIsBuilderOpen(false); setEditingChart(null); setLineageChart(null); setLineageGraph(null); setDeletingChart(null);
      setInspectedId(null);
      setMetricFilter(null); setSearchQuery(''); setCategoryFilter('all'); setTableFilter('all'); setTypeFilter('all');
      void refreshCharts();
    };
    window.addEventListener('duckdb-database-changed', databaseChanged);
    const events = ['duckdb-metric-charts-updated', 'duckdb-metrics-updated', 'duckdb-home-dashboard-updated', 'duckdb-schema-changed', 'duckdb-saved-queries-updated'];
    events.forEach(event => window.addEventListener(event, reload));
    return () => {
      refreshVersion.current++;
      dataVersion.current++;
      events.forEach(event => window.removeEventListener(event, reload));
      window.removeEventListener('duckdb-database-changed', databaseChanged);
    };
  }, [refreshCharts]);

  useEffect(() => {
    const metricId = currentMetricId || null;
    setMetricFilter(metricId);
    if (metricId) {
      setTableFilter('all'); setTypeFilter('all'); setCategoryFilter('all'); setSearchQuery('');
    }
  }, [currentMetricId]);
  useEffect(() => {
    if (!currentMetricId) setTableFilter(currentTable && tables.includes(currentTable) ? currentTable : 'all');
  }, [currentTable, tables, currentMetricId]);

  const fetchAllChartData = useCallback(async (chartList: MetricChart[]) => {
    const version = ++dataVersion.current;
    const catalog = activeAnalysisDatabase();
    setIsLoadingData(chartList.length > 0);
    setChartDataMap({});
    setChartErrors({});
    const dataMap: Record<string, any[]> = {};
    const errors: Record<string, string> = {};
    const queue = [...chartList];
    const worker = async () => { while (queue.length && version === dataVersion.current && catalog === activeAnalysisDatabase()) {
      const chart = queue.shift()!;
      try {
        if (!chart.sql?.trim()) throw new Error('图表缺少查询 SQL');
        dataMap[chart.id] = await executeAnalysisQuery(chart.sql);
      } catch (error) {
        errors[chart.id] = (error as Error).message;
      }
      if (version === dataVersion.current && catalog === activeAnalysisDatabase()) {
        setChartDataMap({ ...dataMap });
        setChartErrors({ ...errors });
      }
    } };
    await Promise.all(Array.from({ length: Math.min(4, chartList.length) }, worker));
    if (version !== dataVersion.current || catalog !== activeAnalysisDatabase()) return;
    setChartDataMap(dataMap);
    setChartErrors(errors);
    setIsLoadingData(false);
  }, []);

  useEffect(() => { void fetchAllChartData(charts); }, [charts, fetchAllChartData]);

  useEffect(() => {
    if (!isBuilderOpen) return;
    let active = true;
    setBuilderLoading(true);
    setBuilderData([]);
    setBuilderColumns([]);
    setBuilderError(null);
    void (async () => {
      try {
        const source = editingChart?.sourceTable || builderSourceTable;
        const sql = editingChart?.sql || (source ? `SELECT * FROM ${quoteTable(source)} LIMIT 100` : '');
        if (!sql) throw new Error('请先选择真实数据表');
        const rows = await executeAnalysisQuery(sql);
        const cols = rows.length ? Object.keys(rows[0]) : source ? await duckDBService.getTableColumns(source) : [];
        if (!active) return;
        setBuilderData(rows);
        setBuilderColumns(cols);
      } catch (error) {
        if (active) setBuilderError((error as Error).message);
      } finally { if (active) setBuilderLoading(false); }
    })();
    return () => { active = false; };
  }, [isBuilderOpen, editingChart, builderSourceTable]);

  // 从指标批量生成图表
  const handleGenerateFromMetrics = async () => {
    if (isGeneratingMetrics) return;
    const catalog = activeAnalysisDatabase();
    const packages = metricAnalyzer.loadMetricPackages();
    const allMetrics = packages.flatMap((p) => p.metrics.map((m) => ({ metric: m, pkg: p })));

    if (allMetrics.length === 0) {
      toastService.info('暂无已定义的业务指标，请先前往【指标】中心创建指标包');
      return;
    }

    setIsGeneratingMetrics(true);
    let createdCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    try {
      for (const { metric, pkg } of allMetrics) {
        if (catalog !== activeAnalysisDatabase()) throw new Error('数据库已切换，已停止生成');
        // 如果指标已有图表则跳过
        const exists = charts.some((c) => c.metricId === metric.id);
        if (exists) { skippedCount++; continue; }

        try {
          const sourceTable = metricSource(metric, pkg.sourceTables || []);
          const chart = await metricAnalyzer.generateChart(metric, pkg.id, sourceTable);

          createdCount++;
        } catch (e) {
          failedCount++;
          console.warn('Failed to generate chart for metric:', metric.name, e);
        }
      }

      refreshCharts();
      if (createdCount > 0) {
        toastService.success(`成功从业务指标生成 ${createdCount} 张新图表`);
      } else if (!failedCount) {
        toastService.info(`已有 ${skippedCount} 个指标图表，无需重复生成`);
      }
      if (failedCount) toastService.warning(`${failedCount} 个指标未生成图表，请检查数据源和指标 SQL`);
    } catch (err: any) {
      toastService.error(`生成失败: ${err.message || '未知错误'}`);
    } finally {
      setIsGeneratingMetrics(false);
    }
  };

  const handleSaveChartFromBuilder = async (config: ChartConfig, context?: { sql: string; sourceTable: string }) => {
    if (isSaving) return;
    const catalog = activeAnalysisDatabase();
    setIsSaving(true);
    try {
      if (editingChart) {
        await updateVisualizationAsset(editingChart, config);
      } else {
        const sourceTable = context?.sourceTable || builderSourceTable;
        if (!sourceTable && !context?.sql) throw new Error('请先选择真实数据表');
        const sql = context?.sql || `SELECT * FROM ${quoteTable(sourceTable)} LIMIT 100`;
        const rows = await executeAnalysisQuery(sql);
        const columns = rows.length ? Object.keys(rows[0]) : await duckDBService.getTableColumns(sourceTable);
        if (catalog !== activeAnalysisDatabase()) throw new Error('数据库已切换，请重新创建图表');
        const selected = [...config.yKeys, ...(config.yRightKeys || []), ...(config.xKey ? [config.xKey] : [])];
        if (!config.yKeys.length || selected.some(key => !columns.includes(key))) {
          throw new Error('图表字段必须来自当前查询结果，请重新选择坐标轴');
        }
        if (rows.length && config.aggregation !== 'count' && !['table', 'pivot'].includes(config.type)
          && config.yKeys.some(key => !rows.some(row => chartNumber(row[key]) !== null))) {
          throw new Error('数值轴需要实际数值字段，请选择数值列或使用计数聚合');
        }
        metricAnalyzer.saveMetricChart({
          id: `chart_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          metricName: config.metricName || config.title || '自定义探索图表',
          metricId: config.metricId, metricPackageId: config.metricPackageId,
          sourceTable, sql, chartConfig: config, createdAt: Date.now(),
        });
      }
      toastService.success('图表已保存至可视化资产库');
      setIsBuilderOpen(false);
      setEditingChart(null);
      await refreshCharts();
    } catch (error) { toastService.error('图表保存失败', (error as Error).message); }
    finally { setIsSaving(false); }
  };

  const handleDeleteChart = async (chartId: string) => {
    const chart = charts.find(item => item.id === chartId);
    if (!chart || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteVisualizationAsset(chart);
      await refreshCharts();
      toastService.success('图表已删除，首页组件同步移除');
      setDeletingChart(null);
    } catch (error) { toastService.error('删除失败', (error as Error).message); }
    finally { setIsDeleting(false); }
  };

  // 打开编辑
  const handleEditChart = (chart: MetricChart) => {
    setEditingChart(chart);
    setIsBuilderOpen(true);
  };

  const [pinningIds, setPinningIds] = useState<Set<string>>(new Set());
  const handlePinToDashboard = async (chart: MetricChart) => {
    if (pinningIds.has(chart.id)) return;
    const wasPinned = pinnedChartIds.has(chart.id);
    setPinningIds(prev => new Set(prev).add(chart.id));
    try {
      if (wasPinned) await unpinChartFromHome(chart);
      else await pinChartToHome(chart);
      await refreshCharts();
      toastService.success(wasPinned ? '已从首页仪表盘移除图表' : '已固定到首页仪表盘');
    } catch (error) { toastService.error('首页联动失败', (error as Error).message); }
    finally { setPinningIds(prev => { const next = new Set(prev); next.delete(chart.id); return next; }); }
  };

  // 查看血缘
  const handleShowLineage = (chart: MetricChart) => {
    setLineageChart(chart);
    try {
      const graph = LineageService.parseSqlLineage(chart.sql);
      setLineageGraph(graph);
    } catch (err) {
      console.warn('Parse lineage failed:', err);
      setLineageGraph({
        nodes: [{ id: chart.id, label: chart.metricName, type: 'metric' }],
        edges: [],
        diagnostics: {
          parser: 'dt-sql-parser/postgresql',
          confidence: 'partial',
          errors: ['无法完整解析当前 SQL 血缘'],
          warnings: [],
        },
      });
    }
  };

  // 统计信息
  const metricCount = useMemo(() => charts.filter((c) => Boolean(c.metricId)).length, [charts]);
  const adhocCount = useMemo(() => charts.filter((c) => !c.metricId).length, [charts]);
  const pinnedCount = useMemo(() => charts.filter((c) => pinnedChartIds.has(c.id)).length, [charts, pinnedChartIds]);

  const tableOptions = useMemo(() => [...new Set([...tables, ...charts.flatMap(chart => [chart.sourceTable, ...extractTablesFromSql(chart.sql || '')].filter(Boolean) as string[])])], [tables, charts]);

  // 过滤后的图表列表
  const filteredCharts = useMemo(() => {
    return charts.filter((chart) => {
      if (metricFilter && chart.metricId !== metricFilter) return false;
      // 分类过滤
      if (categoryFilter === 'metric' && !chart.metricId) return false;
      if (categoryFilter === 'adhoc' && chart.metricId) return false;
      if (categoryFilter === 'pinned' && !pinnedChartIds.has(chart.id)) return false;

      // 图表类型过滤
      if (typeFilter !== 'all') {
        const rawType = chart.chartConfig?.type?.toLowerCase() || 'bar';
        const currentType = rawType === 'counter' ? 'kpi' : rawType === 'pivot' ? 'table' : rawType;
        if (currentType !== typeFilter.toLowerCase()) return false;
      }

      // 关联表过滤
      if (tableFilter !== 'all') {
        const refs = [chart.sourceTable, ...extractTablesFromSql(chart.sql || '')].filter(Boolean);
        if (!refs.some(ref => matchesVisualizationTable(ref!, tableFilter))) return false;
      }

      // 关键词搜索
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = (chart.chartConfig?.title || '').toLowerCase().includes(q);
        const nameMatch = (chart.metricName || '').toLowerCase().includes(q);
        const sqlMatch = (chart.sql || '').toLowerCase().includes(q);
        if (!titleMatch && !nameMatch && !sqlMatch) return false;
      }

      return true;
    });
  }, [charts, categoryFilter, typeFilter, tableFilter, searchQuery, pinnedChartIds, metricFilter]);

  const inspectedChart = charts.find(chart=>chart.id===inspectedId);
  const renderCard = (chart:MetricChart, inspecting=false) => <VisualizationCard
    key={chart.id} chart={chart} data={chartDataMap[chart.id] || []} error={chartErrors[chart.id]}
    instanceId={inspecting ? `viz-inspector-${chart.id}` : undefined}
    loading={isLoadingData && !chartDataMap[chart.id] && !chartErrors[chart.id]}
    pinning={pinningIds.has(chart.id)} isPinned={pinnedChartIds.has(chart.id)}
    onOpenInSql={onExecuteSql ? sql=>onExecuteSql(sql,true) : undefined}
    onNavigateToMetrics={onNavigateToMetrics && availableMetricIds.has(chart.metricId || '') ? onNavigateToMetrics : undefined}
    onNavigateToData={onNavigateToData}
    onShowLineage={value=>{ if(inspecting)setInspectedId(null); handleShowLineage(value); }}
    onPinToDashboard={handlePinToDashboard}
    onEdit={value=>{ if(inspecting)setInspectedId(null); handleEditChart(value); }}
    onDelete={()=>{ if(inspecting)setInspectedId(null); setDeletingChart(chart); }}
    onInspect={inspecting ? undefined : ()=>setInspectedId(chart.id)}
  />;

  return (
    <div className="visualization-surface flex h-full w-full min-w-0 flex-col overflow-hidden bg-monokai-bg font-sans text-xs">
      {/* 顶部 PageHeader */}
      <PageHeader
        className="viz-library-header flex-wrap [&>div:first-child]:min-w-[260px] [&>div:first-child]:flex-1"
        title="可视化资产"
        description="查看每一个发现，追溯每一份数据。图表、指标与查询在这里连接。"
        icon={PieChart}
        tone="accent"
        badge={
          <div className="flex flex-wrap shrink-0 items-center gap-1.5 ml-2">
            <span className="rounded-full bg-monokai-surface px-2.5 py-0.5 text-xs font-mono font-medium text-monokai-fg border border-monokai-border/80">
              共 {charts.length} 张图表
            </span>
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {onNavigateToDashboard && <ActionButton className="viz-home-action" variant="ghost" size="sm" icon={LayoutDashboard} onClick={onNavigateToDashboard}>首页仪表盘</ActionButton>}
            <ActionButton
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              onClick={() => refreshCharts()}
              loading={isLoadingAssets || isLoadingData}
              className="viz-secondary-action"
              aria-label="刷新数据"
            >
              刷新数据
            </ActionButton>
            <ActionButton
              variant="secondary"
              size="sm"
              icon={Sparkles}
              onClick={handleGenerateFromMetrics}
              loading={isGeneratingMetrics}
              title="根据现有业务指标体系批量生成推荐图表"
              className="viz-secondary-action"
              aria-label="从指标生成"
            >
              从指标生成
            </ActionButton>
            <ActionButton
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => {
                setEditingChart(null);
                setBuilderSourceTable(currentTable || tables[0] || '');
                setIsBuilderOpen(true);
              }}
            >
              新建图表
            </ActionButton>
          </div>
        }
      />

      {/* 过滤控制栏 */}
      <ModalShell open={Boolean(inspectedChart)} title="专注查看" description="查看图表、查询与数据来源" onClose={()=>setInspectedId(null)} size="xl" className="visualization-surface viz-inspector">
        {inspectedChart && renderCard(inspectedChart,true)}
      </ModalShell>
      <FilterBar className="viz-library-filterbar justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedTabs
            aria-label="图表分类筛选"
            value={categoryFilter}
            onChange={(val) => setCategoryFilter(val as any)}
            tone="accent"
            size="sm"
            items={[
              { value: 'all', label: '全部图表', badge: charts.length },
              { value: 'metric', label: '指标衍生', badge: metricCount },
              { value: 'adhoc', label: '即席图谱', badge: adhocCount },
              { value: 'pinned', label: '已固定首页', badge: pinnedCount },
            ]}
          />

          {/* 表名选择 */}
          <div id="viz-library-refinements" data-expanded={refinementsOpen} className="viz-refinements" role="group" aria-label="来源与类型筛选">
          <div className="flex items-center gap-1.5 text-xs text-monokai-comment">
            <span className="whitespace-nowrap">关联表:</span>
            <FormSelect sizeVariant="sm"
              aria-label="关联数据表筛选"
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
              className="w-auto max-w-[16rem]"
            >
              <option value="all">全部数据表</option>
              {tableOptions.map((tbl) => (
                <option key={tbl} value={tbl}>
                  {tbl}
                </option>
              ))}
            </FormSelect>
          </div>

          {/* 图表类型选择 */}
          <div className="flex items-center gap-1.5 text-xs text-monokai-comment">
            <span className="whitespace-nowrap">图表类型:</span>
            <FormSelect sizeVariant="sm"
              aria-label="图表类型筛选"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-auto max-w-[16rem]"
            >
              <option value="all">全部类型</option>
              {listChartTypes().filter(type => type.id !== 'counter').map(type => <option key={type.id} value={type.id}>{type.label}</option>)}
            </FormSelect>
          </div>
          </div>
        </div>

        {/* 搜索框 */}
        <div className="viz-library-search">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="搜索图表名称、指标或 SQL..."
          size="sm"
          className="w-full sm:w-64"
        />
          <button type="button" className="viz-refinement-toggle" aria-controls="viz-library-refinements" aria-expanded={refinementsOpen} onClick={()=>setRefinementsOpen(value=>!value)}><Filter size={15} aria-hidden="true" />筛选{(tableFilter!=='all'||typeFilter!=='all')&&<span>{Number(tableFilter!=='all')+Number(typeFilter!=='all')}</span>}</button>
        </div>
      </FilterBar>

      {metricFilter && (
        <div className="flex items-center justify-between border-b border-monokai-cyan/20 bg-monokai-cyan/5 px-4 py-2 text-2xs text-monokai-cyan">
          <div className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-monokai-cyan" />
            <span>当前正以关联指标模式筛选图表资产</span>
          </div>
          <button
            type="button"
            className="font-medium underline hover:text-monokai-fg transition-colors cursor-pointer"
            onClick={() => {
              useAnalysisWorkspace.getState().setVisualizationMetricId(null);
              setMetricFilter(null);
              setTableFilter('all');
            }}
          >
            清除关联，查看全部图表
          </button>
        </div>
      )}
      {loadError && charts.length > 0 && (
        <div role="alert" className="flex items-center justify-between border-b border-monokai-pink/30 bg-monokai-pink/10 px-4 py-2 text-2xs text-monokai-pink">
          <span>资产加载异常：{loadError}</span>
          <button type="button" className="underline font-medium hover:text-monokai-fg transition-colors" onClick={() => void refreshCharts()}>
            重试
          </button>
        </div>
      )}
      {/* 主展示区 */}
      <div className="viz-library-content flex-1 min-h-0 overflow-y-auto p-3 sm:p-4">
        {charts.length > 0 && <div className="viz-library-viewbar">
          <p aria-live="polite" aria-atomic="true">显示 <strong>{filteredCharts.length}</strong> / {charts.length} 张图表</p>
          <div role="group" aria-label="图表展示方式">
            <button type="button" aria-pressed={presentation==='gallery'} onClick={()=>setPresentation('gallery')}><LayoutGrid size={15} aria-hidden="true" />画廊</button>
            <button type="button" aria-pressed={presentation==='list'} onClick={()=>setPresentation('list')}><List size={15} aria-hidden="true" />列表</button>
          </div>
        </div>}
        {isLoadingAssets && !charts.length ? (
          <div role="status" className="flex h-64 flex-col items-center justify-center gap-2 text-monokai-comment">
            <RefreshCw className="h-5 w-5 animate-spin text-monokai-accent" />
            <span className="text-2xs">正在载入可视化资产…</span>
          </div>
        ) : loadError && !charts.length ? (
          <EmptyState
            title="可视化资产加载失败"
            description={loadError}
            icon={BarChart2}
            className="my-12"
            action={<ActionButton size="sm" variant="secondary" onClick={() => void refreshCharts()}>重试加载</ActionButton>}
          />
        ) : charts.length === 0 ? (
          <EmptyState
            title="暂无可视化图表资产"
            description="当前尚未沉淀图表。您可以从真实业务指标生成图表，或选择当前数据库的数据表创建探索图表。首页与 SQL 工作台保存的图表也会显示在这里。"
            icon={BarChart2}
            className="my-12"
            action={
              <ActionButton
                variant="primary"
                size="sm"
                icon={Sparkles}
                onClick={handleGenerateFromMetrics}
                loading={isGeneratingMetrics}
              >
                从指标自动生成图表
              </ActionButton>
            }
            secondaryAction={onNavigateToMetrics ? <ActionButton variant="secondary" size="sm" onClick={() => onNavigateToMetrics('')}>前往指标中心</ActionButton> : undefined}
          />
        ) : filteredCharts.length === 0 ? (
          <EmptyState
            title="未找到匹配的图表"
            description="当前筛选条件下没有图表资产，请尝试调整搜索关键词、分类或清除类型筛选。"
            icon={Filter}
            className="my-12"
            action={
              <ActionButton
                variant="secondary"
                size="sm"
                onClick={() => {
                  useAnalysisWorkspace.getState().setVisualizationMetricId(null);
                  setMetricFilter(null);
                  setSearchQuery('');
                  setCategoryFilter('all');
                  setTableFilter('all');
                  setTypeFilter('all');
                }}
              >
                重置所有筛选
              </ActionButton>
            }
          />
        ) : (
          presentation==='list' ? <VisualizationAssetList charts={filteredCharts} data={chartDataMap} errors={chartErrors} loading={isLoadingData} pinned={pinnedChartIds} onInspect={setInspectedId}/> :
          <div className="viz-gallery-grid grid items-start gap-5 min-w-0" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))' }}>
            {filteredCharts.map(chart=>renderCard(chart))}
          </div>
        )}
      </div>

      <ModalShell open={isBuilderOpen} title={editingChart ? `编辑图表：${editingChart.chartConfig?.title || editingChart.metricName}` : '新建可视化图表'} onClose={closeBuilder} size="xl" icon={BarChart2} className="visualization-surface">
        {!editingChart && (
          <div className="mb-3 space-y-1.5 rounded-lg border border-monokai-border bg-monokai-sidebar/60 p-3">
            <label className="flex flex-wrap items-center gap-2 text-2xs font-semibold uppercase tracking-wider text-monokai-comment">
              <span>基础数据源表</span>
              <FormSelect aria-label="图表数据源表" value={builderSourceTable} disabled={isSaving} onChange={event => setBuilderSourceTable(event.target.value)} className="sm:max-w-xs text-xs font-mono">
                <option value="">请选择数据表…</option>
                {tables.map(table => <option key={table} value={table}>{table}</option>)}
              </FormSelect>
            </label>
            <p className="text-2xs text-monokai-comment leading-relaxed">
              新建探索图表默认读取前 100 行样本作为快速配置与渲染依据；完整 SQL 语法可在生成后一键带入 SQL 编辑器执行。
            </p>
          </div>
        )}
        {builderLoading ? (
          <div role="status" className="flex h-64 flex-col items-center justify-center gap-2 text-monokai-comment">
            <RefreshCw className="h-5 w-5 animate-spin text-monokai-accent" />
            <span className="text-2xs">正在读取数据表结构与字段…</span>
          </div>
        ) : builderError && (editingChart || builderSourceTable) ? (
          <div role="alert" className="flex items-center gap-2 rounded-lg border border-monokai-pink/30 bg-monokai-pink/10 p-3 text-xs text-monokai-pink">
            <span>{builderError}</span>
          </div>
        ) : (
          <div className="relative h-[65dvh] min-h-[420px] rounded-lg overflow-hidden border border-monokai-border">
            <ChartBuilder columns={builderColumns} data={builderData} initialConfig={editingChart?.chartConfig} saveLabel="保存图表" saving={isSaving} allowMetricMode={!editingChart} onSave={handleSaveChartFromBuilder} onCancel={closeBuilder} />
          </div>
        )}
      </ModalShell>
      <ModalShell open={Boolean(lineageChart && lineageGraph)} title={`图表数据血缘：${lineageChart?.chartConfig?.title || lineageChart?.metricName || ''}`} onClose={() => { setLineageChart(null); setLineageGraph(null); }} size="lg" icon={GitBranch} className="visualization-surface">
        {lineageGraph && <LineageGraphView graph={lineageGraph} embedded={false} onClose={() => { setLineageChart(null); setLineageGraph(null); }} />}
      </ModalShell>
      <ModalShell open={Boolean(deletingChart)} title="删除图表资产" onClose={() => { if (!isDeleting) setDeletingChart(null); }} size="sm" className="visualization-surface" footer={<>
        <ActionButton size="sm" variant="secondary" disabled={isDeleting} onClick={() => setDeletingChart(null)}>取消</ActionButton>
        <ActionButton size="sm" variant="danger" loading={isDeleting} onClick={() => deletingChart && void handleDeleteChart(deletingChart.id)}>确认删除</ActionButton>
      </>}>
        <div className="space-y-2 py-1 text-xs">
          <p className="text-monokai-fg leading-relaxed">
            确定要删除图表 <strong className="text-monokai-accent font-semibold font-mono">「{deletingChart?.chartConfig?.title || deletingChart?.metricName}」</strong> 吗？
          </p>
          <p className="text-2xs text-monokai-comment leading-relaxed">
            删除后该图表将从多维可视化中心中移除，若已固定至首页仪表盘也将同步解除固定。底层物理数据表与查询 SQL 不受影响。
          </p>
        </div>
      </ModalShell>
    </div>
  );
};
