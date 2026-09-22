import React, { useState, useEffect } from 'react';
import { dbService } from '../services/dbService';
import { metricAnalyzer } from '../services/metricAnalyzer';
import { toastService } from '../services/toastService';
import { duckDBService } from '../services/duckdbService';
import { SavedQuery, MetricPackage, MetricDefinition, ChartType } from '../types';
import {
  PRESET_WIDGETS,
  PresetWidget,
  ensurePresetSavedQuery,
  createQuickTableWidget,
  createCustomSqlWidget,
  WidgetDisplayType,
} from '../services/presetWidgets';
import {
  X,
  Search,
  BarChart2,
  Table2,
  Package,
  Loader2,
  ChevronRight,
  Check,
  Plus,
  TrendingUp,
  PieChart,
  Target,
  Code2,
  Sparkles,
  Layers,
  LayoutGrid,
  Zap,
  SlidersHorizontal,
  Play,
  Database,
  RefreshCw,
  Cpu,
  ShieldCheck,
  Activity,
  FolderPlus,
} from 'lucide-react';

interface AddWidgetModalProps {
  onClose: () => void;
  onAdd: (queryId: string) => void;
}

type TabType = 'presets' | 'tables' | 'queries' | 'metrics' | 'sql';

const getChartIcon = (type?: string) => {
  switch (type) {
    case 'bar':
      return <BarChart2 size={15} className="text-monokai-blue" />;
    case 'line':
    case 'area':
      return <TrendingUp size={15} className="text-monokai-green" />;
    case 'pie':
    case 'doughnut':
      return <PieChart size={15} className="text-monokai-yellow" />;
    case 'scatter':
      return <Target size={15} className="text-monokai-orange" />;
    case 'counter':
    case 'value':
      return <Zap size={15} className="text-monokai-green" />;
    default:
      return <Table2 size={15} className="text-monokai-blue" />;
  }
};

const getChartTypeLabel = (type?: string) => {
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
    default:
      return '数据表格';
  }
};

