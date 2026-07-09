/**
 * OntologyModelingWizard — AI 本体建模引导式 UI
 *
 * Layout principles:
 * - Header: 44px fixed, icon + two-line title + close button
 * - Step indicator: compact pill row, horizontal connector lines
 * - Content: consistent px-6, controlled vertical rhythm
 * - Cards: single-row height (36px), icon + inputs + delete aligned to center axis
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  X, Wand2, Loader2, ChevronRight, ChevronLeft, Check, Plus, Trash2,
  Layers, Table2, AlertTriangle, Sparkles, ArrowDown, Edit3, Zap, BrainCircuit
} from 'lucide-react';
import { ontologyModelingService, OntologyModelingResult, ModelingProgress, ModelingObjectType, ModelingObject } from '../../services/ontologyModelingService';

// ============================================================
// Types
// ============================================================

type WizardStep = 1 | 2 | 3;

interface Props {
  onClose: () => void;
  onImport: (result: OntologyModelingResult) => Promise<void>;
}

// ============================================================
// Background
// ============================================================

const ConstellationBG: React.FC = () => null;

// ============================================================
// Step Indicator
// ============================================================
// Three steps as a single flex row:
//   [circle+label] ── line ── [circle+label] ── line ── [circle+label]
// All circles: 32×32 (w-8 h-8). Line: full height of step column, centered.

const StepIndicator: React.FC<{ step: WizardStep }> = ({ step }) => {
  const items = [
    { n: 1, label: '概念输入', Icon: Edit3 },
    { n: 2, label: '预览确认', Icon: BrainCircuit },
    { n: 3, label: '执行导入', Icon: ArrowDown },
  ];

  return (
    <div className="flex items-center justify-center gap-0 py-4 px-4">
      {items.map((item, i) => {
        const done = item.n < step;
        const active = item.n === step;

        return (
          <React.Fragment key={item.n}>
            {/* Step: icon circle + label below */}
            <div className="flex flex-col items-center gap-1.5">
              {/* Glow behind active circle */}
              {active && (
                <div className="absolute w-8 h-8 rounded-full shadow-[0_0_20px_rgba(139,233,253,0.6)]" />
              )}
              <div className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-500
                ${done ? 'bg-monokai-purple/20 border-monokai-purple shadow-[0_0_12px_rgba(189,147,249,0.5)]' : active ? 'bg-monokai-cyan/15 border-monokai-cyan' : 'bg-monokai-surface/40 border-monokai-comment/30'}
              ">
                {done
                  ? <Check className="w-4 h-4 text-monokai-purple" strokeWidth={2.5} />
                  : <item.Icon className={`w-3.5 h-3.5 ${active ? 'text-monokai-cyan' : 'text-monokai-comment/40'}`} />
                }
              </div>
              <span className={`text-[10px] font-medium whitespace-nowrap transition-colors duration-300
                ${done ? 'text-monokai-purple' : active ? 'text-monokai-cyan' : 'text-monokai-comment/40'}
              `}>
                {item.label}
              </span>
            </div>

            {/* Connector line — only between steps */}
            {i < 2 && (
              <div className="flex-1 mx-2 flex items-center min-w-[16px]">
                <div className={`h-px w-full rounded-full transition-all duration-700
                  ${done ? 'bg-gradient-to-r from-monokai-purple to-monokai-cyan shadow-[0_0_6px_rgba(189,147,249,0.5)]' : 'bg-monokai-comment/20'}
                `} />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ============================================================
// Section Header
// ============================================================
// Row: [icon badge + label + count badge] .............. [add button]
// All items vertically centered to 24px content height

const SectionHeader: React.FC<{
  icon: React.ReactElement;
  label: string;
  count: number;
  accent: 'purple' | 'cyan';
  onAdd?: () => void;
}> = ({ icon, label, count, accent, onAdd }) => {
  const iconBg = accent === 'purple' ? 'bg-monokai-purple/20' : 'bg-monokai-cyan/20';
  const iconColor = accent === 'purple' ? 'text-monokai-purple' : 'text-monokai-cyan';
  const badgeBg = accent === 'purple' ? 'bg-monokai-purple/15 text-monokai-purple' : 'bg-monokai-cyan/15 text-monokai-cyan';

  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <div className={`w-6 h-6 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
          {React.cloneElement(icon as React.ReactElement<{className?: string}>, { className: `w-3.5 h-3.5 ${iconColor}` })}
        </div>
        <span className="text-sm font-semibold text-monokai-fg">{label}</span>
        <span className={`text-[11px] px-1.5 h-[18px] flex items-center rounded-full font-medium ${badgeBg}`}>
          {count}
        </span>
      </div>
      {onAdd && (
        <button
          onClick={onAdd}
          className="flex items-center gap-1 px-2 h-6 text-[11px] rounded-lg
            bg-monokai-surface/40 text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/60
            border border-monokai-accent/10 transition-all duration-200"
        >
          <Plus className="w-3 h-3" />
          添加
        </button>
      )}
    </div>
  );
};

// ============================================================
// Object Type Card
// ============================================================
// Single row height: 36px (icon 24×24 + px padding = 36px total)
// Layout: [left-bar] [icon 24] [name input] [desc input] [delete 24]
// Inputs are 24px tall, vertically centered with icon

const ObjectTypeCard: React.FC<{
  item: ModelingObjectType;
  index: number;
  onChange: (i: number, val: Partial<ModelingObjectType>) => void;
  onRemove: (i: number) => void;
}> = ({ item, index, onChange, onRemove }) => {
  const [focused, setFocused] = useState(false);

  return (
    <div
      className="group relative flex items-center gap-2 px-2.5 py-2 rounded-xl mb-1 last:mb-0
        bg-monokai-surface/15 border border-monokai-purple/10
        hover:border-monokai-purple/35 hover:bg-monokai-surface/25
        transition-all duration-200"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Left accent bar */}
      <div className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-monokai-purple/0 group-hover:bg-monokai-purple/60 transition-all duration-200" />

      {/* Icon badge: 24×24 */}
      <div className="w-6 h-6 rounded-lg bg-monokai-purple/15 flex items-center justify-center shrink-0">
        <Layers className="w-3.5 h-3.5 text-monokai-purple/75" />
      </div>

      {/* Name input */}
      <input
        value={item.name}
        onChange={e => onChange(index, { name: e.target.value })}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`
          flex-1 h-6 px-2.5 text-sm bg-black/30 border text-monokai-fg rounded-lg
          focus:outline-none transition-all duration-200
          ${focused ? 'border-monokai-purple/55 shadow-[0_0_10px_rgba(189,147,249,0.18)]' : 'border-monokai-purple/15'}
        `}
        placeholder="类型名称"
      />

      {/* Description input */}
      <input
        value={item.description}
        onChange={e => onChange(index, { description: e.target.value })}
        className="w-32 h-6 px-2.5 text-xs bg-black/20 border border-monokai-accent/10 text-monokai-comment rounded-lg focus:outline-none focus:border-monokai-accent/35 transition-colors"
        placeholder="类型描述"
      />

      {/* Delete button */}
      <button
        onClick={() => onRemove(index)}
        className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0
          text-monokai-comment/30 hover:text-monokai-orange hover:bg-monokai-orange/10
          opacity-0 group-hover:opacity-100 transition-all duration-200"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

// ============================================================
// Object Instance Card
// ============================================================

const ObjectCard: React.FC<{
  item: ModelingObject;
  index: number;
  onChange: (i: number, val: Partial<ModelingObject>) => void;
  onRemove: (i: number) => void;
  typeNames: string[];
}> = ({ item, index, onChange, onRemove, typeNames }) => {
  const [focused, setFocused] = useState(false);

  return (
    <div
      className="group relative flex items-center gap-2 px-2.5 py-2 rounded-xl mb-1 last:mb-0
        bg-monokai-surface/15 border border-monokai-cyan/10
        hover:border-monokai-cyan/35 hover:bg-monokai-surface/25
        transition-all duration-200"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {/* Left accent bar */}
      <div className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-monokai-cyan/0 group-hover:bg-monokai-cyan/60 transition-all duration-200" />

      {/* Icon badge with pulse dot */}
      <div className="relative w-6 h-6 rounded-lg bg-monokai-cyan/15 flex items-center justify-center shrink-0">
        <Table2 className="w-3.5 h-3.5 text-monokai-cyan/75" />
        <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-monokai-cyan/45" />
      </div>

      {/* Name input */}
      <input
        value={item.name}
        onChange={e => onChange(index, { name: e.target.value })}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`
          flex-1 h-6 px-2.5 text-sm bg-black/30 border text-monokai-fg rounded-lg
          focus:outline-none transition-all duration-200
          ${focused ? 'border-monokai-cyan/55 shadow-[0_0_10px_rgba(139,233,253,0.18)]' : 'border-monokai-cyan/15'}
        `}
        placeholder="对象名称"
      />

      {/* Type selector */}
      <select
        value={item.objectType}
        onChange={e => onChange(index, { objectType: e.target.value })}
        className="w-24 h-6 px-2 text-xs bg-black/20 border border-monokai-purple/15 text-monokai-purple rounded-lg focus:outline-none focus:border-monokai-purple/45 transition-colors appearance-none cursor-pointer"
      >
        {typeNames.map(t => <option key={t} value={t} className="bg-monokai-bg">{t}</option>)}
      </select>

      {/* Annotation input */}
      <input
        value={item.annotations || ''}
        onChange={e => onChange(index, { annotations: e.target.value })}
        className="w-24 h-6 px-2 text-xs bg-black/20 border border-monokai-accent/10 text-monokai-comment rounded-lg focus:outline-none focus:border-monokai-accent/35 transition-colors"
        placeholder="备注"
      />

      {/* Delete button */}
      <button
        onClick={() => onRemove(index)}
        className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0
          text-monokai-comment/30 hover:text-monokai-orange hover:bg-monokai-orange/10
          opacity-0 group-hover:opacity-100 transition-all duration-200"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

// ============================================================
// Loading State
// ============================================================

const LoadingState: React.FC<{ progress: ModelingProgress | null }> = ({ progress }) => {
  const [visible, setVisible] = React.useState<Set<number>>(new Set());

  useEffect(() => {
    const timers = [0, 300, 700, 1100, 1500].map((d, i) =>
      setTimeout(() => setVisible(v => new Set([...v, i])), d)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const messages = ['解析领域概念', '构建对象类型体系', '生成实例对象', '推导语义关系', '优化本体结构'];

  return (
    <div className="flex flex-col items-center gap-5 py-8">
      {/* Orb */}
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-2 border-monokai-purple/20 animate-spin" style={{ animationDuration: '3s' }} />
        <div className="absolute inset-2 rounded-full border-2 border-monokai-cyan/30 animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }} />
        <div className="absolute inset-[22px] rounded-full bg-monokai-purple/15 flex items-center justify-center">
          <BrainCircuit className="w-5 h-5 text-monokai-purple animate-pulse" />
        </div>
        <div className="absolute inset-0 rounded-full shadow-[0_0_28px_rgba(189,147,249,0.4)]" />
      </div>

      {/* Steps */}
      <div className="flex flex-col gap-1.5 items-center">
        {messages.map((msg, i) => {
          const isVis = visible.has(i);
          return (
            <div
              key={msg}
              className="flex items-center gap-2 transition-all duration-400"
              style={{ opacity: isVis ? 1 : 0, transform: isVis ? 'none' : 'translateY(5px)' }}
            >
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isVis ? 'bg-monokai-cyan shadow-[0_0_6px_rgba(139,233,253,0.8)]' : 'bg-monokai-comment/30'}`} />
              <span className={`text-sm ${isVis ? 'text-monokai-fg' : 'text-monokai-comment/30'}`}>{msg}</span>
              {isVis && i === messages.length - 1 && (
                <Loader2 className="w-3.5 h-3.5 text-monokai-cyan animate-spin shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Bar */}
      <div className="w-64">
        <div className="h-1 bg-black/40 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${progress?.progress ?? 10}%`,
              background: 'linear-gradient(90deg, #bd93f9, #8be9fd)',
              boxShadow: '0 0 10px rgba(189,147,249,0.6)',
            }}
          />
        </div>
        <p className="text-center text-[11px] text-monokai-comment/50 mt-1.5 font-mono">{progress?.progress ?? 10}%</p>
      </div>
    </div>
  );
};

// ============================================================
// Importing State
// ============================================================

const ImportingState: React.FC = () => (
  <div className="flex flex-col items-center gap-5 py-10">
    <div className="relative w-16 h-16">
      <div className="absolute inset-0 rounded-full border-2 border-monokai-cyan/20 animate-ping" style={{ animationDuration: '2s' }} />
      <div className="absolute inset-1.5 rounded-full border-2 border-monokai-cyan/40 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.4s' }} />
      <div className="absolute inset-[22px] rounded-full bg-monokai-cyan/10 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-monokai-cyan animate-spin" />
      </div>
      <div className="absolute inset-0 rounded-full shadow-[0_0_28px_rgba(139,233,253,0.3)]" />
    </div>
    <div className="text-center">
      <p className="text-sm font-medium text-monokai-fg">正在导入本体数据</p>
      <p className="text-xs text-monokai-comment/50 mt-1">数据同步至知识图谱引擎</p>
    </div>
  </div>
);

// ============================================================
// Summary Bar
// ============================================================

const SummaryBar: React.FC<{ types: number; objects: number }> = ({ types, objects }) => (
  <div className="flex items-center gap-3 px-3 h-7 rounded-xl bg-monokai-surface/15 border border-monokai-accent/10 mb-3">
    <div className="flex items-center gap-1.5">
      <div className="w-1.5 h-1.5 rounded-full bg-monokai-purple shadow-[0_0_5px_rgba(189,147,249,0.9)]" />
      <span className="text-[11px] text-monokai-comment">{types} 类型</span>
    </div>
    <div className="w-px h-3 bg-monokai-accent/20" />
    <div className="flex items-center gap-1.5">
      <div className="w-1.5 h-1.5 rounded-full bg-monokai-cyan shadow-[0_0_5px_rgba(139,233,253,0.9)]" />
      <span className="text-[11px] text-monokai-comment">{objects} 对象</span>
    </div>
    <div className="ml-auto flex items-center gap-1.5">
      <Zap className="w-3 h-3 text-monokai-yellow/70" />
      <span className="text-[11px] text-monokai-yellow/70">AI 生成 · 可编辑</span>
    </div>
  </div>
);

// ============================================================
// Pipeline Row
// ============================================================

const PipelineRow: React.FC = () => {
  const steps = ['概念解析', '类型生成', '实例创建', '关系推导', '布局优化'];
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          <span className="text-[10px] px-1.5 py-px rounded-full bg-monokai-purple/10 text-monokai-purple/75 border border-monokai-purple/15">
            {s}
          </span>
          {i < steps.length - 1 && (
            <ChevronRight className="w-2 h-2 text-monokai-comment/30 shrink-0 self-center" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

// ============================================================
// Main
// ============================================================

export const OntologyModelingWizard: React.FC<Props> = ({ onClose, onImport }) => {
  const [step, setStep] = useState<WizardStep>(1);
  const [concept, setConcept] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<ModelingProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [objectTypes, setObjectTypes] = useState<ModelingObjectType[]>([]);
  const [objects, setObjects] = useState<ModelingObject[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 40);
    return () => clearTimeout(t);
  }, []);

  const startModeling = useCallback(async () => {
    if (!concept.trim()) { setError('请输入领域概念描述'); return; }
    setError(null);
    setIsLoading(true);
    try {
      const result = await ontologyModelingService.modelFromConcept(concept.trim(), setProgress);
      setObjectTypes(result.objectTypes);
      setObjects(result.objects);
      setStep(2);
    } catch (e: unknown) {
      setError(`建模失败: ${(e as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  }, [concept]);

  const handleImport = useCallback(async () => {
    const result: OntologyModelingResult = {
      objectTypes, objects,
      linkTypes: [], links: [],
      suggestedDDL: '', seedData: {},
      graphLayout: { nodes: [], links: [] },
    };
    setStep(3);
    try {
      await onImport(result);
      onClose();
    } catch (e: unknown) {
      setError(`导入失败: ${(e as Error).message}`);
      setStep(2);
    }
  }, [objectTypes, objects, onImport, onClose]);

  // Type helpers
  const updateObjectType = (i: number, val: Partial<ModelingObjectType>) =>
    setObjectTypes(prev => prev.map((t, idx) => idx === i ? { ...t, ...val } : t));
  const removeObjectType = (i: number) =>
    setObjectTypes(prev => prev.filter((_, idx) => idx !== i));
  const addObjectType = () =>
    setObjectTypes(prev => [...prev, { name: '', description: '' }]);

  // Object helpers
  const updateObject = (i: number, val: Partial<ModelingObject>) =>
    setObjects(prev => prev.map((o, idx) => idx === i ? { ...o, ...val } : o));
  const removeObject = (i: number) =>
    setObjects(prev => prev.filter((_, idx) => idx !== i));
  const addObject = () => {
    const typeNames = objectTypes.map(t => t.name);
    setObjects(prev => [...prev, { name: '', objectType: typeNames[0] || '', properties: {}, annotations: '' }]);
  };

  const typeNames = objectTypes.map(t => t.name);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${mounted ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 backdrop-blur-md bg-black/70" />

      {/* Modal */}
      <div
        className={`
          relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl overflow-hidden
          border border-zinc-800 bg-[#0c0d12] shadow-2xl
          transition-all duration-500
          ${mounted ? 'translate-y-0 scale-100' : 'translate-y-4 scale-[0.98]'}
        `}
        onClick={e => e.stopPropagation()}
      >

        {/* Top accent */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-monokai-purple/70 to-transparent pointer-events-none z-10" />

        {/* ── Header (44px) ──────────────────────────── */}
        <div className="relative shrink-0 flex items-center justify-between px-6 h-11 border-b border-monokai-purple/10">
          {/* Icon + Title */}
          <div className="flex items-center gap-2.5">
            <div className="relative w-7 h-7 shrink-0">
              <div className="w-full h-full rounded-lg bg-zinc-800/50 flex items-center justify-center border border-zinc-700/60">
                <Wand2 className="w-3.5 h-3.5 text-monokai-purple" />
              </div>
            </div>
            <div>
              <h2 className="text-sm font-bold text-monokai-fg leading-tight">AI 本体建模助手</h2>
              <p className="text-[11px] text-monokai-comment/60 leading-tight mt-px">输入概念，自动生成本体结构</p>
            </div>
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-lg flex items-center justify-center
              text-monokai-comment/40 hover:text-monokai-fg hover:bg-monokai-accent/10
              border border-transparent hover:border-monokai-accent/20 transition-all duration-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* ── Body ─────────────────────────────────── */}
        <div className="relative flex-1 overflow-y-auto custom-scrollbar">

          {/* Step indicator */}
          {!isLoading && step !== 3 && (
            <div style={{ animation: 'slideDown 0.3s ease-out 0.05s both' }}>
              <StepIndicator step={step} />
            </div>
          )}

          {/* ── STEP 1 ──────────────────────────────── */}
          {step === 1 && !isLoading && (
            <div className="px-6 pb-6 space-y-3" style={{ animation: 'slideDown 0.3s ease-out 0.12s both' }}>

              {/* Input card */}
              <div className="rounded-2xl border border-monokai-purple/25 bg-monokai-surface/20 p-4
                shadow-[0_0_20px_rgba(189,147,249,0.08)] hover:border-monokai-purple/40 transition-all duration-300">
                <label className="block text-[11px] font-semibold text-monokai-purple/80 mb-2 tracking-widest uppercase leading-none">
                  领域概念描述
                </label>
                <textarea
                  value={concept}
                  onChange={e => setConcept(e.target.value)}
                  placeholder="例如：在线教育平台，包含课程、学生、教师、订单、评价等核心实体\n支持中英文，自动推导对象类型和关系"
                  rows={5}
                  className="
                    w-full h-28 px-4 py-3 text-sm bg-black/40
                    border border-monokai-purple/20 text-monokai-fg
                    placeholder-monokai-comment/30 rounded-xl
                    focus:outline-none focus:border-monokai-purple/55
                    transition-all duration-300 resize-none
                    shadow-[inset_0_1px_4px_rgba(0,0,0,0.3)]
                  "
                />
                <p className="text-[11px] text-monokai-comment/45 mt-2 leading-relaxed">
                  描述越详细，AI 生成的本体模型越精准。建议包含核心实体名称、业务关系和关键属性。
                </p>
              </div>

              {/* Prompt Suggestions */}
              <div className="space-y-1.5 p-1">
                <span className="text-[10px] font-bold text-monokai-comment uppercase tracking-wider block">推荐概念模板</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: '📚 在线教育', text: '在线教育平台，包含课程、学生、教师、订单、评价等核心实体以及它们之间的选课、支付和授课关系。' },
                    { label: '🏥 医疗挂号', text: '医院门诊挂号系统，包括患者、医生、科室、挂号单和电子病历实体，关联挂号与诊断流程。' },
                    { label: '📖 图书馆管理', text: '图书管理系统，包含图书、借阅者、管理人员、借阅单实体，记录图书的借出和归还关系。' },
                    { label: '🌡️ 物联网监控', text: '智能设备物联网监控系统，包含网关设备、传感器子设备、环境警报实体，反映子设备属于网关和触发警报的关系。' }
                  ].map(tpl => (
                    <button
                      key={tpl.label}
                      type="button"
                      onClick={() => setConcept(tpl.text)}
                      className="text-[10px] px-2 py-1 rounded bg-monokai-sidebar/40 border border-monokai-accent/10 text-monokai-comment hover:text-monokai-cyan hover:border-monokai-cyan/35 transition-all"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div
                  className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl
                    bg-monokai-orange/10 border border-monokai-orange/25
                    text-xs text-monokai-orange"
                  style={{ animation: 'shake 0.4s ease-out' }}
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {error}
                </div>
              )}

              {/* Pipeline hint */}
              <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-monokai-surface/15 border border-monokai-accent/10">
                <div className="relative shrink-0 mt-px">
                  <Sparkles className="w-3.5 h-3.5 text-monokai-yellow" />
                  <div className="absolute inset-0 shadow-[0_0_8px_rgba(230,219,116,0.6)] animate-pulse rounded-full" style={{ animationDuration: '2s' }} />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] text-monokai-fg/70 font-medium leading-none">AI 流水线</p>
                  <PipelineRow />
                </div>
              </div>

              {/* Action row */}
              <div className="flex gap-2.5 pt-0.5">
                <button
                  onClick={onClose}
                  className="flex-1 h-9 text-sm font-medium rounded-xl
                    text-monokai-fg/60 bg-monokai-sidebar/30 hover:bg-monokai-sidebar/50
                    border border-monokai-accent/10 hover:border-monokai-accent/20 transition-all duration-200"
                >
                  取消
                </button>
                <button
                  onClick={startModeling}
                  disabled={!concept.trim() || isLoading}
                  className={`
                    flex-1 h-9 text-sm font-bold rounded-xl
                    flex items-center justify-center gap-2 transition-all duration-300
                    ${concept.trim()
                      ? 'text-monokai-bg bg-gradient-to-r from-monokai-purple to-monokai-purple/75 border border-monokai-purple/30 shadow-[0_0_18px_rgba(189,147,249,0.4)] hover:shadow-[0_0_28px_rgba(189,147,249,0.6)]'
                      : 'text-monokai-comment/40 bg-monokai-sidebar/30 border border-monokai-accent/10 cursor-not-allowed'
                    }
                  `}
                >
                  {isLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> AI 建模中...</>
                    : <><Wand2 className="w-4 h-4" /> 开始 AI 建模</>
                  }
                </button>
              </div>
            </div>
          )}

          {/* ── LOADING ────────────────────────────── */}
          {isLoading && (
            <div style={{ animation: 'slideDown 0.3s ease-out' }}>
              <LoadingState progress={progress} />
            </div>
          )}

          {/* ── STEP 2 ──────────────────────────────── */}
          {step === 2 && !isLoading && (
            <div className="px-6 pb-6 space-y-3" style={{ animation: 'slideDown 0.3s ease-out both' }}>

              {error && (
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl
                  bg-monokai-orange/10 border border-monokai-orange/25 text-xs text-monokai-orange">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {error}
                </div>
              )}

              <SummaryBar types={objectTypes.length} objects={objects.length} />

              {/* Object Types */}
              <div>
                <SectionHeader icon={<Layers />} label="对象类型" count={objectTypes.length} accent="purple" onAdd={addObjectType} />
                <div style={{ animation: 'slideDown 0.25s ease-out 0.1s both' }}>
                  {objectTypes.length === 0 ? (
                    <div className="py-4 text-center text-xs text-monokai-comment/35">暂无对象类型</div>
                  ) : (
                    objectTypes.map((ot, i) => (
                      <div key={i} style={{ animation: `cardIn 0.2s ease-out ${i * 40}ms both` }}>
                        <ObjectTypeCard item={ot} index={i} onChange={updateObjectType} onRemove={removeObjectType} />
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Objects */}
              <div>
                <SectionHeader icon={<Table2 />} label="实例对象" count={objects.length} accent="cyan" onAdd={addObject} />
                <div
                  className="max-h-[216px] overflow-y-auto custom-scrollbar pr-0.5"
                  style={{ animation: 'slideDown 0.25s ease-out 0.2s both' }}
                >
                  {objects.length === 0 ? (
                    <div className="py-4 text-center text-xs text-monokai-comment/35">暂无实例对象</div>
                  ) : (
                    objects.map((obj, i) => (
                      <div key={i} style={{ animation: `cardIn 0.2s ease-out ${i * 30}ms both` }}>
                        <ObjectCard item={obj} index={i} onChange={updateObject} onRemove={removeObject} typeNames={typeNames} />
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Action row */}
              <div className="flex gap-2.5 pt-0.5">
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1.5 h-9 px-4 text-sm font-medium rounded-xl
                    text-monokai-fg/60 bg-monokai-sidebar/30 hover:bg-monokai-sidebar/50
                    border border-monokai-accent/10 hover:border-monokai-accent/20 transition-all duration-200"
                >
                  <ChevronLeft className="w-4 h-4" />
                  返回
                </button>
                <button
                  onClick={handleImport}
                  className="flex-1 h-9 text-sm font-bold rounded-xl
                    text-monokai-bg bg-gradient-to-r from-monokai-cyan to-monokai-cyan/75
                    border border-monokai-cyan/30
                    flex items-center justify-center gap-2
                    shadow-[0_0_18px_rgba(139,233,253,0.3)] hover:shadow-[0_0_28px_rgba(139,233,253,0.5)]
                    transition-all duration-300"
                >
                  <ArrowDown className="w-4 h-4" />
                  确认导入 ({objectTypes.length} 类型 / {objects.length} 对象)
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3 ──────────────────────────────── */}
          {step === 3 && (
            <div style={{ animation: 'slideDown 0.3s ease-out' }}>
              <ImportingState />
            </div>
          )}
        </div>

        {/* Bottom accent */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-monokai-cyan/40 to-transparent pointer-events-none z-10" />
      </div>

      {/* Animations */}
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateX(-4px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-3px); }
          40%       { transform: translateX(3px); }
          60%       { transform: translateX(-3px); }
          80%       { transform: translateX(3px); }
        }
      `}</style>
    </div>
  );
};
