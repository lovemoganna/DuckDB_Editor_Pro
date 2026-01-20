import React, { useEffect, useState, useRef } from 'react';
import { duckDBService } from '../services/duckdbService';
import { SavedQuery, Tab } from '../types';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line, Pie, Doughnut, Scatter } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels
);

interface DashboardProps {
    tables: string[];
    onNavigate: (tab: Tab) => void;
}

interface WidgetResult {
    id: string;
    name: string;
    type: 'value' | 'table' | 'chart';
    data?: any;
    error?: string;
    loading: boolean;
    chartConfig?: any;
}

const MONOKAI_COLORS = [
    'rgba(249, 38, 114, 0.7)', // Pink
    'rgba(166, 226, 46, 0.7)', // Green
    'rgba(102, 217, 239, 0.7)', // Blue
    'rgba(253, 151, 31, 0.7)', // Orange
    'rgba(174, 129, 255, 0.7)', // Purple
];

export const Dashboard: React.FC<DashboardProps> = ({ tables, onNavigate }) => {
    const [version, setVersion] = useState<string>('Loading...');
    const [recentActivity, setRecentActivity] = useState<any[]>([]);
    const [stats, setStats] = useState({ tables: 0, extensions: 0 });
    const [widgets, setWidgets] = useState<WidgetResult[]>([]);

    useEffect(() => {
        const fetchSystemData = async () => {
            try {
                // Get Version
                const vRes = await duckDBService.query('SELECT version() as v');
                setVersion(vRes[0]?.v || 'Unknown');

                // Get Recent Audit Logs
                const logs = await duckDBService.query('SELECT * FROM _sys_audit_log ORDER BY log_time DESC LIMIT 5');
                setRecentActivity(logs);
                
                // Get Ext Count
                const exts = await duckDBService.getExtensions();
                setStats({
                    tables: tables.length,
                    extensions: exts.filter((e: any) => e.installed).length
                });

            } catch (e) {
                console.error(e);
            }
        };

        const fetchWidgets = async () => {
            const savedStr = localStorage.getItem('duckdb_saved_queries');
            if (!savedStr) return;
            
            const saved: SavedQuery[] = JSON.parse(savedStr);
            const pinned = saved.filter(s => s.pinned);
            
            if (pinned.length === 0) return;

            // Initialize widgets state
            setWidgets(pinned.map(p => ({
                id: p.id,
                name: p.name,
                type: p.widgetType || 'table',
                loading: true,
                chartConfig: p.chartConfig
            })));

            // Fetch data for each widget
            for (const p of pinned) {
                try {
                    let res: any[] = [];
                    // Limit rows for table widgets, allow more for charts
                    const limit = p.widgetType === 'chart' ? 200 : 5;
                    const sql = p.widgetType === 'value' ? p.sql : `SELECT * FROM (${p.sql.replace(/;+$/, '')}) LIMIT ${limit}`;
                    
                    try {
                        res = await duckDBService.query(sql);
                    } catch (err: any) {
                         setWidgets(prev => prev.map(w => w.id === p.id ? { ...w, loading: false, error: err.message } : w));
                         continue;
                    }

                    setWidgets(prev => prev.map(w => {
                        if (w.id !== p.id) return w;
                        
                        let data: any = res;
                        if (w.type === 'value' && res.length > 0) {
                            // Get first value of first row
                            data = Object.values(res[0])[0];
                        }

                        return {
                            ...w,
                            loading: false,
                            data
                        };
                    }));
                } catch (e) {
                    console.error("Widget Error", e);
                }
            }
        };

        fetchSystemData();
        fetchWidgets();
    }, [tables]);

    const renderChartWidget = (w: WidgetResult) => {
        if (!w.data || !w.chartConfig) return <div className="text-xs text-monokai-comment">Config Error</div>;
        
        // Handle migration for old saved widgets that might have yKey string instead of array
        const xKey = w.chartConfig.xKey;
        const yKeys = Array.isArray(w.chartConfig.yKeys) ? w.chartConfig.yKeys : [w.chartConfig.yKey];
        const yRightKeys = w.chartConfig.yRightKeys || [];
        const type = w.chartConfig.type;
        const stacked = !!w.chartConfig.stacked;
        const horizontal = !!w.chartConfig.horizontal;
        
        const options: any = {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: horizontal ? 'y' : 'x',
            plugins: { 
                legend: { display: type === 'pie' || type === 'doughnut' || yKeys.length > 1 || yRightKeys.length > 0, labels: { color: '#f8f8f2', font: { size: 8 } } },
                title: { display: false },
                datalabels: {
                    color: '#fff',
                    display: 'auto',
                    font: { weight: 'bold', size: 9 },
                    anchor: stacked ? 'center' : (type === 'bar' ? 'end' : 'center'),
                    align: stacked ? 'center' : (type === 'bar' ? 'top' : 'center'),
                    offset: 0,
                    textShadowBlur: 2,
                    textShadowColor: 'rgba(0,0,0,0.5)',
                    formatter: (value: any) => {
                       if (typeof value === 'object' && value !== null) return value.y;
                       return value;
                    }
                }
            },
            scales: (type === 'pie' || type === 'doughnut') ? {
                x: { display: false },
                y: { display: false }
            } : {
                x: { display: false, stacked }, 
                y: { display: false, stacked },
                y1: { display: false } // Hide axis labels on dashboard to save space, but keep scale logic
            }
        };

        let chartData: any;

        if (type === 'scatter') {
             const yKey = yKeys[0];
             chartData = {
                datasets: [{
                    label: yKey,
                    data: w.data.map((r: any) => ({ x: Number(r[xKey]), y: Number(r[yKey]) })),
                    backgroundColor: MONOKAI_COLORS[0],
                    pointRadius: 2
                }]
            };
        } else {
            const labels = w.data.map((r: any) => String(r[xKey]));
            
            const datasets = yKeys.map((yKey: string, index: number) => {
                const data = w.data.map((r: any) => Number(r[yKey]));
                const color = MONOKAI_COLORS[index % MONOKAI_COLORS.length];
                
                return {
                    label: yKey,
                    data: data,
                    backgroundColor: (type === 'pie' || type === 'doughnut') ? MONOKAI_COLORS : color,
                    borderColor: 'transparent',
                    borderWidth: 0,
                    fill: (type === 'line' && yKeys.length === 1 && !stacked),
                    yAxisID: 'y'
                };
            });

            // Add right axis datasets
            yRightKeys.forEach((yKey: string, index: number) => {
                const data = w.data.map((r: any) => Number(r[yKey]));
                const color = MONOKAI_COLORS[(yKeys.length + index) % MONOKAI_COLORS.length];
                datasets.push({
                    label: yKey,
                    data: data,
                    type: 'line',
                    backgroundColor: color,
                    borderColor: color.replace('0.7', '1'),
                    borderWidth: 2,
                    fill: false,
                    yAxisID: 'y1'
                } as any);
            });

            chartData = {
                labels,
                datasets
            };
        }

        switch(type) {
            case 'bar': return <Bar data={chartData} options={options} />;
            case 'line': return <Line data={chartData} options={options} />;
            case 'pie': return <Pie data={chartData} options={options} />;
            case 'doughnut': return <Doughnut data={chartData} options={options} />;
            case 'scatter': return <Scatter data={chartData} options={options} />;
            default: return null;
        }
    };

    return (
        <div className="p-8 h-full overflow-auto bg-monokai-bg text-monokai-fg">
            <header className="mb-8">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-monokai-pink to-monokai-purple bg-clip-text text-transparent mb-2">
                    DuckDB Manager Pro
                </h1>
                <p className="text-monokai-comment">High-performance browser-based database management.</p>
            </header>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-monokai-sidebar border border-monokai-accent p-6 rounded-lg shadow-lg relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-6xl">🦆</div>
                    <h3 className="text-monokai-comment text-sm uppercase font-bold tracking-wider mb-2">Engine Version</h3>
                    <div className="text-2xl font-mono text-monokai-blue font-bold truncate">{version}</div>
                </div>

                <div className="bg-monokai-sidebar border border-monokai-accent p-6 rounded-lg shadow-lg relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-6xl">📊</div>
                    <h3 className="text-monokai-comment text-sm uppercase font-bold tracking-wider mb-2">Total Tables</h3>
                    <div className="text-4xl font-mono text-monokai-green font-bold">{stats.tables}</div>
                </div>

                <div className="bg-monokai-sidebar border border-monokai-accent p-6 rounded-lg shadow-lg relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-6xl">🧩</div>
                    <h3 className="text-monokai-comment text-sm uppercase font-bold tracking-wider mb-2">Active Plugins</h3>
                    <div className="text-4xl font-mono text-monokai-orange font-bold">{stats.extensions}</div>
                </div>
            </div>

            {/* Pinned Widgets Section */}
            {widgets.length > 0 && (
                <div className="mb-8">
                     <h2 className="text-xl font-bold mb-4 text-monokai-yellow flex items-center gap-2">
                        <span>📌</span> Pinned Metrics
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {widgets.map(w => (
                            <div key={w.id} className="bg-monokai-sidebar border border-monokai-accent rounded-lg shadow-lg p-4 flex flex-col h-48">
                                <h3 className="text-sm font-bold text-monokai-comment uppercase mb-2 truncate" title={w.name}>{w.name}</h3>
                                <div className="flex-1 flex items-center justify-center overflow-hidden relative">
                                    {w.loading ? (
                                        <div className="animate-pulse text-monokai-comment text-xs">Loading...</div>
                                    ) : w.error ? (
                                        <div className="text-monokai-pink text-xs text-center">{w.error}</div>
                                    ) : w.type === 'value' ? (
                                        <div className="text-4xl font-mono font-bold text-monokai-fg">{String(w.data)}</div>
                                    ) : w.type === 'chart' ? (
                                        <div className="w-full h-full p-2">
                                            {renderChartWidget(w)}
                                        </div>
                                    ) : (
                                        <div className="w-full h-full overflow-auto text-[10px] font-mono">
                                            {Array.isArray(w.data) && w.data.length > 0 ? (
                                                <table className="w-full text-left">
                                                    <thead>
                                                        <tr className="border-b border-monokai-accent">
                                                            {Object.keys(w.data[0]).slice(0, 3).map(k => <th key={k} className="p-1 text-monokai-blue">{k}</th>)}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {w.data.map((r: any, i: number) => (
                                                            <tr key={i} className="border-b border-monokai-accent/30">
                                                                {Object.values(r).slice(0, 3).map((v: any, idx) => <td key={idx} className="p-1 truncate max-w-[80px]">{String(v)}</td>)}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            ) : (
                                                <div className="text-monokai-comment">No Data</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Quick Actions */}
                <div>
                    <h2 className="text-xl font-bold mb-4 text-monokai-blue flex items-center gap-2">
                        <span>⚡</span> Quick Actions
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                        <button 
                            onClick={() => onNavigate(Tab.SQL)}
                            className="p-4 bg-monokai-sidebar border border-monokai-accent rounded hover:border-monokai-pink hover:bg-monokai-accent transition-all text-left group"
                        >
                            <div className="text-2xl mb-2 group-hover:scale-110 transition-transform origin-left">📝</div>
                            <div className="font-bold text-monokai-fg">SQL Editor</div>
                            <div className="text-xs text-monokai-comment mt-1">Write custom queries with AI</div>
                        </button>

                        <button 
                            onClick={() => onNavigate(Tab.TUTORIALS)}
                            className="p-4 bg-monokai-sidebar border border-monokai-accent rounded hover:border-monokai-green hover:bg-monokai-accent transition-all text-left group"
                        >
                            <div className="text-2xl mb-2 group-hover:scale-110 transition-transform origin-left">🎓</div>
                            <div className="font-bold text-monokai-fg">Tutorials</div>
                            <div className="text-xs text-monokai-comment mt-1">Learn Advanced SQL</div>
                        </button>
                        
                        <button 
                             onClick={() => onNavigate(Tab.DATA)}
                             className="p-4 bg-monokai-sidebar border border-monokai-accent rounded hover:border-monokai-yellow hover:bg-monokai-accent transition-all text-left group"
                        >
                            <div className="text-2xl mb-2 group-hover:scale-110 transition-transform origin-left">📂</div>
                            <div className="font-bold text-monokai-fg">Browse Data</div>
                            <div className="text-xs text-monokai-comment mt-1">View and edit table data</div>
                        </button>

                        <button 
                             onClick={() => onNavigate(Tab.AUDIT)}
                             className="p-4 bg-monokai-sidebar border border-monokai-accent rounded hover:border-monokai-orange hover:bg-monokai-accent transition-all text-left group"
                        >
                            <div className="text-2xl mb-2 group-hover:scale-110 transition-transform origin-left">📜</div>
                            <div className="font-bold text-monokai-fg">Audit Log</div>
                            <div className="text-xs text-monokai-comment mt-1">Track system changes</div>
                        </button>
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="flex flex-col h-full">
                    <h2 className="text-xl font-bold mb-4 text-monokai-purple flex items-center gap-2">
                        <span>🕒</span> Recent Activity
                    </h2>
                    <div className="bg-monokai-sidebar border border-monokai-accent rounded flex-1 overflow-hidden">
                        {recentActivity.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-monokai-comment p-6 text-center">
                                <div className="text-4xl mb-2 opacity-50">💤</div>
                                <p className="mb-4">No recent activity detected.</p>
                                <button 
                                    onClick={() => onNavigate(Tab.TUTORIALS)}
                                    className="px-4 py-2 bg-monokai-accent hover:bg-monokai-purple text-white rounded text-xs font-bold transition-colors"
                                >
                                    Start Learning
                                </button>
                            </div>
                        ) : (
                            <div className="divide-y divide-monokai-accent">
                                {recentActivity.map((log) => (
                                    <div key={log.id} className="p-3 hover:bg-monokai-accent/30 transition-colors">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs font-bold text-monokai-green uppercase">{log.operation_type}</span>
                                            <span className="text-[10px] text-monokai-comment">{new Date(log.log_time).toLocaleTimeString()}</span>
                                        </div>
                                        <div className="text-xs text-monokai-fg truncate opacity-90">
                                            {log.details}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};