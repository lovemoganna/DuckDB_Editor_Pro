import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { X, PanelRightDashed, ChevronRight, ChevronDown, Link2, Target, Plus, Trash2, Code, ListFilter, Sparkles } from 'lucide-react';
import { useOntologyStore } from '../../hooks/useOntologyStore';
import type { EditMode, FormState } from './OntologyPanel.types';
import { normalizeDateToString } from './OntologyPanel.types';
import { ToastNotification } from '../ui/ToastNotification';
import { ontologyAiService } from '../../services/ontologyAiService';
import { ActionButton, IconButton } from '../ui/Workbench';

interface RightInspectorProps {
  mode: EditMode;
  target: any;
  onClose: () => void;
  onSave?: () => void;
  onInspect?: (mode: EditMode, target: any) => void;
}

interface KeyValueItem {
  id: string;
  key: string;
  value: string;
}

const titleMap: Record<string, string> = {
  objectType: '实体类型 (Schema)',
  object: '实体属性 (Entity)',
  linkType: '关系类型 (Relation Type)',
  link: '关联连线 (Relationship)',
  action: '业务行动 (Action)',
  introspection: '反思记录 (Q&A)',
  insight: '洞察记录 (Insight)',
};

const RightInspector: React.FC<RightInspectorProps> = ({ mode, target, onClose, onSave, onInspect }) => {
  const { state, ...storeActions } = useOntologyStore();
  const objectTypes = state.objectTypes;
  const linkTypes = state.linkTypes;
  const objects = state.objects;
  const [form, setForm] = useState<FormState>({
    name: '', desc: '', objectTypeId: 1, properties: '',
    linkTypeId: 1, sourceId: null, targetId: null, weight: 0.5,
    status: 'pending', executeAt: '',
    objectId: null, question: '', answer: '', insight: '', tag: '',
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isAdjacencyExpanded, setIsAdjacencyExpanded] = useState(true);
  const [propertyEditMode, setPropertyEditMode] = useState<'kv' | 'json'>('kv');
  const [kvPairs, setKvPairs] = useState<KeyValueItem[]>([]);

  // Initialize key-value pairs from JSON properties
  useEffect(() => {
    if (mode === 'object') {
      try {
        const parsed = JSON.parse(form.properties || '{}');
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          const pairs: KeyValueItem[] = Object.entries(parsed).map(([k, v], idx) => ({
            id: `kv_${idx}_${k}`,
            key: k,
            value: typeof v === 'string' ? v : JSON.stringify(v),
          }));
          setKvPairs(pairs);
        } else {
          setKvPairs([]);
        }
      } catch {
        setKvPairs([]);
      }
    }
  }, [mode, target]);

  const updateKvPairs = (newPairs: KeyValueItem[]) => {
    setKvPairs(newPairs);
    const obj: Record<string, any> = {};
    for (const pair of newPairs) {
      if (pair.key.trim()) {
        try {
          obj[pair.key.trim()] = JSON.parse(pair.value);
        } catch {
          obj[pair.key.trim()] = pair.value;
        }
      }
    }
    setForm(f => ({ ...f, properties: JSON.stringify(obj, null, 2) }));
  };

  const handleAddKvPair = () => {
    const newPairs = [...kvPairs, { id: `kv_${Date.now()}`, key: '', value: '' }];
    updateKvPairs(newPairs);
  };

  const handleRemoveKvPair = (id: string) => {
    const newPairs = kvPairs.filter(p => p.id !== id);
    updateKvPairs(newPairs);
  };

  const handleKvChange = (id: string, field: 'key' | 'value', val: string) => {
    const newPairs = kvPairs.map(p => p.id === id ? { ...p, [field]: val } : p);
    updateKvPairs(newPairs);
  };

  // Find connected links and neighbor nodes
  const adjacencyList = useMemo(() => {
    if (mode !== 'object' || !target || !target.id) return [];
    
    return state.links.filter((l: any) => l.source_object_id === target.id || l.target_object_id === target.id).map((l: any) => {
      const isSource = l.source_object_id === target.id;
      const neighborId = isSource ? l.target_object_id : l.source_object_id;
      const neighborNode = state.objects.find((o: any) => o.id === neighborId);
      const linkTypeName = (state.linkTypes || []).find((lt: any) => lt.id === l.link_type_id)?.name || '关联';
      
      return {
        linkId: l.id,
        direction: isSource ? 'outgoing' : 'incoming',
        relation: linkTypeName,
        neighbor: neighborNode,
        weight: l.weight
      };
    }).filter((item: any) => item.neighbor != null);
  }, [mode, target, state.links, state.objects, state.linkTypes]);

  const isJsonInvalid = useMemo(() => {
    if (mode !== 'object') return false;
    const val = (form.properties || '').trim();
    if (!val) return false;
    try {
      JSON.parse(val);
      return false;
    } catch {
      return true;
    }
  }, [form.properties, mode]);

  useEffect(() => {
    if (!target || !target.id) {
      setForm({
        name: target?.name || '',
        desc: target?.description || '',
        objectTypeId: target?.object_type_id || objectTypes[0]?.id || 1,
        properties: target?.properties ? (typeof target.properties === 'string' ? target.properties : JSON.stringify(target.properties, null, 2)) : '',
        linkTypeId: target?.link_type_id || linkTypes[0]?.id || 1,
        sourceId: target?.source_object_id || null,
        targetId: target?.target_object_id || null,
        weight: target?.weight ?? 0.5,
        status: target?.status || 'pending',
        executeAt: target?.execute_at ? normalizeDateToString(target.execute_at) : '',
        objectId: target?.object_id || objects[0]?.id || null,
        question: target?.question || '',
        answer: target?.answer || '',
        insight: target?.insight || '',
        tag: target?.tag || ''
      });
      return;
    }
    if (mode === 'objectType' || mode === 'linkType')
      setForm({ name: target.name, desc: target.description || '', objectTypeId: objectTypes[0]?.id || 1, properties: '', linkTypeId: linkTypes[0]?.id || 1, sourceId: null, targetId: null, weight: 0.5, status: 'pending', executeAt: '', objectId: null, question: '', answer: '', insight: '', tag: '' });
    else if (mode === 'object')
      setForm({ name: target.name, desc: '', objectTypeId: target.object_type_id, properties: typeof target.properties === 'string' ? target.properties : JSON.stringify(target.properties || {}, null, 2), linkTypeId: linkTypes[0]?.id || 1, sourceId: null, targetId: null, weight: 0.5, status: 'pending', executeAt: '', objectId: null, question: '', answer: '', insight: '', tag: '' });
    else if (mode === 'link')
      setForm({ name: '', desc: '', objectTypeId: objectTypes[0]?.id || 1, properties: '', linkTypeId: target.link_type_id, sourceId: target.source_object_id, targetId: target.target_object_id, weight: target.weight ?? 0.5, status: 'pending', executeAt: '', objectId: null, question: '', answer: '', insight: '', tag: '' });
    else if (mode === 'action')
      setForm({ name: target.name, desc: target.description || '', objectTypeId: objectTypes[0]?.id || 1, properties: '', linkTypeId: linkTypes[0]?.id || 1, sourceId: null, targetId: null, weight: 0.5, status: target.status || 'pending', executeAt: normalizeDateToString(target.execute_at), objectId: null, question: '', answer: '', insight: '', tag: '' });
    else if (mode === 'introspection')
      setForm({ name: '', desc: '', objectTypeId: objectTypes[0]?.id || 1, properties: '', linkTypeId: linkTypes[0]?.id || 1, sourceId: null, targetId: null, weight: 0.5, status: 'pending', executeAt: '', objectId: target.object_id, question: target.question || '', answer: target.answer || '', insight: '', tag: '' });
    else if (mode === 'insight')
      setForm({ name: '', desc: '', objectTypeId: objectTypes[0]?.id || 1, properties: '', linkTypeId: linkTypes[0]?.id || 1, sourceId: null, targetId: null, weight: 0.5, status: 'pending', executeAt: '', objectId: target.object_id, question: '', answer: '', insight: target.insight || '', tag: target.tag || '' });
  }, [mode, target, objectTypes, linkTypes, objects]);

  const aiFillField = useCallback(async (field: string, currentMode: EditMode) => {
    try {
      const label = titleMap[currentMode];
      const prompt = `为 "${label}" 实体推荐一个合适的 ${field === 'name' ? '名称' : '描述'}`;
      const result = await ontologyAiService.generateObjectModel(prompt);
      const objs = result.objects || [];
      if (objs.length > 0) {
        const obj = objs[0];
        if (field === 'name') setForm(f => ({ ...f, name: obj.name }));
        else if (field === 'desc') setForm(f => ({ ...f, desc: (obj as any).description || obj.annotations || obj.name }));
      }
    } catch (e: any) { console.warn('AI 预填失败:', e.message); }
  }, []);

  const handleSave = async () => {
    try {
      if (mode === 'objectType') {
        if (target) await storeActions.updateObjectType(target.id, form.name, form.desc);
        else await storeActions.createObjectType(form.name, form.desc);
      } else if (mode === 'object') {
        if (!form.name.trim()) { setToast({ message: '实体名称不能为空', type: 'error' }); return; }
        if (target) await storeActions.updateObject(target.id, form.name, form.objectTypeId, form.properties || '{}');
        else await storeActions.createObject(form.name, form.objectTypeId, form.properties || '{}');
      } else if (mode === 'linkType') {
        if (target) await storeActions.updateLinkType(target.id, form.name, form.desc);
        else await storeActions.createLinkType(form.name, form.desc);
      } else if (mode === 'link') {
        if (!form.sourceId || !form.targetId) { setToast({ message: '请选择起点和终点', type: 'error' }); return; }
        if (target) await storeActions.updateLink(target.id, form.linkTypeId, form.sourceId, form.targetId, form.weight);
        else await storeActions.createLink(form.linkTypeId, form.sourceId, form.targetId, form.weight);
      } else if (mode === 'action') {
        if (!form.name.trim()) { setToast({ message: '行动名称不能为空', type: 'error' }); return; }
        const normalizedDate = normalizeDateToString(form.executeAt);
        if (target) await storeActions.updateAction(target.id, form.name, form.desc, form.status, normalizedDate || undefined);
        else await storeActions.createAction(form.name, 0, form.desc, form.status, normalizedDate || undefined);
      } else if (mode === 'introspection') {
        if (!form.question.trim()) { setToast({ message: '反思问题不能为空', type: 'error' }); return; }
        if (!form.objectId) { setToast({ message: '请选择关联的对象', type: 'error' }); return; }
        if (target) await storeActions.updateIntrospection(target.id, form.objectId, form.question, form.answer);
        else await storeActions.createIntrospection(form.objectId, form.question, form.answer);
      } else if (mode === 'insight') {
        if (!form.insight.trim()) { setToast({ message: '洞察内容不能为空', type: 'error' }); return; }
        if (!form.objectId) { setToast({ message: '请选择关联的对象', type: 'error' }); return; }
        if (target) await storeActions.updateInsight(target.id, form.objectId, form.insight, form.tag);
        else await storeActions.createInsight(form.objectId, form.insight, form.tag);
      }
      await storeActions.refresh();
      onClose();
      onSave?.();
    } catch (e: any) { setToast({ message: `保存失败: ${e.message}`, type: 'error' }); }
  };

  return (
    <div className="flex-1 flex flex-col bg-monokai-bg border-l border-monokai-border text-monokai-fg relative z-20">
      <div className="px-5 py-4 flex items-center justify-between border-b border-monokai-border bg-monokai-sidebar/60">
        <div>
          <h3 className="text-sm font-semibold text-monokai-fg flex items-center gap-2">
            <PanelRightDashed className="w-4 h-4 text-monokai-cyan" />
            {target && target.id ? '属性检视器' : '新建实体'}
          </h3>
          <p className="text-xs text-monokai-comment mt-0.5 font-mono">{titleMap[mode]} {target && target.id ? `#${target.id}` : ''}</p>
        </div>
        <IconButton icon={X} label="关闭检视器" onClick={onClose} size="sm" />
      </div>

      <div className="flex-1 p-5 space-y-4 overflow-y-auto custom-scrollbar text-xs">
        {mode !== 'link' && mode !== 'introspection' && mode !== 'insight' && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-monokai-fg-muted">名称 (Name)</label>
              <button
                type="button"
                onClick={() => aiFillField('name', mode)}
                className="text-xs px-2.5 py-1 rounded-md bg-monokai-surface hover:bg-monokai-elevated text-monokai-cyan border border-monokai-border hover:border-monokai-border-strong transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-monokai-cyan" /> 推荐名称
              </button>
            </div>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="输入名称..."
              className="w-full px-3 py-2 bg-monokai-sidebar border border-monokai-border text-monokai-fg placeholder-monokai-comment rounded-md focus:outline-none focus:border-monokai-accent transition-colors text-xs"
            />
          </div>
        )}

        {(mode === 'objectType' || mode === 'linkType' || mode === 'action') && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-monokai-fg-muted">描述 (Description)</label>
              <button
                type="button"
                onClick={() => aiFillField('desc', mode)}
                className="text-xs px-2.5 py-1 rounded-md bg-monokai-surface hover:bg-monokai-elevated text-monokai-cyan border border-monokai-border hover:border-monokai-border-strong transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-monokai-cyan" /> 推荐描述
              </button>
            </div>
            <textarea
              value={form.desc}
              onChange={e => setForm(f => ({ ...f, desc: e.target.value }))}
              placeholder="补充说明..."
              rows={3}
              className="w-full px-3 py-2 bg-monokai-sidebar border border-monokai-border text-monokai-fg placeholder-monokai-comment rounded-md focus:outline-none focus:border-monokai-accent transition-colors text-xs resize-none"
            />
          </div>
        )}

        {mode === 'action' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-monokai-comment">计划执行时间</label>
              <input
                type="date"
                value={form.executeAt}
                onChange={e => setForm(f => ({ ...f, executeAt: e.target.value }))}
                className="w-full px-3 py-1.5 bg-monokai-sidebar border border-monokai-border text-monokai-fg rounded-md focus:outline-none focus:border-monokai-accent text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-monokai-comment">状态</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full px-3 py-1.5 bg-monokai-sidebar border border-monokai-border text-monokai-fg rounded-md focus:outline-none focus:border-monokai-accent text-xs"
              >
                <option value="pending">待执行</option>
                <option value="running">执行中</option>
                <option value="done">已完成</option>
                <option value="failed">失败</option>
              </select>
            </div>
          </div>
        )}

        {mode === 'object' && (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-monokai-fg-muted">所属类型 (Schema Binding)</label>
              <select
                value={form.objectTypeId}
                onChange={e => setForm(f => ({ ...f, objectTypeId: Number(e.target.value) }))}
                className="w-full px-3 py-2 bg-monokai-sidebar border border-monokai-border text-monokai-fg rounded-md focus:outline-none focus:border-monokai-accent text-xs"
              >
                {objectTypes.map(ot => <option key={ot.id} value={ot.id}>{ot.name}</option>)}
              </select>
            </div>

            {/* Structured Key-Value & JSON Property Editor */}
            <div className="space-y-2 pt-2 border-t border-monokai-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-monokai-fg-muted">实体属性 (Properties)</label>
                  <div className="flex rounded-lg bg-monokai-sidebar border border-monokai-border p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setPropertyEditMode('kv')}
                      className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${propertyEditMode === 'kv' ? 'bg-monokai-surface text-monokai-cyan font-medium' : 'text-monokai-comment hover:text-monokai-fg'}`}
                    >
                      键值对
                    </button>
                    <button
                      type="button"
                      onClick={() => setPropertyEditMode('json')}
                      className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${propertyEditMode === 'json' ? 'bg-monokai-surface text-monokai-cyan font-medium' : 'text-monokai-comment hover:text-monokai-fg'}`}
                    >
                      JSON
                    </button>
                  </div>
                </div>
                {propertyEditMode === 'kv' && (
                  <button
                    type="button"
                    onClick={handleAddKvPair}
                    className="text-xs px-2.5 py-1 rounded-lg bg-monokai-cyan/15 border border-monokai-cyan/30 text-monokai-cyan hover:bg-monokai-cyan/25 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> 添加字段
                  </button>
                )}
              </div>

              {propertyEditMode === 'kv' ? (
                <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                  {kvPairs.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-monokai-border p-3 text-center text-monokai-comment text-xs">
                      暂无自定义属性，点击上方「添加字段」
                    </div>
                  ) : (
                    kvPairs.map(pair => (
                      <div key={pair.id} className="flex items-center gap-1.5">
                        <input
                          type="text"
                          placeholder="属性名 (key)"
                          value={pair.key}
                          onChange={e => handleKvChange(pair.id, 'key', e.target.value)}
                          className="w-1/2 px-2.5 py-1.5 bg-monokai-sidebar border border-monokai-border text-monokai-fg placeholder-monokai-comment rounded-lg text-xs outline-none focus:border-monokai-accent font-mono"
                        />
                        <input
                          type="text"
                          placeholder="属性值 (value)"
                          value={pair.value}
                          onChange={e => handleKvChange(pair.id, 'value', e.target.value)}
                          className="w-1/2 px-2.5 py-1.5 bg-monokai-sidebar border border-monokai-border text-monokai-fg placeholder-monokai-comment rounded-lg text-xs outline-none focus:border-monokai-accent"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveKvPair(pair.id)}
                          className="p-1.5 text-monokai-comment hover:text-monokai-orange rounded-lg transition-colors cursor-pointer"
                          title="删除属性"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  {isJsonInvalid && (
                    <span className="text-xs text-monokai-pink font-medium">× JSON 格式解析错误</span>
                  )}
                  <textarea
                    value={form.properties}
                    onChange={e => setForm(f => ({ ...f, properties: e.target.value }))}
                    placeholder="{}"
                    rows={6}
                    className={`w-full p-2.5 text-xs font-mono bg-monokai-sidebar border ${isJsonInvalid ? 'border-monokai-pink' : 'border-monokai-border'} text-monokai-fg placeholder-monokai-comment rounded-lg focus:outline-none focus:border-monokai-accent resize-none leading-relaxed`}
                  />
                </div>
              )}
            </div>
          </>
        )}

        {mode === 'link' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-monokai-comment">起点实体 (Source Node)</label>
              <select
                value={form.sourceId ?? ''}
                onChange={e => setForm(f => ({ ...f, sourceId: Number(e.target.value) }))}
                className="w-full px-3 py-2 bg-monokai-sidebar border border-monokai-border text-monokai-fg rounded-lg focus:outline-none focus:border-monokai-accent text-xs"
              >
                <option value="">选取节点...</option>
                {objects.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-monokai-comment">关系类型 (Relation Type)</label>
              <select
                value={form.linkTypeId}
                onChange={e => setForm(f => ({ ...f, linkTypeId: Number(e.target.value) }))}
                className="w-full px-3 py-2 bg-monokai-sidebar border border-monokai-border text-monokai-cyan rounded-lg focus:outline-none focus:border-monokai-accent text-xs font-medium"
              >
                {linkTypes.map(lt => <option key={lt.id} value={lt.id}>{lt.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-monokai-comment">终点实体 (Target Node)</label>
              <select
                value={form.targetId ?? ''}
                onChange={e => setForm(f => ({ ...f, targetId: Number(e.target.value) }))}
                className="w-full px-3 py-2 bg-monokai-sidebar border border-monokai-border text-monokai-fg rounded-lg focus:outline-none focus:border-monokai-accent text-xs"
              >
                <option value="">选取节点...</option>
                {objects.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div className="pt-2 border-t border-monokai-border space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-monokai-comment">关系权重 (Weight)</label>
                <span className="text-xs font-mono text-monokai-cyan font-semibold">{(Number(form.weight) || 0).toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={form.weight}
                onChange={e => setForm(f => ({ ...f, weight: Number(e.target.value) }))}
                className="w-full accent-monokai-cyan cursor-pointer"
              />
            </div>
          </div>
        )}

        {mode === 'object' && target && target.id && adjacencyList.length > 0 && (
          <div className="pt-3 border-t border-monokai-border space-y-2">
            <button
              type="button"
              onClick={() => setIsAdjacencyExpanded(!isAdjacencyExpanded)}
              className="w-full flex items-center justify-between text-xs font-medium text-monokai-fg-muted hover:text-white transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-monokai-cyan" />
                关联邻接节点 ({adjacencyList.length})
              </span>
              {isAdjacencyExpanded ? <ChevronDown className="w-3.5 h-3.5 text-monokai-comment" /> : <ChevronRight className="w-3.5 h-3.5 text-monokai-comment" />}
            </button>

            {isAdjacencyExpanded && (
              <div className="space-y-1.5 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
                {adjacencyList.map((item: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-monokai-sidebar border border-monokai-border hover:border-monokai-border-strong group transition-all cursor-pointer"
                    onClick={() => {
                      if (onInspect) {
                        onInspect('object', item.neighbor);
                      }
                      if ((window as any).__d3FocusNode) {
                        (window as any).__d3FocusNode(item.neighbor.id, 'instance');
                      }
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded font-mono font-medium ${
                          item.direction === 'outgoing' 
                            ? 'bg-monokai-cyan/15 text-monokai-cyan border border-monokai-cyan/30' 
                            : 'bg-monokai-yellow/15 text-monokai-yellow border border-monokai-yellow/30'
                        }`}>
                          {item.direction === 'outgoing' ? '→ 出度' : '← 入度'}
                        </span>
                        <span className="text-xs font-medium text-monokai-green bg-monokai-green/15 px-2 py-0.5 rounded border border-monokai-green/30">
                          {item.relation}
                        </span>
                        <span className="text-xs text-monokai-fg truncate font-medium">
                          {item.neighbor.name}
                        </span>
                      </div>
                    </div>
                    <Target className="w-3.5 h-3.5 text-monokai-comment group-hover:text-monokai-cyan transition-colors shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-4 flex gap-2 justify-end border-t border-monokai-border bg-monokai-sidebar">
        <ActionButton
          variant="secondary"
          size="sm"
          onClick={onClose}
        >
          取消
        </ActionButton>
        <ActionButton
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={isJsonInvalid}
        >
          保存配置
        </ActionButton>
      </div>

      {toast && <ToastNotification message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default RightInspector;

