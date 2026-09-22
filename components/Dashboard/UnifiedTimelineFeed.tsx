import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Clock,
  Terminal,
  Play,
  Copy,
  ExternalLink,
  Search,
  Filter,
  RefreshCw,
  Table2,
  Layers,
  Sparkles,
  Database,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
} from 'lucide-react';
import { duckDBService } from '../../services/duckdbService';
import { toastService } from '../../services/toastService';
import { TimelineActivityItem } from './types';
import { Tab } from '../../types';

interface UnifiedTimelineFeedProps {
  onNavigate: (tab: Tab) => void;
  setPendingSql: (sql: string) => void;
  setCurrentTable: (table: string) => void;
  onLoadDemoDataset: () => Promise<void>;
  isSeedingDemo: boolean;
}

const SQL_HISTORY_KEY = 'duckdb_sql_history';

export const UnifiedTimelineFeed: React.FC<UnifiedTimelineFeedProps> = ({
  onNavigate,
  setPendingSql,
  setCurrentTable,
  onLoadDemoDataset,
  isSeedingDemo,
}) => {
  const [items, setItems] = useState<TimelineActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'query' | 'import' | 'ddl'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [rerunningId, setRerunningId] = useState<string | null>(null);

  // Load merged timeline data from 100% REAL sources
  const loadTimelineData = useCallback(async () => {
    setLoading(true);
    const combined: TimelineActivityItem[] = [];

    // 1. Read real SQL query history from localStorage
    try {
      const raw = localStorage.getItem(SQL_HISTORY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((h: any, idx: number) => {
            const sql = typeof h.sql === 'string' ? h.sql : '';
            if (!sql.trim()) return;
            const ts = typeof h.timestamp === 'number' ? h.timestamp : Date.now() - idx * 60000;
            const duration = typeof h.executionTime === 'number' ? h.executionTime : h.executionTimeMs;
            const isSuccess = h.status === 'success' || !h.error;

            combined.push({
              id: h.id || `hist_${ts}_${idx}`,
              type: 'query',
              title: isSuccess ? '执行 SQL 查询' : 'SQL 查询失败',
              timestamp: ts,
              sql,
              durationMs: duration,
              rowCount: h.rowCount,
              status: isSuccess ? 'success' : 'error',
              details: h.error,
            });
          });
        }
      }
    } catch (e) {
      console.warn('Failed to load SQL history:', e);
    }

    // 2. Read real DuckDB audit logs
    try {
      const auditLogs = await duckDBService.getAuditLogs(100);
      if (Array.isArray(auditLogs)) {
        auditLogs.forEach((log: any, idx: number) => {
          const op = String(log.operation_type || 'SYSTEM').toUpperCase();
          const targetTable = log.target_table ? String(log.target_table) : undefined;
          const logTime = log.log_time ? new Date(log.log_time).getTime() : Date.now() - idx * 120000;

          let type: 'import' | 'ddl' | 'table' | 'query' = 'table';
          let title = '系统操作';

          if (op === 'IMPORT') {
            type = 'import';
            title = `数据导入入库: ${targetTable || '未知表'}`;
          } else if (op.includes('CREATE') || op.includes('ALTER') || op.includes('DROP') || op === 'DDL') {
            type = 'ddl';
            title = `DDL 结构变更: ${op}`;
          } else if (op === 'QUERY') {
            type = 'query';
            title = '执行查询';
          }

          combined.push({
            id: `audit_${log.id || idx}_${logTime}`,
            type,
            title,
            timestamp: isNaN(logTime) ? Date.now() : logTime,
            sql: log.sql_statement,
            tableName: targetTable,
            rowCount: log.affected_rows,
            details: log.details,
            status: 'success',
          });
        });
      }
    } catch (e) {
      console.warn('Failed to load audit logs:', e);
    }

    // Sort descending by timestamp
    combined.sort((a, b) => b.timestamp - a.timestamp);

    setItems(combined);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadTimelineData();
  }, [loadTimelineData]);

  // Filtering
  const filteredItems = useMemo(() => {
    let result = items;
    if (filterType !== 'all') {
      result = result.filter(item => {
        if (filterType === 'query') return item.type === 'query';
        if (filterType === 'import') return item.type === 'import';
        if (filterType === 'ddl') return item.type === 'ddl' || item.type === 'table';
        return true;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(item =>
        (item.sql && item.sql.toLowerCase().includes(q)) ||
        (item.title && item.title.toLowerCase().includes(q)) ||
        (item.tableName && item.tableName.toLowerCase().includes(q)) ||
        (item.details && item.details.toLowerCase().includes(q))
      );
    }
    return result;
  }, [items, filterType, searchQuery]);

  // Re-run SQL in place
  const handleRerunSql = async (item: TimelineActivityItem) => {
    if (!item.sql) return;
    setRerunningId(item.id);
    const start = performance.now();
    try {
      const res = await duckDBService.query(item.sql);
      const elapsed = +(performance.now() - start).toFixed(2);
      const count = Array.isArray(res) ? res.length : 0;
      toastService.success(`SQL 重跑成功！返回 ${count} 行数据（耗时 ${elapsed}ms）`);
      void loadTimelineData();
    } catch (err: any) {
      console.error('Rerun SQL error:', err);
      toastService.error(`SQL 重跑异常: ${err?.message || '执行失败'}`);
    } finally {
      setRerunningId(null);
    }
  };

  // Copy SQL
  const handleCopySql = (sql: string) => {
    void navigator.clipboard.writeText(sql);
    toastService.success('已复制 SQL 语句至剪贴板');
  };

  // Format relative timestamp
  const formatTime = (ts: number) => {
    const diffSec = Math.floor((Date.now() - ts) / 1000);
    if (diffSec < 60) return `${Math.max(1, diffSec)} 秒前`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} 分钟前`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} 小时前`;
    const d = new Date(ts);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const counts = useMemo(() => {
    const qCount = items.filter(i => i.type === 'query').length;
    const impCount = items.filter(i => i.type === 'import').length;
    const ddlCount = items.filter(i => i.type === 'ddl' || i.type === 'table').length;
    return { all: items.length, query: qCount, import: impCount, ddl: ddlCount };
  }, [items]);

  return (
    <div className="rounded-md border border-monokai-border bg-monokai-surface/95 backdrop-blur-sm overflow-hidden font-sans shadow-xs">
      {/* Feed Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-monokai-border bg-monokai-elevated/70 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-monokai-cyan" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-monokai-fg">
            工作区时间轴流水
          </h2>
          <span className="rounded-md bg-monokai-bg border border-monokai-border px-1.5 py-0.2 font-mono text-2xs text-monokai-comment">
            {filteredItems.length} 条记录
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Filter */}
          <div className="flex items-center gap-1.5 rounded-md border border-monokai-border bg-monokai-bg px-2 h-7 focus-within:border-monokai-border-strong transition-colors w-48">
            <Search className="h-3 w-3 shrink-0 text-monokai-comment" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索 SQL、表名或动作…"
              className="h-full min-w-0 flex-1 border-0 bg-transparent text-xs text-monokai-fg outline-none placeholder:text-monokai-comment font-sans"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-0.5 bg-monokai-bg p-0.5 rounded-md border border-monokai-border font-mono text-meta">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                filterType === 'all'
                  ? 'bg-monokai-elevated text-monokai-fg font-bold'
                  : 'text-monokai-comment hover:text-monokai-fg'
              }`}
            >
              全部
            </button>
            <button
              type="button"
              onClick={() => setFilterType('query')}
              className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                filterType === 'query'
                  ? 'bg-monokai-elevated text-monokai-fg font-bold'
                  : 'text-monokai-comment hover:text-monokai-fg'
              }`}
            >
              SQL 查询
            </button>
            <button
              type="button"
              onClick={() => setFilterType('import')}
              className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                filterType === 'import'
                  ? 'bg-monokai-elevated text-monokai-fg font-bold'
                  : 'text-monokai-comment hover:text-monokai-fg'
              }`}
            >
              数据导入
            </button>
            <button
              type="button"
              onClick={() => setFilterType('ddl')}
              className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                filterType === 'ddl'
                  ? 'bg-monokai-elevated text-monokai-fg font-bold'
                  : 'text-monokai-comment hover:text-monokai-fg'
              }`}
            >
              表结构变更
            </button>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => void loadTimelineData()}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-monokai-border bg-monokai-bg text-monokai-comment hover:text-monokai-fg hover:border-monokai-border-strong transition-colors cursor-pointer"
            title="刷新流水线"
            aria-label="刷新流水线"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Feed Content */}
      <div className="p-4">
        {loading ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-xs font-mono text-monokai-comment">
            <RefreshCw className="h-5 w-5 animate-spin text-monokai-fg" />
            <span>正在读取 DuckDB 系统审计记录与执行流水…</span>
          </div>
        ) : filteredItems.length === 0 ? (
          /* HONEST EMPTY STATE (ZERO MOCK) */
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-md border border-dashed border-monokai-border bg-monokai-bg/60">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-monokai-elevated border border-monokai-border text-monokai-comment mb-3">
              <Clock className="h-5 w-5" />
            </div>
            <h3 className="text-xs font-bold text-monokai-fg">
              {searchQuery ? '未找到匹配的流水记录' : '当前工作区暂无历史操作足迹'}
            </h3>
            <p className="mt-1 max-w-md text-meta text-monokai-comment leading-relaxed">
              {searchQuery
                ? '尝试更换检索词，或清空筛选条件查看完整记录。'
                : 'DuckDB 拒绝虚构 Mock 数据。一旦你在编辑器中运行 SQL 查询、或通过上方探查雷达导入数据，真实的执行耗时与审计足迹将自动在此呈现。'}
            </p>
            {!searchQuery && (
              <div className="mt-4 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => onNavigate(Tab.SQL)}
                  className="flex h-7 items-center gap-1.5 rounded-md border border-monokai-border bg-monokai-surface px-3 text-xs font-semibold text-monokai-fg hover:border-monokai-border-strong hover:bg-monokai-elevated transition-all cursor-pointer"
                >
                  <Terminal className="h-3 w-3 text-monokai-comment" />
                  <span>执行一次查询</span>
                </button>
                <button
                  type="button"
                  onClick={() => void onLoadDemoDataset()}
                  disabled={isSeedingDemo}
                  className="flex h-7 items-center gap-1.5 rounded-md border border-monokai-border bg-monokai-surface px-3 text-xs font-semibold text-monokai-fg hover:border-monokai-border-strong hover:bg-monokai-elevated transition-all cursor-pointer"
                >
                  <Sparkles className="h-3 w-3 text-monokai-comment" />
                  <span>{isSeedingDemo ? '载入中…' : '载入 6 表 Demo'}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          /* TIMELINE CARDS */
          <div className="space-y-3">
            {filteredItems.map(item => {
              const isExpanded = Boolean(expandedItems[item.id]);
              const isRerunning = rerunningId === item.id;

              // Type styles
              let badgeColor = 'border-monokai-border bg-monokai-surface text-monokai-fg';
              let badgeLabel = 'SQL 查询';
              let Icon = Terminal;

              if (item.type === 'import') {
                badgeColor = 'border-monokai-border bg-monokai-surface text-monokai-fg';
                badgeLabel = '数据导入';
                Icon = FileSpreadsheet;
              } else if (item.type === 'ddl') {
                badgeColor = 'border-monokai-border bg-monokai-surface text-monokai-fg';
                badgeLabel = 'DDL 变更';
                Icon = Layers;
              } else if (item.type === 'table') {
                badgeColor = 'border-monokai-border bg-monokai-surface text-monokai-fg';
                badgeLabel = '数据表';
                Icon = Table2;
              }

              return (
                <div
                  key={item.id}
                  className="group rounded-md border border-monokai-border bg-monokai-bg p-3 hover:border-monokai-border-strong hover:bg-monokai-elevated/30 transition-all"
                >
                  {/* Item Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.2 font-mono text-2xs font-bold ${badgeColor}`}
                      >
                        <Icon className="h-3 w-3" />
                        <span>{badgeLabel}</span>
                      </span>

                      <span className="text-xs font-semibold text-monokai-fg truncate">
                        {item.title}
                      </span>

                      {item.tableName && (
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentTable(item.tableName!);
                            onNavigate(Tab.DATA);
                          }}
                          className="flex items-center gap-1 rounded-md bg-monokai-surface px-1.5 py-0.2 font-mono text-2xs text-monokai-fg border border-monokai-border hover:border-monokai-border-strong transition-colors cursor-pointer"
                          title="在数据网格中查看该表"
                        >
                          <Table2 className="h-2.5 w-2.5 text-monokai-comment" />
                          <span>{item.tableName}</span>
                        </button>
                      )}
                    </div>

                    {/* Metadata & Actions */}
                    <div className="flex items-center gap-2 font-mono text-meta text-monokai-comment">
                      {item.durationMs !== undefined && (
                        <span className="text-monokai-green">
                          {item.durationMs.toFixed(1)}ms
                        </span>
                      )}
                      {item.rowCount !== undefined && (
                        <span>{item.rowCount} 行</span>
                      )}
                      <span>·</span>
                      <span>{formatTime(item.timestamp)}</span>

                      {/* Action Bar */}
                      <div className="flex items-center gap-1 ml-2">
                        {item.sql && (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleRerunSql(item)}
                              disabled={isRerunning}
                              className="flex items-center gap-1 rounded-md border border-monokai-border bg-monokai-surface px-2 py-0.5 text-meta text-monokai-fg hover:border-monokai-border-strong hover:bg-monokai-elevated transition-colors cursor-pointer disabled:opacity-50"
                              title="现场重新执行该 SQL 查询"
                            >
                              <Play className={`h-2.5 w-2.5 ${isRerunning ? 'animate-spin' : ''}`} />
                              <span>{isRerunning ? '执行中…' : '重跑'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setPendingSql(item.sql!);
                                onNavigate(Tab.SQL);
                              }}
                              className="flex items-center gap-1 rounded-md border border-monokai-border bg-monokai-surface px-2 py-0.5 text-meta text-monokai-fg hover:border-monokai-border-strong hover:bg-monokai-elevated transition-colors cursor-pointer"
                              title="在全功能 SQL 编辑器中打开"
                            >
                              <ExternalLink className="h-2.5 w-2.5" />
                              <span>编辑器</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleCopySql(item.sql!)}
                              className="rounded-md p-1 text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface transition-colors cursor-pointer"
                              title="复制 SQL"
                              aria-label="复制 SQL"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* SQL Snippet Body */}
                  {item.sql && (
                    <div className="mt-2 relative rounded-md border border-monokai-border/80 bg-monokai-surface/80 p-2 font-mono text-meta text-monokai-fg overflow-hidden">
                      <pre
                        className={`whitespace-pre-wrap break-all transition-all select-text leading-relaxed ${
                          isExpanded ? '' : 'line-clamp-2'
                        }`}
                      >
                        {item.sql}
                      </pre>
                      {item.sql.length > 100 && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedItems(prev => ({
                              ...prev,
                              [item.id]: !isExpanded,
                            }))
                          }
                          className="mt-1 flex items-center gap-0.5 text-2xs text-monokai-comment hover:text-monokai-cyan transition-colors cursor-pointer"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="h-2.5 w-2.5" />
                              <span>收起完整 SQL</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-2.5 w-2.5" />
                              <span>展开完整 SQL</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Details or Error Body */}
                  {item.details && (
                    <p
                      className={`mt-1.5 text-meta font-mono leading-relaxed ${
                        item.status === 'error'
                          ? 'text-monokai-pink'
                          : 'text-monokai-comment'
                      }`}
                    >
                      {item.details}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
