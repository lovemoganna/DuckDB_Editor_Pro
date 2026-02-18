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
        <div className="w-64 bg-gray-50 border-r border-gray-200 h-full flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                    <Database className="w-4 h-4" /> Tables
                </h3>
                <button onClick={loadTables} className="p-1 hover:bg-gray-200 rounded">
                    <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {tables.map(t => (
                    <div
                        key={t}
                        className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer text-sm ${activeTable === t ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-600'
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
                                className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                ))}

                {tables.length === 0 && !loading && (
                    <div className="text-center py-8 text-gray-400 text-xs">
                        No tables found
                    </div>
                )}
            </div>

            <div className="p-3 border-t border-gray-200 bg-white">
                <label className={`flex items-center justify-center gap-2 w-full py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                    <Upload className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-medium text-gray-600">
                        {uploading ? 'Importing...' : 'Import CSV'}
                    </span>
                    <input type="file" accept=".csv,.parquet,.json" className="hidden" onChange={handleUpload} />
                </label>
            </div>
        </div>
    );
};
