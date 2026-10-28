import { FormSelect } from './ui/Workbench';
import './Visualization/visualizationUi.css';
import { metricSource } from '../services/metricSql';
import { extractTablesFromSql } from '../services/queryVizHint';
import { executeAnalysisQuery } from '../services/analysis/readQuery';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChartConfig, ColumnInfo, ChartType, MetricPackage, MetricDefinition } from '../types';
import { widgetRowsToChartSpec } from '../services/analysis/adapters/dashboardWidgetAdapter';
import { listChartTypes } from '../services/analysis/chartRegistry';
import { WidgetChartConfigPanel } from './Dashboard/WidgetChartConfigPanel';
import { ChartRenderer } from './charts/ChartRenderer';
import { chartContent, widgetSpace } from '../utils/dashboardLayout';
import { metricAnalyzer } from '../services/metricAnalyzer';
import { duckDBService } from '../services/duckdbService';
import { chartNumber, isIdentifierColumn } from '../utils/chartFormat';
import { X, Save, Check, Sparkles, Loader2, BarChart2, Settings2, SlidersHorizontal, MousePointerClick } from 'lucide-react';

interface ChartBuilderProps {
    columns: string[];
    data: any[];
    initialConfig?: ChartConfig;
    onSave: (config: ChartConfig, context?: { sql: string; sourceTable: string }) => void;
    saveLabel?: string;
    saving?: boolean;
    allowMetricMode?: boolean;
    onCancel: () => void;
}

    const StyledCheckbox = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
        <label className="flex items-center gap-2.5 cursor-pointer group">
            <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} className="h-4 w-4 accent-monokai-accent" />
            <span className={`text-xs transition-colors ${checked ? 'text-monokai-fg' : 'text-monokai-comment group-hover:text-monokai-fg'}`}>
                {label}
            </span>
        </label>
    );


