import React, { useState, useEffect } from 'react';
import { ChartConfig, ColumnInfo, ChartType, MetricPackage, MetricDefinition } from '../types';
import { transformDataForChart, getChartOptions } from '../utils/chartUtils';
import { metricAnalyzer } from '../services/metricAnalyzer';
import { duckDBService } from '../services/duckdbService';
import { Bar, Line, Pie, Doughnut, Scatter } from 'react-chartjs-2';
import { X, Save, Check, Sparkles, Loader2 } from 'lucide-react';

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

    return (
        <div className="absolute inset-0 z-50 bg-[#1e1f1c] flex flex-col animate-[fadeIn_0.2s]">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-monokai-accent bg-monokai-sidebar">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span className="text-monokai-pink">📊</span> Chart Builder
                </h2>
                <div className="flex gap-2">
                    <button onClick={onCancel} className="px-4 py-1.5 border border-monokai-comment text-monokai-comment hover:text-white rounded text-sm transition-colors">Cancel</button>
                    <button onClick={() => onSave(config)} className="px-4 py-1.5 bg-monokai-green text-monokai-bg font-bold rounded text-sm hover:opacity-90 flex items-center gap-2">
                        <Save size={14} /> Save Chart
                    </button>
                </div>
            </div>

            <div className="flex flex-1 min-h-0">
                {/* Configuration Sidebar */}
                <div className="w-80 bg-monokai-sidebar border-r border-monokai-accent p-4 overflow-y-auto custom-scrollbar flex flex-col gap-6">

                    {/* 创建模式选择 */}
                    <div>
                        <label className="block text-xs uppercase font-bold text-monokai-comment mb-2">创建方式</label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setCreateMode('manual');
                                    setMetricError(null);
                                }}
                                className={`flex-1 px-3 py-2 rounded text-sm font-bold transition-colors ${
                                    createMode === 'manual' 
                                    ? 'bg-monokai-blue text-monokai-bg' 
                                    : 'bg-monokai-accent text-monokai-comment hover:text-white'
                                }`}
                            >
                                手动创建
                            </button>
                            <button
                                onClick={() => {
                                    setCreateMode('metric');
                                    setMetricError(null);
                                }}
                                disabled={metricPackages.length === 0}
                                className={`flex-1 px-3 py-2 rounded text-sm font-bold transition-colors flex items-center justify-center gap-1 ${
                                    createMode === 'metric' 
                                    ? 'bg-monokai-purple text-white' 
                                    : 'bg-monokai-accent text-monokai-comment hover:text-white disabled:opacity-50'
                                }`}
                            >
                                <Sparkles size={14} />
                                从指标创建
                            </button>
                        </div>
                    </div>

                    {/* 从指标创建 - 选择指标包和指标 */}
                    {createMode === 'metric' && (
                        <div className="space-y-4 p-3 bg-monokai-bg rounded border border-monokai-purple/50">
                            {metricPackages.length === 0 ? (
                                <div className="text-center text-monokai-comment text-sm py-4">
                                    暂无指标包，请先在"指标管理"中创建
                                </div>
                            ) : (
                                <>
                                    {/* 选择指标包 */}
                                    <div>
                                        <label className="block text-xs uppercase font-bold text-monokai-comment mb-2">选择指标包</label>
                                        <select
                                            value={selectedPackageId}
                                            onChange={(e) => handlePackageChange(e.target.value)}
                                            className="w-full bg-monokai-sidebar border border-monokai-accent p-2 rounded text-sm text-white outline-none focus:border-monokai-purple"
                                        >
                                            <option value="">请选择指标包...</option>
                                            {metricPackages.map(pkg => (
                                                <option key={pkg.id} value={pkg.id}>
                                                    {pkg.name} ({pkg.metrics.length}个指标)
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* 选择具体指标 */}
                                    {selectedPackage && (
                                        <div>
                                            <label className="block text-xs uppercase font-bold text-monokai-comment mb-2">选择指标</label>
                                            <select
                                                value={selectedMetricId}
                                                onChange={(e) => setSelectedMetricId(e.target.value)}
                                                className="w-full bg-monokai-sidebar border border-monokai-accent p-2 rounded text-sm text-white outline-none focus:border-monokai-purple"
                                            >
                                                <option value="">请选择指标...</option>
                                                {selectedPackage.metrics.map(metric => (
                                                    <option key={metric.id} value={metric.id}>
                                                        {metric.name} - {metric.category || '未分类'}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {/* 显示选中的指标信息 */}
                                    {selectedMetric && (
                                        <div className="p-2 bg-monokai-purple/20 rounded text-xs">
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="text-monokai-purple font-bold">{selectedMetric.name}</div>
                                                {isLoadingMetric && (
                                                    <div className="flex items-center gap-1 text-monokai-blue">
                                                        <Loader2 size={12} className="animate-spin" />
                                                        加载中...
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-monokai-comment">{selectedMetric.definition}</div>
                                            {selectedMetric.formula && (
                                                <div className="text-monokai-green mt-1 font-mono">
                                                    {selectedMetric.formula}
                                                </div>
                                            )}
                                            {metricData.length > 0 && (
                                                <div className="mt-2 text-monokai-green">
                                                    ✓ 已获取 {metricData.length} 条数据
                                                </div>
                                            )}
                                            {metricError && (
                                                <div className="mt-2 text-monokai-red text-xs">
                                                    ✗ {metricError}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* 手动创建模式 */}
                    {createMode === 'manual' && (
                    <>
                    {/* General */}
                    <div>
                        <label className="block text-xs uppercase font-bold text-monokai-comment mb-2">Title</label>
                        <input
                            value={config.title}
                            onChange={e => setConfig({ ...config, title: e.target.value })}
                            className="w-full bg-monokai-bg border border-monokai-accent p-2 rounded text-sm text-white focus:border-monokai-blue outline-none"
                            placeholder="Chart Title"
                        />
                    </div>

                    {/* Chart Type */}
                    <div>
                        <label className="block text-xs uppercase font-bold text-monokai-comment mb-2">Type</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['bar', 'line', 'area', 'pie', 'doughnut', 'scatter'].map(t => (
                                <button
                                    key={t}
                                    onClick={() => handleTypeChange(t as ChartType)}
                                    className={`p-2 rounded border text-xs capitalize transition-all ${config.type === t ? 'bg-monokai-blue text-monokai-bg border-monokai-blue font-bold' : 'bg-monokai-bg border-monokai-accent text-monokai-fg hover:border-monokai-comment'}`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Axes */}
                    <div>
                        <label className="block text-xs uppercase font-bold text-monokai-comment mb-2">X Axis (Category)</label>
                        <select
                            value={config.xKey}
                            onChange={e => setConfig({ ...config, xKey: e.target.value })}
                            className="w-full bg-monokai-bg border border-monokai-accent p-2 rounded text-sm text-white focus:border-monokai-blue outline-none"
                        >
                            {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs uppercase font-bold text-monokai-comment mb-2">Y Axis (Values)</label>
                        <div className="flex flex-col gap-1 max-h-40 overflow-y-auto border border-monokai-accent rounded p-2 bg-monokai-bg">
                            {availableColumns.map(c => {
                                const isSelected = config.yKeys.includes(c);
                                return (
                                    <label key={c} className="flex items-center gap-2 p-1 hover:bg-monokai-accent/30 rounded cursor-pointer">
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-monokai-blue border-monokai-blue' : 'border-monokai-comment'}`}>
                                            {isSelected && <Check size={10} className="text-monokai-bg" />}
                                        </div>
                                        <input type="checkbox" className="hidden" checked={isSelected} onChange={() => toggleYKey(c)} />
                                        <span className={`text-sm ${isSelected ? 'text-white' : 'text-monokai-comment'}`}>{c}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    {/* Grouping & Aggregation */}
                    <div className="border-t border-monokai-accent pt-4 mt-2">
                        <label className="block text-xs uppercase font-bold text-monokai-purple mb-2">Group By (Segmentation)</label>
                        <select
                            value={config.groupBy || ''}
                            onChange={e => setConfig({ ...config, groupBy: e.target.value || undefined })}
                            className="w-full bg-monokai-bg border border-monokai-accent p-2 rounded text-sm text-white focus:border-monokai-purple outline-none"
                        >
                            <option value="">None</option>
                            {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs uppercase font-bold text-monokai-comment mb-2">Aggregation</label>
                        <select
                            value={config.aggregation || 'none'}
                            onChange={e => setConfig({ ...config, aggregation: e.target.value as any })}
                            className="w-full bg-monokai-bg border border-monokai-accent p-2 rounded text-sm text-white focus:border-monokai-blue outline-none"
                        >
                            <option value="none">None (Raw)</option>
                            <option value="count">Count</option>
                            <option value="sum">Sum</option>
                            <option value="avg">Average</option>
                            <option value="min">Min</option>
                            <option value="max">Max</option>
                        </select>
                    </div>

                    {/* Advanced / Styling */}
                    <div className="border-t border-monokai-accent pt-4 mt-2 flex flex-col gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={config.stacked} onChange={e => setConfig({ ...config, stacked: e.target.checked })} />
                            <span className="text-sm text-white">Stacked</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={config.horizontal} onChange={e => setConfig({ ...config, horizontal: e.target.checked })} />
                            <span className="text-sm text-white">Horizontal (Bar)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={config.showValues} onChange={e => setConfig({ ...config, showValues: e.target.checked })} />
                            <span className="text-sm text-white">Show Values</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={config.showLegend} onChange={e => setConfig({ ...config, showLegend: e.target.checked })} />
                            <span className="text-sm text-white">Show Legend</span>
                        </label>
                    </div>

                    {/* Secondary Axis */}
                    {(config.type === 'bar' || config.type === 'line') && (
                        <div className="border-t border-monokai-accent pt-4 mt-2">
                            <label className="block text-xs uppercase font-bold text-monokai-blue mb-2">Right Y-Axis (Line Overlay)</label>
                            <div className="flex flex-col gap-1 max-h-32 overflow-y-auto border border-monokai-accent rounded p-2 bg-monokai-bg">
                                {availableColumns.map(c => {
                                    const isSelected = config.yRightKeys?.includes(c);
                                    return (
                                        <label key={c} className="flex items-center gap-2 p-1 hover:bg-monokai-accent/30 rounded cursor-pointer">
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-monokai-blue border-monokai-blue' : 'border-monokai-comment'}`}>
                                                {isSelected && <Check size={10} className="text-monokai-bg" />}
                                            </div>
                                            <input type="checkbox" className="hidden" checked={isSelected} onChange={() => toggleYRightKey(c)} />
                                            <span className={`text-sm ${isSelected ? 'text-white' : 'text-monokai-comment'}`}>{c}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Drill-Down Configuration */}
                    <div className="border-t border-monokai-accent pt-4 mt-2">
                        <label className="flex items-center gap-2 cursor-pointer mb-3">
                            <input 
                                type="checkbox" 
                                checked={config.drillDownConfig?.enabled || false} 
                                onChange={e => setConfig({ 
                                    ...config, 
                                    drillDownConfig: { 
                                        enabled: e.target.checked,
                                        drillDownColumn: config.drillDownConfig?.drillDownColumn || config.xKey,
                                        drillDownSql: config.drillDownConfig?.drillDownSql || ''
                                    }
                                })} 
                            />
                            <span className="text-sm text-monokai-purple font-bold">交互下钻 (Drill Down)</span>
                        </label>
                        
                        {config.drillDownConfig?.enabled && (
                            <div className="flex flex-col gap-2 pl-6">
                                <div>
                                    <label className="block text-xs text-monokai-comment mb-1">下钻依据列</label>
                                    <select
                                        value={config.drillDownConfig.drillDownColumn || ''}
                                        onChange={e => setConfig({
                                            ...config,
                                            drillDownConfig: { ...config.drillDownConfig!, drillDownColumn: e.target.value }
                                        })}
                                        className="w-full bg-monokai-bg border border-monokai-accent p-2 rounded text-sm text-white"
                                    >
                                        {availableColumns.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-monokai-comment mb-1">下钻SQL (可用占位符 {"{value}"})</label>
                                    <textarea
                                        value={config.drillDownConfig.drillDownSql || ''}
                                        onChange={e => setConfig({
                                            ...config,
                                            drillDownConfig: { ...config.drillDownConfig!, drillDownSql: e.target.value }
                                        })}
                                        placeholder="SELECT * FROM table WHERE column = '{value}'"
                                        className="w-full bg-monokai-bg border border-monokai-accent p-2 rounded text-sm text-white font-mono h-20"
                                    />
                                </div>
                                <p className="text-xs text-monokai-comment">
                                    点击图表数据点时，将使用选中的值执行下钻SQL
                                </p>
                            </div>
                        )}
                    </div>

                    </>
                    )}

                </div>

                {/* Preview Area */}
                <div className="flex-1 bg-[#23241f] p-8 flex flex-col justify-center relative">
                    <div className="absolute top-4 right-4 text-xs text-monokai-comment">Preview</div>
                    <div className="flex-1 relative min-h-0">
                        {previewData && (
                            <>
                                {config.type === 'bar' && <Bar data={previewData} options={options} />}
                                {config.type === 'line' && <Line data={previewData} options={options} />}
                                {config.type === 'area' && <Line data={previewData} options={options} />}
                                {config.type === 'pie' && <Pie data={previewData} options={options} />}
                                {config.type === 'doughnut' && <Doughnut data={previewData} options={options} />}
                                {config.type === 'scatter' && <Scatter data={previewData} options={options} />}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
