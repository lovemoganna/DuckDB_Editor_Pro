import { quoteTable } from '../services/analysis/sqlUtils';
import React, { useState, useEffect, useMemo } from 'react';
import {
    TableIcon, LayoutDashboard, Trash2, Columns, FileText, Code, Database,
    Check, X, RefreshCw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUp, ArrowDown,
    Maximize2, Filter, ListPlus, Copy, Plus, Eye, SlidersHorizontal,
    ShieldCheck, Sparkles, BarChart3, Key, ArrowUpDown, CheckCircle2,
    AlertTriangle, Layers, ExternalLink, Ruler, GitBranch, LayoutGrid, List, Hash, Rows, Table2, Search
} from 'lucide-react';
import { ColumnInfo, Tab } from '../types';
import {useAppStore} from '../hooks/store/useAppStore';
import { getTypeIcon } from '../utils';
import { formatCellValue, getTypeBadgeStyle } from '../utils/typeFormatter';
import { useSqlEditorStore } from '../hooks/store/useSqlEditorStore';
import { duckDBService } from '../services/duckdbService';
import {
    PageShell,
    PageHeader,
    SegmentedTabs,
    ActionButton,
    EmptyState,
    SearchInput,
    FormSelect,
    FormInput,
    IconButton,
    Badge,
    InlineAlert,
    ModalShell,
    NavJumpChip,
    WorkbenchLoadingState,
} from './ui/Workbench';
import { InsertRowModal } from './InsertRowModal';
import { RowDetailPanel } from './RowDetailPanel';
import { EMPTY_STATE_MESSAGES } from '../designSystem';

const DATA_TAB_MONO_FONT =
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

let dataTabMeasureCanvas: HTMLCanvasElement | null = null;

