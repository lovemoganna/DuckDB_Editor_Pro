import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight, Database, Hash, Type, Calendar, ToggleLeft, List, Box, FileText, Key, Search, X, Layers, CornerDownRight } from 'lucide-react';
import { useSqlEditorStore } from '../hooks/store/useSqlEditorStore';
import { ColumnInfo } from '../types';

interface TableTreeProps {
    tables: string[];
    onInsert: (text: string) => void;
}

const getColumnMeta = (type: string): { icon: React.ReactNode; color: string; label: string } => {
    const t = type.toUpperCase();
    if (/INT|FLOAT|DOUBLE|DECIMAL/.test(t)) return { icon: <Hash size={9} />, color: 'text-monokai-blue bg-monokai-blue/10 border-monokai-blue/20', label: 'NUM' };
    if (/CHAR|TEXT|STRING/.test(t)) return { icon: <Type size={9} />, color: 'text-monokai-green bg-monokai-green/10 border-monokai-green/20', label: 'TXT' };
    if (/DATE|TIME/.test(t)) return { icon: <Calendar size={9} />, color: 'text-monokai-yellow bg-monokai-yellow/10 border-monokai-yellow/20', label: 'DAT' };
    if (/BOOL/.test(t)) return { icon: <ToggleLeft size={9} />, color: 'text-monokai-amethyst bg-monokai-amethyst/10 border-monokai-amethyst/20', label: 'BOOL' };
    if (/LIST|ARRAY/.test(t)) return { icon: <List size={9} />, color: 'text-monokai-accent bg-monokai-accent/10 border-monokai-accent/20', label: 'LIST' };
    if (/STRUCT|MAP/.test(t)) return { icon: <Box size={9} />, color: 'text-monokai-pink bg-monokai-pink/10 border-monokai-pink/20', label: 'OBJ' };
    if (/JSON/.test(t)) return { icon: <FileText size={9} />, color: 'text-monokai-orange bg-monokai-orange/10 border-monokai-orange/20', label: 'JSON' };
    if (/BLOB/.test(t)) return { icon: <FileText size={9} />, color: 'text-monokai-orange bg-monokai-orange/10 border-monokai-orange/20', label: 'BIN' };
    return { icon: <FileText size={9} />, color: 'text-monokai-comment bg-monokai-comment/10 border-monokai-comment/20', label: type.slice(0, 4).toUpperCase() };
};