export const ChartBuilder: React.FC<ChartBuilderProps> = ({ columns, data, initialConfig, onSave, onCancel, saveLabel = '保存并加入看板', saving = false, allowMetricMode = true }) => {
    const numericColumns = columns.filter(column => !isIdentifierColumn(column) && !/date|time|_at$|_on$/i.test(column)
        && data.some(row => row[column] != null && chartNumber(row[column]) !== null));
    const dimensionColumn = columns.find(column => !numericColumns.includes(column) && !isIdentifierColumn(column)) || columns[0] || '';
    const [config, setConfig] = useState<ChartConfig>(initialConfig ? { ...initialConfig, type: initialConfig.type === 'counter' ? 'kpi' : initialConfig.type } : {
        id: Date.now().toString(),
        title: '新建图表',
        type: 'bar',
        xKey: dimensionColumn,
        yKeys: numericColumns.slice(0, 1),
        yRightKeys: [],
        stacked: false,
        horizontal: false,
        aggregation: 'none',
        showLegend: true,
        showValues: true,
        legendPosition: 'bottom',
        legendAlign: 'center',
        unit: '',
    });

    const manualConfig = useRef(config);
    const [showSharedConfig, setShowSharedConfig] = useState(false);

    
    // 从指标创建相关状态
    const [createMode, setCreateMode] = useState<'manual' | 'metric'>('manual');
    const [metricPackages, setMetricPackages] = useState<MetricPackage[]>([]);
    const [selectedPackageId, setSelectedPackageId] = useState<string>('');
    const [selectedMetricId, setSelectedMetricId] = useState<string>('');
    const [metricData, setMetricData] = useState<any[]>([]);
    const [metricColumns, setMetricColumns] = useState<string[]>([]);
    const [isLoadingMetric, setIsLoadingMetric] = useState(false);
    const [metricError, setMetricError] = useState<string | null>(null);
    const [metricSql, setMetricSql] = useState('');

    // 加载指标包
    useEffect(() => {
        const packages = metricAnalyzer.loadMetricPackages();
        setMetricPackages(packages);
    }, []);

    const selectedPackage = metricPackages.find(p => p.id === selectedPackageId);
    const selectedMetric = selectedPackage?.metrics.find(m => m.id === selectedMetricId);

    // 统一列数据源：根据创建模式使用不同的列
    const availableColumns = createMode === 'metric'
        ? metricColumns 
        : columns;

    // 自动选择合适的图表类型
    const getAutoChartType = (data: any[], columns: string[]): ChartType => {
        if (!data || data.length === 0) return 'kpi';
        
        // 如果只有一行数据，使用计数器
        if (data.length === 1) return 'kpi';
        
        // 如果只有一列数值，可能是计数器
        if (columns.length <= 2 && data.length <= 1) return 'kpi';
        
        // 如果有多个分类，适合用柱状图或折线图
        if (data.length > 1 && data.length <= 10) return 'bar';
        
        // 如果有很多数据点，适合用折线图
        if (data.length > 10) return 'line';
        
        return 'bar';
    };

    // 处理从指标创建 - 执行SQL并获取数据
    useEffect(() => {
        let active = true;
        const fetchMetricData = async () => {
            if (createMode === 'metric' && selectedMetric && selectedPackage) {
                setIsLoadingMetric(true);
                setMetricError(null);
                setMetricData([]);
                setMetricColumns([]);
                setMetricSql('');
                try {
                    // 使用指标的sqlValidation或生成SQL
                    const sql = await metricAnalyzer.generateValidationSql(selectedMetric, metricSource(selectedMetric, selectedPackage.sourceTables || []));
                    if (!active) return;
                    
                    if (sql) {
                        // 执行SQL查询
                        const result = await executeAnalysisQuery(sql);
                        if (!active) return;
                        
                        const rows = Array.isArray(result) ? result : [];
                        if (!rows.length) throw new Error('指标查询结果为空，请先检查数据');
                        setMetricSql(sql);
                        setMetricData(rows);
                        
                        // 获取列名
                        if (rows.length > 0) {
                            const cols = Object.keys(rows[0]);
                            setMetricColumns(cols);
                            
                            // 自动配置图表
                            const measures = cols.filter(column => !isIdentifierColumn(column) && rows.some(row => row[column] != null && chartNumber(row[column]) !== null));
                            const chartType = measures.length ? getAutoChartType(rows, cols) : 'table';
                            
                            // 使用函数式更新避免依赖config
                            setConfig(prev => ({
                                ...prev,
                                id: Date.now().toString(),
                                title: selectedMetric.name || 'Metric Chart',
                                type: chartType,
                                xKey: cols.find(column => !measures.includes(column)) || cols[0] || '',
                                yKeys: measures.length ? [measures[0]] : cols.slice(0, 1),
                                yRightKeys: [],
                                unit: selectedMetric.unit || prev.unit || '',
                                yAxisLabel: selectedMetric.unit
                                  ? `${selectedMetric.name || ''} (${selectedMetric.unit})`
                                  : prev.yAxisLabel,
                                legendPosition: prev.legendPosition || 'bottom',
                                legendAlign: prev.legendAlign || 'center',
                                metricId: selectedMetric.id,
                                metricPackageId: selectedPackageId,
                                metricName: selectedMetric.name,
                                aggregation: chartType === 'kpi' ? 'sum' : 'none'
                            }));
                        }
                    }
                } catch (error: any) {
                    if (!active) return;
                    console.error('Failed to fetch metric data:', error);
                    setMetricError(error?.message || 'SQL执行失败，请检查指标配置');
                } finally {
                    if (active) setIsLoadingMetric(false);
                }
            } else {
                setIsLoadingMetric(false);
                setMetricSql('');
                setMetricData([]);
                setMetricColumns([]);
            }
        };
        
        fetchMetricData();
        return () => { active = false; };
    }, [createMode, selectedMetricId, selectedPackageId, selectedMetric, selectedPackage]);

    // 处理选择指标包
    const handlePackageChange = (pkgId: string) => {
        setSelectedPackageId(pkgId);
        setSelectedMetricId('');
        setMetricData([]);
        setMetricColumns([]);
    };

    const previewData = useMemo(() => widgetRowsToChartSpec(createMode === 'metric' ? metricData : data, config), [config, data, metricData, createMode]);

    const handleTypeChange = (type: ChartType) => {
        setConfig(prev => ({ ...prev, type }));
    };

    const toggleYKey = (key: string) => {
        const isPie = config.type === 'pie' || config.type === 'doughnut';
        if (isPie) {
            setConfig(prev => ({ ...prev, yKeys: [key] }));
            return;
        }

        setConfig(prev => {
            const exists = prev.yKeys.includes(key);
            if (exists) return { ...prev, yKeys: prev.yKeys.filter(k => k !== key) };
            return { ...prev, yKeys: [...prev.yKeys, key] };
        });
    };

    const toggleYRightKey = (key: string) => {
        setConfig(prev => {
            const current = prev.yRightKeys || [];
            const exists = current.includes(key);
            if (exists) return { ...prev, yRightKeys: current.filter(k => k !== key) };
            return { ...prev, yRightKeys: [...current, key] };
        });
    };

    const sectionLabel = (text: string, icon?: React.ReactNode) => (
        <div className="flex items-center gap-1.5 mb-2">
            {icon && <span className="text-monokai-comment">{icon}</span>}
            <span className="text-xs font-bold uppercase tracking-wider text-monokai-comment">{text}</span>
        </div>
    );

    const selectClass = "w-full bg-monokai-bg border border-monokai-border px-2.5 py-1.5 rounded-md text-xs text-monokai-fg outline-none focus:border-monokai-border-strong transition-colors";
    const inputClass  = "w-full bg-monokai-bg border border-monokai-border px-2.5 py-1.5 rounded-md text-xs text-monokai-fg outline-none focus:border-monokai-border-strong transition-colors placeholder-monokai-comment";

    return (
        <div className="visualization-surface absolute inset-0 z-50 bg-monokai-surface flex flex-col animate-[fadeIn_0.2s]">

            {/* ── Header ───────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-2 justify-between items-center px-4 py-2.5 border-b border-monokai-border bg-monokai-bg flex-shrink-0">
                <h2 className="text-xs font-bold text-monokai-fg flex items-center gap-2">
                    <BarChart2 size={15} className="text-monokai-yellow" />
                    <span>配置可视化图表</span>
                </h2>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        disabled={saving}
                        onClick={onCancel}
                        className="shrink-0 whitespace-nowrap px-3 py-1.5 border border-monokai-border bg-monokai-surface text-monokai-comment hover:text-monokai-fg hover:border-monokai-border-strong rounded-md text-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        取消
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            if (createMode === 'metric') {
                                onSave(config, { sql: metricSql, sourceTable: selectedMetric ? metricSource(selectedMetric, selectedPackage?.sourceTables || []) || extractTablesFromSql(metricSql)[0] || '' : '' });
                            } else if (initialConfig) {
                                onSave(config);
                            } else {
                                const { metricId, metricPackageId, metricName, ...manualConfig } = config;
                                onSave(manualConfig);
                            }
                        }}
                        disabled={saving || isLoadingMetric || !availableColumns.length || !config.yKeys.length || previewData?.emptyState === 'error' || (createMode === 'metric' && (!metricSql || Boolean(metricError)))}
                        className="shrink-0 whitespace-nowrap px-3 py-1.5 bg-monokai-green text-monokai-bg font-semibold rounded-md text-xs hover:brightness-105 active:scale-95 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                        title={saveLabel}
                    >
                        <Save size={12} />
                        <span>{saving ? '正在保存…' : saveLabel}</span>
                    </button>
                </div>
            </div>

            <fieldset disabled={saving} className="chart-builder-body m-0 border-0 p-0 flex flex-1 min-w-0 min-h-0 overflow-auto">

                {/* ── Configuration Sidebar ────────────────────────── */}
                <div className="chart-builder-settings w-80 bg-monokai-sidebar border-r border-monokai-border flex flex-col min-h-0 flex-shrink-0">
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-5 bg-monokai-bg">

                        {/* ── 创建方式 ── */}
                        <div>
                            {sectionLabel('创建方式')}
                            <div className="flex rounded-md overflow-hidden border border-monokai-border bg-monokai-sidebar">
                                <button
                                    aria-pressed={createMode === 'manual'}
                                    onClick={() => { setCreateMode('manual'); setConfig(manualConfig.current); setMetricError(null); }}
                                    className={`flex-1 px-3 py-2 text-xs font-bold transition-colors border-r border-monokai-border ${
                                        createMode === 'manual'
                                            ? 'bg-monokai-surface text-monokai-fg shadow-xs'
                                            : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/60'
                                    }`}
                                >
                                    手动创建
                                </button>
                                <button
                                    aria-pressed={createMode === 'metric'}
                                    onClick={() => { manualConfig.current = config; setCreateMode('metric'); setMetricError(null); }}
                                    disabled={!allowMetricMode || metricPackages.length === 0}
                                    className={`flex-1 px-3 py-2 text-xs font-bold transition-colors flex items-center justify-center gap-1 ${
                                        createMode === 'metric'
                                            ? 'bg-monokai-surface text-monokai-fg shadow-xs'
                                            : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/60 disabled:opacity-40 disabled:cursor-not-allowed'
                                    }`}
                                >
                                    <Sparkles size={11} className="text-monokai-yellow" />
                                    从指标创建
                                </button>
                            </div>
                        </div>

                        {/* ── 指标模式 ── */}
                        {createMode === 'metric' && (
                            <div className="flex flex-col gap-3 p-3 bg-monokai-surface border border-monokai-border rounded-lg">
                                {metricPackages.length === 0 ? (
                                    <p className="text-center text-monokai-comment text-xs py-3">
                                        暂无指标包，请先在"指标管理"中创建
                                    </p>
                                ) : (
                                    <>
                                        <div>
                                            {sectionLabel('选择指标包')}
                                            <FormSelect
                                                aria-label="选择指标包"
value={selectedPackageId}
                                                onChange={(e) => handlePackageChange(e.target.value)}
                                                className={selectClass}
                                            >
                                                <option value="">请选择指标包…</option>
                                                {metricPackages.map(pkg => (
                                                    <option key={pkg.id} value={pkg.id}>
                                                        {pkg.name} ({pkg.metrics.length} 个指标)
                                                    </option>
                                                ))}
                                            </FormSelect>
                                        </div>

                                        {selectedPackage && (
                                            <div>
                                                {sectionLabel('选择指标')}
                                                <FormSelect
                                                    aria-label="选择指标"
value={selectedMetricId}
                                                    onChange={(e) => setSelectedMetricId(e.target.value)}
                                                    className={selectClass}
                                                >
                                                    <option value="">请选择指标…</option>
                                                    {selectedPackage.metrics.map(metric => (
                                                        <option key={metric.id} value={metric.id}>
                                                            {metric.name} — {metric.category || '未分类'}
                                                        </option>
                                                    ))}
                                                </FormSelect>
                                            </div>
                                        )}

                                        {selectedMetric && (
                                            <div className="p-2.5 bg-monokai-amethyst/10 border border-monokai-amethyst/30 rounded text-xs flex flex-col gap-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-monokai-amethyst font-bold">{selectedMetric.name}</span>
                                                    {isLoadingMetric && (
                                                        <span className="flex items-center gap-1 text-monokai-accent text-xs">
                                                            <Loader2 size={11} className="animate-spin" />
                                                            加载中
                                                        </span>
                                                    )}
                                                </div>
                                                {selectedMetric.definition && (
                                                    <p className="text-monokai-comment leading-relaxed">{selectedMetric.definition}</p>
                                                )}
                                                {selectedMetric.formula && (
                                                    <code className="text-monokai-green font-mono mt-0.5">{selectedMetric.formula}</code>
                                                )}
                                                {metricData.length > 0 && (
                                                    <span className="text-monokai-green mt-1 flex items-center gap-1">
                                                        <Check size={10} /> 已获取 {metricData.length} 条数据
                                                    </span>
                                                )}
                                                {metricError && (
                                                    <span className="text-monokai-pink mt-1">✗ {metricError}</span>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        <div className="flex items-center justify-between">
                            <span className="text-2xs font-semibold uppercase tracking-wider text-monokai-comment">高级图表属性</span>
                            <button
                                type="button"
                                className="inline-flex items-center gap-1 text-2xs text-monokai-cyan hover:underline cursor-pointer"
                                onClick={() => setShowSharedConfig(true)}
                            >
                                <Settings2 size={11} aria-hidden="true" />
                                <span>全部字段与显示规则</span>
                            </button>
                        </div>
                        {showSharedConfig && <WidgetChartConfigPanel columns={availableColumns} config={config} onChange={next => { setConfig(next);setShowSharedConfig(false); }} onClose={() => setShowSharedConfig(false)}/>}
                        {/* ── 手动创建模式 ── */}
                        {createMode === 'manual' && (
                            <>
                                {/* Title */}
                                <div>
                                    {sectionLabel('图表标题')}
                                    <input
                                        aria-label="图表标题"
                                        value={config.title}
                                        onChange={e => setConfig({ ...config, title: e.target.value })}
                                        className={inputClass}
                                        placeholder="请输入图表标题"
                                    />
                                </div>

                                {/* Chart Type */}
                                <div>
                                    {sectionLabel('图表类型')}
                                    <div className="grid grid-cols-3 gap-1 bg-monokai-sidebar p-1 rounded-lg border border-monokai-border">
                                        {listChartTypes().filter(type => type.id !== 'counter').map(({id: t, label}) => (
                                            <button
                                                aria-pressed={config.type === t || (config.type === 'counter' && t === 'kpi')}
                                                key={t}
                                                type="button"
                                                onClick={() => handleTypeChange(t)}
                                                className={`py-1 px-1.5 rounded-md text-2xs capitalize font-medium transition-all cursor-pointer ${
                                                    config.type === t || (config.type === 'counter' && t === 'kpi')
                                                        ? 'bg-monokai-accent text-monokai-bg font-semibold shadow-xs'
                                                        : 'text-monokai-comment hover:bg-monokai-surface hover:text-monokai-fg'
                                                }`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Field mapping: Label/Value for pie; X/Y for cartesian */}
                                {(config.type === 'pie' || config.type === 'doughnut') ? (
                                    <>
                                        <div>
                                            {sectionLabel('Label（分类标签）')}
                                            <FormSelect
                                                aria-label="Label（分类标签）"
value={config.xKey}
                                                onChange={e => setConfig({ ...config, xKey: e.target.value })}
                                                className={selectClass}
                                            >
                                                {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                                            </FormSelect>
                                        </div>
                                        <div>
                                            {sectionLabel('Value（数值）')}
                                            <FormSelect
                                                aria-label="Value（数值）"
value={config.yKeys[0] || ''}
                                                onChange={e => setConfig({ ...config, yKeys: e.target.value ? [e.target.value] : [] })}
                                                className={selectClass}
                                            >
                                                {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                                            </FormSelect>
                                        </div>
                                    </>
                                ) : ['counter', 'kpi'].includes(config.type) ? (
                                    <div>
                                        {sectionLabel('Value（指标字段）')}
                                        <FormSelect
                                            aria-label="Value（指标字段）"
value={config.yKeys[0] || config.xKey || ''}
                                            onChange={e =>
                                                setConfig({
                                                    ...config,
                                                    xKey: e.target.value,
                                                    yKeys: e.target.value ? [e.target.value] : [],
                                                })
                                            }
                                            className={selectClass}
                                        >
                                            {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                                        </FormSelect>
                                    </div>
                                ) : (
                                    <>
                                        <div>
                                            {sectionLabel('X 轴（分类 / 时间）')}
                                            <FormSelect
                                                aria-label="X 轴（分类 / 时间）"
value={config.xKey}
                                                onChange={e => setConfig({ ...config, xKey: e.target.value })}
                                                className={selectClass}
                                            >
                                                {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                                            </FormSelect>
                                        </div>
                                        <div>
                                            {sectionLabel('Y 轴（数值系列）')}
                                            <div className="flex flex-col gap-0.5 max-h-36 overflow-y-auto border border-monokai-border rounded-md p-1.5 bg-monokai-sidebar/80 text-monokai-fg custom-scrollbar">
                                                {availableColumns.map(c => {
                                                    const isSelected = config.yKeys.includes(c);
                                                    return (
                                                        <label key={c} className="flex items-center gap-2 px-1.5 py-1 hover:bg-monokai-surface rounded cursor-pointer">
                                                            <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-monokai-accent border-monokai-accent' : 'border-monokai-border hover:border-monokai-border-strong'}`}>
                                                                {isSelected && <Check size={9} className="text-monokai-bg" />}
                                                            </div>
                                                            <input aria-label={`左轴字段 ${c}`} type="checkbox" className="sr-only" checked={isSelected} onChange={() => toggleYKey(c)} />
                                                            <span className={`text-xs ${isSelected ? 'text-monokai-fg' : 'text-monokai-comment'}`}>{c}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </>
                                )}

                                <div>
                                    {sectionLabel('计量单位')}
                                    <input
                                        aria-label="计量单位"
type="text"
                                        value={config.unit || ''}
                                        onChange={e => setConfig({ ...config, unit: e.target.value })}
                                        placeholder="如 ¥、笔、%、件"
                                        className={selectClass}
                                    />
                                </div>

                                {/* Group By & 聚合方式 */}
                                <div className="pt-3 border-t border-monokai-border flex flex-col gap-3">
                                    <div>
                                        {sectionLabel('分组字段')}
                                        <FormSelect
                                            aria-label="分组字段"
value={config.groupBy || ''}
                                            onChange={e => setConfig({ ...config, groupBy: e.target.value || undefined })}
                                            className={selectClass}
                                        >
                                            <option value="">不分组</option>
                                            {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                                        </FormSelect>
                                    </div>
                                    <div>
                                        {sectionLabel('聚合方式')}
                                        <FormSelect
                                            aria-label="聚合方式"
value={config.aggregation || 'none'}
                                            onChange={e => setConfig({ ...config, aggregation: e.target.value as any })}
                                            className={selectClass}
                                        >
                                            <option value="none">不聚合（原始值）</option>
                                            <option value="count">计数</option>
                                            <option value="sum">求和</option>
                                            <option value="avg">平均值</option>
                                            <option value="min">最小值</option>
                                            <option value="max">最大值</option>
                                        </FormSelect>
                                    </div>
                                </div>

                                {/* Advanced Options */}
                                <div className="pt-3 border-t border-monokai-border flex flex-col gap-2.5">
                                    {sectionLabel('显示选项', <Settings2 size={11} />)}
                                    <StyledCheckbox checked={config.stacked} onChange={v => setConfig({ ...config, stacked: v })} label="堆叠系列" />
                                    <StyledCheckbox checked={config.horizontal} onChange={v => setConfig({ ...config, horizontal: v })} label="横向柱状图" />
                                    <StyledCheckbox checked={!!config.showValues} onChange={v => setConfig({ ...config, showValues: v })} label="显示数值" />
                                    <StyledCheckbox checked={config.showLegend !== false} onChange={v => setConfig({ ...config, showLegend: v })} label="显示图例" />
                                    {config.showLegend !== false && (
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                {sectionLabel('图例位置')}
                                                <FormSelect
                                                    aria-label="图例位置"
value={config.legendPosition || 'bottom'}
                                                    onChange={e =>
                                                        setConfig({
                                                            ...config,
                                                            legendPosition: e.target.value as ChartConfig['legendPosition'],
                                                        })
                                                    }
                                                    className={selectClass}
                                                >
                                                    <option value="bottom">底部</option>
                                                    <option value="top">顶部</option>
                                                    <option value="left">左侧</option>
                                                    <option value="right">右侧</option>
                                                </FormSelect>
                                            </div>
                                            <div>
                                                {sectionLabel('图例对齐')}
                                                <FormSelect
                                                    aria-label="图例对齐"
value={config.legendAlign || 'center'}
                                                    onChange={e =>
                                                        setConfig({
                                                            ...config,
                                                            legendAlign: e.target.value as ChartConfig['legendAlign'],
                                                        })
                                                    }
                                                    className={selectClass}
                                                >
                                                    <option value="center">居中</option>
                                                    <option value="start">起始</option>
                                                    <option value="end">末尾</option>
                                                </FormSelect>
                                            </div>
                                        </div>
                                    )}
                                    <div>
                                        {sectionLabel('Y 轴标题')}
                                        <input
                                            aria-label="Y 轴标题"
type="text"
                                            value={config.yAxisLabel || ''}
                                            onChange={e => setConfig({ ...config, yAxisLabel: e.target.value })}
                                            placeholder="可选，自动拼单位"
                                            className={selectClass}
                                        />
                                    </div>
                                </div>

                                {/* Secondary Y-Axis */}
                                {(config.type === 'bar' || config.type === 'line') && (
                                    <div className="pt-3 border-t border-monokai-border">
                                        <div className="flex items-center gap-1.5 mb-2">
                                            <span className="text-xs font-bold uppercase tracking-wider text-monokai-fg">右侧数值轴</span>
                                            <span className="text-xs text-monokai-comment">（折线叠加）</span>
                                        </div>
                                        <div className="flex flex-col gap-0.5 max-h-28 overflow-y-auto border border-monokai-border rounded p-1.5 bg-monokai-bg custom-scrollbar">
                                            {availableColumns.map(c => {
                                                const isSelected = config.yRightKeys?.includes(c);
                                                return (
                                                    <label key={c} className="flex items-center gap-2 px-1.5 py-1 hover:bg-monokai-surface rounded cursor-pointer">
                                                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-monokai-accent border-monokai-accent' : 'border-monokai-border hover:border-monokai-border-strong'}`}>
                                                            {isSelected && <Check size={9} className="text-monokai-bg" />}
                                                        </div>
                                                        <input aria-label={`右轴字段 ${c}`} type="checkbox" className="sr-only" checked={!!isSelected} onChange={() => toggleYRightKey(c)} />
                                                        <span className={`text-xs ${isSelected ? 'text-monokai-fg' : 'text-monokai-comment'}`}>{c}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Drill-Down */}
                                <div className="pt-3 border-t border-monokai-border">
                                    <label className="flex items-center gap-2.5 cursor-pointer group mb-3">
                                        <div
                                            onClick={() => setConfig({
                                                ...config,
                                                drillDownConfig: {
                                                    enabled: !(config.drillDownConfig?.enabled),
                                                    drillDownColumn: config.drillDownConfig?.drillDownColumn || config.xKey,
                                                    drillDownSql: config.drillDownConfig?.drillDownSql || ''
                                                }
                                            })}
                                            className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                                                config.drillDownConfig?.enabled ? 'bg-monokai-amethyst border-monokai-amethyst' : 'border-monokai-comment group-hover:border-monokai-amethyst'
                                            }`}
                                        >
                                            {config.drillDownConfig?.enabled && <Check size={10} className="text-monokai-bg" />}
                                        </div>
                                        <span className={`text-xs font-bold flex items-center gap-1.5 transition-colors ${config.drillDownConfig?.enabled ? 'text-monokai-amethyst' : 'text-monokai-comment group-hover:text-monokai-amethyst'}`}>
                                            <MousePointerClick size={11} />
                                            交互下钻 (Drill Down)
                                        </span>
                                    </label>

                                    {config.drillDownConfig?.enabled && (
                                        <div className="flex flex-col gap-2.5 pl-6 border-l border-monokai-amethyst/30">
                                            <div>
                                                <label className="block text-xs text-monokai-comment mb-1">下钻依据列</label>
                                                <FormSelect
                                                    value={config.drillDownConfig.drillDownColumn || ''}
                                                    onChange={e => setConfig({
                                                        ...config,
                                                        drillDownConfig: { ...config.drillDownConfig!, drillDownColumn: e.target.value }
                                                    })}
                                                    className={selectClass}
                                                >
                                                    {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                                                </FormSelect>
                                            </div>
                                            <div>
                                                <label className="block text-xs text-monokai-comment mb-1">
                                                    下钻 SQL <span className="text-monokai-accent/70">(占位符: {"{value}"})</span>
                                                </label>
                                                <textarea
                                                    value={config.drillDownConfig.drillDownSql || ''}
                                                    onChange={e => setConfig({
                                                        ...config,
                                                        drillDownConfig: { ...config.drillDownConfig!, drillDownSql: e.target.value }
                                                    })}
                                                    placeholder="SELECT * FROM table WHERE col = '{value}'"
                                                    className={`${inputClass} font-mono h-20 resize-none`}
                                                />
                                            </div>
                                            <p className="text-xs text-monokai-comment leading-relaxed">
                                                点击图表数据点时，将用选中值执行下钻 SQL
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                    </div>
                </div>

                {/* ── Preview Area ─────────────────────────────────── */}
                <div className="flex-1 min-w-0 bg-monokai-bg flex flex-col min-h-0 self-start w-full">
                    <div className="flex flex-wrap gap-2 items-center justify-between px-3 py-2.5 border-b border-monokai-border bg-monokai-surface flex-shrink-0">
                        <span className="text-xs font-bold uppercase tracking-wider text-monokai-comment flex items-center gap-1.5">
                            <SlidersHorizontal size={11} />
                            实时预览
                        </span>
                        {config.title && (
                            <span className="text-xs text-monokai-fg font-mono">{config.title}</span>
                        )}
                    </div>
                    <div className="p-3 flex items-center justify-center relative w-full" style={{height: widgetSpace(chartContent(config.type, (createMode === 'metric' ? metricData : data).length, config.yKeys.length), 480).height + 24}}>
                        {previewData ? (
                            <div className="w-full h-full min-h-0 relative">
                                <ChartRenderer chartSpec={previewData} hideTitle />
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-3 text-monokai-comment/50">
                                <BarChart2 size={48} strokeWidth={1} />
                                <span className="text-xs">配置左侧选项以预览图表</span>
                            </div>
                        )}
                    </div>
                </div>

            </fieldset>
        </div>
    );
};
