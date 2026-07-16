import React from 'react';
import { ColumnInfo, ColumnStats } from '../types';
import { getTypeIcon } from '../utils';
import { Layout, Ruler, MousePointerClick, Key } from 'lucide-react';

export interface StructureTabProps {
    tables: string[];
    currentTable: string | null;
    schema: ColumnInfo[];
    fullSchemaTree: Record<string, ColumnInfo[]>;
    structureViewMode: 'list' | 'graph';
    editColumnMode: { colName: string; newName: string; newType: string } | null;
    newColName: string;
    newColType: string;
    selectedColStats: { col: string; stats: ColumnStats } | null;
    isRenaming: boolean;
    renameTableName: string;

    onSetStructureViewMode: (v: 'list' | 'graph') => void;
    onSetEditColumnMode: (v: { colName: string; newName: string; newType: string } | null) => void;
    onSetNewColName: (v: string) => void;
    onSetNewColType: (v: string) => void;
    onSetSelectedColStats: (v: { col: string; stats: ColumnStats } | null) => void;
    onSetIsRenaming: (v: boolean) => void;
    onSetRenameTableName: (v: string) => void;
    onHandleRenameTable: () => void;
    onHandleAddColumn: () => void;
    onHandleDropColumn: (colName: string) => void;
    onHandleSaveColumnEdit: () => void;
    onShowColumnStats: (col: string) => void;
    onHandleCopySchema: () => void;
    onHandleDuplicateTable: () => void;
    onHandleDropTable: () => void;
    onAddNotification: (message: string, type: 'success' | 'error' | 'info') => void;
}

