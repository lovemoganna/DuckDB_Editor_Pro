/**
 * OntologyView — 本体论统一视图（重构版 v2）
 *
 * 三层架构：
 *  ┌─────────────────────────────────────────────────┐
 *  │ L1: Layer Toolbar — MECE 五层切换 + 视图模式    │
 *  ├────────────┬────────────────────────────────────┤
 *  │ L2: Left  │ L3: Canvas (Graph / Canvas / Data) │
 *  │ AI Workbench  │                                    │
 *  │ CRUD + 模板   │                                    │
 *  └────────────┴────────────────────────────────────┘
 *
 * 设计原则：
 * 1. useOntologyStore = 唯一数据源（Single Source of Truth）
 * 2. 所有子组件通过 store 访问数据，不各自维护状态
 * 3. AI Workbench 统一入口，根据当前 MECE 层提供上下文感知 AI
 * 4. 视图模式（Data/Graph/Canvas）与 MECE 层正交，可自由组合
 */

import React, { useReducer, useEffect, useCallback, useMemo, useState } from 'react';
import {
  X, Network, Database, Layers, TrendingUp, BookOpen, Sparkles,
  ChevronRight, ChevronDown, ArrowRight, Plus, RefreshCw, Check,
  Search, AlertTriangle, RotateCcw, Trash2, Edit3, Link2,
  Play, Copy, Loader, Brain, Eye, LayoutGrid, Zap,
  ArrowDownRight, Lightbulb, Menu,
} from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { EditorView } from '@codemirror/view';
import { monokai } from '@uiw/codemirror-theme-monokai';
import { duckDBService } from '../services/duckdbService';
import { ResultTable } from './Learn/ResultTable';
import D3GraphView from './Library/D3GraphView';
import OntologyCanvas from './Library/OntologyCanvas';
import { ontologyAiService, OntologyDraftPayload } from '../services/ontologyAiService';
import { ONTOLOGY_TEMPLATES, MECE_LAYERS, SqlTemplate } from '../data/ontologyTemplates';
import { AIFillPanel } from './Library/AIFillPanel';
import { useAIFill, AIFillMode, layerToMode } from '../hooks/useAIFill';
import { useOntologyStore, ONTOLOGY_LAYERS, MECELayer } from '../hooks/useOntologyStore';

// Types from useOntologyStore
type ViewMode = 'graph' | 'canvas' | 'data';

type InitState = 'loading' | 'no-tables' | 'need-seed' | 'ready';

// ============================================================
// Reducer & State (local UI state only — data from store)
// ============================================================

interface LocalUIState {
  initState: InitState;
  initting: boolean;
  viewMode: ViewMode;
  drawerOpen: boolean;
  insightsOpen: boolean;
  expandedTemplates: Set<string>;
  executionResults: Record<string, { data: any[] | null; error: string | null; loading: boolean; executionTime?: number }>;
  error: string | null;
  aiTopic: string;
  isGenerating: boolean;
  draftPayload: OntologyDraftPayload | null;
  draftJsonStr: string;
  activeLayer: MECELayer;
}

type UIAction =
  | { type: 'SET_INIT_STATE'; state: InitState }
  | { type: 'SET_INITTING'; value: boolean }
  | { type: 'SET_VIEW_MODE'; mode: ViewMode }
  | { type: 'TOGGLE_DRAWER' }
  | { type: 'TOGGLE_INSIGHTS' }
  | { type: 'TOGGLE_TEMPLATE'; id: string }
  | { type: 'SET_EXECUTION'; id: string; result: LocalUIState['executionResults'][string] }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_AI_TOPIC'; topic: string }
  | { type: 'SET_GENERATING'; value: boolean }
  | { type: 'SET_DRAFT'; payload: OntologyDraftPayload | null; jsonStr?: string }
  | { type: 'CLEAR_DRAFT' }
  | { type: 'SET_ACTIVE_LAYER'; layer: MECELayer };

function uiReducer(state: LocalUIState, action: UIAction): LocalUIState {
  switch (action.type) {
    case 'SET_INIT_STATE': return { ...state, initState: action.state };
    case 'SET_INITTING': return { ...state, initting: action.value };
    case 'SET_VIEW_MODE': return { ...state, viewMode: action.mode };
    case 'TOGGLE_DRAWER': return { ...state, drawerOpen: !state.drawerOpen };
    case 'TOGGLE_INSIGHTS': return { ...state, insightsOpen: !state.insightsOpen };
    case 'TOGGLE_TEMPLATE': {
      const next = new Set(state.expandedTemplates);
      if (next.has(action.id)) next.delete(action.id);
      else next.add(action.id);
      return { ...state, expandedTemplates: next };
    }
    case 'SET_EXECUTION':
      return { ...state, executionResults: { ...state.executionResults, [action.id]: action.result } };
    case 'SET_ERROR': return { ...state, error: action.error };
    case 'SET_AI_TOPIC': return { ...state, aiTopic: action.topic };
    case 'SET_GENERATING': return { ...state, isGenerating: action.value };
    case 'SET_DRAFT': return { ...state, draftPayload: action.payload, draftJsonStr: action.jsonStr ?? '' };
    case 'CLEAR_DRAFT': return { ...state, draftPayload: null, draftJsonStr: '', aiTopic: '' };
    case 'SET_ACTIVE_LAYER': return { ...state, activeLayer: action.layer };
    default: return state;
  }
}

const initUIState: LocalUIState = {
  initState: 'loading',
  initting: false,
  viewMode: 'graph',
  drawerOpen: true,
  insightsOpen: false,
  expandedTemplates: new Set(),
  executionResults: {},
  error: null,
  aiTopic: '',
  isGenerating: false,
  draftPayload: null,
  draftJsonStr: '',
  activeLayer: 'domains',
};

// ============================================================
// Helper Components
// ============================================================

const LAYER_ICONS: Record<MECELayer, React.ElementType> = {
  foundation: Database,
  relations: Link2,
  methodology: Layers,
  patterns: TrendingUp,
  domains: BookOpen,
};

const LAYER_COLORS: Record<string, string> = {
  foundation: 'monokai-purple',
  relations: 'monokai-green',
  methodology: 'monokai-cyan',
  patterns: 'monokai-yellow',
  domains: 'monokai-blue',
};

