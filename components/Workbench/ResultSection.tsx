import { ChartRenderer } from '../charts/ChartRenderer';
import { formatValueBySpec, inferChartUnit, formatTableValue } from '../../utils/chartFormat';
import { widgetRowsToChartSpec } from '../../services/analysis/adapters/dashboardWidgetAdapter';
import { expandChartExport } from '../../utils/chartExport';
import { wrapChartLabel } from '../../utils/chartSpace';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Table as TableIcon,
  BarChart2,
  LineChart,
  ChartColumn,
  ChartArea,
  ScatterChart,
  CircleDot,
  GitCommit,
  Download,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Check,
  AlertCircle,
  Copy,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Sparkles,
  Search,
  Filter,
  X,
  Code2,
  Layers,
  Sigma,
  Columns,
  Clock,
  RotateCcw,
  ExternalLink,
  Activity,
  ArrowUpDown,
  ArrowLeftRight,
  GitCompare,
  TrendingUp,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Info,
  CheckCircle2,
  SlidersHorizontal,
  TableProperties,
  PieChart,
  Settings,
  ArrowRight,
  Lightbulb,
  Replace,
  Database,
  FileWarning,
  Workflow,
  Loader2,
  LayoutDashboard,
  type LucideIcon,
} from 'lucide-react';
import type { QueryResult, ChartConfig, ChartType } from '../../types';
import { duckDBService } from '../../services/duckdbService';
import { formatCellValue, formatDate, formatTimestamp, getTypeBadgeStyle } from '../../utils/typeFormatter';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { monokai } from '@uiw/codemirror-theme-monokai';
import { lightEditorTheme } from '../../themes/sqlEditorThemes';
import { useUiTheme } from '../../services/uiTheme';
import { EditorView } from '@codemirror/view';
import { toastService } from '../../services/toastService';
import { createWidgetFromSql } from '../../services/homeDashboardService';
import { useAppStore } from '../../hooks/store/useAppStore';
import {Tab} from '../../types';
import {datasetFromQueryResult} from '../../services/workbench/currentDataset';
import {openPivotAnalysis} from '../../hooks/store/useAnalysisWorkspace';
import { dispatchDataflowTraceFault } from '../../services/dataflow/dataflowEvents';
import { SegmentedTabs, ModalShell, ActionButton, FormInput } from '../ui/Workbench';
import { ExecutionPlanView } from '../ExecutionPlan';

const GROUP_SQL_PREVIEW_EXTENSIONS = [
  sql(),
  EditorView.lineWrapping,
  EditorView.editable.of(false),
  EditorView.theme({
    '&': {
      fontSize: '11.5px',
      backgroundColor: 'transparent',
    },
    '.cm-content': {
      fontFamily: 'var(--font-sql-editor, var(--font-mono))',
      fontSize: '11.5px',
      lineHeight: '1.55',
      padding: '10px 12px',
    },
    '.cm-line': {
      fontFamily: 'var(--font-sql-editor, var(--font-mono))',
      fontSize: '11.5px',
      lineHeight: '1.55',
    },
    '.cm-scroller': {
      overflow: 'auto',
      fontFamily: 'var(--font-sql-editor, var(--font-mono))',
    },
  }),
];

type ChartKind = 'bar' | 'column' | 'line' | 'area' | 'pie' | 'doughnut' | 'scatter';
type ChartFamily = 'compare' | 'trend' | 'compose' | 'relate';
type ChartAgg = 'sum' | 'avg' | 'count' | 'min' | 'max';
type ChartSort = 'value_desc' | 'value_asc' | 'label_asc' | 'label_desc';
type ChartLegend = 'right' | 'bottom' | 'hidden';
type ChartColorMode = 'categorical' | 'mono';
type ChartValueMode = 'absolute' | 'percent';
const CHART_SERIES_NONE = '';

const CHART_FAMILY_ITEMS: ReadonlyArray<{ value: ChartFamily; label: string; icon: LucideIcon; hint: string }> = [
  { value: 'compare', label: '对比', icon: GitCompare, hint: '类目数值对比' },
  { value: 'trend', label: '趋势', icon: TrendingUp, hint: '连续变化与趋势' },
  { value: 'compose', label: '构成', icon: PieChart, hint: '整体占比拆解' },
  { value: 'relate', label: '相关', icon: ScatterChart, hint: '两数值相关性' },
];

const CHART_FAMILY_VARIANTS: Record<ChartFamily, ReadonlyArray<{ value: ChartKind; label: string; icon: LucideIcon; hint: string }>> = {
  compare: [
    { value: 'bar', label: '条形', icon: BarChart2, hint: '横向对比' },
    { value: 'column', label: '柱状', icon: ChartColumn, hint: '纵向对比' },
  ],
  trend: [
    { value: 'line', label: '折线', icon: LineChart, hint: '趋势线' },
    { value: 'area', label: '面积', icon: ChartArea, hint: '填充趋势' },
  ],
  compose: [
    { value: 'pie', label: '饼图', icon: PieChart, hint: '占比' },
    { value: 'doughnut', label: '环图', icon: CircleDot, hint: '中空占比' },
  ],
  relate: [
    { value: 'scatter', label: '散点', icon: ScatterChart, hint: 'XY 相关' },
  ],
};

const CHART_KIND_ITEMS = Object.values(CHART_FAMILY_VARIANTS).flat();

const CHART_AGG_ITEMS = [
  { value: 'sum', label: 'SUM' },
  { value: 'avg', label: 'AVG' },
  { value: 'count', label: 'COUNT' },
  { value: 'min', label: 'MIN' },
  { value: 'max', label: 'MAX' },
] as const;

export type PivotAgg = 'sum' | 'avg' | 'count' | 'count_distinct' | 'min' | 'max' | 'median';
export type PivotShowAs = 'raw' | 'percent_total' | 'percent_row' | 'percent_col';

export interface PivotAggOption {
  value: PivotAgg;
  label: string;
  enLabel: string;
  group: 'basic' | 'distinct' | 'dist';
  description: string;
  numericOnly: boolean;
}

export const PIVOT_AGG_OPTIONS: ReadonlyArray<PivotAggOption> = [
  { value: 'sum', label: '求和', enLabel: 'SUM', group: 'basic', description: '累加所有数值，适合金额、销售额、数量等', numericOnly: true },
  { value: 'avg', label: '平均值', enLabel: 'AVG', group: 'basic', description: '计算算术平均水平，适合单价、评分、客单价等', numericOnly: true },
  { value: 'count', label: '计数 (行数)', enLabel: 'COUNT', group: 'distinct', description: '统计包含的数据记录行数，适用任何字段或整行', numericOnly: false },
  { value: 'count_distinct', label: '去重计数 (唯一值)', enLabel: 'DISTINCT', group: 'distinct', description: '统计不重复唯一值个数，适合独立客户、UV、不同SKU数等', numericOnly: false },
  { value: 'min', label: '最小值', enLabel: 'MIN', group: 'dist', description: '单元格内的极小下限，适合最低售价、最早时间等', numericOnly: false },
  { value: 'max', label: '最大值', enLabel: 'MAX', group: 'dist', description: '单元格内的极大上限，适合峰值流量、最高价格等', numericOnly: false },
  { value: 'median', label: '中位数', enLabel: 'MEDIAN', group: 'dist', description: '数值排序居中典型值，不受极大极小离群异动干扰', numericOnly: true },
];

export const PIVOT_SHOW_AS_OPTIONS: ReadonlyArray<{ value: PivotShowAs; label: string; desc: string }> = [
  { value: 'raw', label: '原始数值', desc: '直接按聚合函数计算所得结果' },
  { value: 'percent_total', label: '总计占比 %', desc: '各单元格占全局总计的百分比' },
  { value: 'percent_row', label: '行占比 %', desc: '各单元格占所在行小计的百分比' },
  { value: 'percent_col', label: '列占比 %', desc: '各单元格占所在列小计的百分比' },
];
const PIVOT_MAX_ROW_KEYS = 50;
const PIVOT_MAX_COL_KEYS = 15;

const CHART_SORT_ITEMS: ReadonlyArray<{ value: ChartSort; label: string; hint: string }> = [
  { value: 'value_desc', label: '值↓', hint: '按指标降序' },
  { value: 'value_asc', label: '值↑', hint: '按指标升序' },
  { value: 'label_asc', label: '名 A→Z', hint: '按类目升序' },
  { value: 'label_desc', label: '名 Z→A', hint: '按类目降序' },
];

const CHART_TOP_N_OPTIONS = [8, 12, 25, 50] as const;

const MONOKAI_CHART_PALETTE = [
  '#66d9ef', '#a6e22e', '#e6db74', '#fd971f', '#38bdf8',
  '#34d399', '#f87171', '#60a5fa', '#f59e0b', '#10b981',
  '#22d3ee', '#4ade80', '#fbbf24', '#fb923c', '#94a3b8',
];

function familyOfChart(kind: ChartKind): ChartFamily {
  if (kind === 'bar' || kind === 'column') return 'compare';
  if (kind === 'line' || kind === 'area') return 'trend';
  if (kind === 'pie' || kind === 'doughnut') return 'compose';
  return 'relate';
}

function isCircularChart(kind: ChartKind): boolean {
  return kind === 'pie' || kind === 'doughnut';
}

function usesAggregation(kind: ChartKind): boolean {
  return kind !== 'scatter';
}

function usesCategorySort(kind: ChartKind): boolean {
  return kind !== 'scatter';
}

function usesSeriesEncoding(kind: ChartKind): boolean {
  return kind === 'bar' || kind === 'column' || kind === 'line' || kind === 'area';
}

function usesValueMode(kind: ChartKind): boolean {
  return kind !== 'scatter';
}

export interface SortRule {
  column: string;
  direction: 'asc' | 'desc';
  priority: number;
}

export interface FilterRule {
  id: string;
  column: string;
  operator: '=' | '!=' | '>' | '>=' | '<' | '<=' | 'contains' | 'starts_with' | 'ends_with' | 'is_null' | 'is_not_null' | 'in' | 'between';
  value: string;
  value2?: string; // for BETWEEN operator
  conjunction: 'AND' | 'OR';
}

export interface MetricRule {
  column: string;
  aggregator: 'SUM' | 'COUNT' | 'COUNT DISTINCT' | 'AVG' | 'MIN' | 'MAX' | 'COUNT(*)';
  alias?: string;
}

const RESULT_TABLE_FONT = 'var(--font-sans)';
const RESULT_MONO_FONT = 'Victor Mono, JetBrains Mono, Consolas, monospace';
const WORKBENCH_SELECT_CLASS =
  'h-8 w-full appearance-none bg-monokai-bg/70 border border-monokai-border/80 rounded-md pl-2.5 pr-7 text-xs font-mono text-monokai-fg placeholder:text-monokai-comment/65 focus:outline-none focus:border-monokai-cyan/60 focus:bg-monokai-bg focus:ring-1 focus:ring-monokai-cyan/25 cursor-pointer transition-all duration-150';
const AGG_FN_ITEMS = [
  { value: 'SUM', label: 'SUM' },
  { value: 'COUNT', label: 'COUNT' },
  { value: 'AVG', label: 'AVG' },
  { value: 'MIN', label: 'MIN' },
  { value: 'MAX', label: 'MAX' },
] as const;
const CJK_CHAR_RE = /[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE10-\uFE1F\uFE30-\uFE4F\uFF00-\uFFEF]/;

type SqlErrorKind = 'parser' | 'binder' | 'catalog' | 'conversion' | 'runtime';

interface ParsedSqlError {
  kind: SqlErrorKind;
  category: string;
  badgeClass: string;
  accentClass: string;
  lineNum: string | null;
  columnNum: string | null;
  missingObject: string | null;
  suggestion: string | null;
  primaryMessage: string;
  lineSnippet: string | null;
  caretOffset: number | null;
  tips: string[];
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return dp[n];
}

