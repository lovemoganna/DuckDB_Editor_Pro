import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight, Database, Hash, Type, Calendar, ToggleLeft, List, Box, FileText, DatabaseZap, Key, Search, X, Layers, CornerDownRight } from 'lucide-react';
import { duckDBService } from '../services/duckdbService';
import { ColumnInfo } from '../types';

interface TableTreeProps {
    tables: string[];
    onInsert: (text: string) => void;
}

const TYPE_ICONS: Record<string, { icon: React.ReactNode; color: string }> = {
    int: { icon: <Hash size={10} />, color: 'text-monokai-blue' },
    float: { icon: <Hash size={10} />, color: 'text-monokai-blue' },
    double: { icon: <Hash size={10} />, color: 'text-monokai-blue' },
    decimal: { icon: <Hash size={10} />, color: 'text-monokai-blue' },
    varchar: { icon: <Type size={10} />, color: 'text-monokai-green' },
    text: { icon: <Type size={10} />, color: 'text-monokai-green' },
    char: { icon: <Type size={10} />, color: 'text-monokai-green' },
    blob: { icon: <FileText size={10} />, color: 'text-monokai-orange' },
    date: { icon: <Calendar size={10} />, color: 'text-monokai-yellow' },
    time: { icon: <Calendar size={10} />, color: 'text-monokai-yellow' },
    timestamp: { icon: <Calendar size={10} />, color: 'text-monokai-yellow' },
    bool: { icon: <ToggleLeft size={10} />, color: 'text-monokai-purple' },
    list: { icon: <List size={10} />, color: 'text-monokai-accent' },
    array: { icon: <List size={10} />, color: 'text-monokai-accent' },
    struct: { icon: <Box size={10} />, color: 'text-monokai-pink' },
    map: { icon: <Box size={10} />, color: 'text-monokai-pink' },
    json: { icon: <FileText size={10} />, color: 'text-monokai-orange' },
};

const getColumnMeta = (type: string): { icon: React.ReactNode; color: string; label: string } => {
    const t = type.toUpperCase();
    if (/INT|FLOAT|DOUBLE|DECIMAL/.test(t)) return { icon: <Hash size={10} />, color: 'text-monokai-blue', label: 'NUM' };
    if (/CHAR|TEXT|STRING/.test(t)) return { icon: <Type size={10} />, color: 'text-monokai-green', label: 'TXT' };
    if (/DATE|TIME/.test(t)) return { icon: <Calendar size={10} />, color: 'text-monokai-yellow', label: 'DAT' };
    if (/BOOL/.test(t)) return { icon: <ToggleLeft size={10} />, color: 'text-monokai-purple', label: 'BOOL' };
    if (/LIST|ARRAY/.test(t)) return { icon: <List size={10} />, color: 'text-monokai-accent', label: 'LIST' };
    if (/STRUCT|MAP/.test(t)) return { icon: <Box size={10} />, color: 'text-monokai-pink', label: 'OBJ' };
    if (/JSON/.test(t)) return { icon: <FileText size={10} />, color: 'text-monokai-orange', label: 'JSON' };
    if (/BLOB/.test(t)) return { icon: <FileText size={10} />, color: 'text-monokai-orange', label: 'BIN' };
    return { icon: <FileText size={10} />, color: 'text-monokai-comment', label: type.slice(0, 4).toUpperCase() };
};

export const TableTree: React.FC<TableTreeProps> = ({ tables, onInsert }) => {
    const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
    const [schemaCache, setSchemaCache] = useState<Record<string, ColumnInfo[]>>({});
    const [loadingSchema, setLoadingSchema] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredTables = useMemo(() => {
        if (!searchQuery.trim()) return tables;
        const q = searchQuery.toLowerCase();
        return tables.filter(t => t.toLowerCase().includes(q));
    }, [tables, searchQuery]);

    const toggleExpand = async (table: string) => {
        const newSet = new Set(expandedTables);
        if (newSet.has(table)) {
            newSet.delete(table);
        } else {
            newSet.add(table);
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
        setExpandedTables(newSet);
    };

    const totalColumns = useMemo(() => {
        return Object.values(schemaCache).reduce((sum, cols) => sum + cols.length, 0);
    }, [schemaCache]);

    return (
        <div className="flex flex-col select-none h-full">
            {/* Header */}
            <div className="p-2 border-b border-monokai-accent/50 bg-monokai-bg/80 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-1.5">
                    <Layers size={11} className="text-monokai-purple shrink-0" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-monokai-comment">
                        {tables.length} {tables.length === 1 ? 'Table' : 'Tables'}
                    </span>
                    {searchQuery && (
                        <span className="ml-auto text-[9px] text-monokai-purple">
                            {filteredTables.length} match{filteredTables.length !== 1 ? 'es' : ''}
                        </span>
                    )}
                </div>
                <div className="relative">
                    <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-monokai-comment/50 pointer-events-none" />
                    <input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Filter tables..."
                        className="w-full bg-monokai-surface border border-monokai-accent/50 rounded pl-6 pr-5 py-1 text-[10px] text-monokai-fg placeholder:text-monokai-comment/40 outline-none focus:border-monokai-purple/60 focus:bg-monokai-bg transition-colors"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-monokai-comment/50 hover:text-monokai-comment">
                            <X size={10} />
                        </button>
                    )}
                </div>
            </div>

            {/* Table list */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {filteredTables.length === 0 && tables.length > 0 && (
                    <div className="p-6 text-center">
                        <Search size={20} className="mx-auto mb-2 text-monokai-comment/30" />
                        <div className="text-[10px] text-monokai-comment/50 italic">No tables match "{searchQuery}"</div>
                    </div>
                )}
                {filteredTables.length === 0 && tables.length === 0 && (
                    <div className="p-8 text-center">
                        <Database size={24} className="mx-auto mb-3 text-monokai-comment/20" />
                        <div className="text-[10px] text-monokai-comment italic leading-relaxed">
                            No tables found.<br />Import data to get started.
                        </div>
                    </div>
                )}
                {filteredTables.map(table => (
                    <TableRow
                        key={table}
                        table={table}
                        isExpanded={expandedTables.has(table)}
                        isLoading={loadingSchema === table}
                        columns={schemaCache[table]}
                        searchQuery={searchQuery}
                        onToggle={() => toggleExpand(table)}
                        onInsert={onInsert}
                    />
                ))}
            </div>

            {/* Footer stats */}
            {totalColumns > 0 && (
                <div className="p-2 border-t border-monokai-accent/30 bg-monokai-bg/50 flex items-center justify-between">
                    <span className="text-[9px] text-monokai-comment/50">
                        {Object.keys(schemaCache).length} loaded · {totalColumns} columns
                    </span>
                    <span className="text-[9px] text-monokai-comment/30">Click to expand</span>
                </div>
            )}
        </div>
    );
};

