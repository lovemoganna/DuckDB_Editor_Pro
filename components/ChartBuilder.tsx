import React, { useState, useEffect } from 'react';
import { ChartConfig, ColumnInfo, ChartType, MetricPackage, MetricDefinition } from '../types';
import { transformDataForChart, getChartOptions } from '../utils/chartUtils';
import { metricAnalyzer } from '../services/metricAnalyzer';
import { duckDBService } from '../services/duckdbService';
import { Bar, Line, Pie, Doughnut, Scatter } from 'react-chartjs-2';
import { X, Save, Check, Sparkles, Loader2, BarChart2, Settings2, SlidersHorizontal, MousePointerClick } from 'lucide-react';

interface ChartBuilderProps {
    columns: string[];
    data: any[];
    initialConfig?: ChartConfig;
    onSave: (config: ChartConfig) => void;
    onCancel: () => void;
}

export const ChartBuilder: React.FC<ChartBuilderProps> = ({ columns, data, initialConfig, onSave, onCancel }) => {
    const [config, setConfig] = useState<ChartConfig>(initialConfig || {
        id: Date.now().toString(),
        title: 'New Chart',
        type: 'bar',
        xKey: columns[0] || '',
        yKeys: columns.length > 1 ? [columns[1]] : [],
        yRightKeys: [],
        stacked: false,
        horizontal: false,
        aggregation: 'none',
        showLegend: true,
        showValues: false
    });

    const [previewData, setPreviewData] = useState<any>(null);
    
    // 从指标创建相关状态
    const [createMode, setCreateMode] = useState<'manual' | 'metric'>('manual');
    const [metricPackages, setMetricPackages] = useState<MetricPackage[]>([]);
    const [selectedPackageId, setSelectedPackageId] = useState<string>('');
    const [selectedMetricId, setSelectedMetricId] = useState<string>('');
    const [metricData, setMetricData] = useState<any[]>([]);
    const [metricColumns, setMetricColumns] = useState<string[]>([]);
    const [isLoadingMetric, setIsLoadingMetric] = useState(false);
    const [metricError, setMetricError] = useState<string | null>(null);

    // 加载指标包
    useEffect(() => {
        const packages = metricAnalyzer.loadMetricPackages();
        setMetricPackages(packages);
    }, []);

    const selectedPackage = metricPackages.find(p => p.id === selectedPackageId);
    const selectedMetric = selectedPackage?.metrics.find(m => m.id === selectedMetricId);

    // 统一列数据源：根据创建模式使用不同的列
    const availableColumns = createMode === 'metric' && metricColumns.length > 0 
        ? metricColumns 
        : columns;

    // 自动选择合适的图表类型
    const getAutoChartType = (data: any[], columns: string[]): ChartType => {
        if (!data || data.length === 0) return 'counter';
        
        // 如果只有一行数据，使用计数器
        if (data.length === 1) return 'counter';
        
        // 如果只有一列数值，可能是计数器
        if (columns.length <= 2 && data.length <= 1) return 'counter';
        
        // 如果有多个分类，适合用柱状图或折线图
        if (data.length > 1 && data.length <= 10) return 'bar';
        
        // 如果有很多数据点，适合用折线图
        if (data.length > 10) return 'line';
        
        return 'bar';
    };

    // 处理从指标创建 - 执行SQL并获取数据
    useEffect(() => {
        const fetchMetricData = async () => {
            if (createMode === 'metric' && selectedMetric && selectedPackage) {
                setIsLoadingMetric(true);
                try {
                    // 使用指标的sqlValidation或生成SQL
                    let sql = selectedMetric.sqlValidation;
                    
                    if (!sql) {
                        // 尝试基于formula生成SQL
                        const firstDep = selectedMetric.dependencies?.[0];
                        const sourceTable = selectedPackage.sourceTables?.[0];
                        if (firstDep && sourceTable) {
                            sql = `SELECT ${selectedMetric.formula || firstDep} as value FROM "${sourceTable}"`;
                        }
                    }
                    
                    if (sql) {
                        // 执行SQL查询
                        const result = await duckDBService.query(sql);
                        
                        const rows = Array.isArray(result) ? result : [];
                        setMetricData(rows);
                        
                        // 获取列名
                        if (rows.length > 0) {
                            const cols = Object.keys(rows[0]);
                            setMetricColumns(cols);
                            
                            // 自动配置图表
                            const chartType = getAutoChartType(rows, cols);
                            
                            // 使用函数式更新避免依赖config
                            setConfig(prev => ({
                                ...prev,
                                id: Date.now().toString(),
                                title: selectedMetric.name || 'Metric Chart',
                                type: chartType,
                                xKey: cols[0] || '',
                                yKeys: cols.length > 1 ? [cols[1]] : [cols[0]],
                                metricId: selectedMetric.id,
                                metricPackageId: selectedPackageId,
                                metricName: selectedMetric.name,
                                aggregation: chartType === 'counter' ? 'sum' : 'none'
                            }));
                        }
                    }
                } catch (error: any) {
                    console.error('Failed to fetch metric data:', error);
                    setMetricError(error?.message || 'SQL执行失败，请检查指标配置');
                } finally {
                    setIsLoadingMetric(false);
                }
            }
        };
        
        fetchMetricData();
    }, [createMode, selectedMetricId, selectedPackageId, selectedMetric, selectedPackage]);

    // 处理选择指标包
    const handlePackageChange = (pkgId: string) => {
        setSelectedPackageId(pkgId);
        setSelectedMetricId('');
        setMetricData([]);
        setMetricColumns([]);
    };

    useEffect(() => {
        // Debounce preview update?
        const timer = setTimeout(() => {
            // 根据创建模式使用不同的数据源
            const sourceData = createMode === 'metric' && metricData.length > 0 ? metricData : data;
            setPreviewData(transformDataForChart(sourceData, config));
        }, 100);
        return () => clearTimeout(timer);
    }, [config, data, metricData, createMode]);

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

    const options = getChartOptions(config);

    const sectionLabel = (text: string, icon?: React.ReactNode) => (
        <div className="flex items-center gap-1.5 mb-2">
            {icon && <span className="text-monokai-comment">{icon}</span>}
            <span className="text-xs font-bold uppercase tracking-wider text-monokai-comment">{text}</span>
        </div>
    );

    const selectClass = "w-full bg-monokai-bg border border-monokai-accent/60 p-2 rounded text-xs text-monokai-fg outline-none focus:border-monokai-accent transition-colors";
    const inputClass  = "w-full bg-monokai-bg border border-monokai-accent/60 p-2 rounded text-xs text-monokai-fg outline-none focus:border-monokai-accent transition-colors placeholder-monokai-comment";

    const StyledCheckbox = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
        <label className="flex items-center gap-2.5 cursor-pointer group">
            <div
                onClick={() => onChange(!checked)}
                className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                    checked ? 'bg-monokai-accent border-monokai-accent' : 'border-monokai-comment group-hover:border-monokai-accent'
                }`}
            >
                {checked && <Check size={10} className="text-monokai-bg" />}
            </div>
            <span className={`text-xs transition-colors ${checked ? 'text-monokai-fg' : 'text-monokai-comment group-hover:text-monokai-fg'}`}>
                {label}
            </span>
        </label>
    );

    return (
        <div className="absolute inset-0 z-50 bg-monokai-surface flex flex-col animate-[fadeIn_0.2s]">

            {/* ── Header ───────────────────────────────────────────── */}
            <div className="flex justify-between items-center px-5 py-3 border-b border-monokai-accent/40 bg-[#1d1d1b] flex-shrink-0">
                <h2 className="text-sm font-bold text-monokai-fg flex items-center gap-2">
                    <BarChart2 size={15} className="text-monokai-accent" />
                    Chart Builder
                </h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onCancel}
                        className="px-3 py-1.5 border border-monokai-accent/50 text-monokai-comment hover:text-monokai-fg hover:border-monokai-accent rounded text-xs transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSave(config)}
                        className="px-3 py-1.5 bg-monokai-green text-monokai-bg font-bold rounded text-xs hover:opacity-90 active:scale-95 flex items-center gap-1.5 transition-all"
                    >
                        <Save size={12} />
                        Save Chart
                    </button>
                </div>
            </div>

            <div className="flex flex-1 min-h-0">

                {/* ── Configuration Sidebar ────────────────────────── */}
                <div className="w-80 bg-monokai-sidebar border-r border-monokai-accent/40 flex flex-col min-h-0 flex-shrink-0">
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-5 bg-[#121111]">

                        {/* ── 创建方式 ── */}
                        <div>
                            {sectionLabel('创建方式')}
                            <div className="flex rounded-md overflow-hidden border border-monokai-accent/40">
                                <button
                                    onClick={() => { setCreateMode('manual'); setMetricError(null); }}
                                    className={`flex-1 px-3 py-2 text-xs font-bold transition-colors border-r border-monokai-accent/40 ${
                                        createMode === 'manual'
                                            ? 'bg-monokai-accent/15 text-monokai-accent'
                                            : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-bg/50'
                                    }`}
                                >
                                    手动创建
                                </button>
                                <button
                                    onClick={() => { setCreateMode('metric'); setMetricError(null); }}
                                    disabled={metricPackages.length === 0}
                                    className={`flex-1 px-3 py-2 text-xs font-bold transition-colors flex items-center justify-center gap-1 ${
                                        createMode === 'metric'
                                            ? 'bg-monokai-purple/20 text-monokai-purple'
                                            : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-bg/50 disabled:opacity-40 disabled:cursor-not-allowed'
                                    }`}
                                >
                                    <Sparkles size={11} />
                                    从指标创建
                                </button>
                            </div>
                        </div>

                        {/* ── 指标模式 ── */}
                        {createMode === 'metric' && (
                            <div className="flex flex-col gap-3 p-3 bg-monokai-bg rounded-lg border border-monokai-purple/30">
                                {metricPackages.length === 0 ? (
                                    <p className="text-center text-monokai-comment text-xs py-3">
                                        暂无指标包，请先在"指标管理"中创建
                                    </p>
                                ) : (
                                    <>
                                        <div>
                                            {sectionLabel('选择指标包')}
                                            <select
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
                                            </select>
                                        </div>

                                        {selectedPackage && (
                                            <div>
                                                {sectionLabel('选择指标')}
                                                <select
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
                                                </select>
                                            </div>
                                        )}

                                        {selectedMetric && (
                                            <div className="p-2.5 bg-monokai-purple/10 border border-monokai-purple/30 rounded text-xs flex flex-col gap-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-monokai-purple font-bold">{selectedMetric.name}</span>
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

                        {/* ── 手动创建模式 ── */}
                        {createMode === 'manual' && (
                            <>
                                {/* Title */}
                                <div>
                                    {sectionLabel('Title')}
                                    <input
                                        value={config.title}
                                        onChange={e => setConfig({ ...config, title: e.target.value })}
                                        className={inputClass}
                                        placeholder="Chart Title"
                                    />
                                </div>

                                {/* Chart Type */}
                                <div>
                                    {sectionLabel('Type')}
                                    <div className="grid grid-cols-3 gap-1.5 bg-[#1e1f1c]">
                                        {(['bar', 'line', 'area', 'pie', 'doughnut', 'scatter'] as ChartType[]).map(t => (
                                            <button
                                                key={t}
                                                onClick={() => handleTypeChange(t)}
                                                className={`py-1.5 rounded border text-xs capitalize font-medium transition-all ${
                                                    config.type === t
                                                        ? 'bg-monokai-accent/20 border-monokai-accent text-monokai-accent font-bold'
                                                        : 'bg-monokai-bg border-monokai-accent/40 text-monokai-comment hover:border-monokai-accent hover:text-monokai-fg'
                                                }`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* X Axis */}
                                <div>
                                    {sectionLabel('X Axis (Category)')}
                                    <select
                                        value={config.xKey}
                                        onChange={e => setConfig({ ...config, xKey: e.target.value })}
                                        className={selectClass}
                                    >
                                        {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>

                                {/* Y Axis */}
                                <div>
                                    {sectionLabel('Y Axis (Values)')}
                                    <div className="flex flex-col gap-0.5 max-h-36 overflow-y-auto border border-monokai-accent/40 rounded p-1.5 bg-[#121211] text-[#141414] custom-scrollbar">
                                        {availableColumns.map(c => {
                                            const isSelected = config.yKeys.includes(c);
                                            return (
                                                <label key={c} className="flex items-center gap-2 px-1.5 py-1 hover:bg-monokai-accent/10 rounded cursor-pointer">
                                                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-monokai-accent border-monokai-accent' : 'border-monokai-comment hover:border-monokai-accent'}`}>
                                                        {isSelected && <Check size={9} className="text-monokai-bg" />}
                                                    </div>
                                                    <input type="checkbox" className="hidden" checked={isSelected} onChange={() => toggleYKey(c)} />
                                                    <span className={`text-xs ${isSelected ? 'text-monokai-fg' : 'text-monokai-comment'}`}>{c}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Group By & Aggregation */}
                                <div className="pt-3 border-t border-monokai-accent/30 flex flex-col gap-3">
                                    <div>
                                        {sectionLabel('Group By (Segmentation)')}
                                        <select
                                            value={config.groupBy || ''}
                                            onChange={e => setConfig({ ...config, groupBy: e.target.value || undefined })}
                                            className={selectClass + ' focus:border-monokai-purple'}
                                        >
                                            <option value="">None</option>
                                            {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        {sectionLabel('Aggregation')}
                                        <select
                                            value={config.aggregation || 'none'}
                                            onChange={e => setConfig({ ...config, aggregation: e.target.value as any })}
                                            className={selectClass}
                                        >
                                            <option value="none">None (Raw)</option>
                                            <option value="count">Count</option>
                                            <option value="sum">Sum</option>
                                            <option value="avg">Average</option>
                                            <option value="min">Min</option>
                                            <option value="max">Max</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Advanced Options */}
                                <div className="pt-3 border-t border-monokai-accent/30 flex flex-col gap-2.5">
                                    {sectionLabel('Display Options', <Settings2 size={11} />)}
                                    <StyledCheckbox checked={config.stacked} onChange={v => setConfig({ ...config, stacked: v })} label="Stacked" />
                                    <StyledCheckbox checked={config.horizontal} onChange={v => setConfig({ ...config, horizontal: v })} label="Horizontal (Bar)" />
                                    <StyledCheckbox checked={!!config.showValues} onChange={v => setConfig({ ...config, showValues: v })} label="Show Values" />
                                    <StyledCheckbox checked={!!config.showLegend} onChange={v => setConfig({ ...config, showLegend: v })} label="Show Legend" />
                                </div>

                                {/* Secondary Y-Axis */}
                                {(config.type === 'bar' || config.type === 'line') && (
                                    <div className="pt-3 border-t border-monokai-accent/30">
                                        <div className="flex items-center gap-1.5 mb-2">
                                            <span className="text-xs font-bold uppercase tracking-wider text-monokai-accent">Right Y-Axis</span>
                                            <span className="text-xs text-monokai-comment">(Line Overlay)</span>
                                        </div>
                                        <div className="flex flex-col gap-0.5 max-h-28 overflow-y-auto border border-monokai-accent/40 rounded p-1.5 bg-monokai-bg custom-scrollbar">
                                            {availableColumns.map(c => {
                                                const isSelected = config.yRightKeys?.includes(c);
                                                return (
                                                    <label key={c} className="flex items-center gap-2 px-1.5 py-1 hover:bg-monokai-accent/10 rounded cursor-pointer">
                                                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-monokai-accent border-monokai-accent' : 'border-monokai-comment hover:border-monokai-accent'}`}>
                                                            {isSelected && <Check size={9} className="text-monokai-bg" />}
                                                        </div>
                                                        <input type="checkbox" className="hidden" checked={!!isSelected} onChange={() => toggleYRightKey(c)} />
                                                        <span className={`text-xs ${isSelected ? 'text-monokai-fg' : 'text-monokai-comment'}`}>{c}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Drill-Down */}
                                <div className="pt-3 border-t border-monokai-accent/30">
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
                                                config.drillDownConfig?.enabled ? 'bg-monokai-purple border-monokai-purple' : 'border-monokai-comment group-hover:border-monokai-purple'
                                            }`}
                                        >
                                            {config.drillDownConfig?.enabled && <Check size={10} className="text-monokai-bg" />}
                                        </div>
                                        <span className={`text-xs font-bold flex items-center gap-1.5 transition-colors ${config.drillDownConfig?.enabled ? 'text-monokai-purple' : 'text-monokai-comment group-hover:text-monokai-purple'}`}>
                                            <MousePointerClick size={11} />
                                            交互下钻 (Drill Down)
                                        </span>
                                    </label>

                                    {config.drillDownConfig?.enabled && (
                                        <div className="flex flex-col gap-2.5 pl-6 border-l border-monokai-purple/30">
                                            <div>
                                                <label className="block text-xs text-monokai-comment mb-1">下钻依据列</label>
                                                <select
                                                    value={config.drillDownConfig.drillDownColumn || ''}
                                                    onChange={e => setConfig({
                                                        ...config,
                                                        drillDownConfig: { ...config.drillDownConfig!, drillDownColumn: e.target.value }
                                                    })}
                                                    className={selectClass}
                                                >
                                                    {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
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
                <div className="flex-1 bg-monokai-bg flex flex-col min-h-0">
                    <div className="flex items-center justify-between px-5 py-2.5 border-b border-monokai-accent/30 bg-monokai-surface flex-shrink-0">
                        <span className="text-xs font-bold uppercase tracking-wider text-monokai-comment flex items-center gap-1.5">
                            <SlidersHorizontal size={11} />
                            Preview
                        </span>
                        {config.title && (
                            <span className="text-xs text-monokai-accent font-mono">{config.title}</span>
                        )}
                    </div>
                    <div className="flex-1 p-8 flex items-center justify-center min-h-0 relative">
                        {previewData ? (
                            <div className="w-full h-full relative">
                                {config.type === 'bar'      && <Bar      data={previewData} options={options} />}
                                {config.type === 'line'     && <Line     data={previewData} options={options} />}
                                {config.type === 'area'     && <Line     data={previewData} options={options} />}
                                {config.type === 'pie'      && <Pie      data={previewData} options={options} />}
                                {config.type === 'doughnut' && <Doughnut data={previewData} options={options} />}
                                {config.type === 'scatter'  && <Scatter  data={previewData} options={options} />}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-3 text-monokai-comment/50">
                                <BarChart2 size={48} strokeWidth={1} />
                                <span className="text-xs">配置左侧选项以预览图表</span>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};