const Toast: React.FC<{ message: string; type: 'success' | 'error'; onClose: () => void }> = ({ message, type, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-lg shadow-2xl text-xs font-medium ${
      type === 'success'
        ? 'bg-monokai-green/20 text-monokai-green border border-monokai-green/30'
        : 'bg-monokai-orange/20 text-monokai-orange border border-monokai-orange/30'
    }`}>
      {message}
    </div>
  );
};

const ConfirmDialog: React.FC<{
  title: string; message: string;
  onConfirm: () => void; onCancel: () => void;
}> = ({ title, message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
    <div className="w-full max-w-sm bg-monokai-bg border border-monokai-orange/40 rounded-xl shadow-2xl p-5" onClick={e => e.stopPropagation()}>
      <div className="flex items-center gap-3 mb-3">
        <AlertTriangle className="w-5 h-5 text-monokai-orange" />
        <h3 className="text-sm font-semibold text-monokai-fg">{title}</h3>
      </div>
      <p className="text-xs text-monokai-comment mb-4">{message}</p>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs text-monokai-comment hover:text-monokai-fg rounded hover:bg-monokai-accent/20 transition-colors">取消</button>
        <button onClick={onConfirm} className="px-3 py-1.5 text-xs bg-monokai-orange/20 text-monokai-orange rounded hover:bg-monokai-orange/30 transition-colors font-medium">确认删除</button>
      </div>
    </div>
  </div>
);

// ============================================================
// CRUD Panel (refactored — reads from store)
// ============================================================

interface CRUDPanelProps {
  objectTypes: any[];
  objects: any[];
  linkTypes: any[];
  links: any[];
  actions: any[];
  layer: MECELayer;
  onRefresh: () => void;
}

const CRUDPanel: React.FC<CRUDPanelProps> = ({
  objectTypes, objects, linkTypes, links, actions, layer, onRefresh,
}) => {
  const [editMode, setEditMode] = useState<'none' | 'object' | 'link' | 'action' | 'objectType' | 'linkType'>('none');
  const [editTarget, setEditTarget] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: number; label: string } | null>(null);
  const [toastMsg, setToastMsg] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [form, setForm] = useState({
    name: '', desc: '', objectTypeId: 1, properties: '',
    linkTypeId: 1, sourceId: null as number | null, targetId: null as number | null, weight: 0.5,
    status: 'pending', executeAt: '',
  });

  const showToast = (message: string, type: 'success' | 'error') => {
    setToastMsg({ message, type });
  };

  const resetForm = () => setForm({ name: '', desc: '', objectTypeId: 1, properties: '', linkTypeId: 1, sourceId: null, targetId: null, weight: 0.5, status: 'pending', executeAt: '' });

  const openCreate = (mode: typeof editMode) => { setEditMode(mode); setEditTarget(null); resetForm(); };

  const openEdit = (mode: typeof editMode, target: any) => {
    setEditMode(mode); setEditTarget(target);
    if (mode === 'objectType') setForm(f => ({ ...f, name: target.name, desc: target.description || '' }));
    else if (mode === 'object') setForm(f => ({ ...f, name: target.name, objectTypeId: target.object_type_id, properties: target.properties || '' }));
    else if (mode === 'linkType') setForm(f => ({ ...f, name: target.name, desc: target.description || '' }));
    else if (mode === 'link') setForm(f => ({ ...f, linkTypeId: target.link_type_id, sourceId: target.source_object_id, targetId: target.target_object_id, weight: target.weight }));
    else if (mode === 'action') setForm(f => ({ ...f, name: target.name, desc: target.description || '', status: target.status || 'pending', executeAt: target.execute_at || '' }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { showToast('名称不能为空', 'error'); return; }
    try {
      if (editMode === 'objectType') {
        if (editTarget) await duckDBService.query(`UPDATE life_object_type SET name='${form.name}', description='${form.desc}' WHERE id=${editTarget.id}`);
        else { const maxId = objectTypes.length ? Math.max(...objectTypes.map(o => o.id)) : 0; await duckDBService.query(`INSERT INTO life_object_type VALUES (${maxId + 1}, '${form.name}', '${form.desc}')`); }
      } else if (editMode === 'object') {
        const props = form.properties.trim() || '{}';
        if (editTarget) await duckDBService.query(`UPDATE life_object SET object_type_id=${form.objectTypeId}, name='${form.name}', properties='${props}' WHERE id=${editTarget.id}`);
        else { const maxId = objects.length ? Math.max(...objects.map(o => o.id)) : 0; await duckDBService.query(`INSERT INTO life_object (id, object_type_id, name, properties) VALUES (${maxId + 1}, ${form.objectTypeId}, '${form.name}', '${props}')`); }
      } else if (editMode === 'linkType') {
        if (editTarget) await duckDBService.query(`UPDATE life_link_type SET name='${form.name}', description='${form.desc}' WHERE id=${editTarget.id}`);
        else { const maxId = linkTypes.length ? Math.max(...linkTypes.map(l => l.id)) : 0; await duckDBService.query(`INSERT INTO life_link_type VALUES (${maxId + 1}, '${form.name}', '${form.desc}')`); }
      } else if (editMode === 'link') {
        if (form.sourceId === null || form.targetId === null) { showToast('请选择源对象和目标对象', 'error'); return; }
        if (editTarget) await duckDBService.query(`UPDATE life_link SET link_type_id=${form.linkTypeId}, source_object_id=${form.sourceId}, target_object_id=${form.targetId}, weight=${form.weight} WHERE id=${editTarget.id}`);
        else { const maxId = links.length ? Math.max(...links.map(l => l.id)) : 0; await duckDBService.query(`INSERT INTO life_link VALUES (${maxId + 1}, ${form.linkTypeId}, ${form.sourceId}, ${form.targetId}, ${form.weight})`); }
      } else if (editMode === 'action') {
        const execDate = form.executeAt ? `'${form.executeAt}'` : 'NULL';
        if (editTarget) await duckDBService.query(`UPDATE life_action SET name='${form.name}', description='${form.desc}', status='${form.status}', execute_at=${execDate} WHERE id=${editTarget.id}`);
        else { const maxId = actions.length ? Math.max(...actions.map(a => a.id)) : 0; await duckDBService.query(`INSERT INTO life_action VALUES (${maxId + 1}, '${form.name}', '${form.desc}', '${form.status}', ${execDate})`); }
      }
      showToast('已保存', 'success');
      setEditMode('none'); setEditTarget(null);
      setTimeout(onRefresh, 100);
    } catch (e: any) { showToast(`操作失败: ${e.message}`, 'error'); }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      if (deleteConfirm.type === 'objectType') await duckDBService.query(`DELETE FROM life_object_type WHERE id=${deleteConfirm.id}`);
      else if (deleteConfirm.type === 'object') await duckDBService.deleteOntologyNodeTree(deleteConfirm.id);
      else if (deleteConfirm.type === 'linkType') await duckDBService.query(`DELETE FROM life_link_type WHERE id=${deleteConfirm.id}`);
      else if (deleteConfirm.type === 'link') await duckDBService.deleteOntologyLink(deleteConfirm.id);
      else if (deleteConfirm.type === 'action') await duckDBService.query(`DELETE FROM life_action WHERE id=${deleteConfirm.id}`);
      showToast('已删除', 'success');
      setDeleteConfirm(null);
      setTimeout(onRefresh, 100);
    } catch (e: any) { showToast(`删除失败: ${e.message}`, 'error'); setDeleteConfirm(null); }
  };

  const objectTypeMap = useMemo(() => { const m: Record<number, string> = {}; objectTypes.forEach(o => { m[o.id] = o.name; }); return m; }, [objectTypes]);
  const linkTypeMap = useMemo(() => { const m: Record<number, string> = {}; linkTypes.forEach(l => { m[l.id] = l.name; }); return m; }, [linkTypes]);
  const objectNameMap = useMemo(() => { const m: Record<number, string> = {}; objects.forEach(o => { m[o.id] = o.name; }); return m; }, [objects]);

  const showObjectType = layer === 'foundation' || layer === 'domains';
  const showObject = layer === 'foundation' || layer === 'patterns' || layer === 'domains';
  const showLinkType = layer === 'foundation' || layer === 'relations' || layer === 'patterns' || layer === 'domains';
  const showLink = layer === 'relations' || layer === 'patterns' || layer === 'domains';
  const showAction = layer === 'methodology' || layer === 'domains';

  const [expanded, setExpanded] = useState<Record<string, boolean>>({ objectTypes: true, objects: true, linkTypes: true, links: true, actions: true });
  const toggleSection = (s: string) => setExpanded(prev => ({ ...prev, [s]: !prev[s] }));

  return (
    <div className="w-full flex flex-col bg-monokai-bg">
      <div className="flex items-center justify-between px-4 py-2 border-b border-monokai-accent/50 bg-monokai-sidebar">
        <div className="flex items-center gap-3 text-[10px] text-monokai-comment">
          {showObjectType && <span>类型 <strong className="text-monokai-purple">{objectTypes.length}</strong></span>}
          {showObject && <span>对象 <strong className="text-monokai-blue">{objects.length}</strong></span>}
          {showLinkType && <span>关系类型 <strong className="text-monokai-green">{linkTypes.length}</strong></span>}
          {showLink && <span>关系 <strong className="text-monokai-orange">{links.length}</strong></span>}
          {showAction && <span>行动 <strong className="text-monokai-yellow">{actions.length}</strong></span>}
        </div>
        <button onClick={onRefresh}
          className="flex items-center gap-1 px-2.5 py-1 text-xs text-monokai-comment hover:text-monokai-fg hover:bg-monokai-accent/20 rounded transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> 刷新
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[50vh]">
        {showObjectType && (
          <div className="border border-monokai-accent/30 rounded-lg overflow-hidden">
            <button onClick={() => toggleSection('objectTypes')} className="w-full flex items-center justify-between px-4 py-2.5 bg-monokai-purple/5 hover:bg-monokai-purple/10 transition-colors">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-monokai-purple" />
                <span className="text-xs font-semibold text-monokai-fg">对象类型</span>
                <span className="text-[10px] text-monokai-comment">({objectTypes.length})</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={e => { e.stopPropagation(); openCreate('objectType'); }} className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-monokai-purple/15 text-monokai-purple rounded hover:bg-monokai-purple/25 transition-colors"><Plus className="w-3 h-3" /> 新建</button>
                {expanded['objectTypes'] ? <ChevronDown className="w-4 h-4 text-monokai-comment" /> : <ChevronRight className="w-4 h-4 text-monokai-comment" />}
              </div>
            </button>
            {expanded['objectTypes'] && (
              <div className="divide-y divide-monokai-accent/20">
                {objectTypes.length === 0 ? <div className="px-4 py-3 text-xs text-monokai-comment text-center">暂无数据</div>
                  : objectTypes.map(ot => (
                    <div key={ot.id} className="flex items-center justify-between px-4 py-2 hover:bg-monokai-accent/5 group transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-sm bg-monokai-purple shrink-0" />
                        <div>
                          <div className="text-xs font-medium text-monokai-fg">{ot.name}</div>
                          {ot.description && <div className="text-[10px] text-monokai-comment">{ot.description}</div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit('objectType', ot)} className="p-1 rounded text-monokai-comment hover:text-monokai-blue hover:bg-monokai-blue/10"><Edit3 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setDeleteConfirm({ type: 'objectType', id: ot.id, label: ot.name })} className="p-1 rounded text-monokai-comment hover:text-monokai-orange hover:bg-monokai-orange/10"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {showObject && (
          <div className="border border-monokai-accent/30 rounded-lg overflow-hidden">
            <button onClick={() => toggleSection('objects')} className="w-full flex items-center justify-between px-4 py-2.5 bg-monokai-blue/5 hover:bg-monokai-blue/10 transition-colors">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-monokai-blue" />
                <span className="text-xs font-semibold text-monokai-fg">对象实例</span>
                <span className="text-[10px] text-monokai-comment">({objects.length})</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={e => { e.stopPropagation(); openCreate('object'); }} className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-monokai-blue/15 text-monokai-blue rounded hover:bg-monokai-blue/25 transition-colors"><Plus className="w-3 h-3" /> 新建</button>
                {expanded['objects'] ? <ChevronDown className="w-4 h-4 text-monokai-comment" /> : <ChevronRight className="w-4 h-4 text-monokai-comment" />}
              </div>
            </button>
            {expanded['objects'] && (
              <div className="divide-y divide-monokai-accent/20">
                {objects.length === 0 ? <div className="px-4 py-3 text-xs text-monokai-comment text-center">暂无数据</div>
                  : objects.map(obj => {
                    let props: Record<string, string> = {}; try { props = JSON.parse(obj.properties || '{}'); } catch {}
                    return (
                      <div key={obj.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-monokai-accent/5 group transition-colors">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-2 h-2 rounded-sm bg-monokai-blue shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className="text-xs font-medium text-monokai-fg truncate">{obj.name}</div>
                              <span className="px-1.5 py-0.5 text-[9px] bg-monokai-purple/15 text-monokai-purple rounded shrink-0">{objectTypeMap[obj.object_type_id] || '?'}</span>
                            </div>
                            {Object.keys(props).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {Object.entries(props).slice(0, 3).map(([k, v]) => (
                                  <span key={k} className="text-[9px] text-monokai-comment"><span className="text-monokai-purple/70">{k}</span>: {String(v)}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                          <button onClick={() => openEdit('object', obj)} className="p-1 rounded text-monokai-comment hover:text-monokai-blue hover:bg-monokai-blue/10"><Edit3 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setDeleteConfirm({ type: 'object', id: obj.id, label: obj.name })} className="p-1 rounded text-monokai-comment hover:text-monokai-orange hover:bg-monokai-orange/10"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {showLinkType && (
          <div className="border border-monokai-accent/30 rounded-lg overflow-hidden">
            <button onClick={() => toggleSection('linkTypes')} className="w-full flex items-center justify-between px-4 py-2.5 bg-monokai-green/5 hover:bg-monokai-green/10 transition-colors">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-monokai-green" />
                <span className="text-xs font-semibold text-monokai-fg">关系类型</span>
                <span className="text-[10px] text-monokai-comment">({linkTypes.length})</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={e => { e.stopPropagation(); openCreate('linkType'); }} className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-monokai-green/15 text-monokai-green rounded hover:bg-monokai-green/25 transition-colors"><Plus className="w-3 h-3" /> 新建</button>
                {expanded['linkTypes'] ? <ChevronDown className="w-4 h-4 text-monokai-comment" /> : <ChevronRight className="w-4 h-4 text-monokai-comment" />}
              </div>
            </button>
            {expanded['linkTypes'] && (
              <div className="divide-y divide-monokai-accent/20">
                {linkTypes.length === 0 ? <div className="px-4 py-3 text-xs text-monokai-comment text-center">暂无数据</div>
                  : linkTypes.map(lt => (
                    <div key={lt.id} className="flex items-center justify-between px-4 py-2 hover:bg-monokai-accent/5 group transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-sm bg-monokai-green shrink-0" />
                        <div>
                          <div className="text-xs font-medium text-monokai-fg">{lt.name}</div>
                          {lt.description && <div className="text-[10px] text-monokai-comment">{lt.description}</div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit('linkType', lt)} className="p-1 rounded text-monokai-comment hover:text-monokai-blue hover:bg-monokai-blue/10"><Edit3 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setDeleteConfirm({ type: 'linkType', id: lt.id, label: lt.name })} className="p-1 rounded text-monokai-comment hover:text-monokai-orange hover:bg-monokai-orange/10"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {showLink && (
          <div className="border border-monokai-accent/30 rounded-lg overflow-hidden">
            <button onClick={() => toggleSection('links')} className="w-full flex items-center justify-between px-4 py-2.5 bg-monokai-orange/5 hover:bg-monokai-orange/10 transition-colors">
              <div className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-monokai-orange" />
                <span className="text-xs font-semibold text-monokai-fg">关系实例</span>
                <span className="text-[10px] text-monokai-comment">({links.length})</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={e => { e.stopPropagation(); openCreate('link'); }} className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-monokai-orange/15 text-monokai-orange rounded hover:bg-monokai-orange/25 transition-colors"><Plus className="w-3 h-3" /> 新建</button>
                {expanded['links'] ? <ChevronDown className="w-4 h-4 text-monokai-comment" /> : <ChevronRight className="w-4 h-4 text-monokai-comment" />}
              </div>
            </button>
            {expanded['links'] && (
              <div className="divide-y divide-monokai-accent/20">
                {links.length === 0 ? <div className="px-4 py-3 text-xs text-monokai-comment text-center">暂无数据</div>
                  : links.map(link => (
                    <div key={link.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-monokai-accent/5 group transition-colors">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-xs text-monokai-purple shrink-0">{objectNameMap[link.source_object_id] || `?(${link.source_object_id})`}</span>
                        <ArrowRight className="w-3 h-3 text-monokai-comment shrink-0" />
                        <span className="px-1.5 py-0.5 text-[9px] bg-monokai-green/15 text-monokai-green rounded shrink-0">{linkTypeMap[link.link_type_id] || '?'}</span>
                        <ArrowRight className="w-3 h-3 text-monokai-comment shrink-0" />
                        <span className="text-xs text-monokai-blue shrink-0">{objectNameMap[link.target_object_id] || `?(${link.target_object_id})`}</span>
                        <span className="ml-1 px-1 py-0.5 text-[10px] font-mono bg-monokai-orange/10 text-monokai-orange rounded shrink-0">{Number(link.weight).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                        <button onClick={() => openEdit('link', link)} className="p-1 rounded text-monokai-comment hover:text-monokai-blue hover:bg-monokai-blue/10"><Edit3 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setDeleteConfirm({ type: 'link', id: link.id, label: `${objectNameMap[link.source_object_id]} → ${linkTypeMap[link.link_type_id]} → ${objectNameMap[link.target_object_id]}` })} className="p-1 rounded text-monokai-comment hover:text-monokai-orange hover:bg-monokai-orange/10"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {showAction && (
          <div className="border border-monokai-accent/30 rounded-lg overflow-hidden">
            <button onClick={() => toggleSection('actions')} className="w-full flex items-center justify-between px-4 py-2.5 bg-monokai-yellow/5 hover:bg-monokai-yellow/10 transition-colors">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-monokai-yellow" />
                <span className="text-xs font-semibold text-monokai-fg">行动列表</span>
                <span className="text-[10px] text-monokai-comment">({actions.length})</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={e => { e.stopPropagation(); openCreate('action'); }} className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-monokai-yellow/15 text-monokai-yellow rounded hover:bg-monokai-yellow/25 transition-colors"><Plus className="w-3 h-3" /> 新建</button>
                {expanded['actions'] ? <ChevronDown className="w-4 h-4 text-monokai-comment" /> : <ChevronRight className="w-4 h-4 text-monokai-comment" />}
              </div>
            </button>
            {expanded['actions'] && (
              <div className="divide-y divide-monokai-accent/20">
                {actions.length === 0 ? <div className="px-4 py-6 text-xs text-monokai-comment text-center">暂无行动</div>
                  : actions.map(action => (
                    <div key={action.id} className="flex items-center justify-between px-4 py-3 hover:bg-monokai-accent/5 group transition-colors">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="mt-0.5 shrink-0">
                          {action.status === 'done' ? <Check className="w-4 h-4 text-monokai-green" /> : <div className="w-4 h-4 rounded border-2 border-monokai-comment/40" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="text-xs font-medium text-monokai-fg truncate">{action.name}</div>
                            <span className={`px-1.5 py-0.5 text-[10px] rounded ${action.status === 'done' ? 'bg-monokai-green/15 text-monokai-green' : 'bg-monokai-orange/15 text-monokai-orange'}`}>
                              {action.status === 'done' ? '已完成' : '待执行'}
                            </span>
                          </div>
                          {action.description && <div className="text-[10px] text-monokai-comment mt-0.5 truncate">{action.description}</div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                        <button onClick={() => openEdit('action', action)} className="p-1 rounded text-monokai-comment hover:text-monokai-blue hover:bg-monokai-blue/10"><Edit3 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setDeleteConfirm({ type: 'action', id: action.id, label: action.name })} className="p-1 rounded text-monokai-comment hover:text-monokai-orange hover:bg-monokai-orange/10"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      {deleteConfirm && <ConfirmDialog title="确认删除" message={`确定要删除「${deleteConfirm.label}」吗？此操作不可撤销。`} onConfirm={handleDelete} onCancel={() => setDeleteConfirm(null)} />}

      {editMode !== 'none' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setEditMode('none')}>
          <div className="w-full max-w-lg bg-monokai-bg border border-monokai-accent/50 rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-monokai-accent shrink-0">
              <span className="text-sm font-semibold text-monokai-fg">
                {editMode === 'objectType' && (editTarget ? '编辑对象类型' : '新建对象类型')}
                {editMode === 'object' && (editTarget ? '编辑对象' : '新建对象')}
                {editMode === 'linkType' && (editTarget ? '编辑关系类型' : '新建关系类型')}
                {editMode === 'link' && (editTarget ? '编辑关系' : '新建关系')}
                {editMode === 'action' && (editTarget ? '编辑行动' : '新建行动')}
              </span>
              <button onClick={() => setEditMode('none')} className="p-1 rounded hover:bg-monokai-accent/30 text-monokai-comment"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-[10px] text-monokai-comment uppercase tracking-wider mb-1">名称 <span className="text-monokai-orange">*</span></label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="输入名称..."
                  className="w-full px-3 py-2 text-sm bg-monokai-sidebar border border-monokai-accent text-monokai-fg placeholder-monokai-comment/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-monokai-green/50 transition-all" />
              </div>
              {(editMode === 'objectType' || editMode === 'linkType') && (
                <div>
                  <label className="block text-[10px] text-monokai-comment uppercase tracking-wider mb-1">描述</label>
                  <input type="text" value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} placeholder="输入描述..."
                    className="w-full px-3 py-2 text-sm bg-monokai-sidebar border border-monokai-accent text-monokai-fg placeholder-monokai-comment/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-monokai-green/50 transition-all" />
                </div>
              )}
              {editMode === 'object' && (
                <>
                  <div>
                    <label className="block text-[10px] text-monokai-comment uppercase tracking-wider mb-1">对象类型</label>
                    <select value={form.objectTypeId} onChange={e => setForm(f => ({ ...f, objectTypeId: Number(e.target.value) }))}
                      className="w-full px-3 py-2 text-sm bg-monokai-sidebar border border-monokai-accent text-monokai-fg rounded-lg focus:outline-none focus:ring-2 focus:ring-monokai-green/50 transition-all">
                      {objectTypes.map(ot => <option key={ot.id} value={ot.id}>{ot.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-monokai-comment uppercase tracking-wider mb-1">属性 (JSON)</label>
                    <textarea value={form.properties} onChange={e => setForm(f => ({ ...f, properties: e.target.value }))}
                      placeholder='{"state": "焦虑", "goal": "内心平静"}' rows={3}
                      className="w-full px-3 py-2 text-sm bg-monokai-sidebar border border-monokai-accent text-monokai-fg placeholder-monokai-comment/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-monokai-green/50 transition-all resize-none font-mono" />
                  </div>
                </>
              )}
              {editMode === 'link' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-monokai-comment uppercase tracking-wider mb-1">源对象</label>
                      <select value={form.sourceId ?? ''} onChange={e => setForm(f => ({ ...f, sourceId: e.target.value ? Number(e.target.value) : null }))}
                        className="w-full px-3 py-2 text-sm bg-monokai-sidebar border border-monokai-accent text-monokai-fg rounded-lg focus:outline-none focus:ring-2 focus:ring-monokai-green/50 transition-all">
                        <option value="">选择源对象</option>
                        {objects.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-monokai-comment uppercase tracking-wider mb-1">目标对象</label>
                      <select value={form.targetId ?? ''} onChange={e => setForm(f => ({ ...f, targetId: e.target.value ? Number(e.target.value) : null }))}
                        className="w-full px-3 py-2 text-sm bg-monokai-sidebar border border-monokai-accent text-monokai-fg rounded-lg focus:outline-none focus:ring-2 focus:ring-monokai-green/50 transition-all">
                        <option value="">选择目标对象</option>
                        {objects.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] text-monokai-comment uppercase tracking-wider mb-1">关系类型</label>
                    <select value={form.linkTypeId} onChange={e => setForm(f => ({ ...f, linkTypeId: Number(e.target.value) }))}
                      className="w-full px-3 py-2 text-sm bg-monokai-sidebar border border-monokai-accent text-monokai-fg rounded-lg focus:outline-none focus:ring-2 focus:ring-monokai-green/50 transition-all">
                      {linkTypes.map(lt => <option key={lt.id} value={lt.id}>{lt.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-monokai-comment uppercase tracking-wider mb-1">强度权重: <span className="text-monokai-fg font-mono">{form.weight.toFixed(2)}</span></label>
                    <input type="range" min={0} max={1} step={0.05} value={form.weight} onChange={e => setForm(f => ({ ...f, weight: parseFloat(e.target.value) }))}
                      className="w-full accent-monokai-green" />
                  </div>
                </>
              )}
              {editMode === 'action' && (
                <>
                  <div>
                    <label className="block text-[10px] text-monokai-comment uppercase tracking-wider mb-1">描述</label>
                    <textarea value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} rows={2}
                      className="w-full px-3 py-2 text-sm bg-monokai-sidebar border border-monokai-accent text-monokai-fg placeholder-monokai-comment/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-monokai-green/50 transition-all resize-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-monokai-comment uppercase tracking-wider mb-1">状态</label>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                      className="w-full px-3 py-2 text-sm bg-monokai-sidebar border border-monokai-accent text-monokai-fg rounded-lg focus:outline-none focus:ring-2 focus:ring-monokai-green/50 transition-all">
                      <option value="pending">待执行</option><option value="done">已完成</option>
                    </select>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-t border-monokai-accent bg-monokai-sidebar/30 shrink-0">
              <button onClick={() => setEditMode('none')} className="px-3 py-1.5 text-xs text-monokai-comment hover:text-monokai-fg rounded hover:bg-monokai-accent/20 transition-colors">取消</button>
              <button onClick={handleSave}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-monokai-green/20 text-monokai-green rounded-lg hover:bg-monokai-green/30 transition-colors">
                <Check className="w-3.5 h-3.5" /> 保存
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMsg && <Toast message={toastMsg.message} type={toastMsg.type} onClose={() => setToastMsg(null)} />}
    </div>
  );
};

// ============================================================
// Template Panel
// ============================================================

interface TemplatePanelProps {
  layer: MECELayer;
  expandedTemplates: Set<string>;
  executionResults: Record<string, { data: any[] | null; error: string | null; loading: boolean; executionTime?: number }>;
  onToggleTemplate: (id: string) => void;
  onExecute: (id: string, sql: string, refreshTables?: boolean) => void;
}

const TemplatePanel: React.FC<TemplatePanelProps> = ({
  layer, expandedTemplates, executionResults, onToggleTemplate, onExecute,
}) => {
  const layerConfig = ONTOLOGY_TEMPLATES[layer];
  if (!layerConfig) return null;
  const templates = layerConfig.templates;

  return (
    <div className="h-full overflow-y-auto p-4 space-y-2">
      {templates.map(tpl => {
        const result = executionResults[tpl.id];
        const isExpanded = expandedTemplates.has(tpl.id);
        return (
          <div key={tpl.id} className="bg-monokai-sidebar border border-monokai-accent/50 rounded-lg overflow-hidden">
            <div className="px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-monokai-accent/5"
              onClick={() => onToggleTemplate(tpl.id)}>
              <div className="flex items-center gap-2 min-w-0">
                {result?.error ? <span className="text-monokai-red text-[10px]">✕</span>
                  : result?.data !== null && result?.data !== undefined ? <span className="text-monokai-green text-[10px]">✓</span>
                  : null}
                <span className="text-xs font-medium text-monokai-fg">{tpl.label}</span>
                {tpl.description && <span className="text-[10px] text-monokai-comment hidden sm:inline">— {tpl.description}</span>}
              </div>
              {isExpanded ? <ChevronDown className="w-3 h-3 text-monokai-comment shrink-0" />
                : <ChevronRight className="w-3 h-3 text-monokai-comment shrink-0" />}
            </div>
            {isExpanded && (
              <>
                <div className="px-3 py-1.5 bg-monokai-accent/5 border-t border-monokai-accent/30 flex items-center gap-1">
                  <button onClick={e => { e.stopPropagation(); onExecute(tpl.id, tpl.sql, tpl.refreshTables); }}
                    disabled={result?.loading}
                    className={`p-1.5 rounded transition-colors ${result?.loading ? 'bg-monokai-yellow/20 text-monokai-yellow cursor-wait' : 'hover:bg-monokai-green/30 text-monokai-comment hover:text-monokai-green'}`}
                    title="执行 SQL">
                    {result?.loading ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(tpl.sql); }}
                    className="p-1.5 rounded hover:bg-monokai-accent/30 text-monokai-comment hover:text-monokai-fg transition-colors" title="复制">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div>
                  <CodeMirror value={tpl.sql} height="auto" theme={monokai}
                    extensions={[sql(), EditorView.lineWrapping, EditorView.theme({ "&": { fontSize: "12px" }, ".cm-content": { fontSize: "12px" }, ".cm-line": { fontSize: "12px" } })]}
                    editable={false} basicSetup={false} />
                </div>
                {result && (
                  <ResultTable data={result.data || []} error={result.error} loading={result.loading} executionTime={result.executionTime} />
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ============================================================
// Empty State
// ============================================================

interface EmptyStateProps {
  onQuickInit: () => void;
  onAIGenerate: () => void;
  onManualCreate: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ onQuickInit, onAIGenerate, onManualCreate }) => (
  <div className="flex flex-col items-center justify-center h-full p-8">
    <div className="text-center mb-8">
      <Network className="w-16 h-16 mx-auto mb-4 text-monokai-purple opacity-60" />
      <h2 className="text-xl font-bold text-monokai-fg mb-2">欢迎使用本体论模块</h2>
      <p className="text-sm text-monokai-comment max-w-md mx-auto">
        通过本体论图谱结构，快速理解概念建模方式，并进入可执行的建模与应用状态。
      </p>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl">
      <button onClick={onQuickInit}
        className="group p-6 bg-monokai-sidebar border border-monokai-accent/50 rounded-xl hover:border-monokai-blue/60 hover:bg-monokai-blue/5 transition-all text-left">
        <div className="w-10 h-10 rounded-lg bg-monokai-blue/10 flex items-center justify-center mb-4 group-hover:bg-monokai-blue/20 transition-colors">
          <Database className="w-5 h-5 text-monokai-blue" />
        </div>
        <h3 className="text-sm font-semibold text-monokai-fg mb-1">模板初始化</h3>
        <p className="text-[11px] text-monokai-comment leading-relaxed">一键创建五表 + 导入种子数据，<br />立即看到完整示例</p>
      </button>
      <button onClick={onAIGenerate}
        className="group p-6 bg-monokai-sidebar border border-monokai-accent/50 rounded-xl hover:border-monokai-purple/60 hover:bg-monokai-purple/5 transition-all text-left">
        <div className="w-10 h-10 rounded-lg bg-monokai-purple/10 flex items-center justify-center mb-4 group-hover:bg-monokai-purple/20 transition-colors">
          <Sparkles className="w-5 h-5 text-monokai-purple" />
        </div>
        <h3 className="text-sm font-semibold text-monokai-fg mb-1">AI 自动建模</h3>
        <p className="text-[11px] text-monokai-comment leading-relaxed">输入业务领域描述，<br />AI 自动生成完整本体论</p>
      </button>
      <button onClick={onManualCreate}
        className="group p-6 bg-monokai-sidebar border border-monokai-accent/50 rounded-xl hover:border-monokai-green/60 hover:bg-monokai-green/5 transition-all text-left">
        <div className="w-10 h-10 rounded-lg bg-monokai-green/10 flex items-center justify-center mb-4 group-hover:bg-monokai-green/20 transition-colors">
          <Plus className="w-5 h-5 text-monokai-green" />
        </div>
        <h3 className="text-sm font-semibold text-monokai-fg mb-1">手动创建</h3>
        <p className="text-[11px] text-monokai-comment leading-relaxed">从基础层开始，<br />按 MECE 五层逐步构建</p>
      </button>
    </div>
    <div className="mt-10 p-4 bg-monokai-sidebar/50 border border-monokai-accent/30 rounded-xl max-w-2xl w-full">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="w-4 h-4 text-monokai-yellow" />
        <span className="text-xs font-semibold text-monokai-fg">什么是 MECE 五层？</span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {MECE_LAYERS.map(key => {
          const cfg = ONTOLOGY_TEMPLATES[key];
          const Icon = LAYER_ICONS[key as MECELayer];
          const color = LAYER_COLORS[key];
          return (
            <div key={key} className="text-center p-2 bg-monokai-accent/10 rounded-lg">
              <Icon className={`w-4 h-4 mx-auto mb-1 text-${color}`} />
              <div className="text-[10px] font-medium text-monokai-fg">{cfg.label}</div>
              <div className="text-[9px] text-monokai-comment mt-0.5 leading-tight">{cfg.templates.length} 个模板</div>
            </div>
          );
        })}
      </div>
    </div>
  </div>
);

// ============================================================
// Main Component
// ============================================================

interface OntologyViewProps {
  onInsert?: (sql: string) => void;
  onTablesReady?: () => void;
}

export const OntologyView: React.FC<OntologyViewProps> = ({ onInsert, onTablesReady }) => {
  // Local UI state
  const [uiState, dispatch] = useReducer(uiReducer, initUIState);
  const aiFill = useAIFill();

  // Store — the Single Source of Truth
  const store = useOntologyStore();
  const isReady = store.state.initState === 'ready';
  const isEmpty = store.state.initState === 'no-tables' || store.state.initState === 'need-seed';

  // Map UI layer to store layer
  useEffect(() => {
    dispatch({ type: 'SET_ACTIVE_LAYER', layer: uiState.activeLayer });
  }, [uiState.activeLayer]);

  // Sync init state
  useEffect(() => {
    if (store.state.initState !== uiState.initState) {
      if (store.state.initState === 'loading') dispatch({ type: 'SET_INIT_STATE', state: 'loading' });
      else if (store.state.initState === 'no-tables') dispatch({ type: 'SET_INIT_STATE', state: 'no-tables' });
      else if (store.state.initState === 'need-seed') dispatch({ type: 'SET_INIT_STATE', state: 'need-seed' });
      else if (store.state.initState === 'ready') dispatch({ type: 'SET_INIT_STATE', state: 'ready' });
    }
  }, [store.state.initState]);

  // AI layer mode
  const currentLayerMode: AIFillMode = layerToMode(uiState.activeLayer as any);
  const currentFillState = aiFill.states[currentLayerMode];

  // Inject SQL helper
  const handleInjectSQL = useCallback((sqlContent: string) => {
    onInsert?.(sqlContent);
    dispatch({ type: 'CLEAR_DRAFT' });
    dispatch({ type: 'SET_VIEW_MODE', mode: 'data' });
  }, [onInsert]);

  // Quick init
  const handleQuickInit = async () => {
    dispatch({ type: 'SET_INITTING', value: true });
    try {
      await store.initOntology();
      onTablesReady?.();
    } catch (e: any) {
      dispatch({ type: 'SET_ERROR', error: e.message });
    } finally {
      dispatch({ type: 'SET_INITTING', value: false });
    }
  };

  // Execute SQL template
  const handleExecute = useCallback(async (id: string, sql: string, refreshTables?: boolean) => {
    dispatch({ type: 'SET_EXECUTION', id, result: { data: null, error: null, loading: true } });
    const start = performance.now();
    try {
      const res = await duckDBService.query(sql);
      const end = performance.now();
      dispatch({ type: 'SET_EXECUTION', id, result: { data: res, error: null, loading: false, executionTime: end - start } });
      if (refreshTables) { onTablesReady?.(); store.refresh(); }
    } catch (e: any) {
      dispatch({ type: 'SET_EXECUTION', id, result: { data: null, error: e.message, loading: false } });
    }
  }, [onTablesReady, store]);

  // AI generate (top-level draft)
  const handleAiGenerate = async () => {
    if (!uiState.aiTopic.trim()) return;
    dispatch({ type: 'SET_GENERATING', value: true });
    try {
      const payload = await ontologyAiService.generateOntologyDraft(uiState.aiTopic);
      dispatch({ type: 'SET_DRAFT', payload, jsonStr: JSON.stringify(payload, null, 2) });
    } catch (e: any) {
      alert('AI 生成失败: ' + e.message);
    } finally {
      dispatch({ type: 'SET_GENERATING', value: false });
    }
  };

  const handleCommitDraft = async () => {
    try {
      const dataToCommit = JSON.parse(uiState.draftJsonStr);
      await store.commitOntologyDraft(dataToCommit);
      dispatch({ type: 'CLEAR_DRAFT' });
      onTablesReady?.();
    } catch (e: any) {
      alert('提交失败: ' + e.message);
    }
  };

  // Dispatch shortcuts to store
  const dispatchStore = store.dispatch;

  const currentLayer = ONTOLOGY_TEMPLATES[uiState.activeLayer];
  const layerColor = LAYER_COLORS[uiState.activeLayer];

  return (
    <div className="relative h-full w-full bg-[#090a0f] text-monokai-fg overflow-hidden flex font-mono border border-monokai-accent/30 shadow-inner shadow-black/50">

      {/* ── L3: Canvas Background (Graph / Canvas / Data) ── */}
      <div className="absolute inset-0 z-0">
        {uiState.viewMode === 'canvas' ? <OntologyCanvas /> : uiState.viewMode === 'graph' ? <D3GraphView /> : null}
      </div>

      {/* ── L1: Top Command Bar ── */}
      <div className="absolute top-4 z-20 flex items-center gap-3 px-5 py-2.5 bg-[rgba(10,10,13,0.88)] backdrop-blur-xl border border-monokai-accent/40 rounded-xl shadow-2xl transition-all duration-300 left-1/2 -translate-x-1/2">

        {/* Brand */}
        <div className="flex items-center gap-2 pr-4 border-r border-white/10 shrink-0">
          <div className="w-7 h-7 rounded bg-monokai-purple/10 border border-monokai-purple/40 flex items-center justify-center">
            <Network className="w-4 h-4 text-monokai-purple" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-monokai-purple uppercase tracking-widest font-bold leading-none">本体论</span>
            <span className="text-[9px] text-monokai-comment leading-none">MECE 图谱</span>
          </div>
        </div>

        {/* AI Copilot (top-level topic) */}
        <div className="flex items-center w-56 relative">
          <input
            type="text"
            placeholder="输入业务领域，AI 自动建模..."
            value={uiState.aiTopic}
            onChange={e => dispatch({ type: 'SET_AI_TOPIC', topic: e.target.value })}
            onKeyDown={e => { if (e.key === 'Enter') handleAiGenerate(); else if (e.key === 'Escape') dispatch({ type: 'SET_AI_TOPIC', topic: '' }); }}
            className="w-full bg-black/50 border border-monokai-purple/30 rounded-lg py-1.5 pl-3 pr-8 text-xs text-monokai-purple placeholder-monokai-purple/30 focus:outline-none focus:border-monokai-purple/70 transition-all font-mono"
          />
          {uiState.aiTopic && (
            <button onClick={() => dispatch({ type: 'SET_AI_TOPIC', topic: '' })} className="absolute right-2 text-monokai-purple/50 hover:text-monokai-purple">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button onClick={handleAiGenerate} disabled={uiState.isGenerating || !uiState.aiTopic.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all bg-monokai-purple/10 border border-monokai-purple/40 text-monokai-purple hover:bg-monokai-purple/20 disabled:opacity-40 disabled:cursor-not-allowed">
          {uiState.isGenerating ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {uiState.isGenerating ? '生成中...' : 'AI 建模'}
        </button>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 pl-4 border-l border-white/10 shrink-0">
          <button onClick={() => dispatch({ type: 'SET_VIEW_MODE', mode: 'data' })}
            className={`px-3 py-1.5 rounded text-[10px] font-bold border transition-all ${uiState.viewMode === 'data' ? 'bg-monokai-cyan/20 border-monokai-cyan/50 text-monokai-cyan' : 'bg-black/50 border-white/10 text-monokai-comment hover:border-white/30'}`}>
            <LayoutGrid className="w-3.5 h-3.5 inline mr-1" />数据
          </button>
          <button onClick={() => dispatch({ type: 'SET_VIEW_MODE', mode: 'graph' })}
            className={`px-3 py-1.5 rounded text-[10px] font-bold border transition-all ${uiState.viewMode === 'graph' ? 'bg-monokai-cyan/20 border-monokai-cyan/50 text-monokai-cyan' : 'bg-black/50 border-white/10 text-monokai-comment hover:border-white/30'}`}>
            <Network className="w-3.5 h-3.5 inline mr-1" />图谱
          </button>
          <button onClick={() => dispatch({ type: 'SET_VIEW_MODE', mode: 'canvas' })}
            className={`px-3 py-1.5 rounded text-[10px] font-bold border transition-all ${uiState.viewMode === 'canvas' ? 'bg-monokai-cyan/20 border-monokai-cyan/50 text-monokai-cyan' : 'bg-black/50 border-white/10 text-monokai-comment hover:border-white/30'}`}>
            <Layers className="w-3.5 h-3.5 inline mr-1" />画布
          </button>
        </div>

        {/* Stats */}
        {isReady && (
          <div className="flex items-center gap-2 pl-4 border-l border-white/10 shrink-0 text-[10px] text-monokai-comment">
            <span><strong className="text-monokai-purple">{store.state.stats.objects}</strong> 对象</span>
            <span><strong className="text-monokai-orange">{store.state.stats.links}</strong> 关系</span>
            <span><strong className="text-monokai-blue">{store.state.stats.objectTypes}</strong> 类型</span>
          </div>
        )}

        {/* Insights toggle */}
        <button onClick={() => dispatch({ type: 'TOGGLE_INSIGHTS' })}
          className={`px-3 py-1.5 rounded text-[10px] font-bold border transition-all shrink-0 ${uiState.insightsOpen ? 'bg-monokai-yellow/20 border-monokai-yellow/50 text-monokai-yellow' : 'bg-black/50 border-white/10 text-monokai-comment hover:border-white/30'}`}>
          <Brain className="w-3.5 h-3.5 inline mr-1" />洞察
        </button>
      </div>

      {/* ── L2: Left Drawer ── */}
      {uiState.drawerOpen && (
        <div className="absolute top-0 left-0 h-full w-[380px] flex bg-[rgba(8,8,12,0.95)] backdrop-blur-3xl border-r border-monokai-accent/30 shadow-[10px_0_50px_rgba(0,0,0,0.9)] z-40 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]">

          {/* Layer Ribbon */}
          <div className="w-14 border-r border-white/10 flex flex-col items-center py-4 gap-2 bg-black/40 shrink-0">
            {MECE_LAYERS.map(key => {
              const Icon = LAYER_ICONS[key as MECELayer];
              const isActive = uiState.activeLayer === key;
              const color = LAYER_COLORS[key];
              return (
                <button key={key} onClick={() => dispatch({ type: 'SET_ACTIVE_LAYER', layer: key as MECELayer })}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${isActive ? `bg-monokai-purple/20 border border-monokai-purple/60 text-monokai-purple shadow-[0_0_15px_rgba(168,85,247,0.3)]` : 'border border-transparent text-monokai-comment hover:bg-white/5 hover:border-white/20 hover:text-white'}`}
                  title={ONTOLOGY_TEMPLATES[key].label}>
                  <Icon className="w-5 h-5" />
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Layer Header */}
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between shadow-[0_5px_15px_rgba(0,0,0,0.5)]">
              <div>
                <h3 className={`text-sm font-bold uppercase tracking-widest text-${layerColor}`}>{currentLayer.label}</h3>
                <p className="text-[9px] text-white/40 mt-0.5">{currentLayer.description}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => dispatch({ type: 'TOGGLE_DRAWER' })}
                  className="text-white/40 hover:text-white p-1 rounded hover:bg-white/10 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* AI Workbench — unified entry per layer */}
            <div className="shrink-0 border-b border-monokai-accent/30">
              <AIFillPanel
                mode={currentLayerMode}
                isLoading={currentFillState.isLoading}
                error={currentFillState.error}
                result={currentFillState.result}
                input={currentFillState.input}
                secondaryInput={currentFillState.secondaryInput}
                secondaryInput2={currentFillState.secondaryInput2}
                onInputChange={v => aiFill.setInput(currentLayerMode, v)}
                onSecondaryChange={v => aiFill.setSecondaryInput(currentLayerMode, v, 'secondaryInput')}
                onSecondary2Change={v => aiFill.setSecondaryInput(currentLayerMode, v, 'secondaryInput2')}
                onExecute={() => aiFill.executeFill(currentLayerMode)}
                onAbort={() => aiFill.abortFill(currentLayerMode)}
                onClear={() => aiFill.clearFill(currentLayerMode)}
                onAccept={(result: any) => {
                  const sql = result?.suggestedDDL || result?.suggestedDML || result?.initializationSQL || result?.sql || '';
                  if (sql) handleInjectSQL(sql);
                }}
                onInjectSQL={handleInjectSQL}
                defaultExpanded={true}
              />
            </div>

            {/* Content Area: Empty / Loading / Ready */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {uiState.initting && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Loader className="w-8 h-8 mx-auto mb-2 text-monokai-blue animate-spin" />
                    <p className="text-xs text-monokai-comment">初始化中...</p>
                  </div>
                </div>
              )}

              {isEmpty && !uiState.initting && (
                <EmptyState
                  onQuickInit={handleQuickInit}
                  onAIGenerate={() => dispatch({ type: 'SET_AI_TOPIC', topic: '' })}
                  onManualCreate={() => dispatch({ type: 'SET_ACTIVE_LAYER', layer: 'foundation' })}
                />
              )}

              {store.state.initState === 'loading' && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Loader className="w-8 h-8 mx-auto mb-2 text-monokai-purple animate-spin" />
                    <p className="text-xs text-monokai-comment">检查本体论状态...</p>
                  </div>
                </div>
              )}

              {isReady && (
                <>
                  {/* Template Panel */}
                  <div className="flex-1 overflow-hidden border-b border-monokai-accent/30">
                    <TemplatePanel
                      layer={uiState.activeLayer}
                      expandedTemplates={uiState.expandedTemplates}
                      executionResults={uiState.executionResults}
                      onToggleTemplate={id => dispatch({ type: 'TOGGLE_TEMPLATE', id })}
                      onExecute={handleExecute}
                    />
                  </div>

                  {/* CRUD Panel */}
                  <div className="flex-1 overflow-hidden">
                    <CRUDPanel
                      objectTypes={store.state.objectTypes}
                      objects={store.state.objects}
                      linkTypes={store.state.linkTypes}
                      links={store.state.links}
                      actions={store.state.actions}
                      layer={uiState.activeLayer}
                      onRefresh={() => store.refresh()}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Drawer Toggle (when closed) */}
      {!uiState.drawerOpen && (
        <button onClick={() => dispatch({ type: 'TOGGLE_DRAWER' })}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-30 py-4 px-1.5 bg-[rgba(10,10,13,0.9)] border border-l-0 border-monokai-accent/30 rounded-r-xl text-monokai-cyan hover:bg-monokai-cyan/20 transition-all backdrop-blur-md">
          <ChevronRight className="w-3 h-3" />
        </button>
      )}

      {/* Drawer Toggle (when open — edge handle) */}
      {uiState.drawerOpen && (
        <button onClick={() => dispatch({ type: 'TOGGLE_DRAWER' })}
          className="absolute left-[380px] top-1/2 -translate-y-1/2 z-30 py-4 px-1.5 bg-[rgba(10,10,13,0.9)] border border-l-0 border-monokai-accent/30 rounded-r-xl text-monokai-cyan hover:bg-monokai-cyan/20 transition-all backdrop-blur-md">
          <ChevronRight className="w-3 h-3 rotate-180" />
        </button>
      )}

      {/* AI Draft Modal */}
      {uiState.draftPayload && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center p-8 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-4xl h-[85vh] flex flex-col bg-[#090a0f] border border-monokai-orange/40 rounded-xl shadow-[0_0_100px_rgba(255,0,60,0.3)] overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10 bg-[rgba(15,15,20,0.9)] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded border border-monokai-orange/50 bg-monokai-orange/10 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-monokai-orange" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-monokai-orange tracking-widest uppercase">DRAFT REVIEW</h3>
                  <p className="text-[10px] text-monokai-comment mt-0.5">提交前请确认语义映射正确</p>
                </div>
              </div>
              <button onClick={() => dispatch({ type: 'CLEAR_DRAFT' })} className="text-white/40 hover:text-white p-2 rounded hover:bg-white/10 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              <CodeMirror
                value={uiState.draftJsonStr}
                height="100%"
                theme={monokai}
                extensions={[EditorView.lineWrapping]}
                onChange={v => dispatch({ type: 'SET_DRAFT', payload: uiState.draftPayload, jsonStr: v })}
                className="text-sm [&>.cm-editor]:outline-none"
              />
            </div>
            <div className="px-6 py-4 border-t border-white/10 bg-[rgba(15,15,20,0.9)] flex items-center justify-between shrink-0">
              <div className="text-[10px] text-monokai-comment">
                <span className="text-monokai-cyan font-bold">
                  概要: {uiState.draftPayload.objects.length} 对象, {uiState.draftPayload.links.length} 关系, {uiState.draftPayload.actions.length} 行动
                </span>
              </div>
              <div className="flex gap-4">
                <button onClick={() => dispatch({ type: 'CLEAR_DRAFT' })}
                  className="px-6 py-2 text-xs font-bold text-monokai-comment hover:text-white border border-transparent hover:border-white/20 rounded uppercase tracking-widest transition-colors">
                  取消
                </button>
                <button onClick={handleCommitDraft}
                  className="flex items-center gap-2 px-8 py-2.5 text-xs font-bold text-white bg-monokai-orange/20 border border-monokai-orange/50 rounded shadow-[0_0_20px_rgba(255,0,60,0.4)] hover:bg-monokai-orange/40 transition-all uppercase tracking-widest">
                  <Check className="w-3.5 h-3.5" /> 提交到数据库
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OntologyView;