function parseDuckDbError(err: string, errorContext?: QueryResult['errorContext']): ParsedSqlError {
  const ctxSuggest = errorContext?.suggestion || null;
  const ctxMissing = errorContext?.missingObject || null;

  let kind: SqlErrorKind = 'runtime';
  let category = '执行异常 · Runtime';
  let badgeClass = 'bg-monokai-pink/15 text-monokai-pink border-monokai-pink/40';
  let accentClass = 'border-monokai-pink/40 via-monokai-pink/50';

  if (/Parser Error|syntax error/i.test(err)) {
    kind = 'parser';
    category = '语法解析 · Parser';
    badgeClass = 'bg-monokai-orange/15 text-monokai-orange border-monokai-orange/40';
    accentClass = 'border-monokai-orange/40 via-monokai-orange/50';
  } else if (/Catalog Error/i.test(err)) {
    kind = 'catalog';
    category = '库表目录 · Catalog';
    badgeClass = 'bg-monokai-cyan/15 text-monokai-cyan border-monokai-cyan/40';
    accentClass = 'border-monokai-cyan/40 via-monokai-cyan/50';
  } else if (/Binder Error|Referenced column|Column .+ not found/i.test(err)) {
    kind = 'binder';
    category = '元数据绑定 · Binder';
    badgeClass = 'bg-monokai-yellow/15 text-monokai-yellow border-monokai-yellow/40';
    accentClass = 'border-monokai-yellow/40 via-monokai-yellow/50';
  } else if (/Conversion Error|Type Error|Cast Error/i.test(err)) {
    kind = 'conversion';
    category = '类型转换 · Conversion';
    badgeClass = 'bg-monokai-amethyst/15 text-monokai-amethyst border-monokai-amethyst/40';
    accentClass = 'border-monokai-amethyst/40 via-monokai-amethyst/50';
  }

  const lineMatch = err.match(/LINE\s+(\d+)\s*:\s*(.*)/i);
  const lineNum = lineMatch ? lineMatch[1] : null;
  const lineSnippet = lineMatch ? (lineMatch[2] || '').trimEnd() : null;

  let caretOffset: number | null = null;
  const caretLine = err.split(/\r?\n/).find(l => /^\s*\^+\s*$/.test(l));
  if (caretLine && lineSnippet != null) {
    caretOffset = caretLine.indexOf('^');
    if (caretOffset < 0) caretOffset = null;
  }

  const colMatch = err.match(/(?:at|column)\s+(\d+)/i);
  const columnNum = colMatch ? colMatch[1] : (caretOffset != null ? String(caretOffset + 1) : null);

  const tableMissing =
    err.match(/Table with name ["']?([^"'\s]+)["']? does not exist/i) ||
    err.match(/Table ["']?([^"'\s]+)["']? (?:does not|doesn't) exist/i);
  const colMissing =
    err.match(/Referenced column ["']?([^"'\s]+)["']? not found/i) ||
    err.match(/Column ["']?([^"'\s]+)["']? (?:not found|does not exist)/i);
  const missingObject = ctxMissing || tableMissing?.[1] || colMissing?.[1] || null;

  const didYouMean =
    err.match(/Did you mean ["']([^"']+)["']\s*\?/i) ||
    err.match(/Did you mean:\s*["']?([^\s"',?]+)["']?/i);
  const suggestion = ctxSuggest || didYouMean?.[1] || null;

  const primaryMessage = err
    .split(/\r?\n/)
    .map(l => l.trim())
    .find(l => l && !/^LINE\s+\d+/i.test(l) && !/^\^+/.test(l)) || err;

  const tips: string[] = [];
  if (kind === 'catalog') {
    tips.push('确认表/视图名拼写，或使用左侧资源树双击插入限定名。');
    tips.push('跨库对象请使用 "catalog"."schema"."table" 三段式限定名。');
    if (suggestion) tips.push(`引擎建议替换为「${suggestion}」。`);
  } else if (kind === 'parser') {
    tips.push('检查引号是否成对、关键字是否拼写正确、语句是否以分号分隔。');
    tips.push('复杂表达式可用括号明确优先级，或先格式化再排查。');
  } else if (kind === 'binder') {
    tips.push('核对 SELECT / WHERE / GROUP BY 中的列名是否存在于当前结果源。');
    tips.push('别名不可在同层 WHERE 中引用；聚合列需放入 GROUP BY 或聚合函数。');
  } else if (kind === 'conversion') {
    tips.push('检查 CAST / 隐式转换目标类型，以及日期时间字符串格式是否匹配。');
  } else {
    tips.push('查看完整错误日志与 SQL 上下文；必要时用 EXPLAIN 或缩小查询范围定位。');
  }

  return {
    kind,
    category,
    badgeClass,
    accentClass,
    lineNum,
    columnNum,
    missingObject,
    suggestion,
    primaryMessage,
    lineSnippet,
    caretOffset,
    tips,
  };
}

function visualCharWidth(text: string): number {
  let width = 0;
  for (const ch of text) {
    width += CJK_CHAR_RE.test(ch) ? 1.9 : 1;
  }
  return width;
}

let measureCanvas: HTMLCanvasElement | null = null;

function measureSansPx(text: string, fontSizePx: number, fontWeight: number | string = 600): number {
  if (typeof document === 'undefined') {
    return Math.ceil(visualCharWidth(text) * fontSizePx * 0.62);
  }
  if (!measureCanvas) measureCanvas = document.createElement('canvas');
  const ctx = measureCanvas.getContext('2d');
  if (!ctx) return Math.ceil(visualCharWidth(text) * fontSizePx * 0.62);
  ctx.font = `${fontWeight} ${fontSizePx}px ${RESULT_TABLE_FONT}`;
  return Math.ceil(ctx.measureText(text).width);
}

function headerColumnNeed(colName: string, typeLabel: string): number {
  // Stacked header (name above type): width follows the wider of the two lines
  const nameW = measureSansPx(colName, 12, 600);
  const typeW = measureSansPx(typeLabel, 9, 700);
  const typePill = typeW + 14;
  const cellPad = 20;
  const resizeHandle = 8;
  return Math.max(nameW, typePill) + cellPad + resizeHandle;
}

function isJsonLikeValue(val: unknown): boolean {
  if (val != null && typeof val === 'object') return true;
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  return (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'));
}

interface ResultSectionProps {
  result: QueryResult | null;
  previousResult?: QueryResult | null;
  loading: boolean;
  selectedColumn?: string | null;
  activeTabSql?: string;
  activeTabTitle?: string;
  onSelectColumn?: (colName: string) => void;
  onExportCsv?: () => void;
  isStale?: boolean;
  onExportParquet?: () => void;
  onExportJson?: () => void;
  onCopyClipboard?: () => void;
  onViewPreviousResult?: () => void;
  isViewingPrevious?: boolean;
  onReturnToLatestResult?: () => void;
  onUseQualifiedName?: (qualifiedName: string) => void;
  onApplyFilterToSql?: (filterSqlClause: string) => void;
  onApplyAggregateToSql?: (aggregateSql: string, tabTitle?: string, autoRun?: boolean) => void;
  onToggleDataFlow?: (active: boolean) => void;
}

export const ResultSection: React.FC<ResultSectionProps> = ({
  result,
  previousResult,
  loading,
  isStale = false,
  selectedColumn = null,
  activeTabSql,
  activeTabTitle,
  onSelectColumn,
  onExportCsv,
  onExportParquet,
  onExportJson,
  onCopyClipboard,
  onViewPreviousResult,
  isViewingPrevious = false,
  onReturnToLatestResult,
  onUseQualifiedName,
  onApplyFilterToSql,
  onApplyAggregateToSql,
  onToggleDataFlow,
}) => {
  const { theme: uiTheme } = useUiTheme();
  const [activeSubTab, setActiveSubTab] = useState<'data' | 'chart' | 'pivot' | 'explain'>('data');
  const [pageSize, setPageSize] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [jumpPage, setJumpPage] = useState<string>('1');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Listen to Escape key to exit fullscreen
  // Modals & Popovers
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [exportFormat, setExportFormat] = useState<'parquet' | 'csv' | 'json' | 'arrow'>('parquet');

  const [showFilterModal, setShowFilterModal] = useState<boolean>(false);
  const [showGroupModal, setShowGroupModal] = useState<boolean>(false);
  const [isStreamingActive, setIsStreamingActive] = useState<boolean>(false);

  // Group & Aggregate configuration — empty until user chooses real columns
  const [groupByCols, setGroupByCols] = useState<string[]>([]);
  const [aggMetrics, setAggMetrics] = useState<MetricRule[]>([]);

  // Filter configuration (enhanced with AND/OR logic)
  const [filterRules, setFilterRules] = useState<FilterRule[]>(() => [
    { id: crypto.randomUUID(), column: '', operator: '=', value: '', conjunction: 'AND' },
  ]);

  // Sort Rules Management
  const [showSortPanel, setShowSortPanel] = useState<boolean>(false);
  const [sortRules, setSortRules] = useState<SortRule[]>([]);

  // Keyboard shortcuts for MECE action buttons (must be after all state declarations)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) {
        return;
      }

      // Escape: close fullscreen or sort panel
      if (e.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false);
          return;
        }
        if (showSortPanel) {
          setShowSortPanel(false);
          return;
        }
      }

      // Ctrl/Cmd + Shift + F: Open Filter Modal
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        setShowFilterModal(true);
        return;
      }

      // Ctrl/Cmd + Shift + S: Toggle Sort Panel
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        setShowSortPanel(prev => !prev);
        return;
      }

      // Ctrl/Cmd + Shift + G: Open Group Modal
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'G') {
        e.preventDefault();
        setShowGroupModal(true);
        return;
      }

      // Ctrl/Cmd + Shift + P: Switch to Pivot tab
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setActiveSubTab('pivot');
        return;
      }

      // Ctrl/Cmd + Shift + C: Switch to Chart tab
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        setActiveSubTab('chart');
        return;
      }

      // Ctrl/Cmd + Shift + E: Open Export Modal (Ctrl+E reserved for Explain)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setShowExportModal(true);
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, showSortPanel, setShowSortPanel, setShowFilterModal, setShowGroupModal, setActiveSubTab, setShowExportModal]);

  // Explain visualization subtab — always tied to current editor SQL (live DuckDB)
  const [explainAnalyzeMode, setExplainAnalyzeMode] = useState(false);
  const [liveExplainPlan, setLiveExplainPlan] = useState<string>('');
  const [liveExplainJson, setLiveExplainJson] = useState<any>(null);
  /** SQL that the current liveExplainPlan was fetched for (normalized). */
  const [planSourceSql, setPlanSourceSql] = useState<string>('');
  const [planFetchedAt, setPlanFetchedAt] = useState<number | null>(null);
  const [explainPlanMs, setExplainPlanMs] = useState<number | null>(null);
  const [loadingExplain, setLoadingExplain] = useState<boolean>(false);
  const explainFetchGenRef = useRef(0);
  const planMetaRef = useRef<{ sql: string; analyze: boolean }>({ sql: '', analyze: false });

  const normalizeSqlForExplain = (sql?: string): string => {
    let s = (sql || '').trim().replace(/;+\s*$/g, '').trim();
    while (/^EXPLAIN\s+/i.test(s)) {
      s = s.replace(/^EXPLAIN\s+(?:ANALYZE\s+)?/i, '').trim();
    }
    return s;
  };
  const [expandedExplainRow, setExpandedExplainRow] = useState<boolean>(false);
  const [expandedCells, setExpandedCells] = useState<Record<string, boolean>>({});

  // Dynamic Chart state
  const [chartType, setChartType] = useState<ChartKind>(() => {
    try {
      const saved = localStorage.getItem('workbench_chart_kind');
      if (saved && CHART_KIND_ITEMS.some(item => item.value === saved)) return saved as ChartKind;
    } catch { /* ignore */ }
    return 'bar';
  });
  const [chartXAxis, setChartXAxis] = useState<string>('');
  const [chartYAxis, setChartYAxis] = useState<string>('');
  const [chartAgg, setChartAgg] = useState<ChartAgg>('sum');
  const [chartTopN, setChartTopN] = useState<(typeof CHART_TOP_N_OPTIONS)[number]>(25);
  const [chartSort, setChartSort] = useState<ChartSort>('value_desc');
  const [chartLegend, setChartLegend] = useState<ChartLegend>('bottom');
  const [chartColorMode, setChartColorMode] = useState<ChartColorMode>('categorical');
  const [chartShowLabels, setChartShowLabels] = useState<boolean>(true);
  const [chartSeries, setChartSeries] = useState<string>(CHART_SERIES_NONE);
  const [chartValueMode, setChartValueMode] = useState<ChartValueMode>('absolute');
  const chartHostRef = useRef<HTMLDivElement>(null);

  const chartFamily = familyOfChart(chartType);
  const chartVariants = CHART_FAMILY_VARIANTS[chartFamily];
  const chartSeriesActive =
    usesSeriesEncoding(chartType) &&
    Boolean(chartSeries) &&
    chartSeries !== chartXAxis &&
    chartSeries !== chartYAxis;

  // Dynamic Pivot state
  const [pivotRowCol, setPivotRowCol] = useState<string>('');
  const [pivotColCol, setPivotColCol] = useState<string>('');
  const [pivotValCol, setPivotValCol] = useState<string>('');
  const [pivotAgg, setPivotAgg] = useState<PivotAgg>('count');
  const [pivotShowAs, setPivotShowAs] = useState<PivotShowAs>('raw');
  const [pivotDecimals, setPivotDecimals] = useState<number>(2);
  const [isAggMenuOpen, setIsAggMenuOpen] = useState<boolean>(false);
  const aggMenuRef = useRef<HTMLDivElement>(null);
  const [aggMenuPos, setAggMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const handleToggleAggMenu = () => {
    if (!isAggMenuOpen && aggMenuRef.current) {
      const rect = aggMenuRef.current.getBoundingClientRect();
      const menuWidth = 216;
      let left = rect.left;
      if (left + menuWidth > window.innerWidth - 16) {
        left = Math.max(16, window.innerWidth - menuWidth - 16);
      }
      setAggMenuPos({
        top: rect.bottom + 4,
        left: Math.max(16, left),
      });
    }
    setIsAggMenuOpen(prev => !prev);
  };

  useEffect(() => {
    if (!isAggMenuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (aggMenuRef.current?.contains(target)) return;
      const portalEl = document.getElementById('pivot-measure-studio-portal');
      if (portalEl?.contains(target)) return;
      setIsAggMenuOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsAggMenuOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAggMenuOpen]);
  const pivotInitializedRef = useRef<boolean>(false);

  // Cell Context Menu
  const [cellMenu, setCellMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    column: string;
    value: any;
  } | null>(null);

  const cellMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (cellMenuRef.current && !cellMenuRef.current.contains(e.target as Node)) {
        setCellMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeDataset = result || previousResult;

  const rawRows = useMemo(() => {
    if (activeDataset && Array.isArray(activeDataset.rows)) {
      return activeDataset.rows;
    }
    return [];
  }, [activeDataset]);

  const columns = useMemo(() => {
    if (activeDataset?.columns && activeDataset.columns.length > 0) {
      return activeDataset.columns;
    }
    if (rawRows.length > 0) {
      return Object.keys(rawRows[0]);
    }
    return [];
  }, [activeDataset, rawRows]);

  useEffect(() => {
    if (!showGroupModal || columns.length === 0) return;
    setGroupByCols(prev => {
      const valid = prev.filter(col => columns.includes(col));
      if (valid.length > 0) return valid;
      return columns.slice(0, Math.min(2, columns.length));
    });
    setAggMetrics(prev => {
      const fallback = columns[columns.length - 1] || columns[0];
      if (prev.length === 0) {
        return [{ column: fallback, aggregator: 'SUM', alias: `${fallback}_sum` }];
      }
      return prev.map(metric => ({
        ...metric,
        column: columns.includes(metric.column) ? metric.column : fallback,
      }));
    });
  }, [showGroupModal, columns]);

  // User-resized custom column widths map
  const [customColWidths, setCustomColWidths] = useState<Record<string, number>>({});
  // Table column sizing layout mode: 'auto' (content-adaptive, zero dead blank space) | 'fill' (stretch to full container width)
  const [tableLayoutMode, setTableLayoutMode] = useState<'auto' | 'fill'>('auto');

  // Content-aware optimal widths computation based on column header length, data types, and sampled rows
  const autoColWidths = useMemo(() => {
    const widths: Record<string, number> = {};
    if (!columns || columns.length === 0) return widths;

    const sampleRows = rawRows.slice(0, 50);

    for (let idx = 0; idx < columns.length; idx++) {
      const col = columns[idx];
      const type = result?.columnTypeMap?.[col] || (result?.columnTypes ? result.columnTypes[idx] : undefined) || 'VARCHAR';
      const tUpper = (type || '').toUpperCase();
      const isNumeric = ['INT', 'DECIMAL', 'FLOAT', 'DOUBLE', 'NUMERIC', 'REAL', 'BIGINT', 'HUGEINT', 'TINYINT', 'SMALLINT'].some(k => tUpper.includes(k));
      const isTemporal = tUpper.includes('DATE') || tUpper.includes('TIME');
      const isBoolean = tUpper.includes('BOOL');
      const isShortId = col.toLowerCase() === 'id' || col.toLowerCase().endsWith('_id') || col.toLowerCase().endsWith('id');

      // 1. Header need: stacked name + type badge → width = max(name, type), not sum
      const typeLabel = String(type);
      const headerNeed = headerColumnNeed(col, typeLabel);

      // 2. Sample rows: collapsed JSON chips vs first-line text, not raw payload length
      let maxContentNeed = 0;
      for (const row of sampleRows) {
        const val = row[col];
        if (val == null) continue;
        if (isJsonLikeValue(val)) {
          maxContentNeed = Math.max(maxContentNeed, 172);
          continue;
        }
        const strVal = String(val);
        const firstLine = strVal.split('\n')[0] || '';
        const lineNeed = Math.round(visualCharWidth(firstLine.slice(0, 48)) * 7.6) + 24;
        maxContentNeed = Math.max(maxContentNeed, lineNeed);
      }
      const contentNeed = maxContentNeed;

      // 3. Type-specific boundaries so columns hug header + cell content
      let minW = 72;
      let maxW = 320;

      if (isBoolean) {
        minW = 72;
        maxW = 108;
      } else if (isShortId) {
        minW = 72;
        maxW = 128;
      } else if (isNumeric) {
        minW = 80;
        maxW = 168;
      } else if (isTemporal) {
        minW = 118;
        maxW = 188;
      } else if (tUpper.includes('JSON') || col.toLowerCase().includes('json') || tUpper.includes('TEXT') || tUpper.includes('EXPLAIN')) {
        minW = 148;
        maxW = 360;
      } else {
        minW = 88;
        maxW = 280;
      }

      const contentClamped = Math.min(Math.max(contentNeed, minW), maxW);
      widths[col] = Math.max(headerNeed, contentClamped);
    }

    return widths;
  }, [columns, rawRows, result]);

  // Resolved column widths combining user override and content auto-sizing
  const resolvedColWidths = useMemo(() => {
    const map: Record<string, number> = {};
    for (const col of columns) {
      map[col] = customColWidths[col] ?? autoColWidths[col] ?? 120;
    }
    return map;
  }, [columns, customColWidths, autoColWidths]);

  const autoTablePixelWidth = useMemo(
    () => 48 + columns.reduce((sum, col) => sum + (resolvedColWidths[col] || 120), 0),
    [columns, resolvedColWidths]
  );

  // Resizing mouse handler
  const resizingRef = useRef<{
    col: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  const handleResizeStart = (e: React.MouseEvent, col: string) => {
    e.preventDefault();
    e.stopPropagation();
    const currentW = resolvedColWidths[col] || 120;
    resizingRef.current = {
      col,
      startX: e.clientX,
      startWidth: currentW,
    };

    const handleMouseMove = (moveEvt: MouseEvent) => {
      if (!resizingRef.current) return;
      const deltaX = moveEvt.clientX - resizingRef.current.startX;
      const newWidth = Math.max(60, Math.min(800, resizingRef.current.startWidth + deltaX));
      setCustomColWidths(prev => ({
        ...prev,
        [resizingRef.current!.col]: newWidth,
      }));
    };

    const handleMouseUp = () => {
      resizingRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleResetColWidth = (e: React.MouseEvent, col: string) => {
    e.preventDefault();
    e.stopPropagation();
    setCustomColWidths(prev => {
      const next = { ...prev };
      delete next[col];
      return next;
    });
    toastService.info(`已恢复列「${col}」的自适应宽度`);
  };

  // Sync default chart and pivot columns
  useEffect(() => {
    if (columns.length > 0) {
      if (!chartXAxis || !columns.includes(chartXAxis)) {
        setChartXAxis(columns[0]);
      }
      if (!chartYAxis || !columns.includes(chartYAxis)) {
        const numCol = columns.find(c => {
          const t = (result?.columnTypeMap?.[c] || '').toUpperCase();
          return t.includes('INT') || t.includes('DECIMAL') || t.includes('FLOAT') || t.includes('DOUBLE') || c.includes('额') || c.includes('数') || c.includes('量') || c.includes('amount') || c.includes('revenue') || c.includes('price');
        }) || (columns.length > 1 ? columns[1] : columns[0]);
        setChartYAxis(numCol);
      }
      if (chartSeries && !columns.includes(chartSeries)) {
        setChartSeries(CHART_SERIES_NONE);
      }

      if (!pivotInitializedRef.current) {
        // 默认行维度、列维度、值均保持为空（无）
        pivotInitializedRef.current = true;
      } else {
        if (pivotRowCol && !columns.includes(pivotRowCol)) setPivotRowCol('');
        if (pivotColCol && !columns.includes(pivotColCol)) setPivotColCol('');
        if (pivotValCol && !columns.includes(pivotValCol)) setPivotValCol('');
      }
    }
  }, [columns, result]);

  // Global event listener to switch result subtab (e.g. from Inspector or toolbar)
  useEffect(() => {
    const handleSwitchSubTab = (e: Event) => {
      const customEvent = e as CustomEvent<{
        subTab?: 'data' | 'chart' | 'pivot' | 'explain' | 'ai';
        subtab?: 'data' | 'chart' | 'pivot' | 'explain' | 'ai';
      }>;
      // Accept both camelCase and legacy lowercase key
      const sub = customEvent.detail?.subTab ?? customEvent.detail?.subtab;
      if (!sub) return;
      // AI lives in the right sidebar — redirect legacy 'ai' subtab requests there
      if (sub === 'ai') {
        window.dispatchEvent(new CustomEvent('workbench_switch_ai_panel', { detail: { tab: 'analyze' } }));
        return;
      }
      setActiveSubTab(sub);
    };
    window.addEventListener('duckdb_switch_subtab', handleSwitchSubTab);
    return () => window.removeEventListener('duckdb_switch_subtab', handleSwitchSubTab);
  }, []);

  const extractPlanTextFromResult = (rows: any[] | undefined): string => {
    if (!rows || rows.length === 0) return '';
    // Prefer physical_plan only — joining all explain_* rows produces unreadable mixed dumps
    let physical = '';
    const fallbackParts: string[] = [];
    for (const r of rows) {
      const key = String(r.explain_key ?? r.explore_key ?? Object.values(r)[0] ?? '').toLowerCase();
      const val = String(r.explain_value ?? r.explore_value ?? Object.values(r)[1] ?? Object.values(r)[0] ?? '');
      if (!val.trim()) continue;
      if (key.includes('physical')) {
        physical = val;
        break;
      }
      fallbackParts.push(val);
    }
    return physical || fallbackParts.join('\n');
  };

  // Auto-switch to explain subtab if query result is an EXPLAIN statement.
  // Seed UI immediately from physical_plan rows; do NOT mark cache hit — live fetch must still run.
  useEffect(() => {
    if (result) {
      const hasExplainCols = result.columns?.some(c => c.toLowerCase().includes('explain_'));
      if (result.isExplain || hasExplainCols) {
        setActiveSubTab('explain');
        const textFromRows = extractPlanTextFromResult(result.rows);
        if (textFromRows && textFromRows.trim()) {
          setLiveExplainPlan(textFromRows);
          setExplainAnalyzeMode(false);
          setExplainPlanMs(typeof result.executionTime === 'number' ? result.executionTime : null);
          setPlanFetchedAt(Date.now());
          // Tentative source for UI only — clear meta so live fetch always re-queries DuckDB
          const tentative =
            normalizeSqlForExplain((result as { sql?: string }).sql) ||
            normalizeSqlForExplain(activeTabSql);
          if (tentative) setPlanSourceSql(tentative);
          planMetaRef.current = { sql: '', analyze: false };
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed only when result identity changes
  }, [result?.resultId, result?.isExplain, result?.columns]);

  // Always fetch a LIVE plan for the current editor SQL while the explain tab is open.
  // Previous bug: once result.isExplain was true, we never re-queried DuckDB → frozen/dead plan.
  useEffect(() => {
    if (activeSubTab !== 'explain') return;

    const sql = normalizeSqlForExplain(activeTabSql);
    if (!sql) {
      // No editor SQL: keep any seeded EXPLAIN result; do not wipe it to empty.
      setLoadingExplain(false);
      return;
    }

    // Already have a live plan for this exact SQL + mode — do not refetch
    if (
      planMetaRef.current.sql === sql &&
      planMetaRef.current.analyze === explainAnalyzeMode
    ) {
      return;
    }

    const gen = ++explainFetchGenRef.current;
    let cancelled = false;
    // Debounce while typing in the editor so we don't hammer DuckDB every keystroke
    const timer = window.setTimeout(() => {
      const startedAt = performance.now();
      setLoadingExplain(true);
      duckDBService
        .getStructuredExplainPlan(sql, explainAnalyzeMode)
        .then(res => {
          if (cancelled || gen !== explainFetchGenRef.current) return;
          const text = res.planText || '';
          setLiveExplainPlan(text);
          setLiveExplainJson(res.jsonPlan || null);
          setPlanSourceSql(sql);
          setPlanFetchedAt(Date.now());
          setExplainPlanMs(performance.now() - startedAt);
          // Only cache successful non-empty plans — empty/error must allow retry
          const ok =
            Boolean(text.trim()) &&
            !text.startsWith('Error explaining') &&
            !text.startsWith('执行计划解析异常');
          planMetaRef.current = ok ? { sql, analyze: explainAnalyzeMode } : { sql: '', analyze: false };
        })
        .catch(err => {
          if (cancelled || gen !== explainFetchGenRef.current) return;
          setLiveExplainPlan(`执行计划解析异常: ${err?.message || err}`);
          setPlanSourceSql(sql);
          setPlanFetchedAt(Date.now());
          setExplainPlanMs(null);
          // Allow retry on next effect
          planMetaRef.current = { sql: '', analyze: false };
        })
        .finally(() => {
          if (!cancelled && gen === explainFetchGenRef.current) {
            setLoadingExplain(false);
          }
        });
    }, 320);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeSubTab, activeTabSql, explainAnalyzeMode]);

  const handleChartTypeChange = (next: ChartKind) => {
    setChartType(next);
    if (!usesSeriesEncoding(next)) {
      setChartSeries(CHART_SERIES_NONE);
    }
    try {
      localStorage.setItem('workbench_chart_kind', next);
    } catch { /* ignore */ }
  };

  const handleChartFamilyChange = (family: ChartFamily) => {
    const variants = CHART_FAMILY_VARIANTS[family];
    const next = variants.some(v => v.value === chartType) ? chartType : variants[0].value;
    handleChartTypeChange(next);
  };

  const handleSwapChartAxes = () => {
    if (!chartXAxis || !chartYAxis || chartXAxis === chartYAxis) {
      toastService.info('请先选择不同的字段后再互换');
      return;
    }
    setChartXAxis(chartYAxis);
    setChartYAxis(chartXAxis);
  };

  const handleExportChartPng = async () => {
    const element = chartHostRef.current;
    if (!element || !element.querySelector('canvas') || rawRows.length === 0) {
      toastService.info('当前没有可导出的图表');
      return;
    }
    try {
      const url = (await (await import('html2canvas')).default(element, {
        scale: 2, backgroundColor: '#1e1f1c', onclone: document => expandChartExport(document, element),
      })).toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `duckdb-chart-${chartType}-${Date.now()}.png`;
      a.click();
      toastService.success('图表已导出为 PNG');
    } catch {
      toastService.error('图表导出失败');
    }
  };

  const totalRowCount = result?.totalRows ?? rawRows.length;
  const loadedRowCount = rawRows.length;
  const executionTimeMs = typeof result?.executionTime === 'number'
    ? Math.round(result.executionTime)
    : (activeDataset ? 0 : 520);

  // Sorting & quick search in Results
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);
  const [tableSearch, setTableSearch] = useState<string>('');

  // Effective sort rules state (combines header click sort and panel sort rules)
  const [effectiveSortRules, setEffectiveSortRules] = useState<SortRule[]>([]);

  // Sync sort rules with table header clicks
  useEffect(() => {
    if (sortColumn) {
      setEffectiveSortRules([{ column: sortColumn, direction: sortDirection || 'asc', priority: 0 }]);
    } else {
      setEffectiveSortRules(sortRules);
    }
  }, [sortColumn, sortDirection, sortRules]);

  const filteredRows = useMemo(() => {
    let list = [...rawRows];

    // Apply enhanced filter rules
    if (filterRules.length > 0) {
      const activeRules = filterRules.filter(r => {
        if (r.operator === 'is_null' || r.operator === 'is_not_null') return true;
        return r.value.trim() !== '' || r.column !== '';
      });

      if (activeRules.length > 0) {
        list = list.filter(row => {
          return activeRules.reduce((acc, rule, idx) => {
            const cell = row[rule.column];
            let matches = false;

            switch (rule.operator) {
              case '=':
                matches = String(cell) === rule.value;
                break;
              case '!=':
                matches = String(cell) !== rule.value;
                break;
              case '>':
                matches = Number(cell) > Number(rule.value);
                break;
              case '>=':
                matches = Number(cell) >= Number(rule.value);
                break;
              case '<':
                matches = Number(cell) < Number(rule.value);
                break;
              case '<=':
                matches = Number(cell) <= Number(rule.value);
                break;
              case 'contains':
                matches = String(cell).toLowerCase().includes(rule.value.toLowerCase());
                break;
              case 'starts_with':
                matches = String(cell).toLowerCase().startsWith(rule.value.toLowerCase());
                break;
              case 'ends_with':
                matches = String(cell).toLowerCase().endsWith(rule.value.toLowerCase());
                break;
              case 'is_null':
                matches = cell === null || cell === undefined;
                break;
              case 'is_not_null':
                matches = cell !== null && cell !== undefined;
                break;
              case 'in':
                const inValues = rule.value.split(',').map(v => v.trim());
                matches = inValues.includes(String(cell));
                break;
              case 'between':
                const num = Number(cell);
                matches = num >= Number(rule.value) && num <= Number(rule.value2 || rule.value);
                break;
              default:
                matches = true;
            }

            if (idx === 0) return matches;
            if (rule.conjunction === 'OR') return acc || matches;
            return acc && matches;
          }, true as boolean);
        });
      }
    }

    // Apply quick search filter
    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase().trim();
      list = list.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q)));
    }

    // Apply sort rules (from header clicks or sort panel)
    const activeSorts = effectiveSortRules.length > 0 ? effectiveSortRules : sortRules;
    if (activeSorts.length > 0) {
      list.sort((a, b) => {
        for (const sort of activeSorts) {
          const valA = a[sort.column];
          const valB = b[sort.column];
          if (valA === valB) continue;
          if (valA === null || valA === undefined) return 1;
          if (valB === null || valB === undefined) return -1;
          if (typeof valA === 'number' && typeof valB === 'number') {
            return sort.direction === 'asc' ? valA - valB : valB - valA;
          }
          const cmp = String(valA).localeCompare(String(valB));
          if (sort.direction === 'desc') return -cmp;
          return cmp;
        }
        return 0;
      });
    }

    return list;
  }, [rawRows, filterRules, tableSearch, effectiveSortRules, sortRules]);

  const effectivePivotRow = pivotRowCol || '汇总范围';
  const effectivePivotCol = pivotColCol || '';
  const effectivePivotVal = pivotValCol || '记录数';
  const effectivePivotAgg = pivotValCol ? pivotAgg : 'count';

  const isSelectedValNumeric = useMemo(() => {
    if (!pivotValCol) return false;
    const type = (result?.columnTypeMap?.[pivotValCol] || '').toUpperCase();
    if (type.includes('INT') || type.includes('DECIMAL') || type.includes('FLOAT') || type.includes('DOUBLE') || type.includes('NUMERIC')) {
      return true;
    }
    for (const r of filteredRows.slice(0, 10)) {
      const v = r[pivotValCol];
      if (v != null && typeof v === 'number') return true;
    }
    return false;
  }, [pivotValCol, result, filteredRows]);

  const preparedPivotRows = useMemo(() => {
    if (!filteredRows.length) return [];
    if (pivotRowCol && pivotValCol) return filteredRows;
    return filteredRows.map(r => {
      const copy: Record<string, unknown> = { ...r };
      if (!pivotRowCol) copy[effectivePivotRow] = '全部';
      if (!pivotValCol) copy[effectivePivotVal] = 1;
      return copy;
    });
  }, [filteredRows, pivotRowCol, pivotValCol, effectivePivotRow, effectivePivotVal]);

  const formatPivotNumber = (value: number | string | null) => {
    if (pivotShowAs !== 'raw') {
      return formatValueBySpec(value, {
        unit: '%',
        decimals: pivotDecimals,
        compact: false,
        percent: false,
      });
    }
    const isCount = effectivePivotAgg === 'count' || effectivePivotAgg === 'count_distinct';
    return formatValueBySpec(value, {
      unit: isCount ? '个' : inferChartUnit(pivotValCol),
      decimals: isCount ? 0 : pivotDecimals,
      compact: false,
      thousandSeparator: true,
    });
  };

  const rawPivotSpec = useMemo(() => {
    if (!preparedPivotRows.length) {
      return widgetRowsToChartSpec([], {
        id:'sql-result-pivot',title:'透视表',type:'pivot',xKey:effectivePivotRow,yKeys:[effectivePivotVal],rowKey:effectivePivotRow,colKey:effectivePivotCol,valKey:effectivePivotVal,
        aggFunc:effectivePivotAgg,unit:['count','count_distinct'].includes(effectivePivotAgg)?'个':inferChartUnit(pivotValCol),format:{compact:false,thousandSeparator:true,decimals:['count','count_distinct'].includes(effectivePivotAgg)?0:pivotDecimals},
      });
    }
    return widgetRowsToChartSpec(preparedPivotRows, {
      id:'sql-result-pivot',title:'透视表',type:'pivot',xKey:effectivePivotRow,yKeys:[effectivePivotVal],rowKey:effectivePivotRow,colKey:effectivePivotCol,valKey:effectivePivotVal,
      aggFunc:effectivePivotAgg,unit:['count','count_distinct'].includes(effectivePivotAgg)?'个':inferChartUnit(pivotValCol),format:{compact:false,thousandSeparator:true,decimals:['count','count_distinct'].includes(effectivePivotAgg)?0:pivotDecimals},
    });
  }, [preparedPivotRows, effectivePivotRow, effectivePivotCol, effectivePivotVal, effectivePivotAgg, pivotValCol, pivotDecimals]);

  const dynamicPivotMatrix = useMemo(() => {
    if (!filteredRows.length) return null;
    const sameDim = Boolean(pivotColCol && pivotRowCol && pivotColCol === pivotRowCol);
    const hasCol = Boolean(pivotColCol && !sameDim);
    const baseTable = rawPivotSpec.pivotTable;
    if (!baseTable) return null;

    if (pivotShowAs === 'raw') {
      return {
        ...baseTable, sameDim, hasCol,
        rowKeys: baseTable.rowValues, colKeys: baseTable.colValues,
        truncatedRows: false, truncatedCols: false,
        totalRowKeys: baseTable.rowValues.length, totalColKeys: baseTable.colValues.length,
      };
    }

    const { rowValues, colValues, matrix: rawMatrix, rowTotals: rawRowTotals, colTotals: rawColTotals, grandTotal: rawGrandTotal } = baseTable;
    const grandNum = Number(rawGrandTotal) || 0;

    const transformedMatrix: Record<string, Record<string, number | string>> = Object.create(null);
    const transformedRowTotals: Record<string, number | string> = Object.create(null);
    const transformedColTotals: Record<string, number | string> = Object.create(null);

    for (const r of rowValues) {
      transformedMatrix[r] = Object.create(null);
      const rowSum = Number(rawRowTotals[r]) || 0;
      for (const c of colValues) {
        const cellRaw = rawMatrix[r]?.[c];
        if (cellRaw == null || cellRaw === '') continue;
        const cellNum = Number(cellRaw);
        if (Number.isNaN(cellNum)) continue;

        let pct: number | null = null;
        if (pivotShowAs === 'percent_total') {
          pct = grandNum ? (cellNum / grandNum) * 100 : 0;
        } else if (pivotShowAs === 'percent_row') {
          pct = rowSum ? (cellNum / rowSum) * 100 : 0;
        } else if (pivotShowAs === 'percent_col') {
          const colSum = Number(rawColTotals[c]) || 0;
          pct = colSum ? (cellNum / colSum) * 100 : 0;
        }
        if (pct != null) {
          transformedMatrix[r][c] = Number(pct.toFixed(pivotDecimals));
        }
      }

      if (pivotShowAs === 'percent_total') {
        transformedRowTotals[r] = grandNum ? Number(((rowSum / grandNum) * 100).toFixed(pivotDecimals)) : 0;
      } else if (pivotShowAs === 'percent_row') {
        transformedRowTotals[r] = 100;
      } else {
        transformedRowTotals[r] = rawRowTotals[r];
      }
    }

    for (const c of colValues) {
      const colSum = Number(rawColTotals[c]) || 0;
      if (pivotShowAs === 'percent_total') {
        transformedColTotals[c] = grandNum ? Number(((colSum / grandNum) * 100).toFixed(pivotDecimals)) : 0;
      } else if (pivotShowAs === 'percent_col') {
        transformedColTotals[c] = 100;
      } else {
        transformedColTotals[c] = rawColTotals[c];
      }
    }

    const transformedGrandTotal = pivotShowAs === 'percent_total' ? 100 : rawGrandTotal;

    return {
      ...baseTable, sameDim, hasCol,
      matrix: transformedMatrix,
      rowTotals: transformedRowTotals,
      colTotals: transformedColTotals,
      grandTotal: transformedGrandTotal,
      rowKeys: rowValues,
      colKeys: colValues,
      truncatedRows: false,
      truncatedCols: false,
      totalRowKeys: rowValues.length,
      totalColKeys: colValues.length,
    };
  }, [filteredRows, pivotRowCol, pivotColCol, rawPivotSpec, pivotShowAs, pivotDecimals]);

  const pivotSpec = useMemo(() => {
    if (!dynamicPivotMatrix) return rawPivotSpec;
    const isPct = pivotShowAs !== 'raw';
    return {
      ...rawPivotSpec,
      format: {
        unit: isPct ? '%' : (['count', 'count_distinct'].includes(effectivePivotAgg) ? '个' : inferChartUnit(pivotValCol)),
        decimals: isPct ? pivotDecimals : (['count', 'count_distinct'].includes(effectivePivotAgg) ? 0 : pivotDecimals),
        thousandSeparator: true,
        percent: false,
      },
      pivotTable: {
        ...dynamicPivotMatrix,
        rowKey: effectivePivotRow,
        colKey: effectivePivotCol,
        valKey: effectivePivotVal,
        aggregation: effectivePivotAgg,
        rowValues: dynamicPivotMatrix.rowKeys,
        colValues: dynamicPivotMatrix.colKeys,
      },
    };
  }, [rawPivotSpec, dynamicPivotMatrix, pivotShowAs, pivotDecimals, effectivePivotAgg, pivotValCol, effectivePivotRow, effectivePivotCol, effectivePivotVal]);

  const pivotColWidths = useMemo(() => {
    if (!dynamicPivotMatrix) {
      return { corner: 120, cols: {} as Record<string, number>, total: 96, table: 120 };
    }
    const { rowKeys, colKeys, matrix, rowTotals, colTotals, grandTotal } = dynamicPivotMatrix;
    const aggLabel = `${effectivePivotAgg.toUpperCase()}(${pivotValCol || '行数'})`;
    const cornerLabel = `${pivotRowCol || '全部'} \\ ${pivotColCol || '汇总'} · ${aggLabel}`;
    const corner = Math.max(
      120,
      Math.round(measureSansPx(cornerLabel, 12, 700) + 28),
      ...rowKeys.map(r => Math.round(measureSansPx(String(r), 12, 600) + 28)),
    );

    const cols: Record<string, number> = {};
    for (const cKey of colKeys) {
      const headerNeed = Math.round(measureSansPx(String(cKey), 12, 600) + 28);
      let maxContent = Math.round(measureSansPx('—', 12, 400) + 28);
      for (const rKey of rowKeys) {
        const val = matrix[rKey]?.[cKey];
        const text = formatPivotNumber(val ?? null);
        maxContent = Math.max(maxContent, Math.round(measureSansPx(text, 12, 400) + 28));
      }
      maxContent = Math.max(maxContent, Math.round(measureSansPx(formatPivotNumber(colTotals[cKey] ?? null), 12, 700) + 28));
      cols[cKey] = Math.max(72, Math.min(280, Math.max(headerNeed, maxContent)));
    }

    const totalHeader = Math.round(measureSansPx('总计', 12, 700) + 28);
    let totalContent = totalHeader;
    for (const rKey of rowKeys) {
      totalContent = Math.max(totalContent, Math.round(measureSansPx(formatPivotNumber(rowTotals[rKey] ?? null), 12, 600) + 28));
    }
    totalContent = Math.max(totalContent, Math.round(measureSansPx(formatPivotNumber(grandTotal), 12, 700) + 28));
    const total = Math.max(88, Math.min(200, totalContent));
    const table = corner + colKeys.reduce((sum, k) => sum + (cols[k] || 96), 0) + total;
    return { corner, cols, total, table };
  }, [dynamicPivotMatrix, pivotRowCol, pivotColCol, pivotValCol, effectivePivotAgg, formatPivotNumber]);

  const handleSwapPivotAxes = () => {
    if (!pivotRowCol && !pivotColCol) {
      toastService.info('行与列维度均为空，无需互换');
      return;
    }
    if (pivotRowCol === pivotColCol) {
      toastService.info('行与列维度相同，无需互换');
      return;
    }
    setPivotRowCol(pivotColCol);
    setPivotColCol(pivotRowCol);
  };

  const pivotSqlPreview = useMemo(() => {
    const baseSql = activeTabSql?.replace(/;\s*$/, '') || 'SELECT * FROM result';
    const indented = baseSql.replace(/\n/g, '\n    ');
    const aggFn = (pivotValCol ? pivotAgg : 'count').toUpperCase();
    const metricExpr = pivotValCol ? `${aggFn}(${pivotValCol})` : 'COUNT(*)';
    const metricAlias = pivotValCol ? `${aggFn.toLowerCase()}_${pivotValCol}` : 'record_count';
    const sameDim = Boolean(pivotColCol && pivotRowCol && pivotColCol === pivotRowCol);
    const hasCol = Boolean(pivotColCol && !sameDim);
    const hasRow = Boolean(pivotRowCol);

    if (hasRow && hasCol) {
      return `SELECT\n    ${pivotRowCol},\n    ${pivotColCol},\n    ${metricExpr} AS ${metricAlias}\nFROM (\n    ${indented}\n)\nGROUP BY\n    ${pivotRowCol},\n    ${pivotColCol};`;
    } else if (hasRow) {
      return `SELECT\n    ${pivotRowCol},\n    ${metricExpr} AS ${metricAlias}\nFROM (\n    ${indented}\n)\nGROUP BY\n    ${pivotRowCol};`;
    } else if (hasCol) {
      return `SELECT\n    ${pivotColCol},\n    ${metricExpr} AS ${metricAlias}\nFROM (\n    ${indented}\n)\nGROUP BY\n    ${pivotColCol};`;
    } else {
      return `SELECT\n    ${metricExpr} AS ${metricAlias}\nFROM (\n    ${indented}\n);`;
    }
  }, [activeTabSql, pivotRowCol, pivotColCol, pivotValCol, pivotAgg]);

  const handleGeneratePivotSql = () => {
    if (!pivotRowCol || !pivotValCol) {
      toastService.info('请先配置行维度与值字段');
      return;
    }
    if (onApplyAggregateToSql) {
      onApplyAggregateToSql(pivotSqlPreview, `透视 ${pivotAgg.toUpperCase()}(${pivotValCol})`, true);
      toastService.success('已生成透视 SQL 并打开新查询标签');
    } else {
      navigator.clipboard.writeText(pivotSqlPreview);
      toastService.success('已复制透视 SQL');
    }
  };

  const handleCopyPivotMatrix = () => {
    if (!dynamicPivotMatrix || dynamicPivotMatrix.rowKeys.length === 0) {
      toastService.info('当前无透视矩阵可复制');
      return;
    }
    const { rowKeys, colKeys, matrix, rowTotals, colTotals, grandTotal } = dynamicPivotMatrix;
    const header = [`${pivotRowCol}\\${pivotColCol || '汇总'}`, ...colKeys, '总计'];
    const lines = [header.join('\t')];
    for (const rKey of rowKeys) {
      const cells = colKeys.map(cKey => formatPivotNumber(matrix[rKey]?.[cKey] ?? null));
      lines.push([rKey, ...cells, formatPivotNumber(rowTotals[rKey] ?? null)].join('\t'));
    }
    lines.push(['总计', ...colKeys.map(cKey => formatPivotNumber(colTotals[cKey] ?? null)), formatPivotNumber(grandTotal)].join('\t'));
    navigator.clipboard.writeText(lines.join('\n'));
    toastService.success('已复制透视矩阵 (TSV)');
  };

  const resultChartConfig: ChartConfig = {
    id: 'sql-result', title: `${chartYAxis} by ${chartXAxis}`,
    type: chartType === 'column' ? 'bar' : chartType,
    xKey: chartXAxis, yKeys: [chartYAxis], aggregation: chartAgg,
    horizontal: chartType === 'bar', groupBy: chartSeriesActive ? chartSeries : undefined,
    categorySort: chartSort, topN: chartType === 'scatter' ? undefined : chartTopN,
    showLegend: chartLegend !== 'hidden', legendPosition: chartLegend === 'hidden' ? 'bottom' : chartLegend,
    showValues: chartShowLabels, labelMode: chartShowLabels ? 'auto' : 'never',
    stackMode: chartSeriesActive && ['bar', 'column', 'area'].includes(chartType)
      ? (chartValueMode === 'percent' ? 'percent' : 'stack') : 'none',
    valueMode: chartValueMode, missingValue: 'break',
    colors: chartColorMode === 'mono' ? ['#66d9ef'] : undefined,
    format: chartValueMode === 'percent' ? { unit: '%', percent: true } : undefined,
  };
  const resultChartSpec = widgetRowsToChartSpec(filteredRows, resultChartConfig);

  const totalFilteredCount = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / pageSize));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalFilteredCount);

  const displayedRows = useMemo(() => {
    return filteredRows.slice(startIndex, endIndex);
  }, [filteredRows, startIndex, endIndex]);

  // Parse DuckDB error into structured diagnosis (kind / object / suggestion / snippet)
  const parsedErrorInfo = useMemo(() => {
    if (!result?.error) return null;
    return parseDuckDbError(result.error, result.errorContext);
  }, [result?.error, result?.errorContext]);

  const [errorSimilarTables, setErrorSimilarTables] = useState<string[]>([]);
  const [showErrorRaw, setShowErrorRaw] = useState(false);

  useEffect(() => {
    setShowErrorRaw(false);
    setErrorSimilarTables([]);
    if (!parsedErrorInfo || parsedErrorInfo.kind !== 'catalog') return;

    let cancelled = false;
    const needle = (parsedErrorInfo.missingObject || '').toLowerCase();

    duckDBService
      .getBaseTables()
      .then(tables => {
        if (cancelled) return;
        const scored = tables
          .map(name => {
            const lower = name.toLowerCase();
            const dist = needle ? levenshtein(needle, lower) : 99;
            const contains =
              needle && (lower.includes(needle) || needle.includes(lower)) ? 0 : 1;
            return { name, score: dist + contains * 2 };
          })
          .sort((a, b) => a.score - b.score)
          .slice(0, 6)
          .map(t => t.name);
        const withSuggest = parsedErrorInfo.suggestion
          ? [parsedErrorInfo.suggestion, ...scored.filter(t => t !== parsedErrorInfo.suggestion)]
          : scored;
        setErrorSimilarTables(Array.from(new Set(withSuggest)).slice(0, 6));
      })
      .catch(() => {
        if (!cancelled && parsedErrorInfo.suggestion) {
          setErrorSimilarTables([parsedErrorInfo.suggestion]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [parsedErrorInfo?.kind, parsedErrorInfo?.missingObject, parsedErrorInfo?.suggestion, result?.resultId]);

  const handleApplyErrorSuggestion = (replacement: string) => {
    const sql = activeTabSql || '';
    const missing = parsedErrorInfo?.missingObject;
    if (!sql.trim()) {
      toastService.info('当前编辑器没有可替换的 SQL');
      return;
    }

    let nextSql = sql;
    if (missing) {
      const re = new RegExp(`\\b${missing.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      if (re.test(sql)) {
        nextSql = sql.replace(re, replacement);
      } else {
        nextSql = sql.replace(missing, replacement);
      }
    } else {
      onUseQualifiedName?.(replacement);
      toastService.success(`已插入表名 ${replacement}`);
      return;
    }

    if (nextSql === sql) {
      onUseQualifiedName?.(replacement);
      toastService.info(`未在 SQL 中定位到「${missing}」，已尝试插入 ${replacement}`);
      return;
    }

    if (onApplyAggregateToSql) {
      onApplyAggregateToSql(nextSql, `修复 → ${replacement}`, true);
      toastService.success(`已将「${missing}」替换为「${replacement}」并重新执行`);
    } else {
      onUseQualifiedName?.(replacement);
      toastService.success(`已应用建议：${replacement}`);
    }
  };

  const handleCopyErrorLog = async () => {
    const raw = result?.error || '';
    const info = parsedErrorInfo;
    const payload = [
      info ? `[${info.category}]` : '[SQL Error]',
      info?.lineNum ? `Line: ${info.lineNum}${info.columnNum ? ` Col: ${info.columnNum}` : ''}` : null,
      info?.missingObject ? `Missing: ${info.missingObject}` : null,
      info?.suggestion ? `Suggestion: ${info.suggestion}` : null,
      '',
      raw,
      activeTabSql ? `\n--- SQL ---\n${activeTabSql}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await navigator.clipboard.writeText(payload);
      toastService.success('已复制诊断日志与 SQL');
    } catch {
      toastService.error('复制失败');
    }
  };

  const handleListTablesSql = () => {
    const sql = `SELECT database_name, schema_name, table_name, table_type\nFROM duckdb_tables()\nORDER BY 1, 2, 3;`;
    if (onApplyAggregateToSql) {
      onApplyAggregateToSql(sql, '浏览可用表', true);
    } else {
      toastService.info('请手动执行：SELECT * FROM duckdb_tables();');
    }
  };

  const handleHeaderClick = (col: string) => {
    onSelectColumn?.(col);

    // Toggle sort direction or clear sort
    if (sortColumn === col) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
        setEffectiveSortRules([{ column: col, direction: 'desc', priority: 0 }]);
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
        setEffectiveSortRules([]);
        setSortRules([]);
      }
    } else {
      setSortColumn(col);
      setSortDirection('asc');
      setEffectiveSortRules([{ column: col, direction: 'asc', priority: 0 }]);
    }
  };

  // Sort Rules Management
  const handleAddSortRule = (column: string) => {
    if (sortRules.some(r => r.column === column)) {
      toastService.info(`「${column}」已在排序规则中`);
      return;
    }
    setSortRules([...sortRules, { column, direction: 'asc', priority: sortRules.length }]);
    setEffectiveSortRules([...sortRules, { column, direction: 'asc', priority: sortRules.length }]);
    setSortColumn(null);
    setSortDirection(null);
  };

  const handleRemoveSortRule = (column: string) => {
    const newRules = sortRules.filter(r => r.column !== column);
    setSortRules(newRules);
    setEffectiveSortRules(newRules);
  };

  const handleToggleSortDirection = (column: string) => {
    const newRules: SortRule[] = sortRules.map(r =>
      r.column === column ? { ...r, direction: (r.direction === 'asc' ? 'desc' : 'asc') as 'asc' | 'desc' } : r
    );
    setSortRules(newRules);
    setEffectiveSortRules(newRules);
  };

  const handleClearAllSortRules = () => {
    setSortRules([]);
    setEffectiveSortRules([]);
    setSortColumn(null);
    setSortDirection(null);
  };

  const handleCellContextMenu = (e: React.MouseEvent, column: string, value: any) => {
    e.preventDefault();
    e.stopPropagation();
    setCellMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      column,
      value,
    });
  };

  const handleApplyCellFilter = (op: '=' | '!=') => {
    if (!cellMenu) return;
    const { column, value } = cellMenu;
    setCellMenu(null);

    const filterVal = typeof value === 'number' ? value : `'${value}'`;
    const filterClause = `${column} ${op} ${filterVal}`;

    const baseSql = activeTabSql?.replace(/;\s*$/, '') || 'SELECT * FROM orders';
    const newSql = `SELECT *\nFROM (\n    ${baseSql.replace(/\n/g, '\n    ')}\n)\nWHERE ${filterClause};`;

    if (onApplyAggregateToSql) {
      onApplyAggregateToSql(newSql, `筛选 ${column} ${op} ${value}`, true);
    } else {
      toastService.success(`已生成过滤 SQL: WHERE ${filterClause}`);
    }
  };

  const handleGroupFromCell = () => {
    if (!cellMenu) return;
    const { column } = cellMenu;
    setCellMenu(null);

    const baseSql = activeTabSql?.replace(/;\s*$/, '') || 'SELECT * FROM orders';
    const newSql = `SELECT\n    ${column},\n    COUNT(*) AS count\nFROM (\n    ${baseSql.replace(/\n/g, '\n    ')}\n)\nGROUP BY\n    ${column};`;

    if (onApplyAggregateToSql) {
      onApplyAggregateToSql(newSql, `按 ${column} 分组`, true);
    } else {
      toastService.success(`已生成按 ${column} 分组 SQL`);
    }
  };

  const handleGeneratedFilterSql = () => {
    const baseSql = activeTabSql?.replace(/;\s*$/, '') || 'SELECT * FROM orders';
    const activeRules = filterRules.filter(r => {
      if (r.operator === 'is_null' || r.operator === 'is_not_null') return true;
      return r.value.trim() !== '' && r.column !== '';
    });

    if (activeRules.length === 0) {
      toastService.warning('请至少添加一个有效的筛选条件');
      return;
    }

    const clauses = activeRules.map((r, idx) => {
      let clause = '';
      const col = r.column || 'column_name';

      switch (r.operator) {
        case '=':
          clause = isNaN(Number(r.value)) ? `${col} = '${r.value}'` : `${col} = ${r.value}`;
          break;
        case '!=':
          clause = isNaN(Number(r.value)) ? `${col} != '${r.value}'` : `${col} != ${r.value}`;
          break;
        case '>':
        case '>=':
        case '<':
        case '<=':
          clause = `${col} ${r.operator} ${r.value}`;
          break;
        case 'contains':
          clause = `${col} ILIKE '%${r.value}%'`;
          break;
        case 'starts_with':
          clause = `${col} ILIKE '${r.value}%'`;
          break;
        case 'ends_with':
          clause = `${col} ILIKE '%${r.value}'`;
          break;
        case 'is_null':
          clause = `${col} IS NULL`;
          break;
        case 'is_not_null':
          clause = `${col} IS NOT NULL`;
          break;
        case 'in':
          const inValues = r.value.split(',').map(v => {
            const trimmed = v.trim();
            return isNaN(Number(trimmed)) ? `'${trimmed}'` : trimmed;
          }).join(', ');
          clause = `${col} IN (${inValues})`;
          break;
        case 'between':
          clause = `${col} BETWEEN ${r.value} AND ${r.value2 || r.value}`;
          break;
        default:
          clause = `${col} = '${r.value}'`;
      }

      // Add conjunction for non-first rules
      if (idx > 0) {
        return { clause, conjunction: r.conjunction };
      }
      return { clause, conjunction: null };
    });

    // Build WHERE clause with proper AND/OR grouping
    let whereStr = clauses.map((c, idx) => {
      if (idx === 0) return c.clause;
      if (c.conjunction === 'OR') return ` OR ${c.clause}`;
      return ` AND ${c.clause}`;
    }).join('');

    const newSql = `SELECT *\nFROM (\n    ${baseSql.replace(/\n/g, '\n    ')}\n)\nWHERE ${whereStr};`;

    setShowFilterModal(false);
    if (onApplyAggregateToSql) {
      onApplyAggregateToSql(newSql, `筛选查询 (${activeRules.length} 个条件)`, true);
    } else {
      toastService.success('已应用筛选并生成新 SQL');
    }
  };

  const groupSqlPreview = useMemo(() => {
    const baseSql = activeTabSql?.replace(/;\s*$/, '') || 'SELECT * FROM orders';
    const groupColsStr = groupByCols.length > 0 ? groupByCols.join(', ') : '/* 选择分组列 */';
    const aggStrs = aggMetrics
      .map(m => `${m.aggregator}(${m.column}) AS ${m.alias || 'total'}`)
      .join(',\n    ');
    return `SELECT\n    ${groupColsStr},\n    ${aggStrs}\nFROM (\n    ${baseSql.replace(/\n/g, '\n    ')}\n)\nGROUP BY\n    ${groupColsStr};`;
  }, [activeTabSql, groupByCols, aggMetrics]);

  const handleGeneratedGroupSql = () => {
    if (groupByCols.length === 0) {
      toastService.info('请至少选择一个分组列');
      return;
    }
    setShowGroupModal(false);
    if (onApplyAggregateToSql) {
      onApplyAggregateToSql(groupSqlPreview, `分组分析`, true);
    } else {
      toastService.success('已应用分组聚合并生成新 SQL');
    }
  };

  const handleCopyGroupSqlPreview = async () => {
    if (!groupSqlPreview.trim()) {
      toastService.info('当前无可复制的 SQL');
      return;
    }
    try {
      await navigator.clipboard.writeText(groupSqlPreview);
      toastService.success('已复制分组 SQL');
    } catch {
      toastService.error('复制失败');
    }
  };

  const exportHandler = exportFormat === 'csv' ? onExportCsv : exportFormat === 'json' ? onExportJson : exportFormat === 'parquet' ? onExportParquet : undefined;
  const handleExecuteExport = () => {
    if (!exportHandler || rawRows.length === 0) return;
    setShowExportModal(false);
    exportHandler();
  };

  return (
    <div className={`flex h-full w-full min-h-0 flex-col overflow-auto bg-monokai-bg select-none text-monokai-fg font-sans ${isFullscreen ? 'fixed inset-0 z-50 bg-monokai-bg shadow-2xl p-2' : ''}`}>
      {/* 1. Unified Result Header (h-11: 44px) - Clean Segmented Pill & Focused Actions */}
      <div className="flex min-h-11 flex-wrap py-1 whitespace-nowrap shrink-0 items-center justify-between border-b border-monokai-border bg-gradient-to-b from-monokai-surface/95 via-monokai-surface/85 to-monokai-surface/70 px-3 gap-3 text-xs select-none relative z-10 font-sans">
        {/* Top hairline for crisp top edge with refined gradient */}
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-monokai-cyan/20 to-transparent" />

        {/* Left: View Mode Subtabs (Clean Segmented Pill) */}
        <div className="flex flex-wrap items-center gap-2.5 min-w-0 max-w-full">
          <SegmentedTabs<'data' | 'chart' | 'pivot' | 'explain'>
            aria-label="查询结果视图切换"
            value={activeSubTab}
            items={[
              { value: 'data', label: '数据', icon: TableIcon, badge: rawRows.length > 0 ? rawRows.length : undefined },
              { value: 'chart', label: '图表', icon: BarChart2 },
              { value: 'pivot', label: '透视', icon: TableProperties },
              { value: 'explain', label: '执行计划', icon: Activity },
            ]}
            onChange={val => setActiveSubTab(val)}
            size="sm"
            tone="accent"
          />

          {/* Vertical divider */}
          {activeSubTab === 'data' && (
            <div className="hidden md:block h-5 w-px bg-gradient-to-b from-transparent via-monokai-border to-transparent" />
          )}

          {/* Center: Table Quick Search Input (when activeSubTab is 'data') */}
          {activeSubTab === 'data' && (
            <div className="relative hidden md:flex items-center w-56">
              <Search className="w-3.5 h-3.5 absolute left-2.5 text-monokai-comment/70 pointer-events-none z-10" />
              <input
                type="text"
                value={tableSearch}
                onChange={e => setTableSearch(e.target.value)}
                placeholder="过滤当前结果..."
                className="w-full bg-monokai-bg/70 border border-monokai-border/80 rounded-md pl-7 pr-7 py-1 text-xs text-monokai-fg placeholder:text-monokai-comment/65 focus:outline-none focus:border-monokai-cyan/60 focus:bg-monokai-bg focus:ring-1 focus:ring-monokai-cyan/25 font-mono transition-all duration-150"
              />
              {tableSearch && (
                <button
                  onClick={() => setTableSearch('')}
                  className="absolute right-1.5 p-0.5 text-monokai-comment/70 hover:text-monokai-pink cursor-pointer transition-colors"
                  title="清空搜索"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: Focused Data Actions + Status & Metrics */}
        <div className="flex flex-wrap items-center gap-2.5 min-w-0 max-w-full">
          {/* MECE Action Pills — transform / aggregate / export (views live in SegmentedTabs) */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-gradient-to-b from-monokai-bg/75 to-monokai-bg/45 border border-monokai-border/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),inset_0_-1px_0_rgba(0,0,0,0.18),0_1px_2px_-1px_rgba(0,0,0,0.2)]">
            
            {/* Filter Button — 条件筛选 */}
            <button
              onClick={() => setShowFilterModal(true)}
              className={`group flex items-center gap-1.5 h-7 px-2.5 rounded-md transition-all duration-200 cursor-pointer text-meta font-semibold tracking-tight ${
                filterRules.some(r => r.column && (r.operator === 'is_null' || r.operator === 'is_not_null' || r.value.trim() !== ''))
                  ? 'bg-gradient-to-b from-monokai-yellow/22 to-monokai-yellow/10 text-monokai-yellow border border-monokai-yellow/45 shadow-[inset_0_0_0_1px_rgba(230,219,116,0.12)]'
                  : 'text-monokai-comment/85 hover:bg-gradient-to-b hover:from-monokai-elevated/80 hover:to-monokai-elevated/50 hover:text-monokai-yellow border border-transparent hover:border-monokai-yellow/35 hover:shadow-[0_0_0_1px_rgba(230,219,116,0.10)]'
              }`}
              title="筛选 — 多条件 AND/OR 逻辑过滤 (Ctrl+Shift+F)"
            >
              <Filter className="w-3 h-3 transition-transform group-hover:scale-110" />
              <span>筛选</span>
              {filterRules.filter(r => r.column && (r.operator === 'is_null' || r.operator === 'is_not_null' || r.value.trim() !== '')).length > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center min-w-3.5 h-3.5 px-1 rounded-full bg-monokai-yellow/35 text-3xs font-bold text-monokai-bg tabular-nums">
                  {filterRules.filter(r => r.column && (r.operator === 'is_null' || r.operator === 'is_not_null' || r.value.trim() !== '')).length}
                </span>
              )}
            </button>

            {/* Sort Panel Toggle — 排序管理 */}
            <button
              onClick={() => setShowSortPanel(!showSortPanel)}
              className={`group flex items-center gap-1.5 h-7 px-2.5 rounded-md transition-all duration-200 cursor-pointer text-meta font-semibold tracking-tight ${
                showSortPanel || sortRules.length > 0 || sortColumn
                  ? 'bg-gradient-to-b from-monokai-cyan/22 to-monokai-cyan/10 text-monokai-cyan border border-monokai-cyan/45 shadow-[inset_0_0_0_1px_rgba(102,217,239,0.12)]'
                  : 'text-monokai-comment/85 hover:bg-gradient-to-b hover:from-monokai-elevated/80 hover:to-monokai-elevated/50 hover:text-monokai-cyan border border-transparent hover:border-monokai-cyan/35 hover:shadow-[0_0_0_1px_rgba(102,217,239,0.10)]'
              }`}
              title="排序 — 多字段排序规则管理 (Ctrl+Shift+S)"
            >
              <ArrowUpDown className="w-3 h-3 transition-transform group-hover:scale-110" />
              <span>排序</span>
              {(sortRules.length > 0 || sortColumn) && (
                <span className="ml-0.5 inline-flex items-center justify-center min-w-3.5 h-3.5 px-1 rounded-full bg-monokai-cyan/35 text-3xs font-bold text-monokai-bg tabular-nums">
                  {sortRules.length || (sortColumn ? 1 : 0)}
                </span>
              )}
            </button>

            <span className="w-px h-3.5 bg-monokai-border/45 mx-0.5" aria-hidden />

            {/* Group + Aggregate Button — 分组聚合 */}
            <button
              onClick={() => {
                const preferGroup =
                  columns.find(c => /region|category|status|type|name|date/i.test(c)) || columns[0];
                if (groupByCols.length === 0 && columns.length > 0) {
                  setGroupByCols([preferGroup]);
                }
                if (aggMetrics.length === 0 && columns.length > 0) {
                  const preferMetric =
                    columns.find(c => /amount|price|total|qty|quantity|sum|val|cost|revenue/i.test(c)) ||
                    columns.find(c => c !== preferGroup) ||
                    columns[0];
                  const useSum = /amount|price|total|qty|quantity|sum|val|cost|revenue/i.test(preferMetric);
                  setAggMetrics([
                    {
                      column: preferMetric,
                      aggregator: useSum ? 'SUM' : 'COUNT',
                      alias: useSum ? `total_${preferMetric}` : `cnt_${preferMetric}`,
                    },
                  ]);
                }
                setShowGroupModal(true);
              }}
              className={`group flex items-center gap-1.5 h-7 px-2.5 rounded-md transition-all duration-200 cursor-pointer text-meta font-semibold tracking-tight ${
                showGroupModal
                  ? 'bg-gradient-to-b from-monokai-green/22 to-monokai-green/10 text-monokai-green border border-monokai-green/45 shadow-[inset_0_0_0_1px_rgba(166,226,46,0.12)]'
                  : 'text-monokai-comment/85 hover:bg-gradient-to-b hover:from-monokai-elevated/80 hover:to-monokai-elevated/50 hover:text-monokai-green border border-transparent hover:border-monokai-green/35 hover:shadow-[0_0_0_1px_rgba(166,226,46,0.10)]'
              }`}
              title="分组聚合 — 生成 GROUP BY SQL，支持多指标编排 (Ctrl+Shift+G)"
            >
              <Sigma className="w-3 h-3 transition-transform group-hover:scale-110" />
              <span>分组</span>
            </button>

            <span className="w-px h-3.5 bg-monokai-border/45 mx-0.5" aria-hidden />

            {/* Export Button — 导出数据 */}
            <button
              onClick={() => setShowExportModal(true)}
              className="group flex items-center gap-1.5 h-7 px-2.5 rounded-md text-monokai-comment/85 hover:bg-gradient-to-b hover:from-monokai-elevated/80 hover:to-monokai-elevated/50 hover:text-monokai-orange border border-transparent hover:border-monokai-orange/35 hover:shadow-[0_0_0_1px_rgba(253,151,31,0.10)] transition-all duration-200 cursor-pointer text-meta font-semibold tracking-tight"
              title="导出 — 下载为 Parquet/CSV/JSON/Arrow 格式 (Ctrl+Shift+E)"
            >
              <Download className="w-3 h-3 transition-transform group-hover:scale-110" />
              <span>导出</span>
              <ChevronDown className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100 group-hover:rotate-180 transition-all duration-200" />
            </button>
          </div>

          {/* Execution Metric Chips - Refined Badge Design */}
          {loading ? (
            <div className="hidden sm:flex items-center gap-1.5 pl-2.5 border-l border-monokai-border/70 text-xs font-mono">
              <span
                data-testid="execution-status-badge"
                className="flex items-center gap-1.5 text-monokai-cyan font-semibold px-2.5 py-1 rounded-md bg-gradient-to-b from-monokai-cyan/18 to-monokai-cyan/8 border border-monokai-cyan/45"
              >
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="tracking-tight text-2xs">执行中</span>
              </span>
            </div>
          ) : activeDataset ? (
            <div className="hidden sm:flex items-center gap-1.5 pl-2.5 border-l border-monokai-border/70 text-xs font-mono">
              {result?.error ? (
                <span className="group flex items-center gap-1.5 text-monokai-pink font-semibold px-2.5 py-1 rounded-md bg-gradient-to-b from-monokai-pink/15 to-monokai-pink/8 border border-monokai-pink/40 hover:from-monokai-pink/22 hover:to-monokai-pink/12 transition-all duration-200 shadow-[inset_0_0_0_1px_rgba(249,38,114,0.08),0_1px_2px_-1px_rgba(249,38,114,0.18)]">
                  <span className="relative flex items-center justify-center" aria-hidden="true">
                    <AlertCircle className="w-3 h-3" />
                    <span className="absolute inset-0 blur-[3px] bg-monokai-pink/55 animate-pulse rounded-full" />
                  </span>
                  <span className="tracking-tight text-2xs">执行出错</span>
                </span>
              ) : isViewingPrevious ? (
                <span className="flex items-center gap-1.5 text-monokai-yellow font-semibold px-2.5 py-1 rounded-md bg-gradient-to-b from-monokai-yellow/15 to-monokai-yellow/8 border border-monokai-yellow/40">
                  <RotateCcw className="w-3 h-3" />
                  <span className="tracking-tight text-2xs">历史结果</span>
                </span>
              ) : isStale ? (
                <span className="flex items-center gap-1.5 text-monokai-yellow font-semibold px-2.5 py-1 rounded-md bg-gradient-to-b from-monokai-yellow/15 to-monokai-yellow/8 border border-monokai-yellow/40 shadow-[inset_0_0_0_1px_rgba(230,219,116,0.06),0_1px_2px_-1px_rgba(230,219,116,0.15)]">
                  <Clock className="w-3 h-3" />
                  <span className="tracking-tight text-2xs">待重新运行</span>
                </span>
              ) : (
                <span
                  data-testid="execution-status-badge"
                  className="group flex items-center gap-1.5 text-monokai-green font-semibold px-2.5 py-1 rounded-md bg-gradient-to-b from-monokai-green/18 via-monokai-green/14 to-monokai-green/8 border border-monokai-green/45 hover:from-monokai-green/25 hover:via-monokai-green/18 hover:to-monokai-green/12 transition-all duration-200 shadow-[inset_0_0_0_1px_rgba(166,226,46,0.08),0_1px_3px_-1px_rgba(166,226,46,0.22)] backdrop-blur-xs"
                >
                  <span className="relative flex items-center justify-center shrink-0" aria-hidden="true">
                    <span className="w-1.5 h-1.5 rounded-full bg-monokai-green shadow-[0_0_8px_rgba(166,226,46,0.85)] animate-pulse" />
                    <span className="absolute inset-0 blur-[3px] bg-monokai-green/55 rounded-full" />
                  </span>
                  <Check className="w-3 h-3 relative" strokeWidth={3} />
                  <span className="tracking-tight text-2xs">执行成功</span>
                </span>
              )}
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-gradient-to-b from-monokai-bg/85 to-monokai-bg/65 border border-monokai-border/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_1px_2px_-1px_rgba(0,0,0,0.42)] backdrop-blur-xs">
                <span
                  title="数据行数"
                  data-testid="metric-rows"
                  className="font-bold tabular-nums tracking-tight text-monokai-green text-2xs"
                >
                  {rawRows.length.toLocaleString()}
                </span>
                <span className="text-2xs text-monokai-comment/65">行</span>
                <span className="w-px h-3 bg-monokai-border/75" />
                <span
                  title="字段列数"
                  data-testid="metric-cols"
                  className="font-bold tabular-nums tracking-tight text-monokai-cyan text-2xs"
                >
                  {columns.length}
                </span>
                <span className="text-2xs text-monokai-comment/65">列</span>
                <span className="w-px h-3 bg-monokai-border/75" />
                <span
                  title="执行耗时"
                  data-testid="metric-time"
                  className="font-bold tabular-nums tracking-tight text-monokai-amethyst text-2xs"
                >
                  {executionTimeMs}
                </span>
                <span className="text-2xs text-monokai-comment/65">ms</span>
              </div>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 pl-2.5 border-l border-monokai-border/70 text-xs font-mono text-monokai-comment/80">
              <span className="relative flex items-center justify-center" aria-hidden="true">
                <span className="w-1.5 h-1.5 rounded-full bg-monokai-comment/55" />
                <span className="absolute inset-0 blur-sm bg-monokai-comment/30 rounded-full" />
              </span>
              <span className="text-2xs uppercase tracking-[0.12em] font-semibold">就绪待命</span>
            </div>
          )}

          {/* Column Layout Mode & Resets */}
          {result?.executedSql && !result.error && !result.isExplain && <ActionButton size="sm" variant="primary" disabled={loading || isStale} onClick={()=>{
            try {
              const dataset=datasetFromQueryResult(result,result.resultId || 'result',activeTabTitle || result.queryTitle || 'SQL');
              if(dataset.catalog!==useAppStore.getState().currentDatabase)throw new Error('查询所属数据库已变化，请重新执行');
              openPivotAnalysis(dataset);
            }catch(error){toastService.error(String((error as Error).message));}
          }}>透视分析</ActionButton>}
          {result?.executedSql && !result.error && !result.isExplain && <ActionButton size="sm" variant="secondary" disabled={loading || isStale} onClick={()=>{
            try {
              const dataset=datasetFromQueryResult(result,result.resultId || 'result',activeTabTitle || result.queryTitle || 'SQL');
              if(dataset.catalog!==useAppStore.getState().currentDatabase)throw new Error('查询所属数据库已变化，请重新执行');
              useAppStore.getState().setActiveDataset(dataset);useAppStore.getState().setActiveTab(Tab.ONTOLOGY);
            }catch(error){toastService.error(String((error as Error).message));}
          }}>在图谱中查看</ActionButton>}
          {activeSubTab === 'data' && columns.length > 0 && (
            <div className="hidden md:flex items-center gap-1 pl-2.5 border-l border-monokai-border/70">
              <button
                type="button"
                onClick={() => {
                  setTableLayoutMode(prev => prev === 'auto' ? 'fill' : 'auto');
                  toastService.info(tableLayoutMode === 'auto' ? '已切换为铺满容器宽度' : '已切换为紧凑内容自适应 (消除无效留白)');
                }}
                className="group flex items-center gap-1 px-2 py-1 rounded-md text-2xs border border-monokai-border/70 bg-monokai-bg/70 text-monokai-fg-muted hover:text-monokai-cyan hover:bg-monokai-cyan/10 hover:border-monokai-cyan/45 transition-all duration-200 cursor-pointer font-semibold tracking-tight"
                title={tableLayoutMode === 'auto' ? '当前: 智能紧凑自适应 (点击切换为铺满全宽)' : '当前: 铺满容器全宽 (点击切换为紧凑自适应)'}
              >
                <Columns className="w-3 h-3 text-monokai-cyan/85 group-hover:text-monokai-cyan transition-colors" />
                <span>{tableLayoutMode === 'auto' ? '紧凑自适应' : '铺满全宽'}</span>
              </button>

              {Object.keys(customColWidths).length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomColWidths({});
                    toastService.info('已重置所有列为默认自适应宽度');
                  }}
                  className="group flex items-center gap-1 px-2 py-1 rounded-md text-2xs border border-monokai-yellow/40 bg-gradient-to-b from-monokai-yellow/15 to-monokai-yellow/8 text-monokai-yellow hover:from-monokai-yellow/22 hover:to-monokai-yellow/14 hover:border-monokai-yellow/55 transition-all duration-200 cursor-pointer font-semibold tracking-tight shadow-[inset_0_0_0_1px_rgba(230,219,116,0.06)]"
                  title="重置自定义拖拽宽度为最佳自适应"
                >
                  <RotateCcw className="w-3 h-3 group-hover:-rotate-90 transition-transform duration-300" />
                  <span>重置</span>
                </button>
              )}
            </div>
          )}

          {/* Fullscreen Toggle */}
          <button
            onClick={() => {
              setIsFullscreen(prev => !prev);
              toastService.info(isFullscreen ? '已退出全屏' : '已进入全屏结果浏览模式 (按 ESC 退出)');
            }}
            className={`p-1.5 rounded-md transition-all duration-200 cursor-pointer border ${
              isFullscreen
                ? 'bg-monokai-accent/25 text-monokai-accent border-monokai-accent/50 shadow-[0_0_10px_rgba(166,226,46,0.22)]'
                : 'hover:bg-monokai-elevated/80 text-monokai-comment/85 hover:text-monokai-fg border-transparent hover:border-monokai-border/85'
            }`}
            title={isFullscreen ? '退出全屏 (ESC)' : '全屏浏览结果集'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 3. Main Result Content Area based on Active Subtab */}
      <div
        className={`flex-1 relative custom-scrollbar min-h-32 ${
          activeSubTab === 'explain' || activeSubTab === 'chart' || activeSubTab === 'pivot' ? 'overflow-hidden flex flex-col' : 'overflow-auto'
        }`}
        data-testid="result-content-area"
      >
        {loading && (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-monokai-bg/70 backdrop-blur-[2px] font-sans"
            data-testid="result-loading-overlay"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="h-6 w-6 animate-spin text-monokai-cyan" />
            <div className="text-center space-y-1">
              <p className="text-xs font-semibold text-monokai-fg">正在执行查询…</p>
              <p className="text-meta text-monokai-comment">结果区会在完成后自动刷新</p>
            </div>
          </div>
        )}

        {isViewingPrevious && !result?.error && onReturnToLatestResult && (
          <div className="sticky top-0 z-10 m-2 flex items-center justify-between gap-3 rounded-md border border-monokai-yellow/40 bg-monokai-yellow/10 px-3 py-2 text-xs font-sans">
            <span className="text-monokai-yellow font-semibold">正在查看上次成功结果</span>
            <button
              type="button"
              onClick={onReturnToLatestResult}
              className="rounded-md border border-monokai-border bg-monokai-surface px-2.5 py-1 text-monokai-fg hover:border-monokai-cyan/50 hover:text-monokai-cyan cursor-pointer font-semibold"
            >
              返回当前结果
            </button>
          </div>
        )}

        {/* Dedicated Error View when query errors — Premium tier with hero visual */}
        {result?.error ? (
          <div className="p-6 max-w-4xl mx-auto space-y-4 font-mono select-text animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="relative p-4 rounded-xl bg-gradient-to-br from-monokai-pink/12 via-monokai-pink/8 to-monokai-bg/40 border border-monokai-pink/35 space-y-3 overflow-hidden shadow-[0_4px_24px_-12px_rgba(249,38,114,0.45)]">
              {/* Top accent gradient bar */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-monokai-pink/60 to-transparent" />

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 text-monokai-pink font-bold text-sm">
                  <div className="relative">
                    <div className="absolute inset-0 blur-md bg-monokai-pink/55 rounded-full animate-pulse" />
                    <div className="relative w-7 h-7 rounded-lg bg-monokai-pink/15 border border-monokai-pink/40 flex items-center justify-center">
                      <AlertCircle className="w-4 h-4 text-monokai-pink" strokeWidth={2.5} />
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <span className="block tracking-tight">SQL 执行异常</span>
                    <span className="block text-2xs font-normal text-monokai-comment/75 tracking-tight">Query Execution Error · DuckDB Runtime</span>
                  </div>
                </div>
                {parsedErrorInfo && (
                  <div className="flex items-center gap-1.5">
                    {parsedErrorInfo.lineNum && (
                      <span className="inline-flex items-center gap-1 text-2xs font-mono px-2 py-0.5 rounded-md bg-monokai-surface/85 border border-monokai-yellow/40 text-monokai-yellow font-bold shadow-[inset_0_0_0_1px_rgba(230,219,116,0.06)]">
                        <span className="text-monokai-comment/70">L</span>
                        {parsedErrorInfo.lineNum}
                      </span>
                    )}
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-2xs font-mono border font-bold tracking-tight ${parsedErrorInfo.badgeClass}`}>
                      {parsedErrorInfo.category}
                    </span>
                  </div>
                )}
              </div>
              <div className="p-3 rounded-lg bg-monokai-surface/90 border border-monokai-border text-monokai-fg text-xs whitespace-pre-wrap break-all leading-relaxed font-mono shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]">
                {result.error}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1 font-sans">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(result.error || '');
                    toastService.success('已复制错误日志至剪贴板');
                  }}
                  className="group flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border hover:border-monokai-border-strong text-monokai-fg text-xs transition-all duration-200 cursor-pointer font-semibold tracking-tight hover:shadow-[0_2px_6px_-2px_rgba(0,0,0,0.5)]"
                  title="将完整错误信息复制到剪贴板"
                >
                  <Copy className="w-3.5 h-3.5 text-monokai-comment group-hover:text-monokai-cyan transition-colors" />
                  <span>复制错误日志</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('workbench_switch_ai_panel', { detail: { tab: 'analyze' } }));
                  }}
                  className="group flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gradient-to-b from-monokai-amethyst/22 to-monokai-amethyst/12 hover:from-monokai-amethyst/32 hover:to-monokai-amethyst/18 border border-monokai-amethyst/45 text-monokai-amethyst text-xs font-bold transition-all duration-200 cursor-pointer shadow-[inset_0_0_0_1px_rgba(174,129,255,0.08),0_2px_6px_-2px_rgba(174,129,255,0.25)] hover:shadow-[inset_0_0_0_1px_rgba(174,129,255,0.14),0_4px_10px_-2px_rgba(174,129,255,0.35)] tracking-tight"
                  title="打开右侧 AI 助手诊断该错误并生成修正 SQL"
                >
                  <Sparkles className="w-3.5 h-3.5 text-monokai-amethyst group-hover:scale-110 transition-transform" />
                  <span>AI 智能修复建议</span>
                </button>

                {onToggleDataFlow && (
                  <button
                    type="button"
                    data-testid="result-dataflow-trace-cta"
                    onClick={() => {
                      onToggleDataFlow(true);
                      // 等分屏 Canvas 挂载后再溯源
                      window.setTimeout(() => {
                        dispatchDataflowTraceFault({
                          openInspector: true,
                          focusSql: true,
                        });
                      }, 80);
                      toastService.info('已在流程图中高亮异常算子并打开诊断详情 (Alt+D)');
                    }}
                    className="group flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gradient-to-b from-monokai-pink/22 to-monokai-pink/12 hover:from-monokai-pink/32 hover:to-monokai-pink/18 border border-monokai-pink/45 text-monokai-pink text-xs font-bold transition-all duration-200 cursor-pointer shadow-[inset_0_0_0_1px_rgba(249,38,114,0.08),0_2px_6px_-2px_rgba(249,38,114,0.25)] hover:shadow-[inset_0_0_0_1px_rgba(249,38,114,0.14),0_4px_10px_-2px_rgba(249,38,114,0.35)] tracking-tight"
                    title="在流程图与执行路径中定位异常算子并查看诊断原因 (Alt+D)"
                  >
                    <Workflow className="w-3.5 h-3.5 text-monokai-pink group-hover:scale-110 transition-transform" />
                    <span>在执行路径中定位异常算子</span>
                  </button>
                )}

                {previousResult && (
                  <button
                    onClick={() => onViewPreviousResult?.()}
                    className="group flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-monokai-elevated hover:bg-monokai-surface border border-monokai-border hover:border-monokai-border-strong text-monokai-fg text-xs transition-all duration-200 cursor-pointer font-semibold tracking-tight hover:shadow-[0_2px_6px_-2px_rgba(0,0,0,0.5)]"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-monokai-comment group-hover:-rotate-90 transition-transform duration-300" />
                    <span>查看上次成功查询结果 ({previousResult.totalRows || previousResult.rows?.length || 0} 行)</span>
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-monokai-bg/60 border border-monokai-border/60 text-meta text-monokai-comment font-sans leading-relaxed">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-monokai-cyan/15 border border-monokai-cyan/30 shrink-0">
                <Lightbulb className="w-3 h-3 text-monokai-cyan" />
              </span>
              <span>
                <strong className="text-monokai-fg-muted">常见排查建议：</strong>
                检查数据表或视图名称是否存在、字段拼写是否正确、<span className="font-mono text-monokai-yellow">GROUP BY</span> 字段完整性或日期字符串格式。
              </span>
            </div>
          </div>
        ) : !activeDataset && activeSubTab === 'data' ? (
          <div className="flex h-full min-h-[220px] flex-col items-center justify-center px-6 py-8 text-center font-sans">
            <div className="w-full max-w-md rounded-lg border border-dashed border-monokai-border/70 bg-monokai-surface/25 px-6 py-8">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-monokai-border/60 bg-monokai-elevated text-monokai-comment">
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-monokai-cyan" />
                ) : (
                  <TableIcon className="h-5 w-5" strokeWidth={1.75} />
                )}
              </div>

              <p className="mb-1 text-xs font-semibold text-monokai-fg-muted">
                {loading ? '正在执行查询…' : '等待执行查询'}
              </p>
              <p className="mx-auto max-w-sm text-meta leading-relaxed text-monokai-comment">
                {loading
                  ? '完成后结果会显示在此，期间可继续编辑 SQL。'
                  : '按 Ctrl+Enter 运行 SQL。结果可在上方切换数据、图表、透视与执行计划。'}
              </p>
            </div>
          </div>
        ) : activeSubTab === 'data' ? (
          <div className="result-data-grid inline-block align-middle font-sans text-xs" style={{ fontFamily: RESULT_TABLE_FONT }}>
            {/* Banner when query result is an EXPLAIN query in Data grid — Premium Tier */}
            {(result?.isExplain || columns.some(c => c.toLowerCase().includes('explain_'))) && (
              <div className="m-3 p-3 rounded-lg border border-monokai-yellow/45 bg-gradient-to-r from-monokai-yellow/12 via-monokai-yellow/8 to-monokai-yellow/12 flex items-center justify-between text-xs font-sans shadow-[inset_0_0_0_1px_rgba(230,219,116,0.06),0_2px_8px_-2px_rgba(230,219,116,0.18)] shrink-0 relative overflow-hidden">
                <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-monokai-yellow/55 via-monokai-yellow/85 to-monokai-yellow/55" />
                <div className="flex items-center gap-2.5 text-monokai-yellow pl-2">
                  <div className="relative shrink-0">
                    <div className="absolute inset-0 blur-md bg-monokai-yellow/40 rounded-full" />
                    <Activity className="relative w-4 h-4 text-monokai-yellow" strokeWidth={2.5} />
                  </div>
                  <span className="leading-relaxed">
                    当前显示的是 <strong className="text-monokai-fg-muted">EXPLAIN 物理执行计划结果表</strong>。推荐切换至顶部的 <strong className="text-monokai-fg-muted">「执行计划」</strong> 视图查看交互式拓扑图谱与算子火焰树。
                  </span>
                </div>
                <button
                  onClick={() => setActiveSubTab('explain')}
                  className="group ml-3 px-3 py-1.5 rounded-md bg-gradient-to-b from-monokai-yellow to-[#f0e878] hover:from-[#fff09b] hover:to-monokai-yellow text-monokai-bg font-bold text-xs flex items-center gap-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_2px_4px_-1px_rgba(230,219,116,0.35)] cursor-pointer transition-all duration-200 shrink-0 tracking-tight"
                >
                  <span>打开可视化执行计划</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            )}
            <table
              className={`border-collapse select-text ${tableLayoutMode === 'fill' ? 'w-full' : 'w-max'}`}
              style={{
                tableLayout: 'fixed',
                width: tableLayoutMode === 'fill' ? '100%' : autoTablePixelWidth,
                fontFamily: RESULT_TABLE_FONT,
              }}
            >
              <colgroup>
                <col style={{ width: '48px' }} />
                {columns.map(col => (
                  <col
                    key={col}
                    style={{
                      width: `${resolvedColWidths[col] || 120}px`,
                      minWidth: `${resolvedColWidths[col] || 120}px`,
                    }}
                  />
                ))}
              </colgroup>

              {/* Sticky header — soft surface wash (CSS overrides global olive #3e3d32) */}
              <thead className="sticky top-0 z-20 select-none">
                <tr className="h-11 border-b border-monokai-border/40">
                  <th className="w-12 px-2 py-1.5 text-center font-semibold text-monokai-comment/45 border-r border-monokai-border/30 sticky left-0 z-30" style={{ textAlign: 'center', fontFamily: RESULT_TABLE_FONT }}>
                    <span className="text-2xs uppercase tracking-[0.12em] font-sans">#</span>
                  </th>
                  {columns.map((col, colIdx) => {
                    const type = result?.columnTypeMap?.[col] || (result?.columnTypes ? result.columnTypes[colIdx] : undefined) || 'VARCHAR';
                    const isSelected = selectedColumn === col;
                    const isSorted = sortColumn === col;

                    return (
                      <th
                        key={col}
                        style={{
                          width: `${resolvedColWidths[col] || 120}px`,
                          minWidth: `${resolvedColWidths[col] || 120}px`,
                          fontFamily: RESULT_TABLE_FONT,
                          textAlign: 'center',
                        }}
                        onClick={() => handleHeaderClick(col)}
                        className={`relative px-2 py-1.5 border-r border-monokai-border/25 cursor-pointer transition-colors duration-150 group/th text-center font-sans overflow-hidden ${
                          isSelected
                            ? 'result-th-selected'
                            : ''
                        }`}
                      >
                        <div className="flex flex-col items-center justify-center gap-0.5 min-w-0 w-full leading-tight">
                          <div className="flex items-center justify-center gap-1 min-w-0 max-w-full">
                            <span
                              className={`font-medium text-meta tracking-tight transition-colors truncate max-w-full ${
                                isSelected ? 'text-monokai-fg font-semibold' : 'text-monokai-fg-muted/80 group-hover/th:text-monokai-fg'
                              }`}
                              title={col}
                            >
                              {col}
                            </span>
                            {isSorted && (
                              <span className="text-monokai-comment/80 text-3xs font-black shrink-0 animate-in fade-in zoom-in-95 duration-150 tabular-nums">
                                {sortDirection === 'asc' ? '▲' : '▼'}
                              </span>
                            )}
                          </div>
                          <span
                            className={`inline-flex items-center px-1.5 py-[1px] rounded border text-3xs font-mono tracking-wider uppercase max-w-full truncate transition-colors ${getTypeBadgeStyle(type)}`}
                            title={`列类型: ${type}`}
                          >
                            {type}
                          </span>
                        </div>

                        <div
                          onMouseDown={(e) => handleResizeStart(e, col)}
                          onDoubleClick={(e) => handleResetColWidth(e, col)}
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-monokai-fg/[0.04] active:bg-monokai-yellow/15 transition-all opacity-0 group-hover/th:opacity-100 z-10 flex items-center justify-center"
                          title="拖拽调整列宽，双击恢复最佳自适应"
                        >
                          <div className="w-px h-3 bg-monokai-border/60" />
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-monokai-border/35 bg-monokai-bg text-monokai-fg font-sans text-xs text-center" style={{ fontFamily: RESULT_TABLE_FONT }}>
                {displayedRows.length === 0 ? null : (
                  displayedRows.map((row: any, rIdx: number) => (
                    <tr
                      key={rIdx}
                      className="group hover:bg-gradient-to-r hover:from-monokai-elevated/55 hover:via-monokai-elevated/40 hover:to-monokai-elevated/25 even:bg-monokai-surface/12 transition-colors duration-100"
                    >
                      <td className="w-12 px-2 py-2 text-center text-monokai-comment/80 text-2xs tabular-nums border-r border-monokai-border/60 sticky left-0 bg-monokai-bg/95 group-hover:bg-monokai-elevated z-10 shadow-[1px_0_0_0_rgba(0,0,0,0.4)] font-semibold font-sans transition-colors backdrop-blur-xs" style={{ textAlign: 'center', fontFamily: RESULT_TABLE_FONT }}>
                        <span className="group-hover:text-monokai-fg-muted transition-colors">{startIndex + rIdx + 1}</span>
                      </td>
                      {columns.map((col, colIdx) => {
                        const val = row[col];
                        const colType = result?.columnTypeMap?.[col] || (result?.columnTypes ? result.columnTypes[colIdx] : undefined) || 'VARCHAR';
                        const isSelected = selectedColumn === col;
                        const tUpper = (colType || '').toUpperCase();
                        const isNumeric = ['INT', 'DECIMAL', 'FLOAT', 'DOUBLE', 'NUMERIC', 'REAL', 'BIGINT', 'HUGEINT', 'TINYINT', 'SMALLINT'].some(k => tUpper.includes(k));
                        const isTemporal = tUpper.includes('DATE') || tUpper.includes('TIME');
                        const isPlainString = typeof val === 'string';
                        const isJson = isPlainString && ((val.startsWith('{') && val.endsWith('}')) || (val.startsWith('[') && val.endsWith(']')));
                        const isExplain = isPlainString && (col.toLowerCase().includes('explain_') || val.includes('┌') || val.includes('PROJECTION'));
                        const isMultiline = isPlainString && val.includes('\n');
                        const isLongText = isPlainString && val.length > 80 && !isNumeric;
                        const isSpecialText = isExplain || isJson || isMultiline || isLongText;

                        let formattedVal: React.ReactNode = val;
                        if (isSpecialText) {
                          const cellKey = `${rIdx}-${col}`;
                          const isExpanded = Boolean(expandedCells[cellKey] ?? (isExplain ? expandedExplainRow : false));
                          const lineCount = isPlainString ? val.split('\n').length : 1;

                          // Badges & Labels
                          let badgeLabel = '文本';
                          let badgeColor = 'text-monokai-fg-muted';
                          if (isExplain) {
                            badgeLabel = '执行计划';
                            badgeColor = 'text-monokai-yellow';
                          } else if (isJson) {
                            badgeLabel = 'JSON';
                            badgeColor = 'text-monokai-cyan';
                          } else if (isMultiline) {
                            badgeLabel = '多行文本';
                            badgeColor = 'text-monokai-green';
                          }

                          let previewSnippet = '';
                          if (isJson) {
                            previewSnippet = val.slice(0, 36) + (val.length > 36 ? '...' : '');
                          } else {
                            const firstLine = String(val).split('\n').find((l: string) => l.trim().length > 0) || '';
                            previewSnippet = firstLine.slice(0, 32) + (firstLine.length > 32 || lineCount > 1 ? '...' : '');
                          }

                          formattedVal = (
                            <div className="flex flex-col items-center gap-1 py-0.5 w-full font-sans">
                              <div className="flex items-center justify-center gap-2 flex-wrap">
                                <div className="flex items-center justify-center gap-1.5 font-sans text-meta min-w-0">
                                  <Code2 className={`w-3.5 h-3.5 shrink-0 ${badgeColor}`} />
                                  <span className={`font-bold shrink-0 text-2xs ${badgeColor}`}>[{badgeLabel}]</span>
                                  {lineCount > 1 && (
                                    <span className="text-monokai-comment/80 text-2xs shrink-0">({lineCount} 行)</span>
                                  )}
                                  <span className="text-monokai-fg-muted truncate text-2xs text-center">
                                    {previewSnippet}
                                  </span>
                                </div>
                                <div className="flex items-center justify-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedCells(prev => ({ ...prev, [cellKey]: !isExpanded }));
                                      if (isExplain) setExpandedExplainRow(!isExpanded);
                                    }}
                                    className="px-1.5 py-0.5 rounded bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border text-2xs text-monokai-fg hover:text-monokai-cyan font-sans cursor-pointer transition-colors"
                                  >
                                    {isExpanded ? '收起' : '展开'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(String(val));
                                      toastService.success('已复制完整内容');
                                    }}
                                    className="p-1 rounded hover:bg-monokai-elevated text-monokai-comment hover:text-monokai-fg cursor-pointer transition-colors"
                                    title="复制全文"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                  {isExplain && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveSubTab('explain');
                                      }}
                                      className="px-1.5 py-0.5 rounded bg-monokai-yellow/20 hover:bg-monokai-yellow/30 text-2xs text-monokai-yellow font-sans cursor-pointer transition-colors"
                                    >
                                      拓扑图
                                    </button>
                                  )}
                                </div>
                              </div>
                              {isExpanded && (
                                <div className="mt-1.5 p-2.5 rounded-lg bg-monokai-sidebar border border-monokai-border font-sans text-meta text-monokai-fg leading-relaxed max-h-72 overflow-auto whitespace-pre custom-scrollbar select-text shadow-inner text-left">
                                  {isJson ? (() => {
                                    try {
                                      return JSON.stringify(JSON.parse(String(val)), null, 2);
                                    } catch {
                                      return String(val);
                                    }
                                  })() : String(val)}
                                </div>
                              )}
                            </div>
                          );
                        } else if (val === null || val === undefined) {
                          formattedVal = <span className="text-monokai-comment/55 italic font-sans text-meta tracking-wide">NULL</span>;
                        } else if (isTemporal) {
                          formattedVal = tUpper.includes('TIME') ? formatTimestamp(val) : formatDate(val);
                        } else if (typeof val === 'number') {
                          formattedVal = formatTableValue(val, col, {
                            unit: inferChartUnit(col), compact: false, thousandSeparator: true,
                            decimals: Number.isInteger(val) ? 0 : 2,
                          });
                        } else {
                          formattedVal = formatCellValue(val, colType);
                        }

                        return (
                          <td
                            key={col}
                            style={{
                              width: `${resolvedColWidths[col] || 120}px`,
                              minWidth: `${resolvedColWidths[col] || 120}px`,
                              fontFamily: RESULT_TABLE_FONT,
                              textAlign: 'center',
                            }}
                            onClick={() => onSelectColumn?.(col)}
                            onContextMenu={e => handleCellContextMenu(e, col, val)}
                            className={`px-3 py-2 border-r border-monokai-border/35 cursor-context-menu overflow-hidden transition-colors duration-100 text-center font-sans ${
                              isSpecialText
                                ? ''
                                : `truncate whitespace-nowrap ${isNumeric ? 'tabular-nums' : ''}`
                            } ${
                              isSelected
                                ? 'bg-monokai-yellow/12 text-monokai-yellow font-semibold'
                                : 'group-hover:bg-monokai-elevated/30'
                            }`}
                            title={typeof val === 'string' || typeof val === 'number' ? String(val) : undefined}
                          >
                            {col === 'status' ? (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-2xs font-semibold border ${
                                val === 'completed' ? 'bg-monokai-green/15 text-monokai-green border-monokai-green/35' :
                                val === 'pending' ? 'bg-monokai-yellow/15 text-monokai-yellow border-monokai-yellow/35' :
                                'bg-monokai-pink/15 text-monokai-pink border-monokai-pink/35'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  val === 'completed' ? 'bg-monokai-green' :
                                  val === 'pending' ? 'bg-monokai-yellow' : 'bg-monokai-pink'
                                } ${val === 'completed' ? 'shadow-[0_0_4px_rgba(166,226,46,0.55)]' : val === 'pending' ? 'shadow-[0_0_4px_rgba(230,219,116,0.55)]' : 'shadow-[0_0_4px_rgba(249,38,114,0.55)]'}`} />
                                {String(val)}
                              </span>
                            ) : (
                              formattedVal
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : null}

        {/* Dynamic Chart View — MECE: 意图 → 形态 → 编码 → 计算/范围/呈现 */}
        {activeSubTab === 'chart' && (
          <div className="h-full flex flex-col overflow-auto bg-monokai-bg">
            <div className="shrink-0 border-b border-monokai-border bg-gradient-to-b from-monokai-surface/95 via-monokai-surface/85 to-monokai-surface/70 relative z-10 font-sans">
              <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-monokai-cyan/20 to-transparent" />

              {/* 1. 意图 (Family) + 形态 (Variant) — mutually exclusive, collectively exhaustive */}
              <div className="flex h-10 items-center justify-between gap-3 px-3">
                <div className="flex items-center gap-2 min-w-0 overflow-x-auto scrollbar-hide">
                  <SegmentedTabs<ChartFamily>
                    aria-label="分析意图"
                    value={chartFamily}
                    items={CHART_FAMILY_ITEMS.map(({ value, label, icon }) => ({ value, label, icon }))}
                    onChange={handleChartFamilyChange}
                    size="sm"
                    tone="cyan"
                  />
                  <div className="h-4 w-px bg-monokai-border/60 shrink-0" />
                  <div
                    role="tablist"
                    aria-label="图表形态"
                    className="flex items-center gap-0.5 p-0.5 rounded-lg bg-gradient-to-b from-monokai-bg/75 to-monokai-bg/45 border border-monokai-border/75 shrink-0"
                  >
                    {chartVariants.map(item => {
                      const Icon = item.icon;
                      const active = chartType === item.value;
                      return (
                        <button
                          key={item.value}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          title={item.hint}
                          onClick={() => handleChartTypeChange(item.value)}
                          className={`group flex items-center gap-1 h-7 px-2 rounded-md text-meta font-semibold tracking-tight cursor-pointer transition-all duration-150 border ${
                            active
                              ? 'bg-gradient-to-b from-monokai-cyan/22 to-monokai-cyan/10 text-monokai-cyan border-monokai-cyan/45'
                              : 'text-monokai-comment/85 border-transparent hover:bg-monokai-elevated/70 hover:text-monokai-fg'
                          }`}
                        >
                          <Icon className={`w-3 h-3 ${active ? 'text-monokai-cyan' : ''}`} />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    title="将当前图表保存并加入分析首页看板"
                    onClick={async () => {
                      const sqlText = (activeTabSql || '').trim();
                      if (!sqlText) {
                        toastService.warning('当前没有可保存的 SQL');
                        return;
                      }
                      if (!chartXAxis || !chartYAxis) {
                        toastService.warning('请先选择图表的 X / Y 字段');
                        return;
                      }
                      const chartConfig: ChartConfig = {
                        ...resultChartConfig, id: `wb-chart-${Date.now()}`, source: 'manual',
                      };
                      try {
                        await createWidgetFromSql({
                          name: chartConfig.title,
                          sql: sqlText,
                          widgetType: 'chart',
                          chartConfig,
                          rowCount: rawRows.length,
                          columns,
                          addToBoard: true,
                        });
                        useAppStore.getState().bumpDashboardRefresh();
                        toastService.success('已加入分析首页看板');
                      } catch (e: any) {
                        toastService.error(e?.message || '加入看板失败');
                      }
                    }}
                    className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-monokai-accent/40 bg-monokai-accent/10 text-monokai-accent text-2xs font-semibold hover:bg-monokai-accent/20 cursor-pointer transition-colors"
                  >
                    <LayoutDashboard className="w-3 h-3" />
                    加入看板
                  </button>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gradient-to-b from-monokai-bg/85 to-monokai-bg/65 border border-monokai-border/75 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-monokai-cyan shadow-[0_0_8px_rgba(102,217,239,0.85)] animate-pulse" aria-hidden />
                    <span className="text-2xs text-monokai-comment/65">实时</span>
                    <span className="font-bold tabular-nums text-monokai-cyan text-2xs">{rawRows.length.toLocaleString()}</span>
                    <span className="text-2xs text-monokai-comment/65">行</span>
                  </div>
                </div>
              </div>

              {/* 2. 编码 (Encoding) — field mapping only */}
              <div className="flex min-h-9 py-1 flex-wrap items-center gap-2 px-3 border-t border-monokai-border/60 text-xs overflow-visible relative z-30">
                <span className="text-3xs font-bold uppercase tracking-[0.14em] text-monokai-comment/70 shrink-0 w-8">编码</span>
                <label className="flex items-center gap-1.5 shrink-0">
                  <span className="text-2xs font-semibold uppercase tracking-[0.1em] text-monokai-comment">
                    {chartType === 'scatter' ? 'X 数值' : isCircularChart(chartType) ? '分类' : 'X 维度'}
                  </span>
                  <div className="relative w-36">
                    <select
                      aria-label="X 字段"
                      value={chartXAxis}
                      onChange={e => setChartXAxis(e.target.value)}
                      className={`${WORKBENCH_SELECT_CLASS} text-monokai-cyan`}
                    >
                      {columns.map(col => <option key={col} value={col}>{col}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-monokai-comment/70" />
                  </div>
                </label>
                <button
                  type="button"
                  onClick={handleSwapChartAxes}
                  title="互换字段"
                  className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-monokai-border/70 bg-monokai-bg/60 text-monokai-comment hover:text-monokai-cyan hover:border-monokai-cyan/40 cursor-pointer transition-colors shrink-0"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                </button>
                <label className="flex items-center gap-1.5 shrink-0">
                  <span className="text-2xs font-semibold uppercase tracking-[0.1em] text-monokai-comment">
                    {chartType === 'scatter' ? 'Y 数值' : 'Y 指标'}
                  </span>
                  <div className="relative w-36">
                    <select
                      aria-label="Y 字段"
                      value={chartYAxis}
                      onChange={e => setChartYAxis(e.target.value)}
                      className={`${WORKBENCH_SELECT_CLASS} text-monokai-green`}
                    >
                      {columns.map(col => <option key={col} value={col}>{col}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-monokai-comment/70" />
                  </div>
                </label>
                {usesSeriesEncoding(chartType) && (
                  <label className="flex items-center gap-1.5 shrink-0">
                    <span className="text-2xs font-semibold uppercase tracking-[0.1em] text-monokai-comment">系列</span>
                    <div className="relative w-36">
                      <select
                        aria-label="系列拆分字段"
                        value={chartSeries}
                        onChange={e => setChartSeries(e.target.value)}
                        className={`${WORKBENCH_SELECT_CLASS} ${chartSeriesActive ? 'text-monokai-yellow' : 'text-monokai-fg'}`}
                      >
                        <option value={CHART_SERIES_NONE}>无拆分</option>
                        {columns
                          .filter(col => col !== chartXAxis && col !== chartYAxis)
                          .map(col => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-monokai-comment/70" />
                    </div>
                  </label>
                )}
              </div>

              {/* 3. 计算 | 范围 | 呈现 — three MECE control domains */}
              <div className="flex h-9 items-center gap-2 px-3 border-t border-monokai-border/60 text-xs overflow-x-auto scrollbar-hide">
                {usesAggregation(chartType) && (
                  <>
                    <span className="text-3xs font-bold uppercase tracking-[0.14em] text-monokai-comment/70 shrink-0">计算</span>
                    <SegmentedTabs<ChartAgg>
                      aria-label="聚合方式"
                      value={chartAgg}
                      items={[...CHART_AGG_ITEMS]}
                      onChange={setChartAgg}
                      size="sm"
                      tone="green"
                    />
                    {usesValueMode(chartType) && (
                      <div
                        role="tablist"
                        aria-label="数值模式"
                        className="flex items-center gap-0.5 p-0.5 rounded-lg border border-monokai-border/70 bg-monokai-bg/50 shrink-0"
                      >
                        {([
                          { value: 'absolute' as const, label: '绝对值' },
                          { value: 'percent' as const, label: '%' },
                        ]).map(item => (
                          <button
                            key={item.value}
                            type="button"
                            role="tab"
                            aria-selected={chartValueMode === item.value}
                            title={item.value === 'percent' ? (chartSeriesActive ? '类目内占比' : '整体占比') : '原始聚合值'}
                            onClick={() => setChartValueMode(item.value)}
                            className={`h-6 px-1.5 rounded text-2xs font-semibold cursor-pointer transition-colors ${
                              chartValueMode === item.value
                                ? 'bg-monokai-green/15 text-monokai-green'
                                : 'text-monokai-comment hover:text-monokai-fg'
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="h-4 w-px bg-monokai-border/60 shrink-0" />
                  </>
                )}

                <span className="text-3xs font-bold uppercase tracking-[0.14em] text-monokai-comment/70 shrink-0">范围</span>
                <label className="flex items-center gap-1 shrink-0">
                  <span className="text-2xs text-monokai-comment">{chartType === 'scatter' ? '点数' : 'Top'}</span>
                  <div className="relative w-16">
                    <select
                      aria-label="显示数量"
                      value={chartTopN}
                      onChange={e => setChartTopN(Number(e.target.value) as (typeof CHART_TOP_N_OPTIONS)[number])}
                      className={WORKBENCH_SELECT_CLASS}
                    >
                      {CHART_TOP_N_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-monokai-comment/70" />
                  </div>
                </label>
                {usesCategorySort(chartType) && (
                  <div
                    role="tablist"
                    aria-label="排序"
                    className="flex items-center gap-0.5 p-0.5 rounded-lg border border-monokai-border/70 bg-monokai-bg/50 shrink-0"
                  >
                    {CHART_SORT_ITEMS.map(item => {
                      const active = chartSort === item.value;
                      return (
                        <button
                          key={item.value}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          title={item.hint}
                          onClick={() => setChartSort(item.value)}
                          className={`h-6 px-1.5 rounded text-2xs font-semibold cursor-pointer transition-colors ${
                            active
                              ? 'bg-monokai-yellow/15 text-monokai-yellow'
                              : 'text-monokai-comment hover:text-monokai-fg'
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="h-4 w-px bg-monokai-border/60 shrink-0" />
                <span className="text-3xs font-bold uppercase tracking-[0.14em] text-monokai-comment/70 shrink-0">呈现</span>
                <div className="flex items-center gap-0.5 p-0.5 rounded-lg border border-monokai-border/70 bg-monokai-bg/50 shrink-0">
                  {([
                    { value: 'right' as const, label: '图例右' },
                    { value: 'bottom' as const, label: '图例下' },
                    { value: 'hidden' as const, label: '隐藏' },
                  ]).map(item => (
                    <button
                      key={item.value}
                      type="button"
                      title={item.label}
                      onClick={() => setChartLegend(item.value)}
                      className={`h-6 px-1.5 rounded text-2xs font-semibold cursor-pointer transition-colors ${
                        chartLegend === item.value
                          ? 'bg-monokai-cyan/15 text-monokai-cyan'
                          : 'text-monokai-comment hover:text-monokai-fg'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  title={chartColorMode === 'categorical' ? '当前：分类配色' : '当前：单色'}
                  onClick={() => setChartColorMode(m => (m === 'categorical' ? 'mono' : 'categorical'))}
                  className={`h-7 px-2 rounded-md border text-2xs font-semibold cursor-pointer transition-colors shrink-0 ${
                    chartColorMode === 'categorical'
                      ? 'border-monokai-border/70 bg-monokai-bg/60 text-monokai-fg'
                      : 'border-monokai-cyan/40 bg-monokai-cyan/10 text-monokai-cyan'
                  }`}
                >
                  {chartColorMode === 'categorical' ? '多色' : '单色'}
                </button>
                {(chartType === 'bar' || chartType === 'column' || isCircularChart(chartType)) && (
                  <button
                    type="button"
                    title={chartShowLabels ? '隐藏数值标签' : '显示数值标签'}
                    onClick={() => setChartShowLabels(v => !v)}
                    className={`h-7 px-2 inline-flex items-center gap-1 rounded-md border text-2xs font-semibold cursor-pointer transition-colors shrink-0 ${
                      chartShowLabels
                        ? 'border-monokai-green/40 bg-monokai-green/10 text-monokai-green'
                        : 'border-monokai-border/70 bg-monokai-bg/60 text-monokai-comment hover:text-monokai-fg'
                    }`}
                  >
                    {chartShowLabels ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    标签
                  </button>
                )}
                <button
                  type="button"
                  title="导出 PNG"
                  onClick={handleExportChartPng}
                  disabled={rawRows.length === 0}
                  className="h-7 px-2 inline-flex items-center gap-1 rounded-md border border-monokai-border/70 bg-monokai-bg/60 text-2xs font-semibold text-monokai-comment hover:text-monokai-cyan hover:border-monokai-cyan/40 cursor-pointer transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Download className="w-3 h-3" />
                  导出
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-[360px] shrink-0 w-full relative p-3">
              {rawRows.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2.5 rounded-lg border border-dashed border-monokai-border/70 bg-monokai-bg/40 text-xs font-sans">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-monokai-border/80 bg-monokai-surface/80">
                    <BarChart2 className="w-4.5 h-4.5 text-monokai-cyan/80" strokeWidth={1.75} />
                  </div>
                  <div className="text-center space-y-0.5">
                    <span className="block text-xs font-semibold tracking-tight text-monokai-fg-muted">暂无可可视化的数据行</span>
                    <span className="block text-2xs text-monokai-comment/75">执行 SQL 查询后将自动生成图表</span>
                  </div>
                </div>
              ) : (
                <div ref={chartHostRef} id="sql-result-chart" data-chart-viewport className="h-full min-h-0">
                  <ChartRenderer chartSpec={resultChartSpec} hideTitle />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dynamic Pivot View — MECE: 配置 / 结果 / 动作 */}
        {activeSubTab === 'pivot' && (
          <div className="h-full flex flex-col overflow-hidden bg-monokai-bg font-sans" style={{ fontFamily: RESULT_TABLE_FONT }}>
            <div className="result-pivot-toolbar shrink-0 border-b border-monokai-border bg-gradient-to-b from-monokai-surface/95 via-monokai-surface/85 to-monokai-surface/70 relative z-30 overflow-visible">
              <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-monokai-cyan/20 to-transparent" />

              <div className="flex h-10 items-center justify-between gap-3 px-3">
                <div className="flex items-center gap-2 min-w-0">
                  <TableProperties className="w-4 h-4 text-monokai-cyan shrink-0" />
                  <span className="font-bold text-sm text-monokai-fg tracking-tight truncate">多维透视表</span>
                  <span className="hidden sm:inline text-2xs text-monokai-comment/70 truncate">当前结果集即时交叉表（非分组 SQL 编排）</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gradient-to-b from-monokai-bg/85 to-monokai-bg/65 border border-monokai-border/75 text-2xs">
                    <span className="text-monokai-comment/65">样本</span>
                    <span className="font-bold tabular-nums text-monokai-cyan">{rawRows.length.toLocaleString()}</span>
                    <span className="text-monokai-comment/50">·</span>
                    <span className="font-bold tabular-nums text-monokai-fg">
                      {dynamicPivotMatrix ? `${dynamicPivotMatrix.totalRowKeys}×${dynamicPivotMatrix.totalColKeys}` : '—'}
                    </span>
                    <span className="text-monokai-comment/65">维</span>
                    <span className="text-monokai-comment/50">·</span>
                    <span className="font-bold text-monokai-green">{effectivePivotAgg.toUpperCase()}({pivotValCol || '行数'})</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyPivotMatrix}
                    className="h-7 px-2 rounded-md border border-monokai-border/70 bg-monokai-bg/60 text-monokai-comment hover:text-monokai-cyan hover:border-monokai-cyan/40 text-meta font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                    title="复制矩阵为 TSV"
                  >
                    <Copy className="w-3 h-3" />
                    <span className="hidden md:inline">复制</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleGeneratePivotSql}
                    className="h-7 px-2 rounded-md border border-monokai-green/40 bg-monokai-green/10 text-monokai-green hover:bg-monokai-green/18 text-meta font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                    title="生成透视 SQL 并打开新标签"
                  >
                    <Code2 className="w-3 h-3" />
                    <span className="hidden md:inline">生成 SQL</span>
                  </button>
                </div>
              </div>

              <div className="flex h-9 items-center gap-2 px-3 border-t border-monokai-border/60 text-xs overflow-x-auto scrollbar-hide">
                <label className="flex items-center gap-1.5 shrink-0">
                  <span className="text-2xs font-semibold uppercase tracking-[0.12em] text-monokai-comment">行维度</span>
                  <div className="relative w-36">
                    <select
                      aria-label="行维度"
                      value={pivotRowCol}
                      onChange={e => setPivotRowCol(e.target.value)}
                      className={`${WORKBENCH_SELECT_CLASS} text-monokai-cyan`}
                      style={{ fontFamily: RESULT_TABLE_FONT }}
                    >
                      <option value="">(无)</option>
                      {columns.map(col => <option key={col} value={col}>{col}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-monokai-comment/70" />
                  </div>
                </label>

                <button
                  type="button"
                  onClick={handleSwapPivotAxes}
                  title="互换行 / 列维度"
                  className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-monokai-border/70 bg-monokai-bg/60 text-monokai-comment hover:text-monokai-cyan hover:border-monokai-cyan/40 hover:bg-monokai-cyan/10 cursor-pointer transition-colors shrink-0"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                </button>

                <label className="flex items-center gap-1.5 shrink-0">
                  <span className="text-2xs font-semibold uppercase tracking-[0.12em] text-monokai-comment">列维度</span>
                  <div className="relative w-36">
                    <select
                      aria-label="列维度"
                      value={pivotColCol}
                      onChange={e => setPivotColCol(e.target.value)}
                      className={`${WORKBENCH_SELECT_CLASS} text-monokai-cyan`}
                      style={{ fontFamily: RESULT_TABLE_FONT }}
                    >
                      <option value="">(无)</option>
                      {columns.map(col => <option key={col} value={col}>{col}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-monokai-comment/70" />
                  </div>
                </label>

                {pivotRowCol && pivotColCol && pivotRowCol === pivotColCol && (
                  <span className="text-2xs text-monokai-yellow/85 shrink-0 px-1.5 py-0.5 rounded border border-monokai-yellow/35 bg-monokai-yellow/10">
                    与行相同，按单维汇总
                  </span>
                )}

                <div className="h-4 w-px bg-monokai-border/60 shrink-0" />

                {/* 值字段选择器 */}
                <label className="flex items-center gap-1.5 shrink-0">
                  <span className="text-2xs font-semibold uppercase tracking-[0.12em] text-monokai-comment">值</span>
                  <div className="relative w-32">
                    <select
                      aria-label="值字段"
                      value={pivotValCol}
                      onChange={e => {
                        const nextCol = e.target.value;
                        setPivotValCol(nextCol);
                        if (!nextCol) {
                          setPivotAgg('count');
                        } else {
                          const isNum = (result?.columnTypeMap?.[nextCol] || '').toUpperCase().match(/INT|DECIMAL|FLOAT|DOUBLE|NUMERIC/);
                          if (isNum && pivotAgg === 'count') {
                            setPivotAgg('sum');
                          } else if (!isNum && ['sum', 'avg', 'median'].includes(pivotAgg)) {
                            setPivotAgg('count');
                            toastService.info('已自动切换为「计数」统计（非数值列适合计数或去重）');
                          }
                        }
                      }}
                      className={`${WORKBENCH_SELECT_CLASS} text-monokai-green font-semibold`}
                      style={{ fontFamily: RESULT_TABLE_FONT }}
                    >
                      <option value="">(无)</option>
                      {columns.map(col => <option key={col} value={col}>{col}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-monokai-comment/70" />
                  </div>
                </label>

                {/* 聚合计算方式选择器（协调一致的精准下拉） */}
                <label className="flex items-center gap-1.5 shrink-0">
                  <span className="text-2xs font-semibold uppercase tracking-[0.12em] text-monokai-comment">聚合</span>
                  <div className="relative w-28" ref={aggMenuRef}>
                    <button
                      type="button"
                      onClick={handleToggleAggMenu}
                      data-testid="pivot-agg-pill"
                      aria-label="聚合计算类型"
                      aria-expanded={isAggMenuOpen}
                      className={`${WORKBENCH_SELECT_CLASS} flex items-center justify-between text-monokai-green font-semibold text-xs transition-all duration-150 ${
                        isAggMenuOpen ? 'border-monokai-green/60 ring-1 ring-monokai-green/25 bg-monokai-bg' : ''
                      }`}
                      style={{ fontFamily: RESULT_TABLE_FONT }}
                      title="选择透视聚合统计方式"
                    >
                      <span className="truncate">
                        {PIVOT_AGG_OPTIONS.find(a => a.value === pivotAgg)?.label || pivotAgg.toUpperCase()}
                      </span>
                      <ChevronDown className={`w-3 h-3 text-monokai-comment/70 shrink-0 transition-transform ${isAggMenuOpen ? 'rotate-180 text-monokai-green' : ''}`} />
                    </button>

                    {/* 灵动轻巧的聚合选项 Menu Portal — 绝对置顶，绝不被裁切或遮挡 */}
                    {isAggMenuOpen && typeof document !== 'undefined' && createPortal(
                      <div
                        id="pivot-measure-studio-portal"
                        data-testid="pivot-measure-studio-portal"
                        style={{
                          position: 'fixed',
                          top: aggMenuPos.top,
                          left: aggMenuPos.left,
                          zIndex: 9999,
                        }}
                        className="w-52 rounded-lg border border-monokai-border/90 bg-monokai-surface/98 backdrop-blur-xl shadow-2xl p-1 animate-in fade-in zoom-in-95 duration-100 font-sans text-xs select-none"
                      >
                        {[
                          { groupTitle: '常用统计', items: PIVOT_AGG_OPTIONS.filter(o => ['sum', 'avg', 'median'].includes(o.value)) },
                          { groupTitle: '计数与去重', items: PIVOT_AGG_OPTIONS.filter(o => ['count_distinct', 'count'].includes(o.value)) },
                          { groupTitle: '极值范围', items: PIVOT_AGG_OPTIONS.filter(o => ['max', 'min'].includes(o.value)) },
                        ].map((grp, gIdx) => (
                          <div key={grp.groupTitle}>
                            {gIdx > 0 && <div className="my-1 border-t border-monokai-border/40" />}
                            <div className="px-2 py-0.5 text-[10px] font-mono text-monokai-comment/60 uppercase tracking-wider">
                              {grp.groupTitle}
                            </div>
                            {grp.items.map(opt => {
                              const isSelected = opt.value === pivotAgg;
                              const isWarning = opt.numericOnly && !isSelectedValNumeric && Boolean(pivotValCol);
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  data-agg-key={opt.value}
                                  onClick={() => {
                                    setPivotAgg(opt.value);
                                    setIsAggMenuOpen(false);
                                    if (isWarning) {
                                      toastService.warning(`${opt.label}主要针对数值列计算`);
                                    }
                                  }}
                                  className={`w-full h-7 px-2 rounded flex items-center justify-between text-left cursor-pointer transition-colors ${
                                    isSelected
                                      ? 'bg-monokai-green/15 text-monokai-green font-semibold'
                                      : 'text-monokai-fg hover:bg-monokai-elevated hover:text-monokai-fg'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-xs truncate">{opt.label}</span>
                                    <span className="text-[9px] font-mono text-monokai-comment/70">({opt.enLabel})</span>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {isWarning && (
                                      <span className="text-[9px] text-monokai-yellow/80">需数值</span>
                                    )}
                                    {isSelected && <Check className="w-3.5 h-3.5 text-monokai-green stroke-[2.5]" />}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>,
                      document.body
                    )}
                  </div>
                </label>

                <div className="h-4 w-px bg-monokai-border/60 shrink-0" />

                {/* 计算口径 / 显示方式 (Show Values As) — 协调标准的 Select 下拉 */}
                <label className="flex items-center gap-1.5 shrink-0">
                  <span className="text-2xs font-semibold uppercase tracking-[0.12em] text-monokai-comment">口径</span>
                  <div className="relative w-28">
                    <select
                      aria-label="计算口径"
                      data-testid="pivot-show-as-select"
                      value={pivotShowAs}
                      onChange={e => setPivotShowAs(e.target.value as PivotShowAs)}
                      className={`${WORKBENCH_SELECT_CLASS} text-monokai-cyan font-medium text-xs`}
                      style={{ fontFamily: RESULT_TABLE_FONT }}
                      title="切换数值计算口径（支持原始绝对值、全局总计占比、行占比与列占比）"
                    >
                      {PIVOT_SHOW_AS_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-monokai-comment/70" />
                  </div>
                </label>

                {/* 小数位调节器 */}
                <button
                  type="button"
                  onClick={() => {
                    const next = pivotDecimals === 0 ? 1 : pivotDecimals === 1 ? 2 : pivotDecimals === 2 ? 4 : 0;
                    setPivotDecimals(next);
                  }}
                  className="h-8 px-2.5 inline-flex items-center gap-1 rounded-md border border-monokai-border/80 bg-monokai-bg/70 hover:bg-monokai-elevated text-xs font-mono text-monokai-comment hover:text-monokai-fg cursor-pointer transition-all duration-150 shrink-0"
                  title="切换小数位数（.0 / .1 / .2 / .4）"
                >
                  <span className="text-monokai-yellow font-bold">.{pivotDecimals}</span>
                  <span className="text-2xs text-monokai-comment/80">小数</span>
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-monokai-bg font-sans" style={{ fontFamily: RESULT_TABLE_FONT }}>
              {rawRows.length === 0 ? (
                <div className="flex h-full min-h-[220px] flex-col items-center justify-center px-6 py-8 text-center font-sans">
                  <div className="w-full max-w-md rounded-lg border border-dashed border-monokai-border/70 bg-monokai-surface/25 px-6 py-8">
                    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-monokai-border/60 bg-monokai-elevated text-monokai-comment">
                      <TableProperties className="h-5 w-5 text-monokai-cyan" strokeWidth={1.75} />
                    </div>
                    <p className="mb-1 text-xs font-semibold text-monokai-fg-muted">当前无查询结果集</p>
                    <p className="mx-auto max-w-sm text-meta leading-relaxed text-monokai-comment">请先在上方编辑器执行 SQL 查询后再进行多维交叉透视。</p>
                  </div>
                </div>
              ) : !dynamicPivotMatrix || dynamicPivotMatrix.rowKeys.length === 0 ? (
                <div className="flex h-full min-h-[220px] flex-col items-center justify-center px-6 py-8 text-center font-sans">
                  <div className="w-full max-w-md rounded-lg border border-dashed border-monokai-border/70 bg-monokai-surface/25 px-6 py-8">
                    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-monokai-border/60 bg-monokai-elevated text-monokai-comment">
                      <TableProperties className="h-5 w-5 text-monokai-yellow" strokeWidth={1.75} />
                    </div>
                    <p className="mb-1 text-xs font-semibold text-monokai-fg-muted">所选维度暂无有效键值</p>
                    <p className="mx-auto max-w-sm text-meta leading-relaxed text-monokai-comment">请调整行、列或值度量字段以生成多维透视矩阵。</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-h-0 flex flex-col w-full h-full">
                  {(dynamicPivotMatrix.truncatedRows || dynamicPivotMatrix.truncatedCols) && (
                    <div className="result-pivot-truncate m-2.5 flex items-center gap-2 px-3 py-1.5 rounded-lg border border-monokai-yellow/40 bg-monokai-yellow/10 text-meta text-monokai-yellow font-sans shrink-0">
                      <Info className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        已截断展示：行键 {dynamicPivotMatrix.rowKeys.length}/{dynamicPivotMatrix.totalRowKeys}
                        ，列键 {dynamicPivotMatrix.colKeys.length}/{dynamicPivotMatrix.totalColKeys}
                        （上限 {PIVOT_MAX_ROW_KEYS}×{PIVOT_MAX_COL_KEYS}）。完整导出请使用右上角「生成 SQL」。
                      </span>
                    </div>
                  )}

                  <div className="result-pivot-grid flex-1 min-h-0 overflow-auto custom-scrollbar rounded-lg border border-monokai-border/70 bg-monokai-elevated/40 p-1" style={{ fontFamily: RESULT_TABLE_FONT }}>
                    <table
                      className="border-collapse select-text"
                      style={{
                        tableLayout: 'fixed',
                        width: pivotColWidths.table,
                        fontFamily: RESULT_TABLE_FONT,
                      }}
                    >
                      <colgroup>
                        <col style={{ width: `${pivotColWidths.corner}px`, minWidth: `${pivotColWidths.corner}px` }} />
                        {dynamicPivotMatrix.colKeys.map(cKey => (
                          <col
                            key={cKey}
                            style={{
                              width: `${pivotColWidths.cols[cKey] || 96}px`,
                              minWidth: `${pivotColWidths.cols[cKey] || 96}px`,
                            }}
                          />
                        ))}
                        <col style={{ width: `${pivotColWidths.total}px`, minWidth: `${pivotColWidths.total}px` }} />
                      </colgroup>
                      <thead className="bg-monokai-surface text-monokai-fg text-xs sticky top-0 z-20 select-none">
                        <tr className="h-11 border-b border-monokai-border/40">
                          <th
                            className="p-2 border border-monokai-border font-bold text-center whitespace-nowrap font-sans"
                            style={{ textAlign: 'center', fontFamily: RESULT_TABLE_FONT }}
                          >
                            <div className="flex flex-col items-center gap-0.5 leading-tight">
                              <span>{pivotRowCol || '全部'} \ {pivotColCol || '汇总'}</span>
                              <span className="text-3xs font-semibold text-monokai-green tracking-wide">
                                {effectivePivotAgg.toUpperCase()}({pivotValCol || '行数'})
                              </span>
                            </div>
                          </th>
                          {dynamicPivotMatrix.colKeys.map(cKey => (
                            <th
                              key={cKey}
                              className="p-2 border border-monokai-border font-semibold text-center whitespace-nowrap font-sans"
                              style={{ textAlign: 'center', fontFamily: RESULT_TABLE_FONT }}
                            >
                              {cKey}
                            </th>
                          ))}
                          <th
                            className="p-2 border border-monokai-border text-monokai-green font-bold text-center whitespace-nowrap font-sans"
                            style={{ textAlign: 'center', fontFamily: RESULT_TABLE_FONT }}
                          >
                            总计
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-monokai-border text-monokai-fg-muted font-sans text-xs" style={{ fontFamily: RESULT_TABLE_FONT }}>
                        {dynamicPivotMatrix.rowKeys.map(rKey => (
                          <tr key={rKey} className="hover:bg-monokai-surface/60 transition-colors">
                            <td
                              className="p-2 border border-monokai-border font-semibold text-monokai-fg text-center whitespace-nowrap"
                              style={{ textAlign: 'center', fontFamily: RESULT_TABLE_FONT }}
                            >
                              {rKey}
                            </td>
                            {dynamicPivotMatrix.colKeys.map(cKey => {
                              const val = dynamicPivotMatrix.matrix[rKey]?.[cKey];
                              return (
                                <td
                                  key={cKey}
                                  className="p-2 border border-monokai-border text-center tabular-nums whitespace-nowrap font-sans"
                                  style={{ textAlign: 'center', fontFamily: RESULT_TABLE_FONT }}
                                >
                                  {formatPivotNumber(val ?? null)}
                                </td>
                              );
                            })}
                            <td
                              className="p-2 border border-monokai-border text-monokai-green font-semibold text-center tabular-nums whitespace-nowrap font-sans"
                              style={{ textAlign: 'center', fontFamily: RESULT_TABLE_FONT }}
                            >
                              {formatPivotNumber(dynamicPivotMatrix.rowTotals[rKey] ?? null)}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-monokai-surface font-bold text-monokai-fg">
                          <td
                            className="p-2 border border-monokai-border text-center whitespace-nowrap font-sans"
                            style={{ textAlign: 'center', fontFamily: RESULT_TABLE_FONT }}
                          >
                            总计
                          </td>
                          {dynamicPivotMatrix.colKeys.map(cKey => (
                            <td
                              key={cKey}
                              className="p-2 border border-monokai-border text-monokai-green text-center tabular-nums whitespace-nowrap font-sans"
                              style={{ textAlign: 'center', fontFamily: RESULT_TABLE_FONT }}
                            >
                              {formatPivotNumber(dynamicPivotMatrix.colTotals[cKey] ?? null)}
                            </td>
                          ))}
                          <td
                            className="p-2 border border-monokai-border text-monokai-yellow font-bold text-center tabular-nums whitespace-nowrap font-sans"
                            style={{ textAlign: 'center', fontFamily: RESULT_TABLE_FONT }}
                          >
                            {formatPivotNumber(dynamicPivotMatrix.grandTotal)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Explain plan — must fill remaining height (parent is flex column + overflow hidden) */}
        {activeSubTab === 'explain' && (
          <div className="flex-1 min-h-0 w-full overflow-hidden flex flex-col">
            <ExecutionPlanView
              planText={liveExplainPlan}
              jsonPlan={liveExplainJson}
              loading={loadingExplain}
              totalRows={rawRows.length}
              executionTime={explainPlanMs ?? 0}
              activeSql={activeTabSql}
              planSourceSql={planSourceSql}
              planFetchedAt={planFetchedAt}
              analyzeMode={explainAnalyzeMode}
              onAnalyzeModeChange={(analyze) => {
                // Force refetch for the other mode
                planMetaRef.current = { sql: '', analyze: false };
                setExplainAnalyzeMode(analyze);
              }}
              onSendToAi={(context) => {
                window.dispatchEvent(
                  new CustomEvent('workbench_switch_ai_panel', {
                    detail: { tab: 'analyze', planFocus: context },
                  })
                );
              }}
              onRefreshExplain={() => {
                const sql = normalizeSqlForExplain(activeTabSql);
                if (!sql) {
                  toastService.warning('当前无待分析的 SQL 查询');
                  return;
                }
                planMetaRef.current = { sql: '', analyze: false };
                const gen = ++explainFetchGenRef.current;
                const startedAt = performance.now();
                setLoadingExplain(true);
                duckDBService.getStructuredExplainPlan(sql, explainAnalyzeMode)
                  .then(res => {
                    if (gen !== explainFetchGenRef.current) return;
                    const text = res.planText || '';
                    setLiveExplainPlan(text);
                    setLiveExplainJson(res.jsonPlan || null);
                    setPlanSourceSql(sql);
                    setPlanFetchedAt(Date.now());
                    setExplainPlanMs(performance.now() - startedAt);
                    const ok =
                      Boolean(text.trim()) &&
                      !text.startsWith('Error explaining') &&
                      !text.startsWith('执行计划解析异常');
                    planMetaRef.current = ok ? { sql, analyze: explainAnalyzeMode } : { sql: '', analyze: false };
                    if (!ok) {
                      toastService.error(text || '执行计划为空');
                    } else {
                      toastService.success('已重新从 DuckDB 拉取执行计划');
                    }
                  })
                  .catch(e => toastService.error(`刷新执行计划失败: ${e.message}`))
                  .finally(() => {
                    if (gen === explainFetchGenRef.current) setLoadingExplain(false);
                  });
              }}
            />
          </div>
        )}
      </div>

      {/* 4. Bottom Pagination — data/chart/pivot only (irrelevant on explain) */}
      {activeSubTab !== 'explain' && (
      <div className="min-h-8 py-1 gap-1 flex-wrap whitespace-nowrap shrink-0 border-t border-monokai-border bg-gradient-to-b from-monokai-sidebar/95 via-monokai-sidebar to-monokai-bg/40 px-3 flex items-center justify-between text-xs font-mono text-monokai-comment relative">
        {/* Subtle hairline for depth */}
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-monokai-fg/8 to-transparent" />
        <div className="flex items-center gap-1 text-meta">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={validCurrentPage <= 1}
            className="p-1 rounded hover:bg-monokai-surface hover:text-monokai-fg disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
            title="第一页"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={validCurrentPage <= 1}
            className="p-1 rounded hover:bg-monokai-surface hover:text-monokai-fg disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
            title="上一页"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <span className="mx-1 flex items-center gap-1 font-sans">
            <span className="px-2 py-0.5 rounded bg-monokai-surface border border-monokai-yellow/50 text-monokai-yellow font-mono text-meta font-bold">
              {validCurrentPage}
            </span>
          </span>

          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={validCurrentPage >= totalPages}
            className="p-1 rounded hover:bg-monokai-surface hover:text-monokai-fg disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
            title="下一页"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={validCurrentPage >= totalPages}
            className="p-1 rounded hover:bg-monokai-surface hover:text-monokai-fg disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
            title="最后一页"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>

          <span className="text-monokai-comment text-meta ml-2 font-sans">
            第 {validCurrentPage} 页, 共 {totalPages} 页
          </span>
        </div>

        <div className="flex items-center gap-3 text-meta">
          {/* Page Size Selector */}
          <div className="flex items-center gap-1.5 font-sans">
            <span className="text-monokai-comment">每页:</span>
            <select
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-monokai-surface border border-monokai-border rounded px-1.5 py-0.5 text-xs text-monokai-fg font-mono outline-none cursor-pointer hover:border-monokai-yellow transition-colors"
            >
              <option value={25}>25 行</option>
              <option value={50}>50 行</option>
              <option value={100}>100 行</option>
              <option value={200}>200 行</option>
              <option value={500}>500 行</option>
              <option value={1000}>1000 行</option>
            </select>
          </div>

          <span className="tabular-nums">
            {totalFilteredCount === 0 ? '0' : `${startIndex + 1}-${endIndex}`} / {totalFilteredCount} 行
          </span>

          <button
            onClick={() => toastService.info('当前为 Monokai Pro 高性能数据网格渲染')}
            className="p-1 rounded hover:bg-monokai-surface text-monokai-comment hover:text-monokai-fg cursor-pointer transition-colors"
            title="表格渲染设置"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      )}

      {/* 5. Sort Panel — Floating panel for managing multi-column sort rules (MECE: 数据变换组) */}
      {showSortPanel && (
        <div className="fixed right-4 top-20 z-40 w-80 rounded-xl border border-monokai-border bg-monokai-elevated shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-monokai-border bg-gradient-to-b from-monokai-surface to-monokai-surface/80">
            {/* MECE 分类标签 */}
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-monokai-cyan/15 border border-monokai-cyan/30">
                <ArrowUpDown className="w-3.5 h-3.5 text-monokai-cyan" />
              </div>
              <div>
                <span className="text-sm font-semibold text-monokai-fg">排序规则</span>
                <span className="ml-2 text-3xs px-1.5 py-0.5 rounded bg-monokai-cyan/10 text-monokai-cyan font-medium">数据变换</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {(sortRules.length > 0 || sortColumn) && (
                <button
                  onClick={handleClearAllSortRules}
                  className="p-1.5 text-monokai-comment hover:text-monokai-pink hover:bg-monokai-pink/10 rounded-md transition-colors"
                  title="清除所有排序规则 (Ctrl+Shift+S)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setShowSortPanel(false)}
                className="p-1.5 text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface rounded-md transition-colors"
                title="关闭 (ESC)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Sort Rules */}
          <div className="p-3 space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
            {/* Current Sort Rules */}
            {(sortRules.length > 0 || sortColumn) ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-2xs font-semibold uppercase tracking-wider text-monokai-comment">已添加排序</span>
                  <span className="text-3xs text-monokai-cyan/70">优先级: 按数字顺序</span>
                </div>
                {(sortColumn && !sortRules.some(r => r.column === sortColumn) ? [{ column: sortColumn, direction: sortDirection || 'asc', priority: -1 }] : sortRules).map((rule, idx) => (
                  <div
                    key={rule.column}
                    className="flex items-center gap-2 p-2 rounded-lg bg-monokai-bg/60 border border-monokai-border/60 hover:border-monokai-cyan/40 transition-colors"
                  >
                    <span className="w-5 h-5 rounded bg-monokai-cyan/15 text-monokai-cyan text-2xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="flex-1 text-xs font-mono text-monokai-fg truncate" title={rule.column}>{rule.column}</span>
                    <button
                      onClick={() => handleToggleSortDirection(rule.column)}
                      className={`px-2 py-1 text-2xs font-bold rounded border transition-colors ${
                        rule.direction === 'asc'
                          ? 'bg-monokai-cyan/15 text-monokai-cyan border-monokai-cyan/40 hover:bg-monokai-cyan/25'
                          : 'bg-monokai-yellow/15 text-monokai-yellow border-monokai-yellow/40 hover:bg-monokai-yellow/25'
                      }`}
                    >
                      {rule.direction === 'asc' ? '▲ 升序' : '▼ 降序'}
                    </button>
                    <button
                      onClick={() => handleRemoveSortRule(rule.column)}
                      className="p-1 text-monokai-comment hover:text-monokai-pink hover:bg-monokai-pink/10 rounded transition-colors"
                      title="移除此排序规则"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-meta text-monokai-comment/70">
                <ArrowUpDown className="w-6 h-6 mx-auto mb-2 opacity-40" />
                <p>暂无排序规则</p>
                <p className="mt-1">点击下方列名添加排序</p>
              </div>
            )}

            {/* Add Sort Column */}
            <div className="pt-2 border-t border-monokai-border/40 space-y-1.5">
              <span className="text-2xs font-semibold uppercase tracking-wider text-monokai-comment">添加排序列</span>
              <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto custom-scrollbar">
                {columns
                  .filter(col => !sortRules.some(r => r.column === col) && col !== sortColumn)
                  .slice(0, 12)
                  .map(col => (
                    <button
                      key={col}
                      onClick={() => handleAddSortRule(col)}
                      className="px-2 py-1 text-2xs font-mono rounded border border-dashed border-monokai-border/60 hover:border-monokai-cyan/50 hover:text-monokai-cyan hover:bg-monokai-cyan/10 text-monokai-comment transition-colors"
                    >
                      + {col}
                    </button>
                  ))}
              </div>
            </div>
          </div>

          {/* Footer with shortcuts hint */}
          <div className="px-4 py-2 border-t border-monokai-border bg-monokai-bg/60 space-y-1">
            <div className="flex items-center gap-2 text-2xs text-monokai-comment">
              <kbd className="px-1 py-0.5 rounded bg-monokai-surface border border-monokai-border text-3xs font-mono">Ctrl+Shift+S</kbd>
              <span>切换面板</span>
              <span className="mx-1">·</span>
              <kbd className="px-1 py-0.5 rounded bg-monokai-surface border border-monokai-border text-3xs font-mono">ESC</kbd>
              <span>关闭</span>
            </div>
            <p className="text-3xs text-monokai-comment/60">💡 提示：多字段排序按优先级依次应用，点击表头可直接添加单字段排序</p>
          </div>
        </div>
      )}

      {/* 6. Cell Right-Click Context Menu matching screenshot */}
      {cellMenu && cellMenu.visible && (
        <div
          ref={cellMenuRef}
          className="fixed z-50 w-52 rounded-lg bg-monokai-elevated border border-monokai-border shadow-2xl py-1 text-xs text-monokai-fg font-sans"
          style={{
            top: Math.min(cellMenu.y, window.innerHeight - 260),
            left: Math.min(cellMenu.x, window.innerWidth - 220),
          }}
        >
          <button
            onClick={() => handleApplyCellFilter('=')}
            className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-monokai-surface hover:text-monokai-fg text-left cursor-pointer"
          >
            <Filter className="w-3.5 h-3.5 text-monokai-cyan" />
            <span>筛选 = '{String(cellMenu.value)}'</span>
          </button>
          <button
            onClick={() => handleApplyCellFilter('!=')}
            className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-monokai-surface hover:text-monokai-fg text-left cursor-pointer"
          >
            <Filter className="w-3.5 h-3.5 text-monokai-comment" />
            <span>筛选 ≠ '{String(cellMenu.value)}'</span>
          </button>
          <button
            onClick={handleGroupFromCell}
            className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-monokai-surface hover:text-monokai-fg text-left cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-monokai-green" />
            <span>按 {cellMenu.column} 分组</span>
          </button>
          <button
            onClick={handleGroupFromCell}
            className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-monokai-surface hover:text-monokai-fg text-left cursor-pointer"
          >
            <Sigma className="w-3.5 h-3.5 text-monokai-yellow" />
            <span>Count by this column</span>
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(cellMenu.column);
              setCellMenu(null);
              toastService.success(`已复制列名: ${cellMenu.column}`);
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-monokai-surface hover:text-monokai-fg text-left cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-monokai-cyan" />
            <span>Add to SELECT</span>
          </button>
          <div className="my-1 border-t border-monokai-border-subtle" />
          <button
            onClick={() => {
              navigator.clipboard.writeText(String(cellMenu.value));
              setCellMenu(null);
              toastService.success('已复制单元格值');
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-monokai-surface hover:text-monokai-fg text-left cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-monokai-comment" />
            <span>Copy value</span>
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(cellMenu.column);
              setCellMenu(null);
              toastService.success('已复制列名');
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-monokai-surface hover:text-monokai-fg text-left cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-monokai-comment" />
            <span>Copy column name</span>
          </button>
        </div>
      )}

      {/* 7. Filter Modal — Enhanced with AND/OR Logic */}
      {showFilterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none font-sans">
          <div className="w-full max-w-2xl rounded-xl border border-monokai-border bg-monokai-elevated shadow-2xl space-y-0 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-monokai-border bg-gradient-to-b from-monokai-surface to-monokai-surface/80">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-monokai-yellow/20 to-monokai-yellow/10 border border-monokai-yellow/40 flex items-center justify-center">
                  <Filter className="w-4.5 h-4.5 text-monokai-yellow" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-monokai-fg tracking-tight">条件筛选</h2>
                  <p className="text-meta text-monokai-comment">多条件 AND/OR 逻辑，生成 SQL WHERE 子句</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xs text-monokai-comment px-2 py-1 rounded-md bg-monokai-bg border border-monokai-border">
                  {columns.length} 列
                </span>
                <button onClick={() => setShowFilterModal(false)} className="p-2 text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface rounded-md transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filter Rules */}
            <div className="px-5 py-4 space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
              {/* Quick Presets */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-2xs text-monokai-comment font-medium uppercase tracking-wide">快速添加:</span>
                {columns.slice(0, 4).map(col => (
                  <button
                    key={col}
                    onClick={() => {
                      if (!filterRules.some(r => r.column === col)) {
                        setFilterRules([...filterRules, {
                          id: crypto.randomUUID(),
                          column: col,
                          operator: '=',
                          value: '',
                          conjunction: 'AND'
                        }]);
                      }
                    }}
                    className="px-2 py-1 text-2xs rounded border border-dashed border-monokai-border/60 hover:border-monokai-yellow/50 hover:text-monokai-yellow hover:bg-monokai-yellow/10 text-monokai-comment transition-colors font-mono"
                  >
                    + {col}
                  </button>
                ))}
              </div>

              {/* Filter Rules List */}
              <div className="space-y-2">
                {filterRules.map((rule, idx) => (
                  <div key={rule.id} className="flex items-center gap-2 p-3 rounded-lg border border-monokai-border/60 bg-monokai-bg/50 hover:border-monokai-border transition-colors">
                    {/* Conjunction Toggle (for rules after first) */}
                    {idx > 0 && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            setFilterRules(rules => rules.map((r, i) =>
                              i === idx ? { ...r, conjunction: r.conjunction === 'AND' ? 'OR' : 'AND' } : r
                            ));
                          }}
                          className={`px-2 py-1 text-2xs font-bold rounded border transition-colors cursor-pointer ${
                            rule.conjunction === 'AND'
                              ? 'bg-monokai-cyan/15 text-monokai-cyan border-monokai-cyan/40 hover:bg-monokai-cyan/25'
                              : 'bg-monokai-yellow/15 text-monokai-yellow border-monokai-yellow/40 hover:bg-monokai-yellow/25'
                          }`}
                        >
                          {rule.conjunction}
                        </button>
                      </div>
                    )}

                    {/* Column Selector */}
                    <select
                      value={rule.column}
                      onChange={e => {
                        const val = e.target.value;
                        setFilterRules(rules => rules.map((r, i) => i === idx ? { ...r, column: val } : r));
                      }}
                      className="w-36 bg-monokai-surface border border-monokai-border/80 rounded-md px-2.5 py-1.5 text-xs text-monokai-cyan focus:outline-none focus:border-monokai-cyan/60 font-mono"
                    >
                      <option value="">选择列...</option>
                      {columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>

                    {/* Operator Selector */}
                    <select
                      value={rule.operator}
                      onChange={e => {
                        const val = e.target.value as FilterRule['operator'];
                        setFilterRules(rules => rules.map((r, i) => i === idx ? { ...r, operator: val } : r));
                      }}
                      className="w-36 bg-monokai-surface border border-monokai-border/80 rounded-md px-2.5 py-1.5 text-xs text-monokai-fg focus:outline-none focus:border-monokai-cyan/60 font-mono"
                    >
                      <optgroup label="比较运算符">
                        <option value="=">= 等于</option>
                        <option value="!=">不等于</option>
                        <option value=">">&gt; 大于</option>
                        <option value=">=">&gt;= 大于等于</option>
                        <option value="<">&lt; 小于</option>
                        <option value="<=">&lt;= 小于等于</option>
                      </optgroup>
                      <optgroup label="模糊匹配">
                        <option value="contains">包含</option>
                        <option value="starts_with">开头是</option>
                        <option value="ends_with">结尾是</option>
                      </optgroup>
                      <optgroup label="空值判断">
                        <option value="is_null">为空 NULL</option>
                        <option value="is_not_null">非空 NOT NULL</option>
                      </optgroup>
                      <optgroup label="范围查询">
                        <option value="in">在列表中 IN</option>
                        <option value="between">区间 BETWEEN</option>
                      </optgroup>
                    </select>

                    {/* Value Input */}
                    {rule.operator !== 'is_null' && rule.operator !== 'is_not_null' && (
                      <div className="flex-1 flex items-center gap-1.5">
                        {rule.operator === 'between' ? (
                          <>
                            <input
                              type="text"
                              value={rule.value}
                              onChange={e => {
                                const val = e.target.value;
                                setFilterRules(rules => rules.map((r, i) => i === idx ? { ...r, value: val } : r));
                              }}
                              placeholder="起始值"
                              className="flex-1 min-w-[80px] bg-monokai-surface border border-monokai-border/80 rounded-md px-2.5 py-1.5 text-xs text-monokai-fg focus:outline-none focus:border-monokai-cyan/60 font-mono"
                            />
                            <span className="text-monokai-comment text-2xs">至</span>
                            <input
                              type="text"
                              value={rule.value2 || ''}
                              onChange={e => {
                                const val = e.target.value;
                                setFilterRules(rules => rules.map((r, i) => i === idx ? { ...r, value2: val } : r));
                              }}
                              placeholder="结束值"
                              className="flex-1 min-w-[80px] bg-monokai-surface border border-monokai-border/80 rounded-md px-2.5 py-1.5 text-xs text-monokai-fg focus:outline-none focus:border-monokai-cyan/60 font-mono"
                            />
                          </>
                        ) : rule.operator === 'in' ? (
                          <input
                            type="text"
                            value={rule.value}
                            onChange={e => {
                              const val = e.target.value;
                              setFilterRules(rules => rules.map((r, i) => i === idx ? { ...r, value: val } : r));
                            }}
                            placeholder="用逗号分隔, 如: a,b,c"
                            className="flex-1 bg-monokai-surface border border-monokai-border/80 rounded-md px-2.5 py-1.5 text-xs text-monokai-fg focus:outline-none focus:border-monokai-cyan/60 font-mono"
                          />
                        ) : (
                          <input
                            type="text"
                            value={rule.value}
                            onChange={e => {
                              const val = e.target.value;
                              setFilterRules(rules => rules.map((r, i) => i === idx ? { ...r, value: val } : r));
                            }}
                            placeholder="输入值..."
                            className="flex-1 bg-monokai-surface border border-monokai-border/80 rounded-md px-2.5 py-1.5 text-xs text-monokai-fg focus:outline-none focus:border-monokai-cyan/60 font-mono"
                          />
                        )}
                      </div>
                    )}

                    {/* Delete Button */}
                    {filterRules.length > 1 && (
                      <button
                        onClick={() => setFilterRules(rules => rules.filter((_, i) => i !== idx))}
                        className="p-1.5 text-monokai-comment hover:text-monokai-pink hover:bg-monokai-pink/10 rounded-md transition-colors shrink-0"
                        title="删除条件"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Filter Rule Button */}
              <button
                onClick={() => {
                  setFilterRules([...filterRules, {
                    id: crypto.randomUUID(),
                    column: '',
                    operator: '=',
                    value: '',
                    conjunction: 'AND'
                  }]);
                }}
                className="w-full py-2 rounded-lg border-2 border-dashed border-monokai-border/50 hover:border-monokai-cyan/50 hover:text-monokai-cyan hover:bg-monokai-cyan/5 text-monokai-comment text-xs font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" />
                添加筛选条件
              </button>

              {/* SQL Preview */}
              <div className="space-y-1.5 pt-2 border-t border-monokai-border/40">
                <div className="flex items-center gap-2">
                  <Code2 className="w-3.5 h-3.5 text-monokai-cyan" />
                  <span className="text-2xs font-semibold uppercase tracking-wide text-monokai-comment">SQL 预览</span>
                </div>
                <pre className="p-3 rounded-lg bg-monokai-sidebar border border-monokai-border/60 font-mono text-meta text-monokai-green overflow-x-auto whitespace-pre leading-relaxed">
                  {`SELECT * FROM (\n    ${activeTabSql?.replace(/;\s*$/, '').replace(/\n/g, '\n    ') || '原查询'}\n)\nWHERE ${filterRules.filter(r => r.column).map((r, idx) => {
                    const prefix = idx === 0 ? '' : (r.conjunction === 'OR' ? '\n    OR ' : '\n    AND ');
                    let clause = '';
                    const col = r.column || 'column_name';
                    switch (r.operator) {
                      case 'is_null': clause = `${col} IS NULL`; break;
                      case 'is_not_null': clause = `${col} IS NOT NULL`; break;
                      case 'in': clause = `${col} IN (${r.value.split(',').map(v => `'${v.trim()}'`).join(', ')})`; break;
                      case 'between': clause = `${col} BETWEEN ${r.value} AND ${r.value2 || r.value}`; break;
                      case 'contains': clause = `${col} ILIKE '%${r.value}%'`; break;
                      case 'starts_with': clause = `${col} ILIKE '${r.value}%'`; break;
                      case 'ends_with': clause = `${col} ILIKE '%${r.value}'`; break;
                      default: clause = `${col} ${r.operator} ${isNaN(Number(r.value)) ? `'${r.value}'` : r.value}`;
                    }
                    return prefix + clause;
                  }).join('')};`}
                </pre>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-4 border-t border-monokai-border bg-gradient-to-b from-monokai-bg to-monokai-bg/80">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setFilterRules([{ id: crypto.randomUUID(), column: '', operator: '=', value: '', conjunction: 'AND' }]);
                    setSortRules([]);
                    setSortColumn(null);
                    setSortDirection(null);
                  }}
                  className="px-3 py-1.5 text-meta rounded-md border border-monokai-border/60 text-monokai-comment hover:text-monokai-fg hover:border-monokai-border transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3 h-3" />
                  重置全部
                </button>
                <span className="text-2xs text-monokai-comment/70">
                  {filterRules.filter(r => r.column && (r.operator === 'is_null' || r.operator === 'is_not_null' || r.value.trim() !== '')).length} 个有效条件
                </span>
              </div>
              <div className="flex items-center gap-2">
                <ActionButton variant="secondary" size="sm" onClick={() => setShowFilterModal(false)}>
                  取消
                </ActionButton>
                <ActionButton variant="primary" size="sm" icon={Check} onClick={handleGeneratedFilterSql}>
                  应用筛选
                </ActionButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. Group & Aggregate Modal */}
      <ModalShell
        open={showGroupModal}
        title="分组聚合操作"
        description="Group & Aggregate · 基于当前查询结果生成 GROUP BY SQL，应用后写入编辑器并运行"
        onClose={() => setShowGroupModal(false)}
        size="md"
        icon={Layers}
        iconColor="text-monokai-green"
        badge="GROUP BY"
        footer={(
          <>
            <ActionButton variant="secondary" size="sm" onClick={() => setShowGroupModal(false)}>
              取消
            </ActionButton>
            <ActionButton
              variant="primary"
              size="sm"
              icon={Layers}
              onClick={handleGeneratedGroupSql}
              disabled={groupByCols.length === 0 || aggMetrics.length === 0}
            >
              应用
            </ActionButton>
          </>
        )}
      >
        <div className="space-y-5 font-sans text-xs">
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-2xs font-semibold uppercase tracking-[0.12em] text-monokai-comment">
                Group By 分组维度
              </label>
              <span className="font-mono text-2xs tabular-nums text-monokai-comment/80">
                {groupByCols.length} 列
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 min-h-8 p-2 rounded-lg border border-monokai-border/80 bg-monokai-bg/50">
              {groupByCols.map(col => (
                <span
                  key={col}
                  className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1 rounded-md bg-gradient-to-b from-monokai-green/18 to-monokai-green/8 text-monokai-green border border-monokai-green/45 font-mono text-meta font-semibold tracking-tight shadow-[inset_0_0_0_1px_rgba(166,226,46,0.08)]"
                >
                  {col}
                  <button
                    type="button"
                    aria-label={`移除分组列 ${col}`}
                    onClick={() => setGroupByCols(cols => cols.filter(c => c !== col))}
                    className="p-0.5 rounded text-monokai-green/80 hover:text-monokai-pink hover:bg-monokai-pink/15 cursor-pointer transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {(() => {
                const available = columns.filter(c => !groupByCols.includes(c));
                if (available.length === 0) {
                  return (
                    <span className="text-meta text-monokai-comment/70 px-1">已选择全部列</span>
                  );
                }
                if (available.length <= 8) {
                  return available.map(col => (
                    <button
                      type="button"
                      key={col}
                      onClick={() => setGroupByCols(cols => [...cols, col])}
                      className="h-7 px-2.5 rounded-md border border-dashed border-monokai-border/80 bg-transparent text-monokai-comment hover:text-monokai-green hover:border-monokai-green/40 hover:bg-monokai-green/10 font-mono text-meta font-semibold tracking-tight cursor-pointer transition-all"
                    >
                      + {col}
                    </button>
                  ));
                }
                return (
                  <div className="relative min-w-[160px]">
                    <select
                      aria-label="添加分组列"
                      defaultValue=""
                      onChange={e => {
                        if (e.target.value && !groupByCols.includes(e.target.value)) {
                          setGroupByCols(cols => [...cols, e.target.value]);
                        }
                        e.target.value = '';
                      }}
                      className={WORKBENCH_SELECT_CLASS}
                    >
                      <option value="">+ 添加分组列...</option>
                      {available.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-monokai-comment/70" />
                  </div>
                );
              })()}
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-2xs font-semibold uppercase tracking-[0.12em] text-monokai-comment">
                聚合指标 (Aggregations)
              </label>
              <ActionButton
                variant="ghost"
                size="sm"
                icon={Plus}
                onClick={() => {
                  const nextCol = columns.find(c => !groupByCols.includes(c)) || columns[0] || 'amount';
                  setAggMetrics(metrics => [
                    ...metrics,
                    { column: nextCol, aggregator: 'COUNT', alias: `${nextCol}_count` },
                  ]);
                }}
              >
                添加指标
              </ActionButton>
            </div>
            <div className="space-y-2">
              {aggMetrics.map((metric, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 p-2.5 rounded-lg border border-monokai-border/80 bg-monokai-surface/70"
                >
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <div className="relative min-w-[140px] flex-1">
                      <select
                        aria-label={`聚合列 ${idx + 1}`}
                        value={metric.column}
                        onChange={e => {
                          const val = e.target.value;
                          setAggMetrics(m => m.map((item, i) => i === idx ? { ...item, column: val } : item));
                        }}
                        className={WORKBENCH_SELECT_CLASS}
                      >
                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-monokai-comment/70" />
                    </div>
                    <SegmentedTabs
                      aria-label={`聚合函数 ${idx + 1}`}
                      value={['SUM', 'COUNT', 'AVG', 'MIN', 'MAX'].includes(metric.aggregator) ? metric.aggregator as 'SUM' | 'COUNT' | 'AVG' | 'MIN' | 'MAX' : 'SUM'}
                      items={[...AGG_FN_ITEMS]}
                      onChange={val => {
                        setAggMetrics(m => m.map((item, i) => i === idx ? { ...item, aggregator: val } : item));
                      }}
                      size="sm"
                      tone="green"
                    />
                    <div className="w-40 shrink-0">
                      <FormInput
                        value={metric.alias || ''}
                        onChange={e => {
                          const val = e.target.value;
                          setAggMetrics(m => m.map((item, i) => i === idx ? { ...item, alias: val } : item));
                        }}
                        placeholder="别名 alias"
                        sizeVariant="sm"
                        fontVariant="mono"
                      />
                    </div>
                  </div>
                  {aggMetrics.length > 1 && (
                    <button
                      type="button"
                      aria-label={`删除指标 ${idx + 1}`}
                      onClick={() => setAggMetrics(m => m.filter((_, i) => i !== idx))}
                      className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-md text-monokai-comment hover:text-monokai-pink hover:bg-monokai-pink/15 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-2xs font-semibold uppercase tracking-[0.12em] text-monokai-comment flex items-center gap-1.5">
                <Code2 className="w-3 h-3 text-monokai-cyan" />
                生成 SQL 预览
              </span>
              <button
                type="button"
                onClick={handleCopyGroupSqlPreview}
                className="h-7 px-2 rounded-md border border-monokai-border/70 bg-monokai-bg/60 text-monokai-comment hover:text-monokai-cyan hover:border-monokai-cyan/40 text-meta font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                title="复制生成的 SQL 到剪贴板"
                aria-label="复制生成的 SQL"
              >
                <Copy className="w-3 h-3" />
                复制
              </button>
            </div>
            <div className="rounded-lg border border-monokai-border/80 bg-monokai-bg overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <CodeMirror
                value={groupSqlPreview}
                theme={uiTheme === 'light' ? lightEditorTheme : monokai}
                extensions={GROUP_SQL_PREVIEW_EXTENSIONS}
                editable={false}
                basicSetup={{
                  lineNumbers: false,
                  foldGutter: false,
                  highlightActiveLine: false,
                  highlightActiveLineGutter: false,
                  highlightSelectionMatches: false,
                }}
                className="text-[11.5px] font-mono [&_.cm-editor]:outline-none"
              />
            </div>
          </section>
        </div>
      </ModalShell>

      {/* Export options mirror the actual callbacks; unsupported options cannot report success. */}
      <ModalShell
        open={showExportModal}
        title="导出数据"
        description="CSV / JSON 导出已加载结果；Parquet 重新执行当前查询导出全部结果。文件名自动生成。"
        onClose={() => setShowExportModal(false)}
        size="md"
        icon={Download}
        footer={(
          <>
            <ActionButton variant="secondary" size="sm" onClick={() => setShowExportModal(false)}>取消</ActionButton>
            <ActionButton variant="warning" size="sm" icon={Download} disabled={!exportHandler || rawRows.length === 0} onClick={handleExecuteExport}>
              导出 {exportFormat.toUpperCase()}
            </ActionButton>
          </>
        )}
      >
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="导出格式">
          {([
            { value: 'parquet', label: 'Parquet', available: Boolean(onExportParquet) },
            { value: 'csv', label: 'CSV', available: Boolean(onExportCsv) },
            { value: 'json', label: 'JSON', available: Boolean(onExportJson) },
            { value: 'arrow', label: 'Arrow IPC', available: false },
          ] as const).map(fmt => (
            <ActionButton key={fmt.value} variant={exportFormat === fmt.value ? 'primary' : 'secondary'} disabled={!fmt.available} onClick={() => setExportFormat(fmt.value)}>
              {fmt.label}{!fmt.available ? '（暂不可用）' : ''}
            </ActionButton>
          ))}
        </div>
        <p className="mt-3 text-xs text-monokai-comment">已加载 {rawRows.length.toLocaleString()} 行 · {columns.length} 列</p>
      </ModalShell>

    </div>
  );
};
