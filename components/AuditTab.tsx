import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  ScrollText,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Table as TableIcon,
  Calendar,
  Database,
  Zap,
  RotateCcw,
  Download,
  RefreshCw,
  Play,
  Layers,
  Activity,
  ShieldAlert,
  Clock,
  FileCode2,
  FileSpreadsheet,
  FileJson,
  Hash,
} from 'lucide-react';
import {
  PageHeader,
  Toolbar,
  SearchInput,
  ActionButton,
  SegmentedTabs,
  EmptyState,
} from './ui/Workbench';
import { CodeHighlightBlock } from './ui/CodeHighlightBlock';
import { useAppStore } from '../hooks/store/useAppStore';
import { useSqlEditorStore } from '../hooks/store/useSqlEditorStore';
import { toastService } from '../services/toastService';
import { Tab } from '../types';

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
  onRefresh?: () => void;
}

type CategoryFilter = 'ALL' | 'DDL' | 'DML' | 'DESTRUCTIVE';
type TimeFilter = 'ALL' | 'TODAY' | '7D' | '30D';

function formatRelativeTime(dateStr: string): string {
  try {
    const time = new Date(dateStr).getTime();
    if (isNaN(time)) return dateStr;
    const diff = Date.now() - time;
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return '刚刚';
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins} 分钟前`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} 小时前`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return '昨天';
    if (days < 30) return `${days} 天前`;
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return dateStr;
  }
}

