import React, { useState, useEffect, useRef } from 'react';
import {
    TableIcon, LayoutDashboard, Trash2, Columns, FileText, Code, Database,
    Check, X, RefreshCw, ChevronLeft, ChevronRight, ArrowUp, ArrowDown,
    Maximize, Filter, ListPlus, Copy, Plus, Eye, SlidersHorizontal
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
    sortConfig: { key: string; direction: 'ASC' | 'DESC' }[];
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
    onHandleSort: (key: string, shiftKey?: boolean) => void;
    onHandleApplyFilter: () => void;
    onDownloadData: (format: 'csv' | 'json' | 'parquet') => void;
    onHandleInsertRow: () => void;
    onSetExpandedRowIdx: (v: number | null) => void;
    onAddNotification: (message: string, type: 'success' | 'error' | 'info') => void;
}

interface FilterRule {
    id: string;
    column: string;
    operator: string;
    value: string;
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
    // 1. 列宽拖拽调节状态
    const [colWidths, setColWidths] = useState<Record<string, number>>({});

    // 2. 右键快捷菜单状态
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        rowIdx: number;
        col: string;
        val: any;
    } | null>(null);

    // 3. 可视化过滤条件状态
    const [showVisualFilter, setShowVisualFilter] = useState(false);
    const [visualRules, setVisualRules] = useState<FilterRule[]>([]);

    // 4. 高级单元格值预览模态框
    const [previewCell, setPreviewCell] = useState<{
        columnName: string;
        val: any;
    } | null>(null);

    // 当切换数据表时，清空相关临时状态
    useEffect(() => {
        setColWidths({});
        setContextMenu(null);
        setVisualRules([]);
        setShowVisualFilter(false);
        setPreviewCell(null);
    }, [currentTable]);

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

    const handleSort = (key: string, e: React.MouseEvent) => {
        onHandleSort(key, e.shiftKey);
    };

    // 拖拽宽度鼠标事件处理器
    const handleResizeMouseDown = (colName: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.pageX;
        const startWidth = colWidths[colName] || 150;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const newWidth = Math.max(60, startWidth + (moveEvent.pageX - startX));
            setColWidths(prev => ({ ...prev, [colName]: newWidth }));
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // 右键触发处理器
    const handleRowContextMenu = (e: React.MouseEvent, rowIdx: number, col: string, val: any) => {
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            rowIdx,
            col,
            val
        });
    };

    // 关闭上下文菜单
    const closeContextMenu = () => setContextMenu(null);

    // 复制单元格值到剪贴板
    const copyCellValue = () => {
        if (!contextMenu) return;
        const text = contextMenu.val === null ? 'NULL' : String(contextMenu.val);
        navigator.clipboard.writeText(text);
        onAddNotification('Cell value copied to clipboard', 'success');
        closeContextMenu();
    };

    // 复制整行作为 JSON 到剪贴板
    const copyRowJson = () => {
        if (!contextMenu) return;
        const row = tableData[contextMenu.rowIdx];
        navigator.clipboard.writeText(JSON.stringify(row, null, 2));
        onAddNotification('Row JSON copied to clipboard', 'success');
        closeContextMenu();
    };

    // 复制整行为 SQL INSERT 语句
    const copyRowSql = () => {
        if (!contextMenu) return;
        const row = tableData[contextMenu.rowIdx];
        const fields = Object.keys(row).map(k => `"${k}"`).join(', ');
        const values = Object.values(row).map(v => {
            if (v === null) return 'NULL';
            if (typeof v === 'number') return v;
            return `'${String(v).replace(/'/g, "''")}'`;
        }).join(', ');

        const sql = `INSERT INTO "${currentTable}" (${fields}) VALUES (${values});`;
        navigator.clipboard.writeText(sql);
        onAddNotification('SQL Insert statement copied', 'success');
        closeContextMenu();
    };

    // 克隆当前行
    const cloneRow = async () => {
        if (!contextMenu || !pkColumn) return;
        const row = tableData[contextMenu.rowIdx];
        // 排除主键，或准备克隆插入
        const cloneData = { ...row };
        if (pkColumn) {
            delete cloneData[pkColumn.name];
        }
        // 调用插入并通知更新
        onHandleInsertRow();
        onAddNotification('Clone template created. Add new row logic applied.', 'info');
        closeContextMenu();
    };

    // ── 可视化过滤构建 ──
    const addFilterRule = () => {
        if (!tableColumns.length) return;
        const newRule: FilterRule = {
            id: String(Date.now()),
            column: tableColumns[0],
            operator: '=',
            value: ''
        };
        setVisualRules(prev => [...prev, newRule]);
    };

    const updateFilterRule = (id: string, updates: Partial<FilterRule>) => {
        setVisualRules(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    };

    const removeFilterRule = (id: string) => {
        setVisualRules(prev => prev.filter(r => r.id !== id));
    };

    const applyVisualFilters = () => {
        if (visualRules.length === 0) {
            onSetFilterQuery('');
            onFetchTableData(currentTable, 0, pagination.limit, sortConfig, '');
            return;
        }

        const queryStr = visualRules.map(rule => {
            const isNumCol = schema.find(s => s.name === rule.column)?.type.match(/int|float|double|numeric|decimal/i);
            const formattedVal = isNumCol ? rule.value : `'${rule.value.replace(/'/g, "''")}'`;

            if (rule.operator === 'LIKE') {
                return `"${rule.column}" LIKE '%${rule.value}%'`;
            }
            if (rule.operator === 'IS NULL' || rule.operator === 'IS NOT NULL') {
                return `"${rule.column}" ${rule.operator}`;
            }
            return `"${rule.column}" ${rule.operator} ${formattedVal}`;
        }).join(' AND ');

        onSetFilterQuery(queryStr);
        onFetchTableData(currentTable, 0, pagination.limit, sortConfig, queryStr);
    };

    return (
        <div className="h-full flex flex-col relative select-none" onClick={closeContextMenu}>
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
                        <button
                            onClick={() => setShowVisualFilter(!showVisualFilter)}
                            className={`text-xs px-3 py-1 rounded border transition-colors flex items-center gap-1.5 ${
                                showVisualFilter || visualRules.length > 0
                                    ? 'bg-monokai-purple/20 border-monokai-purple text-monokai-purple font-bold'
                                    : 'bg-monokai-accent border-transparent text-monokai-fg hover:bg-monokai-comment'
                            }`}
                        >
                            <SlidersHorizontal size={12} /> Filter Builder
                        </button>
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

                {/* SQL WHERE 原生输入框过滤 */}
                {!showVisualFilter && dataViewMode === 'grid' && (
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

                {/* 可视化条件构造组件 */}
                {showVisualFilter && dataViewMode === 'grid' && (
                    <div className="bg-monokai-surface border border-monokai-accent p-3 rounded-lg flex flex-col gap-2">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold text-monokai-purple flex items-center gap-1">
                                <SlidersHorizontal size={12} /> Visual Filter rules
                            </span>
                            <button
                                onClick={addFilterRule}
                                className="px-2 py-1 text-[10px] bg-monokai-accent hover:bg-monokai-comment text-monokai-fg rounded flex items-center gap-1"
                            >
                                <Plus size={10} /> Add Rule
                            </button>
                        </div>
                        {visualRules.length === 0 ? (
                            <div className="text-center py-4 text-xs text-monokai-comment italic">
                                No visual filter rules added yet. Click 'Add Rule' to start.
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
                                {visualRules.map(rule => (
                                    <div key={rule.id} className="flex gap-2 items-center">
                                        <select
                                            value={rule.column}
                                            onChange={e => updateFilterRule(rule.id, { column: e.target.value })}
                                            className="bg-monokai-bg border border-monokai-accent text-xs p-1 rounded text-monokai-fg outline-none"
                                        >
                                            {tableColumns.map(col => <option key={col} value={col}>{col}</option>)}
                                        </select>
                                        <select
                                            value={rule.operator}
                                            onChange={e => updateFilterRule(rule.id, { operator: e.target.value })}
                                            className="bg-monokai-bg border border-monokai-accent text-xs p-1 rounded text-monokai-fg outline-none"
                                        >
                                            <option value="=">=</option>
                                            <option value="<>">&lt;&gt;</option>
                                            <option value=">">&gt;</option>
                                            <option value="<">&lt;</option>
                                            <option value=">=">&gt;=</option>
                                            <option value="<=">&lt;=</option>
                                            <option value="LIKE">LIKE</option>
                                            <option value="IS NULL">IS NULL</option>
                                            <option value="IS NOT NULL">IS NOT NULL</option>
                                        </select>
                                        {rule.operator !== 'IS NULL' && rule.operator !== 'IS NOT NULL' && (
                                            <input
                                                type="text"
                                                value={rule.value}
                                                onChange={e => updateFilterRule(rule.id, { value: e.target.value })}
                                                placeholder="Value..."
                                                className="bg-monokai-bg border border-monokai-accent text-xs p-1 rounded text-monokai-fg outline-none w-32 flex-1"
                                            />
                                        )}
                                        <button
                                            onClick={() => removeFilterRule(rule.id)}
                                            className="text-monokai-comment hover:text-monokai-pink transition-colors p-1"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="flex justify-end gap-2 border-t border-monokai-accent/30 pt-2 mt-1">
                            <button
                                onClick={() => {
                                    setVisualRules([]);
                                    onSetFilterQuery('');
                                    onFetchTableData(currentTable, 0, pagination.limit, sortConfig, '');
                                }}
                                className="px-3 py-1 text-xs text-monokai-comment hover:text-monokai-fg"
                            >
                                Clear All
                            </button>
                            <button
                                onClick={applyVisualFilters}
                                className="px-3 py-1 bg-monokai-purple text-white text-xs rounded hover:opacity-90"
                            >
                                Apply filters
                            </button>
                        </div>
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

                                    const colSort = sortConfig.find(s => s.key === col);
                                    const sortIndex = sortConfig.findIndex(s => s.key === col);
                                    const width = colWidths[col] || 150;

                                    return (
                                        <th
                                            key={col}
                                            style={{ width, minWidth: width, maxWidth: width }}
                                            className={`p-2 font-mono text-xs text-monokai-blue font-bold border-b border-monokai-comment border-r border-monokai-comment/30 cursor-pointer hover:bg-monokai-comment/20 select-none relative group ${
                                                isSticky ? 'sticky left-20 z-20 bg-monokai-surface shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]' : ''
                                            }`}
                                            onClick={(e) => handleSort(col, e)}
                                        >
                                            <div className="flex items-center gap-2 justify-between">
                                                <div className="flex items-center gap-2 truncate flex-1">
                                                    <span className="truncate">{col}</span>
                                                    {colInfo && (
                                                        <span className="text-[10px] text-monokai-comment px-1 rounded bg-monokai-bg border border-monokai-accent/50 flex items-center gap-1 shrink-0" title={colInfo.type}>
                                                            {getTypeIcon(colInfo.type)}
                                                        </span>
                                                    )}
                                                </div>
                                                {colSort && (
                                                    <span className="text-monokai-pink flex items-center gap-0.5 shrink-0">
                                                        {colSort.direction === 'ASC' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                                                        {sortConfig.length > 1 && <span className="text-[8px] opacity-75">#{sortIndex + 1}</span>}
                                                    </span>
                                                )}
                                            </div>
                                            {/* 列宽调整锚点 */}
                                            <div
                                                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-monokai-purple/60 active:bg-monokai-purple z-30"
                                                onMouseDown={(e) => handleResizeMouseDown(col, e)}
                                            />
                                        </th>
                                    );
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
                                        const width = colWidths[col] || 150;

                                        return (
                                            <td
                                                key={`${rowIdx}-${col}`}
                                                style={{ width, minWidth: width, maxWidth: width }}
                                                className={`p-2 border-r border-monokai-accent/30 text-xs text-monokai-fg cursor-text truncate relative ${
                                                    isNull ? 'italic text-monokai-comment/50' : 'opacity-90'
                                                } ${
                                                    isSticky ? 'sticky left-20 z-10 bg-inherit shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]' : ''
                                                }`}
                                                onDoubleClick={() => handleCellEdit(rowIdx, col, cellValue)}
                                                onContextMenu={(e) => handleRowContextMenu(e, rowIdx, col, cellValue)}
                                                title={String(cellValue)}
                                            >
                                                {isEditing ? (
                                                    <input
                                                        autoFocus
                                                        type={isNum ? 'number' : 'text'}
                                                        value={editingCell.val}
                                                        onChange={(e) => onSetEditingCell({ ...editingCell, val: isNum ? e.target.valueAsNumber : e.target.value })}
                                                        onBlur={onSaveCellEdit}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') onSaveCellEdit();
                                                            if (e.key === 'Escape') onSetEditingCell(null);
                                                        }}
                                                        className="w-full bg-monokai-bg border border-monokai-blue px-1 py-0.5 outline-none text-monokai-fg"
                                                    />
                                                ) : (
                                                    isNull ? 'NULL' : displayVal
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>;
                            })}
                        </tbody>
                    </table>
                )}
            </div>
            {dataViewMode === 'grid' && (
                <div className="p-2 border-t border-monokai-accent bg-monokai-sidebar flex justify-between items-center text-xs text-monokai-comment shrink-0">
                    <span>{pagination.total} records found</span>
                    <div className="flex items-center gap-2">
                        <button onClick={() => onHandlePageChange(pagination.offset - pagination.limit)} disabled={pagination.offset === 0} className="px-2 py-1 flex items-center gap-1 bg-monokai-accent rounded disabled:opacity-30 hover:bg-monokai-comment transition-colors text-monokai-fg"><ChevronLeft size={14} /> Prev</button>
                        <span className="font-mono min-w-[80px] text-center text-monokai-fg">{pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total)}</span>
                        <button onClick={() => onHandlePageChange(pagination.offset + pagination.limit)} disabled={pagination.offset + pagination.limit >= pagination.total} className="px-2 py-1 flex items-center gap-1 bg-monokai-accent rounded disabled:opacity-30 hover:bg-monokai-comment transition-colors text-monokai-fg">Next <ChevronRight size={14} /></button>
                    </div>
                </div>
            )}

            {/* 右键快捷上下文菜单 */}
            {contextMenu && (
                <div
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    className="fixed z-[100] bg-monokai-surface border border-monokai-accent rounded-lg shadow-2xl py-1 text-xs text-monokai-fg w-44 divide-y divide-monokai-accent/30 font-sans"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="py-1">
                        <button
                            onClick={copyCellValue}
                            className="w-full text-left px-3 py-1.5 hover:bg-monokai-purple/20 hover:text-monokai-purple flex items-center gap-2"
                        >
                            <Copy size={12} /> Copy Cell Value
                        </button>
                        <button
                            onClick={() => {
                                setPreviewCell({ columnName: contextMenu.col, val: contextMenu.val });
                                closeContextMenu();
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-monokai-purple/20 hover:text-monokai-purple flex items-center gap-2"
                        >
                            <Eye size={12} /> View Details
                        </button>
                    </div>
                    <div className="py-1">
                        <button
                            onClick={copyRowJson}
                            className="w-full text-left px-3 py-1.5 hover:bg-monokai-purple/20 hover:text-monokai-purple flex items-center gap-2"
                        >
                            <Code size={12} /> Copy Row as JSON
                        </button>
                        <button
                            onClick={copyRowSql}
                            className="w-full text-left px-3 py-1.5 hover:bg-monokai-purple/20 hover:text-monokai-purple flex items-center gap-2"
                        >
                            <Database size={12} /> Copy Row as INSERT
                        </button>
                    </div>
                    {pkColumn && (
                        <div className="py-1">
                            <button
                                onClick={cloneRow}
                                className="w-full text-left px-3 py-1.5 hover:bg-monokai-purple/20 hover:text-monokai-purple flex items-center gap-2 text-monokai-green"
                            >
                                <Plus size={12} /> Clone Row
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* 高级单元格明细对话框 */}
            {previewCell && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center font-sans">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPreviewCell(null)} />
                    <div className="relative bg-monokai-surface border border-monokai-accent rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-[scaleIn_0.2s_ease-out]">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-monokai-accent">
                            <div className="flex items-center gap-2">
                                <Database className="w-4 h-4 text-monokai-yellow" />
                                <h3 className="text-sm font-semibold text-monokai-fg">
                                    Cell Viewer: <span className="font-mono font-bold text-monokai-blue">{previewCell.columnName}</span>
                                </h3>
                            </div>
                            <button onClick={() => setPreviewCell(null)} className="p-1 rounded-md hover:bg-monokai-bg text-monokai-comment hover:text-monokai-fg">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-5 max-h-96 overflow-y-auto bg-monokai-bg">
                            {(() => {
                                const valStr = String(previewCell.val);
                                // 检测是否为 Base64 图片
                                if (valStr.startsWith('data:image/') || (valStr.length > 50 && valStr.match(/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)?$/) && valStr.slice(0, 100).includes('PNG') || valStr.slice(0, 100).includes('JFIF'))) {
                                    const src = valStr.startsWith('data:image/') ? valStr : `data:image/png;base64,${valStr}`;
                                    return (
                                        <div className="flex justify-center py-4 bg-monokai-bg rounded border border-monokai-accent/30">
                                            <img src={src} alt="Base64 Preview" className="max-h-64 object-contain shadow-md" />
                                        </div>
                                    );
                                }
                                // 检测是否为 JSON
                                try {
                                    if (typeof previewCell.val === 'object' && previewCell.val !== null) {
                                        return <pre className="text-xs text-monokai-fg font-mono whitespace-pre-wrap leading-relaxed">{JSON.stringify(previewCell.val, null, 2)}</pre>;
                                    }
                                    const parsed = JSON.parse(valStr);
                                    return <pre className="text-xs text-monokai-fg font-mono whitespace-pre-wrap leading-relaxed">{JSON.stringify(parsed, null, 2)}</pre>;
                                } catch {
                                    // 普通文本
                                    return <pre className="text-xs text-monokai-fg font-mono whitespace-pre-wrap leading-relaxed">{valStr}</pre>;
                                }
                            })()}
                        </div>
                        <div className="flex items-center justify-end px-5 py-3 border-t border-monokai-accent">
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(typeof previewCell.val === 'object' ? JSON.stringify(previewCell.val, null, 2) : String(previewCell.val));
                                    setPreviewCell(null);
                                    onAddNotification('Cell content copied', 'success');
                                }}
                                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-monokai-yellow text-monokai-bg hover:opacity-90"
                            >
                                Copy Content
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