function measureDataTabTextPx(text: string, fontSizePx = 12, fontWeight: number | string = 400): number {
    const safe = String(text ?? '');
    if (typeof document === 'undefined') {
        return Math.ceil([...safe].reduce((w, ch) => w + (/[\u4e00-\u9fff]/.test(ch) ? 1.9 : 1), 0) * fontSizePx * 0.62);
    }
    if (!dataTabMeasureCanvas) dataTabMeasureCanvas = document.createElement('canvas');
    const ctx = dataTabMeasureCanvas.getContext('2d');
    if (!ctx) {
        return Math.ceil([...safe].reduce((w, ch) => w + (/[\u4e00-\u9fff]/.test(ch) ? 1.9 : 1), 0) * fontSizePx * 0.62);
    }
    ctx.font = `${fontWeight} ${fontSizePx}px ${DATA_TAB_MONO_FONT}`;
    return Math.ceil(ctx.measureText(safe).width);
}


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
    onNavigateToDataFlow?: (tableName: string) => void;
    onShowExportModal?: () => void;
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
    onNavigateToDashboard, tables, onSelectTable, onNavigateToStructure, onNavigateToAnalysis, onNavigateToMetrics, onNavigateToSql,
    onNavigateToDataFlow, onShowExportModal
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

    // 7. WHERE 草稿：仅点「应用」后才写入 filterQuery 并真正过滤；默认展示全表
    const [filterDraft, setFilterDraft] = useState(filterQuery);

    useEffect(() => {
        setFilterDraft(filterQuery);
    }, [filterQuery, currentTable]);

    const applyFilterCondition = (nextFilter: string = filterDraft) => {
        const applied = nextFilter.trim();
        onSetFilterQuery(applied);
        if (currentTable) {
            onFetchTableData(currentTable, 0, pagination.limit, sortConfig, applied);
        }
    };

    const clearFilterCondition = () => {
        setFilterDraft('');
        setVisualRules([]);
        onSetFilterQuery('');
        if (currentTable) {
            onFetchTableData(currentTable, 0, pagination.limit, sortConfig, '');
        }
    };

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
        setFilterDraft('');
    }, [currentTable]);

    // 8. 多表数据资源大厅 (Multi-Table Hub) 状态与元数据探查
    const [tableCatalog, setTableCatalog] = useState<Array<{
        name: string;
        isView?: boolean;
        rowCount?: number;
        columnCount?: number;
        columns?: string[];
        pkName?: string;
    }>>([]);
    const [loadingCatalog, setLoadingCatalog] = useState(false);
    const [catalogError, setCatalogError] = useState('');
    const [catalogRevision, setCatalogRevision] = useState(0);
    const [hubSearch, setHubSearch] = useState('');
    const [hubTypeFilter, setHubTypeFilter] = useState<'all' | 'table' | 'view'>('all');
    const [hubSortBy, setHubSortBy] = useState<'default' | 'name-asc' | 'name-desc' | 'rows-desc' | 'cols-desc'>('default');
    const [hubViewMode, setHubViewMode] = useState<'grid' | 'list'>('grid');
    const [copiedHubTable, setCopiedHubTable] = useState<string | null>(null);

    useEffect(() => {
        if (!tables || tables.length === 0) {
            setTableCatalog([]);
            setLoadingCatalog(false);
            setCatalogError('');
            return;
        }

        let isCancelled = false;

        const loadCatalog = async () => {
            setLoadingCatalog(true);
            setCatalogError('');
            try {
                const [tablesMeta, viewsMeta, colsMeta] = await Promise.all([
                    duckDBService.readQuery(`SELECT table_name, column_count, estimated_size FROM duckdb_tables() WHERE NOT internal AND database_name=current_database() AND schema_name=current_schema();`).catch(() => []),
                    duckDBService.readQuery(`SELECT view_name FROM duckdb_views() WHERE database_name=current_database() AND schema_name=current_schema();`).catch(() => []),
                    duckDBService.readQuery(`SELECT table_name, column_name FROM duckdb_columns() WHERE NOT internal AND database_name=current_database() AND schema_name=current_schema();`).catch(() => []),
                ]);

                if (isCancelled) return;

                const viewSet = new Set((viewsMeta || []).map((v: any) => String(v.view_name || '')));
                const metaMap = new Map<string, { colCount?: number; rowCount?: number }>();
                (tablesMeta || []).forEach((t: any) => {
                    metaMap.set(String(t.table_name), {
                        colCount: Number(t.column_count || 0),
                        rowCount: Number(t.estimated_size || 0),
                    });
                });

                const colsMap = new Map<string, string[]>();
                (colsMeta || []).forEach((c: any) => {
                    const tName = String(c.table_name);
                    const cName = String(c.column_name);
                    if (!colsMap.has(tName)) colsMap.set(tName, []);
                    colsMap.get(tName)!.push(cName);
                });

                const items = await Promise.all(tables.map(async name => {
                    const isView = viewSet.has(name);
                    const meta = metaMap.get(name);
                    const cols = colsMap.get(name) || [];
                    const [schemaResult, countResult] = await Promise.allSettled([duckDBService.getTableSchema(name), duckDBService.readQuery(`SELECT COUNT(*) AS total FROM ${quoteTable(name)}`)]);
                    const actualSchema = schemaResult.status === 'fulfilled' ? schemaResult.value : [];
                    const actualCount = countResult.status === 'fulfilled' ? countResult.value : undefined;
                    return {
                        name,
                        isView,
                        rowCount: actualCount ? Number(actualCount[0]?.total ?? 0) : undefined,
                        columnCount: meta?.colCount ?? (actualSchema.length || cols.length || undefined),
                        columns: cols.length ? cols : actualSchema.map(c => c.name),
                        pkName: actualSchema.filter(c => c.pk).map(c => c.name).join(', ') || undefined,
                        metadataFailed: schemaResult.status === 'rejected' || countResult.status === 'rejected',
                    };
                }));

                if (!isCancelled) {
                    setTableCatalog(items);
                    if (items.some(item => item.metadataFailed)) setCatalogError('部分对象元数据读取失败；未读取到的行数与字段显示为未知。');
                }
            } catch {
                if (isCancelled) return;
                setCatalogError('数据资源元数据读取失败，请重试。');
                setTableCatalog(tables.map(name => ({
                    name,
                    isView: false,
                    columns: [],
                })));
            } finally {
                if (!isCancelled) setLoadingCatalog(false);
            }
        };

        loadCatalog();

        return () => {
            isCancelled = true;
        };
    }, [tables, catalogRevision]);

    const activeCatalog = useMemo(() => {
        if (tableCatalog.length > 0) return tableCatalog;
        return (tables || []).map(t => ({
            name: t,
            isView: false,
            rowCount: undefined as number | undefined,
            columnCount: undefined as number | undefined,
            columns: [] as string[],
            pkName: undefined as string | undefined,
        }));
    }, [tableCatalog, tables]);

    const catalogStats = useMemo(() => {
        const total = activeCatalog.length;
        let views = 0;
        let rows = 0;
        let cols = 0;
        let withPk = 0;

        for (const item of activeCatalog) {
            if (item.isView) views++;
            rows += item.rowCount || 0;
            cols += item.columnCount || 0;
            if (item.pkName) withPk++;
        }

        return {
            total,
            tables: total - views,
            views,
            rows,
            cols,
            rowsKnown: activeCatalog.every(item => item.rowCount !== undefined),
            colsKnown: activeCatalog.every(item => item.columnCount !== undefined),
            pkRate: total > 0 ? Math.round((withPk / total) * 100) : 0,
        };
    }, [activeCatalog]);

    const filteredCatalog = useMemo(() => {
        return activeCatalog
            .filter(item => {
                if (hubTypeFilter === 'table' && item.isView) return false;
                if (hubTypeFilter === 'view' && !item.isView) return false;
                if (!hubSearch.trim()) return true;
                const q = hubSearch.toLowerCase().trim();
                const matchesName = item.name.toLowerCase().includes(q);
                const matchesCol = item.columns?.some(c => c.toLowerCase().includes(q));
                return matchesName || matchesCol;
            })
            .sort((a, b) => {
                if (hubSortBy === 'name-asc') return a.name.localeCompare(b.name);
                if (hubSortBy === 'name-desc') return b.name.localeCompare(a.name);
                if (hubSortBy === 'rows-desc') return (b.rowCount || 0) - (a.rowCount || 0);
                if (hubSortBy === 'cols-desc') return (b.columnCount || 0) - (a.columnCount || 0);
                return 0;
            });
    }, [activeCatalog, hubTypeFilter, hubSearch, hubSortBy]);

    const handleCopyHubTable = (tName: string, e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(tName);
        setCopiedHubTable(tName);
        onAddNotification(`已复制表名: ${tName}`, 'success');
        setTimeout(() => setCopiedHubTable(null), 1500);
    };

    // 当前选定表的元数据详情（判断是普通表还是视图，获取字段与行数）
    const currentTableMeta = useMemo(() => {
        if (!currentTable) return null;
        return activeCatalog.find(item => item.name === currentTable) || null;
    }, [activeCatalog, currentTable]);

    const currentTableIsView = Boolean(currentTableMeta?.isView);

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

    // 右键快速排除当前值过滤
    const filterExcludeCellValue = () => {
        if (!contextMenu) return;
        const { col, val } = contextMenu;
        let condition = '';
        if (val === null || val === undefined) {
            condition = `"${col}" IS NOT NULL`;
        } else if (typeof val === 'number') {
            condition = `("${col}" != ${val} OR "${col}" IS NULL)`;
        } else if (typeof val === 'boolean') {
            condition = `"${col}" != ${val ? 'TRUE' : 'FALSE'}`;
        } else {
            condition = `("${col}" != '${String(val).replace(/'/g, "''")}' OR "${col}" IS NULL)`;
        }
        const newFilter = filterQuery.trim() ? `${filterQuery.trim()} AND ${condition}` : condition;
        onSetFilterQuery(newFilter);
        onFetchTableData(currentTable!, 0, pagination.limit, sortConfig, newFilter);
        onAddNotification(`已添加排除过滤: ${condition}`, 'success');
        closeContextMenu();
    };

    // 右键以当前列快速排序
    const sortColumnFromMenu = (dir: 'ASC' | 'DESC') => {
        if (!contextMenu) return;
        const col = contextMenu.col;
        const newSort: { key: string; direction: 'ASC' | 'DESC' }[] = [{ key: col, direction: dir }];
        onFetchTableData(currentTable!, 0, pagination.limit, newSort, filterQuery);
        onAddNotification(`已按 "${col}" ${dir === 'ASC' ? '升序' : '降序'} 排列`, 'info');
        closeContextMenu();
    };

    // 右键快速隐藏该列
    const hideColumnFromMenu = () => {
        if (!contextMenu) return;
        const col = contextMenu.col;
        onToggleColumnVisibility(col);
        onAddNotification(`已隐藏列 "${col}"（可在右上角「列配置」中恢复）`, 'info');
        closeContextMenu();
    };

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

    // 拖拽宽度：未手动调整时按自适应宽度起步
    const handleResizeMouseDown = (colName: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const th = (e.currentTarget as HTMLElement).closest('th');
        const startX = e.pageX;
        const startWidth = colWidths[colName] || autoColWidths[colName] || th?.offsetWidth || 120;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const newWidth = Math.max(72, startWidth + (moveEvent.pageX - startX));
            setColWidths(prev => ({ ...prev, [colName]: newWidth }));
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    /** 按表头 + 当前页样本内容实测列宽（canvas），类型收紧上下限 */
    const autoColWidths = useMemo(() => {
        const PAD_PX = 24;
        const RESIZE_HANDLE = 8;
        const SAMPLE = 50;
        const widths: Record<string, number> = {};

        for (const col of visibleColumns) {
            const colInfo = schema.find(s => s.name === col);
            const typeLabel = colInfo?.type || 'VARCHAR';
            const tUpper = typeLabel.toUpperCase();
            const cat = getColCategory(typeLabel);
            const isBool = tUpper.includes('BOOL');
            const isShortId =
                col.toLowerCase() === 'id' ||
                col.toLowerCase().endsWith('_id') ||
                col.toLowerCase().endsWith('id');

            const nameW = measureDataTabTextPx(col, 12, 600);
            const typeW = measureDataTabTextPx(typeLabel, 10, 500) + 22; // type pill + icon
            const headerNeed = Math.max(nameW, typeW) + PAD_PX + RESIZE_HANDLE;

            let maxContent = measureDataTabTextPx('NULL', 12, 400);
            for (const row of tableData.slice(0, SAMPLE)) {
                const raw = row[col];
                if (raw === null || raw === undefined) continue;
                const display = formatCellValue(raw, typeLabel);
                const firstLine = String(display).split('\n')[0] || '';
                maxContent = Math.max(
                    maxContent,
                    measureDataTabTextPx(firstLine.slice(0, 64), 12, 400),
                );
            }
            const contentNeed = maxContent + PAD_PX;

            let minW = 88;
            let maxW = 320;
            if (isBool) {
                minW = 72;
                maxW = 108;
            } else if (isShortId) {
                minW = 72;
                maxW = 128;
            } else if (cat === 'NUMERIC') {
                minW = 80;
                maxW = 168;
            } else if (cat === 'TIME') {
                minW = 118;
                maxW = 196;
            } else if (cat === 'TEXT') {
                minW = 88;
                maxW = 360;
            }

            const contentClamped = Math.min(Math.max(contentNeed, minW), maxW);
            widths[col] = Math.max(headerNeed, contentClamped);
        }
        return widths;
    }, [visibleColumns, tableData, schema]);

    const getColumnWidthStyle = (col: string): React.CSSProperties => {
        const width = colWidths[col] ?? autoColWidths[col] ?? 120;
        return { width, minWidth: width, maxWidth: width, textAlign: 'center' };
    };

    const tableAutoWidth = useMemo(() => {
        const checkboxCol = 40;
        const expandCol = 40;
        const colsTotal = visibleColumns.reduce(
            (sum, col) => sum + (colWidths[col] ?? autoColWidths[col] ?? 120),
            0,
        );
        return checkboxCol + expandCol + colsTotal;
    }, [visibleColumns, colWidths, autoColWidths]);

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
        onAddNotification('已复制单元格值到剪贴板', 'success');
        closeContextMenu();
    };

    // 复制整行作为 JSON 到剪贴板
    const copyRowJson = () => {
        if (!contextMenu) return;
        const row = tableData[contextMenu.rowIdx];
        navigator.clipboard.writeText(JSON.stringify(row, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
        onAddNotification('已复制整行 JSON 到剪贴板', 'success');
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
        onAddNotification('已复制 INSERT 语句到剪贴板', 'success');
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
            clearFilterCondition();
            return;
        }

        const validRules = visualRules.filter(r => r.operator === 'IS NULL' || r.operator === 'IS NOT NULL' || r.value.trim() !== '');
        if (validRules.length === 0) {
            clearFilterCondition();
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
        setFilterDraft(queryStr);
        setShowVisualFilter(false);
    };

    const DATA_VIEW_TABS = [
        { value: 'grid' as const, label: '表格网格', icon: TableIcon, badge: pagination.total > 0 ? pagination.total.toLocaleString() : undefined },
        { value: 'profile' as const, label: '画像仪表盘', icon: LayoutDashboard, badge: profileData.length > 0 ? `${profileData.length} 列` : undefined },
    ];

    if (!currentTable) {
        const hasTables = Boolean(tables && tables.length > 0);

        if (!hasTables) {
            return (
                <PageShell scroll="page" className="h-full items-center justify-center p-6 sm:p-8">
                    <EmptyState
                        icon={TableIcon}
                        title="未找到可浏览的数据表"
                        description="当前 DuckDB 数据库中暂无任何数据表或视图。请导入数据文件或加载内置示例数据以开始。"
                        className="w-full max-w-2xl bg-transparent border-0"
                        action={
                            <div className="flex flex-wrap items-center justify-center gap-2">
                                <ActionButton
                                    variant="primary"
                                    size="sm"
                                    icon={Sparkles}
                                    onClick={() => {
                                        if (onLoadDemo) onLoadDemo();
                                        else window.dispatchEvent(new CustomEvent('duckdb-load-demo'));
                                    }}
                                >
                                    加载示例数据
                                </ActionButton>
                                {onShowCreateModal && (
                                    <ActionButton variant="secondary" size="sm" icon={Plus} onClick={onShowCreateModal}>
                                        新建数据表
                                    </ActionButton>
                                )}
                                <ActionButton
                                    variant="secondary"
                                    size="sm"
                                    icon={Database}
                                    onClick={() => {
                                        if (onShowImportModal) onShowImportModal();
                                        else window.dispatchEvent(new CustomEvent('duckdb-open-import'));
                                    }}
                                >
                                    导入数据文件
                                </ActionButton>
                                {onNavigateToDashboard && (
                                    <ActionButton variant="ghost" size="sm" icon={LayoutDashboard} onClick={onNavigateToDashboard}>
                                        返回仪表盘
                                    </ActionButton>
                                )}
                            </div>
                        }
                    />
                </PageShell>
            );
        }

        return (
            <PageShell scroll="page" className="h-full min-h-0 w-full flex-1 overflow-y-auto bg-monokai-bg">
                {/* 1. Header */}
                <PageHeader
                    title="数据资源工作台"
                    description={`DuckDB 数据资源总览 · 共 ${catalogStats.total} 个对象 (${catalogStats.tables} 张表 · ${catalogStats.views} 视图) · 极速网格浏览 · 跨模块直达`}
                    icon={Database}
                    tone="accent"
                    actions={
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                            {onLoadDemo && (
                                <ActionButton
                                    variant="secondary"
                                    size="sm"
                                    icon={Sparkles}
                                    onClick={onLoadDemo}
                                    title="重新加载示例数据集"
                                >
                                    加载示例
                                </ActionButton>
                            )}
                            {onShowCreateModal && (
                                <ActionButton
                                    variant="secondary"
                                    size="sm"
                                    icon={Plus}
                                    onClick={onShowCreateModal}
                                    title="创建新的数据表"
                                >
                                    新建表
                                </ActionButton>
                            )}
                            {onShowImportModal && (
                                <ActionButton
                                    variant="secondary"
                                    size="sm"
                                    icon={Database}
                                    onClick={onShowImportModal}
                                    title="导入本地 CSV / Parquet / JSON 文件"
                                >
                                    导入文件
                                </ActionButton>
                            )}
                            {onNavigateToDashboard && (
                                <ActionButton
                                    variant="ghost"
                                    size="sm"
                                    icon={LayoutDashboard}
                                    onClick={onNavigateToDashboard}
                                    title="返回全局首页仪表盘"
                                >
                                    仪表盘
                                </ActionButton>
                            )}
                        </div>
                    }
                />

                <div className="p-4 sm:p-6 flex flex-col gap-5 max-w-7xl mx-auto w-full">
                    {/* 2. Top Telemetry Metrics Strip */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        {/* Metric 1 */}
                        <div className="bg-monokai-surface border border-monokai-border p-3.5 rounded-lg shadow-xs flex items-center justify-between">
                            <div>
                                <span className="text-2xs font-mono uppercase tracking-wider text-monokai-comment">
                                    数据表与视图 / OBJECTS
                                </span>
                                <div className="mt-1 flex items-baseline gap-2">
                                    <span className="text-xl sm:text-2xl font-bold font-mono text-monokai-fg tabular-nums">
                                        {catalogStats.total}
                                    </span>
                                    <span className="text-2xs font-mono text-monokai-comment">
                                        ({catalogStats.tables} 表 · {catalogStats.views} 视图)
                                    </span>
                                </div>
                            </div>
                            <div className="h-10 w-10 rounded-lg bg-monokai-cyan/10 border border-monokai-cyan/25 flex items-center justify-center text-monokai-cyan shrink-0">
                                <Database size={20} />
                            </div>
                        </div>

                        {/* Metric 2 */}
                        <div className="bg-monokai-surface border border-monokai-border p-3.5 rounded-lg shadow-xs flex items-center justify-between">
                            <div>
                                <span className="text-2xs font-mono uppercase tracking-wider text-monokai-comment">
                                    估算记录体量 / ESTIMATED ROWS
                                </span>
                                <div className="mt-1 flex items-baseline gap-1.5">
                                    <span className="text-xl sm:text-2xl font-bold font-mono text-monokai-green tabular-nums">
                                        {catalogStats.rowsKnown ? catalogStats.rows.toLocaleString() : '--'}
                                    </span>
                                    <span className="text-2xs font-mono text-monokai-comment">条记录</span>
                                </div>
                            </div>
                            <div className="h-10 w-10 rounded-lg bg-monokai-green/10 border border-monokai-green/25 flex items-center justify-center text-monokai-green shrink-0">
                                <Rows size={20} />
                            </div>
                        </div>

                        {/* Metric 3 */}
                        <div className="bg-monokai-surface border border-monokai-border p-3.5 rounded-lg shadow-xs flex items-center justify-between">
                            <div>
                                <span className="text-2xs font-mono uppercase tracking-wider text-monokai-comment">
                                    字段规模与主键 / SCHEMA SCOPE
                                </span>
                                <div className="mt-1 flex items-baseline gap-2">
                                    <span className="text-xl sm:text-2xl font-bold font-mono text-monokai-yellow tabular-nums">
                                        {catalogStats.colsKnown ? catalogStats.cols : '--'}
                                    </span>
                                    <span className="text-2xs font-mono text-monokai-comment">
                                        字段 · PK率 {catalogStats.colsKnown ? `${catalogStats.pkRate}%` : '--'}
                                    </span>
                                </div>
                            </div>
                            <div className="h-10 w-10 rounded-lg bg-monokai-yellow/10 border border-monokai-yellow/25 flex items-center justify-center text-monokai-yellow shrink-0">
                                <Key size={20} />
                            </div>
                        </div>

                        {/* Metric 4 */}
                        <div className="bg-monokai-surface border border-monokai-border p-3.5 rounded-lg shadow-xs flex items-center justify-between">
                            <div>
                                <span className="text-2xs font-mono uppercase tracking-wider text-monokai-comment">
                                    引擎状态 / RUNTIME
                                </span>
                                <div className="mt-1 flex items-baseline gap-2">
                                    <span className="text-sm sm:text-base font-bold font-mono text-monokai-pink truncate">
                                        DuckDB WASM
                                    </span>
                                </div>
                                <span className="text-2xs text-monokai-comment font-mono block mt-0.5">
                                    列式极速向量化执行
                                </span>
                            </div>
                            <div className="h-10 w-10 rounded-lg bg-monokai-pink/10 border border-monokai-pink/25 flex items-center justify-center text-monokai-pink shrink-0">
                                <Sparkles size={20} />
                            </div>
                        </div>
                    </div>

                    {/* 3. Toolbar (Search, Filter, Sort, View Switch) */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-monokai-surface border border-monokai-border p-3 rounded-lg">
                        <div className="flex flex-wrap items-center gap-2 flex-1">
                            <SearchInput
                                value={hubSearch}
                                onChange={setHubSearch}
                                onClear={() => setHubSearch('')}
                                placeholder="搜索表名 / 字段名…"
                                size="sm"
                                className="w-full sm:w-64"
                            />

                            {/* Type filter buttons */}
                            <div className="flex items-center gap-1 bg-monokai-bg border border-monokai-border p-0.5 rounded-md text-meta font-mono">
                                <button
                                    type="button"
                                    onClick={() => setHubTypeFilter('all')}
                                    className={`px-2.5 py-1 rounded transition-colors cursor-pointer text-xs ${
                                        hubTypeFilter === 'all'
                                            ? 'bg-monokai-surface text-monokai-fg font-bold shadow-xs'
                                            : 'text-monokai-comment hover:text-monokai-fg'
                                    }`}
                                >
                                    全部 ({catalogStats.total})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setHubTypeFilter('table')}
                                    className={`px-2.5 py-1 rounded transition-colors cursor-pointer text-xs ${
                                        hubTypeFilter === 'table'
                                            ? 'bg-monokai-surface text-monokai-cyan font-bold shadow-xs'
                                            : 'text-monokai-comment hover:text-monokai-cyan'
                                    }`}
                                >
                                    表 ({catalogStats.tables})
                                </button>
                                {catalogStats.views > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setHubTypeFilter('view')}
                                        className={`px-2.5 py-1 rounded transition-colors cursor-pointer text-xs ${
                                            hubTypeFilter === 'view'
                                                ? 'bg-monokai-surface text-monokai-amethyst font-bold shadow-xs'
                                                : 'text-monokai-comment hover:text-monokai-amethyst'
                                        }`}
                                    >
                                        视图 ({catalogStats.views})
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2 justify-end">
                            <div className="flex items-center gap-1.5">
                                <span className="text-2xs text-monokai-comment font-mono flex items-center gap-1">
                                    <ArrowUpDown size={11} /> 排序:
                                </span>
                                <FormSelect
                                    value={hubSortBy}
                                    onChange={(e) => setHubSortBy(e.target.value as any)}
                                    sizeVariant="sm"
                                    className="w-auto font-mono text-xs"
                                >
                                    <option value="default">默认顺序</option>
                                    <option value="name-asc">表名 A → Z</option>
                                    <option value="name-desc">表名 Z → A</option>
                                    <option value="rows-desc">记录数 由多到少</option>
                                    <option value="cols-desc">字段数 由多到少</option>
                                </FormSelect>
                            </div>

                            {/* View Switcher: Grid vs List */}
                            <div className="flex items-center bg-monokai-bg border border-monokai-border p-0.5 rounded-md">
                                <button
                                    type="button"
                                    onClick={() => setHubViewMode('grid')}
                                    title="卡片网格视图"
                                    className={`p-1.5 rounded transition-colors cursor-pointer ${
                                        hubViewMode === 'grid'
                                            ? 'bg-monokai-surface text-monokai-fg shadow-xs'
                                            : 'text-monokai-comment hover:text-monokai-fg'
                                    }`}
                                >
                                    <LayoutGrid size={15} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setHubViewMode('list')}
                                    title="紧凑表格列表视图"
                                    className={`p-1.5 rounded transition-colors cursor-pointer ${
                                        hubViewMode === 'list'
                                            ? 'bg-monokai-surface text-monokai-fg shadow-xs'
                                            : 'text-monokai-comment hover:text-monokai-fg'
                                    }`}
                                >
                                    <List size={15} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 4. Table Collection Content */}
                    {loadingCatalog && <WorkbenchLoadingState message="正在读取数据资源元数据…" />}
                    {catalogError && <InlineAlert tone="warning" title="元数据未完整载入">
                        <p>{catalogError}</p>
                        <ActionButton size="sm" onClick={() => setCatalogRevision(value => value + 1)}>重试元数据</ActionButton>
                    </InlineAlert>}
                    {filteredCatalog.length === 0 ? (
                        <div className="py-16 text-center bg-monokai-surface border border-monokai-border p-8 rounded-lg">
                            <Search size={36} className="mx-auto mb-2 text-monokai-comment/40" />
                            <h3 className="text-sm font-semibold text-monokai-fg">未匹配到任何数据表</h3>
                            <p className="mt-1 text-xs text-monokai-comment">请尝试调整搜索关键词或类型分类条件</p>
                            <ActionButton
                                variant="secondary"
                                size="sm"
                                icon={RefreshCw}
                                onClick={() => {
                                    setHubSearch('');
                                    setHubTypeFilter('all');
                                }}
                                className="mt-4 mx-auto"
                            >
                                清除搜索与重置
                            </ActionButton>
                        </div>
                    ) : hubViewMode === 'grid' ? (
                        /* Grid Cards */
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                            {filteredCatalog.map(tbl => (
                                <article
                                    key={tbl.name}
                                    onClick={() => onSelectTable?.(tbl.name)}
                                    className="group relative flex flex-col justify-between rounded-lg border border-monokai-border bg-monokai-surface/90 hover:bg-monokai-surface hover:border-monokai-accent/70 hover:shadow-lg transition-all duration-200 cursor-pointer overflow-hidden p-4"
                                >
                                    <div>
                                        {/* Card Top */}
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                                                    tbl.isView
                                                        ? 'bg-monokai-amethyst/10 border-monokai-amethyst/30 text-monokai-amethyst'
                                                        : 'bg-monokai-cyan/10 border-monokai-cyan/30 text-monokai-cyan'
                                                }`}>
                                                    {tbl.isView ? <Layers size={18} /> : <Database size={18} />}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <h3
                                                        className="truncate font-mono text-sm font-bold text-monokai-fg group-hover:text-monokai-accent transition-colors"
                                                        title={tbl.name}
                                                    >
                                                        {tbl.name}
                                                    </h3>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold uppercase tracking-wider ${
                                                            tbl.isView
                                                                ? 'bg-monokai-amethyst/15 text-monokai-amethyst border border-monokai-amethyst/30'
                                                                : 'bg-monokai-cyan/15 text-monokai-cyan border border-monokai-cyan/30'
                                                        }`}>
                                                            {tbl.isView ? 'VIEW' : 'TABLE'}
                                                        </span>
                                                        {tbl.pkName && (
                                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-mono font-medium bg-monokai-yellow/15 text-monokai-yellow border border-monokai-yellow/30" title={`主键字段: ${tbl.pkName}`}>
                                                                <Key size={10} /> {tbl.pkName}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleCopyHubTable(tbl.name, e)}
                                                    title="复制表名"
                                                    className="p-1.5 rounded text-monokai-comment hover:text-monokai-fg hover:bg-monokai-bg transition-colors cursor-pointer"
                                                >
                                                    {copiedHubTable === tbl.name ? <Check size={14} className="text-monokai-green" /> : <Copy size={14} />}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Card Metrics */}
                                        <div className="my-3.5 grid grid-cols-2 gap-2 p-2.5 rounded-md bg-monokai-bg/60 border border-monokai-border/60 text-xs">
                                            <div>
                                                <span className="text-[10.5px] text-monokai-comment font-mono flex items-center gap-1">
                                                    <Rows size={11} /> 估算行数
                                                </span>
                                                <div className="font-mono font-semibold text-monokai-fg tabular-nums mt-0.5 text-xs">
                                                    {tbl.rowCount === undefined ? '--' : tbl.rowCount.toLocaleString()} 行
                                                </div>
                                            </div>
                                            <div>
                                                <span className="text-[10.5px] text-monokai-comment font-mono flex items-center gap-1">
                                                    <Columns size={11} /> 字段规模
                                                </span>
                                                <div className="font-mono font-semibold text-monokai-fg tabular-nums mt-0.5 text-xs">
                                                    {tbl.columnCount ?? '--'} 列
                                                </div>
                                            </div>
                                        </div>

                                        {/* Column tags preview */}
                                        {tbl.columns && tbl.columns.length > 0 && (
                                            <div className="mb-3.5 flex flex-wrap gap-1 items-center max-h-12 overflow-hidden">
                                                {tbl.columns.slice(0, 4).map(c => (
                                                    <span key={c} className="px-1.5 py-0.5 rounded bg-monokai-sidebar/80 border border-monokai-border text-[10px] font-mono text-monokai-comment truncate max-w-[90px]">
                                                        {c}
                                                    </span>
                                                ))}
                                                {tbl.columns.length > 4 && (
                                                    <span className="px-1 py-0.5 text-[10px] font-mono text-monokai-comment/70">
                                                        +{tbl.columns.length - 4}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Card Footer Actions */}
                                    <div className="pt-3 border-t border-monokai-border/70 flex items-center justify-between gap-2" onClick={e => e.stopPropagation()}>
                                        <button
                                            type="button"
                                            onClick={() => onSelectTable?.(tbl.name)}
                                            className="flex-1 inline-flex items-center justify-center gap-1.5 h-7.5 px-3 rounded-md bg-monokai-accent/15 hover:bg-monokai-accent/25 border border-monokai-accent/30 text-xs font-semibold text-monokai-accent transition-colors cursor-pointer"
                                        >
                                            <TableIcon size={13} />
                                            <span>浏览数据 ↗</span>
                                        </button>

                                        <div className="flex items-center gap-0.5">
                                            {onNavigateToStructure && (
                                                <button
                                                    type="button"
                                                    onClick={() => onNavigateToStructure(tbl.name)}
                                                    title="查看结构定义"
                                                    className="p-1.5 rounded-md text-monokai-comment hover:text-monokai-yellow hover:bg-monokai-bg transition-colors cursor-pointer"
                                                >
                                                    <Ruler size={13} />
                                                </button>
                                            )}
                                            {onNavigateToAnalysis && (
                                                <button
                                                    type="button"
                                                    onClick={() => onNavigateToAnalysis(tbl.name)}
                                                    title="在分析中心探查"
                                                    className="p-1.5 rounded-md text-monokai-comment hover:text-monokai-green hover:bg-monokai-bg transition-colors cursor-pointer"
                                                >
                                                    <Sparkles size={13} />
                                                </button>
                                            )}
                                            {onNavigateToMetrics && (
                                                <button
                                                    type="button"
                                                    onClick={() => onNavigateToMetrics(tbl.name)}
                                                    title="在指标建模中定义"
                                                    className="p-1.5 rounded-md text-monokai-comment hover:text-monokai-amethyst hover:bg-monokai-bg transition-colors cursor-pointer"
                                                >
                                                    <BarChart3 size={13} />
                                                </button>
                                            )}
                                            {onNavigateToSql && (
                                                <button
                                                    type="button"
                                                    onClick={() => onNavigateToSql(`SELECT * FROM "${tbl.name}" LIMIT 50;`)}
                                                    title="在 SQL 中快速查询"
                                                    className="p-1.5 rounded-md text-monokai-comment hover:text-monokai-cyan hover:bg-monokai-bg transition-colors cursor-pointer"
                                                >
                                                    <Code size={13} />
                                                </button>
                                            )}
                                            {onNavigateToDataFlow && (
                                                <button
                                                    type="button"
                                                    onClick={() => onNavigateToDataFlow(tbl.name)}
                                                    title="查看数据流血缘"
                                                    className="p-1.5 rounded-md text-monokai-comment hover:text-monokai-pink hover:bg-monokai-bg transition-colors cursor-pointer"
                                                >
                                                    <GitBranch size={13} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    ) : (
                        /* Compact Table List View */
                        <div className="rounded-lg border border-monokai-border bg-monokai-surface overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="border-b border-monokai-border bg-monokai-sidebar/90 text-monokai-comment font-mono text-2xs uppercase tracking-wider">
                                            <th className="py-2.5 px-4 font-semibold">数据表名称</th>
                                            <th className="py-2.5 px-4 font-semibold">类型</th>
                                            <th className="py-2.5 px-4 font-semibold text-right">估算行数</th>
                                            <th className="py-2.5 px-4 font-semibold text-right">字段数</th>
                                            <th className="py-2.5 px-4 font-semibold">主键</th>
                                            <th className="py-2.5 px-4 font-semibold">字段概览</th>
                                            <th className="py-2.5 px-4 font-semibold text-right">快捷操作</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-monokai-border/50 font-mono text-[11.5px]">
                                        {filteredCatalog.map(tbl => (
                                            <tr
                                                key={tbl.name}
                                                onClick={() => onSelectTable?.(tbl.name)}
                                                className="hover:bg-monokai-bg/60 transition-colors cursor-pointer group"
                                            >
                                                <td className="py-2.5 px-4 font-bold text-monokai-fg group-hover:text-monokai-accent flex items-center gap-2">
                                                    <span className={tbl.isView ? 'text-monokai-amethyst' : 'text-monokai-cyan'}>
                                                        {tbl.isView ? <Layers size={14} /> : <Database size={14} />}
                                                    </span>
                                                    <span>{tbl.name}</span>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleCopyHubTable(tbl.name, e)}
                                                        className="opacity-0 group-hover:opacity-100 p-0.5 text-monokai-comment hover:text-monokai-fg"
                                                        title="复制表名"
                                                    >
                                                        {copiedHubTable === tbl.name ? <Check size={12} className="text-monokai-green" /> : <Copy size={12} />}
                                                    </button>
                                                </td>
                                                <td className="py-2.5 px-4">
                                                    <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                                                        tbl.isView
                                                            ? 'bg-monokai-amethyst/15 text-monokai-amethyst'
                                                            : 'bg-monokai-cyan/15 text-monokai-cyan'
                                                    }`}>
                                                        {tbl.isView ? 'VIEW' : 'TABLE'}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-4 text-right tabular-nums text-monokai-fg">
                                                    {tbl.rowCount === undefined ? '--' : tbl.rowCount.toLocaleString()}
                                                </td>
                                                <td className="py-2.5 px-4 text-right tabular-nums text-monokai-fg">
                                                    {tbl.columnCount ?? '--'}
                                                </td>
                                                <td className="py-2.5 px-4">
                                                    {tbl.pkName ? (
                                                        <span className="text-monokai-yellow flex items-center gap-1">
                                                            <Key size={11} /> {tbl.pkName}
                                                        </span>
                                                    ) : (
                                                        <span className="text-monokai-comment/60">--</span>
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-4 max-w-xs truncate text-monokai-comment">
                                                    {tbl.columns && tbl.columns.length > 0 ? tbl.columns.slice(0, 3).join(', ') + (tbl.columns.length > 3 ? '…' : '') : '--'}
                                                </td>
                                                <td className="py-2.5 px-4 text-right" onClick={e => e.stopPropagation()}>
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => onSelectTable?.(tbl.name)}
                                                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-monokai-accent/15 hover:bg-monokai-accent/25 text-monokai-accent font-semibold text-xs transition-colors"
                                                        >
                                                            <TableIcon size={12} />
                                                            <span>浏览</span>
                                                        </button>
                                                        {onNavigateToStructure && (
                                                            <button
                                                                type="button"
                                                                onClick={() => onNavigateToStructure(tbl.name)}
                                                                title="查看结构定义"
                                                                className="p-1 rounded text-monokai-comment hover:text-monokai-yellow hover:bg-monokai-bg transition-colors"
                                                            >
                                                                <Ruler size={13} />
                                                            </button>
                                                        )}
                                                        {onNavigateToAnalysis && (
                                                            <button
                                                                type="button"
                                                                onClick={() => onNavigateToAnalysis(tbl.name)}
                                                                title="在分析中心探查"
                                                                className="p-1 rounded text-monokai-comment hover:text-monokai-green hover:bg-monokai-bg transition-colors"
                                                            >
                                                                <Sparkles size={13} />
                                                            </button>
                                                        )}
                                                        {onNavigateToMetrics && (
                                                            <button
                                                                type="button"
                                                                onClick={() => onNavigateToMetrics(tbl.name)}
                                                                title="在指标建模中定义"
                                                                className="p-1 rounded text-monokai-comment hover:text-monokai-amethyst hover:bg-monokai-bg transition-colors"
                                                            >
                                                                <BarChart3 size={13} />
                                                            </button>
                                                        )}
                                                        {onNavigateToSql && (
                                                            <button
                                                                type="button"
                                                                onClick={() => onNavigateToSql(`SELECT * FROM "${tbl.name}" LIMIT 50;`)}
                                                                title="在 SQL 中查询"
                                                                className="p-1 rounded text-monokai-comment hover:text-monokai-cyan hover:bg-monokai-bg transition-colors"
                                                            >
                                                                <Code size={13} />
                                                            </button>
                                                        )}
                                                        {onNavigateToDataFlow && (
                                                            <button
                                                                type="button"
                                                                onClick={() => onNavigateToDataFlow(tbl.name)}
                                                                title="查看数据流血缘"
                                                                className="p-1 rounded text-monokai-comment hover:text-monokai-pink hover:bg-monokai-bg transition-colors"
                                                            >
                                                                <GitBranch size={13} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </PageShell>
        );
    }

    return (
        <PageShell scroll="none" className="h-full min-h-0 w-full flex-1 overflow-hidden" onClick={closeContextMenu}>
            <PageHeader
                title="数据浏览"
                description={currentTable ? `当前数据表: ${currentTable} · 分页表格 · 排序筛选 · 单元格编辑 · 画像分析 · 导出` : "分页表格 · 排序筛选 · 单元格编辑 · 画像分析 · 导出"}
                icon={TableIcon}
                tone="accent"
                badge={
                    currentTable ? (
                        <div className="flex items-center gap-1.5">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold tracking-wide border shadow-xs ${
                                currentTableIsView
                                    ? 'bg-monokai-amethyst/15 text-monokai-amethyst border-monokai-amethyst/30'
                                    : 'bg-monokai-cyan/15 text-monokai-cyan border-monokai-cyan/30'
                            }`}>
                                {currentTableIsView ? <Layers size={11} /> : <Database size={11} />}
                                <span>{currentTableIsView ? 'VIEW' : 'TABLE'}</span>
                            </span>
                            <span className="font-mono text-xs font-bold text-monokai-fg bg-monokai-surface px-2 py-0.5 rounded border border-monokai-border shadow-xs">
                                {currentTable}
                            </span>
                        </div>
                    ) : undefined
                }
                actions={
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                        <ActionButton variant="secondary" size="sm" icon={GitBranch} disabled={loadingData} onClick={()=>useAppStore.getState().setActiveTab(Tab.ONTOLOGY)} title="使用当前数据表及已应用条件查看主图谱">在图谱中查看</ActionButton>
                        {onNavigateToDashboard && (
                            <ActionButton
                                variant="ghost"
                                size="sm"
                                icon={LayoutDashboard}
                                onClick={onNavigateToDashboard}
                                title="返回首页仪表盘"
                            >
                                仪表盘
                            </ActionButton>
                        )}
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
                }
            />

            {/* Content Toolbar */}
            <div className="px-4 py-2 bg-monokai-sidebar border-b border-monokai-border shrink-0 flex flex-col gap-2">
                <div className="flex flex-wrap justify-between items-center gap-2 min-h-8">
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Table Switcher with high contrast and distinct type styling */}
                        <div className={`flex items-center gap-2 h-8 px-2.5 rounded-md bg-monokai-surface border transition-colors shadow-xs ${
                            currentTableIsView
                                ? 'border-monokai-amethyst/40 hover:border-monokai-amethyst'
                                : 'border-monokai-cyan/40 hover:border-monokai-cyan'
                        }`}>
                            <span className={currentTableIsView ? 'text-monokai-amethyst' : 'text-monokai-cyan'}>
                                {currentTableIsView ? <Layers size={14} className="shrink-0" /> : <Database size={14} className="shrink-0" />}
                            </span>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                                currentTableIsView
                                    ? 'bg-monokai-amethyst/20 text-monokai-amethyst'
                                    : 'bg-monokai-cyan/20 text-monokai-cyan'
                            }`}>
                                {currentTableIsView ? 'VIEW' : 'TABLE'}
                            </span>
                            {tables && tables.length > 1 && onSelectTable ? (
                                <FormSelect
                                    value={currentTable}
                                    onChange={(e) => onSelectTable(e.target.value)}
                                    sizeVariant="sm"
                                    className="w-auto max-w-[13rem] border-0 bg-transparent font-mono font-bold text-monokai-fg hover:text-monokai-accent focus:text-monokai-accent cursor-pointer pr-6 text-xs"
                                    title="快速切换当前数据表"
                                >
                                    <option value="" className="bg-monokai-sidebar text-monokai-comment py-1">
                                        -- 全部数据表 (多表工作台) --
                                    </option>
                                    {tables.map(tbl => {
                                        const meta = activeCatalog.find(item => item.name === tbl);
                                        const isV = Boolean(meta?.isView);
                                        return (
                                            <option
                                                key={tbl}
                                                value={tbl}
                                                className={`bg-monokai-sidebar py-1 font-mono font-medium ${
                                                    isV ? 'text-monokai-amethyst' : 'text-monokai-cyan'
                                                }`}
                                            >
                                                {isV ? `[VIEW] ${tbl}` : `[TABLE] ${tbl}`}
                                            </option>
                                        );
                                    })}
                                </FormSelect>
                            ) : (
                                <h2 className="text-xs font-mono text-monokai-fg font-bold tracking-tight">{currentTable}</h2>
                            )}
                        </div>

                        {tables && tables.length > 1 && onSelectTable && (
                            <ActionButton
                                variant="ghost"
                                size="sm"
                                icon={Layers}
                                onClick={() => onSelectTable('')}
                                title="返回多表数据资源工作台"
                                className="text-monokai-comment hover:text-monokai-cyan"
                            >
                                多表总览
                            </ActionButton>
                        )}

                        <div className="hidden xl:flex items-center gap-1.5 border-l border-monokai-border pl-2.5">
                            {onNavigateToStructure && (
                                <NavJumpChip
                                    label="结构设计 ↗"
                                    title="查看及修改此表的 Schema 定义与索引约束"
                                    toneClass="text-monokai-yellow"
                                    icon={<Ruler size={11} />}
                                    onClick={() => onNavigateToStructure(currentTable)}
                                />
                            )}
                            {onNavigateToAnalysis && (
                                <NavJumpChip
                                    label="分析中心 ↗"
                                    title="在分析中心探查此表质量与分布"
                                    toneClass="text-monokai-green"
                                    icon={<Sparkles size={11} />}
                                    onClick={() => onNavigateToAnalysis(currentTable)}
                                />
                            )}
                            {onNavigateToMetrics && (
                                <NavJumpChip
                                    label="指标建模 ↗"
                                    title="基于此表创建业务指标模型"
                                    toneClass="text-monokai-amethyst"
                                    icon={<BarChart3 size={11} />}
                                    onClick={() => onNavigateToMetrics(currentTable)}
                                />
                            )}
                            {onNavigateToSql && (
                                <NavJumpChip
                                    label="在 SQL 中查询 ↗"
                                    title="在 SQL 工作台中查询分析此表"
                                    toneClass="text-monokai-cyan"
                                    icon={<Code size={11} />}
                                    onClick={() => onNavigateToSql(`SELECT * FROM "${currentTable}" LIMIT 50;`)}
                                />
                            )}
                            {onNavigateToDataFlow && (
                                <NavJumpChip
                                    label="数据流 ↗"
                                    title="在数据流大屏中查看此表上下游血缘"
                                    toneClass="text-monokai-pink"
                                    icon={<GitBranch size={11} />}
                                    onClick={() => onNavigateToDataFlow(currentTable)}
                                />
                            )}
                        </div>

                        {sortConfig.length > 0 && (
                            <div className="flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-monokai-surface border border-monokai-border text-meta font-mono text-monokai-fg">
                                <ArrowUpDown size={12} className="text-monokai-cyan shrink-0" />
                                <span className="truncate max-w-[150px]" title={sortConfig.map(s => `${s.key} ${s.direction}`).join(', ')}>
                                    {sortConfig.map(s => `${s.key} ${s.direction}`).join(', ')}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onHandleSort('', false);
                                        if (currentTable) onFetchTableData(currentTable, 0, pagination.limit, [], filterQuery);
                                        onAddNotification('已清除所有排序规则', 'info');
                                    }}
                                    className="text-monokai-comment hover:text-monokai-pink cursor-pointer ml-0.5 p-0.5"
                                    title="清除所有排序"
                                    aria-label="清除所有排序"
                                >
                                    <X size={11} />
                                </button>
                            </div>
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
                                        <div className="text-meta font-semibold text-monokai-fg flex items-center gap-1.5">
                                            <Columns size={13} className="text-monokai-cyan" />
                                            <span>显示 / 隐藏列 ({visibleColumns.length}/{tableColumns.length})</span>
                                        </div>
                                    </div>
                                    <SearchInput
                                        value={colMenuSearch}
                                        onChange={setColMenuSearch}
                                        onClear={() => setColMenuSearch('')}
                                        placeholder="搜索列名..."
                                        size="sm"
                                        className="w-full max-w-none"
                                    />
                                    <div className="flex items-center gap-1.5 text-2xs font-mono">
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
                                            className="flex-1 py-1 px-1.5 rounded-md bg-monokai-surface hover:bg-monokai-elevated text-monokai-cyan border border-monokai-border transition-colors cursor-pointer text-center"
                                        >
                                            重置
                                        </button>
                                    </div>
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
                                                            <Badge tone="warning" size="sm">PK</Badge>
                                                        )}
                                                        {colInfo && (
                                                            <span className="text-2xs font-mono px-1 rounded bg-monokai-surface text-monokai-comment">
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

                        <div className="flex items-center gap-0.5 rounded-md bg-monokai-surface border border-monokai-border p-0.5 h-8">
                            <button
                                type="button"
                                onClick={() => onDownloadData('csv')}
                                className="text-xs flex items-center gap-1 hover:bg-monokai-elevated px-2 py-1 rounded-md transition-all text-monokai-comment hover:text-monokai-fg cursor-pointer font-sans h-7"
                                title="导出为 CSV 文件"
                            >
                                <FileText size={13} className="text-monokai-green" /> CSV
                            </button>
                            <button
                                type="button"
                                onClick={() => onDownloadData('json')}
                                className="text-xs flex items-center gap-1 hover:bg-monokai-elevated px-2 py-1 rounded-md transition-all text-monokai-comment hover:text-monokai-fg cursor-pointer font-sans h-7"
                                title="导出为 JSON 文件"
                            >
                                <Code size={13} className="text-monokai-yellow" /> JSON
                            </button>
                            <button
                                type="button"
                                onClick={() => onDownloadData('parquet')}
                                className="text-xs flex items-center gap-1 hover:bg-monokai-elevated px-2 py-1 rounded-md text-monokai-comment hover:text-monokai-fg transition-all cursor-pointer font-sans h-7"
                                title="导出为 Apache Parquet 文件"
                            >
                                <Database size={13} className="text-monokai-cyan" /> Parquet
                            </button>
                            {onShowExportModal && (
                                <button
                                    type="button"
                                    onClick={onShowExportModal}
                                    className="text-xs flex items-center gap-1 hover:bg-monokai-elevated px-2 py-1 rounded-md text-monokai-comment hover:text-monokai-fg transition-all cursor-pointer font-sans h-7"
                                    title="打开高级数据导出配置面板"
                                >
                                    <ExternalLink size={12} className="text-monokai-comment" /> 高级…
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {!showVisualFilter && dataViewMode === 'grid' && (
                    <div className="flex gap-2 items-center bg-monokai-surface border border-monokai-border px-3 py-1 rounded-md">
                        <span className="text-xs font-semibold text-monokai-fg flex items-center gap-1.5 pl-0.5 font-mono shrink-0">
                            <Filter size={14} className="text-monokai-comment" /> WHERE
                        </span>
                        <FormInput
                            className="flex-1 border-0 bg-transparent shadow-none focus:ring-0"
                            sizeVariant="sm"
                            fontVariant="mono"
                            placeholder="可选过滤条件，如: id > 5 AND status = 'active'（留空并应用 = 全表）"
                            value={filterDraft}
                            onChange={(e) => setFilterDraft(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') applyFilterCondition();
                            }}
                        />
                        <ActionButton
                            variant="secondary"
                            size="sm"
                            icon={Check}
                            onClick={() => applyFilterCondition()}
                            title="将上方条件应用到当前表；条件为空时恢复全表浏览"
                        >
                            应用
                        </ActionButton>
                        {(filterDraft || filterQuery) && (
                            <IconButton
                                label="清空过滤并显示全表"
                                icon={X}
                                size="sm"
                                onClick={clearFilterCondition}
                                className="!h-7 !w-7"
                            />
                        )}
                    </div>
                )}

                {showVisualFilter && dataViewMode === 'grid' && (
                    <div className="bg-monokai-surface border border-monokai-border p-3 rounded-lg flex flex-col gap-2.5">
                        <div className="flex justify-between items-center pb-1.5 border-b border-monokai-border">
                            <span className="text-xs font-semibold text-monokai-fg flex items-center gap-1.5">
                                <SlidersHorizontal size={13} className="text-monokai-comment" /> 可视化过滤规则
                            </span>
                            <ActionButton variant="secondary" size="sm" icon={Plus} onClick={addFilterRule}>
                                添加条件
                            </ActionButton>
                        </div>
                        {visualRules.length === 0 ? (
                            <div className="text-center py-4 text-xs text-monokai-comment">
                                尚未添加过滤条件，点击「添加条件」以构建结构化查询
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                {visualRules.map(rule => (
                                    <div key={rule.id} className="flex flex-wrap sm:flex-nowrap gap-2 items-center bg-monokai-bg p-2 rounded-md border border-monokai-border">
                                        <FormSelect
                                            value={rule.column}
                                            onChange={e => updateFilterRule(rule.id, { column: e.target.value })}
                                            sizeVariant="sm"
                                            className="w-auto font-mono"
                                        >
                                            {tableColumns.map(col => <option key={col} value={col}>{col}</option>)}
                                        </FormSelect>
                                        <FormSelect
                                            value={rule.operator}
                                            onChange={e => updateFilterRule(rule.id, { operator: e.target.value })}
                                            sizeVariant="sm"
                                            className="w-auto font-mono"
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
                                        </FormSelect>
                                        {rule.operator !== 'IS NULL' && rule.operator !== 'IS NOT NULL' && (
                                            <FormInput
                                                type="text"
                                                value={rule.value}
                                                onChange={e => updateFilterRule(rule.id, { value: e.target.value })}
                                                placeholder="输入匹配值…"
                                                sizeVariant="sm"
                                                fontVariant="mono"
                                                className="flex-1"
                                            />
                                        )}
                                        <IconButton
                                            label="删除此规则"
                                            icon={X}
                                            size="sm"
                                            tone="danger"
                                            onClick={() => removeFilterRule(rule.id)}
                                            className="!h-7 !w-7"
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="flex justify-end gap-2 border-t border-monokai-border pt-2 mt-1">
                            <ActionButton
                                variant="ghost"
                                size="sm"
                                onClick={clearFilterCondition}
                            >
                                清空规则
                            </ActionButton>
                            <ActionButton variant="primary" size="sm" onClick={applyVisualFilters}>
                                应用过滤
                            </ActionButton>
                        </div>
                    </div>
                )}
            </div>

            {/* Diagnostic Context Banner from Dashboard/External Workflow */}
            {filterQuery.trim() && (
                <InlineAlert
                    tone="warning"
                    title="过滤条件已生效"
                    className="mx-4 mt-2 mb-1 shrink-0"
                >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <code className="px-1.5 py-0.5 rounded bg-monokai-bg/60 border border-monokai-yellow/20 font-mono text-meta text-monokai-fg truncate max-w-full">
                            {filterQuery}
                        </code>
                        <div className="flex items-center gap-2 shrink-0">
                            {onNavigateToSql && (
                                <ActionButton
                                    variant="secondary"
                                    size="sm"
                                    icon={ExternalLink}
                                    onClick={() => onNavigateToSql(`SELECT * FROM "${currentTable}" WHERE ${filterQuery};`)}
                                    title="将此过滤条件转化为完整 SQL 并在编辑器中执行"
                                >
                                    在 SQL 中查看
                                </ActionButton>
                            )}
                            <ActionButton
                                variant="ghost"
                                size="sm"
                                icon={X}
                                onClick={clearFilterCondition}
                                title="清除当前过滤条件"
                            >
                                清除过滤
                            </ActionButton>
                        </div>
                    </div>
                </InlineAlert>
            )}

            <div className="flex-1 overflow-auto bg-monokai-bg custom-scrollbar min-h-0">
                {loadingData ? (
                    <WorkbenchLoadingState message="正在分析与装载数据…" description="分页拉取当前表记录与元数据" />
                ) : dataViewMode === 'profile' ? (
                    <div className="p-3 sm:p-4 space-y-4">
                        {/* 1. Top Table Profiling Telemetry HUD */}
                        <section aria-label="数据画像全景雷达" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {/* Card 1: 资产规模 */}
                            <div className="relative overflow-hidden bg-monokai-surface border border-monokai-border p-3.5 shadow-xs rounded-md">
                                <div className="flex items-center justify-between">
                                    <span className="text-2xs font-mono uppercase tracking-wider text-monokai-comment">
                                        数据资产结构 / SCHEMA SCOPE
                                    </span>
                                    <Layers size={15} className="text-monokai-blue opacity-80" />
                                </div>
                                <div className="mt-2">
                                    <div className="font-mono text-base font-bold text-monokai-cyan">
                                        {profileSummary.totalCols} <span className="text-xs font-normal text-monokai-comment">列总计</span>
                                    </div>
                                    <div className="mt-1 flex flex-wrap gap-1.5 text-2xs font-mono text-monokai-comment">
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
                                    <span className="text-2xs font-mono uppercase tracking-wider text-monokai-comment">
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
                                            className={`font-mono text-base font-bold ${
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
                                            className={`text-2xs font-mono font-bold uppercase px-1.5 py-0.2 rounded border border-monokai-border ${
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
                                    <span className="text-2xs font-mono uppercase tracking-wider text-monokai-comment">
                                        约束与基数 / CONSTRAINTS & KEYS
                                    </span>
                                    <Key size={15} className="text-monokai-yellow opacity-80" />
                                </div>
                                <div className="mt-2">
                                    <div className="font-mono text-xs font-bold text-monokai-fg truncate">
                                        {pkColumn ? (
                                            <span className="text-monokai-yellow flex items-center gap-1">
                                                <Key size={12} /> {pkColumn.name} <span className="text-2xs text-monokai-comment font-normal">(主键)</span>
                                            </span>
                                        ) : (
                                            <span className="text-monokai-comment text-xs font-normal">无明确主键约束</span>
                                        )}
                                    </div>
                                    <div className="mt-1.5 text-meta text-monokai-comment truncate font-mono">
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
                                    <span className="text-2xs font-mono uppercase tracking-wider text-monokai-comment">
                                        画像工具箱 / PROFILE TOOLBOX
                                    </span>
                                    <Sparkles size={15} className="text-monokai-pink opacity-80" />
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                    <ActionButton
                                        variant="secondary"
                                        size="sm"
                                        icon={RefreshCw}
                                        onClick={() => onFetchProfileData(currentTable)}
                                        title="重新执行 SUMMARIZE 分析"
                                        className="flex-1"
                                    >
                                        重新计算
                                    </ActionButton>
                                    <ActionButton
                                        variant="secondary"
                                        size="sm"
                                        icon={Code}
                                        onClick={() => {
                                            const sql = `SUMMARIZE SELECT * FROM "${currentTable}";`;
                                            navigator.clipboard.writeText(sql);
                                            useSqlEditorStore.getState().updateActiveTab({ code: sql });
                                            onAddNotification('已将画像 SQL 载入 SQL 编辑器并复制', 'success');
                                        }}
                                        title="复制 SUMMARIZE SQL"
                                    >
                                        SQL
                                    </ActionButton>
                                </div>
                            </div>
                        </section>

                        {/* 2. Search, Filter & Sorter Toolbar */}
                        <section aria-label="画像筛选与排序" className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-monokai-surface border border-monokai-border p-2.5 rounded-md">
                            <div className="flex flex-wrap items-center gap-2">
                                <SearchInput
                                    value={profileSearch}
                                    onChange={setProfileSearch}
                                    onClear={() => setProfileSearch('')}
                                    placeholder="过滤字段名 / 类型…"
                                    size="sm"
                                    className="w-44 sm:w-52"
                                />

                                <div className="flex items-center gap-1 bg-monokai-bg border border-monokai-border p-0.5 rounded-md text-meta font-mono">
                                    <button
                                        type="button"
                                        onClick={() => setProfileTypeFilter('ALL')}
                                        className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                                            profileTypeFilter === 'ALL' ? 'bg-monokai-surface text-monokai-fg font-bold' : 'text-monokai-comment hover:text-monokai-fg'
                                        }`}
                                    >
                                        全部 ({profileSummary.totalCols})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setProfileTypeFilter('NUMERIC')}
                                        className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                                            profileTypeFilter === 'NUMERIC' ? 'bg-monokai-surface text-monokai-cyan font-bold' : 'text-monokai-comment hover:text-monokai-cyan'
                                        }`}
                                    >
                                        数值 ({profileSummary.numericCount})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setProfileTypeFilter('TEXT')}
                                        className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                                            profileTypeFilter === 'TEXT' ? 'bg-monokai-surface text-monokai-green font-bold' : 'text-monokai-comment hover:text-monokai-green'
                                        }`}
                                    >
                                        文本 ({profileSummary.textCount})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setProfileTypeFilter('TIME')}
                                        className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                                            profileTypeFilter === 'TIME' ? 'bg-monokai-surface text-monokai-yellow font-bold' : 'text-monokai-comment hover:text-monokai-yellow'
                                        }`}
                                    >
                                        时间 ({profileSummary.timeCount})
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="text-meta text-monokai-comment flex items-center gap-1 font-mono">
                                    <ArrowUpDown size={12} /> 排序:
                                </span>
                                <FormSelect
                                    value={profileSort}
                                    onChange={e => setProfileSort(e.target.value as typeof profileSort)}
                                    sizeVariant="sm"
                                    className="w-auto font-mono"
                                >
                                    <option value="DEFAULT">默认结构序</option>
                                    <option value="NULLS_DESC">缺失率最高</option>
                                    <option value="UNIQUE_DESC">唯一值基数最高</option>
                                    <option value="NAME_ASC">列名 A-Z</option>
                                </FormSelect>
                            </div>
                        </section>

                        {/* 3. Column Profile Cards Grid */}
                        {filteredProfileData.length === 0 ? (
                            <div className="py-16 text-center bg-monokai-surface border border-monokai-border p-6 rounded-md">
                                <LayoutDashboard size={36} className="mx-auto mb-2 text-monokai-comment/40" />
                                <p className="text-xs font-semibold text-monokai-fg">未匹配到任何字段画像</p>
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
                                                                    className="px-1.5 py-0.2 rounded bg-monokai-surface border border-monokai-border text-monokai-yellow text-2xs font-mono font-bold flex items-center gap-0.5 shrink-0"
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
                                                        className={`shrink-0 text-2xs font-mono px-2 py-0.5 rounded border border-monokai-border uppercase tracking-wider flex items-center gap-1 ${
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
                                                    <div className="flex justify-between text-2xs font-mono text-monokai-comment mb-1">
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
                                                        <div className="text-2xs uppercase text-monokai-comment tracking-wider">唯一值基数</div>
                                                        <div className="font-bold text-monokai-amethyst mt-0.5 truncate">
                                                            {Number(col.approx_unique || 0).toLocaleString()}
                                                        </div>
                                                    </div>

                                                    <div className="bg-monokai-bg p-2 rounded-md border border-monokai-border/60">
                                                        <div className="text-2xs uppercase text-monokai-comment tracking-wider">非空计数</div>
                                                        <div className="font-bold text-monokai-fg mt-0.5 truncate">
                                                            {col.count !== undefined && col.count !== null ? Number(col.count).toLocaleString() : '--'}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Range & Quantiles */}
                                                {(col.min !== null || col.max !== null) && (
                                                    <div className="bg-monokai-bg p-2.5 text-meta font-mono space-y-1 rounded-md border border-monokai-border/60">
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
                                                    className="inline-flex items-center gap-1 text-meta text-monokai-comment hover:text-monokai-fg transition-colors"
                                                    title="在网格视图中筛选此列非空"
                                                >
                                                    <Filter size={11} /> 筛选非空
                                                </button>

                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDrilldownSql(col.column_name)}
                                                        className="inline-flex items-center gap-1 text-meta text-monokai-comment hover:text-monokai-fg transition-colors"
                                                        title="生成频次分析 SQL"
                                                    >
                                                        <BarChart3 size={11} /> 频次分析
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => void handleCopyColumnName(col.column_name, e)}
                                                        className="inline-flex items-center gap-1 text-meta text-monokai-comment hover:text-monokai-fg transition-colors"
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
                    <div className="data-tab-grid inline-block align-top font-mono text-xs">
                        <table
                            className="border-collapse"
                            style={{ width: tableAutoWidth, tableLayout: 'fixed' }}
                        >
                            <colgroup>
                                <col style={{ width: 40 }} />
                                <col style={{ width: 40 }} />
                                {visibleColumns.map((col) => {
                                    const width = colWidths[col] ?? autoColWidths[col] ?? 120;
                                    return <col key={col} style={{ width, minWidth: width, maxWidth: width }} />;
                                })}
                            </colgroup>
                            <thead className="sticky top-0 z-10 select-none">
                                <tr className="h-10 border-b border-monokai-border/40">
                                    <th className="p-2 w-10 sticky left-0 z-20 font-semibold text-monokai-comment/45 bg-monokai-bg" style={{ textAlign: 'center' }}>
                                        {pkColumn && (
                                            <input
                                                type="checkbox"
                                                className="cursor-pointer rounded border-monokai-border bg-monokai-surface text-monokai-green focus:ring-monokai-accent"
                                                onChange={(e) => onHandleSelectAll(e.target.checked)}
                                                checked={tableData.length > 0 && tableData.every(r => selectedRows.has(r[pkColumn.name]))}
                                            />
                                        )}
                                    </th>
                                    <th className="p-2 w-10 sticky left-10 z-20 text-monokai-comment/45 bg-monokai-bg" style={{ textAlign: 'center' }}></th>
                                    {visibleColumns.map((col, idx) => {
                                        const colInfo = schema.find(s => s.name === col);
                                        const isSticky = idx === 0 && pkColumn?.name === col;
                                        const colSort = sortConfig.find(s => s.key === col);
                                        const sortIndex = sortConfig.findIndex(s => s.key === col);

                                        return (
                                            <th
                                                key={col}
                                                style={getColumnWidthStyle(col)}
                                                className={`relative px-2 py-1.5 cursor-pointer transition-colors duration-150 group/th align-middle overflow-hidden ${
                                                    isSticky ? 'sticky left-20 z-20 bg-monokai-bg shadow-[2px_0_6px_rgba(0,0,0,0.3)]' : ''
                                                }`}
                                                onClick={(e) => handleSort(col, e)}
                                            >
                                                <div className="flex flex-col items-center justify-center gap-0.5 min-w-0 w-full leading-tight px-1">
                                                    <div className="flex items-center justify-center gap-1 min-w-0 max-w-full">
                                                        <span
                                                            className="truncate font-medium text-[11px] tracking-tight text-monokai-fg-muted/80 group-hover/th:text-monokai-fg transition-colors max-w-full"
                                                            title={col}
                                                        >
                                                            {col}
                                                        </span>
                                                        {colSort && (
                                                            <span className="text-monokai-comment/80 text-[9px] font-black shrink-0 tabular-nums flex items-center gap-0.5">
                                                                {colSort.direction === 'ASC' ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                                                                {sortConfig.length > 1 && <span className="opacity-80">#{sortIndex + 1}</span>}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {colInfo && (
                                                        <span
                                                            className={getTypeBadgeStyle(colInfo.type)}
                                                            title={colInfo.type}
                                                        >
                                                            {colInfo.type}
                                                        </span>
                                                    )}
                                                </div>
                                                <div
                                                    className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-monokai-fg/[0.04] active:bg-monokai-yellow/15 transition-all opacity-0 group-hover/th:opacity-100 z-30 flex items-center justify-center"
                                                    onMouseDown={(e) => handleResizeMouseDown(col, e)}
                                                >
                                                    <div className="w-px h-3 bg-monokai-border/60" />
                                                </div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody className="font-mono">
                                {tableData.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={visibleColumns.length + 2}
                                            className="py-16 text-center text-monokai-comment bg-monokai-bg"
                                        >
                                            <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                                                <TableIcon size={28} className="opacity-30 text-monokai-comment" />
                                                <span className="text-xs font-semibold text-monokai-fg">
                                                    {filterQuery.trim() ? '未找到符合过滤条件的记录' : '当前数据表尚无记录'}
                                                </span>
                                                <span className="text-meta text-monokai-comment leading-relaxed">
                                                    {filterQuery.trim() ? '可尝试调整或清除上方 WHERE 过滤条件以恢复全表记录' : '可通过上方「插入行」添加新数据，或在 SQL 工作台中写入'}
                                                </span>
                                                {filterQuery.trim() ? (
                                                    <ActionButton variant="secondary" size="sm" icon={X} onClick={clearFilterCondition} className="mt-2">
                                                        清除过滤条件
                                                    </ActionButton>
                                                ) : (
                                                    <ActionButton variant="secondary" size="sm" icon={ListPlus} onClick={() => { setInsertInitialData(undefined); setShowInsertRowModal(true); }} className="mt-2">
                                                        插入新数据行
                                                    </ActionButton>
                                                )}
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
                                        <td className="p-2 sticky left-0 z-10 bg-inherit" style={{ textAlign: 'center' }}>
                                            {pkColumn && (
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={(e) => onHandleSelectRow(pkVal, e.target.checked)}
                                                    className="cursor-pointer rounded border-monokai-border bg-monokai-surface text-monokai-green focus:ring-monokai-accent"
                                                />
                                            )}
                                        </td>
                                        <td className="p-2 sticky left-10 z-10 bg-inherit" style={{ textAlign: 'center' }}>
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

                                            return (
                                                <td
                                                    key={`${rowIdx}-${col}`}
                                                    style={getColumnWidthStyle(col)}
                                                    className={`px-2.5 py-1.5 text-[11.5px] leading-tight text-monokai-fg cursor-text relative align-middle ${
                                                        isNull ? 'italic' : ''
                                                    } ${
                                                        isSticky ? 'sticky left-20 z-10 bg-inherit shadow-[2px_0_6px_rgba(0,0,0,0.4)]' : ''
                                                    }`}
                                                    onDoubleClick={() => handleCellEdit(rowIdx, col, cellValue)}
                                                    onContextMenu={(e) => handleRowContextMenu(e, rowIdx, col, cellValue)}
                                                    title={cellValue === null || cellValue === undefined ? '' : String(cellValue)}
                                                >
                                                    <div className="flex w-full min-w-0 items-center justify-center">
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
                                                                 style={{ textAlign: 'center' }}
                                                            />
                                                        ) : isNull ? (
                                                            <span className="inline-flex items-center justify-center px-1.5 py-0.2 rounded-md text-2xs font-mono font-medium bg-monokai-surface text-monokai-pink border border-monokai-border">
                                                                NULL
                                                            </span>
                                                        ) : (
                                                            <span className={`block max-w-full truncate whitespace-nowrap text-center ${isNum ? 'tabular-nums' : ''}`}>
                                                                {displayVal}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                  );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            {dataViewMode === 'grid' && (
                <div className="px-4 py-2 border-t border-monokai-border bg-monokai-sidebar flex flex-wrap justify-between items-center text-xs text-monokai-comment shrink-0 font-sans shadow-xs gap-2">
                    <div className="flex items-center gap-3">
                        <span className="font-mono text-monokai-fg font-medium">共 {pagination.total.toLocaleString()} 条记录</span>
                        {selectedRows.size > 0 && (
                            <span className="px-2 py-0.5 text-meta bg-monokai-surface text-monokai-fg border border-monokai-border rounded-md font-mono font-medium flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-monokai-fg" />
                                <span>已选中 {selectedRows.size} 行</span>
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Page Size Selector */}
                        <div className="flex items-center gap-1.5 font-mono text-xs text-monokai-comment bg-monokai-surface border border-monokai-border py-0.5 px-2 rounded-md h-7 hover:border-monokai-border/80 transition-colors">
                            <span>每页:</span>
                            <select
                                value={pagination.limit}
                                onChange={(e) => {
                                    const newLimit = parseInt(e.target.value, 10);
                                    if (newLimit) {
                                        onFetchTableData(currentTable!, 0, newLimit, sortConfig, filterQuery);
                                    }
                                }}
                                className="bg-transparent text-monokai-fg font-semibold outline-none cursor-pointer focus:ring-0"
                            >
                                <option value={25} className="bg-monokai-sidebar text-monokai-fg">25</option>
                                <option value={50} className="bg-monokai-sidebar text-monokai-fg">50</option>
                                <option value={100} className="bg-monokai-sidebar text-monokai-fg">100</option>
                                <option value={200} className="bg-monokai-sidebar text-monokai-fg">200</option>
                            </select>
                        </div>

                        {/* First Page */}
                        <button
                            type="button"
                            onClick={() => onHandlePageChange(0)}
                            disabled={pagination.offset === 0}
                            className="h-7 w-7 flex items-center justify-center bg-monokai-surface border border-monokai-border rounded-md disabled:opacity-30 disabled:cursor-not-allowed hover:bg-monokai-elevated hover:text-monokai-fg text-monokai-comment transition-all cursor-pointer"
                            title="首页"
                        >
                            <ChevronsLeft size={14} />
                        </button>

                        {/* Prev Page */}
                        <button
                            type="button"
                            onClick={() => onHandlePageChange(Math.max(0, pagination.offset - pagination.limit))}
                            disabled={pagination.offset === 0}
                            className="h-7 px-2.5 flex items-center gap-1 bg-monokai-surface border border-monokai-border rounded-md disabled:opacity-30 disabled:cursor-not-allowed hover:bg-monokai-elevated hover:text-monokai-fg transition-all text-monokai-comment cursor-pointer text-xs"
                        >
                            <ChevronLeft size={14} /> 上一页
                        </button>

                        {/* Page Jump */}
                        <div className="h-7 flex items-center gap-1.5 font-mono text-xs text-monokai-fg bg-monokai-surface border border-monokai-border px-2.5 rounded-md hover:border-monokai-border/80 focus-within:border-monokai-accent/60 transition-colors">
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
                            type="button"
                            onClick={() => onHandlePageChange(pagination.offset + pagination.limit)}
                            disabled={pagination.offset + pagination.limit >= pagination.total}
                            className="h-7 px-2.5 flex items-center gap-1 bg-monokai-surface border border-monokai-border rounded-md disabled:opacity-30 disabled:cursor-not-allowed hover:bg-monokai-elevated hover:text-monokai-fg transition-all text-monokai-comment cursor-pointer text-xs"
                        >
                            下一页 <ChevronRight size={14} />
                        </button>

                        {/* Last Page */}
                        <button
                            type="button"
                            onClick={() => onHandlePageChange((totalPages - 1) * pagination.limit)}
                            disabled={pagination.offset + pagination.limit >= pagination.total}
                            className="h-7 w-7 flex items-center justify-center bg-monokai-surface border border-monokai-border rounded-md disabled:opacity-30 disabled:cursor-not-allowed hover:bg-monokai-elevated hover:text-monokai-fg text-monokai-comment transition-all cursor-pointer"
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
                            className="w-full text-left px-3 py-1.5 hover:bg-monokai-surface hover:text-monokai-fg flex items-center gap-2 transition-colors cursor-pointer text-xs"
                        >
                            <Copy size={13} className="text-monokai-comment" /> 复制单元格值
                        </button>
                        <button
                            onClick={() => {
                                setPreviewCell({ columnName: contextMenu.col, val: contextMenu.val });
                                closeContextMenu();
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-monokai-surface hover:text-monokai-fg flex items-center gap-2 transition-colors cursor-pointer text-xs"
                        >
                            <Eye size={13} className="text-monokai-comment" /> 查看大图 / 明细
                        </button>
                    </div>
                    <div className="py-0.5">
                        <button
                            onClick={filterByCellValue}
                            className="w-full text-left px-3 py-1.5 hover:bg-monokai-surface hover:text-monokai-fg flex items-center gap-2 transition-colors cursor-pointer text-xs"
                        >
                            <Filter size={13} className="text-monokai-green" /> 以此值快速过滤 (=)
                        </button>
                        <button
                            onClick={filterExcludeCellValue}
                            className="w-full text-left px-3 py-1.5 hover:bg-monokai-surface hover:text-monokai-fg flex items-center gap-2 transition-colors cursor-pointer text-xs"
                        >
                            <Filter size={13} className="text-monokai-pink" /> 排除此值过滤 (!=)
                        </button>
                        <button
                            onClick={() => sortColumnFromMenu('ASC')}
                            className="w-full text-left px-3 py-1.5 hover:bg-monokai-surface hover:text-monokai-fg flex items-center gap-2 transition-colors cursor-pointer text-xs"
                        >
                            <ArrowUp size={13} className="text-monokai-cyan" /> 此列升序排列 (ASC)
                        </button>
                        <button
                            onClick={() => sortColumnFromMenu('DESC')}
                            className="w-full text-left px-3 py-1.5 hover:bg-monokai-surface hover:text-monokai-fg flex items-center gap-2 transition-colors cursor-pointer text-xs"
                        >
                            <ArrowDown size={13} className="text-monokai-cyan" /> 此列降序排列 (DESC)
                        </button>
                        <button
                            onClick={viewColumnInProfile}
                            className="w-full text-left px-3 py-1.5 hover:bg-monokai-surface hover:text-monokai-fg flex items-center gap-2 transition-colors cursor-pointer text-xs"
                        >
                            <BarChart3 size={13} className="text-monokai-yellow" /> 查看此列画像分布
                        </button>
                        <button
                            onClick={hideColumnFromMenu}
                            className="w-full text-left px-3 py-1.5 hover:bg-monokai-surface hover:text-monokai-fg flex items-center gap-2 transition-colors cursor-pointer text-xs"
                        >
                            <Columns size={13} className="text-monokai-comment" /> 隐藏此列
                        </button>
                    </div>
                    <div className="py-0.5">
                        <button
                            onClick={copySelectedRowsCsv}
                            className="w-full text-left px-3 py-1.5 hover:bg-monokai-surface hover:text-monokai-fg flex items-center gap-2 transition-colors cursor-pointer text-xs"
                        >
                            <FileText size={13} className="text-monokai-comment" /> {selectedRows.size > 0 ? `复制选中 ${selectedRows.size} 行为 CSV` : '复制本行为 CSV'}
                        </button>
                        <button
                            onClick={copyRowJson}
                            className="w-full text-left px-3 py-1.5 hover:bg-monokai-surface hover:text-monokai-fg flex items-center gap-2 transition-colors cursor-pointer text-xs"
                        >
                            <Code size={13} className="text-monokai-comment" /> 复制为 JSON
                        </button>
                        <button
                            onClick={copyRowSql}
                            className="w-full text-left px-3 py-1.5 hover:bg-monokai-surface hover:text-monokai-fg flex items-center gap-2 transition-colors cursor-pointer text-xs"
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
                                className="w-full text-left px-3 py-1.5 hover:bg-monokai-surface text-monokai-yellow hover:text-monokai-yellow flex items-center gap-2 transition-colors cursor-pointer text-meta"
                            >
                                <Key size={13} className="text-monokai-yellow" /> 配置主键以开启行编辑 ↗
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Cell Preview Modal */}
            <ModalShell
                open={Boolean(previewCell)}
                onClose={() => setPreviewCell(null)}
                title={previewCell ? `字段明细: ${previewCell.columnName}` : '字段明细'}
                icon={Database}
                iconColor="text-monokai-green"
                size="sm"
                badge={previewCell ? `${String(previewCell.val ?? '').length} 字符` : undefined}
                footer={
                    previewCell ? (
                        <div className="flex items-center justify-end gap-2 w-full">
                            <ActionButton variant="secondary" size="sm" onClick={() => setPreviewCell(null)}>
                                关闭
                            </ActionButton>
                            <ActionButton
                                variant="primary"
                                size="sm"
                                icon={Copy}
                                onClick={() => {
                                    navigator.clipboard.writeText(
                                        typeof previewCell.val === 'object'
                                            ? JSON.stringify(previewCell.val, (k, v) => (typeof v === 'bigint' ? v.toString() : v), 2)
                                            : String(previewCell.val),
                                    );
                                    setPreviewCell(null);
                                    onAddNotification('已复制单元格内容', 'success');
                                }}
                            >
                                复制内容
                            </ActionButton>
                        </div>
                    ) : null
                }
            >
                {previewCell && (() => {
                    const valStr = String(previewCell.val);
                    if (
                        valStr.startsWith('data:image/') ||
                        (valStr.length > 50 &&
                            valStr.match(/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)?$/) &&
                            (valStr.slice(0, 100).includes('PNG') || valStr.slice(0, 100).includes('JFIF')))
                    ) {
                        const src = valStr.startsWith('data:image/') ? valStr : `data:image/png;base64,${valStr}`;
                        return (
                            <div className="flex justify-center py-4 bg-monokai-surface rounded-md border border-monokai-border">
                                <img src={src} alt="单元格图片预览" className="max-h-64 object-contain rounded-md" />
                            </div>
                        );
                    }
                    try {
                        if (typeof previewCell.val === 'object' && previewCell.val !== null) {
                            return (
                                <pre className="text-xs text-monokai-fg font-mono whitespace-pre-wrap leading-relaxed">
                                    {JSON.stringify(previewCell.val, (k, v) => (typeof v === 'bigint' ? v.toString() : v), 2)}
                                </pre>
                            );
                        }
                        const parsed = JSON.parse(valStr);
                        return (
                            <pre className="text-xs text-monokai-fg font-mono whitespace-pre-wrap leading-relaxed">
                                {JSON.stringify(parsed, (k, v) => (typeof v === 'bigint' ? v.toString() : v), 2)}
                            </pre>
                        );
                    } catch {
                        return (
                            <pre className="text-xs text-monokai-fg font-mono whitespace-pre-wrap leading-relaxed">{valStr}</pre>
                        );
                    }
                })()}
            </ModalShell>

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

            {expandedRowIdx !== null && (
                <RowDetailPanel
                    isOpen={expandedRowIdx !== null}
                    expandedRowIdx={expandedRowIdx}
                    tableData={tableData}
                    onClose={() => onSetExpandedRowIdx(null)}
                    onNavigatePrev={() => onSetExpandedRowIdx(Math.max(0, (expandedRowIdx ?? 0) - 1))}
                    onNavigateNext={() => onSetExpandedRowIdx(Math.min(tableData.length - 1, (expandedRowIdx ?? 0) + 1))}
                />
            )}
        </PageShell>
    );
};

export default DataTab;
