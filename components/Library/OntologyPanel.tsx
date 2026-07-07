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
  Lightbulb, Zap, PanelRightDashed, AlignLeft, GripVertical,
  List, Map, BarChart2, Pencil, Download, Upload, Brain, Wand2
} from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { sql as sqlLang } from '@codemirror/lang-sql';
import { EditorView } from '@codemirror/view';
import { monokai } from '@uiw/codemirror-theme-monokai';

import { useOntologyStore, ontologyActions, ONTOLOGY_SEED_INFOS, OntologyStoreProvider } from '../../hooks/useOntologyStore';
import { ontologyAiService } from '../../services/ontologyAiService';
import {
  ONTOLOGY_TEMPLATE_CATEGORIES,
  TEMPLATE_CATEGORY_ORDER,
} from '../../data/ontologyTemplates';
import D3GraphView from './D3GraphView';
import OntologyCanvas from './OntologyCanvas';
import OntologyInsightsPanel from './OntologyInsightsPanel';
import { OntologyDataView } from './OntologyDataView';
import { OntologyModelingWizard } from './OntologyModelingWizard';
import { duckDBService } from '../../services/duckdbService';
import { ResultTable } from '../Learn/ResultTable';
import { ResizableLayout } from '../ui/ResizableLayout';
import { MappingConsole } from './MappingConsole';
import { QuickClearMenu } from './QuickClearMenu';

// ============================================================
// Types
// ============================================================

type ViewTab = 'graph' | 'data' | 'canvas';
type DrawerTab = 'templates' | 'crud' | 'insights' | 'mapping';

interface ExecutionResult {
  data: any[] | null;
  error: string | null;
  loading: boolean;
  executionTime?: number;
}

type EditMode = 'none' | 'objectType' | 'object' | 'linkType' | 'link' | 'action';

interface FormState {
  name: string; desc: string; objectTypeId: number; properties: string;
  linkTypeId: number; sourceId: number | null; targetId: number | null;
  weight: number; status: string; executeAt: string;
}

// ============================================================
// Live Clock
// ============================================================

const LiveClock: React.FC = () => {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return <span className="text-monokai-fg font-mono text-xs tabular-nums">{time}</span>;
};

// ============================================================
// View Tabs Configuration
// ============================================================

const VIEW_TABS: { id: ViewTab; label: string; icon: React.ElementType }[] = [
  { id: 'graph', label: '知识图谱', icon: Network },
  { id: 'data',  label: '数据视图', icon: Database },
  { id: 'canvas', label: '实体画布', icon: LayoutGrid },
];

// ============================================================
// AIDraftModal
// ============================================================

