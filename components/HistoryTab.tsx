import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { QueryHistoryItem, Tab } from '../types';
import {
  Clock,
  Trash2,
  SlidersHorizontal,
  Code2,
  LayoutGrid,
  Table2,
  Star,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { useConfirmDialog } from './ui/ConfirmDialog';
import { toastService } from '../services/toastService';
import { PageHeader, SearchInput, ActionButton, EmptyState, SegmentedTabs } from './ui/Workbench';
import { useSqlEditorStore } from '../hooks/store/useSqlEditorStore';
import { useAppStore } from '../hooks/store/useAppStore';
import {
  HistoryStatsStrip,
  HistoryCardView,
  HistoryTableView,
  HistoryDetailDrawer,
} from './History';

const HISTORY_KEY = 'duckdb_sql_history';

function loadHistory(): QueryHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 200) : [];
  } catch {
    return [];
  }
}

function saveHistoryToStorage(items: QueryHistoryItem[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  } catch {}
}

export const HistoryTab: React.FC = () => {
  const history = useSqlEditorStore((s) => s.history);
  const setHistory = useSqlEditorStore((s) => s.setHistory);
  const toggleStarHistoryItem = useSqlEditorStore((s) => s.toggleStarHistoryItem);
  const removeHistoryItem = useSqlEditorStore((s) => s.removeHistoryItem);
  const clearHistoryStore = useSqlEditorStore((s) => s.clearHistory);

  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error' | 'starred'>('all');
  const [latencyFilter, setLatencyFilter] = useState<'all' | 'fast' | 'medium' | 'slow'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'duration' | 'status'>('recent');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<QueryHistoryItem | null>(null);
  const [statsCollapsed, setStatsCollapsed] = useState(false);

  const { confirm } = useConfirmDialog();
  const { setActiveTab } = useAppStore();

  const refreshHistory = useCallback(() => {
    const loaded = loadHistory();
    setHistory(loaded);
  }, [setHistory]);

  // Initial load if store is empty but storage has items
  useEffect(() => {
    if (history.length === 0) {
      refreshHistory();
    }
  }, [history.length, refreshHistory]);

  // Multi-tab storage synchronization
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === HISTORY_KEY) {
        refreshHistory();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [refreshHistory]);

  // Keep selectedItem in sync with reactive history state
  useEffect(() => {
    if (selectedItem) {
      const match = history.find((h) => h.id === selectedItem.id);
      if (match) {
        if (match.isStarred !== selectedItem.isStarred || match.sql !== selectedItem.sql) {
          setSelectedItem(match);
        }
      } else {
        setSelectedItem(null);
      }
    }
  }, [history, selectedItem]);

  const filtered = useMemo(() => {
    let result = history;

    if (filter.trim()) {
      const q = filter.toLowerCase().trim();
      result = result.filter(
        (h) =>
          h.sql.toLowerCase().includes(q) ||
          (h.error && h.error.toLowerCase().includes(q)) ||
          (h.id && h.id.toLowerCase().includes(q))
      );
    }

    if (statusFilter === 'success') {
      result = result.filter((h) => h.status === 'success');
    } else if (statusFilter === 'error') {
      result = result.filter((h) => h.status !== 'success');
    } else if (statusFilter === 'starred') {
      result = result.filter((h) => h.isStarred);
    }

    if (latencyFilter === 'fast') {
      result = result.filter((h) => (h.executionTime || 0) < 100);
    } else if (latencyFilter === 'medium') {
      result = result.filter((h) => (h.executionTime || 0) >= 100 && (h.executionTime || 0) < 1000);
    } else if (latencyFilter === 'slow') {
      result = result.filter((h) => (h.executionTime || 0) >= 1000);
    }

    const sorted = [...result];
    if (sortBy === 'duration') {
      sorted.sort((a, b) => (b.executionTime || 0) - (a.executionTime || 0));
    } else if (sortBy === 'status') {
      sorted.sort((a, b) => (a.status === 'success' ? 0 : 1) - (b.status === 'success' ? 0 : 1));
    } else {
      sorted.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }
    return sorted;
  }, [history, filter, statusFilter, latencyFilter, sortBy]);

  const handleCopy = (sql: string, id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(sql);
    } else {
      const ta = document.createElement('textarea');
      ta.value = sql;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedId(id);
    toastService.success('SQL 已成功复制到剪贴板');
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleLoadAndRun = (sql: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    useSqlEditorStore.getState().updateActiveTab({ code: sql });
    useAppStore.getState().setPendingSql(sql);
    setActiveTab(Tab.SQL);
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('duckdb_execute_sql', {
          detail: {
            sql,
            title: '历史回溯',
            autoRun: true,
          },
        })
      );
    }, 50);
    toastService.info('SQL 查询已载入编辑器并开始执行');
  };

  const handleLoadOnly = (sql: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    useSqlEditorStore.getState().updateActiveTab({ code: sql });
    setActiveTab(Tab.SQL);
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('duckdb_execute_sql', {
          detail: {
            sql,
            title: '历史查询',
            autoRun: false,
          },
        })
      );
    }, 50);
    toastService.info('SQL 查询已载入编辑器');
  };

  const handleToggleStar = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const item = history.find((h) => h.id === id);
    const nextStarred = !item?.isStarred;
    toggleStarHistoryItem(id);
    toastService.info(nextStarred ? '已收藏此 SQL 查询' : '已取消收藏');
  };

  const handleDeleteItem = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    removeHistoryItem(id);
    toastService.info('历史记录项已删除');
  };

  const handleClear = async () => {
    const ok = await confirm({
      title: '清空 SQL 历史记录',
      message: '确定要清空所有历史 SQL 执行记录吗？此操作无法撤销。',
      confirmText: '确认清空',
      cancelText: '取消',
      variant: 'danger',
    });
    if (ok) {
      clearHistoryStore();
      setSelectedItem(null);
      toastService.info('SQL 历史记录已全部清空');
    }
  };

  const statusTabItems = [
    { value: 'all' as const, label: '全部流水', badge: history.length },
    {
      value: 'success' as const,
      label: '执行成功',
      badge: history.filter((h) => h.status === 'success').length,
    },
    {
      value: 'error' as const,
      label: '异常报错',
      badge: history.filter((h) => h.status !== 'success').length,
    },
    {
      value: 'starred' as const,
      label: '已收藏',
      icon: Star,
      badge: history.filter((h) => h.isStarred).length,
    },
  ];

  return (
    <div className="h-full flex flex-col bg-monokai-bg font-sans text-monokai-fg overflow-hidden select-none">
      {/* Standard Page Header (Analytics tone="accent" - Monokai Blue) */}
      <PageHeader
        title="分析洞察 • 查询历史 (Query History)"
        description="统一回溯与分析会话内所有已执行的 SQL 查询流水、性能耗时指标与报错诊断"
        icon={Clock}
        tone="accent"
        badge={
          <span className="rounded-md bg-monokai-surface px-2 py-0.5 text-xs font-mono text-monokai-comment border border-monokai-border shadow-xs">
            {history.length} 次执行记录
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <ActionButton
              variant="secondary"
              size="md"
              icon={RefreshCw}
              onClick={refreshHistory}
              title="刷新历史记录"
            >
              刷新
            </ActionButton>

            {history.length > 0 && (
              <ActionButton
                variant="danger"
                size="md"
                icon={Trash2}
                onClick={handleClear}
                title="清空所有执行历史"
              >
                清空历史
              </ActionButton>
            )}
          </div>
        }
      />

      {/* Top Metrics Strip */}
      <HistoryStatsStrip
        history={history}
        collapsed={statsCollapsed}
        onToggleCollapse={() => setStatsCollapsed(!statsCollapsed)}
      />

      {/* Standard Secondary Toolbar */}
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-3 border-b border-monokai-border bg-monokai-sidebar px-4 py-2 shrink-0">
        <div className="flex flex-1 flex-wrap items-center gap-3 min-w-[280px]">
          {/* Status Tabs */}
          <SegmentedTabs
            aria-label="执行状态过滤"
            value={statusFilter}
            items={statusTabItems}
            tone="accent"
            size="sm"
            onChange={(v) => setStatusFilter(v as any)}
          />

          {/* Latency Quick Filters */}
          <div className="flex items-center gap-1 bg-monokai-surface border border-monokai-border rounded-md p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setLatencyFilter('all')}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                latencyFilter === 'all'
                  ? 'bg-monokai-sidebar text-monokai-fg font-medium shadow-xs'
                  : 'text-monokai-comment hover:text-monokai-fg'
              }`}
            >
              全部耗时
            </button>
            <button
              type="button"
              onClick={() => setLatencyFilter('fast')}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                latencyFilter === 'fast'
                  ? 'bg-monokai-sidebar text-monokai-fg font-medium shadow-xs'
                  : 'text-monokai-comment hover:text-monokai-fg'
              }`}
              title="耗时小于 100ms 的极速查询"
            >
              <Zap size={11} className="text-monokai-green" />
              <span>&lt;100ms</span>
            </button>
            <button
              type="button"
              onClick={() => setLatencyFilter('medium')}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                latencyFilter === 'medium'
                  ? 'bg-monokai-sidebar text-monokai-fg font-medium shadow-xs'
                  : 'text-monokai-comment hover:text-monokai-fg'
              }`}
              title="耗时 100ms - 1s 的常规查询"
            >
              100ms-1s
            </button>
            <button
              type="button"
              onClick={() => setLatencyFilter('slow')}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                latencyFilter === 'slow'
                  ? 'bg-monokai-sidebar text-monokai-fg font-medium shadow-xs'
                  : 'text-monokai-comment hover:text-monokai-fg'
              }`}
              title="耗时大于 1s 的慢查询"
            >
              🐢 &ge;1s
            </button>
          </div>

          {/* Search Input */}
          <SearchInput
            value={filter}
            onChange={setFilter}
            onClear={() => setFilter('')}
            placeholder="搜索 SQL 语句、报错关键字或 ID..."
            className="w-64"
            size="sm"
          />

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 bg-monokai-surface border border-monokai-border rounded-md px-2.5 h-8 text-xs text-monokai-comment shadow-xs">
            <SlidersHorizontal size={13} className="text-monokai-comment shrink-0" />
            <span className="text-[11px] text-monokai-comment">排序:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent border-none outline-none text-monokai-fg cursor-pointer text-[11px] font-sans focus:outline-none"
            >
              <option value="recent" className="bg-monokai-sidebar">最近执行 (Recent)</option>
              <option value="duration" className="bg-monokai-sidebar">最高耗时 (Slowest)</option>
              <option value="status" className="bg-monokai-sidebar">执行状态 (Status)</option>
            </select>
          </div>
        </div>

        {/* View Mode Switcher + Count */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-monokai-surface border border-monokai-border rounded-md p-0.5 shadow-xs">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-monokai-sidebar text-monokai-fg shadow-xs font-medium'
                  : 'text-monokai-comment hover:text-monokai-fg'
              }`}
              title="卡片流视图 (Card Flow View)"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-monokai-sidebar text-monokai-fg shadow-xs font-medium'
                  : 'text-monokai-comment hover:text-monokai-fg'
              }`}
              title="紧凑表格视图 (Data Table View)"
            >
              <Table2 size={14} />
            </button>
          </div>

          <div className="text-xs text-monokai-comment font-mono">
            已显示 <span className="text-monokai-fg font-semibold">{filtered.length}</span> / {history.length} 条
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Clock}
            title={filter || statusFilter !== 'all' || latencyFilter !== 'all' ? '未找到符合条件的查询记录' : '当前会话暂无 SQL 查询历史'}
            description={
              filter || statusFilter !== 'all' || latencyFilter !== 'all'
                ? '请调整筛选条件以查看更多历史记录'
                : '请在 SQL 编辑器中运行查询以自动记录执行历史'
            }
            action={
              filter || statusFilter !== 'all' || latencyFilter !== 'all' ? (
                <ActionButton
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setFilter('');
                    setStatusFilter('all');
                    setLatencyFilter('all');
                  }}
                >
                  重置所有筛选
                </ActionButton>
              ) : (
                <ActionButton
                  variant="primary"
                  size="sm"
                  icon={Code2}
                  onClick={() => setActiveTab(Tab.SQL)}
                >
                  前往 SQL 编辑器
                </ActionButton>
              )
            }
          />
        ) : viewMode === 'cards' ? (
          <HistoryCardView
            items={filtered}
            copiedId={copiedId}
            selectedId={selectedItem?.id || null}
            onSelect={setSelectedItem}
            onCopy={handleCopy}
            onLoadAndRun={handleLoadAndRun}
            onToggleStar={handleToggleStar}
            onDelete={handleDeleteItem}
          />
        ) : (
          <HistoryTableView
            items={filtered}
            copiedId={copiedId}
            selectedId={selectedItem?.id || null}
            onSelect={setSelectedItem}
            onCopy={handleCopy}
            onLoadAndRun={handleLoadAndRun}
            onToggleStar={handleToggleStar}
            onDelete={handleDeleteItem}
          />
        )}
      </div>

      {/* Detail Slide-over Drawer */}
      <HistoryDetailDrawer
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onCopy={handleCopy}
        onLoadAndRun={handleLoadAndRun}
        onLoadOnly={handleLoadOnly}
        onToggleStar={handleToggleStar}
        onDelete={handleDeleteItem}
      />

      {/* Footer Summary Strip */}
      <footer className="px-5 py-2 border-t border-monokai-border bg-monokai-sidebar shrink-0 select-none">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[11px] font-mono text-monokai-comment">
            显示 {filtered.length} 项 • 点击卡片或行可查看 SQL 语法高亮与格式化详情
          </span>
          {copiedId && (
            <span className="text-[11px] text-monokai-green font-mono font-medium">
              ✓ SQL 已成功复制到剪贴板
            </span>
          )}
        </div>
      </footer>
    </div>
  );
};

export default HistoryTab;
