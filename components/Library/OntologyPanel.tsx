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
  List, Map, BarChart2, Pencil, Download, Upload, Brain, Wand2, BookOpen
} from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { sql as sqlLang } from '@codemirror/lang-sql';
import { EditorView } from '@codemirror/view';
import { monokai } from '@uiw/codemirror-theme-monokai';

import { useOntologyStore, ontologyActions, ONTOLOGY_SEED_INFOS, OntologyStoreProvider } from '../../hooks/useOntologyStore';
import { ontologyAiService } from '../../services/ontologyAiService';
import { PatternLibraryPanel } from './PatternLibrary';
import RightInspector from './OntologyPanelRightInspector';
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
            <div className="w-10 h-10 rounded-xl bg-monokai-amethyst/15 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-monokai-amethyst" />
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
          {payload.links?.length > 0 && <span className="text-monokai-amethyst flex items-center gap-2"><Link2 className="w-4 h-4" /> 关系 × {payload.links.length}</span>}
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
          <button onClick={handleCommit} disabled={committing} className="flex items-center gap-2 px-5 py-2.5 text-sm rounded-xl bg-monokai-amethyst/20 text-monokai-amethyst hover:bg-monokai-amethyst/30 transition-colors disabled:opacity-50 font-medium">
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
  setup:  'from-monokai-amethyst/30 via-monokai-amethyst/10 to-transparent',
  query:  'from-monokai-cyan/30 via-monokai-cyan/10 to-transparent',
  modify: 'from-monokai-yellow/30 via-monokai-yellow/10 to-transparent',
  export: 'from-monokai-green/30 via-monokai-green/10 to-transparent',
  industry: 'from-monokai-amethyst/30 via-monokai-amethyst/10 to-transparent',
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  setup:  Database,
  query:  BarChart2,
  modify:  Pencil,
  export:  Download,
  industry: Sparkles,
};

const CATEGORY_COLORS: Record<string, string> = {
  setup: 'text-monokai-amethyst', query: 'text-monokai-cyan',
  modify: 'text-monokai-yellow', export: 'text-monokai-green',
  industry: 'text-monokai-amethyst',
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
    amethyst: 'bg-monokai-amethyst/30 text-monokai-amethyst',
    blue: 'bg-monokai-blue/30 text-monokai-blue',
    green: 'bg-monokai-green/30 text-monokai-green',
    yellow: 'bg-monokai-yellow/30 text-monokai-yellow',
  };
  return (
    <div className="flex items-center gap-2 mb-3 mt-1">
      <div className={`w-1 h-2.5 rounded-full ${colorMap[color] || colorMap.amethyst}`} />
      <span className={`text-xs font-bold uppercase tracking-widest ${colorMap[color] || colorMap.amethyst} opacity-60`}>{label}</span>
      <div className="flex-1 h-px bg-gradient-to-r from-monokai-border/30 to-transparent" />
    </div>
  );
};