interface TableRowProps {
    table: string;
    isExpanded: boolean;
    isLoading: boolean;
    columns?: ColumnInfo[];
    searchQuery: string;
    onToggle: () => void;
    onInsert: (text: string) => void;
}

const TableRow: React.FC<TableRowProps> = ({
    table, isExpanded, isLoading, columns, searchQuery, onToggle, onInsert
}) => {
    return (
        <div className="border-b border-monokai-accent/20 last:border-b-0">
            {/* Table Header */}
            <div
                className={`group flex items-center gap-1.5 px-2 py-2 cursor-pointer transition-all duration-150 ${isExpanded ? 'bg-monokai-purple/10' : 'hover:bg-monokai-surface'}`}
                onClick={onToggle}
            >
                <span className="w-4 flex items-center justify-center shrink-0">
                    {isLoading ? (
                        <div className="w-3 h-3 border border-monokai-comment/30 border-t-monokai-purple rounded-full animate-spin" />
                    ) : isExpanded ? (
                        <ChevronDown size={10} className="text-monokai-purple" />
                    ) : (
                        <ChevronRight size={10} className="text-monokai-comment/50 group-hover:text-monokai-comment transition-colors" />
                    )}
                </span>

                <Database size={11} className="text-monokai-purple/70 shrink-0" />

                <span
                    className="flex-1 text-[11px] font-semibold text-monokai-fg group-hover:text-monokai-blue truncate transition-colors"
                    title={table}
                >
                    {searchQuery ? <HighlightMatch text={table} query={searchQuery} /> : table}
                </span>

                {columns && (
                    <span className="text-[9px] text-monokai-comment/40 group-hover:text-monokai-comment/60 shrink-0 tabular-nums">
                        {columns.length}
                    </span>
                )}

                <button
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-monokai-comment/40 hover:text-monokai-purple bg-monokai-bg hover:bg-monokai-purple/10 px-1.5 py-0.5 rounded transition-all text-[9px] font-mono border border-monokai-accent/30 hover:border-monokai-purple/40"
                    onClick={(e) => { e.stopPropagation(); onInsert(table); }}
                    title={`Insert "${table}"`}
                >
                    <CornerDownRight className="w-3 h-3" />
                </button>
            </div>

            {/* Columns */}
            {isExpanded && columns && (
                <div className="bg-monokai-bg/60 border-t border-monokai-accent/10">
                    {/* Column header */}
                    <div className="flex items-center gap-1 px-2 py-1 border-b border-monokai-accent/10 bg-monokai-surface/30">
                        <span className="w-4" />
                        <span className="flex-1 text-[8px] uppercase tracking-widest text-monokai-comment/40 font-bold pl-3">Column</span>
                        <span className="text-[8px] uppercase tracking-widest text-monokai-comment/40 font-bold w-10 text-center">Type</span>
                    </div>
                    {columns.map((col, idx) => {
                        const meta = getColumnMeta(col.type);
                        return (
                            <div
                                key={col.name}
                                className="group flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-monokai-surface transition-colors"
                                onClick={() => onInsert(col.name)}
                                title={`Insert: ${col.name} (${col.type})`}
                            >
                                <span className="w-4 flex items-center justify-center">
                                    {col.pk ? (
                                        <Key size={10} className="text-monokai-yellow" />
                                    ) : (
                                        <span className="text-[8px] text-monokai-comment/30 w-3 text-center">{idx + 1}</span>
                                    )}
                                </span>

                                <span className={`flex-1 text-[10px] font-mono pl-3 truncate ${col.pk ? 'text-monokai-yellow font-semibold' : 'text-monokai-fg/80 group-hover:text-monokai-orange'}`}>
                                    {searchQuery ? <HighlightMatch text={col.name} query={searchQuery} highlightClass="text-monokai-orange bg-monokai-orange/20 px-0.5 rounded" /> : col.name}
                                </span>

                                <span className={`flex items-center gap-0.5 text-[9px] font-mono ${meta.color} opacity-60 group-hover:opacity-100 w-10 text-right shrink-0 transition-opacity`}>
                                    {meta.icon}
                                    <span>{meta.label}</span>
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const HighlightMatch: React.FC<{ text: string; query: string; highlightClass?: string }> = ({ text, query, highlightClass = 'text-monokai-purple bg-monokai-purple/20 px-0.5 rounded' }) => {
    if (!query) return <>{text}</>;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return <>{text}</>;
    return (
        <>
            {text.slice(0, idx)}
            <span className={highlightClass}>{text.slice(idx, idx + query.length)}</span>
            {text.slice(idx + query.length)}
        </>
    );
};
