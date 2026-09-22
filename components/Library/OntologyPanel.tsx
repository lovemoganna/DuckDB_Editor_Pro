/**
 * OntologyPanel — 本体论知识图谱统一入口
 *
 * 重构目标：应用 3-pane 左中右三栏现代 SaaS 布局
 * - 左侧：导航与列表库 (Templates / 数据列表)
 * - 中间：图谱 / Canvas 可视化焦点区域
 * - 右侧：选中实体的 Context Inspector 属性检视器
 *
 * 主题：维系 Monokai 的科技暗色调，但移除边框光害，增大字号与留白。
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Network, Database, LayoutGrid, Sparkles, ChevronRight, ChevronDown,
  ChevronLeft, X, Search, RefreshCw, Play, ArrowRight, Loader2,
  Table2, Link2, Layers, AlertTriangle, Check, Plus, Edit3, Trash2,
  Lightbulb, Zap, PanelRightDashed, AlignLeft, GripVertical, Target,
  List, Map, BarChart2, Pencil, Download, Upload, Brain, Wand2, BookOpen, GraduationCap,
  Workflow
} from 'lucide-react';
import { FlaskConical } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { sql as sqlLang } from '@codemirror/lang-sql';
import { EditorView } from '@codemirror/view';
import { monokai } from '@uiw/codemirror-theme-monokai';
import { toastService } from '../../services/toastService';
import { MultiHopDeductionExplorer } from './MultiHopDeductionExplorer';
import { useAppStore } from '../../hooks/store/useAppStore';
import { Tab } from '../../types';

import { useOntologyStore, ontologyActions, ONTOLOGY_SEED_INFOS, OntologyStoreState } from '../../hooks/useOntologyStore';
import { ontologyAiService } from '../../services/ontologyAiService';
// 视图同步 Hook
import { useGraphViewSync, useGraphViewSwitcher, layoutEventBus, type LayoutInfo } from '../../hooks/useGraphViewSync';
// 布局性能监控
import { getLayoutStats, getLayoutMetricsHistory } from '../../services/graphLayoutService';
import { PatternLibraryPanel } from './PatternLibraryPanel';
import { CRUDList } from './CRUDList';
import RightInspector from './OntologyPanelRightInspector';
import type { EditMode } from './OntologyPanel.types';
import D3GraphView, { D3GraphView as D3GraphViewComponent, type KnowledgeGraphRenderMode } from './D3GraphView';
import OntologyCanvas from './OntologyCanvas';
import OntologyInsightsPanel from './OntologyInsightsPanel';
import { OntologyDataView } from './OntologyDataView';
import { OntologyModelingWizard } from './OntologyModelingWizard';
import { OntologyReasoningCatalogEditor } from './OntologyReasoningCatalogEditor';
import { DeductionWorkbench } from './DeductionWorkbench';
import {
  downloadOntologyJSON,
  executeOntologyDraft,
  importOntologyFromJSON,
  type OntologyMapping,
} from '../../services/ontology/ontologyStorage';
import { ResultTable } from '../Learn/ResultTable';
import { ResizableLayout } from '../ui/ResizableLayout';
import { MappingConsole } from './MappingConsole';
import { QuickClearMenu } from './QuickClearMenu';
import { planOntologyCommand } from './ontologyCommandRouter';
import { ConfirmDialogProvider, useConfirmDialog } from '../ui/ConfirmDialog';
import { SegmentedTabs, ActionButton, SearchInput, ModalShell, IconButton, type SegmentedTab } from '../ui/Workbench';
import {
  ONTOLOGY_DRAWER_PREFERENCE_KEY,
  resolveOntologyDrawerMode,
} from './ontologyViewportPolicy';


// ============================================================
// Types
// ============================================================

type ViewTab = 'graph' | 'data' | 'canvas';
type DrawerTab = 'templates' | 'crud' | 'insights' | 'mapping' | 'deduction';

interface ExecutionResult {
  data: any[] | null;
  error: string | null;
  loading: boolean;
  executionTime?: number;
}

interface FormState {
  name: string; desc: string; objectTypeId: number; properties: string;
  linkTypeId: number; sourceId: number | null; targetId: number | null;
  weight: number; status: string; executeAt: string;
}

// ============================================================
// Live Clock
// ============================================================

// ============================================================
// View Tabs Configuration
// ============================================================

const VIEW_TABS: readonly SegmentedTab<ViewTab>[] = [
  { value: 'graph', label: '知识图谱', icon: Network },
  { value: 'data',  label: '数据视图', icon: Database },
  { value: 'canvas', label: '实体画布', icon: LayoutGrid },
];

// ============================================================
// AIDraftModal
// ============================================================

const AIDraftModal: React.FC<{
  payload: any;
  jsonStr: string;
  mapping: OntologyMapping;
  onCommit: () => void;
  onCancel: () => void;
}> = ({ payload, jsonStr, mapping, onCommit, onCancel }) => {
  const [committing, setCommitting] = useState(false);

  const handleCommit = async () => {
    setCommitting(true);
    try {
      await executeOntologyDraft(mapping, payload);
      onCommit();
    } catch (e: any) {
      toastService.error('提交失败', e.message);
    } finally {
      setCommitting(false);
    }
  };

  return (
    <ModalShell
      open={true}
      title="AI 生成预览"
      description="请审核并确认即将注入图谱的新知数据"
      size="lg"
      onClose={onCancel}
      footer={
        <div className="flex items-center justify-end gap-2.5">
          <ActionButton variant="ghost" onClick={onCancel}>
            取消
          </ActionButton>
          <ActionButton
            variant="primary"
            loading={committing}
            icon={Check}
            onClick={handleCommit}
          >
            确认并注入
          </ActionButton>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center gap-6 text-xs p-3 rounded-lg bg-monokai-surface border border-monokai-border font-medium">
          {payload.objects?.length > 0 && (
            <span className="text-monokai-cyan flex items-center gap-1.5">
              <Table2 className="w-3.5 h-3.5" /> 对象 × {payload.objects.length}
            </span>
          )}
          {payload.links?.length > 0 && (
            <span className="text-monokai-amethyst flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5" /> 关系 × {payload.links.length}
            </span>
          )}
          {payload.actions?.length > 0 && (
            <span className="text-monokai-yellow flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" /> 行动 × {payload.actions.length}
            </span>
          )}
        </div>

        <div className="rounded-lg border border-monokai-border overflow-hidden bg-monokai-surface">
          <CodeMirror
            value={jsonStr}
            height="360px"
            theme={monokai}
            extensions={[sqlLang(), EditorView.lineWrapping, EditorView.theme({ "&": { fontSize: "13px" } })]}
            editable={false}
            basicSetup={false}
          />
        </div>
      </div>
    </ModalShell>
  );
};

// ============================================================
// Template Panel (Left Pane Content)
// ============================================================

const CATEGORY_ACCENT: Record<string, string> = {
  setup:  'from-sky-500/25 via-sky-500/10 to-transparent',
  query:  'from-monokai-cyan/30 via-monokai-cyan/10 to-transparent',
  modify: 'from-monokai-yellow/30 via-monokai-yellow/10 to-transparent',
  export: 'from-monokai-green/30 via-monokai-green/10 to-transparent',
  industry: 'from-amber-500/25 via-amber-500/10 to-transparent',
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  setup:  Database,
  query:  BarChart2,
  modify:  Pencil,
  export:  Download,
  industry: Sparkles,
};

const CATEGORY_COLORS: Record<string, string> = {
  setup: 'text-monokai-cyan', query: 'text-monokai-cyan',
  modify: 'text-monokai-yellow', export: 'text-monokai-green',
  industry: 'text-monokai-yellow',
};


// ── Syntax-highlighted SQL code block ──────────────────────────
const SqlPreview: React.FC<{ sql: string; maxHeight?: string }> = ({ sql, maxHeight }) => (
  <div className={`rounded border border-monokai-border/40 overflow-hidden`}>
    <div className="flex items-center justify-between px-2.5 py-1 border-b border-monokai-border/30">
      <span className="text-[9px] text-monokai-comment/50 font-mono tracking-wider uppercase">SQL</span>
    </div>
    <div className={maxHeight ? 'overflow-auto custom-scrollbar' : ''} style={maxHeight ? { maxHeight } : undefined}>
      <CodeMirror
        value={sql}
        theme={monokai}
        editable={false}
        basicSetup={false}
        extensions={[
          sqlLang(),
          EditorView.lineWrapping,
          EditorView.theme({
            '&': { fontSize: '11px' },
            '.cm-scroller': { fontFamily: 'inherit', overflow: 'hidden' },
            '.cm-content': { padding: '8px 0' },
            '.cm-gutters': { display: 'none' },
          }),
        ]}
      />
    </div>
  </div>
);

// ── Status badge pill ──────────────────────────────────────────
const StatusBadge: React.FC<{ result?: ExecutionResult }> = ({ result }) => {
  if (result?.loading) return (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-monokai-yellow/12 text-monokai-yellow border border-monokai-yellow/20 font-medium">
      <Loader2 className="w-2.5 h-2.5 animate-spin" /> 运行中
    </span>
  );
  if (result?.error) return (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-monokai-red/10 text-monokai-red border border-monokai-red/20 font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-monokai-red inline-block" /> 失败
    </span>
  );
  if (result?.data !== undefined) return (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-monokai-green/10 text-monokai-green border border-monokai-green/20 font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-monokai-green inline-block" />
      {result.executionTime ? `${result.executionTime.toFixed(0)}ms` : '完成'}
    </span>
  );
  return null;
};

// ── Individual Template Card ──────────────────────────────────
const TemplateCard: React.FC<{
  tpl: any;
  result?: ExecutionResult;
  categoryColor: string;
  accentClass: string;
  onExecute: (id: string, sql: string, refreshTables?: boolean) => void;
  onInsert?: (sql: string) => void;
}> = ({ tpl, result, categoryColor, accentClass, onExecute, onInsert }) => {
  const [expanded, setExpanded] = useState(false);

  const isFirst = tpl.id === 'init-full';
  const hasError = !!result?.error;
  const hasData = result?.data !== undefined;
  const isLoading = !!result?.loading;

  // Status dot color
  const dotClass = hasError
    ? 'bg-monokai-red'
    : hasData
    ? 'bg-monokai-green'
    : 'bg-monokai-comment/30';

  // Execute button
  const execBtnClass = isLoading
    ? 'bg-monokai-yellow/10 text-monokai-yellow border border-monokai-yellow/30 cursor-not-allowed'
    : hasError
    ? `bg-monokai-red/10 ${categoryColor} border border-monokai-red/30 hover:bg-monokai-red/20`
    : hasData
    ? 'bg-monokai-green/10 text-monokai-green border border-monokai-green/30 hover:bg-monokai-green/20'
    : `${accentClass} ${categoryColor} border border-current/20 hover:border-current/40`;

  const execBtnLabel = isLoading ? '执行中' : hasError ? '重试' : hasData ? '再次执行' : '执行';

  return (
    <div
      className={`
        rounded-lg border overflow-hidden transition-all duration-200 group relative
        ${isFirst && !hasError && !hasData
          ? `template-card-first`
          : hasError
          ? 'border-monokai-red/30 bg-monokai-red/[0.04] hover:border-monokai-red/50'
          : hasData
          ? 'border-monokai-green/25 bg-monokai-green/[0.03] hover:border-monokai-border-strong'
          : 'border-monokai-border/40 bg-monokai-surface hover:border-monokai-border/70 hover:bg-monokai-sidebar/30'
        }
      `}
    >
      {/* Left accent stripe — category color indicator */}
      <div className={`
        absolute left-0 top-0 bottom-0 w-[2px] rounded-l-lg transition-all duration-200
        ${hasError
          ? 'bg-monokai-red'
          : hasData
          ? 'bg-monokai-green'
          : isFirst
          ? 'bg-monokai-amethyst'
          : hasData
          ? 'bg-monokai-green'
          : 'bg-monokai-comment/20 group-hover:bg-monokai-comment/40'
        }
      `} />

      {/* Card header */}
      <button
        type="button"
        className="w-full flex items-center pl-3 pr-2 py-1.5 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Left: status dot + content */}
        <div className="flex items-start gap-2 min-w-0 flex-1">
          {/* Status dot */}
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-[3px] transition-all ${dotClass}`} />

          {/* Title + description stack */}
          <div className="min-w-0 flex-1">
            {/* Title row: label + inline status */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-xs font-medium leading-tight ${isFirst && !hasError && !hasData ? 'text-monokai-amethyst' : 'text-monokai-fg'}`}>
                {tpl.label}
              </span>
              <StatusBadge result={result} />
            </div>
            {/* Description */}
            <p className="text-[11px] text-monokai-comment/60 leading-normal mt-0.5 pr-2 line-clamp-2">
              {tpl.description}
            </p>
          </div>
        </div>

        {/* Right: chevron */}
        <div className="shrink-0 self-center">
          <ChevronDown
            className={`w-3 h-3 text-monokai-comment/40 transition-transform duration-200 ${expanded ? 'rotate-180 text-monokai-fg/60' : ''}`}
          />
        </div>
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-monokai-border/30 px-3 pt-2 pb-2.5 space-y-2 bg-monokai-sidebar/15">
          {/* Action bar */}
          <div className="flex items-center gap-1 flex-wrap">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onExecute(tpl.id, tpl.sql, tpl.refreshTables); }}
              disabled={isLoading}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-all ${execBtnClass}`}>
              {isLoading
                ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                : <Play className="w-2.5 h-2.5" />
              }
              {execBtnLabel}
            </button>

            {onInsert && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onInsert(tpl.sql); }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-monokai-blue/10 text-monokai-blue border border-monokai-blue/20 hover:bg-monokai-blue/20 transition-all">
                <ArrowRight className="w-2.5 h-2.5" /> 复制
              </button>
            )}
          </div>

          {/* Code block with syntax highlighting */}
          <SqlPreview sql={tpl.sql} />

          {/* Result table */}
          {result && (
            <ResultTable
              data={result.data || []}
              error={result.error}
              loading={result.loading}
              executionTime={result.executionTime}
            />
          )}
        </div>
      )}
    </div>
  );
};

// ── Main Template Panel ──────────────────────────────────────


// ============================================================
// MECE Section Divider
// ============================================================
const MECESectionDivider: React.FC<{ label: string; color: string }> = ({ label, color }) => {
  const colorMap: Record<string, string> = {
    cyan: 'bg-monokai-cyan/30 text-monokai-cyan',
    blue: 'bg-monokai-cyan/30 text-monokai-cyan',
    green: 'bg-monokai-green/30 text-monokai-green',
    yellow: 'bg-monokai-yellow/30 text-monokai-yellow',
  };
  return (
    <div className="flex items-center gap-2 mb-3 mt-1">
      <div className={`w-1 h-2.5 rounded-full ${colorMap[color] || colorMap.cyan}`} />
      <span className={`text-xs font-bold uppercase tracking-widest ${colorMap[color] || colorMap.cyan} opacity-80`}>{label}</span>
      <div className="flex-1 h-px bg-gradient-to-r from-monokai-border/40 to-transparent" />
    </div>
  );
};


// ============================================================
// Date normalization helper
// DuckDB returns DATE fields as various types (epoch ms, Date objects, ISO strings).
// HTML date input needs 'YYYY-MM-DD', DuckDB SQL needs 'YYYY-MM-DD'.
// ============================================================
function normalizeDateToString(raw: any): string {
  if (!raw) return '';
  // Already a valid YYYY-MM-DD string
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // ISO datetime string like '2024-12-31T00:00:00.000Z'
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.slice(0, 10);
  // Numeric timestamp (milliseconds since epoch)
  if (typeof raw === 'number' && raw > 1e8) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  // Date object
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw.toISOString().slice(0, 10);
  // Fallback: try parsing
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return '';
}




// ============================================================
// Main Application Component
// ============================================================

const OntologyPanelContent: React.FC<{
  onInsert?: (sql: string) => void;
  onTablesReady?: () => void;
  isActive?: boolean;
}> = ({ onInsert, onTablesReady, isActive }) => {
  const { state: rawState, dispatch, refresh, initOntology, reseedOntology, batchImportModelingResult, setPendingCommand,
    deleteObjectType, deleteObject, deleteLinkType, deleteLink, deleteAction, switchTemplate, activeTemplateId,
    deleteIntrospection, deleteInsight } = useOntologyStore();
  const state: OntologyStoreState = rawState ?? {
    initState: 'loading', initting: false, activeTemplateId: 'ontology-lv1', patterns: [], patternsLoading: false,
    objectTypes: [], objects: [], linkTypes: [], links: [], actions: [],
    introspections: [], insights: [],
    activeTab: 'graph', drawerOpen: false, drawerTab: 'templates',
    insightsOpen: false, search: '', aiTopic: '', isGenerating: false,
    draftPayload: null, draftJsonStr: '', error: null, pendingCommand: null,
    stats: { objectTypes: 0, objects: 0, linkTypes: 0, links: 0, actions: 0, introspections: 0, insights: 0 },
    mapping: {
      objectTable: 'life_object',
      objectTypeTable: 'life_object_type',
      linkTable: 'life_link',
      linkTypeTable: 'life_link_type',
      actionTable: 'life_action',
      introspectionTable: 'life_introspection',
      insightTable: 'life_insight',
      objectFields: {},
      linkFields: {},
    },
    canvasActiveLayer: 'foundation',
    canvasAiFillLoading: false,
    canvasSnapshots: [],
    canvasPositions: {},
    canvasLockedNodeIds: new Set<number>(),
  };

  const [aiInput, setAiInput] = useState('');
  const { activeTab, drawerOpen, drawerTab } = state;

  // ============================================================
  // 视图同步 Hook - 确保 D3GraphView 和 OntologyCanvas 布局同步
  // ============================================================
  const { 
    syncState, 
    pushLayout, 
    pullLayout, 
    forceSync,
    getCachedLayout,
    resetSync
  } = useGraphViewSync({
    enabled: true,
    syncDelay: 150,
    syncOnTabChange: true,
  });

  // D3GraphView 刷新引用和布局应用引用
  const d3GraphRefreshRef = useRef<(() => void) | null>(null);
  const d3ApplyLayoutRef = useRef<((layout: LayoutInfo) => void) | null>(null);
  
  // 记录上一次活跃的 tab，用于检测切换
  const lastActiveTabRef = useRef<ViewTab>(activeTab);

  // 当布局变化时，推送到全局存储
  const handleLayoutChange = useCallback((layout: LayoutInfo) => {
    pushLayout(layout);
  }, [pushLayout]);

  // 渲染模式切换回调: D3GraphView 顶部"渲染模式"下拉菜单点击后触发,
  // 将 KnowledgeGraphRenderMode 映射回 ViewTab 并 dispatch activeTab。
  // 视图状态(节点位置、缩放、选择、过滤)由 useGraphViewSync/layoutEventBus 自动保持。
  const handleRenderModeChange = useCallback((mode: KnowledgeGraphRenderMode) => {
    if (mode === activeTab) return;
    dispatch(ontologyActions.setActiveTab(mode));
    console.log('[OntologyPanel] Render mode switch → activeTab =', mode);
  }, [activeTab, dispatch]);

  // 视图切换时同步布局
  useEffect(() => {
    // 检测 tab 变化
    if (lastActiveTabRef.current === activeTab) return;
    
    const previousTab = lastActiveTabRef.current;
    lastActiveTabRef.current = activeTab;
    
    // Graph -> Canvas: cancel pending D3 pushLayout so debounced force-coords
    // cannot overwrite the canvas first-entry layout a moment later.
    if (previousTab === 'graph' && activeTab === 'canvas') {
      resetSync();
      const cachedLayout = getCachedLayout();
      if (cachedLayout?.nodePositions) {
        // Inform any legacy listeners; OntologyCanvas does its own first-entry layout.
        layoutEventBus.publish(cachedLayout);
        console.log('[OntologyPanel] Graph -> Canvas: 同步布局', Object.keys(cachedLayout.nodePositions).length, '个节点');
      }
    }
    
    // Canvas -> Graph: 刷新图谱视图
    if (previousTab === 'canvas' && activeTab === 'graph') {
      // 延迟刷新以确保组件已挂载
      setTimeout(() => {
        d3GraphRefreshRef.current?.();
        console.log('[OntologyPanel] Canvas -> Graph: 刷新图谱视图');
      }, 100);
    }
  }, [activeTab, getCachedLayout, resetSync]);

  // ============================================================
  // 视图性能统计显示状态
  // ============================================================
  const [layoutStatsVisible, setLayoutStatsVisible] = useState(false);

  // New states for the Inspector architecture
  const [inspectorMode, setInspectorMode] = useState<EditMode>('none');
  const [inspectorTarget, setInspectorTarget] = useState<any>(null);
  const { confirm } = useConfirmDialog();
  const [modelingWizardOpen, setModelingWizardOpen] = useState(false);
  const [reasoningCatalogOpen, setReasoningCatalogOpen] = useState(false);
  const [deductionWorkbenchOpen, setDeductionWorkbenchOpen] = useState(false);
  const [reseedMessage, setReseedMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? 1440 : window.innerWidth,
  );
  const drawerPreferenceReady = useRef(false);
  const drawerMode = resolveOntologyDrawerMode(viewportWidth);

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const preferredOpen = window.localStorage.getItem(ONTOLOGY_DRAWER_PREFERENCE_KEY) === 'true';
    if (preferredOpen && !state.drawerOpen) dispatch(ontologyActions.toggleDrawer());
    drawerPreferenceReady.current = true;
  }, []);

  useEffect(() => {
    if (!drawerPreferenceReady.current) return;
    window.localStorage.setItem(ONTOLOGY_DRAWER_PREFERENCE_KEY, String(state.drawerOpen));
  }, [state.drawerOpen]);

  // Sidebar toggle changes center width in inline mode — re-fit the graph so it doesn't look "gone".
  useEffect(() => {
    if (activeTab !== 'graph') return;
    const timer = window.setTimeout(() => {
      (window as any).__d3FitAll?.();
    }, 80);
    return () => window.clearTimeout(timer);
  }, [drawerOpen, activeTab]);

  useEffect(() => {
    const command = state.pendingCommand;
    if (!command) return;

    const plan = planOntologyCommand(command);
    setPendingCommand(null);

    if (plan.view) {
      dispatch(ontologyActions.setActiveTab(plan.view));
    }
    if (plan.drawer) {
      dispatch(ontologyActions.setDrawerTab(plan.drawer));
    }
    if (plan.ensureDrawerOpen && !state.drawerOpen) {
      dispatch(ontologyActions.toggleDrawer());
    }
    if (plan.inspectorMode) {
      setInspectorTarget(null);
      setInspectorMode(plan.inspectorMode);
    }

    if (plan.operation) {
      const operation = plan.operation === 'init'
        ? initOntology
        : plan.operation === 'reseed'
          ? reseedOntology
          : refresh;
      void Promise.resolve(operation()).catch((error) => {
        console.error(`Ontology ${plan.operation} command failed`, error);
      });
    }
  }, [
    dispatch,
    initOntology,
    refresh,
    reseedOntology,
    setPendingCommand,
    state.drawerOpen,
    state.pendingCommand,
  ]);

  const handleReseedSupplement = useCallback(async () => {
    setReseedMessage(null);
    try {
      await reseedOntology();
      setReseedMessage({ text: '数据补充成功', type: 'success' });
      setTimeout(() => setReseedMessage(null), 3000);
      refresh();
    } catch (e: any) {
      setReseedMessage({ text: '补充失败: ' + e.message, type: 'error' });
    }
  }, [reseedOntology, refresh]);

  const handleModelingImport = useCallback(async (result: any) => {
    if (result.graphLayout) {
      (window as any).__ontologyGraphLayout = result.graphLayout;
    }
    await batchImportModelingResult(result);
  }, [batchImportModelingResult]);

  const handleGraphSaved = useCallback(() => {
    d3GraphRefreshRef.current?.();
  }, []);

  const handleDeleteEntity = useCallback(async (type: string, id: number, label: string) => {
    const ok = await confirm({
      title: '破坏性操作确认',
      message: `确定要销毁「${label}」吗？此操作将永久修改知识图谱库数据。`,
      variant: 'danger',
      confirmText: '确认销毁',
      cancelText: '取消',
    });
    if (!ok) return;
    try {
      if (type === 'objectType') await deleteObjectType(id);
      else if (type === 'object') await deleteObject(id);
      else if (type === 'linkType') await deleteLinkType(id);
      else if (type === 'link') await deleteLink(id);
      else if (type === 'action') await deleteAction(id);
      else if (type === 'introspection') await deleteIntrospection(id);
      else if (type === 'insight') await deleteInsight(id);
      setInspectorMode('none');
      await refresh();
    } catch (e: any) {
      console.error('销毁失败:', e.message);
    }
  }, [confirm, deleteObjectType, deleteObject, deleteLinkType, deleteLink, deleteAction, deleteIntrospection, deleteInsight, refresh]);

  const openInspector = (mode: EditMode, target: any) => {
    setInspectorMode(mode);
    setInspectorTarget(target);
    dispatch(ontologyActions.setDrawerTab('crud')); // Snap to CRUD layer if editing
  };

  const openSimulationLab = () => {
    setDeductionWorkbenchOpen(true);
  };

  const DRAWER_TABS: { id: DrawerTab; label: string; icon: React.ElementType; sub?: string }[] = [
    { id: 'templates', label: '本体教程', icon: GraduationCap, sub: '14 课建模实战路线' },
    { id: 'crud',     label: '实体库', icon: List, sub: 'Schema · Node · Edge' },
    { id: 'mapping',  label: '物理映射', icon: Map, sub: 'DuckDB 物理表 ↔ 本体' },
    { id: 'deduction', label: '多跳推演', icon: Workflow, sub: '拓扑链路与语义推演' },
  ];

  return (
    <div className="h-full w-full flex flex-col bg-monokai-bg overflow-hidden text-monokai-fg font-sans">
      {/* ── Top Master Header ── */}
      <div className="min-h-13 px-5 py-2.5 flex items-center justify-between border-b border-monokai-border bg-monokai-sidebar shrink-0 z-20 relative backdrop-blur-md">
        
        {/* Branding & Global Drawer Toggle */}
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            aria-label={drawerOpen ? "收起本体侧栏" : "展开本体侧栏"}
            aria-expanded={drawerOpen}
            aria-controls="ontology-tool-drawer"
            onClick={() => dispatch(ontologyActions.toggleDrawer())}
            className="h-9 w-9 flex items-center justify-center rounded-lg border border-monokai-border bg-monokai-surface text-monokai-comment hover:text-monokai-fg hover:bg-monokai-border/40 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monokai-accent cursor-pointer active:scale-95"
          >
            {drawerOpen ? <AlignLeft className="w-4.5 h-4.5 text-monokai-cyan" /> : <ChevronRight className="w-4.5 h-4.5 text-monokai-comment" />}
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-monokai-cyan/15 border border-monokai-cyan/30 flex items-center justify-center text-monokai-cyan font-bold text-xs shadow-xs">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-sm text-monokai-fg tracking-tight">本体知识空间 (Ontology Studio)</span>
            </div>
          </div>
        </div>

        {/* View Switcher (知识图谱 / 数据视图 / 实体画布) */}
        <SegmentedTabs<ViewTab>
          value={activeTab}
          items={VIEW_TABS}
          onChange={(tab) => dispatch(ontologyActions.setActiveTab(tab))}
          aria-label="本体视图切换"
          tone="accent"
          size="md"
        />

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <ActionButton
            variant="secondary"
            size="md"
            icon={Wand2}
            onClick={() => setModelingWizardOpen(true)}
          >
            本体建模
          </ActionButton>

          <ActionButton
            variant="secondary"
            size="md"
            icon={FlaskConical}
            onClick={openSimulationLab}
          >
            组合推演
          </ActionButton>

          <ActionButton
            variant="secondary"
            size="md"
            icon={Brain}
            onClick={() => setReasoningCatalogOpen(true)}
          >
            推演定义
          </ActionButton>

          <ActionButton
            variant={state.insightsOpen ? "warning" : "secondary"}
            size="md"
            icon={Lightbulb}
            onClick={() => { setInspectorMode("none"); dispatch(ontologyActions.toggleInsights()); }}
          >
            聚合洞察
          </ActionButton>
        </div>
      </div>

      {/* ── Sub Header / Status Bar ── */}
      <div className="h-9 px-5 flex items-center justify-between bg-monokai-surface/60 border-b border-monokai-border shrink-0">
        <div className="flex items-center gap-4 text-xs text-monokai-comment font-mono">
          {state.initState === 'loading' ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-monokai-cyan" />
              <span className="text-monokai-cyan">加载中...</span>
            </span>
          ) : state.initState === 'no-tables' ? (
            <span className="flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-monokai-comment" />
              <span className="text-monokai-yellow">本体论未初始化</span>
              <button
                type="button"
                onClick={() => void initOntology()}
                disabled={state.initting}
                className="rounded border border-monokai-green/40 bg-monokai-green/15 px-2.5 py-0.5 text-xs font-bold text-monokai-green hover:bg-monokai-green/25 disabled:opacity-50 cursor-pointer"
              >
                {state.initting ? '初始化中...' : state.error ? '重试初始化' : '一键初始化'}
              </button>
            </span>
          ) : (
            <>
              <span>实体: <strong className="text-monokai-cyan font-bold">{state.objects?.length ?? 0}</strong></span>
              <span>关系: <strong className="text-monokai-fg font-bold">{state.links?.length ?? 0}</strong></span>
              <span>概念模式: <strong className="text-monokai-yellow font-bold">{state.objectTypes?.length ?? 0}</strong></span>
              <span>关系类型: <strong className="text-monokai-green font-bold">{state.linkTypes?.length ?? 0}</strong></span>
              <span>行动规则: <strong className="text-monokai-orange font-bold">{state.actions?.length ?? 0}</strong></span>
              {state.introspections?.length > 0 && (
                <span>反思记录: <strong className="text-monokai-cyan font-bold">{state.introspections.length}</strong></span>
              )}
              {state.insights?.length > 0 && (
                <span>洞察结论: <strong className="text-monokai-yellow font-bold">{state.insights.length}</strong></span>
              )}
            </>
          )}
        </div>
        {/* Right side: refresh + reseed */}
        <div className="flex items-center gap-3">
          <button onClick={() => refresh()} title="刷新图谱数据" aria-label="刷新图谱数据"
            className="p-1.5 rounded-lg text-monokai-comment hover:text-monokai-cyan hover:bg-monokai-surface transition-colors cursor-pointer">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          {state.initState === 'ready' && (
            <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
              <button onClick={handleReseedSupplement} disabled={state.initting} title="补充缺失的实体数据"
                className="shrink-0 whitespace-nowrap px-2.5 py-1 rounded-lg text-xs bg-monokai-surface text-monokai-cyan border border-monokai-border hover:bg-monokai-border/40 transition-colors disabled:opacity-50 cursor-pointer">
                {state.initting ? '写入中...' : '补充数据'}
              </button>
              {reseedMessage && (
                <span className={`shrink-0 text-xs font-mono ${reseedMessage.type === 'success' ? 'text-monokai-green' : 'text-monokai-pink'}`}>
                  {reseedMessage.text}
                </span>
              )}
              <QuickClearMenu onClear={refresh} />
            </div>
          )}
        </div>
      </div>

      {/* ── Main Workspace ── */}
      <div className="flex-1 min-h-0 h-full overflow-hidden relative">
        <ResizableLayout
          leftInitialWidth={440}
          rightInitialWidth={380}
          minWidth={360}
          maxLeftRatio={0.50}
          maxRightRatio={0.40}
          storagePrefix="ontology-drawer-layout"
          className="w-full h-full"
        >
          {({ leftWidth, rightWidth, setLeftWidth, startResizingLeft, startResizingRight }) => (
            <div className="flex h-full w-full min-h-0 overflow-hidden">
              
              {/* LEFT NAV PANEL — inline push on workbench; overlay only on very narrow viewports.
                  Never use a full-bleed dimmer: it made the graph look like it was toggled off. */}
              {drawerOpen && drawerMode === 'overlay' && (
                <button
                  type="button"
                  aria-label="关闭本体侧栏"
                  onClick={() => dispatch(ontologyActions.toggleDrawer())}
                  className="absolute inset-y-0 right-0 z-20 bg-transparent"
                  style={{ left: Math.min(leftWidth, Math.max(0, viewportWidth - 32)) }}
                />
              )}
              {drawerOpen && (
                <aside
                  id="ontology-tool-drawer"
                  aria-label="本体工具侧栏"
                  style={{ width: drawerMode === 'overlay' ? Math.min(leftWidth, viewportWidth - 32) : leftWidth }}
                  className={`${drawerMode === 'overlay' ? 'absolute inset-y-0 left-0 z-30 shadow-2xl' : 'relative z-10 flex-shrink-0'} flex flex-col h-full min-h-0 overflow-hidden border-r border-white/10 bg-monokai-bg`}
                >
                  {/* Resizer Handle Left */}
                  <div onMouseDown={startResizingLeft} onTouchStart={startResizingLeft}
                    aria-hidden={drawerMode === 'overlay'}
                    className={`${drawerMode === 'overlay' ? 'hidden' : ''} absolute right-0 top-0 w-[5px] h-full cursor-col-resize hover:bg-monokai-cyan transition-colors z-20 group`}>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-monokai-sidebar border border-monokai-cyan/50 p-0.5 rounded shadow"><GripVertical className="w-3.5 h-3.5 text-monokai-cyan" /></div>
                  </div>

                  {/* Drawer Control Header with Width Presets & Collapse */}
                  <div className="h-8 px-2.5 flex items-center justify-between border-b border-white/5 bg-monokai-sidebar/40 shrink-0 select-none">
                    <div className="flex items-center gap-1.5 text-[11px] text-monokai-comment font-medium">
                      <Layers className="w-3 h-3 text-monokai-cyan" />
                      <span>控制仓</span>
                      <span className="text-[10px] font-mono text-monokai-comment/60">({Math.round(leftWidth)}px)</span>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Width preset toggles */}
                      {drawerMode !== 'overlay' && setLeftWidth && (
                        <div className="flex items-center gap-0.5 bg-monokai-bg rounded p-0.5 border border-white/5 text-[10px] font-mono">
                          <button
                            type="button"
                            onClick={() => setLeftWidth(360)}
                            title="紧凑宽度 (360px)"
                            className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${leftWidth <= 380 ? 'bg-monokai-cyan/20 text-monokai-cyan font-bold' : 'text-monokai-comment hover:text-white'}`}
                          >
                            紧凑
                          </button>
                          <button
                            type="button"
                            onClick={() => setLeftWidth(440)}
                            title="标准宽度 (440px)"
                            className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${leftWidth > 380 && leftWidth <= 480 ? 'bg-monokai-cyan/20 text-monokai-cyan font-bold' : 'text-monokai-comment hover:text-white'}`}
                          >
                            标准
                          </button>
                          <button
                            type="button"
                            onClick={() => setLeftWidth(580)}
                            title="宽屏宽视 (580px)"
                            className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${leftWidth > 480 ? 'bg-monokai-cyan/20 text-monokai-cyan font-bold' : 'text-monokai-comment hover:text-white'}`}
                          >
                            宽屏
                          </button>
                        </div>
                      )}

                      {/* Quick collapse button */}
                      <button
                        type="button"
                        onClick={() => dispatch(ontologyActions.toggleDrawer())}
                        title="收起本体侧栏"
                        className="p-1 rounded hover:bg-white/5 text-monokai-comment hover:text-white transition-colors cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center pt-1.5 px-2 pb-1 shrink-0 relative gap-1 border-b border-white/5 bg-monokai-surface/30">
                    {DRAWER_TABS.map(tab => {
                      const Icon = tab.icon;
                      const isActive = drawerTab === tab.id;
                      return (
                        <button key={tab.id} onClick={() => dispatch(ontologyActions.setDrawerTab(tab.id))}
                          title={tab.sub}
                          className={`flex-1 flex flex-row items-center justify-center gap-1.5 py-1.5 px-1.5 rounded-lg text-xs transition-all relative cursor-pointer ${
                            isActive
                              ? 'bg-monokai-cyan/15 text-monokai-cyan font-semibold border border-monokai-cyan/30 shadow-xs'
                              : 'text-monokai-comment hover:text-white hover:bg-monokai-surface/80'
                          }`}>
                          <Icon className={`w-3.5 h-3.5 shrink-0 transition-transform ${isActive ? 'scale-105 text-monokai-cyan' : ''}`} />
                          <span className="tracking-tight leading-none text-xs truncate">{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                    {drawerTab === 'templates' && (
                      <PatternLibraryPanel
                        state={state}
                        activeTemplateId={activeTemplateId}
                        switchTemplate={switchTemplate}
                        onTablesReady={onTablesReady}
                      />
                    )}
                    {drawerTab === 'crud' && (
                      <CRUDList
                        onInspect={openInspector}
                        onRequestDelete={handleDeleteEntity}
                        activeEntity={inspectorTarget && inspectorMode !== 'none' ? { mode: inspectorMode, id: inspectorTarget.id } : null}
                      />
                    )}
                    {drawerTab === 'mapping' && (
                      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                        <MappingConsole />
                      </div>
                    )}
                    {drawerTab === 'deduction' && (
                      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                        <MultiHopDeductionExplorer
                          onInsert={onInsert}
                          onOpenWorkbench={openSimulationLab}
                          onInspectNode={(node) => openInspector('object', node)}
                        />
                      </div>
                    )}
                  </div>
                </aside>
              )}

              {/* CENTER CANVAS */}
              <div className="flex-1 h-full min-h-0 relative overflow-hidden bg-monokai-bg">
                {activeTab === 'graph' && (
                  <D3GraphView 
                    onRefreshRef={fn => d3GraphRefreshRef.current = fn} 
                    ontologyState={state} 
                    isActive={isActive} 
                    onInspect={openInspector}
                    onLayoutChange={handleLayoutChange}
                  />
                )}
                {activeTab === 'data' && <OntologyDataView ontologyState={state} />}
                {activeTab === 'canvas' && <OntologyCanvas onInsert={onInsert} ontologyState={state} onInspect={openInspector} />}
              </div>

              {drawerMode === 'overlay' && (inspectorMode !== 'none' || state.insightsOpen) && (
                <button
                  type="button"
                  aria-label="关闭右侧详情面板"
                  className="absolute inset-0 z-30 bg-black/45 backdrop-blur-[1px] cursor-default"
                  onClick={() => {
                    setInspectorMode('none');
                    if (state.insightsOpen) dispatch(ontologyActions.toggleInsights());
                  }}
                />
              )}

              {/* RIGHT SIMULATION LAB — independent from the left tutorial drawer */}
              {/* RIGHT INSPECTOR PANEL */}
              {inspectorMode !== 'none' && (
                <div style={{ width: rightWidth }} className="ontology-right-panel flex-shrink-0 flex flex-col h-full min-h-0 overflow-hidden border-l border-monokai-border z-20 relative bg-monokai-sidebar shadow-md">
                   {/* Resizer Handle Right */}
                  <div onMouseDown={startResizingRight} onTouchStart={startResizingRight}
                    className="absolute left-0 top-0 w-[4px] h-full cursor-col-resize hover:bg-monokai-cyan transition-colors z-20 group">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"><GripVertical className="w-4 h-4 text-monokai-cyan" /></div>
                  </div>
                  <RightInspector key={`inspector-${inspectorMode}-${inspectorTarget?.id ?? 'new'}`} mode={inspectorMode} target={inspectorTarget} onClose={() => setInspectorMode('none')} onSave={handleGraphSaved} onInspect={openInspector} />
                </div>
              )}

              {/* INSIGHTS PANEL (Alternative Right Pane) */}
              {state.insightsOpen && inspectorMode === 'none' && (
                <div style={{ width: rightWidth }} className="ontology-right-panel flex-shrink-0 flex flex-col h-full min-h-0 overflow-hidden bg-monokai-sidebar border-l border-monokai-border shadow-md z-20 relative">
                   {/* Resizer Handle Right for Insights */}
                  <div onMouseDown={startResizingRight} onTouchStart={startResizingRight}
                    className="absolute left-0 top-0 w-[4px] h-full cursor-col-resize hover:bg-monokai-cyan transition-colors z-20 group">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"><GripVertical className="w-4 h-4 text-monokai-cyan" /></div>
                  </div>
                  <OntologyInsightsPanel objects={state.objects} objectTypes={state.objectTypes} links={state.links} linkTypes={state.linkTypes} />
                </div>
              )}
            </div>
          )}
        </ResizableLayout>
      </div>

      {/* AI Draft Global Alert */}
      {state.draftPayload && (
        <AIDraftModal
          payload={state.draftPayload}
          jsonStr={state.draftJsonStr}
          mapping={state.mapping}
          onCommit={async () => {
             // If payload contains mapping, apply it before refresh
             const mapping = (state.draftPayload as any)?.mapping;
             if (mapping) {
               dispatch({ type: 'UPDATE_MAPPING', mapping });
             }
             await refresh();
             dispatch(ontologyActions.clearDraft());
          }}
          onCancel={() => dispatch(ontologyActions.clearDraft())}
        />
      )}

      {/* AI Modeling Wizard */}
      {modelingWizardOpen && (
        <OntologyModelingWizard
          onClose={() => setModelingWizardOpen(false)}
          onImport={handleModelingImport}
        />
      )}
      {reasoningCatalogOpen && (
        <OntologyReasoningCatalogEditor source={{ ...state, activeTemplateId }} onClose={() => setReasoningCatalogOpen(false)} />
      )}
      {deductionWorkbenchOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 p-6 backdrop-blur-sm">
          <DeductionWorkbench isOpen onClose={() => setDeductionWorkbenchOpen(false)} />
        </div>
      )}
    </div>
  );
};

export const OntologyPanel: React.FC<{
  onInsert?: (sql: string) => void;
  onTablesReady?: () => void;
  isActive?: boolean;
}> = (props) => {
  return React.createElement(
    ConfirmDialogProvider,
    null,
    React.createElement(OntologyPanelContent, props),
  );
};

export default OntologyPanel;
