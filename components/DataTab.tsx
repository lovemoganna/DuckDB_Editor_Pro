import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    TableIcon, LayoutDashboard, Trash2, Columns, FileText, Code, Database,
    Check, X, RefreshCw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUp, ArrowDown,
    Maximize, Maximize2, Filter, ListPlus, Copy, Plus, Eye, SlidersHorizontal,
    ShieldCheck, Activity, Sparkles, TrendingUp, BarChart3, Key, Hash, Type, Calendar,
    Search, ArrowUpDown, CheckCircle2, AlertTriangle, Layers, Zap, ExternalLink, Info, RotateCcw, Ruler
} from 'lucide-react';
import { ColumnInfo } from '../types';
import { getTypeIcon } from '../utils';
import { formatCellValue } from '../utils/typeFormatter';
import { useSqlEditorStore } from '../hooks/store/useSqlEditorStore';
import { SegmentedTabs, ActionButton, EmptyState } from './ui/Workbench';
import { InsertRowModal } from './InsertRowModal';
import { EMPTY_STATE_MESSAGES } from '../designSystem';


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
    onShowCreateModal?: () => void;
    onShowImportModal?: () => void;
    onLoadDemo?: () => void;
    onSetExpandedRowIdx: (v: number | null) => void;
    onAddNotification: (message: string, type: 'success' | 'error' | 'info') => void;
    onNavigateToDashboard?: () => void;
    tables?: string[];
    onSelectTable?: (tableName: string) => void;
    onNavigateToStructure?: (tableName: string) => void;
    onNavigateToAnalysis?: (tableName: string) => void;
    onNavigateToMetrics?: (tableName: string) => void;
    onNavigateToSql?: (sql: string) => void;
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
    onHandleInsertRow, onShowCreateModal, onShowImportModal, onLoadDemo, onSetExpandedRowIdx, onAddNotification,
    onNavigateToDashboard, tables, onSelectTable, onNavigateToStructure, onNavigateToAnalysis, onNavigateToMetrics, onNavigateToSql
}) => {
    // 1. 列宽拖拽调节状态
    const [colWidths, setColWidths] = useState<Record<string, number>>({});

    // 1.5 页码直接跳转输入框平滑状态
    const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.limit));
    const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
    const [inputPage, setInputPage] = useState<string>(String(currentPage));

    useEffect(() => {
        setInputPage(String(currentPage));
    }, [currentPage]);

    const handlePageSubmit = () => {
        const pageNum = parseInt(inputPage, 10);
        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
            onHandlePageChange((pageNum - 1) * pagination.limit);
        } else {
            setInputPage(String(currentPage));
        }
    };

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

    // 4. 高级单元格值预览模态框与新建行模态框
    const [previewCell, setPreviewCell] = useState<{
        columnName: string;
        val: any;
    } | null>(null);
    const [showInsertRowModal, setShowInsertRowModal] = useState(false);
    const [insertInitialData, setInsertInitialData] = useState<Record<string, any> | undefined>(undefined);

    // 5. 数据画像仪表盘 (Profile Dashboard) 专属控制状态
    const [profileSearch, setProfileSearch] = useState('');
    const [profileTypeFilter, setProfileTypeFilter] = useState<'ALL' | 'NUMERIC' | 'TEXT' | 'TIME' | 'OTHER'>('ALL');
    const [profileSort, setProfileSort] = useState<'DEFAULT' | 'NULLS_DESC' | 'UNIQUE_DESC' | 'NAME_ASC'>('DEFAULT');
    const [copiedColName, setCopiedColName] = useState<string | null>(null);

    // 6. 列配置下拉菜单即时搜索过滤状态
    const [colMenuSearch, setColMenuSearch] = useState('');

    // 当切换数据表时，清空相关临时状态
    useEffect(() => {
        setColWidths({});
        setContextMenu(null);
        setVisualRules([]);
        setShowVisualFilter(false);
        setPreviewCell(null);
        setProfileSearch('');
        setProfileTypeFilter('ALL');
        setProfileSort('DEFAULT');
        setColMenuSearch('');
    }, [currentTable]);

    // 列类型分类归纳器
    const getColCategory = (colType: string): 'NUMERIC' | 'TEXT' | 'TIME' | 'OTHER' => {
        const t = (colType || '').toUpperCase();
        if (t.includes('INT') || t.includes('FLOAT') || t.includes('DOUBLE') || t.includes('DECIMAL') || t.includes('NUMERIC') || t.includes('HUGEINT') || t.includes('REAL')) {
            return 'NUMERIC';
        }
        if (t.includes('CHAR') || t.includes('TEXT') || t.includes('VARCHAR') || t.includes('STRING')) {
            return 'TEXT';
        }
        if (t.includes('DATE') || t.includes('TIME') || t.includes('TIMESTAMP') || t.includes('INTERVAL')) {
            return 'TIME';
        }
        return 'OTHER';
    };

    // 表级数据画像统计汇总 (Table Profile Telemetry Summary)
    const profileSummary = useMemo(() => {
        if (!profileData || profileData.length === 0) {
            return {
                totalCols: 0,
                numericCount: 0,
                textCount: 0,
                timeCount: 0,
                otherCount: 0,
                avgHealthScore: 100,
                maxUniqueCol: null as { name: string; count: number } | null,
            };
        }
        let totalNullPct = 0;
        let numericCount = 0;
        let textCount = 0;
        let timeCount = 0;
        let otherCount = 0;
        let maxUniqueCol: { name: string; count: number } | null = null;

        for (const col of profileData) {
            const nullPct = parseFloat(col.null_percentage) || 0;
            totalNullPct += nullPct;
            const cat = getColCategory(col.column_type);
            if (cat === 'NUMERIC') numericCount++;
            else if (cat === 'TEXT') textCount++;
            else if (cat === 'TIME') timeCount++;
            else otherCount++;

            const uniqCount = Number(col.approx_unique) || 0;
            if (!maxUniqueCol || uniqCount > maxUniqueCol.count) {
                maxUniqueCol = { name: col.column_name, count: uniqCount };
            }
        }

        const avgNullPct = totalNullPct / profileData.length;
        const avgHealthScore = Math.max(0, Math.min(100, 100 - avgNullPct));

        return {
            totalCols: profileData.length,
            numericCount,
            textCount,
            timeCount,
            otherCount,
            avgHealthScore,
            maxUniqueCol,
        };
    }, [profileData]);

    // 过滤与排序后的画像列列表
    const filteredProfileData = useMemo(() => {
        let list = [...profileData];
        if (profileSearch.trim()) {
            const query = profileSearch.toLowerCase().trim();
            list = list.filter(c => 
                String(c.column_name || '').toLowerCase().includes(query) || 
                String(c.column_type || '').toLowerCase().includes(query)
            );
        }
        if (profileTypeFilter !== 'ALL') {
            list = list.filter(c => getColCategory(c.column_type) === profileTypeFilter);
        }
        if (profileSort === 'NULLS_DESC') {
            list.sort((a, b) => (parseFloat(b.null_percentage) || 0) - (parseFloat(a.null_percentage) || 0));
        } else if (profileSort === 'UNIQUE_DESC') {
            list.sort((a, b) => (Number(b.approx_unique) || 0) - (Number(a.approx_unique) || 0));
        } else if (profileSort === 'NAME_ASC') {
            list.sort((a, b) => String(a.column_name).localeCompare(String(b.column_name)));
        }
        return list;
    }, [profileData, profileSearch, profileTypeFilter, profileSort]);

    const handleCopyColumnName = async (name: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        await navigator.clipboard.writeText(name);
        setCopiedColName(name);
        setTimeout(() => setCopiedColName(null), 1500);
        onAddNotification(`已复制列名 "${name}"`, 'success');
    };

    const handleFilterNonNull = (colName: string) => {
        const newQuery = `"${colName}" IS NOT NULL`;
        onSetFilterQuery(newQuery);
        onSetDataViewMode('grid');
        onFetchTableData(currentTable!, 0, pagination.limit, sortConfig, newQuery);
        onAddNotification(`已应用非空过滤: ${newQuery}`, 'info');
    };

    const handleDrilldownSql = (colName: string) => {
        const sql = `-- 深度探查列 "${colName}" 频次分布\nSELECT "${colName}", COUNT(*) AS freq, ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS pct\nFROM "${currentTable}"\nGROUP BY 1\nORDER BY 2 DESC\nLIMIT 20;`;
        navigator.clipboard.writeText(sql);
        useSqlEditorStore.getState().updateActiveTab({ code: sql });
        onAddNotification(`已生成 "${colName}" 频次探查 SQL 并载入编辑器`, 'success');
    };


    // 过滤后的列配置列表
    const filteredMenuColumns = useMemo(() => {
        if (!colMenuSearch.trim()) return tableColumns;
        const q = colMenuSearch.toLowerCase().trim();
        return tableColumns.filter(c => c.toLowerCase().includes(q));
    }, [tableColumns, colMenuSearch]);

    const handleSelectAllColumns = () => {
        onSetHiddenColumns(new Set());
    };

    const handleInvertColumns = () => {
        const next = new Set<string>();
        tableColumns.forEach(c => {
            if (!hiddenColumns.has(c)) {
                next.add(c);
            }
        });
        if (next.size === tableColumns.length) {
            next.delete(tableColumns[0]);
        }
        onSetHiddenColumns(next);
    };

    // 右键以当前单元格值快速添加过滤条件
    const filterByCellValue = () => {
        if (!contextMenu) return;
        const { col, val } = contextMenu;
        let condition = '';
        if (val === null || val === undefined) {
            condition = `"${col}" IS NULL`;
        } else if (typeof val === 'number') {
            condition = `"${col}" = ${val}`;
        } else if (typeof val === 'boolean') {
            condition = `"${col}" = ${val ? 'TRUE' : 'FALSE'}`;
        } else {
            condition = `"${col}" = '${String(val).replace(/'/g, "''")}'`;
        }
        const newFilter = filterQuery.trim() ? `${filterQuery.trim()} AND ${condition}` : condition;
        onSetFilterQuery(newFilter);
        onFetchTableData(currentTable!, 0, pagination.limit, sortConfig, newFilter);
        onAddNotification(`已添加快捷过滤: ${condition}`, 'success');
        closeContextMenu();
    };

    // 右键直达该列在画像仪表盘中的分布
    const viewColumnInProfile = () => {
        if (!contextMenu) return;
        const colName = contextMenu.col;
        setProfileSearch(colName);
        onSetDataViewMode('profile');
        onFetchProfileData(currentTable!);
        closeContextMenu();
    };

    if (!currentTable) {
        return (
            <div className="h-full flex items-center justify-center text-monokai-fg flex-col bg-monokai-bg p-6 select-none font-sans overflow-y-auto">
                <div className="flex flex-col items-center text-center max-w-xl">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-monokai-surface border border-monokai-border text-monokai-cyan mb-4 shadow-xl shadow-black/40">
                        <TableIcon className="h-7 w-7" aria-hidden="true" />
                    </div>
                    <h2 className="text-base font-semibold text-monokai-fg tracking-tight">未选择数据表</h2>
                    <p className="mt-1.5 text-xs text-monokai-comment leading-relaxed">
                        请在左侧边栏选择一张数据表以开始流式浏览，或使用下方快捷动作快速开始分析。
                    </p>
                    {onNavigateToDashboard && (
                        <button
                            type="button"
                            onClick={onNavigateToDashboard}
                            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-monokai-surface hover:bg-monokai-elevated text-xs text-monokai-fg border border-monokai-border hover:border-monokai-border-strong transition-all cursor-pointer"
                        >
                            <LayoutDashboard size={13} className="text-monokai-accent" />
                            <span>返回首页仪表盘</span>
                        </button>
                    )}

                    {tables && tables.length > 0 && onSelectTable && (
                        <div className="mt-4 flex flex-wrap gap-2 justify-center max-w-md">
                            <span className="text-xs text-monokai-comment w-full text-center mb-0.5">选择现有数据表开始浏览：</span>
                            {tables.map(tbl => (
                                <button
                                    key={tbl}
                                    type="button"
                                    onClick={() => onSelectTable(tbl)}
                                    className="px-2.5 py-1 text-xs font-mono rounded bg-monokai-surface hover:bg-monokai-elevated text-monokai-fg border border-monokai-border hover:border-monokai-border-strong cursor-pointer transition-colors"
                                >
                                    {tbl}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mt-6 text-left">
                        <button
                            type="button"
                            onClick={() => {
                                if (onLoadDemo) onLoadDemo();
                                else window.dispatchEvent(new CustomEvent('duckdb-load-demo'));
                            }}
                            className="group p-3.5 rounded-xl border border-monokai-border bg-monokai-surface/60 hover:bg-monokai-surface hover:border-monokai-border-strong transition-all text-left flex flex-col justify-between cursor-pointer"
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 rounded-lg bg-monokai-surface border border-monokai-border text-monokai-accent">
                                    <Sparkles className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-semibold text-monokai-fg transition-colors">加载示例数据</span>
                            </div>
                            <p className="text-[11px] text-monokai-comment leading-normal">快速注入电商及日志样本，立即可用。</p>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                if (onShowCreateModal) onShowCreateModal();
                            }}
                            className="group p-3.5 rounded-xl border border-monokai-border bg-monokai-surface/60 hover:bg-monokai-surface hover:border-monokai-border-strong transition-all text-left flex flex-col justify-between cursor-pointer"
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 rounded-lg bg-monokai-surface border border-monokai-border text-monokai-fg">
                                    <Plus className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-semibold text-monokai-fg transition-colors">新建数据表</span>
                            </div>
                            <p className="text-[11px] text-monokai-comment leading-normal">可视化定义字段类型、主键与约束。</p>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                if (onShowImportModal) onShowImportModal();
                                else window.dispatchEvent(new CustomEvent('duckdb-open-import'));
                            }}
                            className="group p-3.5 rounded-xl border border-monokai-border bg-monokai-surface/60 hover:bg-monokai-surface hover:border-monokai-border-strong transition-all text-left flex flex-col justify-between cursor-pointer"
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 rounded-lg bg-monokai-surface border border-monokai-border text-monokai-comment">
                                    <Database className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-semibold text-monokai-fg transition-colors">导入外部数据</span>
                            </div>
                            <p className="text-[11px] text-monokai-comment leading-normal">支持 Parquet, CSV, JSON 文件本地解析。</p>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const visibleColumns = tableColumns.filter(c => !hiddenColumns.has(c));

    const handleCellEdit = (rowIdx: number, col: string, val: any) => {
        const pkCol = schema.find(c => c.pk);
        if (!pkCol) {
            onAddNotification("当前表未定义主键约束 (Primary Key)，无法进行行级就地修改。可在 Schema 页设置主键或创建带行标识的代理视图。", 'info');
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
        navigator.clipboard.writeText(JSON.stringify(row, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
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

    // 复制选中行作为 CSV 到剪贴板
    const copySelectedRowsCsv = () => {
        if (!tableData || tableData.length === 0) return;
        const targetRows = selectedRows.size > 0
            ? tableData.filter(row => pkColumn && selectedRows.has(row[pkColumn.name]))
            : (contextMenu ? [tableData[contextMenu.rowIdx]] : tableData);

        if (targetRows.length === 0) return;
        const cols = Object.keys(targetRows[0]);
        const header = cols.join(',');
        const body = targetRows.map(row =>
            cols.map(c => {
                const val = row[c];
                if (val === null) return '';
                const str = String(val);
                return str.includes(',') || str.includes('"') || str.includes('\n')
                    ? `"${str.replace(/"/g, '""')}"`
                    : str;
            }).join(',')
        ).join('\n');

        navigator.clipboard.writeText(`${header}\n${body}`);
        onAddNotification(`已复制 ${targetRows.length} 行数据 (CSV) 到剪贴板`, 'success');
        closeContextMenu();
    };

    // 克隆当前行
    const cloneRow = async () => {
        if (!contextMenu) return;
        const row = tableData[contextMenu.rowIdx];
        const cloneData = { ...row };
        if (pkColumn) {
            delete cloneData[pkColumn.name];
        }
        setInsertInitialData(cloneData);
        setShowInsertRowModal(true);
        onAddNotification('已载入当前行数据模板，可在弹窗中修改后插入', 'info');
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

        const validRules = visualRules.filter(r => r.operator === 'IS NULL' || r.operator === 'IS NOT NULL' || r.value.trim() !== '');
        if (validRules.length === 0) {
            onSetFilterQuery('');
            onFetchTableData(currentTable, 0, pagination.limit, sortConfig, '');
            return;
        }

        const queryStr = validRules.map(rule => {
            const colDef = schema.find(s => s.name === rule.column);
            const colType = (colDef?.type || '').toUpperCase();
            const isNumCol = colType.match(/int|float|double|numeric|decimal|real|hugeint/i);
            const isBoolCol = colType.includes('BOOL');

            if (rule.operator === 'IS NULL' || rule.operator === 'IS NOT NULL') {
                return `"${rule.column}" ${rule.operator}`;
            }
            if (rule.operator === 'LIKE') {
                return `"${rule.column}" ILIKE '%${rule.value.replace(/'/g, "''")}%'`;
            }

            let formattedVal: string;
            if (isNumCol) {
                const num = Number(rule.value);
                formattedVal = isNaN(num) ? `'${rule.value.replace(/'/g, "''")}'` : String(num);
            } else if (isBoolCol) {
                formattedVal = rule.value.toLowerCase() === 'true' || rule.value === '1' ? 'TRUE' : 'FALSE';
            } else {
                formattedVal = `'${rule.value.replace(/'/g, "''")}'`;
            }

            return `"${rule.column}" ${rule.operator} ${formattedVal}`;
        }).join(' AND ');

        onSetFilterQuery(queryStr);
        onFetchTableData(currentTable, 0, pagination.limit, sortConfig, queryStr);
    };

    const DATA_VIEW_TABS = [
        { value: 'grid' as const, label: '表格网格', icon: TableIcon, badge: pagination.total > 0 ? pagination.total.toLocaleString() : undefined },
        { value: 'profile' as const, label: '画像仪表盘', icon: LayoutDashboard, badge: profileData.length > 0 ? `${profileData.length} 列` : undefined },
    ];


    if (!currentTable) {
        return (
            <div className="h-full flex items-center justify-center p-8 bg-monokai-bg font-sans">
                <EmptyState
                    icon={Database}
                    title={EMPTY_STATE_MESSAGES.DATA.title}
                    description={EMPTY_STATE_MESSAGES.DATA.description}
                    action={
                        <div className="flex flex-col items-center gap-3">
                            {tables && tables.length > 0 && onSelectTable && (
                                <div className="flex flex-wrap items-center justify-center gap-2 max-w-md">
                                    {tables.map(tbl => (
                                        <button
                                            key={tbl}
                                            type="button"
                                            onClick={() => onSelectTable(tbl)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-monokai-sidebar hover:bg-monokai-elevated border border-monokai-border text-xs font-mono text-monokai-fg hover:text-monokai-accent transition-colors cursor-pointer"
                                        >
                                            <Database size={12} className="text-monokai-cyan" />
                                            <span>{tbl}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                                {onShowCreateModal && (
                                    <ActionButton variant="primary" size="sm" icon={Plus} onClick={onShowCreateModal}>
                                        新建表
                                    </ActionButton>
                                )}
                                {onNavigateToDashboard && (
                                    <ActionButton variant="secondary" size="sm" icon={LayoutDashboard} onClick={onNavigateToDashboard}>
                                        返回仪表盘
                                    </ActionButton>
                                )}
                            </div>
                        </div>
                    }
                />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col relative select-none font-sans" onClick={closeContextMenu}>
            {/* Top Toolbar Container */}
            <div className="px-4 py-2.5 bg-monokai-sidebar border-b border-monokai-border shrink-0 flex flex-col gap-2.5 shadow-sm">
                <div className="flex flex-wrap justify-between items-center gap-3 min-h-8">
                    <div className="flex flex-wrap items-center gap-2.5">
                        {onNavigateToDashboard && (
                            <button
                                type="button"
                                onClick={onNavigateToDashboard}
                                className="flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-monokai-surface/60 hover:bg-monokai-surface text-monokai-comment hover:text-monokai-fg border border-monokai-border transition-colors text-xs cursor-pointer group"
                                title="返回首页仪表盘"
                            >
                                <LayoutDashboard size={13} className="text-monokai-accent group-hover:scale-105 transition-transform" />
                                <span className="font-medium">仪表盘</span>
                                <ChevronRight size={12} className="text-monokai-comment/60" />
                            </button>
                        )}
                        <div className="flex items-center gap-2 h-8 px-3 rounded-md bg-monokai-surface border border-monokai-border">
                            <Database size={14} className="text-monokai-green shrink-0" />
                            {tables && tables.length > 1 && onSelectTable ? (
                                <select
                                    value={currentTable}
                                    onChange={(e) => onSelectTable(e.target.value)}
                                    className="bg-transparent text-xs font-mono text-monokai-fg font-semibold cursor-pointer outline-none hover:text-monokai-accent transition-colors"
                                    title="快速切换当前数据表"
                                >
                                    {tables.map(tbl => (
                                        <option key={tbl} value={tbl} className="bg-monokai-sidebar text-monokai-fg font-mono">
                                            {tbl}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <h2 className="text-xs font-mono text-monokai-fg font-semibold tracking-tight">{currentTable}</h2>
                            )}
                        </div>

                        {/* Cross-Module Quick Jump Buttons */}
                        <div className="hidden xl:flex items-center gap-1.5 border-l border-monokai-border/70 pl-2.5">
                            {onNavigateToStructure && (
                                <button
                                    type="button"
                                    onClick={() => onNavigateToStructure(currentTable)}
                                    title="查看及修改此表的 Schema 定义与索引约束"
                                    className="flex items-center gap-1 px-2 py-1 rounded bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border text-[11px] text-monokai-yellow cursor-pointer transition-colors"
                                >
                                    <Ruler size={11} />
                                    <span>结构设计 ↗</span>
                                </button>
                            )}
                            {onNavigateToAnalysis && (
                                <button
                                    type="button"
                                    onClick={() => onNavigateToAnalysis(currentTable)}
                                    title="在分析中心探查此表质量与分布"
                                    className="flex items-center gap-1 px-2 py-1 rounded bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border text-[11px] text-monokai-green cursor-pointer transition-colors"
                                >
                                    <Sparkles size={11} />
                                    <span>分析中心 ↗</span>
                                </button>
                            )}
                            {onNavigateToMetrics && (
                                <button
                                    type="button"
                                    onClick={() => onNavigateToMetrics(currentTable)}
                                    title="基于此表创建业务指标模型"
                                    className="flex items-center gap-1 px-2 py-1 rounded bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border text-[11px] text-monokai-purple cursor-pointer transition-colors"
                                >
                                    <BarChart3 size={11} />
                                    <span>指标建模 ↗</span>
                                </button>
                            )}
                            {onNavigateToSql && (
                                <button
                                    type="button"
                                    onClick={() => onNavigateToSql(`SELECT * FROM "${currentTable}" LIMIT 50;`)}
                                    title="在 SQL 工作台中查询分析此表"
                                    className="flex items-center gap-1 px-2 py-1 rounded bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border text-[11px] text-monokai-cyan cursor-pointer transition-colors"
                                >
                                    <Code size={11} />
                                    <span>在 SQL 中查询 ↗</span>
                                </button>
                            )}
                        </div>

                        {/* Standard Segmented View Switcher */}
                        <SegmentedTabs
                            aria-label="数据视图模式"
                            value={dataViewMode}
                            items={DATA_VIEW_TABS}
                            tone="accent"
                            size="sm"
                            onChange={(val) => {
                                onSetDataViewMode(val);
                                if (val === 'profile') onFetchProfileData(currentTable);
                            }}
                        />

                        {selectedRows.size > 0 && dataViewMode === 'grid' && (
                            <ActionButton
                                variant="danger"
                                size="sm"
                                icon={Trash2}
                                onClick={onHandleBulkDelete}
                            >
                                删除已选 ({selectedRows.size})
                            </ActionButton>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <ActionButton
                            variant={showVisualFilter || visualRules.length > 0 ? 'warning' : 'secondary'}
                            size="sm"
                            icon={SlidersHorizontal}
                            onClick={() => setShowVisualFilter(!showVisualFilter)}
                        >
                            可视化过滤
                        </ActionButton>

                        <div className="relative">
                            <ActionButton
                                variant="secondary"
                                size="sm"
                                icon={Columns}
                                onClick={() => onSetShowColMenu(!showColMenu)}
                            >
                                列配置 {hiddenColumns.size > 0 && `(${visibleColumns.length}/${tableColumns.length})`}
                            </ActionButton>
                            {showColMenu && (
                                <div className="absolute right-0 top-full mt-1.5 bg-monokai-sidebar border border-monokai-border p-3 rounded-lg shadow-xl z-30 min-w-[250px] max-w-sm font-sans flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-100">
                                    <div className="flex items-center justify-between pb-2 border-b border-monokai-border">
                                        <div className="text-[11px] font-semibold text-monokai-fg flex items-center gap-1.5">
                                            <Columns size={13} className="text-monokai-cyan" />
                                            <span>显示 / 隐藏列 ({visibleColumns.length}/{tableColumns.length})</span>
                                        </div>
                                    </div>
                                    {/* Search column input */}
                                    <div className="flex items-center gap-1.5 bg-monokai-surface px-2.5 py-1 rounded-md border border-monokai-border text-xs">
                                        <Search size={12} className="text-monokai-comment shrink-0" />
                                        <input
                                            type="text"
                                            placeholder="搜索列名..."
                                            value={colMenuSearch}
                                            onChange={e => setColMenuSearch(e.target.value)}
                                            className="w-full bg-transparent text-xs text-monokai-fg font-mono placeholder-monokai-comment outline-none"
                                        />
                                        {colMenuSearch && (
                                            <button onClick={() => setColMenuSearch('')} className="text-monokai-comment hover:text-monokai-fg cursor-pointer">
                                                <X size={11} />
                                            </button>
                                        )}
                                    </div>
                                    {/* Quick Actions: All / Invert / Reset */}
                                    <div className="flex items-center gap-1.5 text-[10px] font-mono">
                                        <button
                                            type="button"
                                            onClick={handleSelectAllColumns}
                                            className="flex-1 py-1 px-1.5 rounded-md bg-monokai-surface hover:bg-monokai-elevated text-monokai-comment hover:text-monokai-fg border border-monokai-border transition-colors cursor-pointer text-center"
                                        >
                                            全显
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleInvertColumns}
                                            className="flex-1 py-1 px-1.5 rounded-md bg-monokai-surface hover:bg-monokai-elevated text-monokai-comment hover:text-monokai-fg border border-monokai-border transition-colors cursor-pointer text-center"
                                        >
                                            反选
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onSetHiddenColumns(new Set())}
                                            className="flex-1 py-1 px-1.5 rounded-md bg-monokai-surface hover:bg-monokai-elevated text-monokai-cyan hover:underline border border-monokai-border transition-colors cursor-pointer text-center"
                                        >
                                            重置
                                        </button>
                                    </div>
                                    {/* Column Checkboxes */}
                                    <div className="max-h-60 overflow-y-auto space-y-0.5 pr-1 custom-scrollbar">
                                        {filteredMenuColumns.map(col => {
                                            const colInfo = schema.find(s => s.name === col);
                                            const isChecked = !hiddenColumns.has(col);
                                            const isPk = colInfo?.pk;

                                            return (
                                                <label
                                                    key={col}
                                                    className="flex items-center justify-between gap-2 p-1.5 rounded-md hover:bg-monokai-surface cursor-pointer text-xs transition-colors group"
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => onToggleColumnVisibility(col)}
                                                            className="rounded border-monokai-border bg-monokai-surface text-monokai-green focus:ring-monokai-accent"
                                                        />
                                                        <span className={`truncate font-mono text-xs ${isChecked ? 'text-monokai-fg' : 'text-monokai-comment line-through opacity-60'}`}>
                                                            {col}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        {isPk && (
                                                            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded-md bg-monokai-surface text-monokai-warning border border-monokai-border">
                                                                PK
                                                            </span>
                                                        )}
                                                        {colInfo && (
                                                            <span className="text-[9px] font-mono px-1 rounded bg-monokai-surface text-monokai-comment">
                                                                {colInfo.type}
                                                            </span>
                                                        )}
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            {showColMenu && <div className="fixed inset-0 z-20" onClick={() => onSetShowColMenu(false)} />}
                        </div>

                        {/* Export Group */}
                        <div className="flex items-center gap-0.5 rounded-md bg-monokai-surface border border-monokai-border p-0.5 h-8">
                            <button
                                onClick={() => onDownloadData('csv')}
                                className="text-xs flex items-center gap-1 hover:bg-monokai-elevated px-2 py-1 rounded-md transition-all text-monokai-comment hover:text-monokai-fg cursor-pointer font-sans h-7"
                                title="导出为 CSV 文件"
                            >
                                <FileText size={13} className="text-monokai-green" /> CSV
                            </button>
                            <button
                                onClick={() => onDownloadData('json')}
                                className="text-xs flex items-center gap-1 hover:bg-monokai-elevated px-2 py-1 rounded-md transition-all text-monokai-comment hover:text-monokai-fg cursor-pointer font-sans h-7"
                                title="导出为 JSON 文件"
                            >
                                <Code size={13} className="text-monokai-yellow" /> JSON
                            </button>
                            <button
                                onClick={() => onDownloadData('parquet')}
                                className="text-xs flex items-center gap-1 hover:bg-monokai-elevated px-2 py-1 rounded-md text-monokai-comment hover:text-monokai-fg transition-all cursor-pointer font-sans h-7"
                                title="导出为 Apache Parquet 文件"
                            >
                                <Database size={13} className="text-monokai-cyan" /> Parquet
                            </button>
                        </div>

                        <ActionButton
                            variant="success"
                            size="sm"
                            icon={ListPlus}
                            onClick={() => {
                                setInsertInitialData(undefined);
                                setShowInsertRowModal(true);
                            }}
                        >
                            插入行
                        </ActionButton>
                    </div>
                </div>

                {/* SQL WHERE Input Bar */}
                {!showVisualFilter && dataViewMode === 'grid' && (
                    <div className="flex gap-2 items-center bg-monokai-surface border border-monokai-border px-3 py-1 rounded-md shadow-xs">
                        <span className="text-xs font-semibold text-monokai-fg flex items-center gap-1.5 pl-0.5 font-mono shrink-0">
                            <Filter size={14} className="text-monokai-comment" /> WHERE
                        </span>
                        <input
                            className="flex-1 bg-transparent border-0 text-xs px-2 py-1 text-monokai-fg font-mono outline-none placeholder:text-monokai-comment transition-all"
                            placeholder="如: id > 5 AND status = 'active'..."
                            value={filterQuery}
                            onChange={(e) => onSetFilterQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && onHandleApplyFilter()}
                        />
                        <ActionButton
                            variant="secondary"
                            size="sm"
                            icon={Check}
                            onClick={onHandleApplyFilter}
                        >
                            应用
                        </ActionButton>
                        {filterQuery && (
                            <button
                                onClick={() => { onSetFilterQuery(''); onFetchTableData(currentTable, 0, pagination.limit, sortConfig, ''); }}
                                className="text-monokai-comment hover:text-monokai-fg transition-colors p-1 cursor-pointer rounded hover:bg-monokai-bg"
                                title="清空过滤"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                )}

                {/* Visual Filter Rules Panel */}
                {showVisualFilter && dataViewMode === 'grid' && (
                    <div className="bg-monokai-surface border border-monokai-border p-3 rounded-lg flex flex-col gap-2.5 shadow-md">
                        <div className="flex justify-between items-center pb-1.5 border-b border-monokai-border">
                            <span className="text-xs font-semibold text-monokai-fg flex items-center gap-1.5">
                                <SlidersHorizontal size={13} className="text-monokai-comment" /> 可视化过滤规则 (Visual Filter Rules)
                            </span>
                            <button
                                onClick={addFilterRule}
                                className="h-7 px-2.5 text-xs bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border text-monokai-fg rounded-md flex items-center gap-1 cursor-pointer transition-colors"
                            >
                                <Plus size={11} /> 添加条件
                            </button>
                        </div>
                        {visualRules.length === 0 ? (
                            <div className="text-center py-4 text-xs text-monokai-comment italic">
                                尚未添加过滤条件，点击「添加条件」以构建结构化查询
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                {visualRules.map(rule => (
                                    <div key={rule.id} className="flex flex-wrap sm:flex-nowrap gap-2 items-center bg-monokai-bg p-2 rounded-md border border-monokai-border">
                                        <select
                                            value={rule.column}
                                            onChange={e => updateFilterRule(rule.id, { column: e.target.value })}
                                            className="bg-monokai-surface border border-monokai-border text-xs px-2 py-1 rounded-md text-monokai-fg font-mono outline-none focus:border-monokai-fg/40"
                                        >
                                            {tableColumns.map(col => <option key={col} value={col}>{col}</option>)}
                                        </select>
                                        <select
                                            value={rule.operator}
                                            onChange={e => updateFilterRule(rule.id, { operator: e.target.value })}
                                            className="bg-monokai-surface border border-monokai-border text-xs px-2 py-1 rounded-md text-monokai-fg font-mono font-medium outline-none focus:border-monokai-fg/40"
                                        >
                                            <option value="=">=</option>
                                            <option value="<>">&lt;&gt;</option>
                                            <option value=">">&gt;</option>
                                            <option value="<">&lt;</option>
                                            <option value=">=">&gt;=</option>
                                            <option value="<=">&lt;=</option>
                                            <option value="LIKE">LIKE (模糊包含)</option>
                                            <option value="IS NULL">IS NULL (空值)</option>
                                            <option value="IS NOT NULL">IS NOT NULL (非空)</option>
                                        </select>
                                        {rule.operator !== 'IS NULL' && rule.operator !== 'IS NOT NULL' && (
                                            <input
                                                type="text"
                                                value={rule.value}
                                                onChange={e => updateFilterRule(rule.id, { value: e.target.value })}
                                                placeholder="输入匹配值…"
                                                className="bg-monokai-surface border border-monokai-border text-xs px-2 py-1 rounded-md text-monokai-fg outline-none flex-1 font-mono focus:border-monokai-fg/40"
                                            />
                                        )}
                                        <button
                                            onClick={() => removeFilterRule(rule.id)}
                                            className="text-monokai-comment hover:text-monokai-pink p-1 rounded-md hover:bg-monokai-surface transition-colors cursor-pointer shrink-0"
                                            title="删除此规则"
                                        >
                                            <X size={13} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="flex justify-end gap-2 border-t border-monokai-border pt-2 mt-1">
                            <button
                                onClick={() => {
                                    setVisualRules([]);
                                    onSetFilterQuery('');
                                    onFetchTableData(currentTable, 0, pagination.limit, sortConfig, '');
                                }}
                                className="h-7 px-3 text-xs text-monokai-comment hover:text-monokai-fg rounded-md transition-colors cursor-pointer"
                            >
                                清空规则
                            </button>
                            <button
                                onClick={applyVisualFilters}
                                className="h-7 px-3.5 bg-monokai-green text-monokai-bg font-medium text-xs rounded-md hover:bg-[#a6e22e]/90 transition-colors shadow-xs cursor-pointer"
                            >
                                应用过滤
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Diagnostic Context Banner from Dashboard/External Workflow */}
            {filterQuery && (
                <div className="mx-4 mt-2 mb-1 p-2.5 rounded-lg bg-monokai-yellow/10 border border-monokai-yellow/30 flex items-center justify-between gap-3 text-xs shrink-0 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 text-monokai-yellow overflow-hidden">
                        <AlertTriangle size={14} className="shrink-0" />
                        <span className="font-semibold shrink-0">诊断过滤已生效:</span>
                        <code className="px-1.5 py-0.5 rounded bg-monokai-bg/60 border border-monokai-yellow/20 font-mono text-[11px] text-monokai-fg truncate">
                            {filterQuery}
                        </code>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {onNavigateToSql && (
                            <button
                                type="button"
                                onClick={() => onNavigateToSql(`SELECT * FROM "${currentTable}" WHERE ${filterQuery};`)}
                                className="px-2 py-1 rounded bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border text-[11px] text-monokai-fg flex items-center gap-1 cursor-pointer transition-colors"
                                title="将此过滤条件转化为完整 SQL 并在编辑器中执行"
                            >
                                <ExternalLink size={11} className="text-monokai-cyan" />
                                <span>在 SQL 中查看</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                onSetFilterQuery('');
                                onFetchTableData(currentTable, 0, pagination.limit, sortConfig, '');
                            }}
                            className="px-2 py-1 rounded bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border text-[11px] text-monokai-comment hover:text-monokai-fg flex items-center gap-1 cursor-pointer transition-colors"
                            title="清除当前过滤条件"
                        >
                            <X size={11} />
                            <span>清除过滤</span>
                        </button>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-auto bg-monokai-bg custom-scrollbar">
                {loadingData ? (
                    <div className="h-full flex items-center justify-center text-monokai-comment flex-col gap-2 py-16">
                        <RefreshCw size={32} className="text-monokai-blue animate-spin mb-3" />
                        <div className="animate-pulse text-xs font-mono">正在分析与装载数据…</div>
                    </div>
                ) : dataViewMode === 'profile' ? (
                    <div className="p-4 sm:p-6 space-y-5">
                        {/* 1. Top Table Profiling Telemetry HUD */}
                        <section aria-label="数据画像全景雷达" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {/* Card 1: 资产规模 */}
                            <div className="relative overflow-hidden bg-monokai-surface border border-monokai-border p-3.5 shadow-xs rounded-md">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-mono uppercase tracking-wider text-monokai-comment">
                                        数据资产结构 / SCHEMA SCOPE
                                    </span>
                                    <Layers size={15} className="text-monokai-blue opacity-80" />
                                </div>
                                <div className="mt-2">
                                    <div className="font-mono text-xl font-bold text-monokai-blue">
                                        {profileSummary.totalCols} <span className="text-xs font-normal text-monokai-comment">列总计</span>
                                    </div>
                                    <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-mono text-monokai-comment">
                                        <span className="text-monokai-blue">{profileSummary.numericCount} 数值</span>
                                        <span>•</span>
                                        <span className="text-monokai-green">{profileSummary.textCount} 文本</span>
                                        <span>•</span>
                                        <span className="text-monokai-yellow">{profileSummary.timeCount} 时间</span>
                                        {profileSummary.otherCount > 0 && (
                                            <>
                                                <span>•</span>
                                                <span className="text-monokai-amethyst">{profileSummary.otherCount} 其它</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Card 2: 完整度与健康指数 */}
                            <div className="bg-monokai-surface border border-monokai-border p-3.5 shadow-xs rounded-md">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-mono uppercase tracking-wider text-monokai-comment">
                                        数据完整度 / HEALTH SCORE
                                    </span>
                                    <ShieldCheck
                                        size={15}
                                        className={
                                            profileSummary.avgHealthScore >= 98
                                                 ? 'text-monokai-green'
                                                 : profileSummary.avgHealthScore >= 90
                                                 ? 'text-monokai-yellow'
                                                 : 'text-monokai-pink'
                                        }
                                    />
                                </div>
                                <div className="mt-2">
                                    <div className="flex items-baseline gap-2">
                                        <span
                                            className={`font-mono text-xl font-bold ${
                                                profileSummary.avgHealthScore >= 98
                                                    ? 'text-monokai-green'
                                                    : profileSummary.avgHealthScore >= 90
                                                    ? 'text-monokai-yellow'
                                                    : 'text-monokai-pink'
                                            }`}
                                        >
                                            {profileSummary.avgHealthScore.toFixed(1)}%
                                        </span>
                                        <span
                                            className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.2 rounded border border-monokai-border ${
                                                profileSummary.avgHealthScore >= 98
                                                    ? 'bg-monokai-surface text-monokai-green'
                                                    : profileSummary.avgHealthScore >= 90
                                                    ? 'bg-monokai-surface text-monokai-yellow'
                                                    : 'bg-monokai-surface text-monokai-pink'
                                            }`}
                                        >
                                            {profileSummary.avgHealthScore >= 98 ? 'EXCELLENT' : profileSummary.avgHealthScore >= 90 ? 'GOOD' : 'ATTENTION'}
                                        </span>
                                    </div>
                                    <div className="mt-2 h-1.5 w-full bg-monokai-bg rounded-full overflow-hidden border border-monokai-border/40">
                                        <div
                                            className={`h-full transition-all duration-500 ${
                                                profileSummary.avgHealthScore >= 98 ? 'bg-monokai-green' : profileSummary.avgHealthScore >= 90 ? 'bg-monokai-yellow' : 'bg-monokai-pink'
                                            }`}
                                            style={{ width: `${profileSummary.avgHealthScore}%` }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Card 3: 约束与基数特征 */}
                            <div className="bg-monokai-surface border border-monokai-border p-3.5 shadow-xs rounded-md">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-mono uppercase tracking-wider text-monokai-comment">
                                        约束与基数 / CONSTRAINTS & KEYS
                                    </span>
                                    <Key size={15} className="text-monokai-yellow opacity-80" />
                                </div>
                                <div className="mt-2">
                                    <div className="font-mono text-sm font-bold text-monokai-fg truncate">
                                        {pkColumn ? (
                                            <span className="text-monokai-yellow flex items-center gap-1">
                                                <Key size={12} /> {pkColumn.name} <span className="text-[10px] text-monokai-comment font-normal">(主键)</span>
                                            </span>
                                        ) : (
                                            <span className="text-monokai-comment text-xs font-normal">无明确主键约束</span>
                                        )}
                                    </div>
                                    <div className="mt-1.5 text-[11px] text-monokai-comment truncate font-mono">
                                        {profileSummary.maxUniqueCol ? (
                                            <span>
                                                最高基数: <strong className="text-monokai-amethyst font-normal">{profileSummary.maxUniqueCol.name}</strong> ({profileSummary.maxUniqueCol.count.toLocaleString()})
                                            </span>
                                        ) : (
                                            <span>--</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Card 4: 快速操作工具 */}
                            <div className="bg-monokai-surface border border-monokai-border p-3.5 shadow-xs rounded-md flex flex-col justify-between">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-mono uppercase tracking-wider text-monokai-comment">
                                        画像工具箱 / PROFILE TOOLBOX
                                    </span>
                                    <Sparkles size={15} className="text-monokai-pink opacity-80" />
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => onFetchProfileData(currentTable)}
                                        className="h-7 flex-1 inline-flex items-center justify-center gap-1.5 bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border px-2.5 text-xs text-monokai-fg rounded-md transition-colors cursor-pointer"
                                        title="重新执行 SUMMARIZE 分析"
                                    >
                                        <RefreshCw size={12} /> 重新计算
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const sql = `SUMMARIZE SELECT * FROM "${currentTable}";`;
                                            navigator.clipboard.writeText(sql);
                                            useSqlEditorStore.getState().updateActiveTab({ code: sql });
                                            onAddNotification('已将画像 SQL 载入 SQL 编辑器并复制', 'success');
                                        }}
                                        className="h-7 inline-flex items-center justify-center gap-1 bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border px-2.5 text-xs text-monokai-fg rounded-md transition-colors cursor-pointer"
                                        title="复制 SUMMARIZE SQL"
                                    >
                                        <Code size={12} /> SQL
                                    </button>
                                </div>
                            </div>
                        </section>

                        {/* 2. Search, Filter & Sorter Toolbar */}
                        <section aria-label="画像筛选与排序" className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-monokai-surface border border-monokai-border p-2.5 rounded-md">
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center gap-1.5 bg-monokai-bg border border-monokai-border px-2.5 py-1 text-xs rounded-md">
                                    <Search size={13} className="text-monokai-comment" />
                                    <input
                                        type="text"
                                        placeholder="过滤字段名 / 类型…"
                                        value={profileSearch}
                                        onChange={e => setProfileSearch(e.target.value)}
                                        className="w-36 sm:w-48 bg-transparent text-xs text-monokai-fg placeholder-monokai-comment outline-none"
                                    />
                                    {profileSearch && (
                                        <button onClick={() => setProfileSearch('')} className="text-monokai-comment hover:text-monokai-fg cursor-pointer">
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>

                                {/* Category filter buttons */}
                                <div className="flex items-center gap-1 bg-monokai-bg border border-monokai-border p-0.5 rounded-md text-[11px] font-mono">
                                    <button
                                        type="button"
                                        onClick={() => setProfileTypeFilter('ALL')}
                                        className={`px-2 py-0.5 rounded transition-colors ${
                                            profileTypeFilter === 'ALL' ? 'bg-monokai-surface text-monokai-fg font-bold' : 'text-monokai-comment hover:text-monokai-fg'
                                        }`}
                                    >
                                        全部 ({profileSummary.totalCols})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setProfileTypeFilter('NUMERIC')}
                                        className={`px-2 py-0.5 rounded transition-colors ${
                                            profileTypeFilter === 'NUMERIC' ? 'bg-monokai-surface text-monokai-blue font-bold' : 'text-monokai-comment hover:text-monokai-blue'
                                        }`}
                                    >
                                        数值 ({profileSummary.numericCount})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setProfileTypeFilter('TEXT')}
                                        className={`px-2 py-0.5 rounded transition-colors ${
                                            profileTypeFilter === 'TEXT' ? 'bg-monokai-surface text-monokai-green font-bold' : 'text-monokai-comment hover:text-monokai-green'
                                        }`}
                                    >
                                        文本 ({profileSummary.textCount})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setProfileTypeFilter('TIME')}
                                        className={`px-2 py-0.5 rounded transition-colors ${
                                            profileTypeFilter === 'TIME' ? 'bg-monokai-surface text-monokai-yellow font-bold' : 'text-monokai-comment hover:text-monokai-yellow'
                                        }`}
                                    >
                                        时间 ({profileSummary.timeCount})
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="text-[11px] text-monokai-comment flex items-center gap-1 font-mono">
                                    <ArrowUpDown size={12} /> 排序:
                                </span>
                                <select
                                    value={profileSort}
                                    onChange={e => setProfileSort(e.target.value as any)}
                                    className="bg-monokai-bg border border-monokai-border px-2.5 py-1 text-xs text-monokai-fg font-mono outline-none rounded-md focus:border-monokai-fg/40"
                                >
                                    <option value="DEFAULT">默认结构序</option>
                                    <option value="NULLS_DESC">缺失率最高</option>
                                    <option value="UNIQUE_DESC">唯一值基数最高</option>
                                    <option value="NAME_ASC">列名 A-Z</option>
                                </select>
                            </div>
                        </section>

                        {/* 3. Column Profile Cards Grid */}
                        {filteredProfileData.length === 0 ? (
                            <div className="py-16 text-center bg-monokai-surface border border-monokai-border p-6 rounded-md">
                                <LayoutDashboard size={36} className="mx-auto mb-2 text-monokai-comment/40" />
                                <p className="text-sm font-bold text-monokai-fg">未匹配到任何字段画像</p>
                                <p className="mt-1 text-xs text-monokai-comment">请尝试调整搜索关键字或类型分类条件</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3.5">
                                {filteredProfileData.map((col: any) => {
                                    const nullPct = parseFloat(col.null_percentage) || 0;
                                    const validPct = Math.max(0, 100 - nullPct);
                                    const isPk = pkColumn?.name === col.column_name;
                                    const cat = getColCategory(col.column_type);

                                    return (
                                        <article
                                            key={col.column_name}
                                            className="group relative flex flex-col justify-between bg-monokai-surface border border-monokai-border rounded-md shadow-xs hover:border-monokai-border-strong transition-all duration-150 overflow-hidden"
                                        >
                                            {/* Card Header */}
                                            <div className="p-3 bg-monokai-bg/40 border-b border-monokai-border">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-1.5">
                                                            {isPk && (
                                                                <span
                                                                    className="px-1.5 py-0.2 rounded bg-monokai-surface border border-monokai-border text-monokai-yellow text-[9px] font-mono font-bold flex items-center gap-0.5 shrink-0"
                                                                    title="主键列"
                                                                >
                                                                    <Key size={10} /> PK
                                                                </span>
                                                            )}
                                                            <h3
                                                                className="truncate font-mono text-xs font-bold text-monokai-fg group-hover:text-monokai-cyan transition-colors cursor-pointer"
                                                                onClick={(e) => void handleCopyColumnName(col.column_name, e)}
                                                                title={`点击复制列名: ${col.column_name}`}
                                                            >
                                                                {col.column_name}
                                                            </h3>
                                                        </div>
                                                    </div>

                                                    <span
                                                        className={`shrink-0 text-[10px] font-mono px-2 py-0.5 rounded border border-monokai-border uppercase tracking-wider flex items-center gap-1 ${
                                                            cat === 'NUMERIC'
                                                                ? 'text-monokai-blue bg-monokai-surface'
                                                                : cat === 'TEXT'
                                                                ? 'text-monokai-green bg-monokai-surface'
                                                                : cat === 'TIME'
                                                                ? 'text-monokai-yellow bg-monokai-surface'
                                                                : 'text-monokai-amethyst bg-monokai-surface'
                                                        }`}
                                                    >
                                                        {getTypeIcon(col.column_type)} {col.column_type}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Card Body Metrics */}
                                            <div className="p-3.5 space-y-3 flex-1">
                                                {/* Health Bar (Valid vs Nulls) */}
                                                <div>
                                                    <div className="flex justify-between text-[10px] font-mono text-monokai-comment mb-1">
                                                        <span className="flex items-center gap-1 text-monokai-green">
                                                            <CheckCircle2 size={11} /> 有效: {validPct.toFixed(1)}%
                                                        </span>
                                                        {nullPct > 0 ? (
                                                            <span className="flex items-center gap-1 text-monokai-pink font-semibold">
                                                                <AlertTriangle size={11} /> 缺失: {nullPct.toFixed(1)}%
                                                            </span>
                                                        ) : (
                                                            <span className="text-monokai-comment">无缺失</span>
                                                        )}
                                                    </div>
                                                    <div className="w-full h-1.5 bg-monokai-bg rounded-full overflow-hidden flex border border-monokai-border/40">
                                                        <div
                                                            className="bg-monokai-green h-full transition-all"
                                                            style={{ width: `${validPct}%` }}
                                                            title={`有效值: ${validPct.toFixed(1)}%`}
                                                        />
                                                        {nullPct > 0 && (
                                                            <div
                                                                className="bg-monokai-pink h-full transition-all"
                                                                style={{ width: `${nullPct}%` }}
                                                                title={`缺失值: ${nullPct.toFixed(1)}%`}
                                                            />
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Statistics Grid */}
                                                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                                                    <div className="bg-monokai-bg p-2 rounded-md border border-monokai-border/60">
                                                        <div className="text-[10px] uppercase text-monokai-comment tracking-wider">唯一值基数</div>
                                                        <div className="font-bold text-monokai-amethyst mt-0.5 truncate">
                                                            {Number(col.approx_unique || 0).toLocaleString()}
                                                        </div>
                                                    </div>

                                                    <div className="bg-monokai-bg p-2 rounded-md border border-monokai-border/60">
                                                        <div className="text-[10px] uppercase text-monokai-comment tracking-wider">非空计数</div>
                                                        <div className="font-bold text-monokai-fg mt-0.5 truncate">
                                                            {col.count !== undefined && col.count !== null ? Number(col.count).toLocaleString() : '--'}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Range & Quantiles */}
                                                {(col.min !== null || col.max !== null) && (
                                                    <div className="bg-monokai-bg p-2.5 text-[11px] font-mono space-y-1 rounded-md border border-monokai-border/60">
                                                        <div className="flex justify-between items-center text-monokai-comment">
                                                            <span>MIN:</span>
                                                            <span className="text-monokai-fg truncate max-w-[120px] font-medium" title={String(col.min)}>
                                                                {String(col.min ?? 'NULL')}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-monokai-comment">
                                                            <span>MAX:</span>
                                                            <span className="text-monokai-fg truncate max-w-[120px] font-medium" title={String(col.max)}>
                                                                {String(col.max ?? 'NULL')}
                                                            </span>
                                                        </div>
                                                        {col.avg !== undefined && col.avg !== null && (
                                                            <div className="flex justify-between items-center text-monokai-comment pt-1 border-t border-monokai-border">
                                                                <span>AVG (均值):</span>
                                                                <span className="text-monokai-blue truncate max-w-[120px] font-medium">
                                                                    {typeof col.avg === 'number' ? col.avg.toFixed(2) : String(col.avg)}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {col.q50 !== undefined && col.q50 !== null && (
                                                            <div className="flex justify-between items-center text-monokai-comment">
                                                                <span>Q50 (中位数):</span>
                                                                <span className="text-monokai-yellow truncate max-w-[120px] font-medium">
                                                                    {String(col.q50)}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Card Footer Actions */}
                                            <div className="flex items-center justify-between bg-monokai-bg/40 border-t border-monokai-border px-3 py-2 text-xs">
                                                <button
                                                    type="button"
                                                    onClick={() => handleFilterNonNull(col.column_name)}
                                                    className="inline-flex items-center gap-1 text-[11px] text-monokai-comment hover:text-monokai-fg transition-colors"
                                                    title="在网格视图中筛选此列非空"
                                                >
                                                    <Filter size={11} /> 筛选非空
                                                </button>

                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDrilldownSql(col.column_name)}
                                                        className="inline-flex items-center gap-1 text-[11px] text-monokai-comment hover:text-monokai-fg transition-colors"
                                                        title="生成频次分析 SQL"
                                                    >
                                                        <BarChart3 size={11} /> 频次分析
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => void handleCopyColumnName(col.column_name, e)}
                                                        className="inline-flex items-center gap-1 text-[11px] text-monokai-comment hover:text-monokai-fg transition-colors"
                                                        title="复制列名"
                                                    >
                                                        <Copy size={11} />
                                                    </button>
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ) : (
                    <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
                        <thead className="bg-monokai-sidebar border-b border-monokai-border sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-2 w-10 border-b border-monokai-border bg-monokai-sidebar text-center left-0 sticky z-20">
                                    {pkColumn && (
                                        <input
                                            type="checkbox"
                                            className="cursor-pointer rounded border-monokai-border bg-monokai-surface text-monokai-green focus:ring-monokai-accent"
                                            onChange={(e) => onHandleSelectAll(e.target.checked)}
                                            checked={tableData.length > 0 && tableData.every(r => selectedRows.has(r[pkColumn.name]))}
                                        />
                                    )}
                                </th>
                                <th className="p-2 w-10 border-b border-monokai-border bg-monokai-sidebar z-10 text-center"></th>
                                {visibleColumns.map((col, idx) => {
                                    const colInfo = schema.find(s => s.name === col);
                                    const isSticky = idx === 0 && pkColumn?.name === col;
                                    const colSort = sortConfig.find(s => s.key === col);
                                    const sortIndex = sortConfig.findIndex(s => s.key === col);
                                    const width = colWidths[col] || 160;

                                    return (
                                        <th
                                            key={col}
                                            style={{ width, minWidth: width, maxWidth: width }}
                                            className={`p-2.5 font-mono text-xs text-monokai-fg font-semibold border-b border-monokai-border cursor-pointer hover:bg-monokai-surface/60 select-none relative group transition-colors ${
                                                isSticky ? 'sticky left-20 z-20 bg-monokai-sidebar shadow-[2px_0_6px_rgba(0,0,0,0.5)]' : ''
                                            }`}
                                            onClick={(e) => handleSort(col, e)}
                                        >
                                            <div className="flex items-center gap-2 justify-between">
                                                <div className="flex items-center gap-1.5 truncate flex-1">
                                                    <span className="truncate text-monokai-fg font-medium">{col}</span>
                                                    {colInfo && (
                                                        <span className="text-[9.5px] font-mono text-monokai-cyan px-1.5 py-0.5 rounded bg-monokai-surface border border-monokai-border/40 flex items-center gap-1 shrink-0" title={colInfo.type}>
                                                            {getTypeIcon(colInfo.type)}
                                                            <span>{colInfo.type}</span>
                                                        </span>
                                                    )}
                                                </div>
                                                {colSort && (
                                                    <span className="text-monokai-green flex items-center gap-0.5 shrink-0 font-bold">
                                                        {colSort.direction === 'ASC' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                                                        {sortConfig.length > 1 && <span className="text-[8px] opacity-80">#{sortIndex + 1}</span>}
                                                    </span>
                                                )}
                                            </div>
                                            {/* Column resize handle */}
                                            <div
                                                className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-monokai-comment active:bg-monokai-fg z-30 transition-colors opacity-0 group-hover:opacity-100"
                                                onMouseDown={(e) => handleResizeMouseDown(col, e)}
                                            />
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody className="font-mono">
                            {tableData.length === 0 && !loadingData && (
                                <tr>
                                    <td colSpan={visibleColumns.length + 2} className="py-16 text-center text-monokai-comment">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <TableIcon className="w-8 h-8 opacity-30 text-monokai-comment" />
                                            <p className="text-xs font-semibold text-monokai-fg">当前表暂无数据记录</p>
                                            <p className="text-[11px] text-monokai-comment">可以通过顶部「插入行」添加记录，或在 SQL 工作台中写入数据。</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {tableData.map((row, rowIdx) => {
                                const pkVal = pkColumn ? row[pkColumn.name] : null;
                                const isSelected = pkVal !== null && selectedRows.has(pkVal);
                                return (
                                    <tr
                                      key={rowIdx}
                                      className={`border-b border-monokai-border/30 transition-colors group ${
                                        isSelected
                                          ? 'bg-monokai-elevated text-monokai-fg'
                                          : 'odd:bg-monokai-bg even:bg-monokai-surface/30 hover:bg-monokai-surface/80'
                                      }`}
                                    >
                                    <td className="p-2 text-center sticky left-0 z-10 bg-inherit">
                                        {pkColumn && (
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={(e) => onHandleSelectRow(pkVal, e.target.checked)}
                                                className="cursor-pointer rounded border-monokai-border bg-monokai-surface text-monokai-green focus:ring-monokai-accent"
                                            />
                                        )}
                                    </td>
                                    <td className="p-2 text-center">
                                        <button
                                            onClick={() => onSetExpandedRowIdx(rowIdx)}
                                            className="text-xs text-monokai-comment hover:text-monokai-cyan transition-colors cursor-pointer p-1 rounded hover:bg-monokai-surface"
                                            title="在抽屉中查看该行完整详情"
                                        >
                                            <Maximize2 size={12} />
                                        </button>
                                    </td>
                                    {visibleColumns.map((col, idx) => {
                                        const isEditing = editingCell?.rowIdx === rowIdx && editingCell?.col === col;
                                        const cellValue = row[col];
                                        const colInfo = schema.find(s => s.name === col);
                                        const isNum = colInfo?.type.includes('INT') || colInfo?.type.includes('FLOAT') || colInfo?.type.includes('DOUBLE');
                                        const isNull = cellValue === null || cellValue === undefined;
                                        const isSticky = idx === 0 && pkColumn?.name === col;
                                        const displayVal = formatCellValue(cellValue, colInfo?.type);
                                        const width = colWidths[col] || 160;

                                        return (
                                            <td
                                                key={`${rowIdx}-${col}`}
                                                style={{ width, minWidth: width, maxWidth: width }}
                                                className={`p-2 text-xs text-monokai-fg cursor-text truncate relative ${
                                                    isNull ? 'italic' : ''
                                                } ${
                                                    isSticky ? 'sticky left-20 z-10 bg-inherit shadow-[2px_0_6px_rgba(0,0,0,0.4)]' : ''
                                                }`}
                                                onDoubleClick={() => handleCellEdit(rowIdx, col, cellValue)}
                                                onContextMenu={(e) => handleRowContextMenu(e, rowIdx, col, cellValue)}
                                                title={cellValue === null || cellValue === undefined ? '' : String(cellValue)}
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
                                                         className="w-full bg-monokai-surface border border-monokai-border px-2 py-0.5 rounded-md outline-none text-monokai-fg font-mono text-xs focus:border-monokai-fg/40"
                                                    />
                                                ) : (
                                                    isNull ? (
                                                        <span className="inline-flex items-center px-1.5 py-0.2 rounded-md text-[10px] font-mono font-medium bg-monokai-surface text-monokai-pink border border-monokai-border">
                                                            NULL
                                                        </span>
                                                    ) : displayVal
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                              );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
            {dataViewMode === 'grid' && (
                <div className="px-4 py-2 border-t border-monokai-border bg-monokai-sidebar flex flex-wrap justify-between items-center text-xs text-monokai-comment shrink-0 font-sans shadow-xs gap-2">
                    <div className="flex items-center gap-3">
                        <span className="font-mono text-monokai-fg font-medium">共 {pagination.total.toLocaleString()} 条记录</span>
                        {selectedRows.size > 0 && (
                            <span className="px-2 py-0.5 text-[11px] bg-monokai-surface text-monokai-fg border border-monokai-border rounded-md font-mono font-medium flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-monokai-fg" />
                                <span>已选中 {selectedRows.size} 行</span>
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Page Size Selector */}
                        <div className="flex items-center gap-1.5 font-mono text-xs text-monokai-comment bg-monokai-surface border border-monokai-border py-0.5 px-2 rounded-md h-7">
                            <span>每页:</span>
                            <select
                                value={pagination.limit}
                                onChange={(e) => {
                                    const newLimit = parseInt(e.target.value, 10);
                                    if (newLimit) {
                                        onFetchTableData(currentTable!, 0, newLimit, sortConfig, filterQuery);
                                    }
                                }}
                                className="bg-transparent text-monokai-fg font-semibold outline-none cursor-pointer"
                            >
                                <option value={25} className="bg-monokai-sidebar text-monokai-fg">25</option>
                                <option value={50} className="bg-monokai-sidebar text-monokai-fg">50</option>
                                <option value={100} className="bg-monokai-sidebar text-monokai-fg">100</option>
                                <option value={200} className="bg-monokai-sidebar text-monokai-fg">200</option>
                            </select>
                        </div>

                        {/* First Page */}
                        <button
                            onClick={() => onHandlePageChange(0)}
                            disabled={pagination.offset === 0}
                            className="h-7 w-7 flex items-center justify-center bg-monokai-surface border border-monokai-border rounded-md disabled:opacity-30 hover:bg-monokai-elevated hover:text-monokai-fg text-monokai-comment transition-all cursor-pointer"
                            title="首页"
                        >
                            <ChevronsLeft size={14} />
                        </button>

                        {/* Prev Page */}
                        <button
                            onClick={() => onHandlePageChange(Math.max(0, pagination.offset - pagination.limit))}
                            disabled={pagination.offset === 0}
                            className="h-7 px-2.5 flex items-center gap-1 bg-monokai-surface border border-monokai-border rounded-md disabled:opacity-30 hover:bg-monokai-elevated hover:text-monokai-fg transition-all text-monokai-comment cursor-pointer text-xs"
                        >
                            <ChevronLeft size={14} /> 上一页
                        </button>

                        {/* Page Jump */}
                        <div className="h-7 flex items-center gap-1.5 font-mono text-xs text-monokai-fg bg-monokai-surface border border-monokai-border px-2.5 rounded-md">
                            <span className="text-monokai-comment">页码:</span>
                            <input
                                type="number"
                                min={1}
                                max={totalPages}
                                value={inputPage}
                                onChange={(e) => setInputPage(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handlePageSubmit(); }}
                                onBlur={handlePageSubmit}
                                className="w-10 text-center bg-transparent border-0 rounded text-monokai-fg font-medium focus:outline-none py-0.5"
                            />
                            <span className="text-monokai-comment">/ {totalPages}</span>
                        </div>

                        {/* Next Page */}
                        <button
                            onClick={() => onHandlePageChange(pagination.offset + pagination.limit)}
                            disabled={pagination.offset + pagination.limit >= pagination.total}
                            className="h-7 px-2.5 flex items-center gap-1 bg-monokai-surface border border-monokai-border rounded-md disabled:opacity-30 hover:bg-monokai-elevated hover:text-monokai-fg transition-all text-monokai-comment cursor-pointer text-xs"
                        >
                            下一页 <ChevronRight size={14} />
                        </button>

                        {/* Last Page */}
                        <button
                            onClick={() => onHandlePageChange((totalPages - 1) * pagination.limit)}
                            disabled={pagination.offset + pagination.limit >= pagination.total}
                            className="h-7 w-7 flex items-center justify-center bg-monokai-surface border border-monokai-border rounded-md disabled:opacity-30 hover:bg-monokai-elevated hover:text-monokai-fg text-monokai-comment transition-all cursor-pointer"
                            title="末页"
                        >
                            <ChevronsRight size={14} />
                        </button>
                    </div>
                </div>
            )}

            {/* Context Menu */}
            {contextMenu && (
                <div
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    className="fixed z-[100] bg-monokai-sidebar border border-monokai-border rounded-lg shadow-xl py-1 text-xs text-monokai-fg w-56 font-sans divide-y divide-monokai-border animate-in fade-in zoom-in-95 duration-100"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="py-0.5">
                        <button
                            onClick={copyCellValue}
                            className="w-full text-left px-3 py-1.5 hover:bg-monokai-surface hover:text-monokai-fg flex items-center gap-2 transition-colors cursor-pointer"
                        >
                            <Copy size={13} className="text-monokai-comment" /> 复制单元格值
                        </button>
                        <button
                            onClick={() => {
                                setPreviewCell({ columnName: contextMenu.col, val: contextMenu.val });
                                closeContextMenu();
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-monokai-surface hover:text-monokai-fg flex items-center gap-2 transition-colors cursor-pointer"
                        >
                            <Eye size={13} className="text-monokai-comment" /> 查看大图 / 明细
                        </button>
                        <button
                            onClick={filterByCellValue}
                            className="w-full text-left px-3 py-1.5 hover:bg-monokai-surface hover:text-monokai-fg flex items-center gap-2 transition-colors cursor-pointer"
                        >
                            <Filter size={13} className="text-monokai-comment" /> 以此值快速过滤
                        </button>
                        <button
                            onClick={viewColumnInProfile}
                            className="w-full text-left px-3 py-1.5 hover:bg-monokai-surface hover:text-monokai-fg flex items-center gap-2 transition-colors cursor-pointer"
                        >
                            <BarChart3 size={13} className="text-monokai-comment" /> 查看此列画像分布
                        </button>
                    </div>
                    <div className="py-0.5">
                        <button
                            onClick={copySelectedRowsCsv}
                            className="w-full text-left px-3 py-1.5 hover:bg-monokai-surface hover:text-monokai-fg flex items-center gap-2 transition-colors cursor-pointer"
                        >
                            <FileText size={13} className="text-monokai-comment" /> {selectedRows.size > 0 ? `复制选中 ${selectedRows.size} 行为 CSV` : '复制本行为 CSV'}
                        </button>
                        <button
                            onClick={copyRowJson}
                            className="w-full text-left px-3 py-1.5 hover:bg-monokai-surface hover:text-monokai-fg flex items-center gap-2 transition-colors cursor-pointer"
                        >
                            <Code size={13} className="text-monokai-comment" /> 复制为 JSON
                        </button>
                        <button
                            onClick={copyRowSql}
                            className="w-full text-left px-3 py-1.5 hover:bg-monokai-surface hover:text-monokai-fg flex items-center gap-2 transition-colors cursor-pointer"
                        >
                            <Database size={13} className="text-monokai-comment" /> 复制为 INSERT 语句
                        </button>
                    </div>
                    {pkColumn ? (
                        <div className="py-0.5">
                            <button
                                onClick={cloneRow}
                                className="w-full text-left px-3 py-1.5 hover:bg-monokai-surface hover:text-monokai-fg flex items-center gap-2 transition-colors cursor-pointer font-medium"
                            >
                                <Plus size={13} className="text-monokai-green" /> 克隆并新增行
                            </button>
                        </div>
                    ) : (
                        <div className="py-0.5">
                            <button
                                onClick={() => {
                                    if (onNavigateToStructure) onNavigateToStructure(currentTable!);
                                    else onAddNotification("请在 Schema 结构页为表设置主键以开启行级修改", 'info');
                                    closeContextMenu();
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-monokai-surface text-monokai-yellow hover:text-monokai-yellow flex items-center gap-2 transition-colors cursor-pointer text-[11px]"
                            >
                                <Key size={13} className="text-monokai-yellow" /> 配置主键以开启行编辑 ↗
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Cell Preview Modal */}
            {previewCell && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center font-sans p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-150" onClick={() => setPreviewCell(null)} />
                    <div className="relative bg-monokai-sidebar border border-monokai-border rounded-lg shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-monokai-border bg-monokai-sidebar">
                            <div className="flex items-center gap-2">
                                <Database className="w-4 h-4 text-monokai-green" />
                                <h3 className="text-sm font-semibold text-monokai-fg font-mono">
                                    字段明细: <span className="text-monokai-fg font-bold">{previewCell.columnName}</span>
                                </h3>
                            </div>
                            <button
                                onClick={() => setPreviewCell(null)}
                                className="p-1 rounded-md hover:bg-monokai-surface text-monokai-comment hover:text-monokai-fg transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-4 max-h-96 overflow-y-auto bg-monokai-bg custom-scrollbar">
                            {(() => {
                                const valStr = String(previewCell.val);
                                // Detect Base64 image
                                if (valStr.startsWith('data:image/') || (valStr.length > 50 && valStr.match(/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)?$/) && (valStr.slice(0, 100).includes('PNG') || valStr.slice(0, 100).includes('JFIF')))) {
                                    const src = valStr.startsWith('data:image/') ? valStr : `data:image/png;base64,${valStr}`;
                                    return (
                                        <div className="flex justify-center py-4 bg-monokai-surface rounded-md border border-monokai-border">
                                            <img src={src} alt="Base64 Preview" className="max-h-64 object-contain shadow-md rounded-md" />
                                        </div>
                                    );
                                }
                                // Detect JSON
                                try {
                                    if (typeof previewCell.val === 'object' && previewCell.val !== null) {
                                        return <pre className="text-xs text-monokai-fg font-mono whitespace-pre-wrap leading-relaxed">{JSON.stringify(previewCell.val, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2)}</pre>;
                                    }
                                    const parsed = JSON.parse(valStr);
                                    return <pre className="text-xs text-monokai-fg font-mono whitespace-pre-wrap leading-relaxed">{JSON.stringify(parsed, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2)}</pre>;
                                } catch {
                                    // Plain text
                                    return <pre className="text-xs text-monokai-fg font-mono whitespace-pre-wrap leading-relaxed">{valStr}</pre>;
                                }
                            })()}
                        </div>
                        <div className="flex items-center justify-between px-4 py-3 border-t border-monokai-border bg-monokai-sidebar">
                            <span className="text-[11px] font-mono text-monokai-comment">
                                长度: {String(previewCell.val ?? '').length} 字符
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPreviewCell(null)}
                                    className="h-8 px-3 text-xs rounded-md border border-monokai-border bg-monokai-surface hover:bg-monokai-elevated text-monokai-comment hover:text-monokai-fg transition-colors cursor-pointer"
                                >
                                    关闭
                                </button>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(typeof previewCell.val === 'object' ? JSON.stringify(previewCell.val, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2) : String(previewCell.val));
                                        setPreviewCell(null);
                                        onAddNotification('已复制单元格内容', 'success');
                                    }}
                                    className="h-8 px-4 text-xs font-medium rounded-md bg-monokai-green text-monokai-bg hover:bg-[#a6e22e]/90 transition-colors cursor-pointer shadow-xs"
                                >
                                    复制内容
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showInsertRowModal && currentTable && (
                <InsertRowModal
                    isOpen={showInsertRowModal}
                    onClose={() => {
                        setShowInsertRowModal(false);
                        setInsertInitialData(undefined);
                    }}
                    tableName={currentTable}
                    schema={schema}
                    initialData={insertInitialData}
                    onRowInserted={() => {
                        onFetchTableData(currentTable, pagination.offset, pagination.limit);
                    }}
                />
            )}
        </div>
    );
};

export default DataTab;
