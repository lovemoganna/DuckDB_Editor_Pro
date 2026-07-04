import React, { useState, useCallback, useEffect } from 'react';
import { X, PanelRightDashed } from 'lucide-react';
import { useOntologyStore } from '../../hooks/useOntologyStore';
import type { EditMode, FormState } from './OntologyPanel.types';
import { normalizeDateToString } from './OntologyPanel.types';
import { ToastNotification } from '../ui/ToastNotification';
import { ontologyAiService } from '../../services/ontologyAiService';

interface RightInspectorProps {
  mode: EditMode;
  target: any;
  onClose: () => void;
  onSave?: () => void;
}

const RightInspector: React.FC<RightInspectorProps> = ({ mode, target, onClose, onSave }) => {
  const { state, ...storeActions } = useOntologyStore();
  const objectTypes = state.objectTypes;
  const linkTypes = state.linkTypes;
  const objects = state.objects;
  const [form, setForm] = useState<FormState>({
    name: '', desc: '', objectTypeId: 1, properties: '',
    linkTypeId: 1, sourceId: null, targetId: null, weight: 0.5,
    status: 'pending', executeAt: '',
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!target) {
      setForm({ name: '', desc: '', objectTypeId: objectTypes[0]?.id || 1, properties: '', linkTypeId: linkTypes[0]?.id || 1, sourceId: null, targetId: null, weight: 0.5, status: 'pending', executeAt: '' });
      return;
    }
    if (mode === 'objectType' || mode === 'linkType')
      setForm({ name: target.name, desc: target.description || '', objectTypeId: objectTypes[0]?.id || 1, properties: '', linkTypeId: linkTypes[0]?.id || 1, sourceId: null, targetId: null, weight: 0.5, status: 'pending', executeAt: '' });
    else if (mode === 'object')
      setForm({ name: target.name, desc: '', objectTypeId: target.object_type_id, properties: target.properties || '', linkTypeId: linkTypes[0]?.id || 1, sourceId: null, targetId: null, weight: 0.5, status: 'pending', executeAt: '' });
    else if (mode === 'link')
      setForm({ name: '', desc: '', objectTypeId: objectTypes[0]?.id || 1, properties: '', linkTypeId: target.link_type_id, sourceId: target.source_object_id, targetId: target.target_object_id, weight: target.weight ?? 0.5, status: 'pending', executeAt: '' });
    else if (mode === 'action')
      setForm({ name: target.name, desc: target.description || '', objectTypeId: objectTypes[0]?.id || 1, properties: '', linkTypeId: linkTypes[0]?.id || 1, sourceId: null, targetId: null, weight: 0.5, status: target.status || 'pending', executeAt: normalizeDateToString(target.execute_at) });
  }, [mode, target, objectTypes, linkTypes]);

  const titleMap: Record<string, string> = {
    objectType: '节点类型 (Schema)', object: '超级节点属性', linkType: '拓扑类型', link: '依赖与连线', action: '执行行动'
  };

  const aiFillField = useCallback(async (field: string, currentMode: EditMode) => {
    try {
      const label = titleMap[currentMode];
      const prompt = `为 "${label}" 实体推荐一个合适的 ${field === 'name' ? '名称' : '描述'}`;
      const result = await ontologyAiService.generateObjectModel(prompt);
      const objects = result.objects || [];
      if (objects.length > 0) {
        const obj = objects[0];
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
        if (!form.name.trim()) { setToast({ message: '节点名不能为空', type: 'error' }); return; }
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
      }
      await storeActions.refresh();
      onClose();
      onSave?.();
    } catch (e: any) { setToast({ message: `保存失败: ${e.message}`, type: 'error' }); }
  };

  return (
    <div className="flex-1 flex flex-col glass-panel-deep relative z-20">
      <div className="px-6 py-5 flex items-center justify-between border-b border-monokai-accent/10"
        style={{ background: 'linear-gradient(180deg, rgba(102,217,239,0.04) 0%, transparent 100%)' }}>
        <div>
          <h3 className="text-base font-bold text-monokai-fg flex items-center gap-2">
            <PanelRightDashed className="w-5 h-5 text-monokai-cyan drop-shadow-[0_0_6px_rgba(102,217,239,0.5)]" />
            {target ? '属性检视器' : '新建实体'}
          </h3>
          <p className="text-xs text-monokai-comment mt-1 font-mono">{titleMap[mode]} {target ? `#${target.id}` : ''}</p>
        </div>
        <button onClick={onClose} className="p-2 rounded-xl text-monokai-comment hover:text-monokai-fg hover:bg-monokai-accent/10 transition-all">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 p-6 space-y-5 overflow-y-auto custom-scrollbar">
        {mode !== 'link' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-monokai-cyan tracking-wide">名称 Identifier</label>
              <button onClick={() => aiFillField('name', mode)}
                className="text-[10px] px-2.5 py-1 rounded-full bg-monokai-purple/10 text-monokai-purple hover:bg-monokai-purple/20 border border-monokai-purple/20 transition-all">
                AI 填充
              </button>
            </div>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="输入名称..."
              className="w-full px-4 py-3 text-sm bg-monokai-sidebar/20 border border-monokai-border/30 text-monokai-fg placeholder-monokai-comment/40 rounded-lg focus:outline-none transition-all search-glow" />
          </div>
        )}

        {(mode === 'objectType' || mode === 'linkType' || mode === 'action') && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-monokai-cyan tracking-wide">描述 Description</label>
              <button onClick={() => aiFillField('desc', mode)}
                className="text-[10px] px-2.5 py-1 rounded-full bg-monokai-purple/10 text-monokai-purple hover:bg-monokai-purple/20 border border-monokai-purple/20 transition-all">
                AI 填充
              </button>
            </div>
            <textarea value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} placeholder="补充信息..." rows={3}
              className="w-full px-4 py-3 text-sm bg-monokai-sidebar/20 border border-monokai-border/30 text-monokai-fg placeholder-monokai-comment/40 rounded-lg focus:outline-none transition-all search-glow resize-none" />
          </div>
        )}

        {mode === 'action' && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-monokai-accent">计划执行时间 Execute At</label>
            <input type="date" value={form.executeAt} onChange={e => setForm(f => ({ ...f, executeAt: e.target.value }))}
              className="w-full px-4 py-3 text-sm bg-monokai-sidebar/20 border border-monokai-border/40 text-monokai-fg rounded-lg focus:outline-none focus:border-monokai-cyan/50 focus:bg-monokai-bg transition-all" />
          </div>
        )}

        {mode === 'action' && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-monokai-accent">状态 Status</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="w-full px-4 py-3 text-sm bg-monokai-sidebar/20 border border-monokai-border/40 text-monokai-fg rounded-lg focus:outline-none focus:border-monokai-cyan/50 transition-all appearance-none cursor-pointer">
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
                className="w-full px-4 py-3 text-sm bg-monokai-sidebar/20 border border-monokai-border/40 text-monokai-fg rounded-lg focus:outline-none focus:border-monokai-cyan/50 transition-all appearance-none cursor-pointer">
                {objectTypes.map(ot => <option key={ot.id} value={ot.id} className="bg-monokai-bg">{ot.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-monokai-cyan tracking-wide">JSON 附加属性 Metadata</label>
              <div className="json-block">
                <textarea value={form.properties} onChange={e => setForm(f => ({ ...f, properties: e.target.value }))} placeholder="{}" rows={5}
                  className="w-full text-sm font-mono bg-transparent border-none text-monokai-blue placeholder-monokai-comment/40 rounded focus:outline-none resize-none leading-relaxed" />
              </div>
            </div>
          </>
        )}

        {mode === 'link' && (
          <>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-monokai-accent">起点 Source Node</label>
              <select value={form.sourceId ?? ''} onChange={e => setForm(f => ({ ...f, sourceId: Number(e.target.value) }))}
                className="w-full px-4 py-3 text-sm bg-monokai-sidebar/20 border border-monokai-border/40 text-monokai-fg rounded-lg focus:outline-none focus:border-monokai-cyan/50 transition-all appearance-none cursor-pointer">
                <option value="">选取节点...</option>
                {objects.map(o => <option key={o.id} value={o.id} className="bg-monokai-bg">{o.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-monokai-comment">连接语意 Link Type</label>
              <select value={form.linkTypeId} onChange={e => setForm(f => ({ ...f, linkTypeId: Number(e.target.value) }))}
                className="w-full px-4 py-3 text-sm bg-monokai-green/10 border border-monokai-green/30 text-monokai-green rounded-xl focus:outline-none focus:border-monokai-green/60 transition-all font-medium">
                {linkTypes.map(lt => <option key={lt.id} value={lt.id} className="bg-monokai-bg">{lt.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-monokai-accent">终点 Target Node</label>
              <select value={form.targetId ?? ''} onChange={e => setForm(f => ({ ...f, targetId: Number(e.target.value) }))}
                className="w-full px-4 py-3 text-sm bg-monokai-sidebar/20 border border-monokai-border/40 text-monokai-fg rounded-lg focus:outline-none focus:border-monokai-cyan/50 transition-all appearance-none cursor-pointer">
                <option value="">选取节点...</option>
                {objects.map(o => <option key={o.id} value={o.id} className="bg-monokai-bg">{o.name}</option>)}
              </select>
            </div>
            <div className="mt-4 pt-4 border-t border-monokai-border/30 space-y-2">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-monokai-cyan tracking-wide">连接张力 Weight</label>
                <span className="text-sm font-mono text-monokai-cyan font-bold" style={{ textShadow: '0 0 8px rgba(102,217,239,0.5)' }}>{(Number(form.weight) || 0).toFixed(2)}</span>
              </div>
              <input type="range" min="0" max="1" step="0.05" value={form.weight} onChange={e => setForm(f => ({ ...f, weight: Number(e.target.value) }))}
                className="w-full monokai-slider accent-monokai-cyan outline-none cursor-pointer" />
              <div className="flex justify-between text-[9px] text-monokai-comment/50 font-mono">
                <span>0.0</span><span>0.5</span><span>1.0</span>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="p-4 flex gap-3 justify-between" style={{ borderTop: '1px solid rgba(102,217,239,0.08)' }}>
        <button onClick={onClose}
          className="px-5 py-2.5 text-sm font-medium rounded-lg text-monokai-comment hover:text-monokai-fg transition-all border border-transparent hover:border-monokai-border/40 flex items-center justify-center min-w-0">
          <span className="truncate">取消</span>
        </button>
        <button onClick={handleSave}
          className="px-6 py-2.5 text-sm font-bold rounded-lg text-monokai-bg transition-all flex items-center justify-center min-w-0 border border-transparent"
          style={{ background: 'linear-gradient(135deg, #66d9ef, #38bdf8)', boxShadow: '0 0 16px rgba(102,217,239,0.3), 0 4px 12px rgba(0,0,0,0.3)' }}>
          <span className="truncate">保存配置</span>
        </button>
      </div>

      {toast && <ToastNotification message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default RightInspector;
