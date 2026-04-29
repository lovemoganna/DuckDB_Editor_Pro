import React, { useState, useEffect } from 'react';
import { duckDBService } from '../services/duckdbService';
import { Database, Upload, Trash2, Eye, Table as TableIcon, RefreshCw } from 'lucide-react';

interface TableManagerProps {
    onTableSelect: (tableName: string) => void;
    activeTable: string | null;
}

export const TableManager: React.FC<TableManagerProps> = ({ onTableSelect, activeTable }) => {
    const [tables, setTables] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        loadTables();
    }, []);

    const loadTables = async () => {
        setLoading(true);
        try {
            const list = await duckDBService.getTables();
            setTables(list);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        setUploading(true);
        try {
            const file = e.target.files[0];
            // Clean name
            const tableName = file.name.split('.')[0].replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            await duckDBService.importFile(file, tableName);
            await loadTables();
            onTableSelect(tableName);
        } catch (e) {
            console.error("Upload failed", e);
            alert("Upload Failed: " + e);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (table: string) => {
        if (!confirm(`Delete table ${table}?`)) return;
        try {
            await duckDBService.dropTable(table);
            await loadTables();
            if (activeTable === table) onTableSelect('');
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="w-64 bg-monokai-bg border-r border-monokai-accent h-full flex flex-col">
            <div className="p-4 border-b border-monokai-accent flex justify-between items-center">
                <h3 className="font-bold text-monokai-fg flex items-center gap-2">
                    <Database className="w-4 h-4" /> Tables
                </h3>
                <button onClick={loadTables} className="p-1 hover:bg-monokai-sidebar rounded">
                    <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {tables.map(t => (
                    <div
                        key={t}
                        className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer text-sm ${activeTable === t ? 'bg-monokai-blue/20 text-monokai-blue' : 'hover:bg-monokai-sidebar text-monokai-fg'
                            }`}
                        onClick={() => onTableSelect(t)}
                    >
                        <div className="flex items-center gap-2 overflow-hidden">
                            <TableIcon className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">{t}</span>
                        </div>
                        {activeTable !== t && (
                            <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(t); }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:text-monokai-red"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                ))}

                {tables.length === 0 && !loading && (
                    <div className="text-center py-8 text-monokai-comment text-xs">
                        No tables found
                    </div>
                )}
            </div>

            <div className="p-3 border-t border-monokai-border bg-monokai-surface">
                <label className={`flex items-center justify-center gap-2 w-full py-2 border-2 border-dashed border-monokai-accent rounded-lg cursor-pointer hover:border-monokai-blue hover:bg-monokai-blue/10 transition-all ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                    <Upload className="w-4 h-4 text-monokai-blue" />
                    <span className="text-xs font-medium text-monokai-fg">
                        {uploading ? 'Importing...' : 'Import CSV'}
                    </span>
                    <input type="file" accept=".csv,.parquet,.json" className="hidden" onChange={handleUpload} />
                </label>
            </div>
        </div>
    );
};