// ============================================================
// CRUD List (Left Pane Content)
// MECE 分类：Schema(类型定义) / Node(实体实例) / Edge(关系实例) / Action(行动)
// ============================================================

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
  const [activeSubTab, setActiveSubTab] = useState<'schema' | 'instances' | 'reflection'>('schema');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [isOperating, setIsOperating] = useState(false);

  const exportOntologyJSON = useCallback(async () => {
    setIsOperating(true);
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
      setImportSuccess('数据成功导出为 JSON 文件');
      setTimeout(() => setImportSuccess(null), 3000);
    } catch (e: any) {
      setImportError('导出失败: ' + e.message);
      setTimeout(() => setImportError(null), 4000);
    } finally {
      setIsOperating(false);
    }
  }, [state.mapping]);

  const importOntologyJSON = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsOperating(true);
    setImportError(null);
    setImportSuccess(null);
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
      setImportSuccess(`成功导入：${(data.objects || []).length}个节点，${(data.links || []).length}个关系`);
      setTimeout(() => setImportSuccess(null), 4000);
    } catch (err: any) {
      setImportError('导入失败: ' + err.message);
      setTimeout(() => setImportError(null), 5005);
    } finally {
      setIsOperating(false);
    }
    e.target.value = '';
  }, [state.mapping, store]);

  // Lists filtered by search query
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

  const filteredLinkTypes = useMemo(() => {
    if (!search) return state.linkTypes || [];
    const t = search.toLowerCase();
    return (state.linkTypes || []).filter(lt => lt.name.toLowerCase().includes(t) || (lt.description || '').toLowerCase().includes(t));
  }, [state.linkTypes, search]);

  const filteredActions = useMemo(() => {
    if (!search) return state.actions;
    const t = search.toLowerCase();
    return state.actions.filter(a => a.name.toLowerCase().includes(t) || (a.description || '').toLowerCase().includes(t));
  }, [state.actions, search]);

  const filteredIntrospections = useMemo(() => {
    if (!search) return state.introspections;
    const t = search.toLowerCase();
    return state.introspections.filter(i =>
      (i.question || '').toLowerCase().includes(t) ||
      (i.answer || '').toLowerCase().includes(t)
    );
  }, [state.introspections, search]);

  const filteredInsights = useMemo(() => {
    if (!search) return state.insights;
    const t = search.toLowerCase();
    return state.insights.filter(i =>
      (i.insight || '').toLowerCase().includes(t) ||
      (i.tag || '').toLowerCase().includes(t)
    );
  }, [state.insights, search]);

  // Stats calculation
  const totalSchemaCount = state.objectTypes.length + (state.linkTypes || []).length;
  const matchedSchemaCount = filteredObjectTypes.length + filteredLinkTypes.length;

  const totalInstanceCount = state.objects.length + state.links.length + state.actions.length;
  const matchedInstanceCount = filteredObjects.length + filteredLinks.length + filteredActions.length;

  const totalReflectionCount = state.introspections.length + state.insights.length;
  const matchedReflectionCount = filteredIntrospections.length + filteredInsights.length;

  // Global expand/collapse toggle helper
  const allCollapsed = Object.values(expanded).every(v => !v);
  const toggleAllExpanded = () => {
    const nextVal = allCollapsed;
    setExpanded({
      objectTypes: nextVal,
      objects: nextVal,
      linkTypes: nextVal,
      links: nextVal,
      actions: nextVal,
      introspections: nextVal,
      insights: nextVal,
    });
  };

  // Helper to highlight matching text in search results
  const renderHighlight = (text: string, query: string) => {
    if (!query) return <span>{text}</span>;
    const parts = text.split(new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) => 
          part.toLowerCase() === query.toLowerCase() 
            ? <mark key={i} className="bg-monokai-yellow/30 text-monokai-yellow font-bold px-0.5 rounded">{part}</mark>
            : <span key={i}>{part}</span>
        )}
      </span>
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-3 py-3 shrink-0 border-b border-monokai-border/50 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-monokai-comment/50" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索节点、关系..."
            className="w-full pl-8 pr-8 py-2 text-xs bg-monokai-surface border border-monokai-border/30 hover:border-monokai-accent/40 text-monokai-fg placeholder-monokai-comment/40 rounded-lg focus:outline-none focus:border-monokai-cyan/50 focus:bg-monokai-bg transition-all" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-monokai-comment/40 hover:text-monokai-fg transition-colors">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <button onClick={toggleAllExpanded} title={allCollapsed ? "展开全部区域" : "收起全部区域"}
          className={`shrink-0 p-1.5 rounded-lg border transition-all ${
            allCollapsed ? 'text-monokai-comment border-monokai-border/20 hover:text-monokai-fg' : 'text-monokai-cyan border-monokai-cyan/20 bg-monokai-cyan/5 hover:bg-monokai-cyan/15'
          }`}>
          <List className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => importOntologyJSON()} title="导入 JSON" disabled={isOperating}
          className="shrink-0 p-1.5 rounded-lg text-monokai-comment/50 hover:text-monokai-cyan hover:bg-monokai-cyan/10 transition-colors disabled:opacity-40">
          <Upload className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => exportOntologyJSON()} title="导出 JSON" disabled={isOperating}
          className="shrink-0 p-1.5 rounded-lg text-monokai-comment/50 hover:text-monokai-cyan hover:bg-monokai-cyan/10 transition-colors disabled:opacity-40">
          <Download className="w-3.5 h-3.5" />
        </button>
      </div>
      <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileImport} />

      {/* Floating Micro Banners for operation toasts */}
      {(importSuccess || importError || isOperating) && (
        <div className="px-3 py-1.5 shrink-0 bg-monokai-surface/60 border-b border-monokai-border/30 flex items-center justify-between text-[11px] animate-in slide-in-from-top-2 duration-300">
          <span className="flex items-center gap-1.5 min-w-0">
            {isOperating && <Loader2 className="w-3 h-3 text-monokai-amethyst animate-spin" />}
            {isOperating && <span className="text-monokai-comment">正在读写本体论仓...</span>}
            {!isOperating && importSuccess && <span className="text-monokai-green font-medium truncate">✓ {importSuccess}</span>}
            {!isOperating && importError && <span className="text-monokai-red font-medium truncate">✗ {importError}</span>}
          </span>
        </div>
      )}

      {/* Sub-segmented Tab Control with Sliding/Glowing Track animation */}
      <div className="px-3 py-2 shrink-0 border-b border-monokai-border/20 bg-monokai-sidebar/10">
        <div className="relative flex gap-1 p-1 bg-black/40 rounded-lg border border-monokai-accent/5">
          <button
            type="button"
            onClick={() => setActiveSubTab('schema')}
            className={`z-10 flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all ${
              activeSubTab === 'schema' ? 'text-monokai-amethyst' : 'text-monokai-comment/70 hover:text-monokai-fg'
            }`}
          >
            📂 Schema ({search ? `${matchedSchemaCount}/${totalSchemaCount}` : totalSchemaCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('instances')}
            className={`z-10 flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all ${
              activeSubTab === 'instances' ? 'text-monokai-blue' : 'text-monokai-comment/70 hover:text-monokai-fg'
            }`}
          >
            💎 实例 ({search ? `${matchedInstanceCount}/${totalInstanceCount}` : totalInstanceCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('reflection')}
            className={`z-10 flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all ${
              activeSubTab === 'reflection' ? 'text-monokai-cyan' : 'text-monokai-comment/70 hover:text-monokai-fg'
            }`}
          >
            🧠 沉思 ({search ? `${matchedReflectionCount}/${totalReflectionCount}` : totalReflectionCount})
          </button>

          {/* Glowing slide indicator background */}
          <div 
            className="absolute top-1 bottom-1 rounded-md transition-all duration-300 ease-out" 
            style={{
              width: 'calc(33.333% - 4px)',
              left: activeSubTab === 'schema' ? '4px' : activeSubTab === 'instances' ? '33.333%' : '66.666%',
              backgroundColor: activeSubTab === 'schema' ? 'rgba(174,129,255,0.08)' : activeSubTab === 'instances' ? 'rgba(102,217,239,0.08)' : 'rgba(166,226,46,0.08)',
              border: activeSubTab === 'schema' ? '1px solid rgba(174,129,255,0.3)' : activeSubTab === 'instances' ? '1px solid rgba(102,217,239,0.3)' : '1px solid rgba(166,226,46,0.3)',
              boxShadow: activeSubTab === 'schema' ? '0 0 10px rgba(174,129,255,0.15)' : activeSubTab === 'instances' ? '0 0 10px rgba(102,217,239,0.15)' : '0 0 10px rgba(166,226,46,0.15)'
            }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4 space-y-5">
        {state.initState === 'no-tables' ? (
          <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl bg-monokai-sidebar/30">
            <AlertTriangle className="w-10 h-10 mb-4 text-monokai-orange opacity-40" />
            <p className="text-sm font-medium text-monokai-fg mb-4">知识图谱数据仓未链接</p>
            <button onClick={() => store.initOntology()} disabled={state.initting}
              className="px-6 py-2.5 text-sm font-medium rounded-xl bg-monokai-amethyst/20 text-monokai-amethyst hover:bg-monokai-amethyst/30 transition-colors disabled:opacity-50">
              {state.initting ? '挂载中...' : '一键构建并挂载'}
            </button>
          </div>
        ) : (
          <>
            {/* ── SubTab 1: Definition Layer (Schema) ── */}
            {activeSubTab === 'schema' && (
              <div className="space-y-4 animate-in fade-in-50 duration-150">
                <MECESectionDivider label="Ⅰ. 类型定义 Object & Link Types" color="amethyst" />

                <CRUDSection title="对象类型" icon={Layers} color="amethyst" count={state.objectTypes.length} matchedCount={search ? filteredObjectTypes.length : undefined}
                  expanded={expanded.objectTypes} onToggle={() => setExpanded(p => ({...p, objectTypes: !p.objectTypes}))} onAdd={() => onInspect('objectType', null)}>
                  {filteredObjectTypes.length === 0 ? (
                    <p className="text-[11px] text-monokai-comment p-2">暂无匹配的对象类型</p>
                  ) : (
                    filteredObjectTypes.map(ot => <CRUDRow key={ot.id} name={ot.name} desc={ot.description} query={search} onEdit={() => onInspect('objectType', ot)} onDelete={() => onRequestDelete('objectType', ot.id, ot.name)} onQuickAdd={() => onInspect('object', { object_type_id: ot.id })} renderHighlight={renderHighlight} />)
                  )}
                </CRUDSection>

                <CRUDSection title="关系类型" icon={Link2} color="amethyst" count={(state.linkTypes || []).length} matchedCount={search ? filteredLinkTypes.length : undefined}
                  expanded={expanded.linkTypes} onToggle={() => setExpanded(p => ({...p, linkTypes: !p.linkTypes}))} onAdd={() => onInspect('linkType', null)}>
                  {filteredLinkTypes.length === 0 ? (
                    <p className="text-[11px] text-monokai-comment p-2">暂无匹配的关系类型</p>
                  ) : (
                    filteredLinkTypes.map(lt => <CRUDRow key={lt.id} name={lt.name} desc={lt.description} query={search} onEdit={() => onInspect('linkType', lt)} onDelete={() => onRequestDelete('linkType', lt.id, lt.name)} onQuickAdd={() => onInspect('link', { link_type_id: lt.id })} renderHighlight={renderHighlight} />)
                  )}
                </CRUDSection>
              </div>
            )}

            {/* ── SubTab 2: Instance Layer (Data Nodes / Edges / Actions) ── */}
            {activeSubTab === 'instances' && (
              <div className="space-y-4 animate-in fade-in-50 duration-150">
                <MECESectionDivider label="Ⅱ. 实体节点 Nodes" color="blue" />

                <CRUDSection title="结构化实例" icon={Table2} color="blue" count={state.objects.length} matchedCount={search ? filteredObjects.length : undefined}
                  expanded={expanded.objects} onToggle={() => setExpanded(p => ({...p, objects: !p.objects}))} onAdd={() => onInspect('object', null)}>
                  {filteredObjects.length === 0 ? (
                    <p className="text-[11px] text-monokai-comment p-2">暂无匹配的实体实例</p>
                  ) : (
                    filteredObjects.map(obj => (
                      <div key={obj.id} className="flex items-center justify-between px-2 py-2 rounded-lg bg-monokai-surface/30 border border-monokai-border/10 hover:border-monokai-blue/30 hover:bg-monokai-sidebar/60 group transition-all duration-200 cursor-pointer" onClick={() => onInspect('object', obj)}>
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-monokai-blue shrink-0 shadow-[0_0_8px_rgba(102,217,239,0.8)]" />
                          <span className="text-xs text-monokai-fg truncate">{renderHighlight(obj.name, search)}</span>
                          <span className="text-[9px] px-1.5 py-0.5 bg-monokai-amethyst/10 text-monokai-amethyst/80 border border-monokai-amethyst/20 rounded-md shrink-0">{renderHighlight(store.objectTypeMap[obj.object_type_id]?.name || '?', search)}</span>
                        </div>
                        <div className="opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 group-focus-within:opacity-100 group-focus-within:translate-x-0 transition-all duration-200 ml-2 shrink-0 flex items-center gap-1">
                          <button onClick={(e) => { e.stopPropagation(); if ((window as any).__d3FocusNode) (window as any).__d3FocusNode(obj.id, 'instance'); }} title="在图谱中定位聚焦" className="p-1 rounded-lg text-monokai-comment hover:text-monokai-cyan hover:bg-monokai-cyan/10"><Target className="w-3.5 h-3.5" /></button>
                          <button onClick={(e) => { e.stopPropagation(); onRequestDelete('object', obj.id, obj.name); }} className="p-1 rounded-lg text-monokai-comment hover:text-monokai-orange hover:bg-monokai-orange/10"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    ))
                  )}
                </CRUDSection>

                <MECESectionDivider label="Ⅲ. 关系连线 Edges" color="green" />

                <CRUDSection title="拓扑关系" icon={Network} color="green" count={state.links.length} matchedCount={search ? filteredLinks.length : undefined}
                  expanded={expanded.links} onToggle={() => setExpanded(p => ({...p, links: !p.links}))} onAdd={() => onInspect('link', null)}>
                  {filteredLinks.length === 0 ? (
                    <p className="text-[11px] text-monokai-comment p-2">暂无匹配的拓扑关系</p>
                  ) : (
                    filteredLinks.map(link => (
                      <div key={link.id} className="flex items-center justify-between px-2 py-2 rounded-lg bg-monokai-surface/30 border border-monokai-border/10 hover:border-monokai-green/30 hover:bg-monokai-sidebar/60 group transition-all duration-200 cursor-pointer" onClick={() => onInspect('link', link)}>
                        <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
                          <span className="text-[11px] text-monokai-amethyst truncate max-w-[80px] font-medium">{renderHighlight(store.objectNameMap[link.source_object_id] || '', search)}</span>
                          <ChevronRight className="w-3 h-3 text-monokai-comment/50 shrink-0" />
                          <span className="text-[10px] px-1.5 py-0.5 bg-monokai-green/10 text-monokai-green border border-monokai-green/20 rounded shrink-0 font-medium">{renderHighlight(store.linkTypeMap[link.link_type_id]?.name || '', search)}</span>
                          <ChevronRight className="w-3 h-3 text-monokai-comment/50 shrink-0" />
                          <span className="text-[11px] text-monokai-blue truncate max-w-[80px] font-medium">{renderHighlight(store.objectNameMap[link.target_object_id] || '', search)}</span>
                        </div>
                        <div className="opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 group-focus-within:opacity-100 group-focus-within:translate-x-0 transition-all duration-200 ml-2 shrink-0 flex items-center gap-1">
                          <button onClick={(e) => { e.stopPropagation(); if ((window as any).__d3FocusNode) (window as any).__d3FocusNode(link.source_object_id, 'instance'); }} title="在图谱中定位关系起点" className="p-1 rounded-lg text-monokai-comment hover:text-monokai-cyan hover:bg-monokai-cyan/10"><Target className="w-3.5 h-3.5" /></button>
                          <button onClick={(e) => { e.stopPropagation(); onRequestDelete('link', link.id, `关系 #${link.id}`); }} className="p-1 rounded-lg text-monokai-comment hover:text-monokai-orange hover:bg-monokai-orange/10"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    ))
                  )}
                </CRUDSection>

                <MECESectionDivider label="Ⅳ. 行动执行 Actions" color="yellow" />

                <CRUDSection title="逻辑驱动" icon={Zap} color="yellow" count={state.actions.length} matchedCount={search ? filteredActions.length : undefined}
                   expanded={expanded.actions} onToggle={() => setExpanded(p => ({...p, actions: !p.actions}))} onAdd={() => onInspect('action', null)}>
                   {filteredActions.length === 0 ? (
                     <p className="text-[11px] text-monokai-comment p-2">暂无匹配的行动逻辑</p>
                   ) : (
                     filteredActions.map(action => (
                       <CRUDRow key={action.id} name={action.name} desc={action.description || 'Action'} query={search} onEdit={() => onInspect('action', action)} onDelete={() => onRequestDelete('action', action.id, action.name)} renderHighlight={renderHighlight} />
                     ))
                   )}
                </CRUDSection>
              </div>
            )}

            {/* ── SubTab 3: Reflection Layer (Introspection / Insights) ── */}
            {activeSubTab === 'reflection' && (
              <div className="space-y-4 animate-in fade-in-50 duration-150">
                <MECESectionDivider label="Ⅴ. 沉思与洞察 Reflection" color="cyan" />

                <CRUDSection title="引导反思" icon={Brain} color="cyan" count={state.introspections.length} matchedCount={search ? filteredIntrospections.length : undefined}
                  expanded={expanded.introspections} onToggle={() => setExpanded(p => ({...p, introspections: !p.introspections}))}
                  onAdd={() => onInspect('introspection', null)}>
                  {filteredIntrospections.length === 0 ? (
                    <p className="text-[11px] text-monokai-comment p-2">暂无匹配的沉思记录</p>
                  ) : (
                    filteredIntrospections.map(intro => (
                      <div key={intro.id} className="flex items-center justify-between px-2 py-2 rounded-lg bg-monokai-surface/30 border border-monokai-border/10 hover:border-monokai-cyan/30 hover:bg-monokai-sidebar/60 group transition-all duration-200 cursor-pointer" onClick={() => onInspect('introspection', intro)}>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-monokai-fg truncate">{renderHighlight(intro.question || '无标题', search)}</div>
                          {intro.answer && <div className="text-[11px] text-monokai-comment mt-0.5 line-clamp-1 truncate">{renderHighlight(intro.answer, search)}</div>}
                        </div>
                        <div className="opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 group-focus-within:opacity-100 group-focus-within:translate-x-0 transition-all duration-200 ml-2 shrink-0">
                          <button onClick={(e) => { e.stopPropagation(); onRequestDelete('introspection', intro.id, intro.question || `反思 #${intro.id}`); }} className="p-1 rounded-lg text-monokai-comment hover:text-monokai-red hover:bg-monokai-red/10"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    ))
                  )}
                </CRUDSection>

                <CRUDSection title="洞察记录" icon={Lightbulb} color="pink" count={state.insights.length} matchedCount={search ? filteredInsights.length : undefined}
                  expanded={expanded.insights} onToggle={() => setExpanded(p => ({...p, insights: !p.insights}))}
                  onAdd={() => onInspect('insight', null)}>
                  {filteredInsights.length === 0 ? (
                    <p className="text-[11px] text-monokai-comment p-2">暂无匹配的洞察记录</p>
                  ) : (
                    filteredInsights.map(insight => (
                      <div key={insight.id} className="flex items-center justify-between px-2 py-2 rounded-lg bg-monokai-surface/30 border border-monokai-border/10 hover:border-monokai-pink/30 hover:bg-monokai-sidebar/60 group transition-all duration-200 cursor-pointer" onClick={() => onInspect('insight', insight)}>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-monokai-fg truncate">{renderHighlight(insight.insight || '无标题', search)}</div>
                          {insight.tag && (
                            <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded-full bg-monokai-pink/10 text-monokai-pink border border-monokai-pink/20 font-semibold">{renderHighlight(insight.tag, search)}</span>
                          )}
                        </div>
                        <div className="opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 group-focus-within:opacity-100 group-focus-within:translate-x-0 transition-all duration-200 ml-2 shrink-0">
                          <button onClick={(e) => { e.stopPropagation(); onRequestDelete('insight', insight.id, insight.insight || `洞察 #${insight.id}`); }} className="p-1 rounded-lg text-monokai-comment hover:text-monokai-red hover:bg-monokai-red/10"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    ))
                  )}
                </CRUDSection>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const CRUDSection: React.FC<{ title: string; icon: React.ElementType; color: string; count: number; matchedCount?: number; expanded: boolean; onToggle: () => void; onAdd: () => void; children: React.ReactNode; }> = ({ title, icon: Icon, color, count, matchedCount, expanded, onToggle, onAdd, children }) => {
  const colorClasses: Record<string, string> = { amethyst: 'text-monokai-amethyst', blue: 'text-monokai-blue', green: 'text-monokai-green', yellow: 'text-monokai-yellow', cyan: 'text-monokai-cyan', pink: 'text-monokai-pink' };
  const badgeClasses: Record<string, string> = { amethyst: 'bg-monokai-amethyst/10 text-monokai-amethyst', blue: 'bg-monokai-blue/10 text-monokai-blue', green: 'bg-monokai-green/10 text-monokai-green', yellow: 'bg-monokai-yellow/10 text-monokai-yellow', cyan: 'bg-monokai-cyan/10 text-monokai-cyan', pink: 'bg-monokai-pink/10 text-monokai-pink' };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between group cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-3">
          <Icon className={`w-4 h-4 ${colorClasses[color]}`} />
          <h4 className="text-xs font-semibold text-monokai-fg tracking-wide">{title}</h4>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badgeClasses[color]}`}>
            {matchedCount !== undefined ? `${matchedCount}/${count}` : count}
          </span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
          <button onClick={e => { e.stopPropagation(); onAdd(); }} className="p-1.5 rounded-lg text-monokai-comment hover:text-monokai-fg hover:bg-black/20"><Plus className="w-4 h-4" /></button>
          {expanded ? <ChevronDown className="w-4 h-4 text-monokai-comment ml-1" /> : <ChevronRight className="w-4 h-4 text-monokai-comment ml-1" />}
        </div>
      </div>
      {expanded && <div className="pl-2 space-y-1">{children || <p className="text-[11px] text-monokai-comment p-2">暂无记录</p>}</div>}
    </div>
  );
};

const CRUDRow: React.FC<{ name: string; desc: string; query: string; onEdit: () => void; onDelete: () => void; onQuickAdd?: () => void; renderHighlight: (t: string, q: string) => React.ReactNode }> = ({ name, desc, query, onEdit, onDelete, onQuickAdd, renderHighlight }) => (
  <div className="flex items-center justify-between px-2 py-2.5 rounded-lg hover:bg-monokai-sidebar/60 group transition-all duration-200 cursor-pointer" onClick={onEdit}>
    <div className="min-w-0 flex-1">
      <div className="text-xs font-medium text-monokai-fg truncate">{renderHighlight(name, query)}</div>
      {desc && <div className="text-[11px] text-monokai-comment truncate mt-0.5">{renderHighlight(desc, query)}</div>}
    </div>
    <div className="opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 group-focus-within:opacity-100 group-focus-within:translate-x-0 transition-all duration-200 ml-2 flex gap-1 shrink-0">
      {onQuickAdd && (
        <button onClick={(e) => { e.stopPropagation(); onQuickAdd(); }} title="快速在此类型下创建实例" className="p-1 rounded-lg text-monokai-comment hover:text-monokai-cyan hover:bg-monokai-cyan/10"><Plus className="w-3.5 h-3.5" /></button>
      )}
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
    { id: 'templates', label: '模式库', icon: BookOpen, sub: 'Palantir 建模模式' },
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
            <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-monokai-amethyst/60 group-hover:text-monokai-amethyst transition-colors" />
            <input type="text" value={aiInput} onChange={e => setAiInput(e.target.value)} placeholder="使用自然语言建立映射脉络..."
              className="pl-9 pr-4 py-2.5 text-sm w-72 bg-monokai-sidebar/30 border border-monokai-accent/20 text-monokai-fg placeholder-monokai-comment/50 rounded-xl focus:outline-none focus:border-monokai-amethyst/60 focus:bg-monokai-sidebar/80 transition-all shadow-inner" />
          </div>

          <button onClick={() => setModelingWizardOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl
              bg-monokai-amethyst/15 text-monokai-amethyst hover:bg-monokai-amethyst/25 border border-monokai-amethyst/20
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
              <Database className="w-3.5 h-3.5 text-monokai-amethyst/70" />
              <span className="text-monokai-orange/80">本体论未初始化 — 请在左侧点击「一键构建并挂载」</span>
            </span>
          ) : (
            <>
              <span>Entities: <strong className="text-monokai-blue">{state.objects?.length ?? 0}</strong></span>
              <span>Edges: <strong className="text-monokai-amethyst">{state.links?.length ?? 0}</strong></span>
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
                className="shrink-0 whitespace-nowrap px-2 py-1 rounded-lg text-xs bg-monokai-amethyst/10 text-monokai-amethyst hover:bg-monokai-amethyst/20 transition-colors disabled:opacity-50">
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
                    className="absolute right-0 top-0 w-[4px] h-full cursor-col-resize hover:bg-gradient-to-b hover:from-monokai-cyan hover:to-monokai-amethyst transition-all duration-300 z-20 group hover:shadow-[0_0_12px_rgba(102,217,239,0.8)]">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"><GripVertical className="w-4 h-4 text-monokai-cyan" /></div>
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
                      <PatternLibraryPanel
                        state={state}
                        activeTemplateId={activeTemplateId}
                        switchTemplate={switchTemplate}
                        onTablesReady={onTablesReady}
                      />
                    )}
                    {drawerTab === 'crud' && <CRUDList onInspect={openInspector} onRequestDelete={(type, id, label) => setDeleteConfirm({ type, id, label })} />}
                    {drawerTab === 'mapping' && <MappingConsole />}
                  </div>
                </div>
              )}

              {/* CENTER CANVAS */}
              <div className="flex-1 relative overflow-hidden bg-[#0c0d12]">
                {activeTab === 'graph' && <D3GraphView onRefreshRef={fn => d3GraphRefreshRef.current = fn} ontologyState={state} isActive={isActive} onInspect={openInspector} />}
                {activeTab === 'data' && <OntologyDataView ontologyState={state} />}
                {activeTab === 'canvas' && <OntologyCanvas onInsert={onInsert} ontologyState={state} onInspect={openInspector} />}
              </div>

              {/* RIGHT INSPECTOR PANEL */}
              {inspectorMode !== 'none' && (
                <div style={{ width: rightWidth }} className="flex-shrink-0 flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.5)] z-20 relative bg-monokai-bg/90 backdrop-blur-2xl">
                   {/* Resizer Handle Right */}
                  <div onMouseDown={startResizingRight} onTouchStart={startResizingRight}
                    className="absolute left-0 top-0 w-[4px] h-full cursor-col-resize hover:bg-gradient-to-b hover:from-monokai-cyan hover:to-monokai-amethyst transition-all duration-300 z-20 group hover:shadow-[0_0_12px_rgba(102,217,239,0.8)]">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"><GripVertical className="w-4 h-4 text-monokai-cyan" /></div>
                  </div>
                  <RightInspector key={`inspector-${inspectorMode}-${inspectorTarget?.id ?? 'new'}`} mode={inspectorMode} target={inspectorTarget} onClose={() => setInspectorMode('none')} onSave={handleGraphSaved} onInspect={openInspector} />
                </div>
              )}

              {/* INSIGHTS PANEL (Alternative Right Pane) */}
              {state.insightsOpen && inspectorMode === 'none' && (
                <div style={{ width: rightWidth }} className="flex-shrink-0 flex flex-col bg-monokai-bg/90 border-l border-monokai-accent/20 shadow-[-10px_0_30px_rgba(0,0,0,0.5)] z-20 relative backdrop-blur-2xl">
                   {/* Resizer Handle Right for Insights */}
                  <div onMouseDown={startResizingRight} onTouchStart={startResizingRight}
                    className="absolute left-0 top-0 w-[4px] h-full cursor-col-resize hover:bg-gradient-to-b hover:from-monokai-cyan hover:to-monokai-amethyst transition-all duration-300 z-20 group hover:shadow-[0_0_12px_rgba(102,217,239,0.8)]">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"><GripVertical className="w-4 h-4 text-monokai-cyan" /></div>
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
                  else if (deleteConfirm.type === 'introspection') await deleteIntrospection(deleteConfirm.id);
                  else if (deleteConfirm.type === 'insight') await deleteInsight(deleteConfirm.id);
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
