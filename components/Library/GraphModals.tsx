/**
 * GraphModals — CreateNode, CreateLink, EditNode dialogs
 *
 * Extracted from D3GraphView.tsx.
 * Each modal manages its own form state internally and communicates
 * with the parent via onSave / onCancel callbacks.
 */

import React, { useState, useEffect } from 'react';
import type { GraphNode } from './D3GraphView/D3GraphView.types';

// ── Shared Styles ────────────────────────────────────────────────────────────

const MODAL_OVERLAY: React.CSSProperties = {
  position: 'absolute', inset: 0, zIndex: 3000,
  background: 'rgba(0,0,0,0.7)', display: 'flex',
  alignItems: 'center', justifyContent: 'center',
  backdropFilter: 'blur(4px)',
};

const MODAL_BOX: React.CSSProperties = {
  background: '#1c1c24', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 12, padding: 24,
  boxShadow: '0 8px 32px rgba(0,0,0,0.6)', color: '#f8f8f2',
};

const FIELD_STYLE: React.CSSProperties = {
  width: '100%', padding: '8px 10px', background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6,
  color: 'white', fontSize: 12, outline: 'none',
};

const LABEL_STYLE: React.CSSProperties = {
  display: 'block', fontSize: 11, color: '#888', marginBottom: 5,
};

const BTN_CANCEL: React.CSSProperties = {
  padding: '8px 16px', background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
  color: '#aaa', fontSize: 12, cursor: 'pointer', transition: 'all 0.2s',
};

const BTN_PRIMARY_BASE: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 6,
  fontSize: 12, fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s',
};

// ── CreateNodeModal ─────────────────────────────────────────────────────────

export interface CreateNodeData {
  name: string;
  group: 'instance' | 'typeHub' | 'action';
  objectTypeId: number;
  desc: string;
  props: string;
  actionStatus: string;
  coords: { x: number; y: number } | null;
}

export interface CreateNodeModalProps {
  visible: boolean;
  objectTypes: { id: number; name: string; description: string }[];
  onSave: (data: CreateNodeData) => Promise<void>;
  onCancel: () => void;
}

