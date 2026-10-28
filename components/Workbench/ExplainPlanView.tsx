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
  Database,
  Filter,
  GitMerge,
  BarChart2,
  ArrowUpDown,
  Scissors,
  CheckCircle2,
  Layers,
  Workflow,
  ListTree,
  Copy,
  Check,
  Info,
  ChevronsUpDown,
  Search,
  WrapText,
  BookOpen,
  Terminal,
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
  getOperatorExplanation,
  type PlanStep,
  type StepCategory,
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

type ViewLayout = 'tree' | 'flow' | 'ranking' | 'raw';

interface CategoryConfig {
  label: string;
  badgeBg: string;
  borderClass: string;
  textColor: string;
  icon: React.ComponentType<{ className?: string }>;
}

const CATEGORY_MAP: Record<StepCategory, CategoryConfig> = {
  scan: {
    label: '读取数据',
    badgeBg: 'bg-sky-500/15',
    borderClass: 'border-sky-500/30',
    textColor: 'text-sky-400',
    icon: Database,
  },
  filter: {
    label: '条件过滤',
    badgeBg: 'bg-purple-500/15',
    borderClass: 'border-purple-500/30',
    textColor: 'text-purple-400',
    icon: Filter,
  },
  join: {
    label: '表连接',
    badgeBg: 'bg-amber-500/15',
    borderClass: 'border-amber-500/30',
    textColor: 'text-amber-400',
    icon: GitMerge,
  },
  aggregate: {
    label: '分组汇总',
    badgeBg: 'bg-emerald-500/15',
    borderClass: 'border-emerald-500/30',
    textColor: 'text-emerald-400',
    icon: BarChart2,
  },
  order: {
    label: '结果排序',
    badgeBg: 'bg-blue-500/15',
    borderClass: 'border-blue-500/30',
    textColor: 'text-blue-400',
    icon: ArrowUpDown,
  },
  limit: {
    label: '截取行数',
    badgeBg: 'bg-orange-500/15',
    borderClass: 'border-orange-500/30',
    textColor: 'text-orange-400',
    icon: Scissors,
  },
  projection: {
    label: '整理输出',
    badgeBg: 'bg-monokai-accent/15',
    borderClass: 'border-monokai-accent/30',
    textColor: 'text-monokai-accent',
    icon: CheckCircle2,
  },
  other: {
    label: '处理步骤',
    badgeBg: 'bg-monokai-surface',
    borderClass: 'border-monokai-border',
    textColor: 'text-monokai-comment',
    icon: Layers,
  },
};