const SchemaGraph: React.FC<{ fullSchemaTree: Record<string, ColumnInfo[]> }> = ({ fullSchemaTree }) => {
    const NODE_WIDTH = 220;
    const NODE_HEIGHT_BASE = 40;
    const MARGIN_X = 50;
    const MARGIN_Y = 50;
    const cols = 3;

    const tableNames = Object.keys(fullSchemaTree);
    if (tableNames.length === 0) return <div className="text-monokai-comment p-8">No tables to visualize.</div>;

    const nodes: { name: string; x: number; y: number; columns: ColumnInfo[] }[] = [];
    const edges: { source: typeof nodes[0]; target: typeof nodes[0]; col: string }[] = [];

    tableNames.forEach((t, i) => {
        const colIdx = i % cols;
        const rowIdx = Math.floor(i / cols);
        const x = MARGIN_X + colIdx * (NODE_WIDTH + 100);
        const y = MARGIN_Y + rowIdx * 300;
        nodes.push({ name: t, x, y, columns: fullSchemaTree[t] });
    });

    nodes.forEach(source => {
        source.columns.forEach((col) => {
            if (col.name.endsWith('_id')) {
                const targetNode = nodes.find(n => n.name === col.name.replace(/_id$/, ''));
                if (targetNode) {
                    edges.push({ source, target: targetNode, col: col.name });
                }
            }
        });
    });

    return (
        <div className="overflow-auto h-full bg-[#1e1f1c] relative p-10 rounded border border-monokai-accent/30 shadow-inner">
            <svg width="100%" height="1500" className="absolute top-0 left-0 pointer-events-none">
                <defs style={{ display: 'none' }}>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="#66d9ef" />
                    </marker>
                </defs>
                {edges.map((e, i) => {
                    const sx = e.source.x + NODE_WIDTH;
                    const sy = e.source.y + NODE_HEIGHT_BASE;
                    const tx = e.target.x;
                    const ty = e.target.y + NODE_HEIGHT_BASE;
                    const d = `M ${sx} ${sy} C ${sx + 50} ${sy}, ${tx - 50} ${ty}, ${tx} ${ty}`;
                    return (
                        <g key={i}>
                            <path d={d} stroke="#66d9ef" strokeWidth="2" fill="none" markerEnd="url(#arrowhead)" opacity="0.6" />
                            <text x={(sx + tx) / 2} y={(sy + ty) / 2} fill="#66d9ef" fontSize="10" textAnchor="middle" dy="-5">{e.col}</text>
                        </g>
                    );
                })}
            </svg>
            {nodes.map(node => (
                <div
                    key={node.name}
                    className="absolute bg-monokai-bg border border-monokai-accent rounded shadow-xl hover:border-monokai-blue transition-colors flex flex-col w-[220px]"
                    style={{ left: node.x, top: node.y }}
                >
                    <div className="bg-monokai-accent/50 p-2 font-bold text-monokai-yellow text-center border-b border-monokai-accent flex justify-between items-center">
                        <span>{node.name}</span>
                        <span className="text-[9px] text-monokai-comment">Table</span>
                    </div>
                    <div className="p-2 space-y-1">
                        {node.columns.map(c => (
                            <div key={c.name} className="flex justify-between text-xs font-mono">
                                <span className={c.pk ? 'text-monokai-pink font-bold flex items-center gap-1' : 'text-monokai-fg'}>
                                    {c.pk && <Key className="w-3 h-3" />}{c.name}
                                </span>
                                <span className="text-monokai-comment text-[10px]">{c.type}</span>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export const StructureTab: React.FC<StructureTabProps> = ({
    tables, currentTable, schema, fullSchemaTree, structureViewMode,
    editColumnMode, newColName, newColType, selectedColStats,
    isRenaming, renameTableName,
    onSetStructureViewMode, onSetEditColumnMode, onSetNewColName, onSetNewColType,
    onSetSelectedColStats, onSetIsRenaming, onSetRenameTableName,
    onHandleRenameTable, onHandleAddColumn, onHandleDropColumn,
    onHandleSaveColumnEdit, onShowColumnStats, onHandleCopySchema,
    onHandleDuplicateTable, onHandleDropTable, onAddNotification
}) => {
    if (tables.length === 0) {
        return (
            <div className="h-full flex items-center justify-center text-monokai-comment flex-col">
                <Layout className="w-10 h-10 text-monokai-comment/40 mb-4" />
                <div>No tables found. Import or create a table to view schema.</div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-monokai-bg relative">
            <div className="p-4 border-b border-monokai-accent flex justify-between items-center shrink-0 z-10 bg-monokai-bg/80 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-monokai-fg flex gap-2 items-center">
                        <Ruler className="w-5 h-5 text-monokai-amethyst" /> Schema Architecture
                    </h2>
                    <div className="flex bg-monokai-sidebar rounded p-0.5 border border-monokai-accent">
                        <button onClick={() => onSetStructureViewMode('list')} className={`px-3 py-1 text-xs font-bold rounded transition-colors ${structureViewMode === 'list' ? 'bg-monokai-accent text-white' : 'text-monokai-comment hover:text-white'}`}>List View</button>
                        <button onClick={() => onSetStructureViewMode('graph')} className={`px-3 py-1 text-xs font-bold rounded transition-colors ${structureViewMode === 'graph' ? 'bg-monokai-accent text-monokai-blue' : 'text-monokai-comment hover:text-monokai-blue'}`}>ER Diagram</button>
                    </div>
                </div>
                {currentTable && structureViewMode === 'list' && (
                    <div className="flex gap-2">
                        <button onClick={() => onAddNotification('Duplicate: ' + currentTable, 'info')} className="text-xs bg-monokai-blue/10 text-monokai-blue hover:bg-monokai-blue hover:text-monokai-bg px-3 py-1.5 rounded font-bold transition-colors border border-monokai-blue">Duplicate Table</button>
                        <button onClick={onHandleDropTable} className="text-xs bg-monokai-pink/10 text-monokai-pink hover:bg-monokai-pink hover:text-white px-3 py-1.5 rounded font-bold transition-colors border border-monokai-pink">Drop Table</button>
                    </div>
                )}
            </div>
            <div className="flex-1 overflow-hidden relative">
                {structureViewMode === 'graph' ? (
                    <SchemaGraph fullSchemaTree={fullSchemaTree} />
                ) : currentTable ? (
                    <div className="h-full p-6 overflow-auto">
                        <div className="flex items-center gap-2 mb-6">
                            {isRenaming ? (
                                <input
                                    autoFocus
                                    className="bg-monokai-bg border border-monokai-blue text-monokai-fg text-2xl font-bold px-2 py-1 rounded outline-none"
                                    value={renameTableName}
                                    onChange={e => onSetRenameTableName(e.target.value)}
                                    onBlur={() => onSetIsRenaming(false)}
                                    onKeyDown={e => { if (e.key === 'Enter') onHandleRenameTable(); if (e.key === 'Escape') onSetIsRenaming(false); }}
                                />
                            ) : (
                                <span
                                    className="text-2xl font-bold text-monokai-fg cursor-pointer hover:underline decoration-dashed decoration-monokai-comment"
                                    onClick={() => { onSetRenameTableName(currentTable); onSetIsRenaming(true); }}
                                    title="Click to Rename"
                                >
                                    {currentTable}
                                </span>
                            )}
                        </div>
                        <div className="flex gap-6 items-start flex-col xl:flex-row">
                            <div className="bg-monokai-sidebar border border-monokai-accent rounded flex-1 w-full flex flex-col shadow-lg">
                                <table className="w-full text-left">
                                    <thead className="bg-monokai-surface border-b border-monokai-accent/50 text-xs uppercase tracking-wider">
                                        <tr>
                                            <th className="p-3 text-monokai-blue font-mono">Column</th>
                                            <th className="p-3 text-monokai-orange font-mono">Type</th>
                                            <th className="p-3 text-monokai-pink font-mono">Constraints</th>
                                            <th className="p-3 text-monokai-green font-mono text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm bg-monokai-bg">
                                        {schema.map(col => {
                                            const isEditing = editColumnMode?.colName === col.name;
                                            return (
                                                <tr key={col.name} className="border-b border-monokai-accent/50 hover:bg-monokai-accent/20 transition-colors">
                                                    <td className="p-3 font-mono font-bold text-monokai-fg">
                                                        {isEditing
                                                            ? <input value={editColumnMode.newName} onChange={e => onSetEditColumnMode({ ...editColumnMode, newName: e.target.value })} className="bg-monokai-bg border border-monokai-blue px-2 py-1 rounded w-full outline-none text-white" />
                                                            : col.name
                                                        }
                                                    </td>
                                                    <td className="p-3 font-mono text-monokai-comment">
                                                        {isEditing ? (
                                                            <select value={editColumnMode.newType} onChange={e => onSetEditColumnMode({ ...editColumnMode, newType: e.target.value })} className="bg-monokai-bg border border-monokai-blue px-2 py-1 rounded w-full outline-none text-white">
                                                                {['VARCHAR', 'INTEGER', 'BOOLEAN', 'FLOAT', 'DOUBLE', 'DATE', 'TIMESTAMP', 'JSON', 'BLOB'].map(t => <option key={t} value={t}>{t}</option>)}
                                                            </select>
                                                        ) : (
                                                            <span className="flex items-center gap-2 px-2 py-1 bg-monokai-bg rounded w-fit border border-monokai-accent/30">
                                                                {getTypeIcon(col.type)} {col.type}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 font-mono text-xs">
                                                        {col.pk ? <span className="bg-monokai-pink/20 text-monokai-pink border border-monokai-pink px-2 py-0.5 rounded mr-2 font-bold">PK</span> : null}
                                                        {col.notnull ? <span className="bg-monokai-yellow/20 text-monokai-yellow border border-monokai-yellow px-2 py-0.5 rounded font-bold">NOT NULL</span> : null}
                                                    </td>
                                                    <td className="p-3 text-right flex justify-end gap-2">
                                                        {isEditing ? (
                                                            <>
                                                                <button onClick={onHandleSaveColumnEdit} className="text-xs bg-monokai-green text-monokai-bg px-2 py-1 rounded font-bold">Save</button>
                                                                <button onClick={() => onSetEditColumnMode(null)} className="text-xs bg-monokai-accent text-white px-2 py-1 rounded">Cancel</button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <button onClick={() => onSetEditColumnMode({ colName: col.name, newName: col.name, newType: col.type })} className="text-xs bg-monokai-accent hover:bg-monokai-comment px-2 py-1 rounded text-monokai-fg transition-colors">Edit</button>
                                                                <button onClick={() => onShowColumnStats(col.name)} className="text-xs bg-monokai-accent hover:bg-monokai-comment px-2 py-1 rounded text-monokai-blue transition-colors">Stats</button>
                                                                <button onClick={() => onHandleDropColumn(col.name)} className="text-xs bg-monokai-accent hover:bg-monokai-pink hover:text-white px-2 py-1 rounded text-monokai-pink transition-colors" title="Drop Column">✕</button>
                                                            </>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                {selectedColStats && (
                                    <div className="p-4 bg-monokai-bg border-t border-monokai-accent animate-[slideIn_0.2s_ease-out]">
                                        <div className="flex justify-between items-center mb-2">
                                            <h4 className="font-bold text-monokai-yellow">Stats: {selectedColStats.col}</h4>
                                            <button onClick={() => onSetSelectedColStats(null)} className="text-monokai-comment hover:text-white">✕</button>
                                        </div>
                                        <div className="grid grid-cols-5 gap-4 text-center mb-4">
                                            <div className="bg-monokai-sidebar p-2 rounded border border-monokai-accent">
                                                <div className="text-xs text-monokai-comment">Total</div>
                                                <div className="font-mono text-lg">{selectedColStats.stats.total_count}</div>
                                            </div>
                                            <div className="bg-monokai-sidebar p-2 rounded border border-monokai-accent">
                                                <div className="text-xs text-monokai-comment">Nulls</div>
                                                <div className="font-mono text-lg text-monokai-orange">{selectedColStats.stats.null_count}</div>
                                            </div>
                                            <div className="bg-monokai-sidebar p-2 rounded border border-monokai-accent">
                                                <div className="text-xs text-monokai-comment">Unique (Est)</div>
                                                <div className="font-mono text-lg text-monokai-blue">{selectedColStats.stats.distinct_count}</div>
                                            </div>
                                            <div className="bg-monokai-sidebar p-2 rounded border border-monokai-accent">
                                                <div className="text-xs text-monokai-comment">Min</div>
                                                <div className="font-mono text-sm truncate py-1" title={String(selectedColStats.stats.min)}>{String(selectedColStats.stats.min)}</div>
                                            </div>
                                            <div className="bg-monokai-sidebar p-2 rounded border border-monokai-accent">
                                                <div className="text-xs text-monokai-comment">Max</div>
                                                <div className="font-mono text-sm truncate py-1" title={String(selectedColStats.stats.max)}>{String(selectedColStats.stats.max)}</div>
                                            </div>
                                        </div>
                                        {selectedColStats.stats.top_k && selectedColStats.stats.top_k.length > 0 && (
                                            <div className="bg-monokai-sidebar p-3 rounded border border-monokai-accent">
                                                <h5 className="text-xs uppercase font-bold text-monokai-comment mb-2">Top 5 Values</h5>
                                                <div className="space-y-1">
                                                    {selectedColStats.stats.top_k.map((k, idx) => (
                                                        <div key={idx} className="flex items-center gap-2 text-xs">
                                                            <div className="w-24 truncate text-right font-mono" title={String(k.value)}>{String(k.value)}</div>
                                                            <div className="flex-1 h-2 bg-monokai-bg rounded-full overflow-hidden">
                                                                <div className="h-full bg-monokai-green" style={{ width: `${(k.count / selectedColStats.stats.total_count) * 100}%` }}></div>
                                                            </div>
                                                            <div className="w-10 text-right text-monokai-comment">{k.count}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="bg-monokai-bg p-5 border border-monokai-accent rounded w-full max-w-[320px] xl:w-80 shrink-0 shadow-lg">
                                <h3 className="text-monokai-green font-bold mb-4 uppercase text-sm">Add New Column</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs text-monokai-comment mb-1">Column Name</label>
                                        <input
                                            value={newColName}
                                            onChange={e => onSetNewColName(e.target.value)}
                                            className="w-full bg-monokai-surface border border-monokai-accent p-2 rounded text-sm text-monokai-fg focus:border-monokai-green outline-none"
                                            placeholder="e.g., status"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-monokai-comment mb-1">Type</label>
                                        <select
                                            value={newColType}
                                            onChange={e => onSetNewColType(e.target.value)}
                                            className="w-full bg-monokai-surface border border-monokai-accent p-2 rounded text-sm text-monokai-fg focus:border-monokai-green outline-none"
                                        >
                                            {['VARCHAR', 'INTEGER', 'BOOLEAN', 'FLOAT', 'DOUBLE', 'DATE', 'TIMESTAMP', 'JSON'].map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <button
                                        onClick={onHandleAddColumn}
                                        className="w-full bg-monokai-amethyst hover:bg-monokai-pink text-white font-bold text-sm py-2 px-4 rounded-lg shadow transition-colors"
                                    >
                                        Add Column
                                    </button>
                                </div>
                                <div className="mt-8 pt-6 border-t border-monokai-accent">
                                    <h3 className="text-monokai-comment font-bold uppercase text-sm mb-2">DDL Preview</h3>
                                    <div className="relative group">
                                        <pre className="font-mono text-[10px] text-monokai-green overflow-x-auto p-2 bg-monokai-bg rounded border border-monokai-accent/50 max-h-40">{`CREATE TABLE ${currentTable} (\n  ${schema.map(c => `${c.name} ${c.type}${c.pk ? ' PRIMARY KEY' : ''}`).join(',\n  ')}\n);`}</pre>
                                        <button onClick={onHandleCopySchema} className="absolute top-1 right-1 text-[10px] bg-monokai-accent hover:bg-white hover:text-monokai-bg text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">Copy</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center text-monokai-comment flex-col">
                        <MousePointerClick className="w-10 h-10 text-monokai-comment/50 mb-4" />
                        <p>Select a table from the sidebar to view structure.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