export const AuditTab: React.FC<AuditTabProps> = ({ auditLogs, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');
  const [selectedTable, setSelectedTable] = useState('ALL');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('ALL');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportTriggerRef = useRef<HTMLButtonElement>(null);
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const { setActiveTab } = useAppStore();

  useEffect(() => {
    if (!showExportMenu) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setShowExportMenu(false);
      setTimeout(() => exportTriggerRef.current?.focus(), 0);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showExportMenu]);

  // ── KPI Metrics Calculation ───────────────────────────────────────
  const kpiStats = useMemo(() => {
    let ddlCount = 0;
    let dmlCount = 0;
    let destructiveCount = 0;
    let totalRows = 0;
    const tablesSet = new Set<string>();

    auditLogs.forEach((log) => {
      const op = (log.operation_type || '').toUpperCase();
      if (log.target_table) tablesSet.add(log.target_table);
      totalRows += Number(log.affected_rows) || 0;

      if (/^(CREATE|ALTER|DROP|TRUNCATE|RENAME)/i.test(op)) {
        ddlCount++;
      }
      if (/^(INSERT|UPDATE|DELETE|MERGE)/i.test(op)) {
        dmlCount++;
      }
      if (/DROP|DELETE|TRUNCATE/i.test(op)) {
        destructiveCount++;
      }
    });

    return {
      total: auditLogs.length,
      ddl: ddlCount,
      dml: dmlCount,
      destructive: destructiveCount,
      totalRows,
      activeTables: tablesSet.size,
    };
  }, [auditLogs]);

  // ── Extract unique tables for filter ───────────────────────────────
  const availableTables = useMemo(() => {
    const tableCounts = new Map<string, number>();
    auditLogs.forEach((log) => {
      if (log.target_table) {
        tableCounts.set(log.target_table, (tableCounts.get(log.target_table) || 0) + 1);
      }
    });
    return Array.from(tableCounts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([table, count]) => ({ table, count }));
  }, [auditLogs]);

  // ── Filter logs ───────────────────────────────────────────────────
  const filteredLogs = useMemo(() => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const search = searchTerm.trim().toLowerCase();

    return auditLogs.filter((log) => {
      const op = (log.operation_type || '').toUpperCase();
      const details = (log.details || '').toLowerCase();
      const table = (log.target_table || '').toLowerCase();

      // Search matching
      if (search) {
        const matches =
          details.includes(search) ||
          table.includes(search) ||
          op.toLowerCase().includes(search);
        if (!matches) return false;
      }

      // Category matching
      if (categoryFilter === 'DDL') {
        if (!/^(CREATE|ALTER|DROP|TRUNCATE|RENAME)/i.test(op)) return false;
      } else if (categoryFilter === 'DML') {
        if (!/^(INSERT|UPDATE|DELETE|MERGE)/i.test(op)) return false;
      } else if (categoryFilter === 'DESTRUCTIVE') {
        if (!/DROP|DELETE|TRUNCATE/i.test(op)) return false;
      }

      // Table matching
      if (selectedTable !== 'ALL' && log.target_table !== selectedTable) {
        return false;
      }

      // Time filter matching
      if (timeFilter !== 'ALL') {
        const logTimestamp = new Date(log.log_time).getTime();
        if (isNaN(logTimestamp)) return true;
        const diff = now - logTimestamp;

        if (timeFilter === 'TODAY' && diff > oneDay) return false;
        if (timeFilter === '7D' && diff > 7 * oneDay) return false;
        if (timeFilter === '30D' && diff > 30 * oneDay) return false;
      }

      return true;
    });
  }, [auditLogs, searchTerm, categoryFilter, selectedTable, timeFilter]);

  // ── Pagination Calculation ────────────────────────────────────────
  const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  // ── Handlers ──────────────────────────────────────────────────────
  const toggleRow = useCallback((id: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedRows(new Set(paginatedLogs.map((l) => l.id)));
  }, [paginatedLogs]);

  const collapseAll = useCallback(() => {
    setExpandedRows(new Set());
  }, []);

  const handleCopy = useCallback((id: number, text: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedId(id);
    toastService.success('SQL 已复制到剪贴板');
    setTimeout(() => setCopiedId(null), 1800);
  }, []);

    const handleReplayInSql = useCallback(
    (sql: string, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      useSqlEditorStore.getState().updateActiveTab({ code: sql });
      setActiveTab(Tab.SQL);
      toastService.info('SQL 查询已载入编辑器');
    },
    [setActiveTab],
  );

  const generateRollbackSql = useCallback((opType: string, targetTable: string | null, details: string) => {
    const op = (opType || '').toUpperCase();
    const table = targetTable ? `"${targetTable}"` : null;
    if (op.includes('CREATE') && table) {
      return `-- 自动逆向回滚脚本：删除已创建的表\nDROP TABLE IF EXISTS ${table};`;
    }
    if (op.includes('ALTER') && table) {
      const addMatch = details.match(/ADD\s+(?:COLUMN\s+)?["']?([a-zA-Z0-9_]+)["']?/i);
      if (addMatch) {
        return `-- 自动逆向回滚脚本：移除新增的字段\nALTER TABLE ${table} DROP COLUMN IF EXISTS "${addMatch[1]}";`;
      }
    }
    if (op.includes('INSERT') && table) {
      return `-- 自动逆向回滚参考模板：\n-- 针对表 ${table} 请根据对应主键条件执行回滚清理：\n-- DELETE FROM ${table} WHERE id = ...;`;
    }
    return null;
  }, []);

  const resetFilters = useCallback(() => {
    setSearchTerm('');
    setCategoryFilter('ALL');
    setSelectedTable('ALL');
    setTimeFilter('ALL');
    setCurrentPage(1);
  }, []);

  const isFilterActive =
    searchTerm !== '' ||
    categoryFilter !== 'ALL' ||
    selectedTable !== 'ALL' ||
    timeFilter !== 'ALL';

  // ── Export functions ──────────────────────────────────────────────
  const handleExportCsv = useCallback(() => {
    try {
      const headers = ['ID', 'Log Time', 'Operation', 'Target Table', 'Affected Rows', 'SQL Statement'];
      const rows = filteredLogs.map((l) => [
        l.id,
        `"${l.log_time}"`,
        `"${l.operation_type}"`,
        `"${l.target_table || ''}"`,
        l.affected_rows,
        `"${(l.details || '').replace(/"/g, '""')}"`,
      ]);
      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `duckdb_audit_log_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShowExportMenu(false);
      toastService.success(`已成功导出 ${filteredLogs.length} 条审计日志 (CSV)`);
    } catch (err) {
      toastService.error('导出失败', String(err));
    }
  }, [filteredLogs]);

  const handleExportJson = useCallback(() => {
    try {
      const jsonStr = JSON.stringify(filteredLogs, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `duckdb_audit_log_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShowExportMenu(false);
      toastService.success(`已成功导出 ${filteredLogs.length} 条审计日志 (JSON)`);
    } catch (err) {
      toastService.error('导出失败', String(err));
    }
  }, [filteredLogs]);

  // ── Badge Style Helper ────────────────────────────────────────────
  const getOperationBadge = (type: string) => {
    const clean = (type || '').toUpperCase();
    if (clean.includes('INSERT')) {
      return {
        className: 'bg-emerald-500/10 text-emerald-400 border-monokai-border-subtle',
        label: 'INSERT',
      };
    }
    if (clean.includes('UPDATE')) {
      return {
        className: 'bg-amber-500/10 text-amber-400 border-monokai-border-subtle',
        label: 'UPDATE',
      };
    }
    if (clean.includes('DELETE')) {
      return {
        className: 'bg-rose-500/10 text-rose-400 border-monokai-border-subtle font-medium',
        label: 'DELETE',
      };
    }
    if (clean.includes('DROP')) {
      return {
        className: 'bg-rose-500/15 text-rose-400 border-monokai-border-subtle font-semibold',
        label: 'DROP',
      };
    }
    if (clean.includes('TRUNCATE')) {
      return {
        className: 'bg-rose-500/15 text-rose-400 border-monokai-border-subtle font-semibold',
        label: 'TRUNCATE',
      };
    }
    if (clean.includes('CREATE')) {
      return {
        className: 'bg-sky-500/10 text-sky-400 border-monokai-border-subtle',
        label: 'CREATE',
      };
    }
    if (clean.includes('ALTER')) {
      return {
        className: 'bg-sky-500/10 text-sky-400 border-monokai-border-subtle',
        label: 'ALTER',
      };
    }
    if (clean.includes('BEGIN') || clean.includes('COMMIT') || clean.includes('TRANSACTION')) {
      return {
        className: 'bg-monokai-surface text-monokai-fg-muted border-monokai-border-subtle',
        label: clean,
      };
    }
    return {
      className: 'bg-monokai-surface text-monokai-comment border-monokai-border-subtle',
      label: clean || 'UNKNOWN',
    };
  };

  return (
    <div className="h-full flex flex-col bg-monokai-bg font-sans select-text">
      {/* 1. Page Header with Actions */}
      <PageHeader
        title="系统审计日志 (Audit Log)"
        description="持久化追踪所有 Schema 架构演变、DDL 执行与数据表变更记录"
        icon={ScrollText}
        tone="accent"
        badge={
          <span className="rounded bg-monokai-surface px-2.5 py-0.5 text-[10px] font-mono font-medium text-monokai-blue border border-monokai-border">
            {auditLogs.length} 条记录
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            {onRefresh && (
              <ActionButton
                variant="secondary"
                size="sm"
                icon={RefreshCw}
                onClick={onRefresh}
                title="重新加载审计日志"
              >
                刷新
              </ActionButton>
            )}

            {/* Export Dropdown */}
            <div className="relative">
              <ActionButton
                ref={exportTriggerRef}
                variant="secondary"
                size="sm"
                icon={Download}
                aria-haspopup="menu"
                aria-expanded={showExportMenu}
                onClick={() => setShowExportMenu((v) => !v)}
              >
                导出日志
                <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-70" />
              </ActionButton>

              {showExportMenu && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setShowExportMenu(false)}
                  />
                  <div role="menu" aria-label="导出日志格式" className="audit-export-menu absolute right-0 mt-1.5 w-44 rounded-md border border-monokai-border bg-monokai-surface py-1 shadow-xl z-30 font-sans">
                    <button
                      type="button"
                      onClick={handleExportCsv}
                      className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-monokai-fg hover:bg-monokai-sidebar transition-colors cursor-pointer text-left"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-monokai-green" />
                      <span>导出为 CSV 文件</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportJson}
                      className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-monokai-fg hover:bg-monokai-sidebar transition-colors cursor-pointer text-left border-t border-monokai-border/40"
                    >
                      <FileJson className="w-4 h-4 text-monokai-yellow" />
                      <span>导出为 JSON 文件</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        }
      />

      {/* 2. Top KPI Discovery Board */}
      <div className="border-b border-monokai-border bg-monokai-sidebar/40 px-4 py-2.5 shrink-0">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
          {/* Total Operations */}
          <div className="flex items-center gap-2.5 rounded-md bg-monokai-surface border border-monokai-border p-2 px-3 shadow-xs">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-monokai-sidebar border border-monokai-border text-monokai-fg-muted">
              <Layers className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-medium text-monokai-comment">操作总计 (Total)</div>
              <div className="text-sm font-bold font-mono text-monokai-fg tabular-nums">
                {kpiStats.total}
              </div>
            </div>
          </div>

          {/* DDL Schema Evolution */}
          <div className="flex items-center gap-2.5 rounded-md bg-monokai-surface border border-monokai-border p-2 px-3 shadow-xs">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sky-500/10 text-sky-400 border border-monokai-border">
              <Database className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-medium text-monokai-comment">DDL 结构演进</div>
              <div className="text-sm font-bold font-mono text-monokai-fg tabular-nums">
                {kpiStats.ddl}
              </div>
            </div>
          </div>

          {/* DML Data Operations */}
          <div className="flex items-center gap-2.5 rounded-md bg-monokai-surface border border-monokai-border p-2 px-3 shadow-xs">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400 border border-monokai-border">
              <Activity className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-medium text-monokai-comment">DML 数据变更</div>
              <div className="text-sm font-bold font-mono text-emerald-400 tabular-nums">
                {kpiStats.dml}
              </div>
            </div>
          </div>

          {/* Total Affected Rows */}
          <div className="flex items-center gap-2.5 rounded-md bg-monokai-surface border border-monokai-border p-2 px-3 shadow-xs">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-400 border border-monokai-border">
              <Zap className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-medium text-monokai-comment">累计受影响行</div>
              <div className="text-sm font-bold font-mono text-monokai-fg tabular-nums">
                {kpiStats.totalRows.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Active Tables Touched */}
          <div className="flex items-center gap-2.5 rounded-md bg-monokai-surface border border-monokai-border p-2 px-3 col-span-2 md:col-span-1 shadow-xs">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-monokai-sidebar border border-monokai-border text-monokai-fg-muted">
              <TableIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-medium text-monokai-comment">涉及数据表</div>
              <div className="text-sm font-bold font-mono text-monokai-fg tabular-nums">
                {kpiStats.activeTables} 个表
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Workbench Filter & Search Toolbar */}
      <Toolbar className="flex-wrap justify-between gap-2.5 min-h-10 h-auto px-4 py-2">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          {/* SegmentedTabs by Category */}
          <SegmentedTabs<CategoryFilter>
            value={categoryFilter}
            onChange={(val) => {
              setCategoryFilter(val);
              setCurrentPage(1);
            }}
            tone="accent"
            size="sm"
            aria-label="审计分类过滤"
            items={[
              { value: 'ALL', label: '全部', badge: kpiStats.total },
              { value: 'DDL', label: 'DDL 架构', icon: Database, badge: kpiStats.ddl },
              { value: 'DML', label: 'DML 变更', icon: Activity, badge: kpiStats.dml },
              {
                value: 'DESTRUCTIVE',
                label: '高危/删除',
                icon: ShieldAlert,
                badge: kpiStats.destructive > 0 ? kpiStats.destructive : undefined,
              },
            ]}
          />

          {/* Search Input */}
          <SearchInput
            value={searchTerm}
            onChange={(val) => {
              setSearchTerm(val);
              setCurrentPage(1);
            }}
            onClear={() => {
              setSearchTerm('');
              setCurrentPage(1);
            }}
            placeholder="搜索 SQL 语句、表名、操作类型..."
            className="w-64"
            size="sm"
          />

          {/* Target Table Dropdown */}
          <div className="relative">
            <select
              value={selectedTable}
              onChange={(e) => {
                setSelectedTable(e.target.value);
                setCurrentPage(1);
              }}
              className="h-8 appearance-none bg-monokai-surface border border-monokai-border rounded-md pl-3 pr-8 text-xs font-mono text-monokai-fg focus:outline-none focus:border-monokai-accent transition-colors cursor-pointer"
              aria-label="选择数据表"
            >
              <option value="ALL">全部数据表 ({availableTables.length})</option>
              {availableTables.map(({ table, count }) => (
                <option key={table} value={table}>
                  {table} ({count})
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-monokai-comment pointer-events-none" />
          </div>

          {/* Time Range Selector */}
          <div className="relative">
            <select
              value={timeFilter}
              onChange={(e) => {
                setTimeFilter(e.target.value as TimeFilter);
                setCurrentPage(1);
              }}
              className="h-8 appearance-none bg-monokai-surface border border-monokai-border rounded-md pl-3 pr-8 text-xs font-mono text-monokai-fg focus:outline-none focus:border-monokai-accent transition-colors cursor-pointer"
              aria-label="选择时间范围"
            >
              <option value="ALL">全部时间</option>
              <option value="TODAY">今日日志</option>
              <option value="7D">最近 7 天</option>
              <option value="30D">最近 30 天</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-monokai-comment pointer-events-none" />
          </div>

          {/* Reset Filters */}
          {isFilterActive && (
            <ActionButton
              variant="danger"
              size="sm"
              icon={RotateCcw}
              onClick={resetFilters}
            >
              重置筛选
            </ActionButton>
          )}
        </div>

        {/* Right tools & Count status */}
        <div className="flex items-center gap-3 text-xs font-mono text-monokai-comment">
          {paginatedLogs.length > 0 && (
            <div className="flex items-center gap-1.5 border-r border-monokai-border/60 pr-3">
              <button
                type="button"
                onClick={expandAll}
                className="text-[11px] text-monokai-comment hover:text-monokai-fg px-1.5 py-0.5 rounded hover:bg-monokai-surface/60 cursor-pointer"
              >
                展开全部
              </button>
              <span>/</span>
              <button
                type="button"
                onClick={collapseAll}
                className="text-[11px] text-monokai-comment hover:text-monokai-fg px-1.5 py-0.5 rounded hover:bg-monokai-surface/60 cursor-pointer"
              >
                收起全部
              </button>
            </div>
          )}
          <div>
            已匹配{' '}
            <span className="text-monokai-accent font-bold tabular-nums">
              {filteredLogs.length}
            </span>{' '}
            / {auditLogs.length} 条
          </div>
        </div>
      </Toolbar>

      {/* 4. Table Stream Area */}
      <div className="flex-1 overflow-auto bg-monokai-bg custom-scrollbar">
        {filteredLogs.length === 0 ? (
          <div className="h-full flex items-center justify-center p-8">
            <EmptyState
              icon={ScrollText}
              title={isFilterActive ? '未找到符合条件的审计记录' : '暂无系统审计日志'}
              description={
                isFilterActive
                  ? '请调整搜索关键词、操作类型分类或时间范围以重新筛选'
                  : '请执行 DDL/DML 操作以自动生成审计记录'
              }
              action={
                isFilterActive ? (
                  <ActionButton
                    variant="secondary"
                    size="sm"
                    icon={RotateCcw}
                    onClick={resetFilters}
                  >
                    重置所有筛选
                  </ActionButton>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="min-w-full inline-block align-middle">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead className="bg-monokai-surface/95 border-b border-monokai-border sticky top-0 z-10 text-[11px] uppercase tracking-wider text-monokai-comment select-none backdrop-blur-sm">
                <tr>
                  <th className="p-3 w-10 text-center">#</th>
                  <th className="p-3 font-mono text-monokai-accent font-semibold w-48">执行时间</th>
                  <th className="p-3 font-mono text-monokai-fg font-semibold w-28">操作类型</th>
                  <th className="p-3 font-mono text-monokai-yellow font-semibold w-44">目标数据表</th>
                  <th className="p-3 font-mono text-monokai-fg font-semibold">SQL 语句与变更摘要</th>
                  <th className="p-3 font-mono text-monokai-green font-semibold text-right w-24">影响行数</th>
                  <th className="p-3 font-mono text-monokai-comment font-semibold text-center w-28">快捷操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-monokai-border/40 bg-monokai-bg/60">
                {paginatedLogs.map((log) => {
                  const isExpanded = expandedRows.has(log.id);
                  const badge = getOperationBadge(log.operation_type);

                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        onClick={() => toggleRow(log.id)}
                        className={`group hover:bg-monokai-surface/60 cursor-pointer transition-colors ${
                          isExpanded ? 'bg-monokai-surface/40' : ''
                        }`}
                      >
                        {/* Expand indicator */}
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            aria-label={isExpanded ? '收起详情' : '展开详情'}
                            className="inline-flex items-center justify-center p-0.5 rounded text-monokai-comment group-hover:text-monokai-fg"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-monokai-accent transition-transform" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-monokai-comment transition-transform" />
                            )}
                          </button>
                        </td>

                        {/* Log Time */}
                        <td className="p-3 font-mono whitespace-nowrap text-[11px]">
                          <div className="flex items-center gap-1.5 text-monokai-fg/90">
                            <Clock className="w-3.5 h-3.5 text-monokai-comment shrink-0" />
                            <span>{new Date(log.log_time).toLocaleString()}</span>
                          </div>
                          <div className="text-[10px] text-monokai-comment pl-5">
                            {formatRelativeTime(log.log_time)}
                          </div>
                        </td>

                        {/* Operation Badge */}
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </td>

                        {/* Target Table */}
                        <td className="p-3 font-mono">
                          {log.target_table ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTable(log.target_table || 'ALL');
                              }}
                              className="inline-flex items-center gap-1.5 text-monokai-fg-muted bg-monokai-surface px-2 py-0.5 rounded border border-monokai-border hover:border-monokai-border-strong hover:text-monokai-fg text-[11px] transition-colors cursor-pointer"
                              title="点击按此表过滤审计日志"
                            >
                              <TableIcon className="w-3 h-3 text-monokai-comment shrink-0" />
                              <span className="truncate max-w-[120px]">{log.target_table}</span>
                            </button>
                          ) : (
                            <span className="text-monokai-comment/40 italic text-[11px]">—</span>
                          )}
                        </td>

                        {/* SQL Details preview */}
                        <td className="p-3 font-mono text-monokai-fg/80 truncate max-w-md lg:max-w-xl text-[11px]">
                          <span className="hover:text-monokai-accent transition-colors">
                            {log.details}
                          </span>
                        </td>

                        {/* Affected Rows */}
                        <td className="p-3 font-mono text-right text-[11px] tabular-nums">
                          {Number(log.affected_rows) > 0 ? (
                            <span className="text-emerald-400 font-medium bg-emerald-500/10 border border-monokai-border-subtle px-1.5 py-0.5 rounded text-[10px]">
                              +{log.affected_rows}
                            </span>
                          ) : (
                            <span className="text-monokai-comment/40">0</span>
                          )}
                        </td>

                        {/* Quick Row Actions */}
                        <td className="p-3 text-center">
                          <div className="inline-flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={(e) => handleCopy(log.id, log.details, e)}
                              className="p-1 rounded text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface border border-transparent hover:border-monokai-border transition-all cursor-pointer"
                              title="复制 SQL 语句"
                            >
                              {copiedId === log.id ? (
                                <Check className="w-3.5 h-3.5 text-monokai-green" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleReplayInSql(log.details, e)}
                              className="p-1 rounded text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface border border-transparent hover:border-monokai-border transition-all cursor-pointer"
                              title="在 SQL 编辑器中打开并重放"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded SQL & Meta Drawer */}
                      {isExpanded && (
                        <tr className="bg-monokai-surface/30 border-b border-monokai-border/80">
                          <td colSpan={7} className="p-4 pl-12">
                            <div className="flex flex-col gap-3 rounded-md border border-monokai-border bg-monokai-bg/90 p-4 shadow-sm">
                              {/* Metadata Strip */}
                              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-monokai-border/60 pb-3 text-xs">
                                <div className="flex flex-wrap items-center gap-3 text-monokai-comment font-mono text-[11px]">
                                  <span className="flex items-center gap-1 text-monokai-fg font-semibold">
                                    <Hash className="w-3.5 h-3.5 text-monokai-accent" />
                                    ID: {log.id}
                                  </span>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5 text-monokai-comment" />
                                    {log.log_time}
                                  </span>
                                  <span>•</span>
                                  <span>
                                    影响行数:{' '}
                                    <strong className="text-monokai-green font-bold tabular-nums">
                                      {log.affected_rows}
                                    </strong>
                                  </span>
                                  {log.target_table && (
                                    <>
                                      <span>•</span>
                                      <span className="text-monokai-yellow">
                                        表: {log.target_table}
                                      </span>
                                    </>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  {generateRollbackSql(log.operation_type, log.target_table, log.details) && (
                                    <ActionButton
                                      variant="warning"
                                      size="sm"
                                      icon={RotateCcw}
                                      onClick={(e) => {
                                        const rollback = generateRollbackSql(log.operation_type, log.target_table, log.details);
                                        if (rollback) handleReplayInSql(rollback, e);
                                      }}
                                      title="在 SQL 编辑器中生成该操作的反向回滚脚本"
                                    >
                                      生成回滚 SQL
                                    </ActionButton>
                                  )}
                                  <ActionButton
                                    variant="secondary"
                                    size="sm"
                                    icon={copiedId === log.id ? Check : Copy}
                                    onClick={(e) => handleCopy(log.id, log.details, e)}
                                  >
                                    {copiedId === log.id ? '已复制' : '复制完整 SQL'}
                                  </ActionButton>
                                  <ActionButton
                                    variant="primary"
                                    size="sm"
                                    icon={Play}
                                    onClick={(e) => handleReplayInSql(log.details, e)}
                                  >
                                    在 SQL 编辑器中执行
                                  </ActionButton>
                                </div>
                              </div>

                              {/* Formatted Code Box */}
                              <CodeHighlightBlock
                                code={log.details}
                                language="sql"
                                title="SQL STATEMENT PREVIEW"
                                allowFormat={true}
                                maxHeight="280px"
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Pagination Footer */}
      {filteredLogs.length > pageSize && (
        <div className="flex items-center justify-between border-t border-monokai-border bg-monokai-sidebar/80 px-5 py-2.5 text-xs text-monokai-comment font-mono shrink-0">
          <div className="flex items-center gap-2">
            <span>每页显示:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="h-7 bg-monokai-surface border border-monokai-border rounded px-2 text-xs text-monokai-fg"
            >
              <option value={20}>20 条</option>
              <option value={50}>50 条</option>
              <option value={100}>100 条</option>
              <option value={200}>200 条</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span>
              第 {currentPage} / {totalPages} 页 (共 {filteredLogs.length} 条)
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-7 px-2.5 rounded-md bg-monokai-surface border border-monokai-border hover:bg-monokai-sidebar text-monokai-fg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                上一页
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="h-7 px-2.5 rounded-md bg-monokai-surface border border-monokai-border hover:bg-monokai-sidebar text-monokai-fg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                下一页
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditTab;