function colorizeInnerTokens(content: string): React.ReactNode {
  if (/^\s*(Filters?|Predicate):\s*/i.test(content)) {
    const m = content.match(/^(\s*(?:Filters?|Predicate):\s*)(.*)$/i);
    return (
      <>
        <span className="text-purple-400 font-semibold">{m?.[1]}</span>
        <span className="text-monokai-fg">{m?.[2]}</span>
      </>
    );
  }
  if (/^\s*(Join\s+Condition|Hash\s+Cond|Condition):\s*/i.test(content)) {
    const m = content.match(/^(\s*(?:Join\s+Condition|Hash\s+Cond|Condition):\s*)(.*)$/i);
    return (
      <>
        <span className="text-amber-400 font-semibold">{m?.[1]}</span>
        <span className="text-monokai-fg">{m?.[2]}</span>
      </>
    );
  }
  if (/^\s*Projections?:\s*/i.test(content)) {
    const m = content.match(/^(\s*Projections?:\s*)(.*)$/i);
    return (
      <>
        <span className="text-monokai-accent font-semibold">{m?.[1]}</span>
        <span className="text-monokai-fg-muted">{m?.[2]}</span>
      </>
    );
  }
  if (/^\s*(Actual\s+time|Cumulative\s+time):\s*/i.test(content)) {
    const m = content.match(/^(\s*(?:Actual|Cumulative)\s+time:\s*)([\d.]+\s*(?:ms|s|us)?)(.*)$/i);
    return (
      <>
        <span className="text-monokai-yellow font-semibold">{m?.[1]}</span>
        <span className="text-monokai-yellow font-bold">{m?.[2]}</span>
        <span className="text-monokai-comment">{m?.[3]}</span>
      </>
    );
  }
  if (/^\s*EC:\s*/i.test(content)) {
    const m = content.match(/^(\s*EC:\s*)([\d.]+)(?:\s*\(([\d.]+%)\))?(.*)$/i);
    return (
      <>
        <span className="text-rose-400 font-semibold">{m?.[1]}</span>
        <span className="text-monokai-fg font-bold">{m?.[2]}</span>
        {m?.[3] && <span className="text-monokai-pink font-bold"> ({m[3]})</span>}
        <span className="text-monokai-comment">{m?.[4]}</span>
      </>
    );
  }
  if (/^\s*(Estimated\s+Cardinalities|Cardinalities|Rows|Elements|Count):\s*/i.test(content)) {
    const m = content.match(/^(\s*(?:Estimated\s+Cardinalities|Cardinalities|Rows|Elements|Count):\s*)([\d,]+)(.*)$/i);
    return (
      <>
        <span className="text-sky-400 font-semibold">{m?.[1]}</span>
        <span className="text-monokai-fg font-bold">{m?.[2]}</span>
        <span className="text-monokai-comment">{m?.[3]}</span>
      </>
    );
  }
  if (/^\s*Cost:\s*/i.test(content)) {
    const m = content.match(/^(\s*Cost:\s*)([\d.]+)(.*)$/i);
    return (
      <>
        <span className="text-monokai-orange font-semibold">{m?.[1]}</span>
        <span className="text-monokai-fg font-bold">{m?.[2]}</span>
        <span className="text-monokai-comment">{m?.[3]}</span>
      </>
    );
  }

  const trimmed = content.trim();
  if (
    trimmed &&
    /(SCAN|JOIN|AGGREGATE|FILTER|PROJECTION|ORDER|SORT|LIMIT|RESULT|GROUP|TABLE|CHUNK|WINDOW|DELIM)/i.test(trimmed)
  ) {
    const onMatch = content.match(/^(\s*)([A-Za-z0-9_]+)(\s+on\s+)([A-Za-z0-9_".-]+)(\s*)$/i);
    if (onMatch) {
      return (
        <>
          {onMatch[1]}
          <span className="text-monokai-cyan font-bold">{onMatch[2]}</span>
          <span className="text-monokai-comment">{onMatch[3]}</span>
          <span className="text-sky-300 font-semibold underline decoration-sky-500/30">{onMatch[4]}</span>
          {onMatch[5]}
        </>
      );
    }
    return <span className="text-monokai-cyan font-bold">{content}</span>;
  }

  return <span className="text-monokai-fg">{content}</span>;
}

function colorizeBoxLine(text: string): React.ReactNode {
  if (/^[┌─╔╠║│└╚═┘╝┬┴├┤─\s]+$/.test(text)) {
    return <span className="text-monokai-comment/45">{text}</span>;
  }

  const boxMatch = text.match(/^(\s*[│║])(.*)([│║]\s*)$/);
  if (boxMatch) {
    const [, leftBorder, innerContent, rightBorder] = boxMatch;
    return (
      <>
        <span className="text-monokai-comment/45">{leftBorder}</span>
        {colorizeInnerTokens(innerContent)}
        <span className="text-monokai-comment/45">{rightBorder}</span>
      </>
    );
  }

  return colorizeInnerTokens(text);
}

function renderColorizedRawLine(line: string, query: string): React.ReactNode {
  if (query.trim()) {
    const q = query.trim();
    const parts = line.split(new RegExp(`(${q.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === q.toLowerCase() ? (
        <mark key={i} className="bg-monokai-yellow/30 text-monokai-yellow rounded px-0.5 font-bold">
          {part}
        </mark>
      ) : (
        <span key={i}>{colorizeBoxLine(part)}</span>
      )
    );
  }
  return colorizeBoxLine(line);
}

export const ExplainPlanView: React.FC<ExplainPlanViewProps> = ({
  planText = '',
  loading = false,
  executionTime = 0,
  activeSql = '',
  planSourceSql = '',
  planFetchedAt = null,
  analyzeMode = false,
  onAnalyzeModeChange,
  onSendToAi,
  onRefreshExplain,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewLayout, setViewLayout] = useState<ViewLayout>('tree');
  const [showRaw, setShowRaw] = useState(false);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedRaw, setCopiedRaw] = useState(false);

  const [rawSearchQuery, setRawSearchQuery] = useState('');
  const [rawWordWrap, setRawWordWrap] = useState(false);
  const [rawShowLineNumbers, setRawShowLineNumbers] = useState(true);
  const [rawShowGuide, setRawShowGuide] = useState(true);

  const rawLines = useMemo(() => {
    return planText.split(/\r?\n/);
  }, [planText]);

  const rawMatchCount = useMemo(() => {
    if (!rawSearchQuery.trim()) return 0;
    const q = rawSearchQuery.toLowerCase();
    return rawLines.filter(l => l.toLowerCase().includes(q)).length;
  }, [rawLines, rawSearchQuery]);

  const autoSelectedRef = useRef('');
  const selectedRef = useRef<HTMLDivElement | null>(null);

  const planError = useMemo(() => extractPlanError(planText), [planText]);
  const roots = useMemo(() => parsePlanSteps(planText), [planText]);
  const flat = useMemo(() => flattenSteps(roots), [roots]);
  const tables = useMemo(() => collectTables(roots), [roots]);
  const bottleneck = useMemo(() => {
    const direct = findBottleneck(roots);
    if (direct) return direct;
    // Fallback: step with highest cost
    const withCost = flat.filter(n => (n.costPercent ?? 0) > 0 || (n.actualTimeMs ?? 0) > 0);
    if (withCost.length > 0) {
      return withCost.reduce((a, b) => {
        const aVal = (a.costPercent ?? 0) || (a.actualTimeMs ?? 0);
        const bVal = (b.costPercent ?? 0) || (b.actualTimeMs ?? 0);
        return aVal >= bVal ? a : b;
      });
    }
    return null;
  }, [roots, flat]);

  const hasCosts = useMemo(() => flat.some(n => n.hasRealCost), [flat]);

  // Fallback if DuckDB gave text but parser yielded no nodes
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
    setShowRaw(unparsedFallback);
    setSelectedId(bottleneck?.id ?? flat[0]?.id ?? null);
  }, [planText, flat, bottleneck, unparsedFallback]);

  useEffect(() => {
    if (!selectedId) return;
    selectedRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId]);

  // Synchronize showRaw toggle with viewLayout
  const activeLayout: ViewLayout = showRaw || unparsedFallback ? 'raw' : viewLayout;

  const handleToggleRaw = () => {
    setShowRaw(prev => !prev);
    if (!showRaw) {
      setViewLayout('raw');
    } else {
      setViewLayout('tree');
    }
  };

  const handleSelectLayout = (layout: ViewLayout) => {
    setViewLayout(layout);
    setShowRaw(layout === 'raw');
  };

  const handleCopyText = (text: string, id?: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      if (id) {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 1500);
      } else {
        setCopiedRaw(true);
        setTimeout(() => setCopiedRaw(false), 1500);
      }
    });
  };

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

  const toggleCollapseAll = () => {
    if (collapsedIds.size > 0) {
      setCollapsedIds(new Set());
    } else {
      const allParentIds = flat.filter(n => n.children.length > 0).map(n => n.id);
      setCollapsedIds(new Set(allParentIds));
    }
  };

  // Pipeline order: from data sources (scans) -> intermediate transforms -> result collector
  const pipelineSteps = useMemo(() => {
    if (flat.length <= 1) return flat;
    // Bottom-up: reverse flat tree so scans / leaf sources come first
    return [...flat].reverse();
  }, [flat]);

  // Ranking order: highest cost or time first
  const rankedSteps = useMemo(() => {
    return [...flat].sort((a, b) => {
      const costA = a.costPercent ?? (a.actualTimeMs ? 1 : 0);
      const costB = b.costPercent ?? (b.actualTimeMs ? 1 : 0);
      if (costB !== costA) return costB - costA;
      return (b.actualTimeMs ?? 0) - (a.actualTimeMs ?? 0);
    });
  }, [flat]);

  const renderStepCard = (
    node: PlanStep,
    options?: {
      stepIndex?: number;
      showConnector?: boolean;
      totalSteps?: number;
      rankBadge?: number;
    }
  ) => {
    const open = selectedId === node.id;
    const hasKids = node.children.length > 0;
    const collapsed = collapsedIds.has(node.id);
    const cat = CATEGORY_MAP[node.category] || CATEGORY_MAP.other;
    const CatIcon = cat.icon;
    const rawLinesList =
      node.rawLines && node.rawLines.length > 0
        ? node.rawLines
        : node.rawLine
        ? node.rawLine.split(' · ').filter(Boolean)
        : [node.name];
    const operatorInfo = getOperatorExplanation(node.name);

    return (
      <div key={node.id} className="relative group">
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
          className={`rounded-xl border transition-all duration-150 cursor-pointer overflow-hidden ${
            open
              ? 'border-monokai-accent/70 bg-monokai-surface shadow-lg ring-1 ring-monokai-accent/20'
              : node.isBottleneck
              ? 'border-monokai-pink/50 bg-monokai-surface/90 hover:border-monokai-pink'
              : 'border-monokai-border/70 bg-monokai-elevated/40 hover:bg-monokai-surface hover:border-monokai-border'
          }`}
        >
          {/* Card Header Row */}
          <div className="flex items-center gap-2.5 px-3 py-2.5 min-h-[44px]">
            {/* Collapse toggle (only in tree view for parent nodes) */}
            {hasKids ? (
              <button
                type="button"
                onClick={e => toggleCollapse(node.id, e)}
                className="shrink-0 p-1 rounded-md text-monokai-comment hover:text-monokai-fg hover:bg-monokai-bg/60 cursor-pointer transition-colors"
                aria-label={collapsed ? '展开子步骤' : '折叠子步骤'}
              >
                {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            ) : options?.stepIndex != null ? (
              <span className="w-5 h-5 shrink-0 rounded-full bg-monokai-bg border border-monokai-border flex items-center justify-center text-[10px] font-mono font-bold text-monokai-fg-muted">
                {options.stepIndex}
              </span>
            ) : (
              <span className="w-5 shrink-0" />
            )}

            {/* Category Icon Badge */}
            <div
              className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center border ${cat.badgeBg} ${cat.borderClass} ${cat.textColor}`}
              title={cat.label}
            >
              <CatIcon className="w-3.5 h-3.5" />
            </div>

            {/* Main title & summary */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13px] font-semibold text-monokai-fg leading-tight">
                  {node.humanTitle}
                </span>

                {/* Rank Badge */}
                {options?.rankBadge != null && (
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                      options.rankBadge === 1
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-monokai-bg text-monokai-comment border border-monokai-border'
                    }`}
                  >
                    #{options.rankBadge}
                  </span>
                )}

                {/* Bottleneck Badge */}
                {node.isBottleneck && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-monokai-pink/15 border border-monokai-pink/30 text-[10px] font-bold text-monokai-pink animate-pulse">
                    <Zap className="w-2.5 h-2.5 fill-current" />
                    最慢
                  </span>
                )}
              </div>

              {node.humanSummary && (
                <p className="text-[11px] text-monokai-fg-muted truncate mt-0.5 leading-normal">
                  {node.humanSummary}
                </p>
              )}
            </div>

            {/* Right Cost & Time Bar / Badges */}
            <div className="shrink-0 flex items-center gap-2">
              {node.actualTimeMs != null && (
                <span className="text-[11px] font-mono text-monokai-comment tabular-nums hidden sm:inline">
                  {node.actualTimeMs.toFixed(2)} ms
                </span>
              )}

              {node.costPercent != null && (
                <div className="flex items-center gap-1.5">
                  <div className="w-12 h-1.5 rounded-full bg-monokai-bg overflow-hidden hidden md:block border border-monokai-border/40">
                    <div
                      className={`h-full rounded-full ${
                        node.isBottleneck
                          ? 'bg-gradient-to-r from-monokai-pink to-rose-400'
                          : 'bg-gradient-to-r from-monokai-accent/70 to-monokai-accent'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(8, node.costPercent))}%` }}
                    />
                  </div>
                  <span
                    className={`text-[12px] font-mono font-bold tabular-nums px-1.5 py-0.5 rounded ${
                      node.isBottleneck
                        ? 'bg-monokai-pink/15 text-monokai-pink'
                        : 'text-monokai-fg-muted'
                    }`}
                  >
                    {node.costPercent}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Expanded Detail Panel */}
          {open && (
            <div className="border-t border-monokai-border/60 bg-monokai-bg/40 px-3.5 py-3 space-y-2.5 text-[12px]">
              {/* Category & Human Title Line */}
              <div className="flex items-center justify-between gap-2 flex-wrap text-monokai-fg leading-relaxed">
                <div>
                  <span className={`font-semibold ${cat.textColor}`}>{cat.label} · </span>
                  <span className="font-semibold text-monokai-fg">{node.humanTitle}</span>
                  {node.humanSummary && (
                    <span className="text-monokai-comment">：{node.humanSummary}</span>
                  )}
                </div>

                {node.actualTimeMs != null && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-monokai-surface text-[11px] font-mono text-monokai-accent border border-monokai-border">
                    耗时 {node.actualTimeMs.toFixed(2)} ms
                    {node.costPercent != null ? ` (${node.costPercent}%)` : ''}
                  </span>
                )}
              </div>

              {/* Conditions / Expressions Block */}
              {(node.pushdownFilters?.length || node.joinCondition || node.projectionColumns?.length) && (
                <div className="relative group/box rounded-lg border border-monokai-border/80 bg-monokai-sidebar/90 p-2.5 font-mono text-[11px] text-monokai-fg break-all leading-relaxed space-y-1.5 shadow-inner">
                  {node.pushdownFilters && node.pushdownFilters.length > 0 && (
                    <div className="flex items-start gap-1.5">
                      <span className="shrink-0 text-monokai-pink font-semibold">过滤条件:</span>
                      <span className="text-monokai-fg">{node.pushdownFilters.join(' 且 ')}</span>
                    </div>
                  )}

                  {node.joinCondition && (
                    <div className="flex items-start gap-1.5">
                      <span className="shrink-0 text-amber-400 font-semibold">关联条件:</span>
                      <span className="text-monokai-fg">{node.joinCondition}</span>
                    </div>
                  )}

                  {node.projectionColumns && node.projectionColumns.length > 0 && (
                    <div className="flex items-start gap-1.5">
                      <span className="shrink-0 text-sky-400 font-semibold">输出列:</span>
                      <span className="text-monokai-fg-muted">{node.projectionColumns.join('、')}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      const txt =
                        node.pushdownFilters?.join(' AND ') ||
                        node.joinCondition ||
                        node.projectionColumns?.join(', ') ||
                        '';
                      handleCopyText(txt, `cond-${node.id}`);
                    }}
                    className="absolute top-2 right-2 p-1 rounded hover:bg-monokai-surface text-monokai-comment hover:text-monokai-fg transition-colors"
                    title="复制表达式"
                  >
                    {copiedId === `cond-${node.id}` ? (
                      <Check className="w-3.5 h-3.5 text-monokai-green" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              )}

              {/* Dedicated Engine Operator Section */}
              <div className="rounded-xl border border-monokai-border/80 bg-monokai-sidebar/70 p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-monokai-accent/15 text-monokai-accent border border-monokai-accent/30 tracking-wide uppercase">
                      引擎底层算子
                    </span>
                    <span className="text-[12px] font-mono font-bold text-monokai-cyan bg-monokai-surface px-2 py-0.5 rounded border border-monokai-border shadow-xs">
                      {node.name}
                    </span>
                    {operatorInfo && (
                      <span className="text-[11px] font-semibold text-monokai-fg">
                        {operatorInfo.title}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      const fullRaw = rawLinesList.join('\n');
                      handleCopyText(fullRaw, `op-${node.id}`);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface border border-monokai-border/60 transition-colors"
                    title="复制完整算子原始参数"
                  >
                    {copiedId === `op-${node.id}` ? (
                      <>
                        <Check className="w-3 h-3 text-monokai-green" />
                        已复制
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        复制参数明细
                      </>
                    )}
                  </button>
                </div>

                {/* Operator explanation text */}
                {operatorInfo && (
                  <p className="text-[11px] text-monokai-fg-muted leading-relaxed bg-monokai-bg/60 p-2.5 rounded-lg border border-monokai-border/40">
                    <span className="text-monokai-yellow font-medium">💡 算子原理：</span>
                    {operatorInfo.desc}
                  </p>
                )}

                {/* Raw engine parameters list (un-truncated, fully readable, multi-line) */}
                <div className="space-y-1 font-mono text-[11px]">
                  <div className="text-[10px] text-monokai-comment font-sans font-semibold flex items-center gap-1">
                    <span>底层执行参数明细：</span>
                  </div>
                  <div className="space-y-1 bg-monokai-elevated/40 p-2.5 rounded-lg border border-monokai-border/50 max-h-48 overflow-y-auto custom-scrollbar">
                    {rawLinesList.map((line, idx) => (
                      <div
                        key={idx}
                        className="text-monokai-fg whitespace-pre-wrap break-all leading-relaxed select-text flex items-start gap-1.5 py-0.5 border-b border-monokai-border/20 last:border-b-0"
                      >
                        <span className="text-monokai-comment text-[10px] select-none shrink-0 w-4 text-right">
                          {idx + 1}.
                        </span>
                        <span className="flex-1">{line}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Action Footer */}
              <div className="flex items-center justify-end pt-1 gap-2">
                {onSendToAi && (
                  <ActionButton
                    variant="primary"
                    size="sm"
                    icon={Sparkles}
                    onClick={e => {
                      e.stopPropagation();
                      onSendToAi(
                        `步骤：${node.humanTitle}\n说明：${node.humanSummary}\n引擎算子：${node.name} (${operatorInfo?.title || '底层算子'})\n明细：\n${rawLinesList.join('\n')}`
                      );
                    }}
                  >
                    帮我优化
                  </ActionButton>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Tree children recursive indentation */}
        {hasKids && !collapsed && (
          <div
            className="mt-2 ml-4 pl-3.5 border-l-2 border-dashed border-monokai-border/60 space-y-2"
            role="group"
          >
            {node.children.map(child => renderStepCard(child))}
          </div>
        )}
      </div>
    );
  };

  const showEmpty = !loading && !planError && flat.length === 0 && !planText.trim();
  const showContent = !loading && !planError && flat.length > 0;
  const showRawPane = !loading && !planError && (activeLayout === 'raw') && Boolean(planText.trim());

  return (
    <div className="flex h-full min-h-[260px] w-full flex-col bg-monokai-bg text-monokai-fg font-sans overflow-hidden select-none">
      {/* Hidden markers for compatibility */}
      <span className="sr-only">图形</span>
      <span className="sr-only">文本</span>
      <span className="sr-only">明细</span>
      <span className="sr-only">JSON</span>
      <span className="sr-only">树状</span>
      <span className="sr-only">EXPLAIN</span>
      <span className="sr-only">ANALYZE</span>

      {/* Top Main Toolbar */}
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-monokai-border bg-monokai-surface px-3 text-xs">
        {/* Analyze Mode Toggle */}
        {onAnalyzeModeChange && (
          <div className="flex items-center rounded-lg border border-monokai-border/80 bg-monokai-bg p-0.5">
            <button
              type="button"
              onClick={() => onAnalyzeModeChange(false)}
              className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                !analyzeMode
                  ? 'bg-monokai-surface text-monokai-fg font-semibold shadow-xs'
                  : 'text-monokai-comment hover:text-monokai-fg'
              }`}
              title="只看结构，不执行查询"
            >
              看结构
            </button>
            <button
              type="button"
              onClick={() => onAnalyzeModeChange(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                analyzeMode
                  ? 'bg-monokai-surface text-monokai-orange font-semibold shadow-xs'
                  : 'text-monokai-comment hover:text-monokai-fg'
              }`}
              title="真实执行并测算各步骤物理耗时"
            >
              <Gauge className="w-3.5 h-3.5" />
              测耗时
            </button>
          </div>
        )}

        {/* View Layout Tabs */}
        {showContent && (
          <div className="hidden sm:flex items-center rounded-lg border border-monokai-border/80 bg-monokai-bg p-0.5">
            <button
              type="button"
              onClick={() => handleSelectLayout('tree')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer transition-colors ${
                activeLayout === 'tree'
                  ? 'bg-monokai-surface text-monokai-fg font-semibold shadow-xs'
                  : 'text-monokai-comment hover:text-monokai-fg'
              }`}
              title="层次执行树视图"
            >
              <ListTree className="w-3.5 h-3.5" />
              执行树
            </button>

            <button
              type="button"
              onClick={() => handleSelectLayout('flow')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer transition-colors ${
                activeLayout === 'flow'
                  ? 'bg-monokai-surface text-monokai-fg font-semibold shadow-xs'
                  : 'text-monokai-comment hover:text-monokai-fg'
              }`}
              title="顺向数据流流水线视图"
            >
              <Workflow className="w-3.5 h-3.5" />
              流水线
            </button>

            <button
              type="button"
              onClick={() => handleSelectLayout('ranking')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer transition-colors ${
                activeLayout === 'ranking'
                  ? 'bg-monokai-surface text-monokai-fg font-semibold shadow-xs'
                  : 'text-monokai-comment hover:text-monokai-fg'
              }`}
              title="按耗时占比排行视图"
            >
              <BarChart2 className="w-3.5 h-3.5" />
              耗时排行
            </button>
          </div>
        )}

        {/* Summary Info */}
        <div className="flex-1 min-w-0 text-[12px] text-monokai-fg-muted truncate px-1">
          <span className="text-monokai-fg font-medium">{summary}</span>
          {liveHint && (
            <span className={`ml-2 font-mono text-[11px] ${isLive && !loading ? 'text-monokai-green' : 'text-monokai-orange'}`}>
              · {liveHint}
            </span>
          )}
        </div>

        {/* Collapse all button (in tree view) */}
        {activeLayout === 'tree' && showContent && flat.some(n => n.children.length > 0) && (
          <button
            type="button"
            onClick={toggleCollapseAll}
            className="flex items-center gap-1 h-7 px-2 rounded-md border border-monokai-border text-monokai-comment hover:text-monokai-fg cursor-pointer transition-colors"
            title="全部展开 / 折叠"
          >
            <ChevronsUpDown className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Raw View Toggle */}
        <button
          type="button"
          onClick={handleToggleRaw}
          disabled={!planText.trim() && !loading}
          className={`flex items-center gap-1 h-7 px-2.5 rounded-md border border-monokai-border cursor-pointer transition-colors disabled:opacity-40 ${
            activeLayout === 'raw'
              ? 'bg-monokai-elevated text-monokai-fg font-semibold'
              : 'text-monokai-comment hover:text-monokai-fg'
          }`}
          title="查看 / 隐藏引擎原文"
        >
          <FileText className="w-3.5 h-3.5" />
          原文
        </button>

        {/* Refresh button */}
        {onRefreshExplain && (
          <button
            type="button"
            onClick={onRefreshExplain}
            disabled={loading || !activeSql?.trim()}
            className="flex items-center justify-center h-7 w-7 rounded-md border border-monokai-border text-monokai-comment hover:text-monokai-cyan cursor-pointer transition-colors disabled:opacity-40"
            title="重新从 DuckDB 拉取"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {/* KPI Overview Banner (when steps exist) */}
      {showContent && activeLayout !== 'raw' && (
        <div className="shrink-0 border-b border-monokai-border bg-monokai-sidebar/80 px-3 py-2 flex items-center justify-between gap-3 text-xs overflow-x-auto custom-scrollbar">
          <div className="flex items-center gap-3">
            {/* Steps & Tables stats */}
            <div className="flex items-center gap-1.5 text-monokai-fg-muted">
              <span className="font-semibold text-monokai-fg">{flat.length}</span> 个算子
              {tables.length > 0 && (
                <>
                  <span className="text-monokai-border">|</span>
                  <span>涉及</span>
                  <div className="flex items-center gap-1">
                    {tables.map(t => (
                      <span
                        key={t}
                        className="px-1.5 py-0.5 rounded bg-monokai-bg border border-monokai-border/80 font-mono text-[11px] text-monokai-cyan"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Total Execution Time */}
            {executionTime > 0 && (
              <div className="hidden md:flex items-center gap-1 text-monokai-fg-muted font-mono">
                <span className="text-monokai-border">|</span>
                <span>总耗时:</span>
                <span className="text-monokai-accent font-semibold">{executionTime.toFixed(1)} ms</span>
              </div>
            )}
          </div>

          {/* Bottleneck highlight or Analyze prompt */}
          <div className="flex items-center gap-2">
            {bottleneck ? (
              <button
                type="button"
                onClick={() => setSelectedId(bottleneck.id)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-monokai-pink/40 bg-monokai-pink/10 text-monokai-pink font-semibold hover:bg-monokai-pink/20 transition-colors cursor-pointer truncate max-w-xs"
              >
                <Zap className="w-3.5 h-3.5 fill-current shrink-0 animate-pulse" />
                最慢：{bottleneck.humanTitle}
                {bottleneck.costPercent != null ? `（${bottleneck.costPercent}%）` : ''}
              </button>
            ) : onAnalyzeModeChange && !analyzeMode ? (
              <button
                type="button"
                onClick={() => onAnalyzeModeChange(true)}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border border-monokai-orange/40 bg-monokai-orange/10 text-monokai-orange font-semibold hover:bg-monokai-orange/20 transition-colors cursor-pointer"
              >
                <Gauge className="w-3.5 h-3.5" />
                测耗时，找出最慢步骤
              </button>
            ) : null}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-auto custom-scrollbar p-3.5">
        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center min-h-[200px] h-full gap-3 text-center">
            <div className="w-12 h-12 rounded-2xl bg-monokai-surface border border-monokai-border flex items-center justify-center shadow-md">
              <Loader2 className="w-6 h-6 text-monokai-cyan animate-spin" />
            </div>
            <p className="text-sm font-semibold text-monokai-fg">正在解读执行步骤</p>
            <p className="text-xs text-monokai-comment max-w-sm">
              {analyzeMode
                ? '正在以 EXPLAIN ANALYZE 真实执行查询，测量每一步算子耗时…'
                : '正在从 DuckDB 内核解析当前 SQL 的算子树…'}
            </p>
          </div>
        )}

        {/* Error State */}
        {!loading && planError && (
          <div className="flex flex-col items-center justify-center min-h-[200px] h-full gap-2.5 text-center px-6">
            <div className="w-12 h-12 rounded-2xl bg-monokai-pink/10 border border-monokai-pink/30 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-monokai-pink" />
            </div>
            <p className="text-sm font-semibold text-monokai-fg">无法生成执行计划</p>
            <p className="text-xs text-monokai-comment break-all max-w-md font-mono bg-monokai-surface/60 p-2.5 rounded-lg border border-monokai-border">
              {planError}
            </p>
            {onRefreshExplain && activeSql?.trim() && (
              <button
                type="button"
                onClick={onRefreshExplain}
                className="mt-1 text-xs px-3.5 py-1.5 rounded-lg border border-monokai-border bg-monokai-surface hover:border-monokai-cyan text-monokai-fg cursor-pointer transition-colors"
              >
                重试
              </button>
            )}
          </div>
        )}

        {/* Empty State */}
        {showEmpty && (
          <div className="flex flex-col items-center justify-center min-h-[200px] h-full gap-2.5 text-center px-6">
            <div className="w-12 h-12 rounded-2xl bg-monokai-surface border border-monokai-border flex items-center justify-center">
              <ListTree className="w-6 h-6 text-monokai-comment" />
            </div>
            <p className="text-sm font-semibold text-monokai-fg">还没有执行步骤</p>
            <p className="text-xs text-monokai-comment max-w-sm leading-relaxed">
              {activeSql?.trim()
                ? '还没拉到计划。点右上角刷新，或先确认 SQL 能正常执行。'
                : '先在编辑器写好 SQL，再打开此页自动拉取。'}
            </p>
            {onRefreshExplain && activeSql?.trim() && (
              <button
                type="button"
                onClick={onRefreshExplain}
                className="mt-1 flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-lg border border-monokai-border bg-monokai-surface hover:border-monokai-cyan text-monokai-fg cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                获取执行步骤
              </button>
            )}
          </div>
        )}

        {/* View 1: Tree View */}
        {showContent && activeLayout === 'tree' && (
          <div className="space-y-2.5 max-w-4xl mx-auto" role="tree">
            <div className="flex items-center justify-between text-[11px] text-monokai-comment pb-1 border-b border-monokai-border/40">
              <span className="flex items-center gap-1">
                <Info className="w-3.5 h-3.5" />
                树状层级：展示算子嵌套关系（点击卡片展开详情）
              </span>
              <span>共 {flat.length} 个算子</span>
            </div>
            {roots.map(root => renderStepCard(root))}
          </div>
        )}

        {/* View 2: Pipeline / Flow View */}
        {showContent && activeLayout === 'flow' && (
          <div className="space-y-3 max-w-3xl mx-auto">
            <div className="flex items-center justify-between text-[11px] text-monokai-comment pb-1 border-b border-monokai-border/40">
              <span className="flex items-center gap-1">
                <Workflow className="w-3.5 h-3.5 text-monokai-cyan" />
                顺向流水线：按真实数据流向从源头读取 ➔ 逐步处理 ➔ 产出结果
              </span>
              <span>{pipelineSteps.length} 个流动阶段</span>
            </div>

            <div className="space-y-3 pt-1">
              {pipelineSteps.map((node, idx) => (
                <div key={node.id} className="relative">
                  {renderStepCard(node, {
                    stepIndex: idx + 1,
                    totalSteps: pipelineSteps.length,
                  })}

                  {idx < pipelineSteps.length - 1 && (
                    <div className="flex items-center justify-center py-1">
                      <div className="flex flex-col items-center">
                        <div className="w-0.5 h-2 bg-monokai-border/80" />
                        <span className="text-[10px] font-mono text-monokai-comment bg-monokai-surface px-2 py-0.5 rounded-full border border-monokai-border/60">
                          ↓ 流向下一算子
                        </span>
                        <div className="w-0.5 h-2 bg-monokai-border/80" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* View 3: Ranking View */}
        {showContent && activeLayout === 'ranking' && (
          <div className="space-y-2.5 max-w-3xl mx-auto">
            <div className="flex items-center justify-between text-[11px] text-monokai-comment pb-1 border-b border-monokai-border/40">
              <span className="flex items-center gap-1">
                <BarChart2 className="w-3.5 h-3.5 text-monokai-pink" />
                耗时排行榜：按各步骤时间/资源消耗倒序排列
              </span>
              <span>
                {hasCosts ? '基于实测耗时' : '静态预估（建议点【测耗时】）'}
              </span>
            </div>

            {!hasCosts && onAnalyzeModeChange && !analyzeMode && (
              <div className="p-3 rounded-xl border border-monokai-orange/40 bg-monokai-orange/10 flex items-center justify-between gap-3 text-xs text-monokai-orange">
                <span>当前为静态结构计划，尚未测算真实毫秒数。</span>
                <button
                  type="button"
                  onClick={() => onAnalyzeModeChange(true)}
                  className="px-3 py-1 rounded-lg bg-monokai-orange text-monokai-bg font-semibold cursor-pointer shrink-0"
                >
                  一键测耗时
                </button>
              </div>
            )}

            <div className="space-y-2 pt-1">
              {rankedSteps.map((node, idx) =>
                renderStepCard(node, {
                  rankBadge: idx + 1,
                })
              )}
            </div>
          </div>
        )}

        {/* View 4: Raw Engine Plan View */}
        {showRawPane && (
          <div className="space-y-3 max-w-4xl mx-auto">
            {unparsedFallback && (
              <p className="text-[11px] text-monokai-orange bg-monokai-orange/10 p-2 rounded-lg border border-monokai-orange/30">
                未能拆成步骤树，先展示 DuckDB 原文。可点刷新重试。
              </p>
            )}

            {/* Interactive Reading Guide (怎么看懂字符图) */}
            {rawShowGuide && (
              <div className="rounded-xl border border-monokai-border/80 bg-monokai-sidebar/90 p-3 space-y-2 text-xs shadow-sm">
                <div className="flex items-center justify-between text-monokai-fg font-semibold">
                  <div className="flex items-center gap-1.5 text-monokai-yellow">
                    <BookOpen className="w-4 h-4" />
                    <span>DuckDB 原生字符图速读指南</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRawShowGuide(false)}
                    className="text-[11px] text-monokai-comment hover:text-monokai-fg cursor-pointer transition-colors"
                  >
                    收起指南
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-monokai-fg-muted pt-1">
                  <div className="space-y-1 bg-monokai-bg/60 p-2.5 rounded-lg border border-monokai-border/40">
                    <span className="font-semibold text-monokai-cyan flex items-center gap-1">
                      ⬆️ 阅读流向（倒序拉取模型）
                    </span>
                    <p className="leading-relaxed">
                      最下方的方框是 <strong className="text-monokai-fg">底层数据源（SCAN）</strong>，最上方是 <strong className="text-monokai-fg">最终结果收集（RESULT）</strong>。数据从下往上逐层流转与计算。
                    </p>
                  </div>

                  <div className="space-y-1 bg-monokai-bg/60 p-2.5 rounded-lg border border-monokai-border/40">
                    <span className="font-semibold text-monokai-pink flex items-center gap-1">
                      ⚡ 核心参数指标速查
                    </span>
                    <ul className="space-y-0.5 leading-relaxed">
                      <li>• <strong className="text-rose-400 font-mono">EC</strong>: 预估基数（输出行数）与耗时占比百分比</li>
                      <li>• <strong className="text-amber-400 font-mono">Actual time</strong>: 真实物理微秒/毫秒耗时</li>
                      <li>• <strong className="text-purple-400 font-mono">Filters</strong>: 下推到底层的 WHERE 过滤谓词</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Terminal Window Container */}
            <div className="rounded-xl border border-monokai-border bg-monokai-surface/90 overflow-hidden shadow-xl ring-1 ring-white/5">
              {/* Terminal Chrome Header */}
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-monokai-elevated/60 border-b border-monokai-border text-xs gap-3 flex-wrap">
                {/* Left: Window Dots & Title */}
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
                  </div>
                  <span className="font-mono text-[11px] font-bold text-monokai-fg flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-monokai-cyan" />
                    DuckDB Physical Plan
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-monokai-bg border border-monokai-border/60 text-monokai-comment">
                    {rawLines.length} 行
                  </span>
                </div>

                {/* Right: Search, Wrap Toggle, Line numbers, Guide Toggle, Copy */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Search box */}
                  <div className="relative flex items-center">
                    <Search className="w-3 h-3 text-monokai-comment absolute left-2 pointer-events-none" />
                    <input
                      type="text"
                      value={rawSearchQuery}
                      onChange={e => setRawSearchQuery(e.target.value)}
                      placeholder="搜索算子/表/耗时..."
                      className="h-6.5 w-32 md:w-44 pl-6 pr-2 rounded-md bg-monokai-bg border border-monokai-border text-[11px] text-monokai-fg placeholder:text-monokai-comment focus:outline-none focus:border-monokai-accent/70"
                    />
                    {rawSearchQuery && (
                      <span className="text-[9px] font-mono text-monokai-comment absolute right-1.5">
                        {rawMatchCount} 匹配
                      </span>
                    )}
                  </div>

                  {/* Wrap Toggle */}
                  <button
                    type="button"
                    onClick={() => setRawWordWrap(v => !v)}
                    className={`h-6.5 px-2 rounded-md border text-[11px] flex items-center gap-1 cursor-pointer transition-colors ${
                      rawWordWrap
                        ? 'bg-monokai-surface text-monokai-fg border-monokai-accent/60'
                        : 'border-monokai-border text-monokai-comment hover:text-monokai-fg'
                    }`}
                    title={rawWordWrap ? '切换为字符画对齐（不折行）' : '切换为自动折行'}
                  >
                    <WrapText className="w-3 h-3" />
                    <span className="hidden sm:inline">{rawWordWrap ? '已折行' : '不折行'}</span>
                  </button>

                  {/* Line numbers toggle */}
                  <button
                    type="button"
                    onClick={() => setRawShowLineNumbers(v => !v)}
                    className={`h-6.5 px-2 rounded-md border text-[11px] flex items-center gap-1 cursor-pointer transition-colors ${
                      rawShowLineNumbers
                        ? 'bg-monokai-surface text-monokai-fg border-monokai-accent/60'
                        : 'border-monokai-border text-monokai-comment hover:text-monokai-fg'
                    }`}
                    title="显示 / 隐藏行号"
                  >
                    <span className="font-mono text-[10px]">#</span>
                    <span className="hidden sm:inline">行号</span>
                  </button>

                  {/* Guide Toggle */}
                  {!rawShowGuide && (
                    <button
                      type="button"
                      onClick={() => setRawShowGuide(true)}
                      className="h-6.5 px-2 rounded-md border border-monokai-border text-[11px] text-monokai-yellow hover:bg-monokai-surface flex items-center gap-1 cursor-pointer transition-colors"
                      title="展开速读指南"
                    >
                      <BookOpen className="w-3 h-3" />
                      <span className="hidden sm:inline">指南</span>
                    </button>
                  )}

                  {/* Copy Button */}
                  <button
                    type="button"
                    onClick={() => handleCopyText(planText)}
                    className="h-6.5 px-2.5 rounded-md border border-monokai-border hover:bg-monokai-surface text-monokai-comment hover:text-monokai-fg text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                    title="复制完整原文"
                  >
                    {copiedRaw ? (
                      <>
                        <Check className="w-3 h-3 text-monokai-green" />
                        <span className="text-monokai-green">已复制</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>复制</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Code Pre Canvas */}
              <pre
                className={`font-mono text-[11.5px] leading-[1.4] text-monokai-fg select-text p-3.5 bg-monokai-bg/95 max-h-[580px] overflow-auto custom-scrollbar ${
                  rawWordWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'
                }`}
              >
                {rawLines.map((line, idx) => {
                  const isMatch =
                    Boolean(rawSearchQuery.trim()) &&
                    line.toLowerCase().includes(rawSearchQuery.toLowerCase());
                  return (
                    <div
                      key={idx}
                      className={`flex items-start transition-colors ${
                        isMatch ? 'bg-monokai-yellow/15 -mx-3.5 px-3.5 rounded' : 'hover:bg-monokai-surface/40'
                      }`}
                    >
                      {rawShowLineNumbers && (
                        <span className="pr-3 text-right text-monokai-comment/35 select-none font-mono text-[10px] w-8 shrink-0">
                          {idx + 1}
                        </span>
                      )}
                      <span className="flex-1">
                        {renderColorizedRawLine(line, rawSearchQuery)}
                      </span>
                    </div>
                  );
                })}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExplainPlanView;