export const AddWidgetModal: React.FC<AddWidgetModalProps> = ({ onClose, onAdd }) => {
  const [activeTab, setActiveTab] = useState<TabType>('presets');

  // 1. Presets Tab State
  const [presetFilter, setPresetFilter] = useState('');
  const [presetCategory, setPresetCategory] = useState<'all' | 'engine' | 'storage' | 'analytics' | 'activity' | 'pivot'>('all');
  const [selectedPresetId, setSelectedPresetId] = useState<string>(PRESET_WIDGETS[0]?.id || '');
  const [isMountingPreset, setIsMountingPreset] = useState(false);

  // 2. Table Visualizer Tab State
  const [dbTables, setDbTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [tableColumns, setTableColumns] = useState<string[]>([]);
  const [tableChartType, setTableChartType] = useState<WidgetDisplayType>('bar');
  const [tableXCol, setTableXCol] = useState<string>('');
  const [tableYCol, setTableYCol] = useState<string>('');
  const [tableAgg, setTableAgg] = useState<'none' | 'count' | 'sum' | 'avg'>('none');
  const [tableCustomTitle, setTableCustomTitle] = useState<string>('');
  const [tablePreviewData, setTablePreviewData] = useState<any[]>([]);
  const [isLoadingTableData, setIsLoadingTableData] = useState(false);

  // 3. Saved Queries Tab State
  const [queries, setQueries] = useState<SavedQuery[]>([]);
  const [queryFilter, setQueryFilter] = useState('');
  const [queryTypeFilter, setQueryTypeFilter] = useState<'all' | 'chart' | 'table' | 'value'>('all');
  const [selectedQueryId, setSelectedQueryId] = useState<string | null>(null);

  // 4. Metrics Tab State
  const [packages, setPackages] = useState<MetricPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<MetricPackage | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<MetricDefinition | null>(null);
  const [isGeneratingMetric, setIsGeneratingMetric] = useState(false);

  // 5. Custom SQL Tab State
  const [sqlWidgetTitle, setSqlWidgetTitle] = useState('自定义 SQL 挂件');
  const [sqlWidgetCode, setSqlWidgetCode] = useState('SELECT 100 as total_users, 45 as active_users, 95.5 as retention_rate');
  const [sqlWidgetType, setSqlWidgetType] = useState<WidgetDisplayType>('table');
  const [sqlPreviewData, setSqlPreviewData] = useState<any[]>([]);
  const [sqlPreviewCols, setSqlPreviewCols] = useState<string[]>([]);
  const [sqlXCol, setSqlXCol] = useState<string>('');
  const [sqlYCol, setSqlYCol] = useState<string>('');
  const [isTestingSql, setIsTestingSql] = useState(false);
  const [sqlError, setSqlError] = useState<string | null>(null);

  useEffect(() => {
    void loadData();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const loadData = async () => {
    try {
      const [qs, pkgs, tbls] = await Promise.all([
        dbService.getQueries(),
        Promise.resolve(metricAnalyzer.loadMetricPackages()),
        duckDBService.getTables().catch(() => []),
      ]);
      setQueries(qs);
      if (qs.length > 0) setSelectedQueryId(qs[0].id);

      setPackages(pkgs);
      if (pkgs.length > 0) {
        setSelectedPackage(pkgs[0]);
        if (pkgs[0].metrics.length > 0) setSelectedMetric(pkgs[0].metrics[0]);
      }

      setDbTables(tbls);
      if (tbls.length > 0) {
        setSelectedTable(tbls[0]);
        void loadTableMetadata(tbls[0]);
      }
    } catch (error) {
      console.error('Failed to load data for widget modal:', error);
    }
  };

  const loadTableMetadata = async (tableName: string) => {
    if (!tableName) return;
    setIsLoadingTableData(true);
    try {
      const schema = await duckDBService.getTableSchema(tableName);
      const cols = schema.map((c: any) => c.name);
      setTableColumns(cols);
      if (cols.length > 0) {
        setTableXCol(cols[0]);
        setTableYCol(cols[1] || cols[0]);
      }

      const res = await duckDBService.query(`SELECT * FROM "${tableName}" LIMIT 5`);
      setTablePreviewData(res);
    } catch (e) {
      console.error('Failed to load table preview:', e);
      setTablePreviewData([]);
    } finally {
      setIsLoadingTableData(false);
    }
  };

  // Seed sample saved queries
  const handleSeedSampleQueries = async () => {
    try {
      const q1Id = await ensurePresetSavedQuery('preset-engine-status');
      const q2Id = await ensurePresetSavedQuery('preset-tables-overview');
      const q3Id = await ensurePresetSavedQuery('preset-throughput-trend');
      const updated = await dbService.getQueries();
      setQueries(updated);
      setSelectedQueryId(q1Id);
      toastService.success('已自动填充系统常用分析查询');
    } catch (e: any) {
      toastService.error('填充样例失败', e.message);
    }
  };

  // 1. Mount Preset Handler
  const handleMountPreset = async (presetId: string) => {
    setIsMountingPreset(true);
    try {
      const savedQueryId = await ensurePresetSavedQuery(presetId);
      onAdd(savedQueryId);
      const preset = PRESET_WIDGETS.find(p => p.id === presetId);
      toastService.success(`预置组件「${preset?.name || '组件'}」已挂载至仪表板`);
      onClose();
    } catch (e: any) {
      toastService.error('挂载预置组件失败', e.message);
    } finally {
      setIsMountingPreset(false);
    }
  };

  // 2. Mount Table Visualizer Handler
  const handleMountTableWidget = async () => {
    if (!selectedTable) {
      toastService.warning('请先选择目标数据表');
      return;
    }
    try {
      const savedQueryId = await createQuickTableWidget({
        tableName: selectedTable,
        chartType: tableChartType,
        xKey: tableXCol,
        yKeys: tableYCol ? [tableYCol] : [],
        aggregation: tableAgg,
        customTitle: tableCustomTitle.trim() || undefined,
      });
      onAdd(savedQueryId);
      toastService.success(`数据表「${selectedTable}」图表组件已挂载`);
      onClose();
    } catch (e: any) {
      toastService.error('生成数据表组件失败', e.message);
    }
  };

  // 3. Mount Metric Handler
  const handleMetricSelect = async (metric: MetricDefinition) => {
    if (!selectedPackage || selectedPackage.sourceTables.length === 0) {
      toastService.warning('请先在指标配置中关联数据源表');
      return;
    }

    setIsGeneratingMetric(true);
    try {
      const sourceTable = selectedPackage.sourceTables[0];
      const chart = await metricAnalyzer.generateChart(metric, selectedPackage.id, sourceTable);
      const savedQueryId = await metricAnalyzer.convertToSavedQuery(chart);
      onAdd(savedQueryId);
      toastService.success(`指标「${metric.name}」已转换为挂件并添加到仪表板`);
      onClose();
    } catch (error: any) {
      toastService.error('生成图表失败', error.message);
    } finally {
      setIsGeneratingMetric(false);
    }
  };

  // 4. Mount Saved Query Handler
  const handleMountQuery = (queryId: string) => {
    onAdd(queryId);
    toastService.success('组件已挂载至仪表板');
    onClose();
  };

  // 5. Custom SQL Test & Mount Handlers
  const handleTestSql = async () => {
    if (!sqlWidgetCode.trim()) {
      setSqlError('请输入 SQL 语句');
      return;
    }
    setIsTestingSql(true);
    setSqlError(null);
    try {
      const clean = sqlWidgetCode.trim().replace(/;+$/, '');
      const sql = clean.toLowerCase().includes('limit') ? clean : `SELECT * FROM (${clean}) LIMIT 5`;
      const res = await duckDBService.query(sql);
      setSqlPreviewData(res);
      if (res.length > 0) {
        const cols = Object.keys(res[0]);
        setSqlPreviewCols(cols);
        setSqlXCol(cols[0] || '');
        setSqlYCol(cols[1] || cols[0] || '');
      } else {
        setSqlPreviewCols([]);
      }
      toastService.success('SQL 测试执行成功');
    } catch (e: any) {
      setSqlError(e.message || 'SQL 执行失败');
      setSqlPreviewData([]);
    } finally {
      setIsTestingSql(false);
    }
  };

  const handleMountCustomSql = async () => {
    if (!sqlWidgetCode.trim()) {
      toastService.warning('请输入有效 SQL 语句');
      return;
    }
    try {
      const savedQueryId = await createCustomSqlWidget({
        name: sqlWidgetTitle.trim() || '自定义 SQL 挂件',
        sql: sqlWidgetCode.trim(),
        chartType: sqlWidgetType,
        xKey: sqlXCol || undefined,
        yKeys: sqlYCol ? [sqlYCol] : undefined,
      });
      onAdd(savedQueryId);
      toastService.success('自定义 SQL 组件已挂载至仪表板');
      onClose();
    } catch (e: any) {
      toastService.error('创建自定义组件失败', e.message);
    }
  };

  // Presets filtering
  const filteredPresets = PRESET_WIDGETS.filter(p => {
    const matchSearch =
      p.name.toLowerCase().includes(presetFilter.toLowerCase()) ||
      p.desc.toLowerCase().includes(presetFilter.toLowerCase()) ||
      p.sql.toLowerCase().includes(presetFilter.toLowerCase());
    const matchCategory = presetCategory === 'all' || p.category === presetCategory;
    return matchSearch && matchCategory;
  });

  const activeSelectedPreset =
    PRESET_WIDGETS.find(p => p.id === selectedPresetId) || filteredPresets[0] || null;

  // Saved queries filtering
  const filteredQueries = queries.filter(q => {
    const matchName =
      q.name.toLowerCase().includes(queryFilter.toLowerCase()) ||
      q.sql.toLowerCase().includes(queryFilter.toLowerCase());
    const isChart = Boolean(q.charts && q.charts.length > 0);
    const isValue = q.widgetType === 'value';
    if (queryTypeFilter === 'chart') return matchName && isChart;
    if (queryTypeFilter === 'table') return matchName && !isChart && !isValue;
    if (queryTypeFilter === 'value') return matchName && isValue;
    return matchName;
  });

  const activeSelectedQuery =
    queries.find(q => q.id === selectedQueryId) || filteredQueries[0] || null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-[fadeIn_0.15s_ease-out]"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-widget-title"
        className="flex h-[86vh] w-[980px] max-w-full flex-col overflow-hidden rounded-lg border border-monokai-border bg-monokai-sidebar shadow-2xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-monokai-border bg-monokai-surface px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-md border border-monokai-border bg-monokai-surface text-monokai-accent">
              <Plus size={16} />
            </span>
            <div>
              <h2 id="add-widget-title" className="text-sm font-bold text-monokai-fg">
                添加组件至仪表板
              </h2>
              <p className="text-[11px] text-monokai-comment">
                提供预置系统储备库、数据表即席图表、已保存查询、语义指标库与自定义 SQL 全方位挂载
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭添加组件窗口"
            className="flex h-7 w-7 items-center justify-center rounded text-monokai-comment hover:bg-monokai-bg hover:text-monokai-fg transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Top Tab Bar */}
        <div className="flex shrink-0 border-b border-monokai-border bg-monokai-bg px-5 overflow-x-auto custom-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('presets')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
              activeTab === 'presets'
                ? 'border-monokai-accent text-monokai-fg'
                : 'border-transparent text-monokai-comment hover:text-monokai-fg'
            }`}
          >
            <Sparkles size={14} />
            <span>推荐与系统组件</span>
            <span className="rounded bg-monokai-surface px-1.5 py-0.2 font-mono text-[10px] text-monokai-comment border border-monokai-border">
              {PRESET_WIDGETS.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tables')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
              activeTab === 'tables'
                ? 'border-monokai-accent text-monokai-fg'
                : 'border-transparent text-monokai-comment hover:text-monokai-fg'
            }`}
          >
            <Database size={14} />
            <span>数据表即席图表</span>
            <span className="rounded bg-monokai-surface px-1.5 py-0.2 font-mono text-[10px] text-monokai-comment border border-monokai-border">
              {dbTables.length} 表
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('queries')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
              activeTab === 'queries'
                ? 'border-monokai-accent text-monokai-fg'
                : 'border-transparent text-monokai-comment hover:text-monokai-fg'
            }`}
          >
            <Table2 size={14} />
            <span>已保存查询与图表</span>
            <span className="rounded bg-monokai-surface px-1.5 py-0.2 font-mono text-[10px] text-monokai-comment border border-monokai-border">
              {queries.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('metrics')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
              activeTab === 'metrics'
                ? 'border-monokai-accent text-monokai-fg'
                : 'border-transparent text-monokai-comment hover:text-monokai-fg'
            }`}
          >
            <Zap size={14} />
            <span>业务语义指标库</span>
            <span className="rounded bg-monokai-surface px-1.5 py-0.2 font-mono text-[10px] text-monokai-comment border border-monokai-border">
              {packages.reduce((acc, p) => acc + p.metrics.length, 0)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sql')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
              activeTab === 'sql'
                ? 'border-monokai-accent text-monokai-fg'
                : 'border-transparent text-monokai-comment hover:text-monokai-fg'
            }`}
          >
            <Code2 size={14} />
            <span>自定义 SQL</span>
          </button>
        </div>

        {/* Tab 1: Presets Catalog */}
        {activeTab === 'presets' && (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left Col: Presets List & Filters */}
            <div className="flex w-[410px] shrink-0 flex-col border-r border-monokai-border bg-monokai-sidebar/50">
              <div className="border-b border-monokai-border p-3 space-y-2 bg-monokai-sidebar">
                <div className="flex items-center gap-2 rounded-lg border border-monokai-border bg-monokai-bg px-2.5 py-1.5 focus-within:border-monokai-accent transition-colors">
                  <Search size={14} className="text-monokai-comment shrink-0" />
                  <input
                    type="text"
                    placeholder="搜索预置组件名称或说明…"
                    value={presetFilter}
                    onChange={e => setPresetFilter(e.target.value)}
                    className="w-full bg-transparent text-xs text-monokai-fg placeholder-monokai-comment outline-none"
                    autoFocus
                  />
                  {presetFilter && (
                    <button
                      type="button"
                      onClick={() => setPresetFilter('')}
                      className="text-monokai-comment hover:text-monokai-fg cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: 'all', label: '全部' },
                    { id: 'engine', label: '引擎监控' },
                    { id: 'storage', label: '存储洞察' },
                    { id: 'analytics', label: '业务分析' },
                    { id: 'activity', label: '时序与审计' },
                    { id: 'pivot', label: '透视与表格' },
                  ].map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setPresetCategory(cat.id as any)}
                      className={`px-2 py-0.5 text-[10px] rounded-md border transition-colors cursor-pointer ${
                        presetCategory === cat.id
                          ? 'border-monokai-border-strong bg-monokai-surface text-monokai-fg font-medium shadow-xs'
                          : 'border-monokai-border bg-monokai-bg text-monokai-comment hover:text-monokai-fg hover:border-monokai-border-strong'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                {filteredPresets.map(preset => {
                  const isSelected = activeSelectedPreset?.id === preset.id;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => setSelectedPresetId(preset.id)}
                      className={`group relative flex cursor-pointer items-center justify-between rounded-lg border p-2.5 transition-all ${
                        isSelected
                          ? 'border-monokai-border-strong bg-monokai-surface text-monokai-fg shadow-xs'
                          : 'border-monokai-border bg-monokai-bg/60 hover:border-monokai-border-strong hover:bg-monokai-surface'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="shrink-0 p-1.5 rounded-md bg-monokai-sidebar border border-monokai-border">
                          {getChartIcon(preset.widgetType === 'value' ? 'value' : preset.chartConfig?.type || 'table')}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold text-monokai-fg group-hover:text-monokai-fg transition-colors">
                            {preset.name}
                          </div>
                          <p className="mt-0.5 truncate text-[10px] text-monokai-comment">
                            {preset.desc}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="rounded bg-monokai-bg px-1.5 py-0.2 font-mono text-[9px] text-monokai-comment border border-monokai-border">
                          {preset.badge}
                        </span>
                        <ChevronRight
                          size={14}
                          className={`transition-transform ${
                            isSelected ? 'text-monokai-accent translate-x-0.5' : 'text-monokai-comment/40'
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Col: Preset Inspector & Preview */}
            <div className="flex flex-1 flex-col overflow-y-auto bg-monokai-bg p-5 custom-scrollbar">
              {activeSelectedPreset ? (
                <div className="flex flex-col h-full justify-between space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between border-b border-monokai-border pb-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-monokai-fg">
                            {activeSelectedPreset.name}
                          </h3>
                          <span className="rounded-md border border-monokai-border bg-monokai-surface px-2 py-0.5 text-[10px] font-mono font-medium text-monokai-fg">
                            {activeSelectedPreset.badge}
                          </span>
                          <span className="rounded-md border border-monokai-border bg-monokai-surface px-2 py-0.5 text-[10px] font-mono font-medium text-monokai-comment">
                            {getChartTypeLabel(activeSelectedPreset.widgetType === 'value' ? 'value' : activeSelectedPreset.chartConfig?.type || 'table')}
                          </span>
                        </div>
                        <p className="text-xs text-monokai-comment">{activeSelectedPreset.desc}</p>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-monokai-fg">
                        <Code2 size={14} className="text-monokai-accent" /> 预置执行 SQL 语句
                      </div>
                      <pre className="max-h-44 overflow-x-auto rounded-lg border border-monokai-border bg-monokai-surface p-3 font-mono text-xs text-monokai-fg custom-scrollbar leading-relaxed">
                        {activeSelectedPreset.sql}
                      </pre>
                    </div>

                    {activeSelectedPreset.chartConfig && (
                      <div className="rounded-lg border border-monokai-border bg-monokai-sidebar/40 p-3 space-y-2">
                        <div className="text-xs font-semibold text-monokai-fg flex items-center gap-1.5">
                          <Layers size={13} className="text-monokai-accent" /> 图表配置规格
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-monokai-comment text-[11px]">X 轴维度字段：</span>
                            <div className="font-mono font-medium text-monokai-fg">
                              {activeSelectedPreset.chartConfig.xKey || '默认'}
                            </div>
                          </div>
                          <div>
                            <span className="text-monokai-comment text-[11px]">Y 轴指标度量：</span>
                            <div className="font-mono font-medium text-monokai-fg truncate">
                              {activeSelectedPreset.chartConfig.yKeys.join(', ')}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-monokai-border pt-4 flex items-center justify-between bg-monokai-bg">
                    <div className="text-xs text-monokai-comment flex items-center gap-1.5">
                      <LayoutGrid size={13} /> 建议栅格尺寸：{activeSelectedPreset.defaultGrid.w}x{activeSelectedPreset.defaultGrid.h}
                    </div>
                    <button
                      type="button"
                      disabled={isMountingPreset}
                      onClick={() => handleMountPreset(activeSelectedPreset.id)}
                      className="inline-flex items-center gap-2 rounded-md bg-monokai-accent px-4 py-2 text-xs font-semibold text-[#1e1f1c] hover:bg-monokai-accent-hover transition-colors shadow-xs active:scale-[0.98] cursor-pointer disabled:opacity-50"
                    >
                      {isMountingPreset ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                      <span>挂载此组件到仪表板</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-xs text-monokai-comment">
                  <span>请从左侧选择预置组件</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Table Visualizer */}
        {activeTab === 'tables' && (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left Col: Table Visualizer Config */}
            <div className="flex w-[420px] shrink-0 flex-col border-r border-monokai-border bg-monokai-sidebar/50 p-4 overflow-y-auto space-y-4 custom-scrollbar">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-monokai-fg flex items-center gap-1.5">
                    <Database size={13} className="text-monokai-blue" />
                    <span>选择数据表</span>
                  </label>
                </div>

                {dbTables.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-monokai-border p-3 text-center text-xs text-monokai-comment bg-monokai-bg">
                    <span>当前数据库无数据表</span>
                    <p className="mt-1 text-[11px] text-monokai-comment/80">
                      请先通过「数据接入」或「SQL 工作台」导入真实业务数据表
                    </p>
                  </div>
                ) : (
                  <select
                    value={selectedTable}
                    onChange={e => {
                      setSelectedTable(e.target.value);
                      void loadTableMetadata(e.target.value);
                    }}
                    className="w-full rounded-md border border-monokai-border bg-monokai-bg px-3 py-1.5 text-xs text-monokai-fg outline-none focus:border-monokai-accent/60 focus:ring-1 focus:ring-monokai-accent/30 cursor-pointer"
                  >
                    {dbTables.map(t => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Chart Type Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-monokai-fg flex items-center gap-1.5">
                  <SlidersHorizontal size={13} className="text-monokai-accent" />
                  <span>可视化展现形态</span>
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: 'bar', label: '柱状图', icon: BarChart2 },
                    { id: 'line', label: '折线图', icon: TrendingUp },
                    { id: 'area', label: '面积图', icon: Layers },
                    { id: 'pie', label: '饼图', icon: PieChart },
                    { id: 'doughnut', label: '环形图', icon: PieChart },
                    { id: 'scatter', label: '散点图', icon: Target },
                    { id: 'counter', label: 'KPI 卡片', icon: Zap },
                    { id: 'table', label: '数据表', icon: Table2 },
                  ].map(item => {
                    const Icon = item.icon;
                    const isSelected = tableChartType === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setTableChartType(item.id as WidgetDisplayType)}
                        className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-monokai-border-strong bg-monokai-surface text-monokai-fg font-semibold shadow-xs'
                            : 'border-monokai-border bg-monokai-bg text-monokai-comment hover:text-monokai-fg hover:border-monokai-border-strong'
                        }`}
                      >
                        <Icon size={14} className="mb-1" />
                        <span className="text-[10px]">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Field mapping */}
              {tableChartType !== 'table' && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-monokai-comment">X 轴 (维度字段)</label>
                    <select
                      value={tableXCol}
                      onChange={e => setTableXCol(e.target.value)}
                      className="w-full rounded-md border border-monokai-border bg-monokai-bg px-2 py-1 text-xs text-monokai-fg outline-none focus:border-monokai-accent/60"
                    >
                      {tableColumns.map(c => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-monokai-comment">Y 轴 (度量字段)</label>
                    <select
                      value={tableYCol}
                      onChange={e => setTableYCol(e.target.value)}
                      className="w-full rounded-md border border-monokai-border bg-monokai-bg px-2 py-1 text-xs text-monokai-fg outline-none focus:border-monokai-accent/60"
                    >
                      {tableColumns.map(c => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Aggregation */}
              {tableChartType !== 'table' && (
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-monokai-comment">聚合计算方式</label>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { id: 'none', label: '不聚合' },
                      { id: 'sum', label: 'SUM 求和' },
                      { id: 'avg', label: 'AVG 平均' },
                      { id: 'count', label: 'COUNT 计数' },
                    ].map(a => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setTableAgg(a.id as any)}
                        className={`px-2 py-1 text-[10px] rounded-md border transition-colors cursor-pointer ${
                          tableAgg === a.id
                            ? 'border-monokai-border-strong bg-monokai-surface text-monokai-fg font-semibold shadow-xs'
                            : 'border-monokai-border bg-monokai-bg text-monokai-comment hover:text-monokai-fg'
                        }`}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom Title */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-monokai-comment">组件标题 (可选)</label>
                <input
                  type="text"
                  placeholder="留空则自动生成标题…"
                  value={tableCustomTitle}
                  onChange={e => setTableCustomTitle(e.target.value)}
                  className="w-full rounded-md border border-monokai-border bg-monokai-bg px-3 py-1.5 text-xs text-monokai-fg outline-none focus:border-monokai-accent/60 focus:ring-1 focus:ring-monokai-accent/30"
                />
              </div>
            </div>

            {/* Right Col: Table Data Live Preview */}
            <div className="flex flex-1 flex-col justify-between overflow-y-auto bg-monokai-bg p-5 custom-scrollbar">
              <div className="space-y-4">
                <div className="border-b border-monokai-border pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-monokai-fg">
                      {selectedTable ? `数据表 [${selectedTable}] 结构与取样` : '即席图表预览'}
                    </h3>
                    <p className="text-xs text-monokai-comment">
                      包含 {tableColumns.length} 个可用字段 • 实时渲染前 5 行示例
                    </p>
                  </div>
                  {isLoadingTableData && <Loader2 size={16} className="animate-spin text-monokai-accent" />}
                </div>

                {/* Table Data Preview Grid */}
                <div className="rounded-lg border border-monokai-border bg-monokai-surface overflow-x-auto max-h-56 custom-scrollbar">
                  <table className="w-full border-collapse text-left font-mono text-xs">
                    <thead>
                      <tr className="border-b border-monokai-border bg-monokai-sidebar">
                        {tableColumns.map(c => (
                          <th key={c} className="px-3 py-1.5 text-[11px] font-semibold text-monokai-fg truncate">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-monokai-border/40">
                      {tablePreviewData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-monokai-bg/50">
                          {tableColumns.map(c => (
                            <td key={c} className="px-3 py-1.5 text-[11px] text-monokai-fg truncate">
                              {String(row[c] ?? 'NULL')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {tablePreviewData.length === 0 && (
                    <div className="py-6 text-center text-xs text-monokai-comment">暂无示例数据</div>
                  )}
                </div>
              </div>

              <div className="border-t border-monokai-border pt-4 flex items-center justify-between bg-monokai-bg">
                <div className="text-xs text-monokai-comment flex items-center gap-1.5">
                  <LayoutGrid size={13} /> 将以 6x4 栅格加入当前仪表板
                </div>
                <button
                  type="button"
                  disabled={!selectedTable}
                  onClick={handleMountTableWidget}
                  className="inline-flex items-center gap-2 rounded-md bg-monokai-accent px-4 py-2 text-xs font-semibold text-[#1e1f1c] hover:bg-monokai-accent-hover transition-colors shadow-xs active:scale-[0.98] cursor-pointer disabled:opacity-50"
                >
                  <Plus size={15} />
                  <span>生成并挂载至仪表板</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Saved Queries */}
        {activeTab === 'queries' && (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <div className="flex w-[390px] shrink-0 flex-col border-r border-monokai-border bg-monokai-sidebar/50">
              <div className="border-b border-monokai-border p-3 space-y-2 bg-monokai-sidebar">
                <div className="flex items-center gap-2 rounded-md border border-monokai-border bg-monokai-bg px-2.5 py-1.5 focus-within:border-monokai-accent/60">
                  <Search size={14} className="text-monokai-comment shrink-0" />
                  <input
                    type="text"
                    placeholder="搜索查询名称或 SQL 关键词…"
                    value={queryFilter}
                    onChange={e => setQueryFilter(e.target.value)}
                    className="w-full bg-transparent text-xs text-monokai-fg placeholder-monokai-comment outline-none"
                    autoFocus
                  />
                  {queryFilter && (
                    <button
                      type="button"
                      onClick={() => setQueryFilter('')}
                      className="text-monokai-comment hover:text-monokai-fg cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setQueryTypeFilter('all')}
                    className={`px-2.5 py-0.5 text-[11px] rounded-md border transition-colors cursor-pointer ${
                      queryTypeFilter === 'all'
                        ? 'border-monokai-border-strong bg-monokai-surface text-monokai-fg font-medium shadow-xs'
                        : 'border-monokai-border bg-monokai-bg text-monokai-comment hover:text-monokai-fg'
                    }`}
                  >
                    全部 ({queries.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setQueryTypeFilter('chart')}
                    className={`px-2.5 py-0.5 text-[11px] rounded-md border transition-colors cursor-pointer ${
                      queryTypeFilter === 'chart'
                        ? 'border-monokai-border-strong bg-monokai-surface text-monokai-fg font-medium shadow-xs'
                        : 'border-monokai-border bg-monokai-bg text-monokai-comment hover:text-monokai-fg'
                    }`}
                  >
                    图表类 ({queries.filter(q => q.charts && q.charts.length > 0).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setQueryTypeFilter('table')}
                    className={`px-2.5 py-0.5 text-[11px] rounded-md border transition-colors cursor-pointer ${
                      queryTypeFilter === 'table'
                        ? 'border-monokai-border-strong bg-monokai-surface text-monokai-fg font-medium shadow-xs'
                        : 'border-monokai-border bg-monokai-bg text-monokai-comment hover:text-monokai-fg'
                    }`}
                  >
                    表格类 ({queries.filter(q => (!q.charts || q.charts.length === 0) && q.widgetType !== 'value').length})
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                {filteredQueries.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center p-6 text-center text-xs text-monokai-comment">
                    <Table2 size={32} className="mb-2 opacity-40 text-monokai-comment" />
                    <span>暂无已保存查询</span>
                    <button
                      type="button"
                      onClick={handleSeedSampleQueries}
                      className="mt-3 rounded-md border border-monokai-border bg-monokai-surface px-3 py-1 text-xs font-semibold text-monokai-fg hover:bg-monokai-hover cursor-pointer"
                    >
                      一键载入常用分析查询
                    </button>
                  </div>
                ) : (
                  filteredQueries.map(q => {
                    const hasCharts = q.charts && q.charts.length > 0;
                    const chartConfig = hasCharts ? q.charts![0] : null;
                    const isSelected = activeSelectedQuery?.id === q.id;

                    return (
                      <div
                        key={q.id}
                        onClick={() => setSelectedQueryId(q.id)}
                        className={`group relative flex cursor-pointer items-center justify-between rounded-lg border p-2.5 transition-all ${
                          isSelected
                            ? 'border-monokai-border-strong bg-monokai-surface text-monokai-fg shadow-xs'
                            : 'border-monokai-border bg-monokai-bg/60 hover:border-monokai-border-strong hover:bg-monokai-surface'
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className="shrink-0 p-1.5 rounded-md bg-monokai-sidebar border border-monokai-border">
                            {getChartIcon(q.widgetType === 'value' ? 'value' : chartConfig?.type || 'table')}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold text-monokai-fg group-hover:text-monokai-fg transition-colors">
                              {q.name}
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 text-[10px] text-monokai-comment font-mono">
                              <span>{getChartTypeLabel(q.widgetType === 'value' ? 'value' : chartConfig?.type || 'table')}</span>
                              <span>•</span>
                              <span>{new Date(q.createdAt).toLocaleDateString('zh-CN')}</span>
                            </div>
                          </div>
                        </div>

                        <ChevronRight
                          size={14}
                          className={`shrink-0 transition-transform ${
                            isSelected ? 'text-monokai-accent translate-x-0.5' : 'text-monokai-comment/40'
                          }`}
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Column: Live Inspector & Preview */}
            <div className="flex flex-1 flex-col overflow-y-auto bg-monokai-bg p-5 custom-scrollbar">
              {activeSelectedQuery ? (
                <div className="flex flex-col h-full justify-between space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between border-b border-monokai-border pb-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-monokai-fg">{activeSelectedQuery.name}</h3>
                          <span className="rounded-md border border-monokai-border bg-monokai-surface px-2 py-0.5 text-[10px] font-mono font-medium text-monokai-comment">
                            {getChartTypeLabel(activeSelectedQuery.widgetType === 'value' ? 'value' : activeSelectedQuery.charts?.[0]?.type || 'table')}
                          </span>
                        </div>
                        <p className="text-xs text-monokai-comment">
                          创建时间：{new Date(activeSelectedQuery.createdAt).toLocaleString('zh-CN')}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-monokai-fg">
                        <Code2 size={14} className="text-monokai-accent" /> SQL 查询语句
                      </div>
                      <pre className="max-h-44 overflow-x-auto rounded-lg border border-monokai-border bg-monokai-surface p-3 font-mono text-xs text-monokai-fg custom-scrollbar leading-relaxed">
                        {activeSelectedQuery.sql}
                      </pre>
                    </div>

                    {activeSelectedQuery.charts && activeSelectedQuery.charts.length > 0 && (
                      <div className="rounded-lg border border-monokai-border bg-monokai-sidebar/40 p-3 space-y-2">
                        <div className="text-xs font-semibold text-monokai-fg flex items-center gap-1.5">
                          <Layers size={13} className="text-monokai-accent" /> 图表映射配置
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-monokai-comment text-[11px]">X 轴维度字段：</span>
                            <div className="font-mono font-medium text-monokai-fg">
                              {activeSelectedQuery.charts[0].xKey || '默认行序列'}
                            </div>
                          </div>
                          <div>
                            <span className="text-monokai-comment text-[11px]">Y 轴指标字段：</span>
                            <div className="font-mono font-medium text-monokai-fg truncate">
                              {activeSelectedQuery.charts[0].yKeys?.join(', ') || '未配置'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-monokai-border pt-4 flex items-center justify-between bg-monokai-bg">
                    <div className="text-xs text-monokai-comment flex items-center gap-1.5">
                      <LayoutGrid size={13} /> 默认以 6x4 栅格加入当前仪表板
                    </div>
                    <button
                      type="button"
                      onClick={() => handleMountQuery(activeSelectedQuery.id)}
                      className="inline-flex items-center gap-2 rounded-md bg-monokai-accent px-4 py-2 text-xs font-semibold text-[#1e1f1c] hover:bg-monokai-accent-hover transition-colors shadow-xs active:scale-[0.98] cursor-pointer"
                    >
                      <Plus size={15} />
                      <span>挂载到当前仪表板</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center text-xs text-monokai-comment">
                  <Table2 size={36} className="mb-2 opacity-30 text-monokai-comment" />
                  <span>请从左侧选择要添加的查询组件</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Semantic Metrics */}
        {activeTab === 'metrics' && (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {packages.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <Package size={44} className="mb-3 text-monokai-comment/50" />
                <h3 className="text-sm font-semibold text-monokai-fg">暂无语义指标包</h3>
                <p className="mt-1 text-xs text-monokai-comment">
                  您可以直接在「推荐与系统组件」中挂载开箱即用的 KPI 指标卡，或前往「指标中心」创建指标包
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('presets')}
                  className="mt-4 rounded-md border border-monokai-border bg-monokai-surface px-4 py-1.5 text-xs font-semibold text-monokai-fg hover:bg-monokai-hover cursor-pointer"
                >
                  浏览预置 KPI 与分析组件
                </button>
              </div>
            ) : (
              <>
                <div className="flex w-[390px] shrink-0 flex-col border-r border-monokai-border bg-monokai-sidebar/50">
                  <div className="border-b border-monokai-border p-3 bg-monokai-sidebar">
                    <div className="text-[11px] font-medium text-monokai-comment mb-1.5 uppercase tracking-wider">
                      选择指标包：
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {packages.map(pkg => (
                        <button
                          key={pkg.id}
                          type="button"
                          onClick={() => {
                            setSelectedPackage(pkg);
                            if (pkg.metrics.length > 0) setSelectedMetric(pkg.metrics[0]);
                          }}
                          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border transition-colors cursor-pointer ${
                            selectedPackage?.id === pkg.id
                              ? 'border-monokai-border-strong bg-monokai-surface text-monokai-fg font-semibold shadow-xs'
                              : 'border-monokai-border bg-monokai-bg text-monokai-comment hover:text-monokai-fg'
                          }`}
                        >
                          {selectedPackage?.id === pkg.id && <Check size={11} className="text-monokai-accent" />}
                          <span>{pkg.name}</span>
                          <span className="text-[10px] opacity-70">({pkg.metrics.length})</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                    {selectedPackage?.metrics.map(m => {
                      const isSelected = selectedMetric?.name === m.name;
                      return (
                        <div
                          key={m.name}
                          onClick={() => setSelectedMetric(m)}
                          className={`group flex cursor-pointer items-center justify-between rounded-lg border p-2.5 transition-all ${
                            isSelected
                              ? 'border-monokai-border-strong bg-monokai-surface text-monokai-fg shadow-xs'
                              : 'border-monokai-border bg-monokai-bg/60 hover:border-monokai-border-strong hover:bg-monokai-surface'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-semibold text-monokai-fg group-hover:text-monokai-fg">
                              {m.name}
                            </div>
                            <div className="mt-0.5 truncate text-[11px] text-monokai-comment">
                              {m.definition}
                            </div>
                          </div>
                          <ChevronRight
                            size={14}
                            className={`shrink-0 ${
                              isSelected ? 'text-monokai-accent translate-x-0.5' : 'text-monokai-comment/40'
                            }`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-1 flex-col overflow-y-auto bg-monokai-bg p-5 custom-scrollbar">
                  {selectedMetric ? (
                    <div className="flex flex-col h-full justify-between space-y-4">
                      <div className="space-y-3">
                        <div className="border-b border-monokai-border pb-3">
                          <h3 className="text-base font-bold text-monokai-fg">{selectedMetric.name}</h3>
                          <p className="mt-1 text-xs text-monokai-comment">{selectedMetric.definition}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="p-2.5 rounded-lg border border-monokai-border bg-monokai-sidebar/40">
                            <span className="text-monokai-comment text-[11px]">计算公式</span>
                            <div className="font-mono font-medium text-monokai-fg mt-0.5">{selectedMetric.formula}</div>
                          </div>
                          <div className="p-2.5 rounded-lg border border-monokai-border bg-monokai-sidebar/40">
                            <span className="text-monokai-comment text-[11px]">业务场景</span>
                            <div className="font-medium text-monokai-fg mt-0.5">{selectedMetric.scenario}</div>
                          </div>
                        </div>

                        {selectedMetric.sqlValidation && (
                          <div className="space-y-1">
                            <div className="text-xs font-semibold text-monokai-fg">验证 SQL</div>
                            <pre className="p-2.5 rounded-lg border border-monokai-border bg-monokai-surface font-mono text-xs text-monokai-fg">
                              {selectedMetric.sqlValidation}
                            </pre>
                          </div>
                        )}
                      </div>

                      <div className="border-t border-monokai-border pt-4 flex items-center justify-end bg-monokai-bg">
                        <button
                          type="button"
                          disabled={isGeneratingMetric}
                          onClick={() => handleMetricSelect(selectedMetric)}
                          className="inline-flex items-center gap-2 rounded-md bg-monokai-accent px-4 py-2 text-xs font-semibold text-[#1e1f1c] hover:bg-monokai-accent-hover transition-colors shadow-xs active:scale-[0.98] cursor-pointer disabled:opacity-50"
                        >
                          {isGeneratingMetric ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                          <span>生成图表并挂载至仪表板</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-monokai-comment">
                      请选择指标定义
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 5: Custom SQL */}
        {activeTab === 'sql' && (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left Col: SQL Editor */}
            <div className="flex w-[460px] shrink-0 flex-col border-r border-monokai-border bg-monokai-sidebar/50 p-4 overflow-y-auto space-y-3.5 custom-scrollbar">
              <div className="space-y-1">
                <label className="text-xs font-bold text-monokai-fg">组件名称</label>
                <input
                  type="text"
                  value={sqlWidgetTitle}
                  onChange={e => setSqlWidgetTitle(e.target.value)}
                  className="w-full rounded-md border border-monokai-border bg-monokai-bg px-3 py-1.5 text-xs text-monokai-fg outline-none focus:border-monokai-accent/60 focus:ring-1 focus:ring-monokai-accent/30"
                  placeholder="例如：实时留存率分析"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-monokai-fg">DuckDB SQL 语句</label>
                  <button
                    type="button"
                    disabled={isTestingSql}
                    onClick={handleTestSql}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-monokai-accent hover:underline cursor-pointer"
                  >
                    {isTestingSql ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                    <span>测试运行</span>
                  </button>
                </div>
                <textarea
                  value={sqlWidgetCode}
                  onChange={e => setSqlWidgetCode(e.target.value)}
                  rows={6}
                  className="w-full rounded-md border border-monokai-border bg-monokai-surface p-2.5 font-mono text-xs text-monokai-fg outline-none focus:border-monokai-accent/60 focus:ring-1 focus:ring-monokai-accent/30 resize-none custom-scrollbar leading-relaxed"
                  placeholder="SELECT ... FROM ..."
                />
                {sqlError && <p className="text-[11px] text-monokai-pink font-mono">{sqlError}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-monokai-fg">展现形态</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: 'table', label: '数据表' },
                    { id: 'bar', label: '柱状图' },
                    { id: 'line', label: '折线图' },
                    { id: 'area', label: '面积图' },
                    { id: 'pie', label: '饼图' },
                    { id: 'doughnut', label: '环形图' },
                    { id: 'counter', label: 'KPI 卡片' },
                  ].map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSqlWidgetType(item.id as WidgetDisplayType)}
                      className={`px-2 py-1 text-[10px] rounded-md border transition-colors cursor-pointer ${
                        sqlWidgetType === item.id
                          ? 'border-monokai-border-strong bg-monokai-surface text-monokai-fg font-semibold shadow-xs'
                          : 'border-monokai-border bg-monokai-bg text-monokai-comment hover:text-monokai-fg'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {sqlWidgetType !== 'table' && sqlWidgetType !== 'counter' && sqlPreviewCols.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-monokai-comment">X 轴维度</label>
                    <select
                      value={sqlXCol}
                      onChange={e => setSqlXCol(e.target.value)}
                      className="w-full rounded-md border border-monokai-border bg-monokai-bg px-2 py-1 text-xs text-monokai-fg outline-none focus:border-monokai-accent/60"
                    >
                      {sqlPreviewCols.map(c => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-monokai-comment">Y 轴指标</label>
                    <select
                      value={sqlYCol}
                      onChange={e => setSqlYCol(e.target.value)}
                      className="w-full rounded-md border border-monokai-border bg-monokai-bg px-2 py-1 text-xs text-monokai-fg outline-none focus:border-monokai-accent/60"
                    >
                      {sqlPreviewCols.map(c => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Right Col: SQL Test Results */}
            <div className="flex flex-1 flex-col justify-between overflow-y-auto bg-monokai-bg p-5 custom-scrollbar">
              <div className="space-y-3">
                <div className="border-b border-monokai-border pb-2 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-monokai-fg">SQL 执行取样结果</h3>
                  <span className="text-[10px] text-monokai-comment font-mono">{sqlPreviewData.length} 行数据</span>
                </div>

                <div className="rounded-lg border border-monokai-border bg-monokai-surface overflow-x-auto max-h-56 custom-scrollbar">
                  <table className="w-full border-collapse text-left font-mono text-xs">
                    <thead>
                      <tr className="border-b border-monokai-border bg-monokai-sidebar">
                        {sqlPreviewCols.map(c => (
                          <th key={c} className="px-3 py-1.5 text-[11px] font-semibold text-monokai-fg truncate">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-monokai-border/40">
                      {sqlPreviewData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-monokai-bg/50">
                          {sqlPreviewCols.map(c => (
                            <td key={c} className="px-3 py-1.5 text-[11px] text-monokai-fg truncate">
                              {String(row[c] ?? 'NULL')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {sqlPreviewData.length === 0 && (
                    <div className="py-6 text-center text-xs text-monokai-comment">
                      点击左侧「测试运行」查看执行数据
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-monokai-border pt-4 flex items-center justify-between bg-monokai-bg">
                <div className="text-xs text-monokai-comment flex items-center gap-1.5">
                  <LayoutGrid size={13} /> 默认以 6x4 栅格加入当前仪表板
                </div>
                <button
                  type="button"
                  onClick={handleMountCustomSql}
                  className="inline-flex items-center gap-2 rounded-md bg-monokai-accent px-4 py-2 text-xs font-semibold text-[#1e1f1c] hover:bg-monokai-accent-hover transition-colors shadow-xs active:scale-[0.98] cursor-pointer"
                >
                  <Plus size={15} />
                  <span>挂载自定义 SQL 组件</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
