import React, { useEffect, useState } from 'react';
import { duckDBService } from '../services/duckdbService';
import { dbService } from '../services/dbService';
import { SavedQuery, ChartConfig } from '../types';
import { transformDataForChart, getChartOptions } from '../utils/chartUtils';
import { Bar, Line, Pie, Doughnut, Scatter } from 'react-chartjs-2';
import { RefreshCw, AlertCircle, Maximize2 } from 'lucide-react';

interface DashboardWidgetProps {
    savedQueryId: string;
    refreshTrigger: number;
}

export const DashboardWidget: React.FC<DashboardWidgetProps> = ({ savedQueryId, refreshTrigger }) => {
    const [query, setQuery] = useState<SavedQuery | null>(null);
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
                <div className="flex justify-between items-center px-2 py-1 bg-monokai-bg/50 border-b border-monokai-accent/30 handle cursor-move">
                    <span className="text-xs font-bold text-monokai-fg truncate flex-1">{query.name}</span>
                </div>
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
            <div className="flex justify-between items-center px-2 py-1 bg-monokai-bg/50 border-b border-monokai-accent/30 handle cursor-move">
                <span className="text-xs font-bold text-monokai-fg truncate flex-1">{query.name}</span>
            </div>
            <div className="flex-1 overflow-auto p-2 text-[10px] font-mono custom-scrollbar">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr>{data.length > 0 && Object.keys(data[0]).map(k => <th key={k} className="p-1 border-b border-monokai-accent text-monokai-blue">{k}</th>)}</tr>
                    </thead>
                    <tbody>
                        {data.slice(0, 10).map((row, i) => (
                            <tr key={i} className="border-b border-monokai-accent/20">
                                {Object.values(row).map((v: any, j) => <td key={j} className="p-1 text-monokai-fg/80">{String(v)}</td>)}
                            </tr>
                        ))}
                    </tbody>
                </table>
                {data.length === 0 && <div className="text-center mt-4 text-monokai-comment">No Data</div>}
            </div>
        </div>
    );
};