const AIDraftModal: React.FC<{
  payload: any;
  jsonStr: string;
  onCommit: () => void;
  onCancel: () => void;
}> = ({ payload, jsonStr, onCommit, onCancel }) => {
  const [committing, setCommitting] = useState(false);

  const handleCommit = async () => {
    setCommitting(true);
    try {
      await duckDBService.executeOntologyDraft(payload);
      onCommit();
    } catch (e: any) {
      alert(`提交失败: ${e.message}`);
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-[720px] max-h-[85vh] bg-monokai-bg border border-monokai-accent/20 rounded-2xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-monokai-accent/10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-monokai-purple/15 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-monokai-purple" />
            </div>
            <div>
              <h3 className="text-base font-bold text-monokai-fg">AI 生成预览</h3>
              <p className="text-xs text-monokai-comment mt-1">请审核并确认即将注入图谱的新知数据</p>
            </div>
          </div>
          <button onClick={onCancel} className="p-2 rounded-xl hover:bg-monokai-accent/10 text-monokai-comment hover:text-monokai-fg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 border-b border-monokai-accent/10 bg-monokai-sidebar/30 flex items-center gap-6 text-sm">
          {payload.objects?.length > 0 && <span className="text-monokai-blue flex items-center gap-2"><Table2 className="w-4 h-4" /> 对象 × {payload.objects.length}</span>}
          {payload.links?.length > 0 && <span className="text-monokai-purple flex items-center gap-2"><Link2 className="w-4 h-4" /> 关系 × {payload.links.length}</span>}
          {payload.actions?.length > 0 && <span className="text-monokai-yellow flex items-center gap-2"><Zap className="w-4 h-4" /> 行动 × {payload.actions.length}</span>}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <CodeMirror
            value={jsonStr}
            height="400px"
            theme={monokai}
            extensions={[sqlLang(), EditorView.lineWrapping, EditorView.theme({ "&": { fontSize: "14px" } })]}
            editable={false}
            basicSetup={false}
          />
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-monokai-accent/10">
          <button onClick={onCancel} className="px-5 py-2.5 text-sm rounded-xl text-monokai-comment hover:text-monokai-fg hover:bg-monokai-accent/10 transition-colors">
            取消
          </button>
          <button onClick={handleCommit} disabled={committing} className="flex items-center gap-2 px-5 py-2.5 text-sm rounded-xl bg-monokai-purple/20 text-monokai-purple hover:bg-monokai-purple/30 transition-colors disabled:opacity-50 font-medium">
            {committing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            确认并注入
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// Template Panel (Left Pane Content)
// ============================================================

const CATEGORY_ACCENT: Record<string, string> = {
  setup:  'from-monokai-purple/30 via-monokai-purple/10 to-transparent',
  query:  'from-monokai-cyan/30 via-monokai-cyan/10 to-transparent',
  modify: 'from-monokai-yellow/30 via-monokai-yellow/10 to-transparent',
  export: 'from-monokai-green/30 via-monokai-green/10 to-transparent',
  industry: 'from-monokai-purple/30 via-monokai-purple/10 to-transparent',
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  setup:  Database,
  query:  BarChart2,
  modify:  Pencil,
  export:  Download,
  industry: Sparkles,
};

const CATEGORY_COLORS: Record<string, string> = {
  setup: 'text-monokai-purple', query: 'text-monokai-cyan',
  modify: 'text-monokai-yellow', export: 'text-monokai-green',
  industry: 'text-monokai-purple',
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
    <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-monokai-yellow/12 text-monokai-yellow border border-monokai-yellow/20 font-medium">
      <Loader2 className="w-2.5 h-2.5 animate-spin" /> 运行中
    </span>
  );
  if (result?.error) return (
    <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-monokai-red/10 text-monokai-red border border-monokai-red/20 font-medium">
      <span className="w-1 h-1 rounded-full bg-monokai-red inline-block" /> 失败
    </span>
  );
  if (result?.data !== undefined) return (
    <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-monokai-green/10 text-monokai-green border border-monokai-green/20 font-medium">
      <span className="w-1 h-1 rounded-full bg-monokai-green inline-block" />
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
          ? 'border-monokai-green/25 bg-monokai-green/[0.03] hover:border-monokai-green/40'
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
          ? 'bg-monokai-purple'
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
              <span className={`${expanded ? 'text-[11px]' : 'text-xs'} font-medium leading-tight ${isFirst && !hasError && !hasData ? 'text-monokai-purple' : 'text-monokai-fg'}`}>
                {tpl.label}
              </span>
              <StatusBadge result={result} />
            </div>
            {/* Description */}
            <p className={`${expanded ? 'text-[10px]' : 'text-[11px]'} text-monokai-comment/60 leading-normal mt-0.5 pr-2 line-clamp-2`}>
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
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${execBtnClass}`}>
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
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium bg-monokai-blue/10 text-monokai-blue border border-monokai-blue/20 hover:bg-monokai-blue/20 transition-all">
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
const TemplatePanel: React.FC<{
  state: any;
  onInsert?: (sql: string) => void;
  onTablesReady?: () => void;
  refresh: () => Promise<void>;
  activeTemplateId: string;
  switchTemplate: (templateId: string) => Promise<void>;
}> = ({ state, onInsert, onTablesReady, refresh, activeTemplateId, switchTemplate }) => {
  // All categories collapsed by default for clean first impression
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Record<string, ExecutionResult>>({});

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleExecute = useCallback(async (id: string, sql: string, refreshTables?: boolean) => {
    setResults(prev => ({ ...prev, [id]: { data: null, error: null, loading: true } }));
    const start = performance.now();
    try {
      const res = await duckDBService.query(sql);
      if (refreshTables) {
        await refresh();
      }
      setResults(prev => ({ ...prev, [id]: { data: res, error: null, loading: false, executionTime: performance.now() - start } }));
      onTablesReady?.();
    } catch (e: any) {
      setResults(prev => ({ ...prev, [id]: { data: null, error: e.message, loading: false } }));
    }
  }, [onTablesReady, refresh]);

  const isNoTables = state?.initState === 'no-tables';

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-4">
      {/* ── Template Switcher ── */}
      <div className="mb-4 p-2 rounded-xl bg-monokai-sidebar/20 border border-monokai-accent/5 space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] font-bold text-monokai-comment uppercase tracking-wider">切换本体种子</span>
          <span className="text-[9px] text-monokai-cyan font-mono bg-monokai-cyan/10 px-1.5 py-0.5 rounded border border-monokai-cyan/20">
            {ONTOLOGY_SEED_INFOS.find(s => s.id === activeTemplateId)?.category || 'Personal'}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-1.5 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
          {ONTOLOGY_SEED_INFOS.map(seed => {
            const isActive = seed.id === activeTemplateId;
            return (
              <button
                key={seed.id}
                onClick={() => {
                  switchTemplate(seed.id);
                }}
                disabled={state.initting}
                className={`flex items-start gap-2 p-1.5 rounded-lg border text-left transition-all relative ${
                  isActive
                    ? 'border-monokai-cyan/40 bg-monokai-cyan/5 text-monokai-fg shadow-sm'
                    : 'border-monokai-border/40 bg-monokai-sidebar/10 text-monokai-comment hover:border-monokai-border/80 hover:bg-monokai-sidebar/30'
                }`}
              >
                <span className="text-sm shrink-0 mt-0.5">{seed.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold truncate ${isActive ? 'text-monokai-cyan' : 'text-monokai-fg'}`}>
                      {seed.name}
                    </span>
                    {isActive && (
                      <span className="text-[8px] bg-monokai-cyan/20 text-monokai-cyan px-1 rounded font-mono uppercase font-bold shrink-0">
                        当前
                      </span>
                    )}
                  </div>
                  <p className="text-[9px] text-monokai-comment/70 mt-0.5 leading-normal line-clamp-1">
                    {seed.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Init Banner ── */}
      {isNoTables && (
        <div className="mb-3 p-3 rounded-lg border border-monokai-purple/30 overflow-hidden relative template-init-banner">
          <div className="flex items-start gap-2.5 pl-0.5">
            {/* Icon block */}
            <div className="shrink-0 mt-0.5">
              <div className="w-8 h-8 rounded-lg bg-monokai-purple/15 border border-monokai-purple/20 flex items-center justify-center">
                <Database className="w-4 h-4 text-monokai-purple" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              {/* Title row */}
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-semibold text-monokai-fg">知识图谱尚未初始化</h3>
                <span className="init-badge bg-monokai-orange/10 text-monokai-orange border border-monokai-orange/20 font-mono">
                  0 表
                </span>
              </div>
              {/* Subtitle */}
              <p className="text-xs text-monokai-comment/70 mb-2.5">
                一键创建 7 张本体论表，导入教学种子数据
              </p>
              {/* CTA */}
              <button
                onClick={() => handleExecute('init-full', ONTOLOGY_TEMPLATE_CATEGORIES.setup.templates[0].sql, true)}
                className="group inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg
                  bg-monokai-purple text-white
                  hover:bg-monokai-purple/90 hover:shadow-[0_0_20px_rgba(174,129,255,0.4)]
                  transition-all duration-200 active:scale-[0.97]">
                <Zap className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                一键完整初始化
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Category Cards ── */}
      {TEMPLATE_CATEGORY_ORDER.map(catId => {
        const cat = ONTOLOGY_TEMPLATE_CATEGORIES[catId];
        if (!cat) return null;
        const isExpanded = expandedCategories.has(catId);
        const colorClass = CATEGORY_COLORS[catId] || 'text-monokai-comment';
        const accentClass = CATEGORY_ACCENT[catId] || '';
        const Icon = CATEGORY_ICONS[catId] || Layers;
        const catBgClass = catId === 'setup' ? 'template-cat-setup'
          : catId === 'query' ? 'template-cat-query'
          : catId === 'modify' ? 'template-cat-modify'
          : catId === 'export' ? 'template-cat-export'
          : '';

        return (
          <div key={catId} className={`rounded-xl border border-monokai-border/50 overflow-hidden bg-monokai-surface hover:border-monokai-accent/30 transition-all shadow-sm ${catBgClass}`}>
            <div className="p-3">
              {/* Category header */}
              <div className="flex items-center justify-between cursor-pointer group" onClick={() => toggleCategory(catId)}>
                <div className="flex items-center gap-2">
                  <div className={`w-1 h-4 rounded-full bg-current ${colorClass} opacity-80`} />
                  <Icon className={`w-4 h-4 ${colorClass} shrink-0`} />
                  <span className={`text-xs font-bold uppercase tracking-wider ${colorClass}`}>{cat.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="template-category-badge">{cat.templates.length}</span>
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-monokai-comment" /> : <ChevronRight className="w-4 h-4 text-monokai-comment" />}
                </div>
              </div>

              {/* Separator between header and template list */}
              {isExpanded && (
                <div className={`mt-2.5 mb-2 h-px bg-gradient-to-r ${accentClass}`} />
              )}

              {/* Template cards list */}
              {isExpanded && (
                <div className="space-y-2">
                  {cat.templates.map(tpl => (
                    <TemplateCard
                      key={tpl.id}
                      tpl={tpl}
                      result={results[tpl.id]}
                      categoryColor={colorClass}
                      accentClass={accentClass}
                      onExecute={handleExecute}
                      onInsert={onInsert}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
      {/* ── Empty State ── */}
      {TEMPLATE_CATEGORY_ORDER.every(catId => {
        const cat = ONTOLOGY_TEMPLATE_CATEGORIES[catId];
        return !cat || cat.templates.length === 0;
      }) && (
        <div className="text-center py-10 px-4">
          <Database className="w-10 h-10 text-monokai-comment/25 mx-auto mb-3" />
          <p className="text-sm text-monokai-comment/60 font-medium mb-1">暂无预设模板</p>
          <p className="text-xs text-monokai-comment/40">请先完成知识图谱初始化</p>
        </div>
      )}
    </div>
  );
};

// ============================================================
// MECE Section Divider
// ============================================================
const MECESectionDivider: React.FC<{ label: string; color: string }> = ({ label, color }) => {
  const colorMap: Record<string, string> = {
    purple: 'bg-monokai-purple/30 text-monokai-purple',
    blue: 'bg-monokai-blue/30 text-monokai-blue',
    green: 'bg-monokai-green/30 text-monokai-green',
    yellow: 'bg-monokai-yellow/30 text-monokai-yellow',
  };
  return (
    <div className="flex items-center gap-2 mb-3 mt-1">
      <div className={`w-1 h-2.5 rounded-full ${colorMap[color] || colorMap.purple}`} />
      <span className={`text-[10px] font-bold uppercase tracking-widest ${colorMap[color] || colorMap.purple} opacity-60`}>{label}</span>
      <div className="flex-1 h-px bg-gradient-to-r from-monokai-border/30 to-transparent" />
    </div>
  );
};

// ============================================================
// CRUD List (Left Pane Content)
// MECE 分类：Schema(类型定义) / Node(实体实例) / Edge(关系实例) / Action(行动)
// ============================================================

const CRUDList: React.FC<{
  onInspect: (mode: EditMode, target: any) => void;
  onRequestDelete: (type: string, id: number, label: string) => void;
}> = ({ onInspect, onRequestDelete }) => {
  const store = useOntologyStore();
  const { state } = store;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    objectTypes: true, objects: true, linkTypes: true, links: true, actions: true,
    introspections: false, insights: false,
  });
  const [search, setSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  }, []);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const exportOntologyJSON = useCallback(async () => {
    try {
      const [objectTypes, objects, linkTypes, links, actions] = await Promise.all([
        duckDBService.query(`SELECT * FROM ${state.mapping.objectTypeTable}`),
        duckDBService.query(`SELECT * FROM ${state.mapping.objectTable}`),
        duckDBService.query(`SELECT * FROM ${state.mapping.linkTypeTable}`),
        duckDBService.query(`SELECT * FROM ${state.mapping.linkTable}`),
        duckDBService.query(`SELECT * FROM ${state.mapping.actionTable}`),
      ]);
      const payload = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        objectTypes: objectTypes || [],
        objects: objects || [],
        linkTypes: linkTypes || [],
        links: links || [],
        actions: actions || [],
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ontology-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setImportSuccess('导出成功');
      setTimeout(() => setImportSuccess(null), 2000);
    } catch (e: any) {
      setImportError('导出失败: ' + e.message);
      setTimeout(() => setImportError(null), 3000);
    }
  }, [state.mapping]);

  const importOntologyJSON = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.objectTypes || !data.objects) throw new Error('无效的本体论 JSON 格式');
      
      // Auto-initialize tables if they don't exist yet
      await duckDBService.ontologyInit();

      const esc = (val: any) => {
        if (val === null || val === undefined) return 'NULL';
        return `'${String(val).replace(/'/g, "''")}'`;
      };

      for (const ot of data.objectTypes || []) {
        await duckDBService.query(`INSERT OR REPLACE INTO ${state.mapping.objectTypeTable} (id, name, description) VALUES (${ot.id}, ${esc(ot.name)}, ${esc(ot.description)})`);
      }
      for (const o of data.objects || []) {
        const propsVal = typeof o.properties === 'object' ? JSON.stringify(o.properties) : (o.properties || '{}');
        await duckDBService.query(`INSERT OR REPLACE INTO ${state.mapping.objectTable} (id, name, object_type_id, properties, annotations) VALUES (${o.id}, ${esc(o.name)}, ${o.object_type_id}, ${esc(propsVal)}, ${esc(o.annotations)})`);
      }
      for (const lt of data.linkTypes || []) {
        await duckDBService.query(`INSERT OR REPLACE INTO ${state.mapping.linkTypeTable} (id, name, description) VALUES (${lt.id}, ${esc(lt.name)}, ${esc(lt.description)})`);
      }
      for (const l of data.links || []) {
        await duckDBService.query(`INSERT OR REPLACE INTO ${state.mapping.linkTable} (id, source_object_id, link_type_id, target_object_id, weight) VALUES (${l.id}, ${l.source_object_id}, ${l.link_type_id}, ${l.target_object_id}, ${l.weight || 0.5})`);
      }
      for (const a of data.actions || []) {
        await duckDBService.query(`INSERT OR REPLACE INTO ${state.mapping.actionTable} (id, object_id, name, description, status, execute_at) VALUES (${a.id}, ${a.object_id || 'NULL'}, ${esc(a.name)}, ${esc(a.description)}, ${esc(a.status || 'pending')}, ${a.execute_at ? esc(a.execute_at) : 'NULL'})`);
      }
      for (const intro of data.introspections || []) {
        await duckDBService.query(`INSERT OR REPLACE INTO life_introspection (id, object_id, question, answer, created_at) VALUES (${intro.id}, ${intro.object_id}, ${esc(intro.question)}, ${esc(intro.answer)}, ${intro.created_at ? esc(intro.created_at) : 'NULL'})`);
      }
      for (const ins of data.insights || []) {
        await duckDBService.query(`INSERT OR REPLACE INTO life_insight (id, object_id, insight, tag, created_at) VALUES (${ins.id}, ${ins.object_id}, ${esc(ins.insight)}, ${esc(ins.tag)}, ${ins.created_at ? esc(ins.created_at) : 'NULL'})`);
      }
      await store.refresh();
      setImportSuccess(`导入成功：${(data.objects || []).length} 个对象`);
      setTimeout(() => setImportSuccess(null), 3000);
    } catch (err: any) {
      setImportError('导入失败: ' + err.message);
      setTimeout(() => setImportError(null), 4000);
    }
    e.target.value = '';
  }, [state.mapping, store]);

  const filteredObjects = useMemo(() => {
    if (!search) return state.objects;
    const t = search.toLowerCase();
    return state.objects.filter(o =>
      o.name.toLowerCase().includes(t) ||
      (store.objectTypeMap[o.object_type_id]?.name || '').toLowerCase().includes(t)
    );
  }, [state.objects, search, store.objectTypeMap]);

  const filteredLinks = useMemo(() => {
    if (!search) return state.links;
    const t = search.toLowerCase();
    return state.links.filter(l =>
      store.objectNameMap[l.source_object_id]?.toLowerCase().includes(t) ||
      store.objectNameMap[l.target_object_id]?.toLowerCase().includes(t) ||
      (store.linkTypeMap[l.link_type_id]?.name || '').toLowerCase().includes(t)
    );
  }, [state.links, search, store.objectNameMap, store.linkTypeMap]);

  const filteredObjectTypes = useMemo(() => {
    if (!search) return state.objectTypes;
    const t = search.toLowerCase();
    return state.objectTypes.filter(ot => ot.name.toLowerCase().includes(t) || (ot.description || '').toLowerCase().includes(t));
  }, [state.objectTypes, search]);

  const filteredActions = useMemo(() => {
    if (!search) return state.actions;
    const t = search.toLowerCase();
    return state.actions.filter(a => a.name.toLowerCase().includes(t) || (a.description || '').toLowerCase().includes(t));
  }, [state.actions, search]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-3 py-3 shrink-0 border-b border-monokai-border/50 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-monokai-comment/50" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索节点、关系..."
            className="w-full pl-8 pr-4 py-2 text-xs bg-monokai-surface border border-monokai-border/30 hover:border-monokai-accent/40 text-monokai-fg placeholder-monokai-comment/40 rounded-lg focus:outline-none focus:border-monokai-cyan/50 focus:bg-monokai-bg transition-all" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-monokai-comment/40 hover:text-monokai-fg transition-colors">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <button onClick={() => importOntologyJSON()} title="导入 JSON"
          className="shrink-0 p-1.5 rounded-lg text-monokai-comment/50 hover:text-monokai-cyan hover:bg-monokai-cyan/10 transition-colors">
          <Upload className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => exportOntologyJSON()} title="导出 JSON"
          className="shrink-0 p-1.5 rounded-lg text-monokai-comment/50 hover:text-monokai-cyan hover:bg-monokai-cyan/10 transition-colors">
          <Download className="w-3.5 h-3.5" />
        </button>
      </div>
      <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileImport} />

      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4 space-y-5">
        {state.initState === 'no-tables' ? (
          <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl bg-monokai-sidebar/30">
            <AlertTriangle className="w-10 h-10 mb-4 text-monokai-orange opacity-40" />
            <p className="text-sm font-medium text-monokai-fg mb-4">知识图谱数据仓未链接</p>
            <button onClick={() => store.initOntology()} disabled={state.initting}
              className="px-6 py-2.5 text-sm font-medium rounded-xl bg-monokai-purple/20 text-monokai-purple hover:bg-monokai-purple/30 transition-colors disabled:opacity-50">
              {state.initting ? '挂载中...' : '一键构建并挂载'}
            </button>
          </div>
        ) : (
          <>
            {/* ── MECE: Definition Layer ── */}
            <MECESectionDivider label="Ⅰ. 类型定义" color="purple" />

            <CRUDSection title="对象类型" icon={Layers} color="purple" count={filteredObjectTypes.length}
              expanded={expanded.objectTypes} onToggle={() => setExpanded(p => ({...p, objectTypes: !p.objectTypes}))} onAdd={() => onInspect('objectType', null)}>
              {filteredObjectTypes.map(ot => <CRUDRow key={ot.id} name={ot.name} desc={ot.description} onEdit={() => onInspect('objectType', ot)} onDelete={() => onRequestDelete('objectType', ot.id, ot.name)} />)}
            </CRUDSection>

            {/* ── MECE: Instance Layer — Nodes ── */}
            <MECESectionDivider label="Ⅱ. 实体节点 Nodes" color="blue" />

            <CRUDSection title="结构化实例" icon={Table2} color="blue" count={filteredObjects.length}
              expanded={expanded.objects} onToggle={() => setExpanded(p => ({...p, objects: !p.objects}))} onAdd={() => onInspect('object', null)}>
              {filteredObjects.map(obj => (
                <div key={obj.id} className="flex items-center justify-between px-2 py-2.5 rounded-lg hover:bg-monokai-sidebar/60 group transition-colors cursor-pointer" onClick={() => onInspect('object', obj)}>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-monokai-blue shrink-0 shadow-[0_0_8px_rgba(102,217,239,0.8)]" />
                    <span className="text-sm text-monokai-fg truncate">{obj.name}</span>
                    <span className="text-xs px-2 py-0.5 bg-monokai-purple/10 text-monokai-purple/80 rounded shrink-0">{store.objectTypeMap[obj.object_type_id]?.name || '?'}</span>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity ml-2 block">
                    <button onClick={(e) => { e.stopPropagation(); onRequestDelete('object', obj.id, obj.name); }} className="p-1.5 rounded-lg text-monokai-comment hover:text-monokai-orange hover:bg-monokai-orange/10"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </CRUDSection>

            {/* ── MECE: Instance Layer — Edges ── */}
            <MECESectionDivider label="Ⅲ. 关系连线 Edges" color="green" />

            <CRUDSection title="拓扑关系" icon={Network} color="green" count={filteredLinks.length}
              expanded={expanded.links} onToggle={() => setExpanded(p => ({...p, links: !p.links}))} onAdd={() => onInspect('link', null)}>
              {filteredLinks.map(link => (
                <div key={link.id} className="flex items-center justify-between px-2 py-2.5 rounded-lg hover:bg-monokai-sidebar/60 group transition-colors cursor-pointer" onClick={() => onInspect('link', link)}>
                  <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                    <span className="text-xs text-monokai-purple truncate max-w-[80px]">{store.objectNameMap[link.source_object_id]}</span>
                    <ChevronRight className="w-3 h-3 text-monokai-comment shrink-0" />
                    <span className="text-[11px] px-1.5 py-0.5 bg-monokai-green/10 text-monokai-green rounded shrink-0">{store.linkTypeMap[link.link_type_id]?.name}</span>
                    <ChevronRight className="w-3 h-3 text-monokai-comment shrink-0" />
                    <span className="text-xs text-monokai-blue truncate max-w-[80px]">{store.objectNameMap[link.target_object_id]}</span>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shrink-0 ml-2">
                    <button onClick={(e) => { e.stopPropagation(); onRequestDelete('link', link.id, `关系 #${link.id}`); }} className="p-1.5 rounded-lg text-monokai-comment hover:text-monokai-orange hover:bg-monokai-orange/10"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </CRUDSection>

            {/* ── MECE: Execution Layer ── */}
            <MECESectionDivider label="Ⅳ. 行动执行 Actions" color="yellow" />

            <CRUDSection title="逻辑驱动" icon={Zap} color="yellow" count={filteredActions.length}
               expanded={expanded.actions} onToggle={() => setExpanded(p => ({...p, actions: !p.actions}))} onAdd={() => onInspect('action', null)}>
               {filteredActions.map(action => (
                 <CRUDRow key={action.id} name={action.name} desc={action.description || 'Action'} onEdit={() => onInspect('action', action)} onDelete={() => onRequestDelete('action', action.id, action.name)} />
               ))}
            </CRUDSection>

            {/* ── MECE: Reflection Layer ── */}
            <MECESectionDivider label="Ⅴ. 沉思与洞察 Reflection" color="cyan" />

            <CRUDSection title="引导反思" icon={Brain} color="cyan" count={state.introspections.length}
              expanded={expanded.introspections} onToggle={() => setExpanded(p => ({...p, introspections: !p.introspections}))}
              onAdd={() => {}}>
              {state.introspections.length === 0 ? (
                <p className="text-xs text-monokai-comment p-2">暂无沉思记录</p>
              ) : (
                state.introspections.map(intro => (
                  <div key={intro.id} className="px-2 py-2.5 rounded-lg hover:bg-monokai-sidebar/60 transition-colors">
                    <div className="text-sm font-medium text-monokai-fg">{intro.question || '无标题'}</div>
                    {intro.answer && <div className="text-xs text-monokai-comment mt-1 line-clamp-2">{intro.answer}</div>}
                  </div>
                ))
              )}
            </CRUDSection>

            <CRUDSection title="洞察记录" icon={Lightbulb} color="pink" count={state.insights.length}
              expanded={expanded.insights} onToggle={() => setExpanded(p => ({...p, insights: !p.insights}))}
              onAdd={() => {}}>
              {state.insights.length === 0 ? (
                <p className="text-xs text-monokai-comment p-2">暂无洞察记录</p>
              ) : (
                state.insights.map(insight => (
                  <div key={insight.id} className="px-2 py-2.5 rounded-lg hover:bg-monokai-sidebar/60 transition-colors">
                    <div className="text-sm font-medium text-monokai-fg">{insight.content || '无标题'}</div>
                    {insight.category && (
                      <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full bg-monokai-pink/10 text-monokai-pink">{insight.category}</span>
                    )}
                  </div>
                ))
              )}
            </CRUDSection>

            {(importError || importSuccess) && (
              <div className={`shrink-0 mx-4 mb-3 px-4 py-2.5 rounded-xl text-xs font-medium border transition-all ${importError ? 'bg-monokai-orange/10 border-monokai-orange/20 text-monokai-orange' : 'bg-monokai-green/10 border-monokai-green/20 text-monokai-green'}`}>
                {importError || importSuccess}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const CRUDSection: React.FC<{ title: string; icon: React.ElementType; color: string; count: number; expanded: boolean; onToggle: () => void; onAdd: () => void; children: React.ReactNode; }> = ({ title, icon: Icon, color, count, expanded, onToggle, onAdd, children }) => {
  const colorClasses: Record<string, string> = { purple: 'text-monokai-purple', blue: 'text-monokai-blue', green: 'text-monokai-green', yellow: 'text-monokai-yellow' };
  const badgeClasses: Record<string, string> = { purple: 'bg-monokai-purple/10 text-monokai-purple', blue: 'bg-monokai-blue/10 text-monokai-blue', green: 'bg-monokai-green/10 text-monokai-green', yellow: 'bg-monokai-yellow/10 text-monokai-yellow' };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between group cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-3">
          <Icon className={`w-4 h-4 ${colorClasses[color]}`} />
          <h4 className="text-sm font-semibold text-monokai-fg tracking-wide">{title}</h4>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeClasses[color]}`}>{count}</span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
          <button onClick={e => { e.stopPropagation(); onAdd(); }} className="p-1.5 rounded-lg text-monokai-comment hover:text-monokai-fg hover:bg-black/20"><Plus className="w-4 h-4" /></button>
          {expanded ? <ChevronDown className="w-4 h-4 text-monokai-comment ml-1" /> : <ChevronRight className="w-4 h-4 text-monokai-comment ml-1" />}
        </div>
      </div>
      {expanded && <div className="pl-2 space-y-1">{children || <p className="text-xs text-monokai-comment p-2">暂无记录</p>}</div>}
    </div>
  );
};

const CRUDRow: React.FC<{ name: string; desc: string; onEdit: () => void; onDelete: () => void }> = ({ name, desc, onEdit, onDelete }) => (
  <div className="flex items-center justify-between px-2 py-2.5 rounded-lg hover:bg-monokai-sidebar/60 group transition-colors cursor-pointer" onClick={onEdit}>
    <div className="min-w-0 flex-1">
      <div className="text-sm font-medium text-monokai-fg truncate">{name}</div>
      {desc && <div className="text-xs text-monokai-comment truncate mt-0.5">{desc}</div>}
    </div>
    <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity ml-2 flex gap-1">
      <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1.5 rounded-lg text-monokai-comment hover:text-monokai-orange hover:bg-monokai-orange/10"><Trash2 className="w-4 h-4" /></button>
    </div>
  </div>
);

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
// Context Inspector (Right Pane)
// ============================================================

const RightInspector: React.FC<{
  mode: EditMode;
  target: any;
  onClose: () => void;
  onSave?: () => void;
}> = ({ mode, target, onClose, onSave }) => {
  const store = useOntologyStore();
  const { state } = store;
  const [form, setForm] = useState<FormState>({
    name: '', desc: '', objectTypeId: 1, properties: '',
    linkTypeId: 1, sourceId: null, targetId: null, weight: 0.5,
    status: 'pending', executeAt: '',
  });

  // Sync target into form — always fully reset to avoid stale field bleed
  useEffect(() => {
    if (!target) {
      setForm({ name: '', desc: '', objectTypeId: state.objectTypes[0]?.id || 1, properties: '', linkTypeId: state.linkTypes[0]?.id || 1, sourceId: null, targetId: null, weight: 0.5, status: 'pending', executeAt: '' });
      return;
    }
    if (mode === 'objectType' || mode === 'linkType') setForm({ name: target.name, desc: target.description || '', objectTypeId: state.objectTypes[0]?.id || 1, properties: '', linkTypeId: state.linkTypes[0]?.id || 1, sourceId: null, targetId: null, weight: 0.5, status: 'pending', executeAt: '' });
    else if (mode === 'object') setForm({ name: target.name, desc: '', objectTypeId: target.object_type_id, properties: target.properties || '', linkTypeId: state.linkTypes[0]?.id || 1, sourceId: null, targetId: null, weight: 0.5, status: 'pending', executeAt: '' });
    else if (mode === 'link') setForm({ name: '', desc: '', objectTypeId: state.objectTypes[0]?.id || 1, properties: '', linkTypeId: target.link_type_id, sourceId: target.source_object_id, targetId: target.target_object_id, weight: target.weight ?? 0.5, status: 'pending', executeAt: '' });
    else if (mode === 'action') setForm({ name: target.name, desc: target.description || '', objectTypeId: state.objectTypes[0]?.id || 1, properties: '', linkTypeId: state.linkTypes[0]?.id || 1, sourceId: null, targetId: null, weight: 0.5, status: target.status || 'pending', executeAt: normalizeDateToString(target.execute_at) });
  }, [mode, target, state.objectTypes, state.linkTypes]);

  const titleMap = { objectType: '节点类型 (Schema)', object: '超级节点属性', linkType: '拓扑类型', link: '依赖与连线', action: '执行行动' };

  // AI 填充：调用时使用显式参数而非闭包捕获的旧值，确保 form 状态同步到 UI
  const aiFillField = useCallback(async (field: string, currentMode: EditMode) => {
    try {
      const modeLabel = titleMap[currentMode];
      const prompt = `为 "${modeLabel}" 实体推荐一个合适的 ${field === 'name' ? '名称' : '描述'}`;
      const result = await ontologyAiService.generateObjectModel(prompt);
      const objects = result.objects || [];
      if (objects.length > 0) {
        const obj = objects[0];
        if (field === 'name') setForm(f => ({ ...f, name: obj.name }));
        else if (field === 'desc') setForm(f => ({ ...f, desc: (obj as any).description || obj.annotations || obj.name }));
      }
    } catch (e: any) {
      console.warn('AI 预填失败:', e.message);
    }
  }, []);

  const handleSave = async () => {
    try {
      if (mode === 'objectType') {
        if (target) await store.updateObjectType(target.id, form.name, form.desc);
        else await store.createObjectType(form.name, form.desc);
      } else if (mode === 'object') {
         if (!form.name.trim()) return alert("节点名不能为空");
        if (target) await store.updateObject(target.id, form.name, form.objectTypeId, form.properties || '{}');
        else await store.createObject(form.name, form.objectTypeId, form.properties || '{}');
      } else if (mode === 'linkType') {
        if (target) await store.updateLinkType(target.id, form.name, form.desc);
        else await store.createLinkType(form.name, form.desc);
      } else if (mode === 'link') {
        if (!form.sourceId || !form.targetId) return alert("请选择起点和终点");
        if (target) await store.updateLink(target.id, form.linkTypeId, form.sourceId, form.targetId, form.weight);
        else await store.createLink(form.linkTypeId, form.sourceId, form.targetId, form.weight);
      } else if (mode === 'action') {
        if (!form.name.trim()) return alert("行动名称不能为空");
        const normalizedDate = normalizeDateToString(form.executeAt);
        if (target) await store.updateAction(target.id, form.name, form.desc, form.status, normalizedDate || undefined);
        else await store.createAction(form.name, 0, form.desc, form.status, normalizedDate || undefined);
      }
      await store.refresh();
      onClose();
      onSave?.();
    } catch (e: any) { alert(`保存失败: ${e.message}`); }
  };

  return (
    <div className="flex-1 flex flex-col bg-monokai-bg/95 border-l border-monokai-accent/20 shadow-2xl relative z-20">
      {/* Header */}
      <div className="px-6 py-5 flex items-center justify-between border-b border-monokai-accent/10">
        <div>
           <h3 className="text-base font-bold text-monokai-fg flex items-center gap-2">
             <PanelRightDashed className="w-5 h-5 text-monokai-cyan" />
             {target ? '属性检视器' : '新建实体'}
           </h3>
           <p className="text-xs text-monokai-fg-muted mt-1">{titleMap[mode]} {target ? `#${target.id}` : ''}</p>
        </div>
        <button onClick={onClose} className="p-2 rounded-xl text-monokai-comment hover:text-monokai-fg hover:bg-monokai-accent/10 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Form Fields */}
      <div className="flex-1 p-6 space-y-5 overflow-y-auto custom-scrollbar">
        {mode !== 'link' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-monokai-accent">名称 Identifier</label>
              <button onClick={() => aiFillField('name', mode)}
                className="text-[10px] px-2 py-0.5 rounded-full bg-monokai-purple/10 text-monokai-purple hover:bg-monokai-purple/20 transition-colors">
                AI 填充
              </button>
            </div>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="输入名称..."
              className="w-full px-4 py-3 text-sm bg-monokai-surface border border-monokai-border/40 text-monokai-fg placeholder-monokai-comment/40 rounded-lg focus:outline-none focus:border-monokai-cyan/50 focus:bg-monokai-bg transition-all" />
          </div>
        )}

        {(mode === 'objectType' || mode === 'linkType' || mode === 'action') && (
          <div className="space-y-2">
             <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-monokai-accent">描述 Description</label>
              <button onClick={() => aiFillField('desc', mode)}
                className="text-[10px] px-2 py-0.5 rounded-full bg-monokai-purple/10 text-monokai-purple hover:bg-monokai-purple/20 transition-colors">
                AI 填充
              </button>
            </div>
             <textarea value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} placeholder="补充信息..." rows={3}
               className="w-full px-4 py-3 text-sm bg-monokai-surface border border-monokai-border/40 text-monokai-fg placeholder-monokai-comment/40 rounded-lg focus:outline-none focus:border-monokai-cyan/50 focus:bg-monokai-bg transition-all resize-none" />
          </div>
        )}

        {mode === 'action' && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-monokai-accent">计划执行时间 Execute At</label>
            <input type="date" value={form.executeAt} onChange={e => setForm(f => ({ ...f, executeAt: e.target.value }))}
              className="w-full px-4 py-3 text-sm bg-monokai-surface border border-monokai-border/40 text-monokai-fg rounded-lg focus:outline-none focus:border-monokai-cyan/50 focus:bg-monokai-bg transition-all" />
          </div>
        )}

        {mode === 'action' && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-monokai-accent">状态 Status</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="w-full px-4 py-3 text-sm bg-monokai-surface border border-monokai-border/40 text-monokai-fg rounded-lg focus:outline-none focus:border-monokai-cyan/50 focus:bg-monokai-bg transition-all appearance-none cursor-pointer">
              <option value="pending" className="bg-monokai-bg">待执行</option>
              <option value="running" className="bg-monokai-bg">执行中</option>
              <option value="done" className="bg-monokai-bg">已完成</option>
              <option value="failed" className="bg-monokai-bg">失败</option>
            </select>
          </div>
        )}

        {mode === 'object' && (
          <>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-monokai-accent">类型 Schema Binding</label>
              <select value={form.objectTypeId} onChange={e => setForm(f => ({ ...f, objectTypeId: Number(e.target.value) }))}
                className="w-full px-4 py-3 text-sm bg-monokai-surface border border-monokai-border/40 text-monokai-fg rounded-lg focus:outline-none focus:border-monokai-cyan/50 focus:bg-monokai-bg transition-all appearance-none cursor-pointer">
                {state.objectTypes.map(ot => <option key={ot.id} value={ot.id} className="bg-monokai-bg">{ot.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-monokai-accent">JSON 附加属性 Metadata</label>
              <textarea value={form.properties} onChange={e => setForm(f => ({ ...f, properties: e.target.value }))} placeholder="{}" rows={5}
                className="w-full px-4 py-3 text-sm font-mono bg-black/40 border border-monokai-accent/20 text-monokai-blue placeholder-monokai-comment/40 rounded-xl focus:outline-none focus:border-monokai-cyan/50 focus:bg-black/60 transition-all resize-none leading-relaxed" />
            </div>
          </>
        )}

        {mode === 'link' && (
          <>
            <div className="space-y-2">
               <label className="text-xs font-semibold text-monokai-accent">起点 Source Node</label>
               <select value={form.sourceId ?? ''} onChange={e => setForm(f => ({ ...f, sourceId: Number(e.target.value) }))}
                  className="w-full px-4 py-3 text-sm bg-monokai-surface border border-monokai-border/40 text-monokai-fg rounded-lg focus:outline-none focus:border-monokai-cyan/50 focus:bg-monokai-bg transition-all appearance-none cursor-pointer">
                  <option value="">选取节点...</option>
                  {state.objects.map(o => <option key={o.id} value={o.id} className="bg-monokai-bg">{o.name}</option>)}
               </select>
            </div>
            <div className="space-y-2">
               <label className="text-xs font-semibold text-monokai-comment">连接语意 Link Type</label>
               <select value={form.linkTypeId} onChange={e => setForm(f => ({ ...f, linkTypeId: Number(e.target.value) }))}
                  className="w-full px-4 py-3 text-sm bg-monokai-green/10 border border-monokai-green/30 text-monokai-green rounded-xl focus:outline-none focus:border-monokai-green/60 transition-all font-medium">
                  {state.linkTypes.map(lt => <option key={lt.id} value={lt.id} className="bg-monokai-bg">{lt.name}</option>)}
               </select>
            </div>
            <div className="space-y-2">
               <label className="text-xs font-semibold text-monokai-accent">终点 Target Node</label>
               <select value={form.targetId ?? ''} onChange={e => setForm(f => ({ ...f, targetId: Number(e.target.value) }))}
                  className="w-full px-4 py-3 text-sm bg-monokai-surface border border-monokai-border/40 text-monokai-fg rounded-lg focus:outline-none focus:border-monokai-cyan/50 focus:bg-monokai-bg transition-all appearance-none cursor-pointer">
                  <option value="">选取节点...</option>
                  {state.objects.map(o => <option key={o.id} value={o.id} className="bg-monokai-bg">{o.name}</option>)}
               </select>
            </div>
            <div className="space-y-2 mt-4 pt-4 border-t border-monokai-accent/10">
               <div className="flex items-center justify-between mb-2">
                 <label className="text-xs font-semibold text-monokai-accent">连接张力 Weight</label>
                 <span className="text-sm font-mono text-monokai-cyan">{(Number(form.weight) || 0).toFixed(2)}</span>
               </div>
               <input type="range" min="0" max="1" step="0.05" value={form.weight} onChange={e => setForm(f => ({ ...f, weight: Number(e.target.value) }))}
                  className="w-full h-1.5 rounded-full appearance-none bg-monokai-border/40 accent-monokai-cyan outline-none cursor-pointer" />
            </div>
          </>
        )}
      </div>

      <div className="p-4 border-t border-monokai-border/30 flex gap-2 justify-center bg-monokai-sidebar/40">
         <button onClick={onClose} className="flex-1 py-2.5 text-sm font-medium rounded-lg text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface transition-colors border border-transparent hover:border-monokai-border/40 flex items-center justify-center min-w-0">
           <span className="truncate">取消</span>
         </button>
         <button onClick={handleSave} className="flex-1 py-2.5 text-sm font-bold rounded-lg text-monokai-bg bg-monokai-cyan hover:bg-monokai-cyan/90 active:scale-[0.97] transition-all shadow-[0_0_16px_rgba(102,217,239,0.3)] flex items-center justify-center min-w-0">
           <span className="truncate">保存配置</span>
         </button>
      </div>
    </div>
  );
};


// ============================================================
// Main Application Component
// ============================================================

const OntologyPanelContent: React.FC<{
  onInsert?: (sql: string) => void;
  onTablesReady?: () => void;
  isActive?: boolean;
}> = ({ onInsert, onTablesReady, isActive }) => {
  const { state: rawState, dispatch, refresh, initOntology, reseedOntology, batchImportModelingResult, setPendingCommand,
    deleteObjectType, deleteObject, deleteLinkType, deleteLink, deleteAction, switchTemplate, activeTemplateId } = useOntologyStore();
  const state = rawState ?? {
    initState: 'loading', initting: false,
    objectTypes: [], objects: [], linkTypes: [], links: [], actions: [],
    introspections: [], insights: [],
    activeTab: 'graph', drawerOpen: true, drawerTab: 'templates',
    insightsOpen: false, search: '', aiTopic: '', isGenerating: false,
    draftPayload: null, draftJsonStr: '', error: null,
    stats: { objectTypes: 0, objects: 0, linkTypes: 0, links: 0, actions: 0, introspections: 0, insights: 0 },
    mapping: {
      objectTable: 'life_object',
      objectTypeTable: 'life_object_type',
      linkTable: 'life_link',
      linkTypeTable: 'life_link_type',
      actionTable: 'life_action',
    },
  };

  const [aiInput, setAiInput] = useState('');
  const { activeTab, drawerOpen, drawerTab } = state;

  // New states for the Inspector architecture
  const [inspectorMode, setInspectorMode] = useState<EditMode>('none');
  const [inspectorTarget, setInspectorTarget] = useState<any>(null);
  const d3GraphRefreshRef = useRef<(() => void) | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: number; label: string } | null>(null);
  const [modelingWizardOpen, setModelingWizardOpen] = useState(false);
  const [reseedMessage, setReseedMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

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

  const openInspector = (mode: EditMode, target: any) => {
    setInspectorMode(mode);
    setInspectorTarget(target);
    dispatch(ontologyActions.setDrawerTab('crud')); // Snap to CRUD layer if editing
  };

  const DRAWER_TABS: { id: DrawerTab; label: string; icon: React.ElementType; sub?: string }[] = [
    { id: 'templates', label: '预设库', icon: Database, sub: '场景化 SQL' },
    { id: 'crud',     label: '实体库', icon: List, sub: 'Schema · Node · Edge' },
    { id: 'mapping',  label: '映射台', icon: Map, sub: '数据 → 本体' },
  ];

  return (
    <div className="h-full w-full flex flex-col bg-monokai-bg overflow-hidden text-monokai-fg">
      {/* ── Top Master Header ── */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-monokai-accent/10 bg-monokai-bg shrink-0 z-20 relative shadow-sm">
        
        {/* Branding & Global Drawer Toggle */}
        <div className="flex items-center gap-4">
          <button onClick={() => dispatch(ontologyActions.toggleDrawer())} className="p-2 rounded-xl text-monokai-comment hover:text-white hover:bg-monokai-accent/10 transition-colors">
            {drawerOpen ? <AlignLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2">
            <Network className="w-5 h-5 text-monokai-cyan" />
            <span className="text-sm font-bold tracking-widest uppercase text-monokai-fg">DATA ONTOLOGY</span>
          </div>
        </div>

        {/* View Segmented Control */}
        <div className="flex items-center bg-black/30 p-1.5 rounded-xl border border-monokai-accent/5">
          {VIEW_TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => dispatch(ontologyActions.setActiveTab(tab.id))}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  isActive ? 'bg-monokai-sidebar shadow text-monokai-cyan' : 'text-monokai-comment hover:text-monokai-fg'
                }`}>
                <Icon className="w-4 h-4" /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* AI Cmd Bar */}
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-monokai-purple/60 group-hover:text-monokai-purple transition-colors" />
            <input type="text" value={aiInput} onChange={e => setAiInput(e.target.value)} placeholder="使用自然语言建立映射脉络..."
              className="pl-9 pr-4 py-2.5 text-sm w-72 bg-monokai-sidebar/30 border border-monokai-accent/20 text-monokai-fg placeholder-monokai-comment/50 rounded-xl focus:outline-none focus:border-monokai-purple/60 focus:bg-monokai-sidebar/80 transition-all shadow-inner" />
          </div>

          <button onClick={() => setModelingWizardOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl
              bg-monokai-purple/15 text-monokai-purple hover:bg-monokai-purple/25 border border-monokai-purple/20
              transition-all">
            <Wand2 className="w-4 h-4" /> 本体建模
          </button>

          <button onClick={() => { setInspectorMode('none'); dispatch(ontologyActions.toggleInsights()); }} 
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all ${
              state.insightsOpen ? 'bg-monokai-yellow/15 text-monokai-yellow' : 'bg-monokai-sidebar/30 text-monokai-comment hover:bg-monokai-sidebar hover:text-white border border-transparent hover:border-monokai-accent/20'
            }`}>
            <Lightbulb className="w-4 h-4" /> 聚合洞察
          </button>
        </div>
      </div>

      {/* ── Sub Header / Status Bar ── */}
      <div className="h-9 px-6 flex items-center justify-between bg-black/40 border-b border-monokai-accent/5 shrink-0">
        <div className="flex items-center gap-6 text-xs text-monokai-comment uppercase font-mono tracking-wider">
          {state.initState === 'loading' ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-monokai-cyan" />
              <span className="text-monokai-cyan">加载中...</span>
            </span>
          ) : state.initState === 'no-tables' ? (
            <span className="flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-monokai-purple/70" />
              <span className="text-monokai-orange/80">本体论未初始化 — 请在左侧点击「一键构建并挂载」</span>
            </span>
          ) : (
            <>
              <span>Entities: <strong className="text-monokai-blue">{state.objects?.length ?? 0}</strong></span>
              <span>Edges: <strong className="text-monokai-purple">{state.links?.length ?? 0}</strong></span>
              <span>Schemas: <strong className="text-monokai-yellow">{state.objectTypes?.length ?? 0}</strong></span>
              <span>LinkTypes: <strong className="text-monokai-green">{state.linkTypes?.length ?? 0}</strong></span>
              <span>Actions: <strong className="text-monokai-orange">{state.actions?.length ?? 0}</strong></span>
              {state.introspections?.length > 0 && (
                <span>Introspections: <strong className="text-monokai-cyan">{state.introspections.length}</strong></span>
              )}
              {state.insights?.length > 0 && (
                <span>Insights: <strong className="text-monokai-pink">{state.insights.length}</strong></span>
              )}
            </>
          )}
        </div>
        {/* Right side: clock + refresh + reseed */}
        <div className="flex items-center gap-4">
          <button onClick={() => refresh()} title="刷新图谱数据"
            className="p-1.5 rounded-lg text-monokai-comment hover:text-monokai-cyan hover:bg-monokai-cyan/10 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          {state.initState === 'ready' && (
            <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
              <button onClick={handleReseedSupplement} disabled={state.initting} title="补充缺失的人物和目标数据"
                className="shrink-0 whitespace-nowrap px-2 py-1 rounded-lg text-xs bg-monokai-purple/10 text-monokai-purple hover:bg-monokai-purple/20 transition-colors disabled:opacity-50">
                {state.initting ? '写入中...' : '补充数据'}
              </button>
              {reseedMessage && (
                <span className={`shrink-0 text-[10px] font-mono ${reseedMessage.type === 'success' ? 'text-monokai-green' : 'text-monokai-pink'}`}>
                  {reseedMessage.text}
                </span>
              )}
              <QuickClearMenu onClear={refresh} />
            </div>
          )}
          <LiveClock />
        </div>
      </div>

      {/* ── Main Workspace ── */}
      <div className="flex-1 overflow-hidden relative">
        <ResizableLayout leftInitialWidth={340} rightInitialWidth={380} minWidth={220} maxLeftRatio={0.35} maxRightRatio={0.40}>
          {({ leftWidth, rightWidth, startResizingLeft, startResizingRight }) => (
            <div className="flex h-full w-full overflow-hidden">
              
              {/* LEFT NAV PANEL */}
              {drawerOpen && (
                <div style={{ width: leftWidth }} className="flex-shrink-0 flex flex-col border-r border-monokai-accent/10 bg-monokai-bg/80 backdrop-blur-xl relative z-10 shadow-2xl">
                  {/* Resizer Handle Left */}
                  <div onMouseDown={startResizingLeft} onTouchStart={startResizingLeft}
                    className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-monokai-cyan/40 transition-colors z-20 group">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"><GripVertical className="w-4 h-4 text-monokai-cyan" /></div>
                  </div>

                  <div className="flex items-center pt-2 px-3 pb-0 shrink-0 relative gap-1">
                    {DRAWER_TABS.map(tab => {
                      const Icon = tab.icon;
                      const isActive = drawerTab === tab.id;
                      return (
                        <button key={tab.id} onClick={() => dispatch(ontologyActions.setDrawerTab(tab.id))}
                          title={tab.sub}
                          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 px-1 rounded-lg text-xs transition-all relative ${
                            isActive
                              ? 'bg-monokai-cyan/12 text-monokai-cyan'
                              : 'text-monokai-comment/50 hover:text-monokai-fg hover:bg-monokai-sidebar/40'
                          }`}>
                          <Icon className={`w-4 h-4 transition-transform ${isActive ? 'scale-110' : ''}`} />
                          <span className="font-semibold tracking-tight leading-none text-[10px]">{tab.label}</span>
                          {isActive && (
                            <div className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-monokai-cyan shadow-[0_0_8px_rgba(102,217,239,0.6)]" />
                          )}
                        </button>
                      );
                    })}
                    {/* Tab bar bottom border */}
                    <div className="absolute bottom-0 left-2 right-2 h-px bg-gradient-to-r from-transparent via-monokai-accent/20 to-transparent" />
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
                    {drawerTab === 'templates' && (
                      <TemplatePanel
                        state={state}
                        onInsert={onInsert}
                        onTablesReady={onTablesReady}
                        refresh={refresh}
                        activeTemplateId={activeTemplateId}
                        switchTemplate={switchTemplate}
                      />
                    )}
                    {drawerTab === 'crud' && <CRUDList onInspect={openInspector} onRequestDelete={(type, id, label) => setDeleteConfirm({ type, id, label })} />}
                    {drawerTab === 'mapping' && <MappingConsole />}
                  </div>
                </div>
              )}

              {/* CENTER CANVAS */}
              <div className="flex-1 relative overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-monokai-sidebar/30 via-monokai-bg to-monokai-bg">
                {activeTab === 'graph' && <D3GraphView onRefreshRef={fn => d3GraphRefreshRef.current = fn} ontologyState={state} isActive={isActive} />}
                {activeTab === 'data' && <OntologyDataView ontologyState={state} />}
                {activeTab === 'canvas' && <OntologyCanvas onInsert={onInsert} ontologyState={state} />}
              </div>

              {/* RIGHT INSPECTOR PANEL */}
              {inspectorMode !== 'none' && (
                <div style={{ width: rightWidth }} className="flex-shrink-0 flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.5)] z-20 relative bg-monokai-bg/90 backdrop-blur-2xl">
                   {/* Resizer Handle Right */}
                  <div onMouseDown={startResizingRight} onTouchStart={startResizingRight}
                    className="absolute left-0 top-0 w-1 h-full cursor-col-resize hover:bg-monokai-cyan/40 transition-colors z-20 group">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"><GripVertical className="w-4 h-4 text-monokai-cyan" /></div>
                  </div>
                  <RightInspector key={`inspector-${inspectorMode}-${inspectorTarget?.id ?? 'new'}`} mode={inspectorMode} target={inspectorTarget} onClose={() => setInspectorMode('none')} onSave={handleGraphSaved} />
                </div>
              )}

              {/* INSIGHTS PANEL (Alternative Right Pane) */}
              {state.insightsOpen && inspectorMode === 'none' && (
                <div style={{ width: rightWidth }} className="flex-shrink-0 flex flex-col bg-monokai-bg/90 border-l border-monokai-accent/20 shadow-[-10px_0_30px_rgba(0,0,0,0.5)] z-20 relative backdrop-blur-2xl">
                   {/* Resizer Handle Right for Insights */}
                  <div onMouseDown={startResizingRight} onTouchStart={startResizingRight}
                    className="absolute left-0 top-0 w-1 h-full cursor-col-resize hover:bg-monokai-cyan/40 transition-colors z-20 group">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"><GripVertical className="w-4 h-4 text-monokai-cyan" /></div>
                  </div>
                  <OntologyInsightsPanel objects={state.objects} objectTypes={state.objectTypes} links={state.links} linkTypes={state.linkTypes} />
                </div>
              )}
            </div>
          )}
        </ResizableLayout>
      </div>

      {/* Delete Confirmation Alert */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-all">
          <div className="w-96 bg-monokai-bg border border-monokai-accent/20 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
               <div className="flex items-center gap-4 mb-4">
                 <div className="w-12 h-12 rounded-xl bg-monokai-red/10 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-6 h-6 text-monokai-red" />
                 </div>
                 <div>
                   <h4 className="text-lg font-bold text-monokai-fg">破坏性操作确认</h4>
                   <p className="text-sm text-monokai-comment mt-1">此操作将永久修改知识图谱库数据。</p>
                 </div>
               </div>
               <p className="text-sm text-monokai-fg p-4 bg-monokai-sidebar/40 rounded-xl font-medium border border-monokai-accent/10">确定要销毁「{deleteConfirm.label}」吗？</p>
            </div>
            <div className="px-6 py-4 bg-monokai-sidebar/30 flex justify-end gap-3 border-t border-monokai-accent/10">
              <button onClick={() => setDeleteConfirm(null)} className="px-5 py-2.5 text-sm font-medium rounded-xl text-monokai-fg bg-black/40 hover:bg-black/60 transition-colors">取消</button>
              <button
                onClick={async () => {
                try {
                  if (deleteConfirm.type === 'objectType') await deleteObjectType(deleteConfirm.id);
                  else if (deleteConfirm.type === 'object') await deleteObject(deleteConfirm.id);
                  else if (deleteConfirm.type === 'linkType') await deleteLinkType(deleteConfirm.id);
                  else if (deleteConfirm.type === 'link') await deleteLink(deleteConfirm.id);
                  else if (deleteConfirm.type === 'action') await deleteAction(deleteConfirm.id);
                  setDeleteConfirm(null);
                  setInspectorMode('none');
                  await refresh();
                } catch (e: any) { console.error('销毁失败:', e.message); }
              }}
                className="px-5 py-2.5 text-sm font-bold rounded-xl bg-monokai-red/20 text-monokai-red hover:bg-monokai-red hover:text-white transition-colors shadow-[0_0_15px_rgba(249,38,114,0.3)]">
                确认销毁
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Draft Global Alert */}
      {state.draftPayload && (
        <AIDraftModal
          payload={state.draftPayload}
          jsonStr={state.draftJsonStr}
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
    </div>
  );
};

export const OntologyPanel: React.FC<{
  onInsert?: (sql: string) => void;
  onTablesReady?: () => void;
  isActive?: boolean;
}> = (props) => {
  return React.createElement(OntologyStoreProvider, null, React.createElement(OntologyPanelContent, props));
};

export default OntologyPanel;