export const TableTree: React.FC<TableTreeProps> = ({ tables, onInsert }) => {
    const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    
    // Subscribe to the global schemaTree store
    const schemaTree = useSqlEditorStore(s => s.schemaTree);

    // Deep filtering for table names and column names
    const filteredTables = useMemo(() => {
        if (!searchQuery.trim()) return tables;
        const q = searchQuery.toLowerCase();
        return tables.filter(t => {
            const tableMatches = t.toLowerCase().includes(q);
            const cols = schemaTree[t] || [];
            const columnMatches = cols.some(col => col.name.toLowerCase().includes(q));
            return tableMatches || columnMatches;
        });
    }, [tables, searchQuery, schemaTree]);

    // Auto-expand tables containing columns that match the search query
    useEffect(() => {
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const autoExpand = new Set<string>();
            tables.forEach(t => {
                const cols = schemaTree[t] || [];
                const columnMatches = cols.some(col => col.name.toLowerCase().includes(q));
                if (columnMatches) {
                    autoExpand.add(t);
                }
            });
            if (autoExpand.size > 0) {
                setExpandedTables(prev => {
                    const next = new Set(prev);
                    autoExpand.forEach(t => next.add(t));
                    return next;
                });
            }
        }
    }, [searchQuery, tables, schemaTree]);

    const toggleExpand = (table: string) => {
        const newSet = new Set(expandedTables);
        if (newSet.has(table)) {
            newSet.delete(table);
        } else {
            newSet.add(table);
        }
        setExpandedTables(newSet);
    };

    const totalColumns = useMemo(() => {
        return Object.values(schemaTree).reduce((sum, cols) => sum + cols.length, 0);
    }, [schemaTree]);

    return (
        <div className="flex flex-col select-none h-full bg-monokai-bg">
            {/* Header */}
            <div className="p-2 border-b border-monokai-border/40 bg-monokai-surface/50 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                        <Layers size={10} className="text-monokai-amethyst shrink-0" />
                        <span className="text-[9px] font-bold uppercase tracking-widest text-monokai-comment">
                            {tables.length} {tables.length === 1 ? 'Table' : 'Tables'}
                        </span>
                    </div>
                    {searchQuery && (
                        <span className="text-[8px] bg-monokai-amethyst/10 text-monokai-amethyst border border-monokai-amethyst/30 px-1 rounded-sm">
                            {filteredTables.length} match{filteredTables.length !== 1 ? 'es' : ''}
                        </span>
                    )}
                </div>
                <div className="relative">
                    <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-monokai-comment/50 pointer-events-none" />
                    <input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search tables & columns..."
                        className="w-full bg-monokai-surface border border-monokai-border/50 rounded pl-6 pr-5 py-1 text-[10px] text-monokai-fg placeholder:text-monokai-comment/40 outline-none focus:border-monokai-amethyst/60 focus:bg-monokai-bg transition-colors"
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
                        <div className="text-[10px] text-monokai-comment/50 italic font-mono">No matches found for "{searchQuery}"</div>
                    </div>
                )}
                {filteredTables.length === 0 && tables.length === 0 && (
                    <div className="p-8 text-center">
                        <Database size={24} className="mx-auto mb-3 text-monokai-comment/20" />
                        <div className="text-[10px] text-monokai-comment italic leading-relaxed font-sans">
                            No tables found.<br />Import data to get started.
                        </div>
                    </div>
                )}
                {filteredTables.map(table => (
                    <TableRow
                        key={table}
                        table={table}
                        isExpanded={expandedTables.has(table)}
                        isLoading={false}
                        columns={schemaTree[table]}
                        searchQuery={searchQuery}
                        onToggle={() => toggleExpand(table)}
                        onInsert={onInsert}
                    />
                ))}
            </div>

            {/* Footer stats */}
            {totalColumns > 0 && (
                <div className="p-2 border-t border-monokai-border/40 bg-monokai-surface/40 flex items-center justify-between text-[9px] text-monokai-comment/60 font-mono">
                    <span>
                        {filteredTables.length} tables · {totalColumns} columns
                    </span>
                    <span className="opacity-50">Click to expand</span>
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
    // Filter columns if search query matches column name
    const matchingColumns = useMemo(() => {
        if (!columns) return [];
        if (!searchQuery.trim()) return columns;
        const q = searchQuery.toLowerCase();
        return columns.filter(c => c.name.toLowerCase().includes(q));
    }, [columns, searchQuery]);

    // Show columns if either the table is expanded or if we are searching and there are matching columns
    const shouldShowColumns = isExpanded && columns && columns.length > 0;

    return (
        <div className="border-b border-monokai-border/20 last:border-b-0">
            {/* Table Header */}
            <div
                className={`group flex items-center gap-1.5 px-2.5 py-1.5 cursor-pointer transition-all duration-150 ${isExpanded ? 'bg-monokai-amethyst/5' : 'hover:bg-monokai-surface/30'}`}
                onClick={onToggle}
            >
                <span className="w-4 flex items-center justify-center shrink-0">
                    {isLoading ? (
                        <div className="w-2.5 h-2.5 border border-monokai-comment/30 border-t-monokai-amethyst rounded-full animate-spin" />
                    ) : isExpanded ? (
                        <ChevronDown size={10} className="text-monokai-amethyst" />
                    ) : (
                        <ChevronRight size={10} className="text-monokai-comment/50 group-hover:text-monokai-comment transition-colors" />
                    )}
                </span>

                <Database size={11} className={`shrink-0 transition-colors ${isExpanded ? 'text-monokai-amethyst' : 'text-monokai-comment/65 group-hover:text-monokai-amethyst'}`} />

                <span
                    className={`flex-1 text-[11px] font-semibold truncate transition-colors ${isExpanded ? 'text-monokai-amethyst' : 'text-monokai-fg/90 group-hover:text-monokai-amethyst'}`}
                    title={table}
                >
                    {searchQuery ? <HighlightMatch text={table} query={searchQuery} /> : table}
                </span>

                {columns && (
                    <span className="text-[8px] font-mono px-1 bg-monokai-surface border border-monokai-border/40 rounded-xs text-monokai-comment/60 group-hover:text-monokai-comment/90 shrink-0 tabular-nums">
                        {columns.length}
                    </span>
                )}

                <button
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-monokai-comment/60 hover:text-monokai-amethyst bg-monokai-surface border border-monokai-border/50 px-1 py-0.5 rounded-sm transition-all hover:scale-105 active:scale-95"
                    onClick={(e) => { e.stopPropagation(); onInsert(table); }}
                    title={`Insert "${table}"`}
                >
                    <CornerDownRight className="w-2.5 h-2.5" />
                </button>
            </div>

            {/* Columns list */}
            {shouldShowColumns && (
                <div className="bg-monokai-bg/40 border-t border-monokai-border/10 pb-0.5 relative pl-4">
                    {/* Tree connector lines */}
                    <div className="absolute left-[17px] top-0 bottom-3 w-[1px] bg-monokai-border/40" />

                    {matchingColumns.map((col, idx) => {
                        const meta = getColumnMeta(col.type);
                        const isColMatch = searchQuery ? col.name.toLowerCase().includes(searchQuery.toLowerCase()) : false;

                        return (
                            <div
                                key={col.name}
                                className={`group flex items-center gap-1.5 py-1 pr-2.5 cursor-pointer hover:bg-monokai-surface/20 transition-colors relative pl-4 ${isColMatch ? 'bg-monokai-orange/5' : ''}`}
                                onClick={() => onInsert(col.name)}
                                title={`Insert: ${col.name} (${col.type})`}
                            >
                                {/* Horizontal tree line connector */}
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3.5 h-[1px] bg-monokai-border/40" />

                                <span className="w-3 flex items-center justify-center shrink-0 z-10">
                                    {col.pk ? (
                                        <Key size={9} className="text-monokai-yellow filter drop-shadow-[0_0_2px_rgba(230,219,116,0.3)] animate-pulse" />
                                    ) : (
                                        <span className="text-[8px] text-monokai-comment/35 font-mono select-none">{idx + 1}</span>
                                    )}
                                </span>

                                <span className={`flex-1 text-[10px] font-mono truncate pl-1 ${col.pk ? 'text-monokai-yellow font-semibold' : isColMatch ? 'text-monokai-orange font-medium' : 'text-monokai-fg/75 group-hover:text-monokai-orange'}`}>
                                    {searchQuery ? <HighlightMatch text={col.name} query={searchQuery} highlightClass="text-monokai-orange bg-monokai-orange/20 px-0.5 rounded-xs font-bold" /> : col.name}
                                </span>

                                {/* Color-coded semantic type tag */}
                                <span className={`flex items-center justify-center gap-0.5 text-[8px] font-bold font-mono px-1.5 py-0.5 rounded-sm shrink-0 w-11 text-center transition-all ${meta.color} border border-current/10 opacity-70 group-hover:opacity-100 group-hover:scale-102`}>
                                    {meta.icon}
                                    <span>{meta.label}</span>
                                </span>
                            </div>
                        );
                    })}

                    {matchingColumns.length === 0 && columns && (
                        <div className="py-2 pl-4 text-[9px] text-monokai-comment/40 italic font-mono">
                            No matching columns
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const HighlightMatch: React.FC<{ text: string; query: string; highlightClass?: string }> = ({ text, query, highlightClass = 'text-monokai-amethyst bg-monokai-amethyst/20 px-0.5 rounded-xs' }) => {
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
