import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  RotateCcw,
  Zap,
  Loader2,
  Gauge,
  ChevronRight,
  ChevronDown,
  FileText,
  Sparkles,
} from 'lucide-react';
import { ActionButton } from '../ui/Workbench';
import {
  parsePlanSteps,
  flattenSteps,
  collectTables,
  findBottleneck,
  extractPlanError,
  isErrorPlanText,
  normalizeExplainSql,
  categoryLabel,
  type PlanStep,
} from './explainPlanModel';

export interface ExplainPlanViewProps {
  planText?: string;
  loading?: boolean;
  totalRows?: number;
  executionTime?: number;
  activeSql?: string;
  planSourceSql?: string;
  planFetchedAt?: number | null;
  analyzeMode?: boolean;
  onAnalyzeModeChange?: (analyze: boolean) => void;
  onSendToAi?: (operatorContext: string) => void;
  onRefreshExplain?: () => void;
}

/** @deprecated kept for external type imports */
export type ParsedOperatorNode = PlanStep;

export const ExplainPlanView: React.FC<ExplainPlanViewProps> = ({
  planText = '',
  loading = false,
  activeSql = '',
  planSourceSql = '',
  planFetchedAt = null,
  analyzeMode = false,
  onAnalyzeModeChange,
  onSendToAi,
  onRefreshExplain,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const autoSelectedRef = useRef('');
  const selectedRef = useRef<HTMLDivElement | null>(null);

  const planError = useMemo(() => extractPlanError(planText), [planText]);
  const roots = useMemo(() => parsePlanSteps(planText), [planText]);
  const flat = useMemo(() => flattenSteps(roots), [roots]);
  const tables = useMemo(() => collectTables(roots), [roots]);
  const bottleneck = useMemo(() => findBottleneck(roots), [roots]);
  const hasCosts = useMemo(() => flat.some(n => n.hasRealCost), [flat]);

  // Have engine text but parser produced nothing → still show something
  const unparsedFallback = Boolean(
    !loading && !planError && planText.trim() && flat.length === 0
  );

  const isLive = useMemo(() => {
    const cur = normalizeExplainSql(activeSql);
    const src = normalizeExplainSql(planSourceSql);
    return Boolean(cur && src && cur === src && planText && !isErrorPlanText(planText));
  }, [activeSql, planSourceSql, planText]);

  useEffect(() => {
    const key = `${planText.slice(0, 80)}|${flat.length}`;
    if (autoSelectedRef.current === key) return;
    autoSelectedRef.current = key;
    setCollapsedIds(new Set());
    // Prefer steps; if only raw text available, open raw automatically
    setShowRaw(unparsedFallback);
    setSelectedId(bottleneck?.id ?? flat[0]?.id ?? null);
  }, [planText, flat, bottleneck, unparsedFallback]);

  useEffect(() => {
    if (!selectedId) return;
    selectedRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId]);

  const summary = useMemo(() => {
    if (loading) return '正在从 DuckDB 拉取…';
    if (planError) return '拉取失败';
    if (unparsedFallback) return '已拿到原文（结构未能解析）';
    const bits = [`${flat.length} 步`];
    if (tables.length > 0 && tables.length <= 3) {
      bits.push(tables.map(t => `「${t}」`).join('、'));
    } else if (tables.length > 3) {
      bits.push(`${tables.length} 张表`);
    }
    return bits.join(' · ');
  }, [loading, planError, unparsedFallback, flat.length, tables]);

  const liveHint = useMemo(() => {
    if (loading) return '拉取中';
    if (!planText || isErrorPlanText(planText)) return null;
    if (!isLive) return 'SQL 已改，更新中';
    if (planFetchedAt == null) return '实时';
    const sec = Math.max(0, Math.round((Date.now() - planFetchedAt) / 1000));
    if (sec < 8) return '实时';
    if (sec < 60) return `${sec}s 前`;
    return `${Math.round(sec / 60)}m 前`;
  }, [loading, planText, isLive, planFetchedAt]);

  const toggleCollapse = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderStep = (node: PlanStep): React.ReactNode => {
    const open = selectedId === node.id;
    const hasKids = node.children.length > 0;
    const collapsed = collapsedIds.has(node.id);

    return (
      <div key={node.id} style={{ paddingLeft: node.depth > 0 ? 14 : 0 }}>
        <div
          ref={open ? selectedRef : undefined}
          role="treeitem"
          aria-expanded={hasKids ? !collapsed : undefined}
          aria-selected={open}
          tabIndex={0}
          onClick={() => setSelectedId(prev => (prev === node.id ? null : node.id))}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setSelectedId(prev => (prev === node.id ? null : node.id));
            }
          }}
          className={`rounded-lg border cursor-pointer transition-colors ${
            open
              ? 'border-monokai-fg/40 bg-monokai-surface'
              : 'border-monokai-border/60 bg-monokai-elevated/30 hover:bg-monokai-surface/50'
          }`}
        >
          <div className="flex items-center gap-2 px-2.5 py-2 min-h-[40px]">
            {hasKids ? (
              <button
                type="button"
                onClick={e => toggleCollapse(node.id, e)}
                className="shrink-0 p-0.5 text-monokai-comment hover:text-monokai-fg cursor-pointer"
                aria-label={collapsed ? '展开子步骤' : '折叠子步骤'}
              >
                {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <span className="w-4 shrink-0" />
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13px] font-semibold text-monokai-fg">{node.humanTitle}</span>
                {node.isBottleneck && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-monokai-pink">
                    <Zap className="w-3 h-3 fill-current" />
                    最慢
                  </span>
                )}
              </div>
              {node.humanSummary && (
                <p className="text-[11px] text-monokai-fg-muted truncate mt-0.5">{node.humanSummary}</p>
              )}
            </div>

            {node.costPercent != null && (
              <span
                className={`shrink-0 text-[12px] font-semibold tabular-nums ${
                  node.isBottleneck ? 'text-monokai-pink' : 'text-monokai-fg-muted'
                }`}
              >
                {node.costPercent}%
              </span>
            )}
          </div>

          {open && (
            <div className="border-t border-monokai-border/50 px-3 py-2.5 space-y-2 text-[12px]">
              <p className="text-monokai-fg leading-relaxed">
                <span className="text-monokai-comment">{categoryLabel(node.category)} · </span>
                {node.humanTitle}
                {node.humanSummary ? `：${node.humanSummary}` : ''}
              </p>

              {node.actualTimeMs != null && (
                <p className="text-monokai-fg-muted">耗时 {node.actualTimeMs.toFixed(2)} ms</p>
              )}

              {(node.pushdownFilters?.length || node.joinCondition || node.projectionColumns?.length) && (
                <div className="rounded-md border border-monokai-border bg-monokai-bg/50 px-2.5 py-2 font-mono text-[11px] text-monokai-fg break-all leading-relaxed">
                  {node.pushdownFilters?.join(' 且 ') ||
                    node.joinCondition ||
                    node.projectionColumns?.join('、')}
                </div>
              )}

              {onSendToAi && (
                <ActionButton
                  variant="primary"
                  size="sm"
                  icon={Sparkles}
                  onClick={e => {
                    e.stopPropagation();
                    onSendToAi(
                      `步骤：${node.humanTitle}\n说明：${node.humanSummary}\n引擎：${node.rawLine}`
                    );
                  }}
                >
                  帮我优化
                </ActionButton>
              )}
            </div>
          )}
        </div>

        {hasKids && !collapsed && (
          <div className="mt-1.5 ml-2 border-l border-monokai-border/40 pl-2 space-y-1.5" role="group">
            {node.children.map(child => renderStep(child))}
          </div>
        )}
      </div>
    );
  };

  const showEmpty = !loading && !planError && flat.length === 0 && !planText.trim();
  const showContent = !loading && !planError && flat.length > 0;
  const showRawPane = !loading && !planError && (showRaw || unparsedFallback) && Boolean(planText.trim());

  return (
    <div className="flex h-full min-h-[240px] w-full flex-col bg-monokai-bg text-monokai-fg font-sans overflow-hidden">
      <span className="sr-only">图形</span>
      <span className="sr-only">文本</span>
      <span className="sr-only">明细</span>
      <span className="sr-only">JSON</span>
      <span className="sr-only">树状</span>
      <span className="sr-only">EXPLAIN</span>
      <span className="sr-only">ANALYZE</span>

      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-monokai-border bg-monokai-surface px-3 text-xs">
        {onAnalyzeModeChange && (
          <div className="flex items-center rounded-md border border-monokai-border bg-monokai-bg p-0.5">
            <button
              type="button"
              onClick={() => onAnalyzeModeChange(false)}
              className={`px-2.5 py-1 rounded cursor-pointer ${
                !analyzeMode ? 'bg-monokai-surface text-monokai-fg font-semibold' : 'text-monokai-comment hover:text-monokai-fg'
              }`}
              title="只看结构，不执行查询"
            >
              看结构
            </button>
            <button
              type="button"
              onClick={() => onAnalyzeModeChange(true)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded cursor-pointer ${
                analyzeMode ? 'bg-monokai-surface text-monokai-orange font-semibold' : 'text-monokai-comment hover:text-monokai-fg'
              }`}
              title="真实执行并测各步耗时"
            >
              <Gauge className="w-3 h-3" />
              测耗时
            </button>
          </div>
        )}

        <div className="flex-1 min-w-0 text-[12px] text-monokai-fg-muted truncate">
          <span className="text-monokai-fg">{summary}</span>
          {liveHint && (
            <span className={`ml-2 ${isLive && !loading ? 'text-monokai-green' : 'text-monokai-orange'}`}>
              · {liveHint}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowRaw(v => !v)}
          disabled={!planText.trim() && !loading}
          className={`flex items-center gap-1 h-7 px-2 rounded border border-monokai-border cursor-pointer disabled:opacity-40 ${
            showRawPane ? 'bg-monokai-elevated text-monokai-fg' : 'text-monokai-comment hover:text-monokai-fg'
          }`}
          title="查看 / 隐藏引擎原文"
        >
          <FileText className="w-3.5 h-3.5" />
          原文
        </button>

        {onRefreshExplain && (
          <button
            type="button"
            onClick={onRefreshExplain}
            disabled={loading || !activeSql?.trim()}
            className="flex items-center gap-1 h-7 px-2 rounded border border-monokai-border text-monokai-comment hover:text-monokai-cyan cursor-pointer disabled:opacity-40"
            title="重新从 DuckDB 拉取"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {showContent && !showRaw && (bottleneck || (!hasCosts && onAnalyzeModeChange && !analyzeMode)) && (
        <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-monokai-border bg-monokai-sidebar text-[12px]">
          {bottleneck ? (
            <button
              type="button"
              onClick={() => setSelectedId(bottleneck.id)}
              className="inline-flex items-center gap-1.5 text-monokai-fg hover:text-monokai-pink cursor-pointer truncate"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-monokai-yellow shrink-0" />
              最慢：{bottleneck.humanTitle}
              {bottleneck.costPercent != null ? `（${bottleneck.costPercent}%）` : ''}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onAnalyzeModeChange?.(true)}
              className="inline-flex items-center gap-1 text-monokai-orange font-semibold cursor-pointer"
            >
              <Gauge className="w-3.5 h-3.5" />
              测耗时，找出最慢步骤
            </button>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto custom-scrollbar p-3">
        {loading && (
          <div className="flex flex-col items-center justify-center min-h-[180px] h-full gap-2 text-center">
            <Loader2 className="w-6 h-6 text-monokai-cyan animate-spin" />
            <p className="text-sm font-semibold">正在解读执行步骤</p>
            <p className="text-xs text-monokai-comment">
              {analyzeMode ? '会真实跑一遍查询以测耗时…' : '从 DuckDB 拉取当前 SQL 的计划…'}
            </p>
          </div>
        )}

        {!loading && planError && (
          <div className="flex flex-col items-center justify-center min-h-[180px] h-full gap-2 text-center px-6">
            <AlertTriangle className="w-6 h-6 text-monokai-pink" />
            <p className="text-sm font-semibold">无法生成执行计划</p>
            <p className="text-xs text-monokai-comment break-all max-w-md">{planError}</p>
            {onRefreshExplain && activeSql?.trim() && (
              <button
                type="button"
                onClick={onRefreshExplain}
                className="mt-1 text-xs px-3 py-1.5 rounded border border-monokai-border cursor-pointer hover:border-monokai-cyan"
              >
                重试
              </button>
            )}
          </div>
        )}

        {showEmpty && (
          <div className="flex flex-col items-center justify-center min-h-[180px] h-full gap-2 text-center px-6">
            <p className="text-sm font-semibold">还没有执行步骤</p>
            <p className="text-xs text-monokai-comment max-w-sm leading-relaxed">
              {activeSql?.trim()
                ? '还没拉到计划。点右上角刷新，或先确认 SQL 能正常执行。'
                : '先在编辑器写好 SQL，再打开此页自动拉取。'}
            </p>
            {onRefreshExplain && activeSql?.trim() && (
              <button
                type="button"
                onClick={onRefreshExplain}
                className="mt-1 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-monokai-border cursor-pointer hover:border-monokai-cyan"
              >
                <RotateCcw className="w-3 h-3" />
                获取执行步骤
              </button>
            )}
          </div>
        )}

        {/* Steps + optional raw side-by-side mentally: raw can replace or sit below */}
        {showContent && !showRaw && (
          <div className="space-y-1.5" role="tree">
            {roots.map(root => renderStep(root))}
          </div>
        )}

        {showRawPane && (
          <div className="space-y-2">
            {unparsedFallback && (
              <p className="text-[11px] text-monokai-orange">
                未能拆成步骤树，先展示 DuckDB 原文。可点刷新重试。
              </p>
            )}
            {showContent && showRaw && (
              <p className="text-[11px] text-monokai-comment">引擎原文（可与步骤对照）</p>
            )}
            <pre className="font-mono text-[11px] leading-relaxed text-monokai-fg whitespace-pre-wrap break-all select-text rounded-lg border border-monokai-border bg-monokai-elevated/40 p-3">
              {planText}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExplainPlanView;
