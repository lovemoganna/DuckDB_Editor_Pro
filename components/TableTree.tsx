import React, { useState, useEffect } from 'react';
import { duckDBService } from '../services/duckdbService';
import { getTypeIcon } from '../utils';
import { ColumnInfo } from '../types';

interface TableTreeProps {
    tables: string[];
    onInsert: (text: string) => void;
}

export const TableTree: React.FC<TableTreeProps> = ({ tables, onInsert }) => {
    const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
    const [schemaCache, setSchemaCache] = useState<Record<string, ColumnInfo[]>>({});
    const [loadingSchema, setLoadingSchema] = useState<string | null>(null);

    const toggleExpand = async (table: string) => {
        const newSet = new Set(expandedTables);
        if (newSet.has(table)) {
            newSet.delete(table);
            setExpandedTables(newSet);
        } else {
            newSet.add(table);
            setExpandedTables(newSet);
            // Fetch schema if not cached
            if (!schemaCache[table]) {
                setLoadingSchema(table);
                try {
                    const schema = await duckDBService.getTableSchema(table);
                    setSchemaCache(prev => ({ ...prev, [table]: schema }));
                } catch (e) {
                    console.error(e);
                } finally {
                    setLoadingSchema(null);
                }
            }
        }
    };

    return (
        <div className="flex flex-col select-none">
            {tables.length === 0 && (
                <div className="p-8 text-center text-xs text-monokai-comment italic">
                    No tables found.<br />Import data to get started.
                </div>
            )}
            {tables.map(table => (
                <div key={table} className="border-b border-monokai-accent/30">
                    <div
                        className="p-2 hover:bg-monokai-accent cursor-pointer flex items-center gap-2 group transition-colors"
                        onClick={() => toggleExpand(table)}
                    >
                        <span className="text-[10px] text-monokai-comment group-hover:text-white transition-colors w-4 text-center">
                            {loadingSchema === table ? '⏳' : (expandedTables.has(table) ? '▼' : '▶')}
                        </span>
                        <span className="text-xs font-bold text-monokai-fg group-hover:text-monokai-blue truncate flex-1" title={table}>
                            {table}
                        </span>
                        <button
                            className="text-[10px] opacity-0 group-hover:opacity-100 text-monokai-comment hover:text-white px-2 py-0.5 rounded hover:bg-monokai-bg/50"
                            onClick={(e) => { e.stopPropagation(); onInsert(table); }}
                            title="Insert Table Name"
                        >
                            ⏎
                        </button>
                    </div>

                    {expandedTables.has(table) && schemaCache[table] && (
                        <div className="bg-[#1a1b18] shadow-inner py-1">
                            {schemaCache[table].map(col => (
                                <div
                                    key={col.name}
                                    className="pl-8 pr-2 py-1 text-[11px] font-mono text-monokai-comment hover:text-monokai-orange hover:bg-monokai-accent/20 cursor-pointer flex justify-between group items-center"
                                    onClick={() => onInsert(col.name)}
                                    title={`Click to insert: ${col.name}`}
                                >
                                    <span className={col.pk ? 'text-monokai-pink font-bold' : ''}>
                                        {col.pk ? '🔑 ' : ''}{col.name}
                                    </span>
                                    <span className="opacity-50 text-[9px] flex items-center gap-1 group-hover:opacity-100">
                                        {getTypeIcon(col.type)} {col.type}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};
