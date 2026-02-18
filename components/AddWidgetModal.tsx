import React, { useState, useEffect } from 'react';
import { dbService } from '../services/dbService';
import { metricAnalyzer } from '../services/metricAnalyzer';
import { SavedQuery, MetricPackage, MetricDefinition } from '../types';
import { 
    X, Search, BarChart2, Table, Package, 
    Loader2, ChevronRight, Check
} from 'lucide-react';

interface AddWidgetModalProps {
    onClose: () => void;
    onAdd: (queryId: string) => void;
}

type TabType = 'queries' | 'metrics';

export const AddWidgetModal: React.FC<AddWidgetModalProps> = ({ onClose, onAdd }) => {
    const [activeTab, setActiveTab] = useState<TabType>('queries');
    const [queries, setQueries] = useState<SavedQuery[]>([]);
    const [filter, setFilter] = useState('');
    
    // Metrics related state
    const [packages, setPackages] = useState<MetricPackage[]>([]);
    const [selectedPackage, setSelectedPackage] = useState<MetricPackage | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        loadQueries();
        loadPackages();
    }, []);

    const loadQueries = async () => {
        const saved = await dbService.getQueries();
        setQueries(saved);
    };

    const loadPackages = () => {
        const loaded = metricAnalyzer.loadMetricPackages();
        setPackages(loaded);
    };

    const filtered = queries.filter(q => q.name.toLowerCase().includes(filter.toLowerCase()));

    // Handle metric chart generation
    const handleMetricSelect = async (metric: MetricDefinition) => {
        if (!selectedPackage || selectedPackage.sourceTables.length === 0) {
            alert('请先选择数据源表');
            return;
        }

        setIsGenerating(true);
        try {
            const sourceTable = selectedPackage.sourceTables[0];
            
            // Generate chart
            const chart = await metricAnalyzer.generateChart(
                metric,
                selectedPackage.id,
                sourceTable
            );

            // Convert to SavedQuery and add to dashboard
            const savedQueryId = await metricAnalyzer.convertToSavedQuery(chart);
            
            // Add to dashboard
            onAdd(savedQueryId);
            onClose();
        } catch (error) {
            console.error('Failed to generate chart from metric:', error);
            alert('生成图表失败: ' + (error as Error).message);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s]">
            <div className="bg-monokai-sidebar border border-monokai-accent rounded-lg shadow-2xl w-[700px] max-h-[85vh] flex flex-col animate-[scaleIn_0.2s]">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-monokai-accent">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <span className="text-monokai-green">+</span> Add Widget
                    </h2>
                    <button onClick={onClose} className="text-monokai-comment hover:text-white p-1 rounded hover:bg-monokai-bg">
                        <X size={20} />
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className="flex border-b border-monokai-accent">
                    <button
                        onClick={() => setActiveTab('queries')}
                        className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                            activeTab === 'queries' 
                                ? 'bg-monokai-bg text-monokai-blue border-b-2 border-monokai-blue' 
                                : 'text-monokai-comment hover:text-white'
                        }`}
                    >
                        <Table size={16} />
                        已有查询
                    </button>
                    <button
                        onClick={() => setActiveTab('metrics')}
                        className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                            activeTab === 'metrics' 
                                ? 'bg-monokai-bg text-monokai-purple border-b-2 border-monokai-purple' 
                                : 'text-monokai-comment hover:text-white'
                        }`}
                    >
                        <Package size={16} />
                        从指标创建
                    </button>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    {activeTab === 'queries' ? (
                        /* Existing Queries Tab */
                        <>
                            <div className="p-4 border-b border-monokai-accent bg-monokai-bg">
                                <div className="flex items-center gap-2 bg-monokai-sidebar border border-monokai-accent rounded px-3 py-2">
                                    <Search size={16} className="text-monokai-comment" />
                                    <input
                                        autoFocus
                                        placeholder="Search saved charts..."
                                        className="bg-transparent border-none outline-none text-white w-full placeholder-monokai-comment"
                                        value={filter}
                                        onChange={(e) => setFilter(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="overflow-y-auto p-2 custom-scrollbar flex-1">
                                {filtered.length === 0 ? (
                                    <div className="text-center p-8 text-monokai-comment">No matching queries found.</div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-2">
                                        {filtered.map(q => {
                                            const hasCharts = q.charts && q.charts.length > 0;
                                            return (
                                                <div
                                                    key={q.id}
                                                    onClick={() => onAdd(q.id)}
                                                    className="p-3 rounded border border-monokai-accent bg-monokai-bg hover:border-monokai-blue hover:bg-monokai-accent/20 cursor-pointer transition-all flex justify-between items-center group"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-2 rounded ${hasCharts ? 'bg-monokai-purple/20 text-monokai-purple' : 'bg-monokai-blue/20 text-monokai-blue'}`}>
                                                            {hasCharts ? <BarChart2 size={18} /> : <Table size={18} />}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-monokai-fg group-hover:text-white">{q.name}</div>
                                                            <div className="text-xs text-monokai-comment flex gap-2">
                                                                <span>{new Date(q.createdAt).toLocaleDateString()}</span>
                                                                {hasCharts && <span className="text-monokai-green">- {q.charts!.length} Charts</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="opacity-0 group-hover:opacity-100 px-3 py-1 bg-monokai-blue text-monokai-bg text-xs font-bold rounded">Add</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        /* From Metrics Tab */
                        <div className="flex-1 overflow-hidden flex flex-col">
                            {packages.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                                    <Package size={48} className="text-monokai-accent mb-4" />
                                    <p className="text-monokai-comment">暂无指标包</p>
                                    <p className="text-xs text-monokai-comment mt-2">
                                        请先在 Metrics 页面创建指标包
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {/* Package List */}
                                    <div className="p-4 border-b border-monokai-accent">
                                        <div className="text-xs text-monokai-comment mb-2">选择指标包:</div>
                                        <div className="flex flex-wrap gap-2">
                                            {packages.map(pkg => (
                                                <button
                                                    key={pkg.id}
                                                    onClick={() => setSelectedPackage(pkg)}
                                                    className={`px-3 py-1.5 rounded text-sm flex items-center gap-2 transition-colors ${
                                                        selectedPackage?.id === pkg.id
                                                            ? 'bg-monokai-purple text-white'
                                                            : 'bg-monokai-accent/30 text-monokai-fg hover:bg-monokai-accent/50'
                                                    }`}
                                                >
                                                    {selectedPackage?.id === pkg.id && <Check size={12} />}
                                                    {pkg.name}
                                                    <span className="text-xs opacity-70">({pkg.metrics.length})</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Metrics List */}
                                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                        {!selectedPackage ? (
                                            <div className="text-center p-8 text-monokai-comment">
                                                请先选择一个指标包
                                            </div>
                                        ) : selectedPackage.metrics.length === 0 ? (
                                            <div className="text-center p-8 text-monokai-comment">
                                                该指标包暂无指标
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 gap-2">
                                                {selectedPackage.metrics.map(metric => (
                                                    <div
                                                        key={metric.id}
                                                        onClick={() => !isGenerating && handleMetricSelect(metric)}
                                                        className={`p-3 rounded border transition-all flex justify-between items-center group ${
                                                            isGenerating 
                                                                ? 'bg-monokai-bg border-monokai-accent opacity-50'
                                                                : 'bg-monokai-bg border-monokai-accent hover:border-monokai-purple hover:bg-monokai-purple/10 cursor-pointer'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 rounded bg-monokai-purple/20 text-monokai-purple">
                                                                <BarChart2 size={18} />
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-white">{metric.name}</div>
                                                                <div className="text-xs text-monokai-comment flex gap-2">
                                                                    <span>{metric.category || '未分类'}</span>
                                                                    {metric.unit && <span>- {metric.unit}</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2">
                                                            {isGenerating ? (
                                                                <Loader2 size={14} className="animate-spin text-monokai-purple" />
                                                            ) : (
                                                                <>
                                                                    <span className="text-xs text-monokai-purple">创建图表</span>
                                                                    <ChevronRight size={14} className="text-monokai-purple" />
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                            
                            {isGenerating && (
                                <div className="p-4 border-t border-monokai-accent bg-monokai-bg flex items-center justify-center gap-2">
                                    <Loader2 size={16} className="animate-spin text-monokai-purple" />
                                    <span className="text-sm text-monokai-purple">正在生成图表...</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
