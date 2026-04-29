import React from 'react';
import {
    TableIcon, LayoutDashboard, Trash2, Columns, FileText, Code, Database,
    Check, X, RefreshCw, ChevronLeft, ChevronRight, ArrowUp, ArrowDown,
    Maximize, Filter, ListPlus
} from 'lucide-react';
import { ColumnInfo } from '../types';
import { getTypeIcon } from '../utils';

export interface DataTabProps {
    currentTable: string | null;
    tableData: any[];
    tableColumns: string[];
    schema: ColumnInfo[];
    hiddenColumns: Set<string>;
    loadingData: boolean;
    pagination: { limit: number; offset: number; total: number };
    sortConfig: { key: string; direction: 'ASC' | 'DESC' } | null;
    filterQuery: string;
    selectedRows: Set<any>;
    dataViewMode: 'grid' | 'profile';
    profileData: any[];
    editingCell: { rowIdx: number; col: string; val: any } | null;
    showColMenu: boolean;
    pkColumn: ColumnInfo | undefined;
    expandedRowIdx: number | null;

    onToggleColumnVisibility: (col: string) => void;
    onSetShowColMenu: (v: boolean) => void;
    onSetHiddenColumns: (v: Set<string>) => void;
    onSetDataViewMode: (v: 'grid' | 'profile') => void;
    onFetchProfileData: (tableName: string) => void;
    onFetchTableData: (tableName: string, offset: number, limit: number, sort?: any, filter?: string) => void;
    onSetFilterQuery: (v: string) => void;
    onSetEditingCell: (v: { rowIdx: number; col: string; val: any } | null) => void;
    onSaveCellEdit: () => void;
    onHandleSelectRow: (pkVal: any, selected: boolean) => void;
    onHandleSelectAll: (selected: boolean) => void;
    onHandleBulkDelete: () => void;
    onHandlePageChange: (newOffset: number) => void;
    onHandleSort: (key: string) => void;
    onHandleApplyFilter: () => void;
    onDownloadData: (format: 'csv' | 'json' | 'parquet') => void;
    onHandleInsertRow: () => void;
    onSetExpandedRowIdx: (v: number | null) => void;
    onAddNotification: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const DataTab: React.FC<DataTabProps> = ({
    currentTable, tableData, tableColumns, schema, hiddenColumns, loadingData,
    pagination, sortConfig, filterQuery, selectedRows, dataViewMode, profileData,
    editingCell, showColMenu, pkColumn, expandedRowIdx,
    onToggleColumnVisibility, onSetShowColMenu, onSetHiddenColumns, onSetDataViewMode,
    onFetchProfileData, onFetchTableData, onSetFilterQuery, onSetEditingCell,
    onSaveCellEdit, onHandleSelectRow, onHandleSelectAll, onHandleBulkDelete,
    onHandlePageChange, onHandleSort, onHandleApplyFilter, onDownloadData,
    onHandleInsertRow, onSetExpandedRowIdx, onAddNotification
}) => {
    if (!currentTable) {
        return (
            <div className="h-full flex items-center justify-center text-monokai-comment flex-col bg-monokai-bg">
                <div className="text-center opacity-50">
                    <Maximize size={48} className="mx-auto mb-4 animate-bounce" />
                    <p>Select a table to browse data</p>
                </div>
            </div>
        );
    }

    const visibleColumns = tableColumns.filter(c => !hiddenColumns.has(c));

    const handleCellEdit = (rowIdx: number, col: string, val: any) => {
        const pkCol = schema.find(c => c.pk);
        if (!pkCol) {
            onAddNotification("Cannot edit tables without a Primary Key", 'info');
            return;
        }
        onSetEditingCell({ rowIdx, col, val });
    };

    const handleSort = (key: string) => {
        onHandleSort(key);
    };

    return (
        <div className="h-full flex flex-col">
            <div className="p-2 bg-monokai-bg border-b border-monokai-accent shrink-0 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <h2 className="text-lg font-mono text-monokai-yellow font-bold px-2">{currentTable}</h2>
                        <div className="flex bg-monokai-surface rounded overflow-hidden border border-monokai-accent">
                            <button onClick={() => onSetDataViewMode('grid')} className={`px-3 py-1 flex items-center gap-1.5 text-xs font-bold transition-colors ${dataViewMode === 'grid' ? 'bg-monokai-accent text-monokai-fg' : 'text-monokai-comment hover:text-monokai-fg'}`}><TableIcon size={12} /> Grid</button>
                            <button onClick={() => { onSetDataViewMode('profile'); onFetchProfileData(currentTable); }} className={`px-3 py-1 flex items-center gap-1.5 text-xs font-bold transition-colors ${dataViewMode === 'profile' ? 'bg-monokai-accent text-monokai-orange' : 'text-monokai-comment hover:text-monokai-orange'}`}><LayoutDashboard size={12} /> Profile</button>
                        </div>
                        {selectedRows.size > 0 && dataViewMode === 'grid' && (
                            <button onClick={onHandleBulkDelete} className="text-xs flex items-center gap-1.5 bg-monokai-pink text-monokai-fg px-3 py-1 rounded font-bold animate-pulse hover:opacity-90"><Trash2 size={12} /> Delete {selectedRows.size} Selected</button>
                        )}
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <button onClick={() => onSetShowColMenu(!showColMenu)} className="text-xs bg-monokai-accent hover:bg-monokai-comment px-3 py-1 rounded border border-transparent hover:border-monokai-comment transition-colors flex items-center gap-1.5 text-monokai-fg">
                                <Columns size={12} /> Columns
                            </button>
                            {showColMenu && (
                                <div className="absolute right-0 top-full mt-1 bg-monokai-bg border border-monokai-accent p-2 rounded shadow-xl z-30 max-h-60 overflow-y-auto min-w-[150px]">
                                    {tableColumns.map(col => (
                                        <label key={col} className="flex items-center gap-2 p-1 hover:bg-monokai-accent/50 cursor-pointer text-xs">
                                            <input
                                                type="checkbox"
                                                checked={!hiddenColumns.has(col)}
                                                onChange={() => onToggleColumnVisibility(col)}
                                            />
                                            <span className={hiddenColumns.has(col) ? 'opacity-50 text-monokai-comment' : 'text-monokai-fg'}>{col}</span>
                                        </label>
                                    ))}
                                    <div className="border-t border-monokai-accent mt-2 pt-2 flex justify-center">
                                        <button onClick={() => onSetHiddenColumns(new Set())} className="text-[10px] text-monokai-blue hover:underline">Reset All</button>
                                    </div>
                                </div>
                            )}
                            {showColMenu && <div className="fixed inset-0 z-20" onClick={() => onSetShowColMenu(false)} />}
                        </div>
                        <div className="flex gap-1 mr-4">
                            <button onClick={() => onDownloadData('csv')} className="text-xs flex items-center gap-1 bg-monokai-accent hover:bg-monokai-blue hover:text-monokai-bg px-2 py-1 rounded transition-colors text-monokai-fg" title="Export as CSV"><FileText size={10} /> CSV</button>
                            <button onClick={() => onDownloadData('json')} className="text-xs flex items-center gap-1 bg-monokai-accent hover:bg-monokai-yellow hover:text-monokai-bg px-2 py-1 rounded transition-colors text-monokai-fg" title="Export as JSON"><Code size={10} /> JSON</button>
                            <button onClick={() => onDownloadData('parquet')} className="text-xs flex items-center gap-1 bg-monokai-accent hover:bg-monokai-orange hover:text-monokai-bg px-2 py-1 rounded text-monokai-orange transition-colors" title="Export as Parquet"><Database size={10} /> Parquet</button>
                        </div>
                        {pkColumn && <button onClick={onHandleInsertRow} className="text-xs flex items-center gap-1 bg-monokai-green text-monokai-bg px-3 py-1 rounded font-bold hover:opacity-90"><ListPlus size={12} /> Insert Row</button>}
                    </div>
                </div>
                {dataViewMode === 'grid' && (
                    <div className="flex gap-2 items-center">
                        <span className="text-xs font-bold text-monokai-blue flex items-center gap-1"><Filter size={12} /> WHERE</span>
                        <input
                            className="flex-1 bg-monokai-surface border border-monokai-accent text-xs p-1.5 rounded text-monokai-fg font-mono outline-none focus:border-monokai-blue"
                            placeholder="id > 5 AND status = 'active'..."
                            value={filterQuery}
                            onChange={(e) => onSetFilterQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && onHandleApplyFilter()}
                        />
                        <button onClick={onHandleApplyFilter} className="px-3 py-1 flex items-center gap-1 bg-monokai-accent hover:bg-monokai-comment text-xs rounded transition-colors text-monokai-fg"><Check size={12} /> Apply Filter</button>
                        {filterQuery && <button onClick={() => { onSetFilterQuery(''); onFetchTableData(currentTable, 0, pagination.limit, sortConfig, ''); }} className="text-monokai-comment hover:text-monokai-pink transition-colors"><X size={14} /></button>}
                    </div>
                )}
            </div>
            <div className="flex-1 overflow-auto bg-monokai-bg">
                {loadingData ? (
                    <div className="h-full flex items-center justify-center text-monokai-comment flex-col gap-2">
                        <RefreshCw size={32} className="text-monokai-blue animate-spin mb-4" />
                        <div className="animate-pulse">Loading data...</div>
                    </div>
                ) : dataViewMode === 'profile' ? (
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {profileData.map((col: any) => {
                            const nullPct = parseFloat(col.null_percentage) || 0;
                            const validPct = 100 - nullPct;
                            return (
                                <div key={col.column_name} className="bg-monokai-bg border border-monokai-accent rounded-lg p-5 shadow-lg hover:border-monokai-blue transition-all group flex flex-col hover:shadow-[0_0_15px_rgba(102,217,239,0.1)]">
                                    <div className="flex justify-between items-start mb-3">
                                        <h3 className="text-lg font-mono font-bold text-monokai-fg truncate max-w-[70%]" title={col.column_name}>{col.column_name}</h3>
                                        <span className="text-[10px] font-mono bg-monokai-surface border border-monokai-accent/50 px-2 py-0.5 rounded text-monokai-orange uppercase tracking-wider flex items-center gap-1">
                                            {getTypeIcon(col.column_type)} {col.column_type}
                                        </span>
                                    </div>
                                    <div className="space-y-3 mb-4 flex-1">
                                        <div>
                                            <div className="flex justify-between text-[10px] text-monokai-comment mb-1">
                                                <span>Valid</span>
                                                <span>Nulls</span>
                                            </div>
                                            <div className="w-full h-2 bg-monokai-bg rounded-full overflow-hidden flex">
                                                <div className="bg-monokai-green h-full" style={{ width: `${validPct}%` }} title={`Valid: ${validPct.toFixed(1)}%`}></div>
                                                <div className="bg-monokai-orange h-full" style={{ width: `${nullPct}%` }} title={`Nulls: ${nullPct.toFixed(1)}%`}></div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 text-xs">
                                            <div>
                                                <div className="text-monokai-comment text-[10px] uppercase">Unique</div>
                                                <div className="font-mono text-monokai-purple">{col.approx_unique}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-monokai-comment text-[10px] uppercase">Nulls</div>
                                                <div className="font-mono text-monokai-orange">{nullPct.toFixed(1)}%</div>
                                            </div>
                                        </div>
                                        {col.min !== null && (
                                            <div className="bg-monokai-bg p-2 rounded text-[10px] font-mono border border-monokai-accent/50">
                                                <div className="flex justify-between mb-1">
                                                    <span className="text-monokai-comment">Min</span>
                                                    <span className="text-monokai-fg truncate max-w-[100px]" title={String(col.min)}>{String(col.min)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-monokai-comment">Max</span>
                                                    <span className="text-monokai-fg truncate max-w-[100px]" title={String(col.max)}>{String(col.max)}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {profileData.length === 0 && <div className="col-span-full text-center text-monokai-comment py-10">No profile data available.</div>}
                    </div>
                ) : (
                    <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
                        <thead className="bg-monokai-surface border-b border-monokai-accent sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-1.5 w-10 border-b border-monokai-comment bg-monokai-surface text-center left-0 sticky z-20">
                                    {pkColumn && <input type="checkbox" className="cursor-pointer" onChange={(e) => onHandleSelectAll(e.target.checked)} checked={tableData.length > 0 && tableData.every(r => selectedRows.has(r[pkColumn.name]))} />}
                                </th>
                                <th className="p-1.5 w-10 border-b border-monokai-comment bg-monokai-surface z-10"></th>
                                {visibleColumns.map((col, idx) => {
                                    const colInfo = schema.find(s => s.name === col);
                                    const isSticky = idx === 0 && pkColumn?.name === col;
                                    return <th key={col} className={`p-2 font-mono text-xs text-monokai-blue font-bold border-b border-monokai-comment border-r border-monokai-comment/30 cursor-pointer hover:bg-monokai-comment/20 select-none ${isSticky ? 'sticky left-20 z-20 bg-monokai-surface shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]' : ''}`} onClick={() => handleSort(col)}>
                                        <div className="flex items-center gap-2"><span>{col}</span>{colInfo && <span className="text-[10px] text-monokai-comment px-1 rounded bg-monokai-bg border border-monokai-accent/50 flex items-center gap-1" title={colInfo.type}>{getTypeIcon(colInfo.type)}</span>}{sortConfig?.key === col && <span className="text-monokai-pink flex items-center">{sortConfig.direction === 'ASC' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}</span>}</div>
                                    </th>;
                                })}
                            </tr>
                        </thead>
                        <tbody className="font-mono">
                            {tableData.map((row, rowIdx) => {
                                const pkVal = pkColumn ? row[pkColumn.name] : null;
                                const isSelected = pkVal !== null && selectedRows.has(pkVal);
                                return <tr key={rowIdx} className={`border-b border-monokai-accent/50 group odd:bg-monokai-bg even:bg-monokai-sidebar/30 hover:bg-monokai-surface/50 ${isSelected ? 'bg-monokai-accent/40' : ''}`}>
                                    <td className="p-1 text-center border-r border-monokai-accent/30 sticky left-0 z-10 bg-inherit">
                                        {pkColumn && <input type="checkbox" checked={isSelected} onChange={(e) => onHandleSelectRow(pkVal, e.target.checked)} className="cursor-pointer" />}
                                    </td>
                                    <td className="p-1 text-center border-r border-monokai-accent/30">
                                        <button onClick={() => onSetExpandedRowIdx(rowIdx)} className="text-xs text-monokai-comment hover:text-monokai-blue opacity-50 hover:opacity-100 transition-opacity"><Maximize size={12} /></button>
                                    </td>
                                    {visibleColumns.map((col, idx) => {
                                        const isEditing = editingCell?.rowIdx === rowIdx && editingCell?.col === col;
                                        const cellValue = row[col];
                                        const colInfo = schema.find(s => s.name === col);
                                        const isNum = colInfo?.type.includes('INT') || colInfo?.type.includes('FLOAT') || colInfo?.type.includes('DOUBLE');
                                        const isNull = cellValue === null;
                                        const isSticky = idx === 0 && pkColumn?.name === col;
                                        const displayVal = (typeof cellValue === 'object' && cellValue !== null) ? (Array.isArray(cellValue) ? '[List]' : '{Struct}') : String(cellValue);
                                        return <td key={`${rowIdx}-${col}`} className={`p-2 border-r border-monokai-accent/30 text-xs text-monokai-fg cursor-text min-w-[80px] max-w-[250px] truncate ${isNull ? 'italic text-monokai-comment/50' : 'opacity-90'} ${isSticky ? 'sticky left-20 z-10 bg-inherit shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]' : ''}`} onDoubleClick={() => handleCellEdit(rowIdx, col, cellValue)} title={String(cellValue)}>
                                            {isEditing ? <input autoFocus type={isNum ? 'number' : 'text'} value={editingCell.val} onChange={(e) => onSetEditingCell({ ...editingCell, val: isNum ? e.target.valueAsNumber : e.target.value })} onBlur={onSaveCellEdit} onKeyDown={(e) => { if (e.key === 'Enter') onSaveCellEdit(); if (e.key === 'Escape') onSetEditingCell(null); }} className="w-full bg-monokai-bg border border-monokai-blue px-1 py-0.5 outline-none text-monokai-fg" /> : (isNull ? 'NULL' : displayVal)}
                                        </td>;
                                    })}
                                </tr>;
                            })}
                        </tbody>
                    </table>
                )}
            </div>
            {dataViewMode === 'grid' && (
                <div className="p-2 border-t border-monokai-accent bg-monokai-sidebar flex justify-between items-center text-xs text-monokai-comment">
                    <span>{pagination.total} records found</span>
                    <div className="flex items-center gap-2">
                        <button onClick={() => onHandlePageChange(pagination.offset - pagination.limit)} disabled={pagination.offset === 0} className="px-2 py-1 flex items-center gap-1 bg-monokai-accent rounded disabled:opacity-30 hover:bg-monokai-comment transition-colors text-monokai-fg"><ChevronLeft size={14} /> Prev</button>
                        <span className="font-mono min-w-[80px] text-center text-monokai-fg">{pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total)}</span>
                        <button onClick={() => onHandlePageChange(pagination.offset + pagination.limit)} disabled={pagination.offset + pagination.limit >= pagination.total} className="px-2 py-1 flex items-center gap-1 bg-monokai-accent rounded disabled:opacity-30 hover:bg-monokai-comment transition-colors text-monokai-fg">Next <ChevronRight size={14} /></button>
                    </div>
                </div>
            )}
        </div>
    );
};
