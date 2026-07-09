import React, { useEffect, useState, useRef } from 'react';
import { duckDBService } from '../services/duckdbService';
import { dbService } from '../services/dbService';
import { SavedQuery, ChartConfig } from '../types';
import { transformDataForChart, getChartOptions } from '../utils/chartUtils';
import { Bar, Line, Pie, Doughnut, Scatter } from 'react-chartjs-2';
import { RefreshCw, AlertCircle, Maximize2, BarChart2, TrendingUp, PieChart, Target, Table2, MoreVertical } from 'lucide-react';

const getChartIcon = (type: string) => {
    switch(type) {
        case 'bar': return <BarChart2 size={12} />;
        case 'line': case 'area': return <TrendingUp size={12} />;
        case 'pie': case 'doughnut': return <PieChart size={12} />;
        case 'scatter': return <Target size={12} />;
        default: return <Table2 size={12} />;
    }
};

interface DashboardWidgetProps {
    savedQueryId: string;
    refreshTrigger: number;
    onRemove?: () => void;
}

export const DashboardWidget: React.FC<DashboardWidgetProps> = ({ savedQueryId, refreshTrigger, onRemove }) => {
    const [query, setQuery] = useState<SavedQuery | null>(null);
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                // 1. Get Query Config
                const saved = await dbService.getQueries();
                const q = saved.find(s => s.id === savedQueryId);
                if (!q) throw new Error("Query not found");
                setQuery(q);

                // 2. Fetch Data
                // Use limit for safety, but larger than typical preview
                const sql = `SELECT * FROM (${q.sql.replace(/;+$/, '')}) LIMIT 1000`;
                const res = await duckDBService.query(sql);
                setData(res);
            } catch (e: any) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [savedQueryId, refreshTrigger]);

    // Close dropdown on click outside
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

    if (loading) return <div className="w-full h-full flex items-center justify-center text-monokai-comment animate-pulse">Loading...</div>;
    if (error) return (
        <div className="w-full h-full flex flex-col items-center justify-center text-monokai-pink p-4 text-center">
            <AlertCircle size={24} className="mb-2" />
            <div className="text-xs">{error}</div>
        </div>
    );
    if (!query) return null;

    // Determine what to render: Chart or Table?
    // Prioritize first chart if exists
    const chartConfig = query.charts && query.charts.length > 0 ? query.charts[0] : null;

    const titleBar = (
        <div className="flex justify-between items-center px-2 py-1 bg-monokai-bg/50 border-b border-monokai-accent/30 drag-handle cursor-move">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className="text-monokai-comment flex-shrink-0">{getChartIcon(chartConfig?.type || 'table')}</span>
                <span className="text-xs font-bold text-monokai-fg truncate">{query.name}</span>
            </div>
            <span className="text-[10px] text-monokai-comment bg-monokai-accent/15 px-1.5 py-0.5 rounded-full mx-2 flex-shrink-0 whitespace-nowrap">{data.length} rows</span>
            <div className="relative flex-shrink-0" ref={menuRef}>
                <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(prev => !prev); }}
                    className="p-0.5 rounded hover:bg-monokai-accent/20 text-monokai-comment hover:text-monokai-fg transition-colors"
                >
                    <MoreVertical size={14} />
                </button>
                {menuOpen && (
                    <div className="absolute right-0 top-full mt-1 bg-monokai-sidebar border border-monokai-accent/40 rounded shadow-xl z-50 min-w-[100px] py-1">
                        <button
                            onClick={() => { setMenuOpen(false); onRemove?.(); }}
                            className="w-full text-left px-3 py-1.5 text-xs text-monokai-pink hover:bg-monokai-pink/10 transition-colors"
                        >
                            Remove
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    if (chartConfig) {
        const chartData = transformDataForChart(data, chartConfig);
        const options = getChartOptions({ ...chartConfig, showLegend: false } as ChartConfig);
        // Force minimal options for dashboard widgets to save space? 
        // Or keep user config. Keeping user config is safer but maybe disable titles.
        if (options.plugins?.title) {
            options.plugins.title.display = false;
        }

        return (
            <div className="w-full h-full flex flex-col">
                {titleBar}
                <div className="flex-1 relative min-h-0 p-2">
                    {chartConfig.type === 'bar' && <Bar data={chartData} options={options} />}
                    {chartConfig.type === 'line' && <Line data={chartData} options={options} />}
                    {chartConfig.type === 'area' && <Line data={chartData} options={options} />}
                    {chartConfig.type === 'pie' && <Pie data={chartData} options={options} />}
                    {chartConfig.type === 'doughnut' && <Doughnut data={chartData} options={options} />}
                    {chartConfig.type === 'scatter' && <Scatter data={chartData} options={options} />}
                </div>
            </div>
        );
    }

    // Fallback: Table Preview
    return (
        <div className="w-full h-full flex flex-col">
            {titleBar}
            <div className="flex-1 overflow-auto p-2 text-[11px] font-mono custom-scrollbar">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr>{data.length > 0 && Object.keys(data[0]).map(k => <th key={k} className="p-1 border-b border-monokai-accent text-monokai-blue sticky top-0 bg-monokai-sidebar z-10">{k}</th>)}</tr>
                    </thead>
                    <tbody>
                        {data.slice(0, 10).map((row, i) => (
                            <tr key={i} className={`border-b border-monokai-accent/20 ${i % 2 === 1 ? 'bg-monokai-accent/5' : ''}`}>
                                {Object.values(row).map((v: any, j) => <td key={j} className="p-1 text-monokai-fg/80">{String(v)}</td>)}
                            </tr>
                        ))}
                    </tbody>
                </table>
                {data.length === 0 && <div className="text-center mt-4 text-monokai-comment">No Data</div>}
            </div>
            {data.length > 0 && (
                <div className="px-2 py-1 text-[10px] text-monokai-comment border-t border-monokai-accent/20 text-right">
                    Showing {Math.min(data.length, 10)} of {data.length} rows
                </div>
            )}
        </div>
    );
};