export const CreateNodeModal: React.FC<CreateNodeModalProps> = ({
  visible, objectTypes, onSave, onCancel,
}) => {
  const [group, setGroup] = useState<'instance' | 'typeHub' | 'action'>('instance');
  const [name, setName] = useState('');
  const [objectTypeId, setObjectTypeId] = useState(0);
  const [desc, setDesc] = useState('');
  const [props, setProps] = useState('{}');
  const [actionStatus, setActionStatus] = useState('pending');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && objectTypes?.length > 0 && objectTypeId === 0) {
      setObjectTypeId(objectTypes[0].id);
    }
  }, [visible, objectTypes, objectTypeId]);

  const handleSubmit = async () => {
    if (!name.trim()) { alert('请输入节点名称'); return; }
    if (group === 'instance' && !objectTypeId) { alert('请先选择一个对象类型'); return; }
    if (group === 'instance') {
      try { JSON.parse(props); } catch { alert('附加属性必须是有效的 JSON 字符串'); return; }
    }
    setSaving(true);
    try {
      await onSave({ name, group, objectTypeId, desc, props, actionStatus, coords: null });
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <div style={MODAL_OVERLAY}>
      <div style={{ ...MODAL_BOX, width: 420 }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 15, fontWeight: 'bold', color: '#66d9ef' }}>
          ➕ 新建本体节点
        </h3>

        <div style={{ marginBottom: 14 }}>
          <label style={LABEL_STYLE}>节点分组/类型</label>
          <select value={group} onChange={e => setGroup(e.target.value as any)} style={FIELD_STYLE}>
            <option value="instance" style={{ background: '#1c1c24' }}>落地实例 (Instance)</option>
            <option value="typeHub" style={{ background: '#1c1c24' }}>分类/类型 (Object Type)</option>
            <option value="action" style={{ background: '#1c1c24' }}>逻辑行动 (Action)</option>
          </select>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={LABEL_STYLE}>节点名称</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="例如：李娜，需求文档 v3.2，数据仓库" style={FIELD_STYLE} />
        </div>

        {group === 'instance' && (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={LABEL_STYLE}>所属对象类型</label>
              <select value={objectTypeId} onChange={e => setObjectTypeId(Number(e.target.value))} style={FIELD_STYLE}>
                {objectTypes.map(ot => (
                  <option key={ot.id} value={ot.id} style={{ background: '#1c1c24' }}>
                    {ot.name} ({ot.description})
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={LABEL_STYLE}>附加属性 (JSON 格式)</label>
              <textarea rows={4} value={props} onChange={e => setProps(e.target.value)}
                style={{ ...FIELD_STYLE, fontFamily: 'monospace', resize: 'vertical' }} />
            </div>
          </>
        )}

        {group === 'typeHub' && (
          <div style={{ marginBottom: 14 }}>
            <label style={LABEL_STYLE}>对象类型描述</label>
            <input type="text" value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="请输入对该类型或分类的简短描述" style={FIELD_STYLE} />
          </div>
        )}

        {group === 'action' && (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={LABEL_STYLE}>行动描述</label>
              <input type="text" value={desc} onChange={e => setDesc(e.target.value)}
                placeholder="例如：升级认证模块，优化磁盘空间" style={FIELD_STYLE} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={LABEL_STYLE}>初始执行状态</label>
              <select value={actionStatus} onChange={e => setActionStatus(e.target.value)} style={FIELD_STYLE}>
                <option value="pending" style={{ background: '#1c1c24' }}>待处理 (pending)</option>
                <option value="in_progress" style={{ background: '#1c1c24' }}>进行中 (in_progress)</option>
                <option value="done" style={{ background: '#1c1c24' }}>已完成 (done)</option>
              </select>
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onCancel}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.3)')}
            style={BTN_CANCEL}>
            取消
          </button>
          <button onClick={handleSubmit} disabled={saving}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(102,217,239,0.25)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(102,217,239,0.15)')}
            style={{ ...BTN_PRIMARY_BASE, background: 'rgba(102,217,239,0.15)', border: '1px solid rgba(102,217,239,0.3)', color: '#66d9ef', opacity: saving ? 0.6 : 1 }}>
            {saving ? '创建中...' : '确认创建'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── CreateLinkModal ─────────────────────────────────────────────────────────

export interface CreateLinkData {
  sourceNode: GraphNode;
  targetNode: GraphNode;
  linkTypeId: number;
  newLinkTypeName: string;
  weight: number;
}

export interface CreateLinkModalProps {
  visible: boolean;
  linkNodes: { source: GraphNode; target: GraphNode } | null;
  linkTypes: { id: number; name: string; description: string }[];
  onSave: (data: CreateLinkData) => Promise<void>;
  onCancel: () => void;
}

export const CreateLinkModal: React.FC<CreateLinkModalProps> = ({
  visible, linkNodes, linkTypes, onSave, onCancel,
}) => {
  const [linkTypeId, setLinkTypeId] = useState(0);
  const [newName, setNewName] = useState('');
  const [weight, setWeight] = useState(0.5);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && linkTypes?.length > 0 && linkTypeId === 0) {
      setLinkTypeId(linkTypes[0].id);
    }
  }, [visible, linkTypes, linkTypeId]);

  const handleSubmit = async () => {
    if (!linkNodes) return;
    setSaving(true);
    try {
      await onSave({ sourceNode: linkNodes.source, targetNode: linkNodes.target, linkTypeId, newLinkTypeName: newName, weight });
    } finally {
      setSaving(false);
    }
  };

  if (!visible || !linkNodes) return null;

  return (
    <div style={MODAL_OVERLAY}>
      <div style={{ ...MODAL_BOX, width: 400 }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 15, fontWeight: 'bold', color: '#a6e22e' }}>
          🔗 建立关系语义连线
        </h3>

        <div style={{ fontSize: 12, marginBottom: 16, background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 6, border: '1px solid rgba(255,255,255,0.05)' }}>
          <div>源实体: <strong style={{ color: '#ae81ff' }}>{linkNodes.source.label}</strong></div>
          <div style={{ marginTop: 4 }}>目标实体: <strong style={{ color: '#66d9ef' }}>{linkNodes.target.label}</strong></div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={LABEL_STYLE}>关系类型</label>
          <select value={linkTypeId} onChange={e => setLinkTypeId(Number(e.target.value))} style={FIELD_STYLE}>
            {linkTypes.map(lt => (
              <option key={lt.id} value={lt.id} style={{ background: '#1c1c24' }}>
                {lt.name} ({lt.description})
              </option>
            ))}
            <option value="-1" style={{ background: '#1c1c24', color: '#a6e22e' }}>+ 新建关系类型...</option>
          </select>
        </div>

        {linkTypeId === -1 && (
          <div style={{ marginBottom: 14 }}>
            <label style={LABEL_STYLE}>新建关系类型名称</label>
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="例如：reports_to，deploys_to" style={FIELD_STYLE} />
          </div>
        )}

        <div style={{ marginBottom: 18 }}>
          <label style={LABEL_STYLE}>关系关联权重 (Weight: {weight})</label>
          <input type="range" min="0.1" max="1.0" step="0.1" value={weight}
            onChange={e => setWeight(Number(e.target.value))} style={{ width: '100%', accentColor: '#a6e22e' }} />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.3)')}
            style={BTN_CANCEL}>
            取消
          </button>
          <button onClick={handleSubmit} disabled={saving}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(166,226,46,0.25)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(166,226,46,0.15)')}
            style={{ ...BTN_PRIMARY_BASE, background: 'rgba(166,226,46,0.15)', border: '1px solid rgba(166,226,46,0.3)', color: '#a6e22e', opacity: saving ? 0.6 : 1 }}>
            {saving ? '连接中...' : '确认连接'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── EditNodeModal ───────────────────────────────────────────────────────────

export interface EditNodeData {
  node: GraphNode;
  name: string;
  props: string;
}

export interface EditNodeModalProps {
  visible: boolean;
  node: GraphNode | null;
  onSave: (data: EditNodeData) => Promise<void>;
  onCancel: () => void;
}

export const EditNodeModal: React.FC<EditNodeModalProps> = ({
  visible, node, onSave, onCancel,
}) => {
  const [name, setName] = useState('');
  const [props, setProps] = useState('{}');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && node) {
      setName(node.label || '');
      setProps(node._propsRaw || '{}');
    }
  }, [visible, node]);

  const handleSubmit = async () => {
    if (!node) return;
    if (!name.trim()) { alert('请输入节点名称'); return; }
    try { JSON.parse(props); } catch { alert('属性必须是有效的 JSON 字符串'); return; }
    setSaving(true);
    try {
      await onSave({ node, name, props });
    } finally {
      setSaving(false);
    }
  };

  if (!visible || !node) return null;

  return (
    <div style={MODAL_OVERLAY}>
      <div style={{ ...MODAL_BOX, width: 400 }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 15, fontWeight: 'bold', color: '#ae81ff' }}>
          ✏️ 修改实体属性
        </h3>

        <div style={{ marginBottom: 14 }}>
          <label style={LABEL_STYLE}>实体名称</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} style={FIELD_STYLE} />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={LABEL_STYLE}>附加属性 (JSON 格式)</label>
          <textarea rows={5} value={props} onChange={e => setProps(e.target.value)}
            style={{ ...FIELD_STYLE, fontFamily: 'monospace', resize: 'vertical' }} />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.3)')}
            style={BTN_CANCEL}>
            取消
          </button>
          <button onClick={handleSubmit} disabled={saving}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(174,129,255,0.25)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(174,129,255,0.15)')}
            style={{ ...BTN_PRIMARY_BASE, background: 'rgba(174,129,255,0.15)', border: '1px solid rgba(174,129,255,0.3)', color: '#ae81ff', opacity: saving ? 0.6 : 1 }}>
            {saving ? '保存中...' : '保存修改'}
          </button>
        </div>
      </div>
    </div>
  );
};
