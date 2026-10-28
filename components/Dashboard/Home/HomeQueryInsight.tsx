import React, { useMemo, useState } from 'react';
import {
  Play,
  Copy,
  Check,
  AlertCircle,
  BarChart3,
  LayoutDashboard,
  ExternalLink,
  Search,
  Sparkles,
} from 'lucide-react';
import { Tab } from '../../../types';
import { type RecentQueryDisplayItem } from '../../../hooks/useDashboardWorkflow';
import { toastService } from '../../../services/toastService';
import { createWidgetFromSql } from '../../../services/homeDashboardService';
import { vizHintLabel } from '../../../services/queryVizHint';
import { useAppStore } from '../../../hooks/store/useAppStore';
import { DB, dbBadgeClass } from '../dashboardUi';

export interface HomeQueryInsightProps {
  queries: RecentQueryDisplayItem[];
  onSelectQuery: (sql: string, executeDirectly?: boolean) => void;
  onNavigate: (tab: Tab) => void;
  onBoardUpdated?: () => void;
  controlledFilter?: 'all' | 'success' | 'error' | 'slow';
  onFilterChange?: (filter: 'all' | 'success' | 'error' | 'slow') => void;
  highlightedQueryId?: string | null;
}

export const HomeQueryInsight: React.FC<HomeQueryInsightProps> = ({
  queries = [],
  onSelectQuery,
  onNavigate,
  onBoardUpdated,
  controlledFilter,
  onFilterChange,
  highlightedQueryId,
}) => {
  const [filter, setFilter] = useState<'all' | 'success' | 'error' | 'slow'>(controlledFilter || 'all');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const setPendingChartConfig = useAppStore((s) => s.setPendingChartConfig);
  const setPendingSql = useAppStore((s) => s.setPendingSql);
  const bumpDashboardRefresh = useAppStore((s) => s.bumpDashboardRefresh);

  React.useEffect(() => {
    if (controlledFilter) setFilter(controlledFilter);
  }, [controlledFilter]);

  const setFilterBoth = (f: 'all' | 'success' | 'error' | 'slow') => {
    setFilter(f);
    onFilterChange?.(f);
  };

  const filtered = useMemo(() => {
    return queries.filter((q) => {
      if (filter === 'success' && q.status !== 'success') return false;
      if (filter === 'error' && q.status !== 'error') return false;
      if (filter === 'slow') {
        const ms = q.executionTime ?? 0;
        if (ms < 200) return false;
      }
      if (search.trim() && !q.sql.toLowerCase().includes(search.toLowerCase().trim())) return false;
      return true;
    });
  }, [queries, filter, search]);

  const errorCount = useMemo(() => queries.filter((q) => q.status === 'error').length, [queries]);
  const vizCount = useMemo(
    () => queries.filter((q) => q.vizHint === 'strong' || q.vizHint === 'weak').length,
    [queries],
  );

  const handleCopy = async (q: RecentQueryDisplayItem) => {
    try {
      await navigator.clipboard.writeText(q.sql);
      setCopiedId(q.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      toastService.error('复制失败');
    }
  };

  const handleGenerateChart = (q: RecentQueryDisplayItem) => {
    setPendingSql(q.sql);
    setPendingChartConfig({
      id: `chart-${Date.now()}`,
      title: '未命名图表',
      type: 'bar',
      xKey: '',
      yKeys: [],
      source: 'manual',
    });
    onNavigate(Tab.SQL);
    toastService.info('已载入查询并打开结果图表视图');
  };

  const handleAddToBoard = async (q: RecentQueryDisplayItem) => {
    if (q.status === 'error') {
      toastService.warning('失败查询无法加入仪表盘');
      return;
    }
    setBusyId(q.id);
    try {
      const name =
        q.sql.replace(/\s+/g, ' ').trim().slice(0, 48) || `查询 ${q.timestamp}`;
      await createWidgetFromSql({
        name,
        sql: q.sql,
        widgetType: q.vizHint === 'strong' && (q.rowCount ?? 0) <= 1 ? 'value' : 'table',
        rowCount: q.rowCount,
        addToBoard: true,
      });
      bumpDashboardRefresh();
      onBoardUpdated?.();
      toastService.success('已加入分析首页看板');
    } catch (e: any) {
      toastService.error(e?.message || '加入看板失败');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className={`${DB.panelLg} gap-3 min-h-[360px]`}>
      <div className={DB.sectionHeader}>
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-3.5 w-3.5 text-monokai-accent shrink-0" />
          <h2 className={DB.sectionTitle}>最近查询</h2>
          <span className={DB.sectionMeta}>
            {queries.length} 条
            {errorCount > 0 ? ` · ${errorCount} 异常` : ''}
            {vizCount > 0 ? ` · ${vizCount} 可可视化` : ''}
          </span>
        </div>
        <button type="button" className={DB.btnGhostLink} onClick={() => onNavigate(Tab.HISTORY)}>
          历史
          <ExternalLink className="h-3 w-3" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-monokai-comment" />
          <input
            className={DB.input}
            placeholder="搜索 SQL…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className={DB.segment}>
          {(
            [
              ['all', '全部'],
              ['error', '异常'],
              ['slow', '慢'],
              ['success', '成功'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={filter === id ? DB.segmentItemActive : DB.segmentItem}
              onClick={() => setFilterBoth(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className={DB.empty}>
          <p className="text-sm text-monokai-fg">暂无查询记录</p>
          <p className="text-meta text-monokai-comment">
            执行 SQL 后，这里会展示结果摘要、异常与可视化价值
          </p>
          <button type="button" className={`${DB.btnPrimary} mt-2`} onClick={() => onNavigate(Tab.SQL)}>
            去写查询
          </button>
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5 overflow-y-auto custom-scrollbar flex-1 max-h-[420px]">
          {filtered.map((q) => {
            const highlighted = highlightedQueryId === q.id;
            const hint = q.vizHint || 'none';
            return (
              <li
                key={q.id}
                className={`rounded-md border px-2.5 py-2 transition-colors ${
                  highlighted
                    ? 'border-monokai-accent/50 bg-monokai-accent/8'
                    : 'border-monokai-border/70 bg-monokai-elevated/30 hover:border-monokai-border-strong'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left cursor-pointer"
                    onClick={() => onSelectQuery(q.sql)}
                    title="在 SQL 编辑器中打开"
                  >
                    <pre className="font-mono text-2xs text-monokai-fg whitespace-pre-wrap break-all line-clamp-2">
                      {q.sql}
                    </pre>
                  </button>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={dbBadgeClass(
                        q.status === 'error' ? 'danger' : hint === 'strong' ? 'ok' : 'neutral',
                      )}
                    >
                      {q.status === 'error' ? '失败' : q.duration}
                    </span>
                    <span className="text-2xs font-mono text-monokai-comment">{q.timestamp}</span>
                  </div>
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs font-mono text-monokai-comment">
                  {q.status === 'error' ? (
                    <span className="text-monokai-pink flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {q.error || '执行错误'}
                    </span>
                  ) : (
                    <>
                      <span>{q.rowCount != null ? `${q.rowCount} 行` : '—'}</span>
                      <span className={hint === 'strong' ? 'text-monokai-accent' : ''}>
                        {vizHintLabel(hint)}
                      </span>
                      {q.referencedTables && q.referencedTables.length > 0 && (
                        <span className="truncate max-w-[140px]" title={q.referencedTables.join(', ')}>
                          表: {q.referencedTables.slice(0, 2).join(', ')}
                          {q.referencedTables.length > 2 ? '…' : ''}
                        </span>
                      )}
                    </>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    className={DB.btnGhostLink}
                    onClick={() => onSelectQuery(q.sql, true)}
                    title="立即重新执行此查询"
                  >
                    <Play className="h-3 w-3" />
                    执行
                  </button>
                  <button type="button" className={DB.btnGhostLink} onClick={() => void handleCopy(q)}>
                    {copiedId === q.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    复制
                  </button>
                  {q.status === 'success' && (
                    <>
                      <button
                        type="button"
                        className={DB.btnGhostLink}
                        onClick={() => handleGenerateChart(q)}
                      >
                        <BarChart3 className="h-3 w-3" />
                        生成图表
                      </button>
                      <button
                        type="button"
                        className={DB.btnGhostLink}
                        disabled={busyId === q.id}
                        onClick={() => void handleAddToBoard(q)}
                      >
                        <LayoutDashboard className="h-3 w-3" />
                        加入仪表盘
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
