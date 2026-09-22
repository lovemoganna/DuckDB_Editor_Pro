import React, { useState } from 'react';
import { ArrowRight, Terminal, Search, Copy, Check, Trash2, X, Play, History } from 'lucide-react';
import { Tab } from '../../types';
import { type RecentQueryDisplayItem } from '../../hooks/useDashboardWorkflow';
import { toastService } from '../../services/toastService';
import { DB } from './dashboardUi';

interface DashboardRecentQueriesProps {
  queries: RecentQueryDisplayItem[];
  onSelectQuery: (sql: string) => void;
  onExecuteQueryDirectly?: (sql: string) => void;
  onNavigate: (tab: Tab) => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  statusFilter?: 'all' | 'success' | 'error';
  onStatusFilterChange?: (filter: 'all' | 'success' | 'error') => void;
  latencyFilter?: 'all' | 'fast' | 'normal' | 'slow';
  onLatencyFilterChange?: (filter: 'all' | 'fast' | 'normal' | 'slow') => void;
  onClearQueries?: () => void;
}

export const DashboardRecentQueries: React.FC<DashboardRecentQueriesProps> = ({
  queries,
  onSelectQuery,
  onExecuteQueryDirectly,
  onNavigate,
  searchTerm = '',
  onSearchChange,
  statusFilter = 'all',
  onStatusFilterChange,
  latencyFilter = 'all',
  onLatencyFilterChange,
  onClearQueries,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const displayedQueries = showAll ? queries : queries.slice(0, 8);

  const handleCopySql = (id: string, sql: string, e: React.MouseEvent) => {
    e.stopPropagation();
    void navigator.clipboard.writeText(sql);
    setCopiedId(id);
    toastService.success('已复制 SQL 到剪贴板');
    setTimeout(() => setCopiedId(null), 1500);
  };

  const getSqlPreview = (sql: string) => {
    if (!sql) return 'SQL 查询';
    const lines = sql.split('\n').map(l => l.trim()).filter(Boolean);
    const meaningful = lines.find(l => !l.startsWith('--')) || lines[0] || sql;
    return meaningful.replace(/\s+/g, ' ');
  };

  return (
    <div className={`${DB.panel} h-full justify-between`}>
      <div>
        {/* Header */}
        <div className="mb-2 flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Terminal className="h-3.5 w-3.5 text-monokai-fg-muted" />
            <h3 className={DB.sectionTitle}>最近的查询</h3>
            <span className={DB.chip}>{queries.length} 条</span>
            {latencyFilter !== 'all' && onLatencyFilterChange && (
              <span className={DB.chip}>
                <span>
                  {latencyFilter === 'fast'
                    ? '<50ms'
                    : latencyFilter === 'normal'
                      ? '50-200ms'
                      : '>200ms 慢查询'}
                </span>
                <button
                  type="button"
                  onClick={() => onLatencyFilterChange('all')}
                  className={`cursor-pointer p-0.5 hover:text-monokai-fg ${DB.focus}`}
                  title="清除耗时过滤"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onClearQueries && queries.length > 0 && (
              showClearConfirm ? (
                <div className="flex items-center gap-1.5 rounded-md border border-monokai-pink/40 bg-monokai-pink/15 px-2 py-0.5 text-2xs shadow-2xs">
                  <span className="font-semibold text-monokai-pink">清空?</span>
                  <button
                    type="button"
                    onClick={() => {
                      onClearQueries();
                      setShowClearConfirm(false);
                    }}
                    className="cursor-pointer px-1 font-bold text-monokai-pink hover:underline"
                  >
                    是
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(false)}
                    className="cursor-pointer px-0.5 text-monokai-comment hover:text-monokai-fg"
                  >
                    否
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  title="清空查询历史"
                  className={`rounded p-1 text-monokai-comment hover:bg-monokai-pink/20 hover:text-monokai-pink cursor-pointer ${DB.focus}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => onNavigate(Tab.HISTORY)}
              className={`${DB.btnGhostLink} ${DB.focus}`}
              title="查看 DuckDB 完整执行历史与审计记录"
            >
              <History className="h-3 w-3" />
              <span>历史记录</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate(Tab.SQL)}
              className={`group ${DB.btnGhostLink} ${DB.focus}`}
            >
              <span>进入工作台</span>
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>

        {/* Search & Filter Pills */}
        <div className="mb-2 flex items-center gap-2">
          {onSearchChange && (
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-monokai-comment" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => onSearchChange(e.target.value)}
                placeholder="搜索 SQL 关键词…"
                className={DB.input}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer p-0.5 text-monokai-comment hover:text-monokai-fg ${DB.focus}`}
                  title="清除搜索"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          {onStatusFilterChange && (
            <div className={`${DB.segment} shrink-0`}>
              <button
                type="button"
                onClick={() => onStatusFilterChange('all')}
                aria-pressed={statusFilter === 'all'}
                className={`${statusFilter === 'all' ? DB.segmentItemActive : DB.segmentItem} ${DB.focus}`}
              >
                全部
              </button>
              <button
                type="button"
                onClick={() => onStatusFilterChange('success')}
                aria-pressed={statusFilter === 'success'}
                className={`${statusFilter === 'success' ? DB.segmentItemActive : DB.segmentItem} ${DB.focus}`}
              >
                成功
              </button>
              <button
                type="button"
                onClick={() => onStatusFilterChange('error')}
                aria-pressed={statusFilter === 'error'}
                className={`${statusFilter === 'error' ? DB.segmentItemActive : DB.segmentItem} ${DB.focus}`}
              >
                异常
              </button>
            </div>
          )}
        </div>

        {/* Query List Header */}
        <div className="grid grid-cols-12 gap-2 text-2xs sm:text-meta text-monokai-comment pb-1.5 border-b border-monokai-border/70 px-2 font-medium">
          <div className="col-span-6">SQL 语句</div>
          <div className="col-span-2 text-right">耗时</div>
          <div className="col-span-2 text-right">返回行</div>
          <div className="col-span-2 text-right">操作</div>
        </div>

        {/* Query Rows or Honest Empty State */}
        {queries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-7 px-4 text-center">
            <div className="w-9 h-9 rounded-full bg-monokai-elevated border border-monokai-border flex items-center justify-center text-monokai-comment mb-2">
              <Terminal className="w-4 h-4" />
            </div>
            <p className="text-meta font-medium text-monokai-fg-muted">
              {searchTerm || statusFilter !== 'all' ? '未找到匹配的查询' : '暂无查询记录'}
            </p>
            <p className="text-2xs text-monokai-comment mt-0.5 max-w-[220px]">
              {searchTerm || statusFilter !== 'all'
                ? '尝试清除搜索条件或过滤器'
                : '在 SQL 工作台运行查询后，此处将实时记录历史'}
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <div className="flex items-center gap-2 mt-2.5">
                <button
                  type="button"
                  onClick={() => onSelectQuery('SELECT 1 AS ready, current_date AS today;')}
                  className="px-2.5 py-1 text-meta bg-monokai-elevated hover:bg-monokai-border/40 text-monokai-fg rounded border border-monokai-border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent"
                >
                  体验简单查询
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-0.5 pt-1 max-h-[250px] overflow-y-auto custom-scrollbar">
            {displayedQueries.map(q => (
              <div
                key={q.id}
                data-testid={`recent-query-${q.id}`}
                onClick={() => onSelectQuery(q.sql)}
                title={q.error ? `执行异常: ${q.error}\n\n完整查询:\n${q.sql}` : `完整查询:\n${q.sql}`}
                className="group grid grid-cols-12 gap-2 items-center px-2 py-1.5 rounded-lg hover:bg-monokai-elevated transition-all duration-150 cursor-pointer text-meta"
              >
                {/* Monospace Cyan SQL snippet with status dot */}
                <div className="col-span-6 flex items-center gap-1.5 min-w-0 pr-2">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${q.status === 'error' ? 'bg-monokai-pink' : 'bg-monokai-accent'}`}
                  />
                  <span className="font-mono truncate text-meta text-monokai-cyan group-hover:text-monokai-fg block bg-monokai-elevated/40 px-1.5 py-0.5 rounded border border-monokai-border/40">
                    {getSqlPreview(q.sql)}
                  </span>
                </div>

                {/* Latency */}
                <div className="col-span-2 text-right font-mono text-monokai-fg text-meta">
                  {q.duration}
                </div>

                {/* Returned Rows */}
                <div className="col-span-2 text-right font-mono text-monokai-comment text-meta">
                  {q.rowCount != null ? q.rowCount : '—'}
                </div>

                {/* Actions: Copy SQL, Time */}
                <div className="col-span-2 flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                  {typeof q.executionTime === 'number' && q.executionTime > 200 && (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        onSelectQuery(`EXPLAIN ANALYZE ${q.sql.trim()}`);
                      }}
                      title="在 SQL 工作台中进行 EXPLAIN ANALYZE 深度剖析"
                      className="px-1 py-0.2 rounded text-2xs font-mono text-monokai-yellow bg-monokai-yellow/15 border border-monokai-yellow/30 hover:bg-monokai-yellow/25 transition-colors cursor-pointer"
                    >
                      EXPLAIN
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      if (onExecuteQueryDirectly) {
                        onExecuteQueryDirectly(q.sql);
                      } else {
                        onSelectQuery(q.sql);
                      }
                    }}
                    title="直接在 SQL 工作台中运行该查询"
                    className="p-1 rounded hover:bg-monokai-border/50 text-monokai-comment hover:text-monokai-accent transition-colors cursor-pointer"
                  >
                    <Play className="w-3 h-3 text-monokai-accent fill-monokai-accent/30" />
                  </button>
                  <button
                    type="button"
                    onClick={e => handleCopySql(q.id, q.sql, e)}
                    title="复制 SQL 语句"
                    className="p-1 rounded hover:bg-monokai-border/50 text-monokai-comment hover:text-monokai-fg transition-colors cursor-pointer"
                  >
                    {copiedId === q.id ? (
                      <Check className="w-3 h-3 text-monokai-accent" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                  <span className="font-mono text-monokai-comment text-2xs">
                    {q.timestamp}
                  </span>
                </div>
              </div>
            ))}
            {queries.length > 8 && (
              <div className="pt-1.5 text-center">
                <button
                  type="button"
                  onClick={() => setShowAll(!showAll)}
                  className={`${DB.btnGhostLink} font-mono ${DB.focus}`}
                >
                  {showAll ? '收起部分记录' : `展开查看全部 (${queries.length} 条记录) ↓`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
