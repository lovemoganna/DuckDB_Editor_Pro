/**
 * OntologyCaseStudio.tsx - OPLA 独立建模一体化全景工作台
 * 
 * 彻底重构设计（告别翻页式分步，采用四列平铺看板与图谱联动）：
 * 1. 顶部紧凑业务故事抽屉（随时展开/收起业务证据）；
 * 2. 核心工作区：OPLA 四要素全景看板 (Objects | Properties | Links | Actions 同屏平铺)；
 * 3. 底部实时拓扑网络图谱联动（双向高亮、直观可读）；
 * 4. 就地快速行内新增与编辑，高密度无嵌套滚动。
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  Plus, Trash2, Edit3, CheckCircle2, AlertTriangle, 
  RotateCcw, Download, Copy, Check, Database, Zap, Sparkles,
  ChevronDown, ChevronUp, ChevronRight, Layers, ListFilter,
  Network, ShieldCheck, FileText, ArrowRight, Activity
} from 'lucide-react';
import { PRESET_MODELING_CASES, ModelingCase, CaseObject, CaseLink, CaseAction, CaseObjectProperty } from './data/mockCaseData';

interface OntologyCaseStudioProps {
  currentCase: ModelingCase;
  onChangeCase: (updated: ModelingCase) => void;
  selectedObjectId: string;
  onSelectObject: (objId: string) => void;
  onResetStandard?: () => void;
}

export const OntologyCaseStudio: React.FC<OntologyCaseStudioProps> = ({
  currentCase,
  onChangeCase,
  selectedObjectId,
  onSelectObject,
  onResetStandard,
}) => {
  // 业务材料背景抽屉是否展开
  const [showStoryDrawer, setShowStoryDrawer] = useState(false);

  // 拓扑图谱悬浮/选中状态
  const [hoveredObjectId, setHoveredObjectId] = useState<string | null>(null);

  // 默认选中第一个 Object
  useEffect(() => {
    if (currentCase.referenceModel.objects.length > 0 && !selectedObjectId) {
      onSelectObject(currentCase.referenceModel.objects[0].id);
    }
  }, [currentCase.referenceModel.objects, selectedObjectId, onSelectObject]);

  // 当前选中的 Object
  const activeObject = useMemo(() => {
    return currentCase.referenceModel.objects.find(o => o.id === selectedObjectId) 
      || currentCase.referenceModel.objects[0] 
      || null;
  }, [currentCase.referenceModel.objects, selectedObjectId]);

  // ============================================================
  // Object 操作
  // ============================================================
  const handleAddObject = () => {
    const count = currentCase.referenceModel.objects.length + 1;
    const newId = `obj-${Date.now()}`;
    const newObj: CaseObject = {
      id: newId,
      name: `NewEntity${count}`,
      displayName: `新业务实体${count}`,
      description: '定义该业务实体的独立生命周期',
      isEventDriven: false,
      primaryKey: `entity_${count}_id`,
      properties: [
        {
          id: `p-${Date.now()}-pk`,
          name: `entity_${count}_id`,
          dataType: 'VARCHAR',
          kind: 'identity',
          description: '唯一主键标识符',
          exampleValue: `'ID-${count}'`,
        },
        {
          id: `p-${Date.now()}-state`,
          name: 'status',
          dataType: 'VARCHAR',
          kind: 'state',
          description: '核心状态机',
          exampleValue: "'INITIAL'",
        },
      ],
    };

    onChangeCase({
      ...currentCase,
      referenceModel: {
        ...currentCase.referenceModel,
        objects: [...currentCase.referenceModel.objects, newObj],
      },
    });
    onSelectObject(newId);
  };

  const handleDeleteObject = (objId: string) => {
    const updatedObjs = currentCase.referenceModel.objects.filter(o => o.id !== objId);
    onChangeCase({
      ...currentCase,
      referenceModel: {
        ...currentCase.referenceModel,
        objects: updatedObjs,
        links: currentCase.referenceModel.links.filter(l => l.sourceObjectId !== objId && l.targetObjectId !== objId),
        actions: currentCase.referenceModel.actions.filter(a => a.targetObjectId !== objId),
      },
    });
    if (selectedObjectId === objId && updatedObjs.length > 0) {
      onSelectObject(updatedObjs[0].id);
    }
  };

  const handleUpdateObject = (objId: string, updates: Partial<CaseObject>) => {
    onChangeCase({
      ...currentCase,
      referenceModel: {
        ...currentCase.referenceModel,
        objects: currentCase.referenceModel.objects.map(o => o.id === objId ? { ...o, ...updates } : o),
      },
    });
  };

  // ============================================================
  // Property 操作
  // ============================================================
  const handleAddProperty = (objId: string) => {
    const obj = currentCase.referenceModel.objects.find(o => o.id === objId);
    if (!obj) return;

    const propCount = obj.properties.length + 1;
    const newProp: CaseObjectProperty = {
      id: `prop-${Date.now()}`,
      name: `field_${propCount}`,
      dataType: 'VARCHAR',
      kind: 'immutable',
      description: '属性说明',
      exampleValue: "'demo'",
    };

    handleUpdateObject(objId, {
      properties: [...obj.properties, newProp],
    });
  };

  const handleDeleteProperty = (objId: string, propId: string) => {
    const obj = currentCase.referenceModel.objects.find(o => o.id === objId);
    if (!obj) return;
    handleUpdateObject(objId, {
      properties: obj.properties.filter(p => p.id !== propId),
    });
  };

  const handleUpdateProperty = (objId: string, propId: string, updates: Partial<CaseObjectProperty>) => {
    const obj = currentCase.referenceModel.objects.find(o => o.id === objId);
    if (!obj) return;
    handleUpdateObject(objId, {
      properties: obj.properties.map(p => p.id === propId ? { ...p, ...updates } : p),
    });
  };

  // ============================================================
  // Link 操作
  // ============================================================
  const handleAddLink = () => {
    const objs = currentCase.referenceModel.objects;
    if (objs.length < 2) return;

    const newLink: CaseLink = {
      id: `link-${Date.now()}`,
      sourceObjectId: objs[0].id,
      targetObjectId: objs[1].id,
      predicate: 'LINKED_TO',
      cardinality: '1:N',
      description: '定义业务动词关系',
    };

    onChangeCase({
      ...currentCase,
      referenceModel: {
        ...currentCase.referenceModel,
        links: [...currentCase.referenceModel.links, newLink],
      },
    });
  };

  const handleDeleteLink = (linkId: string) => {
    onChangeCase({
      ...currentCase,
      referenceModel: {
        ...currentCase.referenceModel,
        links: currentCase.referenceModel.links.filter(l => l.id !== linkId),
      },
    });
  };

  const handleUpdateLink = (linkId: string, updates: Partial<CaseLink>) => {
    onChangeCase({
      ...currentCase,
      referenceModel: {
        ...currentCase.referenceModel,
        links: currentCase.referenceModel.links.map(l => l.id === linkId ? { ...l, ...updates } : l),
      },
    });
  };

  // ============================================================
  // Action 操作
  // ============================================================
  const handleAddAction = () => {
    const objs = currentCase.referenceModel.objects;
    if (objs.length === 0) return;

    const newAct: CaseAction = {
      id: `act-${Date.now()}`,
      name: `Action${currentCase.referenceModel.actions.length + 1}`,
      displayName: `行动指令${currentCase.referenceModel.actions.length + 1}`,
      targetObjectId: objs[0].id,
      actor: '调度操作员',
      preconditions: 'target.status == "PENDING"',
      mutation: 'target.status := "EXECUTED"',
      auditEvent: 'EVT_ACTION_DONE',
      description: '业务闭环写入操作',
    };

    onChangeCase({
      ...currentCase,
      referenceModel: {
        ...currentCase.referenceModel,
        actions: [...currentCase.referenceModel.actions, newAct],
      },
    });
  };

  const handleDeleteAction = (actId: string) => {
    onChangeCase({
      ...currentCase,
      referenceModel: {
        ...currentCase.referenceModel,
        actions: currentCase.referenceModel.actions.filter(a => a.id !== actId),
      },
    });
  };

  const handleUpdateAction = (actId: string, updates: Partial<CaseAction>) => {
    onChangeCase({
      ...currentCase,
      referenceModel: {
        ...currentCase.referenceModel,
        actions: currentCase.referenceModel.actions.map(a => a.id === actId ? { ...a, ...updates } : a),
      },
    });
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-monokai-bg text-monokai-fg min-w-0 overflow-hidden font-sans">
      {/* 1. 顶部场景条 (紧凑可折叠业务背景抽屉) */}
      <div className="shrink-0 border-b border-monokai-border/80 bg-monokai-sidebar/70 px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-monokai-green/15 text-monokai-green font-bold border border-monokai-green/30 shrink-0">
            {currentCase.difficulty}
          </span>
          <h2 className="text-xs font-bold text-white truncate">
            {currentCase.title}
          </h2>
          <span className="text-[11px] text-monokai-comment truncate hidden sm:inline">
            · {currentCase.summary}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onResetStandard && (
            <button
              onClick={onResetStandard}
              className="text-[10px] text-monokai-comment hover:text-white px-2 py-0.5 rounded border border-monokai-border/60 hover:bg-monokai-surface transition-all flex items-center gap-1 cursor-pointer"
              title="恢复案例标准参考模型"
            >
              <RotateCcw className="w-3 h-3" />
              <span>重置参考</span>
            </button>
          )}

          <button
            onClick={() => setShowStoryDrawer(!showStoryDrawer)}
            className="text-[11px] text-monokai-cyan hover:underline flex items-center gap-1 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{showStoryDrawer ? '收起业务故事材料' : '展开业务故事材料'}</span>
            {showStoryDrawer ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* 展开的业务材料卡片 */}
      {showStoryDrawer && (
        <div className="shrink-0 max-h-52 overflow-y-auto p-3.5 bg-monokai-bg/95 border-b border-monokai-border/80 space-y-2 text-xs">
          <div className="text-[11px] font-bold text-monokai-cyan flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            <span>原始业务问题与材料证据：</span>
          </div>
          <p className="text-monokai-fg/90 leading-relaxed font-mono bg-monokai-sidebar/80 p-2.5 rounded border border-monokai-border/50 select-text">
            {currentCase.businessBackground}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {currentCase.businessDilemmas.map((dil, idx) => (
              <span key={idx} className="text-[10.5px] px-2 py-0.5 rounded bg-monokai-pink/10 border border-monokai-pink/30 text-monokai-pink flex items-center gap-1">
                <span>痛点 0{idx + 1}:</span>
                <span className="text-monokai-fg/90">{dil.split('：')[0]}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 2. 核心工作面：OPLA 四要素全景看板 (4列联动平铺) */}
      <div className="flex-1 flex min-h-0 divide-x divide-monokai-border/70 overflow-hidden">
        
        {/* ================= COLUMN 1: OBJECTS (实体对象) ================= */}
        <div className="w-56 shrink-0 flex flex-col bg-monokai-sidebar/40 min-w-0 overflow-hidden">
          <div className="h-8 px-3 border-b border-monokai-border/60 bg-monokai-surface/40 flex items-center justify-between text-[11px] font-bold text-white">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-monokai-cyan" />
              <span>1. Objects 实体 ({currentCase.referenceModel.objects.length})</span>
            </span>
            <button
              onClick={handleAddObject}
              className="p-1 rounded text-monokai-comment hover:text-monokai-cyan cursor-pointer"
              title="新增 Object"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
            {currentCase.referenceModel.objects.map(obj => {
              const isSelected = selectedObjectId === obj.id;
              return (
                <div
                  key={obj.id}
                  onClick={() => onSelectObject(obj.id)}
                  onMouseEnter={() => setHoveredObjectId(obj.id)}
                  onMouseLeave={() => setHoveredObjectId(null)}
                  className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer group relative ${
                    isSelected
                      ? 'bg-monokai-cyan/15 border-monokai-cyan text-white shadow-xs'
                      : 'bg-monokai-bg/60 border-monokai-border/60 text-monokai-fg hover:border-monokai-border hover:bg-monokai-surface/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-bold text-xs truncate">{obj.displayName}</div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteObject(obj.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-monokai-comment hover:text-monokai-pink transition-opacity cursor-pointer"
                      title="删除实体"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-monokai-cyan truncate">{obj.name}</span>
                    {obj.isEventDriven ? (
                      <span className="px-1 rounded bg-monokai-yellow/20 text-monokai-yellow text-[9px] font-sans shrink-0">事件</span>
                    ) : (
                      <span className="text-monokai-comment">{obj.properties.length} 属性</span>
                    )}
                  </div>

                  <div className="text-[9.5px] text-monokai-green font-mono truncate mt-1">
                    PK: {obj.primaryKey || '未定义'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ================= COLUMN 2: PROPERTIES (属性度量) ================= */}
        <div className="flex-1 flex flex-col min-w-0 bg-monokai-bg/30 overflow-hidden">
          <div className="h-8 px-3 border-b border-monokai-border/60 bg-monokai-surface/40 flex items-center justify-between text-[11px] font-bold text-white">
            <span className="flex items-center gap-1.5 truncate">
              <span className="w-2 h-2 rounded-full bg-monokai-yellow" />
              <span>
                2. Properties 属性度量
                {activeObject && <span className="text-monokai-comment font-normal ml-1">({activeObject.displayName})</span>}
              </span>
            </span>

            {activeObject && (
              <button
                onClick={() => handleAddProperty(activeObject.id)}
                className="p-1 rounded text-monokai-comment hover:text-monokai-yellow cursor-pointer"
                title="添加属性字段"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
            {activeObject ? (
              activeObject.properties.map(p => (
                <div 
                  key={p.id}
                  className="p-2 rounded-lg bg-monokai-sidebar/60 border border-monokai-border/60 flex flex-wrap items-center gap-2 text-xs group"
                >
                  <input
                    type="text"
                    value={p.name}
                    onChange={(e) => handleUpdateProperty(activeObject.id, p.id, { name: e.target.value })}
                    className="w-28 bg-monokai-bg border border-monokai-border rounded px-1.5 py-0.5 text-[11px] font-mono text-white focus:border-monokai-yellow"
                    placeholder="字段英文名"
                  />

                  <select
                    value={p.dataType}
                    onChange={(e) => handleUpdateProperty(activeObject.id, p.id, { dataType: e.target.value as any })}
                    className="bg-monokai-bg border border-monokai-border rounded px-1 py-0.5 text-[10px] font-mono text-monokai-cyan focus:border-monokai-yellow cursor-pointer"
                  >
                    <option value="VARCHAR">VARCHAR</option>
                    <option value="INTEGER">INTEGER</option>
                    <option value="DOUBLE">DOUBLE</option>
                    <option value="TIMESTAMP">TIMESTAMP</option>
                    <option value="BOOLEAN">BOOLEAN</option>
                  </select>

                  <select
                    value={p.kind}
                    onChange={(e) => handleUpdateProperty(activeObject.id, p.id, { kind: e.target.value as any })}
                    className="bg-monokai-bg border border-monokai-border rounded px-1 py-0.5 text-[10px] text-monokai-yellow focus:border-monokai-yellow cursor-pointer"
                  >
                    <option value="identity">身份标识</option>
                    <option value="immutable">不可变</option>
                    <option value="state">状态机</option>
                    <option value="metric">派生度量</option>
                  </select>

                  <input
                    type="text"
                    value={p.description}
                    onChange={(e) => handleUpdateProperty(activeObject.id, p.id, { description: e.target.value })}
                    className="flex-1 min-w-[80px] bg-monokai-bg border border-monokai-border rounded px-1.5 py-0.5 text-[11px] text-monokai-fg/80 focus:border-monokai-yellow"
                    placeholder="属性说明"
                  />

                  <button
                    onClick={() => handleDeleteProperty(activeObject.id, p.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-monokai-comment hover:text-monokai-pink cursor-pointer transition-opacity"
                    title="删除属性"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-[11px] text-monokai-comment">
                请先在左侧选择一个实体
              </div>
            )}
          </div>
        </div>

        {/* ================= COLUMN 3: LINKS (关系拓扑) ================= */}
        <div className="w-68 shrink-0 flex flex-col bg-monokai-sidebar/40 min-w-0 overflow-hidden">
          <div className="h-8 px-3 border-b border-monokai-border/60 bg-monokai-surface/40 flex items-center justify-between text-[11px] font-bold text-white">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-monokai-blue" />
              <span>3. Links 关系 ({currentCase.referenceModel.links.length})</span>
            </span>
            <button
              onClick={handleAddLink}
              className="p-1 rounded text-monokai-comment hover:text-monokai-blue cursor-pointer"
              title="添加关系连接"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
            {currentCase.referenceModel.links.map(l => {
              const srcObj = currentCase.referenceModel.objects.find(o => o.id === l.sourceObjectId);
              const tgtObj = currentCase.referenceModel.objects.find(o => o.id === l.targetObjectId);
              return (
                <div 
                  key={l.id}
                  className="p-2 rounded-lg bg-monokai-bg/60 border border-monokai-border/60 space-y-1.5 text-xs group hover:border-monokai-blue/50 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={l.predicate}
                      onChange={(e) => handleUpdateLink(l.id, { predicate: e.target.value.toUpperCase() })}
                      className="w-36 bg-monokai-bg border border-monokai-border rounded px-1.5 py-0.5 text-[10.5px] font-mono font-bold text-monokai-blue focus:border-monokai-blue"
                      placeholder="动词谓词"
                    />
                    <select
                      value={l.cardinality}
                      onChange={(e) => handleUpdateLink(l.id, { cardinality: e.target.value as any })}
                      className="bg-monokai-bg border border-monokai-border rounded px-1 py-0.5 text-[10px] font-mono text-monokai-yellow cursor-pointer"
                    >
                      <option value="1:1">1:1</option>
                      <option value="1:N">1:N</option>
                      <option value="N:1">N:1</option>
                      <option value="M:N">M:N</option>
                    </select>
                    <button
                      onClick={() => handleDeleteLink(l.id)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-monokai-comment hover:text-monokai-pink cursor-pointer transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1 text-[10px] text-monokai-comment">
                    <span className="text-monokai-cyan truncate max-w-[80px] font-medium">{srcObj?.displayName || '源实体'}</span>
                    <ArrowRight className="w-2.5 h-2.5 shrink-0" />
                    <span className="text-monokai-green truncate max-w-[80px] font-medium">{tgtObj?.displayName || '目标实体'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ================= COLUMN 4: ACTIONS (业务行动) ================= */}
        <div className="w-68 shrink-0 flex flex-col bg-monokai-bg/20 min-w-0 overflow-hidden">
          <div className="h-8 px-3 border-b border-monokai-border/60 bg-monokai-surface/40 flex items-center justify-between text-[11px] font-bold text-white">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-monokai-green" />
              <span>4. Actions 闭环 ({currentCase.referenceModel.actions.length})</span>
            </span>
            <button
              onClick={handleAddAction}
              className="p-1 rounded text-monokai-comment hover:text-monokai-green cursor-pointer"
              title="新增 Action 行动"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
            {currentCase.referenceModel.actions.map(act => {
              const tgt = currentCase.referenceModel.objects.find(o => o.id === act.targetObjectId);
              return (
                <div 
                  key={act.id}
                  className="p-2 rounded-lg bg-monokai-sidebar/60 border border-monokai-border/60 space-y-1.5 text-xs group hover:border-monokai-green/50 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={act.displayName}
                      onChange={(e) => handleUpdateAction(act.id, { displayName: e.target.value })}
                      className="w-28 bg-monokai-bg border border-monokai-border rounded px-1.5 py-0.5 text-[11px] font-bold text-white focus:border-monokai-green"
                      placeholder="行动名称"
                    />
                    <input
                      type="text"
                      value={act.actor}
                      onChange={(e) => handleUpdateAction(act.id, { actor: e.target.value })}
                      className="w-20 bg-monokai-bg border border-monokai-border rounded px-1 py-0.5 text-[10px] text-monokai-comment focus:border-monokai-green"
                      placeholder="执行角色"
                    />
                    <button
                      onClick={() => handleDeleteAction(act.id)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-monokai-comment hover:text-monokai-pink cursor-pointer transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="text-[10px] text-monokai-yellow font-mono truncate bg-monokai-bg/70 px-1.5 py-0.5 rounded">
                    Guard: {act.preconditions || '无前置守卫'}
                  </div>

                  <div className="text-[10px] text-monokai-green font-mono truncate">
                    Mut: {act.mutation || '无状态变更'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* 3. 底部实时联动拓扑图谱预览区 (SVG Topology Canvas) */}
      <div className="h-44 shrink-0 border-t border-monokai-border/80 bg-monokai-sidebar/50 p-2 flex flex-col min-h-0 relative">
        <div className="flex items-center justify-between px-2 mb-1">
          <span className="text-[11px] font-bold text-monokai-comment flex items-center gap-1">
            <Network className="w-3.5 h-3.5 text-monokai-cyan" />
            <span>OPLA 拓扑实时渲染视窗</span>
          </span>
          <span className="text-[10px] text-monokai-comment">
            点击节点可即时选中实体，联动看板高亮
          </span>
        </div>

        <div className="flex-1 w-full bg-monokai-bg/80 rounded-lg border border-monokai-border/60 overflow-hidden flex items-center justify-center relative">
          <svg className="w-full h-full p-2" viewBox="0 0 600 130">
            <defs>
              <marker id="canvas-arrow" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#66d9ef" />
              </marker>
            </defs>

            {/* Links 连线 */}
            {currentCase.referenceModel.links.map(l => {
              const srcIdx = currentCase.referenceModel.objects.findIndex(o => o.id === l.sourceObjectId);
              const tgtIdx = currentCase.referenceModel.objects.findIndex(o => o.id === l.targetObjectId);
              if (srcIdx === -1 || tgtIdx === -1) return null;

              const total = currentCase.referenceModel.objects.length;
              const x1 = 60 + (srcIdx * (480 / Math.max(1, total - 1)));
              const y1 = srcIdx % 2 === 0 ? 40 : 90;
              const x2 = 60 + (tgtIdx * (480 / Math.max(1, total - 1)));
              const y2 = tgtIdx % 2 === 0 ? 40 : 90;

              const midX = (x1 + x2) / 2;
              const midY = (y1 + y2) / 2 - 8;

              return (
                <g key={l.id}>
                  <path
                    d={`M ${x1} ${y1} Q ${midX} ${midY - 10} ${x2} ${y2}`}
                    fill="none"
                    stroke="#66d9ef"
                    strokeWidth="1.5"
                    strokeDasharray="3 2"
                    markerEnd="url(#canvas-arrow)"
                    className="opacity-70"
                  />
                  <text
                    x={midX}
                    y={midY}
                    fill="#a6e22e"
                    fontSize="8.5"
                    fontFamily="monospace"
                    textAnchor="middle"
                    className="font-bold"
                  >
                    {l.predicate}
                  </text>
                </g>
              );
            })}

            {/* Objects 节点 */}
            {currentCase.referenceModel.objects.map((obj, idx) => {
              const total = currentCase.referenceModel.objects.length;
              const cx = 60 + (idx * (480 / Math.max(1, total - 1)));
              const cy = idx % 2 === 0 ? 40 : 90;
              const isSelected = selectedObjectId === obj.id || hoveredObjectId === obj.id;

              return (
                <g
                  key={obj.id}
                  onClick={() => onSelectObject(obj.id)}
                  className="cursor-pointer transition-transform hover:scale-105"
                >
                  <circle
                    cx={cx}
                    cy={cy}
                    r="18"
                    fill={obj.isEventDriven ? '#fd971f' : '#272822'}
                    stroke={isSelected ? '#66d9ef' : obj.isEventDriven ? '#e6db74' : '#75715e'}
                    strokeWidth={isSelected ? '2.5' : '1.5'}
                  />
                  <text
                    x={cx}
                    y={cy + 3.5}
                    fill="#f8f8f2"
                    fontSize="9.5"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {obj.displayName.slice(0, 3)}
                  </text>
                  <text
                    x={cx}
                    y={cy + 26}
                    fill="#75715e"
                    fontSize="8.5"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {obj.name}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
};

export default OntologyCaseStudio;
