import React, { useEffect, useState } from 'react';
import { duckDBService } from '../services/duckdbService';
import { dbService } from '../services/dbService';
import { Dashboard as IDashboard, Tab } from '../types';
import { DashboardGrid } from './DashboardGrid';
import { AddWidgetModal } from './AddWidgetModal';
import { v4 as uuidv4 } from 'uuid';
import {
    LayoutDashboard, Plus, Trash2, RefreshCw, ArrowLeft,
    Save, MoreVertical, Calendar, Clock, Pin
} from 'lucide-react';
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
import ChartDataLabels from 'chartjs-plugin-datalabels';

// Register ChartJS globally for this new Dashboard system
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

export const Dashboard: React.FC<DashboardProps> = ({ tables, onNavigate }) => {
    // Top-Level State
    const [view, setView] = useState<'list' | 'detail'>('list');
    const [dashboards, setDashboards] = useState<IDashboard[]>([]);
    const [currentDashboard, setCurrentDashboard] = useState<IDashboard | null>(null);
    const [loading, setLoading] = useState(true);

    // Detail View State
    const [showAddWidget, setShowAddWidget] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // System Stats (Keep original functionality)
    const [version, setVersion] = useState<string>('Loading...');
    const [stats, setStats] = useState({ tables: 0, extensions: 0 });

    // Default Dashboard Data
    const [recentActivity, setRecentActivity] = useState<any[]>([]);
    const [pinnedQueries, setPinnedQueries] = useState<any[]>([]);

    useEffect(() => {
        loadDashboards();
        loadSystemStats();
    }, []);

    const loadDashboards = async () => {
        const dbs = await dbService.getDashboards();
        setDashboards(dbs);
        setLoading(false);
    };

    const loadSystemStats = async () => {
        try {
            const vRes = await duckDBService.query('SELECT version() as v');
            setVersion(vRes[0]?.v || 'Unknown');
            const exts = await duckDBService.getExtensions();
            setStats({
                tables: tables.length,
                extensions: exts.filter((e: any) => e.installed).length
            });

            // Load History
            const hist = localStorage.getItem('duckdb_sql_history');
            if (hist) {
                setRecentActivity(JSON.parse(hist).slice(0, 5));
            }

            // Load Pinned Queries
            const queries = await dbService.getQueries();
            setPinnedQueries(queries.filter(q => q.pinned).slice(0, 4));
        } catch (e) { console.error(e); }
    };

    const handleCreateDashboard = async () => {
        const name = prompt("Enter Dashboard Name:");
        if (!name) return;
        const newDb: IDashboard = {
            id: uuidv4(),
            name,
            items: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        await dbService.saveDashboard(newDb);
        setDashboards([newDb, ...dashboards]);
        setCurrentDashboard(newDb);
        setView('detail');
    };

    const handleDeleteDashboard = async (id: string) => {
        if (!confirm("Are you sure you want to delete this dashboard?")) return;
        await dbService.deleteDashboard(id);
        const remaining = dashboards.filter(d => d.id !== id);
        setDashboards(remaining);
        if (currentDashboard?.id === id) {
            setView('list');
            setCurrentDashboard(null);
        }
    };

    const handleLayoutChange = (newLayout: any[]) => {
        if (!currentDashboard) return;

        // Map RGL layout back to DashboardItems
        // We only update x, y, w, h. We keep the savedQueryId from the original item.
        const updatedItems = newLayout.map(l => {
            const original = currentDashboard.items.find(i => i.i === l.i);
            if (!original) return null;
            return {
                ...original,
                x: l.x,
                y: l.y,
                w: l.w,
                h: l.h
            };
        }).filter(Boolean) as any[];

        const updatedDashboard = { ...currentDashboard, items: updatedItems, updatedAt: Date.now() };
        setCurrentDashboard(updatedDashboard);
        // Debounce save? For now save on every change is fine for local IndexedDB
        dbService.saveDashboard(updatedDashboard);
    };

    const handleAddWidget = async (queryId: string) => {
        if (!currentDashboard) return;

        // Simple layout logic: find lowest point or just append at bottom
        const y = currentDashboard.items.length > 0
            ? Math.max(...currentDashboard.items.map(i => i.y + i.h))
            : 0;

        const newItem = {
            i: uuidv4(),
            savedQueryId: queryId,
            x: 0,
            y: y,
            w: 6,
            h: 4
        };

        const updated = {
            ...currentDashboard,
            items: [...currentDashboard.items, newItem],
            updatedAt: Date.now()
        };

        setCurrentDashboard(updated);
        await dbService.saveDashboard(updated);
        setShowAddWidget(false);
    };

    const handleRefreshData = () => {
        setRefreshTrigger(prev => prev + 1);
    };

    // --- Render List View ---
    if (view === 'list') {
        return (
            <div className="p-8 h-full overflow-auto bg-monokai-bg text-monokai-fg animate-[fadeIn_0.3s]">
                <header className="mb-8 flex justify-between items-center">
                    <div>
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-monokai-pink to-monokai-purple bg-clip-text text-transparent mb-2">
                            Dashboards
                        </h1>
                        <p className="text-monokai-comment">Manage and visualize your data insights.</p>
                    </div>
                    <button
                        onClick={handleCreateDashboard}
                        className="flex items-center gap-2 px-4 py-2 bg-monokai-green text-monokai-bg font-bold rounded shadow-lg hover:bg-monokai-blue transition-colors"
                    >
                        <Plus size={20} /> New Dashboard
                    </button>
                </header>

                {/* System Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    <div className="bg-monokai-sidebar border border-monokai-accent p-6 rounded-lg shadow-lg relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-6xl">🦆</div>
                        <h3 className="text-monokai-comment text-sm uppercase font-bold tracking-wider mb-2">Engine</h3>
                        <div className="text-2xl font-mono text-monokai-blue font-bold truncate">{version}</div>
                    </div>
                    <div className="bg-monokai-sidebar border border-monokai-accent p-6 rounded-lg shadow-lg relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-6xl">📊</div>
                        <h3 className="text-monokai-comment text-sm uppercase font-bold tracking-wider mb-2">Total Tables</h3>
                        <div className="text-4xl font-mono text-monokai-green font-bold">{stats.tables}</div>
                    </div>
                    <div className="bg-monokai-sidebar border border-monokai-accent p-6 rounded-lg shadow-lg relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-6xl">📁</div>
                        <h3 className="text-monokai-comment text-sm uppercase font-bold tracking-wider mb-2">Dashboards</h3>
                        <div className="text-4xl font-mono text-monokai-orange font-bold">{dashboards.length}</div>
                    </div>
                </div>

                {/* Recent Activity & Pinned */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
                    {/* Recent Activity */}
                    <div className="bg-monokai-sidebar border border-monokai-accent rounded-lg p-6 shadow-lg">
                        <h3 className="text-xl font-bold text-monokai-blue mb-4 flex items-center gap-2">
                            <Clock size={20} /> Recent Activity
                        </h3>
                        {recentActivity.length === 0 ? (
                            <div className="text-monokai-comment italic">No recent queries.</div>
                        ) : (
                            <div className="space-y-3">
                                {recentActivity.map((item: any) => (
                                    <div key={item.id} className="flex justify-between items-center border-b border-monokai-accent/30 pb-2 last:border-0">
                                        <div className="truncate font-mono text-sm text-monokai-fg flex-1 mr-4" title={item.sql}>
                                            {item.sql}
                                        </div>
                                        <div className={`text-xs px-2 py-0.5 rounded ${item.status === 'success' ? 'bg-monokai-green/20 text-monokai-green' : 'bg-monokai-pink/20 text-monokai-pink'}`}>
                                            {item.status}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Pinned Widgets */}
                    <div className="bg-monokai-sidebar border border-monokai-accent rounded-lg p-6 shadow-lg">
                        <h3 className="text-xl font-bold text-monokai-yellow mb-4 flex items-center gap-2">
                            <Pin size={20} /> Pinned Queries
                        </h3>
                        {pinnedQueries.length === 0 ? (
                            <div className="text-monokai-comment italic">No pinned queries.</div>
                        ) : (
                            <div className="grid grid-cols-1 gap-3">
                                {pinnedQueries.map((q: any) => (
                                    <div key={q.id} className="bg-monokai-bg border border-monokai-accent p-3 rounded flex justify-between items-center group cursor-pointer hover:border-monokai-yellow transition-colors">
                                        <div className="font-bold text-sm text-white truncate">{q.name}</div>
                                        <div className="flex gap-2">
                                            <span className="text-[10px] bg-monokai-accent px-1.5 rounded text-monokai-comment">{q.widgetType || 'table'}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <h2 className="text-xl font-bold mb-4 text-monokai-purple flex items-center gap-2">
                    <LayoutDashboard size={20} /> My Dashboards
                </h2>

                {loading ? (
                    <div className="text-monokai-comment animate-pulse">Loading dashboards...</div>
                ) : dashboards.length === 0 ? (
                    <div className="text-center p-12 border border-dashed border-monokai-accent rounded-lg text-monokai-comment">
                        <p className="mb-4">No dashboards yet.</p>
                        <button onClick={handleCreateDashboard} className="text-monokai-blue hover:underline">Create your first one</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {dashboards.map(d => (
                            <div
                                key={d.id}
                                onClick={() => { setCurrentDashboard(d); setView('detail'); }}
                                className="bg-monokai-sidebar border border-monokai-accent rounded-lg p-6 cursor-pointer hover:border-monokai-pink hover:shadow-xl transition-all group relative"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="text-xl font-bold text-white group-hover:text-monokai-pink transition-colors">{d.name}</h3>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteDashboard(d.id); }}
                                        className="opacity-0 group-hover:opacity-100 p-1 text-monokai-comment hover:text-monokai-pink transition-opacity"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                                <div className="text-sm text-monokai-comment mb-4">
                                    {d.items.length} Widgets
                                </div>
                                <div className="text-xs text-monokai-fg/50 flex items-center gap-1">
                                    <Calendar size={12} /> Updated: {new Date(d.updatedAt).toLocaleDateString()}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // --- Render Detail View ---
    if (!currentDashboard) return null;

    return (
        <div className="flex flex-col h-full bg-[#1e1f1c] text-monokai-fg">
            {/* Toolbar */}
            <div className="h-14 bg-monokai-sidebar border-b border-monokai-accent flex justify-between items-center px-4 shadow-md z-10">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => { setView('list'); setCurrentDashboard(null); loadDashboards(); }}
                        className="p-2 hover:bg-monokai-accent/20 rounded text-monokai-comment hover:text-white transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-white">{currentDashboard.name}</h1>
                        <span className="text-[10px] text-monokai-comment">{currentDashboard.items.length} Widgets</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleRefreshData}
                        className="flex items-center gap-2 px-3 py-1.5 bg-monokai-accent/10 border border-monokai-accent rounded hover:bg-monokai-accent/30 text-xs font-bold text-monokai-blue transition-colors"
                        title="Reload all chart data"
                    >
                        <RefreshCw size={14} className={refreshTrigger > 0 ? "animate-spin" : ""} /> Refresh Data
                    </button>
                    <button
                        onClick={() => setShowAddWidget(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-monokai-green text-monokai-bg border border-transparent rounded hover:bg-monokai-fg hover:text-monokai-bg text-xs font-bold transition-colors shadow-sm"
                    >
                        <Plus size={14} /> Add Widget
                    </button>
                </div>
            </div>

            {/* Grid Canvas */}
            <div className="flex-1 overflow-hidden relative p-4 bg-[radial-gradient(#3e3d32_1px,transparent_1px)] [background-size:16px_16px]">
                {currentDashboard.items.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-monokai-comment opacity-50">
                        <LayoutDashboard size={64} className="mb-4" />
                        <p className="text-lg">This dashboard is empty.</p>
                        <button onClick={() => setShowAddWidget(true)} className="mt-4 text-monokai-green hover:underline">Add your first widget</button>
                    </div>
                ) : (
                    <DashboardGrid
                        dashboard={currentDashboard}
                        refreshTrigger={refreshTrigger}
                        onLayoutChange={handleLayoutChange}
                    />
                )}
            </div>

            {showAddWidget && (
                <AddWidgetModal
                    onClose={() => setShowAddWidget(false)}
                    onAdd={handleAddWidget}
                />
            )}
        </div>
    );
};