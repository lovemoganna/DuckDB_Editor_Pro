import React, { useState, useMemo } from 'react';
import { 
    ScrollText, 
    Search, 
    ChevronDown, 
    ChevronRight, 
    Copy, 
    Check, 
    Table as TableIcon, 
    Calendar, 
    X,
    Database,
    Zap
} from 'lucide-react';

export interface AuditLog {
    id: number;
    log_time: string;
    operation_type: string;
    target_table: string | null;
    details: string;
    affected_rows: number;
}

export interface AuditTabProps {
    auditLogs: AuditLog[];
}

export const AuditTab: React.FC<AuditTabProps> = ({ auditLogs }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedType, setSelectedType] = useState('ALL');
    const [selectedTable, setSelectedTable] = useState('ALL');
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
    const [copiedId, setCopiedId] = useState<number | null>(null);

    // Extract unique operation types and tables for filter dropdowns
    const { operationTypes, tables } = useMemo(() => {
        const typesSet = new Set<string>();
        const tablesSet = new Set<string>();
        auditLogs.forEach(log => {
            if (log.operation_type) typesSet.add(log.operation_type);
            if (log.target_table) tablesSet.add(log.target_table);
        });
        return {
            operationTypes: Array.from(typesSet).sort(),
            tables: Array.from(tablesSet).sort()
        };
    }, [auditLogs]);

    const toggleRow = (id: number) => {
        const next = new Set(expandedRows);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setExpandedRows(next);
    };

    const handleCopy = (id: number, text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const resetFilters = () => {
        setSearchTerm('');
        setSelectedType('ALL');
        setSelectedTable('ALL');
    };

    // Filter logs
    const filteredLogs = useMemo(() => {
        return auditLogs.filter(log => {
            const matchesSearch = log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (log.target_table && log.target_table.toLowerCase().includes(searchTerm.toLowerCase())) ||
                log.operation_type.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesType = selectedType === 'ALL' || log.operation_type === selectedType;
            const matchesTable = selectedTable === 'ALL' || log.target_table === selectedTable;
            return matchesSearch && matchesType && matchesTable;
        });
    }, [auditLogs, searchTerm, selectedType, selectedTable]);

    const getOperationBadgeStyle = (type: string) => {
        const cleanType = type.toUpperCase();
        if (cleanType.includes('INSERT')) {
            return 'bg-monokai-green/10 text-monokai-green border-monokai-green/30';
        } else if (cleanType.includes('UPDATE')) {
            return 'bg-monokai-yellow/10 text-monokai-yellow border-monokai-yellow/30';
        } else if (cleanType.includes('DELETE')) {
            return 'bg-monokai-pink/10 text-monokai-pink border-monokai-pink/30';
        } else if (cleanType.includes('CREATE') || cleanType.includes('ALTER')) {
            return 'bg-monokai-blue/10 text-monokai-blue border-monokai-blue/30';
        } else if (cleanType.includes('DROP')) {
            return 'bg-monokai-purple/10 text-monokai-purple border-monokai-purple/30';
        }
        return 'bg-monokai-comment/10 text-monokai-fg border-monokai-border';
    };

    return (
        <div className="h-full flex flex-col bg-monokai-bg font-sans">
            {/* Header */}
            <div className="p-4 border-b border-monokai-accent/30 shrink-0 flex justify-between items-center bg-monokai-surface/40">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded bg-monokai-orange/10 border border-monokai-orange/20 text-monokai-orange">
                        <ScrollText className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-monokai-orange">System Audit Log</h2>
                        <p className="text-xs text-monokai-comment">Persistent tracking of all schema alterations and data modifications.</p>
                    </div>
                </div>
                <div className="text-right">
                    <span className="text-xs font-mono text-monokai-comment bg-monokai-surface px-2 py-1 rounded border border-monokai-border">
                        Total Records: <span className="text-monokai-orange font-bold">{auditLogs.length}</span>
                    </span>
                </div>
            </div>

            {/* Toolbar */}
            <div className="p-3 border-b border-monokai-accent/30 shrink-0 bg-monokai-surface/20 flex flex-wrap gap-2 items-center justify-between">
                <div className="flex flex-1 flex-wrap gap-2 items-center min-w-[300px]">
                    {/* Search */}
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-monokai-comment" />
                        <input
                            type="text"
                            placeholder="Search in log details..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-8 py-1.5 text-xs rounded bg-monokai-surface border border-monokai-border text-monokai-fg focus:outline-none focus:border-monokai-blue transition-colors font-mono"
                        />
                        {searchTerm && (
                            <button 
                                onClick={() => setSearchTerm('')} 
                                className="absolute right-2 top-2.5 text-monokai-comment hover:text-monokai-fg"
                            >
                                <X className="h-4.5 w-4.5" />
                            </button>
                        )}
                    </div>

                    {/* Filter: Operation Type */}
                    <div className="relative">
                        <select
                            value={selectedType}
                            onChange={(e) => setSelectedType(e.target.value)}
                            className="appearance-none bg-monokai-surface border border-monokai-border rounded px-3 py-1.5 pr-8 text-xs font-mono text-monokai-fg focus:outline-none focus:border-monokai-blue transition-colors"
                        >
                            <option value="ALL">All Operations</option>
                            {operationTypes.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-2.5 h-3.5 w-3.5 text-monokai-comment pointer-events-none" />
                    </div>

                    {/* Filter: Target Table */}
                    <div className="relative">
                        <select
                            value={selectedTable}
                            onChange={(e) => setSelectedTable(e.target.value)}
                            className="appearance-none bg-monokai-surface border border-monokai-border rounded px-3 py-1.5 pr-8 text-xs font-mono text-monokai-fg focus:outline-none focus:border-monokai-blue transition-colors"
                        >
                            <option value="ALL">All Tables</option>
                            {tables.map(table => (
                                <option key={table} value={table}>{table}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-2.5 h-3.5 w-3.5 text-monokai-comment pointer-events-none" />
                    </div>

                    {(searchTerm || selectedType !== 'ALL' || selectedTable !== 'ALL') && (
                        <button
                            onClick={resetFilters}
                            className="px-2.5 py-1.5 rounded text-xs border border-monokai-pink/40 text-monokai-pink hover:bg-monokai-pink/10 transition-colors flex items-center gap-1"
                        >
                            <X className="h-3 w-3" /> Clear Filters
                        </button>
                    )}
                </div>

                <div className="text-xs text-monokai-comment font-mono">
                    Showing <span className="text-monokai-blue font-bold">{filteredLogs.length}</span> entries
                </div>
            </div>

            {/* List / Table Area */}
            <div className="flex-1 overflow-auto bg-monokai-surface/10">
                {filteredLogs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-12 text-center">
                        <ScrollText className="w-12 h-12 text-monokai-comment/30 mb-3" />
                        <p className="text-sm font-semibold text-monokai-comment">No audit records match your filters</p>
                        <p className="text-xs text-monokai-comment/50 mt-1">Try modifying your search or filters to see records.</p>
                        {(searchTerm || selectedType !== 'ALL' || selectedTable !== 'ALL') && (
                            <button
                                onClick={resetFilters}
                                className="mt-4 px-3 py-1.5 rounded text-xs bg-monokai-sidebar border border-monokai-border text-monokai-fg hover:bg-monokai-border transition-all"
                            >
                                Reset Filters
                            </button>
                        )}
                    </div>
                ) : (
                    <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-monokai-surface border-b border-monokai-accent/20 sticky top-0 z-10">
                            <tr>
                                <th className="p-3 w-10"></th>
                                <th className="p-3 font-mono text-monokai-blue font-semibold">Time</th>
                                <th className="p-3 font-mono text-monokai-pink font-semibold w-32">Operation</th>
                                <th className="p-3 font-mono text-monokai-yellow font-semibold w-40">Target Table</th>
                                <th className="p-3 font-mono text-monokai-fg font-semibold">Details Summary</th>
                                <th className="p-3 font-mono text-monokai-green font-semibold text-right w-24">Rows</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLogs.map((log) => {
                                const isExpanded = expandedRows.has(log.id);
                                return (
                                    <React.Fragment key={log.id}>
                                        <tr 
                                            onClick={() => toggleRow(log.id)}
                                            className={`border-b border-monokai-accent/10 hover:bg-monokai-sidebar/40 cursor-pointer transition-colors ${isExpanded ? 'bg-monokai-sidebar/20' : ''}`}
                                        >
                                            <td className="p-3 text-center">
                                                {isExpanded ? (
                                                    <ChevronDown className="w-4 h-4 text-monokai-comment" />
                                                ) : (
                                                    <ChevronRight className="w-4 h-4 text-monokai-comment" />
                                                )}
                                            </td>
                                            <td className="p-3 font-mono text-monokai-comment whitespace-nowrap">
                                                {new Date(log.log_time).toLocaleString()}
                                            </td>
                                            <td className="p-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getOperationBadgeStyle(log.operation_type)}`}>
                                                    {log.operation_type}
                                                </span>
                                            </td>
                                            <td className="p-3 font-mono">
                                                {log.target_table ? (
                                                    <span className="flex items-center gap-1.5 text-monokai-yellow bg-monokai-surface/60 px-1.5 py-0.5 rounded border border-monokai-border/40 w-fit">
                                                        <TableIcon className="w-3.5 h-3.5 opacity-70" />
                                                        {log.target_table}
                                                    </span>
                                                ) : (
                                                    <span className="text-monokai-comment/50 italic">-</span>
                                                )}
                                            </td>
                                            <td className="p-3 font-mono text-monokai-fg/90 truncate max-w-lg" title="Click to view full SQL statement">
                                                {log.details}
                                            </td>
                                            <td className="p-3 font-mono text-right">
                                                {log.affected_rows > 0 ? (
                                                    <span className="text-monokai-purple font-semibold bg-monokai-purple/10 px-1.5 py-0.5 rounded">
                                                        {log.affected_rows}
                                                    </span>
                                                ) : (
                                                    <span className="text-monokai-comment/40">0</span>
                                                )}
                                            </td>
                                        </tr>

                                        {isExpanded && (
                                            <tr className="bg-monokai-surface/30 border-b border-monokai-accent/15">
                                                <td colSpan={6} className="p-4 pl-12">
                                                    <div className="flex flex-col gap-3">
                                                        <div className="flex items-center justify-between bg-monokai-surface/60 p-2 px-3 rounded border border-monokai-border/40 text-xs">
                                                            <div className="flex items-center gap-4 text-monokai-comment font-mono">
                                                                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> ID: {log.id}</span>
                                                                <span>•</span>
                                                                <span>Affected Rows: <strong className="text-monokai-purple">{log.affected_rows}</strong></span>
                                                            </div>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleCopy(log.id, log.details); }}
                                                                className="px-2.5 py-1 bg-monokai-sidebar border border-monokai-border text-monokai-fg hover:text-white rounded flex items-center gap-1.5 transition-colors"
                                                            >
                                                                {copiedId === log.id ? (
                                                                    <>
                                                                        <Check className="w-3.5 h-3.5 text-monokai-green" />
                                                                        <span className="text-[10px] text-monokai-green font-bold">Copied!</span>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Copy className="w-3.5 h-3.5" />
                                                                        <span className="text-[10px]">Copy SQL</span>
                                                                    </>
                                                                )}
                                                            </button>
                                                        </div>
                                                        <div className="relative">
                                                            <pre className="font-mono text-xs bg-monokai-surface p-4 rounded border border-monokai-border overflow-x-auto whitespace-pre-wrap break-all max-h-[300px] text-monokai-fg leading-relaxed">
                                                                {log.details}
                                                            </pre>
                                                            <div className="absolute top-2 right-2 text-[9px] font-mono text-monokai-comment bg-monokai-bg px-1.5 py-0.5 rounded pointer-events-none">
                                                                SQL STATEMENT
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};
