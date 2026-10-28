import React, { useState, useMemo } from 'react';
import {
  Play,
  Copy,
  Check,
  Clock,
  Search,
  MoreHorizontal,
  FileSearch,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { Tab } from '../../../types';
import { type RecentQueryDisplayItem } from '../../../hooks/useDashboardWorkflow';
import { toastService } from '../../../services/toastService';
import { useAppStore } from '../../../hooks/store/useAppStore';
import { DB } from '../dashboardUi';

interface LiveQueryStreamProps {
  queries: RecentQueryDisplayItem[];
  onSelectQuery: (sql: string) => void;
  onExecuteQueryDirectly?: (sql: string) => void;
  onNavigate: (tab: Tab) => void;
  controlledFilter?: 'all' | 'success' | 'error' | 'slow';
  onFilterChange?: (filter: 'all' | 'success' | 'error' | 'slow') => void;
  highlightedQueryId?: string | null;
}

export const LiveQueryStream: React.FC<LiveQueryStreamProps> = ({
  queries = [],
  onSelectQuery,
  onExecuteQueryDirectly,
  onNavigate,
  controlledFilter,
  onFilterChange,
  highlightedQueryId,
}) => {
  const [activeMode, setActiveMode] = useState<'stream' | 'slow_ranking' | 'percentiles'>('stream');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error' | 'slow'>(
    controlledFilter || 'all'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [menuQueryId, setMenuQueryId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const setPendingAiPanel = useAppStore((s) => s.setPendingAiPanel);

  React.useEffect(() => {
    if (controlledFilter) {
      setStatusFilter(controlledFilter);
    }
  }, [controlledFilter]);

  React.useEffect(() => {
    if (highlightedQueryId) {
      setExpandedId(highlightedQueryId);
    }
  }, [highlightedQueryId]);

  const handleFilterClick = (filter: 'all' | 'success' | 'error' | 'slow') => {
    setStatusFilter(filter);
    onFilterChange?.(filter);
  };

  const successCount = useMemo(() => queries.filter((q) => q.status === 'success').length, [queries]);
  const errorCount = useMemo(() => queries.filter((q) => q.status === 'error').length, [queries]);
  const slowCount = useMemo(() => {
    return queries.filter((q) => {
      const ms = q.executionTime ?? (parseFloat(q.duration) || 0);
      return ms >= 200;
    }).length;
  }, [queries]);

  const filteredQueries = useMemo(() => {
    return queries.filter((q) => {
      if (statusFilter === 'success' && q.status !== 'success') return false;
      if (statusFilter === 'error' && q.status !== 'error') return false;
      if (statusFilter === 'slow') {
        const ms = q.executionTime ?? (parseFloat(q.duration) || 0);
        if (ms < 200) return false;
      }
      if (searchTerm.trim() && !q.sql.toLowerCase().includes(searchTerm.toLowerCase().trim())) {
        return false;
      }
      return true;
    });
  }, [queries, statusFilter, searchTerm]);

  // Top Slow Queries Ranking calculation
  const slowRanking = useMemo(() => {
    const list = [...queries]
      .map((q) => {
        const ms = q.executionTime ?? (parseFloat(q.duration) || 0);
        return { ...q, numericMs: ms };
      })
      .sort((a, b) => b.numericMs - a.numericMs);

    const maxMs = list.length > 0 ? Math.max(list[0].numericMs, 1) : 1;
    return {
      topList: list.slice(0, 10),
      maxMs,
    };
  }, [queries]);

  // Latency Percentiles & Distribution Statistics
  const latencyStats = useMemo(() => {
    if (queries.length === 0) {
      return {
        p50: 0,
        p90: 0,
        p99: 0,
        min: 0,
        max: 0,
        avg: 0,
        fastCount: 0,
        goodCount: 0,
        mediumCount: 0,
        slowCount: 0,
        fastPct: 0,
        goodPct: 0,
        mediumPct: 0,
        slowPct: 0,
      };
    }
    const times = queries
      .map((q) => q.executionTime ?? (parseFloat(q.duration) || 0))
      .sort((a, b) => a - b);

    const getP = (pct: number) => {
      const idx = Math.min(times.length - 1, Math.floor((pct / 100) * times.length));
      return Math.round(times[idx] * 10) / 10;
    };

    const sum = times.reduce((acc, t) => acc + t, 0);
    const avg = Math.round((sum / times.length) * 10) / 10;
    const min = Math.round(times[0] * 10) / 10;
    const max = Math.round(times[times.length - 1] * 10) / 10;

    let fastCount = 0;
    let goodCount = 0;
    let mediumCount = 0;
    let slowCount = 0;

    times.forEach((t) => {
      if (t < 10) fastCount++;
      else if (t < 50) goodCount++;
      else if (t < 200) mediumCount++;
      else slowCount++;
    });

    return {
      p50: getP(50),
      p90: getP(90),
      p99: getP(99),
      min,
      max,
      avg,
      fastCount,
      goodCount,
      mediumCount,
      slowCount,
      fastPct: Math.round((fastCount / times.length) * 100),
      goodPct: Math.round((goodCount / times.length) * 100),
      mediumPct: Math.round((mediumCount / times.length) * 100),
      slowPct: Math.round((slowCount / times.length) * 100),
    };
  }, [queries]);

  const handleCopy = (id: string, sql: string, e: React.MouseEvent) => {
    e.stopPropagation();
    void navigator.clipboard.writeText(sql);
    setCopiedId(id);
    toastService.success('已复制 SQL 语句到剪贴板');
    setTimeout(() => setCopiedId(null), 1200);
  };

  const handleRun = (sql: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onExecuteQueryDirectly) {
      onExecuteQueryDirectly(sql);
    } else {
      onSelectQuery(sql);
      onNavigate(Tab.SQL);
    }
  };

  const handleExplainPlan = (sql: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuQueryId(null);
    const explainSql = sql.trim().toUpperCase().startsWith('EXPLAIN')
      ? sql
      : `EXPLAIN ANALYZE\n${sql};`;
    onSelectQuery(explainSql);
    onNavigate(Tab.SQL);
    toastService.info('已生成执行分析计划 (EXPLAIN ANALYZE)');
  };

  const handleAiExplain = (sql: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuQueryId(null);
    setPendingAiPanel('explain');
    onSelectQuery(sql);
    onNavigate(Tab.SQL);
    toastService.info('正在打开 AI 解释面板…');
  };

  const handleRowActivate = (q: RecentQueryDisplayItem) => {
    // Inspect in place first — avoid accidental full-page jumps away from Mission Control
    setExpandedId((prev) => (prev === q.id ? null : q.id));
  };

  return (
    <div className={`${DB.panelLg}`}>
      {/* Quiet panel chrome */}
      <div className="flex flex-col gap-2 border-b border-monokai-border/80 pb-2.5 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2 min-w-0">
            <h2 className="text-sm font-semibold text-monokai-fg font-sans tracking-tight">最近查询</h2>
            <span className="font-mono text-2xs text-monokai-comment tabular-nums">
              {queries.length}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onNavigate(Tab.HISTORY)}
            className={DB.btnGhostLink}
            title="查看完整查询历史"
          >
            <span>全部历史</span>
            <span>→</span>
          </button>
        </div>

        {/* Mode: stream | slow | percentiles — compact labels */}
        <div className={DB.segment}>
          <button
            type="button"
            onClick={() => setActiveMode('stream')}
            className={`${activeMode === 'stream' ? DB.segmentItemActive : DB.segmentItem} ${DB.focus}`}
          >
            流水
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('slow_ranking')}
            className={`${activeMode === 'slow_ranking' ? DB.segmentItemActive : DB.segmentItem} flex items-center gap-1 ${DB.focus}`}
          >
            <span>慢查询</span>
            {slowCount > 0 && (
              <span className="rounded bg-monokai-orange/20 text-monokai-orange px-1 text-3xs font-mono">
                {slowCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('percentiles')}
            className={`${activeMode === 'percentiles' ? DB.segmentItemActive : DB.segmentItem} ${DB.focus}`}
          >
            分位数
          </button>
        </div>

        {/* Filter Bar: Status Tabs + Search */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Status Pills */}
          <div className={`${DB.segment} shrink-0 gap-0.5`}>
            <button
              type="button"
              aria-label="全部"
              onClick={() => handleFilterClick('all')}
              className={`${statusFilter === 'all' ? DB.segmentItemActive : DB.segmentItem} flex items-center gap-1 ${DB.focus}`}
            >
              <span>全部</span>
              {queries.length > 0 && (
                <span className="text-2xs opacity-75 font-mono">({queries.length})</span>
              )}
            </button>
            <button
              type="button"
              aria-label="成功"
              onClick={() => handleFilterClick('success')}
              className={`${statusFilter === 'success' ? DB.segmentItemActive : DB.segmentItem} flex items-center gap-1 ${DB.focus}`}
            >
              <span>成功</span>
              {successCount > 0 && (
                <span className="text-2xs opacity-75 font-mono">({successCount})</span>
              )}
            </button>
            <button
              type="button"
              aria-label="失败"
              onClick={() => handleFilterClick('error')}
              className={`rounded px-2.5 py-0.5 text-xs font-mono transition-colors cursor-pointer flex items-center gap-1 ${
                statusFilter === 'error'
                  ? 'bg-monokai-pink text-monokai-bg font-bold shadow-xs'
                  : errorCount > 0
                    ? 'text-monokai-pink hover:bg-monokai-pink/15'
                    : 'text-monokai-fg-muted hover:text-monokai-fg'
              }`}
            >
              <span>失败</span>
              {errorCount > 0 && (
                <span className="rounded bg-monokai-pink text-monokai-bg px-1 text-3xs font-bold">
                  {errorCount}
                </span>
              )}
            </button>
            <button
              type="button"
              aria-label="慢查询"
              onClick={() => handleFilterClick('slow')}
              className={`rounded px-2 py-0.5 text-xs font-mono transition-colors cursor-pointer flex items-center gap-1 ${
                statusFilter === 'slow'
                  ? 'bg-monokai-yellow text-monokai-bg font-bold shadow-xs'
                  : slowCount > 0
                    ? 'text-monokai-yellow hover:bg-monokai-yellow/15'
                    : 'text-monokai-fg-muted hover:text-monokai-fg'
              }`}
              title="过滤耗时大于 200ms 的慢查询"
            >
              <span>慢查询</span>
              {slowCount > 0 && (
                <span className="rounded bg-monokai-yellow text-monokai-bg px-1 text-3xs font-bold">
                  {slowCount}
                </span>
              )}
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex items-center flex-1 min-w-[150px] max-w-[220px]">
            <Search className="absolute left-2.5 h-3.5 w-3.5 text-monokai-comment pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="过滤 SQL 语句..."
              className={DB.input}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 text-monokai-comment hover:text-monokai-fg font-mono text-xs cursor-pointer"
                title="清除搜索"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stream Table or Specialized Mode */}
      {activeMode === 'stream' ? (
        queries.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center space-y-2 p-3 sm:p-4 text-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-monokai-border bg-monokai-elevated text-monokai-comment">
            <Clock className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-xs sm:text-sm font-semibold text-monokai-fg">暂无查询执行流水</p>
            <p className="mt-0.5 text-xs text-monokai-comment">
              在 SQL 编辑器中运行查询后，此处将实时捕获精准耗时、扫描行数与执行状态。
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate(Tab.SQL)}
            className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-monokai-accent text-monokai-bg font-semibold px-3 py-1 text-xs hover:bg-monokai-accent/90 transition-all cursor-pointer shadow-xs"
          >
            <Play className="h-3 w-3 fill-current" />
            <span>进入 SQL 工作区执行查询</span>
          </button>
        </div>
      ) : filteredQueries.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center space-y-1.5 p-3 sm:p-4 text-center text-monokai-comment text-xs font-mono">
          <p>无匹配过滤条件的查询记录</p>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('all');
              setSearchTerm('');
            }}
            className="text-xs text-monokai-cyan hover:underline cursor-pointer"
          >
            重置筛选条件
          </button>
        </div>
      ) : (
        <div className="mt-1 flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar pr-0.5">
          <table className="w-full table-fixed text-left font-mono text-xs">
            <thead className="sticky top-0 bg-monokai-surface z-10">
              <tr className="border-b border-monokai-border text-meta uppercase tracking-wider text-monokai-comment">
                <th className="w-[82px] py-2 pl-1 pr-2 font-medium">时间</th>
                <th className="py-2 px-2 font-medium">SQL 片段</th>
                <th className="w-[56px] py-2 px-1 font-medium text-center">状态</th>
                <th className="w-[64px] py-2 px-1 font-medium text-right">耗时</th>
                <th className="w-[98px] py-2 pl-2 pr-1 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-monokai-border/40">
              {filteredQueries.slice(0, 15).map((q) => {
                const isCopied = copiedId === q.id;
                const isMenuOpen = menuQueryId === q.id;
                const isExpanded = expandedId === q.id;
                const isHighlighted = highlightedQueryId === q.id;
                const formattedTime = q.timestamp.includes('T')
                  ? q.timestamp.split('T')[1].slice(0, 5)
                  : q.timestamp.length > 5
                    ? q.timestamp.slice(-5)
                    : q.timestamp;

                return (
                  <React.Fragment key={q.id}>
                    <tr
                      onClick={() => handleRowActivate(q)}
                      className={`group hover:bg-monokai-hover/60 transition-colors cursor-pointer ${
                        isHighlighted
                          ? 'bg-monokai-cyan/15 ring-1 ring-monokai-cyan'
                          : isExpanded
                            ? 'bg-monokai-elevated/40'
                            : ''
                      }`}
                      title="点击展开详情；用右侧按钮执行 / AI 解释 / 复制"
                    >
                      <td className="w-[82px] py-2 pl-1 pr-2 text-xs font-mono text-monokai-fg-muted whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedId(isExpanded ? null : q.id);
                            }}
                            className="p-0.5 rounded hover:bg-monokai-hover text-monokai-comment hover:text-monokai-fg cursor-pointer"
                            title={isExpanded ? '折叠详情' : '展开查看完整 SQL 与错误诊断'}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3 w-3 text-monokai-cyan" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                          </button>
                          <span
                            className={`h-1.5 w-1.5 rounded-full shrink-0 shadow-xs ${
                              q.status === 'success'
                                ? 'bg-monokai-accent'
                                : 'bg-monokai-pink'
                            }`}
                          />
                          <span>{formattedTime}</span>
                          {isHighlighted && (
                            <span className="rounded bg-monokai-cyan/25 text-monokai-cyan px-1 py-0.2 text-3xs font-bold">
                              APM
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-monokai-fg truncate group-hover:text-monokai-cyan transition-colors font-mono text-xs">
                        <div className="truncate" title={q.sql}>{q.sql}</div>
                        {q.error && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedId(isExpanded ? null : q.id);
                            }}
                            className="text-meta font-mono text-monokai-pink truncate mt-0.5 flex items-center gap-1 hover:underline cursor-pointer"
                            title={q.error}
                          >
                            <AlertCircle className="h-3 w-3 shrink-0" />
                            <span>异常: {q.error}</span>
                          </div>
                        )}
                      </td>
                      <td className="w-[56px] py-2 px-1 text-center whitespace-nowrap">
                        {q.status === 'success' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-monokai-accent font-medium">
                            <span className="h-1.5 w-1.5 rounded-full bg-monokai-accent" />
                            成功
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-monokai-pink font-medium">
                            <span className="h-1.5 w-1.5 rounded-full bg-monokai-pink" />
                            失败
                          </span>
                        )}
                      </td>
                      <td className="w-[64px] py-2 px-1 text-right font-mono text-xs whitespace-nowrap">
                        <span
                          className={
                            (q.executionTime ?? parseFloat(q.duration)) >= 200
                              ? 'text-monokai-yellow font-bold'
                              : 'text-monokai-fg-muted'
                          }
                        >
                          {q.duration}
                        </span>
                      </td>
                      <td className="w-[98px] py-2 pl-2 pr-1 text-right whitespace-nowrap relative">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={(e) => handleRun(q.sql, e)}
                            className="flex h-6 w-6 items-center justify-center rounded border border-monokai-border bg-monokai-elevated text-monokai-fg-muted hover:border-monokai-accent hover:text-monokai-accent transition-colors cursor-pointer"
                            title="立即重新执行此查询"
                          >
                            <Play className="h-3 w-3 fill-current" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleAiExplain(q.sql, e)}
                            className={`flex h-6 w-6 items-center justify-center rounded border transition-colors cursor-pointer ${
                              q.status === 'error'
                                ? 'border-monokai-purple/50 bg-monokai-purple/15 text-monokai-purple hover:bg-monokai-purple/25'
                                : 'border-monokai-border bg-monokai-elevated text-monokai-fg-muted hover:border-monokai-purple hover:text-monokai-purple'
                            }`}
                            title="AI 解释：与 SQL 编辑器「解释」一致，说明查询意图与逻辑"
                          >
                            <Sparkles className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleCopy(q.id, q.sql, e)}
                            className="flex h-6 w-6 items-center justify-center rounded border border-monokai-border bg-monokai-elevated text-monokai-fg-muted hover:border-monokai-cyan hover:text-monokai-cyan transition-colors cursor-pointer"
                            title="复制 SQL 语句"
                          >
                            {isCopied ? <Check className="h-3 w-3 text-monokai-accent" /> : <Copy className="h-3 w-3" />}
                          </button>
                          
                          {/* More Actions Menu Button */}
                          <div className="relative inline-block">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuQueryId(isMenuOpen ? null : q.id);
                              }}
                              className={`flex h-6 w-6 items-center justify-center rounded border transition-colors cursor-pointer ${
                                isMenuOpen
                                  ? 'border-monokai-cyan bg-monokai-cyan/20 text-monokai-cyan'
                                  : 'border-monokai-border bg-monokai-elevated text-monokai-comment hover:text-monokai-fg'
                              }`}
                              title="更多操作"
                            >
                              <MoreHorizontal className="h-3 w-3" />
                            </button>

                            {/* Action Dropdown Menu */}
                            {isMenuOpen && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-full mt-1 z-30 w-40 rounded-md border border-monokai-border-strong bg-monokai-elevated py-1 shadow-lg text-left animate-in fade-in duration-100"
                              >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuQueryId(null);
                                    onSelectQuery(q.sql);
                                    onNavigate(Tab.SQL);
                                  }}
                                  className="w-full px-2.5 py-1 text-xs font-mono text-monokai-fg hover:bg-monokai-hover flex items-center gap-1.5 transition-colors cursor-pointer"
                                >
                                  <ExternalLink className="h-3 w-3 text-monokai-cyan" />
                                  <span>在编辑器打开</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleAiExplain(q.sql, e)}
                                  className="w-full px-2.5 py-1 text-xs font-mono text-monokai-fg hover:bg-monokai-hover flex items-center gap-1.5 transition-colors cursor-pointer"
                                  title="用 AI 解释查询意图与逻辑（与 SQL 编辑器一致）"
                                >
                                  <Sparkles className="h-3 w-3 text-monokai-purple" />
                                  <span>AI 解释</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleExplainPlan(q.sql, e)}
                                  className="w-full px-2.5 py-1 text-xs font-mono text-monokai-fg hover:bg-monokai-hover flex items-center gap-1.5 transition-colors cursor-pointer"
                                >
                                  <FileSearch className="h-3 w-3 text-monokai-yellow" />
                                  <span>执行计划分析</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    handleCopy(q.id, q.sql, e);
                                    setMenuQueryId(null);
                                  }}
                                  className="w-full px-2.5 py-1 text-xs font-mono text-monokai-fg hover:bg-monokai-hover flex items-center gap-1.5 transition-colors cursor-pointer"
                                >
                                  <Copy className="h-3 w-3 text-monokai-accent" />
                                  <span>复制纯文本</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* Inline Accordion Detail View */}
                    {isExpanded && (
                      <tr className="bg-monokai-elevated/40 border-b border-monokai-border/80">
                        <td colSpan={5} className="p-2.5">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-meta text-monokai-comment font-mono">
                              <span className="flex items-center gap-1 text-monokai-fg-muted font-bold">
                                <span>完整执行语句</span>
                                {q.rowCount != null && (
                                  <span className="text-2xs text-monokai-accent">({q.rowCount} 行扫描)</span>
                                )}
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => handleAiExplain(q.sql, e)}
                                  className="text-monokai-purple hover:underline cursor-pointer inline-flex items-center gap-1"
                                  title="AI 解释查询意图"
                                >
                                  <Sparkles className="h-3 w-3" />
                                  AI 解释
                                </button>
                                <span>·</span>
                                <button
                                  type="button"
                                  onClick={(e) => handleCopy(q.id, q.sql, e)}
                                  className="text-monokai-cyan hover:underline cursor-pointer"
                                >
                                  复制 SQL
                                </button>
                                <span>·</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onSelectQuery(q.sql);
                                    onNavigate(Tab.SQL);
                                  }}
                                  className="text-monokai-accent hover:underline cursor-pointer"
                                >
                                  在编辑器中打开
                                </button>
                              </div>
                            </div>

                            <pre className="rounded border border-monokai-border bg-monokai-bg p-2 text-xs font-mono text-monokai-fg overflow-x-auto whitespace-pre-wrap max-h-32 custom-scrollbar select-all">
                              {q.sql}
                            </pre>

                            {q.error && (
                              <div className="rounded border border-monokai-pink/40 bg-monokai-pink/15 p-2.5 text-xs font-mono text-monokai-pink space-y-1.5">
                                <div className="flex items-start gap-1.5">
                                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-monokai-pink" />
                                  <div className="flex-1">
                                    <div className="font-bold flex items-center justify-between gap-2">
                                      <span>执行异常诊断信息:</span>
                                    </div>
                                    <div className="mt-0.5 opacity-90 break-words">{q.error}</div>
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={(e) => handleAiExplain(q.sql, e)}
                                        className="inline-flex items-center gap-1 rounded border border-monokai-purple/50 bg-monokai-purple/20 px-2 py-1 text-meta font-sans font-semibold text-monokai-purple hover:bg-monokai-purple/30 cursor-pointer"
                                      >
                                        <Sparkles className="h-3 w-3" />
                                        AI 解释这段 SQL
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          onSelectQuery(q.sql);
                                          onNavigate(Tab.SQL);
                                        }}
                                        className="inline-flex items-center gap-1 rounded border border-monokai-border bg-monokai-elevated px-2 py-1 text-meta font-sans text-monokai-fg hover:border-monokai-cyan cursor-pointer"
                                      >
                                        去编辑器修正 →
                                      </button>
                                    </div>
                                  </div>
                                </div>
                                <div className="border-t border-monokai-pink/20 pt-1 text-meta text-monokai-fg-muted font-sans flex items-center gap-1">
                                  <span className="text-monokai-yellow font-bold">诊断提示:</span>
                                  <span>
                                    {q.error.toLowerCase().includes('does not exist') || q.error.toLowerCase().includes('not found')
                                      ? '目标数据表或字段不存在，请核实拼写，或先通过“导入数据”完成挂载'
                                      : q.error.toLowerCase().includes('syntax')
                                        ? 'SQL 语法解析异常，请检查关键字、括号闭合或标点符号'
                                        : q.error.toLowerCase().includes('type')
                                          ? '字段类型转换冲突，建议使用 CAST(col AS type) 显式转换'
                                          : '可先用 AI 解释理清意图，再在编辑器中修正后重跑'}
                                  </span>
                                </div>
                              </div>
                            )}
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
      )
    ) : activeMode === 'slow_ranking' ? (
        <div className="mt-2 flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-0.5">
          <div className="flex items-center justify-between text-xs font-mono text-monokai-comment px-1 pb-1 border-b border-monokai-border">
            <span>Top 耗时慢查询榜单 (按执行耗时降序)</span>
            <span>共 {slowRanking.topList.length} 条</span>
          </div>

          {slowRanking.topList.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center text-monokai-comment text-xs font-mono">
              暂无查询执行数据
            </div>
          ) : (
            slowRanking.topList.map((q, idx) => {
              const pct = Math.min(100, Math.max(8, Math.round((q.numericMs / slowRanking.maxMs) * 100)));
              const isSlow = q.numericMs >= 200;
              const isVerySlow = q.numericMs >= 500;
              return (
                <div
                  key={q.id || idx}
                  className="rounded-md border border-monokai-border bg-monokai-elevated/40 p-2.5 space-y-1.5 hover:border-monokai-orange/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`flex h-5 w-5 items-center justify-center rounded text-meta font-mono font-bold ${
                        idx === 0
                          ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                          : idx === 1
                            ? 'bg-zinc-300/20 text-zinc-200 border border-zinc-300/40'
                            : idx === 2
                              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                              : 'bg-monokai-surface text-monokai-comment'
                      }`}>
                        #{idx + 1}
                      </span>
                      <span className={`text-xs font-mono font-bold ${
                        isVerySlow
                          ? 'text-monokai-pink'
                          : isSlow
                            ? 'text-monokai-orange'
                            : 'text-monokai-accent'
                      }`}>
                        {q.duration || `${q.numericMs.toFixed(1)} ms`}
                      </span>
                      {q.status === 'error' && (
                        <span className="rounded bg-monokai-pink/20 text-monokai-pink text-2xs font-mono px-1">
                          失败
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectQuery(`EXPLAIN ${q.sql}`);
                          onNavigate(Tab.SQL);
                        }}
                        className="rounded bg-monokai-surface border border-monokai-border px-2 py-0.5 text-meta font-mono text-monokai-cyan hover:border-monokai-cyan transition-colors cursor-pointer"
                        title="在 SQL 编辑器中查看查询计划"
                      >
                        EXPLAIN
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleAiExplain(q.sql, e)}
                        className="rounded bg-monokai-purple/15 border border-monokai-purple/30 px-2 py-0.5 text-meta font-mono text-monokai-purple hover:bg-monokai-purple/25 transition-colors cursor-pointer"
                        title="AI 分析该查询性能瓶颈"
                      >
                        调优建议
                      </button>
                    </div>
                  </div>

                  {/* Relative Duration Progress Bar */}
                  <div className="h-1.5 w-full bg-monokai-bg rounded-full overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className={`h-full rounded-full transition-all ${
                        isVerySlow
                          ? 'bg-monokai-pink'
                          : isSlow
                            ? 'bg-monokai-orange'
                            : 'bg-monokai-accent'
                      }`}
                    />
                  </div>

                  {/* SQL Preview */}
                  <div className="rounded bg-monokai-bg/80 px-2 py-1 font-mono text-meta text-monokai-fg-muted truncate">
                    {q.sql}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="mt-2 flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-0.5">
          {/* Latency Percentiles Scorecard */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="rounded-md border border-monokai-border bg-monokai-elevated/40 p-2.5 text-center">
              <div className="text-2xs text-monokai-comment font-mono">P50 中位数延迟</div>
              <div className="text-base font-bold font-mono text-monokai-accent mt-0.5">
                {latencyStats.p50} ms
              </div>
            </div>
            <div className="rounded-md border border-monokai-border bg-monokai-elevated/40 p-2.5 text-center">
              <div className="text-2xs text-monokai-comment font-mono">P90 高位延迟</div>
              <div className="text-base font-bold font-mono text-monokai-yellow mt-0.5">
                {latencyStats.p90} ms
              </div>
            </div>
            <div className="rounded-md border border-monokai-border bg-monokai-elevated/40 p-2.5 text-center">
              <div className="text-2xs text-monokai-comment font-mono">P99 峰值延迟</div>
              <div className="text-base font-bold font-mono text-monokai-pink mt-0.5">
                {latencyStats.p99} ms
              </div>
            </div>
            <div className="rounded-md border border-monokai-border bg-monokai-elevated/40 p-2.5 text-center">
              <div className="text-2xs text-monokai-comment font-mono">平均耗时 / 极值</div>
              <div className="text-xs font-bold font-mono text-monokai-cyan mt-1">
                均: {latencyStats.avg}ms · 极: {latencyStats.max}ms
              </div>
            </div>
          </div>

          {/* Latency Distribution Histogram Breakdown */}
          <div className="rounded-md border border-monokai-border bg-monokai-elevated/30 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-monokai-fg">
              <span>查询耗时区间分布 (Latency Buckets)</span>
              <span className="text-monokai-comment">{queries.length} 次样本</span>
            </div>

            <div className="flex h-3 w-full overflow-hidden rounded-full bg-monokai-bg border border-monokai-border/80">
              {latencyStats.fastPct > 0 && (
                <div style={{ width: `${latencyStats.fastPct}%` }} className="bg-monokai-accent" title={`<10ms: ${latencyStats.fastCount} 次`} />
              )}
              {latencyStats.goodPct > 0 && (
                <div style={{ width: `${latencyStats.goodPct}%` }} className="bg-monokai-cyan" title={`10-50ms: ${latencyStats.goodCount} 次`} />
              )}
              {latencyStats.mediumPct > 0 && (
                <div style={{ width: `${latencyStats.mediumPct}%` }} className="bg-monokai-yellow" title={`50-200ms: ${latencyStats.mediumCount} 次`} />
              )}
              {latencyStats.slowPct > 0 && (
                <div style={{ width: `${latencyStats.slowPct}%` }} className="bg-monokai-pink" title={`>200ms: ${latencyStats.slowCount} 次`} />
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 text-meta font-mono">
              <div className="flex items-center gap-1.5 text-monokai-fg">
                <span className="h-2 w-2 rounded-full bg-monokai-accent" />
                <span>&lt;10ms 极速执行 ({latencyStats.fastCount} 次)</span>
              </div>
              <div className="flex items-center gap-1.5 text-monokai-fg">
                <span className="h-2 w-2 rounded-full bg-monokai-cyan" />
                <span>10-50ms 良好响应 ({latencyStats.goodCount} 次)</span>
              </div>
              <div className="flex items-center gap-1.5 text-monokai-fg">
                <span className="h-2 w-2 rounded-full bg-monokai-yellow" />
                <span>50-200ms 常规复杂查询 ({latencyStats.mediumCount} 次)</span>
              </div>
              <div className="flex items-center gap-1.5 text-monokai-fg">
                <span className="h-2 w-2 rounded-full bg-monokai-pink" />
                <span>&gt;200ms 慢查询 ({latencyStats.slowCount} 次)</span>
              </div>
            </div>
          </div>

          {/* DuckDB Optimizer Tip Card */}
          <div className="rounded-lg border border-monokai-cyan/30 bg-monokai-cyan/5 p-3 text-xs font-mono space-y-1">
            <div className="text-monokai-cyan font-bold flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" />
              <span>DuckDB 向量执行提示</span>
            </div>
            <div className="text-monokai-fg-muted text-meta leading-relaxed">
              DuckDB 支持单核 10 亿行/秒级别的列式向量扫描。若某条查询超过 200ms，通常是由于全表扫描非过滤字段、字符串模糊正则匹配或跨表笛卡尔积。推荐使用 Parquet 分区谓词下推优化。
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
